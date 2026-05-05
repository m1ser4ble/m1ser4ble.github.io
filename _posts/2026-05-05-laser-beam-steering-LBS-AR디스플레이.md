---
layout: single
title: "LBS — Laser Beam Steering / Scanning AR 디스플레이 완전가이드"
date: 2026-05-05 23:03:00 +09:00
categories: frontend
excerpt: "LBS 기반 AR 디스플레이는 MEMS 거울로 RGB 레이저를 시간축 위에서 주사해 영상을 만드는 방식으로, 매우 작은 광학 부피와 고휘도를 얻는 대신 speckle·안전성·eyebox 문제가 따라온다."
toc: true
toc_sticky: true
tags: [lbs, laser, ar, display, waveguide]
source: "/home/dwkim/dwkim/docs/xr/laser-beam-steering-LBS-AR디스플레이.md"
---

TL;DR
- LBS는 레이저를 패널로 표시하는 것이 아니라 MEMS 미러로 한 점씩 주사해 이미지를 만드는 스캐닝 디스플레이 방식이다.
- AR glasses에서 작은 부피와 높은 밝기를 얻기 좋아 주목받지만, speckle·안구 안전·eyebox 확대 같은 난제가 함께 온다.
- Meta가 현재 양산 제품에 바로 LBS를 쓴다고 단정하기보다, LBS·waveguide·microLED·LCoS 계열 전체를 구분해서 봐야 한다.

## 1. 개념
LBS AR 디스플레이는 RGB 레이저와 MEMS 스캐닝 미러를 이용해 픽셀을 시간적으로 그려내는 광학 구조와 그 장단점을 정리한다.

## 2. 배경
AR 기기에서 디스플레이는 단순 패널 선택이 아니라 광원, waveguide, eyebox, 안전 규격이 한꺼번에 엮인 시스템 문제다. 특히 LBS는 이름이 익숙해 보여도 beam steering과 beam scanning이 뒤섞여 자주 오해된다.

## 3. 이유
이 구조를 알아야 HoloLens, Meta Orion, 차세대 glasses 프로토타입이 왜 서로 다른 광학 스택을 택했는지 해석할 수 있다. 또 microLED, LCoS, waveguide 설계와의 비교도 훨씬 명확해진다.

## 4. 특징
- MEMS 미러가 raster 또는 Lissajous 패턴으로 레이저 빔을 스캔한다
- 높은 밝기와 작은 엔진 부피가 장점이지만 speckle과 eyebox 확보가 어렵다
- waveguide, HOE, reflective combiner 선택이 최종 사용자 경험을 크게 바꾼다
- IEC 60825-1 class 1 안전 조건이 제품화의 핵심 제약이다

## 5. 상세 내용

# LBS — Laser Beam Steering / Scanning AR 디스플레이 완전가이드

> **작성일**: 2026-05-05
> **카테고리**: XR / Display / Optics / Hardware
> **트리거**: 사용자 메모 — "LBS는 Laser Beam Steering, Meta glass에서 채택하는 방식으로 보여진다." → 사실 검증 필요. 실제로 Meta Orion(2024.09 공개)은 silicon carbide waveguide + microLED(LEDoS)이며 LBS가 아님. 그러나 LBS는 HoloLens 2가 채택한 실재 기술이며 Meta Reality Labs도 photonic-IC 기반 laser display를 2025.08 *Nature*에 발표 — "Meta가 LBS를 본다"는 인상은 절반 맞고 절반 틀림. AR 디스플레이 옵션 전체를 정리하면서 정확한 현황을 짚는다.
> **포함 내용**: Laser Beam Steering vs Laser Beam Scanning 용어 분리, MEMS mirror, dual-axis gimbal, dual-mirror 구조, raster vs Lissajous scan pattern, resonant frequency, Q-factor, RGB laser combiner, edge-emitting laser diode (EEL), VCSEL, SLED, 픽셀당 nanosecond budget, étendue, exit pupil, eyebox, FOV, focal depth, Maxwellian view, retinal projection, vergence-accommodation conflict, holographic combiner, HOE, diffractive waveguide (SRG), reflective waveguide (Lumus), polarized waveguide, geometric waveguide, silicon carbide waveguide, micro-LED / LEDoS, micro-OLED, LCoS (Liquid Crystal on Silicon), DLP / DMD, Texas Instruments, JBD, OMNIVISION, Avegant, MicroVision PicoP, Univ of Washington Virtual Retinal Display, Thomas Furness, North Focals, Bosch Light Drive, ams OSRAM, Sony LBS engine, OQmented, ST Microelectronics, TDK, Maradin, Mirrorcle, IEC 60825-1 Class 1 eye safety, MPE, speckle reduction, rotating diffuser, electroactive diffuser, chiral nematic LC, foveated rendering, photonic integrated circuit (PIC), nanophotonics, HoloLens 2 (2019.02 발표/2019.11 출시), Meta Orion (2024.09), Meta Hypernova / Ray-Ban Display (2025.09 LCoS + Lumus reflective waveguide), Apple Vision Pro (micro-OLED + pancake), Snap Spectacles 5 (2024 LCoS + WaveOptics diffractive), Magic Leap 2 (LCoS), Google Project Iris 취소, Google Raxium microLED, Samsung Galaxy XR (Project Moohan), Meta 2-mm Nature 2025 ultrathin laser display, NeRF/3DGS/VGGT 클러스터 cross-link

---

# 1. LBS 한 줄 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                  LBS 한 줄 정의                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "RGB 레이저 다이오드의 출력을 진동하는 MEMS 거울로 시간                  │
│   동기화해 픽셀을 한 번에 하나씩 그리는 디스플레이 — 픽셀                 │
│   그리드 자체가 광학적으로 존재하지 않고, '거울이 그 시각에                 │
│   향한 방향 + 그 시각의 RGB 강도' 가 한 픽셀이 된다."                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  RGB Laser → Combiner → MEMS Mirror → Combiner       │       │
│  │              (dichroic)  (1~2 axis)    (lens/HOE)    │       │
│  │                                          │            │       │
│  │                                          ▼            │       │
│  │                               Waveguide / 직접 동공      │       │
│  │                                          │            │       │
│  │                                          ▼            │       │
│  │                                       Retina         │       │
│  │                                                       │       │
│  │  특징: 픽셀 그리드 없음 / 자체 발광 / Maxwellian 가능 /  │       │
│  │       매우 작은 광학 부피 / speckle 노이즈 / coherent   │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

이 문서는 LBS를 (1) **무엇인가** (2) **왜 만들어졌는가** (3) **어떻게 동작하는가** (4) **누가 채택했는가** (5) **microLED/LCoS/DLP/micro-OLED 와 어떻게 다른가** (6) **Meta가 정말 LBS를 채택했는가** 의 6가지 축으로 푼다. 마지막 축이 사용자 트리거 질문의 핵심 검증 지점.

---

# 2. 용어 ① — "LBS"의 두 의미 (가장 자주 혼동됨)

같은 약어 `LBS` 가 두 가지 의미로 쓰인다. AR 디스플레이 맥락에서는 보통 **Scanning** 을 의미하지만 두 용어가 일상적으로 혼용되므로 명확히 구분.

| 약어 풀이 | 한글 | 의미 | 대표 응용 |
|----------|------|-----|---------|
| **Laser Beam Steering** | 레이저 빔 조향 | 광 빔의 **방향**을 동적으로 조절. 결과물이 이미지일 필요 없음 | LiDAR, 자유공간 광통신, 가공기 갈바노 |
| **Laser Beam Scanning** | 레이저 빔 주사 | 정해진 패턴(raster/Lissajous)으로 빔을 **2D 이미지** 로 그리기 | AR 디스플레이, pico projector, 의료 endoscopy |

**물리적 메커니즘은 거의 동일** — MEMS mirror 가 회전해 빔 방향을 바꾼다. 다만 의도가 "특정 점 한 개 가리키기" 인지 "frame 전체 그리기" 인지가 다를 뿐. 사용자 노트의 "Laser Beam Steering" 표현은 일반적으로 후자(Scanning) 까지 포괄해 쓰이는 것이 업계 관행이며, **MicroVision/Microsoft 등 벤더는 "Scanning" 을 공식 명칭으로 사용**한다 (PicoP**Scanning** Technology, MEMS Laser **Scanning** Display Module).

> 본 문서는 이후 "LBS" 라고 적으면 **Laser Beam Scanning (디스플레이)** 의미로 사용. Steering 의미가 필요할 땐 명시.

---

# 3. 용어 ② — 광학·광원·광로 사전

