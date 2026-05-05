---
layout: single
title: "Git LFS Pointer File 빌드 함정 — 빈손으로 패키징된 134바이트의 비극"
date: 2026-05-05 23:00:00 +09:00
categories: devops
excerpt: "Git LFS pointer 파일은 checkout 성공처럼 보여도 실제 바이너리 hydration이 빠지면 빌드 산출물에 가짜 대용량 자산이 조용히 섞이는 CI 함정이다."
toc: true
toc_sticky: true
tags: [gitlfs, ci, build, onnx, githubactions]
source: "/home/dwkim/dwkim/docs/devops/git-lfs-pointer-빌드함정.md"
---

TL;DR
- Git LFS는 추적 파일을 그대로 내려받는 것이 아니라 pointer → 실제 바이너리 hydration 단계를 반드시 거친다.
- self-hosted runner에서 git-lfs 미설치나 smudge 미동작은 빌드를 실패시키지 않고 100바이트대 pointer 텍스트를 산출물에 넣을 수 있다.
- 가장 안전한 대응은 checkout 직후·에디터 빌드 전·런타임 초기화 시점에 각각 pointer 검증 게이트를 두는 것이다.

## 1. 개념
Git LFS pointer file 함정은 Git이 워킹트리에 실제 바이너리 대신 작은 포인터 텍스트를 두는 구조와, 빌드 시스템이 그 차이를 자동으로 구분하지 못하는 문제를 설명한다.

## 2. 배경
대용량 ONNX 모델을 LFS로 관리하는 CI가 늘면서, checkout 로그만 보고 모델이 정상 hydrate됐다고 가정하는 실수가 자주 발생한다. 특히 self-hosted runner는 git-lfs 설치와 필터 등록까지 직접 책임져야 해서 누락 위험이 높다.

## 3. 이유
이 문제를 이해해야 빌드 성공과 런타임 정상 동작을 같은 것으로 착각하지 않는다. pointer 파일은 크기·경로·확장자가 모두 그럴듯해 보일 수 있어서, 명시적인 내용 검증과 방어선 설계가 없으면 재현과 진단에 큰 시간을 잃는다.

## 4. 특징
- pointer file은 100바이트대 평문이지만 원본 바이너리의 해시와 크기 메타데이터를 담는다
- `actions/checkout`의 `lfs: true`만으로는 호스트에 git-lfs가 없을 때 완전한 보장이 되지 않는다
- CI, Unity/Gradle pre-build, 앱 런타임에서 각각 별도 검증을 두는 defense-in-depth가 효과적이다
- size-only 확인은 우회될 수 있어 magic string·`git lfs pull`·실제 파싱 테스트를 함께 써야 한다

## 5. 상세 내용

# Git LFS Pointer File 빌드 함정 — 빈손으로 패키징된 134바이트의 비극

> **작성일**: 2026-05-05
> **카테고리**: DevOps / CI-CD / Build Pipeline / Git LFS / Self-hosted Runner / Defense-in-Depth
> **트리거**: cooking-assistant 2026-05-05 사건 — 자체 호스팅 GitHub Actions 러너에서 `actions/checkout@vN`이 `lfs: true`로 호출됐지만 호스트에 `git-lfs`가 없어 smudge filter가 silent no-op. 결과적으로 228MB `model.int8.onnx`가 134바이트 LFS pointer 텍스트로 체크아웃됐고, Unity Android 빌드가 그 134바이트짜리 텍스트 파일을 그대로 `StreamingAssets/`에 패키징. 디바이스에서 sherpa-onnx → ONNX Runtime이 protobuf 파싱 실패로 `abort()` 호출 → Unity 프로세스가 로그 한 줄 없이 즉사. Commit `bf4bf59` "fix(android): prevent pointer-packaged STT model crashes"가 CI workflow gate + Unity Editor pre-build gate + 런타임 가드 3단 방어막을 동시에 추가한 사건.
> **포함 내용**: LFS pointer file 스펙(`version`/`oid sha256:`/`size`), smudge / clean filter 호출 메커니즘, `git lfs install --local` vs `--system` 차이, `actions/checkout`의 `lfs:` 파라미터 시멘틱 (string vs bool, install 위치), self-hosted runner의 의존성 자가 책임 모델, GIT_LFS_SKIP_SMUDGE, `.lfsconfig`, `lfs.fetchinclude` / `lfs.fetchexclude`, `git lfs fsck`, `git lfs ls-files`, magic-string 검증 패턴, size-only 검증의 한계, IPreprocessBuildWithReport + callbackOrder 음수 우선순위, BuildFailedException 흐름, defense-in-depth 3-gate 모델 (CI/editor/runtime), 각 gate의 attack surface, 자체 호스팅 러너 하드닝 체크리스트, fork PR bandwidth 사보타주 (streamlink 사례), Hugging Face Hub의 Xet 마이그레이션 (2025-02-20), Meta Sapling/Mononoke의 LFS 거부, Apple App Thinning / On-Demand Resources, Bazel/Buck `http_file` SHA-pinned remote asset 패턴, container vs bare-metal runner 비교, cooking-assistant 5월 5일 사건 분석

---

# 1. 발생 사례 — cooking-assistant 2026-05-05

## 1.1 사건 한 줄 요약

> **134바이트짜리 텍스트 파일이 ONNX 모델 행세를 하며 APK 안에 곱게 들어갔다. 디바이스가 그 파일을 protobuf로 읽으려 하다가 native `abort()`로 죽었고, Unity는 어떤 로그도 남기지 않았다.**

## 1.2 사건 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│       cooking-assistant Pointer 패키징 사건 (2026-05-05)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [전제: 2026-05-02에 model.int8.onnx를 Git LFS로 추적 중]        │
│                                                                  │
│  T+0     자체 호스팅 GitHub Actions runner에서 Android 빌드       │
│            └─ ci.yml: actions/checkout@vN with lfs: true         │
│            └─ runner host에는 git-lfs 패키지가 없음              │
│                                                                  │
│            │                                                     │
│            ▼                                                     │
│                                                                  │
│  T+~30s  체크아웃 "성공" — 종료 코드 0, 경고도 없음               │
│            └─ smudge filter 미등록 → no-op                       │
│            └─ model.int8.onnx = 134 byte 텍스트 (LFS pointer)    │
│                                                                  │
│            │                                                     │
│            ▼                                                     │
│                                                                  │
│  T+~10m  Unity Android 빌드 진행                                  │
│            └─ StreamingAssets/.../model.int8.onnx 그대로 복사    │
│            └─ APK 빌드 성공, 사이즈만 230MB → 12MB로 줄어듦       │
│              (이상 신호 1: 아무도 안 봄)                          │
│                                                                  │
│            │                                                     │
│            ▼                                                     │
│                                                                  │
│  T+~15m  APK install / 실행                                       │
│            └─ LocalSpeechToTextService.init() 호출               │
│            └─ asset 134 byte → /data/.../model.int8.onnx 복사    │
│            └─ sherpa-onnx OfflineRecognizer.<init>(modelPath)    │
│            └─ JNI → C++ → ONNX Runtime: protobuf::ParseFrom(...) │
│            └─ 첫 4 byte가 "vers" → protobuf wire format 위반     │
│            └─ ORT_THROW → std::abort()                           │
│            └─ Unity native crash (mono runtime 동행 사망)         │
│                                                                  │
│            │  로그 한 줄 없음. logcat에 stack 없음. ANR 없음.      │
│            ▼                                                     │
│                                                                  │
│  진단     "왜 죽지?" → APK 사이즈 → asset 추출 → cat 결과:         │
│            version https://git-lfs.github.com/spec/v1            │
│            oid sha256:...                                        │
│            size 239xxxxxx                                        │
│            → 130바이트짜리 텍스트가 모델 자리에 들어 있었음        │
│                                                                  │
│            │                                                     │
│            ▼                                                     │
│                                                                  │
│  bf4bf59  fix(android): prevent pointer-packaged STT model       │
│           crashes                                                │
│           └─ Layer 1: CI gate (workflow에 hydrate+검증 step)     │
│           └─ Layer 2: Unity Editor IPreprocessBuildWithReport    │
│           └─ Layer 3: Android 런타임 init 가드                    │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 commit message가 못박은 의사결정

