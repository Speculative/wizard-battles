import * as THREE from "three";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";
import { redRoster, blueRoster, greenRoster, yellowRoster } from "./rosters";
import { FireballFactory } from "./spells/fireball";
import { MeleeFactory } from "./spells/meleeAttack";
import { ProjectileSlowFieldFactory } from "./spells/projectileSlowField";
import { BlinkFactory } from "./spells/blink";
import { useVirtualClock, advanceVirtualClock } from "./clock";

interface RunOptions {
  dt: number;
  maxSeconds: number;
  seed?: number;
}

interface RunResult {
  winner: string | null;
  alive: string[];
  simulatedSeconds: number;
  wallMs: number;
  reason: "win" | "draw" | "timeout";
}

function makeWorld(): World {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const world = new World(scene, camera);

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
    })
  );

  return world;
}

function aliveIds(world: World): string[] {
  return world.contestants.filter((c) => c.alive).map((c) => c.id);
}

export function runMatch(opts: RunOptions): RunResult {
  if (opts.seed !== undefined) {
    seedMathRandom(opts.seed);
  }
  useVirtualClock(0);
  const world = makeWorld();

  const startWall = performance.now();
  const dt = opts.dt;
  const maxSteps = Math.ceil(opts.maxSeconds / dt);
  let step = 0;
  let reason: RunResult["reason"] = "timeout";
  for (; step < maxSteps; step++) {
    world.update(dt);
    advanceVirtualClock(dt);
    const alive = aliveIds(world);
    if (alive.length <= 1) {
      reason = alive.length === 1 ? "win" : "draw";
      break;
    }
  }
  const wallMs = performance.now() - startWall;
  const alive = aliveIds(world);
  return {
    winner: alive.length === 1 ? alive[0] : null,
    alive,
    simulatedSeconds: step * dt,
    wallMs,
    reason,
  };
}

function seedMathRandom(seed: number): void {
  let state = (seed | 0) || 1;
  Math.random = (): number => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function parseArgs(argv: string[]): {
  runs: number;
  dt: number;
  maxSeconds: number;
  seed?: number;
  quiet: boolean;
} {
  const out = {
    runs: 1,
    dt: 1 / 60,
    maxSeconds: 120,
    seed: undefined as number | undefined,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") out.runs = Number(argv[++i]);
    else if (arg === "--dt") out.dt = Number(argv[++i]);
    else if (arg === "--max") out.maxSeconds = Number(argv[++i]);
    else if (arg === "--seed") out.seed = Number(argv[++i]);
    else if (arg === "--quiet" || arg === "-q") out.quiet = true;
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const originalLog = console.log;
  const wins = new Map<string, number>();
  const totalsByReason = { win: 0, draw: 0, timeout: 0 };
  const startAll = performance.now();
  for (let r = 0; r < args.runs; r++) {
    if (args.quiet) console.log = (): void => undefined;
    const seed = args.seed !== undefined ? args.seed + r : undefined;
    const result = runMatch({
      dt: args.dt,
      maxSeconds: args.maxSeconds,
      seed,
    });
    console.log = originalLog;
    totalsByReason[result.reason]++;
    if (result.winner) {
      wins.set(result.winner, (wins.get(result.winner) ?? 0) + 1);
    }
    console.log(
      `run ${r + 1}/${args.runs}: ${result.reason} winner=${result.winner ?? "-"} alive=[${result.alive.join(",")}] simT=${result.simulatedSeconds.toFixed(1)}s wall=${result.wallMs.toFixed(0)}ms`
    );
  }
  const totalWall = performance.now() - startAll;
  console.log("---");
  console.log(`outcomes: win=${totalsByReason.win} draw=${totalsByReason.draw} timeout=${totalsByReason.timeout}`);
  if (wins.size > 0) {
    const rows = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`wins: ${rows.map(([k, v]) => `${k}=${v}`).join(" ")}`);
  }
  console.log(`total wall: ${totalWall.toFixed(0)}ms across ${args.runs} runs`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
