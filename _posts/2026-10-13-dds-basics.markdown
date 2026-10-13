---
layout: single
knowledge_id: dds-basics
series: dds
permalink: /dds/basics/
title: "DDS 기본 개념: Topic, 데이터 계약과 선택 기준"
date: 2026-10-13 00:00:00 +0900
categories: [system]
excerpt: "DDS는 타입 있는 상태 데이터를 분산 공유하는 표준이며 Topic·key·endpoint가 그 데이터 계약을 만든다."
tags: [dds, middleware, architecture]
toc: true
toc_sticky: true
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
knowledge_links:
  - dds-guide
  - dds-discovery-addressing
  - dds-qos
---

DDS(Data Distribution Service)는 프로그램들이 데이터를 발행하고 구독하는 방식과 그 동작을 규정하는 OMG 표준이다. 핵심 추상화는 원격 함수 호출이 아니라 **데이터 객체의 상태를 이름과 타입으로 공유하는 것**이다. 그래서 여러 센서·통제·화면 프로그램이 같은 데이터를 필요로 할 때 적합한 후보가 된다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=basics" title="Topic 타입 계약에 맞는 Writer와 Reader의 관계" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

> 이 애니메이션은 타입이 같은 Writer와 Reader가 데이터를 공유하는 교육용 모식도다. 실측 패킷이나 제품 실행 화면이 아니다.

그림에서 `SensorSample`이라는 Topic을 여러 Reader가 구독한다. 이 구조는 특정 호출자의 주소를 미리 알아야 하는 RPC와 다른 결합 방식이다. 새 소비자는 같은 데이터 계약을 구현해 참여할 수 있지만, 실제로 발견되고 매칭되려면 네트워크·Domain·타입·QoS 조건도 맞아야 한다.

## 용어와 데이터 모델

| 용어 | 의미 | 센서 예시 |
|---|---|---|
| Domain | 논리적 DDS 통신 범위 | 참여자들이 함께 발견될 Domain ID |
| DomainParticipant | Domain 안에서 DDS entity를 만드는 진입 객체 | sensor 앱의 참가자 |
| Topic | 샘플 이름과 타입이 결합된 계약 | `Vehicle.Attitude`와 `AttitudeSample` |
| DataWriter | Topic 샘플을 발행하는 endpoint | 센서 어댑터 출력 |
| DataReader | Topic 샘플을 받는 endpoint | 통제기 입력, 상황판 |
| key / instance | 여러 독립 데이터 객체를 구분하는 선언된 키 | IDL key로 선언한 `vehicle_id` |
| sample | 특정 시점에 기록된 값 | heading 271.4°, 측정 시각, sequence |
| QoS | 전달·보관·시간 조건의 정책 | RELIABLE, deadline, history depth |

`vehicle_id` 필드가 있다는 사실만으로 DDS가 이를 key로 취급하지 않는다. 타입 정의가 key로 선언해야 instance 별 history·deadline·ownership 의미가 생긴다. 반대로 모든 센서가 별도 Topic을 가져야 하는 것도 아니다. 설계자는 한 Topic의 keyed instances로 여러 장비를 표현하거나, 데이터 계약·보안·갱신 주기가 다르면 Topic을 나눌 수 있다.

