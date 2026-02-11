---
layout: single
title: "Kotlin Sealed Class"
date: 2026-02-11 11:46:00 +0900
categories: backend
excerpt: "Sealed Class = 모든 하위 클래스가 컴파일 타임에 확정되는 클래스"
toc: true
toc_sticky: true
tags: [Kotlin, Sealed, Class]
---

# TL;DR
- **Kotlin Sealed Class의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class = "봉인된 클래스"                            │
│                                                             │
│  모든 하위 클래스가 컴파일 타임에 확정되는 클래스           │
│                                                             │
│  핵심:                                                     │
│  ├── 하위 타입이 "이것들뿐이다"를 보장                    │
│  ├── 외부에서 새로운 하위 클래스를 만들 수 없음            │
│  ├── when 문에서 모든 케이스를 강제할 수 있음              │
│  └── 컴파일러가 "빠진 케이스"를 잡아줌                    │
│                                                             │
│  도입: Kotlin 1.0 (2016년)                                │
│  개선: Kotlin 1.5 (2021년) - sealed interface 추가        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2. 배경
Kotlin Sealed Class이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- enum 한계 해결과 타입 안전성 강화
- sealed interface로 확장 범위 제어
- when 완전성 보장(컴파일 타임 체크)
- ADT 표현과 상태 모델링에 적합
- 인터페이스/추상 클래스의 위험 보완

## 5. 상세 내용

# Kotlin Sealed Class

> **작성일**: 2026-02-11
> **카테고리**: Backend / Kotlin / 타입 시스템
> **포함 내용**: Sealed Class, Sealed Interface, when 완전성, ADT, 컴파일 타임 안전성, enum 한계, Strategy Pattern 대체

---

# 1. Sealed Class란

## 정의

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class = "봉인된 클래스"                            │
│                                                             │
│  모든 하위 클래스가 컴파일 타임에 확정되는 클래스           │
│                                                             │
│  핵심:                                                     │
│  ├── 하위 타입이 "이것들뿐이다"를 보장                    │
│  ├── 외부에서 새로운 하위 클래스를 만들 수 없음            │
│  ├── when 문에서 모든 케이스를 강제할 수 있음              │
│  └── 컴파일러가 "빠진 케이스"를 잡아줌                    │
│                                                             │
│  도입: Kotlin 1.0 (2016년)                                │
│  개선: Kotlin 1.5 (2021년) - sealed interface 추가        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 기본 문법

```kotlin
// sealed class 선언
sealed class Result {
    data class Success(val data: String) : Result()
    data class Error(val message: String, val code: Int) : Result()
    object Loading : Result()
}

// when에서 사용 → else 불필요 (모든 케이스 커버)
fun handle(result: Result): String = when (result) {
    is Result.Success -> "성공: ${result.data}"
    is Result.Error   -> "에러(${result.code}): ${result.message}"
    is Result.Loading -> "로딩 중..."
    // else 없어도 컴파일 OK → 컴파일러가 모든 케이스 확인
}
```

---

# 2. 왜 나왔는가: 해결하려는 문제들

## 문제 1: enum의 한계

```kotlin
// enum: 각 값이 싱글턴, 서로 다른 데이터를 가질 수 없음
enum class PaymentResult {
    SUCCESS,   // 성공인데... 결제 ID는 어디에?
    FAILED,    // 실패인데... 에러 메시지는?
    PENDING    // 대기인데... 예상 완료 시간은?
}

// 결국 별도 필드로 빼야 함 → 타입 안전하지 않음
data class PaymentResponse(
    val result: PaymentResult,
    val paymentId: String?,    // SUCCESS일 때만 존재
    val errorMessage: String?, // FAILED일 때만 존재
    val estimatedTime: Long?   // PENDING일 때만 존재
)

// 문제: SUCCESS인데 paymentId가 null일 수 있음
// 컴파일러가 못 잡음
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  enum의 근본적 한계:                                       │
│                                                             │
│  1. 모든 값이 동일한 구조 (같은 필드)                      │
│  2. 각 값이 싱글턴 → 인스턴스별 데이터 불가               │
│  3. 상태마다 다른 데이터가 필요하면 nullable 남발          │
│  4. "SUCCESS이면 paymentId 있음" 같은 규칙을 타입으로      │
│     표현할 수 없음                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sealed Class로 해결

```kotlin
sealed class PaymentResult {
    data class Success(val paymentId: String) : PaymentResult()
    data class Failed(val errorMessage: String, val code: Int) : PaymentResult()
    data class Pending(val estimatedTime: Long) : PaymentResult()
}

