const {chromium} = require('../../ipsec-explainer/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../assets/animations/ipsec-flow-svg');
const out = path.resolve(__dirname, '../test-output');
fs.mkdirSync(out, {recursive:true});
const tests = [];
const test = (name, run) => tests.push({name,run});
const snapshot = page => page.evaluate(() => ({topic:ipsecSvg.topic,time:ipsecSvg.time,playing:ipsecSvg.playing,duration:ipsecSvg.duration}));
test('initial state is paused with public seconds API', async page => {
  await page.goto(`${base}/index.html?topic=keys`);
  const s = await snapshot(page);
  assert.equal(s.topic,'keys'); assert.equal(s.time,0); assert.equal(s.playing,false);
  assert.ok(s.duration >= 10 && s.duration <= 16);
  await page.waitForTimeout(150); assert.equal((await snapshot(page)).time,0);
  for (const id of ['play','restart','seek','speed']) assert.equal(await page.locator(`#${id}`).count(),1);
});
test('play pause advances only while playing and restart pauses at zero', async page => {
  await page.goto(`${base}/index.html?topic=keys`);
  await page.locator('#play').click(); assert.equal((await snapshot(page)).playing,true);
  await page.waitForTimeout(220); assert.ok((await snapshot(page)).time > .1);
  await page.locator('#play').click(); const t=(await snapshot(page)).time;
  await page.waitForTimeout(120); assert.equal((await snapshot(page)).time,t);
  await page.locator('#restart').click(); assert.equal((await snapshot(page)).time,0);assert.equal((await snapshot(page)).playing,false);
});
test('seek clamps finite seconds and range input updates the scene time', async page => {
  await page.goto(`${base}/index.html`);
  await page.evaluate(()=>ipsecSvg.seek(7.3));assert.equal((await snapshot(page)).time,7.3);
  await page.evaluate(()=>ipsecSvg.seek(-10));assert.equal((await snapshot(page)).time,0);
  await page.evaluate(()=>ipsecSvg.seek(999));assert.equal((await snapshot(page)).time,14);
  await page.evaluate(()=>ipsecSvg.seek(NaN));assert.equal((await snapshot(page)).time,14);
  await page.locator('#seek').fill('4.2');assert.equal((await snapshot(page)).time,4.2);
});
test('every speed option changes real elapsed playback rate', async page => {
  await page.goto(`${base}/index.html`);
  assert.deepEqual(await page.locator('#speed option').evaluateAll(xs=>xs.map(x=>x.value)),['0.5','1','1.5','2']);
  for(const speed of [.5,1,1.5,2]){
    await page.evaluate(()=>ipsecSvg.restart());await page.locator('#speed').selectOption(String(speed));
    const before=await page.evaluate(()=>{ipsecSvg.toggle();return performance.now()});
    await page.waitForTimeout(350);
    const {t,elapsed}=await page.evaluate(before=>{ipsecSvg.toggle();return {t:ipsecSvg.time,elapsed:(performance.now()-before)/1000}},before);
    assert.ok(Math.abs(t/elapsed-speed)<.2,`speed ${speed}: observed ${t/elapsed}`);
  }
});
test('keyboard transport works without hijacking native form keys', async page => {
  await page.goto(`${base}/index.html`);await page.locator('#player').focus();
  await page.keyboard.press('ArrowRight');assert.equal((await snapshot(page)).time,1);
  await page.keyboard.press('End');assert.equal((await snapshot(page)).time,14);
  await page.keyboard.press('Home');assert.equal((await snapshot(page)).time,0);
  await page.keyboard.press('Space');assert.equal((await snapshot(page)).playing,true);
  await page.keyboard.press('Space');assert.equal((await snapshot(page)).playing,false);
  await page.locator('#seek').focus();await page.keyboard.press('ArrowRight');assert.ok((await snapshot(page)).time < .1);
  await page.locator('#speed').focus();await page.keyboard.press('ArrowDown');assert.equal((await snapshot(page)).playing,false);
});
test('reduced motion is a static final scene even through transport API', async page => {
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${base}/index.html?topic=mitm`);
  assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
  await page.evaluate(()=>{ipsecSvg.toggle();ipsecSvg.restart();ipsecSvg.seek(2)});
  await page.waitForTimeout(100);assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
  assert.equal(await page.locator('#play').isDisabled(),true);
});
test('iframe sends finite actual body height to the same origin after expansion', async page => {
  await page.goto(`${base}/harness.html`);
  await page.waitForFunction(()=>window.heights?.length>0);
  const child=page.frames().find(f=>f.url().includes('index.html'));
  assert.ok(child);
  const check=async()=>{
    const expected=await child.evaluate(()=>Math.ceil(document.body.getBoundingClientRect().height));
    const sent=await page.evaluate(()=>heights.at(-1));
    assert.equal(sent.type,'ipsec-explainer-height');assert.equal(sent.height,expected);assert.ok(Number.isFinite(sent.height));
    assert.equal(await page.evaluate(()=>targets.at(-1)),new URL(base).origin);
  };
  await check();const n=await page.evaluate(()=>heights.length);
  await child.locator('summary').click();await page.waitForFunction(n=>heights.length>n,n);await check();
});
const shown = (page,id) => page.locator('#'+id).evaluate(el=>Number(getComputedStyle(el).opacity)>0.9);
const transform = (page,id) => page.locator('#'+id).getAttribute('transform');
test('keys preserves provisioned credential while DH moves into local key derivation and an AUTH gate', async page => {
  await page.goto(`${base}/index.html?topic=keys`);
  assert.match(await page.locator('#fallback').textContent(),/PSK.*AUTH/s);
  assert.match(await page.locator('#fallback').textContent(),/SK_d/);
  const psk=await transform(page,'psk-a');const publicStart=await transform(page,'dh-x');
  await page.evaluate(()=>ipsecSvg.seek(1.8));assert.notEqual(await transform(page,'dh-x'),publicStart);
  await page.evaluate(()=>ipsecSvg.seek(5));assert.equal(await shown(page,'ike-a'),true);
  assert.equal(await shown(page,'esp-data'),false);assert.equal(await transform(page,'psk-a'),psk);
  await page.evaluate(()=>ipsecSvg.seek(7.8));assert.equal(await shown(page,'auth-proof'),true);
  await page.evaluate(()=>ipsecSvg.seek(9.5));assert.equal(await shown(page,'auth-ok'),true);
  await page.evaluate(()=>ipsecSvg.seek(14));assert.equal(await shown(page,'esp-data'),true);
  assert.match(await page.locator('#scene').textContent(),/K_AB/);assert.match(await page.locator('#scene').textContent(),/K_BA/);
  assert.equal(await page.locator('#skd-a').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('g')?.id}),'skd-a','ESP key object must not be covered by the Child SA panel');
  await page.screenshot({path:path.join(out,'keys-desktop-final.png'),fullPage:true});
});
test('mitm splits DH legs and physically delivers an invalid exchange-bound proof into rejection', async page => {
  await page.goto(`${base}/index.html?topic=mitm`);
  assert.match(await page.locator('#fallback').textContent(),/Z_AM/);assert.match(await page.locator('#fallback').textContent(),/PSK/);
  const leg=await transform(page,'dh-leg-am');
  await page.evaluate(()=>ipsecSvg.seek(2));assert.notEqual(await transform(page,'dh-leg-am'),leg);
  await page.evaluate(()=>ipsecSvg.seek(5.5));assert.equal(await shown(page,'m-keys'),true);
  const before=await transform(page,'mitm-proof');
  await page.evaluate(()=>ipsecSvg.seek(7.8));assert.notEqual(await transform(page,'mitm-proof'),before);assert.equal(await shown(page,'mitm-reject'),false);
  const proof=await page.locator('#mitm-proof').boundingBox();
  for(const label of ['B: expected AUTH_A','PSK + this exchange']){
    const r=await page.locator('svg text').filter({hasText:label}).boundingBox();
    assert.ok(proof.x+proof.width<=r.x||r.x+r.width<=proof.x||proof.y+proof.height<=r.y||r.y+r.height<=proof.y,'moving proof must not obscure verifier label '+label);
  }
  await page.screenshot({path:path.join(out,'mitm-proof-in-flight.png'),fullPage:true});
  await page.evaluate(()=>ipsecSvg.seek(10));assert.equal(await shown(page,'mitm-reject'),true);
  assert.match(await page.locator('#caption').textContent(),/ESP/);assert.match(await page.locator('#caption').textContent(),/실패/);
  await page.evaluate(()=>ipsecSvg.seek(14));assert.equal(await shown(page,'no-esp'),true);
  await page.screenshot({path:path.join(out,'mitm-desktop-final.png'),fullPage:true});
});
test('handshake stages INIT local derivation protected AUTH first Child SA then directional ESP', async page => {
  await page.goto(`${base}/index.html?topic=handshake`);
  assert.match(await page.locator('#fallback').textContent(),/IKE_SA_INIT/);assert.match(await page.locator('#fallback').textContent(),/사용자 TCP.*아닙/s);
  await page.evaluate(()=>ipsecSvg.seek(2.8));assert.equal(await shown(page,'init-i'),true);assert.equal(await shown(page,'auth-i'),false);
  await page.evaluate(()=>ipsecSvg.seek(4.5));assert.equal(await shown(page,'local-keys'),true);assert.equal(await shown(page,'sa-ab'),false);
  await page.evaluate(()=>ipsecSvg.seek(6));assert.equal(await shown(page,'auth-i'),true);assert.equal(await shown(page,'sa-ab'),false);
  assert.match(await page.locator('#auth-i').textContent(),/AUTH/);assert.doesNotMatch(await page.locator('#auth-i').textContent(),/TCP|user/);
  await page.screenshot({path:path.join(out,'handshake-protected-auth.png'),fullPage:true});
  await page.evaluate(()=>ipsecSvg.seek(8.8));assert.equal(await shown(page,'auth-verified'),true);assert.equal(await shown(page,'sa-ab'),true);assert.equal(await shown(page,'sa-ba'),true);assert.equal(await shown(page,'esp-ab'),false);
  await page.evaluate(()=>ipsecSvg.seek(11.8));assert.equal(await shown(page,'esp-ab'),true);assert.equal(await shown(page,'esp-ba'),true);
  assert.match(await page.locator('#scene').textContent(),/SA_AB/);assert.match(await page.locator('#scene').textContent(),/SA_BA/);
  await page.evaluate(()=>ipsecSvg.seek(14));await page.screenshot({path:path.join(out,'handshake-desktop-final.png'),fullPage:true});
});
test('embedded 320 and 342px players wrap controls and text with internally scrollable readable SVG', async page => {
  for(const width of [320,342,390]){
    await page.setViewportSize({width,height:1100});
    await page.goto(`${base}/harness.html`);await page.waitForFunction(()=>window.heights?.length>0);
    for(const topic of ['keys','mitm','handshake']){
      const child=page.frames().find(f=>f.url().includes('index.html'));
      await child.goto(`${base}/index.html?topic=${topic}`);
      await child.evaluate(()=>ipsecSvg.seek(14));
      const metrics=await child.evaluate(()=>{
        const c=document.querySelector('.controls'),v=document.querySelector('.vector-scroll'),s=document.querySelector('svg');
        return {page:document.documentElement.scrollWidth,width:innerWidth,controls:c.scrollWidth,controlWidth:c.clientWidth,vector:v.scrollWidth,vectorWidth:v.clientWidth,svg:s.getBoundingClientRect().width};
      });
      assert.ok(metrics.page<=width,JSON.stringify(metrics));assert.ok(metrics.controls<=metrics.controlWidth,JSON.stringify(metrics));
      assert.ok(metrics.vector>metrics.vectorWidth,'detailed diagram scrolls inside, not the document');assert.ok(metrics.svg>=650,'SVG labels remain readable');
      for(const id of ['play','restart','seek','speed']){
        const r=await child.locator('#'+id).boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width,id+' fits');
      }
      await child.locator('summary').click();
      assert.ok(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expanded text wraps');
      const height=await child.evaluate(()=>document.body.getBoundingClientRect().height);assert.ok(height<=2000,`height ${height} <= parent limit`);
      await child.locator('summary').click();
      if(width===342){
        await page.waitForFunction(()=>Math.abs(document.querySelector('iframe').getBoundingClientRect().height-document.querySelector('iframe').contentDocument.body.getBoundingClientRect().height)<2);
        await page.screenshot({path:path.join(out,`${topic}-embedded-342-final.png`),fullPage:true});
      }
    }
  }
});
test('mobile vector region supports native keyboard scrolling without seeking', async page => {
  await page.setViewportSize({width:342,height:1100});await page.goto(`${base}/index.html?topic=handshake`);
  await page.evaluate(()=>ipsecSvg.seek(14));await page.locator('.vector-scroll').focus();
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);
  assert.ok(await page.locator('.vector-scroll').evaluate(el=>el.scrollLeft)>0);
  assert.equal((await snapshot(page)).time,14);
});
test('three actual SVG compositions have different titles structures and staged screenshots', async page => {
  const titles=[],manifest=[];
  const ids={keys:['psk-a','ike-a','auth-ok'],mitm:['dh-leg-am','dh-leg-mb','mitm-reject'],handshake:['init-i','auth-i','sa-ab','esp-ab']};
  for(const topic of Object.keys(ids)){
    await page.goto(`${base}/index.html?topic=${topic}`);titles.push(await page.locator('h1').textContent());
    for(const id of ids[topic])assert.equal(await page.locator('#'+id).count(),1);
    for(const t of [0,1.8,3.8,6.8,8.8,14]){
      await page.evaluate(t=>ipsecSvg.seek(t),t);
      const file=`${topic}-stage-${String(t).replace('.','_')}.png`;
      await page.locator('.vector-scroll').screenshot({path:path.join(out,file)});manifest.push({topic,time:t,file});
    }
  }
  assert.equal(new Set(titles).size,3);
  fs.writeFileSync(path.join(out,'screenshot-manifest.json'),JSON.stringify(manifest,null,2));
});
test('all reduced-motion topics remain static at their own final resolution', async page => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const topic of ['keys','mitm','handshake']){
    await page.goto(`${base}/index.html?topic=${topic}`);
    assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
    await page.screenshot({path:path.join(out,`${topic}-reduced-motion.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(50);assert.equal((await snapshot(page)).time,0);
});
test('real playback finishes at duration and does not drift during final hold', async page => {
  await page.goto(`${base}/index.html?topic=handshake`);await page.locator('#speed').selectOption('2');
  await page.evaluate(()=>{ipsecSvg.seek(13.5);ipsecSvg.toggle()});
  await page.waitForTimeout(450);assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
  await page.waitForTimeout(120);assert.equal((await snapshot(page)).time,14);
});
let base;
(async()=>{
  const server = http.createServer((req,res)=>{
    if(req.url==='/harness.html'){
      res.setHeader('Content-Type','text/html');res.end(`<html><body style="margin:0"><script>window.heights=[];window.targets=[];const native=window.postMessage.bind(window);window.postMessage=(data,target)=>{targets.push(target);native(data,target)};addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='ipsec-explainer-height'){heights.push(e.data);document.querySelector('iframe').style.height=e.data.height+'px'}})</script><iframe src="/index.html?topic=keys" style="width:100%;height:100px;border:0"></iframe></body></html>`);return;
    }
    const file = path.join(root, new URL(req.url,'http://local').pathname);
    if (!file.startsWith(root)) {res.writeHead(403).end();return;}
    fs.readFile(file,(err,data)=>{
      if(err){res.writeHead(404).end('Not found');return;}
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);
    });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:'/home/sampling/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',headless:true,args:['--no-sandbox','--disable-gpu'],timeout:30000});
  const results=[];
  try {
    for(const t of tests){
      const page=await browser.newPage({viewport:{width:720,height:1000}});
      page.setDefaultTimeout(15000);await page.bringToFront();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      try{await t.run(page);assert.deepEqual(errors,[]);results.push({name:t.name,pass:true});console.log(`PASS ${t.name}`);}
      catch(e){results.push({name:t.name,pass:false,error:e.message});console.error(`FAIL ${t.name}: ${e.stack}`);}
      await page.close();
    }
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  console.log(`${results.filter(r=>r.pass).length}/${results.length} browser tests passed`);
  process.exitCode=results.every(r=>r.pass)?0:1;
})();
