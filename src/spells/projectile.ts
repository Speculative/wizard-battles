import { deepFreeze } from "./deepFreeze";
import { Vector3 } from "../math";
import type {
  Spell,
  SpellElement,
  SpellFactory,
  SpellMetadata,
  SpellModifier,
  SpellRange,
} from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { BurstPalette } from "./visualSpec";

export type ProjectileShape =
  | {
      kind: "fire-spheres";
      layers: Array<{ scale: number; color: number; opacity: number }>;
    }
  | {
      kind: "ice-shard";
      bodyColor: number;
      edgeColor: number;
      lengthScale?: number;
      widthScale?: number;
    };

export interface ProjectileImpactSpec {
  palette?: BurstPalette;
  explosionCoreColor?: number;
  explosionHaloColor?: number;
}

export interface ProjectileVisualSpec {
  shape: ProjectileShape;
  trailColor: number;
  trailScale?: number;
  trailOpacity?: number;
  impact?: ProjectileImpactSpec;
}

export type ProjectileTelegraphSpec =
  | {
      kind: "ground-circle";
      color: number;
      maxRadius: number;
    }
  | {
      kind: "ground-fan";
      color: number;
      length: number;
      arcRadians: number;
    }
  | {
      kind: "orbiting-orbs";
      color: number;
      count: number;
      orbitRadius: number;
      orbSize: number;
    }
  | {
      kind: "stacked-orbs";
      color: number;
      count: number;
      orbSize: number;
      baseY?: number;
      spacing?: number;
    };

export interface ProjectileAOESpec {
  radius: number;
  damageAtCenter: number;
  falloff: "linear" | "quadratic" | "constant";
}

export type ProjectileAimMode = "intercept" | "groundTarget";

export interface ProjectileEmission {
  count: number;
  spreadAngle: number;
  interval: number;
  followCaster?: boolean;
  perChildAimJitter?: number;
}

export interface ProjectileHoming {
  turnRate: number;
  range: number;
}

export interface ProjectileSpec {
  id: string;
  element: SpellElement;
  speed: number;
  radius: number;
  damage: number;
  lifetime: number;
  range: SpellRange;
  chargeTime: number;
  cooldown: number;
  tags: string[];
  aoe?: ProjectileAOESpec;
  telegraph?: ProjectileTelegraphSpec;
  visual: ProjectileVisualSpec;
  aimMode?: ProjectileAimMode;
  aimNoiseScale?: number;
  emission?: ProjectileEmission;
  homing?: ProjectileHoming;
}

export interface ProjectileModifier extends SpellModifier {
  apply(spec: ProjectileSpec): ProjectileSpec;
}

export function isProjectileModifier(m: SpellModifier): m is ProjectileModifier {
  return typeof (m as ProjectileModifier).apply === "function";
}

export interface ProjectileFactory extends SpellFactory {
  readonly spec: ProjectileSpec;
}

export function isProjectileFactory(f: SpellFactory): f is ProjectileFactory {
  return f.metadata.kind === "projectile" &&
    (f as ProjectileFactory).spec !== undefined;
}

export function specToMetadata(spec: ProjectileSpec): SpellMetadata {
  return {
    id: spec.id,
    kind: "projectile",
    element: spec.element,
    range: { ...spec.range },
    chargeTime: spec.chargeTime,
    cooldown: spec.cooldown,
    tags: [...spec.tags],
    baseSpeed: spec.speed,
  };
}

export function makeProjectileFactory(spec: ProjectileSpec): ProjectileFactory {
  const template = deepFreeze(structuredClone(spec));
  return deepFreeze<ProjectileFactory>({
    spec: structuredClone(template),
    metadata: specToMetadata(template),
    create(caster, _target, aim, modifier?: SpellModifier) {
      const effectiveSpec =
        modifier && isProjectileModifier(modifier)
          ? modifier.apply(structuredClone(template))
          : structuredClone(template);
      const dir = new Vector3(aim.x, 0, aim.z);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const origin = caster.position
        .clone()
        .add(dir.clone().multiplyScalar(caster.radius + 4));
      return new Projectile(caster, dir, origin, effectiveSpec);
    },
  });
}

export class Projectile implements Spell {
  readonly position: Vector3;
  readonly caster: Contestant;
  readonly velocity: Vector3;
  readonly metadata: SpellMetadata;
  readonly spec: ProjectileSpec;
  frozen = false;
  age = 0;
  chargeAge = 0;
  dead = false;
  private exploded = false;
  detonateAt: { x: number; z: number; dist: number } | null = null;
  readonly launchOrigin = new Vector3();
  readonly emitterBaseDir = new Vector3(1, 0, 0);
  emitterFired = 0;
  private emitterTimer = 0;
  emitterActive = false;
  private readonly speedScales = new Map<object, number>();

