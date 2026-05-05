---
layout: single
title: "3D Gaussian Splatting (3DGS) 완전가이드"
date: 2026-05-05 23:02:00 +09:00
categories: frontend
excerpt: "3D Gaussian Splatting은 장면을 수많은 3차원 가우시안 프리미티브로 표현해 NeRF보다 훨씬 빠르게 실시간에 가까운 novel view rendering을 가능하게 하는 기법이다."
toc: true
toc_sticky: true
tags: [3dgs, nerf, gaussian, rendering, xr]
source: "/home/dwkim/dwkim/docs/xr/3d-gaussian-splatting-3DGS.md"
---

TL;DR
- 3DGS는 장면을 MLP 내부에 암묵적으로 넣는 대신, 수많은 anisotropic Gaussian으로 명시적으로 저장한다.
- 이 표현 덕분에 ray marching 중심 NeRF보다 학습과 렌더링이 훨씬 빠르며 GPU rasterization 경로를 더 잘 활용한다.
- 최근 XR·spatial capture 문맥에서 3D 재구성과 실시간 뷰어의 실용적 기준점으로 자리 잡고 있다.

## 1. 개념
3D Gaussian Splatting은 3차원 가우시안들의 위치·크기·방향·불투명도·색을 최적화해 장면을 직접 렌더링하는 explicit radiance field 표현이다.

## 2. 배경
NeRF가 장면 표현의 기준을 바꿨지만, 실제 제품과 데모에서는 학습 속도와 렌더링 지연이 여전히 큰 제약이었다. 3DGS는 그 병목을 피해가며 품질과 속도 사이 균형을 크게 끌어올린 대표적인 후속 계열이다.

## 3. 이유
이 기법을 이해해야 왜 최근 spatial capture, Gaussian viewer, mobile 3D reconstruction 파이프라인이 point-like explicit representation으로 이동했는지 설명할 수 있다. 또한 NeRF, mesh, voxel 표현과의 트레이드오프도 더 명확해진다.

## 4. 특징
- anisotropic Gaussian, opacity, spherical harmonics 같은 파라미터를 직접 최적화한다
- tile-based rasterizer와 alpha blending으로 실시간에 가까운 rendering 성능을 낸다
- COLMAP 기반 초기화와 densification 전략이 품질을 크게 좌우한다
- NeRF 대비 explicit 표현이라 후처리·뷰어·엔진 통합이 쉬운 편이다

## 5. 상세 내용

# 3D Gaussian Splatting (3DGS) 완전가이드

> **작성일**: 2026-05-05
> **카테고리**: XR / Graphics / Radiance Fields / Differentiable Rendering / SIGGRAPH
> **트리거**: NeRF 이후의 표준 radiance field representation으로 자리 잡은 3DGS의 수학·학습 알고리즘·변형 모델·산업 적용을 한 번에 정리. cooking-assistant XR 시연용 spatial capture 파이프라인 검토 중 reference로 사용.
> **포함 내용**: 3D Gaussian Splatting, Bernhard Kerbl, Georgios Kopanas, Thomas Leimkühler, George Drettakis, INRIA, MPI Informatik, Université Côte d'Azur, SIGGRAPH 2023, ACM TOG 42(4), arxiv 2308.04079, anisotropic 3D Gaussian, μ ∈ R³, Σ ∈ R^{3x3} positive semi-definite, scaling vector, rotation quaternion, Σ = R S Sᵀ Rᵀ parameterization, opacity α, Spherical Harmonics (SH), SH degree 0~3, view-dependent color, EWA splatting, Matthias Zwicker, Hanspeter Pfister, Surface Splatting SIGGRAPH 2001, Heckbert EWA filter, Pulsar (Lassner & Zollhöfer 2021), Differentiable Surface Splatting (Yifan 2019), Plenoxels, Instant-NGP, Mip-NeRF360, Tanks and Temples, Deep Blending, Blender synthetic, projection Jacobian J, 2D covariance Σ' = J W Σ Wᵀ Jᵀ, tile-based rasterizer, 16x16 tiles, α-blending front-to-back, C = Σ cᵢ αᵢ Π(1-αⱼ), differentiable rendering, ∂L/∂μ, ∂L/∂Σ, ∂L/∂c, ∂L/∂α, COLMAP SfM, sparse point cloud initialization, densification, cloning vs splitting, opacity reset, position_lr, densify_grad_threshold (0.0002), opacity_reset_interval (3000), 30k iterations, Adam optimizer, gsplat (nerfstudio), graphdeco-inria/gaussian-splatting, CUDA tile rasterizer, Vulkan Compute (3DGS.cpp), 4D Gaussian Splatting (Wu CVPR 2024), Dynamic 3D Gaussians (Luiten 2023), 2D Gaussian Splatting (Huang SIGGRAPH 2024), SuGaR (Guédon & Lepetit 2023), Mip-Splatting (Yu CVPR 2024), Scaffold-GS (Lu CVPR 2024), 3DGS-Avatar (Qian CVPR 2024), GauHuman, GART, HUGS (Human Gaussian Splatting), FlashGS (CVPR 2025), RaDe-GS, Compact 3DGS, Mobile-GS (Snapdragon 8 Gen 3), Splatting on the Move (ECCV 2024 Spectacular AI), BAD-Gaussians, MetalSplatter (visionOS), Spatial Fields, Splat Studio (Apple SHARP), Apple Vision Pro 3DGS viewer, Luma AI Interactive Scenes (2023.10), Polycam Gaussian Splat (2024.01), Niantic Spatial Platform, Meta Codec Avatars (Relightable Gaussian Codec Avatars CVPR 2024), Reality Labs Research, NVIDIA 3DGUT, Omniverse, Waymo World Model, Wayve Rig3R, DrivingGaussian, StreetGaussian, S³Gaussian, NeRF↔3DGS 비교, mesh extraction, Marching Cubes, Poisson reconstruction, surface vs volume primitive, anti-aliasing, view-dependent appearance, GPU memory budget, 1M Gaussian ≈ 250MB, PSNR/SSIM/LPIPS

---

