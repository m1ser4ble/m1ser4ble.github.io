---
layout: single
title: "Kustomize Base/Overlay 패턴"
date: 2026-02-25 04:25:53 +0900
categories: infra
excerpt: "Kustomize Base/Overlay 패턴은(는) 핵심 개념과 배경, 이유를 정리해 적용 기준을 제공한다."
toc: true
toc_sticky: true
tags: [Kustomize, Base-Overlay, kubectl-apply-k, Strategic-Merge-Patch, JSON-6902]
---

## TL;DR
- Kustomize Base/Overlay 패턴의 핵심 개념과 용어를 한눈에 정리한다.
- Kustomize Base/Overlay 패턴이(가) 등장한 배경과 필요성을 요약한다.
- Kustomize Base/Overlay 패턴의 특징과 적용 포인트를 빠르게 확인한다.

## 1. 개념
Kustomize Base/Overlay 패턴은(는) 핵심 용어와 정의를 정리한 주제로, 개발/운영 맥락에서 무엇을 의미하는지 설명한다.

## 2. 배경
기존 방식의 한계나 현업의 요구사항을 해결하기 위해 이 개념이 등장했다는 흐름을 이해하는 데 목적이 있다.

## 3. 이유
도입 이유는 보통 유지보수성, 성능, 안정성, 보안, 협업 효율 같은 실무 문제를 해결하기 위함이다.

## 4. 특징
- 핵심 정의와 범위를 명확히 한다.
- 실무 적용 시 선택 기준과 비교 포인트를 제공한다.
- 예시 중심으로 빠른 이해를 돕는다.

## 5. 상세 내용
> **작성일**: 2026-02-24
> **카테고리**: Infra / Kubernetes / Kustomize
> **포함 내용**: Kustomize, Base/Overlay, kubectl apply -k, Strategic Merge Patch, JSON 6902, Helm 비교, GitOps, Component, SIG-CLI, kustomization.yaml, 환경별 설정

---

# 1. 핵심 개념

## Kustomize란?

```
Kustomize = Kubernetes 공식 설정 커스터마이징 도구

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  탄생 배경:                                             │
│  ├── Google 내부 경험에서 비롯 (2018년)                 │
│  ├── 저자: Jeff Regan & Phillip Wittrock                │
│  ├── Kubernetes SIG-CLI가 공식 관리                     │
│  └── kubectl v1.14 (2019)부터 네이티브 내장             │
│                                                         │
│  핵심 철학:                                             │
│  ├── 템플릿 없이 순수 YAML 기반으로 동작                │
│  ├── 원본 파일을 절대 수정하지 않음                     │
│  └── 빌드 타임에 패치를 합성(overlay)하여 출력          │
│                                                         │
│  비유:                                                  │
│  "make처럼 선언적이고,                                  │
│   sed처럼 텍스트를 편집한다"                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Base/Overlay 패턴이란?

```
Base/Overlay = 공통 + 차이점 분리 전략

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Base                                                   │
│  ├── 환경에 무관한 공통 매니페스트                      │
│  └── 단일 진실의 원천 (Single Source of Truth)          │
│                                                         │
│  Overlay                                                │
│  ├── Base를 참조하면서 환경별 차이점만 패치로 선언      │
│  └── Base를 절대 복사하지 않음                          │
│                                                         │
│              base/                                      │
│               │                                         │
│       ┌───────┼───────┐                                 │
│       ▼       ▼       ▼                                 │
│   overlays/ overlays/ overlays/                         │
│     dev/   staging/   prod/                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 2. 이 패턴이 등장한 배경

## 기존 방식의 문제점

