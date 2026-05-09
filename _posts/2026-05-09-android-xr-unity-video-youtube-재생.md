---
layout: single
title: "Android XR Unity Full Space 비디오 / YouTube 재생 아키텍처"
date: 2026-05-09 23:01:00 +0900
categories: frontend
excerpt: "Android XR Unity Full Space에서 비디오와 YouTube 재생은 Android 2D View 경로가 아니라 OpenXR composition layer나 XR-aware Surface 경로로 보내야 안정적으로 표시된다."
toc: true
toc_sticky: true
tags: [androidxr, unity, youtube, openxr, videoplayback]
source: "/home/dwkim/dwkim/docs/xr/android-xr-unity-video-youtube-재생.md"
---

TL;DR
- Unity Full Space Unmanaged 앱에서는 Android View 트리에 올린 WebView 비디오가 헤드셋 화면으로 자동 전달되지 않는다.
- 자체 보유 영상은 ExoPlayer·Media3와 Composition Layer·SurfaceEntity 조합이 가장 적합하고, YouTube는 IFrame Player API 제약 때문에 별도 경로를 고려해야 한다.
- ActivityPanelEntity, WebView-to-Texture, XR Composition Layer + Android Surface 같은 전략을 장단점과 합법성 관점까지 나눠 비교한다.

## 1. 개념
Android XR Unity Full Space 비디오 재생 문제는 Android 2D UI 경로와 OpenXR 컴포지터 경로가 분리되어 있다는 점에서 출발하며, 콘텐츠 종류에 따라 WebView, ExoPlayer, Composition Layer, SurfaceEntity를 다르게 선택해야 해결된다.

## 2. 배경
Unity 기반 Android XR 앱에서 YouTube WebView는 살아 있지만 화면에는 보이지 않는 현상이 반복되면서, 일반 Android 미디어 파이프라인과 OpenXR Full Space 파이프라인의 차이를 구조적으로 설명할 필요가 커졌다.

## 3. 이유
이 아키텍처를 알아야 YouTube 임베드, direct media URL, DRM, Composition Layer, WebView-to-Texture 중 무엇이 합법적이고 무엇이 기술적으로 가능한지 빠르게 판단할 수 있다.

## 4. 특징
- YouTube watch URL과 direct media URL의 차이, IFrame API 제약, yt-dlp 방식의 문제를 한 번에 정리한다
- ExoPlayer·Media3·MediaCodec과 OpenXR composition layer를 연결하는 XR 비디오 경로를 설명한다
- Unity Full Space에서 ActivityPanelEntity, WebView-to-Texture, Composition Layer 전략을 실제 선택지로 비교한다
- Widevine DRM, 180°·360° 비디오, spatial audio까지 포함해 XR 비디오 재생 설계 관점을 넓혀 준다

## 5. 상세 내용

# Android XR Unity Full Space 비디오 / YouTube 재생 아키텍처

> **작성일**: 2026-05-09
> **카테고리**: XR / Android XR / Unity / OpenXR / Media / Video Playback
> **포함 내용**: YouTube watch URL vs direct media URL, googlevideo.com signed URL, signatureCipher, n-parameter throttling, Widevine DRM, IFrame Player API (2008-2017 evolution), JS Player API deprecation, YouTube Data API v3, youtube-dl/yt-dlp ToS, RIAA DMCA 1201, MediaCodec (Android 4.1, 2012), MediaCodec state machine, BufferQueue, Surface, SurfaceView, SurfaceTexture, TextureView, SurfaceFlinger, ExoPlayer / Media3, MediaCodecVideoRenderer, Jetpack Media3, OpenXR Composition Layer (Projection/Quad/Cylinder/Equirect2/Cube/Passthrough/Depth), XR_KHR_android_surface_swapchain, XR_KHR_composition_layer_*, XR_FB_composition_layer_depth_test, ATW (Asynchronous TimeWarp), Late Latching, Predicted Display Time, Foveated Rendering, ActivityPanelEntity, Session, SpatialCapability.EMBED_ACTIVITY, SurfaceEntity (StereoMode SIDE_BY_SIDE / TOP_BOTTOM / MULTIVIEW_LEFT_PRIMARY), Shape (Quad / Hemisphere / Sphere / Cylinder), SurfaceProtection.PROTECTED, SpatialExternalSurface (Compose for XR), Subspace, SpatialPanel, MV-HEVC, VP9, AV1, H.265, Dolby Atmos, MediaSession, MediaSessionService, AudioFocus, PointSourceParams, WebView, GeckoView, TLabWebView, Vuplex 3D WebView, AVPro Video (RenderHeads), Unity VideoPlayer, OVROverlay (Meta), Meta XR SDK, OpenXRLayerUtility.GetLayerAndroidSurfaceObject, Unity XR Composition Layers package, FULL_SPACE_UNMANAGED, Cooking Assistant 케이스, YouTube VR app (OpenXR 전환 2023-04), Juno (Christian Selig), Apple visionOS 공식 YouTube (2026-02), Pico Browser, Google Daydream, android-youtube-player

---

# 1. 무엇이 문제였나 — TIL의 출발점

## 한 줄 정의

