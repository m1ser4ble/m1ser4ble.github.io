---
layout: single
title: "Manifest Android Interview 1편: Android Framework 독해와 답변 지도"
date: 2026-06-09 09:01:00 +0900
categories: android
excerpt: "Android Framework 파트를 플랫폼, 컴포넌트, 생명주기, 스레딩, 리소스와 빌드 모델로 읽고 33개 질문의 답변 골격까지 정리한다."
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

- 이 글은 원문 p.12~120, `Category 0: The Android Framework`를 사람이 먼저 이해할 수 있도록 다시 배열한 독해 지도다.
- 원문의 질문 순서는 유지하되, 질문을 바로 외우지 않는다. 먼저 Android Framework를 `플랫폼 구조`, `컴포넌트 진입`, `상태와 생명주기`, `스레드와 프로세스`, `리소스/보안/빌드`라는 다섯 모델로 이해한다.
- 원문 numbered question 33개는 모두 답변 capsule로 다룬다. Practical question은 별도 질문 목록으로 방치하지 않고 각 답변의 `면접 포인트`와 `주의점`에 흡수했다.
- Android Framework 면접 답변의 공통 형식은 `정의 -> OS와의 계약 -> lifecycle/thread/process/resource 제약 -> 실무에서의 선택 기준`이다.

## 이 글이 답하려는 질문

> Android Framework 질문을 받았을 때, 개념을 외운 티가 아니라 Android가 앱을 어떻게 실행하고 통제하는지 이해한 사람처럼 설명하려면 무엇을 말해야 하는가?

원문은 Android Framework를 API 사전처럼 나열하지 않는다. 각 질문은 "무엇인가?"로 시작하지만 실제 답은 대부분 다음 구조로 끝난다.

- 누가 이 객체나 컴포넌트를 만든다: 앱 코드인가, framework인가, system service인가.
- 언제 살아 있고 언제 사라진다: Activity, Fragment, Service, process, Context의 수명 경계가 무엇인가.
- 어떤 thread에서 실행된다: main thread, Looper, Handler, Binder callback, background 작업의 경계가 무엇인가.
- 어떤 데이터를 어디까지 넘길 수 있다: Intent extra, Bundle, Parcelable, ContentProvider, file, permission의 경계가 무엇인가.
- 무엇을 잘못하면 장애가 되는가: ANR, memory leak, lost state, wrong Context, exported component, oversized APK 같은 실패 패턴이 무엇인가.

따라서 이 글의 목표는 질문을 더 많이 만드는 것이 아니다. 질문이 가리키는 메커니즘을 먼저 설명하고, 그 뒤에 면접에서 바로 말할 수 있는 답변 골격을 붙이는 것이다.

## 읽기 전에 알아야 할 것

Android 앱은 `main()`에서 시작해 개발자가 모든 흐름을 직접 끌고 가는 프로그램이 아니다. 앱은 OS가 관리하는 component 집합이고, 각 component는 framework가 정한 진입점과 lifecycle 안에서 호출된다. 이 차이를 잡지 못하면 Intent, Activity, Service, BroadcastReceiver, ContentProvider, Context, Bundle, Handler가 전부 별개의 암기 항목처럼 보인다.

첫 번째 mental model은 이것이다.

<div class="mermaid">
flowchart TD
    Kernel["Linux Kernel<br/>process, memory, drivers"]
    HAL["HAL<br/>hardware abstraction"]
    ART["ART<br/>DEX, AOT/JIT, GC"]
    Native["Native libraries<br/>SQLite, SSL, media"]
    Framework["Application Framework<br/>ActivityManager, PackageManager, WindowManager"]
    App["App components<br/>Activity, Service, Receiver, Provider"]
    State["State boundaries<br/>Bundle, ViewModel, storage"]
    Thread["Threading model<br/>main thread, Looper, Handler"]

    Kernel --> HAL
    Kernel --> ART
    Kernel --> Native
    HAL --> Framework
    ART --> Framework
    Native --> Framework
    Framework --> App
    App --> State
    App --> Thread
</div>

원문 p.12~14의 플랫폼 설명, p.36~42의 Activity/Fragment lifecycle, p.47~59의 component 설명, p.94~120의 runtime/process 설명을 하나의 독해 모델로 재구성한 것이다. 핵심은 "앱이 OS 위에서 돈다"가 아니라 "앱의 화면, 작업, 데이터, 권한, 프로세스 생존이 모두 framework와 계약을 맺고 돈다"는 점이다.

## 용어 사전

| 용어 | 먼저 기억할 의미 | 면접 답변에서 붙일 관점 |
|------|------------------|--------------------------|
| Android Framework | 앱이 OS 기능을 쓰도록 제공되는 API와 실행 계약 | system service, component lifecycle, resource access |
| Activity | 사용자가 상호작용하는 화면 단위 | lifecycle, task, back stack, configuration change |
| Fragment | Activity 안에서 재사용되는 UI/lifecycle 단위 | Fragment lifecycle과 View lifecycle 분리 |
| Service | UI 없이 작업을 수행하는 component | started, bound, foreground, background 제한 |
| BroadcastReceiver | system/app broadcast에 반응하는 component | manifest 등록, runtime 등록, 짧은 실행 시간 |
| ContentProvider | 구조화 데이터를 URI로 공유하는 component | authority, ContentResolver, permission |
| Intent | 작업 요청과 component 통신을 표현하는 message object | explicit, implicit, action, data, category, extras |
| PendingIntent | 다른 앱이나 system이 나중에 내 권한으로 실행하는 Intent wrapper | notification, alarm, immutable/update flag |
| Context | resource, system service, app environment에 접근하는 핸들 | Application Context와 Activity Context의 수명 차이 |
| Bundle | 작은 key-value 상태 전달/복원 컨테이너 | Intent extra, Fragment arguments, saved state |
| Looper/Handler | thread별 message queue와 작업 전달 도구 | main thread, worker thread, HandlerThread |
| ART/Dalvik/Dex | Android 앱 bytecode 실행/컴파일 환경 | DEX, AOT, JIT, GC, startup/runtime trade-off |
| APK/AAB/R8 | 배포 산출물과 최적화 도구 | device-specific delivery, shrinking, obfuscation |

## 등장 배경과 이유

