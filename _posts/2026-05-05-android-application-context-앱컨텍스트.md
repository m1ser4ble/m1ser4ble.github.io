---
layout: single
title: "Android Application Context (앱 컨텍스트) 완전가이드"
date: 2026-05-05 23:01:00 +09:00
categories: frontend
excerpt: "Android Application Context는 프로세스 전역 자원·assets·서비스 접근의 기준점이며, Activity 수명주기와 분리된 안정적 실행 컨텍스트다."
toc: true
toc_sticky: true
tags: [android, context, application, lifecycle, assets]
source: "/home/dwkim/dwkim/docs/mobile/android-application-context-앱컨텍스트.md"
---

TL;DR
- Application Context는 테마가 필요한 UI 컨텍스트와 달리 프로세스 전역 자산, 서비스, 파일 시스템 접근의 안정된 기준점이다.
- 라이브러리가 AssetManager나 system service를 필요로 할 때 Context를 누락하면 초기화가 조용히 실패하거나 런타임에서만 터지는 경우가 많다.
- Unity·JNI·background service 같은 브리지 경계에서는 `currentActivity`에서 `applicationContext`를 전달하는 습관이 중요하다.

## 1. 개념
Android Application Context는 Activity와 분리된 프로세스 단위 컨텍스트로, assets·system service·파일 경로·앱 전역 상태 접근의 공통 기반을 제공한다.

## 2. 배경
Android 앱이 점점 더 많은 온디바이스 모델, 백그라운드 서비스, 라이브러리 초기화를 다루면서 단순히 `this`를 넘기는 식의 컨텍스트 사용이 자주 문제를 만든다. 특히 Unity나 네이티브 브리지처럼 생명주기 경계가 많은 환경에서는 어떤 Context가 필요한지 더 명확해야 한다.

## 3. 이유
이 개념을 정확히 알아야 메모리 누수, asset 로드 실패, 서비스 초기화 오류를 같은 축에서 설명할 수 있다. `Activity`, `Service`, `Application`이 모두 Context이지만 수명주기와 책임이 다르기 때문에, 잘못 고르면 디버깅이 매우 어려워진다.

## 4. 특징
- Application Context는 프로세스와 함께 살아남아 장기 보관 참조에 비교적 안전하다
- UI 테마·윈도우 토큰이 필요한 작업에는 Activity Context가 여전히 필요하다
- AssetManager, ONNX/VAD 모델 로드, WorkManager 초기화처럼 앱 전역 자원 접근에는 Application Context가 적합하다
- static field에 Activity Context를 저장하면 메모리 누수로 이어지기 쉽다

## 5. 상세 내용

# Android Application Context (앱 컨텍스트) 완전가이드

> **작성일**: 2026-05-05
> **카테고리**: Mobile / Android / Framework / Lifecycle
> **트리거**: cooking-assistant repo 2026-05-05 사건 — `android-vad 2.0.10`이 패키징된 Silero ONNX 모델을 못 읽어 `vad == null`로 죽고, AudioRecord가 캡처한 모든 프레임이 조용히 드롭된 사건. 근본 원인은 Unity → Android 브릿지가 Context를 넘기지 않아 `Vad.builder().setContext(...)` 호출 자체가 불가능했던 것.
> **포함 내용**: Context, ContextWrapper, ContextThemeWrapper, ContextImpl, Application, Activity, Service, base context, attachBaseContext, getApplicationContext() vs `this`, getBaseContext(), createPackageContext, createConfigurationContext, createDeviceProtectedStorageContext, createWindowContext, createContextForSplit, AssetManager, Resources, Configuration, Theme, AppOps, ContextCompat, AppCompat ContextThemeWrapper, AOSP `frameworks/base/core/java/android/content/Context.java`, ContextImpl, ActivityThread, LoadedApk, Diane Hackborn 설계 철학, Zygote 단일 Application, 프로세스당 1개 Application, UID 샌드박스, multi-display/multi-window context (API 30+), FBE Direct Boot context, ContentProvider 자동 초기화 트릭, FirebaseInitProvider, WorkManagerInitializer, AndroidX App Startup, Hilt @ApplicationContext, Glide GlideContext, ML Kit, TensorFlow Lite Interpreter + AssetManager, ONNX Runtime Mobile + assets, android-vad 2.0.10 setContext, sherpa-onnx newFromAssets vs newFromFile, Unity UnityPlayer.currentActivity → applicationContext, Memory leak 안티패턴, WeakReference<Activity>, static field anti-pattern, LeakCanary, cooking-assistant 5월 5일 사건 분석

---

# 1. 발생 사례 — cooking-assistant 2026-05-05

## 1.1 사건 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│      cooking-assistant Android VAD 침묵 사건 (2026-05-05)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  T-N    e8047cd  feat(voice): enable local stt validation       │
│         └─ sherpa-onnx + SenseVoice 통합                         │
│         └─ AudioCaptureService.java 신설                         │
│         └─ android-vad 2.0.10 종속성 추가                        │
│                                                                  │
│  T-N+1  관찰: STT가 절대 텍스트를 뱉지 않음                      │
│         └─ logcat: "AudioRecord state=INITIALIZED"               │
│         └─ logcat: ... 그 외에 어떤 진단도 없음                  │
│         └─ Azure SDK 버전에선 동작했었음 → 회귀 의심              │
│                                                                  │
│  T-N+?  분석:                                                    │
│         └─ 마이크 권한 OK                                        │
│         └─ AudioRecord.read() 정상 (frame 단위로 채움)           │
│         └─ vad.isSpeech(frame) 호출하는 곳에서 NPE를 던지지 않고  │
│            그냥 vad == null이라 처리 자체를 안 함                 │
│         └─ 왜 vad == null?  → Vad.builder()...build()가          │
│            try/catch로 감싼 try 블록 안에서 던졌고                │
│            catch는 sendError()만 호출하고 vad 필드는 그대로       │
│            null로 남겨둠                                          │
│                                                                  │
│  T-N+2  근본 원인 발견:                                          │
│         └─ Vad.builder().setContext(null).build()                │
│         └─ Silero VAD는 ONNX Runtime Mobile로                    │
│            assets/silero_vad.onnx를 읽어야 하고                  │
│            그건 context.getAssets().open()이 필요                 │
│         └─ Context가 null이라 setContext가 NPE / IAE를 던짐       │
│         └─ 그런데 Unity 측에서 Java 브릿지를 만들 때              │
│            initialize(...)에 Context를 아예 안 넘겼음             │
│                                                                  │
│  T0     6b31096  fix(android): initialize voice activity        │
│                  detection                                        │
│         └─ initialize(Context, ...) 시그니처 수정                │
│         └─ Unity currentActivity → getApplicationContext()       │
│         └─ Vad.builder().setContext(appContext)...build()        │
│         └─ context == null이면 IllegalArgumentException으로       │
│            소리 내서 죽게 만듦 (silent failure 회피)              │
│         └─ AudioRecord state, read 실패, 캡처 peak,              │
│            VAD 전이, STT handoff에 sparse 진단 로그 추가          │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 정확한 패치

```java
// AudioCaptureService.java (after fix, 6b31096)
public void initialize(Context context, SpeakerVerifier verifier, SpeechRecognizerService stt,
                       float speakerThreshold, float vadThreshold) {
    this.speakerVerifier = verifier;
    this.sttService = stt;
    this.speakerThreshold = speakerThreshold;
    this.vadThreshold = vadThreshold;

    ringBuffer = new short[RING_BUFFER_SIZE];
    voicedBuffer = new short[MAX_VOICED_SAMPLES];

    try {
        Context appContext = context != null ? context.getApplicationContext() : null;
        if (appContext == null) {
            throw new IllegalArgumentException("Android context is required for Silero VAD");
        }

        vad = Vad.builder()
            .setContext(appContext)
            .setSampleRate(SampleRate.SAMPLE_RATE_16K)
            .setFrameSize(FrameSize.FRAME_SIZE_512)
            .setMode(Mode.NORMAL)
            .setSilenceDurationMs(300)
            .setSpeechDurationMs(50)
            .build();
    } catch (Exception e) {
        Log.e(TAG, "Failed to initialize Silero VAD", e);
        sendError("VAD initialization failed: " + e.getMessage());
    }

    Log.i(TAG, "AudioCaptureService initialized (vadReady=" + (vad != null)
        + ", vadThreshold=" + vadThreshold + ")");
}
```

