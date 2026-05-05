---
layout: single
title: "VGGT (Visual Geometry Grounded Transformer) — N장 이미지를 한 번에 3D로"
date: 2026-05-05 23:06:00 +09:00
categories: frontend
excerpt: "VGGT는 여러 장의 2D 이미지를 한 번의 transformer forward로 카메라 파라미터와 depth·point map으로 바꿔 전통적인 SfM/MVS 파이프라인을 크게 단순화하는 3D 재구성 모델이다."
toc: true
toc_sticky: true
tags: [vggt, transformer, 3dreconstruction, vision, xr]
source: "/home/dwkim/dwkim/docs/xr/vggt-visual-geometry-grounded-transformer.md"
---

TL;DR
- VGGT는 N장의 이미지를 받아 카메라, depth, point map, track을 한 번에 예측하는 end-to-end 3D geometry 모델이다.
- 이 덕분에 전통적인 SfM, bundle adjustment, dense MVS의 여러 단계를 신경망 내부 계산으로 흡수한다.
- 중요한 점은 VGGT 자체가 mesh를 직접 내놓기보다, mesh 직전의 기하 프리미티브를 빠르게 제공한다는 것이다.

## 1. 개념
VGGT는 다중 이미지를 입력으로 받아 카메라 포즈와 per-pixel geometry를 동시에 복원하는 transformer 기반 3D 재구성 모델이다.

## 2. 배경
기존 구조에서는 feature extraction, matching, incremental SfM, bundle adjustment, dense MVS를 별도 도구로 오래 돌려야 했다. VGGT는 이 파이프라인을 학습된 추론 한 번으로 압축해 속도와 강건성을 동시에 노린다.

## 3. 이유
이 모델을 이해하면 왜 modern 3D capture가 point map·depth·camera를 먼저 예측하고, 이후 mesh나 Gaussian representation으로 분기하는지 자연스럽게 보인다. 또한 전통 geometric solver와 foundation model의 역할 분리도 명확해진다.

## 4. 특징
- 한 번의 forward pass로 카메라 intrinsics·extrinsics와 dense geometry를 함께 예측한다
- 전통 SfM/MVS의 취약한 다단계 파이프라인을 학습된 prior로 대체한다
- 출력은 mesh가 아니라 mesh/3DGS 후처리의 입력이 되는 기하 프리미티브다
- XR spatial capture와 mobile reconstruction 워크플로에 직접 연결되기 쉽다

## 5. 상세 내용

# VGGT (Visual Geometry Grounded Transformer) — N장 이미지를 한 번에 3D로

> **작성일**: 2026-05-05
> **카테고리**: XR / Computer Vision / 3D Reconstruction / Transformer
> **트리거**: 사용자 질문 — "VGGT는 2D image를 3D mesh로 어떻게 깔끔하게 바꾸는가?"
> **포함 내용**: VGGT, Visual Geometry Group (Oxford VGG 연구실 vs VGG-Net), Jianyuan Wang, Andrea Vedaldi, Christian Rupprecht, David Novotny, Meta GenAI, Reality Labs, CVPR 2025 Best Paper Award, SfM (Structure from Motion), MVS (Multi-View Stereo), Bundle Adjustment, COLMAP, OpenMVG, OpenMVS, Camera Intrinsics (focal, principal point, K matrix) vs Extrinsics (R, t, world-to-camera), pinhole vs fisheye, point map (per-pixel 3D point in world frame), depth map, point tracking vs optical flow, camera token, register token, DINOv2, CroCo, MASt3R, DUSt3R, Fast3R, MV-DUSt3R, Spann3R, MoGe, alternating attention, frame-wise attention, global attention, Plücker rays, DPT (Dense Prediction Transformer), VGG-Net (Karen Simonyan, Andrew Zisserman 2014), SuperPoint, SuperGlue, R2D2, MVSNet, Yao Yao, NeRO, PixSfM, Naver Labs Europe, Co3Dv2, BlendMVS, DL3DV, MegaDepth, Kubric, WildRGB, ScanNet, HyperSim, Mapillary, Habitat-Sim, ARKitScenes, ETH3D, Tanks and Temples, RealEstate10K, NRGBD, NeRF, 3D Gaussian Splatting, Poisson surface reconstruction, NeuS SDF, Marching Cubes, Apple RoomPlan, Object Capture, Niantic Lightship, 8th Wall, Polycam, Luma AI, KIRI Engine, Tesla Autopilot scene reconstruction, Wayve, Codec Avatars, Quest mixed reality scene scanning, Vision Pro Persona, Snapdragon XR2, Unity AR Foundation mesh capture

---

# 1. VGGT란 — 그리고 사용자의 질문에 정확히 답하기

## 1.1 한 줄 정의

> "N장의 unposed/unordered RGB 이미지를 입력 받아 한 번의 forward pass로 카메라(intrinsics+extrinsics) + per-pixel depth + world-space point map + 2D point tracks를 동시에 출력하는 단일 1B-파라미터 transformer."

```
[img1, img2, ..., imgN]   (N = 1 ~ 200+)
        │
        ▼
   [VGGT 1B model]   (수 초)
        │
  ┌─────┼──────────┬──────────┬─────────┐
  ▼     ▼          ▼          ▼         ▼
camera depth   point map  2D tracks   ...
pose   map     (per-pixel
K,R,t  (N×H×W)  world XYZ) (N×T×2)
```

## 1.2 사용자의 질문에 정확히 답하기

> **"VGGT는 2D image를 3D mesh로 어떻게 깔끔하게 바꾸는가?"**

**짧은 답: VGGT 자체는 mesh를 출력하지 않는다.** VGGT가 만드는 것은 mesh가 아니라 **mesh의 직전 단계 — 카메라 파라미터, depth map, world-space point map** 같은 *기하 프리미티브(geometric primitives)*다.

```
전통 (COLMAP+OpenMVS, 분~시간):
  사진 N장
    → feature extraction (SIFT/SuperPoint)         단계 1
    → feature matching (FLANN/SuperGlue)           단계 2
    → Incremental SfM (cameras + sparse points)    단계 3
    → Bundle Adjustment (Ceres nonlinear LS)       단계 4
    → Multi-View Stereo (PatchMatch / dense)       단계 5
    → Depth fusion → dense point cloud             단계 6
    → Poisson/Delaunay surface reconstruction      단계 7
    → Mesh refinement, hole filling, texturing     단계 8
    → MESH

VGGT (수 초):
  사진 N장
    → VGGT 한 번 forward — 단계 1~6 모두 amortize
      (feature, matching, SfM, BA, MVS, depth fusion이 한 신경망 안에)
    → depth + camera + point map (≈ 단계 6 직후 상태)
    → Poisson / Marching Cubes / 3DGS / NeuS       단계 7~8 (VGGT 밖)
    → MESH
```

**즉 "깔끔함"의 본질은 두 가지다:**

1. **다단계 → 단일 단계**: 역사적으로 분~시간 걸리던 SfM + dense MVS + BA를 한 번의 신경망 forward (수 초)로 amortize.
2. **취약 → 견고**: 전통 SfM은 textureless surface, repetitive pattern, motion blur, calibration 오차에 매우 fragile. VGGT는 거대 합성+실데이터 학습으로 robust prior를 획득.

**그러나 mesh 자체는 여전히 외부 단계다.** VGGT 출력 → Poisson surface reconstruction (Misha Kazhdan), 또는 → 3DGS (3D Gaussian Splatting), 또는 → NeuS (Neural SDF) → Marching Cubes 가 mesh를 만든다. 이 후처리 흐름은 [`nerf-neural-radiance-fields.md`](nerf-neural-radiance-fields.md)와 [`3d-gaussian-splatting-3DGS.md`](3d-gaussian-splatting-3DGS.md)에서 자세히 다룬다.

이 문서의 §10에서 VGGT → mesh 변환의 표준 후처리 옵션을 구체적으로 설명한다.

## 1.3 왜 이게 큰 사건인가

