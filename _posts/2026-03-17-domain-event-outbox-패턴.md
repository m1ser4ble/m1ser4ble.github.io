---
layout: single
title: "Domain Event & Outbox 패턴 완전 가이드"
date: 2026-03-17 23:00:00 +0900
categories: backend
excerpt: "Domain Event와 Outbox 패턴은 비즈니스 데이터 변경과 이벤트 발행을 단일 트랜잭션으로 묶어 Dual Write 문제를 줄이고 서비스 간 일관성을 높인다."
toc: true
toc_sticky: true
tags: [domainevent, outbox, transactionaloutbox, cdc, microservices]
source: "/home/dwkim/dwkim/docs/backend/domain-event-outbox-패턴.md"
---
TL;DR
- Domain Event와 Outbox 패턴의 핵심 개념과 동작 원리를 빠르게 정리한다.
- Dual Write 문제가 왜 발생하는지, 그리고 분산 트랜잭션 대신 어떤 실용 해법이 쓰이는지 설명한다.
- Polling/CDC/Event Sourcing 등 구현 변형과 운영 시 주의점을 함께 다룬다.

## 1. 개념
Domain Event와 Outbox 패턴은 도메인에서 일어난 사실을 이벤트로 기록하고, 비즈니스 데이터 변경과 이벤트 기록을 같은 트랜잭션으로 처리해 발행 신뢰성을 확보하는 방법이다.

## 2. 배경
마이크로서비스 환경에서 데이터베이스 쓰기와 메시지 브로커 발행은 서로 다른 시스템이라 하나의 원자 트랜잭션으로 묶기 어렵고, 이로 인해 Dual Write 문제가 반복적으로 발생했다.

## 3. 이유
분산 트랜잭션(2PC)의 높은 복잡도와 가용성 저하를 피하면서도 이벤트 유실/유령 이벤트를 방지하고, 최종적 일관성을 실무적으로 달성하기 위해 Outbox 기반 접근이 필요하다.

## 4. 특징
핵심 특징은 로컬 트랜잭션 원자성, at-least-once 전달 전제, 소비자 멱등성 필요, 그리고 Polling 또는 CDC를 통한 유연한 운영 선택지다.

## 5. 상세 내용

# Domain Event & Outbox 패턴 완전 가이드

> **작성일**: 2026-03-17
> **카테고리**: Backend / Distributed Systems / Microservices / Event-Driven Architecture
> **키워드**: Domain Event, Outbox Pattern, Transactional Outbox, CDC, Change Data Capture, Debezium, Polling Publisher, Transaction Log Tailing, Inbox Pattern, Idempotent Consumer, Dual Write, Kafka, WAL, binlog, CloudEvents, At-Least-Once Delivery, Eventual Consistency

---

# 1. Domain Event & Outbox 패턴이란?

## 1.1 마이크로서비스의 근본적 딜레마

```
┌─────────────────────────────────────────────────────────────────┐
│           마이크로서비스의 근본적 딜레마                          │
│                                                                 │
│  [문제 상황]                                                    │
│                                                                 │
│  주문 서비스의 일상:                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  1. DB에 주문 저장          (PostgreSQL)                 │    │
│  │  2. 이벤트 발행             (Kafka)                      │    │
│  │                                                          │    │
│  │  두 작업 모두 성공해야 "주문 처리 완료"                  │    │
│  │  그런데... 이 두 시스템은 서로 다른 시스템!              │    │
│  │  하나의 트랜잭션으로 묶을 수 없다!                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  실패 시나리오:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  시나리오 A: DB 성공 → Kafka 실패                        │    │
│  │  → 이벤트 유실! 다른 서비스는 주문 생성을 모름           │    │
│  │                                                          │    │
│  │  시나리오 B: Kafka 성공 → DB 실패                        │    │
│  │  → 없는 주문에 대한 이벤트가 전파됨!                     │    │
│  │                                                          │    │
│  │  순서를 바꿔도 해결 불가                                 │    │
│  │  → 두 시스템이 서로의 트랜잭션을 인식하지 못하기 때문    │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  이것이 Dual Write(이중 쓰기) 문제                              │
│  → 아키텍처 구조 자체에서 발생하는 근본적 문제                  │
│  → 코딩 실수가 아님!                                           │
│                                                                 │
│  참고: docs/backend/dual-write-패턴.md                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 해결책: Outbox 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│           Outbox 패턴 = "발신함" 메타포                          │
│                                                                 │
│  이메일 Outbox(발신함)을 떠올려보자:                            │
│  ├── 이메일을 작성하면 먼저 Outbox에 저장                       │
│  ├── 인터넷이 끊겨도 Outbox에 안전하게 보관                     │
│  └── 연결이 복구되면 자동으로 전송                              │
│                                                                 │
│  소프트웨어 Outbox 패턴도 동일한 원리:                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  [기존 Dual Write]                                       │    │
│  │  Service ──┬──→ DB에 저장         ← 트랜잭션 1          │    │
│  │            └──→ Kafka에 발행      ← 트랜잭션 2 (원자성X)│    │
│  │                                                          │    │
│  │  [Outbox 패턴]                                           │    │
│  │  Service ──→ DB에 저장 + Outbox에 이벤트 저장            │    │
│  │              └──→ 하나의 DB 트랜잭션! (원자성O)           │    │
│  │                                                          │    │
│  │  별도 프로세스가 Outbox → Kafka로 전달                   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  핵심 아이디어:                                                 │
│  "메시지 브로커에 직접 쓰지 말고,                               │
│   DB 트랜잭션 안에서 Outbox 테이블에 먼저 쓴다"                 │
│                                                                 │
│  왜 "Transactional" Outbox인가?                                 │
│  ├── 비즈니스 데이터 변경과 동일한 DB 트랜잭션                  │
│  ├── 트랜잭션 롤백 → Outbox 레코드도 함께 롤백                 │
│  └── 트랜잭션 커밋 → Outbox 레코드도 함께 커밋                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Domain Event란?

```
┌─────────────────────────────────────────────────────────────────┐
│           Domain Event = 도메인에서 일어난 사실                  │
│                                                                 │
│  정의:                                                          │
│  "비즈니스 도메인에서 중요하게 일어난 사실(fact)"               │
│  ─ Eric Evans (DDD 창시자)                                      │
│                                                                 │
│  핵심 특성:                                                     │
│  ├── 과거 시제: 이미 일어난 일 (OrderPlaced, PaymentCompleted)  │
│  ├── 불변(immutable): 발생한 사실은 변경 불가                   │
│  ├── 비즈니스 언어: 기술 용어가 아닌 도메인 전문가의 언어       │
│  └── 발행 후 잊기: Publisher는 누가 구독하는지 모름             │
│                                                                 │
│  네이밍 규칙:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ✅ 올바른 예시 (과거 시제, 완료된 사실):                │    │
│  │  ├── OrderPlaced        (주문 생성됨)                    │    │
│  │  ├── PaymentCompleted   (결제 완료됨)                    │    │
│  │  ├── StockReserved      (재고 예약됨)                    │    │
│  │  └── OrderCancelled     (주문 취소됨)                    │    │
│  │                                                          │    │
│  │  ❌ 잘못된 예시:                                         │    │
│  │  ├── CreateOrder        (명령형 → Command이지 Event 아님)│    │
│  │  ├── OrderUpdate        (너무 모호)                      │    │
│  │  └── ProcessPayment     (Command 네이밍)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  참고: docs/backend/cqrs-event-sourcing-패턴.md                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경과 이유

## 2.1 왜 2PC(Two-Phase Commit)로는 안 되는가?

