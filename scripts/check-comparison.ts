import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { COMPARISON_BRIEFS } from '../src/comparisonEvidence';
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
  async function assertCanvasSizing(target = page) {
    // Let layout/ResizeObserver settle without a synthetic window resize.
    await target.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const sizes = await target.locator('.panel:visible canvas').evaluateAll(canvases => canvases.map(element => {
      const canvas = element as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, expectedWidth: Math.floor(rect.width), expectedHeight: Math.floor(rect.height) };
    }));
    assert.ok(sizes.length);
    for (const size of sizes) {
      assert.equal(size.width, size.expectedWidth, `drawing buffer width must match CSS: ${JSON.stringify(size)}`);
      assert.equal(size.height, size.expectedHeight, `drawing buffer height must match CSS: ${JSON.stringify(size)}`);
    }
  }
  const url = new URL('compare.html?capture=1&scenario=duel&seed=7', server.resolvedUrls!.local[0]);
  await page.goto(url.href); await page.waitForFunction(() => !!window.comparison);
  await assertCanvasSizing();
  await page.evaluate(() => window.comparison.ready());
  assert.equal(await page.locator('#filter').inputValue(), 'all');
  assert.equal(await page.locator('.expectation').count(), 7, 'approved starting goals are visible on first visit');
  assert.match(await page.locator('#expectation-counts').innerText(), /7 approved · 0 need your review/);
  await page.locator('#filter').selectOption('unreviewed');
  assert.match(await page.locator('#expectations').innerText(), /Nothing needs your review.*7 approved goals/);
  await page.getByRole('button', { name: 'View all goals', exact: true }).click();
  assert.equal(await page.locator('.expectation').count(), 7);
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
  const freshUrl = new URL(url); freshUrl.searchParams.delete('capture');
  await fresh.goto(freshUrl.href); await fresh.waitForFunction(() => !!window.comparison);
  await fresh.evaluate(() => window.comparison.ready());
  await assertCanvasSizing(fresh);
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
  assert.match(await page.locator('#expectations').innerText(), /Nothing needs your review.*8 approved goals/);
  await page.getByRole('button', { name: 'View all goals', exact: true }).click();
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
  // Every brief loads only its selected evidence at independent starting times.
  for (const brief of COMPARISON_BRIEFS) {
    await page.getByRole('button', { name: brief.title, exact: true }).click();
    assert.equal(await page.locator('.panel:visible').count(), 2);
    await assertCanvasSizing();
    assert.equal(await page.locator('#full-controls').isVisible(), false);
    const view = await page.evaluate(() => window.comparison.viewing());
    assert.equal(view.mode, 'evidence');
    assert.ok(view.panels.every(p => !p.playing));
    for (const clip of brief.clips) {
      const index = VARIANTS.findIndex(v => v.id === clip.variant);
      assert.equal(view.panels[index].cursor, clip.start);
      const panel = page.locator('.panel').nth(index);
      assert.match(await panel.locator('.watch-for').innerText(), /./);
      assert.equal(await panel.locator('.clip-time').getAttribute('max'), String(clip.end));
      const before = await page.evaluate(() => window.comparison.states());
      await panel.locator('.clip-time').evaluate((el, seconds) => { (el as HTMLInputElement).value = String(seconds); el.dispatchEvent(new Event('input')); }, (clip.start + clip.end) / 2);
      const after = await page.evaluate(() => window.comparison.states());
      for (let i = 0; i < before.length; i++) if (i !== index) assert.deepEqual(after[i], before[i], 'scrubbing never moves another clip');
      const world = createScenario({ scenario: brief.scenario, seed: brief.seed, variant: clip.variant });
      while (world.tick < Math.round(((clip.start + clip.end) / 2) / SIMULATION_DT) && world.contestants.filter(c => c.alive).length > 1) world.update(SIMULATION_DT);
      assert.equal(after[index].tick, world.tick);
      for (const [j, c] of world.contestants.entries()) assert.ok(Math.abs(after[index].contestants[j].hp - c.hp) < 1e-7, 'excerpt reconstructs its exact fight state');
    }
    const stateBeforeLayout = await page.evaluate(() => window.comparison.states());
    await page.locator('.panel:visible .panel-head button').first().click();
    await assertCanvasSizing();
    await page.locator('.panel:visible .panel-head button').first().click();
    await assertCanvasSizing();
    await page.locator('#app').evaluate(el => { el.style.maxWidth = '1000px'; });
    await assertCanvasSizing();
    await page.locator('#app').evaluate(el => { el.style.maxWidth = ''; });
    await assertCanvasSizing();
    assert.deepEqual(await page.evaluate(() => window.comparison.states()), stateBeforeLayout, 'layout-only resizes leave every replay unchanged');
    await page.locator('#panels').screenshot({ path: `${output}/evidence-${brief.id}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCanvasSizing();
  await page.setViewportSize({ width: 1200, height: 900 });
  await assertCanvasSizing();
  await page.getByRole('button', { name: '2 · When movement stalls', exact: true }).click();
  await page.getByRole('button', { name: 'Play excerpt B', exact: true }).click();
  await page.waitForFunction(() => window.comparison.states()[1].time > 40.1);
  assert.equal((await page.evaluate(() => window.comparison.states()))[2].tick, 480);
  await page.getByRole('button', { name: 'Play excerpt C', exact: true }).click();
  const held = (await page.evaluate(() => window.comparison.states()))[1];
  await page.waitForFunction(() => window.comparison.states()[2].time > 8.1);
  assert.deepEqual((await page.evaluate(() => window.comparison.states()))[1], held, 'switching clips pauses the previous one');
  assert.equal((await page.evaluate(() => window.comparison.viewing())).panels.filter(p => p.playing).length, 1);
  await page.evaluate(() => window.comparison.pause());
  await page.getByRole('button', { name: 'Replay excerpt B', exact: true }).click();
  await page.evaluate(() => window.comparison.pause());
  assert.ok((await page.evaluate(() => window.comparison.states()))[1].time < 40.5);
  const b = page.locator('.panel').nth(1);
  await b.locator('.clip-time').evaluate(el => { (el as HTMLInputElement).value = '45.9'; el.dispatchEvent(new Event('input')); });
  await page.getByRole('button', { name: 'Play excerpt B', exact: true }).click();
  await page.waitForFunction(() => !window.comparison.viewing().panels[1].playing);
  assert.equal((await page.evaluate(() => window.comparison.states()))[1].tick, 2760, 'excerpt stops at its own endpoint');
  await b.locator('.clip-loop').check();
  await b.locator('.clip-time').evaluate(el => { (el as HTMLInputElement).value = '45.9'; el.dispatchEvent(new Event('input')); });
  await page.getByRole('button', { name: 'Play excerpt B', exact: true }).click();
  await page.waitForFunction(() => window.comparison.states()[1].time < 41);
  await page.evaluate(() => window.comparison.pause());
  await page.getByLabel('Viewing note').fill('B stall versus C payoff');
  await page.getByRole('button', { name: 'Save timestamped note' }).click();
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Saved to runs-feedback/'));
  const evidenceNote = await page.evaluate(() => window.comparison.feedback().notes.at(-1)!);
  assert.equal(evidenceNote.viewing?.mode, 'evidence');
  assert.equal(evidenceNote.viewing?.focusedVariant, 'measured');
  assert.deepEqual(evidenceNote.viewing?.clips.map(c => [c.start, c.end]), [[40, 46], [8, 12]]);
  assert.notEqual(evidenceNote.panelTimes[1], evidenceNote.panelTimes[2]);
  await page.reload(); await page.waitForFunction(() => !!window.comparison); await page.evaluate(() => window.comparison.ready());
  assert.deepEqual(await page.evaluate(() => window.comparison.feedback().notes.at(-1)), evidenceNote);
  await page.getByRole('button', { name: 'Selected evidence', exact: true }).click();
  await page.getByRole('button', { name: 'Full fight C', exact: true }).click();
  assert.equal((await page.evaluate(() => window.comparison.viewing())).mode, 'full');
  await assertCanvasSizing();
  assert.equal(await page.locator('.panel.selected strong').innerText(), 'C · Bursts and resets');
  await page.getByRole('button', { name: 'Enlarge panel C', exact: true }).click();
  await page.evaluate(() => window.comparison.play());
  await page.waitForFunction(() => window.comparison.states()[0].tick > 0);
  await page.evaluate(() => window.comparison.pause());
  const live = await page.evaluate(() => window.comparison.states()); assert.equal(new Set(live.map(s => s.tick)).size, 1);
  await page.evaluate(() => window.comparison.loadExample({ scenario: 'duel', seed: 211, rotation: 0 }));
  assert.equal((await page.evaluate(() => window.comparison.viewing())).mode, 'full', 'custom setups never invent generic evidence windows');
  assert.equal(await page.locator('#show-evidence').isDisabled(), true);
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
  console.log(`Comparison checks passed (${production ? 'production' : 'development'}; Chromium ${browser.version()}): curated independent excerpts, exclusive playback, per-clip seek/loop/replay, evidence note context, fresh-browser workspace recovery, save failure/retry, resize/enlarge, feedback export/import, queue decisions, invalid import, end hold, shared live scheduler.`);
} finally {
  await browser.close();
  rmSync(feedbackDirectory, { recursive: true, force: true });
  if ('close' in server) await server.close(); else await new Promise<void>((resolve, reject) => server.httpServer.close(e => e ? reject(e) : resolve()));
}
