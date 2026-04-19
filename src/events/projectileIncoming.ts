import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { Spell } from "../spells/spell";
import type { EventDetector, GameEvent } from "./event";

export interface ProjectileIncomingPayload {
  spell: Spell;
  closestApproachSq: number;
  distance: number;
}

const SENSE_RADIUS_BASE = 160;
const ANGLE_COS = 0.85;
const PROJECTILE_RADIUS_ESTIMATE = 12;
const SAFETY_MARGIN = 22;

export class ProjectileIncomingDetector
  implements EventDetector<ProjectileIncomingPayload>
{
  readonly id = "projectileIncoming";
  private eagerness = 1;

  setEagerness(v: number): void {
    this.eagerness = v;
  }

  detect(
    self: Contestant,
    world: World
  ): GameEvent<ProjectileIncomingPayload> | null {
    const senseRadius = SENSE_RADIUS_BASE * this.eagerness;
    const threatThreshold =
      self.radius + PROJECTILE_RADIUS_ESTIMATE + SAFETY_MARGIN;
    const p = self.position;
    const u = self.velocity;

    let bestDist = senseRadius;
    let bestSpell: Spell | null = null;
    let bestClosestSq = 0;

    for (const s of world.spells) {
      if (s.caster === self) continue;
      const vLen = Math.hypot(s.velocity.x, s.velocity.z);
      if (vLen < 1e-3) continue;
      const toMeX = p.x - s.position.x;
      const toMeZ = p.z - s.position.z;
      const toMeLen = Math.hypot(toMeX, toMeZ);
      if (toMeLen < 1e-3 || toMeLen > senseRadius) continue;
      const cos =
        (s.velocity.x * toMeX + s.velocity.z * toMeZ) / (vLen * toMeLen);
      if (cos < ANGLE_COS) continue;

      const relVx = u.x - s.velocity.x;
      const relVz = u.z - s.velocity.z;
      const relVSq = relVx * relVx + relVz * relVz;
      let closestSq: number;
      if (relVSq < 1e-6) {
        closestSq = toMeX * toMeX + toMeZ * toMeZ;
      } else {
        const tMin = Math.max(
          0,
          -(toMeX * relVx + toMeZ * relVz) / relVSq
        );
        const cx = toMeX + relVx * tMin;
        const cz = toMeZ + relVz * tMin;
        closestSq = cx * cx + cz * cz;
      }
      if (closestSq > threatThreshold * threatThreshold) continue;

      if (toMeLen < bestDist) {
        bestDist = toMeLen;
        bestSpell = s;
        bestClosestSq = closestSq;
      }
    }

    if (!bestSpell) return null;
    return {
      id: this.id,
      payload: {
        spell: bestSpell,
        distance: bestDist,
        closestApproachSq: bestClosestSq,
      },
    };
  }
}
