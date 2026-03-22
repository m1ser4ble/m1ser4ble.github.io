---
layout: single
title: "Circuit Breaker & Resilience 패턴 완전 가이드"
date: 2026-03-22 23:00:00 +0900
categories: backend
excerpt: "Circuit Breaker와 Resilience 패턴은 분산 시스템에서 연쇄 장애를 차단하고 부분 실패를 격리해 서비스 가용성과 복구 탄력성을 높이는 설계 전략이다."
toc: true
toc_sticky: true
tags: [backend, circuitbreaker, resilience, microservices, retry, timeout]
source: "/home/dwkim/dwkim/docs/backend/circuit-breaker-resilience-패턴.md"
---
TL;DR
- Circuit Breaker & Resilience 패턴 완전 가이드의 핵심 개념을 빠르게 파악할 수 있다.
- 배경과 이유를 통해 왜 이 주제가 필요한지 맥락을 이해할 수 있다.
- 실무에서 바로 참고할 수 있도록 주요 포인트를 구조화해 정리했다.

## 1. 개념
┌─────────────────────────────────────────────────────────────────┐

## 2. 배경
해당 주제가 필요한 실무 맥락과 기존 접근의 한계를 함께 이해해야 올바른 설계 판단이 가능하다.

## 3. 이유
문제 재발을 줄이고 운영 안정성을 높이기 위해 개념뿐 아니라 적용 기준과 트레이드오프를 명확히 정리할 필요가 있다.

## 4. 특징
핵심 용어, 동작 흐름, 구현 포인트, 주의사항을 한 문서에 묶어 빠르게 참고할 수 있다.

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

## 블로그 / 기술 포스트 (추가)

| 제목 | 저자/출처 | URL |
|------|----------|-----|
| Performance Under Load | Netflix TechBlog (2018) | https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581 |
| Prioritized Load Shedding at Netflix | Netflix TechBlog | https://netflixtechblog.com/prioritized-load-shedding-in-the-overloaded-state-of-a-netflix-microservice-4b532e835f37 |
| Using Load Shedding to Survive Brownouts | AWS Architecture Blog | https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/ |

## 장애 포스트모텀

| 장애 | 연도 | 공식 포스트모텀 URL |
|------|------|---------------------|
| Amazon DynamoDB Retry Storm | 2015 | https://aws.amazon.com/message/5467D2/ |
| Cloudflare WAF Outage | 2019 | https://blog.cloudflare.com/cloudflare-outage/ |
| Google Cloud Networking Incident | 2019 | https://status.cloud.google.com/incident/cloud-networking/19009 |
| Facebook/Meta BGP Outage | 2021 | https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/ |
| AWS US-EAST-1 Outage | 2021 | https://aws.amazon.com/message/12721/ |
| GitHub MySQL Cluster Incident | 2018 | https://github.blog/2018-10-30-oct21-post-incident-analysis/ |
| Slack Transit Gateway Outage | 2021 | https://slack.engineering/slacks-outage-on-january-4th-2021/ |
| 카카오 판교 DC 화재 | 2022 | https://www.kakaocorp.com/page/detail/9812 |

## 학술 논문 / RFC

| 논문 | 저자 | 연도 | 비고 |
|------|------|------|------|
| The Byzantine Generals Problem | Lamport, Shostak, Pease | 1982 | 분산 합의 이론 |
| Harvest, Yield, and Scalable Tolerant Systems | Fox, Brewer | 1999 | CAP Theorem 전신 |
| IEEE 802.3 CSMA/CD | IEEE | 1983 | Exponential Backoff 공식 채택 |
| Life beyond Distributed Transactions | Pat Helland | 2007 | 분산 트랜잭션 한계 |
| Gray Failure: The Achilles' Heel of Cloud-Scale Systems | Huang et al. (MS Research) | 2017 | 차등 관찰 가능성 문제 |
| Making Reliable Distributed Systems in the Presence of Software Errors | Joe Armstrong | 2003 | Erlang "Let It Crash" 철학, Supervision Tree |
| The Tail at Scale | Jeff Dean, Luiz André Barroso | 2013 | Fan-out 지연 분포, Hedging 패턴 |
| Congestion Avoidance and Control | Van Jacobson | 1988 | TCP Congestion Control, AIMD, Slow Start |

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

---

# 13. 학술적/이론적 기반 심화

## 13.1 Joe Armstrong의 "Let It Crash" 철학

Joe Armstrong의 2003년 박사논문 *"Making Reliable Distributed Systems in the Presence of Software Errors"* 는 Erlang/OTP의 핵심 철학인 **"Let It Crash"** 를 정립했다. 이 철학은 **오류를 방지하려 하지 말고, 오류가 발생했을 때 빠르게 감지하고 복구하라**는 것이다. Circuit Breaker 패턴과 깊은 연관이 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Erlang Supervision Tree vs Circuit Breaker              │
│                                                                 │
│  [Erlang Supervision Tree]                                      │
│                                                                 │
│           ┌─── Supervisor (top) ───┐                            │
│           │                        │                            │
│     Supervisor A            Supervisor B                        │
│      │      │                │      │                           │
│   Worker1 Worker2        Worker3 Worker4                        │
│                                                                 │
│  Worker3 crash → Supervisor B가 재시작                          │
│  Supervisor B 반복 실패 → Supervisor (top)이 B 전체 재시작      │
│  → 장애가 격리되고, 자동 복구됨                                 │
│                                                                 │
│  [Circuit Breaker]                                              │
│                                                                 │
│  Service A ──► CB ──► Service B                                 │
│                │                                                │
│                ├── CLOSED: 정상 통과                             │
│                ├── OPEN: 빠른 실패 (장애 격리)                  │
│                └── HALF-OPEN: 복구 시도                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 비교 항목 | Erlang Supervision Tree | Circuit Breaker |
|-----------|------------------------|-----------------|
| **철학** | "Let It Crash" — 실패를 허용하고 복구 | "Fail Fast" — 실패를 감지하고 차단 |
| **장애 감지** | Process crash (link/monitor) | 오류율/지연 임계값 초과 |
| **장애 격리** | Supervision 계층 구조 | CB 인스턴스별 격리 |
| **복구 전략** | Supervisor가 자동 재시작 | Half-Open → 점진적 복구 확인 |
| **복구 범위** | 프로세스/노드 단위 | 서비스/엔드포인트 호출 단위 |
| **Escalation** | 상위 Supervisor로 전파 | 없음 (Bulkhead으로 보완) |
| **적용 레벨** | 프로세스 내부 | 서비스 간 통신 |
| **공통점** | 장애를 정상 흐름의 일부로 설계에 포함 | 장애를 정상 흐름의 일부로 설계에 포함 |

**핵심 통찰:** Erlang의 "Let It Crash"는 **프로세스 내부**의 오류 격리/복구이고, Circuit Breaker는 **서비스 간** 오류 격리/복구이다. 두 패턴 모두 **"오류는 반드시 발생한다"** 는 전제 위에 설계된다.

## 13.2 제어이론(Control Systems Theory)과 Circuit Breaker

Circuit Breaker의 상태 전이 메커니즘은 제어이론의 **Negative Feedback Loop**와 정확히 대응된다. 시스템의 출력(오류율)을 측정하고, 목표값(임계값)과 비교하여, 제어 신호(상태 전이)를 발생시킨다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Negative Feedback Loop ↔ Circuit Breaker 매핑           │
│                                                                 │
│  [제어이론 Feedback Loop]                                       │
│                                                                 │
│  Set Point ──► (+) ──► Controller ──► Actuator ──► Process     │
│                 ↑ (-)                                ↓          │
│                 └────────── Sensor ◄─────────────────┘          │
│                                                                 │
│  [Circuit Breaker 매핑]                                         │
│                                                                 │
│  오류율 임계값 ──► 비교 ──► CB 상태전이 ──► 트래픽 제어 ──► 서비스│
│      (50%)         ↑ (-)     로직                        ↓     │
│                    └────── Sliding Window ◄───────────────┘     │
│                            (오류율 측정)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 제어이론 구성요소 | Circuit Breaker 대응 | 설명 |
|-------------------|---------------------|------|
| **Set Point** (목표값) | `failureRateThreshold` (오류율 임계값) | 시스템이 유지해야 할 목표 오류율 |
| **Process Variable** (현재값) | 현재 Sliding Window 내 오류율 | 실시간 측정되는 실제 오류율 |
| **Error Signal** (오차) | 현재 오류율 - 임계값 | 임계값 초과 시 양수 → 제어 필요 |
| **Controller** (제어기) | CB 상태전이 로직 | CLOSED→OPEN→HALF-OPEN 결정 |
| **Actuator** (작동기) | 트래픽 허용/차단 | OPEN 시 요청 차단, CLOSED 시 통과 |
| **Sensor** (센서) | Sliding Window (Ring Buffer) | 호출 결과를 수집하여 오류율 계산 |
| **Plant** (제어 대상) | 대상 서비스(downstream) | 보호 대상 원격 서비스 |

### Flapping/Oscillation 문제 = 불충분한 Phase Margin

Circuit Breaker가 OPEN↔CLOSED를 빠르게 반복하는 **Flapping** 현상은 제어이론에서 **불충분한 Phase Margin**으로 인한 **Oscillation**과 동일한 문제이다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Flapping (진동) 문제와 해결                              │
│                                                                 │
│  [Flapping 발생]                                                │
│                                                                 │
│  오류율 ───╲  ╱──╲  ╱──╲  ╱──╲  ╱──                            │
│  임계값 ────╳────╳────╳────╳──── (빠른 교차)                    │
│  CB상태  OPEN CLOSED OPEN CLOSED OPEN ...                       │
│                                                                 │
│  원인: waitDurationInOpenState가 너무 짧거나,                   │
│        permittedNumberOfCallsInHalfOpenState가 너무 적음        │
│                                                                 │
│  [안정화된 상태]                                                 │
│                                                                 │
│  오류율 ───╲                    ╱───                             │
│  임계값 ────╲──────────────────╱──── (충분한 회복 시간)          │
│  CB상태  OPEN  (wait 30s)  HALF-OPEN → CLOSED                   │
│                                                                 │
│  해결: 충분한 Damping (waitDuration ↑, Half-Open 호출수 ↑)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### PID Controller의 D항과 Half-Open 상태

PID Controller에서 **Derivative(D) 항**은 오차의 변화율을 감시하여 과잉 제어를 방지한다. Circuit Breaker의 **Half-Open 상태**는 이와 유사한 역할을 한다:

| PID 요소 | CB 대응 | 역할 |
|----------|---------|------|
| **P (Proportional)** | 오류율이 임계값 초과 → OPEN | 즉각 반응 |
| **I (Integral)** | Sliding Window 누적 오류율 | 과거 누적 고려 |
| **D (Derivative)** | Half-Open에서 점진적 복구 확인 | 급격한 변화 방지, 안정적 복원 |

## 13.3 대기열 이론 심화: Erlang C Formula와 Bulkhead 크기 결정

**Little's Law** (`L = λ × W`)는 안정 상태에서만 유효하다. 실제 시스템에서 **트래픽 변동성**(버스트)을 고려하려면 **Erlang C Formula** (A.K. Erlang, 1917, M/M/c 모델)를 사용해야 한다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Erlang C Formula로 Bulkhead 크기 결정                   │
│                                                                 │
│  M/M/c 모델 (Markov arrival / Markov service / c servers)      │
│                                                                 │
│  입력:                                                          │
│  ├── λ = 도착률 (req/s)                                        │
│  ├── μ = 서비스율 (1/평균응답시간)                              │
│  ├── c = 서버(슬롯) 수                                         │
│  └── A = λ/μ (offered traffic, Erlang 단위)                    │
│                                                                 │
│  Erlang C 확률 (대기 확률):                                     │
│                                                                 │
│              (A^c / c!) × (c / (c - A))                        │
│  P_w(c) = ──────────────────────────────────                   │
│            Σ(k=0..c-1) A^k/k! + (A^c/c!) × (c/(c-A))        │
│                                                                 │
│  예시: λ=100 req/s, 평균응답=200ms → A=100×0.2=20 Erlang       │
│                                                                 │
│  │  c (슬롯수)  │ P_w (대기확률)  │ 판정              │        │
│  │──────────────│────────────────│───────────────────│        │
│  │  20          │ ~100% (불안정!) │ c = A 이면 불안정 │        │
│  │  25          │ ~36%           │ 너무 높음          │        │
│  │  30          │ ~8%            │ 수용 가능          │        │
│  │  35          │ ~1.5%          │ 권장               │        │
│  │  40          │ ~0.2%          │ 보수적 (안전)      │        │
│                                                                 │
│  결론: maxConcurrentCalls = 35 (p99 대기 확률 < 2%)            │
│  Little's Law로는 20이지만, 실제로는 35가 적절               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Little's Law의 한계:**

