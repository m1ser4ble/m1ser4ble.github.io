---
layout: single
title: "Kotlin @Transactional 어노테이션"
date: 2026-03-24 00:02:25 +0900
categories: backend
excerpt: "@Transactional = 메서드/클래스에 트랜잭션 경계를 선언하는 어노테이션"
toc: true
toc_sticky: true
tags: [backend, kotlin, transactional, 어노테이션]
source: "/home/dwkim/dwkim/docs/backend/kotlin-transactional.md"
---
TL;DR
- Kotlin @Transactional 어노테이션의 핵심 개념을 빠르게 파악할 수 있다.
- 배경과 이유를 통해 왜 필요한지 맥락을 이해할 수 있다.
- 특징과 상세 내용을 통해 실무 적용 포인트를 확인할 수 있다.

## 1. 개념
Kotlin @Transactional 어노테이션의 핵심 정의와 문제 공간을 간단히 정리한다.

## 2. 배경
이 주제가 등장한 기술적·조직적 배경과 기존 접근의 한계를 설명한다.

## 3. 이유
왜 지금 이 방식을 채택해야 하는지, 기대 효과와 트레이드오프를 함께 정리한다.

## 4. 특징
핵심 동작 방식, 장단점, 적용 시 주의점을 빠르게 훑을 수 있도록 요약한다.

## 5. 상세 내용

# Kotlin @Transactional 어노테이션

> **작성일**: 2026-01-28
> **카테고리**: Backend / Kotlin / Spring Framework
> **포함 내용**: @Transactional, 선언적 트랜잭션, AOP 프록시, Propagation, Isolation, ACID

---

# 1. @Transactional이란?

## 개념

```
@Transactional = 메서드/클래스에 트랜잭션 경계를 선언하는 어노테이션
                 └── "이 작업은 하나의 단위로 실행해라"
                 └── Spring Framework 제공 (spring-tx)

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  트랜잭션의 본질:                                       │
│  "All or Nothing" (전부 성공 또는 전부 실패)            │
│                                                         │
│  예시: 계좌 이체                                        │
│  ├── 1. A 계좌에서 100만원 출금                         │
│  ├── 2. B 계좌에 100만원 입금                           │
│  └── 둘 다 성공해야 함. 하나만 되면 안 됨!              │
│                                                         │
│  @Transactional 없이:                                   │
│  ├── 1번 성공 → 2번 실패 → A에서 돈만 빠짐 💀          │
│                                                         │
│  @Transactional 있으면:                                 │
│  ├── 1번 성공 → 2번 실패 → 1번도 롤백! ✅              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경

## 2.1 트랜잭션의 역사

```
┌─────────────────────────────────────────────────────────┐
│                  트랜잭션 관리의 진화                    │
│                                                         │
│  1970s: 데이터베이스 트랜잭션 개념 등장                  │
│         └── ACID 원칙 정립                              │
│                                                         │
│  1990s: J2EE/EJB 시대                                   │
│         └── 선언적 트랜잭션 (XML 지옥)                  │
│         └── 컨테이너 관리 트랜잭션 (CMT)                │
│                                                         │
│  2004: Spring Framework 등장                            │
│        └── 어노테이션 기반 선언적 트랜잭션              │
│        └── POJO에서도 트랜잭션 사용 가능!               │
│                                                         │
│  현재: Spring Boot + Kotlin                             │
│        └── @Transactional 하나로 끝                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 2.2 프로그래밍 방식 vs 선언적 방식

