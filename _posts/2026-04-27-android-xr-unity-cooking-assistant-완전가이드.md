---
layout: single
title: "Android XR Unity Cooking Assistant 디버깅 완전 가이드"
date: 2026-04-27 23:00:00 +0900
categories: android
excerpt: "Android XR과 Unity 앱에서 manifest, runtime permission, OpenXR runtime, scene/prefab, MRTemplate tutorial object를 분리해서 디버깅하는 기준을 정리한다."
toc: true
toc_sticky: true
tags: [android, androidxr, unity, openxr, permission, debugging]
source: "/Users/sampling/til/research/android-xr-unity-cooking-assistant-2026-04-27.md"
---

**TL;DR**

- Android XR Unity 앱 문제는 `manifest`, `runtime permission`, `OpenXR runtime`, `Unity scene/prefab`, `XR UI input`을 분리해서 봐야 한다.
- `AndroidManifest.xml`에 권한이 있다는 것과 실제 runtime grant가 있다는 것은 다르다.
- `SCENE_UNDERSTANDING_COARSE`는 passthrough mesh, plane tracking, raycast, persistent anchor 같은 환경 이해 기능과 연결된다.
- `XR_ERROR_RUNTIME_UNAVAILABLE`은 권한 문제가 아니라 OpenXR runtime discovery, native library 접근성, package visibility, loader 설정 문제일 수 있다.
- Unity에서는 C# 파일이 존재한다고 실행되는 것이 아니다. Scene에 GameObject/Component로 있거나 runtime entry point에서 생성되어야 한다.
- MRTemplate의 IET editor tutorial과 runtime tutorial object(`GoalManager`, `TutorialPlayer`, `Coaching UI`)는 구분해야 한다.
- 제품 앱에서 template tutorial UI가 필요 없다면 bootstrap에서 숨기는 것보다 scene/prefab 기본 상태에서 비활성화하는 편이 안전하다.

## 1. 개념

Android XR Unity 앱은 여러 계층이 동시에 맞아야 정상 동작한다. Android 쪽에서는 manifest와 runtime permission이 필요하고, XR 쪽에서는 OpenXR loader가 활성 runtime을 찾을 수 있어야 하며, Unity 쪽에서는 시작 scene과 prefab object graph가 제품 앱에 맞게 정리되어 있어야 한다.

이 글은 Cooking Assistant Android XR 디버깅 기록을 바탕으로 다음 질문에 답한다.

- 왜 manifest에 권한이 있는데도 `granted=false`가 나오는가?
- 왜 passthrough 권한이 scene understanding이라는 이름으로 묶이는가?
- OpenXR runtime unavailable은 어떤 레이어의 문제인가?
- Unity에서 Scene, GameObject, Component, Prefab은 실행 흐름과 어떻게 연결되는가?
- MRTemplate tutorial UI를 없앨 때 왜 IET package 제거만으로는 부족한가?
- 왜 bootstrap cleanup보다 scene/prefab 기본 상태 수정이 더 안정적인가?

## 2. 배경

Android XR 앱은 일반 Android 앱, OpenXR 앱, Unity 앱의 성질을 모두 가진다. 일반 Android 앱처럼 manifest와 permission을 사용하고, XR 앱처럼 runtime/loader/extension을 사용하며, Unity 앱처럼 scene과 prefab이 실행 시작점을 이룬다.

문제는 각 계층의 실패 증상이 비슷하게 보인다는 점이다. 화면이 검게 보이는 현상 하나만 보고도 다음 원인이 모두 가능하다.

- APK에 필요한 manifest 항목이 빠졌다.
- dangerous permission을 runtime에 요청하지 않았다.
- OpenXR runtime broker나 native library를 찾지 못했다.
- Unity OpenXR feature가 target device와 맞지 않는다.
- Scene에 제품 UI 대신 template tutorial object가 active로 남아 있다.
- Runtime UI는 보이지만 XR ray/poke input이 EventSystem까지 연결되지 않았다.

그래서 Android XR Unity 디버깅은 한 레이어를 고치고 끝내는 방식보다, 레이어별 증거를 분리하는 방식이 필요하다.

## 3. 이유

### 3.1 Android가 manifest와 runtime permission을 나눈 이유

Android 앱은 sandbox 안에서 실행된다. 앱이 보호된 자원에 접근하려면 먼저 manifest에 “이 앱은 이 기능을 쓸 수 있는 앱이다”라고 선언해야 한다. 하지만 민감한 권한은 설치 시점의 정적 선언만으로 충분하지 않다. 사용자가 앱을 실행하는 맥락에서 허용해야 하므로 Android 6.0(API 23) 이후 dangerous permission은 runtime request가 필요하다.

그래서 `AndroidManifest.xml`에 권한이 있어도 `dumpsys package`에서 `granted=false`가 나올 수 있다. 이것은 모순이 아니라 정상 모델이다.

### 3.2 Android XR이 scene understanding 권한을 둔 이유

