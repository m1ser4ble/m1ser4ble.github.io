---
layout: single
title: "Asynchronous Request-Reply와 Server-Side Orchestration 완전 가이드"
date: 2026-03-12 23:00:00 +0900
categories: backend
excerpt: "Asynchronous Request-Reply와 서버사이드 오케스트레이션은 장기 실행 작업을 안정적으로 처리하고 분산 트랜잭션 복잡도를 줄이는 설계 방법이다."
toc: true
toc_sticky: true
tags: [asynchronous, requestreply, orchestration, saga, workflow, temporal]
source: "/home/dwkim/dwkim/docs/backend/async-request-reply-서버사이드-오케스트레이션.md"
---
TL;DR
- Asynchronous Request-Reply와 서버사이드 오케스트레이션은 접수와 실행을 분리해 장기 작업을 비동기로 처리하고 중앙에서 흐름을 조율하는 아키텍처 패턴이다.
- 대규모 분산 시스템에서 가용성과 복구 가능성, 감사 가능성을 동시에 확보하려면 워크플로 기반 오케스트레이션과 Saga 패턴이 필요하다.
- HTTP 202 패턴, Polling/SSE/Webhook 선택지, Saga 보상 트랜잭션, Workflow Engine(Temporal/Step Functions 등) 비교와 운영 베스트 프랙티스를 함께 다룬다.

## 1. 개념
Asynchronous Request-Reply와 서버사이드 오케스트레이션은 접수와 실행을 분리해 장기 작업을 비동기로 처리하고 중앙에서 흐름을 조율하는 아키텍처 패턴이다.

## 2. 배경
동기 HTTP의 타임아웃, 모바일 연결 불안정, 서비스 체인 지연 누적 문제를 해결하기 위해 비동기 처리와 오케스트레이션이 표준처럼 채택되었다.

## 3. 이유
대규모 분산 시스템에서 가용성과 복구 가능성, 감사 가능성을 동시에 확보하려면 워크플로 기반 오케스트레이션과 Saga 패턴이 필요하다.

## 4. 특징
HTTP 202 패턴, Polling/SSE/Webhook 선택지, Saga 보상 트랜잭션, Workflow Engine(Temporal/Step Functions 등) 비교와 운영 베스트 프랙티스를 함께 다룬다.

## 5. 상세 내용

# Asynchronous Request-Reply와 Server-Side Orchestration 완전 가이드

> **작성일**: 2026-03-12
> **카테고리**: Backend / Distributed Systems / Async Patterns
> **키워드**: Asynchronous Request-Reply, HTTP 202, Polling, Webhook, Orchestration, Choreography, Saga, Temporal, Step Functions, Durable Functions, Conductor, Camunda, Event Sourcing, CQRS, BFF, Circuit Breaker, Idempotency, Workflow Engine

---

# 1. Asynchronous Request-Reply란?

## 1.1 동기 HTTP의 근본적 한계

```
┌─────────────────────────────────────────────────────────────────┐
│                동기 HTTP 요청의 구조적 한계                      │
│                                                                 │
│  문제 1: 로드밸런서 타임아웃                                    │
│  ├── AWS ALB 기본 타임아웃: 60초                                │
│  ├── Nginx 기본 타임아웃: 60초                                  │
│  └── 영상 인코딩, ML 추론, 대용량 처리 → 수 분~수 시간 소요    │
│                                                                 │
│  문제 2: 클라이언트 연결 유지 불가                              │
│  ├── 모바일 앱: 백그라운드 전환, 네트워크 끊김                  │
│  ├── 브라우저: 사용자 탭 전환, 페이지 이동                      │
│  └── 수 분간 연결 유지 = UX 재앙                                │
│                                                                 │
│  문제 3: 서비스 체인 지연 누적                                  │
│  ├── A → B → C → D 호출 체인                                   │
│  ├── 각 서비스 평균 200ms → 총 800ms                            │
│  └── 하나라도 느려지면 전체 타임아웃                             │
│                                                                 │
│  문제 4: 리소스 낭비                                            │
│  ├── 응답 대기 중 connection 점유                               │
│  ├── 동시 처리 가능 요청 수 급감                                │
│  └── 서버 스레드 고갈 → 전체 서비스 다운                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 비동기 패턴이 필요한 이유

```
┌─────────────────────────────────────────────────────────────────┐
│              동기 vs 비동기 처리 비교                            │
│                                                                 │
│  [동기 방식] — 모든 것이 한 번에                                │
│                                                                 │
│  Client ──POST /report──→ Server ──────처리 중──────→           │
│         ←──────────── 5분 후 200 OK ─────────────←             │
│         (연결 유지 5분... 타임아웃 위험!)                        │
│                                                                 │
│  [비동기 방식] — 접수와 처리를 분리                              │
│                                                                 │
│  Client ──POST /report──→ Server                                │
│         ←── 202 Accepted ──                                     │
│         (Location: /jobs/abc)                                   │
│         (Retry-After: 5)                                        │
│                                                                 │
│         ──GET /jobs/abc──→ Server                               │
│         ←── 200 { status: "processing" }                        │
│                                                                 │
│         ──GET /jobs/abc──→ Server                               │
│         ←── 302 Found (Location: /reports/xyz)                  │
│                                                                 │
│         ──GET /reports/xyz──→ Server                            │
│         ←── 200 OK { 최종 결과 }                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Big Tech가 "백엔드가 파이프라인을 소유해야 한다"고 결론내린 이유

```
┌─────────────────────────────────────────────────────────────────┐
│       프론트엔드 직접 호출 vs 백엔드 오케스트레이션              │
│                                                                 │
│  [안티패턴: 프론트엔드 직접 호출]                                │
│                                                                 │
│  ┌──────────┐                                                   │
│  │ Frontend │──→ Cart Service                                   │
│  │          │──→ Inventory Service                              │
│  │          │──→ Pricing Service                                │
│  │          │──→ User Service                                   │
│  │          │──→ Shipping Service                               │
│  └──────────┘                                                   │
│  문제: 5개 API 호출, 내부 토폴로지 노출, 보안 취약              │
│                                                                 │
│  [권장: 백엔드 오케스트레이션]                                   │
│                                                                 │
│  ┌──────────┐     ┌────────────────────┐                        │
│  │ Frontend │──→  │ BFF / Orchestrator │                        │
│  └──────────┘     │  ├→ Cart Service   │                        │
│  단일 요청!       │  ├→ Inventory Svc  │                        │
│                   │  ├→ Pricing Svc    │                        │
│                   │  └→ User Service   │                        │
│                   └────────────────────┘                        │
│  장점: 단일 엔드포인트, 보안 집중, 네트워크 최적화              │
│                                                                 │
│  Netflix, Uber, Airbnb, DoorDash 모두 이 구조 채택             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어 사전 (Terminology Dictionary)

```
┌─────────────────────────────────────────────────────────────────┐
│                    용어 어원 사전                                │
│                                                                 │
│  각 기술 용어의 풀네임, 어원, 유래를 정리                       │
│  "왜 이 단어가 선택되었는가?"에 초점                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 용어 | 풀네임 | 어원 / 유래 | 최초 등장 |
|------|--------|------------|-----------|
| **Asynchronous** | a- + syn + chronos | 그리스어. a-(not) + syn(together) + chronos(time) = "동시에 일어나지 않는". 1735년 최초 기록 | 1735 |
| **Reply** vs **Response** | Request-Reply Pattern | EIP(Enterprise Integration Patterns, 2003)에서 의도적 구분. Response = HTTP 동기 응답, Reply = 별도 채널로 돌아오는 비동기 메시지. Reply channel은 point-to-point로 requestor에게만 반환 | 2003 |
| **Orchestration** | Orchestra + -ation | 고대 그리스어 orchesthai("to dance"). 오케스트라 지휘자가 각 악기에 지시하듯 중앙 조정자가 서비스를 조율. 음악 용어 1840년, 은유적 용법 1883년. SOA 공식 사용 2002년 BPEL부터 | 1840 / 2002 |
| **Choreography** | khoreia + graphia | 그리스어 khoreia("choral dance") + graphia("writing"). 안무사 없이 무용수들이 독립적으로 동작하듯 서비스들이 이벤트에 반응. W3C WS-CDL(2004)에서 공식화 | 2004 |
| **Saga** | Old Norse "saga" | 고대 북유럽어로 "story, tale, history" (장편 서사시). Garcia-Molina & Salem(1987)이 장기 트랜잭션을 여러 챕터(단계)로 분해하는 은유로 채택 | 1987 |
| **202 Accepted** | HTTP Status Code | RFC 2616(1999)에서 정의. "의도적으로 non-committal(비확약적)" — 요청을 받아들였지만 완료를 보장하지 않음. 배치 프로세스를 위해 설계. RFC 9110(2022)에서 현행 정의 | 1999 |
| **Temporal** | 라틴어 temporalis | "of time, 시간의". 워크플로가 며칠~몇 년에 걸쳐 실행되며 시간적 연속성을 유지한다는 의미. Maxim Fateev & Samar Abbas가 2019년 설립 | 2019 |
| **Step Functions** | State Machine Steps | "단계별(step by step)" 상태 머신. 각 step이 하나의 state이고 순서대로 통과. AWS Lambda Functions와의 연계를 암시. 2016년 출시 | 2016 |
| **Durable Functions** | Durable = 내구성 있는 | 전통적 serverless는 stateless로 실행 중단 시 상태 소실. Durable = "인프라 장애에도 상태가 살아남는". Samar Abbas의 Durable Task Framework 기반. 2017년 프리뷰 | 2017 |
| **Idempotent** | idem + potens | 라틴어. idem("the same") + potens("powerful"). 1870년 수학자 Benjamin Peirce가 대수학에서 창안. "여러 번 실행해도 동일 결과를 내는 연산" | 1870 |
| **Callback** | Call + Back | 전화(telephone) 은유. "원래 전화를 건 쪽에서 다시 전화를 거는 것". 프로그래밍에서는 외부 함수가 작업 완료 후 "다시 전화를 걸어주는" 함수 | 1980s |
| **Webhook** | Web + Hook | Jeff Lindsay가 2007년 5월 블로그에서 창안. 프로그래밍의 hook(커스텀 코드 삽입 포인트) + Web(HTTP). "user-defined HTTP callbacks" | 2007 |
| **BFF** | Backend for Frontend | Phil Calcado가 SoundCloud에서 용어 창안. Sam Newman이 2015년 11월 공식 문서화. 각 프론트엔드 경험에 특화된 전용 백엔드 | 2015 |
| **Circuit Breaker** | 전기 차단기 은유 | Michael Nygard, "Release It!"(2007). 과부하 시 차단기가 열려 전류 차단하듯, 서비스 호출 실패 시 즉시 오류 반환. Netflix Hystrix(2012)가 대중화 | 2007 |
| **Bulkhead** | 선박 격벽 | Michael Nygard, "Release It!"(2007). 배의 수밀 구획처럼 서비스별 독립 리소스 풀 할당. 한 서비스 장애가 전체로 전파되는 것을 방지 | 2007 |
| **Workflow** | Work + Flow | 1949년 최초 기록. 20세기 초 제조업 기원 (Frederick Taylor, Henry Gantt). 1980년대 FileNet의 David Siegel이 소프트웨어 업계에서 현대적 용법 사용 | 1949 |

