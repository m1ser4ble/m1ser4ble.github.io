---
layout: single
title: "lettuce redis 클라이언트"
date: 2026-03-05 23:00:00 +0900
categories: backend
excerpt: "lettuce redis 클라이언트는 핵심 개념과 적용 포인트를 정리해 실무 판단 기준을 제공한다."
toc: true
toc_sticky: true
tags: [backend, spring, db, architecture]
source: "/home/dwkim/dwkim/docs/backend/lettuce-redis-클라이언트.md"

---

**TL;DR**
- lettuce redis 클라이언트의 핵심 개념과 적용 범위를 정리
- 등장 배경과 필요한 이유를 요약
- 주요 특징과 실무 활용 포인트를 정리

## 1. 개념
lettuce redis 클라이언트의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. 배경
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. 이유
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. 특징
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. 상세 내용

# Lettuce Redis 클라이언트

> **작성일**: 2026-03-04
> **카테고리**: Backend / Java / Spring / Redis
> **포함 내용**: Lettuce, Jedis, Redisson, Netty, 비동기 I/O, 논블로킹, 커넥션 풀, StatefulRedisConnection, RedisFuture, Project Reactor, Redis Cluster, Sentinel, Pub/Sub, Redis Streams, ReadFrom, Pipeline, MULTI/EXEC, EventLoop, TCP KeepAlive, Valkey, Spring Data Redis, LettuceConnectionFactory

---

# 1. Lettuce란?

## 핵심 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                    Lettuce 핵심 개념                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Lettuce = Java로 작성된 Redis 클라이언트 라이브러리              │
│            Netty 기반 비동기/논블로킹 I/O                        │
│            Spring Boot 2.0+ 기본 Redis 클라이언트                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Spring Boot Application                                  │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  Spring Data Redis                                │    │   │
│  │  │  ┌──────────────────────────────────────────┐    │    │   │
│  │  │  │  Lettuce (기본 클라이언트)                │    │    │   │
│  │  │  │  ┌──────────────────────────────────┐    │    │    │   │
│  │  │  │  │  Netty (비동기 I/O 프레임워크)    │    │    │    │   │
│  │  │  │  └──────────────────────────────────┘    │    │    │   │
│  │  │  └──────────────────────────────────────────┘    │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                        │
│                          ▼                                        │
│                   ┌──────────────┐                               │
│                   │ Redis Server │                               │
│                   └──────────────┘                               │
│                                                                   │
│  3가지 클라이언트 비교:                                           │
│  ┌────────────┬──────────────────────────────────────────────┐  │
│  │ Lettuce    │ 비동기/논블로킹, Netty 기반, 커넥션 공유 가능 │  │
│  ├────────────┼──────────────────────────────────────────────┤  │
│  │ Jedis      │ 동기/블로킹, 커넥션 풀 필수, 더 단순          │  │
│  ├────────────┼──────────────────────────────────────────────┤  │
│  │ Redisson   │ 분산 객체 플랫폼, 분산 락/컬렉션 제공         │  │
│  └────────────┴──────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경: 왜 Jedis 대신 Lettuce인가?

## Jedis의 근본적 한계

```
┌─────────────────────────────────────────────────────────────────┐
│               Jedis의 아키텍처 문제점                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  문제 1: 스레드 비안전 (Thread-Unsafe)                           │
│                                                                   │
│  Jedis 인스턴스 1개 = TCP 소켓 1개 = 스레드 1개 전용             │
│                                                                   │
│  Thread-A ──SET "key" "val"──┐                                   │
│                               ├──→ 같은 소켓 → RESP 스트림 오염! │
│  Thread-B ──GET "other"──────┘                                   │
│                                                                   │
│  결과: "expected '$' but got ' '" 프로토콜 에러                  │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 2: 블로킹 I/O                                              │
│                                                                   │
│  Thread ──sendCommand()──→ Redis                                 │
│  Thread ──[대기 중...]────← 응답 올 때까지 블로킹               │
│  Thread ──getReply()──────← 응답 수신                            │
│                                                                   │
│  → 응답 대기 중 스레드가 아무 일도 못 함                         │
│  → 동시성 = 커넥션 풀의 커넥션 수에 비례                        │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 3: 비동기/리액티브 미지원                                   │
│                                                                   │
│  Jedis API: 동기만 지원 (Pipeline 제외)                          │
│  → Spring WebFlux와 통합 불가                                    │
│  → Reactive 스택에서 사용 시 스레드 낭비                         │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 4: Redis Cluster에서 비동기 미지원                         │
│  문제 5: 릴리즈 지연 심각 (Redis 신 버전 기능 미지원)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Spring Boot 2.0에서 Lettuce로 교체된 경위

```
┌─────────────────────────────────────────────────────────────────┐
│            Spring Boot 기본 Redis 클라이언트 교체 이력            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Spring Boot 1.x: Jedis (기본값)                                 │
│                                                                   │
│  2017년: Mark Paluch (Lettuce 메인테이너)가                      │
│          Spring Boot GitHub Issue #10480 제출                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  "The arrangement with Jedis suffers from changes    │       │
│  │   in the Jedis core development. Features of newer   │       │
│  │   Redis versions are not supported. Requests for a   │       │
│  │   new release were not completed in a timely manner." │       │
│  │                          — Mark Paluch, Issue #10480  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  Andy Wilkinson (Spring 팀)이 동의                               │
│  → Spring Boot 2.0.0.M5에서 Lettuce로 교체                      │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  2023년: Redis 7.2 릴리즈                                        │
│  → Lettuce가 Redis 공식 클라이언트 패밀리로 지정                 │
│  → 라이선스: Apache 2.0 → MIT로 변경                             │
│  → GitHub: lettuce-io/lettuce-core → redis/lettuce 이관          │
│                                                                   │
│  Lettuce 개발 연혁:                                               │
│  2011년: wuqke가 최초 개발                                       │
│  2014년: Mark Paluch (mp911de)가 프로젝트 인수                   │
│  2018년: Spring Boot 2.0 기본 클라이언트                         │
│  2023년: Redis 공식 클라이언트                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. 내부 아키텍처