  constructor(
    caster: Contestant,
    direction: Vector3,
    origin: Vector3,
    spec: ProjectileSpec
  ) {
    this.caster = caster;
    this.spec = structuredClone(spec);
    this.metadata = specToMetadata(spec);
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(spec.speed);

    this.launchOrigin.copy(origin);
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  setVelocityFromDirection(direction: Vector3): void {
    const len = Math.hypot(direction.x, direction.y, direction.z);
    if (len < 1e-6) return;
    const inv = 1 / len;
    const dx = direction.x * inv;
    const dy = direction.y * inv;
    const dz = direction.z * inv;
    if (this.spec.emission) {
      // Emitter mode: store base aim, fire children from update().
      this.emitterBaseDir.set(dx, 0, dz);
      this.emitterActive = true;
      this.emitterTimer = 0;
      this.emitterFired = 0;
      this.velocity.set(0, 0, 0);
    } else {
      const s = this.spec.speed;
      this.velocity.set(dx * s, dy * s, dz * s);
    }
    this.launchOrigin.copy(this.position);
  }

  /** Independent field contributions compose and restore without overwriting each other. */
  setSpeedScale(source: object, scale: number): void {
    const previous = this.speedScales.get(source) ?? 1;
    this.velocity.multiplyScalar(scale / previous);
    if (scale === 1) this.speedScales.delete(source);
    else this.speedScales.set(source, scale);
  }

  setDetonationPoint(x: number, z: number, _legacyDist?: number): void {
    this.detonateAt = { x, z, dist: Math.hypot(x - this.position.x, z - this.position.z) };
    this.launchOrigin.copy(this.position);
  }

  update(dt: number, world: World): void {
    if (this.frozen) {
      this.chargeAge += dt;
      return;
    }

    if (this.emitterActive) {
      this.updateEmitter(dt, world);
      return;
    }

    this.age += dt;
    if (this.age >= this.spec.lifetime) {
      this.dead = true;
      return;
    }

    if (this.spec.homing) {
      this.applyHoming(dt, world);
    }

    if (this.detonateAt) {
      const dx = this.detonateAt.x - this.position.x;
      const dz = this.detonateAt.z - this.position.z;
      const remaining = Math.hypot(dx, dz);
      const step = Math.hypot(this.velocity.x, this.velocity.z) * dt;
      if (remaining <= step) {
        this.position.x = this.detonateAt.x;
        this.position.z = this.detonateAt.z;
        this.explode(world, null);
        return;
      }
      this.velocity.x = dx / remaining * step / dt;
      this.velocity.z = dz / remaining * step / dt;
    }
    this.position.addScaledVector(this.velocity, dt);
    const b = world.bounds;
    if (
      Math.abs(this.position.x) > b.width / 2 ||
      Math.abs(this.position.z) > b.depth / 2 ||
      this.position.y < 0 ||
      this.position.y > b.height
    ) {
      this.explode(world, null);
      return;
    }

    for (const c of world.contestants) {
      if (this.detonateAt || c === this.caster || !c.alive) continue;
      if (
        c.position.distanceTo(this.position) <
        c.radius + this.spec.radius
      ) {
        this.explode(world, c);
        return;
      }
    }

  }

  private updateEmitter(dt: number, world: World): void {
    const plan = this.spec.emission;
    if (!plan) {
      this.dead = true;
      return;
    }

    if (plan.followCaster) {
      // Track caster position so successive shots emerge from current pos.
      this.position.set(
        this.caster.position.x,
        this.caster.position.y,
        this.caster.position.z
      );
      // Re-aim each tick at the caster's current nearest enemy. Without
      // this, a gatling burst sticks with the original aim while the
      // target moves out of the line — most shots miss late in the burst.
      let bestDist = Infinity;
      let target: Contestant | null = null;
      for (const c of world.contestants) {
        if (c === this.caster || !c.alive) continue;
        const dx = c.position.x - this.caster.position.x;
        const dz = c.position.z - this.caster.position.z;
        const d = Math.hypot(dx, dz);
        if (d < bestDist) {
          bestDist = d;
          target = c;
        }
      }
      if (target) {
        const dx = target.position.x - this.caster.position.x;
        const dz = target.position.z - this.caster.position.z;
        const len = Math.hypot(dx, dz);
        if (len > 1e-3) {
          this.emitterBaseDir.set(dx / len, 0, dz / len);
        }
      }
    }

    this.emitterTimer -= dt;
    while (this.emitterFired < plan.count && this.emitterTimer <= 0) {
      this.fireOneChild(world, plan);
      this.emitterFired++;
      this.emitterTimer += plan.interval;
    }

    if (this.emitterFired >= plan.count) {
      this.dead = true;
    }
  }

  private fireOneChild(world: World, plan: ProjectileEmission): void {
    const childSpec: ProjectileSpec = { ...this.spec };
    delete childSpec.emission;
    delete childSpec.telegraph;

    const baseAngle = Math.atan2(
      this.emitterBaseDir.z,
      this.emitterBaseDir.x
    );
    const halfSpread = plan.spreadAngle / 2;
    const t =
      plan.count <= 1
        ? 0
        : (this.emitterFired / (plan.count - 1)) * 2 - 1;
    let angle = baseAngle + t * halfSpread;
    if (plan.perChildAimJitter) {
      angle += (world.random() * 2 - 1) * plan.perChildAimJitter;
    }
    const dir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const origin = new Vector3(
      this.position.x + dir.x * (this.caster.radius + 4),
      this.caster.position.y,
      this.position.z + dir.z * (this.caster.radius + 4)
    );
    const child = new Projectile(this.caster, dir, origin, childSpec);
    child.setVelocityFromDirection(dir);
    world.addSpell(child);
    world.emit("projectile_emit", this.caster.id, {
      spell: this.spec.id,
      position: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: dir.x, z: dir.z },
      childIndex: this.emitterFired,
      childOf: childSpec.id,
    });
  }