---

# 3. 기술 진화 연대표 (Evolution Timeline)

```
┌─────────────────────────────────────────────────────────────────┐
│  1987                                                           │
│  ├── Saga 논문 (Garcia-Molina, Salem) — 단일 DB LLT 해결       │
│  │                                                              │
│  1993                                                           │
│  ├── IBM MQSeries 출시 — 엔터프라이즈 메시지 큐의 효시          │
│  │                                                              │
│  1999                                                           │
│  ├── RFC 2616 (HTTP/1.1) — HTTP 202 Accepted 공식 정의          │
│  │                                                              │
│  2002                                                           │
│  ├── BPEL4WS 1.0 (IBM + Microsoft + BEA) — Orchestration 표준  │
│  │                                                              │
│  2003                                                           │
│  ├── EIP 출판 (Hohpe, Woolf) — Request-Reply 패턴 공식화       │
│  ├── BPEL4WS 1.1 → OASIS 제출                                  │
│  │                                                              │
│  2007                                                           │
│  ├── WS-BPEL 2.0 OASIS 최고 등급 표준 확정                     │
│  ├── "Release It!" (Nygard) — Circuit Breaker, Bulkhead         │
│  ├── Webhook 용어 탄생 (Jeff Lindsay)                           │
│  ├── Apache Camel 1.0 출시                                      │
│  │                                                              │
│  2011─2012                                                      │
│  ├── "Microservices" 용어 등장 (Lewis, Fowler)                  │
│  ├── AWS Simple Workflow Service (SWF) 출시                     │
│  ├── Netflix Hystrix 오픈소스 — Circuit Breaker 대중화          │
│  │                                                              │
│  2014                                                           │
│  ├── Chris Richardson, Saga 패턴 마이크로서비스 맥락 현대화     │
│  ├── RFC 7240 (respond-async) — 비동기 HTTP 협상 표준화         │
│  ├── Reactive Manifesto v2.0 — Message-Driven 선언              │
│  │                                                              │
│  2015─2016                                                      │
│  ├── Sam Newman, BFF 패턴 공식 문서화                           │
│  ├── Netflix Conductor 오픈소스 공개                            │
│  ├── AWS Step Functions 출시                                    │
│  │                                                              │
│  2017                                                           │
│  ├── Azure Durable Functions 프리뷰                             │
│  ├── Uber Cadence 오픈소스 공개                                 │
│  │                                                              │
│  2019─2020                                                      │
│  ├── Temporal Technologies 설립 (Cadence 후계자)                │
│  ├── Temporal 오픈소스 공개 — "Durable Execution" 개념 정립     │
│  │                                                              │
│  2022                                                           │
│  ├── RFC 9110 (HTTP Semantics) — 202 Accepted 현행 정의         │
│  │                                                              │
│  2024─2025                                                      │
│  ├── Temporal Cloud 매출 18개월 만에 4.4배 성장                 │
│  ├── Inngest Series A $21M 유치                                 │
│  ├── Restate: Thoughtworks Radar "Trial" 등재                   │
│  ├── AI 에이전트 워크플로 수요 폭발                             │
│  ├── 글로벌 Managed Temporal Services 시장 $1.2B (2024)         │
│  │                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 핵심 패턴 상세

## 4.1 HTTP 202 Polling 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│           HTTP 202 Accepted + Location + Retry-After            │
│                                                                 │
│  [요청 제출]                                                    │
│  POST /jobs                                                     │
│  Body: { "type": "report", "params": {...} }                    │
│  → 202 Accepted                                                 │
│    Location: /jobs/{id}/status                                  │
│    Retry-After: 5                                               │
│    Body: { "jobId": "abc", "statusUrl": "/jobs/abc/status" }    │
│                                                                 │
│  [상태 조회 - 진행 중]                                          │
│  GET /jobs/abc/status                                           │
│  → 200 OK                                                       │
│    Body: { "status": "PROCESSING", "progress": 45 }             │
│                                                                 │
│  [상태 조회 - 완료]                                             │
│  GET /jobs/abc/status                                           │
│  → 302 Found                                                    │
│    Location: /jobs/abc/result                                   │
│                                                                 │
│  [결과 조회]                                                    │
│  GET /jobs/abc/result                                           │
│  → 200 OK                                                       │
│    Body: { 최종 결과 데이터 }                                   │
│                                                                 │
│  핵심 헤더:                                                     │
│  ├── Location: 상태를 조회할 URL                                │
│  └── Retry-After: 권장 폴링 간격 (초)                           │
│                                                                 │
│  적합한 상황:                                                   │
│  ├── 콜백 엔드포인트 제공이 어려운 브라우저 앱                  │
│  ├── 방화벽으로 인바운드 불가한 환경                            │
│  └── WebSocket/Webhook 미지원 레거시 시스템                     │
│                                                                 │
│  중요 규칙:                                                     │
│  ├── 유효하지 않은 요청은 즉시 400 반환 (202 아님!)             │
│  └── 처리 오류 시 Location URL에 오류 저장 + 4xx 반환           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 Callback / Webhook 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              Callback / Webhook 패턴                            │
│                                                                 │
│  [요청 제출 + 콜백 URL 등록]                                    │
│  POST /jobs                                                     │
│  Body: {                                                        │
│    "data": "...",                                               │
│    "callback_url": "https://client.example.com/hook"            │
│  }                                                              │
│  → 202 Accepted + job_id                                        │
│                                                                 │
│  [작업 완료 시 서버가 콜백 호출]                                │
│  POST https://client.example.com/hook                           │
│  Headers: {                                                     │
│    "X-Signature": "sha256=abcdef..."  (HMAC 서명)              │
│  }                                                              │
│  Body: {                                                        │
│    "job_id": "...",                                             │
│    "status": "completed",                                       │
│    "result": "..."                                              │
│  }                                                              │
│                                                                 │
│  구현 시 고려사항:                                              │
│  ├── 클라이언트가 공개 HTTPS 엔드포인트 필요                    │
│  ├── 멱등성 처리 필수 (중복 콜백 가능)                          │
│  ├── HMAC-SHA256 서명으로 위변조 방지                           │
│  └── 실패 시 지수 백오프 재시도 (최대 1~3일)                    │
│                                                                 │
│  Stripe Webhook 전략:                                           │
│  ├── 실패 시 3일간 자동 재시도                                  │
│  ├── 핸들러 반드시 멱등성 보장                                  │
│  └── 2xx 외 응답 = 재시도 트리거                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.3 메시지 큐 기반 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              메시지 큐 기반 비동기 처리                          │
│                                                                 │
│  Client → API Server → [Message Queue] → Worker → Result Store  │
│         ←─ 202 ──┘                                              │
│                                                                 │
│  요청을 큐에 적재, 별도 워커가 비동기로 처리                    │
│  서비스 간 결합도 감소 + 부하 평탄화                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 기술 | 처리량 | 라우팅 | 메시지 보존 | 운영 복잡도 | 적합 사례 |
|------|--------|--------|------------|------------|-----------|
| **Apache Kafka** | 수백만 msg/s | 토픽 기반 | 장기 보존, 재생 가능 | 높음 | 실시간 스트리밍, 이벤트 소싱 |
| **RabbitMQ** | 수만 msg/s | 유연한 Exchange/Binding | 소비 후 삭제 (기본) | 중간 | 복잡한 라우팅, 지연 큐 |
| **AWS SQS** | 높음 (관리형) | 단순 | 최대 14일 | 낮음 (완전 관리형) | AWS 네이티브, 서버리스 |
| **Redis Streams** | 높음 (메모리) | Consumer Group | 메모리 의존 | 낮음 | 경량 마이크로서비스 통신 |

## 4.4 SSE와 WebSocket을 활용한 실시간 상태 전달

```
┌─────────────────────────────────────────────────────────────────┐
│          Polling vs SSE vs WebSocket 비교                       │
│                                                                 │
│  [HTTP Polling]                                                 │
│  Client ──GET──→ Server (변화 없음)                             │
│  Client ──GET──→ Server (변화 없음)                             │
│  Client ──GET──→ Server (결과 있음!)                            │
│  문제: 불필요한 요청 다수, 지연 = 폴링 간격                    │
│                                                                 │
│  [Server-Sent Events (SSE)]                                     │
│  Client ──GET──→ Server (text/event-stream)                     │
│  Server ──data: {"progress": 30}──→ Client                      │
│  Server ──data: {"progress": 60}──→ Client                      │
│  Server ──data: {"status": "done"}──→ Client                    │
│  장점: HTTP/2 호환, 자동 재연결, 방화벽 친화적                  │
│  적합: AI 스트리밍, 진행률 표시, 알림                           │
│                                                                 │
│  [WebSocket]                                                    │
│  Client ←──양방향 전이중──→ Server                               │
│  장점: 양방향 통신, 최소 오버헤드, 실시간 상호작용              │
│  적합: 채팅, 게임, 협업 편집, AI 에이전트 대화                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 항목 | HTTP Polling | SSE | WebSocket |
|------|-------------|-----|-----------|
| **방향** | 단방향 (클라이언트 → 서버) | 단방향 (서버 → 클라이언트) | 양방향 전이중 |
| **프로토콜** | HTTP | HTTP (text/event-stream) | WS (HTTP에서 업그레이드) |
| **자동 재연결** | 클라이언트 구현 필요 | 브라우저 내장 | 클라이언트 구현 필요 |
| **HTTP/2 호환** | 자연 호환 | 멀티플렉싱 활용 | 별도 연결 |
| **방화벽** | 문제 없음 | 문제 없음 | 일부 프록시 차단 가능 |
| **바이너리 데이터** | Base64 인코딩 필요 | 텍스트만 | 바이너리 프레임 지원 |
| **서버 부하** | 높음 (반복 요청) | 중간 (연결 유지) | 낮음 (효율적 프레임) |
| **적합 시나리오** | 레거시, 방화벽 제한 | 진행률, AI 스트리밍 | 채팅, 게임, 실시간 협업 |