```
기존에는 두 가지 나쁜 선택지밖에 없었다

┌─────────────────────────────────────────────────────────┐
│  Option A: 복사 후 수정 (Copy & Edit)                   │
│                                                         │
│  deployment.yaml                                        │
│       │                                                 │
│       ├── deployment-dev.yaml     (복사)                │
│       ├── deployment-staging.yaml (복사)                │
│       └── deployment-prod.yaml    (복사)                │
│                                                         │
│  문제점:                                                │
│  ├── 공통 변경 시 모든 복사본을 수동으로 반영 필요      │
│  ├── 규모 커지면 Configuration Drift 불가피             │
│  └── "어느 게 진짜야?" 혼란                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Option B: 템플릿 파라미터화 (Helm 방식)                │
│                                                         │
│  deployment.yaml (Go 템플릿)                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ replicas: {{ .Values.replicas }}                │   │
│  │ image: {{ .Values.image.repo }}:                │   │
│  │         {{ .Values.image.tag }}                 │   │
│  │ {{- if .Values.hpa.enabled }}                   │   │
│  │   ... 수십 줄의 중첩 조건문 ...                 │   │
│  │ {{- end }}                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  문제점:                                                │
│  ├── 새로운 언어/도구 학습 필요 (Go 템플릿)             │
│  ├── 파라미터 세트가 점점 복잡해짐                      │
│  └── 설정 데이터와 프로그래밍 로직 경계 모호            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Kustomize의 해결책 - 패치 기반 커스터마이징

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  핵심 관찰:                                             │
│  "환경별 차이는 보통 전체 매니페스트의 일부분일 뿐"     │
│                                                         │
│  예) prod vs dev 실제 차이:                             │
│  ├── replicas: 1 → 3                                    │
│  ├── image tag: latest → v2.3.1                         │
│  └── resources.limits.memory: 256Mi → 1Gi              │
│      (나머지 95%는 동일)                                │
│                                                         │
│  Kustomize 접근법:                                      │
│  ├── Base: 공통 95%를 원본 YAML로 그대로 유지           │
│  ├── Patch: 차이점 5%만 별도 파일로 선언                │
│  └── Build: 빌드 타임에 Base + Patch 합성               │
│                                                         │
│  원본 파일 = 절대 수정하지 않음                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 3. 디렉토리 구조와 동작 방식

## 표준 디렉토리 구조

```
my-app/
├── base/
│   ├── kustomization.yaml    ← 리소스 목록 선언
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── replica-patch.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        ├── kustomization.yaml
        └── hpa.yaml
```

## Base kustomization.yaml 예시

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
- configmap.yaml

commonLabels:
  app: my-app
```

## Overlay kustomization.yaml 예시 (prod)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base          # Base를 참조

namePrefix: prod-     # 모든 리소스 이름에 접두사 추가

images:
- name: my-app
  newTag: v2.3.1      # 이미지 태그 고정

patches:
- path: replica-patch.yaml
```

## 패치 방식 두 가지

```
┌─────────────────────────────────────────────────────────┐
│  방식 1: Strategic Merge Patch (가장 일반적)             │
│                                                         │
│  Kubernetes 객체 구조를 그대로 활용                     │
│  ─── 덮어쓸 필드만 명시하면 나머지는 Base 유지          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```yaml
# replica-patch.yaml (Strategic Merge Patch)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3          # 이 필드만 덮어씀
  template:
    spec:
      containers:
      - name: app
        resources:
          limits:
            memory: "1Gi"
```

```
┌─────────────────────────────────────────────────────────┐
│  방식 2: JSON 6902 Patch (정밀한 RFC6902 연산)           │
│                                                         │
│  add / remove / replace / move / copy / test 연산       │
│  ─── 배열 인덱스 지정, 특정 경로 제거 등 정밀 제어      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```yaml
# kustomization.yaml 내 JSON 6902 패치 예시
patches:
- target:
    kind: Deployment
    name: my-app
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 3
    - op: add
      path: /spec/template/spec/containers/0/env/-
      value:
        name: LOG_LEVEL
        value: "warn"
```

## 빌드 및 적용 명령어

```bash
# 렌더링 결과만 확인 (실제 적용 안 함)
kustomize build overlays/prod

# kubectl 내장 명령으로 바로 적용
kubectl apply -k overlays/prod

