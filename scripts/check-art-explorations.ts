import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { explorationBriefs, explorationVariants } from '../src/artExplorationExperiment';
import { createScenario, SIMULATION_DT } from '../src/scenario';
const feedbackDir = mkdtempSync(join(tmpdir(), 'art-v3-')); process.env.WIZARD_FEEDBACK_DIR = feedbackDir;
const out = 'runs-comparison-check/art-direction-v3'; mkdirSync(out, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const rounded = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => typeof v === 'number' ? Math.round(v * 1e7) / 1e7 : v));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const base = new URL('compare.html?experiment=art-direction-v3', server.resolvedUrls!.local[0]).href;
  for (const family of ['photon', 'observatory', 'foundry']) {
    const url = `${base}&family=${family}`, briefs = explorationBriefs(family), variants = explorationVariants(family);
    await page.goto(url); await page.locator('#storage-gate').waitFor({ state: 'hidden' });
    assert.deepEqual((await page.evaluate(() => window.comparison.metadata.alternatives)).map(v => v.id), variants.map(v => v.id));
    assert.equal(await page.locator('.art-directions article').count(), 3);
    assert.equal(await page.locator('nav[aria-label="Art families"] a[aria-current="page"]').count(), 1);
    assert.match(await page.locator('#comparison-page').innerText(), /Porcelain Lab and Paper Theater are cut/);
    for (const brief of briefs) {
      await page.getByRole('button', { name: brief.title, exact: true }).click();
      const viewing = await page.evaluate(() => window.comparison.viewing());
      for (const [i, clip] of brief.clips.entries()) {
        assert.equal(viewing.panels[i].clip!.id, clip.id); assert.ok(Math.abs(viewing.panels[i].cursor - clip.start) < SIMULATION_DT);
      }
      await page.getByRole('button', { name: 'Play excerpt A', exact: true }).click(); await page.waitForTimeout(120);
      await page.getByRole('button', { name: 'Play excerpt C', exact: true }).click();
      const switched = await page.evaluate(() => window.comparison.viewing());
      assert.equal(switched.panels[0].playing, false); assert.equal(switched.panels[2].playing, true);
      await page.evaluate(() => window.comparison.pause());
      const before = await page.evaluate(() => window.comparison.states());
      await page.getByLabel('Excerpt time C', { exact: true }).focus(); await page.keyboard.press('End');
      assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0, 2), before.slice(0, 2));
      await page.getByRole('button', { name: 'Replay excerpt C', exact: true }).click(); await page.evaluate(() => window.comparison.pause());
      assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0, 2), before.slice(0, 2));
    }
    await page.getByRole('button', { name: briefs[1].title, exact: true }).click();
    await page.getByLabel('Comment on evidence C', { exact: true }).fill(`${family}: isolated browser test, third branch`);
    await page.getByRole('button', { name: 'Save evidence comment C', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.comment-save')[2].textContent!.startsWith('Saved to workspace'));
    const note = (await page.evaluate(() => window.comparison.feedback())).notes.at(-1)!;
    assert.equal(note.evidence!.id, briefs[1].clips[2].id);
    await page.reload(); await page.locator('#storage-gate').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.review-status').nth(2).innerText(), /Commented/);
    await page.getByRole('button', { name: 'Enlarge panel A', exact: true }).click();
    await page.getByRole('button', { name: `View ${variants[2].name}`, exact: true }).click();
    assert.equal(await page.locator('.panel:visible').count(), 1);
    assert.match(await page.locator('.panel:visible .panel-head strong').innerText(), new RegExp(variants[2].name));
    await page.getByRole('button', { name: 'Full fight C', exact: true }).click();
    for (const width of [1440, 780]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.waitForTimeout(80);
      const size = await page.locator('.panel:visible canvas').evaluate(n => ({ w: (n as HTMLCanvasElement).width, css: Math.floor(n.getBoundingClientRect().width) }));
      assert.equal(size.w, size.css);
      await page.screenshot({ path: `${out}/${family}-enlarged-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    // Fresh and screening seeds, including a complete browser/headless match.
    for (const [scenario, seed] of [['duel', 7], ['four-wizards', 19], ['four-wizards', 1], ['duel', 307], ['four-wizards', 211]] as const) {
      await page.evaluate(s => window.comparison.loadExample(s), { scenario, seed, rotation: 0 });
      const states = await page.evaluate(() => window.comparison.seek(120));
      const world = createScenario({ scenario, seed, rotation: 0, variant: 'burst' });
      while (world.tick < 7200 && world.contestants.filter(c => c.alive).length > 1) world.update(SIMULATION_DT);
      const expected = world.contestants.map(c => ({ id: c.id, hp: c.hp, alive: c.alive, position: { ...c.position }, velocity: { ...c.velocity } }));
      for (const state of states) assert.deepEqual(rounded(state.contestants), rounded(expected), `${family}/${scenario}/${seed}/${state.variant}`);
    }
    await page.goto(`${url}&baselines=1`); await page.locator('#storage-gate').waitFor({ state: 'hidden' });
    const baselineCount = family === 'photon' ? 2 : 1;
    const metadata = await page.evaluate(() => window.comparison.metadata);
    assert.deepEqual(metadata.alternatives.map(v => v.artDirection), explorationVariants(family, true).map(v => v.id));
    assert.equal(metadata.alternatives.length, 3 + baselineCount);
    assert.match(await page.locator('.panel-head strong').first().innerText(), /unchanged/);
    assert.match(await page.locator('.review-status').nth(2 + baselineCount).innerText(), /Commented/);
    assert.equal(await page.locator('.review-status').first().innerText(), 'Not reviewed');
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/result.json`, JSON.stringify({ source: await page.evaluate(() => window.comparison.metadata.source), passed: true, browser: await browser.version(), checks: ['27 excerpt identities', 'three family routes', 'independent play/scrub/replay', 'durable comments and baseline-view linkage', '45 complete browser/headless fights', 'wide/narrow enlargement', 'retained baseline identities'] }, null, 2));
  console.log('Art v3: 27 cards, durable comments, controls, baseline linkage and 45 complete browser/headless fights passed.');
} finally {
  await browser.close(); await new Promise<void>((resolve, reject) => server.httpServer.close(e => e ? reject(e) : resolve())); rmSync(feedbackDir, { recursive: true, force: true });
}
