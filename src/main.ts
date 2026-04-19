import * as THREE from "three";
import { GameRenderer } from "./renderer";
import { buildArena } from "./arena";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";
import {
  Pressure,
  Kite,
  Ambush,
  Retreat,
  BaitAndSwitch,
} from "./tactics/common";
import {
  Sniper,
  Turtle,
  Scrapper,
} from "./tactics/signature";
import { Orbit, DuelistCharge, AntiMageZone } from "./tactics/native";
import type { RosterEntry } from "./tactics/plan";
import { LegacyTacticShim } from "./tactics/legacyShim";
import type { Tactic as LegacyTactic } from "./tactics/tactic";

const shim = (t: LegacyTactic): LegacyTacticShim => new LegacyTacticShim(t);
import { FireballFactory } from "./spells/fireball";
import { MeleeFactory } from "./spells/meleeAttack";
import { ProjectileSlowFieldFactory } from "./spells/projectileSlowField";

const canvas = document.getElementById("arena") as HTMLCanvasElement;
const gfx = new GameRenderer(canvas);
const world = new World(gfx.scene, gfx.camera);

gfx.scene.add(buildArena());

function redRoster(): RosterEntry[] {
  return [
    { tactic: new DuelistCharge(), bias: 1.6 },
    { tactic: new AntiMageZone(), bias: 1.4 },
    { tactic: shim(new Pressure()), bias: 1.0 },
    { tactic: new Orbit(), bias: 0.8 },
    { tactic: shim(new Retreat()), bias: 0.7 },
  ];
}

function blueRoster(): RosterEntry[] {
  return [
    { tactic: shim(new Sniper()), bias: 1.6 },
    { tactic: shim(new Ambush()), bias: 1.3 },
    { tactic: shim(new Kite()), bias: 1.2 },
    { tactic: shim(new Retreat()), bias: 0.9 },
  ];
}

function greenRoster(): RosterEntry[] {
  return [
    { tactic: shim(new Turtle()), bias: 1.5 },
    { tactic: shim(new Retreat()), bias: 1.3 },
    { tactic: new Orbit(), bias: 1 },
    { tactic: shim(new Kite()), bias: 0.9 },
  ];
}

function yellowRoster(): RosterEntry[] {
  return [
    { tactic: shim(new Scrapper()), bias: 1.6 },
    { tactic: shim(new BaitAndSwitch()), bias: 1.3 },
    { tactic: shim(new Pressure()), bias: 1 },
    { tactic: new Orbit(), bias: 0.8 },
  ];
}

world.addContestant(
  new BasicWizard({
    id: "red",
    color: 0xff2244,
    start: new THREE.Vector3(-300, 0, -150),
    roster: redRoster(),
    spellbook: [MeleeFactory, ProjectileSlowFieldFactory, FireballFactory],
  })
);
world.addContestant(
  new BasicWizard({
    id: "blue",
    color: 0x2266ff,
    start: new THREE.Vector3(300, 0, 150),
    roster: blueRoster(),
  })
);
world.addContestant(
  new BasicWizard({
    id: "green",
    color: 0x22cc55,
    start: new THREE.Vector3(-300, 0, 200),
    roster: greenRoster(),
  })
);
world.addContestant(
  new BasicWizard({
    id: "yellow",
    color: 0xffdd22,
    start: new THREE.Vector3(300, 0, -200),
    roster: yellowRoster(),
  })
);

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt);
  gfx.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
