---
layout: single
title: "Android XR Spaces 및 Activity Start Mode 완전가이드"
date: 2026-05-09 23:00:00 +0900
categories: frontend
excerpt: "Android XR Spaces와 Activity Start Mode는 앱이 Home Space, Full Space Managed, Full Space Unmanaged 중 어떤 공간 모드로 시작하고 렌더링 제어권을 누구에게 맡길지 결정하는 계약이다."
toc: true
toc_sticky: true
tags: [androidxr, openxr, jetpackxr, unity, spacemode]
source: "/home/dwkim/dwkim/docs/xr/android-xr-spaces-activity-start-mode.md"
---

TL;DR
- Android XR는 Home Space, Full Space Managed, Full Space Unmanaged 세 모드로 앱의 공간 점유 방식과 렌더링 책임을 나눈다.
- Jetpack XR SDK 앱과 OpenXR·Unity 앱은 시작 모드와 컴포지션 경로가 달라서 같은 Android View라도 헤드셋 표시 결과가 달라진다.
- 특히 Unity Full Space Unmanaged 앱에서 `addContentView(WebView)`가 보이지 않는 이유를 Space 모델과 OpenXR 컴포지터 관점에서 설명해 준다.

## 1. 개념
Android XR Spaces와 Activity Start Mode는 Android XR 앱이 어떤 공간 모드에서 시작하고, 다중 앱 공존 여부·3D 공간 소유권·렌더링 제어권을 시스템과 앱 중 누가 갖는지 정의하는 실행 계약이다.

## 2. 배경
Android XR는 기존 2D Android 윈도우 모델만으로는 멀티 앱 공간 공존, 몰입형 전환, OpenXR 엔진 앱의 직접 렌더링 요구를 설명하기 어려웠다. 그래서 Jetpack XR와 OpenXR 앱을 함께 수용할 수 있는 Space 모델과 시작 속성 체계가 필요해졌다.

## 3. 이유
이 구조를 이해해야 Home Space와 Full Space의 차이, Managed와 Unmanaged의 경계, Unity·OpenXR 앱에서 일반 Android View가 왜 그대로 보이지 않는지를 한 축에서 설명할 수 있다.

## 4. 특징
- Manifest property 하나로 시작 공간 모드와 시스템 기대 계약을 명시한다
- Home Space는 다중 앱 공존에, Full Space Managed는 SceneCore 기반 몰입 UI에, Full Space Unmanaged는 OpenXR 엔진 앱에 맞춰 설계됐다
- SpatialCapability, PanelEntity, ActivityPanelEntity 같은 Jetpack XR 개념과 OpenXR composition layer 개념을 함께 정리한다
- visionOS, Meta, PICO, HoloLens와의 공간 모델 비교까지 포함해 플랫폼 간 대응 관계를 잡아준다

## 5. 상세 내용

# Android XR Spaces 및 Activity Start Mode 완전가이드

> **작성일**: 2026-05-09
> **카테고리**: XR / Android XR / Jetpack XR / OpenXR / Game Dev
> **포함 내용**: Android XR, Home Space, Full Space Managed, Full Space Unmanaged, XR_ACTIVITY_START_MODE, android.window.PROPERTY_XR_ACTIVITY_START_MODE, Jetpack XR SDK, SceneCore, Session, SpatialCapability (SPATIAL_UI/SPATIAL_3D_CONTENT/APP_ENVIRONMENT/SPATIAL_AUDIO/PASSTHROUGH_CONTROL/EMBED_ACTIVITY), PanelEntity, ActivityPanelEntity, GltfModelEntity, SpatialEnvironment, SubspaceModifier, Compose for XR, Material Design for XR, ARCore for Jetpack XR, OpenXR 1.1, XrSpace, XrReferenceSpaceType (VIEW/LOCAL/LOCAL_FLOOR/STAGE), XrEnvironmentBlendMode (OPAQUE/ADDITIVE/ALPHA_BLEND), XrSession, xrBeginFrame, xrEndFrame, XrCompositionLayer (Projection/Quad/Cylinder/Equirect2/Cube), XR_KHR_android_surface_swapchain, XR_KHR_composition_layer_*, XR_ANDROID_spatial_object_tracking, XR_ANDROID_spatial_discovery_raycast, XR_ANDROID_spatial_entity_bound_anchor, ANativeWindow, SurfaceFlinger, ViewRootImpl, BufferQueue, addContentView, SurfaceControlViewHost, Project Iris, Project Moohan, Samsung Galaxy XR, Snapdragon XR2+ Gen 2, Daydream, ARCore, Apple visionOS Shared Space / Full Space (.mixed/.progressive/.full), Meta Horizon OS Panel/Immersive/Hybrid/Boundaryless, PICO OS 6 Shared/Full Space, HoloLens 2 Mixed Reality Home, Snapdragon Spaces, Khronos Group, Compose for XR, requestHomeSpaceMode, requestFullSpaceMode, transferActivity, addSpatialCapabilitiesChangedListener, Unity OpenXR Android XR package (com.unity.xr.androidxr-openxr), Google Maps Immersive XR, Calm 케이스 스터디

---

# 1. Android XR Spaces란?

## 핵심 개념

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Android XR Spaces 한 줄 정의                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  "Android XR가 앱에게 부여하는 3차원 공간 사용권의 종류 — 다른 앱과     │
│   2D 패널로 공존하는 Home Space, 시스템이 렌더링을 관리하는 Full       │
│   Space Managed, 앱 자신이 OpenXR로 렌더링을 직접 소유하는 Full       │
│   Space Unmanaged의 셋."                                              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  AndroidManifest.xml                                        │      │
│  │  └─ <property                                               │      │
│  │       android:name=                                         │      │
│  │         "android.window.PROPERTY_XR_ACTIVITY_START_MODE"    │      │
│  │       android:value="XR_ACTIVITY_START_MODE_..." />         │      │
│  │                                                              │      │
│  │  값에 따라 Activity가 시작되는 공간 모드가 결정됨            │      │
│  └────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