Unity C# 측 호출 (`AndroidVoicePipeline.cs`):

```csharp
// 패치된 호출부
using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
using (var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity"))
{
    audioCapture = new AndroidJavaObject("com.cookingassistant.voice.AudioCaptureService");
    audioCapture.Call("initialize",
        activity,                 // ← 이게 핵심: Activity가 곧 Context (ContextWrapper)
        speakerVerifier,
        sttService,
        speakerThreshold,
        vadThreshold);
}
```

## 1.3 결정적 깨달음

```
┌─────────────────────────────────────────────────────────────────┐
│         이 사건의 한 줄 요약                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "써드파티 라이브러리가 자기 AAR 안에 ML 모델 자산을              │
│    번들했다면, 그 모델은 오직 context.getAssets()를 통해서만      │
│    도달할 수 있다. 따라서 그 라이브러리는 무조건 Context를        │
│    요구한다. Context를 안 넘기면 모델 로드가 침묵 속에 실패하고,  │
│    상위 코드는 '왜 결과가 없지'를 영원히 추적하게 된다."          │
│                                                                  │
│  관련 사건:                                                      │
│   - 2026-05-02 sherpa-onnx tokens.txt 누락                       │
│     → ai/sherpa-onnx-온디바이스-asr.md                           │
│   - 2026-05-02 Git LFS 도입                                      │
│     → devtools/git-lfs-대용량바이너리.md                         │
│                                                                  │
│  세 사건 모두 "온디바이스 ML을 모바일에 패키징할 때                │
│   놓치기 쉬운 기초"라는 공통 주제.                                │
└─────────────────────────────────────────────────────────────────┘
```

이 문서는 **Android Context란 무엇이고**, **왜 ML/ONNX/native asset을 패키징한 라이브러리가 그걸 강제로 요구할 수밖에 없는지**, 그리고 **어떤 Context를 어디서 써야 누수와 silent failure를 피할 수 있는지**를 다룬다. cooking-assistant Unity → Java 브릿지의 패턴이 이 문서의 사례 기준선이다.

---

# 2. 용어 사전 (Terminology Dictionary)

## 2.1 핵심 클래스 계보

| 용어 | 풀 네임 / 어원 | 의미 |
|------|---------------|------|
| **Context** | "맥락, 환경" — 라틴어 *contextus* "엮인 것" | 추상 클래스. 앱이 시스템 리소스, 자산, 권한, 서비스에 접근하기 위한 단일 진입점 |
| **ContextWrapper** | wrapper = "감싸개" | Context 추상 메서드를 모두 base context에 위임하는 데코레이터. 거의 모든 다른 Context 서브클래스가 이걸 상속 |
| **ContextThemeWrapper** | + Theme | Activity처럼 Theme/Style을 가져야 하는 Context. AppCompatActivity가 이걸 상속 |
| **ContextImpl** | Implementation | 모든 Context 추상 메서드의 실제 구현체. 패키지 private — 직접 인스턴스 생성 불가, 시스템만 만듦 |
| **Application** | — | ContextWrapper 상속. **프로세스당 정확히 1개**. `Application.onCreate()`가 첫 진입점 |
| **Activity** | "활동" — UI 화면 1개를 의미 | ContextThemeWrapper 상속. 화면 단위 라이프사이클 |
| **Service** | — | ContextWrapper 상속. 백그라운드 컴포넌트 |
| **ContentProvider** | — | Context 상속 안 함 — `getContext()`로 자기에게 주어진 Context를 받음 |
| **BroadcastReceiver** | — | `onReceive(Context, Intent)`로 Context를 매번 받아 사용 |

## 2.2 Context 획득 메서드

| 메서드 | 호출 위치 | 반환 |
|--------|----------|------|
| `this` (Activity 안에서) | Activity 내부 | 현재 Activity (= Context) |
| `getApplicationContext()` | 어디서든 | 프로세스 단일 Application 객체 |
| `getBaseContext()` | ContextWrapper 안에서 | wrapper가 위임하는 base (보통 ContextImpl) |
| `Activity.getApplication()` | Activity | Application 객체 (캐스팅 불필요) |
| `View.getContext()` | View | View가 부착된 Context (보통 Activity) |
| `Fragment.requireContext()` | Fragment (attached) | host Activity |
| `ContentProvider.getContext()` | ContentProvider | 시스템이 주입한 Context (Application과 사실상 동일) |
| `BroadcastReceiver onReceive(Context c, Intent)` | BroadcastReceiver | 호출자가 넘겨준 Context (수명 짧음, 저장 금지) |
| `ContextCompat.getXxx(context, ...)` | androidx.core.content | API 레벨 호환 래퍼 (color, drawable, system service) |

## 2.3 특수 Context 팩토리

| 메서드 | API | 용도 |
|--------|-----|------|
| `createPackageContext(name, flags)` | 1 | 다른 패키지의 리소스/코드 접근 (drm, shared lib) |
| `createConfigurationContext(Configuration)` | 17 | 다른 locale/density 컨텍스트 (런타임 언어 변경 트릭) |
| `createDeviceProtectedStorageContext()` | 24 (N) | FBE의 Device Encrypted (DE) 스토리지 접근 — Direct Boot 모드용 |
| `createCredentialProtectedStorageContext()` | 24 (N, hidden) | CE 스토리지 접근 (보통 기본 Context가 이걸 가리킴) |
| `createContextForSplit(splitName)` | 26 (O) | Dynamic feature module의 코드/리소스 접근 |
| `createWindowContext(displayId, type, options)` | 30 (R) | Activity 없이 윈도우(System Alert, Overlay) 생성 |
| `createDisplayContext(Display)` | 17 / 30+ 강화 | 보조 디스플레이용 — Configuration이 그 디스플레이 기준 |

## 2.4 자산/리소스 관련

| 용어 | 풀이 |
|------|-----|
| **AssetManager** | `assets/` 디렉토리의 raw 파일 InputStream을 제공. `Context.getAssets()` 반환 |
| **Resources** | `res/` 디렉토리의 컴파일된 리소스 (string, drawable, layout). `Context.getResources()` |
| **Configuration** | locale, density, orientation, fontScale, screen size 등을 담은 객체 — Resources가 이걸 기준으로 동작 |
| **Theme** | 스타일 속성 모음. ContextThemeWrapper가 보유 |
| **LoadedApk** | 한 APK가 메모리에 로드된 상태를 표현 — Resources/AssetManager의 owner |
| **ActivityThread** | 앱 프로세스의 메인 스레드 진입점. `main()` → ContextImpl/Application 생성 |

## 2.5 ContentProvider 자동 초기화 패턴

| 용어 | 풀이 |
|------|-----|
| **FirebaseInitProvider** | `firebase-common` AAR이 등록한 무력 ContentProvider — Firebase의 Context 캡처 수단 |
| **WorkManagerInitializer** | `androidx.work.impl.WorkManagerInitializer` — ContentProvider 자동 init |
| **InitializationProvider** | `androidx.startup` 라이브러리가 모든 라이브러리의 init을 통합한 단일 ContentProvider |
| **Initializer<T>** | App Startup의 단위 인터페이스 — `create(Context)` + `dependencies()` |
| **Manifest merger** | AAR의 Manifest 항목이 host APK Manifest로 병합되는 빌드 단계 |

---

