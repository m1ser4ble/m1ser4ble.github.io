---
layout: single
title: "DDS 이력·Persistence와 재시작 뒤 무엇을 복구하는가"
date: 2026-10-13 00:00:00 +0900
categories: [system]
excerpt: "DDS History와 Durability는 제한된 샘플 이력을 다루며, Fast DDS Persistence와 애플리케이션 업무 완료 기록은 서로 다른 복구 계층이다."
tags: [dds, persistence, recovery]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
knowledge_id: dds-history-persistence
knowledge_links: [dds-guide, dds-qos, dds-fault-diagnosis, dds-security]
series: dds
permalink: /dds/history-persistence/
toc: true
toc_sticky: true
---

**DDS 이력은 Writer와 Reader가 보유하는 샘플의 제한된 집합이고, Persistence Service는 설정한 Writer 이력의 재시작 복원을 돕는다. 둘 다 애플리케이션이 업무를 완료했다는 기록은 아니다.** 이 구분을 놓치면 재생된 옛 센서 상태를 현재 사실로 믿거나, 장비 명령을 중복 실행할 수 있다.

이 글의 제품별 설정은 프로젝트에서 사용한 Fast DDS **2.11.2** 문서를 기준으로 한다. 최신 3.x 문서가 같은 이름의 정책을 더 설명하더라도 그 내용을 2.11.2 동작으로 소급하지 않는다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=history-persistence" title="DDS Writer 이력, Persistence, Reader 진행 상태와 앱 완료 기록의 차이" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

> 위 애니메이션은 Writer 이력·저장 파일·Reader 통지 상태·업무 commit을 분리해 보여주는 설명용 모형이다. 실제 패킷 캡처나 성능 측정이 아니다. JavaScript를 쓸 수 없어도 핵심은 같다. 살아 있는 Writer의 history, SQLite에 저장된 복원 재료, Reader가 마지막으로 통지받은 change, 업무 DB의 처리 완료 표시는 서로 다른 상태다.

## 먼저 용어를 분리하자

| 용어 | 답하는 질문 | 보장하지 않는 것 |
|---|---|---|
| History | 아직 전달·소비할 샘플 중 얼마를 기억할까? | 무제한 보존, 앱의 처리 완료 |
| Reliability | Reader가 요청한 샘플 전달을 어떻게 재시도할까? | 유한한 저장 한도를 넘은 모든 샘플, deadline, exactly-once 업무 처리 |
| Durability | 늦게 매칭한 Reader에게 과거 샘플을 제공할까? | Writer 종료 뒤 영속 보존 자체 |
| Persistence Service | 재시작 경계를 넘어 설정된 DDS 상태를 저장소에서 되살릴까? | 전체 앱 메모리·DB transaction·장비 실제 상태 |
| 업무 commit/checkpoint | 앱이 특정 이벤트를 처리하고 결과를 기록했는가? | DDS 정책이 대신 기록해 주지 않음 |

