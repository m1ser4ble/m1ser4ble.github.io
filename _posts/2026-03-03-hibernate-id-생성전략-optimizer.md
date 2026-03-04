---
layout: single
title: "Hibernate ID 생성 전략과 Sequence Optimizer"
date: 2026-03-03 23:00:00 +0900
categories: backend
tags: [backend, spring, architecture]
excerpt: "리버스 프록시는 외부 요청을 중재해 보안과 확장성을 높이는 핵심 인프라 컴포넌트다."
source: "/home/dwkim/dwkim/docs/backend/hibernate-id-생성전략-optimizer.md"


---

**TL;DR**
- GenerationType
- IDENTITY
- SEQUENCE

## 1. Concept
Hibernate ID 생성 전략과 Sequence Optimizer의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. Background
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. Reason
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. Features
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. Detailed Notes

# Hibernate ID 생성 전략과 Sequence Optimizer

> **작성일**: 2026-03-03
> **카테고리**: Backend / Java / JPA / Hibernate
> **포함 내용**: GenerationType, IDENTITY, SEQUENCE, TABLE, allocationSize, Hi/Lo, Pooled, Pooled-Lo, SequenceStyleGenerator, Hibernate 6 마이그레이션, JDBC Batch, INCREMENT BY, new_generator_mappings, UUID v7, TSID, Snowflake ID, 분산 ID 생성

---

# 1. ID 생성 전략이란?

## 핵심 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                    Primary Key 생성 문제                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  모든 DB 테이블의 행(row)은 고유한 식별자(PK)가 필요하다          │
│                                                                   │
│  ┌──────────────────────────────────────────────┐               │
│  │  INSERT INTO users (id, name, email)          │               │
│  │  VALUES (???, '김철수', 'kim@example.com');   │               │
│  │          ^^^                                   │               │
│  │          이 값을 누가, 언제, 어떻게 결정하나?  │               │
│  └──────────────────────────────────────────────┘               │
│                                                                   │
│  선택지:                                                          │
│  ├── 1) DB가 자동 생성 (AUTO_INCREMENT / IDENTITY)               │
│  ├── 2) DB Sequence에서 미리 조회 (SEQUENCE)                     │
│  ├── 3) 별도 테이블로 관리 (TABLE)                                │
│  └── 4) 애플리케이션이 직접 생성 (UUID, Snowflake 등)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## JPA의 4가지 GenerationType

```
┌─────────────────────────────────────────────────────────────────┐
│                   @GeneratedValue(strategy = ?)                  │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                        │
│ IDENTITY │  DB의 AUTO_INCREMENT 컬럼 사용                        │
│          │  INSERT 실행 후에야 ID를 알 수 있음                    │
│          │  → JDBC Batch INSERT 불가능 (치명적 성능 제약)         │
│          │                                                        │
│          │  MySQL: AUTO_INCREMENT                                 │
│          │  SQL Server: IDENTITY(1,1)                             │
│          │  PostgreSQL: SERIAL (내부적으로 sequence 사용)          │
│          │                                                        │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                        │
│ SEQUENCE │  DB Sequence 객체에서 ID를 미리 조회                   │
│          │  INSERT 전에 ID 확보 → Batch INSERT 가능               │
│          │  → Hibernate가 가장 권장하는 전략                      │
│          │                                                        │
│          │  Oracle, PostgreSQL, SQL Server 2012+, H2              │
│          │                                                        │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                        │
│  TABLE   │  별도 테이블에 시퀀스 값을 저장                        │
│          │  SELECT FOR UPDATE + UPDATE로 값 증가                  │
│          │  → 심각한 Lock 경합, 성능 최악                         │
│          │  → 특별한 이유 없으면 사용하지 말 것                   │
│          │                                                        │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                        │
│   AUTO   │  Hibernate가 DB 방언(Dialect)에 따라 자동 선택         │
│          │  Hibernate 5: 대부분 TABLE → 의도치 않은 성능 저하     │
│          │  Hibernate 6: 대부분 SEQUENCE → 개선됨                 │
│          │                                                        │
└──────────┴──────────────────────────────────────────────────────┘
```

## 왜 SEQUENCE가 중요한가?

```
┌─────────────────────────────────────────────────────────────────┐
│              IDENTITY vs SEQUENCE: 배치 성능 차이                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [IDENTITY 전략] - 5개 엔티티 저장                               │
│                                                                   │
│  App ──INSERT──→ DB   (id=1 반환)                                │
│  App ──INSERT──→ DB   (id=2 반환)                                │
│  App ──INSERT──→ DB   (id=3 반환)                                │
│  App ──INSERT──→ DB   (id=4 반환)                                │
│  App ──INSERT──→ DB   (id=5 반환)                                │
│                                                                   │
│  → 5번의 개별 INSERT (배치 불가능)                                │
│  → INSERT를 실행해야 ID를 알 수 있으므로 Write-Behind 불가       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [SEQUENCE 전략] - 5개 엔티티 저장                               │
│                                                                   │
│  App ──SELECT nextval──→ DB  (id=1)                              │
│  App ──SELECT nextval──→ DB  (id=2)                              │
│  App ──SELECT nextval──→ DB  (id=3)                              │
│  App ──SELECT nextval──→ DB  (id=4)                              │
│  App ──SELECT nextval──→ DB  (id=5)                              │
│  App ──BATCH INSERT(5건)──→ DB  ← 한 번에!                      │
│                                                                   │
│  → ID를 미리 확보하므로 INSERT를 모아서 실행 가능                │
│  → 하지만 여전히 5번의 시퀀스 조회가 필요...                     │
│                                                                   │
│  이 "시퀀스 조회 횟수"를 줄이는 것이 Optimizer의 역할!           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경: 왜 Optimizer가 필요한가?

## 문제: 시퀀스 조회가 병목이 되는 순간

```
┌─────────────────────────────────────────────────────────────────┐
│             대량 INSERT 시나리오: 사용자 10,000명 일괄 등록        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Optimizer 없이 (allocationSize=1)]                             │
│                                                                   │
│  매 INSERT마다 SELECT nextval('user_seq') 호출                   │
│                                                                   │
│  시퀀스 호출: 10,000번                                           │
│  INSERT 호출: 10,000번 (batch=100이면 100번)                     │
│  ─────────────────────                                           │
│  총 DB 왕복:  10,100번                                           │
│                                                                   │
│  Network Latency가 1ms라면 → 시퀀스 조회만 10초                  │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Optimizer 사용 (allocationSize=50)]                            │
│                                                                   │
│  50개 ID를 한 번에 예약하고 메모리에서 할당                      │
│                                                                   │
│  시퀀스 호출: 200번 (10,000 ÷ 50)                                │
│  INSERT 호출: 100번 (batch=100)                                  │
│  ─────────────────────                                           │
│  총 DB 왕복:  300번                                              │
│                                                                   │
│  → 97% 감소! (10,100 → 300)                                     │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Optimizer + Batch Size 정렬 (allocationSize=100, batch=100)]   │
│                                                                   │
│  시퀀스 호출: 100번 (10,000 ÷ 100)                               │
│  INSERT 호출: 100번 (batch=100)                                  │
│  ─────────────────────                                           │
│  총 DB 왕복:  200번                                              │
│                                                                   │
│  → 98% 감소! (10,100 → 200)                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Hibernate의 역사적 발전