Android Framework 질문은 모바일 OS의 제약에서 나온다. 데스크톱 서버 프로그램처럼 긴 process를 전제로 마음대로 메모리를 잡고, 화면을 직접 관리하고, background에서 계속 실행하는 모델이 아니다. 모바일 기기는 배터리, 메모리, 화면 회전, 앱 전환, 권한, 프로세스 회수 압력이 강하다. 그래서 Android는 앱을 다음 방식으로 제한하고 대신 안정적인 계약을 제공한다.

- 화면은 Activity/Fragment lifecycle 안에서 다룬다.
- 앱 진입점은 Manifest와 Intent로 공개한다.
- 오래 걸리는 일은 main thread에서 빼고, system이 허용하는 background 실행 모델을 따른다.
- 사용자의 민감한 자원은 permission과 scoped storage 같은 정책을 통과한다.
- process는 언제든 system에 의해 죽을 수 있으므로 상태는 적절한 계층에 저장한다.

이 관점으로 읽으면 원문 p.12~120의 33개 질문은 넓어 보이지만 하나의 질문으로 모인다. "Android는 제한된 모바일 환경에서 앱을 어떻게 발견하고, 실행하고, 중단하고, 복원하고, 최적화하는가?"

## 역사적 기원

Android 초기부터 중심에는 `Activity`, `Service`, `BroadcastReceiver`, `ContentProvider`, `Intent`, `AndroidManifest.xml`가 있었다. 이들은 앱이 OS와 연결되는 네 개의 component와 그 component를 찾아 호출하는 선언/메시지 모델이다. 이후 Fragment, runtime permission, background execution limit, App Bundle, R8, ART의 JIT/AOT 조합처럼 새로운 도구가 추가됐지만 면접에서 묻는 기본 질문은 여전히 이 초기 구조 위에 놓인다.

| 흐름 | 왜 생겼는가 | 이 파트에서 이어지는 질문 |
|------|-------------|----------------------------|
| Manifest/component model | 앱을 설치 시점에 system이 발견하고 권한/진입점을 관리하기 위해 | Q1, Q5, Q6, Q9~Q11 |
| Activity/task model | 화면 전환과 뒤로 가기 경험을 OS 차원에서 일관되게 만들기 위해 | Q7, Q15, Q16, Q19 |
| Fragment/View lifecycle | 큰 화면, 재사용 UI, 화면 내부 상태 관리를 위해 | Q8, Q18 |
| Runtime permission | 민감 자원 접근을 설치 시점이 아니라 사용 맥락에서 제어하기 위해 | Q22 |
| ART/AAB/R8 | 다양한 기기에서 실행 성능과 배포 크기를 동시에 관리하기 위해 | Q28~Q31 |

## 학술적/이론적 배경

이 파트는 Android API 설명처럼 보이지만, 밑에는 몇 가지 컴퓨팅 모델이 깔려 있다.

- Event-driven programming: 앱은 사용자의 입력, lifecycle event, broadcast, binder callback, message queue event에 반응한다.
- Component-based architecture: 앱 기능은 Activity/Service/Receiver/Provider로 나뉘고, 각 component는 system이 이해할 수 있는 계약을 갖는다.
- Capability/security model: permission, URI grant, PendingIntent, exported component는 "누가 어떤 권한으로 무엇을 실행할 수 있는가"를 제어한다.
- State machine: Activity와 Fragment는 상태 전이를 갖고, 각 callback은 어느 자원을 잡고 놓아야 하는지에 대한 의미를 가진다.
- Queueing/concurrency model: main thread의 Looper는 message를 순차 처리한다. 오래 걸리는 작업은 queue를 막고 ANR로 이어진다.
- Resource-constrained runtime: process priority, GC, shrinking, bundle delivery는 배터리/메모리/저장공간/기기 다양성 문제의 답이다.

## 연대표

| 시기 | 변화 | 이 파트에서 읽을 의미 |
|------|------|------------------------|
| Android 초기 | 4대 component, Manifest, Intent 중심 모델 | 앱은 OS가 발견하고 호출하는 component 집합 |
| Android 3.x~4.x | Fragment와 tablet 대응이 중요해짐 | Activity 내부 UI와 View lifecycle을 분리해서 봐야 함 |
| Android 5.x 이후 | ART가 기본 runtime이 됨 | DEX 실행, AOT/JIT, GC 설명이 면접 주제가 됨 |
| Android 6.0 | runtime permission 도입 | permission은 manifest 선언만으로 끝나지 않음 |
| Android 8.0 이후 | background execution 제한 강화 | Service/BroadcastReceiver 답변에서 foreground/background 제약이 필수 |
| Android App Bundle 시대 | AAB와 dynamic delivery 확산 | APK와 AAB 차이, 앱 크기 최적화가 실무 질문이 됨 |

## 동작 메커니즘

### 1. 플랫폼 구조: Android는 "앱 API"가 아니라 실행 환경이다

원문 첫 질문은 Android의 정의를 묻지만, 답은 단순히 "모바일 OS"가 아니다. Android는 Linux kernel 위에 하드웨어 추상화, runtime, native library, framework service, app component 모델을 얹은 platform이다. 이 구조 때문에 앱 개발자는 camera driver를 직접 다루지 않고 framework API를 호출하며, process와 memory는 kernel/system service가 관리하고, Kotlin/Java 코드는 DEX로 변환되어 ART 위에서 실행된다.

면접에서 이 계층을 말해야 하는 이유는 이후 질문이 모두 여기에 매달리기 때문이다. ActivityManager는 component와 process를 관리하고, PackageManager는 Manifest와 설치 정보를 이해하고, WindowManager는 화면을 관리하며, ART는 DEX 실행과 GC를 담당한다. 그래서 Q0, Q20, Q28, Q32는 서로 떨어진 질문이 아니라 같은 구조의 다른 층을 묻는 질문이다.

### 2. 컴포넌트 진입 모델: 앱은 Manifest와 Intent로 발견된다

Android component는 단순한 class가 아니다. system이 알고 호출할 수 있는 진입점이다. Activity, Service, BroadcastReceiver, ContentProvider는 Manifest에 선언되거나 runtime에 등록되고, Intent나 URI를 통해 호출된다.

