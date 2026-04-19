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
- **[src/statusDisplay.ts](src/statusDisplay.ts)** — HP / vigor / stamina bars billboarded to the camera, rendered above each contestant.
- **[src/materials.ts](src/materials.ts)** — shared toon gradient map; inverted-hull outline helper.
- **[src/contestants/contestant.ts](src/contestants/contestant.ts)** — `Contestant` interface (mesh, position, velocity, facing, radius, hp, alive, update).
- **[src/contestants/basicWizard.ts](src/contestants/basicWizard.ts)** — first concrete contestant. Holds a kinematic body, a state machine (see below), stamina + vigor, engagement-range oscillation, facing with strafe tax, committed lateral dodges, charged-fireball casts, status display, speed trail.
- **[src/spells/spell.ts](src/spells/spell.ts)** — `Spell` interface (mesh, position, velocity, caster, dead, update).
- **[src/spells/fireball.ts](src/spells/fireball.ts)** — straight-line projectile, damage on collision; supports `frozen` mode during its caster's charge window, released with `setVelocityFromDirection` on cast completion.
- **[src/config.ts](src/config.ts)** — arena and camera constants.

## Rendering notes

- **Toon shading** via `MeshToonMaterial` with a 16-step smoothstep gradient map for a soft, cartoony falloff (not hard cel-shaded bands).
- **Inverted-hull outlines** on contestants: duplicated sphere at 1.05×, `BackSide`, dark material.
- **Shadows:** single `SpotLight` above-front-right of arena center casts shadows on the floor *and walls*. Uses `BasicShadowMap` — `PCFSoftShadowMap` and `PCFShadowMap` are broken/deprecated in Three.js r184 and don't render at all. Higher shadow map resolution (2048) compensates for the resulting aliasing.
- **Flat arena surfaces:** floor + walls are `MeshStandardMaterial` with high `emissive` so they read as uniform color despite being lit. The non-emissive `color` component is what makes shadows visible. Walls tilt slightly more emissive than the floor (80%/20% vs 65%/35%) because their light-facing angle is glancier — without the bias they'd read darker than the floor.
- **Prism edges:** `LineSegments` with `polygonOffset` on walls/floor so edges sit in a depth-buffer gap — no z-fighting, still correctly occluded by contestants crossing in front.
- **Speed trails:** short fading-color `THREE.Line` behind each wizard during sprint and dodge, sampled at 30 ms intervals.
- **Status bars:** plane meshes above each wizard, quaternion-copied from the camera each frame for billboarding; `depthTest: false` + `renderOrder: 10` so bars render over everything.
- **Charging visual:** while a wizard is in the `charging` state, its fireball exists as a spell instance with `frozen = true`, positioned each frame in front of the caster along the aim direction. On release, the fireball receives a fresh velocity toward the target's current position.

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

### Endurance: stamina + vigor

Two-tier system, both visualized as bars above each contestant:

- **Stamina** (short-term, 0–3.0): drains on sprint and dodge; regens when not. Empty → forced `recovering`. Resets on match end.
- **Vigor** (long-term, 0–1.0): drains slowly per match (~1% per second); scales `maxSpeed` down to ~55% as it approaches zero. Wizards tire as matches go on.

Visualization: vigor fills the left portion of the lower bar (70% of bar width max), stamina is tacked onto the right end of the current vigor fill (30% of bar width max). Both sit in a shared background envelope.

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

### Tactics as first-class objects

Define a catalog of 6–12 named tactics. Each owns:
- Entry conditions (when it can be chosen)
- Continuation conditions (when it stays active)
- A small action pool (3–5 candidate actions)
- Its own action-selection utility function

Tactics should be recipes, not moods. "Close to melee and chain fire spells" — specific enough to be legibly succeeding or failing. Moods live in personality; tactics are what personality *chooses*.

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

1. **Aim improvement.** Predictive aiming (lead target based on velocity) with Gaussian noise on angle. Decay σ with shots fired. Early shots miss wide, later shots hit.
2. **Opponent modeling.** Log opponent's reaction distribution per spell type. Bias spell selection toward spells the opponent handles worst.
3. **Habit formation.** Nudge *tactic* scores on success/failure, small learning rate. Signature moves emerge within a match, reputations across matches.

### Prediction

Aiming uses **predictive** targeting (aim where target will be at projectile arrival), not reactive (aim at current position). Biggest single factor in whether the AI looks smart. Start with linear extrapolation from velocity; upgrade later if needed.

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

- Kinematic body + ground physics (accel, friction, turn rate)
- Movement states (idle, walking, running, sprinting, dodging, charging, recovering) with per-state stats
- Stamina (short-term) + vigor (long-term) resources
- Facing vector on `Contestant`; attention-driven facing on `BasicWizard`; strafe tax on speed
- Committed lateral dodges with closest-approach threat filter, stamina-scaled duration, post-dodge recovery
- Charged fireball casts (pre-cast window where the spell follows the caster, released on state exit)
- Status bars (HP, vigor + stamina) billboarded above each wizard
- Speed trails during sprint / dodge
- Engagement-range oscillation (temporary hack to break duel lock; replaced by tactic layer eventually)

### Next

Predictive aiming is the single biggest legibility lever and should land before tactics — fights look much smarter when wizards lead targets. After that, the tactic layer is the next big leap; once it lands, a lot of the current ad-hoc behavior (range oscillation, sprint triggers, charge gating) collapses into proper tactic choices.

1. **Predictive aiming with decaying noise.** Linear extrapolation of target velocity + projectile speed to compute lead position. Add Gaussian angular noise; decay σ with shots-fired count to produce the in-match learning arc.
2. **Tactic catalog** (6–12 named tactics, entry/continuation conditions, action pools).
3. **Tactic-level utility scoring** with commitment timers and interrupt list. Subsumes engagement-range hack.
4. **Per-tactic action selection.**
5. **Steering behaviors at the control layer** (seek/flee/separate/pursue as reusable primitives rather than bespoke logic inside `BasicWizard`).
6. **Personality vector** wired into tactic and action scoring.
7. **Projectile kinematics for physical projectiles** (distinct from magical spells; levitated terrain etc.).
8. **Predicted self-position helper** (forward-sim given current velocity + action). Generalize the one-off dodge-filter version into a reusable AI helper.
9. **Commitment-cost term** usable by action-selection utility.
10. **Reaction-time delay** on AI stimulus response *(likely requires an event queue — defer the design)*.
11. **Per-contestant persistence** (habit weights on tactics, opponent models, aim skill).
12. **Opponent reaction modeling.**
13. **Jumps** + airborne state + air control (when the vertical axis starts to matter).
14. *(Later)* MAP-Elites for personality generation.
15. *(Later)* Learned trajectory predictor.
16. *(Optional)* LLM commentary over event log.

