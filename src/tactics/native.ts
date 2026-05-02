import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { SpellFactory } from "../spells/spell";
import { NoteOpponentChargingHandler } from "../handlers/noteOpponentCharging";
import { OpponentChargingDetector } from "../events/opponentCharging";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import { byTag, byReady, inRange, defaultSelector } from "../spells/selection";
import {
  faceContestant,
  hp01,
  nearestEnemy,
  paceForRange,
  pickBest,
  sampleRingAroundEnemy,
  scoreAwayFromProjectiles,
  scoreByAngularPreference,
  scoreByArenaCenter,
  scoreByRangeMatch,
  scoreByReachability,
  scoreByWallClearance,
  selectionContext,
  shotsFired,
  spellbook,
  stamina01,
  steerToward,
  surfaceDistance,
  hasIncomingProjectile,
  pickSafeDirection,
  ringDirections,
  tryMobilityAway,
} from "./helpers";
import type {
  CastController,
  DodgePolicy,
  Tactic,
  TacticOutput,
} from "./tactic";
import { STATIONARY } from "./tactic";
import type { Vec2 } from "../steering";
import { nowMs, nowSeconds } from "../clock";

function directionTo(self: Contestant, enemy: Contestant): {
  x: number;
  z: number;
} {
  return {
    x: enemy.position.x - self.position.x,
    z: enemy.position.z - self.position.z,
  };
}

function idleOutput(): TacticOutput {
  return {
    moveIntent: STATIONARY,
    paceHint: "hold",
    facingIntent: STATIONARY,
  };
}

function tryDefaultCast(
  _dt: number,
  self: Contestant,
  world: World,
  caster: CastController
): void {
  if (caster.isCharging()) return;
  const enemy = nearestEnemy(self, world);
  if (!enemy) return;
  const ctx = selectionContext(self, enemy);
  const factory = defaultSelector(spellbook(self), ctx);
  if (!factory) return;
  if (!caster.isReady(factory)) return;
  caster.requestCast(factory, enemy, directionTo(self, enemy));
}

function orbitOutput(
  self: Contestant,
  enemy: Contestant,
  world: World,
  preferredRange: number,
  band: number,
  dir: 1 | -1,
  paceOverride?: TacticOutput["paceHint"]
): TacticOutput {
  const dist = surfaceDistance(self, enemy);
  const enemyPos: Vec2 = { x: enemy.position.x, z: enemy.position.z };
  const selfPos: Vec2 = { x: self.position.x, z: self.position.z };
  const toSelf: Vec2 = {
    x: selfPos.x - enemyPos.x,
    z: selfPos.z - enemyPos.z,
  };
  const tangent: Vec2 = { x: -toSelf.z * dir, z: toSelf.x * dir };
  const gap = Math.abs(dist - preferredRange);
  const angularWeight = 0.4 * Math.max(0, 1 - gap / Math.max(1, band));
  let candidates = sampleRingAroundEnemy(self, enemy, preferredRange, 24);
  candidates = scoreByRangeMatch(candidates, self, enemy, preferredRange, band, 0.5);
  candidates = scoreByAngularPreference(candidates, enemyPos, tangent, angularWeight);
  candidates = scoreByReachability(candidates, self, 0.25, 300);
  candidates = scoreByWallClearance(candidates, 1.8, 140);
  candidates = scoreByArenaCenter(candidates, 0.3);
  candidates = scoreAwayFromProjectiles(candidates, self, world, 0.6, 180);
  const best = pickBest(candidates);
  const moveIntent: Vec2 = best ? steerToward(self, best.pos) : STATIONARY;
  return {
    moveIntent,
    paceHint: paceOverride ?? paceForRange(dist, preferredRange, band),
    facingIntent: faceContestant(self, enemy),
  };
}

// --- Common tactics ---

