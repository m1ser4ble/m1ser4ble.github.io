---
layout: single
title: "Manifest Android Interview 5편: Compose UI와 Testing 독해 가이드"
date: 2026-06-09 09:05:00 +0900
categories: android
excerpt: "Compose UI 파트는 Modifier, layout, lazy components, drawing, animation, navigation, preview, test, semantics를 통해 Compose 화면을 실제 제품 UI로 만드는 방법을 다룬다."
toc: true
toc_sticky: true
tags: [android, interview, jetpack-compose, compose-ui, modifier, testing, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.382~459, `Category 2: Compose UI` 구간의 독해 가이드다.
- 핵심 질문은 "Compose Runtime 위에서 실제 UI 구조, layout, input, drawing, testing을 어떻게 구성하는가?"다.
- `Modifier`는 이 파트의 중심이다. Modifier 순서, scope, 재사용, custom modifier, semantics를 이해하면 Compose UI 질문의 절반이 풀린다.

## 이 글이 답하려는 질문

> Compose UI에서 눈에 보이는 component API 뒤에는 어떤 layout/drawing/input/semantics pipeline이 있는가?

## 읽기 전에 알아야 할 것

앞 글의 Runtime 개념을 알고 있어야 한다. Compose UI는 단순 component 목록이 아니라 Runtime이 계산한 composition을 실제 화면과 test tree로 연결하는 계층이다.

## 용어 사전

| 용어 | 의미 | 읽을 때의 포인트 |
|------|------|------------------|
| Modifier | layout/drawing/input/semantics를 연결하는 chain | 순서가 의미다 |
| Scoped Modifier | 특정 parent scope에서만 의미 있는 modifier | `weight`, `matchParentSize` 등 |
| Layout | child를 measure하고 place하는 custom layout API | measure와 placement 분리 |
| Box/Row/Column | Compose 기본 layout primitive | constraint와 alignment 관점 |
| LazyColumn/LazyRow | 필요한 item만 compose/layout하는 list API | key, state, pagination |
| Canvas | custom drawing API | View Canvas와 mental model 비교 |
| graphicsLayer | transform, alpha, clipping, offscreen rendering | 시각 효과와 비용 |
| AnimatedVisibility/Crossfade | state-driven animation | state transition으로 읽기 |
| Navigation | composable destination과 back stack | View navigation과 개념 연결 |
| Preview | design-time rendering | sample state와 variant 점검 |
| Semantics | accessibility/test tree에 노출되는 의미 정보 | UI test와 접근성의 공통 기반 |

## 등장 배경과 이유

Compose Runtime이 state와 recomposition을 해결해도, 실제 UI를 만들려면 배치, 입력, 이미지, list, drawing, animation, testing, accessibility가 필요하다. Compose UI 파트는 이 실무 표면을 다룬다.

기존 View 시스템에서는 XML 속성, View subclass, RecyclerView adapter, Espresso 등이 흩어져 있었다. Compose에서는 많은 것이 composable과 Modifier chain, semantics tree로 모인다.

## 역사적 기원

Compose UI는 Android의 View tree 모델을 완전히 삭제하지 않고, declarative UI 위에 새로운 layout/drawing/input API를 얹었다. `AndroidView` interop도 가능하지만, Compose-native UI는 Modifier와 composable layout primitive를 중심으로 설계된다.

## 학술적/이론적 배경

| 배경 | Compose UI에서의 표현 |
|------|-----------------------|
| Decorator / chain of responsibility | Modifier chain |
| Constraint-based layout | parent constraints -> child measure |
| Virtualized list | LazyColumn/LazyRow |
| Retained semantic tree | Semantics for accessibility/testing |
| State transition | animation APIs |
| Golden/snapshot testing | Paparazzi, screenshot testing |

## 연대표

| 흐름 | 의미 |
|------|------|
| View XML UI | 속성과 class 기반 UI |
| Compose UI primitives | Box/Row/Column/Text/Image 등 |
| Compose Material/Foundation/UI 분리 | component, foundation, low-level UI 책임 분리 |
| Compose testing/preview | design/test feedback loop 강화 |
| Semantics/accessibility | test와 접근성의 공통 표현 강화 |

## 동작 메커니즘

### Modifier order

원문 p.384~p.385의 Modifier 순서 예제를 재구성하면 다음과 같다.

<div class="mermaid">
flowchart TD
    A[clickable first]
    B[padding second]
    C[click target includes padding]

    D[padding first]
    E[clickable second]
    F[click target is inner content]

    A --> B --> C
    D --> E --> F
</div>

Modifier는 나열된 속성 집합이 아니라 앞에서 뒤로 감싸지는 chain이다. 그래서 `clickable().padding()`과 `padding().clickable()`은 hit target이 다르다.

### Layout measure/place

원문 p.399 custom layout 예제는 Compose layout의 핵심을 보여준다.

<div class="mermaid">
flowchart LR
    Parent[Parent constraints]
    Measure[Measure children]
    Size[Choose layout size]
    Place[Place children]
    Result[Final layout]

    Parent --> Measure --> Size --> Place --> Result
</div>

Custom layout 답변은 "child를 constraints로 measure하고, parent size를 결정하고, place block에서 위치를 배치한다"는 흐름이면 충분히 탄탄하다.

### Semantics와 test

원문 후반부의 preview/test/accessibility 예제들은 semantics로 연결된다.

<div class="mermaid">
flowchart TD
    Composable[Composable UI]
    Semantics[Semantics tree]
    Accessibility[Accessibility service]
    Test[Compose UI test]
    User[User-visible meaning]

    Composable --> Semantics
    Semantics --> Accessibility
    Semantics --> Test
    Semantics --> User
</div>

`contentDescription`, merged semantics, custom semantics action은 접근성만이 아니라 테스트 가능성에도 영향을 준다.

## 책의 전체 구조에서 이 파트의 위치

이 파트는 시리즈의 마지막 실무 표면이다. 앞 글이 Runtime과 state를 설명했다면, 이 글은 그 state를 실제 UI, interaction, animation, test로 드러내는 방법을 다룬다.

## 장별 독해 가이드

- Modifier: 순서, scope, 재사용, custom modifier를 가장 먼저 잡는다.
- Layout: Box/Row/Column과 custom Layout의 measure/place 모델.
- Image/Lazy list: rendering cost와 list state를 함께 본다.
- Canvas/graphicsLayer: drawing과 transform 비용.
- Animation: state transition으로 해석한다.
- Navigation: screen graph와 back stack.
- Preview: variant와 sample state 설계.
- Testing/Semantics/Accessibility: test tree와 사용자 의미를 같이 본다.

## 핵심 주장과 근거

> Compose UI의 실무 능력은 component 이름을 많이 아는 것이 아니라, Modifier와 layout/semantics pipeline을 예측하는 능력이다.

원문이 Modifier order, scoped modifier, custom layout, lazy list, test, semantics를 반복해서 다루는 이유가 여기에 있다.

## 실무 적용 / 생각해볼 질문

- click target을 넓히려면 `clickable`과 `padding` 순서를 어떻게 둬야 하는가?
- `LazyColumn` item에 key를 왜 넣는가?
- `graphicsLayer`는 편하지만 어떤 rendering cost를 만들 수 있는가?
- Preview를 실무에서 단순 확인용이 아니라 state matrix로 쓰려면 어떻게 구성할 것인가?
- Compose UI test가 text matcher보다 semantics matcher를 써야 하는 경우는 언제인가?

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| Modifier 순서는 보기 좋게만 정하면 된다 | 순서가 layout, input, drawing, semantics를 바꾼다 |
| LazyColumn은 RecyclerView의 Compose 버전일 뿐이다 | composition/lazy layout/key/state 모델을 같이 이해해야 한다 |
| Preview는 디자이너용 미리보기다 | edge case state를 빠르게 확인하는 개발 도구다 |
| UI test는 화면 text만 찾으면 된다 | semantics tree가 접근성과 테스트의 공통 기반이다 |
| Custom layout은 거의 쓸 일이 없다 | 몰라도 되는 API가 아니라 layout 원리를 설명하는 핵심 모델이다 |

## 한 장 요약

```text
Compose UI = Runtime이 만든 UI를 실제 화면과 의미 트리로 내보내는 계층

Modifier:
  order matters
  scope matters
  semantics matters

Layout:
  constraints -> measure -> size -> place

Testing:
  composable -> semantics tree -> accessibility/test
```

## 참고자료

- 원문: *Manifest Android Interview*, Compose UI, p.382~459.
- Android Developers, Modifiers: <https://developer.android.com/develop/ui/compose/modifiers>
- Android Developers, Layouts in Compose: <https://developer.android.com/develop/ui/compose/layouts>
- Android Developers, Lists and grids: <https://developer.android.com/develop/ui/compose/lists>
- Android Developers, Testing in Compose: <https://developer.android.com/develop/ui/compose/testing>
- Android Developers, Accessibility in Compose: <https://developer.android.com/develop/ui/compose/accessibility>
