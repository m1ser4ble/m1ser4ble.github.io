---
layout: single
title: "NeRF (Neural Radiance Fields) — 신경 광휘장 완전가이드"
date: 2026-05-05 23:04:00 +09:00
categories: frontend
excerpt: "NeRF는 공간 좌표와 시선 방향을 입력받아 색과 밀도를 예측하는 신경 표현으로, 여러 장의 2D 사진만으로 새로운 시점의 3D 장면 이미지를 합성하게 만든 기술이다."
toc: true
toc_sticky: true
tags: [nerf, radiancefield, rendering, 3dreconstruction, xr]
source: "/home/dwkim/dwkim/docs/xr/nerf-neural-radiance-fields.md"
---

TL;DR
- NeRF는 3D 장면을 mesh가 아니라 연속 함수로 표현하고, 광선 적분을 통해 새로운 시점 이미지를 합성한다.
- 이 접근은 multi-view geometry와 neural rendering을 결합해 사진 여러 장만으로도 매우 사실적인 novel view synthesis를 가능하게 만들었다.
- 대신 ray marching 기반 계산량이 커서 이후 instant-NGP, 3DGS 같은 가속·대체 계열이 빠르게 등장했다.

## 1. 개념
NeRF는 위치와 시선 방향을 입력으로 받아 색과 밀도를 예측하는 5D 신경 장 표현과 volume rendering 적분을 결합한 novel view synthesis 기법이다.

## 2. 배경
기존 3D 재구성은 점군, voxel, mesh처럼 명시적 자료구조를 중심으로 발전했지만, NeRF는 장면을 함수 형태로 압축해 고품질 view synthesis를 만들어냈다. 이 전환은 이후 3D 생성, spatial capture, XR scene representation 연구의 기준점을 바꿨다.

## 3. 이유
이 개념을 알아야 3DGS, VGGT, modern neural rendering이 무엇을 계승하고 무엇을 버렸는지 이해할 수 있다. 특히 radiance, density, transmittance 같은 광학 개념이 왜 여전히 핵심인지 연결된다.

## 4. 특징
- 5D 입력과 RGB+밀도 출력을 쓰는 coordinate MLP가 핵심이다
- volume rendering과 hierarchical sampling이 품질과 비용을 함께 결정한다
- COLMAP 기반 pose 추정과 multi-view supervision이 초기 대표 파이프라인이었다
- 속도 병목 때문에 hash grid, explicit primitives, distillation 계열 후속 연구가 이어졌다

## 5. 상세 내용

# NeRF (Neural Radiance Fields) — 신경 광휘장 완전가이드

> **작성일**: 2026-05-05
> **카테고리**: XR / Computer Vision / Neural Rendering / 3D Reconstruction
> **트리거**: 3D scene representation 진화의 분기점을 따라잡기 위한 4-doc 클러스터의 1편 — NeRF가 만든 개념 프레임을 먼저 이해해야 [3DGS](3d-gaussian-splatting-3DGS.md)·[VGGT](vggt-visual-geometry-grounded-transformer.md)·디스플레이단 [LBS](laser-beam-steering-LBS-AR디스플레이.md)까지 일관된 그림이 잡힘
> **포함 내용**: Neural Radiance Field, radiance L(x,ω), volumetric rendering, density field σ, opacity vs density, view-dependent color, MLP, positional encoding, Fourier features, NTK, hierarchical sampling (coarse + fine), stratified sampling, Plenoxels, instant-NGP, multiresolution hash grid, Mip-NeRF, integrated positional encoding, cone tracing, Mip-NeRF 360, NDC space, world space, COLMAP, Structure-from-Motion, Bundle Adjustment, Ben Mildenhall, Pratul Srinivasan, Matthew Tancik, Jonathan Barron, Ravi Ramamoorthi, Ren Ng, UC Berkeley, Google Research, ECCV 2020, Best Paper Honorable Mention, DeepVoxels, Scene Representation Networks (SRN), Local Light Field Fusion (LLFF), Light Field Rendering (Levoy/Hanrahan 1996), Plenoptic Function (Adelson/Bergen 1991), volume rendering integral, alpha compositing, opacity α, transmittance T, NeRF in the Wild (NeRF-W), NSVF, KiloNeRF, FastNeRF, Plenoctrees, DVGO, TensoRF, Mip-NeRF 360, Block-NeRF, Mega-NeRF, Zip-NeRF, NeuS, VolSDF, Neuralangelo, NerfStudio, Nerfacto, 3D Gaussian Splatting, Gaussian Splatting의 explicit rasterization, SIMT divergence, ray marching, neural rendering, view synthesis, novel view synthesis, LLFF dataset, Synthetic NeRF dataset, Tanks and Temples, ScanNet, Replica, Lumiere, Genie, HyperReel, Object Capture, RoomPlan, Niantic Spatial Platform, 8th Wall, Lightship, Tesla Autopilot Sim, Waymo Block-NeRF, Apple immersive video, Snapdragon XR2+ Gen 2

---

# 1. NeRF란?

## 1.1 한 줄 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                  NeRF 한 줄 정의                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "장면을 5D 함수 F_Θ : (x, y, z, θ, φ) → (RGB, σ) 로 표현하고     │
│   고전 volume rendering 적분으로 임의 시점 사진을 합성하는        │
│   coordinate-based MLP 신경 표현"                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  핵심 5요소:                                          │       │
│  │  ├── 1) 5D 입력: 3D 위치 (x,y,z) + 2D 시선 (θ,φ)      │       │
│  │  ├── 2) 4D 출력: RGB (3) + 밀도 σ (1)                  │       │
│  │  ├── 3) 표현 매체: 8-layer × 256-dim ReLU MLP         │       │
│  │  ├── 4) 학습 신호: 픽셀 색 reconstruction L2 loss       │       │
│  │  └── 5) 미분 가능 volume rendering                      │       │
│  │                                                        │       │
│  │  → 다중 시점 RGB 사진 + camera pose 만으로 학습       │       │
│  │  → 임의 새 시점에서 photorealistic novel view 생성     │       │
│  │  → 메쉬 / voxel / point cloud 모두 안 쓰는 implicit    │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

ECCV 2020 oral, Best Paper Honorable Mention. Mildenhall, Srinivasan, Tancik (UC Berkeley), Barron (Google), Ramamoorthi (UCSD), Ng (UCB) 6인 공저.

원논문: arxiv:2003.08934, *"NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis"*.

## 1.2 왜 이게 충격이었나

2020년 3월 NeRF 공개 시점의 view synthesis SOTA 들은 **Local Light Field Fusion (LLFF, SIGGRAPH 2019)** 수준 — 메쉬 + multi-plane image (MPI) + 깊이 추정 + heuristic blending이 결합된 복잡한 파이프라인이었고, view-dependent specular나 반투명 물체에서는 어색한 ghosting이 남았다.

NeRF는 **MLP 한 개 + 한 줄짜리 volume rendering 적분**으로 모든 SOTA를 한꺼번에 갈아치웠다. 코드도 저자들 깃허브 (`bmild/nerf`)에 TensorFlow 600줄 정도. *"이 단순한 게 정말 되네?"* 의 충격이 이후 3년의 폭발적 follow-up을 견인했다.

```
┌─────────────────────────────────────────────────────────────────┐
│        NeRF Synthetic 데이터셋 PSNR (높을수록 좋음)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LLFF (2019)                  24.13                             │
│   Scene Representation Net.    22.26                             │
│   Neural Volumes (2019)        26.05                             │
│   ────────────────────────────────────                           │
│   NeRF (2020)                  31.01   ← +5 dB 도약              │
│   Mip-NeRF (2021)              33.09                             │
│   Plenoxels (2021)             31.71  (MLP 없이)                 │
│   instant-NGP (2022)           32.96  (학습 5초)                 │
│   Mip-NeRF 360 (2022)          —      (실외 unbounded)           │
│   Zip-NeRF (2023)              33.10  (24x 빠름)                 │
│   3DGS (2023)                  33.32  (real-time)                │
└─────────────────────────────────────────────────────────────────┘
```

PSNR +5 dB는 영상 품질 평가에서 "전 세대를 압도"하는 수준. 1 dB도 의미 있는 차이로 여겨지는 분야에서 5 dB는 게임 체인저.

---

# 2. 용어 사전 (Terminology Dictionary)

## 2.1 회사/사람/장소

| 용어 | 풀 이름 | 의미와 어원 |
|------|--------|-----|
| **NeRF** | **Ne**ural **R**adiance **F**ields | 신경 광휘장. *Radiance*는 PBR 광학의 복사 휘도. *Field*는 공간 모든 점에 정의된 함수. 발음은 영문 그대로 "너프" |
| **Ben Mildenhall** | — | 1저자. UC Berkeley 박사 → Google Research → 2024부터 Luma AI |
| **Pratul Srinivasan** | — | 공동 1저자. UC Berkeley → Google Research |
| **Matthew Tancik** | — | 공동 1저자. UC Berkeley → 2024 Luma AI 공동창업. NerfStudio의 주역 |
| **Jonathan Barron** | — | Google Research. Mip-NeRF, Mip-NeRF 360, Zip-NeRF의 driving force. 사진/깊이/최적화 분야 다수 hit |
| **Ravi Ramamoorthi** | — | UC San Diego 교수. spherical harmonics for environment lighting (2001) 으로 유명 |
| **Ren Ng** | — | UC Berkeley 교수. Lytro 창업 (2006), light field 카메라 상용화. Stanford 박사논문 *"Digital Light Field Photography"* (2006) 가 NeRF 사상 계보의 출발 |