CVPR 2025 Best Paper Award. Computer Vision의 가장 큰 학회에서 매년 1-2편만 받는 상이다. 직전 수상작들 (Instant-NGP 2022, VisualChatGPT, NeRF 2020 Best Paper Honorable Mention)을 보면 분야의 흐름을 바꾼 작품들이다. VGGT는 "고전 multi-view geometry 파이프라인의 종말"을 알리는 신호로 받아들여지고 있다.

XR 개발자 관점에서 의미는 명확하다 — **사용자가 들고 있는 카메라로 수십 장 찍기만 하면, 1초 안에 그 공간의 3D 표현이 나온다.** Quest scene scan, Vision Pro Persona, Apple RoomPlan, Polycam 같은 워크플로의 다음 세대 엔진이다.

---

# 2. 등장 배경 — 왜 SfM 파이프라인을 신경망이 대체하게 됐나

## 2.1 전통 파이프라인의 8단계 (COLMAP/OpenMVG+OpenMVS 기준)

```
단계 1 Feature Extraction
  각 이미지 keypoint + descriptor (SIFT/SURF/ORB/SuperPoint/R2D2)

단계 2 Feature Matching
  이미지 쌍 descriptor 매칭 + RANSAC outlier 제거
  (FLANN/SuperGlue/LightGlue) — N²/2 쌍, 수백 장이면 폭발

단계 3 Incremental SfM
  seed pair → Essential/Fundamental → triangulation → PnP로
  다음 카메라 등록 → 반복 (COLMAP의 핵심)

단계 4 Bundle Adjustment
  모든 카메라 R,t,K + 모든 3D 점 동시 최적화
  nonlinear LS (Levenberg-Marquardt, Ceres)
  objective: Σ ||π(K_i [R_i|t_i] X_j) - x_ij||²
  수렴 느림, local minima 빠지면 reconstruction 망함

단계 5 Multi-View Stereo
  sparse + 카메라 → per-pixel depth (PatchMatch MVS / MVSNet)

단계 6 Depth Fusion
  각 view depth를 world frame으로 unproject → dense point cloud

단계 7 Surface Reconstruction
  point cloud → mesh
  Poisson (Kazhdan 2006) / Delaunay+graph cut / NeuS+Marching Cubes

단계 8 Texturing
  원본 이미지 → mesh 표면 텍스처 매핑 (MVS-Texturing 등)
```

## 2.2 이 파이프라인의 본질적 약점

| 약점 | 구체 예 |
|-----|--------|
| **취약성** | textureless 벽 (호텔 복도), 반복 패턴 (벽돌, 잎사귀), 거울/유리/specular 표면 → feature matching 실패 |
| **calibration 의존성** | intrinsics 오차 1% → BA 발산 가능 |
| **순차성** | 단계가 순서대로만 가능, 병렬화 어려움 |
| **속도** | 수백 장이면 분~시간 단위. SIGGRAPH 데모에서 Polycam이 30분 돌리는 게 보통 |
| **outlier 민감** | RANSAC 임계값 튜닝, BA 초기값에 따라 결과 다름 |
| **메모리** | dense MVS는 GPU 32GB로도 부족할 때 있음 |
| **모듈 간 정보 손실** | 각 단계가 sparse → dense → mesh로 정보를 압축하면서 다음 단계가 그 손실을 복원 못 함 |

## 2.3 학습 기반의 점진적 침공 (2018~2023)

처음에는 단계마다 한두 모듈씩 신경망으로 대체됐다.

| 단계 | 학습 기반 대체 |
|-----|--------------|
| 1. Feature | SuperPoint, R2D2, DISK |
| 2. Matching | SuperGlue, LightGlue, LoFTR |
| 3-4. SfM/BA | PixSfM, ACNe, BARF, GBA-Net |
| 5. MVS | MVSNet, CasMVSNet, R-MVSNet, Vis-MVSNet |
| 6. Depth | DPT, MiDaS (monocular), DepthAnything |

이 시기의 패턴은 "각 단계만 신경망으로 교체, 파이프라인 골격은 유지"였다. 정확도는 향상됐지만 본질적 fragility는 남았다.

## 2.4 DUSt3R가 깬 패러다임 (2023.12)

Naver Labs Europe의 DUSt3R는 다른 접근을 제시했다.

**"두 장 이미지 → 한 transformer → 두 view 모두에 대한 world-frame point map"**

즉 feature 추출, matching, pose, triangulation을 모두 건너뛰고, 두 RGB 이미지에서 직접 point cloud를 회귀(regress). 더 놀라운 건 카메라 intrinsics/extrinsics가 *주어지지 않아도 동작*한다는 점이다.

DUSt3R는 두 장에 한정됐지만, "transformer가 multi-view geometry를 한 번에 풀 수 있다"는 가능성을 열었다. 그 후 1년 동안 MASt3R (matching head 추가, 2024.06), MV-DUSt3R+ (multi-view 확장, 2024.10), Spann3R (incremental, 2024.11), Fast3R (1000+ views, 2025.01)가 빠르게 등장했고, **2025.03 VGGT가 이 흐름의 완성형으로 자리잡았다.**

---

# 3. 역사적 기원 (Historical Origins)

## 3.1 "VGG"라는 이름의 두 의미 — 매우 중요한 혼동 포인트

```
"VGG"는 두 가지를 동시에 가리킨다:

  ① Visual Geometry Group        ② VGG-Net (네트워크)
     = 옥스포드 컴퓨터 비전          = 2014년 ImageNet 준우승 CNN
       연구실 이름                    (Simonyan-Zisserman)
     (1998~ Andrew Zisserman
      설립, Andrea Vedaldi 등)

  관계: ②는 ①에서 나왔다. Karen Simonyan이 Andrew Zisserman 지도하에
        옥스포드 VGG 연구실에서 만든 모델이 너무 유명해져서,
        연구실 이름이 모델 이름이 됨.

  VGGT = Visual Geometry Grounded Transformer
       → Visual Geometry Group의 작품임을 강조하는 작명
       → 동시에 "visual geometry" 분야의 정통 후계자임을 어필
```

**Visual Geometry Group (옥스포드)의 다른 유명 작품:**
- **VGG-Net** (Simonyan & Zisserman, 2014) — ImageNet 준우승, "16개 layer 3×3 conv 쌓기"의 대명사
- **VGGFace / VGGFace2** (2015, 2017) — face recognition 표준 데이터셋
- **VGGSound** (2020) — audio-visual 데이터셋
- **VGGT** (2025) — 이 문서의 주제

이 모든 작품의 명명 뒤에 Andrew Zisserman이 있다. Zisserman은 Hartley와 함께 *Multiple View Geometry in Computer Vision* (Cambridge, 2000/2003) 교과서를 쓴 multi-view geometry 분야의 살아 있는 정전(canon)이다. **VGGT가 "Visual Geometry"를 자처하는 것은 이 학문 계보의 정통성을 명시적으로 주장하는 것이다.**

## 3.2 VGGT 저자

| 이름 | 소속 | 역할 |
|-----|------|-----|
| **Jianyuan Wang** | Oxford VGG (DPhil 학생) | 1저자. 이전 작품: PoseDiffusion, VGGSfM (CVPR 2024) |
| **Minghao Chen** | Oxford VGG | 공동 1저자 |
| **Nikita Karaev** | Oxford VGG | CoTracker (point tracking) 1저자, VGGT의 tracking head 담당 |
| **Andrea Vedaldi** | Oxford 교수 + Meta 자문 | MatConvNet, VLFeat 저자. multi-view geometry의 산증인 |
| **Christian Rupprecht** | Oxford 교수 | unsupervised 3D 분야 |
| **David Novotny** | Meta GenAI Research Scientist | Co3D dataset 1저자 (2021), 객체 중심 3D 분야 |

**조직 구조**: Oxford VGG ↔ Meta GenAI / Reality Labs 간 공동 DPhil 프로그램의 산물. Vedaldi와 Novotny는 같은 multi-view 3D 분야를 양쪽에서 추진해온 핵심 인물이다.