## 3.1 광원 (Light Source)

| 용어 | 풀이 |
|------|-----|
| **Laser diode** | 반도체 레이저 다이오드. 단일 파장, 고 coherence, 높은 efficacy |
| **EEL** | **E**dge-**E**mitting **L**aser. 측면(cleaved facet)으로 출사. 가시광 RGB 에 강함, 빔 elliptical |
| **VCSEL** | **V**ertical-**C**avity **S**urface-**E**mitting **L**aser. 표면 수직 출사. 대량 wafer 공정, low threshold, 대칭 빔. 가시광 출력은 EEL 대비 약함 |
| **SLED** | Superluminescent LED. coherence 가 laser 와 LED 의 중간. speckle ↓ |
| **Laser combiner** | 적·녹·청 3 채널 빔을 한 광축으로 합치는 dichroic mirror/x-cube 어레이 |
| **모듈레이션** | RGB 다이오드의 전류를 픽셀별로 ns 단위로 swing — 별도 변조 패널이 필요 없음 |

## 3.2 빔 조향 / 주사

| 용어 | 풀이 |
|------|-----|
| **MEMS** | **M**icro-**E**lectro-**M**echanical **S**ystems. 반도체 공정으로 mm 이하 기계 구조 제작 |
| **MEMS mirror** | 보통 직경 1~2 mm Si 미러를 spring + comb-drive/piezo 로 구동 |
| **Dual-axis gimbal** | 단일 미러를 X/Y 두 축 모두로 기울임. 부피 ↓ 동기화 ↑ but 양 축 모두 resonant 어려움 |
| **Dual-mirror** | 빠른 X-축 미러 + 느린 Y-축 미러를 직렬 배치. 산업 표준 (PicoP, Bosch) |
| **Raster scan** | TV 처럼 좌→우 빠른 line, 위→아래 느린 frame. 1:N 주파수 비 |
| **Lissajous scan** | X·Y 둘 다 high-Q resonant. 트레이스가 Lissajous 도형 — fill factor 가 시간에 따라 점진 증가 |
| **Resonant freq.** | 미러를 가장 효율적으로 흔들 수 있는 고유 진동수. 보통 X-축 20~30 kHz |
| **Q-factor** | 공진 sharpness. 높을수록 진폭은 크지만 주파수 선택폭 좁음 |

## 3.3 광 결합 / 망막 전달

| 용어 | 풀이 |
|------|-----|
| **Étendue** | 광원의 면적 × 발산각. Liouville 정리에 의해 광학계가 줄일 수 없는 보존량 |
| **Exit pupil** | 광학계 마지막에서 빔이 통과하는 가상 구멍. 사용자 눈동자가 위치해야 할 자리 |
| **Eyebox** | 사용자 눈이 움직여도 정상 영상을 볼 수 있는 3D 부피. 큰 eyebox = 편안함 |
| **FOV** | Field Of View. 시야각. AR 50° 이하가 일반, VR 100° 이상 |
| **Maxwellian view** | 광원이 거의 점광원이 되어 동공 한 점을 통과 → 망막에 그대로 결상. **수정체 accommodation 무관 (모든 거리 in-focus)** |
| **Combiner** | 외부 실세계 빛 + 디스플레이 빛을 합치는 광학 부품. 반투명 거울 / waveguide / HOE |
| **HOE** | **H**olographic **O**ptical **E**lement. 간섭무늬로 특정 파장만 회절 |

## 3.4 Waveguide 종류

| 종류 | 메커니즘 | 장점 | 단점 | 채택 사례 |
|------|---------|------|------|---------|
| **Diffractive (SRG)** | Surface Relief Grating 으로 in/out coupling | 얇음, 양산성 | rainbow, 색 분산, 효율 ↓ | Snap Spectacles 5 (WaveOptics), HoloLens 2, Magic Leap 1, Meta Orion (SiC SRG) |
| **Reflective (Lumus)** | 반투명 미러 어레이 (geometric) | 색 균일도 ↑, 효율 ↑ | 두께·무게 ↑, 정렬 까다로움 | Meta Hypernova/Ray-Ban Display 2025 |
| **Holographic (HOE)** | 부피 hologram | 두께 ↓, 특정 파장 선택성 | 양산 어려움, 색 균일성 | North Focals (laser+HOE) |
| **Polarized** | 편광 분리·재합성 | 효율 균형 | 편광 안경에 영향 | (연구) |

## 3.5 안전

| 등급 | IEC 60825-1 의미 |
|------|-----------------|
| **Class 1** | 모든 정상 사용 조건에서 **MPE(Maximum Permissible Exposure) 초과 불가**. 망원경/현미경 사용해도 안전 — "eye-safe" |
| Class 2 | 가시광, 0.25 s 미만 (눈 깜빡임 반사) 안전 |
| Class 3R / 3B | 직접 노출 위험 |
| Class 4 | 화상·화재 위험 |

AR glasses 는 **반드시 Class 1** 인증 필요. Bosch Light Drive 의 빔 power 가 **15 µW** — 일반 class-1 레이저 포인터 한계(400 µW) 대비 1/26 — 가 그 사례.

---

# 4. 등장 배경 (Why LBS for AR)

## 4.1 AR glasses 가 풀어야 하는 4 중 제약

```
┌─────────────────────────────────────────────────────────────────┐
│            AR glasses 의 "불가능한 4 중주"                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ① 가벼움 (안경 폼팩터, 100 g 미만이 사용자 인내선)                  │
│         └─ → 광학/PCB/배터리 모두 작아야                           │
│                                                                  │
│  ② 야외 밝기 (실외 5,000 nit 환경에서 글자 읽혀야)                  │
│         └─ → 디스플레이 밝기 1,000 nit @ eye 이상                  │
│                                                                  │
│  ③ 긴 배터리 (안경 사이즈에 ~150 mAh, 종일 사용)                    │
│         └─ → mW 단위 디스플레이 전력                                │
│                                                                  │
│  ④ 자연스러운 see-through (실세계 광 흡수 ↓, 색감 왜곡 ↓)           │
│         └─ → combiner 투명도 ↑                                    │
│                                                                  │
│  trade-off: ② ↔ ③, ① ↔ ④ 가 모두 충돌                            │
└─────────────────────────────────────────────────────────────────┘
```

## 4.2 기존 마이크로디스플레이의 한계

| 기술 | 광 효율 (panel→eye) | 광원 | 한계 |
|------|---------------------|------|------|
| **LCoS** | ~1~5% (편광 손실 + waveguide 손실) | LED/laser | 야외 밝기 ↓, contrast ↓ |
| **DLP** | ~10~30% | LED/laser | DMD 모듈 부피 ↑ |
| **micro-OLED** | self-emissive ~5% efficacy | 자체 | 야외 밝기 부족 (Vision Pro 도 indoor 위주) |
| **micro-LED** | self-emissive ~30% efficacy | 자체 | 양산 yield 낮음, 색 변환 어려움 |
| **LBS** | **켜진 픽셀에만 광 인가** → ideal 시 ~80%+ | RGB laser | speckle, 색역, 안전 인증 |

## 4.3 LBS 의 4 가지 매력

```
1. 켜진 픽셀에만 광 인가
     └─ 검은 픽셀 = 레이저 OFF
     └─ 진정한 OLED 수준 black + 더 낮은 평균 전력
     └─ "sparse" 콘텐츠 (HUD 텍스트) 에서 마이크로와트 단위로 떨어짐

2. RGB 레이저 = 100%+ Rec.2020 색역
     └─ 단일 파장 → 색역 꼭짓점이 매우 밖
     └─ skin tone 까다로움은 별도 보정 필요

3. Maxwellian view 가능
     └─ 광원이 점광원에 가까워 동공 통과 → 망막 직접 결상
     └─ 수정체 accommodation 무관 → vergence-accommodation conflict 일부 완화

4. 광학 모듈 부피 < 0.5 cc 가능
     └─ MEMS mirror + 3-laser combiner 만 있으면 됨
     └─ Bosch Light Drive 가 < 10 g 달성한 핵심 이유
```

이 4 가지가 **AR glasses 만의 요구사항**과 맞물리면서 LBS 가 2010 년대 후반 "AR 의 미래" 후보로 급부상.

---

# 5. 역사적 기원 (1980s ~ 2025)

## 5.1 학술 시작

