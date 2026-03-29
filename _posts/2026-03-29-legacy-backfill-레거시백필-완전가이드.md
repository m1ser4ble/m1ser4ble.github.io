---
layout: single
title: "Legacy Backfill 레거시 백필 완전 가이드"
date: 2026-03-29 23:00:00 +0900
categories: backend
excerpt: "Legacy Backfill은 과거 데이터를 새로운 스키마와 파이프라인 요구에 맞게 안전하게 소급 처리하는 운영 핵심 전략이다."
toc: true
toc_sticky: true
tags: [backend, data, migration, backfill, cdc]
source: "/home/dwkim/dwkim/docs/backend/legacy-backfill-레거시백필-완전가이드.md"
---
TL;DR
- Legacy Backfill은 과거 데이터 공백을 새 시스템 요구사항에 맞게 소급 보정하는 작업이다.
- 대규모 마이그레이션에서는 멱등성, 체크포인트, 속도 제어, 검증 체계가 필수다.
- Full, Incremental, CDC, Feature Flag 단계 전환 등 상황별 전략 선택이 성공을 좌우한다.

## 1. 개념
Legacy Backfill은 레거시의 과거 데이터를 새 스키마·로직에 맞춰 소급 처리해 공백을 메우는 데이터 운영 기법이다.

## 2. 배경
스키마 변경, 시스템 전환, 파이프라인 장애 복구, 지표 재정의 같은 변화가 누적되며 과거 데이터 정합성 보정이 필수화됐다.

## 3. 이유
백필을 통해 새 기능/지표 도입 시 과거 데이터까지 일관성을 확보하고 무중단 전환과 리스크 통제를 동시에 달성할 수 있다.

## 4. 특징
멱등성, 재개 가능성, 관측성, 속도 제어, 검증 체크리스트, DLQ/롤백 전략이 실무 핵심 특징이다.

## 5. 상세 내용

# Legacy Backfill (레거시 백필) 완전 가이드

> **작성일**: 2026-03-28
> **카테고리**: Backend / Data Engineering / Migration / Distributed Systems
> **키워드**: Legacy Backfill, Data Migration, CDC, Change Data Capture, ETL, Dual Write, Event Sourcing Replay, Strangler Fig, Blue-Green Migration, Idempotency, Cursor Pagination, Checkpoint, DLQ, gh-ost, Ghostferry, Debezium, Airflow, dbt, Flink, Schema Evolution, Expand-Migrate-Contract

---

## 목차

