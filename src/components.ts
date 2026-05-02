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

export interface DashingData {
  remaining: number;
}

export const Dashing: ComponentKey<DashingData> = { id: "dashing" };

export interface RecoveringData {
  remaining: number;
}

export const Recovering: ComponentKey<RecoveringData> = { id: "recovering" };
