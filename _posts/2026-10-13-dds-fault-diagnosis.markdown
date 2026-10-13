---
layout: single
title: "DDS 센서 지연과 장애 진단: 관측에서 복구 검증까지"
date: 2026-10-13 00:00:00 +0900
categories: [system]
permalink: /dds/fault-diagnosis/
excerpt: "센서값 지연은 측정·발행·수신·검증·사용 시각을 나누어 조사하고, 한 번에 하나의 장애 조건을 바꿔 재현해야 원인과 복구 근거를 구분할 수 있습니다."
knowledge_id: dds-fault-diagnosis
series: dds
knowledge_links: [dds-guide, dds-qos, dds-device-adapters, dds-observability, dds-realtime-linux]
toc: true
toc_sticky: true
tags: [dds, reliability, testing, linux]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
---

“센서값이 늦다”는 증상만으로 DDS나 네트워크를 원인으로 정할 수 없습니다. 실제 센서 측정, 장비 frame 수신, DDS 발행, Reader 전달, 응용 유효성 검사, 제어 기능 사용이 서로 다른 경계입니다. 먼저 시간과 상태를 관측해 어느 경계에서 멈췄는지 찾고, 장애 조건을 하나씩 재현한 뒤 복구 상태와 출력 사용 가능 여부까지 확인합니다.

## 실제 학습 프로젝트와 상태 계약

이번 프로젝트는 ROS 없는 C++ Fast DDS 세 프로세스입니다. `sensor_sim`이 `SensorSample`을 발행하고, `controller`가 sample 검증과 상태 판정 후 `DeviceStatus`를 발행하며, `status_viewer`가 표시합니다. 센서는 하나의 `imu-1`을 가정합니다. 모의 sensor가 DDS sample을 직접 만들므로 TCP/RS-422/CAN 입력이나 물리 장비 제어를 시험한 것은 아닙니다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=fault-diagnosis" title="센서 입력 중단에서 STALE 판정, 복구 sample 확인, HEALTHY 재진입까지의 설명용 상태 전이" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

정적 의미: 첫 valid sample 이후 HEALTHY가 되고, 마지막 정상 sample의 수신 나이가 500ms 이상이면 STALE로 전환됩니다. 새 입력이 돌아와도 곧바로 정상 사용하지 않으며 같은 세션에서 정상·새 sample 3개를 연속 확인한 뒤 HEALTHY로 돌아갑니다. 이 수치는 학습 프로젝트 설정입니다.

| 상태 | 프로젝트에서의 의미 |
|---|---|
| UNKNOWN | 아직 채택한 정상 sample이 없음; 값 사용 불가 |
| HEALTHY | 허용된 최근 입력이 확인됨; `value_usable=true` |
| STALE | 정상 sample timeout; 마지막 값은 표시용으로 보존해도 사용 불가 |
| RECOVERING | 입력이 돌아왔으나 연속 정상 sample 확인 중; 여전히 사용 불가 |

상태 규칙은 별도의 순수 판정 코드에 두고 테스트하며, DDS 수신과 상태 발행을 연결한 통합 시나리오로 외부에서 보이는 동작을 확인했습니다. 실제 safety output 정책을 정의하거나 이중 센서/이중 controller를 구현한 것은 아닙니다.

## 관측을 시간순으로 모으기

1. **전제부터 기록합니다.** 프로그램·설정·바이너리 버전, DDS Domain, 인터페이스·라우팅, 실행 시각 기준을 보존합니다. 두 PC의 monotonic clock 값을 동기화한 것으로 간주해 직접 빼지 않습니다.
2. **Reader가 발견됐는지 확인합니다.** 매칭되지 않으면 discovery, 네트워크 인터페이스, domain, topic/type과 QoS 호환성을 먼저 비교합니다. DDS reader가 매칭되지 않았는데 응용 parser부터 바꾸면 원인을 잘못 찾기 쉽습니다.
3. **도착과 유효성을 분리합니다.** 프로젝트의 마지막-any-sample 시각과 마지막 valid/new sample 시각을 비교합니다. 최근 데이터가 계속 도착하지만 유효 시각만 늙는다면 invalid flag, 값 범위, 중복·역순 sequence, session 검증을 확인합니다.
4. **DDS 상태와 앱 상태를 함께 읽습니다.** match/liveliness/deadline/incompatible-QoS 상태는 DDS endpoint의 관점입니다. 애플리케이션 로그의 `valid_age`, 거부 사유, 상태 전이는 장비 데이터의 응용 의미입니다. 한 계층의 “alive”가 정상 측정을 뜻하지 않습니다.
5. **가장 이른 관측 지점을 비교합니다.** 센서 측정 timestamp, adapter 수신, parser 통과, DDS write 결과, Reader callback, controller 사용 판정, 화면 갱신을 같은 sample/session 식별자에 연결합니다. 앞선 지점까지 정상이고 다음 지점에서만 끊기는 구간이 조사 경계가 됩니다.

