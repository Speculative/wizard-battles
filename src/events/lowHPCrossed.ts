import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { EventDetector, GameEvent } from "./event";

export interface LowHPCrossedPayload {
  hp01: number;
  threshold: number;
}

export class LowHPCrossedDetector
  implements EventDetector<LowHPCrossedPayload>
{
  readonly id = "lowHPCrossed";
  private readonly threshold: number;
  private wasAbove = true;

  constructor(threshold = 0.4) {
    this.threshold = threshold;
  }

  detect(
    self: Contestant,
    _world: World
  ): GameEvent<LowHPCrossedPayload> | null {
    const hp01 = self.hp / 100;
    const nowAbove = hp01 > this.threshold;
    if (this.wasAbove && !nowAbove) {
      this.wasAbove = false;
      return {
        id: this.id,
        payload: { hp01, threshold: this.threshold },
      };
    }
    if (nowAbove) this.wasAbove = true;
    return null;
  }
}
