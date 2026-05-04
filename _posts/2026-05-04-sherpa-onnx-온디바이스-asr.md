---
layout: single
title: "sherpa-onnx + SenseVoice 온디바이스 ASR 완전가이드"
date: 2026-05-04 23:00:00 +0900
categories: backend
excerpt: "sherpa-onnx와 SenseVoice 온디바이스 ASR은 토큰 사전과 모델 패키징 구조를 함께 이해해야 안정적으로 동작하는 로컬 음성 인식 스택이다."
toc: true
toc_sticky: true
tags: [sherpaonnx, sensevoice, asr, onnx, androidxr]
source: "/home/dwkim/dwkim/docs/ai/sherpa-onnx-온디바이스-asr.md"
---

TL;DR
- sherpa-onnx의 SenseVoice 추론은 model.onnx만이 아니라 tokens.txt vocabulary까지 있어야 정상 디코딩된다.
- 온디바이스 ASR은 보안·지연시간·오프라인 대응에서 유리하지만 자산 패키징과 실행 경로 설계가 핵심이다.
- 이번 사례는 모델 로드는 성공해도 디코더 사전 누락만으로 결과가 빈 문자열이 될 수 있음을 보여준다.

## 1. 개념
sherpa-onnx 기반 온디바이스 ASR은 ONNX 런타임 위에서 음성 모델과 vocabulary tokens 파일을 함께 묶어, 네트워크 없이도 디바이스에서 직접 음성을 텍스트로 변환하는 구조다.

## 2. 배경
클라우드 STT 키를 앱에 넣을 수 없고, Android XR 환경에서 오프라인 응답성과 개인정보 보호가 중요해지면서 로컬 ASR 도입이 필요해졌다. 이 과정에서 tokens.txt 누락으로 디코더가 빈 문자열만 반환하는 장애가 드러났다.

## 3. 이유
모델 파일만 있으면 끝이라고 오해하기 쉽지만, 실제 추론 결과는 정수 토큰 ID로 나오므로 vocabulary 매핑 파일 없이는 사람이 읽을 텍스트를 복원할 수 없다. 패키징·경로·런타임 초기화까지 함께 이해해야 디버깅 시간을 줄일 수 있다.

## 4. 특징
- 모델 파일과 tokens.txt를 함께 요구하는 이중 자산 구조
- CTC/AED·서브워드 vocabulary·ONNX Runtime 같은 추론 계층 설명
- Android XR 패키징, assets 경로, LFS 연계 이슈까지 포함한 실전 관점

## 5. 상세 내용

# sherpa-onnx + SenseVoice 온디바이스 ASR 완전가이드

> **작성일**: 2026-05-04
> **카테고리**: AI / ASR / On-device ML / Android XR
> **트리거**: cooking-assistant repo 2026-05-02 트러블슈팅 — `tokens.txt` 누락으로 디코더가 빈 문자열만 반환한 사건
> **포함 내용**: Next-gen Kaldi, k2-fsa, Lhotse, Icefall, Sherpa, sherpa-onnx, SenseVoice-Small/Large, FunAudioLLM, DAMO Academy, Paraformer, SAN-M, ONNX Runtime, INT8 quantization, CTC, RNN-T, AED, Non-autoregressive, BPE, SentencePiece, WordPiece, char-level vocabulary, OfflineRecognizer, OnlineRecognizer, Silero VAD, AssetManager vs filesystem, Whisper, Whisper.cpp, Vosk, Picovoice Cheetah/Leopard, DeepSpeech/Coqui (단종), Android SpeechRecognizer, Gemini Nano, AICore, iOS SFSpeechRecognizer, iOS 26 SpeechAnalyzer, Moonshine, Snapdragon XR2+ Gen 2, Hexagon NPU, QNN execution provider, Play Asset Delivery (install-time/fast-follow/on-demand), iOS On-Demand Resources, iOS Background Assets, Hugging Face Hub CDN, Azure Speech fromSubscription 보안 함정, 토큰 교환 백엔드, Cognito Identity Pool, Galaxy XR, Quest, Vision Pro, Home Assistant DashVoice, OpenVoiceOS, cooking-assistant 5월 2일 사건 분석

---

# 1. 발생 사례 — cooking-assistant 2026-05-02

## 1.1 사건 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│             cooking-assistant Android XR 2026-05-02              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  08:23  e8047cd  feat(voice): enable local stt validation       │
│         └─ Azure Speech SDK 제거 + sherpa-onnx 통합              │
│         └─ "Cloud API keys must not be embedded in APKs"        │
│         └─ LocalSpeechToTextService.java 신설                    │
│         └─ tokens.txt 경로 누락 (BUG)                            │
│                                                                  │
│           │                                                      │
│           │   14분                                               │
│           ▼                                                      │
│                                                                  │
│  08:37  f89d913  fix(voice): include sherpa tokens path          │
│         └─ "SenseVoice decoding needs the vocabulary             │
│            tokens file at runtime"                               │
│         └─ VoiceConfig에 tokens asset path 추가                  │
│         └─ model.int8.onnx는 .gitignore (>100MB)                 │
│                                                                  │
│           │                                                      │
│           │   18분                                               │
│           ▼                                                      │
│                                                                  │
│  08:55  6ba25bd  feat(voice): package local stt model via lfs   │
│         └─ "CI Android builds need the local SenseVoice         │
│            files in StreamingAssets"                             │
│         └─ Git LFS로 .onnx 패키징                                │
│         └─ Not-tested: CI LFS bandwidth quota                    │
└─────────────────────────────────────────────────────────────────┘
```

이 문서는 **08:37 hotfix가 왜 필요했는지**, 즉 *"왜 SenseVoice 디코딩에 model.onnx만으로는 부족하고 tokens.txt가 반드시 필요한가"* 를 신경망 구조 수준에서 풀어낸다. (08:55 LFS 이슈는 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md)에서 다룬다.)

## 1.2 1차 구현의 정확한 버그

```kotlin
// e8047cd 1차 구현 — 디코더가 동작 안 함
OfflineModelConfig(
    senseVoice = OfflineSenseVoiceModelConfig(
        model = "$modelDir/model.int8.onnx",
    ),
    tokens = ""        // ← 빈 문자열, 디코더가 인덱스→문자 변환 불가
)

