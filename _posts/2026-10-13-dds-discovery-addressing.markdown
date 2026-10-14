---
layout: single
knowledge_id: dds-discovery-addressing
series: dds
permalink: /dds/discovery-addressing/
title: "DDS Discovery와 주소: Domain부터 실제 IP 경로까지"
date: 2026-10-13 00:00:00 +0900
categories: [system]
excerpt: "DDS participant와 endpoint가 서로를 발견하는 절차, RTPS metatraffic, 실제 locator와 네트워크 경계를 구분한다."
tags: [dds, networking, discovery]
toc: true
toc_sticky: true
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
knowledge_links:
  - dds-guide
  - dds-basics
  - dds-qos
---

DDS(Data Distribution Service) discovery는 “누가 어디서 무엇을 제공하는가”를 participant와 endpoint 사이에 알리는 과정이다. Discovery는 Topic별 서버 포트를 자동 배정하는 절차가 아니며 IP(Internet Protocol) 도달성, firewall, interface 선택을 대신하지 않는다. 장애를 볼 때 Domain ID, RTPS(Real-Time Publish Subscribe, 실시간 발행·구독) metatraffic, endpoint 매칭, user data 경로를 분리해야 한다. [Fast DDS 용어 정의](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/getting_started/definitions.html)

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=discovery-addressing" title="Participant discovery와 endpoint discovery 후 user data가 흐르는 과정" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

> 그림은 discovery 메타데이터와 사용자 데이터를 나눠 보이는 교육용 모식도다. 패킷 캡처나 특정 실행의 타이밍이 아니다.

같은 Domain 참가자는 먼저 participant 정보를 교환하고, 그 다음 DataWriter/DataReader의 Topic·type·QoS(Quality of Service) 정보를 알린다. 서로 호환되는 endpoint가 매칭되면 user data가 Reader 쪽 locator로 전송된다. 기본 peer 구성에서는 discovery 경로와 실제 데이터 경로가 역할상 구분되지만 둘 다 네트워크 구성 영향을 받는다.

## 필요한 식별자

| 값 | 의미 | 의미하지 않는 것 |
|---|---|---|
| Domain ID | 어떤 논리 DDS 영역에 참여할지 | 인증서, 암호화, VLAN(Virtual Local Area Network) 또는 방화벽 규칙 |
| Participant | 응용 프로세스 안에서 Domain에 참여하는 DDS 객체 | 반드시 프로세스/장비와 일대일 대응 |
| Topic 이름·type | 데이터 이름과 구조 계약 | IP 주소나 토픽 전용 port |
| RTPS Globally Unique Identifier (GUID) | wire protocol에서 participant/entity 식별 | 네트워크 목적지 그 자체 |
| Locator | transport에서 실제 송수신할 주소 정보 | 항상 IP:port; shared memory 등은 다름 |

예를 들어 `DDSDeviceLab.SensorSample`은 하나의 Topic 이름이다. 점은 Domain과 Topic을 분리하는 구두점이 아니다. 참가자는 `domain_id=73`처럼 Domain ID로 생성되고 Topic은 별도 이름과 타입으로 등록된다. 하나의 participant가 여러 topic endpoint를 만들 수 있으며 여러 토픽이 같은 수신 locator를 사용할 수 있다.

## Simple Discovery 두 단계

Fast DDS 기본 SIMPLE discovery는 SPDP(Simple Participant Discovery Protocol)로 participant를 찾고, 이어 SEDP(Simple Endpoint Discovery Protocol)로 endpoint 정보와 매칭 후보를 교환한다. participant에는 GUID prefix와 locators 같은 정보가 포함되고 endpoint는 Writer/Reader의 Topic·type·QoS 정보를 제공한다. QoS 호환이 안 되면 network에서 participant가 보이더라도 데이터 endpoint는 매칭되지 않을 수 있다. [Fast DDS Discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/discovery.html) · [SIMPLE Discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/simple.html)

```text
SPDP: participant 존재·locator 교환
       ↓
SEDP: endpoint topic/type/QoS 정보 교환
       ↓ compatible
DataWriter ─────── user data ───────► DataReader
```

이 절차는 같은 이름만 보고 데이터를 받는다는 뜻이 아니다. Interface Definition Language (IDL)/type compatibility, partition 및 requested/offered QoS 등 조건을 함께 살핀다. Writer/Reader QoS의 실제 역할은 [QoS 글]({% post_url 2026-10-13-dds-qos %})에서 다룬다.

## Metatraffic, user data, transport

`metatraffic`는 participant와 endpoint를 발견하고 상태를 유지하는 제어성 데이터다. `user data`는 application Topic 샘플이다. RTPS는 이 둘을 위한 표준 메시지와 reader/writer 상태 정보를 정의하고, 전송은 UDP(User Datagram Protocol)의 IPv4(Internet Protocol version 4) 전송·TCP(Transmission Control Protocol)·shared memory 등 구현과 구성에 달린다. DDS API(Application Programming Interface)에서 `write()`를 호출했다는 설명과 IP 패킷이 어떤 경로로 나갔다는 설명을 같은 층으로 취급하지 않는다.

