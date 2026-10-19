import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const feedbackDirectory = mkdtempSync(join(tmpdir(), 'wizard-controls-'));
process.env.WIZARD_FEEDBACK_DIR = feedbackDirectory;
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const output = 'runs-comparison-check/controls'; mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  async function open(query: string) {
    await page.goto(new URL(`compare.html?${query}`, server.resolvedUrls.local[0]).href);
    await page.waitForFunction(() => !!window.comparison);
    await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  }
  await open('experiment=art-direction-v3&family=photon');
  assert.equal(await page.locator('.panel:visible').count(), 5, 'both Photon baselines included by default');
  assert.equal(await page.getByText('Include retained baselines', { exact: true }).count(), 0);
  assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.every(p => p.playing));
  assert.ok(await page.locator('.clip-loop').evaluateAll(els => els.every(el => (el as HTMLInputElement).checked)));
  await page.waitForFunction(() => window.comparison.viewing().panels.every(p => p.cursor > p.clip!.start));
  const first = page.locator('.panel').first();
  await first.locator('.clip-play').click();
  const held = (await page.evaluate(() => window.comparison.states()))[0];
  assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.slice(1).every(p => p.playing));
  await page.waitForFunction(() => window.comparison.viewing().panels[1].cursor > 6.5);
  assert.deepEqual((await page.evaluate(() => window.comparison.states()))[0], held);
  // Paused cards remain paused across setup changes; untouched cards still autoplay.
  await page.locator('#presets button').first().click();
  const switched = await page.evaluate(() => window.comparison.viewing());
  assert.equal(switched.panels[0].playing, false);
  assert.ok(switched.panels.slice(1).every(p => p.playing));
  await page.locator('#presets button').nth(1).click();
  // Seek a running card to its end and verify default looping wraps it.
  const second = page.locator('.panel').nth(1);
  await second.locator('.clip-time').evaluate(el => { (el as HTMLInputElement).value = '9.783333333333333'; el.dispatchEvent(new Event('input')); });
  await second.locator('.clip-play').click();
  await page.waitForFunction(() => window.comparison.viewing().panels[1].cursor < 6.5);
  assert.equal((await page.evaluate(() => window.comparison.viewing())).panels[1].playing, true);
  // Inspect selected card exactly while all unpaused alternatives continue.
  await first.locator('.panel-head button').click();
  const cursor = () => page.evaluate(() => window.comparison.viewing().panels[0].cursor);
  const start = await cursor();
  await page.keyboard.press('ArrowRight'); assert.ok(Math.abs(await cursor() - start - .5) < 1e-9);
  await page.keyboard.press('.'); assert.ok(Math.abs(await cursor() - start - .5 - 1/60) < 1e-9);
  await page.keyboard.press(','); assert.ok(Math.abs(await cursor() - start - .5) < 1e-9);
  await page.keyboard.press('ArrowLeft'); assert.equal(await cursor(), start);
  await page.keyboard.press('Space'); assert.equal((await page.evaluate(() => window.comparison.viewing())).panels[0].playing, true);
  await page.keyboard.press('Space'); assert.equal((await page.evaluate(() => window.comparison.viewing())).panels[0].playing, false);
  await page.keyboard.press('Control+ArrowRight');
  assert.equal(await page.locator('.panel.selected strong').innerText(), 'B · Photon Chamber · round 2 unchanged');
  await page.locator('.panel.selected .next-variant').click();
  assert.match(await page.locator('.panel.selected strong').innerText(), /Calibration Hall/);
  await page.keyboard.press('Control+ArrowLeft');
  await page.keyboard.press('Control+ArrowLeft');
  assert.match(await page.locator('.panel.selected strong').innerText(), /round 1 unchanged/);
  await page.keyboard.press('Control+ArrowLeft');
  assert.match(await page.locator('.panel.selected strong').innerText(), /Wave Chamber/);
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Tab');
  assert.equal(await first.locator('.comment-text').evaluate(el => el === document.activeElement), true);
  const beforeTyping = await cursor();
  await page.keyboard.type('Controls test: a spell, a pause.');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Space');
  assert.equal(await cursor(), beforeTyping, 'typing never seeks or starts playback');
  await page.keyboard.press('Tab');
  assert.equal(await first.locator('.save-comment').evaluate(el => el === document.activeElement), true, 'Tab can leave comment field');
  await first.locator('.comment-text').focus();
  await page.keyboard.press('Control+Enter');
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  assert.match(await first.locator('.comment-save').innerText(), /Saved to workspace/);
  const saved = (await (await page.request.get(new URL('api/feedback', server.resolvedUrls.local[0]).href)).json()).feedback.notes;
  assert.equal(saved.length, 1); assert.equal(saved[0].evidence.variant, 'photon');
  assert.equal((await page.evaluate(() => window.comparison.viewing())).panels[0].playing, false, 'save never resumes an explicitly paused card');
  assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.slice(1).every(p => p.playing), 'save resumes temporarily suspended cards');
  // Storage lock blocks keyboard shortcuts and freezes the entire room.
  await page.route('**/api/feedback/health', route => route.fulfill({ status: 503, body: '{}' }));
  await page.locator('#storage-gate').waitFor({ state: 'visible', timeout: 10000 });
  const locked = await page.evaluate(() => window.comparison.states());
  await page.keyboard.press('Control+ArrowRight'); await page.keyboard.press('Space'); await page.keyboard.press('.');
  assert.deepEqual(await page.evaluate(() => window.comparison.states()), locked);
  assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.every(p => !p.playing));
  await page.unroute('**/api/feedback/health');
  await page.locator('#storage-reconnect').click();
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(() => window.comparison.viewing())).panels[0].playing, false);
  await page.evaluate(() => window.comparison.pause());
  await page.screenshot({ path: `${output}/enlarged-wide.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/enlarged-narrow.png`, fullPage: true });
  const geometry = await first.locator('canvas').evaluate(el => ({ width: el.width, expected: Math.floor(el.getBoundingClientRect().width), overflow: document.documentElement.scrollWidth > innerWidth }));
  assert.equal(geometry.width, geometry.expected); assert.equal(geometry.overflow, false);
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const family of ['observatory', 'foundry']) {
    await open(`experiment=art-direction-v3&family=${family}&baselines=0`);
    assert.equal(await page.locator('.panel:visible').count(), 4);
    assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.every(p => p.playing));
    await page.evaluate(() => window.comparison.pause());
  }
  await open('experiment=art-direction-v2&capture=1');
  await page.locator('#show-evidence').click();
  assert.equal(await page.locator('.panel:visible').count(), 7, 'round-two main view includes both retained baselines');
  assert.ok((await page.evaluate(() => window.comparison.viewing())).panels.every(p => !p.playing), 'capture URL suppresses autoplay');
  assert.deepEqual(errors, []);
  console.log('Comparison controls passed: default simultaneous looping, independent pause/seek, setup changes, enlarged navigation/shortcuts, durable keyboard comments, lock/recovery, responsive sizing, inline baselines and capture stability.');
} finally {
  await browser.close(); await new Promise<void>(resolve => server.httpServer.close(() => resolve())); rmSync(feedbackDirectory, { recursive: true, force: true });
}
