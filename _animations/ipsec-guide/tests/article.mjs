import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '../../ipsec/node_modules/playwright/index.mjs';
const url=process.env.ARTICLE_URL||'http://127.0.0.1:8767/_animations/ipsec-guide/preview.html';
const out=process.env.SCREENSHOT_DIR||path.resolve('_animations/ipsec-guide/test-output');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[],failedAssets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&/\/assets\/(animations|images\/ipsec-guide|css\/ipsec-guide|js\/ipsec-guide)/.test(r.url()))failedAssets.push([r.status(),r.url()]);});
 const r=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);
 const content=page.locator('.page__content');const text=await content.innerText();
 for(const term of ['PSK','IKE_AUTH','XFRM','OpenID Connect'])assert.ok(text.includes(term),`Missing preserved explanation: ${term}`);
 assert.equal(await content.locator('iframe').count(),4);
 const frames=content.locator('iframe');
 const sources=await frames.evaluateAll(items=>items.map(x=>x.getAttribute('src')));
 assert.ok(sources.every(s=>/\/ipsec-(flow|packet)-svg\//.test(s)),'Every article animation must use the new local SVG player, not the legacy Canvas embeds');
 assert.equal(await content.locator('details').count(),2);
 const figures=content.locator('figure.ipsec-guide-figure');const figureCount=await figures.count();assert.ok(figureCount>=12,'Conceptual ASCII diagrams must be replaced with rendered figures');
 assert.equal(await figures.locator('img[src$=".svg"]').count(),figureCount,'Every diagram must be real standalone SVG');
 for(let i=0;i<figureCount;i++){
  const image=figures.nth(i).locator('img');await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());
  const size=await image.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));assert.ok(size.width>20&&size.height>20,`Diagram ${i+1} failed: ${JSON.stringify(size)}`);
  await figures.nth(i).screenshot({path:path.join(out,`diagram-${i+1}.png`)});
 }
 const report=[];
 for(let i=0;i<4;i++){
  const locator=frames.nth(i);await locator.scrollIntoViewIfNeeded();const frame=await (await locator.elementHandle()).contentFrame();
  await frame.waitForFunction(()=>Boolean(window.ipsecSvg),null,{timeout:45000});
  const metrics=await frame.evaluate(()=>({topic:ipsecSvg.topic,time:ipsecSvg.time,paused:!ipsecSvg.playing,duration:ipsecSvg.duration,svgNodes:document.querySelectorAll('svg rect,svg text,svg path').length,viewport:innerHeight}));
  assert.ok(metrics.svgNodes>=10,`Empty SVG scene: ${metrics.topic}`);assert.equal(metrics.paused,true);assert.equal(metrics.time,0);
  await frame.locator('#speed').selectOption('2');await frame.locator('#play').click();
  await frame.waitForFunction(t=>ipsecSvg.time>t+.2,metrics.time);await frame.locator('#play').click();assert.equal(await frame.evaluate(()=>ipsecSvg.playing),false);
  await frame.locator('#restart').click();assert.equal(await frame.evaluate(()=>ipsecSvg.time),0);assert.equal(await frame.evaluate(()=>ipsecSvg.playing),false);
  await frame.locator('#speed').selectOption('1');await frame.evaluate(()=>ipsecSvg.seek(ipsecSvg.duration));
  await frame.locator('#seek').focus();await page.keyboard.press('ArrowLeft');assert.ok(await frame.evaluate(()=>ipsecSvg.time<ipsecSvg.duration),'Native seek must respond to keyboard');
  await frame.evaluate(()=>ipsecSvg.seek(ipsecSvg.duration));
  const sceneText=await frame.locator('svg').textContent();
  const required={keys:['PSK','SK_d','Z'],mitm:['Z_AM','Z_MB','AUTH'],handshake:['IKE_SA_INIT','IKE_AUTH','ESP','SA_AB','SA_BA'],modes:['ESP','Tag','TCP']};
  for(const term of required[metrics.topic])assert.ok(sceneText.includes(term),`Wrong scene content for ${metrics.topic}: missing ${term}`);
  await page.waitForTimeout(120);assert.ok(await frame.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+8),'Iframe must resize to show the whole player');
  report.push(metrics);await locator.screenshot({path:path.join(out,`embed-${metrics.topic}.png`)});
 }
 assert.deepEqual(report.map(x=>x.topic),['keys','mitm','handshake','modes']);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'article-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile article must not overflow');
 for(let i=0;i<4;i++){
  const locator=frames.nth(i);await locator.scrollIntoViewIfNeeded();const frame=await (await locator.elementHandle()).contentFrame();await page.waitForTimeout(150);
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile iframe must not overflow');
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+8),'Mobile player must not be vertically clipped');
  assert.ok(await frame.locator('#play').isVisible());assert.ok(await frame.locator('#speed').isVisible());
  await locator.screenshot({path:path.join(out,`embed-mobile-${i+1}.png`)});
 }
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'article-mobile.png')});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(let i=0;i<4;i++){
  const frame=await (await frames.nth(i).elementHandle()).contentFrame();await frame.waitForFunction(()=>ipsecSvg.time===ipsecSvg.duration&&!ipsecSvg.playing);
  assert.equal(await frame.locator('#play').isDisabled(),true,'Reduced motion must show final static state without spatial playback');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
 console.log(JSON.stringify({status:'passed',url,diagrams:figureCount,animatedEmbeds:report.length,desktopAndMobile:true,reducedMotion:true,report,errors,failedAssets},null,2));
}finally{await browser.close();}
