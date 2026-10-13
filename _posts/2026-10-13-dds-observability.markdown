---
layout: single
title: "DDS 관측성: Fast DDS 통계와 OpenTelemetry의 역할"
date: 2026-10-13 00:00:00 +0900
categories: [system]
permalink: /dds/observability/
excerpt: "Fast DDS Statistics는 DDS/RTPS 내부 흐름을 DDS topic으로 내보내고 OpenTelemetry는 앱이 기록한 로그·metric·trace를 수집하므로, 두 신호를 함께 상관 분석해야 합니다."
knowledge_id: dds-observability
series: dds
knowledge_links: [dds-guide, dds-basics, dds-qos, dds-fault-diagnosis, dds-realtime-linux]
toc: true
toc_sticky: true
tags: [dds, observability, testing, linux]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
---

DDS를 관측할 때 middleware 통계와 응용 의미의 로그·metric·trace를 구분해야 합니다. Fast DDS Statistics Module은 DDS/RTPS 통신 상태를 DDS topic으로 제공할 수 있고, OpenTelemetry(OTel)는 C++ 앱이 직접 계측해 만든 signal을 export합니다. 둘 중 하나만 보면 transport와 장비 기능 사이의 원인 경계를 놓칠 수 있습니다.

## 로그, metric, trace는 서로 다른 질문에 답한다

| 신호 | 주된 질문 | 센서 경로 예 |
|---|---|---|
| 로그(log) | 어떤 사건이 어떤 값·사유로 발생했나? | frame checksum 오류, STALE→RECOVERING 전이, write 실패 |
| metric | 사건이 얼마나 자주 일어나고 지연이 어떻게 변하나? | accepted sample 수, stale 상태 시간, parser/queue 지연 분포 |
| trace | 한 요청 또는 sample이 어느 구간을 지나갔나? | 측정 식별자에 연결한 adapter→DDS→controller 처리 단계 |