```
1980s   Bell Labs / Sandia National Laboratories
        └─ 실리콘 micro-machined cantilever / torsional mirror 학회 보고
        └─ 산업용 광 스위치 / barcode scanner 응용

1989    Univ of Washington HITLab (Thomas Furness)
        └─ Virtual Retinal Display (VRD) 개념 제안
        └─ "scanning beam directly onto retina" 의 시초

1993    Microvision (시애틀) 창립
        └─ HITLab VRD 라이선스, 상용화 시도

1998    UW VRD 시연 — full-color, 800x600
        └─ 그러나 광원이 큰 He-Ne 레이저 → 휴대 불가
```

## 5.2 PicoP 시대

```
2004    Microvision PicoP 1세대 발표
        └─ 단일 dual-axis MEMS mirror + RGB laser
        └─ pico projector (스마트폰 크기) 대상

2009    Sony가 PicoP 라이선스 → SHOWWX 휴대 프로젝터
        └─ 일반 소비자용 첫 LBS 프로젝터

2010s   pico projector 시장 성장 실패
        └─ LED 기반 LCoS / DLP 가 더 저렴 + 밝기 충분
        └─ Microvision 적자 누적
```

## 5.3 AR 응용 본격화

```
2018.10 North Focals 1.0 출시 (Thalmic Labs → North)
        └─ 단색 적색 laser + HOE 결합기
        └─ 안경 형태로 노티 알림 표시
        └─ KGOnTech 분석: "LBS + holographic combiner"

2019.02.24  HoloLens 2 발표 (MWC)
        └─ Microsoft + MicroVision 협업
        └─ MEMS mirror 54,000 cycles/sec resonant
        └─ FOV 52°, 47 ppd, 2K 3:2 (1440x936)
        └─ KGOnTech, MicroVision 블로그가 teardown 으로 확인

2019.11  HoloLens 2 출시 — 첫 본격 LBS AR 헤드셋

2020.06.30  Google이 North 인수 ($180M)
            └─ Focals 2.0 취소
            └─ 기존 1.0 사용자 7월 31일 서비스 종료
            └─ AR 기술팀은 Google AR 부문에 흡수

2021    MicroVision, AR/Display 사업 축소 →
        자동차 long-range LiDAR (200 m+) 로 pivot
        └─ AR LBS 회사 → 자동차 LiDAR 회사로 변신
```

## 5.4 microLED / micro-OLED 가 LBS 를 추월하기 시작

```
2022.03   Plessey microLED → ams OSRAM 인수 통합
2024.02   Apple Vision Pro 출시 — micro-OLED + pancake
2024.09   Snap Spectacles 5 — LCoS + WaveOptics diffractive
2024.09.25 Meta Orion 공개 (Connect 2024)
          └─ silicon carbide diffractive waveguide (refractive index 2.7)
          └─ JBD 3-panel LEDoS (micro-LED on Si) 프로젝터
          └─ FOV 70° (역대 AR glasses 최대)
          └─ ★ NOT LBS ★

2025.08.20  Meta Reality Labs *Nature* 발표 ("ultrathin laser display")
            └─ 2 mm 두께 photonic IC + 5×5 mm LCoS
            └─ 211% color gamut, AR see-through prototype
            └─ MEMS mirror 가 아닌 photonic IC 기반 → "post-LBS" laser display

2025.09   Meta Hypernova = Ray-Ban Display 출시 ($799)
          └─ 0.36MP LCoS + Lumus reflective waveguide, FOV ~20°
          └─ ★ LBS 아님, microLED 도 아님 ★
```

---

# 6. 광학 동작 — RGB 점이 어떻게 frame 이 되는가

## 6.1 전체 광로

```
┌─────────────────────────────────────────────────────────────────┐
│         LBS 디스플레이의 광학 path (HoloLens 2 형식)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────┐  ┌─────┐  ┌─────┐                                     │
│   │ R   │  │ G   │  │ B   │   ← 가시광 RGB laser diode          │
│   │ 638 │  │ 520 │  │ 450 │     (각각 ns 단위 전류 변조)          │
│   │ nm  │  │ nm  │  │ nm  │                                     │
│   └──┬──┘  └──┬──┘  └──┬──┘                                     │
│      │        │        │                                         │
│      └────────┼────────┘                                         │
│               ▼                                                  │
│        ┌─────────────┐                                           │
│        │  Combiner   │   ← Dichroic mirrors 또는 X-cube         │
│        │  (dichroic) │     3 빔을 단일 광축으로 합침              │
│        └──────┬──────┘                                           │
│               ▼                                                  │
│        ┌─────────────┐                                           │
│        │ Collimator  │   ← 빔을 평행화                          │
│        └──────┬──────┘                                           │
│               ▼                                                  │
│       ╔═══════════════╗                                          │
│       ║  MEMS Mirror  ║   ← X 고속 resonant + Y 저속             │
│       ║  (1~2 mm Si)  ║     (또는 dual-axis gimbal)              │
│       ╚═══════╤═══════╝                                          │
│               │                                                  │
│               │  편향각 ±15° 정도                                  │
│               ▼                                                  │
│        ┌─────────────┐                                           │
│        │ In-coupler  │   ← waveguide 진입 (HoloLens 2)          │
│        │  (grating)  │     또는 직접 동공으로 (Bosch)            │
│        └──────┬──────┘                                           │
│               ▼                                                  │
│       ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                            │
│       ▒  Waveguide  ▒  ← 전반사로 빔 전송, exit pupil 확장        │
│       ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                            │
│               │                                                  │
│               ▼                                                  │
│        ┌─────────────┐                                           │
│        │ Out-coupler │                                           │
│        └──────┬──────┘                                           │
│               ▼                                                  │
│            👁 Eye                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 MEMS mirror 두 축 — Raster vs Lissajous

```
┌─────────────────────────────────────────────────────────────────┐
│                  Raster scan (TV 형식)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  X: 빠른 resonant ~20-30 kHz   →→→→→→→→→→→→                     │
│  Y: 느린 sawtooth ~60 Hz       ↓                                 │
│                                                                  │
│        ┌──────────────────────────────┐                          │
│        │  →→→→→→→→→→→→→→→→→→→→→→→→→→→ │  line 1                  │
│        │  →→→→→→→→→→→→→→→→→→→→→→→→→→→ │  line 2                  │
│        │  →→→→→→→→→→→→→→→→→→→→→→→→→→→ │  ...                     │
│        │  →→→→→→→→→→→→→→→→→→→→→→→→→→→ │  line 1080               │
│        └──────────────────────────────┘                          │
│                                                                  │
│  장점: 픽셀 격자가 일정, frame buffer ↔ 빔 동기화 직관적             │
│  단점: 양 축 모두 high-Q resonant 가 어려움 (Y 가 quasi-static)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                Lissajous scan (양 축 resonant)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  X: 5450 Hz (예시)    Y: 6700 Hz                                 │
│  공통 약수가 작도록 두 주파수 비를 조정 → 트레이스가 frame 동안 화면을 채움 │
│                                                                  │
│       ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲                                          │
│      ╱  X  X  X  X  ╲                                            │
│      ╲  X  X  X  X  ╱   ← Lissajous figure                      │
│       ╲╱╲╱╲╱╲╱╲╱╲╱╲╱                                            │
│                                                                  │
│  장점: 양 축 모두 mechanically robust, 단순 구조                    │
│  단점: 픽셀 격자가 시간에 따라 채워짐 (fill factor 점진 ↑)            │
│        → 동영상 motion artifact 가 raster 와 다름                  │
│                                                                  │
│  사례: OQmented, 일부 medical endoscope                          │
└─────────────────────────────────────────────────────────────────┘
```

> 학술 보고 (Lissajous HDHF, *Micromachines* 2019): 5402 Hz × 6702 Hz 두 resonant 축, 50 fps, fill factor 94% 달성. inner mirror 의 Q-factor 를 의도적으로 낮춰 주파수 선택 폭 확보.

## 6.3 픽셀당 nanosecond budget

```python
# 1080p × 60 Hz raster scan 에서 한 픽셀에 주어지는 시간
H, V = 1920, 1080
fps  = 60

# 단순 계산 (blanking 무시)
pixels_per_sec   = H * V * fps          # 124,416,000
seconds_per_pix  = 1 / pixels_per_sec   # 8.04 ns
print(f"per pixel: {seconds_per_pix*1e9:.2f} ns")
# → 약 8 ns / 픽셀

# raster 의 horizontal blanking + vertical retrace 고려 시
useful_ratio = 0.80  # 실제 빛을 쏘는 시간 비율
on_time = seconds_per_pix * useful_ratio
print(f"effective on-time: {on_time*1e9:.2f} ns")
# → 약 6.4 ns / 픽셀