// f89d913 hotfix — 정상 동작
OfflineModelConfig(
    senseVoice = OfflineSenseVoiceModelConfig(
        model = "$modelDir/model.int8.onnx",
    ),
    tokens = "$modelDir/tokens.txt"   // ← 25,055-라인 어휘 테이블
)
```

증상: 인식 결과가 빈 문자열로 반환되거나 내부 vocab assertion 실패. 모델 로드는 성공하기 때문에 "음성은 입력되는데 결과가 안 나오는" 형태의 디버깅 난도 높은 버그.

---

# 2. 용어 사전

## 2.1 Next-gen Kaldi 패밀리

| 프로젝트 | 역할 | GitHub |
|----------|-----|--------|
| **k2** | 래티스/FST 핵심 알고리즘 (C++/CUDA) | k2-fsa/k2 |
| **Lhotse** | 음성 데이터 준비/배치 관리 | lhotse-speech/lhotse |
| **Icefall** | 학습 레시피 (PyTorch, Kaldi 의존성 없음) | k2-fsa/icefall |
| **Sherpa** | 실시간 추론 서버 및 배포 계층 | k2-fsa/sherpa |
| **sherpa-onnx** | Sherpa의 ONNX Runtime 특화 브랜치 | k2-fsa/sherpa-onnx |

## 2.2 어원

**Kaldi**: 에티오피아 전설의 염소 목동 — 자기 염소가 커피 열매 먹고 흥분하는 걸 보고 커피를 발견했다는 인물. Daniel Povey가 2011년 Johns Hopkins에서 공개. "공짜 음성 인식의 원천"이라는 의미를 담음.

**Sherpa**: 네팔 히말라야의 셰르파족(Sherpa people). 산악 원정대를 안내하는 가이드처럼, "무거운 음성 모델을 에지 디바이스까지 안전하게 안내한다"는 의미. **Daniel Povey는 Kaldi 원작자였고 현재는 중국 Xiaomi에서 Next-gen Kaldi를 주도** — Kaldi → Next-gen Kaldi → sherpa-onnx 가계도가 한 사람의 연구 인생을 그대로 따라간다.

## 2.3 SenseVoice / FunAudioLLM

| 약어 | 풀이 |
|------|-----|
| **FunAudioLLM** | Alibaba DAMO Academy 산하 음성 파운데이션 모델 팀 |
| **SenseVoice** | FunAudioLLM의 ASR + 멀티태스크 모델 (2024) |
| **CosyVoice** | FunAudioLLM의 TTS 모델 (SenseVoice의 자매 모델) |
| **DAMO** | "Discovery, Adventure, Momentum, Outlook" — Alibaba 글로벌 R&D 조직 |
| **SAN-M** | Self-Attention Network with Memory — Paraformer/SenseVoice의 인코더 구조 |

## 2.4 디코딩 패러다임

| 패러다임 | 풀이 | 자기회귀? | 대표 모델 |
|----------|-----|----------|----------|
| **CTC** | Connectionist Temporal Classification (Graves 2006) | No | wav2vec2, SenseVoice-Small |
| **RNN-T / Transducer** | Recurrent Neural Network Transducer | Yes (얇음) | Google USM, Zipformer |
| **AED** | Attention Encoder-Decoder | Yes | Whisper, SenseVoice-Large |
| **NAR** | Non-AutoRegressive (병렬 토큰 생성) | No | Paraformer, SenseVoice-Small |

## 2.5 토큰화 알고리즘

| 알고리즘 | 단위 | 어휘 크기 | 예 |
|---------|-----|---------|-----|
| **char-level** | 단일 문자 | 수백 | 초기 CTC |
| **BPE** (Byte-Pair Encoding) | 빈출 바이트 쌍 병합 | 수천~수만 | GPT, Whisper |
| **SentencePiece** | 공백 포함 서브워드, 언어 독립 | 수천~수만 | mBERT, XLM-R |
| **WordPiece** | BERT 스타일 (`##` 접두) | 수만 | BERT |

SenseVoice-Small은 **혼합 어휘** — 한국어 자모/음절 + 영어 BPE + 중국어 한자 + 일본어 가나 + 광둥어 + 특수 태그(`<|zh|>`, `<|NEUTRAL|>`)를 합쳐 **25,055 토큰**.

## 2.6 ONNX / 양자화

| 항목 | 풀이 |
|------|-----|
| **ONNX** | Open Neural Network Exchange — Microsoft/Meta 공동 설계 (2017) |
| **ONNX Runtime (ORT)** | Microsoft가 만든 ONNX 실행 엔진 (CPU/GPU/NPU 백엔드) |
| **INT8 quantization** | FP32 → INT8 가중치 압축 (4배 작아짐) |
| **QNN** | Qualcomm Neural Network — Hexagon NPU용 ORT 실행 제공자 |

---

# 3. tokens.txt가 왜 필수인가 — 핵심 트러블 분석

## 3.1 신경망 출력의 본질

