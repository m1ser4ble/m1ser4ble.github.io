---
layout: single
title: "Action Router & Delegation 패턴 완전 가이드"
date: 2026-03-27 23:01:13 +0900
categories: backend
excerpt: "Action Router & Delegation 패턴 완전 가이드의 개념과 배경, 도입 이유와 특징을 정리해 실무 적용 판단을 돕는다."
toc: true
toc_sticky: true
tags: [backend, action, router, delegation, 라우팅위임패턴, 패턴]
source: "/home/dwkim/dwkim/docs/backend/action-router-delegation-라우팅위임패턴.md"
---
TL;DR
- Action Router & Delegation 패턴 완전 가이드의 핵심 개념을 빠르게 파악할 수 있다.
- 등장 배경과 도입 이유를 통해 왜 필요한지 맥락을 이해할 수 있다.
- 주요 특징과 상세 내용을 바탕으로 적용 시 고려사항을 정리할 수 있다.

## 1. 개념
Action Router & Delegation 패턴 완전 가이드의 정의와 문제 공간을 간단히 정리한다.

## 2. 배경
이 주제가 등장한 기술적·운영적 배경과 기존 접근의 한계를 설명한다.

## 3. 이유
왜 이 방식이 필요한지, 도입 시 기대 효과와 트레이드오프를 정리한다.

## 4. 특징
핵심 동작 방식, 장단점, 적용 시 주의점을 요약한다.

## 5. 상세 내용

# Action Router & Delegation 패턴 완전 가이드

> **작성일**: 2026-03-26
> **카테고리**: Backend / Design Patterns / Architecture / Routing / Delegation
> **키워드**: Action Router, Delegation, Dispatcher, Front Controller, Command Pattern, Handler, Middleware, Chain of Responsibility, Strategy Pattern, Proxy, Decorator, Mediator, Service Locator, DI, Double Dispatch, Dynamic Dispatch, Event-Driven, Message Broker, Content-Based Router, Routing Slip, API Gateway, GraphQL Resolver, Service Mesh, Serverless, AI Agent Routing, CQRS, DispatcherServlet, Express.js, Redux, gRPC, Envoy, Istio, LangChain, ReAct

---

# 1. Action Router & Delegation이란?

## 1.1 핵심 개념: 라우팅과 위임

