/** npm run capture -- --seed 1 --time 8 --duration 2 --fps 30 --out captures/example */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const allowed = new Set(['url', 'scenario', 'seed', 'variant', 'visualSeed', 'rotation', 'time', 'duration', 'fps', 'width', 'height', 'out', 'effects', 'trails']);
const flags = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!allowed.has(key) || args[i + 1] === undefined) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  flags.set(key, args[i + 1]);
}
function number(key: string, fallback: number) {
  const value = flags.has(key) ? Number(flags.get(key)) : fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key}`);
  return value;
}
const fps = number('fps', 30);
if (!Number.isInteger(fps) || fps < 1 || fps > 60 || 60 % fps) throw new Error('fps must divide 60 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60)');
const time = number('time', 0);
const duration = number('duration', 0);
const width = number('width', 1280), height = number('height', 720);
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('width and height must be positive integers');
const output = resolve(flags.get('out') ?? `captures/seed-${flags.get('seed') ?? 1}`);
await mkdir(output, { recursive: true });
const url = new URL(flags.get('url') ?? 'http://127.0.0.1:5173/watch.html');
url.searchParams.set('capture', '1');
url.searchParams.set('time', String(time));
for (const key of ['scenario', 'seed', 'variant', 'visualSeed', 'rotation', 'effects', 'trails']) if (flags.has(key)) url.searchParams.set(key, flags.get(key)!);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url.href);
  await page.waitForFunction(() => !!(window as any).battle, { timeout: 30_000 });
  const metadata = await page.evaluate(() => (window as any).battle.metadata);
  const firstState = await page.evaluate(() => (window as any).battle.state());
  const frames = duration > 0 ? Math.max(1, Math.round(duration * fps)) : 1;
  const states: unknown[] = [];
  for (let frame = 0; frame < frames; frame++) {
    if (frame) await page.evaluate(count => (window as any).battle.step(count), 60 / fps);
    else await page.evaluate(() => (window as any).battle.render());
    await page.locator('#arena').screenshot({ path: `${output}/frame-${String(frame).padStart(5, '0')}.png` });
    states.push(await page.evaluate(() => (window as any).battle.state()));
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  await writeFile(`${output}/capture.json`, JSON.stringify({ ...metadata, url: url.href, requestedTime: time, startTime: firstState.time, duration, fps, frames, states }, null, 2));
  if (frames > 1) {
    const encoded = spawnSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', `${output}/frame-%05d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${output}/clip.mp4`], { encoding: 'utf8' });
    if (encoded.error && (encoded.error as NodeJS.ErrnoException).code === 'ENOENT') console.log('ffmpeg unavailable; PNG frame sequence and metadata saved.');
    else if (encoded.status !== 0) throw new Error(encoded.stderr || 'ffmpeg failed');
  }
  console.log(`Captured ${frames} frame(s): ${output}`);
} finally { await browser.close(); }
