---
layout: single
title: "Remember Me 로그인 유지 완전 가이드"
date: 2026-03-13 23:00:00 +0900
categories: backend
excerpt: "Remember Me는 장기 로그인 편의성을 높이지만 토큰 탈취 위험을 키우므로 회전·무효화·기기신뢰 정책을 함께 설계해야 한다."
toc: true
toc_sticky: true
tags: [rememberme, authentication, session, cookie, refresh, security]
---
TL;DR
- Remember Me는 Persistent Cookie(또는 Refresh Token)로 재로그인 마찰을 줄이는 대신 공격 노출 시간을 늘린다.
- 안전한 구현의 핵심은 CSPRNG 토큰, 서버측 해시 저장, Token Rotation, 즉시 무효화, HttpOnly/Secure/SameSite 설정이다.
- 실무에선 전통 웹은 Series+Token, SPA/API는 Access+Refresh Rotation, 고보안 영역은 WebAuthn·Step-up 인증 조합이 효과적이다.

## 1. 개념
Remember Me는 사용자가 재방문할 때 비밀번호 재입력 없이 로그인 상태를 복원하도록, 브라우저에 장기 식별자(Persistent Cookie 또는 Refresh Token)를 저장하는 인증 유지 메커니즘이다.

## 2. 배경
HTTP의 stateless 특성 때문에 기본적으로 서버는 사용자를 기억하지 못하며, 매번 로그인하는 마찰이 커졌다. 이 문제를 완화하려고 Cookie·Session·Persistent Login 기법이 발전했고, 보안 위협 증가에 따라 토큰 회전·도난 탐지·기기 기반 검증이 함께 진화했다.

## 3. 이유
사용자 편의(낮은 인증 마찰)와 보안(세션 탈취 저항성) 사이의 균형을 잡기 위해 필요하다. 서비스는 로그인 유지 기간, 재인증 조건, 위험 감지 정책을 통해 UX 손실 없이 계정 탈취 가능성을 줄여야 한다.

## 4. 특징
Remember Me는 장기 자격증명의 수명·저장 위치·회전 전략·무효화 경로에 따라 보안 수준이 크게 달라진다. 특히 Series+Token 또는 Refresh Token Rotation은 탈취 후 재사용 탐지를 가능하게 하며, 민감 작업에는 Step-up 인증을 요구하는 계층형 방어가 필수다.

## 5. 상세 내용

# Remember Me 로그인 유지 완전 가이드

> **작성일**: 2026-03-13
> **카테고리**: Backend / Authentication / Session Management / Cookie / Token
> **포함 내용**: Remember Me, Persistent Login, Cookie, Session, JWT, Refresh Token, Series+Token, Token Rotation, HttpOnly, Secure, SameSite, CSRF, XSS, Credential Stuffing, Bearer Token, OAuth 2.0, OIDC, WebAuthn, Passkeys, BFF Pattern, Step-up Authentication, Risk-based Authentication, OWASP, NIST SP 800-63B, GDPR, PCI DSS

---

# 1. Remember Me의 등장 배경과 역사

## 1.1 HTTP Stateless 특성과 웹 인증의 근본 문제

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  HTTP Stateless와 인증의 근본 문제                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP의 본질 (1991, Tim Berners-Lee):                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  "각 요청(Request)은 완전히 독립적이며,                      │           │
│  │   서버는 이전 요청을 기억하지 않는다."                       │           │
│  │                                                              │           │
│  │  GET /page1 → 응답 → 연결 종료 (서버: "누구였지?")          │           │
│  │  GET /page2 → 응답 → 연결 종료 (서버: "또 누구야?")         │           │
│  │  GET /page3 → 응답 → 연결 종료 (서버: "처음 보는 사람인데") │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
│  이 설계가 의도적이었던 이유:                                              │
│  ├── 1990년대 초: 단순한 하이퍼텍스트 문서 공유가 목적                     │
│  ├── 서버 자원 절약: 연결을 유지하지 않아 수천 명 동시 접속 가능           │
│  └── 단순성: 각 요청이 독립적이므로 구현과 디버깅이 쉬움                  │
│                                                                             │
│  1994년 웹 상업화 이후 드러난 문제:                                        │
│  ├── 쇼핑카트: 여러 페이지에 걸쳐 상품 목록 유지 불가                     │
│  ├── 로그인 상태: 매 요청마다 아이디/비밀번호 재전송 필요                  │
│  ├── 사용자 설정: 언어/테마 등 개인화 정보 유지 불가                      │
│  └── 결국: HTTP 위에 "상태 유지 계층"이 필수가 됨                         │
│                                                                             │
│  해결의 진화:                                                              │
│  ├── 1단계: Cookie 발명 (1994, Lou Montulli)                              │
│  ├── 2단계: Session 기반 인증 (서버 측 상태 저장)                         │
│  ├── 3단계: Persistent Cookie → Remember Me (2000년대 초)                 │
│  ├── 4단계: Token 기반 인증 (JWT, OAuth 2.0, 2012~)                      │
│  └── 5단계: Passkeys (생체인증 기반, 2022~)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Session Cookie vs Persistent Cookie

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                Session Cookie vs Persistent Cookie                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────┬──────────────────────────────┐           │
│  │      Session Cookie          │      Persistent Cookie       │           │
│  ├──────────────────────────────┼──────────────────────────────┤           │
│  │ Expires/Max-Age: 없음       │ Expires/Max-Age: 설정됨      │           │
│  │ 수명: 브라우저 닫으면 삭제  │ 수명: 설정된 만료일까지 유지 │           │
│  │ 저장: 메모리 (RAM)          │ 저장: 디스크 (파일)          │           │
│  │ 용도: 로그인 세션 유지      │ 용도: Remember Me 구현       │           │
│  │ 보안: 브라우저 종료=세션 끝 │ 보안: 장기간 공격 노출       │           │
│  │ 예시: JSESSIONID=abc123     │ 예시: rm=token; Max-Age=...  │           │
│  └──────────────────────────────┴──────────────────────────────┘           │
│                                                                             │
│  Remember Me의 기술적 본질:                                                │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  "Session Cookie 대신 Persistent Cookie를 발급하여            │           │
│  │   브라우저를 닫아도 쿠키가 디스크에 남아                      │           │
│  │   다음 방문 시 자동 로그인이 이루어지게 하는 것"             │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Remember Me가 해결하려는 핵심 문제: 인증 마찰 감소

Session Cookie만 사용하던 시대의 사용자 경험 문제:

- 매일 아침 이메일 확인 시 매번 로그인 필요
- 개인 PC에서도 브라우저 재시작마다 재인증
- 비밀번호 기억 부담 → 단순 비밀번호 설정 → 보안 약화
- 잦은 로그인 요구 → 서비스 이탈률 증가

**Remember Me = 인증 마찰(Authentication Friction) 제거**

## 1.4 사용자 편의 vs 보안 트레이드오프

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            사용자 편의 vs 보안 트레이드오프 스펙트럼                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  보안 최고 ◀─────────────────────────────────────────▶ 편의 최고           │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 매 요청  │  │ 세션     │  │ Remember │  │ 장기     │  │ 영구     │   │
│  │ 마다     │  │ Cookie   │  │ Me       │  │ Token    │  │ 로그인   │   │
│  │ 재인증   │  │ (30분)   │  │ (14일)   │  │ (90일)   │  │ (무기한) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ▲                           ▲                           ▲            │
│       │                           │                           │            │
│  금융/의료                   일반 웹서비스               소셜/콘텐츠       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                   핵심 트레이드오프                          │           │
│  ├─────────────────────────────────────────────────────────────┤           │
│  │  Remember Me가 해결하는 것: 인증 마찰(friction) 감소        │           │
│  │  Remember Me가 만드는 것:  공격 노출 시간(surface) 증가     │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 관점 | Session Login | Persistent Login (Remember Me) |
|------|--------------|--------------------------------|
| 사용 편의 | 매번 재로그인 필요 | 자동 로그인 |
| 보안 위험 기간 | 브라우저 닫으면 종료 | 수일~수개월 |
| XSS 피해 규모 | Session 종료 후 무력화 | 장기간 유효 |
| CSRF 위험 | 상대적으로 낮음 | 상대적으로 높음 |
| 공용 PC 위험 | 낮음 | 매우 높음 |
| Token Theft 영향 | 단기 피해 | 장기 피해 |

**핵심 규칙**: Remember Me는 **신뢰할 수 있는 개인 기기에서만 사용**하도록 설계해야 한다.

---

# 2. 용어 사전 (Terminology Dictionary)

## 2.1 핵심 용어 어원과 의미