```
┌─────────────────────────────────────────────────────────────────┐
│           SenseVoice-Small 추론 파이프라인                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [16kHz PCM 오디오]                                              │
│        │                                                         │
│        ▼                                                         │
│  [Mel-spectrogram 추출]  (80-d × T 프레임)                       │
│        │                                                         │
│        ▼                                                         │
│  [SAN-M Encoder]  (≈234M params)                                 │
│        │                                                         │
│        ▼                                                         │
│  [Logit 텐서]  shape = [batch, time, vocab_size=25055]           │
│        │                                                         │
│        │   t=0:  [0.001, 0.003, ..., 0.892, ..., 0.002] ← 25055 │
│        │   t=1:  [0.002, 0.001, ..., 0.001, ..., 0.945]         │
│        │   ...                                                   │
│        │                                                         │
│        ▼                                                         │
│  [argmax + CTC blank 제거]                                       │
│        │                                                         │
│        │   → [2847, 18932, 0, 18932, 12301, ...]  ← 정수 ID      │
│        │                                                         │
│        ▼                                                         │
│  [tokens.txt lookup]   ← 여기서 사람 글자로 변환                 │
│        │                                                         │
│        │   2847  → "hello"                                       │
│        │   18932 → "안녕"                                         │
│        │   12301 → "_"                                            │
│        │                                                         │
│        ▼                                                         │
│  ["hello 안녕"]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**핵심**: 모델이 출력하는 것은 **정수 인덱스 시퀀스**이고, tokens.txt는 그 인덱스를 사람 글자로 번역하는 **유일한 사전**이다. 인덱스 18932가 "안녕"인지 "hello"인지 "_"인지는 학습 시 정해진 vocabulary에 의존하며, 모델 파일(`model.int8.onnx`)에는 이 매핑이 들어있지 않다.

## 3.2 tokens.txt 형식

```
# SenseVoice-Small tokens.txt (총 25,055 라인)
<blk>           0      ← CTC blank 토큰
<unk>           1      ← 미지 토큰
<sos/eos>       2      ← 문장 경계
<|zh|>          3      ← 언어 태그: 중국어
<|en|>          4      ← 언어 태그: 영어
<|ja|>          5
<|ko|>          6
<|yue|>         7      ← 광둥어
<|NEUTRAL|>     8      ← 감정 태그: 중립
<|HAPPY|>       9      ← 감정 태그: 행복
<|Speech|>      10     ← 이벤트 태그: 발화
<|Applause|>    11     ← 이벤트 태그: 박수
...
你              147
好              148
hello           2847
...
안녕            18932
...
```

이 25,055-라인 텍스트 파일은 cooking-assistant repo의 일반 Git에 들어 있다(LFS 아님). `model.int8.onnx`(228MB)만 LFS이고 tokens.txt(텍스트, 약 1MB)는 정상 Git이라는 분리는 정확한 선택이다.

## 3.3 tokens.txt 누락 시 정확한 실패 모드

sherpa-onnx C++ 코어 동작:

```cpp
// OfflineSenseVoiceModelConfig 초기화
if (config.tokens.empty()) {
    // SymbolTable 객체가 비어있는 상태
    sym_table_ = SymbolTable();
}

// 디코딩 시
std::string text;
for (auto id : decoded_ids) {
    text += sym_table_[id];   // ← 빈 SymbolTable이면 모든 lookup이 빈 문자열
}
return text;   // ← "" 반환
```

**증상 분류**:
- 음성은 정상 캡처
- VAD endpointing은 정상 작동
- 모델 로드는 성공 (model.int8.onnx만 있으면 됨)
- 추론도 성공 (logit 출력까지 정상)
- **디코딩 단계에서 빈 문자열만 출력**

이런 종류의 버그는 "모델은 잘 로드됐는데 결과가 없다"라는 형태로 나타나서, 음성 입력 문제 / 마이크 권한 / VAD 임계값 등을 의심하기 쉽다. 정답은 vocab 누락이다.

## 3.4 왜 model + tokens가 분리됐나

ASR 학습 파이프라인의 전통:
1. **Vocab 결정**: 학습 데이터로부터 BPE/SentencePiece tokenizer 학습 → tokens.txt 생성
2. **모델 학습**: 고정된 tokens 어휘를 출력 차원으로 사용하여 가중치 학습 → model.onnx 생성
3. **배포**: 두 파일을 함께 패키징

같은 모델 아키텍처라도 **tokens.txt가 다르면 다른 모델**이다. 한국어 전용으로 재학습하면 vocab이 줄어들고, 그러면 model.onnx의 출력 차원도 달라진다. tokens.txt와 model.int8.onnx는 **반드시 같은 학습 세션의 산출물**이어야 하며, 버전이 어긋나면 ID가 깨져 쓰레기 출력이 나온다.

---

# 4. sherpa-onnx 아키텍처

## 4.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                    sherpa-onnx 계층도                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [App: Android/iOS/Desktop/Web]                                  │
│        │                                                         │
│        │  언어 바인딩 (12개)                                     │
│        ▼                                                         │
│  ┌────────────────────────────────────────────────┐             │
│  │ Kotlin/Java | Swift | Python | JS | Go | Dart  │             │
│  │ C | C# | Ruby | Pascal | V                     │             │
│  └────────────────────────────────────────────────┘             │
│        │                                                         │
│        │  JNI / FFI                                              │
│        ▼                                                         │
│  ┌────────────────────────────────────────────────┐             │
│  │  C++ Core (sherpa-onnx)                        │             │
│  │  ┌──────────────────────────────────────────┐  │             │
│  │  │ OfflineRecognizer  OnlineRecognizer       │  │             │
│  │  │ Silero VAD         Speaker Diarization    │  │             │
│  │  │ TTS (CosyVoice/Kokoro)  Source Separation │  │             │
│  │  └──────────────────────────────────────────┘  │             │
│  └────────────────────────────────────────────────┘             │
│        │                                                         │
│        ▼                                                         │
│  ┌────────────────────────────────────────────────┐             │
│  │  ONNX Runtime                                  │             │
│  │  CPU | CUDA | DirectML | CoreML | NNAPI | QNN  │             │
│  └────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**핵심 설계 결정**: C++ 단일 코어 + 12개 언어 바인딩. 같은 ONNX 모델이 Android(JNI)부터 React Native(Dart)까지 모두 동일하게 동작.

## 4.2 OnlineRecognizer vs OfflineRecognizer

| 항목 | OnlineRecognizer | OfflineRecognizer |
|------|------------------|-------------------|
| 용도 | 실시간 스트리밍 | 파일/배치 처리 |
| 청크 단위 | 수 ms~수십 ms | 전체 발화 |
| 지연 | 낮음 | 발화 끝나야 결과 |
| SenseVoice 지원 | **불가** (NAR이라 전체 입력 필요) | **가능** |
| 호환 모델 | Zipformer, Paraformer-streaming | SenseVoice, Whisper, Transducer offline |

**결과적 제약**: SenseVoice는 비자기회귀 + 전체 입력 한 번에 처리 구조라서 **OfflineRecognizer + Silero VAD 조합**이 필수. VAD가 발화 경계를 잘라주고 그 청크를 OfflineRecognizer에 통째로 넘기는 패턴이다.

```
[마이크] → [16kHz PCM 스트림] → [Silero VAD]
                                        │
                                        │  발화 시작 감지
                                        ▼
                                  [버퍼 누적]
                                        │
                                        │  발화 끝 감지 (silence > 0.25s)
                                        ▼
                            [OfflineRecognizer.decode(buffer)]
                                        │
                                        ▼
                                    [텍스트 결과]