| 항목 | Little's Law | Erlang C |
|------|-------------|----------|
| **가정** | 안정 상태 (Steady State) | 포아송 도착 + 지수 서비스 시간 |
| **변동성 고려** | 없음 (평균만) | 확률적 변동 포함 |
| **결과** | 최소 필요 슬롯 수 | 목표 대기 확률 달성 슬롯 수 |
| **실무 적용** | 빠른 추정 | 정밀 산정 |
| **한계** | 버스트 트래픽 미고려 | M/M/c 가정 (실제와 다를 수 있음) |

**M/M/1 불안정 조건:** `λ ≥ μ` (도착률이 서비스율 이상이면 대기열이 무한 증가). 이것이 바로 **Bulkhead 없이 느린 서비스를 호출할 때 스레드 풀이 고갈되는 근본 원인**이다.

## 13.4 TCP Congestion Control과 Resilience 패턴

Van Jacobson의 1988년 논문 *"Congestion Avoidance and Control"* 은 TCP Congestion Control의 기초를 놓았다. 놀랍게도 분산 시스템 Resilience 패턴과 정확히 대응된다.

```
┌─────────────────────────────────────────────────────────────────┐
│          TCP Congestion Control ↔ Resilience 패턴 매핑           │
│                                                                 │
│  [TCP]                         [Resilience]                     │
│                                                                 │
│  Slow Start                    CB Half-Open (점진적 복구)       │
│  ┌──────────────┐              ┌──────────────┐                │
│  │ cwnd: 1→2→4  │              │ 허용: 3→5→10 │                │
│  │ 지수 증가    │              │ 점진적 증가  │                │
│  └──────────────┘              └──────────────┘                │
│                                                                 │
│  Congestion Avoidance          CB CLOSED (정상)                 │
│  ┌──────────────┐              ┌──────────────┐                │
│  │ cwnd 선형 ↑  │              │ 전체 트래픽  │                │
│  │ 안정 전송    │              │ 허용         │                │
│  └──────────────┘              └──────────────┘                │
│                                                                 │
│  Timeout/3-dup ACK             CB → OPEN 전이                   │
│  ┌──────────────┐              ┌──────────────┐                │
│  │ cwnd 급감    │              │ 트래픽 차단  │                │
│  │ (1 or 1/2)  │              │ (Fail Fast)  │                │
│  └──────────────┘              └──────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| TCP Congestion Control | Resilience 패턴 | 공통 원리 |
|------------------------|-----------------|----------|
| **AIMD** (Additive Increase, Multiplicative Decrease) | CB CLOSED(증가)/OPEN(급감) | 점진적 증가, 급격한 감소 |
| **Slow Start** | Half-Open 상태 (제한된 요청 허용) | 복구 시 점진적 트래픽 증가 |
| **RTO** (Retransmission Timeout) | `waitDurationInOpenState` | 재시도까지 대기 시간 |
| **cwnd** (Congestion Window) | `permittedNumberOfCallsInHalfOpenState` | 허용 동시 요청 수 |
| **Exponential Backoff** | Retry Exponential Backoff | 지수적 대기 시간 증가 |
| **Jitter** (TCP randomized RTO) | Retry Jitter | 동시 재시도 회피 |
| **ECN** (Explicit Congestion Notification) | Health Check / Probe | 혼잡 상태 명시적 알림 |

## 13.5 Gray Failure 논문 (Microsoft Research, 2017)

*"Gray Failure: The Achilles' Heel of Cloud-Scale Systems"* (Huang et al.)는 시스템이 **완전히 정상도, 완전히 장애도 아닌 "회색 영역"** 에 빠지는 현상을 분석했다. 이것은 **차등 관찰 가능성(Differential Observability)** 문제이다: 관찰자에 따라 시스템 상태가 다르게 보인다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Gray Failure — Circuit Breaker의 맹점                    │
│                                                                 │
│  [Binary Failure — CB가 잘 감지]                                │
│                                                                 │
│  오류율  ┃                    ████████████                      │
│  100%   ┃                    ████████████                      │
│         ┃                    ████████████                      │
│   50%   ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ████████████ ─ ─ ─ 임계값        │
│         ┃                    ████████████                      │
│    0%   ┃████████████████████            ████████████           │
│         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 시간     │
│         CB: CLOSED           OPEN        CLOSED                │
│         → 명확한 전이, CB가 정확히 동작                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Gray Failure — CB가 감지 못함]                                │
│                                                                 │
│  오류율  ┃          (오류율은 낮음)                              │
│   50%   ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ 임계값        │
│         ┃                                                      │
│   10%   ┃          ████████████████████████                    │
│    0%   ┃██████████                        ████████             │
│         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 시간     │
│                                                                 │
│  응답시간 ┃         ████                                        │
│  5000ms  ┃        █████                                        │
│  2000ms  ┃      ████████                                       │
│   200ms  ┃█████          ████████                               │
│          ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 시간    │
│                                                                 │
│  CB: CLOSED ──────────────────────────── (OPEN 전이 안 됨!)    │
│  → 오류율은 임계값 미만이지만, 응답시간이 10x 증가!            │
│  → 사용자 경험은 심각하게 저하됨                                │
│                                                                 │
│  해결: slowCallRateThreshold + slowCallDurationThreshold 설정   │
│        Multi-dimensional health check (오류율 + 지연 + p99)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**CB의 Gray Failure 대응 전략:**

| 전략 | 구현 | 효과 |
|------|------|------|
| `slowCallRateThreshold` | 느린 호출 비율 임계값 설정 | 지연 증가 감지 |
| `slowCallDurationThreshold` | 느린 호출 기준 시간 설정 | 지연의 정의 |
| Multi-signal detection | 오류율 + 지연 + p99 복합 판단 | 차등 관찰 극복 |
| Custom health check | 애플리케이션 수준 의미론적 검사 | 비즈니스 레벨 Gray Failure 감지 |

## 13.6 TLA+를 이용한 Circuit Breaker 형식 검증

**TLA+** (Temporal Logic of Actions)를 사용하면 Circuit Breaker의 상태 전이가 **Safety Property** (나쁜 일이 발생하지 않음)와 **Liveness Property** (좋은 일이 결국 발생함)를 만족하는지 형식적으로 검증할 수 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│          TLA+ Circuit Breaker 형식 명세                           │
│                                                                 │
│  ---- MODULE CircuitBreaker ----                                │
│  EXTENDS Naturals, Sequences                                    │
│                                                                 │
│  VARIABLES                                                      │
│    state,        \* {CLOSED, OPEN, HALF_OPEN}                  │
│    failureCount, \* 0..WindowSize                               │
│    successCount, \* 0..HalfOpenPermitted                        │
│    timer         \* 0..WaitDuration                             │
│                                                                 │
│  TypeInvariant ==                                               │
│    /\ state \in {"CLOSED", "OPEN", "HALF_OPEN"}                │
│    /\ failureCount \in 0..WindowSize                            │
│    /\ successCount >= 0                                         │
│    /\ timer >= 0                                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Actions:                                                       │
│                                                                 │
│  CallSucceeds ==                                                │
│    \/ (state = "CLOSED" /\ state' = "CLOSED"                   │
│        /\ failureCount' = Max(0, failureCount - 1))            │
│    \/ (state = "HALF_OPEN" /\ successCount' = successCount + 1 │
│        /\ IF successCount + 1 >= Threshold                     │
│           THEN state' = "CLOSED" /\ failureCount' = 0          │
│           ELSE state' = "HALF_OPEN")                            │
│                                                                 │
│  CallFails ==                                                   │
│    \/ (state = "CLOSED" /\ failureCount' = failureCount + 1    │
│        /\ IF failureCount + 1 >= FailureThreshold              │
│           THEN state' = "OPEN" /\ timer' = WaitDuration        │
│           ELSE state' = "CLOSED")                               │
│    \/ (state = "HALF_OPEN" /\ state' = "OPEN"                  │
│        /\ timer' = WaitDuration)                                │
│                                                                 │
│  TimerExpires ==                                                │
│    state = "OPEN" /\ timer = 0                                  │
│    /\ state' = "HALF_OPEN"                                      │
│    /\ successCount' = 0                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Safety Properties:                                             │
│  ├── NoDirectOpenToClosed:                                      │
│  │   □(state = "OPEN" ⇒ ○(state ≠ "CLOSED"))                  │
│  │   "OPEN에서 CLOSED로 직접 전이 불가 (반드시 HALF_OPEN 경유)" │
│  ├── BoundedFailure:                                            │
│  │   □(failureCount ≤ WindowSize)                               │
│  │   "실패 카운트는 Window 크기를 초과하지 않음"                │
│  └── NoCallInOpen:                                              │
│      □(state = "OPEN" ⇒ 요청 차단)                             │
│      "OPEN 상태에서는 호출이 통과되지 않음"                     │
│                                                                 │
│  Liveness Properties:                                           │
│  ├── EventualRecovery:                                          │
│  │   □(state = "OPEN" ⇒ ◇(state = "HALF_OPEN"))               │
│  │   "OPEN 상태는 결국 HALF_OPEN으로 전이됨"                   │
│  └── EventualClose:                                             │
│      □(state = "HALF_OPEN" ∧ 서비스 정상                       │
│        ⇒ ◇(state = "CLOSED"))                                  │
│      "서비스가 복구되면 결국 CLOSED로 돌아옴"                   │
│                                                                 │
│  ====                                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 14. 최신 Resilience 패턴 심화

## 14.1 Hedging Pattern

Google의 Jeff Dean과 Luiz André Barroso가 2013년 발표한 *"The Tail at Scale"* 논문은 대규모 Fan-out 시스템에서 Tail Latency가 극적으로 증폭되는 현상을 분석하고, **Hedging** 패턴을 해결책으로 제시했다.

### Fan-out 확률론

```
┌─────────────────────────────────────────────────────────────────┐
│          Fan-out에서의 Tail Latency 증폭                         │
│                                                                 │
│  단일 서버에서 p99 지연 = 10ms일 때:                             │
│                                                                 │
│  Fan-out = 1:   P(최소 1개 느림) = 1%                           │
│  Fan-out = 10:  P(최소 1개 느림) = 1-(0.99)^10  ≈ 9.6%         │
│  Fan-out = 50:  P(최소 1개 느림) = 1-(0.99)^50  ≈ 39.5%        │
│  Fan-out = 100: P(최소 1개 느림) = 1-(0.99)^100 ≈ 63.4%        │
│                                                                 │
│  확률   ┃                                            ████      │
│  100%   ┃                                       █████████      │
│         ┃                                  ██████████████      │
│  63.4%  ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─████████████████ ─      │
│         ┃                          █████                        │
│  39.5%  ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ██████ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│         ┃                ████                                   │
│   9.6%  ┃─ ─ ─ ─ ─ ████ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│    1%   ┃████████                                               │
│         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Fan-out  │
│              1   10       50                 100                │
│                                                                 │
│  핵심: 전체 응답시간 = max(모든 Fan-out 응답) = 가장 느린 것   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Google BigTable 벤치마크

Google의 실측 결과 (Dean & Barroso, 2013):

| 지표 | Hedging 미적용 | Hedging 적용 (95th %ile 후 재전송) | 개선 |
|------|---------------|-----------------------------------|------|
| **p50** | 10ms | 10ms | 동일 |
| **p99** | 50ms | 23ms | 54% 개선 |
| **p99.9** | 1,800ms | 74ms | **96% 개선** |
| **추가 요청 비용** | - | ~2% | 매우 낮음 |

### Polly v8 Hedging 모드

