---
layout: single
title: "Intent와 Execution의 분리 완전 가이드"
date: 2026-03-28 23:00:00 +0900
categories: backend
excerpt: "Intent와 Execution 분리는 무엇과 방법을 분리해 이식성·교체성·최적화를 높이는 설계 원리다."
toc: true
toc_sticky: true
tags: [intent, execution, architecture, declarative, patterns]
---

## TL;DR

- Intent(무엇)와 Execution(어떻게)를 분리하면 시스템 변경 비용과 결합도를 크게 낮출 수 있다.
- SQL, Kubernetes, React, Terraform, AI Agent까지 서로 다른 기술의 공통 기반 원리는 동일하다.
- 핵심은 선언적 Intent 계약을 안정적으로 유지하고, 실행 계층은 독립적으로 최적화·교체 가능하게 설계하는 것이다.

## 1. 개념

Intent/Execution 분리는 요구사항의 **의도(What)** 와 구현의 **절차(How)** 를 분리하는 아키텍처 원리다. 이 원리를 적용하면 호출자와 실행자의 책임 경계가 명확해지고, 시스템은 동일한 Intent를 서로 다른 실행 전략으로 처리할 수 있다.

## 2. 배경

초기 소프트웨어는 기계어·어셈블리 중심으로 작성되어 Intent와 Execution이 강하게 결합되어 있었다. 이 방식은 하드웨어 종속성, 낮은 이식성, 어려운 유지보수, 제한된 최적화라는 문제를 반복적으로 만들었고, 이를 해결하기 위해 선언적 접근과 추상화 계층이 발전했다.

## 3. 이유

분리를 채택하는 이유는 명확하다. 첫째, 실행 엔진을 바꿔도 상위 의도를 재사용할 수 있어 이식성이 높다. 둘째, 구현 교체와 성능 최적화를 독립적으로 수행할 수 있다. 셋째, 테스트·감사·확장 설계가 단순해져 대규모 시스템 운영 안정성이 좋아진다.

## 4. 특징

- 선언적 인터페이스(스키마/프로토콜) 중심의 계약 설계
- 실행 계층의 교체 가능성 및 지연 바인딩
- Reconciliation, Idempotency 같은 운영 친화적 제어 메커니즘
- 도메인 간 재사용 가능한 공통 패턴(Policy/Mechanism, Command/Handler 등)
- 관측성/감사 가능성 강화를 통한 운영 투명성 확보

## 5. 상세 내용

> **"무엇을 원하는가(What)"와 "어떻게 달성하는가(How)"의 분리.**
> 코드 한 줄부터 OS 커널, 클라우드 인프라, AI 에이전트까지 모든 추상화 수준에서 반복적으로 재발견된 근본 원리.

---

## 목차

