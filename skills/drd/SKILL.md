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
5. Design embedded visuals when they improve understanding.
   - Add visuals for concepts that are hard to hold in prose: multi-step
     processes, component relationships, data movement, state changes,
     timelines, trade-offs, comparisons, or decision criteria.
   - Place visuals near the section where the concept is explained, not only at
     the top of the document.
   - Prefer embedded D3.js SVG panels for high-value visuals that benefit from
     interaction, layered comparison, multiple modes, or progressive reveal.
   - Use Mermaid for simple static flowcharts when D3 would add needless weight;
     use tables/ASCII only for small comparisons or script-hostile targets.
6. Enrich the document.
   - For existing docs, add missing sections without rewriting unrelated
     existing content.
   - Match existing Markdown style, tables, headings, and diagram style when
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

For posts in `m1ser4ble.github.io`, use the repository's Jekyll post format:

```yaml
---
layout: single
title: "<Korean title>"
date: YYYY-MM-DD HH:MM:SS +0900
categories: <category>
excerpt: "<one-sentence summary>"
toc: true
toc_sticky: true
tags: [tag1, tag2]
source: "<source context>"
---
```

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

## Visualization Rules

When writing or enriching technical posts, treat visualization as part of the
explanation, not decoration.

| Use | Preferred Form |
|-----|----------------|
| Multi-step process, component relationship, data movement, state change, timeline, trade-off, comparison, or decision tree | Embedded D3.js SVG panel |
| Simple static sequence or dependency graph | Mermaid |
| Small taxonomy or comparison | Markdown table |
| CLI-only / script-hostile target | ASCII diagram |

### D3.js Embedding Contract

Use D3 when the concept benefits from interaction or multiple views. Keep the
visual self-contained inside the post:

```html
<div id="<unique-id>" class="drd-d3-panel">
  <svg viewBox="0 0 980 560" role="img" aria-label="..."></svg>
</div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script>
(function () {
  const root = document.querySelector('#<unique-id>');
  if (!root || !window.d3) return;
  // Render with D3 into the local SVG only.
})();
</script>
```

Requirements:

- For substantial DRD blog posts, include at least one D3 panel unless the target
  platform forbids inline HTML/JavaScript or the subject has no useful
  multi-step, comparison, shape, timeline, or decision visual.
- Use a unique root `id` per visual and scope all selectors under that root.
- Render into inline SVG, not canvas, so the output remains crisp and selectable.
- Include at least one meaningful interaction when D3 is used: tabs, hover,
  toggles, comparison modes, or progressive reveal.
- Place visuals immediately after the section that introduces the concept, and
  verify the final post contains the expected `<script`, `<svg`, and root `id`.
- Keep text fallback around the visual; the article must still make sense if
  JavaScript is blocked.
- Avoid loading D3 multiple times in the same post. If several D3 panels are
  needed, include one CDN script before the first panel and reuse it.
- Prefer D3 only for high-value visuals. If a static Mermaid diagram explains
  the point equally well, use Mermaid.

## Style Rules

- Korean prose is required; keep English names, APIs, identifiers, and terms in
  English.
- Prefer Markdown tables for terminology, timelines, and comparisons.
- Use D3/Mermaid diagrams when they clarify multi-step processes,
  relationships, state changes, timelines, comparisons, or trade-offs.
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