// 이제 Success이면 paymentId가 반드시 존재
// 컴파일러가 보장
fun handle(result: PaymentResult) = when (result) {
    is PaymentResult.Success -> "결제 완료: ${result.paymentId}"
    is PaymentResult.Failed  -> "실패(${result.code}): ${result.errorMessage}"
    is PaymentResult.Pending -> "대기 중, 예상 시간: ${result.estimatedTime}ms"
}
```

## 문제 2: 인터페이스/추상 클래스의 위험

```kotlin
// 일반 인터페이스: 누구나 구현 가능
interface ApiResponse

data class SuccessResponse(val data: Any) : ApiResponse
data class ErrorResponse(val error: String) : ApiResponse

// 다른 모듈에서 누군가 추가할 수 있음
data class HackyResponse(val exploit: String) : ApiResponse  // 막을 수 없음!

// when에서 else가 필수 → 새 타입 추가 시 컴파일 에러 안 남
fun handle(response: ApiResponse) = when (response) {
    is SuccessResponse -> "성공"
    is ErrorResponse -> "에러"
    else -> "???"  // 이게 실행되면 버그
}
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  인터페이스/추상 클래스의 문제:                             │
│                                                             │
│  1. 개방(Open) → 누구나 새 하위 타입 추가 가능             │
│  2. when에서 else 강제 → 새 타입 추가 시 컴파일러 무시    │
│  3. 런타임에야 "모르는 타입" 발견 → ClassCastException     │
│  4. "이 타입은 이 3가지뿐이다"를 표현할 수 없음           │
│                                                             │
│  sealed class의 해결:                                      │
│  1. 봉인(Sealed) → 같은 패키지에서만 하위 타입 정의 가능  │
│  2. when에서 else 불필요 → 새 타입 추가 시 컴파일 에러    │
│  3. 컴파일 타임에 모든 케이스 검증                         │
│  4. "이 타입은 이 3가지뿐이다"를 타입 시스템으로 표현     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 문제 3: else의 위험성

```kotlin
// 나쁜 예: else가 새로운 타입을 삼켜버림
enum class UserRole { ADMIN, USER }

fun getPermission(role: UserRole) = when (role) {
    UserRole.ADMIN -> "all"
    else -> "read"  // USER → "read"
}

// 6개월 후 MODERATOR 추가
enum class UserRole { ADMIN, USER, MODERATOR }

// getPermission은 컴파일 에러 없이 통과
// MODERATOR가 else에 걸려서 "read"가 됨 → 버그!
// MODERATOR는 "read+write"여야 했는데...
```

```kotlin
// sealed class: 새 타입 추가 시 컴파일러가 잡아줌
sealed class UserRole {
    object Admin : UserRole()
    object User : UserRole()
    object Moderator : UserRole()  // 추가!
}

fun getPermission(role: UserRole) = when (role) {
    is UserRole.Admin -> "all"
    is UserRole.User  -> "read"
    // 컴파일 에러! Moderator 케이스 빠짐
    // → 개발자가 반드시 처리해야 함
}
```

---

# 3. Kotlin과 왜 잘 맞는가

