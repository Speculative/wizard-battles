import type { Contestant } from "../contestants/contestant";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import type { SpellSelector } from "../spells/selection";

export interface TacticContext {
  self: Contestant;
  enemy: Contestant | null;
  distToEnemy: number;
  stamina01: number;
  hp01: number;
  shotsFired: number;
}

export interface Directives {
  preferredRange: number;
  rangeBand: number;
  chargeEagerness: number;
  dodgeEagerness: number;
  circleDir: -1 | 0 | 1;
  ambushMode: boolean;
  selectSpell?: SpellSelector;
}

export interface Tactic {
  readonly id: string;
  readonly minDwell: number;
  readonly detectors?: EventDetector[];
  readonly handlers?: Handler[];
  score(ctx: TacticContext): number;
  directives(ctx: TacticContext): Directives;
  onObserve?(key: string, value: unknown): void;
  liveDirectives?(base: Directives, ctx: TacticContext): Directives;
}

export const DEFAULT_DIRECTIVES: Directives = {
  preferredRange: 250,
  rangeBand: 80,
  chargeEagerness: 1,
  dodgeEagerness: 1,
  circleDir: 0,
  ambushMode: false,
};

export interface RosterEntry {
  tactic: Tactic;
  bias: number;
}
