# 범위·검증 장부

- 원문: 2026-10-17 KST에 Discord REST API로 실제 조회. 부모 채널 최근 메시지에서 7일차~최신 18일차를 발견하고 모든 해당 스레드를 페이지 끝까지 조회했다.
- 7~18일차 연속성: 12개, 중복/누락 없음. 원본 메시지 48개(학습 본문, 사용자 추가 질문, 응답, 도구 알림 포함). 도구 알림을 포스트 내용으로 옮기지 않았다.
- 최신 저장소: db6b12d2c445bc90e6e19c0a34d1df7500bb5098까지 ff-only pull 후 skills/drd/SKILL.md 273줄 전체와 CLAUDE.md 확인.
- raw Discord 응답은 로컬 연구 작업공간에만 보관. 이 저장소에는 공개 원문 링크와 기술적 근거 장부만 추가.
- 7~10: 주소/경로/이웃·RA L/A·NS/NA·DAD/NUD, LACPDU·Actor/Partner/Key·C/D·hash/min_links, MTU/PMTU·DF/ICMP/MSS·blackhole·확인 질문, OSPF 이웃·LSDB·SPF·DR/BDR·cost·MTU·수렴·확인 질문 반영.
- 11~14: BGP 약자·정책·AS_PATH/LOCAL_PREF·세션/경로/설치, VRRP VIP/MAC/FDB·timers·upstream/state, VXLAN 모든 추가 Q&A(VNI/VLAN·VTEP·flood 범위·239/8·L2/L3 multicast·inner/outer), EVPN 모든 추가 Q&A(원래 배경·왜 BGP·누가 광고·운반과 위치 공유), RT/RD·Type2/3·suppression·BUM·확인 질문 반영.
- 15~18: symmetric/asymmetric IRB·L2/L3VNI·VRF/RMAC·anycast·TTL·Type5, ECMP next-hop/hash/entropy/remap, BFD 비동기·ports/TTL·타이머 방향·연동, RIB/FIB/NHT·재귀·이웃 구분·중간 경로·각 확인 질문 반영.
- D3 SVG 12개: 각각 일차별 동작 설명 주변에 배치. 외부 D3 스크립트 1회. 각 패널에 클릭/키보드 인터랙션 및 본문 fallback.
- 수치 계산: 21/51 OSPF cost, 20Gb/s 명목합, PMTU1400/TCP1360, ping1500/1400, VXLAN1550/1450, VRRP3.609375초, BFD300/900/500ms를 Python으로 확인. 실측으로 표기하지 않음.
- 네트워크 구성/캡처/장애 주입은 실행하지 않음. 본문의 관측명령은 미실행. 실제 수행한 검증은 문헌·문서 렌더링·웹 인터랙션·게시 배포 검증임.

- 7일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1556803951721054420
- 8일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1557166467781238814
- 9일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1557528897715961930
- 10일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1557891135207120996
- 11일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1558253603188379688
- 12일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1558615918068637758
- 13일차 (10개 메시지): https://discord.com/channels/1518629139190648923/1558978191891243028
- 14일차 (8개 메시지): https://discord.com/channels/1518629139190648923/1559340547351781448
- 15일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1559703023314280598
- 16일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1560065658589282415
- 17일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1560427935708618842
- 18일차 (3개 메시지): https://discord.com/channels/1518629139190648923/1560790033554866369
