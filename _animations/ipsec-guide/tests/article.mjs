import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '../../ipsec/node_modules/playwright/index.mjs';
const url=process.env.ARTICLE_URL||'http://127.0.0.1:8767/_animations/ipsec-guide/preview.html';
const out=process.env.SCREENSHOT_DIR||path.resolve('_animations/ipsec-guide/test-output');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];const failedAssets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&/\/assets\/(animations|images\/ipsec-guide|css\/ipsec-guide|js\/ipsec-guide)/.test(r.url()))failedAssets.push([r.status(),r.url()]);});
 const r=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);
 const content=page.locator('.page__content');
 assert.match(await content.innerText(),/PSK/);assert.match(await content.innerText(),/IKE_AUTH/);assert.match(await content.innerText(),/XFRM/);assert.match(await content.innerText(),/OpenID Connect/);
 assert.equal(await content.locator('iframe').count(),4);
 assert.equal(await content.locator('figure.ipsec-guide-figure').count(),4);
 assert.equal(await content.locator('details').count(),2);
 const images=content.locator('figure.ipsec-guide-figure img');
 for(let i=0;i<4;i++){
   await images.nth(i).scrollIntoViewIfNeeded();
   await images.nth(i).evaluate(img=>img.decode());
   const size=await images.nth(i).evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
   assert.ok(size.width>20&&size.height>20,`Diagram ${i+1} failed to load: ${JSON.stringify(size)}`);
   await content.locator('figure.ipsec-guide-figure').nth(i).screenshot({path:path.join(out,`diagram-${i+1}.png`)});
 }
 const frames=content.locator('iframe');
 const report=[];
 for(let i=0;i<4;i++){
   const locator=frames.nth(i);await locator.scrollIntoViewIfNeeded();
   const handle=await locator.elementHandle();const frame=await handle.contentFrame();
   await frame.waitForFunction(()=>Boolean(window.ipsecExplainer?.player||window.ipsecDemo?.player),null,{timeout:60000});
   await frame.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
   const metrics=await frame.evaluate(()=>{const api=window.ipsecExplainer||window.ipsecDemo;const c=document.querySelector('motion-canvas-player').shadowRoot.querySelector('canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let pixels=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>220&&d[i+3])pixels++;return {topic:api.topic||'handshake',pixels,frame:api.player.onFrameChanged.current,paused:api.player.onStateChanged.current.paused,height:document.body.scrollHeight,viewport:innerHeight};});
   assert.ok(metrics.pixels>3000);assert.equal(metrics.paused,true);
   await frame.locator('#play').click();
   await frame.waitForFunction(before=>(window.ipsecExplainer||window.ipsecDemo).player.onFrameChanged.current>before+5,metrics.frame);
   await frame.locator('#play').click();
   assert.equal(await frame.evaluate(()=>(window.ipsecExplainer||window.ipsecDemo).player.onStateChanged.current.paused),true);
   await frame.locator('#restart').click();
   await frame.waitForFunction(()=>(window.ipsecExplainer||window.ipsecDemo).player.onFrameChanged.current===0);
   report.push(metrics);
   await locator.screenshot({path:path.join(out,`embed-${metrics.topic}.png`)});
 }
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:path.join(out,'article-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile article must not overflow horizontally');
 for(let i=0;i<4;i++){
   const locator=frames.nth(i);await locator.scrollIntoViewIfNeeded();
   const frame=await (await locator.elementHandle()).contentFrame();
   assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile iframe must not overflow');
   assert.ok(await frame.locator('#play').isVisible());
   await locator.screenshot({path:path.join(out,`embed-mobile-${i+1}.png`)});
 }
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'article-mobile.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
 console.log(JSON.stringify({status:'passed',url,diagrams:4,animatedEmbeds:4,desktopAndMobile:true,report,errors,failedAssets},null,2));
}finally{await browser.close();}
