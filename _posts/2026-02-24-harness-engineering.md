---
layout: single
title: "Harness Engineering (하네스 엔지니어링)"
date: 2026-02-24 09:00:00 +0900
categories: ai
excerpt: "Harness Engineering은 AI 에이전트가 안정적으로 일하도록 환경·규칙·피드백 루프를 설계해 성능 변동을 줄이는 시스템 접근이다."
toc: true
toc_sticky: true
tags: [harness, engineering, ai, agent, verification]
---

**TL;DR**
- Harness Engineering은 모델을 바꾸지 않고 “일하는 환경”을 설계해 에이전트의 성능 변동을 줄이는 접근이다.
- 문서/규칙/검증 루프/관찰성을 엮어 에이전트가 구조를 벗어나지 않게 만드는 것이 핵심이다.
- 실패는 에이전트 탓이 아니라 harness 개선 신호이며, 지속적 피드백과 엔트로피 관리가 중요하다.

# 1. 개념
Harness Engineering은 AI 에이전트가 안정적이고 일관되게 작업할 수 있도록 에이전트 주변에 **도구, 규칙, 컨텍스트, 피드백 루프**를 설계하는 시스템 접근이다. 모델 자체를 건드리기보다, **모델이 일하는 환경**을 바꾸어 성능을 안정화한다.

# 2. 배경
프롬프트만으로는 대규모 코드베이스/복잡한 작업에서 일관성을 보장하기 어렵다. LLM은 문제에 따라 성능 편차가 큰 “Spiky Intelligence” 특성이 있어, 환경 설계와 검증 루프가 없으면 신뢰성을 확보하기 힘들다.

# 3. 이유
- 에이전트가 “어디에 무엇이 있는지”와 “아키텍처 규칙”을 스스로 지키기 어렵다.
- 단발 프롬프트로는 복잡한 시스템에서 오류/일탈을 막기 어렵다.
- 실패를 **harness 개선의 신호**로 보고, 반복 개선할 수 있는 구조가 필요하다.

# 4. 특징
- **Context Engineering**: AGENTS.md, docs/, 환경 정보, 관찰성 데이터를 통해 에이전트에 지도를 제공.
- **Architectural Constraints**: 린터/구조적 테스트/CI를 통해 규칙을 기계적으로 강제.
- **Feedback Loops**: Self-verify, loop detection, trace analysis로 실패를 개선에 연결.
- **Entropy Management**: 문서-코드 불일치와 아키텍처 위반을 주기적으로 청소.

# 5. 상세 내용

# Harness Engineering (하네스 엔지니어링)

