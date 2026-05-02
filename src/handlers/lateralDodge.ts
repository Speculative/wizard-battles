import * as THREE from "three";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { GameEvent } from "../events/event";
import type { ProjectileIncomingPayload } from "../events/projectileIncoming";
import type { Handler } from "./handler";
import type { Change } from "./change";
import {
  arcDirections,
  pickSafeDirection,
} from "../tactics/helpers";

const DODGE_REACH = 75;
const DODGE_ARC = Math.PI / 3;
const DODGE_ARC_SAMPLES = 7;

export class LateralDodgeHandler
  implements Handler<ProjectileIncomingPayload>
{
  readonly id = "lateralDodge";
  readonly eventId = "projectileIncoming";
  readonly tier = "reflexive" as const;
  readonly terminal = true;

  handle(
    self: Contestant,
    event: GameEvent<ProjectileIncomingPayload>,
    world: World
  ): Change[] {
    const spell = event.payload.spell;
    const vLen = Math.hypot(spell.velocity.x, spell.velocity.z);
    if (vLen < 1e-3) return [];
    const dx = spell.velocity.x / vLen;
    const dz = spell.velocity.z / vLen;
    const relX = self.position.x - spell.position.x;
    const relZ = self.position.z - spell.position.z;
    const side = dx * relZ - dz * relX;
    const sign = side >= 0 ? 1 : -1;
    const perp = { x: -dz * sign, z: dx * sign };
    const directions = arcDirections(perp, DODGE_ARC, DODGE_ARC_SAMPLES);
    const aim =
      pickSafeDirection(self, world, {
        distance: DODGE_REACH,
        directions,
      }) ?? perp;
    const direction = new THREE.Vector3(aim.x, 0, aim.z);
    return [
      {
        type: "forceMovementState",
        state: "dashing",
        direction,
        priority: this.tier,
      },
    ];
  }
}