```kotlin
// ❌ 프로그래밍 방식 (옛날 방식) - 코드가 지저분
fun transfer(from: Long, to: Long, amount: Long) {
    val conn = dataSource.connection
    try {
        conn.autoCommit = false  // 트랜잭션 시작

        accountDao.withdraw(conn, from, amount)
        accountDao.deposit(conn, to, amount)

        conn.commit()  // 성공 시 커밋
    } catch (e: Exception) {
        conn.rollback()  // 실패 시 롤백
        throw e
    } finally {
        conn.close()
    }
}

// ✅ 선언적 방식 (현대 방식) - 깔끔!
@Transactional
fun transfer(from: Long, to: Long, amount: Long) {
    accountRepository.withdraw(from, amount)
    accountRepository.deposit(to, amount)
    // 예외 발생 시 자동 롤백!
}
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  선언적 트랜잭션의 장점:                                │
│                                                         │
│  1. 관심사 분리                                         │
│     └── 비즈니스 로직과 트랜잭션 관리 분리              │
│                                                         │
│  2. 코드 간결화                                         │
│     └── try-catch-finally 보일러플레이트 제거           │
│                                                         │
│  3. 일관성                                              │
│     └── 모든 개발자가 같은 방식으로 트랜잭션 처리       │
│                                                         │
│  4. AOP 기반                                            │
│     └── 런타임에 프록시가 트랜잭션 처리                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 3. ACID 원칙 (트랜잭션의 4대 특성)

```
┌─────────────────────────────────────────────────────────┐
│                      ACID                               │
│                                                         │
│  A - Atomicity (원자성)                                 │
│      └── 전부 성공 or 전부 실패                         │
│      └── "반만 된 상태"는 없음                          │
│                                                         │
│  C - Consistency (일관성)                               │
│      └── 트랜잭션 전후로 데이터 무결성 유지             │
│      └── 제약 조건 위반 시 롤백                         │
│                                                         │
│  I - Isolation (격리성)                                 │
│      └── 동시 실행 트랜잭션이 서로 영향 안 줌           │
│      └── 격리 수준으로 조절 가능                        │
│                                                         │
│  D - Durability (지속성)                                │
│      └── 커밋된 데이터는 영구 저장                      │
│      └── 시스템 장애에도 유지                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 4. 동작 원리 (AOP 프록시)

```
┌─────────────────────────────────────────────────────────┐
│              @Transactional 동작 원리                   │
│                                                         │
│  호출자 ──► 프록시 ──► 실제 객체                        │
│             │                                           │
│             ├── 1. 트랜잭션 시작                        │
│             ├── 2. 실제 메서드 호출                     │
│             ├── 3. 정상 → 커밋 / 예외 → 롤백            │
│             └── 4. 트랜잭션 종료                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                    Proxy                         │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  try {                                     │  │  │
│  │  │      beginTransaction()                    │  │  │
│  │  │      실제메서드.invoke()  ← 여기가 실제코드 │  │  │
│  │  │      commit()                              │  │  │
│  │  │  } catch (e) {                             │  │  │
│  │  │      rollback()                            │  │  │
│  │  │  }                                         │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Spring이 프록시를 만드는 방식

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. JDK Dynamic Proxy (인터페이스 기반)                 │
│     └── 인터페이스가 있으면 사용                        │
│                                                         │
│  2. CGLIB Proxy (클래스 기반)                           │
│     └── 인터페이스 없으면 클래스 상속으로 프록시        │
│     └── Spring Boot 기본값                              │
│                                                         │
│  Kotlin에서:                                            │
│  ├── 클래스/메서드가 기본적으로 final                   │
│  ├── CGLIB은 상속해야 하므로 open 필요                  │
│  └── spring-kotlin 플러그인이 자동으로 open 처리        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 5. 기본 사용법

## 5.1 메서드 레벨

```kotlin
@Service
class AccountService(
    private val accountRepository: AccountRepository
) {
    @Transactional
    fun transfer(fromId: Long, toId: Long, amount: Long) {
        val from = accountRepository.findById(fromId)
            .orElseThrow { IllegalArgumentException("출금 계좌 없음") }
        val to = accountRepository.findById(toId)
            .orElseThrow { IllegalArgumentException("입금 계좌 없음") }

        from.withdraw(amount)  // 잔액 부족 시 예외
        to.deposit(amount)

        accountRepository.save(from)
        accountRepository.save(to)
        // 예외 없으면 자동 커밋, 있으면 자동 롤백
    }
}
```

## 5.2 클래스 레벨

```kotlin
@Service
@Transactional  // 모든 public 메서드에 적용
class OrderService(
    private val orderRepository: OrderRepository,
    private val paymentService: PaymentService
) {
    fun createOrder(request: OrderRequest): Order {
        // 트랜잭션 적용됨
    }

    fun cancelOrder(orderId: Long) {
        // 트랜잭션 적용됨
    }

    @Transactional(readOnly = true)  // 오버라이드 가능
    fun getOrder(orderId: Long): Order {
        // 읽기 전용 트랜잭션
    }
}
```

---

# 6. 주요 속성들

## 6.1 readOnly (읽기 전용)

```kotlin
@Transactional(readOnly = true)
fun findAllUsers(): List<User> {
    return userRepository.findAll()
}
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  readOnly = true 의 효과:                               │
│                                                         │
│  1. 성능 최적화                                         │
│     └── Hibernate: Dirty Checking 스킵                  │
│     └── DB: 읽기 전용 최적화 (복제본 사용 등)           │
│                                                         │
│  2. 의도 명확화                                         │
│     └── "이 메서드는 데이터를 안 바꿔요"               │
│                                                         │
│  3. 실수 방지                                           │
│     └── 일부 DB는 쓰기 시도 시 예외 발생               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 6.2 propagation (전파 방식)

