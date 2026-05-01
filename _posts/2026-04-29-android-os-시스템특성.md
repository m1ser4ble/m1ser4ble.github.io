---
layout: single
title: "Android OS 시스템 특성 완전가이드"
date: 2026-04-29 23:26:00 +0900
categories: frontend
excerpt: "Android OS는 Linux 커널 위에 Binder, ART, HAL, 보안·전원 관리 계층을 얹어 모바일 환경에 최적화한 운영체제 구조를 설명한다."
toc: true
toc_sticky: true
tags: [android, aosp, binder, art, hal, linux]
source: "/home/dwkim/dwkim/docs/mobile/android-os-시스템특성.md"
---

TL;DR
- Android는 단순한 Linux 배포판이 아니라 모바일 제약에 맞춘 별도 운영체제 아키텍처에 가깝다.
- Binder, Zygote, ART, HAL, Treble/Mainline/GKI가 성능·업데이트·호환성의 핵심 축이다.
- 샌드박스, SELinux, Verified Boot, FBE 같은 다층 보안 모델을 함께 이해해야 전체 구조가 보인다.

## 1. 개념
Android OS는 Linux 커널 위에 Bionic libc, ART 런타임, Binder IPC, 앱별 UID 샌드박스를 결합해 모바일·임베디드 기기에 맞춘 운영체제다. 앱 실행, IPC, 그래픽, 전원, 보안이 모두 데스크톱 Linux와 다른 방식으로 조정된다.

## 2. 배경
스마트폰 초기 시장은 Symbian, Windows Mobile, Palm OS처럼 터치·배터리·앱 생태계 대응이 약한 플랫폼이 주도했다. Android는 개방형 생태계와 다양한 OEM 지원을 전제로, 기존 데스크톱 Linux를 그대로 쓰지 않고 모바일 특화 계층을 새로 얹는 방향으로 등장했다.

## 3. 이유
Android 내부 구조를 알아야 앱 성능, 메모리, 권한, 부팅, 스토리지, 보안 문제를 레이어별로 분해할 수 있다. 특히 커널·HAL·프레임워크·런타임 경계를 이해해야 원인 분석이 정확해진다.

## 4. 특징
- 앱별 UID와 SELinux를 결합한 강한 샌드박스 모델
- Binder 기반 시스템 서비스 호출과 Zygote 기반 빠른 프로세스 생성
- ART, Mainline, Treble, GKI를 통한 실행 최적화와 업데이트 분리
- FBE, AVB, KeyMint 등 하드웨어 연계 보안 계층
- SurfaceFlinger, HWC, BufferQueue 중심의 모바일 그래픽 스택

## 5. 상세 내용

# Android OS 시스템 특성 완전가이드

> **작성일**: 2026-04-29
> **카테고리**: Mobile / OS / Android / System
> **포함 내용**: AOSP, Linux Kernel, Bionic libc, Binder IPC, Zygote, ART(Dalvik→ART), HAL/HIDL/AIDL, Project Treble, Project Mainline/APEX, GKI, SELinux/SEAndroid, Verified Boot/AVB, FBE/FDE, KeyMint/StrongBox, Scoped Storage, Doze/App Standby, ANR, Foreground Service, F2FS, dm-verity, BufferQueue/SurfaceFlinger, Choreographer, Mach/XNU 비교, HarmonyOS NEXT/Fuchsia/ChromeOS 비교, CTS/CDD/VTS, Knox, Fire OS, Horizon OS, AAOS

---

# 1. Android는 무엇인가?

## 핵심 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                  Android OS 한 줄 정의                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Linux 커널 위에 BSD 라이선스 userspace(Bionic)와               │
│   매니지드 런타임(ART)을 얹어, 앱별 UID 샌드박스 + Binder IPC를  │
│   기반으로 동작하는 모바일/임베디드 운영체제"                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Linux Kernel  +  Bionic libc  +  ART runtime        │       │
│  │       (GPL2)        (BSD)          (Apache 2.0)       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  핵심 특징:                                                      │
│  ├── 1) 앱 = Linux 사용자(UID) → 커널 격리 그대로 활용          │
│  ├── 2) Binder = 모든 시스템 서비스 호출의 단일 IPC 수단         │
│  ├── 3) Zygote = 클래스 미리 로드 후 fork → 빠른 앱 시작        │
│  ├── 4) ART = DEX 바이트코드의 JIT+AOT 하이브리드 컴파일         │
│  ├── 5) HAL = 프레임워크와 벤더 드라이버 분리(Treble)            │
│  ├── 6) APEX = OS 모듈을 Play Store로 OTA 없이 갱신             │
│  └── 7) GKI = 커널까지 모듈화하여 보안 패치 신속 배포            │
└─────────────────────────────────────────────────────────────────┘
```

## 왜 Linux를 직접 쓰지 않고 "Android"가 별도로 필요했는가?

```
┌─────────────────────────────────────────────────────────────────┐
│             데스크탑 Linux를 그대로 쓸 수 없는 이유              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  데스크탑 Linux            모바일 요구사항                       │
│  ─────────────────         ──────────────────                    │
│  "기본 활성"               "기본 sleep"                          │
│  사용자가 종료 명령        wakelock 없으면 즉시 suspend          │
│                                                                  │
│  glibc (LGPL, ~2MB)        Bionic (BSD, ~200KB)                 │
│  copyleft 위험             독점 앱 생태계 가능                    │
│                                                                  │
│  D-Bus (사용자 공간)       Binder (커널 드라이버)                │
│  메시지 2회 복사           1회 복사 + UID 자동 검증              │
│                                                                  │
│  systemd                   init.rc + property service           │
│  유닛 파일                 Action/Service/Trigger 모델           │
│                                                                  │
│  X11/Wayland               SurfaceFlinger + HWC                 │
│  네트워크 투명              하드웨어 합성기 직결                  │
│                                                                  │
│  PulseAudio/PipeWire       AudioFlinger                         │
│                                                                  │
│  표준 OOM killer           LMKD (oom_adj 기반 우선순위)          │
│                                                                  │
│  → Android는 "모바일 환경에 맞춰진 Linux 디스트로"라기보다는,    │
│    "Linux 커널만 빌려온 별도의 OS"에 가깝다.                     │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. 용어 사전 (Terminology Dictionary)

| 용어 | 풀 네임 | 의미와 어원 |
|------|--------|-------------|
| **Android** | "andr-" + "-oid" | 그리스어 ἀνήρ(인간) + εἰδής(~처럼 생긴) = "인간을 닮은 것". 1837년 문헌 등장, SF에서 대중화. Andy Rubin의 Android Inc.(2003) → Google 인수(2005) |
| **AOSP** | Android Open Source Project | Apache 2.0 라이선스 오픈소스 코드베이스. source.android.com |
| **Bionic** | Bionic C Library | "BSD + Linux"의 hybrid → "Bi(o)-". David Turner(2009): glibc(LGPL)는 독점 앱 생태계와 충돌, 임베디드용 경량화가 필요했음 |
| **Binder** | Binder IPC | "to bind" — 프로세스/언어/실행환경을 묶음. Be Inc.의 OpenBinder(2001) → PalmSource Cobalt → Google이 Dianne Hackborn 영입(2005) → Android에서 재작성. Linux 커널 mainline 통합 3.19(2015) |
| **Dalvik** | Dalvik VM (DVM) | 아이슬란드 어촌마을 Dalvík(창시자 Dan Bornstein 명명). 레지스터 기반 VM(JVM은 스택 기반) → 명령어 ~47% 감소 |
| **ART** | Android RunTime | Dalvik 후속 매니지드 런타임. KitKat(4.4) preview → Lollipop(5.0) 기본. Hybrid AOT+JIT+PGO(Nougat 7.0) |
| **Zygote** | — | 생물학 "접합자(수정란)" — 모든 앱 프로세스의 부모. ART + 프레임워크 클래스 ~3,000개를 preload, fork()로 앱 생성, COW로 메모리 공유 |
| **HAL** | Hardware Abstraction Layer | 프레임워크 ↔ 벤더 드라이버 사이 추상화 계층 |
| **HIDL** | HAL Interface Definition Language | Treble(8.0)에서 도입된 HAL용 IDL. Android 11+에서 deprecated, AIDL로 대체 |
| **AIDL** | Android Interface Definition Language | 1.0부터 앱↔서비스 IPC. Stable AIDL(10+)부터 HAL에도 사용 |
| **Treble** | Project Treble | 음악 "treble"(고음부) — bass/tenor/treble 3성부 분리에서 차용. Android 8.0(2017): system.img / vendor.img 분리 |
| **APEX** | Android Pony EXpress | 1860년 Pony Express(미주리↔캘리포니아 릴레이 우편, 22일 → 10일) 차용. APK 확장 컨테이너. Project Mainline의 배달 단위 |
| **Mainline** | Project Mainline | OS 핵심 모듈을 Play Store OTA로 독립 갱신. Conscrypt, MediaProvider, Permission Controller, DNS Resolver 등 |
| **GKI** | Generic Kernel Image | 커널 = 단일 generic 이미지 + 벤더 모듈(.ko). KMI(Kernel Module Interface)로 ABI 안정화 |
| **KMI** | Kernel Module Interface | GKI 코어 커널과 벤더 모듈 사이 안정 심볼 인터페이스 |
| **SELinux** | Security-Enhanced Linux | NSA 주도(2000 공개), Linux mainline 2003. MAC(Mandatory Access Control) |
| **SEAndroid** | SELinux for Android | Android 4.3 permissive → 4.4 부분 enforcing → 5.0 전면 enforcing |
| **AVB** | Android Verified Boot | dm-verity + 서명된 vbmeta로 부팅 체인 검증. AVB 2.0(8.0+) |
| **dm-verity** | Device Mapper verity | 블록 디바이스 무결성 검증. SHA-256 해시 트리 |
| **FDE** | Full Disk Encryption | Android 5.0~9. 단일 키로 /data 전체 암호화 |
| **FBE** | File-Based Encryption | Android 7.0+. fscrypt 기반. CE(Credential Encrypted) + DE(Device Encrypted) 클래스. Direct Boot 가능 |
| **CE / DE** | Credential / Device Encrypted | 사용자 PIN 후 해제(CE) vs 부팅 즉시 사용(DE) |
| **Keymaster / KeyMint** | — | TEE 기반 키 관리. Android 12부터 keystore2(Rust) + KeyMint HAL |
| **StrongBox** | — | 메인 SoC와 물리적으로 분리된 보안 칩(Pixel: Titan M, M2). Android 9.0+ |
| **Trusty / QSEE** | — | TEE 구현체. Trusty(Google 오픈소스, Pixel), QSEE(Qualcomm) |
| **TEE** | Trusted Execution Environment | ARM TrustZone 기반 격리 실행 환경 |
| **ANR** | Application Not Responding | UI 스레드 5초 미응답, BroadcastReceiver 10초, Service 20초(전경) |
| **ADB** | Android Debug Bridge | 개발 PC ↔ 기기 사이 "다리" |
| **Doze** | — | 6.0(2015) 도입. 미충전 + 정지 + 화면 off 지속 시 백그라운드 활동 일괄 지연 |
| **App Standby Buckets** | — | 9.0(2018) 도입. Active/Working Set/Frequent/Rare/Restricted 5단계 |
| **JobScheduler / WorkManager** | — | 조건 기반 백그라운드 스케줄러. WorkManager(Jetpack)가 권장 |
| **SAF** | Storage Access Framework | 4.4(2013). 다양한 스토리지 프로바이더 통합 인터페이스 |
| **Scoped Storage** | — | 10/11. 앱은 자기 디렉토리 + MediaStore + SAF만 접근 |
| **F2FS** | Flash-Friendly File System | 삼성 개발(2012), Linux 3.8 mainline. NAND 플래시 최적화 log-structured FS |
| **GMS / HMS** | Google/Huawei Mobile Services | Play Store/Maps/Gmail vs AppGallery/HMS Core |
| **CTS / VTS / CDD** | Compatibility Test Suite / Vendor Test Suite / Compatibility Definition Document | Android 호환성 정책(CDD)+자동 테스트(CTS)+벤더 인터페이스 검증(VTS) |
| **OEM / ODM** | Original Equipment / Design Manufacturer | 최종 브랜드 판매(OEM) vs 위탁 설계 제조(ODM) |

