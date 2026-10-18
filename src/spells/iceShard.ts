import { deepFreeze } from "./deepFreeze";
import { Vector3 } from "../math";
import type {
  Spell,
  SpellFactory,
  SpellMetadata,
  SpellRange,
} from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

interface IceShardAOE {
  radius: number;
  damageAtCenter: number;
  falloff: "linear" | "quadratic";
}

export interface IceShardSpec {
  id: string;
  range: SpellRange;
  chargeTime: number;
  cooldown: number;
  tags: string[];
  aoe: IceShardAOE;
  portalHeight: number;
  descentSpeed: number;
  visual: {
    shardColor: number;
    shardEdgeColor: number;
    portalColor: number;
    telegraphColor: number;
    impactCoreColor: number;
    impactHaloColor: number;
  };
}

export const ICE_SHARD_SPEC: IceShardSpec = {
  id: "iceShard",
  range: { min: 60, max: 350 },
  chargeTime: 1.0,
  cooldown: 4.0,
  tags: ["aoe", "ranged", "ice", "ground-targeted"],
  aoe: {
    radius: 90,
    damageAtCenter: 25,
    falloff: "linear",
  },
  portalHeight: 200,
  descentSpeed: 360,
  visual: {
    shardColor: 0xb8e4ff,
    shardEdgeColor: 0xeaffff,
    portalColor: 0x88ccff,
    telegraphColor: 0x99ddff,
    impactCoreColor: 0xc0e0ff,
    impactHaloColor: 0x4080c0,
  },
};

const ICE_SHARD_METADATA: SpellMetadata = {
  id: ICE_SHARD_SPEC.id,
  kind: "zone",
  element: "water",
  range: ICE_SHARD_SPEC.range,
  chargeTime: ICE_SHARD_SPEC.chargeTime,
  cooldown: ICE_SHARD_SPEC.cooldown,
  tags: ICE_SHARD_SPEC.tags,
  castMode: "channel",
};

export const IceShardFactory: SpellFactory = {
  metadata: ICE_SHARD_METADATA,
  create(caster, target, aim) {
    const impact = computeImpactPos(caster, target, aim);
    return new IceShard(caster, impact, ICE_SHARD_SPEC);
  },
};

function computeImpactPos(
  caster: Contestant,
  target: Contestant | null,
  aim: Vector3
): Vector3 {
  if (target) {
    return new Vector3(target.position.x, 0, target.position.z);
  }
  const len = Math.hypot(aim.x, aim.z);
  if (len < 1e-3) {
    return new Vector3(caster.position.x, 0, caster.position.z);
  }
  const dist = 200;
  return new Vector3(
    caster.position.x + (aim.x / len) * dist,
    0,
    caster.position.z + (aim.z / len) * dist
  );
}

type IceShardState = "channeling" | "descending" | "impacted";

export class IceShard implements Spell {
  readonly position: Vector3;
  readonly velocity = new Vector3();
  readonly caster: Contestant;
  readonly metadata = structuredClone(ICE_SHARD_METADATA);
  readonly spec: IceShardSpec;
  frozen = false;
  dead = false;

  readonly impactPos: Vector3;
  state: IceShardState = "channeling";
  chargeAge = 0;
  descentAge = 0;
  fadeAge = 0;

  constructor(
    caster: Contestant,
    impactPos: Vector3,
    spec: IceShardSpec
  ) {
    this.caster = caster;
    this.spec = structuredClone(spec);
    this.impactPos = impactPos.clone();
    this.position = this.impactPos.clone();
    this.position.y = spec.portalHeight;

    caster.world.emit("iceShard_cast", caster.id, {
      impactX: this.impactPos.x,
      impactZ: this.impactPos.z,
      chargeTime: spec.chargeTime,
    });
  }

  update(dt: number, world: World): void {
    if (this.frozen) {
      this.chargeAge += dt;
      return;
    }
    if (this.state === "channeling") this.state = "descending";
    if (this.state === "descending") {
      this.descentAge += dt;
      this.position.y = Math.max(0, this.spec.portalHeight - this.spec.descentSpeed * this.descentAge);
      if (this.position.y <= 0) this.impact(world);
    }
  }

  private impact(world: World): void {
    this.state = "impacted";
    const aoe = this.spec.aoe;
    let hits = 0;
    for (const c of world.contestants) {
      if (!c.alive) continue;
      const dx = c.position.x - this.impactPos.x;
      const dz = c.position.z - this.impactPos.z;
      const surfaceDist = Math.max(0, Math.hypot(dx, dz) - c.radius);
      if (surfaceDist > aoe.radius) continue;
      const tt = surfaceDist / aoe.radius;
      const factor =
        aoe.falloff === "quadratic" ? (1 - tt) * (1 - tt) : 1 - tt;
      const dmg = aoe.damageAtCenter * factor;
      if (dmg <= 0) continue;
      c.hp -= dmg;
      hits++;
      world.emit("damage", this.caster.id, {
        victim: c.id,
        position: { x: c.position.x, y: c.position.y, z: c.position.z },
        amount: dmg,
        spell: this.spec.id,
        hpAfter: c.hp,
        aoe: true,
        surfaceDist,
      });
      if (c.hp <= 0) {
        c.alive = false;
        world.emit("death", c.id, {
          killer: this.caster.id,
          spell: this.spec.id,
        });
      }
    }
    world.emit("aoe_impact", this.caster.id, {
      spell: this.spec.id,
      radius: aoe.radius,
      hits,
    });

    world.emit("spell_impact", this.caster.id, {
      spell: this.spec.id,
      position: { x: this.impactPos.x, y: 8, z: this.impactPos.z },
      radius: aoe.radius,
      visual: this.spec.visual,
    });
    this.dead = true;
  }
}

deepFreeze(ICE_SHARD_SPEC);
deepFreeze(ICE_SHARD_METADATA);
deepFreeze(IceShardFactory);
