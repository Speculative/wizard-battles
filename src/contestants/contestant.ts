import { Vector3 } from "../math";
import type { World } from "../world";
import type { ComponentKey } from "../components";

export interface Contestant {
  readonly id: string;
  readonly world: World;
  readonly color: number;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly facing: Vector3;
  readonly radius: number;
  hp: number;
  alive: boolean;
  update(dt: number, world: World): void;
  getComponent<T>(key: ComponentKey<T>): T | undefined;
  addComponent<T>(key: ComponentKey<T>, data: T): void;
  removeComponent<T>(key: ComponentKey<T>): void;
}
