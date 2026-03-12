---
layout: single
title: "실시간 통신 패턴: WebSocket, SSE, Polling"
date: 2026-03-12 23:00:00 +0900
categories: backend
excerpt: "WebSocket, SSE, Polling 패턴은 실시간 요구사항과 인프라 제약에 맞춰 지연시간, 확장성, 구현 복잡도를 균형 있게 선택하는 통신 전략이다."
toc: true
toc_sticky: true
tags: [realtime, websocket, sse, polling, webtransport, grpc]
source: "/home/dwkim/dwkim/docs/backend/realtime-통신패턴-websocket-sse-polling.md"
---
TL;DR
- 실시간 통신 패턴은 서버 이벤트를 지연 없이 전달하기 위해 Polling, SSE, WebSocket 등 연결 모델을 목적에 맞게 선택하는 방법론이다.
- 채팅, 대시보드, 협업, AI 스트리밍처럼 지연시간과 상호작용 요구가 다른 시나리오에서는 단일 기술보다 상황별 패턴 선택이 운영 효율을 좌우한다.
- RFC와 기업 사례를 바탕으로 WebSocket/SSE/Long Polling의 내부 동작, 성능, 인프라 설정, 마이그레이션 전략을 체계적으로 비교한다.

## 1. 개념
실시간 통신 패턴은 서버 이벤트를 지연 없이 전달하기 위해 Polling, SSE, WebSocket 등 연결 모델을 목적에 맞게 선택하는 방법론이다.

## 2. 배경
HTTP 요청응답 구조의 한계와 대규모 동시 연결(C10K/C10M) 요구가 커지면서 이벤트 기반 통신 패턴이 웹 표준과 함께 진화했다.

## 3. 이유
채팅, 대시보드, 협업, AI 스트리밍처럼 지연시간과 상호작용 요구가 다른 시나리오에서는 단일 기술보다 상황별 패턴 선택이 운영 효율을 좌우한다.

## 4. 특징
RFC와 기업 사례를 바탕으로 WebSocket/SSE/Long Polling의 내부 동작, 성능, 인프라 설정, 마이그레이션 전략을 체계적으로 비교한다.

## 5. 상세 내용

# 실시간 통신 패턴: WebSocket, SSE, Polling

> **작성일**: 2026-03-12
> **카테고리**: Backend / Web / Real-time Communication
> **포함 내용**: WebSocket, SSE, Server-Sent Events, EventSource, Polling, Long Polling, Short Polling, HTTP Streaming, Comet, gRPC Streaming, WebTransport, QUIC, GraphQL Subscriptions, Socket.IO, Engine.IO, STOMP, Bayeux Protocol, RFC 6455, RFC 6202, RFC 8441, RFC 9220, HTTP Upgrade, 핸드셰이크, 프레임 구조, ping/pong, text/event-stream, Last-Event-ID, C10K, C10M, epoll, kqueue, Redis Pub/Sub, Nginx 설정, Spring WebFlux, Kotlin Flow, 실시간 아키텍처

---

# 1. 실시간 통신이란?

```
┌─────────────────────────────────────────────────────────────────┐
│              실시간 통신 = 서버가 먼저 말할 수 있는가?            │
│                                                                   │
│  정의:                                                           │
│  서버에서 발생한 이벤트를 클라이언트에게 즉시(또는 거의 즉시)    │
│  전달하는 통신 방식. HTTP의 Request-Response 모델을 넘어서       │
│  서버 주도(server-initiated) 데이터 전송을 가능하게 하는 것.     │
│                                                                   │
│  핵심 질문:                                                      │
│  ├── 클라이언트가 묻지 않아도 서버가 보낼 수 있는가?             │
│  ├── 데이터 발생 즉시 전달되는가? (지연 최소화)                  │
│  └── 연결을 계속 유지할 수 있는가? (영속 연결)                   │
│                                                                   │
│  활용 분야:                                                      │
│  ├── 실시간 채팅 (Slack, Discord)                                │
│  ├── 주식 시세 / 대시보드 (Bloomberg, Grafana)                   │
│  ├── 실시간 협업 (Google Docs, Figma)                            │
│  ├── 온라인 게임 (위치 동기화, 상태 업데이트)                    │
│  ├── 라이드 셰어링 (Uber 드라이버 위치 추적)                    │
│  └── AI 스트리밍 응답 (ChatGPT, Claude)                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 1.1 HTTP의 근본적 제약: Request-Response 모델

```
┌─────────────────────────────────────────────────────────────────┐
│           HTTP의 Request-Response 모델                           │
│                                                                   │
│  [전통적 HTTP 통신]                                              │
│                                                                   │
│  Client                              Server                      │
│    │                                    │                         │
│    │──── GET /data ──────────────────►  │                         │
│    │                                    │  (처리)                 │
│    │  ◄──── 200 OK + data ─────────── │                         │
│    │                                    │                         │
│    │  (서버에 새 데이터 발생!)          │                         │
│    │                                    │  ← 서버가 보낼 방법    │
│    │                                    │     없음!              │
│    │                                    │                         │
│    │  클라이언트가 다시 물어야 함       │                         │
│    │──── GET /data ──────────────────►  │                         │
│    │  ◄──── 200 OK + new data ──────── │                         │
│    │                                    │                         │
│                                                                   │
│  근본 제약:                                                      │
│  ├── 클라이언트만 요청 가능 (서버는 먼저 보낼 수 없음)          │
│  ├── 요청마다 헤더 오버헤드 (500~2,000 bytes)                   │
│  ├── HTTP/1.0: 요청마다 TCP 연결 새로 수립                      │
│  └── 서버는 클라이언트의 존재를 "기억"하지 않음 (Stateless)     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 왜 실시간 통신이 어려운지

```
┌─────────────────────────────────────────────────────────────────┐
│              실시간 통신의 3가지 근본 과제                        │
│                                                                   │
│  과제 1: 서버 → 클라이언트 푸시                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  HTTP는 "전화를 받는 것"만 가능하고                      │    │
│  │  "전화를 거는 것"은 불가능한 구조.                       │    │
│  │                                                          │    │
│  │  서버: "새 메시지가 왔는데... 클라이언트에게              │    │
│  │         어떻게 알리지? 전화번호(연결)가 없다!"           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  과제 2: 연결 유지 비용                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  TCP 연결 1개 = OS 자원(파일 디스크립터, 메모리) 소모    │    │
│  │  10만 사용자 × 1 연결 = 10만 개의 열린 연결 유지         │    │
│  │                                                          │    │
│  │  Thread-per-Connection:                                  │    │
│  │  10,000 연결 × 2MB/스레드 = 20GB 메모리 → 고갈!         │    │
│  │  이것이 바로 C10K Problem (1999년, Dan Kegel)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  과제 3: 중간 인프라 호환성                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  프록시, 방화벽, CDN, 로드밸런서가 중간에 개입           │    │
│  │  ├── 기업 방화벽: WebSocket Upgrade 차단 가능            │    │
│  │  ├── 프록시: 응답 버퍼링으로 SSE 이벤트 지연             │    │
│  │  └── CDN: 장기 연결(Long-lived connection) 비호환        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어 사전 (Terminology Dictionary)

```
┌─────────────────────────────────────────────────────────────────┐
│                    실시간 통신 용어 사전                          │
│                                                                   │
│  모든 기술 용어의 풀네임, 어원, 유래를 정리한다.                │
│  용어의 뿌리를 아는 것이 기술의 본질을 이해하는 첫걸음이다.    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

| 용어 | 풀네임 | 어원/유래 |
|------|--------|-----------|
| **Polling** | - | 13세기 중세 영어 "poll(머리)" → "머리 세기" → "여론조사" → 컴퓨터 상태 조회. 1957년 영국 면직 공장 수리공 순회 모델이 수학적 연구의 시초. 1968년 "polling system" 용어 공식 문헌 등장 |
| **Long Polling** | - | 2006년 Alex Russell의 "Comet" 명명과 함께 정착. 기존 polling이 "짧은(short)" 방식이라면, 서버가 연결을 "길게(long)" 붙잡는 방식이라는 직관적 명칭 |
| **SSE** | Server-Sent Events | "서버가 보내는 이벤트". 2004년 Ian Hickson이 WHATWG 제안에 포함. 2006년 Opera 브라우저가 최초 구현. 클라이언트 API명 `EventSource`는 "이벤트의 출처"라는 의미 |
| **WebSocket** | WebSocket Protocol | "Web" + "Socket". Socket은 Middle English "soket(창끝)"에서 유래. 1971년 RFC 147에서 ARPANET 문서에 "socket" 첫 등장. 1983년 Berkeley Sockets API 확립. 2008년 WHATWG에서 Ian Hickson이 "WebSocket" 명칭 제안. Michael Carter가 "SocketConnection" 제안한 것에 "Web" 접두사 추가 |
| **Comet** | - | 2006년 3월 Alex Russell 명명. Ajax(세제 브랜드)에 대한 말장난으로 다른 세제 브랜드 "Comet" 선택. 두문자어가 아닌 순수 언어 유희(wordplay) |
| **STOMP** | Simple (or Streaming) Text Oriented Messaging Protocol | S가 "Simple"이기도 "Streaming"이기도 한 의도적 이중성. 원래 이름 TTMP. 2000년대 초 Ruby/Python에서 엔터프라이즈 메시지 브로커 접속용으로 탄생 |
| **Socket.IO** | - | "Socket" + ".IO". I/O(Input/Output)의 약어이자 기술 스타트업의 .io 도메인 트렌드(2010년 전후). 2010년 Guillermo Rauch가 LearnBoost에서 개발. "Sockets for the rest of us" |
| **Engine.IO** | - | Socket.IO의 하위 레이어. 연결 수립, transport 선택, heartbeat 담당 |
| **Bayeux** | Bayeux Protocol | 2008년 Dojo Foundation 산하 CometD 프로젝트. Named Channel 기반 Pub/Sub 메시징 |
| **QUIC** | Quick UDP Internet Connections | Google이 2012년 설계한 UDP 기반 전송 프로토콜. HTTP/3의 기반 |
| **WebTransport** | - | QUIC(HTTP/3) 위에서 동작하는 브라우저 API. 2019년 W3C WICG 제안. WebSocket의 후계자로 불림 |

