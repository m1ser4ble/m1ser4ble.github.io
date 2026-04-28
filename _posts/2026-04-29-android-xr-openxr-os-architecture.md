---
layout: single
title: "Android XR 생태계와 OpenXR의 관계 정리"
date: 2026-04-29 08:55:42 +0900
categories: infra
excerpt: "Android XR 생태계와 OpenXR의 관계는 Android OS의 그래픽 서비스와 센서 계층 위에서 OpenXR 런타임이 표준 XR API를 제공하는 구조로 이해하면 가장 정확하다."
toc: true
toc_sticky: true
tags: [androidxr, openxr, aosp, surfaceflinger, hal, xr]
---
TL;DR
- Android XR은 완전히 별도 운영체제라기보다 Android의 앱 모델과 그래픽 스택 위에 XR 기능이 확장된 구조에 가깝다.
- OpenXR은 OS 자체가 아니라 앱과 XR 런타임 사이의 표준 API 계층이며, 실제 기기 제어는 벤더 런타임과 Android 시스템 서비스가 담당한다.
- HAL, Binder IPC, SurfaceFlinger, composition, foveation, reprojection, Khronos loader를 함께 이해해야 Android XR의 성능과 구조가 보인다.

## 1. 개념
Android XR과 OpenXR의 관계는 `Android OS + 벤더 XR 런타임 + OpenXR 표준 API`라는 3층 구조로 이해하면 가장 쉽다. Android는 프로세스, 권한, Activity lifecycle, 그래픽 서비스, 센서 접근 방식을 관리하는 기반 운영체제이고, OpenXR은 그 위에서 XR 앱이 공통된 방식으로 헤드셋 기능을 호출하도록 만드는 표준 인터페이스다. 즉 OpenXR은 Android를 대체하지 않고 Android 위에서 동작하는 XR API 표면이다.

## 2. 배경
모바일 XR 기기는 PC처럼 단일 프로그램이 하드웨어를 거의 독점하는 구조와 다르다. 헤드셋도 결국 Android 계열 운영체제 위에서 앱 샌드박스, 권한 승인, 시스템 스케줄링, 열 관리, 디스플레이 합성 과정을 거친다. 동시에 제조사마다 추적 방식, 패스스루, 손 추적, 시선 추적, 컨트롤러 특성이 달라서 공통 API가 필요하다. 이때 OpenXR이 공통 인터페이스를 제공하고, Android는 실제 앱 실행과 시스템 자원 관리를 담당한다.

## 3. 이유
이 구조를 알아야 하는 이유는 단순하다. XR 앱이 느리거나 화면이 밀리거나 특정 기능이 기기마다 다르게 동작할 때 문제의 위치가 OpenXR API 자체인지, Android 그래픽 파이프라인인지, 벤더 런타임인지 구분해야 하기 때문이다. 예를 들어 head pose는 센서와 추적 스택에서 오고, 앱 프레임은 Vulkan이나 OpenGL ES로 렌더링되며, 최종 표시 타이밍은 compositor와 디스플레이 스택이 좌우한다. 실무에서는 한 레이어만 알아서는 병목을 못 찾는다.

## 4. 특징
- **Android 기반성**: XR 헤드셋도 Android의 권한 모델, Activity lifecycle, 시스템 서비스 구조를 따른다.
- **레이어드 구조**: 앱은 OpenXR을 호출하지만 실제 구현은 loader, runtime, Android 시스템 서비스, HAL, 커널 드라이버가 나눠 맡는다.
- **그래픽 타이밍 민감도**: SurfaceFlinger, BufferQueue, Display HAL, vsync 타이밍이 프레임 안정성과 지연에 직접 연결된다.
- **모바일 제약 중심**: 고해상도, 양안 렌더링, 고주사율, 배터리, 발열이 함께 얽혀 있어 foveation과 reprojection 같은 기법이 중요하다.
- **표준과 벤더 확장의 공존**: 공통 기능은 OpenXR core로, 차별화 기능은 vendor extension으로 제공되는 경우가 많다.

## 5. 상세 내용

# Android XR 생태계와 OpenXR의 관계 정리

