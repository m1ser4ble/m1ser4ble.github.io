# 7–10일차 원고 Claim–Evidence 기록

- 조사일: **2026-10-17 KST**. 실제 날짜는 `TZ=Asia/Seoul date`로 확인했다.
- 입력: `day-07.md` 92행, `day-08.md` 89행, `day-09.md` 85행, `day-10.md` 90행을 전체 읽음. 원문 날짜는 각각 2026-10-06~09이다. 원문 수집의 live Discord 검증은 부모 작업의 전제이며 이 하위 작업이 REST 수집을 다시 수행한 것은 아니다.
- 산출: `part-a.md`. 저장소·커밋·게시·네트워크 설정 변경 없음. 모든 관측 명령은 미실행으로 표시했다.
- **확인**은 원문을 실제 읽어 주장과의 대응을 확인했다는 뜻이지 장비에서 재현했다는 뜻이 아니다. **추론**은 문서화된 사실을 결합한 운영 권고다. **미확인**은 아래 한계에 따로 기록했다.
- RFC는 번호별 발행본이며 본문 앞쪽의 Obsoletes/Updates와 연월도 확인했다. 커널 공식 문서·FRR `master`·`latest`·Linux `master`는 조회 시점의 rolling 자료다. 로컬 설치 버전을 조사한 것이 아니다. 표의 `L`은 `sources-a/<key>.txt` 로컬 저장본의 행 번호다.
- 중요한 절은 텍스트 RFC에서 찾아 실제 본문을 읽었다. web_extract의 head/tail·50KB 절단을 읽기 완료로 취급하지 않았으며, urllib로 전체 RFC를 저장한 뒤 해당 절을 출력했다.

## 원문 개념·확인 질문 커버리지

| 일차 | 원문의 모든 핵심 항목과 원고 대응 | 확인 질문 답변 |
|---|---|---|
| 7 | NDP 역할·운반 계층·EtherType, 128비트·/64·링크 로컬, 주소/경로/이웃 분리, RS/RA·Router Lifetime·L/A, A–S–R–B/C 토폴로지와 양방향 전제, solicited-node·IPv6/Ethernet/Target 구분, 멀티캐스트 확산 조건, A→C 다음 홉과 Hop Limit, DAD·NUD·STALE, 미실행 명령, 전체 약자와 세 오해 | Ethernet 목적지가 R이고 IPv6 목적지가 C인 것은 정상. 첫 링크의 next hop과 최종 목적지를 구별한다. |
| 8 | STP/LAG/LACP/bonding 구분, active/passive, Slow Protocols·LACPDU 필드·Key, 동기화·collecting/distributing, speed/duplex·VLAN, 원문 주소·MAC과 bond IP, A→B/C·방향별 분산, layer2/2+3/3+4·단편화 경고, 단일/다중 연결·20Gb/s 명목, 장애·min_links, 미실행 명령, 전체 약자와 세 오해 | 정상 멤버가 두 개인데 eth1만 바쁘면 송신 hash와 입력 헤더 다양성부터 확인. layer2에서 같은 gateway MAC이면 원격 IP 다양성만으로 분산되지 않는다. |
| 9 | MTU/IP/FCS·PMTU 정의, 경로/이웃/크기 분리·방향성, 원문 A–S–R1–R2–C/B 및 MTU1500/1400, DF·ICMP3/4·Next-Hop MTU·인용·재전송, Ethernet 재캡슐화, IPv4 DF0/IPv6 송신 측 단편화, MSS 계산·상대 MSS·black hole, ping 크기·-M do 로컬 거절, 미실행 명령, 전체 약자와 세 오해 | B 큰 ping 성공/C 작은 것만 성공 시 R1 출력MTU·DF→회신 ICMP·방화벽→A PMTU 및 로컬 거절 순으로 확인. |
| 10 | 정적 경로 동기·IGP·제어/데이터 평면·protocol89, neighbor/LSDB/계산/FIB/ARP, Hello·2-Way·DBD/LSR/LSU/Ack·Full, Dijkstra 비용·원문 Area0/p2p·주소/MAC·21/51, A→C와 A→B·TTL·재캡슐화, 장애 감지/LSA/SPF/FIB·수렴·손실, FRR 조회, RouterID·DR/BDR·MTU mismatch, 전체 약자와 세 오해 | Full은 해당 adjacency DB 동기화의 증거일 뿐. B LSA→SPF 결과→선택/설치 경로→next-hop MAC→반환 경로를 분리한다. |