`bf4bf59` 본문에서 직접 인용:

```
Constraint: Self-hosted runner checkout can leave LFS pointer files.
Rejected: Docker-only fix | checkout runs on the runner host.
Directive: Keep CI model hydration and pointer checks before Android builds.
```

핵심은 **"Rejected: Docker-only fix"** 한 줄이다.

가장 자연스러운 1차 충동은 "그럼 빌드를 컨테이너 안에서 돌리자, git-lfs 깔린 이미지로" 였다. 그러나 이 사건의 구조는 그 fix를 받지 않는다 — `actions/checkout` 자체는 **runner host의 워크스페이스에서** 돌고, 이후 단계만 컨테이너로 들어가는 구성이라면 컨테이너 안에 git-lfs를 깔아도 이미 체크아웃된 워크스페이스에는 pointer가 박혀 있다. 컨테이너를 더 크게 잡아서 checkout까지 그 안에서 돌리면 self-hosted runner의 보안/성능 가정이 흐트러진다 (자체 캐시 디렉토리, GPU 패스스루, 빌드 산출물 보존 등). 그래서 채택된 방향은 "**checkout이 어디서 돌든 그 직후에 hydration을 다시 강제하고, 그게 실패했는지 검증한다**" — 그리고 그 검증을 **빌드의 모든 길목에 박는다**.

## 1.4 왜 이 문서를 별도로 쓰는가

자매 문서 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md)는 저장소·대역폭 관점 (SHA-1 객체 모델, 100MB 한도, GitHub LFS quota, R2/HF/DVC 대안). 이 문서는 그 위 직교 단면 — **"LFS 파일이 hydration에 실패해도 빌드 시스템이 모르고 지나간다는 사실"**. 저 문서가 "왜 큰 파일을 LFS에 두는가" 라면, 이 문서는 "LFS에 두기로 한 순간부터 추가로 깔아야 할 안전망"이다.

---

# 2. 용어 사전

## 2.1 LFS pointer / filter

| 용어 | 풀이 |
|------|-----|
| **LFS pointer file** | LFS가 추적하는 파일 자리에 Git이 실제로 저장하는 ~130바이트 평문 텍스트. 3줄: `version` URL, `oid sha256:<hex>`, `size <bytes>` |
| **clean filter** | `git add` 시 호출. **실제 파일 → pointer**로 변환. 실제 바이너리는 LFS 서버로 업로드 |
| **smudge filter** | `git checkout` 시 호출. **pointer → 실제 파일**로 복원. LFS 서버에서 OID로 fetch 후 워킹 트리에 풂 |
| **OID** | Object ID — LFS 객체의 SHA-256 해시 (Git의 SHA-1 객체 ID와 별도) |
| **HTTPS Batch API** | LFS 클라이언트와 서버가 OID 다운로드/업로드 URL을 협상하는 프로토콜 |
| **silent no-op** | smudge filter가 등록 안 돼 있으면 `git checkout`이 pointer 텍스트를 **그대로** 워킹 트리에 둔다. 에러도 경고도 없다 |

## 2.2 LFS CLI 핵심 동사

| 명령 | 풀이 |
|------|-----|
| **`git lfs install`** | 현재 사용자(또는 system) Git config에 LFS filter 등록 (`filter.lfs.clean`, `filter.lfs.smudge`, `filter.lfs.process`, `filter.lfs.required`) |
| **`git lfs install --local`** | `.git/config`에만 등록 — **현재 repo 한정**. CI에서 안전 |
| **`git lfs install --system`** | `/etc/gitconfig`에 등록 — 머신 전역. self-hosted runner 사전 프로비저닝 시 사용 |
| **`git lfs install --skip-smudge`** | filter는 등록하되 smudge는 비활성. 명시 `pull`/`fetch`로만 hydration |
| **`git lfs pull`** | 현 워킹 트리의 pointer들을 모두 hydration |
| **`git lfs pull --include=PATTERN`** | 패턴 매치 파일만 선택적 hydration (cooking-assistant 채택) |
| **`git lfs fetch`** | LFS 객체를 로컬 캐시(`.git/lfs/objects/`)에 가져오기만, 워킹 트리는 안 건드림 |
| **`git lfs checkout`** | 이미 fetch된 객체를 워킹 트리로 풂 (smudge 단독 실행) |
| **`git lfs ls-files`** | 현 트리의 LFS 추적 파일 목록 + OID + 상태 (`*` hydrated, `-` pointer) |
| **`git lfs fsck`** | LFS 객체 무결성 검사 (OID 재계산 vs 저장값 비교) |

## 2.3 환경변수 / 설정

| 키 | 풀이 |
|------|-----|
| **`GIT_LFS_SKIP_SMUDGE=1`** | clone/checkout 시 smudge 호출 스킵. 이후 명시적 fetch만 |
| **`.lfsconfig`** | repo 루트의 LFS 전용 설정 파일 (`.gitconfig`와 별도). 팀 공유용 |
| **`lfs.fetchinclude`** | 기본 fetch 시 포함할 path glob (콤마 구분) |
| **`lfs.fetchexclude`** | 기본 fetch 시 제외할 path glob |
| **`lfs.url`** | LFS 서버 엔드포인트 (R2 proxy, 자체 호스팅 등 우회) |
| **`lfs.concurrenttransfers`** | 병렬 전송 수 (기본 8) |

## 2.4 actions/checkout `lfs:` 파라미터

