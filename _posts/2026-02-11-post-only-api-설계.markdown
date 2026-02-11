---
layout: single
title: "POST only API 설계 패턴"
date: 2026-02-11 11:20:00 +0900
categories: backend
excerpt: "CCK 프로젝트에서는 모든 API 엔드포인트에 **POST 메서드만 사용**하는 정책을 적용하고 있습니다. 이 문서에서는 이러한 설계 결정의 배경, 보안적 이점, 기술적 장점을 상세히 설명합니다."
toc: true
toc_sticky: true
tags: [POST only, API 설계, 보안, CSRF, URL 노출, RPC, RESTful, CCK 가이드라인]
---

# TL;DR
- **POST only API 설계 패턴의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
CCK 프로젝트에서는 모든 API 엔드포인트에 **POST 메서드만 사용**하는 정책을 적용하고 있습니다. 이 문서에서는 이러한 설계 결정의 배경, 보안적 이점, 기술적 장점을 상세히 설명합니다.

## 2. 배경
POST only API 설계 패턴이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
**일관성과 단순성**: RESTful 방식보다 명시적인 액션 기반 엔드포인트를 선호합니다. - **일관된 요청/응답 구조**: 모든 API가 동일한 패턴을 따름 - **복잡한 파라미터 전달**: POST body를 통해 복잡한 객체도 쉽게 전달 - **캐싱 이슈 해결**: GET 요청의 브라우저 캐싱 문제 회피 - **보안**: URL에 민감한 정보 노출 방지

## 4. 특징
- 역사적 배경: RESTful vs RPC 스타일
- 보안적 이점 (핵심 이유)
- 기술적 이점
- CCK 가이드라인 원본 근거
- 모든 API가 POST 방식인 이유

## 5. 상세 내용

> **작성일**: 2026-02-02
> **키워드**: POST only, API 설계, 보안, CSRF, URL 노출, RPC, RESTful, CCK 가이드라인

---

## 개요

CCK 프로젝트에서는 모든 API 엔드포인트에 **POST 메서드만 사용**하는 정책을 적용하고 있습니다. 이 문서에서는 이러한 설계 결정의 배경, 보안적 이점, 기술적 장점을 상세히 설명합니다.

---

## 1. 역사적 배경: RESTful vs RPC 스타일

### 1.1 전통적인 RESTful API

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    전통적인 RESTful API 설계                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP 메서드 = CRUD 매핑                                                     │
│                                                                             │
│  GET    /users/123      →  조회 (Read)                                      │
│  POST   /users          →  생성 (Create)                                    │
│  PUT    /users/123      →  수정 (Update)                                    │
│  DELETE /users/123      →  삭제 (Delete)                                    │
│                                                                             │
│  📚 REST 원칙: Roy Fielding의 2000년 박사 논문에서 정의                      │
│     - 자원(Resource) 중심 설계                                              │
│     - HTTP 메서드로 행위(Action) 표현                                        │
│     - URL은 명사형 (자원 식별자)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**REST(Representational State Transfer)**는 2000년 Roy Fielding의 박사 논문에서 제안된 아키텍처 스타일입니다. HTTP 메서드를 CRUD 연산에 매핑하고, URL은 자원을 식별하는 명사형으로 구성하는 것이 핵심입니다.

### 1.2 실무에서의 문제점

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESTful 방식의 실무 문제점                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 복잡한 비즈니스 로직이 CRUD에 안 맞음                                    │
│     POST /orders/123/approve   ← 이게 뭔 메서드지? POST? PUT?               │
│     POST /users/123/send-email ← 이것도 애매...                             │
│                                                                             │
│  2. URL에 민감 정보가 노출됨                                                 │
│     GET /users/secret-uuid-12345                                            │
│     DELETE /payments/card-number-1234                                       │
│                                                                             │
│  3. 파라미터 전달이 제한적                                                   │
│     GET /search?keyword=abc&filter[0]=x&filter[1]=y...   (URL 길이 제한)    │
│                                                                             │
│  4. HTTP 메서드 선택에 대한 끊임없는 논쟁                                    │
│     "이거 PUT이야 PATCH야?" "DELETE인데 body 넣어도 돼?"                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

