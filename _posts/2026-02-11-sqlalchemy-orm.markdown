---
layout: single
title: "SQLAlchemy - Python ORM"
date: 2026-02-11 11:20:00 +0900
categories: backend
excerpt: "SQLAlchemy - Python ORM은/는 > 작성일: 2026-01-29"
toc: true
toc_sticky: true
tags: [SQLAlchemy, Python, ORM]
---

# TL;DR
- **SQLAlchemy - Python ORM의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
``` ┌─────────────────────────────────────────────────────────────┐ │                                                             │ │  SQLAlchemy = Python에서 가장 널리 쓰이는 ORM/SQL 툴킷      │ │                                                             │ │  탄생: 2006년 (Mike Bayer 개발)                             │ │  철학: "SQL is awesome, don't hide it"                      │ │                                                             │ │  두 가지 API 제공:                                          │ │  ├── Core: 저수준 SQL 추상화 (SQL Expression Language)      │ │  └── ORM: 고수준 객체-관계 매핑                             │ │                                                             │ │  특징:                                                      │ │  ├── 데이터베이스 독립적 (MySQL, PostgreSQL, SQLite 등)     │ │  ├── 유연함 (Core만 쓰거나 ORM만 쓰거나 둘 다)              │ │  ├── 강력한 쿼리 빌더                                       │ │  └── 2.0 버전에서 완전히 새로운 스타일 도입                 │ │                                                             │ └─────────────────────────────────────────────────────────────┘ ```

## 2. 배경
SQLAlchemy - Python ORM이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- 1 모델 정의
- 2 CRUD 작업
- 3 관계 쿼리 (Eager Loading)
- 관련 키워드

## 5. 상세 내용

> **작성일**: 2026-01-29
> **카테고리**: Backend / Database / ORM
> **포함 내용**: SQLAlchemy, ORM, Core, Session, Mapped, relationship, async, FastAPI 통합

---

