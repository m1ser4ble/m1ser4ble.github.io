---
layout: single
title: "Presigned URL 메커니즘 완전 가이드"
date: 2026-03-16 23:00:00 +0900
categories: cloud
excerpt: "Presigned URL은 서명된 임시 권한을 URL에 담아 자격증명 노출 없이 S3 객체를 안전하게 직접 업로드·다운로드하게 해준다."
toc: true
toc_sticky: true
tags: [presignedurl, aws, s3, sigv4, security]
source: "/home/dwkim/dwkim/docs/cloud/presigned-url-메커니즘-완전가이드.md"
---
TL;DR
- 이 글은 Presigned URL 메커니즘 완전 가이드의 핵심 개념과 실제 적용 포인트를 빠르게 정리한다.
- 왜 이 패턴/기법이 등장했는지 배경과 도입 이유를 함께 설명한다.
- 실무에서 바로 쓰기 위한 특징과 상세 내용을 원문 기반으로 정리한다.

## 1. 개념
Presigned URL 메커니즘 완전 가이드의 정의와 핵심 원리를 먼저 이해하면 뒤의 구현 전략을 훨씬 정확하게 판단할 수 있다.

## 2. 배경
기존 방식의 한계와 운영상의 문제를 해결하기 위해 이 접근이 발전했다.

## 3. 이유
확장성, 안정성, 유지보수성, 보안을 함께 높이기 위해 이 설계가 필요하다.

## 4. 특징
핵심 특징은 표준화된 구조, 명확한 책임 분리, 그리고 운영 관점에서의 예측 가능성이다.

## 5. 상세 내용

# Presigned URL 메커니즘 완전 가이드

> **작성일**: 2026-03-16
> **카테고리**: Cloud / AWS / S3 / Security
> **키워드**: Presigned URL, AWS Signature Version 4, HMAC-SHA256, Query String Authentication, Canonical Request, Signing Key, Capability-based Security, CloudFront Signed URL, Azure SAS Token, GCP Signed URL

---

# 1. Presigned URL이란?

## 1.1 핵심 개념: "미리 서명된 URL"

Presigned URL은 **S3 객체에 대한 접근 권한을 URL 자체에 내포시킨 임시 접근 토큰**이다. 서버가 자신의 IAM 자격증명으로 URL에 서명(sign)을 미리(pre) 완료하면, 해당 URL을 받은 클라이언트는 **AWS 자격증명 없이도** S3에 직접 접근할 수 있다.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Presigned URL 동작 흐름                                    │
│                                                             │
│  ┌──────────┐     1. 다운로드 요청     ┌──────────────┐    │
│  │          │ ──────────────────────→ │              │    │
│  │  Client  │                         │  App Server  │    │
│  │ (브라우저)│ ←────────────────────── │  (IAM 키 보유)│    │
│  │          │  2. Presigned URL 반환   │              │    │
│  └────┬─────┘                         └──────────────┘    │
│       │                                                     │
│       │  3. Presigned URL로 직접 요청 (GET)                │
│       │     (Authorization 헤더 불필요!)                    │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────┐                  │
│  │              AWS S3                   │                  │
│  │                                      │                  │
│  │  4. URL 내 서명 검증                 │                  │
│  │  5. 만료 시간 확인                   │                  │
│  │  6. 검증 통과 → 객체 반환            │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  핵심: 서버는 URL만 생성, 실제 데이터 전송은 S3가 직접     │
│  → 서버 대역폭 절약 + IAM 키 미노출                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"Pre-signed"의 의미**: 클라이언트가 URL을 **사용하는 시점 이전에(pre)** 서버가 **서명을 완성(signed)**하여 URL 쿼리 스트링에 내포시킨다. 서명은 완전히 로컬 계산이며, AWS API 호출이 발생하지 않는다.

## 1.2 왜 필요한가?

| 문제 | Presigned URL 해결 방식 |
|------|------------------------|
| **IAM 키 노출 위험** | 클라이언트에게 키를 주지 않고, 서명된 URL만 전달 |
| **서버 대역폭 부담** | 서버가 파일을 중계하지 않음. S3 → 클라이언트 직접 전송 |
| **브라우저 직접 다운로드** | URL 자체에 인증 정보 포함 → `<a href>`, `<img src>` 등에서 바로 사용 |
| **임시 접근 제어** | 만료 시간 설정으로 시간 제한 접근 가능 |
| **업로드 부하 분산** | 클라이언트가 S3에 직접 PUT → 서버 무부하 업로드 |

---

# 2. 서명 메커니즘 상세

## 2.1 Presigned URL의 구조

실제 Presigned URL 예시:

```
https://my-bucket.s3.ap-northeast-2.amazonaws.com/reports/2026/Q1.pdf
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=AKIAIOSFODNN7EXAMPLE/20260316/ap-northeast-2/s3/aws4_request
  &X-Amz-Date=20260316T120000Z
  &X-Amz-Expires=3600
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=a1b2c3d4e5f6...  (64자리 hex)
```

| 파라미터 | 의미 | 예시 값 |
|---------|------|--------|
| `X-Amz-Algorithm` | 서명 알고리즘 | `AWS4-HMAC-SHA256` |
| `X-Amz-Credential` | 자격증명 + 범위 (Access Key / 날짜 / 리전 / 서비스 / 요청 유형) | `AKIA.../20260316/ap-northeast-2/s3/aws4_request` |
| `X-Amz-Date` | 서명 생성 시각 (UTC ISO 8601) | `20260316T120000Z` |
| `X-Amz-Expires` | URL 유효 시간 (초) | `3600` (1시간) |
| `X-Amz-SignedHeaders` | 서명에 포함된 HTTP 헤더 목록 | `host` |
| `X-Amz-Signature` | 최종 서명값 (HMAC-SHA256 결과, hex 인코딩) | `a1b2c3d4e5f6...` |

