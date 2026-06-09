---
layout: single
title: "Manifest Android Interview 독해 지도"
date: 2026-06-09 10:06:00 +0900
categories: android
excerpt: "Manifest Android Interview는 Android Framework와 Jetpack Compose 면접 준비를 Q&A로 압축한 책이며, 이 글은 책을 1회독 전에 훑기 위한 독해 지도다."
toc: true
toc_sticky: true
tags: [android, interview, jetpack-compose, compose, reading-guide, book]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 책은 Android 개발 면접을 위한 **질문 은행 + 해설서**다. 책 자체가 선형 교과서라기보다, 필요한 주제를 찾아가며 복습하는 구조에 가깝다.
- 큰 축은 두 개다. 앞부분은 Android Framework, View 시스템, Jetpack Library, Business Logic이고, 뒷부분은 Jetpack Compose의 구조, Runtime, UI다.
- 1회독 전에 `Android 앱 모델 -> View/Jetpack 상태 관리 -> Compose 상태/재구성 모델`이라는 큰 지도를 잡으면 훨씬 덜 흔들린다.
- 원문 그림은 그대로 복제하지 않고, 핵심 의미를 Mermaid 도식으로 재구성했다. 각 도식에는 원문에서 대응되는 그림/쪽을 적었다.

## 이 글의 처리 결정

이 PDF는 459쪽이고 목차상 7개 큰 카테고리로 구성되어 있으므로, 이번 산출물은 **독해 지도 1편 + 파트별 독해 가이드 5편**으로 나눈다. 각 질문을 그대로 요약하면 원문 대체물에 가까워지기 때문에, 각 편은 답안 모음이 아니라 사람이 책을 읽기 쉬운 순서와 배경을 잡는 독해 지도 형태로 작성한다.

책의 순서는 유지한다. 다만 책이 스스로도 "직무 요건에 맞춰 선택적으로 읽으라"는 성격을 갖고 있으므로, 각 카테고리를 읽는 우선순위와 연결 관계를 별도로 표시한다.

- 현재 글: 전체 구조, 핵심 용어, 역사적 맥락, 1회독/2회독 전략
- [1편: Android Framework]({% post_url 2026-06-09-manifest-android-interview-01-android-framework %}): 앱이 OS와 맺는 컴포넌트 계약
- [2편: Android UI - Views]({% post_url 2026-06-09-manifest-android-interview-02-android-ui-views %}): 전통 View 시스템의 렌더링과 재사용 모델
- [3편: Jetpack과 Business Logic]({% post_url 2026-06-09-manifest-android-interview-03-jetpack-business-logic %}): 상태 보존, 의존성, 데이터 흐름, 백그라운드 작업
- [4편: Compose Foundation과 Runtime]({% post_url 2026-06-09-manifest-android-interview-04-compose-foundation-runtime %}): Compose compiler/runtime, state, recomposition, effect
- [5편: Compose UI와 Testing]({% post_url 2026-06-09-manifest-android-interview-05-compose-ui-testing %}): modifier, layout, lazy list, semantics, test

## 이 책이 답하려는 질문

이 책의 핵심 질문은 단순히 "Android 면접 질문의 답은 무엇인가?"가 아니다. 더 정확히는 다음 질문에 답한다.

> Android 개발자가 면접에서 구현 경험을 개념 언어로 설명하려면, Framework, UI, Jetpack, Business Logic, Compose Runtime을 어떤 mental model로 묶어야 하는가?

책은 Android의 오래된 핵심 구조와 최신 Compose 모델을 한 흐름으로 묶는다. 따라서 단순 암기보다 다음 두 능력을 훈련하는 데 맞다.

- 면접관이 던지는 질문을 **어느 계층의 문제인지** 빠르게 분류하는 능력
- 코드 예제를 **lifecycle, state, threading, rendering, architecture** 관점으로 설명하는 능력

## 읽기 전에 알아야 할 것

처음부터 끝까지 곧장 읽으면 질문이 너무 많아 중심이 흐려질 수 있다. 먼저 다음 지도를 들고 읽는 편이 좋다.

