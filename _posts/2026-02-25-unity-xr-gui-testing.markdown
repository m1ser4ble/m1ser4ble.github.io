---
layout: single
title: "Unity MR/XR GUI 테스트 자동화 - 종합 가이드"
date: 2026-02-25 14:00:00 +0900
categories: [system]
tags: [unity, xr, mr, vr, testing, automation, gui-testing, ci-cd]
toc: true
toc_sticky: true
excerpt: "Playwright처럼 웹 GUI를 테스트하듯, Unity MR/XR 앱의 GUI를 자동으로 테스트하는 방법을 정리한다. 시뮬레이션 기반 테스트부터 CI/CD 통합까지."
---

## 개요

웹 개발에서 Playwright나 Cypress로 UI를 자동 테스트하듯, XR 앱에서도 GUI 테스트 자동화가 필요하다. 하지만 XR은 6DoF(6 Degrees of Freedom) 입력, 핸드 트래킹, 아이 트래킹 등 기존 2D UI와 근본적으로 다른 인터랙션 모델을 사용하기 때문에, 테스트 접근 방식도 다르다.

이 글에서는 2024-2026년 기준 최신 XR GUI 테스트 방법을 망라한다.

## 핵심 질문: XR에 Playwright 같은 도구가 있나?

**결론부터 말하면, 아직 없다.** 단일 도구로 Playwright처럼 "XR 앱의 모든 GUI를 자동 테스트"하는 것은 불가능하다. 대신 여러 도구를 조합해서 테스트 파이프라인을 구성해야 한다.

가장 가까운 도구들:

| 도구 | 역할 | Playwright 비유 |
| --- | --- | --- |
| Meta XR Simulator | 헤드셋 없이 Quest 앱 시뮬레이션 | 브라우저 런타임 |
| GameDriver (XRDriver) | XR 인터랙션 자동화 API | Playwright API |
| Unity Test Framework | 테스트 실행 프레임워크 | Jest/Mocha |
| AltTester | Unity 오브젝트 접근 및 조작 | DOM 쿼리 |

## Unity 빌트인 테스트 인프라

### Unity Test Framework (UTF)

모든 Unity 테스트의 기반이다. Edit Mode와 Play Mode 테스트를 지원하고, 타겟 플랫폼(Standalone, Android, iOS)에서 실행된다.

CI/CD 커맨드라인 실행:

```bash
# 배치 모드로 테스트 실행
unity -runTests -projectPath <path> -testResults <results_path>
```

XR 전용 테스트 어트리뷰트:

- `[TargetXrDisplays]` - 특정 XR 디스플레이 타겟을 포함/제외
- `[ConditionalAssembly]` - 설치된 XR 어셈블리에 따라 테스트 필터링

이를 통해 코드 중복 없이 플랫폼별 테스트를 실행할 수 있다.

### XR Interaction Simulator

XR Interaction Toolkit(XRI) 3.1+에 포함된 **XR Interaction Simulator**는 헤드셋 없이 XR 입력을 시뮬레이션한다.

지원하는 시뮬레이션:

- 컨트롤러 입력 (키보드/마우스 매핑)
- 핸드 트래킹 (XR Hands 패키지 연동)
- 아이 게이즈 (XRI 2.3+)

기본 키 매핑:

- `Tab` - 좌측 컨트롤러 / 우측 컨트롤러 / HMD 전환
- `우클릭 드래그` - HMD 시선 회전
- `WASD` - HMD 이동
- `Shift` 또는 `T` - 좌측 컨트롤러 조작

Unity Input System으로 구동되므로, **스크립트로 자동화할 수 있다**는 점이 핵심이다.

**한계**: 키보드/마우스로 컨트롤러 포즈를 간접 조작하는 방식이라, 정밀한 3D 공간 위치 지정이 어렵다.

### XR Performance Test Framework

Unity가 제공하는 XR 성능 테스트 전용 패키지다. 기본 성능 테스트 프레임워크에 XR 메타데이터 수집을 추가한다.

- XR 전용 프로파일러 마커 수집
- 디바이스 메타데이터 기록
- 스테레오 렌더링 모드별 (MultiPass, SinglePass, SinglePass Instanced) 성능 비교

```bash
# CI에서 XR 성능 테스트 실행
Unity.exe -runTests -batchmode -projectPath <project> \
  -testResults output.xml -testPlatform <platform>
```

## Meta XR Simulator (Quest 개발 필수)

Meta Quest 앱을 개발한다면 **Meta XR Simulator**가 가장 중요한 테스트 도구다. PC/Mac에서 Quest 하드웨어를 시뮬레이션하는 경량 OpenXR 런타임이다.