---

# 3. 등장 배경 (Why It Emerged)

## 2003년 모바일 OS 생태계의 한계

```
┌─────────────────────────────────────────────────────────────────┐
│              "왜 또 다른 모바일 OS가 필요했는가"                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Symbian (Nokia, ~60% 점유)                                     │
│  ├── C++ 기반, 학습곡선 가파름                                   │
│  ├── S60/S80/S90 단편화                                         │
│  ├── 앱 서명 강제 → 개발자 진입장벽                              │
│  └── 인터넷 시대 대응 미흡                                       │
│                                                                  │
│  Windows Mobile 6.x                                             │
│  ├── Win32 API → 데스크탑 패러다임을 모바일에 강제               │
│  ├── 스타일러스 의존, 터치 미최적화                              │
│  └── 배터리 관리 부실                                            │
│                                                                  │
│  Palm OS                                                         │
│  ├── PIM(개인정보) 특화                                          │
│  └── 스마트폰 시대 요구사항 수용 한계                             │
│                                                                  │
│  iOS (2007 출시, Android 출시 시점에 1년차)                     │
│  ├── 폐쇄 생태계, OEM 라이선스 없음                             │
│  ├── 수직통합 모델                                               │
│  └── 단일 제조사(Apple)만 존재                                   │
│                                                                  │
│  Andy Rubin의 비전:                                             │
│  "사용자의 위치/선호를 인식하는 더 스마트한 모바일 기기를         │
│   개방적이고 유연하며 업그레이드 가능한 플랫폼으로 만들자"        │
└─────────────────────────────────────────────────────────────────┘
```

## 왜 Linux 커널을 선택했는가

| 이유 | 설명 |
|------|------|
| 검증된 하드웨어 추상화 | 칩 벤더가 이미 Linux 드라이버 환경에 익숙 |
| 검증된 핵심 시스템 | 스케줄러, MMU, FS, 네트워크, 전원 관리 — 수십 년 검증 |
| 이식성 | ARM, x86, MIPS 등 다양한 SoC 지원 |
| 무료 + 오픈소스 | 라이선스 비용 0 (단, GPL이므로 userspace는 분리할 필요 → Bionic) |
| 다중 사용자 격리 | 앱별 UID 샌드박스의 토대로 직접 활용 가능 |

---

# 4. 진화 타임라인 (Evolution Timeline)

## 4.1 창업과 1.0 출시 (2003~2008)

| 연도 | 사건 |
|------|------|
| 2003.10 | **Android Inc. 창업** — Andy Rubin, Rich Miner, Nick Sears, Chris White (캘리포니아 팔로알토). 초기 목표: 디지털 카메라 OS |
| 2004.04 | 투자 유치 실패 후 피벗 — 스마트폰 OS로 방향 전환 |
| 2005.07~08 | **Google이 Android Inc. 인수** — 최소 $50M. David Lawee(Google 당시 VP): "Google 역사상 최고의 거래" |
| 2007.11 | **Open Handset Alliance** 발표 — Google + HTC, 모토로라, 삼성, 스프린트, T-Mobile, Qualcomm, TI 등 84개사 |
| **2008.09.23** | **Android 1.0 출시 — HTC Dream(T-Mobile G1)** |

## 4.2 버전별 OS-레벨 변경 마일스톤

| 버전 | 코드네임 | 출시 | API | 주요 OS-레벨 변화 |
|------|---------|-----|-----|------------------|
| 1.0 | — | 2008.09 | 1 | Dalvik VM, Binder IPC, Zygote, Apache Harmony |
| 1.5 | Cupcake | 2009.04 | 3 | 첫 디저트 코드명 |
| 2.2 | Froyo | 2010.05 | 8 | **Dalvik JIT 컴파일러** |
| 4.0 | ICS | 2011.10 | 14 | 폰+태블릿 통합, ASLR |
| 4.1 | Jelly Bean | 2012.07 | 16 | **Project Butter** (vsync 16ms, triple buffering) |
| **4.3** | Jelly Bean | **2013.07** | 18 | **SELinux permissive 도입** |
| **4.4** | KitKat | **2013.10** | 19 | **SELinux enforcing(부분)**, **ART preview**, F2FS 채택 시작, SAF |
| **5.0** | Lollipop | **2014.11** | 21 | **ART 기본화 (Dalvik 제거)**, 64-bit ARMv8, FDE 기본, Verified Boot, Material Design, JobScheduler |
| **6.0** | Marshmallow | **2015.10** | 23 | **런타임 권한**, **Doze**, App Standby, Fingerprint API |
| **7.0** | Nougat | **2016.08** | 24 | **FBE**, **Vulkan**, **JIT+AOT+PGO 하이브리드**, Direct Boot, Network Security Config |
| **8.0** | Oreo | **2017.08** | 26 | **Project Treble** (vendor 분리, HIDL), **AVB 2.0**, 백그라운드 실행 제한, 알림 채널, Neural Networks API |
| 9.0 | Pie | 2018.08 | 28 | **StrongBox**, App Standby Buckets, BiometricPrompt, DNS over TLS, APK v3 서명 |
| **10** | Quince Tart | **2019.09** | 29 | **Project Mainline + APEX**, Scoped Storage(opt-in), Stable AIDL HAL, MAC 주소 랜덤화 |
| **11** | Red Velvet Cake | **2020.09** | 30 | Scoped Storage 강제, **GKI v1**, One-time Permissions, 권한 자동 리셋 |
| **12** | Snow Cone | **2021.10** | 31 | Material You, Privacy Dashboard, **마이크/카메라 인디케이터**, 대략적 위치, **GKI 2.0(kernel 5.10+ 의무)**, Rust 도입 |
| 13 | Tiramisu | 2022.08 | 33 | 미디어 권한 세분화(IMAGES/VIDEO/AUDIO), 알림 권한 런타임화, Predictive Back |
| 14 | Upside Down Cake | 2023.10 | 34 | **Foreground Service Types 의무**, 부분 사진 접근, 지역 설정 세분화, 최소 타겟 SDK 강제(Play) |
| 15 | Vanilla Ice Cream | 2024.10 | 35 | **엣지투엣지 강제**, Predictive Back 기본, Private Space, 앱 아카이빙, Privacy Sandbox |
| 16 | Baklava | 2025.06 | 36 | Material 3 Expressive, **Linux Terminal(AVF)**, Desktop Mode, 2-릴리스/년 체계 |

## 4.3 OS 아키텍처 분기점 요약

```
2010 (Froyo)        Dalvik JIT 도입               실행 속도 1차 도약
2014 (Lollipop)     Dalvik → ART (AOT)            런타임 패러다임 전환
2016 (Nougat)       JIT+AOT 하이브리드            설치속도+실행속도 균형
2017 (Oreo)         Project Treble                vendor/framework 분리
2017 (Oreo)         HIDL, AVB 2.0                 HAL 표준화, 보안 부팅 강화
2019 (Android 10)   Project Mainline / APEX       OS 모듈 OTA 독립 갱신
2020-21 (11~12)     GKI 도입/의무화               커널 파편화 해소
```

---

# 5. Android 소프트웨어 스택 (Architecture)

## 5.1 5-레이어 구조

```
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                     │
│         System Apps │ User Apps │ Privileged Apps       │
├─────────────────────────────────────────────────────────┤
│              JAVA/KOTLIN API FRAMEWORK                  │
│  ActivityManager │ WindowManager │ PackageManager       │
│  ContentProviders │ NotificationManager │ View System   │
├───────────────────────────┬─────────────────────────────┤
│   NATIVE C/C++ LIBRARIES  │    ANDROID RUNTIME (ART)    │
│  Bionic libc │ OpenGL ES  │  DEX/OAT │ JIT │ AOT │ GC  │
│  Vulkan │ SQLite │ Skia   │   Concurrent Copying GC    │
│  WebKit │ Media Framework │                             │
├───────────────────────────┴─────────────────────────────┤
│          HARDWARE ABSTRACTION LAYER (HAL)               │
│        HIDL (Android 8-10) → AIDL (Android 11+)         │
│        /dev/binder │ /dev/hwbinder │ /dev/vndbinder     │
├─────────────────────────────────────────────────────────┤
│                   LINUX KERNEL                          │
│  GKI │ Binder Driver │ ION/dma-buf │ SELinux │ cgroups  │
│  ashmem→memfd │ wakelocks │ LMKD │ Paranoid Networking  │
└─────────────────────────────────────────────────────────┘
```