# H 축 resonant freq f_x 가 정해지면 한 라인 시간 = 0.5 / f_x
# (sin 진동의 반주기)
# f_x = 30 kHz 라면 한 line = 16.67 µs / 1920 pix = 8.7 ns / pix
f_x_kHz = 30
line_time_us = 1e6 / (2 * f_x_kHz * 1000)
per_pix_ns   = line_time_us * 1000 / H
print(f"resonant 30 kHz: line {line_time_us:.2f} µs, per pix {per_pix_ns:.2f} ns")
```

이 ns 단위는 **GaN 레이저 다이오드의 직접 변조 한계 (~1 ns)** 안쪽이므로 가능한 영역. 그러나 **resonant 미러는 sin 곡선** 으로 움직이므로 화면 가장자리에서는 빔이 느려져 픽셀 밀도가 자연 ↑, 중앙은 빠르게 지나가 ↓ — frame buffer → 빔 timing 매핑은 단순 균등 샘플링이 아니라 **sin⁻¹ 보정** 이 필요.

```
                 빔 위치 = A · sin(2π f_x t)
                 빔 속도 = A · 2π f_x · cos(2π f_x t)
                                          ↑
                                   가운데 (cos = 1) → 빠름
                                   가장자리 (cos = 0) → 느림

    pixel sample 간격을 시간 등간격이 아니라 sin⁻¹(x/A) 등간격으로 해야
    화면상 픽셀 균일도 확보.
```

## 6.4 Frame buffer → laser modulation pseudocode

```c
// 단순화된 pseudocode (실제는 FPGA + lookup table 사용)
//
// inputs:
//   framebuf[H][V]   : RGB10 per pixel
//   x_phase, y_phase : 현재 미러 진동 위상 (PLL 으로 sync)
// outputs:
//   r_drive, g_drive, b_drive : 각 laser diode 전류

void on_pixel_clock(uint32_t t_ns) {
    // 미러 위치 추정 (resonant sin 기반)
    float x = A_x * sinf(2 * PI * f_x * t_ns * 1e-9);
    float y = A_y * sawtooth(f_y, t_ns);

    // 화면 좌표로 매핑 (sin 비선형성 보정 + 키스톤 보정)
    int px = correct_sin_to_linear(x);  // [0, H)
    int py = (int)((y / A_y) * V);      // [0, V)

    if (px < 0 || px >= H || py < 0 || py >= V) {
        r_drive = g_drive = b_drive = 0;  // blanking
        return;
    }

    pixel_t p = framebuf[px][py];
    // gamma 보정 + class-1 power budget 클램프
    r_drive = clamp(gamma(p.r), 0, MAX_CLASS1_R);
    g_drive = clamp(gamma(p.g), 0, MAX_CLASS1_G);
    b_drive = clamp(gamma(p.b), 0, MAX_CLASS1_B);
}
```

핵심 포인트:
- **`MAX_CLASS1_*`** 가 항상 곱해지는 cap. 어떤 단일 픽셀도 IEC 60825-1 Class 1 MPE 를 넘지 못함.
- **`correct_sin_to_linear`** 가 LUT 으로 미리 계산돼 nanosecond timing 안에 끝나야 함.
- **PLL** 이 미러의 capacitive feedback 신호로 위상 추정 — open-loop 는 온도/노화로 어긋남.

---

# 7. Maxwellian View 와 Vergence-Accommodation Conflict

## 7.1 평범한 광학 디스플레이의 VAC 문제

```
┌─────────────────────────────────────────────────────────────────┐
│    Vergence-Accommodation Conflict (VAC) — VR/AR 의 만성 통증     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  실세계: 가까운 물체 → 양 눈이 안쪽으로 vergence + 수정체 두꺼워짐 │
│         └─ 두 신호가 일치 (eye-brain 이 학습된 상태)              │
│                                                                  │
│  HMD:   디스플레이는 보통 2~5 m 가상 거리에 결상                  │
│         └─ vergence 는 콘텐츠 거리 (예: 30 cm) 따라감               │
│         └─ accommodation 은 디스플레이 거리 (2 m) 따라감             │
│         └─ 충돌 → 어지러움, 눈 피로, 두통, 30분 이내 한계         │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Maxwellian view — LBS 가 줄 수 있는 부분 해결

```
┌─────────────────────────────────────────────────────────────────┐
│            Maxwellian view (= retinal projection)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  일반 디스플레이:                                                 │
│  ┌─────────┐                                                     │
│  │ Display │ ──── 발산 광선 ───→ Lens ──→  Retina               │
│  └─────────┘                       (수정체)                       │
│                                                                  │
│   → 수정체가 디스플레이 거리에 맞춰 accommodate 해야 in-focus      │
│                                                                  │
│  Maxwellian view:                                                │
│                                                                  │
│  Point source ─────→ 수렴 광선 ─────→ Pupil ─→  Retina           │
│  (LBS 의 빔)                          (한 점 통과)                │
│                                                                  │
│   → 모든 광선이 동공의 한 점을 통과 → pinhole 효과                  │
│   → 수정체가 어떻게 굽혀도 망막에 결상 (depth of field 무한대)      │
│   → "always in-focus"                                            │
│                                                                  │
│   ⇒ accommodation 단서 제거 → VAC 의 절반(accommodation 측) 해결 │
│   ⇒ vergence 측은 여전히 콘텐츠 거리 따라가야 (양안 disparity)    │
└─────────────────────────────────────────────────────────────────┘
```

## 7.3 Maxwellian 의 trade-off

```
장점:                              단점:
━━━━━                             ━━━━━
✓ 모든 거리 in-focus                ✗ Eyebox 가 매우 작음 (수 mm)
✓ 처방 안경 무관                   ✗ 동공 한 점 빗나가면 영상 사라짐
✓ accommodation 스트레스 ↓          ✗ 사용자가 머리 움직이면 영상 vanish
✓ light field 보다 단순             ✗ pupil tracking + dynamic redirect 필요
✓ LBS 광원이 자연스럽게 제공          ✗ vergence 측 VAC 는 미해결
```

## 7.4 eyebox 확장 연구

- **HOE 기반 grating 이중 사용** — 가상 grating 으로 동공 위치마다 가상 점광원 위치 이동 (Optics Letters 2022)
- **Holographic Maxwellian + waveguide** — LBS + waveguide 결합 (Lin et al. 2018, Optics Express)
- **Double Maxwellian foveated** — 중심부/주변부 별도 점광원 (J. Inf. Disp. 2025)
- **Pupil tracking + active steering** — 눈동자 위치 추적해 Maxwellian 점을 동적 이동. Meta Reality Labs 가 패턴 출원 다수.

> Meta 의 2025.08 *Nature* photonic-IC 디스플레이도 LCoS 기반이지만, **레이저 광원 + 직접 동공 결합** 이라는 점에서 Maxwellian-style retinal projection 의 다음 세대 후보로 평가됨.

---

# 8. AR Display Tech Matrix — LBS vs 4 라이벌

## 8.1 종합 비교표

| 기술 | 광원 | 변조 | 광 효율 | FOV | 폼팩터 | 색역 | 야외 밝기 | 핵심 단점 | 채택 사례 |
|------|------|-----|---------|-----|--------|------|----------|---------|---------|
| **LBS** (laser scan) | RGB EEL/VCSEL | MEMS mirror 가 점→이미지 | **매우 높음** (켜진 픽셀만) | 30~52° | **<0.5 cc** | 100%+ Rec.2020 | 우수 | speckle, 색 부드러움, 안전 | HoloLens 2, North Focals, Bosch Light Drive |
| **DLP** (DMD) | LED/laser | 마이크로미러 어레이 | 중간 (~30%) | 40~80° | medium | 광원 따라감 | 양호 | 모듈 부피 | TI eval kit, 일부 HUD |
| **LCoS** | LED/laser | 반사형 LC 패널 (편광) | 낮음 (~5%) | 40~80° | medium-small | 광원 따라감 | 중하 | 편광 손실, contrast | **Meta Hypernova/Ray-Ban Display, Snap Spectacles 5, Magic Leap 2** |
| **micro-OLED** | self-emissive | 픽셀 OLED | 중간 | **80~110°** | small (microdisplay) | 우수 | 부족 (실내 위주) | outdoor 밝기 | **Apple Vision Pro**, Sony XR-1 panels |
| **micro-LED** (LEDoS) | self-emissive | 픽셀 micro-LED | **매우 높음** | 30~70° | **<0.4 cc** | 우수 | **최고** | 양산 yield (특히 R) | **Meta Orion**, JBD 평가 키트, Google Raxium |

## 8.2 한 그림으로 정리