```

## 4.3 Android JNI 통합

```java
// LocalSpeechToTextService.java 핵심 (cooking-assistant 기준)
static {
    System.loadLibrary("sherpa-onnx-jni");
}

OfflineRecognizerConfig config = new OfflineRecognizerConfig();
config.modelConfig.senseVoice.model = modelPath;
config.modelConfig.tokens = tokensPath;        // ← 누락 시 디코더 죽음
config.modelConfig.numThreads = 2;

OfflineRecognizer recognizer =
    OfflineRecognizer.newFromFile(config);     // 또는 newFromAssets
```

**파일 경로 vs AssetManager**:

| 방식 | 사용처 | 주의점 |
|------|--------|--------|
| `newFromFile(config)` | 일반 파일시스템 경로 | `context.filesDir`나 `cacheDir` 절대 경로 |
| `newFromAssets(assetManager, config)` | APK 내 `assets/` | `app/src/main/assets/...` 상대 경로 |

Unity의 `StreamingAssets`는 Android에서 APK JAR 내부로 병합되어 일반 `File()`로 접근 불가. `UnityWebRequest`로 `cacheDir`에 복사한 뒤 절대 경로를 sherpa에 전달해야 한다. cooking-assistant도 Unity 베이스이므로 이 패턴을 따른다.

## 4.4 Silero VAD 통합

Silero VAD는 sherpa-onnx에 포함된 경량 음성 활성도 검출기.

```
Silero VAD 기본 파라미터:
  threshold:                0.5      (음성/비음성 임계값)
  min_silence_duration:     0.25 sec (이만큼 무음이면 발화 종료)
  min_speech_duration:      0.25 sec (이보다 짧은 음성은 노이즈로 무시)
  window_size:              512 samples (16kHz 기준 32ms)
  처리 시간:                <1ms/청크 (CPU 단일 스레드)
  모델 크기:                ~1.8MB