```
┌─────────────────────────────────────────────────────────────────┐
│          Polly v8 Hedging 3가지 모드                             │
│                                                                 │
│  [1. Latency Hedging]                                           │
│  요청 ──► Primary ─── (P95 초과 시) ──► Hedge 1 ──► Hedge 2   │
│           │                              │             │        │
│           └──────── 가장 먼저 응답한 것 사용 ──────────┘        │
│  특징: 일정 시간 후 추가 요청 전송, 추가비용 최소              │
│                                                                 │
│  [2. Parallel Hedging]                                          │
│  요청 ──┬─► Primary ───────┐                                   │
│         ├─► Hedge 1 ───────┤─► 가장 먼저 응답한 것 사용        │
│         └─► Hedge 2 ───────┘                                   │
│  특징: 동시 전송, 비용 N배이지만 지연 최소화                   │
│                                                                 │
│  [3. Fallback Hedging]                                          │
│  요청 ──► Primary ─── (실패 시) ──► Fallback 1 ──► Fallback 2 │
│  특징: 순차적 대안 시도 (전통적 Fallback과 유사)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Retry vs Hedging 비교

| 비교 항목 | Retry | Hedging |
|-----------|-------|---------|
| **트리거** | 요청 실패 후 | 지연 임계값 초과 시 (실패 아니어도) |
| **동시 요청** | 순차적 (이전 실패 후) | 병렬 (이전 요청 진행 중에도) |
| **목표** | 일시적 오류 극복 | Tail Latency 감소 |
| **응답 사용** | 마지막 성공 응답 | 가장 빠른 응답 |
| **추가 비용** | 실패 시에만 | 항상 소량 (2~5%) |
| **적합 상황** | 간헐적 오류 | Fan-out, Tail Latency 민감 |
| **부적합 상황** | 과부하 시 (Retry Storm) | 멱등성 없는 쓰기 작업 |

## 14.2 Adaptive Concurrency Limits

Netflix가 2018년 공개한 **concurrency-limits** 라이브러리는 TCP Congestion Control의 아이디어를 직접 애플리케이션 레이어에 적용한다. **Little's Law를 런타임에 실시간 피드백 루프로 실현**한 것이다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Adaptive Concurrency Limits — 동적 용량 결정             │
│                                                                 │
│  [정적 Bulkhead 문제]                                           │
│                                                                 │
│  설정: maxConcurrentCalls = 50                                  │
│                                                                 │
│  비수기: 실제 필요 10 → 40 슬롯 낭비                           │
│  피크:  실제 필요 80 → 30 요청 불필요하게 거부                 │
│                                                                 │
│  [Adaptive Concurrency]                                         │
│                                                                 │
│  limit ──┬──► 측정: RTT (응답시간)                              │
│          │    ├── RTT_noload (최소 응답시간)                    │
│          │    └── RTT_actual (현재 응답시간)                    │
│          │                                                      │
│          ├──► 계산: new_limit = f(RTT_noload, RTT_actual)      │
│          │                                                      │
│          └──► 적용: Semaphore 크기 동적 조정                   │
│                                                                 │
│  비수기: limit 자동 감소 → 리소스 절약                         │
│  피크:  limit 자동 증가 → 처리량 극대화                        │
│  과부하: limit 급격히 감소 → 보호                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 알고리즘 비교

| 알고리즘 | TCP 기반 | 동작 방식 | 장점 | 단점 |
|----------|---------|----------|------|------|
| **VegasLimit** | TCP Vegas | RTT 증가 감지 → limit 감소 | 큐잉 지연에 민감, 사전 감지 | 안정 RTT 필요 |
| **Gradient2Limit** | - | gradient = RTT_noload / RTT_actual, limit × gradient | 노이즈에 강함, Smoothing | Cold Start 느림 |
| **AIMDLimit** | TCP Reno AIMD | 성공 시 +α, 실패/지연 시 ×β (0.5~0.9) | 단순하고 예측 가능 | 변동 큼, 최적 수렴 느림 |

### Bulkhead 정적 vs 동적 비교

| 비교 항목 | 정적 Bulkhead | Adaptive Concurrency Limits |
|-----------|-------------|---------------------------|
| **설정** | 수동 (maxConcurrentCalls 고정) | 자동 (RTT 기반 조정) |
| **변동 대응** | 없음 (고정 값) | 실시간 적응 |
| **과잉 프로비저닝** | 높음 (피크 기준 설정) | 낮음 (실시간 조정) |
| **설정 난이도** | 낮음 (숫자 하나) | 중간 (알고리즘 선택 필요) |
| **예측 가능성** | 높음 (항상 동일) | 중간 (동적 변동) |
| **적합 상황** | 트래픽 패턴 안정적 | 트래픽 변동 큰 서비스 |
| **라이브러리** | Resilience4j Bulkhead | Netflix concurrency-limits |

## 14.3 Load Shedding

**Load Shedding**은 서버가 자체 용량을 초과하는 요청을 의도적으로 거부하여 **Goodput**(유용한 처리량)을 유지하는 패턴이다. Circuit Breaker와의 핵심 차이: CB는 **클라이언트**가 장애 서비스를 보호하지만, Load Shedding은 **서버 자신**이 자신을 보호한다.

```
┌─────────────────────────────────────────────────────────────────┐
│          Load Shedding vs Circuit Breaker                        │
│                                                                 │
│  [Circuit Breaker — 클라이언트 보호]                             │
│                                                                 │
│  Client ──► CB ──✕──► Overloaded Server                        │
│              │                                                  │
│              └── "서버가 아프니까 내가 안 보낸다"                │
│                                                                 │
│  [Load Shedding — 서버 자기 보호]                               │
│                                                                 │
│  Client ──► Server ──► Load Shedder ──✕──► Processing          │
│                         │                                       │
│                         └── "내가 감당 못하니 거부한다"          │
│                                                                 │
│  [둘의 조합 — Defense in Depth]                                  │
│                                                                 │
│  Client ──► CB ──► Server ──► Load Shedder ──► Processing      │
│              │                  │                                │
│              │                  └── 서버 자체 보호 (1차 방어)    │
│              └── 클라이언트가 실패 인지 (2차 방어)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority-based Load Shedding (Netflix 우선순위 계층)

```
┌─────────────────────────────────────────────────────────────────┐
│          Netflix Priority-based Load Shedding                    │
│                                                                 │
│  우선순위 계층 (높음 → 낮음):                                    │
│                                                                 │
│  ┌─────────────────────────────────┐                            │
│  │ P0: CRITICAL                    │ 결제, 인증, 핵심 스트리밍  │
│  │ → 절대 거부하지 않음            │                            │
│  ├─────────────────────────────────┤                            │
│  │ P1: DEGRADED                    │ 추천, 개인화, 검색         │
│  │ → 과부하 시 품질 저하 허용      │                            │
│  ├─────────────────────────────────┤                            │
│  │ P2: BEST_EFFORT                 │ A/B 테스트, 분석, 로깅     │
│  │ → 과부하 시 먼저 거부           │                            │
│  ├─────────────────────────────────┤                            │
│  │ P3: BULK                        │ 배치, 프리페치, 웜업       │
│  │ → 부하 징후 시 즉시 거부        │                            │
│  └─────────────────────────────────┘                            │
│                                                                 │
│  과부하 시 동작:                                                │
│  1단계: P3 (BULK) 전체 거부                                     │
│  2단계: P2 (BEST_EFFORT) 전체 거부                              │
│  3단계: P1 (DEGRADED) 품질 저하                                 │
│  4단계: P0 (CRITICAL)만 처리 — 최후의 보루                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Goodput vs Throughput

| 지표 | 정의 | 과부하 시 |
|------|------|----------|
| **Throughput** | 단위 시간당 처리한 총 요청 수 | 증가 후 급감 (리소스 경쟁) |
| **Goodput** | 단위 시간당 성공적으로 완료된 유용한 요청 수 | Load Shedding으로 유지 가능 |

Load Shedding 없이 과부하가 발생하면, 모든 요청이 느려지며 Timeout으로 실패하여 **Goodput이 0에 수렴**할 수 있다.

### Google Borg → K8s PriorityClass 계승

Google 내부 Borg 시스템의 우선순위 개념은 Kubernetes `PriorityClass`로 계승되었다:

| Borg Priority | K8s PriorityClass | 설명 |
|---------------|-------------------|------|
| Free (0) | `system-node-critical` 외 기본 | 리소스 부족 시 가장 먼저 Eviction |
| Best-Effort (1) | BestEffort QoS | 보장 리소스 없음 |
| Production (9) | Burstable/Guaranteed QoS | 프로덕션 워크로드 |
| Monitoring (10) | `system-cluster-critical` | 모니터링/로깅 |
| Infrastructure (11) | `system-node-critical` | 인프라 필수 구성요소 |

---

# 15. 실제 대규모 장애 사례 연구

## 15.1 Amazon DynamoDB (2015) — Retry Storm

```
┌─────────────────────────────────────────────────────────────────┐
│          Amazon DynamoDB Retry Storm (2015)                      │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  DynamoDB의 metadata service에 일시적 지연 발생                 │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] Metadata Service 지연 발생                                 │
│       │                                                         │
│  [2] 수천 개의 Storage Node가 동시 Retry                        │
│       │                                                         │
│  [3] Retry 트래픽이 Metadata Service를 완전 마비시킴            │
│       │  ┌───────────────────────────────────┐                  │
│       │  │  정상 트래픽:    ████ (100 req/s) │                  │
│       │  │  + Retry 트래픽: ████████████████  │                  │
│       │  │  = 총 트래픽:    ████████████████████ (10,000 req/s) │
│       │  │  → Metadata Service 용량 초과!    │                  │
│       │  └───────────────────────────────────┘                  │
│       │                                                         │
│  [4] Metadata 불가 → 신규 테이블 생성/수정 전부 불가            │
│       │                                                         │
│  [5] 복구 시도도 Metadata Service 필요 → 복구 자체가 불가       │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Exponential Backoff + Jitter (Retry Storm 방지)            │
│  ├── Circuit Breaker (과도한 Retry 차단)                        │
│  └── Load Shedding (Metadata Service 자기 보호)                 │
│                                                                 │
│  교훈:                                                          │
│  ├── Retry는 반드시 Exponential Backoff + Jitter 필수           │
│  ├── "모든 클라이언트가 동시에 Retry" = Thundering Herd         │
│  └── 복구 경로도 장애 대상과 같은 의존성이면 복구 불가          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.2 Cloudflare (2019) — WAF 정규식 Catastrophic Backtracking

```
┌─────────────────────────────────────────────────────────────────┐
│          Cloudflare WAF Outage (2019-07-02)                      │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  WAF(Web Application Firewall) 정규식 규칙 업데이트 배포        │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 정규식에 catastrophic backtracking 패턴 포함               │
│      (?:(?:\"|'|\]|\}|\\|\d|(?:nan|infinity|true|false|...     │
│       │                                                         │
│  [2] 모든 Edge 서버 CPU 100% 고정                              │
│      ┌─────────────────────────────┐                            │
│      │ CPU ████████████████████ 100% │                          │
│      │ 하나의 HTTP 요청 처리에      │                           │
│      │ 정규식 엔진이 무한 루프 진입 │                           │
│      └─────────────────────────────┘                            │
│       │                                                         │
│  [3] 전세계 Cloudflare Edge 82%에서 트래픽 처리 불가            │
│       │                                                         │
│  [4] 27분간 전세계 고객 사이트 접근 불가                        │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Timeout (정규식 실행 시간 제한)                            │
│  ├── Bulkhead (WAF 처리를 메인 프록시에서 격리)                │
│  ├── Canary Deploy (점진적 배포로 영향 범위 최소화)            │
│  └── Circuit Breaker (CPU 임계값 초과 시 WAF 우회)             │
│                                                                 │
│  교훈:                                                          │
│  ├── 정규식은 O(2^n) 될 수 있음 — 반드시 실행 시간 제한        │
│  ├── 글로벌 동시 배포 = 최대 Blast Radius                      │
│  └── 안전장치(CPU 제한, WAF bypass) 없이 배포하면 안 됨        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.3 Google Cloud (2019) — Network Config 오류

```
┌─────────────────────────────────────────────────────────────────┐
│          Google Cloud Networking Incident (2019-06-02)            │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  네트워크 구성 변경 중 오류로 대규모 네트워크 혼잡 발생         │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 네트워크 구성 변경이 의도치 않게 광범위하게 적용           │
│       │                                                         │
│  [2] 대역폭 급감 → 네트워크 혼잡 (Congestion)                  │
│       │                                                         │
│  [3] 제어 플레인(Control Plane)도 같은 네트워크 사용            │
│      ┌─────────────────────────────────────┐                    │
│      │  Data Plane:    ████ (혼잡!)        │                    │
│      │  Control Plane: ████ (같이 혼잡!)   │                    │
│      │  → 수정 명령도 전달 불가!           │                    │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [4] 복구 도구도 같은 네트워크 의존 → 복구 도구 마비           │
│       │                                                         │
│  [5] 4시간+ 장애, GCE/GKE/Cloud SQL 등 다수 서비스 영향        │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Bulkhead (Control Plane / Data Plane 네트워크 분리)       │
│  ├── Out-of-band 관리 채널 (독립적 복구 경로)                  │
│  └── Blast Radius 제한 (점진적 구성 변경)                      │
│                                                                 │
│  교훈:                                                          │
│  ├── 제어 플레인과 데이터 플레인은 반드시 격리                  │
│  ├── 복구 도구가 장애 대상에 의존하면 복구 불가                │
│  └── 구성 변경은 Canary → 점진적 확대 필수                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.4 Facebook/Meta (2021) — BGP 자가철회

