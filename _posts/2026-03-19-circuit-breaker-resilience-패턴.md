---
layout: single
title: "Circuit Breaker & Resilience 패턴 완전 가이드"
date: 2026-03-19 22:59:00 +0900
categories: backend
excerpt: "Circuit Breaker와 Resilience 패턴은 분산 시스템에서 연쇄 장애를 차단하고 부분 실패를 격리해 서비스 가용성과 복구 탄력성을 높이는 설계 전략이다."
toc: true
toc_sticky: true
tags: [circuitbreaker, resilience, microservices, retry, timeout, fallback]
source: "/home/dwkim/dwkim/docs/backend/circuit-breaker-resilience-패턴.md"
---
TL;DR
- Circuit Breaker의 핵심 상태 전이(CLOSED/OPEN/HALF-OPEN)와 장애 격리 목적을 빠르게 정리한다.
- 분산 시스템에서 왜 연쇄 장애와 스레드 고갈이 발생하는지 배경을 사례 중심으로 설명한다.
- Retry·Timeout·Bulkhead·Fallback을 조합한 실전 Resilience 설계 포인트를 한 번에 파악한다.

## 1. 개념
Circuit Breaker & Resilience 패턴은 장애 서비스 호출을 자동으로 차단하고 복구 가능 시점에 제한적으로 재시도해 장애 전파를 막는 분산 시스템 안정화 패턴이다.

## 2. 배경
마이크로서비스 환경에서는 네트워크 지연과 부분 장애가 상시 발생하며, 단일 다운스트림 장애가 스레드 풀 고갈을 거쳐 전체 시스템 장애로 확산되기 쉽다.

## 3. 이유
실패를 전제로 설계하지 않으면 작은 장애가 대규모 서비스 중단으로 번지기 때문에, 장애 격리와 점진 복구를 위한 보호 계층이 필요하다.

## 4. 특징
상태 기반 트래픽 차단, 지표 기반 임계치 판단, Fallback을 통한 Graceful Degradation, 그리고 Retry/Timeout/Bulkhead/Rate Limiter와의 조합이 핵심 특징이다.

## 5. 상세 내용

# Circuit Breaker & Resilience 패턴 완전 가이드

> **작성일**: 2026-03-19
> **카테고리**: Backend / Distributed Systems / Microservices / Resilience Engineering
> **키워드**: Circuit Breaker, Resilience4j, Hystrix, Retry, Timeout, Bulkhead, Rate Limiter, Fallback, Graceful Degradation, Cascading Failure, Service Mesh, Istio, Envoy, Chaos Engineering, Polly, Sentinel

---

# 1. Circuit Breaker & Resilience 패턴이란?

## 1.1 분산 시스템의 근본적 위험: 연쇄 장애

```
┌─────────────────────────────────────────────────────────────────┐
│              연쇄 장애 (Cascading Failure) 시나리오              │
│                                                                 │
│  [정상 상태]                                                    │
│                                                                 │
│  Client ──► Service A ──► Service B ──► Service C ──► DB       │
│              (10ms)        (15ms)        (20ms)       (5ms)     │
│                                                                 │
│  총 응답 시간: ~50ms ✅                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Service C DB 장애 발생]                                       │
│                                                                 │
│  단계 1: Service C 응답 지연                                    │
│  Client ──► Service A ──► Service B ──► Service C ──✕── DB     │
│              (10ms)        (15ms)        (30초 대기...)          │
│                                                                 │
│  단계 2: Service B 스레드 고갈                                  │
│  ┌──────────────────────────────┐                               │
│  │ Service B Thread Pool        │                               │
│  │ [████████████████████] 200/200 │  ← C 응답 대기로 전부 점유  │
│  │ 새로운 요청 처리 불가!       │                               │
│  └──────────────────────────────┘                               │
│                                                                 │
│  단계 3: Service A도 스레드 고갈                                │
│  ┌──────────────────────────────┐                               │
│  │ Service A Thread Pool        │                               │
│  │ [████████████████████] 200/200 │  ← B 응답 대기로 전부 점유  │
│  │ 새로운 요청 처리 불가!       │                               │
│  └──────────────────────────────┘                               │
│                                                                 │
│  단계 4: 전체 시스템 다운                                       │
│  Client ──✕── Service A ──✕── Service B ──✕── Service C       │
│           503           503           503                       │
│                                                                 │
│  핵심: C 하나의 장애가 전체 시스템을 마비시킴                   │
│  이것이 Cascading Failure (연쇄 장애)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Partial Failure (부분 장애)** 란 분산 시스템에서만 존재하는 개념이다. 모놀리식에서는 프로세스가 죽으면 전체가 멈추지만, 분산 시스템에서는 일부 서비스만 실패하고 나머지는 정상이다. 문제는 이 "일부 실패"를 적절히 격리하지 않으면, 정상 서비스까지 전부 다운된다는 것이다.

```
┌─────────────────────────────────────────────────────────────────┐
│       Peter Deutsch의 분산 컴퓨팅의 8가지 오류 (1994)           │
│       "Fallacies of Distributed Computing"                      │
│                                                                 │
│  번호 │ 오류 (Fallacy)                    │ 현실                │
│  ─────┼───────────────────────────────────┼─────────────────────│
│   1   │ 네트워크는 신뢰할 수 있다         │ 패킷은 유실된다     │
│   2   │ 지연(Latency)은 0이다             │ 물리적 거리 존재    │
│   3   │ 대역폭은 무한하다                 │ 유한하고 경쟁한다   │
│   4   │ 네트워크는 안전하다               │ 공격받을 수 있다    │
│   5   │ 토폴로지는 변하지 않는다          │ 노드 추가/제거 상시 │
│   6   │ 관리자가 한 명이다                │ 여러 팀이 관리한다  │
│   7   │ 전송 비용은 0이다                 │ 직렬화/역직렬화 비용│
│   8   │ 네트워크는 동질적이다             │ 이기종 혼합 환경    │
│                                                                 │
│  Resilience 패턴은 이 8가지 오류를 인정하고,                    │
│  "실패는 반드시 발생한다"는 전제 위에 설계한다.                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 전기 Circuit Breaker에서 소프트웨어 패턴으로

```
┌─────────────────────────────────────────────────────────────────┐
│       전기 회로 차단기 → 소프트웨어 Circuit Breaker              │
│                                                                 │
│  [전기 Circuit Breaker]                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  정상 전류 ──── [차단기: CLOSED] ──── 부하(기기)         │    │
│  │                    │                                     │    │
│  │  과전류 발생 ──── [차단기: OPEN] ──✕── 부하              │    │
│  │                    │                 (전류 차단)          │    │
│  │  수동 리셋 ────── [차단기: CLOSED] ──── 부하              │    │
│  │                                                          │    │
│  │  목적: 과전류로 인한 화재/장비 손상 방지                  │    │
│  │  Thomas Edison, 1879년 특허 (US Patent 438,305)           │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [소프트웨어 Circuit Breaker]                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  정상 요청 ──── [CB: CLOSED] ──── 원격 서비스            │    │
│  │                    │                                     │    │
│  │  실패율 초과 ──── [CB: OPEN] ──✕── 원격 서비스           │    │
│  │                    │           (즉시 실패 반환)           │    │
│  │  대기 시간 후 ─── [CB: HALF-OPEN] ──── 원격 서비스       │    │
│  │                    │                   (제한적 시도)      │    │
│  │  성공 → CLOSED     │                                     │    │
│  │  실패 → OPEN       │                                     │    │
│  │                                                          │    │
│  │  목적: 장애 전파 차단 + 장애 서비스 복구 시간 확보       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  핵심 차이:                                                     │
│  ├── 전기: 수동 리셋 필요                                      │
│  ├── 소프트웨어: 자동 복구 시도 (HALF-OPEN)                    │
│  └── HALF-OPEN은 소프트웨어에만 있는 개념                      │
│                                                                 │
│  역사:                                                          │
│  ├── 2007: Michael Nygard "Release It!" — 소프트웨어 CB 최초 제안│
│  ├── 2012: Netflix Hystrix — 대규모 프로덕션 최초 적용         │
│  └── 2014: Martin Fowler 블로그 — 패턴 대중화                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Circuit Breaker 상태 머신

```
┌─────────────────────────────────────────────────────────────────┐
│              Circuit Breaker 상태 머신 (State Machine)           │
│                                                                 │
│                    요청 통과, 결과 기록                          │
│                   ┌───────────────┐                              │
│                   │               │                              │
│                   ▼               │                              │
│              ┌─────────┐         │                              │
│      ┌──────►│ CLOSED  │─────────┘                              │
│      │       │ (닫힘)   │                                        │
│      │       └────┬────┘                                        │
│      │            │                                              │
│      │            │ 실패율 ≥ threshold                           │
│      │            │ (예: 50% 초과)                               │
│      │            ▼                                              │
│      │       ┌─────────┐                                        │
│      │       │  OPEN   │──── 모든 요청 즉시 실패                │
│      │       │ (열림)   │     (CallNotPermittedException)        │
│      │       └────┬────┘                                        │
│      │            │                                              │
│      │            │ waitDurationInOpenState 경과                 │
│      │            │ (예: 60초)                                   │
│      │            ▼                                              │
│      │       ┌──────────┐                                       │
│      └───────┤HALF-OPEN │──── 제한된 수의 요청만 허용           │
│   성공 시    │ (반열림)  │     (permittedNumberOfCalls)           │
│              └────┬─────┘                                       │
│                   │                                              │
│                   │ 실패율 ≥ threshold                           │
│                   ▼                                              │
│              ┌─────────┐                                        │
│              │  OPEN   │ ← 다시 대기 상태로                     │
│              └─────────┘                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  상태 이름의 기원 (전기공학):                                   │
│  ├── CLOSED: 회로가 연결됨 → 전류가 흐름 → 요청이 통과         │
│  ├── OPEN: 회로가 끊어짐 → 전류가 차단 → 요청이 차단           │
│  └── HALF-OPEN: 소프트웨어 전용 개념 (전기에는 없음)           │
│      → "살짝 열어서 탐침(probe) 요청을 보내본다"               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  특수 상태 (Resilience4j):                                      │
│  ├── DISABLED: CB 비활성화, 모든 요청 통과, 상태 전이 없음      │
│  ├── FORCED_OPEN: 강제 OPEN, 모든 요청 차단                    │
│  └── METRICS_ONLY: 모든 요청 통과, 메트릭만 수집               │
│                                                                 │
│  DISABLED/FORCED_OPEN은 운영 중 수동 제어에 유용                │
│  METRICS_ONLY는 도입 초기 "관찰 모드"에 활용                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 핵심 Resilience 패턴 6가지

## 2.1 Circuit Breaker (회로 차단기)

