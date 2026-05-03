import type { Contestant } from "../contestants/contestant";
import type { SpellFactory, SpellModifier } from "../spells/spell";
import type { World } from "../world";
import { type Vec2 } from "../steering";
import type { CastController, PaceHint } from "./tactic";
import { STATIONARY } from "./tactic";
import type { SelectionContext } from "../spells/selection";
import { ARENA } from "../config";
import { nowSeconds } from "../clock";
import { ProjectileIncomingDetector } from "../events/projectileIncoming";

export interface Candidate {
  pos: Vec2;
  score: number;
}

export interface WizardAccessors {
  stamina01?: () => number;
  hp01?: () => number;
  getShotsFired?: () => number;
  getSpellbook?: () => readonly SpellFactory[];
  getModifiers?: () => readonly SpellModifier[];
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

export function modifiers(self: Contestant): readonly SpellModifier[] {
  const w = self as Contestant & WizardAccessors;
  return w.getModifiers ? w.getModifiers() : [];
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
    nowSeconds: nowSeconds(),
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

export function faceContestant(self: Contestant, other: Contestant): Vec2 {
  return directionFromTo(
    { x: self.position.x, z: self.position.z },
    { x: other.position.x, z: other.position.z }
  );
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

// --- Candidate sampling ---

export function sampleRing(
  center: Vec2,
  radius: number,
  count = 24,
  angleOffset = 0
): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const a = angleOffset + (i / count) * Math.PI * 2;
    out.push({
      pos: {
        x: center.x + Math.cos(a) * radius,
        z: center.z + Math.sin(a) * radius,
      },
      score: 0,
    });
  }
  return out;
}

export function sampleRingAroundEnemy(
  self: Contestant,
  enemy: Contestant,
  preferredSurfaceRange: number,
  count = 24
): Candidate[] {
  const centerRange = preferredSurfaceRange + self.radius + enemy.radius;
  return sampleRing(
    { x: enemy.position.x, z: enemy.position.z },
    centerRange,
    count
  );
}

export function sampleRingAroundSelf(
  self: Contestant,
  radius: number,
  count = 16
): Candidate[] {
  return sampleRing(
    { x: self.position.x, z: self.position.z },
    radius,
    count
  );
}

export function singleCandidate(pos: Vec2): Candidate[] {
  return [{ pos, score: 0 }];
}

// --- Scoring combinators ---

export function score(
  candidates: Candidate[],
  fn: (c: Candidate) => number
): Candidate[] {
  for (const c of candidates) c.score += fn(c);
  return candidates;
}

export function scoreByWallClearance(
  candidates: Candidate[],
  weight = 1.8,
  horizon = 140,
  bounds: { width: number; depth: number } = ARENA
): Candidate[] {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  return score(candidates, (c) => {
    const d = Math.min(
      halfW - c.pos.x,
      halfW + c.pos.x,
      halfD - c.pos.z,
      halfD + c.pos.z
    );
    if (d >= horizon) return 0;
    const closeness = Math.max(0, 1 - d / horizon);
    return -weight * closeness * closeness * closeness;
  });
}

export function scoreByArenaCenter(
  candidates: Candidate[],
  weight = 0.25,
  bounds: { width: number; depth: number } = ARENA
): Candidate[] {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  const maxDist = Math.hypot(halfW, halfD);
  return score(candidates, (c) => {
    const d = Math.hypot(c.pos.x, c.pos.z);
    return weight * (1 - d / maxDist);
  });
}

export function scoreByReachability(
  candidates: Candidate[],
  self: Contestant,
  weight = 0.1,
  falloff = 300
): Candidate[] {
  const sx = self.position.x;
  const sz = self.position.z;
  return score(candidates, (c) => {
    const d = Math.hypot(c.pos.x - sx, c.pos.z - sz);
    return -weight * Math.min(1, d / falloff);
  });
}

export function scoreByAngularPreference(
  candidates: Candidate[],
  center: Vec2,
  preferredDir: Vec2,
  weight = 0.35
): Candidate[] {
  const pLen = Math.hypot(preferredDir.x, preferredDir.z);
  if (pLen < 1e-4) return candidates;
  const px = preferredDir.x / pLen;
  const pz = preferredDir.z / pLen;
  return score(candidates, (c) => {
    const dx = c.pos.x - center.x;
    const dz = c.pos.z - center.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return 0;
    return weight * ((dx / len) * px + (dz / len) * pz);
  });
}

export function scoreByRangeMatch(
  candidates: Candidate[],
  self: Contestant,
  enemy: Contestant,
  preferredSurfaceRange: number,
  band: number,
  weight = 0.5
): Candidate[] {
  const target = preferredSurfaceRange + self.radius + enemy.radius;
  const ex = enemy.position.x;
  const ez = enemy.position.z;
  return score(candidates, (c) => {
    const d = Math.hypot(c.pos.x - ex, c.pos.z - ez);
    const gap = Math.abs(d - target);
    if (gap <= band) return weight;
    return weight * Math.max(0, 1 - (gap - band) / Math.max(1, band));
  });
}

/**
 * Soft variant of scoreByRangeMatch: gradient never goes flat.
 * Even candidates far from the target range get a tilt toward the target.
 * Useful for tactics that may be sampled near self (within commit radius)
 * when target range is far away — the harsh band-clipped scorer gives 0
 * for all near-self candidates and loses directional information.
 */
export function scoreByRangeMatchSoft(
  candidates: Candidate[],
  self: Contestant,
  enemy: Contestant,
  preferredSurfaceRange: number,
  weight = 0.6,
  scale = 120
): Candidate[] {
  const target = preferredSurfaceRange + self.radius + enemy.radius;
  const ex = enemy.position.x;
  const ez = enemy.position.z;
  return score(candidates, (c) => {
    const d = Math.hypot(c.pos.x - ex, c.pos.z - ez);
    const err = Math.abs(d - target);
    return weight * (1 - Math.tanh(err / scale));
  });
}

export function scoreAwayFromEnemiesPublic(
  candidates: Candidate[],
  self: Contestant,
  world: World,
  weight = 0.4,
  horizon = 200
): Candidate[] {
  return score(candidates, (c) => {
    let nearest = Infinity;
    for (const other of world.contestants) {
      if (other === self || !other.alive) continue;
      const d = Math.hypot(
        c.pos.x - other.position.x,
        c.pos.z - other.position.z
      );
      if (d < nearest) nearest = d;
    }
    if (!Number.isFinite(nearest)) return 0;
    return weight * Math.min(1, nearest / horizon);
  });
}

export function scoreAwayFromProjectiles(
  candidates: Candidate[],
  self: Contestant,
  world: World,
  weight = 0.6,
  horizon = 180
): Candidate[] {
  interface Threat {
    sx: number;
    sz: number;
    vx: number;
    vz: number;
    speed: number;
  }
  const threats: Threat[] = [];
  for (const s of world.spells) {
    if (s.caster === self) continue;
    if (s.metadata.kind !== "projectile") continue;
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (speed < 1e-3) continue;
    threats.push({
      sx: s.position.x,
      sz: s.position.z,
      vx: s.velocity.x / speed,
      vz: s.velocity.z / speed,
      speed,
    });
  }
  if (threats.length === 0) return candidates;
  return score(candidates, (c) => {
    let penalty = 0;
    for (const t of threats) {
      const dx = c.pos.x - t.sx;
      const dz = c.pos.z - t.sz;
      const along = dx * t.vx + dz * t.vz;
      if (along < 0) continue;
      const perp = Math.hypot(
        dx - along * t.vx,
        dz - along * t.vz
      );
      if (perp > horizon) continue;
      const closeness = 1 - perp / horizon;
      penalty += closeness * closeness;
    }
    return -weight * penalty;
  });
}

export function pickBest(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].score > best.score) best = candidates[i];
  }
  return best;
}