<div class="mermaid">
flowchart TD
    Book[Manifest Android Interview]
    Book --> Android[0. Android Interview Questions]
    Book --> Compose[1. Jetpack Compose Interview Questions]

    Android --> Framework[Android Framework<br/>component, manifest, lifecycle, process]
    Android --> Views[Android UI - Views<br/>View tree, measure/layout/draw, RecyclerView]
    Android --> Jetpack[Jetpack Library<br/>LiveData, ViewModel, Navigation, Hilt, Paging]
    Android --> Business[Business Logic<br/>background work, networking, storage, offline-first]

    Compose --> Fundamentals[Compose Fundamentals<br/>compiler, runtime, UI, phases]
    Compose --> Runtime[Compose Runtime<br/>state, remember, effects, snapshot, CompositionLocal]
    Compose --> ComposeUI[Compose UI<br/>Modifier, layout, lazy list, canvas, animation, testing]

    Framework --> Views
    Views --> Jetpack
    Jetpack --> Business
    Framework --> Compose
    Jetpack --> Runtime
    Runtime --> ComposeUI
</div>

위 도식은 원문 목차와 p.7, p.11, p.121, p.188, p.238, p.274, p.323, p.382의 카테고리 설명을 재구성한 것이다.

## 용어 사전

| 용어 | 의미 | 읽을 때의 포인트 |
|------|------|------------------|
| Android Framework | Activity, Service, BroadcastReceiver, ContentProvider, Intent, Manifest 등 앱 실행 계약의 기본 계층 | "앱이 OS와 어떻게 계약하는가"로 읽는다 |
| Activity | 화면 단위이면서 lifecycle owner 역할을 하는 앱 컴포넌트 | UI와 프로세스 생존을 같은 것으로 착각하면 안 된다 |
| Fragment | Activity 안에서 재사용 가능한 UI/상태 조각 | Fragment lifecycle과 View lifecycle을 구분해야 한다 |
| Service | 백그라운드 작업을 표현하는 컴포넌트 | modern Android에서는 WorkManager/Foreground Service 제약까지 같이 봐야 한다 |
| Intent | 컴포넌트 간 명시적/암시적 작업 요청 | Android 앱 모델의 메시지 언어 |
| PendingIntent | 나중에 다른 프로세스가 대신 실행할 수 있는 위임된 Intent | 알림/위젯/Alarm 쪽에서 권한 위임 관점으로 봐야 한다 |
| Context | 리소스, 시스템 서비스, 앱 환경 접근의 핸들 | Activity Context와 Application Context의 수명 차이가 핵심 |
| View | 전통 UI 시스템의 최소 렌더링 단위 | measure/layout/draw와 invalidation을 같이 이해해야 한다 |
| ViewModel | UI 관련 상태를 configuration change 너머로 보존하는 Jetpack 컴포넌트 | MVVM의 ViewModel과 이름은 같지만 목적이 완전히 같지는 않다 |
| LiveData | lifecycle-aware observable data holder | 지금은 Flow/StateFlow와 비교해서 읽으면 좋다 |
| Baseline Profile | 자주 실행되는 코드 경로를 미리 컴파일하도록 도와 startup/runtime 성능을 개선하는 프로파일 | "앱 성능은 런타임 최적화만이 아니라 배포 산출물의 일부"라는 관점 |
| Compose Compiler | `@Composable` 코드를 Compose Runtime이 추적 가능한 형태로 변환하는 컴파일러 플러그인 | Compose가 단순 라이브러리가 아니라 컴파일러 협업 모델임을 보여준다 |
| Compose Runtime | composition, recomposition, state, snapshot, effects를 관리하는 실행 엔진 | Compose 면접의 핵심은 Runtime mental model이다 |
| Slot Table | Compose가 composition 구조와 remembered 값을 추적하는 내부 자료구조 | "함수 호출처럼 보이지만 트리를 기억한다"는 점을 이해해야 한다 |
| Recomposition | state 변경에 따라 필요한 composable을 다시 실행하는 과정 | 모든 UI를 다시 그리는 것이 아니라 skip/restart 가능성이 핵심 |
| State Hoisting | 상태를 child composable 내부가 아니라 caller 쪽으로 끌어올리는 패턴 | 재사용성, 테스트성, 단방향 데이터 흐름과 연결된다 |
| Modifier | Compose UI 요소의 layout, drawing, input, semantics를 장식/변형하는 체인 | 순서가 의미를 바꾼다 |