### 주요 기능

- **스테레오 렌더링 시뮬레이션**: Quest 2, 3, Pro 디스플레이 특성 재현
- **입력 시뮬레이션**: 키보드/마우스, Xbox 컨트롤러, 실제 Quest 컨트롤러 (Data Forwarding)
- **핸드 트래킹**: aim, poke, pinch, grab 4가지 포즈 시뮬레이션
- **합성 환경**: 11개 사전 제작된 방 환경으로 MR 테스트
- **멀티플레이어**: 한 PC에서 여러 인스턴스 동기화 실행

### Session Capture (Record & Replay)

이것이 **자동화 테스트의 핵심 기능**이다. 사용자 인터랙션을 `.vrs` 파일로 녹화하고, 동일한 시퀀스를 재생할 수 있다.

워크플로우:

1. `Record & Replay > Record` 클릭, `.vrs` 파일 경로 지정
2. 키보드/마우스 또는 컨트롤러로 앱과 인터랙션
3. `Stop Recording` 클릭
4. 재생: 녹화 파일 선택 후 `Play`

활용 시나리오:

- **회귀 테스트**: 동일 인터랙션 시퀀스를 재생하여 일관된 출력 확인
- **멀티플레이어 테스트**: 한 플레이어 세션을 녹화 후 봇으로 재생, 다른 플레이어는 수동 조작
- **CI 통합**: 녹화 파일을 레포에 커밋하고 CI에서 자동 재생

### Hybrid Automation Testing

Meta가 권장하는 방식은 **Record & Replay + 프로그래밍 어설션**을 결합하는 Hybrid 접근이다. 녹화된 입력 시퀀스를 재생하면서, Unity Test Framework의 NUnit 어설션으로 결과를 검증한다.

Unite 2025에서 **XR Simulator 2.0**이 발표되어 인터페이스 리빌드와 빠른 시작 시간을 제공한다.

## 서드파티 자동화 도구

### GameDriver (XRDriver) - 상용, XR 최적화

현재 XR 테스트 자동화에서 **가장 완성도 높은 상용 도구**다.

**아키텍처**:

```text
[Test Code] --API--> [GameDriver Agent (게임 내 임베디드)] ---> [Unity Scene]
```

- `GameDriver Agent`를 게임 첫 씬에 임베디드
- 외부 테스트 코드가 에이전트와 통신
- `HierarchyPath` 쿼리 언어로 씬 내 오브젝트/프로퍼티/메서드 접근

**XR 입력 시뮬레이션 코드 예시**:

```csharp
// 가상 Oculus HMD와 좌측 컨트롤러 생성
api.CreateInputDevice("Unity.XR.Oculus.Input.OculusHMD", "OculusHMD");
api.CreateInputDevice(
    "Unity.XR.Oculus.Input.OculusTouchController",
    "OculusLeftHand",
    new string[] { "LeftHand" },
    true
);

// HMD 위치 설정
api.Vector3InputEvent(
    "GDIOOculusHMD/centerEyePosition",
    new Vector3(0, 0, -5),  // z=-5 위치에 HMD 배치
    100                      // 100ms 대기
);

// 좌측 컨트롤러 위치 설정
api.Vector3InputEvent(
    "GDIOOculusLeftHand/devicePosition",
    new Vector3(-0.24f, -0.1f, 0.24f),
    1
);

// 그립 버튼 누르기
api.ButtonPress("GDIOOculusLeftHand/gripPressed", 100, 1f);

// 썸스틱 입력
api.Vector2InputEvent(
    "GDIOOculusLeftHand/Primary2DAxis",
    new Vector2(0f, -1f),  // 아래쪽으로 밀기
    100
);
```

**2025년 업데이트 (v2025.06)**:

- OpenXR 헤드셋 자동 감지
- VR 입력 시뮬레이션 강화
- 커스텀 VR 디바이스 생성 지원
- 터치 입력 레코딩 (모바일/XR)
- Unity, Unreal Engine, Godot 크로스 엔진 지원

### AltTester - 오픈소스, 일반 Unity용

Unity 오브젝트를 외부 테스트 코드에서 접근하고 조작하는 오픈소스 도구다. C#, Python, Java, Robot Framework로 테스트를 작성할 수 있다.

```python
# Python으로 Unity UI 오브젝트 탭
altdriver.find_object(By.NAME, "ButtonStart").tap()
```

