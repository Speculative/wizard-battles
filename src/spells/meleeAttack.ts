import * as THREE from "three";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import { emit } from "../telemetry";

const SWING_DURATION = 0.18;
const RECOVERY_DURATION = 0.22;
const HIT_WINDOW_START = 0.04;
const HIT_WINDOW_END = 0.14;
const CONE_HALF_ANGLE = Math.PI / 3;
const REACH = 54;
const DAMAGE = 22;
const LUNGE_DISTANCE = 18;
const ARC_INNER_RADIUS = 20;
const ARC_OUTER_RADIUS = REACH;
const ARC_SEGMENTS = 20;

export const MELEE_METADATA: SpellMetadata = {
  id: "melee",
  kind: "instant",
  element: "physical",
  range: { min: 0, max: REACH },
  chargeTime: 0.18,
  cooldown: 0.6,
  tags: ["melee", "close", "physical"],
};

function buildArcMesh(): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const span = CONE_HALF_ANGLE * 2;
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    const a0 = -CONE_HALF_ANGLE + (i / ARC_SEGMENTS) * span;
    const a1 = -CONE_HALF_ANGLE + ((i + 1) / ARC_SEGMENTS) * span;
    const cos0 = Math.cos(a0);
    const sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1);
    const sin1 = Math.sin(a1);
    const ix0 = ARC_INNER_RADIUS * cos0;
    const iz0 = ARC_INNER_RADIUS * sin0;
    const ox0 = ARC_OUTER_RADIUS * cos0;
    const oz0 = ARC_OUTER_RADIUS * sin0;
    const ix1 = ARC_INNER_RADIUS * cos1;
    const iz1 = ARC_INNER_RADIUS * sin1;
    const ox1 = ARC_OUTER_RADIUS * cos1;
    const oz1 = ARC_OUTER_RADIUS * sin1;
    positions.push(ix0, 0, iz0, ox0, 0, oz0, ox1, 0, oz1);
    positions.push(ix0, 0, iz0, ox1, 0, oz1, ix1, 0, iz1);
  }
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return mesh;
}

export class MeleeAttack implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly caster: Contestant;
  readonly metadata = MELEE_METADATA;
  dead = false;
  frozen = false;
  private readonly arc: THREE.Mesh;
  private readonly arcMat: THREE.MeshBasicMaterial;
  private age = 0;
  private hasHit = false;
  private readonly aim = new THREE.Vector3();

  constructor(caster: Contestant, aim: THREE.Vector3) {
    this.caster = caster;
    this.position = caster.position.clone();
    const aimLen = Math.hypot(aim.x, aim.z);
    if (aimLen > 1e-3) {
      this.aim.set(aim.x / aimLen, 0, aim.z / aimLen);
    } else {
      this.aim.set(caster.facing.x, 0, caster.facing.z);
    }
    this.arc = buildArcMesh();
    this.arcMat = this.arc.material as THREE.MeshBasicMaterial;
    this.arc.position.copy(caster.position);
    this.arc.position.y = caster.position.y * 0.6;
    this.arc.rotation.y = -Math.atan2(this.aim.z, this.aim.x);
    this.mesh = this.arc;
  }

  update(dt: number, world: World): void {
    if (this.frozen) return;
    this.age += dt;

    if (this.caster.alive) {
      const base = this.caster.position;
      let lungeOffset = 0;
      if (this.age < SWING_DURATION) {
        const t = this.age / SWING_DURATION;
        lungeOffset =
          t < 0.5 ? (t / 0.5) * LUNGE_DISTANCE : (1 - (t - 0.5) / 0.5) * LUNGE_DISTANCE;
      }
      const x = base.x + this.aim.x * lungeOffset;
      const z = base.z + this.aim.z * lungeOffset;
      this.arc.position.set(x, base.y * 0.6, z);
      this.arc.rotation.y = -Math.atan2(this.aim.z, this.aim.x);
      this.caster.mesh.position.set(x, base.y, z);
    }

    if (this.age < SWING_DURATION) {
      const t = this.age / SWING_DURATION;
      const fade =
        t < 0.2
          ? t / 0.2
          : t < 0.75
            ? 1
            : Math.max(0, 1 - (t - 0.75) / 0.25);
      this.arcMat.opacity = 0.85 * fade;

      if (
        !this.hasHit &&
        this.age >= HIT_WINDOW_START &&
        this.age <= HIT_WINDOW_END
      ) {
        this.applyHit(world);
      }
    } else {
      this.arcMat.opacity = 0;
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
      emit("damage", this.caster.id, {
        victim: c.id,
        amount: DAMAGE,
        spell: MELEE_METADATA.id,
        hpAfter: c.hp,
      });
      if (c.hp <= 0) {
        c.alive = false;
        emit("death", c.id, { killer: this.caster.id, spell: MELEE_METADATA.id });
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
      dir = new THREE.Vector3(dx, 0, dz);
    }
    return new MeleeAttack(caster, dir);
  },
};