## 등장 배경과 이유

Android 면접은 단순 API 암기에서 끝나기 어렵다. Android 앱은 OS와 강하게 결합되어 있고, 같은 기능도 lifecycle, process, permission, rendering, threading 제약을 받는다. 그래서 면접 질문은 보통 다음을 확인한다.

- 앱 컴포넌트가 OS와 맺는 계약을 이해하는가
- main thread와 background work의 경계를 설명할 수 있는가
- UI 상태를 configuration change, process death, recomposition 앞에서 안정적으로 다룰 수 있는가
- View 시스템과 Compose의 사고방식 차이를 설명할 수 있는가
- "이 코드를 썼다"가 아니라 "왜 이 API가 이 문제를 해결하는가"를 말할 수 있는가

이 책은 이런 질문을 Q&A 형식으로 압축한다. 따라서 읽는 목적은 답안을 외우는 것이 아니라, 질문을 받았을 때 어느 계층의 mental model로 답해야 하는지 분류하는 것이다.

## 역사적 기원

Android는 2008년 9월 첫 상용 기기와 함께 본격적으로 공개되었고, 초기부터 Activity, Intent, Service, ContentProvider 같은 컴포넌트 모델을 중심으로 앱을 구성했다. 이후 생태계는 크게 세 번 방향이 바뀌었다.

| 시기 | 변화 | 독해 포인트 |
|------|------|-------------|
| 2008~2014 | Activity, View, Service, ContentProvider 중심의 기본 앱 모델 정착 | Android Framework 질문의 대부분은 이 시기의 기본 계약에서 나온다 |
| 2015~2018 | Support Library, Architecture Components, Jetpack으로 app architecture 패턴 정리 | ViewModel, LiveData, Navigation, Room, WorkManager 같은 면접 주제가 등장 |
| 2019~2021 이후 | Jetpack Compose가 선언형 UI 모델을 도입하고 1.0 안정화 | UI 질문이 View tree에서 state-driven recomposition으로 이동 |

이 흐름 때문에 책 앞부분의 Framework/View 질문은 낡은 지식이 아니라, Compose를 쓰더라도 OS와 상호작용할 때 계속 필요한 바닥 지식이다.

## 학술적/이론적 배경

이 책은 학술서가 아니지만, 여러 이론적 배경이 암묵적으로 깔려 있다.

| 이론/패턴 | 책에서 만나는 위치 | 이해해야 하는 이유 |
|-----------|-------------------|--------------------|
| Event-driven architecture | Intent, BroadcastReceiver, Handler, Looper | Android 앱은 이벤트 루프와 메시지 전달 위에서 돈다 |
| Lifecycle/state machine | Activity, Fragment, Service, View, Compose lifecycle | 면접 질문은 "언제 생성/정리되는가"를 반복해서 묻는다 |
| Observer pattern | LiveData, StateFlow, Compose State | UI가 데이터 변화에 반응하는 방식을 설명하는 공통 언어 |
| Unidirectional data flow | ViewModel, state hoisting, Compose state | UI 상태를 예측 가능하게 만드는 기본 원리 |
| Dependency injection | Dagger/Hilt/Koin | 객체 생성과 의존성 그래프를 테스트 가능하게 만든다 |
| Declarative UI | Compose | "어떻게 갱신할까"보다 "현재 상태에서 UI는 무엇인가"를 선언한다 |
| Snapshot / consistency model | Compose Runtime | Compose의 상태 읽기/쓰기와 recomposition을 이해하는 핵심 |

## 연대표