**XR 지원 상태**: 제한적. "모바일 모드에서 VR 앱을 테스트할 수 있어야 한다"는 공식 입장이지만, 전용 XR 디바이스 시뮬레이션이나 OpenXR 통합은 없다. 로드맵에 AR/VR 기술 조사가 포함되어 있다.

**적합한 용도**: XR 앱 내 Canvas 기반 2D UI (메뉴, HUD 등) 테스트에는 유용하다.

### Airtest/Poco (NetEase) - 제한적 VR 지원

이미지 인식 기반의 Airtest와 UI 엘리먼트 트리 기반의 Poco가 있다. Unity3D 공식 지원이 있지만, VR 지원은 Google VR(Cardboard) Android 빌드에만 한정된다.

- SteamVR 핸드 디바이스 지원은 "작업 중" 상태로 오래 멈춰있음
- OpenXR, Daydream, WebVR 미지원
- **현재 XR 워크플로에는 비추천**

### Arium (ThoughtWorks) - 아카이브됨

XR 전용 자동화 프레임워크였으나, **2025년 6월 아카이브**되어 더 이상 유지보수되지 않는다. 역사적 참고용으로만 가치가 있다.

### INTENXION (학계, 2025)

IEEE/FSE 2024-2025에 발표된 연구 프레임워크다. Unity Test Framework 위에 구축되어, XR 유저 인터랙션의 분류 체계(Navigation, Selection, Manipulation)에 따른 테스트를 구현한다.

- XR Interaction Simulator를 구동하여 테스트 액션 실행
- XRI Examples의 8가지 인터랙터블 오브젝트 타입에 100% 커버리지 달성
- 아직 연구 프로토타입 단계

## 시뮬레이션 및 헤드리스 테스트

### 헤드리스 테스트 3단계

XR 앱의 헤드리스 테스트는 세 가지 레벨로 나눌 수 있다:

| 레벨 | 필요한 것 | 도구 |
| --- | --- | --- |
| Level 1: 헤드셋 없음 | 데스크톱 디스플레이만 | XR Device Simulator, Meta XR Simulator |
| Level 2: 디스플레이 없음 | GPU만 (CI 서버) | MockHMD XR Plugin |
| Level 3: 완전 헤드리스 | CPU만 | Monado (XR_MND_headless) |

### MockHMD XR Plugin

Unity의 `com.unity.xr.mock-hmd` 패키지. HTC Vive 디스플레이 특성을 모방한 스테레오 렌더링을 제공한다. **입력은 지원하지 않으므로** 렌더링 테스트 전용이다.

렌더 모드: MultiPass, SinglePassInstanced, Left Eye, Right Eye, Both Eyes

### Monado (오픈소스 OpenXR 런타임)

완전 오픈소스 OpenXR 런타임. "simulated" 드라이버로 가상 HMD와 컨트롤러를 제공하여 실제 하드웨어 없이 OpenXR 앱을 연결할 수 있다.

- `XR_MND_headless` 확장으로 디스플레이 없이 실행
- `XR_EXT_conformance_automation`으로 스크립트 기반 입력
- Linux CI 파이프라인에서 유용

## Record & Replay 접근법

### Meta XR Simulator Session Capture

위에서 설명한 Meta의 Record & Replay 기능. `.vrs` 파일로 입력과 스크린샷을 정확한 타이밍에 캡처한다.

### PLUME (학계, IEEE VR 2024)

XR 행동 데이터의 완전한 녹화 및 재생을 위한 오픈소스 도구다.

구성요소:

- **PLUME-Recorder**: Unity 패키지, XR 행동 데이터 녹화
- **PLUME-Viewer**: 오프라인 인터랙티브 재생 및 분석
- **PLUME-Python**: 통계 분석 라이브러리

Windows, Android, iOS 호환. OpenXR로 다양한 HMD 지원. 녹화 시 성능 오버헤드 최소화에 최적화되어 있다.

### 한계

2025년 Systematic Mapping Study에 따르면 Record & Replay는 **유지보수성이 낮다**. UI가 변경되면 캡처된 테스트가 자주 깨지며, 수동 업데이트가 필요하다.

## 비주얼 리그레션 테스트

### Unity Graphics Test Framework

픽셀 레벨 이미지 리그레션을 위한 Unity 빌트인 솔루션이다. 씬을 렌더링하고 "알려진 좋은" 참조 이미지와 비교한다.