1. [개요](#1-개요)
2. [용어 사전 (Terminology)](#2-용어-사전-terminology)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원과 학술적 기반](#4-역사적-기원과-학술적-기반)
5. [대안 비교: Intent/Execution 분리 구현 패턴들](#5-대안-비교-intentexecution-분리-구현-패턴들)
6. [효과적인 상황 분석](#6-효과적인-상황-분석)
7. [실전 베스트 프랙티스](#7-실전-베스트-프랙티스)
8. [안티패턴](#8-안티패턴)
9. [빅테크 실전 사례](#9-빅테크-실전-사례)
10. [소프트웨어를 넘어: 다른 분야의 Intent/Execution 분리](#10-소프트웨어를-넘어-다른-분야의-intentexecution-분리)
11. [미래 전망](#11-미래-전망)
12. [마이그레이션 가이드](#12-마이그레이션-가이드)
13. [핵심 요약](#13-핵심-요약)
14. [참고 문헌](#14-참고-문헌)

---

## 1. 개요

소프트웨어 공학의 모든 주요 발전은 하나의 질문으로 수렴한다:

> **"무엇을 원하는가"와 "어떻게 달성하는가"를 어떻게 분리할 것인가?**

이 원리는 놀랍도록 보편적이다. SQL이 쿼리(intent)와 실행 계획(execution)을 분리하고, Kubernetes가 Desired State(intent)와 Reconciliation Controller(execution)를 분리하고, React가 JSX(intent)와 Virtual DOM Reconciliation(execution)을 분리하며, LLM Agent가 Planning(intent)과 Tool Execution(execution)을 분리한다. 형태는 다르지만 구조는 동일하다.

```
+-------------------+     Contract     +--------------------+
|   Intent Layer    | ───────────────> |  Execution Layer   |
|                   |                  |                    |
|  "무엇을 원하는가"  |   (interface,    |  "어떻게 달성하는가" |
|  What to achieve  |    schema,       |  How to achieve    |
|                   |    protocol)     |                    |
+-------------------+                  +--------------------+
        |                                       |
        v                                       v
  - SQL Query                            - Query Optimizer
  - K8s Manifest                         - Controller Loop
  - React JSX                            - Reconciliation
  - LLM Plan                             - Tool Execution
  - REST Request                         - Server Handler
  - Terraform HCL                        - Provider Plugin
  - Payment Intent                       - Payment Processor
```

이 분리가 가져다주는 핵심 가치:

| 가치 | 설명 | 예시 |
|------|------|------|
| **이식성** | Intent가 특정 Execution에 종속되지 않음 | SQL 쿼리가 MySQL/PostgreSQL/Oracle에서 동작 |
| **교체 가능성** | Execution을 독립적으로 교체/업그레이드 | K8s에서 Docker → containerd 전환 |
| **최적화 가능성** | Execution 계층이 자율적으로 최적화 | SQL Optimizer가 실행 계획 자동 선택 |
| **테스트 용이성** | Intent와 Execution을 독립적으로 테스트 | Mock Executor로 Intent 로직만 테스트 |
| **감사 가능성** | Intent를 기록하여 "왜 이 작업이 발생했는가" 추적 | Event Sourcing, Audit Log |
| **확장성** | Intent 생산과 Execution 소비를 독립적으로 확장 | Message Queue로 비동기 처리 |

이 문서는 이 원리의 학술적 기원부터 빅테크 실전 사례, 13개의 구현 패턴, 안티패턴, 그리고 AI 시대의 미래 전망까지를 체계적으로 정리한다.

---

## 2. 용어 사전 (Terminology)

Intent와 Execution의 분리를 논의할 때 등장하는 핵심 용어들을 정리한다. 이 용어들은 서로 다른 도메인에서 같은 원리를 표현하기 위해 독립적으로 발명되었다.

| 용어 | 어원/기원 | 정의 | 대표 사용처 |
|------|-----------|------|-------------|
| **Intent** | 라틴어 *intendere* (뻗다, 향하다) | 시스템이 달성해야 할 목표의 서술(description of goal). 구체적 실행 방법은 포함하지 않음 | Android Intent, Payment Intent, IBN |
| **Execution** | 라틴어 *exsequi* (수행하다, 따르다) | 주어진 목표를 달성하기 위한 단계적 절차(step-by-step procedure). 구체적 구현을 포함 | Runtime, Executor, Worker |
| **Declarative** | 라틴어 *declarare* (명확하게 하다) | "무엇을(What)" 달성할 것인지 선언하는 방식. 결과 상태를 기술하되 과정은 시스템에 위임 | SQL, HTML, K8s YAML, Terraform HCL |
| **Imperative** | 라틴어 *imperare* (명령하다). *emperor*와 같은 어원 | "어떻게(How)" 수행할 것인지 단계별로 지시하는 방식. 실행 절차를 명시적으로 제어 | C, Java, Python (절차적 코드) |
| **Desired State** | Kubernetes(2014)가 대중화 | 시스템이 도달해야 할 목표 상태. 현재 상태(Current State)와의 차이(diff)를 시스템이 자동으로 해소 | K8s, Terraform, Puppet |
| **Current State** | Desired State와 쌍 | 시스템의 현재 실제 상태. Reconciliation Loop가 이를 Desired State에 맞춤 | K8s etcd, Terraform State |
| **Policy** | Brinch Hansen(1969), Lampson(1976) | "무엇이 허용/금지되는가"의 규칙(rule). 구체적 집행 방법은 포함하지 않음 | OPA/Rego, IAM Policy, Network Policy |
| **Mechanism** | Policy와 쌍 | Policy를 집행하는 엔진(engine). Policy가 변경되어도 Mechanism은 불변 | OPA Runtime, iptables, SELinux |
| **Command** | GoF Command Pattern(1994) | 요청(request)을 객체로 캡슐화한 것. 요청의 발행자와 수행자를 디커플링 | CQRS Command, GoF Command |
| **Handler** | Command와 쌍 | Command를 받아 실제로 수행하는 주체(executor). Command 하나에 Handler 하나 매핑이 일반적 | Command Handler, Message Handler |
| **What vs How** | SQL(1974-86)이 대중화 | Intent/Execution 분리의 가장 직관적 표현. "What을 기술하면 How는 시스템이 결정" | SQL, 선언적 프로그래밍 전반 |
| **Intent-based** | 복수 도메인에서 독립 발생 | Intent를 명시적으로 선언하고 시스템이 자율적으로 실행하는 패러다임 | Intent-based Networking(Cisco 2017), Android Intent(Late Binding), K8s |
| **Reconciliation** | Kubernetes Controller | Desired State와 Current State의 차이를 지속적으로 해소하는 반복 루프 | K8s Controller, Terraform Plan/Apply |
| **Idempotency** | 수학 *f(f(x)) = f(x)* | 같은 Intent를 여러 번 실행해도 결과가 동일함. 분리 아키텍처에서 필수적 | REST PUT, K8s Apply, Event Handler |

### 용어 간 관계도

```
Intent(What)                          Execution(How)
   |                                       |
   +-- Declarative                         +-- Imperative
   |     +-- Desired State                 |     +-- Current State
   |     +-- Policy                        |     +-- Mechanism
   |     +-- Command                       |     +-- Handler
   |                                       |
   +-- 속성                                +-- 속성
         +-- Idempotent                          +-- Reconciliation
         +-- Versioned                           +-- Observable
         +-- Auditable                           +-- Replaceable
```

### Declarative vs Imperative: 핵심 차이

```python
# Imperative: "어떻게" 수행할 것인지 단계별 지시
results = []
for item in items:
    if item.price > 100:
        results.append(item.name)
results.sort()

# Declarative: "무엇을" 원하는지 선언
results = sorted(
    item.name for item in items if item.price > 100
)
```

```sql
-- Declarative (SQL): "무엇을" 원하는지만 선언
SELECT name FROM items WHERE price > 100 ORDER BY name;

-- 실행 방법(Index Scan? Full Scan? Hash Join?)은 Query Optimizer가 결정
```

```yaml
# Declarative (Kubernetes): Desired State 선언
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
spec:
  replicas: 3          # "3개의 replica를 원한다" (Intent)
  selector:            # "어떻게 3개를 유지할 것인가"는
    matchLabels:       # Controller가 결정 (Execution)
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
```

---

## 3. 등장 배경과 이유

### 3.1 기계어/어셈블리 시대: Intent와 Execution의 완전한 융합

컴퓨터의 초창기에는 Intent와 Execution이 구분 자체가 불가능했다. 프로그래머가 작성하는 코드가 곧 기계가 실행하는 명령이었다.

```asm
; 1950년대 어셈블리: "배열에서 최대값을 찾아라"라는 Intent를
; 레지스터 조작과 메모리 주소로 직접 표현해야 했다
        MOV  CX, [array_len]    ; 카운터 설정
        LEA  SI, [array]         ; 배열 시작 주소
        MOV  AX, [SI]           ; 첫 번째 요소를 최대값으로
next:   ADD  SI, 2              ; 다음 요소로 이동
        CMP  [SI], AX           ; 현재 요소와 비교
        JLE  skip               ; 작거나 같으면 건너뜀
        MOV  AX, [SI]           ; 더 크면 최대값 갱신
skip:   LOOP next               ; 반복
```

이 코드에서 "배열의 최대값을 구하라"는 Intent는 어디에도 명시적으로 드러나지 않는다. 레지스터 이름, 메모리 주소, 점프 명령어 속에 Intent가 매몰되어 있다.

### 3.2 4가지 핵심 문제

Intent와 Execution이 뒤섞인 코드는 다음 4가지 근본적 문제를 야기했다:

#### (1) 이식성 결여 (Non-Portability)

```
[프로그래머] --작성--> [IBM 7090 기계어]
                             |
                     IBM 7090에서만 실행 가능
                             |
                     DEC PDP-1로 이전 시
                     전체 코드 재작성 필요
```

- 특정 하드웨어의 레지스터, 명령어 세트에 종속
- 새로운 하드웨어로 이전 시 전체 재작성
- 동일한 비즈니스 로직을 플랫폼마다 반복 구현

#### (2) 유지보수 불가 (Unmaintainability)

```
변경 요청: "최대값 대신 상위 3개를 구하라"
    |
    +-- 어셈블리: 알고리즘 전체 재설계
    |   (레지스터 할당, 메모리 레이아웃, 비교 로직 모두 변경)
    |
    +-- SQL: SELECT value FROM items ORDER BY value DESC LIMIT 3
        (Intent만 변경, Execution은 DB가 알아서)
```

- "무엇을 하는 코드인가"를 파악하는 데 대부분의 시간 소모
- 변경의 영향 범위 예측 불가 (Intent가 Execution 전체에 분산)
- 새로운 개발자 온보딩에 극도의 시간 소요

#### (3) 최적화 불가 (No Optimization Opportunity)

- 프로그래머가 작성한 실행 순서가 곧 실제 실행 순서
- 하드웨어가 발전해도 코드를 재작성하지 않으면 성능 향상 없음
- 병렬화, 캐싱, 인덱싱 등의 자동 최적화 기회 상실

```
Intent/Execution 분리 전:
  [프로그래머] ---> [기계어] ---> [CPU]
                   (1:1 대응, 최적화 여지 없음)

Intent/Execution 분리 후:
  [프로그래머] ---> [SQL Query] ---> [Query Optimizer] ---> [Execution Plan] ---> [CPU]
                   (Intent)         (자동 최적화)          (최적 Execution)
```

#### (4) 확장성 한계 (Scalability Limit)

- 단일 프로그래머가 전체 시스템의 모든 세부사항을 이해해야 함
- 팀 분업 불가 (Intent와 Execution이 분리되지 않으면 역할 분리도 불가)
- 시스템 규모가 커질수록 복잡도가 지수적으로 증가

### 3.3 Von Neumann Bottleneck: Backus의 비판

John Backus는 1977년 Turing Award 수상 강연 *"Can Programming Be Liberated from the von Neumann Style?"* 에서 핵심 문제를 지적했다:

> *"Von Neumann 언어는 프로그래머의 사고를 한 번에 한 단어(word)씩 처리하는 기계 수준에 묶어둔다. 변수에 값을 할당하는(assignment) 방식이 프로그래밍의 근본적 한계를 만든다."*

Backus의 비판 구조:

```
Von Neumann Style (Imperative)
  |
  +-- 변수 할당(assignment)이 핵심 메커니즘
  |     |
  |     +-- 프로그래머가 "어떻게" 계산할지를 단계별로 기술
  |     +-- Intent가 Execution 세부사항에 매몰
  |     +-- "한 번에 한 단어" 병목 (bottleneck)
  |
  +-- Backus의 대안: Functional Programming
        |
        +-- 함수 합성(composition)이 핵심 메커니즘
        +-- "무엇을" 계산할지를 선언
        +-- Execution은 런타임이 결정
        +-- 병렬화 등 최적화 자유도 확보
```

Backus는 함수형 프로그래밍(FP)을 통해 프로그래머를 Execution 세부사항에서 해방시키고, Intent 수준에서 사고할 수 있게 해야 한다고 주장했다. 이는 Intent/Execution 분리의 이론적 정당성을 제공한 중요한 학술적 기여다.

### 3.4 Software Crisis (1968)

NATO Software Engineering Conference(1968, Garmisch, 독일)에서 공식적으로 "소프트웨어 위기(Software Crisis)"가 선언되었다:

- 대규모 프로젝트의 70% 이상이 실패하거나 지연
- 하드웨어 성능은 기하급수적으로 발전하지만 소프트웨어 생산성은 정체
- OS/360 프로젝트: 5,000 인년 투입, 예산 초과, 수천 개의 버그

이 위기의 근본 원인 중 하나가 바로 Intent와 Execution의 미분리였다:

```
Software Crisis의 근본 원인 분석:

[복잡도 폭발]
    |
    +-- 원인 1: Intent/Execution 미분리
    |     "무엇을 해야 하는가"와 "어떻게 하는가"가 뒤섞여
    |     변경 영향 범위 예측 불가
    |
    +-- 원인 2: 추상화 부재
    |     모든 것을 가장 낮은 수준에서 기술
    |
    +-- 원인 3: 재사용 불가
    |     특정 Execution에 종속된 코드는 다른 컨텍스트에서 재사용 불가
    |
    +-- 결과: 70%+ 프로젝트 실패
```

이 위기에 대한 학술 커뮤니티의 대응이 곧 Dijkstra의 Separation of Concerns, Parnas의 Information Hiding, Backus의 FP 등 Intent/Execution 분리의 학술적 기반을 형성했다.

---

## 4. 역사적 기원과 학술적 기반

### 4.1 학술적 기반

#### Dijkstra의 Separation of Concerns (1974, EWD447)

Edsger Dijkstra는 1974년 "On the role of scientific thought"(EWD447)에서 **Separation of Concerns(관심사의 분리)** 를 공식적으로 제안했다.

> *"Let me try to explain to you, what to my taste is characteristic for all intelligent thinking. It is, that one is willing to study in depth an aspect of one's subject matter in isolation for the sake of its own consistency, all the time knowing that one is occupying oneself only with one of the aspects."*

핵심 주장:

- **인식론적(epistemological) 주장**: 인간의 인지 능력에는 한계가 있으므로, 한 번에 하나의 관심사만 다루어야 한다
- **분리의 대상**: 기능적 관심사(functional), 시간적 관심사(temporal), 추상화 수준(abstraction level)
- **근본 통찰**: "What"과 "How"의 분리는 Separation of Concerns의 가장 근본적인 형태

```
Dijkstra의 분리 계층:

[관심사 1: What (Intent)]     ←→    [관심사 2: How (Execution)]
       |                                      |
  "배열을 정렬하라"                    "QuickSort를 사용하라"
  "메일을 보내라"                     "SMTP를 통해 보내라"
  "3개의 인스턴스를 유지하라"          "Controller Loop로 유지하라"
```

Dijkstra의 기여는 Intent/Execution 분리가 단순한 엔지니어링 기법이 아니라, **인간 인지의 한계에 대한 근본적 대응**임을 밝힌 것이다.

#### Parnas의 Information Hiding (1972)

David Parnas는 1972년 *"On the Criteria To Be Used in Decomposing Systems into Modules"* 에서 **Information Hiding(정보 은닉)** 원칙을 제안했다.

핵심 주장:

- 모듈 분해의 기준은 "변경 가능성이 높은 설계 결정(design decision)을 숨기는 것"
- 각 모듈은 하나의 "비밀(secret)"을 캡슐화해야 함
- **모듈의 인터페이스 = Intent**, **모듈의 내부 구현 = Execution**

```
Parnas 이전 (기능적 분해):
  Module A: [Input 처리 + 저장소 접근 + 출력 포맷팅]
  Module B: [Input 검증 + 비즈니스 로직 + 에러 처리]
  → 변경 시 여러 모듈에 걸쳐 수정 필요

Parnas 이후 (정보 은닉):
  Module A: [저장소 접근]  ← 비밀: 저장소 형태 (DB? File? API?)
  Module B: [출력 포맷팅]  ← 비밀: 출력 형식 (JSON? XML? CSV?)
  Module C: [비즈니스 로직] ← 비밀: 규칙 세부사항
  → 각 모듈의 "비밀"이 변경되어도 인터페이스(Intent)는 불변
```

이는 Intent/Execution 분리의 **모듈 수준 구현**에 대한 이론적 토대를 제공했다.

#### Backus의 Von Neumann 해방 (1977/1978)

앞서 3.3절에서 소개한 Backus의 Turing Award 강연은 학술적으로 다음을 기여했다:

- **FP(Functional Programming)가 Intent/Execution 분리의 프로그래밍 언어 수준 구현**임을 이론적으로 정립
- 함수 합성(composition), 고차 함수(higher-order function)를 통해 "What"을 기술하는 새로운 방법론 제시
- "변수 할당 없는 프로그래밍"이라는 급진적 제안으로 Declarative Programming의 학술적 정당성 확보

#### Brinch Hansen의 RC 4000 Nucleus (1969/1970)

Per Brinch Hansen은 RC 4000 컴퓨터의 운영체제 커널(Nucleus)을 설계하면서 **Policy-Mechanism 분리**의 원형을 만들었다.

핵심 설계:

```
RC 4000 Nucleus:
  +-- Mechanism Layer (Nucleus)
  |     +-- 프로세스 생성/삭제
  |     +-- 메시지 전달
  |     +-- 메모리 할당
  |     (범용 메커니즘만 제공, 정책은 포함하지 않음)
  |
  +-- Policy Layer (User Programs)
        +-- 스케줄링 정책
        +-- 파일 시스템 정책
        +-- 접근 제어 정책
        (Nucleus의 메커니즘을 사용하여 정책을 구현)
```

이 설계는 다음 원칙을 확립했다:
- **Mechanism은 정책에 무관해야 한다** (policy-free)
- **Policy는 Mechanism 위에 구축되어야 한다**
- **Mechanism이 변경되지 않아도 Policy만으로 시스템 동작을 변경할 수 있어야 한다**

#### Lampson의 Hints for Computer System Design (1983)

Butler Lampson은 1983년 *"Hints for Computer System Design"* 에서 시스템 설계의 실용적 원칙들을 정리했다. 1976년에 Sturgis와 함께 "Policy-Mechanism" 용어를 공식화한 것을 발전시켜, 다음 원칙을 제시했다:

> *"Separate mechanism from policy... Mechanism should not dictate or overly constrain policy."*

Lampson의 실용적 원칙들:

| 원칙 | Intent/Execution 분리와의 관계 |
|------|-------------------------------|
| Do one thing at a time, and do it well | 각 계층이 하나의 관심사에 집중 |
| Don't generalize | Intent 계층이 불필요하게 추상화되면 안 됨 |
| Separate data from control | Intent(data)와 Execution(control) 분리 |
| Use a good interface | Contract 설계의 중요성 |
| Separate normal from worst case | Happy Path(Intent 성공)와 Error(Execution 실패) 분리 |

#### Meyer의 Command-Query Separation (1988)

Bertrand Meyer는 1988년 *"Object-Oriented Software Construction"* 에서 **Command-Query Separation(CQS)** 원칙을 제안했다:

> *"Every method should either be a command that performs an action, or a query that returns data to the caller, but not both."*

```
CQS 원칙:
  Command (상태 변경, 반환값 없음) = Intent to Change
  Query   (상태 불변, 반환값 있음) = Intent to Read

  [금지] getAndIncrementCounter()  ← Query + Command 혼합
  [허용] getCounter()              ← Query만
  [허용] incrementCounter()        ← Command만
```

CQS는 Intent를 **읽기 의도(Query)**와 **쓰기 의도(Command)**로 분류하여, 각각의 Execution을 독립적으로 최적화할 수 있게 했다.

#### Greg Young의 CQRS + Event Sourcing (2010)

Greg Young은 Meyer의 CQS를 **아키텍처 수준**으로 확장하여 CQRS(Command Query Responsibility Segregation)를 제안했다(2003년경 개념 제시, 2010년경 공식화):

```
CQS (메서드 수준):
  Object.getX()     → Query
  Object.doY()      → Command

CQRS (아키텍처 수준):
  [Write Model] ← Command(Intent) → [Command Handler(Execution)]
  [Read Model]  ← Query(Intent)   → [Query Handler(Execution)]

  + Event Sourcing: Command의 결과를 Event로 기록
    → Intent의 이력을 영구적으로 보존
    → 시간 여행(time travel) 가능
```

CQRS + Event Sourcing은 Intent/Execution 분리를 시스템 아키텍처 수준에서 가장 명시적으로 구현한 패턴이다.

### 4.2 역사적 이정표 연대표

| 연도 | 이정표 | 핵심 기여 |
|------|--------|-----------|
| **1958** | McCarthy LISP & Advice Taker | 선언적 AI의 원형. "무엇을 알고 있는가"를 선언하면 시스템이 추론. 최초의 Intent/Execution 분리 시도 중 하나 |
| **1969-70** | Brinch Hansen RC 4000 Nucleus | Policy/Mechanism 분리의 원형. OS 커널이 범용 메커니즘만 제공하고 정책은 사용자 프로그램에 위임 |
| **1970** | Codd Relational Model | 데이터의 논리적 표현(Intent)과 물리적 저장(Execution)의 분리를 이론적으로 정립. SQL의 기반 |
| **1972** | Colmerauer Prolog | 논리적 선언(Intent) → 추론은 런타임(Execution). "무엇이 참인가"를 선언하면 시스템이 증명을 탐색 |
| **1972** | Parnas Information Hiding | 모듈의 인터페이스(Intent)와 내부 구현(Execution)의 분리 기준 확립 |
| **1974** | Dijkstra Separation of Concerns (EWD447) | 관심사의 분리를 공식화. 인간 인지의 한계에 대한 인식론적 정당화 |
| **1974-86** | Chamberlin & Boyce SQL | Intent(쿼리)/Execution(실행 계획) 분리의 최초 대중적 성공. "What not How"를 수백만 개발자에게 전파 |
| **1976** | Lampson & Sturgis | "Policy-Mechanism" 용어의 공식화. OS 설계의 핵심 원칙으로 확립 |
| **1977-78** | Backus Turing Award Lecture | Von Neumann 스타일(Imperative)에서 함수형/선언적 접근으로의 전환 촉구. FP의 학술적 정당화 |
| **1983** | Lampson Hints for Computer System Design | 시스템 설계의 실용적 원칙 정리. Mechanism/Policy 분리를 실제 시스템에 적용하는 가이드라인 |
| **1988** | Meyer Command-Query Separation (CQS) | Intent를 Command(변경 의도)와 Query(조회 의도)로 분류. 메서드 수준의 분리 원칙 |
| **1993** | Burgess CFEngine | Desired State 기반 인프라 관리의 원조. Promise Theory를 기반으로 "시스템이 이러해야 한다"를 선언 |
| **1994** | GoF Design Patterns - Command Pattern | Intent를 객체로 캡슐화하는 패턴을 공식화. Undo/Redo, 큐잉, 로깅 가능 |
| **2000** | Fielding REST 논문 | 자원(Resource)의 상태 표현(Representation)과 전송 메커니즘(HTTP)의 분리. 웹 아키텍처의 기반 |
| **2003-10** | Greg Young CQRS + Event Sourcing | CQS를 아키텍처 수준으로 확장. Command(Intent)와 Query를 완전히 분리된 모델로 구현 |
| **2013** | Facebook React | 선언적 UI 패러다임의 대중화. JSX(Intent) → Virtual DOM Reconciliation(Execution) |
| **2014** | HashiCorp Terraform | 선언적 IaC(Infrastructure as Code)의 대중화. HCL(Intent) → Provider(Execution) → State Reconciliation |
| **2014** | Google Kubernetes | Desired State + Reconciliation Loop의 표준. Controller Pattern이 Intent/Execution 분리의 인프라 수준 구현 표준으로 자리잡음 |
| **2017** | Cisco Intent-Based Networking (IBN) / GitOps | 네트워크와 인프라에서 Intent 패러다임의 명시적 채택. "What"을 선언하면 시스템이 네트워크를 자동 구성 |
| **2020s** | AI Agents (LLM + Tool Use) | LLM Planning(Intent) → Tool Execution(Execution). 자연어가 Intent 표현 수단으로 부상 |

### 4.3 핵심 학술적 통찰

이 역사를 관통하는 핵심 통찰:

1. **독립적 재발견**: SQL(데이터베이스), K8s(인프라), React(UI), Command Pattern(OOP)이 각각 독립적으로 같은 원리를 재발견
2. **추상화 수준 상승**: 기계어 → 고급 언어 → SQL → DSL → 자연어로 Intent 표현 수준이 지속적으로 상승
3. **자동화 영역 확대**: 컴파일러 최적화 → 쿼리 최적화 → 인프라 자동화 → AI 자율 실행으로 Execution 자동화 범위가 확장
4. **불변의 구조**: 60년간 형태는 변했지만 "What과 How를 분리하라"는 원리 자체는 변하지 않음

---

## 5. 대안 비교: Intent/Execution 분리 구현 패턴들

Intent/Execution 분리라는 하나의 원리를 구현하는 방법은 다양하다. 이 섹션에서는 13개의 구현 패턴을 상세히 분석하고 비교한다.

### 5.1 패턴 A: Command Pattern (GoF)

**핵심 메커니즘**: Intent를 객체(Command)로 캡슐화한다. Command 객체는 수행할 작업의 모든 정보를 담고 있으며, Invoker(호출자)와 Receiver(수행자)를 디커플링한다.

```typescript
// Intent를 객체로 캡슐화
interface Command {
  execute(): void;
  undo(): void;
}

class CreateOrderCommand implements Command {
  constructor(
    private readonly orderId: string,
    private readonly items: OrderItem[],
    private readonly customerId: string,
  ) {}

  execute(): void {
    // Execution: 주문 생성 로직
    const order = Order.create(this.orderId, this.customerId, this.items);
    orderRepository.save(order);
    eventBus.publish(new OrderCreatedEvent(order));
  }

  undo(): void {
    // Execution: 주문 취소 로직
    orderRepository.delete(this.orderId);
    eventBus.publish(new OrderCancelledEvent(this.orderId));
  }
}

// Invoker: Command의 실행 시점을 제어
class CommandInvoker {
  private history: Command[] = [];

  executeCommand(command: Command): void {
    command.execute();
    this.history.push(command);
  }

  undoLast(): void {
    const command = this.history.pop();
    command?.undo();
  }
}
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Command 객체 (메서드 매개변수로 Intent 데이터 전달) |
| Execution 주체 | Command.execute() 메서드 내부 또는 별도 Handler |
| 분리 수준 | 메서드/클래스 수준 |
| 적용 규모 | 소규모 ~ 중규모 |
| 복잡도 | 낮음 |
| 장점 | Undo/Redo 지원, 큐잉 가능, 로깅/감사 용이, 매크로 구성 가능 |
| 단점 | 클래스 폭발 (Command마다 새 클래스), 단순한 경우 과도한 추상화 |

### 5.2 패턴 B: CQRS (Command Query Responsibility Segregation)

**핵심 메커니즘**: 시스템의 쓰기(Command)와 읽기(Query) 모델을 완전히 분리한다. Command 측은 비즈니스 로직과 유효성 검증에 집중하고, Query 측은 조회 최적화에 집중한다.

```typescript
// === Command Side (Write) ===

// Intent: 주문 생성 요청
interface CreateOrderCommand {
  readonly type: 'CreateOrder';
  readonly orderId: string;
  readonly customerId: string;
  readonly items: { productId: string; quantity: number }[];
}

// Execution: Command Handler
class CreateOrderHandler {
  async handle(command: CreateOrderCommand): Promise<void> {
    // 비즈니스 규칙 검증
    const customer = await this.customerRepo.findById(command.customerId);
    if (!customer.isActive()) throw new InactiveCustomerError();

    // Aggregate 생성 및 도메인 이벤트 발행
    const order = Order.create(command.orderId, customer, command.items);
    await this.orderRepo.save(order);

    // 이벤트 발행 → Read Model 업데이트 트리거
    await this.eventBus.publishAll(order.domainEvents);
  }
}

// === Query Side (Read) ===

// Intent: 주문 목록 조회 요청
interface GetOrdersQuery {
  readonly type: 'GetOrders';
  readonly customerId: string;
  readonly status?: OrderStatus;
  readonly page: number;
  readonly pageSize: number;
}

// Execution: Query Handler (별도의 읽기 최적화된 모델 사용)
class GetOrdersHandler {
  async handle(query: GetOrdersQuery): Promise<OrderListView> {
    // 읽기에 최적화된 denormalized view 사용
    return this.readDb.query(`
      SELECT * FROM order_list_view
      WHERE customer_id = $1
      AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `, [query.customerId, query.status, query.pageSize, query.page * query.pageSize]);
  }
}
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Command/Query 객체 (읽기/쓰기 Intent가 구조적으로 분리) |
| Execution 주체 | 별도의 Command Handler, Query Handler |
| 분리 수준 | 아키텍처 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 중간 ~ 높음 |
| 장점 | 독립적 확장(읽기/쓰기), 각 모델 최적화, 복잡한 도메인에 적합 |
| 단점 | Eventual Consistency 관리 필요, 동기화 지연, 운영 복잡도 증가 |

### 5.3 패턴 C: Event Sourcing

**핵심 메커니즘**: 상태를 직접 저장하는 대신, 상태 변경을 일으킨 Intent(Event)를 시간 순서대로 저장한다. 현재 상태는 이벤트를 순서대로 재생(replay)하여 재구성한다.

```python
from dataclasses import dataclass, field
from typing import List
from datetime import datetime
from enum import Enum

# Intent를 Event로 기록
@dataclass(frozen=True)
class OrderCreated:
    order_id: str
    customer_id: str
    items: list
    timestamp: datetime

@dataclass(frozen=True)
class OrderItemAdded:
    order_id: str
    product_id: str
    quantity: int
    timestamp: datetime

@dataclass(frozen=True)
class OrderConfirmed:
    order_id: str
    timestamp: datetime

# Aggregate: Event를 적용하여 현재 상태 재구성
class OrderAggregate:
    def __init__(self):
        self.order_id: str = ""
        self.status: str = "DRAFT"
        self.items: list = []
        self._uncommitted_events: List = []

    # Intent → Event 변환
    def create(self, order_id: str, customer_id: str, items: list):
        event = OrderCreated(
            order_id=order_id,
            customer_id=customer_id,
            items=items,
            timestamp=datetime.utcnow()
        )
        self._apply(event)
        self._uncommitted_events.append(event)

    def confirm(self):
        if self.status != "DRAFT":
            raise InvalidStateError("주문이 DRAFT 상태가 아닙니다")
        event = OrderConfirmed(
            order_id=self.order_id,
            timestamp=datetime.utcnow()
        )
        self._apply(event)
        self._uncommitted_events.append(event)

    # Event → 상태 변경 (Execution)
    def _apply(self, event):
        if isinstance(event, OrderCreated):
            self.order_id = event.order_id
            self.status = "DRAFT"
            self.items = event.items
        elif isinstance(event, OrderConfirmed):
            self.status = "CONFIRMED"

    # 이벤트 재생으로 상태 복원
    @staticmethod
    def from_events(events: List) -> 'OrderAggregate':
        aggregate = OrderAggregate()
        for event in events:
            aggregate._apply(event)
        return aggregate
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Event 객체 (과거 시제: "OrderCreated", "PaymentProcessed") |
| Execution 주체 | Aggregate가 Event를 적용하여 상태 변경 |
| 분리 수준 | 아키텍처 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 높음 |
| 장점 | 완전한 감사 이력, 시간 여행(time travel), 이벤트 기반 통합, 디버깅 용이 |
| 단점 | 이벤트 스키마 진화 어려움, 재생 성능, 최종 일관성 관리, 학습 곡선 |

### 5.4 패턴 D: Declarative Configuration (K8s, Terraform)

**핵심 메커니즘**: Desired State를 선언적 형식(YAML, HCL)으로 기술하고, 시스템이 Current State와 Desired State의 차이를 자동으로 해소(Reconciliation)한다.

```yaml
# Kubernetes: Desired State 선언 (Intent)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: production
spec:
  replicas: 3                    # "3개의 Pod을 원한다"
  strategy:
    type: RollingUpdate          # "롤링 업데이트로 배포하라"
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: payment
  template:
    metadata:
      labels:
        app: payment
    spec:
      containers:
      - name: payment
        image: payment:v2.1.0    # "이 이미지를 사용하라"
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
---
# Execution은 Controller가 자동으로:
# 1. Current State 조회 (현재 몇 개의 Pod이 실행 중인가?)
# 2. Desired State와 비교 (3개 원하는데 2개만 있으면 1개 추가)
# 3. 차이 해소 (새 Pod 생성, 오래된 Pod 제거)
# 4. 반복 (Reconciliation Loop)
```

```hcl
# Terraform: Desired State 선언 (Intent)
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"

  tags = {
    Name        = "web-server-${count.index}"
    Environment = "production"
  }
}

resource "aws_lb" "web" {
  name               = "web-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
}

# Execution: terraform plan → terraform apply
# 1. State 파일에서 Current State 로드
# 2. Desired State와 비교
# 3. 변경 계획(Plan) 생성
# 4. 사용자 승인 후 적용(Apply)
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | 선언적 설정 파일 (YAML, HCL, JSON) |
| Execution 주체 | Controller (K8s), Provider (Terraform) |
| 분리 수준 | 인프라 수준 |
| 적용 규모 | 대규모 |
| 복잡도 | 중간 |
| 장점 | 재현 가능성, 버전 관리, 드리프트 감지, 자동 복구 |
| 단점 | 학습 곡선, Declarative로 표현하기 어려운 절차, State 관리 복잡 |

### 5.5 패턴 E: Policy-Mechanism Separation (OPA/Rego)

**핵심 메커니즘**: 정책(Policy)과 집행 엔진(Mechanism)을 완전히 분리한다. 정책을 별도의 언어(Rego)로 기술하고, 범용 엔진(OPA)이 정책을 해석하여 결정을 내린다.

```rego
# Policy (Intent): "누가 무엇을 할 수 있는가" 선언
# Rego 언어로 작성

package authz

import rego.v1

# 기본적으로 거부
default allow := false

# 관리자는 모든 것을 허용
allow if {
    input.user.role == "admin"
}

# 일반 사용자는 자신의 리소스만 접근 가능
allow if {
    input.user.role == "user"
    input.resource.owner == input.user.id
}

# 읽기 전용 사용자는 GET만 허용
allow if {
    input.user.role == "viewer"
    input.action == "GET"
}
```

```go
// Mechanism (Execution): OPA 엔진이 정책을 해석
// 애플리케이션은 OPA에 질의만 하면 됨

func authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // OPA에 정책 질의 (Mechanism)
        input := map[string]interface{}{
            "user": map[string]interface{}{
                "id":   getUserID(r),
                "role": getUserRole(r),
            },
            "resource": map[string]interface{}{
                "path":  r.URL.Path,
                "owner": getResourceOwner(r),
            },
            "action": r.Method,
        }

        allowed, err := opaClient.Evaluate("authz/allow", input)
        if err != nil || !allowed {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Policy 언어 (Rego, Cedar, Polar) |
| Execution 주체 | Policy Engine (OPA, Cedar, Oso) |
| 분리 수준 | 시스템 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 중간 |
| 장점 | 정책의 독립적 변경, 감사 용이, 코드와 정책 분리, 테스트 가능 |
| 단점 | 새로운 언어 학습, 디버깅 어려움, 성능 오버헤드 |

### 5.6 패턴 F: Specification Pattern (DDD)

**핵심 메커니즘**: 비즈니스 규칙을 객체(Specification)로 캡슐화한다. 규칙의 조합(AND, OR, NOT)이 가능하며, 동일한 Specification을 검증, 조회, 생성 등 다양한 Execution에 재사용할 수 있다.

```typescript
// Specification: 비즈니스 규칙을 객체로 표현 (Intent)
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

abstract class CompositeSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

// 구체적 비즈니스 규칙들
class PremiumCustomerSpec extends CompositeSpecification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.totalPurchases > 10000 && customer.memberSince.getFullYear() < 2023;
  }
}

class ActiveSubscriptionSpec extends CompositeSpecification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.subscription?.isActive() ?? false;
  }
}

// 규칙 조합 (Intent 합성)
const eligibleForDiscount = new PremiumCustomerSpec()
  .and(new ActiveSubscriptionSpec());

// 다양한 Execution에 동일한 Specification 재사용
// 1. 검증: eligibleForDiscount.isSatisfiedBy(customer)
// 2. 조회: repository.findAll(eligibleForDiscount)
// 3. 카운트: repository.count(eligibleForDiscount)
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Specification 객체 (비즈니스 규칙의 객체화) |
| Execution 주체 | Repository, Validator, Factory 등 |
| 분리 수준 | 도메인 모델 수준 |
| 적용 규모 | 소규모 ~ 중규모 |
| 복잡도 | 중간 |
| 장점 | 규칙 재사용, 조합 가능, 비즈니스 언어와 일치, 테스트 용이 |
| 단점 | 단순한 규칙에 과도한 추상화, SQL 변환 어려움 |

### 5.7 패턴 G: Strategy Pattern

**핵심 메커니즘**: 알고리즘(Execution)을 인터페이스 뒤로 캡슐화하고, 런타임에 교체 가능하게 한다. 클라이언트는 "어떤 전략을 사용할 것인가"(Intent)만 결정하고, 전략의 구체적 실행(Execution)은 Strategy 객체에 위임한다.

```typescript
// Strategy Interface: Execution의 계약
interface PricingStrategy {
  calculatePrice(basePrice: number, customer: Customer): number;
}

// 구체적 Execution 전략들
class RegularPricing implements PricingStrategy {
  calculatePrice(basePrice: number, customer: Customer): number {
    return basePrice;
  }
}

class PremiumDiscountPricing implements PricingStrategy {
  calculatePrice(basePrice: number, customer: Customer): number {
    return basePrice * 0.85; // 15% 할인
  }
}

class SeasonalPricing implements PricingStrategy {
  constructor(private discountRate: number) {}
  calculatePrice(basePrice: number, customer: Customer): number {
    return basePrice * (1 - this.discountRate);
  }
}

// Context: Intent(어떤 전략을 사용할 것인가)만 결정
class OrderService {
  constructor(private pricingStrategy: PricingStrategy) {}

  setPricingStrategy(strategy: PricingStrategy): void {
    this.pricingStrategy = strategy;
  }

  calculateTotal(items: OrderItem[], customer: Customer): number {
    return items.reduce((total, item) => {
      return total + this.pricingStrategy.calculatePrice(item.price, customer);
    }, 0);
  }
}
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Strategy 선택 (어떤 알고리즘을 사용할 것인가) |
| Execution 주체 | Strategy 구현체 |
| 분리 수준 | 클래스 수준 |
| 적용 규모 | 소규모 |
| 복잡도 | 낮음 |
| 장점 | 알고리즘 교체 용이, OCP 준수, 런타임 전환 가능 |
| 단점 | Strategy 수만큼 클래스 증가, 클라이언트가 전략 차이를 알아야 함 |

### 5.8 패턴 H: Interpreter Pattern / DSL

**핵심 메커니즘**: 도메인 특화 언어(Domain-Specific Language)로 Intent를 표현하고, Interpreter가 이를 파싱하여 Execution으로 변환한다.

```python
# DSL로 Intent 표현
WORKFLOW_DSL = """
workflow order_processing:
  trigger: order.created

  steps:
    - validate_inventory:
        action: check_stock
        on_failure: reject_order

    - process_payment:
        action: charge_customer
        retry: 3
        on_failure: cancel_order

    - ship_order:
        action: create_shipment
        parallel:
          - send_confirmation_email
          - update_inventory
"""

# Interpreter: DSL → Execution 변환
class WorkflowInterpreter:
    def __init__(self):
        self.actions = {
            'check_stock': InventoryService.check,
            'charge_customer': PaymentService.charge,
            'create_shipment': ShippingService.create,
            'send_confirmation_email': EmailService.send_confirmation,
            'update_inventory': InventoryService.update,
        }

    def execute(self, workflow_dsl: str, context: dict):
        workflow = self.parse(workflow_dsl)

        for step in workflow.steps:
            action = self.actions[step.action]
            try:
                result = action(context)
                context[step.name] = result
            except Exception as e:
                if step.retry:
                    self._retry(action, context, step.retry)
                elif step.on_failure:
                    self._handle_failure(step.on_failure, context)
                    break

    def parse(self, dsl: str) -> Workflow:
        # YAML/커스텀 DSL 파싱 로직
        ...
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | DSL 코드 (커스텀 문법 또는 YAML/JSON 기반) |
| Execution 주체 | Interpreter / Compiler |
| 분리 수준 | 언어 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 높음 |
| 장점 | 도메인 전문가가 직접 Intent 기술 가능, 유연성 극대화 |
| 단점 | DSL 설계/유지보수 비용, 디버깅 어려움, 학습 곡선 |

### 5.9 패턴 I: React Virtual DOM

**핵심 메커니즘**: UI의 Desired State를 JSX(선언적 Intent)로 기술하고, React의 Reconciliation 알고리즘이 실제 DOM 변경(Execution)을 최소화하여 적용한다.

```tsx
// Intent: "UI가 이렇게 보여야 한다" (선언적)
function OrderDashboard({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<OrderStatus>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  // Intent: 필터링/정렬된 주문 목록을 원한다
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filter !== 'all') {
      result = result.filter(o => o.status === filter);
    }
    return result.sort((a, b) =>
      sortBy === 'date'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : b.amount - a.amount
    );
  }, [orders, filter, sortBy]);

  // Intent: 이 UI 구조를 원한다 (JSX = Desired State)
  return (
    <div className="dashboard">
      <FilterBar value={filter} onChange={setFilter} />
      <SortControl value={sortBy} onChange={setSortBy} />
      <OrderList orders={filteredOrders} />
      {filteredOrders.length === 0 && (
        <EmptyState message="주문이 없습니다" />
      )}
    </div>
  );
  // Execution: React가 Virtual DOM diff → 최소 DOM 변경을 자동 수행
}
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | JSX (선언적 UI 구조) |
| Execution 주체 | React Reconciler (Virtual DOM diff → DOM 패치) |
| 분리 수준 | UI 프레임워크 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 중간 (프레임워크가 Execution을 처리) |
| 장점 | 개발자는 Desired State만 기술, 자동 최적화, 선언적 사고 |
| 단점 | 추상화 비용(Virtual DOM 오버헤드), 프레임워크 종속, 미세 제어 어려움 |

### 5.10 패턴 J: SQL

**핵심 메커니즘**: 쿼리(Intent)로 "어떤 데이터를 원하는가"를 선언하고, Query Optimizer(Execution)가 최적의 실행 계획을 자동으로 생성한다.

```sql
-- Intent: "2024년 이후 가입한 고객 중 주문 금액 상위 10명"
SELECT
    c.name,
    c.email,
    SUM(o.total_amount) AS total_spent,
    COUNT(o.id) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.created_at >= '2024-01-01'
  AND o.status = 'COMPLETED'
GROUP BY c.id, c.name, c.email
HAVING SUM(o.total_amount) > 1000
ORDER BY total_spent DESC
LIMIT 10;

-- Execution: Query Optimizer가 결정하는 것들:
-- 1. 어떤 인덱스를 사용할 것인가? (Index Scan vs Full Table Scan)
-- 2. JOIN 순서는? (customers → orders? orders → customers?)
-- 3. JOIN 알고리즘은? (Hash Join? Nested Loop? Merge Join?)
-- 4. 병렬 처리할 것인가?
-- 5. 임시 테이블을 사용할 것인가?
```

```
EXPLAIN ANALYZE 결과 (Execution Plan):

Limit  (cost=1234.56..1234.59 rows=10)
  ->  Sort  (cost=1234.56..1237.89 rows=500)
        Sort Key: sum(o.total_amount) DESC
        ->  HashAggregate  (cost=1100.00..1200.00 rows=500)
              Filter: (sum(o.total_amount) > 1000)
              ->  Hash Join  (cost=800.00..1050.00 rows=5000)
                    Hash Cond: (o.customer_id = c.id)
                    ->  Index Scan using idx_orders_status
                          Filter: (status = 'COMPLETED')
                    ->  Hash
                          ->  Index Scan using idx_customers_created
                                Filter: (created_at >= '2024-01-01')
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | SQL 쿼리 (선언적: "어떤 데이터를 원하는가") |
| Execution 주체 | Query Optimizer + Storage Engine |
| 분리 수준 | 언어/런타임 수준 |
| 적용 규모 | 모든 규모 |
| 복잡도 | 낮음 (사용자 관점) |
| 장점 | 50년 이상 검증, 자동 최적화, 데이터 독립성 |
| 단점 | 복잡한 절차적 로직 표현 어려움, ORM 매핑 비용 |

### 5.11 패턴 K: Android Intent

**핵심 메커니즘**: 컴포넌트 간 통신을 Intent 객체로 추상화한다. Intent는 "무엇을 하고 싶은가"를 선언하고, Android 시스템이 적절한 컴포넌트를 Late Binding으로 연결한다.

```kotlin
// Explicit Intent: 특정 컴포넌트를 직접 지정
val explicitIntent = Intent(this, OrderDetailActivity::class.java).apply {
    putExtra("ORDER_ID", orderId)
}
startActivity(explicitIntent)

// Implicit Intent: "무엇을 하고 싶은가"만 선언 (Late Binding)
val shareIntent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, "주문 #${orderId}가 완료되었습니다!")
}
// Android 시스템이 ACTION_SEND를 처리할 수 있는 앱 목록을 자동으로 제공
startActivity(Intent.createChooser(shareIntent, "공유할 앱 선택"))

// Intent Filter: 컴포넌트가 처리 가능한 Intent 유형을 선언
// AndroidManifest.xml
// <intent-filter>
//     <action android:name="android.intent.action.VIEW" />
//     <data android:scheme="https" android:host="orders.example.com" />
//     <category android:name="android.intent.category.DEFAULT" />
// </intent-filter>
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Intent 객체 (Action + Data + Category + Extras) |
| Execution 주체 | Android 시스템 (Activity Manager가 적절한 컴포넌트 탐색/실행) |
| 분리 수준 | 플랫폼 수준 |
| 적용 규모 | 모바일 앱 |
| 복잡도 | 낮음 ~ 중간 |
| 장점 | Late Binding, 앱 간 통합, 재사용성, 사용자 선택권 |
| 단점 | Implicit Intent의 보안 위험, 데이터 직렬화 비용, 디버깅 어려움 |

### 5.12 패턴 L: Message Queue / Event Bus

**핵심 메커니즘**: 메시지 생산자(Intent 발행)와 소비자(Execution 수행)를 큐/버스를 통해 완전히 디커플링한다. 생산자는 "이 작업이 필요하다"만 선언하고, 소비자가 독립적으로 처리한다.

```python
# Producer: Intent 발행 (무엇을 원하는가)
import json
from datetime import datetime

class OrderService:
    def __init__(self, message_broker):
        self.broker = message_broker

    def place_order(self, order_data: dict):
        # 주문 생성 (로컬 처리)
        order = Order.create(order_data)
        self.order_repo.save(order)

        # Intent 발행: "이 후속 작업들이 필요하다"
        self.broker.publish("order.created", {
            "order_id": order.id,
            "customer_id": order.customer_id,
            "items": order.items,
            "total": order.total,
            "timestamp": datetime.utcnow().isoformat()
        })
        # 생산자는 소비자가 누구인지, 몇 명인지 알지 못함

# Consumer 1: Execution (결제 처리)
class PaymentConsumer:
    @subscribe("order.created")
    def handle(self, message: dict):
        payment_service.charge(
            customer_id=message["customer_id"],
            amount=message["total"]
        )

# Consumer 2: Execution (재고 차감)
class InventoryConsumer:
    @subscribe("order.created")
    def handle(self, message: dict):
        for item in message["items"]:
            inventory_service.reserve(
                product_id=item["product_id"],
                quantity=item["quantity"]
            )

# Consumer 3: Execution (알림 발송)
class NotificationConsumer:
    @subscribe("order.created")
    def handle(self, message: dict):
        email_service.send_order_confirmation(
            customer_id=message["customer_id"],
            order_id=message["order_id"]
        )
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | Message/Event (토픽 + 페이로드) |
| Execution 주체 | Consumer/Subscriber (독립적으로 확장 가능) |
| 분리 수준 | 시스템/서비스 수준 |
| 적용 규모 | 중규모 ~ 대규모 |
| 복잡도 | 중간 |
| 장점 | 완전한 디커플링, 독립적 확장, 비동기 처리, 내결함성 |
| 단점 | Eventual Consistency, 메시지 순서 보장 어려움, 디버깅 복잡, 운영 비용 |

### 5.13 패턴 M: AI Agent Architecture

**핵심 메커니즘**: LLM이 자연어를 이해하여 실행 계획(Intent)을 수립하고, 도구(Tool)를 호출하여 실제 작업(Execution)을 수행한다.

```python
# AI Agent: LLM Planning(Intent) → Tool Execution(Execution)

from typing import List, Dict, Any

# Tool 정의 (Execution 인터페이스)
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_database",
            "description": "데이터베이스에서 고객 정보를 검색합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "filters": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string"},
                            "date_range": {"type": "string"}
                        }
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "고객에게 이메일을 발송합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"}
                },
                "required": ["to", "subject", "body"]
            }
        }
    }
]

# Intent: 자연어로 표현
user_request = "지난 달 VIP 고객 중 구매 이력이 없는 분들에게 재방문 쿠폰 이메일을 보내주세요"

# LLM이 자연어 Intent를 Tool Call 계획(Execution Plan)으로 변환
# Step 1: search_database(query="VIP customers", filters={"date_range": "last_month"})
# Step 2: filter results where purchase_count == 0
# Step 3: send_email(to=each_customer, subject="재방문 쿠폰", body=...)

class Agent:
    def __init__(self, llm, tools: List[Dict]):
        self.llm = llm
        self.tools = tools
        self.tool_registry = self._build_registry(tools)

    def execute(self, user_intent: str) -> str:
        messages = [{"role": "user", "content": user_intent}]

        while True:
            # Planning (Intent → Execution Plan)
            response = self.llm.chat(messages=messages, tools=self.tools)

            if response.finish_reason == "tool_calls":
                # Execution: Tool 호출
                for tool_call in response.tool_calls:
                    result = self.tool_registry[tool_call.name](**tool_call.arguments)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": str(result)
                    })
            else:
                # 최종 응답
                return response.content
```

| 속성 | 값 |
|------|-----|
| Intent 표현 | 자연어 + LLM Planning |
| Execution 주체 | Tool/Function Call |
| 분리 수준 | 시스템 수준 |
| 적용 규모 | 다양 |
| 복잡도 | 높음 |
| 장점 | 자연어 Intent, 유연한 계획 수립, 새로운 Tool 추가 용이 |
| 단점 | LLM 비용/지연, 환각(hallucination), 결정론적이지 않음, 디버깅 어려움 |

### 5.14 종합 비교표

| 패턴 | Intent 표현 방식 | Execution 주체 | 분리 수준 | 적용 규모 | 복잡도 | Undo 가능 | 감사 가능 | 비동기 지원 |
|------|-----------------|---------------|-----------|----------|--------|-----------|-----------|------------|
| **A. Command** | Command 객체 | Handler | 메서드/클래스 | 소~중 | 낮음 | O (built-in) | O | 가능 |
| **B. CQRS** | Command/Query DTO | Handler | 아키텍처 | 중~대 | 중~높음 | 간접적 | O | O |
| **C. Event Sourcing** | Event 객체 | Aggregate | 아키텍처 | 중~대 | 높음 | O (replay) | O (native) | O |
| **D. Declarative Config** | YAML/HCL | Controller/Provider | 인프라 | 대 | 중간 | O (rollback) | O | 일부 |
| **E. Policy-Mechanism** | Policy 언어 | Policy Engine | 시스템 | 중~대 | 중간 | X | O | X |
| **F. Specification** | Spec 객체 | Repository/Validator | 도메인 | 소~중 | 중간 | X | 간접적 | X |
| **G. Strategy** | Strategy 선택 | Strategy 구현체 | 클래스 | 소 | 낮음 | X | X | X |
| **H. DSL/Interpreter** | DSL 코드 | Interpreter | 언어 | 중~대 | 높음 | 설계에 따름 | O | 설계에 따름 |
| **I. React VDOM** | JSX | Reconciler | UI 프레임워크 | 중~대 | 중간 | X (단방향) | X | 비동기 렌더링 |
| **J. SQL** | SQL 쿼리 | Query Optimizer | 언어/런타임 | 모든 규모 | 낮음 | O (transaction) | O | 일부 |
| **K. Android Intent** | Intent 객체 | Activity Manager | 플랫폼 | 모바일 | 낮~중 | X | O | O |
| **L. Message Queue** | Message/Event | Consumer | 시스템/서비스 | 중~대 | 중간 | X | O | O (native) |
| **M. AI Agent** | 자연어 + Plan | Tool Call | 시스템 | 다양 | 높음 | 설계에 따름 | O | O |

### 5.15 패턴 선택 가이드

아래 조건에 따라 적절한 패턴을 선택한다:

```
[분리가 필요한 이유는?]
    |
    +--[Undo/Redo가 필요] ──────────────────> Command Pattern (A)
    |
    +--[읽기/쓰기 성능을 독립적으로 최적화] ──> CQRS (B)
    |
    +--[완전한 이력 추적/시간 여행] ─────────> Event Sourcing (C)
    |
    +--[인프라 상태를 선언적으로 관리] ──────> Declarative Config (D)
    |
    +--[정책을 코드와 분리하여 변경] ────────> Policy-Mechanism (E)
    |
    +--[비즈니스 규칙을 재사용 가능하게] ────> Specification (F)
    |
    +--[알고리즘을 런타임에 교체] ───────────> Strategy (G)
    |
    +--[비개발자가 직접 로직 작성] ──────────> DSL/Interpreter (H)
    |
    +--[UI 상태를 선언적으로 관리] ──────────> React VDOM (I)
    |
    +--[데이터 조회를 선언적으로] ────────────> SQL (J)
    |
    +--[모바일 컴포넌트 간 느슨한 연결] ────> Android Intent (K)
    |
    +--[서비스 간 비동기 디커플링] ──────────> Message Queue (L)
    |
    +--[자연어로 복잡한 작업 지시] ──────────> AI Agent (M)
```

| 상황 | 추천 패턴 | 이유 |
|------|----------|------|
| 단순한 CRUD 앱 | SQL (J) + Strategy (G) | 과도한 분리는 복잡도만 증가 |
| 이커머스 주문 처리 | CQRS (B) + Event Sourcing (C) + Message Queue (L) | 이력 추적, 비동기 처리, 확장성 |
| 인프라 관리 | Declarative Config (D) | K8s, Terraform이 이미 표준 |
| 마이크로서비스 간 통신 | Message Queue (L) + Event Sourcing (C) | 디커플링, 내결함성 |
| 복잡한 권한 관리 | Policy-Mechanism (E) | 정책 변경의 독립성 |
| 에디터/IDE | Command Pattern (A) | Undo/Redo 필수 |
| AI 어시스턴트 | AI Agent (M) + Message Queue (L) | 자연어 Intent, 비동기 Tool 실행 |
| SPA/모바일 UI | React VDOM (I) | 선언적 UI가 표준 |

---

## 6. 효과적인 상황 분석

### 6.1 각 패턴이 가장 효과적인 상황

| 패턴 | 최적 상황 | 핵심 지표 |
|------|----------|-----------|
| **Command Pattern** | 사용자 작업의 실행취소가 필요한 경우, 매크로/배치 처리 | Undo 빈도, 작업 큐잉 필요성 |
| **CQRS** | 읽기/쓰기 비율이 극단적으로 다른 경우 (예: 읽기 95%, 쓰기 5%) | 읽기/쓰기 비율, 조회 복잡도 |
| **Event Sourcing** | 감사 추적이 법적으로 필수인 도메인 (금융, 의료, 법률) | 규제 요구사항, 이력 조회 빈도 |
| **Declarative Config** | 환경 재현성이 중요한 인프라 관리 | 환경 수, 드리프트 빈도 |
| **Policy-Mechanism** | 정책이 자주 변경되지만 집행 메커니즘은 안정적 | 정책 변경 빈도, 규제 환경 |
| **Specification** | 비즈니스 규칙이 복잡하고 조합이 다양 | 규칙 조합 수, 재사용 빈도 |
| **Strategy** | 동일 인터페이스의 다양한 구현이 필요 | 알고리즘 변형 수 |
| **DSL/Interpreter** | 비개발자가 로직을 직접 정의해야 하는 경우 | 비개발자 사용 빈도 |
| **React VDOM** | 상태 변화에 따른 UI 자동 업데이트가 필요 | 상태 변화 빈도, UI 복잡도 |
| **SQL** | 정형 데이터의 다양한 조합 조회 | 쿼리 패턴의 다양성 |
| **Android Intent** | 앱/컴포넌트 간 느슨한 연결이 필요 | 외부 앱 연동 빈도 |
| **Message Queue** | 서비스 간 비동기 처리, 부하 분산 | 처리량, 서비스 독립 배포 빈도 |
| **AI Agent** | 비정형 요청의 자율적 처리 | 요청의 다양성, 도구 수 |

### 6.2 잘못된 패턴 선택의 결과

| 잘못된 선택 | 결과 |
|-------------|------|
| 단순 CRUD에 CQRS + Event Sourcing | 개발 속도 3-5배 저하, 운영 복잡도 폭발, 팀 학습 비용 증가 |
| 고빈도 쓰기에 Event Sourcing 없는 CQRS | 읽기 모델 동기화 실패, 데이터 불일치 |
| 규제 도메인에서 Event Sourcing 미적용 | 감사 요구사항 불충족, 법적 리스크 |
| 단순 설정에 DSL 도입 | DSL 유지보수 비용 > 절감 효과, 팀 분열 |
| 동기 처리가 필요한 곳에 Message Queue | 불필요한 지연, 사용자 경험 저하 |
| 마이크로서비스에 직접 호출(RPC만) | 서비스 간 강결합, 장애 전파, 확장성 한계 |

### 6.3 점진적 도입 전략

초기부터 완전한 분리를 적용하기보다, 필요에 따라 점진적으로 도입하는 것이 현실적이다:

```
Phase 1: 직접 호출 (Start Simple)
  [Service A] --직접 호출--> [Service B]
  - 장점: 단순, 빠른 개발
  - 한계: 강결합

Phase 2: Interface 분리 (Strategy/DI)
  [Service A] --Interface--> [Service B Impl]
  - 장점: 테스트 가능, 구현 교체 가능
  - 한계: 동기적, 프로세스 내부

Phase 3: Command/Event 분리 (Command Pattern)
  [Service A] --Command--> [Handler] ---> [Service B]
  - 장점: Undo/Redo, 로깅, 큐잉
  - 한계: 프로세스 내부

Phase 4: 비동기 분리 (Message Queue)
  [Service A] --Message--> [Queue] ---> [Consumer B]
  - 장점: 완전한 디커플링, 확장성
  - 한계: Eventual Consistency

Phase 5: 이벤트 소싱 (Event Sourcing)
  [Service A] --Event--> [Event Store] ---> [Projections]
  - 장점: 완전한 이력, 시간 여행
  - 한계: 높은 복잡도
```

---

## 7. 실전 베스트 프랙티스

### 7.1 Intent 계층 설계: 추상화 수준 결정

Intent의 추상화 수준을 적절히 결정하는 것이 분리의 성패를 좌우한다.

#### 너무 낮은 추상화 (Bad)

```typescript
// Bad: Intent에 Execution 세부사항이 포함됨
interface CreateOrderCommand {
  customerId: string;
  items: OrderItem[];
  // Execution 세부사항이 Intent에 누출됨:
  usePostgresTransaction: boolean;     // 저장소 구현 세부사항
  sendViaSmtp: boolean;                // 알림 구현 세부사항
  retryCount: number;                  // 재시도 정책 (Execution 관심사)
  connectionPoolSize: number;          // 인프라 설정 (Execution 관심사)
}
```

#### 적절한 추상화 (Good)

```typescript
// Good: Intent는 비즈니스 의도만 표현
interface CreateOrderCommand {
  readonly type: 'CreateOrder';
  readonly orderId: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<{
    productId: string;
    quantity: number;
  }>;
  readonly shippingAddress: Address;
  readonly paymentMethod: PaymentMethodId;
  readonly metadata: {
    correlationId: string;
    timestamp: Date;
    initiatedBy: UserId;
  };
}

// Execution 세부사항은 Handler가 결정
class CreateOrderHandler {
  constructor(
    private orderRepo: OrderRepository,        // 저장소 추상화
    private paymentGateway: PaymentGateway,    // 결제 추상화
    private notificationService: NotificationService, // 알림 추상화
    private retryPolicy: RetryPolicy,          // 재시도 정책
  ) {}

  async handle(command: CreateOrderCommand): Promise<OrderId> {
    return this.retryPolicy.execute(async () => {
      const order = Order.create(command);
      await this.orderRepo.save(order);
      await this.paymentGateway.authorize(order.paymentInfo);
      await this.notificationService.notify(new OrderCreatedNotification(order));
      return order.id;
    });
  }
}
```

#### 너무 높은 추상화 (Bad)

```typescript
// Bad: Intent가 너무 추상적이어서 Execution이 판단할 수 없음
interface DoSomethingCommand {
  action: string;       // "order", "refund", "cancel"... 모든 것이 하나로
  data: unknown;        // 타입 안전성 없음
}
```

#### 추상화 수준 결정 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| **도메인 언어 사용** | Intent는 비즈니스 용어로 표현 | `CreateOrder`, `ApproveRefund` |
| **Execution 독립** | Intent에 "어떻게"가 포함되면 안 됨 | DB 종류, 프로토콜, 재시도 횟수 제외 |
| **타입 안전성** | Intent의 구조가 명확해야 Execution이 해석 가능 | TypeScript interface, Protobuf |
| **메타데이터 포함** | 추적/감사를 위한 correlationId, timestamp 포함 | `metadata.correlationId` |
| **1 Intent = 1 비즈니스 행위** | 하나의 Intent가 하나의 비즈니스 의도를 표현 | `CreateOrder` ≠ `CreateOrderAndSendEmail` |

### 7.2 Execution 계층 설계: 교체 가능성, 테스트 용이성

Execution 계층의 핵심은 **교체 가능성**과 **테스트 용이성**이다. Interface + DI(Dependency Injection)로 이를 달성한다.

```typescript
// === Interface 정의 (Contract) ===

interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
}

interface PaymentGateway {
  authorize(payment: PaymentInfo): Promise<AuthorizationResult>;
  capture(authorizationId: string): Promise<CaptureResult>;
  refund(paymentId: string, amount: Money): Promise<RefundResult>;
}

interface NotificationService {
  notify(notification: Notification): Promise<void>;
}

// === 실제 구현 (Production Execution) ===

class PostgresOrderRepository implements OrderRepository {
  constructor(private pool: Pool) {}

  async save(order: Order): Promise<void> {
    await this.pool.query(
      'INSERT INTO orders (id, customer_id, status, items, total) VALUES ($1, $2, $3, $4, $5)',
      [order.id, order.customerId, order.status, JSON.stringify(order.items), order.total]
    );
  }

  async findById(id: OrderId): Promise<Order | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] ? Order.fromRow(result.rows[0]) : null;
  }

  async findByCustomer(customerId: CustomerId): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );
    return result.rows.map(Order.fromRow);
  }
}

class StripePaymentGateway implements PaymentGateway {
  constructor(private stripe: Stripe) {}

  async authorize(payment: PaymentInfo): Promise<AuthorizationResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: payment.amount.cents,
      currency: payment.amount.currency,
      payment_method: payment.methodId,
      confirm: true,
    });
    return { authorizationId: intent.id, status: intent.status };
  }

  async capture(authorizationId: string): Promise<CaptureResult> {
    const intent = await this.stripe.paymentIntents.capture(authorizationId);
    return { paymentId: intent.id, status: intent.status };
  }

  async refund(paymentId: string, amount: Money): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentId,
      amount: amount.cents,
    });
    return { refundId: refund.id, status: refund.status };
  }
}

// === 테스트용 구현 (Test Execution) ===

class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByCustomer(customerId: CustomerId): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.customerId === customerId);
  }

  // 테스트 헬퍼
  getAll(): Order[] {
    return Array.from(this.orders.values());
  }

  clear(): void {
    this.orders.clear();
  }
}

class MockPaymentGateway implements PaymentGateway {
  private _shouldFail = false;

  simulateFailure(): void { this._shouldFail = true; }

  async authorize(payment: PaymentInfo): Promise<AuthorizationResult> {
    if (this._shouldFail) {
      throw new PaymentDeclinedError('Mock: Payment declined');
    }
    return { authorizationId: `mock_auth_${Date.now()}`, status: 'authorized' };
  }

  async capture(authorizationId: string): Promise<CaptureResult> {
    return { paymentId: `mock_pay_${Date.now()}`, status: 'captured' };
  }

  async refund(paymentId: string, amount: Money): Promise<RefundResult> {
    return { refundId: `mock_ref_${Date.now()}`, status: 'refunded' };
  }
}

// === DI Container ===

// Production
const productionContainer = {
  orderRepository: new PostgresOrderRepository(pgPool),
  paymentGateway: new StripePaymentGateway(stripe),
  notificationService: new SmtpNotificationService(smtpConfig),
};

// Test
const testContainer = {
  orderRepository: new InMemoryOrderRepository(),
  paymentGateway: new MockPaymentGateway(),
  notificationService: new NoOpNotificationService(),
};

// Handler는 어떤 구현이 주입되는지 알지 못함
const handler = new CreateOrderHandler(
  container.orderRepository,
  container.paymentGateway,
  container.notificationService,
  new ExponentialBackoffRetryPolicy(),
);
```

### 7.3 Intent-Execution 경계의 Contract 정의

Intent와 Execution 사이의 경계는 **명시적 Contract**로 정의해야 한다.

```typescript
// === Input Contract ===
// Intent가 Execution에 전달하는 데이터의 형태

interface CommandContract<TInput, TOutput, TError extends Error> {
  readonly input: TInput;
  readonly expectedOutput: TOutput;
  readonly possibleErrors: TError[];
}

// 구체적 Contract 정의
interface CreateOrderContract {
  input: {
    orderId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number }>;
    shippingAddress: Address;
  };
  output: {
    orderId: string;
    status: 'CREATED';
    estimatedDelivery: Date;
  };
  errors:
    | InvalidOrderError       // 주문 데이터 유효하지 않음
    | CustomerNotFoundError   // 고객이 존재하지 않음
    | InsufficientStockError  // 재고 부족
    | PaymentDeclinedError;   // 결제 거부
}

// === Output Contract ===
// Execution이 Intent에 반환하는 결과

type Result<T, E extends Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// === Error Contract ===
// 에러 유형별 처리 방법

class InvalidOrderError extends Error {
  constructor(
    public readonly violations: string[],
    public readonly recoverable: false  // 복구 불가: 클라이언트가 수정해야 함
  ) {
    super(`Invalid order: ${violations.join(', ')}`);
  }
}

class InsufficientStockError extends Error {
  constructor(
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number,
    public readonly recoverable: true   // 복구 가능: 수량 조정 후 재시도
  ) {
    super(`Insufficient stock for ${productId}`);
  }
}

class PaymentDeclinedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly retryable: boolean, // 재시도 가능 여부
    public readonly recoverable: true
  ) {
    super(`Payment declined: ${reason}`);
  }
}

// === Contract 기반 Handler 구현 ===

class CreateOrderHandler {
  async handle(
    input: CreateOrderContract['input']
  ): Promise<Result<CreateOrderContract['output'], CreateOrderContract['errors']>> {
    try {
      // Validation
      const violations = this.validate(input);
      if (violations.length > 0) {
        return { success: false, error: new InvalidOrderError(violations, false) };
      }

      // Execution
      const order = await this.createOrder(input);
      return {
        success: true,
        data: {
          orderId: order.id,
          status: 'CREATED',
          estimatedDelivery: order.estimatedDelivery,
        },
      };
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return { success: false, error: e };
      }
      throw e; // 예상치 못한 에러는 상위로 전파
    }
  }
}
```

### 7.4 에러 처리: Intent 성공 + Execution 실패

Intent는 유효하지만 Execution이 실패하는 경우가 빈번하다. 이를 체계적으로 처리해야 한다.

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime
import asyncio

class IntentStatus(Enum):
    """Intent의 생명주기 상태"""
    PENDING = "pending"           # 접수됨, 아직 실행 전
    ACCEPTED = "accepted"         # 유효성 검증 통과, 실행 대기
    EXECUTING = "executing"       # 실행 중
    SUCCEEDED = "succeeded"       # 실행 성공
    FAILED = "failed"             # 실행 실패 (재시도 가능)
    REJECTED = "rejected"         # 유효성 검증 실패 (재시도 불가)
    DEAD_LETTERED = "dead_lettered"  # 최대 재시도 초과, 수동 처리 필요

@dataclass
class IntentRecord:
    """Intent의 실행 기록"""
    intent_id: str
    intent_type: str
    payload: dict
    status: IntentStatus
    created_at: datetime
    updated_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    result: Optional[Any] = None

class IntentExecutor:
    """Intent를 받아 Execution을 관리하는 실행기"""

    def __init__(self, handler_registry, intent_store, dead_letter_queue):
        self.handlers = handler_registry
        self.store = intent_store
        self.dlq = dead_letter_queue

    async def execute(self, intent: IntentRecord) -> IntentRecord:
        # Phase 1: Intent 유효성 검증
        handler = self.handlers.get(intent.intent_type)
        if not handler:
            intent.status = IntentStatus.REJECTED
            intent.last_error = f"No handler for intent type: {intent.intent_type}"
            await self.store.save(intent)
            return intent

        validation_result = await handler.validate(intent.payload)
        if not validation_result.is_valid:
            intent.status = IntentStatus.REJECTED
            intent.last_error = str(validation_result.errors)
            await self.store.save(intent)
            return intent

        intent.status = IntentStatus.ACCEPTED
        await self.store.save(intent)

        # Phase 2: Execution (재시도 로직 포함)
        while intent.retry_count <= intent.max_retries:
            try:
                intent.status = IntentStatus.EXECUTING
                await self.store.save(intent)

                result = await handler.execute(intent.payload)

                intent.status = IntentStatus.SUCCEEDED
                intent.result = result
                await self.store.save(intent)
                return intent

            except RetryableError as e:
                intent.retry_count += 1
                intent.last_error = str(e)

                if intent.retry_count > intent.max_retries:
                    # Dead Letter Queue로 이동
                    intent.status = IntentStatus.DEAD_LETTERED
                    await self.store.save(intent)
                    await self.dlq.enqueue(intent)
                    return intent

                # Exponential Backoff
                delay = min(2 ** intent.retry_count, 60)
                await asyncio.sleep(delay)

            except NonRetryableError as e:
                intent.status = IntentStatus.FAILED
                intent.last_error = str(e)
                await self.store.save(intent)
                return intent

        return intent


class RetryableError(Exception):
    """재시도 가능한 에러 (네트워크 타임아웃, 일시적 서비스 장애 등)"""
    pass

class NonRetryableError(Exception):
    """재시도 불가능한 에러 (비즈니스 규칙 위반, 데이터 오류 등)"""
    pass


# Dead Letter Queue: 최대 재시도 초과 시 수동 처리 대기열
class DeadLetterQueue:
    """처리 실패한 Intent를 보관하고 수동 개입을 기다리는 큐"""

    async def enqueue(self, intent: IntentRecord):
        await self.store.save({
            "intent_id": intent.intent_id,
            "intent_type": intent.intent_type,
            "payload": intent.payload,
            "error": intent.last_error,
            "retry_count": intent.retry_count,
            "dead_lettered_at": datetime.utcnow().isoformat(),
        })
        # 운영팀에 알림
        await self.alerting.send(
            severity="HIGH",
            message=f"Intent {intent.intent_id} dead-lettered after {intent.retry_count} retries: {intent.last_error}"
        )

    async def replay(self, intent_id: str):
        """수동으로 Dead Letter Intent를 재실행"""
        intent = await self.store.get(intent_id)
        intent.retry_count = 0
        intent.status = IntentStatus.PENDING
        await self.executor.execute(intent)
```

### 7.5 멱등성(Idempotency) 보장

Intent/Execution이 분리되면 네트워크 실패, 재시도 등으로 동일한 Intent가 여러 번 실행될 수 있다. 멱등성(Idempotency)은 필수다.

```typescript
// === Idempotency Key 패턴 ===

interface IdempotentCommand {
  readonly idempotencyKey: string;  // 클라이언트가 생성하는 고유 키
  readonly type: string;
  readonly payload: unknown;
}

class IdempotentCommandHandler<T> {
  constructor(
    private innerHandler: CommandHandler<T>,
    private idempotencyStore: IdempotencyStore,
  ) {}

  async handle(command: IdempotentCommand): Promise<T> {
    // Step 1: 이미 처리된 요청인지 확인
    const existingResult = await this.idempotencyStore.get(command.idempotencyKey);
    if (existingResult) {
      // 동일한 결과를 반환 (재실행하지 않음)
      return existingResult as T;
    }

    // Step 2: Lock 획득 (동시 실행 방지)
    const lock = await this.idempotencyStore.acquireLock(command.idempotencyKey);
    if (!lock) {
      throw new ConcurrentExecutionError('동일한 요청이 이미 처리 중입니다');
    }

    try {
      // Step 3: 실제 실행
      const result = await this.innerHandler.handle(command);

      // Step 4: 결과 저장 (TTL 포함)
      await this.idempotencyStore.save(command.idempotencyKey, result, {
        ttl: 24 * 60 * 60, // 24시간
      });

      return result;
    } finally {
      await this.idempotencyStore.releaseLock(command.idempotencyKey);
    }
  }
}

// === Check-Then-Act 패턴 (Kubernetes 스타일) ===

class ReconciliationHandler {
  async reconcile(desiredState: DesiredState): Promise<void> {
    // Step 1: 현재 상태 확인
    const currentState = await this.stateStore.getCurrent();

    // Step 2: 차이(diff) 계산
    const diff = this.computeDiff(currentState, desiredState);

    // Step 3: 차이가 없으면 아무것도 하지 않음 (멱등성)
    if (diff.isEmpty()) {
      return; // Already in desired state
    }

    // Step 4: 차이만 적용
    for (const change of diff.changes) {
      await this.applyChange(change);
    }
  }

  private computeDiff(current: State, desired: State): StateDiff {
    // 예: K8s에서 현재 replicas=2, 원하는 replicas=3 → diff: +1 Pod
    return new StateDiff(current, desired);
  }
}
```

### 7.6 관찰 가능성(Observability)

Intent 계층과 Execution 계층의 로깅/메트릭을 분리하면 디버깅이 크게 향상된다.

```typescript
// === Intent 계층 로깅 ===
// "무엇이 요청되었는가" 중심

class IntentLogger {
  logIntentReceived(command: Command): void {
    this.logger.info('Intent received', {
      intentId: command.metadata.correlationId,
      intentType: command.type,
      initiatedBy: command.metadata.initiatedBy,
      timestamp: command.metadata.timestamp,
      // 비즈니스 컨텍스트
      customerId: command.customerId,
      orderTotal: command.total,
    });
  }

  logIntentCompleted(command: Command, result: Result<any, any>): void {
    this.logger.info('Intent completed', {
      intentId: command.metadata.correlationId,
      intentType: command.type,
      success: result.success,
      duration: Date.now() - command.metadata.timestamp.getTime(),
    });
  }

  logIntentFailed(command: Command, error: Error): void {
    this.logger.error('Intent failed', {
      intentId: command.metadata.correlationId,
      intentType: command.type,
      error: error.message,
      recoverable: (error as any).recoverable ?? false,
      retryCount: (error as any).retryCount ?? 0,
    });
  }
}

// === Execution 계층 로깅 ===
// "어떻게 실행되었는가" 중심

class ExecutionLogger {
  logExecutionStep(step: string, details: Record<string, unknown>): void {
    this.logger.debug('Execution step', {
      step,
      ...details,
      // 기술적 컨텍스트
      dbQueryTime: details.queryTimeMs,
      cacheHit: details.cacheHit,
      retryAttempt: details.retryAttempt,
      externalApiLatency: details.latencyMs,
    });
  }

  logExecutionMetrics(metrics: ExecutionMetrics): void {
    this.metrics.gauge('execution.db_query_time', metrics.dbQueryTime);
    this.metrics.gauge('execution.cache_hit_rate', metrics.cacheHitRate);
    this.metrics.gauge('execution.external_api_latency', metrics.apiLatency);
    this.metrics.increment('execution.retry_count', metrics.retryCount);
  }
}

// === 통합: Correlation ID로 Intent와 Execution 연결 ===

class InstrumentedHandler {
  async handle(command: Command): Promise<Result<any, any>> {
    const correlationId = command.metadata.correlationId;

    // Intent 로깅
    this.intentLogger.logIntentReceived(command);

    // Execution 컨텍스트에 correlationId 전파
    const context = { correlationId };

    try {
      const result = await this.innerHandler.handle(command, context);
      this.intentLogger.logIntentCompleted(command, result);
      return result;
    } catch (error) {
      this.intentLogger.logIntentFailed(command, error as Error);
      throw error;
    }
  }
}
```

```
로그 조회 시:

# Intent 수준: "무슨 일이 있었나?"
> correlationId=abc-123 AND level=INFO
  [10:00:00] Intent received: CreateOrder, customer=C001, total=$150
  [10:00:03] Intent completed: CreateOrder, success=true, duration=3000ms

# Execution 수준: "왜 3초나 걸렸나?"
> correlationId=abc-123 AND level=DEBUG
  [10:00:00] Execution step: validate_inventory, queryTime=50ms, cacheHit=true
  [10:00:00] Execution step: charge_payment, latency=2500ms, retryAttempt=1
  [10:00:02] Execution step: charge_payment, latency=400ms, retryAttempt=2 (success)
  [10:00:03] Execution step: create_shipment, latency=100ms
```

### 7.7 버전 관리: Intent 스키마 진화

Intent의 스키마(형태)는 시간이 지나면서 변화한다. 하위 호환성을 유지하면서 진화시키는 것이 핵심이다.

```typescript
// === Upcasting 패턴 ===
// 오래된 버전의 Intent를 최신 버전으로 변환

// Version 1: 초기 버전
interface CreateOrderV1 {
  version: 1;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
}

// Version 2: 배송 주소 추가
interface CreateOrderV2 {
  version: 2;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  shippingAddress: Address;  // 신규 필드
}

// Version 3: 결제 방법 추가
interface CreateOrderV3 {
  version: 3;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;  // unitPrice 추가
  shippingAddress: Address;
  paymentMethod: PaymentMethodId;  // 신규 필드
}

// Upcaster: 오래된 버전을 최신 버전으로 변환
class CreateOrderUpcaster {
  upcast(event: CreateOrderV1 | CreateOrderV2 | CreateOrderV3): CreateOrderV3 {
    let current: any = event;

    if (current.version === 1) {
      current = this.v1ToV2(current);
    }
    if (current.version === 2) {
      current = this.v2ToV3(current);
    }

    return current as CreateOrderV3;
  }

  private v1ToV2(v1: CreateOrderV1): CreateOrderV2 {
    return {
      ...v1,
      version: 2,
      shippingAddress: DEFAULT_ADDRESS, // 기본값 적용
    };
  }

  private v2ToV3(v2: CreateOrderV2): CreateOrderV3 {
    return {
      ...v2,
      version: 3,
      items: v2.items.map(item => ({
        ...item,
        unitPrice: 0, // 기본값 (또는 lookup)
      })),
      paymentMethod: DEFAULT_PAYMENT_METHOD,
    };
  }
}
```

#### Intent 스키마 진화 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| **Additive Only** | 기존 필드를 제거/변경하지 않고 새 필드만 추가 | V2에 `shippingAddress` 추가 |
| **Optional New Fields** | 새 필드는 기본값을 가져야 함 | `paymentMethod = DEFAULT` |
| **Upcasting** | 오래된 버전을 최신 버전으로 자동 변환 | V1 → V2 → V3 체인 |
| **Consumer-Driven Contract** | 소비자가 필요한 최소 스키마를 정의 | 소비자별 contract test |
| **Semantic Versioning** | 호환성 깨지는 변경은 메이저 버전 증가 | V1 → V2 (breaking) |

### 7.8 Reconciliation Loop

Kubernetes Controller의 Reconciliation Loop는 Intent/Execution 분리의 가장 강력한 패턴이다. 이를 애플리케이션 코드에도 적용할 수 있다.

```typescript
// === Reconciliation Loop: 애플리케이션 수준 적용 ===

interface Reconciler<TDesired, TCurrent> {
  getDesiredState(): Promise<TDesired>;
  getCurrentState(): Promise<TCurrent>;
  computeActions(desired: TDesired, current: TCurrent): Action[];
  applyAction(action: Action): Promise<void>;
}

// 예: 구독 서비스의 Reconciliation Loop
class SubscriptionReconciler implements Reconciler<DesiredSubscription, CurrentSubscription> {

  async getDesiredState(): Promise<DesiredSubscription> {
    // Intent Store에서 "원하는 구독 상태" 조회
    return this.subscriptionStore.getDesired(this.subscriptionId);
  }

  async getCurrentState(): Promise<CurrentSubscription> {
    // 실제 상태 조회 (결제 상태, 접근 권한 등)
    const payment = await this.paymentService.getStatus(this.subscriptionId);
    const access = await this.accessService.getGrants(this.subscriptionId);
    return { payment, access };
  }

  computeActions(desired: DesiredSubscription, current: CurrentSubscription): Action[] {
    const actions: Action[] = [];

    // 결제 상태 비교
    if (desired.plan !== current.payment.plan) {
      actions.push({ type: 'UPDATE_PAYMENT_PLAN', plan: desired.plan });
    }

    // 접근 권한 비교
    const missingFeatures = desired.features.filter(
      f => !current.access.features.includes(f)
    );
    if (missingFeatures.length > 0) {
      actions.push({ type: 'GRANT_FEATURES', features: missingFeatures });
    }

    const extraFeatures = current.access.features.filter(
      f => !desired.features.includes(f)
    );
    if (extraFeatures.length > 0) {
      actions.push({ type: 'REVOKE_FEATURES', features: extraFeatures });
    }

    return actions;
  }

  async applyAction(action: Action): Promise<void> {
    switch (action.type) {
      case 'UPDATE_PAYMENT_PLAN':
        await this.paymentService.updatePlan(this.subscriptionId, action.plan);
        break;
      case 'GRANT_FEATURES':
        await this.accessService.grantFeatures(this.subscriptionId, action.features);
        break;
      case 'REVOKE_FEATURES':
        await this.accessService.revokeFeatures(this.subscriptionId, action.features);
        break;
    }
  }
}

// Reconciliation Loop Runner
class ReconciliationRunner {
  async run(reconciler: Reconciler<any, any>, intervalMs: number = 30000): Promise<void> {
    while (true) {
      try {
        const desired = await reconciler.getDesiredState();
        const current = await reconciler.getCurrentState();
        const actions = reconciler.computeActions(desired, current);

        if (actions.length === 0) {
          // 이미 Desired State에 도달 → 아무것도 하지 않음
          console.log('State is reconciled. No actions needed.');
        } else {
          console.log(`Reconciling: ${actions.length} actions to apply`);
          for (const action of actions) {
            await reconciler.applyAction(action);
          }
        }
      } catch (error) {
        console.error('Reconciliation error:', error);
        // 에러 발생 시에도 루프는 계속됨 (self-healing)
      }

      await sleep(intervalMs);
    }
  }
}
```

```
Reconciliation Loop 동작 흐름:

[Desired State]              [Current State]
  replicas: 3                  replicas: 2
  plan: premium                plan: basic
  features: [A, B, C]         features: [A, B]

         |                           |
         v                           v
     +-----------------------------------+
     |         computeActions()          |
     +-----------------------------------+
                    |
                    v
     Actions:
       1. SCALE_UP (2 → 3)
       2. UPDATE_PLAN (basic → premium)
       3. GRANT_FEATURES ([C])
                    |
                    v
     +-----------------------------------+
     |         applyActions()            |
     +-----------------------------------+
                    |
                    v
     [Current State] → replicas: 3, plan: premium, features: [A, B, C]
     (Desired State와 일치 → 다음 루프에서 No-op)
```

---

## 8. 안티패턴

### 8.1 Leaky Abstraction — Execution 세부사항이 Intent로 누출

```typescript
// BAD: Intent에 Execution 세부사항이 누출됨
interface CreateOrderCommand {
  customerId: string;
  items: OrderItem[];

  // Execution 세부사항이 Intent로 누출!
  useReadReplica: boolean;          // DB 인프라 세부사항
  cacheStrategy: 'LRU' | 'LFU';    // 캐시 구현 세부사항
  maxRetries: number;               // 재시도 정책
  timeoutMs: number;                // 네트워크 설정
  partitionKey: string;             // 메시지 큐 세부사항
}
```

```typescript
// GOOD: Intent는 비즈니스 의도만 표현
interface CreateOrderCommand {
  customerId: string;
  items: OrderItem[];
  shippingAddress: Address;
  priority: 'standard' | 'express';  // 비즈니스 수준의 우선순위
}

// Execution 세부사항은 Handler 내부에서 결정
class CreateOrderHandler {
  async handle(command: CreateOrderCommand) {
    const retryPolicy = command.priority === 'express'
      ? this.aggressiveRetry   // express는 적극적 재시도
      : this.standardRetry;     // standard는 일반 재시도

    // 캐시, DB replica, timeout 등은 Handler가 결정
  }
}
```

**결과**: Intent 변경 없이 Execution을 교체할 수 없게 됨. DB를 PostgreSQL에서 DynamoDB로 바꾸면 모든 Intent 호출 코드를 수정해야 함.

### 8.2 Over-Separation — 불필요한 분리로 복잡도 폭발

```typescript
// BAD: 단순한 CRUD에 과도한 분리
// 사용자 이름 변경이라는 단순한 작업에:
//   1. UpdateUserNameCommand
//   2. UpdateUserNameCommandValidator
//   3. UpdateUserNameCommandHandler
//   4. UserNameUpdatedEvent
//   5. UserNameUpdatedEventHandler
//   6. UserNameUpdatedProjection
//   7. UpdateUserNameSaga
// → 7개의 클래스/파일, 실제 로직은 3줄

class UpdateUserNameCommandValidator {
  validate(command: UpdateUserNameCommand): ValidationResult {
    if (!command.newName || command.newName.length < 2) {
      return ValidationResult.fail('이름은 2자 이상이어야 합니다');
    }
    return ValidationResult.success();
  }
}

class UpdateUserNameCommandHandler {
  async handle(command: UpdateUserNameCommand): Promise<void> {
    const user = await this.userRepo.findById(command.userId);
    user.changeName(command.newName);
    await this.userRepo.save(user);
  }
}

// ... 5개 더 ...
```

```typescript
// GOOD: 복잡도에 비례하는 분리 수준
// 단순한 CRUD는 단순하게
class UserService {
  async updateName(userId: string, newName: string): Promise<void> {
    if (!newName || newName.length < 2) {
      throw new ValidationError('이름은 2자 이상이어야 합니다');
    }
    await this.userRepo.updateName(userId, newName);
  }
}
```

**결과**: 개발 속도 저하, 코드 탐색 어려움, 새 팀원 온보딩 지연. "파일 7개를 열어야 사용자 이름 변경 로직을 이해할 수 있다"는 상황.

### 8.3 God Intent — 하나의 Intent에 너무 많은 책임

```typescript
// BAD: 하나의 Command에 5가지 비즈니스 행위가 포함
interface ProcessEverythingCommand {
  // 주문 생성
  customerId: string;
  items: OrderItem[];
  // 결제 처리
  paymentMethodId: string;
  billingAddress: Address;
  // 배송 시작
  shippingAddress: Address;
  shippingMethod: 'standard' | 'express';
  // 재고 차감
  warehouseId: string;
  // 알림 발송
  notifyVia: ('email' | 'sms' | 'push')[];
}
```

```typescript
// GOOD: 1 Intent = 1 비즈니스 행위
interface CreateOrderCommand {
  customerId: string;
  items: OrderItem[];
  shippingAddress: Address;
}

interface ProcessPaymentCommand {
  orderId: string;
  paymentMethodId: string;
}

interface InitiateShipmentCommand {
  orderId: string;
  shippingMethod: 'standard' | 'express';
}

// Orchestrator(Saga)가 이들을 조율
class OrderSaga {
  async execute(input: OrderInput): Promise<void> {
    const order = await this.commandBus.send(new CreateOrderCommand(input));
    await this.commandBus.send(new ProcessPaymentCommand(order.id, input.paymentMethodId));
    await this.commandBus.send(new InitiateShipmentCommand(order.id, input.shippingMethod));
  }
}
```

**결과**: 부분 실패 처리 불가, 재시도 시 전체 재실행, 테스트 어려움, Intent의 의미가 불명확.

### 8.4 Phantom Intent — 실행되지 않는 Intent 축적

```python
# BAD: Intent가 발행되었지만 소비되지 않음
class OrderService:
    def place_order(self, order_data):
        order = Order.create(order_data)
        self.repo.save(order)

        # 이 이벤트를 소비하는 Consumer가 없음!
        self.event_bus.publish("order.analytics_needed", {
            "order_id": order.id,
            "timestamp": datetime.utcnow()
        })

        # 이 이벤트의 Consumer가 6개월 전에 삭제됨!
        self.event_bus.publish("order.legacy_sync", {
            "order_id": order.id
        })
```

**결과**: 메시지 큐에 처리되지 않는 메시지가 축적, 디스크/메모리 낭비, 모니터링 오염, "이 이벤트는 뭐에 쓰이는 거야?"라는 혼란.

**대응**:

```python
# GOOD: Consumer 존재 여부를 검증하는 Health Check
class EventBusHealthCheck:
    def check_orphan_events(self):
        """소비자가 없는 이벤트 토픽을 감지"""
        all_topics = self.event_bus.get_all_topics()
        for topic in all_topics:
            consumers = self.event_bus.get_consumers(topic)
            if len(consumers) == 0:
                self.alert(f"Phantom event detected: {topic} has no consumers")
```

### 8.5 Synchronous Trap — 비동기여야 할 것을 동기로

```typescript
// BAD: 주문 생성 시 모든 후속 작업을 동기적으로 실행
class OrderHandler {
  async handle(command: CreateOrderCommand): Promise<OrderResult> {
    const order = Order.create(command);
    await this.orderRepo.save(order);                      // 50ms
    await this.paymentService.charge(order);                // 2000ms (외부 API)
    await this.inventoryService.reserve(order);             // 500ms (외부 API)
    await this.emailService.sendConfirmation(order);        // 1000ms (외부 API)
    await this.analyticsService.trackOrder(order);          // 300ms (외부 API)
    await this.loyaltyService.addPoints(order);             // 200ms (외부 API)
    // 총 4050ms — 사용자가 4초를 기다려야 함
    // 이메일 서비스가 다운되면 주문 생성도 실패
    return { orderId: order.id };
  }
}
```

```typescript
// GOOD: 핵심만 동기, 나머지는 비동기 (Intent 발행)
class OrderHandler {
  async handle(command: CreateOrderCommand): Promise<OrderResult> {
    const order = Order.create(command);
    await this.orderRepo.save(order);  // 50ms (핵심, 동기)

    // 후속 작업은 Intent(이벤트)로 발행 → 비동기 처리
    await this.eventBus.publish('order.created', {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
    });
    // 총 100ms — 사용자는 즉시 응답 수신
    // 이메일 서비스가 다운되어도 주문 생성은 성공
    return { orderId: order.id };
  }
}
```

**결과**: 응답 지연, 장애 전파, 서비스 간 강결합.

### 8.6 Schema Drift — Intent 정의와 Execution 불일치

```typescript
// Intent 정의 (V2)
interface CreateOrderCommand {
  version: 2;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  shippingAddress: Address;
}

// Handler는 아직 V1 구조를 기대 (unitPrice가 없던 시절)
class CreateOrderHandler {
  async handle(command: any): Promise<void> {
    // unitPrice를 사용하지 않아 가격이 0원으로 처리됨!
    const total = command.items.reduce(
      (sum: number, item: any) => sum + (item.price ?? 0) * item.quantity, 0
    );
    // item.price는 V1의 필드, V2에서는 item.unitPrice로 변경됨
    // 결과: 모든 주문이 0원
  }
}
```

**대응**:

```typescript
// GOOD: Schema 검증을 Intent 수신 시점에 수행
import { z } from 'zod';

const CreateOrderCommandSchema = z.object({
  version: z.literal(2),
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  shippingAddress: AddressSchema,
});

class CreateOrderHandler {
  async handle(raw: unknown): Promise<void> {
    // 런타임에 Schema 검증
    const command = CreateOrderCommandSchema.parse(raw);
    // 이후 command는 타입 안전
    const total = command.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity, 0
    );
  }
}
```

### 8.7 Missing Feedback Loop — Execution 결과 미전달

```typescript
// BAD: Intent를 발행하고 결과를 확인하지 않음
class OrderService {
  async placeOrder(orderData: OrderInput): Promise<string> {
    const order = Order.create(orderData);
    await this.orderRepo.save(order);

    // "결제해주세요"라고 이벤트를 발행하고... 끝
    await this.eventBus.publish('order.created', order);

    return order.id;
    // 결제가 실패해도 주문은 "생성됨" 상태로 남음
    // 사용자는 결제 실패를 알 수 없음
    // 주문이 영원히 "처리 중" 상태에 빠질 수 있음
  }
}
```

```typescript
// GOOD: Feedback Loop 구현
class OrderService {
  async placeOrder(orderData: OrderInput): Promise<string> {
    const order = Order.create(orderData);
    order.setStatus('PAYMENT_PENDING');
    await this.orderRepo.save(order);

    await this.eventBus.publish('order.created', order);
    return order.id;
  }
}

// Feedback: 결제 결과를 수신하여 상태 갱신
class PaymentResultHandler {
  @subscribe('payment.completed')
  async onPaymentCompleted(event: PaymentCompletedEvent): void {
    const order = await this.orderRepo.findById(event.orderId);
    order.setStatus('PAID');
    await this.orderRepo.save(order);
    await this.eventBus.publish('order.paid', order);
  }

  @subscribe('payment.failed')
  async onPaymentFailed(event: PaymentFailedEvent): void {
    const order = await this.orderRepo.findById(event.orderId);
    order.setStatus('PAYMENT_FAILED');
    order.setFailureReason(event.reason);
    await this.orderRepo.save(order);
    // 사용자에게 알림
    await this.notificationService.notifyPaymentFailed(order);
  }
}

// Timeout 감지: 일정 시간 내 Feedback이 없으면 경고
class OrderTimeoutWatcher {
  @scheduled('every 5 minutes')
  async checkStaleOrders(): void {
    const staleOrders = await this.orderRepo.findByStatusOlderThan(
      'PAYMENT_PENDING',
      Duration.minutes(10)
    );
    for (const order of staleOrders) {
      this.alerting.warn(`Order ${order.id} stuck in PAYMENT_PENDING for >10min`);
    }
  }
}
```

**결과**: 데이터 불일치, "좀비" 상태의 엔티티 축적, 사용자 혼란, 운영 부담 증가.

---

## 9. 빅테크 실전 사례

### 9.1 Google

#### Borg/Kubernetes: Desired State + Reconciliation Controller

Google의 내부 클러스터 관리 시스템 Borg(2003)에서 시작된 Desired State 패러다임은 Kubernetes(2014)로 오픈소스화되었다.

```
Kubernetes Controller 동작 원리:

[User] --kubectl apply--> [API Server] --저장--> [etcd (Desired State)]
                                                        |
                                                        v
                                              [Controller Manager]
                                                   |
                              +--------------------+--------------------+
                              |                    |                    |
                    [Deployment Controller]  [ReplicaSet Controller]  [Node Controller]
                              |
                              v
                    Reconciliation Loop:
                    1. Watch: etcd 변경 감지
                    2. Compare: Desired vs Current
                    3. Act: 차이 해소
                    4. Repeat: 무한 반복
```

핵심 설계 원칙:
- **Level-triggered, not edge-triggered**: "3개의 Pod이 있어야 한다"(level)이지 "Pod을 1개 추가하라"(edge)가 아님
- **Self-healing**: Pod이 죽으면 Controller가 자동으로 새 Pod 생성
- **Eventual consistency**: 즉시 반영이 아니라 결국(eventually) 원하는 상태에 도달

#### Zanzibar: 권한 정책/검증 엔진 분리

Google Zanzibar(2019)는 전 세계적 규모의 권한 관리 시스템이다.

```
Zanzibar 구조:

[Policy Definition (Intent)]
  - Relation Tuples: user:alice#member@group:engineering
  - Namespace Config: 권한 모델 정의 (viewer, editor, owner)

[Authorization Check (Execution)]
  - Check API: "alice가 doc:readme를 읽을 수 있는가?"
  - Expand API: "doc:readme를 읽을 수 있는 모든 사용자는?"
  - 글로벌 일관성 (Zookies for causal consistency)
```

Intent(누가 무엇에 대해 어떤 관계인가)와 Execution(특정 접근이 허용되는가 검증)이 완전히 분리되어, 정책 변경과 검증 엔진을 독립적으로 확장한다.

#### SRE Auxon: Intent-based Capacity Planning

Google SRE 팀의 Auxon은 Intent-based Capacity Planning 시스템이다:

- **Intent**: "이 서비스는 99.99% 가용성을 보장하면서 초당 10,000 요청을 처리해야 한다"
- **Execution**: Auxon이 자동으로 필요한 CPU, 메모리, 인스턴스 수를 계산하고 프로비저닝

#### Dremel/BigQuery: SQL Intent → 분산 실행 엔진

```sql
-- Intent: "지난 1년간 모든 사용자의 접속 패턴을 분석하라"
SELECT
  user_id,
  EXTRACT(HOUR FROM login_time) AS hour,
  COUNT(*) AS login_count
FROM `project.dataset.user_logins`
WHERE login_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
GROUP BY user_id, hour
ORDER BY login_count DESC;

-- Execution: Dremel이 자동으로 결정:
-- 1. 수천 개의 Worker에 쿼리 분산
-- 2. Columnar Storage에서 필요한 컬럼만 읽기
-- 3. 로컬 집계 후 글로벌 병합
-- 4. 수 페타바이트 데이터를 수 초 만에 처리
```

### 9.2 Meta/Facebook

#### React: JSX(Intent) → Virtual DOM → Reconciliation

React(2013)는 UI 개발에서 Intent/Execution 분리를 대중화한 혁명적 프레임워크이다.

```
React의 분리 구조:

[Developer writes JSX (Intent)]
  → "UI가 이렇게 보여야 한다"
  → 순수 함수: f(state) = UI
        |
        v
[Virtual DOM (Intermediate Representation)]
  → 경량 JS 객체 트리
  → 이전 트리와 비교 (Diffing)
        |
        v
[Reconciliation (Execution)]
  → 최소한의 DOM 변경만 적용
  → Fiber Architecture로 우선순위 기반 스케줄링
  → 비동기 렌더링 (Concurrent Mode)
```

핵심 혁신:
- 개발자는 "현재 상태에서 UI가 어떻게 보여야 하는가"만 선언
- "어떻게 DOM을 변경할 것인가"는 React가 최적화하여 결정
- jQuery 시대의 명령적 DOM 조작을 완전히 대체

#### GraphQL: 쿼리(Intent) → Resolver(Execution)

```graphql
# Intent: 클라이언트가 "정확히 필요한 데이터"를 선언
query OrderDetails($orderId: ID!) {
  order(id: $orderId) {
    id
    status
    total
    customer {
      name
      email
    }
    items {
      product {
        name
        price
      }
      quantity
    }
  }
}

# Execution: 각 필드의 Resolver가 독립적으로 데이터를 가져옴
# - order → OrderResolver (DB 조회)
# - customer → CustomerResolver (User Service API)
# - items.product → ProductResolver (Product Service API, DataLoader로 N+1 해결)
```

#### Configerator: 선언적 설정 관리

Meta의 Configerator는 수백만 대의 서버 설정을 선언적으로 관리한다:
- **Intent**: 설정의 Desired State를 선언 (JSON/Thrift)
- **Execution**: Configerator가 설정 변경을 점진적으로 배포 (canary → gradual rollout)

### 9.3 Netflix

#### Conductor: Workflow Definition(Intent) → Task Execution

Netflix Conductor(현재 오픈소스)는 마이크로서비스 오케스트레이션 플랫폼이다.

```json
{
  "name": "order_fulfillment",
  "description": "주문 처리 워크플로우 (Intent)",
  "version": 1,
  "tasks": [
    {
      "name": "validate_order",
      "taskReferenceName": "validate",
      "type": "SIMPLE"
    },
    {
      "name": "payment_decision",
      "taskReferenceName": "payment_fork",
      "type": "DECISION",
      "caseValueParam": "paymentType",
      "decisionCases": {
        "CREDIT_CARD": [
          { "name": "process_credit_card", "type": "SIMPLE" }
        ],
        "BANK_TRANSFER": [
          { "name": "process_bank_transfer", "type": "SIMPLE" }
        ]
      }
    },
    {
      "name": "ship_order",
      "taskReferenceName": "shipping",
      "type": "SIMPLE"
    },
    {
      "name": "notifications",
      "taskReferenceName": "notify_fork",
      "type": "FORK_JOIN",
      "forkTasks": [
        [{ "name": "send_email", "type": "SIMPLE" }],
        [{ "name": "send_push_notification", "type": "SIMPLE" }]
      ]
    }
  ]
}
```

- **Intent**: 워크플로우 JSON 정의 (어떤 단계를 어떤 순서로)
- **Execution**: Worker가 각 Task를 독립적으로 처리 (폴링 방식)
- 워크플로우 정의만 변경하면 실행 흐름이 바뀜 (Worker 코드 변경 불필요)

#### Chaos Engineering: 실험 정의(Intent) → 자동 실행

Netflix의 Chaos Engineering은 "시스템 탄력성을 검증하기 위해 어떤 장애를 주입할 것인가"(Intent)를 선언하고, Chaos Monkey/Gremlin이 자동으로 실행한다.

### 9.4 Amazon/AWS

#### CloudFormation/CDK: 선언적 인프라

```typescript
// AWS CDK: 프로그래밍 언어로 인프라 Intent 선언
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';

class OrderServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    // Intent: "VPC가 필요하다"
    const vpc = new ec2.Vpc(this, 'OrderVpc', {
      maxAzs: 3,
    });

    // Intent: "ECS 클러스터가 필요하다"
    const cluster = new ecs.Cluster(this, 'OrderCluster', {
      vpc,
      containerInsights: true,
    });

    // Intent: "Fargate 서비스가 필요하다"
    new ecs.FargateService(this, 'OrderService', {
      cluster,
      taskDefinition: this.createTaskDef(),
      desiredCount: 3,
      circuitBreaker: { rollback: true },
    });
  }
}

// Execution: CDK → CloudFormation Template → AWS API Calls
// cdk deploy → CloudFormation이 리소스 생성/업데이트/삭제를 자동 결정
```

#### Step Functions: 상태 머신(Intent) → Lambda Execution

```json
{
  "Comment": "주문 처리 상태 머신 (Intent)",
  "StartAt": "ValidateOrder",
  "States": {
    "ValidateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:validate-order",
      "Next": "ProcessPayment",
      "Catch": [{
        "ErrorEquals": ["ValidationError"],
        "Next": "RejectOrder"
      }]
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:process-payment",
      "Retry": [{
        "ErrorEquals": ["TransientError"],
        "IntervalSeconds": 5,
        "MaxAttempts": 3,
        "BackoffRate": 2
      }],
      "Next": "ShipOrder"
    },
    "ShipOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:ship-order",
      "Next": "Complete"
    },
    "Complete": { "Type": "Succeed" },
    "RejectOrder": { "Type": "Fail" }
  }
}
```

### 9.5 Uber

#### Cadence/Temporal: Durable Execution

Uber가 만든 Cadence(현재 Temporal로 진화)는 **Durable Execution** 패러다임을 구현했다.

```go
// Temporal Workflow: Intent를 Go 코드로 표현하되,
// 실행은 durable하게 (서버가 죽어도 재개 가능)

func OrderWorkflow(ctx workflow.Context, order OrderInput) (OrderResult, error) {
    // Intent: "주문을 검증하라"
    var validationResult ValidationResult
    err := workflow.ExecuteActivity(ctx, ValidateOrder, order).Get(ctx, &validationResult)
    if err != nil {
        return OrderResult{}, err
    }

    // Intent: "결제를 처리하라"
    var paymentResult PaymentResult
    err = workflow.ExecuteActivity(ctx, ProcessPayment, order).Get(ctx, &paymentResult)
    if err != nil {
        // Intent: "결제 실패 시 보상 트랜잭션 실행"
        _ = workflow.ExecuteActivity(ctx, CancelOrder, order.ID).Get(ctx, nil)
        return OrderResult{}, err
    }

    // Intent: "배송을 시작하라"
    var shipmentResult ShipmentResult
    err = workflow.ExecuteActivity(ctx, ShipOrder, order).Get(ctx, &shipmentResult)
    if err != nil {
        // 보상: 결제 환불 + 주문 취소
        _ = workflow.ExecuteActivity(ctx, RefundPayment, paymentResult.PaymentID).Get(ctx, nil)
        _ = workflow.ExecuteActivity(ctx, CancelOrder, order.ID).Get(ctx, nil)
        return OrderResult{}, err
    }

    return OrderResult{
        OrderID:    order.ID,
        PaymentID:  paymentResult.PaymentID,
        TrackingID: shipmentResult.TrackingID,
    }, nil
}

// Execution: 각 Activity는 독립적인 Worker에서 실행
// - Workflow의 실행 상태는 Temporal Server가 영구 보관
// - Worker가 죽어도 다른 Worker가 이어받아 실행
// - Replay: 동일한 Workflow 코드를 재실행하여 상태 복원
```

핵심 혁신:
- **Workflow(Intent)가 일반적인 프로그래밍 언어로 표현**됨 (DSL이 아님)
- **Durable Execution**: 서버 장애에도 Workflow 상태가 보존
- **Activity(Execution)가 Worker에서 독립적으로 실행**되어 확장 가능

### 9.6 Stripe

#### Payment Intents API

Stripe의 Payment Intents API는 API 이름 자체에 "Intent"를 사용한 대표적 사례이다.

```python
import stripe

# Intent 생성: "이 결제를 처리하겠다"는 의도를 선언
payment_intent = stripe.PaymentIntent.create(
    amount=2000,           # $20.00
    currency="usd",
    payment_method_types=["card"],
    metadata={
        "order_id": "order_123",
        "customer_id": "cust_456",
    },
)

# 이 시점에서 결제는 아직 실행되지 않음
# payment_intent.status = "requires_payment_method"

# 상태 머신 (Intent의 생명주기):
# requires_payment_method → requires_confirmation → requires_action
# → processing → succeeded / requires_capture / canceled

# Execution: 결제 확인 (클라이언트에서)
payment_intent = stripe.PaymentIntent.confirm(
    payment_intent.id,
    payment_method="pm_card_visa",
)
# payment_intent.status = "succeeded"
```

```
Stripe Payment Intent 상태 머신:

  [requires_payment_method]
          |
          v (attach payment method)
  [requires_confirmation]
          |
          v (confirm)
  [requires_action]  ←── 3D Secure 등 추가 인증 필요
          |
          v (complete action)
  [processing]
          |
     +----+----+
     |         |
     v         v
[succeeded] [requires_capture]  ←── 수동 캡처 모드
                    |
                    v (capture)
              [succeeded]

어느 단계에서든: → [canceled]
```

핵심 설계:
- **Intent(결제 의도)와 Execution(실제 결제)의 명시적 분리**
- **상태 머신**: Intent가 여러 단계를 거쳐 Execution으로 진행
- **Idempotency Key**: 동일 Intent를 여러 번 전송해도 한 번만 처리

### 9.7 HashiCorp

#### Terraform: HCL(Intent) → Provider(Execution) → State Reconciliation

```hcl
# Intent: HCL로 Desired State 선언
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}
```

```
Terraform 실행 흐름:

[HCL 파일 (Intent)]
        |
        v
[terraform plan]
        |
        v
[State 파일과 비교]  ←── terraform.tfstate (Current State)
        |
        v
[실행 계획 생성]
  + aws_vpc.main (create)
  ~ aws_subnet.public[0] (update in-place)
  - aws_subnet.old (destroy)
        |
        v
[terraform apply] → [AWS Provider (Execution)] → [AWS API]
        |
        v
[State 파일 업데이트] → terraform.tfstate
```

#### Consul Intentions: Service 통신 의도 → 네트워크 정책 집행

```hcl
# Intent: "웹 서비스는 API 서비스와 통신할 수 있다"
resource "consul_intention" "web_to_api" {
  source_name      = "web"
  destination_name = "api"
  action           = "allow"
}

# Intent: "외부에서 DB로의 직접 접근은 거부한다"
resource "consul_intention" "deny_external_db" {
  source_name      = "*"
  destination_name = "database"
  action           = "deny"
}

# Execution: Consul이 Envoy Proxy의 설정을 자동으로 생성하여
# 네트워크 수준에서 이 정책을 집행
```

### 9.8 AI/LLM 시대

#### OpenAI Function Calling: LLM Intent → System Execution

```python
# Tool 정의 (Execution 인터페이스)
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "지정된 도시의 현재 날씨를 조회합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "도시 이름"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["city"]
            }
        }
    }
]