## 2.2 왜 브라우저에서 그냥 접근 가능한가?

일반적인 AWS API 호출은 HTTP 요청에 `Authorization` 헤더를 추가해야 한다:

```
Authorization: AWS4-HMAC-SHA256
  Credential=AKIAIOSFODNN7EXAMPLE/20260316/ap-northeast-2/s3/aws4_request,
  SignedHeaders=host;x-amz-content-sha256;x-amz-date,
  Signature=a1b2c3d4e5f6...
```

문제: 브라우저의 `<a href>`, `<img src>`, 주소창 직접 입력 등은 **HTTP 헤더를 커스텀할 수 없다**. GET 요청만 보낼 뿐이다.

**Query String Authentication**이 이를 해결한다. `Authorization` 헤더에 들어갈 모든 정보를 **URL 쿼리 파라미터로 옮긴 것**이 Presigned URL이다.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  일반 API 호출 (프로그래밍 필요):                           │
│  ┌───────────────────────────────────────────────┐         │
│  │ GET /reports/Q1.pdf HTTP/1.1                  │         │
│  │ Host: my-bucket.s3.amazonaws.com              │         │
│  │ Authorization: AWS4-HMAC-SHA256 Credential=.. │ ← 헤더 │
│  │ X-Amz-Date: 20260316T120000Z                 │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
│  Presigned URL (브라우저 주소창에서 바로 접근):             │
│  ┌───────────────────────────────────────────────┐         │
│  │ GET /reports/Q1.pdf                           │         │
│  │     ?X-Amz-Algorithm=AWS4-HMAC-SHA256         │ ← URL  │
│  │     &X-Amz-Credential=...                     │         │
│  │     &X-Amz-Signature=...                      │         │
│  │ Host: my-bucket.s3.amazonaws.com              │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
│  인증 정보의 위치만 다를 뿐, 검증 로직은 동일하다          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

S3 서버는 두 방식 모두 동일한 SigV4 검증 로직으로 처리한다.

## 2.3 AWS SigV4 서명 과정 Step-by-Step

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  AWS Signature Version 4 서명 과정 (4단계)                  │
│                                                             │
│  Step 1          Step 2          Step 3          Step 4     │
│  ┌──────┐       ┌──────┐       ┌──────┐       ┌──────┐    │
│  │Canon-│       │String│       │Sign- │       │최종   │    │
│  │ical  │──────→│To    │──────→│ing   │──────→│서명   │    │
│  │Request│      │Sign  │       │Key   │       │생성   │    │
│  └──────┘       └──────┘       └──────┘       └──────┘    │
│                                                             │
│  HTTP 요소를     정규화된         Secret Key     HMAC-SHA256│
│  정규화          요청의 해시를    에서 파생된     (SigningKey,│
│  (표준 형식)     포함한 서명      키 (4단계       StringTo   │
│                  대상 문자열      HMAC 체인)      Sign)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Canonical Request 생성

HTTP 요청의 주요 요소를 **정해진 규칙(canon)대로 정규화**한 문자열이다.

```
CanonicalRequest =
  HTTPMethod        + "\n" +       ← GET
  CanonicalURI      + "\n" +       ← /reports/2026/Q1.pdf (URI 인코딩)
  CanonicalQuery    + "\n" +       ← X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
  CanonicalHeaders  + "\n" +       ← host:my-bucket.s3.ap-northeast-2.amazonaws.com\n
  SignedHeaders     + "\n" +       ← host
  HashedPayload                    ← UNSIGNED-PAYLOAD (Presigned URL의 경우)
```

| 구성 요소 | 정규화 규칙 |
|----------|------------|
| `HTTPMethod` | 대문자 (GET, PUT, DELETE) |
| `CanonicalURI` | URI 경로를 UTF-8 퍼센트 인코딩, 중복 슬래시 정규화 |
| `CanonicalQuery` | 파라미터를 이름순 정렬, 각각 URI 인코딩, `&`로 연결 |
| `CanonicalHeaders` | 소문자 변환, 연속 공백 제거, 이름순 정렬, `\n` 종료 |
| `SignedHeaders` | 서명에 포함된 헤더 이름을 `;`로 연결 |
| `HashedPayload` | 요청 본문의 SHA-256 해시 (Presigned URL은 `UNSIGNED-PAYLOAD`) |

### Step 2: StringToSign 생성

```
StringToSign =
  "AWS4-HMAC-SHA256"                                    + "\n" +  ← 알고리즘
  "20260316T120000Z"                                    + "\n" +  ← 타임스탬프
  "20260316/ap-northeast-2/s3/aws4_request"             + "\n" +  ← Credential Scope
  SHA256(CanonicalRequest)                                        ← Step 1 해시값
```

Credential Scope는 서명의 유효 범위를 **날짜 / 리전 / 서비스 / 요청 유형** 4단위로 제한한다. 같은 서명을 다른 리전이나 다른 서비스에 재사용할 수 없다.

### Step 3: Signing Key 파생 (4단계 HMAC 체인)