## 5.2 앱 유형 3분류와 권한

| 유형 | 위치 | API 접근 |
|------|------|---------|
| User Apps | APK 배포 | Public SDK API만 |
| Privileged Apps | `/system/priv-app/` | `@SystemApi` 접근 가능 |
| System Apps | OS 일부 | 내부 프레임워크 직접 접근 |

Android 9(Pie)+: Non-SDK API 제한 강화 → reflection으로 내부 API 호출 시 경고/차단.

## 5.3 Linux Kernel — Android 고유 패치

| 패치 | 목적 | 현재 상태 |
|------|------|---------|
| Binder driver | 핵심 IPC | mainline 통합(3.19, 2015) |
| ashmem | 익명 공유 메모리 | memfd로 마이그레이션 중(Android 12+) |
| wakelocks / suspend blockers | 모바일 전원 관리 | 일부 mainline 흡수(autosleep) |
| Low Memory Killer (in-kernel) | 메모리 부족 시 프로세스 종료 | 커널 4.12에서 제거 → userspace LMKD로 이동 |
| ION allocator | GPU/카메라 zero-copy 버퍼 | dma-buf heaps로 전환(GKI 2.0) |
| Paranoid Networking | INTERNET 권한 없으면 소켓 차단 | GID 3003 검사 |
| SELinux 정책 | MAC | 4.4+ enforcing |

---

# 6. Runtime: Dalvik → ART

## 6.1 Dalvik VM의 설계 결정

```
┌─────────────────────────────────────────────────────────────────┐
│                Register-based vs Stack-based VM                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  JVM (Stack-based) — Java 표준 bytecode                          │
│    iload_1     ; 'a' push                                        │
│    iload_2     ; 'b' push                                        │
│    iadd        ; pop 2, push sum                                 │
│    istore_3    ; pop, store                                      │
│                                                                  │
│  Dalvik (Register-based) — DEX bytecode                          │
│    add-int v0, v1, v2   ; 단일 명령으로 끝                       │
│                                                                  │
│  → 평균 47% 적은 명령어 (Ehringer 2010)                          │
│  → 인터프리터 오버헤드 감소, 저전력 CPU에 최적                   │
│  → 단점: 명령어당 비트 수 ↑ (레지스터 번호 명시)                 │
│                                                                  │
│  DEX(Dalvik Executable) 형식:                                    │
│  ┌───────────────────────────────────┐                          │
│  │  여러 클래스가 단일 상수 풀 공유    │                          │
│  │  → RAM 사용량 대폭 감소             │                          │
│  │  → 메서드 인덱스 16-bit (65,536개)  │                          │
│  │  → 초과 시 MultiDex 필요            │                          │
│  └───────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Dalvik JIT → ART AOT → Hybrid 진화

| 단계 | 버전 | 컴파일 방식 | 특징 |
|------|-----|-----------|-----|
| Dalvik 인터프리터 | 1.0~2.1 | 인터프리팅 | 가장 느림 |
| Dalvik JIT | 2.2 Froyo | Trace-based JIT | 자주 실행되는 trace를 네이티브로 |
| ART preview | 4.4 KitKat | AOT (opt-in) | dex2oat로 설치 시 전체 컴파일 |
| ART 기본화 | 5.0 Lollipop | 순수 AOT | Dalvik 제거, 64-bit |
| **하이브리드** | **7.0 Nougat** | **JIT+AOT+PGO** | 설치 빠르게 + 실행 빠르게 |
| Cloud Profiles | 10 (Q) | + 프로필 다운로드 | 설치 직후부터 핫 메서드 AOT |
| Baseline Profiles | 9.0+ Jetpack | + APK 내장 프로필 | 개발자가 핫 패스 명시 |

## 6.3 Compiler Filter

| Filter | 동작 | 사용 시점 |
|--------|-----|---------|
| `verify` | DEX 검증만 | 초기 설치(기본) |
| `quicken` | 일부 명령어 최적화 | 일부 시스템 앱 |
| `speed-profile` | 프로필의 hot methods AOT | 유휴 충전 시 |
| `speed` | 모든 메서드 AOT | 중요 시스템 앱 |
| `everything` | 전체 AOT | 디버깅 |

## 6.4 Garbage Collection 진화

```
Dalvik CMS         → 마킹/스윕 시 STW pause (힙 크기에 비례)
ART 초기 (5.0~7.x) → 여러 GC 전략 혼합 (CMS, Mark-Compact, Sticky CMS)
Concurrent Copying (8.0+):
  ┌────────┐         ┌────────┐
  │ From   │ 복사    │  To    │
  │ Space  │ ─────→  │ Space  │
  └────────┘         └────────┘
  - RegionTLAB로 동기화 없는 bump-pointer 할당
  - Read barrier로 복사 중 안전 참조
  - pause time = O(1), 힙 크기와 무관
Generational CC (10+):
  Young Gen / Old Gen 분리 → 대부분 Young에서 死(Generational Hypothesis)
```

---

# 7. Process Model: Zygote와 system_server

## 7.1 Zygote — 모든 앱의 부모

```
┌────────────────────────────────────────────────────────────┐
│                  Android 부팅 시퀀스                       │
│                                                            │
│  init(PID 1) → Zygote 시작                                 │
│              │                                             │
│              ▼                                             │
│         ART VM 초기화                                      │
│         프레임워크 클래스 ~3,000개 preload                 │
│         공통 리소스(테마, 아이콘) 로드                      │
│              │                                             │
│              ▼                                             │
│  /dev/socket/zygote 대기                                   │
│              │                                             │
│  ActivityManagerService → 앱 실행 요청 (Binder)            │
│              │                                             │
│              ▼                                             │
│         fork()                                             │
│         ├─→ App 프로세스: setuid(앱UID) → ActivityThread.main│
│         └─→ Zygote 계속 대기                               │
│                                                            │
│  Copy-on-Write로 메모리 공유:                              │
│    Zygote preloaded: ~50MB                                │
│    앱 10개 실행: 50MB (공유) + 변경분만 별도               │
│    (COW 없으면 500MB 필요)                                 │
└────────────────────────────────────────────────────────────┘
```

- **32-bit/64-bit 분리(5.0+)**: `zygote`(32) + `zygote64`(64) 별도 실행
- **USAP(Unspecialized App Process) Pool(10+)**: 미리 fork된 generic 프로세스 풀로 추가 가속

## 7.2 system_server — 80+ 시스템 서비스 호스트

```
┌──────────────────────────────────────────────────────┐
│                    system_server                      │
│  (Zygote의 첫 번째 fork 자식)                         │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ ActivityMgr  │  │ WindowMgr    │  │ PackageMgr │ │
│  │ (AMS)        │  │ (WMS)        │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ PowerMgr     │  │ InputMgr     │  │ TelephonyMgr│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                ... (80+ 서비스)                      │
│                                                      │
│  → system_server 크래시 = 기기 재부팅                │
│    (Watchdog이 감지 → restart 트리거)                │
└──────────────────────────────────────────────────────┘
```

---

# 8. IPC: Binder

## 8.1 왜 Binder인가? (Unix IPC와 비교)

| 메커니즘 | 메모리 복사 | UID 검증 | 객체 참조 | RPC 시맨틱 |
|---------|-----------|---------|---------|----------|
| Pipe / Socket | 2회 | 없음 | 없음 | 비동기 |
| D-Bus | 2회 (사용자공간 데몬 경유) | 제한적 | 부분 | 동기/비동기 |
| **Binder** | **1회** (kernel mmap) | **자동** | **자동 카운팅** | **동기 RPC** |
| 공유 메모리 | 0회 | 없음 | 직접 구현 | — |

**Binder의 핵심 장점:**
1. sender 버퍼를 receiver 주소공간에 직접 mmap → 1회 복사
2. 커널 드라이버가 호출자 UID/PID를 자동 전달 → 위조 불가
3. 원격 객체 참조 카운팅
4. 함수 호출처럼 동작 (소켓의 메시지 전달과 다름)

## 8.2 Binder 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│                   App Process A (Client)                        │
│  cameraService.openCamera(...)                                  │
│      │                                                          │
│      ▼ AIDL stub: CameraService.Proxy                          │
│  Parcel 직렬화 → Binder 전송                                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │ ioctl(BC_TRANSACTION)
┌──────────────────────────▼─────────────────────────────────────┐
│              Linux Kernel (/dev/binder)                         │
│  1. UID/PID 검증                                                │
│  2. sender 버퍼를 receiver 주소공간에 mmap                       │
│  3. receiver 스레드 wake up                                      │
│  4. BR_TRANSACTION 이벤트 전달                                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│            App Process B (Server: CameraService)                │
│  Binder Thread Pool (기본 16개)                                 │
│  → Parcel 역직렬화                                              │
│  → CameraService.openCamera() 실행                              │
│  → 응답 Parcel → BC_REPLY                                       │
└────────────────────────────────────────────────────────────────┘
```

## 8.3 Binder 컨텍스트 분리 (Treble 이후)

| 디바이스 노드 | 용도 |
|------------|-----|
| `/dev/binder` | 프레임워크 ↔ 앱 IPC |
| `/dev/hwbinder` | 프레임워크 ↔ HAL (HIDL) |
| `/dev/vndbinder` | vendor 프로세스 간 IPC |

**핵심 제약**: 단일 트랜잭션 Parcel 한도 ~1MB → 초과 시 `TransactionTooLargeException`

## 8.4 ServiceManager

DNS 같은 역할: 서비스 이름 → Binder 노드 매핑.
```kotlin
val cameraService = ServiceManager.getService("camera")
```

---

# 9. 메모리 관리

## 9.1 Low Memory Killer Daemon (LMKD)

