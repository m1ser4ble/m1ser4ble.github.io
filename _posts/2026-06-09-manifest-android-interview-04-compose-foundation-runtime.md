---
layout: single
title: "Manifest Android Interview 4편: Compose Foundation과 Runtime 독해와 답변 지도"
date: 2026-06-09 09:04:00 +0900
categories: android
excerpt: "Jetpack Compose Foundation과 Runtime을 composition, phases, recomposition, stability, state, side effect, snapshot 모델로 읽고 Q0~Q25 답변 골격을 정리한다."
toc: true
toc_sticky: true
tags: [android, interview, compose, runtime, state, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.274~381, `Jetpack Compose Interview Questions`의 `Compose Fundamentals`와 `Compose Runtime` 범위를 다룬다.
- 핵심 질문은 "Composable 함수가 어떻게 UI tree를 만들고, state 변화에 반응하며, runtime은 무엇을 기억하고 무엇을 다시 실행하는가?"다.
- 원문 Q0~Q25를 모두 답변 capsule로 다룬다. Practical question은 state/effect/snapshot 설명 안에 흡수했다.
- Compose Runtime 답변 공식은 `declarative UI -> composition -> state read tracking -> recomposition -> stability/skipping -> effect lifecycle`이다.

## 이 글이 답하려는 질문

> Compose를 "XML 대신 Kotlin으로 UI 쓰는 방식"이 아니라 runtime이 state-driven UI를 유지하는 시스템으로 설명하려면 무엇을 알아야 하는가?

Compose 면접에서 가장 흔한 실패는 API 이름을 나열하고 runtime 사고를 놓치는 것이다. `remember`, `LaunchedEffect`, `derivedStateOf`, `snapshotFlow`, `CompositionLocal`은 모두 독립 암기 항목처럼 보이지만 실제로는 같은 질문에 답한다.

- UI는 state의 함수로 선언된다.
- Composition은 composable 호출 결과를 tree로 유지한다.
- Runtime은 어느 composable이 어떤 state를 읽었는지 추적한다.
- State가 바뀌면 관련 scope가 recomposition된다.
- Compiler/runtime은 안정적인 parameter와 skip 가능성을 이용해 재실행을 줄인다.
- Side effect API는 composition 바깥 작업을 composition lifecycle에 맞춰 실행/취소한다.

## 읽기 전에 알아야 할 것

Compose는 View system처럼 View object를 직접 찾아 바꾸는 retained View 조작 모델이 아니다. 개발자는 "현재 state가 이렇다면 UI는 이렇게 생겨야 한다"를 composable 함수로 선언한다. Runtime은 이 선언을 composition에 기록하고, state 변화가 생기면 필요한 부분을 다시 실행한다.

<div class="mermaid">
flowchart TD
    State["state<br/>mutableState, Flow, ViewModel"]
    Composable["composable functions"]
    Compiler["Compose compiler<br/>restart and skip metadata"]
    Runtime["Compose runtime<br/>slot table, recomposer"]
    Tree["composition tree"]
    Phases["UI phases<br/>composition, layout, draw"]
    Effect["side effects<br/>LaunchedEffect, DisposableEffect"]

    State --> Composable
    Composable --> Compiler
    Compiler --> Runtime
    Runtime --> Tree
    Tree --> Phases
    Runtime --> Effect
    State --> Runtime
</div>

## 용어 사전

| 용어 | 먼저 기억할 의미 | 답변할 때 붙일 관점 |
|------|------------------|----------------------|
| Composable | UI 일부를 선언하는 함수 | state read, recomposition scope |
| Composition | composable 실행 결과로 유지되는 UI tree | slot table, remember, lifecycle |
| Recomposition | state 변화에 따라 필요한 composable을 다시 실행하는 과정 | invalidation, skipping, stability |
| Stability | parameter가 바뀌지 않았다고 안전하게 판단할 수 있는 성질 | skip 가능성, performance |
| State | UI가 관찰하는 값 holder | mutableStateOf, StateFlow, LiveData |
| remember | composition 안에 값을 저장해 recomposition 사이에 유지 | key, composition lifetime |
| rememberSaveable | Bundle 저장 가능한 state를 config/process recreation에 복원 | Saver, saved state |
| State hoisting | state를 caller 쪽으로 올려 stateless composable을 만드는 pattern | single source of truth |
| Side effect | composition 밖 세계와 상호작용하는 작업 | LaunchedEffect, DisposableEffect |
| Snapshot | Compose state read/write를 추적하고 일관성을 관리하는 system | mutable snapshot, snapshotFlow |
| CompositionLocal | parameter로 넘기지 않고 composition tree 아래로 값을 제공 | theme, ambient dependency |

## 등장 배경과 이유

View system은 View object를 생성하고 reference를 잡아 변경한다. 이 방식은 명령형 UI 업데이트가 누락되거나, lifecycle이 꼬이거나, nested hierarchy가 복잡해지는 문제가 있었다. Compose는 UI를 state의 함수로 선언하고 runtime이 필요한 재실행을 관리하게 해 이 문제를 줄인다.

하지만 선언형 UI는 runtime이 더 많은 책임을 진다는 뜻이기도 하다. Runtime은 composable 호출 구조, state read, parameter stability, effect lifecycle, snapshot consistency를 관리해야 한다. 그래서 Compose 질문은 "어떤 API를 쓰는가"보다 "runtime이 왜 그 API를 필요로 하는가"로 읽어야 한다.

## 역사적 기원

Compose는 React/SwiftUI/Flutter 등 선언형 UI 흐름과 Kotlin compiler plugin 기반 최적화가 만난 결과다. Android View와 달리 UI object를 직접 mutate하기보다 state 변경을 통해 UI를 다시 설명한다. Android에서는 기존 Activity/ViewModel/lifecycle 위에 Compose runtime이 얹히기 때문에, 1~3편의 lifecycle/state/data boundary가 그대로 중요하다.

| 흐름 | 해결한 문제 | 이 글의 질문 |
|------|-------------|--------------|
| Declarative UI | 명령형 UI update 누락과 복잡성 | Q2 |
| Compose compiler/runtime | composable 재실행과 skip 최적화 | Q3~Q6 |
| State APIs | state-driven UI 표현 | Q11~Q14 |
| Effect APIs | composition 밖 작업의 lifecycle 관리 | Q15~Q18 |
| Snapshot system | state read/write consistency와 observation | Q22~Q24 |
| CompositionLocal | deep tree parameter passing 완화 | Q25 |

## 학술적/이론적 배경

- Functional UI: UI를 state의 함수로 본다.
- Incremental computation: 전체 UI를 매번 다시 만들지 않고 invalidated scope만 계산한다.
- Memoization: `remember`는 composition 위치에 값을 저장한다.
- Effect system: 순수 UI 선언과 외부 side effect를 분리한다.
- Snapshot isolation: state read/write를 추적하고 일관된 변경 적용을 관리한다.
- Compiler-assisted optimization: compiler가 restart/skip 정보를 runtime에 제공한다.

## 연대표

| 시기 | 변화 | 독해 포인트 |
|------|------|-------------|
| View 중심 Android | XML/View reference 기반 UI | Compose가 해결하려는 명령형 UI 문제 |
| Compose early adoption | Kotlin 기반 declarative UI 도입 | composable과 composition 구조 |
| Compose 1.x 안정화 | state, effect, lazy UI, tooling 정착 | runtime model과 performance 질문 증가 |
| Lifecycle interop 확산 | collectAsStateWithLifecycle, ViewModel 연계 | Android lifecycle과 composition lifecycle 구분 |
| Strong skipping/stability 논의 | compiler/runtime 최적화 중요 | stable type, immutable model, release profiling |

## 동작 메커니즘

### 1. Compose는 세 단계로 UI를 갱신한다

Compose는 보통 `composition -> layout -> draw` 세 단계를 거친다. Composition은 어떤 UI node가 필요한지 결정하고, layout은 크기와 위치를 계산하며, draw는 실제 픽셀을 그린다. State 변화가 항상 세 단계를 모두 다시 실행하는 것은 아니다. 어떤 state가 어느 단계에서 읽혔는지에 따라 invalidation 범위가 달라질 수 있다.

<div class="mermaid">
flowchart LR
    StateChange["state change"]
    Composition["composition<br/>what UI"]
    Layout["layout<br/>where and how big"]
    Draw["draw<br/>pixels"]
    Frame["frame output"]

    StateChange --> Composition
    Composition --> Layout
    Layout --> Draw
    Draw --> Frame
    StateChange -->|"layout state read"| Layout
    StateChange -->|"draw state read"| Draw
</div>

### 2. Recomposition은 다시 그리기가 아니라 다시 실행이다

Recomposition은 state를 읽은 composable scope를 다시 실행해 새 UI description을 만드는 과정이다. Runtime은 이전 composition과 새 실행 결과를 비교해 필요한 변경만 적용한다. 이때 parameter가 stable하고 값이 변하지 않았다고 판단되면 composable을 skip할 수 있다.

### 3. State는 위로 올리고, effect는 lifecycle에 묶는다

state hoisting은 composable 내부 state를 caller로 올려 stateless composable을 만든다. 이렇게 하면 single source of truth가 생기고 preview/test/reuse가 쉬워진다. 반대로 외부 세계와 상호작용하는 coroutine, listener, callback, Flow collection은 side effect API로 composition lifecycle에 묶어야 한다.

<div class="mermaid">
flowchart TD
    Parent["state owner"]
    Value["value"]
    Event["event callback"]
    Child["stateless composable"]
    Effect["effect API"]
    External["external world<br/>coroutine, listener, Flow"]

    Parent --> Value
    Value --> Child
    Child --> Event
    Event --> Parent
    Parent --> Effect
    Effect --> External
</div>

### 4. Snapshot system은 state 변경을 추적한다

Compose state는 snapshot system과 연결된다. Runtime은 state read를 추적하고, write가 발생하면 관련 scope를 invalidation한다. mutable collection을 그냥 `mutableStateOf(mutableListOf())`로 감싸면 list 내부 변경이 관찰되지 않을 수 있으므로 `mutableStateListOf`나 immutable copy 교체가 필요하다.

## 책의 전체 구조

4편은 Compose의 사고방식과 runtime을 다루고, 5편은 그 runtime 위에서 실제 UI를 만드는 Modifier/Layout/Lazy/Canvas/Navigation/Test를 다룬다. 따라서 4편을 먼저 이해해야 5편의 Modifier 순서, Lazy list jank, Compose UI testing이 왜 그런 방식으로 동작하는지 설명할 수 있다.

## 장별 독해 가이드

| 독해 묶음 | 원문 질문 | 읽는 목적 |
|-----------|-----------|-----------|
| Fundamentals | Q0~Q4, Q8, Q10 | Compose 구조, 선언형 UI, migration, Kotlin idiom 이해 |
| Performance | Q3, Q5~Q7, Q9 | recomposition, stability, release profiling, composition 이해 |
| State | Q11~Q14, Q21 | state API, hoisting, remember/saveable, coroutine scope, saved state 이해 |
| Effects/Snapshot | Q15~Q25 | side effect, snapshotFlow, derivedStateOf, lifecycle, snapshot, Flow collection, CompositionLocal 이해 |

## 질문별 답변 지도

### A. Compose fundamentals

#### Q0. Jetpack Compose의 구조는 무엇인가? (p.274)

- 한 줄 답: Compose는 compiler, runtime, UI/foundation/material/tooling layer가 함께 동작하는 declarative UI toolkit이다.
- 핵심 근거: compiler는 composable 호출을 runtime이 추적할 수 있게 변환하고, runtime은 composition/recomposition/state를 관리하며, UI layer는 layout/drawing/input component를 제공한다.
- 실무 포인트: Compose를 "View 없이 UI를 그리는 library"가 아니라 compiler/runtime/UI layer가 결합된 system으로 설명한다.
- 주의점: Compose를 쓰더라도 Activity, lifecycle, ViewModel, Android resource와의 연결은 계속 중요하다.

#### Q1. Compose phases는 무엇인가? (p.279)

- 한 줄 답: Compose UI 갱신은 composition, layout, draw 단계로 나뉜다.
- 핵심 근거: composition은 UI 구조를 결정하고, layout은 크기/위치를 계산하고, draw는 화면에 rendering한다.
- 실무 포인트: state를 어느 단계에서 읽는지가 recomposition/layout/draw 비용에 영향을 줄 수 있다.
- 주의점: 모든 state change가 전체 UI를 다시 그리고 배치한다고 단순화하면 안 된다.

#### Q2. 왜 Compose는 declarative UI framework인가? (p.284)

- 한 줄 답: Compose는 UI를 직접 변경 명령으로 조작하지 않고, 현재 state에 대한 UI description을 composable 함수로 선언하기 때문이다.
- 핵심 근거: state가 바뀌면 runtime이 필요한 composable을 다시 실행해 새 UI를 반영한다.
- 실무 포인트: imperative View update에서는 `textView.text = ...`를 직접 호출하지만, Compose에서는 state를 바꾸면 `Text(state)`가 다시 평가된다.
- 주의점: declarative라고 해서 side effect가 사라지는 것은 아니다. side effect는 별도 API로 격리해야 한다.

#### Q4. Composable function은 내부적으로 어떻게 동작하는가? (p.291)

- 한 줄 답: Composable function은 compiler plugin에 의해 runtime composer와 연결되는 형태로 변환되어 composition 위치, state read, restart/skip 가능성을 추적한다.
- 핵심 근거: runtime은 slot table에 composition 정보를 저장하고 recomposition 때 이전 호출 구조와 새 호출을 맞춰본다.
- 실무 포인트: composable은 일반 함수처럼 보이지만 호출 위치와 순서가 composition identity에 중요하다.
- 주의점: 조건문/loop에서 key 없이 stateful composable을 재배치하면 identity 문제가 생길 수 있다.

#### Q8. XML 기반 프로젝트를 Compose로 migration하는 전략은 무엇인가? (p.317)

- 한 줄 답: Compose migration은 화면 단위 big bang보다 View와 Compose interop을 이용한 점진적 전환이 안전하다.
- 핵심 근거: `ComposeView`로 기존 View 화면에 Compose를 넣거나, `AndroidView`로 Compose 안에 기존 View를 넣을 수 있다.
- 실무 포인트: design system, state owner, navigation boundary, test strategy를 먼저 정하고 leaf component부터 전환한다.
- 주의점: UI만 Compose로 옮기고 state/business logic이 Activity에 남아 있으면 구조 개선 효과가 작다.

#### Q10. Compose에서 자주 쓰는 Kotlin idiom은 무엇인가? (p.319)

- 한 줄 답: Compose는 trailing lambda, default parameter, named argument, extension function, scope receiver, delegated property, sealed/result state 같은 Kotlin idiom을 적극 활용한다.
- 핵심 근거: `Modifier` chain, slot API, `by remember`, DSL-style layout은 Kotlin language feature 위에 만들어졌다.
- 실무 포인트: Kotlin idiom을 이해하면 Compose API가 왜 그런 모양인지 읽기 쉬워진다.
- 주의점: 지나친 DSL 중첩과 implicit receiver 남용은 가독성을 해칠 수 있다.

### B. Recomposition과 performance

#### Q3. Recomposition은 무엇이고 언제 발생하는가? 성능과 어떤 관계가 있는가? (p.287)

- 한 줄 답: Recomposition은 composable이 읽은 state가 바뀌었을 때 해당 scope를 다시 실행해 UI description을 갱신하는 과정이다.
- 핵심 근거: runtime은 state read를 추적하고, 변경 시 invalidated scope를 scheduling한다. 불필요한 recomposition은 CPU 비용과 jank로 이어질 수 있다.
- 실무 포인트: recomposition 자체를 무조건 피하는 것이 아니라, 비싼 작업과 불안정 parameter로 인한 불필요한 recomposition을 줄인다.
- 주의점: recomposition은 draw와 같은 말이 아니다. composable 재실행과 실제 rendering 단계는 구분된다.

#### Q5. Compose stability란 무엇이고 performance와 어떤 관계가 있는가? (p.297)

- 한 줄 답: Stability는 Compose가 parameter 변화 여부를 안전하게 판단해 recomposition을 skip할 수 있는 성질이다.
- 핵심 근거: stable/immutable type은 값이 바뀌지 않았다면 composable 재실행을 건너뛸 수 있어 성능에 유리하다.
- 실무 포인트: immutable model, stable collection, 명확한 equals, state holder 분리를 통해 skip 가능성을 높인다.
- 주의점: `@Stable`/`@Immutable` annotation을 붙인다고 실제 불변성이 생기는 것은 아니다. 계약을 지켜야 한다.

#### Q6. Stability 개선으로 Compose performance를 최적화한 경험을 어떻게 설명하는가? (p.306)

- 한 줄 답: unstable parameter와 과도한 state read를 찾아 immutable model, stable wrapper, state 분리, derived state, key 적용으로 recomposition 범위를 줄였다고 설명한다.
- 핵심 근거: Compose compiler metrics, Layout Inspector recomposition count, macrobenchmark/release profiling으로 원인을 확인한다.
- 실무 포인트: "성능이 느려서 remember를 붙였다"가 아니라 측정, 원인, 조치, 결과 순서로 말한다.
- 주의점: debug build recomposition 관찰만으로 결론 내리면 안 된다.

#### Q7. Composition이란 무엇이고 어떻게 생성되는가? (p.310)

- 한 줄 답: Composition은 composable 함수 실행 결과로 만들어지고 runtime이 유지하는 UI tree/slot 정보다.
- 핵심 근거: Activity의 `setContent`, ComposeView, recomposer가 root composition을 만들고, 그 안에서 child composable 호출 구조가 기록된다.
- 실무 포인트: composition은 state와 remember 값을 보관하는 runtime context다.
- 주의점: composition에 남아 있는 값은 해당 composable이 composition에서 사라지면 정리된다.

#### Q9. 왜 Compose performance는 release mode에서 테스트해야 하는가? (p.317)

- 한 줄 답: Compose는 compiler/runtime optimization, R8, baseline profile, debug tooling overhead의 영향을 크게 받기 때문에 release 성능이 실제 사용자 성능에 가깝다.
- 핵심 근거: debug build는 inspection과 checks 때문에 recomposition/rendering 비용이 다르게 보일 수 있다.
- 실무 포인트: Macrobenchmark, Baseline Profile, release variant, realistic device로 startup/scroll/navigation을 측정한다.
- 주의점: emulator debug build에서 느리다고 production 성능 결론을 내리면 안 된다.

### C. State management

#### Q11. State란 무엇이고 어떤 API로 관리하는가? (p.323)

- 한 줄 답: Compose State는 값이 바뀌면 이를 읽은 composable을 recomposition시키는 observable value holder다.
- 핵심 근거: `mutableStateOf`, `remember`, `rememberSaveable`, `StateFlow.collectAsStateWithLifecycle`, LiveData observe adapter 등으로 UI state를 전달한다.
- 실무 포인트: screen state는 ViewModel, local UI state는 remember/rememberSaveable로 역할을 나눈다.
- 주의점: 일반 var를 바꾸는 것은 Compose가 관찰하지 못한다.

#### Q12. State hoisting의 장점은 무엇인가? (p.326)

- 한 줄 답: State hoisting은 state를 caller로 올리고 child composable은 value와 event callback만 받게 만들어 single source of truth와 재사용성을 높이는 pattern이다.
- 핵심 근거: stateless composable은 preview/test/reuse가 쉽고, state owner가 명확해진다.
- 실무 포인트: `value`와 `onValueChange` 형태는 Compose API의 대표적인 hoisting pattern이다.
- 주의점: 모든 state를 최상위로 올리면 prop drilling이 심해질 수 있다. 필요한 공통 owner까지 올린다.

#### Q13. remember와 rememberSaveable의 차이는 무엇인가? (p.331)

- 한 줄 답: `remember`는 composition 동안 값을 유지하고, `rememberSaveable`은 Bundle/Saver를 통해 configuration change나 일부 recreation 뒤에도 복원 가능한 값을 저장한다.
- 핵심 근거: remember 값은 composition에서 사라지면 잃고, rememberSaveable은 saveable type 또는 custom Saver가 필요하다.
- 실무 포인트: text field 입력 같은 작은 UI state는 rememberSaveable, business data는 ViewModel/repository에 둔다.
- 주의점: 큰 object나 non-saveable resource를 rememberSaveable에 넣으면 안 된다.

#### Q14. Composable 안에서 coroutine scope를 안전하게 만드는 방법은 무엇인가? (p.337)

- 한 줄 답: event handler에서 composition lifecycle에 묶인 coroutine이 필요하면 `rememberCoroutineScope()`를 사용한다.
- 핵심 근거: 이 scope는 composable이 composition을 떠나면 cancel되며, click/snackbar/drawer open 같은 user event 작업에 적합하다.
- 실무 포인트: 화면 data loading처럼 screen state와 관련된 작업은 ViewModel scope가 더 적절한 경우가 많다.
- 주의점: composable 본문에서 직접 coroutine을 launch하면 recomposition 때 중복 실행될 수 있다.

#### Q21. SaveableStateHolder란 무엇인가? (p.365)

- 한 줄 답: SaveableStateHolder는 navigation이나 conditional UI에서 composition subtree별 saveable state를 보존/복원하게 해주는 API다.
- 핵심 근거: destination이 composition에서 제거됐다가 돌아올 때 text input, scroll position 같은 saveable state를 key별로 유지할 수 있다.
- 실무 포인트: custom navigation이나 tab UI에서 각 screen의 rememberSaveable state를 유지할 때 유용하다.
- 주의점: saveable state만 보존한다. business data persistence를 대체하지 않는다.

### D. Effects, snapshot, CompositionLocal

#### Q15. Composable 안의 side effect는 어떻게 처리하는가? (p.342)

- 한 줄 답: Side effect는 `LaunchedEffect`, `DisposableEffect`, `SideEffect`, `rememberUpdatedState`, `produceState` 같은 effect API로 composition lifecycle에 맞춰 처리한다.
- 핵심 근거: composable은 재실행될 수 있으므로 외부 작업을 본문에서 직접 수행하면 중복 실행과 lifecycle 누수가 생긴다.
- 실무 포인트: coroutine 작업은 LaunchedEffect, listener 등록/해제는 DisposableEffect, composition 성공 후 외부 객체 갱신은 SideEffect로 나눠 설명한다.
- 주의점: effect key가 잘못되면 필요한 재시작이 안 되거나 불필요하게 반복된다.

#### Q16. rememberUpdatedState의 목적은 무엇인가? (p.346)

- 한 줄 답: rememberUpdatedState는 effect를 재시작하지 않으면서 effect 내부에서 최신 lambda/value를 참조하게 해준다.
- 핵심 근거: long-running LaunchedEffect나 DisposableEffect가 오래 유지되어야 하지만 callback만 최신으로 바뀌어야 할 때 사용한다.
- 실무 포인트: timeout 후 최신 callback 호출, lifecycle observer에서 최신 handler 사용 같은 상황을 예로 든다.
- 주의점: key로 effect를 재시작해야 하는 상황과 callback만 갱신하면 되는 상황을 구분한다.

#### Q17. produceState의 목적은 무엇인가? (p.349)

- 한 줄 답: produceState는 coroutine producer를 실행해 외부 async source를 Compose State로 변환하는 API다.
- 핵심 근거: 내부적으로 state를 만들고 producer coroutine에서 값을 갱신하며, key가 바뀌거나 composition을 떠나면 cancel된다.
- 실무 포인트: callback/stream/suspend source를 Compose state로 bridge할 때 쓴다.
- 주의점: ViewModel에서 이미 StateFlow를 제공한다면 collectAsStateWithLifecycle이 더 단순할 수 있다.

#### Q18. snapshotFlow는 무엇이고 어떻게 동작하는가? (p.355)

- 한 줄 답: snapshotFlow는 Compose snapshot state read를 Flow로 변환해 state 변화가 발생할 때 flow emission을 만들게 하는 API다.
- 핵심 근거: block 안에서 읽은 snapshot state가 바뀌면 Flow가 새 값을 emit한다.
- 실무 포인트: scroll state를 Flow로 관찰해 analytics나 threshold event를 처리할 때 유용하다.
- 주의점: UI state를 무작정 Flow로 되돌리면 구조가 복잡해진다. side effect와 stream integration에 한정해 쓴다.

#### Q19. derivedStateOf는 무엇이고 recomposition 최적화에 어떻게 도움이 되는가? (p.358)

- 한 줄 답: derivedStateOf는 여러 state에서 계산된 파생 값을 memoize하고, 결과 값이 실제로 바뀔 때만 관찰자에게 변경을 전달하도록 돕는다.
- 핵심 근거: scroll index처럼 자주 바뀌지만 UI가 관심 있는 boolean/result는 덜 자주 바뀌는 경우 recomposition을 줄일 수 있다.
- 실무 포인트: `showScrollToTop = listState.firstVisibleItemIndex > 0` 같은 파생 상태에 적합하다.
- 주의점: 단순하고 저렴한 계산에 남용하면 오히려 overhead와 가독성 비용이 생긴다.

#### Q20. Composable function 또는 Composition의 lifecycle은 무엇인가? (p.358)

- 한 줄 답: Composable은 View처럼 고정 callback lifecycle을 갖기보다 composition에 enter, recompose, skip, leave되는 lifecycle을 가진다.
- 핵심 근거: composition에 들어오면 remember/effect가 생성되고, recomposition 때 재실행되거나 skip되며, composition에서 사라지면 remembered value/effect가 정리된다.
- 실무 포인트: resource cleanup은 DisposableEffect, coroutine cancellation은 LaunchedEffect/rememberCoroutineScope lifecycle에 맡긴다.
- 주의점: `onCreate/onDestroy` 같은 View lifecycle callback을 composable에 그대로 대응시키면 안 된다.

#### Q22. Snapshot system의 목적은 무엇인가? (p.365)

- 한 줄 답: Snapshot system은 Compose state의 read/write를 추적하고 일관된 변경 적용과 recomposition invalidation을 가능하게 하는 상태 관리 기반이다.
- 핵심 근거: mutable state가 읽힌 scope를 기록하고, write가 발생하면 관련 scope가 invalidated된다. mutable snapshot은 변경을 격리했다가 적용할 수 있다.
- 실무 포인트: snapshot을 이해하면 mutableStateOf, mutableStateListOf, snapshotFlow의 동작이 연결된다.
- 주의점: snapshot state를 Compose 밖 multi-thread 환경에서 다룰 때는 thread-safety와 apply 시점을 이해해야 한다.

#### Q23. mutableStateListOf와 mutableStateMapOf는 무엇인가? (p.370)

- 한 줄 답: 이들은 list/map 내부 변경까지 Compose snapshot system이 관찰할 수 있게 하는 state-aware collection이다.
- 핵심 근거: `mutableStateOf(mutableListOf())`는 list reference가 그대로면 내부 add/remove를 감지하지 못할 수 있지만, SnapshotStateList/Map은 element 변경을 관찰한다.
- 실무 포인트: Compose UI가 직접 관찰하는 mutable collection에는 state-aware collection이나 immutable copy 교체를 사용한다.
- 주의점: ViewModel 외부에 mutable collection을 그대로 노출하면 단방향 data flow가 깨질 수 있다.

#### Q24. Composable에서 Flow를 안전하게 collect하는 방법은 무엇인가? (p.373)

- 한 줄 답: Android UI에서는 `collectAsStateWithLifecycle()`을 사용해 lifecycle에 맞춰 Flow를 State로 collect하는 것이 기본 선택이다.
- 핵심 근거: `collectAsState()`는 composition에는 묶이지만 Android lifecycle foreground/background를 자동 고려하지 않는다. lifecycle-aware collection은 보이지 않을 때 불필요한 작업을 줄인다.
- 실무 포인트: ViewModel의 StateFlow를 UI state로 노출하고 Composable에서 collectAsStateWithLifecycle로 관찰한다.
- 주의점: one-shot event를 state flow로 무리하게 표현하면 중복 소비 문제가 생긴다.

#### Q25. CompositionLocal의 역할은 무엇인가? (p.376)

- 한 줄 답: CompositionLocal은 composition tree 아래로 값을 암시적으로 제공해 깊은 parameter passing을 줄이는 mechanism이다.
- 핵심 근거: theme, typography, density, layout direction, local services처럼 많은 하위 composable이 공통으로 참조하는 값을 제공한다.
- 실무 포인트: design system이나 locally scoped dependency에는 유용하지만, 일반 business state 전달에는 explicit parameter가 더 명확하다.
- 주의점: 남용하면 dependency가 숨겨져 testability와 readability가 떨어진다.

## 핵심 주장과 근거

Compose Runtime의 핵심은 "UI를 다시 그리는 방법"이 아니라 "state를 읽은 composable scope를 다시 실행하고, 필요 없는 재실행을 건너뛰며, 외부 작업을 composition lifecycle에 맞추는 방법"이다.

- Q0~Q4는 declarative UI와 compiler/runtime 구조를 묻는다.
- Q3, Q5~Q9는 recomposition과 performance를 묻는다.
- Q11~Q14, Q21은 state가 어디에 저장되고 어떻게 보존되는지 묻는다.
- Q15~Q25는 side effect, snapshot, Flow collection, implicit value propagation을 묻는다.

## 실무 적용 / 생각해볼 질문

| 상황 | 실무에서의 답변 방향 |
|------|----------------------|
| recomposition count가 많다 | state read 위치, unstable parameter, derivedStateOf 필요성, release benchmark를 확인한다. |
| LaunchedEffect가 여러 번 실행된다 | key와 composition 진입/이탈 경로를 확인하고 ViewModel init/event로 옮길 작업인지 판단한다. |
| list 내부 변경이 UI에 반영되지 않는다 | mutableStateOf로 감싼 mutable list인지 확인하고 immutable copy나 mutableStateListOf를 사용한다. |
| callback이 stale하다 | effect를 재시작할지 rememberUpdatedState로 최신 callback만 참조할지 구분한다. |
| CompositionLocal이 늘어난다 | theme/config 같은 ambient 값인지 business dependency를 숨기는지 점검한다. |

## 오해하기 쉬운 부분

- Recomposition은 전체 화면 redraw가 아니다. composable 재실행과 layout/draw는 구분된다.
- `remember`는 영구 저장소가 아니다. composition lifetime에 묶인다.
- `rememberSaveable`도 큰 data 저장소가 아니다. saveable한 작은 UI state에 적합하다.
- Stable annotation은 실제 불변성 계약을 지킬 때 의미가 있다.
- Side effect를 composable 본문에서 직접 실행하면 recomposition 때문에 중복 실행될 수 있다.
- `collectAsState`와 `collectAsStateWithLifecycle`은 lifecycle awareness가 다르다.
- CompositionLocal은 편하지만 dependency를 숨긴다.

## 한 장 요약

4편을 한 문장으로 줄이면 이렇다.

> Compose는 state를 읽은 composable scope를 runtime이 추적하고, state 변화가 생기면 필요한 부분을 다시 실행하며, stability와 effect API로 성능과 lifecycle을 관리하는 선언형 UI system이다.

암기 순서는 다음이 좋다.

1. 구조를 말한다: compiler, runtime, UI layer.
2. phases를 말한다: composition, layout, draw.
3. recomposition을 말한다: state read tracking, invalidation, skipping.
4. performance를 말한다: stability, immutable model, release benchmark.
5. state를 말한다: remember, rememberSaveable, hoisting, ViewModel.
6. effect를 말한다: LaunchedEffect, DisposableEffect, rememberUpdatedState, produceState.
7. snapshot을 말한다: snapshotFlow, derivedStateOf, mutableStateListOf, collectAsStateWithLifecycle, CompositionLocal.

## 참고자료

- 원문: Jaewoong Eum, `Manifest Android Interview: The Ultimate Guide`, Jetpack Compose Fundamentals/Runtime, p.274~381.
- Android Developers, Thinking in Compose.
- Android Developers, Compose phases.
- Android Developers, State and Jetpack Compose.
- Android Developers, Side-effects in Compose.
- Android Developers, Performance in Compose.
