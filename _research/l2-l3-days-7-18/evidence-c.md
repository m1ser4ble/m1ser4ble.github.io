# Day15–18 근거 장부 — part-c / Google Jupiter 사례

## 조사 범위와 한계

- 조사일: **2026-10-17 Asia/Seoul**. `TZ=Asia/Seoul date +%F` 실제 실행값으로 확인했다.
- `/home/sampling/l2l3-research/day-15.md` ~ `day-18.md` 네 파일 및 `/home/sampling/m1ser4ble.github.io/skills/drd/SKILL.md`, `CLAUDE.md` 전체를 읽었다. 네 일차의 모든 확인 질문과 전달 분기, 핵심 약자, 원문 관측 명령을 통합 원고에 보존했다.
- `part-c.md`는 부모가 통합할 4개 H2 조각이다. D3, 통합 용어사전·연대표·참고자료는 부모 담당이라 중복 작성하지 않았다. 각 절은 H3·비교표·인과 prose·inline 1차인용과 **미실행** 조회 명령을 포함한다.
- 실제 수행은 자료 조회, 원문 텍스트 저장, 원고 생성·구조 검사뿐이다. 네트워크 실습, FRR 실행, 패킷 캡처, 장애 주입, 성능 측정은 하지 않았다. 문서의 `ip`, `vtysh`, `tcpdump`, `sysctl` 예시는 **미실행**이다.
- RFC의 절은 실제 본문을 확인했다. 최초 web_extract의 RFC 9135 결과가 목차까지만 보여 plain-text RFC 전체를 직접 내려받아 필요한 본문을 재독했다. 목차·검색 snippet만으로 사실을 확정하지 않았다.
- FRRouting `latest` 페이지 추출은 일부 문단이 누락됐고 직접 HTTP 접근은 403이었다. `FRRouting/frr` 공식 저장소의 `doc/user/*.rst`로 복구하고 아래 SHA로 재조회했다. 최신 문서를 설치된 버전의 행동으로 간주하지 않는다.
- FRR 조회 리비전: **`953210b2dda0f850859377c2e4352dc548e6b45d`** (`git ls-remote ... refs/heads/master` 실제 반환값). 해당 SHA의 `bfd.rst`, `evpn.rst`, `zebra.rst`를 읽었다.
- Linux 문서는 조회 당시 docs.kernel.org의 rolling 문서다. resilient 페이지의 헤더는 `7.3.0-rc7`로 표시됐다. 이 기계나 사용자의 장비에 그 커널이 설치됐다는 주장은 하지 않는다.
- Google의 생산 사례는 2015년 저자 보고와 당시 세대 범위다. Google 내부의 현재 설정, BFD/EVPN/FRR 사용, 단일 흐름 성능은 확인하지 않았고 주장하지 않는다.

## 실제 읽은 1차 자료