# 렌더링 후 파이프로 넘기기
kustomize build overlays/prod | kubectl apply -f -
```

---

# 4. Helm과의 비교

| 항목 | Kustomize | Helm |
|------|-----------|------|
| 핵심 추상화 | Overlay / Patch | 패키지 매니저 + 템플릿 |
| 설정 언어 | 순수 YAML + 패치 | Go 템플릿 + values.yaml |
| kubectl 통합 | 네이티브 내장 | 별도 바이너리 |
| 버전 관리/패키징 | 없음 (Git 위임) | SemVer Chart |
| 롤백 | 없음 (Git 위임) | 네이티브 지원 |
| 에코시스템 | 없음 | Artifact Hub 10,000+ Charts |
| GitOps 적합성 | 최적 | 렌더링 별도 필요 |
| 학습 곡선 | 낮음 | 높음 |

```
┌─────────────────────────────────────────────────────────┐
│  핵심 차이점                                            │
│                                                         │
│  Helm = 패키지 매니저 (apt / npm for K8s)               │
│  ├── 서드파티 앱 설치 및 배포판 관리                    │
│  ├── "nginx-ingress 설치해줘" 같은 패키징               │
│  └── Chart 버전 관리, 의존성 해결                       │
│                                                         │
│  Kustomize = 설정 오버레이 도구                         │
│  ├── 이미 있는 YAML을 환경별로 커스터마이징             │
│  ├── "dev에선 1개, prod에선 3개" 같은 차이점 관리       │
│  └── 원본 파일 불변성 유지                              │
│                                                         │
│  2025-2026 업계 합의: 함께 사용하는 것이 표준           │
│  ├── Helm으로 서드파티 앱 설치                          │
│  └── Kustomize로 환경별 패치 적용                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

실제 조합 예시:

```yaml
# overlays/prod/kustomization.yaml
# Helm Chart를 Base로 두고 Kustomize로 패치하는 패턴
resources:
- ../../base

helmCharts:
- name: ingress-nginx
  repo: https://kubernetes.github.io/ingress-nginx
  version: "4.7.0"
  releaseName: ingress-nginx

patches:
- path: custom-patch.yaml
```

---

# 5. SIG-CLI란 무엇인가

## SIG (Special Interest Group) 구조

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  SIG = Special Interest Group (특별 관심 그룹)          │
│                                                         │
│  Kubernetes 프로젝트를 영역별로 나눠 관리하는           │
│  공식 조직 단위                                         │
│                                                         │
│  배경:                                                  │
│  ├── 2014~2015년 K8s 급성장                            │
│  ├── 기여자 수천 명, PR 수만 개                        │
│  ├── 한 팀이 모든 것을 결정/리뷰하는 것이 불가능       │
│  └── 코드베이스 수백만 줄, 한 사람이 전체 이해 불가    │
│                                                         │
│  해결책:                                                │
│  관심 영역별로 전담 팀(SIG)을 둔다                      │
│                                                         │
│  현재 20+ 개의 SIG 운영 중:                            │
│  ├── SIG-API Machinery  (API 서버, 리소스 정의)        │
│  ├── SIG-Apps           (Deployment, StatefulSet)      │
│  ├── SIG-Auth           (인증, 인가, RBAC)             │
│  ├── SIG-CLI            (kubectl, Kustomize)           │
│  ├── SIG-Network        (Service, Ingress, CNI)        │
│  ├── SIG-Node           (kubelet, 컨테이너 런타임)     │
│  ├── SIG-Scheduling     (kube-scheduler)               │
│  ├── SIG-Storage        (PV, PVC, CSI)                 │
│  └── ... 등                                            │
│                                                         │
│  비유:                                                  │
│  ├── SIG = 국회의 상임위원회                            │
│  │   └── 국방위, 기재위 각각 전문 영역 담당             │
│  └── K8s Steering Committee = 국회 운영위원회          │
│      └── SIG 간 조율, 전체 방향 설정                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 왜 이런 구조가 나왔는가

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  일반적인 오픈소스 거버넌스:                            │
│  └── BDFL (자비로운 독재자) 모델                       │
│      예: Linux의 Linus Torvalds                        │
│                                                         │
│  Kubernetes의 특수성:                                   │
│  ├── Google이 만들었지만 CNCF에 기증 (2015)            │
│  ├── 특정 회사가 독점하면 안 됨                        │
│  │   → 중립적 거버넌스 필요                            │
│  ├── 코드베이스가 거대 (수백만 줄)                     │
│  └── 한 사람이 모든 영역을 이해하기 불가능             │
│                                                         │
│  SIG 모델의 장점:                                      │
│  ├── 분산 의사결정: 자기 영역에서 자율적 결정          │
│  ├── 전문성: CLI 전문가가 CLI를, 네트워크 전문가가     │
│  │   네트워크를 결정                                   │
│  ├── 기업 중립: 여러 회사 멤버가 함께 운영             │
│  └── 확장성: 새 영역 필요 시 새 SIG 생성               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## SIG-CLI의 역할

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  SIG-CLI = kubectl 및 CLI 도구 전담 그룹               │
│                                                         │
│  관리 대상:                                            │
│  ├── kubectl          (K8s 공식 CLI)                   │
│  ├── Kustomize        (설정 커스터마이징)               │
│  ├── kubectl plugins  (플러그인 시스템, Krew)          │
│  └── CLI 관련 UX/DX   (출력 형식, 자동완성)            │
│                                                         │
│  책임 범위:                                            │
│  ├── 기능 설계 및 KEP(Enhancement Proposal) 검토       │
│  ├── PR 리뷰 및 머지 권한                              │
│  ├── 릴리즈 관리                                       │
│  └── 커뮤니티 미팅 (격주)                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Kustomize가 SIG-CLI에 소속된 이유

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. kubectl에 내장됨                                   │
│     └── kubectl apply -k = Kustomize 기능              │
│     └── CLI 도구의 일부이므로 SIG-CLI 관할             │
│                                                         │
│  2. 원저자가 SIG-CLI 멤버                              │
│     └── Phillip Wittrock이 Google에서 개발 후          │
│         SIG-CLI에 기여                                 │
│                                                         │
│  3. CLI 사용자 경험과 직결                             │
│     └── "kubectl로 K8s를 어떻게 다룰 것인가?"의 일부  │
│                                                         │
│  의미:                                                  │
│  ├── Kustomize ≠ 커뮤니티 써드파티 도구                │
│  ├── Kubernetes 공식 프로젝트의 일부                   │
│  ├── K8s 릴리즈 주기에 맞춰 함께 릴리즈               │
│  └── K8s Steering Committee 거버넌스 하에 운영         │
│                                                         │
│  → Kustomize가 "산업 표준"이라 불리는 핵심 근거        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 6. 산업 표준인가?

