import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { OpponentChargingPayload } from "../events/opponentCharging";
import type { Handler } from "./handler";
import type { Change } from "./change";

export class NoteOpponentChargingHandler
  implements Handler<OpponentChargingPayload>
{
  readonly id = "noteOpponentCharging";
  readonly eventId = "opponentCharging";
  readonly tier = "observational" as const;
  readonly terminal = false;

  handle(
    _self: Contestant,
    event: GameEvent<OpponentChargingPayload>
  ): Change[] {
    return [
      {
        type: "observe",
        key: "opponentChargingRemaining",
        value: event.payload.remaining,
        priority: this.tier,
      },
    ];
  }
}