## 세 모드 한눈에

| 모드 | 다중 앱 공존 | 3D world 소유 | 대상 SDK | 렌더 루프 소유 |
|------|--------------|---------------|----------|----------------|
| **Home Space** | O | X (시스템 환경만) | Jetpack XR SDK | Android XR 시스템 |
| **Full Space Managed** | X (단독) | O | Jetpack XR SDK (SceneCore) | Android XR 시스템 |
| **Full Space Unmanaged** | X (단독) | O | OpenXR / Unity / Unreal / WebXR | **앱 자신** |

**TIL의 핵심 발견**: Unity로 만든 Android XR 앱은 자동으로 **Full Space Unmanaged** 모드다. 이 사실이 "왜 `addContentView(WebView)` 가 헤드셋에 안 보이는가"라는 디버깅 질문의 근본 원인이다 — Section 8 참조.

## XR / VR / AR / MR / "Space" 관계

| 약어 | 풀 이름 | 의미 | OpenXR 매핑 |
|------|---------|------|-------------|
| VR | Virtual Reality | 물리 세계 차단, 디지털 세계 몰입 | `XR_ENVIRONMENT_BLEND_MODE_OPAQUE` |
| AR | Augmented Reality | 광학 시-스루(see-through) 위에 가상 오버레이 | `XR_ENVIRONMENT_BLEND_MODE_ADDITIVE` |
| MR | Mixed Reality | 카메라 패스스루와 가상 콘텐츠를 알파 합성 | `XR_ENVIRONMENT_BLEND_MODE_ALPHA_BLEND` |
| **XR** | **eXtended Reality** | **VR/AR/MR 전체를 포괄하는 우산 용어** | — |
| Space | (플랫폼 용어) | "앱이 디스플레이를 어느 정도 독점하는가" | OpenXR 스펙 외부, OS별 구현 |

> **중요 구분**: OpenXR의 `XrSpace`(좌표계 reference space)와 Android XR의 "Space"(앱 모드)는 이름은 같지만 다른 개념이다. 전자는 좌표계, 후자는 앱 윈도잉이다.

---

# 2. 용어 사전

## Activity Start Mode 4값

Manifest property key: **`android.window.PROPERTY_XR_ACTIVITY_START_MODE`**

| 값 | 대상 SDK | 의미 |
|----|----------|------|
| `XR_ACTIVITY_START_MODE_HOME_SPACE` | Jetpack XR SDK | 멀티태스킹 환경, 다른 앱과 나란히 실행 가능 |
| `XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED` | Jetpack XR SDK | 앱이 전체 공간 단독 점유, **시스템이 렌더링 라이프사이클 관리** |
| `XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED` | OpenXR / Unity / Unreal | 앱이 전체 공간 단독 점유, **앱이 렌더 루프와 컴포지터를 직접 소유** |
| `XR_ACTIVITY_START_MODE_UNDEFINED` | (미공개 sentinel) | 1차 출처에 정의 없음. 내부 기본값 sentinel로 추정 — 확실치 않음 |

**Managed vs Unmanaged 핵심 질문 — "무엇을 누가 관리하는가?"**

- **Managed**: Android XR 시스템 컴포지터가 렌더 루프와 SceneCore Scene을 관리. SceneCore가 Entity 라이프사이클·공간 전환·passthrough 블렌딩을 조율한다.
- **Unmanaged**: OpenXR 앱(Unity, Unreal, 순수 OpenXR C++)이 자체 `XrSession`을 직접 소유하고 `xrBeginFrame`/`xrEndFrame`을 호출. Android XR 시스템은 Full Space만 부여하고 앱 내부 파이프라인엔 개입하지 않는다("self-managed").

## Jetpack XR SDK 패키지 구조

```
androidx.xr.*
├── xr-runtime               → Session.create(), SpatialCapabilities, ScenePose
├── xr-scenecore             → SceneCore: Entity 트리, PanelEntity, ActivityPanelEntity,
│                              GltfModelEntity, SurfaceEntity, SpatialEnvironment
├── xr-compose               → Compose for XR: Subspace, SpatialPanel, SpatialRow, Orbiter
├── xr-compose-material3     → Material Design for XR
└── xr-arcore                → ARCore for Jetpack XR: 평면 감지, 앵커, 히트테스트
```

## 핵심 클래스

| 클래스 | 역할 |
|--------|------|
| `Session` | 각 spatialized Activity가 보유하는 XR 세션. `Session.create(activity)` 또는 Compose의 `LocalSession.current` |
| `SpatialCapability` | 현재 모드에서 어떤 공간 기능이 가능한지의 enum |
| `SpatialCapabilities` | `Set<SpatialCapability>`. capability 변화 리스너 등록 가능 |
| `PanelEntity` | 2D Android View 트리를 공간 패널로 변환 (`SurfaceControlViewHost` 사용) |
| `ActivityPanelEntity` | 다른 Activity 전체를 spatial panel로 끌어올림 |
| `GltfModelEntity` | 3D glTF 모델 |
| `SurfaceEntity` | 비디오 등 Surface 기반 콘텐츠 (composition layer 직결) |
| `SpatialEnvironment` | 환경 스카이박스/HDR/lighting |

## SpatialCapability 멤버

| 멤버 | 의미 |
|------|------|
| `SPATIAL_UI` | 공간 UI(2D 패널) 가능 |
| `SPATIAL_3D_CONTENT` | 3D 콘텐츠(Entity) 가능 |
| `APP_ENVIRONMENT` | 앱이 환경(스카이박스) 제어 가능 |
| `SPATIAL_AUDIO` | 공간 오디오 가능 |
| `PASSTHROUGH_CONTROL` | passthrough 제어 가능 |
| `EMBED_ACTIVITY` | 다른 Activity를 ActivityPanelEntity로 embed 가능 |