export class Pressure implements Tactic {
  readonly id = "pressure";
  readonly minDwell = 2.5;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 170;
  private static readonly BAND = 50;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const hp = hp01(self);
    const healthy = hp > 0.5 ? 1 : hp * 2;
    const staminaOk = stamina01(self) > 0.4 ? 1 : 0.4;
    const proximity = Math.max(0, 1 - surfaceDistance(self, enemy) / 500);
    return 0.6 * healthy * staminaOk * (0.5 + 0.5 * proximity);
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Pressure.RANGE, Pressure.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class Kite implements Tactic {
  readonly id = "kite";
  readonly minDwell = 3;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 320;
  private static readonly BAND = 60;

  score(self: Contestant, world: World): number {
    if (!nearestEnemy(self, world)) return 0;
    const staminaOk = stamina01(self) > 0.5 ? 1 : 0.3;
    const hpBias = hp01(self) < 0.6 ? 1.2 : 0.8;
    return 0.55 * staminaOk * hpBias;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Kite.RANGE, Kite.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class Orbit implements Tactic {
  readonly id = "orbit";
  readonly minDwell = 3;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 270;
  private static readonly BAND = 70;

  score(self: Contestant, world: World): number {
    return nearestEnemy(self, world) ? 0.5 : 0;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Orbit.RANGE, Orbit.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class Ambush implements Tactic {
  readonly id = "ambush";
  readonly minDwell = 3.5;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 340;
  private static readonly BAND = 40;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const distanced = surfaceDistance(self, enemy) > 350 ? 1.2 : 0.6;
    const earlyMatch = shotsFired(self) < 10 ? 1.1 : 0.9;
    return 0.45 * distanced * earlyMatch;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Ambush.RANGE, Ambush.BAND, this.dir, "walk");
  }
  maybeCast = tryDefaultCast;
}

export class Retreat implements Tactic {
  readonly id = "retreat";
  readonly minDwell = 2;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 360;
  private static readonly BAND = 80;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const hp = hp01(self);
    if (hp > 0.4) return 0.05;
    const danger = 1 - hp;
    const needsRest = stamina01(self) < 0.3 ? 1.2 : 1;
    return 1.4 * danger * needsRest;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Retreat.RANGE, Retreat.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class BaitAndSwitch implements Tactic {
  readonly id = "bait";
  readonly minDwell = 1.5;
  readonly detectors: EventDetector[] = [new OpponentChargingDetector()];
  readonly handlers: Handler[] = [new NoteOpponentChargingHandler()];
  private flipSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private enemyChargingRemaining = 0;
  private lastObservedAt = 0;
  private flipTimer = 0;
  private static readonly NEAR_RANGE = 180;
  private static readonly FAR_RANGE = 360;
  private static readonly BAND = 40;
  private static readonly FLIP_INTERVAL = 2.0;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const dist = surfaceDistance(self, enemy);
    const midRange = dist > 200 && dist < 380 ? 1 : 0.4;
    const staminaOk = stamina01(self) > 0.6 ? 1 : 0.5;
    const staleness = (nowMs() - this.lastObservedAt) / 1000;
    const opportunityBoost =
      staleness < 0.5 && this.enemyChargingRemaining > 0 ? 2.5 : 1;
    return 0.5 * midRange * staminaOk * opportunityBoost;
  }

  onObserve(key: string, value: unknown): void {
    if (key === "opponentChargingRemaining" && typeof value === "number") {
      this.enemyChargingRemaining = value;
      this.lastObservedAt = nowMs();
    }
  }

  update(dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    this.flipTimer -= dt;
    if (this.flipTimer <= 0) {
      this.flipSign = -this.flipSign as 1 | -1;
      this.flipTimer = BaitAndSwitch.FLIP_INTERVAL;
    }
    const dist = surfaceDistance(self, enemy);
    const range =
      dist < 260 ? BaitAndSwitch.FAR_RANGE : BaitAndSwitch.NEAR_RANGE;
    return orbitOutput(
      self,
      enemy,
      world,
      range,
      BaitAndSwitch.BAND,
      this.flipSign
    );
  }

  maybeCast = tryDefaultCast;
}

// --- Signature tactics ---

export class DuelistCharge implements Tactic {
  readonly id = "duelist";
  readonly minDwell = 2.0;
  private static readonly ARRIVAL_SURFACE_DIST = 55;
  private static readonly APPROACH_RING = 30;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const hp = hp01(self) > 0.35 ? 1 : 0.3;
    const enemyWounded = 1.5 - enemy.hp / 100;
    return 0.75 * hp * enemyWounded;
  }

  dodgePolicy(): DodgePolicy {
    return "never";
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    let candidates = sampleRingAroundEnemy(
      self,
      enemy,
      DuelistCharge.APPROACH_RING,
      16
    );
    candidates = scoreByReachability(candidates, self, 0.8, 400);
    candidates = scoreByWallClearance(candidates, 1.2, 120);
    candidates = scoreAwayFromProjectiles(candidates, self, world, 0.5, 180);
    const best = pickBest(candidates);
    const moveIntent: Vec2 = best
      ? steerToward(self, best.pos)
      : directionTo(self, enemy);
    return {
      moveIntent,
      paceHint: "sprint",
      facingIntent: faceContestant(self, enemy),
    };
  }

  shouldYield(self: Contestant, world: World): string | null {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return "no-enemy";
    if (surfaceDistance(self, enemy) <= DuelistCharge.ARRIVAL_SURFACE_DIST) {
      return "arrived";
    }
    return null;
  }
}

export class CloseQuarters implements Tactic {
  readonly id = "closequarters";
  readonly minDwell = 1.0;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 35;
  private static readonly BAND = 20;
  private static readonly YIELD_OUT_OF_RANGE = 150;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const dist = surfaceDistance(self, enemy);
    const closeBias =
      dist <= 80 ? 1 : Math.max(0, 1 - (dist - 80) / 70);
    const hp = hp01(self) > 0.3 ? 1 : 0.5;
    return 1.1 * closeBias * hp;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    // Sprint while still well outside the engagement band; otherwise run.
    // The previous forced "walk" let fleeing defenders keep pulling away
    // because red moved at 60 u/s while a backing-up defender ran at ~52.
    const gap = Math.abs(surfaceDistance(self, enemy) - CloseQuarters.RANGE);
    const pace: TacticOutput["paceHint"] = gap > 80 ? "sprint" : "hold";
    return orbitOutput(
      self,
      enemy,
      world,
      CloseQuarters.RANGE,
      CloseQuarters.BAND,
      this.dir,
      pace
    );
  }

  shouldYield(self: Contestant, world: World): string | null {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return "no-enemy";
    if (surfaceDistance(self, enemy) > CloseQuarters.YIELD_OUT_OF_RANGE) {
      return "out-of-range";
    }
    return null;
  }

  maybeCast(
    _dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void {
    if (caster.isCharging()) return;
    const enemy = nearestEnemy(self, world);
    if (!enemy) return;
    const ctx = selectionContext(self, enemy);
    const factory =
      spellbook(self)
        .filter(byTag("melee"))
        .filter(byReady(ctx))
        .find(inRange(ctx.distToTarget)) ?? null;
    if (!factory) return;
    caster.requestCast(factory, enemy, directionTo(self, enemy));
  }
}

export class Sniper implements Tactic {
  readonly id = "sniper";
  readonly minDwell = 4;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 350;
  private static readonly BAND = 50;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const farPreferred = surfaceDistance(self, enemy) > 280 ? 1.3 : 0.6;
    const calm = stamina01(self) > 0.5 ? 1 : 0.6;
    return 0.75 * farPreferred * calm;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Sniper.RANGE, Sniper.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class Turtle implements Tactic {
  readonly id = "turtle";
  readonly minDwell = 4;
  private readonly dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly RANGE = 340;
  private static readonly BAND = 90;

  score(self: Contestant, world: World): number {
    if (!nearestEnemy(self, world)) return 0;
    const hurt = hp01(self) < 0.7 ? 1.2 : 0.8;
    const tired = stamina01(self) < 0.6 ? 1.1 : 0.9;
    return 0.65 * hurt * tired;
  }
  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    return orbitOutput(self, enemy, world, Turtle.RANGE, Turtle.BAND, this.dir);
  }
  maybeCast = tryDefaultCast;
}

export class Scrapper implements Tactic {
  readonly id = "scrapper";
  readonly minDwell = 1.2;
  private flip: 1 | -1 = 1;
  private flipTimer = 0;
  private chaoticRange = 160 + Math.random() * 220;
  private rangeTimer = 0;
  private static readonly FLIP_INTERVAL = 0.8;
  private static readonly RANGE_REROLL_INTERVAL = 2.5;
  private static readonly BAND = 30;

  score(self: Contestant, world: World): number {
    if (!nearestEnemy(self, world)) return 0;
    return 0.35 + Math.random() * 0.3;
  }
  update(dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return idleOutput();
    this.flipTimer -= dt;
    if (this.flipTimer <= 0) {
      this.flip = -this.flip as 1 | -1;
      this.flipTimer = Scrapper.FLIP_INTERVAL;
    }
    this.rangeTimer -= dt;
    if (this.rangeTimer <= 0) {
      this.chaoticRange = 160 + Math.random() * 220;
      this.rangeTimer = Scrapper.RANGE_REROLL_INTERVAL;
    }
    const paceOverride =
      surfaceDistance(self, enemy) > 380 && Math.random() < 0.02
        ? "walk"
        : undefined;
    return orbitOutput(
      self,
      enemy,
      world,
      this.chaoticRange,
      Scrapper.BAND,
      this.flip,
      paceOverride
    );
  }
  maybeCast = tryDefaultCast;
}

type AntiMagePhase = "approach" | "cast" | "rush";

export class AntiMageZone implements Tactic {
  readonly id = "antimage";
  readonly minDwell = 1.0;
  private lastCastAt = 0;
  private phase: AntiMagePhase = "approach";
  private static readonly CAST_SURFACE_RANGE = 180;
  private static readonly APPROACH_SURFACE_RANGE = 140;
  private static readonly APPROACH_BAND = 20;
  private static readonly RUSH_WINDOW_SECONDS = 4;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const dist = surfaceDistance(self, enemy);
    const sweetRange = dist > 60 && dist < 180 ? 1.4 : 0.3;
    const staminaOk = stamina01(self) > 0.5 ? 1 : 0.5;
    const recentCastPenalty =
      (nowMs() - this.lastCastAt) / 1000 < 6 ? 0.15 : 1;
    return 0.75 * sweetRange * staminaOk * recentCastPenalty;
  }

  currentPhaseId(): string {
    return this.phase;
  }

  dodgePolicy(): DodgePolicy {
    return this.phase === "approach" ? "always" : "never";
  }

  shouldYield(self: Contestant, world: World): string | null {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return "no-enemy";
    if (this.phase === "rush" && surfaceDistance(self, enemy) <= 55) {
      return "rush-arrived";
    }
    return null;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) {
      this.phase = "approach";
      return idleOutput();
    }
    const dist = surfaceDistance(self, enemy);
    const sinceCast = (nowMs() - this.lastCastAt) / 1000;
    const inRushWindow =
      this.lastCastAt > 0 && sinceCast < AntiMageZone.RUSH_WINDOW_SECONDS;

    if (inRushWindow) {
      this.phase = "rush";
    } else if (
      dist <= AntiMageZone.CAST_SURFACE_RANGE &&
      this.zoneReady(self)
    ) {
      this.phase = "cast";
    } else {
      this.phase = "approach";
    }

    if (this.phase === "rush") {
      return {
        moveIntent: directionTo(self, enemy),
        paceHint: "sprint",
        facingIntent: faceContestant(self, enemy),
      };
    }
    if (this.phase === "cast") {
      return {
        moveIntent: STATIONARY,
        paceHint: "walk",
        facingIntent: faceContestant(self, enemy),
      };
    }
    return orbitOutput(
      self,
      enemy,
      world,
      AntiMageZone.APPROACH_SURFACE_RANGE,
      AntiMageZone.APPROACH_BAND,
      1
    );
  }