```
┌──────────────────────────────────────────────────────────────────────┐
│            Android XR Unity 비디오/YouTube 재생 한 줄 정의              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  "FULL_SPACE_UNMANAGED Unity 앱에서는 Android 2D View(addContentView    │
│   WebView)의 픽셀이 헤드셋에 자동으로 도달하지 않으므로, 비디오는       │
│   반드시 OpenXR composition layer 또는 SceneCore SurfaceEntity 같은     │
│   XR-aware Surface 경로로 전달되어야 한다. YouTube는 IFrame Player API  │
│   가 유일한 합법 임베드 경로이므로 WebView 또는 Activity embed가 필요    │
│   하다."                                                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## 디버깅 관찰 (TIL)

원본 TIL의 관찰 사항.

- 기존 YouTube bridge는 `activity.addContentView(WebView, layoutParams)`로 Android Native View를 Unity Activity 위에 얹음
- 일반 Android 2D 앱에선 Activity window 내부에서 View들이 합성되어 보였음
- Full Space Unity/OpenXR에서는 사용자가 보는 화면이 Android 2D View tree가 아니라 **Unity가 XR runtime에 제출하는 XR frame/layer**
- 그래서 WebView는 살아 있고 YouTube도 decode/audio playback을 하지만, 그 픽셀이 Unity world-space panel 안에 들어오지 않음
- 로그: Unity는 `Loaded videoId=...`, Chromium `MediaCodec`/audio focus는 정상 → 화면에는 video가 안 보였음

➡ 자세한 컴포지션 단절 메커니즘은 자매 문서 [`android-xr-spaces-activity-start-mode.md`](android-xr-spaces-activity-start-mode.md) §8 참조.

---

# 2. 용어 사전

## YouTube 관련

| 용어 | 의미 |
|------|------|
| **watch URL** | `youtube.com/watch?v=...`, `youtu.be/...` 형태. 페이지 URL이며 미디어 바이트 미포함 |
| **embed URL** | `youtube.com/embed/<id>` 형태. iframe 임베드용 |
| **direct media URL** | mp4, m3u8(HLS), mpd(DASH), webm 등 디코더가 직접 소비하는 URL |
| **googlevideo.com URL** | YouTube가 매 요청마다 동적 생성하는 실제 스트림 URL |
| **signatureCipher** | 암호화 서명. 플레이어 JS에서 변환 알고리즘 추출 필요 |
| **n-parameter** | 속도 제한 우회 토큰. 변환 안 하면 수 KB/s 스로틀 |
| **itag** | 인코딩 프리셋 ID (예: 248=VP9 1080p video-only) |
| **InnerTube API** | `/youtubei/v1/player` POST 엔드포인트. YouTube 내부 클라이언트용 |
| **IFrame Player API** | iframe 안에 YouTube 플레이어 임베드 + JS 제어. 공식 합법 경로 |
| **YouTube Data API v3** | 메타데이터 조회/검색/업로드용. 스트림 URL 접근 불가 |

## Android Media 관련

| 용어 | 의미 |
|------|------|
| **MediaCodec** | Android 4.1(API 16, 2012) 도입 저수준 코덱 API. OMX 기반 HW 디코더 직접 구동 |
| **Surface** | BufferQueue 컨슈머. 디코더 출력을 zero-copy로 전달 |
| **SurfaceTexture** | Surface + GLES 텍스처 조합. `onFrameAvailable` 콜백 + `updateTexImage()` |
| **SurfaceView** | 별도 BufferQueue를 가진 View. SurfaceFlinger가 직접 합성 |
| **TextureView** | View 트리에 합성되는 SurfaceTexture 기반 뷰. HDR 부분 지원 |
| **SurfaceFlinger** | Android 윈도우 컴포지터. 모든 BufferQueue 합성 |
| **ExoPlayer / Media3** | Android 권장 미디어 플레이어. `androidx.media3` (구 ExoPlayer 2.x) |
| **MediaCodecVideoRenderer** | Media3 내부 비디오 렌더러. MediaCodec을 직접 제어 |

## OpenXR / Jetpack XR Composition

| 용어 | 의미 |
|------|------|
| **XrCompositionLayerProjection** | 표준 스테레오 eye buffer 렌더링 |
| **XrCompositionLayerQuad** | 평면 UI / 2D 비디오 패널 |
| **XrCompositionLayerCylinder** | 곡면 UI / 파노라마 일부 (`XR_KHR_composition_layer_cylinder`) |
| **XrCompositionLayerEquirect2** | 360°/180° 영상 (`XR_KHR_composition_layer_equirect2`) |
| **XrCompositionLayerCube** | 큐브맵 스카이박스 |
| **XR_KHR_android_surface_swapchain** | Android Surface ↔ XrSwapchain 연결. zero-copy 비디오 핵심 |
| **XR_FB_composition_layer_depth_test** | Meta 확장. depth 테스트 |
| **ATW** | Asynchronous TimeWarp. 최신 헤드 트래킹 pose로 frame re-projection |
| **Late Latching** | GPU 커맨드 큐에 최신 pose를 실행 직전 주입. ~10ms 지연 감소 |
| **SurfaceEntity** | Jetpack XR SceneCore. ExoPlayer Surface를 spatial entity로 노출 |
| **SpatialExternalSurface** | Compose for XR. SurfaceEntity의 선언형 wrapper |

## DRM

| 용어 | 의미 |
|------|------|
| **Widevine** | Google DRM. L1(TEE 하드웨어), L2(중간), L3(소프트웨어) |
| **EME** | Encrypted Media Extensions. 브라우저 표준 DRM API |
| **SurfaceProtection.PROTECTED** | SceneCore의 보호된 Surface. Widevine L1 콘텐츠 재생용 |

---

# 3. 등장 배경과 이유

## 기존 Android 2D 앱의 비디오 재생

```
[App ExoPlayer]
   │ setVideoSurface(view.holder.surface)
   ▼
[SurfaceView / TextureView] (View 트리)
   │
   ▼
[ViewRootImpl → BufferQueue]
   │
   ▼
[SurfaceFlinger]
   │
   ▼
[디스플레이]
```

이 경로는 SurfaceFlinger를 거쳐 디스플레이로 간다.

## XR에서 같은 경로를 그대로 쓰면 일어나는 일

```
[App ExoPlayer or WebView with <video>]
   │
   ▼
[SurfaceView / WebView Surface]
   │
   ▼
[SurfaceFlinger]
   │
   X ← 헤드셋과 연결되지 않음
