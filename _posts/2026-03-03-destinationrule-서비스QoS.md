---
layout: single
title: "DestinationRule과 서비스 QoS"
date: 2026-03-03 23:00:00 +0900
categories: infra
tags: [infra, network, web, proxy]
excerpt: "리버스 프록시는 외부 요청을 중재해 보안과 확장성을 높이는 핵심 인프라 컴포넌트다."
source: "/home/dwkim/dwkim/docs/cloud/destinationrule-서비스QoS.md"

---

**TL;DR**
- DestinationRule
- Service QoS
- Load Balancing

## 1. Concept
DestinationRule과 서비스 QoS의 핵심 개념과 범위를 간단히 정의하고, 왜 이 문서가 필요한지 요점을 잡습니다.

## 2. Background
이 주제가 등장하게 된 배경과 문제 상황, 기술적 맥락을 짚습니다.

## 3. Reason
왜 이 접근이 필요한지, 기존 대안의 한계나 목표를 설명합니다.

## 4. Features
문서에서 다루는 주요 구성요소와 실전 적용 포인트를 정리합니다.

## 5. Detailed Notes

# DestinationRule과 서비스 QoS

> **작성일**: 2026-03-03
> **카테고리**: Cloud / Kubernetes / Istio / Traffic Management
> **포함 내용**: DestinationRule, Service QoS, Load Balancing, Circuit Breaker, Outlier Detection, Connection Pool, TLS, Subset, Envoy Cluster, Netflix Hystrix 비교, Cascading Failure

---

# 1. DestinationRule이란?

## 정의

DestinationRule은 Istio 서비스 메시에서 **라우팅이 결정된 이후** 트래픽이 목적지에
어떻게 도달할지를 정의하는 CRD(Custom Resource Definition)이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DestinationRule = Post-Routing Policy Engine             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  API Group: networking.istio.io/v1                                          │
│  Kind:      DestinationRule                                                 │
│  역할:      라우팅 결정 이후의 트래픽 정책 엔진                             │
│                                                                             │
│  ┌─────────────────────┐          ┌──────────────────────┐                  │
│  │   VirtualService    │          │   DestinationRule    │                  │
│  │                     │          │                      │                  │
│  │  WHERE traffic goes │ ──────→  │  HOW traffic arrives │                  │
│  │  (라우팅 결정)      │          │  (QoS 정책 적용)     │                  │
│  │                     │          │                      │                  │
│  │  - header matching  │          │  - load balancing    │                  │
│  │  - traffic split    │          │  - circuit breaker   │                  │
│  │  - retry / timeout  │          │  - connection pool   │                  │
│  │  - fault injection  │          │  - TLS config        │                  │
│  └─────────────────────┘          └──────────────────────┘                  │
│                                                                             │
│  적용 시점: VirtualService 라우팅 결정 이후 (post-routing)                  │
│  적용 대상: Envoy Sidecar Proxy의 Cluster 설정                              │
│  핵심 역할: 서비스 품질(QoS) 보장을 위한 인프라 수준 정책                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

VirtualService가 "어디로 보낼 것인가"를 결정한다면,
DestinationRule은 "어떻게 보낼 것인가"를 결정한다.

이 두 리소스는 Istio 트래픽 관리의 핵심 쌍으로, 함께 사용되어
서비스 간 통신의 라우팅과 품질 보장을 완성한다.

## K8s Service vs DestinationRule 비교

```
┌──────────────────┬──────────────────────────┬──────────────────────────────────┐
│    비교 항목      │   K8s Service (기본)     │   Istio DestinationRule          │
├──────────────────┼──────────────────────────┼──────────────────────────────────┤
│ OSI 계층         │ L4 (TCP/UDP)             │ L7 (HTTP/gRPC)                   │
│ 로드 밸런싱      │ Round-Robin 단일 방식     │ 5종 알고리즘 + Consistent Hash   │
│ Circuit Breaker  │ 미지원                   │ connectionPool + outlierDetection │
│ Connection Pool  │ 미지원 (관리 불가)        │ TCP/HTTP 세밀한 제어 가능        │
│ TLS 설정         │ 미지원                   │ DISABLE/SIMPLE/MUTUAL/ISTIO_MUTUAL│
│ 서비스 버전 관리 │ 미지원                   │ Subset (label selector 기반)      │
│ 이상치 탐지      │ 미지원                   │ outlierDetection (자동 제거)      │
│ Session Affinity │ clientIP만 가능          │ Cookie/Header/IP 기반 Hash       │
│ 구현 위치        │ kube-proxy (iptables)    │ Envoy Sidecar Proxy              │
│ 설정 변경        │ Pod 재시작 불필요        │ Pod 재시작 불필요 (xDS 동적)     │
└──────────────────┴──────────────────────────┴──────────────────────────────────┘
```

---

# 2. 등장 배경 - 왜 만들어졌나?

## 2.1 Kubernetes 네이티브 네트워킹의 한계

Kubernetes의 기본 네트워킹 구성 요소인 kube-proxy는 L4(Transport Layer)에서
동작하며, 단순한 round-robin 로드 밸런싱만 제공한다.

이로 인해 다음과 같은 한계가 존재한다:

- **L4 Round-Robin Only**: HTTP 헤더, 경로, 메서드 등 애플리케이션 계층 정보를 활용한 라우팅 불가
- **장애 격리 부재**: Circuit Breaker가 없어 하나의 서비스 장애가 전체 시스템으로 전파
- **Connection Pool 관리 불가**: TCP 연결 수, HTTP 동시 요청 수 등을 제한할 수 없음
- **이상치 탐지 없음**: 장애가 발생한 Pod을 자동으로 로드 밸런싱 풀에서 제외할 수 없음
- **세밀한 TLS 제어 불가**: 서비스 간 mTLS를 유연하게 설정할 수 없음

## 2.2 Netflix OSS에서 Istio로의 전환

마이크로서비스 아키텍처에서 서비스 간 통신의 복원력(Resilience)을 확보하기 위해
Netflix OSS 라이브러리가 널리 사용되었다. 그러나 라이브러리 방식은 근본적인 한계가 있었다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Before: Netflix OSS 라이브러리 방식                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────┐                                  │
│  │          Application Code             │                                  │
│  │  ┌─────────────┐  ┌───────────────┐  │                                  │
│  │  │   Hystrix    │  │    Ribbon     │  │                                  │
│  │  │ (CB library) │  │  (LB library) │  │                                  │
│  │  │  JVM only    │  │   JVM only    │  │                                  │
│  │  └─────────────┘  └───────────────┘  │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                             │
│  문제점:                                                                    │
│  - JVM 전용 → Go, Python, Node.js 서비스에서 사용 불가                     │
│  - 모든 서비스에 라이브러리 의존성 추가 필요                                │
│  - 라이브러리 버전 업그레이드 시 모든 서비스 재배포 필요                    │
│  - 애플리케이션 코드와 인프라 코드가 혼재 → 관심사 분리 실패               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                    After: Istio/Envoy 사이드카 방식                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────────────────┐                   │
│  │ Application Code │     │      Envoy Sidecar Proxy     │                  │
│  │                  │     │                              │                   │
│  │  어떤 언어든 OK  │────→│  Circuit Breaker             │                   │
│  │  라이브러리 불필요│     │  Load Balancing              │                   │
│  │  비즈니스 로직만  │     │  Connection Pool             │                   │
│  │                  │     │  TLS / mTLS                  │                   │
│  └─────────────────┘     └──────────────────────────────┘                   │
│                                                                             │
│  해결:                                                                      │
│  - 언어 무관 → 모든 서비스에 동일한 복원력 제공                             │
│  - 코드 변경 없음 → YAML 설정만으로 정책 적용                              │
│  - 독립적 업그레이드 → Envoy 업그레이드 시 애플리케이션 코드 변경 불필요    │
│  - 관심사 분리 → 인프라 복원력은 인프라 계층에서 처리                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Netflix Hystrix와 Ribbon의 핵심 문제:

- **Netflix Hystrix**: JVM 전용 Circuit Breaker 라이브러리.
  `@HystrixCommand` 어노테이션으로 메서드 레벨 Circuit Breaker를 제공했으나,
  Java/Kotlin 외 언어에서는 사용 불가. 2018년 유지보수 모드(maintenance mode) 전환.
- **Ribbon**: JVM 전용 클라이언트 사이드 로드 밸런서.
  서비스 디스커버리와 연동하여 동작했으나, 마찬가지로 JVM에 종속.
- **근본적 문제**: 언어 종속(language lock-in), 라이브러리 의존성 관리 부담,
  애플리케이션 코드와 인프라 코드의 결합.
- **해결 방향**: Envoy Sidecar Proxy를 통한 인프라 수준 복원력 제공.
  애플리케이션은 비즈니스 로직에만 집중, 네트워크 복원력은 사이드카가 담당.

## 2.3 API 진화

DestinationRule은 Istio API의 진화 과정에서 탄생했다:

1. **DestinationPolicy (v1alpha1)**: Istio 초기 버전의 트래픽 정책 리소스.
   기능이 제한적이고 설정 방식이 직관적이지 않았음.
2. **DestinationRule (v1alpha3, 2018)**: 근본적으로 재설계됨.
   Named Subset 개념 도입, Label Selector 기반 버전 그룹핑,
   trafficPolicy의 계층적 구조(global + subset-level override) 지원.