## 3.3 학습 기반 Multi-view Geometry 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│       Learning-based Multi-view Geometry 진화 (2014~2025)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2014.09  VGG-Net (Simonyan, Zisserman, Oxford VGG)              │
│           └─ ImageNet 준우승. "VGG"라는 이름의 출처               │
│                                                                  │
│  2015     ResNet (He) — VGG-Net의 더 깊은 후계자                  │
│                                                                  │
│  2018.04  SuperPoint (DeTone, MagicLeap)                         │
│           └─ self-supervised keypoint + descriptor               │
│                                                                  │
│  2018.07  MVSNet (Yao Yao, HKUST)                                │
│           └─ 학습 기반 dense MVS의 시초                          │
│                                                                  │
│  2019.06  R2D2 (Revaud, Naver) — repeatable + reliable feature   │
│                                                                  │
│  2020.06  SuperGlue (Sarlin, MagicLeap)                          │
│           └─ GNN 기반 matching, RANSAC 의존도 ↓                  │
│                                                                  │
│  2020.07  NeRF (Mildenhall, Berkeley) — 시점 합성 혁명           │
│                                                                  │
│  2021.03  DPT (Ranftl, Intel)                                    │
│           └─ Dense Prediction Transformer, monocular depth SOTA  │
│                                                                  │
│  2021.10  Co3D dataset (Novotny, Meta)                           │
│           └─ 19,000 객체 중심 video, 미래 VGGT 학습 데이터        │
│                                                                  │
│  2022.03  PixSfM (Lindenberger, ETH) — featuremetric BA          │
│                                                                  │
│  2023.04  CroCo (Naver Labs Europe)                              │
│           └─ Cross-view Completion pretraining                   │
│           └─ DUSt3R의 직접 조상                                  │
│                                                                  │
│  2023.07  3D Gaussian Splatting (Kerbl, INRIA, SIGGRAPH 2023)    │
│           └─ NeRF 대체, 실시간 렌더링                            │
│                                                                  │
│  2023.12  DUSt3R (Wang, Naver Labs Europe)                       │
│           └─ "2 image → pointmap" 패러다임 전환                  │
│                                                                  │
│  2024.04  CoTracker (Karaev, Meta+Oxford)                        │
│           └─ joint 2D point tracking, VGGT track head 조상       │
│                                                                  │
│  2024.06  MASt3R (Leroy, Naver)                                  │
│           └─ DUSt3R + matching head + reciprocal scheme          │
│                                                                  │
│  2024.06  VGGSfM (Wang, Oxford+Meta, CVPR 2024)                  │
│           └─ Jianyuan Wang의 VGGT 직전 작품                      │
│                                                                  │
│  2024.10  MV-DUSt3R+ (Meta) — 단일 stage multi-view              │
│  2024.11  Spann3R (Wang) — incremental DUSt3R                    │
│  2024.11  MoGe (MS) — monocular geometry                         │
│                                                                  │
│  2025.01  Fast3R (Yang, Meta)                                    │
│           └─ 1000+ views one forward pass, 24-layer ViT-L        │
│                                                                  │
│  2025.03  ★ VGGT (Wang, Oxford+Meta) ★                           │
│           └─ 4 outputs in one network                            │
│           └─ 2025.06 CVPR Best Paper                             │
│                                                                  │
│  2025.07  VGGT-1B-Commercial 라이선스 출시                       │
│  2025.09  Faster VGGT (block-sparse global attention)            │
│  2025.12  AVGGT, FlashVGGT 등 가속 변종 등장                     │
└─────────────────────────────────────────────────────────────────┘
```

## 3.4 학술적 위치

VGGT는 2025년 CVPR 본 학회 **Best Paper Award** 수상 (단독 1편). CVPR은 매년 ~10,000편 투고에서 ~2,500편 채택, 그중 1편이 Best Paper. 직전 수상작:
- 2024: *Generative Image Dynamics* (Google)
- 2023: *Visual Programming* + *Planning-oriented Autonomous Driving*
- 2022: *EPro-PnP* (단일) — Best Student Paper

CVPR 2025 official press release (2025.06.13): "VGGT solves multiple 3D tasks with a single deep neural network in just a few seconds, including estimating the cameras, scene depth, and correspondences across images."

---

# 4. 용어 사전 (Terminology Dictionary)

## 4.1 카메라/기하 기본 용어

| 용어 | 풀 이름 | 의미 |
|-----|--------|------|
| **SfM** | Structure from Motion | 다수 이미지에서 카메라 + sparse 3D 구조 동시 추정 |
| **MVS** | Multi-View Stereo | SfM 결과 + 카메라를 고정한 채 dense depth/point 추정 |
| **BA** | Bundle Adjustment | 카메라 + 3D 점을 동시에 최적화하는 nonlinear LS |
| **Camera Intrinsics** | K matrix | focal length (fx, fy), principal point (cx, cy), skew |
| **Camera Extrinsics** | [R|t] | world-to-camera rotation + translation |
| **Pinhole Model** | — | 표준 perspective projection |
| **Fisheye Model** | — | 광각 lens 왜곡 모델 (Kannala-Brandt 등) |
| **Distortion** | — | radial / tangential lens distortion 계수 (k1,k2,p1,p2,k3) |
| **Reprojection Error** | — | 추정 3D 점을 다시 이미지에 투영했을 때 픽셀 오차 |
| **Triangulation** | — | 두 view의 매칭 픽셀에서 3D 위치 역산 |
| **PnP** | Perspective-n-Point | n개 (3D, 2D) 매칭에서 카메라 pose 추정 |
| **Essential Matrix** | E | calibrated 두 카메라의 epipolar 관계 (3×3) |
| **Fundamental Matrix** | F | uncalibrated 두 카메라의 epipolar 관계 |
| **Plücker Rays** | — | 3D 직선의 6-d 표현, view-conditioned NeRF에서 흔히 사용 |
| **point map** | — | per-pixel 3D 좌표 맵 (H×W×3), DUSt3R/VGGT 핵심 출력 |
| **depth map** | — | per-pixel 깊이 (H×W×1), camera frame 기준 |
| **point tracking** | — | 비디오에서 동일 3D 점이 매 프레임 어디에 있는지 추적 |
| **optical flow** | — | 인접 프레임 간 픽셀 단위 motion vector (long-term tracking 아님) |

## 4.2 모델 구조 용어

| 용어 | 의미 |
|-----|------|
| **DINOv2** | Meta 2023, self-supervised vision transformer. VGGT의 image patch tokenizer로 사용 |
| **CroCo** | Naver 2023, cross-view completion pretraining. DUSt3R/VGGT 계보의 초기 PT 전략 |
| **DPT** | Dense Prediction Transformer (Ranftl 2021). VGGT의 depth/pointmap head로 차용 |
| **camera token** | 카메라 정보 전용 학습 토큰. 각 view마다 1개 |
| **register token** | DINOv2가 도입한 dummy 토큰. attention noise를 흡수하는 역할 |
| **alternating attention** | frame 내 attention과 모든 frame 간 global attention을 layer 단위로 번갈아 적용 |
| **frame-wise self-attention** | 한 view 내 token끼리만 attention |
| **global self-attention** | 모든 view의 모든 token이 한 attention matrix에 |
| **patch token** | 이미지를 P×P 패치로 나눠 ViT에 입력하는 단위 (보통 14×14) |

## 4.3 데이터/벤치마크 용어

| 용어 | 의미 |
|-----|------|
| **Co3D** | Common Objects in 3D (Meta 2021) — 19k 객체, 1.5M 프레임 |
| **ScanNet** | 1.5k 실내 scan + RGB-D + mesh (Stanford 2017) |
| **ARKitScenes** | Apple 2021, ARKit + LiDAR로 실내 캡처 |
| **Habitat-Sim** | Meta 2019, photorealistic 실내 시뮬레이터 |
| **HyperSim** | Apple 2020, photorealistic 합성 실내 |
| **Kubric** | Google 2022, synthetic ground-truth 데이터 생성기 |
| **MegaDepth** | 2018, internet 사진 기반 outdoor depth |
| **BlendMVS** | 2020, 3D 재구성용 합성 데이터 |
| **DL3DV** | 2024, 10k+ 시점 비디오 데이터셋 |
| **WildRGB** | in-the-wild RGB 비디오 |
| **Mapillary** | street-level 사진 |
| **ETH3D** | ETH 2017, high-resolution multi-view 평가 벤치마크 |
| **Tanks and Temples** | 2017, 사실적 outdoor/indoor mesh GT |
| **RealEstate10K** | 2018, YouTube 부동산 영상에서 카메라 GT 추정 |
| **NRGBD** | Neural RGBD 데이터셋, 대표 surface reconstruction 벤치마크 |

---

# 5. VGGT 아키텍처 — 무엇이 들어 있는가

## 5.1 전체 구조

```
입력: N장의 RGB 이미지 (각 H × W × 3, 보통 H=W=518)

