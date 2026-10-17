import type { MovementStats } from "../kinematics";

export type MovementState =
  | "idle"
  | "walking"
  | "running"
  | "sprinting"
  | "dashing"
  | "charging"
  | "channeling"
  | "recovering";

export const DEFAULT_MOVEMENT_STATS: Record<MovementState, MovementStats> = {
  idle: { maxSpeed: 0, acceleration: 0, friction: 500, turnRate: Math.PI * 2 },
  walking: {
    maxSpeed: 60,
    acceleration: 350,
    friction: 350,
    turnRate: Math.PI * 1.6,
  },
  running: {
    maxSpeed: 130,
    acceleration: 450,
    friction: 300,
    turnRate: Math.PI * 1.2,
  },
  sprinting: {
    maxSpeed: 220,
    acceleration: 500,
    friction: 250,
    turnRate: Math.PI * 0.7,
  },
  dashing: {
    maxSpeed: 340,
    acceleration: 2000,
    friction: 600,
    turnRate: Math.PI * 0.3,
  },
  charging: {
    maxSpeed: 45,
    acceleration: 250,
    friction: 400,
    turnRate: Math.PI * 1.8,
  },
  channeling: {
    // Fully rooted: caster can rotate to face target but does not translate.
    // Future "break concentration" interactions will react to damage taken
    // while in this state (see Channeling component).
    maxSpeed: 0,
    acceleration: 0,
    friction: 1500,
    turnRate: Math.PI * 1.5,
  },
  recovering: {
    maxSpeed: 15,
    acceleration: 50,
    friction: 800,
    turnRate: Math.PI * 0.6,
  },
};