| 용어 | 어원/유래 | 의미 |
|------|-----------|------|
| **Remember Me** | 의인화된 UX 언어 "나를 기억해 주세요" | 서버가 사용자를 "기억한다"는 메타포. 기술적으로는 Persistent Cookie 발급. 2000년대 초 주요 웹 서비스에서 경쟁적 도입 |
| **Cookie** | UNIX "Magic Cookie" (불투명한 데이터 조각) → 1994년 Lou Montulli가 Netscape에서 웹에 적용. "Magic cookie라는 용어가 심미적으로 마음에 들었다" | HTTP 요청 간 상태를 유지하기 위해 브라우저에 저장하는 소량의 데이터 |
| **Session** | 라틴어 "sessio" (동사 sedeō "앉다" + 접미사 -tiō) = "앉아 있는 행위" | 한 사용자가 웹사이트에 접속~종료까지의 기간. HTTP stateless 위에 연속성을 구현하는 추상화 계층 |
| **Token** | 고대 영어 "tācn" (표시/징표) → Proto-Germanic `*taikną` → Proto-Indo-European `*deyḱ-` ("보여주다") | 소지자의 신원/권한을 증명하는 데이터 조각. 중세부터 인증 맥락에서 사용 |
| **JWT** | JSON Web Token. Mike Jones(MS), John Bradley(Ping), Nat Sakimura(NRI)가 4.5년 개발. 2015년 5월 RFC 7519 | XML SAML의 무거움을 해결한 컴팩트한 자기 포함적(self-contained) 토큰 |
| **Bearer Token** | "Bearer" = 소지자/운반자. 금융의 무기명 채권(bearer bond)에서 유래. RFC 6750 | 토큰을 소지한 자에게 접근을 허용. 추가 신원 증명 불필요. 콘서트 티켓의 비유 |
| **Refresh Token** | OAuth 2.0 RFC 6749에서 도입. "자주 쓰는 것은 짧게, 드물게 쓰는 것은 길게" | Access Token 갱신을 위한 장수명 자격증명. Resource Server에 절대 노출되지 않음 |
| **CSRF** | Cross-Site Request Forgery. 2001년부터 알려짐. Jesse Burns가 기념비적 논문 작성. 별명: "Sea Surf", "Session Riding" | 공격자가 피해자의 브라우저를 이용해 인증된 요청을 위조. Remember Me 활성화 시 공격 창구 확대 |
| **XSS** | Cross-Site Scripting. 2000년 2월 Microsoft+CERT 공동 보고서에서 명명. 원래 "CSS"였으나 Cascading Style Sheets와 혼동 방지 | 악성 스크립트 주입. `document.cookie`를 통한 Remember Me 쿠키 탈취가 대표적 피해 |
| **HttpOnly** | 2002년 Microsoft IE 6 SP1에서 최초 도입. Michael Howard(MS 보안 프로그램 매니저)가 핵심 주창 | JavaScript의 `document.cookie` API를 통한 쿠키 접근 차단. XSS 쿠키 탈취 방어 |
| **Secure flag** | 1994년 Lou Montulli의 최초 Netscape 쿠키 스펙에서부터 포함. 1997년 RFC 2109에서 표준화 | HTTPS 연결에서만 쿠키 전송. 중간자 공격(MITM) 방어 |
| **SameSite** | 2014년 "First-Party Cookie"로 초안 → 2016년 "SameSite Cookie"로 개명. Google Mike West + Mozilla Mark Goodwin | Cross-site 요청 시 자동 쿠키 첨부를 브라우저 레벨에서 차단. CSRF 근본 방어 |
| **Sliding Expiration** | 주로 ASP.NET 세계에서 정립. 활동 시마다 만료 연장 | 비활동 타임아웃 구현. 활발한 사용자는 계속 로그인 유지 |
| **Absolute Expiration** | Sliding과 대비 개념. 최초 발급 시점 기준 고정 만료 | 보안을 위한 강제 재인증. 사용자 활동과 무관하게 만료 |
| **Credential Stuffing** | 2011년 Sumit Agarwal(Shape Security 공동창업자, 전 미 국방부 차관보)이 명명. "채워 넣는(stuffing)" 행위 | 유출된 자격증명을 다른 사이트에 대량 대입. Remember Me는 피해를 증폭 (장기 유효 쿠키 획득) |
| **Series+Token** | 2006년 Barry Jaspan이 Charles Miller(2004)의 방식을 개선하여 제안 | 쿠키 도난을 탐지할 수 있는 3요소 구조. Spring Security에 직접 채택 |
| **Passkeys** | 2022년 5월 Apple/Google/Microsoft 공동 선언. FIDO Alliance + W3C WebAuthn 기반 | 공개키 암호화 기반 인증. "기기가 나를 기억한다" 패러다임. Remember Me 개념 자체를 대체 |

## 2.2 Remember Me의 다양한 표현

| 표현 | 사용 서비스 | 뉘앙스 |
|------|------------|--------|
| "Remember Me" | 가장 일반적 | 인식(recognition)에 초점 |
| "Keep Me Logged In" | Google, Facebook | 상태(state)에 초점 |
| "Stay Signed In" | Microsoft | 지속성에 초점 |
| "Remember Me on This Computer" | 레거시 서비스 | 기기 한정 명시 |
| "Keep Me Signed In" | 다수 서비스 | "Logged In"의 변형 |

---

# 3. 기술 진화 타임라인

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Cookie와 Remember Me 기술 진화 타임라인                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1991 ── HTTP/0.9 탄생 (Tim Berners-Lee)                                  │
│          완전한 Stateless 설계. 로그인 개념 자체 없음                      │
│          │                                                                  │
│  1994 ── Cookie 발명 (Lou Montulli, Netscape)                             │
│     6월  UNIX "magic cookie" 개념을 웹에 적용                              │
│    10월  Mosaic Netscape 0.9beta에서 Cookie 최초 지원                      │
│          │                                                                  │
│  1995 ── Cookie 특허 출원 (US Patent 5774670, 1998년 부여)                │
│          │                                                                  │
│  1997 ── RFC 2109: 최초의 공식 Cookie 표준                                │
│     2월  Persistent Cookie vs Session Cookie 구분 공식화                   │
│          │                                                                  │
│  2000 ── RFC 2965: Cookie2/Set-Cookie2 도입 시도 (실패)                   │
│    10월  XSS 용어 탄생 (Microsoft + CERT 공동 발표)                       │
│          │                                                                  │
│  2002 ── HttpOnly 플래그 도입 (Microsoft IE 6 SP1)                        │
│          XSS를 통한 세션 쿠키 탈취에 대한 최초의 브라우저 레벨 방어       │
│          │                                                                  │
│  2004 ── Charles Miller: "Persistent Login Cookie Best Practice"          │
│     1월  Remember Me 보안 구현의 최초 체계적 가이드라인                    │
│          Random Token + DB 저장 + 단일 사용 원칙 제시                      │
│          │                                                                  │
│  2006 ── Barry Jaspan: "Improved Persistent Login Cookie Best Practice"  │
│          Series + Token 쌍 개념 도입. 쿠키 도난 탐지 메커니즘 추가        │
│          Spring Security 등 주요 프레임워크에서 채택                       │
│          │                                                                  │
│  2011 ── RFC 6265: 현행 Cookie 표준 (RFC 2965 폐기)                      │
│     4월  실제 브라우저 동작 기반으로 재정립                                │
│          "Credential Stuffing" 용어 탄생 (Sumit Agarwal)                  │
│          │                                                                  │
│  2012 ── RFC 6749/6750: OAuth 2.0 + Bearer Token                         │
│    10월  Refresh Token 개념 공식화. 모던 Remember Me의 이론적 기반        │
│          │                                                                  │
│  2015 ── RFC 7519: JWT 표준화                                             │
│     5월  Stateless 인증 패러다임 확립                                      │
│          Access Token + Refresh Token 조합의 현대적 Remember Me 기반      │
│          │                                                                  │
│  2016 ── SameSite 쿠키 속성 등장                                          │
│     5월  Chrome 51에서 최초 구현. CSRF 방어의 새 시대                     │
│          │                                                                  │
│  2017 ── NIST SP 800-63B 발행                                             │
│          AAL별 세션 수명 공식 규정. 고위험 시스템 Remember Me 제한         │
│          │                                                                  │
│  2019 ── W3C WebAuthn Level 1 권고안 발행                                 │
│     3월  Passkey 기반 인증의 표준 토대                                     │
│          │                                                                  │
│  2020 ── Chrome 80: SameSite=Lax 기본값 적용                              │
│     2월  미설정 Cookie의 Cross-site 전송 차단. 패러다임 전환              │
│          Safari: Third-party Cookie 전면 차단                              │
│          │                                                                  │
│  2022 ── Apple/Google/Microsoft: Passkey 공동 선언                        │
│     5월  "기기가 나를 기억한다" 패러다임 전환 시작                        │
│          │                                                                  │
│  2024 ── Google의 3rd Party Cookie 정책 수정 (강제→사용자 선택)           │
│          FBI: Remember Me 쿠키 탈취를 통한 MFA 우회 공식 경고             │
│          │                                                                  │
│  현재 ── RFC 6265bis 개발 중 (IETF httpbis Working Group)                │
│          SameSite 공식 통합, HTTP/2·HTTP/3 대응                           │
│          Passkey Conditional UI 보편화 가속                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 4. 학술적/이론적 배경

## 4.1 RFC 6265 (HTTP State Management Mechanism, 2011)

현행 Cookie 표준. RFC 2109/2965를 모두 폐기하고, 실제 브라우저 동작 기반으로 재정립.

**Remember Me 관련 핵심 내용:**

| 항목 | 내용 |
|------|------|
| Persistent Cookie | `Max-Age` 또는 `Expires` 속성이 있는 쿠키. 둘 다 있으면 `Max-Age` 우선 |
| Session Cookie | 두 속성 모두 없는 쿠키. 브라우저 종료 시 삭제 |
| 보안 권고 | 민감 데이터 대신 "nonce(임시값)" 사용 세션 식별자 방식 권고 |
| 취약점 인정 | "Cookie는 CSRF 같은 공격에 취약하게 만드는 경향이 있다" |
| 암호화 한계 | "Cookie를 암호화/서명해도 이식(porting)이나 재전송(replay)을 막지 못한다" |

## 4.2 RFC 6265bis (개발 중)

RFC 6265의 후속 표준. SameSite 속성의 공식 통합, 쿠키 크기 제한 명확화, HTTP/2·HTTP/3 환경 대응 포함.

## 4.3 RFC 7519 (JSON Web Token, 2015)

**세션 관리 관련 핵심 Claims:**

| Claim | 용도 | Remember Me 연관성 |
|-------|------|-------------------|
| `exp` (Expiration Time) | 토큰 유효 종료 시각 | Access Token의 단기 만료 구현 |
| `nbf` (Not Before) | 이 시각 이전 처리 불가 | 토큰 선발급 시나리오 |
| `iat` (Issued At) | 토큰 발행 시각 | Refresh Token 갱신 주기 관리 |
| `jti` (JWT ID) | 토큰 고유 식별자 | Token Blacklist 구현에 활용 |

## 4.4 RFC 6749/6750 (OAuth 2.0, Bearer Token, 2012)

**Refresh Token의 Remember Me 관련 설계:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Refresh Token과 Remember Me의 관계                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Access Token (단기 자격증명)                                              │
│  ├── 수명: 15분~1시간                                                     │
│  ├── 용도: 실제 API 접근                                                  │
│  └── 노출 범위: Resource Server에 전송                                    │
│                                                                             │
│  Refresh Token (장기 자격증명 = Remember Me 역할)                         │
│  ├── 수명: 수일~수개월                                                    │
│  ├── 용도: Access Token 재발급                                            │
│  └── 노출 범위: Authorization Server에만 전송 (노출 범위 최소화)          │
│                                                                             │
│  핵심 설계 원리:                                                           │
│  "자주 쓰는 자격증명은 짧게, 드물게 쓰는 자격증명은 길게"                │
│                                                                             │
│  Cookie 기반 Remember Me와의 근본적 차이:                                 │
│  ├── Cookie: 모든 요청에 자동 전송 → 공격 표면 넓음                       │
│  └── Refresh Token: Auth Server에만 전송 → 공격 표면 좁음                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.5 OWASP Session Management Cheat Sheet