```
┌────────────────────────────────────────────────────────┐
│              앱 프로세스 우선순위 (oom_adj_score)       │
│              낮을수록 죽이기 어려움                     │
│  ─────────────────────────────────────────────         │
│   -1000: init, lmkd (절대 안 죽임)                     │
│    -900: persistent system processes                   │
│       0: foreground app (현재 화면)                     │
│     100: foreground service                            │
│     200: perceptible app (부분적으로 보임)              │
│     500: service (백그라운드)                           │
│     600: home app                                      │
│     700: previous app                                  │
│     900: cached app (B foreground)                     │
│     950: cached app (A foreground)                     │
│    1000: empty process (캐시만)                         │
│  ─────────────────────────────────────────────         │
│              높을수록 먼저 죽임                        │
└────────────────────────────────────────────────────────┘
```

- **PSI(Pressure Stall Information) 기반(10+)**: Linux 4.20 도입. `/proc/pressure/memory`에서 메모리 부족으로 인한 task 지연 측정 → vmpressure보다 오탐 적음
- **압력 레벨별 동작**: low(≥1001 비활성) / medium(≥800 캐시·서비스 정리) / critical(≥0 무엇이든 가능)

## 9.2 ZRAM, ION→dma-buf, ashmem→memfd

| 메커니즘 | 역할 | 변화 |
|---------|-----|-----|
| ZRAM | 압축 RAM 스왑 (zstd/lz4) | 9.0+ 기본. 2:1~3:1 압축 → 2GB가 4GB처럼 |
| ION | 그래픽 zero-copy 공유 | 4.0(2012) 도입. Android staging 드라이버 |
| dma-buf heaps | ION 후속 | GKI 2.0(12+). upstream 표준. `libdmabufheap`이 호환층 |
| ashmem | 익명 공유 메모리 | Android 고유 |
| memfd | upstream 표준 | Linux 3.17. Android 12부터 ashmem을 memfd로 에뮬레이션 |

---

# 10. 그래픽 스택

## 10.1 전체 파이프라인

```
┌────────────────────────────────────────────────────────────┐
│  App: View → HWUI RenderThread → OpenGL ES / Vulkan        │
│       │                                                    │
│       ▼                                                    │
│  Surface (BufferQueue Producer)                            │
│       │ dequeueBuffer / queueBuffer                        │
│       ▼                                                    │
│ ┌─────────────────────────────────────────────────────┐   │
│ │              BufferQueue                             │   │
│ │  Producer ──[graphic buffer]──→ Consumer            │   │
│ │  (App, Camera, VideoDecoder)    (SurfaceFlinger)    │   │
│ └─────────────────────────────────────────────────────┘   │
│       │                                                    │
│       ▼                                                    │
│ ┌───────────────────────────┐                             │
│ │      SurfaceFlinger       │ ← Choreographer (VSYNC)    │
│ │  Layer 수집 → HWC 질의     │                             │
│ └────────────┬──────────────┘                             │
│              │                                            │
│    ┌─────────▼──────────┐                                │
│    │ Hardware Composer  │ ← display HW                    │
│    │ (HWC HAL)          │   overlay planes 활용            │
│    └─────────┬──────────┘                                │
│              ▼                                            │
│        물리 디스플레이                                     │
└────────────────────────────────────────────────────────────┘
```

## 10.2 핵심 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| **BufferQueue** | Producer-Consumer 그래픽 버퍼 큐. gralloc HAL이 메모리 할당. 더블/트리플 버퍼링 |
| **SurfaceFlinger** | 시스템 컴포지터. 모든 앱 Surface 합성 → HWC 전달 |
| **HWC (Hardware Composer)** | 디스플레이 HW에 overlay plane 직접 사용(전력 절약) 또는 GPU 합성으로 폴백 |
| **Choreographer** | VSYNC 동기화 콜백. `doFrame()` → Input → Animation → Render |
| **HWUI / RenderThread** | 5.0+ UI Thread와 분리된 GPU 렌더링 스레드. DisplayList 실행 |
| **ANGLE** | OpenGL ES → Vulkan 번역. 13+ 일부 기기에서 기본 백엔드 |
| **Vulkan** | 7.0+. 저수준 GPU 제어, 멀티스레드 커맨드 빌딩 |

90Hz/120Hz 디스플레이는 `setFrameRate()`로 앱이 원하는 주사율 힌트 제공.

---

# 11. 스토리지 스택

## 11.1 F2FS vs ext4

| 특성 | ext4 (HDD 시대 설계) | F2FS (NAND 플래시용) |
|------|--------------------|---------------------|
| 쓰기 방식 | In-place update | Log-structured (append-only) |
| 쓰기 증폭 | 높음 | 낮음 |
| 순차 쓰기 | 보통 | 우수 |
| 소규모 랜덤 쓰기 | 보통 | 우수 |
| FBE 지원 | fscrypt | fscrypt |

USENIX FAST15 결과: F2FS가 iozone에서 최대 3.1배, SQLite에서 2배 성능 우위, 에너지 1.6~2.1배 절감.

## 11.2 암호화: FDE → FBE

```
FBE 키 계층:
┌──────────────────────────────────────────────────────┐
│                     Master Key                        │
│  (하드웨어 Root of Trust → KeyMint TEE에서 파생)      │
│                         │                            │
│          ┌──────────────┴──────────────┐             │
│          ▼                             ▼             │
│   System DE Key                  Per-User Keys       │
│   /data/app, /data/system   ┌────────────────────┐   │
│   부팅 즉시 사용 가능       │ User CE Key         │   │
│                             │  (PIN 후 해제)       │   │
│                             ├────────────────────┤   │
│                             │ User DE Key         │   │
│                             │  (부팅 즉시)        │   │
│                             └────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

- **Direct Boot 모드**: 잠금 해제 전 DE만 접근 → 알람/전화/SMS 동작
- **암호 알고리즘**: 파일 내용 AES-256-XTS (저사양: Adiantum), 파일명 AES-256-CTS / HCTR2(14+)
- **Synthetic Password**: 사용자 PIN 변경 시 CE 키 재암호화 없이 처리할 수 있도록 중간 layer

## 11.3 Scoped Storage (10/11)

```
[기존: API 28-]                  [Scoped Storage: API 29+]
앱 → READ_EXTERNAL_STORAGE       앱 → 자기 디렉토리 자유 접근
   → /sdcard 전체 접근              → 미디어: MediaStore API만
                                    → 일반 파일: SAF로 사용자 선택만
                                    → Photo Picker: 권한 없이 선택
```

- API 30(Android 11)부터 `requestLegacyExternalStorage` 무시 → 완전 마이그레이션 강제
- MediaProvider는 Project Mainline 모듈 → OTA 없이 정책 갱신

---

# 12. 보안 모델

## 12.1 다층 보안 모델

```
앱 레이어   :  Runtime Permissions (6.0+)
프로세스   :  UID DAC 샌드박스 (앱당 고유 UID)
커널       :  SELinux MAC (도메인별 정책)
커널       :  seccomp-bpf (시스템콜 필터)
하드웨어   :  TrustZone TEE (KeyMint, 생체인식, DRM)
하드웨어   :  StrongBox (Titan M/M2, 분리 보안 칩)
부팅       :  Verified Boot (dm-verity + vbmeta)
```

## 12.2 Application Sandbox — UID 격리

```
데스크탑 Linux                       Android
─────────────────────                ─────────────────────────────────
alice  (UID 1000) ←→ 개인 파일       com.example.app (UID 10123) ←→ /data/data/com.example.app/
bob    (UID 1001) ←→ 개인 파일       com.bank.app    (UID 10456) ←→ /data/data/com.bank.app/

Android UID 계산: u * 100000 + (10000 + appId)
표시: u0_a123 (user 0, app 123)
```

- 6.0+: 앱 홈 디렉토리 권한 `751` → `700`
- **sharedUserId** (legacy): 같은 서명 앱들이 UID 공유 → API 29 deprecated (PackageManager 비결정성, 키 유출 시 전염)

## 12.3 SELinux 도입 타임라인

| 버전 | 상태 |
|-----|-----|
| 4.3 (2013) | Permissive (로그만) |
| 4.4 (2013) | 부분 Enforcing (installd, netd, vold, zygote) |
| 5.0 (2014) | **전면 Enforcing** (60+ 도메인) |
| 6.0+ | IOCTL 필터링, /proc 제한 강화 |
| 8.0 | platform/vendor 정책 분리 (Treble) |
| 9.0 | targetSdk≥28 앱 개별 SELinux 샌드박스 |

**Type Enforcement 정책 예시**:
```
allow untrusted_app app_data_file:file { read write open getattr };
allow untrusted_app system_server:binder { call };
neverallow untrusted_app exec_type:file execute_no_trans;
```

## 12.4 권한 모델 진화

| 버전 | 변화 |
|-----|------|
| 1.0~5.x | 설치 시 일괄 승인 |
| 6.0 | **Runtime Permissions** (Dangerous 그룹) |
| 10 | 위치 "앱 사용 중에만" 추가 |
| 11 | One-time, 자동 리셋, Scoped Storage 강제 |
| 12 | 대략적 위치, 마이크/카메라 인디케이터, Privacy Dashboard |
| 13 | 미디어 권한 세분화(IMAGES/VIDEO/AUDIO), 알림 권한, 그룹 자동승인 폐지 |
| 14 | Foreground Service Type 의무, 부분 사진 접근 |
| 15 | Privacy Sandbox, Private Space |

## 12.5 Verified Boot (AVB)

```
[Boot ROM (HW)] → [Bootloader] → [vbmeta 검증] → [boot/system/vendor 검증]
                                                  └─ dm-verity root hash
                                                     ↓
                                                  4KB 블록별 SHA-256
                                                  ↓
                                                  Hash Tree (Layer 0..N)
                                                  ↓
                                                  Root Hash (vbmeta 서명)
```

| 부팅 상태 | 의미 |
|---------|-----|
| GREEN | 모두 검증 성공, 잠금 |
| YELLOW | 사용자 키로 검증 (커스텀 OS) |
| ORANGE | 부트로더 잠금 해제 |
| RED | 검증 실패 (변조/손상) |

**롤백 방지**: 보안 버전 번호(SVN)를 RPMB(Replay Protected Memory Block) 또는 eFuse에 기록 → 다운그레이드 차단.

## 12.6 KeyMint / StrongBox

```
앱 → AndroidKeyStore (JCA)
   → keystore2 데몬 (Rust, Android 12+)
   → Binder
   → KeyMint HAL (IKeyMintDevice)
   → TrustZone TEE 또는 StrongBox
   → Trusted App (키 원자재가 TEE 밖으로 절대 노출되지 않음)
