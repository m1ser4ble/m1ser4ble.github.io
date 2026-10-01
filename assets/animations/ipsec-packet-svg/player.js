const player = document.querySelector('#player');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let time=reduced.matches?9:0, last=0, frame=0, speed=1;
const $=id=>document.getElementById(id);
const clamp=v=>Math.max(0,Math.min(1,v));
// Smoothstep: restrained, zero-velocity starts and landings; no spring/overshoot.
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const progress=(a,b)=>ease((time-a)/(b-a));
const lerp=(a,b,p)=>a+(b-a)*p;
function opacity(id,p){$(id).setAttribute('opacity',String(p));}
function position(id,x,y){$(id).setAttribute('transform',`translate(${Number(x.toFixed(3))} ${Number(y.toFixed(3))})`);}
function field(id,from,to,a,b,waypoint) {
  const p=progress(a,b), g=$(id);
  let x=lerp(from[0],to[0],p), y=lerp(162,to[1],p);
  if(waypoint) {
    const q=p<.5?p*2:(p-.5)*2;
    x=p<.5?lerp(from[0],waypoint[0],q):lerp(waypoint[0],to[0],q);
    y=p<.5?lerp(162,waypoint[1],q):lerp(waypoint[1],to[1],q);
  }
  position(id,x,y);
  const width=lerp(from[1],to[2],p),height=lerp(60,to[3]||60,p);
  g.querySelector('rect').setAttribute('width',width);
  g.querySelector('rect').setAttribute('height',height);
  for(const text of g.querySelectorAll('text')) text.setAttribute('x',width/2);
}
function render() {
  seek.value=time;
  $('clock').textContent=`${time.toFixed(1)} / 9.0 s`;
  const tunnel=player.dataset.mode==='tunnel';
  $('mode-summary').textContent=tunnel?'원본 IP 헤더까지 안쪽에':'원래 IP 헤더는 바깥에';
  const sealed=progress(3.7,4.3);
  if(tunnel) {
    field('original-ip',[40,158],[451,313,124],2.05,2.75,[250,245]);
    field('tcp',[210,160],[583,313,78],1.3,2.05,[440,255]);
    field('data',[382,268],[669,313,122],1.7,2.45);
  } else {
    field('original-ip',[40,158],[40,304,158,78],2.15,2.7);
    field('tcp',[210,160],[455,313,108],1.3,2.05);
    field('data',[382,268],[575,313,206],1.7,2.45);
  }
  $('original-ip').setAttribute('data-region',tunnel?'encrypted':'outside');
  opacity('original-ip',tunnel?1-sealed:1);
  opacity('tcp',1-sealed);opacity('data',1-sealed);
  $('selection-path').setAttribute('d',`M${tunnel?40:210} 228V239H650V228`);
  $('selection-label').setAttribute('x',tunnel?345:430);
  $('selection-label').textContent=tunnel?'원본 패킷 전체를 암호화':'IP 헤더를 제외하고 암호화';
  opacity('selection',1-progress(1.15,2.15));
  opacity('before-reference',progress(3.2,3.65));
  opacity('source-guide',1-progress(1.15,2.1));
  const trailer=progress(2.7,3.15);
  position('trailer',tunnel?799:793,lerp(342,313,trailer));
  opacity('trailer',trailer*(1-sealed));
  const wrap=progress(3.15,3.75);
  opacity('envelope',wrap);
  $('envelope').setAttribute('transform',`translate(0 ${304*(1-wrap)}) scale(1 ${Math.max(.001,wrap)})`);
  $('fold').setAttribute('d',`M438 304L682 ${lerp(382,305,sealed)}L926 304`);
  opacity('fold',wrap*(1-sealed));
  $('cipher-label').textContent=tunnel?'IP A→B + TCP + Data + ESP trailer':'TCP + Data + ESP trailer';
  const labelReveal=progress(4.3,4.5);
  opacity('cipher-label',labelReveal);opacity('cipher-kicker',labelReveal);
  $('cipher-label').setAttribute('transform',`translate(0 ${7*(1-labelReveal)})`);
  const esp=progress(4.4,4.95),iv=progress(4.8,5.35),outer=progress(5.15,5.7),tag=progress(5.75,6.3);
  position('esp',210,lerp(272,304,esp));opacity('esp',esp);
  position('iv',324,lerp(272,304,iv));opacity('iv',iv);
  position('outer-ip',40,lerp(272,304,outer));opacity('outer-ip',tunnel?outer:0);
  position('tag',938,lerp(272,304,tag));opacity('tag',tag);
  opacity('boundary-note',progress(4.2,4.6));
  $('ip-note').textContent=tunnel?'게이트웨이 주소':'원본 IP 유지';
  opacity('ip-note',tunnel?outer:1);
  const auth=progress(6.25,6.65);opacity('authentication',auth);
  for(const id of ['auth-esp','auth-cipher']) {const p=$(id);const length=p.getTotalLength();p.style.strokeDasharray=length;p.style.strokeDashoffset=length*(1-auth);}
  const steps=[
    ['원본 패킷을 확인합니다','A에서 B로 보내는 IP 헤더, TCP 헤더, 데이터입니다.'],
    ['암호화할 필드를 모읍니다',tunnel?'원본 IP 헤더도 TCP·Data와 함께 이동합니다.':'원본 IP 헤더는 남기고 TCP·Data만 안쪽으로 옮깁니다.'],
    ['암호문 봉투를 닫습니다','ESP trailer까지 넣은 뒤, AES-GCM이 이 범위를 암호화합니다.'],
    ['암호문 밖의 필드를 붙입니다',tunnel?'ESP 헤더·IV·Tag와 새 IP 헤더(GA→GB)를 붙입니다.':'ESP 헤더·IV·Tag는 원본 IP 헤더 뒤, 암호문 밖에 붙습니다.'],
    [tunnel?'Tunnel · 원본 패킷 전체가 안쪽에':'Transport · 원본 IP 헤더는 바깥에','Tag는 ESP 헤더(AAD)와 암호문을 인증합니다. IV는 암호화하지 않습니다.']
  ];
  const step=time<1.2?0:time<3.15?1:time<4.4?2:time<6.65?3:4;
  $('step-number').textContent=`0${step+1} / 05`;
  $('step-title').textContent=steps[step][0];$('step-detail').textContent=steps[step][1];
  $('motion-note').textContent=reduced.matches?'움직임 줄이기 설정: 최종 구조를 정지 화면으로 표시합니다. 모드 선택은 계속 사용할 수 있습니다.':'재생을 누르면 한 번만 진행합니다. 슬라이더로 각 단계를 확인할 수 있습니다.';
}
function pause() {
  cancelAnimationFrame(frame); player.dataset.state='paused'; play.textContent='재생';
}
function tick() {
  if(player.dataset.state !== 'playing') return;
  // Use the same local monotonic clock as start(), even inside iframes.
  const now=performance.now();
  time=Math.min(9,time+Math.max(0,now-last)*speed/1000); last=now; render();
  if(time>=9) pause(); else frame=requestAnimationFrame(tick);
}
function start() {
  if(reduced.matches) {time=9; render(); return;}
  if(time>=9) time=0;
  player.dataset.state='playing'; play.textContent='일시 정지'; last=performance.now(); frame=requestAnimationFrame(tick);
}
$('restart').onclick=()=>{pause(); time=reduced.matches?9:0; render();};
$('speed').onchange=()=>{speed=Number($('speed').value);};
play.onclick=()=>player.dataset.state==='playing'?pause():start();
seek.oninput=()=>{pause();time=reduced.matches?9:Number(seek.value);render();};
for (const button of document.querySelectorAll('button[data-mode]')) {
  button.onclick = () => {
    pause(); player.dataset.mode = button.dataset.mode; time=reduced.matches?9:0;
    document.querySelectorAll('button[data-mode]').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
    render();
  };
}
reduced.addEventListener('change',()=>{pause(); play.disabled=reduced.matches; seek.disabled=reduced.matches; time=reduced.matches?9:0; render();});
play.disabled=reduced.matches; seek.disabled=reduced.matches; render();
window.ipsecSvg={topic:'modes',get time(){return time;},get playing(){return player.dataset.state==='playing';},get duration(){return 9;},get speed(){return speed;},seek(t){pause();time=reduced.matches?9:Math.max(0,Math.min(9,Number(t)||0));render();},toggle(){play.click();},restart(){$('restart').click();}};
let resizeFrame=0;
function reportHeight(){
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{
    const height=Math.ceil(document.querySelector('main').getBoundingClientRect().height);
    if(parent!==window && height>=350 && height<=2000) parent.postMessage({type:'ipsec-explainer-height',height},location.origin);
  });
}
new ResizeObserver(reportHeight).observe(document.querySelector('main'));
addEventListener('load',reportHeight);addEventListener('resize',reportHeight);reportHeight();
