---
layout: single
title: "LOSA·GVA·NGVA와 DDS: 아키텍처·데이터 모델·전달 계층"
date: 2026-10-13 00:00:00 +0900
categories: [system]
excerpt: "LOSA는 영국 지상체계 통합 접근, UK GVA와 NATO NGVA는 별도 적용 체계이며 DDS는 이들 전체를 대체하지 않는 데이터 분배 기술이다."
tags: [dds, gva, architecture, standards]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
knowledge_id: dds-gva-losa
knowledge_links: [dds-guide, dds-basics, dds-device-adapters, dds-discovery-addressing]
series: dds
permalink: /dds/gva-losa/
toc: true
toc_sticky: true
---

**LOSA는 영국 국방부의 지상 능력 통합 접근이고, UK GVA(Def Stan 23-009)와 NATO NGVA(STANAG 4754/AEP-4754)는 차량 체계에 적용하는 아키텍처·표준 계열이다. DDS는 일부 데이터 인프라에서 쓰이는 전달 표준이며, DDS를 사용했다는 사실만으로 어느 아키텍처의 적합성이 입증되지는 않는다.**

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=gva-losa" title="LOSA와 데이터 모델, 차량 아키텍처, DDS 데이터 인프라의 관계" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

> 위 그림은 계층을 구별하는 설명용 애니메이션이며 특정 차량 배치도나 적합성 시험 결과가 아니다. JavaScript가 없어도 구조는 읽을 수 있다. LOSA 아래에는 LDM과 차량·병사·기지 분야별 architecture가 있고, NGVA의 공개 표준은 data infrastructure와 NGVA data model, DDS 적용 관계를 별도 권으로 다룬다. 센서 어댑터가 의미를 맞춘 뒤에야 DDS로 소비자에게 분배할 수 있다.

## 이름과 범위

| 약어 | 풀어쓴 이름 | 이 글에서의 범위 |
|---|---|---|
| LOSA | Land Open Systems Architecture | UK MOD의 지상 능력 통합 접근. 공통 데이터 모델·개방형 표준·정의된 인터페이스를 묶는다. |
| LDM | Land Data Model | LOSA의 parent information model. GVA와 GSA 데이터 모델의 기반이다. |
| UK GVA | Generic Vehicle Architecture | UK Defence Standard 23-009에 연결된 군용 차량 전자·디지털 시스템 통합 아키텍처다. |
| NGVA | NATO Generic Vehicle Architecture | NATO STANAG 4754 및 AEP-4754 여러 권으로 정의하는 land vehicle architecture 계열이다. |
| DDS | Data Distribution Service | 데이터 중심 발행·구독 분배 표준. 데이터 의미 모델이나 차량 전체 구조와 동의어가 아니다. |