```
┌─────────────────────────────────────────────────────────────────┐
│              Circuit Breaker Sliding Window 방식                 │
│                                                                 │
│  [COUNT_BASED] 최근 N개 호출 기준                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  slidingWindowSize = 10                                  │    │
│  │                                                          │    │
│  │  호출:  ✓ ✓ ✗ ✓ ✗ ✗ ✓ ✗ ✓ ✗                           │    │
│  │  번호:  1 2 3 4 5 6 7 8 9 10                             │    │
│  │                                                          │    │
│  │  실패: 5/10 = 50% → threshold 50% 도달 → OPEN           │    │
│  │                                                          │    │
│  │  새 호출 시 가장 오래된 결과 밀림 (Ring Buffer)           │    │
│  │  호출 11 성공 → [✓ ✗ ✓ ✗ ✗ ✓ ✗ ✓ ✗ ✓]                 │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [TIME_BASED] 최근 N초 기준                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  slidingWindowSize = 10 (초)                             │    │
│  │                                                          │    │
│  │  시간: |---10초 윈도우---|                                │    │
│  │        ✓✓✗✓✗  ✗✗✓✗✓✗  ← 이 구간의 호출만 집계          │    │
│  │                                                          │    │
│  │  트래픽 양에 무관하게 시간 기반 판단                      │    │
│  │  트래픽이 적은 서비스에 적합                              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**핵심 파라미터:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `failureRateThreshold` | 50 | 실패율 임계값 (%) — 이 값 이상이면 OPEN |
| `slowCallRateThreshold` | 100 | 느린 호출 비율 임계값 (%) |
| `slowCallDurationThreshold` | 60000ms | 이 시간 초과하면 "느린 호출"로 분류 |
| `waitDurationInOpenState` | 60000ms | OPEN 상태 유지 시간 (이후 HALF-OPEN) |
| `permittedNumberOfCallsInHalfOpenState` | 10 | HALF-OPEN에서 허용하는 호출 수 |
| `slidingWindowType` | COUNT_BASED | COUNT_BASED 또는 TIME_BASED |
| `slidingWindowSize` | 100 | 윈도우 크기 (호출 수 또는 초) |
| `minimumNumberOfCalls` | 100 | 최소 호출 수 (이하면 판단 보류) |
| `recordExceptions` | (empty) | 실패로 기록할 예외 목록 |
| `ignoreExceptions` | (empty) | 무시할 예외 목록 (실패 미집계) |

```java
// Resilience4j CircuitBreakerConfig 빌더 예시
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)                        // 실패율 50% 이상이면 OPEN
    .slowCallRateThreshold(80)                       // 느린 호출 80% 이상이면 OPEN
    .slowCallDurationThreshold(Duration.ofSeconds(2)) // 2초 초과 = 느린 호출
    .waitDurationInOpenState(Duration.ofSeconds(30))  // OPEN 30초 유지
    .permittedNumberOfCallsInHalfOpenState(5)         // HALF-OPEN에서 5개 시도
    .slidingWindowType(SlidingWindowType.COUNT_BASED)
    .slidingWindowSize(20)                            // 최근 20개 호출 기준
    .minimumNumberOfCalls(10)                         // 최소 10개 호출 후 판단
    .recordExceptions(IOException.class, TimeoutException.class)
    .ignoreExceptions(BusinessException.class)        // 비즈니스 예외는 미집계
    .build();

CircuitBreaker circuitBreaker = CircuitBreaker.of("paymentService", config);
```

## 2.2 Retry (재시도)

```
┌─────────────────────────────────────────────────────────────────┐
│              Retry 4가지 전략                                    │
│                                                                 │
│  [1. Simple Retry] 즉시 재시도                                  │
│  ├── 요청 ──✗── 즉시재시도 ──✗── 즉시재시도 ──✓               │
│  └── 일시적 네트워크 글리치에만 유효                            │
│                                                                 │
│  [2. Linear Backoff] 선형 증가 대기                             │
│  ├── 요청 ──✗── 1초 ── 재시도 ──✗── 2초 ── 재시도 ──✓        │
│  └── 예측 가능한 간격, 하지만 Thundering Herd에 취약           │
│                                                                 │
│  [3. Exponential Backoff] 지수 증가 대기                        │
│  ├── 요청 ──✗── 1초 ── 재시도 ──✗── 2초 ── 재시도 ──✗──      │
│  │          4초 ── 재시도 ──✗── 8초 ── 재시도 ──✓              │
│  └── 서버에 회복 시간을 점점 더 많이 부여                       │
│                                                                 │
│  [4. Exponential Backoff + Jitter] 지수 증가 + 무작위           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Client A: ──✗── 0.8초 ── 재시도 ──✗── 2.3초 ──        │    │
│  │  Client B: ──✗── 1.2초 ── 재시도 ──✗── 1.7초 ──        │    │
│  │  Client C: ──✗── 0.5초 ── 재시도 ──✗── 3.1초 ──        │    │
│  │                                                          │    │
│  │  Jitter로 재시도 시점을 분산시킴                          │    │
│  │  → 동시 재시도 폭주(Thundering Herd) 방지                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Jitter 공식:                                                   │
│  sleep = min(cap, base × 2^attempt) × random(0, 1)             │
│                                                                 │
│  예: base=1초, cap=60초                                         │
│  attempt 1: min(60, 1×2¹) × rand = 2 × 0.73 = 1.46초          │
│  attempt 2: min(60, 1×2²) × rand = 4 × 0.41 = 1.64초          │
│  attempt 3: min(60, 1×2³) × rand = 8 × 0.89 = 7.12초          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**역사적 기원:**

- **Exponential Backoff**: David Boggs, 1976년 Ethernet 논문에서 최초 제안. 여러 컴퓨터가 동시에 네트워크에 접근할 때 충돌을 해결하기 위해 대기 시간을 지수적으로 증가시킴. IEEE 802.3 (1983)에 공식 채택 (Binary Exponential Backoff).

- **Jitter**: 원래 신호처리(Signal Processing) 용어. 신호의 시간적 변동을 의미. 소프트웨어에서는 AWS Architecture Blog (2015, "Exponential Backoff And Jitter")에서 분산 시스템 재시도 전략으로 정립됨. Marc Brooker가 Full Jitter, Equal Jitter, Decorrelated Jitter 3가지 변종을 비교 분석.

```yaml
# Spring Boot Retry 설정 (application.yml)
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 3                          # 최대 3회 시도
        waitDuration: 1s                        # 기본 대기 1초
        enableExponentialBackoff: true           # 지수 백오프 활성화
        exponentialBackoffMultiplier: 2           # 2배씩 증가
        enableRandomizedWait: true               # Jitter 활성화
        randomizedWaitFactor: 0.5                # ±50% 범위
        retryExceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
        ignoreExceptions:
          - com.example.BusinessException         # 비즈니스 예외는 재시도 안 함
```

## 2.3 Timeout (타임아웃)

```
┌─────────────────────────────────────────────────────────────────┐
│              Timeout의 두 가지 종류                              │
│                                                                 │
│  [Connection Timeout]                                           │
│  Client ────── TCP 3-way Handshake ──────► Server               │
│          SYN ──────────────────────────►                        │
│              ◄────────────────────── SYN+ACK                   │
│          ACK ──────────────────────────►                        │
│          ← 이 과정에서 응답 없으면 Connection Timeout →         │
│                                                                 │
│  [Read Timeout (= Socket Timeout)]                              │
│  Client ────── HTTP Request ──────────► Server                  │
│                                          (처리 중...)           │
│          ← 요청 보낸 후 응답을 기다리는 시간 초과 →              │
│              Read Timeout 발생                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 구분 | Connection Timeout | Read Timeout |
|------|-------------------|-------------|
| 발생 시점 | TCP 연결 수립 단계 | 데이터 수신 대기 단계 |
| 원인 | 서버 다운, 방화벽 차단, DNS 실패 | 서버 처리 지연, 부하 과중 |
| 일반 설정값 | 1~5초 | 5~30초 (서비스별 상이) |
| 재시도 가치 | 높음 (일시적 네트워크 문제) | 낮음 (서버 과부하 시 악화 가능) |

```java
// Resilience4j TimeLimiter 설정
TimeLimiterConfig timeLimiterConfig = TimeLimiterConfig.custom()
    .timeoutDuration(Duration.ofSeconds(3))  // 3초 초과 시 TimeoutException
    .cancelRunningFuture(true)               // 타임아웃 시 실행 중인 Future 취소
    .build();

TimeLimiter timeLimiter = TimeLimiter.of("paymentService", timeLimiterConfig);
```

> **Michael Nygard의 경고 (Release It!, 2007):**
> "원격 호출에 타임아웃을 설정하지 않는 것은 프로덕션의 시한폭탄이다.
> 모든 원격 호출에는 반드시 타임아웃을 설정하라."

## 2.4 Bulkhead (격벽)

```
┌─────────────────────────────────────────────────────────────────┐
│              Bulkhead 패턴의 기원: 선박 격벽                     │
│                                                                 │
│  [격벽 없는 선박]                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~         │    │
│  │  │          물이 전체로 퍼짐 → 침몰                │     │    │
│  │  │  💧💧💧💧💧💧💧💧💧💧💧💧💧💧💧💧  │     │    │
│  │  └───────────────────────────────────────────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [격벽 있는 선박]                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~         │    │
│  │  │💧💧│      │      │      │      │      │              │    │
│  │  │💧💧│      │      │      │      │      │              │    │
│  │  └──┴──┴──────┴──────┴──────┴──────┴──────┘              │    │
│  │   침수     정상    정상    정상    정상    정상            │    │
│  │   ↑ 격벽이 물의 확산을 차단                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  역사:                                                          │
│  ├── 고대 그리스 삼단노선(trireme): 격벽 최초 사용             │
│  ├── 1912 타이타닉: 16개 격벽이 있었지만, 상단이 열려 있어서   │
│  │   물이 넘쳐 인접 구획으로 확산 → 격벽 설계의 교훈           │
│  └── 소프트웨어: 서비스별 리소스 풀을 격리하여 장애 확산 방지  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [소프트웨어 Bulkhead: Thread Pool 격리]                        │
│                                                                 │
│  [Bulkhead 없음] — 공유 Thread Pool                             │
│  ┌──────────────────────────────────────┐                       │
│  │ Shared Thread Pool (200 threads)     │                       │
│  │ Service A 호출 ████████              │                       │
│  │ Service B 호출 ████████████████████  │ ← B가 느려지면       │
│  │ Service C 호출 ██                    │    A, C도 영향 받음   │
│  │ 남은 스레드:   (없음!)               │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  [Bulkhead 있음] — 서비스별 격리된 Thread Pool                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Pool A (50)  │ │ Pool B (100) │ │ Pool C (50)  │            │
│  │ ████████     │ │ ████████████ │ │ ██           │            │
│  │ 남은: 30     │ │ 남은: 0 (!)  │ │ 남은: 40     │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│   A 정상 동작      B 포화 → 격리     C 정상 동작               │
│                    B 초과 요청만 거부                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 구분 | SemaphoreBulkhead | ThreadPoolBulkhead |
|------|-------------------|-------------------|
| 격리 방식 | Semaphore (동시 실행 수 제한) | 별도 Thread Pool |
| 스레드 | 호출자 스레드 사용 | 전용 스레드 풀 |
| 큐 지원 | 없음 (초과 즉시 거부) | 큐 대기 가능 |
| 오버헤드 | 매우 낮음 | 컨텍스트 스위칭 비용 |
| 리액티브/코루틴 | 적합 | 부적합 (블로킹 전용) |
| Timeout 분리 | 별도 TimeLimiter 필요 | Thread Pool 자체 Timeout 가능 |
| 권장 상황 | WebFlux, Kotlin Coroutine | Servlet 기반 블로킹 서비스 |

