---
layout: single
title: "Uvicorn - Python ASGI 서버"
date: 2026-02-11 11:20:00 +0900
categories: backend
excerpt: "``` ┌─────────────────────────────────────────────────────────────┐ │                                                             │ │  Uvicorn = 초고속 ASGI 웹 서버                              │ │                                                             │ │  이름 유래: UV (Unicorn의 변형) + ASGI                      │ │  탄생: 2017년 (Tom Christie 개발)                           │ │  특징: 비동기, 빠름, 가벼움                                 │ │                                                             │ │  핵심 역할:                                                 │ │  ┌─────────────────────────────────────────────────────┐   │ │  │                                                     │   │ │  │  인터넷 ───────► Uvicorn ───────► FastAPI/Starlette │   │ │  │  (HTTP 요청)     (ASGI 서버)      (Python 앱)       │   │ │  │                                                     │   │ │  └─────────────────────────────────────────────────────┘   │ │                                                             │ │  비유:                                                      │ │  ├── FastAPI = 요리사 (요청을 처리하는 로직)                │ │  └── Uvicorn = 식당 입구 (요청을 받아서 요리사에게 전달)    │ │                                                             │ └─────────────────────────────────────────────────────────────┘ ```"
toc: true
toc_sticky: true
tags: [Uvicorn, -, Python, ASGI, 서버]
---

# TL;DR
- **Uvicorn - Python ASGI 서버의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
``` ┌─────────────────────────────────────────────────────────────┐ │                                                             │ │  Uvicorn = 초고속 ASGI 웹 서버                              │ │                                                             │ │  이름 유래: UV (Unicorn의 변형) + ASGI                      │ │  탄생: 2017년 (Tom Christie 개발)                           │ │  특징: 비동기, 빠름, 가벼움                                 │ │                                                             │ │  핵심 역할:                                                 │ │  ┌─────────────────────────────────────────────────────┐   │ │  │                                                     │   │ │  │  인터넷 ───────► Uvicorn ───────► FastAPI/Starlette │   │ │  │  (HTTP 요청)     (ASGI 서버)      (Python 앱)       │   │ │  │                                                     │   │ │  └─────────────────────────────────────────────────────┘   │ │                                                             │ │  비유:                                                      │ │  ├── FastAPI = 요리사 (요청을 처리하는 로직)                │ │  └── Uvicorn = 식당 입구 (요청을 받아서 요리사에게 전달)    │ │                                                             │ └─────────────────────────────────────────────────────────────┘ ```

## 2. 배경
Uvicorn - Python ASGI 서버이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- Nginx 설정 예시
- 관련 키워드

## 5. 상세 내용

> **작성일**: 2026-01-29
> **카테고리**: Backend / Server / ASGI
> **포함 내용**: Uvicorn, ASGI, WSGI, uvloop, httptools, Gunicorn, 프로덕션 배포

---