<div class="mermaid">
flowchart LR
    Caller["caller<br/>app or system"]
    Intent["Intent<br/>action, data, category, extras"]
    Resolver["PackageManager<br/>intent resolution"]
    Manifest["AndroidManifest.xml<br/>declared components"]
    System["framework service<br/>ActivityManager etc."]
    Target["target component<br/>lifecycle callback"]
    Permission["permission/exported check"]

    Caller --> Intent
    Intent --> Resolver
    Manifest --> Resolver
    Resolver --> Permission
    Permission --> System
    System --> Target
</div>

이 모델을 알면 Intent, PendingIntent, Manifest, Service, BroadcastReceiver, ContentProvider 질문이 한 번에 정리된다. Intent는 "무엇을 하라"는 요청이고, Manifest는 "이 앱에는 어떤 진입점과 권한이 있다"는 선언이며, system service는 두 정보를 조합해 적절한 component를 실행한다. PendingIntent는 여기서 한 단계 더 나아가, 다른 앱이나 system이 나중에 내 앱의 권한으로 특정 Intent를 실행할 수 있게 하는 token이다.

### 3. 상태와 생명주기 모델: 화면은 언제든 멈추고 다시 만들어질 수 있다

Activity와 Fragment 질문은 callback 이름을 외우는 문제가 아니다. 화면과 View가 언제 생성되고, 언제 사용자와 상호작용하고, 언제 일시 중지되고, 언제 제거되는지에 따라 자원과 상태를 어디에 둬야 하는지 판단하는 문제다.

<div class="mermaid">
stateDiagram-v2
    [*] --> Created: onCreate
    Created --> Started: onStart
    Started --> Resumed: onResume
    Resumed --> Paused: onPause
    Paused --> Stopped: onStop
    Stopped --> Started: onRestart
    Stopped --> Destroyed: onDestroy
    Destroyed --> [*]
    Resumed --> Recreated: configuration_change
    Recreated --> Created: new_instance
</div>

configuration change를 예로 들면, 회전이나 locale 변경으로 Activity가 destroy/recreate될 수 있다. 이때 UI에 즉시 다시 그릴 작은 상태는 `onSaveInstanceState()`의 Bundle에, 화면 로직과 일시적 UI data는 ViewModel에, process death 이후에도 살아야 하는 data는 database/file/remote source에 둔다. Fragment는 여기서 한 번 더 조심해야 한다. Fragment instance의 lifecycle과 Fragment가 가진 View의 lifecycle이 다르므로, View binding이나 observer는 View lifecycle에 맞춰 정리해야 leak과 stale reference를 피할 수 있다.

### 4. 스레드와 프로세스 모델: main thread를 막으면 앱 전체가 멈춘다

Android UI는 main thread에서 처리된다. main thread에는 Looper가 있고, Looper는 message queue에서 작업을 꺼내 Handler를 통해 dispatch한다. 입력 처리, lifecycle callback, UI drawing 관련 작업이 같은 흐름을 공유하므로 오래 걸리는 IO, network, database, bitmap 처리, lock 대기는 ANR로 이어진다.

<div class="mermaid">
flowchart TD
    Event["input, lifecycle, binder callback"]
    Main["main thread"]
    Queue["Looper message queue"]
    Handler["Handler dispatch"]
    Fast["short UI work"]
    Slow["long blocking work"]
    ANR["ANR risk"]
    Worker["worker thread<br/>HandlerThread, executor, WorkManager"]
    Result["post result<br/>back to main thread"]

    Event --> Queue
    Queue --> Main
    Main --> Handler
    Handler --> Fast
    Handler --> Slow
    Slow --> ANR
    Main --> Worker
    Worker --> Result
    Result --> Queue
</div>

process management도 같은 맥락이다. Android는 메모리가 부족하면 중요도가 낮은 process를 종료할 수 있다. foreground Activity, visible component, foreground Service가 있는 process는 우선순위가 높고, cached/background process는 낮다. 따라서 "process가 죽지 않는다"는 전제 대신 "다시 시작될 수 있다"는 전제로 상태와 작업을 설계해야 한다.

### 5. 리소스, 보안, 빌드 모델: 앱은 기기와 사용자 정책에 맞춰 작아지고 제한된다

Context, permission, file system, accessibility, APK/AAB/R8 질문은 얼핏 흩어져 보이지만 모두 resource boundary를 다룬다. Context는 resource와 system service 접근 경로이고, permission은 민감 resource 접근 권한이며, file system은 앱 private/public/shared storage의 경계이고, accessibility는 사용자가 앱을 이해하고 조작할 수 있게 만드는 UI contract다. APK/AAB/R8은 앱을 어떻게 packaging하고, 기기별로 전달하고, 불필요한 code/resource를 줄일지에 대한 배포 단계의 resource model이다.

## 책의 전체 구조

이 책은 Android 면접 질문을 category별로 묶는 방식으로 진행된다. 1편인 `The Android Framework`는 뒤에서 나올 UI, Jetpack, architecture, performance 질문의 바닥을 깐다. 그래서 이 파트는 독립 암기보다 "나중 질문을 읽기 위한 운영체제 지도"로 읽는 편이 좋다.

이번 포스트는 원문 p.12~120만 다룬다. 책 전체를 page 수로 기계적으로 나누지 않고, 원문의 category 경계를 따라 시리즈화한다. 이유는 category 하나가 하나의 면접 사고 단위를 이루기 때문이다. 1편은 Android 앱이 system과 맺는 기본 계약을 다루고, 이후 편은 그 계약 위에서 UI, Jetpack, architecture, performance 같은 세부 주제로 내려가는 방식이 자연스럽다.

## 장별 독해 가이드

원문 순서를 그대로 읽되, 머릿속에는 아래 다섯 묶음을 유지한다.

| 독해 묶음 | 원문 질문 | 읽는 목적 |
|-----------|-----------|-----------|
| 플랫폼 구조 | Q0, Q20, Q28, Q32 | Android가 어떤 runtime/process/service 위에서 앱을 실행하는지 이해 |
| 컴포넌트 진입 | Q1, Q2, Q5, Q6, Q9, Q10, Q11, Q15, Q16 | 앱 component가 어떻게 발견되고 호출되는지 이해 |
| 상태와 생명주기 | Q7, Q8, Q12, Q17, Q18, Q19 | 화면과 상태가 언제 사라지고 어디에 보관돼야 하는지 이해 |
| 리소스와 보안 | Q3, Q4, Q13, Q21, Q22, Q26, Q27 | data 전달, Context, memory, permission, storage, accessibility 경계 이해 |
| 스레딩과 배포 | Q14, Q23, Q24, Q25, Q29, Q30, Q31 | ANR, diagnostics, build variant, package optimization 이해 |

