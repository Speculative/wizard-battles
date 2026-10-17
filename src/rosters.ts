import {
  Pressure,
  Kite,
  Orbit,
  Ambush,
  Retreat,
  DuelistCharge,
  CloseQuarters,
  Sniper,
  Turtle,
  AntiMageZone,
  AvoidIncoming,
} from "./tactics/native";
import type { RosterEntry } from "./tactics/tactic";

export function redRoster(random: () => number): RosterEntry[] {
  return [
    { tactic: new DuelistCharge(), bias: 1.6 },
    { tactic: new CloseQuarters(random), bias: 1.5 },
    { tactic: new AntiMageZone(), bias: 1.4 },
    { tactic: new Pressure(random), bias: 1.0 },
    { tactic: new Orbit(random), bias: 0.8 },
    { tactic: new Retreat(random), bias: 0.7 },
  ];
}

export function blueRoster(random: () => number): RosterEntry[] {
  return [
    { tactic: new AvoidIncoming(), bias: 1.0 },
    { tactic: new Sniper(), bias: 1.6 },
    { tactic: new Ambush(random), bias: 1.3 },
    { tactic: new Kite(random), bias: 1.2 },
    { tactic: new Retreat(random), bias: 0.9 },
  ];
}

export function greenRoster(random: () => number): RosterEntry[] {
  return [
    { tactic: new Sniper(), bias: 1.7 },
    { tactic: new Turtle(random), bias: 1.2 },
    { tactic: new Retreat(random), bias: 1.0 },
    { tactic: new Orbit(random), bias: 0.8 },
    { tactic: new Kite(random), bias: 0.7 },
  ];
}

export function yellowRoster(random: () => number): RosterEntry[] {
  return [
    { tactic: new Sniper(), bias: 1.8 },
    { tactic: new Ambush(random), bias: 1.2 },
    { tactic: new Kite(random), bias: 1.0 },
    { tactic: new Retreat(random), bias: 0.7 },
  ];
}
