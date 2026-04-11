---
layout: single
title: "Resilience 라이브러리 확장: 다중 언어, gRPC, 모니터링"
date: 2026-04-11 23:00:00 +0900
categories: backend
excerpt: "Resilience 패턴을 Python·Node.js·Rust와 gRPC·Kotlin·운영 모니터링까지 확장해 구현과 운영 포인트를 정리한다."
toc: true
toc_sticky: true
tags: [resilience, circuitbreaker, retry, grpc, monitoring]
---
**TL;DR**
- 언어별 라이브러리와 gRPC·Kotlin 환경에서 Resilience 패턴을 어떻게 구현하는지 한 번에 비교한다.
- 재시도, 차단기, Hedging, 헬스체크, 모니터링과 런북까지 운영 관점의 연결점을 정리한다.
- 2025~2026 최신 동향과 실전 PromQL·AlertManager 예시까지 포함해 바로 참고할 수 있게 구성했다.

## 1. 개념
Resilience 패턴은 장애를 감지하고 격리하며 복구를 유도하기 위한 설계 기법으로, 언어별 라이브러리·프로토콜 기능·운영 도구를 함께 묶어야 효과가 난다.

## 2. 배경
분산 시스템이 복잡해지면서 단순 재시도만으로는 부족해졌고, gRPC·Coroutine·eBPF·LLM 서비스까지 환경별로 다른 복원력 전략이 필요해졌다.

## 3. 이유
장애 전파를 줄이고 tail latency와 과부하를 제어하며, 구현 단계와 운영 단계에서 같은 기준으로 시스템 상태를 판단할 수 있어야 하기 때문이다.

## 4. 특징
Python·Node.js·Rust·gRPC·Kotlin 사례, 최신 기술 동향, Grafana·PromQL·AlertManager·Runbook까지 실전 운영 관점으로 넓게 다룬다.

## 5. 상세 내용

---

# 20. 다중 언어 생태계 Resilience 라이브러리

Java/Spring 생태계 밖에서도 Resilience 패턴은 필수이다. Python, Node.js, Rust 생태계 각각의 주요 라이브러리와 설계 철학, 사용법을 비교한다.

## 20.1 Python 생태계

### pybreaker — Python Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────┐
│          pybreaker (Daniel Fernandes Martins, v1.4.1)            │
│          이름 유래: "py" + "breaker" (Python용 CB)              │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── CircuitBreaker 클래스 단일 진입점                          │
│  ├── fail_max: 실패 임계값 (기본 5)                             │
│  ├── reset_timeout: OPEN→HALF_OPEN 전환 대기 시간 (기본 60초) │
│  ├── success_threshold: HALF_OPEN→CLOSED 전환 성공 횟수        │
│  ├── exclude: 실패로 간주하지 않을 예외 목록                   │
│  └── Listener 패턴으로 상태 변경 이벤트 구독                   │
│                                                                 │
│  [분산 상태 — Redis Storage]                                    │
│  ├── CircuitRedisStorage로 다중 인스턴스 간 CB 상태 공유       │
│  ├── Redis Hash에 fail_counter, state, opened_at 저장          │
│  └── 마이크로서비스 환경에서 인스턴스 간 일관성 보장           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```python
import pybreaker
import redis

# 기본 사용법
breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    exclude=[ValueError],  # ValueError는 실패로 간주하지 않음
)

@breaker
def call_external_service():
    return requests.get("https://api.example.com/data", timeout=5)

# Listener 패턴 — 상태 변경 모니터링
class MetricsListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        print(f"CB '{cb.name}': {old_state.name} → {new_state.name}")

    def failure(self, cb, exc):
        metrics.increment("cb.failure", tags={"breaker": cb.name})

breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    listeners=[MetricsListener()],
)

# Redis 분산 상태 (마이크로서비스 환경)
redis_conn = redis.StrictRedis(host="redis", port=6379)
storage = pybreaker.CircuitRedisStorage(
    pybreaker.STATE_CLOSED,
    redis_conn,
    namespace="payment-service",
)
breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    state_storage=storage,
)
```

### tenacity — 끈질긴 Retry 라이브러리

```
┌─────────────────────────────────────────────────────────────────┐
│          tenacity (Julien Danjou, v9.1.4)                        │
│          이름 유래: "끈질김" — 포기하지 않고 재시도             │
│          retrying 라이브러리의 fork (유지보수 중단 대체)         │
│                                                                 │
│  [핵심 설계 — 조합 가능한 Strategy 객체]                        │
│  ├── stop: 언제 멈출 것인가?                                   │
│  │   ├── stop_after_attempt(N)                                  │
│  │   ├── stop_after_delay(seconds)                              │
│  │   └── stop_after_attempt(5) | stop_after_delay(30)  (OR)    │
│  ├── wait: 얼마나 기다릴 것인가?                               │
│  │   ├── wait_fixed(seconds)                                    │
│  │   ├── wait_exponential(multiplier, min, max)                 │
│  │   ├── wait_random(min, max)                                  │
│  │   └── wait_exponential_jitter(initial, max, jitter)          │
│  ├── retry: 어떤 조건에서 재시도할 것인가?                     │
│  │   ├── retry_if_exception_type(IOError)                       │
│  │   ├── retry_if_result(lambda r: r is None)                   │
│  │   └── retry_if_exception_type(A) | retry_if_result(B) (OR)  │
│  └── asyncio/Trio 네이티브 지원                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```python
from tenacity import (
    retry, stop_after_attempt, stop_after_delay,
    wait_exponential_jitter, retry_if_exception_type,
    before_log, after_log,
)
import logging

logger = logging.getLogger(__name__)

# 조합 가능한 Strategy
@retry(
    stop=stop_after_attempt(5) | stop_after_delay(30),
    wait=wait_exponential_jitter(initial=1, max=60, jitter=2),
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    before=before_log(logger, logging.WARNING),
    after=after_log(logger, logging.WARNING),
    reraise=True,
)
def fetch_data(url: str) -> dict:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()

# asyncio 지원
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=10),
)
async def async_fetch(session, url):
    async with session.get(url) as resp:
        return await resp.json()
```

### stamina — 안전 최우선 Retry

```
┌─────────────────────────────────────────────────────────────────┐
│          stamina (Hynek Schlawack, v25.2.0)                      │
│          이름 유래: "지구력" — 끝까지 버티기                    │
│          tenacity의 opinionated wrapper                          │
│                                                                 │
│  [핵심 철학]                                                    │
│  ├── 안전한 기본값 최우선 — 잘못 쓰기 어렵게 설계              │
│  ├── Prometheus counter 내장 (stamina.retry_count)              │
│  ├── structlog 통합 지원                                       │
│  ├── set_active(False) → 테스트 시 재시도 전체 비활성화        │
│  └── API 표면적 최소화 — 모범 사례만 노출                      │
│                                                                 │
│  비교: tenacity vs stamina                                      │
│  ┌──────────────┬──────────────────┬──────────────────┐         │
│  │ 항목         │ tenacity         │ stamina          │         │
│  ├──────────────┼──────────────────┼──────────────────┤         │
│  │ API 크기     │ 많은 옵션        │ 최소한           │         │
│  │ 기본 전략    │ 없음 (직접 구성) │ exp backoff      │         │
│  │ 모니터링     │ 콜백 직접 구현   │ Prometheus 내장  │         │
│  │ 테스트       │ mock 필요        │ set_active(False)│         │
│  │ 유연성       │ 매우 높음        │ 제한적 (의도적)  │         │
│  └──────────────┴──────────────────┴──────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```python
import stamina

# 간결한 API — 안전한 기본값 자동 적용
@stamina.retry(on=ConnectionError, attempts=5)
def call_api():
    return httpx.get("https://api.example.com/data")

# 테스트 시 전체 재시도 비활성화
stamina.set_active(False)  # 모든 @stamina.retry가 즉시 실행

# Prometheus 메트릭 자동 수집
# stamina_retries_total{callable="call_api", retry_num="1"} counter
```

### HTTP 클라이언트 내장 Retry

```
┌─────────────────────────────────────────────────────────────────┐
│          Python HTTP 클라이언트 Retry 지원                       │
│                                                                 │
│  [httpx — AsyncHTTPTransport]                                   │
│  transport = httpx.AsyncHTTPTransport(retries=3)                │
│  async with httpx.AsyncClient(transport=transport) as client:   │
│      response = await client.get("https://api.example.com")     │
│  → 연결 실패에만 재시도 (HTTP 오류 코드에는 재시도 안 함)      │
│                                                                 │
│  [aiohttp]                                                      │
│  기본 retry 없음 — 서드파티 라이브러리 필요                    │
│  aiohttp-retry 패키지 사용:                                    │
│  retry_options = ExponentialRetry(attempts=3)                    │
│  retry_client = RetryClient(retry_options=retry_options)         │
│                                                                 │
│  [urllib3 — requests 내부]                                       │
│  Retry(total=3, backoff_factor=0.3,                              │
│        status_forcelist=[500, 502, 503, 504])                    │
│  → requests.Session()의 HTTPAdapter에 mount                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 20.2 Node.js 생태계

### opossum — EventEmitter 기반 Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────┐
│          opossum (Lance Ball / Red Hat, v8.1.3)                   │
│          이름 유래: "주머니쥐 (Opossum)"                        │
│          — 위협받으면 죽은 척하는 동물 (CB가 OPEN이면 거부)     │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── EventEmitter 기반 — Node.js 관용적 API                    │
│  ├── errorThresholdPercentage: 실패율 임계값 (기본 50%)        │
│  ├── volumeThreshold: 최소 요청 수 (기본 5)                    │
│  ├── rollingCountTimeout: 통계 윈도우 (기본 10000ms)           │
│  ├── timeout: 요청 타임아웃 (기본 10000ms)                     │
│  ├── AbortController 통합 — 타임아웃 시 요청 자동 취소         │
│  ├── capacity: Bulkhead (동시 실행 제한)                       │
│  └── fallback 함수 등록                                        │
│                                                                 │
│  [이벤트 목록]                                                  │
│  ├── fire     — 함수 호출 시                                   │
│  ├── success  — 성공 시                                         │
│  ├── failure  — 실패 시                                         │
│  ├── timeout  — 타임아웃 시                                    │
│  ├── reject   — CB OPEN으로 거부 시                             │
│  ├── open     — CLOSED → OPEN 전환                              │
│  ├── close    — HALF_OPEN → CLOSED 전환                        │
│  ├── halfOpen — OPEN → HALF_OPEN 전환                           │
│  └── fallback — Fallback 실행 시                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
import CircuitBreaker from 'opossum';

// 기본 사용법
const breaker = new CircuitBreaker(
  async (url) => {
    const controller = new AbortController();
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  {
    timeout: 5000,                    // 5초 타임아웃
    errorThresholdPercentage: 50,     // 50% 실패율에서 OPEN
    volumeThreshold: 10,              // 최소 10개 요청 후 판단
    rollingCountTimeout: 30000,       // 30초 윈도우
    rollingCountBuckets: 10,          // 10개 버킷
    resetTimeout: 15000,              // 15초 후 HALF_OPEN
    capacity: 20,                     // Bulkhead: 동시 20개 제한
  }
);

// Fallback 등록
breaker.fallback((url) => ({
  data: [],
  source: 'cache',
  message: 'Service temporarily unavailable',
}));

// 이벤트 기반 모니터링
breaker.on('open', () => console.warn('CB OPEN — 요청 차단 시작'));
breaker.on('halfOpen', () => console.info('CB HALF_OPEN — 시험 요청 허용'));
breaker.on('close', () => console.info('CB CLOSED — 정상 복귀'));
breaker.on('reject', () => metrics.increment('cb.rejected'));

// 실행
const data = await breaker.fire('https://api.example.com/users');

// Prometheus 메트릭 (opossum-prometheus 패키지)
import { PrometheusMetrics } from 'opossum-prometheus';
const prometheus = new PrometheusMetrics({ circuits: [breaker] });
```

### cockatiel — Polly에서 영감받은 Policy 기반 Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          cockatiel (Connor Wills / MS VSCode팀, MIT)             │
│          이름 유래: "작은 앵무새 (Cockatiel)"                   │
│          — Polly(앵무새)에서 영감, .NET Polly의 Node.js 버전    │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── IPolicy 인터페이스 — 모든 패턴의 공통 계약               │
│  ├── wrap() 조합 — 여러 Policy를 하나로 합성                  │
│  ├── Zero dependencies — 번들 크기 최소화                      │
│  ├── SamplingBreaker — 통계 기반 CB                            │
│  ├── ConsecutiveBreaker — 연속 실패 기반 CB                    │
│  └── TypeScript 우선 설계                                       │
│                                                                 │
│  [Policy 종류]                                                  │
│  ├── RetryPolicy — 재시도                                      │
│  ├── CircuitBreakerPolicy — 차단기                              │
│  │   ├── SamplingBreaker (비율 기반)                            │
│  │   └── ConsecutiveBreaker (연속 실패 기반)                   │
│  ├── TimeoutPolicy — 시간 제한                                  │
│  ├── BulkheadPolicy — 동시 실행 제한                            │
│  └── FallbackPolicy — 대체 동작                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
import {
  CircuitBreakerPolicy, SamplingBreaker, ConsecutiveBreaker,
  retry, handleAll, wrap, timeout, bulkhead, fallback, TimeoutStrategy,
} from 'cockatiel';

