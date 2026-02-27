---
layout: single
title: "Spring Pageable - 페이지네이션 완벽 가이드"
date: 2026-02-27 23:00:00 +0900
categories: backend
excerpt: "Spring Pageable은 다양한 DB의 페이지네이션 문법을 추상화해 일관된 목록 조회와 정렬을 제공한다."
toc: true
toc_sticky: true
tags: [spring, pageable, pagination, jpa, page, slice]
---

**TL;DR**

- Pageable/PageRequest로 페이지·사이즈·정렬 정보를 캡슐화한다.
- Page, Slice, Window 등 응답 타입과 성능 차이를 설명한다.
- OFFSET/LIMIT과 키셋 기반, 스크롤 전략을 비교한다.

## 1. 개념
Pageable은 페이지 요청 정보를 표현하는 Spring Data의 표준 추상화다.

## 2. 배경
DB마다 다른 페이지네이션 SQL 때문에 코드가 복잡해지고 종속성이 커졌다.

## 3. 이유
일관된 API로 목록 조회를 단순화하고 성능 전략을 선택하기 위해서다.

## 4. 특징
Sort, Page/Slice/Window, 키셋 페이지네이션, HATEOAS 지원이 포함된다.

## 5. 상세 내용
# Spring Pageable - 페이지네이션 완벽 가이드

> **작성일**: 2026-02-27
> **카테고리**: Backend / Spring / Data Access
> **포함 내용**: Pageable, PageRequest, Page, Slice, Sort, Window, ScrollPosition, Keyset Pagination, OFFSET, LIMIT, HATEOAS

---

# 1. 페이지네이션이란?

## 1.1 기본 개념

페이지네이션(Pagination)은 대량의 데이터를 일정한 크기의 **페이지 단위**로 나누어 조회하는 기법입니다.

비유하면 **도서관의 도서 목록**과 같습니다. 도서관에 10만 권의 책이 있다고 해서, 방문객에게 10만 건의 목록을 한 번에 보여줄 수는 없습니다. 대신 "1페이지에 20권씩, 제목 가나다순"으로 나누어 보여주는 것이 자연스럽습니다. 웹 애플리케이션도 마찬가지입니다.

```
전체 데이터 100건:
┌──────────────────────────────────────────────────────────────┐
│  1  2  3  ... 20 │ 21 22 23 ... 40 │ 41 42 43 ... 60 │ ... │
│     Page 0        │     Page 1       │     Page 2       │     │
│    (size=20)      │    (size=20)     │    (size=20)     │     │
└──────────────────────────────────────────────────────────────┘
         ↑
    현재 보고 있는 페이지

요청 예시: "0번째 페이지, 20건씩, 이름순 정렬"
→ SELECT * FROM users ORDER BY name LIMIT 20 OFFSET 0
```

페이지네이션이 없으면 다음과 같은 문제가 발생합니다:

| 문제 | 설명 |
|------|------|
| 메모리 부족 | 수만 건의 데이터를 한 번에 메모리에 적재 |
| 네트워크 부하 | 거대한 JSON 응답으로 대역폭 낭비 |
| 느린 응답 시간 | 사용자가 수 초~수십 초를 기다림 |
| UX 저하 | 끝없이 스크롤해야 하는 목록 |

사실상 모든 웹 애플리케이션에서 **목록 조회 = 페이지네이션**이라고 해도 과언이 아닙니다. 검색 엔진, 쇼핑몰 상품 목록, 관리자 대시보드, 소셜 미디어 피드 등 어디에나 존재합니다.

## 1.2 데이터베이스별 페이지네이션 문법

문제는 각 데이터베이스마다 페이지네이션을 위한 SQL 문법이 **전혀 다르다**는 것입니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    데이터베이스별 페이지네이션 문법                       │
├──────────────┬──────────────────────────────────────────────────────────┤
│  MySQL       │  SELECT * FROM users ORDER BY name                      │
│              │  LIMIT 20 OFFSET 40;                                    │
│              │  -- 간결하고 직관적                                     │
├──────────────┼──────────────────────────────────────────────────────────┤
│  PostgreSQL  │  SELECT * FROM users ORDER BY name                      │
│              │  LIMIT 20 OFFSET 40;                                    │
│              │  -- MySQL과 동일한 문법 지원                             │
├──────────────┼──────────────────────────────────────────────────────────┤
│  Oracle      │  SELECT * FROM (                                        │
│  (12c 이전)  │    SELECT a.*, ROWNUM rnum FROM (                       │
│              │      SELECT * FROM users ORDER BY name                  │
│              │    ) a WHERE ROWNUM <= 60                               │
│              │  ) WHERE rnum > 40;                                     │
│              │  -- 3중 중첩 SELECT! 악몽...                            │
├──────────────┼──────────────────────────────────────────────────────────┤
│  Oracle 12c+ │  SELECT * FROM users ORDER BY name                      │
│              │  OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;               │
│              │  -- 표준 SQL 지원 (늦었지만...)                          │
├──────────────┼──────────────────────────────────────────────────────────┤
│  SQL Server  │  SELECT * FROM users ORDER BY name                      │
│              │  OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;               │
│              │  -- SQL Server 2012+                                    │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Oracle의 3중 중첩 SELECT 쿼리를 보면 왜 **추상화 계층**이 필요한지 바로 이해됩니다. 같은 "3페이지, 20건씩"이라는 요구사항을 처리하는데 데이터베이스마다 완전히 다른 SQL을 작성해야 한다면, 애플리케이션 코드는 특정 DB에 종속되고 이식성(portability)은 사라집니다.

바로 이 문제를 해결하기 위해 **Spring Data의 Pageable 추상화**가 탄생했습니다.

---

# 2. Spring의 Pageable이란?

## 2.1 Pageable 인터페이스

`Pageable`은 `org.springframework.data.domain` 패키지에 위치한 인터페이스로, **Spring Data Commons** 모듈에 소속되어 있습니다. Spring Data Commons는 Spring Data JPA, Spring Data MongoDB, Spring Data Redis 등 모든 Spring Data 서브프로젝트가 공유하는 공통 추상화 계층입니다.

즉, `Pageable`을 한 번 배우면 어떤 데이터 저장소를 사용하든 **동일한 방식으로 페이지네이션**을 적용할 수 있습니다.

```
Pageable (인터페이스) ← org.springframework.data.domain.Pageable
│
│  핵심 메서드:
│  ├── getPageNumber()  : int    → 현재 페이지 번호 (0-indexed)
│  ├── getPageSize()    : int    → 페이지당 항목 수
│  ├── getOffset()      : long   → OFFSET 값 (pageNumber * pageSize)
│  ├── getSort()        : Sort   → 정렬 정보
│  ├── next()           : Pageable → 다음 페이지 Pageable
│  ├── previousOrFirst(): Pageable → 이전 페이지 (없으면 첫 페이지)
│  └── first()          : Pageable → 첫 페이지 Pageable
│
└── AbstractPageRequest (추상 클래스)
    └── PageRequest (구현 클래스) ← 가장 많이 사용하는 구현체
        └── 팩토리 메서드: PageRequest.of(page, size, sort)
```