```
┌─────────────────────────────────────────────────────────────────┐
│           2PC가 마이크로서비스에서 실용적이지 않은 이유          │
│                                                                 │
│  2PC 동작 방식:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Coordinator]                                           │    │
│  │       │                                                  │    │
│  │  Phase 1 (Prepare):                                      │    │
│  │       ├──→ DB: "커밋 가능?" ──→ "READY"                  │    │
│  │       └──→ Broker: "커밋 가능?" ──→ "READY"              │    │
│  │       │                                                  │    │
│  │  Phase 2 (Commit):                                       │    │
│  │       ├──→ DB: "COMMIT!"                                 │    │
│  │       └──→ Broker: "COMMIT!"                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  왜 마이크로서비스에서 기피하는가?                              │
│                                                                 │
│  1. Blocking 특성                                               │
│     ├── Coordinator가 모든 참여자 응답을 기다리는 동안          │
│     └── 리소스(lock)가 잠겨있음 → 처리량 급감                  │
│                                                                 │
│  2. 단일 장애점 (Single Point of Failure)                       │
│     ├── Coordinator 장애 → 모든 참여자가 불확실한 상태          │
│     └── in-doubt transaction 발생                               │
│                                                                 │
│  3. 확장성 한계                                                 │
│     ├── 참여 서비스 증가 → 전체 처리량 감소                    │
│     └── 가장 느린 참여자가 전체 병목                            │
│                                                                 │
│  4. 인프라 비호환                                               │
│     ├── Kafka는 XA 트랜잭션을 지원하지 않음                    │
│     └── 대부분의 현대적 브로커가 XA 미지원/비권장               │
│                                                                 │
│  5. CAP 정리 관점                                               │
│     ├── 2PC는 Consistency를 위해 Availability를 희생            │
│     └── 분산 시스템의 현실(Partition은 불가피)과 맞지 않음      │
│                                                                 │
│  결론:                                                          │
│  "대규모 분산 시스템에서 분산 트랜잭션은 불가능하다"            │
│  ─ Pat Helland, "Life beyond Distributed Transactions" (2007)   │
│                                                                 │
│  참고: docs/backend/보상트랜잭션-saga.md                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 세 가지 지적 계보의 수렴

```
┌─────────────────────────────────────────────────────────────────┐
│           Domain Event + Outbox = 세 계보의 수렴                │
│                                                                 │
│  계보 1: DDD (Domain-Driven Design)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  2003  Eric Evans, DDD Blue Book 출판                    │    │
│  │        (Domain Event는 미포함!)                          │    │
│  │  2008  Udi Dahan, "Domain Events – Take 2"              │    │
│  │        (구체적 구현 패턴 제시)                           │    │
│  │  2009  Eric Evans, Domain Event를 공식 추가              │    │
│  │        "DDD에서 누락된 빌딩 블록(missing building block)"│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  계보 2: 분산 시스템 이론                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  2000  Eric Brewer, CAP Theorem 발표                     │    │
│  │  2007  Pat Helland, "Life beyond Distributed             │    │
│  │        Transactions" ─ 분산 트랜잭션 없이                │    │
│  │        로컬 원자성 + at-least-once 메시지로 해결         │    │
│  │  2008  Dan Pritchett (eBay), BASE 개념 공식화            │    │
│  │        Basically Available, Soft state, Eventually       │    │
│  │        consistent                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  계보 3: 도구와 패턴 문서화                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  2016  Randall Hauch (Red Hat), Debezium 프로젝트 창시   │    │
│  │        Transaction Log Tailing의 프로덕션 구현           │    │
│  │  2017  Chris Richardson, microservices.io에              │    │
│  │        Transactional Outbox 패턴 공식 등재               │    │
│  │  2018  "Microservices Patterns" 책 출판                  │    │
│  │        Eventuate Tram 프레임워크 공개                    │    │
│  │  2019  Gunnar Morling, Debezium Outbox Event Router      │    │
│  │        CDC + Outbox 조합의 레퍼런스 아키텍처 확립        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  이 세 계보가 만나는 지점이 오늘날의                            │
│  Domain Event + Transactional Outbox + CDC(Debezium) 스택       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. 용어 사전