```
                  ┌────────────────────────────────────────┐
                  │            AR Glasses 적합도            │
                  └────────────────────────────────────────┘

폼팩터 ←──────────────────────────────────────────────────→ 큼
        LBS ─┬─ microLED          LCoS ─┬─ DLP        micro-OLED
              │                          │
              │                          │
야외밝기      ↑                         ↓                    ↓
              │                          │
              │                          │
                                                          (VR 영역)

중량(g)       <50    50-80    80-100    100-150   200+

전력(mW)      <20    20-100   100-500   500-1000  1000+

VAC 완화      ✓Maxwell 가능    ✗        ✗         ✗ (pancake 일부)
```

## 8.3 LBS 와 microLED 가 둘 다 살아남는 이유

```
microLED:                          LBS:
━━━━━━━━━                          ━━━━
✓ self-emissive 픽셀 그리드          ✓ 픽셀 그리드 없음 → sparse 콘텐츠 효율
✓ uniform brightness                ✓ foveated 렌더링 자연 친화
✓ 신뢰성, 수명 ↑                    ✓ 광학 부피 더 작음 (mm 단위)
✗ 풀 컬러 yield (특히 적색)            ✗ speckle 노이즈
✗ 픽셀 미세화 한계 (현 2.5 µm)        ✗ 색 부드러움 (skin tone)
✗ 모듈 0.4 cc                        ✗ 안전 인증 (per-pixel power 제어)

응용 분기:
  - 풀 컬러 universal AR (web, video) → microLED 우세
  - 단순 HUD (notification, navigation) → LBS 매력적
  - 항상 in-focus 필요 (산업 작업, AR contact lens) → LBS Maxwellian
```

## 8.4 LCoS vs micro-OLED vs LBS — 지금 시점 (2026.05) 의 채택 분포

```
출시된 / 출시 임박 AR/MR 제품 디스플레이 매핑:

┌────────────────────────┬──────────────────┬────────────┐
│ 제품                    │ 디스플레이         │ Combiner   │
├────────────────────────┼──────────────────┼────────────┤
│ HoloLens 2 (2019)      │ LBS              │ Diffractive│
│ Magic Leap 2 (2022)    │ LCoS             │ Diffractive│
│ Apple Vision Pro (2024)│ micro-OLED       │ Pancake    │
│ Snap Spectacles 5      │ LCoS (WaveOptics)│ Diffractive│
│ Meta Orion (2024 proto)│ microLED (LEDoS) │ SiC SRG    │
│ Meta Ray-Ban Display   │ LCoS             │ Lumus 반사   │
│ Samsung Galaxy XR      │ micro-OLED       │ Pancake    │
│ Bosch Light Drive      │ LBS              │ HOE (lens) │
│ North Focals (2018)    │ LBS (단색)         │ HOE        │
│ Google AR (취소)        │ Raxium microLED  │ -          │
└────────────────────────┴──────────────────┴────────────┘

→ 양산/시판 제품: LCoS / micro-OLED 가 다수
→ 차세대 prototype: micro-LED 가 다수
→ LBS: 2010s 후반 고점 후 신제품 채택 ↓ (단, 연구/특허는 ↑)
```

---

# 9. ★ 사용자 가설 검증 ★ — Meta 가 정말 LBS 를 채택했는가?

> **사용자 메모**: "LBS는 Laser Beam Steering, **Meta glass에서 채택하는 방식으로 보여진다.**"

이 인상이 어디서 왔는지 추측하고, 실제 현황을 정리한다.

## 9.1 사실 정리 — Meta 의 실제 디스플레이 채택

| 제품 / 연구 | 발표/출시 | 디스플레이 | LBS 여부 |
|-------------|----------|-----------|---------|
| Meta Quest 시리즈 (1/2/Pro/3/3S) | 2019~2024 | LCD + Fresnel/pancake | ✗ |
| **Meta Aria** (research glasses) | 2020 | **디스플레이 없음** (sensor-only) | ✗ |
| **Meta Orion** (prototype 공개) | **2024.09.25** | **JBD micro-LED (LEDoS) + SiC waveguide** | **✗** |
| **Meta Ray-Ban Display** (= Hypernova) | **2025.09 출시 ($799)** | **LCoS + Lumus reflective waveguide** | **✗** |
| Meta Reality Labs *Nature* paper | **2025.08.20** | photonic IC + LCoS, **laser 광원** | △ (laser-illuminated, MEMS scan 아님) |
| 차세대 microLED AR glasses (rumored) | 2027 목표 | microLED 양산 | ✗ |

→ **Meta 의 출시 제품은 LBS 를 채택한 적이 없다.** Quest 시리즈는 VR LCD, Orion 은 microLED, Ray-Ban Display 는 LCoS.

## 9.2 그러나 — Meta 와 laser display 의 연결은 진짜다

다음 사실들이 "Meta = LBS" 인상을 형성한 것으로 추정.

### (A) Reality Labs 의 holographic / laser display 연구
- **2020 SIGGRAPH "Holographic Optics for Thin and Lightweight Virtual Reality"** — 레이저 광원 + 폴디드 광학으로 두께 8.9 mm VR 시연.
- **2023 SIGGRAPH** "Butterscotch Varifocal", "Flamera" — laser-illuminated varifocal 연구.
- **2024 SIGGRAPH Asia** "Large Étendue 3D Holographic Display with Content-adaptive Dynamic Fourier Modulation" — laser 광원 풀 hologram.
- **2025.08.20 *Nature*** "ultrathin laser display" — 2 mm 두께 photonic IC + 5×5 mm LCoS, 211% color gamut. 레이저 사용. **단, MEMS 스캐닝이 아니라 photonic IC 어레이 + LCoS panel** 의 하이브리드. 엄밀히 "LBS" 는 아니지만 **laser display 계열의 다음 세대** 후보.

### (B) Microsoft × MicroVision 의 LBS 가 HoloLens 2 로 출시됐다
사용자가 "AR glasses + 레이저" 를 들은 시점이 HoloLens 2 발표(2019.02) 부근이라면 Microsoft 와 Meta 를 혼동했을 가능성. HoloLens 2 가 본격 시판된 첫 LBS AR 헤드셋이므로 업계 인용에서 "AR + 레이저 = HoloLens 2" 가 자주 등장.

### (C) North Focals → Google 인수의 미디어 효과
2020 Google 의 North 인수($180M) 가 "큰 빅테크가 LBS 안경 회사를 사들임" 으로 보도되어 "빅테크가 LBS 에 베팅" 이라는 인상을 만들었다. 그러나 Google 도 Focals 2.0 을 취소했고, 차세대 Google AR glasses 는 Raxium micro-LED 로 방향 전환했다 (2025.07 KGOnTech).

### (D) 패턴 문헌
Meta 의 USPTO/WIPO 출원 중 "MEMS-based scanning display", "laser-based retinal projection", "foveated laser display" 키워드 출원이 다수 존재. Reality Labs 의 미래 디스플레이 옵션 카탈로그에 LBS 가 들어 있는 것은 사실.

## 9.3 결론

```
┌─────────────────────────────────────────────────────────────────┐
│       "Meta glass 가 LBS 를 채택한다" 명제의 정확한 답              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [출시 제품]                                                      │
│    ✗ 거짓. Meta 출시 제품 중 LBS 채택 사례 없음.                    │
│       Orion = microLED, Ray-Ban Display = LCoS                  │
│                                                                  │
│  [Reality Labs 연구]                                             │
│    △ 부분적 진실. 레이저 광원 디스플레이 연구는 활발.                │
│       단, 2025.08 *Nature* 발표는 LCoS 기반 photonic IC 로,       │
│       엄밀한 의미의 MEMS 기반 LBS 는 아님.                          │
│                                                                  │
│  [업계 일반 LBS]                                                 │
│    ✓ HoloLens 2 (Microsoft+MicroVision), North Focals (Google   │
│       인수 후 단종), Bosch Light Drive 가 시판된 LBS 사례.          │
│                                                                  │
│  [근원]                                                          │
│    "Meta + 레이저 디스플레이" 의 사실 일부 + HoloLens 2 의 LBS 명성 │
│    + North/Google 인수 보도 + Meta 의 AR 분야 주도성 → 인상 형성    │
└─────────────────────────────────────────────────────────────────┘
```

> 한 줄 요약: **"Meta 는 LBS 를 출시한 적 없다. 다만 laser-illuminated display 연구는 활발하며, 그 결과가 차세대(2027 이후) 제품에 반영될 가능성은 열려 있다."**

---

# 10. 베스트 프랙티스 / 안티패턴

## 10.1 Speckle 노이즈 — coherent 광원의 숙명

