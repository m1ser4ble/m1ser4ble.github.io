---
layout: single
title: "VirtualService와 트래픽 라우팅"
date: 2026-03-03 23:00:00 +0900
categories: infra
tags: [infra, network, web, proxy]
excerpt: "리버스 프록시는 외부 요청을 중재해 보안과 확장성을 높이는 핵심 인프라 컴포넌트다."
source: "/home/dwkim/dwkim/docs/cloud/virtualservice-트래픽라우팅.md"


---

**TL;DR**
- VirtualService
- DestinationRule
- Gateway

## 1. Concept
VirtualService와 트래픽 라우팅의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. Background
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. Reason
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. Features
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. Detailed Notes

# VirtualService와 트래픽 라우팅

> **작성일**: 2026-03-03
> **카테고리**: Cloud / Kubernetes / Istio / Traffic Management
> **포함 내용**: VirtualService, DestinationRule, Gateway, Traffic Routing, Canary, A/B Testing, Fault Injection, Traffic Mirroring, Kubernetes Gateway API

---

# 1. VirtualService란?

## 정의

```
┌─────────────────────────────────────────────────────────────────┐
│                        VirtualService                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  VirtualService = Istio의 CRD (Custom Resource Definition)       │
│                   networking.istio.io API 그룹                   │
│                                                                   │
│  핵심 질문:                                                      │
│  "트래픽이 host X에 도달하면 실제로 무엇이 일어나야 하는가?"    │
│                                                                   │
│  이름의 의미:                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  "Virtual" = 클라이언트가 사용하는 논리적 이름과           │ │
│  │              실제 물리적 백엔드를 분리한다                  │ │
│  │                                                              │ │
│  │  클라이언트 → "reviews" 호출 (논리적 이름)                  │ │
│  │  실제 라우팅 → reviews-v1 (90%), reviews-v2 (10%)           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## K8s Service vs VirtualService 비교

```
┌──────────────────────┬──────────────────────────┬────────────────────────────────┐
│  비교 항목           │  K8s Service             │  VirtualService                │
├──────────────────────┼──────────────────────────┼────────────────────────────────┤
│  OSI Layer           │  L3/L4 (IP + port)       │  L7 (HTTP, gRPC, headers)     │
│  라우팅 구현         │  kube-proxy / iptables   │  Envoy 프록시                  │
│  트래픽 분배         │  Round-robin (pod 수)    │  가중치 기반 (정확한 %)        │
│  버전 인식           │  없음                    │  라벨 기반 subset 라우팅       │
│  재시도 / 타임아웃   │  없음                    │  HTTP 시맨틱 지원              │
│  장애 주입           │  없음                    │  delay / abort 주입 가능       │
│  헤더 기반 라우팅    │  불가                    │  헤더, 쿠키, URI 모두 가능     │
│  트래픽 미러링       │  불가                    │  mirror + mirrorPercentage     │
│  URL 리라이팅        │  불가                    │  rewrite.uri, redirect         │
│  적용 범위           │  클러스터 내 DNS         │  Mesh 내 + Gateway 외부 트래픽 │
└──────────────────────┴──────────────────────────┴────────────────────────────────┘
```

---

# 2. 등장 배경 - 왜 만들어졌나?

## 2.1 Kubernetes Service의 한계

```
┌─────────────────────────────────────────────────────────────────┐
│              Kubernetes Service의 구조적 한계                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  kube-proxy 동작 방식:                                          │
│                                                                   │
│  클라이언트 → iptables 규칙 → Pod 선택 (랜덤 Round-robin)       │
│                                                                   │
│  한계 1: L4 전용                                                 │
│  ├── TCP/UDP 포트만 이해                                         │
│  ├── HTTP 헤더 검사 불가                                         │
│  └── /api/v1 vs /api/v2 경로 구분 불가                          │
│                                                                   │
│  한계 2: 버전 인식 없음                                          │
│  ├── version: v1 라벨이 있어도 라우팅에 사용 불가               │
│  └── 카나리: 9개 v1 + 1개 v2 Pod으로 10% 분배 (부정확)         │
│                                                                   │
│  한계 3: 재시도 / 타임아웃 시맨틱 없음                          │
│  ├── 503 응답 받아도 그냥 클라이언트에 전달                     │
│  └── 각 서비스 코드에서 직접 구현해야 함                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 Kubernetes Ingress의 한계

```
┌─────────────────────────────────────────────────────────────────┐
│              Kubernetes Ingress의 구조적 한계                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  한계 1: Annotation 지옥                                         │
│  ├── 모든 고급 기능 → 컨트롤러별 비표준 annotation              │
│  ├── nginx: nginx.ingress.kubernetes.io/...                      │
│  ├── traefik: traefik.ingress.kubernetes.io/...                  │
│  └── 이식성 없음. 컨트롤러 교체 = 전체 재작성                  │
│                                                                   │
│  한계 2: North-South 전용                                        │
│  ├── 외부(인터넷) → 클러스터 내부 트래픽만 처리                 │
│  └── East-West (서비스 간) 트래픽은 관리 불가                   │
│                                                                   │
│  한계 3: 기능 부재                                               │
│  ├── 트래픽 분할 없음 (가중치 기반)                             │
│  ├── 재시도 / 타임아웃 없음                                      │
│  └── 장애 주입 없음                                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.3 VirtualService의 탄생 - RouteRule에서 VirtualService로

```
┌─────────────────────────────────────────────────────────────────┐
│                VirtualService 진화 역사                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1 (2017.05) - Istio 0.1                                   │
│  ├── Google + IBM + Lyft 공동 출시                               │
│  ├── RouteRule 리소스 사용                                       │
│  └── 문제: 여러 RouteRule이 precedence 순서로 분산               │
│           → 설정 간 충돌, 에러 발생 쉬움                        │
│                                                                   │
│  Phase 2 (2018) - Istio 0.8, v1alpha3 API 도입                  │
│  ├── VirtualService, DestinationRule, Gateway, ServiceEntry 등장 │
│  ├── 설계 원칙:                                                  │
│  │   ├── Producer-Oriented: 서비스 오너가 정책 정의              │
│  │   ├── 인프라 명시적 모델링                                    │
│  │   └── 라우팅 / 정책 분리 (VS vs DR)                          │
│  └── 안정적이지만 "alpha" 딱지로 오랜 기간 유지                 │
│                                                                   │
│  Phase 3 (2024.05) - Istio 1.22                                  │
│  └── v1 API로 승격 → GA (Generally Available, 안정 버전)        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. 내부 동작 원리

## 3.1 Envoy 사이드카 트래픽 가로채기

