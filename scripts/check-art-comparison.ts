import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { revisionBriefs, revisionVariants } from '../src/artDirectionRevision';
import { ART_BRIEFS, ART_VARIANTS } from '../src/artDirectionExperiment';
import { createScenario, SIMULATION_DT } from '../src/scenario';

const revision = process.argv.includes('--revision');
const briefs = revision ? revisionBriefs(null) : ART_BRIEFS;
const variants = revision ? revisionVariants(null) : ART_VARIANTS;
const experimentId = revision ? 'art-direction-v2' : 'art-direction-v1';
const feedbackDir = mkdtempSync(join(tmpdir(), 'art-comparison-'));
process.env.WIZARD_FEEDBACK_DIR = feedbackDir;
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors: string[] = [];
const out = `runs-comparison-check/${experimentId}`; mkdirSync(out, {recursive:true});
const uiOnly = process.argv.includes('--ui-only');
const rounded = (x: unknown) => JSON.parse(JSON.stringify(x, (_key,value) => typeof value === 'number' ? Math.round(value*1e7)/1e7 : value));
try {
  const page = await browser.newPage({viewport:{width:1440,height:1050}});
  page.on('pageerror', e => errors.push(e.message));
  const lastLetter = String.fromCharCode(64 + variants.length);
  const url = new URL(`compare.html?capture=1&experiment=${experimentId}`,server.resolvedUrls!.local[0]).href;
  await page.goto(url); await page.waitForFunction(() => !!window.comparison); await page.evaluate(() => window.comparison.ready());
  assert.deepEqual((await page.evaluate(() => window.comparison.metadata)).alternatives.map(v=>v.id), variants.map(v=>v.id));
  assert.equal(await page.locator('.art-directions article').count(),variants.length);
  assert.match(await page.locator('#comparison-page').innerText(),revision ? /Photon remains the benchmark/ : /starting proposal: A/);
  assert.equal(await page.getByRole('combobox',{name:'Preference',exact:true}).locator('option').count(),variants.length+3);
  for (const brief of briefs) {
    await page.getByRole('button',{name:brief.title,exact:true}).click();
    const viewing = await page.evaluate(() => window.comparison.viewing());
    for (const [i,clip] of brief.clips.entries()) {
      assert.equal(viewing.panels[i].clip!.id,clip.id);
      assert.ok(Math.abs(viewing.panels[i].cursor-clip.start)<SIMULATION_DT);
    }
    // Last card gets the same independent behavior as the first pair.
    await page.getByRole('button',{name:'Play excerpt A',exact:true}).click();
    await page.waitForTimeout(200);
    await page.getByRole('button',{name:`Play excerpt ${lastLetter}`,exact:true}).click();
    const switched = await page.evaluate(() => window.comparison.viewing());
    assert.equal(switched.panels[0].playing,true); assert.equal(switched.panels.at(-1)!.playing,true);
    await page.evaluate(() => window.comparison.pause());
    const before = await page.evaluate(() => window.comparison.states());
    await page.getByLabel(`Excerpt time ${lastLetter}`,{exact:true}).focus(); await page.keyboard.press('End');
    assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0,-1),before.slice(0,-1));
    await page.getByRole('button',{name:`Replay excerpt ${lastLetter}`,exact:true}).click(); await page.evaluate(() => window.comparison.pause());
    assert.deepEqual((await page.evaluate(() => window.comparison.states())).slice(0,-1),before.slice(0,-1));
  }
  await page.getByRole('button',{name:briefs[0].title,exact:true}).click();
  await page.getByLabel(`Comment on evidence ${lastLetter}`,{exact:true}).fill('Automated recovery check for fifth direction.');
  await page.getByRole('button',{name:`Save evidence comment ${lastLetter}`,exact:true}).click();
  await page.waitForFunction(() => document.querySelectorAll('.comment-save')[document.querySelectorAll('.comment-save').length - 1].textContent!.startsWith('Saved to workspace'));
  const note = (await page.evaluate(() => window.comparison.feedback())).notes.at(-1)!;
  assert.equal(note.evidence!.id,briefs[0].clips.at(-1)!.id); assert.equal(note.experiment,experimentId);
  const fresh = await browser.newPage(); await fresh.goto(url); await fresh.waitForFunction(() => !!window.comparison); await fresh.evaluate(() => window.comparison.ready());
  await fresh.getByRole('button',{name:briefs[0].title,exact:true}).click();
  assert.match(await fresh.locator('.review-status').last().innerText(),/Commented/); await fresh.close();
  // A direction link must reveal its target even when another card is enlarged.
  await page.getByRole('button',{name:'Enlarge panel A',exact:true}).click();
  await page.getByRole('button',{name:revision ? 'View Obsidian Atelier · round 2' : 'View Obsidian Foundry',exact:true}).click();
  assert.equal(await page.locator('.panel:visible').count(),1);
  assert.match(await page.locator('.panel:visible .panel-head strong').innerText(),revision ? /Obsidian Atelier/ : /Obsidian Foundry/);
  await page.getByRole('button',{name:`Enlarge panel ${lastLetter}`,exact:true}).click();
  // Exercise geometry projection on enlarged, restored, narrow and paused canvases.
  for (const width of [1440,780]) {
    await page.setViewportSize({width,height:1050});
    await page.getByRole('button',{name:`Full fight ${lastLetter}`,exact:true}).click();
    await page.waitForTimeout(100);
    const size = await page.locator('.panel:visible canvas').evaluateAll(nodes=>nodes.map(n=>({width:(n as HTMLCanvasElement).width,css:Math.floor(n.getBoundingClientRect().width)})));
    assert.equal(size.length,1); assert.equal(size[0].width,size[0].css);
    await page.screenshot({path:`${out}/enlarged-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:`Enlarge panel ${lastLetter}`,exact:true}).click();
    await page.getByRole('button',{name:'Selected evidence',exact:true}).click();
  }
  // Complete baseline and fresh fights. Every visual panel must match the same world.
  if (!uiOnly) for (const [scenario,seed] of [['duel',7],['four-wizards',19],['four-wizards',1],['duel',307],['four-wizards',211]] as const) {
    await page.evaluate(setup=>window.comparison.loadExample(setup),{scenario,seed,rotation:0});
    const states = await page.evaluate(()=>window.comparison.seek(120));
    const world = createScenario({scenario,seed,rotation:0,variant:'burst'});
    while(world.tick<7200 && world.contestants.filter(c=>c.alive).length>1) world.update(SIMULATION_DT);
    const expected = world.contestants.map(c=>({id:c.id,hp:c.hp,alive:c.alive,position:{...c.position},velocity:{...c.velocity}}));
    for(const state of states) assert.deepEqual(rounded(state.contestants),rounded(expected),`${scenario}/${seed}/${state.variant}`);
  }
  if (revision) {
    // Paired views retain the original renderer and share revised-card comments
    // with the main room, without inheriting round-one reviewed labels.
    for (const family of ['photon','observatory'] as const) {
      const index = variants.findIndex(v => v.id === `${family}-v2`);
      const pairUrl = `${url}&family=${family}`;
      await page.goto(pairUrl); await page.locator('#storage-gate').waitFor({state:'hidden'});
      await page.locator('#show-evidence').click();
      const metadata = await page.evaluate(()=>window.comparison.metadata);
      assert.deepEqual(metadata.alternatives.map(v=>v.artDirection),[family,`${family}-v2`]);
      assert.match(await page.locator('.panel-head strong').first().innerText(),/round 1 unchanged/);
      assert.match(await page.locator('.panel-head strong').nth(1).innerText(),/round 2/);
      assert.equal(await page.locator('.review-status').nth(1).innerText(),'Not reviewed');
      await page.getByLabel('Comment on evidence B',{exact:true}).fill(`${family} revised-card linkage check`);
      await page.getByRole('button',{name:'Save evidence comment B',exact:true}).click();
      await page.locator('#storage-gate').waitFor({state:'hidden'});
      const pairNote=(await page.evaluate(()=>window.comparison.feedback())).notes.at(-1)!;
      assert.equal(pairNote.evidence!.variant,`${family}-v2`);
      await page.goto(url);await page.locator('#storage-gate').waitFor({state:'hidden'});
      await page.locator('#show-evidence').click();
      assert.match(await page.locator('.review-status').nth(index).innerText(),/Commented/);
      const sourceNotes=await page.evaluate(()=>window.comparison.feedback().notes);
      assert.equal(sourceNotes.filter(n=>n.text===`${family} revised-card linkage check`).length,1);
    }
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/result.json`,JSON.stringify({source:await page.evaluate(()=>window.comparison.metadata.source),passed:true,checks:[`${briefs.reduce((n, b) => n + b.clips.length, 0)} evidence identities`,'simultaneous playback','fifth-panel scrub/replay independence','workspace comment recovery','wide/narrow enlargement',...(uiOnly ? [] : [`${5 * variants.length} complete browser/headless fights`])],browser:await browser.version()},null,2));
  console.log(`${experimentId} comparison passed: ${briefs.reduce((n, b) => n + b.clips.length, 0)} clips, independent controls, comment recovery and responsive enlargement${uiOnly ? " (UI only)" : ` and ${5 * variants.length} complete browser/headless fights`}.`);
} finally {
  await browser.close(); await new Promise<void>((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));
  rmSync(feedbackDir,{recursive:true,force:true});
}