**실무 권장**: 비동기 작업 진행률 전달에는 SSE가 가장 적합. 양방향 상호작용이 필요하면 WebSocket. 레거시 호환성이 우선이면 HTTP 202 Polling.

## 4.5 Orchestration vs Choreography (지휘 vs 안무)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Orchestration: 지휘자 모델]                                   │
│                                                                 │
│       ┌───────────────┐                                         │
│       │  Orchestrator │  ← 중앙 지휘자                          │
│       │  (지휘자)     │                                         │
│       └───┬───┬───┬───┘                                         │
│           │   │   │                                             │
│           ▼   ▼   ▼                                             │
│         Svc  Svc  Svc    ← 지시를 받고 실행                     │
│          A    B    C                                            │
│                                                                 │
│  장점: 가시성 높음, 에러 처리 명확, 디버깅 용이                 │
│  단점: Orchestrator가 SPOF, 병목 가능                           │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  [Choreography: 안무 모델]                                      │
│                                                                 │
│    Svc A ──event──→ Svc B ──event──→ Svc C                      │
│      ↑                                   │                      │
│      └──────────event────────────────────┘                      │
│                                                                 │
│  장점: 결합도 낮음, 독립 확장, SPOF 없음                        │
│  단점: 추적 어려움, 디버깅 복잡, 이벤트 체인 파악 난해          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 비교 항목 | Orchestration | Choreography |
|----------|---------------|--------------|
| **가시성** | 높음 - 중앙에서 전체 흐름 추적 | 낮음 - 분산된 이벤트 추적 어려움 |
| **결합도** | 높음 - Orchestrator 의존 | 낮음 - 서비스 간 직접 의존 없음 |
| **에러 처리** | 명확 - 한 곳에서 처리 | 복잡 - 각 서비스 개별 처리 |
| **SPOF** | 존재 - Orchestrator 장애 시 중단 | 없음 - 분산형 |
| **확장성** | Orchestrator 병목 가능 | 서비스 독립 확장 용이 |
| **디버깅** | 쉬움 - 흐름 한 곳 집중 | 어려움 - 이벤트 체인 추적 필요 |
| **비즈니스 로직 변경** | Orchestrator 수정으로 집중 관리 | 이벤트 스키마 변경 시 다수 영향 |
| **적합 상황** | 결제, 주문, 감사 필요 | 알림, 분석, 느슨한 통합 |

**업계 합의: Hybrid 모델** - 도메인 내 복잡한 트랜잭션은 Orchestration, 도메인 간 느슨한 이벤트 흐름은 Choreography.

## 4.6 Saga 패턴

### 4.6.1 Orchestration Saga

```
┌─────────────────────────────────────────────────────────────────┐
│             Orchestration Saga: 주문 처리 예시                   │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │ Saga Orchestrator│                                           │
│  └───────┬─────────┘                                            │
│          │                                                      │
│          ├──→ T1: 주문 생성 (Order Service)                     │
│          │     └─ C1: 주문 취소                                 │
│          │                                                      │
│          ├──→ T2: 결제 처리 (Payment Service)  ← Pivot Tx      │
│          │     └─ C2: 결제 환불                                 │
│          │                                                      │
│          ├──→ T3: 재고 감소 (Inventory Service)                 │
│          │     └─ (재시도 가능 - Forward Recovery)               │
│          │                                                      │
│          └──→ T4: 배송 생성 (Shipping Service)                  │
│                └─ (재시도 가능 - Forward Recovery)               │
│                                                                 │
│  성공: T1 → T2 → T3 → T4 → DONE                               │
│  T3 실패 시: T3 실패 → C2(환불) → C1(취소) → ROLLED BACK       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6.2 Choreography Saga

```
┌─────────────────────────────────────────────────────────────────┐
│             Choreography Saga: 이벤트 기반                      │
│                                                                 │
│  Order Service ──OrderCreated──→                                │
│                                 Payment Service                 │
│                    PaymentProcessed──→                           │
│                                       Inventory Service         │
│                          InventoryReduced──→                    │
│                                              Shipping Service   │
│                                                                 │
│  실패 시: 각 서비스가 보상 이벤트를 역방향으로 발행             │
│                                                                 │
│  장점: 중앙 오케스트레이터 없음, Greenfield 프로젝트에 적합     │
│  단점: 참여 서비스 증가 시 이벤트 흐름 추적 어려움              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6.3 Pivot Transaction과 Recovery 전략

```
┌─────────────────────────────────────────────────────────────────┐
│                  Pivot Transaction (불귀점)                      │
│                                                                 │
│  [보상 가능 트랜잭션]  →  [Pivot Tx]  →  [재시도 가능 트랜잭션] │
│                                                                 │
│  재고 예약 (보상 가능)    결제 승인     배송 요청 (재시도 가능)  │
│  주문 생성 (보상 가능)    (취소 불가)   알림 발송 (재시도 가능)  │
│                                                                 │
│  Pivot Tx 이전: Backward Recovery (보상 트랜잭션으로 되돌림)    │
│  Pivot Tx 이후: Forward Recovery (재시도로 완료까지 진행)       │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Forward Recovery: 실패한 단계를 재시도하여 앞으로 진행         │
│  ├── 네트워크 일시 오류 등 재시도로 해결 가능한 경우            │
│  └── Pivot Tx 이후 단계에서 주로 사용                           │
│                                                                 │
│  Backward Recovery: 역순으로 보상 트랜잭션 실행                 │
│  ├── Step 1(완료) → Step 2(완료) → Step 3(실패)                │
│  │                    ↓ Backward Recovery                       │
│  │   Step 2 보상 실행 ← Step 1 보상 실행                       │
│  └── Pivot Tx 이전 단계에서 사용                                │
│                                                                 │
│  보상 트랜잭션 원칙:                                            │
│  ├── 멱등성(idempotent) 필수                                    │
│  └── 재시도 가능(retryable) 필수                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6.4 Isolation 부재 대응책

Saga는 ACID의 I(Isolation)를 보장하지 않아 다음 이상 현상이 발생할 수 있다:

| 이상 현상 | 설명 | 대응책 |
|----------|------|--------|
| **Lost Update** | 두 Saga가 같은 데이터를 동시에 수정 | Semantic Lock, Commutative Updates |
| **Dirty Read** | 진행 중인 Saga의 미완료 데이터를 다른 Saga가 읽음 | Semantic Lock |
| **Fuzzy Read** | 같은 Saga 내 다른 단계에서 불일치 데이터 읽음 | Version File |

| 대응책 | 설명 |
|--------|------|
| **Semantic Lock** | 보상 가능 트랜잭션이 `IN_PROGRESS` 플래그를 설정, 다른 Saga가 해당 레코드 접근 차단 |
| **Commutative Updates** | 순서에 무관하게 동일 결과 산출하는 연산 설계 (예: debit/credit은 교환 가능) |
| **Version File** | 업데이트 내역을 기록해 나중에 재정렬 적용 가능하도록 함 |
| **By Value** | 비즈니스 리스크 수준에 따라 동적으로 동시성 메커니즘 선택 (고위험 거래는 더 강한 잠금) |

## 4.7 Event Sourcing + CQRS

```
┌─────────────────────────────────────────────────────────────────┐
│                  Event Sourcing + CQRS                           │
│                                                                 │
│  [Event Sourcing: 이벤트 소싱]                                  │
│                                                                 │
│  상태를 현재 값 대신 발생한 이벤트의 순서열로 저장              │
│                                                                 │
│  [Command] → Append event to Event Store                        │
│  [Event Store] (append-only 로그)                               │
│    → OrderCreated  { orderId, items, ts }                       │
│    → OrderPaid     { orderId, amount, ts }                      │
│    → OrderShipped  { orderId, trackingNo, ts }                  │
│                                                                 │
│  이벤트 재생(replay)으로 어느 시점의 상태로도 복원 가능         │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  [CQRS: Command Query Responsibility Segregation]               │
│                                                                 │
│  쓰기(Command)와 읽기(Query)의 경로를 분리                      │
│                                                                 │
│  Command → Write Model → Event 발행 → Event Store               │
│                                        ↓                        │
│                                  Read Model 업데이트             │
│                                  (Projection)                   │
│                                        ↓                        │
│  Query → Read Model (비정규화된 고성능 조회용 DB)               │
│                                                                 │
│  장점:                                                          │
│  ├── 감사 로그 자동 확보 (이벤트 = 히스토리)                    │
│  ├── 시계열 조회 가능                                           │
│  ├── 읽기/쓰기 독립 확장                                        │
│  └── 이벤트 재생으로 버그 재현 용이                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Workflow Engine 상세