Secret Access Key에서 시작하여 4단계 HMAC 연산으로 Signing Key를 파생한다.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Signing Key 파생 과정 (4단계 HMAC 체인)                    │
│                                                             │
│  "AWS4" + SecretAccessKey                                   │
│       │                                                     │
│       ▼  HMAC-SHA256(key, "20260316")                       │
│  ┌──────────┐                                               │
│  │ DateKey  │  ← 날짜로 범위 한정                           │
│  └────┬─────┘                                               │
│       ▼  HMAC-SHA256(DateKey, "ap-northeast-2")             │
│  ┌──────────────┐                                           │
│  │ DateRegionKey│  ← 리전으로 범위 한정                     │
│  └────┬─────────┘                                           │
│       ▼  HMAC-SHA256(DateRegionKey, "s3")                   │
│  ┌─────────────────────┐                                    │
│  │ DateRegionServiceKey│  ← 서비스로 범위 한정              │
│  └────┬────────────────┘                                    │
│       ▼  HMAC-SHA256(DateRegionServiceKey, "aws4_request")  │
│  ┌──────────┐                                               │
│  │SigningKey│  ← 최종 파생 키                                │
│  └──────────┘                                               │
│                                                             │
│  효과: Secret Key가 직접 노출되지 않으며,                   │
│        각 키는 특정 날짜/리전/서비스에만 유효               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: 최종 서명 생성

```
Signature = Hex( HMAC-SHA256( SigningKey, StringToSign ) )
```

결과값은 64자리 16진수 문자열이며, 이것이 `X-Amz-Signature` 파라미터의 값이 된다.

**중요**: Presigned URL 생성은 **완전히 로컬 계산**이다. AWS에 어떤 API 호출도 하지 않는다. HMAC-SHA256 연산만으로 구성되므로 생성 시간은 **1ms 미만**이다.

## 2.4 URL Path 변조가 실패하는 이유

이 섹션이 가장 핵심이다. Presigned URL의 보안은 **서명에 요청의 모든 주요 요소가 바인딩**되어 있다는 점에 근거한다.

### 시나리오 A: Path 변조 → 403 Forbidden

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  원본 URL:  .../reports/2026/Q1.pdf?...&X-Amz-Signature=abc│
│                                                             │
│  공격자 변조: .../secrets/passwords.txt?...&X-Amz-Sig=abc  │
│                     ↑ 경로만 바꿈, 서명은 그대로            │
│                                                             │
│  S3 서버 검증 과정:                                         │
│  1. 변조된 URI로 Canonical Request 재구성                   │
│     CanonicalURI = "/secrets/passwords.txt"                 │
│  2. StringToSign에 SHA256(CanonicalRequest) 포함            │
│  3. Signing Key로 HMAC-SHA256 계산 → 서명값 xyz            │
│  4. URL의 서명 abc ≠ 계산된 서명 xyz                       │
│  5. → 403 SignatureDoesNotMatch                             │
│                                                             │
│  원리: URI가 Canonical Request에 포함되므로,                │
│        경로 1글자만 바뀌어도 서명 전체가 달라진다           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 시나리오 B: 만료 시간 변조 → 403 Forbidden

```
원본: X-Amz-Expires=3600  (1시간)
변조: X-Amz-Expires=604800 (7일로 연장)

→ X-Amz-Expires는 Canonical Query String에 포함
→ 값이 바뀌면 Canonical Request 해시 변경
→ 서명 불일치 → 403
```

### 시나리오 C: HTTP 메서드 변경 → 403 Forbidden

```
원본: GET 용으로 서명된 URL
변조: PUT 요청으로 사용 시도

→ HTTPMethod가 Canonical Request의 첫 줄
→ GET ≠ PUT → 서명 불일치 → 403
```

### 시나리오 D: 다른 호스트(버킷)로 재사용 → 403 Forbidden

```
원본: Host: my-bucket.s3.amazonaws.com
변조: Host: other-bucket.s3.amazonaws.com

→ host 헤더가 Canonical Headers에 포함
→ 호스트명 변경 → 서명 불일치 → 403
```

### 변조 방지 요약

| 변조 대상 | 서명에 바인딩된 위치 | 결과 |
|----------|---------------------|------|
| URI 경로 | CanonicalURI | 403 |
| 쿼리 파라미터 | CanonicalQueryString | 403 |
| HTTP 메서드 | HTTPMethod (Canonical Request 1행) | 403 |
| Host 헤더 | CanonicalHeaders | 403 |
| 만료 시간 | CanonicalQueryString 내 X-Amz-Expires | 403 |
| 서명 자체 위조 | Secret Access Key 없이 유효한 서명 계산 불가 | 403 |