# 1. 3DGS 한 줄 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                3D Gaussian Splatting 한 줄 정의                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "장면을 수백만 개의 미분가능한 anisotropic 3D Gaussian으로       │
│   표현하고, GPU tile-based rasterizer로 α-blending 합성하여      │
│   학습·렌더링하는 explicit radiance field 기법"                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  특징:                                                │       │
│  │  ├── 1) Explicit (점/Gaussian) — NeRF는 implicit MLP │       │
│  │  ├── 2) 학습 후 즉시 ≥100 fps @ 1080p (RTX 3090)     │       │
│  │  ├── 3) Differentiable — 모든 파라미터에 gradient    │       │
│  │  ├── 4) Tile-based rasterizer — GPU SIMT 친화        │       │
│  │  ├── 5) View-dependent color via SH degree 0~3       │       │
│  │  ├── 6) Densification — 학습 중 Gaussian 수 자가 조절│       │
│  │  └── 7) PLY로 save/load — 즉시 viewer 호환            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  Kerbl et al. SIGGRAPH 2023 "3D Gaussian Splatting              │
│  for Real-Time Radiance Field Rendering"                         │
│  ACM TOG 42(4), arxiv 2308.04079                                 │
└─────────────────────────────────────────────────────────────────┘
```

NeRF가 "장면을 신경망 가중치 안에 implicit하게 인코딩"한다면, 3DGS는 "장면을 수백만 개의 작은 타원체로 explicit하게 부어버린다(splat)". 이 1줄 차이가 학습 시간 30배·렌더링 속도 200배·메모리 패턴 완전 변화로 이어진다.

NeRF 본체에 대한 설명은 [`nerf-neural-radiance-fields.md`](nerf-neural-radiance-fields.md)에 위임하고, 이 문서는 **explicit 표현으로의 패러다임 전환**과 그 결과로 가능해진 모든 것을 다룬다.

---

# 2. 등장 배경 — 왜 NeRF만으론 부족했나

## 2.1 NeRF의 본질적 GPU 비효율

NeRF는 픽셀마다 ray를 쏘고, 그 ray 위 N개 샘플 점 각각에 대해 8-layer MLP를 forward한다. 이 구조는 GPU의 SIMT(Single Instruction Multiple Thread) 모델과 정면 충돌한다.

```
┌─────────────────────────────────────────────────────────────────┐
│            NeRF가 GPU에서 본질적으로 느린 이유                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  픽셀 1: ray ─→ ●────●─────●──●────────●─→ MLP × 5번             │
│                  └─빈 공간 통과 (낭비)─┘                          │
│  픽셀 2: ray ─→ ●●●●●●●─→ MLP × 7번 (빽빽한 surface)              │
│  픽셀 3: ray ─→ ●─→ MLP × 1번 (배경)                             │
│                                                                  │
│  → 같은 warp 안에서 어떤 thread는 7번, 어떤 thread는 1번 MLP     │
│  → SIMT divergence: 7번 끝날 때까지 모두 대기                    │
│  → 8-layer MLP를 fragment 단위로 호출 = memory random access     │
│  → coarse/fine 두 단계 hierarchical sampling = 2배 비용           │
│                                                                  │
│  결과: vanilla NeRF 학습 1~2일, 렌더링 0.1~1 fps @ 800x800       │
└─────────────────────────────────────────────────────────────────┘
```

Instant-NGP(NVIDIA 2022)가 hash grid로 학습은 5분, 렌더링은 수십 fps까지 끌어올렸지만 **여전히 ray marching 기반**이라 GPU rasterization pipeline의 효율을 살리지 못했다.

## 2.2 점 기반 렌더링의 부활

한편 1990년대~2001년에 정립된 **point-based rendering / surface splatting** 계보가 있었다. mesh가 없고 connectivity 정보 없이 점 집합만으로 표면을 그리는 기법이다.

| 시기 | 사건 |
|------|-----|
| 1985 | Levoy & Whitted "The Use of Points as a Display Primitive" 기술보고서 |
| 2000 | Pfister et al. "Surfels: Surface Elements as Rendering Primitives" SIGGRAPH |
| 2001 | **Zwicker et al. "Surface Splatting" SIGGRAPH** — EWA filter 기반, 후 3DGS의 직접 조상 |
| 2001 | Zwicker et al. "EWA Volume Splatting" IEEE Visualization |
| 2002 | Zwicker et al. "EWA Splatting" IEEE TVCG — 통합 정리본 |

**EWA(Elliptical Weighted Average)** 는 원래 Heckbert 1989 박사논문의 텍스처 anti-aliasing 필터다. Zwicker는 이것을 점 기반 표면 렌더링에 적용해 anisotropic Gaussian 점을 화면에 투영·필터링하는 closed-form 공식을 만들었다. **즉 3DGS의 projection 수학은 이미 2001년에 완성돼 있었다.**

당시 잊힌 이유: (1) GPU rasterization이 mesh 중심으로 발전, (2) **미분가능 학습이라는 발상 자체가 없었음**, (3) 데이터 소스(소비자용 RGB-D, SfM)가 빈약. 22년 후 autograd + COLMAP + CUDA tile rasterizer가 갖춰지자 EWA splatting이 깨어났다.

## 2.3 Differentiable point rendering의 다리

3DGS 직전 5년의 다리들:

| 연도 | 논문 | 기여 |
|------|-----|-----|
| 2019 | Yifan et al. **DSS** (Differentiable Surface Splatting) | EWA splatting + autograd 첫 결합 |
| 2020 | Wiles et al. **SynSin** | feature-based point rendering으로 view synthesis |
| 2021 | Lassner & Zollhöfer **Pulsar** | sphere-based point rasterizer (하지만 isotropic) |
| 2021 | Rückert et al. **ADOP** | neural point-based rendering, 미분가능 |
| 2022 | Kopanas et al. (3DGS 저자 중 하나) "Neural Point Catacaustics" | view-dependent point rendering |

**핵심 통찰**: Gaussian은 (a) projection이 closed-form (또 다른 Gaussian이 됨), (b) scale-rotation 분해로 PSD 보장이 trivial, (c) 적분 정의 깔끔, (d) gradient 깔끔. 점 primitive 후보 중 수학적으로 가장 우아하다.

---

# 3. 역사적 기원 — Kerbl et al. SIGGRAPH 2023

## 3.1 저자와 소속

| 저자 | 소속 | 배경 |
|------|------|-----|
| **Bernhard Kerbl** | INRIA Sophia Antipolis (당시) → TU Wien | 실시간 렌더링·voxel cone tracing |
| **Georgios Kopanas** | INRIA Sophia Antipolis | "Neural Point Catacaustics" 제1저자, 점 기반 렌더링 전문 |
| **Thomas Leimkühler** | MPI Informatik | sampling theory, perceptual rendering |
| **George Drettakis** | INRIA Sophia Antipolis (그룹 리더) | Image-based rendering 권위, GRAPHDECO 그룹 |

INRIA(프랑스 국립 정보·자동화 연구소) Sophia Antipolis 사이트의 GRAPHDECO 그룹과 막스플랑크 정보학연구소의 협업이다. **북미·중국이 아닌 유럽 연구소가 SIGGRAPH 2023 best paper 후보까지 가는 임팩트 논문을 낸 흔치 않은 케이스**.

## 3.2 발표와 즉각적 충격

```
┌─────────────────────────────────────────────────────────────────┐
│            2023.08 — SIGGRAPH Los Angeles 컨벤션센터              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mip-NeRF360 (당시 SOTA)                                         │
│   PSNR: 27.69 dB                                                 │
│   학습: 48시간                                                    │
│   렌더링: 0.06 fps                                                │
│                                                                  │
│  Instant-NGP                                                     │
│   PSNR: 25.59 dB                                                 │
│   학습: 7.5분                                                     │
│   렌더링: ~10 fps                                                 │
│                                                                  │
│  ╔════════════════════════════════════════════════════════╗    │
│  ║  3DGS                                                   ║    │
│  ║   PSNR: 27.21 dB     (Mip-NeRF360과 동급)              ║    │
│  ║   학습: 41분          (Mip-NeRF360 대비 70배)           ║    │
│  ║   렌더링: 134 fps     (Mip-NeRF360 대비 2200배)         ║    │
│  ║                                                          ║    │
│  ║   "real-time at 1080p with state-of-the-art quality"    ║    │
│  ╚════════════════════════════════════════════════════════╝    │
│                                                                  │
│  → 발표 직후 GitHub trending #1                                  │
│  → 2주 내 Twitter/X에 splat embed 폭발적 확산                    │
│  → 3개월 내 Luma AI Interactive Scenes 상용 출시 (2023.10.03)   │
└─────────────────────────────────────────────────────────────────┘
```

Mip-NeRF360 학습 48시간 → 41분이라는 **70배 가속**과 0.06 fps → 134 fps라는 **2200배 렌더링 가속**은 이 분야에서 보기 드문 폭이다. 발표 후 6개월 만에 NeRF 후속 연구의 무게중심이 3DGS로 이동했다.

## 3.3 라이선스 함정

INRIA reference 구현(graphdeco-inria/gaussian-splatting)은 **non-commercial 라이선스**다. 상업 사용은 INRIA에 별도 라이선스를 받아야 한다. 이 때문에:
- **gsplat** (Apache-2.0, nerfstudio가 유지) — 상업 친화적 재구현이 빠르게 확산
- **Brush, Splatfacto, GauStudio** 등 MIT/Apache 라이선스 fork 다수
- 상용 회사(Luma, Polycam, Niantic)는 자체 구현 또는 gsplat 기반

---

# 4. 용어 사전

## 4.1 표현 (Representation)

| 용어 | 의미 |
|------|-----|
| **3D Gaussian** | 3D 공간의 anisotropic Gaussian 분포. 평균 μ ∈ R³, 공분산 Σ ∈ R^{3x3} (대칭 PSD) |
| **Splat** | 화면에 "철퍼덕" 부어진 한 개의 Gaussian 영상. 동사로도 명사로도 사용 |
| **Anisotropic** | 방향별 다른 scale. NeRF voxel은 isotropic ball, 3DGS는 늘려진 타원체 |
| **Opacity α** | 0~1 스칼라. sigmoid 활성화로 학습 |
| **Spherical Harmonics (SH)** | 구면 위 함수의 Fourier basis. degree 0(상수)~3(16계수)로 view-dependent color 인코딩 |
| **SH degree** | 0=DC만(3채널), 1=4계수(12), 2=9계수(27), 3=16계수(48). 단계적으로 올림 |
| **Scale (s)** | log-space 3D 벡터. exp(s) = 실제 축 길이 |
| **Rotation (q)** | 단위 quaternion. Σ = R(q) S(s) S(s)ᵀ R(q)ᵀ로 PSD 자동 보장 |

핵심 파라미터화:
```
Σ = R · S · Sᵀ · Rᵀ
  R = quaternion → 3x3 rotation matrix
  S = diag(exp(s_x), exp(s_y), exp(s_z))