# 1. Uvicorn이란?

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Uvicorn = 초고속 ASGI 웹 서버                              │
│                                                             │
│  이름 유래: UV (Unicorn의 변형) + ASGI                      │
│  탄생: 2017년 (Tom Christie 개발)                           │
│  특징: 비동기, 빠름, 가벼움                                 │
│                                                             │
│  핵심 역할:                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  인터넷 ───────► Uvicorn ───────► FastAPI/Starlette │   │
│  │  (HTTP 요청)     (ASGI 서버)      (Python 앱)       │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  비유:                                                      │
│  ├── FastAPI = 요리사 (요청을 처리하는 로직)                │
│  └── Uvicorn = 식당 입구 (요청을 받아서 요리사에게 전달)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 2. WSGI vs ASGI 역사 (배경)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  2003년: WSGI (Web Server Gateway Interface) 탄생           │
│  ├── PEP 333 (Python 표준)                                  │
│  ├── 동기(Synchronous) 방식                                 │
│  ├── 요청 하나 = 스레드 하나                                │
│  └── 구현체: Gunicorn, uWSGI                                │
│                                                             │
│  WSGI의 한계:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  def wsgi_app(environ, start_response):             │   │
│  │      # 동기적으로만 실행 가능                       │   │
│  │      # WebSocket? ❌ 불가능                         │   │
│  │      # async/await? ❌ 불가능                       │   │
│  │      # HTTP/2? ❌ 제한적                            │   │
│  │      return [b"Hello World"]                        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  2016년: ASGI (Asynchronous Server Gateway Interface) 탄생  │
│  ├── Django Channels 프로젝트에서 시작                      │
│  ├── 비동기(Asynchronous) 방식                              │
│  ├── WebSocket, HTTP/2 지원                                 │
│  └── async/await 네이티브 지원                              │
│                                                             │
│  ASGI의 장점:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  async def asgi_app(scope, receive, send):          │   │
│  │      # 비동기적으로 실행 가능                       │   │
│  │      # WebSocket? ✓ 가능                            │   │
│  │      # async/await? ✓ 네이티브                      │   │
│  │      # HTTP/2? ✓ 가능                               │   │
│  │      await send({"type": "http.response.body", ...})│   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  2017년: Uvicorn 등장                                       │
│  ├── 최초의 순수 Python ASGI 서버                           │
│  ├── uvloop 기반 (libuv 바인딩)                             │
│  └── FastAPI, Starlette와 함께 성장                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 3. 왜 Uvicorn인가?

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ASGI 서버 비교:                                            │
│                                                             │
│  ┌────────────┬─────────────────────────────────────────┐  │
│  │   서버     │   특징                                  │  │
│  ├────────────┼─────────────────────────────────────────┤  │
│  │ Uvicorn    │ 가볍고 빠름, 개발용 기본 선택           │  │
│  │            │ uvloop 사용 시 매우 빠름                │  │
│  ├────────────┼─────────────────────────────────────────┤  │
│  │ Hypercorn  │ HTTP/2, HTTP/3(QUIC) 지원              │  │
│  │            │ 더 많은 프로토콜 지원                   │  │
│  ├────────────┼─────────────────────────────────────────┤  │
│  │ Daphne     │ Django Channels 공식 서버               │  │
│  │            │ Django 프로젝트에서 주로 사용           │  │
│  └────────────┴─────────────────────────────────────────┘  │
│                                                             │
│  Uvicorn이 인기 있는 이유:                                  │
│  ├── FastAPI 공식 권장 서버                                 │
│  ├── 설정이 간단                                            │
│  ├── 성능이 뛰어남 (uvloop 사용 시)                         │
│  └── 활발한 개발/유지보수                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. 기본 사용법

```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

# 실행 방법 1: CLI
# uvicorn main:app --reload

# 실행 방법 2: 코드에서 직접
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

```bash
# CLI 옵션들
uvicorn main:app \
    --host 0.0.0.0 \        # 바인딩 주소 (기본: 127.0.0.1)
    --port 8000 \           # 포트 (기본: 8000)
    --reload \              # 코드 변경 시 자동 재시작 (개발용)
    --workers 4 \           # 워커 프로세스 수 (프로덕션)
    --loop uvloop \         # 이벤트 루프 (uvloop이 더 빠름)
    --http httptools \      # HTTP 파서 (httptools이 더 빠름)
    --log-level info        # 로그 레벨