```
┌─────────────────────────────────────────────────────────────────┐
│          Facebook/Meta 대규모 장애 (2021-10-04)                  │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  유지보수 중 BGP 경로 광고(advertisement) 철회 명령 오발행      │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] BGP 설정 변경으로 모든 Facebook IP 대역 광고 철회          │
│       │                                                         │
│  [2] 전세계 ISP 라우팅 테이블에서 Facebook 경로 소멸            │
│      ┌─────────────────────────────────────┐                    │
│      │  ISP 라우팅 테이블:                 │                    │
│      │  facebook.com → 157.240.0.0/16      │                    │
│      │  (BGP withdraw) → 경로 없음!        │                    │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [3] DNS 서버도 Facebook IP 대역 → DNS 도달 불가               │
│       │                                                         │
│  [4] 내부 도구도 같은 인프라 의존 → 원격 복구 불가             │
│       │                                                         │
│  [5] 물리적으로 데이터센터 접근하여 수동 복구                   │
│       │                                                         │
│  [6] 6시간 완전 중단 (Facebook, Instagram, WhatsApp 전체)       │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Out-of-band 관리 (독립 네트워크 경로)                     │
│  ├── Blast Radius 제한 (점진적 BGP 변경)                       │
│  ├── 자동 롤백 (이상 감지 시 즉시 복원)                        │
│  └── Bulkhead (DNS/관리도구를 별도 네트워크로 격리)            │
│                                                                 │
│  교훈:                                                          │
│  ├── 네트워크 인프라 변경은 최고 수준의 안전장치 필요           │
│  ├── "자기 자신을 접근하는 데 자기 자신이 필요" = SPOF          │
│  └── 물리적 접근 복구 계획(Break Glass) 반드시 준비            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.5 AWS US-EAST-1 (2021) — Latent Backoff 버그

```
┌─────────────────────────────────────────────────────────────────┐
│          AWS US-EAST-1 장애 (2021-12-07)                         │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  내부 네트워크 자동화 시스템의 트래픽 증가가 연쇄 장애 유발     │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 내부 네트워크 디바이스에 과도한 연결 요청                  │
│       │                                                         │
│  [2] 네트워크 디바이스 과부하 → 지연 증가                       │
│       │                                                         │
│  [3] 클라이언트의 Retry 로직에 Backoff 버그 존재               │
│      ┌─────────────────────────────────────┐                    │
│      │  정상 Backoff: 1s → 2s → 4s → 8s   │                    │
│      │  버그 Backoff: 1s → 1s → 1s → 1s   │ ← Latent Bug!     │
│      │  → Backoff이 실제로 동작하지 않음   │                    │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [4] Retry Storm 자가강화                                       │
│      부하 ↑ → 실패 ↑ → Retry ↑ → 부하 ↑↑ (양의 피드백)        │
│       │                                                         │
│  [5] Lambda, API Gateway, CloudWatch 등 다수 서비스 영향        │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Exponential Backoff + Jitter (버그 없는 구현 필수)         │
│  ├── Circuit Breaker (무한 Retry 차단)                          │
│  ├── Load Shedding (네트워크 디바이스 자기 보호)               │
│  └── Chaos Engineering (Latent Bug 사전 발견)                   │
│                                                                 │
│  교훈:                                                          │
│  ├── Backoff 로직은 반드시 테스트 (Latent Bug 주의!)            │
│  ├── Retry는 "일반 경로"에서만 동작 확인하면 부족              │
│  └── 장애 시에만 활성화되는 코드 경로 = 가장 위험             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.6 GitHub (2018) — 43초 네트워크 파티션

```
┌─────────────────────────────────────────────────────────────────┐
│          GitHub MySQL Cluster Incident (2018-10-21)              │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  US East Coast 데이터센터 간 43초 네트워크 파티션 발생           │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 43초간 네트워크 파티션 (물리적 연결 순단)                  │
│       │                                                         │
│  [2] MySQL Orchestrator가 자동 Failover 실행                    │
│      ┌─────────────────────────────────────┐                    │
│      │  Primary (DC1) ──✕── Replica (DC2)  │                    │
│      │                                      │                   │
│      │  Orchestrator: "Primary 죽었다!"     │                   │
│      │  → Replica를 새 Primary로 승격       │                   │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [3] 네트워크 복구 → 양쪽 DC 모두 Primary (Split Brain!)       │
│      ┌──────────────┐    ┌──────────────┐                      │
│      │ DC1: Primary  │    │ DC2: Primary  │                     │
│      │ (원래 Primary)│    │ (승격된 것)   │                     │
│      │ 쓰기 진행 중  │    │ 쓰기 진행 중  │                     │
│      └──────────────┘    └──────────────┘                      │
│       │                                                         │
│  [4] 데이터 불일치 → 24시간+ 데이터 정합성 복구 작업            │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Fencing Token (Split Brain 방지)                           │
│  ├── Bulkhead (DC간 격리와 일관성 전략)                        │
│  ├── Consensus (Raft/Paxos 기반 리더 선출)                     │
│  └── Manual Failover (자동 Failover 위험 인지)                 │
│                                                                 │
│  교훈:                                                          │
│  ├── 43초면 충분히 Split Brain 발생 가능                        │
│  ├── 자동 Failover는 양날의 검 (빠르지만 위험)                │
│  └── 데이터 일관성 복구는 서비스 복구보다 훨씬 오래 걸림      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.7 Slack (2021) — Transit Gateway 포화

```
┌─────────────────────────────────────────────────────────────────┐
│          Slack Transit Gateway Outage (2021-01-04)               │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  새해 첫 출근일, 급격한 트래픽 증가로 Transit Gateway 포화      │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 새해 첫 출근 → 동시 접속 급증 (예상의 2~3배)              │
│       │                                                         │
│  [2] AWS Transit Gateway 대역폭 한계 도달                       │
│       │                                                         │
│  [3] Autoscaler가 더 많은 인스턴스 추가                         │
│      ┌─────────────────────────────────────┐                    │
│      │  Autoscaler: "트래픽 많다 → 스케일업!"│                  │
│      │  → 새 인스턴스가 Transit Gateway에    │                  │
│      │    추가 연결 생성 → 대역폭 더 소모!  │                  │
│      │  → 역효과: 상황 악화!                │                  │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [4] Transit Gateway 완전 포화 → 모니터링 트래픽도 차단        │
│       │                                                         │
│  [5] 모니터링 블라인드 → 장애 원인 파악 지연                    │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Rate Limiter (Transit Gateway 보호)                        │
│  ├── Bulkhead (관리/모니터링 트래픽 대역폭 예약)               │
│  ├── Load Shedding (Autoscaler 과잉 반응 억제)                 │
│  └── Capacity Planning (이벤트 기반 사전 스케일링)             │
│                                                                 │
│  교훈:                                                          │
│  ├── Autoscaler가 장애를 악화시킬 수 있음 (양의 피드백)        │
│  ├── 모니터링 경로는 데이터 경로와 반드시 분리                  │
│  └── 네트워크 대역폭도 Bulkhead 대상 (예약 필수)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.8 카카오 (2022) — 판교 DC 화재

```
┌─────────────────────────────────────────────────────────────────┐
│          카카오 판교 DC 화재 (2022-10-15)                        │
│                                                                 │
│  무엇이 발생했는가:                                             │
│  SK C&C 판교 데이터센터 지하 전기실 화재                        │
│                                                                 │
│  연쇄 장애 메커니즘:                                            │
│                                                                 │
│  [1] 판교 DC 지하 전기실 리튬 배터리 화재                       │
│       │                                                         │
│  [2] 화재 진압을 위해 전체 DC 전원 차단                         │
│       │                                                         │
│  [3] Failover 시스템도 같은 DC에 위치                           │
│      ┌─────────────────────────────────────┐                    │
│      │  판교 DC:                            │                   │
│      │  ├── 카카오톡 서버       (화재!)     │                   │
│      │  ├── 카카오맵 서버       (화재!)     │                   │
│      │  ├── 카카오페이 서버     (화재!)     │                   │
│      │  ├── Failover 시스템     (화재!)     │ ← SPOF!          │
│      │  └── DR 제어 시스템      (화재!)     │ ← SPOF!          │
│      └─────────────────────────────────────┘                    │
│       │                                                         │
│  [4] DR(Disaster Recovery) 제어 시스템도 마비 → 자동 절체 불가  │
│       │                                                         │
│  [5] 5일간 부분/전체 장애 (카카오톡, 카카오맵, 카카오페이 등)  │
│                                                                 │
│  관련 Resilience 패턴:                                          │
│  ├── Multi-Region (지리적으로 분산된 Active-Active)             │
│  ├── Bulkhead (DC 수준 격리)                                   │
│  ├── Failover 독립성 (Failover 시스템은 별도 위치)             │
│  └── Out-of-band 관리 (독립적 DR 제어 채널)                    │
│                                                                 │
│  교훈:                                                          │
│  ├── "Failover 시스템 자체가 SPOF" = 가장 치명적인 설계 결함   │
│  ├── 단일 DC에 모든 서비스 집중 = 물리적 Bulkhead 부재         │
│  └── DR 훈련(GameDay)을 정기적으로 실시해야 실제 작동 확인 가능│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 15.9 장애 사례 교차 분석

| 사례 | 근본 원인 유형 | Retry Storm | 복구도구 마비 | Blast Radius | 장애 시간 |
|------|---------------|-------------|-------------|-------------|----------|
| **DynamoDB 2015** | 내부 Retry 폭주 | ★★★ | ★★☆ | 리전 내 | 수 시간 |
| **Cloudflare 2019** | 정규식 CPU 폭발 | - | ★☆☆ | 전세계 82% | 27분 |
| **Google Cloud 2019** | 네트워크 구성 오류 | ★☆☆ | ★★★ | 리전 | 4시간+ |
| **Facebook 2021** | BGP 구성 오류 | - | ★★★ | 전세계 100% | 6시간 |
| **AWS 2021** | Latent Backoff 버그 | ★★★ | ★★☆ | US-EAST-1 | 수 시간 |
| **GitHub 2018** | 네트워크 파티션 | - | ★☆☆ | 글로벌 (데이터) | 24시간+ |
| **Slack 2021** | Transit GW 포화 | - | ★★☆ | 전체 서비스 | 수 시간 |
| **카카오 2022** | 물리적 DC 장애 | - | ★★★ | 전체 서비스 | 5일 |

**교차 분석에서 도출된 핵심 패턴:**

| 반복되는 패턴 | 발생 사례 | 방지 전략 |
|-------------|----------|----------|
| **복구 도구가 장애 대상에 의존** | Google, Facebook, 카카오 | Out-of-band 관리, 독립 복구 경로 |
| **Retry Storm / 양의 피드백** | DynamoDB, AWS | Exponential Backoff + Jitter + CB |
| **글로벌 동시 배포** | Cloudflare | Canary → 점진적 확대 |
| **자동화의 역효과** | Slack (Autoscaler), GitHub (Orchestrator) | 안전장치 내장, Manual override |
| **단일 DC = SPOF** | 카카오 | Multi-Region Active-Active |

---

# 16. Chaos Engineering 도구 생태계

## 16.1 Chaos Engineering의 진화

```
┌─────────────────────────────────────────────────────────────────┐
│          Chaos Engineering 진화 타임라인                          │
│                                                                 │
│  2010   Netflix Chaos Monkey 내부 개발                          │
│         │  "랜덤하게 프로덕션 인스턴스를 종료"                  │
│         │                                                       │
│  2011   Chaos Monkey 오픈소스 공개                              │
│         │                                                       │
│  2012   Simian Army 확장                                        │
│         │  ├── Chaos Monkey: 인스턴스 종료                     │
│         │  ├── Latency Monkey: 네트워크 지연 주입              │
│         │  ├── Chaos Gorilla: 전체 AZ 장애 시뮬레이션          │
│         │  ├── Chaos Kong: 전체 Region 장애 시뮬레이션         │
│         │  ├── Janitor Monkey: 미사용 리소스 정리              │
│         │  └── Conformity Monkey: 베스트 프랙티스 준수 검사    │
│         │                                                       │
│  2014   Failure Injection Testing (FIT) — Netflix               │
│         │  → 세밀한 장애 주입, Blast Radius 제어               │
│         │                                                       │
│  2015   Jesse Robbins, "GameDay" 개념 대중화                    │
│         │                                                       │
│  2017   "Chaos Engineering" 서적 출간 (Casey Rosenthal 외)      │
│         │  principlesofchaos.org 공식 원칙 발표                 │
│         │                                                       │
│  2018   Gremlin 상용 서비스 출시                                │
│         │  LitmusChaos 프로젝트 시작                            │
│         │                                                       │
│  2019   Chaos Mesh 공개 (PingCAP/CNCF)                          │
│         │                                                       │
│  2020   AWS Fault Injection Simulator (FIS) 발표                │
│         │  LitmusChaos → CNCF Sandbox                           │
│         │                                                       │
│  2021   Chaos Mesh → CNCF Incubating                            │
│         │  Azure Chaos Studio 발표                               │
│         │                                                       │
│  현재   Chaos Engineering이 SRE 표준 프랙티스로 정착            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 16.2 Chaos Engineering 5대 원칙