```
┌─────────────────────────────────────────────────────────────────┐
│              Hibernate ID 생성 전략의 진화                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Hibernate 3.x (2005~)                                           │
│  ├── SequenceHiLoGenerator (레거시)                              │
│  ├── Hi/Lo 알고리즘 최초 도입                                    │
│  └── 문제: 외부 시스템과 ID 충돌                                 │
│                                                                   │
│  Hibernate 4.x (2011~)                                           │
│  ├── enhanced.SequenceStyleGenerator 등장                        │
│  ├── new_generator_mappings = false (기본값)                     │
│  │   └── 여전히 레거시 제너레이터 사용                           │
│  └── Pooled Optimizer 개념 등장                                  │
│                                                                   │
│  Hibernate 5.x (2015~)                                           │
│  ├── new_generator_mappings = true (기본값 변경!)                │
│  │   └── enhanced 제너레이터가 기본으로                          │
│  ├── PooledOptimizer가 기본 Optimizer                            │
│  ├── hibernate_sequence (글로벌 단일 시퀀스)                     │
│  └── Spring Boot 1.4가 false로 다시 오버라이드 (하위호환)        │
│                                                                   │
│  Hibernate 6.x (2022~)                                           │
│  ├── hibernate_sequence 제거 → 엔티티별 시퀀스                   │
│  │   └── User → user_SEQ, Order → order_SEQ                     │
│  ├── allocationSize와 INCREMENT BY 불일치 시 에러               │
│  │   └── SchemaManagementException 발생                          │
│  ├── new_generator_mappings 설정 제거                            │
│  └── 5→6 마이그레이션 시 가장 큰 장애물 중 하나                 │
│                                                                   │
│  Hibernate 7.0 (예정)                                            │
│  ├── Jakarta Persistence 3.2 표준 준수                           │
│  ├── pooled-lo를 기본으로 변경 논의 중                           │
│  └── @SequenceGenerator 개선                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. DB Sequence 기초

## Sequence란?

```
┌─────────────────────────────────────────────────────────────────┐
│                    Database Sequence 개념                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sequence = DB가 관리하는 독립적인 카운터 객체                    │
│                                                                   │
│  테이블과 독립적으로 존재                                         │
│  트랜잭션 롤백해도 시퀀스 값은 돌아가지 않음 (갭 발생 가능)     │
│  여러 테이블이 하나의 시퀀스를 공유할 수 있음                    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  -- PostgreSQL 시퀀스 생성                                   │ │
│  │  CREATE SEQUENCE user_seq                                    │ │
│  │      START WITH 1                                            │ │
│  │      INCREMENT BY 50          ← allocationSize과 일치!      │ │
│  │      NO MINVALUE                                             │ │
│  │      NO MAXVALUE                                             │ │
│  │      CACHE 1;                                                │ │
│  │                                                               │ │
│  │  -- 다음 값 조회                                              │ │
│  │  SELECT nextval('user_seq');   → 1                           │ │
│  │  SELECT nextval('user_seq');   → 51                          │ │
│  │  SELECT nextval('user_seq');   → 101                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  핵심: INCREMENT BY = 50이므로 nextval은 50씩 증가               │
│  Hibernate는 이 간격 사이의 값을 메모리에서 할당한다             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## JPA @SequenceGenerator 매핑

