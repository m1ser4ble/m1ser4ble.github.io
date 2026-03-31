---
layout: single
title: "Compare-And-Swap CAS 완전 가이드"
date: 2026-03-31 10:17:00 +0900
categories: backend
excerpt: "CAS는 기대값 검증 후 교체를 원자적으로 수행해 잠금 없이 동시성 제어와 고성능 확장을 가능하게 하는 핵심 메커니즘이다."
toc: true
toc_sticky: true
tags: [backend, concurrency, cas, lockfree, distributed]
source: "/home/dwkim/dwkim/docs/backend/cas-compare-and-swap-완전가이드.md"
---
TL;DR
- CAS는 기대값과 현재값을 비교한 뒤 일치할 때만 교체하는 원자 연산으로, 낙관적 동시성 제어의 핵심이다.
- CPU 명령어에서 시작한 CAS 패턴은 OS, 런타임, DB, 분산 시스템까지 동일한 원리로 확장된다.
- 실무에서는 ABA 문제, 고경합 재시도 폭주, 메모리 오더링 함정을 피하기 위한 설계가 성패를 좌우한다.

## 1. 개념
CAS(Compare-And-Swap)는 메모리(또는 상태)의 현재 값이 기대값과 같을 때만 새 값으로 바꾸는 원자적 비교-교환 연산이다.

## 2. 배경
멀티코어 환경에서 단순 락만으로는 데드락·우선순위 역전·경합 확장성 한계가 빈번해져, 잠금 없는 원자 연산 기반 동시성 제어가 필요해졌다.

## 3. 이유
CAS는 충돌이 적은 환경에서 대기 없이 빠른 진행을 보장하고, 실패 시 재시도로 정합성을 유지해 처리량과 응답성의 균형을 만든다.

## 4. 특징
단일 연산의 원자성, lock-free 알고리즘의 기반, OCC/조건부 쓰기와의 구조적 동일성, 그리고 다양한 레벨(CPU~분산 시스템)로의 일관된 확장성이 핵심 특징이다.

## 5. 상세 내용

# Compare-And-Swap (CAS) 완전 가이드

> **작성일**: 2026-03-30
> **카테고리**: Backend / Concurrency / Distributed Systems / CPU Architecture
> **키워드**: CAS, Compare-And-Swap, Optimistic Locking, Lock-Free, Wait-Free, ABA Problem, CMPXCHG, LL/SC, Linearizability, Consensus Number, MVCC, Conditional Write, etcd, DynamoDB, Kafka, Striped64

---

## 목차

