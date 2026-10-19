import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const flags = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  if (!['--experiment', '--scenario', '--seed', '--rotation', '--time', '--duration', '--fps', '--out', '--variant', '--family', '--baselines'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown/incomplete option ${args[i]}`);
  flags.set(args[i].slice(2), args[i + 1]);
}
const numeric = (key: string, fallback: number) => Number(flags.get(key) ?? fallback);
const fps = numeric('fps', 10), start = numeric('time', 0), duration = numeric('duration', 20);
if (!Number.isInteger(fps) || fps < 1 || 60 % fps !== 0 || !Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration < 0 || start + duration > 120) throw new Error('fps must divide 60; time/duration must fit 0–120 seconds');
const output = resolve(flags.get('out') ?? `runs-captures/${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const url = new URL('compare.html?capture=1', server.resolvedUrls!.local[0]);
  for (const key of ['experiment', 'scenario', 'seed', 'rotation', 'family', 'baselines']) if (flags.has(key)) url.searchParams.set(key, flags.get(key)!);
  await page.goto(url.href); await page.waitForFunction(() => !!window.comparison);
  await page.evaluate(time => window.comparison.seek(time), start);
  const variant = flags.get('variant');
  if (variant) {
    const index = (await page.evaluate(() => window.comparison.metadata.alternatives)).findIndex(v => v.id === variant);
    if (index < 0) throw new Error(`Unknown capture variant: ${variant}`);
    await page.locator('.panel').nth(index).locator('.panel-head button').click();
  }
  const states = [];
  const count = duration === 0 ? 1 : Math.round(duration * fps);
  for (let i = 0; i < count; i++) {
    if (i) await page.evaluate(ticks => window.comparison.step(ticks), 60 / fps);
    states.push({ frame: i, requestedTime: start + i / fps, panels: await page.evaluate(() => window.comparison.states()) });
    await page.locator('#panels').screenshot({ path: `${output}/frame-${String(i).padStart(5, '0')}.png` });
  }
  const metadata = await page.evaluate(() => window.comparison.metadata);
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(`${output}/capture.json`, JSON.stringify({ metadata, url: url.href, viewport: { width: 1440, height: 1050 }, focusedVariant: variant ?? null, fps, start, duration, frames: states }, null, 2));
  if (duration > 0) {
    const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${output}/frame-%05d.png`, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${output}/clip.mp4`], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(`ffmpeg failed: ${encoded.stderr || encoded.error}`);
  }
  console.log(`Saved ${count} synchronized frames${duration ? ' and clip.mp4' : ''}: ${output}`);
} finally { await browser.close(); await server.close(); }
