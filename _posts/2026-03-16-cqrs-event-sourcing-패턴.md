---
layout: single
title: "CQRS와 Event Sourcing 완전 가이드"
date: 2026-03-16 23:00:00 +0900
categories: backend
excerpt: "CQRS와 Event Sourcing은 읽기/쓰기 책임을 분리하고 상태 변화를 이벤트로 저장해 추적성과 확장성을 높이는 아키텍처 패턴이다."
toc: true
toc_sticky: true
tags: [cqrs, eventsourcing, ddd, architecture, backend]
source: "/home/dwkim/dwkim/docs/backend/cqrs-event-sourcing-패턴.md"
---
TL;DR
- 이 글은 CQRS와 Event Sourcing 완전 가이드의 핵심 개념과 실제 적용 포인트를 빠르게 정리한다.
- 왜 이 패턴/기법이 등장했는지 배경과 도입 이유를 함께 설명한다.
- 실무에서 바로 쓰기 위한 특징과 상세 내용을 원문 기반으로 정리한다.

## 1. 개념
CQRS와 Event Sourcing 완전 가이드의 정의와 핵심 원리를 먼저 이해하면 뒤의 구현 전략을 훨씬 정확하게 판단할 수 있다.

## 2. 배경
기존 방식의 한계와 운영상의 문제를 해결하기 위해 이 접근이 발전했다.

## 3. 이유
확장성, 안정성, 유지보수성, 보안을 함께 높이기 위해 이 설계가 필요하다.

## 4. 특징
핵심 특징은 표준화된 구조, 명확한 책임 분리, 그리고 운영 관점에서의 예측 가능성이다.

## 5. 상세 내용

# CQRS와 Event Sourcing 완전 가이드

> **작성일**: 2026-03-16
> **카테고리**: Backend / Distributed Systems / Architecture Patterns
> **키워드**: CQRS, Command Query Responsibility Segregation, Event Sourcing, Event Store, Projection, Aggregate, DDD, Eventual Consistency, Snapshot, Rehydration, Axon Framework, EventStoreDB, Marten

---

# 1. CQRS와 Event Sourcing이란?

## 1.1 전통적 CRUD 모델의 한계

```
┌─────────────────────────────────────────────────────────────────┐
│              전통적 CRUD 모델의 구조적 한계                      │
│                                                                 │
│  [전통 CRUD]                                                    │
│                                                                 │
│  Client ──── 읽기/쓰기 ────► ┌──────────────┐                  │
│                               │  Application │                  │
│                               │   (단일 모델) │                  │
│                               └──────┬───────┘                  │
│                                      │                          │
│                               ┌──────▼───────┐                  │
│                               │   Database   │                  │
│                               │ (동일 테이블) │                  │
│                               └──────────────┘                  │
│                                                                 │
│  한계 1: 읽기/쓰기 비율 불균형                                  │
│  ├── 대부분의 시스템: 읽기 90%+ / 쓰기 10% 이하                │
│  ├── 읽기 최적화 = 쓰기 비효율, 쓰기 최적화 = 읽기 비효율      │
│  └── 단일 모델로 양쪽 모두 최적화 불가                          │
│                                                                 │
│  한계 2: "왜 이 상태인가?" 대답 불가                            │
│  ├── 현재 상태만 저장 (UPDATE로 덮어씀)                         │
│  ├── 주문 금액이 왜 변경됐는지 알 수 없음                      │
│  └── 감사 추적(audit trail) 부재                                │
│                                                                 │
│  한계 3: 독립적 확장 불가                                       │
│  ├── 읽기 트래픽 폭증 → 전체 시스템 스케일업 필요              │
│  └── 쓰기 최적화(인덱스 제거) → 읽기 성능 저하                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 CQS에서 CQRS로: 개념의 진화

```
┌─────────────────────────────────────────────────────────────────┐
│              CQS → CQRS: 메서드에서 아키텍처로                  │
│                                                                 │
│  [CQS] Command Query Separation (1988, Bertrand Meyer)          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "모든 메서드는 Command 또는 Query 중 하나여야 한다"     │    │
│  │                                                          │    │
│  │  Command (명령)                Query (질의)              │    │
│  │  ├── 상태를 변경한다           ├── 상태를 반환한다       │    │
│  │  ├── 아무것도 반환하지 않음    ├── 상태를 변경하지 않음  │    │
│  │  └── 예: setName("Kim")       └── 예: getName()         │    │
│  │                                                          │    │
│  │  범위: 하나의 객체, 메서드 레벨                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [CQRS] Command Query Responsibility Segregation                │
│         (2010, Greg Young)                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  CQS의 원칙을 아키텍처 수준으로 확장                     │    │
│  │                                                          │    │
│  │  핵심 변화:                                              │    │
│  │  ├── Separation → Segregation (물리적 격리)             │    │
│  │  ├── Responsibility 추가 (SRP에서 차용)                 │    │
│  │  └── 메서드 → 모델/서비스/DB 수준 분리                  │    │
│  │                                                          │    │
│  │  Command Side          Query Side                        │    │
│  │  ┌────────────┐       ┌────────────┐                    │    │
│  │  │ Write Model │       │ Read Model  │                    │    │
│  │  │ (행위 중심) │       │ (표현 중심) │                    │    │
│  │  └──────┬─────┘       └──────┬─────┘                    │    │
│  │         │                    │                            │    │
│  │    ┌────▼────┐         ┌────▼────┐                      │    │
│  │    │Write DB │────────►│Read DB  │                      │    │
│  │    └─────────┘  동기화  └─────────┘                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Event Sourcing: 회계 장부에서 소프트웨어로