```

OpenXR 컴포지터가 디스플레이를 직접 소유하므로 SurfaceFlinger 출력은 헤드셋에 도달하지 않는다.

## 그래서 새 접근이 필요한 이유

XR에서 비디오는 다음 중 하나로 전달되어야 한다.

1. **Android Surface를 XrSwapchain producer로 매핑** (`XR_KHR_android_surface_swapchain`)해서 OpenXR 컴포지터가 직접 합성 — 가장 효율적
2. **Activity 전체를 spatial panel로 끌어올림** (`ActivityPanelEntity`) — 시스템이 합성 처리
3. **WebView 픽셀을 Unity Texture로 끌어와 in-engine quad로 렌더** — 가장 hacky지만 Unity FULL_SPACE_UNMANAGED에서 유일하게 자유로운 경로

---

# 4. 역사적 기원 / 진화 타임라인

## YouTube IFrame Player API

```
2008-03  │ JavaScript API + Flash AS3 Chromeless Player 공개
         │
2010-07  │ IFrame embed 도입 (iOS의 Flash 미지원 대응)
         │
2011-05  │ Google I/O에서 IFrame Player API 발표
         │
2012-06  │ IFrame Player API Experimental → Official
         │
2015-01  │ Flash Player API, JavaScript Player API 공식 deprecated
         │
2017-06  │ Flash/JS Player API 문서 삭제
         │ → IFrame API가 유일 공식 임베드 방법
```

전환 동기: iOS Flash 미지원, 보안 취약점, HTML5 `<video>` 표준화.

## Android MediaCodec / ExoPlayer / Media3

```
2012     │ MediaCodec 도입 (Android 4.1, API 16)
2014     │ ExoPlayer 1.0 공개 (Google I/O 2014)
2018     │ ExoPlayer 2.x 안정화
2022     │ Jetpack Media3 1.0 발표 (ExoPlayer + MediaSession 통합 brand)
2024-12  │ Android XR + SceneCore SurfaceEntity 첫 공개 (Media3 1.6.0+ 권장)
```

## OpenXR Composition Layer

```
2017     │ Khronos OpenXR Working Group 시작
2019-07  │ OpenXR 1.0 spec
2024-04  │ OpenXR 1.1 spec (XR_EXT_local_floor 등 코어 승격)
2024-12  │ Android XR conformant runtime
```

## YouTube DRM 강화 흐름

| 시점 | 변화 |
|------|------|
| 2020-10 | RIAA가 youtube-dl을 DMCA Section 1201 위반으로 GitHub에 신고 → 일시 삭제. EFF 지원 후 복원 |
| 2024-04 | YouTube가 광고 차단 앱(스트리머 포함)에 의도적 버퍼링 유발하기 시작 |
| 2024+ | TVHTML5(TV 클라이언트) 비디오에도 DRM 적용 확대 (HN #43321145) |

## Apple visionOS YouTube

| 시점 | 사건 |
|------|------|
| 2024-02 | **Vision Pro 출시**. Google 공식 앱 없음 → 서드파티 Juno (Christian Selig) WKWebView + IFrame API 방식 |
| 2024-10 | Google이 ToS 위반(UI 수정, 상표 사용)으로 Juno App Store 제거 요청 |
| **2026-02** | Google **공식 YouTube 앱 visionOS 출시**. 3D, VR180, 360°, M5에서 8K 지원 |

## Meta Quest YouTube VR

| 시점 | 사건 |
|------|------|
| 2019-2022 | Daydream 시대 코드를 LibOVR/VrAPI로 포팅 |
| 2022-08 | Meta VrAPI 공식 지원 종료 |
| **2023-04** | YouTube VR 앱 **OpenXR 전환** |
| 2023-09 | 2D 패널 모드 추가 |
| 2024-04 | Quest 3에서 8K SDR 지원 추가 |

---

# 5. 학술 / 이론적 배경

## YouTube의 4계층 방어막

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: URL은 페이지, 미디어 URL은 세션별 동적 생성  │
├──────────────────────────────────────────────────────┤
│ Layer 2: signed URL (expire + IP binding + sig)       │
│          → 서명 없으면 403 Forbidden                  │
├──────────────────────────────────────────────────────┤
│ Layer 3: n-parameter 스로틀링                         │
│          → 서명 해독해도 속도 수 KB/s로 제한           │
├──────────────────────────────────────────────────────┤
│ Layer 4: Widevine DRM (Premium / 영화 콘텐츠)         │
│          → 키가 하드웨어 TEE 내부에만 존재             │
└──────────────────────────────────────────────────────┘
```

비즈니스 이유: 광고 삽입, 분석/추적, Premium 보호, 저작권 계약.

## OpenXR Composition Layer 종류

| 타입 | 구조체 | 확장 | 용도 |
|------|--------|------|------|
| Projection | `XrCompositionLayerProjection` | 코어 | 표준 스테레오 eye buffer |
| Quad | `XrCompositionLayerQuad` | 코어 | 평면 UI, 2D 비디오 |
| Cylinder | `XrCompositionLayerCylinderKHR` | `XR_KHR_composition_layer_cylinder` | 곡면 UI |
| Equirect2 | `XrCompositionLayerEquirect2KHR` | `XR_KHR_composition_layer_equirect2` | 360°/180° 영상 |
| Cube | `XrCompositionLayerCubeKHR` | `XR_KHR_composition_layer_cube` | 큐브맵 |
| Passthrough | `XrCompositionLayerPassthroughFB` | `XR_FB_passthrough` | Meta 카메라 패스스루 |
| Depth | (depth info attached) | `XR_KHR_composition_layer_depth` | 깊이 정보 |

## 1차 출처

