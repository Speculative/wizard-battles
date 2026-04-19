import * as THREE from "three";
import type { World } from "../world";
import type { Contestant } from "../contestants/contestant";

export interface Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly caster: Contestant;
  dead: boolean;
  update(dt: number, world: World): void;
}
