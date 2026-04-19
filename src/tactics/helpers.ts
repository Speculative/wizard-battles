import type { Contestant } from "../contestants/contestant";
import type { SpellFactory } from "../spells/spell";
import type { World } from "../world";
import { circle, seek, type Vec2 } from "../steering";
import type { CastController, PaceHint } from "./tactic";
import { STATIONARY } from "./tactic";
import type { SelectionContext } from "../spells/selection";

export interface WizardAccessors {
  stamina01?: () => number;
  hp01?: () => number;
  getShotsFired?: () => number;
  getSpellbook?: () => readonly SpellFactory[];
  getReadyAt?: () => Map<SpellFactory, number>;
}

export function stamina01(self: Contestant): number {
  const w = self as Contestant & WizardAccessors;
  return w.stamina01 ? w.stamina01() : 1;
}

export function hp01(self: Contestant): number {
  const w = self as Contestant & WizardAccessors;
  return w.hp01 ? w.hp01() : self.hp / 100;
}

export function shotsFired(self: Contestant): number {
  const w = self as Contestant & WizardAccessors;
  return w.getShotsFired ? w.getShotsFired() : 0;
}

export function spellbook(self: Contestant): readonly SpellFactory[] {
  const w = self as Contestant & WizardAccessors;
  return w.getSpellbook ? w.getSpellbook() : [];
}

export function selectionContext(
  self: Contestant,
  target: Contestant
): SelectionContext {
  const w = self as Contestant & WizardAccessors;
  return {
    self,
    target,
    distToTarget: surfaceDistance(self, target),
    readyAt: w.getReadyAt ? w.getReadyAt() : new Map(),
    nowSeconds: performance.now() / 1000,
  };
}

export function nearestEnemy(self: Contestant, world: World): Contestant | null {
  let best: Contestant | null = null;
  let bestDist = Infinity;
  for (const c of world.contestants) {
    if (c === self || !c.alive) continue;
    const dx = c.position.x - self.position.x;
    const dz = c.position.z - self.position.z;
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function centerDistance(a: Contestant, b: Contestant): number {
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  return Math.hypot(dx, dz);
}

export function surfaceDistance(a: Contestant, b: Contestant): number {
  return Math.max(0, centerDistance(a, b) - a.radius - b.radius);
}

export function directionFromTo(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

function posOf(c: Contestant): Vec2 {
  return { x: c.position.x, z: c.position.z };
}

export function orbit(
  self: Contestant,
  target: Contestant,
  preferredSurfaceRange: number,
  band: number,
  dir: -1 | 1
): Vec2 {
  const centerRange = preferredSurfaceRange + self.radius + target.radius;
  return circle(posOf(self), posOf(target), centerRange, dir, band);
}

export function closeTo(
  self: Contestant,
  target: Contestant,
  minSurfaceDist: number
): Vec2 {
  const surf = surfaceDistance(self, target);
  if (surf <= minSurfaceDist) return STATIONARY;
  return seek(posOf(self), posOf(target));
}

export function backOffFrom(
  self: Contestant,
  target: Contestant,
  minSurfaceDist: number
): Vec2 {
  const surf = surfaceDistance(self, target);
  if (surf >= minSurfaceDist) return STATIONARY;
  const s = seek(posOf(self), posOf(target));
  return { x: -s.x, z: -s.z };
}

export function holdPosition(): Vec2 {
  return STATIONARY;
}

export function faceContestant(self: Contestant, other: Contestant): Vec2 {
  return directionFromTo(posOf(self), posOf(other));
}

export function faceVector(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  if (len < 1e-4) return STATIONARY;
  return { x: v.x / len, z: v.z / len };
}

export function holdFacing(): Vec2 {
  return STATIONARY;
}

export function paceForRange(
  surfaceDist: number,
  preferredRange: number,
  band: number,
  sprintOutsideGap = 100
): PaceHint {
  const gap = Math.abs(surfaceDist - preferredRange);
  if (gap > sprintOutsideGap) return "sprint";
  if (gap < band + 20) return "walk";
  return "hold";
}

export function tryRequestCastIfReady(
  caster: CastController,
  factory: SpellFactory,
  target: Contestant | null,
  aim: Vec2
): boolean {
  if (caster.isCharging()) return false;
  if (!caster.isReady(factory)) return false;
  return caster.requestCast(factory, target, aim);
}