읽는 순서는 원문을 따르는 것이 좋다. 다만 처음 읽을 때 Q7 lifecycle, Q23 Looper/Handler, Q32 process management는 표시해두고 여러 번 돌아오는 anchor로 삼는다. 뒤의 질문들이 이 셋을 계속 전제하기 때문이다.

## 질문별 답변 지도

아래 답변 capsule은 원문 numbered question 33개를 모두 포함한다. 표 하나에 압축하지 않고, 위에서 설명한 다섯 개념군 아래에 배치했다. 각 capsule은 원문을 복제하지 않고 면접 답변의 뼈대만 남긴 것이다.

### A. 플랫폼과 실행 환경

#### Q0. Android란 무엇인가? (p.12)

- 한 줄 답: Android는 Linux kernel 위에서 runtime, framework API, system service, app component 모델을 제공하는 open-source mobile platform이다.
- 핵심 근거: kernel은 process, memory, driver 같은 저수준 자원을 관리하고, ART는 DEX bytecode 실행을 담당하며, framework는 ActivityManager/PackageManager 같은 service를 통해 앱 lifecycle과 resource 접근을 중재한다.
- 면접 포인트: "OS"라고만 답하지 말고, 앱 개발자가 만지는 Activity/Intent/Context가 하위 계층의 resource 관리와 연결된다는 점까지 말한다.
- 주의점: Android Framework와 Android Platform을 섞어 말할 수는 있지만, framework는 app-facing API/service 계층이라는 식으로 범위를 좁혀 설명하면 답이 선명해진다.

#### Q20. ActivityManager란 무엇인가? (p.86)

- 한 줄 답: ActivityManager는 running app process, task, Activity 상태 같은 실행 정보를 다루는 framework service 접근점이다.
- 핵심 근거: Android는 component 실행과 process 중요도를 system 차원에서 관리하므로, ActivityManager 계열 API는 app/task/process 상태를 관찰하거나 일부 제어하는 데 쓰인다.
- 면접 포인트: 현대 앱에서는 직접 process를 통제하기보다 lifecycle-aware component와 WorkManager/foreground service 같은 정책 친화적 API를 우선 쓴다고 말하는 편이 안전하다.
- 주의점: ActivityManager를 "Activity를 만드는 class"처럼 설명하면 틀린다. 앱 component 실행을 system service 관점에서 다루는 API라고 봐야 한다.

#### Q28. ART, Dalvik, Dex compiler는 무엇인가? (p.107)

- 한 줄 답: Java/Kotlin 코드는 DEX bytecode로 변환되고, Dalvik 또는 ART 같은 Android runtime이 이를 실행한다. 현대 Android의 기본 runtime은 ART다.
- 핵심 근거: Dalvik은 과거 VM이고, ART는 AOT/JIT와 GC를 통해 startup, runtime 성능, memory 사용을 조정한다. Dex compiler는 JVM bytecode를 Android가 이해하는 DEX 형식으로 바꾼다.
- 면접 포인트: "JVM에서 그대로 돈다"가 아니라 Android 전용 bytecode/runtime 경로를 거친다고 설명한다.
- 주의점: ART가 있다고 해서 모든 code가 설치 시점에 전부 native로 고정 컴파일된다고 단순화하면 안 된다. Android 버전별로 AOT/JIT/profile guided 흐름이 섞인다.

#### Q32. Android process와 process management를 설명하라. (p.117)

- 한 줄 답: Android는 앱 component의 중요도에 따라 process 우선순위를 매기고, 메모리가 부족하면 낮은 우선순위 process를 종료할 수 있다.
- 핵심 근거: foreground/visible/service/cached process처럼 사용자 영향도가 높은 process일수록 오래 유지되고, background cached process는 회수 대상이 된다.
- 면접 포인트: process death를 예외 상황이 아니라 정상 운영 조건으로 보고, UI state, persistent data, background work를 각각 적절한 저장소와 scheduler에 맡긴다고 말한다.
- 주의점: singleton이나 static cache에 중요한 상태만 두면 process death 뒤 복원되지 않는다.

### B. 컴포넌트 진입과 앱 간 통신

#### Q1. Intent란 무엇인가? (p.15)

- 한 줄 답: Intent는 component 실행 또는 앱 간 작업 요청을 표현하는 message object다.
- 핵심 근거: explicit Intent는 특정 component를 직접 지정하고, implicit Intent는 action/data/category를 보고 system이 처리 가능한 component를 찾는다. extras는 부가 data를 전달한다.
- 면접 포인트: Intent는 단순 data container가 아니라 Android component model의 routing 언어라고 설명하면 좋다.
- 주의점: implicit Intent는 받을 수 있는 app이 없거나 여러 개인 상황을 고려해야 하고, 민감 data를 아무 component에나 노출하지 않도록 주의해야 한다.

#### Q2. PendingIntent란 무엇인가? (p.17)

- 한 줄 답: PendingIntent는 다른 앱이나 system service가 나중에 내 앱의 권한으로 Intent를 실행할 수 있게 하는 token이다.
- 핵심 근거: notification click, alarm, widget처럼 현재 내 process가 직접 실행하지 않는 순간에도 사전에 정의한 작업을 system이 수행해야 할 때 사용한다.
- 면접 포인트: "Intent를 나중에 실행"보다 "권한과 identity를 위임한 실행 token"이라고 말해야 보안 의미가 살아난다.
- 주의점: mutable/immutable flag, requestCode, update/cancel flag 선택이 보안과 동작에 영향을 준다.

#### Q5. Application class의 목적은 무엇인가? (p.31)

- 한 줄 답: Application class는 process 안에서 앱 전역 초기화와 앱 수준 상태를 다루는 진입점이다.
- 핵심 근거: process가 시작될 때 만들어지고 Activity보다 수명이 길어서 DI, logging, analytics, global library 초기화 같은 작업에 쓰인다.
- 면접 포인트: Application은 전역 상태를 둘 수 있는 곳이지만, 무거운 초기화를 몰아넣으면 startup이 느려진다고 함께 말한다.
- 주의점: user/session 화면 상태를 Application singleton에 기대면 process death나 testability 문제가 커진다.