XR 앱은 사용자 주변 환경을 다룬다. 단순 화면 픽셀뿐 아니라 평면, 깊이, 조명, anchor, 물체, passthrough mesh 같은 물리 공간 정보를 사용할 수 있다. 이 정보는 사용자 사생활과 물리 공간을 반영하므로 별도 permission boundary가 필요하다.

`SCENE_UNDERSTANDING_COARSE`는 Android XR에서 coarse 환경 이해 기능을 묶는 dangerous permission이다. 이름에 passthrough가 들어가지 않지만, Android XR 문서에서는 passthrough mesh projection, plane tracking, environment raycast, persistent anchor 등이 이 권한과 연결된다.

### 3.3 OpenXR이 필요한 이유

XR 생태계는 원래 기기와 벤더별 SDK가 갈라져 있었다. OpenXR은 앱이 특정 헤드셋 SDK에 직접 묶이지 않고 공통 API로 XR runtime에 접근하게 하려는 표준이다.

하지만 Android에서는 OpenXR runtime discovery도 Android 보안 모델의 영향을 받는다. 앱이 아무 package/service/provider나 조회할 수 없고, Android 12(API 31) 이상에서는 vendor/device manufacturer가 제공하는 non-NDK native shared library도 명시적으로 요청해야 접근 가능하다.

### 3.4 Unity scene/prefab 정리가 필요한 이유

Unity는 “코드 파일이 있으면 실행된다”는 모델이 아니다. 앱은 Build Settings의 scene을 불러오고, scene 안의 GameObject와 Component가 실행된다. Prefab instance가 scene에 active로 남아 있으면 제품 코드가 따로 있어도 그 object는 런타임에 존재한다.

MRTemplate tutorial object가 제품 앱 startup에 보이는 이유도 여기에 있다. Editor tutorial package를 제거해도 scene/prefab에 runtime tutorial UI가 active로 남아 있으면 앱 시작 시 그대로 나타난다.

## 4. 특징

Android XR Unity 앱 디버깅의 특징은 다음과 같다.

| 영역 | 확인 대상 | 대표 증상 | 판단 기준 |
|---|---|---|---|
| Android manifest | permission, feature, queries, native library | 설치는 되지만 runtime 기능 실패 | APK 최종 manifest, `dumpsys package` |
| Runtime permission | dangerous permission grant | manifest에는 있는데 `granted=false` | runtime request callback, `dumpsys package` |
| OpenXR runtime | loader, runtime broker, native library | `XR_ERROR_RUNTIME_UNAVAILABLE` | logcat native error, OpenXR loader 상태 |
| Unity scene | startup scene, active GameObject | sample/tutorial UI가 뜸 | Build Settings, `SampleScene.unity` |
| Unity prefab | prefab root active, scene override | 원본과 scene 상태 불일치 | prefab asset, prefab instance override |
| XR UI input | EventSystem, XRUIInputModule, raycaster, interactor | UI는 보이는데 클릭 안 됨 | `TrackedDeviceGraphicRaycaster`, `XRUIInputModule`, Near/Far interactor |

## 5. 상세 내용

# Android XR / Unity Cooking Assistant 개념 자료조사

## 5.1 Android manifest와 권한 모델

### 5.1.1 배경

Android 앱은 기본적으로 sandbox 안에서 실행된다. 앱이 카메라, 위치, 주변 환경, 다른 앱과의 통신 같은 보호된 자원에 접근하려면 OS가 이해할 수 있는 정적 선언과 사용자/시스템의 동적 승인이 필요하다.

이 구조는 두 문제를 해결하려고 생겼다.

- 설치 전/배포 단계에서 앱이 어떤 기능을 요구하는지 OS, Google Play, 기기 제조사, 보안 도구가 판단할 수 있어야 한다.
- 실행 중에는 민감한 기능을 실제 사용자 맥락에서 허용하거나 거부할 수 있어야 한다.

그래서 Android 권한은 보통 `manifest 선언`과 `runtime 승인`으로 나뉜다. Manifest에 선언되어 있다는 것은 “이 앱이 이 권한을 요청할 수 있다”는 의미이고, runtime grant는 “현재 사용자/프로필에서 실제로 허용되었다”는 의미다.

### 5.1.2 주요 용어

| 용어 | 의미 |
|---|---|
| `AndroidManifest.xml` | Android 앱의 정적 명세 파일. 앱 컴포넌트, 권한, 기능 요구사항, intent filter, 외부 package 조회 가능성 등을 OS와 빌드 도구에 알려준다. |
| `<uses-permission>` | 앱이 보호된 시스템 기능을 사용하겠다고 선언하는 manifest 요소. dangerous permission은 manifest 선언 후 runtime request가 필요하다. |
| `normal permission` | 상대적으로 위험이 낮아 설치 시 자동 승인되는 권한. |
| `dangerous permission` | 사용자 개인정보, 센서, 물리 환경 등 민감한 정보에 접근하는 권한. Android 6.0 이상에서는 runtime grant가 필요하다. |
| `signature permission` | 권한을 정의한 시스템/앱과 같은 signing certificate를 가진 앱에만 grant되는 권한. |
| `<uses-feature>` | 앱이 어떤 하드웨어/소프트웨어 기능에 의존하는지 외부 시스템에 알리는 manifest 요소. Google Play의 기기 필터링에 영향을 준다. |
| `<queries>` | Android 11 이후 package visibility 제한에서 앱이 조회할 수 있는 외부 package, service, provider를 명시하는 manifest 요소. |

