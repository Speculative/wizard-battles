import * as THREE from "three";
import { GameRenderer } from "./renderer";
import { buildArena } from "./arena";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";

const canvas = document.getElementById("arena") as HTMLCanvasElement;
const gfx = new GameRenderer(canvas);
const world = new World(gfx.scene);

gfx.scene.add(buildArena());

world.addContestant(
  new BasicWizard({
    id: "red",
    color: 0xff2244,
    start: new THREE.Vector3(-300, 0, -150),
  })
);
world.addContestant(
  new BasicWizard({
    id: "blue",
    color: 0x2266ff,
    start: new THREE.Vector3(300, 0, 150),
  })
);
world.addContestant(
  new BasicWizard({
    id: "green",
    color: 0x22cc55,
    start: new THREE.Vector3(-300, 0, 200),
  })
);
world.addContestant(
  new BasicWizard({
    id: "yellow",
    color: 0xffdd22,
    start: new THREE.Vector3(300, 0, -200),
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