```java
@Entity
public class User {

    @Id
    @GeneratedValue(
        strategy = GenerationType.SEQUENCE,
        generator = "user_gen"
    )
    @SequenceGenerator(
        name = "user_gen",
        sequenceName = "user_seq",   // DB 시퀀스 이름
        allocationSize = 50          // 한 번에 예약할 ID 개수
    )
    private Long id;

    // ...
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│              allocationSize의 의미                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  allocationSize = 50 (JPA 기본값)                                │
│                                                                   │
│  의미: "DB에서 시퀀스 값을 한 번 가져오면,                       │
│         메모리에서 50개의 ID를 순차 할당한다"                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                                                          │     │
│  │  nextval = 1   → 메모리에서 1, 2, 3, ..., 50 할당       │     │
│  │  nextval = 51  → 메모리에서 51, 52, 53, ..., 100 할당   │     │
│  │  nextval = 101 → 메모리에서 101, 102, ..., 150 할당     │     │
│  │                                                          │     │
│  │  DB 호출 50번 → 1번으로 감소 (50배 성능 향상)            │     │
│  │                                                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  주의: allocationSize = 1이면 Optimizer 효과 없음                │
│        매번 nextval 호출 = allocationSize의 의미가 없어짐        │
│                                                                   │
│  ⚠️ 중요: DB의 INCREMENT BY와 반드시 일치시켜야 함              │
│  allocationSize=50이면 → CREATE SEQUENCE ... INCREMENT BY 50    │
│  불일치 시 Hibernate 6에서 SchemaManagementException 발생        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Optimizer 4종 상세 분석

## 전체 비교 요약

```
┌────────────┬──────────────┬───────────────┬───────────┬───────────────┐
│ Optimizer  │ 시퀀스 해석   │ ID 범위 계산  │ 외부호환  │ 상태          │
├────────────┼──────────────┼───────────────┼───────────┼───────────────┤
│ none       │ 값 그대로    │ N/A (1:1)     │ ✅ 완벽   │ 기본(size=1) │
│ hi/lo      │ 버킷 번호    │ hi×size~      │ ❌ 불가   │ 레거시(폐기) │
│ pooled     │ 상한값       │ val-size+1~val│ ✅ 가능   │ 현재 기본     │
│ pooled-lo  │ 하한값       │ val~val+size-1│ ✅ 가능   │ 권장 (최선)   │
└────────────┴──────────────┴───────────────┴───────────┴───────────────┘
```

## 4-1. None Optimizer (allocationSize = 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                    None Optimizer                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  동작: 매 persist() 마다 SELECT nextval() 호출                   │
│  시퀀스 값 = 그대로 ID로 사용                                    │
│                                                                   │
│  DB Sequence: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ...                │
│  생성 ID:     1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ...                │
│                ↑  ↑  ↑  ↑  ↑                                     │
│                매번 DB 호출                                       │
│                                                                   │
│  장점: 단순함, ID에 갭이 거의 없음, 외부 시스템 완벽 호환       │
│  단점: 성능 최악 - INSERT마다 DB 왕복 필요                       │
│                                                                   │
│  사용 시기:                                                       │
│  ├── 삽입량이 매우 적은 테이블 (설정 테이블 등)                  │
│  ├── ID 연속성이 비즈니스 요구사항인 경우                        │
│  └── allocationSize = 1로 설정하면 자동 적용                     │
│                                                                   │
│  설정:                                                            │
│  @SequenceGenerator(allocationSize = 1)                          │
│  DB: CREATE SEQUENCE user_seq INCREMENT BY 1;                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 4-2. Hi/Lo Optimizer (레거시 - 사용 금지)

```
┌─────────────────────────────────────────────────────────────────┐
│                Hi/Lo Optimizer (레거시)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  핵심 알고리즘:                                                   │
│  ├── hi = DB에서 가져온 시퀀스 값 (버킷 번호)                    │
│  ├── lo = 0부터 incrementSize까지 로컬 카운터                    │
│  └── 실제 ID = hi × incrementSize + lo                           │
│                                                                   │
│  예시 (incrementSize = 3):                                       │
│                                                                   │
│  DB Sequence: 0, 1, 2, 3 ...     ← INCREMENT BY 1 (주의!)      │
│                                                                   │
│  hi=0: lo=0 → ID=0, lo=1 → ID=1, lo=2 → ID=2                  │
│  hi=1: lo=0 → ID=3, lo=1 → ID=4, lo=2 → ID=5                  │
│  hi=2: lo=0 → ID=6, lo=1 → ID=7, lo=2 → ID=8                  │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  ⚠️ 치명적 문제: 외부 시스템 호환 불가                           │
│                                                                   │
│  DB 시퀀스 현재 값: 2                                            │
│  실제 사용 중인 ID: 0, 1, 2, 3, 4, 5, 6, 7, 8                  │
│                                                                   │
│  외부 시스템이 nextval() 호출 → 3                                │
│  외부 시스템이 ID=3으로 INSERT → 충돌!                           │
│  (Hibernate는 이미 hi=1일 때 ID=3을 사용했음)                    │
│                                                                   │
│  이유: 시퀀스 값(3)과 실제 ID(3×3=9~11)의 관계를                │
│        외부 시스템이 알 수 없기 때문                              │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  결론:                                                            │
│  ├── Hibernate 5+ 에서 deprecated                                │
│  ├── new_generator_mappings=true 시 사용되지 않음                │
│  ├── 단독 시스템에서만 안전 (DB에 직접 INSERT 없을 때)           │
│  └── 마이그레이션 필요: pooled 또는 pooled-lo로 전환             │
│                                                                   │
│  마이그레이션 SQL:                                                │
│  ALTER SEQUENCE user_seq RESTART WITH [MAX(id) + 1];             │
│  ALTER SEQUENCE user_seq INCREMENT BY 50;                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 4-3. Pooled Optimizer (현재 기본값)

```
┌─────────────────────────────────────────────────────────────────┐
│                  Pooled Optimizer                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  핵심: 시퀀스 값을 ID 풀의 "상한(upper bound)"으로 사용          │
│                                                                   │
│  알고리즘 (allocationSize = 50):                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  nextval() → 1 (첫 호출)                              │       │
│  │  ID 범위 = [1-50+1, 1] = 사실상 ID=1만 사용           │       │
│  │                                                        │       │
│  │  nextval() → 51                                        │       │
│  │  ID 범위 = [51-50+1, 51] = [2, 51]                    │       │
│  │  메모리에서 2, 3, 4, ..., 51 순차 할당                 │       │
│  │                                                        │       │
│  │  nextval() → 101                                       │       │
│  │  ID 범위 = [101-50+1, 101] = [52, 101]                │       │
│  │  메모리에서 52, 53, 54, ..., 101 순차 할당             │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  Java 의사코드 (PooledOptimizer.java 기반):                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  class PooledOptimizer {                               │       │
│  │      long hiValue;    // DB에서 가져온 시퀀스 값       │       │
│  │      long value;      // 현재 할당 중인 ID             │       │
│  │                                                        │       │
│  │      long generate() {                                 │       │
│  │          if (hiValue == UNSET) {                        │       │
│  │              hiValue = nextval();  // DB 호출           │       │
│  │              value = hiValue;      // 첫 값 = 상한     │       │
│  │              return value;                              │       │
│  │          }                                              │       │
│  │          if (value >= hiValue) {   // 풀 소진           │       │
│  │              hiValue = nextval();  // DB 호출           │       │
│  │              value = hiValue - incrementSize + 1;       │       │
│  │          }                                              │       │
│  │          return value++;                                │       │
│  │      }                                                  │       │
│  │  }                                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  장점:                                                            │
│  ├── Hi/Lo 대비 외부 시스템 호환 가능                            │
│  ├── 시퀀스 값이 실제 ID 범위에 포함됨                           │
│  └── DB 호출 횟수 대폭 감소                                      │
│                                                                   │
│  ⚠️ 치명적 버그: 음수 ID 생성 가능!                              │
│                                                                   │
│  시나리오: 시퀀스를 수동으로 낮은 값으로 리셋한 경우             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  시퀀스 값: 3 (수동 리셋 후)                           │       │
│  │  allocationSize: 50                                    │       │
│  │                                                        │       │
│  │  ID 범위 = [3 - 50 + 1, 3] = [-46, 3]                 │       │
│  │                                                        │       │
│  │  → -46, -45, -44, ... , 0, 1, 2, 3 이 생성됨!         │       │
│  │  → 기존 PK와 충돌 가능!                                │       │
│  │  → Hibernate JIRA HHH-10683                            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  이 버그가 발생하는 상황:                                         │
│  ├── DB 마이그레이션 후 시퀀스 리셋                              │
│  ├── 테스트 데이터 초기화                                        │
│  ├── 백업 복원 후 시퀀스 재설정                                  │
│  └── 개발 환경에서 수동 시퀀스 조작                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 4-4. Pooled-Lo Optimizer (권장)

```
┌─────────────────────────────────────────────────────────────────┐
│                Pooled-Lo Optimizer (권장)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  핵심: 시퀀스 값을 ID 풀의 "하한(lower bound)"으로 사용          │
│                                                                   │
│  알고리즘 (allocationSize = 50):                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  nextval() → 1                                         │       │
│  │  ID 범위 = [1, 1+50-1] = [1, 50]                      │       │
│  │  메모리에서 1, 2, 3, ..., 50 순차 할당                 │       │
│  │                                                        │       │
│  │  nextval() → 51                                        │       │
│  │  ID 범위 = [51, 51+50-1] = [51, 100]                  │       │
│  │  메모리에서 51, 52, 53, ..., 100 순차 할당             │       │
│  │                                                        │       │
│  │  nextval() → 101                                       │       │
│  │  ID 범위 = [101, 101+50-1] = [101, 150]               │       │
│  │  메모리에서 101, 102, 103, ..., 150 순차 할당          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  Java 의사코드 (PooledLoOptimizer.java 기반):                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  class PooledLoOptimizer {                             │       │
│  │      long lastSourceValue;  // DB에서 가져온 시퀀스 값 │       │
│  │      long value;            // 현재 할당 중인 ID       │       │
│  │      long hiValue;          // 이 풀의 상한            │       │
│  │                                                        │       │
│  │      long generate() {                                 │       │
│  │          if (lastSourceValue == UNSET                   │       │
│  │              || value >= hiValue) {   // 풀 소진        │       │
│  │              lastSourceValue = nextval();  // DB 호출   │       │
│  │              value = lastSourceValue;      // 하한      │       │
│  │              hiValue = lastSourceValue                   │       │
│  │                       + incrementSize - 1; // 상한      │       │
│  │          }                                              │       │
│  │          return value++;                                │       │
│  │      }                                                  │       │
│  │  }                                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  Pooled vs Pooled-Lo 핵심 차이:                                  │
│                                                                   │
│  시퀀스 값 = 3, allocationSize = 50                              │
│                                                                   │
│  Pooled:    [3-50+1, 3]   = [-46, 3]   ← 음수 ID 발생!         │
│  Pooled-Lo: [3, 3+50-1]   = [3, 52]    ← 직관적, 안전          │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  왜 Pooled-Lo가 기본값이 아닌가?                                 │
│                                                                   │
│  Steve Ebersole (Hibernate ORM Lead):                            │
│  "pooled-lo should really be the default, but changing it        │
│   would break backward compatibility"                            │
│                                                                   │
│  → Quarkus는 자체 설정 레이어에서 pooled-lo를 기본으로 채택     │
│  → Hibernate 7에서 기본값 변경 논의 중                           │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  Pooled → Pooled-Lo 전환 안전성:                                 │
│                                                                   │
│  기존에 pooled가 시퀀스를 151까지 사용한 상태에서                │
│  pooled-lo로 전환하면:                                            │
│  → nextval() = 151                                               │
│  → pooled-lo는 [151, 200] 범위를 사용                            │
│  → 기존 ID(~150)와 충돌 없음 (갭만 생김)                        │
│  → 안전하게 전환 가능!                                            │
│                                                                   │
│  설정 방법:                                                       │
│  # application.yml                                               │
│  spring.jpa.properties.hibernate.id.optimizer.pooled.preferred:  │
│    pooled-lo                                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 시각적 비교: 4가지 Optimizer 동작

