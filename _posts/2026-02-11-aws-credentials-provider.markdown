---
layout: single
title: "AWS Credentials Provider"
date: 2026-02-11 11:20:00 +0900
categories: cloud
excerpt: "AWS Credentials Provider의 개념·등장배경·이유·특징을 정리"
toc: true
toc_sticky: true
tags: [AWS, Credentials, Provider]
---

# TL;DR
- **AWS Credentials Provider의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
``` ┌─────────────────────────────────────────────────────────────┐ │                                                             │ │  AWS API 호출 시 "나는 누구인가?"를 증명해야 함             │ │                                                             │ │  자격 증명 = Access Key + Secret Key (+ Session Token)     │ │                                                             │ │  CredentialsProvider = 자격 증명을 가져오는 방법을 정의    │ │                                                             │ └─────────────────────────────────────────────────────────────┘ ```

## 2. 배경
AWS Credentials Provider이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- 개념
- 탐색 순서 (Credential Chain)
- 코드 예시
- 구현 방법
- 임시 자격 증명 (STS) 지원

## 5. 상세 내용

> **작성일**: 2026-02-05
> **카테고리**: Cloud / AWS / Authentication
> **포함 내용**: DefaultCredentialsProvider, CustomCredentialProvider, 자격 증명 체인, IAM, STS, Vault 연동

---

# 1. AWS 자격 증명 개요

## 개념

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  AWS API 호출 시 "나는 누구인가?"를 증명해야 함             │
│                                                             │
│  자격 증명 = Access Key + Secret Key (+ Session Token)     │
│                                                             │
│  CredentialsProvider = 자격 증명을 가져오는 방법을 정의    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 2. DefaultCredentialsProvider

## 개념

```
DefaultCredentialsProvider = AWS SDK가 제공하는 "자동 자격 증명 체인"
                            └── 여러 소스를 순서대로 탐색
                            └── 첫 번째 발견된 자격 증명 사용
```

## 탐색 순서 (Credential Chain)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. 환경 변수                                               │
│     └── AWS_ACCESS_KEY_ID                                  │
│     └── AWS_SECRET_ACCESS_KEY                              │
│     └── AWS_SESSION_TOKEN (임시 자격 증명 시)              │
│                                                             │
│  2. Java 시스템 속성                                        │
│     └── aws.accessKeyId                                    │
│     └── aws.secretAccessKey                                │
│                                                             │
│  3. Web Identity Token (EKS Pod Identity)                  │
│     └── AWS_WEB_IDENTITY_TOKEN_FILE                        │
│     └── AWS_ROLE_ARN                                       │
│     └── OIDC 토큰으로 STS AssumeRoleWithWebIdentity        │
│                                                             │
│  4. 공유 자격 증명 파일                                     │
│     └── ~/.aws/credentials                                 │
│     └── [default] 또는 AWS_PROFILE 지정 프로필             │
│                                                             │
│  5. AWS Config 파일                                         │
│     └── ~/.aws/config                                      │
│     └── role_arn, source_profile 등 프로필 설정            │
│                                                             │
│  6. ECS Container Credentials                              │
│     └── AWS_CONTAINER_CREDENTIALS_RELATIVE_URI             │
│     └── ECS Task에 할당된 IAM Role                         │
│                                                             │
│  7. EC2 Instance Metadata Service (IMDS)                   │
│     └── http://169.254.169.254/...                         │
│     └── EC2 Instance Profile에 연결된 IAM Role             │
│                                                             │
│  ※ 위에서부터 순서대로 탐색, 발견 즉시 사용                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 코드 예시

```java
// AWS SDK v2 (Java)
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.services.s3.S3Client;

// 자동으로 환경에 맞는 자격 증명 탐색
S3Client s3 = S3Client.builder()
    .credentialsProvider(DefaultCredentialsProvider.create())
    .build();

// 또는 생략 가능 (기본값)
S3Client s3 = S3Client.create();
```

```kotlin
// Kotlin + AWS SDK v2
val s3 = S3Client.builder()
    .credentialsProvider(DefaultCredentialsProvider.create())
    .build()
```

---

# 3. CustomCredentialProvider

## 개념

```
CustomCredentialProvider = 개발자가 직접 구현하는 자격 증명 제공자
                          └── AwsCredentialsProvider 인터페이스 구현
                          └── 특수한 인증 요구사항 처리
```

## 구현 방법

```java
import software.amazon.awssdk.auth.credentials.AwsCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;

public class VaultCredentialProvider implements AwsCredentialsProvider {

    private final VaultClient vaultClient;

    public VaultCredentialProvider(VaultClient vaultClient) {
        this.vaultClient = vaultClient;
    }

    @Override
    public AwsCredentials resolveCredentials() {
        // Vault에서 동적으로 AWS 자격 증명 가져오기
        VaultSecret secret = vaultClient.read("aws/creds/my-role");

        return AwsBasicCredentials.create(
            secret.get("access_key"),
            secret.get("secret_key")
        );
    }
}

// 사용
S3Client s3 = S3Client.builder()
    .credentialsProvider(new VaultCredentialProvider(vaultClient))
    .build();
```