## Netty 기반 비동기 I/O 모델

```
┌─────────────────────────────────────────────────────────────────┐
│                Lettuce 내부 아키텍처                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Jedis 모델]                                                     │
│                                                                   │
│  Thread-A → Conn-1 → Redis    각 스레드가 전용 커넥션 점유       │
│  Thread-B → Conn-2 → Redis    커넥션 풀 필수                     │
│  Thread-C → Conn-3 → Redis    풀 소진 시 대기 or 에러            │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Lettuce 모델]                                                   │
│                                                                   │
│  Thread-A ─┐                                                      │
│  Thread-B ─┼──→ 단일 StatefulRedisConnection ──→ Redis           │
│  Thread-C ─┘    (Netty EventLoop가 멀티플렉싱)                   │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  상세 흐름:                                                       │
│                                                                   │
│  Application Threads                                              │
│    Thread-A ─┐                                                    │
│    Thread-B ─┼─→ WriteTask를 EventLoop 큐에 enqueue              │
│    Thread-C ─┘                                                    │
│                │                                                   │
│                ▼                                                   │
│  ┌────────────────────────────────────────────────┐              │
│  │  Netty EventLoop (단일 스레드)                  │              │
│  │                                                  │              │
│  │  CommandHandler                                  │              │
│  │  ┌──────────────────────────────────────┐      │              │
│  │  │  Command Queue (in-flight)           │      │              │
│  │  │  [cmd1, cmd2, cmd3, ...]             │      │              │
│  │  │  각 cmd에 RedisFuture 연결           │      │              │
│  │  └──────────────────────────────────────┘      │              │
│  │           │                                      │              │
│  └───────────┼──────────────────────────────────────┘              │
│              │ 단일 TCP Channel                                    │
│              ▼                                                     │
│       Redis Server                                                │
│              │                                                     │
│  ← RESP 응답 ←                                                    │
│              │                                                     │
│  EventLoop가 응답을 Queue의 cmd와 매핑                            │
│  → 각 Thread의 RedisFuture.complete()                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3가지 API 레이어

```java
// 같은 StatefulRedisConnection에서 세 가지 API 획득
StatefulRedisConnection<String, String> conn = redisClient.connect();

// 1. 동기 API — 내부적으로 async().get() 블로킹
RedisCommands<String, String> sync = conn.sync();
String val = sync.get("key"); // 블로킹

// 2. 비동기 API — RedisFuture (CompletableFuture 구현체)
RedisAsyncCommands<String, String> async = conn.async();
RedisFuture<String> future = async.get("key");
future.thenAccept(System.out::println);

// 3. 리액티브 API — Project Reactor (Mono/Flux)
RedisReactiveCommands<String, String> reactive = conn.reactive();
Mono<String> mono = reactive.get("key");
mono.subscribe(System.out::println);
```

```
┌─────────────────────────────────────────────────────────────────┐
│              API 레이어별 사용 시나리오                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────┬──────────────────────────────────────────────┐  │
│  │ sync()     │ Spring MVC, 단순 CRUD                         │  │
│  │            │ 기존 동기 코드 호환                            │  │
│  │            │ 내부적으로 Future.get() 블로킹                │  │
│  ├────────────┼──────────────────────────────────────────────┤  │
│  │ async()    │ 여러 Redis 호출을 병렬 실행할 때              │  │
│  │            │ CompletableFuture 체이닝                      │  │
│  │            │ RedisFuture<V> 반환                           │  │
│  ├────────────┼──────────────────────────────────────────────┤  │
│  │ reactive() │ Spring WebFlux, 리액티브 스택                 │  │
│  │            │ Project Reactor의 Mono/Flux                   │  │
│  │            │ Backpressure 지원                             │  │
│  └────────────┴──────────────────────────────────────────────┘  │
│                                                                   │
│  핵심: 세 API 모두 같은 커넥션을 공유한다!                       │
│  → RedisClient.connect() 한 번이면 충분                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 커넥션 공유가 가능한 이유