## 2.5 S3 서버 측 검증 프로세스

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  S3 서버: Presigned URL 수신 시 검증 플로우                 │
│                                                             │
│  요청 수신                                                  │
│      │                                                      │
│      ▼                                                      │
│  ┌────────────────────────┐                                 │
│  │ 1. URL 파라미터 파싱    │                                 │
│  │    X-Amz-Credential    │                                 │
│  │    X-Amz-Date          │                                 │
│  │    X-Amz-Expires       │                                 │
│  │    X-Amz-Signature     │                                 │
│  └──────────┬─────────────┘                                 │
│             ▼                                                │
│  ┌────────────────────────┐    No                           │
│  │ 2. 만료 확인            │──────→ 403 AccessDenied        │
│  │ now > Date + Expires?  │        (Request has expired)    │
│  └──────────┬─────────────┘                                 │
│             │ Yes (유효)                                     │
│             ▼                                                │
│  ┌────────────────────────┐    No                           │
│  │ 3. 시계 오차 확인       │──────→ 403 RequestTimeToo      │
│  │ |now - Date| < 15분?   │        Skewed                   │
│  └──────────┬─────────────┘                                 │
│             │ Yes                                            │
│             ▼                                                │
│  ┌────────────────────────┐    No                           │
│  │ 4. Access Key 유효성    │──────→ 403 InvalidAccessKey    │
│  │ Credential의 키 확인   │                                 │
│  └──────────┬─────────────┘                                 │
│             │ Yes                                            │
│             ▼                                                │
│  ┌────────────────────────┐                                 │
│  │ 5. 서명 재계산          │                                 │
│  │ 수신된 요청으로        │                                 │
│  │ Canonical Request 구성 │                                 │
│  │ → StringToSign 생성    │                                 │
│  │ → Signing Key 파생     │                                 │
│  │ → HMAC-SHA256 계산     │                                 │
│  └──────────┬─────────────┘                                 │
│             ▼                                                │
│  ┌────────────────────────┐    No                           │
│  │ 6. 서명 비교            │──────→ 403 Signature           │
│  │ 계산값 == URL 서명?    │        DoesNotMatch            │
│  └──────────┬─────────────┘                                 │
│             │ Yes                                            │
│             ▼                                                │
│  ┌────────────────────────┐    No                           │
│  │ 7. IAM 권한 확인        │──────→ 403 AccessDenied        │
│  │ 서명자가 해당 객체에   │                                 │
│  │ 요청된 작업 권한 있는가│                                 │
│  └──────────┬─────────────┘                                 │
│             │ Yes                                            │
│             ▼                                                │
│        200 OK + 객체 반환                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**핵심**: S3 서버는 URL의 서명을 "신뢰"하지 않는다. 수신된 요청의 모든 요소로 서명을 **처음부터 다시 계산**하여 URL에 포함된 서명과 비교한다. Secret Access Key는 서버(S3)와 서명자(앱 서버) 모두 알고 있으므로 동일한 계산 결과가 나와야 한다.

## 2.6 만료 메커니즘

만료 시간은 `X-Amz-Date` + `X-Amz-Expires` 조합으로 결정된다.

```
만료 시점 = X-Amz-Date + X-Amz-Expires

예시: X-Amz-Date=20260316T120000Z, X-Amz-Expires=3600
→ 만료 시점 = 2026-03-16 13:00:00 UTC
```

### 자격증명 유형별 최대 유효기간

| 자격증명 유형 | 최대 X-Amz-Expires | 이유 |
|-------------|-------------------|------|
| IAM User (장기 키) | **604,800초 (7일)** | 키 자체에 만료가 없으므로 AWS가 상한 설정 |
| STS 임시 자격증명 | **세션 토큰 만료까지** | 토큰이 먼저 만료되면 URL도 무효 |
| EC2 Instance Role | **~6시간** | 인스턴스 역할 토큰이 보통 6시간 |
| Lambda 실행 역할 | **~15분 ~ 1시간** | Lambda 세션 토큰 유효기간에 종속 |

> **주의**: `X-Amz-Expires`를 아무리 길게 설정해도, 서명에 사용된 자격증명(Access Key, STS 토큰)이 만료/삭제되면 URL은 즉시 무효화된다.

---

# 3. 용어 사전

| 용어 | 원어 | 설명 |
|------|------|------|
| **Pre-signed** | Pre(미리) + Signed(서명된) | 사용 시점 이전에 서명이 완성되어 URL에 내포된 상태 |
| **HMAC** | Hash-based Message Authentication Code | 비밀 키와 해시 함수를 결합한 메시지 인증 코드. RFC 2104 (1997) |
| **HMAC-SHA256** | HMAC with SHA-256 | HMAC에 SHA-256 해시 함수를 사용한 변형. SigV4의 핵심 알고리즘 |
| **SHA-256** | Secure Hash Algorithm 256-bit | 256비트 해시를 생성하는 암호학적 해시 함수. FIPS 180-4 (2012) |
| **Canonical Request** | 정규 요청 | HTTP 요청을 정해진 규칙(canon)에 따라 표준화한 문자열 |
| **StringToSign** | 서명 대상 문자열 | 알고리즘 + 타임스탬프 + Credential Scope + Canonical Request 해시 |
| **Signing Key** | 서명 키 | Secret Key에서 4단계 HMAC 체인으로 파생된 키 |
| **Credential Scope** | 자격증명 범위 | `날짜/리전/서비스/aws4_request` 형식. 서명의 유효 범위 제한 |
| **SigV4** | AWS Signature Version 4 | 2012년 도입된 AWS 서명 프로토콜. 현행 표준 |
| **SigV2** | AWS Signature Version 2 | 구 서명 프로토콜. 2020년 6월 완전 종료 |
| **Query String Authentication** | 쿼리 문자열 인증 | Authorization 헤더 대신 URL 파라미터로 인증 정보를 전달하는 방식 |
| **Capability URL** | 능력 URL | URL 자체가 접근 권한(능력)을 담고 있는 URL. Presigned URL은 이 패턴 |
| **STS** | Security Token Service | AWS 임시 보안 자격증명을 발급하는 서비스 |
| **X-Amz-Algorithm** | - | 서명 알고리즘 식별자. `AWS4-HMAC-SHA256` |
| **X-Amz-Credential** | - | Access Key ID + Credential Scope |
| **X-Amz-Date** | - | 서명 생성 시각 (ISO 8601 UTC) |
| **X-Amz-Expires** | - | URL 유효 시간 (초 단위) |
| **X-Amz-SignedHeaders** | - | 서명에 포함된 헤더 목록 |
| **X-Amz-Signature** | - | 최종 HMAC-SHA256 서명값 (64자리 hex) |
| **X-Amz-Security-Token** | - | STS 임시 자격증명 사용 시 세션 토큰 |
| **X-Amz-** 접두사 | Extension-Amazon | HTTP 비표준 확장 헤더임을 나타내는 Amazon 전용 접두사 |

