---
layout: single
title: "Reactive Programming & Flux 기본 개념"
date: 2026-02-11 11:20:00 +0900
categories: backend
excerpt: "``` 리액티브 프로그래밍 = 데이터 스트림 + 변화 전파 + 비동기 처리 └── "데이터가 오면 그때 반응(React)하자!" └── 명령형이 아닌 선언형 비동기 처리"
toc: true
toc_sticky: true
tags: [Reactive, Programming, &, Flux, 기본, 개념]
---

# TL;DR
- **Reactive Programming & Flux 기본 개념의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
``` 리액티브 프로그래밍 = 데이터 스트림 + 변화 전파 + 비동기 처리 └── "데이터가 오면 그때 반응(React)하자!" └── 명령형이 아닌 선언형 비동기 처리

## 2. 배경
Reactive Programming & Flux 기본 개념이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- 개념
- 1 전통적인 문제점
- 2 리액티브 스트림의 탄생
- 3 스트리밍 시스템과의 관계
- 1 Flux란?

## 5. 상세 내용

> **작성일**: 2026-01-28
> **카테고리**: Backend / Reactive / Spring WebFlux
> **포함 내용**: Flux, Mono, Sinks, Backpressure, Schedulers, 리액티브 스트림

---

# 1. 리액티브 프로그래밍이란?

## 개념

```
리액티브 프로그래밍 = 데이터 스트림 + 변화 전파 + 비동기 처리
                    └── "데이터가 오면 그때 반응(React)하자!"
                    └── 명령형이 아닌 선언형 비동기 처리

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  핵심 아이디어:                                         │
│  ├── 데이터를 "요청"하지 않고                           │
│  ├── 데이터가 "흘러오면" 처리                           │
│  └── 마치 엑셀 셀처럼 자동으로 업데이트                 │
│                                                         │
│  비유:                                                  │
│  명령형: "물 떠와" → 물통 들고 → 수도꼭지 → 받음        │
│  리액티브: 수도꼭지 열어두면 물이 알아서 흘러옴         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경

## 2.1 전통적인 문제점

```
┌─────────────────────────────────────────────────────────┐
│                    전통적인 문제점                       │
│                                                         │
│  상황: 웹 서버가 10,000명의 동시 요청을 처리해야 함      │
│                                                         │
│  전통적 방식 (Thread-per-Request):                      │
│  ├── 1 요청 = 1 스레드                                  │
│  ├── 10,000명 = 10,000 스레드 필요?                     │
│  ├── 스레드 1개 = 약 1MB 메모리                         │
│  └── 10,000 스레드 = 10GB 메모리 💀                     │
│                                                         │
│  더 큰 문제:                                            │
│  ├── DB 조회 중... 스레드가 그냥 대기 (Blocking)        │
│  ├── API 호출 중... 스레드가 그냥 대기                  │
│  └── I/O 작업 중 스레드가 놀고 있음 = 자원 낭비         │
│                                                         │
│  ┌────────────────────────────────────────────┐         │
│  │  Thread 1: [====작업====][---대기---][=작업=]│         │
│  │  Thread 2: [==작업==][------대기------][작업]│         │
│  │  Thread 3: [작업][--------대기--------][==]  │         │
│  │                 ↑                            │         │
│  │            여기서 CPU는 놀고 있음!            │         │
│  └────────────────────────────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 2.2 리액티브 스트림의 탄생

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  해결 아이디어:                                         │
│  "대기하지 말고, 데이터가 오면 그때 반응(React)하자!"   │
│                                                         │
│  2013: Reactive Streams 명세 탄생                       │
│        └── Netflix, Pivotal, Lightbend 등 공동 제작     │
│        └── "비동기 스트림 처리의 표준"                  │
│                                                         │
│  2017: Java 9에 Flow API 포함 (Reactive Streams)        │
│                                                         │
│  현재: 주요 구현체들                                    │
│  ├── Project Reactor (Flux/Mono) - Spring 진영          │
│  ├── RxJava - Netflix 진영                              │
│  ├── Akka Streams - Lightbend 진영                      │
│  └── Kotlin Coroutines Flow - Kotlin 진영               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 2.3 스트리밍 시스템과의 관계

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  같은 철학을 공유:                                      │
│  "데이터를 배치로 모으지 말고, 흐르는 대로 처리하자"    │
│                                                         │
│  ┌─────────────────┬─────────────────────────────────┐ │
│  │   영역          │   기술                          │ │
│  ├─────────────────┼─────────────────────────────────┤ │
│  │ 메시징 시스템   │ Kafka, RabbitMQ, Pulsar         │ │
│  │ 스트림 처리     │ Kafka Streams, Flink, Spark     │ │
│  │ 앱 내부 처리    │ Reactor (Flux), RxJava, Flow    │ │
│  └─────────────────┴─────────────────────────────────┘ │
│                                                         │
│  공통점:                                                │
│  ├── 무한/연속 데이터 스트림 처리                       │
│  ├── Backpressure (배압) 지원                          │
│  ├── 비동기/논블로킹                                    │
│  └── 선언적 파이프라인                                  │
│                                                         │
│  차이점:                                                │
│  ├── Kafka: 분산 시스템 간 메시지 전달                  │
│  └── Flux: 단일 애플리케이션 내부 비동기 처리           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 3. Flux와 Mono

## 3.1 Flux란?

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Flux = 0개 이상의 데이터를 비동기로 방출하는 스트림     │
│         └── Project Reactor 라이브러리 제공             │
│         └── Spring WebFlux의 핵심                       │
│                                                         │
│  비유:                                                  │
│  ├── List<User> = 물통 (한 번에 다 담김)               │
│  └── Flux<User> = 수도꼭지 (계속 흘러나옴)             │
│                                                         │
│  시간 축으로 보면:                                      │
│  ──────────────────────────────────────► 시간           │
│     │      │         │    │                 │           │
│     A      B         C    D               완료          │
│                                                         │
│  List:   [A, B, C, D] ← 전부 모아서 한 번에            │
│  Flux:   A → B → C → D → | ← 하나씩 흘러감             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```kotlin
// List 방식 (동기, 블로킹)
fun getAllUsers(): List<User> {
    return userRepository.findAll()  // 전부 가져올 때까지 대기
}

