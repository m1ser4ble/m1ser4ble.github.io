---
layout: single
title: "JPA Auditing & EntityListener 완전 가이드"
date: 2026-03-31 23:00:00 +0900
categories: backend
excerpt: JPA Auditing은 엔티티 생성수정 시점과 주체를 자동 기록해 보일러플레이트를 줄이고 감사 추적 신뢰성을 높인다.
toc: true
toc_sticky: true
tags: [backend, jpa, springdata, auditing, entitylistener]
source: "/home/dwkim/dwkim/docs/backend/jpa-auditing-entitylistener-완전가이드.md"
---
TL;DR
- AuditingEntityListener는 @PrePersist와 @PreUpdate 훅에서 생성수정 시각과 사용자를 자동으로 채운다.
- @EnableJpaAuditing + AuditorAware 조합으로 JPA 순수성은 유지하면서 SecurityContext 사용자 추적을 연결할 수 있다.
- 변경 이력 전체(변경 전후 값)가 필요하면 Envers나 CDC를 함께 써야 한다.

## 1. 개념
JPA Auditing은 엔티티 생명주기 이벤트를 이용해 생성/수정 시점과 주체를 자동 기록하는 메커니즘이다.

## 2. 배경
엔티티마다 중복되는 @PrePersist/@PreUpdate 보일러플레이트와 사용자 추적 한계를 줄이기 위해 Spring Data JPA가 Auditing 추상화를 제공했다.

## 3. 이유
감사 정보 자동화는 실수 가능성을 줄이고, 디버깅·컴플라이언스·운영 가시성을 동시에 높여 대규모 서비스에서 필수 인프라가 된다.

## 4. 특징
선언형 어노테이션 기반 설정, AuditorAware를 통한 사용자 주입, DateTimeProvider 커스터마이징, BaseEntity 상속 패턴과의 높은 결합성이 핵심 특징이다.

## 5. 상세 내용

# JPA Auditing & EntityListener 완전 가이드

> **작성일**: 2026-03-31
> **카테고리**: Backend / JPA / Spring Data / Auditing
> **키워드**: AuditingEntityListener, @CreatedDate, @LastModifiedDate, @CreatedBy, @LastModifiedBy, @EnableJpaAuditing, AuditorAware, @EntityListeners, @PrePersist, @PreUpdate, Hibernate Envers, CDC, Event Sourcing

---

## 목차