```
원인: 레이저 = high coherence → 동공 / 망막 / 광학면 거칠기에서
      랜덤 위상 간섭 → granular "salt-and-pepper" 노이즈

대응:
  ① Rotating ground glass diffuser (전통, 부피 ↑)
  ② Electroactive scattering (Nature Sci. Reports 2017)
  ③ Chiral nematic LC diffuser (Nature Sci. Reports 2021)
  ④ Multiple longitudinal mode laser
  ⑤ SLED (semi-coherent) 사용 — coherence ↓, speckle ↓
  ⑥ Dynamic phase modulation (camera-in-the-loop holography)

trade-off: speckle ↓ ↔ resolution ↓ (coherence 가 sharpness 도 줌)
```

## 10.2 색역 — RGB pure laser 의 예상 못한 약점

```
장점: pure RGB (450/520/638 nm) → CIE 1931 색역 외곽 꼭짓점 → 100%+ Rec.2020

단점: skin tone, pastel, 자연 풍경의 mid-saturation 색이 "지나치게 saturated"
      평범한 sRGB 콘텐츠가 plastic 처럼 보이는 경향

해결:
  - 4번째 wavelength 추가 (cyan 490 nm, 또는 yellow 580 nm)
  - 보조 LED 하이브리드 (laser + LED 채널 혼합)
  - tone mapping 변환 (gamut compression)
```

## 10.3 안전 — Class 1 인증의 power budget

```
규칙: 어떤 0.25 s 시간 윈도 내에도 동공으로 들어오는 평균 power 가
      MPE 를 넘으면 안 됨. 가시광 400~700 nm 의 MPE 는 약 1 mW (세부는 파장)

LBS 에서 까다로운 점:
  - 모든 광이 한 점(미러)에서 출발해 동공 한 곳에 수렴
  - 미러가 멈추면 (전원 차단/고장) 모든 광이 한 픽셀에 집중 → 즉시 화상 위험
  - 따라서 mirror motion 감지 회로가 끊기면 즉시 laser shutoff (kill switch)

설계 대응:
  ✓ MEMS capacitive feedback 로 mirror motion 항상 감시
  ✓ open-loop drive 금지
  ✓ per-pixel power cap LUT 로 어떤 픽셀도 MPE 초과 불가
  ✓ optical fuse / passive shutter 추가
```

## 10.4 안티패턴

```
✗ Foveated rendering 없이 LBS full-FOV
   → 미러 resonant freq 한계로 fps 가 깎임
   → LBS 의 "sparse 효율" 강점도 사라짐

✗ Open-loop MEMS drive
   → 온도/노화로 위상 어긋남 → 색 misalignment, 안전 risk

✗ Diffractive waveguide 와 LBS 단순 결합
   → in-coupler 의 angular acceptance 와 빔 확산각 매칭 어려움
   → 색별 각도 분산으로 RGB 분리 (rainbow)

✗ pupil tracking 없이 Maxwellian view 적용
   → 사용자 머리 살짝 움직이면 영상 vanish → 사용성 ↓

✗ 단일 미러로 full RGB
   → 정렬 오차로 색 sub-pixel 분리. dual-mirror + 정밀 sync 필요
```

---

# 11. 빅테크 / 벤더 사례 (현 시점)

## 11.1 Microsoft + MicroVision — 첫 본격 LBS AR

```
HoloLens 2 (2019.02 발표 / 2019.11 출시)
  ┌────────────────────────────────────────────────┐
  │ 디스플레이: MicroVision PicoP 계열 LBS 엔진     │
  │ MEMS mirror: 54,000 cycles/sec resonant         │
  │ 광원: RGB laser diode + IR (트래킹용)           │
  │ FOV: 52° 대각 (원조 HoloLens 34° 대비 1.5×)     │
  │ Resolution: 2K 3:2 (1440 × 936)                 │
  │ Pixel density: 47 ppd                           │
  │ Combiner: diffractive waveguide                 │
  └────────────────────────────────────────────────┘

후일담:
  - HoloLens 사업부 축소 (2022~)
  - HoloLens 3 취소 루머
  - MS 의 commercial AR 사업 commitment 약화
```

## 11.2 ★ Meta — laser 연구 풍부, 출시 LBS 0 ★

| 트랙 | 상태 |
|------|-----|
| Quest 시리즈 (VR, 양산) | LCD + pancake. LBS 아님 |
| Aria (research) | sensor-only, 디스플레이 없음 |
| Orion (2024 prototype) | JBD microLED + SiC waveguide |
| Ray-Ban Display (2025) | LCoS + Lumus reflective |
| Reality Labs holographic VR | laser-illuminated holographic |
| 2025.08 *Nature* | photonic IC + LCoS, laser 광원, 2 mm |
| 차세대 microLED AR (2027 목표) | microLED 양산 준비 |

## 11.3 Google + North — 인수 후 단종

```
2020.06.30  $180M에 North 인수
            └─ Focals 2.0 출시 직전 단계 → 즉시 취소
            └─ 1.0 사용자 7월 31일 서비스 종료
            └─ 인수 목적: 기술/팀 흡수, 제품 종료

이후:
  Project Iris (rumored AR glasses) 2023 취소
  Project Astra → AI 글라스 방향 전환 (2024 I/O)
  2025.07: Google AR glasses 가 Raxium microLED 사용 확인
            (KGOnTech), 그리고 waveguide lab 을 Vuzix 에 매각
            → Google 도 LBS 가 아닌 microLED 방향
```

## 11.4 Apple Vision Pro — micro-OLED 의 정점

```
2024.02 출시
  - 두 100 Hz micro-OLED 디스플레이 (Sony 추정)
  - 7.5 µm 픽셀 피치, 3660 × 3200 lit area
  - 23M pixel total
  - 3-element pancake 광학
  - LBS 아님. 차세대 AR glasses 에서는 다른 기술 가능성
```

## 11.5 Snap Spectacles 5 (2024)

```
- LCoS micro-projector + WaveOptics (Snap 인수, 2021) diffractive waveguide
- FOV 46° 대각
- 37 ppd
- Snap OS, $99/월 개발자 lease, 2026 소비자 제품 예고
- LBS 아님
```

## 11.6 MicroVision (회사) — AR 에서 LiDAR 로 pivot

```
2021: 자동차 long-range LiDAR (200m+) 로 사업 무게중심 이동
2024~: 자율주행 ADAS 시장 추격
AR/Display: 신규 디자인 win 거의 없음

LBS 가 AR 에서 죽었다는 것은 아니지만, 가장 큰 supplier 가 사업
중심을 옮긴 것은 LBS-AR 생태계 전체에 영향.
```

## 11.7 Bosch Light Drive — 가장 작은 LBS 모듈

```
- < 10 g 모듈 (시장에서 가장 작음)
- RGB laser 3 채널 + MEMS 콜리메이트 스캐너 + HOE in lens
- 빔 power 15 µW (Class 1 의 1/26)
- 세 파장: 450/520/638 nm
- 처방 안경/곡면 렌즈 호환
- 2025 CES 시연, B2B 라이선싱 비즈니스
```

## 11.8 ams OSRAM — Plessey 인수 후 microLED 우선

```
2022: Plessey microLED 인수 통합
이후: AR 디스플레이용 microLED 양산 라인 투자
→ 자사 LBS-only 옵션은 부차적, microLED 가 주력
(과거 Eyeway 시절의 LBS 의존 ↓)
```

## 11.9 JBD — microLED 마이크로디스플레이 leader

```
- 0.13" / 0.39" microdisplay 양산
- 2.5 µm pixel pitch (2025 Roadrunner I 발표) — LCoS 추월
- Meta Orion 의 LEDoS 패널 공급
- "Hummingbird II" CES 2026 Innovation Award
- LBS 의 직접 라이벌
```

## 11.10 Lumus / WaveOptics (Snap) / Dispelix — waveguide 전문

```
- Lumus: reflective geometric waveguide → Meta Ray-Ban Display 채택
- WaveOptics (Snap 인수): diffractive → Snap Spectacles 5
- Dispelix: 핀란드, diffractive, 다양한 OEM
- DigiLens: HOE 기반

이들은 LBS 와 결합 가능 — 단 in-coupler angular acceptance 매칭 까다로움.
```

---