---

# 3. 기술 진화 연대표 (Evolution Timeline)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  1991  HTTP/0.9         Tim Berners-Lee, GET만 지원              │
│   │                                                               │
│   │    1996  HTTP/1.0    연결-요청-응답-종료 반복 (RFC 1945)      │
│   │     │                                                         │
│   │     │   1997  HTTP/1.1   Persistent Connection 기본값!       │
│   │     │    │               Chunked Transfer Encoding 도입       │
│   │     │    │               → Long Polling, Streaming의 토대     │
│   │     │    │                                                     │
│   │     │    │   1999  XMLHttpRequest  IE5에서 최초 등장          │
│   │     │    │    │                    (Microsoft, ActiveX)        │
│   │     │    │    │                                                │
│   │     │    │    │   2000s초  Polling 패턴    XHR + setInterval  │
│   │     │    │    │     │                                          │
│   │     │    │    │     │  2004  SSE 초안     Ian Hickson/WHATWG  │
│   │     │    │    │     │   │                                      │
│   │     │    │    │     │   │  2005  AJAX 명명    Jesse J.Garrett│
│   │     │    │    │     │   │   │    STOMP 초기 개발 (Codehaus)   │
│   │     │    │    │     │   │   │                                  │
│   │     │    │    │     │   │   │  2006  Comet 명명  Alex Russell │
│   │     │    │    │     │   │   │   │    Long Polling 정착         │
│   │     │    │    │     │   │   │   │    Opera: SSE 최초 구현      │
│   │     │    │    │     │   │   │   │                              │
│   │     │    │    │     │   │   │   │  2008  WebSocket 제안        │
│   │     │    │    │     │   │   │   │   │    (Hickson + Carter)    │
│   │     │    │    │     │   │   │   │   │    Bayeux Protocol       │
│   │     │    │    │     │   │   │   │   │                          │
│   │     │    │    │     │   │   │   │   │  2009  Chrome 4: WS     │
│   │     │    │    │     │   │   │   │   │   │    최초 기본 지원    │
│   │     │    │    │     │   │   │   │   │   │                      │
│   │     │    │    │     │   │   │   │   │   │  2010  Socket.IO    │
│   │     │    │    │     │   │   │   │   │   │   │    (Rauch)       │
│   │     │    │    │     │   │   │   │   │   │   │                  │
│   │     │    │    │     │   │   │   │   │   │   │  2011  RFC 6455 │
│   │     │    │    │     │   │   │   │   │   │   │   │   RFC 6202  │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   │     │    │    │     │   │   │   │   │   │   │   │  2012       │
│   │     │    │    │     │   │   │   │   │   │   │   │   STOMP 1.2 │
│   │     │    │    │     │   │   │   │   │   │   │   │   SSE W3C   │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   │     │    │    │     │   │   │   │   │   │   │   │  2015       │
│   │     │    │    │     │   │   │   │   │   │   │   │  HTTP/2     │
│   │     │    │    │     │   │   │   │   │   │   │   │  (RFC 7540) │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   │     │    │    │     │   │   │   │   │   │   │   │  2018       │
│   │     │    │    │     │   │   │   │   │   │   │   │  RFC 8441   │
│   │     │    │    │     │   │   │   │   │   │   │   │  (WS/HTTP2) │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   │     │    │    │     │   │   │   │   │   │   │   │  2019       │
│   │     │    │    │     │   │   │   │   │   │   │   │  WebTransp. │
│   │     │    │    │     │   │   │   │   │   │   │   │  제안       │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   │     │    │    │     │   │   │   │   │   │   │   │  2022       │
│   │     │    │    │     │   │   │   │   │   │   │   │  RFC 9220   │
│   │     │    │    │     │   │   │   │   │   │   │   │  Chrome 97: │
│   │     │    │    │     │   │   │   │   │   │   │   │  WebTransp. │
│   │     │    │    │     │   │   │   │   │   │   │   │              │
│   ▼     ▼    ▼    ▼     ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼  2026     │
│                                                         현재      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 주요 시점 상세

| 연도 | 사건 | 의미 |
|------|------|------|
| 1991 | HTTP/0.9 (Tim Berners-Lee, CERN) | GET만 지원, 헤더/상태코드 없음. "실시간" 개념 자체 부재 |
| 1996 | HTTP/1.0 (RFC 1945) | 요청마다 새 TCP 연결. 20개 리소스 = 20번 3-way handshake |
| 1997 | HTTP/1.1 (RFC 2068, 이후 2616) | Persistent Connection 기본값, Chunked Transfer Encoding 도입 |
| 1999 | XMLHttpRequest (Microsoft IE5) | 페이지 새로고침 없는 비동기 통신의 시작 |
| 2004 | SSE 초안 (Ian Hickson, WHATWG) | 서버→클라이언트 단방향 스트리밍 표준화 시도 |
| 2005 | Ajax 명명 (Jesse James Garrett) | 비동기 웹 통신의 폭발적 주목 |
| 2006 | Comet 명명 (Alex Russell), Opera SSE 구현 | 서버 푸시 기법 체계화, SSE 첫 구현 |
| 2008 | WebSocket 제안 (Carter + Hickson) | HTTP를 벗어난 양방향 통신 프로토콜 |
| 2009 | Chrome 4: WebSocket 최초 기본 지원 | 실시간 웹의 새 시대 개막 |
| 2010 | Socket.IO 출시 (Guillermo Rauch) | WebSocket + fallback으로 실시간 개발 단순화 |
| 2011 | RFC 6455 (WebSocket 표준), RFC 6202 (Long Polling 정리) | WebSocket 국제 표준화, Comet 시대 공식 마무리 |
| 2015 | HTTP/2 (RFC 7540) | 멀티플렉싱으로 연결 수 문제 완화, Server Push 도입(후에 실패) |
| 2018 | RFC 8441: WebSocket over HTTP/2 | HTTP/2에서 WebSocket 연결 공유 가능 |
| 2022 | RFC 9220: WebSocket over HTTP/3, Chrome 97 WebTransport | QUIC 기반 미래 실시간 통신의 서막 |
| 2026 | 현재 | WebSocket=양방향 표준, SSE=AI 스트리밍 부활, WebTransport=차세대 후보 |

---

# 4. 핵심 기술 상세

## 4.1 Short Polling

```
┌─────────────────────────────────────────────────────────────────┐
│              Short Polling (단순 폴링)                            │
│                                                                   │
│  Client                              Server                      │
│    │                                    │                         │
│    │──── GET /updates ───────────────►  │                         │
│    │  ◄──── 200 OK (빈 응답) ───────── │                         │
│    │         (1초 대기)                 │                         │
│    │──── GET /updates ───────────────►  │                         │
│    │  ◄──── 200 OK (빈 응답) ───────── │                         │
│    │         (1초 대기)                 │                         │
│    │──── GET /updates ───────────────►  │                         │
│    │  ◄──── 200 OK (데이터!) ────────── │  ← 드디어 데이터!      │
│    │         (1초 대기)                 │                         │
│    │──── GET /updates ───────────────►  │                         │
│    │  ◄──── 200 OK (빈 응답) ───────── │  ← 다시 빈 응답...     │
│    │                                    │                         │
│                                                                   │
│  특성:                                                           │
│  ├── 구현: 극히 단순 (setInterval + fetch)                      │
│  ├── 문제: 대부분 빈 응답 = 대역폭 낭비                        │
│  ├── 지연: 최대 1 polling interval                              │
│  └── 서버 부하: 클라이언트 수 × 요청 빈도                      │
│                                                                   │
│  1,000명 × 1초 간격 = 초당 1,000 요청                           │
│  1,000명 × 100ms 간격 = 초당 10,000 요청 → 서버 과부하!        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.2 Long Polling

```
┌─────────────────────────────────────────────────────────────────┐
│              Long Polling (롱 폴링)                              │
│                                                                   │
│  Client                              Server                      │
│    │                                    │                         │
│    │──── GET /poll ──────────────────►  │                         │
│    │                                    │  (hold... 대기중...)    │
│    │                                    │  (최대 30초)            │
│    │                                    │  (이벤트 발생!)         │
│    │  ◄──── 200 OK (데이터) ────────── │                         │
│    │                                    │                         │
│    │──── GET /poll (즉시 재요청) ────►  │  ← 즉시 새 연결        │
│    │                                    │  (hold... 대기중...)    │
│    │                                    │  (30초 timeout)         │
│    │  ◄──── 204 No Content ─────────── │  ← 타임아웃             │
│    │                                    │                         │
│    │──── GET /poll (즉시 재요청) ────►  │                         │
│    │                                    │                         │
│                                                                   │
│  Short Polling 대비 개선점:                                      │
│  ├── 빈 응답 거의 없음 (데이터 있을 때만 응답)                  │
│  ├── 데이터 도착 즉시 전달 (지연 최소화)                        │
│  └── 불필요한 요청 감소                                          │
│                                                                   │
│  남아있는 한계:                                                  │
│  ├── 매 응답마다 새 HTTP 연결 (헤더 오버헤드 반복)              │
│  ├── 서버: 열린 연결 대량 유지 (스레드/메모리)                  │
│  └── Timeout 30초: 프록시/방화벽 idle 연결 강제 종료 방지용     │
│                                                                   │
│  RFC 6202: Long Polling 평균 지연 = 1 network transit            │
│            최대 지연 = 3 network transit                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.3 SSE (Server-Sent Events)

