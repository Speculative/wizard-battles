import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { VARIANTS, EXPERIMENT } from '../src/experiment';
const uiOnly = process.argv.includes('--ui-only');
const feedbackDirectory = mkdtempSync(join(tmpdir(), 'wizard-feedback-check-'));
process.env.WIZARD_FEEDBACK_DIR = feedbackDirectory;
const production = process.argv.includes('--production');
const server = production ? await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }) : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
if ('listen' in server) await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const output = 'runs-comparison-check'; mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const url = new URL('compare.html?capture=1&scenario=duel&seed=7', server.resolvedUrls!.local[0]);
  await page.goto(url.href); await page.waitForFunction(() => !!window.comparison);
  const states = await page.evaluate(() => window.comparison.seek(12));
  if (!uiOnly) for (const [i, variant] of VARIANTS.entries()) {
    const world = createScenario({ scenario: 'duel', seed: 7, variant: variant.id });
    for (let tick = 0; tick < 720 && world.contestants.filter(c => c.alive).length > 1; tick++) world.update(SIMULATION_DT);
    const expected = world.contestants.map(c => ({ id: c.id, hp: c.hp, alive: c.alive, position: { ...c.position }, velocity: { ...c.velocity } }));
    // Chromium and Node use the same V8 math in this image; tolerate last-bit differences elsewhere.
    const round = (x: unknown) => JSON.parse(JSON.stringify(x, (_key, value) => typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
    assert.deepEqual(round(states[i].contestants), round(expected));
  }
  await page.screenshot({ path: `${output}/comparison-12s.png`, fullPage: true });
  const original = await page.evaluate(() => window.comparison.states());
  await page.getByRole('button', { name: 'Enlarge panel A' }).click();
  await page.setViewportSize({ width: 1200, height: 900 });
  assert.deepEqual(await page.evaluate(() => window.comparison.states()), original);
  await page.getByRole('button', { name: 'Enlarge panel A' }).click();
  await page.getByLabel('Viewing note').fill('Test: commitment is visible at 12s');
  await page.getByLabel('Preference', { exact: true }).selectOption('B');
  await page.getByRole('button', { name: 'Save timestamped note' }).click();
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Saved to runs-feedback/'));
  const feedback = await page.evaluate(() => window.comparison.feedback());
  assert.equal(feedback.notes.at(-1)!.time, 12); assert.equal(feedback.notes.at(-1)!.preference, 'B'); assert.deepEqual(feedback.notes.at(-1)!.variants, VARIANTS.map(v => v.id));
  // A fresh browser must recover notes without any localStorage.
  const fresh = await browser.newPage();
  await fresh.goto(url.href); await fresh.waitForFunction(() => !!window.comparison);
  await fresh.evaluate(() => window.comparison.ready());
  assert.deepEqual(await fresh.evaluate(() => window.comparison.feedback()), feedback);
  await fresh.close();
  await page.reload(); await page.waitForFunction(() => !!window.comparison);
  await page.evaluate(() => window.comparison.ready());
  assert.deepEqual(await page.evaluate(() => window.comparison.feedback()), feedback);
  await page.getByRole('button', { name: 'Propose expectation' }).click();
  const expectation = page.locator('.expectation').first();
  await expectation.getByLabel('Expectation', { exact: true }).fill('I can follow the opening');
  await expectation.getByLabel('Target (free text)').fill('No fixed numeric threshold');
  await expectation.getByRole('button', { name: 'Approve', exact: true }).click();
  assert.equal(await page.locator('.expectation').count(), 0, 'approved proposal disappears from queue');
  await page.locator('#filter').selectOption('all');
  const last = page.locator('.expectation').last();
  assert.equal(await last.getByLabel('Expectation', { exact: true }).inputValue(), 'I can follow the opening');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export feedback JSON' }).click();
  const download = await downloadPromise; const exported = `${output}/feedback.json`; await download.saveAs(exported);
  await page.locator('#import').setInputFiles(exported);
  const merged = await page.evaluate(() => window.comparison.feedback()); assert.equal(merged.notes.length, 1); assert.equal(merged.expectations.length, 8);
  writeFileSync(`${output}/invalid.json`, JSON.stringify({ schema: 'wizard-battles-feedback-v1', expectations: [{ id: 'invalid' }], notes: [] }));
  await page.locator('#import').setInputFiles(`${output}/invalid.json`);
  await page.waitForFunction(() => document.querySelector('#notice')!.textContent!.startsWith('Import failed'));
  assert.deepEqual(await page.evaluate(() => window.comparison.feedback()), merged);
  await page.evaluate(() => window.comparison.seek(120));
  const ends = await page.evaluate(() => window.comparison.states()); assert.ok(ends.every(s => s.finished));
  await page.evaluate(() => window.comparison.step(60)); assert.deepEqual(await page.evaluate(() => window.comparison.states()), ends);
  // Presets apply a complete setup immediately, including resetting time.
  await page.getByRole('button', { name: '3 · Four-way battle', exact: true }).click();
  assert.match(await page.locator('#active-match').innerText(), /Four wizards · seed 19/);
  assert.equal((await page.evaluate(() => window.comparison.states()))[0].tick, 0);
  await page.evaluate(() => window.comparison.play()); await page.waitForFunction(() => window.comparison.states()[0].tick > 0); await page.evaluate(() => window.comparison.pause());
  const live = await page.evaluate(() => window.comparison.states()); assert.equal(new Set(live.map(s => s.tick)).size, 1);
  await page.getByRole('button', { name: '2 · When movement stalls', exact: true }).click();
  await page.getByRole('button', { name: 'Short interaction · 8–14s', exact: true }).click();
  await page.evaluate(() => window.comparison.pause());
  assert.ok((await page.evaluate(() => window.comparison.states()))[0].tick >= 480);
  assert.equal(await page.locator('#time').getAttribute('min'), '8');
  assert.equal(await page.locator('#time').getAttribute('max'), '14');
  await page.locator('#loop').uncheck();
  await page.evaluate(() => window.comparison.step(600));
  assert.equal((await page.evaluate(() => window.comparison.states()))[1].tick, 840);
  await page.locator('#loop').check();
  await page.evaluate(() => { window.comparison.seek(13.9); window.comparison.play(); });
  await page.waitForFunction(() => window.comparison.states()[1].time < 9);
  await page.evaluate(() => window.comparison.pause());
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  assert.equal((await page.evaluate(() => window.comparison.states()))[0].tick, 480);
  await page.getByRole('button', { name: 'Late comparison · 84–90s', exact: true }).click();
  await page.evaluate(() => window.comparison.pause());
  assert.ok((await page.evaluate(() => window.comparison.states()))[1].tick >= 5040);
  await page.getByRole('button', { name: 'Full fight', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  assert.equal((await page.evaluate(() => window.comparison.states()))[0].tick, 0);
  // A failed workspace save must not claim durability.
  await page.route('**/api/feedback', route => route.fulfill({ status: 503, body: '{}' }));
  await page.getByLabel('Viewing note').fill('Offline note');
  await page.getByRole('button', { name: 'Save timestamped note', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Workspace save failed'));
  assert.deepEqual(errors.splice(0), ['Failed to load resource: the server responded with a status of 503 (Service Unavailable)']);
  await page.unroute('**/api/feedback');
  await page.getByRole('button', { name: 'Retry workspace save', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Saved to runs-feedback/'));
  await page.screenshot({ path: `${output}/comparison-presets.png`, fullPage: true });
  // Centered-shot rounding once flipped a dodge side across Node/Chromium.
  // Compare complete matches, including the long stalled case and fresh seeds.
  if (!uiOnly) for (const scene of EXPERIMENT.scenarios) for (const trialSeed of [...EXPERIMENT.seeds, 101, 211]) for (const rotation of EXPERIMENT.rotations) {
    await page.evaluate(setup => window.comparison.loadExample(setup), { scenario: scene, seed: trialSeed, rotation });
    const actual = await page.evaluate(() => window.comparison.seek(120));
    for (const [i, variant] of VARIANTS.entries()) {
      const world = createScenario({ scenario: scene, seed: trialSeed, rotation, variant: variant.id });
      while (world.tick < 7200 && world.contestants.filter(c => c.alive).length > 1) world.update(SIMULATION_DT);
      assert.equal(actual[i].tick, world.tick, `${scene}/${trialSeed}/${rotation}/${variant.id} terminal tick`);
      for (const [j, c] of world.contestants.entries()) {
        const observed = actual[i].contestants[j];
        assert.ok(Math.abs(observed.hp - c.hp) < 1e-7, `${scene}/${trialSeed}/${rotation}/${variant.id}/${c.id} HP`);
        assert.equal(observed.alive, c.alive);
        for (const key of ['x', 'y', 'z'] as const) {
          assert.ok(Math.abs(observed.position[key] - c.position[key]) < 1e-6, `${scene}/${trialSeed}/${rotation}/${variant.id}/${c.id} position.${key}`);
          assert.ok(Math.abs(observed.velocity[key] - c.velocity[key]) < 1e-6, `${scene}/${trialSeed}/${rotation}/${variant.id}/${c.id} velocity.${key}`);
        }
      }
    }
  }
  if (!uiOnly) console.log('Complete-match browser/headless agreement verified for 72 matched cases, including fresh seeds.');
  assert.deepEqual(errors, []);
  console.log(`Comparison checks passed (${production ? 'production' : 'development'}; Chromium ${browser.version()}): presets, short-window bounds/loop/restart, fresh-browser workspace recovery, save failure/retry, resize/enlarge, feedback export/import, queue decisions, invalid import, end hold, shared live scheduler.`);
} finally {
  await browser.close();
  rmSync(feedbackDirectory, { recursive: true, force: true });
  if ('close' in server) await server.close(); else await new Promise<void>((resolve, reject) => server.httpServer.close(e => e ? reject(e) : resolve()));
}
