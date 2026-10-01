'use strict';
(()=>{
const requested=new URLSearchParams(location.search).get('topic');
const topic=['keys','mitm','handshake'].includes(requested)?requested:'keys';
const drawScene=createIpsecScene(topic);
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
let time=reduced?14:0,playing=false,frame=0,last=0;const duration=14;
const play=document.querySelector('#play'),seekInput=document.querySelector('#seek'),clock=document.querySelector('#clock');
function render(){
  drawScene(time);
  play.textContent=playing?'정지':'재생';play.setAttribute('aria-pressed',String(playing));
  seekInput.value=time;clock.textContent=`${time.toFixed(1)} / ${duration}초`;
}
function tick(){
  if(!playing)return;
  // Start, seek and tick share this document's monotonic clock.
  const now=performance.now();
  time=Math.min(duration,time+Math.max(0,now-last)/1000*Number(document.querySelector('#speed').value));last=now;
  if(time===duration)playing=false;
  render();if(playing)frame=requestAnimationFrame(tick);
}
function toggle(){
  if(reduced)return;
  playing=!playing;cancelAnimationFrame(frame);
  if(playing){if(time===duration)time=0;last=performance.now();frame=requestAnimationFrame(tick);}render();
}
function restart(){if(reduced)return;playing=false;cancelAnimationFrame(frame);time=0;render();}
play.addEventListener('click',toggle);document.querySelector('#restart').addEventListener('click',restart);
function seek(value){
  if(reduced||!Number.isFinite(value))return;
  time=Math.max(0,Math.min(duration,value));last=performance.now();
  if(time===duration){playing=false;cancelAnimationFrame(frame);}render();
}
seekInput.addEventListener('input',()=>seek(Number(seekInput.value)));
document.querySelector('#player').addEventListener('keydown',event=>{
  if(event.target.closest('input,select,button,summary,.vector-scroll') || event.ctrlKey || event.metaKey || event.altKey)return;
  const actions={' ':toggle,ArrowRight:()=>seek(time+1),ArrowLeft:()=>seek(time-1),Home:restart,End:()=>seek(duration)};
  if(actions[event.key]){event.preventDefault();if(!event.repeat||event.key!==' ')actions[event.key]();}
});
function applyMotionPreference(){
  reduced=motionPreference.matches;playing=false;cancelAnimationFrame(frame);time=reduced?duration:0;
  for(const id of ['play','restart','seek','speed'])document.getElementById(id).disabled=reduced;
  document.querySelector('.help').textContent=reduced?'동작 줄이기 설정: 마지막 장면을 정적으로 표시합니다.':'Space 재생·정지 · ←/→ 1초 이동 · Home 처음 · End 끝';render();
}
motionPreference.addEventListener('change',applyMotionPreference);applyMotionPreference();
window.ipsecSvg={topic,get time(){return time},get playing(){return playing},get duration(){return duration},seek,toggle,restart};
render();
let heightFrame=0,lastHeight=0;
function reportHeight(){
  cancelAnimationFrame(heightFrame);
  heightFrame=requestAnimationFrame(()=>{
    const height=Math.ceil(document.body.getBoundingClientRect().height);
    if(Number.isFinite(height)&&height>0&&height!==lastHeight){
      lastHeight=height;parent.postMessage({type:'ipsec-explainer-height',height},location.origin);
    }
  });
}
new ResizeObserver(reportHeight).observe(document.body);
addEventListener('resize',reportHeight);addEventListener('load',reportHeight);
document.fonts.ready.then(reportHeight);reportHeight();
})();
