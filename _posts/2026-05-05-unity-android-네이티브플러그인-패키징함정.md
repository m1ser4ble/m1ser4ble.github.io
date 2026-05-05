---
layout: single
title: "Unity Android 네이티브 플러그인 / AAR 패키징 함정 완전가이드"
date: 2026-05-05 23:05:00 +09:00
categories: frontend
excerpt: "Unity Android 네이티브 플러그인 패키징은 Editor 기준 경로 감각과 실제 APK AssetManager·Gradle 의존성 해석이 다르기 때문에 asset path 오류와 duplicate class 문제가 쉽게 발생한다."
toc: true
toc_sticky: true
tags: [unity, android, aar, plugin, gradle]
source: "/home/dwkim/dwkim/docs/xr/unity-android-네이티브플러그인-패키징함정.md"
---

TL;DR
- Unity의 StreamingAssets 경로와 Android AssetManager 기준 경로는 같지 않아서 Editor에서 맞던 문자열이 디바이스에서는 바로 깨질 수 있다.
- 여기에 AAR transitives와 Kotlin stdlib 버전 충돌이 겹치면 빌드는 release 단계에서만 갑자기 실패한다.
- 결국 Unity, Gradle, Android runtime이 서로 어떤 계약으로 연결되는지 이해해야 네이티브 플러그인 패키징이 안정된다.

## 1. 개념
Unity Android 네이티브 플러그인 패키징은 StreamingAssets 경로 해석과 AAR 의존성 정렬 문제를 동시에 다뤄야 하는 통합 빌드 이슈다.

## 2. 배경
Unity 프로젝트가 로컬에서는 잘 돌아도 Android 빌드에서만 깨지는 경우가 많은 이유는, Unity 에디터의 파일 시스템 감각과 실제 APK 내부 자산 접근 방식이 다르기 때문이다. 여기에 여러 SDK가 끌고 오는 Kotlin/Gradle 의존성까지 섞이면 문제는 더 늦게 드러난다.

## 3. 이유
이 구조를 알아야 asset 경로를 하드코딩하지 않고, AAR 충돌을 build-time에 조정하며, XR 앱에 필요한 네이티브 음성·센서 플러그인을 안정적으로 배포할 수 있다.

## 4. 특징
- StreamingAssets는 Android에서 일반 파일 경로가 아니라 AssetManager 기준 자산으로 접근해야 한다
- 옛 Unity prefix를 허용하는 호환 코드가 마이그레이션 충격을 줄일 수 있다
- Kotlin stdlib 계열 버전은 force나 constraints로 정렬하지 않으면 duplicate class가 터진다
- mainTemplate.gradle, launcherTemplate.gradle, AAR transitive dependency 이해가 필수다

## 5. 상세 내용

# Unity Android 네이티브 플러그인 / AAR 패키징 함정 완전가이드

> **작성일**: 2026-05-05
> **카테고리**: XR / Unity / Android / Build / Native Plugin
> **트리거**: cooking-assistant repo `c546bf3` (2026-05-04, `fix(voice): load local stt runtime assets (#98)`) — Android XR 빌드에서 `bin/Data/StreamingAssets/...` prefix가 박힌 sherpa-onnx 모델 경로가 `AssetManager.open()`에서 `FileNotFoundException`으로 죽고, 동시에 release 빌드가 `Duplicate class kotlin.*`로 R8 단계에서 폭발한 두 사건이 한 커밋에서 함께 수정됨
> **포함 내용**: StreamingAssets, Application.streamingAssetsPath, Application.dataPath, Application.persistentDataPath, AssetManager (`android.content.res.AssetManager`), APK `assets/` vs `res/raw/`, AAR(Android Archive), mainTemplate.gradle / launcherTemplate.gradle / baseProjectTemplate.gradle / settingsTemplate.gradle, Gradle `configurations.configureEach`, `resolutionStrategy.force`, `dependencyConstraints`, `enforcedPlatform` (BOM), R8 / D8, Duplicate class error, Kotlin stdlib 가족(kotlin-stdlib / kotlin-stdlib-common / kotlin-stdlib-jdk7 / kotlin-stdlib-jdk8), JAR 안의 JAR (`jar:file://...!/assets/...`), `noCompress` 정책, `AAPT2`, `unityLibrary` 모듈 vs `launcher` 모듈, Unity Android Gradle 템플릿 history, EDM4U / Play Services Resolver, Meta XR SDK / ARCore / Niantic Lightship Gradle 패치 패턴, Play Asset Delivery, sherpa-onnx AAR, Silero VAD AAR, Azure Cognitive Services Speech SDK 1.42.0, cooking-assistant 2026-05-04 사건 분석

---

# 1. 발생 사례 — cooking-assistant 2026-05-04

## 1.1 사건 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│           cooking-assistant Android XR 2026-05-04                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [2026-05-02]  e8047cd  feat(voice): enable local stt           │
│                └─ Azure 클라우드 STT → sherpa-onnx 온디바이스    │
│                └─ 초기 구현, tokens.txt 누락 (다른 문서 참조)    │
│                                                                  │
│  [2026-05-02]  f89d913  fix(voice): include sherpa tokens path  │
│                └─ tokens.txt 경로 추가, 디코더 동작              │
│                                                                  │
│  [2026-05-02]  6ba25bd  feat(voice): package via lfs            │
│                └─ model.int8.onnx LFS 패키징                     │
│                                                                  │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  [2026-05-04 00:29]  c546bf3  fix(voice): load local stt        │
│                       runtime assets (#98)                       │
│                                                                  │
│       Issue 1 — Path prefix mismatch                             │
│       ┌───────────────────────────────────────────────────┐     │
│       │ VoiceConfig.cs 기본값:                             │     │
│       │   "bin/Data/StreamingAssets/SherpaOnnx/.../        │     │
│       │    model.int8.onnx"                                │     │
│       │                                                     │     │
│       │ Editor/Standalone에서는 OK                          │     │
│       │ Android에서는 AssetManager.open() →                 │     │
│       │   FileNotFoundException (시작점이 assets/ 자체)    │     │
│       └───────────────────────────────────────────────────┘     │
│                                                                  │
│       Issue 2 — Kotlin stdlib duplicate class                    │
│       ┌───────────────────────────────────────────────────┐     │
│       │ sherpa-onnx AAR  → kotlin-stdlib-jdk8 1.7.x       │     │
│       │ silero-2.0.10    → kotlin-stdlib-jdk7 1.6.x       │     │
│       │ Azure Speech     → 또 다른 transitive 버전        │     │
│       │                                                     │     │
│       │ release 빌드의 R8 단계 →                           │     │
│       │   "Duplicate class kotlin.collections.* found     │     │
│       │    in modules ..."                                 │     │
│       └───────────────────────────────────────────────────┘     │
│                                                                  │
│       Fix — 두 함정 동시 해결 (49 insertions, 10 deletions)     │
│         · VoiceConfig.cs: prefix 제거                            │
│         · LocalSpeechToTextService.java: 옛 prefix stripping     │
│         · mainTemplate.gradle + launcherTemplate.gradle:         │
│           Kotlin stdlib 4종 force 1.8.22                         │
└─────────────────────────────────────────────────────────────────┘
```

커밋 메시지 본문 발췌:

> "Unity exposes StreamingAssets to AssetManager without the Unity prefix.
> sherpa's AAR also needs Kotlin stdlib classes at runtime.
> Use AssetManager-relative defaults and tolerate the old prefix.
> Align Kotlin stdlib artifacts to avoid duplicate-class release builds."

이 문서는 위 두 함정이 **왜 한 커밋에 같이 들어가게 됐는지** — 즉 *"Unity가 자기 산출물을 Android Gradle/AssetManager 위에 얹을 때 호스트 빌드 환경과 어떤 약속을 맺는지가 직관과 다르다"* 라는 공통 뿌리를 풀어낸다. 음성 인식 자체의 트러블(`tokens.txt` 누락)은 [`ai/sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md), 모델 자체의 LFS 패키징 문제는 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md)가 다룬다.

## 1.2 1차 코드 — Editor에서는 동작, Android에서는 죽음

```csharp
// VoiceConfig.cs (c546bf3 이전)
[
    SerializeField,
    Tooltip("AssetManager-relative sherpa-onnx model path packaged under StreamingAssets.")
]
string m_LocalSherpaModelPath =
    "bin/Data/StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx";

[
    SerializeField,
    Tooltip("AssetManager-relative sherpa-onnx tokens path packaged under StreamingAssets.")
]
string m_LocalSherpaTokensPath =
    "bin/Data/StreamingAssets/SherpaOnnx/sense-voice/tokens.txt";
```

Tooltip은 *"AssetManager-relative"*라고 분명히 적어 두었지만 **기본값에는 Unity Standalone의 데이터 디렉토리 prefix가 박혀 있다**. 이게 가능한 이유는 작성 당시 개발자가 Editor에서 테스트하면서 `Application.dataPath`가 `<project>/Assets/...`로 동작하던 흔적을 그대로 둔 것. Editor/Standalone에서는 `bin/Data/...`가 의미를 가지지만 Android의 `AssetManager.open(...)`은 그 시작점이 곧 `assets/` 자체라서 `bin/`이라는 디렉토리는 APK 안에 존재하지 않는다.

## 1.3 2차 hotfix — AssetManager-relative + 옛 prefix tolerance

