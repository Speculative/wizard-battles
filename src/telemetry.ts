import { nowSeconds } from "./clock";

export interface FrameSample {
  who: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  fx: number;
  fz: number;
  state: string;
  tactic: string;
  hp: number;
  stamina: number;
  nearest: string | null;
  surfDist: number | null;
}

export interface Sink {
  event(type: string, who: string | null, meta?: Record<string, unknown>): void;
  frame(s: FrameSample): void;
  flush(): void;
  close(): void;
}

let sink: Sink | null = null;

export function setTelemetry(s: Sink | null): void {
  sink = s;
}

export function getTelemetry(): Sink | null {
  return sink;
}

export function emit(
  type: string,
  who: string | null,
  meta?: Record<string, unknown>
): void {
  if (sink) sink.event(type, who, meta);
}

export function emitFrame(s: FrameSample): void {
  if (sink) sink.frame(s);
}

// Used by the JsonlSink to stamp records; also useful for ad-hoc test code.
export function telemetryTime(): number {
  return nowSeconds();
}