3. **v1beta1 (2020)**: 안정화 과정. 필드 이름 정리, 기본값 명확화.
4. **v1 Stable (Istio 1.22, 2024)**: 정식 GA(Generally Available) 승격.
   networking.istio.io/v1 API 그룹에서 안정적으로 사용 가능.

---

# 3. VirtualService와의 관계

DestinationRule은 VirtualService와 함께 Istio 트래픽 관리의 양대 축을 이룬다.
이 둘의 관계를 정확히 이해하는 것이 Istio 운영의 핵심이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         트래픽 흐름 전체 경로                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client        Istio           VirtualService    DestinationRule   Envoy    │
│  Request       Gateway         (WHERE)           (HOW)            Cluster   │
│                                                                             │
│    │              │                │                  │              │       │
│    │   L4 진입    │   L7 라우팅    │   QoS 정책       │   실제 Pod   │       │
│    │──────────→   │────────────→   │──────────────→   │──────────→   │       │
│    │              │                │                  │              │       │
│    │   TLS 종료   │   header 매칭  │   로드 밸런싱    │   upstream   │       │
│    │   포트 매핑   │   경로 매칭    │   circuit break  │   선택       │       │
│    │              │   트래픽 분할  │   connection pool│              │       │
│    │              │   재시도/타임아웃│   TLS 설정      │              │       │
│    │              │   장애 주입    │   이상치 탐지    │              │       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.1 Pre-routing vs Post-routing

VirtualService와 DestinationRule은 트래픽 처리 파이프라인에서
서로 다른 단계에서 동작한다:

```
┌──────────────────┬────────────────────────────┬────────────────────────────────┐
│    구분          │   VirtualService           │   DestinationRule              │
│                  │   (Pre-routing Rules)      │   (Post-routing Policies)      │
├──────────────────┼────────────────────────────┼────────────────────────────────┤
│ 처리 단계        │ 라우팅 결정 단계           │ 라우팅 결정 이후 단계          │
│ 핵심 질문        │ "어디로 보낼 것인가?"      │ "어떻게 보낼 것인가?"          │
│                  │                            │                                │
│ 담당 기능        │ - HTTP header 매칭         │ - 로드 밸런싱 알고리즘         │
│                  │ - URI 경로 매칭            │ - Circuit Breaker              │
│                  │ - 트래픽 가중치 분할       │ - Connection Pool 관리         │
│                  │ - 재시도(retry) 정책       │ - TLS 모드 설정                │
│                  │ - 타임아웃 설정            │ - 이상치 탐지(outlier detection)│
│                  │ - 장애 주입(fault inject)  │ - Subset 정의                  │
│                  │                            │                                │
│ Envoy 매핑      │ Route Configuration        │ Cluster Configuration          │
│ 적용 대상        │ Envoy Listener/Route       │ Envoy Cluster/Endpoint         │
└──────────────────┴────────────────────────────┴────────────────────────────────┘
```

## 3.2 의존 관계와 배포 순서 (Make-Before-Break)

VirtualService가 DestinationRule의 Subset을 참조하므로,
배포 순서가 매우 중요하다. 이를 Make-Before-Break 원칙이라 한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Make-Before-Break 배포 순서                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [배포 시] (새 Subset 추가)                                                 │
│                                                                             │
│    Step 1: DestinationRule 배포 (Subset 생성)                               │
│         │                                                                   │
│         ├── subset "v2" 생성됨                                              │
│         ├── Envoy Cluster 등록됨                                            │
│         │                                                                   │
│    Step 2: xDS 전파 대기 (~수 초)                                           │
│         │                                                                   │
│    Step 3: VirtualService 배포 (Subset 참조)                                │
│         │                                                                   │
│         └── route.destination.subset: "v2" 참조                             │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [제거 시] (기존 Subset 제거)                                               │
│                                                                             │
│    Step 1: VirtualService에서 Subset 참조 제거                              │
│         │                                                                   │
│         ├── route.destination.subset: "v2" 참조 제거                        │
│         │                                                                   │
│    Step 2: xDS 전파 대기 (~수 초)                                           │
│         │                                                                   │
│    Step 3: DestinationRule에서 Subset 제거                                  │
│         │                                                                   │
│         └── subset "v2" 삭제                                                │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [주의] 순서를 어길 경우:                                                   │
│                                                                             │
│    VirtualService가 존재하지 않는 Subset을 참조                             │
│         │                                                                   │
│         └── Envoy가 upstream cluster를 찾지 못함                            │
│              │                                                              │
│              └── HTTP 503 Service Unavailable 즉시 발생!                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**핵심 원칙**: 생성은 DestinationRule 먼저, 제거는 VirtualService 먼저.
항상 "참조 대상이 먼저 존재"하도록 배포 순서를 관리해야 한다.

---

# 4. 핵심 기능 상세

## 4.1 Subsets (서비스 버전 그룹)

Subset은 동일 서비스의 Pod들을 레이블(label) 기반으로 그룹핑하는 기능이다.
각 Subset은 Envoy 내부에서 독립적인 Cluster로 변환되며,
Subset별로 독립적인 trafficPolicy를 적용할 수 있다.

Envoy Cluster 명명 규칙:
`outbound|{port}|{subset}|{host}.{namespace}.svc.cluster.local`

```yaml
# Subset 정의 - 서비스 버전별 그룹핑
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-dr
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local

  # 글로벌 트래픽 정책 (모든 Subset에 기본 적용)
  trafficPolicy:
    loadBalancer:
      simple: ROUND_ROBIN

  subsets:
    # v1 Subset - 안정 버전
    - name: v1
      labels:
        version: v1
      # subset-level 정책 미지정 → 글로벌 정책 상속

    # v2 Subset - 신규 버전 (subset-level 정책 오버라이드)
    - name: v2
      labels:
        version: v2
      trafficPolicy:                   # subset-level 정책 (글로벌 오버라이드)
        loadBalancer:
          simple: LEAST_REQUEST        # v2는 LEAST_REQUEST 사용
```

**정책 우선순위**: Subset-level trafficPolicy > Global trafficPolicy

**중요**: Subset-level trafficPolicy는 해당 Subset으로 VirtualService가
명시적으로 트래픽을 라우팅할 때에만 활성화된다.
VirtualService가 Subset을 지정하지 않으면 글로벌 정책만 적용된다.

## 4.2 로드 밸런싱 알고리즘

Istio DestinationRule은 다양한 로드 밸런싱 알고리즘을 제공하며,
Kubernetes의 기본 Round-Robin 방식을 넘어 정교한 트래픽 분배가 가능하다.

```
┌──────────────────┬──────────────────────────────────────────────────────────┐
│  알고리즘         │  설명                                                    │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ ROUND_ROBIN      │ 기본값. 모든 엔드포인트에 순차적으로 분배.               │
│ (순차 분배)      │ 단순하고 예측 가능하나, 엔드포인트 성능 차이 고려 안 함. │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ LEAST_REQUEST    │ 활성 요청이 가장 적은 엔드포인트 선택.                   │
│ (최소 요청)      │ 응답 시간이 불균일한 서비스에 효과적.                    │
│                  │ Envoy는 P2C(Power of Two Choices) 알고리즘 사용.         │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ RANDOM           │ 무작위 엔드포인트 선택.                                  │
│ (무작위)         │ 대규모 클러스터에서 균등 분포에 수렴. 오버헤드 최소.     │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ PASSTHROUGH      │ 로드 밸런싱 없음. 원래 목적지로 직접 전달.              │
│ (직접 전달)      │ 이미 클라이언트가 특정 엔드포인트를 지정한 경우 사용.    │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ Consistent Hash  │ 해시 기반 Session Affinity. 동일 키 → 동일 엔드포인트.  │
│ (일관된 해시)    │ 캐시 효율성 극대화. 엔드포인트 변경 시 최소한의 재분배. │
│                  │ 지원 키: httpHeaderName, httpCookie, useSourceIp,         │
│                  │         httpQueryParameterName                           │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

### Consistent Hash를 이용한 Session Affinity 예시

```yaml
# Cookie 기반 Session Affinity (세션 고정)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-session
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpCookie:
          name: user_session         # 쿠키 이름
          ttl: 3600s                 # 쿠키 만료 시간 (1시간)
```

```yaml
# HTTP Header 기반 Consistent Hash
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: payment-service-hash
  namespace: commerce
