---
layout: single
title: "OPA(Open Policy Agent): CNCF Graduated Policy as Code 엔진 완전 가이드"
date: 2026-07-06 16:21:00 +0900
categories: cloud
excerpt: "CNCF Graduated 프로젝트 OPA가 왜 cloud native 정책 엔진의 표준처럼 쓰이는지, Rego와 Gatekeeper, 대안 선택 기준까지 정리한다."
toc: true
toc_sticky: true
tags: [opa, open-policy-agent, rego, policy-as-code, cncf, kubernetes, security]
---

TL;DR
- OPA는 authorization, admission control, CI/CD guardrail, infrastructure compliance 같은 결정을 애플리케이션 코드 밖으로 빼는 general-purpose policy engine이다.
- CNCF 기준 OPA는 2018-03-29 Sandbox, 2019-04-02 Incubating, 2021-01-29 Graduated로 올라갔고, 공식 graduation 발표는 2021-02-04에 나왔다.
- 핵심 구조는 `input` JSON + `data` JSON + Rego policy -> decision이다. OPA는 결정을 만들고, 실제 차단은 애플리케이션, Envoy, Kubernetes admission webhook 같은 PEP가 한다.
- Kubernetes만 보면 Gatekeeper, Kyverno, ValidatingAdmissionPolicy(CEL)가 경쟁한다. 여러 도메인에서 같은 정책 언어와 엔진을 쓰려면 OPA가 강하다.
- 2026-07-06 기준 GitHub 최신 릴리스는 v1.18.2(2026-07-02)이고, OPA 1.0은 2024-12-20에 Rego v1 문법을 기본값으로 만든 큰 전환점이다.

# OPA(Open Policy Agent): CNCF Graduated Policy as Code 엔진 완전 가이드

> **작성일**: 2026-07-06  
> **카테고리**: Cloud / Security / Kubernetes / Policy as Code  
> **포함 내용**: OPA, Open Policy Agent, Rego, Policy as Code, PDP/PEP, Bundle, Decision Log, Gatekeeper, Conftest, Envoy External Authorization, Kubernetes Admission Control, ValidatingAdmissionPolicy, CEL, Kyverno, Cedar, Sentinel, XACML, Datalog

## 핵심 요약

OPA는 "정책을 코드에서 분리한다"는 문제를 푸는 도구다. 서비스마다 `if user.role == ...` 같은 권한 로직을 흩뿌리거나, Kubernetes admission policy, Terraform compliance, API authorization을 각각 다른 방식으로 관리하면 정책 변경이 배포와 강하게 묶인다. OPA는 이 결정을 외부 policy decision point로 빼고, 정책은 Rego로 작성하고, 호출자는 JSON 형태의 입력을 넘긴다.

OPA가 CNCF Graduated가 됐다는 말은 "새로 뜬 실험 프로젝트"가 아니라 "거버넌스, 보안 감사, 운영 채택, 커뮤니티 성숙도 기준을 통과한 CNCF 상위 maturity 프로젝트"라는 뜻에 가깝다. CNCF 공식 페이지는 OPA가 2021-01-29에 Graduated maturity로 이동했다고 기록하고, CNCF 공식 발표는 2021-02-04에 나왔다.

## 용어 사전

