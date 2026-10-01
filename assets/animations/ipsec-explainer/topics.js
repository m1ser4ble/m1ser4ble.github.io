export const topics={keys:{title:'두 비밀의 출처: PSK와 DH',chapters:[
['접속 전: PSK 배포','관리자가 독립적으로 신뢰할 수 있는 경로로 같은 강한 PSK를 A와 B에 미리 배포합니다. PSK는 인증 자격 증명이며 DH 비밀이나 ESP 암호화 키가 아닙니다.'],
['접속 중: DH 공개값만 교환','A의 KEi와 B의 KEr, 난수 Ni·Nr가 공개 채널을 건넙니다. DH 개인값 a·b와 PSK는 로컬에 남습니다. 화면의 화살표는 공개값 이동만 나타냅니다.'],
['Z → IKE 키: 로컬 파생','정상 DH 교환에서 양쪽이 같은 비밀 Z를 로컬 계산합니다. Z와 난수에서 IKE 키들을 파생하지만, 아직 상대 인증은 끝나지 않았습니다. Z나 키를 네트워크로 보내지 않습니다.'],
['PSK → AUTH: 교환에 묶인 증명','IKE 키로 보호된 IKE_AUTH 안의 AUTH는 PSK와 신원·앞선 교환 내용을 연결하는 증명입니다. PSK 자체를 보내지 않습니다. DH 후에 인증을 검증합니다.'],
['인증 성공: 신뢰 상태 전환','양쪽의 AUTH 검증이 성공해야 상대를 신뢰합니다. 암호화할 키가 생기는 것과 상대의 신원이 인증되는 것은 별개의 사건입니다.'],
['IKE → ESP: 별도 데이터 키','초기 CHILD SA는 SK_d와 Ni·Nr에서 ESP 키 재료를 파생합니다. A→B와 B→A는 별도 키·SPI·상태를 사용합니다. PSK → AUTH → 신뢰와 Z → IKE 키 → ESP 키는 역할이 다른 두 경로입니다.']
],fallback:'기본 PSK IKEv2의 개념도입니다. SKEYSEED = prf(Ni | Nr, Z); IKE 키들은 SKEYSEED와 Ni·Nr·SPIi·SPIr로 prf+ 파생합니다. 첫 CHILD SA의 KEYMAT = prf+(SK_d, Ni | Nr). AUTH의 정확한 계산은 RFC 7296 §§2.15–2.17을 따르며, 화면의 화살표는 계산 의존 관계이지 실제 수식이나 패킷 형식이 아닙니다.'}};
topics.mitm={title:'키가 있어도 신뢰는 없다: DH 중간자 공격',chapters:[
['두 개로 갈라진 DH 교환','중간자 M이 DH 공개값을 바꾸면 A–M과 M–B가 서로 다른 교환을 수행합니다. 인증되지 않은 DH만으로는 통신 상대를 확인할 수 없습니다.'],
['Z_AM ≠ Z_MB: 서로 다른 비밀','A와 M은 Z_AM을, M과 B는 Z_MB를 계산합니다. 각 구간에 IKE 키가 생겨도 trusted=false입니다. M은 두 구간의 내용을 복호화하고 다시 암호화할 수 있지만 정당한 A나 B의 신원을 증명한 것은 아닙니다.'],
['공격자에게 없는 인증 자격','이 예시에서는 M이 강한 PSK를 모릅니다. 인증서 인증이라면 신뢰하는 상대의 개인 서명 키가 없다는 대응 관계입니다. PSK 인증과 서명 인증을 동시에 하는 장면이 아닙니다.'],
['AUTH가 바뀐 교환에 묶인다','AUTH는 앞선 교환 메시지·난수·신원과 인증 자격을 묶습니다. 교환을 바꾼 M은 올바른 PSK 기반 AUTH를 새로 만들 수 없으며, 다른 교환의 AUTH를 그대로 옮겨도 검증에 실패합니다.'],
['실패 → 중단: 데이터 전송 없음','AUTH 검증이 실패하면 신뢰 상태는 false로 남고 연결을 중단합니다. 첫 CHILD SA를 정상 설치하거나 ESP 데이터 송신으로 넘어가지 않습니다.']
],fallback:'강한 PSK가 안전하게 사전 배포되었고 공격자는 PSK를 모른다는 가정입니다. 약하거나 유출된 PSK는 이 가정을 깨뜨립니다. IKE_AUTH는 먼저 DH에서 파생한 키로 보호되지만, 그 암호화만으로 상대 신원을 믿지 않습니다. AUTH 검증 성공이 필요합니다. AUTH의 정확한 SignedOctets와 PSK 계산은 RFC 7296 §§2.15–2.17을 따릅니다.'};
topics.modes={title:'패킷 경계로 보는 transport와 tunnel',chapters:[
['원래 패킷: hostA → hostB','보호하기 전 패킷은 원래 IP 헤더(hostA → hostB), TCP 헤더, 데이터로 구성됩니다. 이 출발 패킷이 두 모드에서 어떻게 감싸지는지 비교합니다.'],
['Transport: 원래 IP 헤더 유지','Transport 모드는 원래 IP 헤더를 바깥에 남기고 TCP 헤더와 데이터를 ESP로 암호화합니다. 새 터널용 IP 헤더를 덧붙이는 모드가 아닙니다.'],
['Tunnel: 새 외부 IP 헤더 추가','Tunnel 모드는 새 외부 IP 헤더(gwA → gwB)를 추가하고 원래 IP 헤더(hostA → hostB)부터 TCP·데이터까지 전체 원래 패킷을 암호화합니다. 원래 IP 주소는 내부에 보존됩니다.'],
['P2P와 모드는 별개의 축','P2P는 피어 간 관계·토폴로지이고, transport/tunnel은 패킷 캡슐화 방법입니다. P2P라고 transport가 되는 것은 아닙니다. 호스트끼리도 tunnel을 사용할 수 있으며 새 외부 주소와 내부 주소는 같거나 다를 수 있습니다.']
],fallback:'도식은 암호화 범위와 주소를 비교하며 정확한 ESP wire format은 아닙니다. 실제 패킷에는 ESP header(SPI·Sequence Number), 알고리즘별 IV, 암호화된 ESP trailer 및 인증 태그/ICV 등이 있습니다. AES-GCM 예시에서는 원래 외부 IP 헤더를 암호화하지 않으며, tunnel의 내부 IP 헤더는 암호문 안에 포함됩니다. 외부 주소·길이·타이밍 등의 메타데이터는 숨기지 않습니다. RFC 4303 §3.1을 참조하세요.'};
const requested=new URLSearchParams(location.search).get('topic');
export const topic=Object.hasOwn(topics,requested)?requested:'keys';
export const chapterFrames=180;