예를 들어 10Hz 자세 샘플에 `KEEP_LAST(5)`를 쓰면 한 instance의 최근 다섯 샘플 이력을 관리한다. 이는 0.5초를 정확히 보장한다는 뜻은 아니다. 발행 간격의 흔들림, 한도, sample 수명과 구현 상태가 영향을 준다. `KEEP_ALL`도 메모리와 ResourceLimits의 한계를 없애지 않는다. [Fast DDS 2.11.2 History 정책](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/dds_layer/core/policy/standardQosPolicies.html#historyqospolicy)

## 왜 이력이 필요한가

분산 시스템에서는 Publisher가 쓴 때와 Subscriber가 읽는 때가 다르다. Reader가 잠깐 느려지거나 늦게 시작하면 최근 값을 받을 필요가 있지만, 모든 과거 이벤트를 무기한 저장해야 하는지는 별도 문제다. DDS는 중앙 broker를 필수로 두지 않아도 Writer/Reader의 history와 QoS로 보관·재전달 조건을 정한다.

OMG DDS 표준 1.0은 2004년 12월 정식 판본으로 등록되어 있고, DDS 표준은 1.4까지 발전했다. DDS Security는 별도 명세 계열로 1.0이 2016년 8월에 정식 채택됐다. 이 글은 DDS 역사 전체를 반복하기보다 현재 관심사인 history 및 persistence 동작에 한정한다. [OMG DDS 1.0 이력](https://www.omg.org/spec/DDS/1.0/) · [OMG DDS 1.4](https://www.omg.org/spec/DDS/1.4/)

## 늦은 Reader와 Writer 재시작은 다르다

새 Reader가 살아 있는 Writer와 매칭될 때 과거 이력을 받아야 한다면 호환되는 Durability와 `RELIABLE`을 검토한다. 2.11.2 문서는 late-joiner 과거 샘플에 `RELIABLE`이 필요하다고 명시한다. `TRANSIENT_LOCAL` 이력은 Writer가 살아 있는 동안 유지된다. Writer가 프로세스와 함께 사라지면 이 메모리 이력도 함께 끝난다. QoS 매칭 규칙도 양쪽 설정을 확인해야 한다. [Durability와 Reliability](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/dds_layer/core/policy/standardQosPolicies.html#durabilityqospolicy)

Writer 종료 뒤 재시작까지 이력을 가져가려면 그 다음 계층인 Persistence Service가 필요하다. Fast DDS 2.11.2의 설정 예는 `TRANSIENT_DURABILITY_QOS`, `dds.persistence.guid`, persistence plugin을 구성한다. 내장 SQLite plugin은 지정한 로컬 DB 파일을 사용한다. 2.11.2 문서는 이 persistence 동작이 `TRANSIENT`에서 효과가 있다고 설명하며, `PERSISTENT_DURABILITY_QOS`는 미구현으로 표기한다. `DurabilityServiceQosPolicy`도 해당 판본에서 미구현이다. [Fast DDS 2.11.2 Persistence Service](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/persistence/persistence.html) · [2.11.2 QoS 정책](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/dds_layer/core/policy/standardQosPolicies.html#durabilityserviceqospolicy)

최신 3.x 계열 문서는 `TRANSIENT`와 `PERSISTENT` Durability를 기술한다. 이는 문서가 다루는 판본의 차이다. 설치된 라이브러리 버전, 빌드 옵션, persistence plugin, 실제 QoS 호환 여부를 함께 확인해야 한다. 버전 번호가 다른 문서를 섞어 설정하면 컴파일 성공만으로 의미가 같다고 판단할 수 없다. [현재 Persistence 문서](https://fast-dds.docs.eprosima.com/en/latest/fastdds/persistence/persistence.html) · [현재 Durability 정책](https://fast-dds.docs.eprosima.com/en/3.x/fastdds/dds_layer/core/policy/standardQosPolicies.html#durabilityqospolicy)

## 저장된 것이 곧 앱의 상태는 아니다

Fast DDS 문서는 DataWriter의 history를 DB에 보관해 Writer 생성 시 읽어올 수 있다고 설명한다. DataReader를 persistence 설정할 수도 있지만, 저장 대상은 **Reader 전체 샘플 history가 아니라 Writer별 마지막으로 통지받은 change 상태**다. 애플리케이션이 해당 change를 실제 업무 처리하고 commit했는지를 뜻하지 않는다. 앱은 `on_data_available`에서 샘플을 받았어도 DB 기록 전에 죽을 수 있고, 반대로 업무 기록이 끝난 뒤 DDS의 진행 상태가 아직 정리되지 않을 수도 있다.

따라서 복구 상태는 최소 네 갈래로 따로 생각한다.

```text
Writer history ── DDS 재전송·late join ──► Reader에 통지
      │                                      │
      └─ Persistence DB에 저장                └─ Reader 마지막 통지 상태
                                                   │
                                                   └─ 앱이 처리하고 commit했는지는 별도 기록
```

구체적 예를 들면 `command_id=C42` 명령이 장비에 실행됐으나 응답이 끊겼다고 하자. DDS 샘플이 재시작 뒤 다시 보이는 것은 장비가 실행했는지, 앱이 결과를 저장했는지를 결정하지 않는다. command ID를 기준으로 장비 상태를 조회하거나 중복 실행이 안전한 멱등 규칙을 둬야 한다. 확인할 수 없는 결과는 성공으로 추정하지 않고 불확정 상태로 격리한다. 이는 DDS 정책의 문구가 아니라 샘플 전달과 외부 부작용 사이의 경계에서 나오는 설계 결론이다.

## 재생된 값의 freshness

Persistence는 옛 값을 되살릴 수 있으므로 재시작 직후 복원된 `HEALTHY`가 현재 센서 건강을 뜻한다고 단정하면 안 된다. 예를 들어 10:00에 저장된 정상 상태가 10:02에 복구되어도, 센서가 10:01에 끊겼는지 저장된 값만으로 알 수 없다. 앱은 복원값을 이력으로 표시하고 새 측정의 sequence·세션·validity와 수신 age를 확인한 뒤 usable 상태로 바꾸는 편이 안전하다.

`Lifespan`은 DDS history 및 cache의 샘플 유효 기간을 제한하지만, 앱이 이미 복사해 둔 `last_value`를 자동으로 지우지 않는다. source timestamp도 자동으로 실제 센서 측정 시각이 되지 않는다. 앱이 호출한 `write()` 시각일 수도 있으므로, 센서 측정시각을 신뢰해야 한다면 타입과 시간 동기화 정책을 별도로 설계한다. [2.11.2 Lifespan](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/dds_layer/core/policy/standardQosPolicies.html#lifespanqospolicy)

## 선택 기준과 대안

| 필요한 동작 | 먼저 고려할 것 | 적합하지 않은 경우 |
|---|---|---|
| 최신 상태만 전달하고 재접속 Reader가 현재 값을 받음 | `TRANSIENT_LOCAL` + 작은 `KEEP_LAST` + `RELIABLE` | Writer 재시작 이후도 복원해야 할 때 |
| 최근 Writer 이력을 프로세스 재시작 후 복원 | 해당 Fast DDS 판본의 Persistence Service 및 저장소 | 노드·디스크 전체 손실, 장기 이벤트 감사까지 필요할 때 |
| 누락된 모든 업무 이벤트를 장기간 재생 | 별도 event log/journal, offset과 retention | 단순 latest-state DDS history만으로 충분하다고 볼 때 |
| 명령 실행 및 결과의 업무적 완료를 복구 | command ledger, idempotency key, 장비 상태 재조회 | DDS ACK를 업무 transaction으로 간주할 때 |

Kafka 같은 내구성 로그는 append-only 이벤트 재생·consumer offset 운영에 유리할 수 있지만, 별도 broker cluster와 관리·지연 trade-off가 생긴다. DDS history는 실시간 분산 데이터 흐름에 잘 붙지만, bounded history를 업무 event store로 착각하면 안 된다. 영속 상태를 둘 위치는 데이터의 수명과 복구 책임으로 선택한다.

### 간단한 산정 예

센서가 초당 100개를 발행하고 Reader가 5초 동안 떠나 있으면 500개 sample이 생긴다. Writer의 `KEEP_LAST(100)`이면 저장 history가 남아도 late joiner가 받을 수 있는 과거는 최대 100개 per instance라는 의도다. `TRANSIENT_LOCAL`이면 Writer 종료 후엔 그 이력 자체가 사라질 수 있다. persistence는 Writer 재시작 경계를 확장하지만, 저장 깊이·Lifespan·용량 및 복구 구현을 확인해야 한다. 이 숫자는 설명용 계산이며 어떤 제품의 처리량 측정도 아니다.

## 실무 점검 순서

1. 저장하려는 것이 latest state인지, 순서가 중요한 event인지, 장비 명령/결과인지 결정한다.
2. 느린 Reader와 late joiner, Writer 재시작, DB 유실을 별도 장애로 시험한다.
3. History depth, ResourceLimits, Lifespan, Reliability, Durability의 매칭과 최악 저장량을 함께 정한다.
4. Persistence GUID를 endpoint의 논리 identity로 안정적으로 관리하고 중복 배포를 방지한다.
5. DB 파일 위치·권한·백업·용량·손상·읽기 전용·호스트 교체를 시험한다. SQLite 파일 하나가 다른 호스트에 자동 복제되는 것은 아니다.
6. 복원된 상태를 곧바로 제어 입력으로 쓰지 않는다. 센서 freshness와 command precondition을 재확인한다.
7. DDS 통지, 앱 read, 업무 commit, 물리 장비 결과를 서로 다른 관측 이벤트로 기록한다.

## 프로젝트에서 실제로 확인한 범위

학습 프로젝트는 Fast DDS 2.11.2 기반 세 프로세스에서 `SensorSample`에 `VOLATILE/KEEP_LAST(16)`, 상태 데이터에 `TRANSIENT_LOCAL/KEEP_LAST(1)`을 사용했다. 2026-10-09 실행에서 늦게 시작한 viewer가 새 상태 발행 없이 이전 상태를 받는 통합 시나리오가 확인됐다. 상태 판정 단위 검사 179개와 DDS 통합 시나리오 20개도 통과했다. 이 결과는 Writer 재시작 persistence 시험이 아니다.

프로젝트는 SQLite Persistence Service, DDS Security, 실제 CAN/RS-422 장비, 다중 호스트 failover, 업무 command ledger를 구성하거나 시험하지 않았다. 따라서 위의 장애 대응 표는 설계 기준이지 실행 결과가 아니다. 테스트 범위와 조건은 공개 1차 자료와 구별되는 프로젝트 기록이며, 이 글은 이를 외부 공개 저장소나 제품 사례로 제시하지 않는다.

## 조사 범위와 한계

2026-10-13에 OMG DDS 표준 이력과 Fast DDS 2.11.2 Persistence·QoS 원문, 현재 3.x 문서 및 프로젝트의 2026-10-09 시험 기록을 대조했다. 2.11.2와 3.x의 `PERSISTENT` 지원 범위는 판본별 문서에 근거한다. 특정 배포 바이너리의 빌드 설정과 재시작 동작은 이 글 작성 중 재실행하지 않았다.

## 참고자료

- [OMG DDS 1.0](https://www.omg.org/spec/DDS/1.0/) 및 [DDS 1.4](https://www.omg.org/spec/DDS/1.4/)
- [Fast DDS 2.11.2 Persistence Service](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/persistence/persistence.html)
- [Fast DDS 2.11.2 Standard QoS Policies](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/dds_layer/core/policy/standardQosPolicies.html)
- [Fast DDS 최신 Persistence 문서](https://fast-dds.docs.eprosima.com/en/latest/fastdds/persistence/persistence.html)

더 큰 맥락은 [QoS 정책]({% post_url 2026-10-13-dds-qos %}), [장애 진단]({% post_url 2026-10-13-dds-fault-diagnosis %}), [보안 경계]({% post_url 2026-10-13-dds-security %})와 [연재 안내]({% post_url 2026-10-13-dds-guide %})에서 이어진다.

{% include knowledge-links.html %}