```
┌─────────────────────────────────────────────────────────────────┐
│              Event Sourcing = 디지털 복식부기                    │
│                                                                 │
│  [복식부기] (1494, Luca Pacioli)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  날짜      차변(Debit)    대변(Credit)    잔액           │    │
│  │  3/1       +1,000,000                    1,000,000      │    │
│  │  3/5                     -200,000        800,000        │    │
│  │  3/10      +500,000                      1,300,000      │    │
│  │                                                          │    │
│  │  규칙: 절대 수정하지 않는다. 잘못 기록하면 반대 분개.    │    │
│  │  현재 잔액 = 모든 거래 내역의 합                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Event Sourcing]                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  전통 방식: 현재 상태만 저장                             │    │
│  │  ┌─────────────────────┐                                │    │
│  │  │ Account             │                                │    │
│  │  │ balance: 1,300,000  │  ← 왜 이 금액인지 모름        │    │
│  │  └─────────────────────┘                                │    │
│  │                                                          │    │
│  │  Event Sourcing: 모든 변경을 이벤트로 저장               │    │
│  │  ┌─────────────────────────────────────────────┐        │    │
│  │  │ Event #1: AccountOpened   { amount: 1000000 }│        │    │
│  │  │ Event #2: MoneyWithdrawn  { amount: 200000  }│        │    │
│  │  │ Event #3: MoneyDeposited  { amount: 500000  }│        │    │
│  │  └─────────────────────────────────────────────┘        │    │
│  │  현재 잔액 = 이벤트 순차 적용 결과 = 1,300,000          │    │
│  │                                                          │    │
│  │  Git도 Event Sourcing이다!                               │    │
│  │  ├── commit = event (변경 이력)                          │    │
│  │  ├── working directory = 현재 상태 (projection)          │    │
│  │  └── checkout = rehydration (특정 시점 복원)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.4 CQRS + Event Sourcing 조합의 의미

```
┌─────────────────────────────────────────────────────────────────┐
│              CQRS + Event Sourcing = 자연스러운 조합             │
│                                                                 │
│  Greg Young:                                                    │
│  "Event Sourcing 없이 CQRS는 가능하다.                         │
│   CQRS 없이 Event Sourcing은 사실상 불가능하다."               │
│                                                                 │
│  이유:                                                          │
│  ├── ES의 Event Store → 쓰기에 최적화 (append-only)            │
│  ├── 읽기가 느림 (매번 이벤트 재생 필요)                       │
│  └── 별도 Read Model(Projection)이 필수 → 자연스럽게 CQRS     │
│                                                                 │
│  ┌──────────┐  Command  ┌──────────┐  Event   ┌──────────┐    │
│  │  Client  │─────────►│ Command  │────────►│  Event   │    │
│  │          │           │ Handler  │          │  Store   │    │
│  └────┬─────┘           └──────────┘          └────┬─────┘    │
│       │                                            │           │
│       │  Query   ┌──────────┐  Subscribe  ┌───────▼────┐     │
│       └────────►│  Query   │◄────────────│ Projection │     │
│                  │ Handler  │              │  (동기화)   │     │
│                  └────┬─────┘              └────────────┘     │
│                       │                                        │
│                  ┌────▼─────┐                                  │
│                  │ Read DB  │                                  │
│                  │(최적화됨)│                                  │
│                  └──────────┘                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어 사전

| 용어 | 풀네임 / 어원 | 의미 |
|------|---------------|------|
| **CQRS** | Command Query Responsibility Segregation | 명령(쓰기)과 질의(읽기)의 책임을 물리적으로 분리하는 아키텍처 패턴 |
| **CQS** | Command Query Separation (Bertrand Meyer, 1988) | 메서드 레벨에서 명령과 질의를 분리하는 객체지향 원칙. CQRS의 이론적 기원 |
| **Event Sourcing** | "Sourcing" = Source of Truth에서 유래 | 상태가 아닌 상태 변경 이벤트를 저장하고, 이벤트를 재생하여 현재 상태를 도출 |
| **Event Store** | Event + Store(저장소) | 이벤트를 시간순으로 저장하는 append-only 저장소. Source of Truth |
| **Projection** | 라틴어 proicere("앞으로 던지다"), 수학의 투영 | 이벤트 스트림을 특정 관점의 Read Model로 변환(투영)하는 과정 |
| **Read Model** | - | Query Side에서 사용하는 비정규화된 데이터 모델. 논리적 개념 |
| **Materialized View** | Materialize = "실체화하다" | Read Model의 물리적 구현. 사전 계산된 뷰를 실제 저장소에 보관 |
| **Aggregate** | 라틴어 aggregare("모으다"). DDD 용어 | 일관성 경계를 이루는 도메인 객체 클러스터. 트랜잭션의 단위 |
| **Command** | 라틴어 commandare("명령하다") | 시스템 상태 변경을 요청하는 의도. 거부될 수 있음 |
| **Event** | 라틴어 eventus("결과, 발생한 것") | 이미 발생한 사실. 과거형으로 명명. 불변(immutable) |
| **Query** | 라틴어 quaerere("묻다, 찾다") | 상태를 조회하는 요청. 부작용 없음 |
| **Snapshot** | 사진 용어 "스냅샷" | 특정 시점의 Aggregate 상태를 통째로 저장. Rehydration 성능 최적화 |
| **Rehydration** | 의학 "재수화(re-hydrate)" | 저장된 이벤트로부터 Aggregate의 현재 상태를 복원하는 과정 |
| **Replay** | 녹화 "재생" | 이벤트를 처음부터 다시 적용하여 상태나 Projection을 재구축 |
| **Eventual Consistency** | Werner Vogels (2007/2008) | "결국에는" 모든 노드가 일관된 상태에 도달. 즉각적 일관성의 대안 |
| **Optimistic Concurrency** | "낙관적" 동시성 제어 | 충돌이 드물다고 가정. expectedVersion으로 쓰기 시점에 충돌 감지 |
| **Upcasting** | 타입 캐스팅에서 유래 | 오래된 이벤트를 새 스키마로 변환하는 기법 |
| **Correlation ID** | Correlate = "상관시키다" | 하나의 비즈니스 흐름에 속한 모든 이벤트를 추적하는 ID |
| **Causation ID** | Cause = "원인" | 이 이벤트를 직접 유발한 이전 이벤트/커맨드의 ID |
| **Fat Event** | - | 소비자가 필요한 모든 데이터를 포함하는 이벤트. 서비스 간 통합용 |
| **Thin Event** | - | 최소한의 식별 정보만 포함하는 이벤트. 서비스 내부용 |
| **Dead Letter Queue** | "배달 불능 편지함" | 처리 실패한 이벤트를 격리하는 대기열 |

---

# 3. 역사와 학술적 배경

## 3.1 연대표