STEP 1: 토큰화 (DINOv2 Patch Embedding)
  각 이미지 → P×P 패치 (P=14) → 37×37 = 1369 patch token / image
  token dim: 1024
  추가 토큰 per-view: 1 camera token (학습) + 4 register token

  view i: [cam_t][reg×4][patch×1369]   (i = 1..N)

STEP 2: Alternating Attention (24 layers)
  Layer 1  — frame-wise self-attention (각 view 내 토큰끼리만)
  Layer 2  — global self-attention (모든 view의 모든 토큰)
  Layer 3  — frame-wise
  Layer 4  — global
  ... (총 24 layer 번갈아)

STEP 3: 4개 출력 head
  ① Camera Head      camera_token → MLP → K(3×3) + R(3×3) + t(3) per view
  ② Depth Head       patch token → DPT decoder → H×W depth + confidence
  ③ Point Map Head   patch token → DPT decoder → H×W×3 world XYZ + conf
  ④ Track Head       query 픽셀 + view 토큰 → T 프레임 2D + visibility
                     (CoTracker 기반)
```

## 5.2 왜 alternating attention인가 — 메모리 분석

```
N = view 수, T = view당 토큰 수 (≈ 1374 with cam+reg)

Vanilla full self-attention:
  attention matrix = (N·T) × (N·T) → O((N·T)²)
  예: N=100, T=1374 → 18.9 × 10⁹ entries → FP16 ≈ 38GB
  → H100 80GB로도 N=100 처리 어려움

Frame-wise only:
  N × O(T²) → N=100: 0.4GB FP16
  문제: cross-view 정보 교환 불가

Alternating (VGGT):
  절반 layer는 frame-wise (값싸지만 cross 없음)
  절반 layer는 global (값비싸지만 cross 있음)
  Flash Attention 3 + 절반 비싼 layer만 → 실용 가능

  실측 (H100, FP16):
    N=1 →0.04s  N=8 →0.11s  N=100→3.12s  N=200→8.75s

Fast3R 비교 (1000+ views):
  24-layer ViT-L 전부 global, randomized positional index로
  N=20 학습 → 1000+ 일반화. 251 FPS (108 view, A100)
```

**핵심**: VGGT는 메모리 폭발을 피하기 위해 alternating을 채택. Fast3R는 동일한 N²을 더 큰 모델 + 더 작은 token 수로 흡수. 2025 하반기 AVGGT/FlashVGGT/Faster-VGGT 등 가속 논문 줄지어 등장.

## 5.3 Camera Head — 카메라 토큰의 역할

```
camera token의 학습 흐름:
  1. 초기값: 학습된 임베딩 (random init → grad descent)
  2. 입력 시 각 view에 1개씩 prepend
  3. 24 layer 거치며 patch token과 attention
  4. 마지막 layer의 camera_token → MLP → (K, R, t)

카메라 표현:
  K (intrinsics) — fx, fy, cx, cy (4-d), 보통 fx=fy 가정 단순화
  R (rotation) — quaternion (4-d) 또는 6-d 연속 표현
  t (translation) — 3-d
  → 총 9~13 d 회귀

좌표계:
  - 첫 view의 camera frame을 world origin으로 fix
  - 이후 view들은 이 frame 기준 R, t
  - VGGT는 metric scale이 아닐 수 있음 (relative scale)
```

## 5.4 Depth Head + Point Map Head — DPT 스타일

```
DPT (Ranftl 2021) 구조 차용:
  - patch token (37×37) 을 multi-scale로 reassemble
  - 1/4, 1/8, 1/16, 1/32 해상도 fusion
  - convolution decoder로 H×W 출력

VGGT는 두 head가 분리:
  - Depth head: H×W×1 (camera frame depth) + H×W×1 confidence
  - Point map head: H×W×3 (world XYZ) + H×W×1 confidence

왜 둘 다? 학습 시 두 표현이 상호 supervision:
  - depth + camera로 unproject한 점 ≈ point map output
  - 둘이 일치하지 않으면 loss
  - 추론 시 confidence가 낮은 픽셀은 filter

Loss design:
  - scale-invariant log depth loss
  - point map L1 loss in normalized world frame
  - confidence는 negative log likelihood (Gaussian)
```

## 5.5 Track Head — CoTracker 기반

VGGT의 4번째 출력은 query 2D 픽셀이 N개 view 각각에서 어디에 있는지 추적하는 trajectory다. 1저자 Karaev의 이전 작품 CoTracker (Meta 2024)의 디자인을 차용.

```
입력: query 픽셀 (x, y) on view k
출력: [(x_1,y_1,vis_1), ..., (x_N,y_N,vis_N)]

응용:
  - 동영상 4D reconstruction의 motion 단서
  - bundle adjustment의 long-baseline 매칭 대체
  - mesh deformation의 anchor 점
```

---

# 6. 입출력 스키마 — 코드 수준

## 6.1 PyTorch 인터페이스

```python
# facebookresearch/vggt 공식 API
import torch
from vggt.models.vggt import VGGT
from vggt.utils.load_fn import load_and_preprocess_images

device = "cuda"
model = VGGT.from_pretrained("facebook/VGGT-1B").to(device)
# 또는 상용 라이선스: "facebook/VGGT-1B-Commercial"

# 입력: 파일 리스트 (jpg/png/heic)
image_names = ["scan/0.jpg", "scan/1.jpg", ..., "scan/49.jpg"]

# 전처리: 짧은 변 → 518 px, 긴 변 → 그에 맞춰 letterbox
images = load_and_preprocess_images(image_names).to(device)
# images.shape = (N, 3, H, W), H=518, W~=518 (aspect 보존)

with torch.no_grad():
    predictions = model(images)

# predictions는 다음 키를 갖는 dict
# {
#   "extrinsic":      (B, N, 3, 4)    [R|t], world→camera (OpenCV convention)
#   "intrinsic":      (B, N, 3, 3)    K matrix
#   "depth":          (B, N, H, W, 1) per-pixel depth (camera frame)
#   "depth_conf":     (B, N, H, W)    confidence (0~1)
#   "world_points":   (B, N, H, W, 3) per-pixel world XYZ
#   "world_points_conf": (B, N, H, W)
#   "tracks":         (B, N, T, 2)    optional, query 시
#   "track_vis":      (B, N, T)
# }
```

## 6.2 좌표계 / convention

```
규약:
  - OpenCV convention: x→right, y→down, z→forward (into scene)
  - extrinsic [R|t]: X_cam = R · X_world + t
  - intrinsic K: 표준 pinhole, no skew, fx=fy 가정 default
  - 첫 frame의 camera = world origin
  - scale: relative (metric 아님). 절대 스케일 필요 시 known baseline로 calibrate
```

## 6.3 메쉬화 후처리 (외부 라이브러리)

```python
# 1) world points + confidence → filtered point cloud
import numpy as np
points = predictions["world_points"][0].cpu().numpy()  # (N,H,W,3)
conf   = predictions["world_points_conf"][0].cpu().numpy()  # (N,H,W)
mask = conf > 0.5