spec:
  host: payment-service.commerce.svc.cluster.local
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpHeaderName: x-user-id    # 특정 헤더 값으로 해시
```

## 4.3 Connection Pool (Bulkhead Pattern)

Connection Pool 설정은 **Bulkhead Pattern**을 구현한다.
선박의 격벽(bulkhead)처럼 서비스 간 연결을 격리하여,
하나의 서비스 장애가 다른 서비스의 리소스를 고갈시키는 것을 방지한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Connection Pool 구조                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  connectionPool:                                                            │
│  ├── tcp:                          [TCP 계층 제어]                          │
│  │   ├── maxConnections: 100       최대 TCP 연결 수                         │
│  │   ├── connectTimeout: 30ms      TCP 연결 타임아웃                        │
│  │   └── tcpKeepalive:             TCP Keepalive 설정                       │
│  │       ├── time: 7200s           유휴 연결 감지 시작 시간                 │
│  │       └── interval: 75s         감지 프로브 간격                         │
│  │                                                                          │
│  └── http:                         [HTTP 계층 제어]                         │
│      ├── http1MaxPendingRequests   HTTP/1.1 대기 큐 크기                    │
│      ├── http2MaxRequests          HTTP/2 동시 요청 수                      │
│      ├── maxRequestsPerConnection  연결당 최대 요청 수 (0=무제한)           │
│      ├── maxRetries                최대 재시도 횟수                         │
│      ├── idleTimeout               유휴 연결 타임아웃                       │
│      └── h2UpgradePolicy           HTTP/2 업그레이드 정책                   │
│                                                                             │
│  [제한 초과 시 동작]                                                        │
│  maxConnections 초과     → 새 연결 시도 즉시 거부 (503)                     │
│  http1MaxPendingRequests → 대기 큐 초과 시 즉시 거부 (503)                  │
│  http2MaxRequests 초과   → 새 요청 즉시 거부 (503)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```yaml
# Connection Pool 상세 설정
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-pool
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100              # 최대 TCP 연결 수
        connectTimeout: 30ms             # TCP 연결 타임아웃
        tcpKeepalive:
          time: 7200s                    # Keepalive 시작 시간 (2시간)
          interval: 75s                  # Keepalive 프로브 간격
      http:
        http1MaxPendingRequests: 1024    # HTTP/1.1 대기 큐 크기
        http2MaxRequests: 1024           # HTTP/2 동시 최대 요청 수
        maxRequestsPerConnection: 10     # 연결당 최대 요청 (10회 후 연결 재생성)
        maxRetries: 3                    # 최대 재시도 횟수
        idleTimeout: 1h                 # 유휴 연결 타임아웃 (1시간)
        h2UpgradePolicy: DEFAULT         # HTTP/2 업그레이드 정책
```

### Connection Pool 사이징 공식

적절한 `maxConnections` 값을 산정하기 위한 공식:

```
maxConnections >= (peak_RPS x avg_latency_seconds) / maxRequestsPerConnection x client_pods x 2

예시:
- 피크 RPS: 1000 req/s
- 평균 응답 시간: 0.05s (50ms)
- maxRequestsPerConnection: 10
- 클라이언트 Pod 수: 5

maxConnections >= (1000 x 0.05) / 10 x 5 x 2 = 50

→ maxConnections: 50 이상 (안전 마진 2배 적용)
```

**주의**: 이 공식은 시작점이며, 실제 트래픽 패턴과 모니터링 결과를 기반으로
조정해야 한다. Envoy의 `upstream_cx_overflow` 메트릭을 모니터링하여
Connection Pool이 부족하지 않은지 확인한다.

## 4.4 Outlier Detection (이상치 탐지)

Outlier Detection은 비정상적으로 동작하는 엔드포인트(Pod)를
자동으로 감지하고 로드 밸런싱 풀에서 일시적으로 제거하는 기능이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Outlier Detection 동작 흐름                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1단계: 모니터링]                                                          │
│                                                                             │
│    Envoy가 각 엔드포인트의 응답을 지속적으로 모니터링                       │
│    ├── 5xx 에러 횟수 추적                                                   │
│    ├── Gateway 에러 (502/503/504) 횟수 추적                                 │
│    └── 검사 주기: interval (기본 10s)                                       │
│                                                                             │
│  [2단계: 탐지]                                                              │
│                                                                             │
│    연속 에러가 임계값에 도달                                                │
│    ├── consecutive5xxErrors >= 5 (5xx 에러 연속 5회)                         │
│    └── consecutiveGatewayErrors >= 3 (게이트웨이 에러 연속 3회)             │
│                                                                             │
│  [3단계: 제거 (Ejection)]                                                   │
│                                                                             │
│    해당 엔드포인트를 로드 밸런싱 풀에서 제거                                │
│    ├── 제거 시간: baseEjectionTime x ejection_count                         │
│    ├── 첫 번째 제거: 30s                                                    │
│    ├── 두 번째 제거: 60s (지수적 증가)                                      │
│    ├── 세 번째 제거: 90s                                                    │
│    └── 최대 제거 비율: maxEjectionPercent (전체 호스트의 50%)                │
│                                                                             │
│  [4단계: 복귀]                                                              │
│                                                                             │
│    제거 시간 경과 후 자동으로 풀에 복귀                                     │
│    ├── 복귀 후 정상 동작 시 → ejection_count 리셋                           │
│    └── 복귀 후 다시 에러 → 재제거 (더 긴 제거 시간)                         │
│                                                                             │
│  [타임라인 예시]                                                            │
│                                                                             │
│  t=0s   t=10s  t=20s  t=50s        t=110s                                   │
│   │      │      │      │            │                                       │
│   ├──────┼──────┤      │            │                                       │
│   │모니터링│탐지 │      │            │                                       │
│   │      │ 5xx>5│      │            │                                       │
│   │      │      ├──────┤            │                                       │
│   │      │      │제거  │ 복귀       │                                       │
│   │      │      │30s   │            │                                       │
│   │      │      │      │ 다시 에러  │                                       │
│   │      │      │      ├────────────┤                                       │
│   │      │      │      │  재제거    │ 복귀                                  │
│   │      │      │      │  60s       │                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```yaml
# Outlier Detection 설정
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-outlier
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5            # 5xx 에러 연속 5회 시 제거
      consecutiveGatewayErrors: 3        # 502/503/504 에러 연속 3회 시 제거
      interval: 10s                      # 검사 주기 (10초마다 검사)
      baseEjectionTime: 30s              # 기본 제거 시간 (지수적 증가)
      maxEjectionPercent: 50             # 최대 제거 비율 (전체의 50%)
      minHealthPercent: 30               # Panic Threshold (건강 비율 하한)
```

### Panic Threshold (패닉 임계값)

`minHealthPercent`는 **Panic Threshold**를 설정한다.

건강한 호스트 비율이 이 값 이하로 떨어지면, Envoy는 **Panic Mode**에 진입하여
제거된 호스트를 포함한 **모든 호스트**로 트래픽을 분배한다.

이는 서비스가 완전히 중단되는 것보다 일부 요청이 실패하더라도
서비스가 부분적으로 동작하는 것이 낫다는 판단에 기반한다.

```
Panic Mode 진입 조건:
  건강한 호스트 비율 < minHealthPercent (30%)

예시: 10개 호스트 중 8개 제거
  → 건강 비율 20% < minHealthPercent 30%
  → Panic Mode 진입
  → 제거된 8개 포함 전체 10개로 트래픽 분배
```

## 4.5 TLS 설정

DestinationRule의 TLS 설정은 서비스 간 통신의 암호화 방식을 결정한다.
Istio 서비스 메시의 보안 통신을 위해 반드시 올바르게 설정해야 한다.

```
┌──────────────────┬────────────────────────────────────────────────────────────┐
│  TLS 모드        │  설명                                                      │
├──────────────────┼────────────────────────────────────────────────────────────┤
│ DISABLE          │ TLS 비활성화. 평문(plaintext) 통신.                        │
│                  │ 기본값이지만, 글로벌 mTLS와 충돌 위험!                     │
├──────────────────┼────────────────────────────────────────────────────────────┤
│ SIMPLE           │ 단방향 TLS. 클라이언트가 서버 인증서만 검증.              │
│                  │ 외부 서비스(egress) 연결 시 주로 사용.                     │
├──────────────────┼────────────────────────────────────────────────────────────┤
│ MUTUAL           │ 양방향 TLS (mTLS). 클라이언트/서버 상호 인증.             │
│                  │ 사용자 지정 인증서(CA) 사용 시.                            │
├──────────────────┼────────────────────────────────────────────────────────────┤
│ ISTIO_MUTUAL     │ Istio 관리 mTLS. Istio CA가 발급한 인증서 자동 사용.      │
│                  │ 메시 내부 서비스 간 통신에 권장. 인증서 수동 관리 불필요.  │
└──────────────────┴────────────────────────────────────────────────────────────┘
```

**치명적 함정**: DestinationRule의 TLS 기본값은 `DISABLE`이다.
글로벌 mTLS가 활성화된 메시에서 DestinationRule을 추가하면서
TLS 모드를 명시하지 않으면, 평문으로 요청을 보내게 되어
mTLS를 기대하는 서버 측 Envoy가 연결을 거부한다.

**결과: 즉시 HTTP 503 Service Unavailable 발생!**

```yaml
# 올바른 TLS 설정 (메시 내부 서비스)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-tls
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL       # 반드시 글로벌 메시 설정과 일치시킬 것!
```

```yaml
# 외부 서비스 연결 시 TLS 설정 (egress)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: external-api-tls
  namespace: commerce
spec:
  host: api.external-service.com
  trafficPolicy:
    tls:
      mode: SIMPLE               # 외부 서비스이므로 단방향 TLS
      sni: api.external-service.com