### 5.1.3 프로젝트 적용

Cooking Assistant에서 `SCENE_UNDERSTANDING_COARSE`가 manifest에 있는데도 `dumpsys package`에서 `granted=false`로 보였던 것은 모순이 아니다. manifest 선언은 정적 자격이고, runtime grant는 사용자 승인 상태다.

또한 XR/OpenXR 쪽에서는 permission뿐 아니라 feature, queries, native library 접근성까지 같이 봐야 한다. “권한이 있다”는 사실만으로 XR runtime 초기화가 성공한다고 볼 수 없다.

### 5.1.4 참고 자료

- Android app manifest overview: <https://developer.android.com/guide/topics/manifest/manifest-intro>
- `<uses-permission>`: <https://developer.android.com/guide/topics/manifest/uses-permission-element>
- Request runtime permissions: <https://developer.android.com/guide/topics/permissions/requesting>
- `<uses-feature>`: <https://developer.android.com/guide/topics/manifest/uses-feature-element>
- Package visibility in Android 11: <https://developer.android.com/about/versions/11/privacy/package-visibility>

---

## 5.2 Android XR의 scene understanding과 passthrough

### 5.2.1 배경

XR 앱은 단순히 화면 위에 2D UI를 그리는 앱이 아니다. 사용자의 실제 공간, 손, 눈, 주변 물체, 평면, 조명, 깊이 같은 환경 정보를 활용할 수 있다. 이 정보는 편리하지만 사생활과 물리 공간 정보를 포함할 수 있으므로 Android XR은 별도 권한 체계로 묶는다.

`passthrough`는 카메라 영상을 앱이 직접 읽는 일반 카메라 기능처럼 보일 수 있지만, Android XR 문맥에서는 “실제 환경을 XR composition에 어떻게 섞는가”의 문제다. 특히 passthrough를 mesh 표면에 투영하거나 환경 trackable에 raycast하려면 scene understanding 권한과 OpenXR extension이 연결된다.

### 5.2.2 주요 용어

| 용어 | 의미 |
|---|---|
| `XR` | Extended Reality. VR, AR, MR을 포괄하는 말. |
| `passthrough` | 헤드셋 카메라/센서로 본 실제 환경을 XR 화면에 통과시켜 보여주는 기능. |
| `scene understanding` | 주변 환경을 평면, trackable, light, anchor, mesh 같은 구조화된 공간 정보로 이해하는 기능 묶음. |
| `SCENE_UNDERSTANDING_COARSE` | Android XR의 dangerous permission. light estimation, passthrough mesh projection, raycast, plane tracking, persistent anchor 등에 연결된다. |
| `SCENE_UNDERSTANDING_FINE` | depth texture 등 더 정밀한 환경 정보와 연결되는 permission. |
| `XR_ANDROID_composition_layer_passthrough_mesh` | passthrough texture를 임의 geometry/mesh 위에 composition layer로 투영할 수 있게 하는 Android OpenXR extension. |

### 5.2.3 프로젝트 적용

Cooking Assistant에서 passthrough가 보이지 않거나 `Passthrough is not supported`처럼 보일 때는 다음을 분리해서 봐야 한다.

1. 앱이 Android XR permission을 manifest에 선언했는가.
2. dangerous permission을 runtime에 요청했고 grant되었는가.
3. OpenXR runtime이 정상 발견/초기화되었는가.
4. Unity OpenXR feature가 Android XR target에 맞는가.
5. 사용 중인 OpenXR extension이 현재 기기/runtime에서 supported로 보고되는가.

`SCENE_UNDERSTANDING_COARSE` grant 이후에도 `XR_ERROR_RUNTIME_UNAVAILABLE`이 남았다면, 권한 문제는 해결됐고 runtime discovery/native library/package visibility 쪽으로 넘어가야 한다.

### 5.2.4 참고 자료

- Android XR permissions: <https://developer.android.com/develop/xr/permissions>
- Android XR supported OpenXR extensions: <https://developer.android.com/develop/xr/openxr/extensions>
- `XR_ANDROID_composition_layer_passthrough_mesh`: <https://developer.android.com/develop/xr/openxr/extensions/XR_ANDROID_composition_layer_passthrough_mesh>
- Android XR design for immersive apps: <https://developer.android.com/design/ui/xr/guides/get-started>

---

## 5.3 OpenXR runtime, loader, native library

### 5.3.1 배경