```

VAD 미설정 시 OfflineRecognizer는 발화 경계를 못 알아 무한 대기 또는 매우 긴 버퍼를 한 번에 처리하려다 OOM.

---

# 5. SenseVoice 깊이

## 5.1 모델 변형 비교

| | SenseVoice-Small | SenseVoice-Large |
|-|------------------|-------------------|
| 아키텍처 | 비자기회귀 인코더 전용 (SAN-M) | 자기회귀 인코더-디코더 |
| 파라미터 | ~234M | 더 큼 |
| 지원 언어 | 5개 (中/英/日/韓/粤) | 50개 이상 |
| 학습 데이터 | 40만 시간+ | 동일 규모+ |
| 어휘 크기 | 25,055 토큰 | 더 큼 |
| 10초 처리 | **70ms** (Whisper-Large 대비 15배 빠름) | 보통 |
| FP32 크기 | ~894MB | 더 큼 |
| INT8 크기 | **~228MB** | 더 큼 |
| 멀티태스크 | ASR + LID + SER + AED | 동일 |

cooking-assistant가 채택한 것은 **SenseVoice-Small INT8** (`model.int8.onnx` 약 228MB).

## 5.2 멀티태스크 — ASR/LID/SER/AED

| 태스크 | 풀이 | 출력 예 |
|--------|-----|---------|
| **ASR** | Automatic Speech Recognition | "감자 두 개를 깎아주세요" |
| **LID** | Language IDentification | `<|ko|>` (한국어로 판별) |
| **SER** | Speech Emotion Recognition | `<|HAPPY|>` (행복) / `<|NEUTRAL|>` |
| **AED** | Audio Event Detection | `<|Speech|>` / `<|Applause|>` / `<|BGM|>` |

**4가지를 단일 패스**로 처리한다는 것이 SenseVoice의 핵심 가치. 별도 모델 4개를 띄울 필요가 없어 모바일 환경에서 매우 유리.

요리 보조 앱 관점:
- ASR: 명령 인식 ("타이머 5분")
- LID: 한/영 자동 전환 (요리 용어 "garlic" 같은 영문 혼용)
- AED: 환풍기/물 끓는 소리 등 환경음 감지로 명령 식별 정확도 향상
- SER: (덜 유용) 사용자 감정 감지

## 5.3 비자기회귀(NAR)의 의의

```
┌─────────────────────────────────────────────────────────────────┐
│        자기회귀 vs 비자기회귀 디코딩                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  자기회귀 (Whisper, SenseVoice-Large):                           │
│                                                                  │
│    t=0  →  "감"                                                  │
│            ↓ (이전 출력을 다음 입력으로)                          │
│    t=1  →  "자"                                                  │
│            ↓                                                     │
│    t=2  →  "를"                                                  │
│                                                                  │
│    → 토큰 N개 = N번의 순차 forward pass                          │
│    → GPU 병렬화 효과 제한                                        │
│                                                                  │
│  비자기회귀 (Paraformer, SenseVoice-Small):                      │
│                                                                  │
│    t=0   t=1   t=2   t=3   t=4   ← 모든 위치 동시 예측           │
│     │     │     │     │     │                                    │
│     ▼     ▼     ▼     ▼     ▼                                    │
│    "감"  "자"  "를"  "깎"  "아"                                  │
│                                                                  │
│    → 단 한 번의 forward pass로 전체 시퀀스                       │
│    → GPU/NPU 병렬화 효과 극대화                                  │
│    → 10~15배 빠른 추론                                           │
└─────────────────────────────────────────────────────────────────┘
```

이것이 SenseVoice-Small의 70ms/10초 처리 속도의 비결. Android XR 헤드셋의 제한된 배터리/발열 예산에서 결정적 이점.

## 5.4 SAN-M 인코더

**SAN-M (Self-Attention Network with Memory)**: Paraformer 논문(Gao et al., Interspeech 2022, `arxiv:2206.08317`)에서 제안된 메모리 강화 self-attention 변형. 표준 Transformer의 self-attention에 외부 memory bank를 추가하여 긴 음성 시퀀스의 장기 의존성을 효율적으로 모델링.

SenseVoice-Small은 SAN-M을 계승하면서 **CTC 손실을 직접 적용**하여 Paraformer의 CIF(Continuous Integrate-and-Fire) 예측기를 제거. 구조가 더 단순해지고 학습/추론 모두 빨라짐.

---

# 6. ASR 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│                  음성 인식 50년 압축 연표                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1980s   HMM-GMM           숨겨진 마르코프 + 가우시안 혼합        │
│  2009    DNN-HMM           딥뉴럴넷이 GMM을 대체 시작             │
│  2011    Kaldi             Povey, Johns Hopkins, ASRU 2011       │
│  2006    CTC               Graves, ICML 2006                     │
│  2014    Apple Siri 클라우드 STT 상용화                          │
│  2014    Sequence-to-Seq   Sutskever, 어텐션 등장                │
│  2016    Listen-Attend-Spell  Chan, AED 패러다임                 │
│  2017    Transformer       Vaswani et al.                        │
│  2019    Pixel 4 Live Caption 최초 대중 온디바이스 자막           │
│  2020    wav2vec 2.0       Meta, 자기지도 학습                   │
│  2021    Mozilla DeepSpeech 단종 / Coqui로 포크                  │
│  2022.07 Paraformer        Alibaba, NAR ASR 10x 속도             │
│  2022.09 Whisper           OpenAI, 68만 시간, 99개 언어, MIT     │
│  2023.03 whisper.cpp       ggerganov, ggml로 모바일 실행 폭발     │
│  2023.06 sherpa-onnx       k2-fsa, ONNX 기반 12개 바인딩         │
│  2023.06 Coqui STT 단종                                          │
│  2024.07 SenseVoice        FunAudioLLM (Alibaba), Apache 2.0     │
│  2024.10 Whisper Large-v3 Turbo  OpenAI, 8배 빠른 distilled      │
│  2024.12 Gemini Nano       Google, Pixel 8/9 온디바이스          │
│  2025.06 Apple SpeechAnalyzer  iOS 26, WWDC25, 완전 온디바이스   │
│  2025.10 Galaxy XR         삼성, Snapdragon XR2+ Gen 2 + Gemini  │
│  2026.05 cooking-assistant Android XR sherpa-onnx 통합 (현재)    │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. 대안 ASR 비교

## 7.1 온디바이스 옵션 종합 표

| 엔진 | 기반 | 모델 크기 | WER (영어) | RTF | 멀티링구얼 | 라이선스 | iOS | Android |
|------|------|-----------|-----------|-----|------------|----------|-----|---------|
| **sherpa-onnx + SenseVoice-Small** | Next-gen Kaldi + ONNX | 228MB (int8) | 낮음 | 0.06 | 5개 (中/英/日/韓/粤) | Apache 2.0 | ✅ | ✅ |
| **sherpa-onnx + Whisper** | ONNX | tiny 39MB ~ large 1.5GB | 매우 낮음 | 0.06~ | 99개 | MIT | ✅ | ✅ |
| **whisper.cpp** | ggml | tiny 39MB ~ large 1.5GB | 매우 낮음 | 0.07 tiny | 99개 | MIT | ✅ XCFramework | ✅ JNI |
| **Vosk** | Kaldi | small 50MB ~ large 1.8GB | ~10-15% | 빠름 | 20+ | Apache 2.0 | ✅ | ✅ |
| **Picovoice Cheetah** | 독자 | 수 MB | 낮음 | 매우 빠름 | 영/불/독/일/한 | **상용 ($999/월~)** | ✅ | ✅ |
| **Picovoice Leopard** | 독자 | 수 MB | 낮음 | 매우 빠름 | 동일 | **상용** | ✅ | ✅ |
| **Moonshine** | Useful Sensors | tiny 27M | 낮음 | 0.05 | 영어 | Apache 2.0 | ✅ | ✅ |
| **Android SpeechRecognizer** | 시스템 | N/A (Gemini Nano 1.8~3.25B 4bit) | 매우 낮음 | 빠름 | Google 지원 | OS 무료 | ❌ | Pixel 8+ 한정 |
| **iOS SFSpeechRecognizer** | 시스템 | N/A | 낮음 | 빠름 | 60+ | OS 무료 | iOS 10+ | ❌ |
| **iOS SpeechAnalyzer** | 시스템 | N/A | 낮음 | 빠름 | 확장 중 | OS 무료 | **iOS 26+** | ❌ |
| **DeepSpeech / Coqui** | Kaldi | 188MB ~ 1GB | 5-7% | 보통 | 영어 중심 | MPL 2.0 | **단종** | **단종** |

**중요 벤치마크**: 동일 Whisper Tiny 모델을 Android에서 실행 시 sherpa-onnx(ONNX Runtime)가 whisper.cpp(GGML) 대비 **51배 빠르다**. 추론 엔진 선택이 모델 선택만큼 중요하다.

## 7.2 클라우드 옵션 (대조군)

| 서비스 | 정확도 | 가격 | 한국어 | 비고 |
|--------|--------|-----|-------|------|
| Azure Speech | WER 2-5% | $1/시간 | ✅ | issueToken으로 단기 토큰 발급 |
| Google Cloud Speech-to-Text | WER 2-5% | $0.006/15초 | ✅ | Workload Identity / Firebase App Check |
| AWS Transcribe | WER 3-7% | $0.024/분 | ✅ | Cognito Identity Pool 권장 |
| OpenAI Whisper API | WER 2-5% | $0.006/분 | ✅ | 단순한 REST |
| Deepgram Nova-2 | WER 3-5% | $0.0043/분 | ⚠️ 제한적 | 빠른 스트리밍 |

---

# 8. 클라우드 vs 온디바이스 의사결정

## 8.1 트레이드오프 매트릭스

| 항목 | 클라우드 | 온디바이스 |
|------|---------|-----------|
| **레이턴시** | 200~800ms (네트워크 RTT 포함) | 50~200ms (추론만) |
| **프라이버시** | 음성이 클라우드로 전송 | 디바이스 밖으로 안 나감 |
| **비용** | per-minute API 요금 | 모델 일회성 배포 |
| **정확도** | 대형 모델 (WER 2~5%) | 양자화 모델 (WER 5~15%) |
| **오프라인** | 불가 | 완전 오프라인 |
| **시크릿 관리** | API 키 APK 노출 위험 | 키 없음 |
| **다국어** | 80+ 언어 실시간 전환 | 모델별 제한 |
| **모델 업데이트** | 서버에서 즉시 갱신 | 앱 업데이트 / OTA |
| **배터리** | 네트워크 무선 사용량 | NPU 추론 사용량 |

## 8.2 의사결정 플로우차트

```
┌─────────────────────────────────────────────────────────────────┐
│                   ASR 엔진 선택 가이드                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Q1. 네트워크가 항상 보장되는가?                                  │
│      ├─ NO  → 온디바이스 필수 (Q3 진행)                          │
│      └─ YES → Q2 진행                                            │
│                                                                  │
│  Q2. APK에 키 임베딩 없이 클라우드 STT 가능한가?                 │
│      (백엔드 토큰 교환 서버 필요)                                │
│      ├─ YES (백엔드 가능) → 클라우드 STT (정확도 우선)           │
│      └─ NO  (모바일 직접 호출) → 온디바이스 (Q3)                 │
│                                                                  │
│  Q3. 모델 크기 제약은?                                           │
│      ├─ <50MB → Vosk small / Picovoice                          │
│      ├─ <300MB →                                                 │
│      │     ├─ 한/중/일/영 + 감정/이벤트 → SenseVoice-Small INT8  │
│      │     └─ 99개 언어 / 파인튜닝 → Whisper small/medium        │
│      └─ <1.5GB                                                   │
│            └─ 최고 정확도 → Whisper large + sherpa-onnx          │
│                                                                  │
│  Q4. Wake Word(헤이 코지) 통합 필요?                              │
│      ├─ YES + 예산 OK → Picovoice Porcupine + Cheetah            │
│      └─ YES + 예산 X  → openWakeWord + sherpa-onnx               │
│                                                                  │
│  Q5. 폴백 (모델 다운로드 실패 시)?                                │
│      ├─ Android → SpeechRecognizer (온라인 모드)                  │
│      └─ iOS     → SFSpeechRecognizer / SpeechAnalyzer            │
└─────────────────────────────────────────────────────────────────┘
```

## 8.3 cooking-assistant의 선택 분석

```
조건:
  - Android XR (Galaxy XR / Quest 등 고려)
  - 한국어 + 영어 혼용 (요리 용어)
  - 오프라인 필요 (주방 환경, 네트워크 불안정 가능)
  - APK 시크릿 노출 회피 강력 요구
  - Unity 베이스