```

---

# 5. Circuit Breaker - 연쇄 장애 방지

## 5.1 Circuit Breaker 패턴이란?

Circuit Breaker는 전기 회로의 차단기에서 영감을 받은 소프트웨어 설계 패턴이다.
과전류가 흐르면 회로를 차단하여 장치를 보호하듯,
비정상적인 서비스 호출을 차단하여 시스템 전체를 보호한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Circuit Breaker 상태 전이 다이어그램                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     failure threshold 도달                                   │
│  ┌──────────────┐  ─────────────────────────→  ┌──────────────┐            │
│  │              │                               │              │            │
│  │    CLOSED    │                               │     OPEN     │            │
│  │  (정상 동작) │                               │  (요청 차단) │            │
│  │              │                               │              │            │
│  │  모든 요청을 │                               │  모든 요청을 │            │
│  │  통과시킴    │                               │  즉시 거부   │            │
│  │              │                               │  (503 반환)  │            │
│  │  에러 횟수를 │                               │              │            │
│  │  카운팅 중   │                               │  timeout 후  │            │
│  │              │                               │  HALF-OPEN   │            │
│  └──────────────┘                               └──────────────┘            │
│         ↑                                              │                    │
│         │                                              │                    │
│         │         시험 요청 성공                        │ timeout 경과       │
│         │                                              │                    │
│         │                                              ↓                    │
│         │                                       ┌──────────────┐            │
│         │                                       │              │            │
│         └───────────────────────────────────────│  HALF-OPEN   │            │
│                                                 │  (시험 요청)  │            │
│                     시험 요청 실패               │              │            │
│                    ┌───────────────────────────→ │  제한된 수의 │            │
│                    │                             │  요청만 통과 │            │
│                    │                             │              │            │
│                    │                             │  성공 → CLOSED│           │
│                    └─────────────────────────────│  실패 → OPEN │            │
│                                                 └──────────────┘            │
│                                                                             │
│  상태 전이 요약:                                                            │
│  1. CLOSED: 정상 상태. 모든 요청 통과. 에러 모니터링 중.                    │
│  2. OPEN:   장애 감지. 모든 요청 즉시 차단. 일정 시간 대기.                 │
│  3. HALF-OPEN: 복구 확인. 소수 요청으로 시험. 성공 시 CLOSED 복귀.          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Circuit Breaker의 핵심 가치:

1. **빠른 실패(Fail-Fast)**: 장애 서비스에 대한 요청을 즉시 거부하여 응답 시간 보장
2. **리소스 보호**: 장애 서비스로의 연결이 클라이언트 리소스를 고갈시키는 것을 방지
3. **자동 복구**: 장애 서비스가 복구되면 자동으로 트래픽 재개
4. **연쇄 장애 방지**: 하나의 서비스 장애가 전체 시스템으로 전파되는 것을 차단

## 5.2 연쇄 장애(Cascading Failure)란?

연쇄 장애는 마이크로서비스 아키텍처에서 가장 치명적인 장애 유형이다.
하나의 서비스 장애가 도미노처럼 다른 서비스들을 순차적으로 무너뜨린다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    연쇄 장애(Cascading Failure) 시나리오                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1단계: 단일 서비스 장애 발생]                                             │
│                                                                             │
│    payment-service (결제 서비스)                                             │
│    └── DB 연결 풀 고갈로 응답 지연 (50ms → 30초)                            │
│                                                                             │
│  [2단계: 호출자 리소스 고갈]                                                │
│                                                                             │
│    order-service ──→ payment-service (응답 대기 30초)                        │
│         │                    │                                              │
│         ↓                    ↓                                              │
│    Thread Pool 고갈      Connection Pool 고갈                               │
│    (모든 스레드가         (모든 연결이 응답                                  │
│     응답 대기 중)          대기 중)                                          │
│         │                                                                   │
│         ↓                                                                   │
│    order-service도 응답 불가!                                               │
│                                                                             │
│  [3단계: 장애 전파]                                                         │
│                                                                             │
│    gateway-service ──→ order-service (응답 대기)                             │
│         │                    │                                              │
│         ↓                    ↓                                              │
│    gateway-service         order-service                                    │
│    Thread Pool 고갈        이미 장애 상태                                   │
│         │                                                                   │
│         ↓                                                                   │
│    전체 시스템 다운!                                                        │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [시각화]                                                                   │
│                                                                             │
│    gateway-service     order-service      payment-service                   │
│    ┌──────────┐       ┌──────────┐       ┌──────────┐                      │
│    │          │──────→│          │──────→│  (장애)  │                       │
│    │  Thread  │       │  Thread  │       │  DB 연결  │                      │
│    │  Pool    │       │  Pool    │       │  풀 고갈  │                      │
│    │  고갈    │←──────│  고갈    │←──────│  응답 30s │                      │
│    │          │ 전파  │          │ 전파  │          │                       │
│    └──────────┘       └──────────┘       └──────────┘                      │
│       (3단계)            (2단계)            (1단계)                          │
│                                                                             │
│  핵심 원인: 장애 서비스에 대한 요청이 계속 쌓이면서                         │
│  호출자의 리소스(스레드, 연결, 메모리)를 고갈시킴                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

연쇄 장애의 핵심 메커니즘:

1. **Slow Service > Dead Service**: 응답이 완전히 없는 서비스보다
   느리게 응답하는 서비스가 더 위험하다. 연결과 스레드를 장시간 점유하기 때문이다.
2. **리소스 점유**: 응답을 기다리는 동안 호출자의 커넥션, 스레드, 메모리가 점유됨.
3. **역방향 전파**: 장애가 호출 체인의 역방향(downstream → upstream)으로 전파됨.
4. **증폭 효과**: 하나의 요청이 여러 서비스를 호출하면 장애가 기하급수적으로 증폭됨.

## 5.3 Istio/Envoy의 Circuit Breaker 구현

Istio는 전통적인 3-상태(Closed/Open/Half-Open) Circuit Breaker와 다른 방식을 사용한다.
**두 가지 상호 보완적 메커니즘**을 결합하여 더 효과적인 장애 격리를 제공한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             Istio/Envoy Circuit Breaker: 두 가지 메커니즘                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [메커니즘 1: Connection Pool Limits - 선제적(Proactive)]                   │
│  ─────────────────────────────────────────────────────                      │
│  설정: connectionPool                                                       │
│  목적: 과부하 사전 방지 (Bulkhead Pattern)                                  │
│  동작: 연결/요청 수가 임계값 초과 시 즉시 503 반환                          │
│                                                                             │
│    ┌────────────────────────────────────────────┐                           │
│    │           Connection Pool Limits           │                           │
│    ├────────────────────────────────────────────┤                           │
│    │                                            │                           │
│    │  요청 ──→ [maxConnections 검사]            │                           │
│    │            │                               │                           │
│    │            ├── 초과 → 즉시 503 반환        │                           │
│    │            │                               │                           │
│    │            └── 통과 → [http2MaxRequests]   │                           │
│    │                       │                    │                           │
│    │                       ├── 초과 → 즉시 503  │                           │
│    │                       │                    │                           │
│    │                       └── 통과 → 요청 전달 │                           │
│    │                                            │                           │
│    └────────────────────────────────────────────┘                           │
│                                                                             │
│  [메커니즘 2: Outlier Detection - 반응적(Reactive)]                         │
│  ─────────────────────────────────────────────────                          │
│  설정: outlierDetection                                                     │
│  목적: 장애 호스트 격리 (Circuit Breaker Pattern)                           │
│  동작: 연속 에러 감지 시 해당 호스트를 풀에서 일시적 제거                   │
│                                                                             │
│    ┌────────────────────────────────────────────┐                           │
│    │           Outlier Detection                │                           │
│    ├────────────────────────────────────────────┤                           │
│    │                                            │                           │
│    │  Host A: 정상 응답 ─────── [유지]          │                           │
│    │  Host B: 5xx x 5회 ─────── [제거] → 30s   │                           │
│    │  Host C: 정상 응답 ─────── [유지]          │                           │
│    │  Host D: 502 x 3회 ─────── [제거] → 30s   │                           │
│    │                                            │                           │
│    │  → 정상 Host A, C로만 트래픽 분배          │                           │
│    │  → B, D는 30s 후 자동 복귀                 │                           │
│    │                                            │                           │
│    └────────────────────────────────────────────┘                           │
│                                                                             │
│  [두 메커니즘의 관계]                                                       │
│                                                                             │
│  connectionPool과 outlierDetection은 독립적으로 동작하며,                   │
│  서로 보완적인 역할을 한다:                                                 │
│                                                                             │
│  - connectionPool: 전체 서비스에 대한 요청량을 제한 (선제적 보호)           │
│  - outlierDetection: 개별 호스트의 건강 상태를 모니터링 (반응적 격리)       │
│  - 함께 사용 시: 과부하 방지 + 장애 호스트 격리 = 완전한 장애 격리         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

두 메커니즘은 독립적으로 동작하지만, 함께 사용해야 완전한 장애 격리를 달성할 수 있다:

- **connectionPool만 사용**: 전체 요청량은 제한되지만, 장애 Pod으로 계속 요청이 전달될 수 있음
- **outlierDetection만 사용**: 장애 Pod은 제거되지만, 정상 Pod에 과부하가 걸릴 수 있음
- **둘 다 사용**: 요청량 제한 + 장애 Pod 격리 = 최적의 장애 격리

## 5.4 Netflix Hystrix vs Istio/Envoy Circuit Breaker

```
┌────────────────┬──────────────────────────────┬──────────────────────────────┐
│   비교 항목     │    Netflix Hystrix            │    Istio/Envoy               │
├────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 구현 위치      │ 애플리케이션 코드 (라이브러리)│ 인프라 (사이드카 프록시)      │
│ 언어 제한      │ JVM only (Java/Kotlin)       │ 언어 무관 (모든 언어 지원)   │
│ 코드 변경      │ 필요 (@HystrixCommand)       │ 불필요 (YAML 설정만)         │
│ 상태 전이      │ Closed → Open → Half-Open    │ Connection Limits +          │
│                │ (전통적 3-상태 모델)         │ Outlier Detection (2-메커니즘)│
│ Fallback       │ 내장 (캐시, 기본값 반환)     │ 미지원 (앱에서 직접 처리)    │
│ 적용 세밀도    │ 메서드 레벨                  │ 서비스/Pod 레벨              │
│ 운영 부담      │ 높음 (라이브러리 버전 관리,  │ 낮음 (인프라 설정,           │
│                │ 모든 서비스에 의존성 추가)   │ 앱 코드 변경 불필요)         │
│ Panic          │ 없음 (전체 차단)             │ 있음 (minHealthPercent로     │
│ Threshold      │                              │ 전체 장애 방지)              │
│ 메트릭         │ Hystrix Dashboard            │ Prometheus + Grafana         │
│                │ (별도 설치 필요)             │ (Istio 내장)                 │
│ 버전 관리      │ 서비스별 라이브러리 버전     │ Envoy 버전 (통합 관리)       │
│ 상태 (2026)    │ 유지보수 모드 (2018~)        │ 활발히 개발 중               │
│ 대안           │ Resilience4j (후속)          │ -                            │
└────────────────┴──────────────────────────────┴──────────────────────────────┘
```

**Hystrix의 장점**: 메서드 레벨 세밀한 제어, 내장 Fallback 지원.
동일 서비스 내에서 API별로 다른 Circuit Breaker 정책 적용 가능.

**Istio의 장점**: 언어 무관, 코드 변경 불필요, 통합 운영.
Panic Threshold로 완전한 서비스 중단을 방지하는 안전장치 제공.

**실무 권장**: Istio DestinationRule을 기본 방어선으로 사용하고,
메서드 레벨 세밀한 제어가 필요한 경우에만 Resilience4j 등을 추가 적용한다.

## 5.5 Circuit Breaker + Retry 조합 시 주의사항

VirtualService의 retry 설정과 DestinationRule의 Circuit Breaker를 함께 사용할 때
**Retry Storm(재시도 폭풍)**을 반드시 주의해야 한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WARNING: Retry Storm 위험!                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [문제 시나리오]                                                            │
│                                                                             │
│  VirtualService retry: 3회                                                  │
│  클라이언트 Pod: 10개                                                       │
│  원래 요청: 100 req/s                                                       │
│                                                                             │
│  장애 발생 시:                                                              │
│    100 req/s x 3회 retry = 300 req/s (3배 증폭!)                            │
│    10개 Pod 동시 retry = 최대 3000 req/s가 장애 서비스로 집중               │
│                                                                             │
│  → 장애 서비스 복구가 더욱 어려워짐                                         │
│  → 다른 서비스의 리소스도 retry로 인해 고갈                                 │
│  → 연쇄 장애 가속화!                                                       │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [해결 방안]                                                                │
│                                                                             │
│  1. DestinationRule Circuit Breaker와 반드시 함께 사용:                     │
│     - connectionPool로 요청 수 제한 → 과부하 방지                          │
│     - outlierDetection으로 장애 호스트 제거 → 정상 호스트에만 retry         │
│                                                                             │
│  2. VirtualService retry는 보수적으로 설정:                                 │
│     - attempts: 최대 3회 (그 이상은 비효율적)                               │
│     - perTryTimeout: 짧게 (예: 2s)                                         │
│     - retryOn: 특정 에러만 (예: 5xx, reset, connect-failure)               │
│                                                                             │
│  3. Retry Budget 활용 (Envoy 고급 설정):                                    │
│     - 전체 요청 대비 retry 비율 제한 (예: 20%)                             │
│     - retry 폭증 자체를 원천적으로 제한                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.6 실전 Circuit Breaker 설정 예시

다음은 프로덕션 환경에서 사용할 수 있는 Circuit Breaker 설정 예시이다.
connectionPool과 outlierDetection을 함께 사용하여 완전한 장애 격리를 구현한다.

```yaml
# 프로덕션 Circuit Breaker 설정 (order-service)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-circuit-breaker
  namespace: commerce