**세션 관리 핵심 권고사항:**

| 항목 | OWASP 권고 |
|------|-----------|
| 세션 ID 엔트로피 | 최소 64비트 (Hex 인코딩 시 16자 이상) |
| 난수 생성 | 반드시 CSPRNG 사용 |
| 세션 ID 내용 | 의미 있는 정보(사용자명, PII 등) 포함 금지 |
| 세션 ID명 | 프레임워크 기본값(PHPSESSID, JSESSIONID) 변경 권고 |
| Idle Timeout | 위험도에 따라 2~30분 |
| Absolute Timeout | 활동 여부 무관하게 4~8시간 |
| 토큰 저장 | localStorage보다 Session Cookie(HttpOnly) 권장 |

## 4.6 NIST SP 800-63B (Digital Identity Guidelines)

**AAL(Authenticator Assurance Level)별 재인증 요구사항:**

| AAL 수준 | 최대 절대 세션 시간 | 비활동 타임아웃 | Remember Me 허용 |
|----------|-------------------|----------------|-----------------|
| **AAL1** | 30일 | 명시 없음 | 허용 (30일 이하 만료) |
| **AAL2** | 12시간 | 30분 | 제한적 허용 |
| **AAL3** | 12시간 | 15분 | **사실상 불가** |

NIST 핵심 입장: 세션 시크릿은 영속적이어서는 안 되며, 세션은 재시작/재부팅 시 종료되는 특정 세션에 귀속된다.

## 4.7 Charles Miller (2004) - Persistent Login Cookie Best Practice

Remember Me 보안 구현의 최초 체계적 가이드라인:

- Cookie 구조: `username:대용량_랜덤_토큰(128비트)`
- 서버에서 `랜덤_토큰 → username` 매핑 테이블 유지
- 각 Cookie는 단 한 번만 유효 (일회성)
- 인증 성공 시 사용된 토큰 무효화 + 새 Cookie 발급
- 민감 작업은 Cookie 인증만으로 불허, 비밀번호 재입력 요구

**한계**: 동시성(concurrency) 문제로 프로덕션에서 제대로 동작하지 않음을 Miller 본인이 인정.

## 4.8 Barry Jaspan (2006) - Improved Persistent Login Cookie Best Practice

Miller의 방식을 개선하여 **쿠키 도난 탐지 메커니즘** 추가:

| 필드 | 설명 | 변경 시점 |
|------|------|-----------|
| `username` | 사용자 식별자 | 변경 없음 |
| `series` | 세션 단위 영구 랜덤 식별자 | 새 로그인 시만 변경 |
| `token` | 일회용 랜덤 토큰 | 매 사용 후 변경 |

**도난 탐지 로직:**
- 정상: `(username, series, token)` 모두 일치 → 인증 성공, `token`만 갱신
- 도난 징후: 유효한 `series` + 유효하지 않은 `token` → 해당 사용자의 **모든** 세션 무효화 + 보안 경고
- `series`가 없음 → 일반 만료/로그아웃 처리

Spring Security의 `PersistentTokenBasedRememberMeServices`가 이 방식을 직접 구현.

---

# 5. Remember Me 구현 방식 상세

## 5.1 방식 1: 단순 쿠키 기반 (안티패턴 - 절대 사용 금지)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 1: 단순 쿠키 기반 (ANTI-PATTERN)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠ 절대 사용 금지 ⚠                                                       │
│                                                                             │
│  동작 원리:                                                                │
│  사용자 ID, 비밀번호, 또는 그 조합을 직접 쿠키에 저장                     │
│                                                                             │
│  Cookie: remember_me=username:password          (평문)                     │
│  Cookie: remember_me=dXNlcjpwYXNzd29yZA==      (Base64 인코딩)            │
│                                                                             │
│  [브라우저]                                [서버]                          │
│     │                                        │                             │
│     │  Cookie: rm=user:pass                  │                             │
│     │ ─────────────────────────────────────▶ │                             │
│     │                                        │ 디코딩 → DB 조회           │
│     │         200 OK (인증 성공)             │                             │
│     │ ◀───────────────────────────────────── │                             │
│                                                                             │
│  실제 사례 (Troy Hunt 분석):                                              │
│  ├── Black & Decker: 비밀번호 Base64 인코딩 쿠키 저장. HttpOnly 미설정   │
│  │   → ELMAH 에러 로그에 50,000건 이상의 자격증명 노출                   │
│  └── Aussie Farmers Direct: 평문 비밀번호 쿠키 저장. 6개월 만료           │
│      → 비밀번호 변경 후에도 기존 쿠키 유효                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 공격 유형 | 메커니즘 | 결과 |
|-----------|----------|------|
| XSS | `document.cookie`로 쿠키 탈취 | 비밀번호 직접 노출 |
| 네트워크 스니핑 | HTTPS 미사용 시 평문 전송 | 자격증명 탈취 |
| CSRF | 자동 쿠키 전송 | 위조 요청 실행 |
| 비밀번호 재사용 공격 | 타 서비스 동일 비밀번호 | 계정 연쇄 탈취 |

## 5.2 방식 2: Server-side Session + Persistent Cookie (Redis/DB)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 2: Server-side Session + Persistent Cookie                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  로그인 흐름:                                                              │
│                                                                             │
│  [사용자]         [브라우저]           [서버]            [Redis/DB]         │
│     │                │                   │                   │              │
│     │ ID/PW 입력     │                   │                   │              │
│     │ ──────────────▶│                   │                   │              │
│     │                │ POST /login       │                   │              │
│     │                │ ─────────────────▶│                   │              │
│     │                │                   │ 자격증명 검증     │              │
│     │                │                   │ Session ID 생성   │              │
│     │                │                   │ (CSPRNG 128bit)   │              │
│     │                │                   │ ─────────────────▶│              │
│     │                │                   │     세션 저장     │              │
│     │                │ Set-Cookie:       │                   │              │
│     │                │ sid=abc; Max-Age  │                   │              │
│     │                │ =1209600;HttpOnly │                   │              │
│     │                │ ;Secure;SameSite  │                   │              │
│     │                │ ◀─────────────────│                   │              │
│                                                                             │
│  재방문 흐름:                                                              │
│                                                                             │
│  [브라우저]                    [서버]            [Redis/DB]                 │
│     │ Cookie: sid=abc           │                   │                      │
│     │ ─────────────────────────▶│                   │                      │
│     │                           │ sid 조회          │                      │
│     │                           │ ─────────────────▶│                      │
│     │                           │ 사용자 정보 반환  │                      │
│     │                           │ ◀─────────────────│                      │
│     │      200 OK (인증 성공)   │                   │                      │
│     │ ◀─────────────────────────│                   │                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**세션 스토어 옵션:**

| 스토어 | 장점 | 단점 | 적합 규모 |
|--------|------|------|-----------|
| In-Memory | 초고속, 구현 단순 | 서버 재시작 시 손실, 수평 확장 불가 | 소규모 |
| Redis | 초고속(sub-ms), TTL 지원, 클러스터 | 외부 서비스 의존성 | 중대규모 |
| Memcached | 고속, 단순 | 영속성 없음 | 중간 |
| RDBMS | 영속성, 복잡한 쿼리 | 상대적으로 느림 | 소중규모 |

**Django 구현 예시:**

```python
# settings.py
SESSION_COOKIE_AGE = 1209600  # 2주 (초 단위)
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Lax'

# views.py
def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(request, **form.cleaned_data)
            if user:
                if not form.cleaned_data.get('remember_me'):
                    request.session.set_expiry(0)  # 브라우저 닫으면 만료
                else:
                    request.session.set_expiry(1209600)  # 2주
                login(request, user)
```

**장점**: 구현 단순, 즉시 무효화 가능, 프레임워크 내장 지원
**단점**: 서버 상태 필요, 수평 확장 시 공유 스토리지 필요, Token Theft Detection 불가

## 5.3 방식 3: Series+Token (Barry Jaspan) - Spring Security 구현

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 3: Series+Token (Barry Jaspan) 동작 흐름                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  최초 로그인 (Remember Me 체크):                                           │
│                                                                             │
│  [서버]                                                                    │
│  1. series = CSPRNG(128비트)       ← 세션 단위 고유 식별자                │
│  2. token  = CSPRNG(128비트)       ← 일회용 랜덤 토큰                     │
│  3. DB: (username, series, token, now()) 저장                              │
│  4. Cookie: rm=username:series:token; Max-Age=1209600; HttpOnly; Secure   │
│                                                                             │
│  재방문 시 인증 (Token Rotation):                                          │
│                                                                             │
│  [쿠키] username:seriesA:token1                                            │
│     │                                                                      │
│     ▼                                                                      │
│  [서버] DB 조회: WHERE series = seriesA                                    │
│     │                                                                      │
│     ├── CASE A: username + token 모두 일치                                │
│     │   ├── token1 삭제                                                   │
│     │   ├── token2 = CSPRNG(128비트) 생성                                 │
│     │   ├── DB: (username, seriesA, token2, now()) 갱신                   │
│     │   ├── 새 쿠키: rm=username:seriesA:token2                           │
│     │   └── 인증 성공                                                     │
│     │                                                                      │
│     ├── CASE B: series 존재 + token 불일치  ← 핵심 보안 로직             │
│     │   ├── ⚠ 쿠키 도난(Cookie Theft) 의심!                              │
│     │   ├── 해당 username의 모든 persistent_logins 삭제                   │
│     │   ├── 경고 이메일 발송                                              │
│     │   └── 세션 무효화                                                   │
│     │                                                                      │
│     └── CASE C: series 자체 없음                                          │
│         └── 일반 인증 실패 (만료 또는 로그아웃됨)                         │
│                                                                             │
│  도난 탐지 시나리오:                                                       │
│                                                                             │
│  정상 사용자: (seriesX, token1) 보유                                      │
│  공격자:      (seriesX, token1) 탈취                                      │
│     │                                                                      │
│     ├── 사용자가 먼저 사용: token1→token2 교체                            │
│     ├── 공격자가 token1로 시도: series 있음 + token 불일치                │
│     └── → 도난 감지! → 전체 세션 삭제 + 사용자 경고                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**DB 스키마 (Spring Security):**

```sql
CREATE TABLE persistent_logins (
    username  VARCHAR(64) NOT NULL,
    series    VARCHAR(64) PRIMARY KEY,
    token     VARCHAR(64) NOT NULL,
    last_used TIMESTAMP NOT NULL
);
```

