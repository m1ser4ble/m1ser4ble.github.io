'use strict';
// Corporate motion: eased 0.6–1.2 s travel, staged local derivation, no ambient particles.
window.createIpsecScene = function(topic) {
  const svg=document.getElementById('scene');
  const text=(x,y,s,cls='')=>`<text x="${x}" y="${y}" class="${cls}">${s}</text>`;
  const rect=(x,y,w,h,cls='panel',r=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}"/>`;
  const line=(d,cls='',arrow=false)=>`<path d="${d}" class="wire ${cls}" ${arrow?'marker-end="url(#arrow)"':''}/>`;
  const group=(id,content)=>`<g id="${id}">${content}</g>`;
  const badge=(id,label,w=82,cls='violet')=>group(id,rect(-w/2,-15,w,30,cls,7)+`<text text-anchor="middle" y="1" class="mono strong small">${label}</text>`);
  const dot=(id,label)=>group(id,'<circle r="20" class="violet"/>'+`<text text-anchor="middle" y="1" class="mono strong">${label}</text>`);
  const clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
  const phase=(t,start,end)=>ease((t-start)/(end-start));
  const nodes=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,document.getElementById(id));return nodes.get(id);}
  function at(id,x,y,opacity=1){const el=node(id);if(!el)return;el.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);el.style.opacity=opacity;}
  function reveal(id,t,start,x=0,y=0){const q=phase(t,start,start+.5);at(id,x,y+12*(1-q),q);}
  // Every long journey has waypoints; each segment eases independently.
  function travel(id,t,start,end,points,opacity=1){
    const q=clamp((t-start)/(end-start))*(points.length-1),i=Math.min(points.length-2,Math.floor(q));
    const p=ease(q-i),a=points[i],b=points[i+1];at(id,a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,opacity);
  }
  const defs='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8d8697"/></marker></defs>';
  const disclaimer='이것은 실제 암호 연산이나 패킷 캡처가 아닌 설명용 도식입니다. 기본 IKEv2 PSK 상호 인증 경로만 표현하며 EAP·재키잉·오류 처리의 모든 분기는 생략합니다.';
  const common=' PSK는 관리자가 IKE와 독립된 신뢰 경로로 양쪽에 미리 배포한 강한 인증 비밀이며 IKE로 전송하지 않습니다. DH 비밀 Z·IKE 키·ESP 키와 다릅니다. 피어 인증은 사용자 인가나 MFA를 대신하지 않습니다. ';
  const configs={
    handshake:{title:'제어 교환에서 데이터 패킷까지.',subtitle:'IKE가 관계를 준비하고, 별도의 ESP가 사용자 패킷을 보호합니다.',steps:['INIT 공개 교환','로컬 Z · IKE 키','보호된 AUTH','방향별 SA · ESP'],starts:[0,3,5,8],fallback:'기본 성공 경로의 시간 순서입니다. IKE_SA_INIT에서 A→B는 SAi1·KEi·Ni, B→A는 SAr1·KEr·Nr를 공개 교환합니다. 이 시점에는 피어 신원이 인증되지 않았습니다. 양쪽은 로컬 비밀값과 받은 공개값으로 Z를 계산하고 nonce·문맥과 PRF 기반 KDF로 IKE 키 그룹을 로컬 파생합니다. 키 자체는 전송하지 않습니다. 이후 IKE 키로 보호된 IKE_AUTH는 ID·교환에 결합된 PSK AUTH 검증·첫 Child SA의 ESP 알고리즘과 Traffic Selector 협상을 수행합니다. 사용자 TCP 데이터는 IKE_AUTH의 내용이 아닙니다. 외부 IKE 헤더까지 암호화된다는 뜻도 아닙니다. AUTH와 첫 Child SA 협상이 모두 성공하면 SK_d와 초기 Ni/Nr로 별도 방향별 ESP 키·salt를 파생하여 로컬 SA 상태를 설치합니다. 첫 Child SA에는 별도 새 DH나 필수 CREATE_CHILD_SA가 없습니다. SA_AB에서는 A 송신과 B 수신이 같은 K_AB를 쓰고, SA_BA에서는 B 송신과 A 수신이 같은 K_BA를 씁니다. 반대 방향에는 별도 SPI·순번 등 상태를 사용합니다. 그 뒤 정책에 맞는 사용자 IP 패킷을 ESP로 보호·검증·복호화합니다. 피어 인증 성공만으로 모든 사용자 트래픽을 허용하지 않습니다.'+common+disclaimer,
      captions:[
        '<b>① IKE_SA_INIT.</b> 알고리즘 제안·선택, 공개 DH 값, nonce가 두 방향으로 이동합니다. 초기 교환은 공개이며 아직 피어 신원은 인증되지 않았습니다.',
        '<b>② 로컬 계산.</b> 양쪽이 같은 Z와 용도별 IKE 키를 각자 파생합니다. 비밀값과 파생 키를 네트워크로 배송하지 않습니다. 아직 데이터 연결 승인 전입니다.',
        '<b>③ 보호된 IKE_AUTH.</b> PSK 기반 AUTH로 피어를 검증하면서 첫 Child SA를 협상합니다. ID·AUTH·SA·TS는 제어 정보입니다. 사용자 TCP 데이터를 이 교환에 싣지 않습니다.',
        '<b>④ 성공한 첫 Child SA.</b> SK_d에서 별도 ESP 키를 파생하고 SA_AB·SA_BA를 설치합니다. 각 방향의 송신·수신은 같은 키를 사용합니다. 사용자 IP 패킷은 이후 ESP로 이동합니다.'
      ]},
    mitm:{title:'두 DH 비밀, 인증은 실패.',subtitle:'중간자가 IKE 키를 알아도 피어 AUTH를 위조할 수는 없습니다.',steps:['공개값 치환','두 DH 비밀','AUTH 전달 · 검증','연결 거부'],starts:[0,3,6,9],fallback:'공격자 M은 PSK를 모른다고 가정합니다. M이 공개 DH 값을 치환하면 A↔M과 M↔B라는 서로 다른 두 DH가 생깁니다. Z_AM은 A와 M이, Z_MB는 M과 B가 압니다. M은 두 연결의 IKE 키를 모두 계산하고 해당 IKE 보호 메시지를 처리할 수 있습니다. 그러나 PSK 없이 변경된 교환에 결합된 올바른 AUTH를 새로 만들 수 없습니다. 다른 연결의 AUTH를 복사해도 초기 IKE_SA_INIT 메시지·상대 nonce·SK_pi/SK_pr로 처리된 ID의 지정된 SignedOctets가 검증자의 예상값과 다릅니다. 수신자는 받은 AUTH_A를 자신이 계산한 예상 AUTH_A와 비교합니다. AEAD tag의 유효성은 이 피어 AUTH를 대신하지 않습니다. AUTH 실패 시 연결을 거부하며 정상 ESP 데이터 SA와 사용자 데이터 전송을 승인하지 않습니다. M이 메시지를 바꾸지 않고 단순 전달하면 정상 알고리즘 가정 아래 A/B의 Z를 알지 못합니다.'+common+disclaimer,
      captions:[
        '<b>① 능동적 중간자.</b> PSK를 모르는 M이 공개값을 치환합니다. 하나의 A↔B 교환이 아니라 A↔M, M↔B 두 DH로 갈라집니다.',
        '<b>② M도 키를 압니다.</b> 왼쪽 Z_AM과 오른쪽 Z_MB는 서로 다릅니다. M은 두 IKE 키 그룹을 계산할 수 있으므로 “암호화됐으니 인증됐다”는 결론은 틀립니다.',
        '<b>③ 증명을 검증자로.</b> M은 복사한 AUTH를 다른 IKE 키로 보호해 전달할 수 있습니다. 그러나 PSK 없이는 바뀐 교환의 지정된 SignedOctets에 맞는 AUTH를 새로 만들 수 없습니다.',
        '<b>④ AUTH 검증 실패.</b> 받은 증명은 이 교환의 예상값과 다릅니다. 연결을 거부하고 ESP 데이터 SA·사용자 데이터 전송을 승인하지 않습니다.'
      ]},
    keys:{title:'같은 비밀? 다른 역할.',subtitle:'미리 있던 PSK와 이번 연결에서 만들어지는 키를 분리합니다.',steps:['사전 PSK','DH → Z','키 파생 · AUTH','ESP 승인'],starts:[0,1,4,9],fallback:'PSK는 AUTH 자격에만 사용합니다. 공개 DH 값 X/Y와 nonce를 교환한 후 A와 B는 자신의 비밀값으로 같은 Z를 로컬 계산합니다. Z와 nonce·문맥으로 PRF 기반 키 파생을 수행합니다. IKE 키 그룹은 SK_ei/SK_er(메시지 보호), SK_ai/SK_ar(별도 무결성; AEAD이면 길이 0), SK_pi/SK_pr(AUTH 신원 결합), SK_d(Child SA 파생)로 나뉩니다. SK_d와 Ni/Nr에서 별도 ESP 키 K_AB/K_BA와 방향별 salt를 파생합니다. 키 자체를 네트워크로 보내지 않습니다. 보호된 IKE_AUTH에서 PSK 기반 AUTH 검증과 첫 Child SA 협상이 성공해야 정책에 맞는 사용자 데이터를 ESP로 승인합니다. 같은 방향의 송신자와 수신자는 같은 대칭키를 쓰고 반대 방향은 별도 키와 SA를 씁니다.'+common+disclaimer,
      captions:[
        '<b>① 연결 전.</b> 관리자가 독립된 신뢰 경로로 같은 PSK를 양쪽에 설정합니다. PSK는 AUTH용 자격이며, DH 결과도 ESP 키도 아닙니다.',
        '<b>② 공개값만 이동.</b> X/Y와 nonce를 교환합니다. a/b는 로컬에 남고, 양쪽은 같은 DH 비밀 Z를 각자 계산합니다. 아직 피어 인증 전입니다.',
        '<b>③ 용도별 키.</b> Z에서 IKE 키 그룹을 로컬 파생합니다. 별도의 PSK는 이번 교환에 결합된 AUTH 증명을 만듭니다. 키가 있어도 데이터 연결은 아직 미승인입니다.',
        '<b>④ 인증과 협상 성공 후.</b> SK_d에서 별도 방향별 ESP 키를 파생합니다. 같은 방향의 송신·수신은 같은 키를 쓰며, 승인된 사용자 IP 패킷은 ESP로 보호합니다.'
      ]}
  };
  const cfg=configs[topic]||configs.keys;
  document.getElementById('title').textContent=cfg.title;document.getElementById('subtitle').textContent=cfg.subtitle;
  document.getElementById('fallback').textContent=cfg.fallback;
  document.getElementById('steps').innerHTML=cfg.steps.map((s,i)=>`<li><span>${i+1} · ${s}</span></li>`).join('');
  document.title='IPsec · '+cfg.title;
  let markup='';let draw;
  if(topic==='keys'||!configs[topic]) {
    markup=rect(18,16,644,72)+text(34,34,'PRE-PROVISIONED / NOT SESSION KEY MATERIAL','label strong')+
      text(36,66,'A','strong')+text(626,66,'B','strong')+badge('psk-a','PSK',90,'panel')+badge('psk-b','PSK',90,'panel')+text(257,65,'AUTH credential only','small strong')+
      text(34,111,'PUBLIC EXCHANGE','label strong')+line('M104 136H574','dashed',true)+line('M574 168H104','dashed',true)+
      text(34,138,'a stays','label')+text(590,168,'b stays','label')+badge('dh-x','X · Ni')+badge('dh-y','Y · Nr')+
      group('z-labels',text(34,220,'local DH','label')+text(599,220,'local DH','label'))+dot('z-a','Z')+dot('z-b','Z')+
      line('M108 229V246','v',true)+line('M572 229V246','v',true)+text(139,229,'PRF / KDF','label')+text(473,229,'PRF / KDF','label')+
      group('ike-a',rect(30,246,212,100,'violet')+text(46,264,'IKE KEY GROUP · A','label strong')+text(46,286,'SK_ei / SK_er','mono small')+text(46,306,'SK_pi / SK_pr','mono small')+text(46,326,'SK_ai / SK_ar  (AEAD: 0)','mono label'))+
      group('ike-b',rect(438,246,212,100,'violet')+text(454,264,'IKE KEY GROUP · B','label strong')+text(454,286,'SK_ei / SK_er','mono small')+text(454,306,'SK_pi / SK_pr','mono small')+text(454,326,'SK_ai / SK_ar  (AEAD: 0)','mono label'))+
      line('M152 88V104L264 224V298','dashed')+line('M528 88V104L416 224V298','dashed')+
      rect(270,266,140,100)+text(288,284,'IKE_AUTH','mono strong')+text(283,352,'AUTH + Child SA','label')+badge('auth-proof','AUTH',74)+
      group('auth-ok',rect(-41,-12,82,24,'teal',6)+text(-29,1,'✓ verified','small strong'))+
      line('M136 346V385','v',true)+line('M544 346V385','v',true)+text(157,368,'SK_d → KEYMAT','label')+text(439,368,'SK_d → KEYMAT','label')+
      group('child-a',rect(30,385,212,57,'violet')+text(44,426,'SA_AB · A → B','label'))+
      group('child-b',rect(438,385,212,57,'violet')+text(452,426,'SA_BA · B → A','label'))+
      group('key-ownership',text(44,453,'A: TX K_AB / RX K_BA','mono label')+text(452,453,'B: TX K_BA / RX K_AB','mono label'))+badge('skd-a','SK_d')+badge('skd-b','SK_d')+line('M68 474H611','t',true)+text(31,497,'USER IP → ESP','label strong')+text(496,497,'AUTH gates data','label')+badge('esp-data','ESP · IP',98,'teal')+
      group('gate-closed',line('M338 456V487','r')+line('M332 460L344 482','r')+text(284,450,'NOT APPROVED','label'));
    draw=t=>{
      at('psk-a',151,65);at('psk-b',529,65);
      travel('dh-x',t,1,2.6,[[116,136],[302,136],[492,136],[566,136]]);
      travel('dh-y',t,1.5,3.1,[[566,168],[378,168],[190,168],[114,168]]);
      const z=phase(t,3,3.6);reveal('z-labels',t,3);
      travel('z-a',t,3.4,4.2,[[108,189],[108,221]],z);travel('z-b',t,3.6,4.4,[[572,189],[572,221]],z);
      reveal('ike-a',t,4.1);reveal('ike-b',t,4.4);
      const k=phase(t,4.3,4.8);travel('skd-a',t,9.3,10.4,[[136,358],[136,402]],k);travel('skd-b',t,9.6,10.7,[[544,358],[544,402]],k);
      node('skd-a').querySelector('text').textContent=t>=10.4?'K_AB':'SK_d';node('skd-b').querySelector('text').textContent=t>=10.7?'K_BA':'SK_d';
      const proof=phase(t,6.2,6.7);travel('auth-proof',t,6.6,8.3,[[151,106],[239,192],[340,307]],proof);
      reveal('auth-ok',t,8.6,340,331);reveal('child-a',t,9.8);reveal('child-b',t,10.1);
      at('gate-closed',0,0,1-phase(t,8.8,9.2));reveal('key-ownership',t,10.7);
      travel('esp-data',t,10.9,12.1,[[119,473],[289,473],[459,473],[567,473]],phase(t,10.8,11.1));
    };
  }
  if(topic==='mitm') {
    markup=rect(30,20,140,77)+text(47,43,'A · initiator','strong')+text(47,73,'PSK provisioned','label')+
      rect(270,20,140,77,'warn')+text(287,43,'M · attacker','strong')+text(287,73,'NO PSK','small strong red-text')+
      rect(510,20,140,77)+text(527,43,'B · responder','strong')+text(527,73,'PSK provisioned','label')+
      group('naive-dh',line('M100 110H580','dashed',true))+
      group('dh-leg-am',rect(26,124,302,138,'violet')+text(43,142,'DH LEG 1 / A ↔ M','label strong')+line('M68 169H286','v',true)+line('M286 201H68','v',true)+text(44,246,'Z_AM · known to A and M','mono small'))+
      group('dh-leg-mb',rect(352,124,302,138,'violet')+text(369,142,'DH LEG 2 / M ↔ B','label strong')+line('M392 169H610','v',true)+line('M610 201H392','v',true)+text(370,246,'Z_MB · known to M and B','mono small'))+
      badge('am-x','X',54)+badge('am-m','M₁',54)+badge('mb-m','M₂',54)+badge('mb-y','Y',54)+
      line('M177 262V287','v',true)+line('M503 262V287','v',true)+
      group('m-keys',rect(26,282,302,69,'violet')+rect(352,282,302,69,'violet')+text(47,332,'IKE keys 1 · M knows','small strong')+text(373,332,'IKE keys 2 · M knows','small strong'))+
      badge('secret-am','Z_AM',98)+badge('secret-mb','Z_MB',98)+
      text(30,372,'IKE protection ≠ peer AUTH','small strong')+line('M126 443H531','v',true)+
      rect(452,381,202,73)+text(468,399,'B: expected AUTH_A','mono small')+text(468,421,'PSK + this exchange','label')+
      line('M580 97V112H662V416H654','dashed')+
      badge('mitm-proof','copied AUTH',133,'violet')+
      group('mitm-reject',rect(-48,-12,96,24,'warn',6)+text(-36,1,'× AUTH FAIL','small strong red-text'))+
      group('no-esp',rect(26,468,628,28,'warn',7)+text(46,482,'STOP · no approved ESP SA · no user data','small strong red-text'));
    draw=t=>{
      const split=phase(t,.7,1.7);at('naive-dh',0,0,1-split);
      at('dh-leg-am',28*(1-split),-18*(1-split),split);at('dh-leg-mb',-28*(1-split),-18*(1-split),split);
      travel('am-x',t,1.7,2.7,[[83,169],[184,169],[285,169]],split);
      travel('am-m',t,2,3,[[285,201],[184,201],[83,201]],split);
      travel('mb-m',t,2.2,3.2,[[402,169],[502,169],[602,169]],split);
      travel('mb-y',t,2.5,3.5,[[602,201],[502,201],[402,201]],split);
      reveal('m-keys',t,4.2);
      travel('secret-am',t,3.6,4.9,[[177,226],[177,306]],phase(t,3.6,4.1));
      travel('secret-mb',t,3.9,5.2,[[503,226],[503,306]],phase(t,3.9,4.4));
      if(t<8.9)travel('mitm-proof',t,6,8.8,[[104,443],[260,443],[413,443],[543,443]],phase(t,5.7,6.2));
      else travel('mitm-proof',t,8.9,9.6,[[543,443],[439,440],[346,415]],1);
      reveal('mitm-reject',t,8.9,544,439);reveal('no-esp',t,9.5);
    };
  }
  if(topic==='handshake') {
    markup=rect(35,17,178,43)+text(51,39,'A · initiator · PSK','strong')+rect(467,17,178,43)+text(483,39,'B · responder · PSK','strong')+
      line('M123 60V491','dashed')+line('M557 60V491','dashed')+
      text(29,81,'1 / IKE_SA_INIT · public, not authenticated','label strong')+
      line('M123 112H557','',true)+line('M557 151H123','',true)+badge('init-i','SAi1 · KEi · Ni',168,'panel')+badge('init-r','SAr1 · KEr · Nr',168,'panel')+
      group('local-keys',rect(35,181,210,58,'violet')+rect(435,181,210,58,'violet')+text(49,196,'A · local derivation','label')+text(449,196,'B · local derivation','label')+text(285,199,'PRF / KDF','small strong')+text(275,220,'no key on wire','label'))+
      badge('local-key-a','Z → IKE keys',168)+badge('local-key-b','Z → IKE keys',168)+
      text(29,256,'2 / IKE_AUTH · protected control · first Child SA','label strong')+
      line('M123 280H557','v',true)+line('M557 317H123','v',true)+
      badge('auth-i','SK{IDi, AUTH, SAi2, TS}',222)+badge('auth-r','SK{IDr, AUTH, SAr2, TS}',222)+
      group('auth-verified',rect(35,339,210,24,'teal',7)+text(49,351,'✓ A verifies B AUTH','small strong')+rect(435,339,210,24,'teal',7)+text(449,351,'✓ B verifies A AUTH','small strong'))+
      group('sa-ab',rect(35,380,286,48,'violet')+text(49,394,'SA_AB · SK_d → K_AB','mono small strong')+text(49,415,'A TX · B RX · separate SPI / seq','label'))+
      group('sa-ba',rect(359,380,286,48,'violet')+text(373,394,'SA_BA · SK_d → K_BA','mono small strong')+text(373,415,'B TX · A RX · separate SPI / seq','label'))+
      line('M123 450H557','t',true)+line('M557 485H123','t',true)+badge('esp-ab','ESP · user IP →',140,'teal')+badge('esp-ba','← ESP · reply IP',140,'teal');
    draw=t=>{
      travel('init-i',t,.5,1.6,[[214,112],[340,112],[466,112]],phase(t,.2,.7));
      travel('init-r',t,1.8,2.9,[[466,151],[340,151],[214,151]],phase(t,1.5,2));
      reveal('local-keys',t,3.2);
      travel('local-key-a',t,3,4.2,[[140,176],[140,216]],phase(t,3,3.5));
      travel('local-key-b',t,3.3,4.5,[[540,176],[540,216]],phase(t,3.3,3.8));
      travel('auth-i',t,5.2,6.3,[[245,280],[340,280],[435,280]],phase(t,5,5.5));
      travel('auth-r',t,6.4,7.5,[[435,317],[340,317],[245,317]],phase(t,6.2,6.7));
      reveal('auth-verified',t,7.7);reveal('sa-ab',t,8.2);reveal('sa-ba',t,8.3);
      travel('esp-ab',t,9.2,10.5,[[201,450],[340,450],[479,450]],phase(t,9,9.5));
      travel('esp-ba',t,10.7,12,[[479,485],[340,485],[201,485]],phase(t,10.5,11));
    };
  }
  svg.innerHTML=`<title id="svg-title">${cfg.title}</title><desc id="svg-desc">${cfg.fallback}</desc>${defs}${markup}`;
  let lastStep=-1;
  return t=>{
    if(draw)draw(t);
    let step=0;cfg.starts.forEach((start,i)=>{if(t>=start)step=i});
    if(step!==lastStep){
      document.getElementById('caption').innerHTML=cfg.captions[step];
      document.querySelectorAll('#steps li').forEach((el,i)=>{el.className=i<step?'done':i===step?'active':'';if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
      lastStep=step;
    }
  };
};