## 3.1 when 식의 완전성(Exhaustiveness)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Kotlin의 when:                                            │
│  ├── sealed class와 쓰면 모든 분기를 강제                  │
│  ├── 빠진 케이스 → 컴파일 에러                             │
│  ├── Java의 switch에는 이 기능 없음 (Java 17+ 제한적)     │
│  └── else 없이도 식(expression)으로 사용 가능             │
│                                                             │
│  when 문(statement) vs when 식(expression):                │
│  ├── 문: else 없어도 됨 (경고만)                          │
│  └── 식: sealed 아니면 else 필수, sealed면 else 불필요    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 3.2 스마트 캐스트

```kotlin
sealed class Event {
    data class Click(val x: Int, val y: Int) : Event()
    data class KeyPress(val key: Char) : Event()
    data class Scroll(val delta: Double) : Event()
}

fun handle(event: Event) = when (event) {
    is Event.Click    -> "클릭 (${event.x}, ${event.y})"    // 자동으로 Click 타입
    is Event.KeyPress -> "키: ${event.key}"                  // 자동으로 KeyPress 타입
    is Event.Scroll   -> "스크롤: ${event.delta}"            // 자동으로 Scroll 타입
}

// Java라면?
// if (event instanceof Click) {
//     Click click = (Click) event;  ← 수동 캐스팅 필요
//     click.getX();
// }
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  스마트 캐스트 = is 체크 후 자동으로 타입 변환              │
│                                                             │
│  sealed class + when + 스마트 캐스트 조합:                 │
│  ├── 타입 검사                                             │
│  ├── 자동 캐스팅                                           │
│  ├── 완전성 보장                                           │
│  └── 세 가지가 합쳐져서 타입 안전한 분기 처리              │
│                                                             │
│  이것이 Kotlin에서 sealed class가 특별히 빛나는 이유       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 3.3 data class와의 조합

```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int) : ApiResult<Nothing>()
    object Loading : ApiResult<Nothing>()
}

// 제네릭 + sealed = 재사용 가능한 타입 안전 결과 래퍼
val userResult: ApiResult<User> = ApiResult.Success(user)
val orderResult: ApiResult<Order> = ApiResult.Success(order)

// data class 이점: equals, hashCode, copy, toString 자동 생성
val error1 = ApiResult.Error("not found", 404)
val error2 = ApiResult.Error("not found", 404)
println(error1 == error2)  // true (data class이므로)
```

---

# 4. 실무 패턴

## 4.1 UI 상태 관리

```kotlin
// Android/Compose에서 가장 흔한 패턴
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val throwable: Throwable) : UiState<Nothing>()
    object Empty : UiState<Nothing>()
}

// ViewModel
class UserViewModel : ViewModel() {
    private val _state = MutableStateFlow<UiState<User>>(UiState.Loading)
    val state: StateFlow<UiState<User>> = _state

    fun loadUser(id: Long) {
        viewModelScope.launch {
            _state.value = UiState.Loading
            try {
                val user = userRepository.getUser(id)
                _state.value = if (user != null) UiState.Success(user) else UiState.Empty
            } catch (e: Exception) {
                _state.value = UiState.Error(e)
            }
        }
    }
}

// UI에서 모든 상태를 빠짐없이 처리
@Composable
fun UserScreen(state: UiState<User>) {
    when (state) {
        is UiState.Loading -> CircularProgressIndicator()
        is UiState.Success -> UserProfile(state.data)
        is UiState.Error   -> ErrorMessage(state.throwable.message)
        is UiState.Empty   -> Text("사용자 없음")
    }
}
```

## 4.2 도메인 이벤트

```kotlin
sealed class OrderEvent {
    data class Created(val orderId: String, val items: List<Item>) : OrderEvent()
    data class Paid(val orderId: String, val amount: Long, val method: String) : OrderEvent()
    data class Shipped(val orderId: String, val trackingNumber: String) : OrderEvent()
    data class Delivered(val orderId: String, val receivedAt: LocalDateTime) : OrderEvent()
    data class Cancelled(val orderId: String, val reason: String) : OrderEvent()
}

