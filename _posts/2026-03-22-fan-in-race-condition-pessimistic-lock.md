---
layout: single
title: "Fan-In, Race Condition, Pessimistic Lock"
date: 2026-03-22 23:00:00 +0900
categories: backend
excerpt: "Fan-In 구간에서 발생하는 Race Condition을 비관적 잠금으로 직렬화해 파이프라인 정합성을 보장하는 방법을 설명한다."
toc: true
toc_sticky: true
tags: [backend, fanin, racecondition, pessimisticlock, concurrency]
source: "/home/dwkim/dwkim/docs/done/fan-in-race-condition-pessimistic-lock.md"
---
TL;DR
- Fan-In, Race Condition, Pessimistic Lock의 핵심 개념을 빠르게 파악할 수 있다.
- 배경과 이유를 통해 왜 이 주제가 필요한지 맥락을 이해할 수 있다.
- 실무에서 바로 참고할 수 있도록 주요 포인트를 구조화해 정리했다.

## 1. 개념
여러 갈래로 나뉘었던 비동기 작업이 **하나로 합쳐지는 지점**을 말한다.

## 2. 배경
해당 주제가 필요한 실무 맥락과 기존 접근의 한계를 함께 이해해야 올바른 설계 판단이 가능하다.

## 3. 이유
문제 재발을 줄이고 운영 안정성을 높이기 위해 개념뿐 아니라 적용 기준과 트레이드오프를 명확히 정리할 필요가 있다.

## 4. 특징
핵심 용어, 동작 흐름, 구현 포인트, 주의사항을 한 문서에 묶어 빠르게 참고할 수 있다.

## 5. 상세 내용

# Fan-In, Race Condition, Pessimistic Lock