spec:
  host: order-service.commerce.svc.cluster.local
  trafficPolicy:
    # [메커니즘 1] Connection Pool Limits (선제적 보호)
    connectionPool:
      tcp:
        maxConnections: 100              # 최대 TCP 연결 100개
      http:
        http1MaxPendingRequests: 50      # HTTP/1.1 대기 큐 50개
        http2MaxRequests: 100            # HTTP/2 동시 요청 100개
        maxRequestsPerConnection: 10     # 연결당 10회 요청 후 재생성
        maxRetries: 3                    # Envoy 레벨 최대 재시도 3회

    # [메커니즘 2] Outlier Detection (반응적 격리)
    outlierDetection:
      consecutive5xxErrors: 5            # 5xx 에러 5회 연속 시 제거
      consecutiveGatewayErrors: 3        # 502/503/504 에러 3회 연속 시 제거
      interval: 10s                      # 검사 주기 10초
      baseEjectionTime: 30s             # 기본 제거 시간 30초 (지수 증가)
      maxEjectionPercent: 30             # 최대 30%까지만 제거
      minHealthPercent: 30               # 건강 비율 30% 이하 시 Panic Mode
```

```yaml
# 대응하는 VirtualService retry 설정 (보수적)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: order-service-vs
  namespace: commerce
spec:
  hosts:
    - order-service.commerce.svc.cluster.local
  http:
    - route:
        - destination:
            host: order-service.commerce.svc.cluster.local
      retries:
        attempts: 3                      # 최대 3회 retry
        perTryTimeout: 2s                # 각 시도당 타임아웃 2초
        retryOn: 5xx,reset,connect-failure  # 특정 에러만 retry
      timeout: 10s                       # 전체 타임아웃 10초
```

## 5.7 Envoy의 Panic Threshold 동작

Panic Threshold는 Envoy의 안전장치로, 너무 많은 호스트가 제거되어
서비스가 완전히 중단되는 것을 방지한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Panic Threshold 동작 시나리오                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [정상 상태] - 모든 호스트 건강                                             │
│                                                                             │
│    Host A: 정상   Host B: 정상   Host C: 정상   Host D: 정상               │
│       O              O              O              O                        │
│       │              │              │              │                        │
│       └──────────────┴──────────────┴──────────────┘                        │
│                      정상 로드 밸런싱                                       │
│                   (4개 호스트 모두 활용)                                     │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [장애 감지] - 일부 호스트 제거 (maxEjectionPercent 이내)                   │
│                                                                             │
│    Host A: 정상   Host B: 제거   Host C: 정상   Host D: 제거               │
│       O              X              O              X                        │
│       │                             │                                       │
│       └─────────────────────────────┘                                       │
│           B, D 제외하고 A, C로만 라우팅                                     │
│           (건강 비율 50% > minHealthPercent 30%)                             │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [Panic Mode 진입] - 건강 비율이 minHealthPercent 이하                      │
│                                                                             │
│    Host A: 제거   Host B: 제거   Host C: 제거   Host D: 정상               │
│       X              X              X              O                        │
│       │              │              │              │                        │
│       └──────────────┴──────────────┴──────────────┘                        │
│           건강 비율 25% < minHealthPercent 30%                               │
│           → Panic Mode 진입!                                                │
│           → 제거된 호스트 포함 전체로 트래픽 분배                           │
│                                                                             │
│  [Panic Mode의 판단 논리]                                                   │
│                                                                             │
│    서비스 완전 중단 (모든 요청 503)                                         │
│         vs                                                                  │
│    일부 요청 실패 + 나머지 요청 성공                                        │
│                                                                             │
│    → 후자가 낫다는 판단으로 모든 호스트에 트래픽 분배                       │
│    → 장애 호스트도 일부 요청은 처리할 수 있는 가능성 존재                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Panic Threshold 설정 가이드**:

- `minHealthPercent: 0` → Panic Mode 비활성화. 제거된 호스트는 절대 복귀하지 않음.
  소수 Pod 환경에서는 위험 (2개 중 1개 제거 = 50% 용량 손실).
- `minHealthPercent: 30` → 권장값. 건강 호스트가 30% 이하일 때 Panic Mode 진입.
- `minHealthPercent: 50` → 보수적. 빠르게 Panic Mode에 진입하여 가용성 우선.

---

# 6. 완전한 YAML 설정 가이드

아래는 프로덕션 환경에서 사용할 수 있는 DestinationRule의 전체 설정이다.
모든 주요 필드에 한국어 주석을 달아 설명한다.

```yaml
# 프로덕션 DestinationRule 전체 설정 (주석 포함)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: order-service-dr
  namespace: commerce
  labels:
    app: order-service
    team: commerce-backend