# LLM이 자연어 Intent를 Tool Call로 변환
response = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "서울 날씨 어때?"}],
    tools=tools,
)

# LLM의 Intent 표현:
# tool_calls: [{ function: { name: "get_weather", arguments: '{"city": "Seoul", "unit": "celsius"}' } }]

# System이 Execution 수행:
weather = get_weather(city="Seoul", unit="celsius")
```

#### LangChain Plan-and-Execute

```python
# Plan-and-Execute: 명시적 Intent/Execution 분리

from langchain.agents import PlanAndExecute

# Planner (Intent 생성): 작업을 단계별 계획으로 분해
# Step 1: 고객 정보 조회
# Step 2: 최근 주문 이력 확인
# Step 3: 분석 결과 요약

# Executor (Execution): 각 단계를 독립적으로 실행
# Step 1 → search_customer(name="김철수") → {id: "C001", ...}
# Step 2 → get_orders(customer_id="C001") → [{...}, {...}]
# Step 3 → summarize(data=...) → "김철수 고객은..."
```

#### MCP (Model Context Protocol): Tool Definition → Invocation → Execution

```python
# MCP: Tool의 정의(Intent Interface)와 실행(Execution)을 표준화

# Server: Tool 정의 (Execution 제공)
@mcp.tool()
def query_database(sql: str) -> str:
    """SQL 쿼리를 실행하고 결과를 반환합니다"""
    return db.execute(sql)