## 2.2 빛 / 광학 기초

| 용어 | 의미와 어원 |
|------|-----|
| **Radiance** L(x, ω) | 점 x에서 방향 ω로 단위 입체각·단위 면적·단위 시간당 방출되는 복사 에너지. 단위 W·sr⁻¹·m⁻². 카메라 픽셀이 측정하는 양 |
| **Radiance field** | 공간 전체에 정의된 radiance의 vector field. 5D 함수 (3D 위치 × 2D 방향) |
| **Plenoptic function** | Adelson & Bergen (1991) 제안. 7D 함수 P(x,y,z,θ,φ,λ,t) — 위치·방향·파장·시간. NeRF는 λ 와 t 빼고 5D만 |
| **BRDF** | Bidirectional Reflectance Distribution Function. 표면 점에서 입사광 → 반사광 비율. NeRF는 BRDF를 명시 모델링 안 하고 view-direction 입력으로 implicit 학습 |
| **View-dependent color** | 같은 점도 보는 방향에 따라 색이 달라짐 (specular, fresnel, anisotropic). NeRF의 5D 입력이 이걸 표현 |
| **Lambertian** | 모든 방향 동일 밝기 (시점 독립). 종이/벽 등 diffuse surface |

## 2.3 Volume Rendering

| 용어 | 의미 |
|------|-----|
| **Volume density** σ(x) | 점 x에서의 미분 흡수 확률 (per unit length). 단위 m⁻¹. *"광선이 dt 만큼 진행할 때 σ·dt 확률로 멈춘다"* |
| **Opacity** α | 한 sample의 누적 흡수율. α = 1 - exp(-σ·δ). 0~1 범위 |
| **Transmittance** T(t) | 광선이 거리 t까지 살아남을 확률. T(t) = exp(-∫σ ds). NeRF의 핵심 가중치 |
| **Volume rendering integral** | C(r) = ∫ T(t)·σ(t)·c(t,d) dt — 광선을 따라 색을 누적 |
| **Alpha compositing** | front-to-back 누적: c_out = Σ T_i · α_i · c_i. 이산화된 volume rendering과 동치 |
| **Ray marching** | 광선을 따라 일정 간격으로 sampling하여 적분 근사. NeRF 추론의 병목 |

## 2.4 신경망 / 학습

| 용어 | 의미 |
|------|-----|
| **Coordinate MLP** | 입력이 좌표(x,y,z)인 MLP. NeRF, SIREN, DeepSDF 등의 공통 패러다임 |
| **Positional encoding** γ | 좌표를 sin/cos 푸리에 베이시스로 lift. high-frequency 표현 학습 가능하게 함 |
| **Hierarchical sampling** | coarse network로 빈 공간 빠르게 스킵 → 표면 근처에서 fine network로 정밀 sampling |
| **Stratified sampling** | 광선을 N 구간으로 나눠 각 구간에서 random offset sampling. bias 제거 |
| **NeRF synthetic dataset** | Lego, Drums, Ficus 등 8개 360° 합성 장면. NeRF view synthesis 평가의 사실상 표준 |
| **LLFF dataset** | Local Light Field Fusion 논문의 forward-facing 실사 장면들 (꽃, 식물, 책상 등) |

## 2.5 카메라 / SfM

| 용어 | 의미 |
|------|-----|
| **COLMAP** | Schönberger & Frahm 2016 — open-source Structure-from-Motion + MVS. NeRF 학습 데이터 준비의 사실상 표준 도구 |
| **Bundle Adjustment** | 다수 사진의 카메라 pose와 3D 점 위치를 동시에 최적화. SfM의 핵심 단계 |
| **Camera pose** | 외부 파라미터 (R, t). 4×4 변환 행렬로 표현. NeRF는 모든 입력 사진의 pose가 알려져 있어야 학습 가능 |
| **Intrinsic** | 내부 파라미터 (focal length, principal point). 픽셀 좌표를 camera-space ray로 변환할 때 필요 |
| **NDC** | Normalized Device Coordinates. Forward-facing 장면을 near/far plane 사이 [-1,1]³으로 매핑. 깊이를 disparity로 압축해 무한대 처리 용이 |

## 2.6 NeRF 변종 패밀리

| 약어 | 풀 이름 | 핵심 |
|------|--------|-----|
| **NeRF-W** | NeRF in the Wild | 야생 사진 컬렉션 처리. Appearance/transient embedding |
| **NSVF** | Neural Sparse Voxel Fields | sparse voxel + MLP. 빠른 ray marching |
| **Mip-NeRF** | Multiscale NeRF | cone tracing + integrated positional encoding으로 anti-aliasing |
| **Mip-NeRF 360** | unbounded scene 확장 | 360° 무한 배경, distortion-aware proposal MLP |
| **instant-NGP** | Instant Neural Graphics Primitives | multi-resolution hash grid → 5초 학습 |
| **Plenoxels** | Plenoptic Voxels | MLP 없는 sparse voxel + spherical harmonics |
| **Block-NeRF** | block-decomposed NeRF | Waymo street-scale, 도시 단위 |
| **Mega-NeRF** | mega-scale NeRF | 항공 촬영 대규모 장면 |
| **Zip-NeRF** | Mip-NeRF + iNGP | grid-based + anti-aliased, 24x 빠름 |
| **NeuS** | Neural Surface | density 대신 SDF — 깔끔한 mesh 추출 |
| **Neuralangelo** | NVIDIA, NeuS 후속 | high-fidelity surface reconstruction, instant-NGP grid 사용 |
| **NerfStudio** | UC Berkeley 오픈소스 프레임워크 | NeRF 변종들 통합 학습/시각화 환경. Nerfacto 기본 |

---

# 3. 등장 배경 — 2020 이전 3D Representation의 한계

## 3.1 다섯 가지 대안과 각자의 벽

```
┌─────────────────────────────────────────────────────────────────┐
│            Pre-NeRF 3D 표현 방식과 한계                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1) Triangle Mesh (전통)                                         │
│     ├── 위상이 fixed → 학습 중 토폴로지 변경 어려움              │
│     ├── 미분 어려움 (rasterization 자체는 미분 가능하나           │
│     │    vertex 위치 변화에 따른 이산 변화 처리 까다)            │
│     └── 머리카락 / 연기 / 액체 표현 거의 불가                    │
│                                                                  │
│  2) Voxel Grid (DeepVoxels 2019)                                 │
│     ├── 메모리 O(N³) 폭발 — 512³ × float = 0.5GB                 │
│     ├── 해상도 = 메모리 직접 거래                                │
│     └── empty space에 메모리 낭비                                │
│                                                                  │
│  3) Point Cloud                                                  │
│     ├── 점 사이 빈 공간 → 구멍 (hole)                           │
│     ├── 표면 normal / connectivity 명시 불가                     │
│     └── splatting 필요 → splat 모양 hand-tune                    │
│                                                                  │
│  4) Implicit Surface SDF (DeepSDF, Occupancy Net.)               │
│     ├── 표면은 깔끔 ─ but 단일 surface                          │
│     ├── view-dependent specular 표현 불가                        │
│     ├── 반투명 / 매체 (구름/연기/머리카락) 불가                 │
│     └── 색 표현 별도 모델 필요                                   │
│                                                                  │
│  5) Multi-Plane Image (LLFF 2019)                                │
│     ├── forward-facing 장면 한정                                 │
│     ├── 큰 시점 변화 시 ghosting                                 │
│     └── view-dep effect 부분적으로만                             │
└─────────────────────────────────────────────────────────────────┘
```

NeRF 이전에 SOTA였던 LLFF (Mildenhall, SIGGRAPH 2019) 가 NeRF 1저자 본인의 작품인 점이 흥미롭다. LLFF의 명확한 한계 (forward-facing 한정, view-dep effect 부족) 가 다음 해 NeRF의 동기였다.

## 3.2 신경 표현 흐름 — DeepVoxels → SRN → NeRF

```
2019.01  DeepVoxels (Sitzmann et al., CVPR 2019)
           ├── voxel grid + per-voxel feature vector
           ├── projection + 2D CNN으로 view synthesis
           └── 메모리 한계, view-dep 약함

2019.06  Scene Representation Networks (Sitzmann et al., NeurIPS 2019)
           ├── coordinate MLP F(x) → feature vector
           ├── LSTM-based ray marching (학습 가능)
           └── color/density 분리 안 됨, 학습 불안정

2019.06  Local Light Field Fusion (Mildenhall et al., SIGGRAPH 2019)
           ├── MPI + heuristic blending
           ├── forward-facing 한정
           └── view synthesis SOTA 직전

2019.06  Neural Volumes (Lombardi et al., SIGGRAPH 2019)
           ├── voxel grid + warp field
           ├── Facebook Reality Labs
           └── 동적 장면 (얼굴) 가능

2020.03  NeRF (Mildenhall, Srinivasan, Tancik et al.)
           ↑ 모든 줄기를 통합 ─
             coordinate MLP + density σ + view-dep color +
             정통 volume rendering + positional encoding
```

NeRF는 *완전히 새로운 아이디어가 아니라*, 그 전 1년 동안 등장한 여러 신경 표현의 핵심 컴포넌트들을 정확한 조합으로 결합한 작품이다. 그 조합이 모든 트레이드오프를 한꺼번에 풀었다는 점이 천재적이었다.