**Little's Law로 Bulkhead 크기 산정:**

```
┌─────────────────────────────────────────────────────────────────┐
│              Little's Law: L = λ × W                             │
│                                                                 │
│  L = 시스템 내 평균 요청 수 (필요한 동시 슬롯 수)              │
│  λ = 도착률 (초당 요청 수, TPS)                                │
│  W = 평균 체류 시간 (응답 시간)                                 │
│                                                                 │
│  예시:                                                          │
│  ├── Payment 서비스 TPS = 100 req/s                             │
│  ├── 평균 응답 시간 = 200ms = 0.2s                              │
│  ├── L = 100 × 0.2 = 20 (동시 실행 필요 슬롯)                  │
│  ├── 여유분 (피크 대비 2x) = 40                                 │
│  └── maxConcurrentCalls = 40                                    │
│                                                                 │
│  공식: maxConcurrentCalls = TPS × avgResponseTime × safetyFactor│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2.5 Rate Limiter (속도 제한기)

```
┌─────────────────────────────────────────────────────────────────┐
│              Rate Limiter 4가지 알고리즘                         │
│                                                                 │
│  [1. Token Bucket] (토큰 양동이)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  일정 간격으로 토큰 투입 ──► 🪣 [●●●●●○○○○○]            │    │
│  │                              bucket (최대 10개)          │    │
│  │  요청 도착 → 토큰 있으면 소비하고 통과                   │    │
│  │              토큰 없으면 거부 또는 대기                   │    │
│  │                                                          │    │
│  │  특징: 버스트 허용 (토큰이 쌓여 있으면 한번에 사용 가능) │    │
│  │  사용: AWS API Gateway, Guava RateLimiter                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [2. Leaky Bucket] (누수 양동이)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  요청 ──► 🪣 [큐에 쌓임] ──💧──💧──► 일정 속도 처리    │    │
│  │           bucket 가득 차면 거부                           │    │
│  │                                                          │    │
│  │  특징: 출력 속도 일정 (버스트 평활화)                    │    │
│  │  사용: 네트워크 트래픽 셰이핑, Nginx                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [3. Fixed Window Counter] (고정 윈도우)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  |── 1분 ──|── 1분 ──|── 1분 ──|                        │    │
│  │  | count:95| count:10| count:87|                        │    │
│  │  |  (한도 100)                                           │    │
│  │                                                          │    │
│  │  문제: 윈도우 경계에서 2x 버스트 가능                    │    │
│  │  |...95|100...|  ← 경계 전후 2초에 195 요청 가능        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [4. Sliding Window Log/Counter] (슬라이딩 윈도우)              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  현재 시각 기준으로 직전 1분간의 요청 수를 계산          │    │
│  │                                                          │    │
│  │  ←──────── 1분 윈도우 ────────►                          │    │
│  │         |███████████████████|                             │    │
│  │    윈도우가 시간과 함께 슬라이딩                          │    │
│  │                                                          │    │
│  │  Fixed Window의 경계 문제 해결                           │    │
│  │  메모리 비용 증가 (요청별 타임스탬프 저장)               │    │
│  │  사용: Resilience4j, Redis 기반 Rate Limiter             │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**TPS 계산 공식:**

```
허용 TPS = limitForPeriod / limitRefreshPeriod

예: limitForPeriod = 50, limitRefreshPeriod = 1초
→ 50 TPS 허용
```

```java
// Resilience4j RateLimiter 설정
RateLimiterConfig rateLimiterConfig = RateLimiterConfig.custom()
    .limitForPeriod(50)                             // 주기당 허용 호출 수
    .limitRefreshPeriod(Duration.ofSeconds(1))      // 주기 (1초마다 리셋)
    .timeoutDuration(Duration.ofMillis(500))        // 허용 대기 시간 (500ms)
    .build();

RateLimiter rateLimiter = RateLimiter.of("externalApi", rateLimiterConfig);
```

## 2.6 Fallback (대체 수단)

```
┌─────────────────────────────────────────────────────────────────┐
│              Fallback 패턴                                       │
│                                                                 │
│  군사 용어에서 유래:                                             │
│  "Fall back!" = "후퇴하라!" → 전선이 무너졌을 때 미리 준비된   │
│  후방 방어선으로 철수하는 것. 소프트웨어에서는 주 서비스 실패   │
│  시 대안으로 전환하는 것을 의미.                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [3가지 Fallback 유형]                                          │
│                                                                 │
│  1. Static Fallback (정적 기본값)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  추천 서비스 실패 → 인기 상품 목록 반환 (하드코딩)       │    │
│  │  환율 서비스 실패 → 마지막 알려진 환율 반환              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  2. Cache-based Fallback (캐시 기반)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  원격 서비스 ──✗── Redis 캐시에서 이전 결과 반환         │    │
│  │  "Stale data is better than no data"                     │    │
│  │  (오래된 데이터라도 없는 것보다 낫다)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  3. Alternative Service Fallback (대체 서비스)                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  주 결제 시스템(PG A) ──✗── 보조 결제 시스템(PG B)       │    │
│  │  주 CDN ──✗── 백업 CDN                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Graceful Degradation 계층]                                    │
│                                                                 │
│  Level 0: 정상 응답 (실시간 추천)                               │
│     │                                                           │
│     ▼ 추천 서비스 장애                                          │
│  Level 1: 캐시된 추천 결과 (5분 전 데이터)                      │
│     │                                                           │
│     ▼ 캐시 미스                                                 │
│  Level 2: 정적 인기 상품 목록 (일간 집계)                       │
│     │                                                           │
│     ▼ 정적 데이터도 불가                                        │
│  Level 3: 추천 영역 숨김 + 사용자 안내 문구                     │
│           "추천 서비스가 일시적으로 이용 불가합니다"             │
│                                                                 │
│  핵심: 서비스가 완전히 죽는 것보다                              │
│        기능을 점진적으로 축소하는 것이 낫다                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```kotlin
// Kotlin Fallback 예시
@Service
class ProductRecommendationService(
    private val recommendationClient: RecommendationClient,
    private val redisTemplate: RedisTemplate<String, List<Product>>,
    private val popularProductsConfig: PopularProductsConfig
) {
    private val circuitBreaker = CircuitBreaker.ofDefaults("recommendation")

    fun getRecommendations(userId: String): List<Product> {
        return circuitBreaker.executeSuspendFunction {  // Kotlin Coroutine 지원
            recommendationClient.getPersonalized(userId)
        }.recover { throwable ->
            when (throwable) {
                is CallNotPermittedException -> getCachedRecommendations(userId)
                is TimeoutException -> getCachedRecommendations(userId)
                else -> getStaticPopularProducts()
            }
        }.get()
    }

    // Level 1: 캐시 기반 Fallback
    private fun getCachedRecommendations(userId: String): List<Product> {
        return redisTemplate.opsForValue().get("rec:$userId")
            ?: getStaticPopularProducts()   // Level 2로 강등
    }

    // Level 2: 정적 Fallback
    private fun getStaticPopularProducts(): List<Product> {
        return popularProductsConfig.defaultProducts  // application.yml에서 로드
    }
}
```

---

# 3. 패턴 조합 전략 (Defense in Depth)

## 3.1 Resilience4j 데코레이터 실행 순서

```
┌─────────────────────────────────────────────────────────────────┐
│         Resilience4j 데코레이터 실행 순서 (바깥 → 안쪽)         │
│                                                                 │
│  호출자 (Caller)                                                │
│    │                                                            │
│    ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Retry (재시도)                                  [가장 바깥]│   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ CircuitBreaker (회로 차단기)                       │  │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │   │
│  │  │  │ RateLimiter (속도 제한기)                     │  │  │   │
│  │  │  │  ┌────────────────────────────────────────┐  │  │  │   │
│  │  │  │  │ TimeLimiter (타임아웃)                  │  │  │  │   │
│  │  │  │  │  ┌──────────────────────────────────┐  │  │  │  │   │
│  │  │  │  │  │ Bulkhead (격벽)                  │  │  │  │  │   │
│  │  │  │  │  │  ┌────────────────────────────┐  │  │  │  │  │   │
│  │  │  │  │  │  │  실제 함수 호출            │  │  │  │  │  │   │
│  │  │  │  │  │  │  (원격 서비스)              │  │  │  │  │  │   │
│  │  │  │  │  │  └────────────────────────────┘  │  │  │  │  │   │
│  │  │  │  │  └──────────────────────────────────┘  │  │  │  │   │
│  │  │  │  └────────────────────────────────────────┘  │  │  │   │
│  │  │  └──────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  실행 순서 (안쪽 → 바깥쪽):                                    │
│  Bulkhead → TimeLimiter → RateLimiter → CB → Retry             │
│                                                                 │
│  왜 이 순서인가?                                                │
│  ├── Retry가 가장 바깥: CB가 OPEN이면 Retry도 즉시 중단         │
│  │   (CB OPEN 상태에서 무의미한 재시도 방지)                    │
│  ├── CB가 Retry 안쪽: 각 재시도 결과가 CB에 기록됨             │
│  ├── RateLimiter가 CB 안쪽: 속도 제한 초과도 CB에 미기록        │
│  ├── TimeLimiter가 안쪽: 타임아웃 = 실패로 CB에 기록           │
│  └── Bulkhead가 가장 안쪽: 동시 실행 수 제한이 첫 관문         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 시나리오별 패턴 조합

| 시나리오 | 권장 패턴 조합 | 이유 |
|----------|---------------|------|
| 동기 HTTP 호출 | Retry + CB + Timeout + Fallback | 가장 일반적인 조합 |
| 비동기 메시지 (Kafka 등) | Retry + CB (DLQ Fallback) | 메시지 재처리 + Dead Letter Queue |
| 외부 API (3rd party) | RateLimiter + Retry + CB + Fallback | API 제한 준수 + 장애 대비 |
| DB 호출 | Timeout + CB + Bulkhead | 커넥션 풀 보호 |
| gRPC (양방향 스트림) | Timeout + CB + Bulkhead | 스트림 타임아웃 + 리소스 격리 |
| 배치 처리 | Retry + CB (Bulkhead는 불필요) | 순차 처리, 동시성 제한 의미 없음 |

**도입 순서 권장 (스타트업 → 성숙기):**