```
┌─────────────────────────────────────────────────────────────────┐
│     4가지 Optimizer 동작 비교 (allocationSize=5)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DB Sequence (INCREMENT BY 5): 1, 6, 11, 16, 21 ...             │
│                                                                   │
│  [None]                                                           │
│  nextval=1 → ID=1                                                │
│  nextval=6 → ID=6     ← ID 2,3,4,5 건너뜀!                     │
│  nextval=11 → ID=11                                              │
│  → DB 호출: 매번 / 갭: 큼                                        │
│                                                                   │
│  [Hi/Lo] (DB INCREMENT BY 1일 때)                                │
│  nextval=0 → ID: 0,1,2,3,4                                      │
│  nextval=1 → ID: 5,6,7,8,9                                      │
│  nextval=2 → ID: 10,11,12,13,14                                 │
│  → DB 호출: 5회당 1회 / 외부 호환: ❌                            │
│                                                                   │
│  [Pooled]                                                         │
│  nextval=1  → ID: 1                                              │
│  nextval=6  → ID: 2,3,4,5,6                                     │
│  nextval=11 → ID: 7,8,9,10,11                                   │
│  → DB 호출: 5회당 1회 / 외부 호환: ✅                            │
│                                                                   │
│  [Pooled-Lo]                                                      │
│  nextval=1  → ID: 1,2,3,4,5                                     │
│  nextval=6  → ID: 6,7,8,9,10                                    │
│  nextval=11 → ID: 11,12,13,14,15                                │
│  → DB 호출: 5회당 1회 / 외부 호환: ✅ / 직관적: ✅              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Hibernate 6 Breaking Changes

## 핵심 변경사항

```
┌─────────────────────────────────────────────────────────────────┐
│              Hibernate 5 → 6 ID 생성 관련 변경                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ① 글로벌 시퀀스 제거                                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Hibernate 5:                                          │       │
│  │  모든 엔티티 → hibernate_sequence (하나의 시퀀스)      │       │
│  │                                                        │       │
│  │  User.id  ──┐                                          │       │
│  │  Order.id ──┼──→ hibernate_sequence                    │       │
│  │  Item.id  ──┘                                          │       │
│  │                                                        │       │
│  │  Hibernate 6:                                          │       │
│  │  각 엔티티 → 전용 시퀀스                               │       │
│  │                                                        │       │
│  │  User.id  ──→ user_SEQ                                 │       │
│  │  Order.id ──→ order_SEQ                                │       │
│  │  Item.id  ──→ item_SEQ                                 │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  영향: 기존 hibernate_sequence에 의존하던 앱은                   │
│        마이그레이션 시 시퀀스를 새로 생성해야 함                 │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  ② allocationSize / INCREMENT BY 일치 강제                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Hibernate 5:                                          │       │
│  │  @SequenceGenerator(allocationSize = 50)               │       │
│  │  DB: CREATE SEQUENCE user_seq INCREMENT BY 1;          │       │
│  │  → 경고 없이 동작 (내부적으로 보정)                    │       │
│  │                                                        │       │
│  │  Hibernate 6:                                          │       │
│  │  @SequenceGenerator(allocationSize = 50)               │       │
│  │  DB: CREATE SEQUENCE user_seq INCREMENT BY 1;          │       │
│  │  → SchemaManagementException 발생!                     │       │
│  │    "Sequence 'user_seq' has increment size 1           │       │
│  │     but allocationSize is 50"                          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  해결 방법:                                                       │
│  ├── A) DB 시퀀스 수정: ALTER SEQUENCE user_seq INCREMENT BY 50  │
│  ├── B) allocationSize 수정: @SequenceGenerator(allocSize = 1)   │
│  └── C) 검증 비활성화 (비권장):                                  │
│         hibernate.id.sequence.increment_size_mismatch_strategy   │
│         = LOG / FIX / NONE                                       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  ③ new_generator_mappings 설정 제거                              │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Hibernate 5:                                          │       │
│  │  hibernate.id.new_generator_mappings = true/false      │       │
│  │  → false: 레거시 SequenceHiLoGenerator 사용            │       │
│  │  → true: enhanced SequenceStyleGenerator 사용          │       │
│  │                                                        │       │
│  │  Hibernate 6:                                          │       │
│  │  설정 자체가 제거됨                                    │       │
│  │  → 항상 enhanced generator만 사용                      │       │
│  │  → 레거시 Hi/Lo 사용 불가                              │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  ④ Spring Boot 3 + Hibernate 6 마이그레이션 체크리스트           │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  □ hibernate_sequence → 엔티티별 시퀀스 생성          │       │
│  │  □ INCREMENT BY와 allocationSize 일치 확인            │       │
│  │  □ new_generator_mappings 설정 제거                   │       │
│  │  □ Hi/Lo 사용 시 pooled 또는 pooled-lo로 전환         │       │
│  │  □ 시퀀스 현재 값 = MAX(id) + allocationSize 확인     │       │
│  │  □ 테스트 환경에서 ID 생성 검증                       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Flyway 마이그레이션 스크립트 예시

