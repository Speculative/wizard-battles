/** End-to-end browser checks. Uses an isolated local Vite server and image-provided Chromium. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import type { World } from '../src/world';

function state(world: World) {
  return { time: world.time, tick: world.tick,
    contestants: world.contestants.map(c => ({ id: c.id, alive: c.alive, hp: c.hp,
      position: { ...c.position }, velocity: { ...c.velocity } })),
    spells: world.spells.map(s => ({ id: s.metadata.id, caster: s.caster.id,
      position: { ...s.position }, velocity: { ...s.velocity }, frozen: 'frozen' in s ? s.frozen : false })),
    events: structuredClone(world.events) };
}
// Different V8 versions can differ in the last bits of transcendental operations.
function equivalent(actual: unknown, expected: unknown, path = 'state'): void {
  if (typeof actual === 'number' && typeof expected === 'number') {
    assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${path}: ${actual} != ${expected}`);
  } else if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), path);
    for (const key of Object.keys(expected)) equivalent((actual as any)[key], (expected as any)[key], `${path}.${key}`);
  } else assert.deepEqual(actual, expected, path);
}

const production = process.argv.includes('--production');
const server = production
  ? await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
if ('listen' in server) await server.listen();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors: string[] = [];
  for (const config of [
    { scenario: 'four-wizards', seed: 1, rotation: 0, time: 8 },
    { scenario: 'four-wizards', seed: 42, rotation: 0, time: 20 },
    { scenario: 'duel', seed: 9, rotation: Math.PI / 2, time: 12 },
  ]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const url = new URL(server.resolvedUrls!.local[0]);
    for (const [key, value] of Object.entries({ ...config, capture: 1 })) url.searchParams.set(key, String(value));
    await page.goto(url.href);
    await page.waitForFunction(() => !!(window as any).battle);
    const world = createScenario(config);
    for (let tick = 0; tick < Math.round(config.time / SIMULATION_DT); tick++) world.update(SIMULATION_DT);
    const original = await page.evaluate(() => (window as any).battle.state());
    equivalent(original, state(world));
    const image = await page.evaluate(() => (window as any).battle.screenshot());
    assert.ok(image.startsWith('data:image/png;base64,') && image.length > 10000);
    await page.evaluate(() => { for (let i = 0; i < 4; i++) (window as any).battle.render(); });
    assert.deepEqual(await page.evaluate(() => (window as any).battle.state()), original);
    assert.equal(await page.evaluate(() => (window as any).battle.screenshot()), image);
    await page.evaluate(() => { (window as any).battle.seek(0); });
    const replay = await page.evaluate(time => (window as any).battle.seek(time), config.time);
    assert.deepEqual(replay, original);
    assert.equal(await page.evaluate(() => (window as any).battle.screenshot()), image);
    // Render every step, then seek with no intermediate frames: state must match.
    for (let i = 0; i < 5; i++) await page.evaluate(() => (window as any).battle.step(12));
    const stepped = await page.evaluate(() => (window as any).battle.state());
    assert.deepEqual(await page.evaluate(time => (window as any).battle.seek(time), config.time + 1), stepped);
    // A fresh view with different randomness and no effects must produce identical gameplay.
    url.searchParams.set('visualSeed', '987'); url.searchParams.set('effects', '0'); url.searchParams.set('trails', '0');
    await page.goto(url.href);
    await page.waitForFunction(() => !!(window as any).battle);
    assert.deepEqual(await page.evaluate(() => (window as any).battle.state()), original);
    await page.setViewportSize({ width: 800, height: 450 });
    assert.deepEqual(await page.evaluate(() => (window as any).battle.state()), original);
    await page.evaluate(() => (window as any).battle.play());
    await page.waitForFunction(tick => (window as any).battle.state().tick > tick, original.tick);
    await page.evaluate(() => (window as any).battle.pause());
    await page.close();
    console.log(`Browser checks passed: ${config.scenario}, seed=${config.seed}, rotation=${config.rotation}, t=${config.time}`);
  }
  assert.deepEqual(errors, [], 'browser console/page errors');
  console.log(`Browser/headless agreement, replay/pixels, visual independence, resize and live playback verified (${production ? "production bundle" : "development server"}) (Chromium ${browser.version()}).`);
} finally { await browser?.close();
  if ('close' in server) await server.close();
  else await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())); }
