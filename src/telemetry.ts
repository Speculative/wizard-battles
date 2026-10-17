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
  event(type: string, who: string | null, meta?: Record<string, unknown>, time?: number): void;
  frame(s: FrameSample, time?: number): void;
  flush(): void;
  close(): void;
}