@mcp.tool()
def send_notification(user_id: str, message: str) -> bool:
    """사용자에게 알림을 발송합니다"""
    return notification_service.send(user_id, message)

# Client (LLM): Tool을 발견하고 Intent를 표현
# LLM: "query_database를 호출하여 VIP 고객 목록을 조회하겠습니다"
# → Tool Call: query_database(sql="SELECT * FROM customers WHERE tier='VIP'")
# → Execution: DB 서버에서 쿼리 실행
# → Result: LLM에게 결과 반환
```

### 9.9 빅테크 공통 교훈 5가지

모든 빅테크 사례에서 공통적으로 발견되는 교훈:

| # | 교훈 | 상세 | 사례 |
|---|------|------|------|
| **1** | **Idempotency는 필수** | Intent가 여러 번 전달될 수 있으므로, Execution은 반드시 멱등해야 한다 | Stripe Idempotency Key, K8s Apply, Terraform Plan |
| **2** | **Observability 없이 디버깅 불가능** | Intent와 Execution이 분리되면, 둘 사이의 흐름을 추적할 수 있는 관찰 도구가 필수 | Google Dapper, Uber Jaeger, AWS X-Ray |
| **3** | **Intent 변경의 점진적 적용이 어려움** | 선언적 시스템에서 "10% 사용자에게만 새 설정 적용"이 구조적으로 어려움 | K8s Canary Deploy, Terraform Workspace, Feature Flag |
| **4** | **분리 경계에서 성능 비용 발생** | 직렬화/역직렬화, 네트워크 호출, 상태 동기화 등 오버헤드가 존재 | Virtual DOM diff 비용, Event Sourcing replay 비용 |
| **5** | **Imperative→Declarative 전환은 문화적 도전** | 개발자가 "어떻게"에서 "무엇을"로 사고 방식을 전환해야 함 | jQuery→React, 셸 스크립트→Terraform, RPC→Event |

---

## 10. 소프트웨어를 넘어: 다른 분야의 Intent/Execution 분리

Intent/Execution 분리는 소프트웨어에만 국한되지 않는다. 인류 문명의 모든 복잡한 시스템에서 같은 구조가 발견된다.

### 10.1 법률: 입법(Intent) vs 집행(Execution) vs 사법(Verification)

```
법률 시스템의 3계층 분리:

