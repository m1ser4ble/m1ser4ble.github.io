---
layout: single
title: "AWS CloudTrail 감사 로그 완전 가이드"
date: 2026-05-14 23:26:00 +0900
categories: cloud
excerpt: "AWS CloudTrail은 AWS 계정의 API 호출과 활동을 시간순으로 기록해 감사, 포렌식, 컴플라이언스 대응을 가능하게 하는 클라우드 감사 로그 서비스다."
toc: true
toc_sticky: true
tags: [aws, cloudtrail, auditlogs, compliance, security]
source: "/home/dwkim/dwkim/docs/cloud/cloudtrail-감사로그-완전가이드.md"
---

TL;DR
- AWS CloudTrail은 AWS 계정에서 발생한 API 호출과 활동을 시간순으로 기록해 누가 무엇을 했는지 추적하게 해준다.
- 운영 핵심은 Multi-Region Trail, Log File Integrity Validation, S3 보관 정책, CloudWatch 경보, 비용 제어용 Event Selector 설계다.
- 신규 구축 기준으로는 CloudTrail Lake 제약까지 고려해 Trail, S3, Athena 또는 CloudWatch 중심 아키텍처를 함께 판단해야 한다.

## 1. 개념
AWS CloudTrail은 AWS 계정과 조직에서 발생하는 API 호출과 활동을 감사 로그 형태로 수집하는 서비스다. 핵심 역할은 누가, 언제, 어디서, 어떤 리소스에 어떤 작업을 했는지를 남겨 운영 추적, 보안 포렌식, 규제 대응의 근거를 제공하는 것이다.

## 2. 배경
클라우드 환경이 커질수록 콘솔, CLI, SDK, 자동화 계정이 같은 인프라를 동시에 바꾸기 때문에 변경 주체와 시점을 사후에 증명하는 일이 필수였다. CloudTrail은 이런 통제 공백을 메우기 위해 등장했고, SOX, PCI-DSS, HIPAA, ISO 27001 같은 감사 요구를 충족하는 기본 계층이 됐다.

## 3. 이유
CloudTrail을 제대로 이해하지 못하면 단일 리전만 로깅하거나, 비용이 큰 Data Events를 무분별하게 켜거나, 로그 무결성 검증 없이 저장만 하는 식의 설계 오류가 생긴다. 보안 사고 대응과 규제 준수에서 중요한 것은 로그의 존재만이 아니라 범위, 무결성, 보존, 탐지 체계까지 포함한 운영 설계다.

## 4. 특징
- Management Events, Data Events, Insights, Network Activity Events를 한 체계에서 다룰 수 있다.
- S3 장기 보관, CloudWatch 실시간 경보, Athena 또는 Lake 분석으로 이어지는 운영 흐름을 구성할 수 있다.
- SHA-256 기반 무결성 검증, Organization Trail, Multi-Region Trail 같은 거버넌스 기능을 제공한다.
- CIS Benchmark, NIST, OWASP, 주요 침해 사례와 연결해 실무 보안 기준을 세우기 좋다.

## 5. 상세 내용

# AWS CloudTrail - 클라우드 감사 로그 완전 가이드

> **작성일**: 2026-05-14
> **카테고리**: Cloud / AWS / Security
> **포함 내용**: CloudTrail, Audit Trail, Management Events, Data Events, Insights Events, Network Activity Events, Event History, CloudTrail Lake, Channel, Event Data Store, Organization Trail, Multi-region Trail, Digest File, Log File Integrity Validation, SHA-256, Hash Chain, Schneier-Kelsey, NIST SP 800-92, NIST SP 800-53 AU, SOX, PCI-DSS, HIPAA, ISO 27001, FedRAMP, CIS Benchmark v3.0, AWS CLI 전체 커맨드, Event Selector, Advanced Event Selector, Terraform/CFN/CDK, Capital One 침해, IMDSv2, MITRE ATT&CK T1562.008, Netflix Security Monkey/ConsoleMe/Repokid, Airbnb StreamAlert, Lyft Cartography, Capital One Cloud Custodian, AWS Control Tower, Security Reference Architecture

---

# 1. CloudTrail이란 무엇인가

## 정의

AWS CloudTrail은 AWS 계정에서 발생하는 **모든 API 호출과 활동을 시간 순서대로 기록하는 거버넌스·컴플라이언스·운영 감사 서비스**다. "누가, 언제, 어디서, 무엇을, 어떤 결과로" 수행했는지를 사후 증명할 수 있게 해주는 클라우드 환경의 **블랙박스 레코더**다.

이름의 "Trail"은 IT 보안 표준 용어인 **Audit Trail**에서 직접 차용했다. NIST CSRC는 Audit Trail을 다음과 같이 정의한다.

> "A chronological record that provides documentary evidence of the sequence of activities that have affected at any time a specific operation, procedure, event, or device."

즉 CloudTrail = **Cloud + (Audit) Trail** = 클라우드 환경에서의 감사 추적 기록.

## 핵심 구조

```
┌───────────────────────────────────────────────────────────────────┐
│                    AWS CloudTrail 동작 구조                        │
│                                                                   │
│   ┌──────────┐                                                    │
│   │ Console  │─────┐                                              │
│   │  / CLI   │     │                                              │
│   │  / SDK   │     │     ┌──────────────────────────────────┐    │
│   └──────────┘     │     │     AWS Service Endpoint         │    │
│   ┌──────────┐     │     │  (s3.amazonaws.com, iam, ec2…)   │    │
│   │  Lambda  │─────┼────▶│                                  │    │
│   │  / EC2   │     │     │  ┌────────────────────────────┐  │    │
│   │  / IAM   │     │     │  │ CloudTrail 인터셉트(전수)   │  │    │
│   └──────────┘     │     │  └────────┬───────────────────┘  │    │
│   ┌──────────┐     │     └───────────┼──────────────────────┘    │
│   │ VPC EP   │─────┘                 │                            │
│   │  Caller  │                       ▼                            │
│   └──────────┘            ┌────────────────────────┐              │
│                           │   CloudTrail Event     │              │
│                           │  (JSON, eventTime,     │              │
│                           │   userIdentity, etc.)  │              │
│                           └──────────┬─────────────┘              │
│                                      │                            │
│            ┌─────────────────┬───────┴────────┬─────────────┐    │
│            ▼                 ▼                ▼             ▼    │
│      ┌──────────┐      ┌──────────┐    ┌──────────┐  ┌─────────┐│
│      │  Event   │      │  Trail   │    │  Lake    │  │  CW Logs││
│      │ History  │      │  → S3    │    │  → EDS   │  │  → 알람 ││
│      │ (90일)   │      │  (장기)  │    │  (SQL)   │  │         ││
│      └──────────┘      └──────────┘    └──────────┘  └─────────┘│
│        무료              컴플라이언스    포렌식 분석   실시간 대응 │
└───────────────────────────────────────────────────────────────────┘
```

## 핵심 용어 사전

| 용어 | 정식 명칭 / 어원 | 설명 |
|------|---------------|-----|
| **Trail** | Audit Trail에서 차용 | 어떤 이벤트를 캡처해서 어느 S3 / CloudWatch Logs에 보낼지 정의하는 설정 단위 |
| **Event** | CloudTrail Event | 단일 행동 기록. IAM ID/서비스/주체가 수행한 활동 하나 |
| **Management Event** | Control Plane 작업 | IAM 정책 연결, VPC 생성 같은 관리 작업. 첫 Trail 1 copy 무료 |
| **Data Event** | Data Plane 작업 | S3 `GetObject`/`PutObject`, Lambda `Invoke` 같은 데이터 작업. 항상 유료 |
| **Insights Event** | ML 이상 탐지 | API 호출량/에러율 베이스라인 이탈 자동 탐지 |
| **Network Activity Event** | VPC 엔드포인트 API | VPC 엔드포인트 경유 AWS 서비스 트래픽. 2025-02 GA |
| **Event History** | 콘솔 내장 기능 | Trail 없이 최근 90일 Management Events 무료 조회 |
| **CloudTrail Lake** | 관리형 감사 데이터 레이크 | Apache ORC 컬럼 저장 + SQL 쿼리. 최대 10년 보존 |
| **Channel** | 외부 소스 통로 | AWS 외부(온프레, SaaS) 이벤트를 Lake로 수집. 2023-01 |
| **Event Data Store (EDS)** | Lake 저장소 단위 | 불변(immutable) 컬렉션 |
| **Organization Trail** | 조직 통합 Trail | Organizations 내 전 계정 통합. 2018-11 |
| **Multi-region Trail** | 멀티 리전 Trail | 단일 설정으로 모든 리전 + 글로벌 서비스(IAM/STS/CloudFront) 캡처 |
| **Digest File** | 무결성 다이제스트 파일 | 매 시간 SHA-256 해시 + RSA 서명 메타데이터 |
| **Log File Integrity Validation** | 로그 파일 무결성 검증 | SHA-256 해시 체인 + RSA 디지털 서명으로 변조 탐지 |

