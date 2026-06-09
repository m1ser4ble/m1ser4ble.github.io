---
layout: single
title: "Manifest Android Interview 1편: Android Framework 독해 가이드"
date: 2026-06-09 09:01:00 +0900
categories: android
excerpt: "Android Framework 파트는 앱이 OS와 맺는 계약을 설명하는 구간이다. Activity, Fragment, Service, Intent, Context, Manifest, permission, threading을 하나의 실행 모델로 묶어 읽는다."
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

- 이 구간은 원문 p.12~120, `Category 0: The Android Framework`에 해당한다.
- 핵심 질문은 "Android 앱은 OS 위에서 어떤 컴포넌트 계약으로 실행되는가?"다.
- Activity/Fragment/Service/BroadcastReceiver/ContentProvider는 API 목록이 아니라 lifecycle과 process boundary를 가진 실행 단위로 읽어야 한다.
- Intent, PendingIntent, Manifest, Context, permission, Handler/Looper는 모두 "앱이 OS와 통신하는 방법"으로 묶인다.

## 이 글이 답하려는 질문

면접에서 Android Framework 질문을 받았을 때 단순히 정의를 외우는 대신, 다음처럼 답할 수 있어야 한다.

> 이 개념은 앱 컴포넌트, OS lifecycle, process/thread, permission 모델 중 어디에 속하며, 어떤 문제를 해결하기 위해 존재하는가?

## 읽기 전에 알아야 할 것

이 파트의 질문은 넓지만 하나의 흐름으로 압축된다.

<div class="mermaid">
flowchart TD
    App[App package]
    Manifest[AndroidManifest.xml<br/>component declaration]
    Component[Activity / Service / Receiver / Provider]
    Intent[Intent / PendingIntent<br/>message and delegation]
    Lifecycle[Lifecycle callbacks]
    Thread[Main thread<br/>Looper / Handler]
    System[Android Framework services]

    App --> Manifest
    Manifest --> Component
    Intent --> Component
    Component --> Lifecycle
    Component --> Thread
    Component --> System
    System --> Component
</div>

원문 p.13 Android architecture, p.37 Activity lifecycle, p.42 Fragment lifecycle, p.53 Service lifecycle, p.94 Looper/Handler 도식을 재구성한 독해 지도다.

## 용어 사전

| 용어 | 핵심 의미 | 면접 답변 포인트 |
|------|-----------|------------------|
| Activity | 사용자가 상호작용하는 화면 단위 | 화면 lifecycle과 task/back stack을 같이 설명 |
| Fragment | Activity 안에서 독립 lifecycle을 갖는 UI 조각 | Fragment lifecycle과 View lifecycle 분리 |
| Service | UI 없이 오래 실행되는 작업 컴포넌트 | started/bound/foreground service 구분 |
| BroadcastReceiver | 시스템/앱 이벤트를 수신하는 컴포넌트 | 정적/동적 등록과 background 제한 |
| ContentProvider | 앱 간 구조화 데이터 공유 경계 | authority, URI, permission 관점 |
| Intent | 컴포넌트 실행 요청 메시지 | explicit/implicit, filter, resolution |
| PendingIntent | 다른 앱/시스템이 나중에 내 권한으로 실행하는 Intent | notification, alarm, widget에서 권한 위임 |
| Context | 리소스와 시스템 서비스 접근 핸들 | Activity Context와 Application Context 수명 차이 |
| Manifest | 앱 컴포넌트와 권한의 선언 파일 | OS가 앱을 발견하고 실행하는 계약서 |
| Bundle | component 간 작은 상태/값 전달 컨테이너 | configuration change와 process death를 구분 |
| Looper/Handler | thread-bound message loop와 작업 전달 도구 | UI thread와 background thread 통신 |

## 등장 배경과 이유

Android 앱은 단일 `main()` 함수가 전체 흐름을 통제하는 프로그램이 아니다. OS가 앱 프로세스와 컴포넌트를 필요할 때 만들고, 멈추고, 다시 살린다. 그래서 Android Framework 지식은 다음 문제에서 출발한다.

- 화면은 언제 만들어지고 언제 사라지는가?
- background 작업은 언제 허용되고 언제 제한되는가?
- 다른 앱이나 시스템은 내 앱을 어떻게 호출하는가?
- 앱 프로세스가 죽었다 살아나면 상태는 어디에서 복원되는가?
- UI thread를 막지 않으면서 시스템 이벤트를 어떻게 처리하는가?

## 역사적 기원

Android의 초기 앱 모델은 모바일 OS의 제약에서 나왔다. 메모리와 배터리가 제한된 환경에서 OS가 앱 lifecycle을 강하게 관리해야 했고, 앱은 Activity, Service, Receiver, Provider 같은 선언적 컴포넌트를 통해 OS와 협력했다.

이 구조는 Android 1.0 시절부터 이어지는 핵심 모델이다. 이후 Jetpack과 Compose가 등장했지만, Manifest, Intent, Activity lifecycle, permission, process/thread 모델은 여전히 앱 실행의 바닥이다.

## 학술적/이론적 배경

| 배경 | Android에서의 표현 |
|------|-------------------|
| Event-driven programming | Intent, BroadcastReceiver, callback lifecycle |
| State machine | Activity/Fragment/Service lifecycle |
| Capability delegation | PendingIntent |
| Message queue | Looper, Handler, MessageQueue |
| Process isolation | app sandbox, permission, ContentProvider |
| Resource management | configuration change, low memory callback, process priority |

## 연대표