```csharp
// VoiceConfig.cs (c546bf3 이후)
string m_LocalSherpaModelPath  = "SherpaOnnx/sense-voice/model.int8.onnx";
string m_LocalSherpaTokensPath = "SherpaOnnx/sense-voice/tokens.txt";
```

```java
// LocalSpeechToTextService.java (c546bf3 추가분)
private static final String UNITY_STREAMING_ASSETS_PREFIX = "bin/Data/StreamingAssets/";

private String resolveReadableAssetPath(Context context, String assetPath) throws IOException {
    if (assetExists(context, assetPath)) {
        return assetPath;
    }
    if (assetPath.startsWith(UNITY_STREAMING_ASSETS_PREFIX)) {
        String strippedPath = assetPath.substring(UNITY_STREAMING_ASSETS_PREFIX.length());
        if (assetExists(context, strippedPath)) {
            return strippedPath;
        }
    }
    throw new FileNotFoundException(assetPath);
}

private boolean assetExists(Context context, String assetPath) throws IOException {
    try (InputStream ignored = context.getAssets().open(assetPath)) {
        return true;
    } catch (FileNotFoundException e) {
        return false;
    }
}
```

핵심 패턴: **C# 측 기본값은 정답으로 바꾸되, Java 측은 옛 prefix를 받아도 stripping해서 살려준다.** Inspector에 박혀 있는 prefab 직렬화 데이터, 외부 컨피그, CI 캐시, 테스트 fixture 등 어딘가에 옛 값이 굳어 있을 수 있으니 한쪽은 forward fix, 한쪽은 backward compatibility를 동시에 가져간다. 관성적으로 한쪽만 수정하면 한 환경에서만 고쳐진다는 함정이 있다.

## 1.4 동시에 터진 Kotlin stdlib duplicate class

```gradle
// launcherTemplate.gradle (c546bf3 추가분)
configurations.configureEach {
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-common:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
}
```

```gradle
// mainTemplate.gradle (c546bf3 추가분)
dependencies {
    // Azure Cognitive Services Speech SDK (Maven Central)
    implementation 'com.microsoft.cognitiveservices.speech:client-sdk:1.42.0'
    implementation 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
    // Silero VAD – voice activity detection (local AAR, downloaded from JitPack)
    implementation(name: 'silero-2.0.10', ext: 'aar')
    ...
}

configurations.configureEach {
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-common:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
}
```

**같은 4줄을 두 파일에 동일하게 적은 것은 실수가 아니라 의도된 중복이다.** Unity Android Gradle 프로젝트가 `unityLibrary` 모듈(=`mainTemplate.gradle`)과 `launcher` 모듈(=`launcherTemplate.gradle`)로 갈라져 있고, R8/minify가 launcher 모듈에서 작동하는 구조 때문이다(자세한 내용은 §10).

이 두 함정은 표면적으로는 무관해 보인다 — 하나는 경로 문자열이고 하나는 의존성 그래프다. 그러나 둘 다 **Unity가 빌드 산출물을 Android 호스트 환경에 넘기는 인터페이스가 직관과 다르다**는 같은 뿌리를 가진다. Unity는 Editor에서 잘 돌아가는 모델을 그대로 Android 호스트에 얹지 않고, AssetManager(에셋)와 Gradle(코드/AAR)이라는 호스트 메커니즘으로 번역한다. 그 번역의 두 가장자리가 이번 사건이다.

---

# 2. 용어 사전

## 2.1 Unity 측 — 에셋 경로 API

| 용어 | 의미 |
|------|-----|
| **StreamingAssets** | Unity의 특수 폴더. `Assets/StreamingAssets/...`에 둔 파일이 **빌드 시 변형 없이(import 안 함)** 산출물에 포함됨. 모델, 비디오, 외부 라이브러리 데이터 같은 "런타임에 그대로 읽어야 하는 파일"용 |
| **Application.streamingAssetsPath** | 플랫폼별로 *런타임 시* StreamingAssets에 접근하는 base 경로(또는 URL)를 반환. Android에서는 `jar:file://.../base.apk!/assets`로 시작하는 **URL** |
| **Application.dataPath** | 플랫폼별 "앱 데이터" base. Editor에서는 `<project>/Assets`, Standalone Windows/Linux에서는 `<game>_Data/`, macOS에서는 `Contents/Resources/Data/`, Android에서는 `/data/app/.../base.apk` |
| **Application.persistentDataPath** | 앱이 자유롭게 읽고 쓰는 영속 디렉토리. Android는 `/data/data/<pkg>/files/`(internal) 또는 `/storage/.../Android/data/<pkg>/files/`(external) |
| **Application.temporaryCachePath** | 캐시 전용. Android는 `/data/data/<pkg>/cache/` |
| **UnityWebRequest** | URI로 동작하는 HTTP/파일 요청 추상화. **Android의 jar URL을 자동 처리**해서 StreamingAssets를 한 줄로 읽게 해줌 |
| **AssetBundle** | Unity의 동적 에셋 패키지 포맷. `BuildPipeline.BuildAssetBundles` 또는 Addressables로 생성 |
| **Addressables** | AssetBundle의 매니지드 상위 시스템. Unity 2018.2+. 원격 CDN, 자동 의존성 추적 |

## 2.2 Android 측 — 자산 / 리소스