[입법부 (Legislative)] — Intent Layer
  "살인은 형벌에 처한다" (무엇이 금지되는가)
  - 추상적 규칙(법률)을 선언
  - 구체적 집행 방법은 포함하지 않음
  - Policy-Mechanism 분리와 동일 구조
        |
        v
[행정부/경찰 (Executive)] — Execution Layer
  구체적 수사, 체포, 기소 절차
  - 법률(Intent)을 해석하여 집행
  - 다양한 집행 방법 중 선택
  - 법률 변경 없이 집행 방법 변경 가능
        |
        v
[사법부 (Judicial)] — Verification Layer
  Intent(법률)와 Execution(집행)이 일치하는지 검증
  - 위헌 심사: Intent 자체의 유효성 검증
  - 판례: Intent의 해석 기준 확립
```

소프트웨어와의 유사성:
- **법률 = Policy/Rego**: 규칙을 선언적으로 기술
- **경찰 = Policy Engine**: 규칙을 해석하여 집행
- **법원 = Verification/Audit**: 집행이 규칙에 부합하는지 검증

### 10.2 군사: Auftragstaktik (임무형 지휘) — Commander's Intent

독일 군대의 Auftragstaktik(임무형 전술)은 Intent/Execution 분리의 군사적 구현이다.

```
전통적 지휘 (Imperative):
  지휘관: "A부대는 07:00에 좌측으로, B부대는 07:30에 우측으로,
           C부대는 08:00에 중앙을 돌파하라"
  → 상황 변화 시 모든 부대가 새 명령을 기다림
  → 통신 두절 시 마비