## 임시 자격 증명 (STS) 지원

```java
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;

public class StsCredentialProvider implements AwsCredentialsProvider {

    @Override
    public AwsCredentials resolveCredentials() {
        // STS AssumeRole 호출
        AssumeRoleResponse response = stsClient.assumeRole(
            AssumeRoleRequest.builder()
                .roleArn("arn:aws:iam::123456789:role/MyRole")
                .roleSessionName("my-session")
                .build()
        );

        Credentials creds = response.credentials();

        // Session Token 포함된 임시 자격 증명 반환
        return AwsSessionCredentials.create(
            creds.accessKeyId(),
            creds.secretAccessKey(),
            creds.sessionToken()
        );
    }
}
```

---

# 4. 비교

## DefaultCredentialsProvider vs CustomCredentialProvider

| 항목 | DefaultCredentialsProvider | CustomCredentialProvider |
|------|---------------------------|-------------------------|
| 구현 주체 | AWS SDK 내장 | 개발자 직접 구현 |
| 설정 방식 | 자동 (환경 기반) | 명시적 코드 |
| 유연성 | 제한적 (정해진 순서) | 완전한 제어 |
| 유지보수 | AWS가 관리 | 개발자가 관리 |
| 테스트 | 환경 의존적 | Mock 가능 |
| 캐싱 | SDK 기본 캐싱 | 직접 구현 필요 |

## 선택 기준

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  DefaultCredentialsProvider 사용:                           │
│  ├── 로컬 개발 (credentials 파일)                          │
│  ├── EC2에서 실행 (Instance Profile)                       │
│  ├── ECS에서 실행 (Task Role)                              │
│  ├── EKS에서 실행 (Pod Identity / IRSA)                    │
│  └── 표준적인 AWS 환경                                      │
│                                                             │
│  CustomCredentialProvider 사용:                             │
│  ├── HashiCorp Vault 연동                                  │
│  ├── 자체 Secret 관리 시스템                               │
│  ├── 멀티 테넌트 (요청마다 다른 계정)                      │
│  ├── 커스텀 토큰 갱신 로직                                 │
│  ├── 감사 로깅 요구사항                                    │
│  └── 단위 테스트 Mock                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 5. 실제 사용 패턴

## 5.1 로컬 개발 환경

```bash
# ~/.aws/credentials
[default]
aws_access_key_id = AKIAXXXXXXXX
aws_secret_access_key = xxxxxxxxxx

# 또는 환경 변수
export AWS_ACCESS_KEY_ID=AKIAXXXXXXXX
export AWS_SECRET_ACCESS_KEY=xxxxxxxxxx
```

```java
// DefaultCredentialsProvider가 자동으로 찾음
S3Client s3 = S3Client.create();
```

## 5.2 EKS Pod (IRSA - IAM Roles for Service Accounts)

```yaml
# ServiceAccount에 IAM Role 연결
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/MyPodRole
```

```java
// Pod 내에서 DefaultCredentialsProvider가 Web Identity 감지
// AWS_WEB_IDENTITY_TOKEN_FILE, AWS_ROLE_ARN 환경변수 자동 설정
S3Client s3 = S3Client.create();  // 자동으로 IRSA 사용
```

## 5.3 Vault 연동 (Custom)

```java
@Configuration
public class AwsConfig {

    @Bean
    public S3Client s3Client(VaultTemplate vaultTemplate) {
        return S3Client.builder()
            .credentialsProvider(() -> {
                VaultResponse response = vaultTemplate
                    .read("aws/creds/s3-access");

                Map<String, Object> data = response.getData();
                return AwsBasicCredentials.create(
                    (String) data.get("access_key"),
                    (String) data.get("secret_key")
                );
            })
            .build();
    }
}
```

## 5.4 캐싱 + 자동 갱신 Custom Provider

```java
public class CachingCredentialProvider implements AwsCredentialsProvider {

    private volatile AwsCredentials cachedCredentials;
    private volatile Instant expiration;
    private final Duration refreshBefore = Duration.ofMinutes(5);

    @Override
    public AwsCredentials resolveCredentials() {
        if (shouldRefresh()) {
            synchronized (this) {
                if (shouldRefresh()) {
                    refresh();
                }
            }
        }
        return cachedCredentials;
    }

    private boolean shouldRefresh() {
        return cachedCredentials == null ||
               Instant.now().isAfter(expiration.minus(refreshBefore));
    }

    private void refresh() {
        // STS나 Vault에서 새 자격 증명 획득
        // cachedCredentials, expiration 업데이트
    }
}
```

