import { deepFreeze } from "./deepFreeze";
import { Vector3 } from "../math";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { BurstPalette } from "./visualSpec";

const BLINK_DISTANCE = 180;
const LIFETIME = 0.18;

const BLINK_PALETTE: BurstPalette = {
  inner: "rgba(210,200,255,1)",
  mid: "rgba(150,120,255,0.9)",
  outer: "rgba(80,60,220,0.35)",
  edge: "rgba(30,20,120,0)",
};

export const BLINK_METADATA: SpellMetadata = {
  id: "blink",
  kind: "instant",
  element: "neutral",
  range: { min: 0, max: 0 },
  chargeTime: 0.08,
  cooldown: 5.0,
  tags: ["blink", "mobility", "self"],
};

export class Blink implements Spell {
  readonly position: Vector3;
  readonly velocity = new Vector3();
  readonly caster: Contestant;
  readonly metadata = structuredClone(BLINK_METADATA);
  dead = false;
  frozen = false;
  age = 0;
  private readonly direction: Vector3;
  private teleported = false;

  constructor(caster: Contestant, aim: Vector3) {
    this.caster = caster;
    this.position = caster.position.clone();
    const len = Math.hypot(aim.x, aim.z);
    if (len > 1e-3) {
      this.direction = new Vector3(aim.x / len, 0, aim.z / len);
    } else {
      this.direction = new Vector3(
        caster.facing.x,
        0,
        caster.facing.z
      );
    }
  }

  update(_dt: number, world: World): void {
    if (this.frozen) return;
    if (!this.teleported) {
      this.teleported = true;
      const origin = this.caster.position.clone();
      const halfW = world.bounds.width / 2 - this.caster.radius;
      const halfD = world.bounds.depth / 2 - this.caster.radius;
      const targetX = Math.max(
        -halfW,
        Math.min(halfW, origin.x + this.direction.x * BLINK_DISTANCE)
      );
      const targetZ = Math.max(
        -halfD,
        Math.min(halfD, origin.z + this.direction.z * BLINK_DISTANCE)
      );
      this.caster.position.x = targetX;
      this.caster.position.z = targetZ;
      this.caster.velocity.x = 0;
      this.caster.velocity.z = 0;
      const dest = new Vector3(targetX, origin.y, targetZ);
      world.emit("blink", this.caster.id, {
        spell: this.metadata.id,
        from: { x: origin.x, y: origin.y, z: origin.z },
        to: { x: dest.x, y: dest.y, z: dest.z },
        palette: BLINK_PALETTE,
      });
      this.position.copy(dest);
    }
    this.age += _dt;
    if (this.age >= LIFETIME) this.dead = true;
  }
}

export const BlinkFactory: SpellFactory = {
  metadata: BLINK_METADATA,
  create(caster, _target, aim) {
    return new Blink(caster, aim);
  },
};

deepFreeze(BLINK_PALETTE);
deepFreeze(BLINK_METADATA);
deepFreeze(BlinkFactory);