## 3.3 더 깊은 뿌리 — Light Field 이론

```
┌─────────────────────────────────────────────────────────────────┐
│              NeRF의 30년 사상적 계보                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1991  Plenoptic Function   Adelson & Bergen                    │
│        7D P(x,y,z,θ,φ,λ,t) — "공간 모든 점·모든 방향·             │
│        모든 파장·모든 시간의 빛"                                  │
│                                                                  │
│  1996  Light Field Rendering   Levoy & Hanrahan, SIGGRAPH 1996  │
│        Lumigraph    Gortler et al., SIGGRAPH 1996               │
│        4D 압축 (외부 표면 가정 시) → image-based rendering 시작   │
│                                                                  │
│  2005  Light Field Camera    Ng (현 UCB 교수, NeRF 6저자)        │
│        Stanford 박사논문 "Digital Light Field Photography"        │
│        → Lytro 창업 (2006)                                       │
│                                                                  │
│  2010s  자유시점 방송 / Image-Based Rendering 시대               │
│         multi-view stereo, mesh + texture                        │
│                                                                  │
│  2017  Transformer (별 줄기지만 표현 학습 폭발)                  │
│  2019  DeepVoxels / SRN / Neural Volumes / LLFF                  │
│  2020  NeRF — 30년 light field 이론을 신경 표현으로 압축         │
└─────────────────────────────────────────────────────────────────┘
```

1996년 Levoy/Hanrahan의 4D light field에서 한 걸음 더 — *공간 표면 가정을 빼고 5D radiance field 자체를 implicit MLP에 담는다*. 이것이 NeRF의 핵심 통찰이다.

---

# 4. 5D 함수와 MLP 아키텍처

## 4.1 5D 입출력

```
┌─────────────────────────────────────────────────────────────────┐
│             NeRF의 5D 함수 정의                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   F_Θ : (x, d)  →  (c, σ)                                       │
│                                                                  │
│   x = (x, y, z)        ∈ ℝ³    위치                             │
│   d = (θ, φ)           ∈ S²    시선 방향 (unit vector로 표현)    │
│   c = (r, g, b)        ∈ [0,1]³  RGB 색                         │
│   σ                    ∈ ℝ⁺   미분 흡수 확률 (per unit length)   │
│                                                                  │
│   Θ = MLP 가중치 (≈ 1.2M params, 8 layer × 256 dim)              │
└─────────────────────────────────────────────────────────────────┘
```

핵심 설계 결정:
- **σ는 위치만의 함수** σ(x) — 같은 점은 어디서 봐도 *불투명도* 가 같아야 함 (물리적 일관성)
- **색은 위치 + 시선의 함수** c(x, d) — specular highlight, fresnel reflection 등 view-dep 효과 포착

## 4.2 MLP 구조

```
┌─────────────────────────────────────────────────────────────────┐
│           NeRF MLP 아키텍처 (원논문 Fig. 7)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   x ∈ ℝ³                                                         │
│     │                                                            │
│     ▼                                                            │
│   γ(x) ∈ ℝ^60      ← positional encoding L=10                   │
│     │                                                            │
│     ▼                                                            │
│   ┌──────────────────┐                                          │
│   │ FC(60→256) ReLU  │ Layer 1                                   │
│   │ FC(256→256) ReLU │ Layer 2                                   │
│   │ FC(256→256) ReLU │ Layer 3                                   │
│   │ FC(256→256) ReLU │ Layer 4                                   │
│   └──────────────────┘                                          │
│            │                                                     │
│            ├── concat γ(x) ─────┐  ← skip connection             │
│            ▼                     │                                │
│   ┌──────────────────┐          │                                │
│   │ FC(256+60→256)   │ Layer 5  │                                │
│   │ FC(256→256) ReLU │ Layer 6                                   │
│   │ FC(256→256) ReLU │ Layer 7                                   │
│   │ FC(256→256) ReLU │ Layer 8                                   │
│   └──────────────────┘                                          │
│            │                                                     │
│            ├──── σ (1 dim, ReLU)                                 │
│            ▼                                                     │
│   feat ∈ ℝ^256                                                   │
│     │                                                            │
│     │  + γ(d) ∈ ℝ^24    ← view direction PE L=4                 │
│     ▼                                                            │
│   ┌──────────────────┐                                          │
│   │ FC(256+24→128) ReLU │ Layer 9                                │
│   │ FC(128→3) sigmoid    │ → c (RGB)                             │
│   └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

설계 포인트:
- σ는 5번째 layer에서 나오는데 view direction은 그 *이후*에 들어감 → σ가 d에 의존 안 한다는 구조적 보장
- skip connection은 깊은 MLP에서 positional info가 희석되는 걸 방지 (ResNet-식)
- 8 layer × 256 dim은 약 1.2M params, 이 규모에서 단일 장면을 거의 완벽 재현

---

# 5. Volume Rendering — NeRF의 심장

## 5.1 연속형 적분식

광선 r(t) = o + t·d (origin o, direction d, 가까운 거리 t_n에서 먼 거리 t_f까지) 위에서 픽셀 색은:

```
C(r) = ∫_{t_n}^{t_f}  T(t) · σ(r(t)) · c(r(t), d)  dt

T(t) = exp( - ∫_{t_n}^{t} σ(r(s)) ds )
```

해석:
- **σ(r(t))** : 점 r(t) 에서 광선이 멈출 확률 밀도
- **c(r(t), d)** : 그 점에서 d 방향으로 나오는 색
- **T(t)** : 광선이 그 점까지 살아남을 (즉 앞쪽이 모두 투명할) 확률
- 곱 σ·T는 t 위치에서 광선이 *처음으로* 멈춘다는 확률 밀도 — 이걸 색에 곱해 적분하면 픽셀 색

물리 직관: 안개를 통과하며 비추는 손전등의 빛이 어디서 *얼마나* 산란해 카메라로 들어오는지의 합.

## 5.2 이산화 (Quadrature)

```
┌─────────────────────────────────────────────────────────────────┐
│        이산화된 Volume Rendering                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   광선을 N개 구간으로 stratified sampling — t_1, ..., t_N        │
│   각 구간 길이 δ_i = t_{i+1} - t_i                               │
│                                                                  │
│   각 sample point에서 MLP 한 번 query:                           │
│     (c_i, σ_i) = F_Θ(r(t_i), d)                                  │
│                                                                  │
│   이산화된 픽셀 색:                                               │
│                                                                  │
│     C ≈ Σ_{i=1}^{N}  T_i · α_i · c_i                            │
│                                                                  │
│     α_i = 1 - exp(-σ_i · δ_i)        ← i번째 sample의 opacity    │
│     T_i = exp( -Σ_{j<i} σ_j · δ_j )  ← 누적 transmittance         │
│                                                                  │
│   → 곧 alpha compositing의 정확한 형태!                          │
│   → front-to-back 누적: w_i = T_i · α_i 가 weight                │
│   → Σ w_i ≤ 1, 1 - Σ w_i 가 background 비중                     │
└─────────────────────────────────────────────────────────────────┘
```

**중요 통찰**: 이 식은 *모든 점의 σ_i, c_i 에 대해 미분 가능*. 즉 픽셀 색에 대한 reconstruction loss `||C_pred - C_gt||²` 가 MLP 가중치 Θ까지 그대로 backprop된다. 이것이 NeRF가 학습 가능한 이유의 본질.

## 5.3 PyTorch 의사 코드 — 핵심 학습 step

```python
def render_ray(ray_o, ray_d, model, near, far, N_samples=64):
    """단일 광선을 따라 색 합성 (미분 가능)."""
    # 1) Stratified sampling
    t_vals = torch.linspace(0, 1, N_samples)             # [N]
    z_vals = near + (far - near) * t_vals                # [N]
    # bin 안에서 random offset (학습 시)
    if model.training:
        mids = 0.5 * (z_vals[1:] + z_vals[:-1])
        upper = torch.cat([mids, z_vals[-1:]])
        lower = torch.cat([z_vals[:1], mids])
        z_vals = lower + (upper - lower) * torch.rand_like(z_vals)

    # 2) Sample 좌표
    pts = ray_o[None, :] + z_vals[:, None] * ray_d[None, :]   # [N, 3]
    dirs = ray_d.expand(N_samples, 3)                          # [N, 3]

    # 3) Positional encoding + MLP query
    pts_enc  = positional_encoding(pts,  L=10)   # [N, 60]
    dirs_enc = positional_encoding(dirs, L=4)    # [N, 24]
    raw_rgb, raw_sigma = model(pts_enc, dirs_enc)

    rgb   = torch.sigmoid(raw_rgb)               # [N, 3] in [0,1]
    sigma = F.relu(raw_sigma)                    # [N]   ≥ 0

    # 4) Volume rendering (alpha compositing)
    deltas = z_vals[1:] - z_vals[:-1]
    deltas = torch.cat([deltas, torch.tensor([1e10])])      # last 무한
    alpha  = 1.0 - torch.exp(-sigma * deltas)               # [N]
    T      = torch.cumprod(torch.cat([torch.ones(1),
                                      1.0 - alpha + 1e-10]), dim=0)[:-1]
    weights = T * alpha                                      # [N]
    pixel_color = (weights[:, None] * rgb).sum(dim=0)        # [3]
    return pixel_color, weights, z_vals