---

# 6. STS 토큰 만료와 갱신

## 임시 자격 증명의 수명

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  STS 임시 자격 증명:                                        │
│  ├── Access Key ID     (ASIA로 시작)                       │
│  ├── Secret Access Key                                     │
│  ├── Session Token                                         │
│  └── Expiration        (만료 시간)                         │
│                                                             │
│  기본 만료 시간: 1시간 (3600초)                             │
│  최대 만료 시간: 12시간 (43200초)                           │
│     └── IAM Role의 MaxSessionDuration 설정에 따름          │
│                                                             │
│  ※ OAuth의 Refresh Token과 다름!                           │
│     STS에는 "Refresh Token" 개념이 없음                    │
│     만료 전에 AssumeRole 재호출하여 새 토큰 발급 필요       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## OAuth vs STS 비교

| 개념 | OAuth 2.0 | AWS STS |
|------|-----------|---------|
| 단기 토큰 | Access Token | Session Credentials |
| 장기 토큰 | Refresh Token | **없음** |
| 갱신 방법 | Refresh Token으로 재발급 | AssumeRole 재호출 |
| 갱신 조건 | Refresh Token만 있으면 됨 | 원본 자격 증명 필요 |
| 사용자 개입 | 불필요 | 불필요 (자동화 가능) |

## 장시간 실행 프로세스 문제

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  문제 상황:                                                 │
│  ├── 프로세스 시작 시 STS 토큰 발급 (1시간 유효)           │
│  ├── 1시간 후 토큰 만료                                     │
│  └── S3 접근 시 "ExpiredTokenException" 에러               │
│                                                             │
│  해결책:                                                    │
│  ├── 방법 1: SDK 자동 갱신 Provider 사용 (권장)            │
│  ├── 방법 2: Custom Provider에서 갱신 로직 구현            │
│  ├── 방법 3: MaxSessionDuration 12시간으로 설정            │
│  └── 방법 4: EC2/ECS/EKS IAM Role 사용 (SDK가 자동 관리)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## SDK 자동 갱신 Provider

```java
// StsAssumeRoleCredentialsProvider는 자동 갱신 지원
StsClient stsClient = StsClient.create();

StsAssumeRoleCredentialsProvider provider = StsAssumeRoleCredentialsProvider.builder()
    .stsClient(stsClient)
    .refreshRequest(AssumeRoleRequest.builder()
        .roleArn("arn:aws:iam::123456789:role/MyRole")
        .roleSessionName("my-session")
        .durationSeconds(3600)
        .build())
    .asyncCredentialUpdateEnabled(true)  // 비동기 갱신
    .build();

// 만료 전에 자동으로 새 토큰 발급
S3Client s3 = S3Client.builder()
    .credentialsProvider(provider)
    .build();
```

## EC2/ECS/EKS에서의 자동 갱신

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  EC2 Instance Profile / ECS Task Role / EKS IRSA:          │
│                                                             │
│  AWS SDK가 IMDS/Container Credentials에서 토큰 조회        │
│         ↓                                                   │
│  토큰 만료 전에 SDK가 자동으로 새 토큰 요청                 │
│         ↓                                                   │
│  개발자는 토큰 갱신 신경 쓸 필요 없음                       │
│                                                             │
│  → 프로덕션에서는 IAM Role 사용이 가장 안전하고 편리       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 7. 주의사항

## 6.1 자격 증명 노출 방지

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ❌ 하지 말 것:                                             │
│  ├── 코드에 Access Key 하드코딩                            │
│  ├── Git에 credentials 파일 커밋                           │
│  └── 로그에 자격 증명 출력                                  │
│                                                             │
│  ✅ 권장:                                                   │
│  ├── IAM Role 사용 (EC2, ECS, EKS)                         │
│  ├── 환경 변수 또는 Secret Manager                         │
│  └── 임시 자격 증명 (STS) 활용                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 IMDS v2 권장

```
EC2 Instance Metadata Service (IMDS)
├── v1: GET 요청만으로 접근 (SSRF 취약)
└── v2: 토큰 기반 (보안 강화)

AWS SDK v2는 기본적으로 IMDSv2 시도 후 v1 폴백
프로덕션에서는 IMDSv2만 허용 권장
```

---

## 관련 키워드

`DefaultCredentialsProvider`, `CustomCredentialProvider`, `AWS SDK`, `IAM`, `STS`, `AssumeRole`, `IRSA`, `Instance Profile`, `Task Role`, `Vault`, `자격 증명 체인`, `credentials`, `Access Key`, `Secret Key`, `Session Token`, `토큰 만료`, `자동 갱신`, `StsAssumeRoleCredentialsProvider`, `ExpiredTokenException`, `MaxSessionDuration`