## 5.1 Temporal

```
┌─────────────────────────────────────────────────────────────────┐
│                    Temporal 아키텍처                             │
│                                                                 │
│  [클라이언트 SDK]                                               │
│         ↓ gRPC                                                  │
│  [Frontend Service]  ← 모든 요청 진입점                         │
│         ↓                                                       │
│  [History Service]   ← Workflow 실행 상태를 DB에 영속화         │
│         ↓                                                       │
│  [Matching Service]  ← Task Queue 관리, Worker-Task 매칭        │
│         ↓                                                       │
│  [Worker Service]    ← 클러스터 내부 시스템 워크플로 처리       │
│                                                                 │
│  [Worker Process]    ← 사용자 코드가 실행되는 외부 프로세스     │
│    - Workflow Worker : 워크플로 코드 실행 (결정론적 필수)       │
│    - Activity Worker : 외부 API, DB 등 비결정론적 작업 실행     │
│                                                                 │
│  핵심 개념:                                                     │
│  ├── Workflow: 결정론적 오케스트레이션 코드 (I/O 직접 불가)     │
│  ├── Activity: 외부 호출, DB 쿼리 등 실제 작업                  │
│  ├── Task Queue: Worker가 long-polling으로 태스크를 가져감      │
│  ├── Signal: 실행 중 Workflow에 외부 이벤트/데이터 주입         │
│  ├── Query: 실행 중 Workflow 상태를 동기적으로 조회             │
│  ├── Timer: 수십 년 단위도 가능한 내구성 대기(sleep)            │
│  └── Event History: Workflow 생애주기 완전 로그 → 재생으로 복원 │
│                                                                 │
│  Durable Execution 보장:                                        │
│  "인프라 중단 시 Event History 재생으로 정확히 중단 지점부터    │
│   재개, 진행 손실 없음"                                         │
│                                                                 │
│  탄생 배경:                                                     │
│  Amazon SWF(Fateev) → Azure Durable Task FW(Abbas) →           │
│  Uber Cadence → Temporal (2019)                                 │
│  코드 복잡도 약 5배 감소가 핵심 혁신                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 항목 | 내용 |
|------|------|
| **언어 지원** | Go, Java, Python, TypeScript, .NET, PHP (공식 SDK) |
| **가격** | Self-Hosted: 무료 (MIT). Temporal Cloud: Action 기반 종량제 |
| **확장성** | Worker 수평 확장, 수천 동시 인스턴스. Salesforce, Snap 대규모 사용 |
| **오픈소스** | MIT 라이선스, 완전 오픈소스 |

## 5.2 AWS Step Functions

```
┌─────────────────────────────────────────────────────────────────┐
│                  AWS Step Functions                              │
│                                                                 │
│  Amazon States Language (ASL, JSON 기반 DSL)로 State Machine    │
│  정의. 2024년 re:Invent 이후 JSONata가 권장 쿼리 언어 추가.    │
│                                                                 │
│  상태(State) 유형:                                              │
│  ├── Task     : 실제 작업 (Lambda, ECS, HTTP API 등)            │
│  ├── Wait     : 지정 시간/시각까지 일시 정지                    │
│  ├── Choice   : 조건 분기 (if/else, switch)                     │
│  ├── Parallel : 독립 브랜치 병렬 처리                           │
│  ├── Map      : 배열 각 항목에 자식 워크플로 병렬 실행          │
│  ├── Pass     : 입력 → 출력 그대로 전달 (디버깅용)             │
│  └── Succeed/Fail : 명시적 성공/실패 종료                       │
│                                                                 │
│  에러 처리:                                                     │
│  "Retry": [{ "ErrorEquals": ["States.TaskFailed"],              │
│              "IntervalSeconds": 2,                              │
│              "MaxAttempts": 3,                                  │
│              "BackoffRate": 2.0 }]                              │
│  "Catch": [{ "ErrorEquals": ["States.ALL"],                     │
│              "Next": "HandleError" }]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 항목 | Standard Workflow | Express Workflow |
|------|-------------------|-----------------|
| **실행 보장** | Exactly-once | At-least-once |
| **최대 실행 시간** | 1년 | 5분 |
| **감사 로그** | 전체 이벤트 히스토리 | CloudWatch Logs |
| **적합 사례** | 장기 실행, 감사 필요 | 고빈도 이벤트, IoT |
| **과금** | 상태 전환 1,000건/$0.025 | 실행 100만 건/$1.00 |

## 5.3 Azure Durable Functions

```
┌─────────────────────────────────────────────────────────────────┐
│               Azure Durable Functions 6가지 패턴                │
│                                                                 │
│  1. Function Chaining (체이닝)                                  │
│     A → B → C (각 함수 출력이 다음 입력)                        │
│                                                                 │
│  2. Fan-out / Fan-in (병렬 분산 + 결과 집약)                    │
│     Orchestrator → [Activity A, B, C, D] → 결과 집약            │
│                                                                 │
│  3. Async HTTP API                                              │
│     장기 실행 워크플로를 HTTP로 노출                            │
│     자동으로 202 + 상태 엔드포인트 제공                         │
│                                                                 │
│  4. Human Interaction (인간 개입)                                │
│     외부 이벤트(승인) 대기 + Durable Timer 타임아웃             │
│                                                                 │
│  5. Monitoring (모니터링)                                       │
│     반복적 폴링 워크플로 (while loop + durable timer)           │
│                                                                 │
│  6. Aggregator (Stateful Entities)                              │
│     다수 이벤트를 하나의 Actor로 집약                           │
│                                                                 │
│  아키텍처: Orchestrator Function + Activity Function             │
│  백엔드: Azure Storage 또는 Netherite                           │
│  언어: C#, JavaScript/TypeScript, Python, Java, PowerShell      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 Netflix Conductor

```
┌─────────────────────────────────────────────────────────────────┐
│                  Netflix Conductor                               │
│                                                                 │
│  2016년 Netflix가 오픈소스로 공개.                              │
│  현재 Orkes 팀이 conductor-oss/conductor로 관리.                │
│                                                                 │
│  특징:                                                          │
│  ├── JSON DSL로 워크플로 정의 (코드 변경 없이 플로우 수정)      │
│  ├── REST API / gRPC로 워크플로 기동, 조회, 관리                │
│  ├── Worker는 별도 프로세스로 독립 실행                         │
│  ├── Web UI에서 워크플로 시각화 및 편집 가능                    │
│  ├── 중첩 루프, 동적 분기, 서브워크플로, 수천 태스크 지원       │
│  └── Redis/Postgres/MySQL/Cassandra 스토리지 플러그인           │
│                                                                 │
│  활용 분야:                                                     │
│  ├── 미디어 인코딩                                              │
│  ├── e-커머스 주문 관리                                         │
│  ├── CI/CD 파이프라인                                           │
│  └── 금융 서비스                                                │
│                                                                 │
│  라이선스: Apache 2.0                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.5 Camunda

```
┌─────────────────────────────────────────────────────────────────┐
│                  Camunda (BPMN 2.0)                             │
│                                                                 │
│  BPMN 2.0 및 DMN 표준 기반 프로세스 오케스트레이션 플랫폼.     │
│  Camunda 8부터 Zeebe 엔진으로 교체.                             │
│                                                                 │
│  Zeebe 아키텍처:                                                │
│  ├── 관계형 DB 대신 이벤트 스트리밍 기반 → DB 병목 제거         │
│  ├── 수평 확장 가능한 분산 아키텍처                              │
│  ├── BPMN 2.0으로 워크플로 모델링                               │
│  ├── DMN으로 의사결정 규칙 정의                                 │
│  └── 2024년 AI 기능: Camunda Copilot (자연어 → BPMN 생성)      │
│                                                                 │
│  강점:                                                          │
│  ├── 규제 산업 (금융, 보험, 의료)                               │
│  ├── 비즈니스-IT 협업이 중요한 대규모 BPM                       │
│  └── ISO/규정 준수 프로세스                                     │
│                                                                 │
│  라이선스: Camunda 8.6+ Enterprise 라이선스 필요                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.6 신흥 Workflow Engine: Inngest, Restate

```
┌─────────────────────────────────────────────────────────────────┐
│  [Inngest] — 이벤트 주도 서버리스 워크플로 엔진                 │
│                                                                 │
│  Event API → Event Stream → Runner → Queue → Function Executor  │
│                                                                 │
│  ├── Trigger: 이벤트, cron, 웹훅으로 함수 기동                  │
│  ├── Steps: 각 step 독립 retry 가능                             │
│  ├── 빌트인 Flow Control: Concurrency, Throttling, Debouncing   │
│  ├── Lambda, Cloudflare Workers, Vercel에서 직접 실행           │
│  └── 2024년 Series A $21M 유치                                  │
│                                                                 │
│  [Restate] — Apache Flink 원작자들이 만든 Durable Execution     │
│                                                                 │
│  ├── Flink 스트림 처리 + Workflow-as-Code + 이벤트 로그 결합    │
│  ├── Virtual Objects, Durable Promises 개념 도입                │
│  ├── Saga 패턴 및 Durable State Machine 내장 지원               │
│  ├── Lambda, Cloudflare Workers에서 직접 실행 가능              │
│  └── Thoughtworks Technology Radar "Trial" 등재 (2024)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. 학술적 기반 (Academic Foundation)

## 6.1 핵심 논문 및 표준