```

| 단계 | 내용 |
|-----|------|
| 6.0 | Keymaster 1.0 (AES, HMAC) |
| 7.0 | Key Attestation, version binding |
| 9.0 | StrongBox (Titan M 등 별도 보안 칩) |
| 12 | KeyMint HAL, keystore2(Rust) |
| 13 | KeyMint v2 (Curve25519) |

## 12.7 Trust & Attestation

- **하드웨어 Key Attestation**: KeyMint가 기기 고유키로 서명한 인증서 체인 → 서버가 Google Root CA로 검증 → OS 버전, 패치 레벨, 부트 상태, 잠금 여부 확인
- **SafetyNet → Play Integrity API**: 2024년 SafetyNet 종료. 신호 3가지: APP_INTEGRITY / DEVICE_INTEGRITY / ACCOUNT_INTEGRITY
- **Trusty TEE (Google 오픈소스)** vs **QSEE (Qualcomm)** vs **Titan M/M2 (StrongBox)**

## 12.8 Privacy Indicators (12+)

- 마이크/카메라 사용 시 상태바 우측 상단 녹색 표시 (CDD 의무)
- Privacy Dashboard: 24시간 데이터 접근 타임라인
- 클립보드 접근 알림 (다른 앱 클립보드 최초 접근 시 Toast)
- Photo Picker: 권한 없이 사용자 선택 사진만 반환

---

# 13. Project Treble + Mainline + GKI

## 13.1 Project Treble (Android 8.0)

```
Treble 이전:                    Treble 이후:
┌───────────────────────┐      ┌───────────────────────┐
│ Android Framework      │      │ Android Framework      │
├───────────────────────┤      ├───────────────────────┤
│ HAL 구현 (벤더)        │      │ ─── HIDL/AIDL ─── ←─ Vendor Interface
│ Android 버전에 강결합 │      │ Vendor HAL 구현       │
├───────────────────────┤      │ (vendor.img 격리)     │
│ Linux Kernel + 패치   │      ├───────────────────────┤
└───────────────────────┘      │ Linux Kernel          │
업그레이드 시 HAL 재작성 필요  └───────────────────────┘
                                Framework 업그레이드 시 vendor.img 유지
```

**구성 요소**:
- **HIDL → Stable AIDL**: AIDL이 미래 표준 (11+)
- **VINTF (Vendor Interface)**: `compatibility_matrix.xml`
- **GSI (Generic System Image)**: AOSP 시스템 이미지를 Treble 기기에 직접 플래시 가능

## 13.2 Project Mainline / APEX (Android 10)

```
APEX 파일:
mymodule.apex
├── apex_payload.img     ← EXT4/EROFS 이미지
├── apex_manifest.pb
├── AndroidManifest.xml
└── META-INF/ (서명)

부팅 시: apexd → /apex/com.android.conscrypt/ 마운트(dm-verity)
```

**핵심 모듈** (보안 중요도순):
| 모듈 | 역할 |
|-----|------|
| Conscrypt | TLS/암호화 (BoringSSL 기반) |
| Media Codecs | 과거 취약점 ~40% 차지 |
| Permission Controller | 런타임 권한 UI/정책 |
| MediaProvider | Scoped Storage 정책 |
| DNS Resolver | DNS over TLS |
| Network Stack | 네트워크 보안 |
| Bluetooth | BT 취약점 |
| ART | 런타임 자체 |

**Train 방식**: 의존성 충돌 방지 위해 묶음 배포. 크래시 임계값 초과 시 자동 롤백.

## 13.3 GKI (Generic Kernel Image)

```
┌─────────────────────────────────────────────┐
│           GKI (Generic Kernel Image)        │
│  ┌─────────────────────────────────────┐   │
│  │      Core Kernel (Google 빌드)       │   │
│  │  단일 gki_defconfig                 │   │
│  │  KMI(Kernel Module Interface) 안정  │   │
│  └─────────────────────────────────────┘   │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ GKI Modules   │  │  Vendor Modules    │  │
│  │ (upstream)    │  │ (.ko, OEM/SoC)     │  │
│  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘

Android 11: ACK 기반 커널 필수
Android 12: kernel 5.10+ GKI 필수
Android 13+: GKI 2.0, KMI 안정화
```

**효과**: Google이 LTS 커널 패치를 18개월 → 수 주로 단축. 모든 GKI 기기에 동일하게 적용.

---

# 14. 학술적/이론적 배경

## 14.1 핵심 도서 / 발표

| 자료 | 저자 / 출처 | 내용 |
|-----|-----------|------|
| *Androids: The Team That Built the Android OS* | Chet Haase, No Starch Press(2021) | 1.0 출시까지 내부 이야기 |
| *Android Internals* (Vol. I, II) | Jonathan Levin | ART, 커널, 보안 아키텍처 상세 |
| *Android Forensics* | Andrew Hoog | 법과학 관점의 내부 구조 |
| Google I/O 2008 — Dalvik VM Internals | Dan Bornstein | 레지스터 기반 VM 설계 원리 |
| Google I/O 2014 — ART | Carlstrom, Ghuloum, Rogers | AOT 컴파일러 내부 |
| 2017 Google I/O — Project Treble | Iliyan Malchev | 벤더 인터페이스 설계 |

## 14.2 학술 논문

| 논문 | 발표처 | 주제 |
|-----|------|------|
| "The Android Platform Security Model" (Mayrhofer et al.) | ACM TOPS 2021 / arXiv:1904.05572 | 전체 보안 모델 공식 기술 |
| "An Historical Analysis of the SEAndroid Policy Evolution" | arXiv:1812.00920 | SELinux 정책 진화 |
| "Boxify: Full-fledged App Sandboxing" | USENIX Security 2015 | 앱 샌드박스 강화 |
| "Aurasium: Practical Policy Enforcement" | USENIX Security 2012 | 정책 강제 |
| "Breaking the Integrity of Android App Sandboxing" | USENIX Security 2024 | 사이드채널 우회 |
| "F2FS: A New File System for Flash Storage" | USENIX FAST 2015 | 삼성 F2FS 설계 |

## 14.3 LWN의 Android-LKML 논쟁

2009~2010년 wakelock, ashmem 등 Android 패치가 mainline에서 제거 → Greg Kroah-Hartman: "Nokia가 동일한 절전 효과를 덜 침습적으로 달성. 커뮤니티 의견을 무시한 것이다." 결과적으로 wakelock은 `autosleep`/`wakeup sources`로 재설계되어 일부 mainline 흡수, Binder/ashmem은 staging tree 거쳐 mainline 통합.

## 14.4 Binder 계보

```
2001  Be Inc. (BeOS) — OpenBinder 시작
       ↓
2003~  PalmSource Cobalt — 마이크로커널에서 첫 실사용
       ↓
2005   Linux 포팅 → 오픈소스 공개
       ↓ (Dianne Hackborn Google 영입)
2008   Android 1.0 — 완전 재작성
       ↓
2015   Linux 커널 3.19 mainline 통합
       ↓
2017   HIDL Binder (Treble, vendor용)
       ↓