```
┌─────────────────────────────────────────────────────────────────┐
│              점진적 Resilience 패턴 도입                         │
│                                                                 │
│  Phase 1: Timeout + Retry                                       │
│  ├── 모든 원격 호출에 Timeout 설정 (가장 기본)                 │
│  └── 일시적 실패에 대한 Retry 추가                              │
│     │                                                           │
│     ▼                                                           │
│  Phase 2: Circuit Breaker + Fallback                            │
│  ├── 장애 전파 차단 (연쇄 장애 방지)                           │
│  └── CB OPEN 시 대체 응답 제공                                  │
│     │                                                           │
│     ▼                                                           │
│  Phase 3: Bulkhead + Rate Limiter                               │
│  ├── 서비스별 리소스 격리                                       │
│  └── 외부 API 호출량 제한                                       │
│     │                                                           │
│     ▼                                                           │
│  Phase 4: 모니터링 + Chaos Engineering                          │
│  ├── Prometheus/Grafana 메트릭 대시보드                         │
│  └── 장애 주입 테스트로 Resilience 검증                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 라이브러리/프레임워크 비교

## 4.1 주요 라이브러리 개요

```
┌─────────────────────────────────────────────────────────────────┐
│              주요 Resilience 라이브러리 계보                     │
│                                                                 │
│  2012 ────► Hystrix (Netflix)                                   │
│             │  최초의 대규모 프로덕션 Circuit Breaker            │
│             │  Thread Pool Isolation 중심                        │
│             │                                                   │
│  2017 ──┬──► Resilience4j                                       │
│         │    Java 8 함수형, 경량, 모듈러                        │
│         │    Hystrix의 정신적 후속작                             │
│         │                                                       │
│  2018 ──┼──► Hystrix Maintenance Mode (deprecated)              │
│         │    Netflix가 Resilience4j를 대안으로 추천              │
│         │                                                       │
│  2013 ──┼──► Polly 1.0 (.NET)                                   │
│         │    .NET 생태계의 표준 Resilience 라이브러리            │
│         │    v8 (2023): ResiliencePipeline, Hedging 패턴 추가    │
│         │    Simmy: Chaos Engineering 모듈 내장                  │
│         │                                                       │
│  2018 ──┼──► Sentinel (Alibaba)                                 │
│         │    Flow Control (유량 제어) 특화                       │
│         │    Double 11 (솽스이, 11.11) 실전 검증                │
│         │    실시간 대시보드 내장                                │
│         │                                                       │
│  Go ────┴──► Failsafe-go, Sony Gobreaker                        │
│              Go 생태계의 Resilience 라이브러리                  │
│              Failsafe-go: 범용 / Gobreaker: CB 특화             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 종합 비교표

| 항목 | Resilience4j | Hystrix | Polly v8 | Sentinel | Failsafe-go |
|------|-------------|---------|----------|----------|-------------|
| **언어** | Java/Kotlin | Java | .NET | Java | Go |
| **유지보수** | Active | Deprecated (2018) | Active | Active | Active |
| **호출 오버헤드** | <1µs | ~1ms | <1µs | <1µs | <1µs |
| **학습 곡선** | 중간 | 높음 | 중간 | 중간 | 낮음 |
| **커뮤니티** | 매우 활발 | 레거시 | 활발 (.NET) | 활발 (중국) | 성장 중 |
| **Spring 통합** | 공식 지원 | Spring Cloud Netflix | N/A | Spring Cloud Alibaba | N/A |
| **모니터링** | Micrometer | Hystrix Dashboard | .NET Metrics | 내장 Dashboard | Prometheus |
| **함수형 API** | 데코레이터 패턴 | Command 패턴 | Pipeline 패턴 | SPI 기반 | 함수형 |
| **리액티브** | RxJava, Reactor | RxJava만 | Async/Await | Reactor | Goroutine |
| **CB** | O | O | O | O | O |
| **Retry** | O | X (외부) | O | X (외부) | O |
| **Bulkhead** | O (2종) | O (ThreadPool) | O | O (Thread) | O |
| **Rate Limiter** | O | X | O | O (핵심!) | O |
| **Timeout** | O (TimeLimiter) | O (Command) | O | X | O |
| **Fallback** | 함수형 조합 | Command 내장 | Pipeline 체인 | 콜백 | 함수형 조합 |
| **Chaos** | X | X | O (Simmy) | X | X |

## 4.3 Application-level vs Infrastructure-level Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│         Resilience 적용 레이어 3계층                             │
│                                                                 │
│  [Layer 1] API Gateway (Ingress)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Kong / AWS API Gateway / Nginx                          │    │
│  │  ├── Rate Limiting (클라이언트별)                        │    │
│  │  ├── 기본 Circuit Breaker                                │    │
│  │  └── 인증/인가                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  [Layer 2] Service Mesh (Sidecar / Ambient)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Istio + Envoy Sidecar                                   │    │
│  │  ├── Connection-level Circuit Breaker                    │    │
│  │  ├── Outlier Detection (이상치 감지)                     │    │
│  │  ├── Retry (HTTP/gRPC)                                   │    │
│  │  ├── Timeout                                             │    │
│  │  └── Load Balancing (Locality-aware)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  [Layer 3] Application Code                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Resilience4j / Polly / Sentinel                         │    │
│  │  ├── 비즈니스 로직 인지 Circuit Breaker                  │    │
│  │  ├── Semantic Retry (비즈니스 예외 구분)                  │    │
│  │  ├── Fallback (대체 비즈니스 로직)                       │    │
│  │  ├── Bulkhead (기능별 리소스 격리)                       │    │
│  │  └── Rate Limiter (비즈니스 규칙 기반)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 구분 | Application Code | Service Mesh | API Gateway |
|------|-----------------|-------------|------------|
| **장애 감지** | 비즈니스 예외 구분 가능 | HTTP 상태 코드만 | HTTP 상태 코드만 |
| **Fallback** | 복잡한 대체 로직 가능 | 불가 | 정적 응답만 |
| **세밀도** | 메서드/엔드포인트 단위 | 서비스/포트 단위 | 라우트 단위 |
| **언어 독립** | 언어별 구현 필요 | 완전 독립 | 완전 독립 |
| **성능 영향** | 없음 (~µs) | Sidecar P50 +3ms | 네트워크 홉 추가 |
| **배포** | 코드 변경 + 재배포 | 인프라 설정 변경 | 게이트웨이 설정 |
| **추천** | 반드시 사용 | 보조적 사용 | 보조적 사용 |

**하이브리드 접근법 (권장):**

```
┌─────────────────────────────────────────────────────────────────┐
│              하이브리드 Resilience 전략                           │
│                                                                 │
│  API Gateway: Rate Limiting (클라이언트별), 인증               │
│       │                                                         │
│       ▼                                                         │
│  Service Mesh: Retry (투명), Timeout (기본값), Outlier Detection│
│       │                                                         │
│       ▼                                                         │
│  Application: CB (비즈니스 예외 인지), Fallback (대체 로직),    │
│               Bulkhead (기능별 격리), 비즈니스 Rate Limit       │
│                                                                 │
│  원칙:                                                          │
│  ├── 인프라 레이어: "투명한" 보호 (코드 수정 없이)             │
│  ├── 애플리케이션 레이어: "지능적" 보호 (비즈니스 맥락 활용)   │
│  └── 둘 다 하되, 역할 중복을 최소화                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. 실전 베스트 프랙티스

## 5.1 권장 설정값

```yaml
# Spring Boot application.yml — Resilience4j 전체 설정 예시
resilience4j:
  circuitbreaker:
    configs:
      default:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 100
        minimumNumberOfCalls: 20
        failureRateThreshold: 50
        slowCallRateThreshold: 80
        slowCallDurationThreshold: 3s
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 10
        recordExceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
          - org.springframework.web.client.HttpServerErrorException
        ignoreExceptions:
          - com.example.BusinessException
      strict:  # 외부 API용 (더 엄격)
        slidingWindowSize: 20
        minimumNumberOfCalls: 5
        failureRateThreshold: 30
        waitDurationInOpenState: 60s
    instances:
      paymentService:
        baseConfig: default
      externalApiService:
        baseConfig: strict

  retry:
    configs:
      default:
        maxAttempts: 3
        waitDuration: 1s
        enableExponentialBackoff: true
        exponentialBackoffMultiplier: 2
        enableRandomizedWait: true
        randomizedWaitFactor: 0.5
        retryExceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
        ignoreExceptions:
          - com.example.BusinessException
    instances:
      paymentService:
        baseConfig: default
      externalApiService:
        maxAttempts: 5
        waitDuration: 2s

  timelimiter:
    configs:
      default:
        timeoutDuration: 3s
        cancelRunningFuture: true
    instances:
      paymentService:
        timeoutDuration: 5s   # 결제는 약간 여유
      searchService:
        timeoutDuration: 2s   # 검색은 빨라야 함

  bulkhead:
    configs:
      default:
        maxConcurrentCalls: 50
        maxWaitDuration: 100ms
    instances:
      paymentService:
        maxConcurrentCalls: 30     # 결제는 더 보수적
      catalogService:
        maxConcurrentCalls: 100    # 카탈로그는 넉넉하게

  ratelimiter:
    configs:
      default:
        limitForPeriod: 100
        limitRefreshPeriod: 1s
        timeoutDuration: 500ms
    instances:
      externalApiService:
        limitForPeriod: 10         # 외부 API 제한 준수
        limitRefreshPeriod: 1s
```

**Kotlin/Coroutine 사용 시 주의사항:**

```kotlin
// resilience4j-kotlin 모듈 필요
// implementation("io.github.resilience4j:resilience4j-kotlin:2.x.x")

// executeSuspendFunction으로 코루틴 지원
val result = circuitBreaker.executeSuspendFunction {
    // suspend 함수 호출 가능
    paymentClient.processPayment(request)
}

// 주의: SemaphoreBulkhead만 코루틴과 호환
// ThreadPoolBulkhead는 블로킹 전용이므로 코루틴에서 사용 금지
```

## 5.2 Bulkhead 크기 산정

```
┌─────────────────────────────────────────────────────────────────┐
│              Bulkhead 크기 산정 공식                              │
│                                                                 │
│  Little's Law 기반:                                             │
│  maxConcurrentCalls = TPS × avgResponseTime(초) × safetyFactor  │
│                                                                 │
│  예시 1: 일반 API                                               │
│  ├── TPS = 200 req/s                                            │
│  ├── avgResponseTime = 100ms = 0.1s                             │
│  ├── safetyFactor = 2.0 (피크 대비)                             │
│  └── maxConcurrentCalls = 200 × 0.1 × 2.0 = 40                 │
│                                                                 │
│  예시 2: 결제 API (느리지만 중요)                               │
│  ├── TPS = 50 req/s                                             │
│  ├── avgResponseTime = 500ms = 0.5s                             │
│  ├── safetyFactor = 1.5                                         │
│  └── maxConcurrentCalls = 50 × 0.5 × 1.5 = 37.5 ≈ 40          │
│                                                                 │
│  ThreadPool 크기 공식 (블로킹 전용):                            │
│  corePoolSize = TPS × avgResponseTime                           │
│  maxPoolSize = corePoolSize × 2                                 │
│  queueCapacity = maxPoolSize × 5 (최대 대기)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 Timeout 설정 전략

