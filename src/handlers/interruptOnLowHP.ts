import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { LowHPCrossedPayload } from "../events/lowHPCrossed";
import type { Handler } from "./handler";
import type { Change } from "./change";

export class InterruptOnLowHPHandler
  implements Handler<LowHPCrossedPayload>
{
  readonly id = "interruptOnLowHP";
  readonly eventId = "lowHPCrossed";
  readonly tier = "reflexive" as const;
  readonly terminal = true;

  handle(
    _self: Contestant,
    event: GameEvent<LowHPCrossedPayload>
  ): Change[] {
    return [
      {
        type: "interrupt",
        reason: `hp<${event.payload.threshold}`,
        priority: this.tier,
      },
    ];
  }
}