#### Q6. AndroidManifest의 목적은 무엇인가? (p.34)

- 한 줄 답: AndroidManifest는 앱의 package 정보, component, permission, feature, intent filter를 system에 선언하는 계약서다.
- 핵심 근거: 설치와 실행 시점에 system은 Manifest를 보고 어떤 Activity/Service/Receiver/Provider가 있는지, 어떤 권한이 필요한지, 어떤 Intent를 받을 수 있는지 판단한다.
- 면접 포인트: Manifest는 build metadata가 아니라 runtime discovery와 security boundary에 직접 관여한다고 설명한다.
- 주의점: exported component, permission, intent filter를 잘못 선언하면 보안 취약점이나 실행 불능 상태가 생긴다.

#### Q9. Service란 무엇인가? (p.47)

- 한 줄 답: Service는 UI 없이 background 또는 foreground에서 작업을 수행하는 component다.
- 핵심 근거: started service는 명령을 받고 독립적으로 실행되고, bound service는 client와 binding되어 API를 제공하며, foreground service는 사용자에게 보이는 ongoing 작업을 알림과 함께 수행한다.
- 면접 포인트: Service가 별도 thread를 자동 제공하지 않는다는 점을 반드시 말한다. 긴 작업은 worker thread나 적절한 scheduler가 필요하다.
- 주의점: Android 버전이 올라갈수록 background service 제한이 강해졌으므로, 무조건 Service로 오래 도는 작업을 만들면 안 된다.

#### Q10. BroadcastReceiver란 무엇인가? (p.56)

- 한 줄 답: BroadcastReceiver는 system이나 app이 보내는 broadcast event를 짧게 처리하는 component다.
- 핵심 근거: manifest에 정적으로 등록하거나 runtime에 동적으로 등록할 수 있고, system event나 app-defined event에 반응한다.
- 면접 포인트: receiver는 긴 작업을 수행하는 장소가 아니라 작업을 예약하거나 알림을 트리거하는 가벼운 entry point라고 말한다.
- 주의점: background 제한, implicit broadcast 제한, exported 여부, permission 보호를 함께 고려해야 한다.

#### Q11. ContentProvider란 무엇인가? (p.59)

- 한 줄 답: ContentProvider는 앱 data를 URI 기반 interface로 노출하고 다른 app이나 component가 ContentResolver를 통해 접근하게 하는 component다.
- 핵심 근거: authority와 path로 data를 식별하고, query/insert/update/delete 같은 표준 operation을 제공하며, permission이나 URI grant로 접근을 제한할 수 있다.
- 면접 포인트: app 내부 DB wrapper가 아니라 app 간 data sharing contract라고 설명한다.
- 주의점: 외부 노출 provider는 입력 검증, permission, URI 권한 부여를 잘못하면 data leak이 된다.

#### Q15. Deep link란 무엇인가? (p.69)

- 한 줄 답: Deep link는 URL이나 URI를 통해 앱의 특정 화면이나 기능으로 직접 진입하게 하는 mechanism이다.
- 핵심 근거: intent filter가 특정 scheme/host/path를 선언하면 system은 해당 link를 처리할 Activity를 찾고, app link는 domain verification을 통해 웹 도메인과 앱을 더 강하게 연결한다.
- 면접 포인트: deep link는 navigation 기능인 동시에 외부 입력 경계다. parsing, authentication, back stack 설계를 함께 말해야 한다.
- 주의점: deep link parameter를 신뢰하면 안 되고, 로그인 전후 흐름과 task stack 복원을 함께 설계해야 한다.

#### Q16. Task와 back stack은 무엇인가? (p.72)

- 한 줄 답: Task는 사용자가 하나의 작업으로 인식하는 Activity stack이고, back stack은 그 안의 Activity navigation history다.
- 핵심 근거: Activity launch mode, Intent flag, document mode, deep link 진입 방식에 따라 어떤 task에 Activity가 쌓이는지 달라진다.
- 면접 포인트: "뒤로 가기"는 단순 finish 호출이 아니라 task/back stack 정책의 결과라고 설명한다.
- 주의점: launchMode나 flag를 남용하면 예측하기 어려운 navigation과 duplicated screen 문제가 생긴다.

### C. 상태와 생명주기

#### Q7. Activity lifecycle을 설명하라. (p.36)

- 한 줄 답: Activity lifecycle은 화면 instance가 생성, 표시, 상호작용, 일시중지, 중지, 재시작, 소멸되는 상태 전이와 callback 계약이다.
- 핵심 근거: `onCreate()`는 초기화, `onStart()`는 화면 표시 준비, `onResume()`은 상호작용 가능 상태, `onPause()`/`onStop()`은 포커스 상실과 비가시 상태, `onDestroy()`는 정리 시점이다.
- 면접 포인트: callback 이름보다 각 상태에서 잡고 놓아야 할 resource를 말한다. 예를 들어 sensor/camera/listener는 visible/resumed 상태에 맞춰 등록/해제한다.
- 주의점: `onDestroy()`가 항상 정상 저장 기회라고 믿으면 안 된다. 중요한 상태는 더 이른 시점과 persistent storage를 고려해야 한다.

#### Q8. Fragment lifecycle을 설명하라. (p.41)

- 한 줄 답: Fragment lifecycle은 Fragment instance의 생명주기와 Fragment가 생성한 View의 생명주기를 함께 가진다.
- 핵심 근거: Fragment는 Activity에 attach되고, View는 `onCreateView()`에서 만들어져 `onDestroyView()`에서 사라진다. Fragment instance는 남아 있어도 View는 없어질 수 있다.
- 면접 포인트: LiveData/Flow observation, ViewBinding 정리, adapter reference는 viewLifecycleOwner 기준으로 처리한다고 말하면 실무성이 드러난다.
- 주의점: Fragment lifecycle만 보고 View reference를 오래 들고 있으면 memory leak이나 crash가 난다.

#### Q12. Configuration change란 무엇인가? (p.64)

