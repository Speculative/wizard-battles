import { rmSync, mkdirSync, existsSync } from "node:fs";
import { createScenario, SIMULATION_DT, SCENARIO_ID } from "./scenario";
import type { World } from "./world";
import type { BasicWizard } from "./contestants/basicWizard";
import { JsonlSink } from "./telemetrySink";
import { nearestEnemy, surfaceDistance } from "./tactics/helpers";

interface RunOptions {
  dt: number;
  maxSeconds: number;
  sampleHz: number;
  seed?: number;
  scenario?: string;
  variant?: string;
  rotation?: number;
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

function aliveIds(world: World): string[] {
  return world.contestants.filter((c) => c.alive).map((c) => c.id);
}

function sampleFrames(world: World): void {
  for (const c of world.contestants) {
    if (!c.alive) continue;
    const w = c as BasicWizard;
    const enemy = nearestEnemy(c, world);
    world.emitFrame({
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
  if (!Number.isFinite(opts.dt) || opts.dt <= 0) throw new Error("dt must be positive");
  if (!Number.isFinite(opts.maxSeconds) || opts.maxSeconds <= 0) throw new Error("maxSeconds must be positive");
  if (!Number.isFinite(opts.sampleHz) || opts.sampleHz < 0) throw new Error("sampleHz must be nonnegative");
  const world = createScenario({ seed: opts.seed ?? 1, scenario: opts.scenario, variant: opts.variant, rotation: opts.rotation });

  const sink = new JsonlSink(opts.runsDir, {
    runId: opts.runId,
    seed: world.seed,
    scenario: opts.scenario ?? SCENARIO_ID,
    variant: opts.variant ?? "baseline",
    rotation: opts.rotation ?? 0,
    dt: opts.dt,
    maxSeconds: opts.maxSeconds,
    sampleHz: opts.sampleHz,
    contestants: world.contestants.map((c) => c.id),
    startedAt: new Date().toISOString(),
  });
  world.telemetry = sink;

  try {
    world.emit("match_start", null, {
      runId: opts.runId,
      seed: world.seed,
      scenario: opts.scenario ?? SCENARIO_ID,
      variant: opts.variant ?? "baseline",
      rotation: opts.rotation ?? 0,
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
    const simulatedSeconds = world.time;

    world.emit("match_end", null, {
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

    return {
      winner,
      alive,
      simulatedSeconds,
      wallMs,
      reason,
      runId: opts.runId,
    };
  } finally {
    world.telemetry = null;
    sink.close();
  }

}

interface CliArgs {
  runs: number;
  dt: number;
  maxSeconds: number;
  sampleHz: number;
  seed?: number;
  scenario?: string;
  variant?: string;
  rotation?: number;
  runIdPrefix: string | null;
  runsDir: string;
  keep: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    runs: 1,
    dt: SIMULATION_DT,
    maxSeconds: 120,
    sampleHz: 10,
    seed: undefined,
    scenario: SCENARIO_ID,
    variant: "baseline",
    rotation: 0,
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
    else if (arg === "--scenario") out.scenario = argv[++i];
    else if (arg === "--variant") out.variant = argv[++i];
    else if (arg === "--rotation") out.rotation = Number(argv[++i]);
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

  const wins = new Map<string, number>();
  const totalsByReason = { win: 0, draw: 0, timeout: 0 };
  const startAll = performance.now();
  for (let r = 0; r < args.runs; r++) {
    const seed = args.seed !== undefined ? args.seed + r : undefined;
    const runId = defaultRunId(args, r, seed);
    const result = runMatch({
      dt: args.dt,
      maxSeconds: args.maxSeconds,
      sampleHz: args.sampleHz,
      seed,
      scenario: args.scenario,
      variant: args.variant,
      rotation: args.rotation,
      runId,
      runsDir: args.runsDir,
    });
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
