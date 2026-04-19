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
- **[src/steering.ts](src/steering.ts)** — pure-function steering primitives (`seek`, `flee`, `arrive`, `pursue`, `evade`, `circle`, `wallRepulsion`) returning `Vec2` desired-velocities, plus `sampleBestDirection` which scores 16 directions around an intent and picks the best accounting for wall clearance.
- **[src/tactics/](src/tactics/)** — AI tactic layer. `tactic.ts` defines the `Tactic` interface, `Directives` shape, `TacticContext`, `RosterEntry`. `common.ts` holds six shared tactics (Pressure, Kite, Orbit, Ambush, Retreat, BaitAndSwitch). `signature.ts` holds four wizard-signature tactics (DuelistCharge, Sniper, Turtle, Scrapper). `selector.ts` scores a roster each second with random jitter and commits to the winner for its minimum dwell.
- **[src/events/](src/events/)** — event detection layer. `event.ts` defines `GameEvent<P>` and `EventDetector<P>`. `projectileIncoming.ts` is the first detector: replaces the old inline dodge-trigger scan with a standalone module, emits a typed payload (threatening spell + distance + closest-approach).
- **[src/handlers/](src/handlers/)** — reactive handler layer. `change.ts` declares the `Change` discriminated union (`forceMovementState`, `observe`, `noop`) and the `HandlerTier` enum (`reflexive` > `tactical` > `observational`). `handler.ts` defines the `Handler<P>` interface (event id binding + tier + terminal flag). `lateralDodge.ts` is a reflexive terminal handler that emits a `forceMovementState: dodging` with a perpendicular-to-projectile direction. `pipeline.ts` runs detectors, dispatches events to handlers in tier order, stops a chain at the first terminal handler.
- **[src/contestants/contestant.ts](src/contestants/contestant.ts)** — `Contestant` interface (mesh, position, velocity, facing, radius, hp, alive, update).
- **[src/contestants/basicWizard.ts](src/contestants/basicWizard.ts)** — first concrete contestant. Holds a kinematic body, a state machine (see below), stamina, a `TacticSelector` driving live directives, facing with strafe tax, committed lateral dodges (triggered via the event/handler pipeline), charged-fireball casts with predictive aiming, status display, speed trail. Engage intent comes from `circle(...)` shaped by current directives and refined by `sampleBestDirection` for wall avoidance.
- **[src/spells/spell.ts](src/spells/spell.ts)** — `Spell` interface (mesh, position, velocity, caster, dead, update).
- **[src/spells/fireball.ts](src/spells/fireball.ts)** — four-layer fiery projectile with sphere-node trail. Supports `frozen` mode during caster's charge window; `setPosition` for caster-relative positioning during charge; `setVelocityFromDirection` on release. Spawns an `Explosion` and a `ParticleBurst` on impact.
- **[src/spells/explosion.ts](src/spells/explosion.ts)** — short-lived expanding-sphere visual effect. Pure cosmetic; no damage.
- **[src/spells/particleBurst.ts](src/spells/particleBurst.ts)** — `THREE.Points`-based particle system (single draw call). Soft circular texture built once via canvas, shared across bursts.
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
- **dodging** — short burst (0.08–0.22s scaled by stamina), fixed direction, very high acceleration; initiated by incoming projectile. See "Dodges" below.
- **charging** — locked to caster, reduced mobility while a spell winds up
- **recovering** — near-motionless; entered after sprint exhaustion or dodge landing. Essential tail on committed actions.

Grounded / airborne split deferred until jumps land.

### Facing, attention, and the strafe tax

Facing is a *contestant* concern, not a physics concern — a wizard can be strafing sideways while looking at an enemy. Every `Contestant` has a `facing` unit vector independent of velocity.

- `BasicWizard.facing` rotates toward an intent-vector-of-attention: charge target (if charging) > nearest enemy > current move direction.
- Move speed is scaled by the dot product of facing and movement direction: 100% forward, ~60% sideways, ~40% backward. Strafing has a legible cost.
- **Commitment exception:** during sprint and dodge, facing aligns to move direction and the strafe tax is bypassed. These are full-commit actions; "look where you're going" reads right.
- Visible facing indicator: a small dark cone protruding from each wizard's sphere.

### Dodges