| 문서 | 연도 | 핵심 기여 |
|------|------|----------|
| **Sagas (Garcia-Molina, Salem)** | 1987 | 장기 트랜잭션을 독립 단계 시퀀스로 분해 + 보상 트랜잭션 개념 최초 체계화 |
| **Enterprise Integration Patterns (Hohpe, Woolf)** | 2003 | 65개 메시징 패턴 카탈로그. Request-Reply, Correlation Identifier, Process Manager 등 |
| **WS-BPEL 2.0 (OASIS)** | 2007 | Orchestration 국제 표준. XML 기반 워크플로 실행 언어 |
| **RFC 2616 / RFC 9110** | 1999/2022 | HTTP 202 Accepted 정의. "의도적으로 non-committal" |
| **RFC 7240** | 2014 | `Prefer: respond-async` 헤더 — 클라이언트-서버 비동기 협상 표준화 |

## 6.2 이론적 토대

```
┌─────────────────────────────────────────────────────────────────┐
│                    이론적 기반 관계도                            │
│                                                                 │
│  CAP Theorem (Brewer, 2000)                                     │
│  ├── C + A + P 동시 불가능                                      │
│  ├── 네트워크 분할 불가피 → C와 A 중 선택                       │
│  └── 비동기 패턴 = 가용성(A) + 최종 일관성(Eventual C) 선택    │
│       ↓                                                         │
│  BASE vs ACID                                                   │
│  ├── ACID: 강한 일관성, 분산 확장성 제한                        │
│  └── BASE: Basically Available, Soft state, Eventually          │
│            consistent → 비동기 처리의 자연스러운 구현           │
│       ↓                                                         │
│  Reactive Manifesto (2014)                                      │
│  ├── Responsive, Resilient, Elastic, Message-Driven             │
│  └── 비동기 메시지 주도 아키텍처의 이론적 정당성                │
│       ↓                                                         │
│  12-Factor App (Wiggins, 2011)                                  │
│  ├── Factor VIII (Concurrency): Worker 프로세스 분리            │
│  └── Factor IV (Backing Services): 큐를 교체 가능한 리소스로   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 대안 비교표

## 7.1 Workflow Engine 비교

| 항목 | Temporal | AWS Step Functions | Azure Durable Func | Netflix Conductor | Camunda |
|------|----------|-------------------|--------------------|--------------------|---------|
| **아키텍처** | Durable Execution, 코드 기반 | ASL JSON State Machine | Orchestrator+Activity | JSON DSL, Worker 폴링 | BPMN 2.0, Zeebe 스트림 |
| **언어 지원** | Go, Java, Python, TS, .NET, PHP | 언어 무관(JSON)+Lambda | C#, JS/TS, Python, Java | Java 공식, 다수 커뮤니티 | Java 공식, 다수 SDK |
| **가격** | Self-Hosted 무료, Cloud 종량제 | 전환당 $0.025/1K | Azure Functions 요금 | Self-Hosted 무료 | Enterprise 라이선스 |
| **확장성** | Worker 수평 확장 | Express: 100K TPS | Serverless 자동 확장 | 수백만 동시 (Netflix 검증) | Zeebe 분산 스트림 |
| **학습 곡선** | 중간 | 낮음 (AWS 내) | 낮음~중간 | 중간 | 높음 (BPMN 학습) |
| **오픈소스** | MIT | 아니오 | 부분 (Durable Task FW) | Apache 2.0 | 부분 |
| **벤더 종속** | 낮음 | 매우 높음 (ASL 독점) | 높음 (Azure) | 낮음 | 중간 |
| **적합 상황** | 복잡한 장기 실행 워크플로 | AWS 서버리스 환경 | Azure 서버리스 | 비개발자 UI 편집 필요 | 규제 산업 BPM |

## 7.2 메시지 브로커 비교

| 항목 | Apache Kafka | RabbitMQ | AWS SQS | Redis Streams |
|------|-------------|----------|---------|---------------|
| **메시징 모델** | Pub/Sub, 파티션 로그 | AMQP 큐, Pub/Sub | 관리형 큐 | Redis 기반 스트림 |
| **처리량** | 수백만 msg/s | 수만 msg/s | 높음 (관리형) | 높음 (메모리) |
| **메시지 보존** | 장기 보존, 재처리 가능 | 소비 후 삭제 | 최대 14일 | TTL 기반 |
| **순서 보장** | 파티션 내 보장 | 큐 내 FIFO | FIFO 큐 옵션 | 추가 보장 |
| **라우팅** | 토픽 기반 | 유연 (Exchange/Binding) | 단순~중간 | Consumer Group |
| **전달 보장** | At-Least-Once / Exactly-Once | At-Least-Once (ACK) | At-Least-Once | At-Least-Once |
| **운영 부담** | 높음 (클러스터) | 중간 | 없음 (관리형) | 낮음 |
| **적합 사례** | 이벤트 소싱, 스트리밍 | 복잡 라우팅, 지연 큐 | AWS 서버리스 | 경량 마이크로서비스 |

## 7.3 Orchestration vs Choreography 비교

| 기준 | Orchestration 유리 | Choreography 유리 |
|------|-------------------|-------------------|
| **결제/주문 처리** | O (순서 의존 + 보상 필수) | |
| **알림/분석** | | O (독립적, Fire-and-Forget) |
| **감사/규정 준수** | O (중앙 추적 가능) | |
| **서비스 독립성 중시** | | O (느슨한 결합) |
| **복잡한 조건 분기** | O (한 곳에서 관리) | |
| **고처리량 병목 없이** | | O (분산 확장) |
| **디버깅 편의성** | O | |

---

# 8. 상황별 최적 선택 가이드

## 8.1 의사결정 플로우차트

```
┌─────────────────────────────────────────────────────────────────┐
│                 비동기 패턴 선택 의사결정 트리                   │
│                                                                 │
│  장기 실행 작업인가?                                            │
│  ├── No → 동기 HTTP 유지                                       │
│  └── Yes ↓                                                      │
│                                                                 │
│  클라이언트가 공개 엔드포인트 제공 가능?                        │
│  ├── Yes → Webhook/Callback 패턴                                │
│  └── No ↓                                                       │
│                                                                 │
│  실시간 진행률 필요?                                            │
│  ├── Yes → SSE (단방향) 또는 WebSocket (양방향)                 │
│  └── No → HTTP 202 + Polling 패턴                               │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  서비스 간 트랜잭션 필요?                                       │
│  ├── No → 단순 Message Queue                                    │
│  └── Yes ↓                                                      │
│                                                                 │
│  단계 간 순서 의존 + 보상 필요?                                 │
│  ├── Yes → Orchestration (Saga)                                 │
│  └── No ↓                                                       │
│                                                                 │
│  참여 서비스 3개 이하 + 단순 흐름?                              │
│  ├── Yes → Choreography (이벤트 기반)                           │
│  └── No → Orchestration 권장                                    │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Workflow Engine 선택:                                           │
│  ├── AWS 종속 허용 + 빠른 시작 → Step Functions                 │
│  ├── Azure 환경 → Durable Functions                             │
│  ├── 오픈소스 + 코드 기반 + 복잡 로직 → Temporal               │
│  ├── UI 편집 + 비개발자 협업 → Conductor                       │
│  ├── 규제 산업 + BPMN 표준 → Camunda                           │
│  └── 서버리스 + 낮은 운영 부담 → Inngest 또는 Restate          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 8.2 시나리오별 권장 패턴

| 시나리오 | 권장 패턴 | 이유 |
|---------|----------|------|
| **주문 처리** (결제→재고→배송→알림) | Saga Orchestration (Temporal/Conductor) | 순서 의존 + 보상 트랜잭션 필수 |
| **결제 시스템** (PG 연동, 정산, 환불) | Orchestration + Idempotency Key + Saga | Exactly-once 필수, 중복 결제 방지 |
| **사용자 가입** (인증→프로필→환영→추천) | Choreography + 선택적 Orchestration | 대부분 독립적, 추천은 비동기 가능 |
| **보고서 생성** (대용량 데이터 집계) | HTTP 202 + Polling/Webhook | 수 분 소요, 동기 연결 유지 불가 |
| **외부 API 통합** (Rate Limit, Retry) | Orchestration + Circuit Breaker + Queue | 통합 retry 정책, thundering herd 방지 |
| **데이터 파이프라인** (ETL) | Choreography (Kafka) + 병렬 워커 | 처리량 최우선, 중앙 병목 불가 |

---

# 9. 실제 기업 사용 사례

## 9.1 Netflix

```
┌─────────────────────────────────────────────────────────────────┐
│  Netflix: Conductor를 만든 이유                                 │
│                                                                 │
│  문제: 수백 개 마이크로서비스, 콘텐츠 인코딩/추천/스트리밍      │
│       → 수백만 동시 워크플로 상태 추적 불가능 (큐만으로는)      │
│                                                                 │
│  해결: Conductor (2016 오픈소스)                                │
│  ├── JSON DSL로 워크플로 정의                                   │
│  ├── UI에서 시각화 및 편집                                      │
│  ├── Java/Spring 기반, HTTP/gRPC API                            │
│  └── 플러그인 스토리지 (Redis, PostgreSQL, Cassandra)            │
│                                                                 │
│  현재: Netflix 내부는 Maestro(후속작)로 이전.                   │
│        Orkes가 Conductor OSS Foundation 관리 (2023.12~)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.2 Uber (Cadence → Temporal)

```
┌─────────────────────────────────────────────────────────────────┐
│  Uber: Cadence와 Temporal의 탄생                                │
│                                                                 │
│  계보: Amazon SWF (Fateev) → Azure Durable Task FW (Abbas)     │
│        → Uber Cadence (2017) → Temporal (2019)                  │
│                                                                 │
│  Cadence: Uber 내부 1,000+ 서비스 사용, 월 120억 건 워크플로   │
│  Temporal: Cadence 핵심 개발자들이 독립 창업                    │
│  ├── 더 나은 개발자 경험 목표                                   │
│  ├── 다국어 SDK 지원 강화                                       │
│  └── "Durable Execution" — 코드 복잡도 5배 감소                │
│                                                                 │
│  Uber DOMA (2020): 2,200개 서비스 → 70개 도메인 재편           │
│  각 도메인에 단일 Gateway → "백엔드가 파이프라인 소유"          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.3 Airbnb

