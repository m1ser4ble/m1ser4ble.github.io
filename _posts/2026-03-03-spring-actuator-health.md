---
layout: post
title: "Spring Boot Actuator Health"
date: 2026-03-03 23:00:00 +0900
categories: ["Backend", "Spring Boot", "Kubernetes", "DevOps"]
tags: ["Spring Boot Actuator", "Health Endpoint", "Liveness Probe", "Readiness Probe", "Startup Probe", "Kubernetes", "HealthIndicator", "Health Groups", "ApplicationAvailability", "LivenessState", "ReadinessState", "StatusAggregator"]
excerpt: "Spring Boot Actuator Health 문서를 Jekyll 포스트 형식으로 정리했습니다."
source: "/home/dwkim/dwkim/docs/backend/spring-actuator-health.md"
---

**TL;DR**
- Spring Boot Actuator
- Health Endpoint
- Liveness Probe

## 1. Concept
Spring Boot Actuator Health의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. Background
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. Reason
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. Features
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. Detailed Notes

# Spring Boot Actuator Health

> **작성일**: 2026-03-03
> **카테고리**: Backend / Spring Boot / Kubernetes / DevOps
> **포함 내용**: Spring Boot Actuator, Health Endpoint, Liveness Probe, Readiness Probe, Startup Probe, Kubernetes, HealthIndicator, Health Groups, ApplicationAvailability, Graceful Shutdown, Zero-Downtime, 자가 치유, MCP, Prometheus, Micrometer

---

# 1. Spring Boot Actuator란?

## 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                  Spring Boot Actuator                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Actuator = 프로덕션 준비(Production-Ready) 기능을               │
│             애플리케이션에 한방에 번들하는 Spring Boot 서브모듈   │
│                                                                   │
│  이름 유래:                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  제조업 용어 "Actuator"                                     │ │
│  │  = 작은 입력으로 큰 동작을 만드는 기계 장치                 │ │
│  │                                                              │ │
│  │  Spring Boot Actuator도 마찬가지:                            │ │
│  │  의존성 하나(작은 입력) → 거대한 운영 기능(큰 동작)         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 기능 카테고리

```
┌─────────────────────────────────────────────────────────────────┐
│                  Actuator 엔드포인트 카테고리                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┬─────────────────────────────────────────┐     │
│  │  카테고리    │  엔드포인트 예시                         │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  상태/건강   │  /actuator/health                       │     │
│  │              │  /actuator/health/liveness              │     │
│  │              │  /actuator/health/readiness             │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  메트릭      │  /actuator/metrics                      │     │
│  │              │  /actuator/prometheus                    │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  인트로스펙션│  /actuator/beans                        │     │
│  │              │  /actuator/mappings                      │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  설정        │  /actuator/env                          │     │
│  │              │  /actuator/configprops                   │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  런타임 제어 │  /actuator/loggers (로그 레벨 동적 변경)│     │
│  │              │  /actuator/shutdown (앱 종료)            │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  진단        │  /actuator/threaddump                   │     │
│  │              │  /actuator/heapdump                      │     │
│  ├──────────────┼─────────────────────────────────────────┤     │
│  │  DB 마이그레이션│ /actuator/flyway                     │     │
│  │              │  /actuator/liquibase                     │     │
│  └──────────────┴─────────────────────────────────────────┘     │
│                                                                   │
│  기본 노출:                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  HTTP로 기본 노출되는 엔드포인트:                           │ │
│  │  → /actuator/health  (건강 상태)                            │ │
│  │  → /actuator/info    (앱 정보)                              │ │
│  │  → 나머지는 명시적으로 활성화해야 함                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 설치: 정말 의존성 하나면 되나?

## Maven

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

## Gradle (Kotlin DSL)

```kotlin
implementation("org.springframework.boot:spring-boot-starter-actuator")
```

## Bazel (rules_jvm_external)

```python
# MODULE.bazel
maven.install(
    artifacts = [
        "org.springframework.boot:spring-boot-starter-actuator:3.2.0",
    ],
)

# BUILD
deps = ["@maven//:org_springframework_boot_spring_boot_starter_actuator"]
```

```
┌─────────────────────────────────────────────────────────────────┐
│                  Bazel Maven 좌표 변환 규칙                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Maven 좌표:                                                     │
│  org.springframework.boot:spring-boot-starter-actuator           │
│                                                                   │
│  Bazel 라벨:                                                     │
│  @maven//:org_springframework_boot_spring_boot_starter_actuator  │
│                                                                   │
│  변환 규칙:                                                      │
│  ├── dots(.)   → underscores(_)                                  │
│  ├── hyphens(-) → underscores(_)                                 │
│  └── colons(:) → double underscores(__)  (groupId와 artifactId) │
│                                                                   │
│  특별한 게 없음.                                                 │
│  같은 Maven 아티팩트를 Bazel 문법으로 선언할 뿐이다.            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 의존성만 추가하면 바로 얻는 것