---

# 4. 역사와 진화

## 4.1 연대표

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Presigned URL 관련 연대표                                  │
│                                                             │
│  1966  Dennis & Van Horn                                    │
│        └── Capability-based Security 개념 제안 (ACM 논문)   │
│                                                             │
│  1988  Norm Hardy                                           │
│        └── Confused Deputy Problem 정의                     │
│                                                             │
│  1997  RFC 2104 (Bellare, Canetti, Krawczyk)                │
│        └── HMAC 표준화                                      │
│                                                             │
│  2006  Amazon S3 출시 (2006.03.14)                          │
│        └── Query String Authentication 출시 당시부터 존재   │
│            (SigV2 기반)                                     │
│                                                             │
│  2012  AWS Signature Version 4 도입                         │
│        └── HMAC-SHA256 기반, 리전별 서명 범위 제한          │
│            SHA-256: FIPS 180-4 표준화                        │
│                                                             │
│  2013  GCP Signed URL 출시                                  │
│        └── RSA + SHA-256 기반 (비대칭 키 방식)              │
│                                                             │
│  2013  Azure SAS Token 출시                                 │
│        └── HMAC-SHA256 기반, 3가지 SAS 유형                 │
│                                                             │
│  2014  SigV4 신규 리전 의무화 (2014.01.30~)                 │
│        └── 기존 리전은 SigV2 병행 허용                      │
│                                                             │
│  2020  SigV2 완전 종료 (2020.06)                            │
│        └── 모든 리전에서 SigV4만 허용                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.2 SigV2 vs SigV4 비교표

| 항목 | SigV2 | SigV4 |
|------|-------|-------|
| **해시 알고리즘** | HMAC-SHA1 / HMAC-SHA256 | HMAC-SHA256 전용 |
| **서명 범위** | 전역 (리전 구분 없음) | 날짜/리전/서비스로 범위 제한 |
| **키 파생** | Secret Key 직접 사용 | 4단계 HMAC 체인으로 파생 |
| **Credential Scope** | 없음 | `날짜/리전/서비스/aws4_request` |
| **보안 수준** | 키 재사용 범위가 넓음 | 키가 특정 날짜+리전+서비스에만 유효 |
| **Streaming 서명** | 미지원 | Chunked Transfer 서명 지원 |
| **현재 상태** | **2020.06 완전 종료** | **현행 표준** |

SigV4의 핵심 개선점: Secret Key에서 매일/리전별/서비스별 **파생 키**를 생성하므로, 키가 유출되어도 피해 범위가 특정 날짜/리전/서비스로 한정된다.

## 4.3 Capability-based Security 이론

Presigned URL은 **Capability-based Security** 패러다임의 실전 구현이다.

| 개념 | 설명 | Presigned URL 대응 |
|------|------|-------------------|
| **Capability** | 객체에 대한 접근 권한을 담은 위조 불가능한 토큰 | URL 자체가 capability 토큰 |
| **Possession is authority** | 토큰을 소유한 것만으로 권한 행사 | URL을 가진 누구나 접근 가능 |
| **Unforgeable** | 토큰 위조 불가 | HMAC-SHA256 서명으로 보장 |
| **Attenuable** | 권한을 줄일 수 있음 (위임 시) | 만료 시간, HTTP 메서드, 경로로 제한 |
| **Confused Deputy** | 대리인이 의도치 않게 권한 남용 | Credential Scope로 범위 제한 |

Dennis & Van Horn(1966)이 제안한 이론이 60년 후 클라우드 스토리지에서 실현된 것이다.

---

# 5. 대안 비교

## 5.1 AWS 내: S3 Presigned URL vs CloudFront Signed URL vs Signed Cookies

| 항목 | S3 Presigned URL | CloudFront Signed URL | CloudFront Signed Cookies |
|------|-----------------|----------------------|--------------------------|
| **서명 방식** | HMAC-SHA256 (대칭 키) | RSA-SHA1 (비대칭 키) | RSA-SHA1 (비대칭 키) |
| **키 관리** | IAM Access Key | CloudFront Key Pair | CloudFront Key Pair |
| **범위** | 단일 S3 객체 | 단일 URL 또는 와일드카드 패턴 | 다수 파일 (쿠키 범위) |
| **캐싱** | S3 직접 접근 (캐시 없음) | 엣지 캐시 활용 | 엣지 캐시 활용 |
| **성능** | S3 리전까지 RTT | 가장 가까운 엣지 | 가장 가까운 엣지 |
| **IP 제한** | 불가 (Bucket Policy 조합 필요) | Policy 내 IP 조건 가능 | Policy 내 IP 조건 가능 |
| **생성 비용** | < 1ms (로컬 HMAC) | ~3ms (ECDSA) / ~34ms (RSA) | ~3ms (ECDSA) |
| **최적 용도** | 단일 파일 업/다운로드 | CDN 배포 + 접근 제어 | 스트리밍, 다수 리소스 |

## 5.2 클라우드 간: AWS vs GCP vs Azure

