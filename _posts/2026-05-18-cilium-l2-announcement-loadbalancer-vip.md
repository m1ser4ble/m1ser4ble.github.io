---
layout: single
title: "Cilium L2 Announcement + LoadBalancer VIP 완전 가이드"
date: 2026-05-18 23:00:00 +0900
categories: infra
excerpt: "Cilium L2 Announcement와 LB-IPAM으로 베어메탈 Kubernetes에서 LoadBalancer VIP를 ARP와 NDP로 광고하는 방법을 정리한 글이다."
toc: true
toc_sticky: true
tags: [cilium, loadbalancer, vip, arp, kubernetes]
source: "/home/dwkim/dwkim/docs/infra/cilium-l2-announcement-loadbalancer-vip.md"
---

TL;DR
- Cilium L2 Announcement는 베어메탈 Kubernetes에서 LoadBalancer VIP를 ARP/NDP로 광고하는 기능이다.
- LB-IPAM이 VIP를 할당하고, L2 Announcement가 그 IP를 같은 L2 네트워크에 노출한다.
- Wi-Fi client isolation, proxy ARP, DAI 같은 네트워크 장비 기능이 가장 흔한 함정이다.

## 1. 개념
Cilium L2 Announcement는 클라우드 LB 없이도 `type: LoadBalancer` Service를 외부에 노출하게 해주는 기능이다. Cilium이 VIP를 잡고 같은 브로드캐스트 도메인에 ARP/NDP로 "이 IP는 여기 있다"라고 알린다.

## 2. 배경
온프렘 Kubernetes는 `EXTERNAL-IP`가 `<pending>`에 머무는 문제가 오래 있었다. MetalLB 같은 대안이 필요했고, Cilium은 eBPF와 K8s Lease를 이용해 네이티브한 해결책을 제공했다.

## 3. 이유
NodePort는 포트 노출이 거칠고, 수동 ExternalIP는 장애 대응이 약하다. VIP 기반 접근은 사용자 경험과 운영성을 동시에 챙길 수 있어서 필요하다.

## 4. 특징
- `CiliumLoadBalancerIPPool`과 `CiliumL2AnnouncementPolicy`를 조합한다.
- Lease 기반 leader election으로 VIP 응답 노드를 정한다.
- ARP와 IPv6 NDP를 모두 다룬다.
- MetalLB, kube-vip, PureLB와 같은 영역을 대체하거나 보완한다.

## 5. 상세 내용
실전에서는 네트워크 장비가 더 큰 변수다. 특히 Wi-Fi AP의 client isolation, proxy ARP, DAI, ARP spoofing protection이 켜져 있으면 gratuitous ARP가 막혀 VIP failover가 깨질 수 있다. 원문은 이런 함정까지 포함해서 베어메탈 LoadBalancer 설계를 설명한다.

# Cilium L2 Announcement + LoadBalancer VIP 완전 가이드

> **작성일**: 2026-05-18
> **카테고리**: Infra / Kubernetes Networking / Cilium / Bare-metal LB
> **포함 내용**: Cilium L2 Announcement, LoadBalancer VIP, ARP (RFC 826), Gratuitous ARP (RFC 5227), NDP (RFC 4861), CiliumL2AnnouncementPolicy, CiliumLoadBalancerIPPool, LB-IPAM, eBPF L2 Responder Map, Kubernetes Lease, Leader Election, MetalLB L2/BGP, kube-vip, PureLB, Cilium BGP Control Plane, NodePort vs LoadBalancer, Envoy, Wi-Fi Client Isolation / Proxy ARP / ARP Spoofing Protection, Raspberry Pi brcmfmac 버그, externalTrafficPolicy=Local 비호환, Dynamic ARP Inspection (DAI), Static ARP, Mesh Wi-Fi proxy ARP, Datadog/Adobe/Bell Canada/Sky UK/OpenShift/Equinix/RKE2/K3s/Talos/GitLab/Homelab 사례, On-prem 마이그레이션 패턴

---

# 1. Cilium L2 Announcement란?

## 핵심 개념

베어메탈이나 온프렘 환경에서 LoadBalancer VIP를 같은 L2 네트워크에 광고하는 기능이다. Cilium이 eBPF와 ARP/NDP를 사용해 VIP 응답을 맡는다.

## VIP / NodePort / ClusterIP 관계

LoadBalancer VIP는 서비스 전용 가상 IP를 제공하고, NodePort는 노드 IP와 포트를 그대로 드러낸다. 온프렘에서는 VIP가 가장 자연스럽다.

---

## 2. 용어 사전

- `ARP`: IPv4 주소를 MAC 주소로 해석하는 프로토콜
- `NDP`: IPv6의 이웃 발견 프로토콜
- `Lease`: K8s leader election 상태 저장소
- `LB-IPAM`: LoadBalancer IP 할당 기능

## 3. 등장 배경과 이유

Kubernetes가 클라우드 전제에서 출발했기 때문에 베어메탈에서는 LoadBalancer가 공백이었다. Cilium L2 Announcement는 이 공백을 메우기 위해 추가됐다.

## 4. 특징

- VIP 할당과 광고를 분리해서 다룬다
- Lease 기반으로 leader를 선출한다
- ARP/NDP 응답을 커널 가까이서 처리한다
- MetalLB와 유사하지만 Cilium datapath와 자연스럽게 붙는다

## 5. 상세 내용 (original content)

실제 장애는 네트워크 장비와 무선 환경에서 자주 터진다. 원문은 `externalTrafficPolicy=Local`의 비호환성, Wi-Fi client isolation, proxy ARP, DAI, 그리고 Failover 시 ARP 캐시 갱신 문제까지 같이 다룬다.