XR 생태계는 원래 기기/벤더별 API가 갈라져 있었다. OpenXR은 이 파편화를 줄이기 위해 나온 Khronos의 표준 API다. 앱은 OpenXR API를 호출하고, loader는 활성 runtime을 찾아 그 runtime에 연결한다. runtime은 실제 기기 추적, 입력, frame submission, composition을 처리한다.

Android에서는 보안 모델 때문에 runtime discovery도 manifest/package visibility의 영향을 받는다. 앱이 임의 패키지를 마음대로 조회할 수 없고, Android 12(API 31) 이상에서는 vendor/device manufacturer가 제공하는 non-NDK native shared library도 기본 접근이 막힐 수 있다.

### 5.3.2 주요 용어

| 용어 | 의미 |
|---|---|
| `OpenXR` | Khronos가 만든 royalty-free XR 표준 API. 특정 헤드셋 SDK에 직접 묶이지 않고 공통 API로 AR/VR/MR runtime에 접근하게 한다. |
| `OpenXR loader` | 앱과 runtime 사이의 중간 계층. 활성 runtime을 찾아 OpenXR 호출을 전달한다. |
| `OpenXR runtime` | 실제 XR 하드웨어/플랫폼 기능을 구현한 시스템 또는 vendor 제공 실행 계층. |
| `runtime broker` | Android에서 OpenXR runtime discovery를 외부화하는 broker/provider 개념. |
| `XR_ERROR_RUNTIME_UNAVAILABLE` | OpenXR instance/session 생성 시 활성 runtime을 사용할 수 없을 때 나오는 오류. |
| `<uses-native-library>` | Android 12 이상에서 vendor/device manufacturer 제공 non-NDK native shared library 접근을 명시적으로 요청하는 manifest 요소. |
| `android:required="false"` | library가 있으면 쓰지만 없어도 설치는 허용한다는 의미. |

### 5.3.3 프로젝트 적용

`libopenxr.google.so`를 manifest에 다음처럼 추가한 이유는 Android 12+의 native library 접근성 모델 때문이다.

```xml
<uses-native-library
    android:name="libopenxr.google.so"
    android:required="false" />
```

Unity/OpenXR 쪽에서 runtime library를 찾더라도 OS namespace에서 접근 불가능하면 초기화가 실패할 수 있다. 따라서 Android XR launch failure를 볼 때는 단순히 C# exception만 볼 것이 아니라 아래를 같이 확인한다.

- APK 최종 manifest에 permission, feature, queries, native library가 들어갔는가.
- `dumpsys package`에서 permission grant와 uses-native-library 상태가 기대와 맞는가.
- logcat에 `xrCreateInstance`, `XR_ERROR_RUNTIME_UNAVAILABLE`, namespace 접근 오류가 있는가.
- Unity OpenXR settings가 Android XR package/feature를 대상으로 하고 있는가.

### 5.3.4 참고 자료

- Khronos OpenXR overview: <https://www.khronos.org/openxr>
- OpenXR loader design and Android runtime discovery: <https://registry.khronos.org/OpenXR/specs/1.1/loader.html>
- Unity OpenXR Plugin: <https://docs.unity.cn/Manual/com.unity.xr.openxr.html>
- Android `<uses-native-library>`: <https://developer.android.com/guide/topics/manifest/uses-native-library-element>
- Develop with OpenXR on Android XR: <https://developer.android.com/develop/xr/openxr>

---

## 5.4 Unity 실행 모델: Scene, GameObject, Component, Prefab

### 5.4.1 배경

Unity 프로젝트는 일반 서버/웹 프로젝트처럼 “파일이 있으면 실행된다”는 모델이 아니다. Unity는 asset database와 scene graph를 중심으로 앱을 만든다. C# 파일이 프로젝트에 존재해도, 그 스크립트가 scene/prefab의 GameObject에 Component로 붙거나 runtime entry point에서 호출되지 않으면 실제 앱 동작에 참여하지 않는다.

이 구조는 게임/실시간 3D 앱의 제작 방식에서 왔다. 디자이너와 개발자가 같은 scene 안에서 카메라, 조명, UI, 입력 장치, 물리 객체, 스크립트를 시각적으로 조립해야 하기 때문이다.

### 5.4.2 주요 용어

| 용어 | 의미 |
|---|---|
| `Asset` | Unity 프로젝트 안의 모든 재료. script, scene, prefab, texture, model, material, audio, settings 등이 모두 asset이다. |
| `Scene` | Unity 앱이 불러오는 실행 무대. 어떤 GameObject들이 시작 시점에 존재하는지 저장한다. |
| `GameObject` | Unity scene 안의 기본 객체. 이름과 transform을 가진 컨테이너이고, 실제 기능은 Component가 담당한다. |
| `Component` | GameObject에 붙는 기능 조각. Transform, Renderer, Collider, Camera, Button, C# MonoBehaviour 등이 Component다. |
| `MonoBehaviour` | Unity가 lifecycle method를 호출할 수 있는 C# component의 기본 클래스. |
| `Prefab` | 재사용 가능한 GameObject hierarchy asset. |
| `Prefab instance` | Scene에 놓인 prefab의 복사/참조 instance. |
| `Prefab override` | Scene instance가 원본 prefab과 다르게 가진 serialized value. |