실제 비즈니스 로직은 단순한 CRUD로 표현하기 어려운 경우가 많습니다. "주문 승인", "이메일 발송", "보고서 생성" 같은 액션들은 어떤 HTTP 메서드를 사용해야 할지 명확하지 않습니다.

### 1.3 RPC 스타일의 등장

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RPC (Remote Procedure Call) 스타일                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /v1/user/create-user       →  사용자 생성                             │
│  POST /v1/user/get-user          →  사용자 조회                             │
│  POST /v1/user/update-user       →  사용자 수정                             │
│  POST /v1/user/delete-user       →  사용자 삭제                             │
│  POST /v1/order/approve-order    →  주문 승인 (비CRUD도 명확!)              │
│                                                                             │
│  📚 액션(Action) 기반 설계                                                   │
│     - URL이 "무엇을 하는지" 명확히 표현                                      │
│     - 모든 요청이 동일한 POST 메서드                                         │
│     - Body에 모든 파라미터 포함                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

RPC 스타일에서는 URL 자체가 "어떤 동작을 수행할지"를 명확히 표현합니다. HTTP 메서드 선택에 대한 논쟁이 사라지고, 모든 API가 일관된 패턴을 따르게 됩니다.

---

## 2. 보안적 이점 (핵심 이유)

### 2.1 URL 노출 문제

GET 요청의 URL은 여러 곳에 자동으로 기록되어 민감한 정보가 노출될 수 있습니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GET 요청의 URL 노출 경로                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 GET 요청의 URL은 다음 곳에 자동 기록됨:                                  │
│                                                                             │
│  1. 브라우저 히스토리                                                        │
│     └── 공용 PC에서 다음 사용자가 볼 수 있음                                 │
│     └── 브라우저 동기화로 다른 기기에도 저장                                 │
│                                                                             │
│  2. 웹 서버 로그 (access.log)                                               │
│     └── 평문으로 전체 URL 기록                                              │
│     └── 로그 수집 시스템(ELK, Splunk 등)에 전파                             │
│                                                                             │
│     예시:                                                                   │
│     192.168.1.100 - - [02/Feb/2026:10:30:45 +0900]                         │
│     "GET /api/users/12345?token=secret123&ssn=123-45-6789 HTTP/1.1" 200    │
│                                                                             │
│  3. 프록시/CDN/로드밸런서 로그                                               │
│     └── 회사 프록시 서버에서 기록                                           │
│     └── CloudFlare, AWS ALB 등의 로그                                       │
│                                                                             │
│  4. Referer 헤더                                                            │
│     └── 다른 페이지로 이동할 때 이전 URL이 함께 전달                         │
│     └── 외부 사이트에서도 이 URL을 볼 수 있음                               │
│                                                                             │
│  5. 북마크/URL 공유                                                         │
│     └── 사용자가 URL을 복사하여 공유할 때 파라미터도 함께 노출              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 실제 노출 사례 비교

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GET vs POST 로그 비교                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ GET 방식 (위험) - 서버 로그에 모든 파라미터 노출                         │
│                                                                             │
│  GET /v1/user/12345                                                         │
│  GET /v1/payment/card-4532-xxxx-xxxx-1234                                  │
│  GET /v1/document/contract-uuid-a1b2c3d4                                   │
│  GET /v1/report?userId=12345&year=2024&includeSSN=true                     │
│                                                                             │
│  → access.log에 그대로 기록:                                                │
│  192.168.1.100 [02/Feb/2026:10:30:45] "GET /v1/user/12345" 200 1234        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ POST 방식 (안전) - URL에는 액션명만 노출                                 │
│                                                                             │
│  POST /v1/user/get-user                                                    │
│  Body: { "userId": 12345 }    ← Body는 로그에 기록 안 됨 (기본 설정)        │
│                                                                             │
│  POST /v1/payment/get-card                                                 │
│  Body: { "cardId": "card-4532-xxxx-xxxx-1234" }                            │
│                                                                             │
│  → access.log에 기록:                                                       │
│  192.168.1.100 [02/Feb/2026:10:30:45] "POST /v1/user/get-user" 200 1234    │
│  (민감한 파라미터 정보 없음)                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 CSRF 공격 방어

