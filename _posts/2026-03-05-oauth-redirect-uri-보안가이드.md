---
layout: single
title: "OAuth Redirect URI 보안 완전 가이드"
date: 2026-03-05 23:00:00 +0900
categories: security
excerpt: "OAuth Redirect URI 보안은 정확한 등록과 PKCE 같은 방어 기법으로 코드 탈취를 막는 방법을 정리한다."
toc: true
toc_sticky: true
tags: [oauth, redirecturi, pkce, security]
---

## TL;DR
- Redirect URI는 OAuth 인가 코드 흐름의 핵심 보안 경계다.
- 와일드카드 허용과 오픈 리다이렉터는 코드 탈취로 이어진다.
- PKCE·PAR·정확 일치 정책으로 위험을 최소화한다.

## 1. 개념
OAuth Redirect URI는 인가 코드를 전달받는 주소를 엄격히 검증하는 메커니즘이다.

## 2. 배경
클라이언트·플랫폼 다양화로 리다이렉트 정책이 복잡해졌다.

## 3. 이유
오픈 리다이렉터와 코드 가로채기 공격을 방지해야 한다.

## 4. 특징
RFC 진화, 플랫폼별 패턴, PKCE·PAR, 보안 체크리스트를 제공한다.

## 5. 상세 내용

# OAuth Redirect URI 보안 완전 가이드

> **작성일**: 2026-03-05
> **범위**: Redirect URI 등록 → 의도적 커플링 → Open Redirector 공격 → PKCE → PAR → Dynamic Client Registration → BFF → 환경별 관리 → 대형 서비스 정책
> **포함 내용**: Redirect URI, Authorization Code, Open Redirector, PKCE, PAR, DCR, BFF, Custom URI Scheme, Universal Links, App Links, Loopback Redirect, Device Authorization Grant, Exact String Matching, Wildcard Bypass, Subdomain Takeover, RFC 6749, RFC 9700, OAuth 2.1, RFC 7636, RFC 9126, RFC 7591, RFC 8252, RFC 8628

---

## 목차