```
┌─────────────────────────────────────────────────────────────────┐
│              CQRS / Event Sourcing 진화 연대표                  │
│                                                                 │
│  1494  Luca Pacioli — 복식부기 체계화                           │
│    │   (Event Sourcing의 원형: append-only 거래 장부)           │
│    │                                                            │
│  1988  Bertrand Meyer — CQS 원칙 (OOSC 초판)                   │
│    │   "메서드는 Command 또는 Query 중 하나여야 한다"           │
│    │                                                            │
│  2000  Eric Brewer — CAP Theorem 추측 (PODC 기조강연)           │
│  2002  Gilbert & Lynch — CAP 정리 증명 (MIT)                    │
│    │                                                            │
│  2003  Eric Evans — "Domain-Driven Design" 출간                 │
│    │   Aggregate, Bounded Context, Repository 패턴 정의         │
│    │                                                            │
│  2005  Martin Fowler — Event Sourcing 패턴 문서화 (12/12)       │
│    │                                                            │
│  2006  Greg Young — CQRS 첫 언급 (ALT.NET 커뮤니티)            │
│    │                                                            │
│  2007  Pat Helland — "Life beyond Distributed Transactions"     │
│    │   (CIDR 2007). 대규모 분산 시스템 트랜잭션 한계 논의       │
│  2007  Werner Vogels — "Eventually Consistent" 초고             │
│  2008  Werner Vogels — ACM Queue 정식 게재                      │
│    │                                                            │
│  2009  Udi Dahan — "Clarified CQRS" (12/9)                      │
│    │   "CQRS ≠ Event Sourcing. 반드시 결합할 필요 없다"         │
│  2009  Axon Framework 탄생 (Allard Buijze, Java)                │
│    │                                                            │
│  2010  Greg Young — "CQRS Documents" 공식 발표 (11월, 56p PDF)  │
│    │                                                            │
│  2012  EventStoreDB 출시 (9/17, Greg Young 직접 개발)           │
│    │                                                            │
│  2013  Reactive Manifesto v1.0 (Jonas Boner 외)                 │
│    │                                                            │
│  2015  Marten 프로젝트 시작 (.NET + PostgreSQL)                 │
│    │   마이크로서비스 아키텍처 대중화                            │
│    │                                                            │
│  2017  "Designing Data-Intensive Applications" 출간 (Kleppmann) │
│  2017  AxonIQ 회사 설립 (Axon Framework 상용화)                 │
│    │                                                            │
│  2018+ Kafka Streams/ES 대중화, Temporal 등장 (2019)            │
│    │                                                            │
│  2022+ 프레임워크 성숙기, 서버리스 ES, AI 에이전트 아키텍처     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 학술적 기반

```
┌─────────────────────────────────────────────────────────────────┐
│              핵심 이론적 토대                                    │
│                                                                 │
│  CAP Theorem (Brewer 2000, Gilbert & Lynch 2002)                │
│  ├── Consistency, Availability, Partition Tolerance              │
│  ├── 네트워크 분할 시 C와 A 중 선택해야 함                     │
│  └── CQRS/ES는 AP 선택 후 Eventual Consistency로 C 보완        │
│                                                                 │
│  BASE (Basically Available, Soft state, Eventually consistent)  │
│  ├── ACID의 대안                                                │
│  └── CQRS Read Model은 Soft State의 전형적 예시                │
│                                                                 │
│  Pat Helland — "Life beyond Distributed Transactions"           │
│  ├── 대규모 시스템에서 분산 트랜잭션은 비현실적                 │
│  ├── "Activity" 단위 + 보상으로 일관성 확보                    │
│  └── CQRS + ES의 이론적 정당성을 제공                          │
│                                                                 │
│  DDD (Eric Evans 2003)                                          │
│  ├── Aggregate = 일관성 경계 = ES의 이벤트 스트림 단위          │
│  ├── Bounded Context = CQRS 적용 범위                           │
│  └── Ubiquitous Language = 이벤트 이름의 근거                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 핵심 인물과 기여

| 인물 | 기여 | 핵심 저작 |
|------|------|-----------|
| **Bertrand Meyer** | CQS 원칙 창시 | Object-Oriented Software Construction (1988/1997) |
| **Eric Evans** | DDD, Aggregate, Bounded Context | Domain-Driven Design (2003) |
| **Greg Young** | CQRS 공식화, EventStoreDB 개발 | CQRS Documents (2010) |
| **Udi Dahan** | CQRS 명확화, NServiceBus | Clarified CQRS (2009) |
| **Martin Fowler** | Event Sourcing 패턴 문서화 | martinfowler.com (2005) |
| **Pat Helland** | 분산 트랜잭션 한계 이론화 | Life beyond Distributed Transactions (2007) |
| **Werner Vogels** | Eventual Consistency 정립 | ACM Queue (2008) |
| **Martin Kleppmann** | 데이터 중심 아키텍처 종합 | Designing Data-Intensive Applications (2017) |

---

# 4. CQRS 구현 3단계

## 4.1 Level 1: Simple CQRS (단일 DB, 모델 분리)

```
┌─────────────────────────────────────────────────────────────────┐
│              Level 1: Simple CQRS                               │
│                                                                 │
│  코드 수준에서 읽기/쓰기 모델 분리. DB는 하나.                 │
│                                                                 │
│           ┌──────────────┐      ┌──────────────┐               │
│  Command ►│ Write Model  │      │  Read Model  │◄ Query        │
│           │ (OrderAggregate)    │ (OrderSummaryDTO)             │
│           └──────┬───────┘      └──────┬───────┘               │
│                  │                     │                        │
│                  └────────┬────────────┘                        │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │  Single DB  │                              │
│                    │ (PostgreSQL)│                              │
│                    └─────────────┘                              │
│                                                                 │
│  장점: 낮은 복잡도, 인프라 변경 없음, 코드 정리 효과           │
│  단점: 독립 스케일링 불가, 성능 개선 제한적                     │
│  적합: CQRS 첫 도입, 복잡한 도메인 모델 정리                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 Level 2: Separate Storage (읽기/쓰기 DB 분리)

```
┌─────────────────────────────────────────────────────────────────┐
│              Level 2: Separate Storage CQRS                     │
│                                                                 │
│  읽기/쓰기 DB를 물리적으로 분리. 동기화 필요.                  │
│                                                                 │
│           ┌──────────────┐      ┌──────────────┐               │
│  Command ►│ Write Model  │      │  Read Model  │◄ Query        │
│           └──────┬───────┘      └──────┬───────┘               │
│                  │                     │                        │
│           ┌──────▼───────┐      ┌──────▼───────┐               │
│           │  Write DB    │      │   Read DB    │               │
│           │ (PostgreSQL) │      │ (Elasticsearch│               │
│           └──────┬───────┘      │  / Redis)    │               │
│                  │              └──────▲───────┘               │
│                  │    동기화          │                        │
│                  └──────────────────────┘                        │
│                  (CDC / Event / Message)                        │
│                                                                 │
│  장점: 독립 스케일링, 읽기 최적화 자유도, 기술 다양성          │
│  단점: Eventual Consistency, 동기화 인프라 필요                 │
│  적합: 읽기 트래픽이 압도적, 읽기에 특화 DB 필요한 경우        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.3 Level 3: CQRS + Event Sourcing (완전한 형태)

