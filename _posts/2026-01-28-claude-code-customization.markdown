---
layout: single
title: "Claude Code 커스터마이징 - CLAUDE.md와 Skills"
date: 2026-01-28 23:09:00 +0900
categories: [tools]
tags: [claude-code, ai, automation, productivity]
toc: true
toc_sticky: true
excerpt: "Claude Code를 프로젝트별로 커스터마이징하는 방법. CLAUDE.md로 기본 지침 설정, Skills로 반복 작업 자동화"
---

## 개요

Claude Code는 터미널에서 사용하는 AI 코딩 어시스턴트다. 기본적으로도 유용하지만, 프로젝트마다 다른 컨텍스트와 작업 패턴이 있다. 매번 같은 설명을 반복하는 건 비효율적이다.

이 글에서는 두 가지 커스터마이징 방법을 다룬다:
- **CLAUDE.md**: 프로젝트별 기본 지침 설정
- **Skills**: 반복 작업을 템플릿화

## CLAUDE.md - 프로젝트 지침서

### CLAUDE.md란?

Claude Code는 시작할 때 현재 디렉토리의 `CLAUDE.md` 파일을 자동으로 읽는다. 이 파일에 적힌 내용은 Claude의 "기본 지침"이 된다.

쉽게 말해, **"이 프로젝트에서는 이렇게 행동해"**라고 미리 알려주는 것이다.

### 적용 범위

```
~/.claude/CLAUDE.md          # 전역 설정 (모든 프로젝트)
프로젝트/CLAUDE.md            # 프로젝트별 설정 (해당 디렉토리에서만)
```

전역 설정과 프로젝트 설정이 모두 있으면, 둘 다 적용된다.

### 활용 예시

#### 1. 프로젝트 구조 설명

```markdown
## 디렉토리 구조

- `src/` - 소스 코드
- `tests/` - 테스트 파일
- `docs/` - 문서
```

이렇게 해두면 Claude가 "파일 어디있어?"라고 매번 찾아다니지 않는다.

#### 2. 코딩 컨벤션

```markdown
## 코딩 규칙

- 함수명은 snake_case
- 타입 힌트 필수
- docstring은 Google 스타일
```

#### 3. 기본 동작 모드 설정

```markdown
## 기본 동작

이 디렉토리에서는 질문에 답변한 후,
내용을 블로그 포스트로 정리해서 _posts/에 저장한다.
```

이렇게 하면 Claude를 켜자마자 특정 모드로 동작하게 만들 수 있다.

## Skills - 반복 작업 자동화

### Skills란?

Skills는 **Claude에게 주는 작업 매뉴얼**이다. 특정 키워드를 말하면 정해진 프로세스대로 작업을 수행한다.

머신러닝의 **few-shot prompting**과 비슷한 개념이다:
- 좋은 예시를 보여주면
- AI가 패턴을 학습해서
- 비슷한 품질의 결과를 낸다

### 구성 요소

Skills는 세 가지로 구성된다:

| 요소 | 역할 |
|------|------|
| Instructions | 작업 수행 방법 상세 지침 |
| Template | 출력 형식 정의 |
| Examples | 구체적인 예시 (few-shot) |

### Skill 파일 만들기

`.claude/skills/` 디렉토리에 마크다운 파일로 저장한다.

```
프로젝트/
├── .claude/
│   └── skills/
│       ├── doc.md        # 문서화 skill
│       └── review.md     # 코드 리뷰 skill
└── ...
```

### 기본 구조

```markdown
# Skill 이름

한 줄 설명

## Trigger
- skill을 실행할 키워드들
- 예: "정리해줘", "문서화", "리뷰해줘"

## Process
1. 첫 번째 단계
2. 두 번째 단계
...

## Template
출력 형식 정의 (마크다운)

## Examples
구체적인 입출력 예시
```

### 실제 예시: 문서화 Skill

```markdown
# 문서화 Skill

대화 내용을 블로그 포스트로 정리

## Trigger
- "정리해줘", "문서화", "블로그에"

## Process
1. 대화에서 핵심 내용 추출
2. _posts/에서 관련 글 검색
3. 있으면 기존 글에 추가, 없으면 새 글 생성

## Template
---
layout: single
title: "{주제}"
date: {날짜}
categories: [{카테고리}]
---

## 개요
{왜 이게 필요한지}

## 핵심 내용
{설명}

## 사용법
{코드 예시}
```

### 동작 흐름

```
사용자: "정리해줘"
    ↓
Claude: Skills 파일에서 트리거 매칭
    ↓
Claude: 정의된 프로세스 실행
    ↓
결과: 템플릿에 맞는 일관된 결과물
```

## 조합해서 사용하기

CLAUDE.md와 Skills를 함께 사용하면 강력하다.

### 예: 학습 블로그 자동화

**CLAUDE.md:**
```markdown
## 기본 동작

질문에 답변 후 _posts/에 자동 정리
스타일: .claude/skills/doc.md 참조
```

**skills/doc.md:**
```markdown
# 문서화 Skill

## Template
(블로그 포스트 형식)

## Examples
(좋은 예시들)
```

이렇게 하면:
1. Claude 시작 → CLAUDE.md 읽음 → "학습 기록 모드" 인식
2. 질문하면 → 답변 + 자동으로 블로그 포스트 생성
3. 포스트 형식 → skills/doc.md의 템플릿 따름

## 주의할 점

- **CLAUDE.md는 간결하게**: 너무 길면 오히려 혼란
- **Skill은 예시가 핵심**: few-shot이므로 좋은 예시를 충분히
- **트리거 겹침 주의**: 여러 skill의 트리거가 겹치면 예상치 못한 동작

## 정리

| 기능 | 용도 | 위치 |
|------|------|------|
| CLAUDE.md | 프로젝트 기본 지침 | 프로젝트 루트 |
| Skills | 반복 작업 템플릿 | `.claude/skills/` |

두 가지를 조합하면 프로젝트에 맞춤화된 AI 어시스턴트를 만들 수 있다.