### 5.4.3 프로젝트 적용

Cooking Assistant의 실제 Android 앱은 `Assets/Scenes/SampleScene.unity`에 들어있는 object graph에서 시작한다. 따라서 MRTemplate tutorial object가 scene에 active로 남아 있으면, 앱 코드가 따로 존재해도 그 object는 시작 화면에 나타날 수 있다.

이 때문에 “bootstrap에서 찾아서 꺼라”보다 “scene/prefab default state에서 꺼라”가 더 안정적이다. Bootstrap은 scene load 이후 또는 특정 runtime 초기화 이후에 실행되므로, 첫 frame 문제나 OpenXR early failure 앞에서는 통제권이 늦다.

### 5.4.4 참고 자료

- Unity GameObjects: <https://docs.unity.com/en-us/unity-studio/develop/gameobjects>
- Unity Components: <https://docs.unity.com/en-us/unity-studio/develop/gameobjects/components>
- Unity Prefabs manual: <https://docs.unity.cn/2023.1/Documentation/Manual/Prefabs.html>
- Unity RuntimeInitializeOnLoadMethod: <https://docs.unity3d.com/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html>

---

## 5.5 Unity Canvas와 XR UI

### 5.5.1 배경

Unity UI는 Canvas를 기준으로 렌더링된다. 전통적인 모바일/PC UI에서는 screen-space overlay가 자연스럽다. 하지만 XR/MR에서는 사용자가 고정된 모니터를 보는 것이 아니라 3D 공간 속에서 머리, 손, 눈, controller로 상호작용한다. 그래서 “화면 위에 붙은 UI”와 “공간 안에 떠 있는 UI”의 차이가 중요하다.

### 5.5.2 주요 용어

| 용어 | 의미 |
|---|---|
| `Canvas` | Unity UI 요소가 배치되고 렌더링되는 추상 공간. |
| `Screen Space - Overlay` | 카메라와 무관하게 화면 위에 직접 그리는 render mode. 모바일 HUD에는 편하지만 XR과 맞지 않을 수 있다. |
| `Screen Space - Camera` | 특정 camera 앞의 plane처럼 UI를 렌더링하는 mode. |
| `World Space` | UI가 3D world 안의 object처럼 배치되는 mode. XR panel에 적합하다. |
| `diegetic interface` | UI가 사용자 세계 안에 실제로 존재하는 물체처럼 배치되는 interface. |
| `TrackedDeviceGraphicRaycaster` | XR controller, hand ray, tracked device pointer가 World Space Canvas를 raycast할 수 있게 하는 XRI UI component. |
| `XRUIInputModule` | Unity EventSystem이 XR tracked device input을 UI event로 변환하게 하는 XRI input module. |

### 5.5.3 프로젝트 적용

Cooking Assistant 같은 Android XR 앱에서 추천되는 기본 UI 모델은 World Space panel이다. 사용자의 시야 안 적절한 거리와 크기에 배치하고, XR input system이 raycast/point/select할 수 있게 해야 한다.

단, UI가 보이는 것과 상호작용 가능한 것은 다르다. World Space Canvas에는 `TrackedDeviceGraphicRaycaster`가 필요하고, EventSystem에는 `XRUIInputModule`이 필요하며, scene의 Near/Far interactor나 ray interactor가 UI interaction을 지원해야 한다.

Android XR 디자인 문서는 입력 방법을 하나로 가정하지 말라고 한다. 손, 눈, 음성, keyboard, mouse, trackpad, 6DoF controller가 모두 가능하므로 버튼 크기와 interaction target도 넉넉해야 한다.

### 5.5.4 참고 자료

- Unity Canvas manual: <https://docs.unity3d.com/Manual/class-Canvas.html>
- Unity Canvas render modes: <https://docs.unity.cn/2018.4/Documentation/Manual/UICanvas.html>
- Unity World Space UI: <https://docs.unity3d.com/Manual/HOWTO-UIWorldSpace.html>
- Android XR foundations: <https://developer.android.com/design/ui/xr/guides/foundations>
- Android XR visual design: <https://developer.android.com/design/ui/xr/guides/visual-design>
- Android XR considerations: <https://developer.android.com/design/ui/xr/guides/considerations>

---

## 5.6 MRTemplate, IET, GoalManager, TutorialPlayer

### 5.6.1 배경

Unity template은 빠르게 시작할 수 있게 sample scene, prefab, tutorial, input setup, UI를 함께 제공한다. 장점은 초기에 많은 설정을 대신 해준다는 점이고, 단점은 제품 앱이 된 뒤에도 template/tutorial object가 scene과 package에 남아 있으면 실제 앱 UI와 충돌할 수 있다는 점이다.