| 연도 | 사건 | 이 책에서의 의미 |
|------|------|------------------|
| 2008 | Android 1.0 상용화 | Activity, Intent, View, Manifest 같은 기본 앱 모델의 출발점 |
| 2011~2014 | Fragment, AppCompat, Support Library 사용 확대 | 오래된 Android 버전 호환과 복잡한 UI 구조의 기반 |
| 2017 | Google I/O에서 Kotlin Android 공식 지원 발표 | 책 전반의 Kotlin 코드 예제와 현대 Android 개발의 기반 |
| 2017~2018 | Architecture Components와 Jetpack 방향성 정리 | ViewModel, LiveData, Navigation, Room, WorkManager 등 |
| 2019 | Jetpack Compose 공개 프리뷰 | View 기반 imperative UI에서 declarative UI로 이동 |
| 2021 | Jetpack Compose 1.0 안정화 | Compose 면접 질문이 실무/면접의 주요 축으로 진입 |
| 2025 | Manifest Android Interview 출간 버전 | Android Framework와 Compose를 함께 묶은 면접 준비서 |

## 동작 메커니즘

### Android 앱 모델: OS와 앱의 계약

원문 p.13의 Android architecture 그림은 Android를 계층형 플랫폼으로 보여준다. 독해할 때 중요한 것은 "앱 코드가 직접 하드웨어를 만지는 것이 아니라, Framework와 Runtime, system service를 통해 OS와 계약한다"는 점이다.

<div class="mermaid">
flowchart TD
    App[App code<br/>Activity / Fragment / Compose / ViewModel]
    Framework[Android Framework<br/>ActivityManager, WindowManager, PackageManager]
    Runtime[Android Runtime ART<br/>class loading, GC, AOT/JIT]
    Native[Native Libraries<br/>SQLite, WebView, Media, Graphics]
    HAL[HAL<br/>camera, audio, sensors]
    Kernel[Linux Kernel<br/>process, memory, drivers, Binder]

    App --> Framework
    Framework --> Runtime
    Framework --> Native
    Native --> HAL
    HAL --> Kernel
    Framework --> Kernel
</div>

### Lifecycle: 생성보다 정리가 더 중요하다

Activity, Fragment, Service, View lifecycle 그림들은 원문 p.37, p.42, p.53, p.123에 분산되어 있다. 이 책을 읽을 때 lifecycle 질문은 모두 같은 질문으로 환원된다.

> 어떤 객체가 언제 살아 있고, 언제 UI를 만질 수 있으며, 언제 리소스를 정리해야 하는가?

<div class="mermaid">
stateDiagram-v2
    [*] --> Created: onCreate
    Created --> Started: onStart
    Started --> Resumed: onResume
    Resumed --> Paused: onPause
    Paused --> Resumed: focus returns
    Paused --> Stopped: fully hidden
    Stopped --> Started: onRestart -> onStart
    Stopped --> Destroyed: onDestroy
    Destroyed --> [*]

    note right of Resumed
      UI interaction 가능
      main thread 작업 주의
    end note
    note right of Stopped
      화면은 안 보이지만
      상태 복원 가능성을 고려
    end note
</div>

Fragment는 Activity lifecycle과 별도로 **Fragment 객체 lifecycle**과 **Fragment View lifecycle**이 갈라진다. `viewLifecycleOwner`가 중요한 이유는 이 분리 때문이다.

<div class="mermaid">
flowchart LR
    Fragment[Fragment instance lifecycle]
    View[Fragment view lifecycle]
    Fragment --> onAttach
    onAttach --> onCreate
    onCreate --> onCreateView
    onCreateView --> View
    View --> onViewCreated
    onViewCreated --> onDestroyView
    onDestroyView --> FragmentStillAlive[Fragment may still exist]
    FragmentStillAlive --> onDestroy

    LiveData[LiveData observer]
    LiveData --> ViewLifecycleOwner[viewLifecycleOwner]
    ViewLifecycleOwner --> onDestroyView
</div>

### Threading: Looper/Handler는 Android의 event loop 언어다