export function steerToward(self: Contestant, dest: Vec2): Vec2 {
  const dx = dest.x - self.position.x;
  const dz = dest.z - self.position.z;
  const len = Math.hypot(dx, dz);
  if (len < 8) return STATIONARY;
  return { x: dx / len, z: dz / len };
}

const sharedProjectileDetector = new ProjectileIncomingDetector();

function scoreAwayFromEnemies(
  candidates: Candidate[],
  self: Contestant,
  world: World,
  weight = 0.8,
  horizon = 400
): Candidate[] {
  return score(candidates, (c) => {
    let best = 0;
    for (const other of world.contestants) {
      if (other === self || !other.alive) continue;
      const d = Math.hypot(
        c.pos.x - other.position.x,
        c.pos.z - other.position.z
      );
      const gain = Math.min(1, d / horizon);
      if (gain > best) best = gain;
    }
    return weight * best;
  });
}

export interface SafeDestinationOptions {
  distance: number;
  directions: Vec2[];
  projectileWeight?: number;
  enemyWeight?: number;
  wallWeight?: number;
  centerWeight?: number;
}

export function pickSafeDirection(
  self: Contestant,
  world: World,
  options: SafeDestinationOptions
): Vec2 | null {
  const {
    distance,
    directions,
    projectileWeight = 1.5,
    enemyWeight = 0.8,
    wallWeight = 1.6,
    centerWeight = 0.3,
  } = options;
  if (directions.length === 0) return null;
  const candidates: Candidate[] = directions.map((d) => ({
    pos: {
      x: self.position.x + d.x * distance,
      z: self.position.z + d.z * distance,
    },
    score: 0,
  }));
  let scored = scoreAwayFromProjectiles(
    candidates,
    self,
    world,
    projectileWeight,
    220
  );
  scored = scoreAwayFromEnemies(scored, self, world, enemyWeight);
  scored = scoreByWallClearance(scored, wallWeight, 140);
  scored = scoreByArenaCenter(scored, centerWeight);
  const best = pickBest(scored);
  if (!best) return null;
  const idx = scored.indexOf(best);
  return directions[idx];
}