```
┌─────────────────────────────────────────────────────────────────┐
│              Timeout 설정 전략                                   │
│                                                                 │
│  기본 공식:                                                     │
│  timeout = p99.9 latency + buffer(20~50%)                       │
│                                                                 │
│  예시:                                                          │
│  ├── p99.9 latency = 2초                                        │
│  ├── buffer = 50%                                               │
│  └── timeout = 2 × 1.5 = 3초                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  체인 호출 Timeout 계산 (A → B → C):                            │
│                                                                 │
│  Client ──► A ──► B ──► C                                       │
│                                                                 │
│  C timeout = 2초                                                │
│  B timeout = C timeout + B 자체 처리 + buffer                   │
│            = 2초 + 0.5초 + 1초 = 3.5초                          │
│  A timeout = B timeout + A 자체 처리 + buffer                   │
│            = 3.5초 + 0.3초 + 1초 = 4.8초 ≈ 5초                 │
│                                                                 │
│  핵심 원칙:                                                     │
│  ├── 안쪽 서비스의 Timeout < 바깥 서비스의 Timeout              │
│  ├── 바깥이 더 짧으면, 안쪽 작업이 완료되어도 이미 타임아웃    │
│  └── Retry가 있다면: timeout × maxRetries < 상위 서비스 timeout │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 모니터링 통합

```
┌─────────────────────────────────────────────────────────────────┐
│         Resilience4j 모니터링 파이프라인                         │
│                                                                 │
│  Resilience4j ──► Micrometer ──► Prometheus ──► Grafana         │
│  (메트릭 생성)    (수집 추상화)   (시계열 저장)  (시각화/알림)  │
│                                                                 │
│  설정:                                                          │
│  resilience4j:                                                  │
│    circuitbreaker:                                              │
│      configs:                                                   │
│        default:                                                 │
│          registerHealthIndicator: true  # Actuator Health 연동  │
│                                                                 │
│  management:                                                    │
│    metrics:                                                     │
│      distribution:                                              │
│        percentiles-histogram:                                   │
│          resilience4j.circuitbreaker.calls: true                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**핵심 모니터링 메트릭:**

| 메트릭 | Prometheus 이름 | 의미 | 알림 조건 |
|--------|----------------|------|-----------|
| CB 상태 | `resilience4j_circuitbreaker_state` | 0=CLOSED, 1=OPEN, 2=HALF_OPEN | state=1 (OPEN) |
| 실패율 | `resilience4j_circuitbreaker_failure_rate` | 슬라이딩 윈도우 실패율 (%) | > 30% |
| 느린 호출율 | `resilience4j_circuitbreaker_slow_call_rate` | 느린 호출 비율 (%) | > 50% |
| 거부된 호출 | `resilience4j_circuitbreaker_not_permitted_calls_total` | CB OPEN으로 거부된 호출 수 | > 0 (CB 열림 감지) |
| Bulkhead 가용 슬롯 | `resilience4j_bulkhead_available_concurrent_calls` | 남은 동시 호출 가능 수 | < 5 (포화 임박) |
| Retry 횟수 | `resilience4j_retry_calls_total` | 재시도 발생 횟수 | 급증 시 |

```yaml
# Prometheus AlertManager 규칙 예시
groups:
  - name: resilience4j-alerts
    rules:
      - alert: CircuitBreakerOpen
        expr: resilience4j_circuitbreaker_state == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit Breaker {{ $labels.name }} is OPEN"
          description: >
            Circuit Breaker {{ $labels.name }}이 OPEN 상태입니다.
            downstream 서비스 장애를 확인하세요.

      - alert: HighFailureRate
        expr: resilience4j_circuitbreaker_failure_rate > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.name }} failure rate {{ $value }}%"
          description: >
            {{ $labels.name }}의 실패율이 {{ $value }}%로 높습니다.
            CB OPEN 임계값(50%) 이전에 원인을 확인하세요.

      - alert: BulkheadNearSaturation
        expr: resilience4j_bulkhead_available_concurrent_calls < 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Bulkhead {{ $labels.name }} nearly saturated"
```

**Grafana Dashboard:** Resilience4j 공식 대시보드 ID `21307` 사용 가능.

---

# 6. 안티패턴과 함정

## 6.1 Retry Storm (재시도 폭풍)

```
┌─────────────────────────────────────────────────────────────────┐
│              Retry Storm (재시도 폭풍)                            │
│                                                                 │
│  [정상 상태]                                                    │
│  Clients ──► Service (1000 req/s) ──► DB                        │
│                                                                 │
│  [DB 장애 발생]                                                 │
│  Clients ──► Service ──✗── DB                                   │
│                                                                 │
│  각 클라이언트가 3회 재시도:                                    │
│  ┌──────────────────────────────────────┐                       │
│  │  정상: 1000 req/s                    │                       │
│  │  장애 + Retry: 1000 × 3 = 3000 req/s │  ← 3배 부하!         │
│  │                                      │                       │
│  │  DB가 회복되려는 순간...              │                       │
│  │  3000 req/s 폭풍이 DB를 다시 죽임    │                       │
│  │  → 회복 불가능한 악순환              │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  실제 사례: Square Redis 장애 (2017)                            │
│  ├── Redis 서버 일시 장애                                       │
│  ├── 모든 서비스가 최대 500회(!) 연속 재시도                   │
│  ├── Redis가 복구 시도할 때마다 재시도 폭풍에 다시 다운         │
│  └── 해결까지 수 시간 소요                                      │
│                                                                 │
│  해결책:                                                        │
│  ├── Exponential Backoff + Jitter (재시도 분산)                 │
│  ├── maxRetries 제한 (3~5회)                                    │
│  ├── Circuit Breaker와 조합 (CB OPEN이면 재시도 중단)          │
│  └── 서비스 전체의 동시 재시도 수 상한 설정                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Cascading Retry (재시도 증폭)

```
┌─────────────────────────────────────────────────────────────────┐
│              Cascading Retry (재시도 증폭) 문제                   │
│                                                                 │
│  A ──► B ──► C  (각 서비스가 독립적으로 3회 재시도)             │
│                                                                 │
│  C 실패 시:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  B → C: 시도 1 ──✗                                      │    │
│  │  B → C: 시도 2 ──✗                                      │    │
│  │  B → C: 시도 3 ──✗  → B가 실패 반환                     │    │
│  │                                                          │    │
│  │  A → B: 시도 1 (B가 위 과정 반복)                        │    │
│  │    B → C: ✗✗✗ (3회)                                     │    │
│  │  A → B: 시도 2                                           │    │
│  │    B → C: ✗✗✗ (3회)                                     │    │
│  │  A → B: 시도 3                                           │    │
│  │    B → C: ✗✗✗ (3회)                                     │    │
│  │                                                          │    │
│  │  결과: C에 대한 실제 호출 = 3 × 3 = 9회                  │    │
│  │  4단계 체인이면: 3 × 3 × 3 = 27회!                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  해결책:                                                        │
│  ├── 최상위 서비스(A)에서만 Retry                               │
│  ├── 중간 서비스(B)는 Retry 없이 즉시 실패 전파                │
│  ├── 각 서비스 경계에 Circuit Breaker 배치                      │
│  └── Retry 시 "Retry-Count" 헤더 전파 → 하위에서 중복 방지     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 Bulkhead 없이 Thread Pool 공유

```
┌─────────────────────────────────────────────────────────────────┐
│              Thread Pool 공유 문제                                │
│                                                                 │
│  [공유 Thread Pool 시나리오]                                    │
│                                                                 │
│  Service A (정상)  ──┐                                          │
│  Service B (느림)  ──┼──► 공유 Thread Pool (200)                │
│  Service C (정상)  ──┘                                          │
│                                                                 │
│  Thread Pool 상태 변화:                                         │
│                                                                 │
│  t=0  [A:10 B:10 C:10 ░░░░░░░░░░░░░░ 170 available]           │
│  t=1  [A:10 B:50 C:10 ░░░░░░░░░░░░░ 130 available]  B 느려짐  │
│  t=2  [A:10 B:150 C:10 ░░░░░░░░░░░░ 30 available]   B 누적    │
│  t=3  [A:5  B:190 C:5  ░░ 0 available]              전부 B    │
│                                                                 │
│  → A, C도 새 요청 처리 불가!                                    │
│  → B 하나의 장애가 전체 시스템 마비                             │
│                                                                 │
│  [Bulkhead 적용 후]                                             │
│                                                                 │
│  ┌── Pool A (50) ──┐ ┌── Pool B (100) ─┐ ┌── Pool C (50) ──┐  │
│  │ A:10 ░░░░ 40    │ │ B:100 (가득참!)  │ │ C:10 ░░░░ 40    │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│   A 정상 동작         B 초과분만 거부     C 정상 동작           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.4 Fallback에서 원격 호출

```
┌─────────────────────────────────────────────────────────────────┐
│              Fallback 안티패턴: 원격 호출                        │
│                                                                 │
│  [BAD] Fallback에서 또 다른 원격 서비스 호출                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  try {                                                   │    │
│  │      return paymentServiceA.process(request) // 실패     │    │
│  │  } catch (e: Exception) {                                │    │
│  │      return paymentServiceB.process(request) // 이것도   │    │
│  │      // 같은 네트워크 문제로 실패할 가능성 높음!         │    │
│  │      // CB가 보호하는 의미가 없어짐                      │    │
│  │  }                                                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [GOOD] Fallback은 로컬에서 즉시 응답                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  circuitBreaker.executeFunction {                        │    │
│  │      paymentServiceA.process(request)                    │    │
│  │  }.recover {                                             │    │
│  │      // 로컬 캐시 또는 기본값 반환                       │    │
│  │      cachedResult ?: defaultResponse                     │    │
│  │  }                                                       │    │
│  │                                                          │    │
│  │  대체 서비스 호출이 반드시 필요하다면,                    │    │
│  │  해당 호출도 별도의 CB + Timeout으로 보호해야 함!        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.5 Circuit Breaker Granularity 실수

```
┌─────────────────────────────────────────────────────────────────┐
│              CB Granularity (세분화 수준) 문제                    │
│                                                                 │
│  [BAD] 서비스 레벨 CB (너무 거친 단위)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  OrderService에 대해 CB 하나:                            │    │
│  │                                                          │    │
│  │  GET  /orders       ──┐                                  │    │
│  │  POST /orders       ──┤── CB "orderService"              │    │
│  │  GET  /orders/stats ──┘                                  │    │
│  │                                                          │    │
│  │  /orders/stats만 느려져도 전체 CB가 OPEN                 │    │
│  │  → 정상인 GET /orders, POST /orders도 차단됨!           │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [GOOD] 엔드포인트 레벨 CB (적절한 단위)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  GET  /orders       ── CB "orderService-getOrders"      │    │
│  │  POST /orders       ── CB "orderService-createOrder"    │    │
│  │  GET  /orders/stats ── CB "orderService-getStats"       │    │
│  │                                                          │    │
│  │  /orders/stats CB만 OPEN                                 │    │
│  │  → 나머지 엔드포인트는 정상 동작 유지                   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  원칙: 장애 영향 범위가 CB의 단위                               │
│  ├── 같은 DB 테이블 사용 → 같은 CB                              │
│  ├── 다른 인프라 의존성 → 다른 CB                               │
│  └── 장애 시 함께 죽는 엔드포인트 → 같은 CB                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.6 잘못된 Timeout 설정

```
┌─────────────────────────────────────────────────────────────────┐
│              Timeout 설정 실수                                   │
│                                                                 │
│  [너무 짧은 Timeout]                                            │
│  ├── 문제: 정상 요청도 timeout 초과로 실패                      │
│  ├── 결과: CB에 실패로 기록 → 오탐(false positive)으로 CB OPEN │
│  ├── 예: p99 = 2초인데 timeout = 1초 설정                      │
│  └── 1%의 정상 느린 요청이 계속 실패 처리됨                     │
│                                                                 │
│  [너무 긴 Timeout]                                              │
│  ├── 문제: 장애 시 스레드가 오래 대기                           │
│  ├── 결과: Thread Pool 고갈, Bulkhead 효과 상실                │
│  ├── 예: timeout = 60초, Bulkhead = 50 스레드                  │
│  │   → 50개 스레드가 각 60초씩 대기 → 50초간 새 요청 불가     │
│  └── Michael Nygard: "Timeout 없는 원격 호출 = 시한폭탄"       │
│                                                                 │
│  [적절한 Timeout]                                               │
│  ├── 공식: p99.9 + 20~50% buffer                                │
│  ├── 예: p99.9 = 2초 → timeout = 2.5~3초                      │
│  └── 주기적으로 latency 분포 확인 후 조정                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 마이그레이션 가이드

