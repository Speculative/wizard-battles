import {
  Pressure,
  Kite,
  Orbit,
  Ambush,
  Retreat,
  BaitAndSwitch,
  DuelistCharge,
  CloseQuarters,
  Sniper,
  Turtle,
  Scrapper,
  AntiMageZone,
  AvoidIncoming,
} from "./tactics/native";
import type { RosterEntry } from "./tactics/tactic";

export function redRoster(): RosterEntry[] {
  return [
    { tactic: new DuelistCharge(), bias: 1.6 },
    { tactic: new CloseQuarters(), bias: 1.5 },
    { tactic: new AntiMageZone(), bias: 1.4 },
    { tactic: new Pressure(), bias: 1.0 },
    { tactic: new Orbit(), bias: 0.8 },
    { tactic: new Retreat(), bias: 0.7 },
  ];
}

export function blueRoster(): RosterEntry[] {
  return [
    { tactic: new AvoidIncoming(), bias: 1.0 },
    { tactic: new Sniper(), bias: 1.6 },
    { tactic: new Ambush(), bias: 1.3 },
    { tactic: new Kite(), bias: 1.2 },
    { tactic: new Retreat(), bias: 0.9 },
  ];
}

export function greenRoster(): RosterEntry[] {
  return [
    { tactic: new Turtle(), bias: 1.5 },
    { tactic: new Retreat(), bias: 1.3 },
    { tactic: new Orbit(), bias: 1 },
    { tactic: new Kite(), bias: 0.9 },
  ];
}

export function yellowRoster(): RosterEntry[] {
  return [
    { tactic: new Scrapper(), bias: 1.6 },
    { tactic: new BaitAndSwitch(), bias: 1.3 },
    { tactic: new Pressure(), bias: 1 },
    { tactic: new Orbit(), bias: 0.8 },
  ];
}