```

이렇게 하면 R이 항상 회전, exp(s)가 항상 양수라 **Σ가 자동으로 positive semi-definite**. 직접 6개 자유도 학습보다 안정적.

## 4.2 렌더링 (Rendering)

| 용어 | 의미 |
|------|-----|
| **EWA Splatting** | Zwicker 2001. 3D Gaussian을 화면 공간 2D Gaussian으로 closed-form 투영 |
| **Projection Jacobian J** | 카메라 좌표→스크린 좌표 변환의 1차 근사 (perspective는 nonlinear) |
| **2D covariance Σ'** | Σ' = J W Σ Wᵀ Jᵀ (W는 view rotation). 화면 공간 ellipse |
| **Tile-based rasterizer** | 화면을 16×16 픽셀 타일로 분할, 타일별로 겹치는 Gaussian만 정렬·블렌딩 |
| **α-blending** | front-to-back 합성. C = Σ cᵢ αᵢ Π_{j<i}(1-αⱼ) |
| **Depth sort** | 카메라에서 가까운 순으로 splat 정렬 (정확한 over operator를 위해) |
| **T (transmittance)** | 누적 투과도 Π(1-αⱼ). 0이 되면 그 픽셀은 더 처리 안 함 |

## 4.3 학습 (Training)

| 용어 | 의미 |
|------|-----|
| **COLMAP** | Structure-from-Motion 도구. RGB 이미지 → 카메라 포즈 + sparse point cloud |
| **Sparse init** | COLMAP의 sparse points를 첫 Gaussian의 평균 μ로 사용 |
| **Densification** | 학습 중 gradient가 큰 Gaussian을 clone/split하여 복제 |
| **Cloning** | 작은 Gaussian (under-reconstructed)을 그대로 복제해 같은 자리에 추가 |
| **Splitting** | 큰 Gaussian (over-reconstructed)을 둘로 쪼개고 scale을 1.6으로 나눔 |
| **Pruning** | opacity α < 0.005인 Gaussian 제거 |
| **Opacity reset** | 주기적으로(기본 3000 iter) 모든 α를 작게 리셋. floater 제거 |
| **`densify_grad_threshold`** | densification 트리거 gradient 임계 (기본 0.0002) |
| **Adam** | 1차 모멘텀 + RMSProp 결합 옵티마이저. 모든 파라미터에 사용 |
| **L1 + D-SSIM loss** | L1 + 0.2 × (1-SSIM). 픽셀 절대오차 + 구조 유사도 |

## 4.4 도구 / 구현

| 용어 | 의미 |
|------|-----|
| **graphdeco-inria/gaussian-splatting** | INRIA 공식 reference. PyTorch + 자체 CUDA. **non-commercial** |
| **gsplat** | nerfstudio-project의 Apache-2.0 재구현. 4× 메모리, 15% 빠름 |
| **3DGS.cpp** | Vulkan Compute 기반 cross-platform viewer. iOS/visionOS/macOS/Win/Linux |
| **MetalSplatter** | Swift/Metal viewer. Apple Vision Pro AR 합성 지원 |
| **Brush** | Rust + WebGPU. 브라우저에서도 학습 |
| **Nerfstudio Splatfacto** | 통합 학습 인프라 안의 3DGS 구현 |

---

# 5. 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────┐
│                  3DGS 직전·이후 5년                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 2001  Zwicker — Surface Splatting / EWA Volume Splatting         │
│        └─ 3DGS 수학의 직접 조상. 22년 휴면                       │
│                                                                  │
│ 2019  Yifan — Differentiable Surface Splatting (DSS)             │
│ 2020  Mildenhall — NeRF (ECCV best paper)                        │
│ 2021  Lassner & Zollhöfer — Pulsar (sphere-based, isotropic)    │
│ 2021  Fridovich-Keil — Plenoxels (voxel + SH, no MLP)           │
│ 2022  Müller — Instant-NGP (hash grid, 5분 학습)                 │
│ 2022  Barron — Mip-NeRF360 (anti-aliased NeRF)                  │
│                                                                  │
│ 2023.08 ▸ Kerbl — 3D Gaussian Splatting (SIGGRAPH 2023)         │
│ 2023.10 ▸ Luiten — Dynamic 3D Gaussians (시간축 도입)           │
│ 2023.10 ▸ Luma AI — Interactive Scenes 상용 출시                │
│ 2023.11 ▸ Guédon — SuGaR (mesh extraction)                      │
│ 2023.11 ▸ Yu — Mip-Splatting (anti-aliasing)                    │
│ 2023.11 ▸ Lu — Scaffold-GS (anchor-based, 메모리 절약)          │
│ 2023.12 ▸ Wu — 4D Gaussian Splatting (HexPlane deformation)     │
│ 2023.12 ▸ Saito — Relightable Gaussian Codec Avatars (Meta)     │
│ 2023.12 ▸ Qian — 3DGS-Avatar (CVPR 2024)                        │
│                                                                  │
│ 2024.01 ▸ Polycam — Gaussian Splat 정식 출시                    │
│ 2024.03 ▸ Huang — 2D Gaussian Splatting (geometric accuracy)    │
│ 2024.03 ▸ Seiskari — Gaussian Splatting on the Move (ECCV)      │
│ 2024.06 ▸ DrivingGaussian / StreetGaussian (자율주행)           │
│ 2024.08 ▸ FlashGS (4× 가속, 49% 메모리 절감)                    │
│ 2024.12 ▸ Google Android XR 발표 — 3DGS asset 1급 시민 후보     │
│                                                                  │
│ 2025    ▸ Apple Vision Pro 3DGS viewer 다수 출시                 │
│         ▸ Mobile-GS (Snapdragon 8 Gen 3, 116 fps@1600)          │
│         ▸ Apple SHARP (on-device image→splat)                    │
│         ▸ 3DGUT (NVIDIA, gsplat에 통합)                         │
│ 2026    ▸ Waymo World Model — 3DGS의 한계(reconstructive only)  │
│           극복하려 generative + reconstructive 결합 트렌드        │
└─────────────────────────────────────────────────────────────────┘
```

**3년 만에 NeRF 후속 연구의 80% 이상이 3DGS 기반으로 이동**한 사례는 컴퓨터 그래픽스 역사에서 드물다. NeRF가 SOTA에서 SOTA-replaced되기까지 정확히 3년(2020.08 ECCV → 2023.08 SIGGRAPH).

---

# 6. 핵심 수학

## 6.1 3D Gaussian의 정의

```
G(x; μ, Σ) = exp( -1/2 · (x - μ)ᵀ Σ⁻¹ (x - μ) )
```

스케일 인자(앞에 곱해지는 1/((2π)^{3/2}|Σ|^{1/2}))는 **3DGS에서는 생략**한다 — 어차피 opacity α를 따로 학습하므로 정규화 불필요.

PSD 보장을 위한 파라미터화:
```
Σ = R(q) · S(s) · S(s)ᵀ · R(q)ᵀ

q: unit quaternion (4D, 정규화)
s: log-scale (3D, exp 활성화)
S(s) = diag(exp(s_x), exp(s_y), exp(s_z))
R(q): quaternion → 3x3 rotation matrix
```

이 분해의 장점:
1. **PSD 자동 보장** — Σ⁻¹ 계산 시 numeric issue 없음
2. **gradient 안정** — q, s 따로 학습 가능
3. **해석 가능** — s는 타원체 반지름, q는 회전

## 6.2 EWA 투영 — 3D → 2D Gaussian

EWA splatting의 정수: **3D Gaussian을 화면 공간으로 투영하면 또 다른 2D Gaussian이 된다 (1차 근사)**.

```
카메라 변환 : x_cam = W · x_world         (W: view rotation)
원근 투영   : x_screen = π(x_cam)         (nonlinear!)

원근이 nonlinear이므로 1차 Taylor 근사:
J = ∂π/∂x_cam |_{x_cam = μ_cam}    (3x2 또는 2x3 Jacobian)

2D 공분산 :  Σ' = J · W · Σ · Wᵀ · Jᵀ    (2x2)

화면 위 픽셀 p에서의 영향:
G_2D(p) = exp( -1/2 · (p - μ')ᵀ Σ'⁻¹ (p - μ') )
```