```
┌─────────────────────────────────────────────────────────────────┐
│          왜 단일 커넥션을 여러 스레드가 공유할 수 있는가?         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1) Netty EventLoop가 쓰기/읽기를 직렬화                         │
│     → 여러 스레드의 명령이 큐를 통해 순차 처리                   │
│     → synchronized 블록 불필요                                   │
│                                                                   │
│  2) Redis 프로토콜이 요청/응답 순서를 보장                       │
│     → cmd1, cmd2, cmd3 순서로 보내면                             │
│     → resp1, resp2, resp3 순서로 돌아옴                          │
│     → 각 RedisFuture에 정확히 매핑 가능                          │
│                                                                   │
│  3) 명령별 고유 RedisFuture 객체                                 │
│     → 다른 스레드의 응답과 절대 섞이지 않음                     │
│                                                                   │
│  ⚠️ 예외: 커넥션 공유 불가능한 경우                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  BLPOP, BRPOP, XREAD (blocking)                      │       │
│  │  → 응답이 올 때까지 커넥션 점유                       │       │
│  │  → 다른 명령이 큐에서 대기                            │       │
│  │  → 전용 커넥션 필요                                   │       │
│  │                                                        │       │
│  │  MULTI / EXEC (트랜잭션)                               │       │
│  │  → MULTI 상태가 커넥션에 바인딩                        │       │
│  │  → 다른 스레드의 명령이 트랜잭션에 섞임                │       │
│  │  → 전용 커넥션 필요                                   │       │
│  │                                                        │       │
│  │  WATCH                                                 │       │
│  │  → 키 감시 상태가 커넥션에 바인딩                      │       │
│  │  → 전용 커넥션 필요                                   │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Lettuce vs Jedis 심층 비교

## 아키텍처 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                Jedis vs Lettuce 내부 구조                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Jedis 클래스 계층]                                             │
│                                                                   │
│  Jedis (String API)                                              │
│    └── BinaryJedis (byte[] 기반, 5,061줄)                        │
│          └── Client (Connection 래퍼)                            │
│                └── Connection (Socket I/O)                       │
│                      └── Protocol (RESP 직렬화)                  │
│                                                                   │
│  ┌──────────────────────────────────────────────┐               │
│  │  // Jedis 내부 - 모든 명령의 패턴                │               │
│  │  public Long rpush(byte[] key, byte[]... args) { │               │
│  │      client.rpush(key, args);      // 소켓 write │               │
│  │      return client.getIntegerReply(); // 블로킹  │               │
│  │  }                                                │               │
│  │  // write와 read 사이에 다른 스레드가 끼어들면    │               │
│  │  // → RESP 스트림 오염!                           │               │
│  └──────────────────────────────────────────────┘               │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Lettuce 클래스 계층]                                           │
│                                                                   │
│  RedisClient (Singleton, Netty 리소스 관리)                      │
│    └── StatefulRedisConnection<K,V> (Thread-safe)                │
│          ├── sync()     → RedisCommands<K,V>                     │
│          ├── async()    → RedisAsyncCommands<K,V>                │
│          └── reactive() → RedisReactiveCommands<K,V>             │
│                                                                   │
│  Javadoc: "A thread-safe connection to a Redis server.           │
│   Multiple threads may share one StatefulRedisConnection."       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 전체 비교 표

```
┌────────────────┬──────────────────────┬──────────────────────┐
│     항목       │       Jedis          │       Lettuce        │
├────────────────┼──────────────────────┼──────────────────────┤
│ I/O 모델       │ 블로킹 (BIO)         │ 논블로킹 (Netty NIO) │
│ 스레드 안전    │ 비안전 (풀 필수)      │ 안전 (공유 가능)     │
│ API            │ 동기만               │ 동기+비동기+리액티브 │
│ 커넥션 모델    │ 스레드당 전용 커넥션  │ 단일 커넥션 공유     │
│ 커넥션 풀      │ 필수 (JedisPool)     │ 선택적               │
│ Cluster 비동기 │ 미지원 (동기만)      │ 지원                 │
│ Reactive       │ 미지원               │ Project Reactor      │
│ Pub/Sub        │ 전용 스레드 필요     │ EventLoop 통합       │
│ 자동 재연결    │ 제한적               │ ConnectionWatchdog   │
│ 의존성         │ 경량 (자체 구현)     │ Netty (무거움)       │
│ 학습 곡선      │ 낮음                 │ 중간                 │
│ 기본 클라이언트│ Spring Boot 1.x      │ Spring Boot 2.0+     │
└────────────────┴──────────────────────┴──────────────────────┘
```

## 성능 벤치마크

```
┌─────────────────────────────────────────────────────────────────┐
│              JMH 벤치마크 결과                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Sentinel 환경, 100 스레드, 1M 키, 5KB 데이터]                  │
│                                                                   │
│  ┌──────────────────────┬───────────────┐                       │
│  │ 벤치마크             │ ops/ms        │                       │
│  ├──────────────────────┼───────────────┤                       │
│  │ Jedis GET            │ 17.858        │                       │
│  │ Jedis SET            │ 143.064       │                       │
│  │ Lettuce Async GET    │ 12.284        │                       │
│  │ Lettuce Async SET    │ 131.441       │                       │
│  │ Lettuce Reactive GET │ 12.299        │                       │
│  └──────────────────────┴───────────────┘                       │
│                                                                   │
│  → 단일 커넥션 + 낮은 동시성: Jedis가 약간 우위                 │
│  → 이유: Jedis는 여러 커넥션 사용 / Lettuce는 단일 커넥션       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Cluster 환경, 6 노드]                                          │
│                                                                   │
│  ┌──────────────────────┬───────────────┐                       │
│  │ 벤치마크             │ ops/ms        │                       │
│  ├──────────────────────┼───────────────┤                       │
│  │ Lettuce Async SET    │ 220.132       │ ← 압도적             │
│  │ Lettuce Reactive GET │ 19.598        │                       │
│  │ Jedis SET            │ 150.455       │                       │
│  │ Jedis GET            │ 18.842        │                       │
│  └──────────────────────┴───────────────┘                       │
│                                                                   │
│  → 클러스터 + 높은 동시성: Lettuce Async가 46% 더 빠름          │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  핵심 해석:                                                       │
│  ├── 단순 동기 + 낮은 동시성 → Jedis가 약간 유리                │
│  ├── 높은 동시성 + Cluster → Lettuce Async 압도적 우위           │
│  ├── Lettuce 배치 모드 → 처리량 5배 향상 (~100K→500K ops/s)    │
│  └── JedisPool 200개 초과 시 응답 시간 급격히 증가              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Spring Data Redis에서의 Lettuce 설정

