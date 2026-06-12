---
layout: single
title: "Manifest Android Interview 3편: Jetpack과 Business Logic 독해와 답변 지도"
date: 2026-06-09 09:03:00 +0900
categories: android
excerpt: "Jetpack과 Business Logic 파트를 UI 상태, lifecycle, navigation, DI, paging, background work, network, storage, offline-first 모델로 읽고 Q49~Q66 답변 골격을 정리한다."
toc: true
toc_sticky: true
tags: [android, interview, jetpack, architecture, business-logic, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.188~273, `Category 2: Jetpack Library`와 `Category 3: Business Logic`의 독해와 답변 지도다.
- 핵심 질문은 "UI와 business/data logic을 어떻게 lifecycle-safe하게 분리하고 연결하는가?"다.
- 원문 Q49~Q66은 모두 답변 capsule로 다룬다. 이 범위에는 AppCompat, MDC, ViewBinding/DataBinding, LiveData/ViewModel, Navigation, Dagger/Hilt, Paging, Baseline Profile, WorkManager, JSON/network/storage/offline-first가 포함된다.
- 3편의 답변 공식은 `UI owner -> lifecycle-aware state -> dependency boundary -> data source -> background/sync policy`다.

## 이 글이 답하려는 질문

> Android 앱이 화면 몇 개짜리 예제를 넘어 제품이 되었을 때, 상태, 의존성, 작업, 네트워크, 저장소를 어디에 두고 어떻게 연결해야 하는가?

1편은 앱이 framework와 맺는 component/lifecycle 계약을 다뤘고, 2편은 화면이 View tree로 rendering되는 방식을 다뤘다. 3편은 그 위에 "운영 가능한 앱 구조"를 얹는다. 여기서 중요한 것은 Jetpack API 이름을 외우는 것이 아니라 책임의 위치를 구분하는 것이다.

- UI는 state를 관찰하고 event를 보낸다.
- ViewModel은 UI state와 UI event 처리의 lifecycle-aware boundary가 된다.
- Repository/data layer는 network, database, cache, paging, sync를 조합한다.
- DI는 객체 생성과 scope를 명시해 coupling을 줄인다.
- Background work는 OS 정책과 lifecycle 밖에서 안전하게 실행되어야 한다.

## 읽기 전에 알아야 할 것

Jetpack은 하나의 library가 아니라 Android 앱 구조를 안정화하기 위한 library 집합이다. AppCompat/MDC는 UI 호환성과 design component를 제공하고, ViewBinding/DataBinding은 View 접근 방식을 바꾸고, LiveData/ViewModel/Navigation/Paging/WorkManager/Room/Hilt는 state, navigation, large data, background work, storage, dependency graph를 다룬다.

<div class="mermaid">
flowchart TD
    UI["UI layer<br/>Activity, Fragment, View or Compose"]
    VM["ViewModel<br/>UI state, events"]
    UseCase["Use case<br/>business rule"]
    Repo["Repository<br/>data orchestration"]
    Local["Local data<br/>Room, DataStore, file"]
    Remote["Remote data<br/>Retrofit, HTTP API"]
    Work["Background work<br/>WorkManager"]
    DI["DI graph<br/>Hilt or Dagger"]

    UI --> VM
    VM --> UseCase
    UseCase --> Repo
    Repo --> Local
    Repo --> Remote
    Work --> Repo
    DI --> UI
    DI --> VM
    DI --> UseCase
    DI --> Repo
</div>

원문 p.188~273의 Jetpack/Business Logic 질문을 하나의 architecture map으로 재구성한 것이다.

## 용어 사전

| 용어 | 먼저 기억할 의미 | 답변할 때 붙일 관점 |
|------|------------------|----------------------|
| AppCompat | 하위 Android 버전에서도 최신 UI/API 경험을 맞추는 compatibility layer | theme, ActionBar, backward compatibility |
| MDC | Material Design component 구현체 | design system, interaction, theme |
| ViewBinding | layout XML의 View 참조를 type-safe하게 생성 | null safety, findViewById 제거 |
| DataBinding | layout과 observable data/expression을 연결 | two-way binding, build cost, readability |
| LiveData | lifecycle-aware observable data holder | active observer, ViewModel 연계 |
| ViewModel | configuration change에 살아남는 UI state holder | UI state, business boundary |
| Navigation | screen destination과 back stack을 선언/관리하는 Jetpack library | graph, Safe Args, deep link |
| Hilt/Dagger | dependency injection framework | scope, component, compile-time graph |
| Paging | 큰 data set을 page 단위 stream으로 로딩 | PagingSource, Pager, RemoteMediator |
| Baseline Profile | startup/runtime hot path를 미리 알려 성능을 높이는 profile | ART optimization, release measurement |
| WorkManager | deferrable background work scheduler | constraints, retry, persistence |
| Offline-first | local source of truth를 중심으로 network sync를 붙이는 data strategy | cache, sync, conflict resolution |

## 등장 배경과 이유

Android 앱은 화면 수가 늘어나면 Activity/Fragment 안에 모든 logic을 넣는 방식이 빠르게 무너진다. configuration change, process death, network error, offline 상태, pagination, background sync, dependency creation, testability가 동시에 문제가 된다. Jetpack은 이 문제들을 "각 책임의 위치"로 나눠 해결한다.

- ViewModel은 UI state가 Activity 재생성에 휩쓸리지 않도록 한다.
- Navigation은 화면 이동과 argument 전달을 graph로 관리한다.
- Hilt/Dagger는 객체 생성과 scope를 코드 곳곳에 흩뿌리지 않게 한다.
- Paging은 list data를 한 번에 다 올리지 않게 한다.
- WorkManager는 OS 제약 속에서 background 작업을 안정적으로 예약한다.
- Room/DataStore/network layer는 offline-first 전략의 기반이 된다.

## 역사적 기원

초기 Android 앱은 Activity/Fragment가 UI, network, database, navigation을 직접 다루는 경우가 많았다. 이후 Architecture Components가 등장하면서 ViewModel, LiveData, Room, Lifecycle이 표준적인 구조를 만들었다. 그 뒤 Navigation, Paging 3, WorkManager, Hilt, Baseline Profiles가 추가되며 Android 앱은 더 명확한 layer 구조를 갖게 되었다.

| 흐름 | 해결한 문제 | 이 글의 질문 |
|------|-------------|--------------|
| Support/AppCompat | OS 버전별 UI/API 차이 | Q49 |
| Material Components | 일관된 component와 design system | Q50 |
| ViewBinding/DataBinding | View 참조 boilerplate와 UI-data 연결 | Q51, Q52 |
| Lifecycle/ViewModel/LiveData | configuration change와 lifecycle-safe observation | Q53, Q54 |
| Navigation/Paging/WorkManager | navigation, large data, background work 표준화 | Q55, Q57, Q59 |
| Hilt/Dagger | dependency creation과 scope 관리 | Q56 |
| Offline-first architecture | network 불안정성과 data consistency | Q60~Q66 |

## 학술적/이론적 배경

- Separation of concerns: UI, state, business rule, data source를 분리해 변경 비용을 낮춘다.
- Dependency inversion: 상위 policy가 concrete implementation에 직접 의존하지 않게 한다.
- Reactive state: UI는 state stream을 관찰하고 state 변화에 반응한다.
- Source of truth: 여러 data source 중 무엇을 기준 data로 삼을지 정한다.
- Backpressure/pagination: 큰 data를 chunk로 나눠 memory와 network 부하를 제어한다.
- Durable background work: process나 화면 lifecycle과 무관하게 완료되어야 하는 작업을 scheduler에 맡긴다.

## 연대표

| 시기 | 변화 | 독해 포인트 |
|------|------|-------------|
| Support Library/AppCompat | 하위 버전 호환 UI 제공 | compatibility layer 이해 |
| Material Design 확산 | UI component와 design token 표준화 | MDC/theme/component 이해 |
| Architecture Components | Lifecycle, LiveData, ViewModel, Room | lifecycle-aware state 구조 |
| AndroidX/Jetpack | library namespace와 release train 정리 | Jetpack을 library 집합으로 이해 |
| Paging 3/WorkManager/Hilt | data loading, background, DI 표준화 | 제품 구조의 기본 block |
| Baseline Profiles | ART profile-guided optimization | 성능도 architecture 일부 |

## 동작 메커니즘

### 1. UI state는 lifecycle-aware boundary를 지나야 한다

Activity/Fragment는 화면 owner이고, ViewModel은 화면 state owner다. UI는 ViewModel의 state를 관찰하고 event를 전달한다. ViewModel은 configuration change에 살아남기 때문에 화면 재생성에도 state를 유지할 수 있다. 하지만 process death까지 자동 해결하는 것은 아니므로 SavedStateHandle, repository, persistent storage와 역할을 나눠야 한다.

<div class="mermaid">
flowchart LR
    Event["user event"]
    UI["Activity or Fragment"]
    VM["ViewModel"]
    State["UI state<br/>LiveData, Flow, StateFlow"]
    Render["render UI"]
    Saved["SavedStateHandle<br/>small restoration state"]
    Repo["Repository<br/>persistent data"]

    Event --> UI
    UI --> VM
    VM --> State
    State --> UI
    UI --> Render
    VM --> Saved
    VM --> Repo
</div>

### 2. Dependency graph는 객체 생성과 lifetime을 명시한다

Dagger/Hilt 질문은 "어떤 annotation을 외웠는가"보다 "객체를 누가 만들고, 얼마나 오래 살고, 어디에 주입되는가"를 묻는다. Hilt는 Android component lifecycle에 맞춘 predefined component와 scope를 제공해 Dagger boilerplate를 줄인다.

### 3. Data layer는 network와 local source를 조합한다

Business Logic 구간은 JSON serialization, network request, paging, image loading, local persistence, offline-first를 묻는다. 이들은 모두 repository가 data source를 조합하는 문제다. offline-first에서는 local database를 source of truth로 두고, network는 sync source로 붙이는 방식이 일반적이다.

<div class="mermaid">
flowchart TD
    UI["UI observes data"]
    VM["ViewModel"]
    Repo["Repository"]
    DB["Local DB<br/>Room or DataStore"]
    API["Remote API"]
    Worker["Sync worker<br/>WorkManager"]
    Conflict["Conflict policy"]

    UI --> VM
    VM --> Repo
    Repo --> DB
    Repo --> API
    Worker --> API
    Worker --> DB
    API --> Conflict
    DB --> UI
</div>

### 4. Background work는 화면 lifecycle에서 분리한다

long-running work는 Activity/Fragment lifecycle 안에 오래 붙잡아두면 취소, leak, 중복 실행 문제가 생긴다. 즉시 UI와 함께 끝나도 되는 작업은 ViewModel scope가 맞을 수 있지만, 네트워크 sync, upload, database maintenance처럼 지연 가능하고 완료 보장이 필요한 작업은 WorkManager가 적합하다.

## 책의 전체 구조

3편은 전통 View 시스템 다음에 놓이지만, 실제로는 View와 Compose 모두에 걸쳐 적용되는 architecture layer다. ViewBinding/DataBinding처럼 View 전용 도구도 있지만, ViewModel, DI, Paging, WorkManager, repository, offline-first는 Compose UI에서도 그대로 중요하다. 4~5편의 Compose 질문을 읽을 때도 3편의 state/data boundary를 전제해야 한다.

## 장별 독해 가이드

| 독해 묶음 | 원문 질문 | 읽는 목적 |
|-----------|-----------|-----------|
| Compatibility와 binding | Q49~Q52 | UI 호환성, design system, View 참조 방식을 이해 |
| Lifecycle-aware state | Q53~Q55, Q66 | LiveData/ViewModel/Navigation과 초기 data loading 위치를 이해 |
| DI와 performance | Q56~Q58 | dependency graph, paging, baseline profile을 이해 |
| Business/data logic | Q59~Q65 | background, JSON, network, large data, image, storage, offline-first 이해 |

## 질문별 답변 지도

### A. Compatibility, Material, Binding

#### Q49. AppCompat library란 무엇인가? (p.189)

- 한 줄 답: AppCompat은 하위 Android 버전에서도 최신 UI pattern과 compatibility 기능을 사용할 수 있게 하는 AndroidX library다.
- 핵심 근거: AppCompatActivity, compatible theme, toolbar/actionbar, vector/resource compatibility 등을 통해 OS 버전 차이를 완화한다.
- 실무 포인트: minSdk가 낮거나 legacy View UI를 유지하는 앱에서는 theme/component 호환성의 기반이다.
- 주의점: AppCompat은 architecture library가 아니라 UI/API compatibility layer다.

#### Q50. Material Design Components는 무엇인가? (p.191)

- 한 줄 답: MDC는 Material Design spec을 구현한 Android UI component library다.
- 핵심 근거: Button, TextInputLayout, Card, BottomNavigation, Material theme/color/shape/typography 등을 제공해 일관된 UI와 interaction을 만든다.
- 실무 포인트: design system을 app theme token으로 관리하고 component behavior를 표준화할 때 쓴다.
- 주의점: Material component를 쓰는 것만으로 접근성이나 UX가 자동 보장되지는 않는다. theme, contrast, state, motion을 함께 점검해야 한다.

#### Q51. ViewBinding의 장점은 무엇인가? (p.192)

- 한 줄 답: ViewBinding은 XML layout마다 binding class를 생성해 View reference를 type-safe하고 null-safe하게 접근하게 한다.
- 핵심 근거: `findViewById()` casting과 id mismatch를 줄이고, layout에 존재하는 View만 property로 노출한다.
- 실무 포인트: Activity/Fragment에서 boilerplate를 줄이되, Fragment에서는 `onDestroyView()`에 binding reference를 정리한다.
- 주의점: ViewBinding은 data observation이나 expression binding을 제공하지 않는다.

#### Q52. DataBinding은 어떻게 동작하는가? (p.198)

- 한 줄 답: DataBinding은 layout XML에 data variable과 expression을 선언하고, generated binding class가 UI와 observable data를 연결한다.
- 핵심 근거: one-way/two-way binding, binding adapter, observable field/LiveData 연계를 통해 UI 갱신 boilerplate를 줄인다.
- 실무 포인트: form UI나 XML 중심 legacy code에서 유용할 수 있지만, expression이 복잡해지면 layout이 business logic을 품게 된다.
- 주의점: build time, readability, debugging 비용이 있으므로 단순 View reference 목적이면 ViewBinding이 낫다.

### B. Lifecycle-aware state와 navigation

#### Q53. LiveData란 무엇인가? (p.200)

- 한 줄 답: LiveData는 lifecycle-aware observable data holder로, active lifecycle owner에게만 update를 전달한다.
- 핵심 근거: Activity/Fragment가 started/resumed 상태일 때 observation이 활성화되고, destroyed 상태에서는 observer가 정리된다.
- 실무 포인트: legacy Jetpack architecture에서는 ViewModel state를 UI에 전달하는 안정적인 도구다.
- 주의점: Kotlin Flow/StateFlow가 널리 쓰이는 현대 code에서도 LiveData의 lifecycle-aware 의미는 알아야 한다.

#### Q54. Jetpack ViewModel이란 무엇인가? (p.206)

- 한 줄 답: Jetpack ViewModel은 UI-related state와 event handling logic을 Activity/Fragment lifecycle보다 오래 보존하는 state holder다.
- 핵심 근거: configuration change 동안 유지되어 화면 재생성에도 state를 잃지 않고, repository/use case와 UI 사이의 boundary가 된다.
- 실무 포인트: UI state, loading/error, user event 처리, coroutine launch 위치를 ViewModel에 둔다.
- 주의점: Jetpack ViewModel은 MVVM pattern의 ViewModel과 이름이 같지만 Android lifecycle 보존 기능을 가진 framework class라는 점을 구분한다.

#### Q55. Jetpack Navigation Library란 무엇인가? (p.216)

- 한 줄 답: Navigation library는 destination, action, argument, back stack을 navigation graph로 선언하고 관리하는 Jetpack library다.
- 핵심 근거: NavController가 graph를 따라 화면 전환을 수행하고, Safe Args는 type-safe argument 전달을 돕고, deep link도 graph에 연결할 수 있다.
- 실무 포인트: 화면 흐름이 복잡할수록 back stack과 argument 전달을 명시적으로 관리하는 장점이 크다.
- 주의점: navigation graph가 business flow를 모두 해결하지는 않는다. 인증, multi back stack, deep link 진입 상태는 별도 policy가 필요하다.

#### Q66. 초기 data loading은 LaunchedEffect와 ViewModel.init 중 어디서 시작하는가? (p.267)

- 한 줄 답: 화면 state의 초기 loading은 대체로 ViewModel `init` 또는 명시적 ViewModel event에서 시작하는 편이 lifecycle과 configuration change에 안전하다.
- 핵심 근거: `LaunchedEffect`는 composition lifecycle에 묶이고, ViewModel은 screen state owner로서 재구성에 덜 흔들린다. 단, Composable에만 의미 있는 one-shot UI effect는 LaunchedEffect가 맞을 수 있다.
- 실무 포인트: "data ownership"이 ViewModel에 있으면 ViewModel에서, composition 진입에 따른 UI-only side effect면 LaunchedEffect에서 시작한다고 구분한다.
- 주의점: key가 잘못된 LaunchedEffect는 recomposition/navigation에 따라 중복 실행될 수 있다.

### C. Dependency, paging, performance

#### Q56. Dagger 2와 Hilt는 무엇인가? (p.224)

- 한 줄 답: Dagger 2는 compile-time dependency injection framework이고, Hilt는 Dagger 위에 Android component lifecycle에 맞춘 표준 component/scope를 제공하는 Jetpack DI library다.
- 핵심 근거: Dagger는 component/module/binding을 직접 구성하고, Hilt는 `@HiltAndroidApp`, `@AndroidEntryPoint`, `@InstallIn`, `@HiltViewModel` 등으로 Android boilerplate를 줄인다.
- 실무 포인트: DI의 핵심은 객체 생성 위치와 lifetime을 명시해 testability와 modularity를 높이는 것이다.
- 주의점: Koin, manual DI, service locator와 비교할 때 compile-time graph 검증, build time, runtime flexibility trade-off를 함께 말한다.

#### Q57. Jetpack Paging library란 무엇인가? (p.232)

- 한 줄 답: Paging은 큰 data set을 page 단위 stream으로 loading하고 UI에 점진적으로 전달하는 Jetpack library다.
- 핵심 근거: PagingSource가 data load 방법을 정의하고, Pager가 PagingData stream을 만들며, adapter가 item을 submit해 RecyclerView/Compose list에 표시한다.
- 실무 포인트: network+database 조합에는 RemoteMediator를 사용해 local source of truth와 remote paging을 연결한다.
- 주의점: Paging은 UI jank만 해결하는 도구가 아니라 memory, network, retry, cache policy를 함께 다루는 data pipeline이다.

#### Q58. Baseline Profile이란 무엇인가? (p.235)

- 한 줄 답: Baseline Profile은 앱의 startup과 hot path를 ART에 미리 알려 AOT 최적화를 유도하는 profile 정보다.
- 핵심 근거: profile-guided optimization을 통해 cold start, navigation, list scroll 같은 핵심 경로의 bytecode 실행 비용을 줄일 수 있다.
- 실무 포인트: Macrobenchmark로 profile을 생성하고 release build에서 성능을 측정한다.
- 주의점: debug build 성능이나 emulator 관찰만으로 Compose/View 성능 결론을 내리면 안 된다.

### D. Business logic, network, storage, offline-first

#### Q59. long-running background task는 어떻게 관리하는가? (p.238)

- 한 줄 답: 오래 걸리거나 완료 보장이 필요한 지연 가능 작업은 WorkManager로 예약하고, 즉시 사용자에게 보이는 작업은 foreground service나 UI scope와 구분한다.
- 핵심 근거: WorkManager는 constraints, retry, persistence, chaining을 제공해 process death와 reboot 상황에도 작업을 관리한다.
- 실무 포인트: sync, upload, periodic refresh, log flush처럼 UI를 떠나도 계속돼야 하는 작업에 적합하다.
- 주의점: real-time media playback이나 즉시 실행이 필요한 foreground 작업까지 WorkManager로 뭉뚱그리면 안 된다.

#### Q60. JSON format을 object로 어떻게 serialize/deserialize하는가? (p.242)

- 한 줄 답: JSON serialization은 Kotlin/Java object와 JSON payload 사이를 Moshi, Gson, kotlinx.serialization 같은 library로 변환하는 과정이다.
- 핵심 근거: Retrofit converter, data class adapter, null/default handling, field naming, custom adapter가 실제 API 연동의 핵심이다.
- 실무 포인트: API schema 변경, unknown field, nullable field, enum fallback, date format을 명확히 처리한다.
- 주의점: network DTO를 domain model로 그대로 쓰면 API 변화가 app 내부 logic에 직접 새어 들어온다.

#### Q61. network request는 어떻게 처리하는가? (p.247)

- 한 줄 답: Android network request는 Retrofit/OkHttp 같은 client, coroutine/Flow 같은 async model, repository abstraction, error/retry/cache policy로 처리한다.
- 핵심 근거: HTTP call은 main thread에서 실행하면 안 되고, timeout, interceptor, authentication, serialization, response mapping이 필요하다.
- 실무 포인트: repository는 remote DTO를 domain/result type으로 변환하고 UI에는 loading/success/error state를 전달한다.
- 주의점: "Retrofit을 쓴다"만으로는 답이 부족하다. cancellation, retry, offline, error mapping까지 말해야 한다.

#### Q62. large dataset loading에 paging이 왜 필요한가? (p.256)

- 한 줄 답: paging은 큰 data를 한 번에 메모리와 UI에 올리지 않고 필요한 chunk만 load해 memory, network, rendering 비용을 줄인다.
- 핵심 근거: RecyclerView나 Lazy list는 화면에 보이는 item 중심으로 표시하고, Paging은 data source에서 page 단위로 가져와 adapter에 전달한다.
- 실무 포인트: loading state, retry, placeholder, diffing, prefetch distance, database cache를 같이 설계한다.
- 주의점: page size만 줄이면 해결되는 것이 아니라 source of truth와 invalidation policy가 중요하다.

#### Q63. network image는 어떻게 fetch/render하는가? (p.263)

- 한 줄 답: network image는 Coil/Glide/Picasso 같은 image loading library로 fetch, decode, resize, cache, lifecycle cancel을 처리하는 것이 일반적이다.
- 핵심 근거: image loading은 HTTP, bitmap decode, memory/disk cache, placeholder/error UI, view recycling cancellation이 결합된 문제다.
- 실무 포인트: RecyclerView/Compose list에서는 request lifecycle과 size를 정확히 지정해 불필요한 decode를 줄인다.
- 주의점: 직접 Bitmap을 full decode하거나 list scroll 중 request cancel을 안 하면 OOM과 wrong image binding이 생긴다.

#### Q64. local persistence는 어떻게 처리하는가? (p.264)

- 한 줄 답: 구조화 data는 Room, key-value 설정은 DataStore, 파일성 data는 file storage처럼 data 성격에 맞춰 저장소를 고른다.
- 핵심 근거: Room은 SQLite abstraction과 compile-time query 검증을 제공하고, DataStore는 SharedPreferences 대체로 async/transaction-friendly 설정 저장에 적합하다.
- 실무 포인트: repository가 local source를 감싸고, migration, transaction, encryption, backup 정책을 함께 고려한다.
- 주의점: 민감 data를 평문 SharedPreferences나 file에 저장하면 안 된다.

#### Q65. offline-first feature는 어떻게 처리하는가? (p.266)

- 한 줄 답: offline-first는 local database를 source of truth로 두고, network는 sync를 통해 local data를 갱신하는 구조다.
- 핵심 근거: UI는 local data를 관찰하므로 network가 없어도 기존 data를 보여줄 수 있고, WorkManager나 explicit sync로 remote 변경을 반영한다.
- 실무 포인트: conflict resolution, pending write queue, sync status, retry/backoff, stale data 표시를 설계한다.
- 주의점: 단순 cache와 offline-first는 다르다. offline-first는 local write와 conflict policy까지 포함한다.

## 핵심 주장과 근거

3편의 핵심 주장은 "Android architecture는 API 선택이 아니라 책임 배치다"라는 것이다.

- AppCompat/MDC/ViewBinding/DataBinding은 UI layer의 호환성과 binding 책임을 줄인다.
- LiveData/ViewModel/Navigation은 lifecycle-safe state와 navigation 책임을 분리한다.
- Dagger/Hilt는 객체 생성과 lifetime을 graph로 명시한다.
- Paging/WorkManager/Room/network/offline-first는 data layer의 흐름과 실패 대응을 구조화한다.
- Baseline Profile은 성능 최적화도 release architecture의 일부임을 보여준다.

## 실무 적용 / 생각해볼 질문

| 상황 | 실무에서의 답변 방향 |
|------|----------------------|
| Activity가 network와 DB를 직접 호출한다 | ViewModel과 repository로 책임을 나누고 UI에는 state만 노출한다. |
| 회전할 때 API가 중복 호출된다 | ViewModel state owner와 loading idempotency를 점검하고, composition/fragment 재생성 side effect를 분리한다. |
| DI graph가 너무 복잡하다 | scope, module boundary, constructor injection, feature module ownership을 정리한다. |
| list가 느리고 memory가 크다 | PagingSource, RemoteMediator, DiffUtil, image request cancellation을 같이 본다. |
| offline 상태에서 UX가 나쁘다 | local source of truth, pending write, sync worker, conflict policy, stale indicator를 설계한다. |

## 오해하기 쉬운 부분

- ViewModel은 모든 business logic을 넣는 곳이 아니다. UI state와 use case/data layer 사이의 boundary다.
- LiveData와 Flow는 서로 대체 가능한 부분이 있지만 lifecycle 처리 방식은 다르다.
- ViewBinding과 DataBinding은 목적이 다르다. View 참조만 필요하면 ViewBinding이 단순하다.
- Hilt는 Dagger를 대체하는 완전히 별개 framework가 아니라 Dagger 기반 Android DI layer다.
- WorkManager는 모든 background 작업의 답이 아니다. 즉시성, foreground requirement, exact alarm 요구를 구분한다.
- Offline-first는 "네트워크 실패 시 cache 보여주기"보다 넓다. local write와 sync conflict까지 포함한다.
- Baseline Profile은 debug 체감 성능을 좋게 하는 도구가 아니라 release runtime 최적화 도구다.

## 한 장 요약

3편을 한 문장으로 줄이면 이렇다.

> Jetpack과 Business Logic 파트는 Android 앱을 UI code 덩어리에서 lifecycle-aware state, dependency graph, data source, background sync가 분리된 제품 구조로 바꾸는 방법을 설명한다.

암기 순서는 다음이 좋다.

1. UI binding을 구분한다: AppCompat, MDC, ViewBinding, DataBinding.
2. state owner를 잡는다: LiveData, ViewModel, Navigation, initial loading.
3. dependency graph를 잡는다: Dagger, Hilt, scope.
4. large data와 performance를 잡는다: Paging, Baseline Profile.
5. business data pipeline을 잡는다: JSON, network, image, local storage.
6. offline과 background를 잡는다: WorkManager, offline-first, conflict resolution.

## 참고자료

- 원문: Jaewoong Eum, `Manifest Android Interview: The Ultimate Guide`, Category 2~3, p.188~273.
- Android Developers, Guide to app architecture.
- Android Developers, ViewModel.
- Android Developers, Hilt.
- Android Developers, Paging.
- Android Developers, WorkManager.
- Android Developers, Offline-first.