# 학습 한 step
for ray_o, ray_d, gt_color in dataloader:           # 보통 batch=1024 ray
    pred, _, _ = render_ray(ray_o, ray_d, model, near=2., far=6.)
    loss = ((pred - gt_color) ** 2).mean()
    optimizer.zero_grad(); loss.backward(); optimizer.step()
```

이게 NeRF의 *전부*다. 600줄 안에 이 핵심 60줄이 들어있고 나머지는 데이터 로더/시각화/checkpoint다.

---

# 6. Positional Encoding — 왜 필수인가

## 6.1 문제: ReLU MLP의 low-frequency bias

표준 ReLU MLP에 좌표 (x, y, z)를 직접 넣으면 **고주파 디테일을 못 학습한다**. NeRF 논문의 ablation:

```
PE 없이 (x,y,z) 직접:        PSNR 22.5  (블러)
PE 있음 (γ(x), L=10):        PSNR 31.0  (선명)

→ 8.5 dB 차이 — 이게 NeRF가 동작하느냐 마느냐의 차이
```

## 6.2 수식

```
┌─────────────────────────────────────────────────────────────────┐
│        Positional Encoding γ(p)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   γ(p) = [ sin(2⁰πp), cos(2⁰πp),                                │
│            sin(2¹πp), cos(2¹πp),                                │
│            ...                                                   │
│            sin(2^{L-1}πp), cos(2^{L-1}πp) ]                     │
│                                                                  │
│   p ∈ ℝ → γ(p) ∈ ℝ^{2L}                                         │
│   3차원 좌표면 좌표 별로 각각 적용 → ℝ^{6L}                      │
│                                                                  │
│   NeRF 기본:                                                     │
│     L = 10  for position    → 60-dim                            │
│     L = 4   for direction   → 24-dim                            │
│                                                                  │
│   주기:                                                          │
│     k=0:  주기 2     (전역 패턴)                                  │
│     k=1:  주기 1                                                 │
│     k=2:  주기 0.5                                               │
│     ...                                                          │
│     k=9:  주기 ~1/512  (가장 미세한 디테일)                      │
└─────────────────────────────────────────────────────────────────┘
```

좌표 p가 [-1, 1] 범위에 정규화돼 있다고 가정하면, k=9 까지 encoding하면 약 1/512 해상도까지 표현 가능. 512×512 사진의 픽셀 단위 디테일과 매칭.

## 6.3 왜 작동하는가 — Tancik et al. NeurIPS 2020

NeRF 후속 논문 *"Fourier Features Let Networks Learn High Frequency Functions in Low Dimensional Domains"* (Tancik, Srinivasan, Mildenhall et al., NeurIPS 2020 spotlight) 가 정식으로 분석:

```
┌─────────────────────────────────────────────────────────────────┐
│           NTK 관점에서의 분석                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Neural Tangent Kernel (NTK) 이론:                              │
│    무한폭 MLP는 학습 동안 kernel regression처럼 행동함.           │
│    그 kernel이 어떤 주파수 성분을 잘 학습하는지가 결정적.         │
│                                                                  │
│  Plain MLP (좌표 직접 입력):                                     │
│    NTK가 매우 빠르게 감쇠하는 spectrum                           │
│    → 저주파 성분만 잘 학습, 고주파는 사실상 학습 못 함            │
│                                                                  │
│  Fourier feature mapping γ(p):                                  │
│    NTK가 stationary (translation-invariant) 형태로 변환           │
│    → 모든 주파수 대역이 균형 있게 학습 가능                       │
│                                                                  │
│  추가 결과:                                                       │
│    L (PE 주파수 수) 가 너무 크면 noise overfit                    │
│    L 이 너무 작으면 detail 표현 불가                              │
│    → L=10이 sweet spot (positional)                             │
└─────────────────────────────────────────────────────────────────┘
```

이 분석은 SIREN (Sitzmann et al., NeurIPS 2020) 의 sin activation, instant-NGP의 hash grid 등 후속 coordinate network 연구의 이론적 기초를 제공.

---

# 7. Hierarchical Sampling — 효율의 비밀

## 7.1 문제: empty space 낭비

광선의 대부분 구간은 빈 공간 (σ ≈ 0). 64개 sample 중 표면 근처 4~5개만 의미 있는 σ 기여. 나머지는 MLP forward 낭비.

## 7.2 Coarse + Fine 두 네트워크

```
┌─────────────────────────────────────────────────────────────────┐
│              Hierarchical Sampling                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Step 1: Coarse Network                                         │
│     광선을 N_c = 64개 stratified sample                          │
│     coarse MLP query → weight w_i                                │
│     w_i 가 클수록 "여기 표면이 있을 가능성 높음"                  │
│                                                                  │
│   Step 2: PDF 만들기                                             │
│     normalized weights를 1D PDF로 변환                            │
│     ŵ_i = w_i / Σ w_i                                            │
│                                                                  │
│   Step 3: Fine Network                                           │
│     PDF에 따라 N_f = 128 추가 sample (inverse CDF sampling)       │
│     coarse 64 + fine 128 = 192 sample                            │
│     fine MLP query (별도 가중치)                                  │
│     volume rendering으로 최종 색 계산                             │
│                                                                  │
│   Loss:                                                          │
│     L = ||C_coarse - C_gt||² + ||C_fine - C_gt||²               │
│     coarse도 학습되어야 PDF가 의미 있음                           │
└─────────────────────────────────────────────────────────────────┘
```

총 192 query면 적지 않지만, *균일 192 sample 대비* 표면 근처 샘플 밀도가 훨씬 높아 화질이 더 좋음. 이 idea는 모든 후속 NeRF가 계승.

---

# 8. NeRF 패밀리 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│            NeRF 시대 진화 압축 연표 (2019-2024)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2019.01  DeepVoxels (Sitzmann et al., CVPR)                    │
│  2019.06  Scene Representation Networks (Sitzmann, NeurIPS)      │
│  2019.06  Local Light Field Fusion (Mildenhall, SIGGRAPH)        │
│  2019.06  Neural Volumes (Lombardi, SIGGRAPH)                    │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│  2020.03  NeRF (Mildenhall et al., arxiv 2003.08934)            │
│           — 5D coordinate MLP + volume rendering + PE            │
│  2020.06  Fourier Features (Tancik et al., NeurIPS)              │
│           — PE 의 NTK 정당화                                      │
│  2020.08  NeRF-W (Martin-Brualla et al.)                         │
│           — 야생 사진 컬렉션, appearance/transient embedding      │
│  2020.10  NSVF (Liu et al., NeurIPS)                             │
│           — sparse voxel + MLP, 빠른 ray marching                │
│                                                                  │
│  2021.03  PlenOctrees (Yu et al.)                                │
│           — NeRF → octree로 압축, 실시간 렌더                    │
│  2021.03  FastNeRF (Garbin et al., ICCV)                         │
│           — 추론 200x 가속                                        │
│  2021.03  KiloNeRF (Reiser et al., ICCV)                         │
│           — 1000개 작은 MLP                                       │
│  2021.03  Mip-NeRF (Barron et al., ICCV oral, BPHM)              │
│           — anti-aliasing via cone tracing + IPE                 │
│  2021.06  NeuS (Wang et al., NeurIPS spotlight)                  │
│           — density 대신 SDF, mesh 추출 가능                     │
│  2021.12  Plenoxels (Fridovich-Keil et al.)                      │
│           — MLP 0개, sparse voxel + SH로 동등 화질                │
│  2021.11  DVGO (Sun et al., CVPR 2022)                           │
│           — direct voxel grid 학습 15분                           │
│                                                                  │
│  2022.01  instant-NGP (Müller et al., SIGGRAPH BPA)              │
│           — multi-resolution hash grid → 5초 학습                │
│  2022.02  Block-NeRF (Tancik et al., CVPR)                       │
│           — Waymo, San Francisco neighborhood, 2.8M images       │
│  2022.03  Mip-NeRF 360 (Barron et al., CVPR oral)                │
│           — unbounded scene, contraction                         │
│  2022.04  TensoRF (Chen et al., ECCV)                            │
│           — tensor decomposition (CP, VM)                        │
│  2022.07  Mega-NeRF (Turki et al., CVPR)                         │
│           — 항공 촬영 도시 스케일                                 │
│                                                                  │
│  2023.05  Neuralangelo (Li et al., CVPR best paper)              │
│           — NeuS + iNGP, 고품질 mesh 추출                         │
│  2023.06  Zip-NeRF (Barron et al., ICCV oral, BP finalist)       │
│           — Mip-NeRF 360 + iNGP, 8-77% 오류 감소, 24x 빠름        │
│  2023.07  3D Gaussian Splatting (Kerbl et al., SIGGRAPH BPA)     │
│           ★ NeRF 시대 사실상 종결 — explicit primitives + raster  │
│                                                                  │
│  2024+    NeRF 잔존 영역:                                        │
│           - 학술 baseline                                         │
│           - dense surface SDF (NeuS 계열)                        │
│           - 동적 장면 일부 (HyperReel, K-Planes)                 │
│           - 비디오 generative model의 latent representation       │
└─────────────────────────────────────────────────────────────────┘
```

NeRF가 SOTA였던 기간은 *3년 4개월* (2020.03 ~ 2023.07). 짧지만 폭발적이었고, 매 분기 새로운 변종이 나왔다.

---

# 9. NeRF 변종 비교

