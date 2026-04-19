import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { SpellFactory } from "../spells/spell";
import { SuppressDodgeHandler } from "../handlers/suppressDodge";
import type { Handler } from "../handlers/handler";
import { byTag, byReady, inRange } from "../spells/selection";
import {
  faceContestant,
  nearestEnemy,
  orbit,
  surfaceDistance,
} from "./helpers";
import type { CastController, Tactic, TacticOutput } from "./plan";
import { STATIONARY } from "./plan";

function directionToEnemy(self: Contestant, enemy: Contestant): {
  x: number;
  z: number;
} {
  return {
    x: enemy.position.x - self.position.x,
    z: enemy.position.z - self.position.z,
  };
}

export class Orbit implements Tactic {
  readonly id = "orbit";
  readonly minDwell = 3;
  private readonly circleSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private static readonly PREFERRED_SURFACE_RANGE = 270;
  private static readonly BAND = 70;

  score(self: Contestant, world: World): number {
    return nearestEnemy(self, world) ? 0.5 : 0;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) {
      return {
        moveIntent: STATIONARY,
        paceHint: "hold",
        facingIntent: STATIONARY,
      };
    }
    return {
      moveIntent: orbit(
        self,
        enemy,
        Orbit.PREFERRED_SURFACE_RANGE,
        Orbit.BAND,
        this.circleSign
      ),
      paceHint: "hold",
      facingIntent: faceContestant(self, enemy),
    };
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
    const w = self as Contestant & {
      getSpellbook?: () => readonly SpellFactory[];
    };
    const book = w.getSpellbook ? w.getSpellbook() : [];
    const dist = surfaceDistance(self, enemy);
    const factory = book.find(
      (f) =>
        caster.isReady(f) &&
        dist >= f.metadata.range.min &&
        dist <= f.metadata.range.max
    );
    if (!factory) return;
    caster.requestCast(factory, enemy, {
      x: enemy.position.x - self.position.x,
      z: enemy.position.z - self.position.z,
    });
  }
}

type DuelistPhase = "close" | "strike";

export class DuelistCharge implements Tactic {
  readonly id = "duelist";
  readonly minDwell = 3.5;
  readonly handlers: Handler[] = [new SuppressDodgeHandler()];
  private phase: DuelistPhase = "close";
  private static readonly STRIKE_SURFACE_DIST = 50;
  private static readonly RESET_SURFACE_DIST = 90;

  score(self: Contestant, world: World): number {
    const enemy = nearestEnemy(self, world);
    if (!enemy) return 0;
    const w = self as Contestant & { hp01?: () => number };
    const hp01 = w.hp01 ? w.hp01() : self.hp / 100;
    const hp = hp01 > 0.35 ? 1 : 0.3;
    const enemyWounded = 1.5 - enemy.hp / 100;
    return 0.75 * hp * enemyWounded;
  }

  currentPhaseId(): string {
    return this.phase;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) {
      this.phase = "close";
      return {
        moveIntent: STATIONARY,
        paceHint: "hold",
        facingIntent: STATIONARY,
      };
    }
    const dist = surfaceDistance(self, enemy);
    if (this.phase === "close" && dist <= DuelistCharge.STRIKE_SURFACE_DIST) {
      this.phase = "strike";
    } else if (
      this.phase === "strike" &&
      dist > DuelistCharge.RESET_SURFACE_DIST
    ) {
      this.phase = "close";
    }