반환 타입 계층도 함께 이해해야 합니다:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      반환 타입 계층 구조                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Streamable<T> (인터페이스)                                         │
│  └── Slice<T> (인터페이스)                                          │
│      │  ├── getContent()    : List<T>  → 현재 페이지 데이터          │
│      │  ├── getNumber()     : int      → 현재 페이지 번호           │
│      │  ├── getSize()       : int      → 페이지 크기                │
│      │  ├── getNumberOfElements() : int → 현재 페이지 실제 데이터 수│
│      │  ├── hasNext()       : boolean  → 다음 페이지 존재 여부      │
│      │  ├── hasPrevious()   : boolean  → 이전 페이지 존재 여부      │
│      │  ├── isFirst()       : boolean  → 첫 페이지 여부             │
│      │  ├── isLast()        : boolean  → 마지막 페이지 여부         │
│      │  └── COUNT 쿼리를 실행하지 않음 (효율적!)                    │
│      │                                                              │
│      └── Page<T> (인터페이스) extends Slice<T>                      │
│          ├── getTotalPages()    : int  → 전체 페이지 수             │
│          ├── getTotalElements() : long → 전체 요소 수               │
│          └── COUNT(*) 쿼리가 추가로 실행됨 (비용 있음)              │
│                                                                     │
│  Window<T> (Spring Data 3.1+)                                       │
│  ├── Keyset 기반 페이지네이션 지원                                  │
│  ├── ScrollPosition으로 위치 추적                                   │
│  └── OFFSET의 성능 문제를 해결                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.2 PageRequest 사용법

`PageRequest`는 `Pageable`의 가장 일반적인 구현체이며, 팩토리 메서드 패턴을 통해 인스턴스를 생성합니다.

```java
// 기본 사용 - 0번째 페이지, 10개씩
Pageable pageable = PageRequest.of(0, 10);

// 단일 정렬 - 이름 오름차순
Pageable pageable = PageRequest.of(0, 10, Sort.by("name"));

// 단일 정렬 - 생성일 내림차순
Pageable pageable = PageRequest.of(0, 10, Sort.by(Direction.DESC, "createdAt"));

// 복합 정렬 - 생성일 내림차순 + 이름 오름차순
Pageable pageable = PageRequest.of(0, 10,
    Sort.by(Direction.DESC, "createdAt")
        .and(Sort.by(Direction.ASC, "name"))
);

// Sort.Order를 직접 사용하는 방식
Pageable pageable = PageRequest.of(0, 10, Sort.by(
    Sort.Order.desc("createdAt"),
    Sort.Order.asc("name")
));
```

Kotlin에서는 다음과 같이 작성합니다:

```kotlin
// Kotlin - 기본 사용
val pageable: Pageable = PageRequest.of(0, 10)

// Kotlin - 복합 정렬
val pageable = PageRequest.of(
    0, 10,
    Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("name"))
)
```

## 2.3 Pageable.unpaged()

정렬 정보만 필요하고 페이지네이션은 불필요한 경우 `Pageable.unpaged()`를 사용할 수 있습니다. 이 경우 전체 데이터를 반환하되, 정렬만 적용합니다.

```java
// 페이지네이션 없이 전체 조회 (정렬만 적용)
Pageable unpaged = Pageable.unpaged(Sort.by("name"));
```

주의: 데이터가 많으면 전체를 메모리에 올리므로, 소량 데이터에만 사용해야 합니다.

---

# 3. 탄생 배경 - 왜 만들어졌는가?

## 3.1 Spring Data 이전의 세계

Spring Data가 등장하기 이전, Java/Kotlin 개발자들은 모든 프로젝트에서 페이지네이션 유틸리티를 **직접 구현**해야 했습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│              Spring Data 이전: 반복되는 보일러플레이트                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  프로젝트 A:                                                        │
│  ├── PaginationUtil.java        (자체 구현)                         │
│  ├── PageResult.java            (자체 결과 DTO)                     │
│  ├── PaginationInterceptor.java (자체 인터셉터)                     │
│  └── MySQL 전용 LIMIT/OFFSET 하드코딩                               │
│                                                                     │
│  프로젝트 B:                                                        │
│  ├── PageHelper.java            (또 다른 자체 구현)                  │
│  ├── PagingInfo.java            (또 다른 결과 DTO)                   │
│  ├── PagingParam.java           (또 다른 파라미터 DTO)               │
│  └── Oracle ROWNUM 하드코딩                                         │
│                                                                     │
│  프로젝트 C:                                                        │
│  ├── Pager.java                 (또또 다른 자체 구현)                │
│  └── ...                                                            │
│                                                                     │
│  문제점:                                                            │
│  ├── 매 프로젝트마다 페이지네이션을 새로 구현                       │
│  ├── DB 변경 시 SQL을 전부 수정해야 함                              │
│  ├── 프로젝트마다 인터페이스가 달라서 학습 비용 발생                │
│  ├── 테스트 코드도 매번 새로 작성                                   │
│  └── 버그가 있어도 각 프로젝트에서 개별 수정                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 3.2 Hades 프로젝트 - Spring Data의 전신

Spring Data의 역사는 **Oliver Gierke**(현재 Oliver Drotbohm)가 독일 소프트웨어 회사 **Synyx**에서 시작한 **Hades** 프로젝트에서 시작됩니다.

Hades의 목표는 JPA를 사용할 때 반복되는 공통 데이터 접근 패턴(CRUD, 페이지네이션, 정렬 등)을 제거하는 것이었습니다. 이 프로젝트에서 `Pageable`, `Page`, `Sort` 등의 핵심 추상화가 처음 설계되었습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Spring Data 탄생 타임라인                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  2009-2010   Hades 프로젝트 (Oliver Gierke, Synyx)                  │
│      │       └── JPA 공통 패턴 제거 목적                            │
│      │       └── Pageable, Page, Sort 최초 설계                     │
│      │                                                              │
│  2010-2011   Mark Pollack(SpringSource)이 Oliver에게 연락            │
│      │       └── "NoSQL도 지원하는 범용 프레임워크로 확장하자"       │
│      │       └── 한 주말 만에 JPA 비특화 부분 분리 작업 완료        │
│      │                                                              │
│  2011-02     Spring Data JPA 1.0 GA                                 │
│      │       └── Hades를 Spring 프로젝트로 흡수                     │
│      │                                                              │
│  2011-06     Spring Data Commons 1.1.0.M1                           │
│      │       └── Pageable이 Commons로 이동 (범용 추상화)             │
│      │       └── MongoDB, Redis 등에서도 사용 가능                  │
│      │                                                              │
│  2013        Spring Data 1.5                                        │
│      │       └── Web 지원 강화 (자동 파라미터 바인딩)               │
│      │                                                              │
│  2017        Spring Data 2.0 (Kay)                                  │
│      │       └── 리액티브 지원 시작                                 │
│      │                                                              │
│  2022        Spring Data 3.0 (2022.0.0)                             │
│      │       └── Jakarta EE 전환                                    │
│      │                                                              │
│  2023        Spring Data 3.1+                                       │
│      │       └── Scroll API (Window<T>) 도입                        │
│      │       └── Keyset 기반 페이지네이션 공식 지원                 │
│      │                                                              │
│  현재        Spring Data 4.x (Spring Boot 4.x)                      │
│              └── 지속적인 발전                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

핵심은 Oliver Gierke가 **한 주말 만에** JPA에 특화되지 않은 공통 부분(Pageable, Sort, Page 등)을 분리하여 Spring Data Commons를 만들었다는 점입니다. 이 설계 결정 덕분에 오늘날 JPA든 MongoDB든 Elasticsearch든 동일한 `Pageable` 인터페이스로 페이지네이션을 처리할 수 있습니다.

---

# 4. Spring Data JPA와의 연동

## 4.1 Repository 인터페이스에서의 사용