(출처: principlesofchaos.org)

```
┌─────────────────────────────────────────────────────────────────┐
│          Chaos Engineering 5대 원칙                               │
│                                                                 │
│  [1] Steady State 가설 수립                                     │
│      "정상 상태"를 정량적으로 정의 (예: p99 < 200ms, 오류 < 1%)│
│      → 실험 전후로 이 지표가 유지되는지 확인                    │
│                                                                 │
│  [2] 실세계 이벤트를 반영                                       │
│      서버 종료, 네트워크 파티션, 디스크 꽉 참, 시계 드리프트    │
│      → "실제로 발생 가능한" 장애를 주입                         │
│                                                                 │
│  [3] 프로덕션에서 실험                                          │
│      스테이징 환경은 프로덕션과 다름 — 가능하면 프로덕션에서    │
│      → Blast Radius를 제한하여 안전하게                         │
│                                                                 │
│  [4] 자동화하여 지속적으로 실행                                 │
│      수동 실험은 확장 불가 — CI/CD 파이프라인에 통합            │
│      → 회귀 방지: 어제 견뎠던 장애를 오늘도 견디는지 확인      │
│                                                                 │
│  [5] Blast Radius 최소화                                        │
│      실험이 실제 장애가 되지 않도록 범위 제한                   │
│      → 소수 사용자/트래픽부터 시작, 이상 감지 시 즉시 중단     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 16.3 Steady-State Hypothesis

```
┌─────────────────────────────────────────────────────────────────┐
│          Steady-State Hypothesis 예시                             │
│                                                                 │
│  가설: "Payment Service 인스턴스 1개가 종료되어도              │
│         p99 응답시간 < 500ms, 오류율 < 0.1% 유지"               │
│                                                                 │
│  실험 흐름:                                                     │
│                                                                 │
│  [1] Steady State 확인                                          │
│      ├── p99 응답시간: 180ms ✅ (< 500ms)                      │
│      ├── 오류율: 0.02% ✅ (< 0.1%)                             │
│      └── TPS: 500 req/s ✅ (안정)                              │
│                                                                 │
│  [2] 장애 주입                                                  │
│      └── Payment Service Pod 1개 강제 종료 (kubectl delete pod) │
│                                                                 │
│  [3] Steady State 재확인 (2분 후)                               │
│      ├── p99 응답시간: 220ms ✅ (< 500ms, 약간 증가)          │
│      ├── 오류율: 0.05% ✅ (< 0.1%, 약간 증가)                 │
│      └── TPS: 495 req/s ✅ (거의 유지)                         │
│                                                                 │
│  [4] 판정                                                       │
│      └── ✅ 가설 성립 — 시스템이 단일 인스턴스 장애에 복원됨    │
│                                                                 │
│  만약 p99 > 500ms 또는 오류율 > 0.1% 이면:                     │
│  └── ✗ 가설 기각 — Resilience 개선 필요 (CB, Retry, HPA 등)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 16.4 도구 비교

| 비교 항목 | Chaos Mesh | LitmusChaos | Gremlin | AWS FIS |
|-----------|-----------|-------------|---------|---------|
| **유형** | 오픈소스 (CNCF Incubating) | 오픈소스 (CNCF Incubating) | 상용 (SaaS) | 클라우드 서비스 (AWS) |
| **플랫폼** | Kubernetes 전용 | Kubernetes + VM | K8s, VM, 컨테이너, 서버리스 | AWS 서비스 전체 |
| **장애 유형** | Pod, Network, IO, Stress, Time, DNS, JVM, HTTP | Pod, Node, Network, IO, Stress, 커스텀 | 프로세스, 네트워크, 리소스, 상태, 커스텀 | EC2, ECS, EKS, RDS, Network, S3 |
| **UI/Dashboard** | 웹 대시보드 | 웹 포탈 (ChaosCenter) | 웹 콘솔 | AWS 콘솔 |
| **자동 중단** | 있음 (Duration 기반) | 있음 (Probe 기반) | 있음 (Halt 조건) | 있음 (Stop 조건) |
| **CI/CD 통합** | GitHub Actions, Argo | GitHub Actions, GitLab CI | API 기반 | CloudFormation, API |
| **비용** | 무료 | 무료 | 유료 (팀당 과금) | 사용량 기반 과금 |
| **설치 난이도** | 낮음 (Helm) | 중간 (Operator) | 낮음 (에이전트) | 없음 (관리형) |
| **성숙도** | 높음 | 중간 | 높음 | 높음 |
| **적합 환경** | K8s 네이티브 | K8s + 하이브리드 | 멀티 환경 | AWS 전용 |

## 16.5 GameDay 운영 방법론

```
┌─────────────────────────────────────────────────────────────────┐
│          GameDay 운영 6단계                                      │
│                                                                 │
│  [1단계] 계획 (1~2주 전)                                        │
│  ├── 실험 목표 정의 (Steady-State Hypothesis)                  │
│  ├── 범위 결정 (어떤 서비스, 어떤 장애)                        │
│  ├── Blast Radius 제한 (영향 받는 사용자 비율)                 │
│  ├── 롤백 계획 수립                                            │
│  └── 참여 팀 조율 (SRE, 개발팀, 경영진 승인)                  │
│                                                                 │
│  [2단계] 준비 (실험 당일 전)                                    │
│  ├── 모니터링 대시보드 준비 (Grafana, PagerDuty)               │
│  ├── 장애 주입 도구 설정 (Chaos Mesh, Gremlin 등)              │
│  ├── 커뮤니케이션 채널 준비 (전용 Slack 채널)                  │
│  └── 참여자 역할 배정 (진행자, 관찰자, 기록자)                │
│                                                                 │
│  [3단계] Steady State 확인 (실험 직전)                          │
│  ├── 기준 메트릭 기록 (TPS, p99, 오류율, CPU, 메모리)          │
│  ├── 알람 상태 확인 (기존 알람 없는지)                         │
│  └── "시작합니다" 공지                                         │
│                                                                 │
│  [4단계] 실험 실행                                              │
│  ├── 장애 주입 실행                                            │
│  ├── 실시간 모니터링 (대시보드 관찰)                           │
│  ├── 이상 감지 시 즉시 중단 가능 상태 유지                     │
│  └── 타임라인 기록 (t+0, t+30s, t+60s... 상태 변화)           │
│                                                                 │
│  [5단계] 관찰 및 복구                                           │
│  ├── 장애 주입 종료                                            │
│  ├── 시스템 자동 복구 관찰 (복구 시간 측정)                    │
│  ├── Steady State 재확인                                       │
│  └── 이상 있으면 수동 복구                                     │
│                                                                 │
│  [6단계] 분석 및 개선 (실험 후 1~2일)                           │
│  ├── 결과 문서화 (가설 성립/기각)                              │
│  ├── 발견된 약점 분류 (Critical/High/Medium/Low)               │
│  ├── 개선 Action Item 생성 (JIRA 티켓)                         │
│  └── 다음 GameDay 계획 (개선 후 재검증)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 17. Cloud-Native Resilience 통합

## 17.1 Kubernetes Probes + Circuit Breaker 상호작용

```
┌─────────────────────────────────────────────────────────────────┐
│          K8s Probes + CB 상호작용 주의사항                        │
│                                                                 │
│  [문제: registerHealthIndicator=true의 위험]                    │
│                                                                 │
│  Spring Boot Actuator Health:                                   │
│  ├── /actuator/health ← K8s Liveness Probe 연결               │
│  ├── CircuitBreaker Health Indicator 등록됨                     │
│  └── CB OPEN → Health Status DOWN                               │
│                                                                 │
│  연쇄 문제:                                                     │
│  CB OPEN                                                        │
│  → /actuator/health = DOWN                                      │
│  → K8s Liveness Probe 실패                                     │
│  → K8s가 Pod 재시작 (!)                                        │
│  → 재시작된 Pod도 같은 서비스 호출 → CB OPEN → 재시작 반복     │
│  → Restart Loop!                                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [권장 설정]                                                     │
│                                                                 │
│  # application.yml                                              │
│  resilience4j:                                                  │
│    circuitbreaker:                                              │
│      instances:                                                 │
│        paymentService:                                          │
│          registerHealthIndicator: false  # ← 핵심!             │
│                                                                 │
│  이유: CB OPEN은 "이 Pod가 아프다"가 아니라                     │
│        "downstream 서비스가 아프다"이다.                        │
│        Pod를 재시작해도 downstream은 안 고쳐진다!              │
│                                                                 │
│  대안: Readiness Probe에만 연결하거나,                          │
│        커스텀 Health Indicator로 로컬 상태만 반영              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.2 PodDisruptionBudget + Bulkhead 계층 관계

