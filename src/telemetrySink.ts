import { closeSync, mkdirSync, openSync, writeSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FrameSample, Sink } from "./telemetry";
import { telemetryTime } from "./telemetry";

interface MatchMeta {
  runId: string;
  seed: number | null;
  dt: number;
  maxSeconds: number;
  sampleHz: number;
  contestants: string[];
  startedAt: string;
  // Filled in at close()
  endedAt?: string;
  simulatedSeconds?: number;
  reason?: string;
  winner?: string | null;
  alive?: string[];
}

export class JsonlSink implements Sink {
  private readonly runDir: string;
  private readonly eventsFd: number;
  private readonly framesFd: number;
  private readonly meta: MatchMeta;

  constructor(rootDir: string, meta: MatchMeta) {
    this.runDir = join(rootDir, meta.runId);
    mkdirSync(this.runDir, { recursive: true });
    this.eventsFd = openSync(join(this.runDir, "events.jsonl"), "w");
    this.framesFd = openSync(join(this.runDir, "frames.jsonl"), "w");
    this.meta = meta;
  }

  event(type: string, who: string | null, meta?: Record<string, unknown>): void {
    const rec: Record<string, unknown> = {
      run: this.meta.runId,
      t: telemetryTime(),
      type,
      who,
    };
    if (meta && Object.keys(meta).length > 0) rec.meta = meta;
    writeSync(this.eventsFd, JSON.stringify(rec) + "\n");
  }

  frame(s: FrameSample): void {
    const rec = {
      run: this.meta.runId,
      t: telemetryTime(),
      who: s.who,
      x: s.x,
      z: s.z,
      vx: s.vx,
      vz: s.vz,
      fx: s.fx,
      fz: s.fz,
      state: s.state,
      tactic: s.tactic,
      hp: s.hp,
      stamina: s.stamina,
      nearest: s.nearest,
      surfDist: s.surfDist,
    };
    writeSync(this.framesFd, JSON.stringify(rec) + "\n");
  }

  finalize(end: {
    endedAt: string;
    simulatedSeconds: number;
    reason: string;
    winner: string | null;
    alive: string[];
  }): void {
    Object.assign(this.meta, end);
    writeFileSync(
      join(this.runDir, "meta.json"),
      JSON.stringify(this.meta, null, 2)
    );
  }

  flush(): void {
    // Synchronous writes already hit the kernel; no userspace buffering.
  }

  close(): void {
    closeSync(this.eventsFd);
    closeSync(this.framesFd);
  }
}