## OpenXR 측 용어

| 용어 | 설명 |
|------|------|
| `XrSession` | 앱이 보유하는 OpenXR 세션. 렌더 루프의 주체 |
| `XrSpace` | **좌표계** (frame of reference). Android XR Space와 다른 개념 |
| `XrReferenceSpaceType` | `VIEW` / `LOCAL` / `LOCAL_FLOOR` / `STAGE` |
| `XrEnvironmentBlendMode` | `OPAQUE` / `ADDITIVE` / `ALPHA_BLEND` |
| `xrBeginFrame` / `xrEndFrame` | 매 프레임 렌더 루프 |
| `XrCompositionLayer*` | 컴포지터에 제출하는 레이어 (`Projection`, `Quad`, `Cylinder`, `Equirect2`, `Cube`) |
| `ANativeWindow` | Android C/C++ 레벨의 Surface 추상화 |

---

# 3. 등장 배경과 이유

## 기존 Android Window/DisplayMode 모델의 한계

Android의 Window 모델은 **2D 평면 디스플레이**를 가정하여 설계되었다.

- Activity는 하나의 직사각형 Window 안에 완전히 포함
- `WindowManager.LayoutParams`의 `type`/`flags`는 화면 좌표계 기반
- Multi-window/split-screen은 "같은 2D 평면 위에 여러 창"
- `Display.getMode()` / `WindowManager.getCurrentWindowMetrics()`는 픽셀 단위 2D 정보만 제공

3D 공간에서는 다음이 필요했다.

1. 창이 **3D 공간의 특정 Pose(위치+회전)**에 배치
2. 여러 앱이 동시에 3D 공간 안에 부유(float)
3. 앱이 공간 전체를 독점하는 모드와 공존하는 모드의 명확한 분리
4. 입체(stereoscopic) · 패스스루 · 환경 레이어를 처리하는 컴포지션 파이프라인

## Daydream / ARCore의 한계

| 시도 | 시점 | 한계 |
|------|------|------|
| Google Daydream | 2016 | 앱이 전체 VR 렌더링을 독점하는 방식. 멀티태스킹 불가, 2D 앱 공존 불가. 2019년 종료 |
| ARCore | 2017 | AR 오버레이를 2D 카메라 화면 위에 얹는 방식. 완전한 공간 컴퓨팅과 거리 멀음 |

## 핵심 교훈

> **"XR 서비스는 앱 레이어가 아닌 OS 레이어에 내장되어야 한다."**

Android XR는 이를 OS 수준에서 해결: XR 공간 모델을 WindowManager 확장으로 통합하고, 앱이 Home Space ↔ Full Space 간을 매니페스트로 선언하거나 런타임에 전환할 수 있는 새 contract를 도입했다.

---

# 4. 역사적 기원 / 진화 타임라인

## Android XR 자체 타임라인

| 시점 | 사건 |
|------|------|
| 2016 | Google Daydream VR 플랫폼 출시 |
| 2017 | ARCore 발표 |
| 2019 | Daydream 공식 종료 |
| 2021 | Project Iris (Google AR 헤드셋) 내부 시작, Clay Bavor 지휘 |
| 2022 | Google × Samsung 파트너십, Project Moohan 코드명 시작. Google이 Raxium(마이크로 LED) ≈$1B에 인수 |
| **2023-06-05** | **Apple Vision Pro + visionOS WWDC 발표 — "Shared Space" / "Full Space" 용어 최초 공개** |
| 2023 | Project Iris 내부 취소 |
| **2024-12-12** | **Android XR 공식 발표** (뉴욕). Google + Samsung + Qualcomm 합작. Developer Preview 1, Jetpack XR SceneCore 1.0.0-alpha01 동시 공개 |
| 2025-05 | Developer Preview 2 (Google I/O 2025). Unity 도구 SDK 포함 |
| **2025-10** | **Samsung Galaxy XR 출시** ($1,799). Snapdragon XR2+ Gen 2. 첫 상용 Android XR 기기. 코드명 "Moohan(무한)" |
| 2025-12 | Developer Preview 3. AI 글래스 지원 추가 |
| 2026-05 | Jetpack XR SceneCore 1.0.0-alpha14 — **여전히 alpha**, stable 미도달 |

## "Home Space" / "Full Space" 용어 선후 관계

```
2023-06  Apple visionOS  "Shared Space" / "Full Space" 공식 도입 (WWDC23)
   │
   │     ≈18개월 후
   ▼
2024-12  Android XR      "Home Space" / "Full Space (Managed/Unmanaged)" 도입
   │
   │     ≈15개월 후
   ▼
2026-03  PICO OS 6       "Shared Space" / "Full Space" 도입
```

**의도적 모방인가, 자연 수렴인가?**: Khronos OpenXR 스펙에는 이 용어가 없다. 즉 플랫폼 레이어에서 각 사가 독립 정의했다. Apple이 먼저인 것은 사실이나 Google의 공식 인정은 없으며 자연 수렴 가능성도 있음 — **확실치 않음**.

다만 Microsoft HoloLens(2015)와 Meta Quest(2019) 시점부터 "2D 슬레이트 공존 + 단독 holographic 앱" 이중 모델은 이미 존재했다. Apple/Google은 이 구조에 일관된 명칭을 부여한 셈이다.

## Jetpack XR SceneCore 버전 진행