  private applyHoming(dt: number, world: World): void {
    const homing = this.spec.homing;
    if (!homing) return;
    let target: Contestant | null = null;
    let bestDist = homing.range;
    for (const c of world.contestants) {
      if (c === this.caster || !c.alive) continue;
      const d = Math.hypot(
        c.position.x - this.position.x,
        c.position.z - this.position.z
      );
      if (d < bestDist) {
        bestDist = d;
        target = c;
      }
    }
    if (!target) return;
    const desiredX = target.position.x - this.position.x;
    const desiredZ = target.position.z - this.position.z;
    const desiredLen = Math.hypot(desiredX, desiredZ);
    if (desiredLen < 1e-3) return;
    const dxn = desiredX / desiredLen;
    const dzn = desiredZ / desiredLen;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed < 1e-3) return;
    const vxn = this.velocity.x / speed;
    const vzn = this.velocity.z / speed;
    const dot = Math.max(-1, Math.min(1, vxn * dxn + vzn * dzn));
    const angleBetween = Math.acos(dot);
    const maxRot = homing.turnRate * dt;
    let newX: number;
    let newZ: number;
    if (angleBetween <= maxRot) {
      newX = dxn;
      newZ = dzn;
    } else {
      const cross = vxn * dzn - vzn * dxn;
      const sign = cross >= 0 ? 1 : -1;
      const rot = maxRot * sign;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      newX = vxn * c - vzn * s;
      newZ = vxn * s + vzn * c;
    }
    this.velocity.x = newX * speed;
    this.velocity.z = newZ * speed;
  }

  private explode(world: World, hitTarget: Contestant | null): void {
    if (this.exploded) {
      this.dead = true;
      return;
    }
    this.exploded = true;

    if (this.spec.aoe) {
      this.applyAOE(world);
    } else if (hitTarget) {
      this.applyDirectHit(hitTarget, world);
    }

    world.emit("spell_impact", this.caster.id, {
      spell: this.spec.id,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      radius: this.spec.aoe?.radius ?? this.spec.radius * 3.8,
      visual: this.spec.visual,
    });
    this.dead = true;
  }

  private applyDirectHit(target: Contestant, world: World): void {
    target.hp -= this.spec.damage;
    world.emit("damage", this.caster.id, {
      victim: target.id,
      position: { x: target.position.x, y: target.position.y, z: target.position.z },
      amount: this.spec.damage,
      spell: this.spec.id,
      hpAfter: target.hp,
    });
    if (target.hp <= 0) {
      target.alive = false;
      world.emit("death", target.id, {
        killer: this.caster.id,
        spell: this.spec.id,
      });
    }
  }

  private applyAOE(world: World): void {
    const aoe = this.spec.aoe;
    if (!aoe) return;
    let hits = 0;
    for (const c of world.contestants) {
      if (!c.alive) continue;
      const dx = c.position.x - this.position.x;
      const dz = c.position.z - this.position.z;
      const surfaceDist = Math.max(0, Math.hypot(dx, dz) - c.radius);
      if (surfaceDist > aoe.radius) continue;
      const t = surfaceDist / aoe.radius;
      let factor: number;
      switch (aoe.falloff) {
        case "constant":
          factor = 1;
          break;
        case "quadratic":
          factor = (1 - t) * (1 - t);
          break;
        case "linear":
        default:
          factor = 1 - t;
          break;
      }
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
  }
}