## 채택 현황 (CNCF 2024 Survey)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Helm      ████████████████████████████████████  75%   │
│  Kustomize ███████                               14%   │
│                                                         │
│  * Kustomize 14% = 단독 사용 기준                       │
│  * 실제 침투율은 훨씬 높음:                             │
│    ArgoCD / Flux 기반 GitOps 사용 기업은                │
│    내부적으로 Kustomize를 네이티브 사용                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 공식 지위

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  공식성:                                                │
│  ├── Kubernetes SIG-CLI 관리 프로젝트                   │
│  ├── kubectl v1.14 (2019)부터 네이티브 내장             │
│  └── GitHub 11,900+ stars                               │
│                                                         │
│  GitOps 도구 1등급 지원:                                │
│  ├── ArgoCD: Kustomize 네이티브 빌드 지원               │
│  └── Flux CD: Kustomize Controller 내장                 │
│                                                         │
│  주요 기업 사용:                                        │
│  ├── Google (원저작자)                                  │
│  └── ArgoCD / Flux 기반 GitOps 사용 기업 대부분         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 정확한 위치 규정

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  배포/패키징의 표준                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    Helm                         │   │
│  │  서드파티 앱 설치, Chart 공유, 버전 관리         │   │
│  └─────────────────────────────────────────────────┘   │
│                        +                                │
│  GitOps 환경 커스터마이징의 표준                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  Kustomize                      │   │
│  │  환경별 패치, 순수 YAML, GitOps 최적             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  둘은 경쟁이 아닌 보완 관계                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 7. Component 패턴 (고급)

## Component란?

```
┌─────────────────────────────────────────────────────────┐
│  Component = 선택적/조합 가능한 기능 단위               │
│                                                         │
│  추가된 버전: Kustomize v3.7.0+                         │
│  kind: Component (Kustomization이 아님!)                │
│                                                         │
│  Base와 Overlay 사이 어딘가에 위치:                     │
│                                                         │
│  components/           ← 선택적 기능 단위들             │
│  ├── monitoring/       ← Prometheus 설정                │
│  │   ├── kustomization.yaml (kind: Component)           │
│  │   └── servicemonitor.yaml                            │
│  ├── hpa/              ← HorizontalPodAutoscaler        │
│  │   ├── kustomization.yaml (kind: Component)           │
│  │   └── hpa.yaml                                       │
│  └── debug-logging/    ← 디버그 로그 설정               │
│      ├── kustomization.yaml (kind: Component)           │
│      └── configmap-patch.yaml                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```yaml
# components/monitoring/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component          # Kustomization이 아님!