- 한 줄 답: Configuration change는 rotation, locale, theme, font scale처럼 resource configuration이 바뀌어 Activity가 재생성될 수 있는 상황이다.
- 핵심 근거: system은 새 configuration에 맞는 resource를 적용하기 위해 Activity를 destroy/recreate하고, 개발자는 state를 저장/복원하거나 특정 change를 직접 처리할 수 있다.
- 면접 포인트: UI state는 saved state/ViewModel/persistent storage로 역할을 나누어 보존한다고 설명한다.
- 주의점: manifest의 `configChanges`로 재생성을 막는 것은 일반 해법이 아니다. 직접 처리 책임이 커진다.

#### Q17. Bundle의 목적은 무엇인가? (p.74)

- 한 줄 답: Bundle은 작은 key-value data를 component 간 전달하거나 instance state 저장에 쓰는 container다.
- 핵심 근거: Intent extras, Fragment arguments, `onSaveInstanceState()`에서 흔히 쓰이며, Parcelable/Serializable 같은 형태의 data를 담는다.
- 면접 포인트: Bundle은 작은 상태와 parameter 전달용이고, 큰 object나 장기 data 저장소가 아니라고 말한다.
- 주의점: Binder transaction size, serialization 비용, process death 복원 가능성을 고려해야 한다.

#### Q18. Activity와 Fragment 사이에서 data를 전달하는 방법은 무엇인가? (p.77)

- 한 줄 답: Activity 간에는 Intent extra, Fragment 생성 시에는 arguments Bundle, 화면 간 결과에는 Activity Result API나 Fragment result API, 공유 상태에는 ViewModel 같은 lifecycle-aware holder를 사용한다.
- 핵심 근거: 전달 방식은 data의 수명과 소유자가 누구인지에 따라 달라진다. 한 번 넘기는 parameter와 여러 화면이 공유하는 mutable state는 다른 도구를 써야 한다.
- 면접 포인트: "그냥 singleton"이 아니라 lifecycle과 process death를 기준으로 선택한다고 말한다.
- 주의점: Fragment constructor parameter에 runtime data를 넣으면 재생성 시 깨질 수 있다. arguments를 사용해야 한다.

#### Q19. Configuration change 동안 Activity에는 어떤 일이 일어나는가? (p.84)

- 한 줄 답: 기본적으로 Activity는 현재 instance가 종료되고 새 configuration에 맞는 새 instance로 다시 생성된다.
- 핵심 근거: 기존 Activity는 save state callback을 거친 뒤 destroy될 수 있고, 새 Activity는 saved state와 ViewModelStore 같은 mechanism을 통해 필요한 상태를 이어받는다.
- 면접 포인트: "회전하면 onCreate가 다시 불린다"에서 멈추지 말고, 어떤 data가 Bundle, ViewModel, repository에 있어야 하는지 구분한다.
- 주의점: ViewModel은 configuration change에는 살아남지만 process death에는 살아남지 않는다.

### D. 리소스, 보안, data 경계

#### Q3. Serializable과 Parcelable의 차이는 무엇인가? (p.19)

- 한 줄 답: Serializable은 Java reflection 기반 직렬화이고, Parcelable은 Android IPC/Bundle 전달에 맞춰 더 명시적이고 효율적으로 설계된 직렬화 방식이다.
- 핵심 근거: Parcelable은 작성 비용이 있지만 Android component 간 data 전달에서 성능과 control이 좋고, Serializable은 간단하지만 overhead가 크다.
- 면접 포인트: Android에서는 Intent/Bundle 전달에 Parcelable을 선호하고, Kotlin에서는 `@Parcelize`로 보일러플레이트를 줄일 수 있다고 말한다.
- 주의점: 어느 쪽이든 큰 object 전달에 쓰는 도구가 아니다. 큰 data는 id/reference를 넘기고 저장소에서 다시 읽는 편이 낫다.

#### Q4. Context란 무엇인가? (p.23)

- 한 줄 답: Context는 앱 environment, resource, system service, package 정보에 접근하는 interface다.
- 핵심 근거: Activity Context는 화면 lifecycle과 theme/window에 연결되고, Application Context는 process 수준의 긴 수명을 가진다.
- 면접 포인트: UI inflation, dialog, startActivity 같은 화면 작업은 Activity Context가 필요할 수 있고, 오래 사는 object에는 Activity Context를 잡아두면 leak이 된다고 설명한다.
- 주의점: "Application Context가 항상 안전하다"도 틀리다. theme나 UI owner가 필요한 작업에는 부적절하다.

#### Q13. Memory leak은 어떻게 발생하고 어떻게 관리하는가? (p.66)

- 한 줄 답: 더 이상 필요 없는 Activity/View/Context가 static reference, listener, callback, coroutine, thread 등에 붙잡혀 GC되지 못할 때 leak이 발생한다.
- 핵심 근거: Android 객체는 lifecycle이 짧은데, 오래 사는 object가 짧은 lifecycle owner를 참조하면 release 시점이 어긋난다.
- 면접 포인트: lifecycle-aware observer, weak reference보다 명시적 해제, ViewBinding null 처리, coroutine scope 분리, LeakCanary 같은 도구를 말한다.
- 주의점: leak 해결을 GC 호출로 설명하면 안 된다. 참조 구조와 lifecycle 정리가 핵심이다.

#### Q21. SparseArray는 무엇이고 언제 쓰는가? (p.89)

- 한 줄 답: SparseArray는 integer key를 object에 매핑하는 Android 특화 collection으로, 일부 상황에서 HashMap<Integer, T>보다 boxing overhead를 줄인다.
- 핵심 근거: primitive int key를 직접 다뤄 memory overhead를 낮추도록 설계되어 resource id나 view id mapping 같은 곳에 쓰일 수 있다.
- 면접 포인트: 성능 최적화 도구지만 무조건 HashMap보다 빠르다고 말하지 말고 data size와 접근 패턴에 따라 판단한다고 설명한다.
- 주의점: 현대 런타임과 collection 개선 때문에 micro-optimization으로 남용하면 code readability가 나빠질 수 있다.

#### Q22. Runtime permission은 무엇인가? (p.91)

