# 문서화 Skill (Documentation Writer)

대화 내용을 **나중에 봤을 때 쉽게 이해할 수 있는 블로그 설명글**로 정리. Auto-save to `_posts/`.

## Trigger
- User says: "정리해줘", "문서화", "포스트로", "블로그에", "기록해줘"
- After completing a technical question/answer session

## 핵심 원칙

**"6개월 후의 나"가 읽어도 바로 이해할 수 있게 작성**

- 배경/맥락부터 설명 (왜 이게 필요한지)
- 개념을 차근차근 풀어서 설명
- 예시와 비유 활용
- 코드는 주석과 함께

## Process

### 1. 핵심 내용 파악
대화에서 추출:
- **주제**: 무엇에 대한 내용인가
- **배경**: 왜 이게 필요했나, 어떤 문제를 해결하나
- **핵심 개념**: 이해해야 할 주요 개념들
- **실제 사용법**: 코드, 명령어, 설정 등
- **주의사항**: 실수하기 쉬운 점, 함정

### 2. 카테고리 결정
기존 블로그 카테고리에 매핑:
- `reversing` - 바이너리 분석, crackmes, VM protection
- `rust` - Rust 프로그래밍
- `python` - Python 프로그래밍
- `bazel` - Bazel 빌드 시스템
- `bevy` - Bevy 게임 엔진
- `cpp` - C++ 프로그래밍
- `csharp` - C#/ASP.NET
- `system` - 시스템 설계, streaming
- `tools` - vim, claude-code, 개발 도구
- `jekyll` - 블로그 관련

### 3. 기존 포스트 검색
```bash
grep -l "keyword" _posts/*.markdown
```

관련 포스트 있고 내용이 보완적 → 기존 글에 섹션 추가
관련 포스트 없거나 독립적 주제 → 새 포스트 생성

### 4. 포스트 템플릿

```markdown
---
layout: single
title: "{주제를 명확히 설명하는 제목}"
date: {YYYY-MM-DD HH:MM:SS} +0900
categories: [{category}]
tags: [{tag1}, {tag2}, {tag3}]
toc: true
toc_sticky: true
excerpt: "{이 글에서 다루는 내용 한 줄 요약}"
---

## 개요

{이 글에서 다룰 내용 소개. 왜 이 주제가 중요한지, 어떤 문제를 해결하는지 설명}

## {핵심 개념 1}

{개념에 대한 상세 설명. 비유나 예시를 들어 이해하기 쉽게}

### 동작 방식

{어떻게 작동하는지 설명}

### 예시

```{language}
// 코드에 주석을 달아서 각 부분이 무엇을 하는지 설명
code here
```

## {핵심 개념 2}

{다음 개념 설명...}

## 실제 사용법

{실제로 어떻게 사용하는지 단계별로}

### Step 1: {단계 설명}

```{language}
code
```

### Step 2: {단계 설명}

```{language}
code
```

## 주의할 점

{실수하기 쉬운 부분, 흔한 오류, 알아두면 좋은 팁}

- **{주의점 1}**: 설명
- **{주의점 2}**: 설명

## 정리

{핵심 내용 요약. 기억해야 할 것들}

## 참고 자료

- [링크 제목](URL)
```

### 5. 파일명 규칙
```
_posts/YYYY-MM-DD-{slug}.markdown
```
- slug: 소문자, 하이픈 사용, 특수문자 제외
- 예: `2024-01-28-claude-code-skills.markdown`

## 작성 예시

### 예시: Claude Code Skills 설명글

**Created:** `_posts/2024-01-28-claude-code-skills.markdown`

```markdown
---
layout: single
title: "Claude Code Skills - 커스텀 명령어 만들기"
date: 2024-01-28 15:30:00 +0900
categories: [tools]
tags: [claude-code, ai, automation, skills]
toc: true
toc_sticky: true
excerpt: "Claude Code에서 반복 작업을 자동화하는 Skills 기능 활용법"
---

## 개요

Claude Code를 사용하다 보면 비슷한 요청을 반복하게 된다. "이 코드 리뷰해줘", "테스트 작성해줘", "문서화해줘" 같은 작업들. Skills는 이런 반복 작업을 템플릿화해서 Claude가 일관되고 정확하게 수행하도록 만드는 기능이다.

쉽게 말해, **Claude에게 주는 작업 매뉴얼**이라고 생각하면 된다.

## Skills란?

Skills는 세 가지 요소로 구성된다:

1. **Instructions**: 작업 수행 방법에 대한 상세 지침
2. **Template**: 출력 형식 (일관된 결과물)
3. **Context**: 도메인 지식, 프로젝트 규칙

이는 머신러닝의 **few-shot prompting**과 비슷한 개념이다. 좋은 예시를 보여주면 AI가 패턴을 학습해서 비슷한 품질의 결과를 낸다.

### 동작 방식

```
사용자: "정리해줘"
    ↓
Claude: Skills 파일에서 "정리해줘" 트리거 매칭
    ↓
Claude: Skill에 정의된 프로세스 실행
    ↓
결과: 일관된 형식의 문서 생성
```

## Skill 파일 만들기

Skills는 `.claude/skills/` 디렉토리에 마크다운 파일로 저장한다.

### 기본 구조

```markdown
# Skill 이름

한 줄 설명

## Trigger
- 이 skill을 실행할 키워드들

## Process
1. 첫 번째 단계
2. 두 번째 단계
...

## Template
출력 형식 정의

## Examples
구체적인 예시
```

### 실제 예시: 코드 리뷰 Skill

```markdown
# Code Review Skill

코드를 리뷰하고 개선점을 제안한다.

## Trigger
- "리뷰해줘", "코드 봐줘", "review"

## Process
1. 코드 구조 파악
2. 버그 가능성 체크
3. 성능 이슈 확인
4. 가독성 평가

## Template
### 요약
{전체 평가}

### 좋은 점
- ...

### 개선 제안
- [ ] {제안 1}
- [ ] {제안 2}
```

## 주의할 점

- **너무 복잡하게 만들지 말 것**: Skill이 복잡하면 Claude도 혼란스러워함
- **예시를 충분히 제공**: few-shot이므로 좋은 예시가 핵심
- **트리거 키워드 겹침 주의**: 여러 skill의 트리거가 겹치면 예상치 못한 동작

## 정리

- Skills = Claude에게 주는 작업 매뉴얼
- `.claude/skills/`에 마크다운으로 작성
- Trigger → Process → Template → Examples 구조
- 반복 작업 자동화에 효과적

## 참고 자료

- [Claude Code 공식 문서](https://docs.anthropic.com/claude-code)
```

## 실행 규칙

1. **항상 검색 먼저** - 새 글 만들기 전에 `_posts/`에서 관련 글 확인
2. **맥락부터 설명** - "왜"를 먼저 설명하고 "어떻게"로 넘어감
3. **비유와 예시 활용** - 추상적 개념은 구체적 예시로
4. **코드엔 주석 필수** - 코드만 덩그러니 두지 않음
5. **한국어 우선** - 블로그 기존 스타일과 맞춤
6. **자동 저장** - 확인 없이 바로 `_posts/`에 저장
7. **결과 알림** - 어떤 파일이 생성/수정됐는지 알려줌

## 하지 말 것

- 대화 맥락 언급 금지 ("아까 물어보신...", "위에서 말한...")
- 너무 짧은 bullet point만 나열 금지
- 설명 없는 코드 덩어리 금지
- 이미 있는 내용 중복 생성 금지
