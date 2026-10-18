import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { initialExpectations } from '../src/expectations';
import { SPELL_BRIEFS as ORIGINAL_BRIEFS, SPELL_EXPERIMENT as ORIGINAL_EXPERIMENT } from '../src/spellReadabilityExperiment';
import { REVISION_BRIEFS, REVISION_EXPERIMENT } from '../src/spellReadabilityRevision';
const revision = process.argv.includes('--revision');
const SPELL_BRIEFS = revision ? REVISION_BRIEFS : ORIGINAL_BRIEFS;
const SPELL_EXPERIMENT = revision ? REVISION_EXPERIMENT : ORIGINAL_EXPERIMENT;
const variants = revision ? ['cues', 'rings', 'reaction'] : ['current', 'cues'];

const feedbackDirectory = mkdtempSync(join(tmpdir(), 'spell-feedback-check-'));
process.env.WIZARD_FEEDBACK_DIR = feedbackDirectory;
const production = process.argv.includes('--production');
const server = production ? await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }) : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
if ('listen' in server) await server.listen();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
mkdirSync('runs-comparison-check', { recursive: true });
const round = (x: unknown) => JSON.parse(JSON.stringify(x, (_key, value) => typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
try {
  const fixture = { schema: 'wizard-battles-feedback-v1', expectations: initialExpectations(), notes: [{
    at: new Date().toISOString(), experiment: 'movement-pacing-v1', source: 'fixture', scenario: 'duel', seed: 7, rotation: 0, time: 1,
    panelTimes: [1, 1, 1], variants: ['baseline', 'measured', 'burst'], preference: 'C', text: 'Movement-only feedback must not appear as spell feedback.',
  }] };
  const seeded = await fetch(new URL('api/feedback', server.resolvedUrls!.local[0]), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fixture) });
  assert.ok(seeded.ok);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const url = new URL(`compare.html?experiment=${SPELL_EXPERIMENT.id}`, server.resolvedUrls!.local[0]);
  await page.goto(url.href); await page.waitForFunction(() => !!window.comparison);
  await page.evaluate(() => window.comparison.ready());
  await page.waitForFunction(() => document.querySelectorAll('#reviews > details > summary').length >= 3);
  const reviewHeadings = await page.locator('#reviews > details > summary').allTextContents();
  for (const persona of ['Fighting-game spectator', 'mage-fight fan', 'Systems-curious spectator']) {
    assert.ok(reviewHeadings.some(text => text.startsWith(`${persona}: `)), `visible persona attribution: ${persona}`);
  }
  assert.equal(await page.locator('.panel:visible').count(), variants.length);
  assert.doesNotMatch(await page.locator('#notes-list').innerText(), /Movement-only feedback/);
  assert.ok((await page.evaluate(() => window.comparison.feedback())).notes.some(n => n.experiment === 'movement-pacing-v1'), 'other experiment feedback stays stored');
  for (const brief of SPELL_BRIEFS) {
    await page.getByRole('button', { name: brief.title, exact: true }).click();
    const initial = await page.evaluate(() => window.comparison.states());
    const viewing = await page.evaluate(() => window.comparison.viewing());
    assert.equal(viewing.mode, 'evidence');
    for (const [i, clip] of brief.clips.entries()) {
      assert.equal(viewing.panels[i].clip!.id, clip.id);
      assert.ok(Math.abs(initial[i].time - clip.start) < SIMULATION_DT);
      assert.ok(await page.getByText(clip.watchFor, { exact: true }).isVisible());
    }
    await page.getByRole('button', { name: 'Play excerpt A', exact: true }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Play excerpt B', exact: true }).click();
    const switching = await page.evaluate(() => window.comparison.viewing());
    assert.equal(switching.panels[0].playing, false); assert.equal(switching.panels[1].playing, true);
    await page.evaluate(() => window.comparison.pause());
    const before = await page.evaluate(() => window.comparison.states());
    await page.getByLabel('Excerpt time B', { exact: true }).focus();
    await page.keyboard.press('End');
    assert.deepEqual((await page.evaluate(() => window.comparison.states()))[0], before[0]);
    await page.getByRole('button', { name: 'Replay excerpt B', exact: true }).click();
    await page.evaluate(() => window.comparison.pause());
    assert.deepEqual((await page.evaluate(() => window.comparison.states()))[0], before[0]);
    if (revision) {
      const beforeC = await page.evaluate(() => window.comparison.states());
      await page.getByRole('button', { name: 'Play excerpt C', exact: true }).click();
      await page.waitForTimeout(150);
      await page.evaluate(() => window.comparison.pause());
      const afterC = await page.evaluate(() => window.comparison.states());
      assert.deepEqual(afterC.slice(0, 2), beforeC.slice(0, 2));
      assert.ok(afterC[2].time > beforeC[2].time);
    }
    await page.screenshot({ path: `runs-comparison-check/${brief.id}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: SPELL_BRIEFS[0].title, exact: true }).click();
  await page.getByLabel('Comment on evidence B', { exact: true }).fill('Automated check: exact spell evidence context.');
  await page.getByRole('button', { name: 'Save evidence comment B', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.panel:nth-child(2) .comment-save')!.textContent!.startsWith('Saved to workspace'));
  const note = (await page.evaluate(() => window.comparison.feedback())).notes.at(-1)!;
  assert.equal(note.experiment, SPELL_EXPERIMENT.id); assert.equal(note.evidence!.id, SPELL_BRIEFS[0].clips[1].id);
  assert.deepEqual(note.variants, variants);
  const fresh = await browser.newPage(); await fresh.goto(url.href); await fresh.waitForFunction(() => !!window.comparison);
  await fresh.evaluate(() => window.comparison.ready());
  assert.ok((await fresh.evaluate(() => window.comparison.feedback())).notes.some(n => n.evidence?.id === note.evidence!.id));
  assert.match(await fresh.locator('.panel:nth-child(2) .review-status').innerText(), /Commented/); await fresh.close();
  await page.getByRole('button', { name: 'Full fight B', exact: true }).click();
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const sizes = await page.locator('.panel:visible canvas').evaluateAll(list => list.map(el => { const c=el as HTMLCanvasElement;return {width:c.width,css:Math.floor(c.getBoundingClientRect().width)}; }));
  assert.equal(sizes.length, 1); assert.equal(sizes[0].width, sizes[0].css); assert.ok(sizes[0].width > 1200);
  await page.getByRole('button', { name: 'Enlarge panel B', exact: true }).click();
  // Complete browser fights, including fresh seeds and the awkward four-way timeout.
  for (const scenario of ['duel', 'four-wizards']) for (const seed of [1, 7, 19, 42, 101, 211, 307]) for (const rotation of [0, Math.PI / 2]) {
    await page.evaluate(setup => window.comparison.loadExample(setup), { scenario, seed, rotation });
    const states = await page.evaluate(() => window.comparison.seek(120));
    const world = createScenario({ scenario, seed, rotation, variant: 'burst' });
    while (world.tick < 7200 && world.contestants.filter(c => c.alive).length > 1) world.update(SIMULATION_DT);
    const expected = world.contestants.map(c => ({ id:c.id,hp:c.hp,alive:c.alive,position:{...c.position},velocity:{...c.velocity} }));
    for (const state of states) assert.deepEqual(round(state.contestants), round(expected), `${scenario}/${seed}/${rotation}/${state.variant}`);
  }
  assert.deepEqual(errors, []);
  console.log(`Spell comparison passed (${production ? 'production' : 'development'}): 3 evidence sets (${variants.length} alternatives), independent controls, durable comments/recovery, enlargement, and 28 complete browser/headless setups × ${variants.length} visuals.`);
} finally {
  await browser.close();
  if ('httpServer' in server) await server.close(); else await new Promise<void>((resolve, reject) => server.httpServer.close(e => e ? reject(e) : resolve()));
  rmSync(feedbackDirectory, { recursive: true, force: true });
}