1. [용어 사전](#1-용어-사전)
2. [Redirect URI란 무엇인가](#2-redirect-uri란-무엇인가)
3. [의도적 커플링: 왜 서버가 클라이언트 URL을 알아야 하는가](#3-의도적-커플링-왜-서버가-클라이언트-url을-알아야-하는가)
4. [Open Redirector 공격](#4-open-redirector-공격)
5. [RFC 표준 진화: 6749 → 9700 → OAuth 2.1](#5-rfc-표준-진화-6749--9700--oauth-21)
6. [플랫폼별 Redirect URI 패턴](#6-플랫폼별-redirect-uri-패턴)
7. [Wildcard Redirect URI의 위험성](#7-wildcard-redirect-uri의-위험성)
8. [PKCE: 코드 가로채기 방어](#8-pkce-코드-가로채기-방어)
9. [PAR (Pushed Authorization Requests)](#9-par-pushed-authorization-requests)
10. [Dynamic Client Registration (RFC 7591)](#10-dynamic-client-registration-rfc-7591)
11. [BFF 패턴과 Redirect URI](#11-bff-패턴과-redirect-uri)
12. [환경별 Redirect URI 관리 전략](#12-환경별-redirect-uri-관리-전략)
13. [대형 서비스의 Redirect URI 정책](#13-대형-서비스의-redirect-uri-정책)
14. [실전 보안 체크리스트](#14-실전-보안-체크리스트)
15. [키워드 색인](#15-키워드-색인)

---

# 1. 용어 사전

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     OAuth Redirect URI 핵심 용어 사전                        │
├────────────────────────┬──────────────────────────┬─────────────────────────┤
│ 영문 용어               │ 한국어 의미              │ 유래 / 비고              │
├────────────────────────┼──────────────────────────┼─────────────────────────┤
│ Redirect URI           │ 리다이렉트 URI           │ RFC 6749 Section 3.1.2  │
│                        │ (인가 코드 수신 주소)     │ callback URL이라고도 함  │
│ Authorization Code     │ 인가 코드                │ 일회용 코드, AT 교환용   │
│ Open Redirector        │ 오픈 리다이렉터           │ 임의 URL로 리다이렉트    │
│                        │ (개방형 리다이렉트 취약점) │ 하는 엔드포인트          │
│ PKCE                   │ 코드 교환 증명 키         │ Proof Key for Code      │
│                        │                          │ Exchange (RFC 7636)     │
│ PAR                    │ 사전 인가 요청            │ Pushed Authorization    │
│                        │                          │ Requests (RFC 9126)     │
│ DCR                    │ 동적 클라이언트 등록       │ Dynamic Client          │
│                        │                          │ Registration (RFC 7591) │
│ BFF                    │ 프론트엔드 전용 백엔드     │ Backend-for-Frontend    │
│ Authorization Endpoint │ 인가 엔드포인트           │ /authorize 경로          │
│ Token Endpoint         │ 토큰 엔드포인트           │ /token 경로              │
│ Confidential Client    │ 기밀 클라이언트           │ 서버 측, 비밀 키 보관 가능│
│ Public Client          │ 공개 클라이언트           │ SPA/모바일, 비밀 키 불가  │
│ Code Verifier          │ 코드 검증자               │ PKCE 원본 랜덤 문자열    │
│ Code Challenge         │ 코드 챌린지               │ SHA256(code_verifier)   │
│ Custom URI Scheme      │ 커스텀 URI 스킴           │ myapp://callback        │
│                        │                          │ 다른 앱이 탈취 가능      │
│ Universal Links        │ 유니버설 링크 (iOS)       │ Apple AASA 파일 기반     │
│ App Links              │ 앱 링크 (Android)         │ Digital Asset Links 기반 │
│ Loopback Redirect      │ 루프백 리다이렉트          │ 127.0.0.1 로컬 전용     │
│ Device Authorization   │ 기기 인가 그랜트           │ RFC 8628, 헤드리스 기기  │
│   Grant                │                          │                         │
│ request_uri            │ 요청 URI 참조             │ PAR 응답의 불투명 참조값  │
│ Environment Handle     │ 환경 핸들                 │ 임시 환경 식별용 풀 방식  │
│ Token Binding          │ 토큰 바인딩               │ 토큰-TLS 채널 암호학 결합 │
│ Exact String Matching  │ 정확 문자열 일치           │ RFC 9700 필수 요구사항   │
│ Subdomain Takeover     │ 서브도메인 탈취           │ DNS 레코드 유기 후 공격   │
│ State Parameter        │ 상태 매개변수             │ CSRF 방어용 랜덤 값      │
│ Nonce                  │ 논스                      │ 재생 공격 방지용 일회값   │
│ Fragment               │ 프래그먼트 (#)            │ 브라우저 전용, 서버 미전송 │
└────────────────────────┴──────────────────────────┴─────────────────────────┘
```

---

# 2. Redirect URI란 무엇인가

## 2.1 정의

RFC 6749 Section 3.1.2에 따르면, **Redirect URI(Redirection Endpoint)**는 인가 서버가 리소스 소유자의 인가를 획득한 후, 인가 코드 또는 액세스 토큰을 전달하기 위해 사용자 에이전트를 리다이렉트하는 목적지 URI이다.

쉽게 말해, **"인증 완료 후 사용자를 돌려보낼 주소"**이다.

## 2.2 OAuth 2.0 인가 코드 플로우에서의 위치

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  OAuth 2.0 Authorization Code Flow                      │
│                  (Redirect URI의 역할)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [1] 사용자가 "Google로 로그인" 클릭                                     │
│                                                                         │
│  ┌──────────┐         ┌──────────────┐         ┌──────────────┐         │
│  │          │  ──(2)──▶│              │         │              │         │
│  │ 클라이언트 │         │  인가 서버    │         │ 리소스 서버   │         │
│  │  (App)   │         │ (Auth Server) │         │ (API Server) │         │
│  │          │◀──(5)── │              │         │              │         │
│  └────┬─────┘         └──────┬───────┘         └──────────────┘         │
│       │                      │                                          │
│       │    ┌─────────┐       │                                          │
│       └───▶│ 브라우저  │◀──────┘                                         │
│            └─────────┘                                                  │
│                                                                         │
│  (2) GET /authorize?                                                    │
│        response_type=code                                               │
│        &client_id=abc123                                                │
│        &redirect_uri=https://app.example.com/callback  ◀── 핵심!        │
│        &scope=openid profile                                            │
│        &state=xyz789                                                    │
│                                                                         │
│  (3) 사용자가 인가 서버에서 로그인 + 동의                                 │
│                                                                         │
│  (4) 인가 서버가 브라우저를 redirect_uri로 리다이렉트:                     │
│      HTTP 302 Location:                                                 │
│        https://app.example.com/callback?code=AUTH_CODE&state=xyz789     │
│        ▲                                                                │
│        └── 등록된 redirect_uri와 정확히 일치해야 리다이렉트 수행           │
│                                                                         │
│  (5) 클라이언트가 인가 코드로 토큰 교환 (서버 간 통신):                    │
│      POST /token                                                        │
│        grant_type=authorization_code                                    │
│        &code=AUTH_CODE                                                  │
│        &redirect_uri=https://app.example.com/callback                   │
│        &client_id=abc123                                                │
│        &client_secret=SECRET                                            │
│                                                                         │
│  (6) 인가 서버 → Access Token + Refresh Token 반환                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.3 사전 등록 요구사항

인가 서버는 **클라이언트 등록 시** redirect URI를 미리 알고 있어야 한다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  클라이언트 등록 시 Redirect URI 설정                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  POST /register (또는 관리 콘솔에서 수동 입력)                            │
│  {                                                                      │
│    "client_name": "My App",                                             │
│    "redirect_uris": [                                                   │
│      "https://app.example.com/callback",         ← 프로덕션             │
│      "https://staging.example.com/callback",     ← 스테이징             │
│      "http://localhost:3000/callback"             ← 로컬 개발           │
│    ],                                                                   │
│    "grant_types": ["authorization_code"],                               │
│    "token_endpoint_auth_method": "client_secret_basic"                  │
│  }                                                                      │
│                                                                         │
│  왜 사전 등록이 필수인가?                                                │
│  ├── 공격자가 redirect_uri를 자신의 서버로 변경하는 것을 방지             │
│  ├── 인가 코드/토큰이 정당한 클라이언트에게만 전달됨을 보장               │
│  └── RFC 9700: 사전 등록 없이는 인가 요청을 거부해야 함 (MUST)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.4 복수 Redirect URI 등록

하나의 클라이언트가 여러 redirect URI를 등록할 수 있다. 이 경우 인가 요청 시 `redirect_uri` 파라미터가 **필수**이다 (어느 URI로 리다이렉트할지 명시해야 하므로).

```
등록된 URI가 1개:  redirect_uri 파라미터 생략 가능 (자동 선택)
등록된 URI가 2개+: redirect_uri 파라미터 필수 (어떤 URI인지 명시)
```

---

# 3. 의도적 커플링: 왜 서버가 클라이언트 URL을 알아야 하는가

## 3.1 커플링은 버그가 아니라 설계이다

OAuth에서 인가 서버가 클라이언트의 redirect URI를 사전에 알아야 하는 것은 **의도적 설계**이다. RFC 6749 Section 10.15는 이를 open redirector 방지 메커니즘으로 명시한다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  검증 없는 경우 (위험)                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  공격자가 조작된 URL 생성:                                               │
│  https://auth.example.com/authorize?                                    │
│    client_id=legitimate_app                                             │
│    &redirect_uri=https://attacker.evil/steal  ◀── 악성 URI              │
│    &response_type=code                                                  │
│                                                                         │
│         사용자                    인가 서버                               │
│           │                        │                                    │
│           │──── 정상 로그인 ────────▶│                                    │
│           │                        │                                    │
│           │    ┌───────────────────┐│                                    │
│           │    │ redirect_uri 검증 ││                                    │
│           │    │ ❌ 안 함!          ││                                    │
│           │    └───────────────────┘│                                    │
│           │                        │                                    │
│           │◀── code=AUTH_CODE ──────│                                    │
│           │    Location: https://attacker.evil/steal?code=AUTH_CODE      │
│           │                        │                                    │
│           ▼                                                             │
│    공격자 서버가 인가 코드 수신 → 토큰 교환 → 계정 탈취                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.2 의도적 커플링의 형태

| 용어 | 설명 |
|------|------|
| **Redirect URI Registration** | OAuth 스펙(RFC 6749) 공식 용어. 클라이언트가 callback URL을 사전 등록하여 인가 서버가 검증할 수 있게 함 |
| **Loose Coupling via Configuration** | 설정(환경변수, config 파일)으로 의존성을 주입하여 coupling을 완화. URI 자체는 등록하되, 코드에 하드코딩하지 않음 |
| **BFF (Backend for Frontend)** | 프론트엔드-백엔드 coupling을 인정하고 전용 백엔드 계층을 두는 패턴. Redirect URI가 BFF 서버를 가리킴 |

## 3.3 보안 vs 편의성 트레이드오프

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   보안 ←──────────────────────────────────▶ 편의성       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Exact Match        Prefix Match       Wildcard         검증 없음       │
│  ■■■■■■■■■■        ■■■■■■■□□□         ■■■□□□□□□□       □□□□□□□□□□       │
│  보안: 최상          보안: 중간          보안: 위험        보안: 없음       │
│  관리: 번거로움      관리: 보통          관리: 편리        관리: 불필요      │
│                                                                         │
│  RFC 9700 (2025):                                                       │
│  "Exact string matching 필수(MUST)"                                     │
│  → Prefix Match, Wildcard 모두 금지                                     │
│                                                                         │
│  결론: 엄격한 검증이 유지보수 비용을 높이지만,                              │
│        토큰 탈취를 원천 차단하는 유일한 방법이다.                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 4. Open Redirector 공격

## 4.1 공격 메커니즘

**Open Redirector**란, 사용자를 임의의 외부 URL로 리다이렉트하는 엔드포인트를 말한다. OAuth 맥락에서 이는 인가 코드 또는 토큰이 공격자에게 전달되는 치명적 취약점이다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              Open Redirector 공격 흐름                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [시나리오 A] 인가 서버 측 Open Redirector                                │
│                                                                         │
│  1. 공격자가 피싱 이메일 전송:                                            │
│     "계정을 확인하세요" → 링크 클릭                                       │
│                                                                         │
│  2. 조작된 인가 요청:                                                    │
│     https://auth.example.com/authorize?                                 │
│       client_id=legit_app                                               │
│       &redirect_uri=https://attacker.evil/callback  ◀── 악성            │
│       &response_type=code                                               │
│       &scope=openid                                                     │
│                                                                         │
│  3. 인가 서버가 redirect_uri 검증 실패 (와일드카드, 미검증 등)             │
│     → 사용자 정상 로그인 후 코드를 attacker.evil로 전송                    │
│                                                                         │
│  4. 공격자가 code 수신 → /token 엔드포인트에서 토큰 교환                   │
│     → 피해자 계정 접근 완료                                               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────          │
│                                                                         │
│  [시나리오 B] 클라이언트 측 Open Redirector (RFC 9700 Section 4.11)       │
│                                                                         │
│  redirect_uri 자체는 정상이지만, 클라이언트 앱의 callback 페이지에         │
│  open redirector가 존재하는 경우:                                        │
│                                                                         │
│  1. 정상 redirect_uri 등록:                                              │
│     https://app.example.com/callback                                    │
│                                                                         │
│  2. 하지만 /callback 페이지가 query parameter로 리다이렉트 수행:           │
│     https://app.example.com/callback?next=https://attacker.evil          │
│                                                                         │
│  3. 인가 서버는 redirect_uri 검증 통과 (등록된 URI와 일치)                 │
│     → code가 정상 URI로 전달                                             │
│     → 클라이언트 앱이 next= 파라미터로 재리다이렉트                        │
│     → code 또는 token이 Referer 헤더로 attacker.evil에 노출               │
│                                                                         │
│  방어: callback 페이지에서 외부 URL로의 리다이렉트를 절대 허용하지 말 것    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4.2 실제 CVE 사례

### CVE-2023-6291 / CVE-2023-6134 / CVE-2023-6927 (Keycloak)

Keycloak에서 연쇄적으로 발견된 세 건의 와일드카드 우회 공격이다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Keycloak Wildcard Redirect URI 우회 공격 (2023)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  등록된 redirect_uri (와일드카드 허용):                                   │
│    https://app.example.com/*                                            │
│                                                                         │
│  [CVE-2023-6291] HTTP Basic Auth @ 임베딩 우회                           │
│  ─────────────────────────────────────────────                          │
│  공격 URI: https://app.example.com@attacker.evil/callback               │
│                                                                         │
│  URL 파싱:                                                              │
│    사용자 정보(userinfo): app.example.com    (@ 앞부분)                   │
│    실제 호스트:          attacker.evil       (@ 뒷부분)                   │
│                                                                         │
│  Keycloak은 "app.example.com"으로 시작한다고 판단 → 통과                  │
│  브라우저는 attacker.evil로 리다이렉트 → 코드 탈취                        │
│                                                                         │
│  [CVE-2023-6134] HTML Entity Encoding 우회                              │
│  ─────────────────────────────────────────                              │
│  공격 URI: https://app.example.com&#x40;attacker.evil/callback          │
│                                                                         │
│  &#x40; = @ 의 HTML 엔티티 인코딩                                       │
│  Keycloak 검증: 인코딩된 상태로 비교 → 통과                              │
│  브라우저 렌더링: 디코딩 후 @ 처리 → attacker.evil로 이동                  │
│                                                                         │
│  [CVE-2023-6927] JWT Response Mode 우회                                 │
│  ─────────────────────────────────────                                  │
│  response_mode=jwt 사용 시 redirect_uri 검증 로직이                      │
│  다른 코드 경로를 타면서 위의 패치가 적용되지 않은 경로 노출               │
│                                                                         │
│  근본 원인:                                                             │
│  ├── 와일드카드(*) suffix 패턴을 허용한 것 자체가 문제                    │
│  ├── URL 파싱에서 multiple decoding pass 취약점                          │
│  └── 검증 로직과 리다이렉트 로직의 URL 해석 불일치                        │
│                                                                         │
│  교훈: 와일드카드는 패치해도 우회가 반복된다 → 아예 사용하지 말 것          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Azure 서브도메인 탈취 (Subdomain Takeover)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Azure Subdomain Takeover를 이용한 Redirect URI 탈취                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  타임라인:                                                              │
│                                                                         │
│  [시점 1] 정상 운영                                                      │
│  ├── myapp.azurewebsites.net 에 Azure App Service 배포                  │
│  ├── OAuth 클라이언트에 redirect_uri 등록:                                │
│  │   https://myapp.azurewebsites.net/callback                           │
│  └── DNS CNAME: myapp.azurewebsites.net → Azure 인프라                  │
│                                                                         │
│  [시점 2] 리소스 삭제                                                    │
│  ├── 조직이 Azure App Service 리소스 삭제 (비용 절감 등)                  │
│  ├── DNS CNAME 레코드는 그대로 남아 있음 (dangling DNS)                   │
│  └── OAuth 클라이언트의 redirect_uri 등록도 그대로 남아 있음               │
│                                                                         │
│  [시점 3] 공격                                                           │
│  ├── 공격자가 myapp.azurewebsites.net 이름으로 새 App Service 생성       │
│  ├── Azure는 이름이 비어있으므로 할당 → 공격자가 해당 도메인 소유          │
│  ├── 기존 DNS CNAME이 공격자 서버로 연결                                  │
│  └── OAuth 인가 코드가 공격자 서버로 전달                                 │
│                                                                         │
│  방어:                                                                   │
│  ├── 클라우드 리소스 삭제 시 반드시 OAuth redirect_uri도 제거              │
│  ├── DNS CNAME 레코드 정리 (dangling DNS 모니터링)                       │
│  ├── 와일드카드 서브도메인 redirect_uri 사용 금지                         │
│  └── 정기적으로 등록된 redirect_uri의 유효성 감사                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4.3 PortSwigger 실습 참고

PortSwigger Web Security Academy는 OAuth 관련 실습 랩을 제공한다:
- **Lab: OAuth account hijacking via redirect_uri** - redirect_uri 검증 부재 시 인가 코드 탈취
- **Lab: Stealing OAuth access tokens via an open redirect** - 클라이언트 측 open redirector를 통한 토큰 탈취
- **Lab: SSRF via OpenID dynamic client registration** - DCR을 악용한 SSRF

---

# 5. RFC 표준 진화: 6749 → 9700 → OAuth 2.1

## 5.1 타임라인

| 연도 | 표준 | Redirect URI 요구사항 |
|------|------|---------------------|
| 2012 | **RFC 6749** | 등록 권장(SHOULD), full URI 등록 시 exact match (조건부) |
| 2017 | **RFC 8252** | 네이티브 앱 loopback 예외, HTTPS 선호, custom scheme 허용 |
| 2023+ | **OAuth 2.1 draft** | Exact string matching 의무화(MUST), 와일드카드 금지, PKCE 필수 |
| 2025.01 | **RFC 9700** (BCP) | Exact matching 확정, open redirector 금지, HTTPS 필수, 종합 보안 가이드 |

## 5.2 RFC 6749 → OAuth 2.1 문구 변화

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RFC 6749 (2012) - 조건부 표현                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "The authorization server SHOULD require all clients to register       │
│   their redirection endpoint..."                                        │
│                                                                         │
│  SHOULD = 권장 (등록하지 않아도 스펙 위반은 아님)                         │
│                                                                         │
│  "If the client registration included the full redirection URI,         │
│   the authorization server MUST compare the two URIs using              │
│   simple string comparison as defined in [RFC3986] Section 6.2.1"       │
│                                                                         │
│  → "full URI를 등록한 경우에만" exact match 적용                         │
│  → 부분 등록, 패턴 등록은 구현체 재량                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  OAuth 2.1 / RFC 9700 (2025) - 의무 표현                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "The authorization server MUST compare the two URIs using              │
│   exact string matching as defined in [RFC3986] Section 6.2.1"          │
│                                                                         │
│  MUST = 필수 (미준수 시 스펙 위반)                                       │
│                                                                         │
│  → 모든 경우에 exact match 적용                                         │
│  → 와일드카드, prefix match 등 불허                                      │
│  → 예외: loopback redirect의 포트 번호만 가변 허용                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5.3 RFC 9700 핵심 요구사항

### Section 2.1: Exact String Matching

RFC 3986 Section 6.2.1에 따른 단순 문자열 비교. 스킴, 호스트, 포트, 경로, 쿼리 파라미터가 **바이트 단위로 정확히 일치**해야 한다.

```
등록: https://app.example.com/callback
요청: https://app.example.com/callback     → 통과
요청: https://app.example.com/callback/    → 거부 (trailing slash)
요청: https://app.example.com/Callback     → 거부 (대소문자)
요청: https://app.example.com/callback?x=1 → 거부 (쿼리 파라미터 추가)
요청: https://APP.EXAMPLE.COM/callback     → 거부 (호스트 대소문자 - 문자열 비교)
```

### Section 4.1.1-4.1.3: 대응 조치

인가 서버가 리다이렉트 응답의 `Location` 헤더 끝에 `#_` (빈 프래그먼트)를 추가하여, 공격자가 프래그먼트를 덧붙여 토큰을 추출하는 것을 방지:

```http
HTTP/1.1 302 Found
Location: https://app.example.com/callback?code=AUTH_CODE&state=xyz#_
                                                                   ^^
                                                   빈 프래그먼트 추가
```

브라우저는 기존 프래그먼트가 있으면 새 프래그먼트를 무시하므로, 공격자가 `#access_token=...`을 덧붙여도 효과가 없다.

### Section 4.1.3: HTTPS 필수

```
MUST:  https://app.example.com/callback         (HTTPS)
MAY:   http://127.0.0.1:{port}/callback         (loopback 예외)
MAY:   http://[::1]:{port}/callback             (IPv6 loopback)
MUST NOT: http://app.example.com/callback       (HTTP 금지)
MUST NOT: http://localhost/callback              (localhost 문자열 금지 - DNS 조작 가능)
```

## 5.4 OAuth 2.1 localhost 포트 가변 예외

네이티브 앱에서 loopback redirect를 사용할 때, **포트 번호만** 등록 시점과 요청 시점에 달라도 된다:

```
등록: http://127.0.0.1/callback            (포트 생략 = 임의 포트 허용)
요청: http://127.0.0.1:52847/callback      → 통과 (포트만 다름)
요청: http://127.0.0.1:38291/callback      → 통과 (포트만 다름)
요청: http://127.0.0.1:52847/other-path    → 거부 (경로 다름)
```

이는 네이티브 앱이 OS에서 사용 가능한 임시 포트(ephemeral port)를 동적으로 할당받기 때문이다.

---

# 6. 플랫폼별 Redirect URI 패턴

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  플랫폼별 Redirect URI 패턴 총정리                       │
├──────────────┬──────────────────────────┬───────────┬───────────────────┤
│ 플랫폼        │ Redirect URI 예시         │ 프로토콜   │ 보안 고려사항      │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ 웹 앱 (서버)  │ https://app.example.com  │ HTTPS     │ full path 등록,   │
│              │ /callback                │ 필수      │ exact match       │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ SPA          │ https://spa.example.com  │ HTTPS     │ PKCE 필수,        │
│              │ /callback                │ 필수      │ BFF 패턴 권장     │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ iOS          │ https://app.example.com  │ HTTPS     │ AASA 파일 필요,   │
│ (Universal   │ /callback                │ (필수)    │ 앱-도메인 검증됨  │
│  Links)      │                          │           │                   │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ iOS          │ myapp://callback         │ Custom    │ 위험: 다른 앱이   │
│ (Custom      │                          │ Scheme    │ 동일 scheme 등록  │
│  Scheme)     │                          │           │ 가능 → 코드 탈취  │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ Android      │ https://app.example.com  │ HTTPS     │ assetlinks.json   │
│ (App Links)  │ /callback                │ (필수)    │ 앱 서명 검증됨    │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ Android      │ myapp://callback         │ Custom    │ 위험: intent      │
│ (Custom      │                          │ Scheme    │ filter 충돌 가능  │
│  Scheme)     │                          │           │                   │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ 데스크톱/CLI  │ http://127.0.0.1:{port}  │ HTTP      │ 기기 밖으로       │
│              │ /callback                │ (허용)    │ 나가지 않음       │
├──────────────┼──────────────────────────┼───────────┼───────────────────┤
│ 헤드리스 기기 │ (redirect URI 없음)       │ -         │ Device Auth Grant │
│ (TV, IoT)    │                          │           │ RFC 8628 사용     │
└──────────────┴──────────────────────────┴───────────┴───────────────────┘
```

## 6.1 웹 앱 (서버 렌더링)

가장 단순하고 안전한 패턴이다. Redirect URI가 서버 엔드포인트를 가리키므로 인가 코드가 서버에서 직접 처리된다.

```
특징:
├── redirect_uri = HTTPS 서버 엔드포인트
├── 인가 코드가 서버에 도달 → client_secret과 함께 토큰 교환
├── 토큰이 브라우저에 노출되지 않음
└── Confidential Client로 분류
```

## 6.2 SPA (Single Page Application)

SPA는 Public Client이므로 client_secret을 보관할 수 없다.

```
SPA의 Redirect URI 처리 흐름:

[방법 1] SPA 직접 처리 (PKCE 필수)
  브라우저 내에서 callback 처리 → 토큰이 브라우저 메모리에 존재
  ├── 장점: 아키텍처 단순
  ├── 단점: XSS로 토큰 탈취 가능
  └── 필수: PKCE (code_challenge + code_verifier)

[방법 2] BFF 패턴 (권장)
  redirect_uri가 BFF 서버를 가리킴 → 토큰이 서버에 보관
  ├── 장점: 토큰이 브라우저에 노출되지 않음
  ├── 단점: BFF 서버 운영 필요
  └── 세부 사항: 11장 참고
```

## 6.3 모바일 앱 (iOS)

### Universal Links (권장)

```
설정 과정:

1. Apple App Site Association (AASA) 파일 배포:
   https://app.example.com/.well-known/apple-app-site-association

   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.com.example.myapp",
           "paths": ["/callback"]
         }
       ]
     }
   }

2. Xcode에서 Associated Domains 설정:
   applinks:app.example.com

3. redirect_uri 등록:
   https://app.example.com/callback

보안:
├── Apple이 AASA 파일과 앱 서명을 검증
├── 다른 앱이 동일 도메인을 claim할 수 없음
└── HTTPS 필수 → 중간자 공격 방지
```

### Custom URI Scheme (위험)

```
myapp://callback

위험 시나리오:
├── 악성 앱이 동일한 myapp:// 스킴을 등록
├── OS가 어느 앱으로 라우팅할지 비결정적 (Android)
│   또는 마지막 설치된 앱 우선 (이전 iOS 버전)
├── 공격자 앱이 인가 코드 수신
└── PKCE가 없으면 공격자가 토큰 교환 가능

결론: Custom URI Scheme 사용 시 PKCE는 절대 필수
      가능하면 Universal Links 사용 권장
```

## 6.4 모바일 앱 (Android)

### App Links (권장)

```
설정 과정:

1. Digital Asset Links 파일 배포:
   https://app.example.com/.well-known/assetlinks.json

   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.example.myapp",
       "sha256_cert_fingerprints": [
         "AB:CD:EF:12:34:56:..."
       ]
     }
   }]

2. AndroidManifest.xml에 intent-filter 설정:
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https"
           android:host="app.example.com"
           android:path="/callback" />
   </intent-filter>

3. redirect_uri 등록:
   https://app.example.com/callback

보안:
├── Google이 assetlinks.json과 앱 서명(SHA256)을 검증
├── autoVerify=true → 사용자 선택 없이 앱으로 직접 라우팅
└── 다른 앱이 동일 도메인을 claim하려면 동일 서명 필요 (불가능)
```

## 6.5 데스크톱/CLI 앱

```
Loopback Redirect 패턴:

1. 앱이 로컬에서 임시 HTTP 서버 시작
   http://127.0.0.1:0/callback  (OS가 빈 포트 할당)
   → 예: http://127.0.0.1:52847/callback

2. 브라우저에서 인가 요청:
   https://auth.example.com/authorize?
     redirect_uri=http://127.0.0.1:52847/callback
     &client_id=cli_app
     &response_type=code
     &code_challenge=...

3. 인증 완료 → 브라우저가 http://127.0.0.1:52847/callback?code=xxx 로 리다이렉트

4. 로컬 HTTP 서버가 코드 수신 → 토큰 교환 → 서버 종료

보안 특성:
├── HTTP 허용: 127.0.0.1은 기기 밖으로 나가지 않음 (네트워크 노출 없음)
├── 포트 가변: OAuth 2.1에서 포트 번호 차이는 허용
├── localhost 금지: "localhost" 문자열 대신 "127.0.0.1" 사용
│   (localhost는 DNS 조작으로 다른 IP를 가리킬 수 있음)
└── PKCE 필수: Public Client이므로
```

## 6.6 헤드리스 기기 (TV, IoT, 스마트 디스플레이)

```
Device Authorization Grant (RFC 8628):

이 플로우에서는 redirect_uri를 사용하지 않는다.
기기에 브라우저가 없거나 입력이 제한되기 때문이다.

┌──────────┐                        ┌──────────────┐
│ 스마트 TV  │── POST /device/code ──▶│  인가 서버    │
│           │◀── device_code,       │              │
│           │    user_code,         │              │
│           │    verification_uri   │              │
└──────┬────┘                        └──────┬───────┘
       │                                    │
       │ 화면에 표시:                         │
       │ "https://auth.example.com/device    │
       │  코드: ABCD-1234"                   │
       │                                    │
       │         ┌──────────┐               │
       │         │ 사용자    │               │
       │         │ (스마트폰) │───────────────┘
       │         └──────────┘
       │           verification_uri 방문
       │           user_code 입력
       │           로그인 + 동의
       │
       │── POST /token (device_code 폴링) ──▶ Access Token 수신
```

---

# 7. Wildcard Redirect URI의 위험성

## 7.1 와일드카드가 위험한 이유

와일드카드 패턴은 관리 편의를 위해 도입되지만, URL 파싱의 복잡성으로 인해 반복적으로 우회된다.

## 7.2 공격 유형

### 공격 1: Glob 패턴 우회

```
등록 패턴: https://*.somesite.example/*

공격자 의도: 패턴을 만족하면서 다른 도메인으로 리다이렉트

공격 URI:
  https://attacker.example/.somesite.example/path

URL 파싱:
  호스트: attacker.example
  경로:  /.somesite.example/path

일부 구현체의 단순 패턴 매칭:
  "*.somesite.example" 부분 문자열이 URI에 포함됨 → 통과
  하지만 실제 호스트는 attacker.example

결론: glob 패턴 매칭은 URL의 구조적 의미를 무시하여 우회 가능
```

### 공격 2: 서브도메인 탈취

```
등록 패턴: https://*.example.com/callback

시나리오:
1. legacy.example.com 서브도메인의 DNS 레코드가 존재
2. 해당 서브도메인의 실제 서비스는 종료됨 (dangling CNAME)
3. 공격자가 해당 클라우드 리소스 이름을 탈취
4. https://legacy.example.com/callback 이 공격자 서버로 연결
5. 와일드카드 패턴에 부합하므로 인가 서버는 허용

방어: 와일드카드 대신 각 서브도메인을 명시적으로 등록
```

### 공격 3: Keycloak CVE 연쇄 (4장 참고)

```
등록 패턴: https://app.example.com/*   (suffix wildcard)

3회 연속 우회:
├── @(at sign) 임베딩        → 패치
├── HTML entity &#x40;       → 패치
└── JWT response mode 우회   → 패치

교훈: 와일드카드 자체를 제거하지 않는 한 우회는 계속된다
```

### 공격 4: Azure 리소스 유기 (4장 참고)

```
등록: https://myapp.azurewebsites.net/callback

Azure App Service 삭제 → DNS는 유지 → 공격자가 이름 탈취
→ exact match로 등록했어도 서브도메인 자체가 탈취됨

이는 와일드카드 문제와 결합 시 더 치명적:
  와일드카드 + 서브도메인 탈취 = 임의의 서브도메인으로 코드 유출
```

## 7.3 안전한 대안

```
┌─────────────────────────────────────────────────────────────────────────┐
│  와일드카드 대신 사용할 수 있는 안전한 대안                                │
├──────────────────────┬──────────────────────────────────────────────────┤
│ 대안                  │ 설명                                            │
├──────────────────────┼──────────────────────────────────────────────────┤
│ 명시적 등록            │ 각 URI를 개별 등록. 가장 안전하지만 관리 비용 증가  │
│ DCR (RFC 7591)        │ API로 자동 등록. 임시 환경에 적합                 │
│ Redirect Proxy        │ 단일 고정 URI로 수신 후 내부적으로 라우팅           │
│ PAR (RFC 9126)        │ redirect_uri를 back-channel로 전송하여 변조 방지  │
│ Environment Handles   │ 사전 정의된 환경 풀(env-1~env-10)을 돌려 사용     │
└──────────────────────┴──────────────────────────────────────────────────┘
```

---

# 8. PKCE: 코드 가로채기 방어

## 8.1 개요

**PKCE (Proof Key for Code Exchange, RFC 7636)**는 인가 코드 가로채기 공격을 방어하는 메커니즘이다. 원래 Public Client(모바일 앱)를 위해 설계되었으나, **OAuth 2.1에서는 모든 클라이언트(Confidential 포함)에 필수**로 확대되었다.

## 8.2 PKCE 플로우 상세

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PKCE 상세 플로우                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [단계 1] 클라이언트: code_verifier 생성                                  │
│  ──────────────────────────────────────                                 │
│  code_verifier = 43~128자의 cryptographically random 문자열              │
│                                                                         │
│  예: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk                       │
│                                                                         │
│  [단계 2] 클라이언트: code_challenge 유도                                 │
│  ──────────────────────────────────────                                 │
│  code_challenge = BASE64URL( SHA256( code_verifier ) )                  │
│                                                                         │
│  예: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM                       │
│                                                                         │
│  [단계 3] 인가 요청에 code_challenge 포함                                │
│  ──────────────────────────────────────                                 │
│  GET /authorize?                                                        │
│    response_type=code                                                   │
│    &client_id=app123                                                    │
│    &redirect_uri=https://app.example.com/callback                       │
│    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM         │
│    &code_challenge_method=S256          ◀── SHA256 방식 명시             │
│    &state=abc                                                           │
│                                                                         │
│  인가 서버: code_challenge를 인가 코드와 함께 저장                        │
│                                                                         │
│  [단계 4] 사용자 인증 → 인가 코드 발급                                    │
│  ──────────────────────────────────────                                 │
│  302 Location: https://app.example.com/callback?code=AUTH_CODE&state=abc│
│                                                                         │
│  ┌──────────────────────────────────────────────────────┐               │
│  │ 이 시점에서 공격자가 코드를 가로챌 수 있다             │               │
│  │ (악성 앱, 네트워크 스니핑, custom scheme 탈취 등)      │               │
│  │ 하지만 code_verifier를 모르므로 토큰 교환 불가!        │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                         │
│  [단계 5-A] 정당한 클라이언트: 토큰 요청 (성공)                           │
│  ──────────────────────────────────────────                             │
│  POST /token                                                            │
│    grant_type=authorization_code                                        │
│    &code=AUTH_CODE                                                      │
│    &redirect_uri=https://app.example.com/callback                       │
│    &code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk         │
│                   ▲                                                     │
│                   └── 원본 code_verifier 전송                            │
│                                                                         │
│  인가 서버 검증:                                                         │
│    SHA256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")               │
│    = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM                       │
│    == 저장된 code_challenge? ✅ 일치 → 토큰 발급                         │
│                                                                         │
│  [단계 5-B] 공격자: 토큰 요청 (실패)                                     │
│  ──────────────────────────────────────                                 │
│  POST /token                                                            │
│    grant_type=authorization_code                                        │
│    &code=AUTH_CODE (가로챈 코드)                                         │
│    &code_verifier=attacker_random_guess                                 │
│                   ▲                                                     │
│                   └── code_verifier를 모르므로 추측                      │
│                                                                         │
│  인가 서버 검증:                                                         │
│    SHA256("attacker_random_guess")                                      │
│    ≠ E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM                       │
│    ❌ 불일치 → 토큰 거부                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8.3 코드 예시

```javascript
// Node.js: PKCE code_verifier / code_challenge 생성
const crypto = require('crypto');

// 1. code_verifier 생성 (43-128자 랜덤)
function generateCodeVerifier() {
  return crypto.randomBytes(32)
    .toString('base64url');  // 43자
}

// 2. code_challenge 생성 (SHA256 + Base64URL)
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

// 3. 인가 요청 URL 구성
const authUrl = new URL('https://auth.example.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', 'my_app');
authUrl.searchParams.set('redirect_uri', 'https://app.example.com/callback');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));

// 4. codeVerifier를 안전하게 저장 (세션 등)
//    토큰 교환 시 사용
```

## 8.4 PKCE가 보호하지 못하는 것

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PKCE의 보호 범위와 한계                                                 │
├──────────────────────────┬──────────────────────────────────────────────┤
│ PKCE가 방어하는 것        │ PKCE가 방어하지 못하는 것                     │
├──────────────────────────┼──────────────────────────────────────────────┤
│ 인가 코드 가로채기         │ 피싱 (사용자가 가짜 인가 서버에 인증)          │
│ (네트워크 스니핑)          │                                              │
├──────────────────────────┼──────────────────────────────────────────────┤
│ Custom scheme 탈취        │ XSS (클라이언트 앱 내 스크립트 삽입으로       │
│ (다른 앱이 동일 scheme)    │ 토큰 직접 탈취)                              │
├──────────────────────────┼──────────────────────────────────────────────┤
│ 인가 코드 재사용           │ Open Redirector (클라이언트 측 리다이렉트로   │
│ (일회용 보장)              │ Referer를 통한 코드 유출)                    │
├──────────────────────────┼──────────────────────────────────────────────┤
│ 코드 주입 공격             │ 토큰 탈취 후 재사용 (DPoP로 방어)            │
│ (다른 세션의 코드 주입)     │                                              │
└──────────────────────────┴──────────────────────────────────────────────┘

결론: PKCE는 "심층 방어(defense in depth)"의 한 계층이다.
      redirect_uri 검증, HTTPS, state 파라미터 등과 함께 사용해야 한다.
```

---

# 9. PAR (Pushed Authorization Requests)

## 9.1 개요

**PAR (RFC 9126)**는 인가 요청 파라미터를 **브라우저 URL이 아닌 서버 간 통신(back-channel)**으로 전송하는 메커니즘이다. 이를 통해 `redirect_uri`를 포함한 모든 파라미터가 사용자 에이전트(브라우저)를 거치지 않으므로 변조를 원천 차단한다.

## 9.2 PAR 플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PAR 2단계 플로우                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [단계 1] Back-channel: 클라이언트 → 인가 서버 (서버 간 통신)             │
│  ────────────────────────────────────────────────────────               │
│                                                                         │
│  POST /par HTTP/1.1                                                     │
│  Host: auth.example.com                                                 │
│  Content-Type: application/x-www-form-urlencoded                        │
│  Authorization: Basic czZCaGRSa3F0MzpnWDFmQmF0M2JW  ◀── 클라이언트 인증│
│                                                                         │
│  response_type=code                                                     │
│  &client_id=app123                                                      │
│  &redirect_uri=https://app.example.com/callback                         │
│  &scope=openid profile                                                  │
│  &state=abc                                                             │
│  &code_challenge=E9Melhoa...                                            │
│  &code_challenge_method=S256                                            │
│                                                                         │
│  ── 인가 서버 처리 ──                                                    │
│  ├── 클라이언트 인증 확인 ✅                                              │
│  ├── redirect_uri가 등록된 URI와 일치하는지 검증 ✅                       │
│  ├── 모든 파라미터 검증 및 저장                                           │
│  └── 불투명한 request_uri 발급                                           │
│                                                                         │
│  응답:                                                                   │
│  HTTP/1.1 201 Created                                                   │
│  {                                                                      │
│    "request_uri": "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014l│
│  tc14eY22c",                                                            │
│    "expires_in": 60                                                     │
│  }                                                                      │
│                                                                         │
│  [단계 2] Front-channel: 브라우저를 인가 엔드포인트로 리다이렉트           │
│  ────────────────────────────────────────────────────────               │
│                                                                         │
│  GET /authorize?                                                        │
│    client_id=app123                                                     │
│    &request_uri=urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc │
│  14eY22c                                                                │
│                                                                         │
│  브라우저 URL에는 request_uri(불투명 참조)만 노출                         │
│  → redirect_uri, scope, state 등이 URL에 보이지 않음                     │
│  → 사용자나 공격자가 파라미터를 변조할 수 없음                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 9.3 PAR의 보안 이점

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PAR 보안 이점 상세                                                      │
├──────────────────────┬──────────────────────────────────────────────────┤
│ 보안 이점             │ 설명                                            │
├──────────────────────┼──────────────────────────────────────────────────┤
│ redirect_uri 변조 방지│ 브라우저 URL에 redirect_uri가 노출되지 않으므로   │
│                      │ 사용자 에이전트에서 변조 불가                     │
├──────────────────────┼──────────────────────────────────────────────────┤
│ 클라이언트 인증        │ PAR 엔드포인트에서 클라이언트 인증 수행            │
│                      │ (client_secret, mTLS 등)                        │
│                      │ → 인증되지 않은 클라이언트의 요청 거부             │
├──────────────────────┼──────────────────────────────────────────────────┤
│ 파라미터 무결성        │ 모든 파라미터가 서버에 저장되므로                  │
│                      │ 브라우저 확장, 프록시 등의 조작 불가               │
├──────────────────────┼──────────────────────────────────────────────────┤
│ URL 길이 제한 회피    │ 복잡한 파라미터(scope, claims 등)도               │
│                      │ POST body로 전송 → URL 길이 제한 없음            │
├──────────────────────┼──────────────────────────────────────────────────┤
│ 로그 노출 방지        │ access log, Referer 헤더 등에                    │
│                      │ 민감 파라미터가 기록되지 않음                     │
└──────────────────────┴──────────────────────────────────────────────────┘
```

## 9.4 코드 예시

```javascript
// PAR 요청 (Node.js)
const response = await fetch('https://auth.example.com/par', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  },
  body: new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: 'https://app.example.com/callback',
    scope: 'openid profile',
    state: generateState(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })
});

const { request_uri, expires_in } = await response.json();

// 브라우저를 인가 엔드포인트로 리다이렉트 (request_uri만 포함)
const authUrl = `https://auth.example.com/authorize?client_id=${clientId}&request_uri=${encodeURIComponent(request_uri)}`;
res.redirect(authUrl);
```

---

# 10. Dynamic Client Registration (RFC 7591)

## 10.1 개요

**DCR (Dynamic Client Registration)**은 OAuth 클라이언트를 API 호출로 자동 등록하는 메커니즘이다. Redirect URI를 포함한 클라이언트 메타데이터를 프로그래밍 방식으로 등록하므로, 관리 콘솔에서 수동 입력하는 번거로움을 제거한다.

## 10.2 등록 요청/응답

```http
POST /register HTTP/1.1
Host: auth.example.com
Content-Type: application/json
Authorization: Bearer initial_access_token_abc123

{
  "client_name": "Ephemeral PR Preview #142",
  "redirect_uris": [
    "https://pr-142.preview.example.com/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_basic",
  "scope": "openid profile"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "client_id": "dyn_client_7f3a9b2e",
  "client_secret": "s3cr3t_...",
  "client_id_issued_at": 1709654400,
  "client_secret_expires_at": 1709740800,
  "redirect_uris": [
    "https://pr-142.preview.example.com/callback"
  ],
  "registration_access_token": "reg_token_...",
  "registration_client_uri": "https://auth.example.com/register/dyn_client_7f3a9b2e"
}
```

## 10.3 DCR로 커플링 감소

| 항목 | 수동 등록 (기존) | DCR (자동화) |
|------|----------------|-------------|
| 등록 방식 | 관리 콘솔에서 수동 입력 또는 티켓 요청 | API POST 호출 |
| 관리자 개입 | 필요 (사람이 승인/입력) | 불필요 (자동화) |
| 소요 시간 | 분~일 (승인 절차에 따라) | 밀리초 (API 호출) |
| 임시 환경 대응 | 비현실적 (PR마다 수동 등록?) | 자동화 가능 (CI/CD 파이프라인) |
| URI 정리 | 수동 삭제 필요 (잊기 쉬움) | TTL 설정 또는 자동 해제 |
| 멀티테넌트 온보딩 | 테넌트마다 수동 클라이언트 생성 | 테넌트 가입 시 자동 생성 |

## 10.4 보안 고려사항

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DCR 보안 고려사항                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Initial Access Token (IAT)                                          │
│  ├── /register 엔드포인트를 아무나 호출하면 안 됨                         │
│  ├── IAT를 발급받은 클라이언트만 등록 가능                                │
│  └── IAT에 scope/권한 제한 적용 (등록 가능한 grant_type 제한 등)          │
│                                                                         │
│  2. 정책 검증 (Policy Validation)                                        │
│  ├── redirect_uri에 와일드카드 포함 여부 검증                             │
│  ├── HTTPS 강제                                                         │
│  ├── 허용된 도메인 화이트리스트 적용                                      │
│  └── 등록 가능한 grant_type/response_type 제한                           │
│                                                                         │
│  3. Rate Limiting                                                       │
│  ├── 동일 IAT로 무제한 클라이언트 생성 방지                               │
│  ├── IP 기반 속도 제한                                                   │
│  └── 동시 활성 클라이언트 수 제한                                         │
│                                                                         │
│  4. 클라이언트 만료                                                      │
│  ├── client_secret_expires_at 설정                                      │
│  ├── 미사용 클라이언트 자동 비활성화                                      │
│  └── 주기적 감사 및 정리                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 10.5 RFC 7592: 등록 관리

DCR로 생성된 클라이언트의 메타데이터를 업데이트하거나 삭제하는 프로토콜이다.

```http
# redirect_uri 업데이트
PUT /register/dyn_client_7f3a9b2e HTTP/1.1
Host: auth.example.com
Authorization: Bearer reg_token_...
Content-Type: application/json

{
  "client_id": "dyn_client_7f3a9b2e",
  "redirect_uris": [
    "https://pr-142-v2.preview.example.com/callback"
  ]
}

# 클라이언트 삭제 (환경 종료 시)
DELETE /register/dyn_client_7f3a9b2e HTTP/1.1
Host: auth.example.com
Authorization: Bearer reg_token_...
```

---

# 11. BFF 패턴과 Redirect URI

## 11.1 전통적 SPA vs BFF 비교

```
┌─────────────────────────────────────────────────────────────────────────┐
│  전통적 SPA: 토큰이 브라우저에 존재                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐                       │
│  │ 브라우저   │───▶│ 인가 서버 │───▶│ 브라우저      │                       │
│  │ (SPA)    │    │          │    │ /callback    │                       │
│  └──────────┘    └──────────┘    └──────┬───────┘                       │
│                                         │                               │
│                                  code를 브라우저에서 수신                 │
│                                  브라우저가 /token 호출                   │
│                                  Access Token이 브라우저 메모리에 저장    │
│                                         │                               │
│                                  ┌──────▼───────┐                       │
│                                  │ 리소스 서버    │                       │
│                                  │ (API)         │                       │
│                                  └──────────────┘                       │
│                                                                         │
│  문제점:                                                                 │
│  ├── XSS 공격 시 Access Token 탈취 가능                                  │
│  ├── client_secret 사용 불가 (Public Client)                             │
│  └── Refresh Token을 브라우저에 저장하면 장기 토큰 노출                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  BFF 패턴: 토큰이 서버에 존재                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ 브라우저   │───▶│ 인가 서버 │───▶│ BFF 서버     │───▶│ 리소스 서버   │   │
│  │ (SPA)    │    │          │    │ /callback    │    │ (API)        │   │
│  └──────────┘    └──────────┘    └──────────────┘    └──────────────┘   │
│                                         │                               │
│                                  redirect_uri = BFF 서버                 │
│                                  code를 서버에서 수신                     │
│                                  서버가 /token 호출 (+ client_secret)    │
│                                  Access Token이 서버 세션에 저장          │
│                                  브라우저에는 HttpOnly 세션 쿠키만 전달   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 11.2 비교 표

| 항목 | 전통적 SPA | BFF 패턴 |
|------|-----------|---------|
| **Access Token 위치** | 브라우저 메모리 / localStorage | BFF 서버 세션 |
| **Redirect URI 대상** | SPA의 클라이언트 경로 | BFF 서버 엔드포인트 |
| **XSS 영향** | Access Token 직접 탈취 가능 | 세션 쿠키만 노출 (HttpOnly 설정 시 JS 접근 불가) |
| **Client Secret** | 사용 불가 (Public Client) | 사용 가능 (Confidential Client) |
| **Refresh Token** | 브라우저에 노출 위험 | 서버에 안전하게 보관 |
| **CORS 설정** | API 서버에 SPA 도메인 허용 필요 | BFF가 API 프록시 역할 → CORS 불필요 |
| **구현 복잡도** | 낮음 | 높음 (BFF 서버 운영 필요) |

## 11.3 BFF + PAR + PKCE: 최대 보안 조합

```
┌─────────────────────────────────────────────────────────────────────────┐
│  최대 보안 스택: BFF + PAR + PKCE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. BFF 서버가 code_verifier 생성 (PKCE)                                │
│  2. BFF 서버가 PAR 엔드포인트에 요청 (back-channel, 클라이언트 인증)      │
│     → redirect_uri, code_challenge 등 모든 파라미터가 서버 간 통신        │
│  3. PAR 응답의 request_uri로 브라우저 리다이렉트                         │
│  4. 사용자 인증 완료 → code가 BFF 서버로 전달                             │
│  5. BFF 서버가 code + code_verifier로 토큰 교환                          │
│  6. 토큰은 서버에 보관, 브라우저에는 HttpOnly 쿠키만 전달                  │
│                                                                         │
│  이 조합의 방어 범위:                                                    │
│  ├── PAR → redirect_uri 변조 방지, 파라미터 무결성                       │
│  ├── PKCE → 코드 가로채기 방어 (만일의 경우 대비)                         │
│  ├── BFF → 토큰 브라우저 노출 방지, XSS 영향 최소화                      │
│  ├── client_secret → 인가되지 않은 토큰 교환 방지                        │
│  └── HttpOnly Cookie → JavaScript로 세션 쿠키 접근 불가                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 12. 환경별 Redirect URI 관리 전략

## 12.1 표준 멀티 환경 (명시적 등록)

가장 단순한 방법이다. 각 환경의 redirect URI를 모두 명시적으로 등록한다.

```json
{
  "client_id": "my_app",
  "redirect_uris": [
    "https://app.example.com/callback",
    "https://staging.example.com/callback",
    "https://dev.example.com/callback",
    "http://localhost:3000/callback"
  ]
}
```

장점: 단순하고 안전하다.
단점: 환경 추가 시마다 수동 등록 필요.

## 12.2 환경변수 패턴

코드에 redirect URI를 하드코딩하지 않고, 환경변수로 주입한다.

```bash
# .env.development
OAUTH_REDIRECT_URI=http://localhost:3000/callback
OAUTH_CLIENT_ID=dev_client_id

# .env.staging
OAUTH_REDIRECT_URI=https://staging.example.com/callback
OAUTH_CLIENT_ID=staging_client_id

# .env.production
OAUTH_REDIRECT_URI=https://app.example.com/callback
OAUTH_CLIENT_ID=prod_client_id
```

```javascript
// 환경변수에서 redirect_uri 읽기
const redirectUri = process.env.OAUTH_REDIRECT_URI;

const authUrl = new URL('https://auth.example.com/authorize');
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID);
```

## 12.3 Spring Boot 프로필 패턴

```yaml
# application-dev.yml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            redirect-uri: "{baseUrl}/login/oauth2/code/{registrationId}"
            #              ^^^^^^^^  ^^^^^^^^^^^^^^^^^^
            #              서버 주소   "google" (등록 이름)
            #
            # 개발: http://localhost:8080/login/oauth2/code/google
            # 운영: https://app.example.com/login/oauth2/code/google
            #
            # {baseUrl}은 Spring이 현재 서버 주소로 자동 치환
            scope:
              - openid
              - profile
              - email
```

```yaml
# application-prod.yml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID_PROD}
            client-secret: ${GOOGLE_CLIENT_SECRET_PROD}
            redirect-uri: "{baseUrl}/login/oauth2/code/{registrationId}"
```

Spring Boot의 `{baseUrl}` 템플릿 변수는 현재 서버의 scheme + host + port를 자동으로 대체한다. 코드 변경 없이 환경별 redirect URI가 달라진다.

## 12.4 임시 환경 (PR Preview, Feature Branch)

PR마다 동적으로 생성되는 환경에서는 redirect URI를 미리 등록할 수 없다.

### 방법 A: Environment Handles (환경 핸들 풀)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Environment Handles 패턴                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  사전 등록: env-1 ~ env-10 까지 10개의 redirect URI를 미리 등록          │
│                                                                         │
│  redirect_uris:                                                         │
│    - https://env-1.preview.example.com/callback                         │
│    - https://env-2.preview.example.com/callback                         │
│    - ...                                                                │
│    - https://env-10.preview.example.com/callback                        │
│                                                                         │
│  CI/CD 파이프라인:                                                       │
│  1. PR 생성 → 사용 가능한 핸들 할당 (예: env-3)                          │
│  2. DNS 레코드 설정: env-3.preview.example.com → PR 환경 IP              │
│  3. 앱 배포 시 OAUTH_REDIRECT_URI=https://env-3.preview.example.com/... │
│  4. PR 종료 → 핸들 반환 (env-3 다시 사용 가능)                           │
│                                                                         │
│  장점: 와일드카드 불필요, exact match 유지                                │
│  단점: 동시 PR 수가 풀 크기로 제한됨                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 방법 B: DCR 자동화

```yaml
# GitHub Actions 예시: PR 환경 자동 등록
name: PR Preview OAuth Setup
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  setup-oauth:
    runs-on: ubuntu-latest
    steps:
      - name: Register OAuth Client via DCR
        run: |
          RESPONSE=$(curl -s -X POST \
            https://auth.example.com/register \
            -H "Authorization: Bearer ${{ secrets.DCR_ACCESS_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "client_name": "PR-${{ github.event.number }}",
              "redirect_uris": [
                "https://pr-${{ github.event.number }}.preview.example.com/callback"
              ],
              "grant_types": ["authorization_code"],
              "token_endpoint_auth_method": "client_secret_basic"
            }')

          echo "CLIENT_ID=$(echo $RESPONSE | jq -r .client_id)" >> $GITHUB_ENV
          echo "CLIENT_SECRET=$(echo $RESPONSE | jq -r .client_secret)" >> $GITHUB_ENV
```

### 방법 C: OAuth Callback Proxy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OAuth Callback Proxy 패턴                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  등록된 redirect_uri (단 하나):                                          │
│    https://oauth-proxy.example.com/callback                             │
│                                                                         │
│  플로우:                                                                │
│  1. PR 환경에서 인가 요청 시 state에 환경 정보 인코딩:                    │
│     state = base64({ "env": "pr-142", "csrf": "random123" })            │
│                                                                         │
│  2. 인가 서버 → https://oauth-proxy.example.com/callback?code=...       │
│                                                                         │
│  3. Proxy가 state 디코딩 → env="pr-142" 확인                            │
│     → 내부적으로 https://pr-142.preview.example.com/callback 로 전달    │
│                                                                         │
│  보안 주의:                                                              │
│  ├── Proxy 자체가 open redirector가 되지 않도록                          │
│  │   허용된 환경 목록(화이트리스트)으로 라우팅 제한                        │
│  ├── state 파라미터 변조 방지 (HMAC 서명 등)                             │
│  └── Proxy ↔ 실제 환경 간 통신은 내부 네트워크로 제한                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 13. 대형 서비스의 Redirect URI 정책

## 13.1 Google

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Google OAuth Redirect URI 정책                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  엄격한 제한 사항:                                                       │
│  ├── 와일드카드 전면 금지 (도메인, 경로 모두)                              │
│  ├── HTTPS 강제 (2025년 1월부터 테스트 환경도 HTTPS 필수)                  │
│  ├── Raw IP 주소 사용 금지 (127.0.0.1 loopback 예외)                    │
│  ├── Path traversal 거부 (/../ 포함 URI 거부)                           │
│  ├── userinfo 구성요소 금지 (user:pass@host 형태 거부)                   │
│  ├── Fragment(#) 포함 금지                                              │
│  ├── NULL 문자(\0) 포함 금지                                            │
│  └── 등록 시 URI 접근 가능 여부 검증                                     │
│                                                                         │
│  허용되는 패턴:                                                          │
│  ├── https://app.example.com/callback        (웹 앱)                    │
│  ├── http://localhost:PORT/callback           (로컬 개발)               │
│  ├── urn:ietf:wg:oauth:2.0:oob               (OOB - deprecated)       │
│  └── com.example.myapp:/callback              (모바일 custom scheme)    │
│                                                                         │
│  Google Cloud Console:                                                  │
│  ├── APIs & Services > Credentials > OAuth 2.0 Client IDs              │
│  ├── "Authorized redirect URIs" 필드에 직접 입력                         │
│  └── 최대 100개 redirect URI 등록 가능                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 13.2 GitHub

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GitHub OAuth Redirect URI 정책                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  설정 위치:                                                              │
│  Settings > Developer settings > OAuth Apps > "Authorization            │
│  callback URL"                                                          │
│                                                                         │
│  특징:                                                                   │
│  ├── Exact string matching 적용                                         │
│  ├── 하나의 OAuth App에 하나의 callback URL만 등록 가능                   │
│  ├── 환경별로 별도 OAuth App 생성 필요                                    │
│  └── GitHub Apps는 복수 redirect URI 지원                                │
│                                                                         │
│  GitHub Apps (권장):                                                     │
│  ├── Settings > Developer settings > GitHub Apps                        │
│  ├── "Callback URL" 필드에 복수 URI 등록 가능                            │
│  ├── setup URL, webhook URL 별도 관리                                   │
│  └── 세분화된 권한 모델 (organization, repository 단위)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 13.3 Auth0

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Auth0 Redirect URI 정책                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  설정 위치:                                                              │
│  Dashboard > Applications > Settings > "Allowed Callback URLs"          │
│                                                                         │
│  특징:                                                                   │
│  ├── 쉼표로 구분하여 복수 URI 등록                                       │
│  ├── 엄격한 검증 (scheme, host, path, query 모두 검사)                   │
│  ├── 와일드카드 미지원 (정확한 URI만 허용)                                │
│  ├── localhost 허용 (개발 환경)                                          │
│  └── 멀티테넌트: {organization_name} 플레이스홀더 지원                   │
│      (자유 와일드카드가 아닌 조직 이름으로 제한된 변수 치환)                │
│                                                                         │
│  Auth0 Organizations 멀티테넌트 예시:                                    │
│  ├── 등록: https://{organization_name}.app.example.com/callback         │
│  ├── 실제: https://acme-corp.app.example.com/callback                   │
│  ├── 실제: https://globex-inc.app.example.com/callback                  │
│  └── 조직 목록에 없는 이름은 거부됨 (임의 서브도메인 불가)                 │
│                                                                         │
│  Allowed Logout URLs / Allowed Web Origins 별도 관리:                    │
│  ├── Redirect URI와 별개로 로그아웃 URL 화이트리스트 필요                  │
│  └── CORS 허용 도메인도 별도 설정                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 13.4 Okta

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Okta Redirect URI 정책                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  설정 위치:                                                              │
│  Admin Console > Applications > Sign-in redirect URIs                   │
│                                                                         │
│  특징:                                                                   │
│  ├── 애플리케이션별 redirect URI 등록                                     │
│  ├── 와일드카드 서브도메인 미지원                                         │
│  ├── Exact match 적용                                                    │
│  ├── Sign-in redirect URI ≠ Sign-out redirect URI (별도 관리)           │
│  └── Trusted Origins ≠ Redirect URI (혼동 주의)                         │
│                                                                         │
│  Trusted Origins vs Redirect URI:                                       │
│  ├── Trusted Origins: CORS, 리다이렉트 허용 도메인 (보안 정책)           │
│  ├── Redirect URI: OAuth callback 전용 (인가 코드 수신 주소)             │
│  └── 두 설정은 독립적이며 각각 등록 필요                                  │
│                                                                         │
│  Custom Authorization Server:                                           │
│  ├── default authorization server: /oauth2/default/v1/authorize         │
│  ├── custom: /oauth2/{authServerId}/v1/authorize                        │
│  └── 각 authorization server별로 정책 독립 적용                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 13.5 Microsoft Entra ID (구 Azure AD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Microsoft Entra ID Redirect URI 정책                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  설정 위치:                                                              │
│  Azure Portal > App registrations > Authentication > Redirect URIs      │
│                                                                         │
│  제한 사항:                                                              │
│  ├── 와일드카드에 대한 명시적 경고                                        │
│  │   "Wildcard redirect URIs are not supported"                         │
│  ├── 앱당 최대 256개 redirect URI 등록 가능                              │
│  ├── URI 최대 길이: 256자                                                │
│  └── 플랫폼별 제한:                                                      │
│      ├── Web: HTTPS 필수, localhost 예외                                 │
│      ├── SPA: HTTPS 필수, 별도 플랫폼 유형으로 등록                      │
│      ├── Mobile/Desktop: custom scheme, msalXXXX:// 허용                │
│      └── 각 플랫폼 유형별로 지원하는 URI 형식이 다름                      │
│                                                                         │
│  플랫폼 유형별 URI 패턴:                                                 │
│  ├── Web:                                                               │
│  │   https://app.example.com/callback                                   │
│  │   http://localhost:PORT/callback                                     │
│  ├── SPA:                                                               │
│  │   https://spa.example.com/callback                                   │
│  │   (implicit flow 비권장 → authorization code + PKCE 권장)            │
│  ├── iOS/macOS:                                                         │
│  │   msauth.{bundle-id}://auth                                          │
│  └── Android:                                                           │
│  │   msauth://{package-name}/{signature-hash}                           │
│                                                                         │
│  Multi-tenant 앱:                                                        │
│  ├── /common 엔드포인트로 모든 테넌트 지원                                │
│  ├── redirect URI는 앱 등록에 한 번만 설정                                │
│  └── 테넌트별 redirect URI 분리 불필요                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 13.6 대형 서비스 정책 비교 요약

| 항목 | Google | GitHub | Auth0 | Okta | Microsoft Entra ID |
|------|--------|--------|-------|------|--------------------|
| 와일드카드 | 금지 | 금지 | 금지 | 금지 | 금지 (명시적 경고) |
| HTTPS 강제 | 필수 (테스트 포함) | 권장 | 권장 | 권장 | 필수 (localhost 예외) |
| 최대 URI 수 | ~100 | 1 (OAuth App) / N (GitHub App) | 제한 없음 | 제한 없음 | 256 |
| Exact Match | 필수 | 필수 | 필수 | 필수 | 필수 |
| 멀티테넌트 | - | - | {organization_name} | Custom Auth Server | /common 엔드포인트 |
| DCR 지원 | OIDC Discovery | 미지원 | 관리 API | OAuth API | Microsoft Graph API |

---

# 14. 실전 보안 체크리스트

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 OAuth Redirect URI 보안 체크리스트                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ── 기본 보안 ──                                                        │
│                                                                         │
│  [ ] Redirect URI는 HTTPS를 사용하는가?                                  │
│      (loopback 127.0.0.1만 HTTP 예외)                                   │
│                                                                         │
│  [ ] Exact string matching으로 등록했는가?                                │
│      (trailing slash, 대소문자, query parameter 차이 없이 정확히 일치)    │
│                                                                         │
│  [ ] 와일드카드를 사용하지 않는가?                                        │
│      (도메인 와일드카드, 경로 와일드카드 모두 금지)                        │
│                                                                         │
│  [ ] state 파라미터로 CSRF를 방어하는가?                                  │
│      (cryptographically random, 세션에 바인딩)                           │
│                                                                         │
│  ── 코드 교환 보안 ──                                                    │
│                                                                         │
│  [ ] PKCE를 모든 클라이언트에 적용했는가?                                  │
│      (Public + Confidential 모두, OAuth 2.1 요구사항)                    │
│                                                                         │
│  [ ] code_challenge_method=S256을 사용하는가?                            │
│      (plain 방식은 보안 이점 없음)                                       │
│                                                                         │
│  [ ] 인가 코드를 1회만 사용하고 즉시 폐기하는가?                           │
│      (재사용 시 해당 코드로 발급된 모든 토큰 취소)                         │
│                                                                         │
│  ── 고급 보안 ──                                                        │
│                                                                         │
│  [ ] PAR를 사용하여 파라미터를 back-channel로 보내는가?                    │
│      (redirect_uri가 브라우저 URL에 노출되지 않도록)                      │
│                                                                         │
│  [ ] Redirect URI 경로에 open redirector가 없는가?                       │
│      (/callback?next=, /callback?returnTo= 등의 파라미터 제거)           │
│                                                                         │
│  [ ] Location 헤더에 #_ (빈 프래그먼트)를 추가하는가?                     │
│      (프래그먼트 주입 공격 방지, RFC 9700 권장)                           │
│                                                                         │
│  ── 모바일 보안 ──                                                      │
│                                                                         │
│  [ ] iOS: Universal Links를 사용하는가?                                  │
│      (custom scheme 대신 HTTPS Universal Links 사용)                     │
│                                                                         │
│  [ ] Android: App Links를 사용하는가?                                    │
│      (autoVerify=true + assetlinks.json 설정)                           │
│                                                                         │
│  [ ] custom URI scheme 사용 시 PKCE를 반드시 적용했는가?                  │
│                                                                         │
│  ── 아키텍처 보안 ──                                                    │
│                                                                         │
│  [ ] BFF 패턴으로 토큰을 서버에 보관하는가?                               │
│      (SPA에서 토큰이 브라우저에 노출되지 않도록)                           │
│                                                                         │
│  [ ] Dynamic Client Registration으로                                    │
│      ephemeral 환경을 자동화하는가?                                      │
│      (PR preview 등 동적 환경에서 와일드카드 대신 DCR 사용)               │
│                                                                         │
│  ── 운영 보안 ──                                                        │
│                                                                         │
│  [ ] 환경별 redirect URI를 환경변수로 관리하는가?                          │
│      (코드에 하드코딩하지 않음)                                           │
│                                                                         │
│  [ ] 사용하지 않는 redirect URI를 정리했는가?                              │
│      (subdomain takeover 방지, dangling DNS 점검)                       │
│                                                                         │
│  [ ] 정기적으로 등록된 redirect URI의 유효성을 감사하는가?                  │
│      (DNS 해석 확인, 소유권 확인)                                        │
│                                                                         │
│  [ ] 클라이언트 등록 정보를 버전 관리하는가?                               │
│      (IaC: Terraform, Pulumi 등으로 관리)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 15. 키워드 색인

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           키워드 색인 (가나다/ABC순)                          │
├──────────────────────────────────┬────────────────────────────────────────────┤
│ 키워드                           │ 관련 섹션                                  │
├──────────────────────────────────┼────────────────────────────────────────────┤
│ @(at sign) 임베딩                │ 4.2, 7.2                                  │
│ App Links (Android)              │ 1, 6.4                                    │
│ Auth0                            │ 13.3                                      │
│ Authorization Code               │ 1, 2.2                                    │
│ Authorization Endpoint           │ 1, 2.2                                    │
│ Azure Subdomain Takeover         │ 4.2, 7.2                                  │
│ BASE64URL                        │ 8.2, 8.3                                  │
│ BFF (Backend for Frontend)       │ 1, 3.2, 6.2, 11                          │
│ callback URL                     │ 1, 2.1                                    │
│ CI/CD                            │ 10.3, 12.4                                │
│ Client Secret                    │ 2.2, 9.2, 11.2                            │
│ Code Challenge                   │ 1, 8.2                                    │
│ Code Verifier                    │ 1, 8.2                                    │
│ Confidential Client              │ 1, 6.1, 11.2                              │
│ CORS                             │ 11.2                                      │
│ CSRF                             │ 14                                        │
│ Custom URI Scheme                │ 1, 6.3, 6.4                               │
│ CVE-2023-6134                    │ 4.2                                       │
│ CVE-2023-6291                    │ 4.2                                       │
│ CVE-2023-6927                    │ 4.2                                       │
│ Dangling DNS                     │ 4.2, 7.2, 14                              │
│ DCR (Dynamic Client Registration)│ 1, 7.3, 10, 12.4                         │
│ Defense in Depth                 │ 8.4                                       │
│ Device Authorization Grant       │ 1, 6.6                                    │
│ Digital Asset Links              │ 6.4                                       │
│ DPoP                             │ 8.4                                       │
│ Environment Handle               │ 1, 7.3, 12.4                              │
│ Ephemeral Port                   │ 5.4, 6.5                                  │
│ Exact String Matching            │ 1, 5.2, 5.3                               │
│ Fragment (#)                     │ 5.3                                       │
│ GitHub                           │ 13.2                                      │
│ Google                           │ 13.1                                      │
│ HMAC                             │ 12.4                                      │
│ HTML Entity Encoding             │ 4.2                                       │
│ HttpOnly Cookie                  │ 11.1, 11.3                                │
│ HTTPS                            │ 5.3, 6, 14                                │
│ IaC (Infrastructure as Code)     │ 14                                        │
│ Initial Access Token             │ 10.4                                      │
│ Intent Filter (Android)          │ 6.4                                       │
│ JWT Response Mode                │ 4.2                                       │
│ Keycloak                         │ 4.2, 7.2                                  │
│ localhost                        │ 5.3, 5.4, 6.5                             │
│ Loopback Redirect                │ 1, 5.4, 6.5                               │
│ Microsoft Entra ID               │ 13.5                                      │
│ mTLS                             │ 9.3                                       │
│ Nonce                            │ 1                                         │
│ OAuth 2.1                        │ 5.1, 5.2, 8.1                             │
│ OAuth Callback Proxy             │ 7.3, 12.4                                 │
│ Okta                             │ 13.4                                      │
│ Open Redirector                  │ 1, 4, 8.4                                 │
│ PAR (Pushed Authorization Request)│ 1, 7.3, 9, 11.3                         │
│ Path Traversal                   │ 13.1                                      │
│ PKCE                             │ 1, 6.2, 6.3, 6.5, 8, 11.3                │
│ PortSwigger                      │ 4.3                                       │
│ PR Preview                       │ 12.4                                      │
│ Public Client                    │ 1, 6.2, 6.5, 8.1                          │
│ Rate Limiting                    │ 10.4                                      │
│ Redirect Proxy                   │ 7.3, 12.4                                 │
│ Redirect URI                     │ 1, 2, 전체                                │
│ Referer 헤더                     │ 4.1, 8.4                                  │
│ request_uri                      │ 1, 9.2                                    │
│ RFC 3986                         │ 5.2, 5.3                                  │
│ RFC 6749                         │ 2.1, 3.1, 5.1, 5.2                        │
│ RFC 7591 (DCR)                   │ 10                                        │
│ RFC 7592                         │ 10.5                                      │
│ RFC 7636 (PKCE)                  │ 8                                         │
│ RFC 8252                         │ 5.1, 6                                    │
│ RFC 8628                         │ 6.6                                       │
│ RFC 9126 (PAR)                   │ 9                                         │
│ RFC 9700                         │ 4.1, 5.1, 5.3                             │
│ S256                             │ 8.2, 14                                   │
│ SHA256                           │ 8.2                                       │
│ SPA                              │ 6.2, 11                                   │
│ Spring Boot                      │ 12.3                                      │
│ state 파라미터                    │ 1, 2.2, 12.4, 14                          │
│ Subdomain Takeover               │ 1, 4.2, 7.2, 14                           │
│ Token Binding                    │ 1                                         │
│ Token Endpoint                   │ 1, 2.2                                    │
│ Trusted Origins (Okta)           │ 13.4                                      │
│ Universal Links (iOS)            │ 1, 6.3                                    │
│ URL 파싱                         │ 4.2, 7.2                                  │
│ userinfo 구성요소                 │ 4.2, 13.1                                 │
│ Wildcard                         │ 3.3, 7, 13.6                              │
│ XSS                              │ 8.4, 11.2                                 │
│ 기밀 클라이언트                    │ 1, 6.1, 11.2                              │
│ 루프백 리다이렉트                  │ 1, 5.4, 6.5                               │
│ 서브도메인 탈취                    │ 1, 4.2, 7.2, 14                           │
│ 와일드카드                        │ 3.3, 7, 13.6                              │
│ 의도적 커플링                     │ 3                                         │
│ 인가 코드                         │ 1, 2.2, 8.2                               │
│ 정확 문자열 일치                   │ 1, 5.2, 5.3                               │
│ 코드 교환 증명 키                  │ 1, 8                                      │
│ 환경 핸들                         │ 1, 7.3, 12.4                              │
└──────────────────────────────────┴────────────────────────────────────────────┘
```

---

> **참고 문헌**
> - RFC 6749 - The OAuth 2.0 Authorization Framework (2012)
> - RFC 7636 - Proof Key for Code Exchange (PKCE) (2015)
> - RFC 7591 - OAuth 2.0 Dynamic Client Registration Protocol (2015)
> - RFC 7592 - OAuth 2.0 Dynamic Client Registration Management Protocol (2015)
> - RFC 8252 - OAuth 2.0 for Native Apps (2017)
> - RFC 8628 - OAuth 2.0 Device Authorization Grant (2019)
> - RFC 9126 - OAuth 2.0 Pushed Authorization Requests (2021)
> - RFC 9700 - OAuth 2.0 Security Best Current Practice (2025)
> - OAuth 2.1 Draft - https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/
> - OWASP OAuth Security Cheat Sheet
> - PortSwigger Web Security Academy - OAuth Authentication