## 1) Android XR은 별도 OS인가
완전히 별도 운영체제라기보다 Android를 기반으로 XR 기능을 확장한 환경에 가깝다.

핵심은 다음과 같다.

- 앱 실행 모델은 Android 앱 모델을 따른다.
- 권한, 패키징, manifest 선언, lifecycle 제어를 Android가 맡는다.
- 그래픽 출력은 Android의 디스플레이 스택 영향을 받는다.
- 센서, 카메라, 입력 장치 접근도 Android 시스템 계층과 연결된다.

그래서 Android XR 앱을 이해할 때는 "헤드셋용 새 OS"로 보기보다 "Android 위에 XR 특화 런타임과 서비스가 추가된 구조"로 보는 편이 정확하다.

---

## 2) OpenXR은 여기서 어떤 역할을 하나
OpenXR은 XR 앱이 다양한 기기에서 공통된 API로 동작하도록 만드는 표준이다.

구조를 단순화하면 다음과 같다.

```text
XR App
  ↓
OpenXR Loader
  ↓
OpenXR Runtime
  ↓
Android graphics / input / sensor / display stack
```

여기서 의미는 다음과 같다.

- **XR App**: Unity, Unreal, Native 앱 등 실제 애플리케이션
- **OpenXR Loader**: 앱 호출을 현재 활성 runtime으로 연결하는 중간 계층
- **OpenXR Runtime**: 실제 추적, 세션, swapchain, 입력, compositor 협력을 구현한 벤더 측 라이브러리
- **Android 스택**: 그래픽, 입력, 센서, 디스플레이, 권한, 프로세스 관리 기반

즉 OpenXR은 "표준화된 입구"이고, Android는 "실제 운영체제 기반"이다.

---

## 3) HAL은 정확히 뭔가
HAL은 **Hardware Abstraction Layer**의 약자다.

뜻은 말 그대로 **하드웨어 추상화 계층**이다.

여기서 중요한 점은 HAL이 단순히 커널 드라이버랑 같은 것이 아니라, Android 프레임워크와 시스템 서비스가 하드웨어를 통일된 방식으로 다루게 해주는 인터페이스 층이라는 점이다.

자이로스코프 예시로 보면:

1. 자이로 센서 칩이 각속도 값을 생성한다.
2. Linux kernel 드라이버가 센서 데이터를 읽는다.
3. sensor HAL이 이 데이터를 Android가 다루기 쉬운 형태로 노출한다.
4. SensorService, XR runtime, 앱이 이 값을 사용한다.

즉 "Linux kernel 위에 HAL이 있다"는 말은 물리적 층을 거칠게 단순화한 표현이고, 정확히는 **커널 드라이버와 Android 시스템 서비스 사이를 이어주는 Android 전용 하드웨어 인터페이스 계층**이라는 뜻이다.

XR에서 HAL이 걸리는 대상은 보통 이런 것들이다.

- IMU 센서(자이로, 가속도계)
- 카메라
- 디스플레이
- 오디오
- 컨트롤러 입력
- 손 추적 관련 장치

---

## 4) AOSP는 무엇의 약자인가
AOSP는 **Android Open Source Project**의 약자다.

보통 의미는:

- Android의 공개된 기반 코드
- 제조사 커스텀 이전의 공통 플랫폼
- 프레임워크, 시스템 서비스, 일부 기본 앱, 빌드 시스템 등을 포함한 오픈소스 베이스

XR 관점에서는 "Android가 원래 어떤 시스템 구조로 움직이는가"를 이해할 때 AOSP 문서를 보면 된다.

---

## 5) IPC와 Binder IPC는 무엇인가
IPC는 **Inter Process Communication**의 약자다.

뜻은:
**서로 다른 프로세스끼리 데이터를 주고받는 방식**이다.

Android는 앱, 시스템 UI, 카메라 서비스, 센서 서비스, 디스플레이 서비스 등이 분리된 프로세스로 동작하는 경우가 많아서, 서로 직접 함수 호출을 할 수 없다. 그래서 요청과 응답을 주고받는 통로가 필요하다.

Android의 대표적인 IPC 메커니즘이 **Binder**다.

정리하면:

- **IPC**: 프로세스 간 통신이라는 일반 개념
- **Binder**: Android가 주로 쓰는 IPC 구현 방식

예를 들어 앱이 시스템에 이런 요청을 한다.

- 카메라 열기
- 센서 정보 받기
- 화면 레이어 생성 요청
- 오디오 출력 제어 요청

이런 통신이 Binder 기반으로 오가는 경우가 많다.

---

## 6) SurfaceFlinger는 무엇인가
SurfaceFlinger는 Android의 핵심 **화면 합성 시스템 서비스**다.

역할을 한 줄로 말하면:
**앱들이 만든 여러 화면 버퍼를 받아서 최종 디스플레이용 이미지로 합쳐 보내는 compositor**다.

예를 들어 스마트폰 화면에 동시에 보이는 것:

- 앱 본문
- 상태바
- 팝업
- 키보드
- 시스템 오버레이

이걸 한 장의 최종 화면으로 합치는 주체가 SurfaceFlinger다.

XR에서도 비슷하다.

- 왼쪽 눈용 이미지
- 오른쪽 눈용 이미지
- 시스템 오버레이
- passthrough나 보조 레이어

이런 것들이 최종 표시 타이밍과 결합될 때 compositor 계층이 중요해진다.

AOSP 설명 기준으로 SurfaceFlinger는 버퍼를 받아 합성하고 디스플레이로 보낸다. WindowManager는 윈도우 메타데이터와 레이어 관리를 돕고, SurfaceFlinger는 실제 합성을 수행한다.

---

## 7) Composition은 무엇인가
Composition은 여러 개의 레이어나 버퍼를 **최종 한 장의 화면으로 합치는 과정**이다.

예를 들어:

- 3D 장면
- UI
- 알림
- 커서
- 시스템 레이어

를 따로 만든 뒤 마지막에 하나로 합친다.

XR에서는 이게 더 민감하다. 왜냐하면 양안 렌더링, 오버레이, passthrough, 손 표시, 시스템 UI가 동시에 들어갈 수 있기 때문이다.

Composition이 느리면 생기는 문제:

- 프레임 지연 증가
- jank 발생
- 입력 반응 체감 악화
- XR 멀미 위험 증가

---

## 8) Foveation은 무엇인가
Foveation은 사람이 보는 중심 시야만 더 선명하게, 주변부는 상대적으로 덜 선명하게 렌더링해서 성능을 아끼는 기법이다.

이름은 눈의 중심 시야를 담당하는 **fovea**에서 왔다.

핵심 아이디어:

- 중심부는 고해상도 렌더링
- 주변부는 낮은 해상도 렌더링
- 체감 화질 손실을 줄이면서 GPU 비용을 절약

XR에서 중요한 이유:

- 양안 렌더링을 해야 함
- 해상도가 높음
- 주사율이 높아야 함
- 모바일 전력과 발열 제한이 큼

즉 "보이는 곳에 연산을 집중"해서 성능을 확보하는 전략이다.

시선 추적이 있으면 **eye tracked foveation**이 가능하다. 이 경우 사용자가 실제로 보고 있는 위치를 따라 고해상도 영역을 움직인다.

---

## 9) Reprojection은 무엇인가
Reprojection은 앱이 새 프레임을 제때 완전히 만들지 못했을 때, 이전 프레임을 현재 머리 자세에 맞게 다시 변형해서 지연을 줄이는 기술이다.

XR에서 중요성이 큰 이유는 머리를 돌렸을 때 화면이 늦게 반응하면 바로 위화감과 멀미로 이어지기 때문이다.

간단히 말하면:

- 원래는 앱이 매번 새 프레임을 만들어야 한다.
- 하지만 프레임이 늦으면 시스템이 기존 프레임을 재활용한다.
- 최신 head pose를 반영해 화면을 다시 보정한다.

장점:

- 체감 지연 완화
- 프레임 드랍 충격 감소
- 몰입감 유지 보조

한계:

- 진짜 새 프레임은 아니다.
- 장면 변화가 크면 왜곡이 드러날 수 있다.
- 근본 성능 문제를 숨겨줄 뿐 완전히 해결하지는 못한다.

---

## 10) Khronos loader는 무엇인가
여기서 Khronos는 **Khronos Group**을 뜻한다.