```csharp
// 테스트 메서드에 어트리뷰트 추가
[PrebuildSetup("SetupGraphicsTestCases")]
[UseGraphicsTestCases]
public void VisualTest(GraphicsTestCase testCase)
{
    // 씬 로드 후 렌더링
    SceneManager.LoadScene(testCase.ScenePath);
    yield return null;

    // 참조 이미지와 비교 (임계값 설정 가능)
    ImageAssert.AreEqual(testCase.ReferenceImage, Camera.main.targetTexture);
}
```

워크플로:

1. 테스트를 한 번 실행하여 실제 프레임 생성
2. `TestResults.xml`에서 이미지 추출
3. `ActualImages` 폴더를 `ReferenceImages`로 이름 변경
4. 이후 실행 시 렌더링 결과를 참조 이미지와 비교

XR에서는 스테레오 렌더링 모드별로 참조 이미지를 분리하여 관리한다.

## CI/CD 통합

### GameCI (GitHub Actions)

Unity CI/CD의 사실상 표준이다. GitHub Actions 워크플로를 제공한다.

```yaml
name: Unity CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: actions/cache@v3
        with:
          path: Library
          key: Library-${{ hashFiles('Assets/**', 'Packages/**', 'ProjectSettings/**') }}
          restore-keys: Library-

      - uses: game-ci/unity-test-runner@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
          UNITY_EMAIL: ${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: ${{ secrets.UNITY_PASSWORD }}
        with:
          projectPath: .
          testMode: playmode

      - uses: game-ci/unity-builder@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
        with:
          targetPlatform: Android  # Quest 빌드
```

### Meta XR Simulator CI 통합

Meta XR Simulator는 헤드리스/배치 모드로 CI에서 실행할 수 있다. `.vrs` 녹화 파일을 레포에 포함시키고 CI에서 자동 재생하는 방식이다.

### 클라우드 XR 테스트

**2026년 초 기준, 공개적으로 사용 가능한 클라우드 XR 디바이스 팜은 존재하지 않는다.** BrowserStack이나 AWS Device Farm은 Quest나 Vision Pro를 지원하지 않는다. 팀들은 자체 호스팅 시뮬레이터로 CI를 구성한다.

## Apple Vision Pro (visionOS) 테스트

Unity의 visionOS 지원은 **PolySpatial** 패키지를 사용하며, Unity Pro/Enterprise에서 사용 가능하다.

테스트 방법:

- **Play to Device**: Unity Editor Play 모드에서 visionOS Device Simulator 윈도우로 실시간 확인
- **visionOS Device Simulator (Xcode)**: Apple 공식 시뮬레이터. 패스스루 등 일부 AR 기능은 시뮬레이터에서 불가
- **물리 디바이스**: AR/패스스루 기능은 실제 Apple Vision Pro 필수

**한계**: Meta XR Simulator에 비해 자동화 도구가 미성숙하다. Record & Replay나 합성 환경 시스템이 없다.

## 성능 테스트

XR에서 성능은 곧 사용자 건강과 직결된다. 프레임 드롭은 멀미를 유발한다.

### 프레임 예산

| 타겟 Hz | 프레임당 시간 |
| --- | --- |
| 72 Hz | 13.9ms |
| 90 Hz | 11.1ms |
| 120 Hz | 8.3ms |

### Meta 도구

- **OVR Metrics Tool**: 온스크린 오버레이 + CSV 내보내기 (프레임 레이트, CPU/GPU 스로틀링, 화면 찢김)
- **Quest Developer Hub Performance Analyzer**: 연결된 Quest 디바이스 프로파일링
- **Meta Quest Runtime Optimizer**: 병목 분석, What If 분석 (오브젝트를 하나씩 비활성화하여 GPU 영향 측정)

### Android XR (Google) 도구

- Late latching으로 헤드 포즈-디스플레이 지연 감소
- Application Spacewarp로 45Hz 렌더링을 90Hz 효과로 표시
- Perfetto 트레이스로 CI에서 자동 CPU 사용률 분석

## 권장 테스트 스택 (2025-2026)

### Meta Quest 앱

```text
Meta XR Simulator (런타임)
  + Unity Test Framework Play Mode (테스트 프레임워크)
  + Session Capture Record & Replay (인터랙션 자동화)
  + GameDriver XRDriver (정밀 인터랙션 제어, 상용)
  + Unity Graphics Test Framework (비주얼 리그레션)
  + com.unity.xr.test-framework.performance (성능 리그레션)
  + GameCI (CI/CD)
```

### 크로스 플랫폼 XR

```text
Unity Test Framework (기반)
  + XR Interaction Simulator (에디터 내 시뮬레이션)
  + [TargetXrDisplays] / [ConditionalAssembly] (플랫폼별 분기)
  + AltTester (2D UI 오버레이 테스트)
  + MockHMD (CI 헤드리스 렌더링)
```