```
┌─────────────────────────────────────────────────────────────────┐
│  Airbnb: 서비스 오케스트레이션 전략                             │
│                                                                 │
│  진화 과정:                                                     │
│  Rails 모놀리스 → 마이크로서비스 → Micro+Macro 하이브리드       │
│                                                                 │
│  Service Block 구조:                                            │
│  ├── Data Services: 데이터 읽기/쓰기 전담                       │
│  ├── Business Logic Services: 다수 데이터 소스 조합             │
│  └── Workflow Services: Write Orchestration 담당                │
│                                                                 │
│  2020년~ 전략:                                                  │
│  ├── GraphQL 인터페이스 중심 API 통합                           │
│  ├── BFF 패턴으로 프론트엔드 직접 호출 제거                     │
│  └── Facade 레이어가 하위 서비스 복잡성 캡슐화                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.4 Stripe

```
┌─────────────────────────────────────────────────────────────────┐
│  Stripe: 결제 처리의 비동기 교과서                              │
│                                                                 │
│  1. Idempotency Key                                             │
│     ├── 모든 결제 API에 고유 키 필수                            │
│     ├── Redis 기반 24시간 키 캐시                               │
│     └── 동일 키 재요청 시 캐시된 응답 반환 (성공이든 실패든)    │
│                                                                 │
│  2. Webhook + Retry                                             │
│     ├── 실패 시 3일간 자동 재시도 (지수 백오프)                 │
│     └── 핸들러 반드시 멱등성 보장                               │
│                                                                 │
│  3. Exponential Backoff + Jitter                                │
│     └── Thundering Herd 방지를 위한 랜덤 지터 추가              │
│                                                                 │
│  4. 상태 머신 기반                                              │
│     └── pending → processing → succeeded/failed/refunded        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 9.5 DoorDash

```
┌─────────────────────────────────────────────────────────────────┐
│  DoorDash: Celery → Cadence 전환                                │
│                                                                 │
│  전환 이유: 주문→배달원 매칭→배달 파이프라인의 복잡성            │
│  Celery(단순 태스크 큐)로는 신뢰성 부족                        │
│                                                                 │
│  현재 아키텍처:                                                 │
│  ├── Kotlin 기반 스택 + Cadence Workflow Engine                 │
│  ├── 선언적 워크플로 정의(Declarative Workflow Definition)      │
│  ├── 각 모듈: 독립적 비즈니스 로직, 유효성, 실패 처리          │
│  ├── 중앙 Orchestrator가 상태 맵 평가 → 다음 단계 결정         │
│  └── 병렬 실행 가능 단계 자동 병렬화                            │
│                                                                 │
│  성과: US → 호주, 캐나다, 뉴질랜드로 워크플로 재사용 확장      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. "백엔드가 파이프라인을 소유" 아키텍처

## 10.1 BFF 패턴 + API Gateway + Orchestration Layer

```
┌─────────────────────────────────────────────────────────────────┐
│              업계 표준 아키텍처 계층 구조                        │
│                                                                 │
│  [클라이언트 (브라우저/앱)]                                     │
│          ↓ 단일 요청                                            │
│  ┌───────────────────────────┐                                  │
│  │ API Gateway               │                                  │
│  │ ├── 인증/인가             │                                  │
│  │ ├── 레이트 리미팅         │                                  │
│  │ ├── 분산 트레이싱         │                                  │
│  │ └── 요청 라우팅           │                                  │
│  └──────────┬────────────────┘                                  │
│             ↓                                                   │
│  ┌───────────────────────────┐                                  │
│  │ BFF / Orchestration Layer │                                  │
│  │ ├── 프론트엔드별 데이터 집약  │                              │
│  │ ├── 응답 형태 변환            │                              │
│  │ ├── 비즈니스 프로세스 조율    │                              │
│  │ ├── 에러 처리 + 보상 트랜잭션 │                              │
│  │ └── 상태 추적                 │                              │
│  └──────────┬────────────────┘                                  │
│             ↓ 개별 서비스 호출                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │Cart │ │Pay  │ │Inv  │ │Ship │                                │
│  │Svc  │ │Svc  │ │Svc  │ │Svc  │                                │
│  └─────┘ └─────┘ └─────┘ └─────┘                               │
│                                                                 │
│  이 아키텍처의 장점:                                            │
│  ├── 프론트엔드는 내부 서비스 토폴로지를 모름                   │
│  ├── 네트워크 라운드트립 70~80% 감소                            │
│  ├── 인증/집약/변환 로직 중앙 집중화                            │
│  ├── 백엔드 서비스 재구성이 프론트엔드에 영향 없음              │
│  └── Circuit Breaker로 부분 서비스 지속 가능                    │
│                                                                 │
│  Netflix, Uber, Airbnb, DoorDash 모두 이 계층 구조 채택        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 10.2 프론트엔드는 단일 엔드포인트만 호출

```
┌─────────────────────────────────────────────────────────────────┐
│  프론트엔드 직접 호출의 문제점 vs 서버사이드 오케스트레이션     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 지표             │ 직접 호출      │ 서버사이드 오케스트레이션│
│  ├──────────────────┼────────────────┼──────────────────────┤   │
│  │ API 호출 수      │ 기준 (100%)    │ 70~80% 감소          │   │
│  │ 보안 표면        │ 서비스 수만큼  │ 단일 진입점          │   │
│  │ 장애 격리        │ 화면 오류      │ 부분 서비스 지속     │   │
│  │ 클라이언트 복잡도│ 오케스트레이션 │ 비즈니스 로직만      │   │
│  │                  │ 로직 포함      │                      │   │
│  │ 프로토콜 문제    │ gRPC 불가      │ 내부 gRPC 가능       │   │
│  └──────────────────┴────────────────┴──────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 베스트 프랙티스

## 11.1 HTTP 202 패턴 상세

```
┌─────────────────────────────────────────────────────────────────┐
│  응답 본문 권장 구조:                                           │
│                                                                 │
│  {                                                              │
│    "jobId": "a1b2c3d4-...",                                     │
│    "statusUrl": "https://api.example.com/jobs/a1b2c3d4",        │
│    "estimatedCompletionSeconds": 30,                            │
│    "submittedAt": "2026-03-12T10:00:00Z"                        │
│  }                                                              │
│                                                                 │
│  핵심 규칙:                                                     │
│  ├── 유효하지 않은 요청 → 즉시 400 반환 (202 아님!)             │
│  ├── Location 헤더에 Valet Key(SAS Token)로 접근 제어 가능      │
│  ├── Retry-After 없으면 클라이언트가 무차별 폴링 유발           │
│  └── 완료 시 302 Found + Location: 결과 URL로 리다이렉트       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.2 Idempotency Key (Stripe 방식)

```
┌─────────────────────────────────────────────────────────────────┐
│            Idempotency Key 서버 측 구현 (Redis 기반)            │
│                                                                 │
│  요청 수신                                                      │
│    → Redis에서 키 조회 (GET idempotency:{key})                  │
│    → 존재하면: 저장된 응답 즉시 반환 (원래 상태 코드 그대로)    │
│    → 없으면:                                                    │
│         1. SET NX 명령으로 처리 중 잠금 획득                    │
│            (TTL: 처리 예상 시간 + 여유분)                       │
│         2. 비즈니스 로직 실행                                   │
│         3. 응답 결과 + 요청 본문 해시를 Redis에 저장            │
│            (TTL: 24~48시간)                                     │
│         4. 잠금 해제 후 응답 반환                               │
│                                                                 │
│  중요 규칙:                                                     │
│  ├── 재시도 응답은 원래 상태 코드 그대로 반환                   │
│  │   (201이었으면 재시도도 201. 200이나 409 반환 금지)          │
│  ├── 요청 본문 해시 저장 → 같은 키 다른 페이로드 = 오류        │
│  ├── 잠금에 반드시 TTL 설정 (영구 잠금 = Zombie Job)           │
│  └── SET NX로 레이스 컨디션 방지                                │
│                                                                 │
│  클라이언트 재시도 전략:                                        │
│  ├── 동일 Idempotency-Key로 재시도                              │
│  ├── 지수 백오프: 1s → 2s → 4s → 8s                            │
│  ├── Jitter 추가: 재시도 폭풍(Retry Storm) 방지                │
│  └── 최대 재시도 횟수: 5회                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 상태 머신 설계

```
┌─────────────────────────────────────────────────────────────────┐
│                    작업 상태 전이도                              │
│                                                                 │
│  PENDING                                                        │
│    │ (워커가 작업 집어올림)                                      │
│    ▼                                                            │
│  PROCESSING ─────────────────────────────┐                      │
│    │                                     │ (TTL 초과 → 재시도)  │
│    │ (성공)              (실패)           │                      │
│    ▼                     ▼               │                      │
│  COMPLETED             FAILED ◄──────────┘                      │
│    │                     │                                      │
│    ▼                     ▼                                      │
│  TTL 만료 후 삭제      DLQ 이동 또는 알림                       │
│                                                                 │
│  상태 저장소 선택:                                              │
│  ├── Redis: 단기 상태, 고속 조회, TTL 관리                      │
│  ├── RDBMS: 감사 요건, 복잡한 쿼리                              │
│  └── Temporal 등: 복잡한 워크플로, 장기 실행                    │
│                                                                 │
│  TTL 정책:                                                      │
│  ├── COMPLETED/FAILED: 7~30일 보관 후 아카이브                  │
│  └── PROCESSING Heartbeat: 워커가 주기적 갱신, 미갱신 시 FAILED │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.4 타임아웃 전략과 Heartbeat 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│                    계층별 타임아웃 설계                          │
│                                                                 │
│  클라이언트 (예: 5초)                                           │
│    └─ API Gateway / Load Balancer (예: ALB 60초)                │
│         └─ 애플리케이션 서버 (즉시 202 반환, 큐에 위임)         │
│              └─ 워커 프로세스 (작업별 TTL 설정)                  │
│                                                                 │
│  Heartbeat 패턴 (장기 실행 작업):                               │
│  ├── 워커가 30초마다 상태 저장소에 heartbeat 갱신               │
│  ├── 별도 감시 프로세스가 lastHeartbeatAt 확인                  │
│  └── 임계값(2분) 초과 → FAILED 전환 + 재큐잉                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.5 Saga 구현: Forward/Backward Recovery