## AWS 보안/관찰가능성 서비스 명명 메타포

AWS는 Azure나 GCP의 서술적 이름과 달리, 고유 브랜딩과 메타포 기반 명명을 채택했다.

| 서비스 | 메타포 | 기능 매칭 |
|--------|--------|----------|
| **CloudTrail** | Trail (오솔길/흔적) | Audit Trail에서 차용. 과거 발자국을 남긴다 |
| **CloudWatch** | Watch (감시) | 현재 상태를 실시간으로 주시한다 |
| **GuardDuty** | Guard + Duty (경비 임무) | 군사 메타포. 보초가 순찰하며 위협 탐지 |
| **Security Hub** | Hub (중심축) | 여러 보안 서비스 발견사항의 집결지 |
| **AWS Config** | Config (구성 상태) | 가장 직관적 |
| **Audit Manager** | Audit + Manager | 컴플라이언스 증거 자동 수집 |
| **Amazon Macie** | 고유 명사 (메이스 무기/향신료 추정) | 데이터 프라이버시 보호 |

---

# 2. 탄생 배경 - 왜 만들었는가

## 2013년 이전 AWS의 감사 로그 공백

```
┌──────────────────────────────────────────────────────────┐
│           CloudTrail 출시 이전의 문제                     │
│                                                          │
│  "누가 IAM 정책을 바꿨나요?"        →   알 수 없음        │
│  "어제 누가 RDS를 삭제했죠?"        →   알 수 없음        │
│  "이 EC2를 띄운 사람은?"            →   알 수 없음        │
│  "SOX 감사 증거 좀…"                 →   제출 불가능       │
│                                                          │
│  기존 수단의 한계:                                       │
│    • S3 Server Access Logs   → S3 버킷만                │
│    • ELB Access Logs         → 로드밸런서 HTTP만        │
│    • 수동 IAM 정책 스냅샷    → 변경 시점/주체 특정 불가 │
│    • OS 레벨 로그            → Control plane 추적 불가  │
└──────────────────────────────────────────────────────────┘
```

## 컴플라이언스 압력이 CloudTrail을 끌어냈다

| 규제 | 요구사항 | CloudTrail이 해결한 부분 |
|------|---------|------------------------|
| **SOX Section 404** | 상장기업 재무 시스템 접근 통제 + 감사 증거 | IAM 정책 변경, 루트 사용, 재무 리소스 접근 로깅 |
| **PCI-DSS v2.0 Req 10** | "카드 소지자 데이터 환경 모든 접근 로그/모니터링" | Management/Data Events 자동 캡처 |
| **HIPAA §164.312(b)** | ePHI 시스템 활동 기록/검사 메커니즘 | IAM 사용자별 API 호출 추적 |
| **FedRAMP** | 미국 연방 클라우드 감사 로그 | FedRAMP 승인 AWS 서비스 |
| **GDPR Art. 30** | 개인정보 처리 활동 기록 의무 | 개인정보 리소스 접근/수정 추적 |
| **ISO 27001 A.12.4 / A.8.15** | Event Logging, Log Protection, Admin Logs, Clock Sync | 전 항목 매핑 가능 |

## 출시 컨텍스트 - AWS re:Invent 2013

- **날짜**: 2013-11-13
- **장소**: 라스베이거스 re:Invent 2013 (참석자 8,000명)
- **발표자**: Andy Jassy (당시 AWS CEO, 현 Amazon CEO)
- **시작 서비스 수**: EC2, EBS, VPC, RDS, IAM, STS, Redshift — **7개**
- **시작 리전**: us-east-1, us-west-2 — **2개**
- **가격 정책**: CloudTrail 자체 무료, S3/SNS만 표준 요금 → 채택 장벽 최소화
- **동시 공개**: 백서 *"Security at Scale: Logging in AWS"* (ISO 27001, PCI DSS, FedRAMP 매핑)

## 경쟁 클라우드 대비 2~3년 선도

| 클라우드 | 서비스명 | GA 시점 | 비고 |
|----------|---------|---------|------|
| **AWS** | CloudTrail | **2013-11-13** | 업계 최초 클라우드 네이티브 API 감사 |
| **Azure** | Activity Log (구 Audit Log) | ~2014~2015 | 정확한 GA 미공개. 제어/데이터 플레인 분리 |
| **GCP** | Cloud Audit Logs | 2016 가을 부분 GA → 2017-01-19 beta 확장 | 4가지 타입(Admin/Data Access/System/Policy Denied) |

CloudTrail이 사실상 클라우드 API 감사 로그의 표준을 선도했다.

---

# 3. 학술적·이론적 기반

## NIST SP 800-92 - Computer Security Log Management

CloudTrail이 따르는 로그 관리의 4대 기능 (NIST 공식 정의):

```
┌────────────────────────────────────────────────────────┐
│           NIST SP 800-92 로그 관리 4대 기능             │
│                                                        │
│   ┌──────────────────┐    ┌──────────────────────┐    │
│   │ 1. 파싱/필터링/  │───▶│ 2. 저장/압축/        │    │
│   │    집계          │    │    정규화/무결성 검사│    │
│   └──────────────────┘    └──────────────────────┘    │
│                                       │                │
│                                       ▼                │
│   ┌──────────────────┐    ┌──────────────────────┐    │
│   │ 4. 리포팅        │◀───│ 3. 분석/이벤트       │    │
│   │                  │    │    상관관계          │    │
│   └──────────────────┘    └──────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

## NIST SP 800-53 AU 컨트롤 패밀리 ↔ CloudTrail 매핑

| AU 컨트롤 | 요건 | CloudTrail 대응 |
|----------|------|----------------|
| **AU-2** | 이벤트 로깅 대상 정의 | Management + Data Events 설정 |
| **AU-3** | 감사 레코드 내용 (언제/어디서/누가/무엇) | `eventTime`, `sourceIPAddress`, `userIdentity`, `eventName` |
| **AU-9** | 감사 정보 보호 | Log File Integrity Validation, S3 Object Lock |
| **AU-10** | 부인방지(Non-repudiation) | SHA-256 + RSA 디지털 서명 |
| **AU-11** | 감사 레코드 보존 | CloudTrail Lake 최대 10년 |
| **AU-16** | 조직 간 감사 로깅 | Organization Trails |

## Schneier & Kelsey (1998) - Tamper-Evident Logging의 학술적 뿌리

Bruce Schneier와 John Kelsey가 USENIX Security 1998에서 발표한 *"Cryptographic Support for Secure Logs on Untrusted Machines"*가 CloudTrail Log File Integrity Validation의 이론적 기반이다.

핵심 아이디어 = **Forward Integrity(전방 무결성)** 을 보장하는 해시 체인:

```
┌──────────────────────────────────────────────────────────────────┐
│               Hash Chain Forward Integrity                        │
│                                                                  │
│  Log[1]──────hash(L1)──────▶ Log[2]──────hash(L1+L2)─────▶ Log[3]│
│                  │                          │                    │
│                  │  사전 공유 비밀키        │                    │
│                  │  K1 → K2 (key evolution) │                    │
│                  ▼                          ▼                    │
│            MAC(K1, L1)               MAC(K2, L2)                 │
│                                                                  │
│  공격자가 머신 장악해도:                                         │
│   • K1은 이미 폐기됨 (forward security)                          │
│   • 과거 MAC 위조 불가                                           │
│   • 체인이 끊긴 시점이 명백히 드러남                             │
└──────────────────────────────────────────────────────────────────┘
```

## CloudTrail의 SHA-256 Digest 검증 - Schneier-Kelsey의 실용 구현

```
┌─────────────────────────────────────────────────────────────────────┐
│              CloudTrail Log File Integrity Validation                │
│                                                                     │
│   매 시간:                                                          │
│   ┌─────────────────────────────────────────────────┐               │
│   │ 1. 그 시간대 모든 로그 파일에 SHA-256 해시 생성  │               │
│   └─────────────────────────────────────────────────┘               │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────┐               │
│   │ 2. Digest 파일 생성 (로그 목록 + 각 SHA-256)    │               │
│   └─────────────────────────────────────────────────┘               │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────┐               │
│   │ 3. Digest 파일을 CloudTrail 프라이빗 키로       │               │
│   │    SHA-256 with RSA 디지털 서명                 │               │
│   └─────────────────────────────────────────────────┘               │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────┐               │
│   │ 4. 직전 Digest 서명을 포함 → Hash Chain         │               │
│   └─────────────────────────────────────────────────┘               │
│                                                                     │
│   검증: aws cloudtrail validate-logs                                │
│       체인을 역순 순회하며 각 단계 무결성 확인                      │
│                                                                     │
│   리전마다 별도 키 페어 사용                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## OWASP Logging Cheat Sheet ↔ CloudTrail 매핑

