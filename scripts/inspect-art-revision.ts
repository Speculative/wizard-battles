import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out='runs-captures/art-direction-v2/inspection';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 await page.goto('http://localhost:5173/compare.html?experiment=art-direction-v2');
 await page.waitForFunction(()=>!!window.comparison);await page.locator('#storage-gate').waitFor({state:'hidden'});
 for(const setup of [{name:'intersection',scenario:'four-wizards',seed:19,time:7.1},{name:'crowd',scenario:'four-wizards',seed:1,time:1.1},{name:'duel',scenario:'duel',seed:7,time:10}]){
  await page.evaluate(s=>{window.comparison.loadExample({scenario:s.scenario,seed:s.seed,rotation:0});window.comparison.seek(s.time);},setup);
  for(let i=0;i<5;i++)await page.locator('.panel canvas').nth(i).screenshot({path:`${out}/${setup.name}-${i}.png`});
 }
 console.log(out);
}finally{await browser.close();}