// Flux 방식 (비동기, 논블로킹)
fun getAllUsers(): Flux<User> {
    return userRepository.findAll()  // 즉시 리턴, 데이터는 나중에 흘러옴
}
```

## 3.2 Mono vs Flux

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Mono<T> = 0개 또는 1개의 결과                          │
│           └── Optional의 비동기 버전                    │
│           └── 단일 값 반환에 사용                       │
│                                                         │
│  Flux<T> = 0개 이상(N개)의 결과                         │
│           └── List/Stream의 비동기 버전                 │
│           └── 여러 값 반환에 사용                       │
│                                                         │
│  Mono:   ────────○────────│                             │
│                  ↑        ↑                             │
│               0 or 1개   완료                           │
│                                                         │
│  Flux:   ──○──○──○──○──○──│                             │
│            ↑  ↑  ↑  ↑  ↑  ↑                             │
│           0~N개 데이터   완료                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```kotlin
// Mono 사용 예
fun findById(id: Long): Mono<User>  // 한 명 조회
fun save(user: User): Mono<User>    // 저장 후 결과

// Flux 사용 예
fun findAll(): Flux<User>           // 전체 조회
fun findByName(name: String): Flux<User>  // 여러 명 조회
```

## 3.3 Flux 생성 방법

```kotlin
// 정적 데이터로 생성
val flux1 = Flux.just("A", "B", "C")
val flux2 = Flux.fromIterable(listOf(1, 2, 3))
val flux3 = Flux.range(1, 10)  // 1부터 10까지

// 비어있는 Flux
val empty = Flux.empty<String>()

// 에러 Flux
val error = Flux.error<String>(RuntimeException("에러!"))

// 무한 스트림
val interval = Flux.interval(Duration.ofSeconds(1))  // 1초마다 0, 1, 2, ...

// 프로그래밍 방식 (Sinks)
val sink = Sinks.many().multicast().onBackpressureBuffer<String>()
sink.tryEmitNext("데이터1")
sink.tryEmitNext("데이터2")
```

---

# 4. Sinks (데이터 주입)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Sinks = 프로그래밍 방식으로 Flux/Mono에 값을 주입      │
│          └── "싱크대"처럼 데이터를 흘려보내는 입구       │
│          └── Publisher를 직접 제어할 수 있게 해줌       │
│                                                         │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐      │
│  │ Producer │─────►│   Sink   │─────►│   Flux   │      │
│  │ (이벤트) │      │  (입구)  │      │ (구독자) │      │
│  └──────────┘      └──────────┘      └──────────┘      │
│                                                         │
│  사용 예:                                               │
│  ├── 콜백을 Flux로 변환                                 │
│  ├── 외부 이벤트를 리액티브 스트림으로                  │
│  └── 여러 소스의 데이터를 하나의 Flux로 합치기          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Sinks 종류

```kotlin
// 1. Sinks.one() - 단일 값 (Mono용)
val monoSink = Sinks.one<String>()
monoSink.tryEmitValue("단일 값")
val mono: Mono<String> = monoSink.asMono()