# 3. 한 줄 정의와 핵심 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                Android Context 한 줄 정의                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "한 앱(=한 UID 샌드박스)이 OS 리소스/자산/권한/시스템 서비스에   │
│   접근하기 위한 단일 진입점 객체."                                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           Context (abstract)                               │  │
│  │   getAssets()         → AssetManager                       │  │
│  │   getResources()      → Resources                          │  │
│  │   getPackageName()    → "com.cookingassistant"             │  │
│  │   getSystemService()  → ActivityManager 등                  │  │
│  │   startActivity()     → Intent 발사                         │  │
│  │   bindService()       → Service 연결                        │  │
│  │   getFilesDir()       → 앱 전용 파일 디렉토리                │  │
│  │   getApplicationContext()                                   │  │
│  │   ...                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ▲                                     │
│            ┌───────────────┴────────────────┐                   │
│            │                                 │                   │
│      ContextWrapper                  ContextImpl                 │
│       (delegate)                    (실구현, hidden)              │
│            ▲                                                     │
│   ┌────────┼─────────┬─────────┐                                │
│   │        │         │         │                                │
│ Application Service  ContextThemeWrapper                         │
│                              ▲                                   │
│                              │                                   │
│                          Activity                                │
└─────────────────────────────────────────────────────────────────┘
```

## 3.1 왜 "Context"가 필요한가 — 정적 전역의 거부

다른 GUI 환경(Win32, Cocoa, GTK)에서는 보통 다음 중 하나를 쓴다:

```
A. 진정한 전역 (전역 변수/싱글턴)
   - HINSTANCE GetModuleHandle(NULL);
   - [NSBundle mainBundle];

B. 함수 인자로 명시
   - GtkWidget* widget = ...; gtk_widget_get_parent(widget);
```

Android는 의도적으로 **B를 강제**한다. 그 이유:

```
┌─────────────────────────────────────────────────────────────────┐
│  왜 정적 전역(Globals)으로는 안 됐나                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 멀티 사용자 / 멀티 프로파일 (API 17+)                        │
│     같은 APK가 user 0, user 10에서 동시에 실행 → 별도 데이터/    │
│     별도 Context. 정적 전역은 이걸 표현 못 함.                   │
│                                                                  │
│  2. 보조 디스플레이 / 멀티 윈도우                                 │
│     같은 Activity가 다른 density/orientation에서 떠야 함.        │
│     Configuration이 다른 여러 Context가 한 프로세스에 공존.      │
│                                                                  │
│  3. 패키지 격리                                                  │
│     같은 프로세스가 createPackageContext()로 다른 APK의          │
│     리소스를 잠시 빌릴 수 있어야 함 (예: WebView, drm).          │
│                                                                  │
│  4. UID 권한 검사                                                │
│     모든 시스템 호출이 caller UID를 검사 (Binder가 자동 첨부).    │
│     Context가 그 UID 정보를 들고 있어야 검사 일관성 유지.        │
│                                                                  │
│  5. 라이프사이클 정확성                                           │
│     Activity Context는 Activity와 함께 죽어야 함.                │
│     전역 싱글턴에 Activity를 박으면 영원히 안 죽음 (leak).       │
│                                                                  │
│  6. 테스트 가능성                                                │
│     ContextImpl을 mock으로 갈아끼울 수 있음                      │
│     (Robolectric, MockContext)                                   │
└─────────────────────────────────────────────────────────────────┘
```

Diane Hackborn(Android 초기 코어 엔지니어)이 자주 하던 표현 — **"Android는 application framework가 아니라 system framework다"**. 즉 앱이 시스템 안에서 살게 만드는 게 목표였고, 시스템과 앱 사이의 모든 다리가 Context 한 객체로 압축됐다.

---

# 4. 클래스 계층과 ContextImpl 실체

## 4.1 상속 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                  Android Context Class Hierarchy                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   java.lang.Object                                              │
│        ▲                                                         │
│   android.content.Context  (abstract — 30+ 메서드 추상)          │
│        ▲                                                         │
│        ├─────────────────────────┬───────────────────┐          │
│        │                         │                   │          │
│   ContextWrapper             ContextImpl (hidden)     MockContext │
│   (delegate to base)         (실제 모든 동작)         (테스트용)   │
│        ▲                                                         │
│        │                                                         │
│        ├──── Application                                         │
│        │                                                         │
│        ├──── Service                                             │
│        │         ▲                                               │
│        │         └── IntentService (deprecated)                  │
│        │                                                         │
│        ├──── ContextThemeWrapper                                 │
│        │         ▲                                               │
│        │         └── Activity                                    │
│        │              ▲                                          │
│        │              └── AppCompatActivity                      │
│        │                   ▲                                     │
│        │                   ├── FragmentActivity                  │
│        │                   └── ComponentActivity                 │
│        │                                                         │
│        └──── (커스텀 wrapper들 — DI library, locale wrapper)     │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 ContextWrapper의 정수

`android/content/ContextWrapper.java` 핵심:

```java
public class ContextWrapper extends Context {
    Context mBase;

    public ContextWrapper(Context base) {
        mBase = base;
    }

    protected void attachBaseContext(Context base) {
        if (mBase != null) {
            throw new IllegalStateException("Base context already set");
        }
        mBase = base;
    }

    @Override public AssetManager getAssets() { return mBase.getAssets(); }
    @Override public Resources   getResources() { return mBase.getResources(); }
    @Override public PackageManager getPackageManager() { return mBase.getPackageManager(); }
    @Override public Object getSystemService(String name) { return mBase.getSystemService(name); }
    // ... 모든 추상 메서드를 mBase에 위임
}
```

**핵심 패턴**: Application/Activity/Service는 **빈 껍데기**다. 실제 동작은 모두 `mBase` (ContextImpl)에서 일어난다. 시스템(`ActivityThread`)이 컴포넌트를 생성한 직후 `attachBaseContext(impl)`를 호출해 base를 꽂아준다. 그 전에 Activity 메서드(예: `getResources()`)를 호출하면 NPE — 그래서 `Application.onCreate()` 이전에 Context를 쓰면 위험하다.

## 4.3 ContextImpl이 실제 가진 것

```
ContextImpl 인스턴스가 들고 있는 핵심 필드:
┌──────────────────────────────────────────────────────┐
│  mPackageInfo  : LoadedApk     ← APK 로드 상태       │
│  mResources    : Resources     ← Configuration 적용  │
│  mOpPackageName: String        ← AppOps 권한 검사용  │
│  mUser         : UserHandle    ← 멀티 사용자 식별    │
│  mClassLoader  : ClassLoader   ← 동적 로딩용         │
│  mActivityToken: IBinder       ← Activity Context인가│
│  mDisplay      : Display       ← 어느 디스플레이인가 │
│  mFlags        : int           ← FBE/Split 등 플래그 │
└──────────────────────────────────────────────────────┘

Resources 안에는 다시 AssetManager가 들어있다:
  Resources → impl → ResourcesImpl.mAssets : AssetManager
```

`context.getAssets()`는 `getResources().getAssets()`와 동치 — 같은 AssetManager 인스턴스를 가리킨다. **AssetManager는 Configuration(특히 locale)에 묶여 있다**. 그래서 Activity의 Configuration이 변하면(회전, locale 변경) Resources/AssetManager가 새로 만들어진다.

## 4.4 ContextWrapper.attachBaseContext

가장 자주 오버라이드되는 라이프사이클 훅:

```java
public class CookingApp extends Application {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);            // 65k 메서드 초과 시
        // 여기선 onCreate()보다 더 일찍 실행됨
    }

    @Override
    public void onCreate() {
        super.onCreate();
        // Application 단위 초기화
    }
}
```

`attachBaseContext` 시점은 ContentProvider보다도 빠르다 — 실질적으로 Application 객체가 살아있는 첫 시점.

---

# 5. 등장 배경 — Android 1.0의 설계 결정

## 5.1 2007년 Android 팀이 마주한 제약

```
┌─────────────────────────────────────────────────────────────────┐
│        왜 Android는 Context 추상화를 채택했나                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  제약 1. 한 프로세스 = 한 사용자(UID)                             │
│    → Linux UID 샌드박스 활용                                     │
│    → 시스템 호출마다 caller UID 검사 필요                         │
│    → 그 UID 정보를 매개할 객체 필요                               │
│                                                                  │
│  제약 2. Zygote fork() 모델                                      │
│    → 모든 앱은 Zygote의 fork 자손                                 │
│    → 코어 라이브러리/리소스가 미리 로드된 상태로 시작            │
│    → 앱별 LoadedApk 인스턴스가 fork 후에 attach                  │
│    → 앱별 Context는 동적으로 생성될 수밖에 없음                   │
│                                                                  │
│  제약 3. 컴포넌트 모델 (Activity/Service/Receiver/Provider)      │
│    → 각 컴포넌트는 독립적으로 생성/파괴됨                        │
│    → 하지만 같은 프로세스 + 같은 APK 자원 공유                   │
│    → "공통 부모"로서 Application Context 필요                    │
│                                                                  │
│  제약 4. Resources의 Configuration 의존성                         │
│    → 같은 string ID라도 locale에 따라 다른 텍스트                 │
│    → 같은 drawable ID라도 density에 따라 다른 이미지              │
│    → Resources는 정적일 수 없음 → Context가 들고 있어야 함        │
│                                                                  │
│  제약 5. 시스템 서비스의 Binder 호출                              │
│    → 모든 시스템 서비스는 별도 프로세스 (system_server)           │
│    → Binder 호출 시 caller 식별 필요                              │
│    → Context가 IBinder token을 들고 있어 자동 첨부               │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Be Inc. → Palm → Google 가계도