```kotlin
// Kotlin Coroutines 기반 Saga Orchestration 예시
suspend fun orchestrateOrderSaga(order: Order): Result<OrderResult> {
    val compensation = mutableListOf<suspend () -> Unit>()

    return try {
        // Step 1: 재고 예약 (보상 가능)
        val reservation = inventoryService.reserve(order.items)
        compensation.add { inventoryService.release(reservation.id) }

        // Step 2: 결제 처리 (Pivot Transaction)
        val payment = paymentService.charge(order.payment)
        // Pivot 이후: 보상 없음, Forward Recovery만

        // Step 3: 배송 요청 (재시도 가능)
        withRetry(maxAttempts = 3) {
            shippingService.createShipment(order, payment)
        }

        Result.success(OrderResult(payment, reservation))
    } catch (e: Exception) {
        // Backward Recovery: 역순 보상
        compensation.reversed().forEach { compensate ->
            runCatching { compensate() }
                .onFailure { log.error("보상 트랜잭션 실패", it) }
        }
        Result.failure(e)
    }
}
```

## 11.6 에러 처리: Retry + Exponential Backoff + DLQ + Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────┐
│                    에러 처리 계층 구조                           │
│                                                                 │
│  [Level 1: Retry with Exponential Backoff]                      │
│  ├── 1s → 2s → 4s → 8s (BackoffRate: 2.0)                     │
│  ├── Jitter 추가로 Thundering Herd 방지                         │
│  └── 최대 재시도: 3~5회                                         │
│                                                                 │
│  [Level 2: Circuit Breaker]                                     │
│  ├── CLOSED (정상) → OPEN (차단) → HALF-OPEN (탐색) → CLOSED   │
│  ├── 50% 실패 시 Open, 30초 후 Half-Open                       │
│  └── Retry와 함께 사용 시: Circuit Breaker가 Retry를 감싸야 함 │
│                                                                 │
│  [Level 3: Dead Letter Queue (DLQ)]                             │
│  ├── 재시도 소진 → DLQ로 이동                                   │
│  ├── 오류 유형별 분류 (4xx vs 5xx vs timeout)                   │
│  ├── 알림 발송                                                  │
│  ├── 수동 재처리 또는 자동화                                    │
│  └── 7~30일 보관 후 아카이브                                    │
│                                                                 │
│  경고: Retry + Circuit Breaker 순서 중요!                       │
│  Circuit Breaker(Retry(call))  ← 올바른 순서                   │
│  Retry(CircuitBreaker(call))  ← 잘못된 순서 (열린 CB에 계속    │
│                                  재시도하여 부하 가중)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 11.7 Temporal SDK 구현 예시 (Kotlin)

```kotlin
// Workflow 인터페이스 정의
@WorkflowInterface
interface OrderWorkflow {
    @WorkflowMethod
    fun processOrder(order: Order): OrderResult
}

// Activity 인터페이스 (실제 서비스 호출)
@ActivityInterface
interface OrderActivities {
    fun reserveInventory(items: List<Item>): ReservationId
    fun processPayment(payment: Payment): PaymentResult
    fun createShipment(order: Order): ShipmentId
}

// Workflow 구현 — 결정론적이어야 함
// (I/O, 랜덤, 현재 시간 직접 사용 금지)
class OrderWorkflowImpl : OrderWorkflow {
    private val activities = Workflow.newActivityStub(
        OrderActivities::class.java,
        ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofSeconds(30))
            .setRetryOptions(
                RetryOptions.newBuilder()
                    .setMaximumAttempts(3)
                    .build()
            )
            .build()
    )

    override fun processOrder(order: Order): OrderResult {
        val reservationId = activities.reserveInventory(order.items)
        val paymentResult = activities.processPayment(order.payment) // Pivot
        val shipmentId = activities.createShipment(order)
        return OrderResult(reservationId, paymentResult, shipmentId)
    }
}
```

## 11.8 Temporal SDK: Saga + 보상 트랜잭션 (Kotlin)

```kotlin
// Temporal Saga 패턴 구현 — 보상 트랜잭션 자동 실행
class OrderSagaWorkflowImpl : OrderWorkflow {
    private val activities = Workflow.newActivityStub(
        OrderActivities::class.java,
        ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofSeconds(30))
            .setRetryOptions(
                RetryOptions.newBuilder()
                    .setMaximumAttempts(3)
                    .build()
            )
            .build()
    )

    override fun processOrder(order: Order): OrderResult {
        // Temporal의 Saga 유틸리티: 자동으로 역순 보상 실행
        val saga = Saga(Saga.Options.Builder().build())

        try {
            // Step 1: 재고 예약 + 보상 등록
            val reservationId = activities.reserveInventory(order.items)
            saga.addCompensation { activities.releaseInventory(reservationId) }

            // Step 2: 결제 처리 (Pivot Transaction) + 보상 등록
            val paymentResult = activities.processPayment(order.payment)
            saga.addCompensation { activities.refundPayment(paymentResult.id) }

            // Step 3: 배송 요청 (Forward Recovery — 재시도로 완료)
            val shipmentId = activities.createShipment(order)

            return OrderResult(reservationId, paymentResult, shipmentId)
        } catch (e: Exception) {
            // 실패 시 Saga가 등록된 보상을 역순으로 자동 실행
            saga.compensate()
            throw e
        }
    }
}
```

**Temporal Saga 핵심 포인트**:
- `Saga` 클래스가 보상 함수 목록을 관리하며 실패 시 역순 실행
- 각 Activity는 독립적으로 retry 가능 (RetryOptions)
- Workflow 코드는 결정론적이어야 함 — Activity로 I/O 위임
- Event History 재생으로 중단 시점부터 정확히 재개

## 11.9 모니터링 및 운영 가시성

```
┌─────────────────────────────────────────────────────────────────┐
│                비동기 시스템 모니터링 핵심 지표                  │
│                                                                 │
│  [큐 기반 메트릭]                                               │
│  ├── Queue Depth (대기 메시지 수)                               │
│  │   → 급증 시 처리 지연 알람 + Worker Auto-Scaling 트리거      │
│  ├── Message Age (가장 오래된 메시지 대기 시간)                  │
│  │   → SLO 기준 초과 시 알람 (예: 5분 초과 경고)                │
│  ├── DLQ Depth (Dead Letter Queue 메시지 수)                    │
│  │   → 0이 아니면 즉시 알람                                     │
│  └── Consumer Lag (소비 지연)                                   │
│      → Kafka: Consumer Group Lag 모니터링                       │
│                                                                 │
│  [작업 상태 메트릭]                                              │
│  ├── Job 완료율 (성공 / 전체)                                   │
│  │   → 99% 미만 시 조사 필요                                    │
│  ├── Job 처리 시간 (p50, p95, p99)                              │
│  │   → p99가 SLO 초과 시 알람                                   │
│  ├── PROCESSING 상태 작업 수                                    │
│  │   → 급증 시 Zombie Job 의심                                  │
│  └── 재시도 횟수 분포                                           │
│      → 특정 서비스 재시도 급증 → 해당 서비스 장애 의심          │
│                                                                 │
│  [분산 트레이싱]                                                 │
│  ├── Correlation ID를 모든 서비스 호출에 전파                   │
│  │   → 비동기 메시지에도 Correlation ID 포함 필수               │
│  ├── OpenTelemetry + Jaeger/Zipkin으로 end-to-end 추적         │
│  └── Saga 단계별 소요 시간 + 성공/실패 시각화                   │
│                                                                 │
│  [알람 설계 원칙]                                                │
│  ├── DLQ 메시지 존재 → P1 (즉시 대응)                           │
│  ├── Queue Depth 급증 → P2 (30분 내 확인)                       │
│  ├── Job 완료율 저하 → P2                                       │
│  └── 재시도 횟수 이상 → P3 (당일 확인)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 주요 함정과 안티패턴

## 12.1 비동기 처리 함정

```
┌─────────────────────────────────────────────────────────────────┐
│                 비동기 처리 주요 함정                            │
│                                                                 │
│  [Polling Storm - 폴링 폭풍]                                    │
│  증상: 다수 클라이언트 동시 폴링 → 서버 과부하                  │
│  해결:                                                          │
│  ├── Retry-After 헤더 반드시 설정                               │
│  ├── 클라이언트 지수 백오프: 1s → 2s → 4s → ... → 최대 60s    │
│  ├── Webhook/WebSocket Push 방식으로 전환                       │
│  └── 폴링 엔드포인트에 Rate Limiting 적용                       │
│                                                                 │
│  [Zombie Jobs - 좀비 작업]                                      │
│  증상: 워커 사망 → 영원히 PROCESSING 상태                       │
│  해결:                                                          │
│  ├── 처리 잠금에 TTL 설정                                       │
│  ├── 워커 주기적 Heartbeat 갱신                                 │
│  └── 감시 스케줄러가 오래된 PROCESSING → FAILED + 재큐잉        │
│                                                                 │
│  [Lost Callbacks - 유실된 콜백]                                  │
│  증상: Webhook 호출 실패 → 결과 영구 유실                       │
│  해결:                                                          │
│  ├── 지수 백오프 재시도 (최대 1~3일)                            │
│  ├── Jitter 추가 (Thundering Herd 방지)                         │
│  ├── 재시도 소진 → DLQ 이동                                     │
│  └── 클라이언트에 폴링 폴백 제공                                │
│                                                                 │
│  [Double Processing - 이중 처리]                                │
│  증상: 네트워크 재시도 → 동일 작업 두 번 실행 → 결제 중복      │
│  해결: Idempotency Key 패턴 필수 적용                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 12.2 오케스트레이션 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              오케스트레이션 안티패턴 6가지                       │
│                                                                 │
│  [1. God Orchestrator - 신의 오케스트레이터]                     │
│  증상: 오케스트레이터에 모든 도메인 로직 집중 → 사실상 모놀리스 │
│  나쁜 예: 재고 계산, 할인 규칙, 배송비 계산 모두 직접 구현      │
│  좋은 예: 각 서비스 API 호출만, 로직은 서비스에 위임            │
│                                                                 │
│  [2. Distributed Monolith - 분산 모놀리스]                       │
│  증상: 마이크로서비스 분리했지만 오케스트레이터가 모든 서비스와  │
│       강하게 결합. 하나 변경 → 전체 영향                        │
│  해결: 오케스트레이터는 서비스 퍼블릭 계약에만 의존             │
│                                                                 │
│  [3. Choreography Spaghetti - 안무 스파게티]                     │
│  증상: 이벤트 기반 흐름이 복잡해져 추적 불가능                  │
│  해결: 단순 이벤트는 Choreography, 복잡한 흐름은 Orchestration  │
│                                                                 │
│  [4. Missing Compensation - 보상 누락]                           │
│  증상: Saga 구현했지만 실패 시 보상 로직 없음                   │
│  체크: 각 단계마다 "실패 시 어떻게 되돌리는가?" 확인            │
│                                                                 │
│  [5. Sync over Async - 비동기를 동기적으로 대기]                │
│  증상: 큐에 넣고 while 루프로 완료 대기 (블로킹)               │
│  해결: 즉시 202 반환, 클라이언트가 폴링                         │
│                                                                 │
│  [6. Event Soup - 이벤트 수프]                                   │
│  증상: 이벤트 타입 폭증                                         │
│       (OrderPartiallyReservedWithDiscountApplied 같은 괴물)     │
│  해결: 이벤트는 도메인 관점의 의미 있는 상태 변화만 표현        │
│       내부 구현 세부사항을 이벤트로 노출하지 않음               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 마이그레이션 가이드