Committed lateral bursts, not sprints. Triggered when an enemy projectile is inside sense radius AND roughly heading at the wizard AND its predicted closest-approach (current velocities, linear extrapolation) falls inside `radius + safety_margin`. Dodge direction is perpendicular to projectile velocity, on whichever side the wizard is already on.

Costs stamina proportional to duration used; has a cooldown + minimum stamina to start. Ends in `recovering` (brief motionless tail) so dodges are real commits, not free reactions.

### Endurance: stamina only (for now)

Single short-term resource: **stamina** (0–3.0) drains on sprint and dodge; regens when not. Empty stamina while sprinting → forced `recovering`. Resets at match start.

We originally had a second long-term "vigor" axis that slowly drained and scaled `maxSpeed` down over a match. It produced the degenerate failure mode of all fights collapsing into dodge-duels once vigor got low (sprint speed dropped with vigor, dodge impulse didn't → dodges became relatively better). Removed; can reintroduce later if a multi-match or tournament mechanic needs it.

Visualization: two stacked bars above each wizard. HP on top (green → red), stamina below (orange).

### Engagement-range oscillation (temporary hack, pre-tactic layer)

To prevent the "locked duel" failure mode where wizards just trade attacks at fixed distance: each wizard has a `preferredRange` that reshuffles every 3.5–8s. Movement intent blends toward-enemy (radial) and around-enemy (tangential) based on distance-vs-preferred. Each wizard also has a fixed `circleSign` so they orbit consistently.

**This is a bandaid.** The real fix is the tactic layer choosing "kite," "pressure," "reposition" etc. deliberately. Remove or subsume this when tactics land.

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

We have a simplified two-tier slice of the above: **tactic layer → control layer**, no distinct action layer yet. Tactics emit `Directives` (preferred range, range band, charge eagerness, dodge eagerness, circle direction, ambush mode) that the existing `BasicWizard` behaviors consume as live parameters.

Six common tactics + four wizard-signature tactics (ten total) are implemented in [src/tactics/](src/tactics/). A `TacticSelector` scores the active wizard's roster every second, applies random jitter, and commits to the winner for its minimum dwell.

Reactive behaviors (starting with dodge) now flow through a separate **event/handler pipeline** (see "Events and handlers" below). Detectors observe the world, handlers decide reactions, Changes feed back to the wizard. This is the scaffolding for tactic-specific handlers and more reactive behaviors; currently only dodge uses it.

What's *not* yet present from the full spec:
- Action layer (discrete named actions with their own commitment windows)
- Plan-style multi-phase tactics (the current ones are "parameter bundles," not sequences)
- Tactic-specific event interests + handler overrides (infrastructure exists; not yet wired to any tactic)
- Personality vectors (each wizard's tactic-roster biases stand in for this for now)
- Any learning / habit formation / opponent modeling

### Planned evolution (toward full plan-based AI)

Discussed on 2026-04-19. The end goal is tactics as *plans* — multi-phase sequences that forward-simulate a fight and commit to a navigation/action sequence, with interrupts that can modify or cancel the plan. Tactics configure their own interrupt posture (e.g. "rush" suppresses dodge; "kite" permits it).

Staged path:

1. ~~**Directional sampling at the control layer.**~~ *Done 2026-04-19.* 16-direction sampling with intent-alignment + wall clearance scoring refines the raw intent each frame.
2. ~~**Event/handler pipeline (reactive layer).**~~ *Done 2026-04-19.* Detectors observe the world each tick, handlers decide reactions, a pipeline routes events to handlers with tier precedence and terminal semantics. Dodge migrated onto this pipeline — behaviorally identical, but dodge-trigger logic now lives in a reusable reflexive-tier terminal handler rather than inline in `BasicWizard`.
3. **Tactics author event interests + handlers.** Tactics declare which events they care about (`OpponentCharging`, `LowHPCrossed`, etc.) and can bind their own handlers. Handler precedence: tactic-specific → contestant-specific → common. Informative handlers (observation-writing) can coexist with terminal handlers (movement overrides) by running first in the chain.
4. **Plans replace tactics.** Multi-phase sequences with advance/abort conditions. Plan selection replaces tactic selection. Plans can evaluate candidate *destinations* (not just preferred ranges) — longer-horizon position reasoning. Current sampling continues to be the reactive frame-by-frame realizer.
5. **Enemy prediction model.** Tactics/plans "envision" the opponent's response during scoring. Linear extrapolation to start.

### Tactics as first-class objects

Define a catalog of 6–12 named tactics. Each owns:
- Entry conditions (when it can be chosen)
- Continuation conditions (when it stays active)
- A small action pool (3–5 candidate actions)
- Its own action-selection utility function

Tactics should be recipes, not moods. "Close to melee and chain fire spells" — specific enough to be legibly succeeding or failing. Moods live in personality; tactics are what personality *chooses*.

### Events and handlers (reactive layer)

Reactive behaviors — dodge, brace, panic-retreat, "noticed enemy started charging" — flow through a three-step pipeline designed in an FRP shape: state + world → events → changes → folded into state.

**Layers:**

| Layer | Job | Examples |
|---|---|---|
| **Events** | Detect world conditions. Pure observers; emit a typed payload or nothing. | `ProjectileIncoming` |
| **Handlers** | Decide reactions. Pure functions `(self, event) → Change[]`. | `LateralDodge` |
| **Movement states** | Realize locked motions. Unchanged by this refactor. | `dodging`, `recovering`, future `jumping` |

The critical separation: handlers don't *perform* the dodge; they emit a `forceMovementState: dodging` **Change**, which the wizard's movement state machine acts on. This keeps locked-motion behavior (the physical commitment of a dodge or jump) decoupled from the *decision* to do it. Tank-brace vs. wizard-dodge can share the same `ProjectileIncoming` event but route to different handlers which emit different movement-state changes.

**Handler tiers** (priority, high to low): `reflexive` > `tactical` > `observational`. Handlers within a tier run in registration order. A **terminal** handler stops the chain for its event (only higher-tier terminal handlers can preempt it). An **informative** handler (e.g. "note that opponent started charging") emits observation Changes and doesn't stop the chain — the same event can still reach lower-tier handlers.

**Precedence across layers** (planned for stage 3): when an event fires, handlers are collected from the current tactic → contestant defaults → common set, in that order. The first terminal handler wins for that event. This lets a "rush" tactic bind a no-op terminal handler to `ProjectileIncoming` to suppress dodge entirely, while a "turtle" tactic could bind an *amplified* dodge.

**Current extent:** only `ProjectileIncoming → LateralDodge` is wired. No tactic-specific interests yet. The pipeline infrastructure supports all the above, but only the common-handler case is exercised.

**Why not just handle everything in `BasicWizard.update`?** Because the reactive layer needs to be composable — contestants customize handlers, tactics override them, new events and handlers get added without touching existing logic. Inline imperative checks don't compose; an event-dispatch pipeline does.

### Navigation

Tactics emit a raw intent (direction), but the wizard shouldn't blindly move along that intent — walls, other obstacles, and later terrain need to inform frame-by-frame movement.

**Current:** each frame, `sampleBestDirection` evaluates 16 directions around the wizard's raw intent. Each is scored by `intentWeight * alignment(dir, intent) − wallWeight * cubedCloseness(dir)`, where closeness is `1 - distanceToWall / wallHorizon` clamped to [0,1]. The cubic curve makes the penalty spike near walls and fade quickly at distance. The best-scoring direction becomes the body's actual intent. One behavior per frame — no summing.

**Why not vector summing.** Summing produces the classic "confused standstill" when opposing forces cancel. We picked priority-layering: one behavior wins, committing visibly to that choice.

**Known limitation — center drift.** Wizards still tend to end up at the arena edges. Root cause is structural: tactics see "range to enemy" but not "position in arena." Two wizards maintaining a fixed range trace an orbital arc whose center tends to drift; sampling pushes off walls locally but doesn't bias toward the center. Lowering tactic preferred ranges so none *requires* a wall position helped but didn't fix it. The real fix is **position reasoning at the tactic layer** — plans that score candidate destinations against multiple constraints (range, wall clearance, cover, etc.) rather than emitting a scalar preferred range. This is stage 4 of the roadmap above; further sampling-layer tweaks (e.g. adding a center-bias term) would be bandaid work we'd just rip out later.

**Future.** As we add obstacles, platforms, and destructible terrain, sampling's scoring gets more factors: obstacle clearance, cover score, platform reachability. Tactics supply weights so different playstyles can lean toward/away from each factor.

### Commitment and interrupts

Legibility requires commitment. Once chosen, a tactic has a minimum dwell time (1.5–3s) before reconsideration. Actions play to completion or to natural interrupt points.

Interrupts that can break commitment early:
- HP crossed a retreat threshold
- Incoming projectile within the dodge window
- Opponent entered / left a critical range band
- High-value opportunity (opponent stunned, exposed)
- Current tactic became impossible (target teleported away)

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

## TODO

### Done

Movement & physics:
- Kinematic body + ground physics (accel, friction, turn rate)
- Movement states (idle, walking, running, sprinting, dodging, charging, recovering) with per-state stats
- Stamina (short-term) resource — vigor was removed after degenerate-dodge-loop failure mode
- Facing vector on `Contestant`; attention-driven facing on `BasicWizard`; strafe tax on speed
- Committed lateral dodges with closest-approach threat filter, stamina-scaled duration, post-dodge recovery
- Sprint commits movement direction; facing can glance off-axis within a 75° cone
- Charged fireball casts (pre-cast window where the spell follows the caster, released on state exit)
- Predictive aiming with decaying Gaussian noise (quadratic lead solve, σ decays with shots fired)

AI layer (two-tier slice):
- Steering primitives library in [src/steering.ts](src/steering.ts): seek / flee / arrive / pursue / evade / circle / wallRepulsion
- Tactic interface + `Directives` + `TacticContext` in [src/tactics/tactic.ts](src/tactics/tactic.ts)
- Six common tactics + four wizard-signature tactics
- `TacticSelector` with utility scoring, random jitter, commitment dwell
- Each of the four wizards gets a personality-biased roster
- `BasicWizard` consumes live directives from the current tactic; old hardcoded range-oscillation / sprint-range constants removed
- Directional sampling (16 directions, intent alignment + cubic wall-clearance scoring) refines the raw engage intent each frame

Reactive layer (event/handler pipeline):
- Events + handlers + Changes + tiered pipeline in [src/events/](src/events/) and [src/handlers/](src/handlers/)
- `ProjectileIncoming` detector + `LateralDodge` handler — dodge behavior-preserving refactored out of `BasicWizard` onto the pipeline
- Movement states kept distinct from handlers; handlers emit `forceMovementState` Changes, wizard's state machine realizes them

Visual polish:
- Status bars (HP + stamina) billboarded above each wizard
- Speed trails during sprint / dodge
- Fireball visual polish: four-layer orange gradient, trail, impact explosion, `THREE.Points` particle burst (POC confirming the Points pipeline works end-to-end)

### Next

Work toward the plan-based AI described in "Planned evolution" above. The known center-drift problem is structural (see Navigation) and will be resolved by plans with position reasoning, not by further tuning of the current system.

1. **More events + handlers.** `OpponentCharging`, `LowHPCrossed`, `OpportunityStrike`, etc. All reuse the existing pipeline.
2. **Tactics author event interests + handlers.** Tactics declare which events they care about; bind tactic-specific handlers (informative or terminal). Handler precedence: tactic → contestant → common.
3. **Plans replace tactics.** Multi-phase sequences with advance/abort conditions and position-based scoring.
4. **Enemy prediction model** feeding plan selection.
5. **Per-tactic action selection** (actions as named discrete moves with their own commitment — fills in the missing action layer of the three-tier hierarchy).
6. **Personality vector** wired into plan and action scoring (currently stand-in: per-wizard roster biases).
7. **Projectile kinematics for physical projectiles** (distinct from magical spells; levitated terrain etc.).
8. **Predicted self-position helper** — generalize the one-off dodge-filter version into a reusable AI helper.
9. **Reaction-time delay** on AI stimulus response *(likely requires an event queue — defer the design)*.
10. **Per-contestant persistence** (habit weights on plans, opponent models, aim skill).
11. **Opponent reaction modeling.**
12. **Jumps** + airborne state + air control (when the vertical axis starts to matter).
13. *(Later)* MAP-Elites for personality generation.
14. *(Later)* Learned trajectory predictor.
15. *(Optional)* LLM commentary over event log.

