import * as THREE from "three";
import type { Spell } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const SPEED = 260;
const RADIUS = 10;
const DAMAGE = 10;
const LIFETIME = 6;

export class Fireball implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly caster: Contestant;
  private readonly velocity: THREE.Vector3;
  private age = 0;
  dead = false;

  constructor(caster: Contestant, direction: THREE.Vector3, origin: THREE.Vector3) {
    this.caster = caster;
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(SPEED);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7733 })
    );
    core.position.copy(this.position);
    this.mesh = core;
  }

  update(dt: number, world: World): void {
    this.age += dt;
    if (this.age >= LIFETIME) {
      this.dead = true;
      return;
    }
    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);

    const b = world.bounds;
    if (
      Math.abs(this.position.x) > b.width / 2 ||
      Math.abs(this.position.z) > b.depth / 2 ||
      this.position.y < 0 ||
      this.position.y > b.height
    ) {
      this.dead = true;
      return;
    }

    for (const c of world.contestants) {
      if (c === this.caster || !c.alive) continue;
      if (c.position.distanceTo(this.position) < c.radius + RADIUS) {
        c.hp -= DAMAGE;
        if (c.hp <= 0) c.alive = false;
        this.dead = true;
        return;
      }
    }
  }
}
