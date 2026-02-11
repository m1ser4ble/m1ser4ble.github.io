---
layout: single
title: "FastAPI 한눈에 정리 (개념·등장배경·특징까지)"
date: 2026-02-11 10:38:00 +0900
categories: backend
excerpt: "FastAPI 한눈에 정리 (개념·등장배경·특징까지)의 개념·등장배경·이유·특징을 정리"
toc: true
toc_sticky: true
tags: [FastAPI, Python, ASGI, Pydantic, Web]
---

# TL;DR
- **FastAPI는 API 서버에 최적화된 Python 프레임워크**다.
- **Starlette(ASGI) + Pydantic** 조합으로 성능/검증/문서화가 동시에 해결된다.
- **비동기 + 타입 힌트 + 자동 문서화**를 기본 제공해 API 전용 서버에선 사실상 표준급.

---

# 1. FastAPI의 개념
FastAPI는 **Python으로 API를 빠르고 안정적으로 만들기 위한 프레임워크**다.

핵심은 세 가지다:
1. **빠른 실행 성능** (ASGI 기반)
2. **타입 안정성** (Pydantic 기반 자동 검증)
3. **자동 문서화** (OpenAPI/Swagger 자동 생성)

즉, *“빠르고, 정확하고, 문서까지 자동”*인 API 프레임워크라고 보면 된다.

---

# 2. 등장 배경 (왜 필요했나?)
2018년 전후 Python 웹 환경은 다음 한계가 있었다:

- Django/Flask는 **동기(WGSI)** 기반이라 동시성 처리에 불리
- API 문서를 **직접 만들거나 Swagger 세팅을 수동으로** 해야 함
- 타입 검증이 없어 **런타임 오류가 잦고, 코드가 장황해짐**
- Python 3.6+의 **타입 힌트 기능을 제대로 활용하지 못함**

FastAPI는 “**현대적인 Python 기능을 적극 활용하자**”는 철학으로 등장했다.

---

# 3. FastAPI의 핵심 특징
### ✅ 1. 성능 (ASGI 기반 비동기)
- Starlette 기반 비동기 처리
- Node.js, Go 수준의 성능 목표
- 요청당 스레드를 쓰지 않고 이벤트 루프 기반 처리

### ✅ 2. 타입 안정성 (Pydantic)
- 타입 힌트를 곧바로 **런타임 검증**으로 사용
- 잘못된 요청이면 자동으로 **422 에러 반환**
- 데이터 변환도 자동

### ✅ 3. 자동 문서화
- `/docs` → Swagger UI 자동 생성
- `/redoc` → ReDoc 자동 생성
- `/openapi.json` → OpenAPI 스펙 자동 제공

### ✅ 4. 개발 생산성
- 코드량 감소
- IDE 자동완성 / 타입 추적 강력
- 테스트/유지보수 쉬움

---

# 4. 핵심 구성 요소
```
FastAPI
 ├─ Starlette (ASGI 웹 코어)
 ├─ Pydantic (데이터 검증/직렬화)
 └─ Uvicorn (ASGI 서버)
```

### WSGI vs ASGI
- **WSGI**: 요청 1개당 스레드 1개 (동기)
- **ASGI**: 이벤트 루프로 동시 처리 (비동기)

---

# 5. 기본 사용법 (Hello World)
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

# 6. 타입 검증 예시 (Pydantic)
```python
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    name: str
    email: EmailStr
    age: int
```

- 잘못된 타입 → 자동 422
- "25" → 자동 int 변환
- 이메일, URL 등 복합 검증 자동 처리

---

# 7. 의존성 주입 (Dependency Injection)
FastAPI는 인증/DB연결 같은 공통 로직을 주입하는 기능을 내장 제공한다.

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
- 테스트 용이
- 코드 구조가 명확해짐

---

# 8. 비동기 처리 예시
```python
@app.get("/async")
async def async_endpoint():
    async with httpx.AsyncClient() as client:
        res = await client.get("https://api.example.com")
    return res.json()
```

---

# 9. FastAPI vs Flask vs Django
| 항목 | FastAPI | Flask | Django |
|---|---|---|---|
| 비동기 | ✅ | ❌ | ⚠️ 제한적 |
| 타입 힌트 | ✅ | ❌ | ❌ |
| 자동 문서화 | ✅ | ❌ | ❌ |
| 학습 곡선 | 낮음 | 낮음 | 높음 |
| 용도 | API/ML | 간단 웹앱 | 풀스택 |

**결론:** API 전용 서버에서는 FastAPI가 가장 합리적인 기본 선택지.

---

# 10. 추천 프로젝트 구조
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

# 11. 정리
FastAPI는 **속도·안정성·문서화**를 동시에 잡는 API 프레임워크다.
- API 서버 → FastAPI 거의 표준
- 풀스택 웹앱 → Django
- 간단 실험 → Flask

---

# 참고
- https://fastapi.tiangolo.com/
- https://www.starlette.io/
- https://docs.pydantic.dev/