기본 SIMPLE 설정은 multicast로 participant discovery를 수행한다. Multicast는 라우터·스위치·컨테이너 가상 네트워크에서 차단되거나 경계를 넘지 않을 수 있다. Fast DDS는 initial peers 등의 명시적 peer 주소나 Discovery Server 같은 선택 구조를 제공한다. 이 경우에도 participant가 광고하는 user-data locator가 실제로 상대에게 도달 가능해야 한다. [Fast DDS SIMPLE discovery](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/simple.html)

## Discovery Server의 실제 역할

Discovery Server는 discovery 정보를 수집·배포해 participant 발견을 돕는 선택 가능한 방식이다. 데이터 payload를 일괄 중계하는 필수 DDS broker는 아니다. Fast DDS 문서는 discovery-server 구성에서도 endpoint 간 직접 통신을 설명한다. server가 꺼지거나 접근 불가능할 때 신규 발견과 topology 변화에 미치는 영향은 구성과 기존 매칭 상태에 따라 점검해야 한다. [Discovery Server](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/discovery/discovery_server.html)

## 포트 숫자를 다루는 법

Object Management Group(OMG) DDSI-RTPS의 well-known port mapping은 Domain ID와 participant ID를 이용해 기본 discovery·user unicast port 계산의 출발점을 제공한다. 예를 들어 기본 상수에서 `PB=7400`, `DG=250`, `PG=2`, `d0=0`, `d1=10`, `d2=1`, `d3=11`이면 Domain 0, participant index 0의 multicast discovery는 7400, discovery unicast는 7410, user unicast는 7411이 된다. 이 예시는 표준 매핑 조건 아래의 계산일 뿐 모든 제품 설정에서 해당 port가 열려 있거나 고정이라는 주장이 아니다. [OMG DDSI-RTPS §9.6.2.3](https://www.omg.org/spec/DDSI-RTPS/2.5/PDF)

실제 locator는 transport, participant index, port override, interface binding과 vendor 설정에 좌우된다. 같은 participant의 여러 topic이 각각 별도 UDP port를 갖는다고 가정해서 firewall 규칙을 만들지 않는다. 배포 전에 공식 설정값과 실제 host socket·packet capture를 확인해 필요한 범위를 좁힌다. 공유메모리 transport라면 IP/port 계산을 적용하지 않는다.

## 보안과 범위

Domain ID는 혼잡 또는 논리 구분에 도움이 되지만 보안 격리 수단이 아니다. 동일한 network 경로에 도달할 수 있는 참가자의 접근은 DDS Security의 participant 인증과 topic permissions, Operating System (OS)/network 방화벽 등으로 제한한다. Discovery metadata도 어떤 참가자가 무엇을 노출하는지 고려해야 한다. [DDS Security 개요](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/security.html)

DDS가 제공하는 논리 이름과 네트워크 주소의 차이는 [기본 개념]({% post_url 2026-10-13-dds-basics %})에, 인증과 topic 권한은 별도 security 글에 있다. 토픽을 찾을 수 있다는 사실은 command를 쓸 권한을 뜻하지 않는다.

## 실전 점검 순서

1. 모든 프로세스의 Domain ID, Topic 문자열, type 생성본·버전이 일치하는지 확인한다.
2. participant discovery가 multicast인지, initial peers인지, Discovery Server인지 기록한다.
3. 양쪽에서 활성 interface, advertised locator, route, firewall과 container NAT를 확인한다.
4. participant 발견과 endpoint 매칭 상태를 별도 로그로 구분한다. QoS incompatibility가 있는지 확인한다.
5. user data locator가 양방향 전달과 필요한 큰 샘플 크기를 지원하는지 확인한다.
6. 의도적으로 discovery port만, 그 다음 user data 경로만 차단해 로그와 상태전이를 구별한다.

이 순서는 진단 제안이며 여기 프로젝트에서 네트워크 차단 주입을 실행한 결과가 아니다. 프로젝트는 로컬 Docker Linux 환경의 UDPv4 통합만 수행했고 다중 호스트, 멀티 VLAN, NAT(Network Address Translation), packet-level discovery 검증은 기록돼 있지 않다.

## 조사 범위와 한계

2026-10-13에 OMG DDSI-RTPS와 Fast DDS 2.14.7의 discovery 문서를 확인했다. 실습은 Fast DDS 2.11.2 로컬 Linux VM(Virtual Machine) 결과다. 기본 포트 매핑은 표준 상수와 기본 participant index 조건으로 제한했으며, 제품 설정과 실제 방화벽 필요 port는 배포 구성에서 확인해야 한다. 임의의 네트워크 성능이나 상호운용 결과는 주장하지 않는다.

{% include knowledge-links.html %}