cloud = points[mask]  # (M, 3)

# 2) Open3D로 Poisson surface reconstruction
import open3d as o3d
pcd = o3d.geometry.PointCloud()
pcd.points = o3d.utility.Vector3dVector(cloud)
pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(
    radius=0.05, max_nn=30))
pcd.orient_normals_consistent_tangent_plane(k=30)

mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
    pcd, depth=9)
mesh = mesh.crop(pcd.get_axis_aligned_bounding_box())
mesh.compute_vertex_normals()
o3d.io.write_triangle_mesh("scene.obj", mesh)

# 3) 또는 COLMAP → gsplat (3DGS) 흐름
# VGGT가 COLMAP-format 파일 출력 지원 (cameras.txt, images.txt, points3D.txt)
# → gsplat이 그대로 학습 시작
```

---

# 7. 대안 비교 — 어떤 파이프라인을 언제 쓰나

## 7.1 Multi-view 3D Reconstruction 종합 표

| 방법 | 입력 | 출력 | 시간 (수십 장) | 카메라 추정 | 메쉬 출력 | 라이선스 | 비고 |
|-----|------|-----|-----|-----------|---------|---------|-----|
| **COLMAP** (Schönberger 2016) | N장 | sparse + dense + camera | 분~시간 | yes (BA) | 외부 | BSD | photometric, fragile, 정확도 최고 수준 |
| **OpenMVG + OpenMVS** | N장 | similar | 분~시간 | yes | 내장 | MPL2 | open source 대안 |
| **NeuralRecon** (Sun 2021) | RGB-D 비디오 | online mesh | 초 단위 | given | yes | MIT | RGB-D 필요 |
| **DUSt3R** (Naver 2023) | 2장 | pointmap + 카메라 (relative) | ≈1s | partial | 외부 | CC-BY-NC | unposed pair only |
| **MASt3R** (Naver 2024) | 2장 | + matching | ≈1s | yes | 외부 | CC-BY-NC | matching head 추가 |
| **Spann3R** (2024) | N장 sequential | pointmap | sequential | partial | 외부 | — | incremental |
| **MV-DUSt3R+** (Meta 2024) | N장 sparse | pointmap + camera | 2s | yes | 외부 | — | CVPR 2025 oral |
| **Fast3R** (Meta 2025.01) | **1000+장** | pointmap + camera | 251 FPS | partial | 외부 | — | 24-layer ViT-L, 모든 layer global |
| **★ VGGT** (Oxford+Meta 2025.03) | **N장 (1~200+)** | **camera + depth + pointmap + tracks** | **수 초** | **yes** | **외부** | NC + Commercial | **CVPR 2025 Best Paper** |
| **Apple Object Capture** | N장 | mesh (직접) | 수 분 (cloud) | yes | yes | proprietary | photogrammetry + LiDAR fusion |
| **Polycam / Luma AI** | N장 비디오 | mesh + 3DGS | 수 분 (cloud) | yes | yes | SaaS | 2025 시점 photogrammetry+3DGS 혼합 |

## 7.2 정확도 vs 속도 trade-off (정성 평가)

```
                높음
                  ▲
           정    ┃
           확   ┃   COLMAP+MVS+후처리
           도   ┃    ●  (분~시간, 가장 정확)
                  ┃                   ●  Apple Object Capture
                  ┃                      (분, 정확)
                  ┃           ●  VGGT
                  ┃              (수 초, 정확)
                  ┃                                   ●  Fast3R
                  ┃                                     (초, 합리적)
                  ┃    ●  DUSt3R (2 view)
                  ┃       (초, 제한적)
                  ┃
                낮음 ━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ 빠름
                                                     속도
```

## 7.3 상황별 최적 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│              어떤 multi-view reconstruction 쓸까                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Q1. 카메라 intrinsics가 알려져 있고 RGB-D 입력 가능?             │
│      ├─ YES → NeuralRecon, BundleFusion (실시간)                 │
│      └─ NO  → Q2                                                 │
│                                                                  │
│  Q2. 정확도가 최우선인가? (영화 VFX, 문화재 디지털 보존)         │
│      ├─ YES → COLMAP + OpenMVS + 후수동 정리                     │
│      │        (분~시간, 학습 데이터 도메인 mismatch 없음)        │
│      └─ NO  → Q3                                                 │
│                                                                  │
│  Q3. 입력 규모는?                                                │
│      ├─ 2장만 → DUSt3R / MASt3R                                  │
│      ├─ 수~수십 장 → ★ VGGT (best balance)                       │
│      ├─ 100장 이상 → VGGT (200까지 OK) or Fast3R (1000+)         │
│      └─ 하나의 객체 360° 캡처 → Co3D 학습된 VGGT 강함            │
│                                                                  │
│  Q4. 도메인은?                                                   │
│      ├─ 실내 (방, 가구) → VGGT (ScanNet/HyperSim 학습)           │
│      ├─ 객체 중심 → VGGT (Co3D 학습)                             │
│      ├─ outdoor 도시 → COLMAP + Block-NeRF (학습 데이터 부족)    │
│      ├─ aerial/drone → COLMAP + OpenMVG                          │
│      └─ 자율주행 driving scene → Tesla/Wayve 자체 NeRF/3DGS      │
│                                                                  │
│  Q5. 후처리 (최종 표현)?                                         │
│      ├─ mesh 필요 → Poisson on VGGT pointcloud                   │
│      ├─ 사실적 시점 합성 → 3DGS (gsplat, VGGT가 직접 지원)        │
│      ├─ 신경 표현 → NeRF / NeuS (VGGT camera로 빠른 수렴)        │
│      └─ 게임 asset → mesh + texture baking + decimation          │
│                                                                  │
│  Q6. 라이선스?                                                   │
│      ├─ 학술/내부 → VGGT-1B (NC)                                 │
│      ├─ 상용 제품 → VGGT-1B-Commercial (Meta 승인 필요)          │
│      └─ 무제한 상용 → COLMAP (BSD), OpenMVG/OpenMVS (MPL)        │
└─────────────────────────────────────────────────────────────────┘
```

---

# 8. 학습 데이터와 Loss

## 8.1 학습 데이터셋

```
실내 RGB-D / scan:
  ScanNet              1,500 실내 scan
  HyperSim             461 photorealistic 합성 scene
  ARKitScenes          5,047 scan (Apple LiDAR)

객체 중심 video:
  Co3Dv2               19,000 객체 (Meta)

Outdoor / internet:
  MegaDepth            internet 사진 + COLMAP GT
  Mapillary            street-level

Multi-view 합성:
  BlendMVS             합성 3D scene
  Kubric               Google 합성 데이터 (정확한 GT)
  Habitat-Sim          photorealistic 실내 시뮬레이션

대규모 video:
  DL3DV                10k+ 시점 비디오
  WildRGB              in-the-wild 비디오

→ 합성으로 정확한 GT를 보장하면서 실데이터로 도메인 갭 메움
→ 1B 파라미터 모델이 robust prior를 학습
```

## 8.2 4-task multi-loss

```
L_total = λ_cam · L_camera
        + λ_depth · L_depth
        + λ_point · L_pointmap
        + λ_track · L_track
        + λ_conf · L_confidence

각 항목:
  L_camera   — Huber loss on (R, t, K)
  L_depth    — scale-invariant log depth (DPT 스타일)
  L_pointmap — L1 in normalized world frame, scale-invariant
  L_track    — Smooth L1 on 2D tracks + BCE on visibility
  L_confidence — negative log likelihood (Laplace/Gaussian)

learnable confidence는 모델이 "이 픽셀은 모르겠다"고 신호 낼 수 있게 함.
→ 거울/하늘/specular는 자연스럽게 confidence ↓
```

---

# 9. 성능 — 어디서 얼마나 좋은가

## 9.1 카메라 추정 (Co3D, RealEstate10K)

VGGT 논문 Table 1 (camera pose estimation):

