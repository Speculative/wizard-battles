import * as THREE from "three";
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
import { Explosion } from "./explosion";
import { ParticleBurst } from "./particleBurst";
import { emit } from "../telemetry";

export interface ProjectileVisualSpec {
  layers: Array<{ scale: number; color: number; opacity: number }>;
  trailColor: number;
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
    range: spec.range,
    chargeTime: spec.chargeTime,
    cooldown: spec.cooldown,
    tags: spec.tags,
    baseSpeed: spec.speed,
  };
}

export function makeProjectileFactory(spec: ProjectileSpec): ProjectileFactory {
  return {
    spec,
    metadata: specToMetadata(spec),
    create(caster, _target, aim, modifier?: SpellModifier) {
      const effectiveSpec =
        modifier && isProjectileModifier(modifier)
          ? modifier.apply(spec)
          : spec;
      const dir = new THREE.Vector3(aim.x, 0, aim.z);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const origin = caster.position
        .clone()
        .add(dir.clone().multiplyScalar(caster.radius + 4));
      return new Projectile(caster, dir, origin, effectiveSpec);
    },
  };
}

const TRAIL_COUNT = 7;
const TRAIL_SAMPLE_INTERVAL = 0.025;
const TRAIL_LIFETIME = TRAIL_SAMPLE_INTERVAL * TRAIL_COUNT;
const TELEGRAPH_GROUND_Y = 0.4;
const TELEGRAPH_AIM_SCRATCH = new THREE.Vector3();

interface TrailNode {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  active: boolean;
}