Auftragstaktik (Intent-based):
  Commander's Intent: "내일 일몰 전까지 고지 확보.
                       적의 보급로를 차단하는 것이 목적"
  → 각 부대가 상황에 맞게 자율적으로 Execution 결정
  → 통신 두절 시에도 Intent를 기반으로 독립 행동
  → 예상치 못한 기회를 활용 가능
```

소프트웨어와의 유사성:
- **Commander's Intent = Desired State**: "이 상태에 도달하라"
- **각 부대의 자율적 판단 = Reconciliation**: 현장 상황에 맞게 실행 방법 결정
- **통신 두절에도 작동 = Self-healing**: 시스템 일부가 고장나도 목표를 향해 진행

### 10.3 경영: OKR — Objectives(Intent) vs Initiatives(Execution) vs Key Results(Verification)

```
OKR 프레임워크:

Objective (Intent):
  "고객 만족도를 업계 최고 수준으로 끌어올린다"
  - 방향성과 목표만 제시
  - 구체적 실행 방법은 포함하지 않음
        |
        v
Initiatives / Key Actions (Execution):
  - 고객 지원 응답 시간을 5분 이내로 단축
  - NPS 조사 분기별 실시
  - 자동 응답 챗봇 도입
  - 고객 피드백 기반 제품 개선 프로세스 구축
        |
        v