원문 p.94의 Looper/Handler 그림은 Android의 main thread 이해를 위한 핵심 anchor다.

<div class="mermaid">
flowchart LR
    Producer[UI event / background callback / system event]
    Handler[Handler]
    Queue[MessageQueue]
    Looper[Looper.loop()]
    Dispatch[dispatchMessage]
    Callback[Runnable / handleMessage]
    UI[UI update on owning thread]

    Producer --> Handler
    Handler --> Queue
    Queue --> Looper
    Looper --> Dispatch
    Dispatch --> Callback
    Callback --> UI
    Callback --> Queue
</div>

면접에서는 "Handler를 써봤다"보다 다음을 설명해야 한다.

- Handler는 특정 Looper/Thread에 묶인다.
- MessageQueue는 작업을 순차 처리한다.
- UI는 main thread 소유이므로 background thread에서 직접 만지면 안 된다.
- `HandlerThread`는 Looper를 가진 worker thread를 쉽게 만들기 위한 도구다.

### View 시스템: tree를 재측정하고 다시 그리는 비용

원문 p.123의 View lifecycle, p.141의 invalidation 설명, p.151의 RecyclerView 내용은 모두 "View tree를 얼마나 효율적으로 갱신하는가"라는 질문으로 묶인다.

<div class="mermaid">
flowchart TD
    DataChange[Data or property change]
    Invalidate[invalidate / requestLayout]
    Measure[measure]
    Layout[layout]
    Draw[draw]
    Screen[Screen]

    DataChange --> Invalidate
    Invalidate --> Measure
    Measure --> Layout
    Layout --> Draw
    Draw --> Screen

    RecyclerView[RecyclerView]
    ViewHolder[ViewHolder]
    Pool[RecycledViewPool]
    RecyclerView --> ViewHolder
    ViewHolder --> Pool
    Pool --> RecyclerView
</div>

View 시스템 질문은 대체로 네 가지로 나뉜다.

- lifecycle: 언제 attach/detach되고 언제 그려지는가
- layout: measure/layout/draw가 어떤 순서로 도는가
- performance: 불필요한 inflation, bitmap decode, layout pass를 줄이는가
- reuse: RecyclerView의 ViewHolder와 DiffUtil을 이해하는가

### Jetpack: UI 상태를 lifecycle 밖으로 분리한다

원문 p.201, p.211, p.215는 LiveData, Jetpack ViewModel, MVVM 패턴을 연결한다. 여기서 핵심은 ViewModel을 "화면 뒤에 붙은 객체"가 아니라 **UI state holder**로 보는 것이다.

<div class="mermaid">
flowchart TD
    UI[Activity / Fragment / Compose Screen]
    VM[Jetpack ViewModel<br/>UI state holder]
    Repo[Repository]
    Data[Network / DB / DataStore]
    State[LiveData / StateFlow / Compose State]

    UI -->|event| VM
    VM --> Repo
    Repo --> Data
    Data --> Repo
    Repo --> VM
    VM --> State
    State -->|observe / collect| UI

    Config[Configuration change]
    Config -. survives .-> VM
    Config -. recreates .-> UI
</div>

주의할 점은 Jetpack ViewModel이 곧바로 "정통 MVVM의 ViewModel"과 동일하다고 말하면 안 된다는 것이다. Jetpack ViewModel은 lifecycle-aware state retention에 강하고, MVVM ViewModel은 View와 Model 사이의 binding/command abstraction까지 포함하는 더 넓은 패턴이다.

### Compose: 함수처럼 보이지만 Runtime이 기억하는 UI tree

원문 p.274, p.279, p.287, p.300, p.328, p.359는 Compose의 핵심 mental model을 만든다.

<div class="mermaid">
flowchart TD
    Source[Kotlin @Composable source]
    Compiler[Compose Compiler<br/>transforms composable calls]
    Runtime[Compose Runtime<br/>composition, slot table, snapshot]
    UI[Compose UI<br/>layout, drawing, input, semantics]
    State[State changes]
    Recompose[Recomposition]
    Phases[Composition -> Layout -> Drawing]

    Source --> Compiler
    Compiler --> Runtime
    Runtime --> UI
    State --> Runtime
    Runtime --> Recompose
    Recompose --> Phases
    UI --> Phases
