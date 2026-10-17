import { Vector3 } from "../math";
import type { Contestant } from "./contestant";

const AIM_NOISE_SIGMA_MAX = 0.2;
const AIM_NOISE_SIGMA_MIN = 0.02;
const AIM_NOISE_DECAY_SHOTS = 25;

function gaussian(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Predictive lead plus seeded learning noise; called only at release. */
export function computeAimSolution(
  origin: Vector3, target: Contestant, projectileSpeed: number,
  noiseScale: number, shotsFired: number, random: () => number
): { direction: Vector3; leadX: number; leadZ: number; leadDistance: number } {
    const dx = target.position.x - origin.x;
    const dz = target.position.z - origin.z;
    const vx = target.velocity.x;
    const vz = target.velocity.z;
    const s = projectileSpeed;
    const a = vx * vx + vz * vz - s * s;
    const b = 2 * (dx * vx + dz * vz);
    const c = dx * dx + dz * dz;

    let leadX = dx;
    let leadZ = dz;
    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) > 1e-6) {
        const t = -c / b;
        if (t > 0) {
          leadX = dx + vx * t;
          leadZ = dz + vz * t;
        }
      }
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        let t = Infinity;
        if (t1 > 0) t = t1;
        if (t2 > 0 && t2 < t) t = t2;
        if (Number.isFinite(t)) {
          leadX = dx + vx * t;
          leadZ = dz + vz * t;
        }
      }
    }

    const sigma =
      (AIM_NOISE_SIGMA_MIN +
        (AIM_NOISE_SIGMA_MAX - AIM_NOISE_SIGMA_MIN) *
          Math.exp(-shotsFired / AIM_NOISE_DECAY_SHOTS)) *
      noiseScale;
    const noise = sigma > 0 ? gaussian(random) * sigma : 0;
    const cos = Math.cos(noise);
    const sin = Math.sin(noise);
    const rx = leadX * cos - leadZ * sin;
    const rz = leadX * sin + leadZ * cos;
    const leadDistance = Math.hypot(leadX, leadZ);
    return {
      direction: new Vector3(rx, 0, rz),
      leadX,
      leadZ,
      leadDistance,
    };
}