이 단체는 OpenGL, Vulkan, OpenXR 같은 공개 그래픽 및 XR 표준을 만드는 산업 컨소시엄이다.

OpenXR에서 loader는 앱과 runtime 사이의 연결 담당자다.

역할:

- 현재 활성 OpenXR runtime 찾기
- runtime 라이브러리 로드
- 함수 호출을 적절한 runtime으로 디스패치
- 필요하면 API layer를 중간에 끼워 넣기

즉 앱은 loader를 통해 "표준 OpenXR API"를 부르고, loader가 실제 구현체(runtime)에 연결해준다.

비유하면:

- 앱은 프런트 데스크에 요청하고
- loader는 담당 부서를 찾아 연결하고
- runtime이 실제 작업을 수행한다.

Khronos 문서 기준으로 loader는 application, API layer, runtime 사이의 실행 체인을 구성하는 핵심 계층이다.

---

## 11) Android XR에서 성능이 왜 이렇게 예민한가
모바일 XR은 다음 조건이 한꺼번에 걸린다.

- 고해상도
- 양안 렌더링
- 높은 주사율
- 센서 반응성 요구
- 배터리 기반
- 발열 제한

그래서 앱 성능 문제는 단순히 GPU 점유율 하나로 설명되지 않는다.

함께 봐야 할 것들:

- 앱의 렌더링 시간
- GPU 작업 완료 시간
- BufferQueue 적체 여부
- SurfaceFlinger composition 지연
- Display HAL 전달 지연
- 스케줄링과 thermal throttling

Perfetto의 FrameTimeline 계열 도구는 앱 프레임과 SurfaceFlinger 프레임이 예상 시간 안에 끝났는지 추적할 수 있게 해준다. XR 문제 분석에서 이런 계측은 매우 중요하다.

---

## 12) Android XR과 OpenXR의 관계를 한 번에 정리하면
다음 그림으로 보는 게 가장 쉽다.

```text
[물리 하드웨어]
센서 / 카메라 / 디스플레이 / 컨트롤러 / GPU
        ↓
[Linux kernel driver]
        ↓
[Android HAL]
        ↓
[Android system services]
SensorService / CameraService / SurfaceFlinger / WindowManager / Audio
        ↓
[OpenXR Runtime]
tracking / session / input / compositor cooperation / swapchain
        ↓
[OpenXR Loader]
runtime 연결 / API dispatch
        ↓
[XR App]
Unity / Unreal / Native
```

앱 개발자는 보통 OpenXR을 직접 보지만, 실제 성능과 동작은 그 아래 Android 시스템과 벤더 runtime의 영향을 크게 받는다.

---

## 13) 실무적으로 어떻게 받아들이면 좋나
실무에서 가장 유용한 관점은 다음이다.

1. **OpenXR은 공통 API다.**
   - 기기별 차이를 줄여준다.
   - 하지만 모든 차이를 없애주지는 않는다.

2. **Android는 실행 기반이다.**
   - manifest, permission, lifecycle, graphics stack을 관리한다.
   - XR 앱도 Android 앱 제약을 받는다.

3. **성능 문제는 레이어별로 나눠 봐야 한다.**
   - 앱 렌더링 문제인지
   - runtime/extension 문제인지
   - SurfaceFlinger/compositor 문제인지
   - 드라이버/HAL 문제인지
   - thermal 문제인지

4. **최적화 키워드는 모바일 중심이다.**
   - foveation
   - reprojection
   - frame pacing
   - 권장 해상도 대응
   - 지연과 발열 관리

---

## 14) 한 줄 결론
Android XR은 Android 운영체제의 그래픽·센서·권한·프로세스 구조 위에서 돌아가는 XR 환경이고, OpenXR은 그 위의 XR 기능을 표준 API로 제공하는 계층이다. 두 개는 대체 관계가 아니라 상하 관계다.

---

## 참고한 자료
- Android Developers: Android XR OpenXR overview, get started, supported extensions
- Android Open Source Project: graphics architecture, SurfaceFlinger and WindowManager
- Khronos OpenXR Loader specification
- Perfetto FrameTimeline documentation