## 기본 의존성

```xml
<!-- Spring Boot starter에 Lettuce 자동 포함 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- 커넥션 풀 사용 시 필수 (MULTI/EXEC, 블로킹 명령) -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>

<!-- TCP KeepAlive/Timeout 사용 시 (Linux) -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-transport-native-epoll</artifactId>
    <classifier>linux-x86_64</classifier>
</dependency>
```

## application.yml 설정

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: yourpassword
      timeout: 30s            # 커맨드 타임아웃 (기본 60s)
      database: 0
      lettuce:
        pool:
          max-active: 8       # 최대 활성 커넥션 (기본 8)
          max-idle: 8         # 최대 유휴 커넥션
          min-idle: 2         # 최소 유휴 커넥션
          max-wait: 3000ms    # 커넥션 획득 최대 대기
          time-between-eviction-runs: 30s
```

## Java Configuration

```java
@Configuration
public class RedisConfig {

    // ===== 기본 Standalone 설정 =====
    @Bean
    public LettuceConnectionFactory connectionFactory() {
        RedisStandaloneConfiguration serverConfig =
            new RedisStandaloneConfiguration("localhost", 6379);
        serverConfig.setPassword("yourpassword");

        // TCP 수준 타임아웃 설정 (dead connection 조기 감지)
        SocketOptions socketOptions = SocketOptions.builder()
            .keepAlive(SocketOptions.KeepAliveOptions.builder()
                .idle(Duration.ofSeconds(5))       // TCP_KEEPIDLE
                .interval(Duration.ofSeconds(5))   // TCP_KEEPINTVL
                .count(3)                          // TCP_KEEPCNT
                .enable()
                .build())
            .tcpUserTimeout(SocketOptions.TcpUserTimeoutOptions.builder()
                .tcpUserTimeout(Duration.ofSeconds(20))
                .enable()
                .build())
            .build();

        LettuceClientConfiguration clientConfig =
            LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(30))
                .clientOptions(ClientOptions.builder()
                    .socketOptions(socketOptions)
                    .disconnectedBehavior(
                        ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                    .autoReconnect(true)
                    .build())
                .build();

        return new LettuceConnectionFactory(serverConfig, clientConfig);
    }

    // ===== Cluster 설정 =====
    @Bean
    public LettuceConnectionFactory clusterConnectionFactory() {
        RedisClusterConfiguration clusterConfig =
            new RedisClusterConfiguration(
                List.of("node1:7001", "node2:7002", "node3:7003"));
        clusterConfig.setMaxRedirects(3);

        ClusterTopologyRefreshOptions topologyRefresh =
            ClusterTopologyRefreshOptions.builder()
                .enableAllAdaptiveRefreshTriggers()
                .enablePeriodicRefresh(Duration.ofSeconds(60))
                .build();

        LettuceClientConfiguration clientConfig =
            LettuceClientConfiguration.builder()
                .readFrom(ReadFrom.REPLICA_PREFERRED)
                .clientOptions(ClusterClientOptions.builder()
                    .topologyRefreshOptions(topologyRefresh)
                    .autoReconnect(true)
                    .build())
                .commandTimeout(Duration.ofSeconds(30))
                .build();

        return new LettuceConnectionFactory(clusterConfig, clientConfig);
    }

