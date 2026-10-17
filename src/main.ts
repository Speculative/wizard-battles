import { GameRenderer } from './renderer';
import { buildArena } from './arena';
import { createScenario, SIMULATION_DT, SCENARIO_ID } from './scenario';
import { BattleView } from './presentation/battleView';

const params = new URLSearchParams(location.search);
function numeric(name: string, fallback: number): number {
  const value = params.has(name) ? Number(params.get(name)) : fallback;
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}`);
  return value;
}
const seed = numeric('seed', 1);
const rotation = numeric('rotation', 0);
const visualSeed = numeric('visualSeed', seed ^ 0x5f3759df);
const scenario = params.get('scenario') ?? SCENARIO_ID;
const variant = params.get('variant') ?? 'baseline';
const capture = params.get('capture') === '1';
const effects = params.get('effects') !== '0';
const trails = params.get('trails') !== '0';
const canvas = document.getElementById('arena') as HTMLCanvasElement;
const gfx = new GameRenderer(canvas, { pixelRatio: capture ? 1 : undefined });
gfx.scene.add(buildArena());
let world = createScenario({ seed, scenario, variant, rotation });
let view = new BattleView(world, gfx.camera, { visualSeed, effects, trails });
gfx.scene.add(view.group);
let paused = capture;
let accumulator = 0;
let last: number | null = null;

function advance(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('step count must be a nonnegative integer');
  for (let i = 0; i < count; i++) {
    world.update(SIMULATION_DT);
    view.recordTick();
  }
}
function render(): void { view.render(); gfx.render(); }
function state() {
  return { time: world.time, tick: world.tick,
    contestants: world.contestants.map(c => ({ id: c.id, alive: c.alive, hp: c.hp,
      position: { ...c.position }, velocity: { ...c.velocity } })),
    spells: world.spells.map(s => ({ id: s.metadata.id, caster: s.caster.id,
      position: { ...s.position }, velocity: { ...s.velocity }, frozen: 'frozen' in s ? s.frozen : false })),
    events: structuredClone(world.events) };
}
function seek(seconds: number): ReturnType<typeof state> {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('seek time must be finite and nonnegative');
  const count = Math.round(seconds / SIMULATION_DT);
  if (!Number.isSafeInteger(count)) throw new Error('seek time exceeds supported tick range');
  paused = true;
  view.dispose();
  world = createScenario({ seed, scenario, variant, rotation });
  view = new BattleView(world, gfx.camera, { visualSeed, effects, trails });
  gfx.scene.add(view.group);
  accumulator = 0;
  advance(count);
  render();
  return state();
}
const battle = {
  get metadata() { return { contract: 'wizard-battles-capture-v1', scenario, seed, variant, rotation, visualSeed,
    dt: SIMULATION_DT, effects, trails, width: canvas.width, height: canvas.height, browser: navigator.userAgent }; },
  seek,
  step(count = 1) { paused = true; advance(count); render(); return state(); },
  render,
  state,
  pause() { paused = true; },
  play() { paused = false; last = null; },
  screenshot() { render(); return canvas.toDataURL('image/png'); },
};
declare global { interface Window { battle: typeof battle } }
window.battle = battle;
seek(numeric('time', 0));
paused = capture;

function tick(now: number): void {
  if (last === null) last = now;
  if (!paused) {
    accumulator += Math.max(0, Math.min(0.25, (now - last) / 1000));
    const count = Math.floor((accumulator + 1e-10) / SIMULATION_DT);
    advance(count);
    accumulator -= count * SIMULATION_DT;
    render();
  }
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