1. [개요](#1-개요)
2. [용어 사전](#2-용어-사전)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원과 진화](#4-역사적-기원과-진화)
5. [학술적/이론적 배경](#5-학술적이론적-배경)
6. [내부 아키텍처와 동작 원리](#6-내부-아키텍처와-동작-원리)
7. [대안 비교](#7-대안-비교)
8. [상황별 최적 선택](#8-상황별-최적-선택)
9. [실전 베스트 프랙티스](#9-실전-베스트-프랙티스)
10. [안티패턴과 함정](#10-안티패턴과-함정)
11. [빅테크 실전 사례](#11-빅테크-실전-사례)
12. [참고 자료](#12-참고-자료)

---

## 1. 개요

### 1.1 AuditingEntityListener란 무엇인가

**AuditingEntityListener는 JPA 엔티티의 라이프사이클 이벤트(@PrePersist, @PreUpdate)를 감지하여 감사(Audit) 메타데이터를 자동으로 채우는 Spring Data JPA의 핵심 인프라 리스너**이다. `@LastModifiedDate`는 이 리스너가 채우는 네 가지 감사 필드 중 하나로, "마지막 수정 시각"을 자동 기록한다.

Auditing의 본질은 단 한 문장으로 요약된다:

> **"누가(who), 언제(when) 이 데이터를 변경했는가"를 애플리케이션 코드의 개입 없이 자동으로 추적하는 것.**

이는 데이터베이스의 모든 레코드에 대해 책임 소재(accountability)와 변경 시점(temporality)을 투명하게 기록함으로써, 디버깅, 규제 준수, 데이터 무결성 검증의 기반이 된다.

### 1.2 핵심 구성요소

Spring Data JPA Auditing 에코시스템은 5개의 핵심 구성요소로 이루어진다:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Spring Data JPA Auditing 에코시스템                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐          ┌──────────────────────┐               │
│  │ @EnableJpaAuditing  │─────────>│  JpaAuditingRegistrar│               │
│  │ (Configuration)     │  @Import │  (BeanDefinition     │               │
│  └─────────────────────┘          │   등록)               │               │
│                                   └──────────┬───────────┘               │
│                                              │ 생성                       │
│                                              v                           │
│                                   ┌──────────────────────┐               │
│                                   │   AuditingHandler    │               │
│                                   │  (핵심 오케스트레이터)│               │
│                                   └──────────┬───────────┘               │
│                                              │ 주입                       │
│                                              v                           │
│  ┌──────────────┐   @PrePersist   ┌──────────────────────────┐           │
│  │  JPA Entity  │───/@PreUpdate──>│ AuditingEntityListener   │           │
│  │              │                 │  ├─ touchForCreate()     │           │
│  │ @CreatedDate │                 │  └─ touchForUpdate()     │           │
│  │ @LastModified│                 └──────────┬───────────────┘           │
│  │ @CreatedBy   │                            │                           │
│  │ @LastModified│                            │ 호출                       │
│  │   By         │                            v                           │
│  └──────────────┘                 ┌──────────────────────┐               │
│                                   │  AuditorAware<T>     │               │
│         ┌─────────────────────────│  (현재 사용자 제공)   │               │
│         │                         └──────────┬───────────┘               │
│         v                                    │                           │
│  ┌──────────────┐                            v                           │
│  │ SecurityContext│              ┌──────────────────────┐                │
│  │ (Spring Security)│           │  DateTimeProvider     │                │
│  │ 현재 인증된 사용자 │           │  (현재 시각 제공)     │                │
│  └──────────────┘               └──────────────────────┘                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 INSERT vs UPDATE 시 동작 차이

| 어노테이션 | INSERT 시 (@PrePersist) | UPDATE 시 (@PreUpdate) | 불변(Immutable) |
|-----------|------------------------|------------------------|-----------------|
| `@CreatedDate` | 현재 시각으로 설정됨 | 변경되지 않음 | YES |
| `@LastModifiedDate` | 현재 시각으로 설정됨 (= CreatedDate와 동일 시각) | 현재 시각으로 갱신됨 | NO |
| `@CreatedBy` | 현재 사용자로 설정됨 | 변경되지 않음 | YES |
| `@LastModifiedBy` | 현재 사용자로 설정됨 (= CreatedBy와 동일) | 현재 사용자로 갱신됨 | NO |

핵심 포인트: INSERT 시 `@LastModifiedDate`도 설정된다는 것은 의도된 동작이다. "마지막 수정 = 생성"이므로 논리적으로 올바르다. 이를 null로 두면 "한 번도 수정되지 않은" 것과 "수정 이력이 없는" 것을 구분할 수 없게 된다.

---

## 2. 용어 사전

### 2.1 핵심 Auditing 용어

| 용어 | 풀네임/의미 | 어원/유래 |
|------|-----------|----------|
| **Audit** | 감사, 추적 | 라틴어 *audire* ("to hear"). 15세기 영국 회계에서 장부를 **소리내어 읽으며(hear)** 검증하는 관행에서 유래. "Auditor"는 원래 "듣는 사람"이었다. 현대에는 체계적 검증과 책임 추적을 의미한다. |
| **AuditingEntityListener** | Auditing + Entity + Listener | JPA 엔티티(Entity)의 라이프사이클 이벤트를 감지(Listen)하여 감사(Auditing) 정보를 자동으로 채우는 리스너. Spring Data JPA가 2011년에 도입했다. |
| **@LastModifiedDate** | Last + Modified + Date | **왜 "Modified"이고 "Updated"가 아닌가?** `java.io.File.lastModified()` (1996), HTTP `Last-Modified` 헤더 (RFC 2616, 1999)의 관례를 따른다. "Updated"는 SQL의 `UPDATE` 문과 혼동될 수 있으므로, "Modified"는 "내용이 변경됨"이라는 **의미적 변경**에 초점을 맞춘 용어 선택이다. |
| **@CreatedDate** | Created + Date | 엔티티가 영속성 컨텍스트(Persistence Context)에 **처음** 영속화된 시각. `@PrePersist` 콜백 시점에 설정되며, 이후 불변(immutable)이다. |
| **@CreatedBy** | Created + By | 엔티티를 최초 생성한 사용자. `AuditorAware<T>`를 통해 채워진다. |
| **@LastModifiedBy** | Last + Modified + By | 엔티티를 마지막으로 수정한 사용자. UPDATE 시마다 갱신된다. |
| **AuditorAware\<T\>** | Auditor + Aware | **"Auditor"**: 감사 책임 주체(단순한 "User"보다 추상적이며, 시스템 계정, 배치 프로세스 등도 포함). **"Aware"**: Spring Framework의 인식(Awareness) 패턴 — `BeanNameAware`, `ApplicationContextAware` 등과 동일한 네이밍 관례. "현재 Auditor를 인식(aware)하는 컴포넌트"라는 의미이다. |
| **@EnableJpaAuditing** | Enable + JPA + Auditing | Spring 3.1에서 도입된 `@Enable*` 패턴을 따른다. 내부적으로 `@Import(JpaAuditingRegistrar.class)`를 수행하여 Auditing 인프라 Bean들을 자동 등록한다. `@EnableCaching`, `@EnableAsync` 등과 동일한 아키텍처이다. |
| **@PrePersist** | Pre + Persist | JPA 1.0 (JSR 220, 2006)에서 표준화된 라이프사이클 콜백. 엔티티가 영속화되기 **직전**에 호출된다. 데이터베이스 트리거(BEFORE INSERT)의 Java ORM 구현이다. |
| **@PreUpdate** | Pre + Update | 엔티티가 업데이트되기 **직전**에 호출되는 JPA 라이프사이클 콜백. 더티 체킹(dirty checking)으로 변경이 감지된 경우에만 발동한다. |
| **@EntityListeners** | Entity + Listeners | JPA 표준의 Observer 패턴 구현. Java AWT의 `ActionListener`, `MouseListener` 등의 네이밍 관례를 계승한다. 엔티티에 외부 리스너 클래스를 등록하는 메커니즘이다. |

### 2.2 관련 개념 구분

| 용어 | 정의 | 시간 범위 | 목적 |
|------|------|----------|------|
| **Auditing** | 책임 추적 — "누가, 언제" | 장기 (수년~영구) | 규제 준수, 법적 증빙 |
| **Logging** | 시스템 동작 기록 — "무엇이 발생했나" | 단기 (수일~수주) | 디버깅, 모니터링 |
| **Tracking** | 변경 추적 — "무엇이 바뀌었나" | 중간 (수주~수개월) | 변경 관리, 롤백 |

### 2.3 내부 구현 용어

| 용어 | 정의 |
|------|------|
| **touchForCreate()** | `AuditingEntityListener` 내부 메서드. `@PrePersist` 시 호출되어 `@CreatedDate`, `@CreatedBy`, `@LastModifiedDate`, `@LastModifiedBy` 모두 설정한다. |
| **touchForUpdate()** | `AuditingEntityListener` 내부 메서드. `@PreUpdate` 시 호출되어 `@LastModifiedDate`, `@LastModifiedBy`만 갱신한다. |
| **AuditingHandler** | Spring Data의 핵심 오케스트레이터. `AuditableBeanWrapper`를 통해 엔티티의 감사 필드를 Reflection으로 접근하고, `DateTimeProvider`와 `AuditorAware`로부터 값을 받아 설정한다. |
| **AnnotationAuditingMetadata** | 엔티티 클래스를 스캔하여 `@CreatedDate`, `@LastModifiedDate` 등의 필드 위치를 캐싱하는 메타데이터 클래스. |
| **Hibernate Envers** | **Ent**erprise **Vers**ioning **S**ystem. Hibernate ORM의 확장으로, 엔티티의 전체 변경 이력을 `_AUD` 접미사 테이블에 자동 기록한다. Adam Warski가 2007-2008년에 개발했다. |
| **DateTimeProvider** | 현재 시각을 제공하는 SPI(Service Provider Interface). 기본 구현은 `CurrentDateTimeProvider`로 `LocalDateTime.now()`를 반환한다. 테스트 시 고정 시각 주입에 사용한다. |
| **ObjectFactory\<T\>** | Spring의 지연 로딩 팩토리. JPA `@EntityListeners` 클래스는 Spring Bean이 아니므로, `AuditingHandler`를 직접 주입받을 수 없다. `ObjectFactory`를 통한 지연 해결(lazy resolution)로 이 제약을 우회한다. |

---

## 3. 등장 배경과 이유

### 3.1 JPA 자체의 한계

JPA 표준은 `@PrePersist`와 `@PreUpdate` 콜백을 제공한다. 타임스탬프 자동 설정에는 충분하지만, 근본적 한계가 있다:

```java
// JPA 콜백만으로 가능한 것: "언제(When)"
@Entity
public class Article {
    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
```

**문제: "누가(Who)"를 알 수 없다.**

JPA는 순수 Java Persistence 표준이다. Spring Security의 `SecurityContext`가 무엇인지 알 수 없고, 알아서도 안 된다. 엔티티 콜백 메서드 안에서 `SecurityContextHolder.getContext().getAuthentication()`을 직접 호출하면 JPA의 프레임워크 독립성이 깨진다.

### 3.2 보일러플레이트 코드의 폭발

프로젝트 규모가 커지면 거의 모든 엔티티에 감사 필드가 필요하다. 수동 방식은 다음과 같은 문제를 야기한다:

```java
// Before: 모든 엔티티에 반복되는 보일러플레이트
@Entity
public class Article {
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        // SecurityContext 직접 접근 — JPA 원칙 위반!
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        this.createdBy = auth != null ? auth.getName() : "SYSTEM";
        this.updatedBy = this.createdBy;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        this.updatedBy = auth != null ? auth.getName() : "SYSTEM";
    }
}
// 이 코드가 50개, 100개 엔티티에 복사-붙여넣기...
```

| 문제 | 설명 |
|------|------|
| **코드 중복** | 모든 엔티티에 동일한 콜백 로직 복사 |
| **JPA 원칙 위반** | 엔티티가 Spring Security에 직접 의존 |
| **실수 가능성** | 신규 엔티티에 콜백 추가를 잊음 |
| **테스트 어려움** | SecurityContext를 모킹해야 함 |
| **일관성 부재** | 개발자마다 미묘하게 다른 구현 |

### 3.3 Spring Data JPA의 해결: AuditorAware 브릿지

Spring Data JPA는 JPA와 Spring Security 사이에 **AuditorAware라는 다리(bridge)**를 놓아 이 문제를 해결했다:

```
┌──────────────┐     AuditorAware     ┌───────────────────┐
│   JPA Layer  │<─────(bridge)───────>│  Spring Security  │
│              │                      │                   │
│ @PrePersist  │     AuditorAware     │  SecurityContext   │
│ @PreUpdate   │     .getCurrent      │  .getAuthentication│
│ @EntityList  │     Auditor()        │  .getName()        │
│  eners       │                      │                   │
└──────────────┘                      └───────────────────┘
       │                                       │
       │         관심사 분리 유지                │
       │  JPA는 Spring Security를 모름          │
       │  Spring Security는 JPA를 모름          │
       └───────────────────────────────────────┘
```

```java
// After: AuditingEntityListener 적용
@Entity
@EntityListeners(AuditingEntityListener.class)  // 이 한 줄이면 충분
public class Article extends AuditableBaseEntity {
    private String title;
    private String content;
    // 감사 필드는 상위 클래스에서 상속
}
```

```java
// AuditorAware 구현 — SecurityContext와 JPA의 유일한 접점
@Component
public class SecurityAuditorAware implements AuditorAware<String> {
    @Override
    public Optional<String> getCurrentAuditor() {
        return Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName);
    }
}
```

### 3.4 해결된 것과 남은 것

| 해결된 문제 | 방법 |
|-----------|------|
| "누가(Who)" 추적 | AuditorAware가 SecurityContext에서 현재 사용자 제공 |
| 보일러플레이트 제거 | @EntityListeners + BaseEntity 상속으로 선언적 적용 |
| JPA 독립성 유지 | AuditorAware가 브릿지 역할, 엔티티는 Spring에 무의존 |
| 테스트 용이성 | AuditorAware를 MockBean으로 교체 가능 |

| 여전히 남은 한계 | 설명 |
|---------------|------|
| 변경 이력 없음 | "최종 상태"만 알 뿐, "이전에 무엇이었는가"는 모름 → Hibernate Envers 필요 |
| Bulk UPDATE 미지원 | `@Query` JPQL UPDATE는 JPA 콜백을 우회함 |
| 필드 단위 변경 추적 불가 | "어떤 필드가 바뀌었는가"는 기록하지 않음 |

---

## 4. 역사적 기원과 진화

### 4.1 연대표

```
2001 ─── Hibernate 1.0 탄생 (Gavin King)
         │  Java ORM의 시작. 수동 타임스탬프 관리 시대.
         │  개발자가 직접 setCreatedAt(new Date())를 호출.
         │
2004 ─── Hibernate 3.0 — Interceptor API
         │  onSave(), onFlushDirty() 콜백 도입.
         │  EmptyInterceptor 상속으로 감사 로직 중앙화 가능.
         │  그러나 Hibernate 고유 API — 이식성 없음.
         │
2006 ─── JPA 1.0 (JSR 220) 표준화
         │  @PrePersist, @PreUpdate, @PostPersist, @PostUpdate 표준화.
         │  @EntityListeners로 외부 리스너 클래스 등록 메커니즘 도입.
         │  ★ SQL 트리거 개념의 Java ORM 구현.
         │
2007 ─── Hibernate Envers 시작 (Adam Warski)
 ~       │  @Versioned → @Audited 어노테이션.
2008     │  _AUD 테이블에 전체 변경 이력 자동 기록.
         │  AuditReader API로 시점 조회 가능.
         │
2008 ─── Spring Data 프로젝트 시작 (Oliver Gierke)
         │  Auditable<U, ID, T> 인터페이스 설계.
         │  Repository 추상화와 함께 감사 추상화 구상.
         │
2009 ─── JPA 2.0 (JSR 317)
         │  @EntityListeners 호출 순서 명확화.
         │  상속 시 리스너 동작 규칙 정립.
         │  Criteria API 도입.
         │
2011 ─── Spring Data JPA 1.0 GA
         │  ★ AuditingEntityListener 최초 도입.
         │  XML 기반 설정: <jpa:auditing auditor-aware-ref="..."/>
         │  Auditable 인터페이스 기반 동작.
         │
2013 ─── Spring Data JPA 1.3
 (봄)    │  ★ @CreatedDate, @LastModifiedDate 어노테이션 도입.
         │  Auditable 인터페이스 구현 없이 어노테이션만으로 사용 가능.
         │  → 채택률 급증.
         │
2013 ─── JPA 2.1 (JSR 338)
 (가을)  │  CDI(Contexts and Dependency Injection) 통한 DI 지원.
         │  Entity Graph, Stored Procedure 호출 추가.
         │
2014 ─── Spring Data JPA 1.5 / Spring Boot 1.0
         │  ★ @EnableJpaAuditing 도입 — XML 설정 대체.
         │  Spring Boot의 자동 설정(auto-configuration)과 통합.
         │  Java Config 기반의 현대적 설정 방식 확립.
         │
2017 ─── JPA 2.2 (JSR 338 Maintenance Release)
         │  java.time API (LocalDateTime, Instant 등) 공식 지원.
         │  @CreatedDate에 LocalDateTime 직접 사용 가능.
         │  (이전에는 java.util.Date 또는 컨버터 필요)
         │
2020 ─── Jakarta Persistence 3.0
         │  javax.persistence → jakarta.persistence 네임스페이스 전환.
         │  Spring Data R2DBC에 Reactive Auditing 추가.
         │  ReactiveAuditorAware<T>와 Mono<T> 기반 사용자 제공.
         │
2022 ─── Spring Boot 3.0 / Jakarta Persistence 3.1
         │  Jakarta EE 10 기반으로 전면 전환.
         │  UUID 기반 @GeneratedValue 표준화.
         │  Spring Data 2022.0 (= Spring Data 3.0).
         │
2024 ─── Spring Boot 3.3 / Spring Data 2024.0
 ~       │  Hibernate 6.5+와의 통합 강화.
2026     │  Virtual Threads 지원으로 Auditing 성능 향상.
         │  Kotlin Coroutine 기반 Reactive Auditing 안정화.
```

### 4.2 핵심 전환점 분석

**왜 2013년이 분기점인가?**

2011년 AuditingEntityListener가 처음 도입되었을 때는 `Auditable<U, ID, T>` 인터페이스를 구현해야 했다. 이는 도메인 엔티티가 Spring Data 인터페이스에 **직접 의존**하는 것을 의미했다:

```java
// 2011: 인터페이스 기반 — 침투적(invasive)
@Entity
public class Article implements Auditable<String, Long, LocalDateTime> {
    // 8개의 메서드를 구현해야 함 (getCreatedBy, setCreatedBy, ...)
}
```

2013년 어노테이션 기반으로 전환되면서 **비침투적(non-invasive)** 방식이 가능해졌다:

```java
// 2013~: 어노테이션 기반 — 비침투적
@Entity
public class Article {
    @CreatedDate
    private LocalDateTime createdAt;  // 필드에 어노테이션만 추가
}
```

이 변화는 채택률을 극적으로 높였고, Spring Data JPA Auditing이 사실상의 표준(de facto standard)이 되는 계기가 되었다.

---

## 5. 학술적/이론적 배경

### 5.1 JPA Lifecycle Callback 명세

JPA 라이프사이클 콜백은 JSR 220 (JPA 1.0, 2006), JSR 317 (JPA 2.0, 2009), JSR 338 (JPA 2.1, 2013)을 통해 발전했다. 핵심 콜백과 발동 시점:

```
┌─────────────────────────────────────────────────────────────┐
│                JPA Entity Lifecycle Callbacks                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [NEW]                                                      │
│    │                                                        │
│    │  persist()                                             │
│    v                                                        │
│  ┌──────────┐  @PrePersist                                  │
│  │ MANAGED  │◄─────────── INSERT SQL 직전에 호출            │
│  │(영속 상태)│  @PostPersist ─── INSERT SQL 직후에 호출       │
│  └────┬─────┘                                               │
│       │                                                     │
│       │  setter 호출 → 더티 체킹 → flush                    │
│       v                                                     │
│  ┌──────────┐  @PreUpdate                                   │
│  │ MANAGED  │◄─────────── UPDATE SQL 직전에 호출            │
│  │(변경 감지)│  @PostUpdate ─── UPDATE SQL 직후에 호출        │
│  └────┬─────┘                                               │
│       │                                                     │
│       │  remove()                                           │
│       v                                                     │
│  ┌──────────┐  @PreRemove                                   │
│  │ REMOVED  │◄─────────── DELETE SQL 직전에 호출            │
│  │(삭제 상태)│  @PostRemove ─── DELETE SQL 직후에 호출        │
│  └──────────┘                                               │
│                                                             │
│  find() / JPQL로 조회 시:                                    │
│       @PostLoad ─── SELECT 결과가 엔티티로 변환된 직후       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**JSR 명세의 핵심 규칙:**

| 규칙 | 명세 출처 | 내용 |
|------|----------|------|
| 호출 순서 | JSR 317 §3.5.1 | 기본 리스너 → `@EntityListeners` → 엔티티 자체 콜백 순으로 호출 |
| 상속 | JSR 317 §3.5.3 | 상위 클래스의 리스너가 먼저 호출, `@ExcludeSuperclassListeners`로 제외 가능 |
| 트랜잭션 | JSR 338 §3.5.2 | 콜백은 호출자의 트랜잭션 컨텍스트 내에서 실행 |
| 제약 | JSR 338 §3.5 | 콜백에서 EntityManager 호출 금지, JPQL 쿼리 실행 금지 |

### 5.2 Observer Pattern — @EntityListeners의 이론적 기반

`@EntityListeners`는 GoF(Gang of Four, 1994) 디자인 패턴의 **Observer Pattern**을 JPA 수준에서 구현한 것이다:

```
┌──────────────────────────────────────────────────┐
│              Observer Pattern 매핑               │
├──────────────┬───────────────────────────────────┤
│ GoF 개념      │ JPA 구현                          │
├──────────────┼───────────────────────────────────┤
│ Subject      │ JPA Entity (상태 변경의 주체)      │
│ Observer     │ @EntityListeners에 등록된 클래스    │
│ notify()     │ @PrePersist, @PreUpdate 콜백 호출  │
│ attach()     │ @EntityListeners(...) 어노테이션    │
│ detach()     │ @ExcludeDefaultListeners            │
│ ConcreteObs. │ AuditingEntityListener              │
│ state change │ persist(), merge(), flush()         │
└──────────────┴───────────────────────────────────┘
```

Observer 패턴이 여기서 적용된 핵심 이유:

1. **결합도 제거**: 엔티티가 감사 로직을 알 필요 없음 (Subject는 Observer의 구체적 행동을 모름)
2. **확장성**: 새로운 리스너를 추가해도 엔티티 코드 변경 없음
3. **재사용**: 하나의 리스너(AuditingEntityListener)를 수백 개 엔티티에 적용

### 5.3 AOP와의 관계 — 왜 JPA 방식을 선택했는가

Auditing은 전형적인 **횡단 관심사(Cross-Cutting Concern)**이다. Spring AOP로도 구현할 수 있지만, JPA EntityListeners 방식이 선택된 이유가 있다:

```
┌─────────────────────────────────────────────────────────────────┐
│               Auditing 구현 방식 비교                            │
├────────────────────┬────────────────────────────────────────────┤
│  Spring AOP Proxy  │  JPA EntityListeners                       │
├────────────────────┼────────────────────────────────────────────┤
│ Repository 메서드   │ Persistence Context 수준에서               │
│ 호출을 프록시로 감쌈 │ 엔티티 상태 전이를 직접 감지                │
│                    │                                            │
│ 단점:              │ 장점:                                       │
│ - 내부 호출 미감지  │ - 내부 호출도 감지 (프록시 우회 문제 없음)   │
│ - batch 작업 누락   │ - 모든 영속화 경로에서 동작                  │
│ - save() 외 경로   │ - JPA 표준 메커니즘                         │
│   누락 가능        │ - Hibernate flush 시점에 정확히 발동          │
│                    │                                            │
│ 프록시 기반:       │ 이벤트 기반:                                │
│ Service → Proxy    │ Entity → PersistenceContext →               │
│  → Repository      │  EventListener → Callback                  │
└────────────────────┴────────────────────────────────────────────┘
```

핵심: AOP는 **메서드 호출**을 가로채지만, EntityListeners는 **엔티티 상태 전이**를 감지한다. Auditing은 "메서드가 호출되었는가"가 아니라 "데이터가 실제로 영속화되는가"에 관심이 있으므로, EntityListeners가 더 정확한 시점에서 동작한다.

### 5.4 Audit Trail 데이터베이스 이론

완전한 Audit Trail은 다음 5가지 요소로 구성된다:

| 요소 | 설명 | Spring Data JPA 대응 |
|------|------|---------------------|
| **Timestamp** | 언제 변경되었는가 | `@CreatedDate`, `@LastModifiedDate` |
| **Actor** | 누가 변경했는가 | `@CreatedBy`, `@LastModifiedBy` |
| **Action** | 어떤 종류의 변경인가 (INSERT/UPDATE/DELETE) | 직접 지원 없음 (Envers는 RevisionType으로 지원) |
| **Before/After State** | 변경 전/후 값 | 직접 지원 없음 (Envers의 `_AUD` 테이블) |
| **Location** | 어디서 변경했는가 (IP, 서비스) | 직접 지원 없음 (커스텀 구현 필요) |

Spring Data JPA의 AuditingEntityListener는 이 중 **Timestamp**과 **Actor**만 자동화한다. 나머지 요소가 필요하면 Hibernate Envers 또는 CDC(Change Data Capture) 등 추가 도구가 필요하다.

### 5.5 규제 요구사항

| 규제 | 보존 기간 | 핵심 요구사항 |
|------|----------|-------------|
| **SOX** (Sarbanes-Oxley) | 7년 | 재무 데이터의 모든 변경 추적, 변조 방지 |
| **HIPAA** | 6년 | 의료 기록 접근/변경의 완전한 감사 추적 |
| **GDPR** (Article 30) | 처리 기간 동안 | 개인정보 처리 활동 기록, 삭제 요청 이행 증빙 |
| **PCI-DSS** | 12개월 (최소) | 카드 정보 접근 로그, 변경 감사 추적 |
| **SOC 1 & 2 Type II** | 감사 기간 (보통 12개월) | 통제 활동의 운영 효과성 증빙 |

Auditing은 단순한 편의 기능이 아니다. **규제 준수(compliance)의 기반 인프라**이다.

---

## 6. 내부 아키텍처와 동작 원리

이 장은 본 문서의 핵심이다. `@EnableJpaAuditing`이 어떤 Bean을 등록하고, `repository.save(entity)` 호출이 어떻게 `@CreatedDate` 필드에 시각을 채우는지, 그 전체 과정을 추적한다.

### 6.1 @EnableJpaAuditing이 등록하는 Bean들

```
┌──────────────────────────────────────────────────────────────────────┐
│                  @EnableJpaAuditing 내부 동작                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  @EnableJpaAuditing                                                  │
│       │                                                              │
│       │  @Import(JpaAuditingRegistrar.class)                         │
│       v                                                              │
│  ┌──────────────────────┐                                            │
│  │ JpaAuditingRegistrar │  (ImportBeanDefinitionRegistrar 구현)       │
│  │                      │                                            │
│  │  registerBeanDefs()  │                                            │
│  └──────────┬───────────┘                                            │
│             │                                                        │
│             │  등록하는 Bean들:                                        │
│             │                                                        │
│             ├──> ┌─────────────────────────────────┐                  │
│             │    │ AuditingHandlerBeanFactory       │                  │
│             │    │ (FactoryBean<AuditingHandler>)   │                  │
│             │    │                                  │                  │
│             │    │ 의존:                            │                  │
│             │    │  ├─ AuditorAware<T> (Optional)  │                  │
│             │    │  ├─ DateTimeProvider (Optional)  │                  │
│             │    │  └─ IsNewStrategyFactory          │                  │
│             │    └─────────────────────────────────┘                  │
│             │                                                        │
│             ├──> ┌─────────────────────────────────┐                  │
│             │    │ AuditingEntityListener           │                  │
│             │    │ (JPA EntityListener)             │                  │
│             │    │                                  │                  │
│             │    │ ObjectFactory<AuditingHandler>   │                  │
│             │    │  └─ 지연 로딩으로 Handler 획득    │                  │
│             │    └─────────────────────────────────┘                  │
│             │                                                        │
│             └──> ┌─────────────────────────────────┐                  │
│                  │ IsNewStrategyFactory             │                  │
│                  │                                  │                  │
│                  │ entity.getId() == null → 신규    │                  │
│                  │ entity.@Version == null → 신규   │                  │
│                  └─────────────────────────────────┘                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 AuditingEntityListener가 AuditingHandler를 얻는 방법

JPA `@EntityListeners`에 등록된 클래스는 **JPA 컨테이너(Hibernate)가 인스턴스화**한다. Spring IoC 컨테이너가 관리하는 Bean이 아니므로, `@Autowired`로 다른 Bean을 주입받을 수 없다.

Spring Data JPA는 이 문제를 `ObjectFactory<AuditingHandler>` 패턴으로 해결한다:

```java
// AuditingEntityListener 내부 (간소화)
public class AuditingEntityListener {

    // Spring Bean이 아니므로 @Autowired 불가!
    // 대신 ObjectFactory를 통한 지연 해결(lazy resolution)
    private @Nullable ObjectFactory<AuditingHandler> handler;

    // Spring이 이 메서드를 호출하여 ObjectFactory를 설정
    public void setAuditingHandler(ObjectFactory<AuditingHandler> handler) {
        this.handler = handler;
    }

    @PrePersist
    public void touchForCreate(Object target) {
        if (handler != null) {
            AuditingHandler h = handler.getObject();
            h.markCreated(target);  // Created + LastModified 모두 설정
        }
    }

    @PreUpdate
    public void touchForUpdate(Object target) {
        if (handler != null) {
            AuditingHandler h = handler.getObject();
            h.markModified(target);  // LastModified만 갱신
        }
    }
}
```

**ObjectFactory가 필요한 이유:**

```
┌──────────────────────────────────────────────────────┐
│                    인스턴스 생명주기                   │
├────────────────────────┬─────────────────────────────┤
│  Spring IoC 관리       │  JPA/Hibernate 관리          │
├────────────────────────┼─────────────────────────────┤
│  AuditingHandler       │  AuditingEntityListener     │
│  AuditorAware          │                             │
│  DateTimeProvider      │  ← ObjectFactory로 연결 →  │
│  Repository            │                             │
├────────────────────────┴─────────────────────────────┤
│  두 컨테이너의 생명주기가 다르므로 직접 주입 불가.      │
│  ObjectFactory가 "게으른 다리(lazy bridge)" 역할.     │
└──────────────────────────────────────────────────────┘
```

### 6.3 정확한 Call Chain

`repository.save(entity)`가 호출되었을 때 일어나는 일을 단계별로 추적한다:

```
repository.save(entity)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 1: SimpleJpaRepository.save(entity)                     │
│         → entityInformation.isNew(entity)                    │
│         → id가 null이면 em.persist(entity)                   │
│         → id가 있으면 em.merge(entity)                       │
└────────────────────────┬─────────────────────────────────────┘
                         │ persist() 호출됨
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Hibernate PersistenceContext                          │
│         → 엔티티 상태 전이: TRANSIENT → PERSISTENT            │
│         → ActionQueue에 EntityInsertAction 추가               │
│         → @PrePersist 이벤트 발행                             │
└────────────────────────┬─────────────────────────────────────┘
                         │ @PrePersist
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 3: AuditingEntityListener.touchForCreate(entity)        │
│         → ObjectFactory<AuditingHandler>.getObject()          │
│         → AuditingHandler 인스턴스 획득                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 4: AuditingHandler.markCreated(entity)                  │
│         → AnnotationAuditingMetadata.getMetadata(entity.class)│
│         → 클래스에서 @CreatedDate, @LastModifiedDate,         │
│           @CreatedBy, @LastModifiedBy 필드 위치 조회          │
│         → (결과는 ConcurrentHashMap에 캐싱)                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 5: DateTimeProvider.getNow()                            │
│         → 기본: CurrentDateTimeProvider                       │
│         → LocalDateTime.now() 호출                           │
│         → @CreatedDate 필드에 Reflection으로 설정             │
│         → @LastModifiedDate 필드에 동일 시각 설정             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 6: AuditorAware.getCurrentAuditor()                     │
│         → SecurityContextHolder.getContext()                  │
│           .getAuthentication().getName()                      │
│         → Optional<String> 반환                               │
│         → @CreatedBy 필드에 Reflection으로 설정               │
│         → @LastModifiedBy 필드에 동일 사용자 설정             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 7: Hibernate flush()                                     │
│         → 더티 체킹 완료                                      │
│         → INSERT SQL 생성 및 실행                             │
│         → INSERT INTO article (title, content, created_at,    │
│           last_modified_at, created_by, last_modified_by, ...) │
│           VALUES (?, ?, ?, ?, ?, ?, ...)                      │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Reflection 메타데이터 캐싱

`AnnotationAuditingMetadata`는 엔티티 클래스의 감사 어노테이션 위치를 **클래스당 한 번만** 스캔하고, 이후에는 `ConcurrentHashMap`에서 캐시된 결과를 사용한다:

```java
// AnnotationAuditingMetadata 내부 (간소화)
public class AnnotationAuditingMetadata {

    // 전역 캐시: 클래스 → 메타데이터
    private static final Map<Class<?>, AnnotationAuditingMetadata> CACHE
        = new ConcurrentHashMap<>();

    private final Optional<Field> createdDateField;
    private final Optional<Field> lastModifiedDateField;
    private final Optional<Field> createdByField;
    private final Optional<Field> lastModifiedByField;

    public static AnnotationAuditingMetadata getMetadata(Class<?> type) {
        return CACHE.computeIfAbsent(type, AnnotationAuditingMetadata::new);
    }

    private AnnotationAuditingMetadata(Class<?> type) {
        // 클래스 계층 전체를 스캔하여 어노테이션 필드 위치 파악
        this.createdDateField = findAnnotatedField(type, CreatedDate.class);
        this.lastModifiedDateField = findAnnotatedField(type, LastModifiedDate.class);
        this.createdByField = findAnnotatedField(type, CreatedBy.class);
        this.lastModifiedByField = findAnnotatedField(type, LastModifiedBy.class);
    }
}
```

**성능 영향:**
- 첫 번째 호출: Reflection 스캔 (~수백 us)
- 이후 호출: ConcurrentHashMap.get() (~수십 ns)
- 결론: 애플리케이션 전체 수명에서 클래스당 한 번의 비용. 무시 가능.

### 6.5 INSERT vs UPDATE 동작 차이 상세

```
┌────────────────────────────────────────────────────────────────────┐
│                     INSERT 시 (touchForCreate)                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  markCreated(entity)                                               │
│    │                                                               │
│    ├─ @CreatedDate     ← DateTimeProvider.getNow()  [설정됨]       │
│    ├─ @LastModifiedDate ← DateTimeProvider.getNow() [설정됨]       │
│    ├─ @CreatedBy       ← AuditorAware.getCurrent()  [설정됨]      │
│    └─ @LastModifiedBy  ← AuditorAware.getCurrent()  [설정됨]      │
│                                                                    │
│  4개 필드 모두 설정. CreatedDate == LastModifiedDate (동일 시각)     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                     UPDATE 시 (touchForUpdate)                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  markModified(entity)                                              │
│    │                                                               │
│    ├─ @CreatedDate     ← [변경 안 됨, 스킵]                       │
│    ├─ @LastModifiedDate ← DateTimeProvider.getNow() [갱신됨]       │
│    ├─ @CreatedBy       ← [변경 안 됨, 스킵]                       │
│    └─ @LastModifiedBy  ← AuditorAware.getCurrent()  [갱신됨]      │
│                                                                    │
│  Created 계열은 스킵. Modified 계열만 갱신.                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Created 필드가 UPDATE 시 보호되는 메커니즘:**

`AuditingHandler.markModified()`는 내부적으로 `isNew(entity)` 검사를 수행한다. 엔티티가 신규가 아니면(= `@Id`가 null이 아니면) Created 계열 필드를 건드리지 않는다. 그러나 이것은 **애플리케이션 레벨** 보호이다. DB 레벨 보호를 위해서는 반드시 `@Column(updatable = false)`를 추가해야 한다.

### 6.6 isNew() 판단 메커니즘

```
┌────────────────────────────────────────────────────────────┐
│                   isNew() 판단 흐름                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  entity가 Persistable<ID>를 구현하는가?                    │
│    ├─ YES → entity.isNew() 호출 (사용자 정의 로직)        │
│    └─ NO  →                                               │
│           │                                                │
│           │  @Version 필드가 있는가?                        │
│           │  ├─ YES → @Version == null/0이면 신규          │
│           │  └─ NO  →                                      │
│           │          │                                     │
│           │          │  @Id 필드 확인                       │
│           │          │  ├─ 객체 타입 (Long) → null이면 신규 │
│           │          │  └─ 기본 타입 (long) → 0이면 신규    │
│           │                                                │
│  결과: 신규(true) → persist() → @PrePersist                │
│        기존(false) → merge()  → @PreUpdate (변경 있을 때)  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**주의:** `@Id`를 `UUID.randomUUID()`로 애플리케이션에서 할당하면, `isNew()`가 항상 `false`를 반환한다. 이 경우 `Persistable<ID>`를 구현하여 `isNew()` 로직을 직접 제공해야 한다.

---

## 7. 대안 비교

### 7.1 8가지 접근법 개요

#### 7.1.1 Manual @PrePersist/@PreUpdate (Pure JPA)

JPA 표준 콜백만 사용하는 가장 단순한 방식이다.

```java
@MappedSuperclass
public abstract class BaseEntity {
    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
```

**장점:** Spring 의존성 없음, JPA 구현체만 있으면 동작, 코드가 직관적.
**단점:** "누가(Who)" 추적 불가능 (SecurityContext 접근 없음), 시간 제어 어려움 (테스트).

#### 7.1.2 Spring Data JPA AuditingEntityListener

본 문서의 주인공. 선언적 어노테이션으로 감사 자동화.

```java
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName);
    }
}
```

**장점:** 선언적, SecurityContext 통합, 테스트 용이 (DateTimeProvider, AuditorAware Mock).
**단점:** Spring Data JPA 의존, 변경 이력 없음.

#### 7.1.3 Hibernate Envers (@Audited)

전체 변경 이력을 자동으로 별도 테이블에 기록.

```java
@Entity
@Audited  // 이 한 줄로 모든 변경 이력이 _AUD 테이블에 기록
public class Article {
    @Id @GeneratedValue
    private Long id;
    private String title;
    private String content;
}
// → article_AUD 테이블 자동 생성, REVINFO 테이블에 리비전 메타데이터
```

```java
// 변경 이력 조회
AuditReader reader = AuditReaderFactory.get(entityManager);
Article articleAtRevision5 = reader.find(Article.class, articleId, 5);
List<Number> revisions = reader.getRevisions(Article.class, articleId);
```

**장점:** 전체 변경 이력, 시점 조회, JPA 표준 기반.
**단점:** 저장소 공간 2배 이상, 쓰기 성능 영향, 쿼리 복잡성.

#### 7.1.4 Database Triggers

데이터베이스 수준에서 변경을 감지하고 기록.

```sql
-- PostgreSQL 예시
CREATE OR REPLACE FUNCTION update_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at = CURRENT_TIMESTAMP;
        NEW.created_by = current_setting('app.current_user', true);
    END IF;
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.updated_by = current_setting('app.current_user', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_audit_trigger
BEFORE INSERT OR UPDATE ON article
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();
```

**장점:** 애플리케이션 언어 무관, ORM 우회 불가, Bulk UPDATE도 추적.
**단점:** 사용자 정보 전달 어려움, DB 종속, 숨겨진 로직.

#### 7.1.5 Spring AOP / Custom Interceptor

AOP 프록시로 Repository 메서드 호출을 가로채 감사 로직 실행.

```java
@Aspect
@Component
public class AuditingAspect {
    @Before("execution(* org.springframework.data.repository.CrudRepository.save(..))")
    public void beforeSave(JoinPoint jp) {
        Object entity = jp.getArgs()[0];
        if (entity instanceof Auditable) {
            ((Auditable) entity).setLastModifiedAt(LocalDateTime.now());
            ((Auditable) entity).setLastModifiedBy(getCurrentUser());
        }
    }
}
```

**장점:** 매우 유연, 커스텀 로직 자유 추가.
**단점:** 내부 호출 감지 불가 (프록시 한계), 복잡성 증가, 디버깅 어려움.

#### 7.1.6 Hibernate Interceptors (EmptyInterceptor)

Hibernate 고유 API로 엔티티 상태 변화를 감지.

```java
public class AuditInterceptor extends EmptyInterceptor {
    @Override
    public boolean onSave(Object entity, Serializable id,
            Object[] state, String[] propertyNames, Type[] types) {
        // INSERT 시 호출
        setAuditField(state, propertyNames, "createdAt", LocalDateTime.now());
        return true;
    }

    @Override
    public boolean onFlushDirty(Object entity, Serializable id,
            Object[] currentState, Object[] previousState,
            String[] propertyNames, Type[] types) {
        // UPDATE 시 호출
        setAuditField(currentState, propertyNames, "updatedAt", LocalDateTime.now());
        return true;
    }
}
```

**장점:** Hibernate의 모든 영속화 경로에서 동작.
**단점:** **Hibernate 6에서 deprecated.** `StatementInspector`나 `EventListener`로 마이그레이션 필요. JPA 이식성 없음.

#### 7.1.7 Entity 내부 콜백 vs 외부 @EntityListeners

```java
// 방식 A: 엔티티 내부 콜백
@Entity
public class Article {
    @PrePersist void onCreate() { this.createdAt = LocalDateTime.now(); }
}

// 방식 B: 외부 EntityListeners
@Entity
@EntityListeners(AuditListener.class)
public class Article { ... }

public class AuditListener {
    @PrePersist void onCreate(Object entity) { /* 감사 로직 */ }
}
```

| 기준 | 내부 콜백 | 외부 @EntityListeners |
|------|----------|---------------------|
| 재사용성 | 엔티티별 개별 구현 | 하나의 리스너를 여러 엔티티에 적용 |
| 관심사 분리 | 도메인과 감사 로직 혼합 | 도메인과 감사 로직 분리 |
| 테스트 | 엔티티와 함께 테스트 | 리스너를 독립 테스트 가능 |
| 유연성 | 엔티티별 커스터마이징 가능 | 일관된 동작 보장 |

#### 7.1.8 R2DBC Reactive Auditing

R2DBC 기반의 리액티브 감사. 전통 JPA 콜백을 사용할 수 없으므로 별도 메커니즘.

```java
@Configuration
@EnableR2dbcAuditing
public class R2dbcAuditingConfig {
    @Bean
    public ReactiveAuditorAware<String> reactiveAuditorAware() {
        return () -> ReactiveSecurityContextHolder.getContext()
            .map(SecurityContext::getAuthentication)
            .map(Authentication::getName);
    }
}

// 엔티티 (R2DBC용)
@Table("articles")
public class Article {
    @Id private Long id;
    @CreatedDate private LocalDateTime createdAt;
    @LastModifiedDate private LocalDateTime updatedAt;
    @CreatedBy private String createdBy;
    @LastModifiedBy private String lastModifiedBy;
}
```

**장점:** Non-blocking, Reactor/Coroutine 기반 스택과 호환.
**단점:** R2DBC는 Lazy Loading, Dirty Checking 없음. JPA와 다른 생태계.

### 7.2 종합 비교표

| 접근법 | 타임스탬프 | 사용자 추적 | 변경 이력 | Spring 의존 | Bulk 지원 | 복잡도 |
|-------|----------|-----------|----------|-----------|----------|--------|
| Manual @PrePersist | O | X (직접 구현 시 원칙 위반) | X | X | X | 낮음 |
| AuditingEntityListener | O | O | X | O (Spring Data) | X | 낮음 |
| Hibernate Envers | O | O | O (전체) | X (Hibernate) | O | 중간 |
| DB Triggers | O | △ (전달 어려움) | △ (별도 구현) | X | O | 중간 |
| Spring AOP | O | O | △ (별도 구현) | O (Spring) | X | 높음 |
| Hibernate Interceptor | O | △ (Spring 접근 어려움) | △ (별도 구현) | X (Hibernate) | O | 높음 |
| 내부 콜백 | O | X | X | X | X | 낮음 |
| R2DBC Auditing | O | O | X | O (Spring Data) | N/A | 중간 |

---

## 8. 상황별 최적 선택

### 8.1 결정 흐름도

```
                    ┌─────────────────────────┐
                    │  감사(Auditing) 필요?     │
                    └────────────┬────────────┘
                                 │
                          ┌──────┴──────┐
                          │             │
                         YES            NO → 감사 불필요
                          │
                    ┌─────┴──────────────────┐
                    │ 전체 변경 이력이 필요?   │
                    └─────┬──────────────────┘
                          │
                   ┌──────┴──────┐
                   │             │
                  YES            NO
                   │             │
             ┌─────┴─────┐  ┌───┴────────────────┐
             │ 규제 준수  │  │ "누가" 추적 필요?   │
             │ 필요?     │  └───┬────────────────┘
             └─────┬─────┘      │
                   │      ┌─────┴──────┐
            ┌──────┴──┐   │            │
            │         │  YES           NO
           YES        NO  │            │
            │         │   │    ┌───────┴───────────┐
            │         │   │    │ Spring 사용?       │
            ▼         ▼   │    └───┬───────────────┘
      ┌──────────┐  ┌──────┐    │          │
      │ Envers + │  │Envers│  ┌─┴─┐     ┌──┴──┐
      │ CDC +    │  │      │  YES  NO    YES   NO
      │ WORM     │  └──────┘  │    │     │     │
      │ Storage  │            ▼    ▼     ▼     ▼
      └──────────┘   ┌────────────┐ ┌─────────┐
                     │Auditing    │ │Manual   │
                     │Entity      │ │@PrePers │
                     │Listener    │ │/@PreUpd │
                     └────────────┘ └─────────┘
                          │
                   ┌──────┴──────┐
                   │ Reactive?   │
                   └──────┬──────┘
                          │
                   ┌──────┴──────┐
                   │             │
                  YES            NO
                   │             │
                   ▼             ▼
            ┌────────────┐ ┌────────────────┐
            │R2DBC       │ │Spring Data JPA │
            │Auditing    │ │Auditing        │
            └────────────┘ │(기본 선택)      │
                           └────────────────┘
```

### 8.2 상황별 권장 조합

| 상황 | 권장 접근법 | 이유 |
|------|-----------|------|
| 단순 타임스탬프만 필요 | Manual `@PrePersist` 또는 DB Default | 가장 간단, 추가 의존성 없음 |
| 타임스탬프 + 사용자 추적 | **AuditingEntityListener** | Spring 프로젝트의 사실상 기본값 |
| 전체 변경 이력 (컴플라이언스) | Hibernate Envers | 시점 조회, 변경 전/후 값 자동 기록 |
| 멀티 프레임워크/Non-Spring | Manual `@PrePersist` | JPA 표준만 사용 |
| Reactive / WebFlux | R2DBC Auditing | Non-blocking 스택 호환 |
| DB-first / ORM 미사용 | DB Triggers | 애플리케이션 언어 무관 |
| 마이크로서비스 이벤트 추적 | CDC (Debezium) + Kafka | 서비스 간 변경 전파 |
| 금융/의료 규제 환경 | Envers + CDC + WORM Storage | 변조 불가 장기 보존 |

---

## 9. 실전 베스트 프랙티스

### 9.1 @EnableJpaAuditing은 별도 @Configuration 클래스에

```java
// ✅ GOOD: 별도 설정 클래스
@Configuration
@EnableJpaAuditing(auditorAwareRef = "securityAuditorAware")
public class JpaAuditingConfig {
}

// ❌ BAD: Main Application 클래스에 직접
@SpringBootApplication
@EnableJpaAuditing  // @DataJpaTest가 이 클래스를 로드하면 전체 컨텍스트 로드!
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

**이유:** `@DataJpaTest`는 JPA 관련 Bean만 로드하는 슬라이스 테스트이다. `@EnableJpaAuditing`이 `@SpringBootApplication`에 있으면, `@DataJpaTest`가 `AuditorAware` Bean을 찾을 수 없어 실패한다. 별도 `@Configuration` 클래스에 분리하면 `@TestConfiguration`으로 테스트용 AuditorAware를 쉽게 제공할 수 있다.

### 9.2 DateTimeProvider 커스터마이징 (테스트용 Fixed Clock)

```java
// 프로덕션용
@Bean
public DateTimeProvider dateTimeProvider() {
    return () -> Optional.of(LocalDateTime.now());
}

// 테스트용: 고정 시각
@TestConfiguration
public class TestAuditingConfig {
    public static final LocalDateTime FIXED_TIME =
        LocalDateTime.of(2026, 3, 31, 10, 0, 0);

    @Bean
    public DateTimeProvider dateTimeProvider() {
        return () -> Optional.of(FIXED_TIME);
    }
}
```

**고급: Clock 주입 패턴**

```java
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class JpaAuditingConfig {

    @Bean
    public DateTimeProvider auditingDateTimeProvider(Clock clock) {
        return () -> Optional.of(LocalDateTime.now(clock));
    }

    @Bean
    @ConditionalOnMissingBean
    public Clock clock() {
        return Clock.systemDefaultZone();  // 프로덕션: 시스템 시계
    }
}

// 테스트:
@TestConfiguration
public class TestClockConfig {
    @Bean
    public Clock clock() {
        return Clock.fixed(
            Instant.parse("2026-03-31T10:00:00Z"),
            ZoneId.of("Asia/Seoul")
        );
    }
}
```

### 9.3 AuditorAware 구현 패턴

```java
// 패턴 1: SecurityContext 기반 (가장 일반적)
@Component("securityAuditorAware")
public class SecurityAuditorAware implements AuditorAware<String> {
    @Override
    public Optional<String> getCurrentAuditor() {
        return Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(auth -> auth.isAuthenticated()
                && !(auth instanceof AnonymousAuthenticationToken))
            .map(Authentication::getName);
    }
}

// 패턴 2: 배치/시스템 계정 폴백
@Component
public class AuditorAwareWithFallback implements AuditorAware<String> {
    @Override
    public Optional<String> getCurrentAuditor() {
        return Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName)
            .or(() -> Optional.of("SYSTEM"));  // 배치 작업 등
    }
}

// 패턴 3: MSA — Request Header 기반
@Component
public class MsaAuditorAware implements AuditorAware<String> {
    @Override
    public Optional<String> getCurrentAuditor() {
        ServletRequestAttributes attrs = (ServletRequestAttributes)
            RequestContextHolder.getRequestAttributes();
        if (attrs == null) return Optional.of("SYSTEM");

        String userId = attrs.getRequest().getHeader("X-User-Id");
        return Optional.ofNullable(userId).or(() -> Optional.of("UNKNOWN"));
    }
}
```

### 9.4 BaseEntity 계층 설계

```java
// 레벨 1: 최소 — ID만
@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // equals, hashCode (id 기반)
}

// 레벨 2: 감사 필드 추가
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableBaseEntity extends BaseEntity {

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}

// 레벨 3: Soft Delete 추가
@MappedSuperclass
public abstract class SoftDeletableBaseEntity extends AuditableBaseEntity {
    private boolean deleted = false;
    private LocalDateTime deletedAt;
    private String deletedBy;
}

// 실제 엔티티
@Entity
public class Article extends AuditableBaseEntity {
    private String title;
    private String content;
    // 감사 필드는 AuditableBaseEntity에서 자동 상속
}
```

```
┌───────────────────────────┐
│       BaseEntity          │
│  ├─ id: Long              │
│  └─ equals/hashCode       │
└─────────────┬─────────────┘
              │ extends
              ▼
┌───────────────────────────┐
│  AuditableBaseEntity      │
│  ├─ createdAt             │
│  ├─ updatedAt             │
│  ├─ createdBy             │
│  ├─ updatedBy             │
│  └─ @EntityListeners(     │
│      AuditingEntity       │
│      Listener.class)      │
└─────────────┬─────────────┘
              │ extends
              ▼
┌───────────────────────────┐
│  SoftDeletableBaseEntity  │
│  ├─ deleted: boolean      │
│  ├─ deletedAt             │
│  └─ deletedBy             │
└─────────────┬─────────────┘
              │ extends
              ▼
┌───────────────────────────┐
│  Article (실제 엔티티)     │
│  ├─ title                 │
│  └─ content               │
└───────────────────────────┘
```

### 9.5 @Column(updatable = false) — 필수!

```java
// ✅ 반드시 추가해야 하는 설정
@CreatedDate
@Column(nullable = false, updatable = false)  // ← updatable = false 필수!
private LocalDateTime createdAt;

@CreatedBy
@Column(updatable = false)  // ← updatable = false 필수!
private String createdBy;
```

**왜 필수인가?** `AuditingHandler.markModified()`는 애플리케이션 레벨에서 Created 필드를 보호한다. 그러나 직접 JPQL `UPDATE`를 실행하거나, 다른 경로로 엔티티가 수정되면 이 보호가 우회될 수 있다. `@Column(updatable = false)`는 **Hibernate가 생성하는 UPDATE SQL에서 해당 컬럼을 제외**시키므로, DB 레벨 보호를 제공한다.

### 9.6 LocalDateTime vs Instant vs OffsetDateTime 선택

| 타입 | 시간대 정보 | 적합한 상황 | 주의 |
|------|-----------|-----------|------|
| `LocalDateTime` | 없음 | 단일 시간대 서비스, 한국 전용 | 다중 시간대에서 모호해짐 |
| `Instant` | UTC 기준 | 마이크로서비스, 글로벌 서비스 | DB 매핑 시 컨버터 필요할 수 있음 |
| `OffsetDateTime` | 있음 (UTC offset) | 사용자 로컬 시간 보존 필요 시 | 저장 공간 더 필요 |

**권장:** 글로벌 서비스가 아니라면 `LocalDateTime`이 가장 실용적. 글로벌 서비스라면 `Instant`를 사용하고 표시 시 사용자 시간대로 변환.

### 9.7 @MappedSuperclass vs @Embeddable for Audit Fields

```java
// 방식 A: @MappedSuperclass (권장)
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableBaseEntity {
    @CreatedDate private LocalDateTime createdAt;
    @LastModifiedDate private LocalDateTime updatedAt;
}

@Entity
public class Article extends AuditableBaseEntity { ... }

// 방식 B: @Embeddable
@Embeddable
public class AuditMetadata {
    @CreatedDate private LocalDateTime createdAt;
    @LastModifiedDate private LocalDateTime updatedAt;
}

@Entity
@EntityListeners(AuditingEntityListener.class)
public class Article {
    @Embedded
    private AuditMetadata auditMetadata = new AuditMetadata();
}
```

| 기준 | @MappedSuperclass | @Embeddable |
|------|-------------------|-------------|
| 상속 활용 | O (단일 상속) | X (조합) |
| 다중 상속 | X (Java 한계) | O (여러 @Embedded 가능) |
| Kotlin data class | 어려움 | 자연스러움 |
| 기존 상속 계층과 충돌 | 있을 수 있음 | 없음 |
| 관례 | Spring 생태계 표준 | 덜 일반적 |

**권장:** 대부분의 경우 `@MappedSuperclass`가 더 직관적이고, Spring 커뮤니티의 사실상 표준이다. 이미 다른 클래스를 상속 중이라면 `@Embeddable`을 고려.

### 9.8 Testing: @DataJpaTest + MockBean AuditorAware

```java
@DataJpaTest
@Import(TestJpaAuditingConfig.class)
class ArticleRepositoryTest {

    @Autowired
    private ArticleRepository repository;

    @TestConfiguration
    @EnableJpaAuditing
    static class TestJpaAuditingConfig {
        @Bean
        public AuditorAware<String> auditorAware() {
            return () -> Optional.of("test-user");
        }
    }

    @Test
    void save시_감사필드가_자동설정된다() {
        // given
        Article article = new Article("제목", "내용");

        // when
        Article saved = repository.save(article);

        // then
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getCreatedBy()).isEqualTo("test-user");
        assertThat(saved.getUpdatedBy()).isEqualTo("test-user");
    }

    @Test
    void update시_LastModified만_갱신된다() {
        // given
        Article saved = repository.save(new Article("제목", "내용"));
        LocalDateTime createdAt = saved.getCreatedAt();

        // when
        saved.setTitle("수정된 제목");
        repository.saveAndFlush(saved);

        // then
        assertThat(saved.getCreatedAt()).isEqualTo(createdAt);  // 변경 안 됨
        assertThat(saved.getUpdatedAt()).isAfterOrEqualTo(createdAt);  // 갱신됨
    }
}
```

### 9.9 Kotlin에서의 Auditing

```kotlin
@MappedSuperclass
@EntityListeners(AuditingEntityListener::class)
abstract class AuditableBaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0L

    @CreatedDate
    @Column(nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.MIN
        protected set

    @LastModifiedDate
    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.MIN
        protected set

    @CreatedBy
    @Column(updatable = false)
    var createdBy: String? = null
        protected set

    @LastModifiedBy
    var updatedBy: String? = null
        protected set
}

@Entity
class Article(
    var title: String,
    var content: String
) : AuditableBaseEntity()
```

**Kotlin 주의사항:**
- `val`이 아닌 `var`를 사용해야 AuditingEntityListener가 Reflection으로 값을 설정할 수 있음
- `protected set`으로 외부 직접 변경을 방지
- 기본값 (`LocalDateTime.MIN` 또는 `null`)을 반드시 제공해야 함 — Kotlin의 null-safety 때문

---

## 10. 안티패턴과 함정

### 10.1 @EnableJpaAuditing 누락 — 조용한 null

```java
// ❌ @EnableJpaAuditing을 어디에도 선언하지 않음
@Entity
@EntityListeners(AuditingEntityListener.class)
public class Article {
    @CreatedDate
    private LocalDateTime createdAt;  // → 영원히 null!
}
```

**증상:** 어떤 에러도 발생하지 않는다. `AuditingEntityListener`는 등록되지만, `AuditingHandler`가 주입되지 않아 `handler`가 null이다. `touchForCreate()`에서 null 체크로 조용히 스킵된다.

**해결:** `@Configuration` 클래스에 `@EnableJpaAuditing`을 반드시 추가. 시작 시 로그에서 `Registering JPA auditing` 메시지를 확인.

### 10.2 @EntityListeners 상속 — 부모에 한 번만 선언

```java
// ❌ 부모와 자식 모두에 선언하면 두 번 호출될 수 있음
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity { ... }

@Entity
@EntityListeners(AuditingEntityListener.class)  // ← 불필요, 중복!
public class Article extends BaseEntity { ... }
```

**해결:** `@EntityListeners`는 `@MappedSuperclass`에 **한 번만** 선언. 자식 클래스가 자동 상속한다.

### 10.3 @LastModifiedDate가 INSERT에도 설정됨

```java
Article saved = repository.save(new Article("제목"));
// saved.getUpdatedAt() != null  ← "왜 생성만 했는데 수정 시각이 있지?"
```

**이것은 버그가 아니다.** 의도된 동작이다. INSERT 시 `LastModifiedDate == CreatedDate`로 설정된다. "마지막 수정 시각"은 "가장 최근에 변경된 시각"이며, 최초 생성도 변경이다.

### 10.4 Bulk UPDATE(@Query)가 감사를 무시

```java
public interface ArticleRepository extends JpaRepository<Article, Long> {

    // ❌ JPA 콜백(@PreUpdate)이 발동하지 않음!
    @Modifying
    @Query("UPDATE Article a SET a.title = :title WHERE a.id = :id")
    void updateTitle(@Param("id") Long id, @Param("title") String title);
    // → updatedAt, updatedBy가 갱신되지 않음
}
```

**원인:** JPQL `UPDATE`는 Persistence Context를 우회하여 DB에 직접 쿼리를 실행한다. 엔티티 객체의 상태 전이가 발생하지 않으므로 `@PreUpdate` 콜백이 호출되지 않는다.

**해결 방법:**

```java
// 방법 1: JPQL에서 직접 감사 필드 포함
@Modifying
@Query("UPDATE Article a SET a.title = :title, "
     + "a.updatedAt = CURRENT_TIMESTAMP, "
     + "a.updatedBy = :updatedBy "
     + "WHERE a.id = :id")
void updateTitle(@Param("id") Long id,
                 @Param("title") String title,
                 @Param("updatedBy") String updatedBy);

// 방법 2: 엔티티를 로드 후 setter로 변경 (Dirty Checking)
Article article = repository.findById(id).orElseThrow();
article.setTitle(newTitle);
// → flush 시 @PreUpdate 발동 → 감사 자동 갱신
// 단, SELECT 1회 + UPDATE 1회 = 쿼리 2회
```

### 10.5 JPQL DELETE와 @PreRemove

```java
// ❌ JPQL DELETE도 마찬가지로 @PreRemove를 우회
@Modifying
@Query("DELETE FROM Article a WHERE a.id = :id")
void deleteArticle(@Param("id") Long id);

// ✅ 엔티티 로드 후 삭제 → @PreRemove 발동
Article article = repository.findById(id).orElseThrow();
repository.delete(article);
```

### 10.6 테스트에서 AuditorAware가 empty

```java
// ❌ @DataJpaTest에서 AuditorAware Bean이 없으면
@DataJpaTest
class ArticleRepositoryTest {
    @Test
    void save() {
        Article saved = repository.save(new Article("제목"));
        // saved.getCreatedBy() == null  ← AuditorAware가 없어서
    }
}
```

**해결:** 9.8절의 `@TestConfiguration`으로 테스트용 AuditorAware를 제공.

### 10.7 Multiple AuditorAware Beans

```java
// ❌ AuditorAware가 여러 개이면 Spring이 어떤 것을 사용할지 모름
@Bean
public AuditorAware<String> securityAuditor() { ... }

@Bean
public AuditorAware<String> apiKeyAuditor() { ... }
// → NoUniqueBeanDefinitionException 또는 잘못된 Bean 선택
```

**해결:**

```java
@EnableJpaAuditing(auditorAwareRef = "securityAuditor")  // 명시적 지정
```

### 10.8 @Async에서 SecurityContext 미전파

```java
@Async
public void processAsync(Long articleId) {
    Article article = repository.findById(articleId).orElseThrow();
    article.setStatus("PROCESSED");
    repository.save(article);
    // → updatedBy가 null! @Async 쓰레드에 SecurityContext가 전파되지 않음
}
```

**해결:**

```java
// application.yml 또는 SecurityConfig에서 전파 모드 설정
@Bean
public SecurityContextHolderStrategy securityContextHolderStrategy() {
    SecurityContextHolder.setStrategyName(
        SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
    return SecurityContextHolder.getContextHolderStrategy();
}

// 또는 TaskExecutor에 DelegatingSecurityContextExecutor 래핑
@Bean
public Executor asyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.initialize();
    return new DelegatingSecurityContextAsyncTaskExecutor(executor);
}
```

### 10.9 @CreatedBy를 엔티티 참조로 사용 시 LazyInitializationException

```java
// ❌ @CreatedBy를 User 엔티티 참조로 매핑
@Entity
public class Article {
    @CreatedBy
    @ManyToOne(fetch = FetchType.LAZY)
    private User createdBy;  // → LazyInitializationException 위험!
}
```

**원인:** `AuditorAware<User>`가 `User` 엔티티를 반환하면, 이 엔티티가 현재 영속성 컨텍스트에서 관리되지 않을 수 있다. 트랜잭션 밖에서 접근하면 `LazyInitializationException`이 발생한다.

**해결:** `@CreatedBy`에는 String(사용자 이름) 또는 Long(사용자 ID)을 사용. 엔티티 참조가 필요하면 별도 필드로 관리.

```java
@CreatedBy
@Column(updatable = false)
private String createdBy;  // String으로 사용자명만 저장

// 필요하면 별도 연관관계
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "creator_id")
private User creator;  // AuditorAware와 무관하게 별도 관리
```

### 10.10 @CreatedDate가 merge 시 덮어쓰여짐

```java
// ❌ detached 엔티티를 merge할 때
Article detached = new Article();
detached.setId(1L);
detached.setTitle("수정");
// createdAt이 null인 상태로 merge
repository.save(detached);
// → createdAt이 null로 덮어쓰여질 수 있음!
```

**원인:** `save()`는 `id`가 null이 아니면 `em.merge()`를 호출한다. merge는 detached 엔티티의 모든 필드를 DB의 managed 엔티티에 복사한다. `createdAt`이 null이면 null로 덮어쓰여진다.

**해결:** `@Column(updatable = false)` — Hibernate가 UPDATE SQL에서 해당 컬럼을 제외시킴.

---

## 11. 빅테크 실전 사례

### 11.1 JHipster AbstractAuditingEntity

JHipster는 세계에서 가장 널리 사용되는 Spring Boot 애플리케이션 생성기이며, 그 `AbstractAuditingEntity`는 가장 많이 복제(fork)된 auditing 베이스 클래스이다.

```java
// JHipster AbstractAuditingEntity (간소화)
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AbstractAuditingEntity<T> implements Serializable {

    @CreatedBy
    @Column(name = "created_by", nullable = false, length = 50, updatable = false)
    @JsonIgnore
    private String createdBy;

    @CreatedDate
    @Column(name = "created_date", updatable = false)
    @JsonIgnore
    private Instant createdDate = Instant.now();

    @LastModifiedBy
    @Column(name = "last_modified_by", length = 50)
    @JsonIgnore
    private String lastModifiedBy;

    @LastModifiedDate
    @Column(name = "last_modified_date")
    @JsonIgnore
    private Instant lastModifiedDate = Instant.now();
}
```

**주목할 점:**
- `Instant`를 사용 (글로벌 서비스 대비)
- `@JsonIgnore`로 API 응답에서 감사 필드 제외
- `updatable = false`로 created 필드 보호
- 기본값을 `Instant.now()`로 설정하여 null 방지

### 11.2 Axon Framework — Event Sourcing

Axon Framework에서는 **아키텍처 자체가 감사 추적**이다. 모든 상태 변경이 이벤트로 저장되므로, 별도의 Auditing 레이어가 불필요하다.

```
┌──────────────────────────────────────────────────┐
│             Event Sourcing = Audit by Design      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Command → Aggregate → Event → Event Store       │
│                                                  │
│  ArticleCreatedEvent {                           │
│    aggregateId: "article-123",                   │
│    title: "제목",                                │
│    timestamp: "2026-03-31T10:00:00Z",            │
│    userId: "user-456",                           │
│    sequenceNumber: 0                             │
│  }                                               │
│                                                  │
│  ArticleTitleChangedEvent {                      │
│    aggregateId: "article-123",                   │
│    oldTitle: "제목",                             │
│    newTitle: "수정된 제목",                       │
│    timestamp: "2026-03-31T11:00:00Z",            │
│    userId: "user-789",                           │
│    sequenceNumber: 1                             │
│  }                                               │
│                                                  │
│  → 모든 변경이 이벤트로 영구 저장                   │
│  → 시점 복원(replay) 가능                         │
│  → who/when/what 모두 자동 추적                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 11.3 Netflix — 대규모 감사 파이프라인

Netflix는 매일 **5PB**의 데이터를 수집하며, 초당 **1,060만 이벤트**를 처리한다.

```
┌─────────────────────────────────────────────────────────────┐
│                 Netflix Audit Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  마이크로서비스들 ─── Kafka ─── ClickHouse + Apache Iceberg  │
│                       │                                     │
│                       │         ┌──────────────────┐        │
│                       ├────────>│ Real-time Audit   │        │
│                       │         │ (ClickHouse)      │        │
│                       │         │ 최근 7일 핫 데이터 │        │
│                       │         └──────────────────┘        │
│                       │                                     │
│                       │         ┌──────────────────┐        │
│                       └────────>│ Cold Audit Store  │        │
│                                 │ (Apache Iceberg)  │        │
│                                 │ S3 기반 장기 보존  │        │
│                                 └──────────────────┘        │
│                                                             │
│  핵심: 애플리케이션 레벨 Auditing이 아닌                     │
│        인프라 레벨 이벤트 파이프라인으로 감사 구현             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 LinkedIn Databus — CDC 시스템

LinkedIn Databus는 데이터베이스 변경을 밀리초 지연으로 캡처하여 다운스트림 시스템에 전달하는 CDC(Change Data Capture) 시스템이다.

```
┌──────────────┐    binlog     ┌──────────┐     ┌───────────────┐
│  MySQL       │──────────────>│ Databus  │────>│ Search Index  │
│  (Source)    │  변경 캡처     │ Relay    │     │ Audit Store   │
│              │               │          │     │ Cache Update  │
└──────────────┘               └──────────┘     └───────────────┘
                                    │
                                    │  특징:
                                    ├─ 밀리초 수준 지연
                                    ├─ 스키마 진화 지원
                                    ├─ Pull 모델 (소비자 주도)
                                    └─ 순서 보장 (파티션 내)
```

### 11.5 Uber Cadence/Temporal — 워크플로우 이벤트 이력

Uber는 Temporal(구 Cadence)로 월 **120억 워크플로우**를 실행한다. 워크플로우의 모든 이벤트가 이력으로 저장되므로, 이벤트 이력 자체가 감사 로그(audit log)가 된다.

```
┌─────────────────────────────────────────────────────────────┐
│              Temporal Workflow Event History                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WorkflowExecutionStarted  { initiator: "admin", t: T0 }   │
│  ActivityTaskScheduled     { activity: "validate", t: T1 }  │
│  ActivityTaskCompleted     { result: "ok", t: T2 }          │
│  ActivityTaskScheduled     { activity: "process", t: T3 }   │
│  ActivityTaskCompleted     { result: "done", t: T4 }        │
│  WorkflowExecutionCompleted { t: T5 }                       │
│                                                             │
│  → 모든 단계가 자동으로 영구 기록                             │
│  → 실패 시 정확한 지점에서 재시도 가능                        │
│  → 완전한 감사 추적이 아키텍처에 내장                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 11.6 Stripe — 금융 규제 수준 감사

Stripe는 **PCI-DSS Level 1** 인증을 유지하며, 모든 데이터 접근과 변경을 추적한다.

| 기준 | Stripe의 구현 |
|------|-------------|
| 암호화 | AES-256, 키 관리 HSM |
| 접근 제어 | 최소 권한 원칙, 역할 기반 |
| 감사 로그 | 모든 API 호출 기록, 변조 방지 |
| 인증 | SOC 1 & 2 Type II |
| 데이터 보존 | 규제 요구 기간 + α |

### 11.7 Google Spanner Change Streams

Google Spanner의 Change Streams는 분산 데이터베이스 수준에서 변경을 캡처한다.

```
┌───────────────────────────────────────────────────────────────────┐
│                 Spanner Change Streams Pipeline                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Spanner ──> Change Stream ──> Dataflow ──> BigQuery              │
│                                                                   │
│  변경 레코드 포맷:                                                 │
│  {                                                                │
│    "tableName": "articles",                                       │
│    "modType": "UPDATE",                                           │
│    "commitTimestamp": "2026-03-31T10:00:00.000000Z",              │
│    "oldValues": { "title": "이전 제목" },                         │
│    "newValues": { "title": "새 제목" },   ← OLD_AND_NEW_VALUES    │
│    "serverTransactionId": "tx-abc-123"                            │
│  }                                                                │
│                                                                   │
│  특징:                                                             │
│  ├─ TrueTime 기반 글로벌 정렬 (외부 일관성)                        │
│  ├─ OLD_AND_NEW_VALUES 캡처 모드로 변경 전/후 값 모두 기록          │
│  ├─ Dataflow로 실시간 스트리밍 → BigQuery에 장기 보존              │
│  └─ 수평 확장 가능 (Spanner의 분산 특성 계승)                       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 11.8 Meta TAO — 소셜 그래프 변경 추적

Meta(Facebook)의 TAO(The Associations and Objects)는 초당 **100억 요청**을 처리하는 소셜 그래프 캐시 시스템이다. 모든 소셜 그래프 변경(친구 추가, 좋아요 등)이 추적된다.

```
┌────────────────────────────────────────────────┐
│                Meta TAO                         │
├────────────────────────────────────────────────┤
│                                                │
│  Objects: 사용자, 게시물, 페이지                │
│  Associations: 친구 관계, 좋아요, 팔로우         │
│                                                │
│  변경 추적:                                     │
│  ├─ 모든 Association 변경에 타임스탬프            │
│  ├─ Write-through 캐시 → MySQL 영속화           │
│  ├─ Wormhole CDC로 변경 사항 전파               │
│  └─ 초당 100억 읽기 요청 처리                    │
│                                                │
│  규모: 수십억 사용자, 수조 개의 Association       │
│                                                │
└────────────────────────────────────────────────┘
```

### 11.9 DB-Level Auditing 솔루션

| 데이터베이스 | 솔루션 | 특징 |
|-----------|--------|------|
| **PostgreSQL** | pgAudit | SQL 문장 단위 감사, DDL/DML 분류, 세션/객체 레벨 |
| **MySQL** | Enterprise Audit Plugin | 서버 수준 감사, XML 형식 로그, 필터링 규칙 |
| **Oracle** | Unified Auditing | 12c부터 통합 감사, 세밀한 정책, AUDIT_TRAIL 뷰 |
| **MongoDB** | Change Streams | 커서 기반 실시간 변경 감지, resume token으로 재개 |
| **SQL Server** | Change Data Capture | 시스템 테이블에 변경 이력, CDC 함수로 조회 |

### 11.10 CDC with Debezium

Debezium은 데이터베이스 트랜잭션 로그에서 변경을 캡처하여 Kafka로 스트리밍하는 오픈소스 CDC 플랫폼이다.

```
┌──────────────────────────────────────────────────────────────┐
│                   Debezium CDC Pipeline                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  WAL/binlog  ┌──────────┐  Kafka  ┌────────┐  │
│  │PostgreSQL│─────────────>│ Debezium │────────>│ Kafka  │  │
│  │ MySQL    │  변경 캡처    │ Connector│  토픽    │ Topics │  │
│  │ MongoDB  │              │          │         │        │  │
│  └──────────┘              └──────────┘         └───┬────┘  │
│                                                     │       │
│                                          ┌──────────┴────┐  │
│                                          │               │  │
│                                          ▼               ▼  │
│                                   ┌───────────┐  ┌──────────┐│
│                                   │Audit Store│  │Elastic   ││
│                                   │(장기 보존) │  │Search    ││
│                                   └───────────┘  └──────────┘│
│                                                              │
│  장점:                                                       │
│  ├─ 애플리케이션 코드 변경 없음 (DB 로그에서 직접 캡처)       │
│  ├─ 모든 변경 포착 (Bulk UPDATE, 직접 SQL 포함)              │
│  ├─ Before/After 상태 모두 캡처                               │
│  └─ 트랜잭션 순서 보장                                       │
│                                                              │
│  단점:                                                       │
│  ├─ 인프라 복잡성 (Kafka, Connector 관리)                    │
│  ├─ "누가" 정보는 DB 세션 변수 등 별도 전달 필요              │
│  └─ 스키마 변경 시 호환성 관리 필요                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 11.11 SQL:2011 Temporal Tables

SQL:2011 표준은 **시스템 버전 관리 테이블(System-Versioned Temporal Tables)**을 정의한다. 데이터베이스 엔진이 자동으로 변경 이력을 관리한다.

```sql
-- SQL Server / MariaDB 예시
CREATE TABLE article (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    -- 시스템 관리 시간 컬럼
    SysStartTime DATETIME2 GENERATED ALWAYS AS ROW START,
    SysEndTime   DATETIME2 GENERATED ALWAYS AS ROW END,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime)
) WITH (SYSTEM_VERSIONING = ON
    (HISTORY_TABLE = dbo.article_history));

-- 시점 조회
SELECT * FROM article
FOR SYSTEM_TIME AS OF '2026-03-31 10:00:00';

-- 변경 이력 조회
SELECT * FROM article
FOR SYSTEM_TIME BETWEEN '2026-03-01' AND '2026-03-31';
```

**지원 현황:**

| DB | 지원 버전 | 비고 |
|----|----------|------|
| SQL Server | 2016+ | 완전 지원 |
| MariaDB | 10.3+ | 완전 지원 |
| PostgreSQL | 확장 필요 (temporal_tables) | 네이티브 미지원 |
| Oracle | 12c+ (Flashback Data Archive) | 유사 기능 |
| MySQL | 미지원 | Triggers로 대체 |

### 11.12 Event-Driven Audit Pipeline

대규모 시스템에서의 감사 아키텍처는 이벤트 기반 파이프라인으로 수렴한다:

```
┌──────────────────────────────────────────────────────────────────┐
│              Event-Driven Audit Pipeline Architecture            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │Service A │  │Service B │  │Service C │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│       │              │              │                            │
│       └──────────────┼──────────────┘                            │
│                      │                                           │
│                      ▼                                           │
│            ┌──────────────────┐                                  │
│            │   Kafka          │  ← append-only 로그              │
│            │   (이벤트 버스)   │  ← 이벤트 순서 보장              │
│            │                  │  ← 파티션별 순서 보장             │
│            └────────┬─────────┘                                  │
│                     │                                            │
│          ┌──────────┼──────────────┐                             │
│          │          │              │                              │
│          ▼          ▼              ▼                              │
│   ┌───────────┐ ┌────────┐ ┌──────────────┐                     │
│   │ Real-time │ │ Audit  │ │ Compliance   │                     │
│   │ Dashboard │ │ Store  │ │ WORM Storage │                     │
│   │ (Grafana) │ │ (ES)   │ │ (S3 Glacier) │                     │
│   └───────────┘ └────────┘ └──────────────┘                     │
│                                    │                             │
│                                    ├─ Write Once Read Many       │
│                                    ├─ 변조 불가 (Object Lock)    │
│                                    └─ 규제 기간 동안 보존         │
│                                                                  │
│  핵심 원칙:                                                      │
│  1. 모든 변경은 이벤트로 발행 (audit at source)                   │
│  2. Kafka는 append-only → 이벤트 삭제 불가 (retention 내)        │
│  3. WORM 스토리지로 장기 변조 방지 보존                           │
│  4. 실시간 대시보드와 장기 보존을 동시에 지원                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. 참고 자료

### 12.1 JPA/Jakarta Persistence 공식 명세

| 자료 | 설명 |
|------|------|
| JSR 220 (JPA 1.0, 2006) | @PrePersist, @PreUpdate, @EntityListeners 최초 표준화 |
| JSR 317 (JPA 2.0, 2009) | Listener 호출 순서, 상속 규칙 명확화 |
| JSR 338 (JPA 2.1, 2013) | CDI DI 지원, Entity Graph, Converter |
| Jakarta Persistence 3.0/3.1 | javax → jakarta 전환, 최신 명세 |
| Jakarta Persistence Spec (eclipse-ee4j/jpa-api) | GitHub 공식 저장소 |

### 12.2 Spring Data JPA 공식 문서

| 자료 | 설명 |
|------|------|
| Spring Data JPA Reference — Auditing | `@EnableJpaAuditing`, `AuditorAware`, `DateTimeProvider` 공식 가이드 |
| Spring Data Commons — Auditing | Auditable 인터페이스, AuditingHandler 소스 코드 |
| Spring Data JPA GitHub (spring-projects/spring-data-jpa) | `AuditingEntityListener`, `JpaAuditingRegistrar` 소스 코드 |
| Spring Data REST — Auditing with HAL | REST API에서 감사 필드 노출 전략 |

### 12.3 Hibernate 관련

| 자료 | 설명 |
|------|------|
| Hibernate ORM User Guide — Events and Listeners | Hibernate의 이벤트 시스템, Interceptor 문서 |
| Hibernate Envers Reference | @Audited, AuditReader, RevisionEntity 공식 가이드 |
| Vlad Mihalcea Blog — JPA Auditing | Hibernate 핵심 개발자의 Auditing 실전 가이드 |
| Adam Warski — Envers 설계 동기 | Envers 창시자의 설계 결정 해설 |

### 12.4 학술/이론

| 자료 | 설명 |
|------|------|
| GoF Design Patterns (1994) — Observer Pattern | @EntityListeners의 이론적 기반 |
| Martin Fowler — Domain Events | 도메인 이벤트와 감사의 관계 |
| Greg Young — Event Sourcing (2010) | "이벤트가 곧 감사" 아키텍처의 이론적 기반 |
| Pat Helland — Immutability Changes Everything (2015) | 불변 로그 기반 감사의 이론적 정당화 |
| Kleppmann — Designing Data-Intensive Applications (2017) | CDC, Event Log, Change Capture 이론 |

### 12.5 빅테크 엔지니어링 블로그

| 자료 | 설명 |
|------|------|
| Netflix Tech Blog — Data Mesh & Event Pipeline | 매일 5PB 데이터 처리 아키텍처 |
| LinkedIn Engineering — Databus | CDC 시스템 설계 및 운영 |
| Uber Engineering — Cadence/Temporal | 워크플로우 이벤트 이력 기반 감사 |
| Stripe Engineering — Data Infrastructure | PCI-DSS Level 1 감사 구현 |
| Google Cloud Blog — Spanner Change Streams | 분산 DB 수준 변경 캡처 |
| Meta Engineering — TAO | 소셜 그래프 변경 추적 시스템 |

### 12.6 규제/컴플라이언스

| 자료 | 설명 |
|------|------|
| SOX Act Section 302, 404 | 재무 데이터 내부 통제 및 감사 추적 요구 |
| HIPAA Security Rule §164.312 | 의료 정보 접근 감사 요구사항 |
| GDPR Article 30 | 처리 활동 기록 의무 |
| PCI-DSS Requirement 10 | 네트워크 자원 및 카드 데이터 접근 추적 |
| SOC 2 Type II — Trust Services Criteria | 보안, 가용성, 처리 무결성, 기밀성, 개인정보 통제 |

### 12.7 도구 및 프레임워크

| 자료 | 설명 |
|------|------|
| Debezium Documentation | CDC 플랫폼 공식 문서 |
| JHipster — AbstractAuditingEntity | 가장 널리 참조되는 Auditing 베이스 클래스 |
| Axon Framework Reference | Event Sourcing/CQRS 프레임워크 |
| pgAudit Documentation | PostgreSQL 감사 확장 |
| Temporal Documentation | 워크플로우 엔진의 이벤트 이력 |