**CSRF(Cross-Site Request Forgery)**는 사용자가 의도하지 않은 요청을 보내도록 유도하는 공격입니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GET vs POST의 CSRF 취약점 차이                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 GET 방식의 CSRF 공격 (매우 쉬움)                                        │
│                                                                             │
│  공격자가 악성 웹페이지에 다음 코드만 삽입하면 됨:                           │
│                                                                             │
│  <img src="https://bank.com/transfer?to=attacker&amount=1000000">          │
│                                                                             │
│  공격 과정:                                                                 │
│  1. 피해자가 bank.com에 로그인한 상태                                       │
│  2. 피해자가 공격자의 페이지 방문                                           │
│  3. 브라우저가 자동으로 img 태그의 src를 로드                               │
│  4. 이때 bank.com 쿠키가 자동으로 포함됨                                    │
│  5. 피해자 모르게 송금 완료!                                                │
│                                                                             │
│  → <img>, <script>, <iframe> 등으로 쉽게 공격 가능                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🟡 POST 방식의 CSRF 공격 (더 어려움)                                       │
│                                                                             │
│  공격자가 hidden form을 만들어야 함:                                        │
│                                                                             │
│  <form action="https://bank.com/transfer" method="POST">                   │
│    <input type="hidden" name="to" value="attacker">                        │
│    <input type="hidden" name="amount" value="1000000">                     │
│  </form>                                                                   │
│  <script>document.forms[0].submit();</script>                              │
│                                                                             │
│  → 방어 방법:                                                               │
│  1. Content-Type: application/json 요구 시 form 제출 차단                   │
│  2. CORS 정책으로 cross-origin 요청 제한                                    │
│  3. SameSite 쿠키 정책 적용                                                 │
│  4. CSRF 토큰 검증                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ CCK의 POST + JSON + CORS 조합 (최고 보안)                               │
│                                                                             │
│  CCK에서 적용 중인 보안 레이어:                                              │
│  - 모든 API가 POST 메서드 사용                                              │
│  - Content-Type: application/json 필수                                      │
│  - CORS 화이트리스트 설정 (허용된 도메인만)                                 │
│  - SameSite=Strict 쿠키 정책                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 기술적 이점

