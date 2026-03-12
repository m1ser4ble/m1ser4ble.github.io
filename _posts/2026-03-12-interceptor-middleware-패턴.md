---
layout: single
title: "Interceptor/Middleware 패턴"
date: 2026-03-12 10:33:00 +0900
categories: backend
excerpt: "Interceptor/Middleware 패턴은 요청-응답 경로에서 횡단 관심사를 분리해 코드 중복을 줄이고 확장성을 높인다."
toc: true
toc_sticky: true
tags: [interceptor, middleware, filter, architecture, spring, express]
---
TL;DR
- Interceptor/Middleware 패턴은 요청과 응답 흐름 중간에서 공통 로직을 가로채 처리하는 구조다.
- 비즈니스 로직과 횡단 관심사를 분리하면 변경 영향 범위를 줄이고 재사용성과 테스트 용이성을 확보할 수 있다.
- Filter/Interceptor/Middleware라는 이름 차이는 있어도 공통적으로 체인 순서 제어, 공통 정책 적용, 프레임워크 확장에 강하다.

## 1. 개념
Interceptor/Middleware 패턴은 요청과 응답 흐름 중간에서 공통 로직을 가로채 처리하는 구조다.

## 2. 배경
CGI 시대의 인증·로깅·보안 코드 중복과 유지보수 비용을 줄이기 위해 체인 기반 처리 모델이 발전했다.

## 3. 이유
비즈니스 로직과 횡단 관심사를 분리하면 변경 영향 범위를 줄이고 재사용성과 테스트 용이성을 확보할 수 있다.

## 4. 특징
Filter/Interceptor/Middleware라는 이름 차이는 있어도 공통적으로 체인 순서 제어, 공통 정책 적용, 프레임워크 확장에 강하다.

## 5. 상세 내용

# Interceptor/Middleware 패턴

> **작성일**: 2026-03-11
> **카테고리**: Backend / Design Pattern / Architecture
> **포함 내용**: Interceptor, Middleware, Filter, Chain of Responsibility, Pipes and Filters, POSA2, GoF, Express.js, Spring HandlerInterceptor, Servlet Filter, Koa Onion Model, AOP, Decorator, 횡단 관심사, Cross-Cutting Concerns, gRPC Interceptor, Service Mesh, Sidecar

---

# 1. 개요

```
┌─────────────────────────────────────────────────────────────────┐
│           Interceptor/Middleware 패턴이란?                       │
│                                                                   │
│  정의:                                                           │
│  A에서 B로 이동하는 요청/응답을 중간 경로에서 가로채어           │
│  횡단 관심사(Cross-Cutting Concerns)를 처리하는 아키텍처 패턴    │
│                                                                   │
│  비유: 공항 보안 검색대                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  승객(요청) ──► 신분확인 ──► 짐검사 ──► 보안검색 ──► 탑승│    │
│  │                                                          │    │
│  │  각 검색대는:                                            │    │
│  │  ├── 독립적으로 동작 (관심사의 분리)                      │    │
│  │  ├── 순서가 중요 (신분확인 → 짐검사 순서)                │    │
│  │  ├── 통과/차단을 결정 (필터링)                            │    │
│  │  └── 승객은 검색대 내부 로직을 모름 (투명성)              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  핵심 가치:                                                      │
│  ├── 인증, 로깅, 압축, CORS 등을 비즈니스 로직에서 완전 분리    │
│  ├── 기존 코드 수정 없이 새로운 관심사 추가 (개방-폐쇄 원칙)    │
│  └── 프레임워크마다 이름만 다를 뿐 본질은 동일                   │
│                                                                   │
│  프레임워크별 이름:                                              │
│  ├── Java Servlet  → Filter                                      │
│  ├── Spring MVC    → HandlerInterceptor                          │
│  ├── Express.js    → Middleware                                   │
│  ├── Django        → Middleware                                   │
│  ├── Rails         → before_action (구 before_filter)            │
│  ├── ASP.NET MVC   → Action Filter                               │
│  ├── gRPC          → Interceptor                                 │
│  └── NestJS        → Middleware + Interceptor + Guard + Pipe     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어의 어원과 기원

## 2.1 "Intercept"의 라틴어 어원

```
┌─────────────────────────────────────────────────────────────────┐
│                 Intercept의 어원                                  │
│                                                                   │
│  라틴어 분해:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  inter-   (사이에, between)                              │    │
│  │     +                                                    │    │
│  │  capere   (잡다, to seize)                               │    │
│  │     =                                                    │    │
│  │  intercipere  (통과 중에 가로채다)                       │    │
│  │                                                          │    │
│  │  Proto-Indo-European 어근: *kap- "붙잡다"                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  로마 군사 용어에서 유래:                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  interceptores = 적의 전령을 매복 공격하여               │    │
│  │                  군사 문서를 탈취하는 기병대              │    │
│  │                                                          │    │
│  │  [아군 진영] ←─── interceptores ───X─── [적 전령]       │    │
│  │                   (매복 기병대)          (문서 탈취)      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  영어 명사 interceptor 최초 기록: 1590년대                       │
│  군사 항공 (1930년대~): 적기를 차단하는 고속 전투기              │
│                                                                   │
│  핵심 의미 (소프트웨어에서도 동일):                              │
│  "A에서 B로 이동 중인 무언가를 중간 경로에서 가로채는 행위"     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 세 가지 핵심 용어의 관계