**Spring Security 구현:**

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PersistentTokenRepository tokenRepository(DataSource dataSource) {
        JdbcTokenRepositoryImpl repo = new JdbcTokenRepositoryImpl();
        repo.setDataSource(dataSource);
        return repo;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
            PersistentTokenRepository tokenRepo) throws Exception {
        http.rememberMe(rm -> rm
            .tokenRepository(tokenRepo)
            .tokenValiditySeconds(1209600)  // 2주
            .rememberMeParameter("remember-me")
            .key("uniqueAndSecret")
        );
        return http.build();
    }
}
```

**장점**: Token Theft Detection 가능, 검증된 패턴, Spring Security 공식 지원
**단점**: DB 필요, 동시 요청 시 오탐(false positive) 가능 (Spring Security Issue SEC-2856)

## 5.4 방식 4: JWT Access + Refresh Token (Rotation 포함)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 4: JWT Access + Refresh Token Rotation                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  로그인 흐름:                                                              │
│                                                                             │
│  [클라이언트]                [Auth Server]              [DB]               │
│     │ POST /auth/login       │                           │                 │
│     │ {user, pass, rm:true}  │                           │                 │
│     │ ──────────────────────▶│                           │                 │
│     │                        │ 자격증명 검증             │                 │
│     │                        │ access_token = JWT        │                 │
│     │                        │   {sub, exp:15min}        │                 │
│     │                        │ refresh_token = opaque    │                 │
│     │                        │ ────────────────────────▶│                 │
│     │                        │   {hash, user, family,    │                 │
│     │                        │    exp: rm?7d:1d}         │                 │
│     │ Body: {access_token}   │                           │                 │
│     │ Cookie: refresh_token  │                           │                 │
│     │  HttpOnly;Secure;      │                           │                 │
│     │  SameSite=Strict       │                           │                 │
│     │ ◀──────────────────────│                           │                 │
│                                                                             │
│  Token Rotation 흐름 (Access Token 만료 후):                               │
│                                                                             │
│  [클라이언트]                [Auth Server]              [DB]               │
│     │ POST /auth/refresh     │                           │                 │
│     │ (Cookie 자동 전송)     │                           │                 │
│     │ ──────────────────────▶│                           │                 │
│     │                        │ refresh_token 해시 조회   │                 │
│     │                        │ ────────────────────────▶│                 │
│     │                        │                           │                 │
│     │                        ├── 유효한 토큰:            │                 │
│     │                        │   기존 RT 무효화          │                 │
│     │                        │   새 AT + 새 RT 발급      │                 │
│     │                        │                           │                 │
│     │                        └── 이미 사용된 토큰:       │                 │
│     │                            Token Family 전체 무효화│                 │
│     │                            = Reuse Detection       │                 │
│     │                            → 강제 로그아웃         │                 │
│                                                                             │
│  Token Family 개념 (Auth0):                                                │
│                                                                             │
│  family_id = "uuid-abc"                                                    │
│  ├── token_1 (active) → 사용 → 무효화 → token_2 발급                     │
│  ├── token_2 (active) → 사용 → 무효화 → token_3 발급                     │
│  └── 공격자가 token_1 재사용 시도 → Reuse Detection                       │
│      → family "uuid-abc" 전체 무효화 → 사용자 강제 재인증                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Express.js 구현 예시:**

```javascript
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// 로그인 핸들러
app.post('/auth/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    const user = await verifyCredentials(username, password);

    // Access Token (Stateless JWT)
    const accessToken = jwt.sign(
        { sub: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    // Refresh Token (Opaque, DB 저장)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256')
        .update(refreshToken).digest('hex');
    const familyId = crypto.randomUUID();
    const expiresAt = rememberMe
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7일
        : new Date(Date.now() + 24 * 60 * 60 * 1000);     // 1일

    await db.refreshTokens.create({
        tokenHash, userId: user.id, familyId, expiresAt
    });

    res.cookie('refresh_token', refreshToken, {
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined,
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
    });
    res.json({ access_token: accessToken, expires_in: 900 });
});

// Refresh Token Rotation
app.post('/auth/refresh', async (req, res) => {
    const oldToken = req.cookies.refresh_token;
    const oldHash = crypto.createHash('sha256')
        .update(oldToken).digest('hex');
    const record = await db.refreshTokens.findOne({
        where: { tokenHash: oldHash }
    });

    if (!record) {
        // Reuse Detection: 이미 사용된 토큰 → Family 전체 무효화
        const usedRecord = await db.refreshTokens.findUsed(oldHash);
        if (usedRecord) {
            await db.refreshTokens.deleteFamily(usedRecord.familyId);
        }
        return res.status(401).json({ error: 'token_reuse_detected' });
    }

    // 기존 토큰 무효화 + 새 토큰 발급
    await db.refreshTokens.markUsed(record.id);
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newHash = crypto.createHash('sha256')
        .update(newRefreshToken).digest('hex');

    await db.refreshTokens.create({
        tokenHash: newHash,
        userId: record.userId,
        familyId: record.familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const newAccessToken = jwt.sign(
        { sub: record.userId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true, secure: true, sameSite: 'strict'
    });
    res.json({ access_token: newAccessToken, expires_in: 900 });
});
```

**Stateless vs Stateful JWT:**

| 항목 | Stateless JWT | Stateful JWT / Opaque Token |
|------|---------------|-----------------------------|
| 즉시 무효화 | 불가 (만료 전까지 유효) | 가능 (DB에서 삭제) |
| 성능 | 빠름 (DB 조회 없음, ~1ms) | DB 조회 필요 (~10-20ms) |
| 수평 확장 | 용이 (서버 간 공유 불필요) | DB/Redis 공유 필요 |
| 강제 로그아웃 | 어려움 (Blacklist 필요) | 쉬움 |
| 보안 사고 시 | 전체 서명 키 교체 필요 | 개별 토큰 즉시 무효화 |

**실무 권장**: Access Token은 Stateless, Refresh Token은 Stateful (Clerk의 하이브리드 접근)

## 5.5 방식 5: Device/Browser Fingerprinting 결합

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 5: Fingerprinting + Remember Me                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  핑거프린트 구성 요소:                                                     │
│  fingerprint = hash(userAgent + screen + timezone + fonts +                │
│                     canvas + WebGL + audio + language + platform)           │
│                                                                             │
│  최초 등록:                                                                │
│  [브라우저]                       [서버]                                   │
│     │ 로그인 성공                  │                                       │
│     │ JS: 핑거프린트 계산          │                                       │
│     │ ───────────────────────────▶│                                       │
│     │                              │ {token, fingerprint_hash} 저장       │
│     │ Cookie: rm_token=xxx         │                                       │
│     │ ◀───────────────────────────│                                       │
│                                                                             │
│  재방문 시:                                                                │
│  [브라우저]                       [서버]                                   │
│     │ Cookie(rm_token) +           │                                       │
│     │ 현재 fingerprint              │                                       │
│     │ ───────────────────────────▶│                                       │
│     │                              │ 저장된 fp와 비교                     │
│     │                              │                                       │
│     │                              ├── 일치: 인증 성공                    │
│     │                              └── 불일치: Step-up Auth 요구          │
│                                                                             │
│  Risk Score = f(device_fp, ip_history, login_time,                         │
│                geolocation, vpn_detection, behavioral_biometrics)           │
│                                                                             │
│  ⚠ 한계:                                                                   │
│  ├── 모바일 기기: 핑거프린트 유사성 높아 신뢰성 낮음                     │
│  ├── 핑거프린트 스푸핑 가능                                               │
│  └── 유일한 보안 수단이 아닌 "추가적 신호(signal)"로만 사용              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.6 방식 6: OAuth 2.0/OIDC 기반 세션 관리

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 6: OAuth 2.0 / OIDC 세션 계층 구조                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │  [IdP Session] (Google/Okta, 수일~수년)                 │               │
│  │       │                                                  │               │
│  │       ▼                                                  │               │
│  │  [Application Session] (앱 자체 세션, 수분~수시간)       │               │
│  │       │                                                  │               │
│  │       ▼                                                  │               │
│  │  [Resource Access] (Access Token, 15분~1시간)            │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  Silent Authentication (prompt=none):                                      │
│                                                                             │
│  [클라이언트]            [IdP]                                             │
│     │ AT 만료 감지        │                                                │
│     │ Hidden iframe:      │                                                │
│     │ GET /authorize?     │                                                │
│     │  prompt=none        │                                                │
│     │ ──────────────────▶│                                                │
│     │                     │ 기존 세션 쿠키 확인                            │
│     │                     ├── 유효: 새 Auth Code 발급                     │
│     │                     └── 없음: login_required 에러                   │
│     │ ◀──────────────────│                                                │
│                                                                             │
│  `offline_access` 스코프 = OAuth2/OIDC에서의 "Remember Me"               │
│  → Refresh Token 획득을 위해 인증 요청 시                                 │
│    scope=openid offline_access 포함                                        │
│                                                                             │
│  BFF (Backend for Frontend) 패턴:                                         │
│  [SPA] ←─ HttpOnly Cookie ──→ [BFF] ←─ Bearer Token ──→ [API]            │
│  → 브라우저에 토큰 절대 노출되지 않음                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.7 방식 7: WebAuthn/Passkeys 기반

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            방식 7: WebAuthn / Passkeys                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Passkeys = 비밀번호 + Remember Me 조합 자체를 불필요하게 만듦            │
│                                                                             │
│  등록 시:                                                                  │
│  [디바이스]                    [서버]                                      │
│     │ Public/Private Key 생성  │                                           │
│     │ (Private Key는 디바이스  │                                           │
│     │  밖으로 절대 나가지 않음)│                                           │
│     │ ──── Public Key ────────▶│ 저장                                     │
│                                                                             │
│  인증 시:                                                                  │
│  [디바이스]                    [서버]                                      │
│     │                          │                                           │
│     │ ◀──── Challenge ─────────│                                           │
│     │ 생체인증(Face ID/지문)   │                                           │
│     │ Private Key로 서명       │                                           │
│     │ ──── Signed Response ──▶│ Public Key로 검증                        │
│     │                          │ → 인증 성공                              │
│                                                                             │
│  Conditional UI (자동완성 통합):                                           │
│  ┌─────────────────────────────────────────────────┐                      │
│  │  <input autocomplete="username webauthn">        │                      │
│  │  → 브라우저 자동완성 dropdown에 Passkeys 표시    │                      │
│  │  → 사용자: 선택 → 생체인증 → 즉시 로그인        │                      │
│  │  → "Remember Me" 체크박스의 UX적 역할 완전 흡수  │                      │
│  └─────────────────────────────────────────────────┘                      │
│                                                                             │
│  패러다임 전환:                                                            │
│  ├── 기존: 서버가 기억 (토큰→DB, 쿠키→증거)                              │
│  ├── Passkeys: 기기가 기억 (Private Key→기기, Public Key→서버)            │
│  └── → Cookie 탈취 공격 근본적 무력화                                     │
│                                                                             │
│  한계:                                                                     │
│  ├── 인증 수단이지 세션 관리 방식이 아님                                  │
│  ├── 인증 성공 후 별도 Session/Token 발급 필요                            │
│  └── 기기 분실 시 복구 필요 (Synced Passkey로 해결)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Passkeys 코드 예시:**

```javascript
// WebAuthn Conditional UI 초기화
const options = await getAuthenticationOptions();
const credential = await navigator.credentials.get({
    publicKey: options,
    mediation: 'conditional'  // 자동완성 dropdown에 Passkeys 표시
});
```

```html
<input type="text" id="username" autocomplete="username webauthn">
```

## 5.8 7가지 방식 아키텍처 비교 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  7가지 방식 아키텍처 비교 요약                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  방식 1: [쿠키: username:password] ←──→ [서버: DB 직접 조회]              │
│          ↑ 극도로 위험. 절대 사용 금지                                     │
│                                                                             │
│  방식 2: [쿠키: session_id] ←──→ [서버: Session Store (Redis/DB)]          │
│          ↑ 안전하나 서버 상태 필요. 가장 단순한 안전 구현                  │
│                                                                             │
│  방식 3: [쿠키: username:series:token] ←──→ [서버: persistent_logins DB]   │
│          ↑ 도난 감지 가능. 전통적 웹앱에 가장 권장                         │
│                                                                             │
│  방식 4: [메모리: access_token] + [쿠키: refresh_token] ←──→ [서버: DB]   │
│          ↑ 현대적 SPA/마이크로서비스에 적합                                │
│                                                                             │
│  방식 5: [쿠키: remember_token] + [JS: fingerprint] ←──→ [서버: DB]       │
│          ↑ 추가적 보안 신호. 단독 사용 부적절                              │
│                                                                             │
│  방식 6: [쿠키: IdP 세션] + [메모리: AT] + [쿠키: RT] ←──→ [IdP + API]   │
│          ↑ Enterprise SSO 환경에 적합                                      │
│                                                                             │
│  방식 7: [Authenticator: Private Key] ←──→ [서버: Public Key]             │
│          ↑ 비밀번호 + Remember Me 자체를 대체. 미래의 표준                 │
│                                                                             │
│  최종 권장:                                                                │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ 전통적 웹앱         → 방식 3 (Series+Token)                 │           │
│  │ SPA + REST API      → 방식 4 (JWT + Refresh Rotation)       │           │
│  │ Enterprise SSO      → 방식 6 (OAuth2/OIDC)                  │           │
│  │ 최고 보안 요구      → 방식 7 (Passkeys) + 방식 3/4          │           │
│  │ 고위험 앱 (금융)    → Stateful Session + 방식 5 (기기 확인) │           │
│  │ 빠른 구현 필요      → 방식 2 (Server-side Session)           │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.9 프레임워크별 Remember Me 구현 비교

| 프레임워크 | 내장 방식 | Series+Token 지원 | 커스터마이징 | 비고 |
|-----------|-----------|------------------|-------------|------|
| **Spring Security** | Hash 기반 + Persistent (DB) | 내장 (`PersistentTokenBasedRememberMeServices`) | 높음 | Barry Jaspan 방식 직접 구현. 업계 레퍼런스 |
| **Django** | Session 기반 (`set_expiry`) | 미지원 (커스텀 필요) | 중간 | `django-allauth` 등 서드파티로 보완 |
| **Express.js** | `passport-remember-me` | 미내장 (커스텀 구현) | 높음 | Passport 전략 패턴으로 유연한 확장 |
| **Laravel** | `remember_token` 컬럼 | 미지원 (단일 토큰) | 중간 | Sanctum으로 API 토큰 관리 가능 |
| **Auth.js (NextAuth)** | JWT/Database 세션 전략 | 미지원 | 중간 | `maxAge`로 만료 제어, 동적 만료는 커스텀 필요 |
| **ASP.NET Core** | Cookie Authentication | 미내장 | 높음 | Sliding/Absolute Expiration 네이티브 지원 |

---

# 6. 스토리지 선택지 비교

## 6.1 저장소별 보안 특성

| 저장소 | XSS 취약성 | CSRF 취약성 | 영속성 | 용량 | 권장 용도 |
|--------|-----------|-------------|--------|------|-----------|
| **HttpOnly Cookie** | 낮음 (JS 접근 불가) | 있음 (SameSite로 완화) | 설정 가능 | 4KB | Refresh Token, Session ID |
| **일반 Cookie** | 높음 (JS 접근 가능) | 있음 | 설정 가능 | 4KB | 비민감 설정값 |
| **localStorage** | 높음 (JS 직접 접근) | 없음 (자동 전송 안 됨) | 영구 | 5MB | 비민감 데이터 |
| **sessionStorage** | 높음 | 없음 | 탭 닫으면 소멸 | 5MB | 임시 상태 |
| **IndexedDB** | 높음 (JS 접근) | 없음 | 영구 | 대용량 | 암호화 후 토큰 저장 가능 |
| **메모리 (JS 변수)** | 매우 낮음 | 없음 | 탭 닫으면 소멸 | 제한 없음 | Access Token |

## 6.2 OWASP 권장 저장 전략

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  OWASP 권장 토큰 저장 전략                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Access Token  → JavaScript 메모리 (전역 변수 금지, 함수 스코프 내)       │
│  Refresh Token → HttpOnly + Secure + SameSite=Strict Cookie               │
│  CSRF Token    → Custom Request Header 또는 숨겨진 form 필드              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  핵심 트레이드오프:                                         │           │
│  │  ├── localStorage: CSRF 안전하지만 XSS에 취약              │           │
│  │  ├── HttpOnly Cookie: XSS 안전하지만 CSRF에 취약           │           │
│  │  └── OWASP: "XSS가 발생하면 모든 CSRF 방어가 무력화됨"    │           │
│  │      → HttpOnly Cookie가 더 안전한 선택                    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 BFF (Backend-for-Frontend) 패턴

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BFF 패턴 아키텍처                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [SPA 브라우저]                                                            │
│     │                                                                      │
│     │ HTTPS + HttpOnly Cookie (세션 쿠키만 전달)                           │
│     │ ← 토큰이 브라우저에 절대 노출되지 않음                              │
│     ▼                                                                      │
│  [BFF 서버 (Node.js/Nginx)]                                               │
│     │                                                                      │
│     │ 토큰을 서버 측에서 관리                                             │
│     │ Authorization Header + Access Token                                  │
│     ▼                                                                      │
│  [Authorization Server]  /  [Resource Server (API)]                        │
│                                                                             │
│  장점:                                                                     │
│  ├── XSS 공격 성공해도 토큰 직접 탈취 불가                               │
│  ├── BFF가 OAuth 2.0 Confidential Client 역할                             │
│  └── Curity, WSO2, Auth0 공식 권장 패턴                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. 종합 비교표

## 7.1 방식별 핵심 특성 비교

| 방식 | 보안 수준 | 확장성 | 구현 복잡도 | 서버 부하 | UX | Token Theft Detection | 강제 로그아웃 | Stateless |
|------|-----------|--------|-------------|-----------|----|-----------------------|--------------|-----------|
| Server-side Session (Redis) | 높음 | 중간 | 낮음 | 중간 | 보통 | 불가 | **즉시 가능** | No |
| Persistent Cookie (Simple Hash) | 낮~중 | 높음 | 낮음 | 낮음 | 좋음 | 불가 | 가능 | No |
| Series+Token (Jaspan) | 중~높 | 중간 | 중간 | 중간 | 좋음 | **가능** | 가능 | No |
| JWT Access+Refresh | 중간 | **매우 높음** | 중간 | 매우 낮음 | 좋음 | 제한적 | 복잡 | AT만 Yes |
| JWT+Refresh Rotation | 높음 | 높음 | 높음 | 낮음 | 좋음 | **가능** | 가능 | Partial |
| OAuth 2.0/OIDC | 높음 | 매우 높음 | 매우 높음 | 중간 | 복잡 | 가능 | **IdP 즉시** | Partial |
| WebAuthn/Passkeys | **매우 높음** | 높음 | 높음 | 낮음 | **매우 좋음** | 불필요 | 가능 | No |

## 7.2 보안 위협별 비교

| 방식 | CSRF | XSS | Token Theft | Session Fixation | Replay Attack |
|------|------|-----|-------------|------------------|---------------|
| Session Cookie (HttpOnly) | 취약 (SameSite로 완화) | 안전 | 불가 감지 | 취약 (ID 갱신 필수) | 낮음 |
| JWT (localStorage) | 안전 | **매우 취약** | 불가 감지 | 낮음 | 중간 |
| JWT (HttpOnly Cookie) | 취약 (SameSite) | 안전 | 불가 감지 | 낮음 | 중간 |
| Series+Token | 취약 (SameSite) | 안전 (HttpOnly) | **감지 가능** | 낮음 | 중간 |
| JWT+Rotation | 취약 (SameSite) | 안전 (HttpOnly) | **감지 가능** | 낮음 | 중간 |
| WebAuthn | **안전** (도메인 바인딩) | 안전 | 불필요 | **없음** | **없음** |

## 7.3 성능 비교

| 방식 | 인증 확인 시간 | 서버 저장 공간 | Cookie/Token 크기 | 수평 확장 |
|------|---------------|---------------|-------------------|-----------|
| JWT (Stateless) | ~0.1-1ms | 0 | 300-500 bytes | **매우 쉬움** |
| Session (Redis) | ~0.5-2ms | ~500bytes/user | 16-32 bytes | 쉬움 |
| Session (DB) | ~5-50ms | ~200bytes/row | 16-32 bytes | 중간 |
| Series+Token | ~5-50ms | ~200bytes/device | ~100 bytes | 중간 |
| OAuth 2.0 (JWKS 캐시) | ~0.5-2ms | 위임 | 300-500 bytes | 쉬움 |

**Okta 분석**: Session Cookie 6 bytes vs JWT 304 bytes = **51배 크기 증가**. 월 100k 페이지뷰 기준 추가 24MB 대역폭.

---

# 8. 상황별 최적 선택

## 8.1 선택 가이드

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  상황별 Remember Me 최적 선택 가이드                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  보안 낮음/보통 + 단순 아키텍처                                            │
│  → Server-side Session (Redis) + HttpOnly Cookie                           │
│                                                                             │
│  보안 낮음/보통 + 마이크로서비스                                           │
│  → JWT + Refresh Token Rotation + JWKS                                     │
│                                                                             │
│  보안 높음 + 단일 서비스                                                   │
│  → Server-side Session (Redis) + Series+Token + MFA                        │
│                                                                             │
│  보안 매우 높음 (금융/의료)                                                │
│  → Server-side Session + WebAuthn + 짧은 세션 + 강제 재인증               │
│                                                                             │
│  엔터프라이즈 / B2B SaaS                                                  │
│  → OAuth 2.0 + OIDC + SAML/SSO + SCIM                                     │
│                                                                             │
│  모바일 우선                                                               │
│  → OAuth 2.0 (PKCE) + Refresh Token Rotation + Secure Storage             │
│                                                                             │
│  SPA (보안 최우선)                                                         │
│  → BFF 패턴 + HttpOnly Session Cookie + OAuth 2.0                         │
│                                                                             │
│  IoT                                                                       │
│  → Device Authorization Flow (RFC 8628) + X.509 Certificate               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 상세 분석

| 상황 | 권장 방식 | Remember Me 기간 | 핵심 이유 |
|------|-----------|-----------------|-----------|
| 단일 서버 소규모 앱 | Session (DB/메모리) | 30일 | 구현 단순, JWT 불필요 |
| 마이크로서비스 | JWT + Refresh Rotation | 7-30일 | 각 서비스 독립 검증, JWKS 배포 |
| 모바일+웹 동시 | OAuth 2.0 + OIDC + PKCE | 웹 7일, 모바일 90일 | 동일 Auth Server, 플랫폼별 최적화 |
| 금융/헬스케어 | Session (Redis) + WebAuthn | 최대 24시간 | PCI DSS 15분 idle, 즉시 무효화 |
| 소셜 미디어 (UX 우선) | Session + Series+Token | 30-90일 | Token Theft 감지 + 다중 기기 허용 |
| SPA | BFF 패턴 | BFF 세션 기반 | 브라우저에 토큰 노출 없음 |
| SSR | Session (Redis) + HttpOnly | maxAge 기반 | 자연스러운 Session 인증 |
| 하이브리드 (SSR+SPA) | Session Cookie + AT | 공유 Redis | SSR: Cookie, SPA: Session에서 AT 발급 |
| B2B SaaS | OAuth 2.0 + OIDC + SAML | 고객사별 정책 | 테넌트별 IdP 연동, SCIM 자동화 |
| IoT | Device Auth Flow + X.509 | Certificate 기반 | 브라우저 없는 환경, 하드웨어 저장소 |

---

# 9. 실제 서비스 사례

| 서비스 | 기반 기술 | 주요 Cookie | Remember Me 만료 | 특이사항 |
|--------|-----------|------------|-----------------|----------|
| **Google** | GAIA 내부 시스템 + Multi-login | SID, HSID, SSID, APISID, SAPISID | SID/HSID: **2년** | 비밀번호 변경해도 토큰이 즉시 무효화되지 않는 설계 (UX 지속성) |
| **Facebook/Meta** | 자체 분산 세션 스토어 | `xs` (인증), `c_user` (식별), `datr` (브라우저 지문) | **90일** (Keep me logged in) | `datr` 쿠키 2년 만료, 브라우저 식별 및 봇 탐지 |
| **GitHub** | Server-side Session + Rails | `user_session`, `__Host-user_session_same_site` | **2주** (비활성 시) | `__Host-` 프리픽스 사용. SSO 재인증 기본 6시간 |
| **Netflix** | MSL (Message Security Layer) | `NetflixId`, `SecureNetflixId` | **365일** | 2025년부터 Cookie를 특정 디바이스에 바인딩 |
| **Amazon** | 자체 대규모 분산 시스템 | 인증 Cookie | **365일** | 쇼핑카트 유지와 인증 세션 분리 구조 |
| **Twitter/X** | Cookie 세션 + ct0 CSRF | `auth_token`, `ct0` (CSRF) | 수개월~무기한 (공식 미공개) | `ct0` 6시간 만료 Double Submit Cookie 패턴 |

---

# 10. 베스트 프랙티스

## 10.1 Cookie 설정

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Cookie 설정 베스트 프랙티스                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Set-Cookie: __Host-remember_token=<token>;                                │
│              HttpOnly;         ← JS 접근 차단 (XSS 방어)                  │
│              Secure;           ← HTTPS 전용 (MITM 방어)                   │
│              SameSite=Lax;     ← CSRF 방어 (일반 웹서비스)                │
│              Path=/;           ← 전체 경로                                 │
│              Max-Age=1209600;  ← 2주 (초 단위)                            │
│                                                                             │
│  __Host- 프리픽스 효과:                                                    │
│  ├── Secure 속성 자동 강제                                                │
│  ├── HTTPS 페이지에서만 설정 가능                                         │
│  ├── Domain 속성 금지 (서브도메인 누수 원천 차단)                         │
│  └── Path=/ 강제                                                          │
│                                                                             │
│  Max-Age 권장값:                                                           │
│  ├── 금융/의료/고보안: 사용 비권장 또는 최대 24시간                      │
│  ├── 일반 SaaS/소셜: 7~30일                                              │
│  └── 저위험 콘텐츠: 최대 90일 (Troy Hunt 권고 상한선)                    │
│                                                                             │
│  SameSite 선택:                                                            │
│  ├── Strict: 금융/관리자 앱 (외부 링크 방문 시 쿠키 미전송)              │
│  ├── Lax: 일반 웹서비스 (권장. GET 요청에만 전송)                        │
│  └── None: SSO cross-site (반드시 Secure 병행)                            │
│                                                                             │
│  ⚠ 현실: HTTP Archive 2024 데이터 기준, 전체 쿠키의 0.032%만              │
│     __Host- 프리픽스 사용. 새 프로젝트에서는 적극 채택 권장               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Token 관리

| 항목 | 권장 사항 |
|------|-----------|
| **토큰 생성** | CSPRNG 필수 (Python: `secrets.token_urlsafe(32)`, Java: `SecureRandom`, Node: `crypto.randomBytes(32)`) |
| **엔트로피** | 최소 128비트 (16바이트 랜덤, hex 인코딩 시 32자). OWASP 64비트 최소, Remember Me는 수명이 길므로 128비트 |
| **DB 저장** | SHA-256 해시만 저장. 평문 절대 금지. 검증 시 상수 시간 비교(constant-time) 수행 |
| **Token Rotation** | 매 인증 시 새 토큰으로 교체. 탈취된 토큰의 유효 창(window) 최소화 |
| **Token Revocation** | 로그아웃/비밀번호 변경/2FA 변경/계정 잠금/이상 감지 시 모든 토큰 삭제 |

## 10.3 세션 관리

| 항목 | 설명 | 권장값 |
|------|------|--------|
| Idle Timeout | 마지막 활동 후 만료 | 고보안: 2-5분, 일반: 15-30분 |
| Absolute Timeout | 로그인 후 강제 만료 | 4-8시간 |
| Session Fixation 방지 | 로그인 성공 후 새 Session ID 생성 | 필수 (프레임워크 자동 처리 확인) |
| Concurrent Session | 사용자당 활성 세션 수 제한 | 보안 앱: 단일 세션, 일반: 다중+모니터링 |
| 비밀번호 변경 시 | 현재 세션 제외 모든 세션+토큰 무효화 | OWASP 명시적 권고 |

## 10.4 보안 강화 패턴

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  보안 강화 패턴                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 계층적 방어 (Defense in Depth):                                        │
│  Layer 1: HTTPS (전송 암호화)                                              │
│  Layer 2: HttpOnly + Secure + SameSite (쿠키 보안)                        │
│  Layer 3: CSRF Token (CSRF 방어)                                           │
│  Layer 4: Token Rotation (탈취 후 재사용 방지)                             │
│  Layer 5: Theft Detection (Series+Token 또는 Family)                       │
│  Layer 6: IP/Geolocation 이상 감지                                         │
│  Layer 7: 민감 작업 시 재인증 요구                                         │
│                                                                             │
│  2. Step-up Authentication:                                                │
│  Remember Me 자동 로그인 = "낮은 신뢰도 세션"                             │
│  다음 작업 시 비밀번호 재입력 또는 MFA 요구:                              │
│  ├── 비밀번호 변경                                                        │
│  ├── 이메일/전화번호 변경                                                 │
│  ├── 결제 정보 접근                                                       │
│  ├── 계정 삭제                                                            │
│  └── 관리자 권한 행사                                                     │
│  상승된 신뢰도는 15~30분 유지                                             │
│                                                                             │
│  3. "Remember Me" vs "Remember This Device" 구분:                         │
│  ├── Remember Me: 로그인 자격증명 기억 → 일반적 구현                     │
│  └── Remember This Device: MFA 면제 → MFA bypass, 높은 위험              │
│      Microsoft 권장: 최대 90일, 기기 분실 시 즉시 무효화 기능 필수        │
│                                                                             │
│  4. Risk-based Authentication:                                             │
│  위험 신호: 알 수 없는 IP, 비정상 시간대, 신규 디바이스,                  │
│            Impossible Travel (짧은 시간 내 다수 국가)                      │
│  대응: 허용 → CAPTCHA → Step-up MFA → 접근 차단                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.5 OWASP Remember Me 보안 체크리스트

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  OWASP Remember Me 보안 체크리스트                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  토큰 속성:                                                                │
│  [ ] 세션 ID: 최소 64비트 엔트로피                                        │
│  [ ] Remember Me 토큰: 최소 128비트 엔트로피                              │
│  [ ] CSPRNG으로 생성                                                      │
│  [ ] 의미 있는 값(사용자 ID, 이메일 등) 포함 금지                         │
│  [ ] 프레임워크 기본 세션 ID 이름(PHPSESSID 등) 변경                      │
│                                                                             │
│  쿠키 속성:                                                                │
│  [ ] HttpOnly 필수 설정                                                   │
│  [ ] Secure 필수 설정                                                     │
│  [ ] SameSite=Strict 또는 Lax 설정                                        │
│  [ ] 적절한 Domain 범위 (와일드카드 금지)                                 │
│  [ ] __Host- 프리픽스 사용 검토                                           │
│                                                                             │
│  생명주기 관리:                                                            │
│  [ ] 로그인 후 세션 ID 재생성 (Session Fixation 방지)                     │
│  [ ] Idle Timeout 서버 측 강제                                            │
│  [ ] Absolute Timeout 적용                                                │
│  [ ] 로그아웃 시 서버 측 세션 완전 삭제                                   │
│  [ ] 비밀번호 변경 시 모든 세션/토큰 무효화                               │
│                                                                             │
│  모니터링:                                                                 │
│  [ ] 세션 ID를 해싱하여 로그에 기록                                       │
│  [ ] 동시 로그인 이상 감지                                                │
│  [ ] 다중 세션 ID 추측 시도 탐지                                          │
│                                                                             │
│  OWASP WSTG-ATHN-05 테스트 항목:                                          │
│  [ ] 브라우저 저장소에서 평문/디코딩 가능한 자격증명 확인                 │
│  [ ] 자동 입력 자격증명이 Clickjacking/CSRF에 취약한지 확인              │
│  [ ] 토큰 만료 정책 검증 (무한 만료 토큰 확인)                           │
│  [ ] 서버 측 토큰 무효화 검증                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 11. 안티패턴

## 11.1 10가지 위험한 구현 패턴

| # | 안티패턴 | 왜 위험한가 | 올바른 방법 |
|---|---------|------------|------------|
| 1 | 비밀번호를 평문/Base64로 쿠키 저장 | 탈취=비밀번호 노출. 로그에도 기록됨 | 랜덤 토큰만 저장 |
| 2 | 예측 가능한 토큰 생성 (`MD5(user+timestamp)`) | 공격자가 알고리즘 역추산 가능 | CSPRNG 128비트 이상 |
| 3 | 토큰을 해싱 없이 DB 저장 | DB 침해 시 모든 세션 즉시 탈취 | SHA-256 해시만 저장 |
| 4 | 로그아웃 시 서버 측 토큰 미삭제 | 탈취된 쿠키 여전히 유효 | 서버 DB에서 레코드 삭제 |
| 5 | 비밀번호 변경 시 토큰 미무효화 | 공격자가 기존 토큰으로 계속 접근 | 모든 토큰 즉시 삭제 |
| 6 | JWT를 localStorage에 저장 | XSS 시 즉시 탈취 | HttpOnly Cookie 또는 메모리 |
| 7 | 토큰에 만료 없음 (영구 토큰) | 한 번 탈취=영구 악용. FBI 경보 대상 | 반드시 만료 설정 |
| 8 | CSRF 토큰 없이 Cookie 인증만 사용 | 자동 쿠키 전송으로 위조 요청 가능 | SameSite + CSRF Token |
| 9 | SameSite 미설정 | 브라우저별 동작 불일치, 예측 불가 보안 | 명시적 Lax 또는 Strict |
| 10 | 와일드카드 도메인 Cookie | 서브도메인 XSS로 전체 쿠키 탈취 | `__Host-` 프리픽스 |

## 11.2 보안 사고 사례

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Remember Me 관련 보안 사고 사례                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. EA(Electronic Arts) 침해 (2021)                                       │
│  ├── 공격: Lapsus$ 그룹이 다크웹에서 EA 직원 세션 쿠키 구매               │
│  ├── 경로: 쿠키→Slack→IT지원팀 속임→소스코드 780GB 탈취                   │
│  └── 교훈: MFA 활성화되어도 세션 쿠키 탈취는 인증 완전 우회               │
│                                                                             │
│  2. Linus Tech Tips YouTube 하이재킹 (2023)                               │
│  ├── 공격: PDF 위장 악성 파일(.scr)로 쿠키 탈취 악성코드 실행             │
│  ├── 결과: Google/YouTube 세션 쿠키 탈취, MFA 없이 채널 접근              │
│  │         채널에서 암호화폐 사기 스트림 방영                              │
│  └── 교훈: 엔드포인트 보안 + 쿠키 수명 단축이 핵심                       │
│                                                                             │
│  3. 94억 개 탈취된 쿠키 (2024년 보고)                                     │
│  ├── 규모: 94억 개 브라우저 쿠키 수집, 20% 이상 활성 상태                │
│  └── 교훈: 쿠키 탈취는 대규모 산업. 수명 단축+기기 바인딩 필수           │
│                                                                             │
│  4. FBI 경보: Remember Me 쿠키 MFA 우회 (2024)                            │
│  ├── 내용: 30일 만료 Remember Me 쿠키 탈취로 MFA 완전 우회               │
│  ├── 대상: 이메일 계정 등                                                 │
│  └── 방어: Cookie Binding, 짧은 세션 수명, 이상 감지, Passkeys 전환       │
│                                                                             │
│  5. Spring Security Token Theft Detection 결함 (SEC-2856)                 │
│  ├── 문제: 동시 요청 시 정상 토큰이 "도난"으로 오인 (Race Condition)      │
│  └── 교훈: Token Rotation 시 동시 요청 처리를 위한                        │
│            grace period 또는 locking 메커니즘 필요                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 12. 규정/컴플라이언스

## 12.1 GDPR과 Remember Me

| 요구사항 | 상세 |
|---------|------|
| 동의 필요 여부 | Session Cookie는 GDPR 면제. Remember Me는 **Preferences Cookie로 명시적 동의 필요** |
| 동의 방식 | opt-in 필수 (opt-out 불가). "모든 쿠키 허용"과 번들링 금지 |
| 동의 철회 | 언제든지 가능. 철회 시 저장된 Remember Me 토큰 삭제 |
| 개인정보 처리방침 | Remember Me 기능과 데이터 처리 방식 명시 |
| 법적 근거 | ePrivacy Directive(쿠키법) + GDPR 결합 |

## 12.2 NIST SP 800-63B AAL

| AAL | 재인증 요구 | Remember Me 영향 |
|-----|------------|-----------------|
| AAL1 | 최소 30일마다 | 허용 (30일 이하 만료) |
| AAL2 | 12시간마다 (무활동 30분) | 제한적 허용 |
| AAL3 | 12시간마다 (무활동 15분) | **사실상 불가** (세션 시크릿 영속 불가) |

## 12.3 PCI DSS

| 요구사항 | 상세 |
|---------|------|
| 8.1.8 (비활동 타임아웃) | **15분 이상 비활동 시 세션 종료** (CDE 전체 적용) |
| Remember Me 영향 | CDE 접근 계정에는 Remember Me 자체가 의미 없음 (15분 idle 강제) |
| 결제 직원 계정 | Remember Me 제공 = PCI DSS 위반 소지 |
| 소비자 체크아웃 | CDE 직접 접근 아닌 경우 허용 가능. Secure Cookie 필수 |

---

# 13. 마이그레이션 가이드

## 13.1 Session → Token 기반 전환

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Session → Token 마이그레이션 4단계                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1단계: 현재 상태 감사                                                     │
│  ├── 기존 세션 저장 방식 (메모리/Redis/DB) 파악                           │
│  ├── Remember Me 구현 현황 확인                                           │
│  └── 토큰 만료/갱신 메커니즘 검토                                         │
│                                                                             │
│  2단계: DB 스키마 추가                                                     │
│  ├── remember_me_tokens 테이블 생성                                       │
│  │   (username, series, token_hash, expires_at)                            │
│  └── 기존 세션 테이블과 병행 운영                                         │
│                                                                             │
│  3단계: 병행 지원 (Feature Flag)                                           │
│  ├── 신규 로그인: Token-based Remember Me 적용                            │
│  └── 기존 세션: 만료 시까지 유지                                          │
│                                                                             │
│  4단계: 구버전 폐기                                                        │
│  └── 기존 세션 Remember Me 만료 후 코드 제거                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 13.2 Simple Cookie → Series+Token 전환

| 단계 | 작업 |
|------|------|
| 1 | DB에 `series` 컬럼 추가 (NOT NULL 제약 없이 시작) |
| 2 | 신규 로그인에서 Series+Token 방식 적용 |
| 3 | 구버전 토큰(series=NULL)은 만료까지 기존 방식으로 검증 |
| 4 | 마이그레이션 완료 후 series NOT NULL 제약 적용 |

**토큰 해시 마이그레이션 (평문→SHA-256):** 점진적 마이그레이션 불가 시, 배포 시 모든 Remember Me 토큰 무효화(전체 로그아웃) 후 재로그인 요구가 가장 안전.

## 13.3 JWT 도입 시 고려사항

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  JWT 도입 시 핵심 설계 결정                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Access Token:                                                             │
│  ├── 만료: 15~30분 (짧게)                                                 │
│  ├── 저장: JavaScript 메모리 (localStorage 절대 금지)                     │
│  └── Stateless: DB 조회 없이 서명 검증                                    │
│                                                                             │
│  Refresh Token (= Remember Me 역할):                                      │
│  ├── 만료: 7~14일 (서비스 정책에 따라)                                    │
│  ├── 저장: HttpOnly; Secure; SameSite=Strict Cookie                       │
│  ├── Stateful: DB에 해시값 저장, Token Rotation 적용                      │
│  └── Token Family: 재사용 감지 시 전체 family 무효화                      │
│                                                                             │
│  JWT Remember Me 함정:                                                     │
│  ├── JWT 자체는 서버에서 revocation 불가능                                │
│  ├── → Access Token 만료를 짧게 유지                                      │
│  ├── → Refresh Token은 반드시 서버 측 상태(DB) 유지                       │
│  └── → jti(JWT ID) claim으로 개별 토큰 추적+무효화                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 13.4 마이그레이션 시 공통 주의사항

| 단계 | 주의사항 |
|------|---------|
| 기존 토큰 처리 | 마이그레이션 중 기존 토큰과 신규 토큰 형식을 동시 지원해야 사용자 경험 유지 |
| 점진적 전환 | Feature Flag를 활용해 신규 로그인부터 새 방식 적용, 기존 세션은 자연 만료 |
| 강제 로그아웃 | 보안 우선 시 전체 토큰 무효화 후 재로그인 요구 (계획적 다운타임) |
| DB 스키마 | 구버전/신버전 토큰 테이블 병행 운영 후 마이그레이션 완료 시 정리 |
| 롤백 계획 | 새 방식에 문제 발생 시 구버전으로 즉시 복귀할 수 있는 전략 수립 |
| 모니터링 | 마이그레이션 기간 동안 인증 실패율, 로그인 성공률 등 핵심 메트릭 집중 모니터링 |
| 사용자 공지 | 전체 로그아웃이 필요한 경우 사전에 사용자에게 안내하여 혼란 방지 |

---

# 14. 참고자료

## 14.1 RFC 표준

- [RFC 6265 - HTTP State Management Mechanism (2011)](https://www.rfc-editor.org/rfc/rfc6265) - 현행 Cookie 표준
- [RFC 7519 - JSON Web Token (2015)](https://www.rfc-editor.org/rfc/rfc7519) - JWT 표준
- [RFC 6749 - OAuth 2.0 Authorization Framework (2012)](https://www.rfc-editor.org/rfc/rfc6749) - Refresh Token 포함
- [RFC 6750 - OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750) - Bearer Token 사용 방법
- [RFC 7235 - HTTP/1.1 Authentication (2014)](https://www.rfc-editor.org/rfc/rfc7235) - HTTP 인증 프레임워크
- [RFC 2109 - HTTP State Management Mechanism (1997)](https://tools.ietf.org/html/rfc2109) - 최초 공식 Cookie 표준
- [RFC 2965 - HTTP State Management Mechanism (2000)](https://www.ietf.org/rfc/rfc2965.txt) - Cookie2 (폐기됨)

## 14.2 OWASP 가이드

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Cross-Site Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP WSTG-ATHN-05: Testing for Vulnerable Remember Password](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/05-Testing_for_Vulnerable_Remember_Password)
- [OWASP HttpOnly](https://owasp.org/www-community/HttpOnly)
- [OWASP CSRF](https://owasp.org/www-community/attacks/csrf)
- [OWASP Credential Stuffing](https://owasp.org/www-community/attacks/Credential_stuffing)

## 14.3 NIST 표준

- [NIST SP 800-63B - Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST SP 800-63B-4 Session Management](https://pages.nist.gov/800-63-4/sp800-63b/session/)

## 14.4 핵심 블로그/논문

- [Persistent Login Cookie Best Practice - Charles Miller (The Fishbowl, 2004)](https://fishbowl.pastiche.org/2004/01/19/persistent_login_cookie_best_practice)
- [Improved Persistent Login Cookie Best Practice - Barry Jaspan (GitHub Gist)](https://gist.github.com/oleg-andreyev/9dcef18ca3687e12a071648c1abff782)
- [Troy Hunt: How to Build (and How Not to Build) a Secure "Remember Me" Feature](https://www.troyhunt.com/how-to-build-and-how-not-to-build/)
- [The Reasoning Behind Web Cookies - Lou Montulli's Blog](http://montulli.blogspot.com/2013/05/the-reasoning-behind-web-cookies.html)
- [Ten Years of JSON Web Token (JWT) - Mike Jones](https://self-issued.info/?p=2708)
- [Protecting Your Cookies: HttpOnly - Jeff Atwood / Coding Horror](https://blog.codinghorror.com/protecting-your-cookies-httponly/)
- [The Origins of Cross-Site Scripting (XSS) - Jeremiah Grossman](https://blog.jeremiahgrossman.com/2006/07/origins-of-cross-site-scripting-xss.html)

## 14.5 프레임워크/서비스 문서

- [Spring Security: Remember-Me Authentication](https://docs.spring.io/spring-security/reference/servlet/authentication/rememberme.html)
- [Spring Security: PersistentTokenBasedRememberMeServices API](https://docs.spring.io/spring-security/site/docs/current/api/org/springframework/security/web/authentication/rememberme/PersistentTokenBasedRememberMeServices.html)
- [Baeldung: Spring Security Persistent Remember Me](https://www.baeldung.com/spring-security-persistent-remember-me)
- [Django: How to Use Sessions](https://docs.djangoproject.com/en/6.0/topics/http/sessions/)
- [Laravel: Authentication](https://laravel.com/docs/12.x/authentication)
- [Laravel: Sanctum](https://laravel.com/docs/12.x/sanctum)
- [passport-remember-me (Express.js)](https://www.passportjs.org/packages/passport-remember-me/)
- [Auth.js: Session Strategies](https://authjs.dev/concepts/session-strategies)
- [Auth0: Refresh Tokens - What Are They and When to Use Them](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [Auth0: Refresh Token Security - Detecting Hijacking and Misuse](https://auth0.com/blog/refresh-token-security-detecting-hijacking-and-misuse-with-auth0/)

## 14.6 보안 분석/경고

- [FBI: Cybercriminals Are Stealing Cookies to Bypass MFA (2024)](https://www.fbi.gov/contact-us/field-offices/atlanta/news/cybercriminals-are-stealing-cookies-to-bypass-multifactor-authentication)
- [Check Point: Remember Me Cookies Under Exploit](https://emailsecurity.checkpoint.com/blog/remember-me-cookies-under-exploit-in-account-takeover-attempts)
- [CloudSEK: Compromising Google Accounts via OAuth2 Session Hijacking](https://www.cloudsek.com/blog/compromising-google-accounts-malwares-exploiting-undocumented-oauth2-functionality-for-session-hijacking)
- [Spring Security Issue #3079 (SEC-2856): Cookie Theft Detection](https://github.com/spring-projects/spring-security/issues/3079)
- [PortSwigger: Vulnerabilities in Other Authentication Mechanisms](https://portswigger.net/web-security/authentication/other-mechanisms)

## 14.7 기술 해설

- [SameSite Cookies Explained - web.dev](https://web.dev/articles/samesite-cookies-explained)
- [Preventing CSRF Attacks with SameSite Cookie Attribute - Invicti](https://www.invicti.com/blog/web-security/same-site-cookie-attribute-prevent-cross-site-request-forgery/)
- [SuperTokens: Cookies vs LocalStorage for Sessions](https://supertokens.com/blog/cookies-vs-localstorage-for-sessions-everything-you-need-to-know)
- [Clerk: The Future of Authentication is Both Stateful and Stateless](https://clerk.com/blog/future-of-auth-stateless-and-stateful)
- [Redis: JSON Web Tokens (JWT) are Dangerous for User Sessions](https://redis.io/blog/json-web-tokens-jwt-are-dangerous-for-user-sessions/)
- [Okta Developer: Why JWTs Suck as Session Tokens](https://developer.okta.com/blog/2017/08/17/why-jwts-suck-as-session-tokens)
- [MDN: Secure Cookie Configuration](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies)
- [Web Almanac 2024: Cookies](https://almanac.httparchive.org/en/2024/cookies)

## 14.8 WebAuthn/Passkeys

- [FIDO Passkeys - FIDO Alliance](https://fidoalliance.org/passkeys/)
- [Apple, Google, Microsoft Commit to Expanded Support for FIDO Standard (2022)](https://www.apple.com/newsroom/2022/05/apple-google-and-microsoft-commit-to-expanded-support-for-fido-standard/)
- [web.dev: Discoverable Credentials Deep Dive](https://web.dev/articles/webauthn-discoverable-credentials)
- [Corbado: WebAuthn Conditional UI](https://www.corbado.com/blog/webauthn-conditional-ui-passkeys-autofill)
- [MDN: Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [FusionAuth: Authentication With WebAuthn & Passkeys](https://fusionauth.io/docs/lifecycle/authenticate-users/passwordless/webauthn-passkeys)

## 14.9 어원/역사

- [Louis Montulli II Invents the HTTP Cookie - History of Information](https://www.historyofinformation.com/detail.php?id=2102)
- [Lou Montulli and the Invention of Cookie - Hidden Heroes (Netguru)](https://hiddenheroes.netguru.com/lou-montulli)
- [HTTP Cookie - Wikipedia](https://en.wikipedia.org/wiki/HTTP_cookie)
- [Session (Computer Science) - Wikipedia](https://en.wikipedia.org/wiki/Session_(computer_science))
- [Token - Etymology, Origin & Meaning - Etymonline](https://www.etymonline.com/word/token)
- [sessio - Wiktionary](https://en.wiktionary.org/wiki/sessio)
- [Cross-Site Request Forgery - Wikipedia](https://en.wikipedia.org/wiki/Cross-site_request_forgery)
- [Cross-Site Scripting - Wikipedia](https://en.wikipedia.org/wiki/Cross-site_scripting)
- [Credential Stuffing - Wikipedia](https://en.wikipedia.org/wiki/Credential_stuffing)
- [OAuth 2.0 Bearer Token Usage - oauth.net](https://oauth.net/2/bearer-tokens/)

## 14.10 컴플라이언스

- [GDPR.eu: Cookies and the GDPR](https://gdpr.eu/cookies/)
- [PCI DSS Session Timeout Requirements](https://pcidssguide.com/pci-dss-session-timeout-requirements/)
- [Preparing for the End of Third-Party Cookies - Google Privacy Sandbox](https://developers.google.com/privacy-sandbox/blog/cookie-countdown-2023oct)

## 14.11 추가 참고

- [Netflix MSL: Netflix ID Cookies User Authentication](https://github.com/Netflix/msl/wiki/Netflix-ID-Cookies-User-Authentication)
- [Google: How Google Uses Cookies](https://policies.google.com/technologies/cookies)
- [Facebook: Cookies on Meta Products](https://www.facebook.com/help/336858938174917)
- [AWS: Understanding Authentication Sessions in IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/authconcept.html)
- [Curity: Using OAuth for SPA Best Practices](https://curity.io/resources/learn/spa-best-practices/)
- [microservices.io: Authentication in Microservice Architecture (2025)](https://microservices.io/post/architecture/2025/05/28/microservices-authn-authz-part-2-authentication.html)
- [Sliding and Absolute Expiration - Brock Allen](https://brockallen.com/2014/11/18/sliding-and-absolute-expiration-with-cookie-authentication-middleware/)
- [Full Third-Party Cookie Blocking and More - WebKit Blog](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
- [Bearer Token - Postman Blog](https://blog.postman.com/what-is-a-bearer-token/)
- [Persistent Login in React Using Refresh Token Rotation - LogRocket](https://blog.logrocket.com/persistent-login-in-react-using-refresh-token-rotation/)
- [Descope: The Developer's Guide to Refresh Token Rotation](https://www.descope.com/blog/post/refresh-token-rotation)
- [Okta: Refresh Access Tokens and Rotate Refresh Tokens](https://developer.okta.com/docs/guides/refresh-tokens/main/)
- [OpenID Connect Session Management 1.0](https://openid.net/specs/openid-connect-session-1_0.html)
