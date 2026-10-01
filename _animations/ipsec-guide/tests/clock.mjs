import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '../../ipsec/node_modules/playwright/index.mjs';
const root=path.resolve('.');const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu'],executablePath:process.env.CHROMIUM_PATH||'/home/sampling/.cache/ms-playwright/chromium-1228/chrome-linux/chrome'});
try{const page=await browser.newPage();for(const url of ['/assets/animations/ipsec-flow-svg/index.html?topic=keys','/assets/animations/ipsec-flow-svg/index.html?topic=mitm','/assets/animations/ipsec-flow-svg/index.html?topic=handshake','/assets/animations/ipsec-packet-svg/index.html']){
 await page.goto(base+url);await page.waitForFunction(()=>window.ipsecSvg);
 const result=await page.evaluate(()=>{
  window.queued=[];window.requestAnimationFrame=cb=>{queued.push(cb);return queued.length;};window.cancelAnimationFrame=()=>{};
  ipsecSvg.restart();ipsecSvg.toggle();const backward=performance.now()-5000;for(const cb of queued.splice(0))cb(backward);const first=ipsecSvg.time;
  const future=performance.now()+500000;for(const cb of queued.splice(0))cb(future);const second=ipsecSvg.time;
  return {first,second,playing:ipsecSvg.playing};
 });
 assert.ok(result.first>=0,`${url}: callback timestamp must not make time negative: ${JSON.stringify(result)}`);
 assert.ok(result.second<2,`${url}: callback timestamp must not skip straight to the end: ${JSON.stringify(result)}`);
 assert.equal(result.playing,true);console.log('PASS local-clock playback independent of callback epoch',url,result);
}}finally{await browser.close();await new Promise(r=>server.close(r));}