Key Results (Verification):
  - NPS 점수 70점 이상 달성
  - 고객 지원 응답 시간 평균 3분 이내
  - 재구매율 60% 이상
```

소프트웨어와의 유사성:
- **Objective = Intent**: "무엇을 달성할 것인가"
- **Initiatives = Execution**: "어떻게 달성할 것인가"
- **Key Results = Metrics/Observability**: 달성 여부를 측정

### 10.4 건축: 설계도(Intent) vs 시공(Execution)

```
건축의 분리 구조:

[건축주의 요구] — Business Intent
  "100가구가 살 수 있는, 채광이 좋은 아파트"
        |
        v
[설계도면 (Architectural Drawing)] — Technical Intent
  - 평면도, 입면도, 단면도, 구조 계산서
  - "어떤 건물이어야 하는가"를 명세
  - Intent를 상세 명세로 변환하는 비용이 전체의 70-75%
        |
        v
[시공 (Construction)] — Execution
  - 콘크리트 타설, 배관, 전기, 마감
  - 설계도면대로 건축
  - 현장 상황에 따라 일부 조정 (shop drawing)
        |
        v
[감리 (Inspection)] — Verification
  - 시공이 설계도면(Intent)에 부합하는지 검증
```

핵심 통찰:
- **Intent → 명세 변환 비용이 70-75%**: 소프트웨어에서도 요구사항(Intent) 정의가 전체 비용의 대부분을 차지
- **설계 변경(Intent 변경)은 시공 중에도 발생**: 소프트웨어의 요구사항 변경과 동일한 문제

### 10.5 음악: 악보(Intent) vs 연주(Execution)

```
음악의 분리 구조:

[작곡가 (Composer)] — Intent Creator
  악보에 "무엇을 연주해야 하는가"를 기술
  - 음높이, 리듬, 다이나믹 (forte, piano)
  - 하지만: 정확한 템포, 비브라토, 감정의 뉘앙스는 불완전하게 기술
        |
        v
[악보 (Score)] — Intent Document
  - 선언적: "이 음을 이 리듬으로"
  - 불완전함: 모든 연주 세부사항을 담을 수 없음
  - 해석의 여지가 있음 (ambiguity)
        |
        v
[연주자 (Performer)] — Executor
  - 악보(Intent)를 해석하여 실제 소리로 변환
  - 같은 악보에서도 다른 연주가 나옴 (카라얀 vs 번스타인)
  - 연주자의 재량(discretion)이 결과에 큰 영향
```

핵심 통찰:
- **Intent 명세는 항상 불완전**: 악보가 모든 연주 세부사항을 담을 수 없듯, Intent가 모든 Execution 결정을 미리 내릴 수 없음
- **Executor의 역량이 결과 품질을 결정**: SQL의 Query Optimizer, K8s의 Scheduler처럼 Execution 계층의 품질이 중요
- **동일 Intent, 다른 Execution**: 같은 K8s manifest도 클라우드 Provider에 따라 다르게 실행

### 10.6 요리: 레시피(Intent) vs 조리(Execution)

```
요리의 분리 구조:

[레시피 (Recipe)] — Intent
  "양파를 투명해질 때까지 볶으세요"
  - "투명해질 때까지"는 주관적 (ambiguous intent)
  - 정확한 온도, 시간은 주방 환경에 따라 다름
        |
        v
[조리 (Cooking)] — Execution
  - 레시피를 해석하여 실제 조리
  - 암묵적 지식(tacit knowledge)이 필요:
    * "중간 불"은 가스레인지마다 다름
    * "적당히"는 경험에 의존
    * "양파가 투명해질 때"는 시각적 판단
        |
        v
[맛 (Taste)] — Verification
  - 결과물이 Intent(레시피의 의도)에 부합하는지 확인
```

핵심 통찰:
- **암묵적 지식(Tacit Knowledge)**: Intent가 명시적으로 표현할 수 없는 지식이 Execution에 필요
- 소프트웨어에서도 동일: "성능을 최적화하라"는 Intent만으로는 부족, Execution 계층의 전문성 필요

### 10.7 보편적 구조 비교표

| 분야 | Intent Layer | Execution Layer | Verification Layer | 특이사항 |
|------|-------------|----------------|-------------------|----------|
| **법률** | 법률/법규 | 경찰/행정기관 | 법원/감사원 | 3권 분립 자체가 분리 구조 |
| **군사** | Commander's Intent | 각 부대의 전술적 판단 | 전투 후 검토(AAR) | 통신 두절에도 작동해야 함 |
| **경영** | OKR Objectives | Initiatives/Projects | Key Results 측정 | 분기별 Reconciliation |
| **건축** | 설계도면 | 시공 | 감리 | Intent→명세 비용이 70-75% |
| **음악** | 악보 | 연주 | 청중/비평가 평가 | Intent가 본질적으로 불완전 |
| **요리** | 레시피 | 조리 | 시식 | 암묵적 지식 의존 |
| **의학** | 진단/처방 | 투약/수술 | 경과 관찰 | 생명이 걸린 Feedback Loop |
| **교육** | 교육과정 | 수업 | 평가/시험 | Executor(교사) 재량 큼 |
| **소프트웨어** | SQL/YAML/Command | Optimizer/Controller/Handler | Test/Monitoring | 자동화 수준 가장 높음 |

이 표에서 드러나는 보편적 패턴:

1. **모든 복잡한 시스템은 3계층(Intent-Execution-Verification) 구조를 갖는다**
2. **Intent Layer는 항상 불완전하다** — 모든 상황을 미리 규정할 수 없음
3. **Execution Layer의 품질이 결과를 결정한다** — 같은 Intent도 Executor에 따라 결과가 다름
4. **Verification Layer 없이는 시스템이 드리프트한다** — Feedback Loop 필수

---

## 11. 미래 전망

### 11.1 Intent-based Networking 심층

네트워크 관리는 Imperative(CLI 명령)에서 Declarative(Intent 선언)으로 전환 중이다.

```
네트워크 관리의 진화:

Phase 1: CLI (Imperative)
  $ configure terminal
  $ interface GigabitEthernet 0/1
  $ ip address 192.168.1.1 255.255.255.0
  $ no shutdown
  → 장비마다 개별 설정, 실수 위험, 확장 불가

Phase 2: Script/Automation (Semi-Imperative)
  Ansible Playbook으로 CLI 명령 자동화
  → 여전히 "어떻게"를 기술, 상태 관리 없음

Phase 3: Policy-based (Declarative)
  OpenConfig/YANG 모델로 Desired State 선언
  → 벤더 중립적 데이터 모델

Phase 4: Intent-based (Fully Declarative)
  Cisco IBN / Apstra: "이 애플리케이션은 99.9% 가용성이 필요하다"
  → 시스템이 자동으로 네트워크 토폴로지, 라우팅, QoS 설정
```

주요 플레이어:

| 시스템 | Intent 표현 | Execution 엔진 | 특징 |
|--------|------------|---------------|------|
| **Cisco IBN (DNA Center)** | 비즈니스 의도 (GUI/API) | SD-WAN/ACI Controller | 네트워크 전체를 단일 Intent로 관리 |
| **Apstra (Juniper)** | Intent 기반 데이터센터 네트워크 | Apstra AOS | 벤더 중립, Graph DB 기반 상태 관리 |
| **OpenConfig/YANG** | YANG 모델 (데이터 스키마) | gNMI/NETCONF | 표준 기반, 벤더 중립적 인터페이스 |

### 11.2 Infrastructure as Code 진화

IaC의 진화는 Intent 표현 수준의 상승 역사이기도 하다.

```
IaC 진화 연대표:

1993  CFEngine     Promise Theory → Desired State
2005  Puppet       Ruby DSL → 리소스 추상화
2009  Chef         Ruby DSL → 레시피/쿡북
2012  Ansible      YAML → 에이전트리스, 절차적/선언적 혼합
2014  Terraform    HCL → 벤더 중립적 선언적 IaC
2018  Pulumi       범용 프로그래밍 언어 (TypeScript, Python, Go)
2019  AWS CDK      TypeScript/Python → CloudFormation 추상화
2024+ AI-assisted  자연어 → IaC 코드 자동 생성
```

```
추상화 수준 상승:

[Promise Theory]     [DSL]          [HCL]          [범용 언어]      [자연어]
  CFEngine          Puppet/Chef     Terraform       Pulumi/CDK      AI IaC

  "파일이 이 상태    "패키지가       "AWS EC2가      new ec2.Vpc()   "3개의 서버가
   여야 한다"        설치되어야"     이렇게 있어야"                    필요해"

  매우 낮은 수준  →  리소스 수준  →  인프라 수준  →  프로그래밍  →  자연어
```

핵심 트렌드:
- **Intent 표현이 점점 더 고수준으로**: 기계 수준 → 리소스 수준 → 비즈니스 수준 → 자연어
- **Execution 자동화가 점점 더 지능적으로**: 수동 → 스크립트 → Controller → AI

### 11.3 AI Agent의 Intent-Execution 분리

#### ReAct: Reasoning + Acting Interleave

```
ReAct Pattern:

User Intent: "서울에서 부산까지 가장 빠른 교통수단은?"

Thought 1: 서울-부산 교통수단을 비교해야 한다.
Action 1: search("서울 부산 교통수단 소요시간 비교")
Observation 1: KTX 2시간 30분, 비행기 1시간(+대기 2시간), 고속버스 4시간...
Thought 2: 총 소요시간 기준으로 KTX가 가장 빠르다.
Action 2: search("서울 부산 KTX 시간표")
Observation 2: 매일 06:00 ~ 22:00, 15분 간격...
Answer: KTX가 가장 빠르며, 약 2시간 30분 소요됩니다.
```

ReAct는 Reasoning(Intent 수립)과 Acting(Execution)을 **교대로** 수행한다. 계획을 미리 완전히 세우지 않고, 실행 결과를 보면서 점진적으로 Intent를 구체화한다.

#### Plan-and-Execute: 명시적 분리

```
Plan-and-Execute Pattern:

User Intent: "내 GitHub 저장소의 모든 보안 취약점을 분석하고 수정해줘"

[Planner (Intent 수립)]
  Plan:
    Step 1: GitHub 저장소 목록 조회
    Step 2: 각 저장소에서 dependency 파일 분석
    Step 3: CVE 데이터베이스와 매칭
    Step 4: 취약점 심각도별 정렬
    Step 5: 자동 수정 가능한 항목 PR 생성

[Executor (Execution)]
  Step 1 → github.list_repos() → ["repo-a", "repo-b", ...]
  Step 2 → github.get_file("repo-a", "package.json") → {dependencies: ...}
  Step 3 → cve.search("lodash@4.17.15") → [CVE-2021-23337, ...]
  Step 4 → sort_by_severity([...]) → [CRITICAL: 2, HIGH: 5, ...]
  Step 5 → github.create_pr("repo-a", "fix: update lodash to 4.17.21")
```

Plan-and-Execute는 ReAct와 달리 **명시적으로 Plan(Intent)을 먼저 수립**하고, 그 다음 Execute(Execution)한다.

#### MCP: Tool Definition(Intent Interface) → Execution

```
MCP의 분리 구조:

[MCP Server]
  - Tool 정의 (Intent Interface):
    "search_database: SQL 쿼리를 실행합니다"
    "send_email: 이메일을 발송합니다"
  - Resource 제공: 데이터 접근 인터페이스
  - Prompt 템플릿: 특정 작업에 최적화된 프롬프트

[MCP Client (LLM)]
  - Tool을 발견(Discovery)
  - Intent를 Tool Call로 변환
  - 결과를 사용자에게 전달

[분리 지점]
  - LLM은 Tool의 내부 구현을 알지 못함
  - Tool은 LLM의 추론 과정을 알지 못함
  - MCP Protocol이 Contract 역할
```

#### Multi-Agent Systems: Orchestrator(Intent) → Workers(Execution)

```
Multi-Agent 분리 구조:

[Orchestrator Agent (Intent)]
  "이 프로젝트를 분석하고 리팩토링하라"
        |
        +--[Architect Agent] → 아키텍처 분석
        +--[Explorer Agent]  → 코드베이스 탐색
        +--[Executor Agent]  → 코드 변경 실행
        +--[QA Agent]        → 테스트/검증

  Orchestrator는 "무엇을" 각 Agent에게 위임
  각 Agent는 "어떻게"를 자율적으로 결정
```

### 11.4 미래: Natural Language as Intent

#### 자연어가 궁극의 Intent 표현 수단

```
Intent 표현의 진화 (1958 → 2030):