| 용어 | 뜻 | 실전 의미 |
|---|---|---|
| OPA | Open Policy Agent | 범용 policy decision engine. "Open"은 open source, "Policy Agent"는 정책 결정을 맡는 독립 에이전트라는 의미다. |
| Policy as Code | 정책을 텍스트 코드로 관리하는 방식 | 버전 관리, 리뷰, 테스트, CI 적용이 가능해진다. |
| Rego | OPA의 declarative policy language | JSON/YAML 같은 structured data 위에서 allow/deny, risk score, rewrite 결과를 계산한다. |
| PDP | Policy Decision Point | 정책을 평가해 결정을 내리는 곳. OPA가 이 역할을 한다. |
| PEP | Policy Enforcement Point | 결정을 실제로 적용하는 곳. API server, Envoy, application middleware 등이 맡는다. |
| `input` | 호출자가 OPA에 넘기는 요청 문맥 | 사용자, 경로, HTTP method, Kubernetes AdmissionReview 같은 동적 값이다. |
| `data` | OPA가 가진 base/virtual document | 조직 정책, role mapping, entitlement, resource metadata처럼 정책 평가에 필요한 데이터다. |
| Bundle | policy와 data를 묶은 배포 단위 | OPA가 HTTP/S3 등에서 pull해 hot reload할 수 있다. |
| Decision Log | 정책 결정 감사 로그 | 어떤 입력으로 어떤 정책 경로가 어떤 결정을 냈는지 추적한다. |
| Gatekeeper | OPA 기반 Kubernetes admission controller | ConstraintTemplate/Constraint CRD와 audit 기능을 제공한다. |
| Conftest | OPA/Rego로 config 파일을 테스트하는 도구 | Terraform, Kubernetes YAML, Dockerfile 같은 파일을 CI에서 검사한다. |
| CEL | Common Expression Language | Kubernetes ValidatingAdmissionPolicy 등에서 쓰는 in-process expression language다. |
| XACML | eXtensible Access Control Markup Language | OASIS의 오래된 표준 access control policy language다. |

## 등장 배경과 이유

기존 방식은 보통 셋 중 하나였다.

1. 애플리케이션 코드에 authorization logic을 직접 넣는다.
2. Kubernetes RBAC, IAM, gateway rule, CI rule처럼 도메인별 정책 시스템을 따로 쓴다.
3. XACML 같은 표준 PDP/PEP 모델을 쓰되, XML 기반 복잡도와 제품 종속성을 감수한다.

이 방식들은 규모가 커질수록 약점이 분명해진다. 정책 변경이 애플리케이션 재배포가 되고, 서비스별 언어와 프레임워크에 따라 권한 로직이 갈라지고, 감사 관점에서는 "왜 이 요청이 허용됐는가"를 따라가기 어렵다. Kubernetes만 해도 RBAC은 Kubernetes API 권한에는 좋지만, "이 Pod는 반드시 approved registry 이미지만 써야 한다", "team label이 없으면 배포하면 안 된다", "Terraform plan 비용이 예산을 넘으면 PR을 막는다" 같은 정책까지 하나로 커버하지 못한다.

OPA는 이 공통점을 잘라낸다. 정책 결정은 별도 엔진에 맡기고, 각 시스템은 자신이 가진 문맥을 JSON으로 넘긴다. 그래서 같은 Rego 언어로 API authorization, Kubernetes admission, Envoy ext_authz, Terraform plan 검사, Kafka authorization까지 다룰 수 있다.

## 역사적 기원

OPA는 2016년에 시작된 프로젝트로, CNCF의 2020년 소개 글도 "여러 기술과 시스템 사이의 policy enforcement를 통합하려는 목적"에서 출발했다고 설명한다. CNCF의 Torin Sandall 인터뷰에 따르면 OPA는 Tim Hinrichs, Torin Sandall, Teemu Koponen이 co-created했고, cloud native stack 전반의 policy와 authorization을 통합하는 building block을 목표로 했다.

CNCF 여정은 다음처럼 정리된다.

| 날짜 | 사건 |
|---|---|
| 2016 | OPA 프로젝트 시작 |
| 2017 | Netflix authorization 사례가 KubeCon/CloudNativeCon에서 공개되며 cloud native authorization use case가 알려짐 |
| 2018-03-29 | CNCF Sandbox 수락 |
| 2019-04-02 | CNCF Incubating 이동 |
| 2021-01-29 | CNCF Graduated maturity 이동 |
| 2021-02-04 | CNCF 공식 graduation 발표 |
| 2024-12-20 | OPA v1.0.0 릴리스. Rego v1 문법이 기본값이 됨 |
| 2026-07-02 | OPA v1.18.2 릴리스 |

## 학술적/이론적 배경

