import * as THREE from "three";
import type { World } from "../world";
import type { ComponentKey } from "../components";

export interface Contestant {
  readonly id: string;
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly facing: THREE.Vector3;
  readonly radius: number;
  hp: number;
  alive: boolean;
  update(dt: number, world: World): void;
  getComponent<T>(key: ComponentKey<T>): T | undefined;
  addComponent<T>(key: ComponentKey<T>, data: T): void;
  removeComponent<T>(key: ComponentKey<T>): void;
}
