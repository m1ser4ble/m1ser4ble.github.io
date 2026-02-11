---
layout: single
title: "FastAPI 한눈에 정리 (좀 더 자세히)"
date: 2026-02-11 10:38:00 +0900
categories: backend
excerpt: "FastAPI가 왜 인기인지, 어떤 문제를 해결했고 어떻게 쓰는지까지 한 번에 정리"
toc: true
toc_sticky: true
tags: [FastAPI, Python, ASGI, Pydantic, Web]
---

# TL;DR
- **FastAPI는 API 서버에 최적화된 Python 프레임워크**다.
- **Starlette(ASGI) + Pydantic** 조합으로 성능/검증/문서화가 동시에 해결된다.
- **비동기 + 타입 힌트 + 자동 문서화**가 기본이라, API 전용 서버에서는 사실상 표준에 가까움.

---

# 1) FastAPI가 등장한 배경
2018년 전후의 Python 웹 환경은 다음 문제가 있었다:

- Django/Flask는 **동기(WGSI)** 기반 → 고성능 비동기 처리 한계
- **API 문서 자동화 부족** → Swagger/OpenAPI 세팅 직접 해야 함
- **타입 검증 수동** → 코드가 길어지고 버그가 많아짐

FastAPI는 “현대적인 Python 기능(타입 힌트, async/await)을 적극 활용하자”는 목표로 탄생했다.

---

# 2) 핵심 구성 요소
```
FastAPI
 ├─ Starlette (ASGI 웹 코어)
 ├─ Pydantic (데이터 검증/직렬화)
 └─ Uvicorn (ASGI 서버)
```

### WSGI vs ASGI (핵심 차이)
- **WSGI**: 요청 1개당 스레드 1개 (동기)
- **ASGI**: 이벤트 루프로 여러 요청 동시 처리 (비동기)

> 비유: WSGI는 “웨이터가 테이블 하나씩 순서대로”, ASGI는 “한 명이 여러 테이블 동시에 처리”.

---

# 3) 기본 사용법 (Hello World)
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}
```

```bash
uvicorn main:app --reload
# /docs (Swagger), /redoc 자동 제공
```

---

# 4) Pydantic 기반 타입 검증
```python
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    name: str
    email: EmailStr
    age: int
```

- 잘못된 타입 입력 시 **자동 422 에러**
- 문자열 "25"도 **자동 int 변환**
- EmailStr, HttpUrl 같은 **고급 검증 타입**도 기본 제공

---

# 5) 의존성 주입 (Dependency Injection)
FastAPI는 인증/DB연결 같은 **공통 로직을 주입**하는 기능을 내장 제공한다.

```python
from fastapi import Depends

def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

@app.get("/users")
def get_users(db=Depends(get_db)):
    return db.query(User).all()
```

**장점:**
- 공통 로직 재사용
- 테스트 쉬움 (Mock 주입 가능)
- 코드 구조가 명확해짐

---

# 6) 비동기 처리
```python
@app.get("/async")
async def async_endpoint():
    async with httpx.AsyncClient() as client:
        res = await client.get("https://api.example.com")
    return res.json()
```

FastAPI는 async/await를 **네이티브 지원**한다.
- I/O 대기 중 다른 요청 처리 가능
- 고성능 API 서버에 유리

---

# 7) 자동 API 문서화
FastAPI는 코드만 작성하면 자동으로 문서를 만든다:
- `/docs` → Swagger UI
- `/redoc` → ReDoc
- `/openapi.json` → OpenAPI 스펙

덕분에 **프론트/백엔드 협업이 쉬워짐**.

---

# 8) FastAPI vs Flask vs Django
| 항목 | FastAPI | Flask | Django |
|---|---|---|---|
| 비동기 | ✅ | ❌ | ⚠️ 제한적 |
| 타입 힌트 | ✅ | ❌ | ❌ |
| 자동 문서화 | ✅ | ❌ | ❌ |
| 학습 곡선 | 낮음 | 낮음 | 높음 |
| 용도 | API/ML | 간단 웹앱 | 풀스택 |

**결론:** API 서버라면 FastAPI가 가장 합리적인 기본 선택지.

---

# 9) 추천 프로젝트 구조
```
my_project/
├── app/
│   ├── main.py           # FastAPI 앱
│   ├── routers/          # API 라우터
│   ├── models/           # Pydantic 모델
│   ├── crud/             # DB 로직
│   └── core/             # 설정/보안
└── tests/
```

---

# 10) 정리
FastAPI는 **속도·안정성·문서화** 모두 챙기려는 API 프로젝트에 최적이다.
- API 서버 → FastAPI 거의 표준
- 풀스택 웹앱 → Django
- 간단한 실험 → Flask

---

# 참고
- https://fastapi.tiangolo.com/
- https://www.starlette.io/
- https://docs.pydantic.dev/
