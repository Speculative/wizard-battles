import * as THREE from "three";
import type { World } from "../world";

export interface Contestant {
  readonly id: string;
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly radius: number;
  hp: number;
  alive: boolean;
  update(dt: number, world: World): void;
}