OPA 자체가 특정 RFC나 ISO 표준 하나를 구현한 도구는 아니다. 이론적 배경은 세 갈래다.

첫째, Rego는 Datalog에서 영감을 받은 declarative query language다. Datalog는 logic programming과 database query 연구에서 온 언어 계열이고, "어떻게 계산할지"보다 "어떤 조건이 참인지"를 표현한다. Rego도 이 관점을 가져와 정책 작성자가 반복문과 실행 순서보다 조건, 관계, 결과에 집중하게 한다.

둘째, authorization architecture 관점에서는 PDP/PEP 분리 모델과 맞닿아 있다. XACML은 OASIS 표준으로 PDP/PEP 구조와 attribute 기반 access control을 정리한 오래된 계열이다. OPA는 XACML을 그대로 구현한 것은 아니지만, "결정 지점과 집행 지점을 분리한다"는 운영 모델을 modern JSON/cloud native 환경에 맞게 단순화했다.

셋째, cloud native 운영 모델이다. Kubernetes controller, admission webhook, Envoy External Authorization, GitOps, CI/CD guardrail처럼 정책을 사람의 수동 승인 대신 자동화된 control point에 넣는다. OPA는 이 control point들이 공통으로 질의할 수 있는 decision engine이 된다.

## 연대표

| 시기 | 변화 | 의미 |
|---|---|---|
| 2016 | OPA 시작 | hardcoded authorization과 fragmented policy system을 줄이려는 출발 |
| 2018 | CNCF Sandbox | cloud native ecosystem 안으로 들어옴 |
| 2019 | Incubating | 채택과 거버넌스 성숙도 상승 |
| 2020 | Gatekeeper와 Kubernetes admission use case 확산 | OPA가 Kubernetes policy 엔진으로 많이 알려짐 |
| 2021 | CNCF Graduated | production adoption, governance, security audit 기준을 통과 |
| 2024 | OPA 1.0 | Rego v1 syntax 기본화, backward compatibility migration이 중요해짐 |
| 2026 | v1.18.x 계열 | OPA는 여전히 활발히 릴리스되는 CNCF Graduated 프로젝트 |

## 동작 메커니즘

OPA의 기본 흐름은 짧다.

```text
Caller / PEP
  |
  | input JSON
  v
OPA / PDP
  |-- Rego policy
  |-- data documents
  |-- built-ins
  v
decision JSON
  |
  v
Caller / PEP enforces allow, deny, warn, mutate, audit...
```

예를 들어 HTTP API는 요청 method, path, user, token claim을 `input`으로 넘긴다. OPA는 `data.httpapi.authz.allow` 같은 decision path를 평가하고 `true/false` 또는 더 풍부한 JSON 결정을 돌려준다. Envoy에서는 External Authorization API를 통해 OPA-Envoy plugin이 gRPC authorization service로 동작할 수 있다. Kubernetes에서는 API server admission request를 webhook이 받아 OPA/Gatekeeper 정책으로 검증한다.

운영에서는 policy/data 배포가 더 중요하다. OPA Bundle은 policy와 data를 tar archive로 묶어 원격 서버에서 pull하게 만들고, reload 후 즉시 적용할 수 있게 한다. Decision Log는 감사와 디버깅을 위해 어떤 decision path가 어떤 입력을 어떻게 평가했는지 남긴다.

## 대안 비교표

