import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

export interface GameEvent<P = unknown> {
  readonly id: string;
  readonly payload: P;
}

export interface EventDetector<P = unknown> {
  readonly id: string;
  detect(self: Contestant, world: World): GameEvent<P> | null;
}