- IFrame Player API Reference: https://developers.google.com/youtube/iframe_api_reference
- Player Parameters: https://developers.google.com/youtube/player_parameters
- YouTube API ToS: https://developers.google.com/youtube/terms/api-services-terms-of-service
- Widevine DRM: https://developers.google.com/widevine/drm/overview
- Reverse-Engineering YouTube (Tyrrrz, 2023): https://tyrrrz.me/blog/reverse-engineering-youtube-revisited
- yt-dlp n-throttle issue: https://github.com/yt-dlp/yt-dlp/issues/1796
- RIAA DMCA notice: https://github.com/github/dmca/blob/master/2020/10/2020-10-23-RIAA.md
- EFF — GitHub Reinstates youtube-dl: https://www.eff.org/deeplinks/2020/11/github-reinstates-youtube-dl-after-riaas-abuse-dmca
- MediaCodec (Android Developers): https://developer.android.com/reference/android/media/MediaCodec
- Big Flake MediaCodec: https://bigflake.com/mediacodec/
- SurfaceTexture (AOSP): https://source.android.com/docs/core/graphics/arch-st
- Jetpack Media3: https://developer.android.com/media/media3
- xrCreateSwapchainAndroidSurfaceKHR: https://registry.khronos.org/OpenXR/specs/1.1/man/html/xrCreateSwapchainAndroidSurfaceKHR.html
- Tuncle XR Composition Layers: https://tuncle.blog/en/composition_layer/
- Add spatial video to your app: https://developer.android.com/develop/xr/jetpack-xr-sdk/add-spatial-video
- Use VR Compositor Layers (Meta): https://developers.meta.com/horizon/documentation/unity/unity-ovroverlay/
- Optimizing VR Graphics with Late Latching (Meta): https://developers.meta.com/horizon/blog/optimizing-vr-graphics-with-late-latching/

---

# 6. YouTube URL vs direct media URL

## watch URL이 direct URL이 아닌 이유

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
   │
   └── 페이지 URL. HTML/JSON 메타데이터만 응답. 미디어 바이트 미포함.
```

실제 스트림 URL은 매 요청마다 동적 생성되며 다음 형태다.

```
https://rr12---sn-3c27sn7d.googlevideo.com/videoplayback
  ?expire=1715123456
  &ip=203.0.113.42
  &id=<video-internal-id>
  &itag=248
  &source=youtube
  &requiressl=yes
  &sig=<decoded-signature>
  &n=<throttle-bypass-token>
  ...
```

| 파라미터 | 의미 |
|----------|------|
| `expire` | UNIX timestamp. 보통 ~6시간 후 만료 |
| `ip` | 클라이언트 IP. 다른 IP에서 재사용 불가 |
| `itag` | 인코딩 프리셋 ID |
| `sig` / `signatureCipher` | 암호화 서명. 변조 시 403 |
| `n` | 속도 제한 우회 토큰 |

## 실제 스트림 형식

```
formats (muxed):
  itag=18  → H.264 + AAC, 360p, mp4
  itag=22  → H.264 + AAC, 720p, mp4

adaptiveFormats (분리된 video + audio):
  video:
    itag=137 → H.264, 1080p, mp4
    itag=248 → VP9, 1080p, webm
    itag=313 → VP9, 2160p (4K), webm
  audio:
    itag=251 → Opus, 160kbps, webm
    itag=140 → AAC, 128kbps, mp4

live:
  HLS manifest (.m3u8)
  DASH manifest (.mpd)
```

adaptive format은 video + audio 별도 다운로드 후 mux 필요. 브라우저는 MSE(Media Source Extensions)로, yt-dlp는 ffmpeg로.

## YouTube가 direct mp4를 막는 이유

| 이유 | 설명 |
|------|------|
| 광고 삽입 | 스트림 노출 시 광고 우회 가능 |
| 분석/추적 | 공식 플레이어로만 시청 데이터 수집 |
| 수익 보호 | Premium 구독, 영화/구매 콘텐츠 |
| 저작권 | 콘텐츠 권리자 계약 이행 |

## youtube-dl / yt-dlp의 ToS 위반

YouTube ToS:

> "You may not download any Content unless a 'download' button or similar link is displayed by YouTube for that Content."

YouTube API ToS:

> "No rights or licenses are granted to reproduce or distribute audiovisual content or make audiovisual content available in any manner other than through the use of the YouTube API Services."

2020-10에 RIAA가 youtube-dl을 DMCA Section 1201 위반으로 신고하여 GitHub에서 일시 삭제. EFF 지원으로 복원되었지만 ToS 위반 자체는 명확하다.

➡ **결론**: yt-dlp 계열로 mp4 URL 추출해 ExoPlayer에 공급하는 방식은 **ToS 위반 + 2024년부터 YouTube가 의도적 장애 유발**.

---

# 7. 3가지 표시 전략

## 전략 A — ActivityPanelEntity (Jetpack XR SceneCore)

### 아키텍처

```
[Host Activity]
        │ Session.create(activity)
        ▼
[XrSession]
        │ ActivityPanelEntity.create(session, dims, name, pose)
        ▼
[ActivityPanelEntity]
        │ panel.startActivity(intent)  또는  panel.transferActivity(activity)
        ▼
[YouTubePlayerPanelActivity (또는 브라우저 Activity)]
        │
        ▼
[WebView + YouTube IFrame API]
        │
        ▼
[OS-level 합성 → 헤드셋]
```

### API 호출

```kotlin
val panel = ActivityPanelEntity.create(
    session       = xrSession,
    windowBoundsPx = Dimensions(1280, 720),
    name          = "youtube-panel",
    pose          = Pose(Vector3(0f, 0f, -1.5f))
)

