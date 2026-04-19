import type { Contestant } from "../contestants/contestant";
import type { GameEvent } from "../events/event";
import type { Change, HandlerTier } from "./change";

export interface Handler<P = unknown> {
  readonly id: string;
  readonly eventId: string;
  readonly tier: HandlerTier;
  readonly terminal: boolean;
  handle(self: Contestant, event: GameEvent<P>): Change[];
}