  maybeCast(
    _dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void {
    if (this.phase !== "cast") return;
    if (caster.isCharging()) return;
    const enemy = nearestEnemy(self, world);
    if (!enemy) return;
    const factory = this.pickZoneFactory(self, enemy);
    if (!factory) return;
    if (caster.requestCast(factory, enemy, directionTo(self, enemy))) {
      this.lastCastAt = nowMs();
    }
  }

  private zoneReady(self: Contestant): boolean {
    const book = spellbook(self);
    const t = nowSeconds();
    const w = self as Contestant & {
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    return book.some(
      (f) =>
        f.metadata.tags.includes("zone") &&
        (readyAt.get(f) ?? 0) <= t
    );
  }

  private pickZoneFactory(
    self: Contestant,
    enemy: Contestant
  ): SpellFactory | null {
    const ctx = selectionContext(self, enemy);
    return (
      spellbook(self)
        .filter(byTag("zone"))
        .filter(byReady(ctx))
        .find(inRange(ctx.distToTarget)) ?? null
    );
  }
}

export interface AvoidIncomingOptions {
  mobilityTags?: string[];
  /**
   * Distance to aim a mobility spell. Defaults to 180 (blink-ish).
   * Future mobility spells can override per-spell via a tag lookup.
   */
  mobilityDistance?: number;
}

export class AvoidIncoming implements Tactic {
  readonly id = "avoidincoming";
  readonly minDwell = 0.3;
  private readonly mobilityTags: string[];
  private readonly mobilityDistance: number;

  constructor(opts: AvoidIncomingOptions = {}) {
    this.mobilityTags = opts.mobilityTags ?? ["blink", "teleport"];
    this.mobilityDistance = opts.mobilityDistance ?? 180;
  }

  private readyMobility(self: Contestant): SpellFactory | null {
    const t = nowSeconds();
    const w = self as Contestant & {
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    for (const factory of spellbook(self)) {
      const tags = factory.metadata.tags;
      if (!this.mobilityTags.some((t2) => tags.includes(t2))) continue;
      if ((readyAt.get(factory) ?? 0) > t) continue;
      return factory;
    }
    return null;
  }

  score(self: Contestant, world: World): number {
    if (!hasIncomingProjectile(self, world)) return 0;
    return 3.5;
  }

  dodgePolicy(self: Contestant): DodgePolicy {
    return this.readyMobility(self) ? "never" : "always";
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    const facingIntent = enemy ? faceContestant(self, enemy) : STATIONARY;
    const aim = pickSafeDirection(self, world, {
      distance: 160,
      directions: ringDirections(16),
    });
    if (!aim) {
      return {
        moveIntent: STATIONARY,
        paceHint: "hold",
        facingIntent,
      };
    }
    return {
      moveIntent: aim,
      paceHint: "sprint",
      facingIntent,
    };
  }

  shouldYield(self: Contestant, world: World): string | null {
    if (!hasIncomingProjectile(self, world)) return "no-threat";
    if (!this.readyMobility(self)) {
      // No mobility available — there's no compelling reason to stay in this
      // tactic beyond one movement-planning frame. The selector will put us
      // back here if the threat persists, but other tactics are free to act.
    }
    return null;
  }

  maybeCast(
    _dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void {
    const distance = this.mobilityDistance;
    tryMobilityAway(
      self,
      world,
      caster,
      (f) => this.mobilityTags.some((t) => f.metadata.tags.includes(t)),
      () => distance
    );
  }
}