| 항목 | AWS S3 Presigned URL | GCP Signed URL | Azure SAS Token |
|------|---------------------|----------------|-----------------|
| **서명 알고리즘** | HMAC-SHA256 | RSA-SHA256 또는 HMAC | HMAC-SHA256 |
| **키 유형** | 대칭 키 (Secret Access Key) | 비대칭 키 (서비스 계정) 또는 HMAC | 대칭 키 (Storage Key) |
| **최대 유효기간** | 7일 (IAM User) | 7일 (V4) | 무제한 (Account SAS) |
| **SAS 유형** | 단일 유형 | 단일 유형 | 3유형: User Delegation / Service / Account |
| **권한 세분화** | HTTP 메서드 단위 | HTTP 메서드 단위 | 읽기/쓰기/삭제/목록 등 개별 지정 |
| **IP 제한** | Bucket Policy 조합 | signedIP 파라미터 | sip (signedIP) 파라미터 |
| **HTTPS 강제** | 별도 설정 | signedProtocol | spr=https |
| **취소 메커니즘** | 키 삭제/비활성화 | 서비스 계정 키 삭제 | Stored Access Policy 변경 |
| **V2/V4 구분** | V4 (V2 종료) | V2(무기한)/V4(7일 상한) | N/A |

### Azure SAS 3유형

| 유형 | 키 소스 | 특징 |
|------|--------|------|
| **User Delegation SAS** | Azure AD + Storage Key | 가장 안전. Azure AD 인증 필요 |
| **Service SAS** | Storage Account Key | 특정 서비스(Blob, Queue 등) 범위 |
| **Account SAS** | Storage Account Key | 계정 수준 전체 범위 |

## 5.3 상황별 최적 선택 가이드

| 시나리오 | 최적 선택 | 이유 |
|---------|----------|------|
| 단일 파일 다운로드 링크 생성 | **S3 Presigned URL** | 가장 단순, 추가 인프라 불필요 |
| 브라우저 직접 업로드 | **S3 Presigned URL (PUT)** 또는 **POST Policy** | 서버 무부하 업로드 |
| CDN 경유 콘텐츠 배포 + 접근 제어 | **CloudFront Signed URL** | 엣지 캐시 + 접근 제어 |
| HLS/DASH 스트리밍 (다수 세그먼트) | **CloudFront Signed Cookies** | 세그먼트마다 URL 불필요 |
| 불특정 다수에게 공개 | **Bucket Policy (public-read)** | Presigned URL 불필요 |
| Cross-account 접근 | **IAM Role + Bucket Policy** | 영구적 접근이면 Presigned URL 부적합 |
| 대용량 파일 (5GB 초과) | **Presigned URL + Multipart Upload** | 파트별 Presigned URL 생성 |
| 동적 콘텐츠 변환 (리사이즈 등) | **S3 Object Lambda** | 접근 시점에 변환 |
| 전 세계 사용자 대상 정적 사이트 | **CloudFront + S3 OAC** | CDN 캐싱, HTTPS, DDoS 방어 |
| 규정 준수 감사 추적 필요 | **STS + CloudTrail** | 임시 자격증명 추적 가능 |
| 멀티클라우드 호환 | **각 CSP Signed URL** | 서명 방식이 다르므로 추상화 레이어 필요 |

---

# 6. 실전 구현 패턴

## 6.1 다운로드 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  안전한 다운로드 아키텍처                                   │
│                                                             │
│  ┌────────┐  1. GET /api/download/report-q1                │
│  │ Client │ ──────────────────────────────→ ┌────────────┐ │
│  │        │                                 │ App Server │ │
│  │        │ ←────────────────────────────── │ (Python)   │ │
│  │        │  2. 302 Redirect                │            │ │
│  │        │     Location: https://bucket    │ ① 권한 확인│ │
│  │        │     .s3...?X-Amz-Signature=...  │ ② URL 생성 │ │
│  └───┬────┘                                 └────────────┘ │
│      │                                                      │
│      │ 3. GET (Presigned URL로 리다이렉트)                  │
│      ▼                                                      │
│  ┌─────────────────┐                                       │
│  │     AWS S3       │  4. 서명 검증 → 객체 반환             │
│  │  (데이터 직접    │                                       │
│  │   전송)          │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  서버는 URL만 생성 (1ms), 실제 전송은 S3가 담당            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Python 코드 (boto3)

```python
import boto3
from botocore.config import Config

s3_client = boto3.client(
    's3',
    region_name='ap-northeast-2',
    config=Config(signature_version='s3v4')
)

def generate_download_url(bucket: str, key: str, expires_in: int = 300) -> str:
    """
    다운로드용 Presigned URL 생성.
    expires_in: 유효 시간 (초). 기본 5분.
    """
    url = s3_client.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': bucket,
            'Key': key,
            'ResponseContentDisposition': 'attachment; filename="report.pdf"',
        },
        ExpiresIn=expires_in,
    )
    return url

# 사용 예
url = generate_download_url('my-bucket', 'reports/2026/Q1.pdf', expires_in=300)
# → 5분간 유효한 다운로드 URL 반환
```

## 6.2 업로드 아키텍처

### PUT vs POST Policy 비교

| 항목 | Presigned PUT URL | POST Policy (Presigned POST) |
|------|------------------|------------------------------|
| **HTTP 메서드** | PUT | POST (multipart/form-data) |
| **파일 키 결정** | 서버가 미리 지정 | Policy 조건으로 패턴 허용 가능 |
| **Content-Type 제한** | 서명 시 지정 가능 | Policy 조건으로 제한 |
| **파일 크기 제한** | 불가 (서명에 미포함) | `content-length-range` 조건으로 제한 |
| **추가 메타데이터** | 헤더로 전달 | 폼 필드로 전달 |
| **브라우저 호환성** | `fetch` / `XMLHttpRequest` 필요 | `<form>` 태그로 직접 제출 가능 |
| **추천 용도** | 프로그래밍 환경 업로드 | 브라우저 폼 업로드, 크기 제한 필요 시 |