// 2. Sinks.many() - 여러 값 (Flux용)
// 2-1. unicast: 단일 구독자만
val unicast = Sinks.many().unicast().onBackpressureBuffer<String>()

// 2-2. multicast: 여러 구독자, 구독 이후 데이터만
val multicast = Sinks.many().multicast().onBackpressureBuffer<String>()

// 2-3. replay: 여러 구독자, 과거 데이터도 재생
val replay = Sinks.many().replay().all<String>()  // 전체 히스토리
val replayLimit = Sinks.many().replay().limit(10)  // 최근 10개만
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  unicast vs multicast vs replay:                        │
│                                                         │
│  unicast:                                               │
│  ├── 구독자 1명만 가능                                  │
│  └── 1:1 스트림                                         │
│                                                         │
│  multicast:                                             │
│  ├── 구독자 여러 명 가능                                │
│  ├── 구독 이후 데이터만 받음                            │
│  └── 라이브 방송처럼                                    │
│                                                         │
│  replay:                                                │
│  ├── 구독자 여러 명 가능                                │
│  ├── 과거 데이터도 다시 받을 수 있음                    │
│  └── 녹화 방송처럼                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 5. Backpressure (배압)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Backpressure = 소비자가 생산자에게 "천천히!" 요청      │
│                 └── Back(뒤로) + Pressure(압력)         │
│                 └── 소비 속도 < 생산 속도 일 때 필요    │
│                                                         │
│  문제 상황:                                             │
│  Producer: ○○○○○○○○○○○○○○○○○○○→ (초당 1000개 생산)      │
│  Consumer: ○...○...○...○...→ (초당 10개만 처리 가능)   │
│                                                         │
│  Backpressure 없으면:                                   │
│  ├── 메모리에 데이터 쌓임                               │
│  ├── OutOfMemoryError 💀                                │
│                                                         │
│  Backpressure 있으면:                                   │
│  ├── Consumer: "나 10개만 줘"                           │
│  ├── Producer: "알겠어, 10개만 보낼게"                  │
│  └── 또는 버퍼에 저장하고 천천히 전달                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Backpressure 전략

```kotlin
flux
    .onBackpressureBuffer()      // 버퍼에 저장
    .onBackpressureBuffer(100)   // 최대 100개까지 버퍼
    .onBackpressureDrop()        // 초과분 버림
    .onBackpressureLatest()      // 최신 것만 유지
    .onBackpressureError()       // 에러 발생
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  전략별 비유:                                           │
│                                                         │
│  Buffer:  대기줄 만들기 (줄이 너무 길면 문제)           │
│  Drop:    뒤늦게 온 손님 돌려보내기                     │
│  Latest:  가장 최근 손님만 받기                         │
│  Error:   더 이상 못 받는다고 알림                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 6. 주요 연산자

## 6.1 변환 연산자

```kotlin
// map: 1:1 변환
flux.map { it.uppercase() }

// flatMap: 1:N 변환 + 평탄화 (비동기 병렬)
flux.flatMap { userId ->
    userService.getOrders(userId)  // Flux<Order> 반환
}

// concatMap: flatMap과 동일하나 순서 보장
flux.concatMap { userId ->
    userService.getOrders(userId)
}

// switchMap: 새 값 오면 이전 처리 취소
searchInput.switchMap { query ->
    searchService.search(query)  // 타이핑 중 이전 검색 취소
}
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  map vs flatMap:                                        │
│                                                         │
│  map:     A ─────→ f(A)                                 │
│           결과가 단순 값                                │
│                                                         │
│  flatMap: A ─────→ [A1, A2, A3]  ─┐                    │
│           B ─────→ [B1, B2]      ─┼→ [A1,B1,A2,B2,A3]  │
│           결과가 스트림, 평탄화됨                       │
│           순서 보장 안 됨 (병렬 처리)                   │
│                                                         │
│  concatMap: 순서 보장됨 (순차 처리)                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 6.2 필터링 연산자