### 3.1 브라우저 캐싱 문제 회피

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GET 요청의 캐싱 문제                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📚 HTTP 스펙에 따른 캐싱 동작:                                              │
│     - GET 요청은 "안전(Safe)"하고 "멱등(Idempotent)"                        │
│     - 따라서 브라우저/프록시가 자유롭게 캐싱 가능                            │
│                                                                             │
│  🔴 문제 상황:                                                               │
│                                                                             │
│  시간  사용자A              서버              캐시                           │
│  ────────────────────────────────────────────────────────────               │
│  T1    GET /api/users  ───→  DB 조회  ──→  캐시 저장                        │
│                        ←───  [A, B, C]                                      │
│                                                                             │
│  T2              관리자가 사용자 D 추가                                      │
│                                                                             │
│  T3    GET /api/users  ───→  캐시 HIT!                                      │
│                        ←───  [A, B, C]  (오래된 데이터!)                    │
│                              ↑                                              │
│                              D가 없음!                                      │
│                                                                             │
│  💡 해결책들 (전부 번거로움):                                                │
│     - Cache-Control: no-cache, no-store 헤더                                │
│     - URL에 타임스탬프: GET /api/users?_t=1706860800                        │
│     - ETag/Last-Modified 관리                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ POST 요청은 기본적으로 캐시되지 않음                                     │
│                                                                             │
│  - HTTP 스펙: POST는 "안전하지 않은(Unsafe)" 요청으로 분류                  │
│  - 브라우저/프록시가 자동으로 캐시하지 않음                                  │
│  - 별도의 캐시 제어 헤더 설정 불필요                                        │
│  - 항상 최신 데이터 보장                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 URL 길이 제한 회피

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    URL 길이 제한                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📚 환경별 URL 최대 길이 (참고용)                                           │
│                                                                             │
│  ┌────────────────────┬─────────────────────┐                               │
│  │ 환경               │ 최대 URL 길이        │                               │
│  ├────────────────────┼─────────────────────┤                               │
│  │ Internet Explorer  │ 2,083자             │                               │
│  │ Chrome             │ 약 32KB             │                               │
│  │ Firefox            │ 약 65KB             │                               │
│  │ Apache             │ 8,192자 (기본값)    │                               │
│  │ Nginx              │ 4,096자 (기본값)    │                               │
│  │ IIS                │ 16,384자            │                               │
│  └────────────────────┴─────────────────────┘                               │
│                                                                             │
│  🔴 GET에서 복잡한 검색 조건 전달 시 문제:                                   │
│                                                                             │
│  GET /api/reports/search                                                   │
│    ?startDate=2024-01-01                                                   │
│    &endDate=2024-12-31                                                     │
│    &departments[0]=sales                                                   │
│    &departments[1]=marketing                                               │
│    &departments[2]=engineering                                             │
│    ... (100개 부서) ...                                                    │
│    &filters[price][min]=1000                                               │
│    &filters[price][max]=999999                                             │
│    &filters[categories][]=A&filters[categories][]=B...                     │
│                                                                             │
│    → URL이 너무 길어서 요청 실패!                                           │
│    → "414 URI Too Long" 에러                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ POST Body는 거의 무제한                                                 │
│                                                                             │
│  POST /api/reports/search-reports                                          │
│  Content-Type: application/json                                            │
│                                                                             │
│  {                                                                         │
│    "startDate": "2024-01-01",                                              │
│    "endDate": "2024-12-31",                                                │
│    "departments": [                                                        │
│      "sales", "marketing", "engineering",                                  │
│      ... (100개 이상도 OK) ...                                             │
│    ],                                                                      │
│    "filters": {                                                            │
│      "price": { "min": 1000, "max": 999999 },                              │
│      "categories": ["A", "B", "C", ...],                                   │
│      "tags": [...]                                                         │
│    },                                                                      │
│    "pagination": { "page": 0, "size": 50 },                                │
│    "sort": { "field": "createdAt", "direction": "DESC" }                   │
│  }                                                                         │
│                                                                             │
│  → 복잡한 중첩 객체도 쉽게 전달!                                            │
│  → 서버 설정에 따라 수 MB까지 가능 (기본 1-10MB)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 확장성과 하위 호환성

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API 확장 시 URL 변경 문제                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 RESTful + PathVariable 방식의 문제                                       │
│                                                                             │
│  초기 설계:                                                                  │
│  GET /users/{userId}                                                       │
│                                                                             │
│  1차 요구사항 추가: "버전 정보도 필요해요"                                    │
│  GET /users/{userId}/versions/{versionId}                                  │
│  └── URL 구조 변경! 기존 클라이언트 수정 필요                               │
│                                                                             │
│  2차 요구사항 추가: "특정 날짜 시점의 데이터 필요해요"                        │
│  GET /users/{userId}/versions/{versionId}/at/{date}                        │
│  └── 더 복잡해짐! 또 클라이언트 수정 필요                                   │
│                                                                             │
│  3차 요구사항: "권한 레벨에 따라 다른 데이터 필요해요"                        │
│  GET /users/{userId}/versions/{versionId}/at/{date}?level=admin            │
│  └── PathVariable과 Query Parameter가 혼재되어 혼란                         │
│                                                                             │
│  문제점:                                                                    │
│  - 매번 URL 구조 변경 → 기존 클라이언트 코드 전부 수정                       │
│  - API 버전 관리 복잡해짐 (v1, v2, v3...)                                   │
│  - 문서화도 계속 변경해야 함                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ POST + RequestBody 방식의 장점                                          │
│                                                                             │
│  초기 설계:                                                                  │
│  POST /v1/user/get-user                                                    │
│  Body: { "userId": 12345 }                                                 │
│                                                                             │
│  1차 요구사항: "버전 정보도 필요해요"                                        │
│  POST /v1/user/get-user                                                    │
│  Body: { "userId": 12345, "versionId": 2 }                                 │
│  └── 필드만 추가! URL 변경 없음                                             │
│                                                                             │
│  2차 요구사항: "특정 날짜 시점의 데이터 필요해요"                             │
│  POST /v1/user/get-user                                                    │
│  Body: { "userId": 12345, "versionId": 2, "asOfDate": "2024-01-15" }       │
│  └── 필드만 추가! URL 변경 없음                                             │
│                                                                             │
│  3차 요구사항: "권한 레벨에 따라 다른 데이터 필요해요"                        │
│  POST /v1/user/get-user                                                    │
│  Body: {                                                                   │
│    "userId": 12345,                                                        │
│    "versionId": 2,                                                         │
│    "asOfDate": "2024-01-15",                                               │
│    "accessLevel": "admin"                                                  │
│  }                                                                         │
│  └── 필드만 추가! URL 변경 없음                                             │
│                                                                             │
│  장점:                                                                      │
│  - URL 구조 변경 없음 → 기존 클라이언트 그대로 동작                          │
│  - 새 필드는 optional로 추가 → 하위 호환성 자연스럽게 유지                  │
│  - API 문서화도 안정적                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 일관성과 학습 곡선

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    일관된 API 패턴의 장점                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 RESTful 방식: 매번 고민해야 함                                          │
│                                                                             │
│  Q: "이메일 발송 API는 뭘로 하지?"                                          │
│  A: POST? PUT? 논쟁 시작...                                                 │
│                                                                             │
│  Q: "주문 상태 변경은?"                                                     │
│  A: PUT /orders/123/status? PATCH /orders/123? POST /orders/123/change?    │
│                                                                             │
│  Q: "검색 API는?"                                                           │
│  A: GET /search?q=...? POST /search? 캐싱 생각하면 GET인데 body가...       │
│                                                                             │
│  → 팀원마다 다른 스타일, 리뷰 시 끝없는 논쟁                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ POST only 방식: 단순하고 명확함                                         │
│                                                                             │
│  규칙:                                                                      │
│  1. 모든 API는 POST                                                        │
│  2. URL은 /v1/{project}/{domain}/{action} 형태                             │
│  3. 모든 파라미터는 RequestBody                                             │
│  4. 응답은 BaseResult 상속                                                  │
│                                                                             │
│  예시:                                                                      │
│  POST /v1/order/send-email       → 이메일 발송                             │
│  POST /v1/order/change-status    → 상태 변경                                │
│  POST /v1/order/search-orders    → 주문 검색                                │
│  POST /v1/order/cancel-order     → 주문 취소                                │
│                                                                             │
│  장점:                                                                      │
│  - 신입 개발자도 5분이면 규칙 파악                                          │
│  - HTTP 메서드 논쟁 없음                                                    │
│  - 코드 리뷰 포인트 감소                                                    │
│  - 일관된 코드베이스                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. CCK 가이드라인 원본 근거