### Apple Vision Pro

```text
Unity Play to Device + visionOS Xcode Simulator (이터레이션)
  + Unity Test Framework (자동화 테스트)
  + 물리 디바이스 (AR/패스스루 기능)
```

## 도구 비교 종합

| 도구 | XR 지원 | 오픈소스 | CI 친화 | 적합한 용도 |
| --- | --- | --- | --- | --- |
| Meta XR Simulator | Quest 전용, 완전 | 무료 | O (헤드리스) | Quest 앱 시뮬레이션 |
| GameDriver/XRDriver | 퍼스트클래스 | 상용 | O | XR 인터랙션 자동화 |
| AltTester | 제한적 (모바일 모드) | MIT | O | 일반 Unity UI 자동화 |
| Unity Graphics Test | 네이티브 | Unity 패키지 | O | 렌더링 리그레션 |
| XR Performance Test | XR 메타데이터 | GitHub | O | 성능 벤치마크 |
| Airtest/Poco | 매우 제한적 | O | 부분적 | 모바일 Unity 게임 |
| Arium | XR 전용이었음 | 아카이브됨 | - | 참고용 |
| MockHMD | 렌더링만 | Unity 패키지 | O | CI 스테레오 렌더링 |
| Monado | 완전 헤드리스 | O | O | Linux CI OpenXR |

## 학계 동향 (2025)

2025년 1월 발표된 Systematic Mapping Study (Automated Software Engineering, Springer)에서 34개 논문을 분석한 결과:

- 대부분의 XR 테스트 접근법이 **시스템 레벨 테스트**에 집중 (22/27)
- XR 유닛 테스트 프레임워크는 여전히 미발달
- Record & Replay는 유지보수성이 낮음
- 6DoF 인터랙션은 2D GUI 테스트와 근본적으로 다른 기법이 필요

## 주의할 점

- **Record & Replay의 취약성**: UI가 바뀌면 녹화가 깨진다. 가능하면 프로그래밍 기반 테스트와 병행
- **플랫폼 파편화**: Meta, Apple, Google 각각 다른 테스트 도구 생태계를 가짐
- **클라우드 테스트 부재**: 원격 XR 디바이스 팜이 아직 없으므로, 실제 디바이스 테스트는 로컬에서만 가능
- **성능 = 안전**: XR에서 프레임 드롭은 사용자 불편(멀미)을 유발하므로, 성능 테스트는 선택이 아닌 필수

## 참고 자료

- [Unity Test Framework Manual](https://docs.unity3d.com/2023.2/Documentation/Manual/testing-editortestsrunner.html)
- [XR Interaction Simulator (XRI 3.1)](https://docs.unity3d.com/Packages/com.unity.xr.interaction.toolkit@3.1/manual/xr-interaction-simulator-overview.html)
- [Meta XR Simulator Overview](https://developers.meta.com/horizon/documentation/unity/xrsim-intro/)
- [Meta XR Simulator Automation Testing](https://developers.meta.com/horizon/documentation/unity/xrsim-unity-automated-testing/)
- [Meta XR Simulator Hybrid Automation](https://developers.meta.com/horizon/documentation/unity/xrsim-unity-automated-testing-hybrid/)
- [AltTester Unity SDK](https://github.com/alttester/AltTester-Unity-SDK)
- [GameDriver](https://www.gamedriver.io/)
- [GameDriver: Unity Input System + XR](https://kb.gamedriver.io/working-with-the-unity-input-system-and-xr-using-gamedriver)
- [PLUME (IEEE VR 2024)](https://github.com/liris-xr/PLUME)
- [Arium (Archived)](https://github.com/thoughtworks/Arium)
- [INTENXION (IEEE)](https://ieeexplore.ieee.org/document/11334390/)
- [Unity Graphics Test Framework](https://docs.unity3d.com/Packages/com.unity.testframework.graphics@8.0/manual/index.html)
- [com.unity.xr.test-framework.performance](https://github.com/Unity-Technologies/com.unity.xr.test-framework.performance)
- [GameCI (GitHub Actions)](https://github.com/game-ci/unity-actions)
- [Monado OpenXR Runtime](https://monado.freedesktop.org/)
- [Systematic Mapping Study (arXiv, 2025)](https://arxiv.org/abs/2501.08909)
- [Unity visionOS Tutorial](https://learn.unity.com/tutorial/developing-for-vision-os-with-unity)
- [Android XR Unity Performance](https://developer.android.com/develop/xr/unity/performance)