```
┌─────────────────────────────────────────────────────────────────┐
│          Middleware / Interceptor / Filter의 관계                 │
│                                                                   │
│  Middleware (미들웨어)                                            │
│  ├── 의미: 위치 개념 (가장 넓은 추상 계층)                       │
│  ├── 기원: 1968년 NATO Software Engineering Conference           │
│  │         Alex d'Agapeyeff가 최초 사용                          │
│  ├── 원래 뜻: OS와 응용 프로그램 사이에 위치하는 소프트웨어     │
│  └── 시대별 변화:                                                │
│      ├── 1968: OS-앱 사이의 계층                                 │
│      ├── 1990s: 분산시스템 인프라 (CORBA, MOM)                   │
│      └── 2010s: Express.js 요청 처리 함수 체인                   │
│                                                                   │
│  Interceptor (인터셉터)                                          │
│  ├── 의미: 행위 개념 (중간에 삽입되어 가로채는 동작)             │
│  ├── 기원: 1990년대 CORBA 분산시스템                             │
│  └── 공식 문서화: POSA2 (2000)                                   │
│                                                                   │
│  Filter (필터)                                                   │
│  ├── 의미: 처리 개념 (통과/걸러냄 판단)                          │
│  ├── 기원: Java Servlet 2.3 (2000-2001)                          │
│  └── 패턴 문서화: Core J2EE Patterns (2001)                      │
│      "Intercepting Filter" 패턴                                  │
│                                                                   │
│  관계:                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  동의어가 아니지만, 완전히 분리된 것도 아님              │    │
│  │                                                          │    │
│  │  ┌─── Middleware (어디에?) ───────────────────┐         │    │
│  │  │  ┌─── Interceptor (무엇을?) ────────┐      │         │    │
│  │  │  │  ┌─── Filter (어떻게?) ────┐     │      │         │    │
│  │  │  │  │  통과/차단 결정         │     │      │         │    │
│  │  │  │  └─────────────────────────┘     │      │         │    │
│  │  │  │  가로채서 처리                   │      │         │    │
│  │  │  └──────────────────────────────────┘      │         │    │
│  │  │  중간 계층에 위치                          │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Chain of Responsibility (GoF)는 이 중 어느 것이든               │
│  구현할 수 있는 구조적 도구                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.3 학술적 출처

```
┌─────────────────────────────────────────────────────────────────┐
│                    핵심 문헌                                      │
│                                                                   │
│  1. GoF "Design Patterns" (1994)                                 │
│     ├── Gamma, Helm, Johnson, Vlissides                          │
│     ├── Chain of Responsibility 패턴 정의                        │
│     └── "Avoid coupling the sender of a request to its          │
│          receiver by giving more than one object a chance        │
│          to handle the request."                                 │
│                                                                   │
│  2. POSA1 "Pattern-Oriented Software Architecture" (1996)        │
│     └── Pipes and Filters 아키텍처 패턴                          │
│                                                                   │
│  3. POSA2 (2000년 9월)                                           │
│     ├── Schmidt, Stal, Rohnert, Buschmann                        │
│     ├── Interceptor를 아키텍처 패턴으로 공식 문서화              │
│     └── "Interceptor allows services to be added                │
│          transparently to a framework and triggered              │
│          automatically when certain events occur."               │
│                                                                   │
│  4. Core J2EE Patterns (2001)                                    │
│     └── "Intercepting Filter" 패턴 문서화                        │
│                                                                   │
│  POSA2 Interceptor의 핵심 특성 4가지:                            │
│  ├── 투명성 (Transparency)                                       │
│  ├── 런타임 동적 등록                                            │
│  ├── 이벤트 기반 트리거                                          │
│  └── 비침습적 (Non-invasive)                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. 개념이 나오게 된 배경: CGI의 문제