### 4.1 프로젝트별 적용 현황

| 프로젝트 | 문서 위치 | 핵심 내용 |
|---------|----------|----------|
| **Leap** | `jump/leap/backend/docs/detailed-guides/API-DESIGN-GUIDE.md` | "모든 API가 POST 방식인 이유" 상세 설명 |
| **Mothership** | `mothership/backend/src/CLAUDE.md` | "❌ GET/PUT/DELETE 방식 사용 (POST only)" |
| **Accio** | `accio/backend/docs/v1/bcl/apis.md` | "현재: 모든 API가 POST 방식 사용" |
| **Helloworld** | `helloworld/CLAUDE.md` | "**All POST**: 모든 엔드포인트 POST 방식" |
| **공통 규칙** | `.claude/skills/kotlin-rules/api-patterns.md` | PathVariable 사용 금지, kebab-case URL 규칙 |

### 4.2 CCK API 설계 가이드 발췌

```markdown
## 1. 모든 API가 POST 방식인 이유

**일관성과 단순성**: RESTful 방식보다 명시적인 액션 기반 엔드포인트를 선호합니다.
- **일관된 요청/응답 구조**: 모든 API가 동일한 패턴을 따름
- **복잡한 파라미터 전달**: POST body를 통해 복잡한 객체도 쉽게 전달
- **캐싱 이슈 해결**: GET 요청의 브라우저 캐싱 문제 회피
- **보안**: URL에 민감한 정보 노출 방지

## PathVariable을 사용하지 않는 이유

1. **일관성**: 모든 API를 POST로 통일하는 정책과 일치
2. **보안**: URL에 민감한 정보 노출 방지 (로그, 프록시 등에서 기록됨)
3. **확장성**: 향후 파라미터 추가 시 URL 구조 변경 불필요
4. **캐싱**: URL 기반 캐싱 정책과의 충돌 방지
5. **길이 제한**: URL 길이 제한에 걸리지 않음
```

