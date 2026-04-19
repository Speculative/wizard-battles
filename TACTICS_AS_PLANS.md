# Tactics-as-Plans Refactor

Design doc for the big AI refactor. Read [DESIGN.md](DESIGN.md) first for project context.

## Why

The current `Tactic` interface is a two-tier slice: tactics emit `Directives` (a bundle of knobs: preferredRange, rangeBand, chargeEagerness, dodgeEagerness, circleDir, ambushMode, forceSprint, selectSpell). The control layer (`BasicWizard`) consumes these to drive movement, casting, and event handling.

Directives has grown into a grab-bag. Multiple axes of concern mixed together; new control behaviors force new directive fields; sequential/multi-phase logic has to be faked via `liveDirectives` + internal tactic state. The stateful tactics (AntiMageZone's post-cast rush window, BaitAndSwitch's observation reaction) strain the shape.

The cleaner model from the design doc's roadmap: **tactics are plans** — state machines that produce per-frame outputs. Phases live as internal state; transitions happen inside the tactic. The tactic is an actor, not a config producer.

## Principles

- **Tactics own their state.** They compute what they need each frame from `(self, world)`. No fat context object; no mandatory per-frame bundle. Helpers exist for common computations; tactics call them.
- **Orthogonal concerns stay separate.** Movement output is its own thing. Casting is a separate method invoked per frame. Event/handler pipeline already handles reactive behavior (dodge suppression via `SuppressDodgeHandler`).
- **The control layer enforces legality.** Tactics *request* casts through a controller; the controller rejects illegal requests (cooldown, already charging, dead, etc.). Tactics can't corrupt state by trying things they shouldn't.
- **No declarative vs. code tension.** Tactics are code. Common patterns (orbit-at-range, close-to-melee, face enemy) extract into reusable helpers, not into declarative config.
- **Keep event/handler + component machinery.** All the stage-2/3/4 infrastructure survives: tactics still declare optional detectors/handlers, still have `onObserve`. The selector still runs dormant tactics' detectors. Components stay.

## Shapes

### Tactic interface

```ts
interface Tactic {
  readonly id: string;
  readonly minDwell: number;
  readonly detectors?: EventDetector[];
  readonly handlers?: Handler[];

  score(self: Contestant, world: World): number;
  update(dt: number, self: Contestant, world: World): TacticOutput;
  maybeCast?(
    dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void;
  onObserve?(key: string, value: unknown): void;
  currentPhaseId?(): string | undefined;
}
```

Removed from the old interface: `directives()`, `liveDirectives()`. Folded into `update()` and internal state.

### TacticOutput

Movement-only. Cast and reactive behavior live elsewhere.

```ts
interface TacticOutput {
  moveIntent: Vec2;      // unit vector in x/z plane, or STATIONARY sentinel
  paceHint: "walk" | "run" | "sprint" | "hold";
  facingIntent: Vec2;    // unit vector, or STATIONARY for "hold current facing"
}

const STATIONARY: Vec2 = Object.freeze({ x: 0, z: 0 });
```

`moveIntent = STATIONARY` → no movement intent this frame (body decays via friction).

`facingIntent = STATIONARY` → keep current facing; don't rotate.

`paceHint` is a *hint*, not a direct state assignment. The wizard's existing movement-state machine (idle/walking/running/sprinting) interprets the hint alongside context (stamina, distance to target, recovering state). `"hold"` means "don't care, keep the current state if reasonable."

### CastController

The wizard exposes this. Tactics call it from `maybeCast`. Controller enforces rules.

```ts
interface CastController {
  requestCast(
    factory: SpellFactory,
    target: Contestant | null,
    aim: Vec2
  ): boolean;
  cancelCharging(): void;
  updateAim(target: Contestant | null, aim: Vec2): void;
  isCharging(): boolean;
  currentFactory(): SpellFactory | null;
  isReady(factory: SpellFactory): boolean;
}
```

