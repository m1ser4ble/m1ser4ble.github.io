---
layout: single
title: "Manifest Android Interview 1편: Android Framework 답변 지도"
date: 2026-06-09 09:01:00 +0900
categories: android
excerpt: "Android Framework 파트의 33개 면접 질문을 원문 순서대로 따라가며, 각 질문에 대한 답변 골격과 주의점을 정리한다."
toc: true
toc_sticky: true
tags: [android, interview, framework, lifecycle, intent, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.12~120, `Category 0: The Android Framework`의 **답변 지도**다.
- 이전 글처럼 "무엇을 물어봐야 하는가"만 남기면 이 책의 Q&A 기능이 사라진다. 그래서 이번 버전은 원문 numbered question 33개를 전부 답변 capsule로 정리한다.
- 답변 capsule은 원문을 베끼지 않고, 면접에서 말해야 할 핵심만 재구성한다.
- Android Framework 답변의 공통 패턴은 `정의 -> OS와의 계약 -> lifecycle/thread/process/resource 제약 -> 실무 주의점`이다.

## 이 글이 답하려는 질문

> Android Framework 면접 질문을 받았을 때, 각 개념을 어떤 한 줄 답과 근거로 설명해야 하는가?

이 파트는 Android를 "API 목록"으로 외우게 만드는 구간이 아니다. 원문은 질문마다 정의, 동작 방식, 사용 사례, summary, practical question을 제공한다. 따라서 독해 목표도 단순하다.

- 질문을 들으면 어떤 Android 계층의 문제인지 분류한다.
- 한 줄 답으로 개념의 목적을 먼저 말한다.
- lifecycle, process, permission, thread, resource 관점의 근거를 붙인다.
- 마지막에 실무에서의 함정이나 선택 기준을 덧붙인다.

## 읽기 전에 알아야 할 것

Android 앱은 OS가 lifecycle과 process를 강하게 관리하는 event-driven 프로그램이다. 앱은 `main()`에서 시작해 모든 흐름을 직접 통제하지 않는다. Manifest에 컴포넌트를 선언하고, Intent로 진입하고, Activity/Fragment/Service lifecycle 안에서 UI와 작업을 처리한다.

<div class="mermaid">
flowchart TD
    App[App package]
    Manifest[AndroidManifest.xml]
    Component[Activity / Service / Receiver / Provider]
    Intent[Intent / PendingIntent]
    Lifecycle[Lifecycle callback]
    Thread[Main thread / Looper / Handler]
    Resource[Permission / file / memory / process]
    System[Android Framework services]

    App --> Manifest
    Manifest --> Component
    Intent --> Component
    Component --> Lifecycle
    Component --> Thread
    Component --> Resource
    System --> Component
    Resource --> System
</div>

원문 p.13, p.37, p.42, p.53, p.94의 도식들을 하나의 답변 지도로 재구성한 것이다.

## 용어 사전

| 용어 | 한 줄 의미 | 답변할 때 붙일 관점 |
|------|------------|--------------------|
| Android Framework | 앱이 OS 기능을 사용하는 API와 실행 계약 | Linux kernel, ART, system service, app component |
| Activity | 사용자가 상호작용하는 화면 단위 | lifecycle, task, back stack, configuration change |
| Fragment | Activity 안의 재사용 가능한 UI/lifecycle 단위 | Fragment lifecycle과 View lifecycle 분리 |
| Service | UI 없이 작업을 수행하는 component | started, bound, foreground, background 제한 |
| BroadcastReceiver | system/app broadcast에 반응하는 component | manifest 등록, runtime 등록, background 제한 |
| ContentProvider | 구조화 데이터를 URI로 공유하는 component | authority, URI, ContentResolver, permission |
| Intent | 작업 요청과 component 통신을 표현하는 message object | explicit, implicit, action, data, category |
| PendingIntent | 다른 앱/시스템이 나중에 내 권한으로 실행하는 Intent wrapper | notification, alarm, immutable flag |
| Context | resource, system service, app environment 접근 핸들 | Application Context와 Activity Context 수명 차이 |
| Bundle | 작은 key-value 상태 전달/복원 컨테이너 | Intent extra, Fragment arguments, saved state |
| Looper/Handler | thread별 message queue와 작업 전달 도구 | main thread, worker thread, HandlerThread |
| ART/Dalvik/Dex | Android 앱 bytecode 실행/컴파일 환경 | AOT, JIT, DEX 변환, startup/runtime trade-off |

## 등장 배경과 이유

Android Framework 질문은 대부분 모바일 OS의 제약에서 나온다. 모바일 기기는 메모리, 배터리, 화면 전환, 프로세스 생존, 권한 모델이 강하게 제한된다. 그래서 Android 앱은 다음 질문을 계속 받는다.

- 누가 component를 만들고 호출하는가?
- 화면과 View는 언제 살아 있고 언제 정리되는가?
- 프로세스가 죽거나 configuration이 바뀌면 상태는 어디에 남는가?
- UI thread를 막지 않으면서 작업을 어떻게 처리하는가?
- 앱 간 데이터 공유와 권한 위임을 어떻게 안전하게 다루는가?

원문의 각 Q&A는 이 문제들을 API 이름별로 나눈 것이다.

## 역사적 기원

Android 1.0 시절부터 Activity, Intent, Service, BroadcastReceiver, ContentProvider, Manifest는 앱 실행 모델의 중심이었다. 이후 Fragment, runtime permission, background execution limit, Jetpack ViewModel, App Bundle, R8 같은 도구가 추가되었지만, 면접에서 여전히 묻는 기본 질문은 같다.

| 흐름 | 면접에서 남는 질문 |
|------|-------------------|
| 초기 Android component model | 앱이 OS와 어떤 계약으로 실행되는가 |
| Fragment와 다양한 form factor | UI 조각과 View lifecycle을 어떻게 관리하는가 |
| Android 6 runtime permission | 민감 권한을 언제, 왜, 어떻게 요청하는가 |
| background 제한 강화 | Service, WorkManager, foreground service를 어떻게 구분하는가 |
| ART, AAB, R8 | runtime/build/distribution 최적화를 어떻게 설명하는가 |

## 학술적/이론적 배경

| 배경 | Android에서의 표현 | 답변 포인트 |
|------|-------------------|-------------|
| Event-driven architecture | Intent, BroadcastReceiver, lifecycle callback | 호출자는 내 코드가 아니라 OS일 수 있다 |
| State machine | Activity/Fragment/Service lifecycle | 현재 state에서 허용되는 작업을 말해야 한다 |
| Capability delegation | PendingIntent, permission | 권한을 위임하거나 제한하는 방식이 핵심이다 |
| Message queue | Looper, Handler, HandlerThread | thread는 queue를 통해 순차적으로 작업을 처리한다 |
| Process isolation | UID, sandbox, process priority | 보안과 메모리 회수의 기본 단위다 |
| Serialization | Bundle, Parcelable, Serializable | component boundary를 넘기 위한 데이터 flattening이다 |
| Build-time optimization | R8, build variant, AAB | 앱 크기와 배포 산출물도 성능의 일부다 |

## 연대표

| 시기 | 변화 | 이 파트에서 연결되는 질문 |
|------|------|--------------------------|
| 2008 | Android 앱 component model 정착 | Android, Intent, Activity, Manifest |
| Android 3.x~4.x | Fragment와 다양한 화면 대응 확대 | Fragment lifecycle, configuration changes |
| Android 4.4~5.0 | ART 도입과 Dalvik 대체 | ART, Dalvik, Dex |
| Android 6.0 | runtime permission 도입 | runtime permission |
| Android 8.0 이후 | background execution 제한 강화 | Service, BroadcastReceiver, WorkManager 선택 |
| Android App Bundle 시대 | device-specific delivery 강화 | APK vs AAB, app size |
| 현대 Android Gradle Plugin | R8 기본화 | shrinking, optimization, obfuscation |

## 동작 메커니즘

### Component entry

<div class="mermaid">
flowchart LR
    Manifest[Manifest declaration]
    Intent[Intent or system event]
    Resolver[System resolver]
    Component[Activity / Service / Receiver / Provider]
    Lifecycle[Lifecycle callbacks]
    Work[UI / data / background work]

    Manifest --> Resolver
    Intent --> Resolver
    Resolver --> Component
    Component --> Lifecycle
    Lifecycle --> Work
</div>

Manifest는 OS가 앱 component를 발견하게 해주는 선언이고, Intent는 실행 요청이다. explicit Intent는 대상 component를 직접 지정하고, implicit Intent는 action/data/category를 보고 시스템이 대상 component를 찾는다.

### Lifecycle boundary

<div class="mermaid">
stateDiagram-v2
    [*] --> Created: onCreate
    Created --> Started: onStart
    Started --> Resumed: onResume
    Resumed --> Paused: onPause
    Paused --> Resumed: focus returns
    Paused --> Stopped: fully hidden
    Stopped --> Started: onRestart
    Stopped --> Destroyed: onDestroy
    Destroyed --> [*]
</div>

Activity 답변은 callback 이름을 외우는 데서 끝나면 약하다. `visible resource`는 `onStart/onStop`, foreground interaction은 `onResume/onPause`, 최종 정리는 `onDestroy`, 임시 UI 상태 복원은 `onSaveInstanceState`와 ViewModel로 나눠 설명해야 한다.

### Thread and process

<div class="mermaid">
flowchart TD
    Process[App process]
    Main[Main thread]
    Queue[MessageQueue]
    Looper[Looper]
    Handler[Handler]
    UI[UI work]
    Worker[Worker thread / HandlerThread]
    Background[IO / CPU / scheduled work]

    Process --> Main
    Main --> Queue --> Looper --> UI
    Handler --> Queue
    Process --> Worker --> Background
</div>

Android의 UI는 main thread 중심이다. ANR, Handler, HandlerThread, WorkManager, process priority 질문은 모두 이 모델에서 이어진다.

## 책의 전체 구조에서 이 파트의 위치

1편은 뒤의 View, Jetpack, Business Logic, Compose 파트를 받치는 바닥 지식이다. View는 Activity/Window 위에서 돌고, Jetpack ViewModel은 configuration change 문제를 완화하며, Compose도 결국 Activity와 lifecycle 위에서 시작된다. 따라서 이 파트를 건너뛰면 뒷부분의 API가 왜 필요한지 설명하기 어렵다.

## 장별 독해 가이드

원문 순서를 유지하되, 1회독에서는 다음 묶음으로 읽으면 답변 구조가 보인다.

| 묶음 | 원문 질문 | 읽는 목적 |
|------|-----------|-----------|
| 플랫폼 구조 | Q0, Q28, Q32 | Android가 어떤 runtime/process 위에서 앱을 실행하는지 이해 |
| component 계약 | Q1, Q2, Q5, Q6, Q9, Q10, Q11 | OS가 앱 component를 발견하고 호출하는 방식 이해 |
| UI lifecycle/state | Q7, Q8, Q12, Q17, Q18, Q19 | 화면, View, 상태 복원, 데이터 전달 경계 이해 |
| resource/permission/storage | Q4, Q13, Q22, Q26, Q27 | Context, memory, permission, accessibility, file system 이해 |
| threading/performance/build | Q14, Q20, Q21, Q23, Q24, Q25, Q29, Q30, Q31 | ANR, diagnostics, optimization, distribution 설명 |
| navigation | Q15, Q16 | deep link, task, back stack 설명 |

## 질문별 답변 지도

아래 표는 원문 numbered question 33개를 모두 포함한다. `한 줄 답`은 면접에서 첫 문장으로 말할 수 있는 수준이고, `핵심 근거`는 그 뒤에 붙일 설명이다.

| No | 원문 질문 | 한 줄 답 | 핵심 근거 | 주의점 | 원문 |
|----|-----------|----------|-----------|--------|------|
| 0 | What is Android? | Android는 Linux kernel 기반의 open-source mobile OS이자 app framework다. | Linux kernel, HAL, ART, native libraries, framework API, apps 계층으로 구성된다. SDK와 Android Studio로 Java/Kotlin 앱을 만든다. | 단순 OS라고만 답하지 말고 layered architecture와 app framework를 같이 말한다. | p.12 |
| 1 | What is Intent? | Intent는 component 간 작업 요청을 표현하는 messaging object다. | Activity 시작, Service 시작, broadcast 전송, data 전달에 쓰인다. explicit은 대상 component를 직접 지정하고, implicit은 action/data/category로 system resolver가 대상을 찾는다. | implicit Intent는 처리 앱이 없거나 여러 개일 수 있으므로 resolver/chooser 상황을 설명한다. | p.15 |
| 2 | What is PendingIntent? | PendingIntent는 다른 앱이나 system service가 나중에 내 앱 권한으로 Intent를 실행하게 하는 wrapper다. | notification tap, alarm, widget처럼 앱 lifecycle 밖에서 실행될 작업에 쓰인다. Activity, Service, Broadcast 형태로 만들 수 있다. | Android 12 이후 immutable/mutable flag를 명확히 지정해야 하고, 기본은 `FLAG_IMMUTABLE`을 선호한다. | p.17 |
| 3 | Serializable vs Parcelable | 둘 다 component 간 데이터 전달용 serialization이지만, Android에서는 Parcelable이 성능상 유리하다. | Serializable은 Java 표준이고 reflection 기반이라 느리고 garbage가 많다. Parcelable은 Android IPC에 맞게 flattening을 직접/컴파일러가 처리한다. | Parcelable은 persistent storage 포맷이 아니라 component/IPC 전달용으로 이해한다. | p.19 |
| 4 | What is Context? | Context는 resource, system service, app environment에 접근하는 핸들이다. | Application Context는 app lifetime에 묶이고, Activity Context는 UI theme/window/lifecycle에 묶인다. layout inflate, Toast, resource, service 접근에 사용된다. | Activity Context를 singleton이나 long-lived object에 보관하면 memory leak이 난다. | p.23 |
| 5 | What is Application class? | Application class는 app process 전체의 전역 초기화와 상태를 담당하는 base class다. | process 생성 시 먼저 초기화되고, dependency, analytics, library setup처럼 app-wide resource 준비에 쓴다. Manifest에 custom Application을 등록한다. | 무거운 작업을 `onCreate`에 몰아 startup을 늦추면 안 된다. UI lifecycle과도 다르다. | p.31 |
| 6 | AndroidManifest purpose | Manifest는 OS가 앱의 component, permission, feature, metadata를 알 수 있게 하는 선언 파일이다. | Activity, Service, Receiver, Provider 등록, permission 선언, intent filter, min/target SDK, theme 등을 담는다. | component가 Manifest에 없으면 system이 진입할 수 없는 경우가 있다. exported component는 보안 검토가 필요하다. | p.34 |
| 7 | Activity lifecycle | Activity lifecycle은 화면 component가 생성, 표시, foreground, background, 종료로 이동하는 state machine이다. | `onCreate`, `onStart`, `onResume`, `onPause`, `onStop`, `onDestroy`, `onRestart` 단계마다 resource 처리 위치가 다르다. | `onPause`는 짧고 빠르게 처리한다. 무거운 저장/정리는 lifecycle 단계별 책임을 나눠야 한다. | p.36 |
| 8 | Fragment lifecycle | Fragment는 Activity와 별도 lifecycle을 가지며, 특히 Fragment instance와 Fragment View lifecycle이 분리된다. | `onAttach`, `onCreate`, `onCreateView`, `onViewCreated`, `onDestroyView`, `onDestroy` 흐름을 가진다. View 관련 observer/binding은 View lifecycle에 묶는다. | `viewLifecycleOwner` 없이 observe하거나 binding을 늦게 정리하면 leak과 crash가 난다. | p.41 |
| 9 | What is Service? | Service는 UI 없이 long-running work를 수행하는 app component다. | started service는 명시적으로 stop될 때까지 작업하고, bound service는 client와 연결되어 상호작용한다. foreground service는 사용자에게 notification을 보여주며 중요 작업을 수행한다. | 현대 Android에서는 background 제한이 강하므로 WorkManager/foreground service 선택 기준을 말해야 한다. | p.47 |
| 10 | BroadcastReceiver | BroadcastReceiver는 system 또는 app broadcast event를 수신해 짧은 작업을 수행하는 component다. | system broadcast, custom broadcast를 받을 수 있고, manifest 등록 또는 runtime 등록이 가능하다. | 오래 실행되는 작업을 receiver에서 직접 하지 말고 work를 위임한다. background broadcast 제한도 언급한다. | p.56 |
| 11 | ContentProvider | ContentProvider는 URI 기반으로 구조화 데이터를 안전하게 공유하는 component다. | authority와 path로 data endpoint를 노출하고, ContentResolver가 query/insert/update/delete를 호출한다. permission으로 접근을 통제할 수 있다. | DB 구조를 직접 노출하는 것이 아니라 data access boundary를 제공한다고 설명한다. | p.59 |
| 12 | Configuration changes | configuration change는 Activity recreation을 유발할 수 있으므로 UI 상태와 data 상태를 분리해 보존해야 한다. | 기본 동작은 destroy/recreate다. `onSaveInstanceState`는 transient UI state, ViewModel은 UI-related data, persistent data는 storage가 맡는다. | `android:configChanges`로 recreation을 막는 것은 제한적으로만 쓴다. resource 갱신 책임이 앱으로 넘어온다. | p.64 |
| 13 | Memory management and leaks | Android는 GC와 process management로 memory를 관리하지만, lifecycle을 넘는 reference가 leak을 만든다. | ART/Dalvik runtime이 unreachable object를 회수하고, low memory 상황에서는 background process를 종료한다. leak 원인은 static reference, Context 보관, listener 미해제 등이다. | GC가 있다고 memory leak이 없는 것은 아니다. 참조가 남아 있으면 회수되지 않는다. | p.66 |
| 14 | ANR causes/prevention | ANR은 main thread가 오래 막혀 input, broadcast, service 처리 시간 제한을 넘을 때 발생한다. | network, DB, file IO, heavy computation을 main thread에서 수행하면 위험하다. coroutine, executor, WorkManager, profiling으로 대응한다. | "background thread를 쓰면 끝"이 아니라 cancellation, timeout, trace 분석까지 말하면 좋다. | p.68 |
| 15 | Deep links | Deep link는 외부 URL/intent에서 앱의 특정 화면으로 진입시키는 navigation contract다. | Manifest intent filter로 scheme/host/path를 선언하고, Activity에서 incoming Intent의 data를 파싱해 destination으로 이동한다. adb로 테스트할 수 있다. | App Links와 일반 deep link, 검증된 domain, 잘못된 parameter 처리와 보안을 구분한다. | p.69 |
| 16 | Tasks and back stack | Task는 사용자가 목표를 수행하는 Activity 묶음이고, back stack은 Activity navigation history다. | Activity launch 시 stack에 push되고 back 시 pop된다. launch mode와 intent flag가 task/back stack 동작을 바꾼다. | `singleTask`, `singleTop`, `singleInstance`는 UX와 deep link 동작에 영향을 주므로 남용하지 않는다. | p.72 |
| 17 | Bundle purpose | Bundle은 component 간 작은 key-value data 전달과 transient state 저장에 쓰는 container다. | Intent extras, Fragment arguments, `onSaveInstanceState`에서 사용된다. OS가 serialize 가능한 형태로 관리한다. | 큰 객체나 장기 data 저장소로 쓰면 안 된다. size limit과 serialization 비용을 고려한다. | p.74 |
| 18 | Passing data between Activities/Fragments | Activity 간에는 Intent extras, Fragment 간에는 arguments, shared ViewModel, Fragment Result API, Navigation Safe Args를 상황에 맞게 쓴다. | 일회성 navigation data는 Bundle/arguments, 같은 Activity 안 Fragment 공유 상태는 shared ViewModel, type-safe navigation은 Safe Args가 적합하다. | Fragment끼리 직접 reference로 통신하면 coupling과 lifecycle 문제가 생긴다. | p.77 |
| 19 | Activity during configuration changes | configuration change가 발생하면 Activity가 destroy/recreate되어 새 configuration resource를 반영한다. | `onPause`, `onStop`, `onDestroy` 후 `onCreate`로 재생성된다. state는 saved instance state, ViewModel, persistent storage로 나눠 복원한다. | configuration change와 process death를 같은 문제로 답하면 안 된다. ViewModel은 process death를 보장하지 않는다. | p.84 |
| 20 | ActivityManager | ActivityManager는 task, process, memory 상태 같은 system-level 정보를 제공하는 Android system service다. | running process/task 정보, memory info, debugging/diagnostics에 쓸 수 있다. low memory 상황을 감지해 app behavior를 조정할 수 있다. | 최신 Android에서는 privacy/background 제한 때문에 과거처럼 모든 process 정보를 자유롭게 얻는 모델이 아니다. | p.86 |
| 21 | SparseArray advantages | SparseArray는 int key에 최적화된 Android collection으로, 작은/중간 규모 mapping에서 memory overhead를 줄인다. | `HashMap<Integer, T>`의 boxing과 entry object overhead를 피한다. integer key만 쓰며 null key는 없다. | 매우 큰 dataset이나 일반 Map API가 필요한 경우에는 HashMap이 더 적합할 수 있다. | p.89 |
| 22 | Runtime permissions | runtime permission은 민감 권한을 설치 시점이 아니라 기능 사용 시점에 요청하는 privacy model이다. | Manifest에 선언하고, 실행 중 grant 여부를 확인하며, 필요할 때 rationale과 함께 요청한다. denial과 "don't ask again"도 UX로 처리한다. | 권한은 기능 맥락에서 요청해야 한다. 앱 시작 시 한꺼번에 요청하면 신뢰와 승인율이 떨어진다. | p.91 |
| 23 | Looper, Handler, HandlerThread | Looper는 thread의 message loop, Handler는 queue에 작업을 넣는 API, HandlerThread는 Looper를 가진 worker thread다. | main thread는 기본 Looper를 갖는다. worker thread는 `Looper.prepare`/`loop`가 필요하고, HandlerThread는 이를 쉽게 만든다. | Handler는 단순 delay 도구가 아니라 thread-affinity와 message queue를 설명하는 핵심 개념이다. | p.94 |
| 24 | Exception tracing | Android exception 추적은 development의 Logcat/stack trace와 production의 crash reporting을 나눠 접근한다. | Logcat은 crash type, message, call stack, line을 보여준다. try-catch는 복구 가능한 경계에 쓰고, Crashlytics 같은 도구는 production crash context를 수집한다. | 예외를 무조건 catch해서 삼키면 원인 추적이 어려워진다. logging과 user impact를 같이 고려한다. | p.97 |
| 25 | Build variants and flavors | build variant는 build type과 product flavor 조합으로 만들어지는 앱 산출물 구성이다. | debug/release 같은 build type과 free/paid/dev/prod 같은 flavor를 조합해 다른 app id, resource, endpoint, signing을 관리한다. | flavor는 제품/환경 차이 관리 도구이고, runtime feature flag와 역할이 다르다. | p.100 |
| 26 | Accessibility | accessibility는 TalkBack, dynamic font, focus navigation, contrast 등을 통해 더 많은 사용자가 앱을 사용할 수 있게 하는 품질 요구다. | content description, `sp` text size, focus order, touch target, semantic labels, accessibility scanner를 활용한다. | decorative image에는 description을 넣지 않는 등 "많이 넣는 것"보다 의미를 정확히 드러내는 것이 중요하다. | p.102 |
| 27 | Android file system | Android file system은 Linux 기반 storage 구조 위에 app sandbox와 shared storage 정책을 적용한 저장 모델이다. | `/system`, `/data`, cache, external/shared storage가 역할을 나눈다. app private data는 UID/sandbox로 보호된다. | scoped storage 이후 shared storage 접근은 권한과 API 정책을 함께 고려해야 한다. | p.105 |
| 28 | ART, Dalvik, Dex Compiler | Android 앱은 JVM bytecode를 DEX로 바꾸고 ART/Dalvik runtime에서 실행한다. 현대 Android는 ART가 중심이다. | Dalvik은 과거 JIT 중심 VM이고, ART는 AOT/JIT와 개선된 GC/profiling으로 성능을 높인다. Dex compiler는 class bytecode를 Android runtime 형식으로 변환한다. | "ART는 무조건 AOT만 한다"처럼 단순화하지 말고 현대 ART의 profile-guided/JIT 조합을 염두에 둔다. | p.107 |
| 29 | APK vs AAB | APK는 install 가능한 완성 package이고, AAB는 Google Play가 device-specific APK를 생성하기 위한 publishing format이다. | APK는 모든 resource/config를 포함하기 쉬워 커질 수 있다. AAB는 language, density, ABI, dynamic feature delivery를 최적화한다. | AAB는 사용자가 직접 설치하는 파일이 아니라 배포 입력물에 가깝다. sideload에는 APK가 필요하다. | p.109 |
| 30 | R8 optimization | R8은 Android build에서 code shrinking, optimization, obfuscation, resource shrinking을 수행하는 도구다. | unused code 제거, method inlining, class/member renaming, ProGuard rule 처리로 size와 reverse engineering resistance를 개선한다. | reflection, serialization, DI, JNI, keep rule이 필요한 코드를 잘못 줄이면 runtime crash가 난다. | p.111 |
| 31 | Reducing application size | 앱 크기는 resource, code, native library, asset, delivery 전략을 함께 줄여야 한다. | unused resource 제거, `shrinkResources`, R8, image compression/WebP, vector drawable, language/resource split, dynamic feature를 사용한다. | 무조건 압축만 하면 품질이나 startup이 나빠질 수 있다. measurement와 trade-off가 필요하다. | p.113 |
| 32 | Android process management | Android process는 app component가 실행되는 격리된 execution environment이며, OS가 priority와 memory pressure에 따라 관리한다. | 기본적으로 같은 app component는 같은 process/main thread에서 실행된다. UID sandbox, ART instance, process priority, low-memory killer가 관여한다. | multi-process는 isolation 이점이 있지만 IPC 비용, state sync, debugging 복잡도가 커진다. | p.117 |

## 핵심 주장과 근거

Android Framework 파트의 핵심 주장은 다음이다.

> Android 앱 개발자는 UI 코드 작성자이기 전에 OS lifecycle, component contract, process/thread/resource boundary를 다루는 개발자다.

근거는 질문 분포에서 보인다. 33개 질문 중 상당수가 "무엇인가"로 시작하지만, 답은 대부분 "누가 호출하는가", "언제 살아 있는가", "어떤 thread/process에서 실행되는가", "어떤 data를 어디까지 전달할 수 있는가", "어떤 resource를 언제 정리해야 하는가"로 끝난다.

## 실무 적용 / 생각해볼 질문

여기서는 질문만 던지지 않고, 기대 답변의 골격까지 같이 적는다.

| 상황 | 기대 답변 |
|------|-----------|
| Activity Context를 singleton에 넣었다 | Activity 수명보다 singleton이 오래 살아서 Activity와 View tree가 GC되지 않을 수 있다. Application Context로 충분한 작업인지 재검토한다. |
| Fragment에서 binding을 `onDestroy`에 정리했다 | Fragment View는 `onDestroyView`에서 사라질 수 있으므로 View binding과 View-bound observer는 `onDestroyView`에서 정리한다. |
| notification tap으로 특정 화면을 열어야 한다 | PendingIntent로 Activity Intent를 감싸고 immutable flag와 back stack UX를 함께 설계한다. |
| 화면 회전 후 입력값이 사라진다 | transient UI state는 saved instance state, screen data는 ViewModel, 장기 data는 persistent storage로 분리한다. |
| 리스트에 int key mapping이 많다 | 작은/중간 규모 Android collection에서는 SparseArray가 boxing overhead를 줄일 수 있지만, 일반 Map API와 대규모 성능 요구는 별도 측정한다. |
| APK 크기가 너무 크다 | R8, resource shrink, image format, language/density split, AAB, dynamic feature를 측정 기반으로 적용한다. |

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| Intent는 화면 전환 API다 | 화면 전환뿐 아니라 service, broadcast, data/action 전달을 포함하는 component messaging model이다 |
| PendingIntent는 Intent를 저장해두는 객체다 | 핵심은 나중에 다른 주체가 내 권한으로 실행할 수 있는 delegation이다 |
| Activity와 Fragment lifecycle은 비슷하니 같은 방식으로 observer를 붙이면 된다 | Fragment는 View lifecycle이 따로 있어서 `viewLifecycleOwner`가 중요하다 |
| Service는 background에서 자유롭게 오래 실행된다 | 현대 Android는 background 제한이 강하고 foreground service/WorkManager 선택이 필요하다 |
| Bundle은 아무 data나 담아 넘기는 편한 map이다 | 작고 serialize 가능한 transient data용이다. 큰 객체나 영속 data 저장소가 아니다 |
| ViewModel은 모든 state 복원을 해결한다 | configuration change에는 강하지만 process death 복원은 SavedStateHandle이나 persistent storage를 함께 봐야 한다 |
| Handler는 deprecated된 옛 API라 몰라도 된다 | Android main thread와 message queue 모델을 설명하는 핵심 개념이다 |
| R8은 obfuscation 도구다 | shrinking, optimization, obfuscation, resource 처리까지 포함하는 build optimization 도구다 |

## 한 장 요약

```text
Android Framework 답변 공식

1. 정의
   이 API/component가 무엇인가?

2. OS와의 계약
   Manifest, Intent, permission, process, lifecycle 중 어디에 걸리는가?

3. 동작 경계
   언제 생성되고, 어느 thread/process에서 실행되고, 누가 소유하는가?

4. 실무 주의점
   memory leak, ANR, permission UX, background limit, state loss를 어떻게 피하는가?

5. 선택 기준
   Intent vs PendingIntent
   Service vs WorkManager
   Bundle vs ViewModel vs storage
   APK vs AAB
   Serializable vs Parcelable
```

## 참고자료

- 원문: *Manifest Android Interview*, Category 0: The Android Framework, p.12~120.
- Android Developers, Platform architecture: <https://developer.android.com/guide/platform>
- Android Developers, App fundamentals: <https://developer.android.com/guide/components/fundamentals>
- Android Developers, Activity lifecycle: <https://developer.android.com/guide/components/activities/activity-lifecycle>
- Android Developers, Intents and intent filters: <https://developer.android.com/guide/components/intents-filters>
- Android Developers, Processes and app lifecycle: <https://developer.android.com/guide/components/activities/process-lifecycle>
