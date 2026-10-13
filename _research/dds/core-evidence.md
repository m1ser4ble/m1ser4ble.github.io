# DDS 핵심 글 근거 기록

확인일: 2026-10-13. 웹 근거는 원문 페이지를 열어 관련 절을 직접 확인했다. 제품 문서는 최신 2.x 문서(열람 당시 2.14.7)이며, 프로젝트 기록은 Fast DDS 2.11.2의 2026-10-09 실행 결과다. 둘을 같은 버전의 실행 근거로 취급하지 않는다.

| Claim / 사용 위치 | 실제 열람한 근거와 절 | 버전·확인일 | 상태 |
|---|---|---|---|
| DDS는 DCPS data-centric publish-subscribe, Topic/type으로 데이터 공간을 식별하며 API와 통신 의미를 규정한다. 기본 글/가이드 | [OMG DDS 1.4 PDF](https://www.omg.org/spec/DDS/1.4/PDF), §1.1, PDF pp. 2–3, §2.1 | Formal 1.4, 2015-03 카탈로그 표기, 열람 2026-10-13 | 확인 |
| 이전 NDDS/Splice 제품은 기능이 있었지만 proprietary interface/behavior였고 DDS 표준은 앱 이식성을 목적으로 했다. 기본 글 | [OMG DDS 1.4](https://www.omg.org/spec/DDS/1.4/PDF), §1.1 | 1.4 문서의 역사 설명, 열람 2026-10-13 | 확인 |
| DDS API portability와 vendor 간 wire protocol interoperability는 별도 문제이며 DDSI-RTPS가 wire protocol을 다룬다. 기본 글·Discovery | [OMG DDS 1.4](https://www.omg.org/spec/DDS/1.4/PDF), §1.1; [OMG DDSI-RTPS catalog](https://www.omg.org/spec/DDSI-RTPS/2.5/PDF) | OMG 표준 catalog 열람 2026-10-13 | 확인 |
| OMG formal-version 연표: DDS 1.0 2004-12, 1.1 2005-12, 1.2 2006-12, 1.4 2015-03. 기본 글 | [OMG DDS catalog](https://www.omg.org/spec/DDS/) 및 [DDS 1.0 specification record](https://www.omg.org/spec/DDS/1.0/), History / Formal Versions | Catalog pages opened 2026-10-13 | 확인; formal 표준 판본 채택일만 설명 |
| Fast DDS SIMPLE discovery는 participant 단계 및 endpoint discovery 단계로 구성되며 기본 multicast 발견이 있다. Discovery 글 | [Fast DDS discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/discovery.html); [SIMPLE discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/simple.html) | Fast DDS 2.14.7 docs, 열람 2026-10-13 | 확인 |
| Discovery Server는 발견 정보 전달 구조이며 DDS user-data broker로 서술하지 않는다. Discovery 글 | [Fast DDS Discovery Server](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/discovery_server.html), architecture/communication sections | Fast DDS 2.14.7 docs, 열람 2026-10-13 | 확인 |
| 기본 RTPS well-known port mapping 예: PB=7400, DG=250, PG=2, d0=0, d1=10, d2=1, d3=11로 도메인 0/index 0의 7400/7410/7411 값을 도출. Discovery 글 | [OMG DDSI-RTPS](https://www.omg.org/spec/DDSI-RTPS/2.5/PDF), §9.6.2.3 Default Port Numbers (and §9.6.2.1–2 locator expressions), official OMG catalog PDF opened; section 9.6.2.3 located | RTPS standard mapping; 열람 2026-10-13 | 확인; 값은 해당 상수/participant index 조건부 |
| DDS Domain ID·Topic 이름은 IP address/port나 신원 인증이 아니다. Basics·Discovery | [Fast DDS definitions](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/getting_started/definitions.html); [Fast DDS discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/discovery.html); local note `dds-domain.md` reviewed | Fast DDS 2.x; note 2026-10-13 | 확인/추론: 네트워크 보안 결론은 설정 의미에서 도출 |
| QoS History depth는 유지 history sample bound이고, Reliable은 Reader confirmation 및 Writer history 재전달을 수행하려고 한다. QoS 글 | [Fast DDS standard policies](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html), §History, §Reliability | Fast DDS 2.14.7, 열람 2026-10-13 | 확인 |
| Deadline 갱신 간격 감시는 keyed Topic에서 key별 적용이며 OS callback 정확 시각 또는 업무 완료 보장이 아니다. QoS 글 | [Fast DDS standard policies](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html), §Deadline; local note `concepts/dds-qos.md` | Fast DDS 2.14.7, 열람 2026-10-13 | 확인; CPU·앱 경계는 분리된 개념 설명 |
| Fast DDS Liveliness는 active entity 판정에 쓰이고, listener로 liveliness loss를 통보할 수 있다. QoS 글 | [Fast DDS Liveliness API](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/api_reference/dds_pim/core/policy/livelinessqospolicy.html) | Fast DDS 2.14.6 API (문서 page), 열람 2026-10-13 | 확인 |
| Reader history 및 QoS 정책 설명은 특정 구현체 문서 버전임을 표시했다. QoS 글 | [Fast DDS 2.14.7 policies](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html); [Fast DDS 2.14.7 catalog page](https://fast-dds.docs.eprosima.com/en/2.14.x/fastdds/dds_layer/core/policy/standardQosPolicies.html) | 2.14.7, 열람 2026-10-13 | 확인; 프로젝트 2.11.2의 동일 동작 근거로 사용하지 않음 |
| ROS 2가 DDS 미들웨어 후보를 사용하게 된 설계 선택 근거와 구현 다양성 | [ROS on DDS](https://design.ros2.org/articles/ros_on_dds.html), design rationale | ROS design article, 열람 2026-10-13 | 확인; ROS 2가 DDS만을 쓰는 현행 보편 claim으로 확장하지 않음 |
| NASA Astrobee 사용자 문서에서 일부 ROS 데이터를 DDS 메시지로 지상 전달 | [NASA Astrobee Guest Science Guide](https://www.nasa.gov/wp-content/uploads/2017/12/irg-ff029-astrobee-guest-science-guide.pdf), DDS/ROS communication sections | Guide PDF, 열람 2026-10-13 | 확인; 시스템 전체 DDS라고 확대하지 않음 |
| 실습 환경: ROS-free C++ 3 process, Fast DDS 2.11.2, Docker Linux VM, 179 unit checks, 20 integration PASS (2026-10-09) | Canonical wiki readonly `test-results.md`, `architecture.md`, `concepts/dds-qos.md`; contract-pinned project facts | 실행일 2026-10-09 | 기록상 확인; 현 시점 재실행 결과 아님 |
| 현 프로젝트는 deadline/liveliness QoS와 앱의 500ms stale 및 3-sample recovery를 분리한다. QoS 글 | Canonical wiki readonly `concepts/dds-qos.md`, `test-results.md` | Fast DDS 2.11.2 / tests 2026-10-09 | 프로젝트 노트/실행 기록상 확인 |
| 공개 사례로부터 일반 산업의 배포 규모, 성능, 모든 하드웨어 범위를 유추하지 않는다. | OMG standard use-case wording; NASA guide scope; ROS design article | 열람 2026-10-13 | 자료 범위 경계; 사례 규모/성능 주장은 미확인 |

## 미확인 또는 제한

- Formal DDS 1.0–1.4 판본의 채택일은 OMG 공식 연표에서 확인했다. 공식 연표는 pre-formal 연구·발명 시작일이나 최초 제품 출시일을 말하지 않으므로 이를 기사에서 추정하지 않았다.
- DDSI-RTPS 최신 specification PDF의 section 9.6.1 mapping을 확인했지만, 배포 제품의 runtime port는 transport 및 vendor 설정에서 달라질 수 있다. 기사에는 기본 mapping 산출 예로 한정했다.
- 특정 빅테크의 DDS 생산 배치 규모나 벤치마크에 대한 신뢰할 만한 공개 근거는 확보하지 못했다. 제조사·공공기관이 공개한 구체 범위의 사례만 언급했다.
- Fast DDS 2.14.7 문서 내용은 프로젝트가 실행한 Fast DDS 2.11.2의 실행 증거가 아니다. 2.11.2에서 모든 정책 동작을 재확인한 것은 아니다.
- 새 멀티호스트, NAT, 물리 CAN/RS-422, DDS Security, Persistence, Linux RT 또는 GVA/LOSA compliance 시험을 수행하지 않았다.