```
┌─────────────────────────────────────────────────────────────────┐
│              SSE = 표준화된 서버 → 클라이언트 스트리밍            │
│                                                                   │
│  Client                              Server                      │
│    │                                    │                         │
│    │──── GET /events ───────────────►  │                         │
│    │     Accept: text/event-stream     │                         │
│    │                                    │                         │
│    │  ◄──── 200 OK ────────────────── │                         │
│    │        Content-Type:              │                         │
│    │        text/event-stream          │                         │
│    │                                    │                         │
│    │  ◄──── event: update ──────────── │  ← 이벤트 1            │
│    │        data: {"price": 150}       │                         │
│    │        id: 1001                   │                         │
│    │                                    │                         │
│    │  ◄──── event: update ──────────── │  ← 이벤트 2            │
│    │        data: {"price": 151}       │                         │
│    │        id: 1002                   │                         │
│    │                                    │                         │
│    │  (연결 끊김!)                      │                         │
│    │                                    │                         │
│    │──── GET /events ───────────────►  │  ← 자동 재연결!        │
│    │     Last-Event-ID: 1002           │  ← 마지막 ID 전송      │
│    │                                    │                         │
│    │  ◄──── id: 1003 ─────────────── │  ← 1002 이후부터        │
│    │        data: {"price": 152}       │     재전송              │
│    │                                    │                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### text/event-stream 프로토콜 형식

```
┌─────────────────────────────────────────────────────────────────┐
│  SSE 이벤트 형식 (각 이벤트는 빈 줄 \n\n 으로 구분)             │
│                                                                   │
│  event: userJoined\n                                             │
│  data: {"userId": "abc123", "name": "Alice"}\n                   │
│  id: 42\n                                                        │
│  retry: 5000\n                                                   │
│  \n                                                               │
│                                                                   │
│  필드 상세:                                                      │
│  ┌─────────┬────────────────────────────────────────────────┐   │
│  │ event:  │ 이벤트 타입. 생략 시 "message" 이벤트          │   │
│  ├─────────┼────────────────────────────────────────────────┤   │
│  │ data:   │ 실제 데이터. 여러 줄이면 각 줄마다 data: 반복  │   │
│  ├─────────┼────────────────────────────────────────────────┤   │
│  │ id:     │ 이벤트 ID. 재연결 시 Last-Event-ID 헤더로 전송 │   │
│  ├─────────┼────────────────────────────────────────────────┤   │
│  │ retry:  │ 재연결 대기 시간 (밀리초). 브라우저 자동 적용  │   │
│  ├─────────┼────────────────────────────────────────────────┤   │
│  │ : (주석)│ 콜론으로 시작. 클라이언트 무시. heartbeat 활용  │   │
│  └─────────┴────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### EventSource API

```javascript
// 클라이언트 JavaScript
const eventSource = new EventSource('/events');

eventSource.onopen = () => console.log('연결됨');

eventSource.onmessage = (event) => {
    console.log('기본 메시지:', event.data);
};

eventSource.addEventListener('userJoined', (event) => {
    const user = JSON.parse(event.data);
    console.log('사용자 입장:', user.name);
});

eventSource.onerror = (error) => {
    // 브라우저가 자동 재연결 시도 (retry 간격 적용)
    console.log('연결 오류, 자동 재연결 대기중...');
};
```

---

## 4.4 WebSocket

### HTTP Upgrade 핸드셰이크 상세

```
┌─────────────────────────────────────────────────────────────────┐
│              WebSocket 핸드셰이크 과정 (RFC 6455)                │
│                                                                   │
│  1. Client → Server (HTTP/1.1 GET):                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  GET /chat HTTP/1.1                                      │    │
│  │  Host: server.example.com                                │    │
│  │  Upgrade: websocket                                      │    │
│  │  Connection: Upgrade                                     │    │
│  │  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==            │    │
│  │  Sec-WebSocket-Version: 13                               │    │
│  │                                                          │    │
│  │  ↑ Sec-WebSocket-Key: 무작위 16바이트 Base64 인코딩     │    │
│  │  ↑ Version 13: RFC 6455의 최종 버전                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. Server → Client (101 Switching Protocols):                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  HTTP/1.1 101 Switching Protocols                        │    │
│  │  Upgrade: websocket                                      │    │
│  │  Connection: Upgrade                                     │    │
│  │  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=     │    │
│  │                                                          │    │
│  │  ↑ Accept 계산:                                          │    │
│  │    Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"          │    │
│  │    → SHA-1 해시 → Base64 인코딩                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  3. 이후: HTTP 종료, WebSocket 바이너리 프레임 프로토콜로 전환   │
│     → 양방향(full-duplex) 통신 시작                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket 프레임 구조

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - -+
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - -+-------------------------------+
|  Masking-key, if MASK set (32 bits)                           |
+-------------------------------+-------------------------------+
|    Payload Data (masked if MASK set)                          |
+-----------+---------------------------------------------------+
```

| 필드 | 크기 | 설명 |
|------|------|------|
| FIN | 1bit | 마지막 fragment이면 1. fragmented 메시지의 중간 프레임은 0 |
| RSV1-3 | 3bits | 예약 비트. 확장용 (예: permessage-deflate 압축 시 RSV1 사용) |
| opcode | 4bits | `0x0`: continuation, `0x1`: text, `0x2`: binary, `0x8`: close, `0x9`: ping, `0xA`: pong |
| MASK | 1bit | 클라이언트 → 서버 방향은 **항상 1** (RFC 6455 강제) |
| Payload len | 7bits | 0-125: 그 자체가 길이. 126: 다음 2바이트. 127: 다음 8바이트 |
| Masking-key | 32bits | MASK=1일 때만 존재. 클라이언트가 생성하는 랜덤 키 |
| Payload | 가변 | 실제 데이터. 클라이언트 발신 시 XOR masking 적용 |

**Masking의 이유**: 중간 프록시의 cache poisoning 공격 방지. 클라이언트가 보내는 모든 프레임은 반드시 masking해야 한다.

**ping/pong**: opcode `0x9`(ping)를 받으면 반드시 동일 payload로 `0xA`(pong) 응답. keepalive 용도.

**close 핸드셰이크**: opcode `0x8`(close) 프레임을 보내면, 상대방도 close 프레임으로 응답한 후 TCP 연결 종료.

---

## 4.5 HTTP/2 Server Push (왜 실시간용이 아닌지)

