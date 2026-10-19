import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'runs-captures/art-direction-v3/inspection'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const family of ['photon', 'observatory', 'foundry']) {
    await page.goto(`http://localhost:5173/compare.html?experiment=art-direction-v3&family=${family}`);
    await page.waitForFunction(() => !!window.comparison); await page.locator('#storage-gate').waitFor({ state: 'hidden' });
    for (const setup of [{ name: 'intersection', scenario: 'four-wizards', seed: 19, time: 7.1 }, { name: 'crowd', scenario: 'four-wizards', seed: 1, time: 1.1 }, { name: 'duel', scenario: 'duel', seed: 7, time: 10 }]) {
      await page.evaluate(s => { window.comparison.loadExample({ scenario: s.scenario, seed: s.seed, rotation: 0 }); window.comparison.seek(s.time); }, setup);
      for (let i = 0; i < 3; i++) {
        await page.locator('.panel').nth(i).locator('.panel-head button').click();
        await page.locator('.panel canvas').nth(i).screenshot({ path: `${out}/${family}-${setup.name}-${i}.png` });
        await page.locator('.panel').nth(i).locator('.panel-head button').click();
      }
    }
  }
  writeFileSync(`${out}/errors.json`, JSON.stringify(errors));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`27 enlarged render samples: ${out}`);
} finally { await browser.close(); }