## 주장별 근거: 실제 읽은 절과 짧은 원문 발췌

| Claim | Evidence actually read | Checked date / applicable version | Status |
|---|---|---|---|
| ND는 IPv4 ARP·Router Discovery·Redirect를 통합하며 NUD도 제공한다. | [1] rfc4861 §3.1, L770: “The IPv6 Neighbor Discovery protocol corresponds to a combination of the IPv4 protocols Address Resolution Protocol &#91;ARP&#93;, ICMP Router Discovery &#91;RDISC&#93;, and ICMP” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| IPv6 주소 확장은 32→128비트이며 주소·확장 헤더·자동 설정 배경과 연결된다. | [4] rfc8200 §1, L184: “IPv6 increases the IP address size from 32 bits to 128 bits, to support more levels of addressing hierarchy, a much greater number of address” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| RA 출발지는 송신 인터페이스의 링크 로컬 주소다. | [1] rfc4861 §4.2, L1445: “MUST be the link-local address assigned to the interface from which this message is sent. Destination Address” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Router Lifetime=0은 기본 라우터가 아니라는 뜻이지 모든 RA 정보의 무효화가 아니다. | [1] rfc4861 §4.2, L1117: “Lifetime of 0 indicates that the router is not a default router and SHOULD NOT appear on the default Narten, et al.” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| PIO L=0은 on-link/off-link에 대한 무진술이며 A 플래그와 독립적으로 해석한다. | [1] rfc4861 §4.6.2, L1648: “When not set the advertisement makes no statement about on-link or off-link properties of the prefix. In other w” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| 온링크 정보는 L=1 광고·수동 구성·Redirect 등의 근거를 얻으며 주소 할당과 분리한다. | [5] rfc5942 §3, L200: “Receipt of a valid Router Advertisement (RA) that specifies a prefix with the L-bit set. Such a prefix is considered on-link for a period sp” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| MAC 미학습 시 INCOMPLETE·solicited-node NS·대기열을 사용한다. | [1] rfc4861 §7.2.2, L3403: “this entails creating a Neighbor Cache entry in the INCOMPLETE state and transmitting a Neighbor Solicitation message targeted at the neighbor. The solicitation” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Ethernet의 IPv6 EtherType은 0x86DD다. | [3] rfc2464 §3, L73: “86DD hexadecimal. The data field contains the IPv6 header followed immediately by the payload, and possibly padd” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| NS 응답 NA는 일반적인 주소 해석과 DAD에서 목적지가 달라진다. 원고는 보통의 유니캐스트 NA와 DAD를 분리했다. | [1] rfc4861 §7.2.4, L3544: “If the source of the solicitation is the unspecified address, the node MUST set the Solicited flag to zero and multicast the advertisement to the all-node” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| DAD NS는 출발지 ::, Target=tentative 주소, 목적지=대응 solicited-node multicast다. | [2] rfc4862 §5.4.2, L762: “the IP source is set to the unspecified address, and the IP destination is set to the solicited-node multicast address of the target address.” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| 출발지가 ::인 NS에는 Source Link-Layer Address 옵션을 넣지 않는다. | [1] rfc4861 §4.3, L1251: “MUST NOT be included when the source IP address is the unspecified address. Otherwise, on link layers that have” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| STALE 첫 전송은 기존 MAC을 사용하며 DELAY→PROBE로 확인한다. STALE≠즉시 폐기다. | [1] rfc4861 §7.3.3, L3993: “the sender changes the state to DELAY and sets a timer to expire in DELAY_FIRST_PROBE_TIME seconds. If the entry is still in the D” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| MAC 기반 IID를 SLAAC의 유일한 현대 기본값으로 설명하지 않는다. | [6] rfc8064 §3, L233: “Nodes SHOULD implement and employ &#91;RFC7217&#93; as the default scheme for generating stable IPv6 addresses with SLAAC. A link layer MAY also define a mechanism fo” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Linux accept_ra=1/2의 forwarding 연계 조건을 구분한다. | [16] sysctl accept_ra, L5493: “Accept Router Advertisements if forwarding is disabled. 2 Overrule forwarding behaviour. Accept Router Advertisements even if forwarding is enabled.” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| Hop Limit 검증은 동일 링크의 악성 RA/NA를 인증하지 못한다. | [1] rfc4861 §11.1, L4413: “Router spoofing attacks. An example of denial of service attacks is that a node on the link that can send packets wit” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| bonding은 다중 인터페이스 논리화 구현이며 모든 모드가 LACP인 것은 아니다. | [15] bonding Introduction, L389: “The Linux bonding driver provides a method for aggregating multiple network interfaces into a single logical “bonded” interface. The behavior of the bonded interfaces” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| IEEE 802.3ad-2000은 2000년3월 승인됐다. | [17] ieee-ad 작업반 완료 기록, L30: “approval of IEEE 802.3ad-2000 at the March 2000 IEEE Standards Board meeting. IEEE 802.3ad-2000 is now published as part of the latest edition of 802.3 which is available for” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 802.1AX-2020은 2014판을 대체하는 본표준이다. 전체 표준 본문·후속 amendment 전체를 읽었다는 뜻은 아니다. | [20] ieee-ax 표준 개요, L9: “Link Aggregation allows parallel point-to-point links to be used as if they were a single link and also supports the use of multiple links as a resilient load-shari” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| LACPDU의 subtype·Actor/Partner 필드·Key·상태는 커널 구조체에서 확인했다. | [26] bond-header lacpdu_t, L101: “u8 subtype; /* = LACP(= 0x01) */ u8 version_number; u8 tlv_type_actor_info; /* = actor information(type/leng” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| LACPDU 목적지 MAC은 01:80:c2:00:00:02다. | [27] bond-driver lacpdu_mcast_addr, L91: “0x01, 0x80, 0xC2, 0x00, 0x00, 0x02 }; /* ================= main 802.3ad protocol functions ================== */ static int ad_lacpdu” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| Active/Passive는 협상 시작 행태이지 주선/예비선이 아니다. Passive/passive의 미시작은 양쪽 행태에서 도출한다. | [15] bonding lacp_active, L1177: “LACPDU frames acts as “speak when spoken to”. on or 1 LACPDU frames are sent along the configured links periodically. See lacp_rate for more” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| Collecting은 수신 준비, Distributing은 송신 준비다. | [21] cisco-lacp LACP Flags, L154: “ready to receive/process the frames<br> 1 = Ready to receive/process the frames \| \| Distributing \| 0 = Not ready to send/transmit th” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| Linux 802.3ad는 동일 speed/duplex 특성을 집성에 반영한다. | [15] bonding mode=802.3ad, L1425: “aggregation groups that share the same speed and duplex settings. Utilizes all slaves in the active aggregator according to the 802.3ad specificati” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 기본 layer2는 MAC·packet type 입력이 같으면 원격 여러 목적지도 한 멤버에 몰릴 수 있다. | [15] bonding xmit_hash_policy / layer2, L1817: “Uses XOR of hardware MAC addresses and packet type ID field to generate the hash. The formula is hash = source MAC&#91;5&#93; XOR destination MAC&#91;5&#93; XOR packet” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 일반 layer3+4도 단일 연결의 멤버 합산을 제공하지 않는다. | [15] bonding xmit_hash_policy / layer3+4, L1883: “although a single connection will not span multiple slaves. The formula for unfragmented TCP and UDP packets is hash = source port, destin” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 단편화·비단편화 혼재 시 포트 유무에 따른 재정렬 위험을 공식 문서가 경고한다. | [15] bonding xmit_hash_policy / layer3+4, L1909: “This algorithm is not fully 802.3ad compliant. A single TCP or UDP conversation containing both fragmented and unfragmented packets will see pack” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| fast는 상대에게 1초 주기 전송 요청, slow는30초 요청이다. 서비스 복구시간과 동일시하지 않는다. | [15] bonding lacp_rate, L1217: “Request partner to transmit LACPDUs every 1 second The default is slow. broadcast_neighbor Option specifying whether to broadcast ARP/ND” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| min_links는 bond carrier를 주장할 최소 활성 멤버 수를 정한다. | [15] bonding min_links, L1276: “Specifies the minimum number of links that must be active before asserting carrier. It is similar to the Cisco EtherChannel min-links feature. This allows setting t” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 독립된 두 스위치에 일반 LAG를 임의로 걸치지 말라는 권고는 단일 peer 집성과 다중 스위치 가용성의 차이에서 도출했다. 특정 MLAG 제품은 미검증. | [15] bonding §11.2, L3815: “In multiple switch topologies, there is a trade off between network availability and usable bandwidth. Below is a sample network, configu” | 2026-10-17 / 조회 시점 공식 문서·소스 | 추론 |
| IP MTU는 IP 헤더·데이터를 포함하고 하위 계층 헤더는 포함하지 않는다. | [7] rfc1191 §4, L337: “The size includes the IP header and IP data, and does not include any lower-level headers. Mogul & Dee” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| 고전 IPv4 PMTUD는 DF=1로 시작해 too-big 오류에 따라 경로 추정치를 낮춘다. | [7] rfc1191 §2, L136: “the (known) MTU of its first hop, and sends all datagrams on that path with the DF bit set. If any of the datagrams are too l” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| IPv4 오류는 Type3/Code4와 Next-Hop MTU 및 원래 패킷 인용을 포함한다. | [7] rfc1191 §4, L325: “\| Type = 3 \| Code = 4 \| Checksum \| +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| IPv6 최소 링크 MTU1280, 더 작은 하부 링크는 IPv6 아래 계층에서 처리해야 한다. | [4] rfc8200 §5, L1378: “IPv6 requires that every link in the Internet have an MTU of 1280 octets or greater. This is known as the IPv6 minimum link MTU. On any link that cannot conv” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| IPv6 source fragmentation은 가능하지만 라우터 fragmentation과 다르다. | [4] rfc8200 §5, L1408: “fragment the packet at the source and have it reassembled at the destination(s). However, the use of such fragmentation is dis” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| PMTU의 경로 표현은 목적지·인터페이스·흐름 및 ECMP에 따라 구현 선택이 필요하다. | [8] rfc8201 §5.2, L515: “In the case of multipath routing (e.g., Equal-Cost Multipath Routing (ECMP)), a set of paths can exist even for a sing” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| PLPMTUD는 ICMP 없이 작은 패킷부터 더 크게 probe하는 방식이다. | [9] rfc4821 §1, L123: “In the absence of ICMP messages, the proper MTU is determined by starting with small packets and probing with successively large” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| 데이터그램 DPLPMTUD는 목적지의 probe 수신 피드백이 필요하다. UDP 자체만으로 완성되지 않는다. | [10] rfc8899 §3, L509: “The destination PL endpoint is REQUIRED to provide a feedback method that indicates to the DPLPMTUD sender when a probe packet h” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Linux TCP probing 0/1/2 의미를 구분하며 UDP 전체 기능으로 확대하지 않는다. | [16] sysctl tcp_mtu_probing, L1687: “1 - Disabled by default, enabled when an ICMP black hole detected 2 - Always enabled, use initial MSS of tcp_base_mss. tcp_probe_interval - UNSIGNED INTEGER” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| ping -M do는 DF 설정뿐 아니라 기존 커널 PMTU 검사도 받는다. | [19] ping -M pmtudisc_option, L499: “subject to PMTU checks by kernel, packets too large will be rejected), want (do PMTU discovery, fr” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| 호스트 skb와 실제 선로 크기는 offload로 달라질 수 있으므로 관측 지점을 대조하라는 진단 권고다. | [24] offloads TSO/GSO/GRO, L30: “TCP segmentation allows a device to segment a single frame into multiple frames with a data payload size specified in skb_shinfo()->gso_size. When TCP segmentation requeste” | 2026-10-17 / 조회 시점 공식 문서·소스 | 추론 |
| 2015년 사례는 ICMP를 원래 flow 처리 서버에 도달시키는 내부 전달 문제를 공개했다. 현재 전사 설정으로 일반화하지 않는다. | [18] cloudflare Our solution: PMTUD, L1028: “no matter where the ECMP router decides to forward it. We're happy to open source our small "Path MTU Daemon" that does the work: https://github.com/cloud” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| OSPF의 link-state 배경으로 ARPANET·IS-IS와 IETF 작업반의 확장을 명시한다. | [11] rfc2328 §1.3, L530: “The first link-state routing protocol was developed for use in the ARPANET packet switching network. This protocol is described in &#91;Ref3&#93;. It ha” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| OSPFv2는 IP protocol89이며 TCP/UDP port89가 아니다. | [11] rfc2328 Appendix A.1, L9270: “OSPF is IP protocol number 89. This number has been registered with the Network Information Center. IP protocol number” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Hello 마스크 검사에는 p2p·virtual-link 예외가 있다. timer·area·인증·옵션 조건도 나누어 본다. | [11] rfc2328 §10.5, L11066: “On point-to-point networks and virtual links, the IP interface mask is not defined. On these” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| Neighbor와 adjacency는 다르며 공유 LAN의 DROther끼리 2-Way가 정상일 수 있다. | [11] rfc2328 §10.1, L4125: “Not every two neighboring routers become adjacent (see Section 10.4). The adjacency starts to form when the neighbor is in state ExS” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| DBD Interface MTU가 수신 가능 크기를 넘으면 거절되어 Hello 이후에도 DB 동기화가 막힐 수 있다. | [11] rfc2328 §10.6, L4927: “the Database Description packet is rejected. Otherwise, if the neighbor state is: Down The packet should be reject” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| LSA 식별과 최신성 판별은 packet 종류나 단순 마지막 수신 시간과 다르다. | [11] rfc2328 §13.1, L7268: “An LSA is identified by its LS type, Link State ID and Advertising Router. For two instances of the same LSA, the LS sequence number, LS” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| SPF는 자신을 루트로 방향 그래프의 영역 내 최소 비용 경로를 계산한다. | [11] rfc2328 §16.1, L8030: “A router calculates the shortest-path tree using itself as the root.&#91;22&#93; The formation of the shortest path” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| FRR reference bandwidth 기본100Mbit/s 설명을 읽었으며 고속 링크 cost1 집중 가능성을 설명했다. 동일 domain의 일관성 요구도 확인. | [14] frr auto-cost reference-bandwidth, L222: “the default is 5 seconds (5000 milliseconds) consistent with the architectural constant MinLSInterval specified” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| Router ID는 실제 인터페이스 IP일 필요 없고 domain 안에서 고유해야 한다. | [14] frr ospf router-id, L99: “it can be any arbitrary 32bit number. However it MUST be unique within the entire OSPF domain to the OSPF speaker - bad thi” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| OSPF 계산 표와 커널 실제 경로를 별도 조회한다. | [14] frr show ip ospf route, L1202: “Show the OSPF routing table, as determined by the most recent SPF calculation. When detail option is used, it shows more information to the CLI like advertisin” | 2026-10-17 / 조회 시점 공식 문서·소스 | 확인 |
| RFC5340은 RFC2740을 대체한2008년 IPv6 OSPFv3 표준이다. | [12] rfc5340 Abstract, L192: “This document describes the modifications to OSPF to support version 6 of the Internet Protocol (IPv6). The fundamental mechanisms of OSPF (flooding, Designated” | 2026-10-17 / 고정 RFC 발행본 | 확인 |
| OSPFv3에는 IPv4를 포함한 AF 확장이 있으므로 IPv6 전용이라는 단정은 부정확하다. | [13] rfc5838 §1, L91: “including multicast IPv6, unicast IPv4, and multicast IPv4. This document supports these other AFs in OSPFv3 by mapping each AF to” | 2026-10-17 / 고정 RFC 발행본 | 확인 |

## 산술과 실패 경계 검수

- Python으로 2×10=20, 1400−20−20=1360, 1400−40−20=1340, 1472+8+20=1500, 1372+8+20=1400, 10+10+1=21, 50+1=51을 확인했다. 이는 설명용 수치 계산이지 측정 결과가 아니다.
- 4개 확인 질문의 답변은 원고 본문에 각각 **원문 확인 질문** 라벨로 존재한다. 별도로 질문과 답변의 문맥도 다시 확인했다.
- 원문의 IP/MAC·prefix·MTU·cost 식별자는 정정 없이 보존했다. 표에서 하위 네트워크를 합쳐 적었지만 노드 역할은 바꾸지 않았다.
- 원고의 선택표·best practice는 문서화된 기능과 실패 조건에서 도출한 권고다. LACP 복구 초 단위 수치, OSPF 수렴 시간, 특정 소프트웨어 처리량을 실측값처럼 추가하지 않았다.

## 정정·보충 및 미확인

1. **온링크 판단:** 원문 L/A 독립 설명은 맞다. 추가로 L=0≠명시적 off-link이며 과거 on-link 정보를 즉시 지우는 신호가 아니라는 RFC4861/5942 조건을 넣었다.
2. **SLAAC 주소 생성:** RFC2464의 오래된 MAC/EUI 방식만을 현대 유일 기본값처럼 가르치지 않도록 RFC8064의 안정적 IID 권고를 보충했다.
3. **LACP 표준명:** Linux 옵션명 802.3ad는 유지되지만 IEEE 표준 계열은802.1AX로 읽어야 한다. 2020 본표준 개요에 후속 amendment가 연결돼 있으므로 ‘2020 이후 개정 없음’이라는 주장은 하지 않았다.
4. **Cisco LACP Flags 원문 주의:** 확인한 Cisco 페이지의 Expired 행은 `0=PDU expired, 1=PDU valid`로 표시되어 아래 비트 예시/상태 이름과 직관적 의미가 충돌한다. 원고는 이 행을 채택하지 않고 직접 일치가 확인되는 Collecting·Distributing만 사용했다. 같은 페이지의 `0x3D`를 모든 active/passive·timeout 조합의 유일 정상값이라고 일반화하지 않았다.
5. **MSS 옵션/실제 데이터 크기:** 실제 송신 데이터 길이는 옵션을 빼야 한다. 보충 열람한 RFC6691 §2는 SYN에 광고할 MSS 옵션 계산에서는 고정 헤더만 빼고, 실제 전송에서는 포함한 옵션만큼 데이터를 줄이라고 구분한다. 원고의 1360/1340은 기본 헤더·옵션 없음 조건의 산술이므로 이를 상대가 항상 광고해야 할 MSS라고 읽으면 안 된다.
6. **OSPF 영역 범위:** 같은 area의 관련 LSDB가 수렴 뒤 일관된다는 범위를 명시했다. 다중 영역 모든 라우터의 모든 LSDB가 동일하다는 단정은 배제했다. Router ID는 고유32비트 값이며 전달용 IP와 구별했다.
7. **OSPFv3 범위:** v2 IPv4/v3 IPv6라는 입문 구분에는 RFC5838 AF 확장 예외가 있다. 이번 패킷 예시는 v2/IPv4/Area0만 다룬다. OSPFv3 인증 확장의 현행 전부를 조사하지 않았다.
8. **실제 환경 미검증:** Linux/FRR 실제 설치 버전, 장치 이름, 배포판 sysctl 기본값, hash 분산량, 수렴 시간, 터널별 정확한 overhead, NIC offload 시의 실캡처와 실패 복구는 미확인. 명령은 전부 미실행이다.
9. **빅테크 사례 한계:** 날짜가 특정된 Cloudflare2015 PMTUD 사례만 실제 기업의 공개 장애·대응으로 인용했다. Cisco 자료는 공식 테스트/운영 가이드이지 특정 빅테크의 production 배포 증거가 아니다. NDP/LACP/OSPF의 특정 회사 현재 사례·규모·선택 이유는 이 조사에서 확인하지 못해 지어내지 않았다.
10. **네트워크 조회의 장애:** 최초 HTML 처리에서 bs4 미설치가 발견되어 표준라이브러리 HTMLParser로 대체했다. IEEE/Cisco 직접 urllib403은 web_extract 본문으로 보완했다. GitHub raw 후속 조회에서429가 발생했으나 bond_3ad.h/c는 web_extract로 중요한 본문을 읽고 보관했다. if_ether.h는 초기 web_extract가 전체 상수·구조체를 반환했으며 후속 실패 시 새 내용을 추정하지 않았다. 중요 상수 `ETH_P_SLOW=0x8809`와 `ETH_P_IPV6=0x86DD`는 그 초기 정상 도구 결과에서 확인했다. 일부 web_extract 저장본은 추출기의 길이 제한을 포함하므로 파일 보존만으로 전체 소스를 읽었다고 주장하지 않는다.

## 자료 보관과 부모 병합 안내

- `sources-a/manifest.json`: 요청 URL·직접 다운로드 결과와 파일 경로. IEEE/Cisco 대체 경로를 기록했다. GitHub raw 후속429는 실제 발생 기록으로 남겼다.
- `sources-a/*.txt`: 다운로드된 RFC/공식 문서 또는 도구 추출본. 전체 RFC는 고정 발행본, rolling 문서는 조회 시점 스냅샷이다.
- `citations-a.json`: 이 shard 전용 인용 ledger. 숫자 ID는 이 evidence 문서 내부용이며 다른 shard 숫자와 병합하지 않는다. `part-a.md`는 충돌을 피하려고 의미 있는 원문명+직접 URL 인라인 링크를 사용했다.
- `fetch-a.py`, `audit-a.py`, `make-evidence-a.py`: 수집·형식 검수·literal quote 검증용 보조 스크립트. 네트워크 실습이나 환경 변경은 수행하지 않는다.
- 부모가 D3를 붙일 자리에는 각 절의 패킷 경로·상태 설명이 텍스트 fallback으로 남아 있다. 이 shard는 repo 파일·commit·publication을 만들지 않았다.

## Sources

[1] https://www.rfc-editor.org/rfc/rfc4861.txt — rfc4861
[2] https://www.rfc-editor.org/rfc/rfc4862.txt — rfc4862
[3] https://www.rfc-editor.org/rfc/rfc2464.txt — rfc2464
[4] https://www.rfc-editor.org/rfc/rfc8200.txt — rfc8200
[5] https://www.rfc-editor.org/rfc/rfc5942.txt — rfc5942
[6] https://www.rfc-editor.org/rfc/rfc8064.txt — rfc8064
[7] https://www.rfc-editor.org/rfc/rfc1191.txt — rfc1191
[8] https://www.rfc-editor.org/rfc/rfc8201.txt — rfc8201
[9] https://www.rfc-editor.org/rfc/rfc4821.txt — rfc4821
[10] https://www.rfc-editor.org/rfc/rfc8899.txt — rfc8899
[11] https://www.rfc-editor.org/rfc/rfc2328.txt — rfc2328
[12] https://www.rfc-editor.org/rfc/rfc5340.txt — rfc5340
[13] https://www.rfc-editor.org/rfc/rfc5838.txt — rfc5838
[14] https://raw.githubusercontent.com/FRRouting/frr/master/doc/user/ospfd.rst — frr
[15] https://docs.kernel.org/networking/bonding.html — bonding
[16] https://docs.kernel.org/networking/ip-sysctl.html — sysctl
[17] https://www.ieee802.org/3/ad — ieee-ad
[18] https://blog.cloudflare.com/path-mtu-discovery-in-practice — cloudflare
[19] https://man7.org/linux/man-pages/man8/ping.8.html — ping
[20] https://standards.ieee.org/ieee/802.1AX/6768 — ieee-ax
[21] https://www.cisco.com/c/en/us/support/docs/switches/catalyst-9300-series-switches/220367-troubleshoot-etherchannels-on-catalyst-9.html — cisco-lacp
[24] https://docs.kernel.org/networking/segmentation-offloads.html — offloads
[26] https://raw.githubusercontent.com/torvalds/linux/master/include/net/bond_3ad.h — bond-header
[27] https://raw.githubusercontent.com/torvalds/linux/master/drivers/net/bonding/bond_3ad.c — bond-driver
