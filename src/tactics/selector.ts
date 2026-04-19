import type { Tactic, TacticContext, Directives, RosterEntry } from "./tactic";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const EVAL_INTERVAL = 1.0;
const RANDOM_JITTER = 0.35;

export class TacticSelector {
  private readonly roster: RosterEntry[];
  private readonly label: string;
  private current: Tactic;
  private cachedDirectives: Directives;
  private dwellLeft: number;
  private evalTimer = 0;

  constructor(roster: RosterEntry[], ctx: TacticContext, label = "?") {
    if (roster.length === 0) {
      throw new Error("TacticSelector requires at least one roster entry");
    }
    this.roster = roster;
    this.label = label;
    this.current = roster[0].tactic;
    this.cachedDirectives = this.current.directives(ctx);
    this.dwellLeft = this.current.minDwell;
    console.log(`${this.label} -> ${this.current.id} (initial)`);
  }

  get currentTactic(): Tactic {
    return this.current;
  }

  get directives(): Directives {
    return this.cachedDirectives;
  }

  effectiveDirectives(ctx: TacticContext): Directives {
    if (this.current.liveDirectives) {
      return this.current.liveDirectives(this.cachedDirectives, ctx);
    }
    return this.cachedDirectives;
  }

  updateDormantObservations(self: Contestant, world: World): void {
    for (const entry of this.roster) {
      const tactic = entry.tactic;
      if (tactic === this.current) continue;
      if (!tactic.detectors || !tactic.onObserve) continue;
      const handlers = tactic.handlers ?? [];
      for (const detector of tactic.detectors) {
        const event = detector.detect(self, world);
        if (!event) continue;
        for (const handler of handlers) {
          if (handler.eventId !== event.id) continue;
          const produced = handler.handle(self, event);
          for (const c of produced) {
            if (c.type === "observe") {
              tactic.onObserve(c.key, c.value);
            }
          }
          if (handler.terminal) break;
        }
      }
    }
  }

  update(dt: number, ctx: TacticContext): void {
    this.dwellLeft -= dt;
    this.evalTimer -= dt;
    if (this.evalTimer > 0 || this.dwellLeft > 0) return;
    this.evalTimer = EVAL_INTERVAL;

    let best = this.current;
    let bestScore = -Infinity;
    for (const entry of this.roster) {
      const raw = entry.tactic.score(ctx);
      const jitter = 1 + (Math.random() * 2 - 1) * RANDOM_JITTER;
      const score = raw * entry.bias * jitter;
      if (score > bestScore) {
        bestScore = score;
        best = entry.tactic;
      }
    }
    if (best !== this.current) {
      const prev = this.current.id;
      this.current = best;
      this.cachedDirectives = best.directives(ctx);
      this.dwellLeft = best.minDwell;
      console.log(`${this.label} ${prev} -> ${best.id}`);
    }
  }
}