| OWASP 권고 | CloudTrail 구현 필드 |
|-----------|-------------------|
| When | `eventTime` (UTC ISO 8601) |
| Where | `eventSource`, `awsRegion` |
| Who | `userIdentity`, `sourceIPAddress` |
| What | `eventName`, `errorCode`, `requestParameters`, `responseElements` |
| 인증 성공/실패 | `ConsoleLogin` 이벤트 |
| 전송 보안 | HTTPS to S3 |
| 저장 보호 | SSE-KMS + Integrity Validation |
| 변조 감지 | Hash Chain Digest + Object Lock |
| 민감정보 마스킹 | 비밀번호/암호화키 자동 마스킹 |

OWASP Top 10:2025의 **A09 Security Logging and Alerting Failures**는 부적절한 로깅이 침해 사고 탐지·대응 능력을 직접 훼손한다고 강조한다.

## Event Sourcing 패턴과의 개념적 연관성

Martin Fowler의 Event Sourcing이 도메인 로직 패턴이라면, CloudTrail은 인프라 레벨의 같은 철학:

| 개념 | Event Sourcing | CloudTrail |
|------|---------------|-----------|
| 저장 방식 | Append-only event log | 추가 전용, 수정 불가 |
| 불변성 | 이벤트 생성 후 변경 불가 | S3 Object Lock + Digest |
| 재현성 | 이벤트 재생으로 상태 복원 | 과거 상태 재현 |
| 사실 기록 | 변경 불가능한 사실 | `eventID`, `eventTime` 고유 식별 |

CloudTrail Lake가 이 개념을 가장 직접적으로 구현 - 이벤트 데이터를 불변 스토어에 보관하고 SQL로 질의.

---

# 4. 진화 타임라인

```
2013-11-13 ─┬─ re:Invent 2013 발표 (Andy Jassy 키노트)
            │  지원 서비스: 7개 (EC2/EBS/VPC/RDS/IAM/STS/Redshift)
            │  지원 리전: us-east-1, us-west-2
            │
2014    ───┼─ GA 출시. API 버전 2013-11-01
            │
2015-03-05 ─┼─ CloudWatch Logs 통합 (실시간 알람/메트릭 필터)
2015-12-17 ─┼─ Multi-Region Trail (단일 설정으로 전 리전)
            │
2016-11-21 ─┼─ ★ Data Events (S3 Object-Level) [Jeff Barr 발표]
            │  기존 이벤트는 "Management Events"로 재명칭
2016 동시기 ─┼─ SSE-KMS 암호화 + Log File Integrity Validation
            │
2017-08-14 ─┼─ ★ 모든 고객 기본 활성화 + Event History 7일 UI
2017-12-12 ─┼─ Event History 90일 확장
2018-06-14 ─┼─ Event History에서 모든 Management Events 로깅
2018-11-19 ─┼─ ★ Organization Trails (Organizations 통합)
            │
2019-11-20 ─┼─ ★ CloudTrail Insights (API Call Rate 이상 탐지)
            │
2020-11-24 ─┼─ Advanced Event Selectors (eventVersion 1.08)
2021 초    ─┼─ Lambda Data Events 대폭 확장
2021-11-10 ─┼─ Insights ErrorRate 이벤트 추가
            │
2022-01-05 ─┼─ ★★ CloudTrail Lake 출시 (Apache ORC + SQL, 7년 보존)
2022-09-19 ─┼─ Trail Events → Lake 복사 기능
2022-11-07 ─┼─ Lake KMS 암호화 + Organizations 위임 관리자
            │
2023-01-31 ─┼─ Lake 외부 이벤트 소스 통합 (Channel)
2023-11-26 ─┼─ Lake Federation (Glue + Athena Zero-ETL, JOIN 지원)
            │
2024-06-11 ─┼─ Generative AI 자연어 쿼리 (Preview)
2024-09-24 ─┼─ Network Activity Events (Preview) - VPC 엔드포인트
2024-11-12 ─┼─ Lake Query Assistant GA + 결과 자연어 요약
2024-11-21 ─┼─ Lake 커스텀 대시보드 + Highlights
            │
2025-02-13 ─┼─ ★ Network Activity Events GA
2025-05-29 ─┼─ 리소스 태그 + IAM 글로벌 조건 키로 이벤트 보강
2025-11    ─┼─ Insights for Data Events
            │
2026-03-31 ─┴─ ⚠️ CloudTrail Lake 신규 고객 수용 종료 공지
               (2026-05-31 적용, 기존 고객은 계속 사용 가능)
               AWS 권고: Amazon CloudWatch로 마이그레이션
```

> **⚠️ 2026-05-31 중요 변경**: AWS CloudTrail Lake는 2026-05-31부터 신규 고객에게 제공되지 않는다. 기존 고객은 계속 사용 가능하나 신규 기능 개발 중단, 보안/버그 수정만 지원. **AWS는 Amazon CloudWatch로의 마이그레이션을 공식 권고**.

---

# 5. AWS CLI 커맨드 완전 사전

`aws cloudtrail`의 모든 주요 서브커맨드를 의미와 함께 정리. **이 섹션이 이 문서의 핵심**이다.

## 5-1. 개념 선행 정리

커맨드를 이해하려면 다음 4개 개념이 먼저 잡혀야 한다:

- **Trail** = "어떤 이벤트를 캡처해서 어디(S3 / CW Logs)로 보낼지" 정의하는 설정 단위. **삭제해도 S3 버킷은 남는다.**
- **Event Data Store (EDS)** = CloudTrail Lake의 저장소 단위. Trail 없이 직접 SQL 쿼리 가능.
- **Event Selector** = Trail이 캡처할 이벤트의 필터 규칙.
- **Insight Selector** = ML 이상 탐지를 활성화할 메트릭 종류.

## 5-2. Trail 관리 커맨드

### `create-trail` — 새 Trail 생성

```bash
# 최소 구성 (단일 리전 - 권장하지 않음!)
aws cloudtrail create-trail \
  --name my-trail \
  --s3-bucket-name my-cloudtrail-logs-bucket

# 프로덕션 권장 (Multi-region + 무결성 + KMS + CW Logs)
aws cloudtrail create-trail \
  --name org-security-trail \
  --s3-bucket-name my-org-cloudtrail-logs \
  --is-multi-region-trail \
  --enable-log-file-validation \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/EXAMPLE-1234 \
  --cloud-watch-logs-log-group-arn arn:aws:logs:us-east-1:123456789012:log-group:CloudTrail/Logs:* \
  --cloud-watch-logs-role-arn arn:aws:iam::123456789012:role/CloudTrail_CloudWatchLogs_Role \
  --include-global-service-events \
  --tags-list Key=Environment,Value=Production

# Organizations 전체 Trail (마스터/위임 어드민에서만)
aws cloudtrail create-trail \
  --name org-wide-trail \
  --s3-bucket-name org-log-archive-bucket \
  --is-multi-region-trail \
  --is-organization-trail \
  --enable-log-file-validation
```

**옵션별 의미:**

| 옵션 | 의미 |
|------|------|
| `--is-multi-region-trail` | 모든 리전 이벤트 캡처. **CLI는 기본 단일 리전이므로 명시 필수** |
| `--is-organization-trail` | Organizations 전체 어카운트 캡처 (마스터/위임 어드민 전용) |
| `--enable-log-file-validation` | 매 시간 SHA-256 다이제스트 파일 생성. **변조 탐지의 필수 옵션** |
| `--kms-key-id` | S3 SSE에 CMK 사용 (기본은 SSE-S3 AES-256) |
| `--cloud-watch-logs-log-group-arn` | CW Logs 전송 - Metric Filter/Alarm에 필수 |
| `--include-global-service-events` | IAM/STS/CloudFront 글로벌 이벤트 포함 (기본 true) |

**⚠️ 함정**: CLI로 `create-trail` 시 `--is-multi-region-trail`을 빼면 **단일 리전** Trail이 생성된다. 콘솔과 기본값이 다르다.

### `update-trail` / `delete-trail` / `start-logging` / `stop-logging`

```bash
# 단일 → Multi-region 전환 (가장 자주 쓰는 update)
aws cloudtrail update-trail --name my-trail --is-multi-region-trail

# Multi-region → 단일 (권장 안 함)
aws cloudtrail update-trail --name my-trail --no-is-multi-region-trail

# KMS 암호화 활성화/제거
aws cloudtrail update-trail --name my-trail --kms-key-id arn:aws:kms:...
aws cloudtrail update-trail --name my-trail --kms-key-id ""

# 로깅 시작/중단
aws cloudtrail start-logging --name my-trail
aws cloudtrail stop-logging  --name my-trail   # ⚠️ 공격자가 첫 번째로 호출하는 커맨드

# 삭제 (Trail 설정만. S3 버킷/CW Logs 그룹은 남음)
aws cloudtrail delete-trail --name my-trail
```