| 흐름 | 의미 |
|------|------|
| Android 초기 | Activity/Intent/Manifest 중심 앱 모델 정착 |
| Fragment 도입 이후 | 큰 화면/재사용 UI 조각과 lifecycle 복잡도 증가 |
| Runtime permission 도입 | 설치 시 권한에서 사용 시점 권한으로 이동 |
| Background execution 제한 강화 | Service 남용 방지, Foreground Service/WorkManager 중요도 증가 |
| Jetpack 이후 | lifecycle-aware API가 Framework의 거친 경계를 보완 |

## 동작 메커니즘

### Activity lifecycle

<div class="mermaid">
stateDiagram-v2
    [*] --> onCreate
    onCreate --> onStart
    onStart --> onResume
    onResume --> Running
    Running --> onPause
    onPause --> onResume: focus returns
    onPause --> onStop: fully hidden
    onStop --> onRestart
    onRestart --> onStart
    onStop --> onDestroy
    onDestroy --> [*]
</div>

면접 답변에서는 callback 이름보다 "각 단계에서 무엇을 해도 되는가"가 중요하다. `onCreate`는 초기화, `onStart/onStop`은 visible resource, `onResume/onPause`는 foreground interaction, `onDestroy`는 최종 정리로 설명하면 좋다.

### Fragment lifecycle과 View lifecycle

<div class="mermaid">
flowchart TD
    FCreate[Fragment onCreate]
    VCreate[onCreateView]
    VCreated[onViewCreated]
    VDestroy[onDestroyView]
    FDestroy[Fragment onDestroy]
    Observer[LiveData / Flow observer]

    FCreate --> VCreate --> VCreated --> VDestroy --> FDestroy
    Observer -->|bind to| ViewLifecycleOwner[viewLifecycleOwner]
    ViewLifecycleOwner --> VDestroy
</div>

Fragment에서 메모리 누수가 자주 나는 이유는 Fragment 객체보다 View가 먼저 파괴되기 때문이다. View binding, observer, adapter reference는 `onDestroyView` 경계에서 정리해야 한다.

### Looper/Handler

<div class="mermaid">
flowchart LR
    Producer[Event producer]
    Handler[Handler]
    Queue[MessageQueue]
    Looper[Looper]
    Callback[Runnable / Message callback]
    Thread[Owning Thread]

    Producer --> Handler --> Queue --> Looper --> Callback --> Thread
    Callback --> Queue
</div>

Handler는 단순 delay 유틸이 아니라 특정 thread의 queue에 작업을 넣는 도구다. main thread UI 업데이트, worker thread 순차 처리, legacy async API를 설명할 때 여전히 유효한 개념이다.

## 책의 전체 구조에서 이 파트의 위치

이 파트는 뒤의 모든 장의 기반이다. View 시스템은 Activity/Window 위에 올라가고, Jetpack ViewModel은 lifecycle 문제를 완화하며, Compose도 결국 Activity의 `setContent` 안에서 시작된다.

## 장별 독해 가이드

- `What is Android?`: Android를 Linux kernel 위의 app framework로 잡는다.
- `Intent / PendingIntent`: 컴포넌트 호출과 권한 위임을 구분한다.
- `Context / Application`: 수명과 참조 보관 위험을 중심으로 읽는다.
- `Activity / Fragment / Service`: lifecycle state machine으로 묶는다.
- `Manifest / Deep Link / Task`: OS가 앱을 발견하고 진입시키는 경로로 읽는다.
- `Configuration / Bundle / ActivityManager`: 상태 복원과 프로세스 생존을 구분한다.
- `Permission / Handler / Exception / Build Variant`: 실무에서 자주 묻는 운영 경계다.

## 핵심 주장과 근거

Android Framework 파트의 핵심 주장은 다음이다.

> Android 앱 개발자는 UI 코드 작성자이기 전에 OS lifecycle과 component contract를 다루는 개발자다.

근거는 반복되는 질문의 형태에 있다. 거의 모든 질문이 "무엇인가"에서 시작하지만, 실제 답변은 "언제 호출되고, 누가 소유하며, 어떤 자원이 언제 정리되는가"로 끝난다.

## 실무 적용 / 생각해볼 질문

- Activity Context를 singleton에 넣으면 왜 위험한가?
- Fragment에서 `viewLifecycleOwner` 없이 LiveData를 observe하면 어떤 문제가 생기는가?
- Foreground Service와 WorkManager 중 무엇을 고를지 어떻게 판단할 것인가?
- Handler/Looper를 Coroutine Dispatcher와 비교하면 무엇이 달라지는가?
- Deep link는 기능이 아니라 보안/검증 문제까지 포함한다는 점을 어떻게 설명할 것인가?

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| Activity가 살아 있으면 View도 살아 있다 | Fragment에서는 특히 View lifecycle이 더 짧다 |
| Service는 background에서 자유롭게 실행된다 | 현대 Android는 background execution 제한이 강하다 |
| PendingIntent는 Intent 저장소다 | 권한 위임이 핵심이다 |
| Context는 아무거나 써도 된다 | 수명과 theme/resource scope가 다르다 |
| Handler는 오래된 API라 몰라도 된다 | main thread/event loop 개념의 원형이다 |

## 한 장 요약

```text
Android Framework = OS와 앱의 계약

Manifest: 무엇을 선언했는가
Intent: 누가 누구를 호출하는가
Lifecycle: 언제 만들고 정리하는가
Context: 어떤 환경/수명에 묶였는가
Thread: 어떤 queue에서 실행되는가
Permission: 어떤 권한으로 접근하는가
```

## 참고자료

- 원문: *Manifest Android Interview*, Category 0: The Android Framework, p.12~120.
- Android Developers, Platform architecture: <https://developer.android.com/guide/platform>
- Android Developers, App fundamentals: <https://developer.android.com/guide/components/fundamentals>
- Android Developers, Activity lifecycle: <https://developer.android.com/guide/components/activities/activity-lifecycle>
