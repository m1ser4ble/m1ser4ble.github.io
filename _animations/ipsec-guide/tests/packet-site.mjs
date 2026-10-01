import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '../../ipsec/node_modules/playwright/index.mjs';
const root=path.resolve('.');
const server=http.createServer((req,res)=>{
 if(req.url==='/fixture') {res.setHeader('Content-Type','text/html');return res.end('<!doctype html><script>window.sizes=[];addEventListener("message",e=>{if(e.origin===location.origin)sizes.push(e.data)})</script><iframe src="/assets/animations/ipsec-packet-svg/index.html" style="width:720px;height:1100px"></iframe>');}
 const file=path.join(root,new URL(req.url,'http://localhost').pathname);
 if(!fs.existsSync(file)) {res.writeHead(404);return res.end('Missing player');}
 const type={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.CHROMIUM_PATH||'/home/sampling/.cache/ms-playwright/chromium-1228/chrome-linux/chrome'});
try{
 const page=await browser.newPage({viewport:{width:900,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 const response=await page.goto(base+'/assets/animations/ipsec-packet-svg/index.html');assert.equal(response.status(),200,'site must serve the new standalone SVG packet player');
 await page.waitForFunction(()=>Boolean(window.ipsecSvg));
 assert.deepEqual(await page.evaluate(()=>({time:ipsecSvg.time,playing:ipsecSvg.playing})),{time:0,playing:false});
 await page.locator('#speed').selectOption('2');assert.equal(await page.evaluate(()=>ipsecSvg.speed),2);
 await page.locator('#play').click();await page.waitForTimeout(450);assert.ok(await page.evaluate(()=>ipsecSvg.time>.7));await page.locator('#play').click();assert.equal(await page.evaluate(()=>ipsecSvg.playing),false);
 await page.locator('#restart').click();assert.equal(await page.evaluate(()=>ipsecSvg.time),0);assert.equal(await page.evaluate(()=>ipsecSvg.playing),false);
 await page.locator('[data-mode="tunnel"]').click();await page.evaluate(()=>ipsecSvg.seek(9));assert.equal(await page.locator('#original-ip').getAttribute('data-region'),'encrypted');
 await page.locator('[data-mode="transport"]').click();await page.evaluate(()=>ipsecSvg.seek(9));assert.equal(await page.locator('#original-ip').getAttribute('data-region'),'outside');
 await page.goto(base+'/fixture');await page.waitForFunction(()=>sizes.some(m=>m.type==='ipsec-explainer-height'&&m.height>=350&&m.height<=2000));
 const frame=page.frames()[1];await frame.locator('#restart').click();assert.equal(await frame.evaluate(()=>ipsecSvg.time),0);
 await page.goto(base+'/assets/animations/ipsec-packet-svg/index.html');
 assert.ok(await page.locator('.stage-frame').evaluate(node=>node.scrollWidth<=node.clientWidth+2),'The complete packet including Tag must fit in the desktop stage');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/assets/animations/ipsec-packet-svg/index.html');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>ipsecSvg.time===9);assert.equal(await page.locator('#play').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: published SVG packet player, initial pause, speed, reset, both boundaries, actual resize message, mobile, reduced motion');
} finally {await browser.close();await new Promise(r=>server.close(r));}
