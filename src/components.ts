import type { Contestant } from "./contestants/contestant";

export interface ComponentKey<T> {
  readonly id: string;
  readonly __phantom?: T;
}

export interface ChargingData {
  target: Contestant | null;
  remaining: number;
  totalDuration: number;
}

export const Charging: ComponentKey<ChargingData> = { id: "charging" };

export interface DodgingData {
  remaining: number;
}

export const Dodging: ComponentKey<DodgingData> = { id: "dodging" };

export interface RecoveringData {
  remaining: number;
}

export const Recovering: ComponentKey<RecoveringData> = { id: "recovering" };
