---
layout: single
title: "cert-manager + Let's Encrypt + ACME 자동 TLS 인증서 완전 가이드"
date: 2026-05-18 23:00:00 +0900
categories: security
excerpt: "cert-manager와 ACME를 사용해 Kubernetes에서 TLS 인증서를 자동 발급·갱신·배포하는 방법을 정리한 글이다."
toc: true
toc_sticky: true
tags: [certmanager, letsencrypt, acme, kubernetes, tls]
source: "/home/dwkim/dwkim/docs/security/cert-manager-letsencrypt-acme-자동tls인증서.md"
---

TL;DR
- cert-manager는 Kubernetes에서 TLS 인증서 발급, 갱신, 폐기를 선언적으로 자동화하는 컨트롤러다.
- Let's Encrypt와 ACME를 붙이면 90일짜리 인증서를 사람이 손대지 않고 운영할 수 있다.
- HTTP-01, DNS-01, TLS-ALPN-01의 차이를 알아야 하고, 와일드카드와 강제 HTTPS 환경은 특히 주의해야 한다.

## 1. 개념
cert-manager는 Kubernetes CRD를 이용해 인증서 상태를 선언하고, 컨트롤러가 ACME CA와 통신해 실제 Secret을 만드는 방식의 PKI 자동화 도구다. 운영자가 직접 PEM 파일을 배포하는 대신, `Certificate` 리소스만 선언하면 발급과 갱신이 따라온다.

## 2. 배경
인증서 유효기간이 짧아지고, 서비스가 Kubernetes 위에서 빠르게 늘어나면서 수동 발급과 수동 갱신은 운영 리스크가 됐다. Let's Encrypt와 ACME가 자동화를 표준으로 만들었고, cert-manager는 그 흐름을 Kubernetes-native하게 흡수한 도구다.

## 3. 이유
이 도구가 필요한 이유는 단순히 편해서가 아니다. 만료 사고를 줄이고, 멀티 환경에서 같은 패턴으로 인증서를 다루고, GitOps 흐름 안에서 인증서 구성을 코드처럼 관리하기 위해서다.

## 4. 특징
- `Certificate` → `CertificateRequest` → `Order` → `Challenge`로 이어지는 명확한 상태 모델을 가진다.
- HTTP-01, DNS-01, TLS-ALPN-01을 지원해 환경별 제약에 맞게 선택할 수 있다.
- `Issuer`, `ClusterIssuer`, webhook, cainjector, Helm, Argo CD와 잘 맞는다.
- 와일드카드 인증서와 내부망 인증서처럼 사람이 자주 실수하는 케이스를 자동화하기 좋다.

## 5. 상세 내용
핵심은 ACME challenge를 환경에 맞게 고르는 것이다. 공개 서비스는 HTTP-01로 단순하게 갈 수 있지만, 와일드카드나 포트 80이 막힌 환경은 DNS-01이 필요하다. Cilium처럼 강제 HTTPS 리다이렉트가 앞단에 있으면 HTTP-01 bootstrap loop가 생길 수 있으니 solver 전용 예외 처리가 필요하다.

# cert-manager + Let's Encrypt + ACME 자동 TLS 인증서 완전 가이드

> **작성일**: 2026-05-18
> **카테고리**: Security / TLS / PKI / Kubernetes / cert-manager
> **포함 내용**: cert-manager, Let's Encrypt, ISRG, ACME (RFC 8555), HTTP-01 / DNS-01 / TLS-ALPN-01 challenge, ClusterIssuer / Issuer / Certificate / CertificateRequest / Order / Challenge CRD, X.509 v3 (RFC 5280), SAN, CN deprecation (RFC 6125), CSR (PKCS#10), TLS 1.2/1.3 (RFC 5246/8446), SNI (RFC 6066), HSTS (RFC 6797), Certificate Transparency (RFC 6962), OCSP / OCSP stapling (RFC 6960), CAB Forum Baseline Requirements, Helm OCI registry, Argo CD GitOps 통합, AppProject clusterResourceWhitelist, ignoreDifferences, cert-manager webhook / cainjector, jetstack/Venafi, kube-lego, ingress.cilium.io/force-https HTTP-01 bootstrap loop, ZeroSSL, Google Trust Services (GTS), AWS ACM, GCP Managed Certificates, Azure Key Vault, HashiCorp Vault PKI, AWS Private CA, GCP CAS, Caddy, Traefik, SPIRE/SPIFFE, mTLS, Istio + cert-manager + istio-csr, CA 47일 단축 (CAB Forum SC-081v3), Equifax/MS Teams/LinkedIn 만료 사고, Cloudflare/AWS/GCP/Azure/Mozilla/EFF/Wikimedia/GitHub/GitLab/Pinterest/Lyft 사례

---

# 1. cert-manager + Let's Encrypt란?

## 핵심 개념

Kubernetes에서 TLS 인증서를 자동으로 발급하고 갱신하는 컨트롤러다. 사용자는 발급 정책만 선언하고, cert-manager가 ACME CA와 통신해 Secret까지 채운다.

## 왜 자동화인가?

인증서 유효기간이 짧아질수록 수동 갱신은 사고 확률만 높인다. 자동화는 선택이 아니라 운영 기본값이 됐다.

---

## 2. 용어 사전

- `cert-manager`: Kubernetes-native 인증서 컨트롤러
- `Let's Encrypt`: 무료 ACME CA
- `ACME`: 인증서 발급 자동화 프로토콜
- `HTTP-01` / `DNS-01` / `TLS-ALPN-01`: ACME challenge 방식

## 3. 등장 배경과 이유

수동 갱신, 다중 환경 관리, 짧아지는 인증서 수명, GitOps 운영이 겹치면서 기존 방식이 버티기 어려워졌다. cert-manager는 이 공백을 메우기 위해 등장했다.

## 4. 특징

- CRD 기반 선언형 관리
- 다양한 issuer 지원
- 자동 갱신과 Secret 배포
- Helm, Argo CD와의 자연스러운 결합

## 5. 상세 내용 (original content)

원문은 `HTTP-01`의 리다이렉트 함정, `DNS-01`의 와일드카드 대응, `ClusterIssuer` 설계, 그리고 GitOps 연동까지 다룬다. 실제 운영에서는 "어떤 challenge를 쓸 것인가"보다 "어떤 환경에서 실패하는가"를 먼저 봐야 한다.