```kotlin
@Transactional(propagation = Propagation.REQUIRED)  // 기본값
fun methodA() { }
```

```
┌─────────────────────────────────────────────────────────┐
│                   Propagation 종류                      │
│                                                         │
│  REQUIRED (기본값)                                      │
│  └── 트랜잭션 있으면 참여, 없으면 새로 생성             │
│  └── 가장 일반적인 설정                                 │
│                                                         │
│  REQUIRES_NEW                                           │
│  └── 항상 새 트랜잭션 생성 (기존 것은 일시 중단)        │
│  └── 용도: 로깅, 감사 (실패해도 기록은 남겨야 할 때)    │
│                                                         │
│  NESTED                                                 │
│  └── 중첩 트랜잭션 (세이브포인트 사용)                  │
│  └── 자식 롤백해도 부모는 유지 가능                     │
│                                                         │
│  SUPPORTS                                               │
│  └── 트랜잭션 있으면 참여, 없어도 그냥 실행             │
│                                                         │
│  NOT_SUPPORTED                                          │
│  └── 트랜잭션 없이 실행 (있으면 일시 중단)              │
│                                                         │
│  MANDATORY                                              │
│  └── 반드시 기존 트랜잭션 내에서 실행 (없으면 예외)     │
│                                                         │
│  NEVER                                                  │
│  └── 트랜잭션 있으면 예외 발생                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 전파 예시

```kotlin
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val auditService: AuditService
) {
    @Transactional
    fun createOrder(request: OrderRequest): Order {
        val order = orderRepository.save(Order(request))

        // 감사 로그는 주문 실패해도 남겨야 함
        auditService.log("주문 생성: ${order.id}")

        return order
    }
}

@Service
class AuditService(
    private val auditRepository: AuditRepository
) {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun log(message: String) {
        // 별도 트랜잭션으로 실행
        // 주문이 롤백되어도 이 로그는 커밋됨
        auditRepository.save(AuditLog(message))
    }
}
```

## 6.3 isolation (격리 수준)

```kotlin
@Transactional(isolation = Isolation.READ_COMMITTED)
fun processPayment() { }
```

```
┌─────────────────────────────────────────────────────────┐
│                   Isolation 수준                        │
│                                                         │
│  수준              │ Dirty Read │ Non-Rep │ Phantom    │
│  ─────────────────┼────────────┼─────────┼──────────  │
│  READ_UNCOMMITTED │     O      │    O    │    O       │
│  READ_COMMITTED   │     X      │    O    │    O       │
│  REPEATABLE_READ  │     X      │    X    │    O       │
│  SERIALIZABLE     │     X      │    X    │    X       │
│                                                         │
│  O = 발생 가능, X = 방지                                │
│                                                         │
│  Dirty Read: 커밋 안 된 데이터 읽기                     │
│  Non-Repeatable Read: 같은 조회인데 값이 달라짐         │
│  Phantom Read: 같은 조회인데 행 수가 달라짐             │
│                                                         │
│  기본값: DB 벤더 기본값 (보통 READ_COMMITTED)           │
│                                                         │
│  💡 격리 수준 높을수록: 안전 ↑, 성능 ↓, 동시성 ↓       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 6.4 rollbackFor / noRollbackFor