| 선택지 | 강점 | 약점 | 잘 맞는 상황 |
|---|---|---|---|
| OPA/Rego | 범용성, JSON document model, 다양한 integration, decision log/bundle | Rego 학습 곡선, data distribution 설계 필요 | Kubernetes, API, Envoy, CI/CD, IaC를 한 정책 체계로 묶고 싶을 때 |
| Gatekeeper | Kubernetes CRD, audit, constraint model | Kubernetes admission에 특화 | Kubernetes cluster guardrail이 핵심일 때 |
| Kyverno | Kubernetes-native YAML 정책, validate/mutate/generate/verify images | Kubernetes 밖 범용성은 OPA보다 약함 | 플랫폼팀이 Rego보다 YAML 정책을 선호하고 image verification/mutation이 중요할 때 |
| ValidatingAdmissionPolicy(CEL) | API server in-process, webhook 운영 부담 없음, Kubernetes v1.30 stable | Kubernetes validation 중심, 외부 데이터/복잡한 재사용에는 한계 | 단순하고 빠른 Kubernetes admission validation |
| Cedar / Amazon Verified Permissions | application authorization에 특화, principal/action/resource 모델 명확 | cloud/vendor 선택과 도메인 모델 제약 | 애플리케이션 fine-grained authz를 Cedar 모델로 설계할 때 |
| HashiCorp Sentinel | Terraform/HCP 생태계와 자연스러운 결합 | HashiCorp 제품 중심 | Terraform Enterprise/HCP Terraform 정책 관리 |
| XACML | 오래된 표준, ABAC/PDP/PEP 모델 명확 | XML/표준 복잡도, cloud native 개발자 경험 약함 | 표준 기반 enterprise authorization 제품군과 통합할 때 |
| Hardcoded logic | 시작이 빠름 | 중복, 감사 어려움, 정책 변경마다 배포 | 정말 작은 단일 서비스에서 정책 수명이 짧을 때 |

## 상황별 최적 선택

- 여러 시스템에서 같은 정책 언어를 쓰고 싶다: OPA를 먼저 본다.
- Kubernetes admission만 필요하고 Rego를 감당할 수 있다: Gatekeeper가 적합하다.
- Kubernetes 정책을 YAML 리소스처럼 쓰고, mutate/generate/image verification이 중요하다: Kyverno가 더 단순하다.
- Kubernetes에서 "replicas <= 5", "label 필수"처럼 단순 검증만 필요하다: ValidatingAdmissionPolicy(CEL)가 운영 부담이 가장 낮다.
- 애플리케이션 권한 모델이 principal/action/resource 중심이고 AWS managed service를 쓰고 싶다: Cedar/Amazon Verified Permissions가 맞다.
- Terraform Enterprise/HCP Terraform run workflow를 통제한다: Sentinel을 먼저 본다.
- 기존 enterprise ABAC 표준 제품과 맞춰야 한다: XACML 계열을 검토한다.

## 실전 베스트 프랙티스

1. `default allow := false`를 기본으로 둔다. 정책 누락이 허용으로 떨어지면 장애보다 보안 사고가 먼저 온다.
2. PEP와 PDP 책임을 분리한다. OPA는 결정만 한다. 실제 차단, HTTP status, admission rejection, fallback은 PEP가 명확히 처리해야 한다.
3. latency budget이 작으면 OPA를 sidecar, host daemon, library, Wasm 등 가까운 위치에 둔다. 중앙 OPA 호출은 운영은 쉽지만 네트워크 hop과 가용성 의존이 생긴다.
4. policy와 data는 Bundle로 배포하고 revision을 남긴다. 운영 장애 분석에서 "어떤 버전 정책이 결정했는가"가 중요하다.
5. 중요한 bundle은 signing/verification을 쓴다. Goldman Sachs OCES 사례처럼 정책 무결성은 regulated 환경에서 핵심 요구사항이 된다.
6. Decision Log를 켜되 민감한 `input`은 mask/erase 규칙으로 제거한다. 로그는 감사 자료이면서 개인정보 유출면이 될 수 있다.
7. `opa test`, `opa check`, `opa fmt`, Regal lint를 CI에 넣는다. 정책도 코드라서 PR 리뷰와 테스트 없이는 금방 깨진다.
8. OPA 1.x에서는 Rego v1 문법을 기준으로 새 정책을 작성한다. legacy Rego는 `--v0-compatible`을 임시 migration 용도로만 둔다.
9. hot path에서 `http.send` 같은 synchronous external lookup에 기대지 않는다. 자주 쓰는 entitlement와 reference data는 비동기 preload/cache로 `data`에 넣는 편이 낫다.
10. Kubernetes admission은 처음부터 `Deny`로 시작하지 말고 audit/warn 단계로 실제 위반량을 본 뒤 차단한다.