spec:
  # 대상 서비스의 FQDN (Fully Qualified Domain Name)
  # 같은 namespace 내에서는 short name 사용 가능하나, FQDN 권장
  host: order-service.commerce.svc.cluster.local

  # ──────────────────────────────────────────────────────
  # 글로벌 트래픽 정책 (모든 Subset에 기본 적용)
  # Subset-level 정책이 없으면 이 정책이 적용됨
  # ──────────────────────────────────────────────────────
  trafficPolicy:

    # 로드 밸런서 설정
    loadBalancer:
      simple: LEAST_REQUEST            # 최소 활성 요청 엔드포인트 선택
      # 또는 Consistent Hash 사용 시:
      # consistentHash:
      #   httpCookie:
      #     name: user_session
      #     ttl: 3600s

    # TCP 연결 풀 (Bulkhead Pattern)
    connectionPool:
      tcp:
        maxConnections: 200            # 최대 TCP 연결 수
        connectTimeout: 100ms          # TCP 연결 타임아웃
        tcpKeepalive:
          time: 7200s                  # Keepalive 시작 (2시간 유휴 후)
          interval: 75s                # Keepalive 프로브 간격

      # HTTP 연결 풀
      http:
        http1MaxPendingRequests: 1024  # HTTP/1.1 대기 큐 크기
        http2MaxRequests: 1024         # HTTP/2 동시 최대 요청 수
        maxRequestsPerConnection: 100  # 연결당 최대 100회 요청 후 재생성
        maxRetries: 3                  # Envoy 레벨 최대 재시도 횟수
        idleTimeout: 1h               # 유휴 연결 타임아웃 (1시간)
        h2UpgradePolicy: DEFAULT       # HTTP/2 업그레이드 정책

    # 이상치 탐지 (Outlier Detection / Circuit Breaker)
    outlierDetection:
      consecutive5xxErrors: 5          # 5xx 에러 연속 5회 시 제거
      consecutiveGatewayErrors: 3      # 502/503/504 에러 연속 3회 시 제거
      interval: 10s                    # 검사 주기 (10초)
      baseEjectionTime: 30s           # 기본 제거 시간 (지수적 증가)
      maxEjectionPercent: 50           # 최대 제거 비율 (전체의 50%)
      minHealthPercent: 30             # Panic Threshold (30% 이하 시 Panic)

    # TLS 설정 (메시 내부 서비스 간 통신)
    tls:
      mode: ISTIO_MUTUAL               # Istio 관리 mTLS (필수!)

  # ──────────────────────────────────────────────────────
  # Subset 정의 (서비스 버전별 그룹핑)
  # ──────────────────────────────────────────────────────
  subsets:
    # stable - 안정 버전 (프로덕션 트래픽 대부분)
    - name: stable
      labels:
        version: stable                # Pod label: version=stable

    # canary - 카나리 버전 (소량 트래픽으로 검증)
    - name: canary
      labels:
        version: canary                # Pod label: version=canary
      trafficPolicy:                   # Subset-level 오버라이드
        connectionPool:
          http:
            http2MaxRequests: 100      # canary는 더 보수적으로 (100)
        outlierDetection:
          consecutive5xxErrors: 3      # canary는 더 민감하게 (3회)
          baseEjectionTime: 60s        # canary는 더 오래 제거 (60초)

  # ──────────────────────────────────────────────────────
  # 가시성 제어 (exportTo)
  # ──────────────────────────────────────────────────────
  exportTo:
    - "."                              # 현재 namespace에만 공개
    # - "*"                            # 모든 namespace에 공개 (기본값)
    # - "istio-system"                 # 특정 namespace에만 공개
```

---

# 7. Envoy 변환 메커니즘

DestinationRule YAML은 istiod(컨트롤 플레인)에 의해 해석되고,
xDS(Discovery Service) 프로토콜을 통해 Envoy Sidecar Proxy에 전달된다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DestinationRule → Envoy 변환 흐름                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] DestinationRule YAML                                                   │
│       │                                                                     │
│       │  kubectl apply -f destinationrule.yaml                              │
│       │                                                                     │
│       ↓                                                                     │
│  [2] Kubernetes API Server                                                  │
│       │                                                                     │
│       │  CR(Custom Resource) 저장                                           │
│       │                                                                     │
│       ↓                                                                     │
│  [3] istiod (Pilot)                                                         │
│       │                                                                     │
│       │  CRD Watch → DestinationRule 감지                                   │
│       │  → Envoy Cluster Configuration 생성                                │
│       │                                                                     │
│       ↓                                                                     │
│  [4] xDS Protocol (gRPC streaming)                                          │
│       │                                                                     │
│       │  CDS (Cluster Discovery Service)                                    │
│       │  EDS (Endpoint Discovery Service)                                   │
│       │                                                                     │
│       ↓                                                                     │
│  [5] Envoy Sidecar Proxy                                                    │
│       │                                                                     │
│       │  Cluster 설정 업데이트 (Pod 재시작 불필요)                          │
│       │  → 즉시 새 정책 적용                                               │
│       │                                                                     │
│       ↓                                                                     │
│  [6] 트래픽에 정책 적용                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.1 Subset → Envoy Cluster 매핑

DestinationRule의 각 Subset은 Envoy 내부에서 독립적인 Cluster로 변환된다.
Cluster 이름은 다음과 같은 규칙으로 생성된다:

```
┌──────────────────────────────┬────────────────────────────────────────────────────────┐
│  DestinationRule Subset      │  Envoy Cluster Name                                    │
├──────────────────────────────┼────────────────────────────────────────────────────────┤
│  subset: "v1"                │  outbound|8080|v1|order-service.commerce.svc.          │
│  (port: 8080)                │  cluster.local                                         │
├──────────────────────────────┼────────────────────────────────────────────────────────┤
│  subset: "v2"                │  outbound|8080|v2|order-service.commerce.svc.          │
│  (port: 8080)                │  cluster.local                                         │
├──────────────────────────────┼────────────────────────────────────────────────────────┤
│  subset 미지정 (기본)        │  outbound|8080||order-service.commerce.svc.            │
│  (port: 8080)                │  cluster.local                                         │
└──────────────────────────────┴────────────────────────────────────────────────────────┘

형식: outbound|{port}|{subset}|{host}.{namespace}.svc.cluster.local
```

## 7.2 필드 매핑

DestinationRule의 각 필드가 Envoy의 어떤 설정으로 변환되는지:

```
┌──────────────────────────────────────┬──────────────────────────────────────────────┐
│  DestinationRule 필드                │  Envoy Configuration                          │
├──────────────────────────────────────┼──────────────────────────────────────────────┤
│  outlierDetection                    │  cluster.outlier_detection                    │
│  connectionPool.tcp.maxConnections   │  cluster.circuit_breakers.thresholds          │
│                                      │    .max_connections                           │
│  connectionPool.http.http2MaxRequests│  cluster.circuit_breakers.thresholds          │
│                                      │    .max_requests                              │
│  connectionPool.http                 │  cluster.circuit_breakers.thresholds          │
│    .http1MaxPendingRequests          │    .max_pending_requests                      │
│  connectionPool.http.maxRetries      │  cluster.circuit_breakers.thresholds          │
│                                      │    .max_retries                               │
│  loadBalancer.simple                 │  cluster.lb_policy                            │
│  loadBalancer.consistentHash         │  cluster.lb_policy: RING_HASH +              │
│                                      │  cluster.ring_hash_lb_config                  │
│  tls.mode                            │  cluster.transport_socket                     │
│  subsets[].labels                    │  cluster endpoints filter (label matching)    │
└──────────────────────────────────────┴──────────────────────────────────────────────┘
```

## 7.3 디버깅 명령어

DestinationRule이 올바르게 Envoy에 적용되었는지 확인하는 명령어:

```bash
# Envoy 클러스터 목록 확인
# 모든 outbound 클러스터와 설정 요약을 출력
istioctl proxy-config cluster <pod-name> -n <namespace>

# 특정 서비스의 클러스터 상세 정보 (JSON 형식)
# circuit_breakers, outlier_detection, lb_policy 등 확인
istioctl proxy-config cluster <pod-name> \
  --fqdn order-service.commerce.svc.cluster.local -o json

# Envoy endpoint 상태 확인
# 각 엔드포인트의 건강 상태와 제거 여부 확인
istioctl proxy-config endpoints <pod-name> -n <namespace>

# 특정 클러스터의 엔드포인트만 필터링
istioctl proxy-config endpoints <pod-name> \
  --cluster "outbound|8080|v1|order-service.commerce.svc.cluster.local"

# DestinationRule 동기화 상태 확인
# istiod와 Envoy 간 설정이 동기화되었는지 확인
istioctl proxy-status <pod-name> -n <namespace>

# Envoy 통계에서 Circuit Breaker 트리거 확인
# upstream_cx_overflow: connection pool 초과 횟수
# upstream_rq_pending_overflow: 대기 큐 초과 횟수
kubectl exec <pod-name> -n <namespace> -c istio-proxy -- \
  curl -s localhost:15000/stats | grep -E "(overflow|ejection)"

# DestinationRule 유효성 검사
istioctl analyze -n <namespace>
```

---

# 8. 실전 패턴

## 8.1 Canary 배포와 Subset별 정책

Canary 배포에서 DestinationRule은 Subset을 정의하고,
각 Subset에 적합한 trafficPolicy를 적용한다.

```yaml
# Canary 배포용 DestinationRule
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: payment-service-canary-dr
  namespace: commerce
spec:
  host: payment-service.commerce.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
  subsets:
    # 안정 버전 (v1) - 프로덕션 트래픽 95%
    - name: stable
      labels:
        version: v1
      trafficPolicy:
        loadBalancer:
          simple: LEAST_REQUEST
        connectionPool:
          tcp:
            maxConnections: 200
          http:
            http2MaxRequests: 500
            maxRequestsPerConnection: 50
        outlierDetection:
          consecutive5xxErrors: 5
          interval: 10s
          baseEjectionTime: 30s
          maxEjectionPercent: 50

    # 카나리 버전 (v2) - 프로덕션 트래픽 5%
    - name: canary
      labels:
        version: v2
      trafficPolicy:
        loadBalancer:
          simple: LEAST_REQUEST
        connectionPool:
          tcp:
            maxConnections: 50           # 카나리는 더 적은 연결
          http:
            http2MaxRequests: 100        # 카나리는 더 적은 요청
            maxRequestsPerConnection: 10
        outlierDetection:
          consecutive5xxErrors: 3        # 카나리는 더 민감하게 감지
          interval: 5s                   # 카나리는 더 자주 검사
          baseEjectionTime: 60s          # 카나리는 더 오래 제거
          maxEjectionPercent: 100        # 카나리는 전체 제거 허용