| 변종 | 학습 시간 | 추론 시간 | 메모리 | PSNR | 특징 |
|------|----------|----------|--------|------|------|
| **NeRF (원본)** | 1~2 day | ~30 sec/frame | 작음 (5MB MLP) | 31.01 | baseline |
| **NeRF-W** | days | seconds | 작음 | — | 야외 photo collection |
| **Mip-NeRF** | 1 day | seconds | 작음 | 33.09 | anti-aliasing |
| **PlenOctrees** | NeRF + bake | real-time | 큼 (octree) | ~30.5 | NeRF baking |
| **KiloNeRF** | NeRF + distill | ~30 FPS | medium | 31.0 | 1000 small MLP |
| **NSVF** | hours | ~1 sec | medium | 31.7 | sparse voxel |
| **Plenoxels** | 11 min | seconds | 큼 (~5GB) | 31.71 | MLP 없음 |
| **DVGO** | 15 min | seconds | 큼 | 31.95 | direct voxel |
| **TensoRF** | 17 min | seconds | medium | 33.14 | tensor decomp. |
| **instant-NGP** | **5 sec** | **real-time (저해상도)** | medium (hash) | 32.96 | multi-res hash |
| **Mip-NeRF 360** | hours | seconds | 작음 | — | unbounded |
| **Zip-NeRF** | ~1h | seconds | medium | 33.10 | iNGP + Mip-360 |
| **NeuS** | hours | medium | medium | (mesh metric) | 깔끔한 surface |
| **Neuralangelo** | ~1day | medium | medium | (mesh) | hi-fi mesh |

PSNR은 NeRF Synthetic 데이터셋 평균 (Lego/Drums/Ficus/Hotdog/Materials/Mic/Ship/Chair). 원논문 보고치 또는 후속 논문의 표 참조.

---

# 10. 핵심 변종 깊이

## 10.1 Mip-NeRF — Anti-aliasing via Cone Tracing

원본 NeRF는 *광선 = 무한히 얇은 1D 직선*으로 가정. 픽셀이 멀리 있을 때 / 가까이 있을 때 sample 위치 똑같음 → multi-scale에서 aliasing (jaggies, moiré).

Mip-NeRF의 해결:
- 광선이 아니라 **cone (원뿔)** 을 추적
- 각 sample은 점이 아닌 **3D Gaussian (절두원뿔 근사)**
- positional encoding을 그 Gaussian 영역 위에서 **integrate** → "Integrated Positional Encoding (IPE)"

```
┌─────────────────────────────────────────────────────────────────┐
│              Cone Tracing                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  카메라 픽셀                                                      │
│      │                                                           │
│      │ ╲                                                         │
│      │  ╲       원뿔의 절두 부분 (frustum)                       │
│      │   ╲      을 3D Gaussian으로 근사                          │
│      │    ╲                                                       │
│      ▼     ╲                                                     │
│      ●━━━━━━●━━━━━━●━━━━━━●━━━━━●                                │
│      └ Gaussian 1 ┘                                              │
│             └ Gaussian 2 ┘                                       │
│                    ...                                            │
│                                                                  │
│  IPE: γ(x) 를 Gaussian 분포 위에서 적분                          │
│       → 고주파 PE 성분이 자동으로 attenuate                       │
│       → multi-scale에서 자연스러운 anti-aliasing                  │
└─────────────────────────────────────────────────────────────────┘
```

ICCV 2021 oral, Best Paper Honorable Mention. NeRF 본가의 직속 후속작.

## 10.2 instant-NGP — 5초 학습의 비결

NVIDIA Müller et al., SIGGRAPH 2022 Best Paper. *"5초 학습"* 이라는 임팩트 카피로 NeRF 대중화에 결정적.

핵심 아이디어:
```
┌─────────────────────────────────────────────────────────────────┐
│         Multi-Resolution Hash Grid                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Coarse grid     Medium grid    Fine grid                        │
│  (16³)           (64³)          (512³)                           │
│  ┌──────┐        ┌──────┐       ┌──────┐                         │
│  │ • • •│        │••••••│       │······│                         │
│  │ • • •│        │••••••│       │······│                         │
│  │ • • •│        │••••••│       │······│                         │
│  └──────┘        └──────┘       └──────┘                         │
│                                                                  │
│  각 voxel 정점 → hash table 의 한 슬롯 (T=2^14~2^24)              │
│  슬롯에는 학습 가능한 feature vector (예: F=2 dim)                │
│                                                                  │
│  query x:                                                         │
│    각 해상도에서 8 정점의 feature를 trilinear interp              │
│    → 16 (= 8 res × 2 dim) feature concat                         │
│    → tiny MLP (2 layer × 64 dim) → (RGB, σ)                      │
│                                                                  │
│  핵심:                                                            │
│    • MLP가 매우 작아짐 (NeRF 원본 1.2M → iNGP 0.01M)             │
│    • 학습의 무거운 짐을 hash table이 진다                         │
│    • CUDA kernel (tiny-cuda-nn)로 GPU 풀가속                      │
│    • collision (서로 다른 voxel이 같은 hash)은                    │
│      MLP가 contextual하게 해결                                    │
│                                                                  │
│  → NeRF 원본 1~2일 학습이 5초로 단축                              │
│  → "Instant" Neural Graphics Primitives                          │
└─────────────────────────────────────────────────────────────────┘
```

instant-NGP는 NeRF만의 트릭이 아니라 SDF, gigapixel image, neural volume 등 모든 coordinate network에 적용 가능한 *범용 가속기*. NVIDIA가 SIGGRAPH 2022 best paper로 받은 이유.

## 10.3 Plenoxels — MLP를 아예 빼버린다

UC Berkeley Fridovich-Keil et al. *"Radiance Fields without Neural Networks"* — NeRF의 본질을 *MLP가 아닌 volume rendering* 에 두는 도발적 주장.

```
┌─────────────────────────────────────────────────────────────────┐
│              Plenoxels                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  표현:                                                            │
│    sparse voxel grid (256³ 후 pruning)                           │
│    각 voxel:                                                     │
│      • σ (1 dim)                                                 │
│      • spherical harmonics 계수 9개 × 3 채널 = 27 dim            │
│        → view-dep color를 SH로 표현                              │
│                                                                  │
│  학습:                                                            │
│    MLP 없음. voxel 값 자체가 학습 파라미터.                       │
│    Adam/SGD + total variation regularization                     │
│                                                                  │
│  결과:                                                            │
│    PSNR 31.71 (NeRF 31.01보다 높음)                              │
│    학습 11분 (NeRF 1~2일)                                        │
│    렌더 수 초/frame                                               │
│                                                                  │
│  교훈:                                                            │
│    "NeRF의 마법은 MLP가 아니라 differentiable                     │
│     volume rendering 에 있다"                                     │
└─────────────────────────────────────────────────────────────────┘
```

이 결과는 instant-NGP와 함께 *"학습 가능한 explicit feature grid + 작은 MLP"* 가 *"순수 implicit MLP"* 를 명확히 이긴다는 흐름을 만든다. 이 흐름의 끝에 3DGS가 있다.

## 10.4 Zip-NeRF — 마지막 학술적 정점

Barron et al., ICCV 2023 oral, Best Paper Finalist. NeRF 본가가 만든 마지막 NeRF 기념비.

핵심: **Mip-NeRF 360 (anti-alias) + instant-NGP (hash grid)** 의 결합. 둘은 conceptually 충돌하는데 — Mip-NeRF의 IPE는 closed-form Gaussian 적분에 의존하고, hash grid는 그런 적분이 없음. Zip-NeRF는 hash grid 위에서 multi-sample 기반의 anti-aliasing을 제안하여 둘을 화해시킴.

결과:
- Mip-NeRF 360 대비 PSNR 8~77% 오류 감소
- 학습 24x 빠름

발표 한 달 뒤(2023.08) SIGGRAPH 2023에서 3DGS가 공개. *"끝까지 NeRF를 밀어붙인 정점"* 과 *"NeRF 패러다임을 깨는 후속자"* 가 같은 분기에 등장한 것이 2023년 view synthesis 분야의 극적 장면.

## 10.5 NeRF-W — 야생 사진의 수용

Martin-Brualla et al. (Google) — Trevi Fountain, Brandenburg Gate 같은 *관광지 사진 인터넷 컬렉션* 으로 NeRF 학습 가능하게 만듦.

문제:
- 사진마다 노출/색온도/시간대 다름 → 일관된 radiance field 가정 깨짐
- 사람/차량 등 transient object가 있다가 없다가

해결:
- **Appearance embedding**: 사진별 latent vector를 concat → 색 분기에서 사용. 노출/시간 차이 흡수.
- **Transient embedding + transient density head**: 일시적 객체를 별도 head로 모델링하여 본 장면에서 분리.

결과: 인터넷 사진만으로 photorealistic novel view 생성 가능. VR 관광 / 디지털 트윈의 가능성을 보여준 milestone.

---

# 11. NeRF가 학습/추론이 느린 근본 이유

## 11.1 비용 계산