```kotlin
flux.filter { it > 10 }           // 조건에 맞는 것만
flux.distinct()                    // 중복 제거
flux.take(5)                       // 처음 5개만
flux.takeLast(5)                   // 마지막 5개만
flux.skip(3)                       // 처음 3개 건너뛰기
flux.takeWhile { it < 100 }        // 조건 만족하는 동안만
flux.takeUntil { it == "STOP" }    // 조건 만족할 때까지
```

## 6.3 조합 연산자

```kotlin
// merge: 여러 Flux를 하나로 (순서 섞임)
Flux.merge(flux1, flux2, flux3)

// concat: 여러 Flux를 순서대로 연결
Flux.concat(flux1, flux2, flux3)

// zip: 여러 Flux의 요소를 짝지어 합침
Flux.zip(nameFlux, ageFlux) { name, age ->
    Person(name, age)
}

// combineLatest: 각 Flux의 최신 값으로 조합
Flux.combineLatest(priceFlux, quantityFlux) { price, qty ->
    price * qty
}
```

## 6.4 그룹화 연산자

```kotlin
flux.groupBy { it.category }  // 카테고리별 그룹화
    .flatMap { group ->
        group.map { processItem(it) }
    }
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  groupBy = 스트림을 키 기준으로 여러 서브스트림으로 분할│
│                                                         │
│  입력: ──A1──B1──A2──B2──A3──C1──B3──→                  │
│                                                         │
│  groupBy(카테고리):                                     │
│        ┌──A1──────A2──────A3──────→  (A 그룹)          │
│        │                                                │
│  ──────┼──B1──────B2──────────B3──→  (B 그룹)          │
│        │                                                │
│        └──────────────C1──────────→  (C 그룹)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 7. Schedulers (스레드 관리)

```kotlin
flux
    .publishOn(Schedulers.boundedElastic())  // 이후 연산을 다른 스레드에서
    .subscribeOn(Schedulers.parallel())      // 구독(소스)을 다른 스레드에서
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  publishOn vs subscribeOn:                              │
│                                                         │
│  subscribeOn: 소스(데이터 생성)를 어디서 실행할지       │
│               └── 위치 상관없이 전체 체인에 영향        │
│                                                         │
│  publishOn: 이후 연산을 어디서 실행할지                 │
│             └── 호출 위치 이후부터 영향                 │
│                                                         │
│  예시:                                                  │
│  flux                                                   │
│    .map { ... }          // main thread                │
│    .publishOn(elastic)   // 여기서 스레드 전환          │
│    .map { ... }          // elastic thread             │
│    .publishOn(parallel)  // 다시 스레드 전환            │
│    .map { ... }          // parallel thread            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Scheduler 종류

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Schedulers.immediate()                                 │
│  └── 현재 스레드 그대로 (기본값)                        │
│                                                         │
│  Schedulers.single()                                    │
│  └── 단일 스레드 (순차 처리 필요 시)                    │
│                                                         │
│  Schedulers.parallel()                                  │
│  └── CPU 코어 수만큼의 고정 스레드                      │
│  └── CPU 집약적 작업용                                  │
│                                                         │
│  Schedulers.boundedElastic()  ← 가장 많이 사용          │
│  └── 탄력적으로 늘어나는 스레드 풀                      │
│  └── I/O 작업용 (DB, API 호출 등)                       │
│  └── 블로킹 코드 감싸기에 적합                          │
│                                                         │
│  Schedulers.fromExecutor(executor)                      │
│  └── 커스텀 ExecutorService 사용                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 8. 에러 처리

```kotlin
flux
    .onErrorReturn("기본값")           // 에러 시 기본값 반환
    .onErrorResume { e ->              // 에러 시 대체 Flux
        Flux.just("대체", "데이터")
    }
    .onErrorMap { e ->                 // 에러 변환
        CustomException("변환된 에러", e)
    }
    .doOnError { e ->                  // 에러 로깅 (스트림 계속)
        logger.error("에러 발생", e)
    }
    .retry(3)                          // 3번 재시도
    .retryWhen(Retry.backoff(3, Duration.ofSeconds(1)))  // 지수 백오프
```

---

