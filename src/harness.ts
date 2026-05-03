import * as THREE from "three";
import { rmSync, mkdirSync, existsSync } from "node:fs";
import { World } from "./world";
import { BasicWizard } from "./contestants/basicWizard";
import { redRoster, blueRoster, greenRoster, yellowRoster } from "./rosters";
import { FireballFactory } from "./spells/fireball";
import { MeleeFactory } from "./spells/meleeAttack";
import { ProjectileSlowFieldFactory } from "./spells/projectileSlowField";
import { BlinkFactory } from "./spells/blink";
import { Heavy, Spread, Swarm, Gatling } from "./spells/modifiers";
import { useVirtualClock, advanceVirtualClock, nowSeconds } from "./clock";
import { setTelemetry, emit, emitFrame } from "./telemetry";
import { JsonlSink } from "./telemetrySink";
import { nearestEnemy, surfaceDistance } from "./tactics/helpers";

interface RunOptions {
  dt: number;
  maxSeconds: number;
  sampleHz: number;
  seed?: number;
  runId: string;
  runsDir: string;
}

interface RunResult {
  winner: string | null;
  alive: string[];
  simulatedSeconds: number;
  wallMs: number;
  reason: "win" | "draw" | "timeout";
  runId: string;
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
      spellbook: [FireballFactory],
      modifiers: [Heavy, Spread, Swarm, Gatling],
    })
  );

  return world;
}

function aliveIds(world: World): string[] {
  return world.contestants.filter((c) => c.alive).map((c) => c.id);
}

function sampleFrames(world: World): void {
  for (const c of world.contestants) {
    if (!c.alive) continue;
    const w = c as BasicWizard;
    const enemy = nearestEnemy(c, world);
    emitFrame({
      who: c.id,
      x: c.position.x,
      z: c.position.z,
      vx: c.velocity.x,
      vz: c.velocity.z,
      fx: c.facing.x,
      fz: c.facing.z,
      state: w.getMovementState(),
      tactic: w.getCurrentTacticId(),
      hp: c.hp,
      stamina: w.stamina01(),
      nearest: enemy ? enemy.id : null,
      surfDist: enemy ? surfaceDistance(c, enemy) : null,
    });
  }
}

export function runMatch(opts: RunOptions): RunResult {
  if (opts.seed !== undefined) {
    seedMathRandom(opts.seed);
  }
  useVirtualClock(0);
  const world = makeWorld();

  const sink = new JsonlSink(opts.runsDir, {
    runId: opts.runId,
    seed: opts.seed ?? null,
    dt: opts.dt,
    maxSeconds: opts.maxSeconds,
    sampleHz: opts.sampleHz,
    contestants: world.contestants.map((c) => c.id),
    startedAt: new Date().toISOString(),
  });
  setTelemetry(sink);

  emit("match_start", null, {
    runId: opts.runId,
    seed: opts.seed ?? null,
    dt: opts.dt,
    sampleHz: opts.sampleHz,
    contestants: world.contestants.map((c) => c.id),
  });

  const startWall = performance.now();
  const dt = opts.dt;
  const maxSteps = Math.ceil(opts.maxSeconds / dt);
  const sampleEvery =
    opts.sampleHz > 0 ? Math.max(1, Math.round(1 / (opts.sampleHz * dt))) : 0;
  let step = 0;
  let reason: RunResult["reason"] = "timeout";

  if (sampleEvery > 0) sampleFrames(world);

  for (; step < maxSteps; step++) {
    world.update(dt);
    advanceVirtualClock(dt);
    if (sampleEvery > 0 && (step + 1) % sampleEvery === 0) {
      sampleFrames(world);
    }
    const alive = aliveIds(world);
    if (alive.length <= 1) {
      reason = alive.length === 1 ? "win" : "draw";
      break;
    }
  }

  const wallMs = performance.now() - startWall;
  const alive = aliveIds(world);
  const winner = alive.length === 1 ? alive[0] : null;
  const simulatedSeconds = nowSeconds();

  emit("match_end", null, {
    reason,
    winner,
    alive,
    simulatedSeconds,
    wallMs,
  });

  sink.finalize({
    endedAt: new Date().toISOString(),
    simulatedSeconds,
    reason,
    winner,
    alive,
  });
  setTelemetry(null);
  sink.close();

  return {
    winner,
    alive,
    simulatedSeconds,
    wallMs,
    reason,
    runId: opts.runId,
  };
}

function seedMathRandom(seed: number): void {
  let state = (seed | 0) || 1;
  Math.random = (): number => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

interface CliArgs {
  runs: number;
  dt: number;
  maxSeconds: number;
  sampleHz: number;
  seed?: number;
  runIdPrefix: string | null;
  runsDir: string;
  keep: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    runs: 1,
    dt: 1 / 60,
    maxSeconds: 120,
    sampleHz: 10,
    seed: undefined,
    runIdPrefix: null,
    runsDir: "runs",
    keep: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") out.runs = Number(argv[++i]);
    else if (arg === "--dt") out.dt = Number(argv[++i]);
    else if (arg === "--max") out.maxSeconds = Number(argv[++i]);
    else if (arg === "--sample-hz") out.sampleHz = Number(argv[++i]);
    else if (arg === "--seed") out.seed = Number(argv[++i]);
    else if (arg === "--run-id") out.runIdPrefix = String(argv[++i]);
    else if (arg === "--runs-dir") out.runsDir = String(argv[++i]);
    else if (arg === "--keep") out.keep = true;
    else if (arg === "--quiet" || arg === "-q") out.quiet = true;
  }
  return out;
}

function defaultRunId(args: CliArgs, index: number, seed: number | undefined): string {
  if (args.runIdPrefix) {
    return args.runs > 1 ? `${args.runIdPrefix}-${index}` : args.runIdPrefix;
  }
  const seedPart = seed !== undefined ? `s${seed}` : `t${Date.now()}`;
  return `m-${seedPart}-${index}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.keep && existsSync(args.runsDir)) {
    rmSync(args.runsDir, { recursive: true, force: true });
  }
  mkdirSync(args.runsDir, { recursive: true });

  const originalLog = console.log;
  const wins = new Map<string, number>();
  const totalsByReason = { win: 0, draw: 0, timeout: 0 };
  const startAll = performance.now();
  for (let r = 0; r < args.runs; r++) {
    if (args.quiet) console.log = (): void => undefined;
    const seed = args.seed !== undefined ? args.seed + r : undefined;
    const runId = defaultRunId(args, r, seed);
    const result = runMatch({
      dt: args.dt,
      maxSeconds: args.maxSeconds,
      sampleHz: args.sampleHz,
      seed,
      runId,
      runsDir: args.runsDir,
    });
    console.log = originalLog;
    totalsByReason[result.reason]++;
    if (result.winner) {
      wins.set(result.winner, (wins.get(result.winner) ?? 0) + 1);
    }
    console.log(
      `run ${r + 1}/${args.runs} ${result.runId}: ${result.reason} winner=${result.winner ?? "-"} alive=[${result.alive.join(",")}] simT=${result.simulatedSeconds.toFixed(1)}s wall=${result.wallMs.toFixed(0)}ms`
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
  console.log(`output: ${args.runsDir}/`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