```
┌─────────────────────────────────────────────────────────────────┐
│          PDB + Bulkhead 계층적 보호                               │
│                                                                 │
│  [애플리케이션 레벨 — Bulkhead]                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ Pod 내부:                            │                       │
│  │ ├── Semaphore Bulkhead (서비스별)   │                       │
│  │ │   ├── paymentPool: max=50         │                       │
│  │ │   └── inventoryPool: max=30       │                       │
│  │ └── 기능별 리소스 격리               │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  [K8s 레벨 — PodDisruptionBudget]                               │
│  ┌──────────────────────────────────────┐                       │
│  │ Deployment 수준:                     │                       │
│  │ ├── minAvailable: 2                  │ (또는 maxUnavailable) │
│  │ ├── Node drain 시에도 최소 2 Pod 유지│                       │
│  │ └── Rolling Update 시 가용성 보장    │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  [인프라 레벨 — Node/AZ 분산]                                   │
│  ┌──────────────────────────────────────┐                       │
│  │ 클러스터 수준:                       │                       │
│  │ ├── Pod Topology Spread Constraints  │                       │
│  │ │   → AZ별 균등 배치                 │                       │
│  │ ├── Node Affinity / Anti-Affinity    │                       │
│  │ │   → 같은 서비스 Pod 분산           │                       │
│  │ └── AZ 하나 장애 → 다른 AZ에서 처리 │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  계층 관계:                                                     │
│  인프라 Bulkhead (AZ 분산)                                      │
│    └── K8s Bulkhead (PDB, Pod 수 보장)                          │
│         └── App Bulkhead (Semaphore, 기능별 격리)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.3 HPA + Rate Limiter 보완 관계

| 상황 | HPA (Horizontal Pod Autoscaler) | Rate Limiter | 보완 효과 |
|------|-------------------------------|-------------|----------|
| 트래픽 점진적 증가 | Pod 추가 (스케일 아웃) | 불필요 (HPA가 처리) | HPA 단독 충분 |
| 트래픽 급증 (spike) | 스케일업 지연 (수분) | 즉시 초과 요청 거부 | Rate Limiter가 HPA 스케일업 시간 벌어줌 |
| 악의적 트래픽 (DDoS) | 무한 스케일업 (비용 폭발) | 요청 수 제한 | Rate Limiter가 비용 보호 |
| 과부하 상태 | Pod 추가해도 DB 병목 | 서비스 보호 | Rate Limiter가 DB 보호 |

```
┌─────────────────────────────────────────────────────────────────┐
│          HPA + Rate Limiter 협력                                 │
│                                                                 │
│  트래픽 ────► Rate Limiter ────► Service ────► HPA 감시        │
│               │                    │              │             │
│               │ 초과 거부          │ 처리          │ CPU > 70%  │
│               │ (즉시 보호)        │              ▼             │
│               │                    │         Pod 추가           │
│               │                    │         (1~3분 소요)       │
│               │                    │              │             │
│               │                    ◄──────────────┘             │
│               │                    더 많은 Pod으로              │
│               │                    처리 가능 용량 ↑             │
│               │                                                │
│               └── Rate Limit을 동적으로 조정 가능              │
│                   (Pod 수 증가 → limit 상향)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.4 Pod Topology Spread = 인프라 레벨 Bulkhead

```
┌─────────────────────────────────────────────────────────────────┐
│          Pod Topology Spread Constraints                         │
│                                                                 │
│  # K8s Deployment YAML                                          │
│  topologySpreadConstraints:                                     │
│  - maxSkew: 1                                                   │
│    topologyKey: topology.kubernetes.io/zone                     │
│    whenUnsatisfiable: DoNotSchedule                             │
│    labelSelector:                                               │
│      matchLabels:                                               │
│        app: payment-service                                     │
│                                                                 │
│  결과:                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │   AZ-a       │ │   AZ-b       │ │   AZ-c       │           │
│  │ payment (2)  │ │ payment (2)  │ │ payment (2)  │           │
│  │ order   (1)  │ │ order   (1)  │ │ order   (1)  │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│   AZ-a 장애 시:    AZ-b (정상)      AZ-c (정상)               │
│   → 전체 6 Pod 중 4 Pod 생존 = 67% 용량 유지                  │
│                                                                 │
│  이것이 인프라 레벨 Bulkhead:                                   │
│  "물리적 격벽으로 장애 영향 범위를 AZ 단위로 격리"             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.5 OpenTelemetry 연동

### Micrometer → OTel Bridge

```
┌─────────────────────────────────────────────────────────────────┐
│          Resilience4j → OpenTelemetry 연동                       │
│                                                                 │
│  [Metrics]                                                      │
│  Resilience4j ──► Micrometer ──► OTel Metrics Bridge ──► OTLP  │
│                                                                 │
│  # application.yml                                              │
│  management:                                                    │
│    otlp:                                                        │
│      metrics:                                                   │
│        export:                                                  │
│          url: http://otel-collector:4318/v1/metrics             │
│                                                                 │
│  주요 메트릭:                                                   │
│  ├── resilience4j_circuitbreaker_state (0/1/2)                 │
│  ├── resilience4j_circuitbreaker_failure_rate                  │
│  ├── resilience4j_circuitbreaker_calls_seconds (histogram)     │
│  └── resilience4j_circuitbreaker_not_permitted_calls_total     │
│                                                                 │
│  [Traces — CB 상태 변화를 Span Event로]                         │
│                                                                 │
│  // Kotlin/Java 코드                                            │
│  circuitBreaker.eventPublisher                                  │
│      .onStateTransition { event ->                              │
│          val span = Span.current()                              │
│          span.addEvent("circuit-breaker-state-change",          │
│              Attributes.of(                                     │
│                  stringKey("cb.name"), event.circuitBreakerName,│
│                  stringKey("cb.from"), event.stateTransition    │
│                      .fromState.name,                           │
│                  stringKey("cb.to"), event.stateTransition      │
│                      .toState.name                              │
│              ))                                                 │
│      }                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Metrics-Traces-Logs 삼각 연동

```
┌─────────────────────────────────────────────────────────────────┐
│          Observability 삼각 연동                                  │
│                                                                 │
│              ┌───────────┐                                      │
│              │  Metrics   │                                      │
│              │ (Prometheus│                                      │
│              │  /Grafana) │                                      │
│              └─────┬─────┘                                      │
│                    │ Exemplar (traceId 포함)                    │
│                    │                                            │
│  ┌─────────┐      │      ┌─────────┐                           │
│  │  Logs    │◄─────┼─────►│ Traces  │                           │
│  │ (Loki/  │  traceId    │ (Tempo/ │                           │
│  │  ELK)   │  연결       │  Jaeger)│                           │
│  └─────────┘             └─────────┘                           │
│                                                                 │
│  흐름 예시:                                                     │
│  1. Grafana 대시보드에서 CB failure_rate 급증 감지 (Metrics)    │
│  2. Exemplar 링크 클릭 → 해당 시점의 Trace 확인 (Traces)       │
│  3. Trace의 spanId로 상세 로그 검색 (Logs)                     │
│  4. 로그에서 근본 원인 확인 (예: DB connection timeout)         │
│                                                                 │
│  CB 상태별 연동:                                                │
│  ├── CB OPEN 전이 → Alert (Metrics) + Span Event (Traces)     │
│  │                   + WARN 로그 (Logs)                        │
│  ├── CB HALF-OPEN  → Span Event + INFO 로그                   │
│  └── CB CLOSED 복구 → Alert Resolved + Span Event + INFO 로그 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.6 Testing: WireMock, Toxiproxy, CI/CD Chaos 통합

| 도구 | 용도 | 테스트 레벨 | 시뮬레이션 대상 |
|------|------|-----------|---------------|
| **WireMock** | HTTP API 목(mock) + 지연/오류 주입 | 단위/통합 테스트 | HTTP 응답 코드, 지연, 타임아웃 |
| **Toxiproxy** | TCP 레벨 네트워크 장애 주입 | 통합/E2E 테스트 | 지연, 대역폭 제한, 연결 끊김, 패킷 손실 |
| **Chaos Mesh** | K8s Pod/Network/IO 장애 주입 | E2E/프로덕션 | Pod kill, 네트워크 파티션, IO 지연 |
| **Testcontainers** | 테스트용 컨테이너 관리 | 통합 테스트 | 실제 DB, Redis, Kafka 등 |

```
┌─────────────────────────────────────────────────────────────────┐
│          CI/CD 파이프라인 Chaos 통합                              │
│                                                                 │
│  ┌──────┐   ┌──────┐   ┌──────────┐   ┌──────────┐   ┌─────┐ │
│  │Build │──►│Unit  │──►│Integration│──►│Chaos     │──►│Deploy│ │
│  │      │   │Test  │   │Test      │   │Test      │   │     │ │
│  └──────┘   └──────┘   └──────────┘   └──────────┘   └─────┘ │
│                          WireMock       Toxiproxy              │
│                          Testcontainers Chaos Mesh             │
│                                                                 │
│  Integration Test (WireMock):                                   │
│  ├── Downstream 500 응답 주입 → CB OPEN 전이 확인              │
│  ├── 지연 주입 → Timeout + slowCall 동작 확인                  │
│  └── 정상 복구 → CB CLOSED 복귀 확인                           │
│                                                                 │
│  Chaos Test (Toxiproxy/Chaos Mesh):                             │
│  ├── 네트워크 파티션 → Fallback 동작 확인                      │
│  ├── 네트워크 지연 주입 → Bulkhead 격리 확인                   │
│  └── Pod 종료 → 서비스 가용성 유지 확인                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.7 Dynamic Config: Spring Cloud Config + Feature Flags

```
┌─────────────────────────────────────────────────────────────────┐
│          동적 구성 관리                                           │
│                                                                 │
│  [Spring Cloud Config + Refresh]                                │
│                                                                 │
│  Config Server ──► Git Repo (resilience4j 설정)                │
│       │                                                         │
│       ▼                                                         │
│  Service Pod ──► @RefreshScope + /actuator/refresh              │
│       │                                                         │
│       └── CB 설정 변경이 재배포 없이 반영                       │
│           (failureRateThreshold, waitDuration 등)               │
│                                                                 │
│  [Feature Flags + CB 연동]                                      │
│                                                                 │
│  Feature Flag ──► "new-payment-provider" = true                │
│       │                                                         │
│       ▼                                                         │
│  if (featureFlag.isEnabled("new-payment-provider")) {          │
│      // 새 결제 제공자 (자체 CB 인스턴스)                       │
│      newPaymentCB.executeSupplier { newProvider.pay() }        │
│  } else {                                                       │
│      // 기존 결제 제공자                                        │
│      legacyPaymentCB.executeSupplier { legacyProvider.pay() }  │
│  }                                                              │
│                                                                 │
│  [etcd / Consul Watch — K8s 환경]                               │
│                                                                 │
│  etcd ──► ConfigMap 변경 감지 ──► Pod 환경변수 갱신            │
│           (watch 메커니즘)        또는 Volume 재마운트          │
│                                                                 │
│  장점: 장애 발생 시 실시간으로 CB 설정 조정 가능               │
│  예: waitDurationInOpenState: 30s → 60s (복구 시간 확보)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.8 Multi-Region Resilience

### DNS Failover vs Application CB

| 비교 | DNS Failover | Application CB |
|------|-------------|---------------|
| **감지 속도** | 느림 (DNS TTL, 30s~300s) | 빠름 (밀리초~초) |
| **세밀도** | 서비스 전체 단위 | 엔드포인트/메서드 단위 |
| **Failover 대상** | 다른 Region 서비스 | Fallback 로직, 캐시, 기본값 |
| **비용** | 높음 (Multi-Region 인프라) | 낮음 (코드 레벨) |
| **적합 상황** | Region 전체 장애 | 서비스/엔드포인트 장애 |

### Cell-based Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│          Cell-based Architecture — 궁극의 Bulkhead               │
│                                                                 │
│  [기존 Multi-Region]                                            │
│  Region A (Active) ◄─── DNS ───► Region B (Standby)           │
│  전체 트래픽 처리        장애 시 전환                           │
│  문제: Region 전환 = 전체 영향, 부분 장애 대응 불가            │
│                                                                 │
│  [Cell-based Architecture]                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Cell 1 │ │ Cell 2 │ │ Cell 3 │ │ Cell 4 │ │ Cell 5 │      │
│  │ 사용자  │ │ 사용자  │ │ 사용자  │ │ 사용자  │ │ 사용자  │      │
│  │ A~F    │ │ G~L    │ │ M~R    │ │ S~X    │ │ Y~Z    │      │
│  │ 독립DB │ │ 독립DB │ │ 독립DB │ │ 독립DB │ │ 독립DB │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                 │
│  Cell 3 장애 → 사용자 M~R만 영향                               │
│  → Cell 3 사용자를 다른 Cell로 재매핑                          │
│  → 전체의 20%만 영향, 80%는 무관                               │
│                                                                 │
│  핵심: 각 Cell은 완전히 독립된 "미니 시스템"                   │
│  → Blast Radius = 1/N (N = Cell 수)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 17.9 Global Rate Limiting: Bucket4j + Redis

```
┌─────────────────────────────────────────────────────────────────┐
│          분산 Rate Limiting — Bucket4j + Redis                   │
│                                                                 │
│  [문제: 인스턴스별 Rate Limiter]                                │
│                                                                 │
│  Pod 1: limit=100 ──┐                                          │
│  Pod 2: limit=100 ──┤── 총 허용 = 100 × N (인스턴스 수 비례)  │
│  Pod 3: limit=100 ──┘    → 스케일 아웃 시 전체 limit 증가!    │
│                                                                 │
│  [해결: Redis 기반 분산 Rate Limiter]                           │
│                                                                 │
│  Pod 1 ──┐                                                     │
│  Pod 2 ──┤──► Redis (공유 Token Bucket)                        │
│  Pod 3 ──┘    └── 전체 limit = 100 (인스턴스 수 무관)          │
│                                                                 │
│  // Bucket4j + Redis (Lettuce) 예시                             │
│  val proxyManager = Bucket4jRedis                               │
│      .casBasedBuilder(lettuceBasedProxyManager)                 │
│      .build()                                                   │
│                                                                 │
│  val bucket = proxyManager.builder()                            │
│      .addLimit(                                                 │
│          BandwidthBuilder.builder()                             │
│              .capacity(100)                                     │
│              .refillGreedy(100, Duration.ofSeconds(1))          │
│              .build()                                           │
│      )                                                          │
│      .build(key)                                                │
│                                                                 │
│  주의사항:                                                      │
│  ├── Redis 자체가 SPOF → Redis Cluster/Sentinel 필수           │
│  ├── 네트워크 지연 추가 (~1ms) → 허용 가능한 수준             │
│  └── Redis 장애 시 Fallback: 로컬 Rate Limiter로 전환         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 18. Jitter 변종 및 Sliding Window 심화