Spring Data JPA의 Repository에서 `Pageable`을 파라미터로 받으면, Spring이 자동으로 페이지네이션 쿼리를 생성합니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // Page<T> 반환 - COUNT 쿼리 포함 (총 건수 필요 시)
    Page<User> findByStatus(String status, Pageable pageable);

    // Slice<T> 반환 - COUNT 쿼리 없음 (더 효율적)
    Slice<User> findByAgeGreaterThan(int age, Pageable pageable);

    // List<T> 반환 - 페이지 메타데이터 없이 데이터만
    List<User> findByCity(String city, Pageable pageable);
}
```

Kotlin에서는 다음과 같습니다:

```kotlin
interface UserRepository : JpaRepository<User, Long> {

    fun findByStatus(status: String, pageable: Pageable): Page<User>

    fun findByAgeGreaterThan(age: Int, pageable: Pageable): Slice<User>

    fun findByCity(city: String, pageable: Pageable): List<User>
}
```

## 4.2 자동 SQL 생성

Spring Data JPA는 반환 타입에 따라 자동으로 적절한 SQL을 생성합니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    반환 타입별 자동 SQL 생성                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Page<User> findByStatus("ACTIVE", PageRequest.of(2, 10))          │
│                                                                     │
│    자동 생성 쿼리 1 (데이터):                                       │
│    SELECT u.* FROM users u                                          │
│    WHERE u.status = 'ACTIVE'                                        │
│    ORDER BY u.id ASC                                                │
│    LIMIT 10 OFFSET 20;           ← MySQL 방언                      │
│                                                                     │
│    자동 생성 쿼리 2 (카운트):                                       │
│    SELECT COUNT(u.id) FROM users u                                  │
│    WHERE u.status = 'ACTIVE';    ← Page<T>일 때만!                  │
│                                                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                     │
│  같은 Pageable이 Oracle에서 실행되면:                                │
│    SELECT * FROM (                                                  │
│      SELECT a.*, ROWNUM rnum FROM (                                 │
│        SELECT u.* FROM users u                                      │
│        WHERE u.status = 'ACTIVE'                                    │
│        ORDER BY u.id ASC                                            │
│      ) a WHERE ROWNUM <= 30                                         │
│    ) WHERE rnum > 20;            ← Oracle 방언 (자동!)              │
│                                                                     │
│  개발자는 DB 방언(Dialect)을 신경 쓸 필요 없음!                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Hibernate의 `Dialect` 클래스가 각 데이터베이스에 맞는 SQL을 자동으로 생성해주기 때문에, 개발자는 `Pageable` 하나만 전달하면 됩니다.

## 4.3 @Query와 함께 사용

메서드 이름 기반 쿼리가 복잡해지면 `@Query` 어노테이션으로 JPQL이나 Native SQL을 직접 작성할 수 있습니다.

**JPQL 사용:**

```java
@Query("SELECT u FROM User u WHERE u.department.name = :deptName")
Page<User> findByDepartmentName(@Param("deptName") String deptName, Pageable pageable);
```

JPQL의 경우 Spring Data가 자동으로 COUNT 쿼리를 유도합니다.

**Native SQL 사용:**

```java
@Query(
    value = "SELECT * FROM users u JOIN departments d ON u.dept_id = d.id " +
            "WHERE d.name = :deptName",
    countQuery = "SELECT COUNT(*) FROM users u JOIN departments d ON u.dept_id = d.id " +
                 "WHERE d.name = :deptName",
    nativeQuery = true
)
Page<User> findByDepartmentNameNative(@Param("deptName") String deptName, Pageable pageable);
```

Native SQL에서 `Page<T>`를 반환할 때는 **반드시 `countQuery`를 명시**해야 합니다. Spring Data가 Native SQL의 구문을 분석하여 자동으로 COUNT 쿼리를 생성하기 어렵기 때문입니다. `countQuery`를 생략하면 전체 쿼리를 서브쿼리로 감싸서 COUNT를 수행하는데, 이는 성능 문제를 일으킬 수 있습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│            @Query + Pageable 사용 시 주의사항                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  JPQL:                                                              │
│  ├── COUNT 쿼리 자동 생성 (대부분 잘 동작)                          │
│  ├── 복잡한 JOIN/GROUP BY 시 countQuery 명시 권장                   │
│  └── Sort 파라미터가 JPQL ORDER BY로 자동 변환                      │
│                                                                     │
│  Native SQL:                                                        │
│  ├── countQuery 반드시 명시! (자동 생성 불가)                       │
│  ├── Sort 파라미터 적용 안 됨 (직접 ORDER BY 작성)                  │
│  └── DB 종속적 (방언 자동 변환 없음)                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 5. Controller 통합

## 5.1 Spring MVC 자동 파라미터 바인딩

Spring MVC는 `PageableHandlerMethodArgumentResolver`를 통해 HTTP 요청 파라미터를 자동으로 `Pageable` 객체로 변환합니다. 즉, Controller 메서드에 `Pageable` 타입의 파라미터를 선언하기만 하면 됩니다.

```
HTTP 요청:
GET /api/users?page=2&size=10&sort=name,asc&sort=createdAt,desc

        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PageableHandlerMethodArgumentResolver                              │
│  ├── page=2      → pageNumber = 2                                  │
│  ├── size=10     → pageSize = 10                                   │
│  ├── sort=name,asc         ─┐                                      │
│  └── sort=createdAt,desc   ─┴→ Sort(name ASC, createdAt DESC)      │
│                                                                     │
│  결과: PageRequest.of(2, 10, Sort.by(ASC,"name").and(DESC,"createdAt"))│
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
Controller 메서드의 Pageable 파라미터로 주입
```

**요청 파라미터 규격:**

| 파라미터 | 기본값 | 설명 | 예시 |
|----------|--------|------|------|
| `page` | 0 | 페이지 번호 (0-indexed) | `page=0` |
| `size` | 20 | 페이지 크기 | `size=10` |
| `sort` | 없음 | `field,direction` 형식 | `sort=name,asc` |

**주의**: `page`는 **0부터 시작**합니다. 사용자에게 "1페이지"로 보여주더라도 내부적으로는 `page=0`입니다.

**Controller 코드 예시:**

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    @GetMapping
    public Page<UserDto> getUsers(Pageable pageable) {
        // page, size, sort 파라미터가 자동으로 Pageable로 변환됨
        return userService.getUsers(pageable);
    }
}
```

Kotlin:

```kotlin
@RestController
@RequestMapping("/api/users")
class UserController(
    private val userService: UserService
) {
    @GetMapping
    fun getUsers(pageable: Pageable): Page<UserDto> {
        return userService.getUsers(pageable)
    }
}
```

**@PageableDefault 어노테이션:**

파라미터가 없을 때의 기본값을 커스터마이징하려면 `@PageableDefault`를 사용합니다.

```java
@GetMapping
public Page<UserDto> getUsers(
    @PageableDefault(size = 30, sort = "createdAt", direction = Sort.Direction.DESC)
    Pageable pageable
) {
    return userService.getUsers(pageable);
}
```

이 설정으로 `GET /api/users`(파라미터 없이) 호출 시 자동으로 "첫 페이지, 30건, 생성일 내림차순"이 적용됩니다.

## 5.2 전역 최대 페이지 크기 설정 (보안 필수!)