</div>

Compose를 읽을 때 가장 중요한 문장은 이것이다.

> Composable은 UI를 직접 "수정"하는 함수가 아니라, 현재 state에서 UI가 어떤 모양이어야 하는지 선언하는 함수다.

이 관점에서 `remember`, `rememberSaveable`, `LaunchedEffect`, `DisposableEffect`, `derivedStateOf`, `snapshotFlow`, `CompositionLocal`, `Modifier`가 모두 Runtime과 연결된다.

### State hoisting: 재사용 가능한 UI를 만드는 경계

원문 p.328의 state-hoisting 그림은 Compose 실무 질문에서 매우 자주 돌아온다.

<div class="mermaid">
flowchart TD
    Parent[Parent composable / ViewModel]
    State[value]
    Event[onValueChange callback]
    Child[Stateless child composable]
    UI[TextField / Button / Screen]

    Parent --> State
    Parent --> Event
    State --> Child
    Event --> Child
    Child --> UI
    UI -->|user input| Event
    Event -->|updates| Parent
</div>

State hoisting은 단지 코드 스타일이 아니다. 면접에서는 다음 언어로 설명하는 편이 좋다.

- source of truth를 한 곳에 둔다
- child는 rendering만 담당하므로 재사용/테스트가 쉬워진다
- 이벤트는 위로 올라가고, state는 아래로 내려온다
- ViewModel과 결합하면 screen-level state holder가 된다

### Modifier: 순서가 의미다

원문 p.384~p.391의 Modifier 관련 그림들은 Compose UI에서 가장 실수하기 쉬운 지점을 보여준다.

<div class="mermaid">
flowchart LR
    A[Modifier.clickable()]
    B[.padding(21.dp)]
    C[.fillMaxWidth()]
    Result1[padding area also clickable]

    A --> B --> C --> Result1

    D[Modifier.padding(21.dp)]
    E[.clickable()]
    F[.fillMaxWidth()]
    Result2[only padded content clickable]

    D --> E --> F --> Result2
</div>

Modifier는 단순 속성 목록이 아니라 wrapper chain이다. 그래서 순서가 layout, hit target, drawing, semantics를 바꾼다. `weight`, `matchParentSize` 같은 scoped modifier는 어떤 parent scope 안에서만 의미가 있다.

## 책의 전체 구조

| 원문 구간 | PDF 쪽 | 연결 post | 읽기 목표 |
|-----------|--------|-----------|-----------|
| About This Book | p.7~9 | 현재 글 | 이 책이 선형 교과서가 아니라 면접 준비용 선택 독서 자료임을 이해 |
| Android Framework | p.12~120 | [1편]({% post_url 2026-06-09-manifest-android-interview-01-android-framework %}) | OS와 앱 컴포넌트의 계약, lifecycle, process, permission, threading |
| Android UI - Views | p.121~187 | [2편]({% post_url 2026-06-09-manifest-android-interview-02-android-ui-views %}) | View tree, custom view, rendering, RecyclerView, bitmap/animation/window |
| Jetpack Library | p.188~237 | [3편]({% post_url 2026-06-09-manifest-android-interview-03-jetpack-business-logic %}) | AppCompat, Material, ViewBinding/DataBinding, LiveData, ViewModel, Navigation, Hilt, Paging, Baseline Profile |
| Business Logic | p.238~273 | [3편]({% post_url 2026-06-09-manifest-android-interview-03-jetpack-business-logic %}) | background work, serialization, networking, list update, image loading, local storage, offline-first |
| Compose Fundamentals | p.274~322 | [4편]({% post_url 2026-06-09-manifest-android-interview-04-compose-foundation-runtime %}) | Compose 구조, compiler/runtime/UI, phases, declarative UI, recomposition, stability |
| Compose Runtime | p.323~381 | [4편]({% post_url 2026-06-09-manifest-android-interview-04-compose-foundation-runtime %}) | State, remember, effects, lifecycle, snapshots, Flow, CompositionLocal |
| Compose UI | p.382~459 | [5편]({% post_url 2026-06-09-manifest-android-interview-05-compose-ui-testing %}) | Modifier, custom layout, Box, image loading, lazy components, Canvas, graphicsLayer, animation, navigation, preview, testing, semantics/accessibility |