```
┌─────────────────────────────────────────────────────────────────┐
│                  설정 0줄로 얻는 것들                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  의존성 추가 직후, 아무 설정 없이:                               │
│                                                                   │
│  GET /actuator                                                   │
│  → 디스커버리 엔드포인트 (사용 가능한 엔드포인트 목록)          │
│                                                                   │
│  GET /actuator/health                                            │
│  → { "status": "UP" }                                            │
│                                                                   │
│  GET /actuator/info                                              │
│  → {}                                                            │
│                                                                   │
│  결론: 설정 0줄로 핵심 건강 체크가 동작한다.                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## application.yml 설정 (개발 vs 프로덕션)

### 개발 환경

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "*"        # 모든 엔드포인트 노출 (개발용)
  endpoint:
    health:
      show-details: always  # 상세 정보 항상 표시
```

### 프로덕션 환경

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, prometheus  # 필요한 것만 노출
  endpoint:
    health:
      show-details: when-authorized  # 인증된 사용자만 상세 보기
  server:
    port: 8081                       # 별도 관리 포트
```

---

# 3. 등장 배경: 왜 Liveness/Readiness가 필요한가?

## Spring Boot 2.3 이전의 문제 (2020년 5월 이전)

```
┌─────────────────────────────────────────────────────────────────┐
│          Spring Boot 2.3 이전: 단일 /health의 비극               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  문제 상황:                                                      │
│  ├── 단일 /actuator/health에 liveness와 readiness 모두 연결     │
│  ├── 외부 의존성(DB, Redis 등)도 health에 포함                  │
│  └── K8s가 이 단일 엔드포인트로 liveness 체크                   │
│                                                                   │
│  시나리오: DB가 일시적으로 느려진 경우                           │
│                                                                   │
│  DB 느려짐                                                       │
│       │                                                          │
│       ▼                                                          │
│  /health → DOWN (DB 연결 타임아웃)                               │
│       │                                                          │
│       ▼                                                          │
│  K8s: "Pod이 죽었다!" (liveness 실패)                            │
│       │                                                          │
│       ├──→ Pod 1 재시작                                          │
│       ├──→ Pod 2 재시작                                          │
│       ├──→ Pod 3 재시작                                          │
│       └──→ 모든 Pod 동시 재시작!                                 │
│                │                                                 │
│                ▼                                                 │
│  트래픽 처리 불가! (전체 서비스 중단)                            │
│                                                                   │
│  그런데... Pod은 멀쩡했다!                                       │
│  DB가 느렸을 뿐이다!                                             │
│  재시작해도 DB는 안 고쳐진다!                                    │
│                                                                   │
│  이것이 바로 "캐스케이딩 실패 / Thundering Herd"                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Kubernetes의 원래 의도

```
┌─────────────────────────────────────────────────────────────────┐
│          K8s는 처음부터 분리를 원했다                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Kubernetes 설계:                                                │
│  ├── livenessProbe: "이 컨테이너가 살아있는가?"                  │
│  ├── readinessProbe: "이 컨테이너가 요청 받을 수 있는가?"       │
│  └── 처음부터 두 개를 분리하고 있었음                            │
│                                                                   │
│  Java/Spring 앱의 문제:                                          │
│  └── 이 두 상태를 애플리케이션 레벨에서 표현할 방법이 없었음     │
│                                                                   │
│  Spring Boot 2.3 (2020년 5월):                                   │
│  └── 그 간극을 메운 것                                           │
│  └── ApplicationAvailability API 도입                            │
│  └── /health/liveness, /health/readiness 분리                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Liveness vs Readiness: 근본적 차이

## 핵심 멘탈 모델

```
┌─────────────────────────────────────────────────────────────────┐
│          Liveness vs Readiness: 한눈에 비교                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┬─────────────────────┬──────────────────────────┐  │
│  │  개념    │  질문               │  K8s 반응 (실패 시)      │  │
│  ├──────────┼─────────────────────┼──────────────────────────┤  │
│  │ Liveness │ "이 앱이            │ Pod 재시작 (RESTART)     │  │
│  │          │  살아있는가?"       │ → 강력한 조치            │  │
│  ├──────────┼─────────────────────┼──────────────────────────┤  │
│  │Readiness │ "이 앱이 트래픽을   │ 로드밸런서에서 제거      │  │
│  │          │  받을 수 있는가?"   │ (REMOVE, 재시작 안 함)   │  │
│  │          │                     │ → 부드러운 조치          │  │
│  └──────────┴─────────────────────┴──────────────────────────┘  │
│                                                                   │
│  비유:                                                           │
│  ├── Liveness  = "환자가 살아있는가?" → 아니면 심폐소생술       │
│  └── Readiness = "환자가 퇴원 가능한가?" → 아니면 병실에 유지   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Liveness: /actuator/health/liveness

