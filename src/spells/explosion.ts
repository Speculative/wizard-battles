import * as THREE from "three";
import type { Spell } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const DURATION = 0.32;
const START_RADIUS = 8;
const PEAK_RADIUS = 38;

export class Explosion implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly caster: Contestant;
  dead = false;
  private age = 0;
  private readonly coreMat: THREE.MeshBasicMaterial;
  private readonly haloMat: THREE.MeshBasicMaterial;
  private readonly core: THREE.Mesh;
  private readonly halo: THREE.Mesh;

  constructor(caster: Contestant, origin: THREE.Vector3) {
    this.caster = caster;
    this.position = origin.clone();

    const geo = new THREE.SphereGeometry(1, 16, 12);
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xffb040,
      transparent: true,
      opacity: 1,
    });
    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0xc02000,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.core = new THREE.Mesh(geo, this.coreMat);
    this.halo = new THREE.Mesh(geo, this.haloMat);
    const group = new THREE.Group();
    group.add(this.halo);
    group.add(this.core);
    group.position.copy(this.position);
    this.mesh = group;
  }

  update(dt: number, _world: World): void {
    this.age += dt;
    const t = this.age / DURATION;
    if (t >= 1) {
      this.dead = true;
      return;
    }
    const ease = 1 - (1 - t) * (1 - t);
    const coreR = START_RADIUS + (PEAK_RADIUS - START_RADIUS) * ease;
    const haloR = coreR * 1.7;
    this.core.scale.setScalar(coreR);
    this.halo.scale.setScalar(haloR);
    this.coreMat.opacity = 1 - t;
    this.haloMat.opacity = 0.7 * (1 - t);
  }
}