→ sherpa-onnx + SenseVoice-Small INT8

이유:
  ✓ 한/영 동시 지원 (5개 언어 중 정확히 매칭)
  ✓ AED로 환경음(물 끓는 소리, 환풍기)과 명령 분리 가능
  ✓ NAR 구조로 70ms 처리 → 헤드셋 발열/배터리 최적
  ✓ Apache 2.0, 상용 부담 없음
  ✓ Unity Java 바인딩 즉시 사용 가능
  ✓ 228MB는 Play Asset Delivery 대상
```

---

# 9. 클라우드 STT 보안 함정 (왜 cooking-assistant가 sherpa로 갔는가)

## 9.1 APK 리버스 엔지니어링의 현실

Android APK는 다음 도구로 **수 분 내** 디컴파일 가능:
- **apktool**: APK → smali / 리소스
- **JADX**: APK → 읽을 수 있는 Java 소스
- **Ghidra**: 네이티브 라이브러리 분석

ProGuard/R8 난독화는 공격을 지연시킬 뿐 막지 못한다. APK 내 모든 문자열은 자동화된 grep으로 추출 가능.

## 9.2 Azure Speech의 위험한 패턴

```java
// ❌ 절대 하지 말 것
SpeechConfig config = SpeechConfig.fromSubscription(
    "abcdef0123456789...",   // ← APK 디컴파일하면 즉시 노출
    "eastus"
);
```

이 키 문자열은 `strings.xml` 또는 컴파일된 바이너리 상수로 APK 내 존재. JADX로 1분 내 추출 가능. **이것이 e8047cd 커밋에서 "leaks app secrets"로 reject 된 이유**.

## 9.3 안전한 패턴 — 토큰 교환 백엔드

```
┌─────────────────────────────────────────────────────────────────┐
│              모바일 → 백엔드 → Azure 안전 패턴                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [모바일 앱]                                                     │
│      │                                                           │
│      │  1. JWT (App 서명 검증)                                   │
│      ▼                                                           │
│  [자체 백엔드]                                                   │
│      │                                                           │
│      │  2. Azure issueToken 호출 (서버에 키 보관)                │
│      ▼                                                           │
│  [Azure Token Service]                                           │
│      │                                                           │
│      │  3. 10분짜리 Bearer Token 반환                            │
│      ▼                                                           │
│  [백엔드] ── 4. 토큰 모바일에 전달 ──▶ [모바일 앱]                │
│                                              │                   │
│                                              │ 5. Bearer Token    │
│                                              ▼ 으로 직접 호출    │
│                                        [Azure Speech REST]       │
└─────────────────────────────────────────────────────────────────┘
```

**핵심**: 장기 키는 백엔드에만, 모바일에는 10분짜리 토큰만. cooking-assistant에 백엔드 인프라가 없거나 추가 비용/복잡도가 부담이라면 **온디바이스로 가는 게 합리적**이다.

## 9.4 서비스별 권장 패턴

| 서비스 | ❌ 위험 | ✅ 권장 |
|--------|--------|---------|
| Azure Speech | `fromSubscription(key, region)` 직접 | 백엔드에서 `issueToken` → Bearer Token |
| Google Cloud Speech | 서비스 계정 JSON assets에 포함 | Workload Identity Federation / Firebase App Check + 토큰 교환 |
| AWS Transcribe | `accessKeyId`/`secretAccessKey` 하드코딩 | Cognito Identity Pool 임시 자격증명 (15분~1시간) |

---

# 10. 모바일 ML 모델 패키징 (간략)

(상세는 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §11 참조)

## 10.1 Android 옵션

| 방법 | 한도 | 적합 |
|------|------|------|
| APK assets 직접 내장 | ~100MB 권장 | Vosk small (50MB) |
| **Play Asset Delivery — install-time** | 4GB (asset pack 합산) | SenseVoice INT8 (228MB) |
| **PAD — fast-follow** | 4GB | 중형 모델 |
| **PAD — on-demand** | 4GB | 선택적 언어 팩 |
| 첫 실행 시 CDN 다운로드 | 제한 없음 | Hugging Face Hub / R2 |

## 10.2 iOS 옵션

| 방법 | 도입 | 비고 |
|------|------|------|
| On-Demand Resources (ODR) | iOS 9 (2015) | 64MB/태그 권장, 레거시화 |
| Background Assets | iOS 16 (2022) | Apple이 ODR 대체로 권장 |
| 앱 자체 다운로드 | 전 버전 | URLSession + FileManager |

## 10.3 cooking-assistant 권고

```
현재:  StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx
         + Git LFS 패키징
         → CI bandwidth 리스크 (Not-tested 항목)