# 1. SQLAlchemy란?

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SQLAlchemy = Python에서 가장 널리 쓰이는 ORM/SQL 툴킷      │
│                                                             │
│  탄생: 2006년 (Mike Bayer 개발)                             │
│  철학: "SQL is awesome, don't hide it"                      │
│                                                             │
│  두 가지 API 제공:                                          │
│  ├── Core: 저수준 SQL 추상화 (SQL Expression Language)      │
│  └── ORM: 고수준 객체-관계 매핑                             │
│                                                             │
│  특징:                                                      │
│  ├── 데이터베이스 독립적 (MySQL, PostgreSQL, SQLite 등)     │
│  ├── 유연함 (Core만 쓰거나 ORM만 쓰거나 둘 다)              │
│  ├── 강력한 쿼리 빌더                                       │
│  └── 2.0 버전에서 완전히 새로운 스타일 도입                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 2. 왜 ORM이 필요한가? (배경)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  문제: 객체지향 vs 관계형 DB의 불일치 (Impedance Mismatch)  │
│                                                             │
│  Python 객체:                    SQL 테이블:                │
│  ┌─────────────────┐            ┌─────────────────────┐    │
│  │ class User:     │            │ CREATE TABLE users  │    │
│  │   id: int       │  vs        │ (                   │    │
│  │   name: str     │            │   id INTEGER,       │    │
│  │   posts: List   │←──────────?│   name VARCHAR(100) │    │
│  │                 │            │ )                   │    │
│  └─────────────────┘            └─────────────────────┘    │
│                                                             │
│  Raw SQL의 문제점:                                          │
│  ├── SQL 인젝션 위험 (문자열 연결 시)                       │
│  ├── DB 종류별로 SQL 문법 다름                              │
│  ├── 코드 중복 (CRUD마다 SQL 작성)                          │
│  ├── 타입 안전성 부족                                       │
│  └── 객체로 변환하는 코드 반복                              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Raw SQL 예시 (위험!):                                      │
│                                                             │
│  # ❌ SQL 인젝션 취약!                                      │
│  cursor.execute(                                            │
│      f"SELECT * FROM users WHERE name = '{user_input}'"     │
│  )                                                          │
│  # user_input = "'; DROP TABLE users; --"                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 3. ORM의 역사

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1990년대: 객체-관계 매핑 개념 등장                         │
│  ├── TopLink (Java, 1994)                                   │
│  └── 객체지향 프로그래밍의 확산                             │
│                                                             │
│  2000년대 초: ORM의 대중화                                  │
│  ├── Hibernate (Java, 2001) - 가장 영향력 있는 ORM          │
│  ├── Ruby on Rails ActiveRecord (2004)                      │
│  └── Django ORM (Python, 2005)                              │
│                                                             │
│  2006년: SQLAlchemy 탄생                                    │
│  ├── Mike Bayer가 개발                                      │
│  ├── "SQL을 숨기지 말자" 철학                               │
│  └── Core + ORM 이중 구조                                   │
│                                                             │
│  2010년대: ORM 논쟁                                         │
│  ├── "ORM은 안티패턴이다" vs "ORM이 생산성 높다"            │
│  └── SQLAlchemy는 중간 지점 제공 (Core로 SQL 직접 제어)     │
│                                                             │
│  2023년: SQLAlchemy 2.0                                     │
│  ├── 완전히 새로운 스타일 (async 네이티브 지원)             │
│  ├── 타입 힌트 완전 지원                                    │
│  └── 1.x 스타일은 레거시로 분류                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. SQLAlchemy 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    SQLAlchemy 구조                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     ORM Layer                        │   │
│  │  (Session, Query, Relationship, Mapper)              │   │
│  │                                                     │   │
│  │  → 객체 ↔ 테이블 매핑                               │   │
│  │  → 관계 관리 (1:N, N:M)                             │   │
│  │  → 세션/트랜잭션 관리                               │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │                    Core Layer                        │   │
│  │  (Engine, Connection, MetaData, Table, Column)       │   │
│  │                                                     │   │
│  │  → SQL 표현식 빌더                                  │   │
│  │  → 스키마 정의                                      │   │
│  │  → 연결 풀 관리                                     │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │                    DBAPI Layer                       │   │
│  │  (psycopg2, mysqlclient, sqlite3, asyncpg 등)        │   │
│  │                                                     │   │
│  │  → 실제 DB 드라이버                                 │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │                    Database                          │   │
│  │  (PostgreSQL, MySQL, SQLite, Oracle 등)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  핵심 개념:                                                 │
│  ├── ORM만 쓸 수도 있고                                     │
│  ├── Core만 쓸 수도 있고                                    │
│  └── 둘을 섞어 쓸 수도 있음 (유연함!)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 5. SQLAlchemy 2.0 스타일 (현대적)

## 5.1 모델 정의

```python
from sqlalchemy import String, ForeignKey, create_engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    Session
)
from typing import List, Optional
from datetime import datetime

# 베이스 클래스 정의
class Base(DeclarativeBase):
    pass

# 모델 정의 (SQLAlchemy 2.0 스타일)
class User(Base):
    __tablename__ = "users"

    # Mapped[타입] = 타입 힌트 + 컬럼 정의 통합
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    # Optional = nullable
    bio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # 관계 정의 (1:N)
    posts: Mapped[List["Post"]] = relationship(back_populates="author")

    def __repr__(self) -> str:
        return f"User(id={self.id}, name={self.name})"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(String(10000))

    # 외래키
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # 관계 (N:1)
    author: Mapped["User"] = relationship(back_populates="posts")
```

## 5.2 CRUD 작업