## 장별 독해 가이드

### 0장: Android Interview Questions

앞부분은 오래된 Android 기본기를 묻는다. Compose를 쓰더라도 이 구간을 건너뛰면 안 된다. Activity/Fragment/Service/Intent/Manifest/Context는 Compose 앱에서도 OS와 맞닿는 경계이기 때문이다.

읽는 순서는 다음처럼 잡으면 된다.

1. Android Framework: 앱이 OS와 계약하는 방식
2. Views: 전통 UI 시스템이 화면을 구성하고 갱신하는 방식
3. Jetpack: lifecycle-aware architecture로 상태를 분리하는 방식
4. Business Logic: 네트워크/저장소/백그라운드 작업을 UI와 분리하는 방식

#### 재방문 포인트

- `Context`는 p.27 이후 Application Context 글과 연결해서 다시 보면 좋다.
- `Handler/Looper`는 Compose에서도 main thread와 snapshot/effect를 이해할 때 다시 중요해진다.
- `ViewModel`은 Compose state holder와 연결해서 다시 읽어야 한다.
- `Baseline Profile`은 앱 성능이 코드만이 아니라 빌드/배포 산출물과도 연결된다는 점을 보여준다.

### 1장: Jetpack Compose Interview Questions

Compose 파트는 원문 순서대로 읽되, 처음부터 내부 구조를 완벽히 이해하려고 하면 힘들다. 책도 p.274에서 Runtime/UI 쪽을 먼저 읽어도 된다는 식의 안내를 한다. 따라서 추천 순서는 다음과 같다.

1. Compose UI: `Modifier`, layout, lazy list 같은 실무 API의 감각을 먼저 잡는다.
2. Compose Runtime: `State`, `remember`, effects, lifecycle을 읽는다.
3. Compose Fundamentals: compiler/runtime/UI 구조와 phases를 다시 읽는다.

원문 순서를 완전히 바꾸라는 뜻은 아니다. 1회독에서는 목차 순서대로 훑고, 2회독에서는 위 순서로 돌아오면 좋다.

#### 재방문 포인트

- `Recomposition`은 p.287에서 처음 읽고, p.300의 stability/smart recomposition에서 다시 이해된다.
- `State hoisting`은 p.328에서 패턴으로 보이지만, 실제로는 p.323 이후 Runtime state 모델의 응용이다.
- `CompositionLocal`은 편리한 전역 전달 도구가 아니라, recomposition 범위를 같이 고려해야 하는 API다.
- `Modifier`는 UI 장식이 아니라 layout/input/drawing/semantics를 차례로 감싸는 chain이다.

## 핵심 주장과 근거

이 책의 가장 실용적인 주장은 세 가지로 요약된다.

| 주장 | 근거가 되는 구간 | 독해 포인트 |
|------|------------------|-------------|
| Android 면접은 API 암기가 아니라 OS 계약 설명이다 | Framework, lifecycle, manifest, process, permission | "언제 생성되고 누가 소유하며 언제 정리되는가"를 말해야 한다 |
| 현대 Android 앱은 상태를 UI 밖으로 분리해야 한다 | ViewModel, LiveData, Navigation, Hilt, Business Logic | UI는 상태를 표시하고 이벤트를 올리는 쪽으로 단순화된다 |
| Compose는 UI toolkit이면서 Runtime programming model이다 | Compiler, Runtime, state, effects, snapshots, Modifier | "Composable 함수가 다시 실행된다"보다 "Runtime이 무엇을 기억하고 무엇을 건너뛰는가"가 핵심 |

## 실무 적용 / 생각해볼 질문