권고:  Play Asset Delivery fast-follow pack으로 분리
         또는 Hugging Face Hub에서 첫 실행 시 다운로드
         → APK 크기 감소 + LFS bandwidth 0
         → tokens.txt(1MB)는 일반 Git/APK assets에 유지
```

---

# 11. 빅테크/오픈소스 실전 사례

## 11.1 Alibaba (FunAudioLLM 출처)

- DAMO Academy가 SenseVoice + CosyVoice를 쌍으로 개발
- Alibaba 클라우드 음성 서비스의 기반 모델
- DingTalk 화상회의 자동 자막
- Hugging Face Hub에 `FunAudioLLM/SenseVoiceSmall` 공개 (Apache 2.0)

## 11.2 Hugging Face Hub

- sherpa-onnx 사전학습 모델의 사실상 공식 호스팅
- `csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17` (FP32)
- `csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17` (INT8)
- CloudFront CDN으로 글로벌 배포
- 2024.08 XetHub 인수로 Xet 스토리지 도입 — Git LFS 대비 10배 성능

## 11.3 Home Assistant 생태계

- **DashVoice** (`ecohash-co/dash-voice`): OpenWakeWord + sherpa-onnx를 Android 태블릿에서 결합한 완전 오프라인 음성 위성
- **OpenVoiceOS**: 2026.02 sherpa-onnx + ONNX 기반 ASR 공식 통합
- **Wyoming Protocol**: Home Assistant의 음성 위성 표준 — sherpa-onnx 백엔드 지원

## 11.4 Google Pixel — Live Caption / Gemini Nano

- 2019 Pixel 4 Live Caption: 최초 대중 온디바이스 실시간 자막 (영어만)
- 2024 Pixel 8 Pro: Gemini Nano (1.8~3.25B params, 4-bit 양자화)
- **AICore**: Android의 온디바이스 LLM 런타임
- **ML Kit On-Device Speech Recognition**: 2026.04 Beta (Pixel 한정)

## 11.5 Apple — SpeechAnalyzer

- 2025.06 WWDC25 발표
- iOS 26 신규 API
- 완전 온디바이스, 시스템 모델 자체 관리
- Apple Notes, Voice Memos에 이미 사용
- iPhone 15 이상 Neural Engine 활용

## 11.6 Snapdragon XR2+ Gen 2 (cooking-assistant 잠재 타겟)

- Galaxy XR (2025), Quest 3, Vision Pro 후속 등 채택
- Hexagon NPU 내장 — ONNX Runtime QNN 실행 제공자로 sherpa-onnx 가속 가능
- 12개+ 카메라 동시 처리, 저전력 always-on 마이크 어레이
- VR 헤드셋 배터리 2~3Wh — SenseVoice의 NAR 구조가 결정적 이점

---

# 12. 베스트 프랙티스 / 함정

## 12.1 패키징 시 필수 항목

```
✓ tokens.txt와 model.int8.onnx를 동일 디렉토리에
✓ 두 파일은 같은 학습 세션 산출물 — 버전 일치 필수
✓ tokens.txt는 일반 Git, .onnx는 LFS / PAD / CDN
✓ checksum (SHA-256) 검증 자동화
✓ Silero VAD 모델도 같이 패키징 (1.8MB)
```

## 12.2 알려진 함정

| 함정 | 증상 | 해결 |
|------|------|------|
| **tokens.txt 누락** | 빈 문자열 결과 | `OfflineModelConfig.tokens` 채우기 |
| 모델/토큰 버전 불일치 | 쓰레기 출력 | 같은 디렉토리 동시 배포 |
| VAD 미설정 + Streaming | 무한 대기 / OOM | Silero VAD 앞단 배치 |
| Unity StreamingAssets에서 직접 File() | 파일 못 찾음 | `cacheDir`에 복사 후 절대 경로 |
| INT8 양자화 정확도 가정 | 도메인 특화 WER 저하 | A/B 테스트로 검증 |
| OfflineRecognizer로 streaming 시도 | NAR 특성상 동작 안 함 | OnlineRecognizer로 교체 또는 VAD 청크 |
| `numThreads` 너무 큼 | 발열 / 배터리 | 모바일은 1~2 권장 |

## 12.3 양자화 트레이드오프

| 기법 | 크기 절감 | WER 영향 | 추론 속도 |
|------|----------|---------|----------|
| FP32 (기준) | 1x | 0% | 1x |
| INT8 | 4x | +1~3% | 2~3x |
| INT4 | 8x | +3~8% | 추가 가속 |
| Pruning | 20~50% | 모델 의존 | 보통 |
| Distillation | 모델별 | Whisper Large→Turbo 8x 빠름 | 큼 |

## 12.4 NPU 활용

```
ONNX Runtime 실행 제공자 우선순위 (Android):
  1. QNN (Qualcomm Hexagon NPU)         ← 추가 40~60% 속도
  2. NNAPI (Android Neural Networks API)
  3. XNNPACK (CPU 최적화)
  4. CPU Default

