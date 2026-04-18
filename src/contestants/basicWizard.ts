import * as THREE from "three";
import type { Contestant } from "./contestant";
import type { World } from "../world";
import { Fireball } from "../spells/fireball";
import { getToonGradient, makeOutline } from "../materials";

const RADIUS = 22;
const MOVE_SPEED = 80;
const FIRE_COOLDOWN = 1.4;
const FLOAT_HEIGHT = RADIUS * 1.5;

export interface BasicWizardOptions {
  id: string;
  color: number;
  start: THREE.Vector3;
}

export class BasicWizard implements Contestant {
  readonly id: string;
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly radius = RADIUS;
  hp = 100;
  alive = true;

  private readonly heading: THREE.Vector3;
  private cooldown = Math.random() * FIRE_COOLDOWN;
  private turnTimer = 0;

  constructor(opts: BasicWizardOptions) {
    this.id = opts.id;
    this.position = opts.start.clone();
    this.position.y = FLOAT_HEIGHT;

    const sphereGeo = new THREE.SphereGeometry(RADIUS, 24, 24);
    const body = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshToonMaterial({
        color: opts.color,
        gradientMap: getToonGradient(),
      })
    );
    body.castShadow = true;
    const group = new THREE.Group();
    group.add(makeOutline(sphereGeo, 1.05));
    group.add(body);
    this.mesh = group;
    this.mesh.position.copy(this.position);

    const angle = Math.random() * Math.PI * 2;
    this.heading = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  }

  update(dt: number, world: World): void {
    if (!this.alive) {
      this.mesh.visible = false;
      return;
    }

    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.heading.set(Math.cos(angle), 0, Math.sin(angle));
      this.turnTimer = 0.8 + Math.random() * 1.6;
    }

    this.position.addScaledVector(this.heading, MOVE_SPEED * dt);

    const b = world.bounds;
    const halfW = b.width / 2 - this.radius;
    const halfD = b.depth / 2 - this.radius;
    if (this.position.x < -halfW) {
      this.position.x = -halfW;
      this.heading.x *= -1;
    } else if (this.position.x > halfW) {
      this.position.x = halfW;
      this.heading.x *= -1;
    }
    if (this.position.z < -halfD) {
      this.position.z = -halfD;
      this.heading.z *= -1;
    } else if (this.position.z > halfD) {
      this.position.z = halfD;
      this.heading.z *= -1;
    }
    this.position.y = FLOAT_HEIGHT;
    this.mesh.position.copy(this.position);

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const target = this.pickTarget(world);
      if (target) {
        const dir = target.position.clone().sub(this.position);
        const origin = this.position
          .clone()
          .add(dir.clone().normalize().multiplyScalar(this.radius + 4));
        world.addSpell(new Fireball(this, dir, origin));
      }
      this.cooldown = FIRE_COOLDOWN;
    }
  }

  private pickTarget(world: World): Contestant | null {
    let best: Contestant | null = null;
    let bestDist = Infinity;
    for (const c of world.contestants) {
      if (c === this || !c.alive) continue;
      const d = c.position.distanceTo(this.position);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }
}