**이 설정은 보안상 매우 중요합니다.** 만약 최대 크기를 제한하지 않으면, 악의적인 사용자가 `size=1000000`을 보내서 서버의 메모리를 고갈시키거나 DB에 과도한 부하를 줄 수 있습니다 (DoS 공격).

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DoS 공격 시나리오                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  공격자: GET /api/users?size=999999999                              │
│                                                                     │
│  제한 없는 서버:                                                    │
│  ├── DB에서 999,999,999건 조회 시도                                 │
│  ├── 메모리 부족 (OutOfMemoryError)                                 │
│  ├── DB 커넥션 장시간 점유                                          │
│  └── 서비스 전체 다운!                                              │
│                                                                     │
│  제한 있는 서버 (maxPageSize=100):                                  │
│  ├── size=999999999 → size=100으로 자동 보정                        │
│  ├── DB에서 100건만 조회                                            │
│  └── 서비스 정상 운영                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**방법 1: Java Config**

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        PageableHandlerMethodArgumentResolver resolver =
            new PageableHandlerMethodArgumentResolver();
        resolver.setMaxPageSize(100);       // 최대 100건
        resolver.setFallbackPageable(
            PageRequest.of(0, 20)           // 기본값: 0페이지, 20건
        );
        resolvers.add(resolver);
    }
}
```

**방법 2: application.yml (Spring Boot)**

```yaml
spring:
  data:
    web:
      pageable:
        default-page-size: 20       # 기본 페이지 크기
        max-page-size: 100          # 최대 페이지 크기 (보안!)
        one-indexed-parameters: false # true면 page=1이 첫 페이지
        prefix: ""                  # 파라미터 접두사
        size-parameter: size        # 크기 파라미터 이름
        page-parameter: page        # 페이지 파라미터 이름
```

---

# 6. Page vs Slice - 언제 무엇을 사용하는가?

## 6.1 핵심 차이

`Page<T>`와 `Slice<T>`의 가장 큰 차이는 **COUNT 쿼리의 유무**입니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Page<T>:                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  쿼리 1: SELECT * FROM users WHERE status='ACTIVE'           │  │
│  │          ORDER BY name LIMIT 10 OFFSET 0;                    │  │
│  │                                           ← 데이터 쿼리     │  │
│  │                                                               │  │
│  │  쿼리 2: SELECT COUNT(*) FROM users WHERE status='ACTIVE';   │  │
│  │                                           ← 카운트 쿼리     │  │
│  │                                             (추가 비용!)     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  결과: content + totalElements + totalPages + ...                   │
│  용도: "총 1,234건 중 1페이지" 같은 전체 현황 표시                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Slice<T>:                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  쿼리: SELECT * FROM users WHERE status='ACTIVE'             │  │
│  │        ORDER BY name LIMIT 11 OFFSET 0;                      │  │
│  │                          ↑                                    │  │
│  │                     N+1개 조회!                               │  │
│  │            (10개만 반환, 11번째 존재 여부로 hasNext 판단)     │  │
│  │                                                               │  │
│  │  COUNT 쿼리 없음!                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  결과: content + hasNext + hasPrevious + ...                        │
│  용도: 무한 스크롤, "더 보기" 버튼                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

`Slice<T>`는 요청한 크기보다 **1개 더 조회**해서 다음 페이지 존재 여부만 확인합니다. COUNT 쿼리가 없으므로 대용량 데이터에서 훨씬 효율적입니다.

## 6.2 COUNT 쿼리의 비용

COUNT 쿼리가 왜 문제가 되는지 이해해야 합니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│             COUNT 쿼리의 숨겨진 비용                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  테이블 크기별 COUNT(*) 실행 시간 (예시):                           │
│                                                                     │
│  데이터 수      │  COUNT 시간  │  영향                              │
│  ───────────────┼─────────────┼────────────                        │
│  1만 건         │  ~1ms       │  무시 가능                          │
│  100만 건       │  ~50ms      │  느껴지기 시작                      │
│  1,000만 건     │  ~500ms     │  응답 시간에 큰 영향                │
│  1억 건         │  ~5s        │  사용 불가 수준                     │
│                                                                     │
│  WHERE 조건이 인덱스를 타지 않으면 더 심각:                          │
│  → Full Table Scan으로 COUNT → 수십 초                              │
│                                                                     │
│  매 페이지 요청마다 COUNT가 실행되므로:                              │
│  → 사용자가 페이지를 넘길 때마다 부하 발생                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 6.3 사용 사례별 권장 반환 타입

| 사용 사례 | 권장 타입 | 이유 |
|-----------|-----------|------|
| 관리자 목록 (테이블) | `Page<T>` | "총 N건" 표시 필요, 페이지 번호 네비게이션 |
| 검색 결과 | `Page<T>` | "약 N건의 결과" 표시 필요 |
| 무한 스크롤 (SNS 피드) | `Slice<T>` | 전체 건수 불필요, "더 보기"만 필요 |
| 모바일 앱 목록 | `Slice<T>` | "다음 페이지 있음?"만 필요 |
| 대용량 배치 처리 | `Slice<T>` | COUNT 비용 제거로 성능 확보 |
| 소셜 미디어 타임라인 | `Slice<T>` | 실시간 데이터, 전체 건수 의미 없음 |
| 대시보드 통계 목록 | `Page<T>` | 전체 현황 파악 필요 |
| 메타데이터 불필요 | `List<T>` | 데이터만 필요, 페이지 정보 불필요 |

## 6.4 List<T> 반환의 의미

`Pageable`을 파라미터로 받으면서 `List<T>`를 반환하면, 페이지네이션 쿼리는 실행되지만 메타데이터(총 건수, 다음 페이지 여부 등)는 제공되지 않습니다.

```java
// 페이지네이션은 적용되지만 메타데이터 없음
List<User> findByCity(String city, Pageable pageable);