if (xrSession.scene.spatialCapabilities.contains(SpatialCapability.EMBED_ACTIVITY)) {
    panel.startActivity(Intent(this, YouTubePlayerActivity::class.java))
}
```

### 메서드 변경 이력

| 버전 | 변경 |
|------|------|
| alpha02 (2025-02) | `Session.createActivityPanelEntity()` → `ActivityPanelEntity.create()` |
| alpha07 (2025-09) | `launchActivity()` → `startActivity()`, `bundle` 파라미터 제거 |
| alpha08 (2025-10) | `moveActivity()` → `transferActivity()` |

### Unity FULL_SPACE_UNMANAGED 호환성

```
XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED   ← Jetpack XR SDK 전용
XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED ← OpenXR 전용 (Unity)
```

`ActivityPanelEntity`는 Jetpack XR SDK API로, Unity OpenXR 패키지가 C# 측에 노출하지 **않는다**. `android-xr-unity-package` GitHub 저장소에도 ActivityPanel 관련 기능이 없다.

> **결론(확실)**: Unity FULL_SPACE_UNMANAGED 앱에서 `ActivityPanelEntity` 직접 사용 공식 경로 **현재 없음**.
> 이론적으로 JNI/AndroidJavaObject로 Jetpack XR SDK를 호출하는 hack은 가능하지만 공식 미지원, 실기기 검증 없음.

### 검증 포인트 (TIL의 spike 항목)

- `Session.create(activity, lifecycleOwner)` 성공 여부
- `SessionExt.getScene(session)` 성공 여부
- `scene.getSpatialCapabilities().hasCapability(SpatialCapability.EMBED_ACTIVITY)` true 여부
- `ActivityPanelEntity.create(...)` 성공 여부
- `startActivity(intent)` 후 panel 안에 WebView 표시 여부
- WebView YouTube iframe video/audio 정상 재생 여부

## 전략 B — WebView-to-Texture

### 아키텍처

```
[Android WebView / GeckoView]
       │ (픽셀 캡처)
       ▼
 ┌──────────────────────────────────┐
 │  캡처 방식 선택                   │
 │  A) HardwareBuffer (최고 성능)    │
 │  B) ByteBuffer (안정성)           │
 │  C) Surface (Composition Layer)   │
 └──────────────────────────────────┘
       │
       ▼
[Unity Texture2D / SurfaceTexture]
       │
       ▼
[Unity Material / Mesh]
       │
       ▼
[Unity의 Projection Composition Layer 안에 렌더 → 헤드셋]
```

### YouTube IFrame의 근본적 문제

Android WebView에서 YouTube IFrame `<video>` 태그는 **하드웨어 가속된 별도 Surface에 그려진다**. 이 Surface는 WebView View 계층 밖에 있어서 SurfaceTexture로 캡처할 때 해당 영역이 **검게 나타나거나 누락**된다.

Chromium dev 리스트 명시:

> "video is drawn to a separate window behind the view hierarchy"

요약: 소프트웨어 드로우 경로에서 video/WebGL 요소는 렌더링되지 않는다.

이 제약을 우회하는 공식 방법은 **VirtualDisplay + Presentation** 패턴이지만 Unity 내부 구현 복잡도가 매우 높다.

## 전략 C — XR Composition Layer + Android Surface

### 아키텍처 (direct media path)

```
[ExoPlayer (Media3) / MediaCodec]
       │ setVideoSurface()
       ▼
[Android Surface] ← xrCreateSwapchainAndroidSurfaceKHR()
       │              (XR_KHR_android_surface_swapchain)
       ▼
[XrSwapchain backed by Android Surface]
       │
       ▼ (zero-copy)
[xrEndFrame layers]
   ┌──────────────────────────────────────┐
   │ XrCompositionLayerQuad        평면    │
   │ XrCompositionLayerCylinder    곡면    │
   │ XrCompositionLayerEquirect2  360°/180°│
   └──────────────────────────────────────┘
       │
       ▼
[XR Runtime Compositor (ATW)]
       │
       ▼
[헤드셋 디스플레이]
```

### Jetpack SceneCore SurfaceEntity (Kotlin 네이티브)

```kotlin
val stereoSurfaceEntity = SurfaceEntity.create(
    session    = xrSession,
    stereoMode = SurfaceEntity.StereoMode.SIDE_BY_SIDE,
    pose       = Pose(Vector3(0f, 0f, -1.5f)),
    shape      = SurfaceEntity.Shape.Quad(FloatSize2d(1f, 1f))
)
val exoPlayer = ExoPlayer.Builder(this).build()
exoPlayer.setVideoSurface(stereoSurfaceEntity.getSurface())
```

### Compose for XR (고수준)

```kotlin
Subspace {
    SpatialExternalSurface(
        modifier   = SubspaceModifier.width(1200.dp).height(676.dp),
        stereoMode = StereoMode.SideBySide,
    ) {
        onSurfaceCreated { surface ->
            exoPlayer.setVideoSurface(surface)
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare(); exoPlayer.play()
        }
        onSurfaceDestroyed { exoPlayer.release() }
    }
}
```

### Unity에서의 Composition Layer + Android Surface

Unity OpenXR 패키지(`com.unity.xr.compositionlayers`)를 통해.

```csharp
// Android Surface 획득
IntPtr surface = OpenXRLayerUtility.GetLayerAndroidSurfaceObject(
    layer.GetInstanceID()
);
// → AndroidJavaObject로 wrapping 후 ExoPlayer에 setVideoSurface
```

지원 레이어: **Quad, Cylinder** (Equirect는 OpenXR 레벨 지원하나 Unity 패키지 버전 의존).

### 지원 형식 요약 (Android XR Developer Preview 2 기준, 2025-05)

| 형식 | API | 비고 |
|------|-----|------|
| Side-by-side 2D | SurfaceEntity / SpatialExternalSurface | 기본 |
| MV-HEVC | StereoMode.MULTIVIEW_LEFT_PRIMARY | Media3 1.6.0+, DP2부터 |
| 180° 반구 | Shape.Hemisphere | DP2부터 |
| 360° 구면 | Shape.Sphere | DP2부터 |
| DRM (Widevine) | SurfaceProtection.PROTECTED + DrmConfiguration | 보호 Surface 필요 |

### DRM Widevine + Composition Layer

```kotlin
val protectedSurface = SurfaceEntity.create(
    ...,
    surfaceProtection = SurfaceEntity.SurfaceProtection.PROTECTED
)
val mediaItem = MediaItem.Builder()
    .setUri(videoUri)
    .setDrmConfiguration(
        MediaItem.DrmConfiguration.Builder(C.WIDEVINE_UUID)
            .setLicenseUri(drmLicenseUrl)
            .build()
    ).build()
exoPlayer.setVideoSurface(protectedSurface.getSurface())
```

```
Widevine L1 (TEE 기반):
  ├ secure Surface 경로 필수
  ├ SurfaceProtection.PROTECTED
  ├ ExoPlayer + DefaultDrmSessionManager
  └ GPU에서 decoded 프레임 접근 불가 (post-processing 금지)