```
┌─────────────────────────────────────────────────────────────────┐
│          NeRF 학습 한 step 의 연산량                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   batch  = 1024 ray                                              │
│   sample = 64 (coarse) + 128 (fine) = 192 / ray                  │
│   MLP    = 8 layer × 256 dim ≈ 0.6 MFLOPs / query                │
│                                                                  │
│   per step:                                                      │
│     1024 × 192 × 0.6M = 118 GFLOPs                               │
│                                                                  │
│   학습 step 수: ~200,000                                         │
│                                                                  │
│   total:                                                         │
│     118 GFLOPs × 200,000 = 24 PFLOPs                             │
│                                                                  │
│   V100 기준 14 TFLOPs → ~1700 sec = 28 min...                   │
│   실제: 1~2 day (메모리/오버헤드/I/O 포함)                       │
│                                                                  │
│   추론 800×800 사진:                                             │
│     800 × 800 × 192 × 0.6M = 73 TFLOPs                           │
│     V100에서 ~5 sec/frame                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 11.2 instant-NGP의 가속 분해

```
┌─────────────────────────────────────────────────────────────────┐
│       instant-NGP가 5초로 줄인 4가지 트릭                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1) MLP가 매우 작음 (0.6M → 0.01M)         → 60x                 │
│  2) Hash grid lookup이 학습 부담을 짊어짐                        │
│  3) Empty space skipping (occupancy grid)  → 5~20x               │
│  4) Custom CUDA kernel (tiny-cuda-nn)      → 10x                 │
│                                                                  │
│  곱하면 수천 배 가속이 가능 → 1~2일 → 5초                         │
└─────────────────────────────────────────────────────────────────┘
```

## 11.3 그러나 여전히 ray marching이 본질 병목

instant-NGP도 *추론* 은 여전히 ray marching. GPU의 raster pipeline (rasterization + Z-buffer)을 못 쓰고 SIMT divergence가 큰 ray-by-ray 패턴이라 throughput 한계 명확. 4K 60fps는 어려움.

이 한계가 3DGS가 NeRF를 이긴 결정적 이유로 이어진다 (§13).

---

# 12. 학습 파이프라인 — COLMAP과 함께

## 12.1 표준 워크플로

```
┌─────────────────────────────────────────────────────────────────┐
│         NeRF 학습 데이터 준비 pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. 캡처:                                                        │
│      - 30~200장 사진 (각도 다양, overlap 충분)                   │
│      - 정지 카메라 + 정지 물체 권장                               │
│      - 일관된 노출 (auto exposure 끄거나 후보정)                  │
│                                                                  │
│   2. COLMAP 실행:                                                 │
│      $ colmap feature_extractor --database  ...                  │
│      $ colmap exhaustive_matcher --database ...                  │
│      $ colmap mapper                          ← SfM, BA           │
│      → cameras.txt, images.txt, points3D.txt                     │
│                                                                  │
│   3. 좌표 변환:                                                   │
│      COLMAP 좌표계 → NeRF 좌표계 (보통 OpenGL convention)         │
│      scene scale 정규화 (carved bounding box → unit cube)        │
│                                                                  │
│   4. NeRF 학습:                                                   │
│      run_nerf.py --datadir ./scene --config configs/nerf.yaml    │
│                                                                  │
│   5. 시각화 / 평가:                                               │
│      held-out test view에서 PSNR / SSIM / LPIPS 계산              │
│      novel view rendering 영상 생성                              │
└─────────────────────────────────────────────────────────────────┘
```

## 12.2 COLMAP quality가 ceiling

NeRF의 화질은 *COLMAP 카메라 pose가 정확한 만큼* 만 가능. pose가 1픽셀이라도 어긋나면 MLP가 그 차이를 *blur* 로 흡수해서 결과 품질이 떨어짐.

대응:
- **Pose refinement**: 학습 중 pose도 함께 fine-tune (BARF, NeRF-- 등)
- **NeRF-on-the-go**: COLMAP 없이 학습 (어려움)
- **Apple ARKit / Android XR**의 SLAM pose를 직접 사용 (충분히 정확하면)

## 12.3 NDC vs World Space

| 좌표계 | 사용처 | 특징 |
|-------|-------|------|
| **NDC** (Normalized Device Coordinates) | LLFF forward-facing 장면 | 깊이를 disparity로 압축, near/far plane 사이를 [-1,1]³로 매핑. 무한대 처리 가능 |
| **World** | 360° 장면 (NeRF Synthetic) | 표준 직교 좌표. 명확한 near/far 필요 |
| **Contracted** (Mip-NeRF 360) | unbounded outdoor | 무한 영역을 sphere 표면으로 contract → MLP가 모두 다룸 |

선택 실수가 흔한 함정. forward-facing 야외 장면에 World 좌표를 그대로 쓰면 background가 학습 안 됨.

---

# 13. 왜 3DGS에게 자리를 내줬나

자세한 3DGS 내부는 [`3d-gaussian-splatting-3DGS.md`](3d-gaussian-splatting-3DGS.md)에 미루고, 여기서는 *NeRF 관점에서 무엇을 잃었는가* 만 정리.

## 13.1 핵심 비교

| 항목 | NeRF (instant-NGP 포함) | 3D Gaussian Splatting |
|------|------------------------|----------------------|
| **표현** | implicit (MLP/grid coord function) | explicit (수백만 3D Gaussian primitive) |
| **렌더링** | ray marching + MLP query | rasterization + alpha blending |
| **GPU 친화성** | SIMT divergence ↑, mem bw ↓ | raster pipeline 직접 활용 |
| **학습 시간** | 5초~수일 | 30분 (보통) |
| **추론 FPS** | 저해상도 30fps / 4K 어려움 | **100+ FPS @ 1080p** |
| **메모리** | 모델 5~500MB | **GPU에 수백만 점, 수백MB~GB** |
| **편집** | implicit이라 어려움 | 점 자체를 제거/이동 가능 |
| **Mesh 추출** | density isosurface (어려움) | 어려움 (둘 다 약점) |
| **Quality** | SOTA (Zip-NeRF) | SOTA에 근접, 종합 우위 |

## 13.2 결정적 이유: GPU 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│         GPU 관점에서 NeRF vs 3DGS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   NeRF ray marching:                                             │
│     - 각 광선의 sample 수가 다를 수 있음 (early termination)      │
│     - SIMT lane 들이 서로 다른 위치 query                        │
│     → divergence 발생, 실제 utilization 떨어짐                   │
│     - sample마다 MLP forward → memory bandwidth 압박              │
│     - GPU의 raster pipeline (수십년 최적화) 못 씀                 │
│                                                                  │
│   3DGS rasterization:                                            │
│     - 점들을 화면에 splat (rasterize)                            │
│     - tile-based parallelism 자연스러움                          │
│     - alpha blending은 fragment shader의 일상                    │
│     → GPU raster pipeline 풀가속                                 │
│     → 100+ FPS                                                   │
│                                                                  │
│   추가 차이:                                                     │
│     - 3DGS는 학습된 표현을 그대로 GPU에 살려둠 (explicit)         │
│     - NeRF는 매 query마다 MLP 평가 (implicit cost)               │
└─────────────────────────────────────────────────────────────────┘
```

## 13.3 NeRF가 마련한 *개념적* 토대

3DGS는 NeRF의 모든 것을 버린 게 아니다. NeRF가 만든 다음 개념을 그대로 이어받음:
- **Differentiable rendering**: 픽셀 색에 대한 reconstruction loss로 3D 표현 학습
- **Volume rendering integral**: 3DGS의 alpha blending 자체가 NeRF discrete formula의 변형
- **Per-primitive view-dependent color (SH)**: Plenoxels에서 NeRF로 역수입된 spherical harmonics를 3DGS가 그대로 사용
- **COLMAP 입력 + camera pose 기반 학습**: 데이터 파이프라인 전체

즉 *NeRF가 패러다임 전체를 만들었고 3DGS는 그 안에서 표현 매체만 implicit MLP → explicit Gaussian으로 갈아탔다*. 그래서 3DGS도 여전히 "neural radiance field" 의 자손으로 분류된다.

---

# 14. 3D Scene Representation 종합 비교

| 표현 | 학습 시간 | 렌더 속도 | 메모리 | View synthesis 품질 | Mesh 추출 | 동적 장면 |
|-----|----------|----------|--------|--------------------|----------|----------|
| **Mesh + texture** | 직접 (DCC) | very fast (raster) | 작음 | 광원/투명체 약함 | trivial | rigging 필요 |
| **Voxel grid** | 빠름 | medium | 폭발 (O(N³)) | 해상도 의존 | marching cubes | 메모리 |
| **Point cloud** | 빠름 | fast (점) | 중간 | 구멍 (hole) | poisson recon | 어려움 |
| **SDF / NeuS** | hours | medium | medium | 깔끔한 표면 | trivial | 어려움 |
| **NeRF** | 1~2 day | sec/frame | 작음 (MLP) | SOTA | 어려움 | NeRF-W, D-NeRF |
| **instant-NGP** | **5 sec** | real-time (저해상도) | 큼 (hash grid) | 좋음 | 어려움 | — |
| **Plenoxels** | 11 min | sec/frame | 큼 (~5GB) | 좋음 | 어려움 | — |
| **3DGS** | 30 min | **100+ FPS** | 큼 (GB) | SOTA에 근접 | 어려움 | dynamic 3DGS |
| **Photogrammetry** | hours | very fast | 작음 | view-dep 약함 | trivial | 불가 |

---

# 15. 상황별 최적 선택