### Python 코드 - PUT 업로드 URL 생성

```python
def generate_upload_url(bucket: str, key: str, content_type: str = 'application/octet-stream',
                        expires_in: int = 300) -> str:
    """업로드용 Presigned PUT URL 생성."""
    url = s3_client.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': bucket,
            'Key': key,
            'ContentType': content_type,
        },
        ExpiresIn=expires_in,
    )
    return url

# 클라이언트 측 (JavaScript)
# fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/png' } })
```

### Python 코드 - POST Policy 업로드

```python
def generate_post_policy(bucket: str, key_prefix: str, max_size_mb: int = 10,
                         expires_in: int = 300) -> dict:
    """POST Policy 기반 업로드 폼 데이터 생성. 파일 크기 제한 가능."""
    conditions = [
        ['starts-with', '$key', key_prefix],
        ['content-length-range', 1, max_size_mb * 1024 * 1024],
        {'Content-Type': 'image/'},
    ]
    post = s3_client.generate_presigned_post(
        Bucket=bucket,
        Key=f'{key_prefix}/${{filename}}',
        Conditions=conditions,
        ExpiresIn=expires_in,
    )
    return post
    # 반환: { 'url': 'https://bucket.s3...', 'fields': { 'key': ..., 'policy': ..., ... } }
```

---

# 7. 보안 위험과 베스트 프랙티스

## 7.1 URL 유출 경로

| 유출 경로 | 설명 | 위험도 |
|----------|------|--------|
| **서버 접근 로그** | Nginx, Apache, ALB 로그에 전체 URL 기록 | 높음 |
| **Referer 헤더** | Presigned URL 페이지에서 외부 링크 클릭 시 Referer로 전달 | 높음 |
| **브라우저 히스토리** | 주소창에 노출된 URL이 히스토리에 저장 | 중간 |
| **메신저/이메일** | URL을 공유하면 서버에 로그 남음 (미리보기 봇 접근) | 높음 |
| **CDN/프록시 캐시** | 중간 프록시가 URL을 캐시 키로 저장 | 중간 |
| **스크린샷/화면 공유** | 주소창에 노출된 URL이 캡처 | 낮음 |
| **클라이언트 측 JS 로그** | 에러 트래킹 도구(Sentry 등)가 URL 수집 | 높음 |

## 7.2 안티패턴

| 안티패턴 | 문제점 | 대안 |
|---------|--------|------|
| **X-Amz-Expires=604800 (7일)** | 유출 시 7일간 악용 가능 | 최소 필요 시간만 설정 (5~15분 권장) |
| **공개 버킷 + Presigned URL** | Presigned URL이 무의미 (이미 누구나 접근 가능) | Block Public Access 활성화 |
| **프론트엔드에 IAM 키 노출** | Secret Key가 브라우저에 노출 | 서버에서만 URL 생성, 프론트엔드는 URL만 수신 |
| **IDOR (경로 추측)** | 사용자가 경로 패턴 추측하여 다른 사용자 파일 요청 | 서버에서 권한 검증 후 URL 생성 |
| **HTTP로 Presigned URL 전달** | 중간자가 URL 탈취 가능 | HTTPS 전용 |
| **단일 장기 IAM User 키 사용** | 키 유출 시 피해 범위가 넓음 | STS 임시 자격증명 사용 |

## 7.3 베스트 프랙티스

| 프랙티스 | 설명 |
|---------|------|
| **최소 만료 시간** | 용도에 맞는 최소 시간 설정. 다운로드: 5분, 업로드: 15분 |
| **HTTPS 전용** | Presigned URL 자체와 URL을 전달하는 API 모두 HTTPS |
| **STS 임시 자격증명** | IAM User 장기 키 대신 `AssumeRole`로 임시 키 사용 |
| **Content-Type 제한** | 업로드 시 허용 Content-Type을 서명에 포함 |
| **s3:signatureAge 조건** | Bucket Policy에서 서명 나이 강제 제한 |
| **서버 측 권한 검증** | URL 생성 전 반드시 요청자의 권한 확인 |
| **고유 키 생성** | UUID 기반 키로 경로 추측 방지 |
| **VPC Endpoint** | 내부 트래픽은 VPC Endpoint 경유로 인터넷 미노출 |
| **CloudTrail 활성화** | S3 데이터 이벤트 로깅으로 접근 추적 |
| **Referer 차단** | `Referrer-Policy: no-referrer` 헤더 설정 |