`accepted_sequence_gap`은 마지막 채택 sample과 새로 채택한 sample 사이의 번호 간격입니다. 중간 번호를 가진 invalid frame이 거부되어도 간격은 생길 수 있으므로 DDS packet loss를 직접 세는 지표가 아닙니다. 패킷 손실 주장이 필요하면 DDS statistics나 transport/network capture 등 독립적인 지표와 timestamp 기준을 사용해야 합니다. project run에서 관측된 sequence 차이를 실제 wire loss로 이름 붙이지 않았습니다.

## 어떤 실패를 어떻게 분리했나

장애 실험은 가능한 한 한 조건씩 바꿉니다. 예를 들어 발행 loop를 멈추되 프로세스는 살려 두면 participant 생존 신호와 실제 새 sample 공급을 비교할 수 있습니다. process 강제 종료, 유효하지 않은 값의 연속 도착, duplicate, 잘못된 QoS writer는 각각 다른 경계에 영향을 줍니다.

| 주입 조건 | 확인한 차이 | 실제 프로젝트 시나리오 이름/결과 |
|---|---|---|
| 시작 시 invalid / 계속 invalid | 프로세스와 sample이 있어도 정상값은 아닐 수 있음 | `startup_invalid`, `invalid_no_recovery` 통과 |
| 발행 loop pause, 프로세스 유지 | process/liveliness와 sample 주기는 다름 | `live_pause_recovery` 통과, Deadline·STALE·복구 관측 |
| sensor process 종료·재시작 | writer 변경, session 승인, 이전 session 재사용 | `forced_sensor_restart`, `unconfirmed_session`, `retired_session`, `reused_session` 통과 |
| duplicate, sequence regression, 범위/NaN 오류 | transport 수신과 응용 유효성은 다름 | `duplicate`, `regression`, `invalid_values` 통과 |
| 잘못된 QoS / writer 경쟁 | endpoint 호환성과 여러 작성자 식별 | `incompatible_qos`, `competing_writers` 통과 |
| 빠른 입력/느린 처리, write API 오류 | bounded 처리, timeout, 오류 종료·정리 | `bounded_load`, `sensor_write_timeout`, `controller_write_timeout` 통과 |
| 늦은 viewer / controller 종료 | 데이터 이력과 상태 생산자 연결 단절 | `late_viewer`, `controller_exit` 통과 |

실제 `live_pause_recovery` 실행을 시간순으로 읽으면 이렇습니다. 센서 프로세스는 살아 있지만 발행 loop를 멈춰 두므로 participant 생존 정보만으로는 새 측정이 들어온다고 볼 수 없습니다. 시험은 DDS Deadline 상태와 함께 새 sample 부재를 관찰하고, controller가 마지막 정상 수신 나이를 500ms 이상으로 판단한 뒤 STALE 및 `value_usable=false`로 바뀌는지 확인했습니다. 발행이 재개되어도 같은 세션의 정상·새 sample 세 개를 연속 확인하기 전까지는 값을 사용하지 않습니다. 이 시나리오는 2026-10-09에 통과했지만 요약 기록에는 단계별 실측 지연이 없어 Deadline 또는 복구 시간의 수치 보장으로 해석하지 않습니다.

반대로 `invalid_no_recovery`는 sample이 계속 도착하는 경우를 나눕니다. 관측 관점에서 마지막 수신(any age)은 최근인데 마지막 유효·새 sample의 age는 늘고 invalid 사유가 반복되면, 연결 자체보다 payload 유효성 검증을 먼저 조사합니다. 프로젝트 통합 시나리오는 invalid 값이 정상 수신 시각을 갱신하거나 잘못된 복구를 일으키지 않는지 검사했습니다. 여기서도 각 네트워크 계층의 packet loss를 측정한 것은 아닙니다.

2026-10-09 실행에서 상태 머신 단위 검사는 179개가 통과했고 DDS 통합 시나리오는 20/20 통과했습니다. GCC 13.3.0로 빌드, 직접 작성한 7개 translation unit에 선택한 cppcheck 검사, 상태 머신에 한정한 ASan/UBSan 및 Release/NDEBUG 검사도 통과했습니다. 이는 해당 Linux VM 환경에서 기록된 실행 결과이지 제품 인증이나 실시간 성능 증명은 아닙니다.

발행 실패 시나리오는 LD_PRELOAD를 사용해 DDS `DataWriter::write()`가 `RETCODE_TIMEOUT`을 반환하게 했고, 오류 로그·exit code 1·정리 동작을 확인했습니다. 이것은 실제 LAN 패킷 손실이나 네트워크 분리를 발생시킨 시험이 아닙니다. `bounded_load`에서 확인된 번호 간격/timeout도 이 실행의 측정치로만 읽어야 합니다.

## 진단에서 복구까지 놓치기 쉬운 것

