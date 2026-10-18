// Verify representative captured frames after a direction-navigation-only fix.
// Rendering and simulation files did not change; each of the 15 clips is checked.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = 'public/experiments/art-direction-v1';
const server = await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const browser = await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const comparisons = [];
try {
 const page = await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
 mkdirSync('runs-captures/art-ui-followup',{recursive:true});
 for(const dir of readdirSync(`${root}/media`)) {
  const manifest = JSON.parse(readFileSync(`${root}/media/${dir}/capture.json`,'utf8'));
  const frame = dir.startsWith('crowd')?55:dir.startsWith('duel')?90:40;
  const time = manifest.frames[frame].requestedTime;
  const url = new URL(manifest.url); const query = url.searchParams;
  const target = new URL('compare.html',server.resolvedUrls.local[0]); target.search=query.toString();
  await page.goto(target.href); await page.waitForFunction(()=>!!window.comparison);
  await page.evaluate(t=>window.comparison.seek(t),time);
  const index = (await page.evaluate(()=>window.comparison.metadata.alternatives)).findIndex(v=>v.id===manifest.focusedVariant);
  await page.locator('.panel').nth(index).locator('.panel-head button').click();
  const bytes = await page.locator('#panels').screenshot({path:`runs-captures/art-ui-followup/${dir}.png`});
  const original = readFileSync(`${root}/media/${dir}/frame-${String(frame).padStart(5,'0')}.png`);
  assert.equal(hash(bytes),hash(original),dir);
  comparisons.push({clip:dir,frame,time,pngSha256:hash(bytes),identical:true});
 }
 const metadata = await page.evaluate(()=>window.comparison.metadata);
 writeFileSync(`${root}/source-followup.json`,JSON.stringify({
  capturedSource:JSON.parse(readFileSync(`${root}/media/crowd-porcelain/capture.json`,'utf8')).metadata.source,
  viewerSource:metadata.source,
  change:'Direction links reveal their card when another direction is enlarged; an automated check covers this path. No rendering, gameplay or captions changed.',
  method:'Byte comparison of one rendered full-panel frame from each of all 15 clips, at matching viewport, time and focused direction. Other frames are not recaptured.',
  comparisons,
 },null,2));
 console.log('15/15 sampled clip frames byte-identical after navigation fix.');
} finally {await browser.close();await new Promise((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));}