```
┌─────────────────────────────────────────────────────────────────┐
│              Envoy 사이드카의 트래픽 가로채기                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Pod 내부 구조:                                                  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Pod                                                       │  │
│  │  ┌─────────────────┐    ┌──────────────────────────────┐  │  │
│  │  │   App 컨테이너  │    │   istio-proxy (Envoy)         │  │  │
│  │  │                 │    │                              │  │  │
│  │  │  localhost:8080 │    │  iptables 규칙으로           │  │  │
│  │  │  에만 바인딩    │    │  모든 인/아웃바운드 가로채기 │  │  │
│  │  └────────┬────────┘    └──────────────┬───────────────┘  │  │
│  │           │  평문 통신                  │  외부 통신       │  │
│  │           └─────────────────────────────┘                  │  │
│  │  initContainer가 iptables 규칙 설정                        │  │
│  │  → 앱이 네트워크와 직접 통신하지 않음                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  💡 핵심 포인트:                                                 │
│     애플리케이션 코드는 전혀 수정하지 않아도 된다!              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Istiod(Pilot)의 설정 변환 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│              Istiod 설정 변환 파이프라인                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   VirtualService YAML                                            │
│         │                                                         │
│         ▼                                                         │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                  Istiod (Control Plane)                   │  │
│   │  1. K8s API 감시 (Watch)                                  │  │
│   │  2. 내부 모델 구축 (Service Discovery)                    │  │
│   │  3. Envoy 설정 생성 (Config Generation)                   │  │
│   │  4. xDS 프로토콜로 배포 (Push to Envoy)                   │  │
│   └───────────────────────┬──────────────────────────────────┘  │
│                            │ xDS (gRPC 스트리밍)                 │
│                            ▼                                      │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                  Envoy 사이드카들                          │  │
│   │  각 Pod의 Envoy가 실시간으로 설정을 받아 적용             │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  xDS 변환 매핑:                                                  │
│  ┌──────────┬──────────────────────────────────────────────┐    │
│  │  xDS 타입│  내용                                        │    │
│  ├──────────┼──────────────────────────────────────────────┤    │
│  │  LDS     │  포트 수준 리스너 (Listener Discovery)        │    │
│  │  RDS     │  HTTP 라우팅 규칙 ← VirtualService 주 대상   │    │
│  │  CDS     │  upstream 서비스 풀 (DestinationRule subset)  │    │
│  │  EDS     │  실제 Pod IP:port (Endpoint Discovery)        │    │
│  └──────────┴──────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 VirtualService YAML → Envoy Route Config 변환

```yaml
# VirtualService YAML (사람이 작성)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            end-user:
              exact: jason
      route:
        - destination:
            host: reviews
            subset: v2
    - route:
        - destination:
            host: reviews
            subset: v1
```

```
# Istiod가 위 YAML을 Envoy Route Configuration으로 변환

VirtualService 필드          →  Envoy 설정
─────────────────────────────────────────────────────
http[].match.headers         →  route matcher (header_matcher)
http[].match.uri             →  route matcher (prefix_rewrite)
destination.host + subset    →  cluster name
                                (outbound|80|v2|reviews.default.svc.cluster.local)
timeout                      →  route_config.timeout
retries                      →  route_config.retry_policy
fault.delay                  →  route_config.typed_per_filter_config (fault filter)
```

## 3.4 핵심: 소스 프록시가 규칙을 실행

```
┌─────────────────────────────────────────────────────────────────┐
│              소스 프록시 실행 원칙 (매우 중요!)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  service-a가 service-b를 호출할 때:                              │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │   service-a Pod  │         │      service-b Pod           │  │
│  │ ┌──────────────┐ │         │ ┌──────────────────────────┐ │  │
│  │ │   App        │ │         │ │   App                    │ │  │
│  │ └──────┬───────┘ │         │ └──────────────────────────┘ │  │
│  │        │         │         │ ┌──────────────────────────┐ │  │
│  │ ┌──────▼───────┐ │         │ │   Envoy                  │ │  │
│  │ │   Envoy      │─┼────────►│ │  (수신만 할 뿐)          │ │  │
│  │ │              │ │         │ │                          │ │  │
│  │ │ ← 여기서!    │ │         │ └──────────────────────────┘ │  │
│  │ │ service-b의  │ │         └──────────────────────────────┘  │
│  │ │ VS 규칙이    │ │                                            │
│  │ │ 평가됨       │ │                                            │
│  │ └──────────────┘ │                                            │
│  └──────────────────┘                                            │
│                                                                   │
│  💡 핵심 포인트:                                                 │
│     라우팅 규칙은 목적지 프록시가 아닌                           │
│     소스 프록시(호출하는 쪽의 Envoy)에서 평가됨!               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.5 VirtualService, DestinationRule, Gateway의 관계

```
┌─────────────────────────────────────────────────────────────────┐
│         Gateway - VirtualService - DestinationRule 3계층        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  외부 트래픽                                                     │
│       │                                                           │
│       ▼                                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Gateway                                                    │ │
│  │  "어떤 연결을 받을지"                                       │ │
│  │  ├── L4/L5 설정 (포트, TLS 모드, SNI)                      │ │
│  │  └── hosts: ["*.example.com"]                               │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                             │ 연결 허용됨                        │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  VirtualService                                             │ │
│  │  "어디로, 어떻게"                                           │ │
│  │  ├── L7 라우팅 규칙 (URI, 헤더, 가중치)                    │ │
│  │  └── gateways: [my-gateway, mesh]                           │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                             │ subset: v2 로 라우팅               │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  DestinationRule                                            │ │
│  │  "도착 후 정책"                                             │ │
│  │  ├── subset 정의 (v1이 무엇인지 = labels: version: v1)     │ │
│  │  ├── 로드밸런싱 알고리즘 (ROUND_ROBIN, LEAST_CONN)         │ │
│  │  └── Circuit Breaker, Connection Pool 설정                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. 왜 필요한가? - 해결하는 문제들

## 4.1 카나리 배포 (Weighted Routing)

```
┌─────────────────────────────────────────────────────────────────┐
│                      카나리 배포 비교                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ❌ K8s Service만 사용:                                          │
│     9개 v1 Pod + 1개 v2 Pod = 약 10% (부정확, Pod 수에 의존)   │
│     트래픽 조정 = Pod 수 조정 (느리고 비경제적)                 │
│                                                                   │
│  ✅ VirtualService 사용:                                         │
│     1개 v1 Pod + 1개 v2 Pod → weight: 90/10 (정확한 %)          │
│     트래픽 조정 = YAML 한 줄 변경 (즉각적)                      │
│                                                                   │
│  트래픽 흐름:                                                    │
│                                                                   │
│  클라이언트                                                      │
│      │                                                            │
│      ▼                                                            │
│  VirtualService                                                   │
│      ├── 90% ────────────────────► reviews-v1 Pod               │
│      └── 10% ────────────────────► reviews-v2 Pod               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# 카나리 배포 - VirtualService
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: default
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 90
        - destination:
            host: reviews
            subset: v2
          weight: 10

---
# 카나리 배포 - DestinationRule (subset 정의)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

## 4.2 A/B 테스트 (Header / Cookie 기반 라우팅)