## 함정과 안티패턴

- OPA를 붙였는데 PEP가 실패 시 허용한다. 이러면 정책 엔진 장애가 권한 우회가 된다.
- Rego를 "작은 프로그래밍 언어"처럼 쓰며 복잡한 imperative logic을 만든다. Rego는 조건과 데이터 관계를 선언하는 쪽이 읽기 쉽다.
- 모든 조직 데이터를 실시간 API 호출로 조회한다. 느리고, 장애 전파가 쉽고, Wasm target에서는 일부 built-in 제약도 생긴다.
- decision log에 token, password, PII를 그대로 남긴다.
- 중앙 OPA 하나에 모든 트래픽을 몰아넣고 tenant isolation, autoscaling, bundle delivery를 나중에 생각한다.
- Kubernetes 정책만 필요한데 OPA/Gatekeeper를 무조건 고른다. 단순 validation이면 CEL, Kubernetes-native mutation이면 Kyverno가 더 작을 수 있다.
- OPA 0.x 문법 정책을 그대로 1.x 런타임에 올린다. `if`, `contains`, strict check 변화 때문에 migration을 명시해야 한다.

## 빅테크 실전 사례

공개 자료 기준 사례만 정리한다. 세부 내부 아키텍처는 각 회사가 공개한 범위 밖이면 추정하지 않는다.

| 조직 | 공개된 사용 방식 | 배울 점 |
|---|---|---|
| Netflix | 여러 언어와 프레임워크의 microservice access control에 OPA를 사용하고, 수천 인스턴스 cloud infrastructure에서 문맥/원격 데이터를 활용한다고 OPA adopters 문서가 설명한다. | polyglot microservice에서는 app code별 authorization library보다 공통 PDP가 유리하다. |
| Goldman Sachs | OCES(Cloud Entitlements Service)에서 OPA를 policy engine으로 사용한다. GitLab에서 Rego를 작성하고, policy/reference data를 bundle로 만들어 S3에 저장하며, tenant OPA가 pull해 in-memory로 평가한다. | 중앙 authorization service는 bundle delivery, signing, tenant isolation, audit retention을 별도 제품처럼 설계해야 한다. |
| Pinterest | Kafka, Envoy, Jenkins 등 여러 policy use case에 OPA를 쓰며, 공개 adopters 문서 기준 Kafka-OPA integration이 peak에서 cache 없이 약 400K QPS, cache 사용 시 약 8.5M QPS를 처리했다고 한다. | OPA는 "Kubernetes admission 전용"이 아니라 고QPS authorization path에도 쓰인다. 단, caching/data locality 설계가 성능을 좌우한다. |
| Google Cloud | Config Controller, GKE Policy Automation, Config Validator 등 여러 제품/도구에서 Google Cloud product configuration validation에 OPA를 사용한다고 adopters 문서가 밝힌다. | cloud configuration compliance는 runtime request authorization과 같은 엔진으로 모델링할 수 있다. |
| T-Mobile | MagTape에서 Kubernetes cluster fleet의 best practice와 secure configuration을 강제하고, Corporate Delivery Platform CI/CD authorization에도 OPA를 사용한다고 adopters 문서가 설명한다. | fleet-scale platform guardrail은 admission control과 CI/CD policy를 같이 봐야 한다. |
| Cloudflare | production/test workload가 섞인 Kubernetes cluster에서 conflicting Ingress를 막기 위한 validating admission controller로 OPA를 사용한다고 공개 adopters 문서에 올라와 있다. | 단일 위험 조건이라도 cluster 전체 blast radius가 크면 admission policy가 값어치가 있다. |

## 결론