**⚠️ `stop-logging` 함정**: 권한이 광범위하면 공격자가 자격증명 탈취 후 즉시 호출해 흔적 차단. **SCPs로 차단 + CloudWatch Alarm으로 탐지 필수**. GuardDuty는 `IAMUser/CloudTrailLoggingDisabled` finding으로 자동 탐지.

### `describe-trails` / `get-trail` / `get-trail-status` / `list-trails`

```bash
# 현재 리전 Trail 목록 (다른 리전 홈 Trail의 그림자 포함)
aws cloudtrail describe-trails

# 현재 리전 홈 Trail만
aws cloudtrail describe-trails --no-include-shadow-trails

# 단일 Trail 상세 설정 (JSON)
aws cloudtrail get-trail --name my-trail

# Trail 작동 상태 (보안 감사 필수 커맨드)
aws cloudtrail get-trail-status --name my-trail --region ap-northeast-2
# → "IsLogging": false 이면 즉시 조사 대상
# → "LatestDeliveryError" 가 있으면 S3 버킷 정책 문제 가능성
# → "LatestDigestDeliveryTime" 으로 무결성 다이제스트 정상 작동 확인

# 모든 리전의 Trail 간단 목록
aws cloudtrail list-trails
```

## 5-3. 이벤트 조회 - `lookup-events` (Event History 쿼리)

90일 무료 Event History를 CLI로 조회. **포렌식 1차 도구**.

```bash
# 콘솔 로그인 이벤트
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=ConsoleLogin

# 특정 IAM 사용자 행위
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=alice

# 특정 액세스 키 행위 (침해 조사 핵심)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAIOSFODNN7EXAMPLE

# 시간 범위 + 쓰기 이벤트만
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ReadOnly,AttributeValue=false \
  --start-time 2026-01-01T00:00:00Z \
  --end-time   2026-01-31T23:59:59Z

# Insights 이벤트 조회
aws cloudtrail lookup-events --event-category insight
```

**유효한 `AttributeKey`**: `AccessKeyId`, `EventId`, `EventName`, `EventSource`, `ReadOnly`, `ResourceName`, `ResourceType`, `Username`

**⚠️ 한계**: `AttributeKey`는 한 번에 **하나만** 지정 가능. 복합 조건은 Lake SQL로.

## 5-4. Event Selector / Insight Selector

### `put-event-selectors` - Data Events 활성화 (가장 자주 묻는 커맨드)

**Basic vs Advanced Event Selectors 비교:**

| 구분 | Basic | Advanced |
|------|-------|----------|
| 지원 리소스 | S3/Lambda/DDB만 | 모든 리소스 (S3/Lambda/DDB/SNS/SQS/Bedrock/ECS 등 100+) |
| 최대 개수 | Trail당 5개, 리소스 250개 | 조건 총합 500개 |
| 세밀도 | 낮음 (ReadWriteType만) | 높음 (eventName, errorCode, userIdentity 등) |
| Network Activity Events | ❌ | ✅ |
| 권장 | 레거시 | ✅ |

**Advanced Event Selector 권장 패턴:**

```bash
# 관리 이벤트 + KMS 제외 (고비용 절감)
aws cloudtrail put-event-selectors \
  --trail-name my-trail \
  --advanced-event-selectors '[
    {
      "Name": "Management events except KMS",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["Management"]},
        {"Field": "eventSource", "NotEquals": ["kms.amazonaws.com"]}
      ]
    }
  ]'

# 특정 S3 버킷 쓰기 이벤트만 (비용 폭탄 방지)
aws cloudtrail put-event-selectors \
  --trail-name my-trail \
  --advanced-event-selectors '[
    {
      "Name": "Critical S3 writes only",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["Data"]},
        {"Field": "resources.type", "Equals": ["AWS::S3::Object"]},
        {"Field": "resources.ARN", "StartsWith": ["arn:aws:s3:::my-prod-bucket/"]},
        {"Field": "readOnly", "Equals": ["false"]}
      ]
    }
  ]'

# Network Activity Events (VPC 엔드포인트 거부 이벤트)
aws cloudtrail put-event-selectors \
  --trail-name my-trail \
  --advanced-event-selectors '[
    {
      "Name": "VPC endpoint denied",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["NetworkActivity"]},
        {"Field": "errorCode", "Equals": ["VpceAccessDenied"]}
      ]
    }
  ]'
```

**Advanced Event Selectors `Field` 값:** `eventCategory`, `eventSource`, `eventName`, `resources.type`, `resources.ARN`, `readOnly`, `errorCode`, `userIdentity.arn`

### `put-insight-selectors` - ML 이상 탐지 활성화

```bash
# 양쪽 모두 활성화 (권장)
aws cloudtrail put-insight-selectors \
  --trail-name my-trail \
  --insight-selectors '[
    {"InsightType": "ApiCallRateInsight"},
    {"InsightType": "ApiErrorRateInsight"}
  ]'

# 비활성화
aws cloudtrail put-insight-selectors --trail-name my-trail --insight-selectors '[]'
```

| Insight 타입 | 탐지 내용 | 비용 |
|-------------|---------|------|
| `ApiCallRateInsight` | 쓰기 Management API 호출량 비정상 급증/감소 | $0.35 / 100K 이벤트 |
| `ApiErrorRateInsight` | 관리 API 에러율 비정상 (권한 오류, 한도 초과 등) | $0.03 / 100K 이벤트 |

활성화 후 약 **36시간** 베이스라인 학습.

## 5-5. CloudTrail Lake (Event Data Store) 커맨드

```bash
# 1. EDS 생성 (7년 보존, 종료 보호 활성)
aws cloudtrail create-event-data-store \
  --name production-eds \
  --retention-period 2557 \
  --billing-mode EXTENDABLE_RETENTION_PRICING \
  --termination-protection-enabled \
  --advanced-event-selectors '[
    {
      "Name": "Management events",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["Management"]}
      ]
    }
  ]'

# Billing 모드:
#   EXTENDABLE_RETENTION_PRICING  → 최대 10년, 25TB 미만 권장
#   FIXED_RETENTION_PRICING       → 7년 고정, 25TB 이상 대용량 권장

# 2. SQL 쿼리 실행
aws cloudtrail start-query \
  --query-statement "SELECT eventID, eventTime, eventName, userIdentity.arn
                     FROM EDS_ID
                     WHERE eventTime >= timestamp '2026-01-01 00:00:00'
                     LIMIT 100"

# 결과를 S3로 전달
aws cloudtrail start-query \
  --query-statement "SELECT * FROM EDS_ID WHERE eventName = 'ConsoleLogin' LIMIT 100" \
  --delivery-s3-uri "s3://my-query-results/cloudtrail-lake/"

# 3. 자연어 → SQL (2024-11 GA)
aws cloudtrail generate-query \
  --event-data-stores arn:aws:cloudtrail:us-east-1:123456789012:eventdatastore/EXAMPLE \
  --prompt "지난 7일간 콘솔 로그인 실패 이벤트"

# 4. 쿼리 상태 / 결과 / 취소
aws cloudtrail describe-query    --query-id EXAMPLE-uuid
aws cloudtrail get-query-results --query-id EXAMPLE-uuid
aws cloudtrail cancel-query      --query-id EXAMPLE-uuid

# 5. Lake ↔ Athena 연동
aws cloudtrail enable-federation \
  --event-data-store arn:aws:cloudtrail:us-east-1:...:eventdatastore/EXAMPLE \
  --federation-role-arn arn:aws:iam::...:role/CloudTrailLakeFederationRole
```

**Lake SQL 유용 쿼리 모음:**

```sql
-- Root 계정 사용 탐지
SELECT eventTime, eventName, sourceIPAddress, userAgent
FROM EDS_ID
WHERE userIdentity.type = 'Root'
  AND eventTime >= timestamp '2026-01-01 00:00:00'
ORDER BY eventTime DESC;

-- 콘솔 로그인 실패
SELECT eventTime, userIdentity.arn, sourceIPAddress, errorMessage
FROM EDS_ID
WHERE eventName = 'ConsoleLogin' AND errorMessage IS NOT NULL;

-- 특정 IAM 사용자 행위 전수 추적
SELECT eventTime, eventName, eventSource, sourceIPAddress, errorCode
FROM EDS_ID
WHERE userIdentity.arn LIKE '%alice%'
ORDER BY eventTime DESC;

-- 다중 EDS JOIN (Lake Federation 활용)
SELECT a.eventTime, a.eventName, b.eventName AS related_event
FROM EDS_ID_1 a
JOIN EDS_ID_2 b ON a.userIdentity.arn = b.userIdentity.arn
LIMIT 50;
```

**⚠️ 비용 함정**: `SELECT * FROM EDS_ID` 같은 무제한 쿼리는 전체 스캔. **반드시 `eventTime` 범위 지정**.

## 5-6. 무결성 검증 - `validate-logs`