## 18.1 Jitter 변종 수학적 공식

### Full Jitter

```
┌─────────────────────────────────────────────────────────────────┐
│          Full Jitter                                             │
│                                                                 │
│  공식: sleep = random(0, min(cap, base × 2^attempt))           │
│                                                                 │
│  특징:                                                          │
│  ├── 대기 시간이 0부터 최대값까지 균일 분포                    │
│  ├── 가장 공격적인 분산 → 서버 부하 가장 고르게 분포           │
│  └── 단점: 운 나쁘면 0에 가까운 대기 → 즉시 재시도 가능       │
│                                                                 │
│  Python 구현:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  import random                                          │    │
│  │                                                          │    │
│  │  def full_jitter(base_ms, cap_ms, attempt):             │    │
│  │      exp_backoff = min(cap_ms, base_ms * (2 ** attempt))│    │
│  │      return random.uniform(0, exp_backoff)              │    │
│  │                                                          │    │
│  │  # 예: base=100ms, cap=10000ms                          │    │
│  │  # attempt 0: random(0, 100)    → 0~100ms              │    │
│  │  # attempt 1: random(0, 200)    → 0~200ms              │    │
│  │  # attempt 2: random(0, 400)    → 0~400ms              │    │
│  │  # attempt 5: random(0, 3200)   → 0~3200ms             │    │
│  │  # attempt 7: random(0, 10000)  → 0~10000ms (cap)      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Equal Jitter

```
┌─────────────────────────────────────────────────────────────────┐
│          Equal Jitter                                            │
│                                                                 │
│  공식: temp = min(cap, base × 2^attempt)                       │
│        sleep = temp/2 + random(0, temp/2)                      │
│                                                                 │
│  특징:                                                          │
│  ├── 최소 대기 시간 = 지수 백오프의 절반 보장                  │
│  ├── 나머지 절반을 랜덤으로 → 적절한 분산 + 최소 대기 보장    │
│  └── Full Jitter보다 보수적, 안정적                            │
│                                                                 │
│  Python 구현:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  import random                                          │    │
│  │                                                          │    │
│  │  def equal_jitter(base_ms, cap_ms, attempt):            │    │
│  │      temp = min(cap_ms, base_ms * (2 ** attempt))       │    │
│  │      return temp / 2 + random.uniform(0, temp / 2)      │    │
│  │                                                          │    │
│  │  # 예: base=100ms, cap=10000ms                          │    │
│  │  # attempt 0: 50 + random(0, 50)   → 50~100ms          │    │
│  │  # attempt 1: 100 + random(0, 100) → 100~200ms         │    │
│  │  # attempt 2: 200 + random(0, 200) → 200~400ms         │    │
│  │  # attempt 5: 1600 + random(0, 1600) → 1600~3200ms     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Decorrelated Jitter

```
┌─────────────────────────────────────────────────────────────────┐
│          Decorrelated Jitter                                     │
│                                                                 │
│  공식: sleep = min(cap, random(base, prev_sleep × 3))          │
│                                                                 │
│  특징:                                                          │
│  ├── 이전 대기 시간에 기반 (상태 유지)                          │
│  ├── 지수적 증가가 아닌 확률적 증가                             │
│  ├── 시도 간 상관관계 없음 (decorrelated)                      │
│  └── AWS 권장 (가장 균일한 서버 부하 분포)                     │
│                                                                 │
│  Python 구현:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  import random                                          │    │
│  │                                                          │    │
│  │  def decorrelated_jitter(base_ms, cap_ms, prev_sleep_ms):│   │
│  │      sleep = random.uniform(base_ms, prev_sleep_ms * 3) │    │
│  │      return min(cap_ms, sleep)                          │    │
│  │                                                          │    │
│  │  # 사용 예:                                              │    │
│  │  sleep_ms = base_ms  # 초기값                           │    │
│  │  for attempt in range(max_retries):                     │    │
│  │      try:                                               │    │
│  │          return call_service()                          │    │
│  │      except TransientError:                             │    │
│  │          sleep_ms = decorrelated_jitter(                │    │
│  │              base_ms, cap_ms, sleep_ms)                 │    │
│  │          time.sleep(sleep_ms / 1000)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AWS 시뮬레이션 비교 (100 클라이언트 동시 Retry)

| 지표 | No Jitter | Full Jitter | Equal Jitter | Decorrelated Jitter |
|------|----------|-------------|--------------|---------------------|
| **서버 피크 부하** | 100 req/s (전부 동시) | ~15 req/s | ~25 req/s | ~12 req/s |
| **평균 완료 시간** | 가장 느림 (경쟁) | 빠름 | 중간 | 가장 빠름 |
| **완료 시간 분산** | 매우 큼 | 중간 | 작음 | 중간 |
| **최소 대기 보장** | 있음 (고정값) | 없음 (0 가능) | 있음 (절반) | 있음 (base 이상) |

### 선택 기준 가이드

| 상황 | 권장 Jitter | 이유 |
|------|-----------|------|
| 서버 부하 분산이 최우선 | **Full Jitter** | 가장 고른 분포 |
| 최소 대기 시간 보장 필요 | **Equal Jitter** | 절반은 보장 |
| 상태 기반 적응형 대기 필요 | **Decorrelated Jitter** | 이전 대기에 기반한 자연스러운 조정 |
| AWS 서비스 호출 | **Decorrelated Jitter** | AWS 공식 권장 |
| 잘 모르겠을 때 | **Full Jitter** | 단순하고 효과적 |

## 18.2 Sliding Window 내부 구현 심화

### COUNT_BASED: Ring Buffer

```
┌─────────────────────────────────────────────────────────────────┐
│          COUNT_BASED Ring Buffer 내부 구현                        │
│                                                                 │
│  slidingWindowSize = 10                                         │
│                                                                 │
│  Ring Buffer (고정 크기 배열):                                   │
│  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐                    │
│  │ S │ F │ S │ S │ F │ S │ S │ S │ F │ S │                    │
│  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘                    │
│    0   1   2   3   4   5   6   7   8   9                       │
│                                          ↑                      │
│                                        head (다음 기록 위치)   │
│                                                                 │
│  누적 카운터 (O(1) Subtract-on-Evict):                         │
│  ├── totalCalls = 10                                           │
│  ├── failedCalls = 3                                           │
│  ├── failureRate = 3/10 = 30%                                  │
│  └── slowCalls = 1                                             │
│                                                                 │
│  새 호출 결과 기록 (SUCCESS):                                   │
│  1. head 위치의 기존 값 확인: buffer[0] = SUCCESS              │
│  2. 기존 값 카운터에서 빼기: (SUCCESS이므로 변화 없음)         │
│  3. 새 값 기록: buffer[0] = SUCCESS                            │
│  4. 새 값 카운터에 더하기: (SUCCESS이므로 변화 없음)           │
│  5. head = (head + 1) % size                                   │
│                                                                 │
│  핵심: 매 기록마다 O(1) — 전체 Window 재계산 불필요!           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TIME_BASED: Partial Aggregation Buckets

```
┌─────────────────────────────────────────────────────────────────┐
│          TIME_BASED Sliding Window 내부 구현                     │
│                                                                 │
│  slidingWindowSize = 10 (초)                                    │
│                                                                 │
│  시간 기반 부분 집계 (1초 단위 Bucket):                         │
│                                                                 │
│  현재: 12:00:15                                                 │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐│
│  │:06  │:07  │:08  │:09  │:10  │:11  │:12  │:13  │:14  │:15  ││
│  │ 5/50│ 3/45│ 8/60│ 2/40│ 6/55│ 4/48│ 7/52│ 1/38│ 5/44│ 3/42││
│  │fail │fail │fail │fail │fail │fail │fail │fail │fail │fail ││
│  │/tot │/tot │/tot │/tot │/tot │/tot │/tot │/tot │/tot │/tot ││
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘│
│                                                                 │
│  집계: totalFailed = 5+3+8+2+6+4+7+1+5+3 = 44                 │
│        totalCalls = 50+45+60+40+55+48+52+38+44+42 = 474       │
│        failureRate = 44/474 = 9.28%                             │
│                                                                 │
│  :16이 되면:                                                    │
│  1. :06 Bucket 제거 (Subtract): failed-=5, total-=50           │
│  2. :16 Bucket 추가: 새 집계 시작                              │
│  → O(1) 연산 (Subtract-on-Evict)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 메모리 사용량 비교

| 항목 | COUNT_BASED | TIME_BASED |
|------|------------|-----------|
| **메모리** | `windowSize × (결과 1byte)` | `windowSize × (Bucket 집계 ~40bytes)` |
| **예시 (size=100)** | ~100 bytes | ~4,000 bytes |
| **예시 (size=1000)** | ~1,000 bytes | ~40,000 bytes |
| **갱신 비용** | O(1) 항상 | O(1) 평균 (Bucket 만료 시) |
| **정밀도** | 정확히 N개 호출 | 초 단위 근사 |

### 트래픽 패턴별 윈도우 선택 기준

| 트래픽 패턴 | 권장 윈도우 | 이유 |
|------------|-----------|------|
| **고정 TPS** (일정한 트래픽) | COUNT_BASED | 호출 수 일정 → 시간/개수 차이 없음, 메모리 효율적 |
| **변동 TPS** (피크/비수기 차이 큼) | TIME_BASED | 비수기에 COUNT_BASED는 오래된 데이터 포함 가능 |
| **간헐적 호출** (배치, 스케줄러) | COUNT_BASED | TIME_BASED는 호출 없는 시간에 Window가 비어 무의미 |
| **높은 TPS** (수천 req/s) | TIME_BASED | COUNT_BASED는 Window가 매우 빠르게 회전 → 순간 오류 놓칠 수 있음 |
| **잘 모르겠을 때** | COUNT_BASED (기본값) | 단순하고 메모리 효율적, 대부분의 상황에 적합 |

---

# 19. Error Budget과 Circuit Breaker 연동

## 19.1 Google SRE Error Budget 기본 공식

```
┌─────────────────────────────────────────────────────────────────┐
│          Error Budget 기본 개념                                   │
│                                                                 │
│  SLO (Service Level Objective) = 99.9% 가용성                   │
│                                                                 │
│  Error Budget = 1 - SLO = 1 - 0.999 = 0.1%                    │
│                                                                 │
│  30일 기준:                                                     │
│  Error Budget = 30일 × 24시간 × 60분 × 0.001                  │
│               = 43.2분                                          │
│                                                                 │
│  의미: "30일 동안 43.2분의 장애는 허용된다"                     │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │  SLO      │ Error Budget (30일) │ 허용 장애   │              │
│  │───────────┼────────────────────┼────────────│              │
│  │  99%      │ 432분 (7.2시간)     │ 넉넉함     │              │
│  │  99.9%    │ 43.2분             │ 보통       │              │
│  │  99.95%   │ 21.6분             │ 빡빡함     │              │
│  │  99.99%   │ 4.32분             │ 매우 빡빡  │              │
│  │  99.999%  │ 0.432분 (26초)     │ 극도로 빡빡│              │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 19.2 Burn Rate와 Multiwindow Multi-Burn-Rate Alert