```
┌─────────────────────────────────────────────────────────────────┐
│                    A/B 테스트 라우팅 흐름                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  요청 A: X-User-Group: beta 헤더 포함                           │
│      └──────────────────────────────────────► 신규 버전 (v2)    │
│                                                                   │
│  요청 B: 헤더 없음 (일반 사용자)                                │
│      └──────────────────────────────────────► 안정 버전 (v1)    │
│                                                                   │
│  쿠키 기반 예시:                                                 │
│  요청 C: Cookie: user=beta_tester_123                           │
│      └──────────────────────────────────────► v2                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# A/B 테스트 - 헤더 + 쿠키 기반 라우팅
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    # 조건 1: 특정 헤더 값 매칭
    - match:
        - headers:
            X-User-Group:
              exact: beta
      route:
        - destination:
            host: reviews
            subset: v2

    # 조건 2: 쿠키 regex 매칭
    - match:
        - headers:
            Cookie:
              regex: ".*user=beta.*"
      route:
        - destination:
            host: reviews
            subset: v2

    # 기본: 나머지 모든 트래픽
    - route:
        - destination:
            host: reviews
            subset: v1
```

## 4.3 트래픽 미러링 (Shadow Testing)

```
┌─────────────────────────────────────────────────────────────────┐
│                   트래픽 미러링 동작 방식                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  실제 요청                                                       │
│      │                                                            │
│      ├──────── 실제 처리 ────────► v1 (응답 반환)               │
│      │                                                            │
│      └──────── 복사본 전송 ───────► v2 (fire-and-forget)        │
│                                       ├── v2 응답을 기다리지 않음│
│                                       ├── v2 에러는 무시         │
│                                       └── 성능 영향 최소화       │
│                                                                   │
│  활용: v2를 실제 프로덕션 트래픽으로 검증                       │
│        (사용자 영향 없이 새 버전 테스트)                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# 트래픽 미러링 설정
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 100
      # v1으로 가는 트래픽의 20%를 v2로도 미러링
      mirror:
        host: reviews
        subset: v2
      mirrorPercentage:
        value: 20.0
```

## 4.4 장애 주입 (Chaos Engineering)

```
┌─────────────────────────────────────────────────────────────────┐
│                장애 주입 - Fault Injection                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  두 가지 장애 유형:                                              │
│                                                                   │
│  1. delay (지연 주입)                                            │
│     └── 특정 % 요청에 인위적 지연 추가                          │
│         → 네트워크 지연, 서비스 느려짐 시뮬레이션               │
│                                                                   │
│  2. abort (에러 주입)                                            │
│     └── 특정 % 요청에 HTTP 에러 코드 반환                       │
│         → 서비스 다운, 에러 응답 시뮬레이션                     │
│                                                                   │
│  ⚠️  주의:                                                       │
│  fault injection과 retry를 같은 route에 동시 사용 불가          │
│  (설정 자체가 거부됨)                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# 장애 주입 설정
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
    - ratings
  http:
    - match:
        - headers:
            X-Test-Fault:
              exact: "true"
      fault:
        # 지연 주입: 50% 요청에 7초 지연
        delay:
          percentage:
            value: 50.0
          fixedDelay: 7s
        # 에러 주입: 10% 요청에 503 반환
        abort:
          percentage:
            value: 10.0
          httpStatus: 503
      route:
        - destination:
            host: ratings
            subset: v1
    # 정상 트래픽
    - route:
        - destination:
            host: ratings
            subset: v1
```

## 4.5 타임아웃 / 재시도 정책

```yaml
# 타임아웃 + 재시도 설정
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
      # 요청 타임아웃: 3초
      timeout: 3s
      # 재시도 정책
      retries:
        attempts: 3              # 최대 3회 재시도
        perTryTimeout: 1s        # 1회 시도당 타임아웃
        retryOn: "gateway-error,connect-failure,retriable-4xx"
        # retriable-4xx: 429 Too Many Requests 등 재시도 가능 4xx
```

```
┌─────────────────────────────────────────────────────────────────┐
│                  타임아웃 + 재시도 시나리오                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  총 타임아웃: 3s                                                 │
│  시도 1: 0.0s ~ 1.0s → 503 응답 → 재시도                       │
│  시도 2: 1.0s ~ 2.0s → 503 응답 → 재시도                       │
│  시도 3: 2.0s ~ 3.0s → 성공 → 응답 반환                        │
│                                                                   │
│  💡 retryOn 값 설명:                                             │
│  ├── gateway-error: 502, 503, 504                                │
│  ├── connect-failure: 연결 실패                                  │
│  └── retriable-4xx: 429 (Rate Limit) 등                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 4.6 URL 리라이팅 / 리다이렉트

```yaml
# URL 리라이팅 설정
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: api-gateway
spec:
  hosts:
    - api.example.com
  gateways:
    - api-gateway
  http:
    # URI 리라이팅: /v1/users → /users (백엔드에는 /users로 전달)
    - match:
        - uri:
            prefix: /v1/users
      rewrite:
        uri: /users
      route:
        - destination:
            host: user-service
            port:
              number: 80

    # HTTP → HTTPS 리다이렉트
    - match:
        - uri:
            prefix: /old-path
      redirect:
        uri: /new-path
        authority: api.example.com
        redirectCode: 301
```

## 4.7 Blue-Green 배포

```
┌─────────────────────────────────────────────────────────────────┐
│                   Blue-Green 배포 전환 흐름                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  단계 1: Blue(v1) 운영 중                                        │
│  weight: v1=100, v2=0                                            │
│                                                                   │
│  단계 2: Green(v2) 배포 및 검증 (트래픽 0%)                     │
│  weight: v1=100, v2=0                                            │
│  (내부 테스트 트래픽은 헤더 기반으로 v2 접근 가능)              │
│                                                                   │
│  단계 3: 전환                                                    │
│  weight: v1=0, v2=100                                            │
│  (YAML 변경 한 줄 → 즉각 전환)                                  │
│                                                                   │
│  단계 4: 문제 발생 시 즉시 롤백                                  │
│  weight: v1=100, v2=0                                            │
│  (K8s Deployment 롤백보다 훨씬 빠름)                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# Blue-Green 배포: 전환 전
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: my-service
spec:
  hosts:
    - my-service
  http:
    - route:
        - destination:
            host: my-service
            subset: blue    # v1
          weight: 100
        - destination:
            host: my-service
            subset: green   # v2 (새 버전)
          weight: 0

