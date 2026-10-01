import {Circle, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, useThread, waitFor} from '@motion-canvas/core';

const C = {bg:'#090f1d', panel:'#121e32', border:'#29415f', text:'#eaf2ff', muted:'#9bb0cc', public:'#f3bd65', ike:'#72bcff', secure:'#56e3ba'};
const font = '"Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export default makeScene2D(function* (view) {
  const title=createRef<Txt>(), detail=createRef<Txt>(), formula=createRef<Txt>();
  const leftState=createRef<Txt>(), rightState=createRef<Txt>(), observer=createRef<Txt>();
  const status=createRef<Txt>(), packet=createRef<Rect>(), packetText=createRef<Txt>();
  const leftBox=createRef<Rect>(), rightBox=createRef<Rect>(), tunnel=createRef<Line>();
  const esp=createRef<Rect>(), encrypted=createRef<Rect>();
  const dots:Circle[]=[];
  view.fill(C.bg);
  view.add(<>
    <Txt text="IPsec / IKEv2" x={-550} y={-333} fontFamily={font} fontSize={19} fill={C.muted}/>
    <Txt ref={status} text="PSK 인증 · ESP 터널 모드 · 개념 애니메이션" x={240} y={-333} fontFamily={font} fontSize={18} fill={C.muted}/>
    <Txt ref={title} text="00  먼저 안전한 통신의 규칙을 정한다" y={-287} fontFamily={font} fontSize={33} fontWeight={700} fill={C.text}/>
    {Array.from({length:9},(_,i)=><Circle ref={node=>dots[i]=node} x={-510+i*127.5} y={-238} size={12} fill={C.border}/>)}
    <Rect ref={leftBox} x={-465} y={-34} width={280} height={316} radius={24} fill={C.panel} stroke={C.border} lineWidth={2}>
      <Txt text="A / Initiator" y={-112} fontFamily={font} fontSize={27} fontWeight={700} fill={C.text}/>
      <Line points={[[-108,-78],[108,-78]]} stroke={C.border} lineWidth={1}/>
      <Txt ref={leftState} text={'접속 시작\n\n인증 정보: PSK\n비밀값은 로컬 보관'} y={13} fontFamily={font} fontSize={22} lineHeight={35} fill={C.muted} textAlign="center"/>
    </Rect>
    <Rect ref={rightBox} x={465} y={-34} width={280} height={316} radius={24} fill={C.panel} stroke={C.border} lineWidth={2}>
      <Txt text="B / Responder" y={-112} fontFamily={font} fontSize={27} fontWeight={700} fill={C.text}/>
      <Line points={[[-108,-78],[108,-78]]} stroke={C.border} lineWidth={1}/>
      <Txt ref={rightState} text={'연결 요청 대기\n\n인증 정보: PSK\n비밀값은 로컬 보관'} y={13} fontFamily={font} fontSize={22} lineHeight={35} fill={C.muted} textAlign="center"/>
    </Rect>
    <Txt ref={observer} text="공개 인터넷 / 아직 보호되지 않음" y={-169} fontFamily={font} fontSize={20} fill={C.public}/>
    <Line ref={tunnel} points={[[-312,-21],[312,-21]]} endArrow arrowSize={13} stroke={C.border} lineWidth={3}/>
    <Txt text="네트워크로 보내는 값" y={88} fontFamily={font} fontSize={18} fill={C.muted}/>
    <Rect ref={packet} x={0} y={-23} width={560} height={94} radius={14} fill={C.panel} stroke={C.public} lineWidth={2} opacity={0}>
      <Txt ref={packetText} text="" fontFamily={font} fontSize={22} lineHeight={30} fill={C.public} textAlign="center"/>
    </Rect>
    <Rect ref={esp} y={55} width={618} height={156} radius={14} fill={C.panel} stroke={C.secure} lineWidth={2} opacity={0}>
      <Txt text="보이는 부분" x={-171} y={-43} fontFamily={font} fontSize={16} fill={C.muted}/>
      <Txt text={'Outer IP\nSPI · Seq · IV'} x={-171} y={10} fontFamily={font} fontSize={21} fill={C.text} lineHeight={31}/>
      <Rect ref={encrypted} x={39} y={0} width={220} height={116} fill="#163f3a" radius={9}>
        <Txt text={'암호화 영역\nInner IP + Data\nESP trailer'} fontFamily={font} fontSize={19} lineHeight={28} textAlign="center" fill={C.secure}/>
      </Rect>
      <Txt text={'인증\n태그'} x={232} y={0} fontFamily={font} fontSize={20} fill={C.secure}/>
    </Rect>
    <Rect y={250} width={1168} height={154} radius={18} fill={C.panel}>
      <Txt ref={detail} text={'IKE는 인증과 키 협상, ESP는 실제 데이터 보호를 담당한다.\n지금부터 제어 채널과 데이터 채널을 나누어 연결한다.'} y={-25} fontFamily={font} fontSize={24} lineHeight={34} fill={C.text} textAlign="center"/>
      <Txt ref={formula} text="IKE SA  ≠  ESP용 IPsec SA" y={43} fontFamily={font} fontSize={21} fill={C.ike}/>
    </Rect>
    <Txt text="시간·색·키 표시는 설명용입니다. 실제 패킷 전송이나 암호 연산은 실행하지 않습니다." y={345} fontFamily={font} fontSize={14} fill={C.muted}/>
  </>);

  function* phase(index:number,heading:string,body:string,code:string,color:string,action:()=>Generator<any,void,any>) {
    const start=useThread().time();
    title().text(`${String(index).padStart(2,'0')}  ${heading}`);
    detail().text(body); formula().text(code); formula().fill(color);
    dots.forEach((dot,i)=>dot.fill(i<=index?color:C.border));
    yield* action();
    yield* waitFor(Math.max(0,8-(useThread().time()-start)));
  }
  function* send(text:string,direction:number,color:string) {
    packetText().text(text);packetText().fill(color);packet().stroke(color);
    packet().position.x(-direction*25); packet().opacity(1);
    tunnel().opacity(1);
    tunnel().points(direction===1?[[-312,-21],[312,-21]]:[[312,-21],[-312,-21]]);
    tunnel().stroke(color);
    yield* packet().position.x(direction*25,1.5,easeInOutCubic);
    yield* waitFor(1.4);
    yield* packet().opacity(0,0.35);
  }
  function* pulse(color:string) {
    yield* all(leftBox().stroke(color,0.35),rightBox().stroke(color,0.35));
  }

  yield* phase(0,'IKE로 키를 준비하고, ESP로 데이터를 보호한다',
    'IKE는 인증과 키 협상, ESP는 실제 데이터 보호를 담당한다.\n먼저 IKE SA, 이어서 ESP용 CHILD SA를 준비한다.',
    'IKE SA = 제어 채널  /  CHILD SA = 데이터 보호용 SA 쌍',C.ike,function*(){
      yield* all(leftBox().opacity(0.4).opacity(1,0.6),rightBox().opacity(0.4).opacity(1,0.6));
    });

  yield* phase(1,'A → B : IKE_SA_INIT 요청',
    'A는 지원 알고리즘, DH 공개값, 새 난수 Ni를 보낸다.\n공개값은 보여도 된다. DH 개인값 a와 PSK는 보내지 않는다.',
    'SAi1 = IKE 알고리즘 제안  /  KEi = DH 공개값  /  Ni = nonce',C.public,function*(){
      leftState().text('개인값 a : 비공개\n공개값 KEi\n난수 Ni\nPSK : 비공개');
      observer().text('평문 교환 · 상대의 신원은 아직 미확인');
      yield* send('IKE_SA_INIT 요청\nHDR · SAi1 · KEi · Ni',1,C.public);
      rightState().text('제안 수신\n알고리즘 선택\nDH 공개값 확인\nNi 수신');
    });

  yield* phase(2,'B → A : IKE_SA_INIT 응답',
    'B는 선택한 IKE 알고리즘, DH 공개값, 난수 Nr로 응답한다.\n서로의 공개값과 난수가 양쪽에 모인다.',
    'SAr1 = 선택한 IKE 알고리즘  /  KEr = DH 공개값  /  Nr = nonce',C.public,function*(){
      rightState().text('개인값 b : 비공개\n공개값 KEr\n난수 Nr\nPSK : 비공개');
      yield* send('IKE_SA_INIT 응답\nHDR · SAr1 · KEr · Nr',-1,C.public);
      leftState().text('개인값 a : 비공개\nKEi · KEr\nNi · Nr\nPSK : 비공개');
    });

  yield* phase(3,'같은 DH 비밀에서 IKE용 키를 각각 파생한다',
    '정상 교환에서는 양쪽이 같은 DH 공유 비밀을 계산한다.\n키 자체를 전송하지 않는다. 아직 상대 인증은 남아 있다.',
    'SKEYSEED = prf(Ni | Nr, g^ir)  →  SK_d · SK_ei/er · SK_ai/ar · SK_pi/pr',C.ike,function*(){
      yield* pulse(C.ike);
      leftState().text('DH 공유 비밀\n↓ KDF\nIKE용 키 생성\n상대 인증: 대기');
      rightState().text('DH 공유 비밀\n↓ KDF\nIKE용 키 생성\n상대 인증: 대기');
      observer().text('다음 교환부터 암호화 · 인증은 아직 완료 전');
      tunnel().opacity(0.25);
      packet().position.x(0);packet().stroke(C.ike);packetText().fill(C.ike);
      packetText().text('양쪽에서 로컬 계산\n키를 네트워크로 보내지 않는다');packet().opacity(1);
      yield* waitFor(2);
      packet().opacity(0);
    });

  yield* phase(4,'A → B : 암호화된 IKE_AUTH 요청',
    'A는 PSK 기반 AUTH로 신원과 앞선 교환 내용을 증명한다.\n동시에 ESP 알고리즘과 보호할 트래픽 범위를 제안한다.',
    'SK{…} = IKE 키로 암호화·무결성 보호  /  SAi2 · TSi · TSr = CHILD SA 제안',C.ike,function*(){
      observer().text('외부 IKE 헤더는 보임 · 내부 인증 내용은 보호됨');
      yield* send('IKE_AUTH 요청\nHDR · SK{IDi, AUTH, SAi2, TSi, TSr}',1,C.ike);
      rightState().text('A의 AUTH 검증\nPSK와 교환값 확인\nESP 제안 확인\n트래픽 범위 확인');
      yield* rightBox().stroke(C.secure,0.4);
    });

  yield* phase(5,'B → A : IKE_AUTH 응답과 상호 인증',
    'B도 AUTH를 보내고 ESP 알고리즘과 트래픽 범위를 확정한다.\nA가 검증에 성공하면 상호 인증과 첫 CHILD SA 수립이 완료된다.',
    '인증 실패 → 연결 중단  /  성공 → IKE SA + 첫 ESP SA 쌍',C.secure,function*(){
      yield* send('IKE_AUTH 응답\nHDR · SK{IDr, AUTH, SAr2, TSi, TSr}',-1,C.ike);
      yield* pulse(C.secure);
      leftState().text('B의 AUTH 검증 OK\n상호 인증 완료\nESP 설정 합의\n트래픽 범위 확정');
      rightState().text('A의 AUTH 검증 OK\n상호 인증 완료\nESP 설정 합의\n트래픽 범위 확정');
      observer().text('인증된 제어 채널 · 데이터 보호 설정 완료');
    });

  yield* phase(6,'ESP는 방향마다 다른 키와 SPI를 사용한다',
    'SK_d와 초기 교환의 난수에서 첫 CHILD SA 키 재료를 파생한다.\nA→B와 B→A는 별도 SA다. IKE 암호화 키를 그대로 쓰지 않는다.',
    '첫 CHILD SA: KEYMAT = prf+(SK_d, Ni | Nr)',C.secure,function*(){
      leftState().text('송신 A→B : K_AB\n수신 B→A : K_BA\n각 방향의 SPI\nIKE 키와 분리');
      rightState().text('수신 A→B : K_AB\n송신 B→A : K_BA\n각 방향의 SPI\nIKE 키와 분리');
      tunnel().opacity(0.25);
      packet().position.x(0);packet().stroke(C.secure);packetText().fill(C.secure);
      packetText().text('각자 방향별 ESP SA 설치\nK_AB ≠ K_BA');packet().opacity(1);
      yield* waitFor(2);
      packet().opacity(0);
      status().text('PSK 인증 완료 · ESP AES-GCM 예시');
    });

  yield* phase(7,'A → B : 실제 IP 패킷을 ESP로 보호한다',
    '터널 모드에서는 원래 IP 헤더와 데이터를 암호화한다.\n외부 IP·SPI·순번·IV는 보인다. 인증 태그로 변조를 검출한다.',
    'K_AB + 패킷 nonce → AES-GCM 암호문 + 인증 태그',C.secure,function*(){
      observer().text('주소·길이·타이밍은 관찰 가능 · 내부 데이터는 숨김');
      tunnel().points([[-312,-21],[312,-21]]);
      tunnel().opacity(1);esp().opacity(1);
      leftState().text('원래 IP 패킷\n↓ ESP 캡슐화\nK_AB로 보호\nSeq 증가');
      rightState().text('SPI로 SA 찾기\n재전송 검사\n태그 검증·복호화\n내부 패킷 전달');
      yield* encrypted().fill('#235e51',0.4).to('#163f3a',0.4);
      yield* all(esp().position.x(8,1.4),tunnel().stroke(C.secure,0.3));
    });

  yield* phase(8,'B → A도 별도 ESP SA로 응답한다',
    '역방향은 K_BA와 역방향 SPI·순번 상태를 사용한다.\nIKE는 이후 재키잉·삭제를 관리하고, 데이터는 ESP로 계속 흐른다.',
    '인증 태그가 틀리거나 재전송으로 판정되면 전달하지 않는다.',C.secure,function*(){
      yield* esp().opacity(0,0.3);
      yield* send('B → A : 다른 방향의 ESP SA\n별도 키 K_BA · SPI · Seq',-1,C.secure);
      leftState().text('수신 SA 선택\n태그·재전송 검사\nK_BA로 복호화\n내부 패킷 전달');
      rightState().text('응답 IP 패킷\n↓ ESP 캡슐화\nK_BA로 보호\n역방향 Seq 증가');
      observer().text('IKE = 제어 / ESP = 데이터 · 역할을 분리해서 기억');
    });
});
