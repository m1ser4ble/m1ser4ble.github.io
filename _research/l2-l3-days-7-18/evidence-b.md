# Day 11–14 근거 장부 (part-b)

- 조사일: **2026-10-17 KST**. `TZ=Asia/Seoul date` 실행 결과로 확인.
- 산출물: `part-b.md`(4개 H2 아래 한국어 본문), `b-case.md`(공개 BGP 운영 사례).
- 입력 전체 열람: `/home/sampling/l2l3-research/day-11.md`(83줄), `day-12.md`(81줄), `day-13.md`(261줄), `day-14.md`(229줄). 도구 진행·홈 채널 안내 등 비개념 잡음만 제외했다.
- 작성 지침 전체 열람: `/home/sampling/m1ser4ble.github.io/skills/drd/SKILL.md`(273줄), `/home/sampling/m1ser4ble.github.io/CLAUDE.md`(97줄). 부모 통합 원고용이므로 H2 구조를 유지하고 front matter·D3는 부모에게 남겼다. **저장소 수정·커밋·게시를 수행하지 않았다.**
- `확인`은 실제 열람한 자료가 조건부 주장을 지지한다는 뜻이지 장비에서 직접 실험했다는 뜻이 아니다. `추론`은 구조에서 도출한 설계 판단이다.

## 1. 직접 열어 읽은 1차 자료와 주장

RFC는 `https://www.rfc-editor.org/rfc/rfc<번호>.txt`에서 전체를 HTTP로 내려받아 `sources-b/`에 보존했고 관련 본문 구간을 `read_file`로 열람했다. 아래 명시한 절을 읽었다는 뜻이며 RFC 전체를 통독했다고 주장하지 않는다. HTML inline source는 같은 RFC의 절 앵커로 연결한다.

