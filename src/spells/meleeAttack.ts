import { deepFreeze } from "./deepFreeze";
import { Vector3 } from "../math";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const SWING_DURATION = 0.18;
const RECOVERY_DURATION = 0.22;
const HIT_WINDOW_START = 0.04;
const HIT_WINDOW_END = 0.14;
const CONE_HALF_ANGLE = Math.PI / 3;
const REACH = 54;
const DAMAGE = 22;
const LUNGE_DISTANCE = 18;

export const MELEE_METADATA: SpellMetadata = {
  id: "melee",
  kind: "instant",
  element: "physical",
  range: { min: 0, max: REACH },
  chargeTime: 0.18,
  cooldown: 0.6,
  tags: ["melee", "close", "physical"],
};

export class MeleeAttack implements Spell {
  readonly position: Vector3;
  readonly velocity = new Vector3();
  readonly caster: Contestant;
  readonly metadata = structuredClone(MELEE_METADATA);
  readonly reach = REACH;
  readonly coneHalfAngle = CONE_HALF_ANGLE;
  readonly swingDuration = SWING_DURATION;
  readonly recoveryDuration = RECOVERY_DURATION;
  readonly lungeDistance = LUNGE_DISTANCE;
  readonly hitWindowStart = HIT_WINDOW_START;
  readonly hitWindowEnd = HIT_WINDOW_END;
  dead = false;
  frozen = false;
  age = 0;
  private hasHit = false;
  readonly aim = new Vector3();

  constructor(caster: Contestant, aim: Vector3) {
    this.caster = caster;
    this.position = caster.position.clone();
    const aimLen = Math.hypot(aim.x, aim.z);
    if (aimLen > 1e-3) {
      this.aim.set(aim.x / aimLen, 0, aim.z / aimLen);
    } else {
      this.aim.set(caster.facing.x, 0, caster.facing.z);
    }
  }

  update(dt: number, world: World): void {
    if (this.frozen) return;
    this.age += dt;

    this.position.copy(this.caster.position);
    if (this.age < SWING_DURATION) {
      if (
        !this.hasHit &&
        this.age >= HIT_WINDOW_START &&
        this.age <= HIT_WINDOW_END
      ) {
        this.applyHit(world);
      }
    } else {
      if (this.age >= SWING_DURATION + RECOVERY_DURATION) {
        this.dead = true;
      }
    }
  }

  private applyHit(world: World): void {
    const originX = this.caster.position.x;
    const originZ = this.caster.position.z;
    for (const c of world.contestants) {
      if (c === this.caster || !c.alive) continue;
      const dx = c.position.x - originX;
      const dz = c.position.z - originZ;
      const dist = Math.hypot(dx, dz);
      const surfaceDist = dist - this.caster.radius - c.radius;
      if (surfaceDist > REACH) continue;
      const cos = (dx * this.aim.x + dz * this.aim.z) / Math.max(dist, 1e-3);
      if (cos < Math.cos(CONE_HALF_ANGLE)) continue;
      c.hp -= DAMAGE;
      world.emit("damage", this.caster.id, {
        victim: c.id,
        amount: DAMAGE,
        spell: MELEE_METADATA.id,
        hpAfter: c.hp,
      });
      if (c.hp <= 0) {
        c.alive = false;
        world.emit("death", c.id, { killer: this.caster.id, spell: MELEE_METADATA.id });
      }
      this.hasHit = true;
    }
  }
}

export const MeleeFactory: SpellFactory = {
  metadata: MELEE_METADATA,
  create(caster, target, aim) {
    let dir = aim;
    if (target) {
      const dx = target.position.x - caster.position.x;
      const dz = target.position.z - caster.position.z;
      dir = new Vector3(dx, 0, dz);
    }
    return new MeleeAttack(caster, dir);
  },
};

deepFreeze(MELEE_METADATA);
deepFreeze(MeleeFactory);