```
┌─────────────────────────────────────────────────────────────────┐
│              Level 3: CQRS + Event Sourcing                     │
│                                                                 │
│  Event Store가 Source of Truth. Projection이 Read Model 생성.  │
│                                                                 │
│  Command ──► ┌──────────────┐                                  │
│              │   Command    │                                  │
│              │   Handler    │                                  │
│              └──────┬───────┘                                  │
│                     │ validate + emit events                   │
│              ┌──────▼───────┐                                  │
│              │  Aggregate   │                                  │
│              │  (도메인)     │                                  │
│              └──────┬───────┘                                  │
│                     │ append                                   │
│              ┌──────▼───────┐                                  │
│              │  Event Store │ ◄── Source of Truth               │
│              │ (append-only)│                                  │
│              └──────┬───────┘                                  │
│                     │ subscribe                                │
│              ┌──────▼───────┐      ┌──────────────┐           │
│              │  Projection  │─────►│   Read DB    │◄── Query  │
│              │  (이벤트→뷰) │      │ (최적화된 뷰) │           │
│              └──────────────┘      └──────────────┘           │
│                                                                 │
│  장점: 완전한 감사 추적, 시간여행, 이벤트 기반 통합            │
│  단점: 높은 복잡도, Eventual Consistency, 학습 곡선            │
│  적합: 금융, 복잡한 도메인, 감사/규제 요구, 이벤트 기반 MSA   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Event Sourcing 핵심 메커니즘

## 5.1 Event Store 구조

```
┌─────────────────────────────────────────────────────────────────┐
│              Event Store 테이블 구조                             │
│                                                                 │
│  CREATE TABLE events (                                          │
│      event_id        UUID PRIMARY KEY,                          │
│      stream_id       VARCHAR(255) NOT NULL,   -- Aggregate ID  │
│      stream_type     VARCHAR(255) NOT NULL,   -- Aggregate 타입│
│      version         INTEGER NOT NULL,        -- 순서 보장     │
│      event_type      VARCHAR(255) NOT NULL,   -- 이벤트 종류   │
│      data            JSONB NOT NULL,          -- 이벤트 페이로드│
│      metadata        JSONB NOT NULL,          -- 부가 정보     │
│      created_at      TIMESTAMP NOT NULL,                        │
│      UNIQUE(stream_id, version)               -- OCC 핵심!     │
│  );                                                             │
│                                                                 │
│  metadata 예시:                                                 │
│  {                                                              │
│    "correlation_id": "order-flow-abc-123",  -- 비즈니스 흐름   │
│    "causation_id": "cmd-place-order-456",   -- 원인 추적       │
│    "user_id": "user-789",                   -- 누가 발생시켰나 │
│    "timestamp": "2026-03-16T10:30:00Z"                         │
│  }                                                              │
│                                                                 │
│  핵심 규칙:                                                     │
│  ├── Append-only: UPDATE, DELETE 절대 금지                      │
│  ├── stream_id = Aggregate 인스턴스 (예: "order-123")           │
│  ├── version = 같은 stream 내 순서 (1, 2, 3, ...)              │
│  └── UNIQUE(stream_id, version) = Optimistic Concurrency 보장  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Aggregate Rehydration (이벤트 재생)

```
┌─────────────────────────────────────────────────────────────────┐
│              Rehydration: 이벤트로부터 상태 복원                 │
│                                                                 │
│  1. Event Store에서 이벤트 로드                                 │
│     SELECT * FROM events                                        │
│     WHERE stream_id = 'order-123'                               │
│     ORDER BY version ASC                                        │
│                                                                 │
│  2. 빈 Aggregate 생성 후 순차 적용                              │
│                                                                 │
│     OrderAggregate (empty)                                      │
│         │                                                       │
│         ▼ apply(OrderCreated { id: 123, items: [...] })         │
│     OrderAggregate { status: CREATED, items: [...] }            │
│         │                                                       │
│         ▼ apply(PaymentReceived { amount: 50000 })              │
│     OrderAggregate { status: PAID, amount: 50000 }              │
│         │                                                       │
│         ▼ apply(OrderShipped { tracking: "KR123" })             │
│     OrderAggregate { status: SHIPPED, tracking: "KR123" }       │
│         │                                                       │
│     = 현재 상태 (version 3)                                     │
│                                                                 │
│  의사코드:                                                      │
│  fun rehydrate(streamId):                                       │
│      events = eventStore.load(streamId)                         │
│      aggregate = new OrderAggregate()                           │
│      for event in events:                                       │
│          aggregate.apply(event)                                 │
│      return aggregate                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 Snapshot 전략

```
┌─────────────────────────────────────────────────────────────────┐
│              Snapshot: Rehydration 성능 최적화                   │
│                                                                 │
│  문제: 이벤트가 수천 개 쌓이면 Rehydration이 느려짐            │
│                                                                 │
│  Snapshot 없이:                                                 │
│  Event #1 → #2 → #3 → ... → #9999 → #10000 → 현재 상태        │
│  (10,000개 이벤트 모두 재생 = 느림)                             │
│                                                                 │
│  Snapshot 적용:                                                 │
│  [Snapshot @v9900] → Event #9901 → ... → #10000 → 현재 상태    │
│  (스냅샷 + 100개만 재생 = 빠름)                                 │
│                                                                 │
│  전략 3가지:                                                    │
│  ├── Every N events: N개마다 자동 스냅샷 (예: 100개마다)       │
│  ├── Time-based: 주기적으로 스냅샷 (예: 매 시간)               │
│  └── On-demand: 특정 조건 시 수동 생성                         │
│                                                                 │
│  Greg Young의 조언:                                             │
│  "이벤트 1000개 이하면 Snapshot이 불필요하다.                   │
│   먼저 측정하라. 대부분은 필요 없다."                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 Projection 구축 방식

```
┌─────────────────────────────────────────────────────────────────┐
│              Projection: 이벤트 → Read Model 변환               │
│                                                                 │
│  [Synchronous Projection]                                       │
│  ├── 이벤트 저장과 동시에 Read Model 업데이트                  │
│  ├── Strong Consistency 가능                                    │
│  └── 쓰기 지연 증가, 장애 전파 위험                            │
│                                                                 │
│  [Asynchronous Projection] ← 권장                               │
│  ├── 이벤트 발행 후 별도 프로세스가 Read Model 업데이트        │
│  ├── Eventual Consistency                                       │
│  └── 쓰기 성능 영향 없음, 독립 장애 격리                       │
│                                                                 │
│  구독 방식:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Catch-up Subscription                                   │    │
│  │  ├── "처음부터 따라잡기"                                  │    │
│  │  ├── 마지막 처리 위치(checkpoint) 기억                    │    │
│  │  ├── 재시작 시 checkpoint부터 재개                        │    │
│  │  └── Projection 재구축(replay)에 적합                    │    │
│  │                                                          │    │
│  │  Persistent Subscription                                 │    │
│  │  ├── Event Store가 소비자별 위치 관리                    │    │
│  │  ├── 경쟁 소비자(competing consumers) 지원               │    │
│  │  └── 실시간 처리 + 수평 확장에 적합                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.5 Optimistic Concurrency Control

```
┌─────────────────────────────────────────────────────────────────┐
│              OCC: 낙관적 동시성 제어                             │
│                                                                 │
│  원리: "충돌은 드물다"고 가정하고, 쓰기 시점에 검증             │
│                                                                 │
│  User A: load(order-123) → version 5                            │
│  User B: load(order-123) → version 5                            │
│                                                                 │
│  User A: append(event, expectedVersion=5) → OK (version 6)     │
│  User B: append(event, expectedVersion=5) → CONFLICT!           │
│          (현재 version이 이미 6이므로 거부)                     │
│                                                                 │
│  SQL로 구현:                                                    │
│  INSERT INTO events (stream_id, version, ...)                   │
│  VALUES ('order-123', 6, ...)                                   │
│  -- UNIQUE(stream_id, version) 제약 조건이 충돌 감지!           │
│                                                                 │
│  충돌 시 처리:                                                  │
│  ├── 재시도: 최신 상태 reload → 재검증 → 재시도                │
│  ├── 머지: 두 변경이 호환 가능하면 병합                        │
│  └── 거부: 사용자에게 "다시 시도해주세요" 응답                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.6 Event Versioning