Diane Hackborn은 Be Inc.에서 BeOS의 BApplication/BWindow를 설계했고, Palm으로 옮겨 OpenBinder + Cobalt OS의 컴포넌트 시스템을 만들었다. 2005년 Google이 Android를 인수하며 그를 영입했고, 그가 Android Context + Binder + Activity 모델의 결정적 설계자가 됐다 ([android-os-시스템특성.md](android-os-시스템특성.md) §2의 Binder 항목 참조).

Context의 설계 사상은 그래서 **OpenBinder의 IInterface + IBinder 자동 매개** 패턴의 자바 친화적 버전 — 모든 IPC가 Context를 거쳐 자동으로 권한 컨텍스트가 주입된다.

---

# 6. 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│                Context API 진화 압축 연표                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2008.09  API 1   Context, ContextWrapper, ContextImpl 도입      │
│                   getAssets/getResources/getSystemService         │
│                   Application/Activity/Service 모두 ContextWrapper│
│                                                                  │
│  2009.04  API 3   getApplicationContext() 추가                   │
│                                                                  │
│  2010.05  API 8   createPackageContext flags 정리                │
│                                                                  │
│  2011.10  API 14  ICS — ContextThemeWrapper 정식화               │
│                   Fragment 도입 → host Activity Context 의존     │
│                                                                  │
│  2012.10  API 17  멀티 사용자 + UserHandle 도입                  │
│                   createConfigurationContext (Jelly Bean MR1)     │
│                   createDisplayContext (보조 디스플레이)         │
│                                                                  │
│  2013.05  -       Support Library에 ContextCompat 추가            │
│                   (API 16-22 호환 래퍼: getColor, getDrawable 등)│
│                                                                  │
│  2014.10  API 21  Lollipop — ART 기본화                          │
│                   AppCompatActivity 본격화 → ContextThemeWrapper │
│                                                                  │
│  2016.08  API 24  Nougat — FBE                                   │
│                   createDeviceProtectedStorageContext             │
│                   Direct Boot 시점 사용 가능 Context 신설         │
│                                                                  │
│  2017.08  API 26  Oreo — createContextForSplit                   │
│                   Dynamic feature module 코드/리소스 접근         │
│                                                                  │
│  2018.05  -       Jetpack/AndroidX 리네이밍 (support → androidx) │
│                                                                  │
│  2018.08  API 28  Pie — getSystemServiceName, isUiContext 준비   │
│                                                                  │
│  2020.09  API 30  R — createWindowContext(Display, type, options)│
│                   ContentObserver/ComponentCallbacks 라이프사이클 │
│                   isUiContext() 공식                              │
│                                                                  │
│  2021.10  API 31  S — Window context의 onConfigurationChanged    │
│                   propagation 수정                                │
│                                                                  │
│  2023.10  API 34  Foreground Service Type 의무화 → Context의      │
│                   startForegroundService 사용 시점에 영향         │
│                                                                  │
│  2024     -       Hilt + AndroidX Startup이 사실상의              │
│                   "Context 주입 표준" 확립                        │
└─────────────────────────────────────────────────────────────────┘
```

`createWindowContext`(API 30)의 의의는 크다. Activity 없이도 시스템 오버레이 윈도우(예: 통화 floating window, 음성 보조)를 띄울 수 있게 됐고, 그 윈도우용 Configuration이 별도로 잡힌다. Wear OS, Auto OS, XR 헤드셋의 멀티 디스플레이 시나리오에 결정적.

---

# 7. 어떤 Context를 어디서 써야 하는가

## 7.1 결정 매트릭스

| 사용처 | 권장 Context | 이유 |
|--------|-------------|------|
| `inflate(R.layout.xxx, parent)` | **Activity** | 인플레이션은 부모의 Theme/Style을 상속해야 함 |
| `Dialog` 생성 | **Activity** | Dialog는 그 Activity의 윈도우 위에 떠야 함 |
| `Toast.makeText(...)` | **Application** | Toast는 system overlay라 Activity 죽어도 살아 있어야 함 (실제로 Toast는 내부적으로 application context로 다시 가져감) |
| `WindowManager.addView(SystemAlertWindow)` | **createWindowContext** (API 30+) 또는 **Application** | UI 컨텍스트 필요 |
| `getString(R.string.xxx)` | 어느 것이든 | Resources는 Configuration만 잘 맞으면 됨 |
| `Glide.with(...)` | **Activity 또는 Fragment** | Glide가 라이프사이클에 따라 자동으로 일시정지/재개 |
| `Room.databaseBuilder(ctx, ...)` | **Application** | DB 핸들은 프로세스 단일 — 길게 살아야 함 |
| 싱글턴 매니저 (Repository, Analytics) | **Application** | Activity Context 박으면 leak |
| `BroadcastReceiver` 동적 등록 | **Application** | Activity와 별개로 살아야 할 수 있음 |
| Service에서 Notification 채널 등록 | **Application** | Service 라이프사이클과 무관 |
| `SharedPreferences` | 어느 것이든 (보통 Application) | 인스턴스가 캐시됨 |
| ML/ONNX/TFLite 모델 로드 (assets) | **Application** | 라이브러리가 객체를 들고 있다면 leak 회피 |
| `LayoutInflater.from(ctx)` | **Activity** | Theme 적용 |
| 커스텀 View 생성자 | **인자로 받은 Context (보통 Activity)** | View가 부착될 화면의 Context를 그대로 |
| Binding service | **Application** (Service가 길면) | Activity Context는 Activity와 죽음 |
| `getCacheDir()` / `getFilesDir()` | 어느 것이든 (보통 Application) | 같은 디렉토리 |

## 7.2 한 줄 규칙

```
┌─────────────────────────────────────────────────────────────────┐
│        "헷갈리면 Application context를 써라.                      │
│         단, Theme/UI/Window가 필요하면 Activity context."         │
└─────────────────────────────────────────────────────────────────┘
```

이 규칙의 변형:
- "객체가 그 Context보다 오래 살 가능성이 있으면 → Application"
- "그 객체가 화면에 무엇을 그리거나 띄우면 → Activity (또는 createWindowContext)"

## 7.3 cooking-assistant의 선택

```java
Context appContext = context != null ? context.getApplicationContext() : null;
```

이 한 줄이 정답인 이유:
- `AudioCaptureService`는 마이크 캡처를 시작하면 Activity 라이프사이클과 무관하게 **계속 살아 있어야 함** (사용자가 다른 화면으로 가도 음성 명령은 받아야 함)
- `vad` 필드는 `AudioCaptureService` 안에 강하게 참조됨
- 만약 Activity Context를 그대로 박았다면, AudioCaptureService(내부 thread + ring buffer + VAD)가 살아 있는 한 그 Activity가 GC되지 않음 → **Activity leak**
- `getApplicationContext()`로 변환함으로써 Activity는 자유롭게 죽고 살 수 있음

---

# 8. 핵심 트러블 분석 — 왜 ML/ONNX 라이브러리가 Context를 강제로 요구하는가

## 8.1 도달 경로 분석

```
┌─────────────────────────────────────────────────────────────────┐
│        Silero VAD 모델 파일에 도달하려면                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  android-vad 2.0.10 AAR 내부 구조                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  silero-2.0.10.aar                                         │  │
│  │  ├── classes.jar          ← Vad, VadSilero, builder       │  │
│  │  ├── AndroidManifest.xml  ← 빈 Manifest (Provider 등록 X)  │  │
│  │  ├── assets/                                               │  │
│  │  │   └── silero_vad.onnx  ← ★ 이게 모델 (≈1.8MB)          │  │
│  │  ├── libs/                                                 │  │
│  │  │   └── onnxruntime-mobile.aar (간접 의존)                │  │
│  │  └── R.txt                                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  빌드 시 manifest merger:                                         │
│  AAR의 assets/silero_vad.onnx → APK의 assets/silero_vad.onnx     │
│                                                                  │
│  런타임에 silero_vad.onnx에 도달하는 유일한 경로:                 │
│                                                                  │
│   context.getAssets().open("silero_vad.onnx")                    │
│       │                                                           │
│       ▼                                                           │
│   AssetManager (Context가 들고 있는 인스턴스)                     │
│       │                                                           │
│       ▼                                                           │
│   ResourcesImpl.mAssets                                          │
│       │                                                           │
│       ▼                                                           │
│   LoadedApk가 들고 있는 ApkAssets[] (앱 APK + AAR 자산 모두 포함)│
│       │                                                           │
│       ▼                                                           │
│   APK 내부 zip entry "assets/silero_vad.onnx"                     │
│       │                                                           │
│       ▼                                                           │
│   InputStream → ONNX Runtime Session(modelBytes)                  │
│                                                                  │
│  ★ Context 없으면 AssetManager 못 잡음 → 모델 로드 불가능 ★      │
└─────────────────────────────────────────────────────────────────┘
```

## 8.2 왜 라이브러리가 caller에게 모델 bytes를 받지 않는가

이론적 대안:

```java
// 대안 A — caller가 모델 bytes를 직접 넘김
byte[] sileroBytes = readFromSomewhere();
VadSilero vad = Vad.builder()
    .setModelBytes(sileroBytes)        // 가상의 API
    .setSampleRate(...)
    .build();