```bash
# 기본 검증 (오류만 출력)
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:us-east-1:123456789012:trail/my-trail \
  --start-time 2026-01-01T00:00:00Z \
  --end-time   2026-01-31T23:59:59Z

# 상세 출력
aws cloudtrail validate-logs ... --verbose

# Organizations 멤버 어카운트 검증
aws cloudtrail validate-logs ... --account-id 999999999999
```

**출력 의미:**

```
22/23 digest files valid, 1/23 digest files INVALID  ← 즉시 조사 필요
63/63 log files valid
```

**INVALID 메시지 종류:**
- `signature verification failed` → 다이제스트 서명 위조 의심
- `has been moved` → 파일 위치 이동됨
- `not found` → 파일 삭제됨
- `hash value doesn't match` → **로그 내용 변조**

**⚠️ 최대 함정**: `--enable-log-file-validation` 옵션 활성화는 **다이제스트를 생성**할 뿐. 실제 변조 탐지는 `validate-logs`를 주기적으로 실행해야만 가능. Lambda/cron으로 자동화 필수.

## 5-7. Trail → Lake 마이그레이션 - `start-import`

```bash
# 1. import 전용 EDS 생성 (미래 이벤트 수집 X)
aws cloudtrail create-event-data-store \
  --name import-eds --retention-period 120 --no-start-ingestion

# 2. S3에 있는 기존 Trail 로그를 EDS로 import
aws cloudtrail start-import \
  --destinations '["arn:aws:cloudtrail:us-east-1:...:eventdatastore/EXAMPLE"]' \
  --start-event-time 2023-08-11T00:00:00Z \
  --end-event-time   2023-11-09T23:59:59Z \
  --import-source '{"S3": {
    "S3LocationUri": "s3://my-ct-logs/AWSLogs/123456789012/CloudTrail/",
    "S3BucketRegion": "us-east-1",
    "S3BucketAccessRoleArn": "arn:aws:iam::...:role/CloudTrailLakeImportRole"
  }}'

# 3. 상태 / 실패 항목 / 재시도
aws cloudtrail get-import          --import-id <import-id>
aws cloudtrail list-import-failures --import-id <import-id>
aws cloudtrail start-import        --import-id <import-id>  # 재시도
```

**⚠️ 압축 해제 비율 주의**: S3의 CT 로그는 gzip. import 시 압축 해제되어 **EDS 용량은 S3의 약 10배**.

---

# 6. 베스트 프랙티스 - CIS Benchmark v3.0 기반

## 6-1. 핵심 10대 베스트 프랙티스

| # | 항목 | 핵심 |
|---|------|------|
| 1 | **Multi-Region Trail 필수** | 단일 리전 Trail은 다른 리전 이벤트 100% 누락 |
| 2 | **Log File Integrity Validation 활성화** | SHA-256 다이제스트로 변조 탐지 |
| 3 | **S3 버킷 정책에 `aws:SourceArn` 조건** | confused deputy 방지 |
| 4 | **S3 Object Lock (WORM) 적용** | 어드민 권한으로도 보존 기간 내 삭제 불가 |
| 5 | **별도 Log Archive 어카운트로 전달** | Control Tower 패턴. 양쪽 어카운트 장악해야 삭제 가능 |
| 6 | **KMS CMK 암호화** | 키 접근 제어를 직접 관리. SSE-S3는 AWS 관리 |
| 7 | **Insights Events 활성화** | ML로 비정상 API 호출량/에러율 자동 탐지 |
| 8 | **CloudWatch Logs Metric Filter + Alarm** | CIS Benchmark 14개 알람 |
| 9 | **Lake 보존 기간 + S3 Lifecycle** | 10년/Glacier Deep Archive |
| 10 | **태그 기반 정책 관리** | Compliance, Owner, ManagedBy 등 |

## 6-2. CIS AWS Foundations Benchmark v3.0 CloudTrail 컨트롤

Security Hub가 2024-05에 v3.0 지원 발표. v2.0과 차이:

| v3.0 컨트롤 | 내용 | v2.0 → v3.0 변경 |
|-----------|------|----------------|
| **3.1** | Multi-region Trail + read+write management events | 유지 |
| **3.2** | KMS 저장 시 암호화 | 유지 |
| **3.3** | Log File Validation (v2.0의 3.5에서 번호 이동) | v2.0의 3.3 (S3 공개 차단), 3.4 (CW Logs 통합)는 제거 |

## 6-3. CIS 권장 CloudWatch Alarm 14종 (Metric Filter 패턴)

| CIS | 알람명 | 탐지 내용 | 필터 패턴 |
|-----|--------|---------|---------|
| 3.1 | UnauthorizedAPICalls | 권한 없는 API | `{ ($.errorCode = "*UnauthorizedAccess*") \|\| ($.errorCode = "AccessDenied*") }` |
| 3.2 | NoMFAConsoleSignin | MFA 없는 로그인 | `{ ($.eventName = "ConsoleLogin") && ($.additionalEventData.MFAUsed != "Yes") }` |
| 3.3 | RootAccountUsage | Root 사용 | `{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS }` |
| 3.4 | IAMPolicyChanges | IAM 정책 변경 | Put/Delete/Attach/Detach Policy/RolePolicy/UserPolicy/GroupPolicy |
| 3.5 | **CloudTrailChanges** | **CloudTrail 자체 변경 (★★ 최우선)** | Create/Update/Delete/Start/Stop Trail/Logging |
| 3.6 | ConsoleSignInFailures | 로그인 실패 | `{ ($.eventName = "ConsoleLogin") && ($.errorMessage = "Failed authentication") }` |
| 3.7 | DisableOrDeleteCMK | KMS 키 비활성화/삭제 | `kms:DisableKey` / `kms:ScheduleKeyDeletion` |
| 3.8 | S3BucketPolicyChanges | S3 정책 변경 | PutBucketAcl/Policy/Cors/Lifecycle/Replication |
| 3.9 | AWSConfigChanges | Config 변경 | StopConfigurationRecorder/DeleteDeliveryChannel |
| 3.10 | SecurityGroupChanges | SG 변경 | Authorize/Revoke/Create/DeleteSecurityGroup |
| 3.11 | NetworkACLChanges | NACL 변경 | CreateNetworkAcl/Entry, DeleteNetworkAcl/Entry, ReplaceNetworkAcl |
| 3.12 | NetworkGatewayChanges | IGW/CGW 변경 | Create/Delete/Attach/Detach InternetGateway/CustomerGateway |
| 3.13 | RouteTableChanges | RT 변경 | CreateRoute, DeleteRoute, ReplaceRoute |
| 3.14 | VPCChanges | VPC 변경 | Create/Delete/Modify VPC, VpcPeering, ClassicLink |

**예시 - Root 사용 알람 (CIS 3.3):**

```bash
aws logs put-metric-filter \
  --log-group-name CloudTrail/SecurityLogs \
  --filter-name RootAccountUsage \
  --filter-pattern '{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != "AwsServiceEvent" }' \
  --metric-transformations MetricName=RootAccountUsageCount,MetricNamespace=CloudTrailMetrics,MetricValue=1

aws cloudwatch put-metric-alarm \
  --alarm-name "RootAccountUsage" \
  --metric-name RootAccountUsageCount --namespace CloudTrailMetrics \
  --statistic Sum --period 300 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:security-alerts-topic \
  --treat-missing-data notBreaching
```

오픈소스 Terraform 모듈로 자동화: `cloudposse/terraform-aws-cloudtrail-cloudwatch-alarms`, `trussworks/terraform-aws-cloudtrail-alarms`

## 6-4. S3 버킷 정책 - confused deputy 방지

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": {"Service": "cloudtrail.amazonaws.com"},
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-cloudtrail-logs/AWSLogs/123456789012/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control",
          "aws:SourceArn": "arn:aws:cloudtrail:us-east-1:123456789012:trail/my-trail"
        }
      }
    }
  ]
}
```

`aws:SourceArn` 없이 두면 **다른 어카운트의 CloudTrail이 같은 버킷에 쓸 수 있는** confused deputy 문제.

## 6-5. SCP로 멤버 어카운트의 CloudTrail 비활성화 차단

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyCloudTrailDisable",
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging",
      "cloudtrail:DeleteTrail",
      "cloudtrail:UpdateTrail"
    ],
    "Resource": "*",
    "Condition": {
      "ArnNotLike": {
        "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlassRole"
      }
    }
  }]
}
```

---

# 7. 함정과 안티패턴 10선