```
┌─────────────────────────────────────────────────────────────────┐
│            3D Scene Representation 선택 가이드                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Q1. 실시간 (>30fps) 인터랙션 필요?                              │
│       ├─ YES → 3DGS / instant-NGP                                │
│       └─ NO  → Q2                                                │
│                                                                  │
│   Q2. 메쉬 자산이 필요?                                           │
│       ├─ YES → Photogrammetry + NeuS / Neuralangelo              │
│       └─ NO  → Q3                                                │
│                                                                  │
│   Q3. 장면 규모는?                                                │
│       ├─ 단일 객체 / 소규모 → NeRF / Mip-NeRF / Zip-NeRF         │
│       ├─ 도시 거리 → Block-NeRF / Mega-NeRF                      │
│       └─ unbounded outdoor → Mip-NeRF 360 / Zip-NeRF             │
│                                                                  │
│   Q4. 입력 데이터 조건?                                           │
│       ├─ controlled multi-view → 표준 NeRF 계열                  │
│       ├─ 야생 photo collection → NeRF-W                          │
│       └─ 동적 장면 → D-NeRF, K-Planes, HyperReel                │
│                                                                  │
│   Q5. 모바일 / XR 헤드셋?                                         │
│       ├─ → 3DGS (real-time + 저전력 친화)                        │
│       └─ NeRF는 클라우드 렌더 한정                                │
│                                                                  │
│   Q6. 1회성 high-fidelity (영화/광고)?                            │
│       └─ Zip-NeRF (품질 최우선, 시간 여유)                       │
└─────────────────────────────────────────────────────────────────┘
```

## 15.1 시나리오 별 권고

| 시나리오 | 권장 표현 | 이유 |
|---------|----------|------|
| **고품질 가상 카메라 무브 (영화 후처리)** | Zip-NeRF | 최고 화질, 학습 시간 OK |
| **실시간 VR 시청 콘텐츠** | 3DGS | 100+ FPS @ Quest |
| **AR 측정/공간 매핑** | photogrammetry + NeuS | 정확한 mesh |
| **자율주행 sim 데이터 augment** | Block-NeRF (Waymo), instant-NGP | 도시 스케일 |
| **사용자 캡쳐 → 즉시 시각화** | instant-NGP | 5초 학습 |
| **연구 baseline / ablation** | NeRF / Mip-NeRF | 표준성 |
| **VR 박물관 / 부동산 투어** | 3DGS | 인터랙션 + 화질 |

---

# 16. 베스트 프랙티스 / 안티패턴

## 16.1 데이터 캡처

```
✓ Best Practices
  - 정지 장면에 정지 삼각대 권장
  - 30~200장, 균일 각도 분포
  - overlap 60% 이상 (SfM 안정성)
  - 일관된 노출 (M모드 + 동일 ISO/SS)
  - 그림자 시간이 빠르게 변하지 않을 때
  - RAW 또는 고품질 JPEG
  - 마스크 (배경 분리) 가능하면 같이 준비

✗ Anti-patterns
  - 핸드헬드 흔들림 → motion blur
  - 롤링 셔터 디스토션 (스마트폰 빠른 회전)
  - 강한 specular reflection / 거울
  - 투명한 유리/물 (NeuS 같은 surface 모델은 더 약함)
  - 너무 적은 view (10장 미만은 위험)
  - 자동 노출/화이트밸런스로 사진별 색 다름
```

## 16.2 학습 하이퍼파라미터

```
✓ Best Practices
  - near/far plane을 장면 bbox에 맞춰 타이트하게
  - hierarchical sampling 비율 64+128 (원본) 좋음
  - learning rate exponential decay (5e-4 → 5e-5)
  - batch ray 1024~4096 (GPU memory에 맞춰)
  - PE L=10 position / L=4 direction (원본)
  - Adam optimizer (β=(0.9, 0.999), ε=1e-7)
  - log space에서 sampling (forward-facing은 NDC 사용)

✗ Anti-patterns
  - PE L 너무 크게 → 학습 noise overfit
  - near/far 너무 넓게 → empty space에 capacity 낭비
  - L2 loss 외 perceptual loss 끼우기 (불안정)
  - 너무 일찍 fine network 도입 (coarse 안정 후)
```

## 16.3 운영 / 디버깅

```
✓ Best Practices
  - 학습 중 PSNR 로그 + held-out view rendering 영상
  - depth map 시각화로 σ 분포 점검
  - weight visualization (T_i α_i) 으로 표면 위치 추정
  - COLMAP 결과 매번 매뉴얼 sanity check
  - ablation: PE 끄고 baseline 재현해 본인 setup 검증

✗ Anti-patterns
  - "학습이 안 됨" 의 90%가 COLMAP pose 문제
  - 좌표계 불일치 (OpenCV ↔ OpenGL 헷갈림)
  - scene scale 정규화 빼먹음 (학습 폭발)
  - 한 카메라 view만으로 평가 (overfit 못 잡음)
```

---

# 17. 빅테크 / 산업 사례

## 17.1 Google — NeRF의 모교

```
┌─────────────────────────────────────────────────────────────────┐
│              Google + NeRF                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • NeRF 원논문 6저자 중 4명이 Google Research 소속               │
│      (Mildenhall, Srinivasan, Tancik 박사 후 → Google,           │
│       Barron — Google 본사)                                      │
│                                                                  │
│  • Mip-NeRF 시리즈 모두 Google                                   │
│  • Zip-NeRF (마지막 학술적 정점) Google                          │
│  • NeRF-W (야생 사진 컬렉션) Google                              │
│                                                                  │
│  • Block-NeRF: Waymo street-scale, San Francisco                 │
│      Mission Bay neighborhood, 2.8M images로 도시 단위           │
│                                                                  │
│  • Lumiere / Veo / Genie:                                        │
│      generative video model의 latent 표현에 NeRF/volumetric      │
│      개념 차용 (직접 NeRF는 아니지만)                             │
│                                                                  │
│  • Project Starline:                                             │
│      텔레프레즌스 부스에서 light field display + neural          │
│      reconstruction (NeRF 인접 기술)                              │
└─────────────────────────────────────────────────────────────────┘
```

## 17.2 NVIDIA — 가속의 거장

- **instant-NGP**: SIGGRAPH 2022 best paper, 5초 학습으로 NeRF 대중화
- **Neuralangelo** (CVPR 2023 best paper): NeuS + iNGP, 항공 촬영 high-fidelity mesh
- **GET3D**, **Magic3D**: text-to-3D (NeRF 기반)
- **Omniverse / OpenUSD** 통합: NeRF 모델을 USD 자산으로 import 시도
- **DLSS 4** : neural super resolution, NeRF와 별개지만 같은 neural rendering 흐름

## 17.3 Meta (Reality Labs)

- **Neural Volumes (2019)**: Lombardi et al., Facebook Reality Labs. NeRF 직전 작업
- **HyperReel** (CVPR 2023): 동적 6-DoF 비디오를 위한 sample-efficient NeRF
- **MR Capture R&D**: Quest의 외부 카메라로 룸 캡처 → on-device 렌더 (NeRF 보다는 3DGS 쪽으로 이동 중)

## 17.4 Apple

- **Object Capture** (RoomPlan과 함께 2021 도입): photogrammetry 기반. 아직 NeRF 아님
- **Vision Pro Immersive Video** (2024): Apple Immersive Video는 stereoscopic 180°. 학계의 NeRF/Lumiere-style decoding으로 표현 가능성이 있으나 Apple이 공식적으로 NeRF 채택했다는 발표는 아직 없음
- **Object Capture API** future: WWDC 2024 즈음부터 Gaussian Splatting / NeRF 연구 발표 증가 (Apple ML team)

## 17.5 Tesla

- **Tesla AI Day 2022**: NeRF-style scene reconstruction을 자율주행 simulation 데이터 augmentation에 사용한다고 언급. 실제 기차 운행 데이터에서 photorealistic 가상 장면 생성하여 학습 보강
- 정확히 어떤 변종인지는 비공개. instant-NGP / Block-NeRF 계열 추정

## 17.6 Niantic

- **8th Wall** (2022 인수) + **Lightship** : AR 플랫폼
- **Niantic Spatial Platform** (2024): 사용자 캡쳐 누적 → 도시 단위 3D map. NeRF / Gaussian splatting을 backend representation으로 채택
- *"Large Geospatial Model"* 이라는 용어로 발표 (2024)

## 17.7 학술 인프라 — NerfStudio

```
┌─────────────────────────────────────────────────────────────────┐
│              NerfStudio (UC Berkeley)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tancik 등이 주도한 오픈소스 프레임워크.                          │
│                                                                  │
│  통합 제공:                                                       │
│    • Vanilla NeRF, Mip-NeRF, instant-NGP, NeRF-W,                │
│      TensoRF, Nerfacto (자체 변종), 3DGS                         │
│    • COLMAP / Polycam / RealityCapture / Metashape 입력 지원      │
│    • Web viewer (실시간 인터랙티브 시각화)                        │
│    • Export to USD, OBJ, etc.                                    │
│                                                                  │
│  사실상 학술 NeRF 연구의 표준 환경.                               │
└─────────────────────────────────────────────────────────────────┘
```

## 17.8 XR 디바이스 관점

| 디바이스 | NeRF 위치 |
|---------|----------|
| **Quest 3 / 3S** | on-device NeRF는 어려움. Cloud 렌더 또는 3DGS |
| **Vision Pro** | Apple Immersive Video가 NeRF 인접. 직접 NeRF는 미지원 |
| **Galaxy XR** (Snapdragon XR2+ Gen 2) | Hexagon NPU로 instant-NGP 가속 가능성 있음 |
| **HoloLens 2** | 학술 데모 수준 |
| **Magic Leap 2** | 마찬가지 |

