import { SimulationClock } from "./clock";
import { seededRandom } from "./random";
import type { FrameSample, Sink } from "./telemetry";
import type { Contestant } from "./contestants/contestant";
import type { Spell } from "./spells/spell";
import { ARENA } from "./config";

export interface SimulationEvent {
  readonly seq: number;
  readonly t: number;
  readonly type: string;
  readonly who: string | null;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface WorldOptions {
  seed?: number;
  bounds?: { width: number; depth: number; height: number };
  telemetry?: Sink | null;
}

export class World {
  readonly contestants: Contestant[] = [];
  readonly spells: Spell[] = [];
  readonly clock = new SimulationClock();
  readonly random: () => number;
  readonly bounds: Readonly<{ width: number; depth: number; height: number }>;
  readonly seed: number;
  telemetry: Sink | null;
  /** Bounded history for transient presentation; durable logs belong to the sink. */
  readonly events: SimulationEvent[] = [];
  private eventSequence = 0;

  constructor(options: WorldOptions = {}) {
    this.seed = options.seed ?? 1;
    this.random = seededRandom(this.seed);
    this.bounds = Object.freeze({ ...(options.bounds ?? ARENA) });
    this.telemetry = options.telemetry ?? null;
  }

  get time(): number { return this.clock.seconds; }
  get tick(): number { return this.clock.tick; }

  emit(type: string, who: string | null, meta: Record<string, unknown> = {}): void {
    // Clone metadata so observers cannot mutate simulation-owned values.
    const event = Object.freeze({ seq: ++this.eventSequence, t: this.time, type, who,
      meta: Object.freeze(structuredClone(meta)) });
    this.events.push(event);
    this.telemetry?.event(type, who, structuredClone(meta), this.time);
  }

  emitFrame(sample: FrameSample): void {
    this.telemetry?.frame({ ...sample }, this.time);
  }

  addContestant(c: Contestant): void {
    if (c.world !== this) throw new Error("Contestant belongs to another world");
    if (this.contestants.some(other => other.id === c.id)) throw new Error("Duplicate contestant id");
    this.contestants.push(c);
  }

  addSpell(s: Spell): void {
    if (s.caster.world !== this) throw new Error("Spell belongs to another world");
    this.spells.push(s);
  }

  removeSpell(s: Spell): void {
    const i = this.spells.indexOf(s);
    if (i >= 0) this.spells.splice(i, 1);
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) throw new Error("dt must be finite and positive");
    this.clock.advance(dt);
    for (const c of this.contestants) c.update(dt, this);
    this.resolveContestantCollisions();
    for (let i = this.spells.length - 1; i >= 0; i--) {
      const s = this.spells[i];
      if (!s.dead) s.update(dt, this);
      if (s.dead) this.removeSpell(s);
    }
    const expired = this.events.findIndex(event => event.t >= this.time - 2);
    if (expired > 0) this.events.splice(0, expired);
    else if (expired === -1) this.events.length = 0;
  }

  private resolveContestantCollisions(): void {
    const list = this.contestants;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = a.radius + b.radius;
        if (distSq >= minDist * minDist || distSq === 0) continue;
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        const push = overlap / 2;
        a.position.x -= nx * push;
        a.position.z -= nz * push;
        b.position.x += nx * push;
        b.position.z += nz * push;
      }
    }
  }
}