# 9. 구독 (Subscribe)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  subscribe = "이제 데이터 받을 준비 됐어!"              │
│              └── 구독하기 전까지 아무 일도 안 일어남!   │
│                                                         │
│  중요한 개념:                                           │
│  ├── Flux/Mono는 "게으른(Lazy)" 스트림                  │
│  ├── 선언만으로는 실행 안 됨                            │
│  └── subscribe() 호출해야 파이프라인 실행               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```kotlin
// 다양한 subscribe 방식
flux.subscribe()                                    // 그냥 실행
flux.subscribe { data -> println(data) }           // 데이터 처리
flux.subscribe(
    { data -> println(data) },                     // onNext
    { error -> logger.error("에러", error) },      // onError
    { println("완료!") }                           // onComplete
)

// block은 테스트에서만! (프로덕션 금지)
val result = flux.collectList().block()  // 블로킹으로 결과 받기
```

---

# 10. 실제 사용 패턴

## 10.1 콜백을 Flux로 변환

```kotlin
class ReactiveAITaskService {
    // Sink로 데이터 주입 입구 생성
    private val callbackSink = Sinks.many()
        .multicast()
        .onBackpressureBuffer<AITaskResult>()

    // Flux로 변환하여 구독 가능하게
    fun getCallbackStream(): Flux<AITaskResult> = callbackSink.asFlux()

    // 외부에서 콜백 받을 때
    fun onCallback(result: AITaskResult) {
        callbackSink.tryEmitNext(result)
    }

    // 파이프라인 구성
    fun processCallbacks() {
        getCallbackStream()
            .groupBy { it.taskName }           // 에이전트별 그룹화
            .flatMap { group ->
                group
                    .publishOn(Schedulers.boundedElastic())
                    .map { processTask(it) }
            }
            .subscribe()
    }
}
```

## 10.2 WebFlux 컨트롤러

```kotlin
@RestController
class UserController(
    private val userService: UserService
) {
    @GetMapping("/users", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun getUsers(): Flux<User> {
        return userService.findAll()  // SSE로 스트리밍
    }

    @GetMapping("/users/{id}")
    fun getUser(@PathVariable id: Long): Mono<User> {
        return userService.findById(id)
    }

    @PostMapping("/users")
    fun createUser(@RequestBody user: User): Mono<User> {
        return userService.save(user)
    }
}
```

## 10.3 병렬 API 호출

```kotlin
fun fetchAllData(ids: List<Long>): Flux<Data> {
    return Flux.fromIterable(ids)
        .flatMap({ id ->
            webClient.get()
                .uri("/api/data/$id")
                .retrieve()
                .bodyToMono(Data::class.java)
        }, 10)  // 최대 10개 동시 호출
}
```

---

# 11. 정리

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  리액티브 프로그래밍 = 데이터 스트림 + 변화 전파        │
│                                                         │
│  핵심 타입:                                             │
│  ├── Flux<T>: 0~N개 데이터의 비동기 스트림             │
│  ├── Mono<T>: 0~1개 데이터의 비동기 스트림             │
│  └── Sinks: Flux/Mono에 데이터 주입 입구               │
│                                                         │
│  핵심 개념:                                             │
│  ├── Backpressure: 소비자→생산자 속도 제어             │
│  ├── Schedulers: 스레드 풀 관리                        │
│  ├── subscribe: 파이프라인 실행 시작                   │
│  └── Lazy: 구독 전까지 실행 안 됨                      │
│                                                         │
│  주요 연산자:                                           │
│  ├── map/flatMap: 변환                                 │
│  ├── filter/take/skip: 필터링                          │
│  ├── merge/concat/zip: 조합                            │
│  ├── groupBy: 그룹화                                   │
│  └── onError*/retry: 에러 처리                         │
│                                                         │
│  스트리밍 시스템과의 관계:                              │
│  ├── Kafka: 분산 시스템 간 메시지 전달                  │
│  └── Flux: 단일 앱 내부 비동기 처리                    │
│  └── 같은 철학: "데이터를 흐르는 대로 처리"            │
│                                                         │
│  비유:                                                  │
│  전통 방식: 물통으로 물 떠오기 (한 번에 전부)           │
│  리액티브: 수도꼭지 틀어두기 (흘러오는 대로 처리)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Flux`, `Mono`, `Reactor`, `Reactive Streams`, `Backpressure`, `Sinks`, `Schedulers`, `WebFlux`, `비동기`, `논블로킹`, `스트리밍`
