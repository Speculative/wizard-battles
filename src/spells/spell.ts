import { Vector3 } from "../math";
import type { World } from "../world";
import type { Contestant } from "../contestants/contestant";

export type SpellKind = "projectile" | "instant" | "zone" | "buff";
export type SpellElement = "fire" | "water" | "physical" | "neutral";

export interface SpellRange {
  min: number;
  max: number;
}

export type CastMode = "charge" | "channel";

export interface SpellMetadata {
  id: string;
  kind: SpellKind;
  element: SpellElement;
  range: SpellRange;
  chargeTime: number;
  cooldown: number;
  tags: string[];
  baseSpeed?: number;
  castMode?: CastMode;
}

export interface Spell {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly caster: Contestant;
  readonly metadata: SpellMetadata;
  dead: boolean;
  update(dt: number, world: World): void;
}

export interface SpellModifier {
  readonly id: string;
  readonly tags: string[];
}

export interface SpellFactory {
  readonly metadata: SpellMetadata;
  create(
    caster: Contestant,
    target: Contestant | null,
    aim: Vector3,
    modifier?: SpellModifier
  ): Spell;
}