MRTemplate 이슈는 editor tutorial과 runtime template object를 구분해야 이해된다.

### 5.6.2 주요 용어

| 용어 | 의미 |
|---|---|
| `MRTemplate` | Unity Mixed Reality Template에서 온 asset, prefab, script, UI 묶음을 가리키는 프로젝트 내 관용명. |
| `IET` | In-Editor Tutorial. Unity `com.unity.learn.iet-framework` package는 editor 안 interactive tutorial을 표시하기 위한 framework다. |
| `Tutorial Framework` | Unity의 editor tutorial 표시/작성용 package. 앱 런타임 Cooking Assistant UI와는 별개다. |
| `GoalManager` | MRTemplate tutorial progression을 관리하는 script/object. tutorial step, coaching prompt, learn modal 흐름과 연결된다. |
| `TutorialPlayer` | MRTemplate tutorial video/player UI prefab. 이 프로젝트 문맥에서는 tutorial UI object다. |
| `Bootstrap` | 앱 시작 시 runtime UI를 구성하거나 초기 상태를 맞추는 코드. |

### 5.6.3 왜 bootstrap만으로 부족한가

Unity의 `RuntimeInitializeOnLoadMethod`는 scene load와 Unity lifecycle에 묶여 있다. 실행 순서 보장에도 제한이 있고, OpenXR runtime 초기화 실패처럼 더 앞 단계에서 앱이 멈추면 bootstrap cleanup은 실행되지 않을 수 있다.

따라서 MRTemplate tutorial UI가 제품에서 필요 없다면 default state를 scene/prefab에서 inactive로 만드는 것이 맞다. Bootstrap cleanup은 방어용 fallback이면 충분하다.

### 5.6.4 프로젝트 적용

Cooking Assistant에서 올바른 정리 방향은 다음과 같다.

- `com.unity.learn.iet-framework`를 `Packages/manifest.json`과 `packages-lock.json`에서 제거한다.
- editor tutorial asset/settings에 의존하지 않는다.
- `Goal Manager`는 tutorial UI/progression만 담당한다면 prefab 안에서 inactive로 둔다.
- `TutorialPlayer.prefab`은 prefab root에서 inactive로 둔다.
- scene에 active override가 남은 `Coaching UI`도 inactive로 바꾼다.
- XR rig 전체 또는 MR Interaction Setup 전체를 끄면 안 된다. 그 안에는 필요한 XR infrastructure가 있기 때문이다.

단, `GoalManager`가 permission request나 passthrough activation 같은 제품 runtime 책임까지 같이 갖고 있었다면, 그 책임은 별도 bootstrap/service component로 분리해야 한다. Tutorial object를 껐는데 UI interaction이나 passthrough가 깨지는 현상은 이런 책임 혼합을 의심해야 한다.

### 5.6.5 참고 자료

- Unity Tutorial Framework package: <https://docs.unity.cn/2020.3/Documentation/Manual/com.unity.learn.iet-framework.html>
- Unity In-Editor Tutorial concept: <https://learn.unity.com/tutorial/693c871a9d7b0fc07e5394eb>
- Unity RuntimeInitializeOnLoadMethod: <https://docs.unity3d.com/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html>
- Unity Prefabs manual: <https://docs.unity.cn/2023.1/Documentation/Manual/Prefabs.html>

---

## 5.7 YouTube link intake와 Android Sharesheet

### 5.7.1 배경

XR에서 긴 YouTube URL을 직접 입력하게 하는 것은 약한 기본값이다. 손 추적, 가상 키보드, 레이 포인터 입력은 짧은 명령에는 충분해도 긴 URL 입력에는 피로와 오류가 크다.

Android는 앱 간 단순 데이터 전달을 위해 Intent와 Sharesheet를 제공한다. 사용자는 YouTube 또는 Chrome에서 Share를 누르고 Cooking Assistant를 선택할 수 있다. 이 방식은 이미 학습된 OS 패턴이고 XR에서도 타이핑보다 자연스럽다.

### 5.7.2 주요 용어

| 용어 | 의미 |
|---|---|
| `Intent` | Android component 간 작업 요청 메시지. |
| `ACTION_SEND` | 한 앱에서 다른 앱으로 data를 공유할 때 쓰는 intent action. |
| `Intent.EXTRA_TEXT` | 공유되는 text payload를 담는 extra key. URL 공유는 보통 `text/plain` MIME type과 `EXTRA_TEXT`로 전달된다. |
| `MIME type` | 데이터 형식을 나타내는 media type. |
| `Android Sharesheet` | 사용자가 공유 대상을 선택하는 시스템 UI. |
| `Intent resolver` | 특정 작업을 처리할 수 있는 앱이 여러 개일 때 사용자가 선택하도록 보여주는 Android resolution UI. |
| `ClipboardManager` / `ClipData` | Android clipboard API와 clipboard data 표현 객체. |

### 5.7.3 프로젝트 적용