| 방법 | Co3D AUC@30° ↑ | RealEstate10K AUC@30° ↑ | 시간 (10 view) ↓ |
|-----|----------------|------------------------|-----------------|
| COLMAP | ~70% | ~50% | 분 단위 |
| PixSfM | ~80% | ~65% | 분 단위 |
| DUSt3R (pair + alignment) | ~85% | ~75% | 수 초 + alignment |
| MASt3R | ~88% | ~80% | 수 초 |
| Fast3R | 99.7% (rotation) | — | 1초 미만 |
| **VGGT** | **>90%** SOTA | **>85%** SOTA | **0.2초** |

(정확한 수치는 논문 Table 1, 2 참조 — 변종 평가 metric 다수)

## 9.2 Multi-view depth (DTU, ETH3D)

| 방법 | ETH3D depth abs rel ↓ |
|-----|----------------------|
| COLMAP MVS | 0.064 |
| MVSNet | 0.056 |
| DUSt3R | 0.040 |
| MASt3R | 0.032 |
| **VGGT** | **0.020** SOTA |

## 9.3 Dense reconstruction (NRGBD, Tanks and Temples)

VGGT는 Chamfer distance, F-score 모두 기존 학습 기반 SOTA를 능가. 단 COLMAP+OpenMVS의 정확도-극대화 셋업과는 trade-off (COLMAP은 더 느리지만 잘 튜닝 시 더 정확할 수 있음).

## 9.4 추론 속도 (H100)

```
N (views)   |   1   |   2   |   8   |  20   |  50   |  100  |  200
inference   | 0.04s | 0.05s | 0.11s | 0.30s | 1.04s | 3.12s | 8.75s
GPU mem     | ~5GB  | ~6GB  | ~9GB  | ~15GB | ~30GB | ~50GB | ~75GB
```

H100 80GB가 N=200까지 한계. 더 많이 처리하려면 sliding window + Spann3R 스타일 incremental, 또는 Fast3R를 써야 한다.

---

# 10. VGGT → Mesh 변환의 표준 후처리 (사용자 질문에 대한 구체 답)

이 섹션은 §1.2의 답을 코드 수준으로 풀어낸다. **VGGT 출력을 mesh로 만드는 데는 3가지 표준 경로가 있다.**

## 10.1 경로 A — Direct Poisson Surface Reconstruction

```
VGGT predictions (world_points + conf)
  → confidence filter (conf > 0.5)
  → point cloud (M points)
  → normal estimation (Open3D)
  → Poisson Surface Reconstruction (Kazhdan 2006, depth=9)
  → trim 낮은 density vertex
  → Triangle mesh (.obj/.ply/.glTF)

장점: 빠름 (수 초), Open3D만 있으면 끝
단점: 색/texture 없음, 거친 표면, hole 있음
```

## 10.2 경로 B — VGGT → 3D Gaussian Splatting → mesh

```
VGGT predictions (camera + depth + point cloud)
  → COLMAP-format export (cameras.txt / images.txt / points3D.txt)
  → gsplat (Nerfstudio) 학습
     ─ VGGT 카메라 정확 → BA 수렴 매우 빠름 (5~10분, 전통은 30분~)
  → 3D Gaussian Splatting representation
     ─ 직접 렌더 가능 (실시간, NeRF보다 100배 빠름)
  → (선택) 3DGS → mesh
     ─ SuGaR/GaMeS/GS2Mesh: Gaussian 평균 + opacity → SDF → Marching Cubes
  → Triangle mesh

장점: 실시간 렌더 + 사실적, 색/lighting 보존
단점: 학습 시간 추가, mesh 변환은 별도 단계
※ VGGT 공식 README가 gsplat 호환 export를 명시 지원
```

## 10.3 경로 C — VGGT → NeRF/NeuS → mesh

```
VGGT predictions (camera 정확)
  → NeuS / VolSDF 학습 (camera ray 따라 implicit SDF + volume rendering)
     ─ VGGT camera 정확 → 수렴 안정적
  → Implicit SDF f(x,y,z) = 0 surface
  → Marching Cubes (해상도 512³ ~ 1024³)
  → Triangle mesh (가장 깔끔, watertight)

장점: watertight, 부드러운 표면, 게임 asset 적합
단점: 학습 30분~2시간 (수렴 느림)
```

## 10.4 경로 비교 표

| 경로 | mesh 품질 | 추가 시간 | 색 | XR 적합도 |
|-----|----------|---------|----|----------|
| A. Poisson | 거침, 구멍 | 수 초 | 없음 | ★★ (빠른 occlusion mesh) |
| B. 3DGS | mesh 변환 시 손실 | 5~10분 | 사실적 | ★★★ (Vision Pro Persona, scene scan) |
| C. NeuS | watertight, 깔끔 | 30분~2시간 | 사실적 | ★★ (게임 asset, 디지털 트윈) |

**XR 캡처 워크플로의 미래**: VGGT → 3DGS → (선택) mesh가 표준. Quest의 scene scan, Vision Pro Persona 다음 세대, Polycam 같은 SaaS가 모두 이 흐름으로 수렴 중.

---

# 11. 베스트 프랙티스 + 안티패턴

## 11.1 베스트 프랙티스

| 항목 | 권장 |
|-----|-----|
| 입력 해상도 | 짧은 변 518px (모델 학습 해상도). 너무 크면 잘림, 너무 작으면 detail 손실 |
| 입력 view 수 | 20~50장이 sweet spot (시간 vs 품질) |
| view 다양성 | 객체 둘레로 다각도, baseline 충분히 (10~30° 간격) |
| 조명 | 균일한 diffuse 조명 권장. 하지만 VGGT는 어느 정도 robust |
| 카메라 | 동일 카메라 통일 권장하나 mixed도 OK (intrinsics를 모델이 추정) |
| GPU | H100 80GB 권장. 24GB GPU는 N=20까지가 한계 |
| confidence threshold | 0.3~0.7 사이 튜닝. 너무 높으면 데이터 손실, 낮으면 노이즈 |
| 후처리 | Open3D outlier removal → Poisson trim → mesh decimation |
| Flash Attention 3 | H100에서 2~3배 가속 |
| FP16/BF16 | 정확도 거의 무손실, 메모리 절반 |

## 11.2 안티패턴

| 안티패턴 | 결과 | 회피 |
|---------|------|------|
| 모션 블러 프레임 섞기 | depth/pointmap 노이즈 ↑ | shutter speed 1/250 이상, IMU sharpness filter |
| 강한 specular (스테인리스, 유리) | confidence 낮은 영역 → mesh 구멍 | 반사 줄이는 조명, polarizer |
| 거울 | "거울 속 가짜 공간"을 학습 데이터에 따라 진짜로 인식 | 거울 영역 마스킹 |
| 동적 객체 (사람, 차) | 프레임 간 inconsistency → outlier | 정적 scene만, 또는 segmentation으로 제외 |
| 너무 비슷한 view (10cm baseline) | triangulation 부정확 | baseline을 객체 거리의 5~10% 이상 |
| 합성 학습 → 우주 사진 적용 | domain gap | 비슷한 도메인 학습 데이터로 finetune |
| metric scale 가정 | VGGT는 relative scale | 알려진 길이 (체커보드, 마커)로 calibrate |
| 너무 많은 view (300+) | OOM 또는 alternating attention 한계 | sliding window + Spann3R 스타일 fusion |
| confidence 무시 | mesh에 floater | 반드시 conf > 0.3 필터 |
| 카메라 첫 frame 가정 무시 | world frame 잘못 해석 | 첫 view를 origin으로 설정한 좌표계 인지 |

---

# 12. 빅테크/산업 사례

## 12.1 Meta — 본가

VGGT는 Meta GenAI / Reality Labs 작품. 2025.07 VGGT-1B-Commercial 라이선스 출시는 사내 제품군 통합 의지의 신호.