2019   Stable AIDL (HAL용)
```

---

# 15. 표준화 (CTS / CDD / VTS)

## 15.1 호환성 프로그램

| 구성 | 역할 | 관리 |
|------|-----|-----|
| **CDD** (Compatibility Definition Document) | 정책: 소프트웨어/하드웨어 요구사항 | Google, 매 버전 발행 |
| **CTS** (Compatibility Test Suite) | 메커니즘: 30만+ 자동 테스트 | Google, 무료 |
| **CTS-V** (Verifier) | 수동 테스트 (카메라, 오디오, 가속도계) | OEM 실행 |
| **VTS** (Vendor Test Suite) | 커널 + HAL 검증 (Treble 필수) | Google |
| **GTS** (GMS Test Suite) | Google 앱 통합 테스트 (비공개) | Google |

**GMS 인증 흐름**: CDD 준수 → CTS/VTS 통과 → Google 검토 → MADA 계약 → GMS 라이선스 + Android 트레이드마크.

## 15.2 라이선스 계층

| 레이어 | 라이선스 | 이유 |
|-------|---------|-----|
| Android Framework, 라이브러리, 앱 | Apache 2.0 | Copyleft 비전염, OEM 독점 가능 |
| Linux Kernel | GPL v2 | 수정사항 공개 의무 |
| Bionic libc | BSD | Apache 2.0 호환, GPL 차단 |

Apache 2.0과 GPL v2 직접 혼합은 충돌 → **시스템콜 인터페이스로 분리된 작업물**로 처리.

---

# 16. 대안 비교 (Alternatives & Trade-offs)

## 16.1 Android vs iOS

| 항목 | Android | iOS |
|------|--------|-----|
| 커널 | Linux 5.x/6.x (GPL v2), 모놀리식 | XNU (Mach + BSD 하이브리드, APSL) |
| 런타임 | ART (DEX, AOT+JIT+PGO) | Objective-C/Swift, ARC (컴파일 타임 RC) |
| 메모리 | GC (CC, Generational) — pause 발생 | ARC — 결정적, GC pause 없음 |
| IPC | Binder (zero-copy 근접, 1MB 한도) | XPC over Mach ports (NSSecureCoding 강제, 서비스별 sandbox) |
| 샌드박스 | UID DAC + SELinux MAC + seccomp | sandbox.kext (Mach 기반 MAC) + entitlement |
| 권한 | 런타임 요청 | entitlement(빌드 시 선언) + 런타임 프롬프트 |
| 앱 배포 | 오픈 (sideload, 다중 스토어) | 폐쇄 (App Store. EU DMA 이후 제한적 대안) |
| 업데이트 | OEM 의존 → 파편화 | Apple 직접 → 균일 |
| 멀티유저 | 4.2+ 지원 | 미지원 |
| 오픈소스 | AOSP 대부분 | Darwin 일부 (XNU 공개) |
| 글로벌 점유율(2024) | 72.55% | 26.82% |
| App Store 매출(2025E) | Google Play ~$65B | App Store ~$142B |

**왜 다른가**: Apple은 macOS XNU를 모바일에 축소이식 → 단일 제조사 수직통합. Google은 Linux 커널 + 새로 작성한 매니지드 런타임 → 다수 OEM이 참여하는 수평 생태계.

## 16.2 Android vs Desktop Linux

| 항목 | Android | Desktop Linux |
|------|--------|--------------|
| 기본 전원 상태 | sleep(wakelock 필요) | 활성 |
| C 라이브러리 | Bionic (~200KB, BSD) | glibc (~2MB+, LGPL) |
| Init | init.rc + property service | systemd |
| 디스플레이 | SurfaceFlinger + HWC | X11 / Wayland |
| 오디오 | AudioFlinger | PulseAudio / PipeWire |
| IPC | Binder (커널 드라이버) | D-Bus (사용자공간 데몬) |
| 앱 모델 | Activity / Service / Broadcast | 전통 프로세스 |
| 네트워킹 | Paranoid Networking (INTERNET 권한 GID 검사) | 표준 POSIX |

## 16.3 Android vs ChromeOS

| 항목 | Android | ChromeOS |
|------|--------|---------|
| 시스템 무결성 | OEM 커스텀 가능 | dm-verity로 rootfs 전체 검증 (불변) |
| 런타임 | ART | Web(Chrome) + Linux(Crostini) + Android(ARCVM) |
| Android 앱 실행 | 네이티브 | **ARCVM** (crosvm + KVM, Rust VMM) |
| 업데이트 | OEM 의존 | Google 직접, A/B 무중단 |
| 사용 사례 | 스마트폰/태블릿 | Chromebook (교육/엔터프라이즈) |

**ARC++ → ARCVM 전환(2021)**: 컨테이너(ARC++)는 ChromeOS와 Android 커널 동기화 필요 → VM(ARCVM)으로 전환하여 독립 업그레이드 가능, Rust crosvm으로 메모리 안전성 확보.

## 16.4 Android vs HarmonyOS / OpenHarmony

| 항목 | Android (AOSP) | HarmonyOS NEXT |
|------|---------------|----------------|
| 커널 | Linux 모놀리식 (~3000만 라인) | HongMeng 마이크로커널 (~100만 라인 미만) |
| AOSP 기반 | 원본 | 1~4: 포크. **NEXT(5)부터 완전 분리, Android 앱 비호환** |
| 모바일 서비스 | GMS | HMS (AppGallery) |
| IPC | Binder | Distributed Soft Bus (기기 간 자원 공유) |
| 앱 언어 | Java/Kotlin | ArkTS + ArkUI (선언형) |
| 배경 | 글로벌 | 2019 미국 제재 대응, 중국 시장 |

**분산 소프트 버스**: 폰/태블릿/워치/TV/IoT를 "슈퍼 기기"로 통합 — 다른 기기의 카메라/스피커/디스플레이를 원격 자원으로 사용.

## 16.5 Android vs Fuchsia

| 항목 | Android | Fuchsia |
|------|--------|---------|
| 커널 | Linux 모놀리식 (시스템콜 400+) | **Zircon 마이크로커널** (시스템콜 ~100) |
| 드라이버 | 커널 공간 | 사용자 공간 |
| IPC | Binder | FIDL over Channel |
| 보안 | DAC + SELinux + seccomp | **객체-캐퍼빌리티 모델** (핸들 없으면 접근 불가) |
| POSIX | 완전 호환 | 비-POSIX (의도적) |
| 앱 | ART | Flutter (Dart) |
| 배포 | 수십억 대 | Google Nest Hub만 |
| 라이선스 | Linux GPL2 + Apache 2.0 | MIT (Zircon) — GPL 비전염 |

**왜 만들었나**: Linux의 1991년 설계 제약 탈피, 컴포넌트 단위 업데이트 가능, Android+ChromeOS+IoT를 단일 아키텍처로 통합하려는 장기 목표.

## 16.6 모바일 OS 전쟁의 패자들

| OS | 최대 점유율 | 치명적 약점 |
|----|----------|-----------|
| Symbian (Nokia) | ~60% (2007) | 터치 UI 전환 실패, S60/S80/S90 단편화 |
| Windows Mobile 6.x | ~12% (2007) | 데스크탑 패러다임을 모바일에 강제 |
| Windows Phone 7/8/10 | ~3% (2013) | 늦은 출시, 앱 갭, WP7→WP8 비호환 |
| Palm webOS | <5% | HP 인수 후 전략 혼선, HTML5 앱 성능 한계 |
| BlackBerry OS | ~20% (2009) | QWERTY 집착, 터치 전환 지연 |
| Bada / Tizen (모바일) | ~5% (2012) | 삼성의 Android 집중으로 방치 |

**Android 승리 요인**: 무료 + 오픈, Java 개발 환경(낮은 진입장벽), Google 서비스 통합, 다수 OEM 가격 다양성, Play Store 타이밍.

---

# 17. 상황별 최적 선택 (When Each is Effective)

## 17.1 백그라운드 작업 API

| API | 정확 시각 | 재부팅 영속 | Doze 대응 | 권장 |
|-----|---------|-----------|---------|------|
| **WorkManager** | X (best-effort) | O (DB 저장) | O (자동) | **대부분의 백그라운드 작업** |
| **ForegroundService** | O | 별도 처리 | O (전경 유지) | 음악, 내비, 통화 — 사용자 인지 |
| JobScheduler | X | O | 부분 | WorkManager 내부 구현 (직접 비권장) |
| AlarmManager | O (`setExact`) | O | 제한적 | 사용자 알람/리마인더만 (Android 12+ `SCHEDULE_EXACT_ALARM`) |
| Handler.postDelayed | O (프로세스 내) | X | X | 짧은 UI 타이머 |

**현장 가이드**: WorkManager가 내부적으로 API 레벨에 따라 JobScheduler/AlarmManager를 자동 선택. `setExpedited()`는 Android 12+ expedited job, 이전엔 ForegroundService로 폴백.

## 17.2 IPC 메커니즘 선택

```
크로스 프로세스 필요?
  ├─ NO  → SharedFlow / StateFlow (앱 내부)
  └─ YES → 다중 메서드 API?
            ├─ YES → AIDL (Stable AIDL 권장)
            └─ NO  → 단순 커맨드?
                      ├─ YES → Messenger
                      └─ 구조화 데이터? → ContentProvider
                          데이터 없는 이벤트? → Broadcast (시스템 이벤트만)
```

**LocalBroadcastManager는 deprecated** → SharedFlow / StateFlow로 교체.
**암시적 Broadcast(8.0+)**: Manifest 등록 불가 (예외 목록 있음). 런타임 등록 또는 WorkManager Constraints로 대체.

## 17.3 스토리지 선택

| 데이터 | API | 비고 |
|-------|-----|-----|
| 앱 전용 민감 | Internal `filesDir` | 모든 버전 |
| 앱 전용 큰 파일 | `getExternalFilesDir` | 4.4+ 권한 불필요 |
| 미디어 공유 | MediaStore | API 29+ (Scoped Storage). Android 13+: READ_MEDIA_* |
| 사진/영상 선택 | **Photo Picker** | 권한 불필요. 신규 앱 권장 (Play 정책 강화 추세) |
| 문서/SD카드 | SAF (`ACTION_OPEN_DOCUMENT`) | URI grant |
| 키-값 설정 | DataStore (Preferences) | SharedPreferences 대체 (Coroutine, ACID) |
| 타입 안전 구조 | DataStore (Proto) | — |
| 관계형 | Room | SQLite 위 ORM |

**SharedPreferences는 메인 스레드 블로킹 위험** → DataStore 마이그레이션 권장:
```kotlin
val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "settings",
    produceMigrations = { ctx -> listOf(SharedPreferencesMigration(ctx, "legacy_prefs")) }
)
```

## 17.4 권한 전략

| 시나리오 | 권장 |
|---------|-----|
| 미디어 단순 선택 | Photo Picker (`PickVisualMedia`) — 권한 불필요 |
| 미디어 전체 접근 | `READ_MEDIA_IMAGES/VIDEO/AUDIO` (Play 심사) |
| 부분 사진(14+) | `READ_MEDIA_VISUAL_USER_SELECTED` |
| 위치(근사) | `ACCESS_COARSE_LOCATION` (대부분 충분) |
| 위치(정밀) | `ACCESS_FINE_LOCATION` + FGS type=location |
| 배경 위치 | `ACCESS_BACKGROUND_LOCATION` (별도 화면, 11+) |
| 요청 시점 | **기능 사용 직전**. Cold launch 즉시 요청 금지(거부율 ↑) |

## 17.5 ForegroundService Type (14+ 의무)

| 타입 | 권한 | 런타임 조건 |
|-----|-----|-----------|
| `mediaPlayback` | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | — |
| `location` | `FOREGROUND_SERVICE_LOCATION` | `ACCESS_FINE/COARSE_LOCATION` |
| `camera` | `FOREGROUND_SERVICE_CAMERA` | `CAMERA` 런타임 |
| `microphone` | `FOREGROUND_SERVICE_MICROPHONE` | `RECORD_AUDIO` |
| `dataSync` | `FOREGROUND_SERVICE_DATA_SYNC` | — |
| `connectedDevice` | `FOREGROUND_SERVICE_CONNECTED_DEVICE` | BT/NFC/USB |
| `phoneCall` | `FOREGROUND_SERVICE_PHONE_CALL` | `MANAGE_OWN_CALLS` |
| `shortService` | — | 최대 **3분** |
| `health` | `FOREGROUND_SERVICE_HEALTH` | 센서 권한 |
| `mediaProjection` | `FOREGROUND_SERVICE_MEDIA_PROJECTION` | `createScreenCaptureIntent()` 선행 |
| `specialUse` | `FOREGROUND_SERVICE_SPECIAL_USE` | **Play 심사 필요** |

```kotlin
ServiceCompat.startForeground(
    this, NOTIFICATION_ID, notification,
    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
)
```

---

# 18. 베스트 프랙티스

## 18.1 Doze / App Standby Bucket 컴플라이언스

| Bucket | Job 할당 | Alarm | 비고 |
|--------|--------|------|-----|
| Active | 무제한 | 무제한 | 사용 중 |
| Working Set | 적당 | 적음 | 매일 사용 |
| Frequent | 적음 | 적음 | 주기 사용 |
| Rare | 매우 적음 | 매우 적음 | 가끔 사용 |
| Restricted (31+) | 1/day, 10분 배치 | 1/day | 과다 사용 앱 |

- Bucket 조작 시도 금지 (OEM별 알고리즘 상이)
- 모든 Bucket에서 동작하도록 설계
- Doze wakeup은 wakelock 대신 **FCM High Priority Message** 활용

## 18.2 ANR 방지

```kotlin
// ContentProvider에 StrictMode 설치 — Application.onCreate()보다 이른 시점
class StrictModeProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectAll().penaltyLog().penaltyDeath()
                    .build()
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectLeakedSqlLiteObjects()
                    .detectLeakedClosableObjects()
                    .penaltyLog().build()
            )
        }
        return true
    }
}
```

ANR의 80%는 메모리 누수로 인한 GC 포즈에서 발생.

## 18.3 상태 복원 계층

| 상태 | 위치 | 수명 | 크기 |
|-----|-----|-----|-----|
| UI 임시 상태 | `onSaveInstanceState` / `rememberSaveable` | Task stack | ~1MB Bundle |
| 비즈니스 로직 | `SavedStateHandle` | 프로세스 죽음 후 복원 | 소량 |
| 영속 데이터 | Room / DataStore | 앱 삭제 전까지 | 무제한 |
| Configuration change | ViewModel | 회전/테마/언어 변경 | 무제한 |

```kotlin
class SearchViewModel(private val savedStateHandle: SavedStateHandle) : ViewModel() {
    var searchQuery: String
        get() = savedStateHandle["query"] ?: ""
        set(value) { savedStateHandle["query"] = value }
}
```

Task 제거(스와이프, 강제종료) 시 SavedStateHandle도 소실 → 진정한 영속성은 DB/DataStore.

## 18.4 Multi-Process 가드

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (getProcessName() == packageName) { // API 28+
            // 메인 프로세스에서만 (Analytics, Crash reporter)
            initAnalytics()
        }
        // 모든 프로세스 공통 초기화만 여기
    }
}
```