```
┌─────────────────────────────────────────────────────────────────┐
│                      용어 사전                                   │
│                                                                 │
│  Domain Event (도메인 이벤트)                                   │
│  ├── DDD 맥락에서 "비즈니스 영역에서 중요하게 일어난 사실"      │
│  ├── "Domain" = 비즈니스 문제 공간 (기술 공간이 아님)           │
│  ├── "Event" = 이미 일어난 사실, 과거형으로 명명                │
│  └── 누가: Eric Evans(2003 내포) → Udi Dahan(2008 구체화)       │
│      → Evans(2009 공식 추가)                                    │
│                                                                 │
│  Outbox Pattern (아웃박스 패턴)                                 │
│  ├── 이메일 "발신함(Outbox)" 메타포에서 유래                    │
│  ├── 보내고 싶지만 아직 전송되지 않은 메시지를 보관하는 곳      │
│  └── "Transactional" = 비즈니스 변경과 동일 DB 트랜잭션         │
│                                                                 │
│  CDC (Change Data Capture, 변경 데이터 캡처)                    │
│  ├── DB의 INSERT/UPDATE/DELETE 변경을 포착하여 전달             │
│  ├── 원래 데이터 웨어하우스 ETL에서 기원                        │
│  └── Oracle 9i에서 최초 도입 → 10g에서 비동기 방식 발전         │
│                                                                 │
│  Debezium (디비지움, "dee-BEE-zee-uhm")                         │
│  ├── "DBs" + "-ium" = 데이터베이스들의 원소                     │
│  │   (주기율표 원소 이름 접미사: sodium, helium처럼)            │
│  ├── Red Hat의 Randall Hauch가 2016년 창시                      │
│  └── Martin Kleppmann의 "Turning the DB Inside Out"에서 영감    │
│                                                                 │
│  Polling Publisher (폴링 퍼블리셔)                               │
│  ├── 주기적으로 Outbox 테이블을 SELECT하여                      │
│  └── 미발행 메시지를 브로커에 발행하는 컴포넌트                  │
│                                                                 │
│  Transaction Log Tailing (트랜잭션 로그 테일링)                 │
│  ├── Unix의 `tail -f`처럼 DB 트랜잭션 로그를                   │
│  │   실시간으로 따라가며 읽는 방식                              │
│  ├── PostgreSQL: WAL (Write-Ahead Log)                          │
│  ├── MySQL: binlog (Binary Log)                                 │
│  └── MongoDB: oplog (Operations Log)                            │
│                                                                 │
│  Inbox Pattern (인박스 패턴)                                    │
│  ├── Outbox의 반대 방향: 수신 측에서 적용                       │
│  ├── 수신 메시지를 Inbox 테이블에 저장하여 중복 방지            │
│  └── Idempotent Consumer의 구현 메커니즘                        │
│                                                                 │
│  Idempotent Consumer (멱등성 소비자)                            │
│  ├── "Idempotent" = 라틴어 idem(같은) + potens(힘)              │
│  │   1870년 수학자 Benjamin Peirce가 최초 사용                  │
│  ├── f(f(x)) = f(x) — 여러 번 적용해도 결과가 동일             │
│  └── 메시지를 여러 번 처리해도 결과가 한 번과 동일한 Consumer   │
│                                                                 │
│  CloudEvents                                                    │
│  ├── CNCF가 관리하는 이벤트 메타데이터 표준 스펙                │
│  └── specversion, id, source, type 등 필수 attribute 정의       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│                    진화 연대표                                    │
│                                                                 │
│  2000  ──── CAP Theorem 발표 (Eric Brewer)                      │
│             분산 시스템에서 C,A,P 동시 보장 불가 증명            │
│             → Eventually Consistent 패턴의 이론적 토대          │
│                                                                 │
│  2003  ──── DDD Blue Book 출판 (Eric Evans)                     │
│             Aggregate, Bounded Context 정립                     │
│             ※ Domain Event는 미포함                             │
│                                                                 │
│  2005  ──── Event Sourcing 패턴 명명 (Martin Fowler)            │
│             상태 변경을 이벤트 시퀀스로 저장                    │
│                                                                 │
│  2007  ──── "Life beyond Distributed Transactions" (Pat Helland)│
│             분산 트랜잭션 없이 Entity + Message로 해결          │
│             → Outbox 패턴의 철학적 토대                         │
│                                                                 │
│  2008  ──── BASE 개념 공식화 (Dan Pritchett, eBay)              │
│             Udi Dahan, "Domain Events – Take 2"                 │
│                                                                 │
│  2009  ──── Domain Events 명시적 패턴화 (Udi Dahan)             │
│             Eric Evans, Domain Event를 DDD 공식 패턴으로 추가   │
│                                                                 │
│  2010  ──── CQRS 공식 정의 (Greg Young)                         │
│             이벤트의 과거 시제 네이밍 관례 확립                  │
│                                                                 │
│  2011  ──── Apache Kafka 오픈소스 공개 (LinkedIn)               │
│             고처리량 Distributed Commit Log                     │
│                                                                 │
│  2014  ──── 마이크로서비스 아키텍처 대중화                      │
│             (Fowler & Lewis) → Dual Write 문제 부상             │
│                                                                 │
│  2016  ──── Debezium 프로젝트 시작 (Randall Hauch, Red Hat)     │
│             Kafka Connect 기반 CDC 플랫폼                       │
│                                                                 │
│  2017  ──── Transactional Outbox 패턴 공식 등재                 │
│             (Chris Richardson, microservices.io)                 │
│                                                                 │
│  2018  ──── "Microservices Patterns" 출판 (Chris Richardson)    │
│             Eventuate Tram 프레임워크 공개                      │
│                                                                 │
│  2019  ──── CDC + Outbox 레퍼런스 아키텍처 확립                 │
│             (Gunnar Morling, Debezium Blog)                     │
│             Debezium Outbox Event Router SMT 내장               │
│                                                                 │
│  2020  ──── Debezium Outbox Quarkus Extension                   │
│             Cloud-Native CDC 서비스 성숙                        │
│                                                                 │
│  2021+ ──── AWS/GCP/Azure에서 공식 클라우드 패턴으로 채택       │
│             Serverless-Native Outbox 등장                       │
│                                                                 │
│  현재  ──── Debezium 3.x, Managed CDC 서비스 보편화             │
│             CloudEvents 스펙 표준화 진행                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. 구현 변형들

## 5.1 Transactional Outbox + Polling Publisher

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 A: Outbox + Polling Publisher                     │
│                                                                 │
│  [데이터 흐름]                                                  │
│                                                                 │
│  Application Service                                            │
│       │                                                         │
│       │ (single DB transaction)                                 │
│       ▼                                                         │
│  ┌──────────────────────────┐                                   │
│  │  Database                │                                   │
│  │  ├── business_table      │ ← 비즈니스 데이터                 │
│  │  └── outbox_events       │ ← 동일 트랜잭션으로 INSERT        │
│  └───────────┬──────────────┘                                   │
│              │                                                  │
│              │ SELECT FOR UPDATE SKIP LOCKED (주기적 폴링)      │
│              ▼                                                  │
│  ┌──────────────────────────┐                                   │
│  │  Polling Publisher       │ ← 별도 프로세스/스레드             │
│  │  (Message Relay)         │                                   │
│  └───────────┬──────────────┘                                   │
│              │                                                  │
│              ▼                                                  │
│  ┌──────────────────────────┐                                   │
│  │  Message Broker          │                                   │
│  │  (Kafka / RabbitMQ)      │                                   │
│  └──────────────────────────┘                                   │
│                                                                 │
│  Outbox 테이블 스키마:                                          │
│  ┌────────────────┬──────────────┬─────────────────────────┐    │
│  │ 컬럼           │ 타입         │ 설명                    │    │
│  ├────────────────┼──────────────┼─────────────────────────┤    │
│  │ id             │ UUID (PK)    │ 중복 감지용 고유 ID     │    │
│  │ aggregate_type │ VARCHAR(255) │ 라우팅 키 (e.g. "Order")│    │
│  │ aggregate_id   │ VARCHAR(255) │ Kafka partition key     │    │
│  │ type           │ VARCHAR(255) │ 이벤트 타입             │    │
│  │ payload        │ JSONB        │ 이벤트 데이터           │    │
│  │ created_at     │ TIMESTAMPTZ  │ 생성 시각               │    │
│  │ published_at   │ TIMESTAMPTZ  │ 발행 시각 (NULL=미발행) │    │
│  └────────────────┴──────────────┴─────────────────────────┘    │
│                                                                 │
│  Polling 권장 설정:                                             │
│  ├── Poll Interval: 1~2초                                      │
│  ├── Batch Size: 100~500건                                     │
│  ├── 순서: ORDER BY created_at ASC                              │
│  └── Lock: FOR UPDATE SKIP LOCKED (다중 인스턴스 안전)          │
│                                                                 │
│  장점:                                                          │
│  ├── 구현 단순: 추가 인프라(CDC 등) 불필요                     │
│  ├── DB 무관: 모든 ACID 지원 DB에서 작동                       │
│  └── 디버깅 용이: Outbox 테이블 직접 조회 가능                 │
│                                                                 │
│  단점:                                                          │
│  ├── DB 폴링 부하: 주기적 SELECT가 DB에 지속 부하              │
│  ├── 레이턴시: Poll Interval만큼의 지연 (최소 1~2초)           │
│  └── 테이블 증가: 발행 완료 레코드의 주기적 정리 필요          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Transactional Outbox + CDC (Debezium)

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 B: Outbox + CDC (Transaction Log Tailing)        │
│                                                                 │
│  [데이터 흐름]                                                  │
│                                                                 │
│  Application Service                                            │
│       │                                                         │
│       │ (single DB transaction)                                 │
│       ▼                                                         │
│  ┌──────────────────────────┐                                   │
│  │  Database                │                                   │
│  │  ├── business_table      │                                   │
│  │  └── outbox_events       │                                   │
│  └───────────┬──────────────┘                                   │
│              │                                                  │
│              │ WAL / binlog / oplog 읽기                        │
│              ▼                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │  Debezium Source Connector               │                   │
│  │  (Kafka Connect Worker에서 실행)         │                   │
│  │                                          │                   │
│  │  ┌──────────────────────────────────┐    │                   │
│  │  │ Outbox Event Router SMT          │    │                   │
│  │  │ ├── aggregate_type → 토픽 결정   │    │                   │
│  │  │ ├── aggregate_id → 메시지 key    │    │                   │
│  │  │ └── payload → 메시지 value       │    │                   │
│  │  └──────────────────────────────────┘    │                   │
│  └───────────┬──────────────────────────────┘                   │
│              ▼                                                  │
│  ┌──────────────────────────┐                                   │
│  │  Apache Kafka            │                                   │
│  │  ├── outbox.event.Order  │                                   │
│  │  ├── outbox.event.User   │                                   │
│  │  └── outbox.event.Payment│                                   │
│  └──────────────────────────┘                                   │
│                                                                 │
│  DB별 CDC 방식:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL: WAL (Write-Ahead Log)                       │    │
│  │  ├── Logical Decoding으로 row-level 변경 포착            │    │
│  │  ├── 필수: wal_level = logical                           │    │
│  │  └── 주의: Replication Slot이 WAL 보관 강제              │    │
│  │                                                          │    │
│  │  MySQL: binlog (Binary Log)                              │    │
│  │  ├── 필수: binlog_format = ROW, binlog_row_image = FULL  │    │
│  │  └── GTID 활성화 시 장애 복구가 더 안정적                │    │
│  │                                                          │    │
│  │  MongoDB: oplog (Operations Log)                         │    │
│  │  ├── Replica Set에서만 사용 가능                         │    │
│  │  └── Change Streams API (MongoDB 3.6+) 기반              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Clever Delete 기법 (Debezium 공식 권장):                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  BEGIN;                                                  │    │
│  │    INSERT INTO outbox_events (...) VALUES (...);         │    │
│  │    DELETE FROM outbox_events WHERE id = ?;               │    │
│  │  COMMIT;                                                 │    │
│  │                                                          │    │
│  │  → WAL에 INSERT가 기록됨 → Debezium이 캡처              │    │
│  │  → 테이블은 항상 비어있음 → Cleanup 불필요!              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  장점:                                                          │
│  ├── 낮은 레이턴시: commit 직후 수십 ms 내 전달               │
│  ├── DB 폴링 부하 없음: 추가 쿼리 부하 없음                   │
│  ├── 강한 순서 보장: 커밋 순서 그대로 전달                     │
│  └── Application 코드 분리: 발행 로직이 코드에서 완전 분리     │
│                                                                 │
│  단점:                                                          │
│  ├── 인프라 복잡도: Kafka + Kafka Connect + Debezium 운영      │
│  ├── DB 설정 변경: WAL level 변경 등 DBA 협력 필요             │
│  └── Replication Slot 위험: 미처리 시 디스크 고갈              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 Event Sourcing

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 C: Event Sourcing                                 │
│                                                                 │
│  [핵심 아이디어]                                                │
│  이벤트 자체가 원본(Source of Truth)                             │
│  → Event Store가 곧 Outbox 역할                                │
│  → Dual Write 문제가 근본적으로 해소                            │
│                                                                 │
│  [일반 Outbox vs Event Sourcing 비교]                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  일반 Outbox:                                            │    │
│  │  DB(현재 상태) + Outbox 테이블 = 2개 저장소 동기화 필요  │    │
│  │                                                          │    │
│  │  Event Sourcing:                                         │    │
│  │  Event Store(이벤트 스트림) = 유일한 원본                 │    │
│  │  현재 상태 = Event 재생으로 도출 (파생값)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [데이터 흐름]                                                  │
│                                                                 │
│  Command ──→ Aggregate ──→ Domain Events                        │
│                                  │                              │
│                                  ▼                              │
│                          ┌──────────────┐                       │
│                          │ Event Store  │ ← append-only         │
│                          └──────┬───────┘                       │
│                                 │                               │
│                    ┌────────────┼────────────┐                  │
│                    ▼            ▼            ▼                  │
│              Projection   Event Bus   Subscription              │
│              (Read Model) (다른 서비스)(실시간 구독)             │
│                                                                 │
│  장점:                                                          │
│  ├── 완전한 감사 추적 (Audit Trail)                             │
│  ├── 시간 여행 (Temporal Query) 가능                            │
│  └── Outbox 문제 근본 해결                                     │
│                                                                 │
│  단점:                                                          │
│  ├── 높은 학습 곡선                                            │
│  ├── 단순 CRUD에는 과도한 복잡성                               │
│  └── 이벤트 스키마 진화 어려움 (upcasting 전략 필요)           │
│                                                                 │
│  참고: docs/backend/cqrs-event-sourcing-패턴.md                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 Listen to Yourself 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 D: Listen to Yourself                             │
│                                                                 │
│  [핵심 아이디어]                                                │
│  DB에 직접 쓰지 않고, Message Broker에만 쓴다.                  │
│  자기 자신도 그 메시지를 구독해서 DB에 반영한다.                │
│                                                                 │
│  [데이터 흐름]                                                  │
│                                                                 │
│  Client Request                                                 │
│       │                                                         │
│       ▼                                                         │
│  Service A                                                      │
│       │                                                         │
│       │ Kafka에만 이벤트 발행 (DB write 안 함!)                 │
│       ▼                                                         │
│  ┌──────────────────────────┐                                   │
│  │  Message Broker (Kafka)  │                                   │
│  └──┬──────────────────┬────┘                                   │
│     │                  │                                        │
│     ▼                  ▼                                        │
│  Service B          Service A (자기 자신!)                       │
│  (다른 서비스)      consume → 자신의 DB에 Write                 │
│                                                                 │
│  왜 일관성이 유지되는가?                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Broker 발행 성공 → 자신의 consume → DB write 발생       │    │
│  │  Broker 발행 실패 → DB write도 발생 안 함 (일관!)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  장점:                                                          │
│  ├── 추가 인프라 불필요 (Outbox 테이블, CDC 없음)              │
│  ├── 매우 낮은 응답 지연 (DB commit 대기 없음)                 │
│  └── 자연스러운 eventual consistency                            │
│                                                                 │
│  단점:                                                          │
│  ├── Read-Your-Own-Writes 불가 (쓰기 직후 읽으면 미반영)       │
│  ├── Broker 가용성에 전적으로 의존                              │
│  └── 개발팀 전체의 Event-Driven 사고방식 전환 필요              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.5 Inbox Pattern (수신 측 보완)

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 E: Inbox Pattern                                  │
│                                                                 │
│  [문제]                                                         │
│  Outbox 패턴은 at-least-once delivery를 보장한다.               │
│  → 동일 이벤트가 중복 전송될 수 있다!                           │
│  → Consumer 측에서 중복 처리를 방지해야 한다.                   │
│                                                                 │
│  [Inbox 패턴의 해결]                                            │
│                                                                 │
│  Message Broker ──→ Consumer Service                            │
│                          │                                      │
│                          ▼                                      │
│                    ┌───────────────┐                            │
│                    │ Inbox 테이블  │ message_id로 중복 체크      │
│                    │ (동일 트랜잭션)│                            │
│                    └───────┬───────┘                            │
│                            │ 중복 아닌 경우만                   │
│                            ▼                                    │
│                    비즈니스 로직 실행                            │
│                                                                 │
│  Outbox + Inbox 조합 = End-to-End 신뢰성:                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Producer]         [Broker]           [Consumer]        │    │
│  │  DB + Outbox ──→ At-Least-Once ──→ Inbox + DB            │    │
│  │  (발행 누락 없음)                  (중복 처리 없음)       │    │
│  │                                                          │    │
│  │  결과: Exactly-Once Semantics에 근사한 처리               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.6 Saga + Outbox 결합

```
┌─────────────────────────────────────────────────────────────────┐
│           변형 F: Saga + Outbox                                  │
│                                                                 │
│  Saga는 여러 서비스에 걸친 장기 트랜잭션을                      │
│  로컬 트랜잭션 시퀀스로 구현하는 패턴이다.                      │
│  Outbox는 각 로컬 트랜잭션의 이벤트를 신뢰성 있게 전달한다.    │
│                                                                 │
│  [Choreography Saga + Outbox 흐름]                              │
│                                                                 │
│  Order Service                                                  │
│    BEGIN;                                                       │
│      INSERT INTO orders (status='PENDING');                     │
│      INSERT INTO outbox (type='OrderCreated');                  │
│    COMMIT;                                                      │
│       │ CDC / Polling                                           │
│       ▼                                                         │
│  Kafka ──→ Payment Service                                      │
│              BEGIN;                                              │
│                INSERT INTO payments (...);                       │
│                INSERT INTO outbox (type='PaymentProcessed');     │
│              COMMIT;                                             │
│                │                                                │
│                ▼ (실패 시)                                      │
│  Kafka ──→ Order Service                                        │
│              BEGIN;                                              │
│                UPDATE orders SET status='CANCELLED';             │
│                INSERT INTO outbox (type='OrderCancelled');       │
│              COMMIT;   ← 보상 트랜잭션                          │
│                                                                 │
│  참고: docs/backend/보상트랜잭션-saga.md                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. 대안 비교표

