import type { Contestant } from "../contestants/contestant";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import type { SpellFactory } from "../spells/spell";
import type { Vec2 } from "../steering";
import type { World } from "../world";

export const STATIONARY: Vec2 = Object.freeze({ x: 0, z: 0 });

export function isStationary(v: Vec2): boolean {
  return v === STATIONARY || (v.x === 0 && v.z === 0);
}

export type PaceHint = "walk" | "run" | "sprint" | "hold";

export interface TacticOutput {
  moveIntent: Vec2;
  paceHint: PaceHint;
  facingIntent: Vec2;
}

export interface CastController {
  requestCast(
    factory: SpellFactory,
    target: Contestant | null,
    aim: Vec2
  ): boolean;
  cancelCharging(): void;
  updateAim(target: Contestant | null, aim: Vec2): void;
  isCharging(): boolean;
  currentFactory(): SpellFactory | null;
  isReady(factory: SpellFactory): boolean;
}

export interface Tactic {
  readonly id: string;
  readonly minDwell: number;
  readonly detectors?: EventDetector[];
  readonly handlers?: Handler[];

  score(self: Contestant, world: World): number;
  update(dt: number, self: Contestant, world: World): TacticOutput;
  maybeCast?(
    dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void;
  onObserve?(key: string, value: unknown): void;
  currentPhaseId?(): string | undefined;
}

export interface RosterEntry {
  tactic: Tactic;
  bias: number;
}