| 버전 | 날짜 | 주요 변경 |
|------|------|-----------|
| 1.0.0-alpha01 | 2024-12-12 | 최초 릴리스 (PanelEntity, GltfModelEntity, SpatialEnvironment, SpatialAudio) |
| alpha02 | 2025-02-12 | 팩토리 메서드를 `Session`에서 각 클래스 companion object로 이동 |
| alpha04 | 2025-05-07 | StereoSurfaceEntity MV-HEVC 지원, 비동기 히트테스트 |
| alpha05 | 2025-07-30 | 대규모 리팩터(`PixelDimensions→IntSize2d`, `ActivityPose→ScenePose`, suspend 함수) |
| alpha07 | 2025-09-24 | `launchActivity()` → `startActivity()` |
| alpha08 | 2025-10-22 | `moveActivity()` → `transferActivity()`, Galaxy XR 출시 시점 |
| alpha09 | 2025-11-19 | 상수 Int → sealed object 전환, listener → `Consumer<T>` |
| alpha13 | 2026-03-25 | GltfAnimation API, ScenePose API 변경 |
| alpha14 | 2026-05-06 | `TrackingState`를 xr-arcore로 이동, `Plane.Type`→`PlaneType`, `XrLog` API |

> Stable 릴리스는 **2026-05 기준 미달성**. API 불안정 단계임을 항상 염두에 두어야 한다.

---

# 5. 학술 / 이론적 배경

## OpenXR 1.1 표준

Android XR는 **Khronos OpenXR 1.1**을 준수하며 2024-12에 conformance를 달성했다. OpenXR 1.1은 2024-04-15 Khronos 배포로, 여러 확장을 코어로 통합해 파편화를 줄였다.

`FULL_SPACE_UNMANAGED` 모드가 OpenXR 전용인 이유: OpenXR 스펙 자체가 앱이 `xrBeginFrame`/`xrEndFrame` 렌더 루프를 직접 구동하도록 설계되어 있다. 시스템이 이 루프에 개입하는 건 OpenXR 아키텍처와 충돌한다.

## Google Android 벤더 확장

| 확장 | 용도 |
|------|------|
| `XR_ANDROID_spatial_object_tracking` | 환경 내 객체 추적 |
| `XR_ANDROID_spatial_discovery_raycast` | 레이캐스트 기반 spatial entity 검색 |
| `XR_ANDROID_spatial_entity_bound_anchor` | spatial entity에 앵커 부착 |
| `XR_KHR_android_surface_swapchain` | Android Surface ↔ OpenXR swapchain 연결 (zero-copy 비디오 경로의 핵심) |

## 공식 1차 출처 URL

- 전체 XR 개요: https://developer.android.com/develop/xr
- Home → Full Space 전환: https://developer.android.com/develop/xr/jetpack-xr-sdk/transition-home-space-to-full-space
- 몰입형 경험 시작: https://developer.android.com/develop/xr/jetpack-xr-sdk/build-immersive
- OpenXR 시작하기: https://developer.android.com/develop/xr/openxr/get-started
- SpatialCapabilities 확인: https://developer.android.com/develop/xr/jetpack-xr-sdk/check-spatial-capabilities
- Session 추가: https://developer.android.com/develop/xr/jetpack-xr-sdk/add-session
- SceneCore 릴리스 노트: https://developer.android.com/jetpack/androidx/releases/xr-scenecore
- Unity 설정: https://developer.android.com/develop/xr/unity/setup
- Codelab Part 1 (Modes & Spatial Panels): https://developer.android.com/codelabs/xr-fundamentals-part-1

---

# 6. 모드 비교표

## HOME_SPACE vs FULL_SPACE_MANAGED vs FULL_SPACE_UNMANAGED

| 항목 | HOME_SPACE | FULL_SPACE_MANAGED | FULL_SPACE_UNMANAGED |
|------|-----------|--------------------|---------------------|
| **대상 SDK** | Jetpack XR SDK | Jetpack XR SDK | OpenXR / Unity / Unreal / WebXR |
| **다른 앱과 공존** | 가능 (멀티태스킹) | 불가 (단독) | 불가 (단독) |
| **Spatial Panel** | 불가 | 가능 | N/A (앱이 OpenXR로 자체 구성) |
| **3D 모델 (SceneCore)** | 불가 | 가능 | N/A |
| **앱 자체 Environment** | 불가 (시스템 환경만) | 가능 | 앱 전체 제어 |
| **Spatial Audio** | 불가 | 가능 | OpenXR 오디오 확장 |
| **System UI(제스처 메뉴 등)** | 표시됨 | 표시됨 | **최소화**, 시스템 제스처는 OpenXR 세션에 전달 |
| **렌더 루프 소유자** | Android XR 시스템 | Android XR 시스템 (SceneCore 통해) | **앱 자신** (`xrBeginFrame`/`xrEndFrame`) |
| **창 기본 크기** | 1024×720 dp (385~2560 dp) | 제한 없음 | 전체 뷰포트 |
| **앱 시작 거리** | 사용자로부터 1.75 m | 앱이 설정 | 앱이 설정 |
| **passthrough 제어** | 불가 | 가능 (`PASSTHROUGH_CONTROL` capability) | OpenXR passthrough 확장 |
| **프로그래밍 전환** | `requestHomeSpaceMode()` | `requestFullSpaceMode()` | 전환 없음 (항상 Full) |

## 시각적 차이