> **작성일**: 2026-02-20
> **카테고리**: AI / 에이전트 엔지니어링
> **포함 내용**: Harness Engineering, Context Engineering, AI Agent, Codex, AGENTS.md, Self-Verification, Loop Detection, Structural Tests, Custom Linters, Entropy Management, Trace Analysis
> **출처**: [Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html), [LangChain](https://blog.langchain.com/improving-deep-agents-with-harness-engineering/), [OpenAI](https://openai.com/index/harness-engineering/)

---

# 1. 정의

```
> Harness Engineering
> = AI 에이전트가 안정적이고 일관되게 작업할 수 있도록
> 에이전트 주변에 구축하는
> 도구, 규칙, 컨텍스트, 피드백 루프의 총체적 설계
>
> 비유:
```text
> ├── harness = 말에 채우는 마구(馬具)
> ├── 말의 힘을 없애는 것이 아니라
```
```
>
> 핵심 원칙:
```text
> ├── 모델 자체는 건드리지 않는다
> ├── 모델이 일하는 환경을 바꾼다
```
```
>
> - Birgitta Böckeler (Martin Fowler 블로그)
> - OpenAI Codex 팀 내부 사례에서 유래
```

# 2. 등장 배경: 왜 필요한가

## Prompt Engineering만으로는 한계

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  문제 1: Prompt만으로는 복잡한 코드베이스에서 일관성 유지   │
│          불가능                                             │
│                                                             │
│  문제 2: "Spiky Intelligence" — LLM의 들쭉날쭉한 능력      │
│  ├── 어떤 문제는 놀랍도록 잘 풀고                          │
│  └── 비슷한 다른 문제는 완전히 실패                        │
│                                                             │
│  문제 3: 100만 줄 규모의 코드베이스에서                     │
│  ├── 어디에 뭐가 있는지 에이전트가 알아야 하고             │
│  ├── 아키텍처 규칙을 위반하지 않아야 하고                  │
│  └── 자기가 한 작업을 검증해야 한다                        │
│  → 프롬프트 하나로 해결 불가                               │
│                                                             │
│  증거: LangChain의 Terminal Bench 2.0 실험                  │
│  ├── 같은 모델 (GPT-5.2-Codex)                             │
│  ├── 프롬프트가 아닌 harness 변경만으로                     │
│  └── 52.8% → 66.5% (13.7%p 향상)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

## 엔지니어 역할의 근본적 전환

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Before (전통적 엔지니어)                                   │
│  ├── 코드를 직접 작성                                      │
│  ├── 버그를 직접 디버깅                                    │
│  └── 테스트를 직접 실행                                    │
│                                                             │
│          ↓  AI Agent 시대  ↓                                │
│                                                             │
│  After (Harness Engineer)                                   │
│  ├── 환경 설계 (에이전트가 일할 수 있는 구조)              │
│  ├── 의도 명세 (에이전트가 이해할 수 있는 문서)            │
│  ├── 피드백 루프 구축 (자동 검증/수정 사이클)              │
│  └── 가드레일 유지 (린터, 구조적 테스트, CI)               │
│                                                             │
│  OpenAI 사례:                                               │
│  ├── 5개월, ~40명 팀                                       │
│  ├── ~100만 줄 프로덕션 코드                               │
│  ├── ~1,500 PR                                             │
│  └── 개발 시간 약 1/10 수준으로 단축                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 3. 진화 과정

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Prompt Engineering → Context Engineering → Harness Eng.    │
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ Prompt Engineering   │  LLM에 주는 텍스트 최적화         │
│  │ (2022~)              │  한계: 단발성, 복잡한 작업 불안정 │
│  └────────┬────────────┘
</pre>
                                    │
│           ↓                                                 │
│  
<pre class="ascii-box">
┌─────────────────────┐                                    │
│  │ Context Engineering  │  프롬프트 + 검색 + 메모리 + 도구  │
│  │ (2024~)              │  한계: 구조적 일탈을 막지 못함    │
│  └────────┬────────────┘
</pre>
                                    │
│           ↓                                                 │
│  
<pre class="ascii-box">
┌─────────────────────┐                                    │
│  │ Harness Engineering  │  컨텍스트 + 아키텍처 제약         │
│  │ (2025~)              │  + 피드백 루프 + 엔트로피 관리    │
│  └─────────────────────┘
</pre>
  현재 최전선                       │
│                                                             │
│  핵심 차이:                                                 │
│  ├── Prompt Eng. → "뭘 말하느냐" (입력 최적화)             │
│  ├── Context Eng. → "뭘 보여주느냐" (정보 제공)            │
│  └── Harness Eng. → "어떤 환경에서 일하느냐" (시스템 설계) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
```
```

# 4. 핵심 구성 요소

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                      HARNESS                                │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ 1. Context        │    │ 2. Architectural  │              │
│  │    Engineering    │    │    Constraints    │              │
│  │                   │    │                   │              │
│  │ • AGENTS.md      │    │ • Custom linters  │              │
│  │ • docs/          │    │ • Structural tests│              │
│  │ • env info       │    │ • Dependency rules│              │
│  │ • tool docs      │    │ • CI validation   │
│  │  └──────────────────┘
</pre>
    └──────────────────┘              │
│                                                             │
│  
<pre class="ascii-box">
┌──────────────────┐    ┌──────────────────┐              │
│  │ 3. Feedback       │    │ 4. Entropy        │              │
│  │    Loops          │    │    Management     │              │
│  │                   │    │                   │              │
│  │ • Self-verify    │    │ • Doc drift 감지  │              │
│  │ • Loop detection │    │ • Arch 위반 스캔  │              │
│  │ • Trace analysis │    │ • 주기적 정리     │
│  │ • Observability  │    │   에이전트        │
│  │  └──────────────────┘
</pre>
    └──────────────────┘              │
│                                                             │
│              
<pre class="ascii-box">
┌──────────────────┐                           │
│              │    AI Agent      │                           │
│              │    (LLM Core)   │                           │
│              └──────────────────┘
</pre>
                           │
└─────────────────────────────────────────────────────────────┘
</pre>
```
```

## 4.1 Context Engineering (컨텍스트 엔지니어링)

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  목적: 에이전트에게 "지도"를 제공                           │
│                                                             │
│  OpenAI의 교훈:                                             │
│  ├── "하나의 거대한 AGENTS.md" 접근은 실패                  │
│  ├── Context는 희소 자원 — 거대한 지시 파일은               │
│  │   작업, 코드, 관련 문서를 밀어낸다                       │
│  └── 해결: ~100줄의 AGENTS.md가 deeper source of truth를   │
│      가리키는 "지도" 역할                                   │
│                                                             │
│  구체적 기법:                                               │
│  ├── AGENTS.md: 코드베이스 구조 맵 (~100줄)                │
│  ├── docs/ 디렉토리: 단일 진실 소스 (source of truth)      │
│  ├── 환경 정보 주입: 디렉토리 구조, 사용 가능 도구         │
│  ├── 시간 예산 경고: 비효율적 작업 방지                     │
│  └── 관찰성 데이터: 로그, 메트릭, span 접근 제공           │
│                                                             │
│  LangChain 실험 (Environmental Context Injection):          │
│  ├── 작업 시작 전 디렉토리 매핑 자동 제공                  │
│  ├── 테스트 가능한 코드 작성 가이드라인 주입                │
│  └── 시간 예산 경고로 비효율 반복 방지                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

## 4.2 Architectural Constraints (아키텍처 제약)

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  목적: 에이전트가 "길을 벗어나지 않도록" 기계적 강제       │
│                                                             │
│  결정론적 규칙 (deterministic):                             │
│  ├── Custom Linters: 팀/프로젝트 규칙을 코드로 강제        │
│  ├── Structural Tests: 의존성 방향, 모듈 경계 검증         │
│  ├── CI Validation: 린터 + 구조 테스트를 CI에 통합         │
│  └── 파일 크기 제한, 네이밍 규칙, 구조화된 로깅            │
│                                                             │
│  OpenAI의 의존성 흐름 규칙:                                 │
│  Types → Config → Repo → Service → Runtime → UI            │
│  (역방향 의존 = 구조적 테스트가 즉시 차단)                 │
│                                                             │
│  "Taste Invariants" (미감 불변량):                          │
│  ├── 구조화된 로깅 (structured logging)                    │
│  ├── 스키마/타입 네이밍 규칙                                │
│  ├── 파일 크기 제한                                        │
│  └── 플랫폼별 신뢰성 요구사항                              │
│                                                             │
│  LLM 기반 모니터링 (비결정론적):                            │
│  └── 코드 리뷰 에이전트가 "미감" 기준으로 PR 검토          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

## 4.3 Feedback Loops (피드백 루프)

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  목적: 에이전트가 자기 작업을 검증하고 스스로 수정          │
│                                                             │
│  1) Self-Verification Loop (자기 검증 루프)                 │
│     ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐            │
│     │ Plan │ → │ Build│ → │Verify│ → │ Fix  │ → (반복)    │
│     └──────┘
</pre>
   └──────┘   └──────┘   └──────┘            │
