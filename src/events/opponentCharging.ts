import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { EventDetector, GameEvent } from "./event";
import { Charging } from "../components";

export interface OpponentChargingPayload {
  opponent: Contestant;
  remaining: number;
  totalDuration: number;
}

export class OpponentChargingDetector
  implements EventDetector<OpponentChargingPayload>
{
  readonly id = "opponentCharging";

  detect(
    self: Contestant,
    world: World
  ): GameEvent<OpponentChargingPayload> | null {
    for (const c of world.contestants) {
      if (c === self || !c.alive) continue;
      const charging = c.getComponent(Charging);
      if (!charging) continue;
      if (charging.target && charging.target !== self) continue;
      return {
        id: this.id,
        payload: {
          opponent: c,
          remaining: charging.remaining,
          totalDuration: charging.totalDuration,
        },
      };
    }
    return null;
  }
}