Widevine L3 (소프트웨어):
  └ 일반 Surface 가능, 화질/보안 낮음
```

### YouTube IFrame이 전략 C에 안 맞는 이유

```
전략 C가 잘 맞는 경우:
  ✓ 직접 소유/제어하는 mp4, HLS, DASH URL
  ✓ ExoPlayer가 Surface에 직접 decode
  ✓ Widevine DRM 스트림 (프리미엄 VOD)
  ✓ MV-HEVC 스테레오 비디오

YouTube IFrame이 안 맞는 이유:
  ✗ YouTube IFrame = 브라우저 필요
  ✗ ExoPlayer로 youtube.com URL 직접 재생 불가
  ✗ YouTube Data API v3로 stream URL 획득 불가 (ToS 위반)
  ✗ youtube-dl/yt-dlp는 ToS 위반
```

---

# 8. 라이브러리 비교

## 종합 표

| 라이브러리 | YouTube IFrame | direct mp4/HLS | DRM Widevine | XR Composition Layer | Android XR 검증 | 비용 |
|------------|:-------------:|:--------------:|:------------:|:--------------------:|:---------------:|:----:|
| **TLabWebView** | ⚠ video 블랙 가능 | ✓ (미디어 태그) | ✗ | △ Surface 모드 | 미검증 | **무료 (MIT)** |
| **Vuplex 3D WebView** | ✓ 공식 명시 | ✓ | ✗ | ✗ | 미검증 | **$179.99 (Android만)** |
| **AVPro Video** (RenderHeads) | ✗ | ✓ | ✓ (ExoPlayer) | **✓** (별도 패키지) | **Galaxy XR 4K/60fps 검증** | 유료 |
| **Unity VideoPlayer** | ✗ | ✓ (제한적) | ✗ | ✗ (Texture 복사) | 불확실 | 무료 (Unity 내장) |
| **ExoPlayer / Media3** | ✗ | ✓ | ✓ | ✓ (Surface 경유) | ✓ (SurfaceEntity 공식 지원) | 무료 (Apache 2.0) |
| **MediaCodec native** | ✗ | ✓ | ✓ | ✓ | ✓ | 무료 |
| **Meta XR SDK OVROverlay** | ✗ | ✓ | ✓ | ✓ | Meta Quest만 | 무료 |
| **android-youtube-player** (OSS) | **✓ (IFrame 래퍼)** | ✗ | ✗ | (WebView 종속) | 미검증 | **무료** |

## 한 줄 요약

| 라이브러리 | 특징 |
|------------|------|
| **TLabWebView** | 무료 OSS, GeckoView/WebView 선택, Unity 6000 HardwareBuffer 불안정. YouTube video element 블랙 가능성 |
| **Vuplex 3D WebView** | 상용, YouTube 공식 지원 명시, System WebView/Gecko 선택, Android XR 검증 정보 없음 |
| **AVPro Video** | XR Composition Layer 별도 패키지(Google 협업), Widevine DRM, Galaxy XR Asteroid 단편 영화 4K/60fps 실사용. **Vulkan 미지원**(OpenGL ES만) — Android XR Vulkan 환경 시 제약 |
| **Unity VideoPlayer** | 단순 mp4/HLS, Composition Layer 미지원 |
| **ExoPlayer / Media3** | Android 공식, DRM/HLS/DASH 풀 지원, SceneCore SurfaceEntity 직결 |
| **MediaCodec native** | 최저 수준, 최고 제어권, JNI 필요 |
| **android-youtube-player** | IFrame Player API Kotlin/Java 래퍼. 5,000+ 앱 사용. SpatialPanel 안의 WebView로 임베드 |

## 기억해야 할 알려진 이슈 (2025-2026)

| 라이브러리 | 이슈 |
|------------|------|
| **AVPro Video + Meta Quest** | XR Composition Layer 비디오 미표시 ([#2393](https://github.com/RenderHeads/UnityPlugin-AVProVideo/issues/2393)), 씬 전환 freeze, 메모리 누수 |
| **Wolvic Browser + Pico 4** | YouTube 8K 해상도 재생 문제 ([#499](https://github.com/Igalia/wolvic/issues/499)) |
| **yt-dlp Android VR** | "Made for Kids" 영상 android_vr 클라이언트 UNPLAYABLE ([#15780](https://github.com/yt-dlp/yt-dlp/issues/15780)) |
| **ExoPlayer DRM L1↔L3 전환** | Security Level 전환 실패 ([androidx/media #2793](https://github.com/androidx/media/issues/2793)) |
| **SceneCore alpha12 SurfaceEntity** | crash → alpha13+ 업그레이드 필수 |

---

# 9. 빅테크 실전 사례

## Meta Quest YouTube VR

| 항목 | 내용 |
|------|------|
| 렌더링 API | **OpenXR (2023-04 이후)** |
| 레거시 | VrAPI / LibOVR (2022 이전) |
| 360° | `XrCompositionLayerEquirect2KHR` 추정 (1차 출처 없음 — 확실치 않음) |
| 2D 패널 모드 | 2023-09 추가 |
| 8K SDR | 2024-04 Quest 3 지원 |

Meta 공식 문구:

> "외부 비디오를 고품질로 재생하려면 반드시 Compositor Layer의 Is External Surface 기능을 사용해야 한다."

Meta Quest Browser는 별도 앱으로 WebXR 시청도 가능하다.

## Apple visionOS YouTube

### 1단계 — Juno (2024-02, 서드파티)

- **WKWebView + YouTube IFrame Player API**
- 네이티브 visionOS UI를 위에 씌워 UX 개선
- **360° 영상 구현 시도 → 모두 실패**:

| 캡처 방법 | 시간/frame |
|-----------|:----------:|
| CALayer rendering | 270 ms |
| Metal texture | 250 ms |
| UIView drawHierarchy | 150 ms |
| JavaScript transfer | 130 ms |
| WKWebView takeSnapshot | **70 ms (최선)** |

24 fps에 필요한 42 ms 이하를 달성한 방법 없음. 추가로 4K VP9 콘텐츠에 대한 Apple의 VP9 entitlement 부재.

### 2단계 — 2024-10 App Store 제거

Google이 Apple에 ToS 위반(YouTube UI 수정, 상표 사용)으로 제거 요청.

### 3단계 — 2026-02 Google 공식 visionOS 앱 출시

3D, VR180, 360°, M5 모델에서 8K. 내부 구현(AVPlayer vs WebView) 미공개.

### visionOS 공식 권장 (WWDC23 / 25)

- `AVPlayerViewController` > `AVPlayerLayer`
- RealityKit의 `VideoPlayerComponent`로 최적 렌더링
- 공간 오디오는 RealityKit가 ray-traced 자동 처리
- visionOS 26+ 에서 180°/360° RealityKit 네이티브 지원

## Google Daydream → Android XR

| 시점 | 사건 |
|------|------|
| 2016-2019 | Daydream (폰 기반 VR). 2019 종료 |
| 2024-12 | Android XR 발표 |
| 2025-10 | Galaxy XR 출시 |

YouTube VR은 Daydream 시대 시작 → 현재까지 이어지는 앱.

## Pico 4 / Pico Browser

초기 Pico Browser(WebView) → 2024-12 공식 YouTube VR 앱 출시. 이전엔 브라우저에서 수동 360° 활성화 필요.

## 핵심 1차 출처

- YouTube on Meta Quest Store: https://www.meta.com/experiences/youtube/2002317119880945/
- YouTube VR Wikipedia: https://en.wikipedia.org/wiki/YouTube_VR
- Use VR Compositor Layers (Meta): https://developers.meta.com/horizon/documentation/unity/unity-ovroverlay/
- Optimizing VR Graphics with Late Latching (Meta): https://developers.meta.com/horizon/blog/optimizing-vr-graphics-with-late-latching/
- Introducing Juno: https://christianselig.com/2024/02/introducing-juno/
- Trials of 360° in Juno: https://christianselig.com/2024/02/trials-360-juno-video/
- YouTube native app for Vision Pro (9to5Mac): https://9to5mac.com/2026/02/12/youtube-launches-native-app-for-apple-vision-pro/
- Vision Pro YouTube immersive (Road to VR): https://www.roadtovr.com/vision-pro-youtube-app-immersive-video/
- Create a great spatial playback experience (WWDC23): https://developer.apple.com/videos/play/wwdc2023/10070/
- Add spatial video to your app: https://developer.android.com/develop/xr/jetpack-xr-sdk/add-spatial-video
- AdaptiveJetStream sample: https://github.com/android/adaptive-apps-samples/tree/main/AdaptiveJetStream
- RenderHeads × Google Android XR case study: https://renderheads.com/androidxr-2/
- android-youtube-player: https://github.com/PierfrancescoSoffritti/android-youtube-player

---

# 10. 베스트 프랙티스

## Composition Layer를 써야 하는 이유

| 항목 | Eye Buffer 렌더링 | Composition Layer |
|------|-------------------|-------------------|
| 샘플링 횟수 | 앱 → Timewarp → 디스플레이 (2회+) | 직접 컴포지터 → 디스플레이 (1회) |
| 텍스처 해상도 | Eye Buffer로 다운샘플 가능 | 소스 원본 해상도 유지 |
| 재생 frame rate | 앱 frame rate 종속 | 컴포지터 native refresh |
| Judder | 앱 frame drop 시 발생 | 기존 frame re-projection으로 완화 |
| Latency | Late Latching 필요 | Predicted Display Time 직접 활용 |

Meta 공식: **"비디오 앱이 Eye Buffer 대신 Compositor Layer를 쓰는 것은 극히 중요(extremely important)하다."**

## Late Latching

GPU 커맨드 큐에 최신 헤드 트래킹 pose를 실행 직전 주입. ~10 ms 단위로 latency 감소. Composition Layer는 Predicted Display Time으로 자체적으로 한 단계 더 잘 처리한다.

## Audio / MediaSession / Spatial Audio

- ExoPlayer: Dolby Digital, Dolby Atmos 자동 선택
- 공간 오디오 AudioAttributes: `USAGE_MEDIA` 또는 `CONTENT_TYPE_MOVIE`
- 특정 Entity 위치 오디오: `SpatialMediaPlayer.setPointSourceParams()`
- 백그라운드 재생: `MediaSessionService` + `C.WAKE_MODE_LOCAL`
- MediaSession ↔ ExoPlayer 연결로 헤드셋 물리 버튼(재생/일시정지) 처리

## Lifecycle

```
onStart() / onResume()  → MediaSession 초기화, ExoPlayer prepare
onStop() (API 24+) 또는 onPause() (API 23-) → ExoPlayer release
헤드셋 sleep/wake     → MediaSessionService(서비스 분리)로 백그라운드 유지
WAKE_MODE_LOCAL       → 화면 잠금 시에도 재생 지속
```

## 360° / 180° 콘텐츠 매핑

| 콘텐츠 | 권장 Surface | Layer |
|--------|--------------|-------|
| 일반 평면 2D | Quad | `XrCompositionLayerQuad` |
| 곡면 UI/비디오 | Cylinder | `XrCompositionLayerCylinderKHR` |
| 360° Equirect | Sphere | `XrCompositionLayerEquirect2KHR` |
| 180° 반구 | Hemisphere | `XrCompositionLayerEquirect2KHR` (range 한정) |

Android XR `Shape.Sphere` / `Shape.Hemisphere` 가 OpenXR Equirect2를 추상화한다.

---

# 11. 안티패턴 6가지

| 안티패턴 | 문제점 |
|---------|--------|
| **WebView를 `addContentView`로 Activity에 추가 (Full Space)** | Full Space에서 Activity 창 자체가 헤드셋에 도달하지 않으므로 WebView도 안 보임. SpatialPanel 또는 WebView-to-Texture 필요 |
| **yt-dlp / youtube-dl로 mp4 URL 추출 후 ExoPlayer 공급** | YouTube ToS 위반. 2024+ YouTube가 의도적 버퍼링/오류 유발 |
| **Composition Layer Surface에 YouTube IFrame 직접 매핑 시도** | Juno의 360° 실패가 입증. RealityKit/SceneCore는 WebView 콘텐츠를 External Surface 텍스처로 사용 불가 |
| **Eye Buffer에 비디오 텍스처 렌더링** | Timewarp 다중 샘플링으로 화질 열화. 앱 frame rate 종속으로 Judder |
| **모든 포맷에 단일 StereoMode 사용** | Side-by-Side, Top-Bottom, MV-HEVC 각각 다른 `StereoMode` 필요. 잘못 설정 시 두 눈이 같은 이미지 또는 왜곡 |
| **DRM 콘텐츠에 unprotected Surface 사용** | `SurfaceProtection.PROTECTED` 없이는 재생 실패 또는 보안 정책 위반 |

---

# 12. 결정 트리 / 상황별 최적 선택

```
비디오를 표시해야 한다
          │
          ▼
  YouTube 콘텐츠인가?
    ├─ YES
    │    ├ Unity FULL_SPACE_UNMANAGED 앱?
    │    │   ├ YES
    │    │   │   ├ 인앱 재생 필요 → 전략 B (WebView-to-Texture)
    │    │   │   │   └ Vuplex 권장 ($179.99) 또는 TLabWebView (무료, 검증 필요)
    │    │   │   │   └ android-youtube-player 라이브러리(IFrame 래퍼) WebView 안에 사용
    │    │   │   └ 외부 launch OK → YouTube 앱/브라우저 Intent
    │    │   └ 아니오 (Jetpack XR SDK 네이티브 앱) → 전략 A (ActivityPanelEntity)
    │    └ 360° / VR180 YouTube 인앱 재생?
    │        └ 현재 공식 방법 없음. YouTube 앱/브라우저 fallback 권장
    │
    └─ NO (자체 보유 mp4 / HLS / DASH)
         ├ 일반 2D 비디오 → ExoPlayer + SpatialExternalSurface(Mono)
         │                  또는 SurfaceEntity.Shape.Quad
         ├ 스테레오 SBS / TopBottom → ExoPlayer + StereoMode.SideBySide / TopBottom
         ├ MV-HEVC 스테레오 → ExoPlayer (Media3 1.6.0+) + StereoMode.MULTIVIEW_LEFT_PRIMARY
         ├ 180° → ExoPlayer + Shape.Hemisphere
         ├ 360° Equirect → ExoPlayer + Shape.Sphere
         │                  (네이티브 OpenXR이면 XrCompositionLayerEquirect2KHR)
         └ DRM 보호 → ExoPlayer + DrmConfiguration(C.WIDEVINE_UUID)
                      + SpatialExternalSurface(surfaceProtection=Protected)
