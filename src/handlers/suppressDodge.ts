import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { ProjectileIncomingPayload } from "../events/projectileIncoming";
import type { Handler } from "./handler";
import type { Change } from "./change";

/**
 * A terminal handler for ProjectileIncoming that emits no Change.
 * Because the pipeline sorts handlers by tier (stable) and stops at the first
 * terminal handler for an event, binding this as a tactic-owned handler
 * preempts the common LateralDodge and keeps the wizard committed to whatever
 * the current tactic was doing.
 */
export class SuppressDodgeHandler
  implements Handler<ProjectileIncomingPayload>
{
  readonly id = "suppressDodge";
  readonly eventId = "projectileIncoming";
  readonly tier = "reflexive" as const;
  readonly terminal = true;

  handle(
    _self: Contestant,
    _event: GameEvent<ProjectileIncomingPayload>
  ): Change[] {
    return [];
  }
}