## 7.1 Hystrix → Resilience4j

**Dependency 교체:**

```xml
<!-- 제거 -->
<dependency>
    <groupId>com.netflix.hystrix</groupId>
    <artifactId>hystrix-core</artifactId>
</dependency>

<!-- 추가 -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
</dependency>
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-kotlin</artifactId>
    <version>2.2.0</version>
</dependency>
```

**코드 마이그레이션 매핑:**

| Hystrix | Resilience4j | 비고 |
|---------|-------------|------|
| `HystrixCommand` | `CircuitBreaker.decorateFunction()` | Command → 함수형 데코레이터 |
| `@HystrixCommand(fallbackMethod = "fallback")` | `@CircuitBreaker(name = "x", fallbackMethod = "fallback")` | 어노테이션 유사 |
| `HystrixCommandGroupKey` | `CircuitBreakerRegistry` | 그룹 → 레지스트리 |
| `HystrixThreadPoolKey` | `ThreadPoolBulkhead` | Thread Pool 분리 |
| `execution.isolation.thread.timeoutInMilliseconds` | `TimeLimiter.timeoutDuration` | 별도 모듈로 분리 |
| `circuitBreaker.requestVolumeThreshold` | `minimumNumberOfCalls` | 이름만 다름 |
| `circuitBreaker.errorThresholdPercentage` | `failureRateThreshold` | 이름만 다름 |
| `circuitBreaker.sleepWindowInMilliseconds` | `waitDurationInOpenState` | 이름만 다름 |

**설정 매핑:**

| Hystrix 설정 | Resilience4j 설정 |
|-------------|------------------|
| `hystrix.command.default.execution.isolation.strategy` | `bulkhead` (SEMAPHORE) 또는 `thread-pool-bulkhead` (THREAD) |
| `hystrix.command.default.execution.isolation.thread.timeoutInMilliseconds: 3000` | `resilience4j.timelimiter.instances.xxx.timeoutDuration: 3s` |
| `hystrix.command.default.circuitBreaker.requestVolumeThreshold: 20` | `resilience4j.circuitbreaker.instances.xxx.minimumNumberOfCalls: 20` |
| `hystrix.command.default.circuitBreaker.errorThresholdPercentage: 50` | `resilience4j.circuitbreaker.instances.xxx.failureRateThreshold: 50` |
| `hystrix.threadpool.default.coreSize: 10` | `resilience4j.thread-pool-bulkhead.instances.xxx.coreThreadPoolSize: 10` |

**주요 함정:**

```
┌─────────────────────────────────────────────────────────────────┐
│              Hystrix → Resilience4j 마이그레이션 함정            │
│                                                                 │
│  1. 예외 처리 차이                                              │
│  ├── Hystrix: HystrixBadRequestException → fallback 미호출     │
│  ├── R4j: ignoreExceptions에 명시해야 함                       │
│  └── 마이그레이션 시 ignoreExceptions 설정 누락 주의!          │
│                                                                 │
│  2. Fallback 시그니처                                           │
│  ├── Hystrix: fallback 메서드에 Throwable 파라미터 선택적      │
│  ├── R4j: fallback 메서드에 Throwable 파라미터 필수            │
│  └── fun fallback(request: Req, t: Throwable): Response        │
│                                                                 │
│  3. Context Propagation                                         │
│  ├── Hystrix: HystrixRequestContext로 쓰레드 간 컨텍스트 전파  │
│  ├── R4j: ContextPropagator 인터페이스 별도 구현 필요          │
│  └── MDC, SecurityContext 등 전파 누락 주의                     │
│                                                                 │
│  4. Thread Pool vs Semaphore 기본값                             │
│  ├── Hystrix: Thread Pool이 기본 (별도 스레드에서 실행)        │
│  ├── R4j: Semaphore가 기본 (호출자 스레드에서 실행)            │
│  └── 동작 차이 인지 필요                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Application Level → Service Mesh 전환

```
┌─────────────────────────────────────────────────────────────────┐
│         Service Mesh CB의 한계와 전환 전략                       │
│                                                                 │
│  Service Mesh (Istio/Envoy)의 Circuit Breaker 한계:             │
│  ├── HTTP 상태 코드(5xx) 기반만 가능                           │
│  │   (비즈니스 예외 200 OK 응답 내부 에러 코드 미감지)         │
│  ├── Fallback 로직 불가 (요청 거부만 가능)                     │
│  ├── 느린 호출 감지 제한 (Outlier Detection은 다른 개념)       │
│  └── 세밀한 예외 구분 불가                                     │
│                                                                 │
│  전환 전략 (3단계):                                             │
│                                                                 │
│  Phase 1: 병행 운영 (Shadow Mode)                               │
│  ├── Service Mesh CB 설정 (느슨하게)                           │
│  ├── Application CB 유지 (기존대로)                             │
│  ├── 메트릭 비교 → 두 레이어의 동작 검증                       │
│  └── 기간: 2~4주                                               │
│                                                                 │
│  Phase 2: 역할 분리                                             │
│  ├── Service Mesh: Connection-level 보호 (Outlier Detection)   │
│  ├── Application: 비즈니스 로직 인지 보호 (Fallback, 예외 구분)│
│  └── 기간: 2~4주                                               │
│                                                                 │
│  Phase 3: Application 레이어 간소화                             │
│  ├── Service Mesh가 잘 처리하는 것 → Application에서 제거      │
│  │   (기본 Retry, Connection Timeout)                           │
│  ├── Application에서만 할 수 있는 것 → 유지                    │
│  │   (Fallback, 비즈니스 예외 CB, Bulkhead)                    │
│  └── 이후 운영 안정화                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7.3 점진적 도입 전략

```
┌─────────────────────────────────────────────────────────────────┐
│              점진적 Resilience 도입 전략                          │
│                                                                 │
│  우선순위 매트릭스:                                             │
│                                                                 │
│  높은 위험                                                      │
│  ▲                                                              │
│  │  ①외부 API    ②서비스간 호출                                │
│  │                                                              │
│  │  ③DB 호출     ④캐시 호출                                    │
│  │                                                              │
│  └──────────────────────────────────────────────► 높은 호출량   │
│                                                                 │
│  도입 순서: ① → ② → ③ → ④                                    │
│  외부 API가 가장 불확실하고 제어 불가능 → 최우선                │
│                                                                 │
│  4주 도입 계획:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Week 1: 외부 API 호출에 CB + Timeout + Retry           │    │
│  │          + METRICS_ONLY 모드로 관찰                      │    │
│  │                                                          │    │
│  │  Week 2: METRICS_ONLY → 실제 CB 활성화                   │    │
│  │          + 서비스 간 호출에 CB + Timeout 추가             │    │
│  │                                                          │    │
│  │  Week 3: Fallback 로직 구현                              │    │
│  │          + Bulkhead 추가 (주요 서비스별 격리)             │    │
│  │                                                          │    │
│  │  Week 4: 모니터링 대시보드 + 알림 설정                    │    │
│  │          + Chaos Engineering 테스트                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 용어 사전

```
┌─────────────────────────────────────────────────────────────────┐
│                         용어 사전                                │
│                                                                 │
│  Circuit Breaker (회로 차단기)                                  │
│  ├── 전기공학에서 차용한 소프트웨어 패턴                        │
│  ├── 원격 호출 실패 감지 → 빠른 실패 반환으로 연쇄 장애 방지   │
│  └── 최초 제안: Michael Nygard, "Release It!" (2007)           │
│                                                                 │
│  CLOSED 상태                                                    │
│  ├── 전기: 회로가 연결됨 → 전류가 흐름                         │
│  └── 소프트웨어: 요청이 통과함 (정상 상태)                     │
│                                                                 │
│  OPEN 상태                                                      │
│  ├── 전기: 회로가 끊어짐 → 전류가 차단                         │
│  └── 소프트웨어: 요청이 즉시 거부됨 (장애 감지 상태)           │
│                                                                 │
│  HALF-OPEN 상태                                                 │
│  ├── 소프트웨어 전용 개념 (전기에는 없음)                      │
│  └── 제한적 요청을 보내 서비스 복구 여부 탐침(probe)           │
│                                                                 │
│  Bulkhead (격벽)                                                │
│  ├── 선박 격벽에서 유래: 침수 구역을 격리하여 전체 침몰 방지   │
│  ├── 고대 그리스 삼단노선에서 최초 사용                         │
│  └── 소프트웨어: 서비스별 리소스 풀 격리                       │
│                                                                 │
│  Retry (재시도)                                                 │
│  ├── 일시적 실패 시 동일 요청을 다시 시도                      │
│  └── 주의: 멱등성(idempotency) 보장 필수                       │
│                                                                 │
│  Exponential Backoff (지수 백오프)                               │
│  ├── 재시도 간격을 지수적으로 증가 (1초, 2초, 4초, 8초...)     │
│  ├── 기원: David Boggs, 1976년 Ethernet 충돌 해결 알고리즘     │
│  └── IEEE 802.3 (1983)에 공식 채택                              │
│                                                                 │
│  Jitter (지터)                                                  │
│  ├── 재시도 간격에 무작위성 추가 → 동시 재시도 분산            │
│  ├── 기원: 신호처리(Signal Processing)의 시간 변동              │
│  └── AWS Architecture Blog (2015)에서 분산 시스템 적용 정립     │
│                                                                 │
│  Timeout (타임아웃)                                             │
│  ├── Connection Timeout: TCP 연결 수립 대기 시간 제한           │
│  ├── Read Timeout (Socket Timeout): 데이터 수신 대기 시간 제한  │
│  └── "모든 원격 호출에 반드시 설정" — Michael Nygard           │
│                                                                 │
│  Rate Limiter (속도 제한기)                                     │
│  ├── Token Bucket: 토큰이 일정 속도로 충전, 요청 시 소비       │
│  │   → 버스트 허용                                              │
│  ├── Leaky Bucket: 요청이 큐에 들어가 일정 속도로 처리         │
│  │   → 출력 속도 일정 (트래픽 셰이핑)                          │
│  ├── Fixed Window: 고정 시간 구간별 카운터                     │
│  │   → 구현 단순하나 경계 문제                                 │
│  └── Sliding Window: 현재 시각 기준 이동 윈도우                │
│      → 정확하나 메모리 비용                                     │
│                                                                 │
│  Fallback (대체 수단)                                           │
│  ├── 군사 용어 "Fall back!" (후퇴) 에서 유래                    │
│  └── 주 서비스 실패 시 대안 응답 제공                           │
│                                                                 │
│  Graceful Degradation (우아한 성능 저하)                        │
│  ├── 장애 시 기능을 점진적으로 축소하며 서비스 유지             │
│  └── 반대: Fail-fast (빠른 실패)                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Resilience4j                                                   │
│  ├── "Resilience for Java"의 약자                               │
│  ├── "4j" 네이밍 컨벤션: Log4j, Hibernate4j 등 Java 관례       │
│  ├── Hystrix의 정신적 후속작 (직접 fork는 아님)                │
│  └── 경량, 모듈러, 함수형 API                                  │
│                                                                 │
│  Hystrix (히스트릭스)                                           │
│  ├── 호저(Porcupine) 속의 학명 (Hystrix cristata)              │
│  ├── Netflix가 "방어적 가시"의 이미지로 명명                   │
│  └── 2018년 유지보수 모드 전환, 사실상 deprecated              │
│                                                                 │
│  Istio (이스티오)                                               │
│  ├── 그리스어 ιστίο = "돛" (sail)                              │
│  ├── Kubernetes의 "항해(steering)" 은유와 연결                 │
│  └── Google/IBM/Lyft 공동 개발 Service Mesh                     │
│                                                                 │
│  Envoy (엔보이)                                                 │
│  ├── 프랑스어 envoyé = "메신저" (전령)                          │
│  ├── 서비스 간 통신을 중개하는 프록시 역할에서 유래             │
│  └── Lyft 개발, Istio의 데이터 플레인                          │
│                                                                 │
│  Polly                                                          │
│  ├── "Policy"에서 유래 (정책 기반 Resilience)                   │
│  └── .NET 생태계 표준 Resilience 라이브러리                     │
│                                                                 │
│  Sentinel (센티널)                                              │
│  ├── 라틴어 sentire = "감지하다" (to feel/sense)               │
│  ├── 보초, 감시자의 의미                                       │
│  └── Alibaba 개발, Flow Control (유량 제어) 특화                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Cascading Failure (연쇄 장애)                                  │
│  ├── 하나의 장애가 연쇄적으로 다른 서비스로 전파               │
│  └── 전력 그리드의 대규모 정전과 동일한 원리                    │
│                                                                 │
│  Partial Failure (부분 장애)                                    │
│  ├── 분산 시스템에서 일부만 실패하는 상태                      │
│  └── 모놀리식에서는 존재하지 않는 개념                          │
│                                                                 │
│  Chaos Engineering (혼돈 공학)                                  │
│  ├── 프로덕션 시스템에 의도적 장애를 주입하여 내성 검증        │
│  ├── Netflix Chaos Monkey (2011): 무작위 인스턴스 종료          │
│  ├── Simian Army: Chaos Gorilla, Latency Monkey 등 도구 모음   │
│  └── "Chaos Engineering" by Casey Rosenthal et al. (2017)       │
│                                                                 │
│  SLI (Service Level Indicator)                                  │
│  ├── 서비스 수준을 측정하는 지표 (예: 가용률, 응답 시간)       │
│                                                                 │
│  SLO (Service Level Objective)                                  │
│  ├── SLI의 목표값 (예: 가용률 99.9%)                           │
│                                                                 │
│  SLA (Service Level Agreement)                                  │
│  ├── SLO에 법적/비즈니스 구속력을 부여한 계약                  │
│                                                                 │
│  Error Budget (에러 예산)                                       │
│  ├── SLO에서 허용하는 실패 여유분                              │
│  ├── 예: SLO 99.9% → 월간 43.8분 다운타임 허용                │
│  └── Google SRE 팀이 정립한 개념 (2016)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 연대표