export class Projectile implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly caster: Contestant;
  readonly velocity: THREE.Vector3;
  readonly metadata: SpellMetadata;
  readonly spec: ProjectileSpec;
  frozen = false;
  private age = 0;
  dead = false;
  private exploded = false;
  private detonateAt: { x: number; z: number; dist: number } | null = null;
  private launchOrigin = new THREE.Vector3();
  private readonly head: THREE.Group;
  private readonly trailGroup: THREE.Group;
  private readonly trailNodes: TrailNode[] = [];
  private trailTimer = 0;
  private readonly telegraph: Telegraph | null;
  private telegraphAge = 0;
  private telegraphAttached = false;
  private emitterBaseDir = new THREE.Vector3(1, 0, 0);
  private emitterFired = 0;
  private emitterTimer = 0;
  private emitterActive = false;

  constructor(
    caster: Contestant,
    direction: THREE.Vector3,
    origin: THREE.Vector3,
    spec: ProjectileSpec
  ) {
    this.caster = caster;
    this.spec = spec;
    this.metadata = specToMetadata(spec);
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(spec.speed);

    this.head = new THREE.Group();
    buildFireSphere(this.head, spec.radius, spec.visual.layers);
    this.head.position.copy(this.position);

    this.trailGroup = new THREE.Group();
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: spec.visual.trailColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 8),
        mat
      );
      mesh.visible = false;
      this.trailGroup.add(mesh);
      this.trailNodes.push({
        mesh,
        material: mat,
        age: 0,
        active: false,
      });
    }

    const group = new THREE.Group();
    group.add(this.trailGroup);
    group.add(this.head);
    this.mesh = group;

    this.telegraph = spec.telegraph ? createTelegraph(spec.telegraph) : null;
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.head.position.set(x, y, z);
  }

  setVelocityFromDirection(direction: THREE.Vector3): void {
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

  setDetonationPoint(x: number, z: number, dist: number): void {
    this.detonateAt = { x, z, dist };
  }

  update(dt: number, world: World): void {
    if (this.frozen) {
      this.updateTelegraph(dt, world);
      return;
    }
    this.detachTelegraph();

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

    this.position.addScaledVector(this.velocity, dt);
    this.head.position.copy(this.position);

    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = TRAIL_SAMPLE_INTERVAL;
      this.pushTrailNode();
    }
    this.updateTrailNodes(dt);

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
      if (c === this.caster || !c.alive) continue;
      if (
        c.position.distanceTo(this.position) <
        c.radius + this.spec.radius
      ) {
        this.explode(world, c);
        return;
      }
    }

    if (this.detonateAt) {
      const traveled = Math.hypot(
        this.position.x - this.launchOrigin.x,
        this.position.z - this.launchOrigin.z
      );
      if (traveled >= this.detonateAt.dist) {
        this.explode(world, null);
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
      this.head.position.copy(this.position);
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
      if (plan.interval <= 0) break;
    }

    if (this.emitterFired >= plan.count) {
      // For instant burst (interval=0) we'd loop above; this also catches
      // the timed case after the last child has been fired.
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
      angle += (Math.random() * 2 - 1) * plan.perChildAimJitter;
    }
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const origin = new THREE.Vector3(
      this.position.x + dir.x * (this.caster.radius + 4),
      this.caster.position.y,
      this.position.z + dir.z * (this.caster.radius + 4)
    );
    const child = new Projectile(this.caster, dir, origin, childSpec);
    child.setVelocityFromDirection(dir);
    world.addSpell(child);
    emit("projectile_emit", this.caster.id, {
      spell: this.spec.id,
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

  private updateTelegraph(dt: number, world: World): void {
    if (!this.telegraph) return;
    if (!this.telegraphAttached) {
      world.scene.add(this.telegraph.mesh);
      this.telegraphAttached = true;
      this.telegraphAge = 0;
    }
    this.telegraphAge += dt;
    const totalCharge = Math.max(0.001, this.spec.chargeTime);
    const t = Math.min(1, this.telegraphAge / totalCharge);
    // The frozen projectile is positioned by the wizard each frame at
    // caster.position + aim*offset, so (this.position - caster.position)
    // is the aim direction.
    const aim = TELEGRAPH_AIM_SCRATCH;
    aim.set(
      this.position.x - this.caster.position.x,
      0,
      this.position.z - this.caster.position.z
    );
    this.telegraph.update(this.caster.position, aim, t);
  }

  private detachTelegraph(): void {
    if (!this.telegraph || !this.telegraphAttached) return;
    this.telegraph.dispose();
    this.telegraphAttached = false;
  }

  private pushTrailNode(): void {
    let slot: TrailNode | undefined;
    for (const n of this.trailNodes) {
      if (!n.active) {
        slot = n;
        break;
      }
    }
    if (!slot) {
      let oldest = this.trailNodes[0];
      for (const n of this.trailNodes) if (n.age > oldest.age) oldest = n;
      slot = oldest;
    }
    slot.active = true;
    slot.age = 0;
    slot.mesh.position.copy(this.position);
    slot.mesh.visible = true;
  }

  private updateTrailNodes(dt: number): void {
    for (const n of this.trailNodes) {
      if (!n.active) continue;
      n.age += dt;
      const t = n.age / TRAIL_LIFETIME;
      if (t >= 1) {
        n.active = false;
        n.mesh.visible = false;
        n.material.opacity = 0;
        continue;
      }
      const fade = 1 - t;
      const scale = this.spec.radius * (0.9 + 0.4 * t);
      n.mesh.scale.setScalar(scale);
      n.material.opacity = 0.45 * fade * fade;
    }
  }

  private explode(world: World, hitTarget: Contestant | null): void {
    if (this.exploded) {
      this.dead = true;
      return;
    }
    this.exploded = true;
    this.detachTelegraph();

    if (this.spec.aoe) {
      this.applyAOE(world);
    } else if (hitTarget) {
      this.applyDirectHit(hitTarget);
    }

    const explosionRadius = this.spec.aoe
      ? this.spec.aoe.radius
      : this.spec.radius * 3.8;
    world.addSpell(
      new Explosion(this.caster, this.position, {
        startRadius: this.spec.radius * 0.8,
        peakRadius: explosionRadius,
      })
    );
    world.addSpell(
      new ParticleBurst(this.caster, this.position, undefined, {
        speedScale: this.spec.aoe ? 2.0 : 1,
      })
    );
    this.dead = true;
  }

  private applyDirectHit(target: Contestant): void {
    target.hp -= this.spec.damage;
    emit("damage", this.caster.id, {
      victim: target.id,
      amount: this.spec.damage,
      spell: this.spec.id,
      hpAfter: target.hp,
    });
    if (target.hp <= 0) {
      target.alive = false;
      emit("death", target.id, {
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
      emit("damage", this.caster.id, {
        victim: c.id,
        amount: dmg,
        spell: this.spec.id,
        hpAfter: c.hp,
        aoe: true,
        surfaceDist,
      });
      if (c.hp <= 0) {
        c.alive = false;
        emit("death", c.id, {
          killer: this.caster.id,
          spell: this.spec.id,
        });
      }
    }
    emit("aoe_impact", this.caster.id, {
      spell: this.spec.id,
      radius: aoe.radius,
      hits,
    });
  }
}

interface Telegraph {
  readonly mesh: THREE.Object3D;
  update(casterPos: THREE.Vector3, aimDir: THREE.Vector3, t: number): void;
  dispose(): void;
}

function createTelegraph(spec: ProjectileTelegraphSpec): Telegraph {
  if (spec.kind === "ground-fan") return new TelegraphFan(spec);
  return new TelegraphCircle(spec);
}

class TelegraphCircle implements Telegraph {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly maxRadius: number;
  private disposed = false;

  constructor(spec: { color: number; maxRadius: number }) {
    this.maxRadius = spec.maxRadius;
    const geo = new THREE.RingGeometry(0.85, 1.0, 48, 1);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 5;
    this.mesh = mesh;
  }

  update(casterPos: THREE.Vector3, _aimDir: THREE.Vector3, t: number): void {
    if (this.disposed) return;
    const radius = this.maxRadius * t;
    this.mesh.scale.set(radius, radius, 1);
    this.mesh.position.set(casterPos.x, TELEGRAPH_GROUND_Y, casterPos.z);
    const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 8);
    this.material.opacity = (0.35 + 0.5 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}

class TelegraphFan implements Telegraph {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly length: number;
  private disposed = false;

  constructor(spec: { color: number; length: number; arcRadians: number }) {
    this.length = spec.length;
    // Pie-slice built as a partial ring with near-zero inner radius, then
    // baked flat into the XZ plane so we only need to spin the mesh
    // around Y to point at the aim direction.
    const segments = 24;
    const geo = new THREE.RingGeometry(
      0.001,
      1.0,
      segments,
      1,
      -spec.arcRadians / 2,
      spec.arcRadians
    );
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.renderOrder = 5;
    this.mesh = mesh;
  }

  update(casterPos: THREE.Vector3, aimDir: THREE.Vector3, t: number): void {
    if (this.disposed) return;
    const radius = this.length * t;
    this.mesh.scale.set(radius, 1, radius);
    this.mesh.position.set(casterPos.x, TELEGRAPH_GROUND_Y, casterPos.z);
    const len = Math.hypot(aimDir.x, aimDir.z);
    if (len > 1e-4) {
      // RingGeometry was built centered on +X (in XY before rotateX). After
      // baking the X rotation, the wedge points along world +X. To align
      // its forward direction with (aimDir.x, aimDir.z), rotate around Y by
      // atan2(-aim.z, aim.x) — see derivation in commit message.
      const ax = aimDir.x / len;
      const az = aimDir.z / len;
      this.mesh.rotation.y = Math.atan2(-az, ax);
    }
    const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 8);
    this.material.opacity = (0.25 + 0.45 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}

function buildFireSphere(
  target: THREE.Group,
  r: number,
  layers: ProjectileVisualSpec["layers"]
): void {
  for (const l of layers) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r * l.scale, 16, 12),
      new THREE.MeshBasicMaterial({
        color: l.color,
        transparent: l.opacity < 1,
        opacity: l.opacity,
        blending:
          l.opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: l.opacity >= 1,
      })
    );
    target.add(mesh);
  }
}