```
┌─────────────────────────────────────────────────────────────────┐
│              CGI 시대의 근본적 문제 (1993-1998)                   │
│                                                                   │
│  CGI란?                                                          │
│  ├── 1993년 NCSA의 Rob McCool이 명세 작성                        │
│  ├── Common Gateway Interface                                    │
│  └── 웹 서버가 외부 프로그램을 실행하여 동적 콘텐츠 생성        │
│                                                                   │
│  동작 방식:                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  브라우저 ──► 웹서버 ──► fork() ──► CGI 스크립트 실행   │    │
│  │                              │                           │    │
│  │                              └── 요청마다 새 OS 프로세스 │    │
│  │                                  생성 → 처리 → 종료      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  문제: 크로스커팅 관심사의 코드 중복                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  login.cgi    → 인증 검사 코드 + 로깅 코드 + 비즈니스   │    │
│  │  order.cgi    → 인증 검사 코드 + 로깅 코드 + 비즈니스   │    │
│  │  profile.cgi  → 인증 검사 코드 + 로깅 코드 + 비즈니스   │    │
│  │  report.cgi   → 인증 검사 코드 + 로깅 코드 + 비즈니스   │    │
│  │  ...                                                     │    │
│  │  (100개 스크립트에 인증 로직 100번 복사!)                │    │
│  │                                                          │    │
│  │  인증 방식 변경되면? → 100개 파일 전부 수정              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  추가 문제:                                                      │
│  ├── 상태 비보존: 요청마다 프로세스가 죽으므로 상태 유지 불가    │
│  ├── 보안 취약성: 각 스크립트가 개별적으로 보안 처리              │
│  └── 성능: fork()는 비용이 매우 큰 시스템 콜                     │
│                                                                   │
│  1996년 FastCGI (Open Market):                                   │
│  ├── 프로세스 재사용으로 성능 문제 해결                          │
│  └── 그러나 코드 중복 문제는 여전!                               │
│                                                                   │
│  이 코드 중복 문제를 해결하기 위해                               │
│  Interceptor/Middleware/Filter 패턴이 등장                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 역사적 진화 타임라인

## 4.1 전체 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│                    진화 타임라인                                   │
│                                                                   │
│  1993 ── CGI (NCSA, Rob McCool)                                  │
│    │     요청마다 프로세스 fork(), 코드 중복 만연                 │
│    │                                                              │
│  1994 ── GoF Chain of Responsibility                              │
│    │     Gamma, Helm, Johnson, Vlissides                          │
│    │     체인의 "하나"만 요청 처리 (순수 CoR)                    │
│    │                                                              │
│  1996 ── FastCGI (Open Market)                                    │
│    │     프로세스 재사용, 코드 중복은 미해결                     │
│    │     POSA1 Pipes and Filters 아키텍처 패턴                   │
│    │                                                              │
│  2000 ── POSA2 Interceptor 패턴 공식 문서화                      │
│    │     Schmidt, Stal, Rohnert, Buschmann                        │
│    │                                                              │
│  2001 ── Java Servlet 2.3 Filter (JSR-053)                       │
│    │     Danny Coward 주도, web.xml 선언적 필터 체인              │
│    │     Core J2EE Patterns "Intercepting Filter"                 │
│    │                                                              │
│  2002 ── WebWork/XWork 인터셉터                                   │
│    │     Rickard Oberg, Patrick Lightbody (OpenSymphony)          │
│    │     인터셉터 스택 개념                                       │
│    │                                                              │
│  2003 ── Spring Framework 0.9                                     │
│    │     Rod Johnson, HandlerInterceptor                          │
│    │     Django 프로젝트 시작 (Adrian Holovaty, Simon Willison)   │
│    │                                                              │
│  2004 ── Spring 1.0, Ruby on Rails 공개 (DHH)                    │
│    │     Rails before_filter, CoC 철학                            │
│    │                                                              │
│  2005 ── Rails 1.0, Django 공개                                   │
│    │                                                              │
│  2006 ── Struts 2 (XWork 인터셉터 흡수)                          │
│    │                                                              │
│  2007 ── Rack (Christian Neukirchen)                              │
│    │     Ruby 서버-프레임워크 표준 인터페이스                     │
│    │     Python WSGI (PEP 333, 2003)에서 영감                    │
│    │                                                              │
│  2009 ── ASP.NET MVC 1.0 (Scott Guthrie)                         │
│    │     속성(Attribute) 기반 Action Filter                       │
│    │                                                              │
│  2010 ── Express.js (TJ Holowaychuk)                              │
│    │     Connect + Express, next() 함수 체인                      │
│    │     Sinatra에서 영감                                         │
│    │                                                              │
│  2013 ── Koa.js (TJ Holowaychuk)                                  │
│    │     Generator → async/await 기반                             │
│    │     양파 모델(Onion Model) 도입                              │
│    │     Rails 4: before_filter → before_action 이름 변경         │
│    │                                                              │
│  2014 ── Express 4.0 (Connect 의존성 분리)                       │
│    │                                                              │
│  2016 ── gRPC 인터셉터 (Google)                                   │
│    │     4가지 타입: Unary/Streaming x 서버/클라이언트            │
│    │     Django 1.10: 신형 함수형 양파 모델                       │
│    │                                                              │
│  현재 ── 서비스 메시 (Envoy/Istio)                               │
│          코드 수정 없이 인프라 레벨 인터셉션                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 주요 전환점 상세

### Java Servlet Filter (2001)

```
┌─────────────────────────────────────────────────────────────────┐
│              Servlet Filter - 표준화된 필터 체인                  │
│                                                                   │
│  배경:                                                           │
│  ├── JSR-053, Danny Coward 주도                                  │
│  ├── 2000년 10월 Proposed Final Draft                            │
│  └── Servlet 2.3 이전: "서블릿 체이닝" 비공식 메커니즘 (비표준) │
│                                                                   │
│  핵심: web.xml에서 선언적으로 필터 체인 구성                     │
│                                                                   │
│  <!-- web.xml -->                                                │
│  <filter>                                                        │
│    <filter-name>AuthFilter</filter-name>                         │
│    <filter-class>com.example.AuthFilter</filter-class>           │
│  </filter>                                                       │
│  <filter-mapping>                                                │
│    <filter-name>AuthFilter</filter-name>                         │
│    <url-pattern>/*</url-pattern>                                 │
│  </filter-mapping>                                               │
│                                                                   │
│  동작 흐름:                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  요청 ──► AuthFilter ──► LogFilter ──► Servlet          │    │
│  │                                                          │    │
│  │  각 Filter에서 FilterChain.doFilter() 호출으로           │    │
│  │  체인 실행 또는 중단 결정                                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  의의: 최초의 표준화된 웹 필터 메커니즘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Spring MVC HandlerInterceptor (2003-2004)

```
┌─────────────────────────────────────────────────────────────────┐
│          Spring HandlerInterceptor vs Servlet Filter             │
│                                                                   │
│  Rod Johnson "Expert One-on-One J2EE Design and Development"     │
│  (2002.10) → Spring 0.9 (2003.6) → Spring 1.0 (2004.3)         │
│                                                                   │
│  Servlet Filter와의 핵심 차이:                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Servlet Filter:                                         │    │
│  │  ├── 서블릿 컨테이너 레벨 (Tomcat 등)                    │    │
│  │  ├── Spring Bean에 접근 어려움                           │    │
│  │  └── 모든 요청에 대해 동작                               │    │
│  │                                                          │    │
│  │  Spring HandlerInterceptor:                              │    │
│  │  ├── 프레임워크 레벨 (DispatcherServlet 내부)            │    │
│  │  ├── Spring Bean 완전 접근 가능                          │    │
│  │  ├── handler 객체로 컨트롤러 정보 접근                   │    │
│  │  └── ModelAndView 조작 가능                              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  실행 위치 비교:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  요청 ──► [Servlet Filter] ──► DispatcherServlet        │    │
│  │                                    │                     │    │
│  │                              [HandlerInterceptor]        │    │
│  │                                    │                     │    │
│  │                               Controller                 │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Express.js 미들웨어 (2010)

```
┌─────────────────────────────────────────────────────────────────┐
│              Express.js - next()로 체인 제어                      │
│                                                                   │
│  TJ Holowaychuk, Connect + Express, Sinatra에서 영감             │
│                                                                   │
│  // Express 미들웨어 기본 구조                                   │
│  app.use((req, res, next) => {                                   │
│    console.log(`${req.method} ${req.url}`);                      │
│    next();  // 다음 미들웨어로 전달                              │
│  });                                                             │
│                                                                   │
│  app.use((req, res, next) => {                                   │
│    if (!req.headers.authorization) {                             │
│      return res.status(401).send('Unauthorized');                │
│      // next() 미호출 → 체인 중단                               │
│    }                                                             │
│    next();                                                       │
│  });                                                             │
│                                                                   │
│  핵심 특징:                                                      │
│  ├── next() 함수로 체인 진행/중단을 제어                         │
│  ├── 순서 = app.use() 호출 순서                                  │
│  ├── Express 4.0 (2014): Connect 의존성 완전 분리                │
│  └── JavaScript 생태계에서 "미들웨어"라는 용어를 대중화          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. 핵심 디자인 패턴

## 5.1 GoF Chain of Responsibility (1994)

```
┌─────────────────────────────────────────────────────────────────┐
│          Chain of Responsibility (GoF 1994)                      │
│                                                                   │
│  Intent:                                                         │
│  "Avoid coupling the sender of a request to its receiver        │
│   by giving more than one object a chance to handle             │
│   the request."                                                  │
│                                                                   │
│  원형 예시: GUI 컨텍스트 민감 도움말                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  사용자가 버튼 위에서 F1 누름                            │    │
│  │    │                                                     │    │
│  │    ▼                                                     │    │
│  │  Button ──(처리 못함)──► Panel ──(처리 못함)──► Dialog   │    │
│  │                                                  │        │    │
│  │                                           (도움말 표시!)  │    │
│  │                                                          │    │
│  │  핵심: 체인의 "오직 하나"만이 요청을 처리                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  UML 구조:                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Client ──► Handler (abstract)                           │    │
│  │               │  handleRequest()                         │    │
│  │               │  successor: Handler                      │    │
│  │               │                                          │    │
│  │         ┌─────┴──────┐                                   │    │
│  │         ▼            ▼                                   │    │
│  │  ConcreteHandler1  ConcreteHandler2                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  적용 시점:                                                      │
│  ├── 처리 객체가 미리 알려져 있지 않을 때                        │
│  ├── 여러 객체 중 하나가 처리해야 할 때                          │
│  └── 처리 객체를 동적으로 변경하고 싶을 때                       │
│                                                                   │
│  결과:                                                           │
│  ├── 장점: 결합도 감소, 유연성 증가                              │
│  └── 단점: 처리 보장 없음 (체인 끝까지 아무도 안 처리할 수도)   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Pipes and Filters (POSA Vol.1, 1996)

```
┌─────────────────────────────────────────────────────────────────┐
│              Pipes and Filters 아키텍처 패턴                     │
│                                                                   │
│  구조:                                                           │
│  Data Source ──► Filter ──pipe──► Filter ──pipe──► Data Sink    │
│                                                                   │
│  가장 유명한 구현: Unix 파이프                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  $ cat access.log | grep "ERROR" | sort | uniq -c       │    │
│  │                                                          │    │
│  │  cat ──► grep ──► sort ──► uniq                          │    │
│  │  (소스)  (필터)   (필터)   (싱크)                        │    │
│  │                                                          │    │
│  │  모든 필터가 데이터를 처리하고 다음으로 전달              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  CoR과의 핵심 차이:                                              │
│  ┌────────────────┬──────────────────┬────────────────────┐     │
│  │ 구분           │ Chain of Resp.   │ Pipes and Filters  │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 처리           │ 하나가 처리 후   │ 모든 필터가        │     │
│  │                │ 체인 중단        │ 데이터 처리        │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 패턴 수준      │ 객체 디자인 패턴 │ 아키텍처 패턴      │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 데이터 변환    │ 변환 없이 전달   │ 각 단계에서 변환   │     │
│  └────────────────┴──────────────────┴────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 POSA2 Interceptor 패턴 (2000)

```
┌─────────────────────────────────────────────────────────────────┐
│              POSA2 Interceptor 패턴                               │
│                                                                   │
│  Douglas C. Schmidt의 ACE/TAO 프레임워크에서 발전               │
│  CORBA "Portable Interceptor" 표준에서 체계적 등장               │
│                                                                   │
│  정의:                                                           │
│  "Interceptor allows services to be added transparently         │
│   to a framework and triggered automatically when certain       │
│   events occur."                                                 │
│                                                                   │
│  GoF CoR과의 핵심 차이:                                          │
│  ┌────────────────┬──────────────────┬────────────────────┐     │
│  │ 구분           │ CoR (GoF 1994)   │ Interceptor        │     │
│  │                │                  │ (POSA2 2000)       │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 처리 주체      │ 체인 중 하나만   │ 모든 인터셉터가    │     │
│  │                │ 처리             │ 실행 보장          │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 등록 시점      │ 주로 컴파일 타임 │ 런타임 동적 등록   │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 대상           │ 범용 요청 라우팅 │ 프레임워크 확장    │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ 투명성         │ 명시적 체인 구성 │ 나머지 시스템에    │     │
│  │                │                  │ 투명               │     │
│  └────────────────┴──────────────────┴────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5.4 패턴 계보도

```
┌─────────────────────────────────────────────────────────────────┐
│                    패턴 계보도                                    │
│                                                                   │
│  GoF Chain of Responsibility (1994)                              │
│  │  순수 CoR: 하나만 처리, 나머지 무시                           │
│  │                                                               │
│  ├── Pipeline 변형 (모두 실행)                                   │
│  │   │                                                           │
│  │   ├── POSA1 Pipes and Filters (1996)                          │
│  │   │   아키텍처 패턴, Unix 파이프                              │
│  │   │                                                           │
│  │   ├── POSA2 Interceptor (2000)                                │
│  │   │   프레임워크 확장, 투명성/동적 등록                       │
│  │   │                                                           │
│  │   └── Middleware Pattern (2010~)                               │
│  │       Express.js가 대중화한 웹 프레임워크 패턴                │
│  │                                                               │
│  └── 현대적 확장                                                 │
│      │                                                           │
│      ├── 리액티브: Spring WebFlux WebFilter                      │
│      │   Mono<Void> 기반 논블로킹 체인                           │
│      │                                                           │
│      └── 인프라: Envoy/Istio 사이드카                            │
│          코드 수정 없이 인프라 레벨 인터셉션                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. 작동 원리

## 6.1 기본 구조: 체인 실행

```
┌─────────────────────────────────────────────────────────────────┐
│              인터셉터/미들웨어 기본 동작                          │
│                                                                   │
│  선형 모델 (Express.js 스타일):                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  요청 ──► [MW1] ──► [MW2] ──► [MW3] ──► 핸들러          │    │
│  │            │         │         │                         │    │
│  │           로깅      인증      압축                       │    │
│  │                                                          │    │
│  │  각 미들웨어에서 next() 호출 → 다음으로 전달             │    │
│  │  next() 미호출 → 체인 중단 (예: 인증 실패 시)            │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  양파 모델 (Koa.js 스타일):                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │          ┌───────────────────────────────┐               │    │
│  │          │  MW1 (before)                 │               │    │
│  │          │  ┌───────────────────────┐    │               │    │
│  │          │  │  MW2 (before)         │    │               │    │
│  │          │  │  ┌───────────────┐    │    │               │    │
│  │  요청 ──►│  │  │   핸들러      │    │    │──► 응답       │    │
│  │          │  │  └───────────────┘    │    │               │    │
│  │          │  │  MW2 (after)          │    │               │    │
│  │          │  └───────────────────────┘    │               │    │
│  │          │  MW1 (after)                  │               │    │
│  │          └───────────────────────────────┘               │    │
│  │                                                          │    │
│  │  await next() 전 = preHandle (요청 가공)                 │    │
│  │  await next() 후 = postHandle (응답 가공)                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Koa.js 양파 모델 코드 예시

```javascript
// Koa.js 양파 모델 - 요청과 응답이 동일 계층을 통과

app.use(async (ctx, next) => {
  const start = Date.now();           // ① 요청 들어올 때
  await next();                        // ② 다음 미들웨어로
  const ms = Date.now() - start;      // ⑤ 응답 나올 때
  ctx.set('X-Response-Time', `${ms}ms`);
});

app.use(async (ctx, next) => {
  console.log('요청 시작');           // ③ 요청 들어올 때
  await next();                        // → 핸들러 실행
  console.log('응답 완료');           // ④ 응답 나올 때
});

// 실행 순서: ① → ② → ③ → 핸들러 → ④ → ⑤
```

```
┌─────────────────────────────────────────────────────────────────┐
│              koa-compose 내부 구현 원리                           │
│                                                                   │
│  function compose(middleware) {                                   │
│    return function(context, next) {                              │
│      let index = -1;                                             │
│      return dispatch(0);                                         │
│                                                                   │
│      function dispatch(i) {                                      │
│        index = i;                                                │
│        let fn = middleware[i];                                    │
│        if (i === middleware.length) fn = next;                    │
│        if (!fn) return Promise.resolve();                        │
│        return fn(context, () => dispatch(i + 1));                │
│      }                                                           │
│    };                                                            │
│  }                                                               │
│                                                                   │
│  핵심: 재귀적 dispatch 함수가 양파 모델을 구현                   │
│  next()를 호출하면 dispatch(i+1)이 실행되어 다음 계층으로        │
│  await로 기다렸다가 돌아오면 나머지 코드(after) 실행             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 Spring HandlerInterceptor 생명주기

```java
// Spring HandlerInterceptor 3단계 생명주기

public class LoggingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        // 컨트롤러 실행 전
        // false 반환 시 체인 중단
        log.info("요청: {} {}", request.getMethod(), request.getRequestURI());
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request,
                           HttpServletResponse response,
                           Object handler,
                           ModelAndView modelAndView) {
        // 컨트롤러 실행 후, 뷰 렌더링 전
        // ModelAndView 조작 가능
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        // 뷰 렌더링 완료 후 (리소스 정리)
    }
}
```

---

# 7. 장점

```
┌─────────────────────────────────────────────────────────────────┐
│              Interceptor/Middleware의 7가지 장점                  │
│                                                                   │
│  1. 관심사의 분리 (Separation of Concerns)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Before: 컨트롤러 안에 인증+로깅+압축+비즈니스 혼재     │    │
│  │  After:  인프라 관심사를 비즈니스 로직에서 완전 격리     │    │
│  │                                                          │    │
│  │  컨트롤러는 비즈니스 로직에만 집중                       │    │
│  │  인증/로깅/압축은 미들웨어가 처리                        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. DRY 원칙 (Don't Repeat Yourself)                             │
│  ├── 100개 엔드포인트에 JWT 검증 코드를 100번 쓸 필요 없음      │
│  └── 미들웨어 하나로 전체 적용                                   │
│                                                                   │
│  3. 개방-폐쇄 원칙 (Open-Closed Principle)                       │
│  ├── 기존 코드를 변경하지 않고                                   │
│  └── 새로운 인터셉터를 체인에 추가                               │
│                                                                   │
│  4. 조합 가능성 (Composability)                                   │
│  ├── 모노이드 구조: 인터셉터 + 인터셉터 = 인터셉터              │
│  └── 순서에 따라 자유롭게 조합                                   │
│                                                                   │
│  5. 테스트 가능성 (Testability)                                   │
│  ├── 각 인터셉터를 독립적으로 단위 테스트 가능                   │
│  └── Mock 요청/응답으로 격리된 테스트                             │
│                                                                   │
│  6. 단일 책임 원칙 (Single Responsibility)                        │
│  ├── 인증 미들웨어: 인증만                                       │
│  ├── 로깅 미들웨어: 로깅만                                       │
│  └── 압축 미들웨어: 압축만                                       │
│                                                                   │
│  7. 투명성/비침투성 (Transparency)                                │
│  ├── 비즈니스 로직은 인터셉터 존재를 모름                        │
│  └── 나머지 시스템에 영향 없이 추가/제거                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 단점과 한계

```
┌─────────────────────────────────────────────────────────────────┐
│              6가지 단점과 한계                                    │
│                                                                   │
│  1. 비가시적 제어 흐름                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "내 요청이 어디서 막혔지?"                              │    │
│  │                                                          │    │
│  │  요청 ──► [?] ──► [?] ──► [?] ──► [?] ──► 핸들러       │    │
│  │           어디서 401이 나오는 거지...?                    │    │
│  │                                                          │    │
│  │  Ben Nadel:                                              │    │
│  │  "HTTP 인터셉터는 본질적으로 공유된 전역 상태"           │    │
│  │                                                          │    │
│  │  Richard Marmorstein "Beware Middleware":                 │    │
│  │  "정적 분석 도구가 거의 도움이 안 된다"                  │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. 순서 의존성 버그                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  올바른 순서:                                            │    │
│  │  Authentication ──► Authorization ──► RateLimit          │    │
│  │  (누구인지 확인)    (권한 확인)       (요청 제한)        │    │
│  │                                                          │    │
│  │  잘못된 순서:                                            │    │
│  │  Authorization ──► Authentication ──► RateLimit          │    │
│  │  (권한 확인?)       (누군지도 모르는데?)                  │    │
│  │  → 모든 요청 401! 에러 없이 조용히 잘못된 동작!         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  3. 성능 오버헤드 ("미들웨어 세금")                              │
│  ├── 모든 요청이 전체 체인을 통과                                │
│  ├── 각 미들웨어의 실행 시간이 누적                              │
│  └── Vercel 사례: 요청당 60-70ms 추가 지연 발생                  │
│                                                                   │
│  4. 전역 vs 로컬 스코프 문제                                     │
│  ├── 전역 미들웨어가 불필요한 경로에도 적용                      │
│  ├── /health 체크에도 인증 미들웨어 실행                         │
│  └── 예외 경로 관리가 복잡해짐                                   │
│                                                                   │
│  5. 숨겨진 결합 (Hidden Coupling)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // RateLimit 미들웨어                                   │    │
│  │  if (req.isAdmin) {  // 어디서 설정한 거지?              │    │
│  │    limit = 1000;     // Auth 미들웨어에서 설정했나?      │    │
│  │  }                   // 의존 관계가 코드에 명시 안 됨!   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  6. 체인 전체 테스트의 복잡성                                    │
│  ├── 개별 미들웨어 단위 테스트는 쉬움                            │
│  ├── 체인 전체의 상호작용 테스트는 통합 테스트 필요              │
│  └── 순서 의존성까지 검증하려면 테스트가 복잡해짐                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. 안티패턴

```
┌─────────────────────────────────────────────────────────────────┐
│              5가지 안티패턴                                       │
│                                                                   │
│  1. 전지전능 인터셉터 (God Interceptor)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // 하나의 미들웨어가 모든 것을 처리                     │    │
│  │  app.use((req, res, next) => {                           │    │
│  │    // 인증 검사                                          │    │
│  │    // 권한 검사                                          │    │
│  │    // 로깅                                               │    │
│  │    // 입력 검증                                          │    │
│  │    // CORS 처리                                          │    │
│  │    // 레이트 리밋                                        │    │
│  │    // 캐싱                                               │    │
│  │    // ... 500줄                                          │    │
│  │    next();                                               │    │
│  │  });                                                     │    │
│  │                                                          │    │
│  │  → 단일 책임 원칙 위반, 테스트/유지보수 불가능           │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. 인터셉터 수프 (Interceptor Soup)                             │
│  ├── 미들웨어가 30개, 40개 쌓여서 흐름 파악 불가                 │
│  ├── 어떤 미들웨어가 어떤 영향을 주는지 추적 어려움              │
│  └── 디버깅 시 "수프 속에서 바늘 찾기"                           │
│                                                                   │
│  3. 비즈니스 로직의 인터셉터화                                   │
│  ├── 횡단 관심사만 미들웨어에 적합                               │
│  ├── 비즈니스 규칙을 미들웨어에 넣으면 로직이 숨겨짐             │
│  └── "왜 이 주문이 거부됐지?" → 미들웨어 20개를 뒤져야          │
│                                                                   │
│  4. 상태 저장 인터셉터 (Stateful Interceptor)                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  let requestCount = 0;  // 인터셉터에 상태 보관          │    │
│  │                                                          │    │
│  │  app.use((req, res, next) => {                           │    │
│  │    requestCount++;      // 동시 요청에서 레이스 컨디션!  │    │
│  │    next();                                               │    │
│  │  });                                                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  5. 필터 간 정보 과다 공유                                       │
│  ├── req 객체에 임의 속성을 과도하게 부착                        │
│  ├── req.user, req.isAdmin, req.tenant, req.featureFlags...      │
│  └── 미들웨어 간 암묵적 계약이 되어 결합도 상승                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. 대안 비교

```
┌─────────────────────────────────────────────────────────────────┐
│          Interceptor/Middleware의 4가지 대안                      │
│                                                                   │
│  1. AOP (Aspect-Oriented Programming)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  특징:                                                   │    │
│  │  ├── 임의 메서드에 정밀 적용 (HTTP 경계 밖에서도)        │    │
│  │  ├── 타입 안전 (컴파일 타임 위빙)                        │    │
│  │  └── 포인트컷으로 적용 대상 세밀 지정                    │    │
│  │                                                          │    │
│  │  적합한 경우:                                            │    │
│  │  ├── HTTP 요청/응답이 아닌 일반 메서드에 적용할 때       │    │
│  │  ├── 트랜잭션 관리, 캐싱, 메서드 레벨 보안              │    │
│  │  └── Spring @Transactional이 대표적 AOP 활용             │    │
│  │                                                          │    │
│  │  vs Interceptor:                                         │    │
│  │  인터셉터는 HTTP 경계에서 동작, AOP는 어디서든 동작      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  2. 데코레이터 패턴 (Decorator Pattern)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  특징:                                                   │    │
│  │  ├── 특정 객체 인스턴스를 래핑                           │    │
│  │  ├── 코드에서 명확히 보임 (명시적)                       │    │
│  │  └── 체인이 아닌 중첩 구조                               │    │
│  │                                                          │    │
│  │  // 데코레이터: 누가 래핑했는지 코드에서 보임            │    │
│  │  service = new LoggingDecorator(                          │    │
│  │              new CachingDecorator(                        │    │
│  │                new RealService()));                       │    │
│  │                                                          │    │
│  │  vs Interceptor:                                         │    │
│  │  데코레이터는 명시적, 인터셉터는 투명                    │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  3. 이벤트 드리븐 / 옵저버 패턴                                 │
│  ├── 비동기 브로드캐스트, 느슨한 결합                            │
│  ├── 요청/응답 체인이 아닌 발행/구독 모델                        │
│  └── 적합: 알림, 감사 로그 등 비동기 처리                        │
│                                                                   │
│  4. 직접 합성 (함수형 접근)                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  // 명시적 매개변수와 반환값                             │    │
│  │  const result = compress(                                │    │
│  │                   authorize(                             │    │
│  │                     authenticate(request)));             │    │
│  │                                                          │    │
│  │  장점: 타입 안전, 흐름이 코드에서 명확히 보임            │    │
│  │  단점: 규모가 커지면 관리 어려움                         │    │
│  │  적합: 소규모 앱, 단순한 파이프라인                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  요약 비교:                                                      │
│  ┌───────────┬──────────────┬────────────┬──────────────┐       │
│  │ 대안      │ 투명성       │ 적용 범위  │ 타입 안전성  │       │
│  ├───────────┼──────────────┼────────────┼──────────────┤       │
│  │ AOP       │ 높음         │ 임의 메서드│ 높음         │       │
│  │ Decorator │ 낮음(명시적) │ 특정 객체  │ 높음         │       │
│  │ Observer  │ 높음         │ 이벤트     │ 중간         │       │
│  │ 함수 합성│ 낮음(명시적) │ 전체       │ 매우 높음    │       │
│  │ 미들웨어 │ 높음         │ HTTP 경계  │ 낮음         │       │
│  └───────────┴──────────────┴────────────┴──────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 11. 현대적 변형

## 11.1 Koa.js 양파 모델 (2013)

```
┌─────────────────────────────────────────────────────────────────┐
│              Koa.js 양파 모델                                     │
│                                                                   │
│  TJ Holowaychuk, Generator → async/await 기반                    │
│                                                                   │
│  Express와의 차이:                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Express (선형):                                         │    │
│  │  요청 ──► MW1 ──► MW2 ──► MW3 ──► 핸들러 ──► 응답      │    │
│  │  (요청 방향으로만 진행)                                  │    │
│  │                                                          │    │
│  │  Koa (양파):                                             │    │
│  │  요청 ──► MW1.전 ──► MW2.전 ──► 핸들러                  │    │
│  │  응답 ◄── MW1.후 ◄── MW2.후 ◄──┘                       │    │
│  │  (요청/응답이 동일 계층을 왕복 통과)                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  이점:                                                           │
│  ├── 한 미들웨어 안에서 요청 전/후 처리를 모두 작성              │
│  ├── 응답 시간 측정이 자연스러움 (start → next → end)            │
│  └── 에러 처리가 try/catch로 직관적                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.2 Spring WebFlux WebFilter (리액티브)

```
┌─────────────────────────────────────────────────────────────────┐
│              Spring WebFlux WebFilter                             │
│                                                                   │
│  Mono<Void> 기반 논블로킹 필터 체인                              │
│                                                                   │
│  @Component                                                      │
│  public class LogFilter implements WebFilter {                   │
│      @Override                                                   │
│      public Mono<Void> filter(ServerWebExchange exchange,        │
│                               WebFilterChain chain) {            │
│          log.info("요청: {}", exchange.getRequest().getPath());   │
│          return chain.filter(exchange)                            │
│                      .doOnSuccess(v -> log.info("완료"));        │
│      }                                                           │
│  }                                                               │
│                                                                   │
│  기존 Servlet Filter와의 차이:                                   │
│  ├── 블로킹 없이 비동기 체인 실행                                │
│  ├── Reactor 스트림 안에서 자연스럽게 조합                       │
│  └── 논블로킹 I/O와 완벽 호환                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 gRPC 인터셉터 (2016)

```
┌─────────────────────────────────────────────────────────────────┐
│              gRPC 인터셉터                                        │
│                                                                   │
│  Google 공개, HTTP가 아닌 RPC 프로토콜에서의 인터셉션            │
│                                                                   │
│  4가지 타입:                                                     │
│  ┌────────────────┬──────────────────┬────────────────────┐     │
│  │                │ 서버 (Server)    │ 클라이언트 (Client)│     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ Unary          │ UnaryServer      │ UnaryClient        │     │
│  │ (단일 요청)    │ Interceptor      │ Interceptor        │     │
│  ├────────────────┼──────────────────┼────────────────────┤     │
│  │ Streaming      │ StreamServer     │ StreamClient       │     │
│  │ (스트리밍)     │ Interceptor      │ Interceptor        │     │
│  └────────────────┴──────────────────┴────────────────────┘     │
│                                                                   │
│  특징:                                                           │
│  ├── 양방향 스트리밍 지원                                        │
│  ├── 메타데이터(HTTP 헤더 대응) 조작                             │
│  └── 서버/클라이언트 양쪽 모두에서 인터셉션 가능                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 11.4 서비스 메시 사이드카 (Envoy/Istio)

```
┌─────────────────────────────────────────────────────────────────┐
│              서비스 메시: 인프라 레벨 인터셉션                    │
│                                                                   │
│  POSA2 Interceptor의 궁극적 진화                                 │
│  "코드 수정 없이" 인프라 레벨에서 모든 것을 가로채기             │
│                                                                   │
│  동작 방식:                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  서비스 A                        서비스 B               │    │
│  │  ┌──────────┐  ┌──────────┐     ┌──────────┐           │    │
│  │  │   App    │──│  Envoy   │─────│  Envoy   │──│ App │  │    │
│  │  │          │  │ (Sidecar)│     │ (Sidecar)│  │     │  │    │
│  │  └──────────┘  └──────────┘     └──────────┘  └─────┘  │    │
│  │                                                          │    │
│  │  iptables로 모든 트래픽을 Envoy 프록시로 리다이렉트     │    │
│  │  앱은 Envoy의 존재를 모름 (완벽한 투명성)               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  제공 기능 (코드 변경 없이):                                     │
│  ├── mTLS (상호 TLS 인증)                                        │
│  ├── 로드밸런싱                                                  │
│  ├── 서킷브레이커                                                │
│  ├── 재시도 (Retry)                                              │
│  ├── 분산 트레이싱                                               │
│  └── 트래픽 관찰 (Observability)                                 │
│                                                                   │
│  의의:                                                           │
│  인터셉터 패턴이 코드 레벨 → 프레임워크 레벨 → 인프라 레벨로    │
│  진화한 최종 형태                                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 12. 실무 교훈과 장애 사례

```
┌─────────────────────────────────────────────────────────────────┐
│              실제 장애 사례와 교훈                                │
│                                                                   │
│  사례 1: "4시간짜리 한 줄 수정"                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  증상: 특정 API에서 간헐적으로 403 Forbidden 반환        │    │
│  │  원인: 미들웨어 순서가 뒤바뀌어 있었음                   │    │
│  │        Authorization이 Authentication보다 먼저 실행      │    │
│  │  수정: 미들웨어 등록 순서 한 줄 변경                     │    │
│  │  소요: 원인 파악에 4시간                                 │    │
│  │                                                          │    │
│  │  교훈: 순서 의존성 버그는 에러 없이 조용히 발생하므로    │    │
│  │        디버깅이 매우 어렵다                               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  사례 2: Angular "부족 지식 문제"                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  증상: 새로 합류한 팀원이 HTTP 인터셉터 동작을           │    │
│  │        이해하지 못해 같은 로직을 서비스에 중복 구현       │    │
│  │  원인: 인터셉터는 코드에서 명시적으로 보이지 않아         │    │
│  │        존재 자체를 파악하기 어려움                        │    │
│  │                                                          │    │
│  │  교훈: 인터셉터의 투명성은 장점이자 단점                  │    │
│  │        팀 전체가 아키텍처를 공유해야 함                   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  사례 3: ASP.NET 스트림 재진입 문제                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  증상: 미들웨어에서 Request Body를 읽은 후               │    │
│  │        다음 미들웨어/핸들러에서 빈 본문                   │    │
│  │  원인: HTTP 요청 스트림은 한 번만 읽을 수 있음           │    │
│  │        (Stream이 소진되면 되감기 필요)                    │    │
│  │  수정: EnableBuffering()으로 스트림 재읽기 허용           │    │
│  │                                                          │    │
│  │  교훈: 미들웨어 간 공유 자원(스트림 등) 관리에 주의      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  사례 4: Vercel "60-70ms 미들웨어 세금"                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  증상: 모든 요청에 60-70ms 지연 추가                     │    │
│  │  원인: Edge Middleware가 모든 요청을 거침                 │    │
│  │  영향: 사용자 체감 성능 저하                              │    │
│  │                                                          │    │
│  │  교훈: 미들웨어는 "무료"가 아님                           │    │
│  │        적용 범위를 신중하게 제한해야 함                   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  사례 5: NestJS 생명주기 복잡성                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  NestJS 요청 처리 순서:                                  │    │
│  │  Middleware → Guard → Interceptor(전) → Pipe →          │    │
│  │  Handler → Interceptor(후) → ExceptionFilter            │    │
│  │                                                          │    │
│  │  증상: 각 계층의 역할과 실행 순서 혼동으로               │    │
│  │        로직이 잘못된 계층에 배치                          │    │
│  │                                                          │    │
│  │  교훈: 프레임워크의 생명주기를 정확히 이해하고           │    │
│  │        각 계층에 적합한 책임만 부여해야 함                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 의사결정 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│          "Interceptor/Middleware를 사용해야 할까?"                │
│                                                                   │
│  Step 1: 횡단 관심사인가?                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  횡단 관심사 (미들웨어 적합):                            │    │
│  │  ├── 인증/인가 (Authentication/Authorization)            │    │
│  │  ├── 요청/응답 로깅                                      │    │
│  │  ├── CORS 처리                                           │    │
│  │  ├── 압축 (gzip)                                         │    │
│  │  ├── 레이트 리밋                                         │    │
│  │  ├── 요청 ID 부여 (트레이싱)                             │    │
│  │  └── 에러 핸들링                                         │    │
│  │                                                          │    │
│  │  비즈니스 로직 (미들웨어 부적합):                        │    │
│  │  ├── 주문 검증 규칙                                      │    │
│  │  ├── 할인 계산                                           │    │
│  │  ├── 재고 확인                                           │    │
│  │  └── 비즈니스 이벤트 처리                                │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Step 2: 적용 범위는?                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  전체 엔드포인트 → 전역 미들웨어                         │    │
│  │  특정 경로 그룹  → 라우트 레벨 미들웨어                  │    │
│  │  특정 메서드     → AOP 또는 데코레이터 고려              │    │
│  │  HTTP 밖에서도   → AOP 선택                              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Step 3: 어떤 메커니즘을 선택할까?                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Spring 생태계:                                          │    │
│  │  ├── 인코딩/보안 등 저수준 → Servlet Filter             │    │
│  │  ├── 컨트롤러 전후 처리   → HandlerInterceptor          │    │
│  │  ├── 메서드 레벨 관심사   → AOP (@Aspect)               │    │
│  │  └── 리액티브 스택       → WebFilter                     │    │
│  │                                                          │    │
│  │  Node.js 생태계:                                         │    │
│  │  ├── 전역 관심사         → app.use() 미들웨어            │    │
│  │  ├── 라우트별 관심사     → 라우트 미들웨어               │    │
│  │  └── 응답 가공 필요 시   → Koa 양파 모델                 │    │
│  │                                                          │    │
│  │  마이크로서비스:                                         │    │
│  │  ├── 서비스 간 공통 관심사 → 서비스 메시 (Istio/Envoy)  │    │
│  │  └── gRPC 통신            → gRPC 인터셉터               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  체크리스트:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  미들웨어 도입 전 확인:                                  │    │
│  │  [ ] 횡단 관심사인가? (비즈니스 로직이 아닌가?)          │    │
│  │  [ ] 순서 의존성이 문서화되어 있는가?                    │    │
│  │  [ ] 성능 영향을 측정했는가?                             │    │
│  │  [ ] 전역/로컬 스코프를 적절히 설정했는가?               │    │
│  │  [ ] 미들웨어 간 숨겨진 결합은 없는가?                   │    │
│  │  [ ] 팀 전체가 미들웨어 체인을 이해하고 있는가?          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 14. 참고 자료

```
┌─────────────────────────────────────────────────────────────────┐
│                    참고 자료                                      │
│                                                                   │
│  학술 문헌:                                                      │
│  ├── Gamma, Helm, Johnson, Vlissides                             │
│  │   "Design Patterns: Elements of Reusable Object-Oriented     │
│  │    Software" (1994) - Chain of Responsibility                 │
│  │                                                               │
│  ├── Buschmann, Meunier, Rohnert, Sommerlad, Stal               │
│  │   "Pattern-Oriented Software Architecture Vol.1" (1996)       │
│  │   - Pipes and Filters                                         │
│  │                                                               │
│  ├── Schmidt, Stal, Rohnert, Buschmann                           │
│  │   "Pattern-Oriented Software Architecture Vol.2" (2000)       │
│  │   - Interceptor Pattern                                       │
│  │                                                               │
│  ├── Alur, Crupi, Malks                                          │
│  │   "Core J2EE Patterns" (2001) - Intercepting Filter           │
│  │                                                               │
│  └── Rod Johnson                                                 │
│      "Expert One-on-One J2EE Design and Development" (2002)      │
│                                                                   │
│  표준 명세:                                                      │
│  ├── JSR-053: Java Servlet 2.3 (Danny Coward, 2000-2001)        │
│  ├── PEP 333: Python WSGI (2003)                                 │
│  └── CORBA Portable Interceptor Specification                    │
│                                                                   │
│  프레임워크 역사:                                                │
│  ├── Express.js - TJ Holowaychuk (2010)                          │
│  ├── Koa.js - TJ Holowaychuk (2013)                              │
│  ├── Ruby on Rails - DHH (2004)                                  │
│  ├── Django - Adrian Holovaty, Simon Willison (2003/2005)        │
│  ├── Spring Framework - Rod Johnson (2003/2004)                  │
│  ├── ASP.NET MVC - Scott Guthrie (2007/2009)                    │
│  ├── Rack - Christian Neukirchen (2007)                          │
│  ├── WebWork/XWork - Rickard Oberg, Patrick Lightbody (2002)    │
│  └── gRPC - Google (2016)                                        │
│                                                                   │
│  비평 및 분석:                                                   │
│  ├── Ben Nadel - HTTP 인터셉터의 전역 상태 문제 분석             │
│  ├── Richard Marmorstein - "Beware Middleware"                    │
│  └── Vercel - Edge Middleware 성능 이슈 사례                     │
│                                                                   │
│  어원 자료:                                                      │
│  ├── intercipere (라틴어) - inter- + capere                      │
│  ├── Proto-Indo-European *kap- "붙잡다"                          │
│  ├── 영어 interceptor 최초 기록: 1590년대                        │
│  └── "Middleware" 최초 사용: 1968 NATO Software Engineering      │
│      Conference (Alex d'Agapeyeff)                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```