```
┌─────────────────────────────────────────────────────────────────┐
│              HTTP/2 Server Push ≠ 실시간 통신                    │
│                                                                   │
│  Client                              Server                      │
│    │                                    │                         │
│    │──── GET /page.html ─────────────►  │                         │
│    │  ◄──── PUSH_PROMISE (css) ─────── │  ← CSS 미리 예고        │
│    │  ◄──── PUSH_PROMISE (js) ──────── │  ← JS 미리 예고         │
│    │  ◄──── 200 OK (page.html) ──────  │                         │
│    │  ◄──── Pushed CSS response ─────  │                         │
│    │  ◄──── Pushed JS response ──────  │                         │
│    │                                    │                         │
│                                                                   │
│  실시간 통신용으로 부적합한 이유:                                │
│  ├── 목적: "예측적 정적 리소스 전달" (실시간 이벤트 X)          │
│  ├── 클라이언트가 어차피 요청했을 리소스를 미리 보내는 것       │
│  ├── 동적 실시간 이벤트 스트리밍에 사용 불가                    │
│  ├── 서버가 클라이언트 캐시 상태를 모름 → 대역폭 낭비          │
│  └── Chrome은 2022년에 Server Push 지원 제거!                   │
│                                                                   │
│  결론: HTTP/2 Server Push는 실시간 통신 기술이 아니다.           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.6 gRPC Streaming (4가지 모드)

```
┌─────────────────────────────────────────────────────────────────┐
│              gRPC Streaming = HTTP/2 + Protocol Buffers           │
│                                                                   │
│  4가지 모드:                                                     │
│                                                                   │
│  1. Unary RPC (일반 요청-응답)                                   │
│     Client ─── 1 request ──► Server                              │
│     Client ◄── 1 response ── Server                              │
│                                                                   │
│  2. Server Streaming RPC                                         │
│     Client ─── 1 request ──────────► Server                      │
│     Client ◄── stream(response 1) ── Server                      │
│     Client ◄── stream(response 2) ── Server                      │
│     Client ◄── stream(response N) ── Server                      │
│                                                                   │
│  3. Client Streaming RPC                                         │
│     Client ─── stream(request 1) ──► Server                      │
│     Client ─── stream(request 2) ──► Server                      │
│     Client ─── stream(request N) ──► Server                      │
│     Client ◄── 1 response ────────── Server                      │
│                                                                   │
│  4. Bidirectional Streaming RPC                                  │
│     Client ─── stream(msg1) ──────► Server                       │
│     Client ◄── stream(reply1) ───── Server                       │
│     Client ─── stream(msg2) ──────► Server                       │
│     Client ◄── stream(reply2) ───── Server                       │
│     (양방향 독립 스트림, 순서 무관)                               │
│                                                                   │
│  적합: 마이크로서비스 간 통신, 타입 안전 스트리밍                │
│  한계: 브라우저 직접 사용 제한 (grpc-web 필요)                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```protobuf
// Server Streaming 예시
rpc ListEvents (EventRequest) returns (stream EventResponse);

// Bidirectional Streaming 예시
rpc Chat (stream ChatMessage) returns (stream ChatMessage);
```

---

## 4.7 WebTransport (QUIC 기반, WebSocket 후계자)

```
┌─────────────────────────────────────────────────────────────────┐
│              WebTransport = WebSocket의 미래                      │
│                                                                   │
│  WebSocket vs WebTransport 비교:                                 │
│                                                                   │
│  ┌──────────────────┬──────────────┬──────────────────┐         │
│  │ 비교 항목        │ WebSocket    │ WebTransport     │         │
│  ├──────────────────┼──────────────┼──────────────────┤         │
│  │ 기반 프로토콜    │ TCP          │ QUIC (UDP 기반)  │         │
│  │ 스트림           │ 단일 스트림  │ 다중 독립 스트림 │         │
│  │ HOL blocking     │ 있음         │ 없음             │         │
│  │ 데이터 전달      │ reliable만   │ reliable +       │         │
│  │                  │              │ unreliable       │         │
│  │ 네트워크 전환    │ 연결 끊김    │ 연결 유지        │         │
│  │ 연결 수립 속도   │ TCP 3-way    │ QUIC 0-RTT      │         │
│  │ 브라우저 지원    │ 100%         │ ~75% (2026)      │         │
│  └──────────────────┴──────────────┴──────────────────┘         │
│                                                                   │
│  Unreliable datagram의 의미:                                     │
│  게임 등에서 최신 위치만 중요하고 지연된 패킷은 무의미.          │
│  → 같은 연결에서 reliable + unreliable 동시 사용 가능            │
│                                                                   │
│  현재 상태 (2026):                                               │
│  ├── Chrome/Edge: 지원                                           │
│  ├── Firefox: 구현 중                                            │
│  ├── Safari: 미지원                                              │
│  └── 서버 인프라 생태계: 미성숙 (프로덕션 2-3년 후 전망)        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.8 GraphQL Subscriptions

```
┌─────────────────────────────────────────────────────────────────┐
│  GraphQL Subscriptions = 선언적 실시간 데이터 구독               │
│                                                                   │
│  Client                              Server                      │
│    │──WS Upgrade + graphql-ws──────►  │                          │
│    │──{"type":"connection_init"}────►  │                          │
│    │  ◄──{"type":"connection_ack"}──── │                          │
│    │──{"type":"subscribe",             │                          │
│    │   "query":"subscription{…}"}───►  │                          │
│    │  ◄──{"type":"next","data":{…}}── │  ← 이벤트 발생 시마다   │
│    │  ◄──{"type":"next","data":{…}}── │                          │
│    │                                    │                         │
│                                                                   │
│  전송 계층: WebSocket이 일반적이나 SSE도 가능                    │
│  (GraphQL Subscriptions는 대부분 단방향이므로 SSE로 충분)        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.9 Socket.IO (Engine.IO + Fallback + Room/Namespace)