Multi-process는 디버깅 난이도 급증, ContentProvider/Application.onCreate가 각 프로세스마다 호출됨에 주의.

## 18.5 R8 / ART 친화 패턴

```groovy
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

- Reflection 사용 클래스는 `-keep` 또는 `@Keep`
- Retrofit, Gson, Room 등은 자체 consumer rules 포함
- Baseline Profile(`androidx.profileinstaller`)로 콜드 스타트 가속

## 18.6 64-bit ABI

Play Store 정책(2019.08~): 32-bit native lib이 있으면 64-bit도 반드시 포함. AAB 사용 시 Play가 자동 분리(권장).

```bash
unzip -l app-release.apk | grep "lib/"
# lib/arm64-v8a/, lib/armeabi-v7a/ 모두 있어야 함
```

---

# 19. 함정 / 안티패턴

## 19.1 Wakelock 과보유

```kotlin
// 안티: 크래시 시 영원히 보유
wl.acquire(); doWork(); wl.release()

// 정답: timeout + try-finally
wl.acquire(10 * 60 * 1000L)
try { doWork() } finally { if (wl.isHeld) wl.release() }
```

Doze에서는 앱 wakelock이 무시됨. FCM/WorkManager로 대체.

## 19.2 토큰 평문 저장

```kotlin
// 안티
prefs.edit().putString("auth_token", token).apply()

// 정답 (단기)
val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
val encryptedPrefs = EncryptedSharedPreferences.create(
    context, "secret_prefs", masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
// EncryptedSharedPreferences는 deprecated 추세 → DataStore + Tink + Keystore로 마이그레이션
```

## 19.3 FileProvider Path Traversal

```xml
<!-- 안티: 전체 노출 -->
<files-path name="external" path="/" />
<!-- 정답: 최소 범위 -->
<files-path name="my_images" path="images/" />
```

ContentProvider가 제공한 파일명을 그대로 신뢰 금지 — 악성 앱이 `"../../../etc/passwd"` 반환 가능. `File(name).name`으로 경로 구분자 제거 + 화이트리스트 검증.

## 19.4 ContentProvider 무제한 노출

```xml
<!-- 안티 -->
<provider android:exported="true" android:grantUriPermissions="true" />
<!-- 정답 -->
<provider android:exported="false" android:grantUriPermissions="true"
          android:permission="com.example.MY_PROVIDER_PERMISSION" />
```

## 19.5 Custom Permission TOCTOU (CVE-2019-2200 계열)

1. 앱 A가 `com.example.MY_PERM` signature로 정의
2. 앱 A 삭제 → 권한 정의 사라짐
3. 악성 앱 B가 동명 권한을 normal로 재정의
4. 앱 A 재설치 → B가 A의 컴포넌트 접근 가능

**해결**: 호출자 서명을 직접 검증하는 방식이 가장 안전.

```kotlin
fun isCallerTrusted(context: Context): Boolean {
    val callerPkg = context.packageManager.getNameForUid(Binder.getCallingUid()) ?: return false
    val callerSig = context.packageManager.getPackageInfo(
        callerPkg, PackageManager.GET_SIGNING_CERTIFICATES
    ).signingInfo?.apkContentsSigners?.firstOrNull()
    val mySig = context.packageManager.getPackageInfo(
        context.packageName, PackageManager.GET_SIGNING_CERTIFICATES
    ).signingInfo?.apkContentsSigners?.firstOrNull()
    return callerSig?.toByteArray()?.contentEquals(mySig?.toByteArray()) == true
}
```

## 19.6 Deprecated API

| 안티 | 대체 |
|-----|------|
| AsyncTask (API 30 deprecated) | Coroutine + viewModelScope |
| Loader / CursorLoader | Room + Flow |
| LocalBroadcastManager | SharedFlow / StateFlow |
| READ_EXTERNAL_STORAGE (API 33+ deprecated) | READ_MEDIA_IMAGES/VIDEO/AUDIO |
| Apache HTTP Client (API 28 제거) | OkHttp / HttpURLConnection |

## 19.7 Doze 우회 시도

```kotlin
// 안티
val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
// Play 정책: 알람/의료 등 특수 카테고리만 허용. 일반 앱이 사용 시 Play 거부/제거
```

99%의 케이스는 WorkManager + FCM으로 해결.

## 19.8 메모리 누수 패턴

| 패턴 | 해결 |
|-----|------|
| Singleton에 Activity context | `applicationContext` |
| 비정적 내부 Handler/Runnable | `WeakReference` 또는 정적 |
| 미등록 BroadcastReceiver | 대칭 등록/해제 |
| 미종료 Cursor | `use {}` |
| ViewModel에 View 참조 | 금지 |

## 19.9 ThreadPool 하드코딩

```kotlin
// 안티
val executor = Executors.newFixedThreadPool(8)
// 정답
val executor = Executors.newFixedThreadPool(
    (Runtime.getRuntime().availableProcessors() - 1).coerceAtLeast(1)
)
// Coroutine: Dispatchers.IO/Default 자동 최적
```

## 19.10 RECEIVE_BOOT_COMPLETED 남용

WorkManager의 `PeriodicWorkRequest`는 재부팅 후 자동 재스케줄링 — `BOOT_COMPLETED`가 불필요한 경우 다수.

## 19.11 KeyStore 안전한 생성

```kotlin
val spec = KeyGenParameterSpec.Builder(
    "my_key_alias",
    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
).apply {
    setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    setKeySize(256)
    setUserAuthenticationRequired(true)
    setUserAuthenticationParameters(
        30,
        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
    )
    setInvalidatedByBiometricEnrollment(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) setIsStrongBoxBacked(true)
}.build()
```

---

# 20. 마이그레이션 가이드

## 20.1 SDK Target 연간 강제 (Play)

| 시기 | 신규 앱 | 기존 앱 |
|-----|-------|--------|
| 2025.08.31 | API 35 (Android 15)+ | API 34+ |
| 매년 | 전년도 +1 | 전년도 +1 |

```bash
./gradlew lint  # API 레벨 경고 확인
# https://developer.android.com/about/versions/XX/behavior-changes-XX
```

## 20.2 Scoped Storage 마이그레이션

```kotlin
fun migrateFileToMediaStore(file: File, context: Context): Uri? {
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, file.name)
        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES)
    }
    val uri = context.contentResolver.insert(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values
    ) ?: return null
    context.contentResolver.openOutputStream(uri)?.use { out ->
        file.inputStream().use { it.copyTo(out) }
    }
    file.delete()
    return uri
}
```

## 20.3 Apache HTTP Client → OkHttp (Android 9 제거)

```kotlin
// 안티
import org.apache.http.client.HttpClient

