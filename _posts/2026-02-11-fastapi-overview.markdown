---
layout: single
title: "FastAPI 한눈에 정리"
date: 2026-02-11 10:38:00 +0900
categories: backend
excerpt: "FastAPI가 왜 인기인지, 무엇이 빠르고 편한지 핵심만 요약"
toc: true
toc_sticky: true
tags: [FastAPI, Python, ASGI, Pydantic, Web]
---

# TL;DR
- **FastAPI는 API 서버에 최적화된 Python 프레임워크**다.
- **Starlette(ASGI) + Pydantic** 조합으로 성능/검증/문서화가 한 번에 해결된다.
- Flask보다 현대적이고, Django보다 가볍다. **API 전용 서버라면 사실상 표준**.

---

# 1) FastAPI가 등장한 이유
기존 Django/Flask는 동기(WGSI) 기반이라 **비동기 처리와 자동 문서화, 타입 검증**이 약했다. FastAPI는 다음을 한 번에 해결했다.

- **비동기 지원(ASGI)**
- **타입 힌트 기반 자동 검증(Pydantic)**
- **Swagger/OpenAPI 자동 문서화**
- **개발 속도 향상 (코드량 감소 + IDE 자동완성)**

---

# 2) 핵심 구성
```
FastAPI
 ├─ Starlette (ASGI 웹 코어)
 ├─ Pydantic (데이터 검증/직렬화)
 └─ Uvicorn (ASGI 서버)
```

**WSGI vs ASGI 간단 비교**
- WSGI: 요청 1개 = 스레드 1개 (동기)
- ASGI: 이벤트 루프로 동시 처리 (비동기)

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

# 4) Pydantic으로 타입 검증 자동화
```python
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    name: str
    email: EmailStr
    age: int
```
- 입력 데이터가 틀리면 자동으로 **422 에러**
- 문자열 "25"도 **자동으로 int 변환**

---

# 5) FastAPI vs Flask vs Django
| 항목 | FastAPI | Flask | Django |
|---|---|---|---|
| 비동기 | ✅ | ❌ | ⚠️ 제한적 |
| 타입 힌트 | ✅ | ❌ | ❌ |
| 자동 문서화 | ✅ | ❌ | ❌ |
| 학습 곡선 | 낮음 | 낮음 | 높음 |
| 용도 | API/ML | 간단 웹앱 | 풀스택 |

**결론:** API 서버라면 FastAPI가 가장 합리적인 기본 선택지.

---

# 6) 실전 팁
- **API 서버 + ML 서빙** 조합에서 FastAPI는 거의 표준
- Django는 **어드민/템플릿이 필요한 풀스택**에서 여전히 강함
- Flask는 레거시 유지보수 용도로 많이 남음

---

# 참고
- https://fastapi.tiangolo.com/
- https://www.starlette.io/
- https://docs.pydantic.dev/