```

---

# 5. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Uvicorn 아키텍처                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Internet                          │   │
│  │                        │                             │   │
│  │                        ▼                             │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │              Uvicorn Server                  │    │   │
│  │  │                                             │    │   │
│  │  │  ┌─────────────────────────────────────┐   │    │   │
│  │  │  │         Event Loop (uvloop)         │   │    │   │
│  │  │  │                                     │   │    │   │
│  │  │  │  ┌───────────┐  ┌───────────┐      │   │    │   │
│  │  │  │  │ HTTP      │  │ WebSocket │      │   │    │   │
│  │  │  │  │ Protocol  │  │ Protocol  │      │   │    │   │
│  │  │  │  └─────┬─────┘  └─────┬─────┘      │   │    │   │
│  │  │  │        │              │            │   │    │   │
│  │  │  │        └──────┬───────┘            │   │    │   │
│  │  │  │               │                    │   │    │   │
│  │  │  │               ▼                    │   │    │   │
│  │  │  │  ┌─────────────────────────────┐   │   │    │   │
│  │  │  │  │        ASGI Interface       │   │   │    │   │
│  │  │  │  │   scope, receive, send      │   │   │    │   │
│  │  │  │  └──────────────┬──────────────┘   │   │    │   │
│  │  │  │                 │                  │   │    │   │
│  │  │  └─────────────────┼──────────────────┘   │    │   │
│  │  │                    │                      │    │   │
│  │  └────────────────────┼──────────────────────┘    │   │
│  │                       │                           │   │
│  │                       ▼                           │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │         ASGI Application                    │  │   │
│  │  │   (FastAPI, Starlette, Django Channels)     │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  핵심 컴포넌트:                                             │
│  ├── uvloop: libuv 기반 초고속 이벤트 루프                  │
│  ├── httptools: 초고속 HTTP 파서 (Node.js에서 사용)         │
│  └── ASGI Interface: 앱과 서버 간의 표준 인터페이스         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 6. uvloop과 httptools

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  uvloop (선택적, 권장):                                     │
│                                                             │
│  - libuv 기반 이벤트 루프 (Node.js가 사용하는 것)           │
│  - 기본 asyncio 대비 2~4배 빠름                             │
│  - Cython으로 작성되어 C 수준 성능                          │
│                                                             │
│  설치: pip install uvloop                                   │
│  사용: uvicorn main:app --loop uvloop                       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  httptools (선택적, 권장):                                  │
│                                                             │
│  - Node.js의 HTTP 파서를 Python으로 포팅                    │
│  - 기본 파서 대비 훨씬 빠름                                 │
│  - Cython 기반                                              │
│                                                             │
│  설치: pip install httptools                                │
│  사용: uvicorn main:app --http httptools                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  권장 설치 (둘 다 포함):                                    │
│                                                             │
│  pip install uvicorn[standard]                              │
│                                                             │
│  포함되는 것:                                               │
│  ├── uvloop (Linux/macOS)                                   │
│  ├── httptools                                              │
│  ├── watchfiles (--reload용)                                │
│  └── websockets (WebSocket용)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 7. 개발 vs 프로덕션 설정

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  개발 환경:                                                 │
│                                                             │
│  uvicorn main:app --reload                                  │
│                                                             │
│  ├── --reload: 코드 변경 감지 및 자동 재시작                │
│  ├── 단일 워커 (디버깅 용이)                                │
│  └── localhost만 바인딩 (보안)                              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  프로덕션 환경 (방법 1: Uvicorn 직접):                      │
│                                                             │
│  uvicorn main:app \                                         │
│      --host 0.0.0.0 \                                       │
│      --port 8000 \                                          │
│      --workers 4 \                                          │
│      --loop uvloop \                                        │
│      --http httptools                                       │
│                                                             │
│  ⚠️ --workers 사용 시 --reload 사용 불가                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  프로덕션 환경 (방법 2: Gunicorn + Uvicorn Workers):        │
│                                                             │
│  gunicorn main:app \                                        │
│      -w 4 \                                                 │
│      -k uvicorn.workers.UvicornWorker \                     │
│      --bind 0.0.0.0:8000                                    │
│                                                             │
│  장점:                                                      │
│  ├── Gunicorn의 프로세스 관리 기능 활용                     │
│  ├── 워커 재시작, 그레이스풀 셧다운                         │
│  └── 프로덕션 검증된 프로세스 매니저                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 8. Worker 개수 설정

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  워커 수 계산 공식:                                         │
│                                                             │
│  workers = (CPU 코어 수 × 2) + 1                            │
│                                                             │
│  예시:                                                      │
│  ├── 4코어 서버: (4 × 2) + 1 = 9 워커                       │
│  ├── 8코어 서버: (8 × 2) + 1 = 17 워커                      │
│  └── 하지만 보통 4~8개로 시작하고 조정                      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  고려 사항:                                                 │
│                                                             │
│  I/O 바운드 작업 (DB, API 호출 등):                         │
│  └── 워커 수 늘려도 효과 좋음                               │
│                                                             │
│  CPU 바운드 작업 (계산, 이미지 처리 등):                    │
│  └── 코어 수 = 워커 수가 적절                               │
│                                                             │
│  메모리 제한:                                               │
│  └── 워커당 ~100MB+ 사용, 총 메모리 고려                    │
│                                                             │
│  ⚠️ 비동기 앱에서는 워커가 적어도 동시 처리 많음           │
│  └── async/await가 I/O 대기 중 다른 요청 처리              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 9. Nginx와 함께 사용 (프로덕션)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  일반적인 프로덕션 아키텍처:                                │
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐    │
│  │  Client  │────►│  Nginx   │────►│  Uvicorn/Gunicorn│    │
│  │          │     │ (Reverse │     │  + FastAPI       │    │
│  │          │     │  Proxy)  │     │                  │    │
│  └──────────┘     └──────────┘     └──────────────────┘    │
│                                                             │
│  Nginx 역할:                                                │
│  ├── SSL/TLS 종료 (HTTPS 처리)                              │
│  ├── 정적 파일 서빙                                         │
│  ├── 로드 밸런싱                                            │
│  ├── 요청 버퍼링                                            │
│  └── DDoS 방어                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Nginx 설정 예시

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 지원
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 정적 파일 (Nginx가 직접 서빙)
    location /static {
        alias /app/static;
    }
}
```

