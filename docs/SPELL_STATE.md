# Spell simulation and presentation contract

All active spells are math/state objects. No spell constructs Three.js renderer objects, accesses a scene, allocates particles, uses a global clock/telemetry destination, or calls `Math.random`. Gameplay jitter comes from `caster.world.random()`. Vector3 comes from the standalone math entry. A spell belongs to its constructor-injected caster's world.

A renderer observes the world after simulation updates. It must never advance spell timers, unfreeze spells, change positions/velocities, or consume gameplay random numbers. Each renderer owns its meshes, materials, particle state, and visual random source. Style descriptions in specs are serializable data, and may be interpreted or replaced by a presentation variant. They create no rendering dependency. All shared default factories, metadata, specs, modifiers and palettes are deeply frozen. Projectile instances and metadata clone their configuration; factories retain a private frozen cloned template. Experiment variants should create new declarative definitions rather than mutate shared defaults.

## Persistent state

- All spells: `position`, `velocity`, `caster`, `metadata`, `dead`, `frozen`.
- Projectile: `spec` (radius, speed, lifetime, damage, AOE geometry/falloff, emission/homing and optional telegraph/style data), `age` since release, `chargeAge` while frozen, `detonateAt` target point/distance, `launchOrigin`, `emitterActive`, `emitterBaseDir`, `emitterFired`. An emitter is a stationary source; its children are independent projectiles without emission/telegraph. Charge progress is clamped `chargeAge / spec.chargeTime`; burst progress is `emitterFired / spec.emission.count`. Frozen aim is `position - caster.position`; live emission aim is `emitterBaseDir`. Ground-target impact markers use `detonateAt`, not caster position. `setDetonationPoint` derives travel distance from the projectile position; flight follows and clamps to that endpoint exactly even when the tick would overshoot. These projectiles ignore incidental contestant overlap during flight and apply their area damage at the designated endpoint. AOE radius is the authoritative impact area; a growing charge decoration must not imply that only its current inner area is threatened.
- IceShard: `spec`, fixed `impactPos`, `state` (`channeling`, `descending`, `impacted`), `chargeAge`, `descentAge`, `position` at the falling shard. Ground threat remains centered at `impactPos` with `spec.aoe.radius`. Portal height and descent speed are authoritative. The simulation entity dies on impact; presentation owns any residual ring, fragments and fade.
- ProjectileSlowField: `position`, `radius`, `height`, `age`, `duration`. Area is an ellipsoid dome: `y >= 0` and `(dx² + dz²)/radius² + y²/height² <= 1`. Frozen fields are inactive. Each active field contributes an independent 0.25 velocity multiplier; leaving/expiry releases that field's contribution.
- MeleeAttack: `position` follows caster; `aim`, `age`, `reach`, `coneHalfAngle`, `swingDuration`, `recoveryDuration`, `hitWindowStart`, `hitWindowEnd`, `lungeDistance`. Reach is measured beyond both contestant radii, within the aim cone. Lunge is a presentation offset only; it never changes collision position.
- Blink: `position` becomes destination, `age`; teleport is immediate on first unfrozen update and clamps against this world's bounds.

## Semantic events

All events pass through `world.emit(type, who, meta)` and receive per-world timestamp/sequence. Existing `damage`, `death`, `projectile_emit`, `aoe_impact`, and `iceShard_cast` remain observational.

- `spell_impact`: `{ spell, position: { x, y, z }, radius, visual }`. Projectile `visual` is `ProjectileVisualSpec`; ice shard uses its spec's visual data. Presentation can choose explosion, particles, fragments and color from this data; radius describes authoritative AOE or non-AOE visual burst size.
- `blink`: `{ spell, from: { x,y,z }, to: { x,y,z }, palette }`.
- `field_enter` / `field_exit`: `{ spell, projectile, scale? , reason? }`; expiration emits exits with `reason: "expired"` and then `field_expire`.

World event history is bounded to two seconds. Rendering a still at an identified tick can reconstruct short bursts analytically from event age and a visual seed derived from event sequence, without stepping particles on render frames. Longer temporal effects or arbitrary replay need simulation from scenario/seed up to the requested tick (or a future complete checkpoint plus event history). Trail history is presentation-owned; a capture implementation must replay/warm up the required history rather than infer a curved/homing trail from one velocity sample.

## Intentional baseline changes and limits

Gameplay seeds change because effects no longer consume gameplay random numbers. Instant spread/swarm emissions now release all children in one simulation update (the former zero-interval loop released one per tick). Slow fields match their visible dome height and overlapping fields restore independently. Melee retains authoritative cone damage; its previous mesh-only lunge is now a presentation concern. Ice shard/explosion/burst visual fade no longer keeps inert spells in the authoritative spell list.

This is a focused state/event boundary, not event sourcing or a generic effect engine. Hit detection remains discrete per simulation tick; configured simulation step is part of experiment identity. AOE still permits self damage. Spell/modifier/selector composition remains available.