export function ringDirections(count: number, angleOffset = 0): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = angleOffset + (i / count) * Math.PI * 2;
    out.push({ x: Math.cos(a), z: Math.sin(a) });
  }
  return out;
}

export function arcDirections(
  center: Vec2,
  halfArcRadians: number,
  count: number
): Vec2[] {
  const len = Math.hypot(center.x, center.z);
  if (len < 1e-4) return ringDirections(count);
  const cx = center.x / len;
  const cz = center.z / len;
  const baseAngle = Math.atan2(cz, cx);
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const a = baseAngle + t * halfArcRadians;
    out.push({ x: Math.cos(a), z: Math.sin(a) });
  }
  return out;
}

export interface MobilityCandidate {
  factory: SpellFactory;
  distance: number;
}

export function findReadyMobility(
  self: Contestant,
  caster: CastController,
  tagFilter: (f: SpellFactory) => boolean,
  distanceOf: (f: SpellFactory) => number
): MobilityCandidate | null {
  for (const factory of spellbook(self)) {
    if (!tagFilter(factory)) continue;
    if (!caster.isReady(factory)) continue;
    return { factory, distance: distanceOf(factory) };
  }
  return null;
}

export function hasIncomingProjectile(
  self: Contestant,
  world: World
): boolean {
  return sharedProjectileDetector.detect(self, world) !== null;
}

export function tryMobilityAway(
  self: Contestant,
  world: World,
  caster: CastController,
  tagFilter: (f: SpellFactory) => boolean,
  distanceOf: (f: SpellFactory) => number
): boolean {
  if (caster.isCharging()) return false;
  const mobility = findReadyMobility(self, caster, tagFilter, distanceOf);
  if (!mobility) return false;
  const aim = pickSafeDirection(self, world, {
    distance: mobility.distance,
    directions: ringDirections(16),
  });
  if (!aim) return false;
  return caster.requestCast(mobility.factory, null, aim);
}