// SamplingBreaker — 통계 기반 CB
const circuitBreaker = new CircuitBreakerPolicy(
  handleAll,
  new SamplingBreaker({
    threshold: 0.5,          // 50% 실패율
    duration: 30_000,        // 30초 윈도우
    minimumRps: 5,           // 최소 5 req/s
  })
);

// Policy 조합 (wrap)
const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: { type: 'exponential', initialDelay: 500 },
});
const timeoutPolicy = timeout(5_000, TimeoutStrategy.Aggressive);
const bulkheadPolicy = bulkhead(10, 20); // 동시 10개, 큐 20개

// 조합: Retry → CircuitBreaker → Timeout → Bulkhead (외→내)
const resilientPolicy = wrap(
  retryPolicy, circuitBreaker, timeoutPolicy, bulkheadPolicy
);

const result = await resilientPolicy.execute(() =>
  fetch('https://api.example.com/data').then(r => r.json())
);
```

### p-retry — 미니멀 Retry

```
┌─────────────────────────────────────────────────────────────────┐
│          p-retry (Sindre Sorhus, v7.1.1)                         │
│          이름 유래: "p" (Promise) + "retry"                     │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── ESM 전용 (CommonJS 미지원)                                │
│  ├── AbortError — 특정 실패에서 재시도 즉시 중단               │
│  ├── shouldRetry 콜백 — 조건부 재시도                          │
│  ├── unref 옵션 — 이벤트 루프 보호 (타이머가 프로세스 종료     │
│  │   를 막지 않도록)                                           │
│  └── p-timeout과 함께 사용 권장                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
import pRetry, { AbortError } from 'p-retry';