// 호출 시: LIMIT/OFFSET이 적용된 쿼리 실행
// 반환: 단순 List (totalCount, hasNext 등 정보 없음)
```

---

# 7. OFFSET 기반 페이지네이션의 한계

## 7.1 성능 문제: 깊은 페이지

OFFSET 기반 페이지네이션의 가장 큰 문제는 **OFFSET이 커질수록 성능이 선형으로 저하**된다는 점입니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│              OFFSET의 성능 문제                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 0;               │
│  → DB가 10행을 읽음 → 빠름 (1ms)                                   │
│                                                                     │
│  SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 1000;            │
│  → DB가 1,010행을 읽고 1,000행을 버림 → 느려짐 (10ms)              │
│                                                                     │
│  SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 1000000;         │
│  → DB가 1,000,010행을 읽고 1,000,000행을 버림!                     │
│  → 매우 느림 (수 초~수십 초)                                        │
│                                                                     │
│  응답 시간 그래프:                                                  │
│                                                                     │
│  시간 │                                                  ╱          │
│  (ms) │                                               ╱             │
│       │                                            ╱                │
│       │                                         ╱                   │
│       │                                      ╱                      │
│       │                                   ╱                         │
│       │                                ╱                            │
│       │                             ╱                               │
│       │                          ╱                                  │
│       │                       ╱                                     │
│       │                    ╱                                        │
│       │                 ╱                                           │
│       │              ╱                                              │
│       │           ╱                                                 │
│       │        ╱                                                    │
│       │     ╱                                                       │
│       │──╱──────────────────────────────────────────── OFFSET       │
│       0        100K      500K      1M       2M                      │
│                                                                     │
│  OFFSET = N이면, DB는 N+LIMIT 행을 스캔해야 함                     │
│  → O(N) 시간 복잡도                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

이 문제는 인덱스가 있어도 피할 수 없습니다. DB가 정렬된 인덱스를 따라가더라도 OFFSET 위치까지 **순차적으로 건너뛰어야** 하기 때문입니다.

## 7.2 데이터 불일치 (Offset Shifting)

OFFSET 기반 페이지네이션의 또 다른 심각한 문제는 **데이터 변경 시 결과가 밀리거나 중복**되는 현상입니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│              Offset Shifting 문제                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [시점 1] 사용자가 Page 0 조회 (OFFSET=0, LIMIT=5)                  │
│                                                                     │
│  DB 상태:  A  B  C  D  E │ F  G  H  I  J │ K  L  M               │
│            ─────────────   ─────────────   ─────────               │
│              Page 0           Page 1         Page 2                 │
│                                                                     │
│  결과: [A, B, C, D, E] ← 사용자가 이것을 봄                        │
│                                                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                     │
│  [시점 2] 새 항목 "AA"가 INSERT (A보다 앞에 정렬)                   │
│                                                                     │
│  DB 상태: AA  A  B  C  D │ E  F  G  H  I │ J  K  L  M            │
│            ─────────────   ─────────────   ──────────              │
│              Page 0           Page 1         Page 2                 │
│                                                                     │
│  [시점 3] 사용자가 "다음 페이지" 클릭 → Page 1 (OFFSET=5)          │
│                                                                     │
│  결과: [E, F, G, H, I]                                              │
│         ↑                                                           │
│         E가 중복! (Page 0에서도 봤는데 Page 1에서 또 나옴)          │
│                                                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                     │
│  반대로 DELETE가 발생하면?                                           │
│  → 데이터가 건너뛰어져서 일부 항목을 아예 못 보게 됨!              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

실시간으로 데이터가 추가/삭제되는 환경(소셜 미디어 피드, 실시간 알림 등)에서는 이 문제가 특히 심각합니다.

## 7.3 Keyset 페이지네이션 (대안)

위 두 문제를 해결하기 위해 **Keyset 페이지네이션**(또는 Cursor 기반 페이지네이션)이 등장했습니다. OFFSET 대신 **마지막으로 본 항목의 키 값**을 기준으로 다음 데이터를 조회합니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│              OFFSET vs Keyset 비교                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OFFSET 방식:                                                       │
│  "50,001번째부터 10개 줘"                                           │
│  → DB: 50,010행 스캔, 50,000행 버림                                 │
│  → SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 50000;         │
│                                                                     │
│  Keyset 방식:                                                       │
│  "id=50000 다음부터 10개 줘"                                        │
│  → DB: 인덱스에서 id=50000 바로 찾고 10행만 읽음                    │
│  → SELECT * FROM orders WHERE id > 50000 ORDER BY id LIMIT 10;     │
│  → 항상 O(1)!  (OFFSET 크기와 무관)                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Spring Data 3.1+의 Scroll API:**

Spring Data 3.1부터 `Window<T>`와 `ScrollPosition`을 통해 Keyset 페이지네이션을 공식 지원합니다.

```java
// Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Window<User> findByStatusOrderByCreatedAtDesc(
        String status,
        OffsetScrollPosition position  // 또는 KeysetScrollPosition
    );
}
```

```java
// Keyset 기반 조회
WindowIterator<User> users = WindowIterator.of(
    position -> userRepository.findByStatusOrderByCreatedAtDesc(
        "ACTIVE", position
    )
).startingAt(ScrollPosition.keyset());   // 처음부터 시작

while (users.hasNext()) {
    Window<User> window = users.next();
    // window.getContent() → 현재 창의 데이터
    // 다음 호출 시 자동으로 keyset position이 갱신됨
}
```

## 7.4 OFFSET vs Keyset 비교표

| 항목 | OFFSET 기반 | Keyset 기반 |
|------|-------------|-------------|
| 성능 | O(N) - OFFSET이 커질수록 느림 | O(1) - 항상 일정 |
| 전체 페이지 수 | 알 수 있음 (COUNT 쿼리) | 알 수 없음 |
| 임의 페이지 이동 | 가능 ("5페이지로 이동") | 불가능 (순차적 이동만) |
| 데이터 일관성 | Offset Shifting 문제 | 안정적 |
| 구현 복잡도 | 낮음 | 중간 (복합 키 처리 등) |
| 적합 사례 | 관리자 대시보드, 검색 결과 | SNS 피드, 무한 스크롤 |
| Spring 지원 | Pageable (오래전부터) | Window (3.1+) |
| SEO 친화성 | 좋음 (URL에 page=N) | 어려움 (커서 값 노출) |

---

# 8. REST API 페이지네이션

## 8.1 기본 JSON 응답 구조

`Page<T>`를 Controller에서 반환하면 Spring이 자동으로 다음과 같은 JSON으로 직렬화합니다.

```json
{
    "content": [
        { "id": 1, "name": "김철수", "email": "kim@example.com" },
        { "id": 2, "name": "이영희", "email": "lee@example.com" },
        { "id": 3, "name": "박민수", "email": "park@example.com" }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 10,
        "sort": {
            "sorted": true,
            "orders": [
                { "property": "name", "direction": "ASC" }
            ]
        },
        "offset": 0,
        "paged": true
    },
    "totalPages": 5,
    "totalElements": 42,
    "last": false,
    "first": true,
    "size": 10,
    "number": 0,
    "numberOfElements": 10,
    "empty": false
}
```

```
┌─────────────────────────────────────────────────────────────────────┐
│              Page<T> JSON 응답 구조 분석                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  content           : 실제 데이터 배열                               │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                   │
│  pageable          : 요청 정보                                      │
│  ├── pageNumber    : 현재 페이지 번호 (0-indexed)                   │
│  ├── pageSize      : 요청한 페이지 크기                             │
│  ├── sort          : 정렬 정보                                      │
│  └── offset        : OFFSET 값                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                   │
│  totalPages        : 전체 페이지 수 (Page<T>만)                     │
│  totalElements     : 전체 요소 수 (Page<T>만)                       │
│  last              : 마지막 페이지 여부                             │
│  first             : 첫 페이지 여부                                 │
│  size              : 페이지 크기                                    │
│  number            : 현재 페이지 번호                               │
│  numberOfElements  : 현재 페이지의 실제 요소 수                     │
│  empty             : 비어있는지 여부                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 8.2 Spring HATEOAS 통합

REST API의 완성도를 높이려면 **HATEOAS**(Hypermedia As The Engine Of Application State) 원칙에 따라 하이퍼미디어 링크를 포함해야 합니다. Spring HATEOAS의 `PagedModel`과 `PagedResourcesAssembler`를 사용하면 이를 쉽게 구현할 수 있습니다.

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PagedResourcesAssembler<UserDto> assembler;

    @GetMapping
    public PagedModel<EntityModel<UserDto>> getUsers(Pageable pageable) {
        Page<UserDto> page = userService.getUsers(pageable);
        return assembler.toModel(page);
    }
}
```

HATEOAS 적용 시 JSON 응답:

```json
{
    "_embedded": {
        "userDtoList": [
            {
                "id": 1,
                "name": "김철수",
                "_links": {
                    "self": { "href": "http://localhost:8080/api/users/1" }
                }
            }
        ]
    },
    "_links": {
        "first": { "href": "http://localhost:8080/api/users?page=0&size=10" },
        "prev":  { "href": "http://localhost:8080/api/users?page=1&size=10" },
        "self":  { "href": "http://localhost:8080/api/users?page=2&size=10" },
        "next":  { "href": "http://localhost:8080/api/users?page=3&size=10" },
        "last":  { "href": "http://localhost:8080/api/users?page=4&size=10" }
    },
    "page": {
        "size": 10,
        "totalElements": 42,
        "totalPages": 5,
        "number": 2
    }
}
```

```
┌─────────────────────────────────────────────────────────────────────┐
│              HATEOAS 링크의 의미                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  _links:                                                            │
│  ├── first  : 첫 페이지 URL                                        │
│  ├── prev   : 이전 페이지 URL (첫 페이지면 없음)                   │
│  ├── self   : 현재 페이지 URL                                      │
│  ├── next   : 다음 페이지 URL (마지막이면 없음)                    │
│  └── last   : 마지막 페이지 URL                                    │
│                                                                     │
│  클라이언트는 URL을 하드코딩하지 않고,                               │
│  서버가 제공하는 링크를 따라가기만 하면 됨!                          │
│  → API 변경에 유연하게 대응 가능                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 8.3 커서 기반 vs 오프셋 기반 API 설계