Cooking Assistant의 link intake 우선순위는 다음이 맞다.

1. Android Sharesheet share target으로 YouTube URL 받기.
2. 명시적인 Paste button으로 clipboard에서 URL 읽기.
3. watch URL, youtu.be, shorts URL, video ID-only 입력을 canonicalize하기.
4. phone/QR/pairing flow는 나중에 확장하기.
5. 직접 입력은 fallback으로 유지하기.

핵심은 “사용자가 XR 안에서 긴 URL을 타이핑하지 않게 하는 것”이다. Android 공식 문서도 share target이 text content를 받으면 사용자가 사용 전 확인/수정할 수 있게 하라고 권장한다.

### 5.7.4 참고 자료

- Android sharing overview: <https://developer.android.com/training/sharing>
- Send simple data: <https://developer.android.com/training/sharing/send>
- Receive simple data: <https://developer.android.com/training/sharing/receive>
- Android ClipboardManager: <https://developer.android.com/reference/kotlin/android/content/ClipboardManager>
- Android ClipData: <https://developer.android.com/reference/android/content/ClipData>
- Android XR foundations: <https://developer.android.com/design/ui/xr/guides/foundations>

---

## 5.8 Android signing과 keystore

### 5.8.1 배경

Android는 설치/업데이트 신뢰성을 위해 APK/AAB 서명을 요구한다. 같은 앱의 업데이트는 기존 설치본과 호환되는 signing identity를 가져야 한다. 그렇지 않으면 OS는 같은 앱의 안전한 업데이트로 보지 않는다.

Unity에서 Android build를 만들 때도 결국 Android app signing 규칙을 따른다. release APK/AAB를 배포하려면 keystore와 key alias/password 관리가 필요하다.

### 5.8.2 주요 용어

| 용어 | 의미 |
|---|---|
| `Keystore` | 하나 이상의 private key를 담는 파일. Android release signing에 사용된다. |
| `App signing key` | 사용자 기기에 설치되는 APK를 최종적으로 서명하는 key. 앱 lifetime 동안 매우 중요하다. |
| `Upload key` | Google Play App Signing을 쓸 때 개발자가 Play Console에 업로드하는 artifact를 서명하는 key. |
| `Certificate fingerprint` | 인증서의 MD5/SHA-1/SHA-256 fingerprint. API provider 연동에서 앱 식별에 쓰이는 경우가 많다. |
| `apksigner` | Android SDK Build Tools의 APK 서명/검증 도구. |

### 5.8.3 프로젝트 적용

개발 중 device install은 debug signing으로 충분할 수 있다. 하지만 배포나 외부 테스트로 넘어가면 release signing key를 안정적으로 관리해야 한다. keystore를 잃어버리면 Play App Signing 미사용 앱은 업데이트가 막힐 수 있다.

### 5.8.4 참고 자료

- Android app signing: <https://developer.android.com/guide/publishing/app-signing>
- Android apksigner: <https://developer.android.com/tools/apksigner>
- Unity Android signing: <https://docs.unity.com/en-us/build-automation/sign-build-artifacts/sign-an-android-application>
- Unity Android Keystore Manager: <https://docs.unity3d.com/Manual/android-keystore-manager.html>

---

## 5.9 디버깅 관점: logcat, dumpsys, artifact capture

### 5.9.1 배경

XR/Unity/Android 문제는 한 레이어에서만 보이지 않는다. 화면은 검게 보이지만 Unity splash는 뜰 수 있고, permission은 grant됐지만 OpenXR runtime은 unavailable일 수 있으며, scene object는 active지만 bootstrap이 늦게 꺼줄 수도 있다.

따라서 “증상 하나 = 원인 하나”로 보지 말고 레이어별로 증거를 분리해야 한다.

### 5.9.2 주요 용어

| 용어 | 의미 |
|---|---|
| `adb` | Android Debug Bridge. device install, logcat, shell command, dumpsys, screen capture 등에 사용된다. |
| `logcat` | Android system/application log stream. Unity log, OpenXR native error, permission callback, activity lifecycle을 확인한다. |
| `dumpsys package` | 설치된 package의 manifest-derived 정보, permission grant 상태, feature/library 상태 등을 확인할 수 있는 system dump. |
| `artifact capture` | 특정 재현 시점의 logcat, dumpsys, screenshots, package metadata를 한 디렉터리에 저장하는 방식. |

### 5.9.3 프로젝트 적용

Cooking Assistant 장애 분석에서는 다음 순서가 유효했다.

1. 화면 캡처로 “완전 black인지, Unity splash/loading인지, app panel인지” 구분한다.
2. logcat에서 Unity app log와 OpenXR native error를 분리한다.
3. dumpsys로 manifest 반영과 runtime permission grant를 확인한다.
4. Unity scene/prefab default active state를 확인한다.
5. PR history로 “언제 reintroduced 되었는지”를 본다.

---

## 6. 용어 관계도