```

```yaml
# 대응하는 VirtualService (트래픽 분할)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payment-service-canary-vs
  namespace: commerce
spec:
  hosts:
    - payment-service.commerce.svc.cluster.local
  http:
    - route:
        - destination:
            host: payment-service.commerce.svc.cluster.local
            subset: stable               # 안정 버전으로 95%
          weight: 95
        - destination:
            host: payment-service.commerce.svc.cluster.local
            subset: canary               # 카나리 버전으로 5%
          weight: 5
```

## 8.2 gRPC 서비스 최적화

gRPC는 HTTP/2 기반으로 하나의 TCP 연결에서 여러 스트림을 멀티플렉싱한다.
따라서 일반 HTTP 서비스와 다른 Connection Pool 설정이 필요하다.

```yaml
# gRPC 전용 DestinationRule
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: grpc-inventory-service-dr
  namespace: commerce
spec:
  host: inventory-service.commerce.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL

    # gRPC에 최적화된 Connection Pool 설정
    connectionPool:
      tcp:
        maxConnections: 200              # TCP 연결 수 (gRPC 멀티플렉싱으로 적게 필요)
      http:
        h2UpgradePolicy: UPGRADE         # HTTP/2 업그레이드 강제
        http2MaxRequests: 5000           # gRPC 스트림 수 = 동시 요청 수 (높게)
        maxRequestsPerConnection: 0      # CRITICAL: 0 = 무제한!
                                          # gRPC 스트림 유지를 위해 반드시 0으로 설정
                                          # 0이 아니면 N회 요청 후 연결이 끊어져
                                          # gRPC 스트림이 강제 종료됨!
        idleTimeout: 7200s               # 긴 타임아웃 (gRPC 영속 스트림용)

    # gRPC 에러 코드 기반 이상치 탐지
    outlierDetection:
      consecutive5xxErrors: 5
      consecutiveGatewayErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

**핵심 주의사항**: `maxRequestsPerConnection`을 반드시 `0`(무제한)으로 설정해야 한다.
기본값이나 양수 값을 사용하면, 해당 횟수의 요청 후 TCP 연결이 종료되어
활성 gRPC 스트림이 강제로 끊어진다.

## 8.3 Session Affinity (세션 고정)

WebSocket이나 상태 유지(stateful) 서비스에서는 동일 클라이언트의 요청이
동일 Pod으로 전달되어야 한다. Consistent Hash를 이용한 Session Affinity로 이를 구현한다.

```yaml
# Cookie 기반 Session Affinity (WebSocket/Stateful 서비스)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: websocket-service-dr
  namespace: realtime
spec:
  host: chat-service.realtime.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL

    # Cookie 기반 Consistent Hash로 Session Affinity 구현
    loadBalancer:
      consistentHash:
        httpCookie:
          name: CHAT_SESSION_ID          # 세션 식별 쿠키 이름
          ttl: 86400s                    # 쿠키 만료 시간 (24시간)
          # Envoy가 첫 요청 시 이 쿠키를 자동 생성하여 응답에 포함
          # 이후 요청에서 동일 쿠키 → 동일 Pod으로 라우팅

    # WebSocket 연결에 적합한 Connection Pool
    connectionPool:
      tcp:
        maxConnections: 500              # WebSocket은 장시간 연결 유지
        tcpKeepalive:
          time: 300s                     # 5분마다 Keepalive
          interval: 30s
      http:
        http1MaxPendingRequests: 100
        maxRequestsPerConnection: 0      # 0 = 무제한 (WebSocket 연결 유지)
        idleTimeout: 3600s               # 1시간 유휴 타임아웃
```

## 8.4 데이터베이스 연결 제한

데이터베이스 프록시 서비스에 대한 연결을 엄격하게 제한하여
DB 연결 풀 고갈을 방지하는 패턴이다.

```yaml
# 데이터베이스 프록시 연결 제한
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: db-proxy-service-dr
  namespace: data
spec:
  host: db-proxy.data.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL

    # 엄격한 연결 제한 (DB 연결 풀 보호)
    connectionPool:
      tcp:
        maxConnections: 30               # DB 최대 연결 수에 맞춤 (엄격)
        connectTimeout: 5000ms           # DB 연결은 타임아웃 여유 있게
        tcpKeepalive:
          time: 600s                     # 10분마다 Keepalive
          interval: 60s
      http:
        http1MaxPendingRequests: 10      # 대기 큐도 작게 (DB 보호)
        http2MaxRequests: 30             # DB 연결 수와 동일
        maxRequestsPerConnection: 1000   # 연결 재사용 극대화
        idleTimeout: 300s                # 유휴 연결 5분 후 해제

    # DB 장애에 민감하게 반응
    outlierDetection:
      consecutive5xxErrors: 2            # 에러 2회만에 제거 (민감)
      interval: 5s                       # 5초마다 검사 (빈번)
      baseEjectionTime: 60s             # 1분간 제거 (충분한 복구 시간)
      maxEjectionPercent: 30             # 최대 30%만 제거 (가용성 확보)
      minHealthPercent: 50               # DB는 가용성이 매우 중요
```

---

# 9. 트러블슈팅 가이드

## 9.1 TLS 모드 충돌 (가장 흔한 문제)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [문제] TLS 모드 충돌 - HTTP 503                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  증상:                                                                      │
│    - DestinationRule 적용 직후 HTTP 503 Service Unavailable 발생            │
│    - DestinationRule을 제거하면 즉시 정상화                                 │
│    - 특정 서비스로의 모든 요청이 실패                                       │
│                                                                             │
│  원인:                                                                      │
│    DestinationRule의 TLS 모드 기본값이 DISABLE이므로,                       │
│    글로벌 mTLS가 활성화된 메시에서 TLS 모드를 명시하지 않으면               │
│    평문(plaintext)으로 요청 → mTLS를 기대하는 서버 Envoy가 거부             │
│                                                                             │
│    ┌──────────────┐  plaintext  ┌──────────────┐                            │
│    │ Client Envoy │ ──────────→ │ Server Envoy │                            │
│    │ TLS: DISABLE │             │ mTLS 기대    │                            │
│    │ (기본값)     │             │ → 연결 거부! │                            │
│    └──────────────┘             └──────────────┘                            │
│                                                                             │
│  해결:                                                                      │
│    trafficPolicy:                                                           │
│      tls:                                                                   │
│        mode: ISTIO_MUTUAL      # 반드시 명시!                              │
│                                                                             │
│  검증:                                                                      │
│    istioctl analyze -n <namespace>                                          │
│    # "ConflictingMeshGatewayVirtualServiceHosts" 경고 확인                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Subset 라우팅 실패

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [문제] Subset 정책이 적용되지 않음                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  증상:                                                                      │
│    - DestinationRule에 Subset별 trafficPolicy를 정의했으나 적용 안 됨       │
│    - 모든 트래픽이 글로벌 trafficPolicy로만 처리됨                          │
│    - Subset-level 로드 밸런싱이나 Circuit Breaker가 동작하지 않음           │
│                                                                             │
│  원인:                                                                      │
│    VirtualService가 해당 Subset을 명시적으로 참조하지 않음.                 │
│    Subset-level trafficPolicy는 VirtualService가 해당 Subset으로            │
│    명시적으로 라우팅할 때에만 활성화됨.                                     │
│                                                                             │
│    [잘못된 설정]                                                            │
│    VirtualService:                                                          │
│      route:                                                                 │
│        - destination:                                                       │
│            host: order-service         # subset 미지정!                     │
│            # → 글로벌 정책만 적용, subset 정책 무시                         │
│                                                                             │
│    [올바른 설정]                                                            │
│    VirtualService:                                                          │
│      route:                                                                 │
│        - destination:                                                       │
│            host: order-service                                              │
│            subset: v2                  # subset 명시 참조!                  │
│            # → v2 subset의 trafficPolicy 적용                              │
│                                                                             │
│  핵심:                                                                      │
│    Subset-level trafficPolicy는 VirtualService가 명시적으로                 │
│    해당 Subset을 라우팅 대상으로 지정할 때만 활성화된다.                    │
│    VirtualService 없이 DestinationRule만 있으면 글로벌 정책만 적용된다.     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.3 동일 호스트에 여러 DestinationRule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WARNING: 동일 호스트에 여러 DestinationRule은 정의되지 않은 동작!           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  증상:                                                                      │
│    - 일부 Subset이 누락되거나 trafficPolicy가 예상과 다르게 적용            │
│    - 간헐적으로 다른 정책이 적용됨                                          │
│    - 에러 로그나 경고 메시지가 없음 (Silent Failure!)                       │
│                                                                             │
│  원인:                                                                      │
│    동일 호스트에 여러 DestinationRule이 존재하면 Istio의 동작이             │
│    정의되지 않음(undefined behavior).                                       │
│    - 먼저 처리되는 DR의 Subset만 인식될 수 있음                             │
│    - trafficPolicy가 예측 불가능하게 병합되거나 무시될 수 있음              │
│    - 경고 없이 조용히 실패함 (Silent Failure)                               │
│                                                                             │
│  [잘못된 예시]                                                              │
│    dr-1.yaml: host: order-service, subsets: [v1, v2]                        │
│    dr-2.yaml: host: order-service, subsets: [v3]   # 위험!                  │
│    → v3 Subset이 무시될 수 있음                                             │
│                                                                             │
│  [올바른 예시]                                                              │
│    dr-all.yaml: host: order-service, subsets: [v1, v2, v3]                  │
│    → 하나의 DR에 모든 Subset 정의                                           │
│                                                                             │
│  Best Practice:                                                             │
│    호스트(서비스)당 DestinationRule은 반드시 하나만 생성한다.                │
│    여러 팀이 같은 서비스의 DR을 관리해야 하면,                              │
│    Helm chart나 Kustomize로 단일 DR을 생성하도록 파이프라인을 구성한다.     │
│                                                                             │
│  검증:                                                                      │
│    istioctl analyze -n <namespace>                                          │
│    # "ConflictingDestinationRules" 경고 확인                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.4 Connection Pool 초과 (503 UO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [문제] 간헐적 503 에러 (Envoy 응답 플래그: UO)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  증상:                                                                      │
│    - 간헐적으로 HTTP 503 반환                                               │
│    - Envoy 액세스 로그에 response_flags: "UO" (Upstream Overflow)           │
│    - 트래픽 증가 시 503 비율 증가                                           │
│                                                                             │
│  원인:                                                                      │
│    connectionPool 설정값이 실제 트래픽 대비 너무 작음                       │
│                                                                             │
│  진단:                                                                      │
│    # Envoy 통계에서 overflow 확인                                           │
│    kubectl exec <pod> -c istio-proxy -- \                                   │
│      curl -s localhost:15000/stats | grep overflow                          │
│                                                                             │
│    # upstream_cx_overflow: TCP 연결 초과 횟수                               │
│    # upstream_rq_pending_overflow: HTTP 대기 큐 초과 횟수                   │
│                                                                             │
│  해결:                                                                      │
│    1. overflow 메트릭 확인하여 어떤 제한이 부족한지 파악                     │
│    2. 사이징 공식으로 적정값 계산                                           │
│    3. connectionPool 값 상향 조정                                           │
│    4. 변경 후 overflow 메트릭이 0에 수렴하는지 모니터링                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.5 Outlier Detection이 동작하지 않을 때

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [문제] Outlier Detection 미동작                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  증상:                                                                      │
│    - 장애 Pod이 계속 트래픽을 받음                                          │
│    - Envoy 통계에서 ejection 관련 메트릭이 0                                │
│                                                                             │
│  확인 사항:                                                                 │
│    1. interval 값 확인: 기본 10s. 검사 주기가 지나야 탐지됨                 │
│    2. "연속" 에러 조건 확인: 정상 응답이 중간에 섞이면 카운터 리셋          │
│       - 5xx 4회 → 200 1회 → 5xx 1회 = 연속 1회 (리셋됨!)                   │
│    3. Panic Mode 확인: 이미 Panic Mode면 제거가 무시됨                      │
│    4. Pod 수 확인: Pod이 1개뿐이면 제거해도 Panic Mode로 복귀               │
│                                                                             │
│  진단:                                                                      │
│    kubectl exec <pod> -c istio-proxy -- \                                   │
│      curl -s localhost:15000/stats | grep -E "ejection|panic"               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 10. 대안 기술 비교

