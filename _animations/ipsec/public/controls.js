const chapters = [
  ['IKE와 ESP의 역할','IKE는 상대 인증과 키·알고리즘 협상을 맡는 제어 프로토콜입니다. ESP는 합의된 SA로 실제 IP 데이터를 보호합니다.'],
  ['IKE_SA_INIT 요청','A가 IKE 알고리즘 제안(SAi1), DH 공개값(KEi), 난수 Ni를 보냅니다. DH 개인값과 PSK는 전송하지 않습니다.'],
  ['IKE_SA_INIT 응답','B가 선택한 IKE 알고리즘(SAr1), DH 공개값(KEr), 난수 Nr로 답합니다. 이 두 메시지는 평문이고 아직 인증되지 않았습니다.'],
  ['DH 공유 비밀 → IKE 키','정상 교환에서 양쪽은 같은 DH 공유 비밀을 계산하고, 난수와 SPI 등을 이용해 IKE용 키를 파생합니다. 암호화할 준비가 됐다고 상대 인증까지 끝난 것은 아닙니다.'],
  ['IKE_AUTH 요청','암호화·무결성 보호된 요청 안에 A의 신원과 AUTH, 첫 CHILD SA의 알고리즘·트래픽 범위 제안이 들어갑니다. AUTH는 PSK와 앞선 교환 내용을 연결해 검증합니다.'],
  ['IKE_AUTH 응답','B도 신원과 AUTH를 보내고 CHILD SA의 설정을 확정합니다. 양쪽 검증이 성공해야 상호 인증된 IKE SA와 첫 ESP SA 쌍을 사용할 수 있습니다.'],
  ['방향별 ESP 키와 SA','첫 CHILD SA의 키 재료는 SK_d와 초기 교환의 Ni·Nr에서 파생합니다. A→B와 B→A는 서로 다른 키·SPI·순번 상태를 갖는 단방향 SA입니다.'],
  ['A→B ESP 암호화','AES-GCM 터널 모드에서 원래 IP 헤더와 데이터, ESP trailer를 암호화하고 인증 태그를 만듭니다. 외부 IP 헤더·SPI·순번·explicit IV는 암호화하지 않습니다.'],
  ['B→A ESP와 검증','역방향은 별도 ESP SA를 사용합니다. 수신 측은 SPI로 SA를 고르고, 인증 태그와 재전송 여부를 검증한 뒤 복호화한 내부 패킷만 전달합니다.'],
];
const el=document.querySelector('motion-canvas-player');
const byId=id=>document.getElementById(id);
const fps=30;
let duration=2160;
let currentFrame=0;
let core;
const buttons=chapters.map(([title],i)=>{
  const button=document.createElement('button');
  button.textContent=`${String(i).padStart(2,'0')} ${title}`;
  button.dataset.chapter=String(i);button.disabled=true;
  button.addEventListener('click',()=>seek(i*8*fps));
  byId('chapters').append(button);return button;
});
function clock(frames){const seconds=Math.floor(frames/fps);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function update(frame){
  currentFrame=frame;
  byId('seek').value=String(frame);
  byId('time').textContent=`${clock(frame)} / ${clock(duration)}`;
  const index=Math.min(8,Math.floor(frame/(8*fps)));
  byId('chapter-title').textContent=`${String(index).padStart(2,'0')} · ${chapters[index][0]}`;
  byId('summary').textContent=chapters[index][1];
  buttons.forEach((b,i)=>b.setAttribute('aria-current',String(index===i)));
}
function seek(frame){el.setPlaying(false);core.requestSeek(Math.min(duration-1,Math.max(0,frame)));}
function toggle(){
  if(currentFrame>=duration-1)core.requestSeek(0);
  el.setPlaying(core.onStateChanged.current.paused);
}
function fail(error){byId('status').textContent='로딩 실패: 새로고침하거나 본문의 정적 설명을 읽어 주세요.';byId('status').classList.add('error');console.error(error);}
async function init(){
  await customElements.whenDefined('motion-canvas-player');
  const started=Date.now();
  while(el.state!=='ready'||!el.player||el.player.onDurationChanged.current<=0){
    if(el.state==='error'||Date.now()-started>60000)throw new Error('Motion Canvas could not initialize');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  // Adapter to the official 3.17.2 web component; version is intentionally pinned.
  core=el.player;
  duration=core.onDurationChanged.current;
  byId('seek').max=String(duration-1);
  el.setPlaying(false);core.toggleLoop(false);
  core.onFrameChanged.subscribe(update);
  core.onStateChanged.subscribe(state=>{
    el.playing=!state.paused;el.updateClass();
    byId('play').textContent=state.paused?'▶ 재생':'Ⅱ 일시정지';
    byId('play').setAttribute('aria-label',state.paused?'재생':'일시정지');
  });
  for(const control of document.querySelectorAll('button,input'))control.disabled=false;
  byId('play').addEventListener('click',toggle);
  byId('restart').addEventListener('click',()=>seek(0));
  byId('prev').addEventListener('click',()=>seek((Math.ceil(currentFrame/(8*fps))-1)*8*fps));
  byId('next').addEventListener('click',()=>seek((Math.floor(currentFrame/(8*fps))+1)*8*fps));
  byId('seek').addEventListener('input',event=>seek(Number(event.target.value)));
  byId('speed').addEventListener('change',event=>core.setSpeed(Number(event.target.value)));
  document.addEventListener('keydown',event=>{
    if(event.target!==document.body&&event.target!==el)return;
    if(event.code==='Space'){event.preventDefault();toggle();}
    if(event.code==='ArrowRight'){event.preventDefault();byId('next').click();}
    if(event.code==='ArrowLeft'){event.preventDefault();byId('prev').click();}
  });
  update(core.onFrameChanged.current);
  byId('status').textContent='준비 완료 · 각 구간 8초 · 자동 재생 없음';
  window.ipsecDemo={player:core,element:el};
  document.body.dataset.ready='true';
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){el.setPlaying(false);core.deactivate();}else core.activate();
  });
  if(window.parent!==window){
    const notify=()=>window.parent.postMessage({type:'ipsec-demo-height',height:document.documentElement.scrollHeight},location.origin);
    new ResizeObserver(notify).observe(document.body);notify();
  }
}
init().catch(fail);