OpenTelemetry의 핵심 signal 설명은 traces를 앱 경로, metrics를 실행 중 측정, logs를 사건 기록으로 구분합니다. OTel SDK와 OTLP exporter는 신호를 수집 시스템으로 전달하는 구조이며, 어떤 사건이나 단위를 기록할지는 앱의 계측 설계가 정합니다. [OTel signals](https://opentelemetry.io/docs/concepts/signals/), [C++ instrumentation](https://opentelemetry.io/docs/languages/cpp/instrumentation/), [C++ exporters](https://opentelemetry.io/docs/languages/cpp/exporters/)

## Fast DDS Statistics는 middleware 내부를 보여 준다

Statistics Module 포함 여부에는 같은 2.14.7 release의 공식 자료끼리도 차이가 있습니다. [사용자 문서](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/statistics/statistics.html)는 기본 빌드에서 Statistics Module을 compile하지 않는다고 안내하지만, [2.14.7 CMakeLists.txt](https://raw.githubusercontent.com/eProsima/Fast-DDS/v2.14.7/CMakeLists.txt#L378-L380)는 `FASTDDS_STATISTICS` 옵션의 기본값을 `ON`으로 둡니다. Statistics Backend 0.11.0 [변경 기록](https://fast-dds-statistics-backend.readthedocs.io/en/latest/rst/notes/previous_versions.html)도 Fast DDS 2.9.0부터 이 빌드 옵션을 기본 활성화했다고 적습니다. 그러므로 문서 한 문장만으로 모든 배포본의 compile 상태를 단정하지 않습니다. 대상 패키지의 CMakeCache/build flags와 실제 라이브러리에서 Statistics 기능이 있는지 확인하고, 포함되어 있다면 필요한 통계별 DataWriter/topic 활성 설정을 별도로 확인해야 합니다. 학습 프로젝트의 2.11.2 패키지에서 이 설정을 검사하거나 Statistics를 실행하지 않았습니다.

공개 topic에는 `HISTORY_LATENCY_TOPIC`, `NETWORK_LATENCY_TOPIC`, publication/subscription throughput, RTPS sent/lost, discovery와 heartbeat/ACKNACK 관련 통계가 있습니다. 이름만으로 “센서 measurement age”라고 읽으면 안 됩니다. 예를 들어 HISTORY_LATENCY는 sample이 DataWriter history에 들어간 시점부터 매칭된 DataReader history에 추가되고 callback notification이 일어날 때까지이고, NETWORK_LATENCY는 RTPS 메시지가 송신 경로의 `RTPSMessageGroup`을 떠나 `MessageReceiver`에서 수신될 때까지로 문서화되어 있습니다. 장비가 측정한 시각이나 controller에서 실제 기능에 사용한 시각은 아닙니다. [Fast DDS statistics topic 정의](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/statistics/dds_layer/topic_names.html)

## 수집에서 대시보드까지의 선택

아래 애니메이션은 DDS 통계 topic과 앱 telemetry가 각자 수집 경로를 지나 저장·시각화되는 흐름을 설명합니다. 특정 시스템에서 실행되거나 실제 성능을 나타내는 캡처가 아닙니다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=observability" title="Fast DDS 통계 DDS topic과 앱 OpenTelemetry signals의 수집 경로를 비교하는 설명용 애니메이션" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

정적 의미: Fast DDS 통계는 별도 DDS 구독자/Statistics Backend로 수집하고, 앱의 로그·metric·trace는 OTel SDK와 OTLP로 보낼 수 있습니다. Prometheus는 통계 backend/exporter를 거친 metric을 scrape할 수 있습니다. 어느 경로도 다른 경로의 앱 의미를 자동 생성하지 않습니다.

eProsima의 Vulcanexus 공식 가이드는 Fast DDS Statistics Backend를 통해 수집한 network 통계를 C++ Prometheus exporter로 전달하는 예제를 보여 줍니다. 예제 구성에는 Statistics topic 활성화, 별도 backend application, Prometheus가 각각 있습니다. 즉 “Fast DDS를 쓰면 Prometheus가 자동으로 DDS를 관측한다”는 구성은 아닙니다. 이 자료는 Vulcanexus Iron/ROS 2 demo 맥락의 절차이며 현재 프로젝트에 설치된 환경의 실험 결과가 아닙니다. [Vulcanexus Prometheus tutorial](https://docs.vulcanexus.org/en/iron/rst/tutorials/tools/prometheus/prometheus.html)

| 계층 | 수집 경로 | 답할 수 있는 범위 |
|---|---|---|
| Fast DDS 내부 통계 | Statistics Module topic → Statistics Backend/Monitor 또는 exporter | DDS history/transport/throughput/RTPS 신호 |
| 애플리케이션 metric | C++ OTel Meter → SDK/exporter → Collector/backend | 유효 데이터, 상태 지속시간, parser·queue·처리 지연 |
| 애플리케이션 log | 구조화 이벤트 → OTel log pipeline 또는 기존 JSONL | 전이 사유와 특정 session/sample의 문맥 |
| 애플리케이션 trace | OTel span → context 전달 → Collector/backend | 계측된 단계별 처리 시간과 상관관계 |

## Trace는 DDS에 자동 포함되지 않는다

예를 들어 앱에서 `DataWriter::write()` 호출을 span으로 계측하면 그 span은 호출 구간을 설명합니다. 이것만으로 subscriber 수신·callback 처리나 장비 동작 완료가 검증되지는 않습니다. 프로세스 사이 trace를 연결하려면 애플리케이션이 trace context를 정해진 필드 또는 허용된 metadata로 주입하고 수신 쪽에서 추출해 callback, queue, worker까지 전달하는 계약을 만들어야 합니다. DDS standard header에 OTel context가 자동 기입된다고 가정하지 않습니다.

가장 작은 적용은 `session_id`, `sample_sequence`, `command_id`를 구조화 로그와 trace span attribute에 기록해 같은 작업을 찾게 하는 것입니다. 이를 모든 metric label로 복제하면 장치 수나 sequence에 비례해 cardinality가 커질 수 있습니다. metric label은 상태·결과·bounded class처럼 값 종류가 제한된 축에 두고 고유 ID는 로그와 trace의 문맥으로 남깁니다. OTel span link, fanout 및 sampling은 메시지 처리 구조에 맞게 결정합니다. [OTel Tracing API](https://opentelemetry.io/docs/specs/otel/trace/api/)

## 제품별 기능 주장은 버전을 붙인다

RTI Connext Observability Framework 7.7.0의 공식 Collector Service 설명은 Prometheus·Grafana Loki 통합과 OTLP exporter를 문서화합니다. 해당 OTLP exporter 범위는 metrics와 logs입니다. 그 페이지에서는 trace 기능을 확인하지 못했으므로 이를 “RTI 7.7이 trace를 지원하지 않는다”는 전체 제품 주장으로 확대하지 않습니다. 이 자료는 Fast DDS 기능 증거도 아닙니다. [RTI Connext Observability 7.7.0](https://community.rti.com/static/documentation/connext-dds/7.7.0/doc/manuals/connext_dds_professional/observability/rest_api.html)

마찬가지로 이번 조사에서 읽은 Fast DDS 공식 Statistics 자료는 통계의 DDS-topic 수집 경로를 설명하지만 Fast DDS 자체 내장 OTLP exporter 또는 OTel trace-context 자동 전파를 설명하지 않습니다. 따라서 여기서는 “확인한 자료 범위에서 내장 exporter를 입증하지 못했다”고 표현합니다. 실제 제품·branch·통합 패키지의 최신 지원 여부는 대상 release 문서와 설치 파일에서 재확인해야 합니다.

## 장애 진단에 신호를 엮는 순서

실제 늦은 sensor 값을 조사한다면 adapter의 마지막 frame 수신, parser 성공/실패, DDS write 결과, Statistics topic의 transport 지표, Reader callback, controller valid age, status publish, viewer 수신을 가능한 범위에서 함께 기록합니다. 같은 sequence나 trace ID, session, monotonic duration을 공유하면 첫 지연 구간을 좁히는 데 도움이 됩니다. 시각을 비교할 때는 서로 다른 PC의 clock synchronization과 timestamp 기준을 먼저 확인합니다.

`RTPS_LOST`는 문서상 transport layer의 RTPS packet loss 신호입니다. 그것과 응용 `accepted_sequence_gap`은 같은 계수가 아닙니다. 응용 sequence 차이는 parser가 거부한 데이터, 정지/재시작, application-level 번호 정책에서 비롯될 수도 있습니다. 진단은 [장애 진단 글]({% post_url 2026-10-13-dds-fault-diagnosis %}), QoS deadline 해석은 [QoS 글]({% post_url 2026-10-13-dds-qos %})을 참조하세요.

## 현재 프로젝트의 계측 상태

학습 프로젝트는 JSONL 로그, 상태 전이 이유, session/sequence, age 및 Fast DDS QoS 상태 진단을 기록합니다. Statistics Module, Statistics Backend, Prometheus exporter, OTel SDK/Collector를 구현하거나 시험하지 않았습니다. 따라서 위 수집 흐름은 공개 공식 문서와 적용 설계 설명이며 현재 프로젝트 대시보드나 수집성능 보고가 아닙니다. 실제 run은 2026-10-09 단일 Linux VM에서 실행된 것으로 [연재 안내]({% post_url 2026-10-13-dds-guide %})의 시험 경계를 유지합니다.

## 참고자료와 조사 한계

- [Fast DDS Statistics Module](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/statistics/statistics.html), [2.14.7 CMake option](https://raw.githubusercontent.com/eProsima/Fast-DDS/v2.14.7/CMakeLists.txt#L378-L380), [Statistics topic names/semantics](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/statistics/dds_layer/topic_names.html): same-release source/documentation mismatch; current docs page is 2.14.7.
- [Vulcanexus Iron Prometheus tutorial](https://docs.vulcanexus.org/en/iron/rst/tutorials/tools/prometheus/prometheus.html): Fast DDS Statistics Backend를 거친 예제.
- [OpenTelemetry C++ instrumentation](https://opentelemetry.io/docs/languages/cpp/instrumentation/), [C++ exporters](https://opentelemetry.io/docs/languages/cpp/exporters/), [signals](https://opentelemetry.io/docs/concepts/signals/): 앱 계측과 telemetry signal/export.
- [RTI Connext Observability 7.7.0 Collector Service](https://community.rti.com/static/documentation/connext-dds/7.7.0/doc/manuals/connext_dds_professional/observability/rest_api.html): RTI 제품·버전에 한정한 OTLP metrics/logs 사례.

공식 자료는 2026-10-13에 읽었습니다. 2.11.2 대상 package의 실제 compile option과 각 topic writer 활성 여부는 확인하지 않았고, telemetry backend 적합성도 비교 실험하지 않았습니다. Topic별 의미를 이해하려면 [기초 안내]({% post_url 2026-10-13-dds-basics %})와 [실시간성 경계]({% post_url 2026-10-13-dds-realtime-linux %})를 이어 읽으세요.

{% include knowledge-links.html %}