| 주장 | 실제 읽은 근거·절·로컬 위치 | 조회일/적용 버전 | 판정 |
|---|---|---|---|
| BGP는 EGP·NSFNET 경험에서 출발했고 AS 경로와 정책을 교환한다 | [RFC 1105](https://www.rfc-editor.org/rfc/rfc1105.txt) 표제·§1–2; [RFC 4271 §3](https://www.rfc-editor.org/rfc/rfc4271.html#section-3), `sources-b/rfc4271.txt` 357–477줄 | 2026-10-17 / 1989 BGP 및 2006 BGP-4 | 확인 |
| Lougheed·Rekhter, 1989년 6월 초기 명세; 1995년 BGP-4와 2006년 기본 명세 연표 | RFC 1105 표제; [RFC 1771](https://www.rfc-editor.org/rfc/rfc1771.txt) 1–43줄; RFC 4271 표제·§3 | 동일 | 확인 |
| BGP-4는 CIDR 프리픽스·집계 지원, TCP 179 운반, iBGP/eBGP 구분 | RFC 4271 §3, 406–471줄 | BGP-4 | 확인 |
| 세션: TCP→OPEN→KEEPALIVE 확인→Established, UPDATE 경로 배포 | RFC 4271 §3·§4.2; 상태 머신 §8 문서 구조도 대조 | BGP-4 | 확인 |
| Marker 16B·Length 2B·Type 1B; OPEN·UPDATE·KEEPALIVE·NOTIFICATION | RFC 4271 §4.1–4.5, 특히 623–777줄과 입력 원문 | 기본 명세의 헤더 범위 | 확인 |
| Adj-RIB-In/Loc-RIB/Adj-RIB-Out은 개념 구분이며 구현별 세 사본을 강제하지 않음 | RFC 4271 §3.2, 531–588줄 | BGP-4 | 확인 |
| BGP best와 전체 routing table의 채택·FIB 설치는 별도 | RFC 4271 §3.2, §9.1.2 | BGP-4 | 확인 |
| eBGP 재광고 ASN prepend, iBGP AS_PATH 유지, 자기 AS 루프 검출 | RFC 4271 §5.1.2, §9.1.2, `rfc4271.txt` 1377–1443, 4324–4335줄 | 기본 동작/예외 미포함 | 확인 |
| 일반 eBGP에 LOCAL_PREF를 보내지 않으며 높은 내부 선호도 사용 | RFC 4271 §5.1.5, 1588–1604줄. Confederation 예외 존재하므로 본문에 일반 eBGP라 한정 | BGP-4 | 확인 |
| NEXT_HOP은 재귀적 도달성 검사 필요, 미해석 후보 제외 | RFC 4271 §5.1.3·§9.1.2–9.1.2.1 | BGP-4 | 확인 |
| FRR은 앞선 조건이 같으면 LOCAL_PREF를 AS_PATH 길이보다 먼저 비교 | [FRR BGP Route Selection](https://docs.frrouting.org/en/latest/bgp.html#route-selection) 본문 목록: admin distance·weight·local preference·local route·AS path 등 | 조회 시 latest, 설치 버전 미지정 | 확인 |
| eBGP 정책 부재 시 default reject가 기본값 | [RFC 8212 §3](https://www.rfc-editor.org/rfc/rfc8212.html#section-3), `rfc8212.txt` 145–189줄 | 2017 보완 RFC | 확인 |
| VRRP는 정적 게이트웨이의 단일 장애점을 호스트 재설정 없이 완화 | [RFC 9568 §1.3](https://www.rfc-editor.org/rfc/rfc9568.html#section-1.3), `rfc9568.txt` 233–274줄 | VRRPv3 | 확인 |
| RFC 9568은 RFC 5798을 Obsoletes하며 버전은 여전히 3 | [RFC 9568](https://www.rfc-editor.org/rfc/rfc9568.txt) 1–37, 148–219줄; `rfc5798.txt` 표제와도 대조 | 2024년 4월 / 2010년 3월 | 확인 |
| VRRP 초기 RFC 2338은 1998년 4월이며 HSRP·IP Standby 유사 기능 언급 | [RFC 2338 표제·§1](https://www.rfc-editor.org/rfc/rfc2338.html); RFC 9568 §1 | 해당 역사 문서 범위 | 확인 |
| 9568은 Active 용어 변경뿐 아니라 상태 머신·IPv4 checksum·광고 동작을 수정 | RFC 9568 §1.1, 173–219줄 | VRRPv3 2024 | 확인 |
| IPv4 그룹 224.0.0.18, Protocol 112, TTL 255 검사; IPv6 ff02::12·Hop Limit 255 | RFC 9568 §5.1.1–5.1.2, 703–801줄 | 표준 multicast 모드 | 확인 |
| VRRP 헤더 비트 폭, priority 255 owner·0 relinquish·1–254 후보, 간격 centisecond | RFC 9568 §5.2·§6.1, 802–1003줄 | VRRPv3 | 확인 |
| IPv4 checksum은 VRRP 메시지만, IPv6는 pseudo-header 포함 | RFC 9568 §5.2.8 및 §1.1 항목4 | VRRPv3 2024 | 확인 |
| Advertisement 출발 MAC은 가상 MAC이며 브리지가 포트를 학습; ARP 내부는 가상 MAC이지만 ARP 응답 외부 Ethernet source는 물리 MAC | RFC 9568 §7.2–7.3·§8.1.2, 1351–1469줄. 이 두 종류 패킷을 혼동하지 않도록 별도 서술 | IPv4 표준 가상 MAC | 확인 |
| Backup→Active에서 GARP·광고, priority0 시 Skew_Time, 기본 preemption 허용·owner 예외 | RFC 9568 §6.1·§6.4.2, 911–1003, 1090–1189줄 | VRRPv3 | 확인 |
| VRRP에는 현재 자체 인증이 없음 | RFC 9568 §9, 1661줄 이후의 해당 문장 | VRRPv3 | 확인 |
| Keepalived의 use_vmac, track_interface·track_script는 별도 기능 | [원본 man source](https://raw.githubusercontent.com/acassen/keepalived/master/doc/man/man5/keepalived.conf.5.in), 전체 파일 로컬 `sources-b/keepalived.conf.5.in`; 1440대·1500대·1689–1715줄 실제 열람 | 조회 시 master, 설치 버전 보장 안 함 | 확인 |
| VXLAN의 동기: VM MAC 확대·tenant·VLAN 4094·STP 비활용 링크·IP ECMP와 L2 유지 | [RFC 7348 §1·§3](https://www.rfc-editor.org/rfc/rfc7348.html#section-3), `rfc7348.txt` 119–325줄 | 2014년 8월 | 확인 |
| RFC 7348은 Informational/Independent Submission이며 이미 배포된 VXLAN의 문서화 | RFC 7348 표제·Abstract·Status, 1–46줄 | Standards Track 아님 | 확인 |
| VNI 24비트, VTEP는 역할이며 서버·스위치·SW/HW 구현 가능 | RFC 7348 §1.1·§4, 175–213·326–382줄 | 기본 VXLAN | 확인 |
| VNI와 VLAN 번호는 대응 설정이며 목적지 주소가 아니다 | RFC 7348 §4–6, RFC 8365 §5.1의 tenant VID mapping; 원문 Q&A와 대조 | 단순 VLAN-based 예시 | 확인 |
| source learning은 inner source MAC→outer source IP를 학습, ARP 요청은 outer multicast, 응답은 outer unicast 가능 | RFC 7348 §4.1–4.2, 384–474줄 | multicast flood-and-learn | 확인 |
| VNI→group은 management 설정, IGMP 참여·PIM 등 underlay multicast 필요 | RFC 7348 §4.2–4.3 | 해당 운반 방식일 때 | 확인 |
| 모든 인터페이스가 아니라 같은 브리지/VLAN의 허용 포트로 flood, unknown unicast의 목적 MAC을 바꾸지 않음 | [Linux bridge](https://docs.kernel.org/networking/bridge.html) Introduction·port learning·UNICAST_FLOOD·port STATE 설명, RFC 7348 §4의 프레임 유지 | 조회 시 kernel docs | 확인 |
| IPv4 multicast 224.0.0.0–239.255.255.255, 239/8 administrative scope | [RFC 1112 §4](https://www.rfc-editor.org/rfc/rfc1112.html#section-4), `rfc1112.txt` 119–133줄; [RFC 2365 §4](https://www.rfc-editor.org/rfc/rfc2365.html#section-4) 93–107줄 | 범위 정의 | 확인 |
| 조직 scope는 239.192/14에서 배정, 239.0/10 등은 확장 전 미할당 유지 | RFC 2365 §6.2·§6.2.1, 148–161줄 | 실제 주소 배정 시 권고 | 확인 |
| 239.1.1.10은 원문 설명값이지 권장 운영 할당값 아님 | 입력값과 RFC 2365 예약 구조의 결합 | 예시와 운영 분리 | 추론/정정 |
| VXLAN header 8B·I bit·VNI, UDP dst4789·source hash ECMP, outer/inner Ethernet | RFC 7348 §5, 511–596줄 | IPv4 중심 기본 예시 | 확인 |
| VTEP는 조각화 금지, 수신은 조각을 폐기 가능, MTU 여유 권고 | RFC 7348 §4.3, 490–498줄 | 기본 VXLAN | 확인 |
| VXLAN은 암호화·인증 내장 아님; IPsec 등 별도 보호 가능 | RFC 7348 §7, 993–1044줄 | 기본 VXLAN | 확인 |
| Linux VXLAN 1:N, 정적·동적 FDB, 과거 포트 호환 기본값 | [Linux VXLAN](https://docs.kernel.org/networking/vxlan.html) 전체 본문 | 조회 시 kernel docs | 확인 |
| EVPN 원래 배경은 VPLS의 multihoming·redundancy·multicast·provisioning·flow load-balance 한계 | [RFC 7432 §1·§4](https://www.rfc-editor.org/rfc/rfc7432.html#section-1), `rfc7432.txt` 184–351줄 | 2015년 2월 MPLS EVPN | 확인 |
| EVPN은 BGP remote learning, local learning은 DP/관리/제어 등 가능 | RFC 7432 §4·§9.1–9.2, 306–328·1631–1678줄 | 기본 EVPN | 확인 |
| MP-BGP로 EVPN NLRI AFI25/SAFI70 교환 | [RFC 4760](https://www.rfc-editor.org/rfc/rfc4760.html) §1·§3–4; RFC 7432 §7, 679–720줄 | MP-BGP + EVPN | 확인 |
| Type2 각 필드·IP optional·MAC-only, next hop은 광고 PE | RFC 7432 §7.2·§9.2.1, 758–800·1687–1782줄 | 기본 형식 | 확인 |
| VXLAN용 label 필드는 24비트 VNI, VLAN-based Ethernet Tag0, next hop은 NVE | [RFC 8365 §5.1.3](https://www.rfc-editor.org/rfc/rfc8365.html#section-5.1.3), `rfc8365.txt` 705–775줄 | VXLAN EVPN | 확인 |
| RD·RT·VNI 구분, local VNI와 DCI 변환도 가능 | RFC 7432 §4·§7.9–7.10; RFC 8365 §5.1.1–5.1.3, 478–610줄; FRR Route Targets | 하나의 EVI 한 BD 예시로 제한 | 확인 |
| Type2 수신과 FDB 생성은 별도 구현 단계 | RFC 7432 §9.2.1, 1779–1782줄 | EVPN | 확인 |
| IP/MAC binding이 있어야 proxy ARP, MAC-only는 불충분 | RFC 7432 §10, 1842–1892줄; [FRR EVPN](https://docs.frrouting.org/en/latest/evpn.html) | Linux suppression 설정 조건 추가 | 확인 |
| Type3 IMET/PMSI가 다중 목적지 운반 신호, unknown unicast flood는 관리 선택 | RFC 7432 §7.3·§11–12, 802–824·1973–2125줄; RFC 8365 §9, 1239–1284줄 | EVPN overlay | 확인 |
| RR·route filtering 재사용, ingress replication 또는 multicast | RFC 8365 §4, 347–418줄 | 설계 기능이지 실측 규모 아님 | 확인 |
| MAC Mobility sequence, duplicate MAC와 이동 구별, multihoming ESI | RFC 7432 §15, 2471–2602줄 | 기본 EVPN | 확인 |
| Type1·Type4, DF·split horizon·mass withdrawal·aliasing; VXLAN은 MPLS와 절차 차이 | RFC 7432 §7·§8.5, 679–869·1463–1597줄; RFC 8365 §8 전체 주요 본문 959–1227줄 | 해당 baseline RFC | 확인 |
| Linux suppression은 커널 기능, SVI·neigh_suppress, bridge MAC learning과 vxlan VTEP learning 분리 | FRR EVPN Linux Interface Configuration, 캐시 `/home/sampling/.hermes/cache/web/docs.frrouting.org-16237d6e1e.md` 309–331줄 | 조회 시 latest | 확인 |
| 작은 고정 망에는 정적/학습, 이동·이중화·정책이 중요하면 EVPN 검토 | 위 기능·상태 비용을 비교 | 실측 threshold·우열 주장 없음 | 추론 |

## 2. 계산·패킷 경로 판단의 검증

- Python 실행: `1500 + 14 + 8 + 8 + 20 = 1550`; `1500 - 14 - 8 - 8 - 20 = 1450`.
- Python 실행: `3 + ((256 - 100) / 256) = 3.609375`초.
- MTU 전제: 내부 IP 1500, 내부 Ethernet 14, VXLAN8, UDP8, 외부 IPv4 20. 내부 VLAN/FCS·외부 IP 옵션 없음. 외부 Ethernet은 외부 IP MTU에 포함하지 않음.
- VRRP 전제: Active 광고 간격 1초, Backup priority100. 전체 전환의 실측 결과가 아닌 표준 공식 계산.
- 안쪽 TTL 유지/바깥 TTL 감소, 같은 subnet은 직접 MAC 조회, 다른 subnet은 게이트웨이, R이 내부 프리픽스를 몰라도 되는 판단은 해당 예시의 브리징/라우팅 경계에서 도출한 패킷 경로 설명이다. 하드웨어 캡처로 검증한 결과가 아니다.
- 모든 shell 관찰 명령은 **미실행 예시**로 표시. 로컬 네트워크 설정 변경·네임스페이스 실험·패킷 캡처를 실행하지 않았다.

## 3. 추가 Q&A 누락 방지 매핑

| 원문 질문/혼동 | part-b.md의 답 위치 |
|---|---|
| BGP는 L3인가 L4인가, 왜 짧은 AS path를 안 고르나 | 11일차 제어/운반 구분, LOCAL_PREF 후보 표와 경로 단계 |
| Established/best면 통신되는가, 확인 질문 | 11일차 RIB/FIB 분리·마지막 확인 질문 |
| VRRP ARP 그대로인데 장애인 이유, upstream만 죽는 경우 | 12일차 고정/이동 상태 표·장애·마지막 확인 질문 |
| VNI 약자, VLAN ID와 차이, VLAN10과20 대응 가능? | 13일차 VTEP·VNI·VLAN ID 표와 매핑 예 |
| 모르는 IP를 모든 인터페이스에 broadcast? 왜 VXLAN 포트도 전달? | 13일차 첫 ARP 1–6단계; 같은 VLAN 허용 포트·수신 포트 제외 |
| 모르는 IP와 unknown MAC의 차이, 목적 MAC 변경? | 13일차 ARP 절 마지막 단락 |
| 239는 전용 주소인가, 그룹 주소가 왜 그런가 | 13일차 239/8·그룹·자동계산 아님·운영 권고 |
| multicast는 L2인가, L3망 다른데 L2가 같을 수 있나 | 13일차 outer/inner 표·별도 주소 주체 구별 |
| VTEP은 약자인가, 장비인가 | 13일차 VTEP 역할과 SW/HW 구현 |
| BGP 약자, EVPN 약자, 애초에 무엇을 위해 나온 것인가 | 14일차 첫 세 절: 운반 vs 위치·VPLS 배경·약자 |
| 왜 위치를 BGP로 광고하며 서버가 BGP하는가 | 14일차 광고 정의·네트워크 장비 교환·MP-BGP·정책·철회·RR |
| 데이터 전에 위치를 아는 것의 정확한 범위 | 14일차 local 발견→Type2 광고→원격 설치, 마지막 인용 설명 |
| EVPN=VXLAN 대체? flooding 모두 없어짐? | 14일차 역할 표·Type3/BUM·MAC-only 확인 질문 |
| IP binding 없는 Type2, RT/VNI 차이, suppression 자동? | 14일차 Type2 표·RT·Linux 검증 절 |

## 4. 공개 운영 사례 증거와 한계

| 주장 | 실제 읽은 원문 | 적용/판정 |
|---|---|---|
| 2019-06-24 DQE→Allegheny→Verizon으로 more-specific 유출, Cloudflare /20→/21 예 | [Cloudflare 사건 분석](https://blog.cloudflare.com/how-verizon-and-a-bgp-optimizer-knocked-large-parts-of-the-internet-offline-today/) What happened 전체 본문 | 당시 당사 공개 보고 / 확인 |
| 최악 시 global traffic 약15% 손실 | 같은 원문 `During the incident, we observed ... about 15% of our global traffic.` | vendor/operator 자체 관측, 독립 실측 아님 / 확인 |
| 사건 종료·정상화 | [공식 상태 기록](https://www.cloudflarestatus.com/incidents/46z55mdhg0t5) resolved 본문 | 상태 기록 시각과 실제 데이터상의 시작·종료 시각을 동일시하지 않음 / 확인 |
| max-prefix·IRR·RPKI 대책 | 당시 분석 How could this leak have been prevented 전체 본문 | 사건의 대책 제안으로 인용, 만능 보장 아님 / 확인 |
| RPKI origin validation은 ASN·prefix length 확인이고 AS_PATH 전체를 검증하지 않음 | [RFC 6811 §2·§6](https://www.rfc-editor.org/rfc/rfc6811.html#section-6) actual body: Covered/Matched와 `does not ... provide any path validation` | 기본 origin validation 범위 / 확인 |
| «policy 전에 허용 경로 경계를 세우자» | 사건·RFC 8212에서 도출 | 설계 교훈 / 추론 |

Cloudflare 후속 deep-dive URL은 열었으나 web_extract가 중간 생략 조각을 반환했으므로 세부 숫자(101 routes 등)·세밀한 장애 시각의 근거로 사용하지 않았다. 첫 사건 분석은 전체 본문이 반환되어 그 범위만 사례에 사용했다. EVPN/VXLAN production 사례를 검색했으나 직접 뒷받침할 1차 사례가 확보되지 않아 기업별 패브릭 채택을 꾸며 넣지 않았다. `sources-b/rfc4761.txt`·`rfc4762.txt`는 추가 후보로 내려받았으나 해당 문서의 세부 동작을 본문 근거로 인용하지 않았다.

## 5. 부모 통합 시 주의

- `part-b.md`에는 정확히 11·12·13·14일차의 H2 네 개만 있고 설명은 H3 아래다.
- D3는 부모 담당. 적합한 삽입 지점: BGP 후보표 직후(policy/lookup 두 단계), VRRP 상태표 직후(ARP 고정/FDB 이동), VXLAN ARP 단계 직후(inner broadcast/outer multicast), EVPN Type2 표와 local→remote 단계 직후.
- multicast 예시 `239.1.1.10`은 원문 보존·비권장 운영 할당 설명을 함께 유지할 것.
- VRRP Advertisement의 source MAC과 ARP reply 외부 Ethernet source를 합치지 말 것.
- EVPN BGP 경로 수신·RT import·실제 FDB 설치·suppression·underlay 도달성은 별도 조건으로 유지할 것.
- 본문 내용과 사례의 운영 수치를 실제 실험 성공처럼 표시하지 말 것.
