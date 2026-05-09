# TIL 2026-05-09: Unity / Android XR / YouTube playback

## Home Space vs Full Space

- Home Space는 Android XR의 시스템 관리 데스크톱에 가깝다. Settings, Browser, YouTube 같은 여러 2D 앱 창이 같이 보일 수 있다.
- Full Space는 앱 하나가 XR/MR 공간을 소유하는 모드다. Unity/OpenXR 앱은 보통 이쪽이며, world-space panel, passthrough MR, 손/시선/ray interaction, spatial object 배치를 직접 관리한다.
- Cooking Assistant는 후라이팬/음식/조리대 같은 현실 물체 인식과 world-space recipe/video panel을 목표로 하므로 Full Space가 맞다.

## FULL_SPACE_UNMANAGED

- `XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED`는 Kotlin enum이 아니라 Android manifest property 값이다.
- 현재 repo의 `AndroidManifest.xml`에 아래처럼 들어간다.

```xml
<property
    android:name="android.window.PROPERTY_XR_ACTIVITY_START_MODE"
    android:value="XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED" />
```

- 관련 값 후보:
  - `XR_ACTIVITY_START_MODE_HOME_SPACE`
  - `XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED`
  - `XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED`
  - `XR_ACTIVITY_START_MODE_UNDEFINED`
- Unity/OpenXR Android XR 앱은 공식적으로 unmanaged Full Space 쪽에 해당한다. Unity가 XR scene graph/rendering을 직접 관리한다는 뜻이다.

## 왜 Android WebView overlay가 안 보였나

- 기존 YouTube bridge는 `activity.addContentView(WebView, layoutParams)`로 Android native View를 Unity Activity 위에 얹었다.
- 일반 Android 2D 앱에서는 Activity window 안에서 View들이 합성되므로 이 방식이 보일 수 있다.
- Full Space Unity/OpenXR에서는 사용자가 보는 주 화면이 Android 2D View tree가 아니라 Unity가 XR runtime에 제출하는 XR frame/layer다.
- 그래서 WebView는 살아 있고 YouTube도 decode/audio playback을 하지만, 그 픽셀이 Unity world-space panel 안으로 자동으로 들어오지 않는다.
- 실제 로그에서도 Unity는 `Loaded videoId=...`를 찍고 Chromium `MediaCodec`/audio focus는 보였지만, 화면에는 video가 안 보였다.

## YouTube URL vs direct media URL

- YouTube watch URL / youtu.be URL은 direct media URL이 아니다. HTML/JS/IFrame player가 필요한 page/player URL이다.
- `mp4`, `m3u8`, `mpd`, `file://...mp4` 같은 것은 direct media URL이다.
- Unity `VideoPlayer`, AVPro, Media3/ExoPlayer, XR Composition Layer + Android Surface는 direct media URL에는 맞지만 YouTube watch URL에는 직접 맞지 않는다.
- YouTube를 공식적으로 다루려면 IFrame Player API/WebView 계열이 기본 경로다.

## 가능한 YouTube 표시 전략

1. ActivityPanelEntity spike
   - Jetpack XR SceneCore의 `ActivityPanelEntity`로 YouTube WebView Activity를 spatial panel에 embed한다.
   - YouTube는 공식 IFrame/WebView 경로를 유지하고, Android XR가 panel을 spatial entity로 띄우는 구조다.
   - 가장 공식적이고 아키텍처적으로 좋아 보이지만, Unity/OpenXR `FULL_SPACE_UNMANAGED` 앱과 SceneCore panel이 실제로 공존하는지 실기기 검증이 필요하다.

2. WebView-to-Texture spike
   - Android WebView/GeckoView가 그린 픽셀을 Unity `Texture2D`/uGUI/RawImage로 가져와 world-space panel에 붙인다.
   - 무료 후보는 TLabWebView가 가장 요구에 가깝다.
   - 단, 마이너하고 Unity 6000 + Android XR + YouTube iframe video 렌더링은 반드시 검증해야 한다.

3. External fallback
   - YouTube 앱/브라우저로 열기.
   - 가장 안정적이지만 Cooking Assistant의 Full Space UX와 통합성은 낮다.

## ActivityPanelEntity 관련

- `ActivityPanelEntity`, `Session`, `SpatialCapability.EMBED_ACTIVITY`는 Jetpack XR SceneCore/runtime API다.
- Unity C#에서 직접 만들 수 있는 게 아니라 Android Java/Kotlin plugin bridge를 통해 호출해야 한다.
- 예상 호출 구조:

```text
Unity C#
-> AndroidJavaClass / AndroidJavaObject
-> Java bridge
-> Jetpack XR Session
-> ActivityPanelEntity
-> YouTubePlayerPanelActivity
-> WebView + YouTube IFrame API
```

- 검증 포인트:
  - `Session.create(activity, lifecycleOwner)` 성공 여부
  - `SessionExt.getScene(session)` 성공 여부
  - `scene.getSpatialCapabilities().hasCapability(SpatialCapability.EMBED_ACTIVITY)` 여부
  - `ActivityPanelEntity.create(...)` 및 `startActivity(intent)`가 Unity Full Space에서 실제로 보이는지
  - WebView YouTube iframe video/audio가 panel 안에서 정상 재생되는지

## XR Composition Layer + Android Surface

- 아키텍처적으로 direct video surface에는 매우 좋은 방식이다.
- 구조:

```text
MediaPlayer / ExoPlayer / MediaCodec
-> Android Surface
-> XR Composition Layer
-> XR compositor
-> headset display
```

- 하지만 YouTube iframe/WebView를 임의의 Surface에 공식적으로 직접 출력하는 happy path가 없다.
- 그래서 YouTube 문제의 1차 해법은 ActivityPanelEntity 또는 WebView-to-Texture이고, Composition Layer는 direct media URL/video decoder 계열의 최적화 경로로 보는 게 맞다.