## 13.1 동기 → 비동기 (Strangler Fig 패턴)

```
┌─────────────────────────────────────────────────────────────────┐
│        Strangler Fig 방식 점진적 전환                           │
│                                                                 │
│  (자연의 교살 무화과나무가 숙주 나무를 서서히 대체하는 비유)    │
│                                                                 │
│  1단계: 라우팅 레이어(Facade) 도입                              │
│  Client → [API Gateway / Proxy] → 기존 동기 API                 │
│                                                                 │
│  2단계: 새 비동기 엔드포인트 병행 운영                          │
│  Client → [API Gateway]                                         │
│            ├── (기존 경로) → 동기 API                            │
│            └── (새 경로)  → 비동기 API (202 Accepted)            │
│                                                                 │
│  3단계: 트래픽 점진적 이전 (Canary Release)                     │
│  Feature Flag / % 기반 라우팅: 10% → 50% → 100%                │
│                                                                 │
│  4단계: 기존 동기 API 제거                                      │
│  모든 트래픽이 비동기 API 사용 → 레거시 제거                    │
│                                                                 │
│  레거시 클라이언트 처리:                                        │
│  Proxy가 내부적으로 비동기 처리하면서                            │
│  외부에는 동기 응답처럼 보이게 할 수 있음                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 13.2 Choreography → Orchestration

```
┌─────────────────────────────────────────────────────────────────┐
│        Choreography → Orchestration 전환                        │
│                                                                 │
│  전환 전 필수 작업: 이벤트 흐름 매핑                            │
│  1. 현재 시스템의 모든 이벤트 타입 목록 작성                    │
│  2. 각 이벤트의 발행자(Publisher)와 구독자(Subscriber) 매핑     │
│  3. 이벤트 체인으로 표현되는 비즈니스 플로우 식별               │
│  4. 복잡한 조건 분기가 있는 플로우 → Orchestration 후보         │
│                                                                 │
│  점진적 도입:                                                   │
│  Phase 1: 새로 추가되는 복잡한 워크플로만 Orchestration         │
│  Phase 2: 버그 빈발 기존 Choreography → Orchestration 교체      │
│  Phase 3: 알림성 이벤트는 Choreography 유지,                    │
│           비즈니스 트랜잭션은 모두 Orchestration                 │
│                                                                 │
│  현실적 권장: 완전 전환보다 Hybrid 아키텍처가 더 실용적         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 13.3 모놀리스 → 마이크로서비스 + Orchestration

```
┌─────────────────────────────────────────────────────────────────┐
│        모놀리스 → 마이크로서비스 전환 체크리스트                 │
│                                                                 │
│  Domain-Driven Decomposition:                                   │
│  1. Bounded Context 식별                                        │
│     → 각 도메인이 소유하는 데이터와 로직 명확화                 │
│  2. 트랜잭션 경계 식별                                          │
│     → 2PC가 필요했던 부분을 Saga로 대체 가능한지 확인           │
│  3. 데이터 소유권 정리                                          │
│     → 각 서비스가 자신의 DB 소유 (Database per Service)         │
│  4. API 계약 정의                                               │
│     → 서비스 간 인터페이스를 먼저 설계                          │
│                                                                 │
│  트랜잭션 경계 체크리스트:                                      │
│  □ 완전히 성공하거나 완전히 실패해야 하는가?                    │
│    → Yes: Saga 패턴 적용 필요                                   │
│  □ 여러 서비스 데이터를 하나의 트랜잭션으로 묶어야 하는가?      │
│    → Yes: 설계 재검토 또는 Saga Orchestration                   │
│  □ 실시간 일관성 필요? 최종 일관성으로 충분?                    │
│    → 비동기 패턴 적용 가능 여부 결정                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 14. References

## 학술 논문 및 표준

- Garcia-Molina, H. & Salem, K. (1987). "SAGAS". ACM SIGMOD, pp.249-259. [ACM Digital Library](https://dl.acm.org/doi/10.1145/38713.38742) / [PDF](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)
- Hohpe, G. & Woolf, B. (2003). "Enterprise Integration Patterns". Addison-Wesley. [enterpriseintegrationpatterns.com](https://www.enterpriseintegrationpatterns.com/)
- OASIS (2007). "WS-BPEL 2.0 Standard". [OASIS 공식](https://docs.oasis-open.org/wsbpel/2.0/wsbpel-v2.0.html)
- RFC 2616 (1999). "HTTP/1.1". [W3C](https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html)
- RFC 7240 (2014). "Prefer Header for HTTP". [IETF](https://datatracker.ietf.org/doc/html/rfc7240)
- RFC 9110 (2022). "HTTP Semantics". [IETF](https://datatracker.ietf.org/doc/html/rfc9110)

## 아키텍처 패턴 공식 문서

- [Azure Asynchronous Request-Reply Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply)
- [Azure Saga Design Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [microservices.io - Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Azure Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Azure CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Martin Fowler - Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Sam Newman - Backends For Frontends](https://samnewman.io/patterns/architectural/bff/)
- [The Reactive Manifesto](https://www.reactivemanifesto.org/)
- [The Twelve-Factor App](https://12factor.net/)

## Workflow Engine 공식 문서

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal - Building Resilient Workflows History](https://temporal.io/blog/building-resilient-workflows-from-azure-to-cadence-to-temporal)
- [AWS Step Functions Documentation](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [Azure Durable Functions Overview](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Netflix Conductor GitHub](https://github.com/conductor-oss/conductor)
- [Camunda Documentation](https://docs.camunda.io/)
- [Inngest Documentation](https://www.inngest.com/)
- [Restate - Thoughtworks Technology Radar](https://www.thoughtworks.com/en-us/radar/platforms/restate)

## 기업 사례

- [Netflix Conductor - Netflix TechBlog](https://netflixtechblog.com/netflix-conductor-a-microservices-orchestrator-2e8d4771bf40)
- [Uber DOMA Architecture](https://www.uber.com/en-US/blog/microservice-architecture/)
- [Airbnb Microservice Architecture](https://newsletter.techworld-with-milan.com/p/airbnb-microservice-architecture)
- [Stripe Idempotency Design](https://stripe.com/blog/idempotency)
- [DoorDash Engineering Blog](https://doordash.engineering/)
- [DoorDash: Monolith to Microservices](https://careersatdoordash.com/blog/how-doordash-transitioned-from-a-monolith-to-microservices/)
- [LinkedIn Kafka 7 Trillion Messages](https://www.linkedin.com/blog/engineering/open-source/apache-kafka-trillion-messages)

## 비교 분석

- [Temporal vs AWS Step Functions](https://www.readysetcloud.io/blog/allen.helton/step-functions-vs-temporal/)
- [Netflix Conductor vs Temporal](https://medium.com/@natesh.somanna/comparing-orchestration-frameworks-ubers-cadence-netflix-conductor-and-temporal-3778cff24574)
- [Saga Pattern Demystified - ByteByteGo](https://blog.bytebytego.com/p/saga-pattern-demystified-orchestration)
- [Kafka vs RabbitMQ - AWS](https://aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/)
- [State of Open Source Workflow Orchestration 2025](https://www.pracdata.io/p/state-of-workflow-orchestration-ecosystem-2025)
- [Durable Execution Engine Rise - Kai Waehner](https://www.kai-waehner.de/blog/2025/06/05/the-rise-of-the-durable-execution-engine-temporal-restate-in-an-event-driven-architecture-apache-kafka/)
- [Microsoft - API Gateway vs Direct Client Communication](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/architect-microservice-container-applications/direct-client-to-microservice-communication-versus-the-api-gateway-pattern)