```text
Manifest
  ├─ uses-permission: 앱이 보호 기능을 요청할 수 있음을 선언
  ├─ uses-feature: 앱이 기대하는 기기/소프트웨어 능력을 선언
  ├─ queries: 다른 package/service/provider 조회 가능성을 선언
  └─ uses-native-library: vendor native library 접근성을 선언

Runtime
  ├─ permission grant: 현재 사용자에게 실제 승인된 권한 상태
  ├─ OpenXR loader: 활성 XR runtime을 찾는 계층
  ├─ OpenXR runtime: 실제 XR platform 기능 구현
  └─ native library: process가 link/load해야 하는 공유 library

Unity
  ├─ Scene: 앱 시작 object graph
  ├─ GameObject: scene 안의 기본 객체
  ├─ Component: GameObject에 붙는 기능 조각
  ├─ Prefab: 재사용 가능한 GameObject hierarchy asset
  ├─ Prefab instance: scene에 배치된 prefab instance
  └─ Prefab override: 원본 prefab과 다른 scene instance 값

MRTemplate
  ├─ IET: editor tutorial framework
  ├─ GoalManager: tutorial progression manager
  ├─ TutorialPlayer: tutorial video/player UI
  └─ Coaching UI: template onboarding UI
```

## 7. 실무 체크리스트

### 7.1 Android XR 앱이 첫 화면에 못 들어갈 때

1. 최신 APK가 실제로 설치됐는지 확인한다.
2. `dumpsys package`로 manifest permission/feature/native-library 반영을 본다.
3. dangerous permission은 runtime grant 여부까지 본다.
4. logcat에서 `xrCreateInstance`, `XR_ERROR_RUNTIME_UNAVAILABLE`, namespace/library 오류를 찾는다.
5. Unity OpenXR settings가 target runtime과 맞는지 본다.
6. scene/prefab에 sample/template UI가 active로 남아 있는지 본다.
7. bootstrap이 실행됐는지 앱 log로 확인하되, bootstrap을 default state의 대체물로 보지 않는다.
8. PR history에서 Unity upgrade나 template regeneration이 package/scene state를 되돌렸는지 확인한다.

### 7.2 Unity MRTemplate cleanup을 할 때

1. editor tutorial package(IET)와 runtime template object를 구분한다.
2. package 제거는 `Packages/manifest.json`과 `packages-lock.json`을 함께 본다.
3. scene에 있는 prefab instance override를 본다.
4. 필요한 XR infrastructure prefab 전체를 끄지 않는다.
5. tutorial manager/player/coaching UI만 비활성화하거나 제거한다.
6. 변경 후 JSON parse, tracked reference search, Unity YAML diff를 확인한다.

### 7.3 Android XR UI가 보이지만 상호작용이 안 될 때

1. World Space Canvas인지 확인한다.
2. Canvas에 `TrackedDeviceGraphicRaycaster`가 있는지 확인한다.
3. EventSystem에 `XRUIInputModule`이 있고 `Enable XR Input`이 켜져 있는지 확인한다.
4. Scene의 hand/controller interactor가 UI interaction을 지원하는지 확인한다.
5. UI panel이 interactor ray의 layer/culling/raycast mask 안에 있는지 확인한다.
6. Template tutorial object를 끄면서 permission request나 passthrough activation까지 함께 꺼지지 않았는지 확인한다.

### 7.4 YouTube intake UX를 설계할 때

1. Share target을 기본 경로로 둔다.
2. Paste button은 명시적 사용자 액션 뒤에만 clipboard를 읽는다.
3. URL canonicalization은 deterministic test로 보호한다.
4. XR target size와 multimodal input을 기본 전제로 둔다.
5. 직접 입력은 fallback으로 유지한다.

## 8. 결론

Android XR Unity 앱은 한 기술 스택이 아니라 여러 runtime contract가 겹친 결과물이다. Android manifest는 설치와 접근 자격을 설명하고, runtime permission은 현재 사용자 승인 상태를 설명하며, OpenXR loader는 활성 XR runtime을 찾아야 한다. Unity는 scene/prefab graph를 기준으로 시작하고, XR UI는 EventSystem과 tracked device input까지 연결되어야 실제로 조작된다.

따라서 Cooking Assistant 같은 앱에서 중요한 원칙은 다음이다.

- 권한 선언과 권한 승인을 분리해서 본다.
- passthrough 문제와 OpenXR runtime 문제를 분리해서 본다.
- Unity code 존재 여부와 scene/prefab runtime 존재 여부를 분리해서 본다.
- MRTemplate editor tutorial과 runtime tutorial object를 분리해서 본다.
- 제품 앱의 기본 상태는 bootstrap cleanup이 아니라 scene/prefab default state로 보장한다.

이 기준을 지키면 “화면이 안 뜬다”, “권한이 있는데 안 된다”, “튜토리얼은 없어졌는데 UI가 안 눌린다” 같은 증상을 한 덩어리로 보지 않고, 실제로 깨진 contract를 좁혀갈 수 있다.
