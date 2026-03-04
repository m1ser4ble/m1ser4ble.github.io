---
layout: single
title: "KEDA ScaledObject — 이벤트 기반 오토스케일링"
date: 2026-03-03 23:00:00 +0900
categories: infra
tags: [infra, network, web, proxy]
excerpt: "리버스 프록시는 외부 요청을 중재해 보안과 확장성을 높이는 핵심 인프라 컴포넌트다."
source: "/home/dwkim/dwkim/docs/cloud/keda-scaledobject-이벤트기반오토스케일링.md"---

**TL;DR**
- KEDA
- ScaledObject
- ScaledJob

## 1. Concept
KEDA ScaledObject — 이벤트 기반 오토스케일링의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. Background
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. Reason
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. Features
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. Detailed Notes

# KEDA ScaledObject — 이벤트 기반 오토스케일링

> **작성일**: 2026-03-03
> **카테고리**: Cloud / Kubernetes / Autoscaling
> **포함 내용**: KEDA, ScaledObject, ScaledJob, HPA, Event-Driven Autoscaling, Scale-to-Zero, TriggerAuthentication, Kafka Scaler, SQS Scaler, Prometheus Scaler, Cron Scaler, CNCF Graduated

---

## 목차

1. [개요 — 왜 KEDA가 필요한가?](#1-개요--왜-keda가-필요한가)
2. [KEDA 탄생 배경과 CNCF 여정](#2-keda-탄생-배경과-cncf-여정)
3. [아키텍처 — KEDA는 HPA를 대체하지 않는다](#3-아키텍처--keda는-hpa를-대체하지-않는다)
4. [ScaledObject CRD 완전 해부](#4-scaledobject-crd-완전-해부)
5. [ScaledJob — 배치 워크로드 스케일링](#5-scaledjob--배치-워크로드-스케일링)
6. [TriggerAuthentication — 보안 자격 증명 관리](#6-triggerauthentication--보안-자격-증명-관리)
7. [90+ 스케일러 생태계 — 카테고리별 정리](#7-90-스케일러-생태계--카테고리별-정리)
8. [실전 YAML 레퍼런스 — 7가지 주요 시나리오](#8-실전-yaml-레퍼런스--7가지-주요-시나리오)
9. [HPA vs KEDA 상세 비교](#9-hpa-vs-keda-상세-비교)
10. [프로덕션 베스트 프랙티스](#10-프로덕션-베스트-프랙티스)
11. [자주 발생하는 문제와 해결](#11-자주-발생하는-문제와-해결)
12. [비용 최적화](#12-비용-최적화)
13. [FAQ](#13-faq)
14. [요약 및 키워드](#14-요약-및-키워드)

---

## 1. 개요 — 왜 KEDA가 필요한가?

### Kubernetes HPA의 근본적 한계

Kubernetes Horizontal Pod Autoscaler(HPA)는 워크로드 스케일링의 표준이지만,
이벤트 기반 아키텍처에서는 **5가지 근본적 한계**가 존재한다.

#### 한계 1: CPU/Memory는 지연 지표(Lagging Indicator)

메시지 큐에 50,000개의 메시지가 쌓여도 Consumer Pod의 CPU 사용률은 0%에 가깝다.
HPA는 "현재 부하"만 측정하므로, **"대기 중인 작업량"에 반응하지 못한다.**

```
메시지 큐 상태         CPU 사용률       HPA 판단
──────────────────────────────────────────────────
큐 깊이: 0             0%              스케일 불필요
큐 깊이: 50,000        0% (대기 중)    스케일 불필요  ← 문제!
큐 처리 시작           85%             이제야 스케일
큐 처리 완료           10%             스케일 다운
```

#### 한계 2: minReplicas >= 1 강제

HPA는 최소 복제본을 1 미만으로 설정할 수 없다.
하루에 한 번 5분간 실행되는 배치 워커가 나머지 23시간 55분 동안 유휴 상태로 리소스를 점유한다.

```
시간대별 실제 필요 Pod 수 vs HPA 최소 Pod 수:

     필요 Pod 수                HPA minReplicas
     ──────────                 ─────────────────
00:00   0                       1 (낭비)
06:00   0                       1 (낭비)
12:00   5 (배치 실행)           5 (적절)
12:05   0                       1 (낭비)
18:00   0                       1 (낭비)
```

#### 한계 3: Custom Metrics 파이프라인 복잡성

HPA에서 커스텀 메트릭을 사용하려면 다음 파이프라인을 직접 구축해야 한다:

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    ┌─────┐
│ Prometheus   │───▶│ Prometheus   │───▶│ custom.metrics.k8s  │───▶│ HPA │
│ (수집)       │    │ Adapter      │    │ .io API             │    │     │
└─────────────┘    │ (변환)       │    └─────────────────────┘    └─────┘
                   │ ConfigMap    │
                   │ 규칙 작성    │
                   └──────────────┘
```

Prometheus Adapter의 ConfigMap 규칙 작성은 복잡하고 오류가 발생하기 쉽다.

#### 한계 4: 외부 이벤트 소스 네이티브 미지원

HPA는 Kubernetes 클러스터 내부 메트릭만 기본 지원한다.
AWS SQS, Azure Service Bus, Kafka 같은 **외부 이벤트 소스에 직접 연결하는 방법이 없다.**

#### 한계 5: Multi-Trigger 수식 불가

HPA v2에서는 여러 메트릭을 지정할 수 있지만, 각 메트릭이 독립적으로 계산되어
**가장 높은 복제본 수가 선택**된다. 메트릭 간 수식(가중 평균, 조건부 로직)은 불가능하다.

### Microsoft Azure Functions 팀의 발견

> "Azure Functions 실행의 70%는 비-HTTP 이벤트(큐, 스트림, 타이머)에서 발생한다."

이 통찰이 KEDA 프로젝트의 시작점이 되었다. HTTP 요청 기반 스케일링만으로는
현대 클라우드 네이티브 워크로드의 대부분을 효율적으로 처리할 수 없다.

### HPA의 한계 vs KEDA가 채우는 갭

```
┌──────────────────────────────────────────────────────────────────────┐
│                    스케일링 요구사항 전체 영역                         │
│                                                                      │
│  ┌────────────────────┐  ┌──────────────────────────────────────┐   │
│  │   HPA가 커버하는    │  │      KEDA가 채우는 갭                │   │
│  │   영역              │  │                                      │   │
│  │                    │  │  - 메시지 큐 기반 스케일링             │   │
│  │  - CPU 기반        │  │  - Scale-to-Zero                     │   │
│  │  - Memory 기반     │  │  - 외부 메트릭 소스 네이티브 연동     │   │
│  │  - 기본 custom     │  │  - 다중 트리거 조합                   │   │
│  │    metrics         │  │  - Cron 기반 예약 스케일링             │   │
│  │                    │  │  - 데이터베이스 쿼리 기반 스케일링     │   │
│  │                    │  │  - CI/CD 러너 동적 프로비저닝          │   │
│  │                    │  │  - gRPC 커스텀 스케일러                │   │
│  └────────────────────┘  └──────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. KEDA 탄생 배경과 CNCF 여정

### 프로젝트 타임라인

| 날짜 | 이벤트 | 상세 |
|------|--------|------|
| 2019-05-06 | KubeCon Barcelona 발표 | Microsoft + Red Hat 공동 프로젝트로 공개 |
| 2019-11-19 | v1.0 GA | 13개 스케일러, ScaledObject CRD |
| 2020-03-12 | CNCF Sandbox 진입 | CNCF 생태계 공식 편입 |
| 2020-11-03 | v2.0 GA | CRD 재설계, TriggerAuthentication 도입 |
| 2021-08-18 | CNCF Incubating | 4명 유지관리자, 3개 조직 |
| 2022-07-28 | v2.8 GA | ScaledJob 안정화, 50+ 스케일러 |
| 2023-08-22 | CNCF Graduated | 45+ 프로덕션 사용 조직, 60+ 스케일러 |
| 2024-03-12 | v2.14 GA | Paused Annotation, Composite Scaler |
| 2024-10-15 | v2.16 GA | Bound SA Token, Caching 개선 |
| 2025-06-10 | v2.18 GA | ScalingModifiers Formula, 80+ 스케일러 |
| 2026-02-04 | v2.19 GA | 90+ 스케일러, CachingMetrics 최적화 |

### 프로덕션 채택 기업

| 기업 | 사용 사례 |
|------|-----------|
| FedEx | 물류 이벤트 처리 파이프라인 스케일링 |
| KPMG | 감사 데이터 분석 배치 워크로드 |
| Reddit | 사용자 활동 기반 백엔드 서비스 스케일링 |
| Xbox (Microsoft) | 게임 세션 매칭 서비스 |
| Alibaba Cloud | 클라우드 서비스 이벤트 파이프라인 |
| Grafana Labs | 메트릭 수집/처리 워크로드 |
| Cisco | 네트워크 텔레메트리 데이터 처리 |
| Zapier | 워크플로우 자동화 작업 스케일링 |
| Astronomer | Apache Airflow 워커 스케일링 |

### 버전별 주요 마일스톤

| 버전 | 스케일러 수 | 주요 기능 |
|------|-------------|-----------|
| v1.0 | 13 | ScaledObject, ScaledJob 기본 지원 |
| v1.5 | 21 | MSI 인증, External Scaler gRPC |
| v2.0 | 30 | CRD v2 재설계, TriggerAuthentication |
| v2.4 | 38 | CPU/Memory 스케일러, ScaledJob 개선 |
| v2.8 | 50 | Fallback 정책, Admission Webhook |
| v2.10 | 55 | Paused Replicas, Formula Scaler |
| v2.12 | 60 | CacheTTL, MSO(Multi-ScaledObject) |
| v2.14 | 68 | Composite Scaler, Pause 어노테이션 4종 |
| v2.16 | 75 | Bound SA Token, Reference 인증 개선 |
| v2.18 | 82 | ScalingModifiers, Advanced HPA Config |
| v2.19 | 90+ | 성능 최적화, CachingMetrics v2 |

---

## 3. 아키텍처 — KEDA는 HPA를 대체하지 않는다

### 핵심 원칙

**KEDA는 HPA를 대체하는 것이 아니라, HPA와 협력하여 작동한다.**
KEDA는 외부 이벤트 소스의 메트릭을 수집하고, 이를 HPA가 이해할 수 있는 형태로 변환하여
Kubernetes 메트릭 API를 통해 제공한다.

### 전체 메트릭 파이프라인 흐름

```
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│  External        │     │              Kubernetes Cluster                 │
│  Systems         │     │                                                 │
│                  │     │  ┌───────────────────┐                         │
│  ┌─────────┐    │     │  │  keda-operator     │                         │
│  │ Kafka    │◀───┼─────┼──│  (Scaler 실행)     │                         │
│  │ Cluster  │    │     │  │                   │                         │
│  └─────────┘    │     │  │  - 폴링 주기마다   │                         │
│                  │     │  │    메트릭 수집     │                         │
│  ┌─────────┐    │     │  │  - 0↔1 전환 관리   │    ┌─────────────────┐ │
│  │ AWS SQS  │◀───┼─────┼──│  - ScaledObject   │    │  Target          │ │
│  │ Queue    │    │     │  │    감시            │    │  Workload        │ │
│  └─────────┘    │     │  └───────┬───────────┘    │                   │ │
│                  │     │          │ gRPC            │  ┌─────────────┐ │ │
│  ┌─────────┐    │     │          ▼                 │  │ order-       │ │ │
│  │Prometheus│◀───┼─────┼──┌───────────────────┐    │  │ service     │ │ │
│  │ Server   │    │     │  │ keda-operator-     │    │  │ Deployment  │ │ │
│  └─────────┘    │     │  │ metrics-apiserver  │    │  └─────────────┘ │ │
│                  │     │  │                   │    │                   │ │
│  ┌─────────┐    │     │  │ external.metrics   │    └───────▲───────────┘ │
│  │ Redis    │◀───┼─────┼──│ .k8s.io 구현      │            │             │
│  │ Cluster  │    │     │  └───────┬───────────┘            │             │
│  └─────────┘    │     │          │                         │             │
│                  │     │          ▼                         │             │
└─────────────────┘     │  ┌───────────────────┐    ┌───────┴───────┐     │
                        │  │ K8s API           │    │  HPA          │     │
                        │  │ Aggregation Layer │───▶│  Controller   │     │
                        │  └───────────────────┘    │  (1↔N 관리)   │     │
                        │                           └───────────────┘     │
                        └─────────────────────────────────────────────────┘
```

### 2단계 스케일링 모델

KEDA의 스케일링은 두 단계(Phase)로 나뉜다:

```
┌─────────────────────────────────────────────────────────────────┐
│                     KEDA 2단계 스케일링                          │
│                                                                  │
│  Phase 1: 활성화/비활성화 (0 ↔ 1)                               │
│  ┌─────────────────────────────────────────────┐                │
│  │  KEDA Operator가 직접 관리                    │                │
│  │  - HPA를 우회하여 Deployment.spec.replicas    │                │
│  │    를 직접 수정                                │                │
│  │  - activationValue 기준으로 판단              │                │
│  │  - cooldownPeriod 적용 (1→0 전환 시)          │                │
│  └─────────────────────────────────────────────┘                │
│                          │                                       │
│                          ▼                                       │
│  Phase 2: 스케일링 (1 ↔ N)                                      │
│  ┌─────────────────────────────────────────────┐                │
│  │  HPA가 관리                                   │                │
│  │  - KEDA Metrics Server가 메트릭 제공          │                │
│  │  - threshold 기준으로 복제본 수 계산           │                │
│  │  - HPA의 stabilizationWindowSeconds 적용      │                │
│  │  - HPA의 behavior 정책 적용                   │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  타임라인 예시:                                                  │
│                                                                  │
│  Replicas                                                        │
│     10 │                    ┌────┐                               │
│      8 │                 ┌──┘    └──┐       HPA 관리             │
│      6 │              ┌──┘          └──┐    (Phase 2)            │
│      4 │           ┌──┘                └──┐                      │
│      2 │        ┌──┘                      └──┐                   │
│      1 │─┬──┬──┘  KEDA↔HPA 전환             └──┬──┬─            │
│      0 │──┘  KEDA 관리                          └──┘             │
│        └──────────────────────────────────────────────▶ 시간     │
│          (Phase 1)                              (Phase 1)        │
└─────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 역할 분리

| 컴포넌트 | 역할 | Deployment 수 |
|----------|------|---------------|
| keda-operator | ScaledObject/ScaledJob 감시, 스케일러 실행, 0↔1 관리, HPA 생성/삭제 | 1 (HA: 2) |
| keda-operator-metrics-apiserver | external.metrics.k8s.io API 구현, HPA에 메트릭 제공 | 1 (HA: 2) |
| keda-admission-webhooks | ScaledObject 유효성 검증, 충돌 방지 | 1 (HA: 2) |

### Admission Webhook 검증 규칙

| 규칙 | 설명 |
|------|------|
| 중복 ScaledObject 방지 | 동일 대상 워크로드에 여러 ScaledObject 금지 |
| HPA 소유권 확인 | KEDA가 관리하는 HPA에 대한 외부 수정 차단 |
| 필드 유효성 검증 | minReplicaCount > maxReplicaCount 방지 |
| 트리거 유효성 | 존재하지 않는 스케일러 타입 참조 방지 |

### 제약사항

```
⚠ 중요: 클러스터당 하나의 external.metrics.k8s.io 어댑터만 등록 가능

  Prometheus Adapter와 KEDA를 동시에 external.metrics.k8s.io로
  등록할 수 없다. KEDA 사용 시 Prometheus Adapter는 제거하거나,
  KEDA의 Prometheus 스케일러를 통해 동일 기능을 수행해야 한다.

  대안: Prometheus Adapter를 custom.metrics.k8s.io에 등록하고
        KEDA를 external.metrics.k8s.io에 등록하면 공존 가능.
```

---

## 4. ScaledObject CRD 완전 해부

### 전체 spec 필드 해설

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `scaleTargetRef.apiVersion` | string | apps/v1 | 대상 리소스의 API 버전 |
| `scaleTargetRef.kind` | string | Deployment | 대상 리소스 종류 (Deployment, StatefulSet 등) |
| `scaleTargetRef.name` | string | (필수) | 대상 리소스 이름 |
| `scaleTargetRef.envSourceContainerName` | string | (첫 번째 컨테이너) | 환경변수를 참조할 컨테이너 이름 |
| `pollingInterval` | int | 30 | 메트릭 폴링 주기 (초) |
| `cooldownPeriod` | int | 300 | 1→0 전환 대기 시간 (초). N→1은 HPA가 관리 |
| `initialCooldownPeriod` | int | 0 | ScaledObject 생성 후 첫 스케일링까지 대기 시간 (초) |
| `minReplicaCount` | int | 0 | 최소 복제본 수. 0이면 scale-to-zero 활성화 |
| `maxReplicaCount` | int | 100 | 최대 복제본 수 |
| `idleReplicaCount` | int | (미설정) | 유휴 시 복제본 수. minReplicaCount보다 작아야 함 |
| `fallback.failureThreshold` | int | (필수) | 연속 실패 횟수 기준 |
| `fallback.replicas` | int | (필수) | 폴백 시 복제본 수 |
| `advanced.restoreToOriginalReplicaCount` | bool | false | ScaledObject 삭제 시 원래 복제본 수 복원 |
| `advanced.horizontalPodAutoscalerConfig` | object | {} | 생성되는 HPA에 전달할 추가 설정 |
| `advanced.scalingModifiers` | object | {} | 트리거 메트릭에 대한 수식 연산 |
| `triggers[].type` | string | (필수) | 스케일러 타입 (kafka, prometheus 등) |
| `triggers[].name` | string | (자동 생성) | 트리거 이름 (메트릭 식별용) |
| `triggers[].metadata` | map | (필수) | 스케일러별 설정 |
| `triggers[].authenticationRef` | object | {} | TriggerAuthentication 참조 |
| `triggers[].metricType` | string | AverageValue | HPA 메트릭 타입 (Value, AverageValue, Utilization) |
| `triggers[].useCachedMetrics` | bool | false | 캐시된 메트릭 사용 여부 |

### 완전한 YAML 예제

```yaml
# ScaledObject 전체 필드 예제 - order-service Kafka Consumer 스케일링
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-scaledobject       # ScaledObject 이름
  namespace: order-system                   # 네임스페이스
  labels:
    app: order-processor
  annotations:
    # 일시 중지 어노테이션 (필요 시 활성화)
    # autoscaling.keda.sh/paused: "true"              # 모든 스케일링 중지
    # autoscaling.keda.sh/paused-replicas: "3"        # 특정 복제본 수로 고정
    # autoscaling.keda.sh/paused-scale-in: "true"     # 스케일 인만 중지
    # autoscaling.keda.sh/paused-scale-out: "true"    # 스케일 아웃만 중지
spec:
  # ── 대상 워크로드 ──
  scaleTargetRef:
    apiVersion: apps/v1                     # 기본값: apps/v1
    kind: Deployment                        # Deployment, StatefulSet 등
    name: order-processor                   # 대상 Deployment 이름
    envSourceContainerName: order-worker    # 환경변수 참조 컨테이너 (선택)

  # ── 폴링 및 쿨다운 ──
  pollingInterval: 15                       # 15초마다 메트릭 폴링 (기본 30초)
  cooldownPeriod: 120                       # 1→0 전환 전 120초 대기 (기본 300초)
  initialCooldownPeriod: 60                 # 생성 후 60초간 스케일링 보류

  # ── 복제본 범위 ──
  minReplicaCount: 0                        # 0 = scale-to-zero 활성화
  maxReplicaCount: 30                       # 최대 30개 Pod
  idleReplicaCount: 1                       # 유휴 시 1개 유지 (0과 min 사이 중간 단계)

  # ── 폴백 정책 ──
  fallback:
    failureThreshold: 3                     # 3회 연속 메트릭 수집 실패 시
    replicas: 5                             # 5개 복제본으로 폴백

  # ── 고급 설정 ──
  advanced:
    restoreToOriginalReplicaCount: true     # ScaledObject 삭제 시 원래 복제본 수 복원
    horizontalPodAutoscalerConfig:
      name: order-processor-hpa             # 생성될 HPA 이름 지정 (선택)
      behavior:                             # HPA v2 behavior 정책
        scaleDown:
          stabilizationWindowSeconds: 120   # 스케일 다운 안정화 윈도우
          policies:
            - type: Percent
              value: 25                     # 최대 25%씩 감소
              periodSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 0     # 스케일 업은 즉시
          policies:
            - type: Pods
              value: 5                      # 최대 5개씩 증가
              periodSeconds: 30
    scalingModifiers:                       # 메트릭 수식 연산 (v2.18+)
      target: "2"                           # 수식 결과 기준 목표값
      activationTarget: "0.5"               # 수식 결과 활성화 기준값
      metricType: AverageValue
      formula: "kafka_lag + prometheus_rate" # 복합 메트릭 수식

  # ── 트리거 ──
  triggers:
    # Kafka Consumer Group Lag 트리거
    - type: kafka
      name: kafka_lag                       # 수식에서 참조할 이름
      metadata:
        bootstrapServers: "kafka-0.kafka:9092,kafka-1.kafka:9092"
        consumerGroup: order-processor-group
        topic: orders
        lagThreshold: "100"                 # Pod당 목표 Lag
        activationLagThreshold: "10"        # 10 이상이면 활성화 (0→1)
        offsetResetPolicy: latest
        allowIdleConsumers: "false"
        limitToPartitionsWithLag: "true"    # Lag 있는 파티션만 계산
      authenticationRef:
        name: kafka-auth                    # TriggerAuthentication 참조

    # Prometheus 메트릭 트리거 (보조)
    - type: prometheus
      name: prometheus_rate
      metadata:
        serverAddress: "http://prometheus.monitoring:9090"
        query: |
          sum(rate(order_requests_total{service="order-processor"}[2m]))
        threshold: "50"                     # Pod당 목표 RPS
        activationThreshold: "5"
      metricType: AverageValue
      useCachedMetrics: true                # 캐시 사용으로 Prometheus 부하 감소
```

### activationValue vs threshold 구분

이 개념은 KEDA에서 가장 중요하면서도 혼동되기 쉬운 부분이다.

```
┌──────────────────────────────────────────────────────────────────┐
│                  activationValue vs threshold                    │
│                                                                  │
│  메트릭 값                                                       │
│     │                                                            │
│  200├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ threshold (200)     │
│     │            Scaling Phase                                   │
│     │            (HPA가 1↔N 관리)                                │
│     │            threshold 기준으로                               │
│     │            복제본 수 계산                                   │
│     │                                                            │
│   10├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ activationValue (10)                  │
│     │                                                            │
│     │  Activation Phase                                          │
│     │  (KEDA가 0↔1 관리)                                        │
│     │  activationValue 이상이면                                  │
│     │  Pod 1개로 활성화                                          │
│     │                                                            │
│    0├────────────────────────────────────────────▶                │
│     │  Zero State (Pod 0개)                      메트릭          │
│                                                                  │
│  예시 (Kafka lagThreshold: "200", activationLagThreshold: "10"):│
│  - Lag 0~9:   Pod 0개 유지 (비활성)                              │
│  - Lag 10:    Pod 1개로 활성화 (0→1)                             │
│  - Lag 400:   Pod 2개 (400/200 = 2)                              │
│  - Lag 1000:  Pod 5개 (1000/200 = 5)                             │
│  - Lag 9→0:   cooldownPeriod 후 Pod 0개 (1→0)                   │
└──────────────────────────────────────────────────────────────────┘
```

### Pause 기능 — 4가지 어노테이션

운영 중 스케일링을 일시 중지해야 하는 상황에서 사용한다.

| 어노테이션 | 효과 | 사용 사례 |
|------------|------|-----------|
| `autoscaling.keda.sh/paused: "true"` | 모든 스케일링 중지, 현재 복제본 유지 | 장애 조사 중 |
| `autoscaling.keda.sh/paused-replicas: "5"` | 특정 복제본 수로 고정 | 부하 테스트 |
| `autoscaling.keda.sh/paused-scale-in: "true"` | 스케일 인만 중지 (아웃은 허용) | 피크 대비 |
| `autoscaling.keda.sh/paused-scale-out: "true"` | 스케일 아웃만 중지 (인은 허용) | 리소스 제한 |

---

## 5. ScaledJob — 배치 워크로드 스케일링

### ScaledObject vs ScaledJob 비교

| 항목 | ScaledObject | ScaledJob |
|------|-------------|-----------|
| 대상 리소스 | Deployment, StatefulSet | Job |
| HPA 생성 | O (1↔N 구간) | X (KEDA가 직접 관리) |
| Scale-to-Zero | O (minReplicaCount: 0) | O (기본 동작) |
| 워크로드 패턴 | 장기 실행 (Long-Running) | 일회성 실행 (Run-to-Completion) |
| 복제본 관리 | Deployment replicas 조정 | 새 Job 객체 생성 |
| 스케일링 전략 | HPA 알고리즘 | default, custom, accurate, eager |
| 최적 사용처 | 웹 서버, API, Consumer | CI/CD 빌드, 인코딩, 배치 처리 |

### ScaledJob은 HPA를 생성하지 않는다

ScaledJob은 ScaledObject와 달리 HPA를 생성하지 않는다.
KEDA Operator가 직접 Job 객체를 생성하고 관리한다.

```
┌─────────────────────────────────────────────────────────────┐
│  ScaledObject 작동 방식         ScaledJob 작동 방식          │
│                                                              │
│  KEDA ──▶ HPA ──▶ Deployment   KEDA ──▶ Job (직접 생성)     │
│    │                  │           │                           │
│    │  0↔1 직접 관리    │  1↔N     │  메트릭에 비례하여        │
│    └──────────────────┘           │  Job 객체를 생성          │
│                                   │  완료된 Job은 정리        │
│                                   └──────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

### scalingStrategy 옵션

| 전략 | 설명 | 계산 방식 |
|------|------|-----------|
| `default` | 기본 전략 | `ceil(메트릭값 / threshold)` |
| `custom` | 사용자 정의 수식 | customScalingQueueLengthDeduction, customScalingRunningJobPercentage |
| `accurate` | 실행 중인 Job 고려 | `ceil(메트릭값 / threshold) - runningJobs` |
| `eager` | 즉시 최대 생성 | 대기 메시지마다 Job 1개 (최대치까지) |

### 사용 시나리오

**1. CI/CD 빌드 러너**
- 빌드 큐에 작업이 들어오면 Job으로 빌드 러너 생성
- 빌드 완료 후 자동 정리
- 유휴 시 러너 0개로 비용 절감

**2. 영상 인코딩**
- S3/SQS에 영상 업로드 이벤트 발생 시 인코딩 Job 생성
- GPU 노드에서 실행, 완료 후 리소스 반환

**3. ML 배치 추론**
- 추론 요청 큐 깊이에 따라 추론 Job 동적 생성
- 모델 로딩 오버헤드를 고려한 scalingStrategy 설정

### ScaledJob YAML 예제

```yaml
# ScaledJob 예제 - SQS 메시지 기반 영상 인코딩 Job
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: video-encoder-scaledjob             # ScaledJob 이름
  namespace: media-system
spec:
  # ── Job 템플릿 ──
  jobTargetRef:
    parallelism: 1                           # Job당 병렬 Pod 수
    completions: 1                           # Job 완료 기준
    activeDeadlineSeconds: 3600              # 최대 실행 시간 1시간
    backoffLimit: 3                          # 실패 시 재시도 횟수
    template:
      metadata:
        labels:
          app: video-encoder
      spec:
        restartPolicy: Never
        containers:
          - name: encoder
            image: media-registry/video-encoder:v2.1
            resources:
              requests:
                cpu: "2"
                memory: "4Gi"
                nvidia.com/gpu: "1"          # GPU 리소스 요청
              limits:
                cpu: "4"
                memory: "8Gi"
                nvidia.com/gpu: "1"
            env:
              - name: SQS_QUEUE_URL
                value: "https://sqs.ap-northeast-2.amazonaws.com/123456789/video-encode-queue"

  # ── 폴링 및 스케일링 ──
  pollingInterval: 10                        # 10초마다 큐 확인
  minReplicaCount: 0                         # 유휴 시 Job 0개
  maxReplicaCount: 20                        # 최대 20개 동시 인코딩
  successfulJobsHistoryLimit: 10             # 성공 Job 이력 보관 수
  failedJobsHistoryLimit: 5                  # 실패 Job 이력 보관 수
  rolloutStrategy: gradual                   # 점진적 롤아웃

  # ── 스케일링 전략 ──
  scalingStrategy:
    strategy: accurate                       # 실행 중 Job 수를 고려하여 정확히 계산
    # strategy: eager                        # 메시지당 1 Job (빠른 반응)
    # strategy: custom
    # customScalingQueueLengthDeduction: 1
    # customScalingRunningJobPercentage: "0.5"

  # ── 트리거 ──
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: "https://sqs.ap-northeast-2.amazonaws.com/123456789/video-encode-queue"
        queueLength: "1"                     # 메시지 1개당 Job 1개
        awsRegion: "ap-northeast-2"
        scaleOnInFlight: "true"              # InFlight 메시지도 포함
      authenticationRef:
        name: aws-sqs-auth
```

---

## 6. TriggerAuthentication — 보안 자격 증명 관리

### 8가지 인증 방법

KEDA 트리거가 외부 시스템에 접근할 때 필요한 자격 증명을 안전하게 관리하는 방법이다.

#### 방법 1: Kubernetes Secret 참조

가장 기본적인 방법. Secret에 저장된 자격 증명을 참조한다.

```yaml
# Secret 생성
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: order-system
type: Opaque
data:
  sasl-username: b3JkZXItc2VydmljZQ==     # base64: order-service
  sasl-password: c2VjcmV0LXBhc3N3b3Jk     # base64: secret-password
  ca-cert: LS0tLS1CRUdJTi4uLg==           # base64: CA 인증서
---
# TriggerAuthentication
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-auth
  namespace: order-system
spec:
  secretTargetRef:
    - parameter: sasl                       # 스케일러 파라미터 이름
      name: kafka-credentials               # Secret 이름
      key: sasl-username                     # Secret 키
    - parameter: password
      name: kafka-credentials
      key: sasl-password
    - parameter: ca
      name: kafka-credentials
      key: ca-cert
```

#### 방법 2: 환경 변수 참조

Pod의 환경 변수에서 자격 증명을 가져온다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: env-auth
  namespace: order-system
spec:
  env:
    - parameter: connection                  # 스케일러 파라미터
      name: REDIS_CONNECTION_STRING          # 환경 변수 이름
      containerName: order-worker            # 컨테이너 이름 (선택)
```

#### 방법 3: AWS IRSA (EKS Pod Identity)

EKS에서 IAM Role을 ServiceAccount에 연결하여 사용한다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-irsa-auth
  namespace: order-system
spec:
  podIdentity:
    provider: aws                            # AWS Pod Identity 사용
    identityId: ""                           # (선택) 특정 Role ARN
    # EKS에서 ServiceAccount에 IAM Role이 연결되어 있어야 함
    # kubectl annotate sa keda-operator \
    #   eks.amazonaws.com/role-arn=arn:aws:iam::123456789:role/keda-sqs-role
```

#### 방법 4: Azure Workload Identity

Azure에서 Managed Identity를 사용한다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: azure-wi-auth
  namespace: order-system
spec:
  podIdentity:
    provider: azure-workload                 # Azure Workload Identity
    identityId: "12345678-abcd-efgh-ijkl-123456789012"  # Client ID
```

#### 방법 5: GCP Workload Identity

GKE에서 Google Cloud IAM을 사용한다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: gcp-wi-auth
  namespace: order-system
spec:
  podIdentity:
    provider: gcp                            # GCP Workload Identity
    # GKE ServiceAccount에 GCP SA가 바인딩되어 있어야 함
```

#### 방법 6: HashiCorp Vault

Vault에서 동적으로 자격 증명을 가져온다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: vault-auth
  namespace: order-system
spec:
  hashiCorpVault:
    address: "https://vault.infra:8200"
    namespace: "admin"                       # Vault Enterprise namespace
    authentication: token                    # token, kubernetes, serviceAccount
    credential:
      token: vault-keda-token                # Secret 이름 (token에 Vault 토큰 저장)
    secrets:
      - parameter: password                  # 스케일러 파라미터
        key: secret/data/kafka               # Vault 경로
        path: password                       # 경로 내 키
    # Kubernetes 인증 방식
    # authentication: kubernetes
    # role: keda-role
    # mount: kubernetes
```

#### 방법 7: AWS Secrets Manager

AWS Secrets Manager에서 자격 증명을 가져온다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-sm-auth
  namespace: order-system
spec:
  awsSecretManager:
    credentials:
      accessKey:
        valueFrom:
          secretKeyRef:
            name: aws-creds
            key: access-key
      accessSecretKey:
        valueFrom:
          secretKeyRef:
            name: aws-creds
            key: secret-key
    region: "ap-northeast-2"
    secrets:
      - parameter: password
        name: "prod/kafka/credentials"       # Secrets Manager 시크릿 이름
        versionId: ""                        # (선택) 특정 버전
        versionStage: "AWSCURRENT"
```

#### 방법 8: Bound ServiceAccount Token (v2.17+)

Kubernetes ServiceAccount의 바운드 토큰을 사용한다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: bound-sa-auth
  namespace: order-system
spec:
  boundServiceAccountToken:
    - parameter: bearerToken
      serviceAccountName: keda-sa
      audiences:
        - "https://target-service.example.com"
      expirationSeconds: 3600
```

### TriggerAuthentication vs ClusterTriggerAuthentication

| 항목 | TriggerAuthentication | ClusterTriggerAuthentication |
|------|----------------------|------------------------------|
| 범위 | 네임스페이스 내 | 클러스터 전체 |
| 참조 방법 | `authenticationRef.name` | `authenticationRef.name` + `kind: ClusterTriggerAuthentication` |
| 사용 사례 | 팀별 독립 자격 증명 | 공유 인프라 자격 증명 |
| Secret 위치 | 동일 네임스페이스 | keda 네임스페이스 |

```yaml
# ClusterTriggerAuthentication 예제
apiVersion: keda.sh/v1alpha1
kind: ClusterTriggerAuthentication
metadata:
  name: shared-prometheus-auth              # 클러스터 전체에서 사용
spec:
  secretTargetRef:
    - parameter: bearerToken
      name: prometheus-token                 # keda 네임스페이스의 Secret
      key: token
---
# ScaledObject에서 참조
triggers:
  - type: prometheus
    authenticationRef:
      name: shared-prometheus-auth
      kind: ClusterTriggerAuthentication     # 명시적으로 kind 지정
```

---

## 7. 90+ 스케일러 생태계 — 카테고리별 정리

### 메시징 (13개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| Apache Kafka | Consumer Group Lag | lagThreshold, topic, consumerGroup |
| RabbitMQ | Queue Length / Message Rate | queueLength, mode (QueueLength/MessageRate) |
| AWS SQS | ApproximateNumberOfMessages | queueURL, queueLength, scaleOnInFlight |
| Azure Service Bus | Message Count | queueName, messageCount, namespace |
| Azure Event Hubs | Event Hub Lag | consumerGroup, unprocessedEventThreshold |
| NATS JetStream | Pending Message Count | stream, consumer, lagThreshold |
| Apache Pulsar | Subscription Backlog | adminURL, topic, subscription |
| GCP Pub/Sub | Undelivered Message Count | subscriptionName, value |
| ActiveMQ | Queue Depth | destinationName, targetQueueSize |
| IBM MQ | Queue Depth | queueManager, queueName, queueDepth |
| Solace PubSub+ | Undelivered Message Count | solaceAdminURL, msgVpnName |
| NATS Streaming | Pending Count | natsServerMonitoringEndpoint |
| Redis Streams | Pending Entries | stream, pendingEntriesCount |

### 데이터베이스 (15개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| PostgreSQL | 쿼리 결과 값 | query, targetQueryValue, connectionString |
| MySQL | 쿼리 결과 값 | query, queryValue, connectionString |
| MongoDB | 도큐먼트 수 | query, queryValue, collection |
| Redis (Lists) | List Length | listName, listLength |
| Redis (Streams) | Pending Entries | stream, pendingEntriesCount |
| Redis (Sorted Sets) | Sorted Set 크기 | sortedSetName, min/max |
| Cassandra | 쿼리 결과 값 | query, targetQueryValue, keyspace |
| Elasticsearch | 쿼리 히트 수 | searchTemplateName, valueLocation |
| InfluxDB | 쿼리 결과 값 | query, thresholdValue, organizationName |
| CouchDB | 도큐먼트 수 | dbName, queryValue |
| Etcd | Key 변화 감지 | endpoints, watchKey |
| MSSQL | 쿼리 결과 값 | query, targetValue, connectionString |
| AWS DynamoDB | 쿼리 결과 값 | tableName, expressionAttributeValues |
| AWS DynamoDB Streams | Stream Shard 수 | tableName, shardCount |
| Arangodb | 쿼리 결과 값 | query, queryValue, serverAddress |

### 메트릭/옵저버빌리티 (12개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| Prometheus | PromQL 쿼리 결과 | serverAddress, query, threshold |
| Datadog | Datadog 메트릭 | query, queryValue, datadogSite |
| New Relic | NRQL 쿼리 결과 | nrql, threshold, account |
| AWS CloudWatch | CloudWatch 메트릭 | metricName, targetMetricValue |
| Azure Monitor | Azure Monitor 메트릭 | metricName, targetValue, resourceURI |
| Azure Log Analytics | KQL 쿼리 결과 | query, threshold, workspaceId |
| Dynatrace | Dynatrace 메트릭 | token, threshold, metricSelector |
| Grafana Loki | LogQL 쿼리 결과 | serverAddress, query, threshold |
| Splunk | Splunk 검색 결과 | host, query, targetValue |
| Google Cloud Monitoring | GCP 메트릭 | filter, valueIfNull, targetValue |
| OpenTelemetry | OTLP 메트릭 | scaler.opentelemetry.io/... |
| Azure Application Insights | App Insights 메트릭 | metricId, targetValue, applicationInsightsId |

### 쿠버네티스 네이티브 (3개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| CPU | CPU 사용률/절대값 | type (Utilization/AverageValue), value |
| Memory | 메모리 사용률/절대값 | type (Utilization/AverageValue), value |
| Kubernetes Workload | 다른 워크로드의 복제본 수 | podSelector, value |

### 스케줄링 (1개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| Cron | 시간 기반 | timezone, start, end, desiredReplicas |

### CI/CD (2개)

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| Azure Pipelines | 대기 중인 빌드 수 | poolName, targetPipelinesQueueLength |
| GitHub Runner | 대기 중인 워크플로우 수 | owner, repos, runnerScope |

### 기타

| 스케일러 | 메트릭 기준 | 주요 설정 |
|----------|-------------|-----------|
| External Scaler (gRPC) | 사용자 정의 gRPC 서비스 | scalerAddress, metadata |
| HTTP Add-on | HTTP 요청 큐 깊이 | hosts, targetPendingRequests |
| Selenium Grid | 대기 중인 테스트 세션 | url, browserName |
| Predictkube | ML 예측 기반 | prometheusAddress, query, threshold |

---

## 8. 실전 YAML 레퍼런스 — 7가지 주요 시나리오

### 시나리오 1: Kafka Consumer Group Lag 스케일링

order-service가 Kafka 토픽 `orders`를 소비하며, Consumer Group Lag에 따라 스케일링한다.

```yaml
# ── Secret: Kafka SASL 자격 증명 ──
apiVersion: v1
kind: Secret
metadata:
  name: kafka-order-credentials
  namespace: order-system
type: Opaque
data:
  sasl-username: b3JkZXItcHJvY2Vzc29y       # order-processor
  sasl-password: UEBzc3cwcmQxMjM=             # P@ssw0rd123
---
# ── TriggerAuthentication ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-order-auth
  namespace: order-system
spec:
  secretTargetRef:
    - parameter: sasl
      name: kafka-order-credentials
      key: sasl-username
    - parameter: password
      name: kafka-order-credentials
      key: sasl-password
---
# ── ScaledObject ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-kafka-scaler
  namespace: order-system
spec:
  scaleTargetRef:
    name: order-processor                    # 대상 Deployment
  pollingInterval: 10                        # 10초마다 Lag 확인
  cooldownPeriod: 180                        # 3분간 Lag 0이면 0으로 스케일
  minReplicaCount: 0                         # scale-to-zero 활성화
  maxReplicaCount: 24                        # 파티션 수와 동일하게 제한
  fallback:
    failureThreshold: 3
    replicas: 4                              # Kafka 연결 실패 시 4개 유지
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: "kafka-0.kafka-headless:9092,kafka-1.kafka-headless:9092,kafka-2.kafka-headless:9092"
        consumerGroup: order-processor-group
        topic: orders
        lagThreshold: "500"                  # Pod당 목표 Lag 500
        activationLagThreshold: "10"         # Lag 10 이상이면 활성화
        offsetResetPolicy: latest
        allowIdleConsumers: "false"          # 유휴 Consumer 허용 안 함
        limitToPartitionsWithLag: "true"     # Lag 있는 파티션만 계산
        # SASL 관련 설정
        sasl: scram_sha512                   # SASL 메커니즘
        tls: enable                          # TLS 활성화
      authenticationRef:
        name: kafka-order-auth
```

**핵심 설정 설명:**

- `lagThreshold: "500"`: Pod 1개당 처리할 목표 Lag. Lag 2500이면 5개 Pod 필요
- `activationLagThreshold: "10"`: 0→1 전환 기준. 10 미만이면 0개 유지
- `allowIdleConsumers: "false"`: 메시지 없는 파티션에 Consumer 할당 방지
- `limitToPartitionsWithLag: "true"`: Lag 있는 파티션만 계산하여 정확한 스케일링
- `maxReplicaCount: 24`: Kafka 파티션 수(24개)와 동일. 파티션보다 많은 Consumer는 유휴

### 시나리오 2: RabbitMQ 큐 기반 스케일링

payment-service가 RabbitMQ 큐 `payment-tasks`에서 메시지를 처리한다.

```yaml
# ── Secret: RabbitMQ 자격 증명 ──
apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-payment-credentials
  namespace: payment-system
type: Opaque
data:
  host: YW1xcDovL3BheW1lbnQ6UEBzc3dvcmRAcmFiYml0bXEucGF5bWVudC1zeXN0ZW06NTY3Mi8=
---
# ── TriggerAuthentication ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: rabbitmq-payment-auth
  namespace: payment-system
spec:
  secretTargetRef:
    - parameter: host
      name: rabbitmq-payment-credentials
      key: host
---
# ── ScaledObject ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: payment-processor-rabbitmq-scaler
  namespace: payment-system
spec:
  scaleTargetRef:
    name: payment-processor
  pollingInterval: 5                         # 5초마다 큐 확인 (결제는 민감)
  cooldownPeriod: 60                         # 1분간 큐 비어있으면 0으로
  minReplicaCount: 1                         # 결제는 항상 1개 이상 유지
  maxReplicaCount: 15
  triggers:
    - type: rabbitmq
      metadata:
        # mode: QueueLength (기본값) — 큐 깊이 기반
        # mode: MessageRate — 초당 메시지 도착률 기반
        mode: QueueLength
        queueName: payment-tasks
        value: "20"                          # Pod당 목표 큐 깊이 20
        activationValue: "1"                 # 1개 이상이면 활성화
        protocol: amqp                       # amqp 또는 http
        includeUnacked: "true"               # Unacked 메시지도 포함
      authenticationRef:
        name: rabbitmq-payment-auth
```

### 시나리오 3: Prometheus 메트릭 기반 스케일링

notification-service의 HTTP 요청률에 따라 스케일링한다.

```yaml
# ── Secret: Prometheus Bearer Token ──
apiVersion: v1
kind: Secret
metadata:
  name: prometheus-token
  namespace: notification-system
type: Opaque
data:
  token: ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5...
---
# ── TriggerAuthentication ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: prometheus-auth
  namespace: notification-system
spec:
  secretTargetRef:
    - parameter: bearerToken
      name: prometheus-token
      key: token
---
# ── ScaledObject ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: notification-service-prometheus-scaler
  namespace: notification-system
spec:
  scaleTargetRef:
    name: notification-service
  pollingInterval: 15
  cooldownPeriod: 300
  minReplicaCount: 2                         # 알림 서비스는 최소 2개 (HA)
  maxReplicaCount: 50
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 0      # 스케일 업은 즉시
          policies:
            - type: Percent
              value: 100                     # 최대 100% 증가
              periodSeconds: 15
        scaleDown:
          stabilizationWindowSeconds: 300    # 5분 안정화 후 스케일 다운
          policies:
            - type: Percent
              value: 10                      # 최대 10%씩 감소
              periodSeconds: 60
  triggers:
    # 트리거 1: HTTP 요청률
    - type: prometheus
      metadata:
        serverAddress: "http://thanos-query.monitoring:9090"
        query: |
          sum(rate(http_requests_total{
            service="notification-service",
            namespace="notification-system"
          }[2m]))
        threshold: "100"                     # Pod당 목표 RPS 100
        activationThreshold: "10"            # 전체 RPS 10 이상이면 활성화
      authenticationRef:
        name: prometheus-auth

    # 트리거 2: 에러율 기반 (에러 급증 시 스케일 아웃)
    - type: prometheus
      metadata:
        serverAddress: "http://thanos-query.monitoring:9090"
        query: |
          sum(rate(http_requests_total{
            service="notification-service",
            status=~"5.."
          }[2m])) /
          sum(rate(http_requests_total{
            service="notification-service"
          }[2m])) * 100
        threshold: "5"                       # 에러율 5% 이상이면 스케일 아웃
        activationThreshold: "1"
      authenticationRef:
        name: prometheus-auth
```

### 시나리오 4: AWS SQS 큐 스케일링

inventory-service가 AWS SQS 큐에서 재고 업데이트 메시지를 처리한다.

```yaml
# ── TriggerAuthentication (IRSA 사용) ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-sqs-irsa-auth
  namespace: inventory-system
spec:
  podIdentity:
    provider: aws                            # EKS IRSA 사용
---
# ── ScaledObject ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: inventory-updater-sqs-scaler
  namespace: inventory-system
spec:
  scaleTargetRef:
    name: inventory-updater
  pollingInterval: 10
  cooldownPeriod: 120
  minReplicaCount: 0
  maxReplicaCount: 25
  fallback:
    failureThreshold: 5                      # AWS API 스로틀링 대비
    replicas: 3
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: "https://sqs.ap-northeast-2.amazonaws.com/123456789012/inventory-updates"
        queueLength: "10"                    # Pod당 목표 메시지 10개
        activationQueueLength: "1"           # 1개 이상이면 활성화
        awsRegion: "ap-northeast-2"
        scaleOnInFlight: "true"              # InFlight(처리 중) 메시지도 포함
        scaleOnDelayed: "false"              # Delayed 메시지는 제외
      authenticationRef:
        name: aws-sqs-irsa-auth
```

### 시나리오 5: Cron 예약 스케일링

api-gateway를 업무 시간과 플래시 세일에 맞춰 예약 스케일링한다.

```yaml
# ── ScaledObject (Cron 스케일러) ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: api-gateway-cron-scaler
  namespace: gateway-system
spec:
  scaleTargetRef:
    name: api-gateway
  pollingInterval: 30
  minReplicaCount: 2                         # 항상 최소 2개 유지
  maxReplicaCount: 100
  triggers:
    # 트리거 1: 평일 업무 시간 (09:00~18:00 KST)
    - type: cron
      metadata:
        timezone: "Asia/Seoul"
        start: "0 9 * * 1-5"                # 평일 09:00 시작
        end: "0 18 * * 1-5"                  # 평일 18:00 종료
        desiredReplicas: "10"                # 업무 시간에는 10개

    # 트리거 2: 평일 피크 시간 (12:00~13:00 KST, 점심)
    - type: cron
      metadata:
        timezone: "Asia/Seoul"
        start: "0 12 * * 1-5"
        end: "0 13 * * 1-5"
        desiredReplicas: "20"                # 점심 시간에는 20개

    # 트리거 3: 플래시 세일 프리워밍 (매월 1일 00:00~02:00 KST)
    - type: cron
      metadata:
        timezone: "Asia/Seoul"
        start: "50 23 L * *"                 # 매월 마지막 날 23:50 (프리워밍)
        end: "0 2 1 * *"                     # 매월 1일 02:00
        desiredReplicas: "50"                # 플래시 세일 대비 50개

    # 트리거 4: 실제 트래픽 기반 (Cron과 결합)
    - type: prometheus
      metadata:
        serverAddress: "http://prometheus.monitoring:9090"
        query: |
          sum(rate(http_requests_total{service="api-gateway"}[1m]))
        threshold: "200"                     # Pod당 200 RPS
        activationThreshold: "50"
```

### 시나리오 6: PostgreSQL 쿼리 기반 스케일링

batch-processor가 PostgreSQL의 Outbox 테이블에서 미처리 이벤트를 처리한다.

```yaml
# ── Secret: PostgreSQL 연결 문자열 ──
apiVersion: v1
kind: Secret
metadata:
  name: postgres-batch-credentials
  namespace: batch-system
type: Opaque
data:
  connection: cG9zdGdyZXNxbDovL2JhdGNoX3VzZXI6UEBzc3cwcmRAcG9zdGdyZXMuYmF0Y2gtc3lzdGVtOjU0MzIvb3JkZXJzX2Ri
  # postgresql://batch_user:P@ssw0rd@postgres.batch-system:5432/orders_db
---
# ── TriggerAuthentication ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: postgres-batch-auth
  namespace: batch-system
spec:
  secretTargetRef:
    - parameter: connection
      name: postgres-batch-credentials
      key: connection
---
# ── ScaledObject ──
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: batch-processor-postgres-scaler
  namespace: batch-system
spec:
  scaleTargetRef:
    name: batch-processor
  pollingInterval: 15
  cooldownPeriod: 300
  minReplicaCount: 0
  maxReplicaCount: 8                         # DB 커넥션 풀 한계 고려
  triggers:
    - type: postgresql
      metadata:
        # Outbox 패턴: 미처리 이벤트 수 조회
        query: |
          SELECT COUNT(*)
          FROM outbox_events
          WHERE status = 'PENDING'
          AND created_at > NOW() - INTERVAL '1 hour'
        targetQueryValue: "50"               # Pod당 목표 50개 이벤트
        activationTargetQueryValue: "1"      # 1개 이상이면 활성화
      authenticationRef:
        name: postgres-batch-auth
```

### 시나리오 7: GitHub Actions 러너 스케일링 (ScaledJob)

GitHub Actions 워크플로우 대기열에 따라 Ephemeral 러너를 동적으로 생성한다.

```yaml
# ── Secret: GitHub PAT ──
apiVersion: v1
kind: Secret
metadata:
  name: github-runner-token
  namespace: ci-system
type: Opaque
data:
  personalAccessToken: Z2hwX3h4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=
---
# ── TriggerAuthentication ──
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: github-runner-auth
  namespace: ci-system
spec:
  secretTargetRef:
    - parameter: personalAccessToken
      name: github-runner-token
      key: personalAccessToken
---
# ── ScaledJob (Ephemeral Runner) ──
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: github-runner-scaledjob
  namespace: ci-system
spec:
  jobTargetRef:
    parallelism: 1
    completions: 1
    activeDeadlineSeconds: 7200              # 최대 2시간
    backoffLimit: 0                          # 실패 시 재시도 없음
    template:
      metadata:
        labels:
          app: github-runner
      spec:
        restartPolicy: Never
        serviceAccountName: github-runner-sa
        containers:
          - name: runner
            image: myregistry/github-runner:2.315.0
            env:
              - name: RUNNER_SCOPE
                value: "org"
              - name: ORG_NAME
                value: "my-organization"
              - name: LABELS
                value: "self-hosted,linux,x64,k8s"
              - name: EPHEMERAL
                value: "true"                # 1회 실행 후 자동 삭제
            resources:
              requests:
                cpu: "2"
                memory: "4Gi"
              limits:
                cpu: "4"
                memory: "8Gi"

  pollingInterval: 10                        # 10초마다 대기열 확인
  minReplicaCount: 0                         # 유휴 시 러너 0개
  maxReplicaCount: 30                        # 최대 30개 동시 빌드
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
  scalingStrategy:
    strategy: accurate                       # 실행 중 러너를 고려한 정확한 계산

  triggers:
    - type: github-runner
      metadata:
        owner: "my-organization"
        repos: ""                            # 빈 문자열 = 조직 전체
        runnerScope: "org"                   # org, repo, enterprise
        labels: "self-hosted,linux,x64,k8s"  # 매칭할 러너 라벨
        targetWorkflowQueueLength: "1"       # 대기 워크플로우 1개당 러너 1개
      authenticationRef:
        name: github-runner-auth
```

---

## 9. HPA vs KEDA 상세 비교

### 핵심 비교 테이블

| 항목 | HPA (v2) | KEDA |
|------|----------|------|
| **메트릭 소스** | CPU, Memory, Custom Metrics API | 90+ 외부 이벤트 소스 네이티브 지원 |
| **Scale-to-Zero** | 불가 (minReplicas >= 1) | 네이티브 지원 (minReplicaCount: 0) |
| **반응 시간** | 15초 (기본 sync 주기) | 10~30초 (pollingInterval 설정 가능) |
| **외부 시스템 연동** | Prometheus Adapter 등 별도 구성 필요 | 스케일러가 직접 외부 시스템에 폴링 |
| **설정 복잡성** | Custom Metrics: 높음 | 선언적 YAML: 낮음~중간 |
| **인증 관리** | 없음 (Adapter에 위임) | TriggerAuthentication CRD |
| **Multi-Trigger** | 지원 (독립 계산, 최대값 선택) | 지원 + scalingModifiers 수식 |
| **배치 워크로드** | 미지원 | ScaledJob으로 Job 스케일링 |
| **폴백 정책** | 없음 | fallback CRD 필드 |
| **일시 중지** | 미지원 | 4가지 Pause 어노테이션 |
| **CNCF 상태** | K8s 코어 (내장) | CNCF Graduated |
| **추가 설치** | 없음 | Helm/YAML로 설치 필요 |

### HPA v2 GA 타임라인

| 버전 | K8s 버전 | 상태 | 주요 변경 |
|------|----------|------|-----------|
| autoscaling/v1 | v1.2+ | GA | CPU만 지원 |
| autoscaling/v2beta1 | v1.8+ | Beta | Custom Metrics, Multiple Metrics |
| autoscaling/v2beta2 | v1.12+ | Beta | behavior 정책, stabilizationWindow |
| autoscaling/v2 | v1.23+ | GA | v2beta2 안정화, HPA v1 deprecated |

### 의사결정 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│              HPA vs KEDA 의사결정 플로우차트                     │
│                                                                  │
│  시작: 오토스케일링이 필요한가?                                  │
│    │                                                             │
│    ▼                                                             │
│  CPU/Memory 기반으로 충분한가? ──── Yes ──▶ HPA만 사용           │
│    │                                                             │
│    No                                                            │
│    │                                                             │
│    ▼                                                             │
│  외부 이벤트 소스가 있는가? ──── No ──▶ HPA + Prometheus         │
│  (Kafka, SQS, RabbitMQ 등)           Adapter 검토               │
│    │                                                             │
│    Yes                                                           │
│    │                                                             │
│    ▼                                                             │
│  Scale-to-Zero가 필요한가? ──── No ──▶ KEDA (minReplicaCount≥1)│
│    │                                                             │
│    Yes                                                           │
│    │                                                             │
│    ▼                                                             │
│  콜드 스타트 지연이                                              │
│  허용 가능한가? ──── No ──▶ KEDA + idleReplicaCount              │
│    │                       (중간 단계 유지)                      │
│    Yes                                                           │
│    │                                                             │
│    ▼                                                             │
│  KEDA (minReplicaCount: 0)                                      │
│  완전한 Scale-to-Zero                                           │
└─────────────────────────────────────────────────────────────────┘
```

**HPA만으로 충분한 경우:**
- 웹 서버의 CPU/Memory 기반 스케일링
- 트래픽이 지속적이며 유휴 시간이 거의 없는 서비스
- 외부 이벤트 소스가 없는 단순 API 서비스
- 이미 Prometheus Adapter가 잘 구성되어 있는 환경

**KEDA가 필요한 경우:**
- 메시지 큐 기반 Consumer 워크로드
- 유휴 시간이 긴 배치/이벤트 처리 서비스
- Scale-to-Zero로 비용 절감이 필요한 환경
- 여러 외부 시스템의 메트릭을 조합해야 하는 경우
- 시간 기반 예약 스케일링이 필요한 경우

### 벤치마크: WSO2/Choreo 실험

WSO2 Choreo 팀의 실험 결과, KEDA-HTTP Add-on이 HPA CPU 기반 대비
**3-5배 높은 TPS/replica 효율**을 보여주었다.

| 측정 항목 | HPA (CPU 기반) | KEDA-HTTP | 개선율 |
|-----------|---------------|-----------|--------|
| TPS/replica (저부하) | 120 | 450 | 3.75x |
| TPS/replica (고부하) | 85 | 310 | 3.65x |
| 스케일업 반응 시간 | 45초 | 12초 | 3.75x 빠름 |
| 오버프로비저닝 비율 | 35% | 8% | 77% 감소 |
| P99 레이턴시 영향 | +120ms | +15ms | 87.5% 적음 |

근본 원인: CPU 메트릭은 지연 지표이므로 부하가 실제로 Pod에 도달한 후에야 반응하지만,
KEDA-HTTP는 대기 중인 요청 수를 직접 측정하여 **선행 지표(Leading Indicator)**로 작동한다.

---

## 10. 프로덕션 베스트 프랙티스

### pollingInterval 워크로드별 권장값

| 워크로드 유형 | 권장 pollingInterval | 이유 |
|---------------|---------------------|------|
| 실시간 결제/주문 | 5~10초 | 빠른 반응 필요 |
| 일반 메시지 큐 Consumer | 15~30초 | 기본값으로 충분 |
| 배치 처리 (비실시간) | 30~60초 | 외부 API 부하 감소 |
| Cron 기반 예약 | 30~60초 | 분 단위 정밀도면 충분 |
| CI/CD 러너 | 10~15초 | 빌드 대기 시간 최소화 |
| 데이터베이스 쿼리 기반 | 30~60초 | DB 부하 최소화 |

```
⚠ 주의: pollingInterval을 너무 짧게 설정하면
  외부 시스템(Kafka, SQS, Prometheus)에 과도한 부하를 유발할 수 있다.
  특히 AWS SQS는 API 호출당 비용이 발생한다.
```

### cooldownPeriod 설정 전략

**핵심 이해: cooldownPeriod는 1→0 전환에만 적용된다.**

```
┌──────────────────────────────────────────────────────────────────┐
│                 스케일 다운 시 적용되는 설정                      │
│                                                                  │
│  N → 1 전환:                                                     │
│    HPA의 behavior.scaleDown.stabilizationWindowSeconds 적용      │
│    KEDA의 cooldownPeriod는 관여하지 않음                         │
│                                                                  │
│  1 → 0 전환:                                                     │
│    KEDA의 cooldownPeriod 적용                                    │
│    HPA는 관여하지 않음 (0은 HPA 범위 밖)                         │
│                                                                  │
│  따라서 완전한 스케일 다운 보호를 위해서는:                       │
│    1. HPA behavior: N→1 구간 보호                                │
│    2. cooldownPeriod: 1→0 구간 보호                              │
│  두 가지를 모두 설정해야 한다.                                    │
└──────────────────────────────────────────────────────────────────┘
```

| 워크로드 유형 | cooldownPeriod 권장값 | stabilizationWindowSeconds 권장값 |
|---------------|----------------------|----------------------------------|
| Kafka Consumer | 120~300초 | 120~300초 |
| HTTP 서비스 | 60~120초 | 300초 (기본값) |
| 배치 워커 | 300~600초 | 120초 |
| CI/CD 러너 | 60~120초 | 60초 |
| Cron 기반 | 0~60초 | 0초 |

### maxReplicaCount 보호 설정

| 워크로드 | maxReplicaCount 기준 | 이유 |
|----------|---------------------|------|
| Kafka Consumer | 파티션 수 이하 | 파티션보다 많은 Consumer는 유휴 |
| DB 쿼리 기반 | 커넥션 풀 / Pod당 커넥션 | DB 커넥션 고갈 방지 |
| SQS Consumer | Visibility Timeout 고려 | 메시지 중복 처리 방지 |
| HTTP 서비스 | Node 수 * Pod/Node 한계 | 노드 리소스 고갈 방지 |
| 공통 | Cluster Autoscaler 속도 고려 | 노드 프로비저닝 시간 동안 Pending 방지 |

### fallback 설정 필수

메트릭 소스(Kafka, Prometheus 등)에 장애가 발생하면 KEDA가 메트릭을 수집할 수 없다.
이때 fallback이 없으면 **마지막으로 수집된 메트릭 기준으로 고정**되어 위험할 수 있다.

```yaml
# 반드시 fallback 설정을 포함할 것
spec:
  fallback:
    failureThreshold: 3                      # 3회 연속 실패 후 폴백 활성화
    replicas: 5                              # 안전한 복제본 수로 폴백
```

| 시나리오 | failureThreshold | replicas 권장값 |
|----------|-----------------|-----------------|
| Kafka 브로커 일시 장애 | 3 | 평상시 평균 복제본 수 |
| Prometheus 서버 재시작 | 5 | minReplicaCount 이상 |
| AWS SQS API 스로틀링 | 5 | 평상시 평균 복제본 수 |
| DB 연결 실패 | 2 | maxReplicaCount의 30~50% |

### idleReplicaCount vs minReplicaCount 2단계 스케일링

Scale-to-Zero의 콜드 스타트 문제를 완화하는 중간 단계 전략이다.

```
┌─────────────────────────────────────────────────────────────────┐
│              idleReplicaCount 2단계 스케일링                     │
│                                                                  │
│  Replicas                                                        │
│     30 │                   ┌─────┐                              │
│        │                ┌──┘     └──┐     maxReplicaCount: 30   │
│     10 │             ┌──┘           └──┐                        │
│        │          ┌──┘                 └──┐                     │
│      3 │─ ─ ─ ─ ─┘                       └── minReplicaCount: 3│
│      1 │──────┐                               ┌──── idle: 1    │
│      0 │      └───────────────────────────────┘                 │
│        └──────────────────────────────────────────────▶ 시간    │
│                                                                  │
│  설정:                                                           │
│    minReplicaCount: 3    (활성 상태의 최소값)                    │
│    idleReplicaCount: 1   (유휴 상태 유지값, min보다 작아야 함)   │
│    maxReplicaCount: 30   (최대값)                                │
│                                                                  │
│  동작:                                                           │
│    1. 메트릭 활성 → minReplicaCount(3)부터 시작                  │
│    2. 부하 증가 → maxReplicaCount(30)까지 스케일 아웃            │
│    3. 부하 감소 → minReplicaCount(3)까지 스케일 인               │
│    4. 메트릭 비활성 (cooldownPeriod 경과)                        │
│       → idleReplicaCount(1)로 감소                               │
│    5. 메트릭 재활성 → minReplicaCount(3)로 즉시 복귀             │
│                                                                  │
│  장점: 완전한 0이 아닌 1로 유지하여 콜드 스타트 방지             │
│        동시에 유휴 시 리소스 절약 (3→1 = 66% 절감)               │
└─────────────────────────────────────────────────────────────────┘
```

### Graceful Scale-Down

스케일 다운 시 진행 중인 작업이 중단되지 않도록 보호해야 한다.

```yaml
# Deployment에 Graceful Shutdown 설정
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-processor
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 120     # 최대 120초 대기
      containers:
        - name: order-worker
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - |
                    # Kafka Consumer: 새 메시지 수신 중지
                    # 현재 처리 중인 메시지 완료 대기
                    kill -SIGTERM 1
                    sleep 30
```

### KEDA + Istio 포트 제외 설정

Istio 서비스 메시 환경에서 KEDA가 외부 시스템에 직접 연결해야 하는 경우,
Istio sidecar의 트래픽 가로채기를 우회해야 한다.

```yaml
# KEDA Operator Deployment에 Istio 포트 제외 추가
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keda-operator
  namespace: keda
spec:
  template:
    metadata:
      annotations:
        # Kafka 브로커 포트를 Istio 프록시에서 제외
        traffic.sidecar.istio.io/excludeOutboundPorts: "9092,9093"
        # 또는 KEDA에 sidecar 주입을 비활성화
        # sidecar.istio.io/inject: "false"
```

### KEDA + Cluster Autoscaler 체인 반응

```
┌─────────────────────────────────────────────────────────────────┐
│             KEDA → HPA → CA 체인 반응 타임라인                   │
│                                                                  │
│  t=0s    이벤트 발생 (Kafka Lag 급증)                            │
│  t=10s   KEDA 메트릭 폴링 (pollingInterval: 10s)                │
│  t=10s   KEDA → HPA에 메트릭 보고                               │
│  t=25s   HPA 동기화 (--horizontal-pod-autoscaler-sync-period)   │
│  t=25s   HPA → Deployment replicas 증가 요청                    │
│  t=25s   스케줄러: Pod Pending (노드 리소스 부족)                │
│  t=35s   Cluster Autoscaler 감지 (scan-interval: 10s)           │
│  t=35s   CA → 클라우드 API: 노드 프로비저닝 요청                │
│  t=95s   새 노드 Ready (약 60초 소요)                            │
│  t=95s   Pending Pod → 새 노드에 스케줄링                        │
│  t=100s  Pod 시작 (컨테이너 이미지 풀 + 초기화)                  │
│  t=110s  Pod Ready                                               │
│                                                                  │
│  총 소요 시간: 약 110초 (노드 프로비저닝 포함)                   │
│                                                                  │
│  최적화:                                                         │
│  - Karpenter 사용 시 노드 프로비저닝 30~60초 단축                │
│  - 이미지 프리캐싱으로 Pod 시작 시간 단축                        │
│  - Cron 스케일러로 예측 가능한 피크에 프리워밍                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. 자주 발생하는 문제와 해결

### 문제 1: HPA 충돌 — ScaledObject와 수동 HPA 동시 사용

**증상:** ScaledObject를 생성했는데 스케일링이 불안정하거나 에러 발생

**원인:** 동일 Deployment에 대해 KEDA가 생성한 HPA와 수동으로 생성한 HPA가 충돌

```
⚠ 규칙: 하나의 Deployment에는 하나의 HPA만 존재해야 한다.
  KEDA ScaledObject를 생성하면 KEDA가 자동으로 HPA를 생성하므로,
  기존 수동 HPA는 반드시 삭제해야 한다.
```

**해결:**
```bash
# 기존 수동 HPA 확인
kubectl get hpa -n order-system

# KEDA가 생성한 HPA 확인 (keda-hpa- 접두사)
kubectl get hpa -n order-system | grep keda-hpa

# 충돌하는 수동 HPA 삭제
kubectl delete hpa order-processor-hpa -n order-system
```

### 문제 2: 스케일링 플래핑 (Flapping)

**증상:** Pod 수가 빈번하게 증가/감소를 반복

**원인:** 메트릭 값이 threshold 근처에서 진동

**해결:**

```yaml
# 1. HPA stabilizationWindowSeconds 설정
advanced:
  horizontalPodAutoscalerConfig:
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300       # 5분간 최대값 유지
        policies:
          - type: Percent
            value: 10                         # 최대 10%씩만 감소
            periodSeconds: 60

# 2. Kafka의 경우 lagThreshold를 충분히 높게 설정
triggers:
  - type: kafka
    metadata:
      lagThreshold: "1000"                    # 너무 낮으면 플래핑 발생
```

### 문제 3: API 스로틀링 — kube-apiserver 과부하

**증상:** KEDA Operator 로그에 `429 Too Many Requests` 또는 `throttling` 에러

**원인:** 많은 ScaledObject가 짧은 pollingInterval로 설정되어 API 호출 폭증

**해결:**

```yaml
# KEDA Operator Helm values.yaml
operator:
  # kube-apiserver QPS/Burst 조정
  extraArgs:
    kube-api-qps: "40"                       # 기본 20
    kube-api-burst: "60"                      # 기본 30

# ScaledObject에서 캐시 활성화
triggers:
  - type: prometheus
    useCachedMetrics: true                    # HPA 동기화 시 캐시 사용
    metadata:
      # ...
```

### 문제 4: Kafka Scale-to-Zero + Consumer Group 만료

**증상:** Scale-to-Zero 후 재활성화 시 Kafka Consumer Group의 오프셋이 만료되어
         메시지를 처음부터 다시 소비하거나 누락

**원인:** Kafka 브로커의 `offsets.retention.minutes`(기본 7일)보다 긴 기간 동안
         Consumer가 0개로 유지되면 오프셋 정보가 삭제됨

**해결:**

```
┌──────────────────────────────────────────────────────────────┐
│  방안 1: Kafka 브로커 설정 조정                               │
│  offsets.retention.minutes = 20160 (14일)                    │
│                                                               │
│  방안 2: KEDA cooldownPeriod를 짧게 + idleReplicaCount 사용  │
│  cooldownPeriod: 120                                         │
│  idleReplicaCount: 1     (완전 0 대신 1 유지)                │
│                                                               │
│  방안 3: offsetResetPolicy 설정                               │
│  offsetResetPolicy: earliest (만료 시 처음부터)               │
│  offsetResetPolicy: latest (만료 시 최신부터, 데이터 손실)    │
└──────────────────────────────────────────────────────────────┘
```

### 문제 5: 인증 실패 시 동작

**증상:** TriggerAuthentication의 Secret이 삭제되거나 만료된 경우

**동작:** KEDA는 메트릭 수집 실패로 처리하며, `fallback` 설정이 있으면 폴백 복제본 수로 전환.
         fallback이 없으면 마지막 성공 메트릭 기준으로 유지.

```
⚠ 주의: fallback이 설정되지 않은 상태에서 인증 실패가 발생하면
  KEDA는 에러를 로깅하지만 복제본 수는 변경하지 않는다.
  이는 스케일 아웃이 필요한 상황에서 Pod 부족으로 이어질 수 있다.
  반드시 fallback을 설정할 것.
```

### 문제 6: 메트릭 지연 — 총 반응 시간 분석

**전체 메트릭 파이프라인 지연:**

```
┌──────────────────────────────────────────────────────────────────┐
│  이벤트 발생부터 Pod 스케일링까지 총 지연 시간                    │
│                                                                  │
│  1. Prometheus scrape interval:     15초 (기본)                  │
│  2. KEDA pollingInterval:           30초 (기본)                  │
│  3. HPA sync period:                15초 (기본)                  │
│  4. Pod 스케줄링 + 시작:            5~15초                       │
│  ──────────────────────────────────────────                      │
│  총 최악의 경우:                    65~75초                      │
│                                                                  │
│  최적화 후:                                                      │
│  1. Prometheus scrape interval:     5초                          │
│  2. KEDA pollingInterval:           5초                          │
│  3. HPA sync period:                15초 (변경 어려움)           │
│  4. Pod 스케줄링 + 시작:            5초 (이미지 프리캐싱)        │
│  ──────────────────────────────────────────                      │
│  총 최적화 후:                      30초                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. 비용 최적화

### Scale-to-Zero 비용 절감 계산 공식

```
┌──────────────────────────────────────────────────────────────────┐
│  월간 비용 절감 공식                                             │
│                                                                  │
│  절감액 = Pod_비용 * (1 - 활성_비율) * Pod_수 * 30일             │
│                                                                  │
│  예시: order-worker (CPU: 500m, Memory: 1Gi)                     │
│                                                                  │
│  Pod 비용 (AWS m6i.xlarge 기준):                                 │
│    CPU: 0.5 core * $0.048/core/hr = $0.024/hr                   │
│    Memory: 1 GiB * $0.006/GiB/hr = $0.006/hr                   │
│    Pod 시간당: $0.030/hr                                         │
│                                                                  │
│  HPA (minReplicas: 1, 항상 가동):                                │
│    월 비용 = $0.030 * 24hr * 30일 = $21.60/Pod/월               │
│                                                                  │
│  KEDA (scale-to-zero, 하루 2시간 활성):                          │
│    월 비용 = $0.030 * 2hr * 30일 = $1.80/Pod/월                 │
│                                                                  │
│  절감액: $21.60 - $1.80 = $19.80/Pod/월 (91.7% 절감)            │
│                                                                  │
│  10개 마이크로서비스 적용 시:                                    │
│  월 $198.00 절감, 연간 $2,376.00 절감                            │
└──────────────────────────────────────────────────────────────────┘
```

### Dev/Staging 환경: Cron 스케일러 야간/주말 0 스케일

개발/스테이징 환경은 업무 시간 외에 사용되지 않으므로,
Cron 스케일러로 야간과 주말에 자동으로 0으로 스케일한다.

```yaml
# Dev/Staging 환경 전체 서비스에 적용
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: dev-environment-cron-scaler
  namespace: dev
spec:
  scaleTargetRef:
    name: api-service                        # 각 서비스별 생성
  minReplicaCount: 0                         # 야간/주말에는 0
  maxReplicaCount: 3
  triggers:
    # 평일 업무 시간에만 활성화
    - type: cron
      metadata:
        timezone: "Asia/Seoul"
        start: "0 9 * * 1-5"                # 평일 09:00
        end: "0 20 * * 1-5"                  # 평일 20:00
        desiredReplicas: "1"                 # 업무 시간에는 1개
```

**비용 절감 계산:**
- 주당 업무 시간: 11시간 * 5일 = 55시간
- 주당 전체 시간: 168시간
- 활성 비율: 55/168 = 32.7%
- **비용 절감: 67.3%**

### Spot/Preemptible 인스턴스 + KEDA + Karpenter 통합 패턴

```
┌──────────────────────────────────────────────────────────────────┐
│           Spot 인스턴스 + KEDA + Karpenter 통합 패턴             │
│                                                                  │
│  1. KEDA가 이벤트 기반으로 Pod 스케일 아웃 요청                  │
│  2. Karpenter가 Pending Pod 감지                                 │
│  3. Karpenter가 Spot 인스턴스로 노드 프로비저닝                  │
│  4. Pod가 Spot 노드에 스케줄링                                   │
│  5. 작업 완료 후 KEDA가 스케일 인                                │
│  6. Karpenter가 유휴 Spot 노드 자동 종료                         │
│                                                                  │
│  Karpenter NodePool 설정 예시:                                   │
│  ┌─────────────────────────────────────────┐                    │
│  │  apiVersion: karpenter.sh/v1           │                    │
│  │  kind: NodePool                         │                    │
│  │  spec:                                  │                    │
│  │    template:                            │                    │
│  │      spec:                              │                    │
│  │        requirements:                    │                    │
│  │          - key: karpenter.sh/          │                    │
│  │                capacity-type            │                    │
│  │            operator: In                 │                    │
│  │            values: ["spot"]             │                    │
│  │          - key: node.kubernetes.io/     │                    │
│  │                instance-type            │                    │
│  │            operator: In                 │                    │
│  │            values:                      │                    │
│  │              - m6i.xlarge               │                    │
│  │              - m6i.2xlarge              │                    │
│  │              - m5.xlarge                │                    │
│  │        disruption:                      │                    │
│  │          consolidationPolicy:           │                    │
│  │            WhenEmptyOrUnderutilized     │                    │
│  │          consolidateAfter: 30s          │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  비용 절감 효과:                                                 │
│  - On-Demand 대비 Spot 할인: 60~90%                             │
│  - Scale-to-Zero 절감: 추가 50~90% (유휴 시간 비례)             │
│  - 복합 절감: 85~95%                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 실제 비용 절감 사례

| 사례 | 환경 | 절감율 | 상세 |
|------|------|--------|------|
| GPU 비용 절감 | GKE + KEDA + Scale-to-Zero | 92% | ML 추론 서비스, 하루 3시간 활성 |
| AWS 비용 절감 | EKS + KEDA + Karpenter + Spot | 45% | 마이크로서비스 15개, 이벤트 기반 |
| Kafka 소비자 효율 | KEDA Kafka Scaler | 62% 지연 감소 | Consumer Lag 기반 정확한 스케일링 |
| Dev/Staging 절감 | Cron Scaler + Scale-to-Zero | 70% | 20개 서비스, 야간/주말 0 스케일 |
| 배치 처리 효율 | ScaledJob + SQS | 78% | 영상 인코딩, 유휴 시 0 워커 |

---

## 13. FAQ

### Q1: KEDA를 설치하면 기존 HPA가 영향받나?

**아니요.** KEDA는 기존 HPA에 영향을 주지 않는다.
KEDA는 ScaledObject가 생성된 Deployment에 대해서만 새로운 HPA를 생성한다.
ScaledObject가 없는 Deployment의 기존 HPA는 그대로 작동한다.

단, **동일 Deployment에 ScaledObject와 수동 HPA가 모두 존재하면 충돌**이 발생한다.
KEDA Admission Webhook이 이를 감지하여 경고한다.

### Q2: KEDA와 Prometheus Adapter를 동시에 사용할 수 있나?

**조건부 가능.** 두 시스템 모두 `external.metrics.k8s.io` API를 등록하려 하면 충돌한다.

해결 방법:
1. **Prometheus Adapter를 `custom.metrics.k8s.io`에 등록**, KEDA를 `external.metrics.k8s.io`에 등록 → 공존 가능
2. **Prometheus Adapter를 제거**하고 KEDA의 Prometheus 스케일러로 대체 → 권장

대부분의 경우 KEDA의 Prometheus 스케일러가 Prometheus Adapter의 기능을 완전히 대체할 수 있다.

### Q3: ScaledObject vs ScaledJob 어떤 것을 선택해야 하나?

| 기준 | ScaledObject | ScaledJob |
|------|-------------|-----------|
| 워크로드 패턴 | 지속 실행 (Long-Running) | 일회성 실행 (Run-to-Completion) |
| K8s 리소스 | Deployment, StatefulSet | Job |
| 메시지 처리 | Consumer가 계속 실행되며 메시지 수신 | 메시지당 Job 1개 생성 |
| 초기화 비용 | 낮음 (Pod 재사용) | 높음 (매번 새 Pod) |
| 격리성 | 낮음 (Pod 공유) | 높음 (Job당 독립 Pod) |

**ScaledObject 선택:** Kafka/RabbitMQ Consumer, HTTP 서비스, 스트림 처리
**ScaledJob 선택:** CI/CD 빌드, 영상 인코딩, ML 배치 추론, 1회성 데이터 처리

### Q4: Scale-to-Zero가 HTTP 서비스에 적합한가?

**일반적으로 부적합.** HTTP 서비스는 사용자 요청에 즉시 응답해야 하므로,
Scale-to-Zero의 콜드 스타트 지연(수 초~수십 초)이 사용자 경험을 저하시킨다.

**적합한 경우:**
- 내부 API (사용자 대면이 아닌)
- 개발/스테이징 환경
- 트래픽이 극히 드문 서비스 (하루 수 회)

**대안:**
- `idleReplicaCount: 1` 설정으로 최소 1개 Pod 유지
- KEDA HTTP Add-on 사용 (요청 버퍼링 + 프록시)
- Knative Serving (Queue Proxy로 요청 대기)

### Q5: KEDA 자체의 리소스 소비는 얼마인가?

| 컴포넌트 | CPU 요청 | Memory 요청 | 비고 |
|----------|---------|-------------|------|
| keda-operator | 100m | 128Mi | ScaledObject 수에 비례하여 증가 |
| keda-metrics-apiserver | 100m | 128Mi | HPA 메트릭 쿼리 빈도에 비례 |
| keda-admission-webhooks | 50m | 64Mi | CRD 생성/수정 시에만 활성 |

**실측치 (100개 ScaledObject 기준):**
- keda-operator: CPU 200~400m, Memory 256~512Mi
- keda-metrics-apiserver: CPU 100~200m, Memory 128~256Mi

KEDA 자체의 리소스 비용은 Scale-to-Zero로 절감하는 비용에 비해 무시할 수 있는 수준이다.

### Q6: KEDA HTTP Add-on vs Knative Serving 어떤 것이 좋은가?

| 항목 | KEDA HTTP Add-on | Knative Serving |
|------|-------------------|-----------------|
| 복잡성 | 낮음 (KEDA 확장) | 높음 (별도 스택) |
| Scale-to-Zero | 지원 | 지원 |
| 요청 버퍼링 | 지원 (interceptor proxy) | 지원 (queue-proxy) |
| 트래픽 분할 | 미지원 | 지원 (Revision 기반) |
| 기존 Deployment 호환 | 높음 | 자체 Service CRD 필요 |
| 의존성 | KEDA만 필요 | Istio/Kourier + Knative |
| 성숙도 | 상대적 초기 | 안정 (CNCF Incubating) |

**KEDA HTTP Add-on 선택:** 이미 KEDA를 사용 중이고, HTTP 서비스에도 Scale-to-Zero를 적용하고 싶은 경우
**Knative Serving 선택:** 트래픽 분할, Revision 관리, 서버리스 추상화가 필요한 경우

### Q7: 여러 트리거를 동시에 사용하면 어떻게 동작하나?

기본 동작: 각 트리거가 독립적으로 복제본 수를 계산하고, **가장 높은 값**이 선택된다.

```
트리거 1 (Kafka Lag):   계산 결과 = 5 Pod
트리거 2 (Prometheus):  계산 결과 = 3 Pod
트리거 3 (Cron):        계산 결과 = 10 Pod
──────────────────────────────────────
최종 결과:              max(5, 3, 10) = 10 Pod
```

`scalingModifiers`(v2.18+)를 사용하면 트리거 간 수식을 정의할 수 있다:

```yaml
advanced:
  scalingModifiers:
    target: "2"
    formula: "(kafka_lag + prometheus_rate) / 2"   # 평균
    # formula: "kafka_lag * 0.7 + prometheus_rate * 0.3"  # 가중 평균
```

### Q8: fallback이 작동하지 않는 경우는?

fallback은 **메트릭 수집 실패** 시에만 작동한다. 다음 경우에는 작동하지 않는다:

1. **메트릭 값이 0인 경우:** 이는 실패가 아닌 정상 응답이므로 fallback 미작동 (scale-to-zero 진행)
2. **ScaledObject 최초 생성 시:** 처음부터 메트릭 수집에 실패하면 fallback이 작동하지 않을 수 있음
3. **인증 만료 전 마지막 성공 응답:** TriggerAuthentication의 토큰이 만료되기 직전까지는 정상 응답으로 처리

```
⚠ fallback.replicas는 maxReplicaCount를 초과할 수 없다.
  fallback.replicas: 20, maxReplicaCount: 10 → 실제 폴백: 10
```

### Q9: KEDA + VPA를 함께 사용할 수 있나?

**가능하지만 주의 필요.** KEDA는 수평 스케일링(HPA), VPA는 수직 스케일링을 담당하므로
역할이 다르다. 그러나 Kubernetes 공식 문서에서는 **HPA와 VPA를 동일 메트릭(CPU/Memory)으로
동시에 사용하는 것을 권장하지 않는다.**

안전한 조합:
- KEDA: 외부 메트릭(Kafka Lag, SQS 큐 깊이) 기반 수평 스케일링
- VPA: CPU/Memory 기반 수직 스케일링 (UpdateMode: "Off" 또는 "Initial"로 설정)

### Q10: KEDA가 지원하는 최소 Kubernetes 버전은?

| KEDA 버전 | 최소 K8s 버전 | 권장 K8s 버전 |
|-----------|-------------|-------------|
| v2.19 | v1.28 | v1.29+ |
| v2.16~v2.18 | v1.27 | v1.28+ |
| v2.12~v2.15 | v1.26 | v1.27+ |
| v2.10~v2.11 | v1.24 | v1.26+ |
| v2.8~v2.9 | v1.23 | v1.25+ |

KEDA는 일반적으로 **최신 K8s 3개 마이너 버전**을 지원한다.
K8s 버전 업그레이드 시 KEDA도 호환 버전으로 업그레이드해야 한다.

---

## 14. 요약 및 키워드

### 핵심 요약

```
┌──────────────────────────────────────────────────────────────────┐
│                    KEDA 핵심 정리                                 │
│                                                                  │
│  1. KEDA는 HPA를 대체하지 않고, HPA와 협력하여 작동한다          │
│     - 0↔1: KEDA 직접 관리                                       │
│     - 1↔N: HPA가 관리 (KEDA가 메트릭 제공)                      │
│                                                                  │
│  2. 90+ 스케일러로 거의 모든 외부 이벤트 소스에 대응              │
│     - 메시징, 데이터베이스, 메트릭, CI/CD, 스케줄링               │
│                                                                  │
│  3. Scale-to-Zero는 KEDA의 가장 강력한 차별점                    │
│     - 유휴 워크로드의 리소스 비용을 0으로 절감                    │
│     - 콜드 스타트가 허용되는 워크로드에 적합                      │
│                                                                  │
│  4. ScaledObject(장기 실행) vs ScaledJob(일회성 실행)             │
│     - 워크로드 패턴에 맞는 CRD 선택                              │
│                                                                  │
│  5. TriggerAuthentication으로 보안 자격 증명을 안전하게 관리      │
│     - 8가지 인증 방법 지원 (Secret, IRSA, Vault 등)              │
│                                                                  │
│  6. 프로덕션 필수 설정:                                          │
│     - fallback: 메트릭 소스 장애 대비 안전망                     │
│     - maxReplicaCount: 인프라 한계 보호                          │
│     - cooldownPeriod + HPA behavior: 플래핑 방지                 │
│     - Graceful Shutdown: 진행 중 작업 보호                       │
│                                                                  │
│  7. CNCF Graduated 프로젝트 (2023-08-22)                         │
│     - 45+ 프로덕션 사용 조직                                    │
│     - FedEx, Reddit, Xbox, Alibaba Cloud 등                      │
└──────────────────────────────────────────────────────────────────┘
```

### 의사결정 요약 테이블

| 상황 | 선택 | 이유 |
|------|------|------|
| CPU/Memory 기반 스케일링만 필요 | HPA | 추가 설치 불필요 |
| 메시지 큐 기반 Consumer 스케일링 | KEDA ScaledObject | Consumer Group Lag 네이티브 지원 |
| 유휴 워크로드 비용 절감 | KEDA Scale-to-Zero | minReplicaCount: 0 |
| CI/CD 빌드 러너 동적 프로비저닝 | KEDA ScaledJob | Job 기반 1회성 실행 |
| Cron 기반 예약 스케일링 | KEDA Cron Scaler | 시간대별 복제본 수 지정 |
| 여러 메트릭 조합 스케일링 | KEDA scalingModifiers | 수식 기반 복합 메트릭 |
| 개발 환경 야간 셧다운 | KEDA Cron + Scale-to-Zero | 67~70% 비용 절감 |
| HTTP 서비스 Scale-to-Zero | KEDA HTTP Add-on | 요청 버퍼링으로 콜드 스타트 완화 |

### 키워드

`KEDA` `ScaledObject` `ScaledJob` `HPA` `Event-Driven Autoscaling`
`Scale-to-Zero` `TriggerAuthentication` `ClusterTriggerAuthentication`
`Kafka Scaler` `RabbitMQ Scaler` `AWS SQS Scaler` `Prometheus Scaler`
`Cron Scaler` `PostgreSQL Scaler` `GitHub Runner Scaler`
`External Scaler` `HTTP Add-on` `CNCF Graduated`
`pollingInterval` `cooldownPeriod` `activationValue` `threshold`
`fallback` `idleReplicaCount` `scalingModifiers`
`Consumer Group Lag` `Queue Depth` `Custom Metrics`
`Karpenter` `Cluster Autoscaler` `Spot Instance`
`Graceful Shutdown` `Admission Webhook` `Metrics API Aggregation`