    // ===== Sentinel 설정 =====
    @Bean
    public LettuceConnectionFactory sentinelConnectionFactory() {
        RedisSentinelConfiguration sentinelConfig =
            new RedisSentinelConfiguration()
                .master("mymaster")
                .sentinel("sentinel1", 26379)
                .sentinel("sentinel2", 26380)
                .sentinel("sentinel3", 26381);
        sentinelConfig.setPassword("redis-password");
        sentinelConfig.setSentinelPassword("sentinel-password");

        return new LettuceConnectionFactory(sentinelConfig);
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(
            new GenericJackson2JsonRedisSerializer());
        return template;
    }
}
```

---

# 6. 고급 기능

## 파이프라이닝 (Pipelining)

```
┌─────────────────────────────────────────────────────────────────┐
│          Jedis vs Lettuce 파이프라이닝 차이                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Jedis Pipeline]                                                │
│  명시적 버퍼링 → sync() 호출 시 한 번에 전송                    │
│                                                                   │
│  try (Pipeline pipe = jedis.pipelined()) {                       │
│      Response<String> r1 = pipe.set("k1", "v1"); // 버퍼에 축적 │
│      Response<String> r2 = pipe.get("k1");        // 버퍼에 축적 │
│      pipe.sync();  // ← 여기서 한 번에 flush + 응답 수신        │
│      r2.get();     // sync() 이후에만 접근 가능                  │
│  }                                                                │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  [Lettuce Pipeline]                                              │
│  기본적으로 auto-flush (자동 파이프라이닝)                       │
│  각 명령이 즉시 TCP로 전송되지만 응답을 기다리지 않음            │
│                                                                   │
│  // 자동 파이프라이닝 (기본 동작)                                │
│  RedisFuture<String> f1 = async.set("k1", "v1"); // 즉시 전송   │
│  RedisFuture<String> f2 = async.get("k1");        // 즉시 전송   │
│  // Netty가 자동으로 파이프라이닝                                │
│                                                                   │
│  // 수동 배치 모드 (처리량 최대 5배 향상)                        │
│  async.setAutoFlushCommands(false);                              │
│  List<RedisFuture<?>> futures = new ArrayList<>();               │
│  for (int i = 0; i < 1000; i++) {                                │
│      futures.add(async.set("k" + i, "v" + i));                   │
│  }                                                                │
│  async.flushCommands();  // 한 번에 전송                         │
│  LettuceFutures.awaitAll(5, SECONDS, futures...);                │
│  async.setAutoFlushCommands(true);  // 복원                      │
│                                                                   │
│  ⚠️ setAutoFlushCommands(false)는                                │
│     멀티스레드 환경에서 레이스 컨디션 위험!                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Pub/Sub

```java
// 리스너 기반 (명령형)
StatefulRedisPubSubConnection<String, String> pubSub =
    client.connectPubSub();
pubSub.addListener(new RedisPubSubAdapter<>() {
    @Override
    public void message(String channel, String message) {
        // ⚠️ EventLoop에서 실행됨 → 블로킹 금지!
        processAsync(message);
    }
});
pubSub.sync().subscribe("my-channel");

// 리액티브 Pub/Sub (Flux 기반)
RedisPubSubReactiveCommands<String, String> reactive =
    pubSub.reactive();
reactive.subscribe("events:*").subscribe();
reactive.observeChannels()
    .filter(msg -> msg.getChannel().startsWith("events:"))
    .map(ChannelMessage::getMessage)
    .subscribe(this::process);
```

## 클러스터 토폴로지 자동 갱신

```
┌─────────────────────────────────────────────────────────────────┐
│         Cluster Adaptive Topology Refresh 트리거                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┬───────────────────────────────────┐   │
│  │ 트리거               │ 설명                              │   │
│  ├──────────────────────┼───────────────────────────────────┤   │
│  │ MOVED_REDIRECT       │ MOVED 에러 수신 시 갱신           │   │
│  │ ASK_REDIRECT         │ ASK 에러 수신 시 갱신             │   │
│  │ PERSISTENT_RECONNECTS│ 지속적 재연결 실패 시 갱신        │   │
│  │ UNKNOWN_NODE (5.1+)  │ 알 수 없는 노드 발견 시 갱신     │   │
│  │ UNCOVERED_SLOT (5.2+)│ 커버되지 않는 슬롯 발견 시 갱신  │   │
│  └──────────────────────┴───────────────────────────────────┘   │
│                                                                   │
│  ⚠️ 기본값은 비활성화! 반드시 수동으로 켜야 함                   │
│                                                                   │
│  운영 환경에서 이 설정 없으면:                                    │
│  노드 페일오버 후 → stale topology → READONLY 에러 폭주          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Master/Replica 읽기 분산 (ReadFrom)

```
┌─────────────────────────────────────────────────────────────────┐
│                ReadFrom 전략                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────┬────────────────────────────────────┐    │
│  │ 전략               │ 동작                               │    │
│  ├────────────────────┼────────────────────────────────────┤    │
│  │ MASTER             │ 마스터에서만 읽기 (기본값)          │    │
│  │ MASTER_PREFERRED   │ 마스터 우선, 불가 시 레플리카       │    │
│  │ REPLICA            │ 레플리카에서만 읽기                 │    │
│  │ REPLICA_PREFERRED  │ 레플리카 우선, 불가 시 마스터       │    │
│  │ LOWEST_LATENCY     │ 지연시간 가장 낮은 노드             │    │
│  │ ANY                │ 아무 노드                           │    │
│  └────────────────────┴────────────────────────────────────┘    │
│                                                                   │
│  ⚠️ REPLICA 계열 사용 시 복제 지연(replication lag)으로          │
│     오래된 데이터를 읽을 수 있음                                 │
│     → Eventually Consistent 읽기를 허용하는 경우에만 사용        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 운영 주의사항과 트러블슈팅

