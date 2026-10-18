import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ART_BRIEFS, ART_VARIANTS } from '../src/artDirectionExperiment';
import { createScenario, SIMULATION_DT } from '../src/scenario';

const feedbackDir = mkdtempSync(join(tmpdir(), 'art-comparison-'));
process.env.WIZARD_FEEDBACK_DIR = feedbackDir;
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors: string[] = [];
const out = 'runs-comparison-check/art-direction-v1'; mkdirSync(out, {recursive:true});
const rounded = (x: unknown) => JSON.parse(JSON.stringify(x, (_key,value) => typeof value === 'number' ? Math.round(value*1e7)/1e7 : value));
try {
  const page = await browser.newPage({viewport:{width:1440,height:1050}});
  page.on('pageerror', e => errors.push(e.message));
  const url = new URL('compare.html?experiment=art-direction-v1',server.resolvedUrls!.local[0]).href;
  await page.goto(url); await page.waitForFunction(() => !!window.comparison); await page.evaluate(() => window.comparison.ready());
  assert.deepEqual((await page.evaluate(() => window.comparison.metadata)).alternatives.map(v=>v.id), ART_VARIANTS.map(v=>v.id));
  assert.equal(await page.locator('.art-directions article').count(),5);
  assert.match(await page.locator('#comparison-page').innerText(),/starting proposal: A/);
  assert.equal(await page.getByRole('combobox',{name:'Preference',exact:true}).locator('option').count(),8);
  for (const brief of ART_BRIEFS) {
    await page.getByRole('button',{name:brief.title,exact:true}).click();
    const viewing = await page.evaluate(() => window.comparison.viewing());
    for (const [i,clip] of brief.clips.entries()) {
      assert.equal(viewing.panels[i].clip!.id,clip.id);
      assert.ok(Math.abs(viewing.panels[i].cursor-clip.start)<SIMULATION_DT);
    }
    // Last card gets the same independent behavior as the first pair.
    await page.getByRole('button',{name:'Play excerpt A',exact:true}).click();
    await page.waitForTimeout(200);
    await page.getByRole('button',{name:'Play excerpt E',exact:true}).click();
    const switched = await page.evaluate(() => window.comparison.viewing());
    assert.equal(switched.panels[0].playing,false); assert.equal(switched.panels[4].playing,true);
    await page.evaluate(() => window.comparison.pause());
    const before = await page.evaluate(() => window.comparison.states());
    await page.getByLabel('Excerpt time E',{exact:true}).focus(); await page.keyboard.press('End');
    assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0,4),before.slice(0,4));
    await page.getByRole('button',{name:'Replay excerpt E',exact:true}).click(); await page.evaluate(() => window.comparison.pause());
    assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0,4),before.slice(0,4));
  }
  await page.getByRole('button',{name:ART_BRIEFS[0].title,exact:true}).click();
  await page.getByLabel('Comment on evidence E',{exact:true}).fill('Automated recovery check for fifth direction.');
  await page.getByRole('button',{name:'Save evidence comment E',exact:true}).click();
  await page.waitForFunction(() => document.querySelectorAll('.comment-save')[4].textContent!.startsWith('Saved to workspace'));
  const note = (await page.evaluate(() => window.comparison.feedback())).notes.at(-1)!;
  assert.equal(note.evidence!.id,ART_BRIEFS[0].clips[4].id); assert.equal(note.experiment,'art-direction-v1');
  const fresh = await browser.newPage(); await fresh.goto(url); await fresh.waitForFunction(() => !!window.comparison); await fresh.evaluate(() => window.comparison.ready());
  assert.match(await fresh.locator('.review-status').nth(4).innerText(),/Commented/); await fresh.close();
  // A direction link must reveal its target even when another card is enlarged.
  await page.getByRole('button',{name:'Enlarge panel A',exact:true}).click();
  await page.getByRole('button',{name:'View Obsidian Foundry',exact:true}).click();
  assert.equal(await page.locator('.panel:visible').count(),1);
  assert.match(await page.locator('.panel:visible .panel-head strong').innerText(),/Obsidian Foundry/);
  await page.getByRole('button',{name:'Enlarge panel E',exact:true}).click();
  // Exercise geometry projection on enlarged, restored, narrow and paused canvases.
  for (const width of [1440,780]) {
    await page.setViewportSize({width,height:1050});
    await page.getByRole('button',{name:'Full fight E',exact:true}).click();
    await page.waitForTimeout(100);
    const size = await page.locator('.panel:visible canvas').evaluateAll(nodes=>nodes.map(n=>({width:(n as HTMLCanvasElement).width,css:Math.floor(n.getBoundingClientRect().width)})));
    assert.equal(size.length,1); assert.equal(size[0].width,size[0].css);
    await page.screenshot({path:`${out}/enlarged-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Enlarge panel E',exact:true}).click();
    await page.getByRole('button',{name:'Selected evidence',exact:true}).click();
  }
  // Complete baseline and fresh fights. Every visual panel must match the same world.
  for (const [scenario,seed] of [['duel',7],['four-wizards',19],['four-wizards',1],['duel',307],['four-wizards',211]] as const) {
    await page.evaluate(setup=>window.comparison.loadExample(setup),{scenario,seed,rotation:0});
    const states = await page.evaluate(()=>window.comparison.seek(120));
    const world = createScenario({scenario,seed,rotation:0,variant:'burst'});
    while(world.tick<7200 && world.contestants.filter(c=>c.alive).length>1) world.update(SIMULATION_DT);
    const expected = world.contestants.map(c=>({id:c.id,hp:c.hp,alive:c.alive,position:{...c.position},velocity:{...c.velocity}}));
    for(const state of states) assert.deepEqual(rounded(state.contestants),rounded(expected),`${scenario}/${seed}/${state.variant}`);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/result.json`,JSON.stringify({source:await page.evaluate(()=>window.comparison.metadata.source),passed:true,checks:['15 evidence identities','exclusive playback','fifth-panel scrub/replay independence','workspace comment recovery','wide/narrow enlargement','25 complete browser/headless fights'],browser:await browser.version()},null,2));
  console.log('Art comparison passed: 15 clips, independent controls, fifth-direction comment recovery, responsive enlargement and 25 complete browser/headless fights.');
} finally {
  await browser.close(); await new Promise<void>((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));
  rmSync(feedbackDir,{recursive:true,force:true});
}