# 전환 후: weight만 변경
#        - destination:
#            subset: blue
#          weight: 0
#        - destination:
#            subset: green
#          weight: 100
```

## 4.8 모놀리스 분해 (Path 기반 멀티서비스 라우팅)

```
┌─────────────────────────────────────────────────────────────────┐
│              모놀리스를 마이크로서비스로 분해하는 패턴           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  클라이언트 요청                                                 │
│       │                                                           │
│       ▼                                                           │
│  VirtualService (api.example.com)                                │
│       ├── /users/* ──────────────────► user-service             │
│       ├── /orders/* ─────────────────► order-service            │
│       ├── /products/* ───────────────► product-service          │
│       └── /* (catch-all) ────────────► legacy-monolith          │
│                                                                   │
│  효과: 새 마이크로서비스를 점진적으로 분리                       │
│        모놀리스는 나머지 경로를 처리하면서 단계적 전환           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# 모놀리스 분해 - Path 기반 멀티서비스 라우팅
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: monolith-decomp
spec:
  hosts:
    - api.example.com
  gateways:
    - main-gateway
  http:
    - match:
        - uri:
            prefix: /users
      route:
        - destination:
            host: user-service
            port:
              number: 80

    - match:
        - uri:
            prefix: /orders
      route:
        - destination:
            host: order-service
            port:
              number: 80

    - match:
        - uri:
            prefix: /products
      route:
        - destination:
            host: product-service
            port:
              number: 80

    # 분리 안 된 기능은 여전히 모놀리스로
    - route:
        - destination:
            host: legacy-monolith
            port:
              number: 8080
```

---

# 5. K8s 네이티브 대안과의 비교

## 5.1 vs K8s Service

```
┌──────────────────────┬──────────────────────────┬────────────────────────────────┐
│  비교 항목           │  K8s Service             │  Istio VirtualService          │
├──────────────────────┼──────────────────────────┼────────────────────────────────┤
│  OSI Layer           │  L3/L4                   │  L7                            │
│  라우팅 구현         │  kube-proxy + iptables   │  Envoy (사이드카)              │
│  트래픽 분배         │  Round-robin             │  가중치, 헤더, URI 등          │
│  버전별 라우팅       │  불가                    │  subset으로 가능               │
│  타임아웃            │  없음                    │  timeout 필드                  │
│  재시도              │  없음                    │  retries 필드                  │
│  장애 주입           │  불가                    │  fault 필드                    │
│  헤더 기반 라우팅    │  불가                    │  match.headers                 │
│  트래픽 미러링       │  불가                    │  mirror + mirrorPercentage     │
│  URL 리라이팅        │  불가                    │  rewrite.uri                   │
│  추가 의존성         │  없음 (K8s 기본)         │  Istio 설치 필요               │
│  성능 오버헤드       │  거의 없음               │  사이드카 오버헤드 있음         │
└──────────────────────┴──────────────────────────┴────────────────────────────────┘
```

## 5.2 vs K8s Ingress

```
┌──────────────────────┬──────────────────────────┬────────────────────────────────┐
│  비교 항목           │  K8s Ingress             │  Gateway + VirtualService      │
├──────────────────────┼──────────────────────────┼────────────────────────────────┤
│  트래픽 방향         │  North-South 전용        │  North-South + East-West       │
│  경로 매칭           │  prefix, exact           │  prefix, exact, regex          │
│  헤더 매칭           │  annotation에 의존       │  네이티브 지원                  │
│  트래픽 분할         │  annotation (비표준)     │  weight 필드 (표준)            │
│  재시도 / 타임아웃   │  annotation (비표준)     │  네이티브 지원                  │
│  이식성              │  컨트롤러 종속            │  Istio 표준                    │
│  TLS 설정            │  annotation에 의존       │  Gateway에서 명시적 설정        │
│  장애 주입           │  불가                    │  가능                          │
│  East-West 트래픽    │  불가                    │  mesh 게이트웨이로 가능        │
└──────────────────────┴──────────────────────────┴────────────────────────────────┘
```

## 5.3 vs K8s Gateway API (새로운 표준)

```
┌─────────────────────────────────────────────────────────────────┐
│              Kubernetes Gateway API 개요                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  탄생 배경:                                                      │
│  ├── K8s SIG-Network 프로젝트                                    │
│  ├── Ingress의 annotation 지옥을 해결                           │
│  ├── Istio VirtualService에서 영감 받아 설계                    │
│  └── 포터블: Istio, Contour, NGINX 등 모든 구현체 지원          │
│                                                                   │
│  역할 기반 분리 (RBAC 친화적):                                   │
│  ├── GatewayClass: 인프라 팀이 관리                              │
│  ├── Gateway: 클러스터 운영자가 관리                             │
│  └── HTTPRoute: 개발 팀이 관리                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│  Istio 리소스                        │  Gateway API 리소스                  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  Gateway                             │  Gateway                             │
│  VirtualService                      │  HTTPRoute / TCPRoute / TLSRoute     │
│  DestinationRule                     │  BackendLBPolicy (실험적)            │
│  ServiceEntry                        │  별도 CRD 논의 중                    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

```
┌──────────────────────┬──────────────────────────┬────────────────────────────────┐
│  기능                │  Gateway API (HTTPRoute) │  Istio VirtualService          │
├──────────────────────┼──────────────────────────┼────────────────────────────────┤
│  헤더 기반 라우팅    │  지원                    │  지원                          │
│  가중치 기반 라우팅  │  지원                    │  지원                          │
│  URL 리라이팅        │  지원                    │  지원                          │
│  재시도              │  지원 (BackendLBPolicy)  │  지원                          │
│  장애 주입           │  미지원                  │  지원                          │
│  트래픽 미러링       │  미지원                  │  지원                          │
│  Circuit Breaking    │  미지원                  │  DestinationRule               │
│  EnvoyFilter         │  미지원                  │  지원                          │
│  이식성              │  높음 (표준 K8s API)     │  낮음 (Istio 종속)             │
│  RBAC 친화성         │  높음 (역할 기반 분리)   │  중간                          │
└──────────────────────┴──────────────────────────┴────────────────────────────────┘
```

```
💡 권장 전략:
   ├── 새로운 배포: Gateway API (HTTPRoute) 우선 고려
   ├── 고급 기능 필요시: VirtualService 추가 사용
   └── 두 방식은 Istio에서 공존 가능
```

---

# 6. 고급 사용 패턴

## 6.1 Mesh 내부 라우팅 (East-West)

```yaml
# gateways 필드 생략 = mesh 내부 트래픽에만 적용
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: default
spec:
  hosts:
    - reviews           # K8s Service 이름
  # gateways 없음 = 기본값: ["mesh"]
  # mesh = 모든 사이드카에서의 호출에 적용
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
```

## 6.2 외부 트래픽 라우팅 (Gateway와 함께)

```yaml
# Gateway + VirtualService 조합
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "bookinfo.example.com"

---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - "bookinfo.example.com"
  # gateways 명시: 외부 + 내부 모두 적용
  gateways:
    - bookinfo-gateway    # 외부 Gateway에서 오는 트래픽
    - mesh                # 내부 서비스 간 트래픽
  http:
    - match:
        - uri:
            exact: /productpage
        - uri:
            prefix: /static
      route:
        - destination:
            host: productpage
            port:
              number: 9080
```

## 6.3 Delegate VirtualService (위임)

```
┌─────────────────────────────────────────────────────────────────┐
│              Delegate VirtualService - 팀별 라우팅 분리          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  대규모 조직에서:                                                │
│  ├── 인프라 팀: Root VS (도메인 수준 라우팅) 관리               │
│  ├── 팀 A: /users/* 라우팅 관리 (user-ns)                      │
│  └── 팀 B: /orders/* 라우팅 관리 (order-ns)                    │
│                                                                   │
│  Root VS                                                         │
│      ├── /users/* ──► delegate → user-vs (user-ns)              │
│      └── /orders/* ─► delegate → order-vs (order-ns)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# Root VirtualService (인프라 팀 관리)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: root-vs
  namespace: istio-system
spec:
  hosts:
    - "api.example.com"
  gateways:
    - main-gateway
  http:
    - match:
        - uri:
            prefix: /users
      delegate:
        name: user-vs
        namespace: user-ns    # 다른 namespace로 위임

    - match:
        - uri:
            prefix: /orders
      delegate:
        name: order-vs
        namespace: order-ns

---
# Child VirtualService (팀 A가 관리)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: user-vs
  namespace: user-ns
spec:
  http:
    - match:
        - uri:
            prefix: /users/v2
      route:
        - destination:
            host: user-service-v2
    - route:
        - destination:
            host: user-service-v1
```

## 6.4 헤더 조작

```yaml
# 헤더 조작 - 요청/응답 헤더 추가/변경/삭제
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v2
      headers:
        request:
          set:
            X-Custom-Header: "injected-by-istio"   # 헤더 설정 (덮어쓰기)
          add:
            X-Request-Id: "generated"               # 헤더 추가 (중복 허용)
          remove:
            - X-Internal-Debug                      # 헤더 제거
        response:
          set:
            Cache-Control: "no-cache"               # 응답 헤더 설정
          remove:
            - X-Internal-Error-Details              # 내부 정보 제거
```

## 6.5 Cross-Namespace 라우팅

```yaml
# Cross-Namespace 라우팅 - exportTo 설정
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: team-a
spec:
  # 반드시 FQDN 사용 (cross-namespace에서 짧은 이름은 위험)
  hosts:
    - reviews.team-a.svc.cluster.local
  exportTo:
    - "."          # 현재 namespace만
    # - "*"        # 모든 namespace (기본값, 권장하지 않음)
    # - "team-b"   # 특정 namespace만
  http:
    - route:
        - destination:
            host: reviews.team-a.svc.cluster.local
            subset: v1
```

```
┌─────────────────────────────────────────────────────────────────┐
│              exportTo 값 설명                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  "."    → 현재 namespace에만 적용 (가장 안전)                   │
│  "*"    → 모든 namespace에 적용 (기본값, 주의 필요)             │
│  "foo"  → foo namespace에서만 접근 가능                         │
│                                                                   │
│  💡 핵심 포인트:                                                 │
│     cross-namespace 라우팅 시 짧은 hostname은 잘못된 서비스로   │
│     라우팅될 수 있음. FQDN 사용 필수!                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6.6 TCP / TLS 라우팅

```yaml
# TCP 라우팅 (MongoDB 등 non-HTTP 서비스)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: mongodb
spec:
  hosts:
    - mongodb
  tcp:
    - match:
        - port: 27017
      route:
        - destination:
            host: mongodb
            port:
              number: 27017
            subset: v1

---
# TLS 라우팅 (SNI 기반)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: tls-routing
spec:
  hosts:
    - "*.example.com"
  tls:
    - match:
        - port: 443
          sniHosts:
            - service-a.example.com
      route:
        - destination:
            host: service-a
    - match:
        - port: 443
          sniHosts:
            - service-b.example.com
      route:
        - destination:
            host: service-b
```

---

# 7. 프로덕션 Best Practices와 흔한 실수

## 7.1 Best Practices

```
┌─────────────────────────────────────────────────────────────────┐
│              프로덕션 Best Practices (8가지)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 기본 route 반드시 정의                                       │
│     ├── match 없는 catch-all route가 없으면 → 404/503           │
│     └── http[] 배열의 마지막 항목은 항상 match 없이             │
│                                                                   │
│  2. 프로덕션에서 FQDN 사용                                       │
│     ├── ❌ reviews                                               │
│     └── ✅ reviews.default.svc.cluster.local                    │
│                                                                   │
│  3. DestinationRule을 VirtualService보다 먼저 배포               │
│     ├── VS가 참조하는 subset이 없으면 503 발생                  │
│     └── DR 먼저 → VS 배포 순서 준수                             │
│                                                                   │
│  4. 보수적 retry 설정                                            │
│     ├── 최대 3회 + 짧은 perTryTimeout                           │
│     └── Circuit Breaker와 함께 사용 (DestinationRule)           │
│                                                                   │
│  5. exportTo로 가시성 제어                                       │
│     ├── 기본값 "*"는 모든 namespace에 적용                      │
│     └── 팀 namespace에는 "." 사용 권장                          │
│                                                                   │
│  6. hostname당 하나의 catch-all rule                             │
│     └── 동일 host에 여러 VS가 있으면 설정 충돌 발생            │
│                                                                   │
│  7. DestinationRule은 대상 서비스 namespace에 배치               │
│     └── 서비스와 같은 namespace에 DR 위치시켜 관리 명확화       │
│                                                                   │
│  8. route에 name 필드 사용                                       │
│     ├── 모니터링/트레이싱에서 route 이름 표시됨                 │
│     └── 디버깅 시 어떤 rule이 적용됐는지 바로 파악              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# Best Practice 예시: name 필드 + FQDN + catch-all
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: default
spec:
  hosts:
    - reviews.default.svc.cluster.local    # FQDN 사용
  http:
    - name: "beta-users"                   # route 이름
      match:
        - headers:
            X-User-Group:
              exact: beta
      route:
        - destination:
            host: reviews.default.svc.cluster.local
            subset: v2

    - name: "default"                      # catch-all에도 이름
      route:
        - destination:
            host: reviews.default.svc.cluster.local
            subset: v1                     # 기본 route 반드시 정의
```

## 7.2 흔한 실수 (Pitfalls)

```
┌──────────────────────────────┬──────────────────────┬──────────────────────────────┐
│  실수                        │  증상                │  해결책                      │
├──────────────────────────────┼──────────────────────┼──────────────────────────────┤
│  기본 route 없음             │  404 / 503           │  마지막 match 없는 route 추가│
│  VS 먼저, DR 나중 배포       │  503 (subset 없음)   │  DR → VS 배포 순서 준수      │
│  짧은 hostname cross-ns      │  잘못된 서비스 라우팅│  FQDN 사용 필수              │
│  fault injection + retries   │  설정 자체 거부됨    │  둘 중 하나만 사용           │
│  과도한 retry + no CB        │  장애 증폭 (Cascade) │  DestinationRule CB 추가     │
│  동일 host에 여러 VS         │  예측 불가 라우팅    │  VS 통합 또는 delegate 사용  │
│  exportTo: "*" (기본)        │  의도치 않은 노출    │  exportTo: ["."] 사용        │
└──────────────────────────────┴──────────────────────┴──────────────────────────────┘
```

## 7.3 가상 시나리오: VirtualService 누락으로 인한 트래픽 오류

```
┌─────────────────────────────────────────────────────────────────┐
│         가상 시나리오: 신규 서비스의 트래픽 오라우팅             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  상황:                                                           │
│  ├── 멀티 서비스 환경 (dev.example.com)                          │
│  ├── main-portal VirtualService가 wildcard로 설정됨              │
│  │   hosts: ["*.dev.example.com"]                                │
│  │   route: main-portal-service (catch-all)                      │
│  └── 새 서비스 order-service 배포 완료                          │
│                                                                   │
│  문제:                                                           │
│  order.dev.example.com 접속 시                                   │
│      ↓                                                            │
│  Gateway: *.dev.example.com 에 매칭                              │
│      ↓                                                            │
│  main-portal VirtualService가 포착 (wildcard)                    │
│      ↓                                                            │
│  main-portal 서비스로 라우팅 → 404 또는 잘못된 응답             │
│                                                                   │
│  원인:                                                           │
│  order-service의 VirtualService가 존재하지 않음                 │
│  → Gateway는 더 구체적인 VS를 찾지 못하고 wildcard VS 적용      │
│                                                                   │
│  해결:                                                           │
│  1. order-service VirtualService 작성                            │
│     hosts: ["order.dev.example.com"]                             │
│  2. kustomization.yaml에 추가                                    │
│  3. 구체적인 host 매칭이 wildcard보다 우선 적용됨              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# 문제: main-portal wildcard VirtualService
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: main-portal-wildcard
spec:
  hosts:
    - "*.dev.example.com"    # 모든 서브도메인을 포착
  gateways:
    - main-gateway
  http:
    - route:
        - destination:
            host: main-portal-service

---
# 해결: order-service 전용 VirtualService 추가
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: order-service-vs
spec:
  hosts:
    - "order.dev.example.com"    # 구체적 host가 wildcard보다 우선
  gateways:
    - main-gateway
  http:
    - route:
        - destination:
            host: order-service
            port:
              number: 80
```

---

# 8. 실제 엔터프라이즈 사용 사례

```
┌─────────────────────────────────────────────────────────────────┐
│              글로벌 기업들의 Istio / VirtualService 활용         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Airbnb                                                          │
│  ├── 수만 개 Pod, 수십 개 클러스터                               │
│  ├── 초당 수천만 QPS 처리                                        │
│  └── Hub-and-spoke 모델로 트래픽 중앙 관리                      │
│                                                                   │
│  Salesforce                                                      │
│  └── 하루 수조 건의 요청 처리                                    │
│      → 세밀한 트래픽 제어 없이는 운영 불가능                    │
│                                                                   │
│  eBay                                                            │
│  └── 프로덕션과 유사한 격리 환경에서 마이크로서비스 테스트      │
│      → 트래픽 미러링으로 실제 트래픽 기반 검증                 │
│                                                                   │
│  T-Mobile                                                        │
│  └── 100개 이상의 Istio 인스턴스 배포                           │
│      → 글로벌 통신사 인프라 관리                                │
│                                                                   │
│  기타                                                            │
│  ├── Atlassian: 마이크로서비스 전환에 활용                       │
│  ├── Splunk: 데이터 파이프라인 트래픽 제어                      │
│  ├── FICO: 금융 서비스 안정성 확보                               │
│  ├── Intuit (TurboTax): 세금 신고 시즌 트래픽 관리              │
│  └── Databricks: 데이터 플랫폼 서비스 메시 구성                 │
│                                                                   │
│  공통 사용 패턴:                                                 │
│  ├── 카나리 배포 (안전한 점진적 릴리즈)                         │
│  ├── 트래픽 미러링 (신버전 검증)                                 │
│  └── Circuit Breaking (연쇄 장애 방지)                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. Gateway의 Namespace와 이름 규칙

## 9.1 `namespace/gateway-name` 형식이란?

```
┌─────────────────────────────────────────────────────────────────┐
│         VirtualService의 gateways 필드 해석                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  gateways:                                                       │
│    - istio-ingress/main-gateway                                  │
│      ─────────────┬──────────────                                │
│      │                  │                                         │
│      ▼                  ▼                                         │
│    namespace       Gateway 리소스 이름                            │
│   (Gateway가       (.metadata.name)                              │
│    위치한 곳)                                                     │
│                                                                   │
│  의미: "istio-ingress 네임스페이스에 있는                        │
│         main-gateway라는 Gateway 리소스를 통해                    │
│         들어오는 트래픽에 이 라우팅 규칙을 적용하라"              │
│                                                                   │
│  ⚠ namespace를 생략하면?                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  gateways:                                               │    │
│  │    - main-gateway    ← VirtualService와 같은 namespace   │    │
│  │                         에서 찾음                         │    │
│  │                                                          │    │
│  │  VirtualService가 my-app namespace에 있는데              │    │
│  │  Gateway는 istio-ingress에 있다면?                       │    │
│  │  → 바인딩 실패! (조용히 무시됨, 에러 없음)               │    │
│  │  → istioctl analyze로 감지 가능                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# ✅ 올바른 사용: Gateway가 다른 namespace에 있을 때 반드시 prefix
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: order-service
  namespace: my-app             # VirtualService는 my-app에 있음
spec:
  hosts:
    - order.dev.example.com
  gateways:
    - istio-ingress/main-gateway   # Gateway는 istio-ingress에 있음 → prefix 필수
    - mesh                          # 내부 sidecar 트래픽에도 적용
  http:
    - route:
        - destination:
            host: order-service
            port:
              number: 80

# ❌ 잘못된 사용: namespace prefix 누락
# spec:
#   gateways:
#     - main-gateway    ← my-app namespace에서 찾으려 하지만 없음 → 실패
```

## 9.2 `mesh` 예약어

```
┌─────────────────────────────────────────────────────────────────┐
│         gateways 필드의 특수 값: "mesh"                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  gateways:                                                       │
│    - istio-ingress/main-gateway   ← 외부 트래픽 (North-South)   │
│    - mesh                          ← 내부 트래픽 (East-West)     │
│                                                                   │
│  "mesh"는 Istio의 예약어:                                        │
│  ├── 메시 내 모든 사이드카 프록시를 의미                          │
│  ├── gateways 필드를 아예 생략하면 기본값이 "mesh"               │
│  └── Named Gateway만 지정하면 외부 트래픽에만 적용               │
│                                                                   │
│  동작 정리:                                                      │
│  ┌────────────────────────────────┬───────────────────────────┐ │
│  │ gateways 값                    │ 적용 범위                  │ │
│  ├────────────────────────────────┼───────────────────────────┤ │
│  │ (생략)                         │ mesh 내부 트래픽만         │ │
│  │ ["mesh"]                       │ mesh 내부 트래픽만         │ │
│  │ ["istio-ingress/gw"]           │ 외부 트래픽만              │ │
│  │ ["istio-ingress/gw", "mesh"]   │ 외부 + 내부 모두          │ │
│  └────────────────────────────────┴───────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 9.3 istio-system vs istio-ingress 네임스페이스

```
┌─────────────────────────────────────────────────────────────────┐
│         Istio Namespace 분리 아키텍처                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  istio-system (Control Plane)                            │    │
│  │  ├── istiod (통합 컨트롤 플레인)                         │    │
│  │  │   ├── Pilot: 서비스 디스커버리, xDS 설정 배포        │    │
│  │  │   ├── Citadel: 인증서 발급 (CA Private Key 보관)     │    │
│  │  │   ├── Galley: 설정 검증                               │    │
│  │  │   └── Sidecar Injector: Mutating Webhook              │    │
│  │  └── 관리 주체: 클러스터 관리자만                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         ↕ xDS (gRPC)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  istio-ingress (Data Plane - Gateway)                    │    │
│  │  ├── istio-ingressgateway Pod (Envoy 프록시)             │    │
│  │  ├── Gateway 리소스들 (main-gateway, dev-gateway 등)     │    │
│  │  └── TLS 인증서 Secret                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  왜 분리하는가?                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  보안: 최소 권한 원칙 (Least Privilege)                   │    │
│  │                                                          │    │
│  │  ingress gateway는 인터넷에서 오는 신뢰할 수 없는        │    │
│  │  트래픽을 직접 처리하는 Pod임                             │    │
│  │                                                          │    │
│  │  만약 istio-system에 같이 있다면?                        │    │
│  │  → 공격자가 gateway 취약점 악용 시                       │    │
│  │  → 같은 namespace의 Secret에 접근 가능                   │    │
│  │  → CA Private Key 탈취 → 전체 메시 인증 체계 붕괴       │    │
│  │                                                          │    │
│  │  분리하면?                                                │    │
│  │  → gateway Pod는 istio-ingress의 Secret만 접근 가능      │    │
│  │  → TLS 인증서만 노출, CA 키는 안전                       │    │
│  │  → Kubernetes RBAC으로 namespace 경계 강제                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  레거시 vs 권장 방식:                                            │
│  ┌────────────────────────┬────────────────────────────────┐    │
│  │ 레거시 (istioctl 기본) │ 권장 (Helm 기반)               │    │
│  ├────────────────────────┼────────────────────────────────┤    │
│  │ istio-system에         │ istio-system: istiod만          │    │
│  │ istiod + gateway 같이  │ istio-ingress: gateway 분리     │    │
│  │                        │ istio-egress: egress 분리       │    │
│  │ 문제: 라이프사이클     │ 장점: 독립 업그레이드/스케일   │    │
│  │ 결합, 보안 경계 없음   │ 보안 경계 분리                  │    │
│  └────────────────────────┴────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```bash
# 권장 설치 순서 (Helm)
helm install istio-base istio/base -n istio-system --create-namespace
helm install istiod istio/istiod -n istio-system
helm install istio-ingressgateway istio/gateway -n istio-ingress --create-namespace
```

## 9.4 Gateway 이름 규칙과 멀티 Gateway 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│         Gateway 이름 규칙 (Naming Convention)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Gateway 이름은 목적/환경/대상을 반영:                           │
│                                                                   │
│  ┌──────────────────────┬────────────────────────────────────┐  │
│  │ 이름 패턴             │ 용도                               │  │
│  ├──────────────────────┼────────────────────────────────────┤  │
│  │ main-gateway         │ 주 프로덕션 게이트웨이              │  │
│  │ dev-gateway          │ 개발 환경 전용                      │  │
│  │ staging-gateway      │ 스테이징 환경                       │  │
│  │ public-gateway       │ 인터넷 접근용 (외부)                │  │
│  │ private-gateway      │ 내부 네트워크 전용 (인트라넷)       │  │
│  │ api-gateway          │ API 트래픽 전용                     │  │
│  │ team-a-gateway       │ 팀/테넌트별 전용                    │  │
│  └──────────────────────┴────────────────────────────────────┘  │
│                                                                   │
│  💡 왜 같은 클러스터에 여러 Gateway가 필요한가?                  │
│                                                                   │
│  1. 환경 분리: dev.example.com vs example.com                    │
│  2. TLS 분리: 환경별 다른 인증서 사용                            │
│  3. 보안 정책 분리: 개발은 HTTP 허용, 프로덕션은 HTTPS 강제     │
│  4. 팀 자율성: 개발자가 dev-gateway 설정을 직접 관리             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 9.5 Gateway의 selector 필드 - 실제 Pod 선택 메커니즘

```
┌─────────────────────────────────────────────────────────────────┐
│         Gateway selector의 동작 원리                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Gateway 리소스:                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  spec:                                                   │    │
│  │    selector:                                             │    │
│  │      istio: ingressgateway  ← 라벨 셀렉터               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                         │
│                         │ "이 라벨을 가진 Pod에 설정을 적용"      │
│                         ▼                                         │
│  istio-ingressgateway Deployment의 Pod:                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  metadata:                                               │    │
│  │    labels:                                               │    │
│  │      app: istio-ingressgateway                           │    │
│  │      istio: ingressgateway  ← 이 라벨이 매칭됨          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  핵심: Gateway 리소스 자체는 설정일 뿐                           │
│  실제 트래픽을 처리하는 건 selector로 선택된 Envoy Pod           │
│                                                                   │
│  Istiod의 처리 흐름:                                             │
│  1. Gateway 리소스 감시                                           │
│  2. selector 라벨로 매칭되는 Pod 검색 (기본: 전체 namespace)     │
│  3. 해당 Pod의 Envoy에 LDS 설정(포트, TLS) 푸시                 │
│  4. VirtualService가 이 Gateway를 참조하면 RDS(라우팅)도 푸시    │
│                                                                   │
│  ⚠ 멀티 Gateway 배포 시 라벨 분리 필수:                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  # 공개 Gateway → 공개용 Envoy Pod                      │    │
│  │  Gateway "public-gw":                                    │    │
│  │    selector: { istio: public-ingressgateway }            │    │
│  │                                                          │    │
│  │  # 내부 Gateway → 내부용 Envoy Pod                      │    │
│  │  Gateway "private-gw":                                   │    │
│  │    selector: { istio: private-ingressgateway }           │    │
│  │                                                          │    │
│  │  → 라벨이 같으면 두 Gateway 설정이 같은 Pod에 합쳐져    │    │
│  │    예상치 못한 리스너 충돌 발생                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 9.6 Gateway 배포 아키텍처 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│         패턴 A: 공유 Gateway (Shared)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  istio-ingress namespace:                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Envoy Pod Fleet]  ← 하나의 Pod 그룹                   │    │
│  │  label: istio=ingressgateway                             │    │
│  │                                                          │    │
│  │  Gateway "dev-gateway"                                   │    │
│  │    hosts: [dev.example.com], port: 80                    │    │
│  │                                                          │    │
│  │  Gateway "main-gateway"                                  │    │
│  │    hosts: [example.com], port: 443 + TLS                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│            ↑                       ↑                              │
│            │                       │                              │
│  ┌─────────────────┐   ┌─────────────────┐                     │
│  │  dev namespace   │   │  prod namespace  │                     │
│  │  VirtualService  │   │  VirtualService  │                     │
│  │  gateways:       │   │  gateways:       │                     │
│  │  [istio-ingress/ │   │  [istio-ingress/ │                     │
│  │   dev-gateway]   │   │   main-gateway]  │                     │
│  └─────────────────┘   └─────────────────┘                     │
│                                                                   │
│  장점: LoadBalancer 1개, 비용 절약, DNS 단순                     │
│  단점: 단일 장애점, 테넌트 간 격리 없음                          │
│  적합: 단일 팀, 소규모 클러스터, 같은 도메인 공유                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         패턴 B: 전용 Gateway (Dedicated)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────┐ ┌────────────────────────────┐ │
│  │  team-a-ingress namespace   │ │  team-b-ingress namespace  │ │
│  │  [Envoy Pod]                │ │  [Envoy Pod]               │ │
│  │  label: app=team-a-gw      │ │  label: app=team-b-gw     │ │
│  │  Gateway "team-a-gateway"   │ │  Gateway "team-b-gateway"  │ │
│  │  Service: LB → IP 1.2.3.4  │ │  Service: LB → IP 5.6.7.8│ │
│  └─────────────────────────────┘ └────────────────────────────┘ │
│                                                                   │
│  장점: 완전 격리, 독립 스케일링, 팀별 TLS 관리                  │
│  단점: LB 여러 개 (비용 증가), 운영 복잡도 증가                  │
│  적합: 멀티 테넌트, 규제 산업, 내부/외부 분리 필요               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         패턴 C: 하이브리드 (가장 일반적)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  하나의 Envoy Pod Fleet + 여러 Gateway 리소스                    │
│                                                                   │
│  istio-ingress:                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Envoy Pod Fleet]                                       │    │
│  │  label: istio=ingressgateway                             │    │
│  │                                                          │    │
│  │  Gateway "dev-gateway"                                   │    │
│  │    hosts: ["*.dev.example.com"], port: 80                │    │
│  │                                                          │    │
│  │  Gateway "main-gateway"                                  │    │
│  │    hosts: ["*.example.com"], port: 443 + TLS             │    │
│  │                                                          │    │
│  │  Gateway "internal-gateway"                              │    │
│  │    hosts: ["*.internal.example.com"], port: 443          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  → 하나의 LoadBalancer IP로 여러 도메인/환경 처리               │
│  → Gateway 리소스가 논리적 분리 담당                             │
│  → 가장 비용 효율적이면서도 유연한 패턴                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 9.7 가상 시나리오: Gateway 참조 실수로 인한 라우팅 실패

```
┌─────────────────────────────────────────────────────────────────┐
│         가상 시나리오: cross-namespace Gateway 참조 누락           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  인프라 구성:                                                    │
│  ├── istio-ingress namespace에 "main-gateway" 존재              │
│  ├── payment 팀이 payment namespace에 VirtualService 배포        │
│  └── payment 팀이 gateways: ["main-gateway"]로 참조 (prefix 누락)│
│                                                                   │
│  발생한 문제:                                                    │
│  payment.example.com 접속 시 → 404 Not Found                    │
│                                                                   │
│  원인 분석:                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  VirtualService (namespace: payment):                    │    │
│  │    gateways: ["main-gateway"]                            │    │
│  │                                                          │    │
│  │  Istio 해석: "payment namespace에서 main-gateway 검색"   │    │
│  │  → payment namespace에는 Gateway가 없음                  │    │
│  │  → 바인딩 실패 (조용히 무시됨, 에러 로그 없음!)          │    │
│  │  → main-gateway의 Envoy에 라우팅 규칙이 푸시되지 않음   │    │
│  │  → 해당 host로 들어오는 트래픽에 매칭 규칙 없음 → 404   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  해결:                                                           │
│  gateways: ["istio-ingress/main-gateway"]  ← namespace prefix   │
│                                                                   │
│  진단 도구:                                                      │
│  $ istioctl analyze -n payment                                   │
│  Warning: VirtualService references gateway not found:           │
│    gateway "main-gateway" not found in namespace "payment"       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# ❌ 잘못된 VirtualService (payment namespace)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payment-service
  namespace: payment
spec:
  hosts:
    - payment.example.com
  gateways:
    - main-gateway              # ← 잘못됨! payment ns에서 찾음
  http:
    - route:
        - destination:
            host: payment-service
---
# ✅ 올바른 VirtualService
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payment-service
  namespace: payment
spec:
  hosts:
    - payment.example.com
  gateways:
    - istio-ingress/main-gateway    # ← 올바름! namespace prefix 포함
  http:
    - route:
        - destination:
            host: payment-service
```

---

# 10. 정리 (Summary)

```
┌─────────────────────────────────────────────────────────────────┐
│                  VirtualService 핵심 정리                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  VirtualService란?                                               │
│  ├── Istio CRD (networking.istio.io/v1)                         │
│  ├── L7 트래픽 라우팅 규칙 정의                                  │
│  └── 클라이언트의 논리적 이름과 실제 백엔드를 분리              │
│                                                                   │
│  왜 필요한가?                                                    │
│  ├── K8s Service: L4만 지원, 버전/헤더 인식 불가                │
│  └── K8s Ingress: North-South 전용, annotation 지옥             │
│                                                                   │
│  내부 원리:                                                      │
│  YAML 작성 → Istiod(Pilot) 변환 → xDS(RDS) 배포               │
│  → Envoy Route Configuration 적용                               │
│                                                                   │
│  핵심 원칙:                                                      │
│  ├── 소스 프록시 실행: 호출하는 쪽 Envoy에서 규칙 평가          │
│  └── 3계층 분리: Gateway(L4) → VS(L7 라우팅) → DR(도착 정책)  │
│                                                                   │
│  미래 방향:                                                      │
│  ├── Gateway API(HTTPRoute)가 표준으로 부상                      │
│  ├── VirtualService는 고급 기능(fault, mirror)용으로 공존        │
│  └── 두 방식은 Istio에서 동시 사용 가능                        │
│                                                                   │
│  애플리케이션 코드 수정 없이 가능한 것들:                        │
│  ├── 카나리 배포 (가중치 기반)                                   │
│  ├── A/B 테스트 (헤더/쿠키 기반)                                 │
│  ├── 트래픽 미러링 (shadow testing)                              │
│  ├── 장애 주입 (chaos engineering)                               │
│  ├── Blue-Green 배포 (즉각 전환)                                 │
│  └── 모놀리스 분해 (path 기반 라우팅)                           │
│                                                                   │
│  💡 핵심 포인트:                                                 │
│     "VirtualService는 Kubernetes 네트워킹의 L7 계층을            │
│      인프라 레벨에서 제어하는 유일한 표준 수단이다"              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`VirtualService`, `DestinationRule`, `Gateway`, `Istio`, `Service Mesh`, `Envoy`, `Traffic Routing`, `Canary Deployment`, `A/B Testing`, `Traffic Mirroring`, `Fault Injection`, `Blue-Green`, `xDS`, `Pilot`, `Istiod`, `Kubernetes Gateway API`, `HTTPRoute`, `East-West Traffic`, `North-South Traffic`, `Circuit Breaker`, `Weighted Routing`, `Subset`, `istio-system`, `istio-ingress`, `Gateway Namespace`, `selector`, `Least Privilege`, `Shared Gateway`, `Dedicated Gateway`, `istioctl analyze`, `mesh`, `트래픽 라우팅`, `카나리 배포`, `장애 주입`, `트래픽 미러링`

