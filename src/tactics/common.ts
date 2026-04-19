import type { Tactic, TacticContext, Directives } from "./tactic";
import { OpponentChargingDetector } from "../events/opponentCharging";
import { NoteOpponentChargingHandler } from "../handlers/noteOpponentCharging";

export class Pressure implements Tactic {
  readonly id = "pressure";
  readonly minDwell = 2.5;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const healthy = ctx.hp01 > 0.5 ? 1 : ctx.hp01 * 2;
    const staminaOk = ctx.stamina01 > 0.4 ? 1 : 0.4;
    const proximity = Math.max(0, 1 - ctx.distToEnemy / 500);
    return 0.6 * healthy * staminaOk * (0.5 + 0.5 * proximity);
  }
  directives(): Directives {
    return {
      preferredRange: 170,
      rangeBand: 50,
      chargeEagerness: 1.2,
      dodgeEagerness: 0.9,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class Kite implements Tactic {
  readonly id = "kite";
  readonly minDwell = 3;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const staminaOk = ctx.stamina01 > 0.5 ? 1 : 0.3;
    const hpBias = ctx.hp01 < 0.6 ? 1.2 : 0.8;
    return 0.55 * staminaOk * hpBias;
  }
  directives(): Directives {
    return {
      preferredRange: 320,
      rangeBand: 60,
      chargeEagerness: 1,
      dodgeEagerness: 1.1,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class Orbit implements Tactic {
  readonly id = "orbit";
  readonly minDwell = 3;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    return 0.5;
  }
  directives(): Directives {
    return {
      preferredRange: 270,
      rangeBand: 70,
      chargeEagerness: 1,
      dodgeEagerness: 1,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class Ambush implements Tactic {
  readonly id = "ambush";
  readonly minDwell = 3.5;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const distanced = ctx.distToEnemy > 350 ? 1.2 : 0.6;
    const earlyMatch = ctx.shotsFired < 10 ? 1.1 : 0.9;
    return 0.45 * distanced * earlyMatch;
  }
  directives(): Directives {
    return {
      preferredRange: 340,
      rangeBand: 40,
      chargeEagerness: 0.7,
      dodgeEagerness: 0.8,
      circleDir: 0,
      ambushMode: true,
    };
  }
}

export class Retreat implements Tactic {
  readonly id = "retreat";
  readonly minDwell = 2;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    if (ctx.hp01 > 0.4) return 0.05;
    const danger = 1 - ctx.hp01;
    const needsRest = ctx.stamina01 < 0.3 ? 1.2 : 1;
    return 1.4 * danger * needsRest;
  }
  directives(): Directives {
    return {
      preferredRange: 360,
      rangeBand: 80,
      chargeEagerness: 0.4,
      dodgeEagerness: 1.3,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class BaitAndSwitch implements Tactic {
  readonly id = "bait";
  readonly minDwell = 1.5;
  readonly detectors = [new OpponentChargingDetector()];
  readonly handlers = [new NoteOpponentChargingHandler()];
  private flipSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private observations = {
    enemyChargingRemaining: 0,
    lastObservedAt: 0,
  };

  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const midRange = ctx.distToEnemy > 200 && ctx.distToEnemy < 380 ? 1 : 0.4;
    const staminaOk = ctx.stamina01 > 0.6 ? 1 : 0.5;
    const staleness =
      (performance.now() - this.observations.lastObservedAt) / 1000;
    const opportunityBoost =
      staleness < 0.5 && this.observations.enemyChargingRemaining > 0 ? 2.5 : 1;
    return 0.5 * midRange * staminaOk * opportunityBoost;
  }

  directives(ctx: TacticContext): Directives {
    this.flipSign = -this.flipSign as 1 | -1;
    const near = 180;
    const far = 360;
    const range = ctx.distToEnemy < 260 ? far : near;
    return {
      preferredRange: range,
      rangeBand: 40,
      chargeEagerness: 1.1,
      dodgeEagerness: 1.1,
      circleDir: this.flipSign,
      ambushMode: false,
    };
  }

  onObserve(key: string, value: unknown): void {
    if (key === "opponentChargingRemaining" && typeof value === "number") {
      this.observations.enemyChargingRemaining = value;
      this.observations.lastObservedAt = performance.now();
    }
  }

  liveDirectives(base: Directives): Directives {
    const staleness = (performance.now() - this.observations.lastObservedAt) / 1000;
    if (staleness > 0.2 || this.observations.enemyChargingRemaining <= 0) {
      return base;
    }
    return { ...base, chargeEagerness: 2.2 };
  }
}