```kotlin
// 기본: RuntimeException (Unchecked)만 롤백
// Checked Exception은 롤백 안 함

@Transactional(rollbackFor = [Exception::class])
fun riskyOperation() {
    // 모든 예외에서 롤백
}

@Transactional(noRollbackFor = [CustomBusinessException::class])
fun businessOperation() {
    // CustomBusinessException 발생해도 커밋
}
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Spring 기본 롤백 규칙:                                 │
│                                                         │
│  ✅ 롤백: RuntimeException, Error                       │
│  ❌ 안함: Checked Exception (IOException 등)            │
│                                                         │
│  Kotlin에서는:                                          │
│  └── 모든 예외가 Unchecked (checked 구분 없음)          │
│  └── 하지만 Spring은 Java 기준으로 판단                 │
│  └── rollbackFor 명시하면 확실                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 6.5 timeout

```kotlin
@Transactional(timeout = 30)  // 30초
fun longRunningOperation() {
    // 30초 초과 시 TransactionTimedOutException
}
```

---

# 7. 흔한 실수와 주의사항 ⚠️

## 7.1 같은 클래스 내부 호출 (Self-Invocation)

```kotlin
@Service
class UserService {

    fun createUser(request: UserRequest) {
        // ...
        saveUserInternal(user)  // ❌ 트랜잭션 적용 안 됨!
    }

    @Transactional
    fun saveUserInternal(user: User) {
        // 프록시를 거치지 않고 직접 호출되어
        // @Transactional이 무시됨
    }
}
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  왜 안 되는가?                                          │
│                                                         │
│  외부 호출: 호출자 → [Proxy] → 실제객체 ✅              │
│  내부 호출: 실제객체 → 실제객체 (프록시 없음) ❌        │
│                                                         │
│  해결 방법:                                             │
│  1. 별도 서비스로 분리 (권장)                           │
│  2. 자기 자신 주입 (self injection)                     │
│  3. ApplicationContext에서 빈 가져오기                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 해결: 별도 서비스 분리

```kotlin
@Service
class UserService(
    private val userPersistenceService: UserPersistenceService
) {
    fun createUser(request: UserRequest) {
        val user = User(request)
        userPersistenceService.save(user)  // ✅ 프록시 통과
    }
}

@Service
class UserPersistenceService(
    private val userRepository: UserRepository
) {
    @Transactional
    fun save(user: User) {
        userRepository.save(user)
    }
}
```

## 7.2 private 메서드

```kotlin
@Service
class OrderService {

    @Transactional  // ❌ 무시됨!
    private fun internalProcess() {
        // private은 프록시가 오버라이드 불가
    }
}
```

## 7.3 예외 삼키기

```kotlin
@Transactional
fun processOrder(orderId: Long) {
    try {
        orderRepository.process(orderId)
        paymentService.charge(orderId)  // 예외 발생!
    } catch (e: Exception) {
        logger.error("결제 실패", e)
        // ❌ 예외를 삼켜서 트랜잭션이 커밋됨!
        // 주문은 처리됐는데 결제는 안 됨
    }
}

// ✅ 올바른 방법
@Transactional
fun processOrder(orderId: Long) {
    try {
        orderRepository.process(orderId)
        paymentService.charge(orderId)
    } catch (e: Exception) {
        logger.error("결제 실패", e)
        throw e  // 다시 던져서 롤백 유도
    }
}
```

## 7.4 Kotlin에서 open 필요