- **마지막 값의 표시와 사용을 분리합니다.** 진단을 위해 stale value를 화면에 남겨도 제어 입력으로 써도 된다는 뜻은 아닙니다. 프로젝트는 STALE/RECOVERING 때 `value_usable=false`를 보냅니다.
- **수신 시각과 측정 시각을 혼동하지 않습니다.** network나 DDS history의 오래된 sample이 새로 도착할 수 있습니다. 현재 프로젝트는 controller 수신 시각과 sequence를 사용하므로 실제 sensor measurement freshness를 증명하지 않습니다.
- **Deadline과 원인 분석을 혼동하지 않습니다.** Fast DDS 2.x 문서의 Deadline QoS는 Writer 공급/Reader 수신의 기대 최대 기간과 missed status를 설명합니다. missed event 하나로 케이블·OS·DDS 중 무엇이 원인인지 확정하지 않습니다. [Fast DDS QoS 설명](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html)
- **복구는 입력 재개만으로 선언하지 않습니다.** 연속 정상 sample, 세션 교체 승인, 필요한 sensor self-check와 출력 정책을 확인합니다. 여기서 세 sample과 500ms는 학습 값이며 시스템 요구사항으로 일반화하지 않습니다.
- **시뮬레이터 성공을 실제 장비 재현으로 확대하지 않습니다.** 실제 ICD, device driver, 배선·신호 품질, 장비별 timing과 환경은 별도 시험 대상입니다. adapter parser와 입력 시간 경계는 [장비 어댑터 글]({% post_url 2026-10-13-dds-device-adapters %})에서 다룹니다.
- **한 host의 이중 프로세스는 독립 fault domain이 아닐 수 있습니다.** 전원·kernel·네트워크가 공유되면 동시 장애 가능성이 남고, 여러 controller가 장비에 내리는 명령은 output authority를 별도로 설계해야 합니다.

## 관측성으로 남길 최소 정보

전이 로그에는 이전/새 상태, 사유, 센서·controller session, sample sequence, 상태 revision, 정상 수신 이후 경과 시간을 포함하면 재현과 분석에 도움이 됩니다. 카운터에는 수신·거부·timeout·write 실패를 나누고, duration metric은 parser 처리·queue wait·`write()` 호출 같은 경계를 선택해 측정할 수 있습니다. Trace ID나 device 식별자를 metric label로 무제한 추가하면 cardinality가 커지므로 로그/trace와 metric label의 역할을 나눕니다. 상세 경로는 [DDS 관측성 안내]({% post_url 2026-10-13-dds-observability %})를 참고하세요.

## 시험 결과의 범위와 남은 공백

측정 환경은 Mac Docker Desktop Linux VM 내부 컨테이너, Ubuntu 24.04.5 userspace, Linux 6.4.16-linuxkit aarch64, Fast DDS 2.11.2, 단일 가상 Linux와 UDPv4였습니다. 확인된 프로젝트 구조는 simulator, controller, viewer 세 개의 독립 프로세스입니다. 기록된 결과는 179개 상태 머신 검사, 20개 통합 시나리오이며 날짜는 2026-10-09입니다.

실제 CAN/RS-422 장비와 TCP 장비 통신, 원격 다중 PC, 실제 명령 출력, security, persistent history, OpenTelemetry, PREEMPT_RT/`SCHED_DEADLINE`, GVA 적합성은 시험하지 않았습니다. 다수 viewer/controller의 모든 분기, 모든 초기화 실패 조합, 실시간 worst-case latency도 전수 확인하지 않았습니다. 테스트 결과를 [기초 안내]({% post_url 2026-10-13-dds-guide %}), [QoS 글]({% post_url 2026-10-13-dds-qos %}), [Linux scheduling 글]({% post_url 2026-10-13-dds-realtime-linux %})의 개념 설명과 구별해 읽으세요.

## 참고자료와 조사 한계

- Fast DDS 2.x [표준 QoS와 Deadline](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html): 제품 문서의 기능 설명이며 프로젝트의 모든 장애 원인이나 network 상태를 판정하지 않음.
- DDS Device Lab `세 프로세스와 상태 머신 설계`, `구현 시험 결과`, `센서 계측값이 늦을 때의 진단 순서`: 실제 구조·실험 목록·날짜·관측 범위.
- 테스트 기록 날짜: 2026-10-09. 공개 QoS 자료는 2026-10-13 확인. 실행 재현은 이번 글 작성 중 수행하지 않았습니다.

공개 실전 사례로 특정 기업의 production failure architecture를 확인한 근거는 조사 자료에 없습니다. 이 글은 프로젝트 학습용 시나리오를 실제 회사 장애 사례처럼 제시하지 않습니다. 다음 주제는 [관측 신호와 export 경로]({% post_url 2026-10-13-dds-observability %})입니다.

{% include knowledge-links.html %}