> 관련 이슈: [example-org/example#1673](https://github.com/example-org/example/issues/1673) - Dashboard OCR 항목이 terminal 전이 누락 시 계속 처리중으로 보이는 문제

---

## Fan-In (팬인)

### 개념

여러 갈래로 나뉘었던 비동기 작업이 **하나로 합쳐지는 지점**을 말한다.
반대로 하나가 여러 개로 퍼지는 건 Fan-out이라 한다.

```
Fan-out (1 → N)              Fan-in (N → 1)

    ┌─→ Document A OCR ──┐
    │                     │
Pipeline ─┼─→ Document B OCR ──┼─→ "전부 끝났나?" → 다음 Step
    │                     │
    └─→ Document C OCR ──┘
```

### klpark 코드에서의 Fan-In

파이프라인이 여러 문서의 OCR를 동시에 요청하고, **모든 문서의 OCR가 끝나야** 다음 단계로 넘어간다.

`PipelineOcrListener.kt:95-109` 이 fan-in 지점이다:

```kotlin
// "이 파이프라인에서 아직 COMPLETED 안 된 문서가 몇 개 남았지?"
val pendingCount = ocrTrackingRepository.countByPipelineIdAndOcrStatusNot(
    tracking.pipelineId,
    OcrStatus.COMPLETED
)

// 남은 게 0이면 → 전부 끝남 → 다음 단계로!
if (pendingCount == 0L) {
    step.markDone()
    pipelineOrchestrator.onStepCompleted(...)
}
```

### 동작 흐름

```
[t1] Document A OCR 완료 → 이벤트 발행
     → pendingCount = 2 (B, C 아직 처리중)
     → "아직 남았으니 대기"

[t2] Document C OCR 완료 → 이벤트 발행
     → pendingCount = 1 (B 아직 처리중)
     → "아직 남았으니 대기"

[t3] Document B OCR 완료 → 이벤트 발행
     → pendingCount = 0 ← Fan-In 지점!
     → "전부 끝남! 다음 단계 진행!"
```

마지막으로 완료된 문서의 이벤트 핸들러가 "모두 끝났다"를 감지하고 다음 단계를 트리거하는 구조다.

---

## Race Condition (경쟁 조건)

### 개념

두 개 이상의 스레드가 **거의 동시에** 같은 데이터를 읽고 쓸 때, 타이밍에 따라 결과가 달라지는 문제.

### Fan-In에서의 Race Condition 시나리오

Document B와 C의 OCR가 거의 동시에 완료되는 경우:

```
Thread-1 (Doc B 완료)              Thread-2 (Doc C 완료)
━━━━━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━━━━

① tracking.ocrStatus = COMPLETED
② save(tracking)  ← B를 COMPLETED로 저장
                                   ③ tracking.ocrStatus = COMPLETED
                                   ④ save(tracking)  ← C를 COMPLETED로 저장

⑤ pendingCount 조회                ⑥ pendingCount 조회
   → 1 (C가 아직 안 보임!)            → 1 (B가 아직 안 보임!)

⑦ "아직 남았네, 대기"               ⑧ "아직 남았네, 대기"

결과: 둘 다 "남은 게 있다"고 판단
→ 아무도 다음 단계를 트리거 안 함
→ 파이프라인이 영원히 RUNNING (= stuck)
```

save와 count 사이에 다른 트랜잭션이 끼어들 수 있기 때문이다.
`@Transactional`이 걸려 있어도 기본 격리 수준(READ_COMMITTED)에서는
다른 트랜잭션이 커밋하기 전 데이터를 읽을 수 있다.

---

## Pessimistic Lock (비관적 잠금)

### 개념

**낙관적(Optimistic)**: "충돌은 거의 안 나겠지" → 일단 작업하고, 저장할 때 충돌이면 재시도
**비관적(Pessimistic)**: "충돌이 날 수 있으니 미리 잠그자" → 먼저 잠금을 획득하고 나서 작업

비유:
- 낙관적: 화장실 문 안 잠그고 들어감 → 누가 열면 "앗 사용중!" → 다시 시도
- 비관적: 문을 잠그고 들어감 → 다른 사람은 열릴 때까지 대기

### DB에서의 Pessimistic Lock

```sql
-- 비관적 잠금: 이 행을 읽는 동안 다른 트랜잭션이 수정 못하게 잠금
SELECT * FROM pipeline_ocr_tracking
WHERE pipeline_id = 123
FOR UPDATE;   -- 이게 비관적 잠금
```

`FOR UPDATE`를 걸면:
- 행을 읽음과 동시에 **행 잠금**을 획득
- 다른 트랜잭션이 같은 행을 `FOR UPDATE`로 읽으려 하면 **대기**
- 현재 트랜잭션이 커밋/롤백하면 잠금 해제 → 대기 중이던 트랜잭션이 진행

### 적용 시 동작

```
Thread-1 (Doc B 완료)              Thread-2 (Doc C 완료)
━━━━━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━━━━

① tracking 행들 FOR UPDATE 잠금 획득
                                   ② 같은 행 잠금 시도 → 대기!
③ B를 COMPLETED로 저장
④ pendingCount = 1 (C 아직)
⑤ "아직 남았네, 대기"
⑥ 트랜잭션 커밋 → 잠금 해제
                                   ⑦ 잠금 획득! (이제 B의 변경 보임)
                                   ⑧ C를 COMPLETED로 저장
                                   ⑨ pendingCount = 0
                                   ⑩ "전부 끝남! 다음 단계 진행!"
```

두 트랜잭션이 순차 실행되므로, 정확히 마지막 문서를 처리하는 트랜잭션이 `pendingCount == 0`을 감지한다.

### JPA/Spring 구현 예시

```kotlin
// Repository에 비관적 잠금 쿼리 추가
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT t FROM PipelineOcrTracking t WHERE t.pipelineId = :pipelineId")
fun findByPipelineIdForUpdate(pipelineId: Long): List<PipelineOcrTracking>
```

---

## 정리

| 개념 | 한 줄 요약 |
|------|-----------|
| **Fan-In** | 여러 비동기 작업이 모두 끝났는지 확인하는 합류 지점 |
| **Race Condition** | 두 스레드가 동시에 fan-in 체크를 해서 둘 다 "아직 남음"으로 판단하는 문제 |
| **Pessimistic Lock** | DB 행을 미리 잠가서 동시 접근을 순차화하여 race condition 방지 |

---

## 용어 사전 (Terminology Dictionary)

| 용어 | 풀네임/어원 | 유래 |
|------|------------|------|
| **Fan-In** | 전자공학 logic gate 입력 수 | 1960년대 TTL/CMOS 회로 설계에서 유래. 부채(fan)가 접히는 모양에서 비유. 소프트웨어에는 Tony Hoare의 CSP(1978) → Rob Pike의 Go Concurrency Patterns(2012)를 거쳐 정착 |
| **Fan-Out** | 전자공학 logic gate 출력 수 | Fan-In의 반대. 하나의 출력이 여러 입력으로 퍼지는 모양 |
| **Race Condition** | 경쟁 조건 | 1954년 David Huffman의 논문 "The Synthesis of Sequential Switching Circuits"에서 최초 사용. 비동기 순차 논리 회로에서 두 신호가 경마(race)처럼 먼저 도착하려고 경쟁하는 상황에서 유래 |
| **Pessimistic Lock** | 비관적 잠금 | 1976년 Eswaran, Gray et al.의 2PL 이론이 원형. "충돌이 날 것"이라고 비관적으로 가정하고 미리 잠금. "Pessimistic"이라는 명칭은 1981년 Kung-Robinson의 Optimistic CC 논문 이후 대비 용어로 정착 |
| **Optimistic Lock** | 낙관적 잠금 | 1981년 H.T. Kung & John Robinson의 논문 "On Optimistic Methods for Concurrency Control"에서 명명. "충돌이 드물 것"이라고 낙관적으로 가정 |
| **2PL** | Two-Phase Locking | Growing Phase(잠금 획득)와 Shrinking Phase(잠금 해제) 두 단계로 구성. Serializability 보장의 수학적 기반 |
| **FOR UPDATE** | SQL 행 잠금 구문 | SQL-92 표준에서 DECLARE CURSOR 옵션으로 공식화. Oracle, IBM DB2가 초기부터 지원. PostgreSQL이 일반 SELECT에서도 사용 가능하도록 확장 |
| **MVCC** | Multi-Version Concurrency Control | 1978년 David Reed의 MIT 박사 논문에서 최초 제안. 데이터의 여러 버전을 유지하여 읽기-쓰기 충돌 제거 |
| **CSP** | Communicating Sequential Processes | 1978년 Tony Hoare 발표. Go 언어의 goroutine + channel 모델의 직접적 이론 기반 |
| **ACID** | Atomicity, Consistency, Isolation, Durability | Jim Gray가 1981년 "The Transaction Concept" 논문에서 정립. 1998년 Turing Award 수상 |
| **SSI** | Serializable Snapshot Isolation | PostgreSQL 9.1(2011)에서 도입. 잠금 없이 직렬화 가능성을 보장하는 방식 |

---

## 학술적 기초 (Academic Foundation)

### 핵심 논문들

1. **Eswaran, Gray, Lorie, Traiger (1976)**
   - 논문: "The Notions of Consistency and Predicate Locks in a Database System"
   - 게재: Communications of the ACM
   - 의의: 2PL이 Serializability를 보장함을 수학적으로 증명. 현대 모든 RDBMS의 동시성 제어 기반.

2. **Kung & Robinson (1981)**
   - 논문: "On Optimistic Methods for Concurrency Control"
   - 게재: ACM Transactions on Database Systems (TODS)
   - 의의: 잠금 없는 동시성 제어의 학술적 기원. Read → Validation → Write 3단계 모델 제안.

3. **Jim Gray (1981)**
   - 논문: "The Transaction Concept: Virtues and Limitations"
   - 게재: VLDB
   - 의의: ACID 속성 정의. 트랜잭션의 공식적 정의 완성.

4. **ANSI/ISO SQL-92 (1992)**
   - 의의: 4개 격리 수준 표준화 (READ UNCOMMITTED → READ COMMITTED → REPEATABLE READ → SERIALIZABLE).

5. **Berenson, Bernstein, Gray et al. (1995)**
   - 논문: "A Critique of ANSI SQL Isolation Levels"
   - 게재: ACM SIGMOD
   - 의의: SQL-92 격리 수준 정의의 모호성과 불완전성 증명. Snapshot Isolation 최초 공식 정의. Write Skew 등 새로운 이상 현상 발견.

6. **Tony Hoare (1978)**
   - 논문: "Communicating Sequential Processes"
   - 게재: Communications of the ACM
   - 의의: 채널 기반 동시성 모델 정립. Go 언어의 직접적 이론 기반.

7. **David Reed (1978)**
   - 논문: MIT 박사 논문
   - 의의: MVCC 개념 최초 제안.

---

## 연대표 (Evolution Timeline)

```
1954  David Huffman, Race Condition 용어 최초 사용
      └─ 논문: "The Synthesis of Sequential Switching Circuits"

1960s 전자공학 Fan-In/Fan-Out 개념 정립 (TTL/CMOS)
      └─ Logic gate 입출력 수의 물리적 제약

1965  Dijkstra, 세마포어(Semaphore) 발명
      └─ 소프트웨어 동시성 제어의 시작

1970  Codd, 관계형 모델 제안

1974  IBM System R 프로젝트 시작 (SQL의 전신)

1976  Eswaran & Gray, 2PL(Two-Phase Locking) 이론 정립
      └─ Pessimistic Locking의 수학적 기반

1978  Tony Hoare, CSP 발표 → Fan-In 패턴의 이론적 기원
      David Reed, MVCC 개념 최초 제안 (MIT 박사 논문)

1979  Oracle, 최초 상용 RDBMS 출시 (FOR UPDATE 초기 지원)

1981  Kung & Robinson, Optimistic CC 논문 발표
      Jim Gray, ACID 속성 정의
      └─ "Pessimistic" vs "Optimistic" 용어 쌍 정착

1984  VAX Rdb/ELN — 최초 상용 MVCC 데이터베이스 (DEC)

1992  ANSI SQL-92 — 4개 격리 수준 표준화

1995  Berenson et al., SQL 격리 수준 비판 + Snapshot Isolation 정의

1999  PostgreSQL MVCC 구현 (Vadim Mikheev)

2006  Google Chubby — Paxos 기반 분산 잠금 서비스

2008  Apache ZooKeeper — 오픈소스 분산 코디네이션

2011  CRDTs 공식 정의 (Shapiro et al.)
      PostgreSQL 9.1 — SSI(Serializable Snapshot Isolation) 도입

2012  Rob Pike, Go Concurrency Patterns 강연
      └─ Fan-In/Fan-Out 소프트웨어 패턴 대중화
      Calvin — 결정론적 분산 트랜잭션

2013  PostgreSQL 9.3 — FOR NO KEY UPDATE, FOR KEY SHARE 도입
      Google Spanner — TrueTime API + 글로벌 외부 일관성

2014  Java 8 — CompletableFuture.allOf() (비동기 Fan-In)

2016  Martin Kleppmann, Redlock 알고리즘 비판

2020s 분산 SERIALIZABLE 기본값 트렌드 (CockroachDB, Spanner)
      하이브리드 동시성 제어 (MVCC + 분산 잠금 + Raft)
```

---

## 대안 비교표 (Alternatives Comparison)

### Race Condition 해결 전략

| 전략 | 정확성 | 성능 | 구현 복잡도 | Deadlock 위험 | 분산 지원 | 적합한 상황 |
|------|--------|------|------------|---------------|-----------|------------|
| Pessimistic Lock (FOR UPDATE) | ★★★ | ★★ | 낮음 | 있음 | 단일 DB | 높은 충돌률, 복잡한 비즈니스 로직 |
| Optimistic Lock (version + retry) | ★★★ | ★★★ (저충돌) | 중간 | 없음 | 좋음 | 낮은 충돌률, 읽기 집약적 |
| SERIALIZABLE 격리 수준 | ★★★ | ★ | 낮음 | 낮음(SSI) | 단일 DB | 최강 정합성, 코드 단순화 |
| Atomic Counter (UPDATE count-1) | ★★★ | ★★★ | 매우 낮음 | 없음 | 단일 DB | 단순 증감 연산 (재고, 포인트) |
| Advisory Lock (pg_advisory_lock) | ★★★ | ★★★ | 중간 | 낮음 | 단일 DB | 논리적 리소스 잠금, 배경 작업 |
| Redis 분산 Lock (SETNX) | ★★ | ★★★ | 높음 | 없음 | 좋음 | 다중 서비스 간 동기화 |
| Workflow Engine (Temporal) | ★★★ | ★★ | 매우 높음 | 없음 | 매우 좋음 | 복잡한 장기 실행 프로세스 |

### Fan-In 패턴 구현 대안

| 방식 | 동작 원리 | 지연 | 정확성 | 분산 지원 |
|------|----------|------|--------|-----------|
| Event-driven callback (현재 방식) | 각 Worker 완료 시 잔여 수 확인 | 즉시 | Race Condition 위험 → Lock 필요 | 단일 DB |
| DB Atomic Counter + RETURNING | `UPDATE SET count = count - 1 RETURNING count` | 즉시 | 높음 (원자적) | 단일 DB |
| Polling (주기적 확인) | 별도 프로세스가 DB를 주기적으로 확인 | polling 간격만큼 | 높음 | 가능 |
| CountDownLatch/Barrier | In-memory 동기화 프리미티브 | 즉시 | 높음 | 불가 (단일 JVM) |
| Message Queue + Aggregator | 완료 메시지를 queue로 발행, Aggregator가 수집 | 중간 | 높음 (idempotency 필요) | 좋음 |
| Workflow Engine (Temporal) | 코드 수준에서 Fan-In 배리어 표현 | 중간 | 매우 높음 | 매우 좋음 |

---

## 상황별 최적 선택 (Best Choice by Scenario)

### 의사결정 플로우차트

```
단일 DB인가?
├── YES
│   ├── 연산이 단순 증감인가?
│   │   └── YES → Atomic Counter (UPDATE SET count = count - 1)
│   ├── 충돌률이 낮은가? (<10%)
│   │   └── YES → Optimistic Lock (@Version + retry)
│   ├── 충돌률이 높은가? (>30%)
│   │   └── YES → Pessimistic Lock (SELECT FOR UPDATE)
│   └── 여러 테이블에 걸친 복잡한 로직?
│       └── YES → SERIALIZABLE 격리 수준 (PostgreSQL SSI)
└── NO (다중 서비스/DB)
    ├── 간단한 상호 배제?
    │   └── YES → Redis 분산 Lock (SETNX)
    ├── 이벤트 기반 아키텍처?
    │   └── YES → Event Sourcing + Optimistic Lock
    └── 복잡한 장기 실행 프로세스?
        └── YES → Temporal Workflow Engine
```

### 실전 사례 분석

| 시스템 | 전략 | 이유 |
|--------|------|------|
| 좌석 예매 (항공, 콘서트) | Pessimistic Lock + SKIP LOCKED | 인기 좌석에 대한 높은 동시 경쟁. SKIP LOCKED로 잠긴 좌석 건너뛰어 처리량 극대화 |
| 재고 차감 (이커머스) | Atomic Counter | `UPDATE stock = stock - qty WHERE stock >= qty`. Lock 없이도 DB 원자성으로 안전 |
| 결제 시스템 (Uber) | Event Sourcing + Version Ordering | MSA 환경에서 DB Lock은 서비스 경계를 넘을 수 없음. Version 기반 순서 직렬화 |
| 결제 중복 방지 (Stripe) | Idempotency Key | HTTP 헤더로 UUID 전달, 동일 키에 대해 한 번만 처리 |
| 파이프라인 Fan-In (현재 이슈) | Pessimistic Lock (FOR UPDATE) | 여러 OCR 완료 이벤트가 동시 도착할 때 정확히 하나만 다음 단계 트리거 |

---

## 베스트 프랙티스 & 안티패턴

### Pessimistic Lock 베스트 프랙티스

#### Lock 범위 최소화

```sql
-- 올바른 예: 특정 행만 잠금 (인덱스 사용)
SELECT * FROM pipeline_ocr_tracking
WHERE pipeline_id = 123
FOR UPDATE;

-- 잘못된 예: WHERE 절 없이 전체 스캔 → Lock Escalation 위험
SELECT * FROM pipeline_ocr_tracking FOR UPDATE;
```

#### Lock Timeout 반드시 설정

```sql
-- PostgreSQL: 세션 단위
SET lock_timeout = '5s';

-- MySQL InnoDB
SET innodb_lock_wait_timeout = 5;
```

JPA/Spring에서:

```kotlin
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(QueryHint(name = "jakarta.persistence.lock.timeout", value = "5000"))
@Query("SELECT t FROM PipelineOcrTracking t WHERE t.pipelineId = :pipelineId")
fun findByPipelineIdForUpdate(pipelineId: Long): List<PipelineOcrTracking>
```

#### Lock Ordering으로 데드락 방지

```sql
-- 항상 동일한 순서로 잠금 획득 (예: ID 오름차순)
SELECT * FROM accounts WHERE id IN (50, 75, 100) ORDER BY id ASC FOR UPDATE;
```

데드락 원인:

```
Thread-1: Row A 잠금 → Row B 대기
Thread-2: Row B 잠금 → Row A 대기
→ 순환 대기 = 데드락!
```

해결: 항상 같은 순서(예: ID 오름차순)로 잠금을 획득하면 순환이 발생하지 않는다.

### 주요 안티패턴

#### Long Transaction + Pessimistic Lock

```kotlin
// 위험: Lock을 보유한 채로 외부 API 호출
@Transactional
fun processOcr(trackingId: Long) {
    val tracking = repository.findByIdForUpdate(trackingId)  // 잠금 획득
    externalOcrService.callApi(tracking)  // 수초 소요 → 다른 트랜잭션 블로킹!
    tracking.markCompleted()
}
```

해결: 외부 I/O는 트랜잭션 밖에서 처리하고, Lock 보유 시간을 최소화한다.

#### @Transactional(REQUIRES_NEW) + Connection Pool 데드락

```
Thread 1: Connection #1 획득 → REQUIRES_NEW로 Connection #2 요청 → Pool 대기
Thread 2: Connection #1 획득 → REQUIRES_NEW로 Connection #2 요청 → Pool 대기
...
→ 모든 Connection이 점유된 채 새 Connection을 기다림 → 애플리케이션 레벨 데드락
```

해결: `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async`로 분리.

#### N+1 Lock 문제

```kotlin
// 위험: 루프 안에서 개별 lock 획득 → N번의 SELECT FOR UPDATE
for (id in trackingIds) {
    repository.findByIdForUpdate(id)  // N번 실행!
}

// 올바른 예: IN 절로 한 번에 잠금
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT t FROM PipelineOcrTracking t WHERE t.id IN :ids ORDER BY t.id")
fun findAllByIdsForUpdate(ids: List<Long>): List<PipelineOcrTracking>
```

### Fan-In 패턴 주의점

#### Exactly-Once는 At-Least-Once + Idempotency

분산 시스템에서 진정한 Exactly-Once 전달은 불가능하다. 실용적인 방법:

```sql
-- Idempotency Key로 중복 처리 방지
INSERT INTO processed_events (event_id, processed_at)
VALUES ($1, NOW())
ON CONFLICT (event_id) DO NOTHING;
-- 삽입 성공한 경우에만 비즈니스 로직 실행
```

#### Timeout 처리 필수

일부 OCR 작업이 영원히 완료되지 않을 수 있다. 반드시:
- 작업별 timeout 설정 (예: 5분)
- timeout 초과 시 FAILED 상태로 전이
- Dead Letter Queue 연동으로 재처리 가능하도록 설계
- 모니터링/알림 설정 (stuck 파이프라인 감지)

### 현재 코드의 Atomic Counter 대안

현재 코드는 Pessimistic Lock으로 해결했지만, `UPDATE ... RETURNING` 패턴으로도 해결 가능하다:

```sql
-- Atomic Counter 방식 (PostgreSQL)
UPDATE pipeline_ocr_tracking
SET ocr_status = 'COMPLETED'
WHERE id = :trackingId;

-- 남은 수를 원자적으로 조회
WITH remaining AS (
    SELECT COUNT(*) as cnt
    FROM pipeline_ocr_tracking
    WHERE pipeline_id = :pipelineId
      AND ocr_status != 'COMPLETED'
)
SELECT cnt FROM remaining;
```

그러나 현재 코드의 Pessimistic Lock 방식이 더 명확하고 안전하다:
- 모든 tracking 행을 한 번에 잠그므로 일관된 상태를 보장
- 비즈니스 로직이 복잡해져도 확장 가능
- 코드의 의도가 명확 ("이 행들을 잠그고 확인한다")

---

## MVCC와 Pessimistic Lock의 관계

### PostgreSQL MVCC 동작 원리

PostgreSQL은 row의 여러 버전을 테이블 heap에 물리적으로 저장한다:

```
┌─────────────────────────────────────────────────┐
│  Tuple Header                                    │
│  ┌──────┐  ┌──────┐  ┌──────────┐               │
│  │ xmin │  │ xmax │  │ infomask │               │
│  │ =100 │  │ =0   │  │          │               │
│  └──────┘  └──────┘  └──────────┘               │
│                                                   │
│  xmin: 이 row를 생성한 트랜잭션 ID                  │
│  xmax: 이 row를 삭제/잠근 트랜잭션 ID (0=활성)      │
│  infomask: 잠금 상태 비트 플래그                    │
└─────────────────────────────────────────────────┘
```

### FOR UPDATE와 MVCC의 통합

```
SELECT FOR UPDATE 실행 시:
① xmax에 현재 트랜잭션 XID 기록
② infomask에 HEAP_XMAX_EXCL_LOCK 플래그 설정

다른 트랜잭션이 같은 row에 접근할 때:
③ xmax 확인 → lock bit 감지 → 대기
④ 일반 SELECT (non-locking)는 MVCC 스냅샷으로 과거 버전 읽기 가능

핵심 원칙:
- 읽기는 쓰기를 차단하지 않는다 (MVCC)
- 쓰기는 읽기를 차단하지 않는다 (MVCC)
- 쓰기는 쓰기를 차단한다 (Pessimistic Lock)
```

### MySQL InnoDB와의 차이

| 항목 | PostgreSQL | MySQL InnoDB |
|------|-----------|--------------|
| 이전 버전 저장 | 테이블 heap 내 (Dead Tuple) | 별도 Undo Log |
| 정리 방식 | VACUUM 프로세스 | Purge Thread (자동) |
| 기본 격리 수준 | READ COMMITTED | REPEATABLE READ |
| Phantom Read 방지 | SERIALIZABLE에서만 | REPEATABLE READ에서도 (Next-Key Lock) |
| Lock 세분화 | FOR UPDATE / FOR NO KEY UPDATE / FOR SHARE / FOR KEY SHARE | FOR UPDATE / FOR SHARE |

---

## 격리 수준과 Race Condition

현재 코드에서 Race Condition이 발생하는 이유:

```
기본 격리 수준: READ COMMITTED

Thread-1 (Doc B 완료)              Thread-2 (Doc C 완료)
━━━━━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━━━━
    @Transactional 시작                @Transactional 시작
         │                                  │
    ① B를 COMPLETED로 저장             ② C를 COMPLETED로 저장
         │                                  │
    ③ pendingCount 조회                ④ pendingCount 조회
       → READ COMMITTED이므로              → READ COMMITTED이므로
         ②의 변경이 아직 보이지 않음          ①의 변경이 아직 보이지 않음
         pendingCount = 1                   pendingCount = 1
         │                                  │
    ⑤ "아직 남음" → 대기               ⑥ "아직 남음" → 대기
         │                                  │
    ⑦ 커밋                             ⑧ 커밋
         │                                  │
         └──────── 아무도 다음 단계를 트리거하지 않음 ────────┘
```

**왜 SERIALIZABLE로는 해결하기 어려운가:**
- SERIALIZABLE은 serialization failure 시 트랜잭션을 abort하고 retry를 요구
- 이벤트 리스너 컨텍스트에서 자동 retry 구현이 복잡
- Pessimistic Lock이 이 시나리오에서 더 명확하고 예측 가능한 해결책

---

## References

### 학술 논문
- Eswaran, Gray, Lorie, Traiger (1976) - "The Notions of Consistency and Predicate Locks in a Database System", CACM
- Kung & Robinson (1981) - "On Optimistic Methods for Concurrency Control", ACM TODS
- Jim Gray (1981) - "The Transaction Concept: Virtues and Limitations", VLDB
- Berenson, Bernstein, Gray et al. (1995) - "A Critique of ANSI SQL Isolation Levels", ACM SIGMOD
- David Huffman (1954) - "The Synthesis of Sequential Switching Circuits", Journal of the Franklin Institute
- Tony Hoare (1978) - "Communicating Sequential Processes", CACM
- David Reed (1978) - "Concurrency Control in Distributed Database Systems", MIT PhD Thesis
- Shapiro, Preguica et al. (2011) - "Conflict-free Replicated Data Types", SSS

### 공식 문서
- PostgreSQL Documentation: Explicit Locking - https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL Documentation: Transaction Isolation - https://www.postgresql.org/docs/current/transaction-iso.html
- MySQL 8.4: InnoDB Multi-Versioning - https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html
- Redis: Distributed Locks - https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/

### 블로그 & 실전 자료
- Martin Kleppmann - "How to do distributed locking" (2016) - https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- Uber Engineering - "Money at Scale with Strong Data Consistency" - https://www.uber.com/blog/money-scale-strong-data/
- Vlad Mihalcea - JPA Pessimistic/Optimistic Locking 시리즈 - https://vladmihalcea.com
- Rob Pike - "Go Concurrency Patterns" (Google I/O 2012) - https://go.dev/talks/2012/concurrency.slide
- Andy Pavlo (CMU) - "The Part of PostgreSQL We Hate the Most" - https://www.cs.cmu.edu/~pavlo/blog/2023/04/the-part-of-postgresql-we-hate-the-most.html
- ByteByteGo - "Pessimistic vs Optimistic Locking" - https://bytebytego.com/guides/pessimistic-vs-optimistic-locking/