```sql
-- V10__hibernate6_sequence_migration.sql
-- Hibernate 5 → 6 시퀀스 마이그레이션

-- 1. 기존 글로벌 시퀀스에서 현재 값 확인
SELECT last_value FROM hibernate_sequence;

-- 2. 엔티티별 시퀀스 생성 (현재 최대 ID + allocationSize 기준)
CREATE SEQUENCE user_SEQ
    START WITH (SELECT MAX(id) + 50 FROM users)
    INCREMENT BY 50
    NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE order_SEQ
    START WITH (SELECT MAX(id) + 50 FROM orders)
    INCREMENT BY 50
    NO MINVALUE NO MAXVALUE CACHE 1;

-- 3. 글로벌 시퀀스 제거 (확인 후)
-- DROP SEQUENCE hibernate_sequence;
```

---

# 6. 성능과 Multi-JVM 안전성

## 성능 벤치마크

```
┌─────────────────────────────────────────────────────────────────┐
│              실제 성능 측정 사례                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [사례 1] allocationSize 효과 (10,000건 INSERT)                  │
│                                                                   │
│  allocationSize=1  : DB 호출 10,000회 → ~10초                    │
│  allocationSize=50 : DB 호출 200회   → ~0.5초                    │
│  allocationSize=100: DB 호출 100회   → ~0.3초                    │
│                                                                   │
│  → allocationSize=50으로도 20배 성능 향상                        │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [사례 2] Batch Insert + Optimizer 조합                          │
│                                                                   │
│  1,000건 INSERT 기준:                                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ 구성                      │ DB 왕복  │ 대비        │        │
│  ├───────────────────────────┼──────────┼─────────────┤        │
│  │ allocSize=1, batch=1      │ 2,000회  │ 기준(100%)  │        │
│  │ allocSize=1, batch=100    │ 1,010회  │ 50%         │        │
│  │ allocSize=100, batch=1    │ 1,010회  │ 50%         │        │
│  │ allocSize=100, batch=100  │ 20회     │ 1% (99%↓)  │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                   │
│  → allocSize과 batch_size를 함께 최적화해야 최대 효과            │
│  → 권장: 둘을 같은 값으로 설정 (예: 둘 다 100)                  │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [사례 3] Hypersistence Batch Sequence Generator                 │
│                                                                   │
│  PostgreSQL generate_series를 활용한 대안:                       │
│  SELECT nextval('seq') FROM generate_series(1, 5);               │
│  → 5개 ID를 한 번의 SQL로 조회                                   │
│  → DB 시퀀스 INCREMENT BY 1 유지 가능                            │
│  → allocationSize 불일치 문제 원천 차단                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-JVM 클러스터 안전성

```
┌─────────────────────────────────────────────────────────────────┐
│          Multi-JVM 환경에서 Optimizer 동작                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [pooled-lo, allocationSize=50]                                  │
│                                                                   │
│  JVM-1이 nextval() 호출 → 1                                     │
│  JVM-1의 ID 풀: [1, 50]                                         │
│                                                                   │
│  JVM-2가 nextval() 호출 → 51                                    │
│  JVM-2의 ID 풀: [51, 100]                                       │
│                                                                   │
│  JVM-3가 nextval() 호출 → 101                                   │
│  JVM-3의 ID 풀: [101, 150]                                      │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │  JVM-1   │  │  JVM-2   │  │  JVM-3   │                     │
│  │  1~50    │  │  51~100  │  │  101~150 │                     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                     │
│       │              │              │                             │
│       └──────────────┼──────────────┘                             │
│                      ▼                                            │
│           ┌──────────────────┐                                   │
│           │   DB Sequence    │                                   │
│           │   현재값: 151    │                                   │
│           │   (다음 호출 시) │                                   │
│           └──────────────────┘                                   │
│                                                                   │
│  → 각 JVM은 겹치지 않는 ID 범위를 확보                           │
│  → DB 시퀀스의 원자성(atomicity)이 충돌 방지                     │
│  → 추가 동기화 메커니즘 불필요                                    │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  ⚠️ ID 갭 발생 패턴:                                             │
│                                                                   │
│  JVM-1이 ID 1~30까지만 사용하고 종료                             │
│  → 31~50은 영원히 사용되지 않음 (갭)                             │
│  → 이는 정상 동작이며 문제가 아님                                │
│  → PK는 비즈니스 의미를 가지면 안 됨                             │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  외부 시스템 동시 접근 시:                                        │
│                                                                   │
│  외부 배치 작업이 nextval() 호출 → 151                           │
│  → JVM-1~3의 범위(1~150)와 충돌 없음                            │
│  → pooled/pooled-lo의 핵심 장점                                  │
│  → Hi/Lo였다면 충돌 발생했을 것                                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## JDBC Batch 최적화 설정

```yaml
# application.yml - 최적 성능 설정
spring:
  jpa:
    properties:
      hibernate:
        # Batch Insert 활성화
        jdbc.batch_size: 100
        # 같은 엔티티 타입끼리 모아서 배치
        order_inserts: true
        order_updates: true
        # Pooled-Lo Optimizer 사용
        id.optimizer.pooled.preferred: pooled-lo
        # Batch versioned data (낙관적 락 사용 시)
        jdbc.batch_versioned_data: true
```

