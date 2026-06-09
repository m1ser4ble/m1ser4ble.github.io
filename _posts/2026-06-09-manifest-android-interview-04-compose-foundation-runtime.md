---
layout: single
title: "Manifest Android Interview 4편: Compose Foundation과 Runtime 독해 가이드"
date: 2026-06-09 09:04:00 +0900
categories: android
excerpt: "Compose Foundation과 Runtime 파트는 @Composable 코드가 compiler와 runtime을 거쳐 state-driven UI로 실행되는 방식을 설명한다."
toc: true
toc_sticky: true
tags: [android, interview, jetpack-compose, compose-runtime, recomposition, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.274~381, Compose Fundamentals와 Compose Runtime 구간의 독해 가이드다.
- 핵심 질문은 "Composable 함수는 어떻게 state 변화에 반응하고, Runtime은 무엇을 기억하며 무엇을 다시 실행하는가?"다.
- Compose는 UI toolkit인 동시에 compiler/runtime/state model이다.

## 이 글이 답하려는 질문

> Compose 코드는 함수 호출처럼 보이는데, 왜 lifecycle, state, recomposition, effect, snapshot 같은 runtime 개념이 필요한가?

## 읽기 전에 알아야 할 것

Compose를 단순히 "XML 대신 Kotlin으로 UI 작성"이라고 보면 Runtime 파트를 놓친다. Compose의 핵심은 state가 변했을 때 UI를 안전하고 효율적으로 다시 계산하는 것이다.

<div class="mermaid">
flowchart TD
    Code[@Composable Kotlin code]
    Compiler[Compose Compiler]
    Runtime[Compose Runtime]
    Slot[Slot Table]
    Snapshot[Snapshot state]
    UI[Compose UI tree]
    Recompose[Recomposition]

    Code --> Compiler --> Runtime
    Runtime --> Slot
    Snapshot --> Runtime
    Runtime --> UI
    Snapshot --> Recompose --> Runtime
</div>

원문 p.274 compose-structure, p.279 compose phases, p.287 recomposition, p.300 smart recomposition, p.328 state hoisting, p.359 composable lifecycle를 재구성했다.

## 용어 사전

| 용어 | 의미 | 읽을 때의 포인트 |
|------|------|------------------|
| Composable | Compose UI를 선언하는 함수 | 직접 UI 객체를 mutate하지 않는다 |
| Compose Compiler | composable 호출을 runtime 추적 가능하게 변환 | Kotlin compiler plugin 역할 |
| Compose Runtime | composition, recomposition, state, effects를 관리 | Compose의 핵심 실행 모델 |
| Slot Table | composition 구조와 remembered value 추적 | UI tree를 기억하는 내부 구조 |
| State | UI를 결정하는 변경 가능한 값 | state read가 recomposition scope와 연결 |
| Recomposition | state 변경 후 필요한 composable을 다시 실행 | 전체 redraw가 아니다 |
| Stability | 값이 바뀌었는지 예측 가능한지에 대한 compiler/runtime 판단 | skip 가능성과 성능에 영향 |
| remember | composition 동안 값을 기억 | configuration/process death와 구분 |
| rememberSaveable | saveable state registry를 통해 복원 가능한 값 기억 | Bundle 저장 가능성 고려 |
| LaunchedEffect | composition lifecycle에 묶인 coroutine side effect | key 변경 시 재시작 |
| DisposableEffect | 정리가 필요한 side effect | listener/register-unregister 패턴 |
| CompositionLocal | tree 아래로 값을 암묵 전달 | 전역 상태처럼 남용하면 추적성 저하 |

## 등장 배경과 이유

전통 View UI는 "객체를 찾아서 속성을 바꾸는" imperative 모델이었다. 상태가 많아지면 어떤 변경이 어느 View를 어떻게 갱신했는지 추적하기 어려워진다. Compose는 현재 state에서 UI를 선언하고, Runtime이 필요한 부분을 다시 계산하는 방식으로 이 문제를 줄인다.

## 역사적 기원

Compose는 React/SwiftUI/Flutter 같은 선언형 UI 흐름과 같은 시대적 문제의식에서 등장했다. Android에서는 Kotlin compiler plugin, Runtime, UI library가 함께 작동하는 방식으로 구현되었다. 2021년 1.0 이후 Android UI의 주요 선택지가 되었고, 기존 View 시스템과 interop하면서 점진 도입이 가능해졌다.

## 학술적/이론적 배경

| 배경 | Compose에서의 표현 |
|------|--------------------|
| Declarative programming | state -> UI description |
| Incremental computation | recomposition, skipping |
| Snapshot isolation | snapshot state system |
| Functional purity | side-effect-free composable 권장 |
| State hoisting | unidirectional data flow |
| Lifecycle-bound effects | LaunchedEffect, DisposableEffect |

## 연대표

| 흐름 | 의미 |
|------|------|
| XML/View UI | imperative view mutation 중심 |
| Compose preview | Kotlin 기반 선언형 UI 실험 |
| Compose 1.0 | production-ready 선언형 UI 모델 |
| Compose Runtime 고도화 | stability, skipping, snapshot, effect API 이해 중요도 증가 |

## 동작 메커니즘

### Compose phases

<div class="mermaid">
flowchart LR
    State[State read]
    Composition[Composition<br/>what UI?]
    Layout[Layout<br/>where and how big?]
    Drawing[Drawing<br/>pixels]
    Screen[Screen]

    State --> Composition --> Layout --> Drawing --> Screen
    State -->|change| Recomposition[Recomposition]
    Recomposition --> Composition
</div>

Composition은 UI 구조를 계산하고, Layout은 크기와 위치를 정하며, Drawing은 실제 픽셀을 만든다. 면접에서는 이 세 단계 중 어느 단계가 invalidated되는지 설명할 수 있으면 좋다.

### Recomposition과 stability

<div class="mermaid">
flowchart TD
    StateChange[State changes]
    Runtime[Compose Runtime]
    Stable{Inputs stable and unchanged?}
    Skip[Skip composable]
    Restart[Restart composable]
    Children[Re-evaluate children if needed]

    StateChange --> Runtime --> Stable
    Stable -->|yes| Skip
    Stable -->|no| Restart --> Children
</div>

`@Stable`, `@Immutable`, stable/unstable parameter, skippable/restartable 개념은 모두 recomposition 비용을 줄이는 설명 언어다.

### State hoisting

<div class="mermaid">
flowchart TD
    Parent[Parent / ViewModel]
    Value[value]
    Callback[onValueChange]
    Child[Stateless composable]
    Event[User input]

    Parent --> Value --> Child
    Parent --> Callback --> Child
    Child --> Event --> Callback --> Parent
</div>

State hoisting은 child가 상태 소유자가 아니라 상태 표시자가 되도록 만드는 패턴이다. 이 패턴을 이해하면 Compose와 ViewModel의 경계도 자연스럽게 잡힌다.

### Effect lifecycle

<div class="mermaid">
stateDiagram-v2
    [*] --> EnterComposition
    EnterComposition --> Remember
    Remember --> Active
    Active --> Recompose: state changes
    Recompose --> Active
    Active --> RestartEffect: effect key changes
    RestartEffect --> Active
    Active --> Dispose: leaves composition
    Dispose --> [*]
</div>

side effect API는 "composable 함수 안에서 외부 세계를 다루는 안전한 경계"로 읽어야 한다.

## 책의 전체 구조에서 이 파트의 위치

이 구간은 앞 글의 ViewModel/data flow를 Compose mental model로 연결한다. ViewModel은 screen state holder가 되고, Compose Runtime은 그 state를 읽어 UI를 계산한다.

## 장별 독해 가이드

- Compose structure: Compiler/Runtime/UI 세 축을 잡는다.
- Compose phases: Composition/Layout/Drawing을 구분한다.
- Declarative UI/Recomposition: state-driven update 모델.
- Composable internals: compiler가 함수를 어떻게 runtime과 연결하는지.
- Stability/Smart recomposition: 성능 답변의 핵심.
- State/remember/saveable: state 수명 구분.
- Effects: coroutine/listener/snapshot bridge.
- CompositionLocal: 암묵적 의존성 전달과 recomposition 범위.

## 핵심 주장과 근거

> Compose의 핵심은 UI API가 아니라 Runtime이 state read와 composition 구조를 추적한다는 점이다.

이 관점을 잡으면 `remember`, effect, state hoisting, stability, Modifier order가 서로 연결된다.

## 실무 적용 / 생각해볼 질문

- 어떤 state는 ViewModel에 두고 어떤 state는 `remember`에 둘 것인가?
- `LaunchedEffect(Unit)`은 안전한가, 아니면 lifecycle/key를 더 명확히 해야 하는가?
- `derivedStateOf`는 언제 최적화이고 언제 과한 복잡도인가?
- `CompositionLocal`이 prop drilling을 줄이는 대신 무엇을 숨기는가?
- stable data class와 mutable list를 composable parameter로 넘길 때 무슨 차이가 나는가?

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| Recomposition은 화면 전체 redraw다 | 필요한 composable을 다시 실행하고 skip할 수 있다 |
| remember는 영구 저장이다 | composition 수명에 묶인다 |
| LaunchedEffect는 그냥 coroutine launch다 | composition lifecycle과 key에 묶인다 |
| CompositionLocal은 전역 변수 대체다 | scope와 recomposition 비용을 고려해야 한다 |
| Compose는 XML을 Kotlin으로 바꾼 것이다 | compiler/runtime/state model이 핵심이다 |

## 한 장 요약

```text
Compose Runtime 질문의 답변 구조:

State가 바뀐다
-> Runtime이 state read scope를 안다
-> 필요한 composable을 재실행한다
-> stable input은 skip할 수 있다
-> Composition/Layout/Drawing 중 필요한 단계가 갱신된다
```

## 참고자료

- 원문: *Manifest Android Interview*, Compose Fundamentals/Runtime, p.274~381.
- Android Developers, Compose mental model: <https://developer.android.com/develop/ui/compose/mental-model>
- Android Developers, State and Jetpack Compose: <https://developer.android.com/develop/ui/compose/state>
- Android Developers, Lifecycle of composables: <https://developer.android.com/develop/ui/compose/lifecycle>
- Android Developers, Side-effects in Compose: <https://developer.android.com/develop/ui/compose/side-effects>
