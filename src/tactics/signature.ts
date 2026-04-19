import type { Tactic, TacticContext, Directives } from "./tactic";
import { byTag, inRange } from "../spells/selection";

export class DuelistCharge implements Tactic {
  readonly id = "duelist";
  readonly minDwell = 3.5;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const hp = ctx.hp01 > 0.35 ? 1 : 0.3;
    const enemyWounded = 1.5 - (ctx.enemy.hp / 100);
    return 0.75 * hp * enemyWounded;
  }
  directives(): Directives {
    return {
      preferredRange: 70,
      rangeBand: 25,
      chargeEagerness: 1.4,
      dodgeEagerness: 0.7,
      circleDir: 0,
      ambushMode: false,
      selectSpell: (book, ctx) =>
        book.filter(byTag("melee")).find(inRange(ctx.distToTarget)) ?? null,
    };
  }
}

export class Sniper implements Tactic {
  readonly id = "sniper";
  readonly minDwell = 4;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const farPreferred = ctx.distToEnemy > 280 ? 1.3 : 0.6;
    const calm = ctx.stamina01 > 0.5 ? 1 : 0.6;
    return 0.75 * farPreferred * calm;
  }
  directives(): Directives {
    return {
      preferredRange: 350,
      rangeBand: 50,
      chargeEagerness: 0.9,
      dodgeEagerness: 1,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class Turtle implements Tactic {
  readonly id = "turtle";
  readonly minDwell = 4;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    const hurt = ctx.hp01 < 0.7 ? 1.2 : 0.8;
    const tired = ctx.stamina01 < 0.6 ? 1.1 : 0.9;
    return 0.65 * hurt * tired;
  }
  directives(): Directives {
    return {
      preferredRange: 340,
      rangeBand: 90,
      chargeEagerness: 0.8,
      dodgeEagerness: 1.3,
      circleDir: 0,
      ambushMode: false,
    };
  }
}

export class Scrapper implements Tactic {
  readonly id = "scrapper";
  readonly minDwell = 1.2;
  private circleFlip: 1 | -1 = 1;
  score(ctx: TacticContext): number {
    if (!ctx.enemy) return 0;
    return 0.35 + Math.random() * 0.3;
  }
  directives(ctx: TacticContext): Directives {
    this.circleFlip = -this.circleFlip as 1 | -1;
    const chaotic = 160 + Math.random() * 220;
    return {
      preferredRange: chaotic,
      rangeBand: 30,
      chargeEagerness: 1.2,
      dodgeEagerness: 1.1,
      circleDir: this.circleFlip,
      ambushMode: ctx.distToEnemy > 380 && Math.random() < 0.4,
    };
  }
}