| 용어 | 풀 이름 | 의미 |
|------|--------|-----|
| **AssetManager** | `android.content.res.AssetManager` | APK 안의 `assets/` 디렉토리를 *zip entry 단위*로 스트리밍 접근하는 API. `getAssets().open(path)`가 `InputStream`을 반환. **파일시스템 경로를 노출하지 않음** |
| **assets/** | — | APK 내부의 "원본 파일 그대로" 디렉토리. AAPT2가 처리하지 않음. 디렉토리 구조 보존 |
| **res/raw/** | — | APK의 리소스 시스템에 등록된 원시 파일. R.raw.xxx로 참조. **확장자 제거됨**, **하위 디렉토리 불가**, 리소스 ID로만 접근 |
| **AAPT2** | Android Asset Packaging Tool 2 | XML/이미지 등 리소스를 컴파일/병합. `assets/`는 통과시키고 처리 안 함 |
| **APK** | Android Package | ZIP 컨테이너. 내부에 classes.dex, lib/<abi>/*.so, res/, assets/, AndroidManifest.xml(binary), resources.arsc |
| **AAB** | Android App Bundle | Play Store 업로드 포맷. 디바이스별 분할 APK 생성용 |
| **AAR** | Android Archive | Android 라이브러리 ZIP. JAR + AndroidManifest + res/ + assets/ + jni/ + proguard 룰. `implementation files('foo.aar')` 또는 Maven에서 가져옴 |
| **noCompress** | — | `aapt`에 zip 압축에서 제외할 확장자를 지정. mmap이 가능해지므로 모델 같은 큰 바이너리는 보통 noCompress로 둠 |

## 2.3 Unity Android Gradle 템플릿 4종

Unity는 Player Settings > Publishing Settings에서 다음 4개 Gradle 파일을 활성화/커스터마이징할 수 있다. 각각 빌드된 Gradle 프로젝트의 다른 위치에 들어간다.

| 템플릿 | 산출물 위치 | 역할 | minifyEnabled 위치 |
|--------|-------------|------|------|
| **baseProjectTemplate.gradle** | 루트 `build.gradle` | repositories, plugin classpath (AGP 버전) | — |
| **settingsTemplate.gradle** | 루트 `settings.gradle` | `pluginManagement`, `dependencyResolutionManagement`, include 모듈 | — |
| **mainTemplate.gradle** | `unityLibrary/build.gradle` | Unity 엔진 + 사용자 AAR/JAR + Android 의존성 | (보통 false) |
| **launcherTemplate.gradle** | `launcher/build.gradle` | 최종 APK/AAB 패키징, manifest 병합, **R8/minify, signing** | **true (release)** |
| **gradleTemplate.properties** | `gradle.properties` | JVM args, AndroidX flag, ABI 필터 | — |

> Unity 매뉴얼은 baseProjectTemplate / mainTemplate / launcherTemplate / settingsTemplate / gradle.properties 5종이 빌드된 Gradle 프로젝트의 어느 파일을 대체하는지 명시한다.

## 2.4 Gradle 의존성 해결

| 용어 | 의미 |
|------|-----|
| **Configuration** | 의존성 그룹. `implementation`, `api`, `runtimeOnly`, `compileOnly`, `androidTestImplementation` 등. AGP는 variant별로 `releaseRuntimeClasspath` 등 자동 생성 |
| **resolutionStrategy** | `Configuration`의 충돌 해결 정책 객체. `force()`, `eachDependency()`, `dependencySubstitution()` 등 |
| **resolutionStrategy.force** | "이 좌표는 무조건 이 버전으로." 가장 강한 핀. `'group:name:version'` 또는 `ModuleVersionSelector` |
| **dependencyConstraints** | Gradle 4.6+ (`constraints { ... }` 블록). 직접 의존이 아니라 **transitive에만 적용되는 버전 권고/강제** |
| **enforcedPlatform** | BOM(Bill Of Materials)을 강제 핀으로 적용. 패밀리 단위 일괄 핀 |
| **exclude** | `implementation('foo:bar:1.0') { exclude group: 'baz', module: 'qux' }` — transitive 의존을 끊음 |
| **configurations.configureEach** | 모든 Configuration에 동일 설정 일괄 적용. `all { ... }`보다 lazy해서 권장 |

## 2.5 R8 / D8 / Kotlin stdlib

| 용어 | 의미 |
|------|-----|
| **D8** | Android 빌드의 dexer. `.class` → `.dex`. AGP 3.0+ 기본 (이전은 dx) |
| **R8** | D8의 상위. shrinking(tree-shaking) + obfuscation(ProGuard 호환) + optimization. AGP 3.4+ 기본. **release minifyEnabled true**에서 활성 |
| **Desugaring** | Java 8+ 기능을 낮은 API 레벨에서 동작하게 변환. R8/D8이 처리 |
| **Duplicate class error** | 같은 fully-qualified class name이 두 개 이상의 의존성 jar에서 발견될 때 D8/R8이 실패. *"Duplicate class kotlin.jvm.internal.Intrinsics found in modules ..."* 형태 |
| **Kotlin stdlib** | Kotlin 런타임 표준 라이브러리. `org.jetbrains.kotlin:kotlin-stdlib`. JVM 진입점 |
| **kotlin-stdlib-common** | Kotlin Multiplatform 공통 모듈용 |
| **kotlin-stdlib-jdk7** | (1.2~1.7) JDK 7 추가 확장 (Try-with-resources 관련) |
| **kotlin-stdlib-jdk8** | (1.2~1.7) JDK 8 추가 확장 (Streams, Time 관련). **1.8부터 stdlib에 병합** |
| **kotlin-stdlib-jdk7/jdk8 deprecation** | Kotlin 1.8.0 릴리스 노트: *"you no longer need to declare `kotlin-stdlib-jdk7` and `kotlin-stdlib-jdk8` separately in build scripts because the contents of these artifacts have been merged into `kotlin-stdlib`"* |

---

# 3. 등장 배경 (Why It Emerged)

## 3.1 왜 Unity는 StreamingAssets라는 별도 폴더가 필요한가

Unity의 일반 `Assets/...`는 **에셋 파이프라인이 변형(import)** 한다.

```
┌─────────────────────────────────────────────────────────────────┐
│              Unity 에셋 파이프라인의 변형                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Assets/Models/Cube.fbx                                          │
│        │                                                         │
│        │  AssetImporter (FBXImporter)                            │
│        ▼                                                         │
│  Library/Artifacts/<hash>  ← 플랫폼별 Mesh, Animation 직렬화     │
│        │                                                         │
│        │  Build Pipeline                                         │
│        ▼                                                         │
│  Player Data (sharedassets0.assets, level0)                      │
│        │                                                         │
│        │  AssetBundle / Resources.Load                           │
│        ▼                                                         │
│  Runtime (UnityEngine.Mesh 객체)                                 │
└─────────────────────────────────────────────────────────────────┘
```

PNG는 ETC2/ASTC로 압축되고, FBX는 Unity의 binary mesh로 변환되고, .wav는 .ogg로 인코딩된다. 결과적으로 **원본 바이트가 그대로 보존되지 않는다**. 그러나 어떤 종류의 파일은 원본 그대로 필요하다:

- 외부 ML 모델 (`model.int8.onnx`) — 추론 엔진이 정확한 바이트를 읽어야 함
- 외부 vocab/사전 (`tokens.txt`) — 텍스트 그대로
- 비디오 파일 — Unity Video Player가 외부 코덱으로 재생
- 외부 JSON/YAML 컨피그
- 다른 네이티브 라이브러리(JNI/C++)가 직접 읽는 파일

이걸 위한 폴더가 **StreamingAssets**다. Unity 3.x부터 존재. 정확히는 *"Unity가 import 처리를 하지 않고, 빌드 시 산출물 디렉토리에 그대로 복사하며, 런타임에 `Application.streamingAssetsPath`로 접근하는 폴더"*.

## 3.2 왜 Android의 AssetManager는 파일시스템 경로를 안 주는가

```
┌─────────────────────────────────────────────────────────────────┐
│           APK 내부 구조와 AssetManager의 인터페이스               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  app.apk (ZIP 컨테이너)                                          │
│  ├── AndroidManifest.xml         (binary XML)                    │
│  ├── classes.dex                                                 │
│  ├── classes2.dex                                                │
│  ├── resources.arsc              (리소스 테이블)                  │
│  ├── res/                                                        │
│  │   ├── drawable/...                                            │
│  │   ├── layout/...                                              │
│  │   └── raw/                    ← R.raw.xxx                     │
│  ├── assets/                     ← AssetManager의 시작점         │
│  │   ├── SherpaOnnx/                                             │
│  │   │   └── sense-voice/                                        │
│  │   │       ├── model.int8.onnx                                 │
│  │   │       └── tokens.txt                                      │
│  │   └── bin/                    ← Unity가 추가한 디렉토리?      │
│  │       └── Data/                                               │
│  │           └── StreamingAssets/                                │
│  │               └── ...         ← 실제로는 없음!                │
│  ├── lib/                                                        │
│  │   ├── arm64-v8a/                                              │
│  │   │   ├── libsherpa-onnx-jni.so                               │
│  │   │   ├── libonnxruntime.so                                   │
│  │   │   └── libunity.so                                         │
│  │   └── armeabi-v7a/...                                         │
│  └── META-INF/                                                   │
│      └── CERT.RSA, MANIFEST.MF                                   │
│                                                                  │
│  ※ APK는 unzip 안 됨. /data/app/<pkg>/base.apk 채로 mount.       │
│  ※ assets/ 내부 파일은 앱이 설치돼도 디스크에 풀리지 않음.       │
│  ※ AssetManager가 zip entry를 stream으로 읽음.                   │
└─────────────────────────────────────────────────────────────────┘
```

Android의 자산 정책은 *공간 절약*과 *쓰기 차단*에서 출발했다 (2008 G1, 256MB 내장 메모리). 앱 자산을 **풀지 않고 APK ZIP 내부에 그대로** 두고, 런타임은 zip entry를 스트리밍으로 읽는다. 그래서 `assets/` 안의 파일에는 *real path*가 없다 — 정확히 말하면 `/data/app/.../base.apk` 안의 ZIP 오프셋이 있을 뿐, `open("/data/app/.../base.apk/assets/SherpaOnnx/...")` 같은 호출은 불가능하다.

`AssetManager`의 인터페이스가 곧 이 모델의 표면이다:

```java
// 가능
InputStream is = context.getAssets().open("SherpaOnnx/sense-voice/model.int8.onnx");

// 불가능 (설계상 노출 안 함)
String path = context.getAssets().getRealPath("...");  // 이런 메서드 없음
File f = new File(...);                                 // 어떤 경로를 줘도 못 옴
```

대신 큰 자산은 보통 `noCompress` 옵션으로 압축 없이 저장하면 OS가 zip entry를 mmap-friendly하게 다룰 수 있다. 그래도 일반 file path API는 안 통하고, 일부 네이티브 라이브러리는 file descriptor를 받기 위해 `AssetFileDescriptor` 또는 임시 파일 복사를 거친다. cooking-assistant가 sherpa-onnx에 모델을 넘길 때 `getNoBackupFilesDir()`로 한 번 복사하는 것도 이 패턴이다.

## 3.3 왜 Gradle은 같은 좌표를 한 버전으로만 해결하는가

Java 클래스로더는 같은 FQCN을 하나만 가질 수 있다. Android 빌드의 D8/R8은 모든 의존성 jar/aar의 클래스를 단일 dex 묶음으로 합치는데, **같은 클래스가 두 jar에 있으면 어느 버전을 쓸지 결정 불능**이다. Gradle이 의존성 그래프에서 같은 `group:name`을 만나면 기본 정책은 *highest version wins*. 하지만 transitive로 들어온 동일 클래스를 다른 좌표(`kotlin-stdlib`와 `kotlin-stdlib-jdk8`)에서 가져오면 이 자동 충돌 해결이 안 통한다 — 좌표가 달라서 "같은 좌표 충돌"이 아니기 때문이다. 그게 R8까지 흘러가서 *Duplicate class* 에러로 터진다.

Kotlin 1.8.0 릴리스 노트는 이 위험을 명시적으로 경고한다:

> **"Note that mixing different versions of stdlib artifacts could lead to class duplication or to missing classes. To avoid that, the Kotlin Gradle plugin can help you align stdlib versions."**

cooking-assistant는 Kotlin Gradle Plugin을 안 쓰는(=Unity가 만든 Java/Android Gradle 프로젝트인) 환경이라 **수동 force가 필요**했다.

---

# 4. 역사적 기원 / 진화 타임라인

## 4.1 Unity StreamingAssets / Android 자산 시스템 합본 연표

| 연도 | 사건 |
|------|-----|
| 2008 | Android 1.0 — `AssetManager` API 1부터 존재 |
| 2010 | Unity 3.0 — Android 빌드 추가, **StreamingAssets**가 모바일에서 본격 사용 / Android 2.2 — `AssetManager.open(..., ACCESS_STREAMING/RANDOM/BUFFER)` 모드 |
| 2014 | Unity 4.6 — `Application.streamingAssetsPath` API |
| 2017 | Unity 2017 — `UnityWebRequest` 도입, jar:file:// 자동 처리 (이전엔 `WWW`) |
| 2018 | Unity 2018.2 — **Addressables** 도입 (StreamingAssets/Resources 대체 권고) / Android App Bundle 정식 |
| 2019 | Android API 30 — Scoped Storage 강제, external StreamingAssets 접근 어려워짐 |
| 2020 | Unity 2020 — Android Play Asset Delivery 통합 (install-time/fast-follow/on-demand 일반 가용) |
| 2023 | Unity 2023.2 — Awaitable 도입, StreamingAssets 비동기 패턴 단순화 |

## 4.3 Kotlin stdlib 분기/병합 — 이번 사건의 핵심 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│              Kotlin stdlib 가족의 10년 변천사                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2016.02   Kotlin 1.0                                            │
│            └── 단일 kotlin-stdlib (JDK 6+ 호환)                  │
│                                                                  │
│  2017.11   Kotlin 1.2                                            │
│            ├── kotlin-stdlib              (JDK 6+ baseline)      │
│            ├── kotlin-stdlib-jdk7         (Try-with-resources    │
│            │                               확장, JDK 7+)         │
│            └── kotlin-stdlib-jdk8         (Streams API 확장,    │
│                                            java.time, JDK 8+)   │
│                                                                  │
│  2017      kotlin-stdlib-jre7/jre8 (구이름) → jdk7/jdk8 개명     │
│                                                                  │
│  2018      Kotlin Multiplatform 본격화                           │
│            └── kotlin-stdlib-common (KMP 공통 선언)              │
│                                                                  │
│  2021.05   Kotlin 1.5                                            │
│            └── jdk7/jdk8 contents가 stdlib에 함께 포함되기       │
│                시작 (호환성 위해 빈 artifact는 유지)             │
│                                                                  │
│  2022.06   Kotlin 1.7                                            │
│            └── JDK 6 지원 종료, JDK 8 baseline                   │
│                                                                  │
│  ── 2022.12  Kotlin 1.8.0 ────────────────────────────────────── │
│                                                                  │
│   "Kotlin 1.8.0 no longer supports JVM targets 1.6 and 1.7.     │
│    As a result, you no longer need to declare                   │
│    kotlin-stdlib-jdk7 and kotlin-stdlib-jdk8 separately in      │
│    build scripts because the contents of these artifacts        │
│    have been merged into kotlin-stdlib."                        │
│                                                                  │
│            ├── kotlin-stdlib              (모든 것을 포함)       │
│            ├── kotlin-stdlib-jdk7         (compatibility shim)   │
│            └── kotlin-stdlib-jdk8         (compatibility shim)   │
│                                                                  │
│            ⚠️  release notes 경고:                                │
│            "mixing different versions of stdlib artifacts        │
│             could lead to class duplication or to missing        │
│             classes."                                            │
│                                                                  │
│  2023~     라이브러리 생태계가 따라가는 데 1~2년                 │
│            transitive로 옛 jdk7/jdk8 1.7.x를 끌어오는            │
│            라이브러리가 잔존                                     │
│                                                                  │
│  2025      Kotlin 2.x 시대                                       │
│            cooking-assistant 시점: 2026.05                       │
│            └── sherpa-onnx, silero, Azure가 각각 다른 transitive │
│                Kotlin 버전 → cooking-assistant가 1.8.22로 수동   │
│                정렬                                              │
└─────────────────────────────────────────────────────────────────┘
```

cooking-assistant가 1.8.22를 택한 이유는 추정컨대: (a) 1.8 라인이 jdk7/jdk8 병합 경계의 첫 안정 버전이라 호환성이 가장 넓다, (b) 너무 최신(2.x)을 강제하면 Azure SDK의 검증된 buildscript가 깨질 수 있다, (c) Unity 6.0.x가 내부적으로 사용하는 Kotlin 호환 범위와 일치한다.

## 4.4 Unity Android Gradle 템플릿 lineage

| 연도 | 사건 |
|------|-----|
| 2013 | Unity 4.x — Android 빌드는 ADT/Ant 기반, Gradle 없음 |
| 2017 | Unity 2017.2 — **Android Gradle 빌드 시스템 도입**, `mainTemplate.gradle`만 (단일 모듈) |
| 2018 | Unity 2018.3 — `launcherTemplate.gradle` 추가, **unityLibrary + launcher 2-모듈 구조로 전환** (Android Studio 표준 정렬) |
| 2019 | Unity 2019.3 — `baseProjectTemplate.gradle` + `gradleTemplate.properties` 분리 |
| 2020 | Unity 2020 — `settingsTemplate.gradle` 추가 |
| 2024 | Unity 6.0 — Gradle 8.x, AGP 8.x, Java 17 toolchain |

cooking-assistant는 Unity 6000.3.14f1 사용. mainTemplate + launcherTemplate 분리 구조의 모든 함정에 노출.

---

# 5. 핵심 깊이 분석 A — Unity StreamingAssets 경로 매트릭스

## 5.1 플랫폼별 streamingAssetsPath / dataPath 매트릭스

| 플랫폼 | `Application.dataPath` | `Application.streamingAssetsPath` | 파일 접근 |
|--------|------------------------|-----------------------------------|---------|
| **Editor** | `<project>/Assets` | `<project>/Assets/StreamingAssets` | `File.Read*` 직접 |
| **Standalone Windows** | `<game>_Data` | `<game>_Data/StreamingAssets` | `File.Read*` 직접 |
| **Standalone Linux** | `<game>_Data` | `<game>_Data/StreamingAssets` | `File.Read*` 직접 |
| **Standalone macOS** | `<App>.app/Contents/Resources/Data` | `<App>.app/Contents/Resources/Data/StreamingAssets` | `File.Read*` 직접 |
| **iOS** | `<bundle>/Data` | `<bundle>/Data/Raw` | `File.Read*` 직접 (앱 번들 내부) |
| **Android (APK)** | `/data/app/.../base.apk` | `jar:file:///data/app/.../base.apk!/assets` | **`UnityWebRequest`** 또는 **AssetManager (Java)** |
| **WebGL** | `https://<host>/<build>` | `https://<host>/<build>/StreamingAssets` | **`UnityWebRequest` 만** (브라우저 fetch) |

Unity 매뉴얼 발췌:

> "On Android and Web platforms, it's impossible to access the streaming asset files directly via file system APIs because these platforms return a URL. Use UnityWebRequest to access the content instead."

## 5.2 `bin/Data/`가 어디서 새어 나왔나 (cooking-assistant의 흔적 추적)

Standalone 빌드 디렉토리 내부 구조 (Windows 기준):

```
MyGame/
├── MyGame.exe
└── MyGame_Data/                        ← Application.dataPath
    ├── Managed/                        ← C# DLL
    ├── Resources/
    ├── il2cpp_data/
    ├── StreamingAssets/                ← Application.streamingAssetsPath
    │   └── SherpaOnnx/...
    └── ...
```

macOS 번들:

```
MyGame.app/
└── Contents/
    └── Resources/
        └── Data/                       ← Application.dataPath
            └── StreamingAssets/        ← streamingAssetsPath
```

**그렇다면 `bin/Data/`는 어디 출신인가?** Unity의 *Mono debug build* 또는 *script-only build* 임시 디렉토리 구조를 추적하면, IL2CPP 변환 전 임시 산출물이 `Library/Bee/...` 또는 `Temp/StagingArea/...` 하위에 `bin/Data/` 형태로 잠시 존재하는 흔적이 있다. cooking-assistant의 1차 코드는 아마도 *Editor에서 bin/Data 경로로 파일을 가져온 디버깅 코드* 또는 *Mono build 산출물에 박혀 있던 경로*를 그대로 SerializeField 기본값으로 굳혀 둔 것으로 추정된다 — 검증할 길은 없지만 흔적은 그쪽을 가리킨다.

핵심은: **`bin/Data/`는 어떤 정상 산출물 경로에서도 등장하지 않는다.** Editor에서는 `<project>/Assets/StreamingAssets/`, Standalone에서는 `<game>_Data/StreamingAssets/`, Android에서는 `assets/`. 어느 플랫폼에서도 `bin/Data/StreamingAssets/...`를 그대로 쓸 수는 없다. 1차 코드의 Tooltip이 *"AssetManager-relative"*라고 명시한 것과 기본값이 충돌한 것이 결정적 단서.

## 5.3 Android에서 StreamingAssets에 접근하는 두 가지 정공법

**방법 (a)** — C# 측에서 `UnityWebRequest`. jar URL 자동 처리, 비동기, 작은 텍스트/JSON에 적합:

```csharp
string url = Application.streamingAssetsPath + "/SherpaOnnx/sense-voice/tokens.txt";
using var req = UnityWebRequest.Get(url);
await req.SendWebRequest();
if (req.result == UnityWebRequest.Result.Success)
    bytes = req.downloadHandler.data;
```

**방법 (b)** — Java/Kotlin 측에서 `AssetManager`. 네이티브 라이브러리(JNI)가 file path 요구할 때, 큰 바이너리(>100MB)에 적합. cooking-assistant가 채택:

```csharp
// C# (Unity)
string assetPath = "SherpaOnnx/sense-voice/model.int8.onnx";
new AndroidJavaClass("com.example.MyService").CallStatic("loadModel", assetPath);
```
```java
// Java
InputStream is = context.getAssets().open(assetPath);
// 큰 모델은 noBackupFilesDir로 복사 후 sherpa에 절대경로 전달
```

cooking-assistant가 (b)를 택한 이유: sherpa-onnx JNI가 `OfflineRecognizer.newFromFile(modelPath, tokensPath)` API라 file system path 필요. AssetManager에서 InputStream으로 직접 받는 newFromAssets 변종도 있지만, *권장 흐름은 noBackupFilesDir에 한 번 복사 후 절대경로 전달*. 첫 실행 1~2초 추가되지만 이후 캐시.

## 5.4 Unity → Java로 경로를 넘길 때의 약속

핵심 원칙: **C# 측이 보유한 경로 문자열은 항상 AssetManager-relative 형태로 통일한다.** Editor용 디버깅이 필요하면 *별도의 Editor-only 분기*에서 prefix를 합성하지, 기본값에 박지 않는다.

```csharp
#if UNITY_EDITOR
    // Editor에서 동일 파일을 직접 검증하고 싶을 때
    string editorPath =
        Path.Combine(Application.streamingAssetsPath, m_LocalSherpaModelPath);
    Debug.Log($"[Editor] checking local model at {editorPath}");
#endif

#if UNITY_ANDROID && !UNITY_EDITOR
    // 실제 런타임에서는 그대로 Java로
    var jc = new AndroidJavaClass("com.example.MyService");
    jc.CallStatic("initRecognizer", m_LocalSherpaModelPath);
#endif
```

cooking-assistant의 fix가 정확히 이 형태 — *C# 측 기본값을 정답으로 정렬* + *Java 측에서 옛 prefix tolerance*. 두 환경 모두에서 안전하다.

---

# 6. 핵심 깊이 분석 B — APK assets/ 내부 mechanic

## 6.1 `unzip -l app.apk` 결과 예시

```
Archive:  base.apk
  Length    Name
---------  ----
     1532  AndroidManifest.xml
   234521  classes.dex
   523412  resources.arsc
   234567  res/raw/big_data.bin
     2048  assets/SherpaOnnx/sense-voice/tokens.txt
239234567  assets/SherpaOnnx/sense-voice/model.int8.onnx
  1834234  assets/silero/silero_vad.onnx
 18234212  lib/arm64-v8a/libsherpa-onnx-jni.so
 92341234  lib/arm64-v8a/libonnxruntime.so
  4523012  lib/arm64-v8a/libunity.so
```

## 6.2 압축 정책과 mmap

APK 빌드는 기본적으로 모든 파일을 ZIP DEFLATE 압축. 다만 `.jpg/.png/.mp3/.mp4/.webm` 등 미디어 확장자는 기본 `noCompress`. `.onnx`는 목록에 없어서 압축 대상 — 그래서 cooking-assistant는 `aaptOptions { noCompress 'onnx' }` 추가가 권장된다. 압축돼 있으면 mmap 불가 + 매번 zlib decompression으로 모델 로드 지연. 압축 해제하면 APK 크기는 커지지만 INT8 양자화 모델은 추가 압축 효과 미미해서 사실상 무손해.

## 6.3 AssetManager 내부 동작 의사코드

```cpp
// AssetManager가 zip entry를 다루는 흐름 (의사코드)
class AssetManager {
    ZipArchiveHandle apk_handle_;        // /data/app/.../base.apk

    InputStream open(const std::string& path) {
        // path = "SherpaOnnx/sense-voice/model.int8.onnx"
        std::string full = "assets/" + path;  // ← 이 prefix를 자동으로 붙임

        ZipEntry entry;
        if (!FindEntry(apk_handle_, full, &entry)) {
            throw FileNotFoundException(path);
        }

        if (entry.method == kCompressDeflated) {
            return new InflatingInputStream(apk_handle_, entry);
        } else {
            // noCompress인 경우 — mmap-friendly
            return new MappedInputStream(apk_handle_, entry);
        }
    }
};
```

cooking-assistant의 1차 버그는 정확히 다음으로 귀결된다:

```cpp
// 사용자가 넘긴 path = "bin/Data/StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx"
std::string full = "assets/" + path;
// full = "assets/bin/Data/StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx"
// → APK에는 그런 zip entry가 없음
// → FindEntry returns false
// → FileNotFoundException
```

## 6.4 res/raw vs assets — 왜 모델은 assets인가

| 항목 | `res/raw/` | `assets/` |
|------|-----------|-----------|
| 접근 API | `R.raw.xxx` (컴파일 타임 상수) | `getAssets().open(path)` (런타임 문자열) |
| 디렉토리 구조 | **불가** (flat만) | **가능** |
| 파일명 | 소문자 + 영숫자만 | 자유 |
| 확장자 | 보존 안 됨 | 보존 |
| 로케일 분기 | 가능 (`raw-ko/`) | 가능 (`assets-ko/` 같은 직접 구조) |
| 동적 추가 | 불가 (resources.arsc 컴파일됨) | 불가 (둘 다 빌드 타임) |
| 적합 | 알람음, 폰트, 게임 sfx | **모델, 사전, 외부 데이터** |

Unity StreamingAssets는 모두 `assets/` 하위로 매핑된다. `res/raw/`는 안 쓴다. 디렉토리 구조 보존이 필요하기 때문 (`SherpaOnnx/sense-voice/...`).

---

# 7. 핵심 깊이 분석 C — Kotlin stdlib duplicate-class collision

## 7.1 의존성 그래프 시각화

```
┌─────────────────────────────────────────────────────────────────┐
│     cooking-assistant Android 의존성 그래프 (force 이전)          │
├─────────────────────────────────────────────────────────────────┤
│  launcher  (launcherTemplate.gradle, R8 enabled)                 │
│    └── implementation project(':unityLibrary')                   │
│         │                                                         │
│  unityLibrary  (mainTemplate.gradle)                              │
│    ├── Azure Speech 1.42.0 ──────────► kotlin-stdlib 1.7.x       │
│    ├── kotlin-stdlib-jdk8 1.8.22 ────► kotlin-stdlib 1.8.22      │
│    ├── silero-2.0.10 (AAR) ──────────► kotlin-stdlib-jdk7 1.6.x  │
│    └── sherpa-onnx-android 1.10.x ───► kotlin-stdlib-jdk8 1.7.x  │
│                                                                   │
│  R8 입력 classpath에 동일 FQCN 중복:                              │
│    kotlin/jvm/internal/Intrinsics.class    × 2 (1.7.x, 1.8.22)   │
│    kotlin/collections/CollectionsKt.class  × 2                    │
│    kotlin/streams/jdk8/StreamsKt.class     × 2 (stdlib + jdk8)   │
│                                                                   │
│  R8 결과: "Duplicate class kotlin.jvm.internal.Intrinsics        │
│           found in modules kotlin-stdlib-1.7.x and ...-1.8.22"   │
│  BUILD FAILED                                                     │
└─────────────────────────────────────────────────────────────────┘
```

force 적용 후: 4종 좌표(`stdlib`, `stdlib-common`, `stdlib-jdk7`, `stdlib-jdk8`) 모두 1.8.22로 강제 정렬. 같은 좌표/같은 버전 = Gradle이 단일 jar로 해결, 같은 클래스/같은 버전 = R8 dedup 가능. BUILD SUCCESS.

## 7.3 Duplicate class 에러 메시지 형태

```
> Task :launcher:checkReleaseDuplicateClasses FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':launcher:checkReleaseDuplicateClasses'.
> A failure occurred while executing
  com.android.build.gradle.internal.tasks.CheckDuplicatesRunnable
   > Duplicate class kotlin.collections.jdk8.CollectionsJDK8Kt found in
     modules kotlin-stdlib-1.7.20 (org.jetbrains.kotlin:kotlin-stdlib:1.7.20)
     and kotlin-stdlib-jdk8-1.6.21 (org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.6.21)
     Duplicate class kotlin.internal.jdk7.JDK7PlatformImplementations found in
     modules kotlin-stdlib-1.8.0 (org.jetbrains.kotlin:kotlin-stdlib:1.8.0)
     and kotlin-stdlib-jdk7-1.7.20 (org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.7.20)
     Duplicate class kotlin.jvm.internal.Intrinsics$Kotlin found in
     modules ...
     ... (수십 개)

     Go to the documentation to learn how to <a
     href="https://developer.android.com/studio/build/dependencies#duplicate_classes">
     Fix dependency resolution errors</a>.
```

핵심 단서: `kotlin.collections.jdk8.CollectionsJDK8Kt`처럼 *jdk7/jdk8 패키지 내부 클래스가 stdlib에도 있고 stdlib-jdk8에도 있다*는 형태. 이게 Kotlin 1.5에서 시작된 병합의 실 흔적이다.

## 7.4 왜 `checkDuplicateClasses` 태스크는 release에서만 도는가

R8은 release variant의 `minifyEnabled true`에서만 활성화된다. Debug 빌드는 `minifyEnabled false`라서 D8만 돌고, D8은 dedup 정책이 더 관대하다 (마지막 wins로 silently 처리하기도 함). 그래서 **debug에서는 잘 돌다가 release/Play Store 빌드에서만 터지는 형태**가 된다. cooking-assistant 커밋 메시지의 *"Align Kotlin stdlib artifacts to avoid duplicate-class release builds"* 라는 표현이 이걸 정확히 가리킨다.

CI에서 release 빌드를 정기적으로 돌리지 않으면 이런 함정은 데모 직전에 폭발한다. cooking-assistant도 *"Not-tested: Android XR on-device speech after this follow-up build"* 로 명시한 점에서 release 빌드 검증이 일상화 안 됐을 가능성을 시사한다.

---

# 8. Kotlin stdlib 충돌 해결법 4가지 비교

| 방법 | 메커니즘 | 장점 | 단점 | cooking-assistant 적합성 |
|------|---------|------|------|----------------------|
| **resolutionStrategy.force** | 모든 변형을 한 버전으로 강제 핀 | 단순, 즉시 효과, Gradle DSL 표준, 모든 AGP 버전 호환 | 좌표 4개를 다 적어야 함, 새 좌표 등장 시 leak | ✅ **채택됨** |
| **dependencyConstraints** | `constraints { ... }` 블록으로 transitive에만 권고/강제 | resolution 의도가 더 명확, BOM-friendly | Groovy DSL 더 verbose, AGP 4+ 필요, 직접 의존엔 적용 안 됨 | ✅ 적합하지만 더 verbose |
| **enforcedPlatform (BOM)** | `implementation enforcedPlatform('org.jetbrains.kotlin:kotlin-bom:1.8.22')` 한 줄로 패밀리 일괄 핀 | 가장 간결, 한 줄로 모든 Kotlin artifact 정렬 | Kotlin BOM 존재/품질 확인 필요, BOM이 모든 변형 커버하는지 의존 | ✅ 가장 깔끔 — 채택 안 한 건 아마 검증 부족 |
| **exclude group/module** | `implementation('foo') { exclude group: 'org.jetbrains.kotlin' }` | force 안 써도 됨 | 누락 시 NoClassDefFoundError 런타임 폭발, 매 의존성마다 적어야 함 | ❌ 위험 — sherpa-onnx의 Kotlin 코드가 stdlib 필요 |

## 8.1 각 방법의 코드 비교

```gradle
// (a) resolutionStrategy.force — cooking-assistant 채택
configurations.configureEach {
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-common:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
    resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
}

// (b) dependencyConstraints — Gradle 6+ 권장 패턴
dependencies {
    constraints {
        implementation('org.jetbrains.kotlin:kotlin-stdlib:1.8.22') {
            because 'Align all Kotlin stdlib transitive deps for R8'
        }
        implementation('org.jetbrains.kotlin:kotlin-stdlib-common:1.8.22')
        implementation('org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22')
        implementation('org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22')
    }
}

// (c) enforcedPlatform (Kotlin BOM) — 가장 간결
dependencies {
    implementation enforcedPlatform('org.jetbrains.kotlin:kotlin-bom:1.8.22')
    implementation 'org.jetbrains.kotlin:kotlin-stdlib'
    implementation 'org.jetbrains.kotlin:kotlin-stdlib-jdk8'
}

// (d) exclude — 안티패턴 (NoClassDefFoundError 위험)
dependencies {
    implementation('com.k2fsa.sherpa.onnx:sherpa-onnx-android:1.10.x') {
        exclude group: 'org.jetbrains.kotlin'
    }
}
```

**force vs constraints**: force는 "무조건 이 버전으로 override", constraints는 "권고를 강제로 격상"(직접/transitive 모두). force는 어느 Configuration에서도 일관, blast radius가 명확. constraints는 `because`로 의도를 코드에 명시 가능하고 BOM-friendly. **enforcedPlatform**은 한 줄로 패밀리 일괄 핀 — cooking-assistant가 이걸 안 쓴 이유는 추정컨대 (i) Unity Gradle 템플릿에서의 BOM 동작 검증 부담, (ii) force 4줄이 문서 의도를 더 명확히 보여줌, (iii) 외부 의존성 추가 회피. **exclude는 위험** — sherpa-onnx의 내부 Kotlin 코드는 어떤 버전이든 stdlib이 필요. 다 exclude하면 런타임 `NoClassDefFoundError: kotlin/jvm/internal/Intrinsics`로 죽는다. 단일 충돌 라이브러리만 정확히 exclude해서 다른 한쪽이 stdlib을 제공하게 두는 미세 조정은 가능하지만 유지보수성 0.

---

# 9. StreamingAssets 액세스 결정 매트릭스

| 시나리오 | 권장 방법 | 근거 |
|---------|----------|------|
| 작은 텍스트/JSON, **모든 플랫폼** | `UnityWebRequest.Get(streamingAssetsPath + path)` | jar URL 자동 처리, async, 짧은 코드 |
| 큰 모델 (>50MB), **Android 한정** | Java AssetManager → `noBackupFilesDir` 복사 → 절대경로 | 네이티브가 file path 요구, 한 번 복사 후 캐시 |
| 큰 모델, **iOS** | `Application.streamingAssetsPath + path`로 직접 file path | 앱 번들 내 일반 파일 |
| 큰 모델, **WebGL** | `UnityWebRequest` 스트리밍 + IndexedDB 캐시 | 다른 옵션 없음 |
| 동적 다운로드 | **Addressables + 원격 CDN** 또는 Play Asset Delivery | StreamingAssets는 빌드 타임 고정 |
| Quest/PC VR | StreamingAssets OK, 100MB+여도 무난 | 디스크 풍족 |
| Android XR (Galaxy XR 등) | **Play Asset Delivery 권장**, 단 LFS quota 위험 동반 | install-time pack으로 분리 |
| Editor 디버깅 | `Application.streamingAssetsPath` + `File.ReadAllBytes` | 직접 파일 접근 |

cooking-assistant의 현재 선택은 *Java AssetManager → noBackupFilesDir 복사 → sherpa-onnx에 절대경로*. 합리적이지만 228MB 모델을 첫 실행 시 한 번 복사하는 ~2초 비용을 받아들였다. Play Asset Delivery로 옮기면 (a) APK 본체 100MB 제한 회피, (b) install-time pack은 시스템이 OBB-style 디렉토리에 풀어서 file path 직접 사용 가능, (c) on-demand pack은 모델을 처음 호출 시 다운로드 — 라는 장점이 있지만 빌드/배포 파이프라인이 복잡해진다. 현재 상태에서는 *충분*.

---

# 10. 핵심 깊이 분석 D — 왜 mainTemplate / launcherTemplate 둘 다 force가 필요한가

## 10.1 Unity Android Gradle 모듈 구조

```
┌─────────────────────────────────────────────────────────────────┐
│      Unity가 export한 Android Gradle 프로젝트 구조                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  android/                                                        │
│  ├── build.gradle              ← baseProjectTemplate            │
│  ├── settings.gradle           ← settingsTemplate                │
│  │     include ':launcher', ':unityLibrary'                     │
│  ├── gradle.properties         ← gradleTemplate.properties       │
│  ├── unityLibrary/             (= 모듈 1 :unityLibrary)         │
│  │   └── build.gradle          ← mainTemplate.gradle             │
│  │       · apply plugin: 'com.android.library'                  │
│  │       · Unity 엔진 .aar/.so                                  │
│  │       · 사용자 native plugins                                 │
│  │       · 사용자 의존성 (sherpa, silero, Azure)                │
│  │       · minifyEnabled false (보통)                           │
│  └── launcher/                 (= 모듈 2 :launcher)             │
│      └── build.gradle          ← launcherTemplate.gradle         │
│          · apply plugin: 'com.android.application'              │
│          · implementation project(':unityLibrary')              │
│          · signingConfigs                                        │
│          · buildTypes.release { minifyEnabled true }            │
│          · APK/AAB 패키징                                        │
│                                                                  │
│  AGP variant 그래프:                                             │
│  :launcher (release)                                             │
│    └─ depends on :unityLibrary (release)                         │
│       └─ depends on com.k2fsa..., kotlin-stdlib, ...             │
│                                                                  │
│  R8/D8은 :launcher가 본 *전체 transitive classpath*에 동작.      │
└─────────────────────────────────────────────────────────────────┘
```

## 10.2 한쪽에만 force 적용하면 어떻게 되나

`mainTemplate`에만 force가 있으면 `:unityLibrary`의 resolutionStrategy만 작용한다. `:launcher`는 `implementation project(':unityLibrary')`로 unityLibrary의 그래프를 받지만, **launcher 자체의 Configuration은 별도로 conflict resolution을 수행**한다. launcher의 `releaseRuntimeClasspath`가 unityLibrary export 의존을 재해결하면서 transitive Kotlin 버전이 잠재적으로 다시 섞이고, R8 단계에서 duplicate class. 이게 *debug에서는 안 보이고 release에서만 터지는* 패턴의 본질적 이유 — release에서만 `:launcher`가 `minifyEnabled true`로 R8을 돌린다.

cooking-assistant가 두 파일에 동일 force를 박은 것은 **Gradle의 모듈별 Configuration이 독립적으로 conflict resolution을 수행**한다는 사실을 정면으로 인정한 결과다. baseProjectTemplate에 `subprojects { configurations.configureEach { ... } }`를 한 번 적는 것도 가능하지만, Unity baseProjectTemplate 활성화는 다른 Unity 빌드 옵션 변경에 부수효과가 커서 모듈별로 4줄씩 박는 보수적 선택이 더 안전하다.

## 10.3 Unity Gradle 모듈 이력 — 왜 launcher가 분리됐나

Unity 2017까지는 단일 모듈이었다. 2018.3에서 `launcher` 모듈을 분리한 이유:

1. **Android Studio 표준 정렬**: Android Studio가 권장하는 multi-module 구조에 맞춤
2. **AAB 빌드 일관성**: launcher가 application 모듈, unityLibrary가 library 모듈 — Android App Bundle의 base/feature 분리 모델과 일치
3. **ProGuard/R8 분리**: 코드 축소를 application 레벨에서만 적용하는 표준 패턴
4. **Multi-app 지원 가능성**: 같은 Unity 코드를 여러 launcher로 빌드하는 미래 시나리오 (실제로는 잘 안 씀)

이 분리의 결과로 **Gradle 의존성 정책을 두 곳에서 관리**해야 하는 부담이 새로 생겼고, cooking-assistant가 정확히 그 함정을 만났다.

---

# 11. 베스트 프랙티스 / 안티패턴

## 11.1 StreamingAssets 다루기

**원칙**: C# 측 경로는 무조건 **AssetManager-relative**(예: `"SherpaOnnx/sense-voice/model.int8.onnx"`). 플랫폼 분기는 *경로 정의*가 아니라 *접근* 단계에서 한다. Editor 절대경로나 `bin/Data/...` prefix를 SerializeField 기본값에 박는 순간 한 플랫폼에서만 동작한다. Java 측은 옛 prefix tolerance helper(`resolveReadableAssetPath` 패턴)를 둬서 굳어 있는 옛 prefab 데이터/외부 컨피그도 살린다.

큰 모델은 한 번 복사 + length 검증 캐시:

```java
File target = new File(context.getNoBackupFilesDir(), assetPath);
if (target.exists() && target.length() > 0) return target;
try (InputStream is = context.getAssets().open(readableAssetPath);
     FileOutputStream os = new FileOutputStream(target)) {
    byte[] buf = new byte[1024 * 1024]; int n;
    while ((n = is.read(buf)) > 0) os.write(buf, 0, n);
}
return target;
```

`getNoBackupFilesDir()`는 Auto Backup 50MB 제한 무관. 100MB+ 모델은 **Play Asset Delivery 또는 Addressables 원격** 권장 — install-time pack은 시스템이 풀어줘서 file path 직접 사용 가능, 원격은 LFS quota 회피 + 모델 swap 가능. cooking-assistant 향후 마이그레이션 경로. 자세한 trade-off는 [`devops/git-lfs-pointer-빌드함정.md`](../devops/git-lfs-pointer-빌드함정.md)와 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md).

### 안티패턴

| 안티패턴 | 증상 | 정답 |
|---------|------|------|
| `bin/Data/...` prefix 사용 | Android에서 FileNotFoundException | prefix 제거 (cooking-assistant fix) |
| Editor 절대경로 SerializeField 기본값 | Editor만 동작 | AssetManager-relative |
| Android에서 `File.ReadAllBytes(streamingAssetsPath + ...)` | "file not found" | `UnityWebRequest` 또는 AssetManager |
| 큰 모델을 매 실행 복사 | 시작 2초 지연 | length 검증 캐시 |
| 100MB+ 모델을 StreamingAssets 그대로 | APK 비대, LFS quota | PAD / Addressables |
| C#/Java 경로 정의 양쪽에 다른 형식 | 한쪽 변경 시 다른 쪽 깨짐 | C# 단일 source + Java tolerance |

## 11.2 Native Plugin / AAR 다루기

**원칙**: AAR을 `Plugins/Android/`에 그냥 던지지 말고 `mainTemplate.gradle`에 explicit `implementation`으로 적는다 (transitive resolution 활성). Kotlin stdlib / androidx / Guava 같은 충돌 잘 나는 좌표는 force로 명시 핀, **mainTemplate + launcherTemplate 양쪽에 일관 적용**(한쪽만 적용하면 release에서만 깨짐). CI에서 `:launcher:assembleRelease`를 정기 실행해 R8 함정을 조기 발견. 의존성이 5개를 넘기면 EDM4U 검토 — Google 공식 Unity 패키지로 `*Dependencies.xml` 선언 → mainTemplate 자동 patch + 충돌 자동 해결.

### 안티패턴

| 안티패턴 | 증상 | 정답 |
|---------|------|------|
| AAR을 Plugins/Android에 던지고 끝 | NoClassDefFoundError | explicit implementation |
| `mainTemplate`만 force, `launcherTemplate` 안 건드림 | **debug OK, release만 실패** | 둘 다 force |
| force 4줄 중 하나 누락 (예: `-common` 빠짐) | 일부 클래스만 충돌 — 메시지 misleading | 4종 다 force |
| `exclude group: 'org.jetbrains.kotlin'` 남발 | 런타임 NoClassDefFoundError | force 권장 |
| AAR 업그레이드 후 force 버전 동결 | 새 AAR이 더 신 stdlib 요구 → 충돌 | force 버전 정기 업데이트 |
| `assembleRelease` CI 미실시 | 배포 직전 폭발 | release variant CI 의무화 |

---

# 12. 빅테크 / 산업 사례

**Meta XR (Quest/Horizon OS)**: Meta XR Plugin (`com.meta.xr.sdk.all`)은 mainTemplate.gradle을 직접 patch하지 않고 Unity PlayerSettings + 자체 OVRGradleGeneration 후처리로 해결. AAR 의존성(facebook-android-sdk, androidx.security:security-crypto, 자체 sysroot AAR)을 `<package>/Runtime/Plugins/Android/`에 두고 PostProcessBuild attribute로 manifest 병합과 ProGuard 룰 자동 주입. 의존성이 늘어나면 이 후처리 패턴이 참고가 된다.

**Niantic Lightship / Pokemon GO**: Unity + 대규모 native plugin 운영의 대표 사례. mainTemplate.gradle 직접 수정 없이 EDM4U로 ARDK AAR + Google Play Services Vision + AR Core를 자동 해결. 월 1억+ MAU 스케일에서는 Unity 빌드 결정론이 무엇보다 중요해서 EDM4U 같은 자동화가 필수. 작은 팀(cooking-assistant)은 의존성 4~5개면 수동 force가 더 단순.

**Google ARCore Unity SDK**: EDM4U(옛 Play Services Resolver)의 reference customer. `Editor/ARCoreDependencies.xml`에 의존성을 선언:

```xml
<dependencies>
  <androidPackages>
    <androidPackage spec="com.google.ar:core:1.42.0">
      <repositories><repository>https://maven.google.com/</repository></repositories>
    </androidPackage>
  </androidPackages>
</dependencies>
```

EDM4U가 이 XML을 읽어 mainTemplate.gradle에 자동 추가. **EDM4U의 핵심 가치 = "Unity 패키지 작성자가 Android 의존성을 선언적으로 표현"**. cooking-assistant가 안 쓴 건 의존성이 직접 통제되는 5개 미만이라 *XML 한 단계*보다 *gradle 직접 작성*이 더 빠르기 때문.

**Unity 공식 Gradle 권고 흐름**: (1) 가능하면 Custom Gradle Template 활성화하지 마라(stale 위험), (2) 어쩔 수 없으면 mainTemplate부터, (3) minify/signing 이슈는 launcherTemplate, (4) 둘 다 안 풀리면 baseProjectTemplate, (5) 그 위는 EDM4U 또는 Gradle Project Export → Android Studio. cooking-assistant는 (2)+(3) 단계. 의존성이 더 늘면 EDM4U 또는 Android Studio export로 escalate.

**DashVoice (Home Assistant + sherpa-onnx Android XR)**: cooking-assistant와 매우 유사한 통합 패턴. README에서 *"Use AssetManager.open() with paths relative to assets/, not Unity's StreamingAssets prefix"*라고 명시 — 같은 함정에 다른 프로젝트도 빠진다는 증거.

---

# 13. 회피 시나리오 — 이 두 함정을 처음부터 안 만나는 법

## 13.1 신규 Unity Android 프로젝트 셋업 체크리스트

- [ ] Player Settings → Custom mainTemplate / launcherTemplate **둘 다 ON**
- [ ] StreamingAssets 경로는 AssetManager-relative (예: `"models/foo.onnx"`, NOT `"bin/Data/StreamingAssets/..."`)
- [ ] Java 측에 옛 prefix tolerance helper (옛 컨피그/prefab 호환)
- [ ] mainTemplate에 native 의존성 explicit `implementation`
- [ ] mainTemplate + launcherTemplate **양쪽**에 `configurations.configureEach { resolutionStrategy.force ... }`로 Kotlin stdlib 4종 핀
- [ ] CI에서 `:launcher:assembleRelease` 정기 실행 (R8 함정 조기 발견)
- [ ] `noCompress 'onnx'` 등 큰 바이너리 압축 해제로 mmap 가능
- [ ] Play Asset Delivery 가능성 미리 검토 (>100MB 모델 보유 시)

## 13.2 트러블슈팅 cheat sheet

| 증상 | 의심 위치 | 확인 명령 |
|------|---------|---------|
| Android에서 "file not found" | StreamingAssets 경로에 prefix 박힘 | `unzip -l app.apk \| grep <path>` |
| `FileNotFoundException` from AssetManager | path가 `assets/` 시작점 기준 아님 | adb shell + AAB / APK inspector |
| Editor OK, Android 실패 | 경로 정의 vs 접근 분리 안 됨 | `Application.streamingAssetsPath` 출력 비교 |
| `Duplicate class kotlin.*` | Kotlin stdlib 충돌 | `./gradlew :launcher:dependencies --configuration releaseRuntimeClasspath \| grep kotlin` |
| `NoClassDefFoundError: kotlin/jvm/internal/...` | exclude 과다 | exclude 제거하고 force 사용 |
| debug OK, release만 실패 | R8 단계 충돌 | `./gradlew :launcher:checkReleaseDuplicateClasses` |
| 모델 로드가 매 실행 느림 | 매번 asset → file 복사 | length 기반 캐시 추가 |

## 13.3 Gradle 의존성 트리 검사 명령

```bash
# 어느 라이브러리가 어떤 Kotlin 버전을 끌고 오는지
./gradlew :launcher:dependencies --configuration releaseRuntimeClasspath \
    | grep -A 1 -B 1 kotlin

# 출력 예
# +--- com.k2fsa.sherpa.onnx:sherpa-onnx-android:1.10.0
# |    \--- org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.7.20 -> 1.8.22 (forced)
# +--- (project) :unityLibrary
# |    +--- org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22 (forced)
# |    \--- ...
```

`-> 1.8.22 (forced)` 표시가 force가 작동했음을 보여준다. 이게 안 보이면 force가 적용 안 된 Configuration이 있다는 뜻.

---

# 14. 교차 참조

| 문서 | 관련성 |
|------|-------|
| [`xr/unity-게임엔진-완전가이드.md`](unity-게임엔진-완전가이드.md) | StreamingAssets, AssetBundle, Addressables 일반 개요. 본 문서는 Android 한정 함정 |
| [`xr/openxr-크로스플랫폼XR표준.md`](openxr-크로스플랫폼XR표준.md) | Android XR 빌드 컨텍스트 |
| [`mobile/android-os-시스템특성.md`](../mobile/android-os-시스템특성.md) | APK 구조, AAPT2, Linker, R8/D8 OS-레벨 배경 |
| [`ai/sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md) | 같은 cooking-assistant repo의 ASR 모델 통합 함정 (tokens.txt 사건). 이 문서는 그 fix들이 일으킨 *다음* 함정 |
| [`devops/git-lfs-pointer-빌드함정.md`](../devops/git-lfs-pointer-빌드함정.md) | 같은 시기 model.int8.onnx LFS pointer 사건 (자매 문서) |
| [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) | LFS quota 한계 → Play Asset Delivery 마이그레이션 압력 |

---

# 15. 요약

cooking-assistant 2026-05-04 c546bf3는 표면적으로는 두 개의 무관한 fix가 한 커밋에 묶인 것처럼 보이지만, 두 함정 모두 **"Unity가 Android Gradle/AssetManager라는 호스트 메커니즘 위에 자기 산출물을 얹을 때 일어나는 번역 실수"**라는 같은 뿌리를 가진다.

**Issue 1 (StreamingAssets path)**: Unity의 Editor/Standalone에서는 `bin/Data/StreamingAssets/...` 같은 디렉토리 prefix가 의미를 가질 수 있지만, Android에서는 Unity가 그 폴더를 APK의 `assets/` 자체로 매핑한다. `AssetManager.open(...)`은 시작점이 곧 `assets/`라서 prefix가 들어가면 zip entry를 못 찾는다. 정답은 (a) C# 측 경로를 AssetManager-relative로 통일, (b) Java 측에 옛 prefix tolerance를 둬서 굳어 있는 옛 데이터도 살려주기 — cooking-assistant가 정확히 두 가지 다 했다.

**Issue 2 (Kotlin stdlib duplicate class)**: AAR이 transitive로 끌고 오는 Kotlin stdlib 좌표(`kotlin-stdlib`, `kotlin-stdlib-common`, `kotlin-stdlib-jdk7`, `kotlin-stdlib-jdk8`)는 Kotlin 1.5/1.8 병합 이력 때문에 같은 클래스가 여러 좌표에 중복 존재할 수 있다. sherpa-onnx, Silero VAD, Azure Speech가 각기 다른 버전을 끌고 오면 R8(release minify) 단계에서 *Duplicate class*로 폭발한다. 정답은 (a) `resolutionStrategy.force`로 4종 모두 단일 버전 핀, (b) `mainTemplate.gradle`(`unityLibrary` 모듈)과 `launcherTemplate.gradle`(`launcher` 모듈) **양쪽에 일관 적용** — Gradle 모듈별로 conflict resolution이 독립이고, R8은 `launcher`에서 작동하기 때문. cooking-assistant가 두 파일에 같은 4줄을 박은 것은 의도된 중복.

이 두 함정의 공통 교훈: **Unity는 게임 엔진이지만 Android 호스트 빌드 환경에 대해서는 *layer-leaking*이 잦은 추상화**다. StreamingAssets는 "원본 파일 그대로 패키징"이라는 약속을 하지만 그 *접근 메커니즘*은 플랫폼마다 다르고, native plugin / AAR 의존성은 Unity가 합성한 mainTemplate/launcherTemplate라는 두 모듈 구조 위에서 호스트 Gradle 규칙을 그대로 따른다. 둘 다 Unity의 추상화를 그대로 믿으면 안 되고, 한 단계 내려가서 호스트 동작을 직접 다뤄야 한다 — cooking-assistant의 49-line 패치가 정확히 그 한 단계 내려가는 작업이었다.

다음 단계: (a) Play Asset Delivery로 model.int8.onnx 옮겨 LFS quota 회피, (b) CI에서 `:launcher:assembleRelease` 정기 실행해 R8 함정 조기 발견, (c) 새 native 의존성 추가 시 force 4줄 의무 체크리스트화.

---

# 16. 참고 자료

## Unity StreamingAssets / Android 빌드
- [Unity Manual: Streaming Assets](https://docs.unity3d.com/Manual/StreamingAssets.html)
- [Unity Manual: UnityWebRequest](https://docs.unity3d.com/Manual/UnityWebRequest.html)
- [Unity Manual: Application.streamingAssetsPath](https://docs.unity3d.com/ScriptReference/Application-streamingAssetsPath.html)
- [Unity Manual: Android Gradle Templates](https://docs.unity3d.com/Manual/gradle-templates.html)
- [Unity Manual: Building and using plug-ins for Android](https://docs.unity3d.com/Manual/android-plugins-overview.html)
- [Unity Manual: Android App Bundle and Play Asset Delivery](https://docs.unity3d.com/Manual/play-asset-delivery.html)

## Android Asset / Build System
- [Android Developers: AssetManager](https://developer.android.com/reference/android/content/res/AssetManager)
- [Android Developers: Shrink, obfuscate, optimize your app (R8)](https://developer.android.com/build/shrink-code)
- [Android Developers: Resolve dependency conflicts](https://developer.android.com/studio/build/dependencies#duplicate_classes)
- [Android Developers: Play Asset Delivery](https://developer.android.com/guide/playcore/asset-delivery)

## Gradle 의존성 해결
- [Gradle: Dependency Resolution](https://docs.gradle.org/current/userguide/dependency_resolution.html)
- [Gradle: Resolution Strategy Tuning](https://docs.gradle.org/current/userguide/resolution_strategy_tuning.html)
- [Gradle: Dependency Constraints](https://docs.gradle.org/current/userguide/dependency_constraints.html)
- [Gradle: Platform / BOM (enforcedPlatform)](https://docs.gradle.org/current/userguide/platforms.html)
- [Gradle DSL: ResolutionStrategy](https://docs.gradle.org/current/dsl/org.gradle.api.artifacts.ResolutionStrategy.html)

## Kotlin stdlib 가족
- [Kotlin 1.8.0 Release Notes — stdlib jdk7/jdk8 병합](https://kotlinlang.org/docs/whatsnew18.html)
- [Kotlin 1.5 Release Notes — stdlib](https://kotlinlang.org/docs/whatsnew15.html#stdlib)
- [Kotlin Maven Coordinates Reference](https://kotlinlang.org/docs/maven.html)
- [Kotlin BOM (kotlin-bom)](https://search.maven.org/artifact/org.jetbrains.kotlin/kotlin-bom)

## Unity Native Plugin / EDM4U / sherpa
- [Google: External Dependency Manager for Unity (EDM4U) GitHub](https://github.com/googlesamples/unity-jar-resolver)
- [Unity Manual: Importing Android plug-ins](https://docs.unity3d.com/Manual/AndroidNativePlugins.html)
- [sherpa-onnx Android Build Guide](https://k2-fsa.github.io/sherpa/onnx/android/index.html)
- [sherpa-onnx Maven artifact](https://central.sonatype.com/artifact/com.k2fsa.sherpa.onnx/sherpa-onnx-android)

## 사례 / 산업
- [Meta XR All-in-One SDK (Unity)](https://developers.meta.com/horizon/documentation/unity/unity-package-manager/)
- [ARCore Unity SDK GitHub](https://github.com/google-ar/arcore-unity-sdk)
- [Niantic Lightship SDK](https://lightship.dev/products/ardk/)
- [Android Developers Blog: D8 and R8](https://android-developers.googleblog.com/2018/11/r8-new-code-shrinker-from-google-is.html)
- [DashVoice (Home Assistant + sherpa-onnx)](https://github.com/ecohash-co/dash-voice)

## 도서
- *Android Programming: The Big Nerd Ranch Guide* (Phillips/Stewart) — AssetManager 챕터
- *Effective Java* (Joshua Bloch, 3rd ed.) — 클래스로더와 의존성 격리