책을 읽으면서 각 질문을 다음 네 가지 답변 구조로 바꾸는 연습을 하면 좋다.

```text
1. 정의: 이 API/개념은 무엇인가?
2. 등장 이유: 어떤 문제 때문에 필요한가?
3. 동작 메커니즘: lifecycle/state/thread/rendering 관점에서 어떻게 움직이는가?
4. 실무 판단: 언제 쓰고, 언제 피하며, 어떤 함정이 있는가?
```

예를 들어 `ViewModel` 질문은 "configuration change에도 살아남는다"에서 끝내면 약하다. 더 좋은 답은 다음을 포함한다.

- UI controller보다 오래 살지만 영구 저장소는 아니다.
- Repository/Data layer와 UI 사이에서 UI state를 만든다.
- process death 복원은 `SavedStateHandle`, persistent storage와 구분해야 한다.
- Compose에서는 screen state holder로 쓰되, composable 내부 state와 책임을 나눠야 한다.

Compose 질문도 비슷하다. `remember`를 "값을 기억한다"로 외우지 말고, 다음 질문으로 확장한다.

- 무엇을 composition에 묶어 기억하는가?
- recomposition에서는 유지되지만 configuration/process death에서는 어떻게 되는가?
- `rememberSaveable`과의 경계는 무엇인가?
- ViewModel state와 local UI state 중 어디에 둬야 하는가?

## 오해하기 쉬운 부분

| 오해 | 더 정확한 이해 |
|------|----------------|
| 이 책을 처음부터 끝까지 외우면 면접 준비가 끝난다 | 책도 target role에 맞춘 선택 독서를 권한다. JD와 팀 기술 스택 기준으로 읽어야 한다 |
| Compose를 쓰면 View 시스템은 몰라도 된다 | Activity, Window, lifecycle, permission, process는 Compose 앱에서도 필요하다 |
| Jetpack ViewModel이면 MVVM을 구현한 것이다 | Jetpack ViewModel은 lifecycle-aware state holder이고, MVVM은 더 넓은 UI architecture 패턴이다 |
| Recomposition은 전체 화면을 다시 그리는 것이다 | Runtime은 restart/skip 가능성을 이용해 필요한 부분만 다시 계산하려고 한다 |
| Modifier는 속성 목록이다 | Modifier는 순서가 의미를 바꾸는 chain이다 |
| CompositionLocal은 prop drilling을 없애는 만능 도구다 | 동적 값에 남용하면 recomposition 범위와 추적성이 나빠질 수 있다 |

## 한 장 요약

```text
Android 면접 준비의 핵심은 "계층 분류"다.

OS 계약:
  Activity / Fragment / Service / Intent / Manifest / Context

전통 UI:
  View lifecycle / measure-layout-draw / invalidation / RecyclerView

Architecture:
  ViewModel / LiveData or Flow / Navigation / DI / Repository / Background work

Compose:
  Compiler / Runtime / State / Recomposition / Effects / Modifier / Semantics

좋은 답변:
  정의 -> 등장 이유 -> 동작 메커니즘 -> 실무 판단 -> 함정
```

## 참고자료

- Jaewoong Eum, *Manifest Android Interview*, Leanpub, 2025-06-16 version. 원문 PDF: `source` frontmatter 참고.
- Leanpub 책 페이지: <https://leanpub.com/manifest-android-interview>
- 책 GitHub 이슈/토론 저장소: <https://github.com/skydoves/manifest-android-interview>
- Android Developers, Platform architecture: <https://developer.android.com/guide/platform>
- Android Developers, App fundamentals: <https://developer.android.com/guide/components/fundamentals>
- Android Developers, Guide to app architecture: <https://developer.android.com/topic/architecture>
- Android Developers, Jetpack Compose mental model: <https://developer.android.com/develop/ui/compose/mental-model>
- Android Developers, State and Jetpack Compose: <https://developer.android.com/develop/ui/compose/state>
- Android Developers, Lifecycle of composables: <https://developer.android.com/develop/ui/compose/lifecycle>
