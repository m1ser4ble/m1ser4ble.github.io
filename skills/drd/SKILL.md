---
name: drd
description: "Use only when the user explicitly invokes one of these tokens: drd, $drd, /drd, deep-research-doc, or /deep-research-doc."
---

# Deep Research & Document Enrichment

Port of the user's Claude `drd` skill for Codex. Use it to turn a technical
topic or existing document into a durable reference: not only "how to use it",
but why it exists, what it replaced, where the terms came from, and how to
choose among alternatives in real systems.

## Invocation Gate

Use this skill only when the current user message explicitly includes `drd`,
`$drd`, `/drd`, `deep-research-doc`, or `/deep-research-doc`.

If this skill was loaded for a generic research, documentation enrichment,
terminology, history, alternatives, or best-practices request that does not
include one of those exact tokens, do not apply this workflow. Continue with the
normal Codex behavior instead.

## Workflow

1. Resolve the target.
   - If the user gave a file path, read the whole file first and preserve its
     style.
   - If the user gave a topic only, produce a standalone Markdown research
     note unless they specify an output file.
   - If the scope is too broad to research usefully, ask one concise scoping
     question; otherwise proceed.
2. Extract concepts.
   - List the technical terms, acronyms, protocols, frameworks, patterns, and
     decisions that need explanation.
   - Identify which of the mandatory dimensions are missing or shallow.
3. Research with source discipline.
   - Use current web/source lookup whenever facts may be recent, contested, or
     source-sensitive.
   - Prefer primary sources: official docs, RFCs/specs, papers, engineering
     blogs, conference talks, and project repositories.
   - Do not invent citations, dates, benchmark numbers, or company practices.
   - Use parallel tool calls or subagents when available; otherwise run the
     dimensions sequentially.
4. Synthesize in Korean, preserving English technical terms.
5. Enrich the document.
   - For existing docs, add missing sections without rewriting unrelated
     existing content.
   - Match existing Markdown style, tables, headings, and ASCII diagrams when
     present.
   - Include source URLs in a references section or inline citations.

## Mandatory Research Dimensions

Cover all dimensions unless the topic truly does not support one. If a
dimension has no reliable source, say so explicitly.

| # | Dimension | What to Find |
|---|-----------|--------------|
| 1 | 용어 (Terminology) | Acronym full names, literal meanings, naming origin, why the term is used |
| 2 | 등장 배경과 이유 (Why It Emerged) | The problem or limitation that caused it to appear, and what older approach was insufficient |
| 3 | 역사적 기원 (Historical Origins) | Who created it, when, in what context, and the first important release/spec/paper |
| 4 | 학술적/이론적 배경 (Academic Foundation) | Papers, RFCs, standards, algorithms, theory, and formal model behind it |
| 5 | 진화 타임라인 (Evolution Timeline) | Chronological evolution and major turning points |
| 6 | 대안 비교 (Alternatives & Trade-offs) | Competing approaches, strengths, weaknesses, operational trade-offs |
| 7 | 효과적인 상황 분석 (When Each Is Effective) | Decision criteria by scale, team, latency, consistency, security, cost, and operability |
| 8 | 실전 베스트 프랙티스 (Best Practices) | Recommended settings, implementation patterns, anti-patterns, migration notes, gotchas |
| 9 | 빅테크 실전 사례 (Big Tech Strategies) | Public production examples from companies such as Google, Meta, Netflix, LinkedIn, Uber, Stripe, Amazon, or Cloudflare, including architecture, scale, selection reason, and lessons |

## Research Decomposition

When the topic is substantial, split the work across these tracks:

| Track | Focus |
|-------|-------|
| 1 | Terminology origins, why it emerged, historical origin |
| 2 | Papers, RFCs, standards, theoretical background, timeline |
| 3 | Alternative technologies, architecture, implementation mechanics |
| 4 | Comparison analysis, benchmarks, scenario-based decision criteria |
| 5 | Best practices, pitfalls, migration patterns, production case studies |

## Output Contract

Write the final result in Korean with English technical terms preserved.

For a full document or substantial enrichment, include these sections:

```markdown
# <Title>

## 핵심 요약

## 용어 사전

## 등장 배경과 이유

## 역사적 기원

## 학술적/이론적 배경

## 연대표

## 동작 메커니즘

## 대안 비교표

## 상황별 최적 선택

## 실전 베스트 프랙티스

## 함정과 안티패턴

## 빅테크 실전 사례

## 참고자료
```

For smaller requests, keep the answer shorter but still include terminology,
background, alternatives, best choice by scenario, and references.

## Style Rules

- Korean prose is required; keep English names, APIs, identifiers, and terms in
  English.
- Prefer Markdown tables for terminology, timelines, and comparisons.
- Use ASCII/box diagrams only when they clarify architecture or match an
  existing document's style.
- Make selection criteria explicit instead of saying "it depends".
- Include concrete version/date context when the topic is time-sensitive.
- Separate sourced facts from inference; label inference when combining sources.

## Editing Rules

- Preserve user-written content unless the user asks for a rewrite.
- Add missing sections near related content, or append a clearly titled
  enrichment section if the existing document structure is unclear.
- Keep references close enough that future readers can verify important claims.
- If sources disagree, mention the disagreement and prefer primary/current
  sources.