```
┌─────────────────────────────────────────────────────────────────┐
│          Circuit Breaker & Resilience 역사 연대표                │
│                                                                 │
│  연도   │ 사건                                                  │
│  ───────┼───────────────────────────────────────────────────────│
│  1879   │ Thomas Edison, 전기 Circuit Breaker 특허              │
│         │ (US Patent 438,305 — 퓨즈 기반 과전류 차단)           │
│         │                                                       │
│  1982   │ Lamport, Shostak, Pease                               │
│         │ "The Byzantine Generals Problem" 발표                 │
│         │ → 분산 시스템 합의 문제의 이론적 토대                 │
│         │                                                       │
│  1994   │ Peter Deutsch, "Fallacies of Distributed Computing"   │
│         │ Sun Microsystems에서 8가지 분산 컴퓨팅 오류 정리      │
│         │ → "네트워크는 신뢰할 수 없다"                        │
│         │                                                       │
│  2000   │ Eric Brewer, CAP Theorem 발표 (PODC 2000)             │
│         │ → Consistency, Availability, Partition Tolerance      │
│         │   셋 중 둘만 선택 가능                                │
│         │                                                       │
│  2003   │ Eric Evans, "Domain-Driven Design" 출간               │
│         │                                                       │
│  2007   │ Michael Nygard, "Release It!" 출간                    │
│         │ ★ 소프트웨어 Circuit Breaker 패턴 최초 제안           │
│         │ Stability Patterns: CB, Timeout, Bulkhead 등 정립     │
│         │                                                       │
│  2008   │ Netflix DB 장애 (3일간 DVD 배송 중단)                 │
│         │ → AWS 마이그레이션 결정, 분산 시스템 전환 시작        │
│         │                                                       │
│  2010   │ Netflix 마이크로서비스 아키텍처 본격 전환             │
│         │                                                       │
│  2011   │ Netflix Chaos Monkey 오픈소스 공개                    │
│         │ ★ Chaos Engineering의 시작                            │
│         │ Hystrix 개발 착수 (Ben Christensen)                   │
│         │                                                       │
│  2012   │ Netflix Hystrix 오픈소스 공개                         │
│         │ ★ 대규모 프로덕션 Circuit Breaker 최초 사례           │
│         │ Thread Pool Isolation, Command 패턴 기반              │
│         │                                                       │
│  2013   │ Polly 1.0 출시 (.NET Circuit Breaker)                 │
│         │ Microsoft Transient Fault Handling Application Block  │
│         │                                                       │
│  2014   │ Martin Fowler, "CircuitBreaker" 블로그 포스트         │
│         │ ★ Circuit Breaker 패턴 대중화에 크게 기여             │
│         │                                                       │
│  2015   │ AWS Architecture Blog                                 │
│         │ "Exponential Backoff And Jitter" 발표                 │
│         │ Full/Equal/Decorrelated Jitter 비교 분석              │
│         │                                                       │
│  2016   │ Envoy Proxy 오픈소스 공개 (Lyft)                      │
│         │ Google SRE Book 출간 ("Site Reliability Engineering") │
│         │ → SLI/SLO/SLA/Error Budget 개념 정립                 │
│         │ Michael Nygard, "Release It! 2nd Ed." 출간            │
│         │                                                       │
│  2017   │ Resilience4j 최초 릴리스                              │
│         │ ★ Java 8 함수형 API, 경량 모듈러 설계                │
│         │ Istio 0.1 발표 (Google/IBM/Lyft)                      │
│         │ "Chaos Engineering" 서적 출간 (Casey Rosenthal 외)    │
│         │ Square Redis 장애 (Retry Storm 교훈)                  │
│         │                                                       │
│  2018   │ Istio 1.0 GA                                          │
│         │ ★ Hystrix Maintenance Mode 전환 (사실상 deprecated)   │
│         │ Netflix가 Resilience4j를 대안으로 공식 추천           │
│         │ Spring Cloud가 Resilience4j 통합 시작                 │
│         │ Sentinel 오픈소스 공개 (Alibaba)                      │
│         │ Chris Richardson, "Microservices Patterns" 출간       │
│         │                                                       │
│  2019   │ Spring Cloud Circuit Breaker 추상화 모듈 출시         │
│         │ → Hystrix, Resilience4j, Sentinel 동일 API로 추상화  │
│         │                                                       │
│  2020   │ Martin Kleppmann, "DDIA" 2nd draft 공개               │
│         │                                                       │
│  2021   │ Dapr v1.0 GA (Distributed Application Runtime)        │
│         │ → 사이드카 기반 언어 독립 Resilience                  │
│         │                                                       │
│  2023   │ Polly v8 릴리스                                       │
│         │ → ResiliencePipeline, Hedging, Simmy Chaos 내장       │
│         │ Resilience4j 2.x (Java 17+ 지원)                     │
│         │                                                       │
│  2024   │ Istio Ambient Mesh GA                                 │
│     ~   │ → Sidecar 없는 Service Mesh (ztunnel + waypoint)     │
│  2025   │ eBPF 기반 네트워킹 (Cilium) 확산                     │
│         │ → 커널 레벨에서 L4/L7 정책 적용                      │
│         │ Envoy Gateway v1.0 (Gateway API 표준 구현)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 대안 비교표

## 10.1 라이브러리 상세 비교표

| 비교 항목 | Resilience4j | Hystrix | Polly v8 | Sentinel | Failsafe-go | Sony Gobreaker |
|-----------|-------------|---------|----------|----------|-------------|----------------|
| **언어** | Java/Kotlin | Java | C# (.NET) | Java | Go | Go |
| **최초 릴리스** | 2017 | 2012 | 2013 | 2018 | 2022 | 2017 |
| **최신 버전** | 2.2.x | 1.5.18 (최종) | 8.x | 1.8.x | 0.x | 0.x |
| **유지보수** | Active | Deprecated | Active | Active | Active | Active |
| **설계 철학** | 함수형 데코레이터 | Command 패턴 | Pipeline 체인 | SPI 플러그인 | 함수형 | 단일 목적 |
| **오버헤드** | <1µs | ~1ms | <1µs | <1µs | <1µs | <1µs |
| **모듈성** | 높음 (각 패턴 별도 모듈) | 낮음 (단일 JAR) | 높음 | 중간 | 높음 | N/A (CB만) |
| **리액티브** | Reactor, RxJava2/3 | RxJava1만 | async/await | Reactor | goroutine | goroutine |
| **Spring 통합** | 공식 Starter | Spring Cloud Netflix | N/A | Spring Cloud Alibaba | N/A | N/A |
| **대시보드** | Grafana (외부) | Hystrix Dashboard | .NET Metrics | 내장 Dashboard | Prometheus | 없음 |
| **Chaos** | 없음 | 없음 | Simmy 내장 | 없음 | 없음 | 없음 |

## 10.2 패턴 비교표

| 비교 | Circuit Breaker | Retry | 차이 |
|------|----------------|-------|------|
| 목적 | 장애 확산 차단 | 일시적 실패 극복 | CB는 "차단", Retry는 "재시도" |
| 실패 대응 | 빠른 실패 (Fail Fast) | 재시도 후 성공 기대 | CB는 포기, Retry는 재도전 |
| 조합 | Retry 안쪽에 CB 배치 | CB 바깥에 Retry 배치 | CB OPEN이면 Retry도 중단 |

| 비교 | Bulkhead | Rate Limiter | 차이 |
|------|----------|-------------|------|
| 목적 | 리소스 격리 (내부 보호) | 처리량 제한 (과부하 방지) | 격리 vs 제한 |
| 적용 대상 | 서비스별 리소스 풀 | 엔드포인트별 호출량 | 내부 보호 vs 외부 제한 |
| 초과 시 | BulkheadFullException | RequestNotPermitted (대기/거부) | 즉시 거부 vs 대기 가능 |

| 비교 | Application CB | Service Mesh CB | 차이 |
|------|---------------|----------------|------|
| 장애 감지 | 비즈니스 예외 구분 | HTTP 5xx만 | 세밀도 차이 |
| Fallback | 복잡한 대체 로직 | 불가 | 핵심 차이점 |
| 배포 | 코드 변경 + 재배포 | 설정 변경만 | 운영 편의성 |
| 언어 독립 | 언어별 구현 필요 | 완전 독립 | 폴리글랏 환경에서 유리 |

## 10.3 상황별 최적 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│              상황별 최적 선택 가이드                              │
│                                                                 │
│  Q1: 어떤 언어를 사용하는가?                                    │
│  ├── Java/Kotlin → Resilience4j (1순위), Sentinel (유량 제어 시)│
│  ├── .NET/C# → Polly v8                                        │
│  ├── Go → Failsafe-go (범용), Gobreaker (CB만)                 │
│  └── 다중 언어 → Service Mesh (Istio/Envoy) + Application CB   │
│                                                                 │
│  Q2: 어떤 문제를 해결하려는가?                                  │
│  ├── 연쇄 장애 방지 → Circuit Breaker                          │
│  ├── 일시적 실패 복구 → Retry + Exponential Backoff + Jitter   │
│  ├── 느린 서비스 격리 → Bulkhead + Timeout                     │
│  ├── API 호출량 제한 → Rate Limiter                            │
│  ├── 장애 시 대안 제공 → Fallback + Graceful Degradation       │
│  └── 전부 → Defense in Depth (모든 패턴 조합)                  │
│                                                                 │
│  Q3: 인프라 환경은?                                             │
│  ├── Kubernetes + Service Mesh → Istio CB + Application CB     │
│  ├── Kubernetes만 → Application CB 필수                        │
│  ├── VM/베어메탈 → Application CB 필수                          │
│  └── Serverless → 클라우드 내장 Retry + Application CB         │
│                                                                 │
│  Q4: 팀 성숙도는?                                               │
│  ├── 초기 (Resilience 경험 없음)                                │
│  │   → Timeout + Retry만 먼저 (2주)                            │
│  │   → CB + Fallback 추가 (2주)                                │
│  │   → 모니터링 구축 후 Bulkhead + RateLimiter (2주)           │
│  ├── 중급 (일부 패턴 경험)                                     │
│  │   → 전체 패턴 도입 + METRICS_ONLY 관찰 기간                │
│  └── 고급 (Resilience 운영 경험)                                │
│      → Chaos Engineering + Error Budget 기반 운영              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 성능 벤치마크

```
┌─────────────────────────────────────────────────────────────────┐
│              성능 벤치마크                                        │
│                                                                 │
│  [1. Resilience4j 오버헤드]                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Circuit Breaker 호출 오버헤드: < 1µs (마이크로초)       │    │
│  │  Bulkhead (Semaphore): ~ 0.5µs                           │    │
│  │  Rate Limiter: ~ 0.3µs                                   │    │
│  │  Retry (오버헤드만, 재시도 제외): ~ 0.1µs                │    │
│  │                                                          │    │
│  │  결론: 실제 원격 호출 (수 ms~수백 ms) 대비 무시할 수준   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [2. Hystrix vs Resilience4j 비교]                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  항목               │ Hystrix      │ Resilience4j       │    │
│  │  ───────────────────┼──────────────┼────────────────────│    │
│  │  호출 오버헤드       │ ~1ms         │ <1µs (1000배 빠름) │    │
│  │  CB OPEN 거부 속도   │ ~0.5ms       │ <1µs (500배 빠름)  │    │
│  │  메모리 (인스턴스당) │ ~2MB         │ ~50KB              │    │
│  │  Thread Pool 방식    │ 전용 풀 필수 │ Semaphore 기본     │    │
│  │  GC 영향            │ 높음         │ 거의 없음          │    │
│  │                                                          │    │
│  │  주요 차이 원인:                                         │    │
│  │  ├── Hystrix: RxJava Observable 생성/구독 오버헤드       │    │
│  │  ├── Hystrix: Command 객체 매번 생성                     │    │
│  │  └── R4j: Ring Buffer + Atomic 연산 (객체 생성 최소화)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [3. Service Mesh (Istio/Envoy) 레이턴시]                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Istio Sidecar (Envoy) 추가 레이턴시:                    │    │
│  │  ├── P50: +2~3ms                                        │    │
│  │  ├── P99: +5~10ms                                       │    │
│  │  └── P99.9: +15~25ms                                    │    │
│  │                                                          │    │
│  │  Istio Ambient Mesh (ztunnel) 추가 레이턴시:             │    │
│  │  ├── L4 (ztunnel만): P50 +0.5ms, P99 +1~2ms            │    │
│  │  ├── L7 (waypoint): P50 +1~2ms, P99 +3~5ms             │    │
│  │  └── Sidecar 대비 약 40~60% 레이턴시 감소               │    │
│  │                                                          │    │
│  │  참고: 레이턴시 vs 가시성/보안 트레이드오프               │    │
│  │  대부분의 서비스에서 수 ms 추가 레이턴시는 수용 가능     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [4. Thread Pool vs Semaphore 격리 비교]                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  항목               │ Thread Pool  │ Semaphore          │    │
│  │  ───────────────────┼──────────────┼────────────────────│    │
│  │  컨텍스트 스위칭     │ 있음 (~10µs) │ 없음               │    │
│  │  메모리 (스레드당)   │ ~512KB       │ 없음               │    │
│  │  타임아웃 분리       │ 독립 가능    │ 별도 TimeLimiter   │    │
│  │  리액티브 호환       │ 부적합       │ 적합               │    │
│  │  코루틴 호환         │ 부적합       │ 적합               │    │
│  │  격리 강도           │ 완전 격리    │ 동시성 제한만      │    │
│  │                                                          │    │
│  │  권장:                                                   │    │
│  │  ├── Servlet 블로킹: Thread Pool (강한 격리)             │    │
│  │  ├── WebFlux/Coroutine: Semaphore (오버헤드 최소)        │    │
│  │  └── 혼합 환경: Semaphore 기본, 필요 시 Thread Pool      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 참고 자료