1. [개요](#1-개요)
2. [용어 사전](#2-용어-사전)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원과 진화](#4-역사적-기원과-진화)
5. [학술적/이론적 배경](#5-학술적이론적-배경)
6. [백필 전략 비교](#6-백필-전략-비교)
7. [설계 원칙과 베스트 프랙티스](#7-설계-원칙과-베스트-프랙티스)
8. [안티패턴과 함정](#8-안티패턴과-함정)
9. [빅테크 실전 사례](#9-빅테크-실전-사례)
10. [체크리스트](#10-체크리스트)
11. [참고 자료](#11-참고-자료)

---

## 1. 개요

### 한 줄 정의

> **Legacy Backfill**: 레거시 시스템에 존재하는 과거 데이터를, 새로운 스키마/파이프라인/시스템에서 요구하는 형식으로 **소급(retroactively) 처리하거나 채워 넣는 작업**.

### 왜 알아야 하는가

현대 소프트웨어 시스템은 끊임없이 진화한다. 새로운 컬럼이 추가되고, 비즈니스 로직이 변경되며, 레거시 시스템이 새 아키텍처로 전환된다. 이 과정에서 "이미 존재하는 과거 데이터"를 어떻게 처리할 것인가는 거의 모든 팀이 직면하는 문제다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Legacy Backfill이 필요한 근본적 이유                │
│                                                                 │
│  시스템은 진화한다. 데이터는 남는다.                            │
│                                                                 │
│  [과거]                    [현재]                               │
│  ┌──────────────┐          ┌──────────────────┐                │
│  │ users 테이블  │          │ users 테이블      │                │
│  │              │   ADD    │                  │                │
│  │ id           │ ──────►  │ id               │                │
│  │ name         │  COLUMN  │ name             │                │
│  │ email        │          │ email            │                │
│  │              │          │ phone_hash  ← NEW (과거 row는 NULL)│
│  │              │          │ risk_score  ← NEW (과거 row는 NULL)│
│  └──────────────┘          └──────────────────┘                │
│                                                                 │
│  → 과거 100만 건의 phone_hash, risk_score를 채워야 한다         │
│  → 이것이 Backfill이다                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

백필을 잘못 수행하면 서비스 장애, 데이터 불일치, 롤백 불가능한 상황이 발생한다. 반대로, 체계적으로 설계된 백필은 무중단 마이그레이션의 핵심 도구가 된다. Stripe, Netflix, Uber 같은 빅테크가 수십억 건의 데이터를 무중단으로 이전할 수 있었던 것은 백필 전략이 잘 갖춰져 있었기 때문이다.

---

## 2. 용어 사전

### 2.1 Backfill 어원

**"Backfill"** 은 건설/토목 용어에서 유래했다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backfill의 어원                               │
│                                                                 │
│  건설 분야:                                                     │
│  "back" + "fill" = 굴착 후 빈 구멍을 되메우는 작업             │
│                                                                 │
│  [굴착 전]     [굴착 후]      [되메우기]                       │
│   ▓▓▓▓▓▓       ▓▓    ▓▓       ▓▓████▓▓                       │
│   ▓▓▓▓▓▓  →   ▓▓    ▓▓  →   ▓▓████▓▓                       │
│   ▓▓▓▓▓▓       ▓▓    ▓▓       ▓▓████▓▓                       │
│                 (빈 공간)      (새 재료로 채움)                  │
│                                                                 │
│  소프트웨어에서의 메타포:                                       │
│  "원래 있었어야 했는데 비어 있는 곳을 채운다"                   │
│  = 과거 데이터에 새로운 형식/값을 소급 적용                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 관련 용어 비교

| 용어 | 정의 | 핵심 특징 |
|------|------|----------|
| **Data Backfill** | 누락/잘못 처리된 과거 데이터를 소급 처리 | 반복 가능, 시간 범위 지정 |
| **Backpopulation** | 새 컬럼/필드에 과거 레코드 값 채우기 | DB 컬럼 단위의 좁은 범위 |
| **Historical Data Loading** | 시스템 초기화 시 과거 데이터 일괄 적재 | 일회성, 초기 구축 시 |
| **Data Remediation** | 데이터 품질/거버넌스 관점의 정제/수정 | 거버넌스 중심, 규정 준수 |

### 2.3 Backfill vs Migration vs ETL vs Sync

| 차원 | Backfill | Migration | ETL | Sync |
|------|----------|-----------|-----|------|
| **목적** | 과거 데이터 공백/오류 소급 처리 | 시스템 간 데이터 이동 | 다중 소스 데이터 변환/적재 | 소스-타겟 지속적 동기화 |
| **시간적 방향** | 과거(backward-looking) | 현재 기준 이동 | 과거~현재 모두 | 현재 및 미래(forward) |
| **반복성** | 반복 가능한 운영 작업 | 주로 일회성 프로젝트 | 정기적 배치/스트림 | 지속적 증분 |
| **데이터 변환** | 선택적 (있을 수도 없을 수도) | 최소화 (형식 맞추기) | 변환이 핵심 목적 | 최소화 (동기화 유지) |
| **범위** | 특정 시간 범위/레코드 집합 | 전체 데이터셋 | 특정 데이터셋/파이프라인 | 증분 변경분 |
| **실패 시** | 해당 범위만 재처리 | 전체 롤백 필요할 수 있음 | 파이프라인 재실행 | 재동기화 |

### 2.4 Legacy Backfill의 정확한 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                 Legacy Backfill = 세 가지 요소의 교차점          │
│                                                                 │
│         ┌───────────────────┐                                   │
│         │   Legacy System   │ ← 기존 시스템의 과거 데이터       │
│         │   (원본 데이터)    │                                   │
│         └────────┬──────────┘                                   │
│                  │                                               │
│                  ▼                                               │
│         ┌───────────────────┐                                   │
│         │   Transformation  │ ← 새로운 스키마/형식으로 변환     │
│         │   (변환 로직)      │                                   │
│         └────────┬──────────┘                                   │
│                  │                                               │
│                  ▼                                               │
│         ┌───────────────────┐                                   │
│         │   New System      │ ← 새 시스템에 소급 적재           │
│         │   (타겟 적재)      │                                   │
│         └───────────────────┘                                   │
│                                                                 │
│  Legacy Backfill = Legacy Data + Retroactive Processing         │
│                  + New Schema/System Conformance                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 등장 배경과 이유

### 3.1 5가지 트리거 시나리오

백필이 필요해지는 가장 일반적인 상황은 다섯 가지로 분류할 수 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│              백필을 트리거하는 5가지 시나리오                     │
│                                                                 │
│  1. 새 컬럼/피처 추가                                           │
│     ├── ALTER TABLE users ADD COLUMN phone_hash VARCHAR(64)     │
│     ├── 추가 시점 이후 row만 값 존재                            │
│     └── 이전 row는 NULL → 백필 필요                             │
│                                                                 │
│  2. 비즈니스 로직/메트릭 정의 변경                              │
│     ├── "활성 사용자" 정의가 30일 → 14일로 변경                │
│     ├── 과거 리포트 수치 재계산 필요                            │
│     └── 이전 기간 메트릭을 새 정의로 소급 적용                  │
│                                                                 │
│  3. 파이프라인 장애/버그 복구                                   │
│     ├── 특정 기간 동안 데이터 누락/오류 발생                   │
│     ├── 버그 수정 후 영향받은 구간만 재처리                     │
│     └── 정상 데이터로 덮어쓰기                                  │
│                                                                 │
│  4. 레거시 시스템 마이그레이션                                  │
│     ├── 모놀리스 → 마이크로서비스 전환                         │
│     ├── 수년치 데이터를 새 포맷/스키마로 변환                  │
│     └── 가장 대규모, 가장 복잡한 백필 시나리오                  │
│                                                                 │
│  5. ML 모델 학습용 피처 스토어 구축                             │
│     ├── 새 피처 정의 후 과거 시점의 피처 값 필요               │
│     ├── point-in-time correctness 보장 필수                    │
│     └── 미래 데이터 누출(data leakage) 방지                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 이전에는 어떻게 했고, 왜 부족했는가

| 시대 | 접근 방식 | 한계 |
|------|----------|------|
| **수동 스크립트** | DBA가 `UPDATE ... SET` 직접 실행 | 대규모 데이터에서 Lock 유발, 재현 불가, 롤백 어려움 |
| **일괄 배치 잡** | 야간 배치로 전체 테이블 재처리 | 다운타임 필요, 서비스 영향, 멱등성 미보장 |
| **ETL 파이프라인** | Informatica/SSIS 같은 도구로 일괄 변환 | 무거운 인프라, 실시간 불가, 복잡한 의존성 |
| **Export-Transform-Import** | CSV 덤프 → 변환 → 재적재 | 데이터 정합성 보장 어려움, 중간 상태 위험 |

이 접근들의 **공통 한계**:
- 서비스 중단(다운타임) 필요
- 멱등성(idempotency) 미보장 → 재실행 시 중복/오류
- 중간 실패 시 이어서 처리(resumability) 불가
- 진행률 모니터링(observability) 부재
- 운영 DB에 과도한 부하 → 서비스 성능 저하

---

## 4. 역사적 기원과 진화

### 4.1 연대표

```
┌─────────────────────────────────────────────────────────────────┐
│              Legacy Backfill 기술 진화 연대표                    │
│                                                                 │
│  1970-80s ─── 메인프레임 배치 처리 ──────────────────────────   │
│  │            COBOL, JCL, 전체 파일 재처리                      │
│  │            특징: 비선택적, 고비용, 야간 윈도우               │
│  │                                                               │
│  1990s ────── DW + ETL 시대 ─────────────────────────────────   │
│  │            Bill Inmon/Ralph Kimball DW 아키텍처              │
│  │            "Historical Load" 개념 정형화                     │
│  │            SCD(Slowly Changing Dimensions) 패턴              │
│  │            Informatica, DataStage 등 ETL 도구                │
│  │                                                               │
│  2000s ────── SOA 시대 ──────────────────────────────────────   │
│  │            분산 시스템 간 데이터 이동 복잡도 증가            │
│  │            Oracle CDC (9i, 2001) 최초 도입                   │
│  │            ESB(Enterprise Service Bus) 기반 통합             │
│  │                                                               │
│  2005-10 ──── MapReduce/Hadoop 시대 ─────────────────────────   │
│  │            Google MapReduce 논문 (2004)                      │
│  │            페타바이트 규모 대규모 병렬 백필 가능              │
│  │            Yahoo, Facebook 대규모 적용                       │
│  │                                                               │
│  2010-15 ──── Lambda Architecture 시대 ──────────────────────   │
│  │            Nathan Marz (2011) Lambda Architecture 제안       │
│  │            Batch Layer = 내장 백필 엔진 (주기적 전체 재계산) │
│  │            Serving Layer + Speed Layer 분리                  │
│  │            Apache Spark 등장 (2014)                          │
│  │                                                               │
│  2014-15 ──── Airflow의 등장 ────────────────────────────────   │
│  │            Airbnb의 Apache Airflow가 backfill을              │
│  │            CLI 명령의 일급(first-class) 기능으로 공식화      │
│  │            → 업계 표준 용어 정착의 전환점                    │
│  │                                                               │
│  2015-20 ──── Kafka + Kappa + Debezium 시대 ─────────────────   │
│  │            Kafka의 로그 재생(replay) 기반 백필               │
│  │            Kappa Architecture: 단일 스트리밍 파이프라인으로  │
│  │            배치와 실시간 통합                                 │
│  │            Debezium CDC 오픈소스화                            │
│  │            Airflow가 업계 표준 오케스트레이션 도구로 정착    │
│  │                                                               │
│  2020-현재 ── dbt + Flink + Open Table Format 시대 ──────────   │
│               dbt incremental + microbatch 모델                 │
│               Flink CDC: 통합 스트리밍-백필                     │
│               Apache Iceberg, Delta Lake, Apache Hudi           │
│               ACID 트랜잭션 + Time Travel + 롤백 가능           │
│               백필이 "예외적 복구"에서 "일상적 운영"으로 전환   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 시대별 백필 패턴 비교

| 시대 | 핵심 기술 | 백필 패턴 | 규모 | 특징 |
|------|----------|----------|------|------|
| 1970-80s | 메인프레임, COBOL | 전체 파일 재처리 | MB~GB | 비선택적, 고비용 |
| 1990s | ETL, DW | Historical/Incremental Load | GB~TB | 구조화, SCD 패턴 |
| 2000s | SOA, ESB | 분산 백필, CDC 초기 | TB | 복잡도 증가 |
| 2005-10 | MapReduce/Hadoop | 대규모 병렬 백필 | PB | 페타바이트 처리 가능 |
| 2010-15 | Lambda Architecture | 자동 주기적 백필 | PB | Batch Layer = 내장 백필 엔진 |
| 2015-20 | Kafka, Kappa, Airflow | 로그 재생 기반 백필 | PB | 단일 코드베이스 |
| 2020+ | dbt, Flink, Open Table | 통합 스트리밍-백필 | EB | ACID, 롤백 가능 |

---

## 5. 학술적/이론적 배경

### 5.1 데이터 마이그레이션 이론 (Refinement Correctness)

Thalheim & Wang (2012/2013)의 Refinement Correctness 프레임워크는 데이터 마이그레이션의 정확성을 형식적으로 정의한다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Refinement Correctness Framework                   │
│                                                                 │
│  두 가지 변환 유형:                                             │
│                                                                 │
│  1. Property-Preserving Transformation                          │
│     ├── 원본 데이터의 의미적 속성을 유지하면서 이동             │
│     └── 예: 테이블 구조는 그대로, 데이터만 새 DB로 복사        │
│                                                                 │
│  2. Property-Enhancing Transformation                           │
│     ├── 원본 데이터에 새로운 속성/값을 추가                    │
│     └── 예: 기존 row에 computed column 값 채우기               │
│                                                                 │
│  Legacy Backfill = Property-Enhancing Transformation의 특수 케이스│
│  원본 데이터를 보존하면서 새로운 스키마 요구사항에 맞춰         │
│  추가적인 속성을 계산/변환하여 적재한다.                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 CDC 이론 (Active Database, ECA 규칙)

Change Data Capture(CDC)의 이론적 기반은 **Active Database**의 **ECA(Event-Condition-Action) 규칙**이다. 데이터 변경 이벤트(Event)가 발생하면, 조건(Condition)을 평가하고, 액션(Action)을 실행하는 모델이다.

CDC의 4가지 구현 방식:

| 방식 | 원리 | 장점 | 단점 |
|------|------|------|------|
| **Timestamp 기반** | `updated_at` 컬럼으로 변경분 감지 | 단순 구현 | DELETE 감지 불가, 컬럼 필수 |
| **Differential Snapshot** | 스냅샷 간 차이 비교 | DB 독립적 | 고비용, 대규모 비효율 |
| **Trigger 기반** | DB Trigger로 변경 캡처 | 실시간, 정확 | DB 성능 영향, DB 종속적 |
| **Log 기반** | Transaction Log(WAL/Binlog) 파싱 | 비침습적, 고성능 | DB 종속적, 구현 복잡 |

Oracle 9i(2001)에서 동기식 CDC가 최초 도입되었으며, 현재는 Debezium(Log 기반)이 사실상 오픈소스 표준이다.

### 5.3 CAP Theorem과 Eventual Consistency

Brewer(2000)의 CAP Theorem에서 분산 시스템은 Consistency, Availability, Partition Tolerance 중 최대 2가지만 보장할 수 있다. 대부분의 현대 분산 시스템은 AP를 선택하고 Eventual Consistency를 수용한다.

```
┌─────────────────────────────────────────────────────────────────┐
│          CAP Theorem에서 Backfill의 위치                        │
│                                                                 │
│  Eventual Consistency에서:                                      │
│  "eventually"를 실현하는 구체적 수단 = Backfill                 │
│                                                                 │
│  분산 시스템 내 백필 구현체:                                    │
│  ├── Anti-Entropy: 노드 간 데이터 차이를 주기적으로 수정       │
│  ├── Read Repair: 읽기 시점에 불일치 발견 → 즉시 수정          │
│  ├── Hinted Handoff: 장애 노드 복구 시 누락 데이터 전달       │
│  └── Merkle Tree: 효율적인 데이터 차이 검출                    │
│                                                                 │
│  즉, 백필은 분산 시스템의 Eventual Consistency를               │
│  "Actual Consistency"로 만드는 메커니즘이다.                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 CQRS/Event Sourcing의 Replay = Backfill

CQRS/Event Sourcing 아키텍처에서 **Event Replay = 가장 이상적인 백필 형태**이다.

- Event Store에 모든 상태 변경이 불변(immutable) 이벤트로 저장됨
- Read Model(Projection) 손상/버전업 시 Event Store에서 **완전 재구축** 가능
- 백필이 "예외적 복구"가 아닌 **아키텍처의 일급(first-class) 기능**
- 새로운 Projection을 추가하려면 처음부터 모든 이벤트를 Replay하면 됨

```
┌─────────────────────────────────────────────────────────────────┐
│          Event Sourcing에서의 자연스러운 Backfill               │
│                                                                 │
│  Event Store:                                                   │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                    │
│  │ e1 │ e2 │ e3 │ e4 │ e5 │ e6 │ e7 │ e8 │                    │
│  └──┬─┴──┬─┴──┬─┴──┬─┴──┬─┴──┬─┴──┬─┴──┬─┘                    │
│     │    │    │    │    │    │    │    │                         │
│     ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼                        │
│  ┌─────────────────────────────────────────┐                    │
│  │         Projection (Read Model)          │                    │
│  │         새 버전으로 완전 재구축 가능     │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
│  새 Projection v2 필요 → e1부터 e8까지 Replay → 완료           │
│  이것이 "설계된 백필(Backfill by Design)"이다.                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5 Schema Evolution 연구

스키마 진화(Schema Evolution)는 백필과 직접적으로 연결된 연구 분야이다. 주요 전략:

| 전략 | 설명 | 백필 관계 |
|------|------|----------|
| **Eager Migration** | 스키마 변경 시 모든 데이터 즉시 변환 | Full Backfill과 동일 |
| **Lazy Migration** | 데이터 접근 시점에 변환 | Lazy Backfill과 동일 |
| **Shadow Column** | 새 컬럼을 기존 테이블에 추가, 점진적 채우기 | Incremental Backfill |
| **Self-Adapting** | 애플리케이션이 여러 스키마 버전 동시 처리 | 백필 불필요 (비용 전가) |

특히 NoSQL(MongoDB, DynamoDB 등) 환경에서는 schemaless 특성 때문에 Schema Evolution 연구가 활발하며, "읽기 시점 변환(read-time migration)"과 같은 Lazy 전략이 주류를 이룬다.

### 5.6 Data Governance에서의 위치

ACM의 데이터 거버넌스 5대 영역 중 **Data Quality**(정확성, 완전성)와 **Data Lifecycle**(생성/변환/폐기)의 교차점에 백필이 위치한다. 규정 준수(GDPR, SOX 등)를 위한 과거 데이터 정비도 백필의 중요한 사용 사례이다.

---

## 6. 백필 전략 비교

### 6.1 10가지 전략 상세

#### (1) Full Backfill (전체 백필)

```
모든 과거 데이터를 한 번에 처리. 가장 단순하지만 가장 무겁다.

[Before]                        [After]
┌──────────────────┐            ┌──────────────────┐
│ id │ name │ hash │            │ id │ name │ hash │
│  1 │ Kim  │ NULL │   ──────►  │  1 │ Kim  │ a1b2 │
│  2 │ Lee  │ NULL │            │  2 │ Lee  │ c3d4 │
│  3 │ Park │ NULL │            │  3 │ Park │ e5f6 │
│  : │  :   │  :   │            │  : │  :   │  :   │
│ 1M │ Choi │ NULL │            │ 1M │ Choi │ g7h8 │
└──────────────────┘            └──────────────────┘

장점: 단순, 완전한 일관성, 완료 시점 명확
단점: 다운타임 필요, 대규모 리소스 소모, 롤백 어려움
적합: 수천 건 이하, 다운타임 허용 가능한 환경
```

#### (2) Incremental Backfill (증분 백필)

```
배치(chunk) 단위로 나누어 점진적으로 처리.

Processing: [=====>                    ] 25% (250K/1M)
Batch #251: rows 250,001 ~ 251,000
Next batch in 2 seconds... (throttling)

장점: 서비스 영향 최소화, 중간 실패 시 이어서 처리 가능
단점: 처리 도중 데이터 불일치 구간 존재, 완료까지 시간 소요
적합: 수십만~수백만 건, 무중단 운영 필요 시
```

#### (3) Lazy Backfill (지연 백필)

```
데이터 접근(read) 시점에 변환. "필요할 때만 처리"의 원칙.

GET /users/42 → hash가 NULL이면 → 실시간 계산 → 저장 → 반환

장점: 즉시 배포 가능, 인프라 부하 없음, 자연스러운 우선순위
단점: 접근되지 않는 데이터는 영원히 미변환, 완료 시점 불명확
적합: 소규모, 접근 빈도가 높은 데이터, 빠른 배포 필요 시
```

#### (4) Dual Write (이중 쓰기)

```
전환 기간 동안 구/신 시스템 모두에 쓰기. 이후 구 시스템 데이터를 신 시스템으로 백필.

Write Request ──┬──► Old System (기존)
                └──► New System (신규) + Backfill old data

장점: 무중단 전환, 점진적 이전 가능
단점: 일관성 보장 어려움 (둘 중 하나 실패 시), 구현 복잡
적합: 시스템 간 전환 시, 짧은 전환 기간
```

#### (5) CDC 기반 (Change Data Capture)

```
DB의 트랜잭션 로그를 실시간으로 캡처하여 새 시스템으로 스트리밍.

[Source DB] ──WAL/Binlog──► [Debezium] ──► [Kafka] ──► [Target]

초기 스냅샷(Initial Snapshot) + 이후 증분 변경(CDC Stream)을 조합하여
과거 데이터(백필)와 실시간 동기화를 동시에 달성.

장점: 비침습적, 실시간, 과거+미래 동시 처리
단점: 인프라 복잡, DB 종속적, 초기 스냅샷에 시간 소요
적합: 대규모 데이터, 지속적 동기화 필요 시
```

#### (6) Event Sourcing Replay

```
Event Store의 과거 이벤트를 처음부터 재생하여 새 Read Model 구축.

Event Store: [e1, e2, e3, ..., eN]
                │
                ▼  Replay from e1
New Projection: [결과 = 최신 상태]

장점: 완전한 일관성, 아키텍처에 내장된 백필, 롤백 용이
단점: Event Store 필수, 이벤트 누적이 클 경우 시간 소요
적합: Event Sourcing 아키텍처를 이미 사용 중인 시스템
```

#### (7) Shadow Traffic (섀도 트래픽)

```
실제 트래픽을 복제하여 새 시스템으로 보내고, 결과를 비교.
쓰기는 구 시스템만, 읽기 결과를 비교하여 정합성 검증.

Real Traffic ──► Old System ──► Response to Client
     │
     └── (copy) ──► New System ──► Compare (결과 비교만, 응답 안 함)

장점: 롤백 위험 제로, 실제 트래픽으로 검증, 성능 프로파일링
단점: 인프라 비용 2배, 쓰기 검증 불가, 완전한 백필이 아님
적합: 마이그레이션 전 검증 단계, 리스크 최소화 필요 시
```

#### (8) Strangler Fig (교살자 무화과)

```
Martin Fowler의 Strangler Fig Pattern. 레거시 시스템을 점진적으로 교체.

Phase 1: [Legacy] ◄── 100% traffic
Phase 2: [Legacy] ◄── 80%  │  [New] ◄── 20% (일부 도메인)
Phase 3: [Legacy] ◄── 20%  │  [New] ◄── 80%
Phase 4:                       [New] ◄── 100%

각 단계에서 해당 도메인의 과거 데이터를 새 시스템으로 백필.

장점: 최소 리스크, 점진적 전환, 도메인별 독립 진행
단점: 장기간 두 시스템 유지 비용, 완료 시점 불명확
적합: 대규모 모놀리스 → 마이크로서비스 전환
```

#### (9) Blue-Green Migration

```
두 개의 동일한 환경을 준비하고, 데이터 백필 완료 후 트래픽 전환.

[Blue - 현재 운영]  ◄── Traffic
[Green - 백필 진행 중]

백필 완료 후:
[Blue - 대기]
[Green - 운영 시작]  ◄── Traffic (switch)

장점: 즉시 롤백 가능, 실질적 무중단, 검증 후 전환
단점: 인프라 비용 최고 (2배), 전환 시점 데이터 동기화 필요
적합: 높은 가용성 요구, 충분한 인프라 예산
```

#### (10) Feature Flag + Read-through

```
6단계로 점진적 전환. 각 단계에서 Feature Flag로 트래픽 비율 제어.

Stage 1: [Flag OFF]     → 구 시스템만 사용
Stage 2: [Dual Write]   → 구/신 모두 쓰기
Stage 3: [Shadow Read]  → 신 시스템 읽기 결과 비교
Stage 4: [Live Read]    → 신 시스템에서 읽기
Stage 5: [Old Write Off]→ 구 시스템 쓰기 중단
Stage 6: [Complete]     → 구 시스템 제거

장점: 최고의 롤백 용이성, 단계별 검증, 리스크 최소
단점: 구현 복잡도 중간, 장기간 소요
적합: 범용적, 대부분의 마이그레이션에 권장
```

### 6.2 전략별 특성 비교표

| 전략 | 다운타임 | 데이터 일관성 | 롤백 용이성 | 구현 복잡도 | 인프라 비용 | 완료 시점 |
|------|---------|-------------|-----------|-----------|-----------|----------|
| Full Backfill | **필요** | 완전 | 낮음 | **낮음** | **낮음** | **명확** |
| Incremental | 불필요 | 부분적 | 중간 | 중간 | 낮음 | 중간 |
| Lazy | 불필요 | 접근 후 즉시 | 높음 | 낮음~중간 | **최저** | **불명확** |
| Dual Write | 불필요 | Best-effort | 중간 | **높음** | 중간 | 중간 |
| CDC 기반 | 불필요 | Eventual | 높음 | 중간~높음 | 높음 | 명확 |
| Event Replay | 불필요 | **완전** | **최고** | 높음 | 중간 | 명확 |
| Shadow Traffic | 불필요 | N/A(검증용) | **최고** | 중간 | **최고** | N/A |
| Strangler Fig | 불필요 | 도메인 단위 | **최고** | 높음 | 높음 | 불명확 |
| Blue-Green | 실질 없음 | 전환 기준 | 높음 | 중간~높음 | **최고** | 명확 |
| Feature Flag | 불필요 | 단계별 검증 | **최고** | 중간 | 중간 | 중간 |

### 6.3 상황별 최적 선택

#### 데이터 규모별

| 규모 | 추천 전략 | 이유 |
|------|----------|------|
| **수천 건 이하** | Full Backfill | 복잡한 전략 불필요, 단순이 최선 |
| **수십만~수백만 건** | Incremental + Dual Write | 서비스 영향 최소화하면서 처리 가능 |
| **수천만~수억 건** | CDC + Incremental | 스트리밍 기반 처리, Stripe 스타일 |
| **수십억 건+** | CDC + Strangler Fig or Feature Flag | 도메인별 분리, 장기 전환 프로젝트 |

#### 다운타임 허용 여부별

| 다운타임 | 추천 전략 | 비고 |
|---------|----------|------|
| **허용 (수 시간)** | Full Backfill | 가장 단순하고 확실 |
| **제한적 (수 분)** | Blue-Green + CDC | 전환 순간만 짧은 지연 |
| **완전 불가 (0초)** | Dual Write + Incremental 또는 CDC + Feature Flag | 복잡하지만 무중단 보장 |

#### 실시간성 요구별

| 요구 수준 | 추천 전략 |
|----------|----------|
| **배치 허용** | Full or Incremental Backfill |
| **준실시간 (분 단위)** | CDC 기반 |
| **실시간 (초 단위)** | CDC + Feature Flag or Event Replay |

#### 팀 규모별

| 팀 규모 | 추천 전략 | 이유 |
|---------|----------|------|
| **소규모 (1~5명)** | Full or Lazy Backfill | 인프라 운영 부담 최소화 |
| **중간 (5~20명)** | Incremental + Feature Flag | 적절한 복잡도와 안전성 |
| **대규모 (20+명)** | CDC + Strangler Fig + Shadow Traffic | 도메인별 병렬 진행, 충분한 인력 |

#### 리스크 허용별

| 리스크 허용 | 추천 전략 |
|------------|----------|
| **높음** (스타트업, 초기 서비스) | Full Backfill, Dual Write |
| **중간** (성장기 서비스) | Incremental + Feature Flag |
| **낮음** (금융, 의료, 대규모 서비스) | CDC + Shadow Traffic + Blue-Green |

### 6.4 의사결정 플로우차트

```
┌─────────────────────────────────────────────────────────────────┐
│              백필 전략 의사결정 플로우차트                       │
│                                                                 │
│  START                                                          │
│    │                                                             │
│    ▼                                                             │
│  데이터 수천 건 이하?                                           │
│    ├── YES ──► 다운타임 가능? ──YES──► Full Backfill            │
│    │                         └─NO───► Lazy Backfill             │
│    │                                                             │
│    └── NO                                                       │
│         │                                                       │
│         ▼                                                       │
│       다운타임 허용?                                            │
│         ├── YES ──► Full Backfill (야간 점검 윈도우)            │
│         │                                                       │
│         └── NO                                                  │
│              │                                                  │
│              ▼                                                  │
│            Event Store 존재?                                    │
│              ├── YES ──► Event Sourcing Replay                  │
│              │                                                  │
│              └── NO                                             │
│                   │                                             │
│                   ▼                                             │
│                 CDC 인프라 가능? (Debezium/Kafka 등)             │
│                   ├── YES ──► CDC + Incremental                 │
│                   │                                             │
│                   └── NO                                        │
│                        │                                        │
│                        ▼                                        │
│                      강한 일관성 필수?                           │
│                        ├── YES ──► Single TX Dual Write         │
│                        │            (소규모만 가능)              │
│                        │                                        │
│                        └── NO                                   │
│                             │                                   │
│                             ▼                                   │
│                           모놀리스 → 마이크로서비스 전환?       │
│                             ├── YES ──► Strangler Fig           │
│                             │                                   │
│                             └── NO                              │
│                                  │                              │
│                                  ▼                              │
│                                빠른 롤백 최우선?                │
│                                  ├── YES ──► Feature Flag 6단계 │
│                                  │                              │
│                                  └── NO ──► Incremental Backfill│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 설계 원칙과 베스트 프랙티스

### 7.1 5대 설계 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│              백필 시스템의 5대 설계 원칙                         │
│                                                                 │
│  1. Idempotency (멱등성)                                       │
│     "같은 작업을 N번 실행해도 결과가 동일해야 한다"             │
│     → UPSERT, 파티션 덮어쓰기                                  │
│                                                                 │
│  2. Resumability (재개 가능성)                                  │
│     "중간에 실패해도 처음부터 다시 시작하지 않는다"             │
│     → Checkpoint, Cursor 기반 페이징                           │
│                                                                 │
│  3. Observability (관측 가능성)                                 │
│     "지금 어디까지 처리했고, 초당 몇 건이며, 에러는 몇 건인가" │
│     → rows/sec, error rate, progress %, ETA                    │
│                                                                 │
│  4. Throttling (속도 제어)                                     │
│     "운영 DB에 과도한 부하를 주지 않는다"                      │
│     → 배치 간 sleep, 시간당 처리량 제한, circuit breaker       │
│                                                                 │
│  5. Validation (검증)                                          │
│     "백필 결과가 정확한지 사전/사후에 검증한다"                 │
│     → pre-validation (스키마, 참조 무결성)                      │
│     → post-validation (row count, checksum, 샘플 비교)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 구현 패턴

#### (1) Idempotent UPSERT

```sql
-- PostgreSQL: ON CONFLICT DO UPDATE (멱등성 보장)
INSERT INTO users (id, name, phone_hash, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (id) DO UPDATE SET
    phone_hash = EXCLUDED.phone_hash,
    updated_at = EXCLUDED.updated_at
WHERE users.phone_hash IS DISTINCT FROM EXCLUDED.phone_hash;

-- MySQL: INSERT ... ON DUPLICATE KEY UPDATE
INSERT INTO users (id, name, phone_hash, updated_at)
VALUES (?, ?, ?, NOW())
ON DUPLICATE KEY UPDATE
    phone_hash = VALUES(phone_hash),
    updated_at = VALUES(updated_at);
```

```python
# Python 예시: 배치 UPSERT
def backfill_batch(db, batch: list[dict]):
    """멱등성이 보장되는 배치 UPSERT.
    같은 batch를 여러 번 실행해도 결과 동일."""
    query = """
        INSERT INTO users (id, phone_hash, updated_at)
        VALUES (:id, :phone_hash, NOW())
        ON CONFLICT (id) DO UPDATE SET
            phone_hash = EXCLUDED.phone_hash,
            updated_at = EXCLUDED.updated_at
        WHERE users.phone_hash IS DISTINCT FROM EXCLUDED.phone_hash
    """
    db.execute_many(query, batch)
```

#### (2) Cursor vs Offset 페이징

```sql
-- BAD: Offset 기반 (느려짐 - O(N) 스킵)
SELECT * FROM users
ORDER BY id
LIMIT 1000 OFFSET 500000;  -- 50만 건을 스킵해야 함 → 느림

-- GOOD: Cursor 기반 (일정한 성능 - O(1) 탐색)
SELECT * FROM users
WHERE id > :last_processed_id  -- 인덱스를 타므로 항상 빠름
ORDER BY id
LIMIT 1000;
```

**성능 비교**:

| 방식 | 1번째 배치 | 100번째 배치 | 1000번째 배치 | 비고 |
|------|-----------|-------------|-------------|------|
| Offset | 10ms | 500ms | 5,000ms | 점점 느려짐 |
| Cursor | 10ms | 10ms | 10ms | **일정한 성능** |

Cursor 기반이 Offset 대비 **최대 17배** 빠르다 (대규모 테이블 기준).

#### (3) Checkpoint (재개 가능성)

```python
import json
from pathlib import Path

CHECKPOINT_FILE = "backfill_checkpoint.json"

def load_checkpoint() -> dict:
    """마지막 처리 위치를 로드."""
    if Path(CHECKPOINT_FILE).exists():
        return json.loads(Path(CHECKPOINT_FILE).read_text())
    return {"last_id": 0, "processed": 0, "errors": 0}

def save_checkpoint(state: dict):
    """현재 처리 위치를 저장. 실패 시 이 지점부터 재개."""
    Path(CHECKPOINT_FILE).write_text(json.dumps(state))

def run_backfill(db, batch_size=1000):
    state = load_checkpoint()
    last_id = state["last_id"]

    while True:
        rows = db.fetch(
            "SELECT * FROM users WHERE id > :last_id ORDER BY id LIMIT :limit",
            {"last_id": last_id, "limit": batch_size}
        )
        if not rows:
            break  # 완료

        try:
            backfill_batch(db, transform(rows))
            last_id = rows[-1]["id"]
            state["last_id"] = last_id
            state["processed"] += len(rows)
            save_checkpoint(state)  # 매 배치 후 체크포인트 저장
        except Exception as e:
            state["errors"] += 1
            save_checkpoint(state)
            raise  # 재시작 시 last_id부터 이어서 처리

    print(f"Backfill complete: {state['processed']} rows, {state['errors']} errors")
```

#### (4) Throttling (속도 제어)

```python
import time

def run_backfill_with_throttle(
    db,
    batch_size: int = 1000,
    sleep_between_batches: float = 0.5,  # 배치 간 500ms 대기
    max_rows_per_hour: int = 1_000_000,  # 시간당 최대 처리량
):
    """운영 DB에 과도한 부하를 주지 않는 throttled backfill."""
    state = load_checkpoint()
    last_id = state["last_id"]
    hour_start = time.time()
    hour_count = 0

    while True:
        # 시간당 처리량 제한 체크
        if hour_count >= max_rows_per_hour:
            elapsed = time.time() - hour_start
            if elapsed < 3600:
                wait = 3600 - elapsed
                print(f"Rate limit reached. Sleeping {wait:.0f}s...")
                time.sleep(wait)
            hour_start = time.time()
            hour_count = 0

        rows = db.fetch(
            "SELECT * FROM users WHERE id > :last_id ORDER BY id LIMIT :limit",
            {"last_id": last_id, "limit": batch_size}
        )
        if not rows:
            break

        backfill_batch(db, transform(rows))
        last_id = rows[-1]["id"]
        hour_count += len(rows)

        state["last_id"] = last_id
        state["processed"] += len(rows)
        save_checkpoint(state)

        # 배치 간 sleep으로 DB 부하 분산
        time.sleep(sleep_between_batches)
```

#### (5) DLQ (Dead Letter Queue) 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              DLQ (Dead Letter Queue) 패턴                       │
│                                                                 │
│  처리 실패 row를 별도 큐로 분리하여 전체 진행을 막지 않음       │
│                                                                 │
│  Main Queue                                                     │
│  ┌────┬────┬────┬────┬────┐                                    │
│  │ r1 │ r2 │ r3 │ r4 │ r5 │                                    │
│  └──┬─┴──┬─┴──┬─┴──┬─┴──┬─┘                                    │
│     │    │    │    │    │                                        │
│     ▼    ▼    ▼    ▼    ▼                                       │
│    OK   OK  FAIL  OK   OK                                       │
│               │                                                 │
│               ▼                                                 │
│  retry_1 ──FAIL──► retry_2 ──FAIL──► retry_3 ──FAIL──► DLQ    │
│  (1분후)           (5분후)           (30분후)          (수동처리)│
│                                                                 │
│  Uber Kafka 방식: 재시도 횟수별 별도 토픽으로 분리              │
│  backfill.retry-1 → backfill.retry-2 → backfill.dead-letter    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```python
from dataclasses import dataclass
from enum import Enum

class RetryLevel(Enum):
    RETRY_1 = (1, 60)      # 1번째 재시도, 60초 후
    RETRY_2 = (2, 300)     # 2번째 재시도, 300초 후
    RETRY_3 = (3, 1800)    # 3번째 재시도, 1800초 후
    DEAD_LETTER = (4, -1)  # 재시도 포기, 수동 처리

@dataclass
class FailedRecord:
    row_id: int
    error: str
    retry_level: RetryLevel
    next_retry_at: float

def handle_failure(row_id: int, error: Exception, dlq: list):
    """실패한 레코드를 DLQ로 보내고 전체 진행은 계속."""
    record = FailedRecord(
        row_id=row_id,
        error=str(error),
        retry_level=RetryLevel.RETRY_1,
        next_retry_at=time.time() + 60
    )
    dlq.append(record)
    # 전체 백필은 계속 진행
```

#### (6) Shadow Table 패턴

Online Schema Change 도구들이 사용하는 패턴이다. 원본 테이블을 잠그지 않고 새 스키마의 Shadow Table을 생성, 데이터를 복사, 완료 후 원자적으로 교체한다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Shadow Table 패턴 (gh-ost 방식)                    │
│                                                                 │
│  Phase 1: Shadow Table 생성                                     │
│  ┌─────────────┐          ┌───────────────────┐                │
│  │ users (원본) │          │ _users_gho (shadow)│                │
│  │ - id         │  CREATE  │ - id               │                │
│  │ - name       │ ──────►  │ - name             │                │
│  │ - email      │   AS     │ - email            │                │
│  └─────────────┘          │ - phone_hash (NEW) │                │
│                           └───────────────────┘                │
│                                                                 │
│  Phase 2: 데이터 복사 + 실시간 Binlog 적용                     │
│  ┌─────────────┐  batch   ┌───────────────────┐                │
│  │ users (원본) │ ──copy──►│ _users_gho (shadow)│                │
│  │             │          │                   │                │
│  │  (live DML) │ ──binlog─►│  (replay changes) │                │
│  └─────────────┘          └───────────────────┘                │
│                                                                 │
│  Phase 3: 원자적 교체 (RENAME TABLE)                            │
│  RENAME TABLE users TO _users_old, _users_gho TO users;        │
│  (수 밀리초 소요)                                               │
│                                                                 │
│  gh-ost: Binlog 기반 (Trigger 없음) → 성능 영향 최소           │
│  pt-osc: Trigger 기반 → 더 넓은 호환성                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### (7) Feature Flag 점진적 전환 (6단계)

```
┌─────────────────────────────────────────────────────────────────┐
│              Feature Flag 6단계 점진적 전환                     │
│                                                                 │
│  Stage 1: OFF                                                   │
│  └── 구 시스템만 사용. 신 시스템 준비 중.                      │
│                                                                 │
│  Stage 2: DUAL_WRITE                                           │
│  └── 모든 쓰기를 구/신 모두에. 과거 데이터 백필 병행.         │
│                                                                 │
│  Stage 3: SHADOW_READ                                          │
│  └── 신 시스템에서도 읽기. 구 시스템 결과와 비교 (diff log).   │
│                                                                 │
│  Stage 4: LIVE_READ                                            │
│  └── 신 시스템에서 읽기를 서빙. 구 시스템은 쓰기만.           │
│                                                                 │
│  Stage 5: OLD_WRITE_OFF                                        │
│  └── 구 시스템 쓰기 중단. 신 시스템이 주 시스템.              │
│                                                                 │
│  Stage 6: COMPLETE                                             │
│  └── 구 시스템 완전 제거. Feature Flag 제거. Cleanup.          │
│                                                                 │
│  각 단계 사이: 모니터링 → 검증 → 롤백 준비 확인 → 다음 단계   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### (8) Expand -> Migrate -> Contract 패턴

Martin Fowler의 "Parallel Change" 패턴으로, 스키마 변경과 백필을 안전하게 수행하는 3단계 프로세스이다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Expand → Migrate → Contract                        │
│                                                                 │
│  Phase 1: EXPAND (확장)                                        │
│  ┌──────────────────────────┐                                  │
│  │ users                     │                                  │
│  │ - id                      │                                  │
│  │ - name                    │                                  │
│  │ - email                   │  ADD COLUMN (nullable)           │
│  │ - phone_hash (NEW, NULL OK)│ ◄── 새 컬럼 추가, 기존 코드 영향 없음│
│  └──────────────────────────┘                                  │
│  → 애플리케이션은 기존 코드 그대로 동작                        │
│  → 새 코드는 phone_hash가 있으면 사용, 없으면 fallback        │
│                                                                 │
│  Phase 2: MIGRATE (마이그레이션 = 백필)                        │
│  ┌──────────────────────────┐                                  │
│  │ 과거 데이터에 phone_hash   │                                  │
│  │ 값을 채우는 백필 실행      │                                  │
│  │ (Incremental + Checkpoint)│                                  │
│  └──────────────────────────┘                                  │
│  → 서비스 무중단으로 점진적 백필                                │
│  → 100% 완료 확인 후 다음 단계                                 │
│                                                                 │
│  Phase 3: CONTRACT (축소)                                      │
│  ┌──────────────────────────┐                                  │
│  │ - NOT NULL 제약조건 추가   │                                  │
│  │ - Fallback 코드 제거       │                                  │
│  │ - 불필요한 컬럼/테이블 정리│                                  │
│  └──────────────────────────┘                                  │
│  → 구 코드 경로 완전 제거                                      │
│  → 깨끗한 최종 상태                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### (9) Batch Size 결정 가이드

| 상황 | 추천 Batch Size | 이유 |
|------|----------------|------|
| 일반 OLTP (복잡한 변환 포함) | 100 ~ 1,000 | 트랜잭션 크기 제한, Lock 최소화 |
| 단순 UPDATE (변환 없음) | 1,000 ~ 10,000 | I/O 효율, 커밋 오버헤드 감소 |
| Bulk INSERT (새 테이블) | 10,000 ~ 100,000 | 쓰기 최적화, 인덱스 배치 갱신 |
| DW/분석용 적재 | 100,000+ | 파티션 단위 적재, 높은 처리량 |

**튜닝 원칙**: 작게 시작하여 모니터링하면서 점진적으로 늘린다. DB 복제 지연(replication lag)이 증가하면 즉시 줄인다.

#### (10) Rate Limiting 패턴

```python
# Circuit Breaker + Adaptive Throttling
class AdaptiveThrottle:
    """DB 부하에 따라 자동으로 속도를 조절하는 throttle."""

    def __init__(self, db, max_replication_lag_seconds=5):
        self.db = db
        self.max_lag = max_replication_lag_seconds
        self.sleep_time = 0.1  # 초기값 100ms

    def wait(self):
        lag = self.db.get_replication_lag()
        if lag > self.max_lag:
            # 복제 지연이 크면 대기 시간 증가
            self.sleep_time = min(self.sleep_time * 2, 60)
            print(f"Replication lag {lag}s > {self.max_lag}s. "
                  f"Backing off: {self.sleep_time}s")
        elif lag < self.max_lag / 2:
            # 복제 지연이 작으면 대기 시간 감소
            self.sleep_time = max(self.sleep_time * 0.5, 0.05)
        time.sleep(self.sleep_time)
```

---

## 8. 안티패턴과 함정

### 9가지 주요 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              9가지 백필 안티패턴                                 │
│                                                                 │
│  1. Lock Contention 유발 대규모 UPDATE                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  UPDATE users SET hash = compute(phone)            │   │
│  │       WHERE hash IS NULL;  -- 100만 건 한 번에 UPDATE!  │   │
│  │                                                          │   │
│  │ → 테이블 전체 Lock → 서비스 장애                        │   │
│  │                                                          │   │
│  │ GOOD: 배치 단위로 나누어 처리                            │   │
│  │       UPDATE users SET hash = compute(phone)             │   │
│  │       WHERE id BETWEEN :start AND :end;                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  2. 인덱스 없는 WHERE 절 (Full Table Scan)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  SELECT * FROM orders WHERE created_at > '2025-01' │   │
│  │       -- created_at에 인덱스 없으면 Full Table Scan!    │   │
│  │                                                          │   │
│  │ GOOD: 백필 시작 전 필요한 인덱스 확인/생성               │   │
│  │       CREATE INDEX CONCURRENTLY idx_created_at           │   │
│  │       ON orders (created_at);                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  3. 트랜잭션을 너무 크게 잡음                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  BEGIN;                                             │   │
│  │       -- 100만 건 처리                                   │   │
│  │       COMMIT;  -- WAL/undo log 폭발, OOM 위험           │   │
│  │                                                          │   │
│  │ GOOD: 배치 단위 트랜잭션 (1,000건씩 COMMIT)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  4. 백필 도중 스키마 변경 동시 수행                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  백필 진행 중 + ALTER TABLE (컬럼 추가/삭제)       │   │
│  │       → 백필 스크립트 실패, 데이터 불일치               │   │
│  │                                                          │   │
│  │ GOOD: Expand-Migrate-Contract 순서 엄수                  │   │
│  │       스키마 변경 완료 → 백필 → 제약조건 추가            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  5. Timezone 처리 실수                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  레거시 데이터가 KST인데 UTC로 간주하고 변환       │   │
│  │       → 9시간 차이 발생, 날짜 경계 오류                 │   │
│  │                                                          │   │
│  │ GOOD: 원본 timezone 확인 후 명시적 변환                  │   │
│  │       AT TIME ZONE 'Asia/Seoul' → AT TIME ZONE 'UTC'    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  6. NULL vs Default 혼동                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  NULL = "값 없음" vs DEFAULT = "기본값" 구분 실패  │   │
│  │       → 백필 대상인 NULL row와 의도적 NULL row 혼동     │   │
│  │                                                          │   │
│  │ GOOD: 별도 플래그 컬럼 (is_backfilled) 또는             │   │
│  │       sentinel value 사용                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  7. 순환 참조 순서 무시                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  A → B → C → A 순환 참조가 있는데 순서 무시       │   │
│  │       → FK 위반, 데이터 정합성 깨짐                     │   │
│  │                                                          │   │
│  │ GOOD: 의존성 그래프(DAG) 분석 후 순서 결정               │   │
│  │       순환 참조는 FK 임시 비활성화 또는 2-pass 처리     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  8. Cleanup 안 함                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  백필 완료 후 임시 테이블, 인덱스, Feature Flag    │   │
│  │       스크립트, Dual Write 코드 방치                     │   │
│  │       → 기술 부채 누적, 다음 마이그레이션 시 혼란       │   │
│  │                                                          │   │
│  │ GOOD: 완료 후 Cleanup 체크리스트 실행                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  9. 롤백 계획 없이 시작                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BAD:  "잘 되겠지"로 시작 → 중간에 문제 발생 → 패닉     │   │
│  │                                                          │   │
│  │ GOOD: 시작 전 롤백 계획 문서화                           │   │
│  │       - 원본 데이터 백업 확인                            │   │
│  │       - 롤백 스크립트 준비 및 테스트                     │   │
│  │       - 롤백 소요 시간 추정                              │   │
│  │       - 롤백 의사결정 기준(trigger) 정의                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 빅테크 실전 사례

### 9.1 Stripe: DocDB, 4-Phase Online Migration

**규모**: 수억 건 Subscription 데이터, 1.5PB, 99.999% uptime

Stripe는 2015년 블로그에서 **4-Phase Online Migration** 패턴을 공개했다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Stripe 4-Phase Online Migration                    │
│                                                                 │
│  Phase 1: Dual Write                                           │
│  └── 새 코드 경로에서 신/구 모두에 쓰기                       │
│                                                                 │
│  Phase 2: Backfill Old Data                                    │
│  └── 과거 데이터를 새 형식으로 변환 (Hadoop/MapReduce 활용)    │
│                                                                 │
│  Phase 3: Verify                                               │
│  └── 구/신 데이터 비교 검증 (row-by-row)                      │
│                                                                 │
│  Phase 4: Switch & Cleanup                                     │
│  └── 구 시스템 경로 제거, Feature Flag off                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

2023년에는 **DocDB Data Movement Platform**을 공개했다. 1.5PB 데이터를 99.999% uptime으로 무중단 이전했으며, **Version Token Gating**으로 2초 이내에 트래픽 전환이 가능했다.

### 9.2 Netflix: Data Gateway, Cassandra

**규모**: 250개 Cassandra 클러스터, Cassandra 2 → 3 마이그레이션 (1.5년 소요)

Netflix는 **Data Gateway** 패턴을 사용한다. 애플리케이션과 데이터 저장소 사이에 추상화 계층을 두어, 저장소 변경이 애플리케이션에 투명하게 이루어진다.

핵심 전략: **Shadow Traffic Architecture** - 실제 트래픽을 신 시스템에 복제하여 결과를 비교하되, 응답은 구 시스템에서만 서빙. 충분한 검증 후 전환.

### 9.3 Uber: DynamoDB -> DocStore (250억 건)

**규모**: 250억 건, 300TB, 연간 $6M 비용 절감, 수 주 완료

```
┌─────────────────────────────────────────────────────────────────┐
│              Uber DynamoDB → DocStore 마이그레이션               │
│                                                                 │
│  Before: Amazon DynamoDB (250억 건, 300TB)                     │
│  After:  DocStore (Uber 내부 분산 DB)                          │
│  절감:   연 $6,000,000                                         │
│                                                                 │
│  전략:                                                          │
│  1. DocStore 준비 및 스키마 매핑                                │
│  2. Dual Write 시작                                            │
│  3. 과거 250억 건 오프라인 백필                                │
│  4. 다층 검증 (row count, checksum, sample comparison)         │
│  5. Traffic Switch (수 초 이내)                                │
│  6. DynamoDB 제거                                              │
│                                                                 │
│  기간: 수 주 (자동화된 파이프라인 덕분)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Project Mezzanine** (2014): Uber 초기에 PostgreSQL → Schemaless(자체 NoSQL)로 전환한 대규모 마이그레이션 프로젝트.

Uber는 또한 Kafka 기반 **Reliable Reprocessing** 패턴을 공개했다. 실패한 메시지를 retry 토픽으로 분리하여 처리하는 DLQ 패턴의 참조 구현이다.

### 9.4 Airbnb: Nebula, Minerva, Riverbed

**Nebula**: 검색 인덱스 시스템. 검색 백엔드 데이터를 주기적으로 백필하여 인덱스를 최신 상태로 유지.

**Minerva**: 메트릭 일관성 플랫폼. 12,000개 이상의 메트릭을 단일 정의로 관리하며, 정의 변경 시 과거 메트릭을 자동 재계산(백필).

**Riverbed**: 일 24억 이벤트를 처리하는 이벤트 파이프라인.

그리고 무엇보다 **Apache Airflow의 발상지**이다. Airflow는 `backfill`을 CLI 명령의 일급 기능으로 만들어 업계 전체의 백필 개념 정립에 기여했다.

```bash
# Airflow backfill 명령 예시
airflow dags backfill \
    --start-date 2025-01-01 \
    --end-date 2025-03-01 \
    my_dag_id
```

### 9.5 LinkedIn: Espresso, 5-Layer 검증

**규모**: 엔터프라이즈급 데이터, 99.999%+ 일관성 달성

LinkedIn은 Recruiter/Jobs의 대규모 마이그레이션에서 **5-Layer 검증** 프레임워크를 적용했다:

| Layer | 검증 내용 | 방법 |
|-------|----------|------|
| 1 | Row Count 일치 | 소스/타겟 건수 비교 |
| 2 | Schema 호환성 | 필드 타입/nullable 검증 |
| 3 | Data Integrity | Checksum 비교 |
| 4 | Referential Integrity | FK 관계 검증 |
| 5 | Business Logic | 도메인 규칙 검증 (예: 금액 합계) |

**Brooklin**: LinkedIn의 오픈소스 CDC/스트리밍 플랫폼. Self-Healing 기능으로 장애 시 자동 복구, 부트스트랩(초기 스냅샷) 내장.

### 9.6 Meta (Facebook): Messenger HBase -> MyRocks

**규모**: 수 PB, 스토리지 90% 절감, 읽기 I/O 50x 감소

```
┌─────────────────────────────────────────────────────────────────┐
│              Meta Messenger 스토리지 마이그레이션                │
│                                                                 │
│  Before: HBase (수 PB)                                         │
│  After:  MyRocks (MySQL + RocksDB)                             │
│                                                                 │
│  결과:                                                          │
│  ├── 스토리지 사용량 90% 절감                                  │
│  ├── 읽기 I/O 50배 감소                                        │
│  └── 운영 복잡도 대폭 감소                                     │
│                                                                 │
│  핵심: 오프라인 백필로 과거 메시지 전체 이전                   │
│  Messenger 특성상 데이터 손실 = 사용자 메시지 유실             │
│  → 극도로 엄격한 검증 프로세스 적용                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Facebook OSC (Online Schema Change)**: Python으로 재작성된 온라인 스키마 변경 도구. MyRocks 지원.

### 9.7 Twitter/X: Manhattan, Snowflake ID

**Manhattan**: Twitter의 실시간 멀티테넌트 분산 DB. 여러 스토리지 백엔드(SSD, HDFS 등) 간 데이터 이동을 내장 기능으로 지원.

**Snowflake ID** (2010): Twitter가 분산 환경에서 고유 ID 생성을 위해 만든 방식. 타임스탬프 + 워커 ID + 시퀀스로 구성된 64비트 ID. 백필 시 ID 충돌 방지와 시간 순서 보장에 핵심적인 역할을 한다. 이후 수많은 시스템의 ID 생성 표준이 되었다.

### 9.8 Shopify: Ghostferry, TLA+

**Ghostferry**: Go로 작성된 오픈소스 MySQL 데이터 마이그레이션 도구.

```
┌─────────────────────────────────────────────────────────────────┐
│              Shopify Ghostferry                                 │
│                                                                 │
│  특징:                                                          │
│  ├── Go 구현 (고성능, 동시성 우수)                             │
│  ├── TLA+ 형식 검증 (정합성 수학적 증명)                      │
│  ├── Batch Copy + Binlog Streaming 조합                        │
│  ├── 검증(Verification) 기능 내장                              │
│  └── Vitess 샤드 밸런싱에 활용                                 │
│                                                                 │
│  핵심 아키텍처:                                                 │
│  [Source DB] ──batch copy──► [Ghostferry] ──► [Target DB]      │
│       │                          ▲                              │
│       └────binlog stream─────────┘                              │
│                                                                 │
│  TLA+ 검증: 마이그레이션의 정확성을 형식적으로 증명            │
│  "데이터 손실 없음"을 수학적으로 보장                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Shopify는 테라바이트급 MySQL 샤드 밸런싱에 Ghostferry를 활용한다.

### 9.9 GitHub: MySQL 8.0, gh-ost

**규모**: 1,200 MySQL 호스트, 300TB+, 1년 이상 소요

```
┌─────────────────────────────────────────────────────────────────┐
│              GitHub MySQL 5.7 → 8.0 업그레이드                  │
│                                                                 │
│  규모:                                                          │
│  ├── 1,200+ MySQL 호스트                                       │
│  ├── 300TB+ 데이터                                             │
│  ├── 1년 이상의 프로젝트 기간                                  │
│  └── github.com 무중단 운영 유지                               │
│                                                                 │
│  전략: 점진적 Rolling Upgrade                                   │
│  ├── Replica 먼저 업그레이드 → 검증                            │
│  ├── Primary Failover를 통한 무중단 전환                       │
│  └── gh-ost로 필요한 스키마 변경 수행                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**gh-ost**: GitHub가 개발한 MySQL Online Schema Change 도구. Trigger 없이 Binlog만으로 동작하여 성능 영향 최소. 일시정지/재개, 동적 속도 제어 기능 내장.

### 9.10 Google: Spanner 스토리지 엔진 (6EB)

**규모**: 6 Exabytes, 2-3년 소요

Google Spanner의 내부 스토리지 엔진을 새로운 컬럼형(columnar) 엔진으로 교체한 프로젝트이다. 6EB라는 인류 역사상 가장 큰 규모의 데이터 마이그레이션 중 하나이며, Spanner의 강한 일관성(strong consistency)을 유지하면서 진행되었다.

### 9.11 도구 비교표

| 도구 | 개발사 | 방식 | 언어 | 핵심 특징 |
|------|--------|------|------|----------|
| **gh-ost** | GitHub | Binlog (Trigger 없음) | Go | 일시정지/재개, 동적 제어, 성능 영향 최소 |
| **pt-osc** | Percona | Trigger 기반 | Perl | 가장 성숙, 광범위 사용, 넓은 호환성 |
| **Facebook OSC** | Meta | Trigger 기반 | Python | MyRocks 지원, Facebook 규모 검증 |
| **Ghostferry** | Shopify | Batch + Binlog | Go | TLA+ 형식 검증, 고성능, 샤드 밸런싱 |
| **Brooklin** | LinkedIn | CDC 스트리밍 | Java | Self-Healing, 부트스트랩 내장, 오픈소스 |
| **Debezium** | Red Hat | Log 기반 CDC | Java | 가장 널리 사용되는 오픈소스 CDC |

### 9.12 공통 패턴과 핵심 교훈

**빅테크에서 반복되는 공통 패턴**:

```
┌─────────────────────────────────────────────────────────────────┐
│              빅테크 마이그레이션의 공통 패턴                     │
│                                                                 │
│  1. Dual Write → Validation → Traffic Switch                   │
│     (거의 모든 회사가 이 흐름을 따름)                          │
│                                                                 │
│  2. 오프라인 우선 백필                                          │
│     (과거 데이터는 별도 파이프라인으로 처리)                    │
│                                                                 │
│  3. 다층 검증 (Multi-Layer Validation)                          │
│     (row count → checksum → sample → business rule)            │
│                                                                 │
│  4. 수 초 이내 Traffic Switch                                   │
│     (Stripe 2초, Uber 수 초, LinkedIn 수 초)                   │
│                                                                 │
│  5. 자동화된 마이그레이션 인프라                                │
│     (Stripe DocDB Platform, Shopify Ghostferry 등)             │
│     "반복되는 작업은 플랫폼화한다"                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**핵심 교훈**:

| 교훈 | 설명 |
|------|------|
| **UUID를 처음부터** | Auto-increment ID는 마이그레이션 시 충돌 유발. UUID/Snowflake ID 권장 |
| **Idempotency 설계** | 모든 쓰기 연산은 멱등하게. UPSERT, 파티션 덮어쓰기 |
| **Self-Healing 자동화** | 장애 시 자동 복구. 사람이 개입하면 규모가 안 된다 |
| **State Machine 명확화** | 마이그레이션 상태를 명시적 상태 머신으로 관리 |
| **마이그레이션 인프라 표준화** | 매번 새로 만들지 말고, 재사용 가능한 플랫폼 구축 |
| **폭발 반경(Blast Radius) 축소** | Canary → 1% → 10% → 100% 점진적 확대 |

---

## 10. 체크리스트

### 10.1 Pre-Migration Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│              Pre-Migration Checklist (13항목)                   │
│                                                                 │
│  [ ] 1.  원본 데이터 백업 완료 및 복원 테스트                  │
│  [ ] 2.  대상 데이터 규모 측정 (row count, data size)          │
│  [ ] 3.  예상 소요 시간 계산 (test run 기반)                   │
│  [ ] 4.  롤백 계획 문서화 및 롤백 스크립트 테스트              │
│  [ ] 5.  롤백 의사결정 기준(trigger) 정의                      │
│  [ ] 6.  필요 인덱스 확인 및 생성                              │
│  [ ] 7.  Batch size 결정 (테스트 환경에서 벤치마크)            │
│  [ ] 8.  Throttling 파라미터 설정 (replication lag 기준)       │
│  [ ] 9.  모니터링 대시보드 구성 (progress, error rate, lag)    │
│  [ ] 10. Checkpoint 메커니즘 구현 및 테스트                    │
│  [ ] 11. DLQ/에러 핸들링 구현                                  │
│  [ ] 12. Staging 환경에서 전체 프로세스 리허설                  │
│  [ ] 13. 관련 팀(SRE, DBA, 도메인 팀) 사전 공유               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Post-Migration Validation Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│              Post-Migration Validation Checklist (10항목)       │
│                                                                 │
│  [ ] 1.  Row count 일치 확인 (소스 vs 타겟)                    │
│  [ ] 2.  Checksum/Hash 비교 (전체 또는 샘플)                   │
│  [ ] 3.  NULL 잔존 건수 확인 (backfill 대상 컬럼)              │
│  [ ] 4.  참조 무결성(FK) 검증                                  │
│  [ ] 5.  비즈니스 규칙 검증 (금액 합계, 상태 분포 등)          │
│  [ ] 6.  애플리케이션 기능 테스트 (주요 API endpoint)           │
│  [ ] 7.  성능 벤치마크 (백필 전후 쿼리 성능 비교)              │
│  [ ] 8.  복제 지연(replication lag) 정상 범위 확인              │
│  [ ] 9.  에러 로그/DLQ 잔존 건수 확인 및 처리                  │
│  [ ] 10. 모니터링 알림 정상 동작 확인                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Cleanup Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│              Cleanup Checklist                                  │
│                                                                 │
│  [ ] 1.  임시 테이블/Shadow Table 삭제                         │
│  [ ] 2.  백필 전용 인덱스 삭제 (불필요 시)                     │
│  [ ] 3.  Feature Flag 제거                                     │
│  [ ] 4.  Dual Write 코드 경로 제거                             │
│  [ ] 5.  Fallback/호환성 코드 제거                             │
│  [ ] 6.  백필 스크립트/잡 비활성화                              │
│  [ ] 7.  Checkpoint 파일 정리                                  │
│  [ ] 8.  구 시스템 접근 권한 회수                               │
│  [ ] 9.  마이그레이션 문서 최종 업데이트 (결과, 교훈)          │
│  [ ] 10. 구 시스템 데이터 보존 기간 정의 후 스케줄 삭제        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. 참고 자료

### 빅테크 엔지니어링 블로그

| 회사 | 주제 | URL |
|------|------|-----|
| Stripe | Online Migrations at Scale | https://stripe.com/blog/online-migrations |
| Stripe | DocDB Zero-Downtime Migrations | https://stripe.dev/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations |
| Netflix | Data Gateway Platform | https://netflixtechblog.medium.com/data-gateway-a-platform-for-growing-and-protecting-the-data-tier-f1ed8db8f5c6 |
| Uber | DynamoDB to DocStore Migration | https://www.uber.com/blog/dynamodb-to-docstore-migration/ |
| Uber | Mezzanine Codebase Data Migration | https://www.uber.com/blog/mezzanine-codebase-data-migration/ |
| Uber | Reliable Reprocessing (DLQ) | https://www.uber.com/blog/reliable-reprocessing/ |
| Uber | Kappa Architecture | https://www.uber.com/blog/kappa-architecture-data-stream-processing/ |
| Airbnb | Nebula Search Backend | https://medium.com/airbnb-engineering/nebula-as-a-storage-platform-to-build-airbnbs-search-backends-ecc577b05f06 |
| Airbnb | Minerva Metric Consistency | https://medium.com/airbnb-engineering/how-airbnb-achieved-metric-consistency-at-scale-f23cc53dea70 |
| LinkedIn | Largest Enterprise Data Migration | https://engineering.linkedin.com/blog/2021/new-recruiter---jobs--the-largest-enterprise-data-migration-at-l |
| LinkedIn | Brooklin CDC Open Source | https://engineering.linkedin.com/blog/2019/brooklin-open-source |
| LinkedIn | Unified Streaming and Batch | https://engineering.linkedin.com/blog/2023/unified-streaming-and-batch-pipelines-at-linkedin--reducing-proc |
| Meta | Messenger Storage Migration | https://engineering.fb.com/2018/06/26/core-infra/migrating-messenger-storage-to-optimize-performance/ |
| Meta | OSC Rebuilt in Python | https://engineering.fb.com/2017/05/05/production-engineering/onlineschemachange-rebuilt-in-python/ |
| Google | Spanner Columnar Storage Engine | https://cloud.google.com/blog/products/databases/spanner-modern-columnar-storage-engine |
| Twitter/X | Manhattan Distributed Database | https://blog.x.com/engineering/en_us/a/2014/manhattan-our-real-time-multi-tenant-distributed-database-for-twitter-scale |
| Shopify | MySQL Shard Balancing | https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale |
| GitHub | MySQL 8.0 Upgrade | https://github.blog/engineering/infrastructure/upgrading-github-com-to-mysql-8-0/ |
| GitHub | gh-ost Online Migration Tool | https://github.blog/news-insights/company-news/gh-ost-github-s-online-migration-tool-for-mysql/ |

### 오픈소스 도구

| 도구 | URL |
|------|-----|
| Ghostferry (Shopify) | https://github.com/Shopify/ghostferry |
| Apache Airflow Backfill | https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html |
| dbt Incremental Models | https://docs.getdbt.com/docs/build/incremental-models |
| dbt Microbatch | https://docs.getdbt.com/docs/build/incremental-microbatch |
| Flink CDC | https://www.decodable.co/blog/flink-cdc-unlocking-real-time-data-streaming |

### 학술 자료 및 이론

| 주제 | URL |
|------|-----|
| Thalheim & Wang - Data Migration Theory | https://www.sciencedirect.com/science/article/abs/pii/S0169023X12001048 |
| CAP Theorem 원본 | https://dl.acm.org/doi/10.5555/2075144.2075176 |
| Change Data Capture (Wikipedia) | https://en.wikipedia.org/wiki/Change_data_capture |
| CDC Patterns & Solutions (Confluent) | https://www.confluent.io/blog/how-change-data-capture-works-patterns-solutions-implementation/ |
| Event Sourcing Pattern (Microsoft) | https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing |
| CQRS Pattern (Microsoft) | https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs |
| Schema Evolution (IEEE) | https://ieeexplore.ieee.org/document/7840924/ |
| Schema Evolution (Springer) | https://link.springer.com/article/10.1007/s10619-021-07334-1 |
| MapReduce (ACM) | https://dl.acm.org/doi/10.1145/1327452.1327492 |
| Lambda Architecture (Wikipedia) | https://en.wikipedia.org/wiki/Lambda_architecture |

### 마이그레이션 패턴 및 가이드

| 주제 | URL |
|------|-----|
| Dual Write 주의사항 (Google Cloud) | https://medium.com/google-cloud/online-database-migration-by-dual-write-this-is-not-for-everyone-cb4307118f4b |
| Zero-Downtime Migration (Mercari) | https://engineering.mercari.com/en/blog/entry/20241113-designing-a-zero-downtime-migration-solution-with-strong-data-consistency-part-iv/ |
| Zero-Downtime Best Practices (LaunchDarkly) | https://launchdarkly.com/blog/3-best-practices-for-zero-downtime-database-migrations/ |
| Database Migration Patterns | https://medium.com/@jaredhatfield/database-migration-patterns-6b5ede23d06e |
| Strangler Fig Pattern (Confluent) | https://developer.confluent.io/patterns/compositional-patterns/strangler-fig/ |
| Shadow Table Strategy (InfoQ) | https://www.infoq.com/articles/shadow-table-strategy-data-migration/ |
| Kappa vs Lambda Architecture | https://www.kai-waehner.de/blog/2021/09/23/real-time-kappa-architecture-mainstream-replacing-batch-lambda/ |

### 백필 실무 가이드

| 주제 | URL |
|------|-----|
| Backfills in ML (Dagster) | https://dagster.io/blog/backfills-in-ml |
| Data Backfilling Guide (Atlan) | https://atlan.com/backfilling-data-guide/ |
| Backfilling Concepts & Best Practices | https://medium.com/@andymadson/backfilling-data-pipelines-concepts-examples-and-best-practices-19f7a6b20c82 |
| Data Backfill Overview (Dremio) | https://www.dremio.com/wiki/data-backfill/ |
| Reliable Backfill Solution (ContentSquare) | https://engineering.contentsquare.com/2023/engineering-a-reliable-data-backfill-solution/ |
| Foolproof Backfill Guide (lakeFS) | https://lakefs.io/blog/backfilling-data-foolproof-guide/ |
| Kafka Backfill Patterns | https://nejckorasa.github.io/posts/kafka-backfill/ |
| Kafka Reconsuming with Microservices | https://transporeon-visibility-hub.medium.com/backfilling-reconsuming-with-kafka-and-microservices-dbf9fb4033d1 |
| DW History (Dataversity) | https://www.dataversity.net/a-short-history-of-data-warehousing/ |