const result = await pRetry(
  async () => {
    const response = await fetch('https://api.example.com/data');
    if (response.status === 404) {
      throw new AbortError('Resource not found — 재시도 무의미');
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  },
  {
    retries: 5,
    shouldRetry: (error) => error.message !== 'RATE_LIMITED',
    onFailedAttempt: (error) => {
      console.log(
        `Attempt ${error.attemptNumber} failed. ` +
        `${error.retriesLeft} retries left.`
      );
    },
    unref: true,  // 타이머가 Node.js 프로세스 종료를 막지 않음
  }
);
```

## 20.3 Rust 생태계

### tower — Service 추상화 계층

```
┌─────────────────────────────────────────────────────────────────┐
│          tower (tower-rs, v0.5.3)                                │
│          이름 유래: "탑" — Layer를 쌓아 올리는 구조             │
│                                                                 │
│  [핵심 설계 — Service Trait]                                    │
│                                                                 │
│  trait Service<Request> {                                        │
│      type Response;                                              │
│      type Error;                                                 │
│      type Future: Future<Output = Result<Response, Error>>;      │
│                                                                 │
│      fn poll_ready(&mut self, cx: &mut Context) -> Poll<()>;    │
│      fn call(&mut self, req: Request) -> Self::Future;           │
│  }                                                               │
│                                                                 │
│  [ServiceBuilder 체이닝]                                        │
│  ServiceBuilder::new()                                           │
│      .timeout(Duration::from_secs(5))                            │
│      .rate_limit(100, Duration::from_secs(1))                    │
│      .concurrency_limit(50)      // Bulkhead                    │
│      .retry(MyRetryPolicy)                                       │
│      .service(MyService)                                         │
│                                                                 │
│  [생태계 영향]                                                  │
│  ├── 144,000+ 의존 크레이트 (Rust 생태계 핵심)                 │
│  ├── Hyper, Tonic (gRPC), Axum 모두 tower 기반                 │
│  ├── tower-http: HTTP 특화 미들웨어                             │
│  └── tower-circuitbreaker: 별도 크레이트 (CB 전용)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```rust
use tower::{ServiceBuilder, ServiceExt, timeout::TimeoutLayer};
use tower::limit::{RateLimitLayer, ConcurrencyLimitLayer};
use std::time::Duration;

// ServiceBuilder를 통한 Layer 합성
let service = ServiceBuilder::new()
    .layer(TimeoutLayer::new(Duration::from_secs(5)))
    .layer(RateLimitLayer::new(100, Duration::from_secs(1)))
    .layer(ConcurrencyLimitLayer::new(50))
    .service(my_service);

// tower-circuitbreaker 별도 사용
use tower_circuitbreaker::{CircuitBreakerLayer, Config};

let cb_layer = CircuitBreakerLayer::new(
    Config::new()
        .failure_threshold(5)
        .success_threshold(3)
        .timeout(Duration::from_secs(30))
);

let service = ServiceBuilder::new()
    .layer(cb_layer)
    .service(my_service);
```

### backon — Zero-cost Retry

```
┌─────────────────────────────────────────────────────────────────┐
│          backon (Xuanwo, v1.6.0)                                 │
│          이름 유래: "back on" + "backoff"                        │
│          backoff 크레이트 대체 — 더 현대적인 API                │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── Iterator 기반 Backoff — 지연 시간 시퀀스 생성             │
│  ├── .retry() Trait Extension — 기존 함수에 체이닝             │
│  ├── Zero-cost abstraction — 런타임 오버헤드 없음              │
│  ├── async/sync 모두 지원                                      │
│  └── Tokio, async-std 런타임 무관                               │
│                                                                 │
│  [Backoff 종류]                                                 │
│  ├── ExponentialBackoff { factor, min_delay, max_delay,         │
│  │   max_times }                                                │
│  ├── ConstantBackoff { delay, max_times }                       │
│  └── 커스텀 Iterator 구현 가능                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```rust
use backon::{ExponentialBuilder, Retryable};
use anyhow::Result;
use std::time::Duration;

async fn fetch_data() -> Result<String> {
    let resp = reqwest::get("https://api.example.com/data").await?;
    Ok(resp.text().await?)
}

// Trait Extension 패턴 — .retry()로 체이닝
let result = fetch_data
    .retry(ExponentialBuilder::default()
        .with_factor(2.0)
        .with_min_delay(Duration::from_millis(100))
        .with_max_delay(Duration::from_secs(10))
        .with_max_times(5))
    .when(|e| e.is::<reqwest::Error>())  // 조건부 재시도
    .await?;
```

### governor — GCRA Rate Limiter

```
┌─────────────────────────────────────────────────────────────────┐
│          governor (boinkor-net, v0.10.4)                          │
│          이름 유래: "조속기 (Governor)" — 엔진 속도 조절 장치   │
│                                                                 │
│  [핵심 설계]                                                    │
│  ├── GCRA (Generic Cell Rate Algorithm) — ATM 네트워크 유래    │
│  ├── AtomicU64 단일 상태 — 극도로 낮은 메모리 사용             │
│  ├── lock-free 구현 — 높은 동시성                               │
│  ├── Keyed Rate Limiter — IP별, 사용자별 독립 제한             │
│  └── tower-governor — tower Layer 통합                          │
│                                                                 │
│  [tower-governor 통합]                                          │
│  Axum / Tonic에서 미들웨어로 사용:                              │
│  let governor_layer = GovernorLayer::per_second(10);            │
│  → 초당 10개 요청 제한                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```rust
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

// 기본 Rate Limiter — 초당 50개 요청
let limiter = RateLimiter::direct(
    Quota::per_second(NonZeroU32::new(50).unwrap())
);

// 요청 전 확인
if limiter.check().is_ok() {
    handle_request().await;
} else {
    return Err(Status::resource_exhausted("rate limited"));
}

// Keyed Rate Limiter — IP별 제한
let keyed_limiter = RateLimiter::keyed(
    Quota::per_second(NonZeroU32::new(10).unwrap())
);

// IP별 독립 제한
keyed_limiter.check_key(&client_ip)?;

// tower-governor Axum 통합
use tower_governor::{GovernorLayer, GovernorConfigBuilder};

let config = GovernorConfigBuilder::default()
    .per_second(10)
    .burst_size(30)
    .finish()
    .unwrap();

let app = Router::new()
    .route("/api", get(handler))
    .layer(GovernorLayer { config });
```

## 20.4 언어별 라이브러리 비교표

| 항목 | Python pybreaker | Python tenacity | Python stamina | Node.js opossum | Node.js cockatiel | Rust tower | Rust backon |
|------|-----------------|----------------|---------------|-----------------|-------------------|------------|-------------|
| **패턴** | CB | Retry | Retry | CB+Bulkhead | CB+Retry+Timeout+Bulkhead | Timeout+RateLimit+Bulkhead | Retry |
| **CB 지원** | O (핵심) | X | X | O (핵심) | O (SamplingBreaker) | 별도 크레이트 | X |
| **Retry 지원** | X | O (핵심) | O (핵심) | X | O | O (Policy) | O (핵심) |
| **분산 상태** | Redis | X | X | X | X | X | X |
| **모니터링** | Listener | 콜백 | Prometheus 내장 | EventEmitter | 이벤트 | Metrics Layer | X |
| **Async** | X (동기) | O (asyncio) | O (asyncio) | O (Promise) | O (Promise) | O (Future) | O (Future) |
| **번들 크기** | 작음 | 중간 | 작음 | 중간 | Zero deps | Layer 별도 | 작음 |
| **철학** | 단순 CB | 유연한 조합 | 안전한 기본값 | Node 관용적 | .NET Polly 스타일 | 합성 가능한 Layer | Zero-cost |

---

# 21. gRPC 내장 Resilience 메커니즘

gRPC는 HTTP/2 기반 RPC 프레임워크로, 프로토콜 수준에서 다양한 Resilience 메커니즘을 내장하고 있다. 별도 라이브러리 없이도 상당한 수준의 복원력을 확보할 수 있다.

## 21.1 Retry Policy (gRFC A6)

```
┌─────────────────────────────────────────────────────────────────┐
│          gRPC Retry Policy — Service Config 기반                 │
│          참고: gRFC A6 "Client-Side Retry Design"               │
│                                                                 │
│  [Service Config JSON 구조]                                     │
│                                                                 │
│  {                                                               │
│    "methodConfig": [{                                            │
│      "name": [{ "service": "my.package.MyService" }],           │
│      "retryPolicy": {                                            │
│        "maxAttempts": 4,                                         │
│        "initialBackoff": "0.1s",                                 │
│        "maxBackoff": "1s",                                       │
│        "backoffMultiplier": 2,                                   │
│        "retryableStatusCodes": [                                 │
│          "UNAVAILABLE", "DEADLINE_EXCEEDED"                      │
│        ]                                                         │
│      }                                                           │
│    }]                                                            │
│  }                                                               │
│                                                                 │
│  [maxAttempts 제한]                                              │
│  ├── 서버 설정: 최대 5 (하드 리밋)                              │
│  ├── 초과 값 지정 시 자동으로 5로 절삭                          │
│  └── 첫 시도 포함 → maxAttempts=4이면 최대 3번 재시도          │
│                                                                 │
│  [Backoff 공식]                                                 │
│  random(0, min(initialBackoff * backoffMultiplier^(n-1),         │
│              maxBackoff))                                        │
│  ├── +-20% jitter 자동 적용                                    │
│  └── n = 재시도 횟수 (1부터 시작)                               │
│                                                                 │
│  [retryThrottling — 토큰 기반 재시도 억제]                      │
│  "retryThrottling": {                                            │
│    "maxTokens": 10,          // 최대 토큰 수                    │
│    "tokenRatio": 0.1         // 성공 시 회복 비율               │
│  }                                                               │
│  ├── 초기 토큰 = maxTokens                                      │
│  ├── 재시도 시 1 토큰 소비                                      │
│  ├── 성공 시 tokenRatio만큼 회복                                │
│  ├── 토큰 < maxTokens/2 이면 재시도 중단                       │
│  └── 서버 과부하 시 자동으로 재시도 빈도 감소                  │
│                                                                 │
│  [Server Pushback]                                               │
│  ├── 서버가 "grpc-retry-pushback-ms" 메타데이터 반환           │
│  ├── 값 >= 0: 해당 시간 후 재시도                               │
│  ├── 값 없음: 클라이언트 backoff 사용                           │
│  └── 서버가 재시도 타이밍을 직접 제어 가능                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 21.2 투명 재시도 vs 구성 가능 재시도

```
┌─────────────────────────────────────────────────────────────────┐
│          Transparent Retry vs Configurable Retry                 │
│                                                                 │
│  [Transparent Retry — 투명 재시도]                              │
│  ├── 조건: 요청이 서버 애플리케이션에 도달하지 못한 경우       │
│  │   ├── 연결 실패 (TCP 수준)                                  │
│  │   ├── HTTP/2 REFUSED_STREAM                                  │
│  │   └── RST_STREAM (NO_ERROR)                                  │
│  ├── maxAttempts에 포함되지 않음                                │
│  ├── 서버 애플리케이션은 요청 존재 자체를 모름                 │
│  └── 항상 활성화 (비활성화 불가)                                │
│                                                                 │
│  [Configurable Retry — 구성 가능 재시도]                        │
│  ├── 조건: 서버가 retryableStatusCodes 중 하나를 반환          │
│  ├── maxAttempts에 포함됨                                       │
│  ├── Service Config에 명시적 설정 필요                          │
│  ├── 서버 애플리케이션이 요청을 처리하고 실패 응답             │
│  └── 멱등성(Idempotency) 확인 필수                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │          재시도 판단 흐름                             │       │
│  │                                                       │       │
│  │  요청 실패                                            │       │
│  │  ├── 서버 앱 미도달?                                  │       │
│  │  │   ├── YES → Transparent Retry (자동)              │       │
│  │  │   └── NO  ↓                                        │       │
│  │  ├── retryPolicy 설정됨?                              │       │
│  │  │   ├── NO  → 실패 반환                             │       │
│  │  │   └── YES ↓                                        │       │
│  │  ├── Status Code가 retryableStatusCodes에 포함?      │       │
│  │  │   ├── NO  → 실패 반환                             │       │
│  │  │   └── YES ↓                                        │       │
│  │  ├── maxAttempts 초과?                                │       │
│  │  │   ├── YES → 실패 반환                             │       │
│  │  │   └── NO  ↓                                        │       │
│  │  ├── retryThrottling 토큰 부족?                       │       │
│  │  │   ├── YES → 실패 반환                             │       │
│  │  │   └── NO  → Backoff 후 재시도                     │       │
│  │  └── Server Pushback 있으면 해당 시간 대기            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 21.3 Hedging Policy

```
┌─────────────────────────────────────────────────────────────────┐
│          Hedging Policy — 투기적 실행                             │
│          참고: Jeff Dean "Tail at Scale" (2013) 구현             │
│                                                                 │
│  [개념]                                                         │
│  ├── 첫 요청의 응답이 hedgingDelay 내에 오지 않으면            │
│  │   동일 요청을 추가 서버에 병렬 전송                         │
│  ├── 가장 먼저 도착한 응답 사용, 나머지 취소                   │
│  ├── tail latency (p99) 개선에 매우 효과적                     │
│  └── retry와 동시 사용 불가 (methodConfig에서 택 1)             │
│                                                                 │
│  [Service Config]                                                │
│  {                                                               │
│    "methodConfig": [{                                            │
│      "name": [{ "service": "my.SearchService" }],               │
│      "hedgingPolicy": {                                          │
│        "maxAttempts": 3,                                         │
│        "hedgingDelay": "0.5s",                                   │
│        "nonFatalStatusCodes": ["UNAVAILABLE", "INTERNAL"]       │
│      }                                                           │
│    }]                                                            │
│  }                                                               │
│                                                                 │
│  [동작 타임라인]                                                │
│                                                                 │
│  t=0.0s    요청 #1 전송 ──────────────► Server A                │
│  t=0.5s    응답 없음 → 요청 #2 전송 ──► Server B               │
│  t=0.7s    Server B 응답 도착 (사용)                            │
│  t=1.2s    Server A 응답 도착 (취소/무시)                       │
│                                                                 │
│  → p99 latency: 1.2s → 0.7s로 개선                             │
│                                                                 │
│  [주의사항]                                                     │
│  ├── 서버 부하 증가 (최대 maxAttempts배)                        │
│  ├── 멱등(Idempotent) 메서드에만 사용                           │
│  ├── nonFatalStatusCodes: 해당 코드 수신 시 다음 hedging 허용  │
│  └── retryThrottling과 연동 (토큰 소비)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 21.4 Health Checking (gRFC L5)

```
┌─────────────────────────────────────────────────────────────────┐
│          gRPC Health Checking Protocol                            │
│          참고: gRFC L5 "gRPC Health Checking"                   │
│                                                                 │
│  [서비스 정의]                                                  │
│  package grpc.health.v1;                                         │
│                                                                 │
│  service Health {                                                │
│    rpc Check(HealthCheckRequest)                                 │
│        returns (HealthCheckResponse);          // Unary          │
│    rpc Watch(HealthCheckRequest)                                 │
│        returns (stream HealthCheckResponse);   // Streaming      │
│  }                                                               │
│                                                                 │
│  [상태 값]                                                      │
│  ├── SERVING         — 정상, 요청 수락 가능                    │
│  ├── NOT_SERVING     — 비정상, 요청 거부                       │
│  ├── UNKNOWN         — 상태 미확인 (초기값)                    │
│  └── SERVICE_UNKNOWN — 해당 서비스 등록 안 됨                  │
│                                                                 │
│  [Check vs Watch]                                                │
│  ├── Check (Unary): 호출 시점의 상태 반환                      │
│  │   └── 폴링 방식: 주기적으로 Check 호출                      │
│  └── Watch (Streaming): 상태 변경 시 자동 Push                 │
│      └── 효율적: 변경 시에만 네트워크 사용                     │
│                                                                 │
│  [K8s 1.24+ 네이티브 gRPC Probe]                                │
│                                                                 │
│  # Pod spec                                                     │
│  livenessProbe:                                                  │
│    grpc:                                                         │
│      port: 50051                                                 │
│      service: "my.package.MyService"  # 선택사항                │
│    initialDelaySeconds: 10                                       │
│    periodSeconds: 10                                             │
│                                                                 │
│  readinessProbe:                                                 │
│    grpc:                                                         │
│      port: 50051                                                 │
│    initialDelaySeconds: 5                                        │
│    periodSeconds: 5                                              │
│                                                                 │
│  → K8s 1.24 이전: grpc-health-probe 바이너리 필요              │
│  → K8s 1.24+: 네이티브 지원 (바이너리 불필요)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 21.5 Wait-for-Ready 시맨틱

```
┌─────────────────────────────────────────────────────────────────┐
│          Wait-for-Ready                                           │
│                                                                 │
│  [개념]                                                         │
│  ├── 채널이 TRANSIENT_FAILURE 상태일 때                         │
│  │   ├── 기본: 즉시 UNAVAILABLE 에러 반환                       │
│  │   └── wait-for-ready: 채널이 READY가 될 때까지 큐잉         │
│  ├── deadline은 여전히 적용됨                                   │
│  │   └── deadline 초과 시 DEADLINE_EXCEEDED 반환                │
│  └── 서비스 시작 순서에 의존하지 않는 설계 가능                │
│                                                                 │
│  [사용 예시]                                                    │
│                                                                 │
│  // Java                                                         │
│  stub.withWaitForReady()                                         │
│      .withDeadlineAfter(30, TimeUnit.SECONDS)                    │
│      .getData(request);                                          │
│                                                                 │
│  // Go                                                           │
│  grpc.WaitForReady(true)                                         │
│                                                                 │
│  [적합한 상황]                                                  │
│  ├── 서비스 시작 시 의존 서비스가 아직 준비 안 된 경우         │
│  ├── 일시적 네트워크 단절 후 자동 복구 기대                    │
│  └── 배치 작업 등 즉시 응답이 필요하지 않은 경우               │
│                                                                 │
│  [부적합한 상황]                                                │
│  ├── 사용자 대면 요청 (즉시 실패가 더 나은 UX)                 │
│  └── tight deadline이 있는 경우                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 21.6 Keepalive + MAX_CONNECTION_AGE

```
┌─────────────────────────────────────────────────────────────────┐
│          gRPC Keepalive & Connection Management                   │
│                                                                 │
│  [문제: K8s에서 gRPC Long-Lived 연결]                           │
│  ├── gRPC는 HTTP/2 기반 → 하나의 TCP 연결에 다중 스트림       │
│  ├── 연결이 오래 유지됨 → K8s Service 로드밸런싱 무력화        │
│  ├── 새 Pod 추가 시 트래픽 분배 안 됨                          │
│  └── 해결: MAX_CONNECTION_AGE로 주기적 연결 갱신               │
│                                                                 │
│  [서버 측 설정]                                                 │
│                                                                 │
│  GRPC_ARG_KEEPALIVE_TIME_MS        = 7200000  // 2시간          │
│  GRPC_ARG_KEEPALIVE_TIMEOUT_MS     = 20000    // 20초           │
│  GRPC_ARG_MAX_CONNECTION_AGE_MS    = 3600000  // 1시간          │
│  GRPC_ARG_MAX_CONNECTION_AGE_GRACE_MS = 5000  // 5초            │
│                                                                 │
│  [Keepalive PING 메커니즘]                                      │
│  ├── 클라이언트 → 서버: 주기적 HTTP/2 PING 프레임             │
│  ├── 서버 응답 없음 → 연결 끊김 감지                           │
│  ├── KEEPALIVE_TIMEOUT 내 응답 없으면 연결 종료                │
│  └── NAT/방화벽 유휴 타임아웃보다 짧게 설정                    │
│                                                                 │
│  [MAX_CONNECTION_AGE — +-10% Jitter 자동 적용]                  │
│  ├── 설정값: 3600초 → 실제: 3240~3960초 (랜덤)                │
│  ├── Jitter 목적: 모든 연결이 동시에 끊기는 것 방지            │
│  ├── AGE 도달 → GOAWAY 프레임 전송 → 클라이언트 재연결        │
│  └── GRACE 기간 동안 진행 중 RPC 완료 허용                     │
│                                                                 │
│  [K8s 환경 권장 설정]                                           │
│  ├── MAX_CONNECTION_AGE: 30분~1시간                             │
│  │   → Pod 스케일링 시 빠른 재분배                              │
│  ├── KEEPALIVE_TIME: 30초 (K8s 기본 유휴 타임아웃 고려)        │
│  └── Client-side LB (grpclb, xDS) 함께 사용 권장               │
│                                                                 │

└─────────────────────────────────────────────────────────────────┘
```

## 21.7 Resilience4j gRPC 통합

```
┌─────────────────────────────────────────────────────────────────┐
│          Resilience4j + gRPC 통합 패턴                            │
│                                                                 │
│  [ClientInterceptor 기반 통합]                                  │
│                                                                 │
│  gRPC Status Code → CB 실패 매핑:                               │
│  ┌──────────────────────┬──────────────┬──────────────────┐     │
│  │ gRPC Status Code     │ CB 실패 여부 │ 이유              │     │
│  ├──────────────────────┼──────────────┼──────────────────┤     │
│  │ OK                   │ 성공         │ 정상              │     │
│  │ UNAVAILABLE          │ 실패         │ 서비스 다운       │     │
│  │ DEADLINE_EXCEEDED    │ 실패         │ 타임아웃          │     │
│  │ INTERNAL             │ 실패         │ 서버 내부 오류    │     │
│  │ RESOURCE_EXHAUSTED   │ 실패         │ 과부하            │     │
│  │ INVALID_ARGUMENT     │ 성공         │ 클라이언트 오류   │     │
│  │ NOT_FOUND            │ 성공         │ 비즈니스 로직     │     │
│  │ PERMISSION_DENIED    │ 성공         │ 인증/인가 문제    │     │
│  │ UNAUTHENTICATED      │ 성공         │ 인증/인가 문제    │     │
│  └──────────────────────┴──────────────┴──────────────────┘     │
│                                                                 │
│  핵심: 서버 측 장애만 CB 실패로 간주,                           │
│        클라이언트 오류(4xx 계열)는 CB 실패에서 제외             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```java
// Resilience4j gRPC ClientInterceptor 구현
public class CircuitBreakerInterceptor implements ClientInterceptor {

    private final CircuitBreaker circuitBreaker;
    private static final Set<Status.Code> FAILURE_CODES = Set.of(
        Status.Code.UNAVAILABLE,
        Status.Code.DEADLINE_EXCEEDED,
        Status.Code.INTERNAL,
        Status.Code.RESOURCE_EXHAUSTED
    );

    @Override
    public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
            MethodDescriptor<ReqT, RespT> method,
            CallOptions callOptions,
            Channel next) {

        // CB 상태 확인 — OPEN이면 즉시 거부
        if (!circuitBreaker.tryAcquirePermission()) {
            throw Status.UNAVAILABLE
                .withDescription("CircuitBreaker is OPEN for "
                    + method.getFullMethodName())
                .asRuntimeException();
        }

        long startTime = System.nanoTime();

        return new ForwardingClientCall
                .SimpleForwardingClientCall<>(
                next.newCall(method, callOptions)) {
            @Override
            public void start(
                    Listener<RespT> responseListener,
                    Metadata headers) {
                super.start(
                    new ForwardingClientCallListener
                        .SimpleForwardingClientCallListener<>(
                            responseListener) {
                    @Override
                    public void onClose(
                            Status status,
                            Metadata trailers) {
                        long duration =
                            System.nanoTime() - startTime;
                        if (FAILURE_CODES.contains(
                                status.getCode())) {
                            circuitBreaker.onError(
                                duration,
                                TimeUnit.NANOSECONDS,
                                status.asRuntimeException()
                            );
                        } else {
                            circuitBreaker.onSuccess(
                                duration,
                                TimeUnit.NANOSECONDS
                            );
                        }
                        super.onClose(status, trailers);
                    }
                }, headers);
            }
        };
    }
}

// 사용
ManagedChannel channel = ManagedChannelBuilder
    .forAddress("localhost", 50051)
    .intercept(new CircuitBreakerInterceptor(circuitBreaker))
    .usePlaintext()
    .build();
```

## 21.8 gRPC Resilience 방식 비교

| 항목 | gRPC Built-in | Resilience4j | Istio/Envoy |
|------|---------------|-------------|-------------|
| **Retry** | Service Config JSON | RetryConfig | VirtualService retries |
| **CB** | 없음 (retryThrottling만) | CircuitBreakerConfig | outlierDetection |
| **Hedging** | hedgingPolicy | 없음 | 없음 (Mirror만) |
| **Timeout** | deadline | TimeLimiter | timeout |
| **Rate Limit** | 없음 | RateLimiterConfig | EnvoyFilter |
| **Bulkhead** | 없음 | BulkheadConfig | connectionPool |
| **Health Check** | grpc.health.v1 | HealthIndicator | DestinationRule |
| **설정 위치** | Service Config / 코드 | Java 코드 / YAML | K8s CRD |
| **장점** | 프로토콜 수준, 언어 무관 | 세밀한 제어, 풍부한 메트릭 | 코드 수정 없음, 인프라 수준 |
| **단점** | 제한적 (CB 없음) | Java/JVM 한정 | 운영 복잡성 |
| **권장 조합** | 기본으로 활성화 | 애플리케이션 레벨 보강 | 서비스 메시 전체 정책 |

---

# 22. Kotlin Coroutine 환경의 Resilience

Kotlin Coroutine은 비동기 프로그래밍의 새로운 패러다임을 제시한다. suspend 함수, Flow, 구조화된 동시성(Structured Concurrency)에서 Resilience 패턴을 올바르게 적용하려면 고유한 고려사항이 필요하다.

## 22.1 resilience4j-kotlin 모듈

```
┌─────────────────────────────────────────────────────────────────┐
│          resilience4j-kotlin — Coroutine 네이티브 확장            │
│                                                                 │
│  [핵심 확장 함수]                                                │
│  ├── executeSuspendFunction — suspend 함수 실행 + 패턴 적용    │
│  ├── decorateSuspendFunction — suspend 함수 데코레이팅          │
│  └── Flow 확장 연산자 — circuitBreaker, retry, rateLimiter,     │
│      timeLimiter 체이닝                                        │
│                                                                 │
│  [Cancellation 자동 처리]                                        │
│  ├── CancellationException 발생 시 permission 자동 해제        │
│  ├── CB 실패 카운트에 포함되지 않음                             │
│  └── Coroutine 취소 = 정상적인 제어 흐름 (예외가 아님)         │
│                                                                 │
│  [주의사항]                                                     │
│  ├── TimeLimiter = 내부적으로 withTimeout 래핑                  │
│  │   → Coroutine 환경에서는 직접 withTimeout 사용이             │
│  │     더 자연스러움                                            │
│  ├── Bulkhead maxWaitTime > 0 → Dispatchers.IO에서 블로킹!     │
│  │   → Semaphore 기반 구현 권장                                │
│  └── @CircuitBreaker 어노테이션은 suspend 미지원               │
│      (Issue #2153)                                               │
│      → AOP 프록시가 Coroutine Context 전파 못함                │
│      → 프로그래매틱 방식 사용 필수                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```kotlin
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import io.github.resilience4j.kotlin.retry.executeSuspendFunction
import io.github.resilience4j.kotlin.timelimiter.executeSuspendFunction
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.retry.Retry
import kotlinx.coroutines.flow.*

// suspend 함수 직접 실행
val circuitBreaker = CircuitBreaker.ofDefaults("paymentService")
val retry = Retry.ofDefaults("paymentRetry")

suspend fun callPaymentService(orderId: String): PaymentResult {
    return circuitBreaker.executeSuspendFunction {
        retry.executeSuspendFunction {
            paymentClient.processPayment(orderId)  // suspend 함수
        }
    }
}

// Flow 연산자 체이닝
fun observePayments(): Flow<Payment> {
    return paymentStream()
        .circuitBreaker(circuitBreaker)     // CB 적용
        .retry(retry)                        // Retry 적용
        .rateLimiter(rateLimiter)            // Rate Limit 적용
        .catch { e ->
            emit(Payment.fallback())         // Fallback
        }
}

// decorateSuspendFunction — 재사용 가능한 데코레이팅
val decoratedCall = circuitBreaker.decorateSuspendFunction {
    paymentClient.processPayment(it)
}

// 여러 곳에서 재사용
val result1 = decoratedCall("order-1")
val result2 = decoratedCall("order-2")

// 잘못된 사용: @CircuitBreaker 어노테이션 + suspend
// @CircuitBreaker(name = "payment")  // suspend에서 동작 안 함!
// suspend fun processPayment() { ... }
//
// 올바른 사용: 프로그래매틱 방식
suspend fun processPayment(): PaymentResult {
    return circuitBreaker.executeSuspendFunction {
        paymentClient.process()
    }
}
```

## 22.2 Ktor Client Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          Ktor Client — Built-in Resilience 플러그인               │
│                                                                 │
│  [HttpRequestRetry 플러그인 (built-in)]                          │
│  ├── retryOnServerErrors(maxRetries)                            │
│  ├── retryOnException(maxRetries, retryOnTimeout)               │
│  ├── exponentialDelay(base, maxDelayMs)                          │
│  ├── constantDelay(millis)                                      │
│  └── 커스텀 retryIf 조건                                       │
│                                                                 │
│  [HttpTimeout 플러그인 (built-in)]                               │
│  ├── requestTimeoutMillis                                       │
│  ├── connectTimeoutMillis                                       │
│  └── socketTimeoutMillis                                        │
│                                                                 │
│  [CB 지원 — extra-ktor-plugins (Flaxoos)]                       │
│  ├── 서드파티 Ktor 플러그인                                    │
│  ├── CircuitBreaker 플러그인 제공                               │
│  └── Resilience4j 대비 기능 제한적                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```kotlin
import io.ktor.client.*
import io.ktor.client.plugins.*

val client = HttpClient {
    // Built-in Retry
    install(HttpRequestRetry) {
        retryOnServerErrors(maxRetries = 3)
        retryOnException(maxRetries = 3, retryOnTimeout = true)
        exponentialDelay(base = 2.0, maxDelayMs = 10_000)

        // 커스텀 조건
        retryIf { request, response ->
            response.status.value == 429  // Too Many Requests
        }

        // 재시도 전 콜백
        modifyRequest { request ->
            request.headers.append(
                "X-Retry-Count", retryCount.toString()
            )
        }
    }

    // Built-in Timeout
    install(HttpTimeout) {
        requestTimeoutMillis = 15_000
        connectTimeoutMillis = 5_000
        socketTimeoutMillis = 10_000
    }
}
```

## 22.3 Spring WebFlux + Coroutine 통합

```
┌─────────────────────────────────────────────────────────────────┐
│          Spring WebFlux + Kotlin Coroutine Resilience             │
│                                                                 │
│  [자동 변환]                                                    │
│  ├── Mono <-> suspend 함수 (awaitSingle, awaitSingleOrNull)    │
│  ├── Flux <-> Flow (asFlow, asFlux)                             │
│  └── Spring이 내부적으로 Coroutine Bridge 제공                  │
│                                                                 │
│  [ReactiveCircuitBreaker vs executeSuspendFunction]              │
│  ┌────────────────────────┬─────────────────────────────┐       │
│  │ ReactiveCircuitBreaker │ executeSuspendFunction       │       │
│  ├────────────────────────┼─────────────────────────────┤       │
│  │ Mono/Flux 기반         │ suspend 기반                │       │
│  │ Reactor 의존           │ kotlinx.coroutines 의존     │       │
│  │ Spring Cloud CB 통합   │ resilience4j-kotlin 직접    │       │
│  │ AOP 가능               │ AOP 불가 (suspend)          │       │
│  │ 기존 WebFlux 코드 호환 │ Coroutine 우선 프로젝트     │       │
│  └────────────────────────┴─────────────────────────────┘       │
│                                                                 │
│  권장: 신규 프로젝트는 executeSuspendFunction,                   │
│        기존 WebFlux 마이그레이션은 ReactiveCircuitBreaker       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```kotlin
import org.springframework.web.reactive.function.server.coRouter
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction

// coRouter DSL — Coroutine 네이티브 라우팅
fun routes(handler: PaymentHandler) = coRouter {
    "/api/payments".nest {
        GET("/{id}", handler::getPayment)
        POST("/", handler::createPayment)
    }
}

// Handler — suspend 함수에서 Resilience4j 사용
@Component
class PaymentHandler(
    private val circuitBreaker: CircuitBreaker,
    private val paymentClient: PaymentClient,
) {
    suspend fun getPayment(
        request: ServerRequest
    ): ServerResponse {
        val paymentId = request.pathVariable("id")

        val payment = circuitBreaker.executeSuspendFunction {
            paymentClient.getPayment(paymentId)  // suspend 호출
        }

        return ServerResponse.ok().bodyValueAndAwait(payment)
    }
}

// WebClient + Coroutine 변환
val result: Payment = webClient.get()
    .uri("/api/payments/{id}", paymentId)
    .retrieve()
    .bodyToMono<Payment>()
    .transform(CircuitBreakerOperator.of(circuitBreaker))
    .awaitSingle()  // Mono -> suspend 변환
```

## 22.4 Kotlin 특화 Resilience 패턴

### sealed class로 ResilienceState 모델링

```kotlin
// Kotlin sealed class — CB 상태를 타입 안전하게 모델링
sealed class ResilienceState<out T> {
    data class Success<T>(val data: T) : ResilienceState<T>()
    data class Failure(
        val error: Throwable
    ) : ResilienceState<Nothing>()
    data class CircuitOpen(
        val fallback: Any?
    ) : ResilienceState<Nothing>()
    data class RateLimited(
        val retryAfterMs: Long
    ) : ResilienceState<Nothing>()
    data object Loading : ResilienceState<Nothing>()
}

// 패턴 매칭으로 처리
when (val state = fetchWithResilience()) {
    is ResilienceState.Success -> render(state.data)
    is ResilienceState.Failure -> showError(state.error)
    is ResilienceState.CircuitOpen -> showFallback(state.fallback)
    is ResilienceState.RateLimited -> retryAfter(state.retryAfterMs)
    is ResilienceState.Loading -> showSpinner()
}
```

### runCatching의 CancellationException 문제

```
┌─────────────────────────────────────────────────────────────────┐
│          runCatching + CancellationException 위험                 │
│                                                                 │
│  [문제]                                                         │
│  ├── runCatching { ... } 은 모든 Throwable을 잡음              │
│  ├── CancellationException도 잡혀서 Result.failure로 래핑      │
│  ├── Coroutine 취소가 전파되지 않음 → 구조화된 동시성 파괴     │
│  └── 부모 Coroutine이 취소를 인지 못함                         │
│                                                                 │
│  [해결: CancellationException 반드시 재던지기]                  │
│                                                                 │
│  // 위험: CancellationException 삼킴                             │
│  val result = runCatching { suspendFunction() }                  │
│                                                                 │
│  // 안전: CancellationException 재던지기                         │
│  suspend fun <T> runSuspendCatching(                             │
│      block: suspend () -> T                                      │
│  ): Result<T> {                                                  │
│      return try {                                                │
│          Result.success(block())                                 │
│      } catch (e: CancellationException) {                       │
│          throw e  // 반드시 재던지기!                             │
│      } catch (e: Throwable) {                                    │
│          Result.failure(e)                                       │
│      }                                                           │
│  }                                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Channel 기반 Rate Limiting & supervisorScope

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.*
import kotlinx.coroutines.sync.Semaphore

// Channel 기반 Rate Limiter (Token Bucket)
class CoroutineRateLimiter(
    private val permits: Int,
    private val periodMs: Long,
) {
    private val channel = Channel<Unit>(permits)

    init {
        CoroutineScope(Dispatchers.Default).launch {
            while (isActive) {
                repeat(permits) { channel.trySend(Unit) }
                delay(periodMs)
            }
        }
    }

    suspend fun acquire() { channel.receive() }
}

// supervisorScope = Bulkhead (장애 격리)
// 하나의 자식 실패가 다른 자식에 영향 안 줌
suspend fun processOrders(orders: List<Order>) {
    supervisorScope {
        orders.map { order ->
            async {
                try {
                    processOrder(order)
                } catch (e: Exception) {
                    logger.error("Order ${order.id} failed", e)
                    null  // 개별 실패 -> 다른 주문은 계속 처리
                }
            }
        }.awaitAll()
    }
}

// Semaphore 기반 Bulkhead (권장)
// Resilience4j ThreadPool Bulkhead 대체
val bulkhead = Semaphore(permits = 20)

suspend fun callWithBulkhead(request: Request): Response {
    bulkhead.withPermit {
        return apiClient.call(request)
    }
}
```

### withTimeout vs TimeLimiter 비교

| 항목 | withTimeout (Coroutine) | TimeLimiter (Resilience4j) |
|------|------------------------|---------------------------|
| **취소 방식** | CancellationException + 협력적 취소 | Future.cancel / withTimeout 래핑 |
| **Coroutine 호환** | 네이티브 | 래핑 필요 |
| **메트릭** | 직접 구현 필요 | Prometheus/Micrometer 내장 |
| **설정 관리** | 코드 하드코딩 | YAML/동적 설정 |
| **권장 사용처** | 단순 타임아웃 | 모니터링 필요, 중앙 관리 |

## 22.5 KMP(Kotlin Multiplatform) Resilience 대안

```
┌─────────────────────────────────────────────────────────────────┐
│          KMP Resilience 라이브러리 비교                            │
│                                                                 │
│  [Arrow Resilience]                                              │
│  ├── Arrow FP 생태계의 Resilience 모듈                          │
│  ├── Schedule API — 재시도 전략 조합                             │
│  │   ├── Schedule.recurs(5)                                     │
│  │   ├── Schedule.exponential(250.milliseconds)                 │
│  │   └── Schedule.recurs(5) and Schedule.exponential(...)       │
│  ├── protectOrThrow — 성공 또는 예외                             │
│  ├── protectEither — Either<Error, Success> 반환                │
│  └── KMP 지원 (JVM, Native, JS)                                │
│                                                                 │
│  [kmp-resilient]                                                 │
│  ├── 8가지 패턴: CB, Retry, Timeout, Bulkhead,                 │
│  │   Rate Limiter, Cache, Fallback, Hedge                      │
│  └── KMP 전용 설계                                              │
│                                                                 │
│  [Kresil]                                                        │
│  ├── Kotlin-first Resilience 라이브러리                         │
│  ├── CB, Retry, Rate Limiter                                    │
│  └── KMP 지원                                                   │
│                                                                 │
│  ┌───────────────┬──────────────┬──────────────┬─────────────┐  │
│  │ 항목          │ Arrow        │ kmp-resilient│ Kresil      │  │
│  ├───────────────┼──────────────┼──────────────┼─────────────┤  │
│  │ FP 스타일     │ Either/결과 │ 콜백         │ 혼합        │  │
│  │ CB 지원       │ Schedule     │ O            │ O           │  │
│  │ KMP 범위      │ 전체        │ 전체         │ JVM+Native  │  │
│  │ 커뮤니티      │ 대규모      │ 소규모       │ 소규모      │  │
│  │ 성숙도        │ 높음        │ 중간         │ 초기        │  │
│  └───────────────┴──────────────┴──────────────┴─────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```kotlin
// Arrow Resilience — Schedule API
import arrow.resilience.*
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

// 스케줄 조합: 5회 재시도 AND 지수 백오프
val schedule = Schedule.recurs<Throwable>(5) and
    Schedule.exponential<Throwable>(250.milliseconds, 2.0)

// retryOrElseRaise — 실패 시 예외
val result: String = schedule.retryOrElseRaise {
    httpClient.get("https://api.example.com/data").body()
}

// Either 기반 안전한 처리
val either: Either<Throwable, String> = either {
    schedule.retryRaise {
        httpClient.get("https://api.example.com/data")
            .body<String>()
    }
}
```

## 22.6 테스팅

```kotlin
import kotlinx.coroutines.test.*
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import app.cash.turbine.test

// runTest + TestDispatcher — Coroutine 시간 제어
@Test
fun `CB OPEN시 fallback 반환`() = runTest {
    val cb = CircuitBreaker.ofDefaults("test")

    // CB 강제 상태 전환 (테스트 헬퍼)
    cb.transitionToOpenState()

    val result = runCatching {
        cb.executeSuspendFunction { apiClient.call() }
    }

    assertTrue(result.isFailure)
    assertIs<CallNotPermittedException>(
        result.exceptionOrNull()
    )
}

// Turbine — Flow 테스트
@Test
fun `Flow에 CB 적용 시 상태 변화 검증`() = runTest {
    val cb = CircuitBreaker.of(
        "test",
        CircuitBreakerConfig.custom()
            .slidingWindowSize(3)
            .failureRateThreshold(66.0f)
            .build()
    )

    flowOf(1, 2, 3, 4, 5)
        .map {
            if (it <= 3) throw RuntimeException("fail")
            else it
        }
        .circuitBreaker(cb)
        .catch { /* 에러 무시 */ }
        .test {
            // CB가 OPEN되면 더 이상 emit 안 됨
            cancelAndIgnoreRemainingEvents()
        }

    assertEquals(CircuitBreaker.State.OPEN, cb.state)
}

// CB 강제 상태 전환 헬퍼
fun CircuitBreaker.forceOpen() = transitionToOpenState()
fun CircuitBreaker.forceClose() = transitionToClosedState()
fun CircuitBreaker.forceHalfOpen() = transitionToHalfOpenState()
```

---

# 23. 2025-2026 최신 Resilience 동향

Resilience Engineering은 빠르게 진화하고 있다. eBPF, WebAssembly, AI/LLM, Platform Engineering 등 최신 기술과의 융합이 가속화되고 있다.

## 23.1 eBPF 기반 Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          eBPF + Resilience — 커널 수준 제어                       │
│                                                                 │
│  [Cilium 1.16 — Gateway API 내장]                               │
│  ├── 2024년 AWS EKS 기본 CNI로 채택                             │
│  ├── L4 = eBPF (커널 공간) — kube-proxy 대체                   │
│  │   └── TCP/UDP 로드밸런싱, NAT 직접 처리                     │
│  ├── L7 = Envoy (유저스페이스) — HTTP/gRPC 라우팅              │
│  │   └── CB, Retry, Rate Limit 등 L7 정책                      │
│  ├── Gateway API 1.0 내장 — Ingress 대체 표준                  │
│  └── kube-proxy 제거 → 네트워크 성능 ~30% 향상                 │
│                                                                 │
│  [계층 분리 — L4 eBPF + L7 Envoy]                               │
│                                                                 │
│   요청 흐름:                                                    │
│   Client → [eBPF L4] → [Envoy L7] → Service                    │
│                │             │                                  │
│                │             ├── Circuit Breaker                 │
│                │             ├── Retry Policy                    │
│                │             ├── Rate Limiting                   │
│                │             └── Health Checking                 │
│                │                                                │
│                ├── Connection Tracking                           │
│                ├── Load Balancing (DNAT)                         │
│                ├── Network Policy (필터링)                       │
│                └── 대부분의 L4 트래픽은 커널에서 처리            │
│                    → Envoy 바이패스 가능 → 오버헤드 최소화      │
│                                                                 │
│  [Tetragon — 런타임 보안 + 옵저버빌리티]                        │
│  ├── eBPF 기반 런타임 보안 관찰                                │
│  ├── 프로세스 실행, 파일 접근, 네트워크 이벤트 추적            │
│  ├── 보안 이벤트 → Resilience 판단에 활용 가능                 │
│  └── "이 서비스가 공격받고 있는가?" 실시간 감지               │
│                                                                 │
│  [bpf_circuit_breaker — 사용자 정의 eBPF CB]                    │
│  ├── BPF Map에 실패 카운트, 상태 저장                           │
│  ├── XDP/TC 훅에서 패킷 수준 CB 구현                           │
│  ├── 유저스페이스 프록시 없이 커널에서 직접 차단               │
│  └── 연구/실험 단계 — 프로덕션 사례 제한적                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.2 WebAssembly(Wasm) 기반 Resilience 확장

```
┌─────────────────────────────────────────────────────────────────┐
│          Proxy-Wasm — 프록시 확장 표준                            │
│                                                                 │
│  [Proxy-Wasm v0.2.1 Specification]                               │
│  ├── 30+ 언어에서 Wasm으로 컴파일 가능                          │
│  │   (Rust, Go, C/C++, AssemblyScript, Zig 등)                 │
│  ├── 샌드박스 격리 — 프록시 크래시 방지                        │
│  ├── 핫 리로드 — 프록시 재시작 없이 필터 교체                  │
│  └── Envoy, NGINX, Istio에서 지원                               │
│                                                                 │
│  [Resilience 확장 사례]                                          │
│                                                                 │
│  sentinel-go-envoy-proxy-wasm:                                   │
│  ├── Alibaba Sentinel의 Go 구현을 Wasm으로 컴파일              │
│  ├── Envoy 사이드카에 로드                                     │
│  ├── 커스텀 Rate Limiting, Flow Control 구현                    │
│  └── 프록시 수준에서 애플리케이션 로직 실행                    │
│                                                                 │
│  [장점]                                                         │
│  ├── 언어 무관 — Rust로 작성, 모든 프록시에서 실행             │
│  ├── 안전 — 샌드박스 내 실행, 메모리 격리                      │
│  ├── 성능 — 네이티브에 가까운 실행 속도                        │
│  └── 유연 — Envoy 내장 필터로 불가능한 커스텀 로직 가능        │
│                                                                 │
│  [아키텍처]                                                     │
│                                                                 │
│  ┌────────────────────────────────────────────────┐              │
│  │ Envoy Proxy                                     │              │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│              │
│  │ │ HTTP     │→│ Wasm     │→│ Upstream         ││              │
│  │ │ Listener │ │ Filter   │ │ Cluster          ││              │
│  │ │          │ │ (CB/RL)  │ │                  ││              │
│  │ └──────────┘ └──────────┘ └──────────────────┘│              │
│  │               ↑ Wasm VM                         │              │
│  │               │ (V8/Wasmtime)                   │              │
│  └────────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.3 AI/LLM 서비스 Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          AI/LLM 서비스 Resilience — 2025-2026 핵심 과제           │
│                                                                 │
│  [복합 Rate Limit 체계]                                          │
│  ├── RPM (Requests Per Minute) — 요청 횟수 제한                │
│  ├── TPM (Tokens Per Minute) — 총 토큰 제한                    │
│  ├── ITPM (Input Tokens Per Minute) — 입력 토큰 제한           │
│  ├── OTPM (Output Tokens Per Minute) — 출력 토큰 제한          │
│  └── 4가지 제한 중 하나라도 초과하면 429 에러                  │
│                                                                 │
│  기존 HTTP API: 1차원 Rate Limit (RPM만)                        │
│  LLM API: 4차원 Rate Limit → 훨씬 복잡한 제어 필요            │
│                                                                 │
│  [Token Budget Management]                                       │
│  ├── tiktoken 등으로 사전 토큰 수 계산                          │
│  ├── 요청 전 토큰 예산 확인 → 초과 시 대기/분할               │
│  ├── Sliding Window로 분당 토큰 사용량 추적                    │
│  └── 입력/출력 비율 예측 기반 예산 배분                        │
│                                                                 │
│  [다중 제공업체 Circuit Breaker]                                │
│                                                                 │
│   요청 → CB(OpenAI) ─── OPEN ──→ CB(Anthropic) ─── OPEN ──→   │
│          │                        │                              │
│          └── CLOSED → OpenAI      └── CLOSED → Anthropic        │
│                                                                  │
│          모두 OPEN → 로컬 모델 (Ollama/vLLM) Fallback           │
│                                                                 │
│  가용성 비교:                                                   │
│  ├── 단일 제공업체: 99.7% uptime                                │
│  └── 다중 제공업체 CB: 99.99%+ uptime (이론적)                  │
│      실측: 88.3% (단일) → 99.7% (다중 CB 적용)                 │
│                                                                 │
│  [Prompt Caching — GPU 과부하 완화]                              │
│  ├── 동일/유사 프롬프트의 KV Cache 재사용                      │
│  ├── 시스템 프롬프트 캐싱 → 비용 50~90% 절감                  │
│  ├── GPU 연산 부하 감소 → Rate Limit 여유 확보                 │
│  └── Anthropic Prompt Caching, OpenAI Predicted Outputs         │
│                                                                 │
│  [LiteLLM — 통합 LLM Gateway]                                   │
│  ├── 470K+ 월간 다운로드                                       │
│  ├── 100+ LLM 단일 인터페이스 (OpenAI 호환 API)                │
│  ├── 내장 Resilience:                                           │
│  │   ├── Load Balancing (Round Robin, Least Connection)         │
│  │   ├── Retry (provider 간 자동 전환)                          │
│  │   ├── Rate Limit 관리 (Redis 기반)                           │
│  │   └── Fallback Chain                                         │
│  └── Budget Manager — 비용 제한                                │
│                                                                 │
│  [GPU 서비스 레이어드 방어]                                      │
│                                                                 │
│   Layer 1: API Gateway Rate Limit (RPM/TPM)                     │
│      ↓                                                          │
│   Layer 2: Token Budget Manager (사전 토큰 검증)                │
│      ↓                                                          │
│   Layer 3: Circuit Breaker (제공업체별)                          │
│      ↓                                                          │
│   Layer 4: Queue + Priority (요청 우선순위 관리)                │
│      ↓                                                          │
│   Layer 5: Prompt Caching (GPU 부하 감소)                       │
│      ↓                                                          │
│   Layer 6: Fallback (다른 모델/제공업체/로컬)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.4 Platform Engineering과 Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          Platform Engineering — Resilience 민주화                 │
│                                                                 │
│  [Backstage Golden Path Templates]                               │
│  ├── 새 서비스 생성 시 Resilience 패턴 기본 포함:              │
│  │   ├── Canary Deployment 설정                                │
│  │   ├── OpenTelemetry 계측                                    │
│  │   ├── Circuit Breaker 기본 설정                              │
│  │   ├── Retry + Timeout 기본값                                │
│  │   ├── Health Check 엔드포인트                                │
│  │   └── Grafana 대시보드 템플릿                                │
│  ├── 개발자가 Resilience를 "선택"하는 게 아니라                │
│  │   "기본으로 제공"받는 구조                                  │
│  └── IDP (Internal Developer Platform) 표준화                  │
│                                                                 │
│  [Golden Path 효과]                                              │
│  ├── Before: 팀별 Resilience 구현 편차 → 장애 취약점 발생     │
│  └── After: 조직 전체 일관된 Resilience 수준 보장              │
│                                                                 │
│  [Self-Service Resilience Configuration]                         │
│  ├── 개발자 포털에서 CB 임계값 조정                             │
│  ├── PR 기반 설정 변경 + 자동 검증                             │
│  └── Guardrails: 위험한 설정 자동 차단                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.5 ML 기반 프로액티브 Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────┐
│          Proactive Circuit Breaker — ML 예측 기반                 │
│          참고: arXiv 2503.13195 (2025)                           │
│                                                                 │
│  [기존 CB의 한계]                                                │
│  ├── Reactive: 장애 발생 후 감지 → 이미 일부 요청 실패        │
│  ├── Sliding Window 기반 → 과거 데이터로 현재 판단             │
│  └── 임계값 정적 → 트래픽 패턴 변화에 적응 못함               │
│                                                                 │
│  [ML 기반 Proactive CB]                                          │
│  ├── 예측 기반 이상 감지 (Anomaly Detection)                   │
│  │   ├── 응답 시간 분포 변화 감지 (p50, p95, p99 추이)        │
│  │   ├── 오류율 추세 분석 (미분값 기반)                        │
│  │   └── 장애 발생 전 CB OPEN (선제적 차단)                    │
│  │                                                              │
│  ├── Ground Truth CB 패턴                                       │
│  │   ├── 서로게이트 모델: 경량 ML 모델이 서비스 상태 예측     │
│  │   ├── Health Score: 0.0~1.0 실수                             │
│  │   │   (이진 OPEN/CLOSED 대신)                                │
│  │   └── 점진적 트래픽 조절 (0.7이면 30% 차단)                │
│  │                                                              │
│  └── LSTM 기반 실패 감지기                                      │
│      ├── 시계열 메트릭 입력                                     │
│      │   (latency, error_rate, cpu, memory)                     │
│      ├── 다음 N분의 장애 확률 예측                              │
│      ├── 확률 > 임계값 → CB 사전 OPEN                          │
│      └── 학습 데이터: 과거 장애 이력 (Post-Mortem 기반)        │
│                                                                 │
│  [Proactive CB 아키텍처]                                         │
│                                                                 │
│  Metrics ──► Feature ──► ML Model ──► Health ──► CB             │
│  (실시간)    Pipeline    (LSTM/IF)    Score     (점진적)        │
│                  │                    (0.0~1.0)                  │
│                  ├── latency_p99                                  │
│                  ├── error_rate_5m                                │
│                  ├── cpu_utilization                              │
│                  ├── memory_pressure                              │
│                  ├── queue_depth                                  │
│                  └── gc_pause_time                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.6 OpenTelemetry + Resilience4j 통합

```
┌─────────────────────────────────────────────────────────────────┐
│          OTel + Resilience4j — 메트릭과 트레이스 연결             │
│                                                                 │
│  [Exemplars — 메트릭 → 트레이스 연결]                            │
│  ├── 메트릭 데이터 포인트에 Trace ID 첨부                      │
│  ├── "실패율이 50% 초과" →                                     │
│  │   해당 시점 실패 트레이스 즉시 확인                         │
│  ├── Prometheus + Grafana Tempo/Jaeger 연동                     │
│  └── 메트릭 대시보드 → 클릭 → 구체적 트레이스                 │
│                                                                 │
│  [Issue #2283 — 메트릭 설명 충돌 문제]                           │
│  ├── Resilience4j 자체 메트릭 설명과 OTel 설명이 충돌          │
│  ├── MeterRegistry 등록 시 description 불일치 경고             │
│  └── 해결: OTel SDK 측 description 우선 또는                   │
│      커스텀 MeterFilter                                         │
│                                                                 │
│  [통합 아키텍처]                                                │
│                                                                 │
│   Application                                                    │
│   ├── Resilience4j (CB/Retry/Bulkhead)                           │
│   │   └── Micrometer Metrics                                     │
│   │       └── OTel Meter Provider                                │
│   │           ├── Metrics → Prometheus (+ Exemplars)             │
│   │           └── Traces → Jaeger/Tempo                          │
│   └── OTel Instrumentation                                       │
│       └── Span 자동 생성                                         │
│           ├── CB state transition → Span Event                   │
│           ├── Retry attempt → Span Event                         │
│           └── Bulkhead rejection → Span Attribute                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.7 Serverless Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│          Serverless Resilience — 2025-2026                        │
│                                                                 │
│  [Lambda Powertools]                                             │
│  ├── Idempotency — DynamoDB 기반 멱등성 보장                   │
│  │   ├── @idempotent 데코레이터 (Python)                       │
│  │   ├── idempotency_key 자동 생성                              │
│  │   └── TTL 기반 자동 만료                                    │
│  ├── Batch Processing — 부분 실패 처리                          │
│  │   ├── SQS Batch에서 일부 실패 시 실패 건만 재처리          │
│  │   └── bisect_batch_on_function_error                         │
│  └── Parameters — SSM/Secrets Manager 캐싱 + 재시도           │

│                                                                 │
│  [Step Functions — 오케스트레이션 수준 Resilience]               │
│  ├── Saga 패턴: 보상 트랜잭션 자동 실행                        │
│  ├── Retry 내장: maxAttempts, backoffRate, interval             │
│  ├── Catch: 특정 에러 타입별 분기                               │
│  ├── Timeout: HeartbeatSeconds, TimeoutSeconds                   │
│  └── Circuit Breaker: Step Functions으로 구현 가능              │
│      (실패 횟수 DynamoDB 추적 → Choice State 분기)             │
│                                                                 │
│  [SnapStart 2.0 — Cold Start 완화]                               │
│  ├── Java (GA since 2022) → Python, .NET 확장 (2025)           │
│  ├── Firecracker microVM 스냅샷 기반                            │
│  ├── 초기화 시간: ~5초 → ~200ms (Java Spring)                  │
│  ├── Resilience 영향:                                           │
│  │   ├── Cold Start 감소 → Timeout 임계값 낮출 수 있음         │
│  │   ├── 스케일링 속도 향상 → Bulkhead 여유 증가              │
│  │   └── 주의: 스냅샷 후 연결 재수립 필요 (DB, Cache)         │
│  └── Provisioned Concurrency 비용 절감 효과                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 23.8 2025-2026 Resilience 연대표

```
┌─────────────────────────────────────────────────────────────────┐
│          2025-2026 Resilience Engineering 연대표                   │
│                                                                 │
│  2024 Q4                                                         │
│  ├── Cilium 1.16 릴리스 (Gateway API 내장)                      │
│  ├── AWS EKS Cilium CNI 기본 채택                               │
│  └── Resilience4j 2.3.x 안정화                                  │
│                                                                 │
│  2025 Q1                                                         │
│  ├── Proxy-Wasm v0.2.1 스펙 안정화                              │
│  ├── LiteLLM 1.x GA (LLM Gateway 표준화)                       │
│  ├── ML 기반 Proactive CB 논문 발표 (arXiv 2503.13195)         │
│  └── Lambda SnapStart Python/.NET 지원 시작                     │
│                                                                 │
│  2025 Q2-Q3                                                      │
│  ├── OTel + Resilience4j Exemplars 통합 안정화                  │
│  ├── Backstage Golden Path에 Resilience 템플릿 표준화          │
│  ├── eBPF 기반 L4 CB 실험적 구현 등장                          │
│  └── AI/LLM 다중 제공업체 CB 패턴 보편화                      │
│                                                                 │
│  2025 Q4 - 2026 Q1                                               │
│  ├── LSTM 기반 Proactive CB 프로덕션 사례 등장                 │
│  ├── Wasm 기반 Resilience 필터 프로덕션 배포 증가              │
│  ├── Platform Engineering IDP에 Resilience 기본 통합           │
│  └── Kubernetes Gateway API + Resilience 정책 통합             │
│                                                                 │
│  [핵심 트렌드 요약]                                              │
│  ├── 1. 인프라 수준 Resilience (eBPF, Wasm)                    │
│  │      ← 코드 수정 최소                                       │
│  ├── 2. AI/LLM 특화 패턴                                       │
│  │      (복합 Rate Limit, 다중 제공업체)                       │
│  ├── 3. 예측 기반 Proactive (ML/LSTM → 사전 차단)              │
│  ├── 4. Platform Engineering                                    │
│  │      (Golden Path → 기본 제공)                              │
│  └── 5. 관측 가능성 통합                                       │
│         (OTel + Resilience 메트릭 일체화)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 24. 실전 모니터링 대시보드 구성 상세

Resilience 패턴의 효과를 극대화하려면 정밀한 모니터링이 필수이다. 이 섹션에서는 Resilience4j 메트릭 레퍼런스, Grafana 패널 구성, PromQL 쿼리, AlertManager 규칙, 분산 트레이싱 통합, Runbook까지 실전에서 필요한 모든 것을 다룬다.

## 24.1 Resilience4j 전체 메트릭 레퍼런스

```
┌─────────────────────────────────────────────────────────────────┐
│          Resilience4j 메트릭 전체 목록                             │
│                                                                 │
│  [Circuit Breaker — 9개 메트릭]                                  │
│  ┌──────────────────────────────────────────────┬──────────┐    │
│  │ 메트릭 이름                                  │ 타입     │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ resilience4j_circuitbreaker_state            │ Gauge    │    │
│  │  └ state: closed=0, open=1, half_open=2,    │          │    │
│  │    disabled=3, forced_open=4, metrics_only=5 │          │    │
│  │ resilience4j_circuitbreaker_calls_seconds    │ Timer    │    │
│  │  └ kind: successful, failed, ignored,       │          │    │
│  │    not_permitted                              │          │    │
│  │ resilience4j_circuitbreaker_not_permitted     │          │    │
│  │  _calls_total                                │ Counter  │    │
│  │ resilience4j_circuitbreaker_failure_rate     │ Gauge    │    │
│  │ resilience4j_circuitbreaker_slow_call_rate   │ Gauge    │    │
│  │ resilience4j_circuitbreaker_buffered_calls   │ Gauge    │    │
│  │ resilience4j_circuitbreaker_slow_calls       │ Gauge    │    │
│  │ resilience4j_circuitbreaker_failed_calls     │ Gauge    │    │
│  │ resilience4j_circuitbreaker_successful_calls │ Gauge    │    │
│  └──────────────────────────────────────────────┴──────────┘    │
│                                                                 │
│  [Retry — 4개 kind]                                              │
│  ┌──────────────────────────────────────────────┬──────────┐    │
│  │ 메트릭 이름                                  │ 타입     │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ resilience4j_retry_calls_total               │ Counter  │    │
│  │  └ kind: successful_without_retry,           │          │    │
│  │    successful_with_retry,                     │          │    │
│  │    failed_without_retry,                      │          │    │
│  │    failed_with_retry                          │          │    │
│  └──────────────────────────────────────────────┴──────────┘    │
│                                                                 │
│  [Bulkhead — Semaphore / ThreadPool]                             │
│  ┌──────────────────────────────────────────────┬──────────┐    │
│  │ Semaphore Bulkhead                            │ 타입     │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ resilience4j_bulkhead_available               │          │    │
│  │  _concurrent_calls                           │ Gauge    │    │
│  │ resilience4j_bulkhead_max_allowed             │          │    │
│  │  _concurrent_calls                           │ Gauge    │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ ThreadPool Bulkhead                           │ 타입     │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ resilience4j_bulkhead_queue_depth            │ Gauge    │    │
│  │ resilience4j_bulkhead_queue_capacity         │ Gauge    │    │
│  │ resilience4j_bulkhead_thread_pool_size       │ Gauge    │    │
│  │ resilience4j_bulkhead_core_thread_pool_size  │ Gauge    │    │
│  │ resilience4j_bulkhead_max_thread_pool_size   │ Gauge    │    │
│  │ resilience4j_bulkhead_active_thread_count    │ Gauge    │    │
│  └──────────────────────────────────────────────┴──────────┘    │
│                                                                 │
│  [RateLimiter]                                                   │
│  ┌──────────────────────────────────────────────┬──────────┐    │
│  │ 메트릭 이름                                  │ 타입     │    │
│  ├──────────────────────────────────────────────┼──────────┤    │
│  │ resilience4j_ratelimiter_available            │          │    │
│  │  _permissions                                │ Gauge    │    │
│  │ resilience4j_ratelimiter_waiting_threads     │ Gauge    │    │
│  └──────────────────────────────────────────────┴──────────┘    │
│                                                                 │
│  [Custom Tags 전략]                                              │
│  ├── application: 서비스 이름                                  │
│  ├── environment: prod / staging / dev                          │
│  ├── region: ap-northeast-2 / us-east-1                        │
│  └── 설정: MeterRegistryCustomizer에서 commonTags() 추가      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 24.2 Grafana 패널 구성

```
┌─────────────────────────────────────────────────────────────────┐
│          Grafana 대시보드 패널 구성                                │
│                                                                 │
│  [Row 1: Circuit Breaker 상태 Overview]                          │
│  ┌──────────────┬──────────────┬──────────────────────────────┐ │
│  │ State        │ Failure Rate │ Calls per Second             │ │
│  │ Timeline     │ Gauge        │ Time Series                  │ │
│  │              │              │                              │ │
│  │ CLOSED       │   ┌───┐     │                              │ │
│  │ OPEN         │   │47%│     │  ~~ successful ~~            │ │
│  │ HALF_OPEN    │   └───┘     │  ~~ failed ~~                │ │
│  │              │ Threshold:  │  ~~ not_permitted ~~          │ │
│  │ (서비스별    │ 50% 빨강    │                              │ │
│  │  색상 구분)  │ 30% 노랑    │                              │ │
│  └──────────────┴──────────────┴──────────────────────────────┘ │
│                                                                 │
│  [Row 2: Retry & Bulkhead]                                       │
│  ┌──────────────────────────────┬────────────────────────────┐  │
│  │ Retry Outcomes               │ Bulkhead Utilization       │  │
│  │ Pie Chart                    │ Bar Gauge                  │  │
│  │                              │                            │  │
│  │   72% no retry               │ paymentPool   ████████░░  │  │
│  │   18% retry success          │ inventoryPool ██████░░░░  │  │
│  │    7% retry failed           │ searchPool    ████░░░░░░  │  │
│  │    3% no retry fail          │                            │  │
│  │                              │ 80% 노랑, 95% 빨강 임계값 │  │
│  └──────────────────────────────┴────────────────────────────┘  │
│                                                                 │
│  [Row 3: Rate Limiter & Response Time]                           │
│  ┌──────────────────────────────┬────────────────────────────┐  │
│  │ RateLimiter Permissions      │ Average Response Time      │  │
│  │ Time Series                  │ Time Series + Threshold    │  │
│  │                              │                            │  │
│  │ — available_permissions      │ — avg_response_ms          │  │
│  │ — waiting_threads            │ .. slow_call_threshold     │  │
│  └──────────────────────────────┴────────────────────────────┘  │
│                                                                 │
│  [Template Variables 설정]                                       │
│  ├── $application: label_values(                                │
│  │   resilience4j_circuitbreaker_state, application)           │
│  ├── $environment: label_values(environment)                    │
│  ├── $cb_name: label_values(                                    │
│  │   resilience4j_circuitbreaker_state{                         │
│  │     application="$application"}, name)                      │
│  └── $interval: 1m, 5m, 15m, 1h                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 24.3 검증된 PromQL 쿼리 13개

```
┌─────────────────────────────────────────────────────────────────┐
│          PromQL 쿼리 레퍼런스                                      │
│                                                                 │
│  [1] CB 상태 인코딩 (State Timeline 패널용)                      │
│                                                                 │
│  resilience4j_circuitbreaker_state{                              │
│    application="$application",                                   │
│    name="$cb_name"                                               │
│  }                                                               │
│  # 반환: 0=CLOSED, 1=OPEN, 2=HALF_OPEN,                         │
│  #       3=DISABLED, 4=FORCED_OPEN, 5=METRICS_ONLY              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [2] 실패율 (Failure Rate)                                       │
│                                                                 │
│  resilience4j_circuitbreaker_failure_rate{                       │
│    application="$application",                                   │
│    name="$cb_name"                                               │
│  }                                                               │
│  # -1 = 최소 호출 수 미달 (아직 판단 불가)                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [3] 성공 호출률 (rate)                                          │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_calls_seconds_count{              │
│      application="$application",                                 │
│      name="$cb_name",                                            │
│      kind="successful"                                           │
│    }[$interval]                                                  │
│  ))                                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [4] 실패 호출률 (rate)                                          │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_calls_seconds_count{              │
│      application="$application",                                 │
│      name="$cb_name",                                            │
│      kind="failed"                                               │
│    }[$interval]                                                  │
│  ))                                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [5] 무시된 호출률                                               │
│  (ignored — CB에 영향 안 주는 예외)                              │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_calls_seconds_count{              │
│      application="$application",                                 │
│      name="$cb_name",                                            │
│      kind="ignored"                                              │
│    }[$interval]                                                  │
│  ))                                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [6] 차단된 호출률 (not_permitted — CB OPEN)                     │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_not_permitted_calls_total{        │
│      application="$application",                                 │
│      name="$cb_name"                                             │
│    }[$interval]                                                  │
│  ))                                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [7] Retry Storm 감지                                            │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_retry_calls_total{                               │
│      application="$application",                                 │
│      kind=~"successful_with_retry|failed_with_retry"             │
│    }[$interval]                                                  │
│  ))                                                              │
│  /                                                               │
│  sum(rate(                                                       │
│    resilience4j_retry_calls_total{                               │
│      application="$application"                                  │
│    }[$interval]                                                  │
│  ))                                                              │
│  # 결과 > 0.5 → Retry Storm 의심                                │
│  # (50% 이상 재시도 발생)                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [8] Bulkhead 사용률                                             │
│                                                                 │
│  1 - (                                                           │
│    resilience4j_bulkhead_available_concurrent_calls{             │
│      application="$application",                                 │
│      name="$cb_name"                                             │
│    }                                                             │
│    /                                                             │
│    resilience4j_bulkhead_max_allowed_concurrent_calls{           │
│      application="$application",                                 │
│      name="$cb_name"                                             │
│    }                                                             │
│  )                                                               │
│  # 결과: 0.0 (여유) ~ 1.0 (포화)                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [9] RateLimiter 잔여 Permission                                 │
│                                                                 │
│  resilience4j_ratelimiter_available_permissions{                 │
│    application="$application",                                   │
│    name="$cb_name"                                               │
│  }                                                               │
│  # 0에 가까우면 Rate Limit 임박                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [10] 평균 응답 시간 (ms)                                        │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_calls_seconds_sum{                │
│      application="$application",                                 │
│      name="$cb_name",                                            │
│      kind="successful"                                           │
│    }[$interval]                                                  │
│  ))                                                              │
│  /                                                               │
│  sum(rate(                                                       │
│    resilience4j_circuitbreaker_calls_seconds_count{              │
│      application="$application",                                 │
│      name="$cb_name",                                            │
│      kind="successful"                                           │
│    }[$interval]                                                  │
│  )) * 1000                                                       │
│  # 초 → 밀리초 변환                                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [11] Slow Call Rate                                              │
│                                                                 │
│  resilience4j_circuitbreaker_slow_call_rate{                    │
│    application="$application",                                   │
│    name="$cb_name"                                               │
│  }                                                               │
│  # slowCallDurationThreshold 초과 비율                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [12] Retry 소진율 (최대 재시도 후 최종 실패)                    │
│                                                                 │
│  sum(rate(                                                       │
│    resilience4j_retry_calls_total{                               │
│      application="$application",                                 │
│      kind="failed_with_retry"                                    │
│    }[$interval]                                                  │
│  ))                                                              │
│  /                                                               │
│  sum(rate(                                                       │
│    resilience4j_retry_calls_total{                               │
│      application="$application",                                 │
│      kind=~".*_with_retry"                                       │
│    }[$interval]                                                  │
│  ))                                                              │
│  # 결과 > 0.7 → 재시도가 도움이 안 되는 상황                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [13] RateLimiter 대기 스레드 추이                                │
│                                                                 │
│  resilience4j_ratelimiter_waiting_threads{                       │
│    application="$application",                                   │
│    name="$cb_name"                                               │
│  }                                                               │
│  # 지속적 증가 → Rate Limit 설정 검토 필요                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 24.4 AlertManager 규칙 9개

```yaml
# Resilience4j AlertManager Rules
groups:
  - name: resilience4j_alerts
    rules:

      # [1] CB OPEN — Critical
      - alert: CircuitBreakerOpen
        expr: resilience4j_circuitbreaker_state == 1
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: >-
            Circuit Breaker OPEN: {{ $labels.name }}
          description: >-
            서비스 {{ $labels.application }}의
            CB {{ $labels.name }}가
            OPEN 상태입니다.
            다운스트림 서비스 장애가 의심됩니다.
          runbook_url: >-
            https://wiki.example.com/runbook/cb-open

      # [2] CB HALF_OPEN 장기 지속 — Warning
      - alert: CircuitBreakerHalfOpenProlonged
        expr: resilience4j_circuitbreaker_state == 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: >-
            Circuit Breaker HALF_OPEN 5분 이상:
            {{ $labels.name }}
          description: >-
            HALF_OPEN 상태가 5분 이상 지속됩니다.
            다운스트림이 불안정하거나
            permittedNumberOfCallsInHalfOpenState가
            너무 높게 설정되어 있을 수 있습니다.

      # [3] 실패율 급증 (50%) — Warning
      - alert: HighFailureRate
        expr: >-
          resilience4j_circuitbreaker_failure_rate > 50
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: >-
            실패율 50% 초과: {{ $labels.name }}
            ({{ $value }}%)

      # [4] 실패율 위험 (80%) — Critical
      - alert: CriticalFailureRate
        expr: >-
          resilience4j_circuitbreaker_failure_rate > 80
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: >-
            실패율 80% 초과: {{ $labels.name }}
            ({{ $value }}%)

      # [5] Slow Call Rate 급증 — Warning
      - alert: HighSlowCallRate
        expr: >-
          resilience4j_circuitbreaker_slow_call_rate > 50
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: >-
            느린 호출 비율 50% 초과: {{ $labels.name }}
          description: >-
            다운스트림 응답 지연이 심해지고 있습니다.
            Timeout 설정과 다운스트림 상태를 확인하세요.

      # [6] Retry Storm 감지 — Warning
      - alert: RetryStorm
        expr: >-
          sum(rate(
            resilience4j_retry_calls_total{
              kind=~".*_with_retry"
            }[5m]
          )) by (application)
          /
          sum(rate(
            resilience4j_retry_calls_total[5m]
          )) by (application)
          > 0.5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: >-
            Retry Storm 감지: {{ $labels.application }}
          description: >-
            전체 요청의 50% 이상이 재시도되고 있습니다.
            다운스트림 장애 시 재시도가 부하를
            가중시킬 수 있습니다.

      # [7] Retry 소진 — Critical
      - alert: RetryExhaustion
        expr: >-
          sum(rate(
            resilience4j_retry_calls_total{
              kind="failed_with_retry"
            }[5m]
          )) by (application)
          /
          sum(rate(
            resilience4j_retry_calls_total{
              kind=~".*_with_retry"
            }[5m]
          )) by (application)
          > 0.7
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: >-
            Retry 소진: {{ $labels.application }}
          description: >-
            재시도 후에도 70% 이상 실패합니다.
            재시도가 문제 해결에 도움이 되지 않는
            상황입니다.
            CB가 OPEN되어야 할 수 있습니다.

      # [8] Bulkhead 임박 — Warning
      - alert: BulkheadNearExhaustion
        expr: >-
          1 - (
            resilience4j_bulkhead_available_concurrent_calls
            /
            resilience4j_bulkhead_max_allowed_concurrent_calls
          ) > 0.8
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: >-
            Bulkhead 사용률 80% 초과: {{ $labels.name }}

      # [9] RateLimiter 대기 스레드 증가 — Warning
      - alert: RateLimiterWaitingThreads
        expr: >-
          resilience4j_ratelimiter_waiting_threads > 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: >-
            RateLimiter 대기 스레드
            {{ $value }}개: {{ $labels.name }}
          description: >-
            Rate Limit에 걸린 대기 스레드가
            증가하고 있습니다.
            Rate Limit 설정 상향 또는
            요청 패턴 검토가 필요합니다.
```

## 24.5 Distributed Tracing 통합

```
┌─────────────────────────────────────────────────────────────────┐
│          Spring Boot 3 + Micrometer Tracing + OTel                │
│                                                                 │
│  [의존성]                                                        │
│  ├── micrometer-tracing-bridge-otel                              │
│  ├── opentelemetry-exporter-otlp                                 │
│  └── resilience4j-micrometer                                     │
│                                                                 │
│  [자동 계측]                                                     │
│  Spring Boot 3 + Micrometer Tracing 조합 시:                    │
│  ├── HTTP 요청 → 자동 Span 생성                                │
│  ├── Resilience4j 메트릭 → 자동 수집                           │
│  └── Trace ID가 로그에 자동 삽입 (MDC)                          │
│                                                                 │
│  [한계: Resilience4j 이벤트 → Span 연결은 수동]                │
│  ├── CB 상태 전환 → Span Tag/Event 수동 추가 필요              │
│  ├── Retry 시도 횟수 → Span Event 수동 추가 필요               │
│  └── 커스텀 이벤트 리스너로 구현                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```java
// 커스텀 이벤트 리스너 — CB 상태 변화를 Span Event로 기록
@Component
public class TracingCircuitBreakerListener
    implements RegistryEventConsumer<CircuitBreaker> {

    private final Tracer tracer;

    @Override
    public void onEntryAddedEvent(
            EntryAddedEvent<CircuitBreaker> event) {
        CircuitBreaker cb = event.getAddedEntry();

        cb.getEventPublisher()
            .onStateTransition(e -> {
                Span currentSpan = tracer.currentSpan();
                if (currentSpan != null) {
                    currentSpan.tag("cb.name", cb.getName());
                    currentSpan.tag("cb.state",
                        e.getStateTransition()
                         .getToState().name());
                    currentSpan.event("CB State: " +
                        e.getStateTransition().getFromState()
                        + " -> " +
                        e.getStateTransition().getToState());
                }
            })
            .onError(e -> {
                Span currentSpan = tracer.currentSpan();
                if (currentSpan != null) {
                    currentSpan.event("CB Error: "
                        + e.getThrowable().getMessage());
                }
            });
    }
}

// Retry 이벤트를 Span Event로 기록
@Component
public class TracingRetryListener
    implements RegistryEventConsumer<Retry> {

    private final Tracer tracer;

    @Override
    public void onEntryAddedEvent(
            EntryAddedEvent<Retry> event) {
        Retry retry = event.getAddedEntry();

        retry.getEventPublisher()
            .onRetry(e -> {
                Span currentSpan = tracer.currentSpan();
                if (currentSpan != null) {
                    currentSpan.event(String.format(
                        "Retry attempt #%d: %s",
                        e.getNumberOfRetryAttempts(),
                        e.getLastThrowable().getMessage()
                    ));
                    currentSpan.tag("retry.attempts",
                        String.valueOf(
                            e.getNumberOfRetryAttempts()));
                }
            });
    }
}
```

### Jaeger/Tempo TraceQL 쿼리 예시

```
┌─────────────────────────────────────────────────────────────────┐
│          TraceQL 쿼리 예시 (Grafana Tempo)                        │
│                                                                 │
│  [1] CB OPEN 상태 전환이 발생한 트레이스                         │
│  { span.cb.state = "OPEN" }                                      │
│                                                                 │
│  [2] 3회 이상 Retry가 발생한 트레이스                            │
│  { span.retry.attempts >= 3 }                                    │
│                                                                 │
│  [3] 특정 서비스에서 에러가 발생한 트레이스                      │
│  { resource.service.name = "payment-service"                     │
│    && status = error }                                           │
│                                                                 │
│  [4] CB OPEN + 5초 이상 소요된 트레이스                          │
│  { span.cb.state = "OPEN" && duration > 5s }                     │
│                                                                 │
│  [Jaeger 검색 쿼리]                                              │
│  ├── Tag: cb.state=OPEN                                          │
│  ├── Tag: retry.attempts>=3                                      │
│  ├── Min Duration: 5s                                            │
│  └── Service: payment-service                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 24.6 Runbook 4종

### Runbook 1: CB OPEN 대응 (5단계)

```
┌─────────────────────────────────────────────────────────────────┐
│          Runbook: Circuit Breaker OPEN 대응                        │
│                                                                 │
│  [단계 1: 상황 파악 (2분 이내)]                                  │
│  ├── Grafana 대시보드 → CB 상태 Timeline 확인                  │
│  ├── 어떤 CB가 OPEN인지, 언제부터인지 확인                     │
│  ├── 영향 범위: 해당 CB를 사용하는 API 엔드포인트 파악        │
│  └── 다른 CB도 OPEN인지 확인 (연쇄 장애 가능성)               │
│                                                                 │
│  [단계 2: 다운스트림 확인 (3분 이내)]                            │
│  ├── 다운스트림 서비스 Health Check 직접 호출                  │
│  ├── 다운스트림 서비스 메트릭 확인                              │
│  │   (CPU, Memory, Error Rate)                                 │
│  ├── 다운스트림 서비스 로그 확인 (최근 에러)                   │
│  └── 네트워크 이슈 여부 확인 (DNS, 방화벽, 인증서)            │
│                                                                 │
│  [단계 3: 즉시 조치 (5분 이내)]                                  │
│  ├── 다운스트림 장애 확인 시:                                   │
│  │   ├── 다운스트림 팀에 알림 (Slack/PagerDuty)                │
│  │   ├── Fallback이 정상 동작하는지 확인                       │
│  │   └── 고객 영향도 파악 및 상태 페이지 업데이트              │
│  ├── 네트워크 이슈 시:                                         │
│  │   ├── 인프라팀에 알림                                       │
│  │   └── 대안 경로 확인 (Multi-Region Failover)                │
│  └── 원인 불명 시:                                              │
│      ├── CB 설정 확인 (임계값이 너무 낮지 않은지)              │
│      └── 최근 배포 이력 확인 (배포 후 발생?)                   │
│                                                                 │
│  [단계 4: 복구 확인]                                             │
│  ├── 다운스트림 복구 후                                        │
│  │   CB가 HALF_OPEN → CLOSED 전환 확인                         │
│  ├── Fallback 트래픽 → 정상 트래픽 전환 확인                  │
│  ├── 메트릭 정상 범위 복귀 확인 (실패율, 응답 시간)           │
│  └── Error Budget 소진량 확인                                  │
│                                                                 │
│  [단계 5: 포스트모텀]                                            │
│  ├── 타임라인 정리 (감지 → 대응 → 복구)                       │
│  ├── 근본 원인 분석 (Root Cause Analysis)                      │
│  ├── CB 설정 튜닝 필요 여부 판단                               │
│  ├── Fallback 정상 동작 여부 확인                               │
│  └── 개선 Action Item 생성                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Runbook 2: Retry Storm 감지/대응

```
┌─────────────────────────────────────────────────────────────────┐
│          Runbook: Retry Storm 감지 및 대응                        │
│                                                                 │
│  [감지 조건]                                                     │
│  재시도 비율 > 50%이 3분 이상 지속                              │
│                                                                 │
│  [대응 절차]                                                     │
│  1. 다운스트림 상태 확인                                        │
│     ├── 다운스트림이 살아있지만 느린 경우:                     │
│     │   → Retry가 부하를 가중시키고 있을 가능성                │
│     │   → Retry maxAttempts 일시적 축소 검토                   │
│     └── 다운스트림이 완전히 다운된 경우:                       │
│         → CB가 OPEN이어야 하는데                               │
│           왜 Retry가 발생하는지 확인                            │
│         → CB 임계값 확인                                       │
│           (failureRateThreshold 너무 높은지)                   │
│                                                                 │
│  2. Retry 설정 긴급 조정 (필요 시)                              │
│     ├── maxAttempts 축소 (5 → 2)                                │
│     ├── waitDuration 증가 (500ms → 2000ms)                     │
│     └── Spring Cloud Config / Feature Flag로 무중단 반영       │
│                                                                 │
│  3. Retry Storm 해소 확인                                       │
│     ├── 재시도 비율 정상 범위(< 20%) 복귀                      │
│     ├── 다운스트림 부하 감소 확인                               │
│     └── 전체 시스템 TPS/응답시간 정상 확인                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Runbook 3: Bulkhead Exhaustion 대응

```
┌─────────────────────────────────────────────────────────────────┐
│          Runbook: Bulkhead Exhaustion 대응                        │
│                                                                 │
│  [감지 조건]                                                     │
│  Bulkhead 사용률 > 80%이 2분 이상 지속                          │
│                                                                 │
│  [대응 절차]                                                     │
│  1. 원인 분석                                                    │
│     ├── 다운스트림 응답 지연 → 슬롯이 오래 점유               │
│     ├── 트래픽 급증 → 정상적 용량 초과                         │
│     └── 리소스 누수 → 슬롯이 반환되지 않음                    │
│                                                                 │
│  2. 즉시 조치                                                    │
│     ├── 다운스트림 지연 시:                                     │

│     │   ├── Timeout 확인 및 축소 검토                           │
│     │   └── Timeout이 Bulkhead 점유를                          │
│     │       길게 만들 수 있음                                   │
│     ├── 트래픽 급증 시:                                         │
│     │   ├── 오토스케일링 확인                                   │
│     │   └── Bulkhead maxConcurrentCalls                        │
│     │       일시적 증가 검토                                    │
│     └── 리소스 누수 시:                                         │
│         ├── Thread Dump / Heap Dump 수집                        │
│         └── 비정상 스레드 상태 확인                              │
│                                                                 │
│  3. 포화 시:                                                     │
│     ├── BulkheadFullException 발생 빈도 확인                   │
│     ├── Fallback 정상 동작 확인                                 │
│     └── 사용자 영향도 파악                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Runbook 4: 모니터링 → Chaos Engineering 피드백 루프

```
┌─────────────────────────────────────────────────────────────────┐
│          모니터링 → Chaos Engineering 피드백 루프                  │
│                                                                 │
│  [Observe → Hypothesize → Experiment → Learn]                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  1. OBSERVE (관찰)                                       │   │
│  │  ├── 대시보드에서                                        │   │
│  │  │   "이 CB는 한 번도 OPEN된 적 없다"                    │   │
│  │  ├── "Bulkhead 사용률이 항상 10% 미만이다"              │   │
│  │  └── "Retry가 정말 효과가 있는지 모르겠다"              │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  2. HYPOTHESIZE (가설)                                   │   │
│  │  ├── "CB 임계값이 너무 높아서 실제 장애 시             │   │
│  │  │    OPEN 안 될 수 있다"                                │   │
│  │  │    (failureRateThreshold=80% → 50%?)                 │   │
│  │  ├── "Bulkhead 설정이 너무 넉넉해서                    │   │
│  │  │    격리 효과가 없다"                                  │   │
│  │  └── "Retry 3회 설정이 너무 많아서                      │   │
│  │       Retry Storm 위험"                                  │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  3. EXPERIMENT (실험 — Chaos Engineering)                │   │
│  │  ├── Chaos Toolkit으로 다운스트림 500 에러 주입          │   │
│  │  ├── CB가 예상 시간 내 OPEN 되는지 확인                  │   │
│  │  ├── Fallback이 정상 동작하는지 확인                     │   │
│  │  ├── Retry Storm이 발생하지 않는지 확인                  │   │
│  │  └── Bulkhead가 다른 서비스 호출을                       │   │
│  │      보호하는지 확인                                      │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  4. LEARN (학습)                                         │   │
│  │  ├── 실험 결과 → 설정 튜닝                               │   │
│  │  │   ├── CB 임계값 조정                                  │   │
│  │  │   ├── Bulkhead 크기 조정                              │   │
│  │  │   └── Retry 횟수/간격 조정                            │   │
│  │  ├── 새로운 알람 규칙 추가                               │   │
│  │  ├── 대시보드 개선                                       │   │
│  │  └── Runbook 업데이트                                    │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │          ┌──── 다시 1. OBSERVE로 ────┐                   │   │
│  │          └───────────────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [주기]                                                         │
│  ├── 일상: 대시보드 관찰 → 이상 징후 메모                     │
│  ├── 월간: 관찰 결과 기반 가설 수립                            │
│  ├── 분기: GameDay (Chaos Engineering 실험)                    │
│  └── 실험 후: 설정 튜닝 + 모니터링 개선                       │
│                                                                 │
│  핵심: 모니터링은 그 자체가 목적이 아니라,                      │
│        시스템을 더 잘 이해하고 개선하기 위한 입력이다.          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```