import {topics,topic,chapterFrames} from './topics.js';
const data=topics[topic],chapters=data.chapters;
const el=document.querySelector('motion-canvas-player');
const $=id=>document.getElementById(id);
$('topic-title').textContent=data.title;document.title=data.title+' — Motion Canvas';
$('fallback').textContent=data.fallback;
let core,duration=chapters.length*chapterFrames,currentFrame=0;
const buttons=chapters.map(([title,caption],i)=>{
 const b=document.createElement('button');b.textContent=`${i+1}. ${title}`;b.dataset.chapter=String(i);b.disabled=true;b.addEventListener('click',()=>seek(i*chapterFrames));$('chapters').append(b);
 const li=document.createElement('li');li.textContent=`${title}: ${caption}`;$('transcript').append(li);return b;
});
function clock(f){return `${Math.floor(f/30)}초`;}
function update(frame){currentFrame=frame;$('seek').value=String(frame);$('time').textContent=`${clock(frame)} / ${clock(Math.round(duration/30)*30)}`;const i=Math.min(chapters.length-1,Math.floor(frame/chapterFrames));$('chapter-title').textContent=`${i+1} / ${chapters.length} · ${chapters[i][0]}`;$('summary').textContent=chapters[i][1];buttons.forEach((b,n)=>b.setAttribute('aria-current',String(n===i)));}
function seek(frame){el.setPlaying(false);core.requestSeek(Math.max(0,Math.min(duration-1,frame)));}
function toggle(){if(currentFrame>=duration-1)core.requestSeek(0);el.setPlaying(core.onStateChanged.current.paused);}
async function init(){
 await customElements.whenDefined('motion-canvas-player');const started=Date.now();
 while(el.state!=='ready'||!el.player||el.player.onDurationChanged.current<=0){if(el.state==='error'||Date.now()-started>60000)throw new Error('Player loading timed out');await new Promise(r=>setTimeout(r,100));}
 core=el.player;duration=core.onDurationChanged.current;el.setPlaying(false);core.toggleLoop(false);$('seek').max=String(duration-1);
 core.onFrameChanged.subscribe(update);core.onStateChanged.subscribe(s=>{el.playing=!s.paused;el.updateClass();$('play').textContent=s.paused?'▶ 재생':'Ⅱ 일시정지';$('play').setAttribute('aria-label',s.paused?'재생':'일시정지');});
 document.querySelectorAll('button,input,select').forEach(c=>c.disabled=false);
 $('play').addEventListener('click',toggle);$('restart').addEventListener('click',()=>seek(0));$('prev').addEventListener('click',()=>seek((Math.ceil(currentFrame/chapterFrames)-1)*chapterFrames));$('next').addEventListener('click',()=>seek((Math.floor(currentFrame/chapterFrames)+1)*chapterFrames));$('seek').addEventListener('input',e=>seek(Number(e.target.value)));$('speed').addEventListener('change',e=>core.setSpeed(Number(e.target.value)));
 document.addEventListener('keydown',e=>{if(e.target!==document.body&&e.target!==el)return;if(e.code==='Space'){e.preventDefault();toggle();}if(e.code==='ArrowRight'){e.preventDefault();$('next').click();}if(e.code==='ArrowLeft'){e.preventDefault();$('prev').click();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){el.setPlaying(false);core.deactivate();}else core.activate();});
 if(parent!==window){const notify=()=>parent.postMessage({type:'ipsec-explainer-height',height:Math.ceil(document.documentElement.scrollHeight)},location.origin);new ResizeObserver(notify).observe(document.body);notify();}
 update(core.onFrameChanged.current);window.ipsecExplainer={topic,player:core,element:el};$('status').textContent='준비 완료 · 장면당 6초 · 자동 재생 없음';document.body.dataset.ready='true';
}
init().catch(e=>{$('status').textContent='로딩 실패 · 아래 정적 설명 또는 본문을 읽어 주세요.';console.error(e);});
