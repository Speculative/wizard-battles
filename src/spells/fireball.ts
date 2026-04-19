import * as THREE from "three";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import { Explosion } from "./explosion";
import { ParticleBurst } from "./particleBurst";

export const FIREBALL_SPEED = 260;
const SPEED = FIREBALL_SPEED;
const RADIUS = 10;
const DAMAGE = 10;
const LIFETIME = 6;

export const FIREBALL_METADATA: SpellMetadata = {
  id: "fireball",
  kind: "projectile",
  element: "fire",
  range: { min: 60, max: 600 },
  chargeTime: 0.45,
  cooldown: 1.4,
  tags: ["ranged", "projectile"],
};

export const FireballFactory: SpellFactory = {
  metadata: FIREBALL_METADATA,
  create(caster, _target, aim) {
    const origin = caster.position
      .clone()
      .add(
        new THREE.Vector3(aim.x, 0, aim.z).normalize().multiplyScalar(caster.radius + 4)
      );
    return new Fireball(caster, aim, origin);
  },
};

const TRAIL_COUNT = 7;
const TRAIL_SAMPLE_INTERVAL = 0.025;
const TRAIL_LIFETIME = TRAIL_SAMPLE_INTERVAL * TRAIL_COUNT;

interface TrailNode {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  x: number;
  y: number;
  z: number;
  active: boolean;
}

export class Fireball implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly caster: Contestant;
  readonly velocity: THREE.Vector3;
  readonly metadata = FIREBALL_METADATA;
  frozen = false;
  private age = 0;
  dead = false;
  private exploded = false;
  private readonly head: THREE.Group;
  private readonly trailGroup: THREE.Group;
  private readonly trailNodes: TrailNode[] = [];
  private trailTimer = 0;

  constructor(caster: Contestant, direction: THREE.Vector3, origin: THREE.Vector3) {
    this.caster = caster;
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(SPEED);

    this.head = new THREE.Group();
    buildFireSphere(this.head, RADIUS);
    this.head.position.copy(this.position);

    this.trailGroup = new THREE.Group();
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6622,
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
        x: 0,
        y: 0,
        z: 0,
        active: false,
      });
    }

    const group = new THREE.Group();
    group.add(this.trailGroup);
    group.add(this.head);
    this.mesh = group;
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.head.position.set(x, y, z);
  }

  setVelocityFromDirection(direction: THREE.Vector3): void {
    const len = Math.hypot(direction.x, direction.y, direction.z);
    if (len < 1e-6) return;
    this.velocity.set(
      (direction.x / len) * SPEED,
      (direction.y / len) * SPEED,
      (direction.z / len) * SPEED
    );
  }

  update(dt: number, world: World): void {
    if (this.frozen) return;
    this.age += dt;
    if (this.age >= LIFETIME) {
      this.dead = true;
      return;
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
      this.explode(world);
      return;
    }

    for (const c of world.contestants) {
      if (c === this.caster || !c.alive) continue;
      if (c.position.distanceTo(this.position) < c.radius + RADIUS) {
        c.hp -= DAMAGE;
        if (c.hp <= 0) c.alive = false;
        this.explode(world);
        return;
      }
    }
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
    slot.x = this.position.x;
    slot.y = this.position.y;
    slot.z = this.position.z;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
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
      const scale = RADIUS * (0.9 + 0.4 * t);
      n.mesh.scale.setScalar(scale);
      n.material.opacity = 0.45 * fade * fade;
    }
  }

  private explode(world: World): void {
    if (!this.exploded) {
      this.exploded = true;
      world.addSpell(new Explosion(this.caster, this.position));
      world.addSpell(new ParticleBurst(this.caster, this.position));
    }
    this.dead = true;
  }
}

function buildFireSphere(target: THREE.Group, r: number): void {
  const layers: Array<{ scale: number; color: number; opacity: number }> = [
    { scale: 0.55, color: 0xffb040, opacity: 1.0 },
    { scale: 0.85, color: 0xff5008, opacity: 0.55 },
    { scale: 1.1, color: 0xc02000, opacity: 0.35 },
    { scale: 1.35, color: 0x600400, opacity: 0.18 },
  ];
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