- 한 줄 답: Runtime permission은 민감한 권한을 설치 시점이 아니라 사용 맥락에서 사용자에게 요청하고 결과를 처리하는 모델이다.
- 핵심 근거: camera, location, contacts 같은 dangerous permission은 manifest 선언만으로 사용할 수 없고, 실행 중 권한 상태를 확인하고 요청해야 한다.
- 면접 포인트: 권한 요청 전 rationale, 거부/영구 거부 처리, 기능 degradation, Activity Result API 기반 요청 흐름을 함께 말한다.
- 주의점: 권한을 받았다고 data 사용 목적이 무제한 허용되는 것은 아니다. privacy와 platform policy를 함께 고려해야 한다.

#### Q26. Accessibility를 어떻게 보장하는가? (p.102)

- 한 줄 답: Accessibility는 screen reader, keyboard/switch navigation, contrast, touch target, semantic label 등을 통해 다양한 사용자가 앱을 조작할 수 있게 만드는 UI contract다.
- 핵심 근거: contentDescription, focus order, role/semantics, dynamic content announcement, 충분한 text size와 contrast가 핵심이다.
- 면접 포인트: 접근성은 사후 polish가 아니라 component 설계와 test의 일부라고 말한다.
- 주의점: 모든 이미지에 contentDescription을 넣는 것이 답은 아니다. 장식 이미지는 숨기고 의미 있는 control에는 정확한 label을 제공해야 한다.

#### Q27. Android file system을 설명하라. (p.105)

- 한 줄 답: Android storage는 app private storage, shared/media storage, cache, external storage 같은 경계를 갖고 permission과 scoped storage 정책의 영향을 받는다.
- 핵심 근거: app private file은 기본적으로 해당 앱만 접근하고, 공유 media나 문서는 system picker, MediaStore, SAF 같은 API를 통해 접근한다.
- 면접 포인트: 파일 위치를 말할 때 "누가 접근해야 하는가", "앱 삭제 시 남아야 하는가", "백업 대상인가", "사용자에게 보이는가"를 기준으로 선택한다고 설명한다.
- 주의점: external storage를 모든 앱이 마음대로 읽고 쓰는 공간으로 생각하면 최신 Android storage 정책과 맞지 않는다.

### E. 스레딩, 진단, 빌드와 배포

#### Q14. ANR은 무엇이고 어떻게 피하는가? (p.68)

- 한 줄 답: ANR은 main thread가 입력, broadcast, service 같은 system timeout 안에 응답하지 못해 앱이 멈춘 것으로 판단되는 상태다.
- 핵심 근거: main thread에서 network, disk IO, 긴 computation, lock wait를 수행하면 Looper queue 처리가 막히고 system은 응답 없음 dialog를 표시할 수 있다.
- 면접 포인트: 긴 작업을 worker로 옮기고, coroutine/WorkManager/thread pool을 목적에 맞게 쓰며, trace와 StrictMode로 원인을 찾는다고 말한다.
- 주의점: background thread를 쓰는 것만으로 충분하지 않다. 결과를 main thread에 안전하게 전달하고 lifecycle cancellation도 고려해야 한다.

#### Q23. Looper, Handler, HandlerThread는 무엇인가? (p.94)

- 한 줄 답: Looper는 thread의 message loop, Handler는 그 queue에 message/runnable을 넣고 처리하는 도구, HandlerThread는 Looper를 가진 background thread다.
- 핵심 근거: main thread는 기본 Looper를 갖고 UI 작업을 처리하며, Handler는 특정 thread에 작업을 schedule하거나 thread 간 결과를 전달하는 데 쓰인다.
- 면접 포인트: "Handler는 thread가 아니다"를 분명히 말한다. Handler는 Looper가 있는 thread에 붙어 queue 작업을 다룬다.
- 주의점: 오래 사는 Handler가 Activity를 암묵적으로 참조하면 leak이 될 수 있고, 현대 code에서는 coroutine/Executor 등과 함께 비교해 선택한다.

#### Q24. Exception을 어떻게 추적하는가? (p.97)

- 한 줄 답: stack trace, logcat, crash reporting, debugger, analytics, reproducer, symbol/mapping file을 조합해 exception의 발생 지점과 사용자 영향을 추적한다.
- 핵심 근거: Android crash는 device/OS/API level/thread/state에 따라 재현성이 달라서 단순 stack trace 외에도 breadcrumbs와 release mapping이 중요하다.
- 면접 포인트: R8 obfuscation을 쓰면 mapping file 관리가 필요하고, non-fatal exception과 ANR도 함께 관찰해야 한다고 말한다.
- 주의점: catch로 삼키는 것은 추적이 아니다. recovery 가능성, logging, user impact를 구분해야 한다.

#### Q25. Build variants와 product flavors는 무엇인가? (p.100)

- 한 줄 답: Build variant는 build type과 product flavor 조합으로 만들어지는 앱 빌드 조합이고, flavor는 제품/환경별 source, resource, config를 나누는 단위다.
- 핵심 근거: debug/release 같은 build type은 debuggable, signing, minify 설정을 바꾸고, free/paid/dev/prod 같은 flavor는 applicationId, endpoint, resource를 바꿀 수 있다.
- 면접 포인트: variant matrix가 커지면 CI 시간과 설정 복잡도가 증가하므로 필요한 축만 유지한다고 말한다.
- 주의점: secret을 flavor resource에 평문으로 넣는 것은 보안 해법이 아니다.

#### Q29. APK와 AAB의 차이는 무엇인가? (p.109)

- 한 줄 답: APK는 기기에 설치되는 완성 package이고, AAB는 Play가 기기별 APK를 생성할 수 있게 하는 publishing format이다.
- 핵심 근거: AAB는 language, density, ABI 등 device configuration에 맞춰 필요한 code/resource만 전달하는 split delivery를 가능하게 한다.
- 면접 포인트: 사용자는 결국 APK를 설치하지만, 개발자는 Play 배포에서 AAB를 제출해 app size와 delivery를 최적화한다고 설명한다.
- 주의점: AAB는 모든 배포 채널에서 APK를 대체하는 단일 설치 파일이 아니다. sideload나 non-Play 배포에서는 전략이 달라질 수 있다.

#### Q30. R8은 무엇인가? (p.111)

