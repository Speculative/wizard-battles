import * as THREE from "three";
import { GameRenderer } from "./renderer";
import { buildArena } from "./arena";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";
import { redRoster, blueRoster, greenRoster, yellowRoster } from "./rosters";
import { FireballFactory } from "./spells/fireball";
import { MeleeFactory } from "./spells/meleeAttack";
import { ProjectileSlowFieldFactory } from "./spells/projectileSlowField";
import { BlinkFactory } from "./spells/blink";
import { Heavy } from "./spells/modifiers";

const canvas = document.getElementById("arena") as HTMLCanvasElement;
const gfx = new GameRenderer(canvas);
const world = new World(gfx.scene, gfx.camera);

gfx.scene.add(buildArena());

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
    spellbook: [FireballFactory, BlinkFactory],
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
    spellbook: [FireballFactory],
    modifiers: [Heavy],
  })
);

// Seed `last` from the first RAF callback, not from script time. RAF's
// `now` parameter is the frame-start timestamp, which can be earlier
// than `performance.now()` read during script execution — using a
// script-time `last` against a frame-start `now` produces a negative
// dt on tick 1 and the kinematic body integrates backward.
let last: number | null = null;
function tick(now: number): void {
  if (last === null) {
    last = now;
    requestAnimationFrame(tick);
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt);
  gfx.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
