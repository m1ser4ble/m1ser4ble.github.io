import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const base=process.env.DEMO_URL||'http://127.0.0.1:8767/assets/animations/ipsec-explainer/index.html';
const out=path.resolve('test-output');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:1280,height:1080}});const errors=[],results=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
const seek=async frame=>{await page.locator('#seek').evaluate((e,f)=>{e.value=String(f);e.dispatchEvent(new Event('input',{bubbles:true}));},frame);await page.waitForFunction(f=>window.ipsecExplainer.player.onFrameChanged.current===f,frame);};
const bitmap=()=>page.evaluate(()=>document.querySelector('motion-canvas-player').shadowRoot.querySelector('canvas').toDataURL());
try{
 for(const [topic,count] of [['keys',6],['mitm',5],['modes',4]]){
  await page.setViewportSize({width:1280,height:1080});await page.goto(base+'?topic='+topic);await page.waitForFunction(()=>document.body.dataset.ready==='true');
  for(let chapter=0;chapter<count;chapter++){
   await seek(chapter*180+90);
   const labels=await page.evaluate(()=>{const v=window.ipsecExplainer.player.playback.currentScene.getView();const a=[];const walk=n=>{if(typeof n.text==='function'&&typeof n.parent()?.text!=='function'&&n.absoluteOpacity()>.5){const p=n.absolutePosition(),s=n.size();a.push({text:n.text(),x:p.x-s.x/2,y:p.y-s.y/2,w:s.x,h:s.y});}n.children().forEach(walk);};walk(v);return a;});
   if(topic==='modes'&&chapter===3){
    const underlyingVisible=await page.evaluate(()=>{const walk=n=>[n,...n.children().flatMap(walk)];return walk(window.ipsecExplainer.player.playback.currentScene.getView()).filter(n=>typeof n.text==='function'&&/^(Original IP|NEW outer IP)/.test(n.text())&&n.absoluteOpacity()>.5).length;});
    assert.equal(underlyingVisible,0,'Topology chapter must hide prior packet shapes, not leave protruding edges');
   }
   {
    for(const t of labels)assert.ok(t.x>=0&&t.y>=0&&t.x+t.w<=1280&&t.y+t.h<=720,`No clipped label: ${topic}/${chapter} ${t.text}`);
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
     const a=labels[i],c=labels[j],w=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x),h=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);
     assert.ok(!(w>2&&h>2),`No overlapping labels: ${topic}/${chapter}: ${a.text} / ${c.text}`);
    }
   }
   await page.screenshot({path:path.join(out,`${topic}-chapter-${chapter+1}.png`),fullPage:true});
  }
  await seek(topic==='keys'?180:0);const before=await bitmap();await page.locator('#play').click();
  const start=await page.evaluate(()=>window.ipsecExplainer.player.onFrameChanged.current);await page.waitForFunction(f=>window.ipsecExplainer.player.onFrameChanged.current>f+20,start);await page.locator('#play').click();
  assert.notEqual(await bitmap(),before,`${topic}: real playback changes canvas pixels`);
  await page.setViewportSize({width:390,height:900});await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.equal(await page.evaluate(()=>window.ipsecExplainer.player.onStateChanged.current.paused),true,'Reduced-motion: still no autoplay');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${topic}: no mobile horizontal overflow`);
  assert.ok(await page.locator('#play').isVisible());await page.screenshot({path:path.join(out,`${topic}-mobile.png`),fullPage:true});
  results.push({topic,chapters:count,pixelMovement:true,mobileOverflow:false,reducedMotionPaused:true});fs.writeFileSync(path.join(out,'visual-results.json'),JSON.stringify({results,errors},null,2));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',results,errors}));
}finally{await b.close();}
