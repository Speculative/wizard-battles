import * as THREE from "three";
import type { ARENA } from "./config";

export interface Vec2 {
  x: number;
  z: number;
}

const EPS = 1e-4;

export function zero(): Vec2 {
  return { x: 0, z: 0 };
}

export function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.z);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  if (len < EPS) return { x: 0, z: 0 };
  return { x: v.x / len, z: v.z / len };
}

export function seek(from: Vec2, to: Vec2, speed = 1): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < EPS) return { x: 0, z: 0 };
  return { x: (dx / len) * speed, z: (dz / len) * speed };
}

export function flee(from: Vec2, threat: Vec2, speed = 1): Vec2 {
  const s = seek(from, threat, speed);
  return { x: -s.x, z: -s.z };
}

export function arrive(from: Vec2, to: Vec2, slowDist: number, speed = 1): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < EPS) return { x: 0, z: 0 };
  const scale = Math.min(1, dist / Math.max(slowDist, EPS));
  return { x: (dx / dist) * speed * scale, z: (dz / dist) * speed * scale };
}

export function pursue(
  from: Vec2,
  target: Vec2,
  targetVel: Vec2,
  leadTime: number,
  speed = 1
): Vec2 {
  const pred: Vec2 = {
    x: target.x + targetVel.x * leadTime,
    z: target.z + targetVel.z * leadTime,
  };
  return seek(from, pred, speed);
}

export function evade(
  from: Vec2,
  threat: Vec2,
  threatVel: Vec2,
  leadTime: number,
  speed = 1
): Vec2 {
  const pred: Vec2 = {
    x: threat.x + threatVel.x * leadTime,
    z: threat.z + threatVel.z * leadTime,
  };
  return flee(from, pred, speed);
}

export function circle(
  from: Vec2,
  center: Vec2,
  radius: number,
  dir: 1 | -1,
  band: number,
  speed = 1
): Vec2 {
  const dx = center.x - from.x;
  const dz = center.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < EPS) return { x: 0, z: 0 };
  const nx = dx / dist;
  const nz = dz / dist;
  const tx = -nz * dir;
  const tz = nx * dir;
  const diff = dist - radius;
  let radial: number;
  if (Math.abs(diff) < band) {
    radial = 0;
  } else {
    const over = Math.abs(diff) - band;
    const mag = Math.min(1, over / 60);
    radial = diff > 0 ? mag : -mag;
  }
  const tangential = Math.sqrt(Math.max(0, 1 - radial * radial));
  return {
    x: (nx * radial + tx * tangential) * speed,
    z: (nz * radial + tz * tangential) * speed,
  };
}

export function wallRepulsion(
  from: Vec2,
  bounds: typeof ARENA,
  threshold: number,
  speed = 1
): Vec2 {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  let fx = 0;
  let fz = 0;
  const dLeft = from.x - -halfW;
  const dRight = halfW - from.x;
  const dBack = from.z - -halfD;
  const dFront = halfD - from.z;
  if (dLeft < threshold) fx += (1 - dLeft / threshold) * speed;
  if (dRight < threshold) fx -= (1 - dRight / threshold) * speed;
  if (dBack < threshold) fz += (1 - dBack / threshold) * speed;
  if (dFront < threshold) fz -= (1 - dFront / threshold) * speed;
  return { x: fx, z: fz };
}

export function toVector3(v: Vec2, out: THREE.Vector3): void {
  const len = Math.hypot(v.x, v.z);
  if (len < EPS) {
    out.set(0, 0, 0);
    return;
  }
  out.set(v.x / len, 0, v.z / len);
}

export interface SampleContext {
  pos: Vec2;
  speed: number;
  intent: Vec2;
  bounds: typeof ARENA;
  wallHorizon: number;
  intentWeight: number;
  wallWeight: number;
}

export interface SampleDebug {
  intentX: number;
  intentZ: number;
  pickedX: number;
  pickedZ: number;
  intentWallPenalty: number;
  pickedWallPenalty: number;
  pickedAlignment: number;
  nearestWallDist: number;
}

export function sampleBestDirection(
  ctx: SampleContext,
  sampleCount = 16,
  debugOut?: SampleDebug
): Vec2 {
  const intentLen = magnitude(ctx.intent);
  if (intentLen < EPS) return { x: 0, z: 0 };
  const ix = ctx.intent.x / intentLen;
  const iz = ctx.intent.z / intentLen;

  const intentWallDist = timeToWall(ctx.pos, { x: ix, z: iz }, ctx.bounds);
  const intentCloseness = 1 - Math.min(1, intentWallDist / ctx.wallHorizon);
  const intentWallPenalty =
    intentCloseness * intentCloseness * intentCloseness;

  let bestScore = -Infinity;
  let bestX = ix;
  let bestZ = iz;
  let bestAlignment = 1;
  let bestWallPenalty = 0;
  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const alignment = dx * ix + dz * iz;
    const wallDist = timeToWall(ctx.pos, { x: dx, z: dz }, ctx.bounds);
    const closeness = 1 - Math.min(1, wallDist / ctx.wallHorizon);
    const wallPenalty = closeness * closeness * closeness;
    const score = ctx.intentWeight * alignment - ctx.wallWeight * wallPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestX = dx;
      bestZ = dz;
      bestAlignment = alignment;
      bestWallPenalty = wallPenalty;
    }
  }
  if (debugOut) {
    debugOut.intentX = ix;
    debugOut.intentZ = iz;
    debugOut.pickedX = bestX;
    debugOut.pickedZ = bestZ;
    debugOut.intentWallPenalty = intentWallPenalty;
    debugOut.pickedWallPenalty = bestWallPenalty;
    debugOut.pickedAlignment = bestAlignment;
    debugOut.nearestWallDist = nearestWallDist(ctx.pos, ctx.bounds);
  }
  return { x: bestX, z: bestZ };
}

function nearestWallDist(pos: Vec2, bounds: typeof ARENA): number {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  return Math.min(
    halfW - pos.x,
    halfW + pos.x,
    halfD - pos.z,
    halfD + pos.z
  );
}

function timeToWall(pos: Vec2, dir: Vec2, bounds: typeof ARENA): number {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  let tMin = Infinity;
  if (dir.x > EPS) {
    const t = (halfW - pos.x) / dir.x;
    if (t > 0) tMin = Math.min(tMin, t);
  } else if (dir.x < -EPS) {
    const t = (-halfW - pos.x) / dir.x;
    if (t > 0) tMin = Math.min(tMin, t);
  }
  if (dir.z > EPS) {
    const t = (halfD - pos.z) / dir.z;
    if (t > 0) tMin = Math.min(tMin, t);
  } else if (dir.z < -EPS) {
    const t = (-halfD - pos.z) / dir.z;
    if (t > 0) tMin = Math.min(tMin, t);
  }
  return tMin === Infinity ? bounds.width : tMin;
}