---

## 5. 실제 코드 예시

### 5.1 CCK 권장 패턴

```kotlin
@RestController
@RequestMapping("/v1/leap/task")
class TaskController(
    private val taskService: TaskService
) {
    // ✅ 조회도 POST
    @PostMapping("/get-task")
    fun getTask(@RequestBody request: GetTaskRequest): GetTaskResponse {
        val task = taskService.getTask(request.taskId)
        return GetTaskResponse(task.toSummary())
    }

    // ✅ 목록 조회도 POST (페이징 포함)
    @PostMapping("/get-tasks")
    fun getTasks(@RequestBody request: GetTasksRequest): GetTasksResponse {
        val pageable = PageRequest.of(request.page, request.size)
        val tasks = taskService.getTasks(pageable)
        return GetTasksResponse(tasks.map { it.toSummary() })
    }

    // ✅ 삭제도 POST (DELETE 아님)
    @PostMapping("/delete-task")
    fun deleteTask(@RequestBody request: DeleteTaskRequest): BaseResult {
        taskService.deleteTask(request.taskId)
        return BaseResult()
    }

    // ✅ 비CRUD 액션도 명확
    @PostMapping("/approve-task")
    fun approveTask(@RequestBody request: ApproveTaskRequest): BaseResult {
        taskService.approveTask(request.taskId, request.approverNote)
        return BaseResult()
    }
}
```

### 5.2 Request/Response DTO

```kotlin
// Request DTO - data class 사용
data class GetTaskRequest(
    val taskId: Long
)

data class GetTasksRequest(
    val page: Int = 0,
    val size: Int = 20,
    val status: TaskStatus? = null,     // optional 필터
    val assigneeId: Long? = null        // optional 필터 (하위 호환)
)

// Response DTO - BaseResult 상속
class GetTaskResponse(
    val task: TaskSummary
) : BaseResult()

class GetTasksResponse(
    val tasks: Page<TaskSummary>
) : BaseResult()

// Summary DTO - data class 사용
data class TaskSummary(
    val id: Long,
    val title: String,
    val status: TaskStatus,
    val createdAt: LocalDateTime
)
```

### 5.3 프론트엔드에서의 호출