```
┌─────────────────────────────────────────────────────────────────┐
│          Liveness = "이 앱을 재시작해야 하나?"                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DOWN이어야 하는 경우 (재시작이 필요한 경우):                    │
│  ├── 복구 불가능한 데드락                                        │
│  ├── 내부 상태의 비가역적 손상                                   │
│  └── 재시작만이 유일한 해결책인 상황                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  절대 규칙:                                                  │ │
│  │  외부 시스템(DB, API, 메시지 브로커)을                       │ │
│  │  liveness에 절대 포함하지 마라!                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  왜? 가상 시나리오:                                              │
│                                                                   │
│  DB 다운                                                         │
│  │                                                               │
│  ├── DB를 liveness에 포함했다면:                                 │
│  │   ├── /liveness → DOWN                                        │
│  │   ├── K8s가 Pod 1 재시작                                      │
│  │   ├── Pod 1 올라옴, DB 여전히 다운                            │
│  │   ├── /liveness → 또 DOWN                                     │
│  │   ├── K8s가 Pod 2, 3도 재시작                                 │
│  │   ├── 모든 Pod 재시작 중 → 트래픽 처리 불가                   │
│  │   └── 캐스케이딩 실패!                                        │
│  │                                                               │
│  └── 올바른 접근:                                                │
│      ├── DB 다운 ≠ 앱이 고장났다는 뜻                            │
│      ├── 트래픽을 멈추면 됨 (readiness의 역할)                   │
│      └── 재시작할 필요 없음                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Readiness: /actuator/health/readiness

```
┌─────────────────────────────────────────────────────────────────┐
│          Readiness = "이 앱이 지금 트래픽을 받을 수 있나?"       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  REFUSING_TRAFFIC인 경우 (트래픽 못 받는 경우):                  │
│  ├── 시작 중 / 워밍업 중                                         │
│  ├── 필수 의존성(DB, Redis 등) 불가용                            │
│  ├── 일시적 과부하 상태                                          │
│  └── 그레이스풀 셧다운 진행 중                                   │
│                                                                   │
│  DOWN이면:                                                       │
│  ├── K8s가 LB에서 제거 → 트래픽 중단                             │
│  ├── Pod은 재시작되지 않음 (여전히 살아있으므로)                  │
│  └── 복구되면 LB에 다시 추가 → 트래픽 자동 재개                 │
│                                                                   │
│  핵심: readiness는 "일시적"이다.                                 │
│  Pod을 죽이지 않고, 트래픽만 잠시 멈추고, 회복을 기다린다.      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 상태 열거형

```java
// Liveness 상태
public enum LivenessState implements AvailabilityState {
    CORRECT,   // 앱 살아있음 → HTTP 200 (UP)
    BROKEN     // 치명적 내부 장애 → HTTP 503 (DOWN)
}

// Readiness 상태
public enum ReadinessState implements AvailabilityState {
    ACCEPTING_TRAFFIC,  // 준비됨 → HTTP 200 (UP)
    REFUSING_TRAFFIC    // 미준비 → HTTP 503 (DOWN)
}
```

---

# 5. 애플리케이션 생명주기 상태 전이

## 시작 시퀀스