OPA의 가치는 Rego 문법 자체보다 "정책 결정을 어디에 둘 것인가"라는 아키텍처 선택에 있다. 정책이 서비스 코드, gateway 설정, Kubernetes webhook, CI script에 흩어지면 변경과 감사가 어려워진다. OPA는 그 결정을 공통 엔진으로 모으고, 각 시스템은 자신에게 맞는 enforcement point로 남게 만든다.

다만 모든 정책 문제의 기본값은 아니다. Kubernetes simple validation은 CEL이 더 작고, Kubernetes-native mutation과 image verification은 Kyverno가 편하고, application authorization을 Cedar 모델로 설계한다면 Amazon Verified Permissions/Cedar가 더 직접적일 수 있다. OPA는 "여러 도메인의 정책을 같은 언어와 운영 모델로 관리해야 하는가"라는 질문에 yes일 때 가장 강하다.

## 참고자료

- CNCF Project Page: Open Policy Agent (OPA) - https://www.cncf.io/projects/open-policy-agent-opa/
- CNCF Announcement: Cloud Native Computing Foundation Announces Open Policy Agent Graduation - https://www.cncf.io/announcements/2021/02/04/cloud-native-computing-foundation-announces-open-policy-agent-graduation/
- CNCF Blog: CNCF to host Open Policy Agent (OPA) - https://www.cncf.io/blog/2018/03/29/cncf-to-host-open-policy-agent-opa/
- CNCF Blog: Introducing Policy As Code: The Open Policy Agent (OPA) - https://www.cncf.io/blog/2020/08/13/introducing-policy-as-code-the-open-policy-agent-opa/
- CNCF Humans of Cloud Native: Torin Sandall, Co-creator of OPA - https://www.cncf.io/humans-of-cloud-native/torin-sandall-co-creator-of-opa/
- OPA Docs: Philosophy - https://www.openpolicyagent.org/docs/philosophy
- OPA Docs: Policy Language - https://www.openpolicyagent.org/docs/policy-language
- OPA Docs: Bundles - https://www.openpolicyagent.org/docs/management-bundles
- OPA Docs: Decision Logs - https://www.openpolicyagent.org/docs/management-decision-logs
- OPA Docs: Kubernetes Admission Control - https://www.openpolicyagent.org/docs/kubernetes
- OPA Docs: OPA-Envoy Plugin - https://www.openpolicyagent.org/docs/envoy
- OPA Docs: WebAssembly - https://www.openpolicyagent.org/docs/wasm
- OPA Docs: v0 Backwards Compatibility - https://www.openpolicyagent.org/docs/v0-compatibility
- OPA GitHub: v1.0.0 Release - https://github.com/open-policy-agent/opa/releases/tag/v1.0.0
- OPA GitHub: v1.18.2 Release - https://github.com/open-policy-agent/opa/releases/tag/v1.18.2
- OPA GitHub: Adopters - https://github.com/open-policy-agent/opa/blob/main/ADOPTERS.md
- Goldman Sachs Developer Blog: Scaling OPA for OCES - https://developer.gs.com/blog/posts/scaling-opa-for-oces
- Gatekeeper Docs: Introduction - https://open-policy-agent.github.io/gatekeeper/website/docs/
- Kubernetes Docs: Validating Admission Policy - https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/
- Kubernetes Docs: Common Expression Language in Kubernetes - https://kubernetes.io/docs/reference/using-api/cel/
- Kyverno Docs: Quick Start - https://kyverno.io/docs/introduction/quick-start/
- HashiCorp Sentinel Docs: Policy as Code - https://developer.hashicorp.com/sentinel/docs/concepts/policy-as-code
- Cedar Policy Language - https://docs.cedarpolicy.com/
- Amazon Science: Cedar policy language paper - https://www.amazon.science/publications/cedar-a-new-language-for-expressive-fast-safe-and-analyzable-authorization
- OASIS XACML TC FAQ - https://www.oasis-open.org/committees/xacml/faq.php
- Ceri, Gottlob, Tanca: What You Always Wanted to Know About Datalog - https://ora.ox.ac.uk/objects/uuid:e12b804d-d586-4065-aa6f-bcde52d78a21