```
┌─────────────────────────────────────────────────────────────────┐
│              Socket.IO 아키텍처                                   │
│                                                                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │                 Socket.IO (상위 레이어)             │          │
│  │  이벤트 emit/handle, 자동 재연결, 패킷 버퍼링,    │          │
│  │  멀티플렉싱, Namespace, Room                       │          │
│  ├───────────────────────────────────────────────────┤          │
│  │                 Engine.IO (하위 레이어)             │          │
│  │  연결 수립, transport 선택/upgrade, heartbeat,     │          │
│  │  연결 상태 관리                                    │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                   │
│  Fallback 메커니즘:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1단계: HTTP Long-Polling으로 즉시 연결 수립            │    │
│  │         (WebSocket 시도 전 안정적 연결 보장)            │    │
│  │                                                          │    │
│  │  2단계: Background에서 WebSocket 업그레이드 시도         │    │
│  │         ├── 성공: Long-Polling 종료, WebSocket으로 전환  │    │
│  │         └── 실패: Long-Polling 유지                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Namespace: 단일 연결 위에 논리적 채널 분리                      │
│    /admin, /chat, /monitoring → 각각 별도 미들웨어 적용 가능     │
│                                                                   │
│  Room: 순수 서버 측 그룹화 메커니즘                              │
│    io.to('game-room-42').emit('gameUpdate', data);               │
│    클라이언트는 자신이 어느 room에 속하는지 모름                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4.10 STOMP 프로토콜

```
┌─────────────────────────────────────────────────────────────────┐
│  STOMP 프레임 기본 구조                                          │
│                                                                   │
│  COMMAND\n                                                       │
│  header1:value1\n                                                │
│  header2:value2\n                                                │
│  \n                        ← 빈 줄이 헤더와 바디 구분            │
│  Body content here^@       ← ^@ = NULL 바이트(0x00)로 종료       │
│                                                                   │
│  주요 클라이언트 명령어:   주요 서버 명령어:                     │
│  ├── CONNECT / STOMP       ├── CONNECTED                        │
│  ├── SUBSCRIBE             ├── MESSAGE                          │
│  ├── SEND                  ├── RECEIPT                          │
│  ├── UNSUBSCRIBE           └── ERROR                            │
│  ├── ACK / NACK                                                  │
│  ├── BEGIN / COMMIT / ABORT                                      │
│  └── DISCONNECT                                                  │
│                                                                   │
│  Spring Framework에서의 STOMP over WebSocket:                    │
│                                                                   │
│  클라이언트 → WebSocket → STOMP 프레임 → Spring Message Broker   │
│                                               │                   │
│                                    /app/** : @MessageMapping      │
│                                    /topic/** : SimpleBroker       │
│                                    /user/** : 개인 전송           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. 학술적 기반 (Academic Foundation)

## 5.1 RFC 및 공식 스펙

| RFC/스펙 | 제목 | 발행일 | 상태 | 핵심 내용 |
|----------|------|--------|------|-----------|
| **RFC 6455** | The WebSocket Protocol | 2011.12 | Standards Track | TCP 위 양방향 통신, HTTP Upgrade 핸드셰이크, 프레임 마스킹 의무화, ws:/wss:// URI 스킴 |
| **RFC 6202** | Known Issues and Best Practices for Long Polling and Streaming | 2011.04 | Informational | Long Polling/Streaming 알려진 문제, 프록시 간섭, 파이프라이닝 충돌, 연결 수 제한 |
| **RFC 8441** | Bootstrapping WebSockets with HTTP/2 | 2018.09 | Standards Track | HTTP/2 단일 스트림 위 WebSocket, Extended CONNECT `:protocol` 헤더 |
| **RFC 9220** | Bootstrapping WebSockets with HTTP/3 | 2022.06 | Standards Track | HTTP/3(QUIC) 위 WebSocket. 2026년 기준 브라우저 실구현 전무 |
| **WHATWG SSE** | Server-Sent Events (HTML Living Standard) | 2004~ | Living Standard | EventSource API, text/event-stream MIME, 자동 재연결, Last-Event-ID |
| **STOMP 1.2** | Streaming Text Oriented Messaging Protocol | 2012.10 | - | 텍스트 기반 프레임, HTTP 영감 설계, WebSocket 위 메시징 브로커 의미론 |

## 5.2 관련 논문/기술 문서

- **Bayeux Protocol (CometD, 2008)**: Dojo Foundation. Comet 클라이언트-서버 표준 통신 프로토콜. JSON 기반 Pub/Sub, Named Channel, Transport 독립적
- **"Is the Web ready for HTTP/2 Server Push?" (arXiv, 2018)**: HTTP/2 Server Push 실제 성능 측정. 캐시 문제로 실용성 낮음을 실증
- **RxDB 기술 비교**: WebSocket 연결 후 2바이트 오버헤드로 가장 낮음. SSE 약 5바이트. Long Polling이 가장 높음
- **RFC 2616 (1999) → RFC 7230 (2014)**: HTTP/1.1 Persistent Connection이 Long Polling/Streaming의 기술적 토대. 도메인당 2개 연결 권고 → 2008년 Firefox 3이 6개로 상향

---

# 6. 대안 비교표 (Comparison Table)

## 6.1 핵심 특성 비교

| 특성 | Short Polling | Long Polling | SSE | WebSocket | WebTransport | gRPC Streaming |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **방향성** | Client Pull | Client Pull | Server→Client | 양방향 | 양방향+다중 스트림 | 양방향 |
| **프로토콜** | HTTP | HTTP | HTTP | WS/WSS (TCP) | QUIC (UDP) | HTTP/2 |
| **연결 방식** | 반복 요청 | 지연 응답 | 지속 연결 | 지속 연결 | 지속 연결 | 지속 연결 |
| **지연시간** | 매우 높음 | 높음 | 낮음 (~3-6ms) | 가장 낮음 (~1-3ms) | 가장 낮음 | 낮음 |
| **헤더 오버헤드** | 500-2000B/요청 | 500-2000B/요청 | 최초 1회 | 프레임당 2-6B | 프레임당 최소 | Protobuf (바이너리) |
| **자동 재연결** | 수동 | 수동 | 브라우저 내장 | 수동 | 수동 | 수동 |
| **바이너리 지원** | HTTP body | HTTP body | 불가 (텍스트만) | 지원 | 지원 | Protobuf |
| **HTTP/2 다중화** | 가능 | 가능 | 가능 | 불가 (RFC 8441로 가능) | N/A (HTTP/3) | 기본 |
| **방화벽 호환** | 매우 좋음 | 매우 좋음 | 좋음 | 주의 필요 | 주의 필요 | 주의 필요 |
| **Sticky Session** | 불필요 | 불필요 | 불필요 | 필요 | 필요 | 가능 |
| **구현 복잡도** | 매우 낮음 | 낮음 | 낮음 | 중간 | 높음 | 중간 |
| **브라우저 지원** | 100% | 100% | 모든 현대 | 모든 현대 | ~75% | grpc-web 필요 |
| **프로덕션 성숙도** | 높음 | 높음 | 높음 | 높음 | 낮음 | 높음 |

## 6.2 성능 벤치마크 수치

### 지연시간 (Latency)

| 방식 | 일반적 지연시간 | 비고 |
|------|:-:|------|
| WebSocket | ~1-3ms | 연결 수립 후, BTC 시세 기준 ~0.5ms |
| SSE | ~3-6ms | WebSocket 대비 소폭 높음 |
| Long Polling | 100-200ms | 새 연결 수립 비용 누적 |
| Short Polling | 폴링 주기 + 처리시간 | 최소 수백 ms |

SSE와 WebSocket의 순수 지연시간 차이는 약 3ms로, 100,000 events/sec 규모에서도 실질적 차이 미미.

### 네트워크 오버헤드

- Socket.IO 측정: HTTP 요청/응답 1쌍 = 282 bytes, WebSocket 동일 데이터 = 54 bytes
- 50회 반복 시 WebSocket이 HTTP 대비 약 50% 빠름
- 단일 요청만일 경우 HTTP가 약 50% 빠름 (WebSocket 연결 수립 비용)

### 동시 연결 규모

```
┌─────────────────────────────────────────────────────────────────┐
│              동시 연결 규모별 서버 요구사항                       │
│                                                                   │
│  C10K (1만 동시 연결)                                            │
│  ├── WebSocket: 연결당 ~3.2 KB (커널 소켓), CPU 효율적          │
│  ├── Long Polling: 스레드 모델에서 고메모리                      │
│  └── 해결: Nginx, Node.js 등 이벤트 드리븐 서버                 │
│                                                                   │
│  C100K (10만 동시 연결)                                          │
│  ├── Nginx/Node.js + 커널 튜닝으로 단일 노드 240,000 연결      │
│  ├── 지연시간 50ms 이하 유지 가능 (Ably 벤치마크)               │
│  └── 해결: OS 커널 튜닝 + 비동기 I/O                            │
│                                                                   │
│  C10M (1000만 동시 연결)                                         │
│  ├── MigratoryData 실증 (Dell R610, 12코어, 96GB RAM):          │
│  │   ├── 10,000,108 동시 연결                                    │
│  │   ├── 커널 소켓당 ~3.2 KB → 전체 ~32 GB                     │
│  │   ├── JVM 힙: 54 GB                                          │
│  │   ├── CPU: 50% 미만                                          │
│  │   ├── 처리량: 168,000 msg/sec (~10M msg/min)                 │
│  │   ├── 중앙값 지연: 18ms                                      │
│  │   └── 99th percentile: 585ms                                 │
│  └── WhatsApp: 24코어 Erlang/FreeBSD에서 200만 동시 연결        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 상황별 최적 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│              의사결정 플로우차트                                   │
│                                                                   │
│  실시간 통신이 필요한가?                                         │
│  │                                                                │
│  ├── YES: 서버→클라이언트 단방향인가?                            │
│  │   │                                                            │
│  │   ├── YES → SSE 우선 고려                                     │
│  │   │   ├── 알림, 대시보드, 피드 → SSE                          │
│  │   │   ├── AI 스트리밍 응답 → SSE                              │
│  │   │   ├── 기업 방화벽 환경 → SSE (HTTP 기반)                  │
│  │   │   └── HTTP/2 + 확장성 → SSE                               │
│  │   │                                                            │
│  │   └── NO (양방향 필요):                                       │
│  │       │                                                        │
│  │       ├── 웹 브라우저 클라이언트?                              │
│  │       │   ├── 채팅, 게임, 실시간 협업 → WebSocket              │
│  │       │   └── 멀티스트림 + 저지연 (미래) → WebTransport        │
│  │       │                                                        │
│  │       └── 서버 간 통신?                                       │
│  │           ├── 타입 안전성 + 고성능 → gRPC Streaming            │
│  │           └── IoT 디바이스 간 → MQTT                           │
│  │                                                                │
│  └── NO (업데이트 드문 경우):                                    │
│      └── Short Polling 또는 일반 HTTP                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 시나리오별 권장 기술

| 시나리오 | 권장 기술 | 이유 |
|----------|-----------|------|
| **채팅** | WebSocket | 양방향 필수, 동일 연결에서 송수신, 지연 최소화 |
| **대시보드/알림** | SSE | 단방향 충분, 자동 재연결 내장, HTTP 호환, 구현 단순 |
| **온라인 게임** | WebSocket (현재) / WebTransport (미래) | 양방향 + 저지연. WebTransport는 HOL blocking 없음 |
| **IoT** | MQTT | 최소 헤더(2B), QoS 레벨 선택, 불안정 네트워크에 강함 |
| **마이크로서비스 간** | gRPC Streaming | Protobuf 바이너리, 타입 안전, HTTP/2 멀티플렉싱 |
| **AI 스트리밍 응답** | SSE | ChatGPT/Claude 등에서 광범위 사용, 단방향 충분 |
| **주식 시세** | SSE 또는 WebSocket | 단방향이면 SSE, 사용자 인터랙션 있으면 WebSocket |
| **실시간 협업** (Figma, Docs) | WebSocket | 양방향 동시 편집, OT/CRDT 알고리즘 동기화 |

---

# 8. 실제 기업 사용 사례

```
┌─────────────────────────────────────────────────────────────────┐
│              실제 기업 사용 사례                                   │
│                                                                   │
│  Slack                                                           │
│  ├── 피크 시간대 500만+ 동시 WebSocket 세션                     │
│  ├── Gateway Server(Java): stateful, 인메모리 사용자 정보       │
│  └── Channel Server: 메시지 브로드캐스트 및 순서 조정            │
│                                                                   │
│  Discord                                                         │
│  ├── Gateway WebSocket 연결 필수 (유일한 실시간 경로)            │
│  ├── ETF(Erlang 바이너리 포맷) 인코딩 옵션                      │
│  └── heartbeat로 연결 유지                                       │
│                                                                   │
│  Twitter/X                                                       │
│  ├── Streaming API에 SSE 사용 (외부 개발자 대상)                │
│  └── 타임라인 업데이트 server push (단방향 → SSE 적합)          │
│                                                                   │
│  Facebook/Meta                                                   │
│  ├── 초기: Long Polling 기반 채팅                                │
│  ├── 전환: Firefox Messenger에서 WebSocket 대규모 적용           │
│  └── 현재: 웹=WebSocket, 모바일=MQTT (대역폭 최소화)            │
│                                                                   │
│  Google Docs                                                     │
│  ├── WebSocket 기반 실시간 협업                                  │
│  └── OT(Operational Transformation) 알고리즘으로 충돌 해결       │
│                                                                   │
│  Figma                                                           │
│  ├── WebSocket multiplayer 아키텍처                              │
│  ├── 객체 속성별 최신값 추적 (Last Write Wins)                   │
│  └── 커서 위치 등 ephemeral 데이터도 WebSocket 브로드캐스트      │
│                                                                   │
│  Uber                                                            │
│  ├── Node.js WebSocket 서버로 드라이버 GPS 수신                  │
│  ├── → Kafka 위치 큐 → Redis 지리공간 인덱스                    │
│  └── 라이드 오퍼도 WebSocket으로 드라이버에게 push               │
│                                                                   │
│  Netflix                                                         │
│  ├── Hystrix 모니터링 대시보드에 SSE 활용                        │
│  └── 마이크로서비스 성능 데이터 실시간 push (단방향 → SSE)       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 인프라 관점

## 9.1 로드밸런서 (L4/L7, Sticky Session)

| 방식 | L4 LB (NLB) | L7 LB (ALB) | Sticky Session |
|------|:-:|:-:|:-:|
| Polling | 불필요 | 가능 | 불필요 |
| SSE | 가능 | 주의 (응답 버퍼링) | 불필요 |
| WebSocket | 가능 (권장) | 가능 (Upgrade 헤더 처리) | **필요** (연결 지속) |

WebSocket 핵심: 연결이 **stateful**이므로 한번 연결된 클라이언트는 동일 서버 인스턴스에 유지되어야 한다.

## 9.2 Nginx / HAProxy 설정

### Nginx WebSocket 설정

```nginx
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;    # 긴 타임아웃 필수
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Nginx SSE 설정 (가장 흔한 함정!)

```nginx
location /events {
    proxy_pass http://backend:8080;

    # 핵심! 누락 시 이벤트가 버퍼에 묶임
    proxy_buffering off;
    proxy_cache off;

    # HTTP/1.1 유지 (chunked transfer 지원)
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    chunked_transfer_encoding off;

    # 타임아웃: 기본 60초는 SSE에 너무 짧음
    proxy_read_timeout 86400s;   # 24시간
    proxy_send_timeout 86400s;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

| 설정 | 기본값 | SSE 필요값 | 이유 |
|------|--------|-----------|------|
| `proxy_buffering` | on | **off** | 이벤트 즉시 전달 |
| `proxy_read_timeout` | 60s | **86400s** | 장기 연결 유지 |
| `proxy_http_version` | 1.0 | **1.1** | Chunked transfer |
| `gzip` | on | **off** | 스트리밍 압축 충돌 |

### HAProxy WebSocket 설정

```haproxy
frontend ws_frontend
    acl is_websocket hdr(Upgrade) -i WebSocket
    use_backend ws_backend if is_websocket

backend ws_backend
    balance leastconn
    timeout tunnel 1h          # 핵심: tunnel 타임아웃
    cookie SERVERID insert indirect nocache
```

`timeout tunnel`이 가장 중요. 기본 HTTP 타임아웃이 적용되면 WebSocket 연결이 예기치 않게 끊긴다.

## 9.3 클라우드 환경

| 서비스 | WebSocket | SSE | 비고 |
|--------|-----------|-----|------|
| AWS ALB | 네이티브 지원 | 지원 | Idle timeout 기본 60초 (조정 필요) |
| AWS NLB | 지원 (L4) | 지원 | TCP 레벨 처리 |
| AWS API Gateway | WebSocket API 별도 | HTTP API 통해 지원 | $connect/$disconnect 라우트 |
| Cloudflare | 2014년부터 지원 | Workers에서 지원 | Durable Objects로 상태 관리 |

## 9.4 Kubernetes Ingress

```yaml
# AWS ALB Ingress Controller 기준
annotations:
  kubernetes.io/ingress.class: alb
  alb.ingress.kubernetes.io/target-type: ip
  alb.ingress.kubernetes.io/healthcheck-path: /health
  # 주의: WebSocket(ws://) 경로를 헬스체크하면 실패!
  # 반드시 HTTP 헬스체크 경로를 별도 지정
```

---

# 10. 서버 구현 아키텍처

## 10.1 Thread-per-Connection vs Event-Driven

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Thread-per-Connection 모델:                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  연결마다 하나의 OS 스레드 할당                          │    │
│  │  ├── 각 스레드: 1-2MB 메모리                            │    │
│  │  ├── 10,000 연결 = 10,000 스레드                        │    │
│  │  ├── → Context Switching 오버헤드                       │    │
│  │  ├── → 메모리 고갈 (20GB!)                              │    │
│  │  └── = C10K Problem의 근본 원인                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Event-Driven 모델 (epoll/kqueue):                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  epoll (Linux):                                          │    │
│  │  ├── epoll_create(): 인스턴스 생성                      │    │
│  │  ├── epoll_ctl(): 관심 fd 등록/수정/삭제                │    │
│  │  ├── epoll_wait(): 이벤트 발생 fd만 반환                │    │
│  │  └── 비용이 활성 이벤트 수에 비례 (총 연결 수 X)       │    │
│  │                                                          │    │
│  │  kqueue (BSD/macOS):                                     │    │
│  │  ├── kevent() 단일 함수로 등록+대기                     │    │
│  │  └── 파일, 소켓, 프로세스 등 통합 지원                  │    │
│  │                                                          │    │
│  │  핵심: "준비된 것만 알려준다(notify only when ready)"   │    │
│  │  수만 연결 중 실제 이벤트 발생한 소수만 처리            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.2 Spring MVC vs WebFlux

| 항목 | Spring MVC | Spring WebFlux |
|------|------------|----------------|
| I/O 모델 | Blocking (Servlet API) | Non-blocking (Reactive Streams) |
| 스레드 모델 | Thread-per-request | 소수의 event loop 스레드 (Netty) |
| WebSocket | 지원 (blocking write/read) | 완전한 non-blocking |
| 반환 타입 | 동기 객체 | `Mono<T>`, `Flux<T>` |
| 적합 | JPA/JDBC, 기존 코드베이스 | 고동시성 I/O 바운드, 스트리밍 |

Spring WebFlux는 Reactor Netty 위에서 동작. Netty는 내부적으로 epoll(Linux) 또는 kqueue(macOS)를 사용해 수만 개의 WebSocket 연결을 소수의 스레드로 처리한다.

## 10.3 Node.js 이벤트 루프

```
┌─────────────────────────────────────────────────────────────────┐
│  [V8 JavaScript Engine]                                          │
│           ↓                                                       │
│  [Node.js Event Loop (libuv)]                                    │
│     ├── timers (setTimeout, setInterval)                         │
│     ├── I/O callbacks                                            │
│     ├── idle, prepare                                            │
│     ├── poll ← epoll/kqueue로 WebSocket 이벤트 감지             │
│     ├── check (setImmediate)                                     │
│     └── close callbacks                                          │
│                                                                   │
│  WebSocket 연결은 대부분 idle 상태 (간헐적 메시지)               │
│  → 단일 스레드가 수천 개 연결을 이벤트 기반으로 처리             │
│  → CPU 집약적 작업 없는 실시간 메시징 서버에 최적                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.4 Kotlin 코루틴 + Flow

```kotlin
// 연결 상태를 StateFlow로 관리
val connectionState = MutableStateFlow<ConnectionState>(Disconnected)

// 수신 메시지를 Flow로 노출
fun observeMessages(): Flow<Message> = flow {
    webSocketSession.incoming.collect { frame ->
        emit(frame.toMessage())
    }
}

// 코루틴으로 WebSocket 연결 관리
fun connect() = scope.launch {
    try {
        client.webSocket(url) {
            connectionState.value = Connected
            for (frame in incoming) {
                processFrame(frame)  // suspend 함수로 non-blocking
            }
        }
    } finally {
        connectionState.value = Disconnected
    }
}
```

**Channel vs Flow 선택 기준:**
- `Channel`: 단일 소비자, 이벤트 순서 보장, 버퍼링 필요
- `SharedFlow`: 다중 구독자, hot stream (WebSocket 메시지 브로드캐스트)
- `StateFlow`: 최신 상태만 필요, UI 상태 관리 (연결 상태 표시)

---

# 11. 베스트 프랙티스

## 11.1 WebSocket 베스트 프랙티스

### Heartbeat (ping/pong)

```
┌─────────────────────────────────────────────────────────────────┐
│  권장 설정:                                                      │
│  ├── Ping 전송 간격: 30초                                       │
│  ├── Pong 응답 대기 타임아웃: 5초                               │
│  └── 응답 없을 시: 연결 종료 후 재연결                          │
│                                                                   │
│  Ghost Connection 문제:                                          │
│  모바일 네트워크 전환, 슬립 모드 복귀 시                        │
│  연결이 "살아있는 것처럼 보이지만 실제로는 죽은" 상태           │
│  → heartbeat 없이는 감지 불가                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
class ResilientWebSocket {
  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.pongTimeout = setTimeout(() => {
          this.ws.terminate(); // 5초 내 pong 미수신 시 강제 종료
        }, 5000);
      }
    }, 30000);
  }
}
```

### Exponential Backoff with Jitter

```javascript
function getReconnectDelay(attempt) {
  const base = 1000;        // 1초 기본
  const max = 30000;        // 최대 30초
  const exponential = Math.min(base * 2 ** attempt, max);
  const jitter = Math.random() * 1000;  // 0~1초 무작위
  return exponential + jitter;
}
// 시도별 지연: ~1s, ~2s, ~4s, ~8s, ~16s, ~30s (최대)
```

재연결 성공 후 반드시 서버로부터 최신 상태 스냅샷을 fetch해서 놓친 이벤트 보정.

### 인증: JWT 토큰 전달

```
┌─────────────────────────────────────────────────────────────────┐
│  브라우저 WebSocket API는 HTTP Authorization 헤더 미지원!        │
│                                                                   │
│  방법 A: Query Parameter (편리하지만 보안 주의)                  │
│  wss://api.example.com/ws?token=eyJhbGc...                       │
│  └── 단점: 토큰이 서버 로그, 프록시 로그에 노출                 │
│  └── 완화: 일회용 단기 토큰(수 분 유효) 발급                    │
│                                                                   │
│  방법 B: Sec-WebSocket-Protocol 헤더 (권장)                      │
│  new WebSocket(url, ['v1', `token.${jwt}`]);                     │
│                                                                   │
│  방법 C: 연결 직후 인증 메시지 (가장 안전)                       │
│  ws.onopen = () => ws.send({type:'auth', token: jwt});           │
│  └── 서버: 10초 내 auth 미수신 시 연결 강제 종료 (1008)         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Redis Pub/Sub 스케일링

```
┌─────────────────────────────────────────────────────────────────┐
│  다중 서버 환경에서 WebSocket 메시지 동기화                      │
│                                                                   │
│  [Client A] ──► [WS Server 1] ──► Redis PUBLISH "room:42"       │
│                                           │                       │
│  [Client B] ──► [WS Server 2] ──SUBSCRIBE─┘ → 로컬 broadcast    │
│                                                                   │
│  원리:                                                           │
│  1. 각 WS 서버는 관련 Redis 채널을 SUBSCRIBE                    │
│  2. 메시지 수신 시 Redis에 PUBLISH                               │
│  3. 모든 서버가 수신 후 로컬 클라이언트에게 브로드캐스트         │
│                                                                   │
│  고급 대안: 초대형 시스템에서는 NATS JetStream 권장              │
│                                                                   │
│  Sticky Session vs Pub/Sub:                                      │
│  ├── Sticky Session: 구현 단순, 로드밸런서가 단일 장애 지점     │
│  └── Pub/Sub (권장): 탄력적 확장, 장애 격리                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 보안

- `wss://` (TLS) 사용 필수. `ws://`는 프로덕션 사용 금지
- **Origin 헤더 검증**: Cross-Site WebSocket Hijacking (CSWSH) 방지
- **Rate Limiting**: 연결당 10 msg/s, IP당 신규 연결 10개/분
- **메시지 크기 제한**: 기본 1MB 이하
- **JSON Schema 검증**: 입력 메시지 타입 화이트리스트
- **압축 주의**: CRIME/BREACH 공격 취약점 (민감 데이터 + 압축)

## 11.2 SSE 베스트 프랙티스

### Last-Event-ID 복구 전략

```
# 서버 이벤트 형식
id: 1001
event: order-update
data: {"orderId": "abc", "status": "shipped"}
retry: 3000

id: 1002
event: order-update
data: {"orderId": "xyz", "status": "delivered"}
```

서버 측에서 **반드시 이벤트 저장소(DB 또는 캐시)를 유지**해야 Last-Event-ID 기반 복구가 가능하다.

### HTTP/2 최적화

```
HTTP/1.1: 도메인당 최대 6개 연결 (SSE 연결이 점유)
HTTP/2: 단일 TCP 연결에서 멀티플렉싱 → 연결 제한 사실상 없음
```

HTTP/2 전환만으로 SSE의 가장 큰 제약인 연결 수 문제가 해결된다.

## 11.3 Polling 베스트 프랙티스

### Adaptive Polling (적응형 폴링)

```javascript
class AdaptivePoller {
  interval = 1000;
  minInterval = 1000;
  maxInterval = 30000;

  async poll() {
    const response = await fetch('/api/updates');
    if (response.status === 304) {
      this.interval = Math.min(this.interval * 1.5, this.maxInterval);
    } else {
      this.interval = this.minInterval;
    }
    setTimeout(() => this.poll(), this.interval);
  }
}
```

### ETag / If-None-Match

```http
# 첫 요청
GET /api/data HTTP/1.1

# 서버 응답
HTTP/1.1 200 OK
ETag: "abc123"

# 이후 요청
GET /api/data HTTP/1.1
If-None-Match: "abc123"

# 변경 없을 때 (body 없음 → 대역폭 절약)
HTTP/1.1 304 Not Modified
```

## 11.4 Spring Boot 구현 패턴

### SseEmitter (MVC)

```java
@GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamEvents() {
    SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
    executor.execute(() -> {
        try {
            for (int i = 0; i < 100; i++) {
                emitter.send(SseEmitter.event()
                    .id(String.valueOf(i))
                    .name("update")
                    .data("Event " + i)
                    .reconnectTime(3000L));
                Thread.sleep(1000);
            }
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });
    return emitter;
}
```

### WebFlux Flux (권장, Non-blocking)

```java
@GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> streamEvents() {
    return Flux.interval(Duration.ofSeconds(1))
        .map(seq -> ServerSentEvent.<String>builder()
            .id(String.valueOf(seq))
            .event("tick")
            .data("Event " + seq)
            .retry(Duration.ofSeconds(3))
            .build());
}
```

### Kotlin Flow (최신 권장)

```kotlin
@GetMapping("/events", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
fun streamEvents(): Flow<ServerSentEvent<String>> = flow {
    var seq = 0L
    while (true) {
        emit(ServerSentEvent.builder<String>()
            .id(seq.toString())
            .event("update")
            .data("Event $seq")
            .build())
        seq++
        delay(1000)
    }
}.catch { e ->
    emit(ServerSentEvent.builder<String>()
        .comment("error: ${e.message}").build())
}
```

### DeferredResult Long Polling (Spring Boot)

```java
@GetMapping("/long-poll")
public DeferredResult<ResponseEntity<List<Event>>> longPoll(
        @RequestParam String lastEventId) {
    DeferredResult<ResponseEntity<List<Event>>> result =
        new DeferredResult<>(30000L); // 30초 타임아웃
    result.onTimeout(() ->
        result.setResult(ResponseEntity.noContent().build()));
    eventQueue.register(lastEventId, result);
    return result;
}
```

---

# 12. 주요 함정과 안티패턴

## 12.1 WebSocket 함정

```
┌─────────────────────────────────────────────────────────────────┐
│  함정 1: 프록시/방화벽이 WebSocket Upgrade를 차단               │
│  ├── 해결: wss:// (포트 443) 사용                               │
│  ├── 해결: 폴백 전략 (WS 실패 시 SSE 전환)                     │
│  └── 해결: Socket.IO 같은 폴링 폴백 라이브러리                 │
│                                                                   │
│  함정 2: 메모리 누수 (연결 해제 시 리소스 정리 누락)            │
│  ├── sessions.remove(session)                                    │
│  ├── subscriptions.remove(session.getId())                       │
│  └── heartbeatTimers.get(session.getId()).cancel()               │
│                                                                   │
│  함정 3: 브로드캐스트 O(N) 문제                                 │
│  ├── 10,000 연결 → 10,000번의 send() 동기 호출                 │
│  ├── 해결: 100ms 내 메시지 배치 전송                            │
│  ├── 해결: "좋아요 x 1000" 형태로 집계                         │
│  └── 해결: Redis Pub/Sub로 서버 간 분산                         │
│                                                                   │
│  함정 4: HTTP 미들웨어 재구현 필요                               │
│  └── WebSocket은 HTTP가 아니므로 인증/CORS/로깅 별도 구현       │
│                                                                   │
│  함정 5: 서버 재시작 시 모든 연결 끊김                           │
│  ├── 해결: Redis에 연결 상태 저장                               │
│  ├── 해결: Graceful shutdown + 재연결 유도                      │
│  └── 해결: 블루/그린 또는 롤링 업데이트                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.2 SSE 함정

```
┌─────────────────────────────────────────────────────────────────┐
│  함정 1: HTTP/1.1 연결 제한 (가장 실질적 문제)                  │
│  ├── 브라우저당 도메인별 6개 TCP 연결 제한                      │
│  ├── 탭 6개 이상 → 7번째 탭 SSE 연결 불가!                     │
│  ├── 해결: HTTP/2 전환 (멀티플렉싱)                             │
│  ├── 해결: SharedWorker로 탭 간 연결 공유                       │
│  └── 해결: 서브도메인 분리                                      │
│                                                                   │
│  함정 2: 바이너리 데이터 전송 불가                               │
│  ├── SSE는 텍스트 기반                                          │
│  ├── Base64 인코딩 필요 → ~33% 크기 증가                       │
│  └── 바이너리 많으면 WebSocket 사용                              │
│                                                                   │
│  함정 3: 클라이언트→서버 통신은 별도 HTTP 요청 필요             │
│  └── SSE 수신 + fetch() POST 전송 조합 (실제로는 명확한 패턴)   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.3 Polling 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│  안티패턴 1: 너무 짧은 고정 간격                                │
│  ├── setInterval(fetchUpdates, 100);  // 0.1초마다!             │
│  └── 1,000명 × 10 req/s = 10,000 req/s → 서버 과부하           │
│                                                                   │
│  안티패턴 2: 변경 없어도 Full Response 반환                      │
│  └── ETag/304 Not Modified 활용하지 않음 → 대역폭 낭비          │
│                                                                   │
│  안티패턴 3: Thundering Herd                                     │
│  ├── 1,000명이 정각에 동시 폴링 시작                            │
│  ├── 매 30초마다 1,000개 요청 동시 쇄도                         │
│  └── 해결: 초기 폴링 시작 시 jitter 추가                        │
│     const initialDelay = Math.random() * intervalMs;             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 마이그레이션 가이드

## 13.1 Polling → SSE 전환

```
┌─────────────────────────────────────────────────────────────────┐
│  전환 체크리스트:                                                │
│                                                                   │
│  1. 인프라 확인                                                  │
│     ├── Nginx: proxy_buffering off, 타임아웃 연장               │
│     ├── 로드밸런서: SSE 지원 여부                               │
│     └── HTTP/2 지원 여부 (연결 수 제한 해소)                    │
│                                                                   │
│  2. 서버 측 변경                                                 │
│     ├── 기존 폴링 엔드포인트 유지 (하위 호환)                   │
│     ├── SSE 엔드포인트 추가                                      │
│     ├── 이벤트 ID 시스템 구축 (Last-Event-ID 복구)              │
│     └── 이벤트 히스토리 저장소 구성                              │
│                                                                   │
│  3. 클라이언트 측 변경                                           │
│     ├── setInterval 제거                                         │
│     ├── EventSource 연결로 교체                                  │
│     └── onmessage / onerror / onopen 핸들러 구현                 │
│                                                                   │
│  4. 점진적 전환                                                  │
│     ├── Feature flag로 일부 사용자만 SSE 활성화                  │
│     ├── 에러율, 지연시간 모니터링                                │
│     └── 문제 없으면 점진적 확대                                  │
│                                                                   │
│  실제 사례: Long Polling → SSE 전환 시                           │
│  서버 8대 → 3대, 월 $3,800 절감 (연 $45,000)                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 13.2 SSE → WebSocket 전환

**전환이 필요한 신호:**
- 클라이언트에서 서버로 고빈도 메시지 전송 필요
- 지연시간 100ms 이하 요구사항
- 양방향 실시간 협업 기능 추가 시

**추가 고려사항:**
1. WebSocket 인증 체계 별도 구현
2. CORS, 보안 미들웨어 재구성
3. 스케일링 아키텍처 변경 (Redis Pub/Sub 등)
4. 프록시/방화벽 WebSocket 지원 확인
5. 폴백 전략 (WebSocket 실패 시 SSE 유지)

## 13.3 Socket.IO → Native WebSocket 전환

전환 전 확인:
1. 폴링 폴백이 실제 사용되고 있는가? (Socket.IO 로그에서 transport: polling 비율 확인)
2. 자동 재연결 로직을 직접 구현할 준비가 되었는가?
3. Room/Namespace 기능을 직접 구현할 수 있는가?

## 13.4 단계적 마이그레이션 (Strangler Fig Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 병렬 운영                                              │
│  ├── 기존 Polling 엔드포인트 유지                               │
│  ├── 새 SSE/WebSocket 엔드포인트 추가                           │
│  └── Feature Flag로 제어                                         │
│                                                                   │
│  Phase 2: 트래픽 이전                                            │
│  ├── 내부 사용자 → 베타 사용자 → 전체 사용자                   │
│  └── 각 단계에서 에러율, 레이턴시 메트릭 모니터링               │
│                                                                   │
│  Phase 3: 구형 엔드포인트 제거                                   │
│  ├── 구형 클라이언트 접속 비율 1% 미만 시                       │
│  └── Deprecation 헤더로 사전 경고 후 제거                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 14. References

## RFC 및 공식 스펙

- [RFC 6455 - The WebSocket Protocol (2011)](https://datatracker.ietf.org/doc/html/rfc6455)
- [RFC 6202 - Known Issues and Best Practices for Long Polling and Streaming (2011)](https://datatracker.ietf.org/doc/html/rfc6202)
- [RFC 8441 - Bootstrapping WebSockets with HTTP/2 (2018)](https://datatracker.ietf.org/doc/html/rfc8441)
- [RFC 9220 - Bootstrapping WebSockets with HTTP/3 (2022)](https://datatracker.ietf.org/doc/html/rfc9220)
- [RFC 7540 - HTTP/2 (2015)](https://httpwg.org/specs/rfc7540.html)
- [RFC 2616 - HTTP/1.1 (1999, 폐기)](https://datatracker.ietf.org/doc/html/rfc2616)
- [RFC 7230 - HTTP/1.1 Message Syntax (2014)](https://www.rfc-editor.org/rfc/rfc7230)
- [WHATWG SSE Living Standard](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [WHATWG WebSockets Standard](https://websockets.spec.whatwg.org/)
- [W3C SSE Publication History](https://www.w3.org/standards/history/eventsource/)
- [W3C WebSocket API Publication History](https://www.w3.org/standards/history/websockets/)
- [W3C WebTransport Working Draft](https://www.w3.org/TR/webtransport/)
- [STOMP Protocol Specification 1.2](https://stomp.github.io/stomp-specification-1.2.html)

## 기술 문서 및 가이드

- [MDN - Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN - Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)
- [MDN - Evolution of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP)
- [gRPC Core Concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [Socket.IO Documentation v4](https://socket.io/docs/v4/)
- [Spring Framework STOMP Overview](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/overview.html)
- [Spring WebFlux WebSockets](https://docs.spring.io/spring-framework/reference/web/webflux-websocket.html)

## 기술 비교 및 벤치마크

- [WebSockets vs SSE vs Long-Polling vs WebRTC vs WebTransport - RxDB](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [WebSocket vs SSE: Performance Battle 2025 - metatech.dev](https://www.metatech.dev/blog/2025-05-18-websocket-apis-vs-server-sent-events-performance-battle-2025)
- [How to Scale WebSockets - Ably](https://ably.com/topic/the-challenge-of-scaling-websockets)
- [MigratoryData C10M Problem Solved](https://migratorydata.com/blog/migratorydata-solved-the-c10m-problem/)
- [Can WebTransport replace WebSockets? - Ably](https://ably.com/blog/can-webtransport-replace-websockets)
- [WebSockets vs WebTransport - websocket.org](https://websocket.org/comparisons/webtransport/)
- [gRPC vs WebSocket - Ably](https://ably.com/topic/grpc-vs-websocket)
- [MQTT vs WebSocket - HiveMQ](https://www.hivemq.com/blog/understanding-the-differences-between-mqtt-and-websockets-for-iot/)

## 기업 사례

- [Real-time Messaging - Slack Engineering](https://slack.engineering/real-time-messaging/)
- [How Figma's multiplayer technology works - Figma Blog](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Under the hood: Facebook Messenger for Firefox - Meta Engineering](https://engineering.fb.com/2012/12/03/web/under-the-hood-facebook-messenger-for-firefox/)

## 베스트 프랙티스

- [WebSocket Architecture Best Practices - Ably](https://ably.com/topic/websocket-architecture-best-practices)
- [WebSocket Security Hardening Guide - websocket.org](https://websocket.org/guides/security/)
- [WebSocket Best Practices for Production - LatteStream](https://lattestream.com/blog/websocket-best-practices)
- [Configure SSE Through Nginx - OneUptime](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view)
- [Scaling Pub/Sub with WebSockets and Redis - Ably](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis)
- [Server-Sent Events in Spring - Baeldung](https://www.baeldung.com/spring-server-sent-events)
- [WebSockets with Spring - Baeldung](https://www.baeldung.com/websockets-spring)
- [Spring Boot 3 WebSocket JWT Authentication - Medium](https://medium.com/@poojithairosha/spring-boot-3-authenticate-websocket-connections-with-jwt-tokens-2b4ff60532b6)

## 역사 및 어원

- [Poll - Etymology (Etymonline)](https://www.etymonline.com/word/poll)
- [Socket - Etymology (Etymonline)](https://www.etymonline.com/word/socket)
- [The Road to WebSockets - websocket.org](https://websocket.org/guides/road-to-websockets)
- [The history of WebSockets - Ably](https://ably.com/topic/websockets-history)
- [WHATWG 2008 WebSocket Naming Discussion](https://lists.w3.org/Archives/Public/public-whatwg-archive/2008Jun/0186.html)
- [Comet (programming) - Wikipedia](https://en.wikipedia.org/wiki/Comet_(programming))
- [Ajax: A New Approach to Web Applications (2005, Jesse James Garrett)](https://designftw.mit.edu/lectures/apis/ajax_adaptive_path.pdf)