```
┌─────────────────────────────────────────────────────────────────┐
│              Event Versioning: 스키마 진화 전략                  │
│                                                                 │
│  이벤트는 불변이므로, 스키마가 바뀌면 이전 이벤트와 공존 필요  │
│                                                                 │
│  전략 1: Weak Schema (기본값, 권장)                              │
│  ├── 새 필드 추가 시 기본값 사용                                │
│  ├── 소비자가 없는 필드는 무시                                  │
│  └── JSON의 유연성 활용                                         │
│                                                                 │
│  전략 2: Upcasting                                              │
│  ├── 읽기 시점에 오래된 이벤트를 새 형식으로 변환               │
│  ├── 원본 이벤트는 그대로 유지 (불변성 보장)                   │
│  └── 변환 로직을 파이프라인으로 구성                            │
│      v1 → Upcaster(v1→v2) → Upcaster(v2→v3) → v3             │
│                                                                 │
│  전략 3: Copy-and-Transform                                     │
│  ├── 새 스트림으로 변환된 이벤트를 복사                         │
│  ├── 대규모 마이그레이션에 적합                                 │
│  └── 다운타임 필요, 원본 보존                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. 대안 비교 분석

## 6.1 CQRS vs 전통 CRUD

| 기준 | 전통 CRUD | CQRS |
|------|-----------|------|
| **복잡도** | 낮음 | 높음 (최소 2배 코드) |
| **일관성** | 강한 일관성 (ACID) | Eventual Consistency (Level 2+) |
| **확장성** | 수직 확장 위주 | 읽기/쓰기 독립 수평 확장 |
| **읽기 최적화** | 제한적 (동일 모델) | 자유도 높음 (용도별 Read Model) |
| **온보딩** | 즉시 | 팀 학습 6-12개월 |
| **적합 시나리오** | 단순 CRUD, 관리 도구 | 읽기/쓰기 비율 불균형, 복잡 도메인 |

## 6.2 CQRS 단독 vs CQRS + Event Sourcing

| 기준 | CQRS 단독 | CQRS + ES |
|------|-----------|-----------|
| **Source of Truth** | 상태 기반 DB | Event Store |
| **감사 추적** | 별도 구현 필요 | 내장 |
| **시간여행** | 불가 | 가능 (이벤트 replay) |
| **복잡도** | 중간 | 높음 |
| **Projection 재구축** | 불가 | 언제든 가능 |
| **Greg Young 조언** | "ES 없이 CQRS를 먼저 시도하라" | 감사/시간여행 필요 시 |

## 6.3 Event Sourcing vs CDC (Change Data Capture)

| 기준 | Event Sourcing | CDC (예: Debezium) |
|------|----------------|---------------------|
| **이벤트 수준** | 비즈니스 도메인 이벤트 | DB 물리적 변경 (row-level) |
| **의미** | "주문이 생성되었다" | "orders 테이블에 INSERT 발생" |
| **애플리케이션 변경** | 필수 (큰 변경) | 최소 (DB 로그 활용) |
| **기존 시스템 적용** | 어려움 (재설계) | 쉬움 (비침투적) |
| **Debezium 권고** | - | "대부분 CDC+Outbox가 ES보다 나은 대안" |

## 6.4 Event Sourcing vs Audit Log 테이블

| 기준 | Event Sourcing | Audit Log 테이블 |
|------|----------------|-------------------|
| **목적** | Source of Truth + 이벤트 기반 아키텍처 | 법적 감사 기록 |
| **상태 복원** | 가능 (replay) | 불가 |
| **이벤트 소비** | Projection, 통합, 알림 등 | 조회 전용 |
| **복잡도** | 높음 | 낮음 |
| **선택 기준** | 이벤트 기반 통합 필요 시 | 법적 감사만 필요 시 |

## 6.5 프레임워크 비교표

| 프레임워크 | 언어 | 특징 | 성능 (writes/sec) |
|------------|------|------|--------------------|
| **EventStoreDB** | 다중 (gRPC) | 전용 ES DB, Greg Young 개발, Persistent Subscription | ~15K |
| **Axon Framework** | Java/Spring | Annotation 기반, Saga 내장, Axon Server | 프레임워크 의존 |
| **Marten** | .NET (C#) | PostgreSQL JSONB 활용, 인프라 추가 불필요 | 조건부 4~15x (vs ESDB) |
| **Akka Persistence** | Scala/Java | Actor 모델, Journal Plugin 아키텍처 | Actor 수에 비례 |
| **직접 구현** | 아무 언어 | PostgreSQL events 테이블 + JSONB | DB 성능에 의존 |
| **Kafka (Event Store용)** | - | **안티패턴!** Aggregate 단위 조회 불가, OCC 없음 | 높은 throughput |

> **주의**: Kafka는 Event Store가 아니라 Event Bus(전송 계층)로 사용해야 한다. Aggregate 단위 이벤트 조회와 Optimistic Concurrency를 지원하지 않는다.

---

# 7. 상황별 최적 선택

## 7.1 판단 트리

```
┌─────────────────────────────────────────────────────────────────┐
│              의사결정 플로우차트                                 │
│                                                                 │
│  시작: 새로운 시스템 설계                                       │
│    │                                                            │
│    ▼                                                            │
│  도메인이 단순한가? (CRUD 위주, 비즈니스 규칙 적음)             │
│    ├── YES → 전통 CRUD (CQRS 쓰지 마라)                        │
│    └── NO ──▼                                                   │
│             읽기/쓰기 비율이 극단적인가? (읽기 95%+)            │
│               ├── YES → CQRS 단독 + Read Cache                  │
│               └── NO ──▼                                        │
│                        감사추적/시간여행이 필요한가?             │
│                          ├── NO ──▼                              │
│                          │        복잡한 도메인 로직이 있는가?  │
│                          │          ├── NO → CQRS 단독          │
│                          │          └── YES → CQRS + DDD        │
│                          └── YES ──▼                             │
│                                   기존 시스템인가?              │
│                                     ├── YES → CDC (Debezium)    │
│                                     │         + 점진적 전환     │
│                                     └── NO ──▼                  │
│                                             CQRS + ES           │
│                                             (+ DDD 권장)        │
│                                                                 │
│  부가 판단:                                                     │
│  ├── 스타트업 MVP → CRUD 먼저. 검증 후 전환                    │
│  ├── 법적 감사만 필요 → Audit Log 테이블로 충분                │
│  └── 이벤트 기반 MSA → CQRS + ES + Kafka (전송 계층)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 상황별 가이드