```
HOME_SPACE
┌─────────────────────────────────────────────┐
│   [시스템 환경 / passthrough]                │
│                                              │
│   ┌────────┐  ┌────────┐  ┌────────┐        │
│   │ Settings│  │Browser │  │YouTube │        │
│   │ (1024dp)│  │        │  │        │        │
│   └────────┘  └────────┘  └────────┘        │
│         (각 앱은 2D 패널, 시스템이 위치 관리)│
└─────────────────────────────────────────────┘

FULL_SPACE_MANAGED  (Jetpack XR / SceneCore)
┌─────────────────────────────────────────────┐
│   [앱 환경 (SpatialEnvironment)]              │
│                                              │
│       ┌──────────────────────┐              │
│       │  PanelEntity         │              │
│       │  (Compose UI)        │              │
│       └──────────────────────┘              │
│           ╱╲                                 │
│          ╱  ╲   GltfModelEntity              │
│         ╱    ╲   (3D 모델)                   │
│                                              │
│   (시스템이 렌더 루프 + 공간 전환 관리)       │
└─────────────────────────────────────────────┘

FULL_SPACE_UNMANAGED  (Unity / OpenXR)
┌─────────────────────────────────────────────┐
│   [앱이 OpenXR로 직접 구성한 모든 것]         │
│                                              │
│         (엔진이 직접 xrEndFrame에            │
│          composition layers 제출)            │
│                                              │
│   • Projection layer (스테레오 eye buffer)   │
│   • Quad/Cylinder layer (UI)                 │
│   • Equirect2 layer (360°)                   │
│   • Passthrough layer                        │
│                                              │
│   (Android XR 시스템 컴포지터는 개입 X)       │
└─────────────────────────────────────────────┘
```

---

# 7. 왜 Unity / OpenXR 앱은 UNMANAGED를 써야 하는가

Unity, Unreal Engine, 순수 OpenXR 네이티브 앱은 **자체 렌더 루프**를 가진다. 이 루프는 엔진이 매 프레임 다음을 직접 호출한다.

```
xrWaitFrame()
   │
xrBeginFrame()
   │
[엔진 렌더링: 좌/우 eye XrSwapchain에 그리기]
   │
xrEndFrame(layers = [Projection, Quad, ...])
```

Android XR 시스템 컴포지터가 이 루프 중간에 끼어들어 SceneCore Entity 시스템을 삽입할 방법이 없다. UNMANAGED는 시스템에게 **"이 앱은 스스로 XR 렌더링을 완전히 관리한다"**고 신호하여 충돌 없이 Full Space를 부여한다.

## Unity의 자동 처리

Unity Android XR OpenXR 패키지(`com.unity.xr.androidxr-openxr`)는 빌드 시 AndroidManifest에 다음을 자동 삽입한다.

```xml
<application ...>
    <property
        android:name="android.window.PROPERTY_XR_ACTIVITY_START_MODE"
        android:value="XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED" />
    <activity android:name="com.unity3d.player.UnityPlayerActivity" ...>
        ...
    </activity>
</application>
```

> **함정**: 개발자가 별도로 직접 추가하면 **중복 선언**으로 빌드 오류. Unity 패키지가 처리한다는 사실을 모르고 수동 추가하는 실수가 흔하다.

---

# 8. 디스플레이 컴포지션의 차이 — 왜 Android 2D View가 안 보이는가

> **TIL의 핵심 디버깅 포인트**: `addContentView(WebView, layoutParams)` 로 Unity Activity 위에 얹은 WebView가 헤드셋엔 안 보였지만 Chromium MediaCodec/audio focus는 정상 — 이 현상의 아키텍처적 이유.

## 일반 Android 2D 앱 — 정상 경로

```
[앱 코드]
   Activity.addContentView(WebView)
       │
       ▼
[DecorView / ViewGroup 트리]
   measure / layout / draw
       │
       ▼
[ViewRootImpl]
   - Window 단위 Surface 보유
   - Choreographer가 VSync 시 performTraversals()
   - ThreadedRenderer (HW 가속) 또는 Canvas (SW)
       │
       ▼
[Surface / BufferQueue]
   - 앱이 Producer, SurfaceFlinger이 Consumer
   - Gralloc 그래픽 버퍼에 픽셀 기록
       │
       ▼
[WindowManager]
   - 각 Window 별 SurfaceControl 메타데이터 (Z-order, position)
       │
       ▼
[SurfaceFlinger]
   - 모든 BufferQueue 합성 (HWC 또는 GL)
   - HWC → 디스플레이로 출력
       │
       ▼
[물리적 디스플레이 (스마트폰 화면)]
```

## Full Space Unmanaged — 컴포지터가 디스플레이를 직접 소유

`XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED`를 매니페스트에 선언하는 순간, Android XR 시스템은 **이 앱이 OpenXR을 직접 사용한다**고 인식하고 시스템 관리형 윈도우 컴포지션을 적용하지 않는다.

Google 공식 문구:

> "Unmanaged Full Space signals to Android XR the app uses OpenXR."

기술 분석:

> "The compositor operates **outside the standard Android SurfaceFlinger pipeline**, giving it direct, low-level control over the display hardware. This is key to achieving sub-20ms Motion-to-Photon latency."
> "Android XR moved away from the traditional SurfaceFlinger pipeline...utilizing a direct front-buffer rendering system."

OpenXR 런타임은 `ANativeWindow`(C/C++ 레벨 Surface)를 직접 획득해 그 위에 `VkSurfaceKHR`(Vulkan) 또는 `EGLSurface`(GLES)를 만들어 렌더링한다.

```
[기존 Android 디스플레이 경로]   SurfaceFlinger → HWC → 헤드셋 디스플레이 패널
                                            ↓ (이 경로는 헤드셋과 연결되지 않음)

[Full Space Unmanaged 경로]      OpenXR Runtime Compositor (ATW + 왜곡보정) → 헤드셋 패널
```

## 그래서 `addContentView(WebView)`의 픽셀은 어디로?

```
+---------------------------------------------------+
|             Android 앱 프로세스                    |
|                                                   |
|  Activity.addContentView(WebView)                 |
|        │                                          |
|        ▼                                          |
|  ViewRootImpl  (살아있음, 정상 동작)                |
|        │                                          |
|        ▼                                          |
|  Surface / BufferQueue  (픽셀 기록됨)              |
|        │                                          |
|        ▼                                          |
|  SurfaceFlinger  (레이어 합성 시도)                |
|        │                                          |
|        │ ← 여기서 경로 단절                        |
+--------|------------------------------------------+
         │ SurfaceFlinger 출력은 일반 Android 디스플레이 경로
         │ (헤드셋에서는 OpenXR 런타임이 우회/대체)
         │
         X (헤드셋 화면에 도달 불가)

+---------------------------------------------------+
|         OpenXR Runtime Compositor                 |
|                                                   |
|  xrEndFrame() layers 목록에 없음                   |
|  → 헤드셋에 합성되지 않음                          |
+---------------------------------------------------+
```