## 6.1 이벤트 발행 보장 방식 비교

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    이벤트 발행 보장 방식 비교표                                  │
│                                                                                 │
│  ┌──────────────┬──────┬──────┬──────────┬──────────┬──────┬─────────┐          │
│  │ 방식         │원자성│순서  │지연시간  │운영복잡도│DB부하│적합 규모│          │
│  ├──────────────┼──────┼──────┼──────────┼──────────┼──────┼─────────┤          │
│  │Outbox+Polling│ 높음 │ 중간 │1~수초    │ 중간     │ 높음 │소~중규모│          │
│  │Outbox+CDC    │ 높음 │ 높음 │수십ms    │ 높음     │ 낮음 │중~대규모│          │
│  │Event Sourcing│ 높음 │매우↑│수십ms    │매우 높음 │ 없음 │대규모   │          │
│  │Listen-to-Self│ 중간 │ 높음 │매우 낮음 │ 중간     │ 낮음 │중~대규모│          │
│  │2PC/XA        │매우↑│ 높음 │매우 높음 │매우 높음 │매우↑│비권장   │          │
│  │Dual Write    │ 없음 │ 없음 │ 낮음     │ 낮음     │ 없음 │비권장   │          │
│  └──────────────┴──────┴──────┴──────────┴──────────┴──────┴─────────┘          │
│                                                                                 │
│  가장 흔한 프로덕션 조합:                                                       │
│  Transactional Outbox + Debezium + Apache Kafka                                 │
│  = 낮은 DB 부하 + 수십 ms 지연 + 강한 순서 보장 + replay 가능                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 CDC 도구 비교

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CDC 도구 비교표                                         │
│                                                                                 │
│  ┌──────────────┬──────────────────┬──────────┬──────────┬─────────────────┐    │
│  │ 도구         │ 지원 DB          │ 처리량   │운영편의성│ 비고            │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ Debezium     │ MySQL, PG, Mongo │ 높음     │ 중간     │업계 사실상 표준 │    │
│  │              │ SQL Server, Oracle│          │          │Red Hat 지원     │    │
│  │              │ DB2, Cassandra   │          │          │                 │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ Maxwell      │ MySQL 전용       │ 중간     │ 높음     │경량, 단순       │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ Canal        │ MySQL 전용       │ 매우 높음│ 중간     │Alibaba 개발     │    │
│  │              │                  │(60만+TPS)│          │중국 커뮤니티    │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ AWS DMS      │ 다수             │ 중간     │ 매우 높음│AWS 전용         │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ GCP Datastream│MySQL, PG, Oracle│ 높음     │ 매우 높음│GCP 전용         │    │
│  ├──────────────┼──────────────────┼──────────┼──────────┼─────────────────┤    │
│  │ Azure CDC    │ SQL Server       │ 중간     │ 높음     │Azure 전용       │    │
│  └──────────────┴──────────────────┴──────────┴──────────┴─────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 Message Broker 비교 (Outbox와 함께 쓸 때)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  Message Broker 비교 (Outbox 패턴 궁합)                         │
│                                                                                 │
│  ┌──────────────┬──────────┬──────────┬──────────┬─────────────────────────┐    │
│  │ Broker       │ 궁합     │ 순서보장 │ 처리량   │ 비고                    │    │
│  ├──────────────┼──────────┼──────────┼──────────┼─────────────────────────┤    │
│  │ Apache Kafka │ 매우 좋음│ Partition│ 수백만/s │ Debezium과 최적 조합    │    │
│  │              │(표준조합)│ 내 보장  │          │ replay 가능             │    │
│  ├──────────────┼──────────┼──────────┼──────────┼─────────────────────────┤    │
│  │ RabbitMQ     │ 좋음     │ 단일큐내 │ 수만/s   │ 경량, replay 불가       │    │
│  ├──────────────┼──────────┼──────────┼──────────┼─────────────────────────┤    │
│  │ AWS SQS/SNS  │ 좋음     │ FIFO만   │ 수천~수만│ 완전 관리형             │    │
│  ├──────────────┼──────────┼──────────┼──────────┼─────────────────────────┤    │
│  │ NATS JetStream│좋음     │ 제한적   │ 수백만/s │ 경량, 낮은 운영 비용    │    │
│  ├──────────────┼──────────┼──────────┼──────────┼─────────────────────────┤    │
│  │ Apache Pulsar│ 중간     │ Partition│ 높음     │ 멀티 테넌시 강점        │    │
│  │              │          │ 내 보장  │          │ Outbox 성숙도 낮음      │    │
│  └──────────────┴──────────┴──────────┴──────────┴─────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. 상황별 최적 선택