    if (this.phase === "close") {
      return {
        moveIntent: {
          x: enemy.position.x - self.position.x,
          z: enemy.position.z - self.position.z,
        },
        paceHint: "sprint",
        facingIntent: faceContestant(self, enemy),
      };
    }
    return {
      moveIntent: {
        x: enemy.position.x - self.position.x,
        z: enemy.position.z - self.position.z,
      },
      paceHint: "walk",
      facingIntent: faceContestant(self, enemy),
    };
  }

  maybeCast(
    _dt: number,
    self: Contestant,
    world: World,
    caster: CastController
  ): void {
    if (this.phase !== "strike") return;
    if (caster.isCharging()) return;
    const enemy = nearestEnemy(self, world);
    if (!enemy) return;
    const w = self as Contestant & {
      getSpellbook?: () => readonly SpellFactory[];
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const book = w.getSpellbook ? w.getSpellbook() : [];
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    const nowSeconds = performance.now() / 1000;
    const ctx = {
      self,
      target: enemy,
      distToTarget: surfaceDistance(self, enemy),
      readyAt,
      nowSeconds,
    };
    const factory =
      book
        .filter(byTag("melee"))
        .filter(byReady(ctx))
        .find(inRange(ctx.distToTarget)) ?? null;
    if (!factory) return;
    caster.requestCast(factory, enemy, {
      x: enemy.position.x - self.position.x,
      z: enemy.position.z - self.position.z,
    });
  }
}

type AntiMagePhase = "approach" | "cast" | "rush";

export class AntiMageZone implements Tactic {
  readonly id = "antimage";
  readonly minDwell = 1.0;
  readonly handlers: Handler[] = [new SuppressDodgeHandler()];
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
    const w = self as Contestant & { stamina01?: () => number };
    const stamina01 = w.stamina01 ? w.stamina01() : 1;
    const staminaOk = stamina01 > 0.5 ? 1 : 0.5;
    const recentCastPenalty =
      (performance.now() - this.lastCastAt) / 1000 < 6 ? 0.15 : 1;
    return 0.75 * sweetRange * staminaOk * recentCastPenalty;
  }

  currentPhaseId(): string {
    return this.phase;
  }

  update(_dt: number, self: Contestant, world: World): TacticOutput {
    const enemy = nearestEnemy(self, world);
    if (!enemy) {
      this.phase = "approach";
      return {
        moveIntent: STATIONARY,
        paceHint: "hold",
        facingIntent: STATIONARY,
      };
    }
    const dist = surfaceDistance(self, enemy);
    const sinceCast = (performance.now() - this.lastCastAt) / 1000;
    const inRushWindow =
      this.lastCastAt > 0 && sinceCast < AntiMageZone.RUSH_WINDOW_SECONDS;

    if (inRushWindow) {
      this.phase = "rush";
    } else if (dist <= AntiMageZone.CAST_SURFACE_RANGE && this.zoneReady(self)) {
      this.phase = "cast";
    } else {
      this.phase = "approach";
    }

    if (this.phase === "rush") {
      return {
        moveIntent: directionToEnemy(self, enemy),
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
    return {
      moveIntent: orbit(
        self,
        enemy,
        AntiMageZone.APPROACH_SURFACE_RANGE,
        AntiMageZone.APPROACH_BAND,
        1
      ),
      paceHint: "hold",
      facingIntent: faceContestant(self, enemy),
    };
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
    if (caster.requestCast(factory, enemy, directionToEnemy(self, enemy))) {
      this.lastCastAt = performance.now();
    }
  }

  private zoneReady(self: Contestant): boolean {
    const w = self as Contestant & {
      getSpellbook?: () => readonly SpellFactory[];
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const book = w.getSpellbook ? w.getSpellbook() : [];
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    const nowSeconds = performance.now() / 1000;
    return book.some(
      (f) =>
        f.metadata.tags.includes("zone") &&
        (readyAt.get(f) ?? 0) <= nowSeconds
    );
  }

  private pickZoneFactory(
    self: Contestant,
    enemy: Contestant
  ): SpellFactory | null {
    const w = self as Contestant & {
      getSpellbook?: () => readonly SpellFactory[];
      getReadyAt?: () => Map<SpellFactory, number>;
    };
    const book = w.getSpellbook ? w.getSpellbook() : [];
    const readyAt = w.getReadyAt ? w.getReadyAt() : new Map();
    const nowSeconds = performance.now() / 1000;
    const ctx = {
      self,
      target: enemy,
      distToTarget: surfaceDistance(self, enemy),
      readyAt,
      nowSeconds,
    };
    return (
      book
        .filter(byTag("zone"))
        .filter(byReady(ctx))
        .find(inRange(ctx.distToTarget)) ?? null
    );
  }
}