**정리**:

1. `ViewRootImpl`은 살아있고 WebView도 정상 렌더링한다.
2. `SurfaceFlinger`도 해당 레이어를 합성한다.
3. 하지만 헤드셋에선 SurfaceFlinger의 전통적 디스플레이 출력 경로가 OpenXR 런타임에 의해 우회/대체된다.
4. OpenXR 컴포지터는 `xrEndFrame()`에 **명시적으로 제출된 composition layer만** 헤드셋 렌더링에 반영한다.
5. `addContentView`로 붙인 뷰는 어떤 composition layer에도 포함되지 않는다 → 표시 안 됨.
6. 그래서 WebView 자체는 살아 동작(MediaCodec 디코딩, audio focus 점유)하지만 **그 픽셀이 헤드셋 디스플레이에 도달할 수 없다.**

> **유사 선례**: Unity 5.6에서 `setZOrderOnTop`으로 Unity의 SurfaceView가 상단에 배치되면 광고 뷰가 "보이지 않지만 클릭은 됨". XR에서는 이보다 훨씬 근본적인 단절이다.

## 그래서 어떻게 보이게 만드나 (4가지 길)

| 방법 | 적용 대상 | 핵심 |
|------|-----------|------|
| **A. PanelEntity / SpatialPanel** | Jetpack XR SDK 네이티브 앱 (Java/Kotlin) | `SurfaceControlViewHost`로 View 트리를 SceneCore가 관리하는 Surface에 연결 |
| **B. ActivityPanelEntity** | Jetpack XR SDK 네이티브 앱 | 다른 Activity 전체를 spatial panel로 끌어올림 (브라우저 Activity 통째로 embed) |
| **C. WebView → Texture (Unity)** | Unity OpenXR 앱 | WebView 픽셀을 SurfaceTexture로 캡처해 Unity Texture2D에 binding, Quad mesh로 렌더 |
| **D. XR Composition Layer + Android Surface** | Unity 또는 네이티브 OpenXR | `XR_KHR_android_surface_swapchain`로 Android Surface를 XrSwapchain producer로 매핑, `XrCompositionLayerQuad`로 제출 |

> Unity FULL_SPACE_UNMANAGED 앱에서 A/B는 **공식 미지원**, C/D가 실용 경로 — 자세한 비교는 별도 문서 [`android-xr-unity-video-youtube-재생.md`](android-xr-unity-video-youtube-재생.md)에 정리.

---

# 9. 플랫폼 비교 — visionOS / Horizon / PICO / HoloLens

## 핵심 4열 비교

| OS | Mixed UI 가능 (다중 앱) | 3D world 독점 | SDK | 제어 권한 |
|----|------------------------|---------------|-----|-----------|
| **Android XR Home Space** | O (2D 패널) | X | Jetpack XR SDK | 낮음 |
| **Android XR Full Space Managed** | X | O | Jetpack XR SDK | 높음 |
| **Android XR Full Space Unmanaged** | X | O | OpenXR / Unity / Unreal | **최고** |
| **visionOS Shared Space** | O (Window + Volume) | X | SwiftUI + RealityKit | 낮음 |
| **visionOS Full .mixed** | X | 부분 (passthrough 위) | ImmersiveSpace + RealityKit + ARKit | 중-높음 |
| **visionOS Full .progressive** | X | 부분 (Digital Crown 조절) | ImmersiveSpace | 중간 |
| **visionOS Full .full** | X | O (passthrough 차단) | ImmersiveSpace | 높음 |
| **Meta Horizon Panel/Home** | O (≤6창, v67+) | X | 표준 Android SDK | 낮음 |
| **Meta Horizon Immersive VR** | X | O | Meta XR SDK / OpenXR | 높음 |
| **Meta Horizon Hybrid** | 부분 (동일 앱 내) | 부분 | Meta Spatial SDK | 중간 |
| **Meta Horizon Boundaryless MR** | X | O (MR) | Meta Spatial SDK + Passthrough API | 높음 |
| **PICO OS 6 Shared Space** | O | X | PICO Spatial SDK + OpenXR | 중간 |
| **PICO OS 6 Full Space** | X | O | OpenXR / Unity / Unreal | 높음 |
| **HoloLens 2 MR Home** | O (2D UWP slates) | X | UWP + MRTK + OpenXR | 낮음 |
| **HoloLens 2 Holographic Exclusive** | X | 부분 (see-through 강제) | Holographic DirectX + MRTK + OpenXR | 높음 |

## 다중 앱 공존(Mixed UI) 비교

| 플랫폼 | 동시 앱 수 | 공존 콘텐츠 |
|--------|-----------|-------------|
| Android XR Home Space | 다수 | 2D 패널만 |
| visionOS Shared Space | 다수 | 2D Window + 3D Volume(경계 있음) |
| Meta Horizon Home | ≤6 (v67+) | 2D 패널만 |
| HoloLens 2 MR Home | 다수 | 2D UWP slate만 |
| PICO OS 6 Shared Space | 다수 | 2D + 3D (확실치 않음, 새 OS) |

> 가장 풍부한 3D 공존: **visionOS Shared Space**. Volume까지 혼합 가능.
> 가장 유연한 다중 창 배치: **Meta Horizon Home v67+**. 6창 동시.

## Passthrough / world tracking