│     • 미들웨어가 원래 작업 명세 대비 검증 강제              │
│     • 자기 코드만 보는 것이 아니라 원래 요구사항 확인       │
│                                                             │
│  2) Loop Detection (루프 감지)                              │
│     • 같은 파일을 반복 수정하는 "doom loop" 패턴 감지       │
│     • 감지 시 전략 변경 유도                               │
│     • LangChain의 LoopDetectionMiddleware 사례              │
│                                                             │
│  3) Trace Analysis (추적 분석)                              │
│     • 실패한 실행 trace를 자동 수집                         │
│     • 병렬 분석 에이전트가 실패 패턴 식별                   │
│     • ML의 boosting처럼 이전 실패에 집중                    │
│     • 발견된 패턴으로 harness 반복 개선                     │
│                                                             │
│  4) Observability Integration (관찰성 통합)                 │
│     • 에이전트에게 텔레메트리(로그, 메트릭, span) 접근      │
│     • 버그를 자율적으로 재현하고 반복 수정                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
```
```

## 4.4 Entropy Management (엔트로피 관리)

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  목적: 시간이 지남에 따라 코드베이스가 무질서해지는 것 방지 │
│                                                             │
│  문제:                                                      │
│  ├── 에이전트가 만든 코드도 시간이 지나면 일관성 저하      │
│  ├── 문서와 코드의 불일치 누적                              │
│  └── 아키텍처 위반이 서서히 침투                            │
│                                                             │
│  해결:                                                      │
│  ├── 주기적 에이전트: 문서 불일치를 찾는 별도 에이전트     │
│  ├── 아키텍처 위반 스캔: 정기적으로 구조적 테스트 실행     │
│  ├── 문서-코드 교차 검증: CI에서 자동화                    │
│  └── 기술 부채 감지: 에이전트가 생성한 코드도 리뷰 대상   │
│                                                             │
│  원칙:                                                      │
│  "에이전트가 만든 엔트로피는 에이전트가 치운다"            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 5. 3개 글 비교 분석

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  관점     │ OpenAI          │ LangChain      │ Martin Fowler│
│  ─────────┼─────────────────┼────────────────┼──────────────│
│  성격     │ 원조 사례 (1st  │ 실전 벤치마크  │ 비판적 분석  │
│           │ party)          │ 검증           │ + 미래 전망  │
│  ─────────┼─────────────────┼────────────────┼──────────────│
│  초점     │ 프로덕션 시스템 │ 성능 최적화    │ 산업 영향    │
│           │ 구축 방법론     │ 기법           │ 분석         │
│  ─────────┼─────────────────┼────────────────┼──────────────│
│  핵심     │ AGENTS.md,      │ Self-Verify,   │ 3가지 분류,  │
│  기여     │ Depth-First,    │ Loop Detect,   │ 미래 시나리  │
│           │ Structural Test │ Trace Analysis │ 오, 비판     │
│  ─────────┼─────────────────┼────────────────┼──────────────│
│  증거     │ 100만 줄,       │ 52.8%→66.5%    │ 기존 사례    │
│           │ 1,500 PR        │ 벤치마크       │ 종합 분석    │
│  ─────────┼─────────────────┼────────────────┼──────────────│
│  독자     │ 에이전트 기반   │ 에이전트       │ CTO/         │
│           │ 개발팀          │ 개발자         │ 아키텍트     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

