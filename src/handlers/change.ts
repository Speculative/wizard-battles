import type * as THREE from "three";

export type Change =
  | ForceMovementStateChange
  | ObserveChange
  | NoOpChange;

export interface ForceMovementStateChange {
  type: "forceMovementState";
  state: "dodging";
  direction: THREE.Vector3;
  priority: HandlerTier;
}

export interface ObserveChange {
  type: "observe";
  key: string;
  value: unknown;
  priority: HandlerTier;
}

export interface NoOpChange {
  type: "noop";
  priority: HandlerTier;
}

export const HANDLER_TIERS = ["reflexive", "tactical", "observational"] as const;
export type HandlerTier = (typeof HANDLER_TIERS)[number];

export function tierRank(t: HandlerTier): number {
  return HANDLER_TIERS.indexOf(t);
}