```
┌─────────────────────────────────────────────────────────────────┐
│                    상황별 최적 선택 가이드                        │
│                                                                 │
│  [의사결정 트리]                                                │
│                                                                 │
│  Q1. 지연시간이 100ms 이하여야 하는가?                          │
│  ├── Yes → CDC + Kafka 또는 Listen to Yourself                  │
│  └── No  → Q2로                                                │
│                                                                 │
│  Q2. 강한 순서 보장이 필요한가?                                 │
│  ├── Yes → CDC + Kafka (partition key = aggregate ID)           │
│  └── No  → Q3로                                                │
│                                                                 │
│  Q3. 이미 Kafka가 있는가?                                       │
│  ├── Yes → Outbox + Debezium (바로 적용 가능)                   │
│  └── No  → Q4로                                                │
│                                                                 │
│  Q4. 소규모 팀, 브로커 없음?                                    │
│  ├── Yes → Outbox + Polling Publisher (단순 시작)               │
│  └── No  → Q5로                                                │
│                                                                 │
│  Q5. AWS/GCP/Azure 올인?                                        │
│  ├── Yes → 해당 클라우드의 관리형 CDC                           │
│  └── No  → Q6로                                                │
│                                                                 │
│  Q6. 이벤트 이력이 핵심 비즈니스 자산인가?                      │
│  ├── Yes → Event Sourcing (복잡도 감수)                         │
│  └── No  → Polling 시작 → 추후 CDC 마이그레이션                 │
│                                                                 │
│                                                                 │
│  [상황별 정리표]                                                │
│                                                                 │
│  ┌─────────────────────────┬────────────────────────────────┐   │
│  │ 상황                    │ 권장 방식                      │   │
│  ├─────────────────────────┼────────────────────────────────┤   │
│  │ 소규모 팀/단일 서비스   │ Outbox + Polling Publisher     │   │
│  │ 대규모(10+서비스)       │ Outbox + CDC (Debezium+Kafka)  │   │
│  │ 이미 Kafka 사용 중      │ Outbox + Debezium              │   │
│  │ 레거시 DB, 브로커 없음  │ Polling 시작 → CDC 전환        │   │
│  │ 강한 순서 보장          │ CDC + Kafka (partition key)    │   │
│  │ 낮은 지연시간           │ Listen to Yourself 또는 CDC    │   │
│  │ 감사 이력 필수          │ Event Sourcing + CQRS          │   │
│  │ 멀티서비스 트랜잭션     │ Saga + Outbox                  │   │
│  └─────────────────────────┴────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 성능 벤치마크

```
┌─────────────────────────────────────────────────────────────────┐
│                    성능 벤치마크                                  │
│                                                                 │
│  [Polling Publisher 지연시간]                                    │
│  ┌──────────────┬──────────────┬───────────────────────────┐    │
│  │ Poll Interval│ 최대 지연    │ 비고                      │    │
│  ├──────────────┼──────────────┼───────────────────────────┤    │
│  │ 100ms        │ ~100ms+α     │ 적극적, DB 부하 증가      │    │
│  │ 500ms        │ ~500ms+α     │ 일반적 설정               │    │
│  │ 1초          │ ~1초+α       │ 보수적 설정               │    │
│  │ 5초          │ ~5초+α       │ 지연 허용 시나리오         │    │
│  └──────────────┴──────────────┴───────────────────────────┘    │
│  → Poll Interval이 지연시간의 절대적 하한선(latency floor)      │
│                                                                 │
│  [CDC (Debezium) 지연시간]                                      │
│  ┌─────────────────────────┬────────────────────────────────┐   │
│  │ 환경                    │ 지연시간                       │   │
│  ├─────────────────────────┼────────────────────────────────┤   │
│  │ PostgreSQL → Kafka      │ 수십 ms (20~99ms)             │   │
│  │ MySQL → Kafka           │ ms 단위                       │   │
│  │ AWS MSK Connect(6k ops) │ 평균 258ms, P99 498.7ms      │   │
│  └─────────────────────────┴────────────────────────────────┘   │
│  → Polling 대비 10~100배 낮은 지연 가능                         │
│                                                                 │
│  [Debezium 처리량]                                              │
│  ┌──────────────────────────┬───────────────────────────────┐   │
│  │ 환경                     │ 처리량                        │   │
│  ├──────────────────────────┼───────────────────────────────┤   │
│  │ AWS MSK Connect          │ ~6,000 ops/sec               │   │
│  │ PostgreSQL (protobuf)    │ ~174,000 events/sec          │   │
│  │ Canal (MySQL binlog)     │ 600K ~ 2M TPS               │   │
│  └──────────────────────────┴───────────────────────────────┘   │
│                                                                 │
│  [Outbox 테이블의 DB 성능 영향]                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  추가 INSERT:  중간 (트랜잭션당 1회 추가)                │    │
│  │  Polling 쿼리: 높음 (서비스 수 × 빈도만큼 누적)         │    │
│  │  인덱스 비용:  중간 (published/unpublished 인덱스)       │    │
│  │  테이블 증가:  높음 (cleanup 없으면 지속 증가)           │    │
│  │  CDC 방식 시:  매우 낮음 (DB compute에 거의 영향 없음)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 실전 베스트 프랙티스

