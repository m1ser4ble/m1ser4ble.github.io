---
layout: single
title: "Manifest Android Interview 5편: Compose UI와 Testing 독해와 답변 지도"
date: 2026-06-09 09:05:00 +0900
categories: android
excerpt: "Compose UI 파트를 Modifier, Layout, Lazy list, drawing, image, animation, navigation, preview, testing, semantics 모델로 읽고 Q26~Q41 답변 골격을 정리한다."
toc: true
toc_sticky: true
tags: [android, interview, compose, ui, testing, accessibility, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.382~459, `Category 2: Compose UI`의 독해와 답변 지도다.
- 4편이 Compose Runtime의 "왜 다시 실행되는가"를 다뤘다면, 5편은 그 runtime 위에서 "실제 화면을 어떻게 구성, 측정, 그리고 검증하는가"를 다룬다.
- 원문 Q26~Q41은 모두 답변 capsule로 다룬다.
- Compose UI 답변 공식은 `Modifier order -> layout constraints -> drawing/image/animation -> navigation/tooling -> semantics/testing/accessibility`다.

## 이 글이 답하려는 질문

> Compose Runtime을 이해한 뒤, 실제 제품 UI를 만들 때 Modifier, layout, lazy list, drawing, navigation, test, accessibility를 어떻게 하나의 시스템으로 설명할 수 있는가?

Compose UI 질문은 API가 많아서 산만해지기 쉽다. 하지만 이 파트도 하나의 흐름으로 읽을 수 있다.

- Modifier는 composable에 behavior와 decoration을 순서대로 덧붙이는 chain이다.
- Layout은 child를 measure하고 place하는 constraint 기반 protocol이다.
- Lazy list는 필요한 item만 composition/layout해서 jank를 줄인다.
- Painter/Canvas/graphicsLayer/animation은 그리기와 visual effect를 담당한다.
- Navigation/Preview는 화면 구조와 개발 workflow를 돕는다.
- Testing과 accessibility는 semantics tree를 공통 기반으로 삼는다.

## 읽기 전에 알아야 할 것

Compose에서 UI element는 View object처럼 직접 mutable property를 바꾸는 대상이 아니다. Composable은 UI description을 만들고, Modifier는 그 description에 layout, drawing, input, semantics 같은 behavior를 순서대로 적용한다. 이 순서가 중요하다. `padding().clickable()`과 `clickable().padding()`은 hit area와 visual spacing이 달라질 수 있다.

<div class="mermaid">
flowchart TD
    Composable["Composable<br/>Text, Box, LazyColumn"]
    Modifier["Modifier chain<br/>layout, input, draw, semantics"]
    Layout["Layout system<br/>measure and place"]
    Draw["Drawing<br/>Painter, Canvas, graphicsLayer"]
    Semantics["Semantics tree<br/>testing and accessibility"]
    Runtime["Compose runtime<br/>composition, recomposition"]

    Runtime --> Composable
    Composable --> Modifier
    Modifier --> Layout
    Modifier --> Draw
    Modifier --> Semantics
</div>

## 용어 사전

| 용어 | 먼저 기억할 의미 | 답변할 때 붙일 관점 |
|------|------------------|----------------------|
| Modifier | Composable에 behavior/appearance/layout metadata를 덧붙이는 immutable chain | order, reuse, scope |
| Layout | child composable을 measure하고 place하는 low-level API | constraints, MeasurePolicy |
| Box | child를 같은 parent 안에 겹쳐 배치하는 layout | alignment, z-order |
| Arrangement | Row/Column main axis의 child 간 배치 규칙 | spacing, distribution |
| Alignment | cross axis 또는 Box 내부 위치 정렬 | align, content alignment |
| Painter | image/vector/custom drawing을 그리는 abstraction | Image, rememberAsyncImagePainter |
| LazyColumn | 보이는 item 중심으로 composition/layout하는 list | key, contentType, paging |
| Canvas | Compose에서 custom drawing을 수행하는 composable | DrawScope, path, text, bitmap |
| graphicsLayer | composable에 transform, alpha, clipping, compositing layer를 적용하는 Modifier | hardware layer, animation |
| Navigation | Compose 화면 간 destination/back stack 관리 | NavHost, NavController |
| Preview | Android Studio에서 composable을 미리 rendering하는 tooling | parameter/provider/theme |
| Semantics | UI 의미 정보를 testing/accessibility에 노출하는 tree | contentDescription, role, testTag |

## 등장 배경과 이유

Compose Runtime만 알아서는 제품 UI를 만들 수 없다. 실제 화면은 padding/click/clip/background 순서, parent constraint, image decoding, lazy list key, animation layer, navigation back stack, test selector, accessibility label 같은 구체적 결정을 필요로 한다. 5편은 이 결정을 하나의 UI 제작 layer로 묶는다.

## 역사적 기원

전통 View UI에서는 XML attribute, ViewGroup layout params, custom Drawable, RecyclerView adapter, Espresso test, contentDescription이 각각 다른 API로 흩어져 있었다. Compose는 이 많은 결정을 Kotlin API와 Modifier, Layout, Semantics tree로 다시 조직한다. 그래서 API 이름은 바뀌었지만 근본 문제는 같다. 무엇을 어디에 배치하고, 어떻게 그리고, 어떻게 찾고, 누가 사용할 수 있게 할 것인가?

| View 시대 문제 | Compose의 대응 | 이 글의 질문 |
|----------------|----------------|--------------|
| XML attribute와 View property 분산 | Modifier chain | Q26 |
| ViewGroup custom measuring | Layout composable | Q27~Q29 |
| ImageView/Drawable/Canvas | Painter, Image, Canvas | Q30~Q35 |
| RecyclerView/Paging | Lazy list, paging integration | Q32, Q33 |
| Fragment navigation | Navigation Compose | Q37 |
| Espresso/accessibility node | Semantics tree | Q39~Q41 |

## 학술적/이론적 배경

- Decorator pattern: Modifier는 UI element에 behavior를 누적 적용하는 chain처럼 동작한다.
- Constraint-based layout: parent constraints 안에서 child를 measure하고 place한다.
- Virtualized list: Lazy list는 전체 item을 한 번에 만들지 않고 viewport 주변만 처리한다.
- Retained graphics layer: graphicsLayer는 transform/compositing을 별도 layer로 처리할 수 있다.
- Semantic tree: UI의 의미 정보를 rendering tree와 별개로 노출해 test와 accessibility를 가능하게 한다.
- Golden/screenshot testing: visual output을 baseline과 비교해 regression을 잡는다.

## 연대표

| 시기 | 변화 | 독해 포인트 |
|------|------|-------------|
| Compose UI 초기 | Modifier, Row/Column/Box, Image, Text 중심 | UI 구성 primitive 이해 |
| Lazy layout 확산 | LazyColumn/LazyRow/grid 사용 증가 | key, paging, jank 대응 |
| Navigation Compose | Compose-native navigation graph | screen destination과 back stack |
| Preview tooling 발전 | design/dev feedback loop 단축 | PreviewParameter/theme/device |
| Compose testing 안정화 | semantics 기반 test API | testability와 accessibility 연결 |
| screenshot testing 관심 증가 | visual regression 자동화 | deterministic rendering과 baseline 관리 |

## 동작 메커니즘

### 1. Modifier는 순서가 있는 UI 변환 chain이다

Modifier는 immutable chain이다. 각 modifier element가 layout, draw, pointer input, semantics 등을 추가한다. 순서가 달라지면 결과도 달라진다. 예를 들어 clickable이 padding 앞에 있느냐 뒤에 있느냐에 따라 클릭 가능한 영역이 달라진다.

<div class="mermaid">
flowchart LR
    Base["Text"]
    Padding["padding"]
    Background["background"]
    Click["clickable"]
    Semantics["semantics"]
    Result["final node<br/>layout, draw, input, semantics"]

    Base --> Padding
    Padding --> Background
    Background --> Click
    Click --> Semantics
    Semantics --> Result
</div>

### 2. Layout은 constraints를 받고 child를 measure/place한다

Compose Layout은 parent가 child에게 constraints를 전달하고, child를 measure한 뒤 place한다. `Box`, `Row`, `Column`, custom `Layout`은 모두 이 원리를 따른다. Arrangement와 Alignment는 child의 남는 공간과 축 방향 위치를 어떻게 처리할지 정한다.

### 3. Lazy list는 composition과 layout을 필요한 만큼만 한다

LazyColumn은 전체 item을 모두 composition하지 않는다. viewport 주변 item만 만들고, key와 contentType으로 item identity와 reuse를 돕는다. paging과 결합하면 data도 필요한 page만 가져올 수 있다.

<div class="mermaid">
flowchart TD
    Data["large dataset"]
    Paging["PagingData<br/>optional"]
    Lazy["LazyColumn"]
    Visible["visible items"]
    Key["stable key<br/>contentType"]
    Compose["compose and measure"]
    Reuse["reuse slot/layout info"]

    Data --> Paging
    Paging --> Lazy
    Data --> Lazy
    Lazy --> Visible
    Visible --> Key
    Key --> Compose
    Key --> Reuse
</div>

### 4. Semantics는 test와 accessibility의 공통 기반이다

Compose test는 rendering pixel보다 semantics tree를 주로 탐색한다. TalkBack 같은 accessibility service도 semantics 정보를 사용한다. 따라서 contentDescription, role, stateDescription, testTag, merged semantics는 테스트 안정성과 접근성 품질을 동시에 좌우한다.

## 책의 전체 구조

5편은 4편의 runtime 지식을 실제 UI 제작으로 확장한다. `Modifier`와 `Layout`은 composition 결과를 어떻게 배치하고 꾸밀지 정하고, `Lazy`와 `Painter`는 대량 content와 image를 효율적으로 다루며, `Navigation`, `Preview`, `Testing`, `Accessibility`는 제품 개발 workflow와 품질 보증으로 이어진다.

## 장별 독해 가이드

| 독해 묶음 | 원문 질문 | 읽는 목적 |
|-----------|-----------|-----------|
| Modifier와 layout | Q26~Q29 | Modifier order, custom layout, Box, arrangement/alignment 이해 |
| Drawing과 media | Q30~Q36 | Painter, network image, lazy list, Canvas, graphicsLayer, animation 이해 |
| Navigation과 tooling | Q37~Q38 | Compose navigation과 preview workflow 이해 |
| Testing과 accessibility | Q39~Q41 | semantics 기반 test, screenshot test, 접근성 이해 |

## 질문별 답변 지도

### A. Modifier와 layout

#### Q26. Modifier란 무엇인가? (p.383)

- 한 줄 답: Modifier는 composable에 layout, drawing, input, semantics 같은 behavior와 appearance를 순서대로 추가하는 immutable chain이다.
- 핵심 근거: padding, background, clickable, size, clip, semantics 같은 modifier는 적용 순서에 따라 측정, hit area, drawing 결과가 달라진다.
- 실무 포인트: Modifier는 caller가 넘길 수 있게 parameter로 열어두고, 내부 modifier와 결합할 때 순서를 의도적으로 설계한다.
- 주의점: Modifier를 단순 style bag으로 보면 order bug를 놓친다.

#### Q27. Layout이란 무엇인가? (p.398)

- 한 줄 답: Compose `Layout`은 child composable을 직접 measure하고 place할 수 있는 low-level layout API다.
- 핵심 근거: parent constraints를 받아 child measurable을 측정하고, layout width/height를 정한 뒤 placeable을 배치한다.
- 실무 포인트: 기본 Row/Column/Box로 표현하기 어려운 custom measuring/placement가 필요할 때 사용한다.
- 주의점: 같은 child를 여러 번 measure하는 것은 제한되거나 비용이 크다. intrinsic measurement와 constraint를 이해해야 한다.

#### Q28. Box란 무엇인가? (p.403)

- 한 줄 답: Box는 child composable을 같은 parent 영역 안에 겹쳐 배치할 수 있는 기본 layout이다.
- 핵심 근거: child는 BoxScope의 alignment modifier나 Box의 contentAlignment에 따라 배치되고, 나중에 선언된 child가 위에 그려질 수 있다.
- 실무 포인트: overlay, badge, loading layer, background/content 조합에 자주 쓴다.
- 주의점: 복잡한 stack UI에서 click/semantics order도 함께 고려해야 한다.

#### Q29. Arrangement와 Alignment의 차이는 무엇인가? (p.407)

- 한 줄 답: Arrangement는 Row/Column의 main axis에서 child들 사이 공간을 배치하고, Alignment는 cross axis나 Box 내부에서 개별 content 위치를 정한다.
- 핵심 근거: Column의 verticalArrangement, Row의 horizontalArrangement는 main axis spacing/distribution이고, horizontalAlignment/verticalAlignment는 반대 축 정렬이다.
- 실무 포인트: "아이템 사이 간격"은 Arrangement, "부모 안에서 어느 쪽에 붙일지"는 Alignment로 설명한다.
- 주의점: axis 방향이 Row와 Column에서 바뀌므로 main/cross axis 기준으로 말하는 편이 안전하다.

### B. Drawing, image, lazy UI, animation

#### Q30. Painter란 무엇인가? (p.410)

- 한 줄 답: Painter는 Compose에서 image/vector/custom drawing content를 그리는 abstraction이다.
- 핵심 근거: Image composable은 Painter를 받아 그리며, painterResource, rememberAsyncImagePainter 같은 API가 다양한 image source를 Painter로 제공한다.
- 실무 포인트: static resource, vector, network image, custom painter를 같은 Image pipeline으로 설명할 수 있다.
- 주의점: Painter가 image loading 전체 lifecycle/cache 문제를 자동 해결하는 것은 아니다. library 선택과 state 처리가 필요하다.

#### Q31. network image는 어떻게 load하는가? (p.412)

- 한 줄 답: Compose에서는 Coil의 AsyncImage/rememberAsyncImagePainter 같은 image loading library를 사용해 network fetch, decode, cache, placeholder/error state를 처리하는 것이 일반적이다.
- 핵심 근거: network image는 HTTP, bitmap decode, memory/disk cache, lifecycle cancellation이 결합된 문제다.
- 실무 포인트: size, contentScale, placeholder, error UI, crossfade, list scroll cancellation을 함께 설계한다.
- 주의점: Composable 안에서 직접 network fetch/bitmap decode를 수행하면 recomposition과 lifecycle 문제가 생긴다.

#### Q32. 수백 개 item list를 jank 없이 rendering하려면 어떻게 하는가? (p.415)

- 한 줄 답: LazyColumn/LazyRow/LazyVerticalGrid를 사용하고 stable key, contentType, item state 분리, image loading 최적화, Paging 연계를 적용한다.
- 핵심 근거: Lazy layout은 viewport 주변 item만 composition/layout하고, key는 item identity를 안정화해 state와 reuse를 돕는다.
- 실무 포인트: heavy item composable을 분리하고, derived state/remember를 적절히 사용하며, release mode에서 scroll benchmark를 측정한다.
- 주의점: Lazy list 안에서 unstable lambda/model과 large image decode를 방치하면 jank가 난다.

#### Q33. Lazy list pagination은 어떻게 구현하는가? (p.418)

- 한 줄 답: Jetpack Paging을 LazyColumn과 연결하거나, LazyListState를 관찰해 끝에 가까워질 때 다음 page를 요청한다.
- 핵심 근거: Paging Compose는 LazyPagingItems로 load state, retry, item access를 제공한다. 직접 구현할 때는 scroll threshold와 중복 요청 방지가 필요하다.
- 실무 포인트: loading footer, error retry, empty state, refresh, cached data 전략을 함께 설계한다.
- 주의점: recomposition마다 next page 요청을 발생시키면 중복 load가 생긴다. state/effect key를 정확히 둔다.

#### Q34. Canvas란 무엇인가? (p.421)

- 한 줄 답: Compose Canvas는 DrawScope 안에서 shape, path, text, image 등을 직접 그릴 수 있는 composable이다.
- 핵심 근거: View Canvas와 유사한 custom drawing 개념을 Compose API로 제공하며, drawBehind/drawWithContent 같은 Modifier drawing API와도 연결된다.
- 실무 포인트: chart, progress, custom indicator, decorative background처럼 layout보다 drawing이 핵심인 UI에 쓴다.
- 주의점: Canvas에서 복잡한 계산이나 allocation을 매 draw마다 수행하면 frame drop이 생긴다.

#### Q35. graphicsLayer Modifier를 사용해본 적이 있는가? (p.424)

- 한 줄 답: graphicsLayer는 composable에 translation, scale, rotation, alpha, clipping, shadow, compositing 같은 layer-level transform을 적용하는 Modifier다.
- 핵심 근거: 특정 composable subtree를 graphics layer로 다뤄 transform과 alpha animation을 효율적으로 처리할 수 있다.
- 실무 포인트: parallax, card flip, fade/scale, clipping, custom compositing effect에 사용한다.
- 주의점: layer를 남용하면 memory와 rendering cost가 증가할 수 있고, alpha/clip은 hit testing과 semantics 기대와 다를 수 있다.

#### Q36. Compose에서 visual animation은 어떻게 구현하는가? (p.434)

- 한 줄 답: Compose animation은 animate*AsState, updateTransition, AnimatedVisibility, AnimatedContent, Animatable, infiniteTransition 등으로 state 변화에 따른 값을 animate한다.
- 핵심 근거: Compose는 animation도 state-driven으로 표현한다. target state가 바뀌면 animation value가 frame마다 갱신되고 UI가 반응한다.
- 실무 포인트: 단순 property는 animate*AsState, 여러 property는 Transition, gesture/imperative control은 Animatable, enter/exit는 AnimatedVisibility로 구분한다.
- 주의점: animation state와 business state를 섞으면 test와 재사용이 어려워진다.

### C. Navigation과 tooling

#### Q37. 화면 간 navigation은 어떻게 처리하는가? (p.434)

- 한 줄 답: Compose Navigation은 NavHost, NavController, composable destination, route/argument를 사용해 화면 전환과 back stack을 관리한다.
- 핵심 근거: NavHost가 graph를 소유하고, NavController가 navigate/popBackStack을 수행하며, argument와 deep link를 route에 연결한다.
- 실무 포인트: screen route를 type-safe하게 관리하고, ViewModel scope와 saved state handle, nested graph, bottom navigation back stack을 함께 설계한다.
- 주의점: raw string route를 흩뿌리면 refactor와 argument 안정성이 떨어진다.

#### Q38. Preview는 어떻게 동작하고 어떻게 다루는가? (p.439)

- 한 줄 답: Compose Preview는 Android Studio가 composable을 design-time에 rendering해 여러 configuration을 빠르게 확인하게 하는 tooling이다.
- 핵심 근거: `@Preview` annotation, PreviewParameterProvider, theme wrapper, device/fontScale/uiMode 설정을 통해 다양한 상태를 미리 볼 수 있다.
- 실무 포인트: stateless composable과 fake data를 분리하면 Preview가 문서와 regression check 역할도 한다.
- 주의점: Preview는 실제 device runtime, navigation, DI, permission, network 환경을 완전히 대체하지 못한다.

### D. Testing과 accessibility

#### Q39. Compose UI component나 screen의 unit/UI test는 어떻게 작성하는가? (p.448)

- 한 줄 답: Compose UI test는 ComposeTestRule로 content를 set하고 semantics matcher로 node를 찾아 assert/performAction을 수행한다.
- 핵심 근거: `onNodeWithText`, `onNodeWithContentDescription`, `onNodeWithTag` 같은 API는 semantics tree를 탐색한다.
- 실무 포인트: UI state를 fake ViewModel/state로 주입하고, loading/success/error/user action을 각각 검증한다.
- 주의점: pixel 위치나 text implementation detail에 과도하게 의존하면 test가 쉽게 깨진다.

#### Q40. Screenshot testing은 무엇이고 UI consistency에 어떻게 도움이 되는가? (p.453)

- 한 줄 답: Screenshot testing은 rendered UI 이미지를 baseline과 비교해 visual regression을 잡는 테스트 방식이다.
- 핵심 근거: component의 색상, spacing, typography, layout 변화처럼 semantics assertion만으로 잡기 어려운 시각적 변화를 감지한다.
- 실무 포인트: theme, font scale, device size, locale, dark mode 같은 matrix를 정하고 deterministic data로 찍는다.
- 주의점: animation, network image, system font/rendering 차이 때문에 flaky해질 수 있어 환경 고정과 threshold 관리가 필요하다.

#### Q41. Compose에서 accessibility는 어떻게 보장하는가? (p.456)

- 한 줄 답: Compose accessibility는 semantics 정보를 올바르게 제공해 screen reader와 test가 UI 의미를 이해하게 만드는 것에서 시작한다.
- 핵심 근거: contentDescription, role, stateDescription, heading, mergeDescendants, clearAndSetSemantics, touch target, focus order가 중요하다.
- 실무 포인트: 의미 있는 image/control에는 label을 제공하고, 장식 content는 숨기며, custom component에는 role/state/action semantics를 명시한다.
- 주의점: testTag만 붙인다고 접근성이 좋아지는 것은 아니다. 사용자에게 읽힐 의미 정보를 설계해야 한다.

## 핵심 주장과 근거

5편의 핵심 주장은 "Compose UI는 Modifier와 semantics를 중심으로 실제 제품 UI를 구성하고 검증하는 층"이라는 것이다.

- Q26~Q29는 layout과 modifier order가 UI 결과를 어떻게 바꾸는지 묻는다.
- Q30~Q36은 image, lazy rendering, drawing, graphics layer, animation을 묻는다.
- Q37~Q38은 navigation과 preview라는 개발 workflow를 묻는다.
- Q39~Q41은 semantics 기반 test와 accessibility를 묻는다.

## 실무 적용 / 생각해볼 질문

| 상황 | 실무에서의 답변 방향 |
|------|----------------------|
| clickable 영역이 기대와 다르다 | Modifier 순서에서 padding/clickable/background의 적용 순서를 확인한다. |
| LazyColumn이 스크롤 중 끊긴다 | stable key, contentType, image loading, item state read, release benchmark를 확인한다. |
| Preview가 DI 때문에 안 뜬다 | composable을 stateless UI와 route/container로 나누고 fake state를 Preview에 주입한다. |
| UI test가 자주 깨진다 | semantics matcher를 안정화하고 implementation detail보다 사용자-visible behavior를 검증한다. |
| TalkBack에서 custom component가 이상하게 읽힌다 | role, stateDescription, contentDescription, merge policy를 명시한다. |

## 오해하기 쉬운 부분

- Modifier는 CSS style처럼 순서와 무관한 속성 bag이 아니다.
- Layout은 단순히 child를 감싸는 container가 아니라 constraints를 해석하고 child를 measure/place하는 protocol이다.
- LazyColumn은 모든 item을 미리 만드는 Column이 아니다.
- Painter는 network image loading 전체 전략이 아니다. cache/lifecycle/error state는 별도 고려가 필요하다.
- graphicsLayer는 무조건 성능을 좋게 하지 않는다. layer 비용이 있다.
- Preview는 실제 앱 실행과 같지 않다. tooling feedback loop로 봐야 한다.
- Semantics는 testing만을 위한 것이 아니다. accessibility와 같은 기반을 공유한다.

## 한 장 요약

5편을 한 문장으로 줄이면 이렇다.

> Compose UI는 Modifier chain과 layout constraints로 화면 구조를 만들고, Lazy/drawing/image/animation으로 rendering을 최적화하며, Navigation/Preview/Semantics/Test로 제품 UI의 흐름과 품질을 검증한다.

암기 순서는 다음이 좋다.

1. Modifier를 말한다: order, layout/draw/input/semantics.
2. Layout을 말한다: constraints, measure, place, Box, Arrangement, Alignment.
3. Lazy를 말한다: key, contentType, paging, jank 방지.
4. Drawing을 말한다: Painter, network image, Canvas, graphicsLayer, animation.
5. Navigation과 Preview를 말한다: route/back stack, design-time rendering.
6. Testing과 accessibility를 말한다: semantics tree, UI test, screenshot test, contentDescription/role/state.

## 참고자료

- 원문: Jaewoong Eum, `Manifest Android Interview: The Ultimate Guide`, Compose UI, p.382~459.
- Android Developers, Modifiers.
- Android Developers, Custom layouts.
- Android Developers, Lists and grids.
- Android Developers, Graphics in Compose.
- Android Developers, Navigation Compose.
- Android Developers, Testing in Compose.
- Android Developers, Accessibility in Compose.