이게 EWA splatting의 핵심 공식이다. Zwicker 2001 이후 변하지 않았다. 3DGS가 한 일은 이 공식의 모든 변수에 대한 gradient를 CUDA로 손코딩한 것.

```
┌─────────────────────────────────────────────────────────────────┐
│                3D Gaussian Projection 시각화                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   World space          Camera space        Screen space          │
│                                                                  │
│      ⬭ 3D ellipsoid                          ⬭ 2D ellipse        │
│       \                                     /                    │
│        \                                   /                     │
│         W·x                            π(x_cam)                  │
│          \                               /                       │
│           ↓                             ↓                        │
│         ⬭ rotated         →        ⬭ projected (J·W로 근사)     │
│                                                                  │
│   μ ∈ R³            μ_cam = W·μ          μ' = π(μ_cam)          │
│   Σ ∈ R^{3x3}       Σ_cam = WΣWᵀ         Σ' = JΣ_cam Jᵀ          │
│                                                                  │
│   원근 투영의 nonlinearity는 Jacobian J 1차 근사로 흡수           │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 α-blending (Volume rendering equation의 이산화)

NeRF의 volume rendering equation:
```
C = ∫ T(t) · σ(t) · c(t) dt
T(t) = exp( -∫₀ᵗ σ(s) ds )
```

3DGS는 이걸 **N개 splat의 이산 합**으로 근사:
```
C_pixel = Σᵢ cᵢ · αᵢ · Πⱼ<ᵢ (1 - αⱼ)
```

여기서:
- `αᵢ = α_param,i · G_2D,i(pixel)` — 학습된 opacity × 픽셀 위치의 Gaussian 값
- `cᵢ = SH(view_direction; SH_coeffs_i)` — view-dependent color (SH 평가)
- 합산 순서: **카메라에서 가까운 순(front-to-back)**

이게 OpenGL/DirectX의 standard "over" operator와 동일하다 — **전통 GPU rasterization pipeline에 자연스럽게 매핑**된다는 게 핵심.

## 6.4 미분가능성 — gradient 흐름

학습 가능 파라미터:
- `μ` (3): 위치
- `q` (4): rotation quaternion
- `s` (3): log-scale
- `α` (1): opacity (sigmoid 전 logit)
- `SH` (3 × (1, 4, 9, 16) = 3, 12, 27, 48): view-dependent color

손실 L에 대한 gradient는 손코딩된 CUDA backward kernel로 계산:
```
∂L/∂C_pixel  →  ∂L/∂cᵢ, ∂L/∂αᵢ
∂L/∂αᵢ       →  ∂L/∂Σ' → ∂L/∂Σ → ∂L/∂s, ∂L/∂q
                ∂L/∂μ' → ∂L/∂μ