## 9.1 Outbox 테이블 설계

```
┌─────────────────────────────────────────────────────────────────┐
│           Outbox 테이블 설계 베스트 프랙티스                     │
│                                                                 │
│  [최소 권장 스키마 (Debezium Outbox Event Router 호환)]         │
│                                                                 │
│  CREATE TABLE outbox_events (                                   │
│      id              UUID         PK  DEFAULT gen_random_uuid(),│
│      aggregate_type  VARCHAR(255) NOT NULL,                     │
│      aggregate_id    VARCHAR(255) NOT NULL,                     │
│      type            VARCHAR(255) NOT NULL,                     │
│      payload         JSONB        NOT NULL,                     │
│      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),       │
│      trace_id        VARCHAR(255) NULL  -- OpenTelemetry 연동   │
│  );                                                             │
│                                                                 │
│  [컬럼별 역할]                                                  │
│  ┌────────────────┬─────────────────────────────────────────┐   │
│  │ aggregate_type │ Debezium SMT 토픽 라우팅 기준           │   │
│  │                │ "Order" → outbox.event.Order 토픽        │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ aggregate_id   │ Kafka message key → 동일 aggregate      │   │
│  │                │ 이벤트의 파티션 순서 보장                │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ payload (JSONB)│ 유연한 스키마 변경 지원                  │   │
│  │                │ 1KB~10KB 이하 권장, 대용량은 reference   │   │
│  └────────────────┴─────────────────────────────────────────┘   │
│                                                                 │
│  [인덱스 전략]                                                  │
│  ├── CDC 방식: id (PK)만으로 충분                               │
│  └── Polling 방식:                                              │
│      CREATE INDEX idx_outbox_unpublished                        │
│        ON outbox_events (created_at ASC)                        │
│        WHERE published_at IS NULL;  -- partial index            │
│                                                                 │
│  [파티셔닝 (대규모 환경)]                                       │
│  ├── PARTITION BY RANGE (created_at) -- 날짜 기반               │
│  ├── 오래된 파티션은 DROP/DETACH (DELETE보다 10~100x 빠름)      │
│  └── PostgreSQL CDC 시: publish_via_partition_root = true 필수  │
│                                                                 │
│  [Cleanup 전략]                                                 │
│  ├── 파티셔닝 + 파티션 DROP (대규모 권장)                       │
│  ├── 배치 DELETE (소규모)                                       │
│  ├── Clever Delete (CDC: INSERT 즉시 DELETE, 테이블 항상 비움)  │
│  └── 보존 기간: 최소 7~10일 권장                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.2 Debezium 운영

```
┌─────────────────────────────────────────────────────────────────┐
│           Debezium 운영 베스트 프랙티스                           │
│                                                                 │
│  [핵심 Connector 설정]                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  plugin.name: pgoutput                                   │    │
│  │  slot.name: debezium_outbox_slot                         │    │
│  │  table.include.list: public.outbox_events                │    │
│  │  snapshot.mode: never                                    │    │
│  │  heartbeat.interval.ms: 10000                            │    │
│  │  transforms: outbox (EventRouter SMT)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Outbox Event Router SMT 동작]                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Raw CDC Event                     Kafka Message         │    │
│  │  { "after": {                 →    Topic: outbox.event.  │    │
│  │      "aggregatetype": "Order",           Order           │    │
│  │      "aggregateid": "123",         Key: "123"            │    │
│  │      "payload": "{...}"            Value: {...}          │    │
│  │    }                                                     │    │
│  │  }                                                       │    │
│  │                                                          │    │
│  │  INSERT → 이벤트 추출/라우팅                             │    │
│  │  DELETE → 폐기 (무시)                                    │    │
│  │  UPDATE → 경고/에러                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [PostgreSQL Replication Slot 관리 — 가장 중요!]                │
│                                                                 │
│  ⚠️  Slot은 처리하지 못한 WAL을 보관하도록 강제한다.            │
│  ⚠️  Debezium 장애 시 WAL이 무한 축적 → 디스크 고갈!           │
│                                                                 │
│  필수 조치:                                                     │
│  ├── max_slot_wal_keep_size = 10GB (PostgreSQL 13+)             │
│  ├── heartbeat 테이블: LSN을 강제 전진시켜 WAL 축적 방지       │
│  ├── 모니터링 쿼리:                                             │
│  │   SELECT slot_name,                                          │
│  │     pg_size_pretty(                                          │
│  │       pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)    │
│  │     ) AS wal_lag                                             │
│  │   FROM pg_replication_slots;                                 │
│  └── wal_lag > 1GB 시 알람 설정                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.3 이벤트 설계

