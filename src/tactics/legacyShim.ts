import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import { circle, type Vec2 } from "../steering";
import type { Tactic as NewTactic, TacticOutput, CastController, PaceHint } from "./plan";
import { STATIONARY } from "./plan";
import type { Tactic as LegacyTactic, TacticContext, Directives } from "./tactic";
import type { SpellFactory } from "../spells/spell";
import { defaultSelector } from "../spells/selection";

function buildCtx(self: Contestant, world: World): TacticContext {
  let enemy: Contestant | null = null;
  let bestDist = Infinity;
  for (const c of world.contestants) {
    if (c === self || !c.alive) continue;
    const dx = c.position.x - self.position.x;
    const dz = c.position.z - self.position.z;
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      enemy = c;
    }
  }
  const centerDist = enemy
    ? enemy.position.distanceTo(self.position)
    : Infinity;
  const distToEnemy = enemy
    ? Math.max(0, centerDist - self.radius - enemy.radius)
    : Infinity;
  const w = self as Contestant & {
    stamina01?: () => number;
    hp01?: () => number;
    getShotsFired?: () => number;
  };
  return {
    self,
    enemy,
    distToEnemy,
    stamina01: w.stamina01 ? w.stamina01() : 1,
    hp01: w.hp01 ? w.hp01() : self.hp / 100,
    shotsFired: w.getShotsFired ? w.getShotsFired() : 0,
  };
}

export class LegacyTacticShim implements NewTactic {
  readonly id: string;
  readonly minDwell: number;
  readonly detectors?: EventDetector[];
  readonly handlers?: Handler[];

  private readonly legacy: LegacyTactic;
  private cachedBase: Directives | null = null;
  private readonly defaultCircleSign: 1 | -1 =
    Math.random() < 0.5 ? 1 : -1;

  constructor(legacy: LegacyTactic) {
    this.legacy = legacy;
    this.id = legacy.id;
    this.minDwell = legacy.minDwell;
    this.detectors = legacy.detectors;
    this.handlers = legacy.handlers;
  }

  score(self: Contestant, world: World): number {
    return this.legacy.score(buildCtx(self, world));
  }

  private resolveDirectives(ctx: TacticContext): Directives {
    if (!this.cachedBase) {
      this.cachedBase = this.legacy.directives(ctx);
    }
    if (this.legacy.liveDirectives) {
      return this.legacy.liveDirectives(this.cachedBase, ctx);
    }
    return this.cachedBase;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const ctx = buildCtx(self, world);
    const dir = this.resolveDirectives(ctx);
    if (!ctx.enemy) {
      return {
        moveIntent: STATIONARY,
        paceHint: "hold",
        facingIntent: STATIONARY,
      };
    }
    const sign: 1 | -1 =
      dir.circleDir !== 0 ? (dir.circleDir as 1 | -1) : this.defaultCircleSign;
    const preferredCenterRange =
      dir.preferredRange + self.radius + ctx.enemy.radius;
    const moveIntent: Vec2 = circle(
      { x: self.position.x, z: self.position.z },
      { x: ctx.enemy.position.x, z: ctx.enemy.position.z },
      preferredCenterRange,
      sign,
      dir.rangeBand
    );
    const paceHint = computePaceHint(ctx.distToEnemy, dir);
    const facingIntent: Vec2 = {
      x: ctx.enemy.position.x - self.position.x,
      z: ctx.enemy.position.z - self.position.z,
    };
    return { moveIntent, paceHint, facingIntent };
  }

  maybeCast(
    _dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void {
    if (caster.isCharging()) return;
    const ctx = buildCtx(self, world);
    if (!ctx.enemy) return;
    const dir = this.resolveDirectives(ctx);
    const w = self as Contestant & {
      getSpellbook?: () => readonly SpellFactory[];
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const book = w.getSpellbook ? w.getSpellbook() : [];
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    const select = dir.selectSpell ?? defaultSelector;
    const factory = select(book, {
      self,
      target: ctx.enemy,
      distToTarget: ctx.distToEnemy,
      readyAt,
      nowSeconds: performance.now() / 1000,
    });
    if (!factory) return;
    if (!caster.isReady(factory)) return;
    caster.requestCast(factory, ctx.enemy, {
      x: ctx.enemy.position.x - self.position.x,
      z: ctx.enemy.position.z - self.position.z,
    });
  }

  onObserve(key: string, value: unknown): void {
    this.legacy.onObserve?.(key, value);
  }
}

function computePaceHint(distToEnemy: number, dir: Directives): PaceHint {
  if (dir.ambushMode) return "walk";
  const rangeGap = Math.abs(distToEnemy - dir.preferredRange);
  const outsideShell = distToEnemy > dir.preferredRange + dir.rangeBand;
  if (dir.forceSprint === true && outsideShell) return "sprint";
  if (rangeGap > 100) return "sprint";
  const atEngagement =
    Math.abs(distToEnemy - dir.preferredRange) < dir.rangeBand + 20;
  if (atEngagement) return "walk";
  return "hold";
}