∂L/∂cᵢ       →  ∂L/∂SH (view-dependent eval의 chain rule)
```

PyTorch autograd로 자동 미분이 안 되는 이유: tile-based rasterizer 내부의 정렬·alpha-blending 누적 루프는 표준 op이 아니다. **3DGS 코어의 절반은 손으로 짠 CUDA kernel**.

## 6.5 Tile-based rasterizer

```
┌─────────────────────────────────────────────────────────────────┐
│              Tile-based Rasterizer (CUDA kernel)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1) Frustum culling                                         │
│   N_total Gaussian → N_visible (frustum 안의 것만)               │
│                                                                  │
│  Step 2) 2D projection                                           │
│   각 visible Gaussian → (μ', Σ') 2D                              │
│                                                                  │
│  Step 3) Tile assignment                                         │
│   Image를 16x16 픽셀 tile로 분할                                  │
│   각 Gaussian의 99% confidence ellipse가 덮는 모든 tile에 등록    │
│   key = (tile_id, depth)                                         │
│                                                                  │
│  Step 4) Sort                                                    │
│   key를 radix sort (CUDA cub::DeviceRadixSort)                   │
│   결과: 각 tile마다 depth 순으로 정렬된 Gaussian list             │
│                                                                  │
│  Step 5) Per-tile blending (block당 1 tile)                      │
│   for each pixel in tile (256개, 한 thread):                     │
│     T = 1.0; C = 0                                               │
│     for Gaussian in sorted_list:                                  │
│       α = α_param * exp(-1/2 (p-μ')ᵀ Σ'⁻¹ (p-μ'))                │
│       if α < 1/255: continue                                     │
│       c = SH_eval(view_dir, SH_coeffs)                           │
│       C += T * α * c                                             │
│       T *= (1 - α)                                               │
│       if T < 0.0001: break    ← early termination                │
│                                                                  │
│  → 같은 tile의 모든 픽셀이 같은 Gaussian list 공유 (cache 친화)  │
│  → block 내 thread가 동시에 같은 Gaussian 읽음 (coalesced read) │
│  → SIMT divergence 거의 없음                                     │
└─────────────────────────────────────────────────────────────────┘
```

NeRF의 ray marching이 픽셀별 독립 sampling으로 SIMT divergence를 일으키는 반면, 3DGS는 **tile 단위로 동일한 데이터를 모든 thread가 읽는 구조**라 GPU 메모리 hierarchy를 거의 이상적으로 활용한다. 이게 200배 가속의 본질.

---

# 7. 학습 알고리즘 — Densification이 모든 것

## 7.1 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│                  3DGS Training Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: 수십~수백 장의 RGB 이미지                                 │
│   │                                                              │
│   ▼                                                              │
│  COLMAP                                                          │
│   ├── feature matching (SIFT)                                    │
│   ├── incremental SfM                                            │
│   └── Output: camera poses + sparse 3D points (~수만 점)         │
│   │                                                              │
│   ▼                                                              │
│  Initialization                                                  │
│   ├── 각 sparse point를 1 Gaussian으로                           │
│   ├── μ = point 위치                                             │
│   ├── s = (mean nearest-neighbor distance) / 3                   │
│   ├── q = identity                                               │
│   ├── α = 0.1                                                    │
│   └── SH = point 색상 (degree 0만)                               │
│   │                                                              │
│   ▼                                                              │
│  Training Loop (30,000 iterations)                               │
│   for iter in range(30000):                                      │
│     1. 카메라 1대 random sample                                  │
│     2. forward: tile rasterizer → 합성 이미지 Î                  │
│     3. loss = (1-λ)·L1(Î, I_gt) + λ·D-SSIM(Î, I_gt)  [λ=0.2]   │
│     4. backward: ∂L/∂(μ, q, s, α, SH) (CUDA kernel)              │
│     5. Adam step                                                  │
│                                                                  │
│     # Densification (100~15000 iter, 100 iter마다)               │
│     6. ‖∂L/∂μ_2D‖ > 0.0002인 Gaussian 식별                       │
│        ├── max(s) < threshold: clone (그대로 복제)               │
│        └── max(s) ≥ threshold: split (둘로, scale /= 1.6)        │
│     7. α < 0.005인 Gaussian 삭제                                 │
│                                                                  │
│     # Opacity reset (3000 iter마다)                              │
│     8. 모든 α를 작은 값 (0.01)으로 리셋 → 다시 학습                │
│                                                                  │
│     # SH degree warmup (1000 iter마다 +1)                        │
│     9. SH degree 0 → 1 → 2 → 3                                   │
│   │                                                              │
│   ▼                                                              │
│  Output: 학습된 Gaussian 집합 (보통 1M~5M개)                     │
│   .ply 파일로 저장 (또는 .splat 압축 포맷)                        │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Densification 휴리스틱 — 학습의 90%

```
┌─────────────────────────────────────────────────────────────────┐
│           Densification: Cloning vs Splitting                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  판정 기준: ‖∂L/∂μ_2D‖ > 0.0002                                  │
│  (해당 Gaussian의 화면 평균 위치 gradient가 큼 = 모자람)          │
│                                                                  │
│                                                                  │
│  ┌──── Under-reconstructed (작은 Gaussian, 디테일 부족) ────┐   │
│  │                                                            │   │
│  │         ⬭                          ⬭                      │   │
│  │      (작은 점 1개)              (같은 자리에 2개)         │   │
│  │   gradient ↑↑↑       →                                    │   │
│  │   max(s) 작음                  CLONE (복제)               │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──── Over-reconstructed (큰 Gaussian, surface 못 따라감) ──┐   │
│  │                                                            │   │
│  │       ⬮⬮⬮                       ⬭   ⬭                    │   │
│  │   (긴 타원 1개)              (둘로 쪼개고 scale /= 1.6)   │   │
│  │   gradient ↑↑↑       →                                    │   │
│  │   max(s) 큼                    SPLIT                       │   │
│  │                                  새 위치는 PDF에서 sample  │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──── Useless (opacity 거의 0) ──────────────────────────────┐   │
│  │                                                            │   │
│  │       ⬭ (α<0.005)              ✗                          │   │
│  │                       →     PRUNE (삭제)                  │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Densification = 3DGS의 진짜 마법, 그리고 진짜 한계**:
- 잘 동작하면: COLMAP 수만 점 → 학습 후 1~5M Gaussian으로 자연스럽게 성장
- 안 동작하면: 영원히 under-reconstructed (블러), 또는 floater가 영원히 남음

이게 NeRF에 없는 메커니즘이다. NeRF는 MLP 가중치 안에서 모든 게 일어나므로 "어떤 영역에 capacity를 더 쓸지"를 자동으로 모른다 (그래서 Mip-NeRF360처럼 contraction 같은 트릭이 필요).

## 7.3 Opacity Reset — Floater 제거의 핵심

학습 초기에 만들어진 큰 floater(공중에 떠있는 잘못된 Gaussian)는 gradient가 작아져서 좀처럼 사라지지 않는다. 해결책: **3000 iter마다 모든 α를 강제로 0.01로 리셋**하고 학습 재개.

진짜 surface에 있는 Gaussian은 다시 α가 빠르게 회복되지만, floater는 회복하지 못하고 다음 prune 사이클에 제거된다.

```
iter 0       3000      6000      9000      ...    30000
 │            │         │         │              │
 ●●●●●●●     ↓rest    ●●●●●●●   ↓rest          ●●●●●●●
 floater↗   α=0.01   floater    α=0.01         (clean)
            ↓             ↘                       ↑
         재학습          floater 회복 못함     pruning
```

## 7.4 SH Degree Warmup

```
iter      0~1000      ~2000       ~3000       ~end
SH deg    0 (DC)      1           2           3 (full)
계수/색상   1           4           9           16
```

처음부터 16계수 학습하면 view-dependent을 노이즈로 fitting해버림. 단계적으로 풀어서 먼저 큰 색상부터 잡고 점차 view-dependence 추가.

## 7.5 기본 하이퍼파라미터 (INRIA reference)

| 파라미터 | 기본값 | 의미 |
|---------|------|-----|
| `iterations` | 30000 | 총 학습 step |
| `position_lr_init` | 0.00016 | μ 초기 학습률 (exponential decay) |
| `position_lr_final` | 0.0000016 | μ 최종 학습률 |
| `position_lr_max_steps` | 30000 | LR decay 종료 step |
| `feature_lr` | 0.0025 | SH DC 학습률 |
| `opacity_lr` | 0.05 | α 학습률 |
| `scaling_lr` | 0.005 | s 학습률 |
| `rotation_lr` | 0.001 | q 학습률 |
| `densify_grad_threshold` | 0.0002 | densify 트리거 gradient 임계 |
| `densification_interval` | 100 | densify 주기 |
| `opacity_reset_interval` | 3000 | opacity reset 주기 |
| `densify_from_iter` | 500 | densify 시작 |
| `densify_until_iter` | 15000 | densify 종료 |
| `lambda_dssim` | 0.2 | D-SSIM loss 가중치 |
| `sh_degree` | 3 | 최대 SH degree |

이 값들은 **거의 그대로 쓸 수 있다 — 튜닝이 필요한 건 보통 `densify_grad_threshold` 정도**. 더 sparse한 결과가 필요하면 0.0004로 올림 (메모리 절약).

---

# 8. PyTorch-ish 의사코드

## 8.1 Forward Pass

```python
class GaussianModel:
    def __init__(self, num_init):
        self.mu      = nn.Parameter(torch.randn(num_init, 3))      # positions
        self.scale   = nn.Parameter(torch.zeros(num_init, 3))      # log-scale
        self.rot     = nn.Parameter(torch.tensor([1,0,0,0])
                                    .repeat(num_init, 1))          # quaternion
        self.opacity = nn.Parameter(inverse_sigmoid(0.1*ones(num_init, 1)))
        self.sh_dc   = nn.Parameter(torch.zeros(num_init, 1, 3))   # DC term
        self.sh_rest = nn.Parameter(torch.zeros(num_init, 15, 3))  # higher SH

    def get_covariance(self):
        R = quaternion_to_matrix(F.normalize(self.rot))
        S = torch.diag_embed(torch.exp(self.scale))
        L = R @ S
        return L @ L.transpose(-1, -2)   # Σ = L Lᵀ, PSD 보장


def render(gaussians: GaussianModel,
           camera: Camera,
           image_size=(H, W)) -> Tensor:
    # 1. Frustum culling
    visible_mask = in_frustum(gaussians.mu, camera)
    mu = gaussians.mu[visible_mask]
    Sigma_3d = gaussians.get_covariance()[visible_mask]

    # 2. 3D → 2D projection (EWA)
    mu_cam = camera.W @ mu                            # view space
    mu_2d  = camera.K @ project(mu_cam)               # screen space
    J      = projection_jacobian(mu_cam, camera.K)    # 2x3
    W      = camera.W[:3, :3]
    Sigma_2d = J @ W @ Sigma_3d @ W.T @ J.T           # 2x2

    # 3. Per-Gaussian color (SH evaluation)
    view_dir = F.normalize(mu - camera.position)
    color = eval_sh(view_dir, gaussians.sh_dc, gaussians.sh_rest)

    # 4. Tile assignment + sort + alpha-blend (CUDA kernel)
    image = cuda_tile_rasterizer.forward(
        means_2d=mu_2d,
        cov_2d=Sigma_2d,
        opacity=torch.sigmoid(gaussians.opacity),
        color=color,
        depth=mu_cam[:, 2],
        image_size=image_size,
        tile_size=16,
    )
    return image


# 학습 루프
for iter in range(30000):
    cam, gt_image = next(train_loader)
    rendered = render(gaussians, cam)
    L = (1 - 0.2) * F.l1_loss(rendered, gt_image) \
      + 0.2 * (1 - ssim(rendered, gt_image))
    L.backward()
    optimizer.step()
    optimizer.zero_grad()

    if iter > 500 and iter < 15000 and iter % 100 == 0:
        densify_and_prune(gaussians, grad_threshold=0.0002)
    if iter % 3000 == 0:
        reset_opacity(gaussians, value=0.01)
    if iter > 0 and iter % 1000 == 0 and current_sh_degree < 3:
        current_sh_degree += 1
```

## 8.2 Densification

```python
def densify_and_prune(g: GaussianModel, grad_threshold: float):
    # 누적된 화면 공간 gradient 평균
    grads = g.xyz_gradient_accum / g.denom

    # Clone (작은 것)
    clone_mask = (grads.norm(dim=-1) >= grad_threshold) \
               & (g.scale.exp().max(dim=-1) <= scale_threshold)
    clone(g, clone_mask)

    # Split (큰 것)
    split_mask = (grads.norm(dim=-1) >= grad_threshold) \
               & (g.scale.exp().max(dim=-1) > scale_threshold)
    split(g, split_mask, n=2)
    # 새 위치는 원래 Gaussian의 PDF에서 sample
    # 새 scale은 원래의 1/1.6

    # Prune (투명한 것)
    prune_mask = torch.sigmoid(g.opacity) < 0.005
    remove(g, prune_mask)
```

핵심은 `xyz_gradient_accum` — 매 iteration의 화면 공간 위치 gradient를 누적해서 "이 Gaussian이 얼마나 자주, 얼마나 강하게 미분됐는지"를 추적한다.

---

# 9. NeRF ↔ 3DGS 비교

| 측면 | NeRF (Mildenhall 2020) | 3DGS (Kerbl 2023) |
|------|------------------------|-------------------|
| **표현** | Implicit (MLP 가중치) | Explicit (Gaussian 집합) |
| **Primitive** | 연속 함수 σ(x), c(x, d) | discrete anisotropic Gaussian |
| **Forward** | Ray marching + N point MLP | Tile rasterize + α-blend |
| **GPU 친화성** | ✗ SIMT divergence, random access | ✓ Tile coalescing, linear access |
| **학습 시간** | 1~2일 (vanilla), 5분 (Instant-NGP) | 30분~1시간 |
| **렌더링 속도** | 0.06~10 fps | 100~300+ fps |
| **메모리 (장면당)** | 5~100MB (MLP 가중치) | 200MB~2GB (Gaussian 수에 비례) |
| **Editing** | 거의 불가 (가중치 수정 어려움) | 쉬움 (Gaussian 추가/이동/삭제) |
| **Mesh 추출** | Marching Cubes from σ field | 어려움 (volume primitive) → SuGaR/2DGS 필요 |
| **Anti-aliasing** | Mip-NeRF로 해결 | Mip-Splatting으로 해결 |
| **Dynamic 장면** | D-NeRF, K-Planes 등 | 4D Gaussian Splatting |
| **저장** | model.pt (MLP) | scene.ply (점 클라우드) |
| **Composability** | 어려움 | 쉬움 (point cloud처럼 합성) |
| **Light editing** | ✗ (relighting 별도 연구) | △ (Relightable GCA 등) |
| **모바일/웹** | △ (Instant-NGP 일부) | ◎ (3DGS.cpp/MetalSplatter) |

**한 마디로**: NeRF는 "장면을 함수로 학습", 3DGS는 "장면을 데이터 구조로 학습". 함수는 query당 비싸고, 데이터 구조는 미리 정렬해두면 query가 싸다.

---

# 10. 3DGS 변형 매트릭스

## 10.1 목적별 분기

| 목적 | 권장 변형 | 핵심 아이디어 |
|------|----------|------------|
| **순수 view synthesis** | vanilla 3DGS | 원논문 그대로 |
| **Mesh가 필요 (게임/VFX)** | SuGaR / 2DGS | surface-aligned regularization + Poisson |
| **Aliasing/zoom 문제** | Mip-Splatting | 3D smoothing filter + 2D Mip filter |
| **메모리 절약** | Scaffold-GS / Compact 3DGS | anchor + neural Gaussian / SH 양자화 |
| **인간 아바타** | 3DGS-Avatar / GauHuman / GART | SMPL canonical + LBS deformation |
| **동적 장면 (RGB video)** | 4D Gaussian Splatting | HexPlane deformation field |
| **다중 카메라 동기 캡처** | Dynamic 3D Gaussians (Luiten) | 시간별 Gaussian 추적 |
| **모바일 렌더링** | Mobile-GS / 3DGS.cpp | depth-aware OIT, Vulkan compute |
| **Motion blur/rolling shutter** | Splatting on the Move | VIO 기반 노출시간 적분 |
| **카메라 포즈 부정확** | BAD-Gaussians | 포즈를 같이 최적화 |
| **자율주행 거리 장면** | DrivingGaussian / StreetGaussian / S³Gaussian | 동적/정적 분리, 4D SH |
| **대규모 4K 렌더** | FlashGS | CUDA pipeline 재설계, 4× 가속 |
| **이미지 1장에서 splat** | Apple SHARP | feed-forward neural net |

## 10.2 SuGaR vs 2DGS — Mesh 추출의 두 길

**SuGaR (Guédon & Lepetit 2023)**
- Vanilla 3DGS 학습 후 **regularization term 추가 학습** (Gaussian이 surface와 정렬되도록)
- 정렬된 Gaussian의 level set에서 **Poisson reconstruction**으로 mesh 추출
- 옵션: mesh에 binding된 Gaussian으로 refinement
- **장점**: 기존 3DGS 결과 활용 가능, 분~분 단위 처리
- **단점**: 2단계 학습, regularization이 view synthesis quality 약간 저하

**2D Gaussian Splatting (Huang et al. SIGGRAPH 2024)**
- Gaussian primitive 자체를 3D ellipsoid → **2D oriented planar disk**로 변경
- 본질적으로 surface 표현이라 view-consistent normal/depth
- depth distortion + normal consistency loss 추가
- **장점**: 원리적으로 깨끗한 mesh, view-consistent geometry
- **단점**: 처음부터 새 표현으로 학습, vanilla 3DGS와 호환 안 됨

```
┌─────────────────────────────────────────────────────────────────┐
│         왜 vanilla 3DGS에서 mesh가 안 나오는가                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  3D Gaussian은 volume primitive (안이 차 있음)                    │
│   ⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭   ← 표면처럼 보여도 실제로는                    │
│   ⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭     깊이 방향으로 두께 있음                     │
│   ⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭⬭                                                │
│                                                                  │
│  Marching Cubes를 적용하려면:                                     │
│   - 어떤 iso-surface? (α의 임계?)                                 │
│   - normal direction이 일관되지 않음                              │
│   - Gaussian이 view에 따라 다르게 보이도록 학습됨                 │
│   - → mesh가 noisy하고 over-thick                                │
│                                                                  │
│  SuGaR / 2DGS의 해법:                                             │
│   - 학습 단계에서 "Gaussian = thin surface"로 유도                │
│   - normal과 depth의 view-consistency regularize                 │
│   - 결과: marching cubes/Poisson에 적합한 분포                    │
└─────────────────────────────────────────────────────────────────┘
```

## 10.3 Mip-Splatting의 anti-aliasing

3DGS는 학습 카메라의 sampling rate에 묶여 있다. 학습보다 **줌인하면 dilation artifacts** (타원체가 너무 커보이는 elastic blur), **줌아웃하면 aliasing** (Moiré, 깜빡임).

해결:
1. **3D smoothing filter**: 학습 시 모든 입력 view의 최대 sampling frequency를 기준으로 Gaussian의 최소 크기를 강제 (Nyquist)
2. **2D Mip filter**: 화면 공간에서 dilation 대신 box filter 시뮬레이션

이게 들어가야 zoom-in/out에서 안정적인 multi-scale 렌더링이 된다.

## 10.4 Dynamic / 4D 변형

**Dynamic 3D Gaussians (Luiten et al. 2023.10)**
- 다중 카메라 동기 캡처 가정 (Panoptic Studio 류)
- 첫 프레임에서 3DGS 학습 → 다음 프레임에서 같은 Gaussian의 위치/회전만 업데이트
- 결과: 시간에 걸친 dense 3D motion = "tracking by reconstruction"

**4D Gaussian Splatting (Wu et al. CVPR 2024)**
- 단일 카메라 RGB video도 처리
- canonical 3D Gaussian + **HexPlane**(4D voxel decomposition)로 deformation field 표현
- timestamp 입력 → MLP가 각 Gaussian의 (μ, q, s) deformation 예측
- RTX 3090에서 800×800 @ **82 fps**

---

# 11. GPU 메모리 budget

```
┌─────────────────────────────────────────────────────────────────┐
│              1 Gaussian의 메모리 (FP32)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   μ (position)         3 × 4 bytes  =  12 B                      │
│   q (rotation)         4 × 4 bytes  =  16 B                      │
│   s (log-scale)        3 × 4 bytes  =  12 B                      │
│   α (opacity)          1 × 4 bytes  =   4 B                      │
│   SH (degree 3)       48 × 4 bytes  = 192 B                      │
│                                       ─────                      │
│                                       236 B / Gaussian           │
│                                                                  │
│   + Adam moments (×2): 2 × 236 B    = 472 B (학습 시만)         │
│                                                                  │
│   학습 중 1 Gaussian ≈ 700 B                                     │
│   inference만        ≈ 236 B                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              실제 장면 메모리 예시                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Garden (Mip-NeRF360)   1.0 M Gaussian   ~250 MB inference     │
│   Bicycle                3.5 M Gaussian   ~830 MB inference     │
│   Truck (T&T)            2.0 M Gaussian   ~470 MB inference     │
│   Drjohnson (DB)         3.3 M Gaussian   ~780 MB inference     │
│                                                                  │
│   학습 중에는 Adam 모멘텀 + gradient + 화면 버퍼로 보통 ×3      │
│   → 24GB GPU(VRAM)이 reference 권장                              │
│   → 8GB로도 가능 (densify_grad_threshold↑, scene 분할)          │
└─────────────────────────────────────────────────────────────────┘
```

압축 옵션:
- **SH 양자화** (8-bit) → 4× 절감
- **Compact 3DGS** → 학습 중 pruning 강화 + low-rank SH
- **.splat 포맷** (Niantic 제안) → 32 bytes / Gaussian (압축 16-bit float, quat 압축)
- **Scaffold-GS** → anchor당 k개 neural Gaussian → vanilla의 1/3 메모리

---

# 12. 베스트 프랙티스 + 안티패턴

## 12.1 Capture 단계 (이게 학습 ceiling)

| ✓ Best Practice | ✗ Anti-pattern |
|----------------|---------------|
| 객체 주위 360° + 위/아래 각도 다양화 | 한 면에서만 촬영 (반대편이 hallucinate) |
| **카메라 거리도 다양화** (가까이/멀리) | 모두 동일 거리 → zoom 시 aliasing |
| RAW 또는 고품질 JPEG | 강한 노이즈, 압축 artifact |
| **노출 고정** (manual exposure) | auto exposure → SH가 색상 변화로 오해 |
| 각 view 50~70% overlap | sparse view → COLMAP 실패 |
| 충분한 조명, **무광 surface** | 강한 specular → SH가 못 잡음 |
| 정적 장면 또는 동적 분리 | 사람·차 움직임 → floater |
| **fixed white balance** | auto WB → 색온도 점프 |

## 12.2 COLMAP 단계

| ✓ | ✗ |
|---|---|
| `colmap automatic_reconstructor`로 일단 돌려 sparse 확인 | sparse가 빈약하면 그대로 학습 → 절대 회복 안 됨 |
| `--SiftExtraction.max_image_size 1600` | 4K 그대로 → 메모리 폭발 |
| EXIF에 카메라 모델 있으면 single camera 모드 | 다른 카메라 섞임 + camera shared = 포즈 오류 |
| sparse가 < 5,000점이면 **재촬영** | 0점에서 학습 시도 (random init) |

## 12.3 학습 하이퍼파라미터

| ✓ | ✗ |
|---|---|
| 기본값으로 일단 30k iter | 첫 시도부터 hyperparam 튜닝 |
| **SH degree 단계적 (0→1→2→3)** | 처음부터 degree 3 → noise fitting |
| Densify는 500~15000 iter만 | 끝까지 densify → 메모리 폭발 |
| Opacity reset은 안 만지기 (3000 기본) | reset 안 함 → floater 영원 |
| `position_lr` decay 그대로 | 큰 LR 끝까지 → μ 발산 |
| 학습 후 "render fly-through" 영상 점검 | metrics만 보고 deploy → floater 발견 못 함 |

## 12.4 배포

| ✓ | ✗ |
|---|---|
| `.splat` 압축 포맷으로 저장 | 1GB `.ply`를 그대로 web 배포 |
| Foveated rendering (XR) | 전체 해상도 풀 splat 합성 |
| Frustum + tile culling 확인 | 시야 밖 Gaussian도 process |
| 모바일/web은 SH degree 1로 자르기 | 모바일에서 degree 3 풀 SH 평가 |
| WebGPU 또는 Vulkan compute viewer | OpenGL 단일 pass alpha blend |

---

# 13. 빅테크 / 산업 사례

## 13.1 Capture-as-a-Service

**Luma AI** (San Francisco, 2021 창업, Amit Jain CEO)
- 2023.10.03 **Interactive Scenes** 공식 출시 ("3D was either pretty, or fast. Now it's BOTH!")
- iOS 앱 → 영상 업로드 → 클라우드 학습 → 웹/모바일 embed (8~20MB streaming)
- Luma WebGL Library로 three.js/R3F에서 직접 splat 로드
- Luma Unreal Engine plugin 발표
- **3DGS 상업화 가장 빠르고 깊은 사례** — Ray3 비디오 모델로 확장 중

**Polycam** (San Francisco, 2020 창업)
- 2023.11 베타 → **2024.01 정식 Gaussian Splat 출시**
- 모바일 앱(iOS/Android)에서 비디오 → 클라우드 학습
- 데스크톱 웹에서도 비디오 업로드 가능
- 상업 라이선스 OK, photogrammetry/LiDAR 결과와 hybrid 워크플로우

**Niantic** (Pokémon GO/Ingress 회사)
- 8th Wall 인수 + Lightship VPS → **Niantic Spatial Platform**
- 사용자 캡처가 누적되며 도시 단위 3DGS map 구축
- `.splat` 포맷 표준화 제안 (32 bytes/Gaussian)

## 13.2 디바이스 / OS 벤더

**Apple** — Vision Pro 생태계
- 2024 **MetalSplatter** 오픈소스 Swift/Metal viewer (visionOS 2의 Metal-over-passthrough 활용)
- 2024 Apple ML Research **HUGS** (Human Gaussian Splatting) 논문 — Codec Avatar류
- 2025 **Apple SHARP** — image → splat을 device에서 실행하는 모델
- App Store: **Splat Studio**, **Spatial Fields**, **AirVis**, **Spatial 3D Studio** 등 viewer 다수
- Vision Pro Persona가 내부적으로 Gaussian splatting류 사용 (정확한 디테일 미공개)

**Meta / Reality Labs Research** — Codec Avatars
- 2023.12 **Relightable Gaussian Codec Avatars** (Saito et al. CVPR 2024)
- 머리카락·피부 모공까지 표현, 조명 동적 변경 가능
- HMC(Head Mounted Camera) 영상으로 live driving
- 2024 **Goliath-4 dataset** 공개
- 2024 **D3GA** (Drivable 3D Gaussian Avatars)
- 2024 **SqueezeMe** — VR용 효율적 Gaussian Avatar
- 단점: 학습에 4× RTX 4090 필요, 사용자별 스튜디오 스캔 필요

**Google** — Android XR
- 2024.12 Android XR 발표 (OpenXR 1.1 기반, 자세한 내용은 [`openxr-크로스플랫폼XR표준.md`](openxr-크로스플랫폼XR표준.md))
- 3DGS asset이 1급 시민 후보 (Samsung Galaxy XR 데모에서 splat scene 활용)
- ARCore 팀이 Gaussian splatting 캡처 통합 작업 진행

**NVIDIA**
- **gsplat** 라이브러리에 **3DGUT** (Unscented Transform 기반 정확한 projection) 통합 (2025.04)
- Omniverse에 3DGS scene import/export 추가
- DLSS 4와 결합한 frame upscaling 실험

## 13.3 자율주행

**Waymo**
- 2026.02 **Waymo World Model** 발표 — 순수 reconstructive 3DGS의 한계 인정 ("새 경로에선 visual breakdown")
- generative + reconstructive 결합으로 simulation realism 확보
- 시나리오 합성에 3DGS scene을 base로 사용

**Wayve**
- 2025 NeurIPS Spotlight **Rig3R** — multi-rig 카메라 transformer
- 3DGS를 driving scene reconstruction의 building block으로 사용

**연구 군집**
- **DrivingGaussian** — Composite Dynamic Gaussian Graphs + incremental static
- **StreetGaussian** — 동적 객체 pose 추적 + 4D Spherical Harmonics
- **S³Gaussian** — self-supervised 동적/정적 decomposition + spatial-temporal field
- 자율주행 ML 학회 발표의 상당 비율이 3DGS 기반으로 이동

## 13.4 China big tech

- **ByteDance / TikTok**: 가상 인플루언서 라이브 commerce에 4D Gaussian Avatar 활용 (PICO XR 팀과 협업)
- **Tencent**: 게임 자산 캡처에 SuGaR 류 mesh extraction 검토
- **Kuaishou**: 라이브 스트리밍에서 3DGS 기반 background replacement 실험
- **Alibaba (DAMO Academy)**: 가구·의류 e-commerce 3D 표현으로 3DGS 검토

---

# 14. cooking-assistant XR 시연 관점

이 문서는 cooking-assistant XR 데모용 spatial capture 검토 중에 정리됐다. 의사결정 매트릭스:

| 요구사항 | 후보 | 결정 근거 |
|---------|------|---------|
| **레시피 시연 영상을 3D로 보여주기** | 4D Gaussian Splatting | 동적 RGB video → spatial XR view |
| **레시피 재료 3D asset** | 2DGS → mesh export → glTF | Unity AR Foundation의 mesh material 호환 |
| **주방 환경 reconstruction** | vanilla 3DGS + Mip-Splatting | XR에서 zoom 변동에 안정적 |
| **모바일 사전 캡처** | Polycam (상업 라이선스 OK) | 1줄 캡처 → Polycam 클라우드 → splat URL |
| **Vision Pro 시연** | MetalSplatter / Spatial Fields | 즉시 사용 가능 viewer |
| **Android XR 시연** | 3DGS.cpp Vulkan compute | Galaxy XR/Quest에서 cross-platform |
| **카메라 포즈가 부정확할 때** | BAD-Gaussians 또는 Splatting on the Move | 짐벌 없이 손으로 찍은 영상 보정 |

[`vggt-visual-geometry-grounded-transformer.md`](vggt-visual-geometry-grounded-transformer.md)는 COLMAP 대신 feed-forward로 카메라/포인트를 즉시 추정하는 방식이다 — 3DGS의 입력 단계를 가속하는 짝꿍 기술. 디스플레이 단의 LBS(Laser Beam Steering)는 [`laser-beam-steering-LBS-AR디스플레이.md`](laser-beam-steering-LBS-AR디스플레이.md) 참고.

---

# 15. 자주 묻는 함정

## 15.1 "왜 학습한 splat이 web viewer에서 다르게 보이지?"

원인 후보:
1. **SH degree** — viewer가 degree 3까지 평가하는지 확인. 모바일 viewer는 자주 degree 1로 자른다.
2. **Coordinate convention** — INRIA reference는 OpenCV convention (Y-down, Z-forward), Unity/Unreal은 Y-up. `.ply` 변환 시 축 회전 필요.
3. **Background color** — 학습 시 white background로 학습하면 black background viewer에서 edge가 망가진다.
4. **Tone mapping / gamma** — 학습은 sRGB 가정, 일부 viewer는 linear.

## 15.2 "Floater가 안 사라진다"

- Opacity reset이 동작 중인지 확인 (`opacity_reset_interval` 기본 3000)
- 학습 view가 너무 sparse → 어떤 floater는 모든 학습 view에서 안 보임 → 절대 안 사라짐
- 해결: 더 많은 view 캡처, 또는 학습 후 manual prune (foreground mask)

## 15.3 "GPU OOM"

- `densify_grad_threshold` 0.0002 → 0.0004로 (Gaussian 수 절반)
- `densify_until_iter` 15000 → 10000
- 또는 Scaffold-GS / Compact 3DGS 사용

## 15.4 "Specular 표면이 흐리게 나온다"

- SH degree 3 충분한지 확인
- 학습 view가 view-dependent 변화를 보여주는지 (다양한 angle)
- 본질적으로 SH는 저주파 BRDF만 표현 가능 → 거울 같은 sharp specular는 한계
- 해결: GS-IR, Relightable 3DGS 같은 별도 모델

---

# 16. 한 줄 정리

```
┌─────────────────────────────────────────────────────────────────┐
│                    3DGS 본질 7줄                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 장면을 수백만 anisotropic Gaussian으로 explicit 표현         │
│  2. EWA splatting (2001)을 22년 만에 깨운 GPU 친화 algorithm     │
│  3. Tile-based α-blending으로 SIMT divergence 회피               │
│  4. Densification 휴리스틱이 학습의 90%를 결정                    │
│  5. NeRF 대비 학습 30배+ / 렌더링 200배+ 가속                    │
│  6. Surface가 아닌 volume primitive — mesh 추출은 후처리         │
│  7. 출시 3년 만에 NeRF 후속 연구의 80%가 이 위에서 진행          │
└─────────────────────────────────────────────────────────────────┘
```

NeRF가 "신경망의 표현력"으로 radiance field를 풀었다면, 3DGS는 **"GPU 하드웨어의 본성"으로 radiance field를 풀었다**. 두 접근은 양립 가능하고, 2024~2026의 트렌드는 **explicit 3DGS 기반 + 작은 신경망(deformation, SH residual, relighting)** 조합으로 수렴 중이다.

---

# 17. 참고 자료

## 원논문
- [3D Gaussian Splatting for Real-Time Radiance Field Rendering (arxiv 2308.04079)](https://arxiv.org/abs/2308.04079) — Kerbl, Kopanas, Leimkühler, Drettakis. SIGGRAPH 2023, ACM TOG 42(4)
- [INRIA project page](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/) — 데이터셋, 결과 비디오, BibTeX
- [graphdeco-inria/gaussian-splatting (GitHub, non-commercial)](https://github.com/graphdeco-inria/gaussian-splatting) — 공식 reference 구현

## EWA Splatting 조상
- [Surface Splatting (Zwicker et al. SIGGRAPH 2001)](https://www.cs.umd.edu/~zwicker/publications/SurfaceSplatting-SIG01.pdf)
- [EWA Volume Splatting (Zwicker et al. IEEE Vis 2001)](https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf)
- [EWA Splatting (Zwicker et al. IEEE TVCG 2002)](https://www.cs.umd.edu/~zwicker/publications/EWASplatting-TVCG02.pdf) — 통합 정리본

## 주요 변형
- [2D Gaussian Splatting (Huang et al. SIGGRAPH 2024, arxiv 2403.17888)](https://arxiv.org/abs/2403.17888)
- [SuGaR — Surface-Aligned Gaussian Splatting (Guédon & Lepetit, arxiv 2311.12775)](https://arxiv.org/abs/2311.12775)
- [Mip-Splatting (Yu et al. CVPR 2024, arxiv 2311.16493)](https://arxiv.org/abs/2311.16493)
- [Scaffold-GS (Lu et al. CVPR 2024, arxiv 2312.00109)](https://arxiv.org/abs/2312.00109)
- [4D Gaussian Splatting (Wu et al. CVPR 2024, arxiv 2310.08528)](https://arxiv.org/abs/2310.08528)
- [Dynamic 3D Gaussians (Luiten et al. arxiv 2308.09713)](https://arxiv.org/abs/2308.09713)
- [3DGS-Avatar (Qian et al. CVPR 2024)](https://neuralbodies.github.io/3DGS-Avatar/)
- [Relightable Gaussian Codec Avatars (Saito et al. CVPR 2024)](https://shunsukesaito.github.io/rgca/) — Meta Reality Labs
- [FlashGS (arxiv 2408.07967)](https://arxiv.org/abs/2408.07967) — CVPR 2025
- [Gaussian Splatting on the Move (Seiskari et al. ECCV 2024, arxiv 2403.13327)](https://arxiv.org/abs/2403.13327) — Spectacular AI

## 구현 / 도구
- [gsplat — nerfstudio (Apache-2.0)](https://github.com/nerfstudio-project/gsplat) — 4× 메모리, 15% 빠름
- [3DGS.cpp — Vulkan Compute viewer](https://github.com/shg8/3DGS.cpp) — Win/Linux/macOS/iOS/visionOS
- [MetalSplatter — Apple Vision Pro Swift/Metal viewer](https://github.com/scier/MetalSplatter)
- [Spectacular AI 3dgs-deblur](https://github.com/SpectacularAI/3dgs-deblur)

## 상용 / 산업
- [Luma AI Interactive Scenes (2023.10.03 launch)](https://lumalabs.ai/interactive-scenes)
- [Polycam Gaussian Splatting (2024.01 release)](https://poly.cam/tools/gaussian-splatting)
- [Polycam Gaussian Splatting out of Beta (Radiance Fields)](https://radiancefields.com/polycam-gaussian-splatting-out-of-beta)
- [Spatial Fields — Apple Vision Pro 3DGS viewer](https://spatialfields.app/)
- [Apple SHARP / Splat Studio (UploadVR 보도)](https://www.uploadvr.com/apple-sharp-open-source-on-device-gaussian-splatting/)
- [Mobile-GS (Snapdragon 8 Gen 3, 116 fps)](https://xiaobiaodu.github.io/mobile-gs-project/)
- [Waymo World Model (2026.02)](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [Wayve Rig3R (NeurIPS 2025)](https://wayve.ai/thinking/rig3r/)

## 관련 dwkim 문서
- [`nerf-neural-radiance-fields.md`](nerf-neural-radiance-fields.md) — 3DGS의 직전 표준, implicit vs explicit 대비
- [`vggt-visual-geometry-grounded-transformer.md`](vggt-visual-geometry-grounded-transformer.md) — COLMAP 대체 feed-forward 카메라/포인트 추정
- [`laser-beam-steering-LBS-AR디스플레이.md`](laser-beam-steering-LBS-AR디스플레이.md) — 디스플레이 단의 cousin 기술
- [`openxr-크로스플랫폼XR표준.md`](openxr-크로스플랫폼XR표준.md) — Android XR, Vision Pro 등 viewer 호환 레이어