## 가장 위험한 문제: 메모리 누수

```
┌─────────────────────────────────────────────────────────────────┐
│              Lettuce 메모리 누수 패턴                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  문제 1: 언바운드 커맨드 큐 (가장 위험!)                         │
│                                                                   │
│  Redis 연결 끊김 → 자동 재연결 시도                              │
│  그 사이 발행된 명령 → 무제한 큐에 버퍼링                        │
│  재연결이 오래 걸리면 → 힙 메모리 폭증 → OOM                    │
│                                                                   │
│  기본값: requestQueueSize = Integer.MAX_VALUE (사실상 무제한)    │
│                                                                   │
│  해결:                                                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  ClientOptions.builder()                              │       │
│  │      .requestQueueSize(1000)  // 큐 크기 제한!        │       │
│  │      .disconnectedBehavior(                           │       │
│  │          DisconnectedBehavior.REJECT_COMMANDS)        │       │
│  │      // 끊김 시 즉시 에러 반환                        │       │
│  │      .autoReconnect(true)                             │       │
│  │      .build();                                        │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 2: Dead Connection 미감지 (최대 15분 대기)                 │
│                                                                   │
│  하드웨어 장애 시 TCP RST 없이 연결 유실                         │
│  OS 기본 TCP KeepAlive: 7200초 (2시간) 후에야 감지               │
│  재시도 포함 시 최대 925초(~15분) 대기                            │
│                                                                   │
│  해결: TCP KeepAlive + epoll 설정                                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  KeepAliveOptions.builder()                           │       │
│  │      .idle(Duration.ofSeconds(5))    // 5초 유휴 후   │       │
│  │      .interval(Duration.ofSeconds(5)) // 5초 간격     │       │
│  │      .count(3)                       // 3번 실패 시   │       │
│  │      .enable().build();                               │       │
│  │                                                        │       │
│  │  // 총 감지 시간: 5 + 5×3 = 20초                      │       │
│  │  // (기본 2시간에서 20초로 단축!)                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  문제 3: EventLoop 블로킹 → 전체 시스템 멈춤                    │
│                                                                   │
│  // 절대 하지 말 것!                                              │
│  reactive.get("key").subscribe(value -> {                        │
│      syncCommands.get("other");  // EventLoop 블로킹 → 데드락  │
│  });                                                              │
│                                                                   │
│  // 올바른 방법                                                   │
│  reactive.get("key")                                              │
│      .flatMap(v -> reactive.get("other"))  // 비동기 체이닝      │
│      .subscribe(System.out::println);                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 커넥션 풀이 필요한 경우 vs 불필요한 경우

```
┌─────────────────────────────────────────────────────────────────┐
│            Lettuce 커넥션 풀링 판단 기준                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────┬──────────┬───────────────────┐    │
│  │ 시나리오                 │ 풀 필요? │ 이유              │    │
│  ├──────────────────────────┼──────────┼───────────────────┤    │
│  │ 일반 GET/SET (멀티스레드)│ 불필요   │ 단일 커넥션 공유  │    │
│  │ MULTI/EXEC 트랜잭션     │ 필요     │ 커넥션 상태 변경  │    │
│  │ BLPOP/BRPOP 블로킹      │ 필요     │ 커넥션 점유       │    │
│  │ WATCH 명령              │ 필요     │ 상태 바인딩       │    │
│  │ 리액티브/비동기 워크로드│ 불필요   │ 기본 설계 활용    │    │
│  │ 파이프라인 집중 워크로드│ 권장     │ 처리량 향상       │    │
│  └──────────────────────────┴──────────┴───────────────────┘    │
│                                                                   │
│  경험 법칙:                                                       │
│  "커넥션 상태를 변경하는 명령을 쓰면 풀이 필요하다"              │
│  "상태를 변경하지 않으면 단일 커넥션으로 충분하다"               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 클러스터 환경 함정