| 값 | 의미 |
|------|------|
| **`false`** (기본) | smudge 비활성. pointer만 둠 |
| **`true`** | `git lfs fetch` + `git lfs checkout` 호출 — **단, runner에 git-lfs가 PATH에 있어야 함** |
| **string `'true'`** | YAML 파싱상 동일하나, [actions/checkout 이슈에서 알려진 트랩](https://github.com/actions/checkout/issues/758): expression 결과가 string `"True"` 같이 오면 boolean 판정이 false로 가는 경우 존재 |

`lfs:`는 boolean이지만 GitHub Actions에서 `${{ inputs.lfs }}` 같은 expression을 통해 값을 넘기면 string으로 직렬화되는 경로가 있어, 명시적으로 `lfs: true` 리터럴로 두는 편이 안전.

---

# 3. Pointer File의 해부학

## 3.1 정확한 스펙 (Git LFS spec)

[git-lfs/git-lfs `docs/spec.md`](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md) 공식 명세:

```
- 첫 줄은 무조건 `version <URL>`
- 이후 줄들은 키 알파벳순 정렬 (version 제외)
- 각 줄: `<key> <value>\n` — 키와 값 사이는 정확히 스페이스 1칸
- 줄 끝은 `\n` 단독 (CRLF 아님)
- 파일 끝에도 `\n` 필수
- 전체 크기: 1024 byte 미만 (extension line 포함)
- 동일 파일에 대한 정규(canonical) 인코딩은 **유일**
```

## 3.2 cooking-assistant이 만난 134바이트의 정체

```
version https://git-lfs.github.com/spec/v1\n
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393\n
size 239456789\n
```

세 줄, 134바이트 (개행 3개 포함). 이 텍스트가 `model.int8.onnx`라는 이름으로 워킹 트리에 있었고, Unity는 이걸 protobuf 모델로 알고 APK에 넣었다.

## 3.3 Pointer vs Blob 비교

```
┌─────────────────────────────────────────────────────────────────┐
│   같은 파일이 LFS hydration 전후로 어떻게 보이는가                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✗ Hydration 실패 (pointer 그대로):                              │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ $ ls -la model.int8.onnx                              │     │
│  │ -rw-r--r--  1 build build    134 May  5 08:51         │     │
│  │                                                         │     │
│  │ $ file model.int8.onnx                                │     │
│  │ model.int8.onnx: ASCII text                           │     │
│  │                                                         │     │
│  │ $ head -c 64 model.int8.onnx                          │     │
│  │ version https://git-lfs.github.com/spec/v1            │     │
│  │ oid sha256:4d7a21...                                  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                  │
│  ✓ Hydration 성공 (실제 blob):                                   │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ $ ls -la model.int8.onnx                              │     │
│  │ -rw-r--r--  1 build build  239456789 May 5 08:51      │     │
│  │                                                         │     │
│  │ $ file model.int8.onnx                                │     │
│  │ model.int8.onnx: data                                  │     │
│  │                                                         │     │
│  │ $ xxd model.int8.onnx | head -1                       │     │
│  │ 0000  08 03 12 0e 6f 6e 6e 78 ... (protobuf magic)    │     │
│  └───────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

차이는 단순히 사이즈가 아니라 **파일 타입 자체**다. 한쪽은 평문 텍스트, 한쪽은 binary protobuf. 그런데 둘 다 확장자는 `.onnx`이고, 이름이 같고, OS는 둘 다 그냥 파일로 본다.

## 3.4 왜 magic-string 검증이 정답인가

검증 후보를 쌓아 보자:

| 후보 | 가능성 | 한계 |
|------|--------|------|
| **(a) size > 1MB** | 빠르고 단순 | pointer는 항상 ~134B라 잡히긴 함. 그러나 "1MB 미만 정상 모델"이 등장하는 순간 false positive |
| **(b) 확장자 검사** | 의미 없음 | pointer도 `.onnx` 이름 그대로 |
| **(c) `file(1)` MIME** | 어느 정도 됨 | runner에 `file` 미설치 케이스, 결과 문자열 변동 |
| **(d) protobuf magic byte** | 정확 | ONNX는 protobuf — 첫 바이트 `08` 등을 검사. 단, 모델 포맷이 바뀌면 깨짐 |
| **(e) `git lfs fsck`** | 정석 | 느림, repo 전체 검사. CI 실패 시점 분리가 어려움 |
| **(f) "version https://git-lfs.github.com/spec" 부분 문자열 검사** | **가장 신뢰 가능** | spec이 첫 줄 = `version <URL>`로 못박혀 있고, 이 prefix는 deterministic |

> **(f)가 답**이다. spec이 "첫 줄은 항상 `version`이고 URL이 곧바로 따라온다"고 못박았기 때문에, 이 prefix는 영원히 안정적인 시그니처다. cooking-assistant의 fix도 (a) + (f) 조합을 채택했다 — (a)는 "검증 통과 여부 떠나서 너무 작으면 일단 막자" 백업, (f)는 본 시그니처 검사.

---

# 4. 왜 silent no-op이 발생하는가

## 4.1 actions/checkout 코드 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│       actions/checkout @ runner에서 lfs: true일 때 흐름          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. setup → workspace 디렉토리 정리                              │
│  2. git fetch <ref>                                              │
│  3. git checkout <ref>                                           │
│       └─ 이 시점에 .gitattributes의 filter=lfs 인식              │
│       └─ Git이 등록된 smudge filter 호출 시도                    │
│       └─ filter.lfs.smudge config가 없거나                       │
│         거기 지정된 명령(`git-lfs smudge`)이 PATH에 없으면       │
│         Git의 기본 fallback: "그냥 blob 내용을 워킹 트리에 둠"   │
│         → pointer 텍스트가 그대로 파일로 풀림                    │
│                                                                  │
│  4. (lfs: true인 경우) await git.lfsInstall() + git.lfsFetch()  │
│       └─ 그러나 git-lfs 자체가 없으면                            │
│         → 이 호출도 "command not found" 에러                     │
│         → action이 에러로 중단되긴 함                            │
│                                                                  │
│  ⚠️ 핵심 함정:                                                    │
│       "git-lfs가 부분적으로 설치돼서 PATH엔 있지만                │
│         filter가 등록(register)되지 않은 상태"                    │
│       → 4단계가 통과하고                                          │
│       → 3단계에서 이미 풀린 pointer는 그대로 남음                 │
│                                                                  │
│       또는 self-hosted runner에서 이전 user account가             │
│       `git lfs install --local`을 써서 다른 워크스페이스에만      │
│       등록해 둔 경우, 이번 워크스페이스의 .git/config는 비어 있음 │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 GitHub-hosted vs Self-hosted Runner

| 차원 | GitHub-hosted (`ubuntu-latest`) | Self-hosted (cooking-assistant) |
|------|--------------------------------|-------------------------------|
| OS / 의존성 | GitHub가 image로 사전 프로비저닝, **git-lfs 기본 포함** | 사용자 책임 — 직접 설치 / 업데이트 |
| 빌드 격리 | 매 job마다 새 VM | 같은 머신 재사용 (워크스페이스만 정리) |
| 캐시 | runner 단 ephemeral | runner 디스크에 누적 |
| `git-lfs` 보장 | ✓ (image 스펙) | ✗ (별도 설치 필요) |
| 잘못된 상태 누적 | 사실상 없음 | 가능 — 이전 job이 만든 `.git/lfs` 캐시, config 잔여 |

> GitHub 공식 문서: *"You are responsible for updating the operating system and all other software."* — self-hosted runner는 **명시적으로** 의존성 자가 책임 모델이다.

## 4.3 시각화: hydration 실패 분기

```
┌─────────────────────────────────────────────────────────────────┐
│         actions/checkout이 LFS 파일을 만나는 4가지 시나리오      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Case A: lfs:false, git-lfs 설치 안 됨                           │
│    → pointer 그대로. 의도된 동작. (CI에서 흔한 정상 패턴)        │
│                                                                  │
│  Case B: lfs:true, git-lfs 설치됨, filter 등록됨                 │
│    → 정상 hydration. 우리가 기대하는 모습.                        │
│                                                                  │
│  Case C: lfs:true, git-lfs 설치 안 됨                            │
│    → action이 git-lfs 호출 단계에서 명시적 에러로 중단            │
│    → CI 빨간불. 발견 빠름.                                        │
│                                                                  │
│  Case D: lfs:true, git-lfs는 PATH에 있는데 filter 미등록          │
│    → ★ cooking-assistant가 만난 시나리오 ★                       │
│    → checkout 단계 smudge no-op (pointer 잔존)                    │
│    → 이후 git lfs install/fetch는 통과                            │
│    → CI 초록불, 그러나 워킹 트리는 거짓                            │
└─────────────────────────────────────────────────────────────────┘
```

Case D가 가장 위험한 이유: **CI는 성공하고, 빌드는 성공하고, APK도 만들어진다.** 실패는 디바이스 런타임으로 미뤄진다.

---

# 5. cooking-assistant의 3-Gate 방어막

## 5.1 전체 그림

```
┌──────────────────────────────────────────────────────────────────────┐
│            Defense-in-Depth: 한 모델, 세 검문소                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│   │  Gate 1: CI     │ → │  Gate 2: Editor │ → │  Gate 3: Runtime│   │
│   │  workflow YAML  │   │  Pre-build hook │   │  init() 가드     │   │
│   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤   │
│   │ 잡는 attack     │   │ 잡는 attack     │   │ 잡는 attack     │   │
│   │ surface:        │   │ surface:        │   │ surface:        │   │
│   │                 │   │                 │   │                 │   │
│   │ • CI 빌드만     │   │ • 로컬 git lfs  │   │ • 사이드로드     │   │
│   │ • runner LFS    │   │   pull 깜빡함   │   │ • 수동 빌드된    │   │
│   │   환경 결손     │   │ • 새 dev 머신   │   │   APK            │   │
│   │ • Case D        │   │ • partial clone │   │ • 사내 배포 후    │   │
│   │                 │   │                 │   │   asset 손상     │   │
│   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤   │
│   │ 실행 시점:      │   │ 실행 시점:      │   │ 실행 시점:      │   │
│   │ checkout 직후   │   │ Build 시작 전   │   │ 앱 실행 init    │   │
│   │                 │   │ (callbackOrder  │   │                 │   │
│   │                 │   │  = -100)        │   │                 │   │
│   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤   │
│   │ 실패 모드:      │   │ 실패 모드:      │   │ 실패 모드:      │   │
│   │ exit 1          │   │ BuildFailed-    │   │ IOException     │   │
│   │ → CI 빨간불     │   │ Exception       │   │ → catch → 정상  │   │
│   │                 │   │ → Build 중단    │   │   에러 메시지    │   │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘   │
│                                                                       │
│   각 gate는 **앞 gate를 신뢰하지 않는다**. 같은 검사를 반복한다.       │
└──────────────────────────────────────────────────────────────────────┘
```

## 5.2 Gate 1 — CI workflow gate (`.github/workflows/ci.yml`)

`bf4bf59`가 추가한 step (Android 빌드 job 2곳에 동일하게):

```yaml
- uses: actions/checkout@v4
  with:
    clean: false
    lfs: true

- name: Pull local STT model from Git LFS
  run: |
    git lfs install --local
    git lfs pull --include="src/Assets/StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx"
    MODEL_PATH="src/Assets/StreamingAssets/SherpaOnnx/sense-voice/model.int8.onnx"
    MODEL_SIZE="$(wc -c < "$MODEL_PATH")"
    if [[ "$MODEL_SIZE" -lt 1048576 ]]; then
      echo "Local STT model was not hydrated from Git LFS: $MODEL_PATH is ${MODEL_SIZE} bytes." >&2
      exit 1
    fi
    if head -c 64 "$MODEL_PATH" | grep -q "git-lfs.github.com/spec"; then
      echo "Local STT model is still a Git LFS pointer. Install/configure git-lfs on the build runner." >&2
      exit 1
    fi
```

핵심 디자인 결정 5가지:

```
1. `git lfs install --local`
   → repo .git/config에만 filter 등록. /etc/gitconfig 안 건드림.
   → self-hosted runner의 다른 작업/사용자에 영향 없음.

2. `git lfs pull --include=<단일 파일>`
   → 다른 LFS 파일 (있다면) 무시.
   → bandwidth 절약.

3. wc -c 후 1 MiB 미만 검사
   → "검증 통과 못 해도 일단 너무 작으면 막아라" 1차 필터.
   → spec 상 pointer는 1024 byte 미만이라 무조건 걸림.
   → 정상 모델은 228 MB라 절대 안 걸림.

4. head -c 64 + grep "git-lfs.github.com/spec"
   → spec의 첫 줄 prefix 검사.
   → 64 byte로 충분 — pointer 첫 줄이 "version https://git-lfs.github.com/spec/v1"
     (40 byte 정도)이라 64 byte면 무조건 포함.

5. exit 1로 명시적 실패
   → CI 빨간불. 다음 step (Unity 빌드) 진입 안 함.
```

> 왜 단순히 `actions/checkout`의 `lfs: true`를 신뢰하지 않고 다시 `git lfs pull`을 거는가? — checkout 단계의 smudge가 silent no-op일 수 있기 때문 (Case D). `git lfs install --local` + `git lfs pull`을 명시적으로 다시 거는 것 자체가 hydration 재시도 + 검증 트리거다.

## 5.3 Gate 2 — Unity Editor pre-build gate

`src/Assets/Editor/LocalSherpaModelBuildValidator.cs` 전체 (bf4bf59 신규):

```csharp
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

/// <summary>
/// Prevents Android builds that would package a Git LFS pointer
/// instead of the local STT model.
/// </summary>
public class LocalSherpaModelBuildValidator : IPreprocessBuildWithReport
{
    const long MinModelBytes = 1024L * 1024L;
    const string GitLfsPointerPrefix = "version https://git-lfs.github.com/spec/v1";

    public int callbackOrder => -100;

    public void OnPreprocessBuild(BuildReport report)
    {
        if (report.summary.platform != BuildTarget.Android)
            return;

        var modelPath = Path.Combine(
            Application.dataPath,
            "StreamingAssets",
            "SherpaOnnx",
            "sense-voice",
            "model.int8.onnx"
        );
        var fileInfo = new FileInfo(modelPath);

        if (!fileInfo.Exists)
        {
            throw new BuildFailedException(
                "[LocalSherpaModelBuildValidator] Missing local STT model: " + modelPath
            );
        }

        if (fileInfo.Length < MinModelBytes)
        {
            throw new BuildFailedException(
                "[LocalSherpaModelBuildValidator] Local STT model is too small ("
                    + fileInfo.Length
                    + " bytes). Run git lfs pull before building Android."
            );
        }

        var prefix = ReadPrefix(fileInfo);

        if (prefix.StartsWith(GitLfsPointerPrefix))
        {
            throw new BuildFailedException(
                "[LocalSherpaModelBuildValidator] Local STT model is a Git LFS pointer. Run git lfs pull before building Android."
            );
        }
    }

    static string ReadPrefix(FileInfo fileInfo)
    {
        var buffer = new byte[128];
        using var stream = fileInfo.OpenRead();
        var bytesRead = stream.Read(buffer, 0, buffer.Length);
        return Encoding.UTF8.GetString(buffer, 0, bytesRead);
    }
}
```

설계 포인트:

- **`IPreprocessBuildWithReport`** — Unity 6 빌드 라이프사이클 훅, Player 빌드 시작 직전 호출
- **`callbackOrder = -100`** — Unity는 `IOrderedCallback.callbackOrder`를 오름차순 호출. 음수일수록 먼저 → 다른 어떤 pre-build hook보다 먼저 실행 보장. 모델을 옮기거나 변환하는 다른 hook이 깨진 pointer를 만나기 전에 우리가 먼저 막는다
- **platform 가드** — Android만 모델 패키징하므로 다른 플랫폼은 early-return으로 false positive 방지
- **`Application.dataPath`** — Editor 컨텍스트에서 "Project/Assets" 디렉토리. 빌드 시점엔 APK가 아직 없으므로 source asset 검사
- **`BuildFailedException`** — Unity 빌드 시스템 표준 실패 신호, Editor 콘솔에 빨간 에러로 노출
- **CI gate와 동일한 1MB + magic-string 검사** — 의도적 중복, single source of truth 안 함

## 5.4 Gate 3 — Android 런타임 가드

`src/Assets/Plugins/Android/LocalSpeechToTextService.java`에 추가된 검증 (요지):

```java
private static final long MIN_MODEL_ASSET_BYTES = 1024L * 1024L;
private static final String GIT_LFS_POINTER_PREFIX =
    "version https://git-lfs.github.com/spec/v1";

private void validateModelAsset(AssetManager assetManager, String resolvedPath)
        throws IOException {
    long assetLength = getAssetLength(assetManager, resolvedPath);
    if (assetLength >= 0 && assetLength < MIN_MODEL_ASSET_BYTES) {
        throw new IOException(
            "Local STT model asset is too small ("
                + assetLength + " bytes): " + resolvedPath
                + ". Run git lfs pull before building."
        );
    }

    byte[] prefix = readAssetPrefix(assetManager, resolvedPath);
    String prefixText = new String(prefix, StandardCharsets.UTF_8);
    if (prefixText.startsWith(GIT_LFS_POINTER_PREFIX)) {
        throw new IOException(
            "Local STT model asset is a Git LFS pointer, not an ONNX model: "
                + resolvedPath
                + ". Run git lfs pull before building."
        );
    }
}
```

이 gate가 막는 시나리오:

```
• 사이드로드된 APK (CI 거치지 않은 빌드)
• 외부 빌드 서버에서 만든 APK
• 사내 배포 시스템이 수동 빌드한 APK
• APK 자체가 정상이었으나 OTA 업데이트 / asset patcher 버그로
  StreamingAssets가 손상된 케이스 (드물지만 가능)

→ sherpa-onnx native init이 abort()로 죽기 전에
  Java 레이어에서 IOException으로 깔끔하게 캐치.
→ 사용자에게 보여줄 수 있는 에러 메시지 발생.
→ Crashlytics / Sentry에 stack trace로 잡힘.
```

> **왜 native abort 전에 막는 게 중요한가**: ONNX Runtime의 protobuf 파서가 실패하면 C++ exception → ORT_THROW → 처리되지 않은 native exception → `std::abort()` → Android는 이걸 SIGABRT로 받고 프로세스 즉시 종료. **Java try/catch가 작동할 시간조차 없다**. logcat에 native crash dump는 남지만 디버그 심볼 없이는 거의 해독 불가.

## 5.5 한 layer 빠지면 어떻게 되나

| 빠진 layer | 잡지 못하는 케이스 |
|----------|-------------------|
| Gate 1 (CI) 만 빠짐 | CI에서 빌드 산출물(APK)이 망가진 채 배포 파이프라인까지 진입 |
| Gate 2 (Editor) 만 빠짐 | 로컬 dev가 git lfs pull 깜빡한 빌드 — Editor에서 만들어진 APK가 디바이스로 직행 |
| Gate 3 (Runtime) 만 빠짐 | CI도 통과 + Editor도 통과한 APK가 런타임에 손상되는 경로 (asset patcher 버그, 사이드로드된 다른 APK)를 못 잡음 |
| **모두 빠짐** | **사건 재발** |

3-gate는 redundancy가 아니라 **각자 다른 attack surface**를 책임진다.

---

# 6. CI Hydration 패턴 비교

## 6.1 5가지 옵션

| 패턴 | 설명 | Pros | Cons |
|------|------|------|------|
| **(A) `actions/checkout` `lfs: true`** | checkout 액션이 알아서 hydration | 가장 단순, 한 줄 설정 | self-hosted runner에서 silent no-op (Case D), 매번 전체 LFS 다운로드 |
| **(B) 명시 `git lfs pull --include=...`** | checkout 후 별도 step에서 선택 hydration + 검증 (cooking-assistant 채택) | hydration 재시도 + 검증을 같은 step에 묶음, bandwidth 절약 | step이 명시적으로 추가됨, 누구나 잊을 수 있음 |
| **(C) `actions/cache` + `nschloe/action-cached-lfs-checkout`** | LFS 객체를 actions cache에 저장 | bandwidth 자릿수 단위 절감, fork PR 안전 | 캐시 key 설계 필요, 첫 빌드는 여전히 풀 다운로드 |
| **(D) LFS 우회 — S3/R2/HF Hub에서 직접 다운로드** | repo에서 LFS 추적 자체 제거, build 스크립트가 외부에서 받아옴 | LFS quota 0 사용, R2면 egress 0 | 인프라 추가, 모델 버저닝을 별도로 관리 |
| **(E) Container runner with pre-installed git-lfs** | runner를 Docker 이미지 기반으로 운영, 이미지에 git-lfs 포함 | 환경 결정성 ↑ | 이미지 빌드/유지 비용, GPU/passthrough 시 복잡, **checkout이 host에서 돌면 무용** |

## 6.2 cooking-assistant는 왜 (B)를 골랐나

```
선택지 분석:
  (A) actions/checkout lfs:true 자체가 문제의 원인 → 부족
  (B) 명시 hydration + 검증 → 채택
  (C) 캐시까지 추가하면 좋지만 사건의 본질 (silent no-op)을
      먼저 해결하고 나중에 얹기로 — 단계적 개선
  (D) sherpa-onnx 모델은 공개 모델이라 HF Hub 마이그레이션이
      장기적으로 합리. 단 5월 5일 핫픽스로는 과한 변경.
  (E) Rejected (commit message): "Docker-only fix |
      checkout runs on the runner host" — checkout이
      runner host에서 돌고 그 결과가 이미 잘못돼 있으면
      컨테이너에서 다시 빌드해도 소용없음.

결론: (B) + 3-gate 방어막 = 즉시 작동하는 root-cause fix.
      (C), (D)는 후속 개선으로 backlog.
```

## 6.3 Container vs Bare-metal Runner

| 차원 | Container runner | Bare-metal self-hosted |
|------|------------------|------------------------|
| 환경 결정성 | 매우 높음 (이미지) | 낮음 (수동 관리) |
| git-lfs 보장 | Dockerfile에 명시하면 보장 | 매번 체크 필요 |
| 캐시 전략 | volume mount 필요 | runner 디스크 그대로 |
| GPU / 디바이스 패스스루 | 까다로움 | 직접 사용 |
| 빌드 산출물 보존 | volume / artifact upload | 디스크에 그대로 |
| 코스트 | 이미지 빌드/유지 | 사실상 0 |
| **checkout 위치** | **host인지 컨테이너인지 구성에 따라 다름 — 핵심 함정** | host에서 돔 |

> 구성을 잘못 짜면 **checkout은 host에서, 빌드는 컨테이너에서** 도는 hybrid가 된다. host에 git-lfs가 없으면 결과는 cooking-assistant 사건과 동일. 컨테이너 runner를 쓴다고 자동 해결 아님.

---

# 7. 베스트 프랙티스 vs 안티패턴

## 7.1 베스트 프랙티스

```
✓ Build-time validator를 별도 컴포넌트로
  → CI gate "만" 두면 누군가 wire-up 잊었을 때 통과
  → 빌드 시스템 자체가 검사 — 잊을 수 없게

✓ Magic-string 검증을 canonical idiom으로
  → "version https://git-lfs.github.com/spec" 이 표준 prefix
  → spec이 지정한 deterministic 시그니처

✓ Size-only check는 1차 백업으로만
  → pointer는 항상 1KB 미만이라 잡히긴 함
  → 그러나 "1KB 미만 정상 파일"이 늘어나면 false positive
  → 항상 magic-string와 함께

✓ `git lfs install --local` (CI 안에서)
  → /etc/gitconfig 오염 방지
  → 다음 job/사용자에 영향 없음

✓ Selective `git lfs pull --include=`
  → 필요한 파일만, bandwidth 절약, 빌드 빠름

✓ Self-hosted runner image / 프로비저닝 스크립트에 git-lfs 포함
  → ansible/cloud-init/Packer에 명시
  → "사람이 깔았다 빠졌다" 상태 차단

✓ 정기적 `git lfs fsck`
  → repo 무결성 점검
  → CI nightly에서 1회

✓ 검증 실패 메시지에 "어떻게 고치는지" 적기
  → "Run git lfs pull before building" 같은 actionable 메시지
  → bf4bf59의 모든 메시지가 이 규칙 따름
```

## 7.2 안티패턴

```
✗ "actions/checkout lfs:true니까 끝" 가정
  → silent no-op (Case D) 무방비

✗ Size-only 검증
  → false positive/negative 모두 가능

✗ Single point of validation
  → CI gate만, runtime guard만, editor hook만 — 어느 하나도 부족

✗ `git lfs install --system`을 CI step에서
  → /etc/gitconfig 오염, 다른 job 영향 가능

✗ `git lfs install` 없이 `git lfs pull`
  → filter가 등록 안 된 상태에서 pull 결과를 워킹 트리에 못 풀 수 있음

✗ 검증 실패 시 silent skip / warning만
  → "다음에 고치겠지" 가정 — 안 고침. exit 1 / throw가 정답

✗ Forks PR에서 LFS 무방비 노출
  → 공격자가 fork → CI 트리거 반복 → 원본 LFS bandwidth 소진
  → streamlink, ffmpeg 등 공개 사례 다수

✗ git-lfs를 self-hosted runner에 사람이 SSH로 깔기
  → 다음 머신 / 재구축 시 빠짐

✗ 컨테이너 빌드 = 안전 가정
  → checkout이 host에서 돌면 결국 같은 함정
```

## 7.3 fork PR Bandwidth 사보타주 (요약)

공격 흐름: 공격자가 public repo fork → fork에서 PR 생성 → 원본 workflow가 PR로 트리거 → CI의 `actions/checkout lfs:true`가 **원본 quota에서** LFS 다운로드 → PR open/close 반복 → quota 소진 → LFS 자동 비활성화 → 정상 사용자도 LFS 객체를 못 받음. 실제 사례: [streamlink Issue #811](https://github.com/streamlink/streamlink/issues/811). 방어: fork PR workflow는 `lfs:false`로, 또는 `nschloe/action-cached-lfs-checkout`으로 캐시 우선, 또는 fork PR은 별도 workflow + 메인테이너 승인 후 풀 빌드. 자세한 quota / billing 분석은 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §6, §7 참조.

---

# 8. 등장 배경과 진화 타임라인

## 8.1 왜 pointer-vs-blob 모델이 silent fail하나

Git LFS의 핵심 가정 두 개: (1) 모든 사용자가 모든 LFS 파일을 다 받지는 않는다 (부분 hydration), (2) clone은 빠르게 끝나야 한다 (200MB × 10버전 = 2GB clone 회피). 이 디자인의 부수효과로, **Git 입장에서 "pointer를 그대로 두는 것은 유효한 상태"** 다 — `GIT_LFS_SKIP_SMUDGE=1`을 의도적으로 쓰는 사용자가 정상 케이스로 존재하기 때문. 그래서 smudge가 안 돌면 워킹 트리에 pointer가 남는 건 default behaviour지 에러가 아니다.

문제는 **빌드 시스템의 관점에서 그 default가 곧 사고**라는 것. Git LFS 자체가 잘못 설계된 건 아니고, 빌드/런타임 측이 검증할 책임이 있다는 사실이 잘 알려지지 않았을 뿐.

## 8.2 진화 타임라인

```
2010    git-annex (Joey Hess) — symlink 기반 분산 파일 추적
2013    git-fat (Atlassian/Cyan) — SHA → 외부 파일 매핑, LFS의 사상적 선조
2015.04 GitHub Git LFS 1.0 발표 (Rick Olson + Atlassian Steve Streeting,
        Chris Wanstrath CEO 블로그) — MIT 오픈소스
2015.10 Git LFS v1.0.0 정식
2017    lfs-test-server — 자체 호스팅 표준 구현
2018    File Locking (LFS 2.0)
2023    SSH 프로토콜 지원
2024.08 Hugging Face가 XetHub 인수
2025.02.20 Hugging Face Migration Day — 4.5TB LFS→Xet,
           Hub 트래픽의 약 6%가 Xet으로 이동
2026.05.05 cooking-assistant pointer 패키징 사고 → bf4bf59 3-gate 방어막
```

## 8.3 스펙 근거

[git-lfs/git-lfs `docs/spec.md`](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md): 첫 줄은 항상 `version <URL>` (URL 자체가 spec 버전 식별자), 이후 줄들은 키 알파벳순, 각 줄 `<key> SP <value> LF`, 전체 < 1024 byte, canonical encoding은 유일. 필수 키 3개 (`version`, `oid sha256:<64hex>`, `size <decimal>`). **이 결정성이 magic-string 검증을 신뢰 가능하게 만든다.**

---

# 9. 빅테크/오픈소스의 다른 길

## 9.1 Hugging Face — Xet으로 LFS 탈출

Hub에 25M+ 모델, 일부는 수십 GB. LFS는 file-level dedup만 가능 → fine-tuning 시 가중치 일부만 바뀌어도 전체 파일 재업로드. **Xet** (2024.08 XetHub 인수)는 Content-Defined Chunking (~64KB) + byte-level dedup + Merkle tree로 변경 chunk만 전송. 5GB SQLite 업데이트 LFS 13분 → Xet 0.1초 사례. **2025.02.20 Migration Day** 이후 신규 repo는 Xet 기본. Xet 클라이언트는 hydration 상태를 명시적으로 검증해 silent no-op 함정도 함께 해소.

cooking-assistant의 sherpa-onnx 모델이 공개라면 이미 HF Hub에 있고 Xet 위에서 호스팅된다. 장기적으로 LFS 의존을 빼고 build-time `huggingface_hub.hf_hub_download`로 갈아타는 게 합리적.

## 9.2 Meta Sapling/Mononoke, MS Scalar — 가상 파일시스템 모델

Meta는 monorepo (수십 TB)를 Mercurial 기반 **Mononoke** + **EdenFS** 가상 파일시스템으로 운영 (2022 Sapling으로 오픈소스화). Microsoft는 Windows monorepo (300GB+)를 **GVFS → Scalar**로 운영.

| 차원 | Git LFS | GVFS / Scalar | EdenFS (Meta) |
|------|---------|---------------|---------------|
| 파일 표현 | pointer 텍스트 | 정상 파일 (가상화) | 정상 파일 (가상화) |
| Hydration 신호 | 사용자가 명시 | OS-level read trigger | OS-level read trigger |
| Silent no-op | 가능 | 거의 불가능 | 거의 불가능 |

가상 파일시스템 모델은 pointer 함정을 구조적으로 회피한다. 단 OS 의존(Windows projfs / Linux FUSE)이 따라온다.

## 9.3 Apple — On-Demand Resources / Background Assets

Apple은 "큰 binary asset을 어떻게 ship할까"를 LFS와 정반대로 풀었다:

- **App Thinning** (iOS 9+): App Store가 디바이스 변종을 자동 선택 다운로드
- **On-Demand Resources**: tag로 묶은 asset을 `NSBundleResourceRequest`로 lazy fetch, App Store CDN이 호스팅
- **Background Assets** (iOS 16+): 앱 설치 직후 백그라운드 다운로드 — 첫 실행 전에 큰 모델 hydration 가능

대규모 ML 모델을 ship한다면 OS의 asset delivery 메커니즘이 본질적으로 안전 — CI에서 LFS 안 받으니 pointer 함정 자체가 사라진다. 대응 Android 메커니즘은 **Play Asset Delivery** (자세히는 [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §11).

## 9.4 Bazel / Buck — `http_file` SHA-pinned 패턴

```python
# Bazel WORKSPACE.bazel
http_file(
    name = "sherpa_sense_voice_int8",
    urls = ["https://huggingface.co/.../model.int8.onnx"],
    sha256 = "4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393",
)
```

binary는 source repo에 없고, URL + SHA-256만 commit. Bazel이 build 시 다운로드 + 해시 검증, 실패 = 빌드 실패 (silent no-op 불가능). cooking-assistant가 Unity 대신 Bazel 기반이었다면 pointer 사고 자체가 거의 불가능했다.

---

# 10. Self-hosted Runner 하드닝 + 의사결정

## 10.1 Runner-host 단 체크리스트

```
의존성 보장:
  [ ] runner host의 OS 이미지 / Packer / Ansible / cloud-init에
      git-lfs 명시 (apt: git-lfs, brew install git-lfs)
  [ ] 이미지 빌드 후 sanity: git lfs version
  [ ] runner 등록 직후 sudo git lfs install --system

Workspace 위생:
  [ ] actions/checkout clean: false는 의도적일 때만
  [ ] 정기 cron으로 workspace 전체 정리 (git clean -ffdx + .git 삭제)
      → "예전 LFS 캐시 때문에 문제 안 보임" 함정 차단

모니터링:
  [ ] GitHub Settings → Billing → Git LFS data 80% 알림
  [ ] CI 빌드 APK 사이즈 metric — 임계 미만 급락 시 알림
      (cooking-assistant 230MB→12MB가 탐지 가능했던 신호)
  [ ] native SIGABRT → Crashlytics/Sentry 알림
```

## 10.2 LFS 함정 Self-Audit

```
Repo / 빌드:
  [ ] git lfs ls-files로 추적 파일 확인
  [ ] 그 파일이 빌드 산출물 (APK/IPA/installer/wheel/이미지)에 들어가나?
  [ ] CI에서 hydration이 silent no-op일 수 있나? (self-hosted?)
  [ ] hydration 결과 검증 step (size + magic-string) 있나?
  [ ] 빌드 도구 build-time validator 있나? (Unity IPreprocessBuildWithReport,
      Gradle task, Bazel rule, post-build script)
  [ ] 런타임 init에 asset 검증 있나? (사이드로드/OTA 손상 방어)

조직 / 운영:
  [ ] self-hosted runner 이미지에 git-lfs 명시?
  [ ] LFS bandwidth 80% 알림 활성?
  [ ] fork PR이 LFS quota 소진시키지 않게 막혀 있나?
  [ ] 신규 dev 머신 셋업 가이드에 git-lfs 포함?
```

## 10.3 단계별 우선순위

| 단계 | 작업 |
|------|-----|
| **P0 (즉시)** | CI hydration + 검증, Build-time validator, Runtime 가드 (모든 entry point) |
| **P1 (1주)** | Runner 프로비저닝에 git-lfs 명시, 검증 로직 reusable workflow화, bandwidth 알림 |
| **P2 (분기)** | 공개 모델 → HF Hub/Xet, 사내 모델 → R2/S3 + sha-pinned, Play Asset Delivery / iOS Background Assets |
| **P3 (장기)** | 가상 파일시스템 (Scalar) 도입, build system 전환 (Bazel/Buck) |

## 10.4 cooking-assistant 적용 결과

```
✅ Layer 1 (CI)      — bf4bf59 양 Android job에 추가
✅ Layer 2 (Editor)  — LocalSherpaModelBuildValidator.cs
✅ Layer 3 (Runtime) — LocalSpeechToTextService.java validateModelAsset()
✅ EditMode 테스트   — LocalSherpaModelAssetIsPresentAndNotGitLfsPointer

⚠️ 후속 backlog:
  • self-hosted runner 이미지에 git-lfs 명시 (현재 사람이 깐 상태)
  • sherpa-onnx 모델을 HF Hub로 이전 (LFS 의존 자체 제거)
  • iOS 빌드 추가 시 동일 3-gate 적용 필요
  • Crashlytics에 native SIGABRT alert 설정
```

---

# 11. 자매 문서 + 연결

이 문서가 다루지 **않은** 것 (다른 문서에서 다룸):

| 주제 | 위치 |
|------|------|
| Git SHA-1 객체 모델, packfile, delta compression | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §3 |
| GitHub 100MB push 거부 메커니즘 | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §4 |
| Git LFS HTTPS Batch API 프로토콜 | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §5 |
| LFS bandwidth quota / metered billing 단가 | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §6 |
| Cloudflare R2 / lakeFS / DVC 등 LFS 대안 인프라 | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §9, §10 |
| Play Asset Delivery / iOS On-Demand Resources 상세 | [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) §11 |
| sherpa-onnx의 ONNX Runtime이 왜 abort()로 죽는지 (network arch) | [`ai/sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md) |
| SenseVoice 모델 / tokens.txt 디코딩 의존성 | [`ai/sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md) |

이 문서가 다루는 직교 단면:

```
"LFS를 쓰기로 한 순간 추가로 깔아야 할 안전망 —
  hydration이 silent no-op일 수 있음을 가정하고
  build/runtime의 모든 길목에 검증을 박는 패턴."
```

---

# 12. 한 줄 결론

> **`actions/checkout`이 성공했다는 신호는 LFS 파일이 거기 있다는 보증이 아니다.** Pointer는 빌드 도구에는 ASCII 텍스트, 런타임에는 시한폭탄이다. 검증은 CI gate, build-time hook, runtime guard 세 곳에 모두 있어야 한다 — 각각 다른 attack surface를 책임진다.

---

# 참고 자료

## Git LFS 공식
- [Git LFS pointer file specification (git-lfs/git-lfs `docs/spec.md`)](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)
- [Git LFS official site](https://git-lfs.com/)
- [`git lfs install` man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-install.adoc)
- [`git lfs pull` man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-pull.adoc)
- [`git lfs fsck` man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-fsck.adoc)
- [Announcing Git LFS — The GitHub Blog (2015-04-08)](https://github.blog/2015-04-08-announcing-git-large-file-storage-lfs/)

## actions/checkout
- [actions/checkout 저장소](https://github.com/actions/checkout)
- [actions/checkout `git-source-provider.ts` (LFS 처리 부분)](https://github.com/actions/checkout/blob/main/src/git-source-provider.ts)
- [actions/checkout Issue #165 — Cache for LFS](https://github.com/actions/checkout/issues/165)
- [actions/checkout Issue #758 — boolean parsing of `lfs:` parameter](https://github.com/actions/checkout/issues/758)
- [actions/checkout Issue #834 — `lfs: true` bandwidth bloat 경고](https://github.com/actions/checkout/issues/834)
- [GitHub Community Discussion #26775 — Does `actions/checkout` count against LFS bandwidth?](https://github.com/orgs/community/discussions/26775)

## CI 캐싱 / hydration 패턴
- [`nschloe/action-cached-lfs-checkout`](https://github.com/nschloe/action-cached-lfs-checkout)
- [`f3d-app/lfs-data-cache-action`](https://github.com/f3d-app/lfs-data-cache-action)
- [Cached LFS checkout (GitHub Marketplace)](https://github.com/marketplace/actions/cached-lfs-checkout)

## Self-hosted Runner
- [About self-hosted runners — GitHub Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)
- [Pre-installed software on GitHub-hosted runners (`actions/runner-images`)](https://github.com/actions/runner-images)

## Unity Editor build-time hook
- [`IPreprocessBuildWithReport` — Unity Scripting API](https://docs.unity3d.com/ScriptReference/Build.IPreprocessBuildWithReport.html)
- [`IOrderedCallback.callbackOrder` — Unity Scripting API](https://docs.unity3d.com/ScriptReference/Build.IOrderedCallback-callbackOrder.html)
- [`BuildFailedException` — Unity Scripting API](https://docs.unity3d.com/ScriptReference/Build.BuildFailedException.html)
- [`BuildReport` — Unity Scripting API](https://docs.unity3d.com/ScriptReference/Build.Reporting.BuildReport.html)

## Hugging Face Xet
- [Migration Day: From Git LFS to Xet on the Hub — Hugging Face Blog](https://huggingface.co/blog/xet-on-the-hub)
- [Xet Storage backend overview — Hugging Face Docs](https://huggingface.co/docs/hub/xet/index)
- [XetHub joins Hugging Face](https://xethub.com/blog/xethub-joins-hugging-face-to-replace-git-lfs-and-improve-collaboration)

## LFS 사고 / Bandwidth 사보타주
- [streamlink/streamlink Issue #811 — LFS bandwidth exceeded](https://github.com/streamlink/streamlink/issues/811)
- [GitHub Community Discussion #22173 — Bandwidth exceeded while using LFS](https://github.com/orgs/community/discussions/22173)
- [How we saved $3k/month on GitHub LFS bandwidth — estebangarcia.io](https://estebangarcia.io/how-we-saved-on-github-lfs-bandwidth/)

## 가상 파일시스템 / 대안 SCM
- [The Story of Scalar — The GitHub Blog](https://github.blog/open-source/git/the-story-of-scalar/)
- [Sapling SCM (Meta)](https://sapling-scm.com/)
- [Mononoke (Meta)](https://github.com/facebook/sapling/tree/main/eden/mononoke)
- [EdenFS overview](https://github.com/facebook/sapling/tree/main/eden/fs)

## 빌드 시스템 패턴
- [Bazel `http_file` rule](https://bazel.build/rules/lib/repo/http#http_file)
- [Buck2 `http_archive` rule](https://buck2.build/docs/api/rules/#http_archive)

## 모바일 asset delivery
- [Play Asset Delivery 공식 — Android Developers](https://developer.android.com/guide/playcore/asset-delivery)
- [App Thinning — Apple Developer Documentation](https://help.apple.com/xcode/mac/current/#/devbbdc5ce4f)
- [On-Demand Resources Guide — Apple Developer](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/index.html)
- [Background Assets — Apple Developer Documentation](https://developer.apple.com/documentation/backgroundassets)

## 자매 문서
- [`devtools/git-lfs-대용량바이너리.md`](../devtools/git-lfs-대용량바이너리.md) — LFS의 저장소/quota 관점
- [`ai/sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md) — sherpa-onnx + SenseVoice 동작 원리
- [`devops/jenkins-vs-github-actions.md`](./jenkins-vs-github-actions.md) — CI 플랫폼 선택 큰 그림