OMG의 “global data space”는 애플리케이션 관점에서 읽고 쓸 데이터 모델을 표현한다. 물리 메모리가 한 서버에 공유된다는 뜻은 아니다. [OMG DDS 1.4 §1.1](https://www.omg.org/spec/DDS/1.4/PDF)

## 왜 표준이 필요했나

DDS 1.4 서문은 DDS 표준 채택 전에도 RTI NDDS와 THALES Naval Nederland의 Splice 같은 제품이 유사 기능을 제공했지만 proprietary interface와 behavior 때문에 애플리케이션 이식이 어려웠다고 설명한다. 표준의 목적은 응용 API와 동작의 이식성을 제공하는 것이다. 다만 DDS API 표준과 서로 다른 구현 간 wire 상호운용은 구분해야 한다. OMG DDSI-RTPS는 별도 wire-protocol 규격이다. [OMG DDS 1.4 §1.1](https://www.omg.org/spec/DDS/1.4/PDF) · [DDSI-RTPS](https://www.omg.org/spec/DDSI-RTPS/)

용어를 풀면 Data Distribution Service는 데이터 분배 서비스를 뜻하고, DCPS(Data-Centric Publish-Subscribe)는 데이터 중심 발행-구독 모델이다. OMG가 정식 승인·관리하는 표준 이름은 DDS다. “실시간”이라는 적용 분야가 이름과 표준 설명에 들어가지만, DDS를 썼다는 사실만으로 응용 프로그램의 end-to-end deadline이 지켜졌다는 뜻은 아니다.

## 동작 흐름

```text
IDL / 타입 계약
      ↓ 코드 생성 또는 타입 등록
DataWriter ── 발견된 상대와 RTPS 데이터 교환 ── DataReader
      ↑                                             ↓
앱이 샘플 작성                              앱이 읽고 의미 검증
```

1. 응용은 데이터 구조와 필요하면 key를 정의한다.
2. DomainParticipant가 Topic, Publisher/Subscriber와 Writer/Reader를 만든다.
3. discovery가 상대 endpoint의 Topic·타입·locator 등 정보를 교환한다.
4. 이름, 타입 호환성, partition 및 요청·제공 QoS가 맞는 Writer/Reader가 통신한다.
5. Reader의 앱은 샘플을 읽어 범위·신선도·세션·업무 상태를 검증한다.

실제 네트워크는 아래의 [discovery와 주소 글]({% post_url 2026-10-13-dds-discovery-addressing %})에서 다룬다. Discovery Server가 있더라도 데이터 처리 broker라고 간주하지 않는다.

## DDS와 다른 모델

| 선택지 | 강점 | 주의점 | 알맞은 출발 조건 |
|---|---|---|---|
| DDS | 타입 있는 분산 데이터, 여러 reader, 세밀한 QoS와 peer 전달 | discovery·multicast·QoS 조합을 운영해야 함 | 독립 노드가 최신 상태를 자주 공유 |
| Kafka | 보존 가능한 partition log, 재처리와 consumer offset | broker cluster와 저장량·retention 운영 | 이벤트를 장기간 replay 해야 함 |
| RabbitMQ | queue, routing, ACK와 작업 분배 | broker 가용성과 queue 정책 관리 | worker에게 업무를 배분 |
| gRPC/RPC | 특정 기능 호출과 요청-응답 계약이 명확 | caller/callee 결합, stream의 수명 관리 | 명령 결과를 요청별로 돌려받음 |
| 직접 TCP/UDP 소켓 API | 최소 프로토콜, 제한된 장비 인터페이스에 맞춤 | framing·type·재시도·멀티캐스트를 직접 구현 | 단일 고정 연결과 작은 프로토콜 |

DDS도 request/reply 패턴으로 쓸 수 있고, Kafka도 상태를 표현할 수 있다. 표의 소켓 행은 일반 응용의 직접 TCP/UDP socket API를 가리킨다. raw socket API는 IP 계층 아래의 패킷 접근을 뜻하는 별도 기능이다. 표는 대표적인 중심 모델의 차이를 정리한 것이며 동일 환경 성능 비교는 아니다. ROS 2 설계 설명은 DDS를 선택한 배경으로 표준 기반의 구현 재사용과 다양한 요구를 가진 시스템을 언급한다. [ROS on DDS](https://design.ros2.org/articles/ros_on_dds.html)

## 기준 문서의 역사와 범위

OMG 공식 카탈로그의 DDS formal version 연표는 **DDS 1.0 (2004년 12월) → 1.1 (2005년 12월) → 1.2 (2006년 12월) → 1.4 (2015년 3월)**이다. 이는 공식 표준 판본의 채택 시점이다. DDS 표준 이전에 proprietary 구현이 있었다는 사실은 DDS 1.4 서문이 언급하지만, 그보다 앞선 연구·개발의 시작 시점은 이 연표만으로 확정하지 않는다. 표준의 adoption date, 구현 제품의 출시일, 제품 버전 이력은 서로 다른 기록이다. [OMG DDS 공식 연표](https://www.omg.org/spec/DDS/), [DDS 1.0 공식 기록](https://www.omg.org/spec/DDS/1.0/)

표준이 발전해도 구현체마다 지원 QoS·전송 plugin·보안 기능은 다를 수 있다. 사용 중인 Fast DDS 2.11.2는 2026-10-09 프로젝트 시험 기록의 버전이다. 최신 2.14.7 문서를 해당 실행 버전에 그대로 대입하지 말고 버전별 문서를 대조해야 한다.

## 선택 기준

DDS를 우선 시험할 조건은 ① 센서 상태를 여러 소비자가 독립적으로 볼 필요가 있고, ② 데이터 계약을 팀 간 공유할 수 있으며, ③ endpoint별 전달·이력 정책을 명시해야 하고, ④ 네트워크 discovery를 운용할 수 있는 경우다. 작업을 오래 보존하고 임의 시점에 replay해야 한다면 Kafka 계열 로그가 더 자연스러울 수 있다. 명령에 대한 즉각적인 동기 응답이 핵심이면 RPC도 후보로 둔다. 선택은 메시지 수만으로 결정하지 말고 장애·보안·운용 요구와 함께 검토한다.

## 운영 시 실수하기 쉬운 점

- Topic은 네트워크 주소가 아니다. Topic별 고정 UDP port가 생긴다고 가정하지 않는다.
- Domain ID는 보안 경계가 아니다. 인증·권한은 DDS Security 또는 네트워크 정책에서 다뤄야 한다.
- Reliability는 deadline, 센서 값의 유효성, 응용 처리 완료를 대신하지 않는다. 구체적인 정책 역할은 [QoS 글]({% post_url 2026-10-13-dds-qos %})을 참고한다.
- 표준 API는 모든 구현체의 확장 기능과 동작 세부가 동일함을 뜻하지 않는다. 버전과 설정을 기록한다.
- 직접 DDS endpoint가 없는 CAN·RS-422 장비는 드라이버와 의미 변환 adapter가 필요하다.

## 공개 적용 사례

OMG의 표준 문서는 telecom equipment control, sensor networks, network management systems를 데이터 중심 전달 후보 영역으로 든다. 이는 문제 유형을 말하며 특정 생산 시스템의 검증 수치나 채택 규모는 아니다. NASA Astrobee 사용자 안내서도 ROS 데이터 일부를 DDS 메시지로 변환해 지상에 보내는 연결을 설명한다. 그 문헌만으로 전체 시스템의 DDS 사용 범위를 넓혀 말하지 않는다. [OMG DDS 1.4 §1.1](https://www.omg.org/spec/DDS/1.4/PDF) · [NASA Astrobee guide](https://www.nasa.gov/wp-content/uploads/2017/12/irg-ff029-astrobee-guest-science-guide.pdf)

## 조사 범위와 한계

2026-10-13에 OMG DDS 1.4, OMG 표준 카탈로그, ROS 2 설계 문서와 프로젝트 노트를 확인했다. OMG DDS 1.4는 2015년 판본이며 본문은 인터페이스·행동과 문제 배경을 설명한다. 정확한 초기 초판 승인 연표와 비교 성능은 이번 확인 범위에서 확정하지 않았고, 공개 적용 자료는 범위를 넘어 일반화하지 않았다.

{% include knowledge-links.html %}