```python
from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session

# Engine 생성
engine = create_engine("postgresql://user:pass@localhost/mydb")

# 테이블 생성
Base.metadata.create_all(engine)

# ===== CREATE =====
with Session(engine) as session:
    new_user = User(name="김개발", email="kim@example.com")
    session.add(new_user)
    session.commit()
    print(f"생성된 ID: {new_user.id}")

# ===== READ (단건) =====
with Session(engine) as session:
    # 방법 1: Primary Key로 조회
    user = session.get(User, 1)

    # 방법 2: select 문
    stmt = select(User).where(User.email == "kim@example.com")
    user = session.scalar(stmt)
    print(user.name)

# ===== READ (다건) =====
with Session(engine) as session:
    stmt = (
        select(User)
        .where(User.name.like("%김%"))
        .order_by(User.created_at.desc())
    )
    users = session.scalars(stmt).all()

    for user in users:
        print(user)

# ===== UPDATE =====
with Session(engine) as session:
    # 방법 1: 객체 수정
    user = session.get(User, 1)
    user.name = "김수정"
    session.commit()

    # 방법 2: bulk update
    stmt = update(User).where(User.id > 100).values(bio="updated")
    session.execute(stmt)
    session.commit()

# ===== DELETE =====
with Session(engine) as session:
    # 방법 1: 객체 삭제
    user = session.get(User, 1)
    session.delete(user)
    session.commit()

    # 방법 2: bulk delete
    stmt = delete(User).where(User.created_at < datetime(2020, 1, 1))
    session.execute(stmt)
    session.commit()
```

## 5.3 관계 쿼리 (Eager Loading)

```python
from sqlalchemy.orm import joinedload, selectinload

with Session(engine) as session:
    # N+1 문제 방지

    # 방법 1: joinedload (JOIN 사용)
    stmt = select(User).options(joinedload(User.posts)).where(User.id == 1)
    user = session.scalar(stmt)

    # 방법 2: selectinload (별도 쿼리)
    stmt = select(User).options(selectinload(User.posts))
    users = session.scalars(stmt).all()

    # 관계 데이터 접근
    for post in user.posts:
        print(f"{user.name}의 글: {post.title}")
```

---

# 6. 비동기 지원 (Async)

```python
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker
)
from sqlalchemy import select

# 비동기 엔진 (asyncpg 드라이버 사용)
engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/mydb",
    echo=True,
)

# 비동기 세션 팩토리
async_session = async_sessionmaker(engine, expire_on_commit=False)

# 비동기 CRUD
async def create_user(name: str, email: str) -> User:
    async with async_session() as session:
        user = User(name=name, email=email)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

async def get_user(user_id: int) -> User | None:
    async with async_session() as session:
        return await session.get(User, user_id)

async def get_users_by_name(name: str) -> list[User]:
    async with async_session() as session:
        stmt = select(User).where(User.name.like(f"%{name}%"))
        result = await session.scalars(stmt)
        return result.all()
```

---

# 7. FastAPI와 통합

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from contextlib import asynccontextmanager

# Engine & Session 설정
engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/mydb")
async_session = async_sessionmaker(engine, expire_on_commit=False)

# 의존성 주입용 세션 팩토리
async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session

# Lifespan으로 앱 시작/종료 시 처리
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(lifespan=lifespan)

# API 엔드포인트
@app.post("/users/")
async def create_user(
    name: str,
    email: str,
    db: AsyncSession = Depends(get_db)
):
    user = User(name=name, email=email)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "name": user.name}

@app.get("/users/{user_id}")
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

---