```
잠재 응용:
  - Quest mixed reality scene scan: 현재 ARKit/Quest depth + plane detection
    → VGGT-class 모델로 더 정밀한 mesh 캡처
  - Codec Avatars: 다수 카메라 multi-view → photo-real avatar
    VGGT 같은 빠른 geometry 추정이 핵심 빌딩 블록
  - Horizon Worlds 3D 자산 캡처: 사용자가 핸드폰으로 찍어 즉시 import
  - Reality Labs의 Project Aria 안경: egocentric video → 환경 3D
```

Fast3R도 Meta facebookresearch — 1000+ view 처리는 long-form egocentric video (Aria 안경)를 직접 겨냥.

## 12.2 Naver Labs Europe — 라이벌이자 조상

DUSt3R / MASt3R / CroCo 라인업 모두 Naver Labs Europe Grenoble 출신. Jérôme Revaud 팀이 핵심.

```
Naver의 흐름:
  CroCo (2023.04) — pretraining 패러다임
  → DUSt3R (2023.12) — 2 image regression
  → MASt3R (2024.06) — matching 강화
  → MASt3R-SfM (2024.10) — multi-view 확장 시도

Naver는 "smaller is better" 노선 (수백M params),
Meta+Oxford는 "scale + multi-task" 노선 (1B+ params).
```

## 12.3 Apple — 미참여, 그러나 같은 시장

Apple은 OpenXR도, Naver/Meta 흐름도 따라가지 않는다. 자체 스택:
- **RoomPlan** (iOS 16~) — LiDAR 기반 실내 mesh
- **Object Capture** (macOS 12~) — photogrammetry, cloud 처리도 가능
- **ARKit Scene Geometry** — LiDAR + ML로 실시간 mesh
- **Vision Pro Persona** — 다수 IR 카메라로 얼굴 캡처 → 3D representation

VGGT의 등장은 Apple이 향후 LiDAR 의존도를 낮출 명분을 준다 — VGGT-class 모델이면 LiDAR 없이도 비슷한 quality scan이 가능. Vision Pro Persona의 다음 세대는 VGGT 같은 multi-view transformer가 들어갈 가능성이 매우 높다.

## 12.4 Niantic / 8th Wall

Niantic Lightship와 8th Wall은 사용자 캡처 → 클라우드 3D reconstruction → AR map 구축이 핵심 비즈니스. 현재는 photogrammetry + 자체 NeRF 후처리. **VGGT-class 모델로 업그레이드 시 처리 시간이 분 → 초 단위로 단축** → 더 많은 사용자가 더 많은 장소를 캡처 → AR map 데이터 가속.

Niantic Lightship VPS (Visual Positioning System)는 사용자 사진 한 장에서 정확한 위치를 알아내는데, 이런 reverse direction에도 VGGT-class 표현이 유용.

## 12.5 자율주행 — Tesla / Wayve / Waymo

Tesla CVPR 2022 Workshop에서 Andrej Karpathy가 "occupancy + NeRF style" 언급. 8~12개 차량 카메라의 multi-view 실시간 reconstruction은 self-driving의 next frontier.

```
관계:
  - Tesla Occupancy Networks: 카메라만으로 voxel 점유도
  - Wayve의 GAIA-1: 비디오 generative model + 3D
  - Waymo의 NeRF-based simulation
  - VGGT는 이 모든 것의 학습 신호 source 역할 가능
    (offline 정밀 reconstruction → online 모델 학습)
```

자율주행은 latency 제약이 강해 VGGT를 직접 쓰진 못하지만, 학습 단계의 ground-truth label generator로 매우 유용.

## 12.6 상용 SaaS — Polycam, Luma AI, KIRI Engine

```
2025년 시점:
  Polycam       photogrammetry + LiDAR + 3DGS, 처리 5~15분
  Luma AI       NeRF/3DGS 중심, mobile capture, 5~10분
  KIRI Engine   photogrammetry + NeRF, free tier 있음

VGGT-class 도입 시:
  처리 시간 5~15분 → 30초~2분
  사용자 retention 대폭 ↑
  실제로 2025년 후반 이들 SaaS들이 VGGT-class 모델을
  자체 학습/통합 중이라는 보도 다수
```

## 12.7 게임 엔진 통합

Unity AR Foundation의 mesh capture, Unreal Engine 5의 LiDAR scan import는 현재 ARKit/Quest API에 의존. VGGT-class가 모바일 NPU에서 동작 가능해지면 (현재 1B는 무리, 양자화/distill 후) **게임 엔진 내장 capture**가 표준이 될 것.

Roblox는 사용자 생성 3D 콘텐츠의 폭발적 증가가 핵심 성장 지표 — capture 도구의 기술 격차가 곧 플랫폼 경쟁력.

---

# 13. XR 개발자 관점 — cooking-assistant 같은 앱에서 어떻게 쓸까

## 13.1 시나리오 — "주방을 3D로 캡처해 AR 가이드 띄우기"

```
1. 사용자가 첫 사용 시 주방을 30초 동영상 촬영
   (Quest passthrough or Galaxy XR, 60 frame @ 1fps 추출)
2. 클라우드 VGGT inference (5초) → COLMAP-format + mesh
   (or 양자화 VGGT-mini가 나오면 디바이스 직접)
3. 결과: camera trajectory + Poisson mesh + 식탁/싱크대 segmentation
4. mesh 위에 가상 가이드 placement
   "도마 여기 놓으세요", "냄비는 가스 위" 화살표
5. 다음 사용 시 새 사진 1장으로 VPS 재정렬
   (저장된 VGGT pointmap에 query localize)

sherpa-onnx와 결합:
  음성("도마 어디?") → VGGT mesh segmentation 검색 → 3D arrow overlay
```

## 13.2 모델 패키징 고민

VGGT 1B 모델은 ~4GB (FP16). 모바일 직접 배포는 비현실적.

| 옵션 | 크기 | 속도 | 비용 |
|-----|-----|------|------|
| 클라우드 inference | 0 (서버) | 5~10초 + 네트워크 | 인스턴스 비용 |
| 양자화 INT8 distill | ~1GB | 10~30초 (Snapdragon) | OTA |
| Mini variant (학생 distill) | ~200MB | 1~3초 | 정확도 ↓ |

[`sherpa-onnx-온디바이스-asr.md`](../ai/sherpa-onnx-온디바이스-asr.md) §10에서 다룬 Play Asset Delivery 흐름과 같은 고민이 적용된다 — 200~300MB 단위면 PAD install-time 가능.

## 13.3 Unity / Unreal 통합 (2026.05 현실)

- VGGT ONNX export는 커뮤니티 변환 수준. 1B 모델 Unity Sentis 직접 실행은 메모리 부족.
- 클라우드 fallback이 합리적 — Unity가 frame을 모아 서버로 전송, 결과 mesh를 ARMeshManager에 push.
- 2026~2027년 distilled 200M 변종이 나오면 디바이스 직접 실행 가능 전망.

---

# 14. VGGT의 한계와 후속 연구

## 14.1 알려진 한계

| 한계 | 원인 | 회피/완화 |
|-----|------|----------|
| Metric scale 부재 | unposed 입력 → 절대 스케일 학습 불가 | known reference (마커, AR ruler)로 사후 calibrate |
| Dynamic scene 약함 | 정적 scene 가정 | 4D 확장 모델 (Spann3R-D, Dynamic VGGT) 후속 |
| Specular/transparent 약함 | 학습 데이터 분포 | confidence head로 자연스럽게 표시되긴 함 |
| Outdoor large-scale 약함 | 실내 데이터 비중 큼 | COLMAP과 hybrid, 또는 outdoor-specific finetune |
| 1B params, 80GB GPU | 모델 크기 | distillation, quantization 후속 연구 |
| 200 view 한계 | alternating attention 메모리 | Fast3R, Spann3R 사용 |

## 14.2 후속 연구 (2025.07~)