| 상황 | 권장 패턴 | 이유 |
|------|-----------|------|
| 단순 CRUD 앱 / 관리 도구 | 전통 CRUD | 불필요한 복잡도 회피 |
| 읽기 95%+ / 대시보드 | CQRS 단독 (Level 1~2) | 읽기 최적화만 필요 |
| 금융 / 의료 / 법률 | CQRS + ES | 감사추적 필수, 규제 준수 |
| 복잡한 도메인 (보험, 물류) | CQRS + ES + DDD | 도메인 복잡성 관리 |
| 이벤트 기반 MSA | CQRS + ES + Kafka | 서비스 간 이벤트 통합 |
| 기존 시스템 현대화 | CDC (Debezium) | 비침투적, 점진적 전환 |
| 스타트업 MVP | CRUD → 추후 전환 | 빠른 검증 우선 |

## 7.3 실제 사례

```
┌─────────────────────────────────────────────────────────────────┐
│              실제 적용 사례                                      │
│                                                                 │
│  LMAX Exchange (금융 거래소)                                    │
│  ├── 단일 JVM 스레드로 초당 600만 주문 처리                    │
│  ├── Command Sourcing (커맨드 자체를 저장)                     │
│  └── Event Sourcing + 메모리 기반 Projection                   │
│                                                                 │
│  이커머스 (주문 파이프라인)                                     │
│  ├── OrderCreated → PaymentProcessed → OrderShipped            │
│  ├── 각 이벤트가 다음 단계를 트리거                            │
│  └── 다중 Projection: 주문 현황, 매출 통계, 재고 현황          │
│                                                                 │
│  게임 (리플레이/안티치트)                                       │
│  ├── 플레이어 액션을 이벤트로 저장                             │
│  ├── 리플레이: 이벤트 재생으로 게임 재현                       │
│  └── 안티치트: 이벤트 시퀀스 분석으로 부정 행위 탐지           │
│                                                                 │
│  IoT (센서 데이터)                                              │
│  ├── 센서 → Event Store (고속 append)                          │
│  ├── Projection 1: 실시간 대시보드                             │
│  ├── Projection 2: 이상 탐지                                   │
│  └── Projection 3: 일간/월간 집계                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7.4 성능 특성

| 작업 | 성능 특성 | 비고 |
|------|-----------|------|
| **쓰기** | append-only (잠금 없음) → 매우 빠름 | CRUD의 UPDATE (잠금 필요)보다 유리 |
| **읽기 (Projection)** | pre-computed → 매우 빠름 | 비정규화된 Read Model 직접 조회 |
| **읽기 (Rehydration)** | 이벤트 수에 비례 | 10K 이벤트 replay: ~50ms (PostgreSQL) |
| **Snapshot 없이 1M 이벤트** | 수 초 ~ 수십 초 | 비실용적. Snapshot 필수 |
| **Projection 재구축** | 전체 이벤트 수에 비례 | Blue-Green 방식 권장 |

---

# 8. 베스트 프랙티스

## 8.1 Event 설계 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│              Event 설계 원칙                                     │
│                                                                 │
│  1. 과거형으로 명명 (이미 발생한 사실)                          │
│     ├── OK:  OrderPlaced, PaymentReceived, ItemShipped          │
│     └── BAD: PlaceOrder, ReceivePayment, ShipItem               │
│                                                                 │
│  2. 도메인 언어(Ubiquitous Language) 사용                       │
│     ├── OK:  CartCheckedOut (비즈니스 의미 명확)                │
│     └── BAD: CartDataUpdated (기술 용어, 의미 불명)             │
│                                                                 │
│  3. Thin Event (내부) + Fat Integration Event (외부)            │
│     ├── 내부 이벤트: OrderPlaced { orderId: "123" }             │
│     │   → 같은 서비스 내에서 조회 가능하므로 ID만               │
│     └── 통합 이벤트: OrderPlaced { orderId, items, total, ... }│
│         → 외부 서비스가 추가 조회 없이 처리 가능하도록          │
│                                                                 │
│  4. Correlation ID + Causation ID 필수                          │
│     ├── Correlation ID: 전체 비즈니스 흐름 추적                │
│     └── Causation ID: 직접적 원인 추적 (디버깅)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 8.2 Aggregate 설계 (Vaughn Vernon 규칙)

```
┌─────────────────────────────────────────────────────────────────┐
│              Aggregate 설계 4원칙                                │
│                                                                 │
│  규칙 1: 1 트랜잭션 = 1 Aggregate                               │
│  ├── 하나의 Command는 하나의 Aggregate만 수정                  │
│  └── 여러 Aggregate 변경 필요 → Saga/Process Manager 사용      │
│                                                                 │
│  규칙 2: Aggregate를 작게 유지                                  │
│  ├── Order { items, payments, shipments } → 너무 큼!           │
│  ├── Order { items } + Payment { ... } + Shipment { ... }      │
│  └── 이벤트 수가 적어져 Rehydration도 빨라짐                  │
│                                                                 │
│  규칙 3: ID로만 참조                                            │
│  ├── 다른 Aggregate를 직접 참조하지 않음                       │
│  └── Order.customerId (ID만) vs Order.customer (객체 참조 X)   │
│                                                                 │
│  규칙 4: Eventual Consistency 수용                              │
│  ├── Aggregate 간에는 즉각 일관성을 강제하지 않음              │
│  └── 이벤트를 통해 "결국" 일관성 달성                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 8.3 Projection 전략