```
┌─────────────────────────────────────────────────────────────────┐
│           Action Router & Delegation의 두 축                     │
│                                                                   │
│  [라우팅 (Routing)]                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  정의: "들어온 요청을 어디로 보낼지 결정하는 것"         │    │
│  │                                                          │    │
│  │  비유: 우체국 분류 시스템                                │    │
│  │  ┌──────┐    ┌──────────┐    ┌──────────┐              │    │
│  │  │ 편지  │───►│ 분류기   │───►│ 배달부 A │              │    │
│  │  │ (요청)│    │ (Router) │    │ 배달부 B │              │    │
│  │  └──────┘    └──────────┘    │ 배달부 C │              │    │
│  │                               └──────────┘              │    │
│  │                                                          │    │
│  │  핵심 질문: "이 요청은 누가 처리해야 하는가?"           │    │
│  │  결정 기준: URL, 메시지 타입, 헤더, 내용, 조건          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [위임 (Delegation)]                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  정의: "결정된 대상에게 실제 작업을 맡기는 것"           │    │
│  │                                                          │    │
│  │  비유: 사장과 직원                                      │    │
│  │  ┌──────┐    ┌──────────┐    ┌──────────┐              │    │
│  │  │ 사장  │───►│ 지시     │───►│ 직원     │              │    │
│  │  │(객체A)│    │(위임호출)│    │(객체B)   │              │    │
│  │  └──────┘    └──────────┘    └──────────┘              │    │
│  │                                                          │    │
│  │  핵심 질문: "어떻게 작업을 넘겨주는가?"                 │    │
│  │  방식: 직접 호출, 인터페이스, 이벤트, 메시지 큐         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Action Router = 라우팅 + 위임의 조합]                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │       요청                                               │    │
│  │        │                                                 │    │
│  │        ▼                                                 │    │
│  │  ┌──────────┐   라우팅    ┌──────────┐                  │    │
│  │  │  Router   │──────────►│ Handler A │  ← 위임          │    │
│  │  │          │            │ Handler B │  ← 위임          │    │
│  │  │ 라우팅   │            │ Handler C │  ← 위임          │    │
│  │  │ 테이블   │            └──────────┘                  │    │
│  │  └──────────┘                                           │    │
│  │                                                          │    │
│  │  라우팅 = "어디로" + 위임 = "누구에게"                  │    │
│  │  → 결합하면 = Action Router                              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Action Router**는 들어온 요청(Action)을 분석하여 적절한 처리자(Handler)에게 라우팅(경로 결정)하고 위임(실행 전달)하는 아키텍처 패턴이다. 웹 프레임워크의 `DispatcherServlet`, Express.js의 미들웨어 파이프라인, Redux의 `dispatch → reducer`, gRPC의 서비스 디스패처 모두 이 패턴의 변형이다.

## 1.2 왜 필요한가? (거대한 if-else의 문제)

```
┌─────────────────────────────────────────────────────────────────┐
│              Before vs After: 거대한 if-else의 해체              │
│                                                                   │
│  [Before: 거대한 if-else 체인]                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  public void handleRequest(String action, Request req) { │    │
│  │      if (action.equals("createUser")) {                  │    │
│  │          // 50줄의 사용자 생성 로직                      │    │
│  │      } else if (action.equals("updateUser")) {           │    │
│  │          // 40줄의 사용자 수정 로직                      │    │
│  │      } else if (action.equals("deleteUser")) {           │    │
│  │          // 30줄의 사용자 삭제 로직                      │    │
│  │      } else if (action.equals("createOrder")) {          │    │
│  │          // 60줄의 주문 생성 로직                        │    │
│  │      } else if (action.equals("payOrder")) {             │    │
│  │          // 70줄의 결제 처리 로직                        │    │
│  │      }                                                    │    │
│  │      // ... 100개 이상의 분기 ...                        │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  문제점:                                                  │    │
│  │  ├── OCP 위반: 새 액션 추가 시 기존 코드 수정 필수      │    │
│  │  ├── SRP 위반: 하나의 메서드가 모든 액션 처리           │    │
│  │  ├── 테스트 불가: 개별 액션을 독립적으로 테스트할 수 없음│    │
│  │  ├── 충돌 다발: 여러 개발자가 동일 파일 수정            │    │
│  │  └── 코드 탐색 불가: 3000줄짜리 God Class               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [After: Action Router + Handler]                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // 라우팅 테이블 (Map 기반)                             │    │
│  │  Map<String, ActionHandler> routes = Map.of(             │    │
│  │      "createUser",  new CreateUserHandler(),              │    │
│  │      "updateUser",  new UpdateUserHandler(),              │    │
│  │      "deleteUser",  new DeleteUserHandler(),              │    │
│  │      "createOrder", new CreateOrderHandler(),             │    │
│  │      "payOrder",    new PayOrderHandler()                 │    │
│  │  );                                                       │    │
│  │                                                          │    │
│  │  // 라우팅 + 위임                                        │    │
│  │  public void handleRequest(String action, Request req) { │    │
│  │      ActionHandler handler = routes.get(action);          │    │
│  │      if (handler == null) throw new UnknownAction(action);│    │
│  │      handler.execute(req);  // 위임!                      │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  장점:                                                    │    │
│  │  ├── OCP 준수: 새 Handler 클래스 추가만으로 확장         │    │
│  │  ├── SRP 준수: 각 Handler가 하나의 액션만 담당           │    │
│  │  ├── 테스트 용이: Handler별 독립 단위 테스트             │    │
│  │  ├── 충돌 방지: 개발자별 다른 Handler 파일 수정          │    │
│  │  └── 탐색 용이: Handler 이름 = 기능 이름                 │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  SOLID 원칙과의 관계:                                            │
│  ┌──────────┬───────────────────────────────────────────────┐   │
│  │ 원칙      │ Action Router가 해결하는 방식                 │   │
│  ├──────────┼───────────────────────────────────────────────┤   │
│  │ SRP       │ 각 Handler가 하나의 책임만 갖는다             │   │
│  │ OCP       │ 새 Handler 추가 시 기존 코드 수정 없음        │   │
│  │ LSP       │ Handler 인터페이스 구현체 교체 가능           │   │
│  │ ISP       │ Handler 인터페이스를 작게 분리                │   │
│  │ DIP       │ Router가 구체 클래스가 아닌 인터페이스에 의존 │   │
│  └──────────┴───────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어 사전 (Terminology Dictionary)

```
┌─────────────────────────────────────────────────────────────────┐
│              Action Router & Delegation 핵심 용어 사전            │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│  용어              │ 어원/풀네임         │ 설명                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Router            │ 네트워크 라우터에서  │ 경로를 결정하는 장치  │
│                    │ 차용. route = 길     │ 패킷의 목적지를 정하  │
│                    │                      │ 는 것처럼, 요청의     │
│                    │                      │ 처리자를 결정         │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Delegation        │ 라틴어 delegare      │ "보내다, 위탁하다"    │
│                    │ de(떨어져) +         │ GoF: "위임은 상속만큼 │
│                    │ legare(보내다)       │ 강력한 재사용 메커니  │
│                    │                      │ 즘이다"               │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Dispatcher        │ dispatch = 보내다    │ OS dispatcher가 CPU   │
│                    │ 라틴어 despachar     │ 제어권을 프로세스에   │
│                    │ (짐을 풀다→보내다)   │ 인도하듯, 요청을      │
│                    │                      │ 적절한 핸들러에 전달  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Front Controller  │ Fowler PoEAA 2002    │ "맨 앞에 위치한       │
│                    │ 건물의 정문 비유     │ 중앙 제어 지점"       │
│                    │                      │ 모든 요청이 단일      │
│                    │                      │ 진입점을 통과         │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Command           │ GoF 1994             │ 요청을 객체로         │
│                    │ 군사 용어에서 차용   │ 캡슐화. 실행 취소,    │
│                    │ "명령을 내리다"      │ 큐잉, 로깅 가능.      │
│                    │                      │ Struts ActionServlet,  │
│                    │                      │ Redux Action 모두 동일│
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Handler           │ handle = 처리하다    │ 요청을 실제로 처리    │
│                    │ 고대 영어 handlian   │ 하는 객체. Controller, │
│                    │ (손으로 다루다)      │ Action과 유사하나     │
│                    │                      │ 현대 추세는 Action을  │
│                    │                      │ 독립 Handler 클래스로 │
│                    │                      │ 분리 (ADR 패턴)       │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Middleware        │ 1968 NATO 회의       │ "두 레이어 사이에     │
│                    │ 최초 등장            │ 위치하는 소프트웨어"  │
│                    │ middle + ware        │ 요청/응답 파이프라인  │
│                    │ (중간에 있는 것)     │ 에서 횡단 관심사 처리 │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Chain of          │ GoF 1994             │ 요청을 처리할 수 있는 │
│  Responsibility    │ 관료제 비유          │ 객체들의 체인을 따라  │
│                    │ (결재 라인)          │ 전달. 처리자가 스스로 │
│                    │                      │ 처리 여부를 결정      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Strategy          │ GoF 1994, "전략"     │ 알고리즘을 캡슐화하여 │
│                    │ = "Policy"라고도     │ 교체 가능하게 만듦.   │
│                    │ 불림 (정책 교체)     │ 위임의 가장 순수한 형 │
│                    │                      │ 태. if-else를 다형성  │
│                    │                      │ 으로 대체             │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Proxy             │ 라틴어 procurator    │ 대리인. 원본 객체의   │
│                    │ (대리인)             │ 인터페이스를 유지하며 │
│                    │ pro(대신) +          │ 접근 제어, 캐싱, 로깅 │
│                    │ curare(돌보다)       │ 등 부가 기능 추가.    │
│                    │                      │ 위임의 특수 형태      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Decorator         │ 장식하다             │ 원본 객체를 감싸서    │
│                    │ GoF 1994             │ 기능을 동적으로 추가. │
│                    │                      │ Java I/O 스트림이     │
│                    │                      │ 대표적 사례           │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Mediator          │ 라틴어 mediare       │ 양방향 조정자.        │
│                    │ (중간에 있다)        │ Router=단방향 전달    │
│                    │                      │ Mediator=양방향 조정  │
│                    │                      │ MediatR(.NET), EventBus│
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Service Locator   │ Fowler 2004          │ 서비스를 레지스트리에 │
│                    │                      │ 서 조회. 현재는 안티  │
│                    │                      │ 패턴으로 간주됨.      │
│                    │                      │ DI가 대체함           │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  DI (Dependency    │ Fowler 2004 명명     │ IoC는 1988 Johnson &  │
│  Injection)        │ IoC의 구체화         │ Foote가 정의.         │
│                    │                      │ "Don't call us,       │
│                    │                      │  we'll call you"      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Double Dispatch   │ 수신자 + 인자 양쪽   │ 두 객체의 타입 모두를 │
│                    │ 타입 기반으로 메서드  │ 기반으로 실행 메서드  │
│                    │ 결정                 │ 를 결정. Visitor 패턴 │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Dynamic Dispatch  │ vtable 기반          │ 런타임에 실제 타입의  │
│                    │ 가상 메서드 테이블   │ 메서드를 호출.        │
│                    │                      │ Action Router의 라우  │
│                    │                      │ 팅 테이블과 개념적    │
│                    │                      │ 으로 동일             │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Dead Letter Queue │ 우편 시스템 유래     │ 배달 불가능한 편지를  │
│                    │ "죽은 편지 사무소"   │ 모아두는 곳.          │
│                    │                      │ 처리 실패 메시지 저장 │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Backpressure      │ 증기기관의 역압력    │ 소비자가 생산자에게   │
│                    │ (배관 내 역류 압력)  │ "천천히 보내라" 신호  │
│                    │                      │ Reactive Streams 핵심 │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Fan-out / Fan-in  │ 전자공학 게이트      │ Fan-out: 하나의 신호가│
│                    │ 출력/입력 개수       │ 여러 곳으로 분산      │
│                    │                      │ Fan-in: 여러 결과를   │
│                    │                      │ 하나로 수집           │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Smart Broker vs   │ RabbitMQ vs Kafka    │ Smart Broker: 브로커가│
│  Smart Consumer    │ 설계 철학 차이       │ 라우팅 결정 (exchange │
│                    │                      │ 타입, binding key)    │
│                    │                      │ Smart Consumer: 소비자│
│                    │                      │ 가 읽을 파티션 결정   │
│                    │                      │ 이 차이가 Action      │
│                    │                      │ Router 설계에 직접    │
│                    │                      │ 영향                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. 등장 배경과 역사

## 3.1 학술적 기원

```
┌─────────────────────────────────────────────────────────────────┐
│              학술적 기원: 메시지 패싱에서 위임으로                 │
│                                                                   │
│  [1972] Alan Kay - Smalltalk 메시지 패싱                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "OOP에서 핵심은 객체가 아니라 메시징이다."              │    │
│  │  - Alan Kay, 2003년 이메일                               │    │
│  │                                                          │    │
│  │  Smalltalk의 모든 것은 메시지:                           │    │
│  │  object message: argument                                │    │
│  │                                                          │    │
│  │  3 + 4  →  3에게 "+"라는 메시지를 4와 함께 보냄         │    │
│  │                                                          │    │
│  │  생물학적 세포 은유:                                     │    │
│  │  ┌──────┐  메시지  ┌──────┐  메시지  ┌──────┐          │    │
│  │  │세포 A │───────►│세포 B │───────►│세포 C │          │    │
│  │  └──────┘         └──────┘         └──────┘          │    │
│  │  각 세포는 내부 구현을 숨기고, 메시지로만 소통           │    │
│  │                                                          │    │
│  │  이것이 Action Router의 가장 원시적 형태:                │    │
│  │  "메시지를 받으면 → 적절한 메서드를 찾아 → 실행"        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [1986] Henry Lieberman - 위임 논문                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "Using Prototypical Objects to Implement                │    │
│  │   Shared Behavior in OO Systems" (OOPSLA 1986)          │    │
│  │                                                          │    │
│  │  핵심 기여:                                              │    │
│  │  ├── Prototype-based delegation 최초 체계화              │    │
│  │  ├── self 문제(위임 시 self 참조) 해결                   │    │
│  │  ├── 상속과 위임의 차이 명확히 구분                      │    │
│  │  └── "위임은 상속의 동적 대안"                           │    │
│  │                                                          │    │
│  │  상속 vs 위임:                                           │    │
│  │  ┌─────────────┐    ┌─────────────┐                    │    │
│  │  │   상속       │    │   위임       │                    │    │
│  │  ├─────────────┤    ├─────────────┤                    │    │
│  │  │ 컴파일 타임  │    │ 런타임      │                    │    │
│  │  │ 정적 바인딩  │    │ 동적 바인딩  │                    │    │
│  │  │ is-a 관계    │    │ has-a 관계   │                    │    │
│  │  │ White-box    │    │ Black-box    │                    │    │
│  │  └─────────────┘    └─────────────┘                    │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [1987] Self 언어 - Prototype-based Delegation                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Ungar & Smith (Stanford)                                │    │
│  │                                                          │    │
│  │  클래스 없이 프로토타입과 슬롯만으로 OOP 구현:           │    │
│  │  ┌──────────────┐   parent 슬롯   ┌──────────────┐    │    │
│  │  │ myPoint      │───────────────►│ point proto  │    │    │
│  │  │ x: 3         │                │ draw: {...}   │    │    │
│  │  │ y: 5         │                │ move: {...}   │    │    │
│  │  └──────────────┘                └──────────────┘    │    │
│  │                                                          │    │
│  │  myPoint.draw() → myPoint에 draw 없음                   │    │
│  │                  → parent 슬롯 따라 point proto에서 찾음 │    │
│  │                  → 위임! (self는 여전히 myPoint)         │    │
│  │                                                          │    │
│  │  Self의 JIT 컴파일러 → Java HotSpot VM으로 발전         │    │
│  │  Self의 프로토타입 → JavaScript 프로토타입 체인          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [1994] GoF Design Patterns                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "Favor object composition over class inheritance"       │    │
│  │  (객체 합성을 클래스 상속보다 선호하라)                  │    │
│  │  - GoF 책 3페이지에 걸친 논의                            │    │
│  │                                                          │    │
│  │  이유:                                                   │    │
│  │  ├── Fragile Base Class 문제                             │    │
│  │  ├── 다이아몬드 상속 문제                                │    │
│  │  ├── 화이트박스 재사용의 위험                            │    │
│  │  └── 런타임 교체 불가                                    │    │
│  │                                                          │    │
│  │  위임 관련 5대 패턴:                                     │    │
│  │  ├── Strategy    - 알고리즘 위임                         │    │
│  │  ├── Command     - 요청 객체화 + 위임                    │    │
│  │  ├── Chain of Responsibility - 체인 위임                 │    │
│  │  ├── Mediator    - 중재자 위임                           │    │
│  │  └── Proxy/Decorator - 투명 위임                         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [2003] Eugster et al. - 3가지 Decoupling                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "The Many Faces of Publish/Subscribe" (ACM Computing    │    │
│  │   Surveys, 2003)                                         │    │
│  │                                                          │    │
│  │  세 가지 디커플링 차원:                                  │    │
│  │  ┌────────────────┬──────────────────────────────┐      │    │
│  │  │ Space          │ 송신자가 수신자를 모름        │      │    │
│  │  │ (공간 분리)    │ → Router가 수신자 결정        │      │    │
│  │  ├────────────────┼──────────────────────────────┤      │    │
│  │  │ Time           │ 동시에 활성화 필요 없음       │      │    │
│  │  │ (시간 분리)    │ → Message Queue, Event Store  │      │    │
│  │  ├────────────────┼──────────────────────────────┤      │    │
│  │  │ Synchronization│ 비동기 전달 가능              │      │    │
│  │  │ (동기화 분리)  │ → Async Delegation            │      │    │
│  │  └────────────────┴──────────────────────────────┘      │    │
│  │                                                          │    │
│  │  Action Router는 이 세 차원 중 Space Decoupling을        │    │
│  │  달성하는 가장 기본적인 수단이다.                         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 학술적 배경: GoF에서 Clean Architecture까지

```
┌─────────────────────────────────────────────────────────────────┐
│              학술적 기반과 아키텍처 진화                           │
│                                                                   │
│  [GoF → SOLID → 아키텍처 패턴]                                   │
│                                                                   │
│  GoF (1994)                                                      │
│  ├── Strategy, Command, CoR, Mediator, Proxy/Decorator           │
│  ├── "위임은 상속만큼 강력한 재사용 메커니즘"                    │
│  └── 객체 수준의 라우팅과 위임 정립                              │
│       │                                                           │
│       ▼                                                           │
│  SOLID (Robert C. Martin, 2000s)                                 │
│  ├── SRP: Router는 라우팅만, Handler는 처리만                    │
│  ├── OCP: Handler 추가만으로 확장 (기존 코드 수정 없음)          │
│  ├── DIP: Router가 인터페이스에 의존, 구현체에 의존하지 않음     │
│  └── 위임의 이론적 정당성 완성                                    │
│       │                                                           │
│       ▼                                                           │
│  Fowler PoEAA (2002)                                             │
│  ├── Front Controller: 모든 요청의 단일 진입점                   │
│  │   → Spring DispatcherServlet의 직접적 근거                    │
│  ├── Application Controller: 화면 흐름 제어                      │
│  │   → 어떤 Command를 어떤 View에 연결할지 결정                  │
│  └── Page Controller: 페이지별 개별 Controller                    │
│       │                                                           │
│       ▼                                                           │
│  Hohpe & Woolf EIP (2003)                                        │
│  ├── Message Router: 메시지 내용 기반 라우팅                     │
│  ├── Content-Based Router: 페이로드 분석 후 라우팅               │
│  ├── Dynamic Router: 런타임에 라우팅 규칙 변경                   │
│  ├── Routing Slip: 메시지에 경로 목록 첨부                       │
│  └── Process Manager: 복잡한 라우팅 상태 관리                    │
│       │                                                           │
│       ▼                                                           │
│  Hexagonal Architecture (Alistair Cockburn, 2005)                │
│  ├── Ports & Adapters                                            │
│  ├── Adapter가 외부→내부 라우팅 책임                             │
│  ├── Port가 내부→외부 위임 책임                                  │
│  └── 어댑터 교체만으로 라우팅 방식 변경                          │
│       │                                                           │
│       ▼                                                           │
│  Clean Architecture (Robert C. Martin, 2012)                     │
│  ├── Use Case가 핵심 위임 단위                                   │
│  ├── Dependency Rule: 안쪽은 바깥을 모른다                       │
│  ├── Controller → Use Case → Entity 방향의 위임                  │
│  └── Interface Adapter 계층이 라우팅 담당                        │
│       │                                                           │
│       ▼                                                           │
│  Jay Kreps "The Log" (2013)                                      │
│  ├── Log-Table Duality: 로그가 곧 테이블, 테이블이 곧 로그      │
│  ├── Kafka의 이론적 기반                                         │
│  └── 이벤트 기반 라우팅의 수학적 정당성                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│        Action Router & Delegation 진화 타임라인 (1972-2023+)     │
│                                                                   │
│  1972 ──── Smalltalk 메시지 패싱 (Alan Kay)                      │
│    │        "모든 것은 메시지다" - 라우팅의 원형                  │
│    │                                                              │
│  1986 ──── Lieberman 위임 논문 (OOPSLA)                          │
│    │        Prototype-based delegation 최초 체계화                │
│    │                                                              │
│  1987 ──── Self 언어 (Ungar & Smith, Stanford)                   │
│    │        프로토타입 + 슬롯 + JIT → HotSpot, JavaScript        │
│    │                                                              │
│  1994 ──── GoF Design Patterns                                   │
│    │        Strategy, Command, CoR, Mediator, Proxy              │
│    │        "Favor composition over inheritance"                  │
│    │                                                              │
│  1996 ──── Java Servlet (Sun Microsystems)                       │
│    │        service() → doGet()/doPost() 위임                    │
│    │        URL 매핑 = 최초의 웹 라우팅                          │
│    │                                                              │
│  1997 ──── Pub/Sub 시스템 본격화                                 │
│    │        (기원: 1987 ACM SOSP)                                │
│    │                                                              │
│  1998 ──── ESB 개념 등장 (Candle Roma → 2002 Gartner 명명)       │
│    │                                                              │
│  2000 ──── Apache Struts 1.0                                     │
│    │        ActionServlet (Front Controller)                      │
│    │        → ActionMapping (라우팅)                              │
│    │        → Action (위임)                                      │
│    │        최초의 체계적 Action Router 프레임워크                │
│    │                                                              │
│  2002 ──── Fowler PoEAA                                          │
│    │        Front Controller, Application Controller 패턴 정립   │
│    │                                                              │
│  2003 ──── Spring Framework 0.9 / EIP 출간                       │
│    │        DispatcherServlet = Java 웹의 표준 Action Router      │
│    │        EIP = 메시징 라우팅 패턴 바이블                      │
│    │                                                              │
│  2004 ──── Ruby on Rails 1.0                                     │
│    │        routes.rb = Convention over Configuration             │
│    │        RESTful 라우팅의 대중화                               │
│    │        Fowler "Inversion of Control" → DI 명명              │
│    │                                                              │
│  2005 ──── Django (Python) / Hexagonal Architecture              │
│    │        urls.py regex 라우팅                                  │
│    │        Ports & Adapters 위임 모델                            │
│    │                                                              │
│  2007 ──── API Gateway 패턴 등장 (초기 형태)                     │
│    │        (Chris Richardson, BFF: Phil Calçado)                 │
│    │                                                              │
│  2010 ──── Express.js (Node.js)                                  │
│    │        app.get('/path', handler) = 함수형 라우팅             │
│    │        미들웨어 체인 = CoR 패턴의 현대적 구현               │
│    │                                                              │
│  2012 ──── Clean Architecture (Robert C. Martin)                 │
│    │        Use Case 위임, Dependency Rule                       │
│    │                                                              │
│  2013 ──── React (Meta)                                          │
│    │        단방향 데이터 흐름                                    │
│    │        Virtual DOM 이벤트 위임 (Event Delegation)            │
│    │                                                              │
│  2015 ──── Redux / GraphQL                                       │
│    │        dispatch(action) → reducer = Action Router 패턴      │
│    │        GraphQL Resolver = 필드별 위임 라우팅                 │
│    │                                                              │
│  2016 ──── gRPC 1.0 (Google)                                     │
│    │        proto 기반 서비스 라우팅                              │
│    │        HTTP/2 + Protobuf 위임                               │
│    │                                                              │
│  2018 ──── Spring WebFlux                                        │
│    │        RouterFunction = 함수형 라우팅                       │
│    │        Reactive 위임 체인                                    │
│    │                                                              │
│  2020 ──── Service Mesh 본격화 (Istio 1.5+)                      │
│    │        Envoy sidecar = 인프라 수준 라우팅                   │
│    │        애플리케이션 코드에서 라우팅 로직 제거               │
│    │                                                              │
│  2022 ──── ChatGPT / LLM 시대                                    │
│    │        AI Function Calling = 자연어 기반 라우팅              │
│    │                                                              │
│  2023+─── AI Agent Routing                                       │
│            ReAct, LangChain Agent, CrewAI                        │
│            LLM이 라우팅 결정을 자율적으로 수행                   │
│            "어떤 도구를 쓸지"를 AI가 스스로 위임                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Routing 패턴 상세 (8가지)

## 5.1 Front Controller (Spring DispatcherServlet, Struts)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 1: Front Controller                             │
│                                                                   │
│  정의: 모든 요청이 단일 진입점(Single Entry Point)을              │
│        통과하도록 강제하는 아키텍처 패턴                          │
│                                                                   │
│  기원: Fowler PoEAA (2002), "건물의 정문" 비유                   │
│                                                                   │
│  [Spring DispatcherServlet 전체 흐름]                             │
│                                                                   │
│  HTTP Request                                                     │
│       │                                                           │
│       ▼                                                           │
│  ┌──────────────────────────────────────────────┐                │
│  │            DispatcherServlet                   │                │
│  │           (Front Controller)                   │                │
│  │                                                │                │
│  │  1. HandlerMapping에 질의                     │                │
│  │     "이 URL을 처리할 Handler는?"               │                │
│  │     ┌───────────────────────────┐             │                │
│  │     │ RequestMappingHandlerMapping │             │                │
│  │     │ @GetMapping("/users/{id}")  │             │                │
│  │     │ → UserController.getUser() │             │                │
│  │     └───────────────────────────┘             │                │
│  │                    │                           │                │
│  │                    ▼                           │                │
│  │  2. HandlerAdapter 통해 실행                  │                │
│  │     ┌───────────────────────────┐             │                │
│  │     │ RequestMappingHandlerAdapter│             │                │
│  │     │ - 파라미터 바인딩           │             │                │
│  │     │ - @RequestBody 역직렬화     │             │                │
│  │     │ - @Valid 검증               │             │                │
│  │     └───────────────────────────┘             │                │
│  │                    │                           │                │
│  │                    ▼                           │                │
│  │  3. Controller 메서드 실행 (위임)             │                │
│  │     ┌───────────────────────────┐             │                │
│  │     │ UserController.getUser()   │             │                │
│  │     │ → UserService 호출 (위임)  │             │                │
│  │     │ → ResponseEntity 반환      │             │                │
│  │     └───────────────────────────┘             │                │
│  │                    │                           │                │
│  │                    ▼                           │                │
│  │  4. ViewResolver / MessageConverter            │                │
│  │     ┌───────────────────────────┐             │                │
│  │     │ MappingJackson2HttpMessage │             │                │
│  │     │ Converter                   │             │                │
│  │     │ → JSON 직렬화               │             │                │
│  │     └───────────────────────────┘             │                │
│  │                    │                           │                │
│  └──────────────────────────────────────────────┘                │
│                    │                                               │
│                    ▼                                               │
│              HTTP Response                                        │
│                                                                   │
│  장점:                                                            │
│  ├── 인증, 로깅, 예외 처리 등 공통 로직을 한 곳에서 관리        │
│  ├── URL → Handler 매핑을 중앙에서 일관 관리                     │
│  └── 새 Controller 추가 시 기존 코드 수정 불필요 (OCP)           │
│                                                                   │
│  단점:                                                            │
│  ├── 단일 실패점(SPOF) 가능성                                    │
│  ├── DispatcherServlet이 병목이 될 수 있음                       │
│  └── 프레임워크에 대한 높은 결합도                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Spring MVC 코드 예시:**

```java
// HandlerMapping이 URL을 Controller에 라우팅
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    // DI를 통한 위임 대상 주입
    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        // 실제 비즈니스 로직은 Service에 위임
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserDto> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(userService.create(request));
    }
}
```

## 5.2 URL-based Routing (Convention / Config / Annotation)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 2: URL-based Routing                            │
│                                                                   │
│  URL 패턴으로 요청을 적절한 Handler에 매핑하는 가장 보편적       │
│  라우팅 방식. 3가지 변형이 존재한다.                              │
│                                                                   │
│  [A. Convention-based] (Rails, Django)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  URL 구조가 곧 라우팅 규칙:                              │    │
│  │                                                          │    │
│  │  GET  /users       → UsersController#index               │    │
│  │  GET  /users/1     → UsersController#show                │    │
│  │  POST /users       → UsersController#create              │    │
│  │  PUT  /users/1     → UsersController#update              │    │
│  │  DELETE /users/1   → UsersController#destroy             │    │
│  │                                                          │    │
│  │  Rails routes.rb:                                        │    │
│  │  resources :users  ← 이 한 줄로 7개 라우트 자동 생성    │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [B. Configuration-based] (Struts XML, Django urls.py)           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  <!-- Struts 1.x struts-config.xml -->                   │    │
│  │  <action path="/login"                                   │    │
│  │          type="com.app.LoginAction"                      │    │
│  │          name="loginForm"                                │    │
│  │          scope="request"                                 │    │
│  │          validate="true"                                 │    │
│  │          input="/login.jsp">                             │    │
│  │      <forward name="success" path="/home.jsp"/>          │    │
│  │  </action>                                               │    │
│  │                                                          │    │
│  │  # Django urls.py                                        │    │
│  │  urlpatterns = [                                         │    │
│  │      path('users/', UserListView.as_view()),             │    │
│  │      path('users/<int:pk>/', UserDetailView.as_view()),  │    │
│  │  ]                                                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [C. Annotation-based] (Spring, JAX-RS)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  @GetMapping("/users/{id}")                              │    │
│  │  public User getUser(@PathVariable Long id) {...}        │    │
│  │                                                          │    │
│  │  @Path("/users/{id}")                                    │    │
│  │  @GET                                                    │    │
│  │  public User getUser(@PathParam("id") Long id) {...}     │    │
│  │                                                          │    │
│  │  라우팅 규칙이 코드에 직접 선언 → 높은 가독성           │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  비교:                                                            │
│  ┌──────────────┬──────────┬──────────┬──────────┐              │
│  │              │Convention│Config    │Annotation│              │
│  ├──────────────┼──────────┼──────────┼──────────┤              │
│  │ 설정량       │ 최소     │ 많음     │ 중간     │              │
│  │ 유연성       │ 낮음     │ 높음     │ 높음     │              │
│  │ 가독성       │ 높음     │ 낮음     │ 매우 높음│              │
│  │ 대표 예      │ Rails    │ Struts1  │ Spring   │              │
│  └──────────────┴──────────┴──────────┴──────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 Content-Based Router (EIP, Apache Camel)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 3: Content-Based Router                         │
│                                                                   │
│  정의: 메시지의 내용(payload, header)을 분석하여                  │
│        라우팅 대상을 동적으로 결정                                │
│                                                                   │
│  기원: Hohpe & Woolf EIP (2003)                                  │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Message                                                          │
│    │                                                              │
│    ▼                                                              │
│  ┌──────────────────┐                                            │
│  │ Content-Based    │                                            │
│  │ Router           │                                            │
│  │                  │                                            │
│  │ 메시지 분석:     │                                            │
│  │ type? priority?  │                                            │
│  │ region? format?  │                                            │
│  └───┬──────┬───────┘                                            │
│      │      │      │                                              │
│      ▼      ▼      ▼                                              │
│  ┌──────┐┌──────┐┌──────┐                                       │
│  │채널 A ││채널 B ││채널 C │                                       │
│  │(주문) ││(결제) ││(배송) │                                       │
│  └──────┘└──────┘└──────┘                                       │
│                                                                   │
│  RabbitMQ Exchange 타입과의 매핑:                                │
│  ┌──────────────┬────────────────────────────────┐              │
│  │ Exchange     │ 라우팅 방식                     │              │
│  ├──────────────┼────────────────────────────────┤              │
│  │ Direct       │ routing key 정확 일치           │              │
│  │ Topic        │ routing key 패턴 매칭 (*/#)     │              │
│  │ Fanout       │ 모든 큐에 브로드캐스트          │              │
│  │ Headers      │ 메시지 헤더 속성 기반           │              │
│  └──────────────┴────────────────────────────────┘              │
│                                                                   │
│  Apache Camel 코드:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  from("jms:queue:incoming")                              │    │
│  │    .choice()                                             │    │
│  │      .when(header("type").isEqualTo("ORDER"))            │    │
│  │        .to("jms:queue:orders")                           │    │
│  │      .when(header("type").isEqualTo("PAYMENT"))          │    │
│  │        .to("jms:queue:payments")                         │    │
│  │      .otherwise()                                        │    │
│  │        .to("jms:queue:deadletter");                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 메시지 내용 기반의 유연한 라우팅                          │
│  단점: 라우팅 규칙이 복잡해지면 유지보수 어려움                  │
│        메시지 파싱 오버헤드                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 Dynamic Router

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 4: Dynamic Router                               │
│                                                                   │
│  정의: 라우팅 규칙을 런타임에 변경할 수 있는 라우터              │
│        외부 설정, DB, 컨트롤 채널을 통해 규칙 업데이트           │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  ┌──────────────┐    규칙 업데이트    ┌───────────────┐         │
│  │ Control      │───────────────────►│ Dynamic       │         │
│  │ Channel      │                    │ Router        │         │
│  │ (설정 DB,    │                    │               │         │
│  │  Admin API)  │                    │ ┌───────────┐ │         │
│  └──────────────┘                    │ │Rules Table│ │         │
│                                      │ │           │ │         │
│  Message ──────────────────────────►│ │A → Ch1    │ │         │
│                                      │ │B → Ch2    │ │         │
│                                      │ │C → Ch3    │ │         │
│                                      │ └───────────┘ │         │
│                                      └──┬───┬───┬───┘         │
│                                         │   │   │              │
│                                         ▼   ▼   ▼              │
│                                       Ch1  Ch2  Ch3            │
│                                                                   │
│  사용 사례:                                                      │
│  ├── A/B 테스트 트래픽 분배                                      │
│  ├── 카나리 배포 (10% → 50% → 100%)                             │
│  ├── Feature Flag 기반 라우팅                                    │
│  └── 지역 기반 라우팅 (한국→서울 DC, 미국→버지니아 DC)          │
│                                                                   │
│  장점: 재배포 없이 라우팅 변경, A/B 테스트 용이                  │
│  단점: 규칙 관리 복잡도, 규칙 충돌 가능성                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.5 Routing Slip

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 5: Routing Slip                                 │
│                                                                   │
│  정의: 메시지에 경유할 처리 단계 목록을 첨부.                    │
│        각 단계를 거칠 때마다 목록에서 다음 대상을 읽어 이동      │
│                                                                   │
│  비유: 우체국 등기 우편의 배달 순서표                            │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Message + Slip[A, B, C]                                         │
│       │                                                           │
│       ▼                                                           │
│  ┌──────────┐    Slip: [B, C]    ┌──────────┐                   │
│  │ Step A   │───────────────────►│ Step B   │                   │
│  │ (검증)   │                    │ (변환)   │                   │
│  └──────────┘                    └────┬─────┘                   │
│                                       │                          │
│                              Slip: [C]│                          │
│                                       ▼                          │
│                                  ┌──────────┐                   │
│                                  │ Step C   │                   │
│                                  │ (저장)   │                   │
│                                  └──────────┘                   │
│                                                                   │
│  Content-Based Router와의 차이:                                  │
│  ├── CBR: 라우터가 매 단계마다 결정                              │
│  └── Routing Slip: 경로가 미리 결정되어 메시지에 첨부            │
│                                                                   │
│  사용 사례:                                                      │
│  ├── 주문 처리 파이프라인 (검증→결제→배송→알림)                 │
│  ├── ETL 파이프라인 (추출→변환→적재)                            │
│  └── 문서 승인 워크플로우 (팀장→부장→임원)                      │
│                                                                   │
│  Apache Camel 코드:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  from("direct:start")                                    │    │
│  │    .routingSlip(header("routingSlip"))                    │    │
│  │    .delimiter(",");                                      │    │
│  │                                                          │    │
│  │  // 메시지 헤더에:                                       │    │
│  │  // routingSlip = "direct:validate,direct:enrich,        │    │
│  │  //                direct:transform,direct:store"        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.6 API Gateway / Reverse Proxy

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 6: API Gateway / Reverse Proxy                 │
│                                                                   │
│  정의: 마이크로서비스 아키텍처에서 Front Controller 패턴을       │
│        분산 시스템 수준으로 확장한 것                             │
│                                                                   │
│  Front Controller(단일 앱) → API Gateway(분산 시스템)            │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Client Apps                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐                                    │
│  │ Web  │ │Mobile│ │ IoT  │                                    │
│  └──┬───┘ └──┬───┘ └──┬───┘                                    │
│     │        │        │                                          │
│     └────────┼────────┘                                          │
│              │                                                    │
│              ▼                                                    │
│  ┌──────────────────────────────────────────────┐                │
│  │              API Gateway                       │                │
│  │                                                │                │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │                │
│  │  │Rate Limit│ │Auth      │ │Logging   │     │                │
│  │  └──────────┘ └──────────┘ └──────────┘     │                │
│  │                                                │                │
│  │  ┌──────────────────────────────────────┐    │                │
│  │  │          Routing Rules                │    │                │
│  │  │  /api/users/**   → User Service      │    │                │
│  │  │  /api/orders/**  → Order Service     │    │                │
│  │  │  /api/payments/**→ Payment Service   │    │                │
│  │  └──────────────────────────────────────┘    │                │
│  │                                                │                │
│  └──────────┬──────────┬──────────┬──────────────┘                │
│             │          │          │                                │
│             ▼          ▼          ▼                                │
│  ┌──────────┐┌──────────┐┌──────────────┐                        │
│  │User Svc  ││Order Svc ││Payment Svc   │                        │
│  └──────────┘└──────────┘└──────────────┘                        │
│                                                                   │
│  주요 솔루션 비교:                                                │
│  ┌────────────┬──────────────────────────────────┐              │
│  │ 솔루션      │ 특징                              │              │
│  ├────────────┼──────────────────────────────────┤              │
│  │ Kong       │ Lua 플러그인, Nginx 기반           │              │
│  │ NGINX      │ 고성능 리버스 프록시               │              │
│  │ Envoy      │ L7 프록시, xDS API, gRPC 네이티브  │              │
│  │ Spring     │ Java 생태계, Predicate/Filter     │              │
│  │ Cloud GW   │ WebFlux 기반                       │              │
│  │ AWS ALB    │ 매니지드, 규칙 기반 라우팅         │              │
│  │ Traefik    │ 자동 서비스 디스커버리             │              │
│  └────────────┴──────────────────────────────────┘              │
│                                                                   │
│  BFF 패턴 (Backend for Frontend):                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ┌──────┐    ┌──────────┐    ┌──────────────┐           │   │
│  │  │ Web  │───►│ Web BFF  │───►│              │           │   │
│  │  └──────┘    └──────────┘    │ Microservices│           │   │
│  │  ┌──────┐    ┌──────────┐    │              │           │   │
│  │  │Mobile│───►│Mobile BFF│───►│              │           │   │
│  │  └──────┘    └──────────┘    └──────────────┘           │   │
│  │                                                           │   │
│  │  각 클라이언트 유형에 최적화된 별도 Gateway               │   │
│  │  Phil Calçado 제안 (SoundCloud)                           │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.7 GraphQL Resolver Routing

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 7: GraphQL Resolver Routing                    │
│                                                                   │
│  정의: 쿼리의 각 필드(field)를 개별 Resolver 함수에 매핑.        │
│        클라이언트가 요청 구조를 결정하는 "클라이언트 주도 라우팅"│
│                                                                   │
│  기원: Meta 내부 (2012) → 오픈소스 (2015)                        │
│                                                                   │
│  [Resolver 체인 아키텍처]                                        │
│                                                                   │
│  query {                                                          │
│    user(id: 1) {        ← UserResolver.user()                    │
│      name              ← 기본 필드 (자동 매핑)                   │
│      posts {           ← PostResolver.posts(parent: User)        │
│        title           ← 기본 필드                               │
│        comments {      ← CommentResolver.comments(parent: Post)  │
│          text          ← 기본 필드                               │
│        }                                                          │
│      }                                                            │
│    }                                                              │
│  }                                                                │
│                                                                   │
│  [N+1 문제와 DataLoader]                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  N+1 문제:                                               │    │
│  │  1 query: SELECT * FROM users WHERE id = 1               │    │
│  │  N queries: SELECT * FROM posts WHERE user_id = 1        │    │
│  │             SELECT * FROM posts WHERE user_id = 2        │    │
│  │             ... (사용자 수만큼 반복)                      │    │
│  │                                                          │    │
│  │  DataLoader 해결:                                        │    │
│  │  1. 개별 요청을 배치로 모음 (batching)                   │    │
│  │  2. SELECT * FROM posts WHERE user_id IN (1,2,3,...)     │    │
│  │  3. 결과를 요청별로 분배                                 │    │
│  │                                                          │    │
│  │  Before: O(N) 쿼리 → After: O(1) 쿼리                   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 클라이언트 주도 유연한 데이터 요청, Over-fetching 제거    │
│  단점: N+1 문제, 캐싱 복잡, 파일 업로드 어려움                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.8 Event Router / Event Bus

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 8: Event Router / Event Bus                    │
│                                                                   │
│  정의: 이벤트를 발행하면 라우터가 구독자에게 전달.               │
│        발행자와 구독자 간 완전한 Space Decoupling                │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Publisher A ───┐                                                 │
│                 │    ┌──────────────┐    ┌─── Subscriber X       │
│  Publisher B ───┼───►│  Event Bus   │────┼─── Subscriber Y       │
│                 │    │  / Router    │    └─── Subscriber Z       │
│  Publisher C ───┘    └──────────────┘                             │
│                                                                   │
│  이벤트 라우팅 방식 비교:                                        │
│  ┌──────────────┬────────────────────────────────────────┐      │
│  │ 방식          │ 설명                                    │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ Topic-based  │ 토픽 이름으로 라우팅                     │      │
│  │              │ "order.created" → 주문 관련 구독자       │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ Content-based│ 이벤트 내용 분석 후 라우팅               │      │
│  │              │ amount > 10000 → VIP 처리 구독자         │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ Type-based   │ 이벤트 클래스 타입으로 라우팅            │      │
│  │              │ OrderCreatedEvent → OrderEventHandler   │      │
│  └──────────────┴────────────────────────────────────────┘      │
│                                                                   │
│  Spring ApplicationEvent 코드:                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // 이벤트 발행                                          │    │
│  │  applicationEventPublisher.publishEvent(                 │    │
│  │      new OrderCreatedEvent(order));                      │    │
│  │                                                          │    │
│  │  // 이벤트 구독 (타입 기반 자동 라우팅)                  │    │
│  │  @EventListener                                          │    │
│  │  public void onOrderCreated(OrderCreatedEvent event) {   │    │
│  │      notificationService.sendConfirmation(event);        │    │
│  │  }                                                       │    │
│  │                                                          │    │
│  │  @Async @EventListener                                   │    │
│  │  public void onOrderCreatedAsync(OrderCreatedEvent e) {  │    │
│  │      analyticsService.trackOrder(e);                     │    │
│  │  }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 완전한 디커플링, 확장 용이 (새 구독자 추가만)             │
│  단점: 디버깅 어려움, 이벤트 순서 보장 어려움, 복잡성            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. Delegation 패턴 상세 (8가지)

## 6.1 Strategy Pattern (알고리즘 교체)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 1: Strategy Pattern                             │
│                                                                   │
│  정의: 알고리즘 군을 인터페이스 뒤에 캡슐화하고,                 │
│        런타임에 교체 가능하게 만드는 패턴                         │
│  GoF 별칭: "Policy"                                              │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  ┌──────────────┐    uses    ┌──────────────────┐               │
│  │   Context     │──────────►│ <<interface>>      │               │
│  │              │            │ Strategy           │               │
│  │ - strategy   │            │ + execute(data)    │               │
│  │ + doWork()   │            └────────┬───────────┘               │
│  └──────────────┘                     │                           │
│                              ┌────────┼────────┐                 │
│                              │        │        │                 │
│                         ┌────▼──┐┌────▼──┐┌────▼──┐             │
│                         │Strat A││Strat B││Strat C│             │
│                         │(JSON) ││(XML)  ││(CSV)  │             │
│                         └───────┘└───────┘└───────┘             │
│                                                                   │
│  if-else를 Strategy로 바꾸는 과정:                               │
│                                                                   │
│  [Before]                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  if (type.equals("standard")) {                          │    │
│  │      price = price * 0.9;  // 10% 할인                   │    │
│  │  } else if (type.equals("premium")) {                    │    │
│  │      price = price * 0.8;  // 20% 할인                   │    │
│  │  } else if (type.equals("vip")) {                        │    │
│  │      price = price * 0.7;  // 30% 할인                   │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [After]                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // Strategy 인터페이스                                   │    │
│  │  public interface DiscountStrategy {                      │    │
│  │      BigDecimal apply(BigDecimal price);                  │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 구현체들                                              │    │
│  │  public class StandardDiscount implements DiscountStrategy│    │
│  │  {                                                        │    │
│  │      public BigDecimal apply(BigDecimal price) {          │    │
│  │          return price.multiply(new BigDecimal("0.9"));    │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // Spring Map DI 패턴 (가장 권장)                        │    │
│  │  @Service                                                 │    │
│  │  public class DiscountService {                           │    │
│  │      private final Map<String, DiscountStrategy> map;     │    │
│  │                                                          │    │
│  │      // Spring이 모든 DiscountStrategy 빈을 자동 수집    │    │
│  │      public DiscountService(                              │    │
│  │              Map<String, DiscountStrategy> strategies) {   │    │
│  │          this.map = strategies;                            │    │
│  │      }                                                    │    │
│  │                                                          │    │
│  │      public BigDecimal calculate(String type, BigDecimal p│    │
│  │      ) {                                                  │    │
│  │          return map.get(type).apply(p);  // 위임!         │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Kotlin sealed class 변형:                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  sealed class DiscountStrategy {                         │    │
│  │      abstract fun apply(price: BigDecimal): BigDecimal    │    │
│  │                                                          │    │
│  │      object Standard : DiscountStrategy() {               │    │
│  │          override fun apply(price: BigDecimal) =          │    │
│  │              price * "0.9".toBigDecimal()                 │    │
│  │      }                                                    │    │
│  │      object Premium : DiscountStrategy() {                │    │
│  │          override fun apply(price: BigDecimal) =          │    │
│  │              price * "0.8".toBigDecimal()                 │    │
│  │      }                                                    │    │
│  │      object Vip : DiscountStrategy() {                    │    │
│  │          override fun apply(price: BigDecimal) =          │    │
│  │              price * "0.7".toBigDecimal()                 │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // when 절에서 컴파일러가 모든 분기 체크 (exhaustive)    │    │
│  │  fun describe(s: DiscountStrategy) = when(s) {            │    │
│  │      is DiscountStrategy.Standard -> "일반"               │    │
│  │      is DiscountStrategy.Premium  -> "프리미엄"           │    │
│  │      is DiscountStrategy.Vip      -> "VIP"                │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: OCP 완벽 준수, 테스트 용이, 런타임 교체                   │
│  단점: 클래스 수 증가, 2-3개 분기면 과도한 추상화                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Command Pattern (요청 객체화, CQRS)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 2: Command Pattern                              │
│                                                                   │
│  정의: 요청 자체를 객체로 캡슐화하여 큐잉, 로깅,                 │
│        실행 취소(Undo)를 가능하게 하는 패턴                       │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  ┌────────┐    ┌──────────────────┐    ┌──────────────┐         │
│  │Invoker │───►│ <<interface>>     │───►│  Receiver    │         │
│  │        │    │ Command           │    │  (실제 수행자)│         │
│  │ 실행   │    │ + execute()       │    └──────────────┘         │
│  │ 취소   │    │ + undo()          │                              │
│  │ 큐잉   │    └────────┬─────────┘                              │
│  └────────┘             │                                        │
│                ┌────────┼────────┐                                │
│                │        │        │                                │
│           ┌────▼──┐┌────▼──┐┌────▼──┐                           │
│           │Create ││Update ││Delete │                           │
│           │Order  ││Order  ││Order  │                           │
│           │Cmd    ││Cmd    ││Cmd    │                           │
│           └───────┘└───────┘└───────┘                           │
│                                                                   │
│  CQRS + Command 구현:                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // Command 객체                                         │    │
│  │  @Value                                                   │    │
│  │  public class CreateOrderCommand {                        │    │
│  │      String customerId;                                   │    │
│  │      List<OrderItem> items;                               │    │
│  │      String shippingAddress;                              │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // Command Handler (위임 대상)                           │    │
│  │  @Service                                                 │    │
│  │  public class OrderCommandHandler {                       │    │
│  │                                                          │    │
│  │      @Transactional                                       │    │
│  │      public OrderId handle(CreateOrderCommand cmd) {      │    │
│  │          Order order = Order.create(                       │    │
│  │              cmd.getCustomerId(),                          │    │
│  │              cmd.getItems()                                │    │
│  │          );                                               │    │
│  │          orderRepository.save(order);                     │    │
│  │          eventPublisher.publish(                           │    │
│  │              new OrderCreatedEvent(order.getId()));        │    │
│  │          return order.getId();                             │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // Query Handler (읽기 전용 위임)                        │    │
│  │  @Service                                                 │    │
│  │  public class OrderQueryHandler {                         │    │
│  │                                                          │    │
│  │      @Transactional(readOnly = true)                      │    │
│  │      public OrderDto handle(GetOrderQuery query) {        │    │
│  │          return orderReadRepository                       │    │
│  │              .findById(query.getOrderId())                │    │
│  │              .map(OrderDto::from)                          │    │
│  │              .orElseThrow();                               │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 실행 취소, 재실행, 큐잉, 감사 로그, CQRS 자연스러운 구현 │
│  단점: 클래스 폭발, 단순 CRUD에는 과도한 복잡성                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 Chain of Responsibility (필터 체인, 미들웨어)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 3: Chain of Responsibility                      │
│                                                                   │
│  정의: 요청을 처리할 수 있는 객체들의 체인을 구성하고,            │
│        체인을 따라 요청을 전달. 각 객체가 처리 여부를 결정       │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Request                                                          │
│    │                                                              │
│    ▼                                                              │
│  ┌──────────┐  next  ┌──────────┐  next  ┌──────────┐           │
│  │Handler A │──────►│Handler B │──────►│Handler C │           │
│  │(인증)    │        │(권한)    │        │(로깅)    │           │
│  │          │        │          │        │          │           │
│  │ 처리?    │        │ 처리?    │        │ 처리?    │           │
│  │ Yes→반환 │        │ Yes→반환 │        │ Yes→반환 │           │
│  │ No→다음  │        │ No→다음  │        │ No→끝    │           │
│  └──────────┘        └──────────┘        └──────────┘           │
│                                                                   │
│  Spring Security FilterChain 구현:                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @Component                                               │    │
│  │  public class JwtAuthenticationFilter                     │    │
│  │          extends OncePerRequestFilter {                   │    │
│  │                                                          │    │
│  │      @Override                                            │    │
│  │      protected void doFilterInternal(                     │    │
│  │              HttpServletRequest request,                   │    │
│  │              HttpServletResponse response,                │    │
│  │              FilterChain filterChain)                     │    │
│  │              throws ServletException, IOException {       │    │
│  │                                                          │    │
│  │          String token = extractToken(request);            │    │
│  │                                                          │    │
│  │          if (token != null && jwtProvider.validate(token))│    │
│  │          {                                                │    │
│  │              Authentication auth =                        │    │
│  │                  jwtProvider.getAuthentication(token);     │    │
│  │              SecurityContextHolder.getContext()            │    │
│  │                  .setAuthentication(auth);                 │    │
│  │          }                                                │    │
│  │                                                          │    │
│  │          // 다음 필터로 위임!                              │    │
│  │          filterChain.doFilter(request, response);         │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Spring Security 필터 체인 실행 순서:                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SecurityContextPersistenceFilter                        │    │
│  │    → HeaderWriterFilter                                  │    │
│  │      → CorsFilter                                        │    │
│  │        → CsrfFilter                                      │    │
│  │          → LogoutFilter                                   │    │
│  │            → JwtAuthenticationFilter (커스텀)             │    │
│  │              → RequestCacheAwareFilter                    │    │
│  │                → SecurityContextHolderAwareRequestFilter  │    │
│  │                  → SessionManagementFilter                │    │
│  │                    → ExceptionTranslationFilter           │    │
│  │                      → FilterSecurityInterceptor          │    │
│  │                        → Controller (최종 도달)           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 처리자 간 느슨한 결합, 동적 체인 구성, 횡단 관심사 분리  │
│  단점: 디버깅 어려움, 처리 보장 없음, 성능 (긴 체인)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.4 Proxy Pattern (JDK Dynamic Proxy, CGLIB, Spring AOP)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 4: Proxy Pattern                                │
│                                                                   │
│  정의: 원본 객체와 동일한 인터페이스를 제공하면서                 │
│        접근 제어, 캐싱, 로깅 등 부가 기능을 투명하게 추가        │
│                                                                   │
│  "위임의 특수 형태" - 클라이언트는 Proxy인지 모름                │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  Client                                                           │
│    │                                                              │
│    │  동일한 인터페이스                                           │
│    ▼                                                              │
│  ┌──────────────────┐                                            │
│  │ <<interface>>      │                                            │
│  │ UserService        │                                            │
│  │ + findById(id)    │                                            │
│  └────────┬───────────┘                                            │
│           │                                                       │
│    ┌──────┴──────┐                                                │
│    │              │                                                │
│  ┌─▼────────┐  ┌─▼──────────────┐                                │
│  │ Real     │  │ Proxy           │                                │
│  │ UserSvc  │  │ (Cached)UserSvc │                                │
│  │          │◄─┤ - cache         │                                │
│  │          │  │ - real (위임)   │                                │
│  └──────────┘  └─────────────────┘                                │
│                                                                   │
│  JDK Dynamic Proxy vs CGLIB:                                     │
│  ┌──────────────┬─────────────────┬───────────────────┐         │
│  │              │ JDK Proxy       │ CGLIB             │         │
│  ├──────────────┼─────────────────┼───────────────────┤         │
│  │ 요구 사항    │ 인터페이스 필수  │ 인터페이스 불필요  │         │
│  │ 방식         │ 리플렉션        │ 바이트코드 생성    │         │
│  │ 성능         │ 약간 느림       │ 더 빠름           │         │
│  │ final 클래스 │ 가능            │ 불가              │         │
│  │ Spring 기본  │ 인터페이스 있을때│ 인터페이스 없을때  │         │
│  └──────────────┴─────────────────┴───────────────────┘         │
│                                                                   │
│  Decorator 위임 코드:                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @Service("cachedUserService")                            │    │
│  │  @Primary                                                 │    │
│  │  public class CachedUserService implements UserService {  │    │
│  │                                                          │    │
│  │      private final UserService delegate;  // 위임 대상   │    │
│  │      private final CacheManager cache;                    │    │
│  │                                                          │    │
│  │      public CachedUserService(                            │    │
│  │              @Qualifier("realUserService")                 │    │
│  │              UserService delegate,                        │    │
│  │              CacheManager cache) {                        │    │
│  │          this.delegate = delegate;                        │    │
│  │          this.cache = cache;                              │    │
│  │      }                                                    │    │
│  │                                                          │    │
│  │      @Override                                            │    │
│  │      public UserDto findById(Long id) {                   │    │
│  │          return cache.get("user:" + id,                   │    │
│  │              () -> delegate.findById(id));  // 위임!      │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Spring AOP (Aspect-Oriented Proxy):                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @Aspect                                                  │    │
│  │  @Component                                               │    │
│  │  public class AuditAspect {                               │    │
│  │                                                          │    │
│  │      @Around("@annotation(Audited)")                      │    │
│  │      public Object audit(ProceedingJoinPoint pjp)         │    │
│  │              throws Throwable {                            │    │
│  │          String method = pjp.getSignature().getName();     │    │
│  │          log.info("START: {}", method);                    │    │
│  │          long start = System.nanoTime();                   │    │
│  │                                                          │    │
│  │          Object result = pjp.proceed();  // 원본에 위임!  │    │
│  │                                                          │    │
│  │          long elapsed = System.nanoTime() - start;        │    │
│  │          log.info("END: {} ({}ms)", method,               │    │
│  │              elapsed / 1_000_000);                         │    │
│  │          return result;                                   │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 투명한 부가 기능 추가, 원본 코드 수정 없음                │
│  단점: 디버깅 복잡 (프록시 스택), self-invocation 문제           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.5 Decorator Pattern (기능 래핑, Java I/O)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 5: Decorator Pattern                            │
│                                                                   │
│  정의: 객체를 감싸서(wrap) 기능을 동적으로 추가.                  │
│        동일 인터페이스를 유지하며 재귀적 합성 가능               │
│                                                                   │
│  Proxy와의 차이: Proxy=접근제어, Decorator=기능추가              │
│                                                                   │
│  [Java I/O 스트림 - Decorator의 교과서적 사례]                   │
│                                                                   │
│  new BufferedReader(                     ← Decorator 3: 버퍼링   │
│    new InputStreamReader(                ← Decorator 2: 인코딩   │
│      new FileInputStream("data.txt")    ← 원본 Component        │
│    )                                                              │
│  )                                                                │
│                                                                   │
│  호출 흐름:                                                       │
│  ┌──────────────┐   위임   ┌──────────────┐   위임              │
│  │BufferedReader │───────►│InputStreamRdr│───────►              │
│  │(버퍼 추가)   │         │(인코딩 변환) │     ┌──────────────┐ │
│  └──────────────┘         └──────────────┘     │FileInputStream│ │
│                                                 │(파일 읽기)    │ │
│                                                 └──────────────┘ │
│                                                                   │
│  각 Decorator는:                                                  │
│  ├── 동일한 인터페이스(InputStream/Reader) 구현                  │
│  ├── 내부에 감싼 객체(component)에 위임                          │
│  ├── 위임 전후에 자신의 기능 추가                                │
│  └── 재귀적으로 중첩 가능                                        │
│                                                                   │
│  장점: 상속 없이 기능 추가, 조합 자유도 높음                     │
│  단점: 작은 객체가 많이 생성됨, 디버깅 시 래핑 추적 필요        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.6 Mediator Pattern (MediatR, EventBus)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 6: Mediator Pattern                             │
│                                                                   │
│  정의: 객체들 간의 직접 참조를 제거하고 중재자를 통해 소통       │
│        "양방향 조정" (Router는 "단방향 전달")                    │
│                                                                   │
│  [Mediator 없이 vs 있을 때]                                      │
│                                                                   │
│  Without Mediator:        With Mediator:                          │
│  ┌───┐ ─── ┌───┐         ┌───┐     ┌───┐                       │
│  │ A │ ─── │ B │         │ A │─┐   │ B │                       │
│  └─┬─┘ ─── └─┬─┘         └───┘ │   └─┬─┘                       │
│    │  \  /   │                  │  ┌──▼──┐ │                     │
│    │   \/    │                  ├─►│ Med  │◄┤                     │
│    │   /\    │                  │  └──┬──┘ │                     │
│  ┌─▼─┐ ─── ┌▼──┐         ┌───┐ │   ┌─▼─┐                       │
│  │ C │ ─── │ D │         │ C │─┘   │ D │                       │
│  └───┘     └───┘         └───┘     └───┘                       │
│                                                                   │
│  N(N-1)/2 연결 → N 연결                                         │
│                                                                   │
│  .NET MediatR 패턴:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // C# MediatR 예시                                      │    │
│  │  public record CreateOrderCommand(                        │    │
│  │      string CustomerId,                                   │    │
│  │      List<OrderItem> Items                                │    │
│  │  ) : IRequest<OrderResult>;                               │    │
│  │                                                          │    │
│  │  public class CreateOrderHandler                          │    │
│  │      : IRequestHandler<CreateOrderCommand, OrderResult>   │    │
│  │  {                                                        │    │
│  │      public async Task<OrderResult> Handle(               │    │
│  │          CreateOrderCommand request,                      │    │
│  │          CancellationToken cancellationToken)             │    │
│  │      {                                                    │    │
│  │          // 처리 로직                                     │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // Controller에서:                                       │    │
│  │  var result = await _mediator.Send(                        │    │
│  │      new CreateOrderCommand(customerId, items));          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 객체 간 결합도 극적 감소, 새 동료 객체 추가 용이          │
│  단점: Mediator 자체가 God Object가 될 위험                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.7 Template Method Pattern (JdbcTemplate, IoC)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 7: Template Method Pattern                     │
│                                                                   │
│  정의: 알고리즘의 골격을 부모 클래스에 정의하고,                  │
│        특정 단계를 자식 클래스에 위임                             │
│                                                                   │
│  "Hollywood Principle": "Don't call us, we'll call you"          │
│                                                                   │
│  [아키텍처]                                                       │
│                                                                   │
│  ┌─────────────────────────────────┐                             │
│  │ AbstractClass                    │                             │
│  │                                  │                             │
│  │ + templateMethod() {             │  ← 골격 (불변)             │
│  │     step1();          // 고정    │                             │
│  │     step2();          // 위임!   │                             │
│  │     step3();          // 고정    │                             │
│  │     step4();          // 위임!   │                             │
│  │   }                              │                             │
│  │                                  │                             │
│  │ # step2()  // abstract           │  ← 가변 (서브클래스 위임)  │
│  │ # step4()  // abstract           │  ← 가변 (서브클래스 위임)  │
│  └──────────┬──────────────────────┘                             │
│             │                                                     │
│      ┌──────┴──────┐                                              │
│      │              │                                              │
│  ┌───▼──────┐  ┌───▼──────┐                                     │
│  │ConcreteA │  │ConcreteB │                                     │
│  │step2(){} │  │step2(){} │                                     │
│  │step4(){} │  │step4(){} │                                     │
│  └──────────┘  └──────────┘                                     │
│                                                                   │
│  Spring JdbcTemplate 예시:                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // Spring이 골격을 제공하고, 개발자는 RowMapper만 위임   │    │
│  │  List<User> users = jdbcTemplate.query(                   │    │
│  │      "SELECT * FROM users WHERE active = ?",              │    │
│  │      (rs, rowNum) -> new User(        // ← 위임! (람다)  │    │
│  │          rs.getLong("id"),                                 │    │
│  │          rs.getString("name"),                             │    │
│  │          rs.getString("email")                             │    │
│  │      ),                                                   │    │
│  │      true                                                 │    │
│  │  );                                                       │    │
│  │                                                          │    │
│  │  // JdbcTemplate 내부 (골격):                             │    │
│  │  // 1. Connection 획득        (고정)                      │    │
│  │  // 2. PreparedStatement 생성 (고정)                      │    │
│  │  // 3. 실행                   (고정)                      │    │
│  │  // 4. RowMapper 호출         (위임!) ← 개발자가 제공    │    │
│  │  // 5. Connection 반환        (고정)                      │    │
│  │  // 6. 예외 변환              (고정)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Strategy와의 비교:                                              │
│  ├── Template Method: 상속 기반 위임 (컴파일 타임)               │
│  └── Strategy: 합성 기반 위임 (런타임)                           │
│      → 현대적 관점에서는 Strategy를 선호 (유연성)                │
│                                                                   │
│  장점: 코드 중복 제거, 프레임워크 설계에 최적                    │
│  단점: 상속 필수 (Fragile Base Class 위험)                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.8 Visitor + Double Dispatch (AST, 컴파일러)

```
┌─────────────────────────────────────────────────────────────────┐
│              패턴 8: Visitor + Double Dispatch                    │
│                                                                   │
│  정의: 객체 구조와 연산을 분리. 수신자와 인자의 타입 조합으로    │
│        실행할 메서드를 결정 (Double Dispatch)                     │
│                                                                   │
│  [Double Dispatch 메커니즘]                                      │
│                                                                   │
│  1차 Dispatch: element.accept(visitor)                            │
│     → element의 실제 타입으로 accept() 결정                      │
│                                                                   │
│  2차 Dispatch: visitor.visit(this)                                │
│     → visitor의 실제 타입으로 visit() 결정                       │
│                                                                   │
│  결과: element 타입 × visitor 타입 조합으로 실행 메서드 결정     │
│                                                                   │
│  [AST 컴파일러 예시]                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // AST 노드                                             │    │
│  │  interface AstNode {                                      │    │
│  │      <R> R accept(AstVisitor<R> visitor);                 │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  class NumberLiteral implements AstNode {                  │    │
│  │      double value;                                        │    │
│  │      public <R> R accept(AstVisitor<R> v) {               │    │
│  │          return v.visitNumber(this);  // 2차 dispatch     │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  class BinaryExpr implements AstNode {                     │    │
│  │      AstNode left, right; String operator;                │    │
│  │      public <R> R accept(AstVisitor<R> v) {               │    │
│  │          return v.visitBinary(this);  // 2차 dispatch     │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // Visitor들                                             │    │
│  │  interface AstVisitor<R> {                                │    │
│  │      R visitNumber(NumberLiteral node);                    │    │
│  │      R visitBinary(BinaryExpr node);                      │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  class Evaluator implements AstVisitor<Double> {          │    │
│  │      public Double visitNumber(NumberLiteral n) {         │    │
│  │          return n.value;                                  │    │
│  │      }                                                    │    │
│  │      public Double visitBinary(BinaryExpr b) {            │    │
│  │          double l = b.left.accept(this);                  │    │
│  │          double r = b.right.accept(this);                 │    │
│  │          return switch(b.operator) {                      │    │
│  │              case "+" -> l + r;                            │    │
│  │              case "*" -> l * r;                            │    │
│  │              default -> throw new RuntimeException();     │    │
│  │          };                                               │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  class PrettyPrinter implements AstVisitor<String> {      │    │
│  │      // 동일 AST 구조에 다른 연산 추가 (OCP)             │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  vtable과의 관계:                                                │
│  ├── Dynamic Dispatch: vtable로 수신자 타입 기반 메서드 결정    │
│  ├── Double Dispatch: 수신자 + 인자 두 타입 모두 기반           │
│  └── Action Router의 라우팅 테이블은 vtable과 개념적 동일       │
│                                                                   │
│  장점: 구조 변경 없이 새 연산 추가 (OCP)                        │
│  단점: 새 노드 타입 추가 시 모든 Visitor 수정 필요              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. Modern 패턴 (4가지)

## 7.1 Middleware Pipeline (Express, Koa 양파 모델, ASP.NET Core)

```
┌─────────────────────────────────────────────────────────────────┐
│              Modern 1: Middleware Pipeline                        │
│                                                                   │
│  [Express.js 선형 파이프라인]                                    │
│                                                                   │
│  Request ──► MW1 ──► MW2 ──► MW3 ──► Handler ──► Response       │
│              │        │        │                                  │
│              │ next() │ next() │ next()                           │
│                                                                   │
│  [Koa.js 양파 모델 (Onion Model)]                                │
│                                                                   │
│  Request ──►┌─────────────────────────────┐──► Response          │
│             │ MW1 (before)                 │                       │
│             │  ┌───────────────────────┐  │                       │
│             │  │ MW2 (before)          │  │                       │
│             │  │  ┌─────────────────┐  │  │                       │
│             │  │  │ MW3 (before)    │  │  │                       │
│             │  │  │  ┌───────────┐  │  │  │                       │
│             │  │  │  │  Handler  │  │  │  │                       │
│             │  │  │  └───────────┘  │  │  │                       │
│             │  │  │ MW3 (after)     │  │  │                       │
│             │  │  └─────────────────┘  │  │                       │
│             │  │ MW2 (after)           │  │                       │
│             │  └───────────────────────┘  │                       │
│             │ MW1 (after)                  │                       │
│             └─────────────────────────────┘                       │
│                                                                   │
│  Koa 코드:                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  app.use(async (ctx, next) => {                          │    │
│  │      const start = Date.now();    // before (요청 시)    │    │
│  │      await next();                // 다음 미들웨어 위임  │    │
│  │      const ms = Date.now() - start;// after (응답 시)    │    │
│  │      ctx.set('X-Response-Time', `${ms}ms`);              │    │
│  │  });                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ASP.NET Core Pipeline:                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  app.UseExceptionHandler()    // 예외 처리               │    │
│  │     .UseHttpsRedirection()    // HTTPS 리다이렉션        │    │
│  │     .UseStaticFiles()         // 정적 파일               │    │
│  │     .UseRouting()             // 라우팅 결정              │    │
│  │     .UseAuthentication()      // 인증                    │    │
│  │     .UseAuthorization()       // 인가                    │    │
│  │     .UseEndpoints(...)        // 최종 핸들러             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  핵심 인사이트:                                                   │
│  ├── Express: 선형 (before만, after는 별도 처리)                 │
│  ├── Koa: 양파형 (before + await next() + after 자연스럽게)      │
│  └── ASP.NET Core: 양파형 + 순서가 매우 중요                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Service Mesh Routing (Istio, Envoy sidecar)

```
┌─────────────────────────────────────────────────────────────────┐
│              Modern 2: Service Mesh Routing                      │
│                                                                   │
│  정의: 라우팅 로직을 애플리케이션 코드에서 완전히 분리하여       │
│        인프라 레벨(sidecar proxy)에서 처리                       │
│                                                                   │
│  [Istio + Envoy 아키텍처]                                        │
│                                                                   │
│  ┌──────────────────────── Control Plane ─────────────────────┐ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │ │
│  │  │  Pilot   │  │ Citadel │  │  Galley  │                   │ │
│  │  │ (라우팅  │  │ (인증서)│  │ (설정)   │                   │ │
│  │  │  규칙)   │  │         │  │          │                   │ │
│  │  └────┬─────┘  └─────────┘  └──────────┘                   │ │
│  └───────┼────────────────────────────────────────────────────┘ │
│          │ xDS API (라우팅 규칙 전파)                            │
│          ▼                                                       │
│  ┌──────────────────── Data Plane ────────────────────────────┐ │
│  │                                                             │ │
│  │  ┌─────────────────────┐    ┌─────────────────────┐       │ │
│  │  │ Pod A               │    │ Pod B               │       │ │
│  │  │ ┌───────┐ ┌───────┐│    │ ┌───────┐ ┌───────┐│       │ │
│  │  │ │App    │ │Envoy  ││───►│ │Envoy  │ │App    ││       │ │
│  │  │ │Service│→│Sidecar│││    │ │Sidecar│→│Service││       │ │
│  │  │ └───────┘ └───────┘│    │ └───────┘ └───────┘│       │ │
│  │  └─────────────────────┘    └─────────────────────┘       │ │
│  │                                                             │ │
│  │  App은 라우팅을 전혀 모름. Envoy가 모든 트래픽을 가로채서  │ │
│  │  라우팅, 로드 밸런싱, mTLS, 재시도, Circuit Breaking 수행  │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  VirtualService (라우팅 규칙):                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  apiVersion: networking.istio.io/v1beta1                  │    │
│  │  kind: VirtualService                                     │    │
│  │  spec:                                                    │    │
│  │    hosts: [reviews]                                       │    │
│  │    http:                                                  │    │
│  │    - match:                                               │    │
│  │      - headers:                                           │    │
│  │          end-user:                                        │    │
│  │            exact: "jason"                                 │    │
│  │      route:                                               │    │
│  │      - destination:                                       │    │
│  │          host: reviews                                    │    │
│  │          subset: v2          # jason → v2로 라우팅        │    │
│  │    - route:                                               │    │
│  │      - destination:                                       │    │
│  │          host: reviews                                    │    │
│  │          subset: v1          # 나머지 → v1                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 코드 수정 없는 라우팅, 언어 무관, 관측 가능성             │
│  단점: 복잡한 운영, 리소스 오버헤드 (sidecar당 ~50MB)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 7.3 Serverless Function Routing (Lambda, EventBridge)

```
┌─────────────────────────────────────────────────────────────────┐
│              Modern 3: Serverless Function Routing                │
│                                                                   │
│  정의: 이벤트 소스가 함수를 직접 트리거하는 구조.                 │
│        "라우팅 = 이벤트 소스 매핑 (ESM)"                         │
│                                                                   │
│  [AWS Lambda Event Source Mapping]                                │
│                                                                   │
│  Event Sources                  Lambda Functions                  │
│  ┌──────────┐  ESM  ┌──────────────────────┐                    │
│  │ API GW   │──────►│ handleHttpRequest()   │                    │
│  └──────────┘       └──────────────────────┘                    │
│  ┌──────────┐  ESM  ┌──────────────────────┐                    │
│  │ S3 Event │──────►│ processUpload()       │                    │
│  └──────────┘       └──────────────────────┘                    │
│  ┌──────────┐  ESM  ┌──────────────────────┐                    │
│  │ SQS Queue│──────►│ processMessage()      │                    │
│  └──────────┘       └──────────────────────┘                    │
│  ┌──────────┐  ESM  ┌──────────────────────┐                    │
│  │EventBridge──────►│ handleSchedule()      │                    │
│  └──────────┘       └──────────────────────┘                    │
│                                                                   │
│  EventBridge 규칙 기반 라우팅:                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  {                                                        │    │
│  │    "source": ["com.myapp.orders"],                        │    │
│  │    "detail-type": ["OrderCreated"],                       │    │
│  │    "detail": {                                            │    │
│  │      "amount": [{"numeric": [">", 10000]}]               │    │
│  │    }                                                      │    │
│  │  }                                                        │    │
│  │  → 이 규칙에 매칭되면 VIP 처리 Lambda로 라우팅            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Step Functions (워크플로우 라우팅):                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  검증 Lambda ──► 결제 Lambda ──► Choice State           │    │
│  │                                    ├── amount > 100      │    │
│  │                                    │   → 수동 승인 Lambda│    │
│  │                                    └── else              │    │
│  │                                        → 자동 승인 Lambda│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 인프라 관리 불필요, 자동 스케일링, 이벤트 기반 자연스러움 │
│  단점: Cold Start, 실행 시간 제한, 로컬 디버깅 어려움            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 7.4 AI Agent Routing/Delegation (ReAct, LangChain, Function Calling)

```
┌─────────────────────────────────────────────────────────────────┐
│              Modern 4: AI Agent Routing/Delegation                │
│                                                                   │
│  정의: LLM이 자연어 요청을 분석하여 적절한 도구(Tool)를          │
│        선택하고 실행을 위임하는 패턴                              │
│                                                                   │
│  "라우팅 결정 자체를 AI가 수행" - 규칙이 아닌 추론 기반          │
│                                                                   │
│  [ReAct 패턴 (Reasoning + Acting)]                               │
│                                                                   │
│  User: "서울의 현재 날씨와 내일 일정을 알려줘"                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LLM (Router)                                              │   │
│  │                                                           │   │
│  │ Thought: 날씨 정보와 일정 정보가 필요하다.                │   │
│  │          두 개의 다른 도구를 사용해야 한다.                │   │
│  │                                                           │   │
│  │ Action: weather_api.get("Seoul")  ← 1차 위임 (라우팅)    │   │
│  │ Observation: 서울 12°C, 맑음                              │   │
│  │                                                           │   │
│  │ Thought: 날씨 정보를 얻었다. 이제 일정을 조회하자.        │   │
│  │                                                           │   │
│  │ Action: calendar.tomorrow()       ← 2차 위임 (라우팅)    │   │
│  │ Observation: 내일 10:00 팀미팅, 14:00 코드리뷰            │   │
│  │                                                           │   │
│  │ Thought: 모든 정보를 얻었다. 종합 응답을 생성하자.        │   │
│  │ Answer: "서울은 현재 12°C로 맑습니다. 내일 일정은..."     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [OpenAI Function Calling]                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // 도구 정의 (라우팅 대상)                               │    │
│  │  tools = [                                                │    │
│  │    {                                                      │    │
│  │      "type": "function",                                  │    │
│  │      "function": {                                        │    │
│  │        "name": "get_weather",                             │    │
│  │        "description": "Get current weather",              │    │
│  │        "parameters": {                                    │    │
│  │          "type": "object",                                │    │
│  │          "properties": {                                  │    │
│  │            "location": {"type": "string"}                 │    │
│  │          }                                                │    │
│  │        }                                                  │    │
│  │      }                                                    │    │
│  │    }                                                      │    │
│  │  ]                                                        │    │
│  │                                                          │    │
│  │  // LLM이 도구 선택 (라우팅) + 파라미터 생성              │    │
│  │  // → get_weather(location="Seoul") 호출 위임             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [LangChain / LangGraph Agent]                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  User Query                                              │    │
│  │      │                                                   │    │
│  │      ▼                                                   │    │
│  │  ┌──────────┐                                            │    │
│  │  │ LLM Agent│  ← 라우팅 결정자                           │    │
│  │  │ (Router) │                                            │    │
│  │  └─┬──┬──┬──┘                                            │    │
│  │    │  │  │                                                │    │
│  │    ▼  ▼  ▼                                                │    │
│  │  ┌──┐┌──┐┌──┐  ← Tools (위임 대상)                      │    │
│  │  │DB││API││계산│                                          │    │
│  │  └──┘└──┘└──┘                                            │    │
│  │    │  │  │                                                │    │
│  │    └──┼──┘                                                │    │
│  │       ▼                                                   │    │
│  │  ┌──────────┐                                            │    │
│  │  │ LLM Agent│  ← 결과 종합                               │    │
│  │  └──────────┘                                            │    │
│  │       │                                                   │    │
│  │       ▼                                                   │    │
│  │  Final Answer                                             │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [CrewAI 멀티 에이전트]                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  ┌───────────┐    위임    ┌───────────┐                 │    │
│  │  │ Manager   │──────────►│ Researcher│                 │    │
│  │  │ Agent     │    위임    │ Agent     │                 │    │
│  │  │ (Router)  │──────────►│ Writer    │                 │    │
│  │  │           │    위임    │ Agent     │                 │    │
│  │  │           │──────────►│ Reviewer  │                 │    │
│  │  └───────────┘            │ Agent     │                 │    │
│  │                           └───────────┘                 │    │
│  │                                                          │    │
│  │  전통 라우팅: 규칙 기반 (deterministic)                  │    │
│  │  AI 라우팅: 추론 기반 (probabilistic)                    │    │
│  │  → "어떤 도구를 쓸지"를 AI가 자율적으로 결정             │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 자연어 인터페이스, 복잡한 워크플로우 자동화               │
│  단점: 비결정적, 할루시네이션, 비용, 지연 시간                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 종합 비교표

## 8.1 Routing 패턴 비교 (7개 × 7개 축)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Routing 패턴 비교표                                              │
│                                                                                               │
│  패턴              │ 결합도 │ 유연성 │ 복잡도 │ 확장성 │ 디버깅 │ 성능    │ 최적 규모          │
│  ─────────────────┼───────┼───────┼───────┼───────┼───────┼────────┼────────────────────── │
│  Front Controller │ 중간   │ 높음   │ 낮음   │ 높음   │ 쉬움   │ 좋음    │ 단일 앱 (웹 MVC)    │
│  URL-based        │ 낮음   │ 중간   │ 낮음   │ 중간   │ 쉬움   │ 매우좋음│ 웹 API (REST)       │
│  Content-Based    │ 낮음   │ 높음   │ 중간   │ 높음   │ 중간   │ 중간    │ 메시징 시스템        │
│  Dynamic Router   │ 낮음   │매우높음│ 높음   │매우높음│ 어려움 │ 중간    │ A/B, 카나리 배포    │
│  Routing Slip     │ 낮음   │ 높음   │ 중간   │ 높음   │ 중간   │ 중간    │ 파이프라인 워크플로우│
│  API Gateway      │ 낮음   │ 높음   │ 높음   │매우높음│ 중간   │ 중간    │ 마이크로서비스       │
│  GraphQL Resolver │ 중간   │매우높음│ 높음   │ 높음   │ 어려움 │ 주의*   │ 복잡한 데이터 그래프│
│  Event Router     │매우낮음│ 높음   │ 중간   │매우높음│ 어려움 │ 비동기  │ 이벤트 드리븐       │
│                                                                                               │
│  * GraphQL: N+1 문제로 DataLoader 없이는 성능 저하 심각                                      │
│                                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Delegation 패턴 비교 (8개 × 7개 축)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Delegation 패턴 비교표                                           │
│                                                                                               │
│  패턴              │ 결합도 │ 유연성 │ 복잡도 │ 테스트 │ OCP  │ 위임방식     │ 최적 사용처     │
│  ─────────────────┼───────┼───────┼───────┼───────┼──────┼─────────────┼──────────────── │
│  Strategy         │ 낮음   │ 높음   │ 낮음   │ 쉬움   │ ★★★  │ 인터페이스   │ 알고리즘 교체    │
│  Command          │ 낮음   │ 높음   │ 중간   │ 쉬움   │ ★★★  │ 객체화       │ CQRS, Undo      │
│  CoR              │ 낮음   │ 높음   │ 중간   │ 중간   │ ★★☆  │ 체인 전달    │ 필터, 미들웨어  │
│  Proxy            │ 중간   │ 중간   │ 중간   │ 중간   │ ★★☆  │ 투명 래핑    │ 캐싱, 접근제어  │
│  Decorator        │ 낮음   │ 높음   │ 중간   │ 쉬움   │ ★★★  │ 재귀 래핑    │ 기능 동적 추가  │
│  Mediator         │ 낮음   │ 높음   │ 중간   │ 쉬움   │ ★★☆  │ 중재자 경유  │ 객체 간 소통    │
│  Template Method  │ 높음   │ 낮음   │ 낮음   │ 쉬움   │ ★☆☆  │ 상속 오버라이│ 프레임워크 골격 │
│  Visitor/DD       │ 중간   │ 중간   │ 높음   │ 중간   │ ★★☆  │ 이중 디스패치│ AST, 컴파일러   │
│                                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 8.3 성능/복잡도 스펙트럼

```
┌─────────────────────────────────────────────────────────────────┐
│              성능/복잡도 스펙트럼                                  │
│                                                                   │
│  복잡도                                                           │
│  높음 │                              ● Service Mesh              │
│       │                    ● AI Agent                             │
│       │           ● GraphQL    ● Dynamic Router                  │
│       │      ● CQRS/Command                                      │
│       │    ● Mediator    ● Content-Based Router                  │
│  중간 │  ● CoR/Middleware   ● Routing Slip                       │
│       │  ● Proxy/Decorator    ● Event Router                     │
│       │  ● Visitor                                                │
│  낮음 │ ● Strategy    ● URL-based Routing                        │
│       │ ● Template Method  ● Front Controller                    │
│       └──────────────────────────────────────────────────────    │
│        낮음              중간              높음      성능         │
│                                                                   │
│  Sweet Spots (적정 사용 규모):                                   │
│  ├── 2-3개 분기: if-else 충분 (YAGNI)                            │
│  ├── 4-10개 분기: Strategy + Map                                 │
│  ├── 10-50개 핸들러: Front Controller + 어노테이션               │
│  ├── 50-200개 핸들러: CQRS + Mediator                            │
│  └── 200개+: 마이크로서비스 + API Gateway                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 시나리오별 최적 선택

```
┌─────────────────────────────────────────────────────────────────┐
│              14가지 시나리오별 최적 패턴 추천                     │
│                                                                   │
│  번호 │ 시나리오                │ 1순위 추천              │ 2순위│
│  ─────┼────────────────────────┼────────────────────────┼──── │
│   1   │ 웹 MVC 애플리케이션    │ Front Controller       │ URL  │
│   2   │ REST API               │ URL-based + Strategy   │ CQRS │
│   3   │ API Gateway            │ API GW (Kong/Envoy)    │ Mesh │
│   4   │ 이벤트 드리븐 시스템   │ Event Router + CBR     │ Slip │
│   5   │ 플러그인 시스템        │ Strategy + CoR         │ Med  │
│   6   │ 워크플로우 엔진        │ Routing Slip + Command │ SM   │
│   7   │ 인증/인가              │ CoR (FilterChain)      │ Proxy│
│   8   │ 알고리즘 선택          │ Strategy               │ TM   │
│   9   │ 크로스커팅 관심사      │ Proxy/AOP + Decorator  │ CoR  │
│  10   │ 복잡한 비즈니스 규칙   │ Strategy + Command     │ Vis  │
│  11   │ 프론트엔드 상태관리    │ Command (Redux)        │ Med  │
│  12   │ 배치 파이프라인        │ Routing Slip           │ CoR  │
│  13   │ AI Agent 시스템        │ AI Agent Router        │ Dyn  │
│  14   │ gRPC 서비스            │ Proto Dispatch         │ CoR  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│              의사결정 트리 (Decision Tree)                        │
│                                                                   │
│  요청이 들어왔다                                                  │
│  │                                                                │
│  ├── 분기가 2-3개인가?                                           │
│  │   └── YES → if-else로 충분 (YAGNI)                            │
│  │                                                                │
│  ├── 웹 HTTP 요청인가?                                           │
│  │   ├── 단일 앱? → Front Controller + URL-based                 │
│  │   ├── MSA? → API Gateway                                      │
│  │   └── 양방향? → WebSocket + Event Router                      │
│  │                                                                │
│  ├── 메시징/이벤트인가?                                          │
│  │   ├── 내용 기반 분기? → Content-Based Router                  │
│  │   ├── 순서 있는 처리? → Routing Slip                          │
│  │   └── 구독 기반? → Event Router (Pub/Sub)                     │
│  │                                                                │
│  ├── 알고리즘/정책 교체인가?                                     │
│  │   ├── 런타임 교체? → Strategy                                 │
│  │   └── 프레임워크 골격? → Template Method                      │
│  │                                                                │
│  ├── 요청을 객체로 다뤄야 하는가? (큐잉, Undo, 감사)            │
│  │   └── YES → Command (+ CQRS)                                  │
│  │                                                                │
│  ├── 횡단 관심사 (인증, 로깅, 캐싱)?                             │
│  │   ├── 요청 파이프라인? → CoR / Middleware                     │
│  │   ├── 투명한 기능 추가? → Proxy / Decorator                   │
│  │   └── 메서드 수준? → AOP                                      │
│  │                                                                │
│  ├── 객체 간 복잡한 상호작용?                                    │
│  │   └── YES → Mediator                                           │
│  │                                                                │
│  ├── 자연어 기반 라우팅?                                         │
│  │   └── YES → AI Agent Router (ReAct, Function Calling)          │
│  │                                                                │
│  └── 인프라 수준 라우팅?                                         │
│      └── YES → Service Mesh (Istio/Envoy)                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 베스트 프랙티스

## 10.1 URL 설계 원칙 (RESTful, 버저닝)

```
┌─────────────────────────────────────────────────────────────────┐
│              RESTful URL 설계 원칙                                │
│                                                                   │
│  원칙 1: 리소스 중심, 복수 명사                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ✅ GET    /api/v1/users                                 │    │
│  │  ✅ GET    /api/v1/users/123                             │    │
│  │  ✅ POST   /api/v1/users                                 │    │
│  │  ✅ PUT    /api/v1/users/123                             │    │
│  │  ✅ DELETE /api/v1/users/123                             │    │
│  │  ✅ GET    /api/v1/users/123/orders                      │    │
│  │                                                          │    │
│  │  ❌ GET    /api/v1/getUser                 (동사 사용)   │    │
│  │  ❌ POST   /api/v1/user/create             (동사 사용)   │    │
│  │  ❌ GET    /api/v1/user                    (단수 명사)   │    │
│  │  ❌ GET    /api/v1/users/123/orders/456/items/789/reviews│    │
│  │                        ↑ 계층 3단계 초과 (1-2단계 권장)  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  원칙 2: API 버저닝                                              │
│  ┌──────────────┬────────────────────────────────────────┐      │
│  │ 방식          │ 예시                                    │      │
│  ├──────────────┼────────────────────────────────────────┤      │
│  │ URI (권장)   │ /api/v1/users, /api/v2/users           │      │
│  │ Header       │ Accept: application/vnd.api.v1+json     │      │
│  │ Query Param  │ /api/users?version=1                     │      │
│  │ 날짜 (Stripe)│ Stripe-Version: 2023-10-16              │      │
│  └──────────────┴────────────────────────────────────────┘      │
│                                                                   │
│  URI 버저닝이 가장 직관적이고 널리 사용됨                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.2 Spring MVC 심화

```
┌─────────────────────────────────────────────────────────────────┐
│              Spring MVC 라우팅 & 위임 베스트 프랙티스             │
│                                                                   │
│  [PathVariable vs RequestParam]                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @PathVariable: 리소스 식별 (필수)                       │    │
│  │  GET /users/{id}  → 특정 사용자를 식별                   │    │
│  │                                                          │    │
│  │  @RequestParam: 필터링/정렬 (선택)                       │    │
│  │  GET /users?status=active&sort=name                      │    │
│  │                                                          │    │
│  │  혼합 예시:                                              │    │
│  │  GET /users/{id}/orders?status=pending&page=0&size=20    │    │
│  │       └── 식별 ──┘        └── 필터링 / 페이지네이션 ──┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [HandlerMethodArgumentResolver - 커스텀 파라미터 바인딩]        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // 커스텀 어노테이션                                     │    │
│  │  @Target(ElementType.PARAMETER)                           │    │
│  │  @Retention(RetentionPolicy.RUNTIME)                      │    │
│  │  public @interface CurrentUser {}                          │    │
│  │                                                          │    │
│  │  // Resolver 구현                                         │    │
│  │  @Component                                               │    │
│  │  public class CurrentUserResolver                         │    │
│  │          implements HandlerMethodArgumentResolver {        │    │
│  │                                                          │    │
│  │      @Override                                            │    │
│  │      public boolean supportsParameter(                    │    │
│  │              MethodParameter parameter) {                 │    │
│  │          return parameter.hasParameterAnnotation(         │    │
│  │              CurrentUser.class);                           │    │
│  │      }                                                    │    │
│  │                                                          │    │
│  │      @Override                                            │    │
│  │      public Object resolveArgument(...) {                 │    │
│  │          Authentication auth = SecurityContextHolder      │    │
│  │              .getContext().getAuthentication();            │    │
│  │          return userService.findByUsername(                │    │
│  │              auth.getName());                              │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 사용: Controller에서                                  │    │
│  │  @GetMapping("/profile")                                  │    │
│  │  public UserDto getProfile(@CurrentUser User user) {      │    │
│  │      return UserDto.from(user);                           │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Filter vs Interceptor vs AOP]                                  │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐   │
│  │              │ Servlet Filter│ Interceptor  │ AOP        │   │
│  ├──────────────┼──────────────┼──────────────┼────────────┤   │
│  │ 실행 시점    │ DS 이전      │ Handler 전후 │ 메서드 전후│   │
│  │ 접근 대상    │ Request/Resp │ Handler 정보 │ 메서드 정보│   │
│  │ 주요 용도    │ 인코딩, CORS │ 인증, 로깅   │ 트랜잭션   │   │
│  │              │ 보안 헤더    │ 권한 체크    │ 감사, 캐싱 │   │
│  │ Spring 빈   │ △ (등록 필요)│ ○           │ ○          │   │
│  │ 순서 제어    │ @Order       │ addInterceptor│ @Order    │   │
│  └──────────────┴──────────────┴──────────────┴────────────┘   │
│                                                                   │
│  실행 순서:                                                       │
│  Filter → DispatcherServlet → Interceptor.pre                    │
│  → Handler(AOP before → 메서드 → AOP after)                     │
│  → Interceptor.post → Filter                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.3 Strategy 패턴 구현 (Spring Map DI)

```
┌─────────────────────────────────────────────────────────────────┐
│              Strategy 패턴 + Spring DI 완전 가이드                │
│                                                                   │
│  [Interface + Enum + Factory + Spring Map DI]                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // 1. Strategy 인터페이스                                │    │
│  │  public interface PaymentStrategy {                        │    │
│  │      PaymentResult pay(PaymentRequest request);            │    │
│  │      PaymentType getType();  // 자기 타입 선언            │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 2. 구현체들 (각각 @Service)                           │    │
│  │  @Service                                                 │    │
│  │  public class CardPayment implements PaymentStrategy {    │    │
│  │      public PaymentType getType() {                       │    │
│  │          return PaymentType.CARD;                          │    │
│  │      }                                                    │    │
│  │      public PaymentResult pay(PaymentRequest req) {       │    │
│  │          // 카드 결제 로직                                │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  @Service                                                 │    │
│  │  public class BankTransferPayment implements PaymentStrat │    │
│  │  egy {                                                    │    │
│  │      public PaymentType getType() {                       │    │
│  │          return PaymentType.BANK_TRANSFER;                │    │
│  │      }                                                    │    │
│  │      // ...                                               │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 3. Router (Map 기반, Spring DI 자동 수집)             │    │
│  │  @Service                                                 │    │
│  │  public class PaymentRouter {                             │    │
│  │      private final Map<PaymentType, PaymentStrategy> map; │    │
│  │                                                          │    │
│  │      public PaymentRouter(List<PaymentStrategy> all) {    │    │
│  │          this.map = all.stream()                          │    │
│  │              .collect(Collectors.toMap(                    │    │
│  │                  PaymentStrategy::getType,                │    │
│  │                  Function.identity()                      │    │
│  │              ));                                           │    │
│  │      }                                                    │    │
│  │                                                          │    │
│  │      public PaymentResult process(PaymentRequest req) {   │    │
│  │          PaymentStrategy strategy = map.get(req.getType())│    │
│  │          ;                                                │    │
│  │          if (strategy == null) {                           │    │
│  │              throw new UnsupportedPaymentException(        │    │
│  │                  req.getType());                           │    │
│  │          }                                                │    │
│  │          return strategy.pay(req);  // 위임!              │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 새 결제 방식 추가: @Service 클래스 하나만 추가하면 됨 │    │
│  │  // PaymentRouter 코드 수정 불필요 → OCP 완벽 준수        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.4 Event-Driven Delegation

```
┌─────────────────────────────────────────────────────────────────┐
│              Event-Driven Delegation 구현                         │
│                                                                   │
│  [ApplicationEventPublisher + @EventListener + @Async]           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  // 도메인 이벤트                                         │    │
│  │  public record OrderCreatedEvent(                         │    │
│  │      Long orderId,                                        │    │
│  │      String customerId,                                   │    │
│  │      BigDecimal totalAmount,                              │    │
│  │      Instant createdAt                                    │    │
│  │  ) {}                                                     │    │
│  │                                                          │    │
│  │  // 발행 (서비스에서)                                     │    │
│  │  @Service                                                 │    │
│  │  @RequiredArgsConstructor                                 │    │
│  │  public class OrderService {                              │    │
│  │      private final ApplicationEventPublisher publisher;   │    │
│  │                                                          │    │
│  │      @Transactional                                       │    │
│  │      public Order createOrder(CreateOrderRequest req) {   │    │
│  │          Order order = orderRepository.save(              │    │
│  │              Order.from(req));                             │    │
│  │                                                          │    │
│  │          // 이벤트 발행 → Spring이 라우팅해줌             │    │
│  │          publisher.publishEvent(new OrderCreatedEvent(    │    │
│  │              order.getId(),                               │    │
│  │              order.getCustomerId(),                       │    │
│  │              order.getTotalAmount(),                      │    │
│  │              order.getCreatedAt()                         │    │
│  │          ));                                               │    │
│  │                                                          │    │
│  │          return order;                                    │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 구독자 1: 동기 처리 (같은 트랜잭션)                   │    │
│  │  @Component                                               │    │
│  │  public class InventoryEventHandler {                     │    │
│  │      @EventListener                                       │    │
│  │      public void onOrderCreated(OrderCreatedEvent e) {    │    │
│  │          inventoryService.reserve(e.orderId());           │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 구독자 2: 비동기 처리                                 │    │
│  │  @Component                                               │    │
│  │  public class NotificationEventHandler {                  │    │
│  │      @Async                                               │    │
│  │      @EventListener                                       │    │
│  │      public void onOrderCreated(OrderCreatedEvent e) {    │    │
│  │          emailService.sendConfirmation(e.customerId());   │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // 구독자 3: 트랜잭션 커밋 후 실행                       │    │
│  │  @TransactionalEventListener(phase = AFTER_COMMIT)        │    │
│  │  public void onOrderCommitted(OrderCreatedEvent e) {      │    │
│  │      externalApiClient.notifyPartner(e.orderId());        │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  장점: 발행자-구독자 완전 분리, 새 구독자 추가 용이 (OCP)       │
│  주의: @Async 사용 시 트랜잭션 전파 안됨                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.5 WebFlux RouterFunction

```
┌─────────────────────────────────────────────────────────────────┐
│              Spring WebFlux 함수형 라우팅                         │
│                                                                   │
│  [RouterFunction + HandlerFunction]                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @Configuration                                           │    │
│  │  public class UserRouter {                                │    │
│  │                                                          │    │
│  │      @Bean                                                │    │
│  │      public RouterFunction<ServerResponse> userRoutes(    │    │
│  │              UserHandler handler) {                        │    │
│  │          return route()                                   │    │
│  │              .path("/api/v1/users", builder -> builder     │    │
│  │                  .GET("", handler::list)                   │    │
│  │                  .GET("/{id}", handler::getById)          │    │
│  │                  .POST("", handler::create)               │    │
│  │                  .PUT("/{id}", handler::update)           │    │
│  │                  .DELETE("/{id}", handler::delete)        │    │
│  │              )                                            │    │
│  │              .filter((req, next) -> {                      │    │
│  │                  log.info("Request: {} {}",                │    │
│  │                      req.method(), req.path());           │    │
│  │                  return next.handle(req);                  │    │
│  │              })                                           │    │
│  │              .build();                                     │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  @Component                                               │    │
│  │  public class UserHandler {                               │    │
│  │                                                          │    │
│  │      public Mono<ServerResponse> getById(ServerRequest r) │    │
│  │      {                                                    │    │
│  │          Long id = Long.parseLong(                        │    │
│  │              r.pathVariable("id"));                        │    │
│  │          return userService.findById(id)                  │    │
│  │              .flatMap(user -> ServerResponse.ok()          │    │
│  │                  .bodyValue(user))                         │    │
│  │              .switchIfEmpty(ServerResponse.notFound()      │    │
│  │                  .build());                                │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  @GetMapping vs RouterFunction:                                  │
│  ├── @GetMapping: 선언적, 간결, 대부분의 경우 충분               │
│  └── RouterFunction: 함수형, 조합 가능, 동적 라우팅에 유리       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 10.6 공통 베스트 프랙티스

```
┌─────────────────────────────────────────────────────────────────┐
│              공통 베스트 프랙티스                                  │
│                                                                   │
│  1. SRP: Router와 Handler를 분리                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ❌ Controller가 직접 비즈니스 로직 수행                  │    │
│  │  ✅ Controller → Service → Repository 위임 체인          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. OCP: Strategy Map 패턴                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ❌ switch(type) { case A: ...; case B: ...; }           │    │
│  │  ✅ Map<Type, Strategy> → strategy.get(type).execute()    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  3. 글로벌 에러 핸들링: @RestControllerAdvice                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @RestControllerAdvice                                    │    │
│  │  public class GlobalExceptionHandler {                    │    │
│  │                                                          │    │
│  │      @ExceptionHandler(EntityNotFoundException.class)     │    │
│  │      public ResponseEntity<ErrorResponse> handleNotFound( │    │
│  │              EntityNotFoundException ex) {                │    │
│  │          return ResponseEntity.status(404)                │    │
│  │              .body(ErrorResponse.of("NOT_FOUND",          │    │
│  │                  ex.getMessage()));                        │    │
│  │      }                                                    │    │
│  │                                                          │    │
│  │      @ExceptionHandler(MethodArgumentNotValidException    │    │
│  │              .class)                                      │    │
│  │      public ResponseEntity<ErrorResponse> handleValidation│    │
│  │      (MethodArgumentNotValidException ex) {               │    │
│  │          List<String> errors = ex.getBindingResult()      │    │
│  │              .getFieldErrors().stream()                    │    │
│  │              .map(e -> e.getField() + ": "                │    │
│  │                  + e.getDefaultMessage())                  │    │
│  │              .toList();                                    │    │
│  │          return ResponseEntity.badRequest()               │    │
│  │              .body(ErrorResponse.of("VALIDATION", errors))│    │
│  │          ;                                                │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  4. MDC + Correlation ID (요청 추적)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @Component                                               │    │
│  │  public class CorrelationIdFilter extends                 │    │
│  │          OncePerRequestFilter {                           │    │
│  │                                                          │    │
│  │      @Override                                            │    │
│  │      protected void doFilterInternal(                     │    │
│  │              HttpServletRequest req,                      │    │
│  │              HttpServletResponse res,                     │    │
│  │              FilterChain chain) throws ... {              │    │
│  │                                                          │    │
│  │          String correlationId = req.getHeader(            │    │
│  │              "X-Correlation-Id");                          │    │
│  │          if (correlationId == null) {                      │    │
│  │              correlationId = UUID.randomUUID().toString(); │    │
│  │          }                                                │    │
│  │                                                          │    │
│  │          MDC.put("correlationId", correlationId);         │    │
│  │          res.setHeader("X-Correlation-Id", correlationId);│    │
│  │                                                          │    │
│  │          try {                                            │    │
│  │              chain.doFilter(req, res);                    │    │
│  │          } finally {                                      │    │
│  │              MDC.clear();                                  │    │
│  │          }                                                │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  // logback 패턴:                                         │    │
│  │  // %d [%X{correlationId}] %-5level %logger - %msg%n     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 안티패턴 (10가지)

## 11.1 God Controller

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 1: God Controller                           │
│                                                                   │
│  문제: 하나의 Controller가 수십~수백 개의 엔드포인트를 처리      │
│  증상: 3000줄 이상의 Controller, 수십 개의 @Autowired            │
│                                                                   │
│  ❌ 문제 코드:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @RestController                                          │    │
│  │  public class ApiController {                             │    │
│  │      @Autowired UserService userService;                  │    │
│  │      @Autowired OrderService orderService;                │    │
│  │      @Autowired PaymentService paymentService;            │    │
│  │      @Autowired ProductService productService;            │    │
│  │      // ... 20개 이상의 Service 주입 ...                  │    │
│  │                                                          │    │
│  │      @GetMapping("/users/{id}") ...                       │    │
│  │      @PostMapping("/orders") ...                          │    │
│  │      @PutMapping("/payments/{id}") ...                    │    │
│  │      // ... 50개 이상의 엔드포인트 ...                    │    │
│  │  }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ✅ 해결: 도메인별 Controller 분리                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  @RestController @RequestMapping("/api/v1/users")         │    │
│  │  public class UserController { ... }                      │    │
│  │                                                          │    │
│  │  @RestController @RequestMapping("/api/v1/orders")        │    │
│  │  public class OrderController { ... }                     │    │
│  │                                                          │    │
│  │  @RestController @RequestMapping("/api/v1/payments")      │    │
│  │  public class PaymentController { ... }                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.2 Switch-Case Routing (OCP 위반)

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 2: Switch-Case Routing                     │
│                                                                   │
│  문제: 새 타입 추가 시마다 switch문을 찾아서 수정해야 함         │
│  증상: "모든 switch를 찾아서 고치세요" 라는 코드 리뷰            │
│                                                                   │
│  ❌ 문제 코드:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  public BigDecimal calculate(String type, BigDecimal amt) │    │
│  │  {                                                        │    │
│  │      return switch (type) {                               │    │
│  │          case "CARD" -> processCard(amt);                 │    │
│  │          case "BANK" -> processBank(amt);                 │    │
│  │          case "CRYPTO" -> processCrypto(amt); // 신규추가 │    │
│  │          default -> throw new IllegalArgumentException(); │    │
│  │      };                                                   │    │
│  │  }                                                        │    │
│  │  // 결제, 환불, 영수증 등 10곳에 동일 switch 존재!        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ✅ 해결: Strategy Map 패턴 (10.3절 참조)                        │
│  새 결제 수단 추가 시 @Service 클래스 하나만 추가하면 됨         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 Deep Inheritance Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 3: Deep Inheritance Hierarchy               │
│                                                                   │
│  문제: 깊은 상속 체인으로 인한 Fragile Base Class 문제           │
│  증상: 부모 클래스 수정 시 예측 불가능한 자식 클래스 동작 변경   │
│                                                                   │
│  ❌ Stack extends Vector (Java 표준 라이브러리의 실수):          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Stack<String> stack = new Stack<>();                     │    │
│  │  stack.push("A");                                         │    │
│  │  stack.push("B");                                         │    │
│  │  stack.push("C");                                         │    │
│  │                                                          │    │
│  │  // Stack인데 중간 삽입이 가능!? (Vector 메서드 상속)     │    │
│  │  stack.add(0, "X");  // ❌ LIFO 원칙 위반                │    │
│  │  stack.remove(1);    // ❌ 임의 위치 삭제 가능            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ❌ 게임 오브젝트 조합 폭발:                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  GameObject                                               │    │
│  │  ├── MovableObject                                        │    │
│  │  │   ├── FlyingMovableObject                              │    │
│  │  │   │   ├── FlyingShootingMovableObject                  │    │
│  │  │   │   └── FlyingHealingMovableObject                   │    │
│  │  │   └── SwimmingMovableObject                            │    │
│  │  │       ├── SwimmingShootingMovableObject                │    │
│  │  │       └── ... (조합 폭발!)                             │    │
│  │  └── StaticObject                                         │    │
│  │      └── ...                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ✅ 해결: 합성(Composition) + 위임(Delegation)                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  class GameObject {                                       │    │
│  │      private MovementStrategy movement;  // 위임          │    │
│  │      private AttackStrategy attack;      // 위임          │    │
│  │      private HealthStrategy health;      // 위임          │    │
│  │                                                          │    │
│  │      void update() {                                      │    │
│  │          movement.move(this);   // 이동 위임              │    │
│  │          attack.attack(this);   // 공격 위임              │    │
│  │      }                                                    │    │
│  │  }                                                        │    │
│  │  // 조합이 아무리 많아도 Strategy 구현체만 추가           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.4 ~ 11.10 나머지 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              안티패턴 4~10 요약                                   │
│                                                                   │
│  4. Circular Delegation (순환 위임)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: A→B→C→A 순환 호출 → StackOverflow                │    │
│  │  해결: 의존성 방향을 단방향으로 정리                      │    │
│  │        이벤트 기반으로 전환하여 순환 끊기                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  5. Leaky Abstraction (추상화 누수)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: Router가 Handler 내부 구현 세부사항에 의존         │    │
│  │  증상: Router가 Handler의 구체 타입을 캐스팅하여 사용     │    │
│  │  해결: 인터페이스 계약을 명확히 정의                      │    │
│  │        Handler가 필요한 모든 정보를 인터페이스로 노출     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  6. Over-abstraction (과도한 추상화)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: 분기가 2개인데 Strategy + Factory + Registry 도입  │    │
│  │  증상: 코드 이해에 5개 파일을 타고 들어가야 함            │    │
│  │  해결: YAGNI 원칙. 분기 2-3개면 if-else가 더 명확.       │    │
│  │        실제로 확장 요구가 생길 때 리팩터링               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  7. Service Locator (서비스 로케이터)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: 의존성을 레지스트리에서 런타임에 조회              │    │
│  │  증상: ServiceLocator.get(UserService.class)              │    │
│  │  해결: DI (Dependency Injection)로 전환.                   │    │
│  │        컴파일 타임에 의존성 확인 가능                     │    │
│  │  Fowler가 "DI가 Service Locator보다 낫다" 명시           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  8. Anemic Domain Model (빈약한 도메인 모델)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: 도메인 객체가 getter/setter만 가진 데이터 봉투     │    │
│  │        모든 로직이 Service에 몰려있음                     │    │
│  │  증상: OrderService가 1000줄, Order가 50줄               │    │
│  │  해결: 도메인 객체에 비즈니스 로직을 위임                 │    │
│  │        order.cancel() vs orderService.cancel(orderId)    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  9. Middleware Hell (미들웨어 지옥)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: 미들웨어가 30개 이상 체인으로 연결                 │    │
│  │  증상: 요청 하나에 어떤 미들웨어가 실행되는지 알 수 없음  │    │
│  │  해결: 미들웨어를 기능별로 그룹화                         │    │
│  │        라우트별로 필요한 미들웨어만 적용                   │    │
│  │        Express: router.use() vs app.use() 구분            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  10. Hidden Control Flow (숨겨진 제어 흐름)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  문제: AOP, Event, 리플렉션으로 제어 흐름이 보이지 않음   │    │
│  │  증상: "이 메서드가 언제 호출되는지 모르겠다"             │    │
│  │  해결: @EventListener에 명확한 문서화                     │    │
│  │        AOP 적용 범위를 최소화 (너무 넓은 pointcut 금지)   │    │
│  │        IDE 플러그인 활용 (Spring Tools 이벤트 추적)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 빅테크 실전 사례

## 12.1 Google (GFE, gRPC, Borg/K8s, Guice/Dagger)

```
┌─────────────────────────────────────────────────────────────────┐
│              Google의 라우팅 & 위임 아키텍처                      │
│                                                                   │
│  [Google Front End (GFE)]                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  전 세계 100개 이상 POP(Point of Presence)에 배포된       │    │
│  │  글로벌 HTTP 리버스 프록시                                │    │
│  │                                                          │    │
│  │  Client ──► GFE (가장 가까운 POP)                        │    │
│  │              ├── TLS 종단                                 │    │
│  │              ├── DDoS 방어                                │    │
│  │              ├── 서비스 라우팅 결정                       │    │
│  │              └── 백엔드 서비스로 위임 ──►  [Service]      │    │
│  │                                                          │    │
│  │  모든 외부 트래픽의 단일 진입점 = Front Controller의      │    │
│  │  글로벌 스케일 적용                                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [gRPC Proto Dispatch]                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // Proto 정의 = 라우팅 테이블                           │    │
│  │  service OrderService {                                   │    │
│  │      rpc CreateOrder(CreateOrderReq)                      │    │
│  │          returns (CreateOrderResp);                       │    │
│  │      rpc GetOrder(GetOrderReq)                            │    │
│  │          returns (GetOrderResp);                          │    │
│  │  }                                                        │    │
│  │                                                          │    │
│  │  /OrderService/CreateOrder → 자동 라우팅                 │    │
│  │  타입 안전, 코드 생성, HTTP/2 멀티플렉싱                  │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Borg BNS → K8s Service]                                        │
│  ├── Borg BNS(Borg Name Service): 내부 서비스 디스커버리         │
│  ├── K8s Service: Borg 개념을 오픈소스로 → kube-proxy 라우팅     │
│  └── ClusterIP, NodePort, LoadBalancer 타입별 라우팅 전략        │
│                                                                   │
│  [Guice/Dagger DI]                                               │
│  ├── Guice: Google 내부 DI 프레임워크 (2006)                     │
│  ├── Dagger: 컴파일 타임 DI (안드로이드 최적화)                  │
│  └── 위임 대상(의존성)을 프레임워크가 자동 주입                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.2 Netflix (Zuul 2, Full Cycle Developers)

```
┌─────────────────────────────────────────────────────────────────┐
│              Netflix의 라우팅 아키텍처                             │
│                                                                   │
│  [Zuul 2 Gateway]                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  규모: 초당 100만 이상 요청, 80개 이상 클러스터          │    │
│  │                                                          │    │
│  │  아키텍처:                                                │    │
│  │  Client ──► Zuul 2                                       │    │
│  │              │                                            │    │
│  │              ├── Inbound Filters (인증, 라우팅 결정)      │    │
│  │              │   ├── Netty 비동기 논블로킹 I/O            │    │
│  │              │   └── Groovy 스크립트로 필터 핫 리로드     │    │
│  │              │                                            │    │
│  │              ├── Endpoint Filter (프록시 or 정적 응답)    │    │
│  │              │                                            │    │
│  │              └── Outbound Filters (헤더 추가, 메트릭)    │    │
│  │                                                          │    │
│  │  핵심 특징:                                               │    │
│  │  ├── 비동기 논블로킹 (Zuul 1은 동기 블로킹이었음)        │    │
│  │  ├── 필터 핫 리로드 (재배포 없이 라우팅 규칙 변경)       │    │
│  │  └── Connection Pool 관리 (백엔드별 독립)                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Full Cycle Developers]                                         │
│  ├── "You build it, you run it" 철학                             │
│  ├── 개발자가 라우팅 규칙부터 운영까지 전체 책임                 │
│  └── 중앙 집중 게이트웨이 팀 대신 각 팀이 자체 라우팅 관리      │
│                                                                   │
│  [Hystrix → Resilience4j]                                        │
│  ├── Hystrix: Circuit Breaker + 위임 실패 시 Fallback            │
│  ├── 2018년 유지보수 모드 전환                                   │
│  └── Resilience4j: 경량화된 대안으로 전환                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.3 Meta (GraphQL Resolver, ServiceRouter)

```
┌─────────────────────────────────────────────────────────────────┐
│              Meta의 라우팅 & 위임 아키텍처                        │
│                                                                   │
│  [GraphQL]                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  2012: 내부 개발 (모바일 앱 데이터 요청 최적화)          │    │
│  │  2015: 오픈소스 공개                                      │    │
│  │                                                          │    │
│  │  "클라이언트가 라우팅을 결정한다"                        │    │
│  │                                                          │    │
│  │  Client가 쿼리 구조를 정의                               │    │
│  │  → Resolver가 필드별로 데이터 소스에 위임                │    │
│  │  → DataLoader가 N+1 문제 해결 (배치 + 캐싱)             │    │
│  │                                                          │    │
│  │  Meta 내부: 하루 수천억 GraphQL 쿼리 처리                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [ServiceRouter - Hyperscale Service Mesh]                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  규모: 초당 수백억 요청                                  │    │
│  │                                                          │    │
│  │  Istio/Envoy 접근법과 다른 점:                           │    │
│  │  ├── Sidecar 프록시 회피 (오버헤드 감소)                 │    │
│  │  ├── 라우팅 로직을 라이브러리로 직접 앱에 임베딩         │    │
│  │  ├── Thrift 기반 (gRPC 대신)                             │    │
│  │  └── 하이퍼스케일에 최적화된 자체 솔루션                 │    │
│  │                                                          │    │
│  │  교훈: 규모에 따라 표준 솔루션이 적합하지 않을 수 있음   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.4 Uber (DOMA 5계층, Cadence/Temporal)

```
┌─────────────────────────────────────────────────────────────────┐
│              Uber의 DOMA 아키텍처                                 │
│                                                                   │
│  [DOMA - Domain-Oriented Microservice Architecture]              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  배경: 2200개 이상의 마이크로서비스 → 스파게티 의존성     │    │
│  │  해결: 70개 도메인으로 재구성, 5계층 위임 구조            │    │
│  │                                                          │    │
│  │  계층 5 (최상위): Infrastructure Services                 │    │
│  │  ├── 스토리지, 메시징, 네트워킹                           │    │
│  │  │                                                       │    │
│  │  계층 4: Business Layer                                   │    │
│  │  ├── 비즈니스 로직, 오케스트레이션                        │    │
│  │  │                                                       │    │
│  │  계층 3: Domain Gateway                                   │    │
│  │  ├── 도메인 진입점 (API Gateway의 도메인 버전)           │    │
│  │  ├── 외부→내부 라우팅 담당                               │    │
│  │  │                                                       │    │
│  │  계층 2: Domain Services                                  │    │
│  │  ├── 도메인 내부 서비스                                   │    │
│  │  │                                                       │    │
│  │  계층 1 (최하위): Domain Core                             │    │
│  │  ├── 핵심 도메인 엔티티, 값 객체                         │    │
│  │  │                                                       │    │
│  │  핵심 원칙:                                               │    │
│  │  ├── 위임은 항상 위→아래 방향 (상위→하위 계층)           │    │
│  │  ├── 같은 계층 간 직접 호출 금지                         │    │
│  │  └── Domain Gateway를 통해서만 외부 접근                  │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Cadence → Temporal]                                            │
│  ├── 월 120억 워크플로우 실행                                    │
│  ├── 복잡한 다단계 프로세스를 워크플로우로 모델링                │
│  ├── Activity = 위임 단위, Workflow = 라우팅/오케스트레이션      │
│  └── 실패 시 자동 재시도, 상태 복원                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.5 LinkedIn (Rest.li, Super Blocks)

```
┌─────────────────────────────────────────────────────────────────┐
│              LinkedIn의 라우팅 아키텍처                            │
│                                                                   │
│  [Rest.li 프레임워크]                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  규모: 975개 이상 리소스, 하루 1000억 이상 호출          │    │
│  │                                                          │    │
│  │  특징:                                                    │    │
│  │  ├── 리소스 지향 아키텍처 (REST보다 구조화)              │    │
│  │  ├── IDL 기반 자동 코드 생성 (타입 안전)                 │    │
│  │  ├── Collection, Association, Simple 리소스 타입          │    │
│  │  └── 자동 페이지네이션, 프로젝션                         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [Super Blocks]                                                  │
│  ├── 관련 API 호출을 하나의 블록으로 묶어 병렬 실행              │
│  ├── GraphQL과 유사한 문제(N+1)를 다른 방식으로 해결             │
│  └── 서버 사이드 배치 처리 + 클라이언트 캐싱                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.6 Twitter/X (Finagle Dtabs)

```
┌─────────────────────────────────────────────────────────────────┐
│              Twitter의 Finagle Dtabs                              │
│                                                                   │
│  [Delegation Tables (Dtabs)]                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // Dtab: 서비스 이름 → 실제 주소 매핑을 동적으로 변경   │    │
│  │  Dtab.base = Dentry.read("/s/users => /$/inet/user-svc") │    │
│  │                                                          │    │
│  │  // 요청별 Dtab 오버라이드 (테스트, 카나리)              │    │
│  │  Dtab.local = Dentry.read(                                │    │
│  │    "/s/users => /$/inet/user-svc-canary"                  │    │
│  │  )                                                        │    │
│  │                                                          │    │
│  │  핵심: 라우팅 규칙이 요청 헤더로 전파됨                  │    │
│  │  → 서비스 메시 없이도 동적 라우팅 가능                   │    │
│  │  → 스테이징 환경을 요청 단위로 구성                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.7 Stripe (날짜 기반 API 버저닝)

```
┌─────────────────────────────────────────────────────────────────┐
│              Stripe의 API 버저닝 전략                              │
│                                                                   │
│  [날짜 기반 Version + Version Change Module]                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Stripe-Version: 2023-10-16                              │    │
│  │                                                          │    │
│  │  동작 방식:                                               │    │
│  │  ┌──────────────┐                                        │    │
│  │  │ API Request   │                                        │    │
│  │  │ Version:      │                                        │    │
│  │  │ 2023-10-16   │                                        │    │
│  │  └──────┬────────┘                                        │    │
│  │         │                                                 │    │
│  │         ▼                                                 │    │
│  │  ┌──────────────────────────┐                            │    │
│  │  │ Version Change Modules   │                            │    │
│  │  │                          │                            │    │
│  │  │ 2025-01-01: 변경 C ←─── 최신                         │    │
│  │  │ 2024-06-15: 변경 B      │                            │    │
│  │  │ 2023-10-16: 변경 A ←─── 요청 버전                    │    │
│  │  │ 2023-01-01: 변경 ...    │                            │    │
│  │  │                          │                            │    │
│  │  │ 요청 버전(2023-10-16) 이후의 변경만 역순으로 적용    │    │
│  │  │ → 구 버전 호환성 자동 유지                            │    │
│  │  └──────────────────────────┘                            │    │
│  │                                                          │    │
│  │  Auto-pinning:                                            │    │
│  │  ├── 첫 API 호출 시 해당 시점의 버전으로 자동 고정       │    │
│  │  ├── 개발자가 명시적으로 업그레이드할 때까지 유지         │    │
│  │  └── 하위 호환성 보장                                    │    │
│  │                                                          │    │
│  │  교훈: "API 버저닝은 라우팅 문제이자 위임 문제"          │    │
│  │  각 Version Change Module이 변환 위임 체인을 형성        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.8 AWS (ALB, Lambda ESM, Step Functions)

```
┌─────────────────────────────────────────────────────────────────┐
│              AWS의 라우팅 서비스                                   │
│                                                                   │
│  [ALB Rules-Based Routing]                                       │
│  ├── URL 경로, 호스트, 헤더, 쿼리스트링 기반 라우팅              │
│  ├── 가중치 기반 라우팅 (Blue-Green, Canary)                     │
│  └── 규칙 우선순위로 라우팅 체인 구성                            │
│                                                                   │
│  [Lambda Event Source Mapping]                                   │
│  ├── API GW → Lambda (동기, HTTP 라우팅)                         │
│  ├── SQS → Lambda (비동기, 배치 위임)                            │
│  ├── Kinesis → Lambda (스트림, 순서 보장 위임)                   │
│  └── EventBridge → Lambda (규칙 기반 이벤트 라우팅)              │
│                                                                   │
│  [Step Functions]                                                │
│  ├── 상태 머신 기반 워크플로우 오케스트레이션                    │
│  ├── Choice State = Content-Based Router                         │
│  ├── Parallel State = Fan-out 위임                               │
│  ├── Map State = 반복 위임                                       │
│  └── Task State = Lambda/Activity에 위임                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.9 Spotify (Backstage 플러그인 위임)

```
┌─────────────────────────────────────────────────────────────────┐
│              Spotify Backstage                                    │
│                                                                   │
│  [Plugin Architecture]                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  규모: 200개 이상 플러그인, 수천 기업이 채택              │    │
│  │                                                          │    │
│  │  Backstage Core                                          │    │
│  │  ├── Software Catalog (서비스 등록소)                     │    │
│  │  ├── Software Templates (프로젝트 생성 위임)             │    │
│  │  ├── TechDocs (문서화 위임)                              │    │
│  │  └── Plugin System (기능 확장 위임)                      │    │
│  │                                                          │    │
│  │  플러그인 = Strategy 패턴의 대규모 적용                  │    │
│  │  ├── 각 플러그인이 독립적인 기능 모듈                    │    │
│  │  ├── 코어가 플러그인에 기능을 위임                       │    │
│  │  ├── 플러그인 추가/제거로 플랫폼 커스터마이징            │    │
│  │  └── Frontend + Backend 플러그인 모두 지원               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.10 Airbnb (Viaduct 데이터 서비스 메시)

```
┌─────────────────────────────────────────────────────────────────┐
│              Airbnb Viaduct                                       │
│                                                                   │
│  [4가지 서비스 타입 위임 구조]                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  1. Presentation Service (API 계층)                      │    │
│  │     ├── 클라이언트 요청 수신                              │    │
│  │     └── 하위 서비스에 위임                                │    │
│  │                                                          │    │
│  │  2. Business Logic Service (도메인 로직)                 │    │
│  │     ├── 비즈니스 규칙 실행                                │    │
│  │     └── Data Service에 데이터 작업 위임                   │    │
│  │                                                          │    │
│  │  3. Data Service (데이터 접근)                            │    │
│  │     ├── DB, 캐시 등 데이터 소스 접근                     │    │
│  │     └── 데이터 변환/매핑                                  │    │
│  │                                                          │    │
│  │  4. Derived Data Service (파생 데이터)                    │    │
│  │     ├── 여러 Data Service의 데이터를 조합                │    │
│  │     └── 검색 인덱스, 분석 뷰 제공                        │    │
│  │                                                          │    │
│  │  Viaduct = 이 4계층 간 라우팅 + 위임을 관리하는 메시     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.11 Spring (Cloud Gateway, WebFlux fn)

```
┌─────────────────────────────────────────────────────────────────┐
│              Spring Cloud Gateway                                │
│                                                                   │
│  [Predicate + Filter 아키텍처]                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  spring:                                                  │    │
│  │    cloud:                                                 │    │
│  │      gateway:                                             │    │
│  │        routes:                                            │    │
│  │          - id: user-service                               │    │
│  │            uri: lb://user-service                         │    │
│  │            predicates:                                    │    │
│  │              - Path=/api/users/**                         │    │
│  │              - Method=GET,POST                            │    │
│  │              - Header=X-Api-Key, .*                       │    │
│  │            filters:                                       │    │
│  │              - StripPrefix=1                              │    │
│  │              - AddRequestHeader=X-Gateway, SCG            │    │
│  │              - CircuitBreaker=myCircuitBreaker             │    │
│  │              - RateLimiter=myRateLimiter                   │    │
│  │                                                          │    │
│  │  Predicate = 라우팅 조건 (어디로)                        │    │
│  │  Filter = 위임 전후 처리 (어떻게)                        │    │
│  │  URI = 위임 대상 (누구에게)                              │    │
│  │                                                          │    │
│  │  WebFlux 기반 → 논블로킹 고성능                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 12.12 AI Agent (LangChain, OpenAI Function Calling, CrewAI)

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Agent 라우팅 패러다임                              │
│                                                                   │
│  전통적 라우팅 vs AI 라우팅:                                     │
│  ┌──────────────┬──────────────────┬──────────────────────┐    │
│  │              │ 전통적            │ AI Agent              │    │
│  ├──────────────┼──────────────────┼──────────────────────┤    │
│  │ 라우팅 방식  │ 규칙 기반         │ 추론 기반             │    │
│  │ 결정론       │ 결정론적          │ 확률론적              │    │
│  │ 라우팅 정의  │ 개발자가 명시     │ LLM이 자율 결정      │    │
│  │ 새 경로 추가 │ 코드 변경 필요   │ 도구 설명만 추가      │    │
│  │ 실패 모드    │ 예측 가능         │ 할루시네이션 가능     │    │
│  │ 비용         │ 거의 무료         │ LLM API 비용          │    │
│  └──────────────┴──────────────────┴──────────────────────┘    │
│                                                                   │
│  [LangChain Agent Router]                                        │
│  ├── Tool 정의 = 라우팅 대상 등록                                │
│  ├── Agent = LLM 기반 라우터                                     │
│  ├── AgentExecutor = 실행 루프 (라우팅→위임→관찰→재라우팅)      │
│  └── Memory = 라우팅 컨텍스트 유지                               │
│                                                                   │
│  [OpenAI Function Calling]                                       │
│  ├── functions/tools 파라미터로 라우팅 대상 정의                 │
│  ├── LLM이 어떤 함수를 호출할지 결정 (라우팅)                   │
│  ├── JSON으로 인자 생성 후 반환                                  │
│  └── 클라이언트가 실제 함수 실행 (위임)                          │
│                                                                   │
│  [CrewAI 멀티 에이전트]                                          │
│  ├── Manager Agent가 작업을 분배 (라우팅)                        │
│  ├── Worker Agent가 실행 (위임)                                  │
│  ├── 에이전트 간 결과 전달                                       │
│  └── Sequential / Hierarchical / Consensual 프로세스             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 빅테크 진화 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│              빅테크 라우팅/위임 진화 4세대                         │
│                                                                   │
│  1세대: 단일 프록시 (2000-2010)                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  NGINX, HAProxy, Apache mod_proxy                        │    │
│  │  특징: L4/L7 로드 밸런싱, 정적 라우팅 규칙               │    │
│  │  대표: 대부분의 초기 웹 서비스                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                           │
│       ▼                                                           │
│  2세대: 스마트 게이트웨이 (2010-2018)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Netflix Zuul, Kong, Spring Cloud Gateway                │    │
│  │  특징: 동적 라우팅, 필터 체인, Circuit Breaker 통합      │    │
│  │  대표: Netflix, 대부분의 MSA 도입 기업                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                           │
│       ▼                                                           │
│  3세대: 도메인/의미론적 라우팅 (2018-2023)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Istio/Envoy, Uber DOMA, Airbnb Viaduct                 │    │
│  │  특징: 서비스 메시, 도메인 기반 라우팅, 관측 가능성      │    │
│  │  대표: Uber, Airbnb, Google (내부)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                           │
│       ▼                                                           │
│  4세대: AI 자율 위임 (2023+)                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LangChain, OpenAI Agents, CrewAI, AutoGen              │    │
│  │  특징: LLM 기반 라우팅 결정, 자연어 인터페이스           │    │
│  │  대표: AI-first 스타트업, 기업 AI 시스템                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 회사별 핵심 교훈 요약

```
┌─────────────────────────────────────────────────────────────────┐
│              빅테크 핵심 교훈 요약표                               │
│                                                                   │
│  회사       │ 핵심 전략                │ 교훈                    │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Google    │ GFE 글로벌 프록시        │ 단일 진입점의 글로벌    │
│            │ gRPC Proto Dispatch     │ 스케일 적용             │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Netflix   │ Zuul 2 비동기 게이트웨이│ 필터 핫 리로드로 무중단 │
│            │ Full Cycle Developers   │ 라우팅 변경             │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Meta      │ GraphQL 클라이언트 주도  │ 하이퍼스케일에서는      │
│            │ ServiceRouter 임베딩     │ 사이드카도 오버헤드     │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Uber      │ DOMA 5계층 도메인 위임   │ 2200 서비스를 70 도메인│
│            │ Cadence/Temporal         │ 으로 재구성하여 관리    │
│  ──────────┼─────────────────────────┼────────────────────── │
│  LinkedIn  │ Rest.li 975+ 리소스      │ IDL + 코드 생성으로    │
│            │ Super Blocks 배치       │ 대규모 API 관리        │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Twitter   │ Finagle Dtabs           │ 요청별 동적 라우팅으로 │
│            │                         │ 서비스 메시 없이 해결   │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Stripe    │ 날짜 기반 API 버전      │ 하위 호환성을 라우팅    │
│            │ Version Change Module   │ 체인으로 자동 유지      │
│  ──────────┼─────────────────────────┼────────────────────── │
│  AWS       │ ALB + Lambda ESM        │ 이벤트 소스 매핑 =     │
│            │ Step Functions          │ 서버리스 라우팅         │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Spotify   │ Backstage 200+ 플러그인 │ 플러그인 아키텍처 =    │
│            │                         │ Strategy의 대규모 적용 │
│  ──────────┼─────────────────────────┼────────────────────── │
│  Airbnb    │ Viaduct 4계층 서비스    │ 서비스 타입별 명확한   │
│            │                         │ 위임 책임 분리         │
│                                                                   │
│  공통 교훈:                                                       │
│  ├── 1. 라우팅은 반드시 코드에서 분리하라 (인프라 or 설정)       │
│  ├── 2. 위임 계층을 명확히 하라 (누가 누구에게 위임하는지)       │
│  ├── 3. 규모에 따라 패턴을 진화시켜라 (if-else → Strategy →     │
│  │       Gateway → Service Mesh → AI Agent)                      │
│  └── 4. 표준 솔루션이 안 맞으면 직접 만들 용기가 필요하다       │
│         (Meta ServiceRouter, Twitter Finagle, Stripe VCM)        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

Action Router, Delegation, Dispatcher, Front Controller, Command Pattern, Handler, Controller, Middleware, Chain of Responsibility, Strategy Pattern, Proxy Pattern, Decorator Pattern, Mediator Pattern, Template Method, Visitor Pattern, Double Dispatch, Dynamic Dispatch, Service Locator, Dependency Injection, IoC, SOLID, OCP, SRP, DIP, GoF Design Patterns, Smalltalk Message Passing, Self Language, Prototype-based Delegation, Favor Composition over Inheritance, Fowler PoEAA, Application Controller, Page Controller, Hohpe Woolf EIP, Content-Based Router, Dynamic Router, Routing Slip, Process Manager, Hexagonal Architecture, Ports and Adapters, Clean Architecture, Use Case, Dependency Rule, Spring DispatcherServlet, HandlerMapping, HandlerAdapter, ViewResolver, RequestMappingHandlerMapping, @GetMapping, @PostMapping, @PathVariable, @RequestParam, HandlerMethodArgumentResolver, Servlet Filter, HandlerInterceptor, Spring AOP, JDK Dynamic Proxy, CGLIB, Spring Security FilterChain, @EventListener, @TransactionalEventListener, ApplicationEventPublisher, Spring WebFlux, RouterFunction, HandlerFunction, Spring Cloud Gateway, Predicate, GatewayFilter, Express.js, Koa Onion Model, ASP.NET Core Middleware, Ruby on Rails routes.rb, Django urls.py, Redux dispatch reducer, GraphQL Resolver, DataLoader, N+1 Problem, gRPC proto dispatch, Protobuf, HTTP/2, API Gateway, Reverse Proxy, Kong, NGINX, Envoy, Traefik, BFF Pattern, Service Mesh, Istio, VirtualService, DestinationRule, Sidecar Proxy, xDS API, Serverless, AWS Lambda, EventBridge, Step Functions, ALB, Event Source Mapping, AI Agent Routing, ReAct Pattern, LangChain Agent, OpenAI Function Calling, CrewAI, LangGraph, CQRS, Command Handler, Query Handler, Event Sourcing, Domain Event, Pub/Sub, Message Broker, RabbitMQ Exchange, Kafka Consumer, Smart Broker, Smart Consumer, Dead Letter Queue, Backpressure, Fan-out, Fan-in, Reactive Streams, Google GFE, gRPC, Borg BNS, Guice, Dagger, Netflix Zuul 2, Hystrix, Resilience4j, Meta GraphQL, ServiceRouter, Uber DOMA, Cadence, Temporal, LinkedIn Rest.li, Super Blocks, Twitter Finagle, Dtabs, Stripe API Versioning, Version Change Module, Spotify Backstage, Airbnb Viaduct, God Controller, Switch-Case Routing, Deep Inheritance Hierarchy, Fragile Base Class, Circular Delegation, Leaky Abstraction, Over-abstraction, YAGNI, Anemic Domain Model, Middleware Hell, Hidden Control Flow, MDC, Correlation ID, @RestControllerAdvice