현대 API에서는 두 가지 페이지네이션 스타일이 공존합니다.

```
┌──────────────────────────────────┬──────────────────────────────────┐
│       오프셋 기반 (Spring 기본)   │       커서 기반 (GitHub API 등)  │
├──────────────────────────────────┼──────────────────────────────────┤
│                                  │                                  │
│  요청:                           │  요청:                           │
│  GET /users?page=2&size=10       │  GET /users?after=cursor123      │
│                                  │           &first=10              │
│                                  │                                  │
│  응답:                           │  응답:                           │
│  {                               │  {                               │
│    "content": [...],             │    "edges": [                    │
│    "totalPages": 5,              │      { "node": {...},            │
│    "totalElements": 42,          │        "cursor": "abc" }         │
│    "number": 2                   │    ],                            │
│  }                               │    "pageInfo": {                 │
│                                  │      "hasNextPage": true,        │
│                                  │      "endCursor": "xyz"          │
│                                  │    }                             │
│                                  │  }                               │
│                                  │                                  │
│  장점: 직관적, 임의 페이지       │  장점: 성능, 데이터 일관성      │
│  단점: 깊은 페이지 성능 문제     │  단점: 임의 이동 불가           │
│                                  │                                  │
│  사례: 대부분의 REST API         │  사례: GitHub, Slack,            │
│        관리자 대시보드            │        Twitter, Facebook         │
│                                  │        GraphQL Relay             │
│                                  │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

---

# 9. 고급 주제

## 9.1 Specification + Pageable (동적 검색)

JPA Criteria API를 기반으로 하는 `Specification`과 `Pageable`을 결합하면 **동적 검색 조건과 페이지네이션**을 동시에 처리할 수 있습니다.

```java
// Repository: JpaSpecificationExecutor 상속
public interface UserRepository extends
    JpaRepository<User, Long>,
    JpaSpecificationExecutor<User> {
}
```

```java
// Specification 정의
public class UserSpecifications {

    public static Specification<User> hasStatus(String status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<User> nameLike(String keyword) {
        return (root, query, cb) ->
            cb.like(root.get("name"), "%" + keyword + "%");
    }

    public static Specification<User> ageGreaterThan(int age) {
        return (root, query, cb) -> cb.greaterThan(root.get("age"), age);
    }
}
```

```java
// 사용: 동적 조건 조합 + 페이지네이션
@Service
public class UserService {

    public Page<User> searchUsers(String status, String keyword,
                                   Integer minAge, Pageable pageable) {
        Specification<User> spec = Specification.where(null);

        if (status != null) {
            spec = spec.and(UserSpecifications.hasStatus(status));
        }
        if (keyword != null) {
            spec = spec.and(UserSpecifications.nameLike(keyword));
        }
        if (minAge != null) {
            spec = spec.and(UserSpecifications.ageGreaterThan(minAge));
        }

        return userRepository.findAll(spec, pageable);
    }
}
```

Kotlin에서는 더 간결하게 작성할 수 있습니다:

```kotlin
@Service
class UserService(private val userRepository: UserRepository) {

    fun searchUsers(
        status: String?,
        keyword: String?,
        minAge: Int?,
        pageable: Pageable
    ): Page<User> {
        val spec = listOfNotNull(
            status?.let { hasStatus(it) },
            keyword?.let { nameLike(it) },
            minAge?.let { ageGreaterThan(it) }
        ).reduceOrNull { acc, s -> acc.and(s) }
            ?: Specification.where(null)

        return userRepository.findAll(spec, pageable)
    }
}
```

## 9.2 DTO Projection + Pageable

엔티티 전체가 아닌 필요한 필드만 조회하면 성능을 개선할 수 있습니다. Spring Data는 Interface Projection과 Class-based Projection 두 가지를 지원합니다.

**Interface Projection (Open Projection):**

```java
// 인터페이스 정의 - 필요한 필드만
public interface UserSummary {
    Long getId();
    String getName();
    String getEmail();

    @Value("#{target.name + ' (' + target.email + ')'}")
    String getDisplayName();  // SpEL로 가공된 필드
}
```

```java
// Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Page<UserSummary> findByStatus(String status, Pageable pageable);
    // → SELECT u.id, u.name, u.email FROM users u WHERE u.status = ?
    //   (필요한 컬럼만 SELECT!)
}
```

**Class-based Projection (DTO):**

```java
// DTO 클래스
public record UserDto(Long id, String name, String email) {}
```

```java
// Repository - @Query와 함께
@Query("SELECT new com.example.dto.UserDto(u.id, u.name, u.email) " +
       "FROM User u WHERE u.status = :status")
Page<UserDto> findUserDtosByStatus(@Param("status") String status, Pageable pageable);
```

```
┌─────────────────────────────────────────────────────────────────────┐
│              Projection + Pageable의 이점                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  엔티티 직접 반환:                                                  │
│  SELECT * FROM users WHERE status = 'ACTIVE'                        │
│  → 모든 컬럼 조회 (불필요한 BLOB, TEXT 포함)                        │
│  → N+1 문제 가능성 (연관 엔티티 LAZY 로딩)                         │
│                                                                     │
│  Projection 반환:                                                   │
│  SELECT u.id, u.name, u.email FROM users u WHERE status = 'ACTIVE'  │
│  → 필요한 컬럼만 조회                                              │
│  → 네트워크/메모리 절약                                             │
│  → 영속성 컨텍스트 오염 방지                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 9.3 QueryDSL + Pageable

QueryDSL은 타입 세이프한 동적 쿼리를 작성할 수 있는 프레임워크입니다. `Pageable`과 결합하면 복잡한 동적 검색을 안전하게 구현할 수 있습니다.

```java
@Repository
public class UserQueryRepository {

    private final JPAQueryFactory queryFactory;

    public Page<User> searchUsers(UserSearchCondition condition, Pageable pageable) {
        QUser user = QUser.user;
        QDepartment dept = QDepartment.department;

        BooleanBuilder builder = new BooleanBuilder();

        if (condition.getStatus() != null) {
            builder.and(user.status.eq(condition.getStatus()));
        }
        if (condition.getName() != null) {
            builder.and(user.name.containsIgnoreCase(condition.getName()));
        }
        if (condition.getMinAge() != null) {
            builder.and(user.age.goe(condition.getMinAge()));
        }
        if (condition.getDeptName() != null) {
            builder.and(dept.name.eq(condition.getDeptName()));
        }

        // 데이터 쿼리
        List<User> content = queryFactory
            .selectFrom(user)
            .leftJoin(user.department, dept).fetchJoin()
            .where(builder)
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .orderBy(getOrderSpecifiers(pageable, user))
            .fetch();

        // COUNT 쿼리 (최적화: fetchJoin 제거)
        JPAQuery<Long> countQuery = queryFactory
            .select(user.count())
            .from(user)
            .leftJoin(user.department, dept)
            .where(builder);

        // PageableExecutionUtils로 COUNT 쿼리 최적화
        // → 첫 페이지이고 content 크기가 pageSize보다 작으면 COUNT 쿼리 실행 안 함!
        return PageableExecutionUtils.getPage(content, pageable, countQuery::fetchOne);
    }
}
```