| # | 함정 | 결과 | 해결 |
|---|------|------|------|
| 1 | **단일 리전 Trail만 설정** | 다른 리전 공격 100% 미탐지 (CLI 기본값) | `update-trail --is-multi-region-trail` |
| 2 | **모든 S3 버킷에 Data Events 활성화** | 비용 폭탄 (1일 1억 GetObject = 일 $100, 월 $3,000+) | Advanced Event Selectors로 특정 버킷/Write만 |
| 3 | **Log File Validation 미활성화** | 변조 탐지 불가능 | `update-trail --enable-log-file-validation` |
| 4 | **Trail S3 버킷이 같은 어카운트** | 어카운트 장악 시 로그도 삭제됨 | 별도 Log Archive 어카운트 + Object Lock |
| 5 | **`stop-logging` 권한 광범위** | 자격증명 탈취 시 흔적 즉시 차단 | SCP로 차단 + GuardDuty + CW Alarm |
| 6 | **Digest 파일을 검증 안 함** | 활성화만 하고 변조 탐지 못 함 | `validate-logs` 자동화 (Lambda/cron) |
| 7 | **Insights 미활성화** | IAM 열거 같은 이상 행위 자동 탐지 못함 | `put-insight-selectors` 둘 다 활성화 |
| 8 | **글로벌 서비스 이벤트 중복 기록** | 여러 Multi-region Trail이 같은 IAM 이벤트 중복 과금 | 한 Trail만 `--include-global-service-events` |
| 9 | **CloudTrail 정지 알람 없음** | `StopLogging` 후 침묵 | CIS 3.5 알람 필수 |
| 10 | **Lake와 Trail 동시 사용 시 비용 중복** | EDS 수집 별도 과금 | 마이그레이션 후 Trail 종료 또는 목적 명확 분리 |

## 함정 #2 비용 폭탄 실제 시나리오

```
┌─────────────────────────────────────────────────────────────┐
│         Data Events 무분별 활성화의 실제 비용              │
│                                                             │
│   "Values": ["arn:aws:s3:::"]   ← 절대 하지 말 것!         │
│                                                             │
│   하루 GetObject 1억 건 × $0.10 / 100K = $100 / 일         │
│   × 30일 = $3,000 / 월 (단일 버킷만)                       │
│   × 여러 버킷 = $100K+ 청구서                              │
│                                                             │
│   올바른 패턴:                                             │
│   • 특정 버킷만 (resources.ARN StartsWith)                 │
│   • Write 이벤트만 (readOnly = false)                      │
│   • 또는 KMS 같은 고비용 소스 제외                         │
└─────────────────────────────────────────────────────────────┘
```

---

# 8. 대안 비교 및 상황별 최적 선택

## 8-1. AWS 내부 관찰가능성 서비스 비교

| 서비스 | 핵심 질문 | CloudTrail과의 관계 |
|--------|---------|-------------------|
| **CloudTrail** | "누가 무엇을 언제?" | 기준점 |
| CloudWatch Logs | "앱이 무슨 출력을?" | 통합 (CT→CW Logs). **Lake 대체재로 부상** |
| CloudWatch Metrics | "수치 임계치?" | 보완 (CT→Filter→Metric) |
| AWS Config | "리소스 설정이 지금/언제 어떻게 바뀌었나?" | **CT=동작(동사), Config=상태(명사)** |
| GuardDuty | "위협/이상 행동?" | **CT를 입력으로 소비**. CT+VPC Flow+DNS 분석 |
| Security Hub | "전체 보안 현황?" | 간접 (다른 서비스 결과 통합) |
| Audit Manager | "감사 증거 자동?" | **CT를 증거 소스로 사용** (SOC2/PCI/HIPAA/ISO 27001) |
| X-Ray | "분산 요청 경로?" | 무관 (APM) |
| VPC Flow Logs | "패킷 어디로?" | 보완 (Network Activity Events와 병행) |
| S3 Server Access Logs | "S3 HTTP 상세?" | Data Events와 중복. **Presigned URL/익명 접근은 Server Access Logs에만** |

**표준 보안 아키텍처**: CloudTrail(누가) + Config(무엇이) + GuardDuty(위협) + Security Hub(통합) + Audit Manager(증거)

## 8-2. 멀티클라우드 대응 비교

| 클라우드 | 서비스 | 특징 |
|---------|--------|------|
| AWS | CloudTrail | Management/Data 통합. 첫 Trail Management 무료, Data 첫 이벤트부터 유료 |
| Azure | Activity Log + Diagnostic Settings | 제어/데이터 플레인 분리. 90일 무료 후 Log Analytics 과금 |
| GCP | Cloud Audit Logs (4타입) | Admin Activity는 항상 무료. Data Access는 기본 비활성화 |

**GCP 4타입:**

| 타입 | CT 매핑 | 비용 |
|------|---------|------|
| Admin Activity | Management Events (Write) | **항상 무료** |
| Data Access | Data Events | 기본 비활성화 (비용 제어 유리) |
| System Event | (대응 없음) | 무료 |
| Policy Denied | SCP 거부 | 무료 |

## 8-3. Lake vs Athena+S3 (⚠️ 2026-05-31 변경 반영)

| 항목 | CloudTrail Lake | Athena + S3 Trail |
|------|----------------|-------------------|
| 신규 가용 | **❌ 2026-05-31부터 신규 차단** | ✅ 계속 지원 |
| 수집 비용 | $0.75/GB (1년) ~ $2.50-0.50/GB (7년) | S3 전달 무료(첫 Trail) + $0.023/GB/월 저장 |
| 쿼리 비용 | $0.005/GB 스캔 (ORC 압축) | $5/TB 스캔 (비압축 JSON) |
| 쿼리 언어 | SQL (단, **JOIN 미지원**) | ANSI SQL (JOIN 포함) |
| 보존 | 최대 10년 | S3 Object Lock + Glacier 무제한 |
| 운영 | 매우 낮음 | 높음 (Glue 카탈로그/파티셔닝) |
| 멀티 소스 | 16개 서드파티 (Azure/GitHub 등) | CloudTrail만 |

**선택 권고**: 신규는 Athena+S3 또는 AWS 권고 **CloudWatch**로. Lake는 기존 고객 유지만.

## 8-4. 시나리오별 최적 선택

| 시나리오 | 최적 선택 | 이유 |
|---------|---------|------|
| 1인 개발자, 최근 API 무료 확인 | Event History | 90일 콘솔 무료, 설정 불필요 |
| 1년+ 컴플라이언스 보존 | Trail→S3+Object Lock+Glacier Deep Archive | $0.00099/GB/월 |
| 멀티 어카운트 통합 | Organization Trail | 자동 커버, 신규 계정 자동 적용 |
| Root 사용 실시간 알람 | CT→CW Logs→Metric Filter→Alarm→SNS | CIS 3.3 |
| 복잡 SQL 포렌식 (기존 Lake 고객) | CloudTrail Lake | SQL (단, JOIN 미지원) |
| 복잡 SQL 포렌식 (신규) | CloudWatch / Athena+S3 | Lake 신규 차단됨 |
| S3 객체 접근 (IAM 주체) | Data Events (S3) | $0.10/100K |
| S3 Presigned URL/익명 접근 | S3 Server Access Logs | CT는 익명 접근 미기록 |
| Lambda 실행 추적 | Data Events (Lambda) + X-Ray | - |
| 이상 행동 자동 탐지 | Insights Events | ML 기반 |
| VPC 엔드포인트 API 추적 | Network Activity Events + VPC Flow Logs | 외부 자격증명 감지 |
| 멀티클라우드 통합 감사 | Datadog Cloud SIEM / Splunk | OCSF 자동 정규화 |
| SOC2/ISO 27001 감사 자동화 | CT + Audit Manager | 증거 자동 수집 |

## 8-5. 비용 모델 한눈에 보기 (2026-05 기준)

```
┌─────────────────────────────────────────────────────────────────┐
│              CloudTrail 비용 - 무료 vs 유료                       │
│                                                                 │
│  ✓ 완전 무료                                                    │
│    • Event History (Trail 없이 90일 조회)                       │
│    • 첫 번째 Trail의 Management Events (리전당)                 │
│                                                                 │
│  $ 유료 (per 100K events 또는 per GB)                           │
│    • Management Events (추가 Trail)   $2.00 / 100K              │
│    • Data Events (첫 이벤트부터)      $0.10 / 100K              │
│    • Network Activity Events           $0.10 / 100K              │
│    • Insights ApiCallRate              $0.35 / 100K              │
│    • Insights ApiErrorRate             $0.03 / 100K              │
│    • Lake 수집 (1년)                   $0.75 / GB                │
│    • Lake 수집 (7년)         $2.50→$0.50 / GB (볼륨 구간별)     │
│    • Lake 쿼리                        $0.005 / GB 스캔           │
│    • CW Logs 전달            $0.25 + 수집 ~$0.50 / GB            │
│    • S3 Standard 저장          $0.023 / GB / 월                  │
│    • S3 Glacier Deep Archive   $0.00099 / GB / 월                │
│    • Athena 쿼리                       $5 / TB 스캔              │
└─────────────────────────────────────────────────────────────────┘
```

**비용 절감 5대 전략**:
1. Organization Trail 사용 (멤버별 Trail 중복 방지)
2. Data Events 범위 제한 (전체 활성화 = 비용 폭탄)
3. S3 수명주기: 90일 후 IA → Glacier 자동 이동
4. Athena 파티션 프로젝션으로 스캔 최소화
5. 신규는 Lake 지양 (2026-05-31 신규 차단)