### s3:signatureAge Bucket Policy 예시

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOldSignatures",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*",
    "Condition": {
      "NumericGreaterThan": {
        "s3:signatureAge": 300000
      }
    }
  }]
}
```

이 정책은 **서명 생성 후 5분(300,000ms) 초과된 요청을 거부**한다. `X-Amz-Expires`를 7일로 설정해도 서버 측에서 5분으로 강제 제한할 수 있다.

## 7.4 보안 체크리스트

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Presigned URL 보안 체크리스트                              │
│                                                             │
│  [ ] Block Public Access 4개 항목 모두 활성화               │
│  [ ] X-Amz-Expires를 최소 필요 시간으로 설정 (5~15분)      │
│  [ ] STS 임시 자격증명 사용 (IAM User 장기 키 미사용)      │
│  [ ] HTTPS 전용 (HTTP 접근 차단)                            │
│  [ ] 서버 측에서 요청자 권한 검증 후 URL 생성               │
│  [ ] s3:signatureAge Bucket Policy 설정                     │
│  [ ] 업로드 시 Content-Type 제한                            │
│  [ ] UUID 기반 객체 키 (경로 추측 방지)                     │
│  [ ] 서버 로그에서 쿼리 스트링 마스킹 또는 제외             │
│  [ ] Referer 헤더 전파 차단 (Referrer-Policy)               │
│  [ ] CloudTrail S3 데이터 이벤트 로깅 활성화                │
│  [ ] VPC Endpoint 사용 (내부 트래픽)                        │
│  [ ] 에러 트래킹 도구에서 URL 파라미터 필터링               │
│  [ ] POST Policy 사용 시 content-length-range 조건 설정     │
│  [ ] 자격증명 교체(rotation) 자동화                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 8. 트러블슈팅

## 8.1 SignatureDoesNotMatch

가장 흔한 오류. 클라이언트가 보낸 요청으로 S3가 재계산한 서명과 URL의 서명이 불일치.

| 원인 | 상세 | 해결 |
|------|------|------|
| **Region 불일치** | URL 생성 시 `us-east-1`, 실제 버킷은 `ap-northeast-2` | 버킷 리전과 클라이언트 리전 일치시킴 |
| **Virtual-hosted vs Path-style** | SDK가 Path-style로 서명, S3가 Virtual-hosted로 해석 | `s3v4` 서명 + Virtual-hosted 사용 |
| **URL 인코딩 불일치** | 특수문자 키를 이중 인코딩 또는 인코딩 누락 | SDK의 URL 생성 함수 사용 (수동 인코딩 금지) |
| **Content-Type 불일치** | 서명 시 `image/png`, 요청 시 `application/octet-stream` | 서명과 요청의 Content-Type 일치시킴 |
| **Transfer Acceleration** | 일반 엔드포인트로 서명, Acceleration 엔드포인트로 요청 | 서명 시 `s3-accelerate` 엔드포인트 사용 |
| **시계 오차** | 서명 생성 서버의 시간이 틀림 | NTP 동기화 확인 |

## 8.2 RequestTimeTooSkewed

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  오류: RequestTimeTooSkewed                                 │
│                                                             │
│  원인: 서명의 X-Amz-Date와 S3 서버 현재 시간 차이 > 15분  │
│                                                             │
│  발생 시나리오:                                             │
│  ├── URL 생성 서버의 시계가 15분 이상 어긋남               │
│  ├── URL 생성 후 15분 이상 경과 (X-Amz-Expires와 별개)     │
│  └── 클라이언트 측 시계 문제 (S3는 서버 시계 사용)         │
│                                                             │
│  해결:                                                      │
│  ├── NTP 서비스 활성화 및 시계 동기화                       │
│  ├── Amazon Time Sync Service 사용 (169.254.169.123)       │
│  └── URL 생성 직후 바로 사용 (캐싱 금지)                   │
│                                                             │
│  참고: 15분 허용 오차는 AWS가 설정한 고정값 (변경 불가)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 8.3 ExpiredToken

| 상황 | 원인 | 해결 |
|------|------|------|
| STS 토큰 만료 | `AssumeRole`로 받은 임시 토큰이 만료됨 | 토큰 갱신 후 URL 재생성 |
| EC2 역할 토큰 만료 | 인스턴스 메타데이터에서 자동 갱신된 토큰으로 서명해야 함 | SDK 최신 버전 사용 (자동 갱신) |
| Lambda 콜드 스타트 후 토큰 | 캐시된 오래된 토큰 사용 | 매 호출 시 새 클라이언트 생성 또는 토큰 갱신 확인 |
| IAM 키 삭제/비활성화 | 서명에 사용된 Access Key가 삭제됨 | 새 키로 URL 재생성 |

> **주의**: `X-Amz-Expires`가 아직 유효해도, 서명에 사용된 자격증명이 만료/삭제되면 URL은 즉시 무효화된다. AWS는 만료 시간과 자격증명 유효성을 **독립적으로** 검증한다.

---

# 9. 참고 자료

| 자료 | 링크/출처 |
|------|----------|
| AWS 공식: Authenticating Requests (Query String) | docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html |
| AWS 공식: Signature Version 4 Signing Process | docs.aws.amazon.com/general/latest/gr/signature-version-4.html |
| RFC 2104: HMAC (1997) | Bellare, Canetti, Krawczyk |
| FIPS 180-4: SHA-256 (2012) | NIST |
| Dennis & Van Horn (1966) | "Programming Semantics for Multiprogrammed Computations", ACM |
| Norm Hardy (1988) | "The Confused Deputy" |
| GCP Signed URLs | cloud.google.com/storage/docs/access-control/signed-urls |
| Azure SAS Tokens | learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview |
| AWS SigV2 종료 공지 (2020) | aws.amazon.com/blogs/aws/amazon-s3-path-deprecation-plan-the-rest-of-the-story/ |

---

## 관련 키워드

`Presigned URL`, `AWS Signature Version 4`, `SigV4`, `HMAC-SHA256`, `Query String Authentication`, `Canonical Request`, `StringToSign`, `Signing Key`, `Credential Scope`, `X-Amz-Signature`, `X-Amz-Expires`, `X-Amz-Credential`, `Capability-based Security`, `Capability URL`, `CloudFront Signed URL`, `Signed Cookies`, `Azure SAS Token`, `GCP Signed URL`, `S3`, `STS`, `임시 자격증명`, `서명 검증`, `POST Policy`, `s3:signatureAge`, `RFC 2104`, `Dennis & Van Horn`