```
┌─────────────────────────────────────────────────────────────────┐
│              Projection 베스트 프랙티스                          │
│                                                                 │
│  1. 용도별 Read Model 분리                                      │
│     ├── 주문 목록 조회용 Projection                             │
│     ├── 매출 통계용 Projection                                  │
│     └── 고객 대시보드용 Projection (각각 다른 스키마)           │
│                                                                 │
│  2. 항상 재구축 가능하도록 설계                                 │
│     ├── Projection = 파생 데이터 (삭제 후 재생성 가능)         │
│     └── Event Store만 있으면 언제든 새 Projection 추가 가능    │
│                                                                 │
│  3. Event Handler는 Idempotent하게                              │
│     ├── 같은 이벤트를 두 번 처리해도 결과 동일                 │
│     └── checkpoint/position 기반 중복 방지                      │
│                                                                 │
│  4. Eventual Consistency 경계 명시                              │
│     ├── UI에 "정보가 반영되기까지 수 초 걸릴 수 있습니다"      │
│     └── 쓰기 직후 자신의 데이터 읽기 = Read-Your-Writes 보장   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 8.4 Event Versioning 전략

| 단계 | 전략 | 언제 사용 |
|------|------|-----------|
| 1단계 | **Weak Schema** (기본값) | 필드 추가/제거. JSON 유연성 활용 |
| 2단계 | **Upcasting** | 필드 이름 변경, 구조 변경. 읽기 시점 변환 |
| 3단계 | **Copy-and-Transform** | 대규모 마이그레이션. 새 스트림으로 복사 |

---

# 9. 안티패턴과 흔한 함정

## 9.1 "CRUD 이벤트" (Property Sourcing)

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #1: Property Sourcing                      │
│                                                                 │
│  BAD: "CRUD 이벤트" — 도메인 의미 없는 기술적 이벤트           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  UserUpdated { field: "email", value: "new@mail.com" }  │    │
│  │  OrderUpdated { field: "status", value: "shipped" }     │    │
│  │                                                          │    │
│  │  → 이벤트에서 "왜" 변경됐는지 알 수 없음                │    │
│  │  → Event Sourcing의 핵심 가치를 상실                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  GOOD: 도메인 이벤트 — 비즈니스 의미를 담은 이벤트             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  UserEmailChanged { oldEmail, newEmail, reason }         │    │
│  │  OrderShipped { trackingNumber, carrier, shippedAt }     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.2 너무 큰 Aggregate

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #2: 거대 Aggregate                        │
│                                                                 │
│  BAD: 하나의 Order Aggregate에 모든 것을 포함                  │
│  Order { items[], payments[], shipments[], reviews[], ... }     │
│  → 이벤트 폭발, Rehydration 느림, 동시성 충돌 빈번            │
│                                                                 │
│  GOOD: 작은 Aggregate로 분리                                   │
│  Order { items[] }                                              │
│  Payment { orderId, amount, status }                            │
│  Shipment { orderId, tracking, carrier }                        │
│  → 각각 독립적 이벤트 스트림, 빠른 Rehydration                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.3 서비스 경계를 넘는 Event Sourcing

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #3: 서비스 간 내부 이벤트 공유             │
│                                                                 │
│  BAD: 내부 도메인 이벤트를 그대로 외부에 발행                  │
│  → 내부 스키마 변경이 다른 서비스를 깨뜨림 (강한 결합)        │
│                                                                 │
│  GOOD: 내부 이벤트와 통합 이벤트를 분리                        │
│  ┌──────────────┐     변환     ┌──────────────┐               │
│  │ 내부 이벤트   │────────────►│ 통합 이벤트   │               │
│  │ (도메인 상세) │             │ (공개 계약)   │               │
│  └──────────────┘             └──────────────┘               │
│                                                                 │
│  내부: OrderItemQuantityAdjusted { itemId, oldQty, newQty }    │
│  통합: OrderModified { orderId, totalAmount, itemCount }        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.4 Projection에서 외부 서비스 호출

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #4: Projection에서 외부 호출               │
│                                                                 │
│  BAD: Projection Handler 내에서 API/DB 호출                    │
│  → 외부 서비스 장애 시 Projection 전체 중단                    │
│  → Replay 시 외부 서비스에 과부하                               │
│  → 비결정적 (같은 이벤트, 다른 결과)                           │
│                                                                 │
│  GOOD: 필요한 데이터를 이벤트에 포함하거나                     │
│        별도 Enrichment 단계를 분리                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.5 모든 곳에 CQRS 적용

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #5: CQRS Everywhere                       │
│                                                                 │
│  Greg Young: "CQRS is not a top-level architecture"             │
│  → Bounded Context 내에서만 적용                                │
│  → 시스템 전체가 아니라, 필요한 부분에만                       │
│                                                                 │
│  Martin Fowler: "CQRS는 minority case이다.                     │
│   대부분의 시스템에서는 위험한 복잡도를 추가할 뿐이다."        │
│                                                                 │
│  Udi Dahan: "대부분의 사람들은 CQRS를 쓰면 안 된다."           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.6 Idempotency 미보장

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 #6: Idempotency 미보장                    │
│                                                                 │
│  분산 시스템에서 메시지 중복 전달은 불가피                      │
│  → Command Handler, Event Handler 모두 멱등성 필수             │
│                                                                 │
│  전략:                                                          │
│  ├── Command: Idempotency Key로 중복 Command 감지              │
│  ├── Projection: checkpoint/position 기반 중복 건너뛰기        │
│  └── 통합 이벤트: 소비자가 event_id로 중복 처리 방지           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 마이그레이션 가이드

## 10.1 CRUD → CQRS 점진적 전환 (Strangler Fig)

```
┌─────────────────────────────────────────────────────────────────┐
│              CRUD → CQRS 단계적 전환                            │
│                                                                 │
│  Phase 1: Read Model 분리                                       │
│  ├── 기존 CRUD 유지                                            │
│  ├── 읽기 전용 모델/DTO 분리                                   │
│  └── 같은 DB, 코드 수준 분리만 (Level 1)                       │
│                                                                 │
│  Phase 2: 이벤트 발행 추가                                     │
│  ├── 쓰기 작업 후 도메인 이벤트 발행                           │
│  ├── Transactional Outbox 패턴 사용                            │
│  └── 기존 읽기 로직은 그대로 동작                              │
│                                                                 │
│  Phase 3: 별도 Read DB 도입                                    │
│  ├── 이벤트를 구독하여 Read DB 구축                            │
│  ├── 읽기 트래픽을 점진적으로 Read DB로 전환                   │
│  └── Strangler Fig: 기존 → 신규로 점진 교체                   │
│                                                                 │
│  Phase 4 (선택): Event Sourcing 전환                            │
│  ├── 쓰기 측을 Event Store 기반으로 전환                       │
│  ├── 초기 스냅샷으로 기존 상태 마이그레이션                    │
│  └── 이 단계는 감사추적이 반드시 필요할 때만                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 10.2 State-based → Event Sourcing 전환

```
┌─────────────────────────────────────────────────────────────────┐
│              State → ES 전환 전략                                │
│                                                                 │
│  방법 1: 초기 스냅샷 (Big Bang)                                 │
│  ├── 현재 상태를 "InitialSnapshot" 이벤트로 저장               │
│  ├── 이후 변경부터 이벤트로 기록                               │
│  └── 단점: 과거 이력 없음                                      │
│                                                                 │
│  방법 2: Hybrid Repository (점진적)                             │
│  ├── 기존 상태 DB + 새 Event Store 병행                        │
│  ├── 쓰기: 둘 다에 기록                                       │
│  ├── 읽기: 먼저 ES, 없으면 상태 DB 폴백                       │
│  └── 점진적으로 모든 Aggregate를 ES로 전환                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 10.3 조직적 고려사항

```
┌─────────────────────────────────────────────────────────────────┐
│              조직적 고려사항                                     │
│                                                                 │
│  Conway's Law:                                                  │
│  "시스템 구조는 조직 구조를 반영한다"                           │
│  → CQRS/ES 도입 시 팀 구조도 함께 고려해야 함                 │
│  → Command Side 팀 / Query Side 팀 분리 가능                   │
│                                                                 │
│  학습 비용:                                                     │
│  ├── 팀 전체 온보딩: 6-12개월                                  │
│  ├── 이벤트 사고방식 전환이 가장 어려움                        │
│  ├── "상태를 어떻게 바꿀까" → "무슨 일이 일어났는가"          │
│  └── Pair Programming + 내부 스터디 권장                       │
│                                                                 │
│  점진적 도입 전략:                                              │
│  ├── 한 Bounded Context에서 시작                               │
│  ├── 성공 사례 만들고 확산                                     │
│  └── 전체 시스템에 강제 적용하지 않음                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 운영 가이드

