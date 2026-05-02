import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import type { EventDetector } from "../events/event";
import type { Handler } from "./handler";
import type { Change } from "./change";
import { tierRank } from "./change";

export interface PipelineInputs {
  self: Contestant;
  world: World;
  detectors: EventDetector[];
  handlers: Handler[];
}

export function runPipeline(inputs: PipelineInputs): Change[] {
  const { self, world, detectors, handlers } = inputs;
  const changes: Change[] = [];

  const orderedHandlers = [...handlers].sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier)
  );

  for (const detector of detectors) {
    const event = detector.detect(self, world);
    if (!event) continue;
    for (const handler of orderedHandlers) {
      if (handler.eventId !== event.id) continue;
      const produced = handler.handle(self, event, world);
      for (const c of produced) changes.push(c);
      if (handler.terminal) break;
    }
  }

  return changes;
}