```
┌─────────────────────────────────────────────────────────────────┐
│           IDENTITY vs SEQUENCE: Batch 동작 차이                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [IDENTITY - Batch 불가능]                                       │
│                                                                   │
│  em.persist(user1) → 즉시 INSERT (ID 필요)                      │
│  em.persist(user2) → 즉시 INSERT (ID 필요)                      │
│  em.persist(user3) → 즉시 INSERT (ID 필요)                      │
│  em.flush()        → 이미 다 실행됨                              │
│                                                                   │
│  → Write-Behind 전략 무력화                                      │
│  → 트랜잭션 끝까지 INSERT 지연 불가                              │
│                                                                   │
│  [SEQUENCE + Pooled-Lo - Batch 최적화]                           │
│                                                                   │
│  em.persist(user1) → nextval() 1번 → 50개 ID 확보               │
│  em.persist(user2) → 메모리에서 ID 할당 (DB 호출 없음)          │
│  em.persist(user3) → 메모리에서 ID 할당 (DB 호출 없음)          │
│  ...                                                              │
│  em.flush()        → BATCH INSERT 한 번에 실행!                  │
│                                                                   │
│  → Hibernate의 Write-Behind 완전 활용                            │
│  → 대량 INSERT 성능 극대화                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 대안 기술: DB Sequence를 넘어서

## UUID v7 (RFC 9562, 2024)

```
┌─────────────────────────────────────────────────────────────────┐
│                       UUID v7                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  UUID v4 (기존): 완전 랜덤                                       │
│  550e8400-e29b-41d4-a716-446655440000                            │
│  → B-tree 인덱스 성능 최악 (랜덤 삽입 = 페이지 스플릿)          │
│                                                                   │
│  UUID v7 (신규): 시간 기반 정렬 가능                              │
│  018e4c6b-3c00-7000-8000-000000000001                            │
│  ├── 48-bit: Unix 밀리초 타임스탬프                              │
│  ├── 4-bit: 버전 (7)                                             │
│  ├── 12-bit: 랜덤/카운터                                         │
│  ├── 2-bit: variant                                              │
│  └── 62-bit: 랜덤                                                │
│                                                                   │
│  장점:                                                            │
│  ├── 시간순 정렬 → B-tree 인덱스 순차 삽입 (성능 우수)          │
│  ├── DB 시퀀스 불필요 → 분산 환경에서 충돌 없음                  │
│  ├── 애플리케이션에서 생성 → DB 왕복 0회                         │
│  └── 128-bit → 사실상 충돌 확률 0                                │
│                                                                   │
│  단점:                                                            │
│  ├── 16 bytes (BIGINT 8 bytes 대비 2배 저장 공간)                │
│  ├── JOIN/FK에서 비교 연산 비용 증가                             │
│  ├── 인간이 읽기 어려움 (디버깅 시 불편)                         │
│  └── 일부 DB에서 UUID 타입 미지원                                │
│                                                                   │
│  Java 구현:                                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  // Java 17+ (외부 라이브러리)                         │       │
│  │  // com.fasterxml.uuid:java-uuid-generator            │       │
│  │  UUID id = Generators.timeBasedEpochGenerator()        │       │
│  │                        .generate(); // UUID v7         │       │
│  │                                                        │       │
│  │  // JPA 매핑                                           │       │
│  │  @Id                                                   │       │
│  │  @GeneratedValue(generator = "uuid7")                  │       │
│  │  @GenericGenerator(name = "uuid7",                     │       │
│  │      strategy = "com.example.UUIDv7Generator")         │       │
│  │  @Column(columnDefinition = "uuid")                    │       │
│  │  private UUID id;                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## TSID (Time-Sorted Unique Identifier)

```
┌─────────────────────────────────────────────────────────────────┐
│                         TSID                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Twitter Snowflake ID를 기반으로 한 64-bit ID                    │
│  → BIGINT 컬럼에 저장 가능 (UUID 대비 50% 공간 절약)            │
│                                                                   │
│  구조 (64-bit):                                                   │
│  ┌──────────────────────────────────────────────┐               │
│  │ [42-bit 타임스탬프] [22-bit 랜덤/노드]       │               │
│  │                                                │               │
│  │ 42-bit: ~139년 커버 (2^42 밀리초)             │               │
│  │ 22-bit: 노드 ID + 카운터                      │               │
│  │         → 같은 밀리초 내 4,194,304개 고유 ID   │               │
│  └──────────────────────────────────────────────┘               │
│                                                                   │
│  장점:                                                            │
│  ├── 8 bytes (BIGINT) → UUID 대비 50% 절약                      │
│  ├── 시간순 정렬 가능 → B-tree 인덱스 순차 삽입                 │
│  ├── DB 시퀀스 불필요 → 분산 환경 완벽 지원                     │
│  ├── Long 타입 → 기존 BIGINT PK와 호환                          │
│  └── 초당 수백만 개 생성 가능                                    │
│                                                                   │
│  단점:                                                            │
│  ├── 69년 후 타임스탬프 오버플로 (2^42 ms ≈ 139년)              │
│  ├── 외부 라이브러리 의존 (hypersistence-tsid)                   │
│  └── 서버 시계 동기화 필요 (NTP)                                 │
│                                                                   │
│  Java 구현 (Hypersistence Utils):                                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  @Id                                                   │       │
│  │  @Tsid                                                 │       │
│  │  private Long id;                                      │       │
│  │                                                        │       │
│  │  // 또는 문자열로                                      │       │
│  │  @Id                                                   │       │
│  │  @Tsid                                                 │       │
│  │  private String id;  // "0AWE5R050R08G"                │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Snowflake ID (Twitter, 2010)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Snowflake ID                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Twitter가 분산 시스템에서 DB 없이 고유 ID를 생성하기 위해 설계  │
│                                                                   │
│  64-bit 구조:                                                     │
│  ┌───┬───────────────────┬─────────┬──────────────┐             │
│  │ 0 │ 41-bit timestamp  │ 10-bit  │ 12-bit       │             │
│  │   │ (밀리초)           │ 머신ID │ 시퀀스번호   │             │
│  └───┴───────────────────┴─────────┴──────────────┘             │
│                                                                   │
│  1-bit:  부호 (항상 0, 양수)                                     │
│  41-bit: 커스텀 에포크 기준 밀리초 (~69년)                       │
│  10-bit: 5-bit 데이터센터 + 5-bit 워커 (1024대 머신)            │
│  12-bit: 밀리초 내 시퀀스 (4096/ms = 초당 400만 ID)             │
│                                                                   │
│  변형 사례:                                                       │
│  ├── Discord: 에포크 기준 변경 (Discord 서비스 시작일)           │
│  ├── Instagram: 13-bit 샤드 ID (더 많은 머신 풀)                │
│  └── Baidu: uid-generator (Java 구현)                            │
│                                                                   │
│  vs Hibernate Sequence Optimizer:                                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │           │ Sequence Optimizer │ Snowflake ID        │       │
│  │ DB 의존   │ 시퀀스 필요        │ DB 불필요           │       │
│  │ 분산 안전 │ 시퀀스 원자성      │ 머신ID 분리         │       │
│  │ 정렬      │ 순차 증가          │ 시간순 정렬         │       │
│  │ 저장 크기 │ 8 bytes            │ 8 bytes             │       │
│  │ 시계 의존 │ 불필요             │ NTP 필수            │       │
│  │ 생성 속도 │ DB 왕복 필요       │ 메모리 내 즉시      │       │
│  │ 적합 환경 │ 단일/소규모 클러스터│ 대규모 분산 시스템 │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 전략 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                  ID 생성 전략 선택 플로차트                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Q1: 분산 시스템인가? (마이크로서비스, 멀티 리전)                │
│  │                                                                │
│  ├── YES → Q2: DB 시퀀스를 쓸 수 있는가?                        │
│  │   │                                                            │
│  │   ├── YES → pooled-lo + allocationSize=100                    │
│  │   │         (검증된 방식, 외부 호환 가능)                     │
│  │   │                                                            │
│  │   └── NO → Q3: ID 크기 제약이 있는가?                        │
│  │       │                                                        │
│  │       ├── 8 bytes 제한 → TSID 또는 Snowflake                 │
│  │       └── 제한 없음 → UUID v7                                 │
│  │                                                                │
│  └── NO → Q4: 대량 INSERT가 있는가?                             │
│      │                                                            │
│      ├── YES → SEQUENCE + pooled-lo + batch_size 정렬            │
│      │                                                            │
│      └── NO → Q5: MySQL만 사용하는가?                            │
│          │                                                        │
│          ├── YES → IDENTITY (MySQL은 시퀀스 미지원)              │
│          │         단, batch INSERT 성능 포기                    │
│          │                                                        │
│          └── NO → SEQUENCE + pooled-lo (기본 권장)               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 실전 설정 가이드

## Spring Boot + PostgreSQL 권장 설정

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
  jpa:
    hibernate:
      ddl-auto: validate  # 운영: validate, 개발: update
    properties:
      hibernate:
        # ===== ID 생성 최적화 =====
        # Pooled-Lo를 기본 Optimizer로 사용
        id.optimizer.pooled.preferred: pooled-lo

        # ===== Batch 최적화 =====
        jdbc.batch_size: 50         # allocationSize과 일치 권장
        order_inserts: true
        order_updates: true
        jdbc.batch_versioned_data: true

        # ===== Dialect =====
        dialect: org.hibernate.dialect.PostgreSQLDialect
```