---

# 9. IaC 코드 스니펫

## 9-1. Terraform

```hcl
resource "aws_kms_key" "cloudtrail" {
  description             = "CloudTrail log encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "cloudtrail" {
  bucket        = "my-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  bucket                  = aws_s3_bucket.cloudtrail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/security-trail"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.cloudtrail.arn
}

resource "aws_cloudtrail" "main" {
  name                          = "security-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  s3_key_prefix                 = "AWSLogs"
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.cloudtrail.arn
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.cloudtrail_cloudwatch.arn

  advanced_event_selector {
    name = "Management events"
    field_selector {
      field  = "eventCategory"
      equals = ["Management"]
    }
  }

  insight_selector { insight_type = "ApiCallRateInsight" }
  insight_selector { insight_type = "ApiErrorRateInsight" }

  tags = {
    Environment = "Production"
    Compliance  = "CIS"
    ManagedBy   = "Terraform"
  }

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}
```

## 9-2. CloudFormation 핵심 스니펫

```yaml
Trail:
  Type: AWS::CloudTrail::Trail
  DependsOn: CloudTrailBucketPolicy
  Properties:
    TrailName: !Ref TrailName
    S3BucketName: !Ref CloudTrailBucket
    IsLogging: true
    IsMultiRegionTrail: true
    IncludeGlobalServiceEvents: true
    EnableLogFileValidation: true
    KMSKeyId: !Ref KMSKeyArn
    CloudWatchLogsLogGroupArn: !Sub '${CloudWatchLogGroup.Arn}:*'
    CloudWatchLogsRoleArn: !GetAtt CloudTrailCloudWatchRole.Arn
    InsightSelectors:
      - InsightType: ApiCallRateInsight
      - InsightType: ApiErrorRateInsight
```

## 9-3. AWS CDK (Python)

```python
trail = cloudtrail.Trail(
    self, "SecurityTrail",
    trail_name="security-trail",
    bucket=trail_bucket,
    include_global_service_events=True,
    is_multi_region_trail=True,
    enable_file_validation=True,
    encryption_key=trail_key,
    send_to_cloud_watch_logs=True,
    cloud_watch_log_group=log_group,
    insight_types=[
        cloudtrail.InsightType.API_CALL_RATE,
        cloudtrail.InsightType.API_ERROR_RATE,
    ],
)
```

---

# 10. 빅테크 실전 사례

## 10-1. Netflix - IAM 최소 권한 자동 수렴

```
┌──────────────────────────────────────────────────────────────────┐
│         Netflix CloudTrail → IAM 최소 권한 자동화 아키텍처        │
│                                                                  │
│   CloudTrail ─▶ S3 ─▶ EventBridge ─▶ SQS ─▶ ConsoleMe(Python)    │
│                                                  │               │
│                                                  ▼               │
│                                            DynamoDB/Redis        │
│                                                  │               │
│                                                  ▼               │
│   Aardvark (Access Advisor) ──┐           Repokid               │
│                               ├──▶ 미사용 권한 자동 제거         │
│   CloudTrail Action 분석 ─────┘                                  │
│                                                                  │
│   결과: 시간이 지남에 따라 IAM 역할이 최소 권한으로 수렴         │
└──────────────────────────────────────────────────────────────────┘
```

**도구 생태계:**
- **Security Monkey** (2014-06, 2019-09 deprecated → AWS Config 권고)
- **Aardvark + Repokid** (2017): IAM Access Advisor + CloudTrail로 미사용 권한 자동 제거
- **ConsoleMe** (2021-04 공개): 멀티어카운트 IAM 중앙 제어 플레인
  1. AccessDenied → naive IAM 정책 자동 제안
  2. IAM 역할 변경 → 실시간 캐시 갱신

핵심 인사이트: AWS IAM Access Advisor는 **서비스 레벨**만(S3 전체, EC2 전체). CloudTrail 연동으로 **Action 단위** 세분화가 가능.

## 10-2. Airbnb - StreamAlert (서버리스 실시간 분석)

```
CloudTrail → S3/Kinesis Streams → Lambda(Classifier) → SQS → Lambda(Rules) → PagerDuty/Slack
```

- 보안팀이 일일 수 TB 로그 스캔
- Python 룰. 내장 룰 예: `cloudtrail_critical_api_calls.py` (root 사용/위험 API)
- Kinesis 자동 스케일링 (MB→TB/hr, 수천→수백만 PPS)
- Terraform 배포 자동화. GitHub: airbnb/streamalert (~2,700 stars)

## 10-3. Lyft - Cartography (그래프 자산 매핑, 현 CNCF)

```
AWS + CT → Cartography(Python) → Neo4j → Cypher 쿼리 → Flyte ETL → Mode/Slack
```

- 30+ 플랫폼(AWS/GCP/Azure/K8s/GitHub/Okta) 자산을 Neo4j 그래프로
- `CloudTrailEvent` 노드 타입, `cloudtrail_management_events_lookback_hours` 파라미터
- 활용: Red Team(공격 경로), Blue Team(보안 개선), 자산 리포트
- 예시 Cypher: *"내 민감 데이터 리소스에 R/W 권한 있는 IAM 역할은?"*
- GitHub: cartography-cncf/cartography (~3,000+ stars)

## 10-4. Capital One - Cloud Custodian (Policy-as-Code, 현 CNCF)

```
CloudTrail → EventBridge → Lambda(Cloud Custodian) → 자동 교정 (태깅/격리/알림)
```

- 2016-04 오픈소스, 2022-09 CNCF Incubating
- YAML DSL 정책. 예: *"암호화되지 않은 S3 버킷 생성 시 즉시 알림+태그"*
- CT mode: 각 정책이 독립 Lambda. 이벤트 → 리소스 상태 재구성 → 필터 → 액션
- 추가: **Trail Creator** (CT에서 생성자 소급 태깅), **TrailDB** (인덱싱+시계열 대시보드)
- GitHub: cloud-custodian/cloud-custodian (~5,500+ stars)

## 10-5. AWS 자체 - Security Reference Architecture (SRA)