# 12. 시나리오별 디스플레이 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                    "내 AR 응용에 무엇?"                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  단순 HUD (notification, navigation, 시계)                       │
│      → LBS  (Bosch Light Drive, 단색이면 < 10g)                  │
│      → 또는 small-FOV LCoS (Meta Ray-Ban Display 유형)            │
│                                                                  │
│  풀 컬러 AR (web, video, 3D 콘텐츠)                              │
│      → micro-LED (Meta Orion 유형) — 양산 가능 시 우위            │
│      → 또는 LCoS (보편 양산, 색재현 좋음)                         │
│                                                                  │
│  몰입형 VR (광 FOV, 고 해상도)                                    │
│      → micro-OLED + pancake (Vision Pro)                        │
│      → LCD + pancake (Quest 3)                                   │
│                                                                  │
│  눈 피로 최소화 (long-session, 산업 작업)                         │
│      → LBS Maxwellian view (accommodation 자유)                  │
│      → 또는 varifocal display 연구 중                             │
│                                                                  │
│  안경 폼팩터 + 야외 밝기 (5,000+ nit)                              │
│      → micro-LED (efficacy ↑)                                   │
│      → LBS (per-pixel control ↑)                                │
│                                                                  │
│  학습용 / eval kit / prototype                                   │
│      → DLP (TI 평가 키트, SDK 풍부)                              │
│      → LCoS (양산 모듈 다수)                                      │
│                                                                  │
│  콘택트렌즈 / 망막 직접 결상 / AR contact                          │
│      → LBS Maxwellian (광원이 점이라 자연 친화)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 13. 3DGS / NeRF / VGGT 클러스터와의 관계

```
┌─────────────────────────────────────────────────────────────────┐
│           "Scene 표현/획득 → 렌더링 → 디스플레이"                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [입력 — 콘텐츠 캡처/표현]                                        │
│  ┌───────────────────┐  ┌───────────────────┐                   │
│  │ NeRF              │  │ 3D Gaussian       │                   │
│  │ — neural implicit │  │  Splatting        │                   │
│  │   radiance field  │  │ — explicit splats │                   │
│  └─────────┬─────────┘  └─────────┬─────────┘                   │
│            │                       │                              │
│            └───────────┬───────────┘                              │
│                        ▼                                          │
│  ┌────────────────────────────────────────┐                       │
│  │ VGGT (Visual Geometry Grounded         │                       │
│  │  Transformer) — feed-forward, 단일     │                       │
│  │  네트워크로 카메라 → 깊이 → 포인트 동시 추정 │                       │
│  └────────────────────┬───────────────────┘                       │
│                        │                                          │
│                        ▼                                          │
│  [중간 — 렌더링 파이프라인]                                        │
│         OpenXR / Unity / Unreal                                  │
│         (위 시리즈의 unity, openxr 문서 참고)                      │
│                        │                                          │
│                        ▼                                          │
│  [출력 — 디스플레이 광학]                                         │
│  ┌────────────────────────────────────────┐                       │
│  │ ★ LBS (이 문서) ★                       │                       │
│  │ micro-LED, micro-OLED, LCoS, DLP       │                       │
│  │ — 망막에 어떻게 광자를 도달시키는가         │                       │
│  └────────────────────────────────────────┘                       │
│                                                                  │
│  scene representation → render → photons → eye 의 양 끝.          │
│  이 클러스터의 4 문서는 그 풀-스택 사슬을 다룬다.                    │
└─────────────────────────────────────────────────────────────────┘
```

**관련 문서**:
- [nerf-neural-radiance-fields.md](nerf-neural-radiance-fields.md) — implicit volumetric scene representation
- [3d-gaussian-splatting-3DGS.md](3d-gaussian-splatting-3DGS.md) — explicit splat-based real-time rendering
- [vggt-visual-geometry-grounded-transformer.md](vggt-visual-geometry-grounded-transformer.md) — feed-forward geometry estimation
- [openxr-크로스플랫폼XR표준.md](openxr-크로스플랫폼XR표준.md) — XR 런타임 표준 (디스플레이 위 한 단계)
- [unity-게임엔진-완전가이드.md](unity-게임엔진-완전가이드.md) — XR 콘텐츠 엔진

---

# 14. 한 줄 요약

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  LBS = Laser Beam Scanning                                      │
│      = RGB laser diode + MEMS mirror 가 픽셀을 한 번에 한 개씩       │
│        그리는 디스플레이                                            │
│                                                                  │
│  강점: 광 효율 (켜진 픽셀만), 폼팩터 (<0.5cc), 색역 (Rec.2020      │
│         100%+), Maxwellian view (accommodation 자유)             │
│                                                                  │
│  약점: speckle, 색 부드러움, 안전 인증, eyebox (Maxwellian 시),    │
│         양 축 resonant 의 frame rate 한계                          │
│                                                                  │
│  현황: HoloLens 2 / North Focals / Bosch Light Drive 가 시판       │
│         사례. Meta 는 LBS 출시 제품 없음. 차세대 AR 의 주력은        │
│         micro-LED + waveguide 로 이동 중. LBS 는 simple HUD 와      │
│         retinal projection 응용에 살아남을 것.                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 참고 자료