# 8. Core vs ORM 비교

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SQLAlchemy Core (저수준):                                  │
│                                                             │
│  from sqlalchemy import Table, Column, Integer, String      │
│  from sqlalchemy import select, insert, update, delete      │
│                                                             │
│  # 테이블 정의                                              │
│  users = Table(                                             │
│      "users", metadata,                                     │
│      Column("id", Integer, primary_key=True),               │
│      Column("name", String(100)),                           │
│  )                                                          │
│                                                             │
│  # 쿼리 실행                                                │
│  stmt = select(users).where(users.c.name == "김개발")       │
│  result = conn.execute(stmt)                                │
│                                                             │
│  장점: SQL 직접 제어, 복잡한 쿼리, 성능 튜닝                │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  SQLAlchemy ORM (고수준):                                   │
│                                                             │
│  class User(Base):                                          │
│      __tablename__ = "users"                                │
│      id: Mapped[int] = mapped_column(primary_key=True)      │
│      name: Mapped[str] = mapped_column(String(100))         │
│                                                             │
│  # 쿼리 실행                                                │
│  stmt = select(User).where(User.name == "김개발")           │
│  user = session.scalar(stmt)                                │
│                                                             │
│  장점: 객체지향적, 관계 자동 관리, 코드 가독성              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 9. SQLAlchemy vs 다른 ORM

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────┬─────────────────┬─────────────────┬──────────────┐  │
│  │                │  SQLAlchemy     │  Django ORM     │  Tortoise    │  │
│  ├────────────────┼─────────────────┼─────────────────┼──────────────┤  │
│  │ 철학           │ SQL은 좋은 것   │ SQL 숨기기      │ Django 스타일│  │
│  ├────────────────┼─────────────────┼─────────────────┼──────────────┤  │
│  │ 프레임워크     │ 독립적          │ Django 전용     │ 독립적       │  │
│  ├────────────────┼─────────────────┼─────────────────┼──────────────┤  │
│  │ Async 지원     │ 2.0에서 완벽    │ 4.1+에서 제한적 │ 네이티브     │  │
│  ├────────────────┼─────────────────┼─────────────────┼──────────────┤  │
│  │ 복잡한 쿼리    │ 매우 강력       │ 한계 있음       │ 중간         │  │
│  ├────────────────┼─────────────────┼─────────────────┼──────────────┤  │
│  │ 학습 곡선      │ 가파름          │ 완만함          │ 중간         │  │
│  └────────────────┴─────────────────┴─────────────────┴──────────────┘  │
│                                                                          │
│  선택 가이드:                                                            │
│  ├── Django 프로젝트 → Django ORM                                        │
│  ├── FastAPI + 복잡한 쿼리 → SQLAlchemy                                  │
│  └── FastAPI + 간단한 CRUD → Tortoise 또는 SQLAlchemy                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# 10. 성능 팁

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. N+1 문제 방지                                           │
│                                                             │
│     # ❌ N+1 (users 1번 + posts N번)                        │
│     users = session.scalars(select(User)).all()             │
│     for user in users:                                      │
│         print(user.posts)  # 매번 쿼리!                     │
│                                                             │
│     # ✓ Eager Loading (2번의 쿼리)                          │
│     stmt = select(User).options(selectinload(User.posts))   │
│     users = session.scalars(stmt).all()                     │
│                                                             │
│  2. Bulk 작업 사용                                          │
│                                                             │
│     # ❌ 느림 (1000번의 INSERT)                             │
│     for i in range(1000):                                   │
│         session.add(User(name=f"user{i}"))                  │
│                                                             │
│     # ✓ 빠름 (1번의 INSERT)                                 │
│     session.execute(                                        │
│         insert(User),                                       │
│         [{"name": f"user{i}"} for i in range(1000)]         │
│     )                                                       │
│                                                             │
│  3. 필요한 컬럼만 조회                                      │
│     select(User.id, User.name) vs select(User)              │
│                                                             │
│  4. 인덱스 활용                                             │
│     mapped_column(index=True)                               │
│                                                             │
│  5. Connection Pool 설정                                    │
│     pool_size, max_overflow 적절히 설정                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 11. 정리

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SQLAlchemy 핵심 요약:                                      │
│                                                             │
│  1. Python 최고의 ORM/SQL 툴킷 (2006년~)                    │
│                                                             │
│  2. 이중 구조: Core (저수준) + ORM (고수준)                 │
│                                                             │
│  3. 2.0 스타일 = 현대적, 타입 힌트, async 지원              │
│     └── Mapped[타입] + mapped_column()                      │
│                                                             │
│  4. FastAPI와 찰떡궁합                                      │
│     └── async_session + Depends 패턴                        │
│                                                             │
│  5. 성능 핵심: N+1 방지, Bulk 작업, 필요한 것만 조회        │
│                                                             │
│  6. 철학: "SQL은 좋은 것, 숨기지 말자"                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`SQLAlchemy`, `ORM`, `Object-Relational Mapping`, `Core`, `Session`, `Mapped`, `mapped_column`, `relationship`, `async`, `AsyncSession`, `Engine`, `select`, `N+1 문제`, `Eager Loading`, `joinedload`, `selectinload`