// 이벤트 핸들러: 새 이벤트 추가 시 컴파일러가 빠진 처리 잡아줌
fun handleEvent(event: OrderEvent) = when (event) {
    is OrderEvent.Created   -> createOrder(event.orderId, event.items)
    is OrderEvent.Paid      -> processPayment(event.orderId, event.amount)
    is OrderEvent.Shipped   -> sendTrackingInfo(event.trackingNumber)
    is OrderEvent.Delivered -> completeOrder(event.orderId)
    is OrderEvent.Cancelled -> refund(event.orderId, event.reason)
}
```

## 4.3 네비게이션 (라우팅)

```kotlin
sealed class Screen {
    object Home : Screen()
    object Settings : Screen()
    data class UserDetail(val userId: Long) : Screen()
    data class PostDetail(val postId: Long, val commentId: Long? = null) : Screen()
}

fun navigate(screen: Screen) = when (screen) {
    is Screen.Home       -> showHome()
    is Screen.Settings   -> showSettings()
    is Screen.UserDetail -> showUser(screen.userId)
    is Screen.PostDetail -> showPost(screen.postId, screen.commentId)
}
```

## 4.4 커맨드/액션 패턴

```kotlin
sealed class DatabaseAction {
    data class Insert(val table: String, val data: Map<String, Any>) : DatabaseAction()
    data class Update(val table: String, val id: Long, val data: Map<String, Any>) : DatabaseAction()
    data class Delete(val table: String, val id: Long) : DatabaseAction()
    data class Query(val sql: String, val params: List<Any>) : DatabaseAction()
}

fun execute(action: DatabaseAction): Any = when (action) {
    is DatabaseAction.Insert -> db.insert(action.table, action.data)
    is DatabaseAction.Update -> db.update(action.table, action.id, action.data)
    is DatabaseAction.Delete -> db.delete(action.table, action.id)
    is DatabaseAction.Query  -> db.query(action.sql, action.params)
}
```

---

# 5. Sealed Class vs Strategy Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  같은 문제를 다르게 푸는 두 가지 접근:                     │
│                                                             │
│  Strategy Pattern (OOP 전통):                              │
│  ├── 인터페이스 + 구현체                                   │
│  ├── 외부에서 새 전략 추가 가능 (개방)                     │
│  ├── 새 타입 추가 쉬움, 새 연산 추가 어려움               │
│  └── Spring DI와 자연스럽게 결합                           │
│                                                             │
│  Sealed Class (함수형/대수적):                             │
│  ├── 닫힌 타입 + when으로 분기                             │
│  ├── 외부에서 새 타입 추가 불가 (봉인)                     │
│  ├── 새 연산 추가 쉬움, 새 타입 추가 시 전체 수정         │
│  └── 컴파일러가 빠진 케이스 검출                           │
│                                                             │
│  이것을 Expression Problem이라 부름:                       │
│  ├── OOP: 타입 추가 쉬움, 연산 추가 어려움                │
│  └── FP:  연산 추가 쉬움, 타입 추가 어려움                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 선택 기준

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class가 적합한 경우:                               │
│  ├── 타입이 확정적 (결제 결과 = 성공/실패/대기)           │
│  ├── 타입별로 다른 데이터 구조                             │
│  ├── 모든 케이스 처리를 컴파일러가 강제해야 할 때          │
│  ├── 상태 머신, 이벤트, 명령 모델링                       │
│  └── 타입보다 연산이 자주 추가되는 경우                    │
│                                                             │
│  Strategy Pattern이 적합한 경우:                           │
│  ├── 구현이 자주 추가됨 (새 결제 수단 등)                 │
│  ├── 각 구현이 외부 의존성(API 등)을 가짐                 │
│  ├── Spring DI로 자동 관리하고 싶음                        │
│  ├── 서드파티가 새 전략을 추가할 수 있어야 함              │
│  └── 런타임에 전략을 동적으로 교체해야 함                  │
│                                                             │
│  실무 경험 법칙:                                           │
│  "결과/상태/이벤트" → Sealed Class                        │
│  "행위/처리기/서비스" → Strategy Pattern                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 비교 코드

```kotlin
// Strategy: 결제 "처리"가 다양 → 행위 중심
interface PaymentProcessor {
    fun process(amount: Long): PaymentResult
}