```

## Cooking Assistant 케이스 (TIL의 실제 앱)

요리 보조 앱 = Full Space에서 레시피 패널 + 비디오 패널 동시.

| 콘텐츠 | 권장 조합 |
|--------|-----------|
| 자체 보유 레시피 비디오(mp4/HLS) | ExoPlayer + `SpatialExternalSurface`(Mono) → Compose `SpatialPanel` orbiter로 컨트롤 |
| YouTube 레시피 영상 참조 | `SpatialPanel` 안 WebView + `android-youtube-player` 라이브러리 |
| 외부 fallback | `vnd.youtube://VIDEO_ID` 딥링크로 YouTube 앱 launch |
| 공간 오디오 | ExoPlayer Dolby Atmos 자동, 패널 Entity에 `PointSourceParams` 연결 |

### TIL의 spike 결론 정리

**Spike 1 — ActivityPanelEntity**: 가장 공식적·아키텍처적이지만 Unity FULL_SPACE_UNMANAGED 공식 미지원. JNI hack 가능성은 있으나 검증 필요.

**Spike 2 — WebView-to-Texture (TLabWebView)**: 가장 요구에 가까움. 단, 마이너 라이브러리, Unity 6000 + Android XR + YouTube iframe video 렌더링은 검증 필수. video element 블랙 가능성을 늘 염두.