---

# 10. Docker에서 사용

```dockerfile
# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# uvicorn[standard] 설치 (uvloop, httptools 포함)
RUN pip install uvicorn[standard]

# 포트 노출
EXPOSE 8000

# 프로덕션 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db/mydb
    depends_on:
      - db
    # Gunicorn + Uvicorn Worker 사용 시
    command: >
      gunicorn main:app
      -w 4
      -k uvicorn.workers.UvicornWorker
      --bind 0.0.0.0:8000

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=mydb
```

---

# 11. 성능 비교

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  벤치마크 (요청/초, 단순 JSON 응답):                        │
│                                                             │
│  ┌─────────────────────────┬───────────────────────────┐   │
│  │ 서버 구성               │ 요청/초 (RPS)             │   │
│  ├─────────────────────────┼───────────────────────────┤   │
│  │ Uvicorn (기본)          │ ~30,000                   │   │
│  │ Uvicorn (uvloop)        │ ~50,000+                  │   │
│  │ Gunicorn + WSGI         │ ~10,000                   │   │
│  │ Flask (dev server)      │ ~1,000                    │   │
│  └─────────────────────────┴───────────────────────────┘   │
│                                                             │
│  ⚠️ 실제 성능은 앱 로직, DB, 네트워크 등에 따라 다름       │
│                                                             │
│  Uvicorn이 빠른 이유:                                       │
│  ├── uvloop: C로 작성된 이벤트 루프                         │
│  ├── httptools: C로 작성된 HTTP 파서                        │
│  ├── 비동기: I/O 대기 중 다른 요청 처리                     │
│  └── 경량: 최소한의 오버헤드                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 12. 로깅 설정

```python
import uvicorn
from uvicorn.config import LOGGING_CONFIG

# 기본 로깅 설정 커스터마이징
LOGGING_CONFIG["formatters"]["default"]["fmt"] = \
    "%(asctime)s - %(levelname)s - %(message)s"
LOGGING_CONFIG["formatters"]["access"]["fmt"] = \
    '%(asctime)s - %(client_addr)s - "%(request_line)s" %(status_code)s'

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,  # 접근 로그 활성화
    )
```

```bash
# CLI에서 로그 레벨 설정
uvicorn main:app --log-level debug    # debug, info, warning, error, critical
uvicorn main:app --access-log         # 접근 로그 활성화
uvicorn main:app --no-access-log      # 접근 로그 비활성화
```

---

# 13. SSL/HTTPS 설정

```bash
# 개발용 자체 서명 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Uvicorn에서 HTTPS 사용
uvicorn main:app \
    --host 0.0.0.0 \
    --port 443 \
    --ssl-keyfile key.pem \
    --ssl-certfile cert.pem
```

```python
# 코드에서 SSL 설정
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=443,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem",
    )
```

⚠️ **프로덕션에서는 Nginx에서 SSL 처리를 권장** (Let's Encrypt 등)

---

# 14. 정리

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Uvicorn 핵심 요약:                                         │
│                                                             │
│  1. ASGI 서버 = 비동기 Python 앱을 실행하는 서버            │
│                                                             │
│  2. FastAPI/Starlette의 공식 권장 서버                      │
│                                                             │
│  3. 성능을 위해 uvicorn[standard] 설치                      │
│     └── uvloop + httptools 포함                             │
│                                                             │
│  4. 개발: uvicorn main:app --reload                         │
│                                                             │
│  5. 프로덕션:                                               │
│     ├── Uvicorn: --workers N --loop uvloop                  │
│     └── 또는 Gunicorn + UvicornWorker                       │
│                                                             │
│  6. 앞단에 Nginx 두면 더 좋음                               │
│     └── SSL, 정적 파일, 로드밸런싱                          │
│                                                             │
│  7. 워커 수: (CPU × 2) + 1 또는 4~8개로 시작                │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  비유:                                                      │
│  ├── WSGI (Gunicorn) = 단일 창구 은행 (한 명씩 처리)        │
│  └── ASGI (Uvicorn) = 번호표 은행 (대기하며 다른 일 처리)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Uvicorn`, `ASGI`, `WSGI`, `uvloop`, `httptools`, `Gunicorn`, `FastAPI`, `Starlette`, `Worker`, `비동기`, `이벤트 루프`, `Nginx`, `리버스 프록시`
