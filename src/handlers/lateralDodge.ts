import * as THREE from "three";
import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { ProjectileIncomingPayload } from "../events/projectileIncoming";
import type { Handler } from "./handler";
import type { Change } from "./change";

export class LateralDodgeHandler
  implements Handler<ProjectileIncomingPayload>
{
  readonly id = "lateralDodge";
  readonly eventId = "projectileIncoming";
  readonly tier = "reflexive" as const;
  readonly terminal = true;

  handle(
    self: Contestant,
    event: GameEvent<ProjectileIncomingPayload>
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
    const direction = new THREE.Vector3(-dz * sign, 0, dx * sign);
    return [
      {
        type: "forceMovementState",
        state: "dodging",
        direction,
        priority: this.tier,
      },
    ];
  }
}
