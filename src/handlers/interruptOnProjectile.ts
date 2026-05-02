import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { ProjectileIncomingPayload } from "../events/projectileIncoming";
import type { Handler } from "./handler";
import type { Change } from "./change";

export class InterruptOnProjectileHandler
  implements Handler<ProjectileIncomingPayload>
{
  readonly id = "interruptOnProjectile";
  readonly eventId = "projectileIncoming";
  readonly tier = "reflexive" as const;
  readonly terminal = false;

  handle(
    _self: Contestant,
    _event: GameEvent<ProjectileIncomingPayload>
  ): Change[] {
    return [
      {
        type: "interrupt",
        reason: "projectile-incoming",
        priority: this.tier,
      },
    ];
  }
}