```

이게 `android-vad 1.x` 시절의 패턴이었다. 그런데 2.x에서 **`setContext(Context)` 강제**로 바뀌었다. 이유:

```
1. 사용자 실수 회피
   - 1.x에선 caller가 매번 silero_vad.onnx 경로/bytes를 정확히
     맞춰야 했음. 잘못된 모델 파일 넘기는 사고 빈발.
   - 2.x에선 라이브러리가 자기 모델을 자기가 책임지고 로드.

2. 모델 버전 동기화
   - 라이브러리 업데이트 시 모델도 자동 업데이트 — caller 코드
     수정 불필요.

3. 메모리 관리
   - Context 위임으로 ResourceManager 재사용 가능
   - 매번 byte[] 만들어 넘기지 않아도 됨.

4. 16 KB page size 호환 (2.0.10 핵심 변경)
   - Android 15+에서 강제되는 16KB native page size를 위해
     ONNX 모델도 정렬 필요 — 라이브러리가 통제해야 보장 가능.

5. 보안
   - Caller가 외부 모델을 끼워넣을 가능성 차단
   - 라이브러리 서명된 자산만 사용 보장
```

**결과**: 2.x 이후 caller는 **무조건 Context를 줘야 한다**. 이 사실을 모르면 (cooking-assistant 사례처럼) silent failure로 이어진다.

## 8.3 같은 패턴의 다른 라이브러리들

| 라이브러리 | Context 요구 이유 | API 형태 |
|-----------|------------------|---------|
| **android-vad (Silero/Yamnet)** | assets/*.onnx 로드 | `Vad.builder().setContext(ctx).build()` |
| **TensorFlow Lite (assets에서)** | `loadModelFile(activity, "model.tflite")` | `MappedByteBuffer model = loadModelFile(activity, ...)` |
| **ML Kit (on-device)** | 모델 자동 다운로드 + 캐시 | ContentProvider 자동 init으로 Context 캡처 |
| **sherpa-onnx (newFromAssets)** | APK assets에서 모델 로드 | `OfflineRecognizer.newFromAssets(assetManager, config)` |
| **Glide** | 라이프사이클 + 디스크 캐시 | `Glide.with(activity)` |
| **Room** | DB 파일 경로 = `getDatabasePath()` | `Room.databaseBuilder(ctx, ...)` |
| **Firebase** | google-services.json 리소스 + Network state | FirebaseInitProvider 자동 init |
| **WorkManager** | 알람/JobScheduler 등록 + DB | WorkManagerInitializer 자동 init |
| **LeakCanary** | Activity/Fragment 라이프사이클 콜백 등록 | ContentProvider 자동 init |

**규칙성**: 자기 자산을 자기가 들고 있거나, 시스템 서비스를 등록해야 하면 Context 필요. 단, **사용자가 명시적으로 안 넘겨도 되게 만든 라이브러리들은 ContentProvider 자동 init 트릭을 쓴다** (§9 참조).

## 8.4 sherpa-onnx와의 비교

[ai/sherpa-onnx-온디바이스-asr.md](../ai/sherpa-onnx-온디바이스-asr.md) §4.3에서 본 패턴:

```java
// 방식 1: 파일시스템 경로 (Context 불필요)
OfflineRecognizer recognizer = OfflineRecognizer.newFromFile(config);
//                                              ^^^^^^^^^^^^
//   config.modelConfig.senseVoice.model = "/data/data/com.../files/model.onnx"

// 방식 2: AssetManager 경유 (Context 필요)
OfflineRecognizer recognizer = OfflineRecognizer.newFromAssets(assetManager, config);
//                                              ^^^^^^^^^^^^^^
//   AssetManager am = context.getAssets();
//   config.modelConfig.senseVoice.model = "sherpa/sense-voice/model.onnx"
```

cooking-assistant가 sherpa-onnx에 대해서는 **방식 1 (newFromFile)**을 쓰는 이유는, Unity StreamingAssets의 모델이 너무 커서(228MB) APK assets로 안 되고, 첫 실행 시 cacheDir에 풀어서 절대 경로로 접근하기 때문 ([sherpa-onnx 문서 §4.3](../ai/sherpa-onnx-온디바이스-asr.md) 참조).

반면 android-vad의 silero_vad.onnx는 1.8MB라 AAR 내부 assets에 들어 있고 — **방식 2만 가능**. 그래서 Context 강제.

---

# 9. 안티패턴: ContentProvider 자동 초기화 트릭

## 9.1 문제: caller에게 Context를 받기 싫다

라이브러리 개발자 입장에서 `init(Context)`를 강제하면:
- README에 "꼭 호출하세요"라고 적어도 사용자가 빼먹음
- Application 서브클래스가 강제됨 → Multi-process 환경에서 매번 초기화 비용
- Crash report → "init 호출 안 했음" 사용자 문의 폭주

해결책: **시스템이 자동으로 Context를 주입하는 지점을 빌린다 — ContentProvider**.

## 9.2 ContentProvider 라이프사이클 트릭

```
┌─────────────────────────────────────────────────────────────────┐
│        앱 프로세스 시작 시 컴포넌트 초기화 순서                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Zygote fork → 새 프로세스                                    │
│  2. ActivityThread.main() 진입                                  │
│  3. Application 객체 생성 (생성자만)                             │
│  4. Application.attachBaseContext(impl) ← Context 처음 attach    │
│  5. ★ 모든 ContentProvider 인스턴스화 + onCreate() 호출 ★        │
│  6. Application.onCreate() 호출                                 │
│  7. Activity/Service/Receiver 생성                              │
│                                                                  │
│  → 즉, ContentProvider.onCreate()는 Application.onCreate()       │
│    보다도 먼저 실행되며, 이미 Context가 attach된 상태.            │
│  → 라이브러리가 "유령 Provider"를 등록해두면 자동으로 Context     │
│    캡처 가능, caller 코드 0줄.                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 9.3 FirebaseInitProvider 실체

`firebase-android-sdk/firebase-common/.../FirebaseInitProvider.java`:

```java
public class FirebaseInitProvider extends ContentProvider {
    private static AtomicBoolean sInitialized = new AtomicBoolean(false);

    @Override
    public void attachInfo(@NonNull Context context, @NonNull ProviderInfo info) {
        if (info == null) {
            throw new NullPointerException("FirebaseInitProvider ProviderInfo cannot be null.");
        }
        if (EMPTY_APPLICATION_ID_PROVIDER_AUTHORITY.equals(info.authority)) {
            throw new IllegalStateException(
                "Incorrect provider authority in manifest. Most likely due to a missing "
                + "applicationId variable in application's build.gradle.");
        }
        super.attachInfo(context, info);
    }

    @Override
    public boolean onCreate() {
        try {
            sInitialized.set(true);
            FirebaseApp.initializeApp(getContext());   // ← 여기가 핵심
        } finally {
            sInitialized.set(false);
        }
        return false;
    }

    // query/insert/update/delete는 모두 throw — 진짜 ContentProvider 아님
    @Override public Cursor query(...) { throw new UnsupportedOperationException(); }
    @Override public Uri insert(...)   { throw new UnsupportedOperationException(); }
    // ...
}
```

라이브러리 Manifest:

```xml
<provider
    android:name="com.google.firebase.provider.FirebaseInitProvider"
    android:authorities="${applicationId}.firebaseinitprovider"
    android:exported="false"
    android:initOrder="100" />
```

**효과**: 사용자가 `Application` 클래스를 안 만들어도, `FirebaseApp.initializeApp(...)`을 안 호출해도, Firebase가 자동으로 Context를 캡처해 살아난다.

## 9.4 AndroidX App Startup — 통합 솔루션

문제: 라이브러리마다 자기 ContentProvider 등록하면 — 5개 라이브러리 = 5개 ContentProvider 인스턴스 = 시작 시간 누적. Google이 2020년 발표한 해결책:

```kotlin
// androidx.startup.Initializer<T>
class VadInitializer : Initializer<VadSilero> {
    override fun create(context: Context): VadSilero {
        return Vad.builder()
            .setContext(context)
            .setSampleRate(SampleRate.SAMPLE_RATE_16K)
            .setFrameSize(FrameSize.FRAME_SIZE_512)
            .setMode(Mode.NORMAL)
            .build()
    }

    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}
```

라이브러리 Manifest:

```xml
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data
        android:name="com.cookingassistant.voice.VadInitializer"
        android:value="androidx.startup" />
</provider>
```

**모든 라이브러리가 `InitializationProvider` 단 하나만 공유**하고, 각자 `<meta-data>`로 자기 Initializer를 등록한다. 의존성 그래프(`dependencies()`)도 표현 가능 → 초기화 순서 결정.

## 9.5 Hilt @ApplicationContext

DI 프레임워크에서는 Context 자체를 주입 가능 객체로 취급:

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object VadModule {
    @Provides
    @Singleton
    fun provideVadSilero(@ApplicationContext context: Context): VadSilero =
        Vad.builder()
            .setContext(context)
            .setSampleRate(SampleRate.SAMPLE_RATE_16K)
            .setFrameSize(FrameSize.FRAME_SIZE_512)
            .setMode(Mode.NORMAL)
            .build()
}

class AudioCaptureService @Inject constructor(
    private val vad: VadSilero,
    private val verifier: SpeakerVerifier,
    private val stt: SpeechRecognizerService,
) { /* ... */ }
```

`@ApplicationContext`는 Hilt가 미리 등록해둔 qualifier — 자동으로 Application Context가 주입된다. 이게 cooking-assistant Unity 환경이 아닌 순수 네이티브 Android 앱이었다면 권장 패턴.

cooking-assistant는 Unity 베이스라 Hilt를 쓸 수 없고, Unity의 `currentActivity`를 수동으로 받아 `getApplicationContext()`로 변환하는 6b31096의 패턴이 사실상 최선이다.

---

# 10. 안티패턴: Context Leak

## 10.1 가장 흔한 leak 패턴

```java
// ❌ Activity Context를 정적 필드에
public class MyManager {
    private static MyManager INSTANCE;
    private Context context;            // ← Activity가 여기 박힘

    public static MyManager init(Context ctx) {
        if (INSTANCE == null) {
            INSTANCE = new MyManager(ctx);
        }
        return INSTANCE;
    }

    private MyManager(Context ctx) {
        this.context = ctx;             // ← Activity 참조 영구 보존
    }
}

// 호출:
MyManager.init(this);  // this = MainActivity → Activity가 영원히 GC 안 됨
```

**증상**: Activity 회전마다 새 Activity가 생기지만 옛 Activity가 GC되지 않음 → 메모리 누수 누적 → 결국 OOM.

## 10.2 수정

```java
// ✅ Application Context로 변환
public static MyManager init(Context ctx) {
    if (INSTANCE == null) {
        INSTANCE = new MyManager(ctx.getApplicationContext());
    }
    return INSTANCE;
}
```

`getApplicationContext()`는 ContextWrapper의 위임을 따라 결국 같은 Application 싱글턴을 반환 — 프로세스 단 하나뿐이라 leak 불가능.

## 10.3 cooking-assistant 패치의 정확성

```java
Context appContext = context != null ? context.getApplicationContext() : null;
```

이 한 줄에 두 가지 안전장치가 동시에 있다:

| 보호 | 효과 |
|------|------|
| `context.getApplicationContext()` | Unity Activity가 다시 시작되어도 VAD가 옛 Activity를 잡고 있지 않음 |
| `context != null ? ... : null` | Unity 측에서 Activity 캐스팅 실패해도 NPE 대신 깨끗한 IllegalArgumentException |

게다가 catch 블록이 sendError로 명시적으로 알리고, vad가 null인 상태로 captureLoop 돌 때 `vadUnavailableLogged` 플래그로 한 번만 경고 — silent failure를 두 번 다시 안 만들겠다는 의도가 보인다.

## 10.4 Leak 방지 도구

| 도구 | 역할 |
|------|------|
| **LeakCanary** | Activity/Fragment 파괴 후 GC 실행 → 살아 있으면 heap dump → leak path 출력 |
| **Android Studio Memory Profiler** | 실시간 heap 모니터링 + reference graph |
| **StrictMode** | Context 잘못 사용 일부 감지 (예: Activity Context로 thread leak) |
| **Hilt** | 자동으로 Application Context 주입 → 사용자 실수 차단 |
| **WeakReference<Activity>** | 어쩔 수 없이 Activity Context 보관 시 |

---

# 11. 빅테크/오픈소스 실전 사례

## 11.1 Google — Hilt + AndroidX Startup

Google 자체 앱(Maps, Photos, GBoard 등)은 Hilt를 사실상 표준으로 채택. `@ApplicationContext` qualifier가 모든 모듈에서 등장. 이는 동시에 "**Context를 수동 전달하지 마라**"는 강력한 가이드라인.

## 11.2 Firebase — FirebaseInitProvider

§9.3에서 본 패턴. Firebase의 모든 모듈(Analytics, Crashlytics, FCM)이 이 패턴을 공유. 사용자가 `FirebaseApp.initializeApp(...)`을 호출 안 해도 동작 — Context는 ContentProvider가 자동 주입.

대안 패턴: 사용자가 명시적 init을 원하면 `tools:node="remove"`로 FirebaseInitProvider 제거 후 직접 호출.

## 11.3 WorkManager — WorkManagerInitializer

`androidx.work.impl.WorkManagerInitializer`가 ContentProvider로 동작. 단, 커스텀 Configuration이 필요하면 `Configuration.Provider`를 Application에 구현 → 자동 init 비활성화 + 첫 `WorkManager.getInstance()` 시 lazy init.

## 11.4 Glide — `Glide.with(...)`

```java
// Glide의 핵심 API
Glide.with(activity).load(url).into(imageView);
```

`with()`가 Activity/Fragment를 받는 이유:
- Activity/Fragment의 라이프사이클 콜백을 등록 (onStart/onStop)
- Activity가 stop되면 진행 중인 이미지 다운로드 자동 일시정지
- destroy되면 메모리/디스크 캐시 정리

Glide는 내부적으로 **Activity Context를 보관하지 않는다** — 매 호출마다 라이프사이클 owner를 받아 콜백만 등록. 이게 "Activity Context 받지만 leak 없는" 정공법.

## 11.5 ML Kit — 자동 다운로드 + Context 자동 캡처

ML Kit는 모델을 라이브러리에 번들하지 않고 첫 사용 시 다운로드. 그 다운로더가 Context를 필요로 하지만 ContentProvider 자동 init으로 캡처 → 사용자는 그냥 `BarcodeScanning.getClient()` 호출.

```java
BarcodeScanner scanner = BarcodeScanning.getClient();   // Context 안 넘김
//        ^^ 내부적으로 자동 주입된 application context 사용
scanner.process(image)...;
```

## 11.6 LeakCanary — Application 자동 후킹

LeakCanary 2.x도 ContentProvider 자동 init으로 Application 인스턴스를 잡고, ActivityLifecycleCallbacks를 등록. 사용자는 dependency만 추가하면 됨.

## 11.7 Meta / Instagram — Context leak 사후 사례

Meta 엔지니어링 블로그(2018~)에서 반복 등장하는 패턴:
- Singleton GraphQL client에 Activity Context를 박은 사례 → 회전 시 매번 leak
- 해결: 모든 관리자 클래스에 `@ApplicationContext` 강제 (Dagger 사용)
- LeakCanary CI 통합으로 PR 단계에서 차단

---

# 12. cooking-assistant 적용 가이드

## 12.1 현재 패치의 평가

```
┌─────────────────────────────────────────────────────────────────┐
│        6b31096 패치 채점                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Unity Activity → getApplicationContext() 변환                  │
│  ✓ null context 시 IllegalArgumentException으로 큰 소리           │
│  ✓ try/catch로 Vad.builder() 실패를 잡되 sendError로 보고         │
│  ✓ vad == null 상태에서 sparse 경고 1회만 (vadUnavailableLogged)  │
│  ✓ AudioRecord state, read 실패, peak, transitions 진단 로그      │
│  ✓ frameCount % 100 == 0 조건으로 spam 방지                      │
│                                                                  │
│  △ 개선 여지:                                                    │
│   - vad init 실패 시 fallback (예: WebRTC VAD로 교체) 미구현      │
│   - dispose() 시 vad.close()는 있으나 captureLoop에서 close된     │
│     vad를 호출할 race 가능성 (현재 isCapturing 체크로 완화)        │
└─────────────────────────────────────────────────────────────────┘
```

## 12.2 Unity → Android Context 표준 패턴

```csharp
// AndroidVoicePipeline.cs (정착해야 할 패턴)
public class AndroidVoicePipeline {
    private AndroidJavaObject GetAppContext() {
        using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
        using (var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity")) {
            // currentActivity는 ContextWrapper(Activity) → getApplicationContext() 호출
            return activity.Call<AndroidJavaObject>("getApplicationContext");
        }
    }