```
┌─────────────────────────────────────────────────────────────────┐
│           이벤트 설계 베스트 프랙티스                             │
│                                                                 │
│  [CloudEvents 스펙 준수]                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  {                                                       │    │
│  │    "specversion": "1.0",                                 │    │
│  │    "id": "550e8400-e29b-41d4-a716-446655440000",         │    │
│  │    "source": "https://myservice.example.com/orders",     │    │
│  │    "type": "com.example.orders.v1.OrderPlaced",          │    │
│  │    "time": "2026-03-17T10:30:00Z",                       │    │
│  │    "datacontenttype": "application/json",                │    │
│  │    "data": {                                             │    │
│  │      "orderId": "ord-12345",                             │    │
│  │      "customerId": "cust-67890",                         │    │
│  │      "totalAmount": 150000                               │    │
│  │    }                                                     │    │
│  │  }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [스키마 진화 (Schema Evolution) 규칙]                           │
│  ├── ❌ 기존 필드 타입 변경 금지                                │
│  ├── ❌ 기존 필드 이름 변경 금지                                │
│  ├── ❌ required 필드 삭제 금지                                 │
│  ├── ✅ 새 필드 추가 시 default value 필수 설정                 │
│  └── ✅ 호환성 파괴 변경 시 type 버전을 올려 별도 이벤트로 처리 │
│                                                                 │
│  [Payload 크기 관리]                                            │
│  ┌──────────────┬────────────────────────────────────────┐      │
│  │ Fat Event    │ 전체 상태를 payload에 포함              │      │
│  │              │ → Consumer가 추가 조회 없이 처리 가능   │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ Thin Event   │ ID만 포함, Consumer가 조회              │      │
│  │ (Reference)  │ → 민감 데이터, 대용량 객체에 적합       │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ Hybrid       │ 핵심 필드 + aggregate ID                │      │
│  │ (권장)       │ → 일반적인 권장 방식                    │      │
│  └──────────────┴────────────────────────────────────────┘      │
│  Outbox payload 크기: 1KB~10KB 이하 권장                        │
│  대용량 바이너리 → S3 URL을 reference로 포함 (Claim Check 패턴) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.4 코드 구현 예시 (Spring Boot + JPA)

```
┌─────────────────────────────────────────────────────────────────┐
│           Spring Boot + JPA Outbox 구현 패턴                     │
│                                                                 │
│  [1. 도메인 서비스 — 같은 트랜잭션에서 비즈니스 + Outbox]       │
│                                                                 │
│  @Service                                                       │
│  public class OrderService {                                    │
│                                                                 │
│      @Transactional                                             │
│      public Order placeOrder(PlaceOrderCommand cmd) {           │
│          // 비즈니스 로직                                       │
│          Order order = new Order(cmd.getCustomerId(), ...);     │
│          orderRepository.save(order);                           │
│                                                                 │
│          // Outbox에 이벤트 기록 (동일 트랜잭션!)               │
│          OutboxEvent event = OutboxEvent.builder()               │
│              .aggregateType("Order")                            │
│              .aggregateId(order.getId().toString())              │
│              .type("OrderPlaced")                               │
│              .payload(objectMapper.writeValueAsString(           │
│                  new OrderPlacedEvent(order)))                   │
│              .build();                                          │
│          outboxEventRepository.save(event);                     │
│                                                                 │
│          return order;                                          │
│      }                                                         │
│  }                                                             │
│                                                                 │
│  [2. Polling Publisher (CDC 미사용 시)]                          │
│                                                                 │
│  @Scheduled(fixedDelay = 1000)  // 1초 간격                    │
│  @Transactional                                                 │
│  public void pollAndPublish() {                                │
│      List<OutboxEvent> events = outboxEventRepository           │
│          .findUnprocessedWithLock();  // SKIP LOCKED            │
│                                                                 │
│      for (OutboxEvent event : events) {                        │
│          String topic = "outbox.event." +                       │
│              event.getAggregateType();                          │
│          kafkaTemplate.send(topic,                              │
│              event.getAggregateId(),                            │
│              event.getPayload()).get(5, SECONDS);               │
│          event.markAsProcessed();                              │
│      }                                                         │
│  }                                                             │
│                                                                 │
│  [3. Idempotent Consumer (Inbox 패턴)]                          │
│                                                                 │
│  @KafkaListener(topics = "outbox.event.Order")                 │
│  @Transactional                                                 │
│  public void handle(ConsumerRecord<String, String> record) {   │
│      String eventId = getHeader(record, "id");                 │
│                                                                 │
│      // 중복 처리 방지                                         │
│      if (processedEventRepository.existsById(eventId)) {       │
│          return; // 이미 처리됨, 스킵                          │
│      }                                                         │
│                                                                 │
│      processEvent(record.value());                             │
│      processedEventRepository.save(                            │
│          new ProcessedEvent(eventId, Instant.now()));           │
│  }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 주요 함정과 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│                    10대 안티패턴                                  │
│                                                                 │
│  1. Outbox 테이블 무한 성장                                     │
│     ├── Cleanup 없이 운영 → 수억 건 축적 → 쿼리 성능 급락     │
│     └── 해결: 파티셔닝 + DROP, 또는 Clever Delete (CDC 시)     │
│                                                                 │
│  2. 순서 보장 실패 (Partition Key 미설정)                       │
│     ├── aggregate_id를 Kafka key로 미설정 시                    │
│     │   동일 Order의 이벤트가 서로 다른 partition에 분산        │
│     └── 해결: aggregate_id → Kafka message key 매핑 필수        │
│                                                                 │
│  3. 이벤트 Payload에 민감 정보 포함                             │
│     ├── PII, 카드번호 등이 Kafka에 영구 저장 → GDPR 위반       │
│     └── 해결: reference(ID)만 포함, Consumer가 API로 조회       │
│                                                                 │
│  4. 스키마 변경 시 하위 호환성 파괴                             │
│     ├── 필드 삭제/타입 변경 → 구버전 Consumer 중단              │
│     └── 해결: 새 필드 추가만 허용, 호환 불가 시 type 버전업    │
│                                                                 │
│  5. Polling Publisher의 "Thundering Herd"                       │
│     ├── 10개 서비스 × 3 인스턴스 = 초당 60+회 폴링 쿼리       │
│     └── 해결: CDC 전환, 또는 adaptive polling + jitter          │
│                                                                 │
│  6. CDC Connector 장애 시 WAL/Binlog 폭증                      │
│     ├── Debezium 정지 → PostgreSQL WAL 무한 축적 → 디스크 고갈 │
│     └── 해결: max_slot_wal_keep_size, wal_lag 알람 설정         │
│                                                                 │
│  7. Outbox에 너무 큰 Payload 저장                               │
│     ├── 수백 KB payload → DB 부하 + Kafka 크기 제한 초과       │
│     └── 해결: 1~10KB 이하 권장, 대용량은 Claim Check 패턴      │
│                                                                 │
│  8. Consumer 멱등성 미구현                                      │
│     ├── 중복 이벤트 → 중복 처리 (잔액 2회 차감 등)             │
│     └── 해결: Inbox 패턴 (message_id 기반 deduplication)        │
│                                                                 │
│  9. 이벤트 발행 순서에 대한 잘못된 가정                         │
│     ├── INSERT 순서 ≠ Kafka 도달 순서 (항상은 아님)             │
│     └── 해결: 이벤트 내 version/timestamp 사용, partition 보장   │
│                                                                 │
│  10. Outbox를 API로 직접 조회                                   │
│      ├── Consumer가 Producer의 Outbox 테이블을 직접 쿼리        │
│      │   → 서비스 간 강한 결합, Outbox 패턴의 목적 훼손        │
│      └── 해결: 모든 구독은 반드시 Message Broker를 통해야 함    │
│                                                                 │
│  프로덕션 장애의 70%:                                           │
│  Consumer 멱등성 미구현 + Outbox cleanup 없음                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 마이그레이션 가이드

## 11.1 모놀리스 → Outbox 패턴 도입