```
┌─────────────────────────────────────────────────────────────────┐
│          시작 시퀀스: Liveness/Readiness 상태 전이                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┬──────────┬──────────────────┬───────────┐ │
│  │  단계            │ Liveness │ Readiness        │  상황     │ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  앱 시작 중      │ BROKEN   │ REFUSING_TRAFFIC │  컨텍스트 │ │
│  │                  │          │                  │  미초기화  │ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  컨텍스트        │ CORRECT  │ REFUSING_TRAFFIC │  빈 준비  │ │
│  │  리프레시 완료   │          │                  │  시작태스크│ │
│  │                  │          │                  │  실행 중   │ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  Application     │ CORRECT  │ ACCEPTING_TRAFFIC│  트래픽   │ │
│  │  ReadyEvent      │          │                  │  수신 준비│ │
│  │                  │          │                  │  완료!    │ │
│  └──────────────────┴──────────┴──────────────────┴───────────┘ │
│                                                                   │
│  시간순:                                                         │
│                                                                   │
│  JVM 시작 ─→ Context 초기화 ─→ Bean 생성 ─→ Ready!              │
│  │            │                  │              │                 │
│  │            │                  │              ▼                 │
│  │            │                  │        ReadyEvent 발행         │
│  │            │                  │        Readiness → ACCEPTING   │
│  │            │                  ▼                                │
│  │            │            ContextRefreshed                       │
│  │            │            Liveness → CORRECT                    │
│  │            ▼                                                  │
│  │       BROKEN / REFUSING                                       │
│  ▼                                                               │
│  앱 프로세스 시작                                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 셧다운 시퀀스

```
┌─────────────────────────────────────────────────────────────────┐
│          셧다운 시퀀스: 제로 다운타임의 열쇠                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┬──────────┬──────────────────┬───────────┐ │
│  │  단계            │ Liveness │ Readiness        │  상황     │ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  SIGTERM 수신    │ CORRECT  │ REFUSING_TRAFFIC │  K8s가    │ │
│  │                  │          │                  │  즉시 LB  │ │
│  │                  │          │                  │  에서 제거│ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  그레이스풀      │ CORRECT  │ REFUSING_TRAFFIC │  진행중인 │ │
│  │  드레인          │          │                  │  요청 완료│ │
│  │                  │          │                  │  대기     │ │
│  ├──────────────────┼──────────┼──────────────────┼───────────┤ │
│  │  컨텍스트 종료   │  무관    │  무관            │  Pod 종료│ │
│  └──────────────────┴──────────┴──────────────────┴───────────┘ │
│                                                                   │
│  핵심 포인트:                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  셧다운 시 readiness → REFUSING_TRAFFIC이                   │ │
│  │  제로 다운타임 배포의 열쇠다.                                │ │
│  │                                                              │ │
│  │  SIGTERM → readiness DOWN → LB 제거 → 새 요청 안 들어옴    │ │
│  │  → 기존 요청 완료 → 안전하게 종료                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. /actuator/health 내부 동작

## 응답 구조 (show-details: always)

```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": {
        "database": "PostgreSQL",
        "validationQuery": "isValid()"
      }
    },
    "diskSpace": {
      "status": "UP",
      "details": {
        "total": 107374182400,
        "free": 85899345920,
        "threshold": 10485760,
        "path": "/app/."
      }
    },
    "ping": {
      "status": "UP"
    },
    "redis": {
      "status": "UP",
      "details": {
        "version": "7.2.4"
      }
    }
  }
}
```

## 자동 구성된 HealthIndicator 목록

```
┌─────────────────────────────────────────────────────────────────┐
│          자동 등록되는 HealthIndicator 목록                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────┬──────────────────────────────┐    │
│  │  HealthIndicator         │  활성화 조건                 │    │
│  ├──────────────────────────┼──────────────────────────────┤    │
│  │  DiskSpaceHealthIndicator│  항상 (디스크 여유 공간)     │    │
│  │  PingHealthIndicator     │  항상 (단순 ping 응답)       │    │
│  ├──────────────────────────┼──────────────────────────────┤    │
│  │  DataSourceHealth-       │  DataSource 빈 존재 시       │    │
│  │  Indicator               │  (JDBC DB 연결 확인)         │    │
│  │  RedisHealthIndicator    │  Spring Data Redis           │    │
│  │                          │  클래스패스에 존재 시        │    │
│  │  MongoHealthIndicator    │  Spring Data MongoDB 시      │    │
│  │  KafkaHealthIndicator    │  Spring Kafka 시             │    │
│  │  RabbitHealthIndicator   │  Spring AMQP 시              │    │
│  │  Elasticsearch-          │  Spring Data ES 시           │    │
│  │  HealthIndicator         │                              │    │
│  ├──────────────────────────┼──────────────────────────────┤    │
│  │  LivenessStateHealth-    │  K8s 환경 감지 시 또는       │    │
│  │  Indicator               │  probes.enabled: true        │    │
│  │  ReadinessStateHealth-   │  K8s 환경 감지 시 또는       │    │
│  │  Indicator               │  probes.enabled: true        │    │
│  └──────────────────────────┴──────────────────────────────┘    │
│                                                                   │
│  원리: 클래스패스에 라이브러리가 있으면 자동으로 등록됨          │
│  → Spring Boot의 자동 구성(Auto-Configuration) 마법              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 내부 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│          /actuator/health 내부 아키텍처                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  HTTP GET /actuator/health                                       │
│       │                                                          │
│       ▼                                                          │
│  HealthEndpoint                                                  │
│       │                                                          │
│       ▼                                                          │
│  CompositeHealthContributor (모든 contributor 순회)              │
│       │                                                          │
│       ├── DataSourceHealthIndicator ────→ DB 연결 확인           │
│       ├── RedisHealthIndicator ──────→ Redis 연결 확인           │
│       ├── DiskSpaceHealthIndicator ──→ 디스크 여유 확인          │
│       ├── LivenessStateHealthIndicator                           │
│       │   └── ApplicationAvailabilityBean 에서 상태 조회         │
│       └── [커스텀 HealthIndicator들]                             │
│                                                                   │
│       │  (각 indicator가 Health 객체 반환)                       │
│       ▼                                                          │
│  StatusAggregator                                                │
│       │                                                          │
│       ├── 모든 컴포넌트 UP → 전체 UP                             │
│       └── 하나라도 DOWN  → 전체 DOWN                             │
│                                                                   │
│       │                                                          │
│       ▼                                                          │
│  HTTP 200 (UP) 또는 HTTP 503 (DOWN)                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 상태 집계 규칙

```
┌─────────────────────────────────────────────────────────────────┐
│          StatusAggregator: 하나라도 DOWN이면 전체 DOWN           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  예시 1: 모두 정상                                               │
│  ├── db: UP                                                      │
│  ├── redis: UP                                                   │
│  ├── diskSpace: UP                                               │
│  └── 전체: UP → HTTP 200                                         │
│                                                                   │
│  예시 2: Redis 장애                                              │
│  ├── db: UP                                                      │
│  ├── redis: DOWN  ← 이것 하나 때문에                             │
│  ├── diskSpace: UP                                               │
│  └── 전체: DOWN → HTTP 503                                       │
│                                                                   │
│  상태 우선순위:                                                  │
│  DOWN > OUT_OF_SERVICE > UP > UNKNOWN                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. Health Groups와 Kubernetes 프로브