```
2025.07  VGGT-1B-Commercial 출시
2025.09  Faster VGGT (Block-Sparse Global Attention)
         → global attention의 sparse 패턴 학습
2025.12  AVGGT — global attention 가속 변종
2025.12  FlashVGGT — Compressed Descriptor Attention
2026 Q1  Dynamic VGGT (예고) — 4D scene
2026 Q2  Mobile VGGT (예고) — 200M distilled
```

## 14.3 다음 5년 예측

```
2026  VGGT-class가 Polycam/Luma 표준 백본
2027  Quest/Vision Pro 디바이스 직접 실행 (NPU 양자화)
2028  자동차/드론 실시간 deployment
2029  AR glasses의 표준 scene capture
2030  "한 번 찍으면 3D" 가 사진 찍는 것만큼 일상
```

---

# 15. 클러스터 관계도

이 문서는 4-doc 클러스터의 일부:

```
       사진 N장
          │
          ▼
   ★ VGGT (본 문서) ★    →  camera + depth + pointmap + tracks
          │
   ┌──────┴──────┐
   ▼             ▼
 NeRF         3D Gaussian Splatting (3DGS)
   │             │
   └──────┬──────┘
          ▼
   사용자 망막에 빛으로 (LBS AR 디스플레이)
```

- VGGT : 사진 → 기하 표현
- NeRF : 기하 + 사진 → implicit volumetric
- 3DGS : 기하 + 사진 → explicit Gaussian 집합
- LBS  : 위 표현 → 사용자 망막

상세:
- [`nerf-neural-radiance-fields.md`](nerf-neural-radiance-fields.md) — VGGT의 camera 출력을 입력으로 받는 다음 세대 표현
- [`3d-gaussian-splatting-3DGS.md`](3d-gaussian-splatting-3DGS.md) — VGGT가 COLMAP-format export로 직접 지원하는 후처리 경로
- [`laser-beam-steering-LBS-AR디스플레이.md`](laser-beam-steering-LBS-AR디스플레이.md) — 최종 렌더 결과를 AR 안경에서 보여주는 디스플레이 기술

---

# 16. 핵심 포인트 정리

```
★ 사용자 질문 정답:
   "VGGT는 2D image를 3D mesh로 깔끔하게 바꾸는가?"
   → VGGT는 mesh를 만들지 않는다. mesh의 직전 단계 — camera +
     depth + pointmap을 한 신경망 forward로 만든다. mesh는
     Poisson/3DGS/NeuS 같은 외부 후처리.
   → "깔끔함"의 본질: SfM+MVS+BA 8단계 파이프라인 (분~시간) →
     한 신경망 forward (수 초)

★ 무엇이 새로운가:
   1. N장 unposed 이미지 한 번에 처리 (1~200+)
   2. 4개 출력 (camera, depth, pointmap, tracks) 동시
   3. Alternating attention으로 메모리 폭발 회피
   4. 1.2B params + 거대 학습 데이터로 robust prior

★ 학술 위상:
   CVPR 2025 Best Paper (단독 1편)
   Oxford VGG ↔ Meta GenAI 공동 작품
   (Visual Geometry Group = VGG-Net의 출생지)

★ 영향 받는 분야:
   Quest scene scan, Vision Pro Persona, Polycam, Luma AI,
   Niantic Lightship, Apple Object Capture, 자율주행 reconstruction,
   영화 VFX previs, 로봇 SLAM

★ 한계:
   metric scale 없음 / dynamic scene 약함 / 1B params 모바일 어려움
   / 200 view 한계 (alternating attention)

★ XR 개발자에게:
   - 2026 시점에서는 클라우드 inference가 현실적
   - 2027~ NPU 양자화 distill 기다리는 중
   - 자기 앱에 capture 넣을 거면 VGGT-class 가정하고 UX 설계 시점
```

---

# 참고 자료

## 원논문 / 공식

- VGGT: Visual Geometry Grounded Transformer — arxiv https://arxiv.org/abs/2503.11651
- VGGT 공식 프로젝트 페이지 — https://vgg-t.github.io/
- VGGT GitHub (facebookresearch) — https://github.com/facebookresearch/vggt
- VGGT HuggingFace 데모 — https://huggingface.co/spaces/facebook/vggt
- VGGT-1B 모델 — https://huggingface.co/facebook/VGGT-1B
- VGGT-1B-Commercial 모델 — https://huggingface.co/facebook/VGGT-1B-Commercial
- CVPR 2025 Best Paper 발표 — https://cvpr.thecvf.com/Conferences/2025/News/Awards_Press
- Oxford 공식 발표 — https://www.cs.ox.ac.uk/news/2456-full.html
- Oxford Engineering 발표 — https://eng.ox.ac.uk/news/oxford-researchers-awarded-best-paper-at-cvpr-2025
- 1저자 Jianyuan Wang 홈페이지 — https://jytime.github.io/

## 직접 조상 / 라이벌

- DUSt3R: Geometric 3D Vision Made Easy (Naver, 2023.12) — https://arxiv.org/abs/2312.14132
- MASt3R: Grounding Image Matching in 3D (Naver, 2024.06) — https://arxiv.org/abs/2406.09756
- Fast3R: 3D Reconstruction of 1000+ Images (Meta, 2025.01) — https://arxiv.org/abs/2501.13928
- Fast3R 프로젝트 페이지 — https://fast3r-3d.github.io/
- MV-DUSt3R+ — https://mv-dust3rp.github.io/
- CroCo (Naver, 2023) — 모든 DUSt3R 라인의 pretraining 시초

## 관련 후속 / 확장

- Faster VGGT (Block-Sparse Attention, 2025.09) — https://arxiv.org/pdf/2509.07120
- AVGGT (2025.12) — https://arxiv.org/abs/2512.02541
- FlashVGGT (2025.12) — https://arxiv.org/abs/2512.01540
- Review of Feed-forward 3D Reconstruction: From DUSt3R to VGGT — https://arxiv.org/abs/2507.08448

## 전통 파이프라인 / 비교군

- COLMAP — https://colmap.github.io/
- COLMAP 논문 (Schönberger CVPR 2016) — https://demuc.de/papers/schoenberger2016sfm.pdf
- OpenMVG — https://github.com/openMVG/openMVG
- OpenMVS — https://github.com/cdcseacave/openMVS
- MVSNet (Yao 2018) — https://arxiv.org/abs/1804.02505

## 학습 데이터셋

- Co3Dv2 — https://github.com/facebookresearch/co3d
- ScanNet — http://www.scan-net.org/
- HyperSim — https://github.com/apple/ml-hypersim
- Kubric — https://github.com/google-research/kubric
- ARKitScenes — https://github.com/apple/ARKitScenes
- Habitat-Sim — https://github.com/facebookresearch/habitat-sim

## 후처리 (mesh / 3DGS)

- 3D Gaussian Splatting (Kerbl 2023) — https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
- gsplat (Nerfstudio) — https://github.com/nerfstudio-project/gsplat
- NeuS (Wang 2021) — https://lingjie0206.github.io/papers/NeuS/
- Open3D Poisson reconstruction — http://www.open3d.org/docs/release/tutorial/geometry/surface_reconstruction.html

## 학문적 배경

- VGG-Net 원논문 (Simonyan & Zisserman 2014) — https://arxiv.org/abs/1409.1556
- Multiple View Geometry in Computer Vision (Hartley & Zisserman, Cambridge) — https://www.cambridge.org/9780521540513
- Oxford Visual Geometry Group — https://www.robots.ox.ac.uk/~vgg/
- DPT (Dense Prediction Transformer, Ranftl 2021) — https://arxiv.org/abs/2103.13413
- DINOv2 (Meta 2023) — https://github.com/facebookresearch/dinov2
- CoTracker (Karaev 2024) — https://co-tracker.github.io/

## 산업 사례

- Apple Object Capture — https://developer.apple.com/augmented-reality/object-capture/
- Apple RoomPlan — https://developer.apple.com/augmented-reality/roomplan/
- Polycam — https://poly.cam/
- Luma AI — https://lumalabs.ai/
- Niantic Lightship VPS — https://lightship.dev/
- Meta Project Aria — https://www.projectaria.com/
