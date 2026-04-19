import * as THREE from "three";
import type { World } from "../world";
import type { Contestant } from "../contestants/contestant";

export type SpellKind = "projectile" | "instant" | "zone" | "buff";
export type SpellElement = "fire" | "water" | "physical" | "neutral";

export interface SpellRange {
  min: number;
  max: number;
}

export interface SpellMetadata {
  id: string;
  kind: SpellKind;
  element: SpellElement;
  range: SpellRange;
  chargeTime: number;
  cooldown: number;
  tags: string[];
}

export interface Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly caster: Contestant;
  readonly metadata: SpellMetadata;
  dead: boolean;
  update(dt: number, world: World): void;
}

export interface SpellFactory {
  readonly metadata: SpellMetadata;
  create(caster: Contestant, target: Contestant | null, aim: THREE.Vector3): Spell;
}