## Health Groups란?

```
┌─────────────────────────────────────────────────────────────────┐
│          Health Groups: HealthIndicator의 논리적 그룹            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  개념:                                                           │
│  ├── HealthIndicator의 이름 있는 부분 집합(Subset)               │
│  ├── 각 그룹이 자체 URL로 접근 가능                              │
│  └── Liveness, Readiness는 사실 Health Group으로 구현됨          │
│                                                                   │
│  설정 예시:                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  management:                                                 │ │
│  │    endpoint:                                                 │ │
│  │      health:                                                 │ │
│  │        group:                                                │ │
│  │          readiness:                                          │ │
│  │            include: readinessState, db  # DB를 readiness에  │ │
│  │          liveness:                                           │ │
│  │            include: livenessState       # liveness는 최소한 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  접근 URL:                                                       │
│  ├── /actuator/health/readiness → readinessState + db만 체크    │
│  └── /actuator/health/liveness  → livenessState만 체크          │
│                                                                   │
│  핵심:                                                           │
│  liveness 그룹에는 외부 시스템을 넣지 않는다!                    │
│  readiness 그룹에는 필요한 외부 시스템을 넣을 수 있다.          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Kubernetes 자동 감지

```
┌─────────────────────────────────────────────────────────────────┐
│          K8s 자동 감지: 프로브 자동 활성화                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Spring Boot의 자동 감지 메커니즘:                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  if (System.getenv("KUBERNETES_SERVICE_HOST") != null) {    │ │
│  │      // K8s 환경으로 판단                                    │ │
│  │      // liveness, readiness 프로브 자동 활성화               │ │
│  │  }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  K8s 환경에서:                                                   │
│  → /actuator/health/liveness 자동 활성화                         │
│  → /actuator/health/readiness 자동 활성화                        │
│                                                                   │
│  K8s 밖에서 (로컬, Docker 단독):                                 │
│  → 수동 활성화 필요                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  management:                                                 │ │
│  │    health:                                                   │ │
│  │      probes:                                                 │ │
│  │        enabled: true   # 수동으로 프로브 활성화              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Spring Boot 4부터:                                              │
│  → 기본적으로 모든 환경에서 프로브 활성화                        │
│  → K8s 감지 여부와 무관하게 동작                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Startup Probe (Spring Boot 2.6+)

```
┌─────────────────────────────────────────────────────────────────┐
│          Startup Probe: 느린 시작을 위한 안전장치                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  문제:                                                           │
│  ├── 앱 시작이 오래 걸리는 경우 (대규모 Spring Context)          │
│  ├── liveness 체크가 시작 중에 실패                              │
│  └── K8s가 "죽었다"고 판단 → 무한 재시작                        │
│                                                                   │
│  Startup Probe의 역할:                                           │
│  ├── 성공할 때까지 liveness/readiness 체크 비활성화              │
│  ├── startup 성공 → liveness/readiness 체크 시작                 │
│  └── startup 실패 (timeout) → Pod 재시작                         │
│                                                                   │
│  최대 허용 시작 시간 계산:                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  failureThreshold * periodSeconds = 최대 허용 시작 시간     │ │
│  │                                                              │ │
│  │  예: failureThreshold: 30, periodSeconds: 10                 │ │
│  │  → 30 * 10 = 300초 (5분) 이내에 시작해야 함                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  시간순:                                                         │
│  Pod 생성 → [startupProbe 반복 체크]                             │
│              │                                                   │
│              ├── 성공 → livenessProbe + readinessProbe 시작     │
│              └── 계속 실패 → threshold 초과 → Pod 재시작        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 커스텀 HealthIndicator 작성

## 기본 구현

```java
@Component
public class ExternalApiHealthIndicator implements HealthIndicator {