cooking-assistant Galaxy XR 타겟이면 QNN 검토 가치 높음.
```

---

# 13. 학술 배경

| 논문 | 저자 / 연도 | 핵심 기여 |
|------|-----------|-----------|
| *The Kaldi Speech Recognition Toolkit* | Povey et al., **ASRU 2011** | 오픈소스 HMM-DNN ASR 표준, FST 기반 디코딩 |
| *Connectionist Temporal Classification* | Graves et al., **ICML 2006** | 정렬 없는 시퀀스 레이블링, blank 토큰 |
| *Attention Is All You Need (Transformer)* | Vaswani et al., NeurIPS 2017 | self-attention 기반 시퀀스 모델 |
| *Listen, Attend and Spell* | Chan et al., ICASSP 2016 | seq2seq + attention ASR (AED 시초) |
| *wav2vec 2.0* | Baevski et al., NeurIPS 2020 | 자기지도 음성 표현 학습 |
| *Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)* | Radford et al., **2022** | 68만 시간 약지도, 다국어 AED |
| *Paraformer* | Gao et al., **Interspeech 2022** (`arxiv:2206.08317`) | CIF 기반 NAR ASR, 10x 속도 |
| *FunAudioLLM* | FunAudioLLM Team, **2024** (`arxiv:2407.04051`) | SenseVoice + CosyVoice 통합 |
| *Distil-Whisper* | Sanchit Gandhi et al., 2023 | Whisper 6배 가속 distillation |

---

# 14. 요약

cooking-assistant 2026-05-02 08:23 → 08:37의 14분 hotfix는 **신경망 ASR의 가장 기초적인 구조를 잊어 발생한 버그**였다. 모델(`model.int8.onnx`)은 정수 인덱스 시퀀스를 출력할 뿐, 그 인덱스가 어떤 글자에 대응하는지는 토큰 사전(`tokens.txt`)이 결정한다. 25,055개 토큰의 멀티링구얼 어휘 테이블이 빠지면 디코더는 빈 문자열만 반환한다.

이 사건은 Azure 클라우드 STT를 sherpa-onnx 온디바이스로 교체하는 더 큰 의사결정의 일부였고, 그 동기는 "APK에 클라우드 키를 박을 수 없다"는 보안 요구였다. SenseVoice-Small INT8(228MB)은 한/중/일/영/광동 5개 언어 + ASR/LID/SER/AED 멀티태스크를 단일 NAR 패스로 처리하는, Android XR 헤드셋 환경에 최적의 선택이다. 다만 228MB ONNX의 패키징 방식(현재 Git LFS)은 별도 문서의 트러블 영역으로 이어진다.

---

# References

## sherpa-onnx / SenseVoice
- [sherpa-onnx GitHub (k2-fsa)](https://github.com/k2-fsa/sherpa-onnx)
- [sherpa-onnx 공식 문서](https://k2-fsa.github.io/sherpa/onnx/index.html)
- [SenseVoice 공식 문서 (sherpa-onnx)](https://k2-fsa.github.io/sherpa/onnx/sense-voice/index.html)
- [SenseVoice Pre-trained Models](https://k2-fsa.github.io/sherpa/onnx/sense-voice/pretrained.html)
- [FunAudioLLM/SenseVoice GitHub](https://github.com/FunAudioLLM/SenseVoice)
- [FunAudioLLM 논문 (arxiv:2407.04051)](https://arxiv.org/html/2407.04051v1)
- [FunAudioLLM/SenseVoiceSmall HF Hub](https://huggingface.co/FunAudioLLM/SenseVoiceSmall)
- [Next-gen Kaldi 소개 (Nadira Povey)](https://medium.com/@nadirapovey/next-gen-kaldi-what-is-it-68edd292f20d)
- [Paraformer 논문 (arxiv:2206.08317)](https://ar5iv.labs.arxiv.org/html/2206.08317)

## 디코딩 / 토큰화
- [CTC 아키텍처 (HF Audio Course)](https://huggingface.co/learn/audio-course/en/chapter3/ctc)
- [SentencePiece GitHub](https://github.com/google/sentencepiece)
- [ONNX 양자화 (ONNX Runtime)](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)
- [Silero VAD GitHub](https://github.com/snakers4/silero-vad)
- [sherpa-onnx VAD 문서](https://k2-fsa.github.io/sherpa/onnx/vad/index.html)

## 대안 ASR
- [whisper.cpp GitHub (ggerganov)](https://github.com/ggml-org/whisper.cpp)
- [Vosk API GitHub](https://github.com/alphacep/vosk-api)
- [Picovoice Cheetah](https://picovoice.ai/platform/cheetah/)
- [Picovoice Leopard](https://picovoice.ai/platform/leopard/)
- [Apple SpeechAnalyzer WWDC25](https://developer.apple.com/videos/play/wwdc2025/277/)
- [iOS 26 SpeechAnalyzer 가이드](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide)
- [Apple SpeechAnalyzer 공식 문서](https://developer.apple.com/documentation/Speech/bringing-advanced-speech-to-text-capabilities-to-your-app)
- [Gemini Nano Android 가이드](https://localaimaster.com/blog/gemini-nano-android-guide)

## 보안 / 클라우드 STT
- [Azure Speech REST API 인증](https://docs.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
- [Android API 키 보안 가이드 (PickMe)](https://medium.com/pickme-engineering-blog/securing-api-keys-and-sensitive-data-in-android-apps-a-practical-modern-guide-ab735ca11502)
- [Azure Speech 키 보안 Q&A](https://learn.microsoft.com/en-us/answers/questions/1275741/is-there-any-way-to-secure-an-azure-speech-service)
- [Android API 보안 위험](https://developer.android.com/privacy-and-security/risks/insecure-api-usage)

## 모바일 ML 패키징
- [Play Asset Delivery 공식](https://developer.android.com/guide/playcore/asset-delivery)
- [Android App Bundle 공식](https://developer.android.com/guide/app-bundle)
- [iOS On-Demand Resources](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/index.html)
- [Hugging Face Hub 문서](https://huggingface.co/docs/hub/en/index)

## 하드웨어 / XR
- [Snapdragon XR2 Gen 2 공식](https://www.qualcomm.com/xr-vr-ar/products/vr-mr-series/snapdragon-xr2-gen-2-platform)
- [Android XR 개발자 가이드 2026](https://www.digitalapplied.com/blog/android-xr-google-ai-glasses-developer-guide)

## 벤치마크 / 비교
- [오프라인 STT 벤치마크 (VoicePing)](https://voiceping.net/en/blog/research-offline-speech-transcription-benchmark/)
- [Edge STT 벤치마크 2025 (ionio.ai)](https://www.ionio.ai/blog/2025-edge-speech-to-text-model-benchmark-whisper-vs-competitors)
- [Vosk 음성 인식 2025](https://www.videosdk.live/developer-hub/stt/vosk-speech-recognition)
- [Whisper 정확도 비교 2026](https://novascribe.ai/how-accurate-is-whisper)

## 통합 사례
- [DashVoice (Home Assistant + sherpa-onnx)](https://github.com/ecohash-co/dash-voice)
- [OpenVoiceOS](https://www.openvoiceos.org/)
