const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/tmp/dds-browser-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../assets/animations/dds');
const out = path.resolve(__dirname, '../test-output');
fs.mkdirSync(out, {recursive:true});
const tests = [];
const test = (name, run) => tests.push({name,run});
const snapshot = page => page.evaluate(() => ({topic:ddsSvg.topic,time:ddsSvg.time,playing:ddsSvg.playing,duration:ddsSvg.duration}));
test('initial state is paused with public seconds API', async page => {
  await page.goto(`${base}/index.html?topic=basics`);
  const s = await snapshot(page);
  assert.equal(s.topic,'basics'); assert.equal(s.time,0); assert.equal(s.playing,false);
  assert.ok(s.duration >= 10 && s.duration <= 16);
  await page.waitForTimeout(150); assert.equal((await snapshot(page)).time,0);
  for (const id of ['play','restart','seek','speed']) assert.equal(await page.locator(`#${id}`).count(),1);
});
test('play pause advances only while playing and restart pauses at zero', async page => {
  await page.goto(`${base}/index.html?topic=basics`);
  await page.locator('#play').click(); assert.equal((await snapshot(page)).playing,true);
  await page.waitForTimeout(220); assert.ok((await snapshot(page)).time > .1);
  await page.locator('#play').click(); const t=(await snapshot(page)).time;
  await page.waitForTimeout(120); assert.equal((await snapshot(page)).time,t);
  await page.locator('#restart').click(); assert.equal((await snapshot(page)).time,0);assert.equal((await snapshot(page)).playing,false);
});
test('seek clamps finite seconds and range input updates the scene time', async page => {
  await page.goto(`${base}/index.html`);
  await page.evaluate(()=>ddsSvg.seek(7.3));assert.equal((await snapshot(page)).time,7.3);
  await page.evaluate(()=>ddsSvg.seek(-10));assert.equal((await snapshot(page)).time,0);
  await page.evaluate(()=>ddsSvg.seek(999));assert.equal((await snapshot(page)).time,14);
  await page.evaluate(()=>ddsSvg.seek(NaN));assert.equal((await snapshot(page)).time,14);
  await page.locator('#seek').fill('4.2');assert.equal((await snapshot(page)).time,4.2);
});
test('every speed option changes real elapsed playback rate', async page => {
  await page.goto(`${base}/index.html`);
  assert.deepEqual(await page.locator('#speed option').evaluateAll(xs=>xs.map(x=>x.value)),['0.5','1','1.5','2']);
  for(const speed of [.5,1,1.5,2]){
    await page.evaluate(()=>ddsSvg.restart());await page.locator('#speed').selectOption(String(speed));
    const before=await page.evaluate(()=>{ddsSvg.toggle();return performance.now()});
    await page.waitForTimeout(350);
    const {t,elapsed}=await page.evaluate(before=>{ddsSvg.toggle();return {t:ddsSvg.time,elapsed:(performance.now()-before)/1000}},before);
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
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${base}/index.html?topic=security`);
  assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
  await page.evaluate(()=>{ddsSvg.toggle();ddsSvg.restart();ddsSvg.seek(2)});
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
    assert.equal(sent.type,'dds-animation-height');assert.equal(sent.height,expected);assert.ok(Number.isFinite(sent.height));
    assert.equal(await page.evaluate(()=>targets.at(-1)),new URL(base).origin);
  };
  await check();const n=await page.evaluate(()=>heights.length);
  await child.locator('summary').click();await page.waitForFunction(n=>heights.length>n,n);await check();
});
const shown = (page,id) => page.locator('#'+id).evaluate(el=>Number(getComputedStyle(el).opacity)>0.9);
const topics=['guide','basics','discovery-addressing','qos','history-persistence','security','device-adapters','realtime-linux','fault-diagnosis','observability','gva-losa'];
const semantic={guide:['map-0','map-9'],basics:['instances','meaning'],'discovery-addressing':['match','userdata'],qos:['retransmit','stillalive'],'history-persistence':['latejoin','commit'],security:['permissions','operation'],'device-adapters':['bytes','typed'],'realtime-linux':['cpu-wait','publish'],'fault-diagnosis':['timeout','session'],observability:['stats-backend','correlate'],'gva-losa':['standards','transport']};
test('11 distinct scenes have meaningful initial, middle and final states',async page=>{
  const titles=[],manifest=[];
  for(const topic of topics){
    await page.goto(`${base}/index.html?topic=${topic}`);titles.push(await page.locator('h1').textContent());
    const [early,late]=semantic[topic];assert.equal(await shown(page,late),false);assert.equal(await shown(page,'resolution'),false);
    const first=await page.locator('#payload').getAttribute('transform');
    await page.evaluate(()=>ddsSvg.seek(7));assert.equal(await shown(page,early),true);assert.equal(await shown(page,late),false);
    assert.notEqual(await page.locator('#payload').getAttribute('transform'),first);
    await page.evaluate(()=>ddsSvg.seek(14));assert.equal(await shown(page,late),true);assert.equal(await shown(page,'resolution'),true);
    assert.match(await page.locator('#fallback').textContent(),/설명용/);
    for(const time of [0,7,14]){await page.evaluate(t=>ddsSvg.seek(t),time);const file=`${topic}-${time}.png`;await page.locator('.vector-scroll').screenshot({path:path.join(out,file)});manifest.push({topic,time,file});}
  }
  assert.equal(new Set(titles).size,11);fs.writeFileSync(path.join(out,'screenshot-manifest.json'),JSON.stringify(manifest,null,2));
});
test('topic changes pause and reset, update URL, and unknown topics fall back',async page=>{
  await page.goto(`${base}/index.html?topic=no-such-topic`);assert.equal((await snapshot(page)).topic,'guide');
  await page.evaluate(()=>ddsSvg.toggle());await page.locator('#topic').selectOption('qos');
  assert.equal((await snapshot(page)).topic,'qos');assert.equal((await snapshot(page)).time,0);assert.equal((await snapshot(page)).playing,false);
  assert.match(page.url(),/topic=qos/);await page.evaluate(()=>ddsSvg.setTopic('garbage'));assert.equal((await snapshot(page)).topic,'guide');
  const links=await page.locator('svg a').evaluateAll(xs=>xs.map(x=>new URL(x.getAttribute('href'),location.href).pathname));
  assert.deepEqual(links.sort(),topics.slice(1).map(t=>'/dds/'+t+'/').sort());
});
test('all topics remain readable at 320px without page overflow',async page=>{
 await page.setViewportSize({width:320,height:1100});
 for(const topic of topics){await page.goto(`${base}/index.html?topic=${topic}`);await page.evaluate(()=>ddsSvg.seek(14));
  const m=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,vector:document.querySelector('.vector-scroll').scrollWidth,container:document.querySelector('.vector-scroll').clientWidth,controls:document.querySelector('.controls').scrollWidth,controlWidth:document.querySelector('.controls').clientWidth}));
  assert.ok(m.page<=m.width,JSON.stringify(m));assert.ok(m.vector>=680&&m.vector>m.container);assert.ok(m.controls<=m.controlWidth,JSON.stringify(m));
  await page.locator('summary').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.evaluate(()=>document.body.getBoundingClientRect().height<2000));
 }
});
test('all topics honor reduced motion and live preference changes',async page=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const topic of topics){await page.goto(`${base}/index.html?topic=${topic}`);assert.equal((await snapshot(page)).time,14);assert.equal(await shown(page,'resolution'),true);assert.equal(await page.locator('#seek').isDisabled(),true);}
 await page.locator('#topic').selectOption('basics');assert.equal((await snapshot(page)).time,14);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>ddsSvg.time===0);assert.equal((await snapshot(page)).time,0);
});
test('moving payloads do not cover fixed labels throughout every timeline',async page=>{
 const allCollisions=[];
 for(const topic of topics){await page.goto(`${base}/index.html?topic=${topic}`);
  const collisions=await page.evaluate(()=>{
   const result=[];const visible=n=>{for(let e=n;e&&e!==document.body;e=e.parentElement)if(Number(getComputedStyle(e).opacity)<.9)return false;return true};
   for(let t=0;t<=14;t+=.5){ddsSvg.seek(t);const moving=[...document.querySelectorAll('#payload,#payload-b,#chunk-a,#chunk-b,#lost')].filter(visible);
    const labels=[...document.querySelectorAll('svg text')].filter(n=>visible(n)&&!moving.some(m=>m.contains(n)));
    for(const m of moving){const a=m.getBoundingClientRect();for(const l of labels){const b=l.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)result.push({time:t,id:m.id,label:l.textContent});}}
   }return result;
  });allCollisions.push(...collisions.map(c=>({topic,...c})));
 }assert.deepEqual(allCollisions,[],'payload/label collisions');
});
test('fault state keeps old value unusable until three fresh recovery samples',async page=>{
 await page.goto(`${base}/index.html?topic=fault-diagnosis`);
 for(const [time,state,count] of [[0,'UNKNOWN',0],[2,'HEALTHY',0],[4,'STALE',0],[7,'RECOVERING',1],[9,'RECOVERING',2],[11,'HEALTHY',3]]){
  await page.evaluate(t=>ddsSvg.seek(t),time);assert.equal(await page.locator('#scene').getAttribute('data-state'),state);
  assert.match(await page.locator('#stage-note').textContent(),new RegExp(state));
  if(count)assert.match(await page.locator('#payload').textContent(),new RegExp(`${count}/3`));
 }
});
test('playback holds at endpoint and restarts on play',async page=>{
 await page.goto(`${base}/index.html?topic=qos`);await page.locator('#speed').selectOption('2');await page.evaluate(()=>{ddsSvg.seek(13.5);ddsSvg.toggle()});
 await page.waitForTimeout(450);assert.equal((await snapshot(page)).time,14);assert.equal((await snapshot(page)).playing,false);
 await page.locator('#play').click();assert.ok((await snapshot(page)).time<1);assert.equal((await snapshot(page)).playing,true);
});
let base;
(async()=>{
  const server = http.createServer((req,res)=>{
    if(req.url==='/harness.html'){
      res.setHeader('Content-Type','text/html');res.end(`<html><body style="margin:0"><script>window.heights=[];window.targets=[];const native=window.postMessage.bind(window);window.postMessage=(data,target)=>{targets.push(target);native(data,target)};addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='dds-animation-height'){heights.push(e.data);document.querySelector('iframe').style.height=e.data.height+'px'}})</script><iframe src="/index.html?topic=basics" style="width:100%;height:100px;border:0"></iframe></body></html>`);return;
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
  const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--disable-gpu'],timeout:30000});
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