```kotlin
// build.gradle.kts
plugins {
    kotlin("plugin.spring") version "1.9.0"  // 자동으로 open 처리
}

// 플러그인 없으면 수동으로
@Service
open class UserService {  // open 필요

    @Transactional
    open fun save(user: User) {  // open 필요
        // ...
    }
}
```

---

# 8. 실제 사용 패턴

## 8.1 읽기/쓰기 분리 패턴

```kotlin
@Service
@Transactional(readOnly = true)  // 기본: 읽기 전용
class ProductService(
    private val productRepository: ProductRepository
) {
    // 읽기 전용 (기본값 사용)
    fun findById(id: Long): Product? = productRepository.findById(id).orElse(null)

    fun findAll(): List<Product> = productRepository.findAll()

    // 쓰기 작업만 오버라이드
    @Transactional  // readOnly = false
    fun create(product: Product): Product = productRepository.save(product)

    @Transactional
    fun delete(id: Long) = productRepository.deleteById(id)
}
```

## 8.2 Facade 패턴 (여러 서비스 조합)

```kotlin
@Service
class OrderFacade(
    private val orderService: OrderService,
    private val inventoryService: InventoryService,
    private val paymentService: PaymentService,
    private val notificationService: NotificationService
) {
    @Transactional
    fun placeOrder(request: OrderRequest): OrderResult {
        // 1. 재고 차감
        inventoryService.decreaseStock(request.productId, request.quantity)

        // 2. 주문 생성
        val order = orderService.create(request)

        // 3. 결제 처리
        paymentService.process(order)

        // 4. 알림 (실패해도 주문은 유지)
        try {
            notificationService.sendOrderConfirmation(order)
        } catch (e: Exception) {
            logger.warn("알림 발송 실패", e)
            // 예외 삼킴 - 알림 실패가 주문을 롤백시키면 안 됨
        }

        return OrderResult(order)
    }
}
```

## 8.3 테스트에서 롤백

```kotlin
@SpringBootTest
@Transactional  // 각 테스트 후 자동 롤백
class UserServiceTest {

    @Autowired
    lateinit var userService: UserService

    @Test
    fun `사용자 생성 테스트`() {
        val user = userService.create("테스트")
        assertThat(user.id).isNotNull()
        // 테스트 끝나면 자동 롤백 → DB 클린 상태 유지
    }
}
```

---

# 9. 정리

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  @Transactional = 선언적 트랜잭션 관리                  │
│                                                         │
│  등장 배경:                                             │
│  ├── 프로그래밍 방식 → 선언적 방식으로 진화             │
│  ├── try-catch-finally 보일러플레이트 제거              │
│  └── 비즈니스 로직에 집중                               │
│                                                         │
│  동작 원리:                                             │
│  ├── Spring AOP 기반 프록시                             │
│  ├── CGLIB (클래스 상속) 또는 JDK Proxy (인터페이스)    │
│  └── 메서드 호출 전후로 트랜잭션 처리                   │
│                                                         │
│  주요 속성:                                             │
│  ├── readOnly: 읽기 전용 최적화                         │
│  ├── propagation: 트랜잭션 전파 방식                    │
│  ├── isolation: 격리 수준                               │
│  ├── rollbackFor: 롤백할 예외 지정                      │
│  └── timeout: 타임아웃                                  │
│                                                         │
│  주의사항:                                              │
│  ├── 같은 클래스 내부 호출 시 적용 안 됨               │
│  ├── private 메서드에 적용 안 됨                       │
│  ├── 예외 삼키면 롤백 안 됨                            │
│  └── Kotlin: plugin.spring 또는 수동 open               │
│                                                         │
│  비유:                                                  │
│  "은행 창구 직원이 알아서 입출금 장부 관리해주는 것"    │
│  내가 할 일: "100만원 이체해주세요" (비즈니스 로직)     │
│  직원이 할 일: 장부 열기, 기록, 확인, 닫기 (트랜잭션)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`@Transactional`, `Spring`, `Kotlin`, `AOP`, `프록시`, `ACID`, `Propagation`, `Isolation`, `롤백`, `JPA`
