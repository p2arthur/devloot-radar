import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true});
const out='artifacts/qa/avatars';
await mkdir(out,{recursive:true});
const results=[];
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const remote=[];page.on('request',request=>{if(request.url().startsWith('https://github.com/'))remote.push(request.url())});
 const base=process.env.QA_ORIGIN ?? "http://127.0.0.1:4321";
 for(const width of [390,768,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});
  await page.goto(base);
  await page.evaluate(theme=>localStorage.setItem('devloot-radar:theme:v1',theme),theme);
  await page.reload();
  const avatar=page.locator('.repository-avatar:visible').first();
  await avatar.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.repository-avatar')].some(i=>i.clientWidth&&i.complete&&i.naturalWidth));
  assert.equal(await avatar.getAttribute('src'),'/brand/project-default.png');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${out}/list-${width}-${theme}.png`});
  await page.goto(base+'/repo/demo/patchwork');
  await page.locator('.profile-avatar').waitFor();
  assert.equal(await page.locator('.profile-avatar').getAttribute('src'),'/brand/project-default.png');
  await page.screenshot({path:`${out}/profile-${width}-${theme}.png`});
 }
 assert.equal(remote.length,0);
 results.push('Demo uses local pixel avatar only; list/profile visible at 390/768/1440 in both themes without overflow');
 await page.getByRole('button',{name:'Save demo/patchwork to watchlist',exact:true}).click();
 await page.getByRole('link',{name:'Watchlist 1',exact:true}).click();
 assert.equal(await page.locator('.repository-avatar:visible').first().getAttribute('src'),'/brand/project-default.png');
 results.push('Saved repository retains avatar in watchlist');
 let failed=false;
 const fixture=await readFile('client/public/brand/devloot_mascot_black.svg');
 await page.route('https://github.com/*.png?size=128',route=>failed?route.abort():route.fulfill({status:200,contentType:'image/svg+xml',body:fixture}));
 await page.route('**/api/v1/catalog',async route=>{
  const response=await route.fetch();const data=await response.json();data.mode='live';await route.fulfill({json:data});
 });
 await page.goto(base+'/repo/demo/patchwork');
 await page.waitForFunction(()=>{const i=document.querySelector('.profile-avatar');return i?.src.startsWith('https://github.com/')&&i.complete&&i.naturalWidth>0});
 assert.equal(await page.locator('.profile-avatar').getAttribute('referrerpolicy'),'no-referrer');
 results.push('Live-style owner image displays from public GitHub URL without referrer');
 failed=true;
 await page.reload();
 await page.waitForFunction(()=>{const i=document.querySelector('.profile-avatar');return i?.getAttribute('src')==='/brand/project-default.png'&&i.complete&&i.naturalWidth>0});
 await page.goto(base);
 await page.locator('.repository').first().waitFor();
 await page.locator('.repository-avatar:visible').first().scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('.repository-avatar')].filter(i=>i.clientWidth).every(i=>i.getAttribute('src')==='/brand/project-default.png'));
 results.push('Broken remote images fall back on profiles and lists without a retry loop');
 assert.deepEqual(errors,[]);
 await writeFile(out+'/results.json',JSON.stringify({results,pageErrors:errors},null,2)+'\n');
 console.log(results.map(result=>'PASS '+result).join('\n'));
}finally{await browser.close()}