```
┌─────────────────────────────────────────────────────────────────┐
│          Burn Rate 개념                                          │
│                                                                 │
│  Burn Rate = 실제 오류 소비 속도 / 정상 소비 속도               │
│                                                                 │
│  예: SLO 99.9% (30일), Error Budget = 43.2분                   │
│                                                                 │
│  Burn Rate 1x = 43.2분/30일 = 정상 속도 (30일에 딱 소진)      │
│  Burn Rate 2x = 15일에 소진                                    │
│  Burn Rate 10x = 3일에 소진                                    │
│  Burn Rate 36x = 20시간에 소진 → 긴급!                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multiwindow Multi-Burn-Rate Alert 표

| Alert 수준 | Burn Rate | Long Window | Short Window | 의미 |
|-----------|----------|-------------|-------------|------|
| **P1 (Critical)** | 14.4x | 1시간 | 5분 | 2일 내 Budget 소진, 즉시 대응 |
| **P2 (High)** | 6x | 6시간 | 30분 | 5일 내 Budget 소진, 빠른 대응 |
| **P3 (Medium)** | 3x | 1일 | 2시간 | 10일 내 Budget 소진, 당일 대응 |
| **P4 (Low)** | 1x | 3일 | 6시간 | 30일 내 Budget 소진, 계획 대응 |

Long Window와 Short Window 모두에서 Burn Rate가 초과해야 Alert 발생 → 오탐(false positive) 방지.

## 19.3 Error Budget 상태 × CB 설정 조정 매트릭스

| Error Budget 잔여량 | CB failureRateThreshold | CB waitDuration | CB slowCallThreshold | Retry maxAttempts | 정책 |
|---------------------|------------------------|-----------------|---------------------|-------------------|------|
| **> 75% (여유)** | 50% (기본) | 30s | 80% | 3 | 일반 운영 |
| **50~75% (주의)** | 40% (약간 엄격) | 45s | 70% | 2 | 보수적 전환 |
| **25~50% (경고)** | 30% (엄격) | 60s | 60% | 1 | 방어적 운영 |
| **< 25% (위험)** | 20% (매우 엄격) | 120s | 50% | 0 (Retry 비활성) | Feature Freeze + 안정화 집중 |
| **소진됨 (0%)** | 10% | 300s | 30% | 0 | 변경 금지, 복구만 |

```
┌─────────────────────────────────────────────────────────────────┐
│          Error Budget 기반 CB 동적 조정 흐름                     │
│                                                                 │
│  Prometheus ──► Error Budget 잔여량 계산                        │
│       │                                                         │
│       ▼                                                         │
│  Budget > 75% ──► 기본 CB 설정 유지                            │
│  Budget 50~75% ──► CB threshold 강화 (40%)                     │
│  Budget 25~50% ──► CB threshold 강화 (30%) + Retry 축소        │
│  Budget < 25% ──► CB 매우 엄격 (20%) + Retry 비활성            │
│       │            + Feature Flag로 신규 기능 비활성             │
│       ▼                                                         │
│  Spring Cloud Config ──► 재배포 없이 설정 반영                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 19.4 CB 메트릭과 SLO 연동 Prometheus 쿼리

```
┌─────────────────────────────────────────────────────────────────┐
│          Prometheus 쿼리 예시                                    │
│                                                                 │
│  [1] 서비스별 Error Budget 잔여량 (30일 Rolling)]               │
│                                                                 │
│  # 30일간 실제 오류율                                           │
│  actual_error_rate = (                                          │
│    sum(rate(http_requests_total{status=~"5.."}[30d]))          │
│    /                                                            │
│    sum(rate(http_requests_total[30d]))                          │
│  )                                                              │
│                                                                 │
│  # Error Budget 잔여량 (%)                                     │
│  error_budget_remaining = (                                     │
│    1 - (actual_error_rate / (1 - 0.999))                       │
│  ) * 100                                                        │
│                                                                 │
│  [2] Burn Rate 계산                                             │
│                                                                 │
│  # 1시간 Burn Rate                                              │
│  burn_rate_1h = (                                               │
│    sum(rate(http_requests_total{status=~"5.."}[1h]))           │
│    /                                                            │
│    sum(rate(http_requests_total[1h]))                           │
│  ) / (1 - 0.999)                                                │
│                                                                 │
│  [3] CB 상태와 Error Budget 연동 대시보드                       │
│                                                                 │
│  # CB가 OPEN인 서비스의 Error Budget 영향                      │
│  sum by (service) (                                             │
│    resilience4j_circuitbreaker_state{state="open"} == 1        │
│  )                                                              │
│  *                                                              │
│  on(service) group_left()                                       │
│  (error_budget_remaining)                                       │
│                                                                 │
│  [4] CB 차단율과 SLO 위반 상관관계                              │
│                                                                 │
│  # CB가 차단한 요청 비율                                       │
│  cb_rejection_rate = (                                          │
│    sum(rate(resilience4j_circuitbreaker_not_permitted_calls     │
│      _total[5m]))                                               │
│    /                                                            │
│    sum(rate(resilience4j_circuitbreaker_calls_seconds_count    │
│      [5m]))                                                     │
│  )                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 19.5 비용 분석: Resilience 패턴 도입 비용 vs 장애 비용

```
┌─────────────────────────────────────────────────────────────────┐
│          Resilience 투자 대비 수익 (ROI) 분석                    │
│                                                                 │
│  [장애 비용 산정]                                                │
│                                                                 │
│  직접 비용:                                                     │
│  ├── 매출 손실 = 시간당 매출 × 장애 시간                       │
│  ├── SLA 위약금 = 계약 기반 (보통 월 매출의 10~30%)            │
│  └── 복구 인건비 = 엔지니어 수 × 시급 × 복구 시간             │
│                                                                 │
│  간접 비용:                                                     │
│  ├── 고객 이탈 = 장애 경험 고객의 5~15% 이탈 (산업 평균)      │
│  ├── 브랜드 신뢰 하락 (정량화 어려움)                          │
│  └── 개발 생산성 저하 (장애 대응 + 포스트모텀 시간)            │
│                                                                 │
│  예시: 시간당 매출 1억원 서비스                                  │
│  ├── 연간 2회 × 2시간 장애 = 4시간 × 1억 = 4억원 직접 손실    │
│  ├── SLA 위약금: 1억원                                         │
│  ├── 고객 이탈: 2억원 (추정)                                   │
│  └── 총 장애 비용: ~7억원/년                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Resilience 패턴 도입 비용]                                    │
│                                                                 │
│  개발 비용:                                                     │
│  ├── CB + Retry + Timeout: 2주 (1명) = 400만원                 │
│  ├── Bulkhead + Rate Limiter: 1주 = 200만원                    │
│  ├── 모니터링 대시보드: 1주 = 200만원                          │
│  └── Chaos Engineering 구축: 2주 = 400만원                     │
│                                                                 │
│  운영 비용 (연간):                                              │
│  ├── 모니터링 인프라: 500만원                                  │
│  ├── GameDay 운영 (분기별): 200만원                            │
│  └── 설정 튜닝/유지보수: 300만원                               │
│                                                                 │
│  총 도입 비용: ~2,200만원 (첫해), ~1,000만원 (이후 연간)       │
│                                                                 │
│  ROI = (7억 - 0.22억) / 0.22억 = 약 30배                      │
│  (장애 비용을 50%만 줄여도 ROI 15배)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 19.6 단계별 도입 로드맵

```
┌─────────────────────────────────────────────────────────────────┐
│          Resilience 패턴 단계별 도입 로드맵                      │
│                                                                 │
│  Phase 1: 기초 (2주)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ├── Timeout 설정 (모든 외부 호출)                       │    │
│  │  ├── Retry + Exponential Backoff + Jitter               │    │
│  │  ├── 기본 Health Check                                   │    │
│  │  └── 메트릭 수집 시작 (Micrometer + Prometheus)          │    │
│  │                                                          │    │
│  │  성과: 기본적인 일시적 오류 복구 능력 확보               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Phase 2: 핵심 (2주)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ├── Circuit Breaker (핵심 서비스 호출)                  │    │
│  │  ├── Fallback (Graceful Degradation)                     │    │
│  │  ├── Grafana 대시보드 구축                               │    │
│  │  └── METRICS_ONLY 모드로 관찰 기간 운영                 │    │
│  │                                                          │    │
│  │  성과: 연쇄 장애 차단 능력 확보, 가시성 확보            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Phase 3: 격리 (2주)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ├── Bulkhead (서비스별 격리)                            │    │
│  │  ├── Rate Limiter (외부 API 호출 제한)                   │    │
│  │  ├── WireMock 기반 통합 테스트                           │    │
│  │  └── Alert 규칙 설정                                     │    │
│  │                                                          │    │
│  │  성과: 리소스 격리 + 과부하 방지                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Phase 4: 검증 (2주)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ├── Chaos Engineering 도입 (Toxiproxy / Chaos Mesh)    │    │
│  │  ├── 첫 번째 GameDay 실시                                │    │
│  │  ├── SLO/Error Budget 정의                               │    │
│  │  └── Error Budget 기반 Alert 설정                        │    │
│  │                                                          │    │
│  │  성과: 장애 내성 검증 + SLO 기반 운영 시작              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Phase 5: 최적화 (지속적)                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ├── Adaptive Concurrency Limits 도입                    │    │
│  │  ├── Load Shedding (Priority-based)                      │    │
│  │  ├── Hedging Pattern (Fan-out 서비스)                    │    │
│  │  ├── Error Budget 기반 CB 동적 조정                      │    │
│  │  ├── 정기 GameDay (분기별)                               │    │
│  │  └── Multi-Region Failover                               │    │
│  │                                                          │    │
│  │  성과: 자동화된 최적화 + 지속적 개선                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 19.7 YAGNI + Resilience 균형 의사결정 프레임워크

```
┌─────────────────────────────────────────────────────────────────┐
│          YAGNI와 Resilience의 균형                               │
│                                                                 │
│  YAGNI (You Aren't Gonna Need It):                              │
│  "필요할 때까지 만들지 마라"                                    │
│                                                                 │
│  Resilience Engineering:                                        │
│  "장애는 반드시 발생한다. 미리 대비하라"                        │
│                                                                 │
│  → 모순처럼 보이지만, 둘 다 맞다.                               │
│  → 핵심은 "어디까지가 과잉이고, 어디부터가 필수인가?"          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  의사결정 프레임워크:                                            │
│                                                                 │
│  Q1: 이 서비스가 죽으면 매출에 직접 영향이 있는가?             │
│  ├── YES → Timeout + Retry + CB + Fallback (Phase 1~2 즉시)   │
│  └── NO  → Timeout + Retry만 (Phase 1)                        │
│                                                                 │
│  Q2: Fan-out이 10개 이상인가?                                  │
│  ├── YES → Hedging + Bulkhead (Phase 3~5 병행)                │
│  └── NO  → Bulkhead는 선택사항                                │
│                                                                 │
│  Q3: 트래픽이 예측 불가능하게 변동하는가?                      │
│  ├── YES → Adaptive Concurrency + Load Shedding               │
│  └── NO  → 정적 Bulkhead + 고정 Rate Limit으로 충분           │
│                                                                 │
│  Q4: SLA에 가용성 조항이 있는가?                               │
│  ├── YES → SLO/Error Budget 정의 + Chaos Engineering 필수     │
│  └── NO  → 비즈니스 임팩트 기반 판단                          │
│                                                                 │
│  Q5: Multi-Region이 필요한가?                                  │
│  ├── YES → Cell-based Architecture 검토                       │
│  └── NO  → 단일 Region + Multi-AZ로 충분                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [절대 YAGNI가 아닌 것들 — 항상 필수]                           │
│  ├── 모든 외부 호출에 Timeout 설정                             │
│  ├── Retry에 Exponential Backoff + Jitter                      │
│  ├── 모니터링 (메트릭 + 로그 + 트레이스)                       │
│  └── Health Check                                               │
│                                                                 │
│  [YAGNI일 수 있는 것들 — 필요할 때 추가]                       │
│  ├── Adaptive Concurrency Limits (트래픽 안정적이면 불필요)    │
│  ├── Hedging (Fan-out 없으면 불필요)                           │
│  ├── Multi-Region (단일 Region으로 SLO 달성 가능하면)          │
│  ├── Cell-based Architecture (수십만 사용자 이하면 과잉)       │
│  └── Chaos Engineering (서비스 1~2개 수준이면 과잉)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