DestinationRule이 제공하는 기능을 다른 기술과 비교한다.

```
┌────────────────┬──────────────┬──────────────┬──────────────┬───────────────┬────────────┐
│   비교 항목     │ Istio        │ Netflix      │ Resilience4j │ Linkerd       │ K8s        │
│                │ Destination  │ Hystrix      │              │ ServiceProfile│ Native     │
│                │ Rule         │              │              │               │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 구현 방식      │ 인프라       │ 라이브러리   │ 라이브러리   │ 인프라        │ 없음       │
│                │ (사이드카)   │ (JVM)        │ (JVM)        │ (사이드카)    │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 언어 제한      │ 없음         │ JVM only     │ JVM only     │ 없음          │ N/A        │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 코드 변경      │ 불필요       │ 필요         │ 필요         │ 불필요        │ N/A        │
│                │ (YAML)       │ (annotation) │ (decorator)  │ (YAML)        │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ Circuit        │ O            │ O            │ O            │ O (제한적)    │ X          │
│ Breaker        │ (2-메커니즘) │ (3-상태)     │ (3-상태)     │ (실패율 기반) │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ Connection     │ O            │ O            │ X            │ X             │ X          │
│ Pool           │ (TCP+HTTP)   │ (Thread Pool)│              │               │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ Load           │ O (5종       │ X (Ribbon    │ X            │ O (제한적,    │ Round-     │
│ Balancing      │ + Hash)      │ 별도 필요)   │              │  EWMA)        │ Robin only │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ Subset         │ O            │ X            │ X            │ X             │ X          │
│ Management     │ (label기반)  │              │              │               │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ Fallback       │ X (앱 처리)  │ O (내장)     │ O (내장)     │ X             │ X          │
│ 지원           │              │              │              │               │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 표현력         │ 매우 높음    │ 높음         │ 높음         │ 낮음          │ 매우 낮음  │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 운영 복잡도    │ 중간         │ 높음         │ 중간         │ 낮음          │ 낮음       │
│                │ (메시 관리)  │ (라이브러리) │ (라이브러리) │ (경량 메시)   │            │
├────────────────┼──────────────┼──────────────┼──────────────┼───────────────┼────────────┤
│ 상태 (2026)    │ 활발 개발    │ 유지보수     │ 활발 개발    │ 활발 개발     │ 기본 제공  │
│                │              │ 모드 (2018~) │              │               │            │
└────────────────┴──────────────┴──────────────┴──────────────┴───────────────┴────────────┘
```

**선택 가이드**:

- **Istio DestinationRule**: 다국어(polyglot) 마이크로서비스 환경에서 통합 QoS 관리.
  서비스 메시를 이미 사용 중이거나 도입 예정인 경우 최적의 선택.
- **Resilience4j**: JVM 기반 서비스에서 메서드 레벨 세밀한 제어가 필요한 경우.
  Istio와 함께 사용하여 다층 방어(defense-in-depth) 구현 가능.
- **Linkerd ServiceProfile**: 경량 서비스 메시가 필요한 경우.
  설정이 간단하지만 표현력은 Istio 대비 제한적.
- **Kubernetes Native**: 단순한 서비스 간 통신에 추가 복원력이 불필요한 경우.

---

# 11. 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DestinationRule 핵심 요약                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [정의]                                                                     │
│  DestinationRule = Istio 서비스 메시의 Post-Routing QoS 정책 엔진           │
│  VirtualService가 "어디로" 결정하면, DestinationRule이 "어떻게" 결정        │
│                                                                             │
│  [5대 핵심 기능]                                                            │
│                                                                             │
│  1. Subsets (서비스 버전 그룹)                                              │
│     - Pod label 기반 버전 그룹핑                                            │
│     - 각 Subset이 독립 Envoy Cluster로 변환                                │
│     - Subset별 독립 trafficPolicy 적용 가능                                │
│                                                                             │
│  2. Load Balancing (로드 밸런싱)                                            │
│     - 5종 알고리즘: ROUND_ROBIN, LEAST_REQUEST, RANDOM,                     │
│       PASSTHROUGH, Consistent Hash                                          │
│     - Session Affinity: Cookie/Header/IP 기반 Hash                         │
│                                                                             │
│  3. Circuit Breaker (장애 차단)                                             │
│     - connectionPool: 선제적 보호 (연결/요청 수 제한)                      │
│     - outlierDetection: 반응적 격리 (장애 호스트 자동 제거)                │
│     - 두 메커니즘 함께 사용 시 완전한 장애 격리                             │
│                                                                             │
│  4. TLS (서비스 간 암호화)                                                  │
│     - DISABLE / SIMPLE / MUTUAL / ISTIO_MUTUAL                              │
│     - 메시 내부: ISTIO_MUTUAL 필수                                          │
│                                                                             │
│  5. Connection Pool (연결 풀 관리)                                          │
│     - TCP + HTTP 계층별 세밀한 제어                                         │
│     - Bulkhead Pattern으로 리소스 격리                                      │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                             │
│  [핵심 규칙]                                                                │
│                                                                             │
│  - Make-Before-Break: 배포 시 DR 먼저, 제거 시 VS 먼저                     │
│  - TLS 기본값 DISABLE + 글로벌 mTLS = 즉시 503! (반드시 명시)              │
│  - 호스트당 DestinationRule 하나만 (중복 시 정의되지 않은 동작)             │
│  - Subset 정책은 VS가 명시적으로 참조할 때만 활성화                         │
│  - gRPC: maxRequestsPerConnection 반드시 0으로 설정                         │
│  - Retry + Circuit Breaker 함께 사용 (Retry Storm 방지)                    │
│                                                                             │
│  [Best Practice]                                                            │
│                                                                             │
│  - 모든 DestinationRule에 tls.mode: ISTIO_MUTUAL 명시                      │
│  - connectionPool + outlierDetection 항상 함께 사용                         │
│  - Canary Subset에는 더 보수적인 정책 적용                                  │
│  - exportTo로 가시성 제한 (불필요한 namespace 노출 방지)                    │
│  - istioctl analyze로 설정 유효성 정기 검증                                 │
│  - Envoy 메트릭 (overflow, ejection) 상시 모니터링                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**키워드**: DestinationRule, Service QoS, Circuit Breaker, Cascading Failure, Outlier Detection, Connection Pool, Bulkhead Pattern, Netflix Hystrix, Load Balancing, Consistent Hash, Session Affinity, TLS, ISTIO_MUTUAL, Subset, Envoy Cluster, xDS, Make-Before-Break, Panic Threshold, gRPC, Canary Deployment