    public void Initialize() {
        var appContext = GetAppContext();
        // 이제 어떤 Java 라이브러리에든 appContext를 넘기면 안전
        audioCapture.Call("initialize", appContext, ...);
    }
}
```

**핵심**: Unity가 주는 `currentActivity`를 직접 라이브러리에 넘기지 말고, 한 번 `getApplicationContext()`로 변환한 뒤 사용. Activity 라이프사이클(예: 사용자가 Home 누르고 다시 들어옴)과 분리.

## 12.3 진단 로그 패턴 — 침묵의 실패를 막는 법

```java
// 이 사건이 가르쳐 준 진단 로그 의무
Log.i(TAG, "AudioCaptureService initialized (vadReady=" + (vad != null) + ")");
Log.w(TAG, "AudioRecord read returned " + read + " (consecutive=" + n + ")");
Log.d(TAG, "Audio capture health (frames=" + n + ", peak=" + peak + ")");
Log.i(TAG, "Voice activity started/ended");
Log.i(TAG, "Sending utterance to STT (samples=..., bytes=...)");
```

원칙:
- **상태 변경마다 로그**: init 성공/실패, capture 시작/종료, VAD 전이
- **에러는 sparse하지만 첫 발생은 무조건**: `consecutiveReadFailures == 1 || consecutiveReadFailures % 30 == 0`
- **건강 체크는 주기적으로**: `frameCount % 100 == 0`
- **silent failure 절대 금지**: vad == null이면 적어도 한 번은 경고

이번 사건의 진짜 교훈: **"버그는 진단 로그가 없으면 보이지 않는다."**

## 12.4 Migration 권고 (장기)

| 단계 | 권고 | 효과 |
|------|------|------|
| 단기 | 현재 6b31096 패턴 유지 | 안정 |
| 중기 | Unity Java helper 클래스로 `getAppContext()` 추출 | 다른 Java 브릿지(Speaker verifier, STT)에도 공유 |
| 장기 | sherpa-onnx/VAD를 별도 Service로 분리 | Foreground Service Type "microphone" 의무화 (API 34+) 대응 |
| 장기 | Application 서브클래스 도입 | Activity 죽음/재생성과 무관한 영속 객체들의 단일 소유자 |

---

# 13. 자주 틀리는 부분 정리

## 13.1 `this` vs `getApplicationContext()` vs `getBaseContext()`

```java
public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        Context a = this;                          // = MainActivity (ContextThemeWrapper)
        Context b1 = getApplicationContext();      // = Application 싱글턴
        Context c = getBaseContext();              // = ContextImpl (Activity의 base)
        Context d = getApplication();              // = Application (캐스팅 불필요)

        // a == d? NO. a는 Activity, d는 Application. 별개 객체.
        // a == c? NO. a는 wrapper, c는 impl. wrapper는 c를 base로 들고 있음.
        // b1 == d? YES. 둘 다 같은 Application 싱글턴.
    }
}
```

`getBaseContext()`는 거의 쓸 일이 없다 — 라이브러리가 wrapper를 거치지 않고 impl에 직접 닿고 싶을 때만 사용. 99%의 경우 잘못된 패턴.

## 13.2 Fragment의 Context

```kotlin
class MyFragment : Fragment() {
    fun doSomething() {
        val ctx = requireContext()       // host Activity (attached 상태에서만)
        // val ctx = context              // nullable (detached 상태에선 null)
    }
}
```

Fragment는 Context를 직접 상속하지 않음 — 항상 host Activity의 Context를 빌려 쓴다. `onAttach()`/`onDetach()` 사이에서만 유효.

## 13.3 BroadcastReceiver의 Context

```java
public class MyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // ★ 이 context는 매우 짧은 수명. 저장 금지!
        // 만약 보관 필요하면 context.getApplicationContext()
    }
}
```

특히 `onReceive` 내에서 비동기 작업을 시작하면, 작업 완료 전에 Context가 무효화될 수 있음 → Application Context로 변환 후 사용 또는 `goAsync()` 사용.

## 13.4 View 생성자의 Context

```java
public class CustomView extends View {
    public CustomView(Context context, AttributeSet attrs) {
        super(context, attrs);
        // 이 context는 보통 Activity (인플레이션 시점)
        // Theme/Style/Color 등 화면 컨텍스트 그대로 사용
        // → 직접 보관하지 말고 부모 클래스에 위임
    }
}
```

View는 자기 Context를 보관하는데, 그게 Activity Context. View가 화면에서 detach되면 함께 GC됨 — 정상.

---

# 14. 학술/공식 근거

| 출처 | 내용 |
|------|------|
| **AOSP `frameworks/base/core/java/android/content/Context.java`** | Context의 30+ 추상 메서드 정의. `getAssets()`, `getResources()`, `getSystemService()` 등 모두 abstract |
| **AOSP `frameworks/base/core/java/android/content/ContextWrapper.java`** | base context 위임 패턴 |
| **AOSP `frameworks/base/core/java/android/app/ContextImpl.java`** | 모든 추상 메서드의 실제 구현, `mPackageInfo: LoadedApk`, `mResources: Resources` 필드 |
| **AOSP `frameworks/base/core/java/android/app/ActivityThread.java`** | Application 객체 생성, `attachBaseContext()` 호출 시점 |
| **Android Developer Reference: Context** | 공식 API 문서 |
| **Android Developer Reference: ContextWrapper** | wrapper 패턴 공식 설명 |
| **Diane Hackborn — "Multitasking the Android Way" (2010)** | 프로세스 라이프사이클과 Application Context 설계 의도 |
| **Chet Haase — "App Startup, Part 1: Of Content Providers and Automatic Initialization" (2020)** | ContentProvider 트릭의 공식 인정과 App Startup의 동기 |
| **Firebase Blog — "How does Firebase initialize on Android?" (2016)** | FirebaseInitProvider 패턴의 공식 설명 |
| **android-vad README + Releases** | 2.0.10에서 setContext 강제 + 16KB page size 호환 |

---

# 15. 요약

cooking-assistant 2026-05-05 사건은 **"Android Context는 시스템과 앱 사이의 단일 다리"**라는 기초를 다시 한번 환기시켰다. android-vad 2.0.10이 자기 AAR에 패키징한 silero_vad.onnx에 도달하려면 `context.getAssets().open(...)`이 유일한 경로이고, 그래서 Context를 강제로 요구한다. Unity → Java 브릿지에서 Context를 안 넘기면 라이브러리는 silent failure로 죽고, AudioRecord가 정상 캡처해도 vad가 null이라 모든 프레임이 드롭 — STT는 영원히 빈 결과.

핵심 해법은 Unity의 `currentActivity → getApplicationContext()` 변환을 한 줄로 강제하고, null이면 IllegalArgumentException으로 큰 소리를 내는 것. 동시에 진단 로그를 sparse하지만 의미 있는 지점마다 박아 침묵의 실패를 다시는 만들지 않게 함.

Context의 본질은 **Linux UID 샌드박스 + Zygote fork 모델 + 멀티 사용자/디스플레이 + 컴포넌트 모델**이라는 Android 고유 제약의 응축물이다 ([android-os-시스템특성.md](android-os-시스템특성.md) 참조). 정적 전역으로는 표현 불가능한 라이프사이클/구성/권한 정보가 Context 한 객체에 집약돼 있고, 그래서 모든 라이브러리가 Context를 요구할 수밖에 없다. 라이브러리 사용자가 Context를 안 넘겨도 되게 만들고 싶으면 `FirebaseInitProvider` 같은 ContentProvider 자동 init 트릭이나 AndroidX App Startup, Hilt `@ApplicationContext`를 쓴다.

cooking-assistant Unity 환경은 Hilt를 못 쓰지만, `getApplicationContext()` 변환 + 진단 로그라는 미니멀한 정공법으로 같은 안전성을 확보했다. 같은 패턴을 Speaker verifier, STT 서비스 등 다른 Java 브릿지에도 일관되게 적용하면 같은 종류의 사건은 재발하지 않는다.

---

# 참고 자료

## AOSP / 공식 문서
- [Android Developer Reference: Context](https://developer.android.com/reference/android/content/Context)
- [Android Developer Reference: ContextWrapper](https://developer.android.com/reference/android/content/ContextWrapper)
- [Android Developer Reference: ContextThemeWrapper](https://developer.android.com/reference/androidx/appcompat/view/ContextThemeWrapper)
- [Android Developer Reference: ContextCompat](https://developer.android.com/reference/androidx/core/content/ContextCompat)
- [AOSP Context.java (frameworks/base)](https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/content/Context.java)
- [AOSP ContextImpl.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/app/ContextImpl.java)
- [AOSP ContextWrapper.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/content/ContextWrapper.java)
- [Context.createDeviceProtectedStorageContext](https://learn.microsoft.com/en-us/dotnet/api/android.content.context.createdeviceprotectedstoragecontext)
- [Context.createWindowContext](https://learn.microsoft.com/en-us/dotnet/api/android.content.context.createwindowcontext)
- [Direct Boot 가이드](https://developer.android.com/privacy-and-security/direct-boot)

## 라이프사이클 / 프로세스
- [Processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)
- [The activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)
- [Multitasking the Android Way (Diane Hackborn, 2010)](https://android-developers.googleblog.com/2010/04/multitasking-android-way.html)
- [Two Simple Questions (Diane Hackborn, 2010)](https://android-developers.googleblog.com/2010/08/two-simple-questions.html)

## ContentProvider 자동 초기화
- [App Startup (AndroidX)](https://developer.android.com/topic/libraries/app-startup)
- [Decrease startup time with Jetpack App Startup (Android Developers Blog, 2020)](https://android-developers.googleblog.com/2020/07/decrease-startup-time-with-jetpack-app.html)
- [App Startup, Part 1: Of Content Providers and Automatic Initialization (Chet Haase)](https://medium.com/androiddevelopers/app-startup-part-1-34f57b65cacd)
- [App Startup, Part 2: Lazy Initialization (Chet Haase)](https://medium.com/androiddevelopers/app-startup-part-2-c431e80d0df)
- [How does Firebase initialize on Android? (Firebase Blog, 2016)](https://firebase.blog/posts/2016/12/how-does-firebase-initialize-on-android/)
- [Take Control of Your Firebase Init on Android (Firebase Blog, 2017)](https://firebase.blog/posts/2017/03/take-control-of-your-firebase-init-on/)
- [FirebaseInitProvider 공식 문서](https://firebase.google.com/docs/reference/android/com/google/firebase/provider/FirebaseInitProvider)
- [FirebaseInitProvider 소스](https://github.com/firebase/firebase-android-sdk/blob/master/firebase-common/src/main/java/com/google/firebase/provider/FirebaseInitProvider.java)
- [Exploiting ContentProvider to initialize libraries (Kshitij Chauhan)](https://blog.haroldadmin.com/posts/initialize-using-content-provider)
- [Auto-initialize your android library (André Tietz)](https://medium.com/@andretietz/auto-initialize-your-android-library-2349daf06920)

## DI / Hilt
- [Dependency injection with Hilt](https://developer.android.com/training/dependency-injection/hilt-android)
- [Hilt @ApplicationContext / @ActivityContext qualifiers](https://developer.android.com/training/dependency-injection/hilt-android#component-default)

## ML 라이브러리 + Context
- [android-vad GitHub](https://github.com/gkonovalov/android-vad)
- [android-vad Releases (2.0.10 release notes)](https://github.com/gkonovalov/android-vad/releases)
- [android-vad Silero VAD wiki](https://deepwiki.com/gkonovalov/android-vad/3.2-silero-vad)
- [TensorFlow Lite Android codelab — loadModelFile](https://developer.android.com/codelabs/digit-classifier-tflite)
- [Using TensorFlow Lite on Android (TensorFlow Blog)](https://blog.tensorflow.org/2018/03/using-tensorflow-lite-on-android.html)
- [Glide 공식 문서](https://bumptech.github.io/glide/)

## AAR / Manifest 병합
- [Create an Android library (AAR 가이드)](https://developer.android.com/studio/projects/android-library)
- [Unity AAR plug-ins and Android Libraries](https://docs.unity3d.com/Manual/AndroidAARPlugins.html)

## Memory Leak / 베스트 프랙티스
- [Beware PackageManager leaks (Pierre-Yves Ricau, LeakCanary 저자)](https://dev.to/pyricau/beware-packagemanager-leaks-223g)
- [Day 6/100: Context in Android — The Wrong One Will Leak Your Entire Activity](https://dev.to/hoangshawn/day-6100-context-in-android-the-wrong-one-will-leak-your-entire-activity-3o3k)
- [Application Context, Activity Context and Memory leaks (Shashank Mistry)](https://shashankmistry30.medium.com/application-context-activity-context-and-memory-leaks-7e1461ab1d9a)
- [Fully understand Context in Android (Eric Yang)](https://ericyang505.github.io/android/Context.html)
- [Mastering Android context (freeCodeCamp)](https://www.freecodecamp.org/news/mastering-android-context-7055c8478a22/)
- [LeakCanary 공식](https://square.github.io/leakcanary/)

## 관련 dwkim 문서
- [mobile/android-os-시스템특성.md](android-os-시스템특성.md) — Linux UID 샌드박스, Zygote, Binder, ART
- [ai/sherpa-onnx-온디바이스-asr.md](../ai/sherpa-onnx-온디바이스-asr.md) — newFromAssets vs newFromFile, Silero VAD 통합
- [devtools/git-lfs-대용량바이너리.md](../devtools/git-lfs-대용량바이너리.md) — ONNX 모델 패키징 트러블