@Component class CardProcessor : PaymentProcessor { ... }
@Component class BankProcessor : PaymentProcessor { ... }

// Sealed: 결제 "결과"가 확정적 → 데이터 중심
sealed class PaymentResult {
    data class Success(val txId: String) : PaymentResult()
    data class Failed(val reason: String) : PaymentResult()
    object Pending : PaymentResult()
}

// 조합: Strategy가 Sealed를 반환
fun processPayment(method: PaymentMethod, amount: Long): PaymentResult {
    val processor = strategies.find { it.supports(method) }!!
    return processor.process(amount)  // 반환 타입이 sealed
}
```

---

# 6. Sealed Interface (Kotlin 1.5+)

```kotlin
// sealed interface: 다중 상속 가능
sealed interface Drawable {
    fun draw()
}

sealed interface Clickable {
    fun onClick()
}

// 두 sealed interface를 동시에 구현 가능
data class Button(val label: String) : Drawable, Clickable {
    override fun draw() = println("Button: $label")
    override fun onClick() = println("Clicked: $label")
}

data class Icon(val name: String) : Drawable {
    override fun draw() = println("Icon: $name")
}
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  sealed class vs sealed interface:                         │
│                                                             │
│  sealed class:                                             │
│  ├── 단일 상속만 가능                                      │
│  ├── 생성자에 공통 프로퍼티 정의 가능                      │
│  ├── 상태(필드)를 가질 수 있음                             │
│  └── 하위 클래스가 같은 파일에 있어야 함 (Kotlin 1.4 이하)│
│                                                             │
│  sealed interface:                                         │
│  ├── 다중 구현 가능                                        │
│  ├── 상태를 가질 수 없음                                   │
│  ├── 더 유연한 타입 계층 설계                              │
│  └── 같은 패키지(모듈) 내에서 구현 가능                   │
│                                                             │
│  선택 기준:                                                │
│  공통 데이터 필요 → sealed class                           │
│  다중 상속 필요 → sealed interface                         │
│  단순 타입 분류 → sealed interface (더 가벼움)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 7. 이론적 배경: ADT (Algebraic Data Type)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class는 함수형 프로그래밍의 ADT에서 유래           │
│                                                             │
│  ADT (Algebraic Data Type):                                │
│  ├── Sum Type (합 타입): A 또는 B 또는 C                  │
│  │   → Kotlin: sealed class                               │
│  │   → Haskell: data Type = A | B | C                     │
│  │   → Rust: enum (데이터를 가질 수 있는)                 │
│  │   → TypeScript: discriminated union                    │
│  │                                                         │
│  └── Product Type (곱 타입): A 그리고 B 그리고 C          │
│      → Kotlin: data class(name: String, age: Int)         │
│      → 일반적인 구조체/클래스                              │
│                                                             │
│  Sealed Class = Sum Type의 OOP 구현                        │
│                                                             │
│  다른 언어의 동일 개념:                                    │
│  ├── Haskell: data / pattern matching                     │
│  ├── Rust: enum + match                                   │
│  ├── Scala: sealed trait + case class                     │
│  ├── Swift: enum with associated values                   │
│  ├── TypeScript: discriminated union                      │
│  └── Java 17+: sealed class + permits (제한적)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 다른 언어 비교