XR 디바이스에서는 **3DGS가 NeRF를 사실상 대체**. NeRF는 *클라우드 렌더 → XR 시청* 또는 *학술 baseline* 위주.

---

# 18. 학술 인용 — 핵심 논문 정리

| 논문 | 저자 / 발표 | 핵심 기여 |
|------|-----------|-----------|
| *Plenoptic Function* | Adelson & Bergen, 1991 | 7D 빛의 함수 정의 — NeRF 사상의 출발 |
| *Light Field Rendering* | Levoy & Hanrahan, **SIGGRAPH 1996** | 4D light field, image-based rendering 시작 |
| *Lumigraph* | Gortler et al., SIGGRAPH 1996 | 동시 발표. surface 가정 light field |
| *Digital Light Field Photography* | Ren Ng, Stanford PhD 2006 | Light field camera, Lytro 창업 |
| *DeepVoxels* | Sitzmann et al., **CVPR 2019** | voxel + neural feature view synthesis 시작 |
| *Scene Representation Networks* | Sitzmann et al., NeurIPS 2019 | coordinate MLP + neural ray marching |
| *Local Light Field Fusion* | Mildenhall et al., **SIGGRAPH 2019** | NeRF 1저자의 직전 작품, MPI 기반 |
| *NeRF* | Mildenhall et al., **ECCV 2020 oral, BPHM** (`arxiv:2003.08934`) | 5D coord MLP + volume rendering + PE |
| *Fourier Features Let Networks Learn HF* | Tancik et al., NeurIPS 2020 spotlight | PE의 NTK 분석, 이론적 정당화 |
| *NeRF in the Wild* | Martin-Brualla et al., 2020 | appearance/transient embedding |
| *NSVF* | Liu et al., NeurIPS 2020 | sparse voxel + MLP |
| *Mip-NeRF* | Barron et al., **ICCV 2021 oral, BPHM** | cone tracing + IPE, anti-aliasing |
| *NeuS* | Wang et al., NeurIPS 2021 spotlight | density 대신 SDF, mesh 가능 |
| *Plenoxels* | Fridovich-Keil et al., 2021 | MLP 0개, sparse voxel + SH |
| *DVGO* | Sun et al., CVPR 2022 | direct voxel grid 학습 15분 |
| *instant-NGP* | Müller et al., **SIGGRAPH 2022 BPA** | multi-resolution hash grid, 5초 학습 |
| *Mip-NeRF 360* | Barron et al., **CVPR 2022 oral** | unbounded scene contraction |
| *Block-NeRF* | Tancik et al., CVPR 2022 | Waymo street-scale |
| *TensoRF* | Chen et al., ECCV 2022 | tensor decomposition |
| *Mega-NeRF* | Turki et al., CVPR 2022 | 항공 도시 스케일 |
| *Neuralangelo* | Li et al., **CVPR 2023 best paper** | NeuS + iNGP, hi-fi mesh |
| *Zip-NeRF* | Barron et al., **ICCV 2023 oral, BP finalist** | Mip-360 + iNGP, 24x 빠름 |
| *3D Gaussian Splatting* | Kerbl et al., **SIGGRAPH 2023 BPA** | NeRF 시대 종결자 |

BPA = Best Paper Award, BPHM = Best Paper Honorable Mention.

---

# 19. 클러스터 내 다른 문서와의 관계

```
┌─────────────────────────────────────────────────────────────────┐
│        XR 4-doc 클러스터 안에서 NeRF의 위치                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   본 문서 (NeRF)                                                 │
│      │                                                           │
│      │  "implicit MLP + volume rendering으로                     │
│      │   3D scene representation 패러다임을 바꿈"                  │
│      │                                                           │
│      ├──→ 3DGS    [3d-gaussian-splatting-3DGS.md]               │
│      │     "explicit Gaussian + rasterization 으로               │
│      │      NeRF를 real-time 영역에서 대체"                       │
│      │                                                           │
│      ├──→ VGGT    [vggt-visual-geometry-grounded-transformer.md]│
│      │     "feed-forward transformer가 카메라 / 깊이 / 점         │
│      │      을 한 번에 추론 → NeRF/3DGS의 입력을 자동화"          │
│      │     (COLMAP + bundle adjustment 의 신경망 후계자)          │
│      │                                                           │
│      └──→ LBS     [laser-beam-steering-LBS-AR디스플레이.md]     │
│            "디스플레이 단의 사촌 — NeRF가 만든 화소를             │
│             AR 안경에 실제 광학적으로 투사하는 메커니즘"          │
│                                                                  │
│   사용자 의도:                                                    │
│      3D scene representation 진화의 분기점들을 한꺼번에           │
│      따라잡아 XR 시스템 전체 그림 (입력 → 표현 → 디스플레이)      │
│      를 머리에 그릴 수 있게 한다.                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 20. 요약

NeRF (Neural Radiance Fields, Mildenhall et al. ECCV 2020) 는 *"장면을 5D 좌표 → (RGB, σ) 함수로 표현하고, 광선을 따라 미분 가능한 volume rendering 적분으로 픽셀을 합성한다"* 는 한 줄짜리 아이디어로 30년 light field 이론을 한꺼번에 신경 표현으로 압축한 작품이다. 핵심 트릭 세 가지 — (1) 5D coordinate MLP, (2) volume rendering integral C = Σ T_i α_i c_i 의 미분 가능성, (3) high-frequency 학습을 가능하게 한 positional encoding γ(p) = [sin(2^kπp), cos(2^kπp)] — 가 모두 동시에 작동했고, 그 정확한 결합이 PSNR 5dB의 도약을 만들었다.

NeRF의 SOTA 시절은 짧았다. 2020.03 등장, 2023.07 3D Gaussian Splatting 공개로 사실상 종결까지 3년 4개월. 그 사이에 Mip-NeRF (anti-aliasing), instant-NGP (5초 학습), Plenoxels (MLP 없는 grid), Mip-NeRF 360 (unbounded), Block-NeRF (도시 스케일), Zip-NeRF (마지막 정점) 등 매 분기 폭발적 진화. 그러나 ray marching의 GPU 친화성 한계 (SIMT divergence + memory bandwidth) 가 결국 explicit primitive + rasterization 의 3DGS에게 real-time 영역을 넘겼다.

XR 시스템 관점에서 NeRF는 *클라우드 렌더 + 학술 baseline + 정밀 mesh extraction (NeuS/Neuralangelo)* 의 영역에 머무른다. 헤드셋 위에서 직접 도는 표현은 [3DGS](3d-gaussian-splatting-3DGS.md)다. 그러나 NeRF가 마련한 *differentiable rendering으로 3D 표현을 학습한다* 는 패러다임 전체는 그대로 살아있고, 3DGS도 그 패러다임 안의 한 변종으로 분류된다. 입력단의 카메라 추정 자동화는 [VGGT](vggt-visual-geometry-grounded-transformer.md)가 담당하고, 출력단의 광학적 투사는 [LBS](laser-beam-steering-LBS-AR디스플레이.md)가 담당하며, NeRF는 그 가운데 *3D 장면의 학습 가능한 표현* 자리를 영구히 차지한다.

---

# 참고 자료

## NeRF 본가

- [NeRF 원논문 arxiv:2003.08934](https://arxiv.org/abs/2003.08934)
- [NeRF 공식 프로젝트 페이지 (Matthew Tancik)](https://www.matthewtancik.com/nerf)
- [NeRF 원본 코드 (bmild/nerf, TensorFlow)](https://github.com/bmild/nerf)

## NeRF 변종

- [Fourier Features Let Networks Learn HF Functions](https://bmild.github.io/fourfeat/)
- [NeRF in the Wild](https://nerf-w.github.io/)
- [Mip-NeRF (ICCV 2021)](https://jonbarron.info/mipnerf/)
- [Mip-NeRF 360 (CVPR 2022)](https://jonbarron.info/mipnerf360/)
- [Plenoxels: Radiance Fields without Neural Networks](https://alexyu.net/plenoxels/)
- [Instant Neural Graphics Primitives (NVIDIA)](https://nvlabs.github.io/instant-ngp/)
- [instant-ngp GitHub (NVlabs)](https://github.com/NVlabs/instant-ngp)
- [Block-NeRF (Waymo)](https://waymo.com/research/block-nerf/)
- [Zip-NeRF (ICCV 2023)](https://jonbarron.info/zipnerf/)
- [NeuS (NeurIPS 2021)](https://lingjie0206.github.io/papers/NeuS/)
- [Neuralangelo (NVIDIA)](https://research.nvidia.com/labs/cosmos/neuralangelo/)

## 후속 / 대안 패러다임

- [3D Gaussian Splatting arxiv:2308.04079](https://arxiv.org/abs/2308.04079)
- [3D Gaussian Splatting 공식 페이지 (Inria)](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)

## 사상적 뿌리

- Adelson & Bergen, *"The Plenoptic Function and the Elements of Early Vision"*, MIT Press, 1991
- Levoy & Hanrahan, *"Light Field Rendering"*, SIGGRAPH 1996
- Ren Ng, *"Digital Light Field Photography"*, Stanford PhD 2006

## 클러스터 내 관련 문서

- [3D Gaussian Splatting (3DGS)](3d-gaussian-splatting-3DGS.md)
- [VGGT — Visual Geometry Grounded Transformer](vggt-visual-geometry-grounded-transformer.md)
- [Laser Beam Steering (LBS) AR 디스플레이](laser-beam-steering-LBS-AR디스플레이.md)