## 엔티티 설정 패턴

```java
// ===== 패턴 1: 기본 SEQUENCE (가장 일반적) =====
@Entity
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "user_gen")
    @SequenceGenerator(name = "user_gen",
                       sequenceName = "user_seq",
                       allocationSize = 50)
    private Long id;
}

// DB: CREATE SEQUENCE user_seq INCREMENT BY 50;


// ===== 패턴 2: 대량 INSERT 최적화 =====
@Entity
public class EventLog {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "event_gen")
    @SequenceGenerator(name = "event_gen",
                       sequenceName = "event_log_seq",
                       allocationSize = 200)  // 대량 INSERT 대비
    private Long id;
}

// DB: CREATE SEQUENCE event_log_seq INCREMENT BY 200;
// application.yml: jdbc.batch_size: 200


// ===== 패턴 3: 외부 연동 (보수적) =====
@Entity
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "payment_gen")
    @SequenceGenerator(name = "payment_gen",
                       sequenceName = "payment_seq",
                       allocationSize = 1)  // 외부 시스템과 완전 호환
    private Long id;
}

// DB: CREATE SEQUENCE payment_seq INCREMENT BY 1;
// → 성능 낮지만 ID 갭 없음, 외부 시스템 완벽 호환


// ===== 패턴 4: TSID (분산 환경) =====
@Entity
public class Order {
    @Id
    @Tsid
    private Long id;  // DB 시퀀스 불필요, 애플리케이션에서 생성
}
```

## 트러블슈팅 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                     자주 발생하는 문제                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  문제 1: SchemaManagementException                               │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  "Schema-validation: sequence [user_seq] defined     │       │
│  │   increment [1] does not match allocationSize [50]"  │       │
│  └──────────────────────────────────────────────────────┘       │
│  원인: DB 시퀀스 INCREMENT BY ≠ JPA allocationSize              │
│  해결: ALTER SEQUENCE user_seq INCREMENT BY 50;                  │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 2: 음수 ID 생성                                            │
│  원인: pooled optimizer에서 시퀀스를 낮은 값으로 수동 리셋       │
│  해결:                                                            │
│  ├── A) pooled-lo로 전환 (근본 해결)                             │
│  │   hibernate.id.optimizer.pooled.preferred: pooled-lo          │
│  └── B) 시퀀스 리셋 시 충분히 큰 값으로 설정                     │
│      ALTER SEQUENCE user_seq RESTART WITH                        │
│          (SELECT MAX(id) + 50 FROM users);                       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 3: Hibernate 5→6 마이그레이션 후 ID 충돌                   │
│  원인: hibernate_sequence에서 엔티티별 시퀀스 전환 시            │
│        새 시퀀스 시작 값이 기존 MAX(id)보다 낮음                 │
│  해결:                                                            │
│  CREATE SEQUENCE user_SEQ                                        │
│      START WITH (SELECT MAX(id) + 50 FROM users)                 │
│      INCREMENT BY 50;                                            │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 4: 재시작 후 ID 갭 발생                                     │
│  원인: 메모리에 남아있던 미사용 ID가 소멸                        │
│  해결: 이것은 정상 동작이다!                                     │
│  ├── PK에 비즈니스 의미를 부여하지 말 것                         │
│  ├── "주문번호"가 필요하면 별도 컬럼 사용                       │
│  └── allocationSize를 줄이면 갭이 작아짐 (성능 트레이드오프)    │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 5: Batch INSERT가 동작하지 않음                             │
│  확인 포인트:                                                     │
│  ├── GenerationType.IDENTITY 사용 중? → SEQUENCE로 전환          │
│  ├── jdbc.batch_size 설정했는가?                                 │
│  ├── order_inserts: true 설정했는가?                             │
│  └── hibernate.show_sql=true로 실제 쿼리 확인                   │
│      → Batch 시 "Executing batch size: N" 로그 확인              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 전문가 의견과 권장사항