- `requestCast`: tactic picks a spell and target. Controller returns `true` if cast started (wizard now in charging state), `false` if rejected (cooldown, already charging, wizard not alive, caster in bad state).
- `cancelCharging`: abort an in-progress charge. Fireball/melee/etc. get marked `dead`; the wizard exits the charging state. Cooldown may or may not be preserved depending on policy — TBD but probably a partial reset (reduced cooldown since the cast didn't complete).
- `updateAim`: during charging, a tactic can re-target. Useful for cast-time aim correction.
- `isCharging`, `currentFactory`, `isReady`: read-only queries.

Most tactics will implement `maybeCast` trivially: "if ready and in range, request cast." Complex tactics track charge state and may retarget or cancel mid-charge.

### Tactic helpers

```ts
// src/tactics/helpers.ts

// Common world queries
export function nearestEnemy(self: Contestant, world: World): Contestant | null;
export function surfaceDistance(a: Contestant, b: Contestant): number;
export function centerDistance(a: Contestant, b: Contestant): number;
export function directionFromTo(from: Vec2, to: Vec2): Vec2;

// Movement (return a Vec2 for TacticOutput.moveIntent)
export function orbit(
  self: Contestant,
  target: Contestant,
  preferredSurfaceRange: number,
  band: number,
  dir: -1 | 1
): Vec2;
export function closeTo(
  self: Contestant,
  target: Contestant,
  minSurfaceDist: number
): Vec2;
export function backOffFrom(
  self: Contestant,
  target: Contestant,
  minSurfaceDist: number
): Vec2;
export function holdPosition(): Vec2;  // returns STATIONARY

// Facing
export function faceContestant(self: Contestant, other: Contestant): Vec2;
export function faceVector(v: Vec2): Vec2;
export function holdFacing(): Vec2;

// Cast convenience
export function tryRequestCastIfReady(
  caster: CastController,
  factory: SpellFactory,
  target: Contestant | null,
  aim: Vec2
): boolean;
```

The movement helpers wrap the existing `circle()` / `seek()` / etc. primitives from [src/steering.ts](src/steering.ts). Contestant-aware (convert surface ↔ center distance, handle radii).

`orbit` with `band: 0` + very tight range emulates `closeTo`. Different helpers exist for ergonomic reading of tactic code.

## Control layer rewrites

### BasicWizard frame loop

```
per-frame {
  tacticSelector.update(dt, self, world)
  tacticSelector.updateDormantObservations(self, world)
  activeTactic = tacticSelector.currentTactic

  // Event pipeline (unchanged)
  changes = runPipeline({ self, world, detectors, handlers })
  for change in changes { ... /* existing logic */ }

  // Movement + facing from active tactic
  const output = activeTactic.update(dt, self, world)
  applyMoveIntent(output.moveIntent, output.paceHint)
  applyFacing(output.facingIntent)

  // Cast intent
  activeTactic.maybeCast?(dt, self, world, castController)

  // Rest of update (body physics, components, status display) unchanged
}
```

### Movement integration

`applyMoveIntent(moveIntent, paceHint)`:

- If `moveIntent === STATIONARY` (magnitude < ε): clear body intent. Body decays via friction. State goes to `idle` over time.
- Else: pass `moveIntent` through `sampleBestDirection` (the existing wall-avoidance refinement) to get the final intent, set it on body.
- Pace hint gates movement-state transitions. Mapping:
  - `"walk"` → force walking state (max speed 60).
  - `"run"` → running state as default when moving.
  - `"sprint"` → enter sprinting if stamina allows; reaches ambush-suppression via... wait, we're dropping ambushMode. See below.
  - `"hold"` → let the existing state machine heuristics run as they do today (walking if at engagement shell, else running; sprint if some condition).

`ambushMode` and `forceSprint` are no longer directives. They become tactic choices encoded as pace hints: ambush-style tactics emit `paceHint: "walk"`. Rushing tactics emit `"sprint"` when outside their desired range and `"walk"` when inside. The wizard stops making any independent decisions about sprint vs. walk — the tactic decides.

This is a behavioral change worth noting: today `BasicWizard.updateState` has logic like "if within 180 of target switch to walking." That logic dies. Tactics drive pace entirely.

### Facing integration

`applyFacing(facingIntent)`:

- If `facingIntent === STATIONARY`: don't rotate, keep current facing.
- Else: pass through the existing `updateFacing` with `facingIntent` as the target direction. The 75° sprint-facing cone still applies (wizard body can't turn faster than its physics allows).

### Cast controller implementation

The wizard implements `CastController`:

```ts
class WizardCastController implements CastController {
  requestCast(factory, target, aim) {
    if (!this.wizard.alive) return false;
    if (this.wizard.state === "sprinting" ||
        this.wizard.state === "recovering" ||
        this.wizard.state === "dodging" ||
        this.wizard.state === "charging") return false;
    if (!this.isReady(factory)) return false;

    // existing cast pipeline: create spell, freeze, enter charging state
    const spell = factory.create(this.wizard, target, aim);
    spell.frozen = true;
    this.wizard.chargedSpell = spell;
    this.wizard.chargedFactory = factory;
    this.wizard.chargeTarget = target;
    this.wizard.world.addSpell(spell);
    this.wizard.setState("charging", factory.metadata.chargeTime);
    return true;
  }

  cancelCharging() { ... }
  updateAim(target, aim) { ... }
  isCharging() { return this.wizard.chargedSpell !== null; }
  currentFactory() { return this.wizard.chargedFactory; }
  isReady(factory) {
    const readyAt = this.wizard.readyAt.get(factory) ?? 0;
    return readyAt <= performance.now() / 1000;
  }
}
```

### Selector

Renamed or kept as `TacticSelector`, unchanged API surface except:

- `score(self, world)` signature change (was `score(ctx)`)
- No more `effectiveDirectives()` — gone.
- `updateDormantObservations(self, world)` unchanged.

### Event/handler pipeline

**Unchanged.** `LateralDodgeHandler`, `SuppressDodgeHandler`, `NoteOpponentChargingHandler`, `ProjectileIncomingDetector`, `OpponentChargingDetector` all keep working. Tactics still declare `detectors` and `handlers` optionally.

The architectural note about dodge-should-be-plan-authored (from DESIGN.md) still applies. A tactic that doesn't want to dodge binds `SuppressDodgeHandler`. Eventually this should be replaced by plans declaring their dodge policy directly, but not in this refactor — that's a follow-up.

### Components

**Unchanged.** `Charging`, `Dodging`, `Recovering` components install on state transitions.

## Debug

- Selector logs `<id> tactic -> <new tactic>` as today.
- Tactics can expose `currentPhaseId(): string | undefined`. Wizard polls this; when the id changes, log `<id> phase <old> -> <new>`.
- Cast controller logs cast requests that get rejected (optional, for debugging only).

## Migration plan

Three sessions, incremental, leave-game-playable-each-session.

### Session A: Plumbing + one simple + one multi-phase tactic

1. Write new `Tactic` interface in a new file (keep old one around temporarily).
2. Write `TacticOutput`, `STATIONARY`, `CastController`.
3. Write `src/tactics/helpers.ts` with movement + facing + cast helpers.
4. Refactor `BasicWizard.update` to the new frame loop. Cast pipeline refactored to go through `CastController`.
5. Port `Orbit` to the new shape as a reference for simple tactics.
6. Port `DuelistCharge` as a two-phase tactic: `"close"` phase (sprint toward target, no cast) transitioning to `"strike"` phase (hold, melee on cooldown). Proves multi-phase shape works.
7. Every other wizard still uses old tactics via a compatibility shim (temporary): old `Tactic` becomes a new `Tactic` by wrapping its `directives()` output into the new shape. Single shim, handles all existing tactics unchanged.
8. Remove debug logs from prior sessions that shouldn't ship.

Red should behave same-or-better after Session A. Other wizards unchanged behavior.

### Session B: Port simple tactics

1. Port `Pressure`, `Kite`, `Orbit`, `Ambush`, `Retreat` (common) using the helpers.
2. Port `BaitAndSwitch` (has observations + charge-reaction).
3. Port `Sniper`, `Turtle`, `Scrapper` (signature).
4. Old tactic files deleted.
5. Compatibility shim from Session A deleted.

### Session C: Port multi-phase tactics

1. Port `AntiMageZone` as a three-phase tactic: `"approach"` (close to mid-range), `"cast"` (hold, cast field), `"rush"` (sprint to melee, hand off to DuelistCharge via score).
2. Update rosters in `main.ts` — should be no-op if id/behavior preserved.
3. Verify all four wizards still fight correctly.
4. Update [DESIGN.md](DESIGN.md) — Current implementation status, architecture, Done/Next.

### Session D (optional, deferred): Position reasoning

Tactics emit candidate destinations, not just preferred ranges. Plans score destinations against multiple constraints (range, wall clearance, cover, etc.). Addresses the center-drift limitation documented in DESIGN.md navigation section.

This is its own refactor — not part of the plans refactor. Requires the plan machinery to be solid first.

## Open decisions punted to implementation time

- **`cancelCharging` semantics.** Does cancelling charge preserve partial cooldown? Full refund? Half? Preserve the charge time already spent as progress toward the next cast?  Probably: cancel = full refund for now, simple and tactics can reason about it.
- **Update loop ordering within a tick.** Update facing before or after body physics? Probably same as today (facing reacts to velocity). Could be revisited.
- **`paceHint: "hold"` semantics.** Exactly what heuristic does the wizard fall back to? Simplest: `paceHint: "hold"` → treat as `"run"`. Tactics that care use specific hints.

## What to preserve from current code

- [src/steering.ts](src/steering.ts) primitives — helpers wrap these.
- Event/handler pipeline in [src/events/](src/events/), [src/handlers/](src/handlers/), [src/handlers/pipeline.ts](src/handlers/pipeline.ts).
- Component system in [src/components.ts](src/components.ts).
- Kinematic body in [src/kinematics.ts](src/kinematics.ts).
- Spell metadata + factory + selection library (helpers still apply).
- Movement state machine in [src/contestants/basicWizard.ts](src/contestants/basicWizard.ts) (idle/walking/running/sprinting/dodging/charging/recovering). The transitions get different triggers — tactic-emitted pace hints instead of `distToTarget < 180`-style heuristics — but the states themselves and their stats stay.
- All existing spells: Fireball, MeleeAttack, ProjectileSlowField, Explosion, ParticleBurst.
- Status display, speed trails.

## What goes away

- `Directives` type
- `Tactic.directives()`, `Tactic.liveDirectives()`
- `TacticContext` (as a type passed to scoring/directives)
- `Directives.forceSprint`, `Directives.ambushMode`, `Directives.chargeEagerness`, `Directives.dodgeEagerness`, `Directives.circleDir`, `Directives.spellPreference` (was already replaced by `selectSpell`)
- `BasicWizard`'s "within 180 of target, use walking" and similar distance-based state-machine heuristics. Tactics drive pace now.

Selector's `effectiveDirectives()` goes away. Selector's `score()` signature changes. `update()` on selector keeps its role.