resources:
- servicemonitor.yaml

patches:
- path: annotation-patch.yaml
```

```yaml
# overlays/prod/kustomization.yaml
# prod: monitoring + hpa 포함
resources:
- ../../base

components:
- ../../components/monitoring
- ../../components/hpa
```

```yaml
# overlays/dev/kustomization.yaml
# dev: debug-logging만 포함
resources:
- ../../base

components:
- ../../components/debug-logging
```

```
┌─────────────────────────────────────────────────────────┐
│  Component의 핵심 가치                                  │
│                                                         │
│  중복 패치 없이 기능을 조합:                            │
│  ├── prod: base + monitoring + hpa                      │
│  ├── staging: base + monitoring                         │
│  └── dev: base + debug-logging                          │
│                                                         │
│  같은 패치를 여러 overlay에 복붙하는 문제 해결          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 8. 실전 Best Practices

```
┌─────────────────────────────────────────────────────────┐
│  1. Base 파일을 직접 수정하지 않기                      │
│                                                         │
│  ❌ base/deployment.yaml 직접 편집                      │
│  ✅ overlays/prod/patch.yaml 로 패치                    │
│                                                         │
│  Base = 읽기 전용 원본, 패치로만 커스터마이징           │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  2. 이미지 태그 고정 (latest 사용 금지)                 │
│                                                         │
│  ❌ newTag: latest                                       │
│  ✅ newTag: v2.3.1                                       │
│                                                         │
│  GitOps에서 tag = 배포 버전의 유일한 진실               │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  3. Overlay를 작게 유지                                 │
│                                                         │
│  Overlay가 너무 크다 = Base 설계를 재검토할 시점        │
│  이상적인 Overlay = 5-10개 필드 변경                    │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  4. namePrefix로 환경 구분                              │
│                                                         │
│  namePrefix: prod-   → prod-my-app                      │
│  namePrefix: staging- → staging-my-app                  │
│                                                         │
│  같은 클러스터에 여러 환경 공존 시 충돌 방지            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  5. 대규모 조직: Base/Overlay 별도 리포지토리           │
│                                                         │
│  app-configs (Base 전용)                                │
│    └── base/my-app/                                     │
│                                                         │
│  app-overlays (Overlay 전용, 팀별)                      │
│    ├── team-a/overlays/prod/                            │
│    └── team-b/overlays/prod/                            │
│                                                         │
│  Base 변경 = PR 리뷰 필수, Overlay = 팀 자율            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  6. CI에서 kustomize build로 유효성 검증                │
│                                                         │
│  # .github/workflows/validate.yaml                      │
│  - run: kustomize build overlays/prod | \               │
│           kubectl apply --dry-run=client -f -           │
│                                                         │
│  배포 전 렌더링 실패 조기 발견                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  7. 중복 패치 → Component로 추출                        │
│                                                         │
│  여러 overlay에 같은 패치가 등장하면:                   │
│  → components/ 디렉토리로 추출                          │
│  → 각 overlay에서 components: 로 선언적 포함            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  8. commonLabels 대신 labels + includeSelectors 주의    │
│                                                         │
│  commonLabels: 는 selector도 함께 수정                  │
│  → 기존 Deployment 업데이트 시 오류 유발 가능           │
│                                                         │
│  안전한 방법:                                           │
│  labels:                                                │
│    pairs:                                               │
│      env: prod                                          │
│    includeSelectors: false   ← selector 제외            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Kustomize`, `Base/Overlay`, `kubectl apply -k`, `Strategic Merge Patch`, `JSON 6902`, `Helm`, `GitOps`, `ArgoCD`, `Flux CD`, `Component`, `SIG-CLI`, `kustomization.yaml`, `Kubernetes`, `환경별 설정`, `패치 기반 커스터마이징`