```
┌─────────────────────────────────────────────────────────────────┐
│           모놀리스에서 Outbox 패턴 도입 단계                     │
│                                                                 │
│  Phase 1: 준비 (1~2주)                                          │
│  ├── 도메인 이벤트 발생 지점 식별                               │
│  ├── Outbox 테이블 스키마 설계 및 생성                          │
│  ├── 비즈니스 로직에 Outbox 쓰기 코드 추가                     │
│  └── Feature flag로 on/off 제어 준비                            │
│                                                                 │
│  Phase 2: 검증 (2~4주)                                          │
│  ├── Staging에서 Outbox 쓰기 활성화                             │
│  ├── 이벤트 기록 검증                                           │
│  ├── 모니터링 대시보드 구축                                     │
│  └── Cleanup 스케줄러 검증                                      │
│                                                                 │
│  Phase 3: 발행 (2~4주)                                          │
│  ├── Polling Publisher 구현                                     │
│  ├── Consumer 이벤트 수신 테스트                                │
│  ├── 멱등성 검증 (중복 발행 시뮬레이션)                        │
│  └── Production 배포 (Feature flag로 점진적 활성화)             │
│                                                                 │
│  Phase 4: 안정화                                                │
│  ├── 동기 호출 → 이벤트 기반으로 점진적 대체                   │
│  └── CDC 전환 계획 수립                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.2 Polling Publisher → CDC (Debezium) 전환

```
┌─────────────────────────────────────────────────────────────────┐
│           Polling → CDC 전환 단계                                │
│                                                                 │
│  Phase 1: 인프라 준비 (1주)                                     │
│  ├── Kafka Connect 클러스터 구성                                │
│  ├── Debezium PostgreSQL Connector 설치                         │
│  ├── PostgreSQL: wal_level=logical 확인                         │
│  └── max_replication_slots, max_wal_senders 확인                │
│                                                                 │
│  Phase 2: 스키마 보정 (2~3일)                                   │
│  ├── aggregate_type, aggregate_id 컬럼 확인/추가                │
│  ├── CREATE PUBLICATION outbox_pub FOR TABLE outbox_events;     │
│  └── Replication slot 생성 테스트                               │
│                                                                 │
│  Phase 3: 병렬 운영 (1~2주) ← 핵심 단계!                       │
│  ├── Debezium Connector 배포 (이벤트 발행 비활성화)             │
│  ├── Polling Publisher 계속 운영 (이중 안전망)                  │
│  ├── Debezium 캡처 이벤트 vs Polling 이벤트 비교 검증          │
│  └── 레이턴시 비교: Polling(1~2초) vs CDC(수십 ms)             │
│                                                                 │
│  Phase 4: 전환 완료 (1일)                                       │
│  ├── Polling Publisher 비활성화                                  │
│  ├── Debezium 실제 발행 활성화                                  │
│  └── 모니터링 확인 후 Polling 코드 제거                        │
│                                                                 │
│  Phase 5: 정리                                                  │
│  ├── processed_at 컬럼 제거 (CDC에서는 불필요)                  │
│  ├── Polling용 인덱스 제거                                      │
│  └── 파티셔닝 최적화 적용                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 기존 Dual Write → Outbox 패턴 전환

```
┌─────────────────────────────────────────────────────────────────┐
│           Dual Write → Outbox 전환 전략                          │
│                                                                 │
│  [현재]  Service → DB write + Kafka send (원자성 없음)          │
│  [목표]  Service → DB + Outbox → Debezium → Kafka              │
│                                                                 │
│  Step 1: Outbox 테이블 추가 (무중단)                            │
│  └── 서비스 코드 미변경, 테이블만 생성                         │
│                                                                 │
│  Step 2: Dual-Track 쓰기 (무중단)                               │
│  ├── 기존 Kafka 직접 발행 유지                                  │
│  ├── 동시에 Outbox에도 기록                                     │
│  ├── Consumer가 중복 처리 (idempotency 선행 구현 필요!)         │
│  └── Feature flag: outbox_write_enabled = true                  │
│                                                                 │
│  Step 3: Debezium 활성화 (무중단)                               │
│  ├── Outbox → Kafka 경로 검증                                   │
│  └── 직접 발행 vs Debezium 이벤트 비교                         │
│                                                                 │
│  Step 4: 직접 발행 코드 제거 (배포 필요)                        │
│  ├── Feature flag: direct_kafka_publish = false                  │
│  └── Outbox 경로만으로 운영 (72시간 관찰)                       │
│                                                                 │
│  Step 5: 정리                                                   │
│  ├── 직접 발행 코드 완전 제거                                   │
│  └── Feature flag 코드 제거                                     │
│                                                                 │
│  핵심 원칙:                                                     │
│  ├── 각 단계는 독립적으로 롤백 가능                             │
│  ├── Consumer idempotency는 Step 2 이전에 반드시 완료           │
│  └── Shadow comparison으로 정확성 검증                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 학술적/이론적 배경

```
┌─────────────────────────────────────────────────────────────────┐
│                    핵심 학술 문헌                                 │
│                                                                 │
│  [Pat Helland — "Life beyond Distributed Transactions" (2007)]  │
│  ├── CIDR 2007 발표, 2016년 ACM Queue 재게재                   │
│  ├── 핵심 명제: "대규모 시스템에서 분산 트랜잭션은 불가능"      │
│  ├── 대안: Entity + Activity + Message 세 가지 추상화           │
│  │   ├── Entity: 단일 키로 식별, 내부만 원자적 업데이트 가능    │
│  │   ├── Activity: Entity 간 합의를 위한 워크플로우              │
│  │   └── Message: Entity 간 조율의 유일한 메커니즘              │
│  └── Outbox 패턴 = Helland 모델의 실용적 구현                   │
│                                                                 │
│  [Eric Brewer — CAP Theorem (2000)]                             │
│  ├── Consistency, Availability, Partition Tolerance              │
│  │   → 셋 중 둘만 선택 가능                                    │
│  ├── 2002년 Gilbert & Lynch가 수학적 증명                       │
│  └── Outbox 패턴이 필요한 이론적 배경:                          │
│      CP/AP 선택 불가피 → Eventual Consistency 패턴의 정당성     │
│                                                                 │
│  [Eric Evans — DDD Blue Book (2003)]                            │
│  ├── Aggregate 경계 = 트랜잭션 일관성 경계                      │
│  ├── Domain Event는 원서에 미포함 → 2009년 공식 추가            │
│  └── Aggregate 간 데이터 일관성 문제 → Outbox 패턴의 구조적 원인│
│                                                                 │
│  [Martin Fowler — Event Sourcing (2005)]                        │
│  ├── 모든 상태 변경을 이벤트 시퀀스로 저장                      │
│  └── Append-only log 개념 → Outbox 테이블 설계의 원리           │
│                                                                 │
│  [Greg Young — CQRS (2010)]                                     │
│  ├── Command와 Query의 책임 분리                                │
│  ├── Domain Event를 과거 시제로 명명하는 관례 확립              │
│  └── Event Store = Source of Truth 개념                         │
│                                                                 │
│  [Chris Richardson — Microservices Patterns (2018)]              │
│  ├── Transactional Outbox를 공식 패턴으로 카탈로그화            │
│  ├── microservices.io에 44개+ 패턴 체계 정립                    │
│  └── Eventuate Tram 프레임워크로 레퍼런스 구현 제공             │
│                                                                 │
│  [Gunnar Morling — CDC + Outbox 청사진 (2019)]                  │
│  ├── Debezium Blog에서 레퍼런스 아키텍처 확립                   │
│  ├── Clever Delete 기법 (INSERT 즉시 DELETE) 최초 문서화        │
│  └── Outbox Event Router SMT 설계/구현                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 관련 문서

```
┌─────────────────────────────────────────────────────────────────┐
│                    관련 문서 링크                                 │
│                                                                 │
│  프로젝트 내 관련 문서:                                         │
│  ├── docs/backend/dual-write-패턴.md                            │
│  │   └── Dual Write 문제의 상세 분석과 해결 패턴                │
│  ├── docs/backend/cqrs-event-sourcing-패턴.md                   │
│  │   └── CQRS + Event Sourcing 완전 가이드                      │
│  └── docs/backend/보상트랜잭션-saga.md                          │
│      └── Saga 패턴과 보상 트랜잭션 상세                         │
│                                                                 │
│  외부 참고 자료:                                                │
│  ├── microservices.io/patterns/data/transactional-outbox.html   │
│  ├── debezium.io/blog/2019/02/19/reliable-microservices-data-   │
│  │   exchange-with-the-outbox-pattern/                          │
│  ├── debezium.io/documentation/reference/stable/transformations │
│  │   /outbox-event-router.html                                  │
│  ├── queue.acm.org/detail.cfm?id=3025012                       │
│  │   (Pat Helland, "Life beyond Distributed Transactions")      │
│  ├── github.com/cloudevents/spec                                │
│  │   (CloudEvents Specification)                                │
│  ├── docs.confluent.io/platform/current/schema-registry/        │
│  │   fundamentals/schema-evolution.html                         │
│  └── udidahan.com/2009/06/14/domain-events-salvation/           │
│      (Udi Dahan, Domain Events – Salvation)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