- 한 줄 답: R8은 Android build에서 code shrinking, optimization, obfuscation, dexing을 수행하는 도구다.
- 핵심 근거: 사용하지 않는 code를 제거하고, code를 최적화하며, 이름을 난독화하고, 최종 DEX 생성 과정에 관여해 앱 크기와 reverse engineering 난이도에 영향을 준다.
- 면접 포인트: R8을 켜면 keep rule이 중요해지고, reflection/serialization/DI/library entry point가 제거되지 않도록 설정해야 한다고 말한다.
- 주의점: crash stack trace 해석에는 mapping file이 필요하다.

#### Q31. 앱 크기를 줄이는 방법은 무엇인가? (p.113)

- 한 줄 답: code/resource shrinking, image/vector 최적화, ABI/language split, dynamic feature, dependency 정리, R8 keep rule 점검으로 앱 크기를 줄인다.
- 핵심 근거: 앱 크기는 code뿐 아니라 resource, native library, duplicated dependency, unused asset, density별 이미지에서 커진다.
- 면접 포인트: 먼저 Android Studio Analyzer나 build report로 큰 항목을 찾고, 측정 기반으로 줄인다고 말한다.
- 주의점: 무리한 shrinking은 runtime crash를 만들 수 있으므로 release test와 mapping/keep rule 검증이 필요하다.

## 핵심 주장과 근거

이 파트의 핵심 주장은 하나다. Android Framework는 "API 이름 묶음"이 아니라 "모바일 OS가 앱을 통제 가능하게 실행하기 위한 계약 묶음"이다.

근거는 질문 분포에서 보인다.

- Q1~Q2, Q5~Q6, Q9~Q11, Q15~Q16은 앱이 system에 발견되고 호출되는 방식이다.
- Q7~Q8, Q12, Q17~Q19는 화면과 상태가 언제 사라지고 다시 만들어지는지에 대한 방식이다.
- Q14, Q23, Q32는 main thread와 process가 system 자원 제약 속에서 어떻게 관리되는지 묻는다.
- Q3~Q4, Q13, Q21~Q22, Q26~Q27은 data/resource/security boundary를 묻는다.
- Q24~Q31은 진단, build, runtime, 배포 최적화가 이 계약 위에서 어떻게 이어지는지 묻는다.

이 구조를 잡으면 개별 질문을 외울 때보다 답변이 덜 흔들린다. 예를 들어 Context 질문은 memory leak 질문과 연결되고, Bundle 질문은 configuration change와 process death 질문으로 이어지며, Service 질문은 main thread와 background execution limit 질문으로 이어진다.

## 실무 적용 / 생각해볼 질문

아래 질문은 원문 practical question의 성격을 답변형으로 바꾼 것이다. 혼자 읽을 때는 먼저 답해보고, 위의 capsule로 다시 확인하면 된다.

| 상황 | 실무에서의 답변 방향 |
|------|----------------------|
| 알림을 눌렀을 때 특정 화면으로 보내야 한다 | PendingIntent로 실행 권한을 system에 맡기고, deep link/task stack을 함께 설계한다. mutable/immutable flag도 확인한다. |
| 회전 후 입력 중이던 값이 사라진다 | 즉시 복원할 UI state는 saved state/Bundle, 화면 logic state는 ViewModel, 장기 data는 repository/storage로 나눈다. |
| 화면을 닫았는데 Activity가 GC되지 않는다 | 오래 사는 object가 Activity/View/Context를 잡고 있는지 본다. listener, Handler, coroutine, adapter, binding을 lifecycle에 맞춰 해제한다. |
| 특정 기기에서만 crash가 난다 | stack trace와 device/API level, R8 mapping, feature/resource split, permission/storage 정책 차이를 함께 본다. |
| 앱 크기가 너무 크다 | APK/AAB analyzer로 code, resource, native library, asset, dependency 비중을 측정한 뒤 R8, resource shrinking, image/vector, split delivery를 적용한다. |

## 오해하기 쉬운 부분

- `Service`는 자동으로 background thread가 아니다. Service callback도 main thread에서 실행될 수 있으므로 긴 작업은 따로 분리해야 한다.
- `Application Context`가 모든 Context 문제의 답은 아니다. UI theme, window, lifecycle owner가 필요한 곳에는 Activity Context가 맞다.
- `Bundle`은 큰 object 저장소가 아니다. 작은 상태와 parameter 전달에 맞는 도구다.
- `ViewModel`은 configuration change에는 살아남지만 process death에는 기본적으로 살아남지 않는다.
- `onDestroy()`는 항상 호출되는 저장 hook이 아니다. 중요한 data는 더 안정적인 저장 경로를 가져야 한다.
- `AAB`는 사용자가 직접 설치하는 하나의 APK와 같은 개념이 아니다. Play가 기기별 APK를 생성할 수 있게 하는 publishing artifact다.
- `R8`은 단순 난독화 도구가 아니다. shrink, optimize, obfuscate, dexing까지 build output에 영향을 준다.

## 한 장 요약

1편을 한 문장으로 줄이면 이렇다.

> Android 앱은 component로 system에 등록되고, Intent/URI로 호출되며, lifecycle과 main thread/process 제약 안에서 상태와 resource를 관리하고, runtime/build 도구를 통해 다양한 기기에 배포된다.

암기 순서는 다음이 좋다.

1. Android platform 계층을 그린다: Linux kernel, HAL, ART, native library, framework service, app component.
2. 앱 진입을 그린다: Manifest, Intent, PackageManager, ActivityManager, component lifecycle.
3. 화면 상태를 그린다: Activity/Fragment lifecycle, configuration change, Bundle/ViewModel/storage.
4. 실행 제약을 그린다: main thread, Looper/Handler, ANR, process priority.
5. resource boundary를 그린다: Context, permission, file system, accessibility.
6. 배포와 최적화를 그린다: DEX/ART, APK/AAB, R8, app size.

이 여섯 줄을 먼저 말할 수 있으면, 원문 33개 질문은 서로 다른 암기 카드가 아니라 하나의 시스템 설명으로 연결된다.

## 참고자료

- 원문: Jaewoong Eum, `Manifest Android Interview: The Ultimate Guide`, Category 0: The Android Framework, p.12~120.
- Android Developers, App fundamentals.
- Android Developers, Activity lifecycle.
- Android Developers, Intents and intent filters.
- Android Developers, Processes and app lifecycle.
- Android Developers, App Bundles and R8.