```
┌─────────────────────────────────────────────────────────────────┐
│              클러스터 운영 시 주의사항                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┬─────────────────────────────────────────┐   │
│  │ 문제           │ 해결책                                   │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ READONLY 에러  │ Adaptive topology refresh 활성화         │   │
│  │ (페일오버 후)  │ enableAllAdaptiveRefreshTriggers()       │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ DNS 캐싱 문제  │ networkaddress.cache.ttl=0               │   │
│  │ (옛 IP 사용)   │ JVM 시스템 프로퍼티 설정                 │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ 비멱등 명령    │ Command Replay Filter 사용 (6.6+)       │   │
│  │ 중복 실행      │ INCR/DECR 재시도 시 값 2배 증가         │   │
│  ├────────────────┼─────────────────────────────────────────┤   │
│  │ iptables 차단  │ TCP KeepAlive 설정 필수                  │   │
│  │ 후 감지 불가   │ RST 없이 연결 유실 시                    │   │
│  └────────────────┴─────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 최신 동향 (2024-2026)

## Lettuce 6.x~7.x 주요 변경

```
┌─────────────────────────────────────────────────────────────────┐
│              Lettuce 버전별 핵심 변경사항                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────┬─────────────────────────────────────────────────┐     │
│  │ 버전 │ 핵심 변경                                       │     │
│  ├──────┼─────────────────────────────────────────────────┤     │
│  │ 6.0  │ RESP3 지원, Kotlin Coroutine, RxJava3           │     │
│  │ 6.1  │ Micrometer 지원, io_uring, KeepAlive 옵션       │     │
│  │ 6.2  │ RedisCredentialsProvider (동적 인증)             │     │
│  │ 6.3  │ Redis Functions (FCALL), Micrometer Tracing     │     │
│  │ 6.4  │ Hash field expiration, Sharded Pub/Sub          │     │
│  │ 6.5  │ RedisJSON 지원                                   │     │
│  │ 6.6  │ HGETDEL/HGETEX, Command Replay Filter           │     │
│  │ 6.7  │ Vector Sets (Redis 8.0), epoll 기본             │     │
│  │ 6.8  │ RediSearch 지원                                  │     │
│  │ 7.0  │ Redis 2.6~8.4 지원, Java 8+/21 호환            │     │
│  └──────┴─────────────────────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Virtual Thread (Java 21) 지원

```
┌─────────────────────────────────────────────────────────────────┐
│           Virtual Thread와 Lettuce                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Lettuce: 기술적으로 호환되지만 주의 필요                        │
│                                                                   │
│  ├── Lettuce의 I/O는 이미 Netty 기반 논블로킹                   │
│  │   → 가상 스레드의 이점이 제한적                              │
│  │                                                                │
│  ├── 알려진 이슈:                                                │
│  │   ├── 커넥션 풀 + 가상 스레드 → Pool exhausted 버그          │
│  │   │   (Issue #2867, 2024년)                                   │
│  │   └── Netty의 synchronized 블록 → 가상 스레드 핀닝           │
│  │                                                                │
│  └── 권장: 가상 스레드 환경에서도 async/reactive API 사용        │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  Jedis + Virtual Thread:                                         │
│  JedisPool.getResource()가 영구 블로킹되는 버그 존재             │
│  (Apache Commons Pool 이슈)                                      │
│  → Virtual Thread 환경에서는 Lettuce가 더 안전                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 대안 클라이언트: Redisson

```
┌─────────────────────────────────────────────────────────────────┐
│              Redisson: 분산 객체 플랫폼                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Jedis/Lettuce = "Redis 클라이언트"                              │
│  Redisson = "Redis 위의 분산 자바 객체 플랫폼"                   │
│                                                                   │
│  ┌────────────────┬──────────┬──────────┬──────────┐            │
│  │ 기능           │ Jedis    │ Lettuce  │ Redisson │            │
│  ├────────────────┼──────────┼──────────┼──────────┤            │
│  │ 분산 락        │ 수동구현 │ 수동구현 │ RLock    │            │
│  │ 분산 컬렉션    │ 저수준   │ 저수준   │ RMap 등  │            │
│  │ Near Cache     │ 없음     │ 없음     │ 45x 향상 │            │
│  │ JCache API     │ 없음     │ 없음     │ 지원     │            │
│  │ 직렬화 코덱    │ 없음     │ 제한적   │ Kryo 등  │            │
│  │ 분산 스케줄러  │ 없음     │ 없음     │ 지원     │            │
│  │ Reactive       │ 없음     │ 지원     │ 지원     │            │
│  │ Valkey 지원    │ 제한적   │ 호환     │ 완전     │            │
│  └────────────────┴──────────┴──────────┴──────────┘            │
│                                                                   │
│  Redisson 분산 락 (RLock):                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  RLock lock = redisson.getLock("myLock");              │       │
│  │  lock.lock();  // 30초 watchdog 자동 갱신             │       │
│  │  try {                                                 │       │
│  │      // 임계 구역                                     │       │
│  │  } finally {                                           │       │
│  │      lock.unlock();                                    │       │
│  │  }                                                     │       │
│  │                                                        │       │
│  │  내부 동작:                                            │       │
│  │  1. Lua 스크립트로 원자적 잠금 (SET NX PX)            │       │
│  │  2. Watchdog: 인스턴스 살아있는 동안 만료 자동 연장   │       │
│  │  3. pub/sub 채널로 잠금 해제 알림 → busy-wait 없음    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 클라이언트 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                  최종 선택 가이드                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Q1: 분산 락, 분산 컬렉션이 필요한가?                            │
│  │                                                                │
│  ├── YES → Redisson                                              │
│  │                                                                │
│  └── NO → Q2: 비동기/리액티브가 필요한가?                       │
│      │                                                            │
│      ├── YES → Lettuce (유일한 선택)                             │
│      │                                                            │
│      └── NO → Q3: Redis Cluster를 쓰는가?                       │
│          │                                                        │
│          ├── YES → Lettuce (Cluster 비동기 지원)                 │
│          │                                                        │
│          └── NO → Q4: 팀 경험과 프로젝트 규모?                  │
│              │                                                    │
│              ├── 단순/레거시 → Jedis (학습 곡선 낮음)            │
│              └── 새 프로젝트 → Lettuce (Spring Boot 기본값)      │
│                                                                   │
│  ──────────────────────────────────────────────────              │
│                                                                   │
│  요약:                                                            │
│                                                                   │
│  ┌────────────────────────┬──────────────────────┐              │
│  │ 상황                   │ 추천                  │              │
│  ├────────────────────────┼──────────────────────┤              │
│  │ Spring Boot 새 프로젝트│ Lettuce (기본값 유지) │              │
│  │ Spring WebFlux         │ Lettuce              │              │
│  │ 고동시성 비동기 처리   │ Lettuce              │              │
│  │ Redis Cluster + 비동기 │ Lettuce              │              │
│  │ 분산 락/컬렉션 필요   │ Redisson             │              │
│  │ 단순 동기 API만 필요  │ Jedis (레거시 호환)  │              │
│  │ Java 21 Virtual Thread│ Lettuce              │              │
│  │ Valkey 완전 지원       │ Redisson             │              │
│  └────────────────────────┴──────────────────────┘              │
│                                                                   │
│  대부분의 경우: Lettuce를 기본으로 사용하고,                     │
│  분산 락이 필요하면 Redisson을 추가하는 것이 최선이다.           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Spring Boot에서 Jedis로 전환하는 방법