## 핵심 서적

| 서적 | 저자 | 연도 | 핵심 기여 |
|------|------|------|----------|
| Release It! (1st Ed.) | Michael Nygard | 2007 | 소프트웨어 Circuit Breaker 최초 제안, Stability Patterns |
| Release It! (2nd Ed.) | Michael Nygard | 2018 | 클라우드 시대 업데이트 |
| Designing Data-Intensive Applications (DDIA) | Martin Kleppmann | 2017 | 분산 시스템 설계의 바이블 |
| Chaos Engineering | Casey Rosenthal, Nora Jones | 2020 | Chaos Engineering 원칙과 실전 |
| Site Reliability Engineering (SRE) | Betsy Beyer 외 | 2016 | SLI/SLO/SLA/Error Budget, Google SRE 프랙티스 |
| Microservices Patterns | Chris Richardson | 2018 | 44개+ 마이크로서비스 패턴 카탈로그 |

## 공식 문서

| 라이브러리/프레임워크 | URL |
|----------------------|-----|
| Resilience4j | https://resilience4j.readme.io/ |
| Resilience4j GitHub | https://github.com/resilience4j/resilience4j |
| Hystrix (archived) | https://github.com/Netflix/Hystrix/wiki |
| Polly (.NET) | https://github.com/App-vNext/Polly |
| Polly v8 Docs | https://www.pollydocs.org/ |
| Sentinel (Alibaba) | https://github.com/alibaba/Sentinel |
| Sentinel 문서 | https://sentinelguard.io/en-us/ |
| Istio | https://istio.io/latest/docs/ |
| Envoy | https://www.envoyproxy.io/docs/ |
| Dapr | https://docs.dapr.io/ |
| Failsafe-go | https://github.com/failsafe-go/failsafe-go |
| Sony Gobreaker | https://github.com/sony/gobreaker |

## 블로그 / 기술 포스트

| 제목 | 저자/출처 | URL |
|------|----------|-----|
| CircuitBreaker | Martin Fowler (2014) | https://martinfowler.com/bliki/CircuitBreaker.html |
| Making the Netflix API More Resilient | Netflix TechBlog (2011) | https://netflixtechblog.com/ |
| Exponential Backoff And Jitter | AWS Architecture Blog (2015) | https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ |
| Fault Tolerance in a High Volume, Distributed System | Netflix TechBlog (2012) | https://netflixtechblog.com/ |
| Fallacies of Distributed Computing | Peter Deutsch (1994) | https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing |

## 벤치마크 / 비교 자료

| 제목 | 출처 | 비고 |
|------|------|------|
| Resilience4j vs Hystrix 벤치마크 | Resilience4j 공식 문서 | 오버헤드 비교 |
| Istio Performance Benchmarks | Istio 공식 문서 | Sidecar 레이턴시 측정 |
| Ambient Mesh Performance | Istio Blog | Sidecar vs Ambient 비교 |
| Grafana Dashboard #21307 | Grafana Labs | Resilience4j 모니터링 |

## 학술 논문 / RFC

| 논문 | 저자 | 연도 | 비고 |
|------|------|------|------|
| The Byzantine Generals Problem | Lamport, Shostak, Pease | 1982 | 분산 합의 이론 |
| Harvest, Yield, and Scalable Tolerant Systems | Fox, Brewer | 1999 | CAP Theorem 전신 |
| IEEE 802.3 CSMA/CD | IEEE | 1983 | Exponential Backoff 공식 채택 |
| Life beyond Distributed Transactions | Pat Helland | 2007 | 분산 트랜잭션 한계 |

## 관련 프로젝트 내 문서

```
┌─────────────────────────────────────────────────────────────────┐
│                    관련 문서 링크                                 │
│                                                                 │
│  프로젝트 내 관련 문서:                                         │
│  ├── docs/backend/보상트랜잭션-saga.md                          │
│  │   └── Saga 패턴과 분산 트랜잭션 보상                         │
│  ├── docs/backend/domain-event-outbox-패턴.md                   │
│  │   └── Outbox 패턴, Eventual Consistency                      │
│  ├── docs/backend/dual-write-패턴.md                            │
│  │   └── Dual Write 문제의 상세 분석                            │
│  ├── docs/backend/kotlin-coroutine-async.md                     │
│  │   └── Kotlin Coroutine (R4j Coroutine 연동 관련)            │
│  ├── docs/cloud/istio-서비스메시.md                             │
│  │   └── Istio Service Mesh 상세                                │
│  ├── docs/cloud/destinationrule-서비스QoS.md                    │
│  │   └── Istio DestinationRule (Service Mesh CB 설정)           │
│  └── docs/backend/spring-actuator-health.md                     │
│      └── Spring Actuator (CB Health Indicator 연동)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