## 공통점

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. 모델을 바꾸지 않고 환경을 바꾼다                       │
│     → 모든 글이 동일한 LLM에서 harness만으로 개선 입증     │
│                                                             │
│  2. 실패는 harness 개선의 신호                              │
│     → 에이전트 탓이 아니라 환경 설계의 문제                 │
│                                                             │
│  3. 문서가 인프라다                                         │
│     → AGENTS.md, docs/, 환경 정보 모두 "실행 가능한 문서"  │
│                                                             │
│  4. 검증 루프는 필수                                        │
│     → 에이전트는 기본적으로 자기 검증을 잘 안 한다         │
│     → 강제해야 한다                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 6. 실전 기법 정리

## OpenAI Codex 팀의 기법

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Depth-First Development (깊이 우선 개발)                │
│     ├── 큰 목표를 작은 빌딩 블록으로 분해                  │
│     ├── 설계 → 코드 → 리뷰 → 테스트 순서로 위임           │
│     └── 각 블록 완성 후 다음 블록으로 진행                  │
│                                                             │
│  2. AGENTS.md as Map (~100줄)                               │
│     ├── 코드베이스 전체 구조를 가리키는 "지도"              │
│     ├── 거대한 지시서가 아닌 포인터 모음                    │
│     └── 깊은 정보는 docs/에서 필요 시 접근                  │
│                                                             │
│  3. Structural Tests                                        │
│     ├── Types → Config → Repo → Service → Runtime → UI     │
│     ├── 의존성 방향 위반 = 테스트 실패                      │
│     └── ArchUnit 스타일의 아키텍처 검증                     │
│                                                             │
│  4. PR Review Automation                                    │
│     ├── Codex가 모든 PR에 자동 리뷰                        │
│     ├── 구조적 표준, 모듈 경계, 커버리지 검사              │
│     └── 사람은 최종 확인만                                  │
│                                                             │
│  5. Reusable Skills                                         │
│     ├── 수백 개의 재사용 가능한 skill 축적                  │
│     ├── 베스트 프랙티스가 skill로 인코딩                    │
│     └── 온보딩 가속: "이미 최적화된 도구" 제공              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