UK MOD 공식 LOSA 페이지는 LOSA의 네 가지 핵심 산출물을 LDM, GVA, GSA(Generic Soldier Architecture), GBA(Generic Base Architecture)로 설명한다. LDM에는 별도 Defence Standard가 없고 parent model 역할을 한다고 명시한다. 같은 페이지는 GVA를 Defence Standard 23-009, GSA를 23-012, GBA를 23-013과 연결한다. [UK MOD LOSA](https://www.gov.uk/government/publications/land-open-systems-architecture-losa)

이 구분은 데이터 형식과 전송을 나누는 데 유용하다. 예를 들어 heading 값이 `12.34`라는 숫자로 같아도 한 시스템은 degree, 다른 시스템은 radian을 쓰거나 기준 방향이 다르면 상호운용되지 않는다. 공통 data model은 그 값의 뜻·단위·시간·유효 상태를 합의하고, DDS는 호환되는 endpoint에 sample을 전달한다.

## 등장 이유와 표준의 계보

차량 안의 센서, 통신장비, crew display, command application이 각 공급사의 개별 인터페이스만 사용하면 장비를 교체할 때 여러 쌍의 변환과 시험을 다시 만들어야 한다. 공개 인터페이스와 공통 모델은 이런 bespoke integration 수를 줄이고, 시스템 수명 중 upgrade·교체 때 정보 의미를 유지하려는 수단이다. UK MOD는 LOSA가 공통 모델과 defined interfaces로 통합·교체의 bespoke effort와 vendor lock-in을 줄이도록 한다고 설명한다. 이는 정책 문서의 목적 설명이며 모든 프로그램에서 비용 절감이 측정됐다는 보고는 아니다.

**공개 근거가 보여주는 표준 계보**는 아래와 같다.

| 시기/자료 | 확인되는 사실 | 읽을 때의 한계 |
|---|---|---|
| UK GVA | MOD가 GVA를 Def Stan 23-009로 연결 | 이번에 확인한 LOSA 페이지는 표준 전체 개정 이력이나 최초 연구 시점을 밝히지 않음 |
| 2018-02 | NATO AEP-4754 Volume VII, Edition A Version 1이 promulgated 되었고 STANAG 4754에 대한 국가 합의를 기록 | 과거 edition을 현행 계약 판본으로 간주하면 안 됨 |
| 2018판 AEP-4754 구조 | Vol I architecture approach, II power infrastructure, III data infrastructure, IV crew terminal software, V data model, VI safety, VII V&V | 한 권만으로 전체 요구사항을 대표하지 않음 |
| 2026-09-21 | UK MOD가 LOSA 공식 페이지를 게시 | 페이지 게시일은 LOSA의 시작 연도가 아님 |

NATO GVA가 2026-10-13 확인 당시 공개한 표준 페이지는 STANAG 4754 **Edition 3**을 가리키며, Data Infrastructure와 Data Model AEP는 Edition B로 표시한다. Data Model V2.0.0은 2026-08-07 공지에서 release 준비 중이며 draft를 제공한다고 적혀 있어, 이를 승인된 정식 판본이라 단정하지 않는다. Edition A/2018 Volume VII는 이 글에서 실제 요구사항과 `NGVA Ready`/`Compliant` 정의를 살펴본 근거 판본이다. 계약에는 발주 시점의 적용 edition, AEP 판본, 모델 버전을 다시 고정해야 한다. [NATO NGVA 표준·AEP 목록과 2026-08-07 모델 공지](https://www.natogva.org/?members_page=256&s=5)

2018 AEP-4754 Volume VII는 NGVA가 MILVA의 주도 아래 개발됐다고 적고, 해당 AEP 묶음이 차량 통합, 데이터·전력 인프라, 안전과 V&V를 다룬다고 구성표에서 설명한다. 이 공개 자료는 표준 구성과 해당 edition의 사용 범위를 확인해 준다. GVA의 최초 고안자·시작 연도처럼 이 자료들이 직접 다루지 않는 기원은 미확인으로 남긴다. [AEP-4754 Vol VII, Edition A Version 1 (2018)](https://www.natogva.org/wordpress/wp-content/uploads/2023/05/AEP-4754_VOL_VII_EDA_V1_E.pdf) · [UK MOD LOSA 페이지 게시일과 설명](https://www.gov.uk/government/publications/land-open-systems-architecture-losa)

## LOSA와 NGVA는 어떻게 연결되는가

LOSA와 NGVA는 모두 land systems integration과 vehicle data interoperability를 다루지만 같은 이름의 표준 묶음이 아니다. LOSA는 UK MOD의 체계적 통합 접근이며, NGVA는 NATO 회원국 합의로 promulgate된 STANAG 4754 기반 표준이다. AEP-4754 Volume V는 NGVA Data Model, Model Driven Architecture, 구성관리, DDS middleware와 NGVA data model의 적용 가능성을 다룬다고 Volume VII의 표준 구조가 설명한다. 그러므로 NGVA에 DDS가 실제로 등장한다는 사실은 확인되지만, 이를 “DDS가 모든 LOSA/NGVA 통신을 독점한다”로 일반화할 수는 없다.

2018 AEP Volume VII는 requirements를 compulsory requirement(CR)와 optional enhancement(OE)로 나누고, 적용 edition과 국가 구현·reservation 상태를 확인하도록 안내한다. 또한 `NGVA Ready`는 subsystem/component 수준 통합 준비를 설명하고, `NGVA Compliant`는 플랫폼 전체에서 존재하는 subsystem이 STANAG 4754와 연결 AEP 요건을 만족하는 조건으로 정의한다. 즉 한 DDS component의 인터페이스가 맞는 것과 vehicle platform의 compliance 주장은 범위가 다르다. [AEP-4754 Vol VII, §§1.4, 2.5, 2.7, 5](https://www.natogva.org/wordpress/wp-content/uploads/2023/05/AEP-4754_VOL_VII_EDA_V1_E.pdf)

NATO GVA 공식 소개는 NGVA를 STANAG 4754로 지정하며, open standards를 바탕으로 군용 차량의 전자 subsystem을 통합한다고 요약한다. 이 짧은 소개는 용어의 표준 연결을 확인하는 자료다. 특정 국가의 발주 조건·현행 판본·예약 조항은 계약과 적용 국가의 자료를 별도로 확인해야 한다. [NATO GVA 공식 소개](https://www.natogva.org/)

## DDS와 장비 adapter가 맡는 경계

구조를 구체화하면 다음 세 층으로 나누어 생각할 수 있다.

```text
장비 protocol / bus
  RS-422 ICD, CAN identifier, Ethernet payload
          │
          ▼
장비 adapter: frame 검증 · 단위/좌표 변환 · validity · timestamp
          │
          ▼
공통 data model: 필드 의미 · 관계 · 단위 · version · key
          │
          ▼
DDS: Topic/type 기반 endpoint matching · QoS · sample distribution
          │
          ▼
다른 subsystem / controller / crew display
```

예를 들어 장비의 ICD가 signed 16-bit integer `1234`를 `0.01°` heading 단위로 정의한다고 가정한다. Adapter는 부호와 byte order, validity flag를 먼저 해석해 `12.34°`로 변환하고, 대상 모델이 요구하는 기준 축·timestamp·센서 식별자를 매핑한다. 이어 DDS Topic type으로 발행할 수 있다. 수치와 ICD 내용은 설명용 가정이며 실제 GVA field나 장비 사양을 인용한 것이 아니다.

CAN/RS-422 장비가 DDS native인 것도 아니다. adapter/gateway가 bus-specific framing을 받고 공통 model로 변환해야 한다. DDS에 raw byte 배열만 전달하면 서로 다른 subsystem이 그 byte의 단위·의미를 공유하게 되는 것은 아니다. 현장에서는 DDS의 topic/type mapping 외에도 network·IP·transport·타이밍·안전·전원·crew terminal 등 적용된 전체 요구사항이 남는다. [장비별 통신과 adapter]({% post_url 2026-10-13-dds-device-adapters %})에서 입력 경로를 더 다룬다.

## 선택 기준: 표준 준수와 기술 선택은 따로 질문한다

| 상황 | 우선 결정 | 확인할 자료 |
|---|---|---|
| 특정 UK MOD vehicle programme에 참여 | 적용 contract의 UK GVA 판본과 요구사항 | Def Stan 23-009의 적용 part/edition, ICD, tailoring, verification plan |
| NATO coalition vehicle interoperability가 목표 | STANAG 4754와 지정 AEP edition 요구 추적 | ratification/implementation, reservations, 국가 조달문서, 적용 V&V volume |
| 단일 제품 내부 sensor-to-controller 연결만 필요 | DDS 또는 더 단순한 local API/queue 중 선택 | 실시간 요구, 참여자 수, trust boundary, history, 운영·보안 비용 |
| legacy 장비를 공통 인터페이스에 연결 | adapter/gateway 경계와 model mapping 설계 | ICD, 단위·좌표계, 오류·시간·version mapping, 시험기준 |

DDS는 typed publish-subscribe, discovery, QoS 정책이 필요할 때 고려할 수 있다. 한 프로세스 안의 작은 데이터 교환이라면 function call이나 in-process queue가 더 단순할 수 있고, 영구 이벤트 감사가 중심이면 별도 log store를 검토한다. 어떤 transport를 고르든 표준화된 data semantics와 safety/authority 요구를 채웠는지는 따로 검증한다. [DDS 기본 개념]({% post_url 2026-10-13-dds-basics %})과 [주소·discovery]({% post_url 2026-10-13-dds-discovery-addressing %})가 이 층을 설명한다.

## 적합성 주장을 하기 전에

1. 프로그램·국가·계약이 요구하는 표준 식별자, 판본, errata, amendment를 확정한다.
2. LDM/GVA/NGVA data model의 version과 normative field, 단위, datatype, key, timestamp 의미를 확인한다.
3. 해당 DDS API·transport와 QoS가 요구된 profile 및 매핑을 만족하는지 제품 문서와 실제 구성으로 확인한다.
4. 장비 adapter가 protocol의 오류 코드·byte order·validity·freshness·실패 동작을 요구대로 매핑하는지 시험한다.
5. 연결성, 통신 호환, 기능 호환 및 상위 안전/보안/V&V 증거를 각 요구사항에 추적한다.
6. component의 `ready` 또는 middleware 기능 확인을 플랫폼 전체의 `compliant` 선언으로 확장하지 않는다.

NATO 문서의 Volume VII는 inspection, analysis, demonstration, test 및 독립성 수준과 verification 결과 기록을 별도로 설명한다. 이런 검증 구조가 있는 이유는 단순 연결 성공이 architecture·data semantics·vehicle system의 검증을 대체하지 않기 때문이다. 상호운용성 주장을 뒷받침하려면 대상 edition에 명시된 요구와 객관적 evidence를 연결해야 한다.

## 공개 적용 사례와 한계

이번에 실제로 읽은 공식 공개 자료는 LOSA가 UK MOD의 land capability integration 접근임을 설명하고, NATO AEP-4754가 vehicle platform requirements, data infrastructure 및 V&V 범위를 제시한다. 이 자료만으로 특정 회사의 현장 배치 규모, 공급사 선정 이유, 절감액, 운영 성과를 주장할 수는 없다. 제조사 공개 product sheet는 특정 제품 capability의 증거가 될 수 있지만 fleet-wide production case의 독립적인 결과 자료와 같지 않다.

프로젝트의 ROS-free C++ Fast DDS 학습 구조는 `sensor_sim → controller → status_viewer` 세 프로세스로 구성된 단일 호스트 실험이다. `SensorSample`은 학습용 타입이며 GVA/NGVA data model이 아니다. 실제 CAN·RS-422, 지정 data model, 여러 차량 시스템, DDS Security, GVA/NGVA verification을 시험하지 않았다. 2026-10-09의 unit/integration 결과를 표준 준수나 현장 사례로 확장하지 않는다.

## 조사 범위와 한계

2026-10-13에 UK MOD의 LOSA 페이지, NATO GVA 표준 페이지, 공개 AEP-4754 Volume VII(Edition A Version 1, 2018)를 원문에서 확인했다. UK GVA의 개별 Defence Standard 23-009 전체 문서와 최신 NATO edition의 모든 AEP 본문 및 국가별 implementation/reservations는 이 확인 범위에 포함하지 못했다. 따라서 계약 적용 판본과 세부 요구는 여기서 확정하지 않는다. GVA의 최초 역사와 기업별 production case도 확인 가능한 공개 근거가 없어 만들어 쓰지 않았다.

## 참고자료

- [UK MOD: Land Open Systems Architecture (LOSA)](https://www.gov.uk/government/publications/land-open-systems-architecture-losa)
- [NATO Generic Vehicle Architecture 공식 소개](https://www.natogva.org/)
- [NATO NGVA Edition 3·AEP 목록과 Data Model 업데이트](https://www.natogva.org/?members_page=256&s=5)
- [AEP-4754 Volume VII, Edition A Version 1 (2018)](https://www.natogva.org/wordpress/wp-content/uploads/2023/05/AEP-4754_VOL_VII_EDA_V1_E.pdf)

시리즈 전체 안내는 [DDS 가이드]({% post_url 2026-10-13-dds-guide %}), 실제 middleware 역할은 [DDS 기초]({% post_url 2026-10-13-dds-basics %})에서 시작한다.

{% include knowledge-links.html %}