## Hibernate 핵심 개발자들의 견해

```
┌─────────────────────────────────────────────────────────────────┐
│                    전문가 권장사항                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Vlad Mihalcea (Hibernate Developer Advocate):                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  "IDENTITY를 절대 사용하지 마라.                       │       │
│  │   SEQUENCE + pooled optimizer가 최선이다.              │       │
│  │   IDENTITY는 Hibernate의 Batch INSERT를                │       │
│  │   완전히 무력화시킨다."                                │       │
│  │                                                        │       │
│  │  "allocationSize과 batch_size를 일치시키면             │       │
│  │   DB 왕복을 98% 줄일 수 있다."                         │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  Steve Ebersole (Hibernate ORM Lead):                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  "pooled-lo should really be the default.             │       │
│  │   But changing it would break backward compatibility. │       │
│  │   It's safe to switch from pooled to pooled-lo —      │       │
│  │   it just creates harmless gaps."                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  Thorben Janssen (Hibernate Expert):                             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  "GenerationType.SEQUENCE가 가장 유연하다.             │       │
│  │   Hibernate가 INSERT를 지연시키고                      │       │
│  │   JDBC Batching을 활용할 수 있게 해준다."              │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 종합 판단

```
┌─────────────────────────────────────────────────────────────────┐
│                  종합 판단                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. pooled-lo를 기본으로 사용하라                                │
│     → pooled의 음수 ID 버그는 실제 운영에서 발견하기 어렵다     │
│     → 발견 시점은 이미 데이터가 오염된 후                        │
│     → 예방이 훨씬 저렴하다                                       │
│                                                                   │
│  2. allocationSize은 신중하게 선택하라                            │
│     → 50 (JPA 기본값): 대부분의 경우 적절                       │
│     → 100~200: 대량 INSERT가 빈번한 로그/이벤트 테이블          │
│     → 1: ID 갭이 절대 허용되지 않는 특수 경우만                  │
│     → 너무 크면: 재시작 시 큰 갭, 너무 작으면: DB 호출 증가     │
│                                                                   │
│  3. IDENTITY 전략을 피하되, MySQL은 예외                         │
│     → MySQL 8.0도 시퀀스를 지원하지 않음                         │
│     → MySQL에서는 IDENTITY가 유일한 선택                         │
│     → 대량 INSERT가 필요하면 MySQL 대신 PostgreSQL 고려          │
│                                                                   │
│  4. 분산 환경에서는 TSID를 적극 고려하라                         │
│     → DB 시퀀스 = 중앙 집중 → 분산의 적                         │
│     → TSID = 8 bytes + 시간순 + 분산 안전                        │
│     → UUID v7 = 16 bytes이지만 더 표준적                         │
│                                                                   │
│  5. 테스트 환경을 소홀히 하지 마라                                │
│     → H2 인메모리로 테스트하면 시퀀스 문제를 놓침                │
│     → TestContainers로 실제 DB(PostgreSQL)에서 검증              │
│     → 시퀀스 INCREMENT BY 불일치는 H2에서 안 잡힘               │
│                                                                   │
│  6. Spring Boot의 역사적 함정을 인지하라                         │
│     → Spring Boot 1.4: new_generator_mappings=false 오버라이드   │
│     → Spring Boot 2.x: 이 설정이 남아있을 수 있음               │
│     → Spring Boot 3.x + Hibernate 6: 설정 자체 제거             │
│     → 레거시 프로젝트 마이그레이션 시 반드시 확인                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 한눈에 보는 요약

```
┌─────────────────────────────────────────────────────────────────┐
│                    최종 요약                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GenerationType 선택                                             │
│    → SEQUENCE (최우선) > IDENTITY (MySQL) > TABLE (사용금지)     │
│                                                                   │
│  Optimizer 선택                                                  │
│    → pooled-lo (최우선) > pooled > none > hi/lo (사용금지)       │
│                                                                   │
│  핵심 설정 3가지                                                 │
│    1) hibernate.id.optimizer.pooled.preferred: pooled-lo         │
│    2) allocationSize = batch_size (예: 둘 다 50)                 │
│    3) DB INCREMENT BY = allocationSize (반드시 일치)             │
│                                                                   │
│  분산 환경 대안                                                  │
│    → TSID (8 bytes, 시간순, Long 호환)                           │
│    → UUID v7 (16 bytes, 표준, 충돌 불가)                         │
│    → Snowflake (대규모 분산, 커스텀 필요)                        │
│                                                                   │
│  Hibernate 6 마이그레이션 필수 작업                               │
│    → hibernate_sequence → 엔티티별 시퀀스                        │
│    → INCREMENT BY와 allocationSize 일치 확인                     │
│    → TestContainers로 실제 DB 검증                               │
│                                                                   │
│  절대 하지 말 것                                                 │
│    X IDENTITY + Batch INSERT 기대                                │
│    X Hi/Lo + 외부 시스템 접근                                    │
│    X pooled + 수동 시퀀스 리셋                                   │
│    X allocationSize ≠ INCREMENT BY                               │
│    X H2에서만 시퀀스 테스트                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 참고자료

```
[핵심 참고자료]

1. Vlad Mihalcea - "The best way to use the @GeneratedValue annotation"
   https://vladmihalcea.com/hibernate-identity-sequence-and-table-sequence-generator/

2. Vlad Mihalcea - "Hibernate pooled and pooled-lo identifier generators"
   https://vladmihalcea.com/hibernate-hidden-gem-the-pooled-lo-optimizer/

3. Thorben Janssen - "JPA GenerationType.SEQUENCE"
   https://thorben-janssen.com/jpa-generate-primary-keys/

4. Hibernate ORM GitHub - PooledOptimizer.java
   https://github.com/hibernate/hibernate-orm

5. JPA 3.2 Specification - Chapter 4: Entity Identity
   https://jakarta.ee/specifications/persistence/3.2/

6. Hibernate JIRA HHH-10683 - Pooled Optimizer Negative ID Bug
   https://hibernate.atlassian.net/browse/HHH-10683

7. Philippe Marschall - Batch Sequence Generator (Hypersistence Utils)
   https://github.com/vladmihalcea/hypersistence-utils

8. RFC 9562 - Universally Unique IDentifiers (UUIDs) v7
   https://www.rfc-editor.org/rfc/rfc9562

[추가 참고자료]

9. Twitter Snowflake ID - 분산 ID 생성 패턴
10. TSID Creator - Time-Sorted Unique Identifier Library
11. Spring Boot JPA Configuration Guide
12. Quarkus Hibernate ORM Guide (pooled-lo 기본 설정)
```