| 플랫폼 | Passthrough 방식 | World Tracking SDK |
|--------|------------------|--------------------|
| Android XR | 카메라 컬러 패스스루 (Galaxy XR) | ARCore for Jetpack XR (plane / hand / face / depth / 6DoF / geospatial) |
| visionOS | 실시간 3D 패스스루 (Vision Pro 전용 EyeSight) | ARKit (Shared Space 한정 시스템 ARKit, Full Space에서 사용자 승인 후 고급 API) |
| Meta Horizon | 컬러 패스스루 (Quest 3/3S, Quest 2는 흑백) | Quest 3+ depth API, plane, scene understanding, spatial anchors, Passthrough Camera API (v76+) |
| HoloLens 2 | **광학 see-through** (카메라 패스스루 아님) | `XR_MSFT_spatial_anchor` / `XR_MSFT_scene_understanding` |
| PICO 4 Ultra | 컬러 패스스루 | (확실치 않음 — OS 6 신규) |

## OpenXR 표준화의 위치

OpenXR이 표준화하는 것:

- 좌표계 (`XrSpace`, `XrReferenceSpaceType`)
- 렌더링 합성 (`XrCompositionLayer*`)
- 하드웨어 환경 블렌드 (`XrEnvironmentBlendMode`)

OpenXR이 표준화하지 않는 것 — **각 OS 독자 구현**:

- 다중 앱 공존(Shared Space) 개념
- 앱 윈도잉 / Activity Start Mode
- 시스템 환경(스카이박스) 관리

따라서 `XR_ENVIRONMENT_BLEND_MODE_OPAQUE` ↔ "VR Immersive", `ALPHA_BLEND` ↔ "MR/Mixed", `ADDITIVE` ↔ "광학 AR" 정도가 OpenXR 레벨의 추상화이며, "한 공간에 여러 앱이 있을 수 있는가"는 그 위 OS 레이어의 결정이다.

---

# 10. 상황별 최적 선택

| 앱 유형 | 권장 모드 | 이유 |
|--------|-----------|------|
| Settings / Browser / 메모 등 일반 2D 앱 | `HOME_SPACE` | 기존 모바일/태블릿 코드 그대로, 멀티태스킹 |
| Jetpack Compose 3D 모델 뷰어 / 공간 미디어 플레이어 | `FULL_SPACE_MANAGED` | SceneCore Entity로 3D 콘텐츠, 시스템이 라이프사이클 관리 |
| Unity 기반 XR 게임 / Unreal / 순수 OpenXR | `FULL_SPACE_UNMANAGED` | 엔진 자체 렌더 루프, `XrSession` 직접 구동 필요 |
| 2D 앱이지만 특정 화면에서 몰입 전환 | `HOME_SPACE` + `requestFullSpaceMode()` | 멀티태스킹과 몰입을 모두 지원 |

**공식 권장**: 앱이 항상 공간을 독점할 이유가 없다면 `HOME_SPACE` 기본. Cooking Assistant처럼 현실 객체 인식 + world-space 패널이 필요한 풀 XR 앱은 `FULL_SPACE_UNMANAGED`(Unity 사용 시).

---

# 11. 실전 베스트 프랙티스 + 함정

## Manifest 위치

`<property>` 요소는 **`<application>` 또는 `<activity>` 안**에 둔다. `<manifest>` 루트 직속에 두면 무시된다.

**application 레벨 (앱 전체 기본값)**

```xml
<application ...>
    <property
        android:name="android.window.PROPERTY_XR_ACTIVITY_START_MODE"
        android:value="XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED" />
    <activity android:name=".MainActivity" ... />
</application>
```

**activity 레벨 (특정 Activity만)**

```xml
<activity android:name=".ImmersiveActivity" ...>
    <property
        android:name="android.window.PROPERTY_XR_ACTIVITY_START_MODE"
        android:value="XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED" />
</activity>
```

## 흔한 함정 7가지

1. **Jetpack XR 앱에 UNMANAGED 설정**: SceneCore Session과 충돌. PanelEntity, 3D Entity 동작 불가.
2. **OpenXR 앱에 MANAGED 설정**: OpenXR 렌더 루프 ↔ 시스템 컴포지터 충돌.
3. **property 미선언**: 기본은 HOME_SPACE처럼 동작하나 명시 안 하면 시스템 동작이 보장되지 않는다. **반드시 명시**.
4. **Session 재생성 누락**: Main Panel 리사이즈, 주변기기 연결, 테마 변경(라이트/다크) 시 Activity 재생성 → Session 무효화. `onDestroy`/`onCreate` 사이클에서 Session 재생성 필요.
5. **SpatialCapability 변화 감지 누락**: Full Space라도 시스템 상태/제스처로 capability 변경 가능. `addSpatialCapabilitiesChangedListener` 필수.
6. **Unity AndroidManifest 중복 선언**: Unity OpenXR 패키지가 자동 삽입. 수동 추가하면 중복 빌드 오류.
7. **XR 전용 vs 모바일 트랙 혼동**:
   - `android.software.xr.api.spatial` feature `required="true"` → XR 기기 전용 트랙
   - `required="false"` → 기존 모바일 + XR 동시 배포

## 코드 패턴

**SpatialCapability 확인**

```kotlin
if (xrSession.scene.spatialCapabilities.contains(SpatialCapability.EMBED_ACTIVITY)) {
    // ActivityPanelEntity 사용 가능
}

xrSession.scene.addSpatialCapabilitiesChangedListener { caps ->
    // 동적 capability 변화 감지
}
```

**Home → Full 프로그래밍 전환**

```kotlin
xrSession.scene.requestFullSpaceMode()  // Home → Full
xrSession.scene.requestHomeSpaceMode()  // Full → Home
```

---

# 12. 빅테크 실전 사례

## Google 자체 앱