```xml
<!-- Maven: Lettuce 제거 + Jedis 추가 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
    <exclusions>
        <exclusion>
            <groupId>io.lettuce</groupId>
            <artifactId>lettuce-core</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
</dependency>
```

```groovy
// Gradle
implementation('org.springframework.boot:spring-boot-starter-data-redis') {
    exclude group: 'io.lettuce', module: 'lettuce-core'
}
implementation 'redis.clients:jedis'
```

```properties
# application.properties (Jedis 풀 설정)
spring.data.redis.jedis.pool.max-active=50
spring.data.redis.jedis.pool.max-idle=10
spring.data.redis.jedis.pool.min-idle=2
spring.data.redis.jedis.pool.max-wait=2000ms
```

---

# 11. 참고자료

```
[공식 문서]
1. Lettuce Reference Guide
   https://redis.github.io/lettuce/

2. GitHub - redis/lettuce
   https://github.com/redis/lettuce

3. Spring Data Redis - Drivers
   https://docs.spring.io/spring-data/redis/reference/redis/drivers.html

4. Redis Production Usage Guide for Lettuce
   https://redis.io/docs/latest/develop/clients/lettuce/produsage/

[블로그 & 비교]
5. Redis Blog - Jedis vs. Lettuce: An Exploration
   https://redis.io/blog/jedis-vs-lettuce-an-exploration/

6. Redis Blog - Lettuce Joins Redis' Official Client Family
   https://redis.io/blog/lettuce-joins-redis-official-client-family/

7. Spring Boot Issue #10480 - Consider Lettuce instead of Jedis
   https://github.com/spring-projects/spring-boot/issues/10480

8. Baeldung - Introduction to Lettuce
   https://www.baeldung.com/java-redis-lettuce

[고급 설정]
9. Lettuce Wiki - Connection Pooling
   https://github.com/redis/lettuce/wiki/Connection-Pooling

10. Lettuce Wiki - ReadFrom Settings
    https://github.com/lettuce-io/lettuce-core/wiki/ReadFrom-Settings

11. Lettuce Wiki - Pipelining and Command Flushing
    https://github.com/redis/lettuce/wiki/Pipelining-and-command-flushing

[대안 클라이언트]
12. Redisson - Feature Comparison vs Lettuce
    https://redisson.pro/blog/feature-comparison-redisson-vs-lettuce.html

13. Redisson - Distributed Locks Wiki
    https://github.com/redisson/redisson/wiki/8.-distributed-locks-and-synchronizers
```