    private final ExternalApiClient client;

    public ExternalApiHealthIndicator(ExternalApiClient client) {
        this.client = client;
    }

    @Override
    public Health health() {
        boolean reachable = client.ping();
        if (reachable) {
            return Health.up()
                    .withDetail("url", "https://api.example.com")
                    .withDetail("responseTime", "45ms")
                    .build();
        }
        return Health.down()
                .withDetail("url", "https://api.example.com")
                .withDetail("reason", "unreachable")
                .build();
    }
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│          커스텀 HealthIndicator 등록 규칙                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  빈 이름 규칙:                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  클래스명: ExternalApiHealthIndicator                        │ │
│  │  접미사 "HealthIndicator" 자동 제거                          │ │
│  │  → /actuator/health 응답에 "externalApi"로 표시             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  AbstractHealthIndicator 상속 (권장):                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  @Component                                                  │ │
│  │  public class ExternalApiHealthIndicator                     │ │
│  │      extends AbstractHealthIndicator {                       │ │
│  │                                                              │ │
│  │      @Override                                               │ │
│  │      protected void doHealthCheck(                           │ │
│  │              Health.Builder builder) throws Exception {      │ │
│  │          // 예외 발생 시 자동으로 DOWN + 에러 메시지         │ │
│  │          client.ping();                                      │ │
│  │          builder.up()                                        │ │
│  │                 .withDetail("url", "https://api.example.com")│ │
│  │                 ;                                            │ │
│  │      }                                                       │ │
│  │  }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  AbstractHealthIndicator의 장점:                                 │
│  ├── 예외 발생 시 자동으로 DOWN 상태 + 에러 메시지 래핑         │
│  └── try-catch 보일러플레이트 제거                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 프로그래매틱 상태 변경

```
┌─────────────────────────────────────────────────────────────────┐
│          ApplicationAvailability로 상태 직접 변경                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  @Component                                                  │ │
│  │  public class CircuitBreakerListener {                       │ │
│  │                                                              │ │
│  │      private final ApplicationEventPublisher publisher;      │ │
│  │                                                              │ │
│  │      // 외부 서비스 장애 감지 시 readiness를 DOWN으로        │ │
│  │      public void onCircuitOpen() {                           │ │
│  │          AvailabilityChangeEvent.publish(                    │ │
│  │              publisher,                                      │ │
│  │              this,                                           │ │
│  │              ReadinessState.REFUSING_TRAFFIC                 │ │
│  │          );                                                  │ │
│  │      }                                                       │ │
│  │                                                              │ │
│  │      // 복구 시 readiness를 UP으로                           │ │
│  │      public void onCircuitClosed() {                         │ │
│  │          AvailabilityChangeEvent.publish(                    │ │
│  │              publisher,                                      │ │
│  │              this,                                           │ │
│  │              ReadinessState.ACCEPTING_TRAFFIC                │ │
│  │          );                                                  │ │
│  │      }                                                       │ │
│  │  }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  활용 시나리오:                                                  │
│  ├── 서킷 브레이커 OPEN → readiness DOWN → 트래픽 차단         │
│  ├── 외부 API 할당량 초과 → readiness DOWN → 잠시 쉼           │
│  └── 복구 감지 → readiness UP → 트래픽 재개                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 프로덕션 보안 고려사항

## 위험한 엔드포인트들

```
┌─────────────────────────────────────────────────────────────────┐
│          프로덕션에서 주의해야 할 위험 엔드포인트                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────┬────────────────────────────────────────┐ │
│  │  엔드포인트       │  위험                                  │ │
│  ├───────────────────┼────────────────────────────────────────┤ │
│  │  /actuator/env    │  환경변수, 비밀번호, API 키 노출       │ │
│  │                   │  → DB 패스워드, 토큰 등 유출 가능      │ │
│  ├───────────────────┼────────────────────────────────────────┤ │
│  │  /actuator/       │  JVM 전체 메모리 덤프                  │ │
│  │  heapdump         │  → 메모리에 있는 비밀 정보 포함 가능   │ │
│  │                   │  → 파일 크기 수백 MB~수 GB             │ │
│  ├───────────────────┼────────────────────────────────────────┤ │
│  │  /actuator/       │  로그 레벨 실시간 변경 가능            │ │
│  │  loggers          │  → DEBUG로 변경 시 정보 노출           │ │
│  │                   │  → 과도한 로깅으로 성능 저하           │ │
│  ├───────────────────┼────────────────────────────────────────┤ │
│  │  /actuator/       │  앱 원격 종료 가능                     │ │
│  │  shutdown         │  → 기본 비활성화 (enabled: false)      │ │
│  │                   │  → 절대 인터넷에 노출 금지             │ │
│  └───────────────────┴────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 프로덕션 권장 설정

```
┌─────────────────────────────────────────────────────────────────┐
│          프로덕션 보안 전략                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 필요한 것만 노출                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  management:                                                 │ │
│  │    endpoints:                                                │ │
│  │      web:                                                    │ │
│  │        exposure:                                             │ │
│  │          include: health, prometheus  # 이 두 개만!          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  2. 별도 관리 포트 사용                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  management:                                                 │ │
│  │    server:                                                   │ │
│  │      port: 8081  # 메인 포트(8080)와 분리                   │ │
│  │                  # 인터넷에 노출하지 않음                    │ │
│  │                  # 내부 네트워크에서만 접근 가능             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  3. Spring Security로 인증 추가                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  @Configuration                                              │ │
│  │  public class ActuatorSecurityConfig {                       │ │
│  │      @Bean                                                   │ │
│  │      public SecurityFilterChain actuatorSecurity(            │ │
│  │              HttpSecurity http) throws Exception {           │ │
│  │          http.requestMatcher(                                │ │
│  │                  EndpointRequest.toAnyEndpoint())            │ │
│  │              .authorizeRequests(auth ->                      │ │
│  │                  auth.anyRequest().hasRole("ACTUATOR"))      │ │
│  │              .httpBasic();                                   │ │
│  │          return http.build();                                │ │
│  │      }                                                       │ │
│  │  }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  요약:                                                           │
│  ├── 노출 최소화: health, prometheus만                           │
│  ├── 포트 분리: 8081 (내부 전용)                                 │
│  └── 인증 필수: Spring Security로 접근 제어                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 완전한 Kubernetes 배포 설정 예시

## application.yml (전체)

```yaml
server:
  port: 8080
  shutdown: graceful                     # 그레이스풀 셧다운 활성화

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s      # 셧다운 시 최대 30초 대기

management:
  server:
    port: 8081                           # 별도 관리 포트
  endpoints:
    web:
      exposure:
        include: health, prometheus      # 필요한 것만 노출
  endpoint:
    health:
      probes:
        enabled: true                    # 프로브 활성화
      group:
        readiness:
          include: readinessState        # readiness 그룹
        liveness:
          include: livenessState         # liveness 그룹 (최소한)
```

## Kubernetes Deployment YAML (전체)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # 한 번에 1개 추가 Pod 생성
      maxUnavailable: 0     # 항상 최소 replicas 유지 (Zero Downtime)
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: my-app
          image: my-app:latest
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 8081
              name: management

          # Startup Probe: 앱 시작 완료 확인
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: management
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 30       # 30 * 10 = 300초(5분) 허용

          # Liveness Probe: 앱이 살아있는지 확인
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: management
            periodSeconds: 10
            failureThreshold: 3        # 3번 연속 실패 시 재시작

          # Readiness Probe: 트래픽 수신 가능 확인
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: management
            periodSeconds: 5
            failureThreshold: 3        # 3번 연속 실패 시 LB 제거

          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
                # preStop: K8s LB 업데이트 전 잠시 대기
                # iptables 전파 시간을 벌어주는 안전 장치
```

## 동작 시나리오

```
┌─────────────────────────────────────────────────────────────────┐
│          Rolling Update: Zero-Downtime 배포 흐름                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [배포 시작] → 새 Pod 생성 (v2)                                  │
│       │                                                          │
│       ▼                                                          │
│  [startupProbe] → /liveness 체크                                 │
│       │           성공할 때까지 반복 (최대 5분)                   │
│       │                                                          │
│       ▼  (startup 성공)                                          │
│  [readinessProbe] → /readiness 체크                              │
│       │             UP → LB에 추가 → 트래픽 수신 시작           │
│       │                                                          │
│       ▼  (새 Pod v2 정상 운영)                                   │
│  ┌──────────────────────────────────────────────────┐            │
│  │  이 시점에서:                                      │            │
│  │  ├── 새 Pod (v2): 트래픽 받는 중 ✅                │            │
│  │  └── 구 Pod (v1): 아직 트래픽 받는 중              │            │
│  └──────────────────────────────────────────────────┘            │
│       │                                                          │
│       ▼  (구 Pod 종료 시작)                                      │
│  [구 Pod v1]                                                     │
│       │                                                          │
│       ├── preStop: sleep 5 (LB 전파 시간 확보)                   │
│       ├── readiness → REFUSING_TRAFFIC                           │
│       ├── LB에서 제거 → 새 요청 안 들어옴                        │
│       ├── 진행 중인 요청 완료 대기 (최대 30초)                   │
│       └── 안전하게 종료                                          │
│                                                                   │
│  결과:                                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  어떤 순간에도 최소 1개 Pod이 트래픽 처리                    │ │
│  │  → Zero Downtime!                                            │ │
│  │                                                              │ │
│  │  maxUnavailable: 0 덕분에 구 Pod은 새 Pod이                  │ │
│  │  ready 된 후에만 종료 시작                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## preStop과 Graceful Shutdown의 관계

```
┌─────────────────────────────────────────────────────────────────┐
│          preStop + Graceful Shutdown = 완벽한 종료                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  시간순:                                                         │
│                                                                   │
│  K8s: "이 Pod 종료해"                                            │
│       │                                                          │
│       ▼                                                          │
│  [preStop: sleep 5]  (5초 대기)                                  │
│  │  → 이 동안 K8s가 iptables / Service 업데이트                  │
│  │  → 새 요청이 이 Pod으로 안 오게 됨                            │
│       │                                                          │
│       ▼                                                          │
│  [SIGTERM 전달]                                                  │
│  │  → Spring Boot: readiness → REFUSING_TRAFFIC                 │
│  │  → server.shutdown: graceful 활성화                           │
│       │                                                          │
│       ▼                                                          │
│  [Graceful Drain]  (최대 30초)                                   │
│  │  → 진행 중인 HTTP 요청 완료 대기                              │
│  │  → 새 요청은 503 거부                                         │
│       │                                                          │
│       ▼                                                          │
│  [Context Close]                                                 │
│  │  → 빈 소멸, DB 커넥션 풀 종료                                │
│       │                                                          │
│       ▼                                                          │
│  Pod 종료 완료                                                   │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  terminationGracePeriodSeconds (60초)                        │ │
│  │  = preStop(5초) + SIGTERM~종료(최대 55초)                    │ │
│  │                                                              │ │
│  │  이 시간 내에 종료 안 되면 SIGKILL (강제 종료)              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 정리

```
┌─────────────────────────────────────────────────────────────────┐
│                         요약                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Actuator란?                                                     │
│  └── 하나의 의존성으로 프로덕션 운영 기능을 제공하는             │
│      Spring Boot 모듈                                            │
│                                                                   │
│  설치:                                                           │
│  └── 의존성 하나 + 최소 설정                                     │
│      (Maven / Gradle / Bazel 모두 동일)                          │
│                                                                   │
│  Liveness:                                                       │
│  ├── "앱이 살아있나?"                                            │
│  ├── 실패 시 K8s가 Pod 재시작                                    │
│  └── 외부 시스템(DB, Redis 등) 절대 포함 금지!                   │
│                                                                   │
│  Readiness:                                                      │
│  ├── "트래픽 받을 수 있나?"                                      │
│  ├── 실패 시 LB에서 제거 (재시작 아님)                           │
│  └── 복구 시 자동 재개                                           │
│                                                                   │
│  왜 분리?                                                        │
│  └── 단일 /health에 모든 것 넣으면 캐스케이딩 실패 위험          │
│                                                                   │
│  핵심 원칙:                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  "DB 다운 = 트래픽 멈춤 (readiness의 역할)                  │ │
│  │           ≠ 앱 재시작 (liveness의 역할이 아님)"              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  K8s 자동 감지:                                                  │
│  └── KUBERNETES_SERVICE_HOST 환경변수로 자동 활성화              │
│                                                                   │
│  Startup Probe:                                                  │
│  └── 앱 시작이 오래 걸릴 때 liveness 체크 지연                   │
│                                                                   │
│  프로덕션 보안:                                                  │
│  ├── 별도 관리 포트 (8081)                                       │
│  ├── 최소 엔드포인트 노출 (health, prometheus)                   │
│  └── Spring Security로 인증                                      │
│                                                                   │
│  Zero-Downtime 배포:                                             │
│  ├── Graceful Shutdown + preStop hook                            │
│  ├── readiness → REFUSING_TRAFFIC → LB 제거 → 드레인 → 종료    │
│  └── maxUnavailable: 0으로 항상 최소 Pod 수 유지                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Spring Boot Actuator`, `Health Endpoint`, `Liveness Probe`, `Readiness Probe`, `Startup Probe`, `Kubernetes`, `HealthIndicator`, `Health Groups`, `ApplicationAvailability`, `LivenessState`, `ReadinessState`, `StatusAggregator`, `Graceful Shutdown`, `Zero-Downtime`, `Rolling Update`, `preStop`, `terminationGracePeriodSeconds`, `Cascading Failure`, `Thundering Herd`, `Spring Boot 2.3`, `KUBERNETES_SERVICE_HOST`, `Prometheus`, `Micrometer`, `management.server.port`, `show-details`, `probes.enabled`, `AbstractHealthIndicator`, `AvailabilityChangeEvent`, `CompositeHealthContributor`, `Spring Security`, `자가 치유`, `캐스케이딩 실패`