## 11.1 모니터링 필수 지표

| 지표 | 설명 | 임계값 예시 |
|------|------|-------------|
| **Projection Lag** | 이벤트 발생 ~ Read Model 반영 지연 | > 5초 경고, > 30초 위험 |
| **Append Latency** | Event Store 쓰기 지연 | > 50ms 경고 |
| **DLQ Size** | Dead Letter Queue 적재량 | > 0 즉시 확인 |
| **Event Throughput** | 초당 이벤트 처리량 | 기준선 대비 20% 하락 시 경고 |
| **Snapshot Hit Ratio** | Snapshot 활용률 | < 80% 시 Snapshot 전략 재검토 |
| **Rehydration P99** | Aggregate 복원 99퍼센타일 지연 | > 100ms 시 Snapshot 필요 |

## 11.2 GDPR/개인정보 준수

```
┌─────────────────────────────────────────────────────────────────┐
│              GDPR과 Event Sourcing의 충돌                        │
│                                                                 │
│  문제: 이벤트는 불변(immutable)인데, "잊힐 권리"는 삭제 요구   │
│                                                                 │
│  해법 1: Crypto-Shredding                                       │
│  ├── 개인정보를 사용자별 암호화 키로 암호화하여 저장           │
│  ├── 삭제 요청 시 암호화 키만 폐기                             │
│  ├── 이벤트 자체는 유지되지만 개인정보 복호화 불가             │
│  └── 이벤트 불변성을 유지하면서 GDPR 준수                     │
│                                                                 │
│  해법 2: Forgettable Payload (권장)                              │
│  ├── 이벤트 = 참조(reference) + 별도 저장소(개인정보)          │
│  ├── 이벤트: { userId: "user-123", personalDataRef: "pd-456" } │
│  ├── 별도 저장소: { "pd-456": { name: "Kim", email: "..." } }  │
│  ├── 삭제 요청 시 별도 저장소에서만 삭제                       │
│  └── 이벤트 구조가 깔끔하고, Replay 시 자연스럽게 처리        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 프로덕션 투입 전 체크리스트

```
┌─────────────────────────────────────────────────────────────────┐
│              프로덕션 체크리스트                                 │
│                                                                 │
│  [ ] Event Store                                                │
│      [ ] Append-only 정책 (UPDATE/DELETE 차단)                  │
│      [ ] Optimistic Concurrency 동작 확인                       │
│      [ ] 백업/복구 전략 수립 및 테스트                          │
│      [ ] 스토리지 용량 계획 (이벤트는 계속 쌓임)               │
│                                                                 │
│  [ ] Projection                                                 │
│      [ ] 재구축 절차 문서화 및 테스트                           │
│      [ ] Idempotent Handler 검증                                │
│      [ ] Projection Lag 모니터링 설정                           │
│      [ ] Dead Letter Queue 설정 및 알림                         │
│                                                                 │
│  [ ] Event 설계                                                 │
│      [ ] 과거형 네이밍 통일                                    │
│      [ ] Correlation/Causation ID 포함                          │
│      [ ] Event Versioning 전략 수립                             │
│      [ ] 내부/통합 이벤트 분리                                  │
│                                                                 │
│  [ ] 운영                                                       │
│      [ ] Snapshot 전략 (필요 시)                                │
│      [ ] GDPR 대응 방안 (Crypto-Shredding 등)                  │
│      [ ] 모니터링 대시보드 구축                                │
│      [ ] 장애 시 Projection 재구축 런북                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 전문가 핵심 조언

```
┌─────────────────────────────────────────────────────────────────┐
│              전문가 인용                                         │
│                                                                 │
│  Greg Young:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  "CQRS is not a top-level architecture.                  │    │
│  │   It should be applied within a Bounded Context."        │    │
│  │                                                          │    │
│  │  "Try CQRS without Event Sourcing first."                │    │
│  │                                                          │    │
│  │  "If you have fewer than 1000 events, you don't need     │    │
│  │   snapshots. Measure first."                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Martin Fowler:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  "CQRS is a useful pattern, but it's a minority case.   │    │
│  │   For most systems, adding CQRS increases risk           │    │
│  │   because of the additional complexity."                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Udi Dahan:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  "Most people shouldn't be using CQRS."                  │    │
│  │                                                          │    │
│  │  "CQRS and Event Sourcing are two separate things.       │    │
│  │   You don't have to use them together."                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 참고 자료

## 핵심 문헌

| 자료 | 저자 | 연도 | 유형 |
|------|------|------|------|
| Object-Oriented Software Construction | Bertrand Meyer | 1988/1997 | 서적 |
| Domain-Driven Design | Eric Evans | 2003 | 서적 |
| Event Sourcing 패턴 | Martin Fowler | 2005 | 블로그 |
| CQRS Documents | Greg Young | 2010 | 논문 (56p PDF) |
| Clarified CQRS | Udi Dahan | 2009 | 블로그 |
| Life beyond Distributed Transactions | Pat Helland | 2007 | 논문 (CIDR) |
| Eventually Consistent | Werner Vogels | 2008 | ACM Queue |
| Designing Data-Intensive Applications | Martin Kleppmann | 2017 | 서적 |
| Implementing DDD | Vaughn Vernon | 2013 | 서적 |

## 프레임워크 공식 문서

| 프레임워크 | URL |
|------------|-----|
| EventStoreDB | https://www.eventstore.com/docs |
| Axon Framework | https://docs.axoniq.io |
| Marten | https://martendb.io/docs |
| Akka Persistence | https://doc.akka.io/docs/akka/current/persistence.html |

## 추가 자료

| 자료 | 저자/출처 | 비고 |
|------|-----------|------|
| CAP Theorem | Brewer (2000), Gilbert & Lynch (2002) | 분산 시스템 이론 토대 |
| Reactive Manifesto | Jonas Boner 외 (2013) | 반응형 시스템 원칙 |
| Enterprise Integration Patterns | Hohpe, Woolf (2003) | 메시징 패턴 기초 |
| CQRS Journey (MS Patterns & Practices) | Microsoft | 실전 구현 가이드 |
| Versioning in an Event Sourced System | Greg Young | 이벤트 버전관리 심화 |