| 앱 | 모드 | 비고 |
|----|------|------|
| **Google Maps Immersive XR** | `FULL_SPACE_UNMANAGED` (Unity) | Unity로 구현된 Immersive View. Google I/O 2025 Galaxy XR 쇼케이스. 3D 세계를 걸어다니는 풀 VR 경험 |
| **Google Photos XR** | `FULL_SPACE_MANAGED` 또는 HOME+전환 (추정) | Auto-Spatialized 2D→3D 변환 |
| **YouTube XR** | HOME 기본 + Full 전환 (추정) | 360° 영상, 자동 입체화, NFL 멀티뷰 |
| **Gemini** | HOME_SPACE | AI 어시스턴트, 다른 앱과 공존 |

> Google Maps Immersive: `com.unity.xr.androidxr-openxr` 패키지 경유 → Unity가 자동으로 `FULL_SPACE_UNMANAGED` manifest 삽입. (1차 출처: Unity 공식 사례 페이지, UploadVR Galaxy XR 리뷰)

## Samsung 자체 앱

| 앱 | 모드 (추정) | 비고 |
|----|-------------|------|
| Spatial Cinema (Samsung TV Plus) | `FULL_SPACE_MANAGED` | 가상 시네마 환경에서 영상 시청 |
| Samsung Gallery XR | HOME + Full 전환 가능 | 사진/영상 공간 뷰어 |
| One UI XR 홈 런처 | 시스템 레벨 | Galaxy XR Home Space 자체 |

## 서드파티 사례

| 앱 | 모드 | 비고 |
|----|------|------|
| **Calm** | HOME 또는 MANAGED | 2주 만에 모바일 → 공간 앱 전환. Google 공식 케이스 스터디 |
| Netflix, Peacock | HOME_SPACE | 기존 스트리밍 앱, 수정 없이 Home Space 동작 |
| NBA League Pass | (확인 안 됨) | Galaxy XR 출시 앱 목록 |

> **주의**: 위 표 중 Google Maps/Unity 연동만 1차 출처에서 직접 확인. 나머지는 앱 유형(Unity/Jetpack)과 공개 정보로 추정 — **확실치 않음** 항목 다수.

---

# 13. 함정 카드 / 빠른 진단

| 증상 | 원인 후보 | 해결 |
|------|-----------|------|
| `addContentView(View)` 한 뷰가 헤드셋에 안 보임 | Full Space Unmanaged 컴포지션 단절 | WebView-to-Texture(C) 또는 Composition Layer + Surface(D) 경로로 전환 |
| Toast/Dialog가 안 보임 | 같은 이유 | SpatialPanel 또는 in-engine UI로 대체 |
| Build 에러: `PROPERTY_XR_ACTIVITY_START_MODE` 중복 | Unity 자동 삽입 + 수동 추가 | 수동 추가 제거 |
| `EMBED_ACTIVITY` capability false | UNMANAGED 모드라 ActivityPanel 미지원 | C/D 경로로 우회 |
| Theme 변경 후 black screen | Activity 재생성 → Session 무효 | `onCreate`에서 Session 재생성 |
| MANAGED인데 PanelEntity 안 보임 | property 위치 잘못됨 (`<manifest>` 직속 등) | `<application>` 또는 `<activity>` 안으로 이동 |

---

# 14. 핵심 출처

- Android XR Foundations: https://developer.android.com/design/ui/xr/guides/foundations
- Transition Home ↔ Full Space: https://developer.android.com/develop/xr/jetpack-xr-sdk/transition-home-space-to-full-space
- Build immersive experiences: https://developer.android.com/develop/xr/jetpack-xr-sdk/build-immersive
- OpenXR for Android XR: https://developer.android.com/develop/xr/openxr/get-started
- OpenXR extensions: https://developer.android.com/develop/xr/openxr/extensions
- XR SceneCore releases: https://developer.android.com/jetpack/androidx/releases/xr-scenecore
- Check spatial capabilities: https://developer.android.com/develop/xr/jetpack-xr-sdk/check-spatial-capabilities
- Add session: https://developer.android.com/develop/xr/jetpack-xr-sdk/add-session
- Unity setup: https://developer.android.com/develop/xr/unity/setup
- Unity package docs: https://docs.unity3d.com/Packages/com.unity.xr.androidxr-openxr@0.4/manual/index.html
- Codelab Part 1: https://developer.android.com/codelabs/xr-fundamentals-part-1
- Android XR SDK Developer Preview Blog (2024-12): https://android-developers.googleblog.com/2024/12/introducing-android-xr-sdk-developer-preview.html
- Developer Preview 2 Blog (2025-05): https://android-developers.googleblog.com/2025/05/updates-to-android-xr-sdk-developer-preview.html
- Android XR Spaces & Multitasking Help: https://support.google.com/android-xr/answer/16638859
- Khronos OpenXR 1.1: https://www.khronos.org/news/press/khronos-releases-openxr-1.1-to-further-streamline-cross-platform-xr-development
- XrSpace: https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrSpace.html
- XrEnvironmentBlendMode (1.0 spec): https://registry.khronos.org/OpenXR/specs/1.0/html/xrspec.html
- xrCreateSwapchainAndroidSurfaceKHR: https://registry.khronos.org/OpenXR/specs/1.1/man/html/xrCreateSwapchainAndroidSurfaceKHR.html
- visionOS Shared Space / Full Space (WWDC23): https://developer.apple.com/videos/play/wwdc2023/10111/
- Meta Hybrid Apps: https://developers.meta.com/horizon/documentation/spatial-sdk/hybrid-apps-overview/
- Microsoft MR 2D UWP: https://learn.microsoft.com/en-us/windows/mixed-reality/develop/porting-apps/building-2d-apps
- TechCrunch Android XR launch: https://techcrunch.com/2024/12/12/google-announces-android-xr-platform-will-launch-first-on-samsungs-project-moohan-device/
- UploadVR Google Maps on Galaxy XR: https://www.uploadvr.com/android-xr-google-maps-best-galaxy-xr/
- Wikipedia Android XR / visionOS / Samsung Galaxy XR
