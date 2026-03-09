---
layout: single
title: "User Story vs Use Case vs Scenario 완전가이드"
date: 2026-03-09 23:00:00 +0900
categories: build
excerpt: "User Story, Use Case, Scenario는 요구사항을 서로 다른 추상화와 목적에서 표현해 혼동을 줄이고 올바른 선택을 돕는다."
toc: true
toc_sticky: true
tags: [requirements, userstory, usecase, scenario, agile, bdd]
---

TL;DR
- User Story는 WHY 중심의 가치 약속, Use Case는 HOW 중심의 흐름, Scenario는 구체 사례(WHAT IF)다.
- 세 기법을 혼용하면 누락·과잉 문서를 피하면서 요구사항의 맥락과 테스트를 함께 잡을 수 있다.
- 상황(규모, 규제, 자동화)에 따라 Story/Use Case/Scenario를 적절히 조합하는 게 핵심이다.

## 1. 개념
User Story, Use Case, Scenario는 모두 사용자 관점 요구사항을 다루지만, **초점과 추상화 수준이 다르다**. Story는 가치와 동기를, Use Case는 시스템의 반응 흐름을, Scenario는 한 가지 구체 사례를 명확히 드러낸다.

## 2. 배경
세 개념은 **서로 다른 시대와 방법론**에서 탄생했다. XP/스크럼은 Story로 대화를 촉진했고, UML/RUP는 Use Case로 시스템 상호작용을 구조화했으며, BDD는 Scenario로 실행 가능한 테스트를 만들었다. 현대 팀은 이들을 동시에 사용하면서 용어 혼동이 잦다.

## 3. 이유
요구사항을 구분하지 않으면 Story가 과도하게 비대해지거나, 예외 흐름이 누락되고, 인수 기준이 모호해진다. 반대로 **WHY–HOW–WHAT IF**를 계층적으로 배치하면 가치·흐름·테스트가 연결된 일관된 스펙을 만들 수 있다.

## 4. 특징
- **User Story**: 짧고 비공식적, 대화의 출발점, 가치 중심.
- **Use Case**: 구조화된 단계/대안/예외, 복잡 흐름 분석에 강함.
- **Scenario**: 단일 경로의 구체 사례, BDD 자동화와 궁합이 좋음.

## 5. 상세 내용

# User Story vs Use Case vs Scenario 완전가이드

> 소프트웨어 요구사항을 기술하는 세 가지 핵심 기법의 역사, 구조, 실무 활용을 종합 정리한 실무자용 레퍼런스 문서

---

## 목차