```typescript
// ✅ CCK 프론트엔드 패턴
const api = {
  // 조회도 POST
  getTask: (taskId: number) =>
    fetch('/v1/leap/task/get-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    }),

  // 목록 조회도 POST
  getTasks: (page: number, size: number, status?: TaskStatus) =>
    fetch('/v1/leap/task/get-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, size, status })
    }),

  // 삭제도 POST
  deleteTask: (taskId: number) =>
    fetch('/v1/leap/task/delete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    })
}
```

---

## 6. 요약: POST only의 5가지 핵심 이점

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    POST only 설계의 5가지 핵심 이점                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣ 보안 (Security)                                                        │
│     └── URL 로그/히스토리에 민감 정보 노출 방지                              │
│     └── CSRF 공격 방어력 향상                                               │
│     └── SameSite 쿠키 + CORS로 추가 보호                                    │
│                                                                             │
│  2️⃣ 일관성 (Consistency)                                                   │
│     └── 모든 API가 동일한 POST + JSON Body 패턴                             │
│     └── 개발자 학습 곡선 최소화                                             │
│     └── HTTP 메서드 선택 논쟁 제거                                          │
│                                                                             │
│  3️⃣ 확장성 (Extensibility)                                                 │
│     └── 파라미터 추가 시 URL 변경 불필요                                     │
│     └── 하위 호환성 자연스럽게 유지                                         │
│     └── API 버전 관리 단순화                                                │
│                                                                             │
│  4️⃣ 캐싱 제어 (Cache Control)                                              │
│     └── 브라우저/프록시 자동 캐싱 문제 회피                                  │
│     └── 별도의 캐시 헤더 관리 불필요                                        │
│     └── 항상 최신 데이터 보장                                               │
│                                                                             │
│  5️⃣ 복잡한 파라미터 (Complex Parameters)                                   │
│     └── URL 길이 제한 없음                                                  │
│     └── 중첩 객체, 배열 등 복잡한 구조 쉽게 전달                            │
│     └── JSON으로 구조화된 데이터 표현                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. 자주 묻는 질문

### Q1: REST 원칙을 위반하는 것 아닌가요?

**A**: 엄밀히 말하면 REST 원칙의 "Uniform Interface" 중 일부를 따르지 않습니다. 하지만 REST는 아키텍처 스타일의 제안일 뿐, 반드시 따라야 하는 표준이 아닙니다. 실무에서는 보안, 일관성, 유지보수성을 위해 RPC 스타일을 선택하는 것이 합리적인 결정입니다.

### Q2: SEO에 영향이 있나요?

**A**: API 서버는 검색 엔진이 크롤링하지 않으므로 SEO와 무관합니다. 프론트엔드 페이지 URL과 API 엔드포인트는 별개입니다.

### Q3: 브라우저 뒤로가기/북마크가 안 되지 않나요?

**A**: API 호출 자체는 브라우저 히스토리와 무관합니다. 프론트엔드에서 SPA 라우팅으로 페이지 상태를 관리하면 뒤로가기/북마크 모두 정상 동작합니다.

### Q4: 캐싱이 전혀 안 되면 성능이 나쁘지 않나요?

**A**: 서버 측에서 Redis, CDN 등을 활용한 캐싱 전략을 별도로 구현합니다. 브라우저 캐싱에 의존하지 않으므로 캐시 무효화를 더 정밀하게 제어할 수 있습니다.

---

## 참고 자료

- CCK API Design Guide: `jump/leap/backend/docs/detailed-guides/API-DESIGN-GUIDE.md`
- CCK Kotlin API Patterns: `.claude/skills/kotlin-rules/api-patterns.md`
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- HTTP Caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching

---

## 관련 키워드

`POST only`, `API 설계`, `RPC`, `RESTful`, `CSRF`, `URL 노출`, `보안`, `캐싱`, `PathVariable`, `RequestBody`, `kebab-case`, `CCK 가이드라인`, `일관성`, `확장성`