1958: LISP S-expression
  (defun max-value (lst) (reduce #'max lst))

1974: SQL
  SELECT MAX(value) FROM items;

2014: Terraform HCL
  resource "aws_instance" "web" { count = 3 }

2024: 자연어 + AI
  "서버 3대를 프로비저닝해줘"

2030?: 순수 Intent
  "이 서비스가 항상 사용 가능하도록 해줘"
  → 시스템이 자율적으로: 서버 프로비저닝, 로드 밸런싱,
    장애 복구, 스케일링, 모니터링을 결정하고 실행
```

#### Self-healing Systems: Intent를 자율적으로 유지

```
Self-healing System:

[Intent 선언]
  "이 서비스는 99.99% 가용성을 유지해야 한다"
        |
        v
[Autonomous System]
  - 장애 감지: 자동
  - 원인 분석: 자동 (AI 기반)
  - 복구 실행: 자동 (Runbook 자동화)
  - 재발 방지: 자동 (패턴 학습)

  인간 개입: Intent 변경 시에만
```

#### Intent-driven Development: 인간은 Intent, AI는 Execution

```
미래의 개발 워크플로우:

[인간 (Product Owner)]
  "사용자가 소셜 로그인으로 가입하고,
   프로필을 편집하고,
   다른 사용자를 팔로우할 수 있어야 합니다"
        |
        v
[AI Planning Agent (Intent 구체화)]
  - 요구사항 분석
  - 아키텍처 설계
  - API 설계
  - 데이터 모델 설계
        |
        v
[AI Execution Agents (코드 생성/테스트)]
  - 코드 구현
  - 테스트 작성
  - 인프라 프로비저닝
  - CI/CD 파이프라인 설정
        |
        v
[AI Verification Agent (검증)]
  - 코드 리뷰
  - 보안 검증
  - 성능 테스트
  - 사용자 테스트
        |
        v
[인간 (최종 승인)]
  Intent(요구사항)에 부합하는지 확인
```

이 미래에서 프로그래머의 역할은:
- **Intent를 명확하게 표현하는 능력**이 핵심
- **Execution(코딩)은 AI가 수행**
- **Verification(검증)은 인간과 AI가 협업**
- Intent/Execution 분리의 원리를 이해하는 것이 "AI 시대의 프로그래밍 역량"

---

## 12. 마이그레이션 가이드

### 12.1 모놀리식→분리: 4단계 점진적 전환

기존의 Intent/Execution이 뒤섞인 코드를 점진적으로 분리하는 방법. **Strangler Fig Pattern**을 활용한다.

#### Step 1: 관찰 (Intent 로깅만 추가)

기존 코드는 변경하지 않고, Intent에 해당하는 부분을 로깅만 추가한다.

```python
# BEFORE: Intent와 Execution이 뒤섞인 코드
class OrderService:
    def place_order(self, customer_id, items):
        # 유효성 검증
        customer = self.db.query(f"SELECT * FROM customers WHERE id = {customer_id}")
        if not customer:
            raise ValueError("고객 없음")

        # 재고 확인
        for item in items:
            stock = self.db.query(f"SELECT stock FROM products WHERE id = {item['id']}")
            if stock < item['quantity']:
                raise ValueError("재고 부족")

        # 주문 생성
        order_id = self.db.insert("INSERT INTO orders ...")

        # 결제
        self.stripe.charge(customer['card_id'], total)

        # 이메일
        self.smtp.send(customer['email'], "주문 확인", "...")

        return order_id

# AFTER Step 1: Intent 로깅만 추가 (기존 코드 변경 없음)
import logging

class OrderService:
    def place_order(self, customer_id, items):
        # [추가] Intent 로깅
        logging.info("Intent: CreateOrder", extra={
            "intent_type": "CreateOrder",
            "customer_id": customer_id,
            "items": items,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # ... 기존 코드 그대로 ...

        # [추가] 결과 로깅
        logging.info("Intent completed: CreateOrder", extra={
            "intent_type": "CreateOrder",
            "order_id": order_id,
            "success": True,
        })

        return order_id
```

**이 단계의 가치**: 현재 시스템의 Intent 패턴을 파악. "어떤 종류의 Intent가 얼마나 자주 발생하는가?"를 데이터로 확인.

#### Step 2: Intent 객체 추출 (동기 실행 유지)

Intent를 별도의 객체로 추출하되, Execution은 동기적으로 유지한다.

```python
# Step 2: Intent 객체 추출
from dataclasses import dataclass
from typing import List

@dataclass(frozen=True)
class CreateOrderIntent:
    customer_id: str
    items: List[dict]
    correlation_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

class OrderService:
    def place_order(self, customer_id: str, items: list) -> str:
        # Intent 객체 생성
        intent = CreateOrderIntent(
            customer_id=customer_id,
            items=items,
        )

        # Intent 기록
        self.intent_store.save(intent)

        # Execution (아직 동기적)
        return self.order_handler.handle(intent)

class CreateOrderHandler:
    """Execution: Intent를 실제로 처리"""

    def handle(self, intent: CreateOrderIntent) -> str:
        customer = self.customer_repo.find_by_id(intent.customer_id)
        if not customer:
            raise CustomerNotFoundError(intent.customer_id)

        self.inventory_service.check_stock(intent.items)
        order = Order.create(intent.customer_id, intent.items)
        self.order_repo.save(order)
        self.payment_service.charge(customer, order.total)
        self.notification_service.send_confirmation(customer, order)

        return order.id
```

#### Step 3: Execution 테스트 강화 (Mock Executor)

Intent와 Execution이 분리되었으므로, Mock Executor로 독립적 테스트가 가능해진다.

```python
# Step 3: Mock Executor를 사용한 테스트

class TestCreateOrder:
    def setup(self):
        self.customer_repo = InMemoryCustomerRepo()
        self.order_repo = InMemoryOrderRepo()
        self.payment_service = MockPaymentService()
        self.notification_service = MockNotificationService()
        self.inventory_service = MockInventoryService()

        self.handler = CreateOrderHandler(
            customer_repo=self.customer_repo,
            order_repo=self.order_repo,
            payment_service=self.payment_service,
            notification_service=self.notification_service,
            inventory_service=self.inventory_service,
        )

    def test_successful_order(self):
        # Given
        self.customer_repo.save(Customer(id="C001", name="Kim"))
        self.inventory_service.set_stock("P001", 10)

        intent = CreateOrderIntent(
            customer_id="C001",
            items=[{"id": "P001", "quantity": 2}],
        )

        # When
        order_id = self.handler.handle(intent)

        # Then
        assert order_id is not None
        assert self.order_repo.find_by_id(order_id) is not None
        assert self.payment_service.was_charged("C001")
        assert self.notification_service.was_notified("C001")

    def test_payment_failure_rolls_back(self):
        # Given
        self.customer_repo.save(Customer(id="C001", name="Kim"))
        self.inventory_service.set_stock("P001", 10)
        self.payment_service.simulate_failure()

        intent = CreateOrderIntent(
            customer_id="C001",
            items=[{"id": "P001", "quantity": 2}],
        )

        # When & Then
        with pytest.raises(PaymentError):
            self.handler.handle(intent)

        # 주문이 생성되지 않았는지 확인
        assert len(self.order_repo.find_all()) == 0
```

#### Step 4: 비동기 큐 도입 (완전한 분리)

마지막으로 Message Queue를 도입하여 Intent 발행과 Execution을 완전히 분리한다.

```python
# Step 4: 비동기 큐 도입

class OrderService:
    def place_order(self, customer_id: str, items: list) -> str:
        intent = CreateOrderIntent(
            customer_id=customer_id,
            items=items,
        )

        # 유효성 검증만 동기적으로
        self.validator.validate(intent)

        # Intent를 큐에 발행 (비동기)
        self.message_queue.publish(
            topic="orders.create",
            message=intent.to_dict(),
            idempotency_key=intent.correlation_id,
        )

        # 즉시 응답 (Execution 완료를 기다리지 않음)
        return intent.correlation_id

# Consumer: 별도 프로세스에서 실행
class CreateOrderConsumer:
    @subscribe("orders.create")
    async def handle(self, message: dict):
        intent = CreateOrderIntent.from_dict(message)

        try:
            order_id = await self.handler.handle(intent)

            # Feedback: 성공 이벤트 발행
            await self.message_queue.publish(
                topic="orders.created",
                message={"order_id": order_id, "correlation_id": intent.correlation_id},
            )
        except Exception as e:
            # Feedback: 실패 이벤트 발행
            await self.message_queue.publish(
                topic="orders.creation_failed",
                message={
                    "correlation_id": intent.correlation_id,
                    "error": str(e),
                    "retryable": isinstance(e, RetryableError),
                },
            )
```

### 12.2 명령형→선언적 전환 패턴

기존의 명령형 코드를 선언적/Reconciliation 기반으로 전환하는 패턴.

```python
# BEFORE: 명령형 서버 설정 스크립트
def setup_server(server):
    # 패키지 설치
    server.run("apt-get update")
    server.run("apt-get install -y nginx")

    # 설정 파일 복사
    server.upload("/etc/nginx/nginx.conf", nginx_config)

    # 서비스 시작
    server.run("systemctl start nginx")
    server.run("systemctl enable nginx")

    # 방화벽 설정
    server.run("ufw allow 80/tcp")
    server.run("ufw allow 443/tcp")

# 문제:
# 1. 이미 nginx가 설치되어 있으면? → 에러 또는 불필요한 재설치
# 2. 설정 파일이 수동으로 변경되었으면? → 감지 불가
# 3. 두 번 실행하면? → 멱등하지 않을 수 있음


# AFTER: Reconciliation 기반 (선언적)
@dataclass
class ServerDesiredState:
    packages: List[str]
    files: Dict[str, str]  # path → content
    services: Dict[str, str]  # name → status ("running", "stopped")
    firewall_rules: List[str]

class ServerReconciler:
    def reconcile(self, server, desired: ServerDesiredState):
        # Phase 1: 현재 상태 수집
        current = self.get_current_state(server)

        # Phase 2: 차이 계산
        missing_packages = set(desired.packages) - set(current.packages)
        extra_packages = set(current.packages) - set(desired.packages)

        changed_files = {
            path: content
            for path, content in desired.files.items()
            if current.files.get(path) != content
        }

        service_changes = {
            name: status
            for name, status in desired.services.items()
            if current.services.get(name) != status
        }

        # Phase 3: 차이만 적용 (멱등)
        for pkg in missing_packages:
            server.install_package(pkg)

        for path, content in changed_files.items():
            server.write_file(path, content)

        for name, status in service_changes.items():
            if status == "running":
                server.start_service(name)
            else:
                server.stop_service(name)

        # Phase 4: 결과 보고
        return ReconciliationReport(
            packages_installed=list(missing_packages),
            files_changed=list(changed_files.keys()),
            services_changed=list(service_changes.keys()),
            already_reconciled=not (missing_packages or changed_files or service_changes),
        )

# 사용
desired = ServerDesiredState(
    packages=["nginx", "certbot"],
    files={"/etc/nginx/nginx.conf": nginx_config},
    services={"nginx": "running"},
    firewall_rules=["80/tcp", "443/tcp"],
)

report = reconciler.reconcile(server, desired)
# 몇 번을 실행해도 같은 결과 (멱등)
# 수동 변경이 감지되면 자동 복구 (self-healing)
```

### 12.3 마이그레이션 체크리스트

| 단계 | 확인 항목 | 완료 기준 |
|------|----------|-----------|
| **Step 1** | Intent 로깅 추가 | 모든 주요 비즈니스 동작에 Intent 로그 존재 |
| **Step 1** | Intent 패턴 분석 | 상위 10개 Intent 유형과 빈도 파악 |
| **Step 2** | Intent 객체 추출 | Intent가 별도의 data class/interface로 정의됨 |
| **Step 2** | Handler 분리 | Intent 처리 로직이 별도 Handler 클래스에 존재 |
| **Step 3** | 단위 테스트 | Mock Executor를 사용한 Intent 테스트 존재 |
| **Step 3** | 통합 테스트 | 실제 Executor를 사용한 end-to-end 테스트 존재 |
| **Step 4** | 비동기 큐 도입 | Intent가 Message Queue를 통해 전달됨 |
| **Step 4** | Feedback Loop | Execution 결과가 이벤트로 발행됨 |
| **Step 4** | Dead Letter Queue | 실패한 Intent의 수동 처리 프로세스 존재 |
| **Step 4** | Idempotency | 동일 Intent 중복 실행 시 결과 동일 |
| **Step 4** | Observability | Correlation ID로 Intent→Execution 추적 가능 |

---

## 13. 핵심 요약

| # | 원칙 | 내용 | 실천 방법 |
|---|------|------|-----------|
| **1** | **Intent = What** | Intent는 "무엇을 달성해야 하는가"만 기술한다. Execution 세부사항(DB 종류, 프로토콜, 재시도 횟수)은 포함하지 않는다. | Command/Event 객체, YAML/HCL, SQL 쿼리 |
| **2** | **Execution = How** | Execution은 Intent를 받아 "어떻게 달성할 것인가"를 결정한다. Intent 변경 없이 교체 가능해야 한다. | Handler, Controller, Provider, Optimizer |
| **3** | **Contract 정의** | Intent와 Execution 사이의 경계는 명시적 Contract(Input/Output/Error)로 정의해야 한다. | TypeScript Interface, Protobuf, JSON Schema |
| **4** | **Idempotency** | 같은 Intent를 여러 번 실행해도 결과가 동일해야 한다. 분산 시스템에서 필수. | Idempotency Key, Check-then-Act |
| **5** | **Feedback Loop** | Execution 결과는 반드시 Intent 발행자에게 전달되어야 한다. 없으면 시스템이 드리프트한다. | Event, Webhook, Polling, SSE |
| **6** | **Reconciliation** | Desired State와 Current State의 차이를 지속적으로 해소하는 루프. Self-healing의 기반. | K8s Controller, Terraform Plan/Apply |
| **7** | **점진적 마이그레이션** | 모놀리식에서 한 번에 분리하지 말고, Strangler Fig Pattern으로 4단계에 걸쳐 점진적으로 전환. | 로깅 → 객체 추출 → 테스트 → 비동기 큐 |

```
최종 정리: Intent/Execution 분리의 보편 구조

+-------------------+     Contract     +--------------------+
|   Intent Layer    | ───────────────> |  Execution Layer   |
|                   |                  |                    |
|  What to achieve  |  - Interface     |  How to achieve    |
|  Desired State    |  - Schema        |  Reconciliation    |
|  Policy           |  - Protocol      |  Mechanism         |
|  Command/Event    |  - Idempotency   |  Handler/Worker    |
|                   |  - Versioning    |                    |
+-------------------+                  +--------------------+
        |                                       |
        v                                       v
  [Audit/Log]                            [Observability]
  "무슨 의도였나"                         "어떻게 실행되었나"
        |                                       |
        +------- Feedback Loop --------+--------+
                                       |
                                       v
                              [Verification Layer]
                              "의도대로 되었는가?"
```

---

## 14. 참고 문헌

### 학술 논문/서적

| 참고 자료 | 저자 | 연도 | 핵심 기여 |
|-----------|------|------|-----------|
| *On the role of scientific thought* (EWD447) | Edsger Dijkstra | 1974 | Separation of Concerns 공식화 |
| *On the Criteria To Be Used in Decomposing Systems into Modules* | David Parnas | 1972 | Information Hiding 원칙 |
| *Can Programming Be Liberated from the von Neumann Style?* | John Backus | 1978 | Von Neumann Bottleneck 비판, FP 옹호 |
| *The Nucleus of a Multiprogramming System* | Per Brinch Hansen | 1970 | Policy-Mechanism 분리 원형 |
| *Hints for Computer System Design* | Butler Lampson | 1983 | 시스템 설계의 실용적 원칙 |
| *Object-Oriented Software Construction* | Bertrand Meyer | 1988 | CQS (Command-Query Separation) |
| *Design Patterns: Elements of Reusable OO Software* | Gamma, Helm, Johnson, Vlissides (GoF) | 1994 | Command Pattern, Strategy Pattern 등 |
| *Domain-Driven Design: Tackling Complexity in the Heart of Software* | Eric Evans | 2003 | Specification Pattern, Bounded Context |
| *A Relational Model of Data for Large Shared Data Banks* | Edgar Codd | 1970 | 관계형 모델, 데이터 독립성 |
| *Architectural Styles and the Design of Network-based Software Architectures* | Roy Fielding | 2000 | REST 아키텍처 스타일 |
| *SEQUEL: A Structured English Query Language* | Donald Chamberlin, Raymond Boyce | 1974 | SQL의 원형, 선언적 데이터 접근 |
| *CQRS Documents* | Greg Young | 2010 | CQRS + Event Sourcing 패턴 |
| *Zanzibar: Google's Consistent, Global Authorization System* | Pang et al. (Google) | 2019 | 글로벌 규모 권한 관리 |
| *Large-scale cluster management at Google with Borg* | Verma et al. (Google) | 2015 | Desired State 기반 클러스터 관리 |
| *Recursive Functions of Symbolic Expressions and Their Computation by Machine* | John McCarthy | 1960 | LISP, 선언적 AI의 원형 |

### 빅테크 엔지니어링 블로그

| 출처 | 제목/주제 | URL (예시) |
|------|-----------|-----------|
| Google SRE Book | *Site Reliability Engineering* (Chapter: Automation, Intent) | sre.google/sre-book |
| Netflix Tech Blog | *Netflix Conductor: A microservices orchestrator* | netflixtechblog.com |
| Stripe Engineering | *Payment Intents API Design* | stripe.com/docs/payments/payment-intents |
| Uber Engineering | *Cadence: The Durable Task Framework* | eng.uber.com |
| Meta Engineering | *React: A JavaScript library for building user interfaces* | react.dev |
| Meta Engineering | *GraphQL: A query language for your API* | graphql.org |
| Kubernetes Blog | *Controllers and Operators* | kubernetes.io/docs |
| HashiCorp Learn | *Terraform: Infrastructure as Code* | developer.hashicorp.com/terraform |

### 공식 문서

| 기술 | 문서 | 관련 원칙 |
|------|------|-----------|
| Kubernetes | *Concepts: Controllers* | Desired State, Reconciliation Loop |
| Terraform | *Language: Resources* | Declarative Configuration, State Management |
| React | *Thinking in React* | Declarative UI, Virtual DOM |
| Open Policy Agent | *Policy Language: Rego* | Policy-Mechanism Separation |
| AWS Step Functions | *Developer Guide: State Machines* | Workflow as Intent |
| Temporal | *Concepts: Workflows and Activities* | Durable Execution |
| GraphQL | *Introduction to GraphQL* | Query as Intent |
| Android | *Intents and Intent Filters* | Late Binding, Component Communication |
| Stripe | *Payment Intents API* | Payment as Intent |
| Cisco | *Intent-Based Networking* | Network as Intent |

### 기타 참고자료

| 유형 | 자료 | 저자/출처 |
|------|------|-----------|
| 강연 | *CQRS and Event Sourcing* | Greg Young (2010, DDD Europe) |
| 강연 | *The Art of Destroying Software* | Greg Young (2014, Vimeo) |
| 강연 | *Simple Made Easy* | Rich Hickey (2011, Strange Loop) |
| 서적 | *Implementing Domain-Driven Design* | Vaughn Vernon (2013) |
| 서적 | *Building Microservices* | Sam Newman (2015, 2021 2nd ed.) |
| 서적 | *Designing Data-Intensive Applications* | Martin Kleppmann (2017) |
| 서적 | *Infrastructure as Code* | Kief Morris (2016, 2020 2nd ed.) |
| 서적 | *Kubernetes in Action* | Marko Luksa (2018) |
| 서적 | *Kubernetes Patterns* | Bilgin Ibryam, Roland Huss (2019) |
| 논문 | *Promise Theory* | Mark Burgess (2005) |
| RFC | *RFC 7396: JSON Merge Patch* | IETF (Idempotent 상태 업데이트) |
| 패턴 | *Strangler Fig Pattern* | Martin Fowler (2004) |
| 패턴 | *Saga Pattern* | Hector Garcia-Molina, Kenneth Salem (1987) |

---

> **이 문서의 핵심 메시지**: Intent와 Execution의 분리는 특정 기술이나 패턴이 아니라, 인간이 복잡한 시스템을 다루기 위해 반복적으로 재발견하는 **보편적 원리**이다. SQL에서든, Kubernetes에서든, AI Agent에서든, 법률에서든, 군사에서든 — 형태는 다르지만 구조는 동일하다. "무엇을 원하는가"를 명확히 선언하고, "어떻게 달성하는가"를 독립적으로 진화시킬 수 있는 시스템이 장기적으로 생존한다.