1. [개요](#1-개요)
2. [User Story 심층 분석](#2-user-story-심층-분석)
3. [Use Case 심층 분석](#3-use-case-심층-분석)
4. [Scenario 심층 분석](#4-scenario-심층-분석)
5. [세 개념 비교 분석](#5-세-개념-비교-분석)
6. [상호 관계와 변환](#6-상호-관계와-변환)
7. [방법론별 선호도](#7-방법론별-선호도)
8. [실무 의사결정 가이드](#8-실무-의사결정-가이드)
9. [도구별 지원](#9-도구별-지원)
10. [현대적 트렌드 (2020년대)](#10-현대적-트렌드-2020년대)
11. [참고문헌](#11-참고문헌)

---

## 1. 개요

### 왜 이 세 개념이 혼동되는가

소프트웨어 개발에서 "요구사항을 기술한다"는 목적은 같지만, **User Story**, **Use Case**, **Scenario**는 서로 다른 시대, 다른 방법론, 다른 관점에서 탄생한 개념이다. 혼동이 발생하는 핵심 원인은 다음과 같다.

| 혼동 원인 | 설명 |
|-----------|------|
| **용어 중첩** | Use Case 안에도 "Scenario"가 있고, User Story에도 "Scenario" 기반 Acceptance Criteria가 있다 |
| **목적 유사** | 셋 다 "사용자가 시스템으로 무엇을 하는가"를 기술한다 |
| **방법론 혼재** | 현대 팀은 Scrum + BDD + Use Case 다이어그램을 동시에 사용한다 |
| **번역 문제** | 한국어로는 셋 다 "사용자 관점의 요구사항"으로 뭉뚱그려 설명되곤 한다 |
| **추상화 수준 차이 무시** | User Story(WHY 중심)와 Use Case(HOW 중심)의 관점 차이를 인식하지 못한다 |

### 왜 구분이 중요한가

구분하지 않으면 다음과 같은 실무 문제가 발생한다.

- **User Story에 Use Case 수준의 상세 흐름을 욱여넣어** 카드가 비대해지고 Negotiable 원칙이 깨진다
- **Use Case 없이 User Story만 쓰면** 복잡한 비즈니스 로직의 예외 흐름(Alternative/Exception)이 누락된다
- **Scenario를 정의하지 않으면** 인수 테스트 기준이 모호해져 "완료"의 정의가 사람마다 다르다
- **세 기법을 적재적소에 조합하면** 요구사항의 WHY(동기) - HOW(흐름) - WHAT EXACTLY(구체 사례)를 빈틈없이 커버할 수 있다

이 가이드는 각 개념의 역사적 기원부터 현대적 활용까지 추적하여, 실무자가 상황에 맞는 기법을 선택하고 조합할 수 있도록 돕는 것을 목표로 한다.

---

## 2. User Story 심층 분석

### 2.1 정의

User Story는 **소프트웨어 기능에 대한 비공식적이고 자연어로 된 짧은 설명**으로, 최종 사용자(또는 사용자 역할)의 관점에서 작성된다. Kent Beck은 이를 **"고객이 시스템에서 가치를 얻기 위해 필요한 것에 대한 약속(promise)"**이라고 표현했고, Ron Jeffries는 User Story의 본질을 **3C(Card, Conversation, Confirmation)**로 정리했다.

핵심적으로 User Story는 **요구사항 문서가 아니라 대화의 출발점(placeholder for a conversation)**이다. 이 점이 전통적 요구사항 명세서(SRS)나 Use Case와 근본적으로 다르다.

### 2.2 역사: 탄생과 진화

```
1999  Kent Beck - "Extreme Programming Explained" 출간
      → "Story"라는 용어를 XP의 계획 단위로 도입
      → 고객이 직접 인덱스 카드에 작성하는 방식 제안

2001  Ron Jeffries - 3C 모델 정립
      → Card: 물리적 카드에 적는 짧은 문장
      → Conversation: 개발자와 고객 간 대화로 세부사항 합의
      → Confirmation: 인수 테스트로 완료 조건 검증

2001  Connextra 포맷 등장 (Rachel Davies)
      → "As a [role], I want [feature], so that [benefit]"
      → 런던의 Connextra사 프로젝트에서 처음 사용
      → 이후 사실상의 표준 포맷(de facto standard)으로 확산

2003  Bill Wake - INVEST 원칙 제안
      → 좋은 User Story의 6가지 품질 기준 정의
      → "Independent, Negotiable, Valuable, Estimable, Small, Testable"

2004  Mike Cohn - "User Stories Applied" 출간
      → User Story를 체계적으로 정리하고 산업 전반에 표준화
      → Story Mapping, Epic/Theme 계층 구조 대중화
```

Kent Beck이 Story를 도입한 배경에는 **전통적 요구사항 명세의 한계에 대한 반발**이 있었다. 수백 페이지의 SRS 문서는 작성에 수개월이 걸리고, 작성 완료 시점에는 이미 요구사항이 변경되어 있었다. Beck은 "완벽한 문서 대신 지속적인 대화"를 선택했고, 그 대화의 촉매제로 인덱스 카드 크기의 Story를 제안한 것이다.

### 2.3 표준 포맷: Connextra 포맷

```
As a [역할/사용자 유형],
I want [기능/행동],
so that [비즈니스 가치/이유].
```

각 요소의 의미:

| 요소 | 질문 | 목적 |
|------|------|------|
| **As a [role]** | 누가 이 기능을 원하는가? | 사용자 역할을 명확히 하여 공감 유도 |
| **I want [feature]** | 무엇을 하고 싶은가? | 구체적 기능 또는 행동 기술 |
| **so that [benefit]** | 왜 필요한가? | 비즈니스 가치 명시 (가장 중요하지만 가장 자주 생략됨) |

> **실무 팁**: `so that` 절이 생략된 User Story는 "왜 이 기능이 필요한지" 팀이 이해하지 못하는 경우가 많다. 우선순위 결정 시 이 절이 핵심 판단 기준이 된다.

### 2.4 3C 상세

Ron Jeffries의 3C는 User Story가 **단순한 문장이 아니라 세 가지 측면의 결합**임을 강조한다.

#### Card (카드)

```
+------------------------------------------+
|  사용자로서, 비밀번호를 재설정할 수 있다,  |
|  계정 접근을 복구하기 위해.               |
|                                          |
|  추정: 5 포인트                           |
+------------------------------------------+
```

- 물리적 인덱스 카드(또는 디지털 도구의 카드) 크기로 제한
- **의도적으로 짧게** 작성하여 상세 사항은 대화로 보충하도록 유도
- 카드는 **요구사항 자체가 아니라 요구사항을 식별하는 토큰(token)**

#### Conversation (대화)

- 개발자, PO, 디자이너, QA가 카드를 중심으로 세부사항을 논의
- **문서화의 대안이 아니라 보완**: 필요하면 대화 결과를 메모로 남김
- Sprint Planning, Backlog Refinement 시 주로 발생
- "이 Story에서 이메일 인증은 필수인가?" 같은 질문이 대화의 핵심

#### Confirmation (확인)

- **인수 테스트(Acceptance Test)**로 Story의 완료 조건을 객관화
- PO가 "이 조건을 만족하면 이 Story는 완료된 것이다"를 명시
- Given-When-Then 또는 체크리스트 형태로 작성

```gherkin
# Confirmation 예시
Given 사용자가 등록된 이메일을 입력하면
When "비밀번호 재설정" 버튼을 클릭하면
Then 재설정 링크가 포함된 이메일이 5분 이내에 발송된다
```

### 2.5 INVEST 원칙

Bill Wake가 2003년에 제안한 좋은 User Story의 6가지 품질 기준이다. 각 원칙은 독립적이 아니라 상호 보완적이다.

| 원칙 | 의미 | 위반 시 증상 | 개선 방법 |
|------|------|-------------|-----------|
| **I**ndependent | 다른 Story와 독립적으로 구현/배포 가능 | Story 간 순서 의존성으로 스프린트 계획 불가 | Story 분할 또는 병합 |
| **N**egotiable | 구현 방법이 고정되지 않음, 대화로 조정 가능 | "정확히 이 UI로 구현하라"식의 지시형 Story | 구현 세부사항 제거, 목적만 남기기 |
| **V**aluable | 사용자 또는 비즈니스에 가치 제공 | "DB 테이블 생성" 같은 기술 태스크형 Story | 사용자 관점으로 재작성 |
| **E**stimable | 팀이 규모를 추정할 수 있음 | "시스템 최적화" 같은 범위 불명확 Story | Spike로 분리하거나 범위 한정 |
| **S**mall | 한 스프린트 안에 완료 가능한 크기 | 2주 넘게 진행 중인 Story | 수직 분할(Vertical Slicing) |
| **T**estable | 완료 여부를 객관적으로 검증 가능 | "사용하기 쉬워야 한다" 같은 주관적 기준 | 구체적 Acceptance Criteria 추가 |

### 2.6 Acceptance Criteria

User Story의 Confirmation을 구체화하는 두 가지 주요 형식이 있다.

#### Given-When-Then 형식 (Scenario-Oriented)

```gherkin
Scenario: 유효한 이메일로 비밀번호 재설정 요청
  Given 사용자가 로그인 페이지에 있고
    And "test@example.com"으로 가입한 계정이 존재할 때
  When 사용자가 "비밀번호 찾기"를 클릭하고
    And 이메일 입력란에 "test@example.com"을 입력하고
    And "재설정 링크 보내기" 버튼을 클릭하면
  Then "재설정 링크가 이메일로 발송되었습니다" 메시지가 표시되고
    And 해당 이메일 주소로 재설정 링크가 포함된 이메일이 발송된다
    And 재설정 링크의 유효기간은 24시간이다
```

#### Rule-Based 형식 (Checklist)

```markdown
## Acceptance Criteria

- [ ] 등록된 이메일 입력 시 재설정 링크 발송
- [ ] 미등록 이메일 입력 시에도 동일한 성공 메시지 표시 (보안)
- [ ] 재설정 링크는 24시간 후 만료
- [ ] 링크 클릭 시 새 비밀번호 입력 폼 표시
- [ ] 새 비밀번호는 최소 8자, 대소문자+숫자+특수문자 포함
- [ ] 비밀번호 변경 완료 시 기존 세션 모두 무효화
- [ ] 5분 내 3회 이상 요청 시 Rate Limiting 적용
```

**두 형식의 비교:**

| 기준 | Given-When-Then | Rule-Based |
|------|-----------------|------------|
| 적합한 상황 | 행동 흐름이 명확한 경우 | 규칙/제약 조건 나열 |
| BDD 자동화 | 직접 연결 가능 (Cucumber 등) | 수동 변환 필요 |
| 가독성 | 시나리오 흐름 파악 용이 | 빠른 스캔 가능 |
| 상세도 | 높음 (맥락 포함) | 중간 (규칙만) |
| 실무 권장 | 복잡한 사용자 흐름 | 단순 비즈니스 규칙 |

### 2.7 계층 구조

User Story는 단독으로 존재하지 않고, 요구사항의 크기에 따라 계층적으로 분해된다.

```
Theme (테마)
  "고객 경험 개선" — 전략적 방향, 여러 Epic 포함
  │
  ├── Epic (에픽)
  │     "사용자 인증 시스템 전면 개편" — 수개월 규모, 여러 Story 포함
  │     │
  │     ├── User Story
  │     │     "사용자로서, 소셜 로그인(Google)으로 가입할 수 있다"
  │     │     │
  │     │     ├── Task: Google OAuth 2.0 연동 구현
  │     │     ├── Task: 소셜 프로필 정보 매핑
  │     │     └── Task: 기존 계정과 소셜 계정 연결 로직
  │     │
  │     ├── User Story
  │     │     "사용자로서, 2단계 인증(2FA)을 설정할 수 있다"
  │     │
  │     └── User Story
  │           "관리자로서, 비활성 계정을 자동 잠금할 수 있다"
  │
  └── Epic
        "셀프 서비스 포털 구축"
```

| 계층 | 크기 | 누가 관리 | 추정 단위 |
|------|------|----------|----------|
| Theme | 분기~연간 | 경영진/PO | - |
| Epic | 수주~수개월 | PO | T-shirt (S/M/L/XL) |
| User Story | 수일~1스프린트 | PO + 개발팀 | Story Point |
| Task | 수시간~수일 | 개발자 | 시간 |

### 2.8 좋은/나쁜 예시

#### 좋은 User Story 예시

```
1. As a 온라인 쇼핑몰 고객,
   I want 장바구니에 담긴 상품의 수량을 변경할 수 있다,
   so that 결제 전에 주문 내용을 조정할 수 있다.

2. As a 팀 리더,
   I want 팀원들의 주간 업무 진척률을 대시보드에서 확인할 수 있다,
   so that 프로젝트 지연 위험을 조기에 발견할 수 있다.

3. As a 시각장애 사용자,
   I want 스크린 리더로 모든 네비게이션 메뉴에 접근할 수 있다,
   so that 보조 기술 없이도 사이트를 탐색할 수 있다.

4. As a 신규 가입자,
   I want 가입 후 3분 이내에 첫 번째 프로젝트를 생성할 수 있다,
   so that 서비스의 가치를 빠르게 체감할 수 있다.
```

#### 나쁜 User Story 예시와 개선

```
[나쁨] 시스템은 MySQL 8.0을 사용해야 한다.
→ 문제: 역할/가치 없음, 기술적 제약 사항이지 Story가 아님
→ 개선: 기술 제약으로 별도 관리하거나, "DBA로서, 안정적인 트랜잭션
        처리를 위해 MySQL 8.0 이상을 사용한다"로 재작성

[나쁨] 사용자로서, 로그인할 수 있다.
→ 문제: so that 절 누락, 너무 모호, 비즈니스 가치 불명
→ 개선: "사용자로서, 이메일과 비밀번호로 로그인할 수 있다,
        개인화된 대시보드에 접근하기 위해."

[나쁨] 사용자로서, 시스템이 빨라야 한다.
→ 문제: 측정 불가, 테스트 불가 (INVEST의 T 위반)
→ 개선: "사용자로서, 검색 결과가 2초 이내에 표시되어야 한다,
        작업 흐름이 끊기지 않도록."

[나쁨] 관리자로서, 사용자 관리 모듈을 구현한다.
→ 문제: Epic 수준을 Story에 억지로 담음 (S 위반), 구현 방법 지시
→ 개선: "관리자로서, 특정 사용자 계정을 비활성화할 수 있다,
        부정 사용을 차단하기 위해." (하나의 행동으로 분할)
```

### 2.9 장점과 한계

#### 장점

- **이해관계자 접근성**: 비기술자도 읽고 쓸 수 있다
- **대화 촉진**: 완성된 문서가 아니라 논의의 시작점
- **유연성**: 구현 방법을 열어두어 기술적 창의성 허용
- **우선순위 결정 용이**: so that 절로 비즈니스 가치 비교 가능
- **점진적 상세화**: 개발 직전에 상세화하여 낭비 최소화

#### 한계

| 한계 영역 | 설명 | 대안 |
|-----------|------|------|
| **기술적 작업** | "DB 마이그레이션", "인프라 설정"은 사용자 가치로 표현하기 어려움 | Technical Story 또는 Enabler로 별도 관리 |
| **대규모 시스템** | 복잡한 비즈니스 로직의 예외 흐름을 Story만으로 포착 불가 | Use Case로 보완 |
| **규제 요구사항** | "개인정보는 90일 후 파기" 같은 법적 요구사항은 대화로 남기기 위험 | 규제 요구사항 문서로 별도 관리, Story에 참조 링크 |
| **비기능 요구사항** | 성능, 보안, 확장성은 단일 Story로 표현하기 부적합 | NFR(Non-Functional Requirement) 백로그 또는 제약조건으로 관리 |
| **대화 의존성** | 팀 이직률이 높으면 대화의 맥락이 소실됨 | 핵심 결정 사항은 Confluence 등에 보조 기록 |

---

## 3. Use Case 심층 분석

### 3.1 정의

**Ivar Jacobson의 원래 정의 (1987):**
> "A use case is a sequence of transactions performed by a system that yields a measurable result of value for a particular actor."

**UML 표준 정의:**
> "A use case specifies a set of actions performed by a system, which yields an observable result that is of value to one or more actors."

**Alistair Cockburn의 실무적 정의 (2000):**
> "A use case captures a contract between the stakeholders of a system about its behavior. It describes the system's behavior under various conditions as it responds to a request from one of the stakeholders."

Use Case의 핵심은 **시스템과 외부 행위자(Actor) 간의 상호작용을 구조화된 형식으로 기술**하는 것이다. User Story가 "왜(WHY)"에 집중한다면, Use Case는 "어떻게(HOW)" 시스템이 반응하는지를 단계별로 기술한다.

### 3.2 역사: 탄생과 진화

```
1967  Ivar Jacobson, Ericsson에서 "사용 사례(Usage Case)" 개념 착안
      → 통신 교환 시스템의 사용 패턴을 기술하기 위함

1986  Jacobson, Ericsson의 AXE 시스템 개발에서 Use Case 형식화
      → 통신 시스템의 복잡한 상호작용을 문서화하는 데 효과적임을 입증

1987  OOPSLA 학회 발표
      → "Object-Oriented Development in an Industrial Environment" 논문
      → Use Case가 학계와 산업계에 공식적으로 소개됨

1992  "Object-Oriented Software Engineering (OOSE)" 출간
      → Use Case Driven Development 방법론 제시
      → Actor, System Boundary 등 핵심 개념 체계화

1995  UML 통합 — "Three Amigos" (Jacobson, Booch, Rumbaugh)
      → Rational Software에서 Unified Modeling Language 개발
      → Use Case Diagram이 UML의 핵심 다이어그램으로 포함

1999  RUP (Rational Unified Process) 출시
      → Use Case Driven, Architecture-Centric 접근법
      → 대기업 프로젝트에서 Use Case의 황금기

2000  Alistair Cockburn - "Writing Effective Use Cases" 출간
      → Use Case 작성의 실무 바이블
      → Goal Level, Fully Dressed 포맷 등 실용적 프레임워크 제공

2011  Jacobson - "Use Case 2.0" 발표
      → Agile 환경에 맞는 Use Case Slice 개념 도입
      → 전통적 Use Case의 무거움을 해결하려는 시도
```

### 3.3 Use Case Diagram

Use Case Diagram은 UML의 행동 다이어그램(Behavioral Diagram)으로, 시스템의 기능적 범위를 높은 수준에서 시각화한다.

#### 구성 요소

```
                    ┌─────────────────────────────────────────┐
                    │          온라인 쇼핑 시스템               │
                    │                                         │
   ┌───┐           │    ┌─────────────────┐                  │
   │   │ ─────────────→ │   상품 검색       │                  │
   └─┬─┘           │    └─────────────────┘                  │
  고객│             │             │                            │
     │              │         <<include>>                     │
     │              │             ↓                            │
     │              │    ┌─────────────────┐                  │
     ├──────────────────→│   장바구니 담기   │                  │
     │              │    └─────────────────┘                  │
     │              │                                         │
     │              │    ┌─────────────────┐   <<extend>>     │
     ├──────────────────→│   주문하기       │─────────────┐   │
     │              │    └─────────────────┘              │   │
     │              │             │                       ↓   │
     │              │         <<include>>      ┌───────────┐ │
     │              │             ↓            │ 쿠폰 적용  │ │
     │              │    ┌─────────────────┐   └───────────┘ │
     │              │    │   결제 처리       │                  │
   ┌───┐           │    └─────────────────┘                  │
   │   │ ←───────────────        ↑                            │
   └─┬─┘           │            │                            │
  결제              │    ┌─────────────────┐                  │
  게이트            │    │   배송 추적       │                  │
  웨이              │    └─────────────────┘                  │
                    │             ↑                            │
   ┌───┐           │             │                            │
   │   │ ─────────────────────────                            │
   └─┬─┘           │                                         │
  관리자            └─────────────────────────────────────────┘
```

| 요소 | 표기 | 설명 |
|------|------|------|
| **Actor** (행위자) | 막대 인형 (Stick Figure) | 시스템 외부에서 시스템과 상호작용하는 개체 (사람, 외부 시스템) |
| **Use Case** | 타원 (Ellipse) | 시스템이 제공하는 기능 단위 |
| **System Boundary** | 사각형 (Rectangle) | 시스템의 범위를 정의 |
| **Association** | 실선 (Solid Line) | Actor와 Use Case 간의 연결 |
| **Include** | 점선 화살표 + `<<include>>` | 반드시 포함되는 하위 기능 (필수 포함) |
| **Extend** | 점선 화살표 + `<<extend>>` | 조건부로 확장되는 기능 (선택적 확장) |
| **Generalization** | 실선 삼각형 화살표 | Actor 또는 Use Case 간의 상속 관계 |

#### Include vs Extend 구분

```
Include (필수 포함):
  "주문하기"는 항상 "결제 처리"를 포함한다.
  → "주문하기" ──<<include>>──→ "결제 처리"
  → 주문 없이 결제만 하는 경우는 없다 (필수)

Extend (조건부 확장):
  "주문하기" 중 쿠폰이 있으면 "쿠폰 적용"이 추가된다.
  → "쿠폰 적용" ──<<extend>>──→ "주문하기"
  → 쿠폰 없이도 주문은 가능하다 (선택)
  → 화살표 방향 주의: 확장하는 쪽에서 확장되는 쪽으로
```

### 3.4 Actor 유형

| 유형 | 정의 | 예시 |
|------|------|------|
| **Primary Actor** | Use Case를 시작하는 주체, 시스템에서 목표를 달성하려는 행위자 | 고객, 관리자, 사용자 |
| **Secondary Actor** | Use Case 수행 중 시스템이 도움을 요청하는 외부 시스템/서비스 | 결제 게이트웨이, 이메일 서버, 외부 API |
| **Stakeholder** | Use Case의 결과에 이해관계가 있지만 직접 상호작용하지는 않는 주체 | 감사관, 규제 기관, 경영진 |

### 3.5 Cockburn Goal Level

Alistair Cockburn은 Use Case를 **목표 수준(Goal Level)**에 따라 5단계로 분류했다. 이를 통해 Use Case의 추상화 수준을 체계적으로 관리할 수 있다.

```
☁️  Cloud (Very High Summary) — 조직 전략 수준
      "고객 관계를 관리한다"
      → 여러 Summary Level Use Case를 포괄

🪁  Kite (Summary) — 여러 사용자 목표를 묶는 수준
      "주문을 처리한다" (검색→장바구니→결제→배송 전체)
      → 하위 Sea Level Use Case들의 묶음

~~~  Sea Level (User Goal) — ★ 대부분의 Use Case가 여기
      "상품을 주문한다"
      → Boss Test: "상사에게 '이걸 하고 있었습니다'라고 말했을 때
        고개를 끄덕이는가?" → YES면 Sea Level

🐟  Fish (Subfunction) — 다른 Use Case에서 호출되는 하위 기능
      "배송지 주소를 검증한다"
      → Boss Test 실패: 이것만 하루 종일 했다고 하면 상사가 의아해함

🐚  Clam (Too Low) — 기술적 세부 구현
      "SQL 쿼리로 재고를 조회한다"
      → Use Case로 작성할 필요 없음, 구현 상세
```

**Boss Test (상사 테스트):**
"오늘 뭐 했어?" 라는 상사의 질문에 대해:
- "주문 기능을 구현했습니다" → 끄덕임 → **Sea Level** (적정)
- "고객 관계 관리 시스템을 구축했습니다" → "그래서 오늘 구체적으로 뭘 한 거야?" → **너무 높음**
- "주소 검증 로직을 만들었습니다" → "그게 하루 종일 할 일이었어?" → **너무 낮음**

### 3.6 Use Case 형식

Cockburn은 상황에 따라 세 가지 수준의 상세도를 제안한다.

#### Brief (간략형)

```
상품 주문: 고객이 상품을 선택하고 배송지와 결제 정보를 입력하여
주문을 완료한다. 시스템은 결제를 처리하고 주문 확인 이메일을 발송한다.
```

1-2 문단의 자유로운 서술. 초기 요구사항 파악이나 브레인스토밍 단계에 적합하다.

#### Casual (약식형)

```
Use Case: 상품 주문

Main Success Scenario:
  1. 고객이 상품을 장바구니에 담는다
  2. 고객이 배송지 주소를 입력한다
  3. 고객이 결제 수단을 선택한다
  4. 시스템이 결제를 처리한다
  5. 시스템이 주문 확인 이메일을 발송한다

Alternative:
  - 2a. 기존 배송지를 선택할 수 있다
  - 4a. 결제 실패 시 다른 결제 수단을 시도할 수 있다
```

번호 목록 + 대안 흐름. 대부분의 프로젝트에서 가장 실용적인 수준이다.

#### Fully Dressed (완전형)

가장 상세한 형식으로, 미션 크리티컬 시스템이나 규제 요구사항이 있는 경우에 사용한다. 아래에 완전한 예시를 제시한다.

### 3.7 Fully Dressed Use Case 예시: ATM 현금 인출

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use Case UC-003: ATM 현금 인출
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scope:          ATM 시스템
Level:          User Goal (Sea Level ~~~)
Primary Actor:  은행 고객 (카드 소지자)
Stakeholders:
  - 은행 고객: 빠르고 정확한 현금 인출을 원함
  - 은행: 정확한 거래 기록, 사기 방지를 원함
  - 규제 기관: 거래 감사 추적(Audit Trail)을 요구함

Preconditions:
  - ATM이 정상 가동 중이다
  - ATM에 충분한 현금이 있다
  - 고객이 유효한 은행 카드를 소지하고 있다

Postconditions (Success Guarantee):
  - 고객의 계좌에서 인출 금액이 차감된다
  - 고객이 요청한 현금을 수령한다
  - 거래 기록이 은행 시스템에 저장된다
  - 거래 영수증이 발행된다 (선택 시)

Trigger:
  고객이 ATM에 카드를 삽입한다

━━━ Main Success Scenario (기본 성공 흐름) ━━━

  1. 고객이 ATM에 카드를 삽입한다.
  2. ATM이 카드를 읽고 카드 유효성을 확인한다.
  3. ATM이 PIN 입력 화면을 표시한다.
  4. 고객이 PIN을 입력한다.
  5. ATM이 은행 시스템에 PIN을 검증 요청한다.
  6. 은행 시스템이 PIN이 유효함을 확인한다.
  7. ATM이 거래 유형 선택 화면을 표시한다.
  8. 고객이 "현금 인출"을 선택한다.
  9. ATM이 금액 입력/선택 화면을 표시한다.
  10. 고객이 인출 금액을 입력한다.
  11. ATM이 은행 시스템에 인출 승인을 요청한다.
  12. 은행 시스템이 잔액 확인 후 인출을 승인한다.
  13. ATM이 해당 금액의 현금을 배출한다.
  14. 고객이 현금을 수령한다.
  15. ATM이 영수증 출력 여부를 묻는다.
  16. 고객이 영수증을 선택한다.
  17. ATM이 영수증을 출력한다.
  18. ATM이 카드를 반환한다.
  19. 고객이 카드를 수령한다.

━━━ Extensions (대안/예외 흐름) ━━━

  2a. 카드를 읽을 수 없는 경우:
      2a1. ATM이 "카드를 읽을 수 없습니다" 메시지를 표시한다.
      2a2. ATM이 카드를 반환한다.
      2a3. Use Case 종료.

  5a. 네트워크 연결 실패:
      5a1. ATM이 "일시적 장애" 메시지를 표시한다.
      5a2. ATM이 3회까지 재시도한다.
      5a3. 재시도 실패 시 카드를 반환하고 Use Case 종료.

  6a. PIN이 틀린 경우:
      6a1. ATM이 "PIN이 올바르지 않습니다" 메시지를 표시한다.
      6a2. Step 3으로 돌아간다.
      6a3. 3회 연속 실패 시:
           6a3a. ATM이 카드를 회수(capture)한다.
           6a3b. ATM이 "보안을 위해 카드가 회수되었습니다" 메시지를 표시한다.
           6a3c. 은행 시스템에 카드 회수를 통보한다.
           6a3d. Use Case 종료.

  12a. 잔액 부족:
       12a1. ATM이 "잔액이 부족합니다. 잔액: ₩XX,XXX" 메시지를 표시한다.
       12a2. Step 9로 돌아간다 (다른 금액 입력 가능).

  12b. 일일 인출 한도 초과:
       12b1. ATM이 "일일 인출 한도를 초과했습니다" 메시지를 표시한다.
       12b2. Step 9로 돌아간다.

  14a. 고객이 60초 내에 현금을 수령하지 않음:
       14a1. ATM이 경고 비프음을 낸다.
       14a2. 추가 30초 대기 후 현금을 회수한다.
       14a3. 거래를 취소하고 계좌에 금액을 복원한다.
       14a4. 카드를 반환하고 Use Case 종료.

  *a. 어느 단계에서든 고객이 "취소"를 누른 경우:
      *a1. ATM이 카드를 반환한다.
      *a2. 진행 중인 거래가 있으면 롤백한다.
      *a3. Use Case 종료.

━━━ Technology & Data Variations ━━━

  1a. 카드 대신 NFC (모바일 결제) 사용
  4a. PIN 대신 생체 인식 (지문) 사용
  10a. 빠른 인출: 미리 정의된 금액 버튼 (₩10,000 / ₩50,000 / ₩100,000)

━━━ Related Information ━━━

  Priority:     High
  Frequency:    매우 높음 (하루 수천 건)
  Performance:  전체 거래 90초 이내 완료
  Open Issues:  다중 통화 인출 지원 여부 미결정
```

### 3.8 구성 요소 정리

| 구성 요소 | 영문 | 설명 |
|-----------|------|------|
| **선행 조건** | Precondition | Use Case 시작 전에 반드시 참이어야 하는 조건 |
| **후행 조건** | Postcondition | Use Case 성공 완료 후 보장되는 상태 |
| **기본 흐름** | Main Success Scenario | 가장 일반적인 성공 경로 (Happy Path) |
| **대안 흐름** | Alternative Flow | 기본 흐름의 변형 (다른 정상 경로) |
| **예외 흐름** | Exception Flow | 오류, 실패 상황의 처리 경로 |
| **트리거** | Trigger | Use Case를 시작시키는 이벤트 |
| **범위** | Scope | 시스템 경계 (어디까지가 시스템인가) |

### 3.9 실무 맥락

| 방법론 | Use Case 활용 방식 |
|--------|-------------------|
| **RUP** | 핵심 산출물. Use Case가 아키텍처, 설계, 테스트를 주도(Use Case Driven) |
| **Waterfall** | 요구사항 분석 단계의 주요 산출물. 설계 단계로의 입력물 |
| **Agile 하이브리드** | Epic/Feature 수준에서 Use Case로 전체 흐름 파악, Story로 분할하여 스프린트 투입 |
| **규제 산업** | 의료기기(IEC 62304), 항공(DO-178C) 등에서 Use Case가 법적 요구사항 추적에 필수 |

### 3.10 장점과 한계

#### 장점

- **완전성**: 예외/대안 흐름을 체계적으로 포착하여 누락 방지
- **시각화**: Use Case Diagram으로 시스템 범위를 직관적으로 전달
- **테스트 도출**: 각 흐름에서 직접 테스트 케이스 유도 가능
- **이해관계자 소통**: 비기술자도 시나리오 형태로 이해 가능
- **규제 대응**: 감사 추적(Audit Trail)에 적합한 형식성

#### 한계

| 한계 영역 | 설명 | 대안 |
|-----------|------|------|
| **작성 비용** | Fully Dressed Use Case는 작성에 수일~수주 소요 | Casual 형식 사용, 핵심 Use Case만 상세화 |
| **변경 저항** | 상세하게 작성할수록 변경 비용 증가 | Use Case 2.0 Slice 활용 |
| **비기능 요구사항** | 성능, 보안 등은 별도 문서 필요 | 보충 명세(Supplementary Specification) |
| **UI 과도 명세** | "버튼을 클릭한다" 수준의 UI 상세를 포함하기 쉬움 | Essential Use Case (UI 중립적) 작성 |
| **Agile 부적합** | 무거운 문서는 Agile의 "Working Software > Comprehensive Documentation"과 충돌 | Casual 형식 + Story 분할 |

---

## 4. Scenario 심층 분석

### 4.1 정의와 어원

**Scenario**는 이탈리아어 **scenario**(무대 배경, 대본의 줄거리)에서 유래했다. 원래 연극이나 영화에서 장면의 전개를 기술하는 용어였으며, 소프트웨어 공학에서는 **"시스템 사용의 구체적인 한 가지 사례"**를 의미한다.

그러나 "Scenario"라는 단어는 소프트웨어 분야에서 **가장 다의적으로 사용되는 용어** 중 하나다. 맥락에 따라 완전히 다른 의미를 가지며, 이것이 혼동의 주요 원인이다.

### 4.2 맥락별 5가지 의미

#### (1) Use Case 내 Scenario (= Use Case Instance)

Use Case가 **가능한 모든 경로의 집합**이라면, Scenario는 그 중 **하나의 구체적인 경로(instance)**이다.

```
Use Case: 상품 주문
  │
  ├── Main Success Scenario (기본 성공 시나리오)
  │     "고객이 상품을 선택 → 배송지 입력 → 결제 성공 → 확인 이메일 수신"
  │
  ├── Alternative Scenario 1 (대안 시나리오)
  │     "기존 배송지 선택 → 결제 성공"
  │
  ├── Alternative Scenario 2
  │     "첫 결제 실패 → 다른 카드로 재시도 → 성공"
  │
  └── Exception Scenario (예외 시나리오)
        "세 번째 결제 시도도 실패 → 주문 취소"
```

이 맥락에서 하나의 Use Case = 여러 Scenario의 집합이다. Jacobson은 이를 **"Use Case Instance"**라고도 불렀다.

#### (2) BDD Scenario (Dan North, 2003~)

BDD(Behavior-Driven Development)에서 Scenario는 **Gherkin 언어로 작성된 실행 가능한 명세(Executable Specification)**이다.

```gherkin
Feature: 사용자 로그인
  사용자가 인증을 통해 개인 영역에 접근할 수 있어야 한다.

  Background:
    Given "test@example.com" 계정이 존재한다
    And 비밀번호는 "SecurePass123!"이다

  Scenario: 올바른 자격증명으로 로그인
    Given 사용자가 로그인 페이지에 있다
    When 이메일에 "test@example.com"을 입력하고
    And 비밀번호에 "SecurePass123!"을 입력하고
    And "로그인" 버튼을 클릭하면
    Then 대시보드 페이지로 이동한다
    And 환영 메시지 "안녕하세요, Test님"이 표시된다

  Scenario: 잘못된 비밀번호로 로그인 시도
    Given 사용자가 로그인 페이지에 있다
    When 이메일에 "test@example.com"을 입력하고
    And 비밀번호에 "WrongPass"을 입력하고
    And "로그인" 버튼을 클릭하면
    Then "이메일 또는 비밀번호가 올바르지 않습니다" 메시지가 표시된다
    And 로그인 페이지에 머문다

  Scenario Outline: 비밀번호 유효성 검사
    Given 사용자가 비밀번호 변경 페이지에 있다
    When 새 비밀번호에 "<password>"를 입력하면
    Then "<result>" 메시지가 표시된다

    Examples:
      | password    | result                    |
      | abc         | 최소 8자 이상이어야 합니다     |
      | abcdefgh    | 숫자를 포함해야 합니다        |
      | abcdef12    | 특수문자를 포함해야 합니다     |
      | Abcdef1!    | 사용 가능한 비밀번호입니다     |
```

#### (3) Test Scenario

테스트 분야에서 Scenario는 **테스트할 고수준 영역이나 상황**을 기술한다. 하나의 Test Scenario에서 여러 Test Case가 파생된다.

```
Test Scenario: 로그인 기능 검증
  │
  ├── Test Case 1: 유효한 이메일 + 유효한 비밀번호 → 성공
  ├── Test Case 2: 유효한 이메일 + 잘못된 비밀번호 → 실패
  ├── Test Case 3: 존재하지 않는 이메일 → 실패
  ├── Test Case 4: 이메일 미입력 → 유효성 검사 오류
  ├── Test Case 5: SQL 인젝션 시도 → 차단
  ├── Test Case 6: 5회 실패 후 계정 잠금 → 잠금
  └── Test Case 7: 잠금 후 30분 경과 → 잠금 해제
```

| 구분 | Test Scenario | Test Case |
|------|---------------|-----------|
| 추상화 수준 | 높음 (무엇을 테스트?) | 낮음 (어떻게 테스트?) |
| 입력 데이터 | 포함하지 않음 | 구체적 값 포함 |
| 기대 결과 | 개략적 | 정확한 값/상태 |
| 수량 관계 | 1 Scenario | → N Test Cases |

#### (4) User Scenario (UX/HCI)

UX 설계에서 Scenario는 **페르소나 기반의 서사적 이야기(Narrative)**이다. John Carroll의 **Scenario-Based Design (SBD, 1995)**에서 체계화되었다.

```
페르소나: 김민지 (32세, 프리랜서 디자이너, 서울 거주)
  - 스마트폰 사용에 능숙하지만, 가계부 앱은 처음 사용
  - 프로젝트별 수입이 불규칙적이라 지출 관리에 어려움

User Scenario:
  민지는 카페에서 아메리카노를 결제한 직후, 앱을 열었다.
  "방금 쓴 돈을 바로 기록하고 싶은데..." 하면서 앱을 본다.
  홈 화면에 큰 "+" 버튼이 보인다. 탭하자 금액 입력 화면이 나온다.
  "4,500"을 입력하고, 자동 추천된 "카페/음료" 카테고리를 탭한다.
  저장 버튼을 누르자 "오늘 카페 지출: ₩9,000 (2건)" 요약이 뜬다.
  "아, 오늘 벌써 두 번째 카페구나..." 하면서 남은 예산을 확인한다.
  이번 주 식비 예산의 65%를 사용했음을 보고, 내일은 집에서
  커피를 내려 마셔야겠다고 생각한다.
```

이 형식은 기능 명세가 아니라 **감정과 맥락을 포함한 사용 경험의 시뮬레이션**이다. UI 설계, 정보 구조(IA), 사용성 평가에 활용된다.

#### (5) Business Scenario

경영/전략 분야에서 Scenario는 **"만약 ~한다면(What-if)"**의 가정 하에 미래 상황을 기술하는 전략적 도구이다.

```
Business Scenario: 경쟁사가 무료 요금제를 출시한 경우
  - 유료 사용자의 20%가 이탈할 가능성
  - 대응 전략: Freemium 모델 도입 또는 프리미엄 기능 강화
  - 예상 매출 영향: -15% ~ -25%
  - 필요 개발: 무료 tier 기능 제한 시스템
```

이 가이드에서는 소프트웨어 개발과 직접 관련된 (1) Use Case Scenario, (2) BDD Scenario, (3) Test Scenario를 중심으로 다룬다.

### 4.3 BDD 상세

#### Dan North의 원래 의도 (2003~2006)

Dan North는 TDD(Test-Driven Development)를 가르치면서 개발자들이 겪는 어려움을 관찰했다:

- "어디서부터 테스트를 시작해야 하나?"
- "무엇을 테스트해야 하고, 무엇은 테스트하지 않아도 되나?"
- "테스트를 얼마나 작성해야 하나?"

이러한 질문에 대한 답으로 BDD를 제안했다. 핵심 통찰은 **"Test(테스트)"라는 단어를 "Behavior(행동)" 또는 "Should(해야 한다)"로 바꾸면 사고의 프레이밍이 달라진다**는 것이었다.

```
TDD:    test_login_with_valid_credentials()
BDD:    login_should_succeed_with_valid_credentials()
        → "시스템은 유효한 자격증명으로 로그인할 수 있어야 한다"
```

#### Gherkin 키워드 전체 참조

```gherkin
Feature: 기능 영역을 설명하는 제목
  기능에 대한 자유 형식 설명.
  여러 줄에 걸쳐 작성 가능.

  Background:
    # 모든 Scenario 실행 전에 공통으로 실행되는 전제 조건
    Given 공통 전제 조건

  Scenario: 첫 번째 시나리오 이름
    Given 사전 상태 (Arrange)
      And 추가 사전 상태
    When 행동 수행 (Act)
      And 추가 행동
    Then 기대 결과 확인 (Assert)
      And 추가 확인
      But 이것은 아니어야 한다

  Scenario Outline: 매개변수화된 시나리오
    Given <전제조건>이 주어지고
    When <행동>을 수행하면
    Then <결과>가 나타난다

    Examples:
      | 전제조건 | 행동    | 결과    |
      | 값1     | 행동1   | 결과1   |
      | 값2     | 행동2   | 결과2   |

  @tag1 @tag2
  Scenario: 태그가 붙은 시나리오
    # 태그로 시나리오 그룹화 및 선택적 실행 가능
    Given ...
```

| 키워드 | 역할 | 대응하는 테스트 패턴 |
|--------|------|---------------------|
| `Feature` | 기능 영역 정의 | Test Suite |
| `Background` | 공통 전제 조건 | `@BeforeEach` / `setUp()` |
| `Scenario` | 하나의 구체적 사례 | Test Method |
| `Given` | 사전 상태 설정 | **Arrange** |
| `When` | 행동 수행 | **Act** |
| `Then` | 결과 검증 | **Assert** |
| `And` / `But` | 이전 키워드의 연속 | 추가 Arrange/Act/Assert |
| `Scenario Outline` | 매개변수화된 시나리오 | `@ParameterizedTest` |
| `Examples` | 매개변수 데이터 테이블 | 테스트 데이터 |

#### Arrange-Act-Assert 대응

```
Arrange  ←→  Given  (사전 조건 설정)
Act      ←→  When   (행동 수행)
Assert   ←→  Then   (결과 검증)
```

이 대응 관계는 BDD Scenario가 **실행 가능한 테스트 코드로 직접 변환**될 수 있음을 의미한다. Cucumber, SpecFlow 같은 도구가 이 변환을 자동화한다.

### 4.4 장점과 한계

#### 장점

- **Living Documentation**: BDD Scenario는 코드와 함께 버전 관리되어 항상 최신 상태 유지
- **비기술자 가독성**: Gherkin은 자연어에 가까워 PO, BA도 읽고 검증 가능
- **자동화 연결**: Given-When-Then이 테스트 코드로 직접 매핑
- **구체적 사례**: 추상적 요구사항을 실제 데이터로 검증 가능
- **의사소통 도구**: Three Amigos 세션의 공통 언어 역할

#### 한계

| 한계 영역 | 설명 | 대안 |
|-----------|------|------|
| **폭발적 증가** | Use Case의 경로 조합이 많으면 Scenario 수가 기하급수적으로 증가 | 핵심 경로만 Scenario로, 나머지는 단위 테스트 |
| **유지보수 부담** | Scenario가 수백 개가 되면 변경 비용이 높아짐 | 태그 기반 분류, 불필요한 Scenario 정리 |
| **맥락별 혼동** | "Scenario"가 Use Case / BDD / Test / UX에서 다른 의미 | 팀 내 용어 정의서(Glossary) 유지 |
| **Step Definition 부채** | 자연어-코드 매핑이 누적되면 중복과 불일치 발생 | Step Definition 리팩토링 주기적 수행 |
| **잘못된 추상화** | UI 세부사항("버튼 클릭")을 Scenario에 포함하면 UI 변경마다 깨짐 | Declarative Scenario ("로그인한다") vs Imperative ("이메일 입력, 비밀번호 입력, 클릭") |

---

## 5. 세 개념 비교 분석

### 5.1 핵심 비교표

| 비교 기준 | User Story | Use Case | Scenario |
|-----------|-----------|----------|----------|
| **정의** | 사용자 관점의 가치 기술 | 시스템-Actor 상호작용 기술 | 구체적 사용 사례 한 가지 |
| **형식** | 비공식, 자유 형식 (Connextra 관례) | 반정형~정형 (Brief/Casual/Fully Dressed) | Gherkin(BDD) 또는 자유 서술 |
| **분량** | 1-3문장 (인덱스 카드 크기) | 수 페이지 (Fully Dressed 기준) | 5-15줄 (BDD 기준) |
| **작성자** | PO, BA, 고객 | BA, 시스템 분석가 | PO+개발자+QA (Three Amigos) |
| **대상 독자** | 전체 팀 + 이해관계자 | 개발자, QA, 아키텍트 | 개발자, QA |
| **상세도** | 낮음 (의도적) | 높음 | 중간 (구체적이지만 단일 경로) |
| **목적** | 대화 촉진, 가치 전달 | 시스템 동작 명세 | 행동 검증, 인수 테스트 |
| **방법론** | Agile (Scrum, XP, Kanban) | RUP, Waterfall, 하이브리드 | BDD, TDD, Agile Testing |
| **테스트 연결** | Acceptance Criteria 통해 간접 | 각 흐름에서 Test Case 도출 | 직접 자동화 가능 (Cucumber) |
| **갱신 빈도** | 매 스프린트 | 분석/설계 단계 후 안정 | 기능 변경 시 함께 변경 |
| **핵심 질문** | **왜** 이 기능이 필요한가? | **어떻게** 시스템이 반응하는가? | **정확히 무슨 일**이 일어나는가? |

### 5.2 추상화 수준 비교

```
높은 추상화 ──────────────────────────────────────── 낮은 추상화
(전략적)                                            (구체적)

  Theme          Epic         User Story    Use Case      Scenario
    │              │              │            │              │
    │              │              │            │              │
  "고객경험       "인증시스템     "소셜         "소셜로그인    "Google
   개선"          개편"          로그인         전체흐름       로그인시
                                가입"          Main/Alt/Exc  신규가입자
                                                             프로필매핑
                                                             성공"

  WHY(전략)  →  WHAT(범위)  →  WHY(가치)  →  HOW(흐름)  →  WHAT IF(사례)
```

### 5.3 핵심 한 줄 정리

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  User Story  = WHY     — 왜 이 기능이 필요한가          │
│  Use Case    = HOW     — 어떻게 시스템이 반응하는가      │
│  Scenario    = WHAT IF — 정확히 어떤 상황에서 무슨 일이  │
│                          일어나는가                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 상호 관계와 변환

### 6.1 Use Case 안의 Scenario

Use Case와 Scenario는 **집합-원소 관계**이다.

```
Use Case = { Scenario₁, Scenario₂, ..., Scenarioₙ }

즉, Use Case는 Scenario들의 집합이고,
    Scenario는 Use Case의 하나의 인스턴스(경로)이다.

예시:
  Use Case "상품 주문" = {
    Main Success Scenario,      ← 정상 주문 완료
    Alt Scenario "기존배송지",  ← 기존 배송지 선택
    Alt Scenario "재결제",      ← 첫 결제 실패 후 재시도 성공
    Exc Scenario "결제불가",    ← 모든 결제 시도 실패
    Exc Scenario "재고소진",    ← 결제 후 재고 부족 발견
    ...
  }
```

### 6.2 User Story에서 Use Case로 변환

User Story(WHY)를 Use Case(WHY + HOW)로 확장하는 과정이다.

```
[User Story]
As a 온라인 쇼핑몰 고객,
I want 상품을 주문할 수 있다,
so that 원하는 물건을 집에서 받을 수 있다.

                    ▼ 확장

[Use Case - Casual]
Use Case: 상품 주문
Actor: 온라인 쇼핑몰 고객

Precondition: 고객이 로그인되어 있다

Main Success Scenario:
  1. 고객이 상품 상세 페이지에서 "주문하기"를 선택한다
  2. 시스템이 배송지 입력 화면을 표시한다
  3. 고객이 배송지 정보를 입력한다
  4. 시스템이 배송비를 계산하여 표시한다
  5. 고객이 결제 수단을 선택한다
  6. 시스템이 결제를 처리한다
  7. 시스템이 주문 확인 번호를 표시한다
  8. 시스템이 주문 확인 이메일을 발송한다

Alternative:
  3a. 고객이 저장된 배송지를 선택한다 → Step 4로
  6a. 결제 실패 → 오류 메시지 표시 → Step 5로

Exception:
  6b. 3회 결제 실패 → 주문 취소, 사유 안내
```

변환 시 추가되는 정보:

| User Story에는 없지만 | Use Case에서 추가 |
|-----------------------|-------------------|
| 구체적 단계(Step) | Main Success Scenario의 1~8 |
| 대안 경로 | Alternative Flow |
| 예외 처리 | Exception Flow |
| 선행/후행 조건 | Precondition, Postcondition |
| Actor 명세 | Primary/Secondary Actor |

### 6.3 User Story Acceptance Criteria와 BDD Scenario의 연결

현대 Agile에서 **가장 실용적인 연결점**이 바로 이 지점이다. User Story의 Acceptance Criteria를 BDD Scenario로 작성하면, 요구사항 정의와 자동화 테스트가 하나의 문서로 통합된다.

```
[User Story]
As a 사용자,
I want 비밀번호를 재설정할 수 있다,
so that 비밀번호를 잊어도 계정에 접근할 수 있다.

[Acceptance Criteria = BDD Scenarios]

Feature: 비밀번호 재설정

  Scenario: 등록된 이메일로 재설정 링크 요청
    Given 사용자가 "password_reset@test.com"으로 가입되어 있고
    And 로그인 페이지의 "비밀번호 찾기" 링크를 클릭했을 때
    When 이메일 입력란에 "password_reset@test.com"을 입력하고
    And "재설정 링크 보내기" 버튼을 클릭하면
    Then "재설정 링크가 이메일로 발송되었습니다" 메시지가 표시된다
    And "password_reset@test.com"으로 재설정 링크가 포함된 이메일이 발송된다

  Scenario: 미등록 이메일로 재설정 요청 (보안)
    Given 사용자가 로그인 페이지의 "비밀번호 찾기"를 클릭했을 때
    When 이메일 입력란에 "unknown@test.com"을 입력하고
    And "재설정 링크 보내기" 버튼을 클릭하면
    Then 동일한 "재설정 링크가 이메일로 발송되었습니다" 메시지가 표시된다
    # 보안: 이메일 존재 여부를 노출하지 않음
    But 실제 이메일은 발송되지 않는다

  Scenario: 만료된 재설정 링크 사용
    Given 24시간이 경과한 재설정 링크가 있을 때
    When 해당 링크를 클릭하면
    Then "재설정 링크가 만료되었습니다" 메시지가 표시된다
    And "새 링크 요청" 버튼이 표시된다
```

### 6.4 계층적 혼용 패턴

실무에서는 세 기법을 계층적으로 조합하여 사용하는 것이 가장 효과적이다.

```
Epic (전략적 범위)
  "사용자 인증 시스템 구축"
    │
    ├── User Story (백로그 관리, 스프린트 계획)
    │     "사용자로서 이메일/비밀번호로 로그인할 수 있다"
    │     │
    │     ├── Use Case (상세 흐름 분석, 필요시)
    │     │     UC: 이메일/비밀번호 로그인
    │     │     - Main Flow: 정상 로그인
    │     │     - Alt: 2FA 필요한 경우
    │     │     - Exc: 계정 잠금 상태
    │     │     - Exc: 비활성 계정
    │     │     │
    │     │     └── BDD Scenario (자동화 테스트)
    │     │           Scenario: 유효한 자격증명으로 로그인
    │     │           Scenario: 잘못된 비밀번호 5회 시도 후 잠금
    │     │           Scenario: 잠긴 계정으로 로그인 시도
    │     │           Scenario: 2FA 코드 입력
    │     │
    │     └── Acceptance Criteria (Story 완료 기준)
    │           - [ ] 로그인 성공 시 대시보드로 이동
    │           - [ ] 5회 실패 시 30분 잠금
    │           - [ ] "비밀번호 찾기" 링크 존재
    │
    └── User Story
          "관리자로서 의심스러운 로그인 시도를 확인할 수 있다"
```

이 패턴의 핵심은:

1. **User Story**로 백로그를 관리하고 스프린트를 계획한다
2. 복잡한 흐름이 있으면 **Use Case**로 모든 경로를 분석한다
3. 핵심 경로를 **BDD Scenario**로 작성하여 자동화 테스트와 연결한다

---

## 7. 방법론별 선호도

| 방법론 | 주요 기법 | 보조 기법 | 특징 |
|--------|----------|----------|------|
| **Scrum** | User Story | BDD Scenario (AC) | PBI로 Story 관리, Sprint 단위 점진적 개발 |
| **Kanban** | User Story | - | WIP Limit에 맞는 작은 Story 선호 |
| **XP** | User Story | Acceptance Test | 고객과의 대화 강조, 테스트 우선 |
| **RUP** | Use Case | Activity Diagram | Use Case Driven Development, 반복적이지만 문서 중심 |
| **Waterfall** | Use Case + SRS | - | 단계별 산출물로서의 Use Case |
| **BDD** | BDD Scenario | User Story | Gherkin 기반 Executable Specification |
| **SAFe** | Epic → Feature → User Story | Use Case (선택) | PI Planning에서 Feature 단위 계획 |
| **Use Case 2.0** | Use Case Slice | User Story (호환) | Slice를 백로그에 넣어 Agile과 결합 |
| **Design Thinking** | User Scenario (UX) | User Story | 페르소나 기반 서사적 시나리오 |

### 방법론 선택에 따른 기법 흐름

```
[Scrum 팀]
  Product Backlog → User Story (INVEST) → Sprint → Acceptance Test
                                                        ↑
                                                   BDD Scenario (선택)

[RUP 팀]
  Vision → Use Case Model → Use Case Realization → Design → Implementation
                  ↑
            Use Case Diagram + Fully Dressed Use Case

[SAFe 팀]
  Strategic Theme → Epic → Feature → User Story → Sprint
       ↑              ↑        ↑          ↑
     Theme          Epic     Feature    Story + AC
                  (Lean BC) (Benefit    (INVEST)
                            Hypothesis)

[BDD 팀]
  Discovery → Formulation → Automation
  (Three Amigos) → (Gherkin Scenario) → (Step Definition + Test Code)
```

---

## 8. 실무 의사결정 가이드

### 8.1 언제 User Story를 쓰는가

```
✅ User Story가 적합한 경우:
  - Agile/Scrum 팀에서 백로그를 관리할 때
  - 비기술 이해관계자와 요구사항을 논의할 때
  - 기능의 비즈니스 가치와 우선순위를 판단할 때
  - 점진적으로 상세화할 계획일 때
  - 팀이 작고 대면 소통이 활발할 때

❌ User Story만으로 부족한 경우:
  - 복잡한 비즈니스 규칙과 예외 흐름이 많을 때
  - 규제 요구사항으로 문서화가 필수일 때
  - 외부 시스템과의 상호작용이 복잡할 때
  - 팀이 분산되어 대화 의존 모델이 어려울 때
```

### 8.2 언제 Use Case를 쓰는가

```
✅ Use Case가 적합한 경우:
  - 시스템의 전체 기능 범위를 파악해야 할 때
  - 예외/대안 흐름을 빠짐없이 분석해야 할 때
  - 규제 산업 (의료, 금융, 항공)에서 감사 추적이 필요할 때
  - 외부 시스템(Payment Gateway, 외부 API)과의 상호작용 설계 시
  - 아키텍처 설계의 입력물이 필요할 때
  - 대규모 프로젝트에서 팀 간 인터페이스를 정의할 때

❌ Use Case가 과도한 경우:
  - 작고 단순한 CRUD 기능
  - 빠른 프로토타이핑이 목적인 경우
  - 요구사항이 자주 변경되는 초기 탐색 단계
```

### 8.3 언제 BDD Scenario를 쓰는가

```
✅ BDD Scenario가 적합한 경우:
  - 인수 테스트를 자동화하고 싶을 때
  - PO/BA가 테스트 조건을 직접 검증하고 싶을 때
  - 비즈니스 규칙을 실행 가능한 명세로 관리하고 싶을 때
  - Three Amigos (PO+Dev+QA) 세션을 정례화한 팀
  - CI/CD 파이프라인에 인수 테스트를 통합할 때

❌ BDD Scenario가 과도한 경우:
  - 단순 기술적 구현 (유틸리티, 내부 로직) → 단위 테스트가 적합
  - UI의 시각적 요소 검증 → Visual Regression Testing이 적합
  - 성능 테스트 → 별도 도구 (JMeter, k6)가 적합
  - 모든 엣지 케이스에 Scenario를 작성하면 유지보수 지옥
```

### 8.4 하이브리드 권장 흐름

대부분의 현대 팀에 권장하는 조합 흐름이다.

```
┌─────────────────────────────────────────────────────────────┐
│                    하이브리드 워크플로우                        │
│                                                             │
│  1. 발견 (Discovery)                                        │
│     └→ User Story로 요구사항 포착                            │
│        "사용자로서, 상품을 주문할 수 있다"                     │
│                                                             │
│  2. 분석 (Analysis) — 복잡한 Story만                         │
│     └→ Use Case (Casual)로 흐름 분석                        │
│        Main Flow, Alternative, Exception 도출               │
│                                                             │
│  3. 정의 (Definition)                                       │
│     └→ Three Amigos 세션에서 BDD Scenario 작성               │
│        핵심 경로 3-7개의 Given-When-Then                     │
│                                                             │
│  4. 구현 (Implementation)                                   │
│     └→ BDD Scenario가 Red → 코드 작성 → Green              │
│                                                             │
│  5. 검증 (Verification)                                     │
│     └→ CI/CD에서 Scenario 자동 실행                          │
│        Scenario = Living Documentation                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 도구별 지원

### 9.1 도구 매핑

| 도구 | User Story | Use Case | BDD Scenario | 주요 용도 |
|------|-----------|----------|--------------|----------|
| **Jira** | ★★★★★ | ★★☆☆☆ | ★★★☆☆ (플러그인) | 백로그 관리, 스프린트 계획 |
| **Azure DevOps** | ★★★★★ | ★★★☆☆ | ★★★☆☆ (Test Plans) | Work Item 관리, CI/CD 통합 |
| **Visual Paradigm** | ★★☆☆☆ | ★★★★★ | ★★☆☆☆ | UML 모델링, Use Case Diagram |
| **Enterprise Architect** | ★★☆☆☆ | ★★★★★ | ★★☆☆☆ | 대규모 아키텍처 모델링 |
| **Cucumber** | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★★★★ | BDD 자동화 (Java, Ruby, JS) |
| **SpecFlow** | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★★★★ | BDD 자동화 (.NET) |
| **Behave** | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★★★★ | BDD 자동화 (Python) |
| **Confluence** | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | 문서화, 공유 |
| **Notion** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | 유연한 문서화, 데이터베이스 |
| **Miro/FigJam** | ★★★★☆ | ★★★☆☆ | ☆☆☆☆☆ | Story Mapping, 시각적 워크숍 |

### 9.2 Jira + Cucumber 통합 흐름

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│  Jira    │     │  Xray/Zephyr │     │  Git Repo      │     │  CI/CD   │
│          │     │  (플러그인)    │     │                │     │          │
│ [Story]  │────→│ [Test in     │────→│ .feature 파일  │────→│ Cucumber │
│ PROJ-123 │     │  Gherkin]    │     │                │     │ 실행     │
│          │     │              │     │ step_defs/     │     │          │
│ AC:      │     │ Scenario:    │     │  ├── login.js  │     │ 결과     │
│ Given... │     │  Given...    │     │  └── order.js  │     │ 보고서   │
└──────────┘     └──────────────┘     └────────────────┘     └──────────┘
     │                                                            │
     └──────────── 테스트 결과가 Jira Story에 자동 링크 ────────────┘
```

**흐름 설명:**

1. **Jira**에서 User Story 생성, Acceptance Criteria를 Given-When-Then으로 작성
2. **Xray/Zephyr** 플러그인이 AC를 Gherkin `.feature` 파일로 내보내기
3. **Git 리포지토리**에 `.feature` 파일과 Step Definition 코드 관리
4. **CI/CD 파이프라인**에서 Cucumber 실행, 결과를 Jira에 자동 보고

이 흐름에서 User Story의 Acceptance Criteria와 BDD Scenario가 **하나의 소스(Single Source of Truth)**로 관리된다.

---

## 10. 현대적 트렌드 (2020년대)

### 10.1 Use Case 2.0 (Jacobson, 2011~)

Ivar Jacobson은 자신이 만든 Use Case가 "너무 무거워졌다"는 비판을 받아들여, Agile 환경에 적합한 **Use Case 2.0**을 제안했다.

핵심 개념은 **Use Case Slice**이다.

```
전통적 Use Case:
  ┌─────────────────────────────┐
  │  UC: 상품 주문               │  ← 하나의 거대한 단위
  │  Main Flow (8 steps)        │
  │  Alt Flow 1                 │
  │  Alt Flow 2                 │
  │  Exc Flow 1                 │
  │  Exc Flow 2                 │
  │  Exc Flow 3                 │
  └─────────────────────────────┘

Use Case 2.0 Slice:
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Slice 1  │ │ Slice 2  │ │ Slice 3  │ │ Slice 4  │
  │ 기본주문  │ │ 기존배송지│ │ 결제재시도│ │ 쿠폰적용  │
  │ (Main    │ │ (Alt 1)  │ │ (Exc 1)  │ │ (Alt 2)  │
  │  Flow)   │ │          │ │          │ │          │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
       ↑            ↑            ↑            ↑
    Sprint 1     Sprint 1     Sprint 2     Sprint 3
```

**Use Case Slice의 특징:**
- Use Case의 특정 경로(Scenario)를 **독립적으로 구현/테스트/배포** 가능한 단위로 분리
- User Story와 유사한 크기로 분할하여 **Sprint Backlog에 투입** 가능
- Use Case의 전체 맥락(Context)은 유지하면서 점진적 구현

**User Story와의 비교:**

| 측면 | User Story | Use Case Slice |
|------|-----------|----------------|
| 맥락 보존 | 독립적 (맥락 분리) | Use Case 전체 맥락 내에서 위치 파악 가능 |
| 흐름 관계 | Story 간 관계 암묵적 | Main/Alt/Exc 관계 명시적 |
| 크기 | INVEST의 Small | 유사한 크기 |
| 백로그 관리 | 직접 PBI로 사용 | 직접 PBI로 사용 가능 |

### 10.2 BDD의 주류화와 Three Amigos

BDD는 2020년대에 들어 더 이상 "새로운 방법론"이 아니라 **성숙한 실무 관행**으로 자리잡았다.

#### Three Amigos 세션

Sprint 시작 전(또는 Backlog Refinement 시) 세 역할이 모여 User Story를 BDD Scenario로 구체화하는 세션이다.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Product     │     │  Developer   │     │  QA/Tester   │
│  Owner (PO)  │     │             │     │              │
│             │     │             │     │              │
│ "이 Story의 │     │ "기술적으로  │     │ "이 경우는   │
│  비즈니스    │     │  이 접근이   │     │  어떻게 되나? │
│  맥락은..."  │     │  가능하고..."│     │  엣지 케이스 │
│             │     │             │     │  는?"        │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │   Shared    │
                    │   BDD       │
                    │   Scenarios │
                    │  (Gherkin)  │
                    └─────────────┘
```

**Three Amigos의 가치:**
- PO가 비즈니스 규칙의 누락을 발견
- 개발자가 기술적 제약을 공유
- QA가 엣지 케이스와 예외 상황을 제기
- 결과물: 합의된 BDD Scenario = 인수 기준 + 테스트 케이스

### 10.3 AI를 활용한 자동 변환

2020년대 중반부터 LLM(Large Language Model)을 활용한 요구사항 기법 간 자동 변환이 실용화되고 있다.

```
[AI 활용 사례]

1. User Story → BDD Scenario 자동 생성
   입력: "사용자로서 비밀번호를 재설정할 수 있다"
   출력: 5-10개의 Given-When-Then Scenario 초안

2. User Story → Use Case 확장
   입력: User Story + 도메인 컨텍스트
   출력: Main/Alternative/Exception Flow 초안

3. Use Case → Test Case 도출
   입력: Fully Dressed Use Case
   출력: 경로별 Test Case 매트릭스

4. 자연어 요구사항 → Gherkin 변환
   입력: 회의록이나 이메일의 요구사항 서술
   출력: 정형화된 Feature/Scenario 구조
```

**주의점:**
- AI 생성물은 반드시 **Three Amigos 리뷰**를 거쳐야 한다
- AI는 도메인 고유의 비즈니스 규칙을 알지 못한다
- 초안(Draft) 생성 도구로 활용하고, 최종 검증은 사람이 한다
- AI가 생성한 Scenario의 **Step Definition은 여전히 개발자가 작성**해야 한다

---

## 11. 참고문헌

### 핵심 원전 (Primary Sources)

| 저자 | 저작 | 연도 | 핵심 기여 |
|------|------|------|----------|
| **Kent Beck** | *Extreme Programming Explained* | 1999 | User Story 개념 도입 |
| **Ron Jeffries** | "Essential XP: Card, Conversation, Confirmation" | 2001 | 3C 모델 정립 |
| **Rachel Davies** | Connextra 프로젝트 | 2001 | "As a... I want... so that..." 포맷 |
| **Bill Wake** | "INVEST in Good Stories" | 2003 | INVEST 품질 기준 |
| **Mike Cohn** | *User Stories Applied* | 2004 | User Story 체계화 및 대중화 |
| **Ivar Jacobson** | *Object-Oriented Software Engineering* | 1992 | Use Case 방법론 창시 |
| **Ivar Jacobson** et al. | "Use Case 2.0" (White Paper) | 2011 | Use Case Slice, Agile 적응 |
| **Alistair Cockburn** | *Writing Effective Use Cases* | 2000 | Goal Level, Fully Dressed 포맷 |
| **Dan North** | "Introducing BDD" | 2006 | BDD 개념 도입, Given-When-Then |
| **Grady Booch, James Rumbaugh, Ivar Jacobson** | *The Unified Modeling Language User Guide* | 1999 | UML Use Case Diagram 표준화 |
| **John Carroll** | *Scenario-Based Design* | 1995 | UX Scenario 방법론 |

### 추가 참고 자료

| 자료 | 출처 | 내용 |
|------|------|------|
| *Specification by Example* | Gojko Adzic, 2011 | BDD의 실무 적용 패턴 |
| *The Cucumber Book* | Matt Wynne & Aslak Hellesoy | Cucumber/Gherkin 실무 가이드 |
| *User Story Mapping* | Jeff Patton, 2014 | Story Map을 활용한 제품 발견 |
| *Impact Mapping* | Gojko Adzic, 2012 | WHY를 구조화하는 전략적 계획 |
| Agile Alliance Glossary | agilealliance.org | Agile 용어 공식 정의 |
| cucumber.io/docs | cucumber.io | Gherkin 공식 문법 레퍼런스 |
| usecases.org | Ivar Jacobson International | Use Case 2.0 공식 자료 |

---

> **문서 버전**: 1.0 | **최종 갱신**: 2026-03-09
