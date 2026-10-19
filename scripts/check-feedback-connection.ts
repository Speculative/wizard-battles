import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
const exec = promisify(execFile);
const temp = mkdtempSync(join(tmpdir(), 'wizard-storage-'));
const socket = createServer();
await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
const port = (socket.address() as { port: number }).port;
await new Promise<void>(r => socket.close(() => r()));
const env = { ...process.env, WIZARD_DEV_PORT: String(port), WIZARD_SERVER_DIR: join(temp, 'server'), WIZARD_FEEDBACK_DIR: join(temp, 'feedback') };
const control = (command: string) => exec(process.execPath, ['scripts/dev-server.mjs', command], { env });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  mkdirSync('runs-comparison-check/feedback-connection', { recursive: true });
  await control('start');
  const status = JSON.parse((await control('status')).stdout);
  assert.equal(status.healthy, true);
  // Controller has exited; server has no terminal/pipes and is adopted independently.
  const parent = (await exec('ps', ['-o', 'ppid=', '-p', String(status.pid)])).stdout.trim();
  assert.equal(Number(parent), 1, 'detached server is adopted by container init');
  const session = (await exec('ps', ['-o', 'sid=', '-p', String(status.pid)])).stdout.trim();
  assert.equal(Number(session), status.pid, 'server owns an independent process session');
  const url = `http://127.0.0.1:${port}/compare.html?experiment=art-direction-v1`;
  const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => !!window.comparison);
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  const comment = page.locator('.panel').first();
  await comment.locator('.comment-text').fill('Confirmed feedback survives a server restart.');
  await comment.locator('.save-comment').click();
  await comment.locator('.comment-save').filter({ hasText: 'Saved to workspace.' }).waitFor();
  assert.match(await comment.locator('.review-status').innerText(), /Commented · 1/);
  const files = readdirSync(env.WIZARD_FEEDBACK_DIR);
  assert.ok(files.some(file => JSON.parse(readFileSync(join(env.WIZARD_FEEDBACK_DIR, file), 'utf8')).feedback.notes.some((n: { text: string }) => n.text === 'Confirmed feedback survives a server restart.')));
  // A server can vanish between the latest heartbeat and pressing Comment.
  await page.route('**/api/feedback', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
  await comment.locator('.comment-text').fill('Pending feedback must not claim to be saved.');
  await comment.locator('.save-comment').click();
  await page.locator('#storage-gate').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
  assert.match(await comment.locator('.review-status').innerText(), /Commented · 1/);
  assert.equal(await comment.locator('.comment-text').inputValue(), 'Pending feedback must not claim to be saved.');
  await page.reload();
  await page.waitForFunction(() => !!window.comparison);
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Workspace save failed'));
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
  await page.unroute('**/api/feedback');
  await page.locator('#storage-reconnect').click();
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  assert.match(await comment.locator('.review-status').innerText(), /Commented · 2/);
  // Real process shutdown, rather than a mocked request failure.
  await comment.locator('.clip-play').click();
  await control('stop');
  await page.locator('#storage-gate').waitFor({ state: 'visible', timeout: 12000 });
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
  assert.equal((await page.evaluate(() => window.comparison.viewing())).panels.some(p => p.playing), false);
  await page.screenshot({ path: 'runs-comparison-check/feedback-connection/offline.png' });
  await control('start');
  await page.locator('#storage-gate').waitFor({ state: 'hidden', timeout: 15000 });
  const fresh = await browser.newPage();
  await fresh.goto(url); await fresh.locator('#storage-gate').waitFor({ state: 'hidden' });
  assert.equal((await fresh.evaluate(() => window.comparison.feedback())).notes.length, 2);
  // A healthy HTTP response without an explicit persistence receipt is a failure.
  await page.route('**/api/feedback', route => route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : route.continue());
  await comment.locator('.comment-text').fill('Require an explicit persistence receipt.');
  await comment.locator('.save-comment').click();
  await page.waitForFunction(() => document.querySelector('#storage-gate-message')!.textContent!.includes('did not confirm persistence'));
  assert.match(await comment.locator('.review-status').innerText(), /Commented · 2/);
  await page.unroute('**/api/feedback');
  await page.locator('#storage-reconnect').click();
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  const response = await page.request.get(`http://127.0.0.1:${port}/api/feedback`);
  assert.equal((await response.json()).feedback.notes.length, 3);
  // Server accepted the note but its response was lost: retry must not duplicate it.
  await page.route('**/api/feedback', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('connectionfailed');
  });
  await comment.locator('.comment-text').fill('Lost acknowledgement still yields one comment.');
  await comment.locator('.save-comment').click();
  await page.waitForFunction(() => document.querySelector('#save-status')!.textContent!.startsWith('Workspace save failed'));
  await page.unroute('**/api/feedback');
  await page.locator('#storage-reconnect').click();
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  const afterRetry = await (await page.request.get(`http://127.0.0.1:${port}/api/feedback`)).json();
  assert.equal(afterRetry.feedback.notes.length, 4);
  assert.equal(afterRetry.feedback.notes.filter((n: { text: string }) => n.text === 'Lost acknowledgement still yields one comment.').length, 1);
  await page.screenshot({ path: 'runs-comparison-check/feedback-connection/recovered.png' });
  await control('restart');
  await page.locator('#storage-reconnect').evaluate((el: HTMLButtonElement) => el.click());
  await page.locator('#storage-gate').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  console.log('Feedback checks passed: detached lifecycle, fsynced receipt, blocked offline room, pending-save reload/retry, no false reviewed status, restart and fresh-browser recovery.');
} catch (error) {
  try { console.error(readFileSync(join(temp, 'server/server.log'), 'utf8')); } catch {}
  throw error;
} finally {
  await browser.close(); await control('stop'); rmSync(temp, { recursive: true, force: true });
}