**Spike 3 — External fallback**: 가장 안정적이지만 Cooking Assistant Full Space UX 통합성은 낮음. Plan B 위치.

**Composition Layer + Android Surface**는 direct media URL/video decoder 계열의 최적화 경로. YouTube IFrame에는 안 맞으니 자체 보유 영상으로 전환하는 결정과 묶어 고려.

---

# 13. 핵심 정리

1. **YouTube는 IFrame Player API가 유일한 합법 임베드 경로**다. 직접 mp4 추출(yt-dlp)은 ToS 위반 + 2024+ 의도적 장애.

2. **Unity FULL_SPACE_UNMANAGED + ActivityPanelEntity는 공식 미지원**. WebView-to-Texture(B)가 Unity에서 YouTube를 다루는 현실적 경로.

3. **자체 보유 영상은 Composition Layer + Android Surface(C)** 가 최고. ExoPlayer + SurfaceEntity로 Widevine DRM, MV-HEVC, 360°/180° 모두 native 지원.

4. **Composition Layer > Eye Buffer 렌더링** — 샘플링 1회, 원본 해상도, 컴포지터 refresh, Judder 감소. 비디오 앱은 반드시 Compositor Layer.

5. **Juno의 교훈**: WebView는 텍스처로 사용 불가 → 360° 구현 불가. 네이티브 플레이어로만 가능. ToS 무시 시 App Store 제거 위험.

6. **Cooking Assistant 같은 앱은 둘을 분리해 설계**: "직접 보유 레시피 영상은 SurfaceEntity로", "YouTube 참조는 WebView-to-Texture 또는 외부 앱 fallback으로". 한 경로로 모두 처리하려고 하면 YouTube의 4계층 방어막에 막힌다.
