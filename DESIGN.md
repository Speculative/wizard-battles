# Wizard Battles — Design Doc

## Intent

A canvas-based, auto-playing simulation game. AI-controlled wizards (represented as spheres with different colors/adornments) fight each other in a 3D rectangular-prism arena viewed from an isometric angle. Non-interactive: the viewer watches the battle play out. Stylized/cartoony look rather than realistic.

The central design principle is **legibility over optimality** — the fights should be interesting to watch. Visible personalities, visible learning, visible habits. Wizards should look smart in ways a viewer can read, not smart in ways that only show up in win-rate graphs.

## Current Goals

- Support many contestant types (all spheres, visually distinguished) with different spells, via a generic `Contestant` + `Spell` interface.
- Arena is a rectangular prism with cut-away walls so the interior is visible from the iso camera.
- Scene is fixed in logical units (1000×1000 floor, 400 tall) and the renderer scales to fit any canvas size — a larger screen shows the same amount of play area, just bigger.
- Canvas fills the page width at 16:9 aspect ratio.

## Architecture

- **[src/main.ts](src/main.ts)** — entry point; constructs renderer, world, arena, contestants; drives the game loop.
- **[src/renderer.ts](src/renderer.ts)** — Three.js setup: scene, orthographic iso camera fitted to the arena's projected bounds, lights, shadow map.
- **[src/world.ts](src/world.ts)** — owns contestants + spells; drives per-frame updates; resolves contestant-vs-contestant collisions; holds a reference to the camera (used by status displays for billboarding).
- **[src/arena.ts](src/arena.ts)** — builds the floor + two rear walls + wireframe prism edges + gridlines.
- **[src/kinematics.ts](src/kinematics.ts)** — `KinematicBody` class: position, velocity, intent; integrates acceleration toward intent with turn-rate cap, friction when idle, max-speed clamp.
- **[src/statusDisplay.ts](src/statusDisplay.ts)** — HP + stamina bars billboarded to the camera, rendered above each contestant.
- **[src/materials.ts](src/materials.ts)** — shared toon gradient map; inverted-hull outline helper.
- **[src/steering.ts](src/steering.ts)** — pure-function steering primitives (`seek`, `flee`, `arrive`, `pursue`, `evade`, `circle`, `wallRepulsion`, `sampleBestDirection`) returning `Vec2` desired-velocities. The wizard no longer applies any of these directly; tactics compose them and the candidate-scoring helpers in [src/tactics/helpers.ts](src/tactics/helpers.ts).
- **[src/tactics/](src/tactics/)** — AI tactic layer. `tactic.ts` defines the `Tactic` interface, `TacticOutput`, `CastController`, `PaceHint`, `DodgePolicy`, `STATIONARY`, `RosterEntry`. `native.ts` implements the concrete tactics (Pressure, Kite, Orbit, Ambush, Retreat, BaitAndSwitch, DuelistCharge, CloseQuarters, AntiMageZone, Sniper, Turtle, Scrapper, AvoidIncoming). `helpers.ts` provides shared building blocks for tactics: world queries (`nearestEnemy`, `surfaceDistance`), wizard accessors, the candidate-scoring toolkit (`sampleRing`, `sampleRingAroundEnemy`, `pickSafeDirection`, `ringDirections`, `arcDirections`, `scoreByWallClearance`, `scoreByArenaCenter`, `scoreByReachability`, `scoreByRangeMatch`, `scoreByAngularPreference`, `scoreAwayFromProjectiles`, `pickBest`, `steerToward`), incoming-threat checks (`hasIncomingProjectile`), a generic mobility-spell helper (`tryMobilityAway`), and the default cast-request path (`tryDefaultCast`). `selector.ts` scores a roster each second with random jitter and commits to the winner for its minimum dwell, logs phase transitions via each tactic's optional `currentPhaseId()`, and exposes `forceRescore(self, world, reason)` for interrupt-driven same-frame rescoring (used by both pipeline-emitted `interrupt` Changes and tactic-authored `shouldYield` returns).
- **[src/components.ts](src/components.ts)** — component registry (ECS-style but only the component part). `ComponentKey<T>` is a typed key with a string id. Current keys: `Charging`, `Dashing`, `Recovering`. Contestants attach/remove components as their state changes; any system can query `contestant.getComponent(Key)` without knowing the contestant's concrete type.
- **[src/events/](src/events/)** — event detection layer. `event.ts` defines `GameEvent<P>` and `EventDetector<P>`. `projectileIncoming.ts` detects threatening spells on a collision-course. `opponentCharging.ts` detects any contestant with the `Charging` component — uses component query instead of contestant-type-specific inspection. `lowHPCrossed.ts` is edge-triggered when the wizard's HP falls below a threshold (default 40%); rearms when HP rises back above.
- **[src/handlers/](src/handlers/)** — reactive handler layer. `change.ts` declares the `Change` discriminated union (`forceMovementState`, `observe`, `interrupt`, `noop`) and the `HandlerTier` enum (`reflexive` > `tactical` > `observational`). `handler.ts` defines the `Handler<P>` interface (event id binding + tier + terminal flag); handlers receive `(self, event, world)` so they can score against world state. `lateralDodge.ts` is a reflexive terminal handler that picks a dodge direction by scoring an arc of candidates around the perpendicular-away vector via `pickSafeDirection`, then emits a `forceMovementState: dashing`. `noteOpponentCharging.ts` is an observational non-terminal handler that emits an observe Change so the active tactic can react. `interruptOnLowHP.ts` is a reflexive terminal handler that emits an `interrupt` Change. `interruptOnProjectile.ts` is a reflexive non-terminal handler that emits an `interrupt` Change ahead of the dodge handler, letting the active tactic rescore on the same frame the projectile arrives. `pipeline.ts` runs detectors, dispatches events to handlers in tier order (stable sort preserves registration order within a tier, so tactic-first handler lists get tactic precedence for free), stops a chain at the first terminal handler.
- **[src/contestants/contestant.ts](src/contestants/contestant.ts)** — `Contestant` interface (mesh, position, velocity, facing, radius, hp, alive, update, plus `getComponent/addComponent/removeComponent`).
- **[src/contestants/basicWizard.ts](src/contestants/basicWizard.ts)** — first concrete contestant. Holds a kinematic body, a state machine (see below), stamina, a `TacticSelector`, a `spellbook: SpellFactory[]`, facing with strafe tax, committed lateral dashes (triggered via the event/handler pipeline), charged spell casts with predictive aiming, status display, speed trail. Each frame: selector picks the active tactic, pipeline runs reactive detectors/handlers, interrupts are processed first (forcing a same-frame rescore if any), then `forceMovementState` Changes are realized (subject to the active tactic's `dodgePolicy`), then the active tactic's `update(dt, self, world)` returns a `TacticOutput` (move intent + pace hint + facing intent). The wizard applies the 75° sprint-facing cone to facing while sprinting, the state machine transitions based on the pace hint and stamina, and finally `tactic.maybeCast(dt, self, world, castController)` is called so the tactic can start a new cast through a `CastController`. The controller enforces cast legality (not sprinting / dashing / charging, cooldown respected, spell ready). Movement-state transitions install/remove components (`Charging`, `Dashing`, `Recovering`). When no enemy is alive, the wizard falls back to a slow random wander.
- **[src/spells/spell.ts](src/spells/spell.ts)** — `Spell` interface (mesh, position, velocity, caster, metadata, dead, update). `SpellMetadata` carries id, kind (projectile/instant/zone/buff), element, range {min,max} (surface-to-surface), chargeTime, cooldown, and tags. `SpellFactory` pairs metadata with a `create(caster, target, aim)` constructor — the unit of selection.
- **[src/spells/selection.ts](src/spells/selection.ts)** — selection library. Predicates (`byTag`, `byAnyTag`, `byAllTags`, `byKind`, `byElement`, `inRange`) + comparators (`preferLongestRange`, `preferShortestCooldown`, `preferShortestCharge`) + `defaultSelector`. Tactics compose these into their own `SpellSelector` function. No fixed preference fields — selection is code, not configuration.
- **[src/spells/fireball.ts](src/spells/fireball.ts)** — four-layer fiery projectile with sphere-node trail. Supports `frozen` mode during caster's charge window; `setPosition` for caster-relative positioning during charge; `setVelocityFromDirection` on release. Spawns an `Explosion` and a `ParticleBurst` on impact. Exports `FireballFactory`.
- **[src/spells/meleeAttack.ts](src/spells/meleeAttack.ts)** — self-spell with a glowing cone-arc mesh. Locks caster position during the charge window (existing `charging` state); during the released phase, lunges the caster mesh forward ~18u then back (visual only, no kinematic movement). Hit check is a ±60° cone up to 54u surface-to-surface reach during a short window in the middle of the swing. Exports `MeleeFactory`.
- **[src/spells/projectileSlowField.ts](src/spells/projectileSlowField.ts)** — zone spell that drops a translucent blue dome at the caster's position. 130u radius, 4s duration, 6s cooldown. Iterates projectiles each tick, scales their velocity to 25% of baseSpeed while inside the dome and restores on exit. First cross-spell interaction. Exports `ProjectileSlowFieldFactory`.
- **[src/spells/blink.ts](src/spells/blink.ts)** — instant self-spell that teleports the caster up to 180u in an aim direction, clamped by arena bounds. Tags `["blink", "mobility", "self"]`. 0.08s charge, 5s cooldown. Spawns two cool-blue particle bursts (depart at origin, arrive at destination). Exports `BlinkFactory`.
- **[src/spells/explosion.ts](src/spells/explosion.ts)** — short-lived expanding-sphere visual effect. Pure cosmetic; no damage.
- **[src/spells/particleBurst.ts](src/spells/particleBurst.ts)** — `THREE.Points`-based particle system (single draw call). Soft circular texture built once via canvas per palette, cached and shared across bursts. Default palette is fire-orange (used by fireball impacts); blink supplies a cool-blue/purple palette.
- **[src/config.ts](src/config.ts)** — arena and camera constants.

## Rendering notes

- **Toon shading** via `MeshToonMaterial` with a 16-step smoothstep gradient map for a soft, cartoony falloff (not hard cel-shaded bands).
- **Inverted-hull outlines** on contestants: duplicated sphere at 1.05×, `BackSide`, dark material.
- **Shadows:** single `SpotLight` above-front-right of arena center casts shadows on the floor *and walls*. Uses `BasicShadowMap` — `PCFSoftShadowMap` and `PCFShadowMap` are broken/deprecated in Three.js r184 and don't render at all. Higher shadow map resolution (2048) compensates for the resulting aliasing.
- **Flat arena surfaces:** floor + walls are `MeshStandardMaterial` with high `emissive` so they read as uniform color despite being lit. The non-emissive `color` component is what makes shadows visible. Walls tilt slightly more emissive than the floor (80%/20% vs 65%/35%) because their light-facing angle is glancier — without the bias they'd read darker than the floor.
- **Prism edges:** `LineSegments` with `polygonOffset` on walls/floor so edges sit in a depth-buffer gap — no z-fighting, still correctly occluded by contestants crossing in front.
- **Speed trails:** short fading-color `THREE.Line` behind each wizard during sprint and dodge, sampled at 30 ms intervals. Buffer wipes cleanly on state transitions (prevents "stuck anchor" artifacts). Fade removes from the tail, not the head, so the trail recedes into the wizard instead of staying pinned at sprint origin.
- **Status bars:** plane meshes above each wizard, quaternion-copied from the camera each frame for billboarding; `depthTest: false` + `renderOrder: 10` so bars render over everything. HP on top, stamina below.
- **Charging visual:** while a wizard is in the `charging` state, its fireball exists as a spell instance with `frozen = true`, positioned each frame via `Fireball.setPosition(...)` in front of the caster along the aim direction. On release, the fireball receives a fresh velocity from `computeAimDirection` (predictive lead + decaying Gaussian noise).
- **Fireball appearance:** four nested spheres with size 55% → 135% of base radius, forming a color gradient from warm-orange core (solid, normal-blended) through orange / red-orange / deep red additive halos. Saturated oranges rather than whites — whitish cores were reading as off-model. Short trail of pooled additive-blended sphere nodes sampled every 25 ms, fading with a quadratic falloff.
- **Explosion effect:** on fireball impact (hit target, wall, or floor — not on lifetime-expiration), spawns a short-lived `Explosion` (expanding orange+red sphere) plus a `ParticleBurst`. Burst uses `THREE.Points` with a canvas-generated soft radial texture (orange → dark red → transparent), additive-blended, 28 particles with random 3D velocities, upward bias, gravity pulling them back down over ~0.55 s.

## Movement & Physics

The foundation everything else sits on. If movement feels good, even dumb AI looks decent; if it feels floaty or snaps in bad ways, no amount of clever tactics saves it. Momentum-based kinematics, not a full rigid-body sim — we roll our own.

### Scope

- **Kinematic bodies, not dynamic.** Hand-rolled Euler integration. No physics library (Rapier, cannon-es). Collision detection stays manual (we already have sphere-sphere).
- **Projectiles get kinematics too.** Eventually we'll distinguish "magical" spells (e.g. fireball — straight-line, no mass) from "physical" projectiles (e.g. levitated chunks of floor thrown at opponents). The distinction matters because some spells interact with physical projectiles (e.g. an anti-projectile field that slows non-magical projectiles).

### Physical model — implemented

`KinematicBody` (in [src/kinematics.ts](src/kinematics.ts)) integrates in the x/z plane with these per-body stats:

- `maxSpeed` — top speed clamp
- `acceleration` — how fast velocity converges toward the intent vector
- `friction` — deceleration when no intent is set
- `turnRate` — angular cap (rad/s) on how fast velocity direction can rotate at speed

The body takes an intent vector; each tick it accelerates toward `intent * maxSpeed`, rotated-clamped by `turnRate` so the velocity curves rather than snaps.

Deferred from the original parameter list: `mass` (for knockback), `max_air_speed` / `air_control` / `jump_impulse` (requires jumping + airborne state), `reaction_time_base` (requires AI event queue), `recovery_multiplier` (global recovery scalar — currently per-state hardcoded).

### Movement states — implemented

`BasicWizard` owns a state machine with per-state `MovementStats`. Current states:

- **idle** — no intent, high friction
- **walking** — nimble, low speed (when close to target)
- **running** — default cruise
- **sprinting** — high speed, low turn rate; drains stamina; used to close big distances
- **dashing** — short burst (0.08–0.22s scaled by stamina), fixed direction, very high acceleration. The neutral *mechanism*: a quick committed impulse. Today it's used reactively for projectile dodges; offensive uses (slip past an enemy mid-strike) sit on the same machinery. See "Dodges and dashes" below.
- **charging** — locked to caster, reduced mobility while a spell winds up
- **recovering** — near-motionless; entered after sprint exhaustion or dash landing. Essential tail on committed actions.

Grounded / airborne split deferred until jumps land.

### Facing, attention, and the strafe tax

Facing is a *contestant* concern, not a physics concern — a wizard can be strafing sideways while looking at an enemy. Every `Contestant` has a `facing` unit vector independent of velocity.

- `BasicWizard.facing` rotates toward an intent-vector-of-attention: charge target (if charging) > nearest enemy > current move direction.
- Move speed is scaled by the dot product of facing and movement direction: 100% forward, ~60% sideways, ~40% backward. Strafing has a legible cost.
- **Commitment exception:** during sprint and dash, facing aligns to move direction and the strafe tax is bypassed. These are full-commit actions; "look where you're going" reads right.
- Visible facing indicator: a small dark cone protruding from each wizard's sphere.

### Dodges and dashes

The *dash* is a movement-state mechanism — a committed lateral burst with high acceleration, fixed direction, brief duration, and a recovery tail. It's not specifically a dodge; offensive uses (e.g. slip past an enemy during their cast) sit on the same machinery.

The *dodge* is a reactive use of the dash, triggered by `LateralDodgeHandler` (reflexive terminal) when an enemy projectile is inside sense radius AND roughly heading at the wizard AND its predicted closest-approach falls inside `radius + safety_margin`. The handler picks a direction by scoring an arc of candidates around the perpendicular-away vector via `pickSafeDirection` (factors: distance from projectile trajectory, distance from enemies, wall clearance, arena-center bias). It emits a `forceMovementState: dashing` Change which the wizard's state machine realizes — but only if the active tactic's `dodgePolicy(self, world)` returns `"always"`. Tactics that need to commit (DuelistCharge, AntiMageZone in cast/rush phases, AvoidIncoming when a mobility spell is ready) return `"never"` and the dodge is logged-and-blocked.

Costs stamina proportional to duration used; has a cooldown + minimum stamina to start. Ends in `recovering` (brief motionless tail) so dashes are real commits, not free reactions.

### Endurance: stamina only (for now)

Single short-term resource: **stamina** (0–3.0) drains on sprint and dodge; regens when not. Empty stamina while sprinting → forced `recovering`. Resets at match start.

We originally had a second long-term "vigor" axis that slowly drained and scaled `maxSpeed` down over a match. It produced the degenerate failure mode of all fights collapsing into dodge-duels once vigor got low (sprint speed dropped with vigor, dodge impulse didn't → dodges became relatively better). Removed; can reintroduce later if a multi-match or tournament mechanic needs it.

Visualization: two stacked bars above each wizard. HP on top (green → red), stamina below (orange).

### Jumps as commitments — deferred

Jumps should be decisions, not traversal filler:
- Fixed arc once launched (air_control < ~0.3)
- Some spells can't be cast airborne, or have modified properties when cast mid-jump
- Brief landing recovery

A jump toward the opponent is a commit; a jump away is a retreat; a jump over a projectile is a dodge with a cost. Revisit when we need the vertical axis for real (obstacle hopping, vertical spells).

### Reaction time — deferred

Modeled as **input lag on the AI**: when a stimulus occurs (opponent casts, projectile fired), the decision doesn't reach the control layer for delay τ. Personality-linked — twitchy fighters have shorter τ, deliberate ones longer. Also learnable: τ decays with experience for the "getting into the zone" arc within a match.

Two benefits: legible "caught off-guard" moments (viewer sees the contestant start reacting a beat late), and feints/mix-ups actually work (without reaction delay there's nothing to feint against).

**Implementation note:** this likely wants an event queue — each AI gets a pending-events buffer rather than a per-frame world poll. Defer the design until we pick it up.

### Momentum-aware AI — deferred

Once physics has momentum, the AI must reason about it or it looks dumb — ordering sharp reversals the body can't execute, trying to stop on a dime and sliding past the target. Two cheap pieces buy most of the value:

- **Predicted self-position.** When the AI considers an action, it knows where its own body will be in N ms given current velocity + the action's acceleration profile. "Can I get to cover in time?" becomes answerable. (One narrow use is already in: dodge's closest-approach filter does a lightweight linear forward-sim.)
- **Commitment cost.** Action-selection utility penalizes direction reversals proportional to current momentum. Without this penalty, momentum physics just makes the AI look incompetent.

### How this feeds the decision hierarchy

Movement sits under the three-tier hierarchy (it *is* part of the control layer) but feeds upward:
- Tactic selection considers movement profile ("kite" is a bad tactic for a low-accel heavy)
- Action selection considers current momentum (commitment cost)
- Opponent modeling can include *their* movement tendencies (does this opponent over-commit on dashes?)

## AI & Progression

Hand-authored AI, not learned end-to-end. ML is scoped to narrow subproblems where it buys something concrete. Aesthetic constraint: viewers must be able to **see** what a wizard is doing and why.

### Three-tier decision hierarchy

Utility AI + steering behaviors, organized as three timescales:

- **Tactic layer (seconds to tens of seconds).** The current named plan: "pressure at close range," "kite until mana regens," "bait a teleport then punish." Re-evaluated every 2–4 seconds or on interrupt. This is what viewers should be able to name as they watch.
- **Action layer (hundreds of ms to seconds).** Discrete moves within the current tactic: cast, dash, teleport, strafe. Re-evaluated every 0.3–0.8s or on action completion. Scored by tactic-specific utility, drawn from a tactic-specific action pool.
- **Control layer (per frame).** Steering vectors, aim, animation. Pure execution, no decisions.

### Current implementation status

We have a simplified two-tier slice of the above: **tactic layer → control layer**, no distinct action layer yet. **Tactics are plans** — state machines that expose `update(dt, self, world) → TacticOutput` (move intent + pace hint + facing intent) and `maybeCast(dt, self, world, castController)` for cast requests. Each tactic owns its internal state (phase, observation buffers, timers). There is no `Directives` record and no per-frame parameter bundle: the output is the actor's movement and facing for that frame.

Thirteen tactics are implemented in [src/tactics/native.ts](src/tactics/native.ts). Simple orbit-at-range tactics (Pressure, Kite, Orbit, Ambush, Retreat, Sniper, Turtle, BaitAndSwitch, Scrapper) sample a ring of candidate positions around the enemy, score them with the candidate-scoring toolkit, pick the best, and steer toward it. Stateful ones step through explicit phases:
- **DuelistCharge** — single-purpose approach tactic: sprint toward enemy with sampling-based approach-angle scoring (dodges projectiles, avoids walls), `shouldYield`s `"arrived"` once within ~55u surface distance so CloseQuarters takes over.
- **CloseQuarters** — close-range fighting tactic (~35u surface, walking, melee on cooldown). Default dodge policy (allows reactive dash). Yields if the enemy slips beyond ~150u.
- **AntiMageZone** — `approach` (orbit at mid-range) → `cast` (stationary, request zone cast) → `rush` (sprint onto enemy for 4s after casting; yields when within melee range so CloseQuarters takes over). `dodgePolicy` is `"always"` during approach, `"never"` during cast/rush.
- **BaitAndSwitch** — direction-flipping kite with an `OpponentCharging` observation; scores higher while an enemy is winding up a cast.
- **Scrapper** — timer-driven circle-flip and range-reroll to look chaotic.
- **AvoidIncoming** — fires whenever a threatening projectile is detected. Tag-driven and parameterizable: queries the spellbook for any ready spell matching `["blink", "teleport"]` (or whatever tags the constructor receives). Conditional `dodgePolicy`: `"never"` when a mobility spell is ready (so the spell fires instead of a dash), `"always"` otherwise (so the common `LateralDodgeHandler`'s dash still saves you). `update` emits a sprint along a `pickSafeDirection` away vector as a fallback for when neither blink nor dash fires.

A `TacticSelector` scores the active wizard's roster every second, applies random jitter, and commits to the winner for its minimum dwell. Dormant-tactic detectors run too (stage 4), so tactics can build up observations while not yet active and use them in scoring to earn selection. When a tactic's `currentPhaseId()` changes between frames, the selector logs the transition.

**Position planning lives in tactics, not the wizard.** Each frame, tactics that care sample a set of candidate positions and score them with composable factors: `scoreByRangeMatch` (preferred distance to enemy), `scoreByAngularPreference` (orbit direction, decayed when far from range so wizards don't spiral while approaching), `scoreByReachability` (prefer nearby), `scoreByWallClearance` (cubic penalty within wallHorizon), `scoreByArenaCenter` (mild center pull — fixes the old center-drift problem), `scoreAwayFromProjectiles` (avoid projectile lines). The chosen position becomes a steering target via `steerToward`. Tactics that don't compose these get exactly the behavior they ask for — no implicit wall avoidance from the wizard. The same toolkit is used for picking dash/blink directions in handlers.

Movement pace is driven entirely by tactics via `PaceHint` (`"walk" | "run" | "sprint" | "hold"`). The wizard's state machine interprets the hint with stamina as a gate — `"sprint"` requires stamina to enter, drains it while active. `"hold"` defaults to running. Distance-based pace heuristics in the wizard are gone.

Facing is driven by tactics too. The `facingIntent` vector in `TacticOutput` becomes the turn target; `STATIONARY` means "hold current facing." The sprint-facing cone (75°) still clamps the facing while sprinting — a physics invariant, not a tactic choice.

**Cast legality is the controller's job, not the tactic's.** Tactics call `castController.requestCast(factory, target, aim)`; the controller rejects if the wizard is sprinting / dashing / charging / dead, or if the spell is on cooldown. Tactics are free to try; the world is consistent by construction.

Reactive behaviors flow through an **event/handler pipeline** (see "Events and handlers" below). Detectors observe the world, handlers decide reactions, Changes feed back to the wizard and the active tactic. Dodge uses it (common detector + terminal handler); BaitAndSwitch demonstrates a tactic-owned detector + observational handler that mutates tactic state via an `onObserve` callback.

Spells are represented as `SpellFactory` entries in a wizard's spellbook, each carrying `SpellMetadata` (range, kind, element, cooldown, tags, etc.). Tactics express spell choice as *code* inside `maybeCast`, composing filter predicates and comparators from [src/spells/selection.ts](src/spells/selection.ts) (e.g. DuelistCharge: `book.filter(byTag("melee")).filter(byReady(ctx)).find(inRange(dist))`). Tactics that don't care use a shared `tryDefaultCast` helper that fires the first ready in-range spell. Tactics framed around mobility-as-tool (e.g. AvoidIncoming) use `tryMobilityAway` with a tag filter, so any spell tagged `"blink"` / `"teleport"` / etc. is automatically considered. Four spells exist today: `Fireball`, `MeleeAttack`, `ProjectileSlowField`, `Blink`.

What's *not* yet present from the full spec:
- Action layer (discrete named actions with their own commitment windows)
- Personality vectors (each wizard's tactic-roster biases stand in for this for now)
- Any learning / habit formation / opponent modeling

### Planned evolution (toward full plan-based AI)

Discussed on 2026-04-19. The end goal is tactics as *plans* — multi-phase sequences that forward-simulate a fight and commit to a navigation/action sequence, with interrupts that can modify or cancel the plan. Tactics configure their own interrupt posture (e.g. "rush" suppresses dodge; "kite" permits it).

Staged path:

1. ~~**Directional sampling at the control layer.**~~ *Done 2026-04-19.* 16-direction sampling with intent-alignment + wall clearance scoring refines the raw intent each frame.
2. ~~**Event/handler pipeline (reactive layer).**~~ *Done 2026-04-19.* Detectors observe the world each tick, handlers decide reactions, a pipeline routes events to handlers with tier precedence and terminal semantics. Dodge migrated onto this pipeline.
3. ~~**Tactics author event interests + handlers.**~~ *Done 2026-04-19.* Tactics can declare optional `detectors`, `handlers`, `onObserve(key, value)`. Tactic handlers merge in front of common handlers (stable sort → tactic precedence within tier). Observational handlers emit observe Changes that the active tactic's `onObserve` folds into its state. Demo: BaitAndSwitch observes `OpponentCharging` and scores higher while an opponent is winding up a cast.
4. ~~**Always-on roster detectors.**~~ *Done 2026-04-19.* `TacticSelector.updateDormantObservations` runs non-active tactics' detectors each tick, routing events to their handlers; only observe-Changes are kept (action Changes from dormant tactics are dropped). BaitAndSwitch's score boosts when it's been observing an opponent charging, so it can *earn* activation on observation.
5. ~~**Spell metadata + selection.**~~ *Done 2026-04-19.* Spells carry metadata (range/kind/element/tags). Tactics pick spells inside `maybeCast` by composing filter/compare helpers in [src/spells/selection.ts](src/spells/selection.ts). Added `MeleeAttack` spell; DuelistCharge exclusively selects melee.
6. ~~**Tactic-authored interrupt posture.**~~ *Done 2026-04-19, generalized 2026-04-20.* Initially handled by binding a terminal `SuppressDodgeHandler` per tactic. Replaced 2026-04-20 by `Tactic.dodgePolicy(self, world): "always" | "never"` — the wizard checks the active tactic's policy when realizing a `forceMovementState: dashing` Change and blocks the dash if the policy says no. `SuppressDodgeHandler` and its file are gone. Conditional policies are now possible (e.g. AvoidIncoming returns `"never"` only when a mobility spell is ready).
7. ~~**Tactics as state machines (plans-shaped tactics).**~~ *Done 2026-04-19.* `Directives` and `liveDirectives()` are gone; each tactic is a state machine that emits per-frame `TacticOutput` from `update(...)` and uses a `CastController` to request casts. Multi-phase tactics expose a `currentPhaseId()` that the selector logs on transition.
8. ~~**Position reasoning.**~~ *Done 2026-04-20.* Tactics that care about positioning sample candidate positions (rings, arcs, single points), score them with a composable toolkit (`scoreByRangeMatch`, `scoreByAngularPreference`, `scoreByReachability`, `scoreByWallClearance`, `scoreByArenaCenter`, `scoreAwayFromProjectiles`), and pick the best. The wizard's old `sampleBestDirection` direction-pick is gone — wall avoidance is now a tactic concern. Resolves the center-drift issue from Navigation.
9. ~~**Interrupts as same-frame tactic switches.**~~ *Done 2026-04-19.* `interrupt: { reason }` Change type plus `selector.forceRescore(self, world, reason)` and `Tactic.shouldYield(self, world): string | null`. Reflexive non-terminal `InterruptOnProjectileHandler` lets the active tactic rescore as soon as a projectile arrives, on the same frame the dodge would fire.
10. **Enemy prediction model.** Tactics "envision" the opponent's response during scoring. Linear extrapolation to start.

### Tactics as first-class objects

Define a catalog of 6–12 named tactics. Each owns:
- Entry conditions (when it can be chosen)
- Continuation conditions (when it stays active)
- A small action pool (3–5 candidate actions)
- Its own action-selection utility function

Tactics should be recipes, not moods. "Close to melee and chain fire spells" — specific enough to be legibly succeeding or failing. Moods live in personality; tactics are what personality *chooses*.

### Spells and selection

Each spell exposes `SpellMetadata` — id, kind (`projectile | instant | zone | buff`), element, range {min, max} (surface-to-surface), chargeTime, cooldown, tags[]. A `SpellFactory` pairs metadata with a `create(caster, target, aim)` constructor.

**Selection is code, not configuration.** Tactics pick and request spells inside their `maybeCast(dt, self, world, castController)` method. [src/spells/selection.ts](src/spells/selection.ts) offers composable helpers — predicates like `byTag`, `byKind`, `inRange`, `byReady`, `byAnyTag`, and comparators like `preferLongestRange`, `preferShortestCooldown`. Tactics chain them however they want:

- Melee commit: `book.filter(byTag("melee")).filter(byReady(ctx)).find(inRange(dist))`
- Sniper (planned): `book.filter(byTag("ranged")).sort(preferLongestRange)[0]`

A tactic that doesn't find a suitable spell just returns without calling `requestCast` — the wizard waits. This is how DuelistCharge refuses to fire fireballs even while out of melee range.

The `CastController` enforces legality. A tactic can call `requestCast` freely; the controller rejects the call (and returns `false`) if the wizard is in an invalid state (sprinting, dashing, charging, dead) or the spell is on cooldown. Tactics that need to coordinate with their own casting phase (e.g. AntiMageZone's `lastCastAt` tracker) check the return value.

**Why a function instead of declarative fields.** We tried a fixed `SpellPreference` with preferred/required/avoid tag lists and scoring weights; it predicted a handful of filter types and hard-coded them. Tactics want arbitrary logic: "longest range, fastest projectile," "lowest cooldown," "element that counters the opponent's last N dodges." Function composition generalizes cleanly where configuration bundles don't.

**Distance is surface-to-surface** everywhere in the tactic layer (spell range, tactic context distances, helper signatures). The steering primitives still operate on center-to-center; the `orbit` / `closeTo` helpers convert at the boundary by adding both radii. Same number means the same thing regardless of contestant size.

### Events and handlers (reactive layer)

Reactive behaviors — dodge, brace, panic-retreat, "noticed enemy started charging" — flow through a three-step pipeline designed in an FRP shape: state + world → events → changes → folded into state.

**Layers:**

| Layer | Job | Examples |
|---|---|---|
| **Events** | Detect world conditions. Pure observers; emit a typed payload or nothing. | `ProjectileIncoming`, `OpponentCharging`, `LowHPCrossed` |
| **Handlers** | Decide reactions. Pure functions `(self, event, world) → Change[]`. | `LateralDodge`, `NoteOpponentCharging`, `InterruptOnLowHP`, `InterruptOnProjectile` |
| **Movement states** | Realize locked motions. | `dashing`, `recovering`, future `jumping` |

The critical separation: handlers don't *perform* the dash; they emit a `forceMovementState: dashing` **Change**, which the wizard's movement state machine acts on (subject to the active tactic's `dodgePolicy`). This keeps locked-motion behavior (the physical commitment of a dash or jump) decoupled from the *decision* to invoke it. Tank-brace vs. wizard-dodge can share the same `ProjectileIncoming` event but route to different handlers which emit different movement-state changes.

**Components power observation.** Detectors query components (e.g. `Charging`, `Dashing`, `Recovering`) on contestants via `contestant.getComponent(Key)` — no coupling to the concrete contestant class. `BasicWizard` installs/removes these in `setState`. New contestant types automatically surface to existing detectors as long as they populate the same components.

**Handler tiers** (priority, high to low): `reflexive` > `tactical` > `observational`. Handlers within a tier run in stable registration order. A **terminal** handler stops the chain for its event; an **informative** handler emits observation Changes and doesn't stop the chain — the same event can still reach lower-tier handlers.

**Precedence across layers:** when the pipeline runs, handlers are assembled tactic-first (active tactic's handlers), then common handlers. Stable sort by tier preserves this ordering within a tier. First terminal handler wins. Effect: a tactic can declare a no-op terminal handler to suppress a common one, or declare an informative handler to observe without blocking common terminal handlers down-chain.

**Tactic observation.** When the pipeline produces an observe Change, `BasicWizard` calls the active tactic's `onObserve(key, value)`. Tactics store it in their own internal state and read it each frame from `update(...)` or `score(...)` — since tactics are state machines, there's no separate "base vs. live" split to manage.

**Current extent:**
- `ProjectileIncoming → InterruptOnProjectile` (common reflexive non-terminal) — emits an `interrupt` Change ahead of the dodge. The active tactic gets a same-frame rescore opportunity (e.g. AvoidIncoming wins selection while there's still time to act).
- `ProjectileIncoming → LateralDodge` (common reflexive terminal) — picks a dash direction by scoring an arc of candidates, emits a `forceMovementState: dashing`. Realized only if the (possibly newly-selected) active tactic's `dodgePolicy` permits.
- `LowHPCrossed → InterruptOnLowHP` (common reflexive terminal) — fires once when HP drops below 40%, emitting an `interrupt`. Retreat usually wins the rescore.
- `OpponentCharging → NoteOpponentCharging` (BaitAndSwitch-specific observational) — BaitAndSwitch's score spikes while an enemy is winding up a cast, earning selection in opportunistic moments.

**Why not just handle everything in `BasicWizard.update`?** Because the reactive layer needs to be composable — contestants customize handlers, tactics override them, new events and handlers get added without touching existing logic. Inline imperative checks don't compose; an event-dispatch pipeline does.

### Navigation

Tactics own positioning. There is no implicit wall avoidance, center bias, or projectile evasion at the wizard level — tactics that want those behaviors compose them.

**The toolkit** ([src/tactics/helpers.ts](src/tactics/helpers.ts)):

- **Sampling.** `sampleRing(center, radius, count)`, `sampleRingAroundEnemy(self, enemy, surfaceRange, count)`, `singleCandidate(pos)`, `ringDirections`, `arcDirections` — produce candidate position sets or direction sets.
- **Scoring.** Each scorer is a `Candidate[] → Candidate[]` that adds to the score field, so they compose by chaining: `scoreByRangeMatch` (preferred surface distance), `scoreByAngularPreference` (orbit direction with weight that decays as the wizard moves away from preferred range), `scoreByReachability` (prefer nearby — kills antipodal flicker), `scoreByWallClearance` (cubic penalty), `scoreByArenaCenter` (mild center pull), `scoreAwayFromProjectiles` (perpendicular distance from projectile lines, clamped horizon).
- **Selection.** `pickBest(candidates)` returns the max-score candidate. `steerToward(self, dest)` converts to a unit-direction `Vec2` for `TacticOutput.moveIntent`, with a small dead-zone so the wizard doesn't oscillate when arrived.
- **Direction-only flavor for instants.** `pickSafeDirection(self, world, options)` takes a list of candidate directions + a distance and returns the best — used by `LateralDodgeHandler` to pick a dash direction (arc around perpendicular-away) and by `tryMobilityAway` to pick a blink direction (full ring).

**Why not vector summing.** Summing produces the classic "confused standstill" when opposing forces cancel. Score-and-pick-one keeps each frame's behavior committed to one position.

**Center drift — fixed.** With `scoreByArenaCenter` now part of orbit-family tactics, wizards no longer trace ever-larger orbits into walls. The center pull is small enough to lose to tactic goals in the open and big enough to win tiebreakers near walls.

**Future.** As we add obstacles, platforms, and destructible terrain, the scoring toolkit grows: obstacle clearance, cover score, platform reachability. Tactics opt in to whichever scorers fit their goals.

### Commitment and interrupts

Legibility requires commitment. Once chosen, a tactic has a minimum dwell time (1.5–3s) before reconsideration. Actions play to completion or to natural interrupt points.

**Interrupts flow through the Change pipeline.** A new `interrupt: { reason }` Change type lives alongside `forceMovementState`, `observe`, and `noop`. Handlers emit an `interrupt` Change; the wizard processes the Change stream and, on an interrupt, calls `selector.forceRescore(self, world, reason)` — which bypasses `evalTimer` and `dwellLeft`, rescores the roster immediately, and commits the winner with a fresh `minDwell` (even if the winner is the same tactic — prevents interrupt thrash). This same-frame path means an interrupt's effects are visible on the very next `tactic.update()` call, not one frame later.

Tactics can also self-yield via an optional `shouldYield(self, world): string | null`. After the pipeline and after `tactic.update()` would have run, the wizard calls `shouldYield` on the active tactic; a non-null reason triggers the same `forceRescore` path. This covers the "I'm done / blocked / my target died" case without needing a world-level detector.

**Currently implemented:**
- `LowHPCrossedDetector` (edge-triggered when HP drops below 40%) + `InterruptOnLowHPHandler` (reflexive terminal, emits `interrupt`). All wizards carry it. Visible effect: when a wizard takes the hit that drops them below 40% HP, they instantly rescore and Retreat (which scores heavily on low HP) usually wins.
- `InterruptOnProjectileHandler` (reflexive non-terminal) — emits an `interrupt` ahead of the dodge handler so AvoidIncoming can win the rescore and decide to blink instead of dash.
- `DuelistCharge.shouldYield` returns `"arrived"` when within ~55u surface (handing off to CloseQuarters) or `"no-enemy"` if the target died mid-commit.
- `AntiMageZone.shouldYield` returns `"rush-arrived"` during the rush phase when within ~55u surface so CloseQuarters takes over the post-cast melee.
- `CloseQuarters.shouldYield` returns `"out-of-range"` if the enemy slips beyond ~150u.
- `AvoidIncoming.shouldYield` returns `"no-threat"` once no projectile is incoming.

**Planned interrupts** (patterns all of these would use the same two paths):
- Opponent entered / left a critical range band (detector with hysteresis)
- High-value opportunity (opponent stunned, exposed)
- Current tactic became impossible (target teleported away) — today this shape is covered by `shouldYield("no-enemy")`

Everything else waits for scheduled re-evaluation.

### Personality vector

Applied at tactic-scoring stage (primary) and action-scoring stage (secondary). Never filtering, always scoring — lets traits express as tendency while allowing situational exceptions.

Design principles:
- **Single-direction axes, not paired opposites.** One signed `aggression` dial, not `caution` + `courage`.
- **Thresholds and triggers over continuous biases.** "Retreats below 40% HP" reads as a decision point; small weight nudges read as mush.
- **Multiplicative affinities for preferences.** `spell_utility *= affinity[spell]`, range ~[0.2, 3.0]. Survives situational scoring; additive biases get drowned out.
- **Tiebreakers for flavor.** "When actions score within 15%, prefer the flashier one" — gives signature moves without making play bad.
- **Small vector, each axis load-bearing.** If you can't describe what a trait looks like in one sentence, cut it.

Starting axes:
- `aggression` (-1 to +1): shifts preferred range and commit/retreat thresholds
- `patience` (0 to 1): minimum time between major decisions
- `grudge` (0 to 1): probability of retargeting when new threats appear
- `showmanship` (0 to 1): tiebreak bias toward visually bigger spells
- `spell_affinities`: multiplicative per-spell map
- `risk_tolerance` (0 to 1): HP retreat threshold, willingness to spend costly resources

Independent axes produce distinct archetypes: patient aggressor stalks, impatient aggressor rushes, patient defender turtles, impatient defender panics.

Log which axis drove each decision — useful for tuning and for the commentary layer later.

### Learning arc (legible, within-match, persistable across matches)

1. **Aim improvement** — *implemented*. Predictive lead (quadratic solve: projectile speed vs target velocity) with Gaussian angle noise via Box-Muller; σ decays exponentially from 0.2 rad toward 0.02 rad with decay constant 25 shots fired. Resolved at release time, not charge start, so the charge commits before the solution is computed. See `BasicWizard.computeAimDirection`.
2. **Opponent modeling.** Log opponent's reaction distribution per spell type. Bias spell selection toward spells the opponent handles worst. *Deferred.*
3. **Habit formation.** Nudge *tactic* scores on success/failure, small learning rate. Signature moves emerge within a match, reputations across matches. *Deferred — needs tactic layer first.*

### Prediction

Aiming uses **predictive** targeting (aim where target will be at projectile arrival), not reactive (aim at current position). Biggest single factor in whether the AI looks smart. Current implementation uses linear extrapolation from target velocity; fine for now. Falls back to aim-at-current-position when target is faster than projectile (no real solution to the lead quadratic).

### Where ML belongs

ML stays *out* of the decision layer — hand-authored utility is more legible and debuggable; RL agents find ugly degenerate strategies. ML earns its place in:
- Opponent trajectory prediction (small learned model feeding aim)
- Personality discovery via Quality-Diversity search (MAP-Elites to breed diverse interesting archetypes, not just strong ones)
- Motion quality (motion matching — only if we move beyond spheres)
- Commentary layer (LLM over event log)

### Hard don'ts

- No end-to-end RL for combat behavior
- No behavior trees initially
- No frame-by-frame decision making without commitment
- No paired-opposite personality axes
- No optimizing for win rate at the expense of readability

## Combat dynamics & spell design

Discussed 2026-05-03.

### The diagnosis

Mid-range fireball duels stalemate. Two wizards parked at ~300u each
spam fireballs while the other dodges; aim noise eventually grinds out
a kill but it can take many minutes of simulated time, and the action
during that window doesn't read as intentional. Root cause is the
ratio between dodge stamina recovery and fireball cooldown — they're
similar, so the equilibrium is "shoot, dodge, shoot, dodge" with no
mechanism for either side to break it. Compounding factor: all
offensive spells are projectile-shaped, so a single dodge mechanism
handles the entire offensive game.

A dodge-and-shoot exchange is fine as a *component* of a fight; the
problem is when it's the whole fight.

### Design principles for combat

- **Legibility first.** A viewer should be able to name what each
  wizard is doing and why. Random per-frame reactions are
  anti-pattern; visible commitment is the pattern.
- **"Intentional-looking" has a timing signature.** Slow telegraphed
  decisions read as plans; fast frequently-changing ones read as
  panic. Most "looks unintentional" issues are timing problems —
  decisions made too often, telegraphs too short, transitions too
  reactive.
- **Setup → payoff.** Good exchanges have visible buildup and a
  visible resolution. "Drop a slow field, lure enemy in, fireball
  through it" reads as choreography. Atomic spells back-to-back read
  as spam. AntiMageZone's `approach → cast → rush` hints at this
  shape; we want it pervasive.
- **The fantasy target is choreographed mage battles** (Frieren's are
  a good reference) emerging from a simulator that has no writer.
  Beats have to emerge from mechanics: visible buildup, visible
  commitment, visible resolution, and consistent personality.

### Spell diversity is next major priority

Adding more dodge-able projectiles doesn't fix the dodge/cooldown
equilibrium — the equilibrium just shifts. Adding spells with
*different dodge profiles* changes the equilibrium shape. Categories
worth adding (in rough order of likely impact on the staleness
problem):

- **Telegraphed AOEs.** 1–2s wind-up paints a region; the region
  becomes lethal for a brief window. Can't be dodged sideways — the
  defender has to *vacate the area*. Forces snipers off parked
  positions. Pre-cast magic circle is the natural visual telegraph.
- **Mobility-denial fields.** Slow / root / barrier zones that change
  what the opponent's options are. Setup tools for combos.
- **Push / pull.** Removes target's positional commitment.
- **Charged beam / piercing line.** Long telegraph, fixed direction,
  high reward against kited targets.

Each new *dodge profile* multiplies the strategic surface more than a
new spell of the same shape.

### Metamagic modifiers (planned first investment)

Hypothesis: most of the spell-variety value is unlocked by
*per-spell-class modifiers* on the existing spell shapes, before
designing entirely new spells. Same base spell, different
commitment-vs-payoff tradeoffs.

Examples on a projectile (fireball-class):
- **Heavy / channeled.** Long charge, big payoff (huge AOE / extra
  damage / persistent zone on impact). Caster rooted during charge —
  naturally telegraphs the commitment.
- **Flurry / split.** Short charge, multiple small projectiles in a
  spread, longer cooldown. Spammable harassment trade.
- **Curved / lobbed.** Indirect trajectory; harder to dodge by
  sidestepping; requires longer setup.
- **Accelerating.** Slow projectile that ramps up after launch; fakes
  out dodge timing.
- **Remote.** Magic circle attached to caster, projectile emerges from
  a distant circle. Telegraphs early, hits an unexpected angle.

Modifiers are **per-spell-class** (projectile, ground-targeting,
self-targeting, beam). A modifier is a property of the class, not of
fireball specifically — it composes with future projectile spells.

**Selection is up to the tactic.** Some tactics commit to one modifier
("Heavy Sniper" always casts heavy fireballs); others mix
situationally ("Trap & Kill" drops a slow field, then casts a heavy
projectile through it). The tactic owns the modifier choice because
the tactic owns the *plan*; the modifier is part of how the plan
executes. Naive random or score-based modifier selection will look
exactly as unintentional as the head-shake did — modifier choice
needs to be tactic-context-driven.

**Tells vary by modifier.** Heavy spells get long pre-cast magic
circles ("everyone in the arena can see this is happening"). Flurry
spells are near-instant. Remote spells get a circle on the caster +
circle at the target. The tell *is* the legibility — viewers should
know what's coming before it lands. Tells also create counterplay
opportunity (interrupt the channel, escape the AOE).

**MVP plan.** Pick one modifier (heavy/channeled fireball) and ship
it end-to-end before generalizing the abstraction. Add a sibling
factory; wire one tactic to prefer it; verify in the harness whether
matches with at least one heavy-fireball wizard show fewer mid-range
stalemates. The right shape for the modifier abstraction will fall
out of the duplication once we have the second factory in hand. The
existing `charging` movement state and pre-cast spell hookup (used by
fireball today) covers most of the visible-commitment piece for free.

### Narrative arcs without a writer

Producing choreographed-feeling sequences from emergent simulation
needs:

- **Multi-phase tactics where each phase reads as a beat.** AntiMageZone
  is the prototype; we want this shape to be the norm, not the
  exception.
- **Variable pacing.** Periods of buildup and reset, not constant
  action. Hard to hit if every frame must contain a decision; easier
  if the system explicitly has "preparing" and "executing" beats.
- **Personality consistency.** The same wizard makes the same kind of
  call repeatedly. Reckless wizards always commit early; patient ones
  always wait for setup; clever ones always feint. The Personality
  vector axes (already designed) bias tactic and modifier choice to
  produce this. Wire personality through after metamagic lands —
  they compose multiplicatively.

### Deferred mechanics

- **Endurance / long-term resource.** Tempting as a stalemate-breaker,
  but only worth adding if its main effect is *forcing commitment*
  (low-endurance wizards must gamble on big moves), not slowing
  baseline output. The "fight slower as you tire" version produces
  slogs — worse than the staleness it solves. Revisit after spell
  diversity lands; if mid-range duels still drag, endurance should
  trigger desperate-tactic preferences below a threshold, not reduce
  damage output uniformly.
- **Momentum / weight system.** Improves engagement quality
  (over-committed dashes are punishable, fast-moving fighters can't
  pivot) but doesn't directly address mid-range stalemates. Defer
  until the spell mix is settled; adding momentum first risks tuning
  every new spell around momentum constraints we may not want.
- **Mana pool.** Skipped. The cases mana usually justifies (spend
  reserves for a big move) are better served by long cooldowns and
  charge times we already have. Adds bookkeeping without proportionate
  drama.

## TODO

### Done

Movement & physics:
- Kinematic body + ground physics (accel, friction, turn rate)
- Movement states (idle, walking, running, sprinting, dashing, charging, recovering) with per-state stats. Dash is the neutral mechanism; "dodge" is one reactive use of it.
- Stamina (short-term) resource — vigor was removed after degenerate-dodge-loop failure mode
- Facing vector on `Contestant`; attention-driven facing on `BasicWizard`; strafe tax on speed
- Committed lateral dashes with closest-approach threat filter (for the dodge case), stamina-scaled duration, post-dash recovery
- Sprint commits movement direction; facing can glance off-axis within a 75° cone
- Charged fireball casts (pre-cast window where the spell follows the caster, released on state exit)
- Predictive aiming with decaying Gaussian noise (quadratic lead solve, σ decays with shots fired)

AI layer (two-tier slice):
- Steering primitives library in [src/steering.ts](src/steering.ts): seek / flee / arrive / pursue / evade / circle / wallRepulsion / sampleBestDirection (now used only via tactic helpers)
- Tactic interface (`update → TacticOutput`, `maybeCast`, `currentPhaseId`, `shouldYield`, `dodgePolicy`) + `CastController` + `PaceHint` + `DodgePolicy` + `STATIONARY` in [src/tactics/tactic.ts](src/tactics/tactic.ts)
- Thirteen tactics in [src/tactics/native.ts](src/tactics/native.ts) — orbit-family (Pressure, Kite, Orbit, Ambush, Retreat, Sniper, Turtle, BaitAndSwitch, Scrapper), DuelistCharge (single-purpose approach), CloseQuarters (close-range fighting), AntiMageZone (3-phase: approach/cast/rush), AvoidIncoming (tag-driven mobility-or-dodge avoidance).
- `TacticSelector` with utility scoring, random jitter, commitment dwell, phase-transition logging, `forceRescore` for interrupts
- Each of the four wizards gets a personality-biased roster; Blue carries Blink + AvoidIncoming
- Movement pace driven entirely by tactic-emitted `PaceHint`; old distance-based "switch to walking at 180u" heuristic removed
- `CastController` enforces cast legality (state / cooldown / alive) — tactics request casts freely, controller rejects invalid ones
- Position planning toolkit in [src/tactics/helpers.ts](src/tactics/helpers.ts): candidate sampling (`sampleRing*`, `ringDirections`, `arcDirections`), composable scorers (`scoreByRangeMatch`, `scoreByAngularPreference`, `scoreByReachability`, `scoreByWallClearance`, `scoreByArenaCenter`, `scoreAwayFromProjectiles`), pickers (`pickBest`, `pickSafeDirection`, `steerToward`). Tactics opt in to whichever scorers fit. The wizard no longer applies its own wall-avoidance — it's all tactic-composed.
- Tactic-authored `dodgePolicy(self, world): "always" | "never"` gates the realization of `forceMovementState: dashing` Changes. Replaced the old `SuppressDodgeHandler` workaround.

Reactive layer (event/handler pipeline):
- Events + handlers + Changes + tiered pipeline in [src/events/](src/events/) and [src/handlers/](src/handlers/). Handlers receive `(self, event, world)` so they can score against world state.
- `ProjectileIncoming` detector + `LateralDodge` handler — picks dash direction by scoring an arc of candidates with `pickSafeDirection` (away from projectile lines, away from enemies, away from walls). Realization gated by the active tactic's `dodgePolicy`.
- `InterruptOnProjectileHandler` — common reflexive non-terminal companion that emits an `interrupt` so the active tactic gets a same-frame rescore opportunity (e.g. AvoidIncoming wins selection ahead of the dash).
- Movement states kept distinct from handlers; handlers emit `forceMovementState` Changes, wizard's state machine realizes them
- Component system in [src/components.ts](src/components.ts): typed component keys + `getComponent/addComponent/removeComponent` on `Contestant`. `BasicWizard` installs `Charging`, `Dashing`, `Recovering` components on state entry/exit.
- Tactic-specific detectors, handlers, `onObserve(key, value)` — tactics can declare their own event interests, bind their own handlers, and consume observations directly into their state-machine state.
- `OpponentCharging` detector (queries `Charging` component) + `NoteOpponentChargingHandler` (observational, non-terminal) — BaitAndSwitch scores higher while an enemy is winding up a cast, earning selection.
- Always-on roster detectors: non-active tactic detectors run each tick; only observe-Changes are kept. Tactics can build observations while dormant and earn selection based on them.
- Interrupts as a first-class Change: `interrupt: { reason }` joins `forceMovementState` / `observe` / `noop` in the pipeline. Handlers emit it; the wizard calls `selector.forceRescore(...)` and bypasses `minDwell` to switch same-frame. Tactics can also self-yield via `shouldYield(self, world): string | null`. Visible examples: `LowHPCrossedDetector` + `InterruptOnLowHPHandler` force Retreat when a wizard crosses below 40% HP; `InterruptOnProjectileHandler` lets AvoidIncoming take over before a dash fires.

Spells and selection:
- `SpellMetadata` + `SpellFactory` on spells; every spell carries range / kind / element / chargeTime / cooldown / tags (+ optional `baseSpeed` for projectiles).
- Selection library in [src/spells/selection.ts](src/spells/selection.ts): predicates + comparators + defaultSelector.
- Tactics pick spells inside `maybeCast(...)` by composing filters + comparators from [src/spells/selection.ts](src/spells/selection.ts), and request casts via `CastController`. No config bundle.
- `MeleeAttack` self-spell with cone-arc visual, lunge animation, cone hit detection.
- `ProjectileSlowField` zone spell (translucent blue dome) — first cross-spell interaction. Slows projectiles (25%) while inside, restores on exit. Iterate-and-scale for now; component-based refactor planned.
- CloseQuarters tactic owns close-range fighting (melee on cooldown via `byTag("melee")`); DuelistCharge and AntiMageZone yield to it via `shouldYield("arrived" | "rush-arrived")` once in range. Approach tactics no longer manage strike phases themselves.
- AntiMageZone steps through `approach` → `cast` → `rush` phases: casts the zone when in range and ready, sprints onto the enemy in the rush window, then yields to CloseQuarters.
- DuelistCharge is single-purpose: sprint toward enemy with sampling-based approach-angle scoring; yield on arrival.
- Tactic-authored `dodgePolicy(self, world)` gates the dodge dash realization. Replaced the old `SuppressDodgeHandler` workaround. AvoidIncoming uses a conditional policy ("never" if a mobility spell is ready, "always" otherwise).
- Blink spell + AvoidIncoming tactic: tag-driven mobility-or-dodge avoidance. Blue blinks away from threats when Blink is ready, falls back to dash via the common pipeline when not.
- Distances in the tactic layer / spell range / tactic helpers are surface-to-surface (for future size variation).

Visual polish:
- Status bars (HP + stamina) billboarded above each wizard
- Speed trails during sprint / dodge
- Fireball visual polish: four-layer orange gradient, trail, impact explosion, `THREE.Points` particle burst (POC confirming the Points pipeline works end-to-end)

### Next

Tactics are state-machine plans with position reasoning (stages 7–9 done). Open work, roughly in priority order:

1. **Metamagic MVP.** Heavy/channeled fireball as a sibling projectile factory; wire one tactic to prefer it; harness-verify whether it breaks mid-range stalemates. Generalize to a `Modifier<Kind>` abstraction once we have ≥2 modifiers in hand. See the *Combat dynamics & spell design* section.
2. **Telegraphed AOE spell.** First non-projectile-shaped offensive spell — a different dodge profile than fireball. Magic-circle wind-up, area becomes lethal for a brief window. Forces parked snipers to relocate.
3. **More events + handlers.** `OpportunityStrike` (enemy whiffed a cast or stuck in slow-field), `TargetLost`, range-band detectors with hysteresis, `EnteredMeleeRange` if a third tactic ever wants the handoff. More reactive hooks for tactics to plan around.
4. **More tactics that use mobility tags.** RepositionAggressive / RepositionDefensive — tactic-driven blink, not just reactive blink. Each picks "I want to be there" and uses any tagged mobility spell to get there.
5. **Enemy prediction model** feeding tactic scoring and aim.
6. **Per-tactic action selection** (actions as named discrete moves with their own commitment — fills in the missing action layer of the three-tier hierarchy).
7. **Personality vector** wired into tactic and action scoring (currently stand-in: per-wizard roster biases). Composes with metamagic — per-wizard modifier preferences as personality expression.
8. **Component-based spell interactions.** Refactor zone effects (slowing field, future auras) to install components on affected spells rather than iterate-and-modify. Enables stacking, spell-controlled responses.
9. **Projectile kinematics for physical projectiles** (distinct from magical spells; levitated terrain etc.).
10. **Predicted self-position helper** — generalize the one-off dodge-filter version into a reusable AI helper.
11. **Reaction-time delay** on AI stimulus response *(likely requires an event queue — defer the design)*.
12. **Per-contestant persistence** (habit weights on tactics, opponent models, aim skill).
13. **Opponent reaction modeling.**
14. **Jumps** + airborne state + air control (when the vertical axis starts to matter).
15. **Investigate LOS + facing perception.** Tie awareness to the facing cone so facing management has weight (e.g. blink-backwards becomes a real choice). Flagged for legibility risk — viewers may see less of why the AI does what it does.
16. *(Later)* MAP-Elites for personality generation.
17. *(Later)* Learned trajectory predictor.
18. *(Optional)* LLM commentary over event log.