`PageableExecutionUtils.getPage()`는 중요한 최적화를 수행합니다:
- 첫 페이지이고 데이터가 페이지 크기보다 적으면 → COUNT 쿼리 생략 (전체 데이터가 한 페이지 내)
- 마지막 페이지라면 → `offset + content.size()`로 계산하여 COUNT 쿼리 생략

## 9.4 Spring WebFlux 반응형 페이지네이션

Spring WebFlux (R2DBC)에서는 반응형 타입과 함께 페이지네이션을 사용합니다.

```kotlin
// R2DBC Repository
interface UserRepository : ReactiveSortingRepository<User, Long> {
    fun findByStatus(status: String, pageable: Pageable): Flux<User>
    fun countByStatus(status: String): Mono<Long>
}
```

```kotlin
// Service - 수동으로 Page 생성
@Service
class UserService(private val userRepository: UserRepository) {

    fun getUsers(status: String, pageable: Pageable): Mono<Page<User>> {
        return userRepository.findByStatus(status, pageable)
            .collectList()
            .zipWith(userRepository.countByStatus(status))
            .map { tuple ->
                PageImpl(tuple.t1, pageable, tuple.t2)
            }
    }
}
```

```
┌─────────────────────────────────────────────────────────────────────┐
│         WebFlux 페이지네이션 주의사항                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Spring Data R2DBC는 Page<T>를 직접 반환하지 않음                    │
│  → Flux<T>와 Mono<Long>(count)를 조합해서 수동으로 Page 생성        │
│                                                                     │
│  이유:                                                              │
│  ├── R2DBC는 비동기/논블로킹                                        │
│  ├── 데이터 쿼리와 COUNT 쿼리를 동시에 실행 가능                    │
│  ├── 하지만 두 결과를 합치는 것은 개발자 몫                         │
│  └── Spring Data R2DBC 향후 버전에서 개선 예정                      │
│                                                                     │
│  패턴:                                                              │
│  Flux<T> data = repository.findByX(pageable);                       │
│  Mono<Long> count = repository.countByX();                          │
│  Mono<Page<T>> page = data.collectList()                            │
│      .zipWith(count)                                                │
│      .map(tuple -> new PageImpl<>(tuple.getT1(),                    │
│                                    pageable, tuple.getT2()));       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 10. 다른 프레임워크와의 비교

페이지네이션은 모든 웹 프레임워크가 제공하는 기본 기능입니다. Spring Data의 접근 방식이 다른 프레임워크와 어떻게 다른지 비교해 봅니다.

```
┌──────────────┬──────────────────────────────────────────────────────┐
│  프레임워크   │  페이지네이션 방식                                    │
├──────────────┼──────────────────────────────────────────────────────┤
│  Spring Data │  Pageable 인터페이스 + 자동 파라미터 바인딩            │
│  (Java/      │  Page<T>, Slice<T>, Window<T> 반환 타입              │
│   Kotlin)    │  데이터 저장소 무관 (JPA, MongoDB, Redis, ...)        │
│              │  DB 방언 자동 처리                                    │
│              │                                                      │
│  Django      │  Paginator 클래스                                    │
│  (Python)    │  queryset.objects.all()[:10]  (슬라이싱)              │
│              │  django.core.paginator.Paginator(qs, per_page=10)   │
│              │  ORM과 통합, 템플릿 태그 제공                         │
│              │                                                      │
│  Rails       │  Kaminari 또는 will_paginate gem                     │
│  (Ruby)      │  User.page(2).per(10)                                │
│              │  메서드 체이닝 스타일                                  │
│              │  뷰 헬퍼로 페이지네이션 UI 자동 생성                  │
│              │                                                      │
│  .NET        │  IQueryable.Skip(n).Take(m)                          │
│  (C#)        │  Entity Framework Core                               │
│              │  LINQ 쿼리에 Skip/Take 조합                          │
│              │  AutoMapper + PagedList 패턴                          │
│              │                                                      │
│  Mongoose    │  Model.find().skip(n).limit(m)                       │
│  (Node.js)   │  mongoose-paginate-v2 플러그인                       │
│              │  커서 기반: Model.find({_id: {$gt: lastId}}).limit(m)│
│              │                                                      │
│  SQLAlchemy  │  query.offset(n).limit(m)                            │
│  (Python)    │  flask-sqlalchemy: Pagination 객체                   │
│              │  paginate(page=2, per_page=10)                       │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Spring Data의 차별점:**

| 특징 | 설명 |
|------|------|
| 데이터 저장소 추상화 | 같은 `Pageable`로 JPA, MongoDB, Redis, Elasticsearch 등 모두 지원 |
| 자동 파라미터 바인딩 | HTTP 파라미터 → Pageable 자동 변환 (다른 프레임워크는 수동 또는 라이브러리 필요) |
| 반환 타입 다양성 | Page, Slice, List, Window 등 목적에 맞는 반환 타입 선택 가능 |
| COUNT 쿼리 최적화 | Slice, PageableExecutionUtils 등으로 불필요한 COUNT 제거 |
| Keyset 공식 지원 | Scroll API(Window)로 프레임워크 레벨에서 keyset 페이지네이션 지원 |

---

# 11. 실전 Best Practices

## 11.1 Page vs Slice 선택 기준

```
┌─────────────────────────────────────────────────────────────────────┐
│              Page vs Slice 의사결정 트리                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  "전체 건수(총 N건)" 표시가 필요한가?                                │
│  │                                                                  │
│  ├── YES → Page<T> 사용                                            │
│  │         (관리자 대시보드, 검색 결과 등)                          │
│  │                                                                  │
│  └── NO  → "다음 페이지 존재 여부"만 필요한가?                     │
│            │                                                        │
│            ├── YES → Slice<T> 사용                                 │
│            │         (무한 스크롤, 더 보기, 모바일 앱)              │
│            │                                                        │
│            └── NO  → 페이지 메타데이터 자체가 불필요               │
│                      → List<T> 사용                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 11.2 최대 크기 제한 필수 (보안)

앞서 설명했듯이, **반드시** `maxPageSize`를 설정해야 합니다. 기본값 2000도 대부분의 경우 과도하게 큽니다.

```yaml
# 권장 설정
spring:
  data:
    web:
      pageable:
        max-page-size: 100    # 대부분의 API에 적합
        default-page-size: 20
```

API별로 더 세밀한 제어가 필요하면 Controller에서 검증합니다:

```kotlin
@GetMapping
fun getUsers(pageable: Pageable): Page<UserDto> {
    require(pageable.pageSize <= 50) { "페이지 크기는 50을 초과할 수 없습니다" }
    return userService.getUsers(pageable)
}
```

## 11.3 깊은 페이지 문제 해결

OFFSET이 매우 커지는 상황(예: 10만 페이지 이후)을 방지해야 합니다.

**방법 1: 페이지 번호 상한 설정**

```kotlin
@GetMapping
fun getUsers(pageable: Pageable): Page<UserDto> {
    require(pageable.pageNumber <= 1000) { "1000페이지 이상은 조회할 수 없습니다" }
    return userService.getUsers(pageable)
}
```

**방법 2: Keyset 페이지네이션(Scroll API)으로 전환**

대용량 데이터에서 깊은 페이지가 빈번하면 Spring Data 3.1+의 Scroll API를 도입합니다.

**방법 3: 검색 조건 강제**

```kotlin
// 반드시 검색 조건을 요구하여 전체 데이터 스캔 방지
@GetMapping("/search")
fun searchUsers(
    @RequestParam keyword: String,  // 필수 파라미터
    pageable: Pageable
): Page<UserDto> {
    require(keyword.length >= 2) { "검색어는 2글자 이상이어야 합니다" }
    return userService.search(keyword, pageable)
}
```

## 11.4 Native 쿼리의 countQuery 명시

`@Query(nativeQuery = true)`에서 `Page<T>`를 반환할 때 `countQuery`를 생략하면, Spring Data가 원래 쿼리를 서브쿼리로 감싸서 COUNT를 수행합니다. 이는 비효율적일 수 있으므로 명시하는 것이 좋습니다.

```java
// 나쁜 예: countQuery 생략
@Query(value = "SELECT * FROM users u JOIN orders o ON u.id = o.user_id " +
       "WHERE o.total > 1000",
       nativeQuery = true)
Page<User> findHighValueUsers(Pageable pageable);
// → Spring이 자동 생성하는 COUNT 쿼리가 비효율적일 수 있음

// 좋은 예: countQuery 명시
@Query(
    value = "SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 1000",
    countQuery = "SELECT COUNT(DISTINCT u.id) FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 1000",
    nativeQuery = true
)
Page<User> findHighValueUsers(Pageable pageable);
```

## 11.5 정렬 필수 (ORDER BY 없으면 비결정적)

페이지네이션에서 **정렬은 필수**입니다. ORDER BY 없이 LIMIT/OFFSET을 사용하면 DB가 어떤 순서로 데이터를 반환할지 보장되지 않습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│              정렬 없는 페이지네이션의 위험                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SELECT * FROM users LIMIT 10 OFFSET 0;                             │
│  → 결과: [A, B, C, D, E, F, G, H, I, J]                            │
│                                                                     │
│  SELECT * FROM users LIMIT 10 OFFSET 0;  (동일 쿼리, 잠시 후 실행) │
│  → 결과: [C, A, F, D, B, H, E, J, G, I]  ← 순서 다름!             │
│                                                                     │
│  이유:                                                              │
│  ├── ORDER BY 없으면 DB가 "가장 빠른 순서"로 반환                   │
│  ├── 이 순서는 DB 내부 상태(버퍼, 캐시, 병렬 처리)에 따라 변함     │
│  ├── 같은 쿼리도 실행 시점에 따라 다른 순서 가능                    │
│  └── 페이지 간 데이터 중복/누락 발생                                │
│                                                                     │
│  해결: 항상 ORDER BY를 명시 (최소한 PK로)                           │
│  → SELECT * FROM users ORDER BY id LIMIT 10 OFFSET 0;              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

기본 정렬을 보장하는 방법:

```kotlin
@GetMapping
fun getUsers(pageable: Pageable): Page<UserDto> {
    // 정렬이 없으면 기본 정렬 추가
    val safePageable = if (pageable.sort.isUnsorted) {
        PageRequest.of(
            pageable.pageNumber,
            pageable.pageSize,
            Sort.by(Sort.Direction.DESC, "id")
        )
    } else {
        pageable
    }
    return userService.getUsers(safePageable)
}
```

## 11.6 인덱스 설계

페이지네이션 성능은 **인덱스**에 크게 의존합니다. 자주 사용하는 정렬/필터 조건에 복합 인덱스를 설정해야 합니다.

```sql
-- 자주 사용하는 쿼리: WHERE status = ? ORDER BY created_at DESC
-- → 복합 인덱스 생성
CREATE INDEX idx_users_status_created_at
ON users (status, created_at DESC);

-- Keyset 페이지네이션용 인덱스
-- WHERE status = ? AND created_at < ? ORDER BY created_at DESC
-- → 같은 인덱스가 커버
```

```
┌─────────────────────────────────────────────────────────────────────┐
│         인덱스와 페이지네이션 성능                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  인덱스 없음:                                                       │
│  └── Full Table Scan → Sort → OFFSET Skip → 매우 느림              │
│                                                                     │
│  적절한 인덱스 있음:                                                │
│  └── Index Range Scan → 바로 OFFSET 위치로 → 빠름                  │
│                                                                     │
│  Keyset + 인덱스:                                                   │
│  └── Index Seek → 정확한 위치에서 시작 → 가장 빠름                  │
│                                                                     │
│  복합 인덱스 설계 원칙:                                             │
│  ├── WHERE 조건 컬럼이 먼저                                        │
│  ├── ORDER BY 컬럼이 뒤에                                          │
│  └── 예: INDEX(status, created_at DESC)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 12. 정리

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Spring Pageable 핵심 요약                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pageable이란?                                                      │
│  ├── 페이지네이션 요청을 추상화한 인터페이스                        │
│  ├── Spring Data Commons 소속 (모든 저장소 공통)                    │
│  └── PageRequest.of(page, size, sort)로 생성                        │
│                                                                     │
│  반환 타입 선택:                                                    │
│  ├── Page<T>   : 전체 건수 필요 (COUNT 쿼리 포함)                  │
│  ├── Slice<T>  : 다음 존재 여부만 (COUNT 없음, 효율적)             │
│  ├── List<T>   : 데이터만 (메타데이터 불필요)                      │
│  └── Window<T> : Keyset 기반 (Spring Data 3.1+)                    │
│                                                                     │
│  Controller 통합:                                                   │
│  ├── Pageable 파라미터 자동 바인딩 (?page=0&size=10&sort=name,asc) │
│  ├── @PageableDefault로 기본값 커스터마이징                         │
│  └── maxPageSize 설정 필수 (DoS 방지)                               │
│                                                                     │
│  OFFSET의 한계:                                                     │
│  ├── 깊은 페이지 성능 저하 (O(N))                                  │
│  ├── 데이터 변경 시 Offset Shifting                                 │
│  └── 대안: Keyset 페이지네이션 (Scroll API)                        │
│                                                                     │
│  Best Practices:                                                    │
│  ├── maxPageSize 반드시 설정                                        │
│  ├── ORDER BY 없는 페이지네이션 금지                                │
│  ├── Native @Query는 countQuery 명시                                │
│  ├── 대용량 + 무한 스크롤 → Slice 또는 Window                      │
│  ├── 동적 검색 → Specification 또는 QueryDSL + Pageable            │
│  └── 적절한 복합 인덱스 설계                                       │
│                                                                     │
│  역사:                                                              │
│  ├── Hades (Oliver Gierke) → Spring Data Commons (2011)             │
│  ├── Pageable/Page/Sort가 공통 추상화로 분리                        │
│  └── 한 번 배우면 JPA, MongoDB, Redis 등 모두 적용 가능             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Pageable`, `PageRequest`, `Page`, `Slice`, `Sort`, `Window`, `ScrollPosition`, `Keyset Pagination`, `OFFSET`, `LIMIT`, `Spring Data`, `Spring Data Commons`, `PagingAndSortingRepository`, `JpaRepository`, `@PageableDefault`, `PageableHandlerMethodArgumentResolver`, `PagedModel`, `HATEOAS`, `Specification`, `QueryDSL`, `Oliver Gierke`, `Hades`, `COUNT`, `Spring WebFlux`, `R2DBC`, `PageableExecutionUtils`, `페이지네이션`, `무한 스크롤`, `커서 기반`, `오프셋 기반`