## LangChain의 기법

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Self-Verification Loop                                  │
│     ├── 미들웨어가 "원래 명세 대비 검증했는가?" 강제       │
│     ├── 자기 코드만 리뷰하는 것 방지                        │
│     └── Plan → Build → Verify → Fix 사이클                  │
│                                                             │
│  2. LoopDetectionMiddleware                                  │
│     ├── 같은 파일 반복 수정 패턴 감지                       │
│     ├── "doom loop" 탈출 유도                               │
│     └── 전략 재고 프롬프트 자동 삽입                        │
│                                                             │
│  3. Reasoning Sandwich (추론 샌드위치)                       │
│     ├── 초기 계획: 고수준 추론 (비용 높음)                  │
│     ├── 구현 단계: 중간 수준 추론 (비용 절감)               │
│     └── 최종 검증: 고수준 추론 (품질 보장)                  │
│                                                             │
│  4. Trace Analyzer                                          │
│     ├── LangSmith에서 실패 실행 데이터 자동 수집            │
│     ├── 병렬 분석 에이전트가 실패 패턴 식별                 │
│     ├── ML boosting 방식: 이전 실패에 집중                  │
│     └── 발견된 패턴 → harness 구체적 개선으로 변환         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 7. 팀에 적용하려면

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  단계별 도입 가이드:                                        │
│                                                             │
│  Phase 1: 기존 harness 평가                                 │
│  ├── 이미 있는 것: pre-commit hooks, linters, CI,           │
│  │   ArchUnit 같은 구조적 테스트 프레임워크                 │
│  └── 없는 것: 어떤 가드레일이 빠져 있는지 식별             │
│                                                             │
│  Phase 2: Context 정비                                      │
│  ├── AGENTS.md (또는 CLAUDE.md) 작성: ~100줄 이내          │
│  ├── docs/ 디렉토리 체계화: 아키텍처, API, 규칙 문서화    │
│  └── 환경 정보 자동 주입 파이프라인 구축                    │
│                                                             │
│  Phase 3: Architectural Constraints 강화                    │
│  ├── Custom linter 규칙 추가 (팀 규칙을 코드로)            │
│  ├── 의존성 방향 테스트 도입                                │
│  └── CI에 구조적 검증 통합                                  │
│                                                             │
│  Phase 4: Feedback Loop 구축                                │
│  ├── Self-verification 미들웨어 도입                        │
│  ├── 실패 trace 수집 및 분석 자동화                         │
│  └── Loop detection 메커니즘 추가                           │
│                                                             │
│  Phase 5: Entropy Management                                │
│  ├── 문서-코드 일치 검증 자동화                             │
│  ├── 주기적 아키텍처 준수 스캔                              │
│  └── 기술 부채 모니터링                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 8. Martin Fowler의 미래 전망

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  시나리오 1: Harness가 표준 템플릿이 된다                   │
│  ├── 특정 앱 토폴로지(웹 API, 배치 등)에 대한              │
│  │   표준 harness 패키지가 등장                             │
│  └── "Spring Boot starter" 처럼 harness starter 등장        │
│                                                             │
│  시나리오 2: 기술 스택 표준화 압력                           │
│  ├── AI에 최적화된 표준 기술 스택으로의 수렴                │
│  ├── 비표준 스택 = 에이전트 성능 저하                       │
│  └── 기술 선택의 자유도 감소 가능성                         │
│                                                             │
│  시나리오 3: Pre-AI vs AI-Native 분리                       │
│  ├── 기존 레거시 시스템 (harness 없음)                      │
│  ├── 새로운 AI-native 시스템 (harness 내장)                 │
│  └── 두 세계 사이의 간극 확대                               │
│                                                             │
│  비판적 지적:                                               │
│  ├── 기능/행동 검증(functional verification) 논의 부족      │
│  └── 내부 코드 품질을 넘어선 사용자 관점 검증 필요         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

# 9. 핵심 한 줄 요약

<pre class="ascii-box">
<pre class="ascii-box">
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Harness Engineering =                                      │
│  "모델을 바꾸지 않고, 모델이 일하는 환경을 바꿔서          │
│   들쭉날쭉한 AI 에이전트의 능력을                           │
│   원하는 작업에 안정적으로 발휘시키는 시스템 설계"          │
│                                                             │
│  실천 원칙:                                                 │
│  ├── 에이전트 실패 → harness를 개선하라                    │
│  ├── 문서는 인프라다 → 기계가 읽을 수 있게 작성하라       │
│  ├── 검증은 강제하라 → 에이전트는 스스로 안 한다           │
│  └── Context는 희소 자원이다 → 지도를 주되 지시서는 주지   │
│      마라                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
</pre>
</pre>
```
```

---

> **출처**
> - [Harness Engineering - Martin Fowler (Birgitta Böckeler)](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
> - [Improving Deep Agents with Harness Engineering - LangChain](https://blog.langchain.com/improving-deep-agents-with-harness-engineering/)
> - [Harness Engineering: Leveraging Codex in an Agent-First World - OpenAI](https://openai.com/index/harness-engineering/)
> - [OpenAI Introduces Harness Engineering - InfoQ](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/)