1. [개요](#1-개요)
2. [용어 사전](#2-용어-사전)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원과 진화](#4-역사적-기원과-진화)
5. [학술적/이론적 배경](#5-학술적이론적-배경)
6. [CAS 구현 레벨별 분석](#6-cas-구현-레벨별-분석)
7. [대안 비교](#7-대안-비교)
8. [상황별 최적 선택](#8-상황별-최적-선택)
9. [설계 원칙과 베스트 프랙티스](#9-설계-원칙과-베스트-프랙티스)
10. [안티패턴과 함정](#10-안티패턴과-함정)
11. [빅테크 실전 사례](#11-빅테크-실전-사례)
12. [참고 자료](#12-참고-자료)

---

## 1. 개요

### 1.1 CAS란 무엇인가

Compare-And-Swap (CAS)은 동시성 프로그래밍에서 가장 근본적인 원자적(atomic) 연산이다. **메모리 위치의 현재 값을 기대값과 비교하고, 일치할 경우에만 새로운 값으로 교체**하는 두 단계를 하나의 분할 불가능한(indivisible) 하드웨어 연산으로 수행한다.

```
CAS(addr V, expected A, desired B):
    if *V == A:
        *V = B
        return true    // 성공: 값이 교체됨
    else:
        return false   // 실패: 다른 스레드가 먼저 변경함
```

이 단순한 연산이 현대 컴퓨터 과학의 핵심 기반인 이유는, CAS가 **이론적으로 무한한 수의 스레드 간 합의(consensus)를 달성할 수 있는 유일한 부류의 원시 연산**이기 때문이다 (Herlihy, 1991).

### 1.2 CAS의 본질: Optimistic Concurrency Control

CAS는 단순한 CPU 명령어를 넘어서는 **개념적 전략**이다. 핵심 철학은 **낙관적 동시성 제어(Optimistic Concurrency Control)**로 요약된다:

1. **충돌이 드물다고 가정**한다 (낙관적)
2. **잠금 없이 작업을 수행**한다
3. **커밋 시점에 검증**한다 (Compare)
4. **검증 성공 시 반영**한다 (Swap)
5. **검증 실패 시 재시도**한다

이 철학은 CPU 레지스터에서 분산 데이터베이스까지, 모든 레벨에서 동일하게 적용된다.

### 1.3 CAS의 적용 범위

```
┌─────────────────────────────────────────────────────────────┐
│                    CAS 적용 스펙트럼                         │
├─────────┬──────────────┬──────────────┬─────────────────────┤
│  CPU    │  OS/런타임   │  데이터베이스 │   분산 시스템       │
├─────────┼──────────────┼──────────────┼─────────────────────┤
│CMPXCHG  │ futex        │ Version Col  │ etcd Txn            │
│ARM CAS  │ spinlock     │ WHERE ver=?  │ DynamoDB Condition  │
│LL/SC    │ LongAdder    │ MVCC         │ Raft Log            │
│         │ ConcurrentMap│ SSI          │ Spanner TrueTime    │
├─────────┼──────────────┼──────────────┼─────────────────────┤
│  ~ns    │  ~ns-us      │  ~ms         │   ~ms-100ms         │
└─────────┴──────────────┴──────────────┴─────────────────────┘
```

---

## 2. 용어 사전

### 2.1 CAS 핵심 용어

| 용어 | 정의 |
|------|------|
| **CAS (Compare-And-Swap)** | 단일 메모리 워드에 대한 원자적 비교-교환 연산. 기대값과 일치할 때만 새 값으로 교체한다. |
| **Compare-And-Set** | CAS의 변형으로 **boolean**을 반환한다. Java의 `compareAndSet()`이 대표적이다. |
| **Compare-And-Exchange** | CAS의 변형으로 **이전 값(old value)**을 반환한다. Java 9+의 `compareAndExchange()`, C++의 `compare_exchange_strong()`이 해당한다. |
| **CAS2 / DCAS** | 비인접(non-contiguous) 두 메모리 위치에 대한 원자적 CAS. 하드웨어 지원이 없어 실용화되지 못했다. |
| **DWCAS** | Double-Width CAS. 인접한 두 워드(예: 128-bit)를 원자적으로 교체. x86의 `CMPXCHG16B`가 이를 지원한다. |
| **ABA Problem** | 값이 A -> B -> A로 변해도 CAS가 성공하는 문제. 이름 자체가 A-B-A 변화 패턴에서 유래했다. |
| **Tagged Pointer** | ABA 해결을 위해 포인터에 버전 카운터(tag)를 결합한 기법. DWCAS와 함께 사용한다. |

### 2.2 CPU 명령어 용어

| 용어 | 정의 |
|------|------|
| **CMPXCHG** | x86 아키텍처의 CAS 명령어. `LOCK` prefix와 함께 사용하여 원자성을 보장한다. |
| **CMPXCHG8B** | x86의 64-bit(8바이트) CAS. Pentium(1993)에서 도입되었다. |
| **CMPXCHG16B** | x86-64의 128-bit(16바이트) CAS. 2003년에 도입되었다. |
| **LL/SC (Load-Linked / Store-Conditional)** | ARM, MIPS, PowerPC, RISC-V의 CAS 대안. "값 비교"가 아닌 "변경 여부 추적"으로 동작하여 ABA 문제에 면역이지만, spurious failure가 발생할 수 있다. |
| **LDREX/STREX** | ARMv7까지의 LL/SC 구현. ARMv8.1 LSE에서 하드웨어 CAS로 대체되었다. |
| **LSE (Large System Extensions)** | ARMv8.1에서 도입된 하드웨어 원자적 명령어 세트. 단일 CAS 명령(`CAS`, `CASP`)을 제공한다. |
| **LOCK prefix** | x86에서 버스/캐시 잠금을 통해 원자성을 보장하는 명령어 접두사. |

### 2.3 동시성 이론 용어

| 용어 | 정의 |
|------|------|
| **Atomic Operation** | 중간 상태가 다른 스레드에 관찰되지 않는, 분할 불가능한 연산. |
| **Lock-Free** | 전체 시스템에서 최소 하나의 스레드가 항상 진행(progress)을 보장하는 알고리즘. 개별 스레드의 기아(starvation)는 가능하다. |
| **Wait-Free** | 모든 스레드가 유한 단계 내에 작업을 완료하는 알고리즘. Lock-Free보다 강한 보장이다. |
| **Obstruction-Free** | 단일 스레드만 실행될 때 진행을 보장하는 알고리즘. 가장 약한 비차단(non-blocking) 보장이다. |
| **Linearizability** | 동시적 연산들이 마치 어떤 순서로 하나씩 실행된 것처럼 보이는 정확성 기준. 각 연산의 효과가 호출과 응답 사이 특정 시점(linearization point)에서 발생한 것으로 관찰된다. (Herlihy & Wing, 1990) |
| **Consensus Number** | 특정 원자적 연산으로 합의를 달성할 수 있는 최대 프로세스 수. (Herlihy, 1991) |
| **Memory Barrier (Fence)** | CPU의 명령어 재배치를 제한하여 메모리 가시성을 보장하는 명령어. |
| **Cache Coherence** | 다중 CPU 코어의 캐시 간 데이터 일관성을 유지하는 프로토콜. MESI가 대표적이다. |
| **MESI Protocol** | Modified-Exclusive-Shared-Invalid 네 상태로 캐시 라인의 소유권과 일관성을 관리하는 프로토콜. |
| **Acquire Semantics** | 이 연산 이후의 읽기/쓰기가 이 연산 이전으로 재배치되지 않음을 보장. |
| **Release Semantics** | 이 연산 이전의 읽기/쓰기가 이 연산 이후로 재배치되지 않음을 보장. |
| **Sequential Consistency** | 모든 스레드가 동일한 전역 순서로 연산을 관찰하는 가장 강한 메모리 모델. |

### 2.4 데이터베이스/분산 시스템 용어

| 용어 | 정의 |
|------|------|
| **Optimistic Locking** | 충돌이 드물다고 가정하고, 커밋 시점에 Version Column 등으로 검증하는 전략. CAS의 개념적 전략과 동일하다. |
| **Pessimistic Locking** | 충돌을 사전에 방지하기 위해 `SELECT FOR UPDATE` 등으로 잠금을 먼저 획득하는 전략. |
| **MVCC (Multi-Version Concurrency Control)** | 데이터의 여러 버전을 유지하여 읽기와 쓰기가 서로 차단하지 않도록 하는 기법. |
| **SSI (Serializable Snapshot Isolation)** | MVCC 기반에서 직렬화 가능성을 보장하는 격리 수준. PostgreSQL 9.1+에서 지원한다. |
| **OCC (Optimistic Concurrency Control)** | Kung & Robinson(1981)이 제안한 DB 트랜잭션 기법. Read -> Validate -> Write 3단계. CAS 철학의 DB 적용이다. |
| **Conditional Write** | DynamoDB의 `ConditionExpression`, etcd의 `Txn Compare` 등 분산 저장소에서의 CAS 구현. |
| **Idempotency Key** | 동일 요청의 중복 처리를 방지하기 위한 고유 키. DB unique constraint와 결합하면 분산 CAS가 된다. |

---

## 3. 등장 배경과 이유

### 3.1 멀티프로세서의 근본 문제

단일 프로세서 시대에는 **인터럽트 비활성화(disable interrupts)**만으로 임계 구간(critical section)을 보호할 수 있었다. 그러나 멀티프로세서가 등장하면서 이 방법은 즉시 무력화되었다. 인터럽트를 비활성화해도 **다른 CPU 코어의 접근을 차단할 수 없기 때문**이다.

```
단일 CPU:
    인터럽트 비활성화 → 안전한 임계구간 → 인터럽트 활성화
    (다른 실행 주체가 없으므로 충분)

멀티 CPU:
    CPU 0: 인터럽트 비활성화 → 메모리 접근
    CPU 1: (인터럽트와 무관하게) 동시에 동일 메모리 접근  ← 충돌!
```

이 문제를 해결하려면 **하드웨어 수준의 원자적 연산**이 필수적이다. CAS는 이 요구에 대한 가장 강력하고 범용적인 답이다.

### 3.2 Lock 기반 동기화의 한계

Lock (Mutex, Semaphore)은 가장 직관적인 동시성 제어 수단이지만, 근본적인 한계를 가진다:

| 문제 | 설명 | 실제 사고 |
|------|------|-----------|
| **Deadlock** | 두 스레드가 서로의 Lock을 기다리며 영원히 멈춤 | 다수의 생산 환경 장애 |
| **Priority Inversion** | 저우선순위 스레드가 Lock을 보유하여 고우선순위 스레드가 대기 | **Mars Pathfinder (1997)**: 저우선순위 태스크가 뮤텍스를 보유하여 고우선순위 제어 태스크가 대기, 시스템 리셋 반복 발생 |
| **Convoy Effect** | Lock 보유 스레드가 선점(preempt)되면 다른 모든 스레드가 연쇄 대기 | 고부하 웹 서버의 갑작스런 응답 지연 |
| **Kernel Transition** | Lock 경합 시 사용자 모드 -> 커널 모드 전환 비용 (~수 us) | HFT 시스템에서 허용 불가 |
| **확장성 한계** | 코어 수 증가에 따라 Lock 경합이 비선형적으로 증가 | 다수 코어 서버에서 성능 역전 현상 |

CAS 기반 Lock-Free 알고리즘은 이러한 문제를 **구조적으로 회피**한다:

- Deadlock: Lock을 사용하지 않으므로 불가능
- Priority Inversion: 스레드 간 의존성이 없으므로 불가능
- Convoy Effect: 선점된 스레드가 다른 스레드를 차단하지 않음
- Kernel Transition: 사용자 공간에서만 동작 (경합 시에도)

### 3.3 Lock-Free가 필수인 영역

| 영역 | 요구사항 | CAS 활용 |
|------|----------|----------|
| **실시간 시스템** | 결정론적 지연 시간 | Lock-free 자료구조 |
| **HFT (High-Frequency Trading)** | 나노초 단위 레이턴시 | Lock-free 큐, 원자적 상태 전이 |
| **OS 커널** | 인터럽트 핸들러에서 Lock 사용 불가 | Spinlock CAS, RCU |
| **가비지 컬렉터** | Stop-the-World 최소화 | 포인터 CAS, 동시적 마킹 |
| **데이터베이스 엔진** | 높은 동시성, 낮은 지연 | Lock-free 버퍼 관리, MVCC |

### 3.4 데이터베이스에서의 CAS 필요성

전통적인 `SELECT FOR UPDATE`는 행(row)을 잠그고 트랜잭션이 끝날 때까지 보유한다. 이는 다음과 같은 비용을 발생시킨다:

- 잠금 대기 시간 (다른 트랜잭션 차단)
- DB 커넥션 점유 시간 증가
- 동시 처리량(throughput) 감소

Optimistic Locking (Version Column + `WHERE version = expected_version`)은 CAS 철학을 DB에 적용하여 **잠금 없이 동시성을 제어**한다. 충돌이 드문 경우 성능이 월등히 높다.

### 3.5 분산 시스템의 빌딩 블록

분산 합의(Consensus) 프로토콜은 본질적으로 **분산 CAS**이다:

- **Paxos**: Proposer가 "이 값이 아직 결정되지 않았다면(Compare), 내 값으로 결정하라(Swap)"
- **Raft**: Leader가 "현재 term과 log index가 이것이면(Compare), 이 엔트리를 추가하라(Swap)"
- **etcd Txn**: `Compare(key.version == expected) -> Then(Put(key, value))`

CAS는 공유 메모리에서의 합의를 가능하게 하며, 이 패턴이 네트워크를 통해 분산 시스템으로 확장된 것이 현대 분산 합의 프로토콜이다.

---

## 4. 역사적 기원과 진화

### 4.1 연대표

```
1964 ─── IBM System/360 Test-and-Set
         │  최초의 하드웨어 원자적 동기화 명령어
         │
1970 ─── IBM System/370 CS/CDS
         │  ★ CAS 최초 하드웨어 구현
         │  CS = Compare and Swap (32-bit)
         │  CDS = Compare Double and Swap (64-bit)
         │
1974 ─── Lamport Bakery Algorithm
         │  CAS 없이도 상호배제 가능함을 증명
         │  (단, 실용적이지 않음)
         │
1981 ─── Kung & Robinson OCC
         │  DB 트랜잭션에 CAS적 사고(낙관적 동시성)를 최초 적용
         │  Read → Validate → Write 3단계
         │
1983 ─── IBM System/370 매뉴얼
         │  CDS 기반 non-blocking 스택 예제 최초 문서화
         │
1985 ─── FLP 불가능성 정리
         │  비동기 분산 환경에서 결정론적 합의 불가능 증명
         │  (CAS는 공유메모리 모델이라 FLP 적용 안 됨)
         │
1986 ─── Treiber Stack
         │  ★ CAS 기반 최초의 실용적 lock-free 자료구조
         │
1989 ─── Intel 80486 CMPXCHG
         │  x86 아키텍처에 CAS 도입
         │
1990 ─── Herlihy & Wing Linearizability
         │  동시적 연산의 정확성 기준 정립
         │
1991 ─── Herlihy Wait-Free Synchronization
         │  ★★ CAS의 Consensus Number = ∞ 증명
         │  Universal Construction 이론
         │
1993 ─── Intel Pentium CMPXCHG8B (64-bit)
         │
1996 ─── Michael-Scott Queue
         │  ★ 두 포인터(head/tail) 독립 CAS
         │  Java ConcurrentLinkedQueue의 직접 기반
         │
2001 ─── Harris Non-Blocking Linked List
         │  포인터 하위비트를 논리적 삭제 마커로 활용
         │
2003 ─── x86-64 CMPXCHG16B (128-bit)
         │
2004 ─── Java 5 java.util.concurrent.atomic
         │  ★ Doug Lea, JSR-166
         │  AtomicInteger, AtomicLong, AtomicReference
         │
2004 ─── Hazard Pointers (Maged Michael)
         │  Lock-free 메모리 재확보 + ABA 방지
         │
2011 ─── C++11 std::atomic
         │  compare_exchange_weak/strong
         │  6단계 memory_order
         │
2013 ─── etcd v1 CAS API
         │
2014 ─── Raft 논문 (Ongaro & Ousterhout)
         │
2017 ─── ARMv8.1 LSE
         │  ★ ARM에 하드웨어 CAS 명령 추가
         │  LL/SC → 단일 CAS 명령으로 진화
         │
2020+ ── DynamoDB Conditional Write 강화
         │  ReturnValuesOnConditionCheckFailure (2023)
         │
2024 ─── Redis 8.4 native CAS
         │  SET IFEQ/IFGT 명령어 추가
```

### 4.2 핵심 전환점

**1970: IBM System/370 CS/CDS** - CAS의 탄생. IBM 엔지니어들이 멀티프로세서 시스템의 동기화를 위해 하드웨어 수준의 "비교 후 교환" 개념을 최초로 구현했다. 이 설계가 이후 모든 CAS 구현의 원형이 되었다.

**1991: Herlihy의 증명** - CAS의 이론적 지위 확립. CAS가 임의 개수의 프로세스 간 합의를 달성할 수 있음을 증명하여, CAS가 **범용(universal) 동기화 원시연산**임을 확인했다. 이 논문 이후 CAS 기반 lock-free 알고리즘 연구가 폭발적으로 증가했다.

**2004: Java 5 java.util.concurrent** - CAS의 대중화. Doug Lea가 설계한 `java.util.concurrent.atomic` 패키지가 CAS를 고수준 언어 개발자에게 직접 노출하여, CAS 기반 프로그래밍이 주류가 되었다.

**2017: ARMv8.1 LSE** - 모바일/서버 생태계 변화. ARM 서버(AWS Graviton 등)가 성장하면서, LL/SC 기반의 성능 한계를 극복하기 위해 하드웨어 CAS를 도입했다. MySQL on ARM LSE에서 50% 성능 향상이 관찰되었다.

---

## 5. 학술적/이론적 배경

### 5.1 Consensus Number 계층 (Herlihy, 1991)

Herlihy의 "Wait-Free Synchronization" 논문은 동시성 프로그래밍의 이론적 기반을 확립했다. 핵심 기여는 **Consensus Number** 개념이다: 특정 원자적 연산으로 **n개 프로세스의 합의(consensus)**를 달성할 수 있는 최대 n값.

```
Consensus Number 계층도:

  ∞  ┃  CAS, LL/SC, Memory-to-Memory Swap
     ┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ┃  → 임의 개수 프로세스 합의 가능
     ┃  → Universal: 모든 concurrent object 구현 가능
     ┃
  2  ┃  Test-and-Set (TAS), Fetch-and-Add (FAA)
     ┃  Read-Modify-Write (RMW)
     ┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ┃  → 2개 프로세스까지만 합의 가능
     ┃  → 3개 이상에서는 wait-free 합의 불가
     ┃
  1  ┃  Atomic Read, Atomic Write
     ┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ┃  → 합의 불가 (1개 = 자기 자신뿐)
     ┃  → Reader/Writer만 가능
```

**핵심 의미**: TAS나 FAA로는 3개 이상의 프로세스가 참여하는 lock-free 큐, 스택, 리스트를 구현할 수 없다. **오직 CAS(또는 LL/SC)만이 범용(universal) 비차단 자료구조를 가능하게 한다.**

#### Universal Construction

CAS의 consensus number가 무한(∞)이라는 것은 곧 **Universal Construction**이 가능하다는 의미이다. 즉, CAS를 이용하면 **어떤 순차적(sequential) 자료구조라도 wait-free 버전으로 변환**할 수 있다.

```
Universal Construction 의사코드:

    shared: announce[N]   // 각 스레드의 요청
    shared: head          // 연산 로그의 헤드

    perform(op):
        announce[myId] = op
        while op not applied:
            // 미적용 연산 수집
            seq = head.load()
            // 새 노드 생성 (미적용 연산 포함)
            new_node = Node(seq, pending_ops)
            // CAS로 헤드 교체 시도
            CAS(&head, seq, new_node)
            // 성공이든 실패든, 최신 로그 적용
            apply_all_pending()
```

이론적으로는 모든 것을 구현할 수 있지만, 실제 성능을 위해서는 자료구조별로 특화된 CAS 알고리즘(Treiber Stack, Michael-Scott Queue 등)을 사용한다.

### 5.2 Linearizability (Herlihy & Wing, 1990)

CAS 연산의 정확성은 **Linearizability**로 정의된다.

**정의**: 모든 동시적 연산이 마치 어떤 순서로 하나씩 실행된 것처럼 보이며, 각 연산의 효과는 **호출(invocation)과 응답(response) 사이의 한 시점(linearization point)**에서 순간적으로 발생한 것으로 관찰되어야 한다.

CAS 연산에서 linearization point는:
- **성공 시**: 메모리의 값이 실제로 교체되는 시점
- **실패 시**: 메모리의 값이 기대값과 다름을 확인하는 시점

이 성질이 CAS를 동시적 환경에서 **안전하게 조합 가능한(composable)** 기본 블록으로 만든다.

### 5.3 Treiber Stack (1986)

R. Kent Treiber가 IBM 연구 보고서에서 제시한 CAS 기반 최초의 실용적 lock-free 자료구조이다.

```java
// Treiber Stack - CAS 기반 Lock-Free 스택

class TreiberStack<T> {
    AtomicReference<Node<T>> top = new AtomicReference<>(null);

    static class Node<T> {
        final T value;
        Node<T> next;
        Node(T value) { this.value = value; }
    }

    // Push: 새 노드의 next를 현재 top으로 설정, CAS로 top 교체
    void push(T value) {
        Node<T> newNode = new Node<>(value);
        Node<T> oldTop;
        do {
            oldTop = top.get();              // 1. 현재 top 읽기
            newNode.next = oldTop;           // 2. 새 노드 연결
        } while (!top.compareAndSet(         // 3. CAS로 top 교체
                    oldTop, newNode));        //    실패시 1로 재시도
    }

    // Pop: 현재 top을 읽고, CAS로 top을 top.next로 교체
    T pop() {
        Node<T> oldTop;
        Node<T> newTop;
        do {
            oldTop = top.get();              // 1. 현재 top 읽기
            if (oldTop == null) return null;  // 2. 비어있으면 null
            newTop = oldTop.next;            // 3. 다음 노드
        } while (!top.compareAndSet(         // 4. CAS로 top 교체
                    oldTop, newTop));         //    실패시 1로 재시도
        return oldTop.value;
    }
}
```

**핵심 패턴**: Read -> Modify -> CAS -> Retry. 이 패턴은 이후 모든 CAS 기반 알고리즘의 기본 템플릿이 되었다.

### 5.4 Michael-Scott Queue (1996)

Maged Michael과 Michael Scott이 제안한 lock-free 큐로, Java의 `ConcurrentLinkedQueue`의 직접적 기반이다.

핵심 혁신: **head와 tail을 독립적인 CAS로 관리**하여, enqueue와 dequeue가 서로 간섭하지 않는다.

```
Michael-Scott Queue 구조:

    head                          tail
      ↓                            ↓
    [sentinel] → [A] → [B] → [C] → null

    Enqueue: tail에 CAS로 새 노드 연결
    Dequeue: head에 CAS로 sentinel 전진
    → head/tail 독립 CAS → enqueue/dequeue 병렬 가능
```

### 5.5 OCC와 CAS의 관계 (Kung & Robinson, 1981)

Kung과 Robinson의 Optimistic Concurrency Control은 CAS의 철학을 DB 트랜잭션에 적용한 최초의 연구이다:

| OCC 단계 | CAS 대응 |
|----------|----------|
| **Read Phase**: 데이터를 로컬 복사 | CAS Loop의 `oldValue = read()` |
| **Validation Phase**: 다른 트랜잭션과 충돌 여부 검증 | CAS의 `Compare (*V == expected?)` |
| **Write Phase**: 검증 성공 시 결과 반영 | CAS의 `Swap (*V = desired)` |

이 구조가 현대 DB의 Version Column 패턴으로 직결된다:

```sql
-- OCC/CAS 패턴의 SQL 구현
UPDATE orders
SET    status = 'CONFIRMED', version = version + 1
WHERE  id = :orderId
  AND  version = :expectedVersion;   -- Compare
-- affected rows == 1 이면 Swap 성공
-- affected rows == 0 이면 Compare 실패 → 재시도
```

### 5.6 FLP 불가능성과 CAS

Fischer, Lynch, Paterson(1985)의 FLP 정리는 "비동기 분산 환경에서 하나의 프로세스라도 장애가 나면 결정론적 합의가 불가능"함을 증명했다.

그러나 **CAS는 공유 메모리(shared memory) 모델**에서 동작하므로 FLP의 가정(비동기 메시지 전달)이 직접 적용되지 않는다. 공유 메모리에서 CAS는 무한 수의 프로세스 간 합의를 달성할 수 있으며, 이것이 Herlihy(1991)의 증명 내용이다.

분산 시스템에서는 FLP를 우회하기 위해 **타이머, 리더 선출, 무작위화** 등의 기법과 함께 "분산 CAS" (Paxos, Raft)를 사용한다.

---

## 6. CAS 구현 레벨별 분석

### 6.1 레벨별 개관

| 레벨 | 기술 | 메커니즘 | 지연 |
|------|------|----------|------|
| **CPU** | CMPXCHG, ARM CAS | 하드웨어 원자적 명령어 | ~ns |
| **OS** | futex, spinlock, RCU | Userspace CAS + 커널 폴백 | ~us |
| **런타임** | LongAdder, ConcurrentHashMap | Cell 분산 + CAS | 수십~수백 ns |
| **분산 메모리** | Redis | 단일 스레드 직렬화 | sub-ms |
| **분산 KV** | etcd, DynamoDB | 네트워크 CAS | 1-10 ms |
| **분산 SQL** | CockroachDB, TiDB | Raft + MVCC | 10-100 ms |
| **글로벌 DB** | Spanner | TrueTime + Commit Wait | 수 ms |
| **애플리케이션** | Stripe, Kafka | DB unique + version | network |

### 6.2 CPU 레벨: x86 CMPXCHG

x86 아키텍처에서 CAS는 `LOCK CMPXCHG` 명령어로 구현된다:

```nasm
; x86-64 CAS: LOCK CMPXCHG
; 입력: RAX = expected, RBX = desired, [RDI] = target address
; 동작: if [RDI] == RAX then [RDI] = RBX, ZF=1
;        else RAX = [RDI], ZF=0

    mov  rax, [expected]    ; 기대값을 RAX에 로드
    mov  rbx, [desired]     ; 새 값을 RBX에 로드
    lock cmpxchg [rdi], rbx ; 원자적 비교-교환
    jz   .success           ; ZF=1 이면 성공
    ; RAX에 현재 메모리 값이 들어있음 (실패 시)
```

**LOCK prefix의 동작**:

```
LOCK CMPXCHG 실행 흐름 (MESI 프로토콜):

  CPU 0                        CPU 1
    │                            │
    ├─ 캐시라인을 Exclusive      │
    │  상태로 획득               │
    │  (다른 CPU의 캐시라인      │
    │   Invalidate)              │
    │                            ├─ Invalidate 수신
    ├─ Compare 수행              │   캐시라인 무효화
    ├─ (일치 시) Swap 수행       │
    ├─ Modified 상태로 전환      │
    │                            │
    └─ 완료                      ├─ 다시 접근 시
                                 │   캐시 미스 → 리로드
```

#### MESI 프로토콜과 CAS

```
MESI Cache Coherence 상태 전이도:

              ┌──────────┐
     Read     │          │  Remote Write
    ┌────────→│ Shared   │←────────────┐
    │         │  (S)     │             │
    │         └────┬─────┘             │
    │              │ Local Write       │
    │              ▼                   │
┌───┴──────┐  ┌──────────┐    ┌───────┴──────┐
│          │  │          │    │              │
│ Invalid  │  │Exclusive │    │  Modified    │
│  (I)     │  │  (E)     │───→│   (M)        │
│          │  │          │    │              │
└──────────┘  └──────────┘    └──────────────┘
  ↑                                  │
  └──────── Remote Read/Write ───────┘
            (Write-Back + Invalidate)

CAS가 성공하려면:
1. 해당 캐시라인을 Exclusive(E) 또는 Modified(M) 상태로 확보
2. 다른 코어의 동일 캐시라인을 Invalid(I) 상태로 전환
3. Compare와 Swap을 원자적으로 수행
4. Modified(M) 상태로 전환
```

#### CMPXCHG8B/CMPXCHG16B (Double-Width CAS)

```
CMPXCHG8B:  64-bit CAS (Pentium, 1993)
            EDX:EAX (expected) vs [mem]
            ECX:EBX (desired)

CMPXCHG16B: 128-bit CAS (x86-64, 2003)
            RDX:RAX (expected) vs [mem]
            RCX:RBX (desired)
            → Tagged Pointer (pointer + version counter) 구현에 사용
            → ABA 문제 해결의 핵심
```

### 6.3 CPU 레벨: ARM LL/SC vs LSE CAS

ARM은 두 가지 경로를 가진다:

**LL/SC (ARMv7, ARMv8.0)**:

```
LL/SC 동작 원리:

    Thread A                    Thread B
    │                           │
    ├─ LDREX R0, [addr]         │
    │  (Load-Linked:            │
    │   값을 읽고 "관찰"        │
    │   마커 설정)              │
    │                           ├─ STR [addr], 99
    │                           │  (일반 쓰기로도
    ├─ STREX R1, R2, [addr]    │   마커가 해제됨)
    │  (Store-Conditional:      │
    │   마커가 아직 유효한가?)  │
    │  → R1 = 1 (실패!)        │
    │  (값 비교가 아닌          │
    │   "변경 여부"를 추적      │
    │   → ABA 면역!)           │
```

**LL/SC vs CAS 비교**:

| 특성 | CAS (x86 CMPXCHG) | LL/SC (ARM LDREX/STREX) |
|------|-------------------|-------------------------|
| ABA 문제 | **있음** | **없음** (변경 추적) |
| Spurious Failure | 없음 | **있음** (컨텍스트 스위치, 캐시라인 축출 등) |
| 구현 | 단일 명령어 | 두 명령어 쌍 |
| 성능 (저경합) | 우수 | 유사 |
| 성능 (고경합, NUMA) | 보통 | **LL/SC가 최대 20배 빠를 수 있음** (ARM 연구 결과) |

**LSE CAS (ARMv8.1+)**:

```
// ARMv8.1 LSE: 단일 하드웨어 CAS 명령어
CAS  X0, X1, [X2]    // 32/64-bit CAS
CASP X0, X1, X2, X3, [X4]  // 128-bit CAS (pair)

// LL/SC 대비 장점:
// - 단일 명령어 → μop 감소
// - 하드웨어 캐시 프로토콜 최적화
// - 단일 코어에서 특히 유리
//
// LL/SC 대비 단점:
// - ABA 문제 발생 가능
// - 고경합 NUMA 환경에서 LL/SC보다 느릴 수 있음
```

**실측 결과**: MySQL on ARM LSE에서 약 50% 성능 향상이 관찰되었다 (mysqlonarm.github.io).

### 6.4 OS 레벨: Futex 2-Phase 설계

Linux Futex (Fast Userspace muTEX)는 CAS를 핵심 빌딩 블록으로 사용하는 하이브리드 잠금이다:

```
Futex 2-Phase 설계:

Phase 1: Userspace CAS (빠른 경로, 경합 없을 때)
┌─────────────────────────────────────┐
│  futex_value = 0 (unlocked)        │
│                                     │
│  Thread A:                          │
│    CAS(&futex_value, 0, 1)         │
│    → 성공! Lock 획득               │
│    → 커널 호출 없음, ~ns           │
│                                     │
│  Thread A:                          │
│    STORE(&futex_value, 0)          │
│    → Unlock                         │
└─────────────────────────────────────┘

Phase 2: Kernel Fallback (느린 경로, 경합 시)
┌─────────────────────────────────────┐
│  futex_value = 1 (locked)          │
│                                     │
│  Thread B:                          │
│    CAS(&futex_value, 0, 1)         │
│    → 실패! (현재값 = 1)            │
│    → futex_value를 2로 설정        │
│      (waiter 존재 표시)            │
│    → syscall FUTEX_WAIT            │
│    → 커널이 Thread B를 sleep       │
│                                     │
│  Thread A (unlock 시):              │
│    if futex_value == 2:            │
│      syscall FUTEX_WAKE            │
│      → Thread B 깨움              │
└─────────────────────────────────────┘

핵심: 경합이 없으면 커널 호출 0회
      경합이 있을 때만 커널로 전환
      → CAS가 "빠른 경로"의 핵심
```

### 6.5 OS 레벨: Linux Kernel RCU

RCU (Read-Copy-Update)는 읽기 경로에서 CAS조차 사용하지 않는 극한의 최적화이다:

```
RCU 동작:

Reader:                          Writer:
  ptr = rcu_dereference(gptr)      new = kmalloc(...)
  // 포인터 읽기 (CAS 없음!)       *new = *old + modifications
  // 메모리 배리어만 사용           rcu_assign_pointer(gptr, new)
  use(ptr->data)                   // ★ 포인터 CAS 한 번
  // 읽기 완료                      synchronize_rcu()
                                    // 모든 reader 완료 대기
                                    kfree(old)

핵심: 읽기 경로에 Lock도 CAS도 없음
      쓰기는 포인터 CAS 단 한 번
      → 읽기 >> 쓰기 워크로드에 최적
```

### 6.6 런타임 레벨: Java CAS

#### AtomicInteger CAS Loop

```java
import java.util.concurrent.atomic.AtomicInteger;

public class CASExample {

    private final AtomicInteger counter = new AtomicInteger(0);

    // CAS Loop 패턴: Read → Modify → CAS → Retry
    public int incrementAndGet() {
        int oldValue, newValue;
        do {
            oldValue = counter.get();          // 1. Read: 현재값 읽기
            newValue = oldValue + 1;           // 2. Modify: 새 값 계산
        } while (!counter.compareAndSet(       // 3. CAS: 원자적 교체 시도
                    oldValue, newValue));       //    실패 시 1로 재시도
        return newValue;
    }

    // Java 8+ 함수형 스타일 (내부적으로 동일한 CAS Loop)
    public int incrementFunctional() {
        return counter.updateAndGet(v -> v + 1);
    }

    // Java 9+ compareAndExchange: 이전 값 반환
    public boolean trySetIfExpected(int expected, int desired) {
        int witness = counter.compareAndExchange(expected, desired);
        return witness == expected;
        // witness != expected 이면 witness가 현재 실제 값
        // → 다음 CAS 시도에서 witness를 expected로 사용 가능
    }
}
```

#### LongAdder / Striped64 아키텍처

높은 경합(contention) 환경에서 단일 `AtomicLong`은 CAS 실패-재시도 루프로 인해 성능이 급격히 저하된다. Doug Lea의 `LongAdder`는 이를 **Cell 분산** 전략으로 해결한다:

```
Striped64 아키텍처:

                    LongAdder
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       base값        cells[]          │
     (AtomicLong)   (CAS 분산)       │
          │             │             │
          │    ┌────┬───┴───┬────┐   │
          │    │    │       │    │   │
          │  Cell0 Cell1  Cell2 Cell3│
          │  (CAS) (CAS)  (CAS)(CAS)│
          │    │    │       │    │   │
          │    └────┴───┬───┴────┘   │
          │             │             │
          └─────────────┼─────────────┘
                        │
                    sum() 호출 시
                    base + Σ cells[i]

    Thread 0 ──→ CAS(Cell0) ──→ 성공! (다른 스레드와 경합 없음)
    Thread 1 ──→ CAS(Cell1) ──→ 성공! (다른 Cell이므로)
    Thread 2 ──→ CAS(Cell2) ──→ 성공!
    Thread 3 ──→ CAS(Cell3) ──→ 성공!

    vs AtomicLong:
    Thread 0,1,2,3 ──→ CAS(동일 변수) ──→ 3개 실패, 재시도...

    결과: LongAdder가 AtomicLong 대비 32~93배 빠름 (고경합 환경)
```

**@Contended 어노테이션과 False Sharing 방지**:

```java
// Cell 클래스 (Striped64 내부)
@jdk.internal.vm.annotation.Contended  // 캐시라인 패딩
static final class Cell {
    volatile long value;
    // @Contended가 없으면 인접 Cell들이 같은 캐시라인에 위치
    // → False Sharing: 한 Cell의 CAS가 다른 Cell의 캐시라인도 무효화
}
```

#### ConcurrentHashMap의 CAS

```java
// Java ConcurrentHashMap.putVal() 핵심 로직 (간략화)
if (tab[i] == null) {
    // ★ 빈 버킷: CAS로 삽입 (Lock 없음!)
    if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
        break;
} else {
    // 비어있지 않은 버킷: synchronized (해당 버킷만)
    synchronized (f) {
        // 체이닝/트리 조작
    }
}
// 핵심: 빈 버킷 삽입은 CAS로, 충돌 시에만 세밀한 Lock
```

### 6.7 데이터베이스 레벨

#### Version Column CAS (SQL)

```sql
-- 1. 데이터 읽기 (Read Phase)
SELECT id, name, status, version
FROM   orders
WHERE  id = 42;
-- 결과: id=42, name='Widget', status='PENDING', version=3

-- 2. CAS 업데이트 (Compare & Swap)
UPDATE orders
SET    status = 'CONFIRMED',
       version = version + 1        -- Swap: 버전 증가
WHERE  id = 42
  AND  version = 3;                 -- Compare: 기대 버전 확인

-- 3. 결과 확인
-- affected_rows == 1 → CAS 성공 (version 3→4)
-- affected_rows == 0 → CAS 실패 (다른 트랜잭션이 먼저 변경)
--                       → 1부터 재시도
```

#### 상태 머신 + CAS 조합

```sql
-- 상태 전이 규칙이 있는 경우: status + version 동시 검증
-- 주문 상태: PENDING → CONFIRMED → SHIPPED → DELIVERED

UPDATE orders
SET    status = 'CONFIRMED',
       version = version + 1
WHERE  id = :orderId
  AND  status = 'PENDING'           -- 상태 전이 규칙 검증
  AND  version = :expectedVersion;  -- 동시성 검증

-- status='SHIPPED'인 주문을 'CONFIRMED'로 되돌리는 것을 방지
-- + 동시 업데이트도 방지
-- = exactly-once 상태 전이 보장
```

#### JPA @Version + OptimisticLockException

```java
@Entity
public class Order {
    @Id
    private Long id;

    private String status;

    @Version  // JPA가 CAS를 자동 관리
    private Long version;
    // UPDATE 시 자동으로 WHERE version = :current 추가
    // 실패 시 OptimisticLockException 발생
}

// 서비스 계층
@Service
public class OrderService {

    @Retryable(
        retryFor = OptimisticLockException.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 150, multiplier = 2)
    )
    @Transactional
    public void confirmOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow();
        order.setStatus("CONFIRMED");
        orderRepository.save(order);
        // JPA가 자동으로:
        // UPDATE orders SET status='CONFIRMED', version=version+1
        // WHERE id=:id AND version=:currentVersion
        // 실패 시 OptimisticLockException → @Retryable이 재시도
    }
}
```

### 6.8 분산 KV 레벨: etcd

```go
// etcd Txn (Transaction) = 분산 CAS API

import (
    clientv3 "go.etcd.io/etcd/client/v3"
)

func distributedCAS(cli *clientv3.Client, key, expectedVal, newVal string) (bool, error) {
    // Txn = If(Compare) Then(Op) Else(Op)
    // 이것이 etcd의 CAS 패턴이다
    txnResp, err := cli.Txn(context.TODO()).
        // Compare: 현재 값이 기대값과 일치하는지
        If(clientv3.Compare(clientv3.Value(key), "=", expectedVal)).
        // Then (Swap): 일치하면 새 값으로 교체
        Then(clientv3.OpPut(key, newVal)).
        // Else: 불일치 시 현재 값 읽기 (선택사항)
        Else(clientv3.OpGet(key)).
        Commit()

    if err != nil {
        return false, err
    }
    return txnResp.Succeeded, nil  // true = CAS 성공
}

// Version 기반 CAS (더 안전한 패턴)
func versionBasedCAS(cli *clientv3.Client, key, newVal string, expectedVersion int64) (bool, error) {
    txnResp, err := cli.Txn(context.TODO()).
        // ModRevision = etcd 내부 버전. 값이 아닌 버전으로 비교
        If(clientv3.Compare(clientv3.ModRevision(key), "=", expectedVersion)).
        Then(clientv3.OpPut(key, newVal)).
        Else(clientv3.OpGet(key)).
        Commit()

    if err != nil {
        return false, err
    }
    return txnResp.Succeeded, nil
}
```

### 6.9 분산 KV 레벨: DynamoDB

```python
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Orders')

def conditional_update_order(order_id: str, new_status: str, expected_version: int):
    """DynamoDB ConditionExpression = 분산 CAS"""
    try:
        response = table.update_item(
            Key={'orderId': order_id},
            # Swap: 새 값 설정
            UpdateExpression='SET #status = :new_status, version = :new_version',
            # Compare: 기대 버전과 일치하는지 확인
            ConditionExpression='version = :expected_version',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':new_status': new_status,
                ':new_version': expected_version + 1,
                ':expected_version': expected_version
            },
            # 2023 신기능: 실패 시 현재 값 반환
            ReturnValuesOnConditionCheckFailure='ALL_OLD'
        )
        return True, response
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            # CAS 실패: 다른 요청이 먼저 변경함
            current_item = e.response.get('Item')  # 현재 값 (2023+)
            return False, current_item
        raise


def cas_with_retry(order_id: str, new_status: str, max_retries: int = 3):
    """CAS + Exponential Backoff 재시도"""
    import time, random

    for attempt in range(max_retries):
        # 1. Read: 현재 상태 읽기
        item = table.get_item(Key={'orderId': order_id})['Item']
        current_version = item['version']

        # 2. CAS: 조건부 업데이트 시도
        success, result = conditional_update_order(
            order_id, new_status, current_version
        )

        if success:
            return True

        # 3. Backoff: 실패 시 지수적 대기 + 지터
        delay = min(0.15 * (2 ** attempt), 5.0)  # 150ms, 300ms, 600ms...
        jitter = random.uniform(0, delay * 0.5)
        time.sleep(delay + jitter)

    return False  # 최대 재시도 초과
```

### 6.10 분산 메모리 레벨: Redis

```lua
-- Redis Lua Script CAS (Redis < 8.4)
-- KEYS[1] = key, ARGV[1] = expected, ARGV[2] = desired

local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
    redis.call('SET', KEYS[1], ARGV[2])
    return 1  -- CAS 성공
else
    return 0  -- CAS 실패
end

-- 호출 예시:
-- EVAL "위 스크립트" 1 mykey "expected_value" "new_value"
```

```bash
# Redis 8.4+ native CAS 명령어
# SET key value IFEQ expected_value
SET order:42:status "CONFIRMED" IFEQ "PENDING"
# → OK (성공) 또는 nil (실패)

# IFGT: 현재값보다 클 때만 설정 (단조증가 보장)
SET counter "100" IFGT "99"
```

```
Redis CAS 진화:

  WATCH + MULTI/EXEC (초기)
  │  - Optimistic Locking
  │  - 클라이언트가 WATCH한 키가 변경되면 EXEC 실패
  │  - 문제: 레이스 윈도우, 복잡한 클라이언트 로직
  │
  ↓
  Lua Script CAS (2012+)
  │  - 서버 측 원자적 실행
  │  - 사실상의 표준 CAS 패턴
  │
  ↓
  SET IFEQ/IFGT (Redis 8.4, 2024)
     - 네이티브 명령어
     - Lua 오버헤드 제거
     - 가장 깔끔한 CAS
```

---

## 7. 대안 비교

### 7.1 하드웨어 원시 연산 비교

| 원시 연산 | Consensus Number | ABA 문제 | Spurious Failure | 주요 용도 |
|-----------|-----------------|----------|------------------|-----------|
| **TAS (Test-and-Set)** | 2 | 없음 | 없음 | 단순 Spinlock |
| **FAA (Fetch-and-Add)** | 2 | 없음 | 없음 | 단조 카운터, 시퀀서 |
| **CAS** | **∞** | **있음** | 없음 | 범용 Lock-Free 자료구조 |
| **LL/SC** | ∞ (조건부) | **없음** | **있음** | ARM/MIPS/PowerPC/RISC-V |
| **DWCAS (CMPXCHG16B)** | ∞ | 없음 (tag 포함 시) | 없음 | Tagged Pointer, ABA 해결 |

**핵심 차이**: TAS와 FAA는 consensus number가 2이므로 3개 이상의 프로세스가 참여하는 lock-free 자료구조를 구현할 수 없다. CAS만이 범용 비차단 알고리즘의 기반이 될 수 있다.

### 7.2 소프트웨어 동기화 기법 비교

| 기법 | 차단 여부 | 경합 시 동작 | 최적 사용처 | 단점 |
|------|-----------|-------------|-------------|------|
| **CAS Loop** | Non-blocking | 재시도 (busy-wait) | 저경합, 짧은 연산 | 고경합 시 CPU 낭비 |
| **Mutex** | Blocking | 커널 대기 (sleep) | 긴 임계구간, 고경합 | 커널 전환 비용 |
| **Spinlock** | Busy-waiting | CPU 회전 대기 | 극히 짧은 임계구간 (~ns) | 장시간 경합 시 CPU 100% |
| **RWLock** | Blocking | Reader 병렬, Writer 대기 | 읽기 >> 쓰기 | Writer 기아 가능 |
| **Seqlock** | Non-blocking (reader) | Reader 재시도 | 읽기 >>> 쓰기 | Writer 우선, 포인터 불가 |
| **STM (Software Transactional Memory)** | Non-blocking | 트랜잭션 롤백 | 여러 변수 동시 변경 | 오버헤드, 부작용 제한 |
| **Semaphore** | Blocking | 커널 대기 | N개 리소스 제한 | 순서 보장 없음 |

### 7.3 데이터베이스 동시성 제어 비교

| 기법 | 잠금 시점 | 충돌 시 비용 | 최적 사용처 |
|------|-----------|-------------|-------------|
| **Pessimistic (SELECT FOR UPDATE)** | 읽기 시 즉시 잠금 | 대기 (다른 트랜잭션 차단) | 충돌 빈번, 짧은 트랜잭션 |
| **Optimistic (Version + CAS WHERE)** | 커밋 시 검증 | 재시도 (읽기부터 다시) | 충돌 드묾, 읽기 위주 |
| **MVCC** | 잠금 없음 (버전 유지) | 버전 충돌 시 abort | 읽기/쓰기 혼합 |
| **SSI** | 잠금 없음 | 직렬화 이상 감지 시 abort | 직렬화 필수 |
| **Advisory Lock** | 명시적 잠금 | 대기 또는 실패 | 애플리케이션 레벨 조율 |

### 7.4 분산 동시성 제어 비교

| 기법 | 메커니즘 | 일관성 | 지연 | 장애 내성 |
|------|----------|--------|------|-----------|
| **Distributed Lock (Redis/etcd/ZK)** | Lock 획득 → 작업 → 해제 | 조건부 (lease 기반) | 수 ms | 단일 장애점 위험 |
| **Consensus (Paxos/Raft)** | 다수결 합의 | 강한 일관성 | 10+ ms | 과반수 생존 시 정상 |
| **CAS (etcd Txn, DynamoDB Condition)** | 조건부 쓰기 | 강한 일관성 | 수 ms | 저장소 의존 |
| **CRDT** | 수학적 병합 규칙 | 최종 일관성 | 매우 낮음 | 매우 높음 |
| **Vector Clock + LWW** | 타임스탬프 기반 최종 값 | 최종 일관성 | 매우 낮음 | 높음 |

---

## 8. 상황별 최적 선택

### 8.1 판단 매트릭스

| 상황 | 최적 선택 | 이유 | 피해야 할 것 |
|------|-----------|------|-------------|
| **단일 변수 원자 변경** | CAS | 최소 오버헤드, Lock 없음 | Mutex (과잉) |
| **단조 증가 카운터** | FAA (`AtomicLong.incrementAndGet`) | CAS 루프 불필요, 항상 성공 | CAS 루프 (불필요한 재시도) |
| **고경합 카운터** | LongAdder (Cell 분산) | CAS 경합 회피, 32~93배 빠름 | 단일 AtomicLong |
| **임계구간 < 수십ns, 저경합** | Spinlock | 컨텍스트 스위치 없음 | Mutex (커널 전환 불필요) |
| **임계구간 > 수십ns, 고경합** | Mutex | CPU 낭비 없음 (sleep) | Spinlock (CPU 100%) |
| **여러 변수 동시 원자 변경** | Mutex / STM | CAS는 단일 변수만 | CAS (여러 변수 불가) |
| **읽기 >> 쓰기** | Seqlock / RWLock | Reader 차단 없음 | Mutex (불필요한 읽기 차단) |
| **DB 충돌 낮음 (< 5%)** | Optimistic Locking (CAS) | 대기 없음, 높은 처리량 | Pessimistic (불필요한 잠금) |
| **DB 충돌 높음 (> 20%)** | Pessimistic Locking | 재시도 비용 > 잠금 비용 | Optimistic (재시도 폭주) |
| **분산 단일 키 조건부 쓰기** | DynamoDB Condition / etcd CAS | 강한 일관성, 단순 | Distributed Lock (복잡) |
| **상태 머신 전이** | CAS (status + version) | exactly-once 보장 | 잠금 없는 UPDATE |
| **분산 카운터** | CRDT (G-Counter) | 네트워크 지연 무관 | 분산 Lock + 단일 카운터 |

### 8.2 의사 결정 플로우차트

```
시작: 동시적 데이터 변경이 필요한가?
  │
  ├─ 단일 변수인가?
  │   ├─ Yes: 단조 증가인가?
  │   │   ├─ Yes → FAA (Fetch-and-Add)
  │   │   └─ No: 경합이 높은가?
  │   │       ├─ Yes → LongAdder / Cell 분산
  │   │       └─ No → CAS
  │   └─ No (여러 변수)
  │       ├─ 변수 2개, 인접 → DWCAS (CMPXCHG16B)
  │       └─ 그 외 → Mutex / STM
  │
  ├─ DB 레코드인가?
  │   ├─ 충돌률 < 5% → Optimistic (Version CAS)
  │   ├─ 충돌률 > 20% → Pessimistic (SELECT FOR UPDATE)
  │   └─ 5-20% → 벤치마크 후 결정
  │
  └─ 분산 시스템인가?
      ├─ 단일 키 조건부 → DynamoDB/etcd CAS
      ├─ 복잡한 조율 → Consensus (Raft)
      └─ 최종 일관성 OK → CRDT
```

### 8.3 성능 특성표

| 패턴 | 최상 지연 | 최악 지연 | 처리량 (저경합) | 처리량 (고경합) |
|------|-----------|-----------|----------------|----------------|
| CAS Loop | ~ns | 무한 (이론적) | 매우 높음 | 낮음 (재시도 폭주) |
| Mutex | ~us (커널전환) | ~ms (경합대기) | 보통 | 보통 |
| LongAdder | ~ns | ~us | 매우 높음 | **매우 높음** |
| DB Optimistic | ~ms | ~100ms (재시도) | 높음 | 낮음 |
| DB Pessimistic | ~ms | ~s (잠금대기) | 보통 | 보통 |
| DynamoDB CAS | ~ms | ~100ms (재시도) | 높음 | 보통 |
| etcd Txn | ~ms | ~100ms | 보통 | 보통 |

---

## 9. 설계 원칙과 베스트 프랙티스

### 9.1 CPU/메모리 레벨

#### CAS Loop 표준 패턴

```java
// ★ CAS Loop 황금 패턴: Read → Modify → CAS → Retry
public static <V> V atomicUpdate(AtomicReference<V> ref, UnaryOperator<V> updateFn) {
    V oldValue, newValue;
    do {
        oldValue = ref.get();              // 1. Read: 현재값
        newValue = updateFn.apply(oldValue); // 2. Modify: 새 값 계산
    } while (!ref.compareAndSet(           // 3. CAS: 원자적 교체
                oldValue, newValue));       //    실패 시 1로 재시도
    return newValue;
}
```

#### Exponential Backoff with Jitter

```java
// AWS 권장 Backoff 전략
// https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/

public boolean casWithBackoff(AtomicInteger target, int expected, int desired) {
    int maxRetries = 10;
    long baseDelay = 1; // ns
    ThreadLocalRandom random = ThreadLocalRandom.current();

    for (int attempt = 0; attempt < maxRetries; attempt++) {
        if (target.compareAndSet(expected, desired)) {
            return true;  // 성공
        }

        // Exponential Backoff + Full Jitter
        long maxDelay = baseDelay * (1L << attempt);  // 1, 2, 4, 8, 16...ns
        long jitter = random.nextLong(0, maxDelay + 1);
        LockSupport.parkNanos(jitter);

        expected = target.get();  // 최신값으로 갱신
    }
    return false;  // 최대 재시도 초과
}
```

#### Memory Ordering (Rust 예시)

```rust
use std::sync::atomic::{AtomicU64, Ordering};

let counter = AtomicU64::new(0);

// Relaxed: 순서 보장 없음. 단순 카운터에만 사용.
counter.fetch_add(1, Ordering::Relaxed);

// Acquire/Release: CAS의 표준 선택
// - Release: CAS 이전의 모든 쓰기가 다른 스레드에 가시화
// - Acquire: CAS 이후의 모든 읽기가 최신 값을 봄
let old = counter.load(Ordering::Acquire);
let result = counter.compare_exchange(
    old,
    old + 1,
    Ordering::AcqRel,    // 성공 시: Acquire + Release
    Ordering::Acquire,   // 실패 시: Acquire만 (Rust 고유: failure ordering 별도)
);

// SeqCst: 모든 스레드가 동일한 전역 순서를 관찰.
// 가장 안전하지만 가장 느림. 정말 필요한 경우에만.
counter.store(42, Ordering::SeqCst);
```

```
Memory Ordering 강도:

    Relaxed  <  Acquire/Release  <  AcqRel  <  SeqCst
    (최약)                                     (최강)

    CAS에는 AcqRel이 표준:
    - 충분한 가시성 보장
    - SeqCst보다 적은 오버헤드
    - 대부분의 lock-free 알고리즘에 적합
```

#### C++ weak vs strong

```cpp
#include <atomic>

std::atomic<int> value{0};
int expected = 0;

// compare_exchange_weak: Spurious failure 가능
// → 루프 안에서 사용 (어차피 재시도하므로 weak이 효율적)
while (!value.compare_exchange_weak(expected, expected + 1,
                                     std::memory_order_acq_rel,
                                     std::memory_order_acquire)) {
    // expected는 자동으로 현재 값으로 갱신됨
}

// compare_exchange_strong: Spurious failure 없음
// → 단독 시도 (루프 없이 한 번만 시도할 때)
bool success = value.compare_exchange_strong(expected, 42,
                                              std::memory_order_acq_rel,
                                              std::memory_order_acquire);
```

#### False Sharing 방지

```java
// 문제: 인접 변수들이 같은 캐시라인(64 bytes)에 위치
class BadLayout {
    volatile long counter1;  // 같은 캐시라인
    volatile long counter2;  // → Thread1이 counter1 변경 시
                             //   Thread2의 counter2 캐시도 무효화!
}

// 해결 1: @Contended (Java 8+, JDK 내부용)
@jdk.internal.vm.annotation.Contended
class GoodLayout {
    volatile long counter1;  // 별도 캐시라인
}

// 해결 2: 수동 패딩
class ManualPadding {
    volatile long counter1;
    long p1, p2, p3, p4, p5, p6, p7;  // 56 bytes 패딩
    volatile long counter2;            // 다른 캐시라인에 배치
}
```

### 9.2 Java 도구 선택 가이드

| 클래스 | 용도 | 성능 | 권장 |
|--------|------|------|------|
| `AtomicInteger/Long` | 단일 원자적 변수 | 저경합 우수 | 일반 용도 |
| `AtomicReference<T>` | 참조 CAS | 저경합 우수 | 객체 교체 |
| `AtomicStampedReference<T>` | ABA 방지 (버전 포함) | 약간 느림 | ABA 민감 |
| `LongAdder` | 고경합 카운터 | **32~93배** (vs AtomicLong) | 통계/메트릭 |
| `LongAccumulator` | 고경합 누적 | LongAdder 수준 | 커스텀 연산 |
| `VarHandle` | 고급 원자적 접근 | AtomicXxx 수준 | 전문가용 |
| `Unsafe` | 직접 메모리 접근 | 최고 | **지양** (JDK 내부) |

### 9.3 데이터베이스 레벨

#### Version Column 설계

```
권장: Long (정수) 버전
  - 단조 증가, 비교 명확
  - 오버플로우 걱정 없음 (Long.MAX_VALUE ≈ 9.2 × 10^18)

비권장: Timestamp 버전
  - Clock skew 위험 (DB 서버 간 시간 차이)
  - 동일 밀리초 내 다중 업데이트 시 구분 불가
  - 분산 환경에서 더욱 위험
```

#### Spring @Retryable 패턴

```java
@Configuration
@EnableRetry
public class RetryConfig {}

@Service
public class OrderService {

    @Retryable(
        retryFor = OptimisticLockException.class,
        maxAttempts = 3,                           // 최대 3회
        backoff = @Backoff(
            delay = 150,       // 초기 대기 150ms
            multiplier = 2,    // 2배씩 증가: 150ms → 300ms → 600ms
            maxDelay = 2000    // 최대 2초
        )
    )
    @Transactional
    public OrderDto confirmOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new NotFoundException(orderId));

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new InvalidStateException("Cannot confirm non-PENDING order");
        }

        order.confirm();  // status = CONFIRMED, JPA @Version이 CAS 처리
        return OrderDto.from(orderRepository.save(order));
    }

    @Recover  // 모든 재시도 실패 후 최종 처리
    public OrderDto confirmOrderRecover(OptimisticLockException e, Long orderId) {
        log.error("CAS failed after all retries for order {}", orderId, e);
        throw new ConflictException("Order " + orderId + " was modified concurrently");
    }
}
```

#### Event Sourcing + CAS

```java
// Event Store에서 expectedVersion을 CAS로 사용
public void appendEvents(String aggregateId, List<Event> events, long expectedVersion) {
    // CAS: 현재 버전이 기대 버전과 일치할 때만 이벤트 추가
    int affected = eventStore.execute(
        "INSERT INTO events (aggregate_id, version, event_type, payload) " +
        "SELECT :aggId, :version + row_number() OVER (), :type, :payload " +
        "FROM (VALUES (:events)) " +
        "WHERE (SELECT MAX(version) FROM events WHERE aggregate_id = :aggId) = :expectedVersion",
        Map.of(
            "aggId", aggregateId,
            "expectedVersion", expectedVersion,
            "events", events
        )
    );

    if (affected == 0) {
        throw new ConcurrencyException(
            "Expected version " + expectedVersion + " but aggregate was modified"
        );
    }
}
```

### 9.4 분산 시스템 레벨

#### etcd CAS 패턴

```go
// Kubernetes의 GuaranteedUpdate 패턴 = Read-Modify-CAS Retry Loop
func guaranteedUpdate(cli *clientv3.Client, key string, updateFn func(string) string) error {
    for retries := 0; retries < 10; retries++ {
        // 1. Read
        getResp, err := cli.Get(context.TODO(), key)
        if err != nil {
            return err
        }
        kv := getResp.Kvs[0]
        currentValue := string(kv.Value)
        currentRevision := kv.ModRevision

        // 2. Modify
        newValue := updateFn(currentValue)

        // 3. CAS (ModRevision 기반)
        txnResp, err := cli.Txn(context.TODO()).
            If(clientv3.Compare(clientv3.ModRevision(key), "=", currentRevision)).
            Then(clientv3.OpPut(key, newValue)).
            Commit()

        if err != nil {
            return err
        }

        if txnResp.Succeeded {
            return nil  // 성공
        }

        // 4. Retry with backoff
        time.Sleep(time.Duration(rand.Intn(100*(1<<retries))) * time.Millisecond)
    }
    return fmt.Errorf("CAS failed after max retries for key: %s", key)
}
```

#### DynamoDB CAS 패턴

```python
# 상태 머신 + CAS: 정확한 상태 전이 보장
def transition_order_status(order_id: str, from_status: str, to_status: str):
    """
    상태 전이 규칙 + 동시성 제어를 하나의 CAS로 결합.
    예: PENDING → CONFIRMED (단, 현재 PENDING일 때만)
    """
    try:
        table.update_item(
            Key={'orderId': order_id},
            UpdateExpression='SET #s = :to_status, version = version + :one',
            ConditionExpression='#s = :from_status',  # 상태 전이 규칙 검증
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':from_status': from_status,
                ':to_status': to_status,
                ':one': 1
            }
        )
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return False
        raise
```

#### ZooKeeper Version-Based CAS

```java
// ZooKeeper setData는 version 기반 CAS를 내장
Stat stat = zk.exists("/config/setting", false);
int expectedVersion = stat.getVersion();

try {
    zk.setData("/config/setting", newData, expectedVersion);
    // 성공: version이 일치하여 업데이트됨
} catch (KeeperException.BadVersionException e) {
    // CAS 실패: 다른 클라이언트가 먼저 변경함
    // → 재시도 필요
}
```

---

## 10. 안티패턴과 함정

### 10.1 ABA Problem

**문제**: 값이 A -> B -> A로 변해도 CAS가 성공한다. CAS는 "값이 같은지"만 확인하고 "중간에 변했는지"는 알 수 없다.

```
ABA 시나리오:

Thread 1:                    Thread 2:
  read top = A               |
  (preempted)                 |
  |                           pop A    → top = B
  |                           pop B    → top = A (재사용된 노드!)
  |                           push A   → top = A
  (resumed)                   |
  CAS(top, A, newNode)       |
  → 성공! (A == A)           |
  → 하지만 스택 구조가 손상됨
```

**해결책**:

| 해결책 | 메커니즘 | 언어/플랫폼 |
|--------|----------|-------------|
| **Tagged Pointer** | 포인터 + 카운터를 DWCAS로 원자적 갱신 | C/C++ + CMPXCHG16B |
| **AtomicStampedReference** | 참조 + stamp(int)를 쌍으로 CAS | Java |
| **AtomicMarkableReference** | 참조 + mark(boolean) | Java |
| **Hazard Pointers** | 해제 예정 메모리를 보호 목록에 등록 | C/C++ (Maged Michael, 2004) |
| **Epoch-Based Reclamation** | 전역 에폭 카운터로 안전한 해제 시점 결정 | C/C++ (Crossbeam in Rust) |
| **LL/SC** | 값이 아닌 변경 여부를 추적 → ABA 면역 | ARM, MIPS, PowerPC, RISC-V |

```java
// Java AtomicStampedReference로 ABA 방지
AtomicStampedReference<Node> top = new AtomicStampedReference<>(null, 0);

// Push
void push(Node newNode) {
    int[] stampHolder = new int[1];
    Node oldTop;
    int oldStamp;
    do {
        oldTop = top.get(stampHolder);
        oldStamp = stampHolder[0];
        newNode.next = oldTop;
    } while (!top.compareAndSet(
        oldTop, newNode,
        oldStamp, oldStamp + 1   // ★ stamp 증가 → ABA 감지
    ));
}
```

### 10.2 CAS Loop Starvation (기아)

**문제**: 경합이 극심하면 특정 스레드가 CAS에 계속 실패하여 무한 루프에 빠질 수 있다.

```
고경합 시나리오 (64 코어):

Thread 0: CAS 시도 → 실패 → 재시도 → 실패 → 재시도 → 실패 ...
Thread 1: CAS 시도 → 성공!
Thread 2: CAS 시도 → 실패 → 재시도 → 성공!
Thread 3: CAS 시도 → 실패 → 재시도 → 실패 → 재시도 → 실패 ...
...
Thread 0: 여전히 실패 중 (starvation!)
```

**해결책**:

1. **Exponential Backoff**: 실패마다 대기 시간을 2배씩 증가
2. **Adaptive Lock Switching**: N회 CAS 실패 시 Lock으로 전환
3. **Cell 분산 (Striped64)**: 경합을 물리적으로 분산
4. **LongAdder**: 고경합 카운터에서 CAS 대신 사용

```java
// Adaptive: CAS 실패가 많으면 Lock으로 전환
public void adaptiveUpdate(AtomicInteger target, int delta) {
    int failures = 0;
    int oldVal;
    do {
        oldVal = target.get();
        if (failures > THRESHOLD) {
            // CAS 포기, Lock으로 전환
            synchronized (fallbackLock) {
                target.addAndGet(delta);
                return;
            }
        }
        failures++;
    } while (!target.compareAndSet(oldVal, oldVal + delta));
}
```

### 10.3 False Sharing

**문제**: 서로 다른 변수가 같은 캐시라인(64 bytes)에 위치하면, 한 변수의 CAS가 인접 변수의 캐시도 무효화한다.

```
False Sharing 시각화:

캐시라인 (64 bytes):
┌──────────┬──────────┬──────────────────────────┐
│ counter1 │ counter2 │      (빈 공간)            │
│  8 bytes │  8 bytes │                           │
└──────────┴──────────┴──────────────────────────┘

CPU 0: CAS(counter1) → 캐시라인 Modified
CPU 1: CAS(counter2) → 캐시 미스! (CPU 0이 Modified했으므로)
       → 캐시라인 재로드 필요 → 수십 ns 지연
CPU 0: CAS(counter1) → 캐시 미스! (CPU 1이 Modified했으므로)
       → 핑퐁 현상 → 성능 급격히 저하
```

**해결**: 위 9.1절의 `@Contended` / 수동 패딩 참조.

### 10.4 Memory Ordering Bug

**문제**: Relaxed ordering으로 CAS가 성공해도, CAS 주변의 다른 변수 쓰기가 다른 스레드에 가시화되지 않을 수 있다.

```cpp
// ★ 위험한 코드
std::atomic<bool> ready{false};
int data = 0;  // 일반 변수 (non-atomic)

// Thread 1:
data = 42;
ready.store(true, std::memory_order_relaxed);  // 위험!
// data=42 쓰기가 ready=true보다 나중에 가시화될 수 있음

// Thread 2:
if (ready.load(std::memory_order_relaxed)) {   // 위험!
    assert(data == 42);  // 실패할 수 있음!
}

// ★ 올바른 코드
// Thread 1:
data = 42;
ready.store(true, std::memory_order_release);  // data=42가 먼저 가시화됨을 보장

// Thread 2:
if (ready.load(std::memory_order_acquire)) {   // release 이전의 모든 쓰기를 봄
    assert(data == 42);  // 항상 성공
}
```

### 10.5 DB Lost Update (버전 체크 누락)

**문제**: CAS 없이 UPDATE하면 Lost Update가 발생한다.

```sql
-- ★ 위험: CAS 없는 UPDATE
-- Thread A: SELECT balance FROM accounts WHERE id=1 → 1000
-- Thread B: SELECT balance FROM accounts WHERE id=1 → 1000
-- Thread A: UPDATE accounts SET balance = 900 WHERE id=1  (1000-100)
-- Thread B: UPDATE accounts SET balance = 800 WHERE id=1  (1000-200)
-- 결과: balance = 800 (Thread A의 -100이 Lost!)

-- ★ 안전: CAS + Version
-- Thread A: SELECT balance, version FROM accounts WHERE id=1 → 1000, v=1
-- Thread B: SELECT balance, version FROM accounts WHERE id=1 → 1000, v=1
-- Thread A: UPDATE accounts SET balance=900, version=2 WHERE id=1 AND version=1  → 성공
-- Thread B: UPDATE accounts SET balance=800, version=2 WHERE id=1 AND version=1  → 실패 (v=2)
-- Thread B: 재시도 → SELECT → 900, v=2 → UPDATE SET balance=700 WHERE version=2 → 성공
-- 결과: balance = 700 (정확!)
```

### 10.6 Too Wide CAS

**문제**: 불필요하게 큰 범위를 CAS하면 경합이 증가한다.

```java
// ★ 나쁨: 전체 객체를 CAS
AtomicReference<BigState> state = ...;
// 작은 필드 하나 변경에도 전체 객체를 교체해야 함
// → 큰 객체 복사 비용 + 무관한 필드 변경에도 CAS 실패

// ★ 좋음: 변경 필요한 부분만 별도 원자 변수로 분리
AtomicInteger status = new AtomicInteger(PENDING);
AtomicLong lastUpdated = new AtomicLong(0);
// 각 필드를 독립적으로 CAS → 경합 최소화
```

### 10.7 CAS without Read

**문제**: 현재 값을 읽지 않고 CAS를 시도하면, 항상 실패하거나 의도하지 않은 값으로 교체된다.

```java
// ★ 잘못된 코드
int expected = 0;  // 하드코딩된 기대값
if (!counter.compareAndSet(expected, 1)) {
    // 현재값이 0이 아니면 항상 실패
    // expected를 갱신하지 않으므로 재시도해도 의미 없음
}

// ★ 올바른 코드
int expected;
do {
    expected = counter.get();  // ★ 반드시 현재값을 먼저 읽기
} while (!counter.compareAndSet(expected, expected + 1));
```

### 10.8 분산 Timestamp CAS

**문제**: 타임스탬프를 CAS의 비교 기준으로 사용하면 clock skew로 인해 정합성이 깨진다.

```
Clock Skew 문제:

Server A (시계 빠름):  12:00:01.000
Server B (시계 느림):  12:00:00.500

Server A: UPDATE SET ts='12:00:01.000' WHERE ts < '12:00:01.000' → 성공
Server B: UPDATE SET ts='12:00:00.500' WHERE ts < '12:00:00.500'
→ 의도와 다른 결과! (B가 A보다 나중이지만 ts가 더 작음)
```

**해결**: 단조증가 정수(Long version)를 사용하거나, Google Spanner의 TrueTime처럼 시간 불확실성 구간을 명시적으로 처리한다.

### 10.9 안티패턴 요약표

| # | 안티패턴 | 증상 | 해결 |
|---|----------|------|------|
| 1 | ABA Problem | 데이터 구조 손상 | AtomicStampedReference, Tagged Pointer, LL/SC |
| 2 | CAS Loop Starvation | 특정 스레드 무한 재시도 | Backoff, Adaptive Lock 전환 |
| 3 | False Sharing | 무관한 CAS가 서로 느려짐 | @Contended, Cache Line Padding |
| 4 | Memory Ordering Bug | 값은 맞지만 주변 변수 안 보임 | AcqRel ordering |
| 5 | DB Lost Update | 동시 UPDATE 시 변경 분실 | Version Column + WHERE |
| 6 | Too Wide CAS | 불필요한 경합 증가 | 변경 범위 최소화, 필드 분리 |
| 7 | CAS without Read | 무의미한 반복 실패 | 현재값 읽기 후 루프 |
| 8 | Timestamp CAS | Clock skew로 정합성 깨짐 | 단조증가 정수 버전 사용 |

---

## 11. 빅테크 실전 사례

### 11.1 Google Spanner

**TrueTime + Commit Wait = 시간 기반 CAS**

Spanner는 GPS와 원자 시계를 결합한 TrueTime API로 글로벌 일관성을 달성한다. 트랜잭션 커밋 시 "현재 시간의 불확실성 구간이 지날 때까지 대기(Commit Wait)"하여, 모든 트랜잭션에 전역적으로 유일한 타임스탬프를 부여한다.

이것은 본질적으로 **시간축에서의 CAS**이다:
- **Compare**: "이 타임스탬프가 다른 어떤 커밋된 트랜잭션보다 이후인가?"
- **Swap**: "그렇다면 이 타임스탬프로 커밋을 확정한다"

**Paxos 복제 = 분산 CAS**: 각 Spanner 스팬서버 그룹은 Paxos로 복제되며, 리더 선출과 로그 복제가 분산 CAS 패턴으로 동작한다.

### 11.2 Amazon DynamoDB

**ConditionExpression = 분산 CAS의 정수**

DynamoDB는 `ConditionExpression`을 통해 네이티브 분산 CAS를 제공한다:

```python
# DynamoDB CAS 패턴 3가지

# 1. Version 기반 OCC (가장 일반적)
table.update_item(
    Key={'pk': 'order-123'},
    UpdateExpression='SET #s = :val, version = version + :one',
    ConditionExpression='version = :expected',
    ExpressionAttributeValues={':expected': 5, ':val': 'SHIPPED', ':one': 1}
)

# 2. 존재 여부 기반 (Put-If-Not-Exists = 분산 유니크 제약)
table.put_item(
    Item={'pk': 'idempotency-key-abc', 'result': '...'},
    ConditionExpression='attribute_not_exists(pk)'
)

# 3. 상태 전이 기반 (상태 머신 CAS)
table.update_item(
    Key={'pk': 'order-123'},
    UpdateExpression='SET #s = :to',
    ConditionExpression='#s = :from',
    ExpressionAttributeNames={'#s': 'status'},
    ExpressionAttributeValues={':from': 'PENDING', ':to': 'CONFIRMED'}
)
```

**2023 신기능**: `ReturnValuesOnConditionCheckFailure='ALL_OLD'`로 CAS 실패 시 현재 값을 반환받아 불필요한 추가 GET 요청을 제거.

### 11.3 Apache Kafka

**3가지 CAS 패턴이 Kafka의 핵심을 구성한다:**

| 패턴 | 메커니즘 | CAS 대응 |
|------|----------|----------|
| **Producer Idempotence** | `(producerId, sequenceNumber)` 쌍 검증 | 시퀀스 번호 CAS: "현재 시퀀스가 N이면 N+1로 전진" |
| **KRaft (Kafka Raft)** | `(term, log_index)` 합의 | Raft 합의 = 분산 CAS |
| **Consumer Offset Commit** | `__consumer_offsets` 토픽에 기록 | 오프셋 CAS: "현재 오프셋이 X이면 Y로 전진" |

Producer idempotence는 exactly-once semantics의 핵심이다. 각 메시지에 단조증가 시퀀스 번호가 부여되며, 브로커는 "현재 시퀀스가 N일 때 N+1 메시지만 수락"하는 CAS를 수행한다. 중복 메시지(시퀀스 N이 이미 처리됨)나 순서 이탈 메시지는 거부된다.

### 11.4 etcd / Kubernetes

**etcd Txn = 순수 CAS API**

etcd의 Transaction API는 CAS를 가장 직접적으로 표현한 분산 저장소 인터페이스이다:

```
etcd Txn 구조:
    If(Compare...)    // Compare
    Then(Op...)       // Swap (성공 시)
    Else(Op...)       // 실패 시 대안

Compare 종류:
    Value(key) == expected          // 값 비교
    ModRevision(key) == expected    // 수정 버전 비교
    CreateRevision(key) == expected // 생성 버전 비교
    Version(key) == expected        // 버전 횟수 비교
```

**Kubernetes ResourceVersion = etcd ModRevision**

Kubernetes의 모든 리소스에는 `resourceVersion` 필드가 있으며, 이는 etcd의 `mod_revision`을 그대로 노출한다. kubectl이나 컨트롤러가 리소스를 업데이트할 때:

1. GET으로 리소스와 `resourceVersion` 읽기
2. 수정 후 PUT 요청 (body에 `resourceVersion` 포함)
3. API Server가 etcd에 `If(ModRevision == resourceVersion) Then(Put)` 실행
4. 실패 시 409 Conflict → 클라이언트가 1부터 재시도

이것이 Kubernetes의 `GuaranteedUpdate` 패턴이다: **Read → Modify → CAS Retry Loop**.

### 11.5 Redis

**CAS 진화의 3세대**:

```
1세대: WATCH + MULTI/EXEC (Optimistic Locking)
    WATCH mykey              # 키 감시 시작
    val = GET mykey          # 현재값 읽기
    new_val = compute(val)   # 새 값 계산
    MULTI                    # 트랜잭션 시작
    SET mykey new_val        # 설정
    EXEC                     # 실행 (WATCH 이후 변경 시 nil 반환)
    문제: 레이스 윈도우, 복잡한 클라이언트 로직

2세대: Lua Script CAS
    EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then
            redis.call('SET',KEYS[1],ARGV[2]) return 1
          else return 0 end" 1 key expected desired
    장점: 서버 측 원자적 실행, 간결

3세대: Native CAS (Redis 8.4, 2024)
    SET key value IFEQ expected   # CAS: 같을 때만 설정
    SET key value IFGT threshold  # 조건부: 클 때만 설정
    장점: Lua 오버헤드 제거, 최고 성능
```

**Redlock**: `SET key value NX PX 30000`은 사실상 CAS이다 — "키가 존재하지 않으면(Compare) 설정(Swap)".

### 11.6 Java (Doug Lea의 java.util.concurrent)

**ConcurrentHashMap의 CAS 전략**:

```
ConcurrentHashMap 내부 동작:

    ┌─────────────────────────────────────┐
    │           Node[] table              │
    ├─────┬─────┬─────┬─────┬────────────┤
    │ [0] │ [1] │ [2] │ [3] │   ...      │
    │ null│ Node│ null│ Tree│            │
    └──┬──┴──┬──┴──┬──┴──┬──┴────────────┘
       │     │     │     │
       │     ↓     │     ↓
       │   [K1,V1] │   TreeBin
       │     ↓     │     ↓
       │   [K2,V2] │   [K3,V3]
       │           │
    빈 슬롯:       충돌 슬롯:
    CAS 삽입       synchronized
    (Lock 없음!)   (해당 노드만 잠금)

    핵심: 빈 버킷 → CAS, 비어있지 않은 버킷 → Fine-grained Lock
    결과: 대부분의 삽입이 CAS로 완료 → 매우 높은 처리량
```

**LongAdder vs AtomicLong 벤치마크**:

| 코어 수 | AtomicLong ops/sec | LongAdder ops/sec | 배수 |
|---------|-------------------|-------------------|------|
| 1 | ~300M | ~250M | 0.8x (오버헤드) |
| 4 | ~100M | ~800M | 8x |
| 16 | ~30M | ~2,000M | 66x |
| 64 | ~10M | ~3,200M | 320x |

단일 코어에서는 AtomicLong이 약간 빠르지만, 코어 수가 증가할수록 LongAdder의 우위가 **극적으로** 증가한다.

### 11.7 Linux Kernel

**Futex**: 9.4절에서 상세히 다루었듯이, Userspace CAS + Kernel Fallback 2단계 설계.

**Spinlock**: 커널 내부 짧은 임계구간에서 CAS 기반 spinlock을 사용한다. 인터럽트 핸들러에서는 Mutex(sleep)를 사용할 수 없으므로 CAS spinlock이 유일한 선택이다.

**RCU**: 읽기 경로에 CAS 없음, 쓰기 경로에 포인터 CAS 한 번. 리눅스 커널에서 가장 많이 사용되는 동기화 기법이다. 네트워크 라우팅 테이블, 파일 시스템 캐시 등 읽기가 압도적으로 많은 구조에 최적이다.

### 11.8 Intel/ARM 하드웨어

**x86 LOCK CMPXCHG**:
- `LOCK` prefix가 MESI 프로토콜을 통해 캐시라인의 배타적 소유권을 확보
- 최신 CPU에서는 버스 잠금 대신 캐시 잠금(cache lock)으로 최적화
- 단일 CAS 비용: ~20-50 사이클 (캐시 히트 시)

**ARM LSE vs LL/SC**:

| 환경 | LSE CAS | LL/SC (LDREX/STREX) | 비고 |
|------|---------|---------------------|------|
| 단일 코어, 저경합 | **빠름** | 느림 (2 명령어) | LSE 유리 |
| 다중 코어, 저경합 | **빠름** | 비슷 | LSE 약간 유리 |
| 다중 코어, 고경합 | 느림 | **최대 20배 빠름** | LL/SC의 spurious failure가 자연스러운 backoff 역할 |
| NUMA 노드 간 | 느림 | **빠름** | LL/SC의 로컬 캐시 우선 특성 |

**MySQL on ARM LSE**: ARM 서버에서 LSE를 활성화하면 MySQL의 InnoDB 엔진 성능이 약 50% 향상된다 (mysqlonarm.github.io 벤치마크). 이는 InnoDB 내부의 수많은 CAS 연산이 LL/SC 루프에서 단일 명령어로 축소되기 때문이다.

### 11.9 CockroachDB

**Write Intent + HLC MVCC CAS**:

CockroachDB는 Hybrid Logical Clock(HLC)과 MVCC를 결합하여 분산 트랜잭션을 구현한다:

1. 트랜잭션이 키를 쓸 때 **Write Intent** (임시 잠금)를 남김
2. 커밋 시 Write Intent를 확정하는 것이 CAS 연산
3. 충돌 시 타임스탬프를 전진시키고 재시도

**Parallel Commits** (2019): 트랜잭션 레코드의 상태 전이(`PENDING → COMMITTED`)를 실제 쓰기와 병렬로 수행하여 커밋 레이턴시를 절반으로 줄임. 이 상태 전이 자체가 CAS이다.

### 11.10 TiDB (Percolator 프로토콜)

Google Percolator에 기반한 TiDB의 분산 트랜잭션:

```
TiDB/TiKV Percolator 프로토콜:

Column Families:
    CF_LOCK:    잠금 정보
    CF_WRITE:   커밋된 버전 메타데이터
    CF_DEFAULT: 실제 데이터

2PC (Two-Phase Commit):

Phase 1 (Prewrite):
    각 키에 CF_LOCK CAS:
    "이 키에 Lock이 없으면(Compare) 내 Lock을 건다(Swap)"

Phase 2 (Commit):
    ★ Primary Key의 Lock을 제거하고 Write 레코드 추가
    = 단일 원자적 결정점 (이것이 트랜잭션의 CAS!)
    Primary 성공 → 트랜잭션 커밋됨
    Secondary 키들은 비동기적으로 정리
```

핵심: **Primary Key의 Commit이 전체 트랜잭션의 CAS**이다. 이 한 번의 원자적 연산이 트랜잭션의 성공/실패를 결정한다.

### 11.11 Stripe

**Idempotency Key + DB Unique Constraint = 분산 CAS**:

```
Stripe의 멱등성 보장:

1. 클라이언트가 Idempotency-Key 헤더와 함께 결제 요청
2. 서버: INSERT INTO idempotency_keys (key, ...) VALUES (...)
   → Unique Constraint = CAS ("이 키가 없으면 삽입")
   → 성공: 새 요청, 처리 진행
   → 실패 (Duplicate): 이미 처리됨, 저장된 결과 반환
3. 결제 처리: 상태 머신 CAS
   status = 'STARTED' → 'PROCESSING' → 'COMPLETED'
   각 전이가 CAS (status + version 검증)
```

### 11.12 Uber

**Flink + Kafka Exactly-Once = Checkpoint ID CAS**:

Uber는 Apache Flink와 Kafka를 결합하여 대규모 스트림 처리에서 exactly-once를 달성한다. 핵심은 **Checkpoint ID**를 CAS 토큰으로 사용하는 것이다:

1. Flink가 체크포인트를 트리거
2. 각 오퍼레이터가 상태를 스냅샷
3. Kafka에 오프셋 커밋: "체크포인트 ID N의 결과로 오프셋 X를 커밋" (CAS)
4. 중복 체크포인트나 이전 체크포인트의 커밋은 거부

### 11.13 CAS 레벨별 분류 종합표

| 레벨 | 기술 | 메커니즘 | 지연 | 실전 사례 |
|------|------|----------|------|-----------|
| **CPU** | CMPXCHG, ARM CAS | 하드웨어 원자적 명령어 | ~ns | 모든 lock-free 알고리즘의 기반 |
| **OS** | futex, spinlock, RCU | Userspace CAS + 커널 폴백 | ~us | Linux 커널 전역 |
| **런타임** | LongAdder, ConcurrentHashMap | Cell 분산 + CAS | 수십~수백 ns | Java 서버 애플리케이션 |
| **분산 메모리** | Redis | 단일 스레드 직렬화 / Lua / IFEQ | sub-ms | 캐시, 세션, 분산 잠금 |
| **분산 KV** | etcd, DynamoDB | 네트워크 CAS | 1-10 ms | Kubernetes, AWS 서비스 |
| **분산 SQL** | CockroachDB, TiDB | Raft + MVCC | 10-100 ms | 글로벌 OLTP |
| **글로벌 DB** | Spanner | TrueTime + Commit Wait | 수 ms | Google 내부 서비스 |
| **애플리케이션** | Stripe, Kafka | DB unique + version + 시퀀스 | network | 결제, 메시징 |

---

## 12. 참고 자료

### 12.1 학술 논문

| 논문 | 저자 | 연도 | URL |
|------|------|------|-----|
| Wait-Free Synchronization | Herlihy | 1991 | https://cs.brown.edu/~mph/Herlihy91/p124-herlihy.pdf |
| Linearizability | Herlihy & Wing | 1990 | https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf |
| Impossibility of Distributed Consensus (FLP) | Fischer, Lynch, Paterson | 1985 | https://dl.acm.org/doi/10.1145/3149.214121 |
| Optimistic Concurrency Control | Kung & Robinson | 1981 | https://www.eecs.harvard.edu/~htk/publication/1981-tods-kung-robinson.pdf |
| Treiber Stack | Treiber | 1986 | https://dominoweb.draco.res.ibm.com/reports/rj5118.pdf |
| Michael-Scott Queue | Michael & Scott | 1996 | https://www.cs.rochester.edu/~scott/papers/1996_PODC_queues.pdf |
| Non-Blocking Linked List | Harris | 2001 | https://timharris.uk/papers/2001-disc.pdf |
| Hazard Pointers | Maged Michael | 2004 | https://dl.acm.org/doi/10.1109/TPDS.2004.8 |
| Raft Consensus | Ongaro & Ousterhout | 2014 | https://raft.github.io/ |
| Bakery Algorithm | Lamport | 1974 | https://en.wikipedia.org/wiki/Lamport%27s_bakery_algorithm |

### 12.2 CPU/하드웨어 참고

| 주제 | URL |
|------|-----|
| x86 CMPXCHG 명세 | https://www.felixcloutier.com/x86/cmpxchg |
| x86 CMPXCHG8B/16B 명세 | https://www.felixcloutier.com/x86/cmpxchg8b:cmpxchg16b |
| ARM LSE 소개 | https://learn.arm.com/learning-paths/servers-and-cloud-computing/lse/intro/ |
| MySQL on ARM LSE | https://mysqlonarm.github.io/ARM-LSE-and-MySQL/ |
| ARM Atomics 성능 연구 | https://www.researchgate.net/publication/370682772_A_Study_on_the_Performance_Implications_of_AArch64_Atomics |
| Atomics 하드웨어 | https://mara.nl/atomics/hardware.html |
| Concurrency Costs 벤치마크 | https://travisdowns.github.io/blog/2020/07/06/concurrency-costs.html |
| MESI Protocol | https://en.wikipedia.org/wiki/MESI_protocol |
| Acquire/Release Semantics | https://preshing.com/20120913/acquire-and-release-semantics/ |
| LL/SC vs CAS ABA | https://blog.memzero.de/cas-llsc-aba/ |

### 12.3 OS/커널 참고

| 주제 | URL |
|------|-----|
| Linux RCU | https://www.kernel.org/doc/html/next/RCU/whatisRCU.html |
| Linux Kernel Locking | https://docs.kernel.org/kernel-hacking/locking.html |
| LWN: ARM64 Atomics | https://lwn.net/Articles/847973/ |
| LWN: Futex | https://lwn.net/Articles/360699/ |
| LWN: Concurrency Primitives | https://lwn.net/Articles/940944/ |

### 12.4 언어별 참고

| 주제 | URL |
|------|-----|
| Java atomic 패키지 | https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/atomic/package-summary.html |
| Java Memory Model (Doug Lea) | https://gee.cs.oswego.edu/dl/html/j9mm.html |
| JEP 193: VarHandle | https://openjdk.org/jeps/193 |
| Java ConcurrentHashMap 소스 | https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/concurrent/ConcurrentHashMap.java |
| Java False Sharing / @Contended | https://www.baeldung.com/java-false-sharing-contended |
| Java CAS Demystified | https://dzone.com/articles/demystifying-javas-compare-and-swap-cas |
| Java AtomicStampedReference | https://jenkov.com/tutorials/java-util-concurrent/atomicstampedreference.html |
| LongAdder vs AtomicLong 벤치마크 | http://blog.palominolabs.com/2014/02/10/java-8-performance-improvements-longadder-vs-atomiclong/index.html |
| Rust Atomic Ordering | https://doc.rust-lang.org/std/sync/atomic/enum.Ordering.html |
| Rust Atomics (Nomicon) | https://doc.rust-lang.org/nomicon/atomics.html |
| C++ compare_exchange | https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange |

### 12.5 데이터베이스 참고

| 주제 | URL |
|------|-----|
| JPA Optimistic Locking | https://www.baeldung.com/jpa-optimistic-locking |
| JPA @Version (Vlad Mihalcea) | https://vladmihalcea.com/optimistic-locking-version-property-jpa-hibernate/ |
| DynamoDB Optimistic Locking | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBMapper.OptimisticLocking.html |
| DynamoDB Version Control | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_ImplementingVersionControl.html |
| DynamoDB Conditional Write 고경합 처리 | https://aws.amazon.com/blogs/database/handle-conditional-write-errors-in-high-concurrency-scenarios-with-amazon-dynamodb/ |
| CockroachDB Transaction Layer | https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer |
| CockroachDB Parallel Commits | https://www.cockroachlabs.com/blog/parallel-commits/ |
| TiKV MVCC | https://pingcap.medium.com/mvcc-in-tikv-f0aa318c564a |
| TiKV Percolator | https://tikv.org/deep-dive/distributed-transaction/percolator/ |
| Google Spanner TrueTime | https://docs.cloud.google.com/spanner/docs/true-time-external-consistency |
| Spanner External Consistency | https://cloud.google.com/blog/products/databases/strict-serializability-and-external-consistency-in-spanner |

### 12.6 분산 시스템 참고

| 주제 | URL |
|------|-----|
| etcd API | https://etcd.io/docs/v3.3/learning/api/ |
| etcd Why | https://etcd.io/docs/v3.5/learning/why/ |
| Redis Transactions | https://redis.io/docs/latest/develop/using-commands/transactions/ |
| Redis 8.4 신기능 | https://redis.io/docs/latest/develop/whats-new/8-4/ |
| Redis Atomic Updates | https://redis.antirez.com/fundamental/atomic-updates.html |
| Kubernetes Concurrency Control | https://kyungho.me/en/posts/kubernetes-concurrency-control |
| Kafka Exactly Once (KIP-98) | https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging |
| Uber Flink+Kafka Exactly-Once | https://www.infoq.com/news/2021/11/exactly-once-uber-flink-kafka/ |
| Stripe Idempotency | https://stripe.com/blog/idempotency |
| Event Sourcing + Concurrent Updates | https://teivah.medium.com/event-sourcing-and-concurrent-updates-32354ec26a4c |
| Timestamps의 문제 | https://aphyr.com/posts/299-the-trouble-with-timestamps |
| AWS Backoff with Jitter | https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ |

### 12.7 백과사전/종합

| 주제 | URL |
|------|-----|
| Compare-and-Swap (Wikipedia) | https://en.wikipedia.org/wiki/Compare-and-swap |
| Load-Link/Store-Conditional (Wikipedia) | https://en.wikipedia.org/wiki/Load-link/store-conditional |
| ABA Problem (Wikipedia) | https://en.wikipedia.org/wiki/ABA_problem |
| ABA Problem (Baeldung) | https://www.baeldung.com/cs/aba-concurrency |
| Wait-Free Hierarchy (Yale) | https://www.cs.yale.edu/homes/aspnes/pinewiki/WaitFreeHierarchy.html |

---

> **요약**: CAS(Compare-And-Swap)는 하드웨어 CPU 명령어에서 시작하여 OS, 런타임, 데이터베이스, 분산 시스템까지 관통하는 **동시성 제어의 근본 원리**이다. "충돌이 드물다고 가정하고, 커밋 시 검증하며, 실패 시 재시도"하는 낙관적 철학은 나노초 단위의 CPU 연산부터 글로벌 분산 데이터베이스까지 동일하게 적용된다. Herlihy(1991)의 증명이 보여주었듯이, CAS는 임의 개수의 프로세스 간 합의를 달성할 수 있는 범용 동기화 원시연산이며, 이것이 현대 컴퓨터 시스템의 동시성이 CAS 위에 구축된 이유이다.
