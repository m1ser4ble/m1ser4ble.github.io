---
layout: single
title: "Manifest Android Interview 3편: Jetpack과 Business Logic 독해 가이드"
date: 2026-06-09 10:20:00 +0900
categories: android
excerpt: "Jetpack과 Business Logic 파트는 UI 상태, 의존성, 백그라운드 작업, 네트워크, 저장소를 분리해 Android 앱을 운영 가능한 구조로 만드는 법을 다룬다."
toc: true
toc_sticky: true
tags: [android, interview, jetpack, viewmodel, hilt, workmanager, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.188~273, `Category 2: Jetpack Library`와 `Category 3: Business Logic`을 함께 읽는 가이드다.
- 핵심 질문은 "UI와 business/data logic을 어떻게 분리하고 lifecycle에 안전하게 연결하는가?"다.
- ViewModel, LiveData/Flow, Navigation, Hilt, Paging, WorkManager, Retrofit/OkHttp, Room/DataStore, offline-first를 하나의 app architecture 흐름으로 묶는다.

## 이 글이 답하려는 질문

> Android 앱에서 화면이 사라지고, 프로세스가 죽고, 네트워크가 실패하고, 데이터가 늦게 와도 일관된 UI를 만들려면 어떤 계층 구조가 필요한가?

## 읽기 전에 알아야 할 것

Framework/View 파트가 "OS와 화면"을 다뤘다면, 이 파트는 "상태와 데이터"를 다룬다.

<div class="mermaid">
flowchart TD
    UI[Activity / Fragment / Compose Screen]
    VM[ViewModel<br/>UI state holder]
    UseCase[Use case / Domain logic]
    Repo[Repository]
    Remote[Remote API<br/>Retrofit / OkHttp]
    Local[Local storage<br/>Room / DataStore / File]
    Worker[WorkManager / background work]

    UI -->|events| VM
    VM --> UseCase
    UseCase --> Repo
    Repo --> Remote
    Repo --> Local
    Worker --> Repo
    Repo --> VM
    VM -->|state| UI
</div>

원문 p.201 LiveData, p.211 ViewModel lifecycle, p.215 MVVM, p.237 Baseline Profiles, p.238 이후 Business Logic 구간을 재구성했다.

## 용어 사전

| 용어 | 의미 | 읽을 때의 포인트 |
|------|------|------------------|
| AppCompat | 오래된 Android 버전에서 최신 UI/compat 기능을 맞추는 라이브러리 | legacy compatibility |
| Material Components | Material Design UI component 모음 | theming과 design system |
| ViewBinding | XML view 참조를 type-safe하게 생성 | findViewById 대체 |
| DataBinding | XML과 data/state를 바인딩하는 선언적 binding | 편하지만 복잡도 증가 가능 |
| LiveData | lifecycle-aware observable holder | 지금은 Flow/StateFlow와 비교해서 읽기 |
| ViewModel | UI state holder | configuration change 생존, process death와 구분 |
| Navigation | destination/back stack/deep link 선언 | 화면 전환을 graph로 관리 |
| Hilt/Dagger | dependency injection | 객체 생성 책임을 외부로 이동 |
| Paging | 큰 데이터 목록을 page 단위로 로딩 | source/mediator/adapter 흐름 |
| WorkManager | 보장되어야 하는 background work | OS 제약과 retry/backoff 고려 |
| Retrofit/OkHttp | HTTP API client와 transport layer | error/retry/auth interceptor |
| Room/DataStore | local persistence | offline-first와 single source of truth |
| Baseline Profile | startup/runtime 성능을 위한 사전 컴파일 힌트 | build artifact와 runtime 성능 연결 |

## 등장 배경과 이유

Android 앱이 커질수록 Activity/Fragment 안에 모든 로직을 넣는 구조는 무너진다. lifecycle이 짧은 UI controller가 네트워크, DB, background work, permission, navigation, state 복원을 모두 책임지면 테스트도 어렵고 race condition도 늘어난다.

Jetpack은 이 문제를 줄이기 위해 lifecycle-aware API, architecture component, background work abstraction, persistence tool을 제공한다. Business Logic 파트는 이 Jetpack 도구들을 실제 앱의 data flow로 연결한다.

## 역사적 기원

Android 초창기에는 Activity/Fragment가 많은 책임을 직접 갖는 예제가 흔했다. 이후 Support Library와 Architecture Components를 거쳐 Jetpack이 등장하면서 ViewModel, LiveData, Room, Navigation, WorkManager 같은 구성요소가 표준적인 app architecture 언어가 되었다.

현대 Android에서는 이 흐름이 Kotlin Coroutine, Flow, Compose state와 결합된다. 따라서 이 파트는 Compose로 넘어가기 전의 architecture bridge 역할을 한다.

## 학술적/이론적 배경

| 배경 | 이 파트의 API |
|------|---------------|
| Separation of concerns | UI / ViewModel / Repository / Data source |
| Observer pattern | LiveData, Flow |
| Dependency inversion | Hilt, Dagger, Koin |
| Single source of truth | Repository + local DB |
| Resilience | retry, offline-first, WorkManager |
| Performance profile guided optimization | Baseline Profile |

## 연대표

| 흐름 | 의미 |
|------|------|
| Support Library/AppCompat | version compatibility 문제 완화 |
| Architecture Components | lifecycle-aware state management 등장 |
| Jetpack | 라이브러리 묶음과 app architecture 방향 정리 |
| Hilt/Paging/WorkManager | DI, list loading, background work의 표준화 |
| Baseline Profile | 배포 시점 성능 최적화가 일반 앱 개발의 일부가 됨 |

## 동작 메커니즘

### ViewModel과 UI state

<div class="mermaid">
flowchart TD
    UI[UI Controller<br/>Activity / Fragment / Compose]
    VM[ViewModel]
    State[UI State<br/>LiveData / StateFlow / Compose State]
    Repo[Repository]
    Config[Configuration change]

    UI -->|user event| VM
    VM --> Repo
    Repo --> VM
    VM --> State
    State --> UI
    Config -. recreates .-> UI
    Config -. retains .-> VM
</div>

핵심은 "ViewModel이 살아남는다"가 아니라 "UI controller보다 긴 수명을 가진 state holder가 필요하다"다.

### Jetpack ViewModel vs MVVM ViewModel

<div class="mermaid">
flowchart LR
    JetpackVM[Jetpack ViewModel<br/>lifecycle-aware state holder]
    MVVMVM[MVVM ViewModel<br/>binding + presentation logic]
    UI[View / UI]
    Model[Model / Domain]

    JetpackVM --> UI
    MVVMVM --> UI
    MVVMVM --> Model
    JetpackVM -. can participate in .-> MVVMVM
</div>

원문 p.215의 요지는 Jetpack ViewModel이 MVVM의 ViewModel과 이름은 같지만 책임 범위가 다르다는 것이다.

### Business Logic data flow

<div class="mermaid">
flowchart TD
    User[User action]
    UI[UI]
    VM[ViewModel]
    Repo[Repository]
    Cache[Local cache]
    API[Remote API]
    Work[WorkManager]

    User --> UI --> VM --> Repo
    Repo --> Cache
    Repo --> API
    API --> Repo
    Cache --> Repo
    Repo --> VM --> UI
    Work --> Repo
</div>

Business Logic 파트는 기술 이름을 외우는 구간이 아니라, 실패/지연/오프라인/재시도 상황에서 data flow를 어떻게 안정화할지 생각하는 구간이다.

## 책의 전체 구조에서 이 파트의 위치

이 구간은 View 시스템과 Compose Runtime 사이의 다리다. ViewModel과 Repository를 제대로 이해하면 Compose에서도 state hoisting과 screen state holder를 자연스럽게 이해할 수 있다.

## 장별 독해 가이드

- AppCompat/MDC: legacy compatibility와 design consistency.
- ViewBinding/DataBinding: view 참조와 data binding의 trade-off.
- LiveData/ViewModel: lifecycle-aware state propagation.
- Navigation: destination graph와 back stack 관리.
- Dagger/Hilt/Koin: 객체 생성과 dependency graph.
- Paging/Baseline Profile: 큰 list와 성능 최적화.
- WorkManager/Networking/Storage/Offline-first: real-world app의 실패 모델.

## 핵심 주장과 근거

이 파트의 핵심 주장은 다음이다.

> Android 앱의 복잡도는 UI가 아니라 상태와 데이터 흐름에서 폭발한다. Jetpack은 그 흐름을 lifecycle에 안전하게 나누기 위한 도구다.

## 실무 적용 / 생각해볼 질문

- ViewModel에 Repository를 직접 넣을지 UseCase를 둘지 어떤 기준으로 판단할 것인가?
- LiveData, StateFlow, Compose State는 어디서 경계를 나눌 것인가?
- Hilt를 쓰는 것이 Service Locator보다 나은 이유를 어떻게 설명할 것인가?
- WorkManager와 Foreground Service 중 무엇을 고를 것인가?
- offline-first에서 local DB는 cache인가 source of truth인가?

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| ViewModel은 모든 데이터를 저장하는 곳이다 | UI state holder이지 영구 저장소가 아니다 |
| Repository는 API wrapper다 | local/remote/data policy를 감추는 경계다 |
| Hilt는 boilerplate 줄이는 도구다 | dependency graph를 명시하고 테스트 가능하게 만드는 도구다 |
| WorkManager는 모든 background 작업의 답이다 | 즉시 실행/foreground/long-running 요구와 구분해야 한다 |
| Baseline Profile은 고급 최적화다 | startup 성능이 중요한 앱에서는 배포 산출물의 일부다 |

## 한 장 요약

```text
Jetpack + Business Logic = lifecycle-safe data flow

UI -> ViewModel -> UseCase -> Repository -> Data source
        ↑                                  ↓
        └──────────── UI State ────────────┘

핵심 판단:
  수명은 어디까지인가?
  source of truth는 어디인가?
  실패/오프라인/재시도는 어디서 처리하는가?
```

## 참고자료

- 원문: *Manifest Android Interview*, Category 2~3, p.188~273.
- Android Developers, Guide to app architecture: <https://developer.android.com/topic/architecture>
- Android Developers, ViewModel: <https://developer.android.com/topic/libraries/architecture/viewmodel>
- Android Developers, WorkManager: <https://developer.android.com/topic/libraries/architecture/workmanager>
- Android Developers, Baseline Profiles: <https://developer.android.com/topic/performance/baselineprofiles>