## Meta Orion (silicon carbide + microLED — LBS 아님)
- [Meta Quest Blog — Crystal Clear: Our Silicon Carbide Waveguides & the Path to Orion's Large FoV](https://www.meta.com/blog/orion-silicon-carbide-waveguides-ar-glasses-large-field-of-view/)
- [KGOnTech — Meta Orion AR Glasses (Pt. 1 Waveguides)](https://kguttag.com/2024/10/06/meta-orion-ar-glasses-pt-1-waveguides/)
- [TrendForce — Meta Unveils First AR Glasses Prototype "Orion" that Employs LEDos Technology](https://www.trendforce.com/presscenter/news/20240926-12313.html)
- [Compound Semiconductor — Meta reveals LEDos-based AR glasses prototype](https://compoundsemiconductor.net/article/120193/Meta_reveals_LEDos-based_AR_glasses_prototype)
- [UploadVR — Meta's 'Orion' Prototype AR Glasses Have 70 Degree FOV](https://www.uploadvr.com/meta-connect-2024-orion-prototype-ar-glasses/)

## HoloLens 2 (MicroVision MEMS LBS)
- [KGOnTech — Hololens 2 Display Evaluation (Part 1: LBS Visual Sausage Being Made)](https://kguttag.com/2020/07/04/hololens-2-display-evaluation-part-1-lbs-visual-sausage-being-made/)
- [HoloLens Reality — All the Specs](https://hololens.reality.news/news/hololens-2-all-specs-these-are-technical-details-driving-microsofts-next-foray-into-augmented-reality-0194141/)
- [MicroVision Blog — HoloLens 2 Teardown Reveals MicroVision MEMS Laser Scanning Display](http://microvision.blogspot.com/2020/05/hololens-2-teardown-reveals-microvision.html)
- [Wikipedia — HoloLens 2](https://en.wikipedia.org/wiki/HoloLens_2)
- [Microsoft — HoloLens 2 Hardware](https://www.microsoft.com/en-us/hololens/hardware)

## Meta Reality Labs laser display 연구
- [IEEE Spectrum — Meta Develops Ultra-Thin Laser Display System (2025.08.20)](https://spectrum.ieee.org/meta-laser-display-system)
- [Meta Quest Blog — Reality Labs Research at SIGGRAPH 2025 (Tiramisu, Boba 3)](https://www.meta.com/blog/reality-labs-research-tiramisu-boba-3-siggraph-2025-ultrawide-fov-hyperrealistic-vr/)
- [Meta Research — Holographic Optics for Thin and Lightweight Virtual Reality (SIGGRAPH 2020)](https://research.facebook.com/publications/holographic-optics-for-thin-and-lightweight-virtual-reality/)
- [Meta Quest Blog — Display Systems Research at SIGGRAPH 2023](https://www.meta.com/blog/reality-labs-research-display-systems-siggraph-2023-butterscotch-varifocal-flamera/)
- [SIGGRAPH Asia 2024 — Large Étendue 3D Holographic Display](https://dl.acm.org/doi/10.1145/3680528.3687600)
- [Modern Sciences — Meta's 2-mm laser display may transform AR glasses](https://modernsciences.org/meta-laser-display-augmented-reality-september-2025/)

## Meta Ray-Ban Display (Hypernova) — LCoS, LBS 아님
- [KGOnTech — Meta Hypernova and Google AR/AI Glasses – Lumus & Avegant Inside, Both Using LCOS MicroDisplays](https://kguttag.com/2025/05/11/meta-hypernova-and-google-ar-ai-glasses-lumus-avegant-inside-both-using-lcos-microdisplays/)
- [Road to VR — Meta's Reported $800 Smart Glasses with Display](https://www.roadtovr.com/meta-hypernova-smart-glasses-display-sales-expectaion-price/)
- [KGOnTech — Meta Ray-Ban AR Glasses Show Lumus Waveguide Structures](https://kguttag.com/2025/09/16/meta-rayban-ar-glasses-shows-lumus-waveguide-structures-in-leaked-video/)

## North Focals → Google
- [TechCrunch — Google acquires smart glasses company North](https://techcrunch.com/2020/06/30/google-acquires-smart-glasses-company-north-whose-focals-2-0-wont-ship/)
- [Road to VR — Google Acquires North, the Startup Behind 'Focals' Smartglasses](https://www.roadtovr.com/google-acquires-north-startup-behind-focals-smartglasses/)
- [KGOnTech — North's Focals Laser Beam Scanning AR Glasses](https://kguttag.com/2018/10/25/norths-focals-laser-beam-scanning-ar-glasses-color-intel-vaunt/)
- [VentureBeat — Google acquires holographic glasses startup North](https://venturebeat.com/2020/06/30/google-acquires-holographic-glasses-startup-north/)

## MicroVision (PicoP → 자동차 LiDAR)
- [MicroVision Inc.](https://microvision.com/)
- [MicroVision IR — PicoP Scanning Technology at CES 2018](https://ir.microvision.com/news/press-releases/detail/59/microvision-to-showcase-the-capabilities-of-its-picop)
- [DCFmodeling — MicroVision history](https://www.dcfmodeling.com/blogs/history/mvis-history-mission-ownership)

## Bosch Light Drive
- [Bosch Sensortec — Smartglasses Light Drive](https://www.bosch-sensortec.com/products/display-solutions/smartglasses-light-drive/)
- [Bosch Global — Smartglasses with Light Drive Technology](https://www.bosch.com/stories/smartglasses/)
- [IEEE Spectrum — Bosch Gets Smartglasses Right With Tiny Eyeball Lasers](https://spectrum.ieee.org/bosch-ar-smartglasses-tiny-eyeball-lasers)

## Apple Vision Pro (micro-OLED, LBS 아님)
- [Apple — Vision Pro Specs](https://www.apple.com/apple-vision-pro/specs/)
- [iFixit — Vision Pro Teardown Part 2: Display Resolution](https://www.ifixit.com/News/90409/vision-pro-teardown-part-2-whats-the-display-resolution)
- [TechInsights — Apple Vision Pro Teardown](https://www.techinsights.com/blog/apple-vision-pro-teardown)
- [KGOnTech — Hypervision: Micro-OLED vs. LCD](https://kguttag.com/2024/06/14/hypervision-micro-oled-vs-lcd-and-why-the-apple-vision-pro-is-blurry/)

## Snap Spectacles 5 (LCoS + WaveOptics, LBS 아님)
- [Snap Newsroom — Introducing New Spectacles and Snap OS](https://newsroom.snap.com/sps-2024-spectacles-snapos)
- [The Ghost Howls — Snap Spectacles 5 hands-on](https://skarredghost.com/2024/11/04/snap-spectacles-5-hands-on-review/)
- [KGOnTech — Snap Spectacles at CES, AR/VR/MR, & AWE 2025](https://kguttag.com/2025/08/07/snap-spectacles-at-ces-ar-vr-mr-awe-2025-conumer-product-in-2026/)

## JBD microLED (LBS 라이벌)
- [JBD — Roadrunner I Polychrome Projector (2.5 µm pixel pitch)](https://www.jb-display.com/newsdetails/84.html)
- [JBD × Applied Materials × RayNeo announcement](https://www.jb-display.com/newsdetails/81.html)
- [MicroLED-Info — Meta gears up to engage in microLED Microdisplay mass production](https://www.microled-info.com/meta-gears-engage-microled-microdisplay-mass-production-towards-its-2027)
- [Avegant — AR's Display Dilemma: LCOS vs MicroLED (2025.06)](https://avegant.com/wp-content/uploads/2025/06/AR-Display-Dilemma-A-Comparative-Study-of-LCOS-vs-MicroLED_FINAL.pdf)
- [KGOnTech — Google XR Glasses Using Google's Raxium MicroLEDs](https://kguttag.com/2025/07/26/google-xr-glasses-using-googles-raxium-microleds-while-waveguide-lab-sold-to-vuzix/)

## MEMS scanning, Lissajous, raster
- [MDPI Micromachines — Scanning MEMS Mirror for High Definition Lissajous Patterns](https://www.mdpi.com/2072-666X/10/1/67)
- [PMC — Scanning MEMS Mirror HDHF Lissajous (PubMed)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6356757/)
- [OQmented — Technology](https://oqmented.com/technology/)
- [TDK Electronics — 2D piezo MEMS µ-mirror for AR/VR](https://www.tdk-electronics.tdk.com/en/3158878/products/product-catalog/switching-heating-piezo-components-buzzers-microphones/mems-micro-mirror)

## Maxwellian view / VAC
- [Optica Express — Flexible retinal image formation by holographic Maxwellian-view display](https://opg.optica.org/oe/fulltext.cfm?uri=oe-26-18-22985&id=396402)
- [Science Advances — Accommodation-Free Head Mounted Display with Comfortable 3D Perception](https://spj.science.org/doi/10.34133/2019/9273723)
- [J. Inf. Disp. (T&F) — Implementation of optical-see-through Maxwellian near-eye display prototype](https://www.tandfonline.com/doi/full/10.1080/15980316.2019.1674196)
- [J. Inf. Disp. (T&F) — Double Maxwellian foveated display](https://www.tandfonline.com/doi/full/10.1080/15980316.2025.2565193)
- [Optica Letters — Adjustable and continuous eyebox replication for holographic Maxwellian](https://opg.optica.org/ol/abstract.cfm?uri=ol-47-3-445)

## Speckle reduction
- [Nature Sci. Reports — High-brightness laser imaging with tunable speckle reduction (2017)](https://www.nature.com/articles/s41598-017-15553-9)
- [Nature Sci. Reports — Chiral nematic liquid crystal diffuser speckle reduction (2021)](https://www.nature.com/articles/s41598-021-83860-3)
- [Optics & Laser Tech — Light sources for laser speckle reduction (review)](https://www.sciencedirect.com/science/article/pii/S0030399224018656)
- [Science Advances — Speckle-free holography with partially coherent light sources](https://www.science.org/doi/10.1126/sciadv.abg5040)

## Waveguide combiner
- [OptoFidelity — Comparing diffractive, reflective, and holographic waveguides](https://www.optofidelity.com/insights/blogs/comparing-and-contrasting-different-waveguide-technologies-diffractive-reflective-and-holographic-waveguides)
- [Optinvent — Waveguide Combiners Explained (PDF)](https://www.optinvent.com/wp-content/uploads/2023/01/Light-Guide-Combiners-V3-2.pdf)
- [eLight (Springer) — Waveguide-based augmented reality displays: perspectives and challenges](https://link.springer.com/article/10.1186/s43593-023-00057-z)
- [Light: Science & Applications — Waveguide-based AR displays: a highlight](https://www.nature.com/articles/s41377-023-01371-4)

## Laser diode 종류
- [indie.inc — Next Generation RGB Edge-Emitting Lasers for Augmented Reality](https://www.indie.inc/blog/next-generation-rgb-edge-emitting-lasers-for-augmented-reality/)
- [Wikipedia — Vertical-cavity surface-emitting laser](https://en.wikipedia.org/wiki/Vertical-cavity_surface-emitting_laser)
- [Laser Focus World — Advanced lasers for AR smart glasses](https://www.laserfocusworld.com/lasers-sources/article/14284237/advanced-lasers-shed-new-light-on-the-future-of-ar-smart-glasses)

## 안전 (IEC 60825)
- [IEC Webstore — IEC 60825-1:2014](https://webstore.iec.ch/en/publication/3587)
- [Lasermet — LED & Laser Classification Overview](https://www.lasermet.com/laser-safety-services/an-overview-of-the-led-and-laser-classification-system-in-en-60825-1-and-iec-60825-1/)
- [Wikipedia — Laser safety](https://en.wikipedia.org/wiki/Laser_safety)
- [FDA — Laser Products Conformance with IEC 60825-1 Ed. 3 (Laser Notice No. 56)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/laser-products-conformance-iec-60825-1-ed-3-and-iec-60601-2-22-ed-31-laser-notice-no-56)

## 학회 / 컨퍼런스
- [SPIE AR/VR/MR — Photonics West satellite event](https://spie.org/conferences-and-exhibitions/photonics-west)
- [SIGGRAPH — Annual ACM Computer Graphics conference](https://www.siggraph.org/)
