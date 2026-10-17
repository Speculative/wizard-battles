import { deepFreeze } from "./deepFreeze";
import { Vector3 } from "../math";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import { Projectile } from "./projectile";

const FIELD_RADIUS = 130;
const FIELD_HEIGHT = 110;
const DURATION = 4.0;
const SLOW_SCALE = 0.25;

export const PROJECTILE_SLOW_FIELD_METADATA: SpellMetadata = {
  id: "projectileSlowField",
  kind: "zone",
  element: "water",
  range: { min: 0, max: 180 },
  chargeTime: 0.4,
  cooldown: 6.0,
  tags: ["zone", "slow", "antiprojectile", "defensive"],
};

export class ProjectileSlowField implements Spell {
  readonly position: Vector3;
  readonly velocity = new Vector3();
  readonly caster: Contestant;
  readonly metadata = structuredClone(PROJECTILE_SLOW_FIELD_METADATA);
  frozen = false;
  dead = false;
  age = 0;
  readonly radius = FIELD_RADIUS;
  readonly height = FIELD_HEIGHT;
  readonly duration = DURATION;
  private readonly slowed = new Set<Projectile>();

  constructor(caster: Contestant, origin: Vector3) {
    this.caster = caster;
    this.position = origin.clone();
    this.position.y = 0;

  }

  update(dt: number, world: World): void {
    if (this.frozen) return;
    this.age += dt;
    if (this.age >= DURATION) {
      this.restoreAll(world);
      world.emit("field_expire", this.caster.id, { spell: this.metadata.id });
      this.dead = true;
      return;
    }

    const currentInside = new Set<Projectile>();
    for (const s of world.spells) {
      if (!(s instanceof Projectile) || s.dead || s.frozen || s.emitterActive) continue;
      const dx = s.position.x - this.position.x;
      const dz = s.position.z - this.position.z;
      if (s.position.y >= 0 &&
          (dx * dx + dz * dz) / (FIELD_RADIUS * FIELD_RADIUS) +
          (s.position.y * s.position.y) / (FIELD_HEIGHT * FIELD_HEIGHT) <= 1) {
        currentInside.add(s);
      }
    }

    for (const s of currentInside) {
      if (!this.slowed.has(s)) {
        this.slowed.add(s);
        s.setSpeedScale(this, SLOW_SCALE);
        world.emit("field_enter", this.caster.id, { spell: this.metadata.id, projectile: s.metadata.id, scale: SLOW_SCALE });
      }
    }
    for (const s of this.slowed) {
      if (!currentInside.has(s)) {
        s.setSpeedScale(this, 1);
        world.emit("field_exit", this.caster.id, { spell: this.metadata.id, projectile: s.metadata.id });
        this.slowed.delete(s);
      }
    }
  }

  private restoreAll(world: World): void {
    for (const s of this.slowed) {
      s.setSpeedScale(this, 1);
      world.emit("field_exit", this.caster.id, { spell: this.metadata.id, projectile: s.metadata.id, reason: "expired" });
    }
    this.slowed.clear();
  }
}

export const ProjectileSlowFieldFactory: SpellFactory = {
  metadata: PROJECTILE_SLOW_FIELD_METADATA,
  create(caster) {
    return new ProjectileSlowField(caster, caster.position);
  },
};

deepFreeze(PROJECTILE_SLOW_FIELD_METADATA);
deepFreeze(ProjectileSlowFieldFactory);