```
┌──────────────────────────────────────────────────────────────────┐
│           AWS SRA - 멀티어카운트 CloudTrail 아키텍처              │
│                                                                  │
│   ┌─────────────────────┐                                        │
│   │ Management Account  │                                        │
│   │ Organization Trail  │──┐                                     │
│   └─────────────────────┘  │                                     │
│                            │                                     │
│   ┌─────────────────────┐  │   ┌─────────────────────────────┐   │
│   │  Member Account 1   │──┼──▶│  Log Archive Account         │  │
│   │  Member Account 2   │──┤   │  - 중앙 S3 (Object Lock)     │  │
│   │  Member Account N   │──┘   │  - aws-controltower-logs-..  │  │
│   └─────────────────────┘      └─────────────────────────────┘   │
│                                                                  │
│   Security Tooling Account (위임된 어드민)                       │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ GuardDuty, Security Hub, Detective, Audit Manager        │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Control Tower Landing Zone**: Security OU 내 Log Archive + Audit 어카운트. 등록 계정에 멀티리전 trail 자동 배포. 버킷명: `aws-controltower-logs-<account-id>-<region>`.

---

# 11. 실제 보안 사고 사례

## 11-1. Capital One 2019 — CloudTrail 로그는 있었으나 탐지 실패

| 항목 | 내용 |
|------|------|
| 공개 | 2019-07-29 |
| 공격자 | Paige Thompson (전 AWS 직원) |
| 기법 | WAF SSRF → **IMDSv1** → IAM 임시 자격증명 탈취 → S3 700+ 버킷 접근 |
| 피해 | 1억 명+, 신용카드 신청서, SSN 14만, 은행계좌 8만, ~30GB |
| CT 역할 | S3 API 호출 **모두 기록됨**. 그러나 **실시간 알람 부재**로 탐지 실패 |
| 사후 포렌식 | Thompson의 S3 list/copy 명령을 CT에서 추적 → 신원 특정 |
| AWS 대응 | **IMDSv2** 출시 (세션 기반, SSRF 차단) |

**교훈**:
- CloudTrail 로그만으로는 부족 → **GuardDuty/SIEM 연동 필수**
- 과도한 IAM 권한이 피해 확대 (Repokid 같은 도구가 중요한 이유)

## 11-2. TeamTNT 2020 — 최초의 AWS 특화 크립토재킹

```
Docker 침해 → ~/.aws/credentials & env 수집 →
IAM/EC2/S3/CloudTrail 설정/CFN 열거 → XMRig Monero 채굴
```

공격자가 **CT 설정을 명시적으로 enumerate** — 탐지 회피 및 환경 파악 목적. 이후 공격 표준 패턴이 됨.

## 11-3. MITRE ATT&CK T1562.008 - Disable or Modify Cloud Logs

공격자가 CloudTrail 비활성화하는 6가지 방법:

| # | 방법 | 탐지 난이도 |
|---|------|----------|
| 1 | `StopLogging` API | 낮음 (탐지 용이) |
| 2 | `DeleteTrail` API | 낮음 |
| 3 | **Event Selectors 변경** | **높음** (특정 이벤트만 비활성화) |
| 4 | S3 Lifecycle 1일 만료 | 중간 (로그 자동 삭제) |
| 5 | SNS 토픽 제거, 멀티리전 비활성화 | 중간 |
| 6 | **Log File Validation 비활성화** | **높음** (변조 후 탐지 불가) |

**탐지**: `StopLogging`/`DeleteTrail`도 CT에 기록 → CW Alarm (단, 이미 stop된 후엔 이후 로그 없음). **사전에 알람을 설정해야 의미 있음**.

시뮬레이션 도구: Stratus Red Team, Atomic Red Team.

---

# 12. 오픈소스 도구 생태계

| 도구 | 출처 | Stars | 핵심 | CT 활용 |
|------|------|-------|------|---------|
| **Prowler** | prowler-cloud | 14,000+ | 클라우드 보안 평가 + 컴플라이언스 | CT 활성화/멀티리전/암호화/검증 수십 체크 |
| **ScoutSuite** | NCC Group | ~7,600 | 멀티클라우드 감사 | Data Events / Global services 체크 |
| **Cloud Custodian** | Capital One → CNCF | ~5,500+ | 정책 자동 집행 | CT 트리거 Lambda |
| **CloudGoat** | Rhino Security Labs | ~3,800 | "Vulnerable by Design" 학습 | detection_evasion 시나리오 |
| **Cartography** | Lyft → CNCF | ~3,000+ | 그래프 자산 매핑 | CloudTrailEvent 노드 |
| **StreamAlert** | Airbnb | ~2,700 | 서버리스 실시간 분석 | CT 1급 데이터 소스 |
| **Pacu** | Rhino Security Labs | ~4,200 | AWS 침투 테스트 | Log manipulation 모듈 |
| Repokid | Netflix | - | IAM 미사용 권한 자동 제거 | CT + Access Advisor 이중 소스 |
| Security Monkey | Netflix (deprecated 2019) | - | AWS Config 권고 | - |

---

# 13. References

## AWS 공식 문서
- [What Is AWS CloudTrail?](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html)
- [CloudTrail Concepts](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html)
- [Document History](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-document-history.html)
- [Compliance Validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/CloudTrail-compliance.html)
- [Security Best Practices in AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [Log File Integrity Validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [Validating with CLI](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-cli.html)
- [Logging Data Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)
- [Advanced Event Selectors](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/filtering-data-events.html)
- [Working with CloudTrail Insights](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-insights-events-with-cloudtrail.html)
- [CloudTrail Lake Event Data Stores](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/query-event-data-store.html)
- [Lake Service Availability Change (2026-05-31)](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake-service-availability-change.html)
- [CloudTrail CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/cloudtrail/)
- [CloudTrail Pricing](https://aws.amazon.com/cloudtrail/pricing/)
- [Managing CloudTrail Trail Costs](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-trail-manage-costs.html)
- [Encryption Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/cloudtrail.html)

## 출시 발표 / 마일스톤
- [Announcing AWS CloudTrail (2013-11-13)](https://aws.amazon.com/about-aws/whats-new/2013/11/13/announcing-aws-cloudtrail/)
- [Data Events S3 (Jeff Barr, 2016-11)](https://aws.amazon.com/blogs/aws/cloudtrail-update-capture-and-process-amazon-s3-object-level-api-activity/)
- [Multi-Region Trail (2015-12)](https://aws.amazon.com/about-aws/whats-new/2015/12/turn-on-cloudtrail-across-all-regions-and-support-for-multiple-trails/)
- [Default Enablement (2017-08)](https://aws.amazon.com/blogs/aws/new-amazon-web-services-extends-cloudtrail-to-all-aws-customers/)
- [Organization Trails (2018-11)](https://aws.amazon.com/about-aws/whats-new/2018/11/aws-cloudtrail-adds-support-for-aws-organizations/)
- [Insights (2019-11)](https://aws.amazon.com/about-aws/whats-new/2019/11/aws-cloudtrail-announces-cloudtrail-insights/)
- [CloudTrail Lake (2022-01)](https://aws.amazon.com/blogs/mt/announcing-aws-cloudtrail-lake-a-managed-audit-and-security-lake/)
- [Lake Federation (2023-11)](https://aws.amazon.com/about-aws/whats-new/2023/11/aws-cloudtrail-lake-zero-etl-anlysis-athena/)
- [Network Activity Events GA (2025-02)](https://aws.amazon.com/blogs/aws/aws-cloudtrail-network-activity-events-for-vpc-endpoints-now-generally-available/)

## 학술 / 표준
- [NIST CSRC — audit trail](https://csrc.nist.gov/glossary/term/audit_trail)
- [NIST SP 800-92 Final](https://csrc.nist.gov/pubs/sp/800/92/final)
- [NIST SP 800-53 Rev.5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [Schneier & Kelsey "Secure Audit Logs" 1998](https://www.schneier.com/wp-content/uploads/2016/02/paper-auditlogs.pdf)
- [Event Sourcing - Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Top 10:2025 A09](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/)

## 컴플라이언스
- [PCI DSS Requirement 10](https://pcidssguide.com/pci-dss-requirement-10/)
- [HIPAA §164.312](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312)
- [ISO 27001 A.12.4](https://info-savvy.com/iso-27001-annex-a-12-4-logging-and-monitoring/)
- [CIS AWS Foundations Benchmark v3.0 - Steampipe 분석](https://steampipe.io/blog/cis-v30-aws-benchmark)
- [Security Hub v3.0 지원 (2024-05)](https://aws.amazon.com/about-aws/whats-new/2024/05/aws-security-hub-3-0-cis-foundations-benchmark/)

## 빅테크 사례
- [Netflix - Security Monkey](http://techblog.netflix.com/2014/06/announcing-security-monkey-aws-security.html)
- [Netflix - Aardvark + Repokid](https://netflixtechblog.com/introducing-aardvark-and-repokid-53b081bf3a7e)
- [Netflix - ConsoleMe CT 통합](https://hawkins.gitbook.io/consoleme/configuration/cloudtrail-integration-via-aws-event-bridge)
- [Airbnb - StreamAlert](https://medium.com/airbnb-engineering/streamalert-real-time-data-analysis-and-alerting-e8619e3e5043)
- [Lyft - Cartography + Flyte](https://eng.lyft.com/powering-security-reports-with-cartography-and-flyte-fd02a4a96b2f)
- [Capital One - Cloud Custodian CNCF](https://www.capitalone.com/tech/cloud/cloud-custodian-cncf-donation/)
- [AWS Security Reference Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/introduction.html)
- [AWS Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/how-control-tower-works.html)

## 보안 사고 분석
- [Appsecco - Capital One SSRF 분석](https://blog.appsecco.com/an-ssrf-privileged-aws-keys-and-the-capital-one-breach-4c3c2cded3af)
- [Huntress - Capital One 케이스](https://www.huntress.com/threat-library/data-breach/capital-one-data-breach)
- [Imperva 침해 사후 분석](https://www.databreachtoday.com/impervas-breach-post-mortem-api-key-left-exposed-a-13238)
- [Palo Alto Unit42 - TeamTNT](https://unit42.paloaltonetworks.com/teamtnt-operations-cloud-environments/)
- [MITRE ATT&CK T1562.008](https://attack.mitre.org/techniques/T1562/008/)
- [Datadog Security Labs - Stopping CloudTrail](https://securitylabs.datadoghq.com/cloud-security-atlas/attacks/stopping-cloudtrail-trail/)
- [Abstract Security - Disable CT 우회](https://www.abstract.security/blog/how-attackers-disable-cloudtrail-without-calling-stoplogging-or-deletetrail)

## IaC / 오픈소스
- [Terraform aws_cloudtrail](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudtrail)
- [cloudposse/terraform-aws-cloudtrail-cloudwatch-alarms](https://github.com/cloudposse/terraform-aws-cloudtrail-cloudwatch-alarms)
- [trussworks/terraform-aws-cloudtrail-alarms (CIS)](https://github.com/trussworks/terraform-aws-cloudtrail-alarms)
- [prowler-cloud/prowler](https://github.com/prowler-cloud/prowler)
- [nccgroup/ScoutSuite](https://github.com/nccgroup/ScoutSuite)
- [cloud-custodian/cloud-custodian](https://github.com/cloud-custodian/cloud-custodian)
- [cartography-cncf/cartography](https://github.com/cartography-cncf/cartography)
- [airbnb/streamalert](https://github.com/airbnb/streamalert)
- [RhinoSecurityLabs/pacu](https://github.com/RhinoSecurityLabs/pacu)
- [RhinoSecurityLabs/cloudgoat](https://github.com/RhinoSecurityLabs/cloudgoat)