// 정답
val client = OkHttpClient()
val request = Request.Builder().url(url).build()
client.newCall(request).execute()
```

## 20.4 32-bit → 64-bit ABI

AAB(Android App Bundle) 사용 권장 → Play가 자동 분리.

## 20.5 HIDL → Stable AIDL

앱 개발자 직접 영향 없음 (시스템/벤더 영역). 앱은 Camera2, AudioTrack 등 SDK API로 간접 접근.

---

# 21. 빅테크 실전 사례

## 21.1 Google — Pixel + Tensor SoC

| 항목 | 내용 |
|-----|------|
| SoC | Tensor G1(2021) → G2 → G3 → G4 → G5 |
| 설계 철학 | "시스템 전체 성능·효율" 우선. 2대형+2중형+4소형 코어 |
| 차별 | TPU 내장 ML 가속, 실시간 음성/번역, 사진 언블러 |
| 최적화 | ART PGO 프로파일 선탑재, GKI 최신 커널 우선, Mainline 모듈 우선 갱신 |
| 업데이트 | Pixel 7+: **7년** OS·보안 업데이트 |

## 21.2 Samsung — One UI + Knox

```
[애플리케이션] Knox Workspace (컨테이너)
[시스템]      SE for Android (확장 SELinux 정책)
[커널]        Real-time Kernel Protection (RKP), TIMA
[하드웨어]    Knox Vault (분리 보안 프로세서), TrustZone
[부팅]        Secure Boot + KNOX_BITS (eFuse 변조 감지)
```

- Exynos/Snapdragon 커스텀 커널, EROFS 파일시스템, AutoFDO 최적화
- **Knox Vault**: iOS Secure Enclave 대응 (생체키, 결제 크레덴셜 격리)
- **SDP (Sensitive Data Protection)**: 런타임 중에도 선택 파일 암호화 유지
- **KPE**: 엔터프라이즈 EMM/VPN/원격 관리

## 21.3 Xiaomi / OPPO / vivo — HyperOS / ColorOS / OriginOS

AOSP 포크 + 자체 앱 스토어 + 중국 내 GMS 대체. HyperOS 2부터 GKI + Linux 6.6.30 업그레이드 일부 기기. 열 제한, GPU 부스트, I/O 스케줄러 튜닝.

## 21.4 Huawei — HarmonyOS / OpenHarmony

| 단계 | 내용 |
|-----|------|
| 1~3 (2019~2023) | AOSP 포크 + 이중 프레임워크. Android 앱 호환 |
| 4 (2023) | AOSP 의존도 감소 |
| **NEXT/5 (2024)** | **AOSP 완전 제거**, HongMeng 마이크로커널, Android 앱 비호환 |

분산 아키텍처, 형식 검증으로 공격 표면 90%+ 축소 주장.

## 21.5 Amazon — Fire OS

AOSP 기반 (Fire OS 8 = Android 11). GMS 전체 제거 → Amazon Appstore + ADM + Silk Browser. 2025: Fire OS 포기 후 순수 Android 전환 검토.

## 21.6 Meta — Quest Horizon OS

AOSP 기반 (Snapdragon XR 시리즈 전용). 2024.04 Quest OS → **Meta Horizon OS** 리브랜딩. 공간 앱 프레임워크, 3D UI, 핸드트래킹 API. 2024부터 Android 2D 앱을 창으로 실행 가능.

## 21.7 Tesla — 독자 Linux

**Android Automotive 미채택**. Ubuntu 기반 독자 Linux + 인터프리터/패키지매니저 제거. MCU1(Tegra 3) → MCU2(Atom) → MCU3(Ryzen). 인포테인먼트와 별도 FSD 컴퓨터 2중화.

## 21.8 Android Automotive OS vs Android Auto

| 항목 | Android Auto | AAOS |
|-----|------------|-----|
| 동작 | 폰 앱 미러링 | 차량 OS 자체 |
| 폰 의존 | 필요 | 없음 |
| HAL | — | **VHAL** (CAN 버스 ↔ Android) |
| 첫 상용 | — | Polestar 2 (2021), Volvo XC40 Recharge |
| 채택 OEM | 범용 | Volvo, Renault, Ford, GM, 현대, 기아 |

## 21.9 Wear OS — Tizen 통합

| 시기 | 내용 |
|-----|------|
| 2014~15 | Samsung: Android Wear 잠시 → Tizen 회귀 |
| 2015~20 | Samsung 워치 = Tizen 단독 |
| **2021.05** | **Google + Samsung 전략 파트너십** — Tizen 기능을 Wear OS에 통합 |
| 2021.08 | **Galaxy Watch 4** = Wear OS 3 + One UI Watch |
| 현재 | Tizen은 삼성 스마트 TV 전용 |

## 21.10 Android TV vs Google TV

| 항목 | Android TV | Google TV |
|-----|----------|-----------|
| 출시 | 2014 | 2020 |
| 관계 | 기반 OS | UI/UX 레이어 (위에 얹힘) |
| 차별 | 앱 중심 | 콘텐츠 디스커버리 중심 |
| GMS | 포크 가능 | GMS + Google 인증 필수 |

---

# 22. 참고 자료

## 공식 문서
- [Android Architecture | AOSP](https://source.android.com/docs/core/architecture)
- [Android Version History | Wikipedia](https://en.wikipedia.org/wiki/Android_version_history)
- [Generic Kernel Image | AOSP](https://source.android.com/docs/core/architecture/kernel/generic-kernel-image)
- [Project Mainline | AOSP](https://source.android.com/docs/core/ota/modular-system)
- [APEX File Format | AOSP](https://source.android.com/docs/core/ota/apex)
- [Binder Overview | AOSP](https://source.android.com/docs/core/architecture/ipc/binder-overview)
- [AIDL for HALs | AOSP](https://source.android.com/docs/core/architecture/aidl/aidl-hals)
- [Stable AIDL | AOSP](https://source.android.com/docs/core/architecture/aidl/stable-aidl)
- [Zygote Processes | AOSP](https://source.android.com/docs/core/runtime/zygote)
- [Low Memory Killer Daemon | AOSP](https://source.android.com/docs/core/perf/lmkd)
- [Graphics Architecture | AOSP](https://source.android.com/docs/core/graphics/architecture)
- [SurfaceFlinger and HWC | AOSP](https://source.android.com/docs/core/graphics/surfaceflinger-windowmanager)
- [File-Based Encryption | AOSP](https://source.android.com/docs/security/features/encryption/file-based)
- [Verified Boot (AVB) | AOSP](https://source.android.com/docs/security/features/verifiedboot/avb)
- [dm-verity Implementation | AOSP](https://source.android.com/docs/security/features/verifiedboot/dm-verity)
- [SELinux in Android | AOSP](https://source.android.com/docs/security/features/selinux)
- [Application Sandbox | AOSP](https://source.android.com/docs/security/app-sandbox)
- [Hardware-backed Keystore | AOSP](https://source.android.com/docs/security/features/keystore)
- [Trusty TEE | AOSP](https://source.android.com/docs/security/features/trusty)
- [Privacy Indicators | AOSP](https://source.android.com/docs/core/permissions/privacy-indicators)
- [Scoped Storage | AOSP](https://source.android.com/docs/core/storage/scoped)
- [Android Compatibility Overview | AOSP](https://source.android.com/docs/compatibility/overview)
- [Android Licenses | AOSP](https://source.android.com/setup/start/licenses)
- [ART JIT Compiler | AOSP](https://source.android.com/docs/core/runtime/jit-compiler)
- [Dalvik Executable Format | AOSP](https://source.android.com/docs/core/runtime/dex-format)

## 개발자 문서
- [Foreground service types required (Android 14)](https://developer.android.com/about/versions/14/changes/fgs-types-required)
- [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [App Standby Buckets](https://developer.android.com/topic/performance/appstandby)
- [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)
- [DataStore](https://developer.android.com/topic/libraries/architecture/datastore)
- [Save UI states](https://developer.android.com/topic/libraries/architecture/saving-states)
- [Custom Permissions risks](https://developer.android.com/privacy-and-security/risks/custom-permissions)
- [Implicit broadcast exceptions](https://developer.android.com/develop/background-work/background-tasks/broadcasts/broadcast-exceptions)
- [Meet Google Play target API requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Support 64-bit architectures](https://developer.android.com/google/play/requirements/64-bit)
- [Baseline Profiles overview](https://developer.android.com/topic/performance/baselineprofiles/overview)

## 학술 자료
- [Mayrhofer et al., "The Android Platform Security Model" (arXiv:1904.05572)](https://arxiv.org/pdf/1904.05572)
- [SEAndroid Policy Evolution (arXiv:1812.00920)](https://ar5iv.labs.arxiv.org/html/1812.00920)
- ["F2FS: A New File System for Flash Storage" (USENIX FAST 2015)](https://www.usenix.org/conference/fast15/technical-sessions/presentation/lee)
- ["Boxify" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/backes)
- ["Breaking Android Sandboxing" (USENIX Security 2024)](https://www.usenix.org/system/files/usenixsecurity24-lin-yan.pdf)
- [Stephen Smalley, "Protecting Android TCB with SELinux" (LSS 2014, PDF)](http://kernsec.org/files/lss2014/lss2014_androidtcb_smalley.pdf)
- [Dalvik VM Internals (PDF, Levin)](https://newandroidbook.com/files/ArtOfDalvik.pdf)
- [Android Binder IPC (Vanderbilt PDF)](https://www.dre.vanderbilt.edu/~schmidt/cs282/PDFs/android-binder-ipc.pdf)

## 커뮤니티 / 분석
- [Greg KH: Android and Linux kernel community (LWN)](https://lwn.net/Articles/372572/)
- [Bringing Android closer to mainline (LWN)](https://lwn.net/Articles/472984/)
- [Project Treble (LWN)](https://lwn.net/Articles/765467/)
- [Project Mainline Explained (Esper)](https://www.esper.io/blog/what-is-project-mainline)
- [OpenBinder Wikipedia](https://en.wikipedia.org/wiki/OpenBinder)
- [Bionic Wikipedia](https://en.wikipedia.org/wiki/Bionic_(software))
- [The Six Million Dollar LibC (2008, Bionic 명명 배경)](https://codingrelic.geekhold.com/2008/11/six-million-dollar-libc.html)
- [OSnews: Dianne Hackborn OpenBinder Interview](https://www.osnews.com/story/13674/introduction-to-openbinder-and-interview-with-dianne-hackborn/)
- [LWN ION 메모리 할당자](https://lwn.net/Articles/480055/)
- [ARC++ → ARCVM (chromeos.dev)](https://chromeos.dev/en/posts/making-android-runtime-on-chromeos-more-secure-and-easier-to-upgrade-with-arcvm)

## 도서
- *Androids: The Team That Built the Android OS* — Chet Haase, No Starch Press(2021)
- *Android Internals* Vol. I/II — Jonathan Levin
- *Android Forensics* — Andrew Hoog

## 빅테크
- [Apple Platform Security Guide](https://help.apple.com/pdf/security/en_US/apple-platform-security-guide.pdf)
- [Samsung Knox Security Whitepaper](https://images.samsung.com/is/content/samsung/p5/global/business/mobile/SamsungKnoxSecuritySolution.pdf)
- [Google Tensor Wikipedia](https://en.wikipedia.org/wiki/Google_Tensor)
- [HarmonyOS NEXT Wikipedia](https://en.wikipedia.org/wiki/HarmonyOS_NEXT)
- [OpenHarmony Overview](https://gitee.com/openharmony/docs/blob/master/en/OpenHarmony-Overview.md)
- [Fire OS Wikipedia](https://en.wikipedia.org/wiki/Fire_OS)
- [Meta Horizon OS Wikipedia](https://en.wikipedia.org/wiki/Meta_Horizon_OS)
- [Android Automotive Wikipedia](https://en.wikipedia.org/wiki/Android_Automotive)
- [Zircon Kernel — fuchsia.dev](https://fuchsia.dev/fuchsia-src/concepts/kernel)
- [XNU Wikipedia](https://en.wikipedia.org/wiki/XNU)
