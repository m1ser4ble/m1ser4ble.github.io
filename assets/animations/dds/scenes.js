'use strict';
window.ddsTopics=['guide','basics','discovery-addressing','qos','history-persistence','security','device-adapters','realtime-linux','fault-diagnosis','observability','gva-losa'];
window.ddsSceneInfo={
 guide:['질문에서 개념으로 이어지는 지도','기초 → 통신 조건 → 운영과 시스템 경계. 각 상자를 눌러 글을 엽니다.',['기초 모델','통신 조건','운영 판단','시스템 경계'],['Topic과 타입으로 관계를 먼저 이해합니다.','Discovery·QoS·history·security는 서로 다른 통신 조건입니다.','장애 진단과 관측을 연결해 증거와 상태 판단을 구분합니다.','장비 어댑터·Linux 시간·GVA/LOSA는 DDS 바깥의 계약까지 포함합니다.'],'허브에서 열 개 글로 연결합니다. 기초를 먼저 보고 Discovery와 QoS를 읽습니다. History와 Security로 범위를 나눈 뒤 장비, Linux, 장애 진단, 관측, GVA/LOSA로 확장합니다. 도식의 선은 추천 학습 연결이며 표준 의존 관계나 구현 증명이 아닙니다.'],
 basics:['타입이 있는 데이터, 여러 Reader','DDS 라이브러리는 각 프로세스 안에 있습니다. 필수 중앙 브로커는 없습니다.',['Writer · 계약','keyed instance','여러 Reader','앱의 해석'],['sensor_sim의 Writer가 Heading 타입의 Topic을 발행합니다.','sensor_id를 IDL key로 선언했다고 가정합니다. A/B는 독립 instance입니다.','같은 Topic·타입과 호환 QoS의 여러 Reader로 sample이 전달됩니다.','Reader마다 필요한 일을 합니다. 데이터 전달은 제어 명령의 실행 완료가 아닙니다.'],'sensor_sim, controller, viewer의 프로세스 안에 DDS 라이브러리가 있습니다. 예시에서는 Heading 타입의 sensor_id를 key로 선언해 A/B instance를 구분합니다. 단순 필드 이름만으로 key가 되는 것은 아닙니다. 하나의 Writer에서 여러 Reader로 전달하며 필수 브로커를 두지 않습니다.'],
 'discovery-addressing':['발견과 데이터 주소를 구분하기','Domain은 논리 범위, Topic은 데이터 계약, Locator는 실제 도달 주소입니다.',['Participant 발견','endpoint 정보','호환 조건','사용자 데이터'],['같은 Domain의 Participant가 발견 정보를 교환합니다. Domain은 인증 경계가 아닙니다.','Writer/Reader의 Topic·타입·QoS와 GUID·Locator 정보를 교환합니다.','이름·타입·QoS 조건을 맞춥니다. 다른 Topic은 연결되지 않습니다.','발견된 Locator로 사용자 데이터가 이동합니다. 실제 IP 경로·방화벽·NAT 설정도 필요합니다.'],'Domain ID는 논리적 발견 범위이며 IP subnet이나 인증을 대신하지 않습니다. RTPS metatraffic이 Participant와 endpoint 정보를 교환하고, Topic·타입·QoS가 맞는 Reader/Writer를 연결합니다. GUID는 정체성, Locator는 도달 주소입니다. Topic마다 전용 port가 생기는 모델이 아닙니다. Discovery Server는 선택 가능한 발견 구조이며 자동 데이터 브로커가 아닙니다.'],
 qos:['세 감시가 서로 다른 질문을 한다','sample 갱신 간격, Writer 생존, 이력 재전송을 별도 축으로 봅니다.',['정상 갱신','sample 손실','재전송 · Deadline','Liveliness'],['키 A의 갱신 sample이 기대 간격 안에 도착합니다.','sample 하나를 잃었다고 가정합니다. Reliable은 보유 history 안에서 재전송합니다.','뒤늦게 sample이 도착해도 설정한 Deadline 갱신 간격을 넘긴 사실은 남습니다.','Writer 생존 알림은 계속될 수 있습니다. 생존한다고 sensor 값이 유효한 것은 아닙니다.'],'가상의 간격으로 Deadline과 Liveliness를 비교합니다. Deadline은 instance별 갱신 간격 조건이고 Linux CPU 작업 마감이 아닙니다. Liveliness는 Writer 생존 감시이며 센서 유효성 검사가 아닙니다. Reliable 재전송은 history 한계 안에서 동작하며 end-to-end deadline이나 exactly once를 보장하지 않습니다.'],
 'history-persistence':['저장된 sample과 완료된 업무는 다르다','Writer memory → 선택적 persistence → Reader 상태 → 업무 기록을 분리합니다.',['Writer history','late Reader','Writer 재시작','업무 완료'],['Writer의 bounded history에 sample 41·42를 보관합니다.','호환 Durability 조건과 보유 이력이 있을 때 late Reader가 과거 sample을 받습니다.','프로세스 메모리는 사라집니다. 구성된 persistence가 있을 때만 DB에서 이력을 복원합니다.','Reader의 마지막 값과 업무 commit은 별도 기록입니다. sample 복원만으로 업무 완료가 되지 않습니다.'],'설명용 분기에서는 optional DB persistence를 구성했다고 가정합니다. 기본 memory history는 Writer 종료로 사라집니다. late joiner 제공은 Durability 호환과 보유 history에 의존합니다. Fast DDS 2.11.2에서는 TRANSIENT plugin 경로와 미구현 PERSISTENT enum을 구분해야 합니다. Reader의 마지막 통지 상태, Writer history 복원, 업무 완료 commit은 서로 다릅니다.'],
 security:['신원 · Topic 권한 · 보호 · 제어 권한','암호 보호를 통과한 데이터에도 앱의 현재 제어 권한 판단이 필요합니다.',['Participant 인증','Topic 접근통제','SIGN / ENCRYPT','현재 제어 권한'],['Participant의 자격과 신원을 검증합니다. Domain ID만으로 인증되지 않습니다.','읽기/쓰기 Topic 권한을 검사합니다. 권한이 없는 endpoint는 거부됩니다.','SIGN은 MAC 기반 무결성·출처 검증, ENCRYPT는 기밀성도 제공합니다. 실제 암호 연산을 실행하지 않습니다.','유효한 DDS 데이터라도 현재 운영 제어 권한은 앱에서 별도로 검사합니다.'],'설명용 게이트입니다. DDS Security의 participant 인증, Topic 접근통제, message 보호를 분리합니다. SIGN의 MAC은 위변조와 출처 검증을 위한 것이며 평문을 숨기지 않습니다. ENCRYPT는 AEAD 기반 기밀성과 인증을 함께 제공합니다. SHA-256 hash를 encryption으로 부르지 않습니다. DDS 권한과 현재 운용 제어권은 같지 않습니다.'],
 'device-adapters':['장비 byte에서 공통 sample로','장비별 I/O와 ICD 프레임 해석을 어댑터가 맡고, DDS에는 타입 계약을 전달합니다.',['장비 I/O','프레임 조립','검증 · 변환','타입 sample'],['TCP socket, UART TTY, SocketCAN은 서로 다른 입력 경로입니다.','TCP recv는 payload byte 조각을 반환합니다. 호출 경계는 메시지 경계가 아닙니다.','ICD 가정에 따라 길이·checksum·byte order·단위를 검증하고 변환합니다.','유효한 데이터만 공통 Heading sample로 발행합니다. 장비가 자동 DDS native가 되지는 않습니다.'],'가상 장비 ICD를 가정한 설명용 변환입니다. TCP byte stream은 여러 recv 결과를 프레임 버퍼에 조립해야 하며 TCP header를 받는 그림이 아닙니다. UART TTY와 SocketCAN은 별도 API입니다. RS-422는 전기적 규격입니다. poll은 readiness 대기이며 busy-wait와 동일하지 않습니다. 실제 CAN/RS-422 장비를 시험한 결과가 아닙니다.'],
 'realtime-linux':['주기 release와 실제 실행을 분리하기','앱 timer → runnable → CPU 실행 → DDS 갱신까지 시간을 각각 봅니다.',['앱 timer release','CPU 대기','태스크 실행','DDS 갱신 관측'],['앱 timer가 주기 작업을 release합니다. scheduler가 callback 주기를 만드는 것은 아닙니다.','release 직후 다른 작업 때문에 CPU를 기다리는 예시입니다.','Linux thread scheduling policy가 실행 순서를 결정합니다. 높은 우선순위만으로 hard RT가 보장되지는 않습니다.','실행 뒤 sample을 발행합니다. DDS Deadline은 관측된 갱신 간격이며 CPU task deadline과 다른 조건입니다.'],'가상의 scheduler timeline입니다. 측정된 Linux 지연이나 우선순위 성능이 아닙니다. Scheduling policy는 thread별이며 주기 release는 앱 timer가 담당합니다. SCHED_DEADLINE의 runtime/deadline/period 계약은 주기 callback API가 아닙니다. DDS Deadline과 CPU 태스크 마감, 통신 지연, sensor 유효성을 분리해야 합니다.'],
 'fault-diagnosis':['마지막 유효 수신으로 상태를 판단하기','UNKNOWN → HEALTHY → STALE → RECOVERING → HEALTHY의 설명용 상태 모형입니다.',['첫 유효 sample','500 ms timeout','복구 1 · 2회','복구 3회'],['첫 유효 sample이 도착하면 HEALTHY가 됩니다.','마지막 유효 수신 뒤 500 ms가 지나면 STALE입니다. 값은 남아도 value_usable=false입니다.','유효하고 fresh한 sample을 다시 받아 RECOVERING으로 들어갑니다. 두 번만으로 복구를 확정하지 않습니다.','연속 fresh valid sample 세 번을 확인하면 HEALTHY로 돌아갑니다. 세션과 순번도 검사해야 합니다.'],'로컬 학습 프로젝트의 상태 규칙을 설명용 시간축으로 재구성합니다. 마지막 유효 수신 500 ms timeout, 복구 fresh valid 세 번, stale/recovering 때 latest heading 유지와 value_usable=false를 표현합니다. 실제 장비 반응이나 오늘 재실행 결과가 아닙니다. session·sample_seq 검증으로 재시작과 순서 이상을 구분해야 합니다.'],
 observability:['지표 · 로그 · trace가 서로 다른 증거','DDS Statistics와 앱 계측을 함께 읽되 collector만으로 trace가 생기지는 않습니다.',['DDS Statistics','앱 로그 · metric','수동 trace','원인 대조'],['DDS 통계는 전송·연결 측면의 관측 자료를 제공합니다. 센서 의미를 자동 해석하지 않습니다.','앱은 session·seq·상태 전이와 last valid age를 기록합니다.','C++ 앱에서 수동 OpenTelemetry span을 연결할 수 있습니다. Fast DDS 자동 trace를 가정하지 않습니다.','DDS 경로, 앱 처리, 값 유효성의 시간을 비교합니다. 지표 하나만으로 원인을 단정하지 않습니다.'],'설명용 관측 배관입니다. DDS Statistics, 앱 로그/metric, 수동 OTel trace는 서로 다른 자료입니다. Fast DDS의 기본 OTLP/자동 trace를 확인했다는 주장이 아닙니다. Statistics backend의 Prometheus 사례와 별도 제품의 OTLP collector를 Fast DDS의 내장 기능으로 합치지 않습니다. 로컬 프로젝트의 OTel 실행 검증도 아닙니다.'],
 'gva-losa':['상위 아키텍처에서 DDS 전송까지','LOSA, GVA/NGVA, 데이터 모델, DDS, 장비 인터페이스는 같은 층이 아닙니다.',['상위 LOSA','규격별 구조','공통 데이터 모델','DDS · 어댑터'],['LOSA는 더 넓은 상위 구조입니다. LDM과 GVA/GSA/GBA 등 관계를 함께 봅니다.','UK GVA 23-009와 NATO NGVA STANAG 4754는 구분해야 하는 규격입니다.','공통 데이터 모델은 센서·상태의 의미와 계약을 정합니다. DDS만 선택해서 이 계약이 생기지는 않습니다.','DDS는 typed data 교환을 맡고 어댑터는 장비 경계를 연결합니다. 이 그림은 적합성 인증이 아닙니다.'],'아키텍처 관계를 단순화한 설명용 도식입니다. LOSA의 상위 범위와 LDM, GVA/GSA/GBA를 구분하고 UK GVA 23-009와 NATO NGVA 4754를 동일 규격으로 부르지 않습니다. 데이터 모델, middleware, 장비 ICD와 검증이 함께 필요합니다. 로컬 DDS 학습 프로젝트의 GVA/NGVA/LOSA 준수나 인증을 주장하지 않습니다.']
};
window.createDdsScene=function(requested){
 const topic=window.ddsTopics.includes(requested)?requested:'guide', info=window.ddsSceneInfo[topic];
 const [title,subtitle,steps,captions,fallback]=info;
 const el=id=>document.getElementById(id);
 const text=(x,y,s,cls='')=>`<text x="${x}" y="${y}" class="${cls}">${s}</text>`;
 const rect=(x,y,w,h,cls='panel')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`;
 const group=(id,s)=>`<g id="${id}">${s}</g>`;
 const line=(d,cls='')=>`<path d="${d}" class="wire ${cls}" marker-end="url(#arrow)"/>`;
 const card=(x,y,w,title,a,b='',cls='panel')=>rect(x,y,w,b?86:68,cls)+text(x+14,y+21,title,'strong')+text(x+14,y+45,a,'small')+(b?text(x+14,y+67,b,'small'):'');
 const badge=(id,label,w=100,cls='violet')=>group(id,rect(-w/2,-15,w,30,cls)+`<text id="${id}-label" x="${-w/2+10}" y="1" class="small strong">${label}</text>`);
 const staged=(id,content)=>group(id,content);
 const defs='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#777080"/></marker></defs>';
 let markup='', points=[], payloadLabel='', resolution='', stages=[];
 const add=(id,start,content)=>{markup+=staged(id,content);stages.push([id,start]);};
 if(topic==='guide'){
   markup=card(248,15,184,'DDS 학습 허브','개념을 따라 이동','상자 클릭 → 해당 글','violet');
   const order=['basics','discovery-addressing','qos','history-persistence','security','fault-diagnosis','observability','device-adapters','realtime-linux','gva-losa'];
   const labels=['기초 · Topic / 타입','Discovery · 주소','QoS · 시간 / 신뢰','History · 저장 범위','Security · 신뢰 경계','장애 진단 · 상태 판단','Observability · 증거','장비 어댑터 · ICD','Linux · 실행 시간','GVA / LOSA · 구조'];
   order.forEach((slug,i)=>{const x=i%2?370:40,y=132+Math.floor(i/2)*57;markup+=line(`M340 100V${y+22}H${x+(i%2?0:270)}`,'dashed');add('map-'+i,Math.floor(i/3)*3,`<a href="../../../dds/${slug}/" target="_top">${rect(x,y,270,45,i<3?'violet':'panel')+text(x+14,y+23,labels[i],'strong')}</a>`);});
   points=[[340,112],[340,154],[340,211],[340,268],[340,325],[340,382]];payloadLabel='읽기';resolution='학습 순서의 제안 · 표준 의존성이나 준수 증명이 아님';
 }else if(topic==='basics'){
   markup=card(28,62,180,'sensor_sim','Writer · in process','Heading Topic','violet')+card(468,42,180,'controller','Reader · in process','상태 판단','teal')+card(468,165,180,'status_viewer','Reader · in process','화면 표시','teal')+line('M208 148V165H385V145H550')+line('M385 165V270H550')+text(258,58,'Topic + 타입 + 호환 QoS','small strong');
   add('instances',3,card(28,250,282,'IDL key 선언을 가정','sensor_id=A → instance A','sensor_id=B → instance B'));
   add('fanout',6,badge('payload-b','A: seq 7',105,'teal'));
   add('meaning',9,card(368,292,280,'앱에서 판단','수신 ≠ 제어 실행 완료','필수 중앙 브로커 없음'));
   points=[[220,165],[316,165],[385,165],[420,145],[550,145]];payloadLabel='A: seq 7';resolution='하나의 계약 · 두 Reader · 서로 다른 앱 책임';
 }else if(topic==='discovery-addressing'){
   markup=rect(22,26,636,283)+text(40,47,'논리 Domain 7 · 인증/서브넷 경계가 아님','strong')+card(40,78,220,'Participant A','Writer: Heading / Type H','GUID A · UDP Locator A','violet')+card(420,78,220,'Participant B','Reader: Heading / Type H','GUID B · UDP Locator B','teal')+line('M260 95H420','dashed')+text(284,73,'발견 정보','small');
   add('match',3,card(237,195,207,'endpoint 조건','Topic · 타입 · QoS 일치','실제 IP 경로도 필요'));
   add('unmatched',6,card(420,331,220,'Reader C: Temperature','다른 Topic → 연결 안 됨','','warn'));
   add('userdata',9,line('M150 165V320H585V165','t')+text(240,292,'RTPS 사용자 데이터 · 발견과 별도','small strong'));
   points=[[275,177],[340,177],[405,177],[585,177],[585,320],[150,320]];payloadLabel='정보 / sample';resolution='GUID는 정체성 · Locator는 도달 주소 · Topic별 port 아님';
 }else if(topic==='qos'){
   markup=text(30,34,'가상 시간축 · 키 A의 갱신 간격','heading')+line('M100 98H640')+line('M100 206H640')+line('M100 320H640')+text(24,98,'sample','small strong')+text(20,206,'Deadline','small strong')+text(20,320,'Liveliness','small strong');
   for(let i=0;i<6;i++){const x=116+i*95;markup+=text(x,68,`${i*100} ms`,'label')+`<path d="M${x} 88V108" class="wire"/>`;}
   markup+=badge('lost','× 유실',82,'warn');
   add('retransmit',3,line('M306 126Q365 169 425 126','v')+text(310,157,'보유 history → 재전송','small'));
   add('deadline-miss',6,rect(286,185,166,43,'warn')+text(301,207,'갱신 간격 초과 · miss','small strong'));
   add('stillalive',9,rect(112,298,510,43,'teal')+text(130,320,'Writer는 생존 중 · 센서 데이터 유효성과 별개','strong'));
   points=[[146,98],[211,98],[306,98],[425,126],[496,98],[591,98]];payloadLabel='seq 3';resolution='Reliable ≠ 마감 보장 · Deadline ≠ Liveliness';
 }else if(topic==='history-persistence'){
   markup=card(30,50,240,'Writer memory','bounded history: [41, 42]','프로세스 종료 → 소멸','violet')+card(410,50,240,'late Reader','호환 Durability + 이력','마지막 수신 값','teal')+line('M270 94H410')+card(30,240,240,'선택적 persistence DB','구성과 지원 판본 필요','2.11.2 TRANSIENT plugin')+line('M150 136V240','dashed');
   add('latejoin',3,text(299,72,'과거 sample','small strong'));
   add('restart-writer',6,line('M270 278H326V165H150','v')+text(280,303,'재시작 시 복원','small'));
   add('commit',9,card(410,260,240,'별도 업무 commit','Reader 상태 ≠ 완료 기록','업무 ID / 완료 조건','warn'));
   points=[[150,165],[330,165],[530,165],[330,165],[330,355],[150,355],[330,355],[330,180],[150,180]];payloadLabel='sample 42';resolution='memory 보관 · DB 복원 · Reader 값 · 업무 commit은 별도';
 }else if(topic==='security'){
   markup=text(26,35,'세 보안 게이트와 마지막 앱 게이트','heading')+line('M40 159H639');
   markup+=card(28,73,190,'① 신원 인증','Participant 자격','Domain ID로 대체 불가','violet');
   add('permissions',3,card(248,73,190,'② Topic 권한','write/read 허용 여부','거부 endpoint 차단'));
   add('protection',6,card(468,73,190,'③ message 보호','SIGN: MAC 검증','ENCRYPT: 기밀성도','teal'));
   add('operation',9,card(364,278,294,'④ 앱의 현재 제어 권한','이번 명령을 실행할 주체인가?','DDS Topic 권한과 별도','warn')+line('M561 159V278'));
   add('security-legend',6,text(30,282,'SIGN: 평문 + MAC','strong')+text(30,314,'ENCRYPT: 보호된 내용 + tag','strong')+text(30,351,'실제 암호 연산은 실행하지 않음','small'));
   points=[[48,180],[170,180],[280,180],[420,180],[560,180],[560,258]];payloadLabel='데이터';resolution='인증 → 접근통제 → 보호 → 별도 운영 제어권 판단';
 }else if(topic==='device-adapters'){
   markup=card(24,38,186,'TCP socket','byte stream','','violet')+card(24,142,186,'UART · TTY','RS-422 전기 규격')+card(24,246,186,'SocketCAN','CAN 프레임 API')+card(260,88,174,'프레임 버퍼','ICD: 길이 / 경계','TCP 조각 조립')+line('M210 73H235V115H260')+line('M210 177H235V130H260')+line('M210 281H235V145H260');
   add('bytes',3,badge('chunk-a','recv: [길이 · A]',130)+badge('chunk-b','recv: [B · 검사]',130));
   add('validate',6,card(476,88,180,'검증 · 변환','checksum · 단위','byte order','teal')+line('M434 130H476'));
   add('typed',9,card(405,292,250,'DDS Heading sample','sensor_id · heading · valid','장비는 자동 DDS native 아님','teal')+line('M566 174V292'));
   points=[[126,124],[229,124],[229,192],[347,192],[566,192],[566,240],[530,275]];payloadLabel='payload';resolution='I/O → 프레임 조립 → 검증/변환 → 공통 타입 계약';
 }else if(topic==='realtime-linux'){
   markup=text(24,34,'가상 CPU / 앱 시간축 · 측정 결과 아님','heading')+line('M105 100H650')+line('M105 205H650')+line('M105 313H650')+text(24,100,'timer','small strong')+text(24,205,'CPU','small strong')+text(24,313,'DDS','small strong');
   for(let i=0;i<4;i++){const x=135+i*145;markup+=`<path d="M${x} 77V119" class="wire v"/>`+text(x-20,58,'release','label');}
   markup+=rect(120,185,166,40,'warn')+text(138,205,'다른 태스크 실행','small strong');
   add('cpu-wait',3,line('M135 120V163H286','dashed')+text(146,135,'runnable · 대기','small'));
   add('cpu-run',6,rect(288,185,160,40,'teal')+text(302,205,'센서 태스크 실행','small strong'));
   add('publish',9,line('M448 226V313H625','t')+text(343,365,'release 지연 + 실행 시간 + 전달 지연','strong'));
   points=[[135,100],[135,163],[288,163],[510,163],[510,246],[448,246],[448,313],[605,313]];payloadLabel='주기 작업';resolution='앱 timer의 release · thread 실행 · DDS 갱신은 다른 시간';
 }else if(topic==='fault-diagnosis'){
   const names=['UNKNOWN','HEALTHY','STALE','RECOVERING'];
   names.forEach((name,i)=>{const x=22+i*165;markup+=group('state-'+i,card(x,72,146,name,i===0?'아직 유효 값 없음':i===1?'usable = true':'usable = false','',i===1?'teal':i===2?'warn':'panel'));if(i<3)markup+=line(`M${x+146} 153H${x+164}`);});
   markup+=line('M587 142V239H255V142','t')+text(282,276,'fresh valid 연속 3회 → HEALTHY','strong');
   add('timeout',3,text(225,190,'마지막 유효 수신 후 500 ms','small strong'));
   add('retained',6,card(34,300,290,'마지막 heading은 보관','stale / recovering: 사용 불가','복구 count: 1 → 2 → 3','warn'));
   add('session',9,card(365,300,290,'fresh valid를 확인','session + sample_seq 검사','재시작 / 중복 / 역순 분리'));
   points=[[95,158],[255,158],[420,158],[585,158],[585,239],[422,239],[255,239]];payloadLabel='valid sample';resolution='값 보관과 사용 가능성을 분리 · 3회 검증 뒤 복구';
 }else if(topic==='observability'){
   markup=card(22,42,192,'DDS Statistics','연결 / 전송 지표','sensor 의미는 별도','violet')+card(244,42,192,'앱 log · metric','session · seq · age','상태 전이 기록')+card(466,42,192,'수동 OTel span','처리 단계 문맥','자동 trace 가정 금지','teal');
   add('stats-backend',3,card(22,204,192,'Statistics backend','예: Prometheus 경로','DDS 자료를 수집')+line('M118 128V204'));
   add('app-instrument',6,line('M340 128V282H470')+line('M562 128V282H470')+card(400,296,258,'앱 계측 수집 경로','log / metric / trace 구분','OTel 실행 검증 아님'));
   add('correlate',9,card(22,336,338,'시간과 식별자를 대조','전송 지연? 앱 지연? 유효성 실패?','지표 하나로 원인 단정 금지','teal'));
   points=[[118,140],[118,183],[340,169],[340,282],[470,282],[258,321]];payloadLabel='관측 자료';resolution='DDS 지표 + 앱 문맥 + 수동 trace → 원인 후보 비교';
 }else{
   markup=card(40,27,600,'LOSA · 상위 아키텍처','LDM과 GVA / GSA / GBA 등 더 넓은 구조','DDS만의 구조가 아님','violet');
   add('standards',3,card(40,148,280,'UK GVA','Def Stan 23-009','규격별 범위 확인')+card(360,148,280,'NATO NGVA','STANAG 4754','GVA와 동일 규격 아님')+line('M190 113V148')+line('M500 113V148'));
   add('model',6,card(146,266,388,'공통 데이터 모델 / 계약','센서·상태의 의미 · 타입 · 상호운용 조건','','teal')+line('M190 234V252H340V266')+line('M500 234V252H340'));
   add('transport',9,card(40,358,280,'DDS typed data 교환','middleware 책임')+card(360,358,280,'장비 어댑터 · ICD','TCP / UART / CAN 경계')+line('M280 334V358')+line('M400 334V358'));
   points=[[340,130],[190,130],[340,130],[340,250],[590,250],[590,346],[190,346]];payloadLabel='계약';resolution='공통 의미 + 전송 + 장비 경계 + 별도 적합성 검증';
 }
 markup+=group('resolution',rect(22,441,636,30,'teal')+text(36,457,resolution,'small strong'))+badge('payload',payloadLabel,topic==='guide'||topic==='gva-losa'?52:topic==='device-adapters'?84:topic==='discovery-addressing'?125:110);
 el('scene').setAttribute('data-state','');
 el('scene').innerHTML=defs+`<title id="svg-title">${title}</title><desc id="svg-desc">${fallback} 설명용 도식입니다.</desc>`+markup;
 el('title').textContent=title;el('subtitle').textContent=subtitle;el('fallback').textContent=fallback+' 모든 움직임과 시간은 설명용 모형이며 실제 네트워크·암호·운영체제 측정이나 적합성 검증이 아닙니다.';
 el('steps').innerHTML=steps.map((s,i)=>`<li>${i+1} · ${s}</li>`).join('');document.title='DDS · '+title;
 const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 const at=(id,x,y,opacity=1)=>{const n=el(id);n.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);n.style.opacity=opacity;};
 return time=>{
   const t=Math.max(0,Math.min(14,time));
   for(const [id,start] of stages){el(id).style.opacity=t>=start?1:0;el(id).style.visibility=t>=start?'visible':'hidden';}
   const progress=clamp(t/11)*(points.length-1),index=Math.min(points.length-2,Math.floor(progress)),a=points[index],b=points[index+1],q=ease(progress-index);
   at('payload',a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q);
   if(topic==='basics')at('payload-b',385+165*ease((t-6)/2),270);
   if(topic==='qos')at('lost',306,98,t>=3&&t<6?1:0);
   if(topic==='device-adapters'){at('chunk-a',339,230);at('chunk-b',339,270);}
   el('resolution').style.opacity=t>=11?1:0;
   const stage=Math.min(3,Math.floor(t/3));
   el('steps').querySelectorAll('li').forEach((li,i)=>li.className=i===stage?'active':i<stage?'done':'');
   let note=steps[stage];
   if(topic==='fault-diagnosis'){
     const state=t<1?'UNKNOWN':t<3?'HEALTHY':t<6?'STALE':t<10?'RECOVERING':'HEALTHY';
     const count=t<6?0:t<8?1:t<10?2:3;
     el('scene').setAttribute('data-state',state);
     ['UNKNOWN','HEALTHY','STALE','RECOVERING'].forEach((name,i)=>el('state-'+i).setAttribute('class',state===name?'state-active':''));
     el('payload-label').textContent=count?`복구 ${count}/3`:'valid sample';
     note=`현재 ${state} · value_usable=${state==='HEALTHY'} · 복구 확인 ${count}/3`;
   }
   if(el('stage-note').textContent!==note)el('stage-note').textContent=note;
   const caption=captions[stage]+' 설명용 도식: 실제 측정·패킷 캡처·암호 연산·적합성 검증이 아닙니다.';
   if(el('caption').textContent!==caption)el('caption').textContent=caption;
 };
};
