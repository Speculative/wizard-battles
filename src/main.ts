import * as THREE from "three";
import { GameRenderer } from "./renderer";
import { buildArena } from "./arena";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";
import {
  Pressure,
  Kite,
  Orbit,
  Ambush,
  Retreat,
  BaitAndSwitch,
  DuelistCharge,
  Sniper,
  Turtle,
  Scrapper,
  AntiMageZone,
} from "./tactics/native";
import type { RosterEntry } from "./tactics/tactic";
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
    { tactic: new Pressure(), bias: 1.0 },
    { tactic: new Orbit(), bias: 0.8 },
    { tactic: new Retreat(), bias: 0.7 },
  ];
}

function blueRoster(): RosterEntry[] {
  return [
    { tactic: new Sniper(), bias: 1.6 },
    { tactic: new Ambush(), bias: 1.3 },
    { tactic: new Kite(), bias: 1.2 },
    { tactic: new Retreat(), bias: 0.9 },
  ];
}

function greenRoster(): RosterEntry[] {
  return [
    { tactic: new Turtle(), bias: 1.5 },
    { tactic: new Retreat(), bias: 1.3 },
    { tactic: new Orbit(), bias: 1 },
    { tactic: new Kite(), bias: 0.9 },
  ];
}

function yellowRoster(): RosterEntry[] {
  return [
    { tactic: new Scrapper(), bias: 1.6 },
    { tactic: new BaitAndSwitch(), bias: 1.3 },
    { tactic: new Pressure(), bias: 1 },
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
