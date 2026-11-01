import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = server.resolvedUrls!.local[0];
  await page.goto(base);
  await page.getByRole('heading', { name: 'The experiment library' }).waitFor();
  const links = await page.locator('h3 a').evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href));
  const metadata = await Promise.all((await readdir('src/experiments')).filter(file => file.endsWith('.ts')).map(async file =>
    (await import(`../src/experiments/${file}`)).default));
  assert.deepEqual([...links].sort(), metadata.map(entry => new URL(entry.href, base).href).sort());
  for (const link of links) {
    await page.goto(link);
    if (new URL(link).pathname.endsWith('/compare.html')) await page.waitForFunction(() => !!(window as any).comparison);
    assert.ok(await page.locator('h1').textContent());
    await page.getByRole('link', { name: 'Wizard Battles / All experiments' }).click();
    await page.getByRole('heading', { name: 'The experiment library' }).waitFor();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'runs-comparison-check/portal-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'runs-comparison-check/portal-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Watch a match right now' }).click();
  await page.waitForFunction(() => !!(window as any).battle);
  await page.getByRole('link', { name: 'All experiments' }).click();
  await page.getByRole('heading', { name: 'The experiment library' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Portal: every published round, return navigation, mobile layout and live match verified.');
} finally {
  await browser.close();
  await server.close();
}