| ID | 원문과 읽은 범위 | 적용 시점·버전 | 상태 |
|---|---|---|---|
| C01 | [RFC 9135](https://www.rfc-editor.org/rfc/rfc9135.txt), 서론, §§4·4.1·5.1–5.5·6 | 2021-10 Standards Track | 확인 |
| C02 | [RFC 2991](https://www.rfc-editor.org/rfc/rfc2991.txt), §§2–5 | 2000-11 Informational | 확인 |
| C03 | [RFC 2992](https://www.rfc-editor.org/rfc/rfc2992.txt), §§1·2·2.2 | 2000-11 Informational | 확인 |
| C04 | [RFC 7348](https://www.rfc-editor.org/rfc/rfc7348.txt), §5의 실제 UDP 헤더 설명 | 2014-08 Informational | 확인 |
| C05 | [RFC 5880](https://www.rfc-editor.org/rfc/rfc5880.txt), §§3.2·4.1·6.2·6.8.2–6.8.7 | 2010-06 Standards Track | 확인 |
| C06 | [RFC 5881](https://www.rfc-editor.org/rfc/rfc5881.txt), §§4–6·운영 적용성 | 2010-06 Standards Track | 확인 |
| C07 | [RFC 5883](https://www.rfc-editor.org/rfc/rfc5883.txt), §§1–6 | 2010-06 Standards Track | 확인 |
| C08 | [RFC 4271](https://www.rfc-editor.org/rfc/rfc4271.txt), §§3.2·9.1.2.1 | 2006-01 BGP-4 기본 명세 | 확인 |
| C09 | [FRR EVPN](https://docs.frrouting.org/en/latest/evpn.html), 정의·RT·Linux 구성 연동; [고정 리비전 원문](https://github.com/FRRouting/frr/blob/953210b2dda0f850859377c2e4352dc548e6b45d/doc/user/evpn.rst) | 위 SHA / 2026-10-17 읽기 | 확인 |
| C10 | [FRR BFD](https://docs.frrouting.org/en/latest/bfd.html), Peer/Profile Configuration·OSPF BFD Configuration·Status; [고정 리비전 원문](https://github.com/FRRouting/frr/blob/953210b2dda0f850859377c2e4352dc548e6b45d/doc/user/bfd.rst) | 위 SHA / 2026-10-17 읽기 | 확인 |
| C11 | [FRR Zebra](https://docs.frrouting.org/en/latest/zebra.html), NHT·Administrative Distance·Route Replace Semantics·ECMP·FIB push; [고정 리비전 원문](https://github.com/FRRouting/frr/blob/953210b2dda0f850859377c2e4352dc548e6b45d/doc/user/zebra.rst) | 위 SHA / 2026-10-17 읽기 | 확인 |
| C12 | [Linux IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html), `fib_multipath_hash_policy`, fields, seed | rolling kernel docs, 조회일 위와 같음 | 확인 |
| C13 | [Linux Resilient Next-hop Groups](https://docs.kernel.org/networking/nexthop-group-resilient.html), 소개·알고리즘·타이머 | rolling kernel docs | 확인 |
| C14 | [Linux VRF](https://docs.kernel.org/networking/vrf.html), VRF 장치와 라우팅 테이블의 관계 | rolling kernel docs | 확인 |
| C15 | [ip-route(8)](https://man7.org/linux/man-pages/man8/ip-route.8.html), `get`, `fibmatch`, from/iif/ipproto/sport/dport | 조회 당시 iproute2 매뉴얼, man7 배포본 | 확인 |
| C16 | [ip-neighbour(8)](https://man7.org/linux/man-pages/man8/ip-neighbour.8.html), 같은 링크의 IP–링크주소 바인딩, incomplete/failed | 조회 당시 iproute2 매뉴얼, man7 배포본 | 확인 |
| C17 | [Google 공식 출판 페이지](https://research.google/pubs/jupiter-rising-a-decade-of-clos-topologies-and-centralized-control-in-googles-datacenter-network/), 제목·Google 저자·2015 SIGCOMM·abstract; [실제 SIGCOMM 원문](https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p183.pdf), Table 2·§3.5·§§5.2.2–5.2.3·Table 4 | SIGCOMM 2015, Google 운영 경험 보고 | 확인 |

## 주장별 증거·판정

여기의 **확인**은 문서가 해당 주장을 직접 지원한다는 뜻이며 실험 검증을 뜻하지 않는다. **추론**은 확인된 전제에서 작성자가 도출한 설계 권고다.

| 주장·조건 | 실제 읽은 근거 / 짧은 원문 | 날짜·버전 | 판정 |
|---|---|---|---|
| 대칭 IRB는 양 끝의 IP 조회, 비대칭은 ingress 라우팅·egress MAC 조회 | C01 §4: `both ingress and egress PEs perform lookups on both MAC and IP addresses`; asymmetric egress `just a single MAC lookup` | RFC 9135 | 확인 |
| VXLAN 대칭 IRB의 터널 안쪽 Ethernet은 ingress/egress PE MAC, 목적 호스트 MAC 불필요 | C01 §4·5.4: `there is no need for the ingress PE to use the destination TS2's MAC address`; Router MAC Extended Community | RFC 9135 | 확인 |
| 대칭의 ingress는 원격 호스트 ARP 바인딩이 필수 아님, 로컬 서브넷 브리지만 필요 | C01 §4: `only maintains ARP entries for locally connected hosts and MAC-VRFs/BTs for only locally configured subnets` | RFC 9135 | 확인 |
| 비대칭은 원격 목적 서브넷·IRB와 IP–MAC 상태가 필요 | C01 §4: `ALL subnets in an IP-VRF, including subnets that may not be locally attached`; 논리 테이블과 구현 테이블 차이도 같은 절 | RFC 9135 | 확인 |
| 안쪽 TTL은 대칭 두 끝에서 한 번씩, 비대칭 ingress에서 한 번 | C01 §4: `decremented by both ingress and egress PEs (once by each)` | RFC 9135 | 확인 |
| Anycast IP/MAC의 동일 구성 권고는 운영 단순성·이동 후 이웃 갱신 감소와 연결 | C01 §4.1 option 1/2, `option 1 is recommended`, `host does not need to refresh the default GW ARP/ND entry` | RFC 9135 | 확인 |
| RT가 수입 대상을, VNI가 수신 dataplane 문맥을 식별 | C09: `IP-VRFs and EVIs are identified by Route Targets, never by labels`; C01 §5.5에서 VNI로 IP-VRF 선택 | FRR 고정 SHA / RFC 9135 | 확인 |
| 호스트 학습 전 Type 5 서브넷 경로가 원격 gleaning을 부트스트랩 | C01 §5.3: 일부 서브넷만 각 PE에 배치되는 조건에서 `MUST advertise local subnet routes as EVPN RT-5` | RFC 9135 | 확인 |
| FRR은 Netlink로 Linux 인터페이스 상태를 배우지만 직접 인터페이스 관리하지 않음 | C09 FRR Configuration: `does not manage network interfaces directly` | FRR 고정 SHA | 확인 |
| 패킷별 다중경로는 MTU 변화·지연 차·재정렬 위험 | C02 §2 Variable Path MTU, Variable Latencies; §3 동일 flow를 같은 경로에 유지 | RFC 2991 | 확인 |
| flow는 반드시 5-tuple이 아님 | C02 §3의 destination-only·3-tuple 예; C12 정책 0=L3, 1=L4, 2=inner L3, 3=custom | RFC 2991 / Linux rolling | 확인 |
| VXLAN UDP 송신 포트는 안쪽 필드 해시·49152–65535 권고, 목적 포트 4789 | C04 §5: `enable a level of entropy for the ECMP/load-balancing`; 포트 범위는 RECOMMENDED | RFC 7348 | 확인 |
| 같은 그룹에서 flow 고정, 그룹 변경 시 정상 홉의 flow도 이동 가능 | C03 §2.2의 region boundary와 예; C13의 hash-threshold 재분할 그림과 문장 | RFC 2992 / Linux rolling | 확인 |
| resilient는 hash→bucket→next-hop 간접 매핑, idle·unbalanced 타이머 절충 | C13 Algorithm: 삭제된 홉 버킷, idle-overweight 버킷, unbalanced timer 초과 버킷 이동 조건 | Linux rolling | 확인 |
| flow 분포가 균등하다고 바이트 분포까지 균등하지 않음 | C03 §2는 uniform hash일 때 flow 분포만 다룸; 연결별 전송량 차이를 결합 | 해당 이론 범위 | 추론 |
| BFD 비동기는 서로 주기 송신, Demand·Echo는 구분된 모드/기능 | C05 §3.2: `periodically send BFD Control packets to one another`; Echo는 `an adjunct to both modes` | RFC 5880 | 확인 |
| L의 비동기 탐지 시간은 상대 S의 배수 × max(L RX, S TX); 양방향 독립 | C05 §6.8.4: `calculated independently in each direction`; `Detect Mult received from the remote system` | RFC 5880 | 확인 |
| BFD 예제 계산 300ms / 비대칭 900ms와 500ms | Python 실제 계산: `3*max(100,100)=300`, `3*max(100,300)=900`, `5*max(50,100)=500`; 측정 아닌 수식 예 | 2026-10-17 계산 | 확인(계산) |
| BFD 헤더 단위 μs와 FRR ms, 로컬 설정 배수가 원격 탐지에 영향 | C05 §4.1 필드 단위; C10 `detect-multiplier` 예는 local 3·TX300 / remote RX200 → remote900ms | RFC 5880 / FRR 고정 SHA | 확인 |
| 탐지 시간은 마지막 유효 수신 이후이며 캡처만으로 수락 증명 안 됨 | C05 §6.8.4의 `not been discarded according to ... 6.8.6`; §6.8.6 유효성 검사 | RFC 5880 | 확인 |
| 단일 홉 Control 3784, 세션 고정 송신 포트 49152–65535, Echo3785 | C06 §4 실제 캡슐화 규칙. **주의:** 같은 RFC §8에는 `3875`라는 숫자가 나타나므로 포트 근거로 §4를 사용했다. 원문 §4는 3785로 명확하다 | RFC 5881 §4 | 확인 |
| 비인증 단일 홉 TTL 송수신255; 인증 사용 시 송신 MUST255·수신 검사 MAY | C06 §5의 조건부 MUST/MAY를 구분 | RFC 5881 | 확인 |
| 다중 홉 Control 4784, Echo 금지, TTL255 검사 그대로 적용 불가, 암호 인증 권고 | C07 §§3·5·6: `Echo function MUST NOT be used over multiple hops`; `SHOULD utilize cryptographic authentication` | RFC 5883 | 확인 |
| BFD를 라우팅 소비자와 연동해야 상태 변화가 경로에 연결 | C10 `ip ospf bfd`는 `Listen for BFD events`; 감지와 FIB 반영은 다른 단계 | FRR 고정 SHA | 확인 / 복구시간 해석은 추론 |
| BGP 후보 RIB와 선택 RIB, 광고 RIB는 개념적으로 분리 | C08 §3.2: Adj-RIBs-In / Loc-RIB / Adj-RIBs-Out; 복사본 3개 의무 아님 | RFC 4271 | 확인 |
| 미해결·상호재귀 NEXT_HOP은 유효 해석 아님, 최장 일치 해석 경로 고려 | C08 §9.1.2.1: `SHOULD exclude unresolvable routes`; `Mutually recursive routes ... also fail` | RFC 4271 | 확인 |
| Zebra는 프로토콜 best를 받아 prefix별 선택 후 커널 FIB 반영 | C11 FIB push interface: `Routing protocols communicate their best routes to zebra`; `Zebra feeds the FIB to the kernel` | FRR 고정 SHA | 확인 |
| FRR 선택 `>`와 FIB `*` 구분, NHT는 경로 해석 추적 | C11 ECMP 예와 `show ip nht` 설명; NHT default-route 허용은 프로파일 구분 있어 무조건 단정하지 않음 | FRR 고정 SHA | 확인 |
| IP 경로와 같은 링크 IP–MAC 이웃 해석은 별도 | C16 Description: `hosts sharing the same link`; incomplete=미해석, failed=probe 실패; C08 재귀 경로 조건과 구분 | RFC 4271 / iproute2 문서 | 확인 |
| ip route get은 from/iif/포트 등으로 경로를 조회, 패킷 송신 아님 | C15 get: `prints its contents exactly as the kernel sees it`; 이어지는 설명의 `but no packets are actually sent` | iproute2 문서 | 확인 |
| Jupiter 최초 배치2012, 최대1.3Pbps bisection은 집계 용량 | C17 Table2·§3.5; 단일 흐름 수치로 쓰지 않음 | 2015 보고의 역사적 수치 | 확인 |
| Firepath는 중앙 상태 배포·분산 전달표 계산과 ECMP 설치 | C17 §5.2.2: `centralized topology state distribution, but distributed forwarding table computation`; `each client computes ... ECMP and programs ... local to its switch` | 2015 보고 | 확인 |
| 장애 종류별 로컬/비로컬 수렴과 전환 중 손실 가능 | C17 §5.2.3: `small transient loss`; 인접 요소의 ECMP failed-next-hop prune | 2015 보고 | 확인 |
| 125/325/4000ms를 Jupiter SLA나 BFD 타이머로 전용하면 안 됨 | C17 Table4 제목이 `convergence times in a Saturn cluster` | Saturn 사례 | 확인 |

## 원문 원칙을 넘어가지 않은 범위

- 명세 날짜를 기술의 최초 발명일로 바꾸지 않았다. RFC 2991/2992는 Informational이고 RFC 9135는 논리적 forwarding 모델임을 본문에서 한정했다.
- “대칭 IRB”를 왕복 물리경로 대칭으로, “BFD 양방향”을 동일 타이머로, “ECMP”를 5-tuple 고정 사양으로 바꾸지 않았다.
- “RIB에 보임”을 best·통합 선택·FIB 설치·neighbor 해석·실제 송신과 동일시하지 않았다.
- 대안 선택·best practice 중 문서의 직접 권고가 아닌 내용은 “선택상 추론”으로 표시했다.
- bigtech 사례는 `c-case.md`에 독립 공급한다. 이 원문에 ECMP/FIB 설치가 있다는 근거와 본문의 EVPN·FRR·BFD 예시가 Google 구현이라는 주장은 별개다.

## 로컬 보존 자료와 재현성

원문 다운로드 및 실질 문단 확인용 텍스트는 `/home/sampling/l2l3-research/raw-c/`에 저장했다. RFC 8개는 RFC Editor의 전체 `.txt`다. FRR은 위 고정 SHA의 RST 세 파일이다. Linux 문서는 HTML에서 추출한 본문 텍스트다. `jupiter-rising-extracted.md`는 도구가 보존한 PDF 추출 텍스트(약 50KB)이며 전체 논문의 완전 아카이브라고 주장하지 않는다. 필요한 Table2·§3.5·§§5.2.2–5.2.3·Table4의 실제 문단은 해당 추출본에서 확인했다. PDF 원문 URL을 최종 인용으로 유지한다.

모든 출력은 연구 디렉터리에만 작성했다. 블로그 repo 수정·게시·커밋은 수행하지 않았다.