```rust
// Rust: enum이 데이터를 가질 수 있음 (Kotlin sealed와 동일 개념)
enum PaymentResult {
    Success { tx_id: String },
    Failed { reason: String, code: i32 },
    Pending,
}

// match = Kotlin의 when
fn handle(result: PaymentResult) -> String {
    match result {
        PaymentResult::Success { tx_id } => format!("성공: {}", tx_id),
        PaymentResult::Failed { reason, .. } => format!("실패: {}", reason),
        PaymentResult::Pending => "대기 중".to_string(),
    }
}
```

```typescript
// TypeScript: discriminated union
type PaymentResult =
    | { type: "success"; txId: string }
    | { type: "failed"; reason: string; code: number }
    | { type: "pending" };

// exhaustive check
function handle(result: PaymentResult): string {
    switch (result.type) {
        case "success": return `성공: ${result.txId}`;
        case "failed":  return `실패: ${result.reason}`;
        case "pending": return "대기 중";
    }
}
```

---

# 8. 주의사항

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class 사용 시 주의:                                │
│                                                             │
│  1. 직렬화 (JSON)                                          │
│     ├── Jackson: @JsonTypeInfo + @JsonSubTypes 필요        │
│     ├── kotlinx.serialization: @Serializable 지원         │
│     └── 타입 정보를 JSON에 포함해야 역직렬화 가능          │
│                                                             │
│  2. 패키지 제한                                            │
│     ├── 하위 클래스는 같은 패키지(모듈)에만 정의 가능      │
│     └── 라이브러리 사용자가 확장 불가 (의도된 설계)        │
│                                                             │
│  3. when에서 else 피하기                                   │
│     ├── else를 쓰면 sealed의 장점이 사라짐                 │
│     └── 새 타입 추가 시 컴파일러가 잡아주지 않음           │
│                                                             │
│  4. 과도한 중첩 피하기                                     │
│     ├── sealed 안에 sealed 안에 sealed → 복잡도 폭발      │
│     └── 2단계까지만 권장                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Jackson 직렬화 예시

```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(ApiResult.Success::class, name = "success"),
    JsonSubTypes.Type(ApiResult.Error::class, name = "error")
)
sealed class ApiResult {
    data class Success(val data: Any) : ApiResult()
    data class Error(val message: String) : ApiResult()
}

// JSON: {"type": "success", "data": {...}}
// JSON: {"type": "error", "message": "not found"}
```

---

# 9. 정리

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Sealed Class 체크리스트:                                  │
│                                                             │
│  쓰면 좋은 상황:                                           │
│  □ 타입이 확정적이고 변경 빈도 낮음                        │
│  □ 타입마다 다른 데이터 구조가 필요                        │
│  □ 모든 케이스 처리를 컴파일 타임에 보장하고 싶음          │
│  □ 상태/이벤트/결과/명령을 모델링                          │
│                                                             │
│  안 쓰는 게 나은 상황:                                     │
│  □ 외부에서 새 타입 추가가 자주 필요                       │
│  □ DI로 구현체를 자동 관리하고 싶음                        │
│  □ 타입 수가 아주 많고 계속 늘어남 (→ Strategy)           │
│                                                             │
│  Kotlin에서 빛나는 이유:                                   │
│  1. when 완전성 검사 → 빠진 케이스 컴파일 에러            │
│  2. 스마트 캐스트 → 수동 캐스팅 불필요                    │
│  3. data class 조합 → equals/copy/toString 자동           │
│  4. sealed interface → 다중 상속까지 가능                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Sealed Class`, `Sealed Interface`, `when`, `완전성`, `Exhaustiveness`, `ADT`, `Algebraic Data Type`, `Sum Type`, `스마트 캐스트`, `Smart Cast`, `enum`, `Strategy Pattern`, `Expression Problem`, `pattern matching`, `data class`, `컴파일 타임 안전성`, `타입 안전`, `Kotlin`
