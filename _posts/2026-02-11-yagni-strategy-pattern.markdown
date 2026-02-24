---
layout: single
title: "YAGNI 원칙과 Strategy Pattern"
date: 2026-02-11 11:45:00 +0900
categories: backend
excerpt: "YAGNI 원칙과 Strategy Pattern은/는 # YAGNI 원칙과 Strategy Pattern"
toc: true
toc_sticky: true
tags: [YAGNI, 원칙과, Strategy, Pattern]
---

# TL;DR
- **YAGNI 원칙과 Strategy Pattern의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  YAGNI = "지금 필요하지 않은 기능은 만들지 마라"           │
│                                                             │
│  핵심:                                                     │
│  ├── 현재 요구사항에만 집중                                │
│  ├── "나중에 필요할 것 같은" 코드를 미리 작성하지 않음     │
│  └── 실제로 필요해지는 시점에 구현                         │
│                                                             │
│  출처: Extreme Programming (XP) - Kent Beck, Ron Jeffries  │
│  시기: 1990년대 후반                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2. 배경
YAGNI 원칙과 Strategy Pattern이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- YAGNI 원칙과 과잉 설계 방지
- Strategy Pattern의 런타임 교체 구조
- OCP 준수와 if-else 제거
- 리팩토링 타이밍(Rule of Three)
- 유사 패턴(Template/State)과의 차이
- 함수형 전략 구현 방식

## 5. 상세 내용

# YAGNI 원칙과 Strategy Pattern

> **작성일**: 2026-02-11
> **카테고리**: Backend / 설계 원칙 / 디자인 패턴
> **포함 내용**: YAGNI, Strategy Pattern, OCP, 과잉 설계, GoF, 행위 패턴, if-else 제거, 런타임 교체

---

# 1. YAGNI (You Aren't Gonna Need It)

## 정의

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  YAGNI = "지금 필요하지 않은 기능은 만들지 마라"           │
│                                                             │
│  핵심:                                                     │
│  ├── 현재 요구사항에만 집중                                │
│  ├── "나중에 필요할 것 같은" 코드를 미리 작성하지 않음     │
│  └── 실제로 필요해지는 시점에 구현                         │
│                                                             │
│  출처: Extreme Programming (XP) - Kent Beck, Ron Jeffries  │
│  시기: 1990년대 후반                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 배경: 왜 이 원칙이 필요한가

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  문제: 과잉 설계 (Over-Engineering)                        │
│                                                             │
│  개발자의 흔한 실수:                                       │
│  ├── "나중에 다국어 지원할 수도 있으니 미리 i18n 넣자"    │
│  ├── "확장성을 위해 추상 계층 3개 더 만들자"              │
│  ├── "언젠가 NoSQL로 갈 수 있으니 Repository 추상화하자" │
│  └── "혹시 모르니 설정을 전부 config로 빼자"              │
│                                                             │
│  결과:                                                     │
│  ├── 코드 복잡도 ↑                                        │
│  ├── 개발 시간 낭비                                        │
│  ├── 디버깅 어려움 ↑                                      │
│  ├── 실제로 안 쓰이는 코드가 쌓임                         │
│  └── 정작 필요할 때 요구사항이 달라서 다시 짜야 함        │
│                                                             │
│  통계적으로:                                               │
│  ├── 미리 만든 기능의 ~80%는 실제로 사용되지 않음         │
│  └── 사용되더라도 요구사항이 바뀌어 재작성이 필요함       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 위반 vs 준수 예시

### 위반: 과잉 설계

```kotlin
// "나중에 결제 수단이 늘어날 수 있으니까" 미리 만듦
interface PaymentProcessor {
    fun process(amount: Money): PaymentResult
}

interface PaymentValidator {
    fun validate(payment: Payment): ValidationResult
}

interface PaymentNotifier {
    fun notify(result: PaymentResult)
}

abstract class AbstractPaymentService(
    private val processor: PaymentProcessor,
    private val validator: PaymentValidator,
    private val notifier: PaymentNotifier
) {
    abstract fun createPayment(): Payment
    // ... 현재 카드 결제만 하는데 3개 인터페이스 + 추상 클래스
}
```

### 준수: 지금 필요한 것만

```kotlin
// 현재 카드 결제만 필요 → 카드 결제만 구현
class CardPaymentService(
    private val cardApi: CardApi
) {
    fun pay(amount: Long): PaymentResult {
        return cardApi.charge(amount)
    }
}

// 나중에 계좌이체가 추가되면 그때 리팩토링
```

## YAGNI와 관련 원칙들

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  함께 쓰이는 원칙들:                                       │
│                                                             │
│  YAGNI        "필요 없으면 만들지 마"                      │
│  KISS         "단순하게 유지해"                             │
│  DRY          "반복하지 마" (단, 과도한 DRY는 YAGNI 위반)  │
│                                                             │
│  주의할 점:                                                │
│  ├── YAGNI ≠ "설계를 안 해도 된다"                        │
│  ├── YAGNI ≠ "테스트를 안 짜도 된다"                      │
│  ├── YAGNI ≠ "리팩토링을 안 해도 된다"                    │
│  └── YAGNI = "추측으로 코드를 짜지 마라"                  │
│                                                             │
│  YAGNI가 적용 안 되는 경우:                                │
│  ├── 보안 (나중에 추가하면 늦음)                           │
│  ├── 로깅/모니터링 (나중에 넣으면 디버깅 불가)            │
│  └── 데이터 모델의 핵심 구조 (나중에 바꾸면 마이그레이션) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 2. Strategy Pattern (전략 패턴)

## 정의

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Strategy Pattern = 알고리즘을 캡슐화하여                  │
│                     런타임에 교체 가능하게 만드는 패턴      │
│                                                             │
│  분류:                                                     │
│  ├── GoF (Gang of Four) 디자인 패턴                       │
│  ├── 행위(Behavioral) 패턴                                │
│  └── 1994년 출판 "Design Patterns" 책에서 정의            │
│                                                             │
│  핵심 아이디어:                                            │
│  "변하는 부분을 인터페이스로 분리하고,                     │
│   구현체를 갈아끼울 수 있게 만들어라"                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 배경: 왜 필요한가

### if-else 지옥

```kotlin
// Before: 조건문이 계속 늘어남
class DiscountService {
    fun calculate(type: String, price: Long): Long {
        if (type == "VIP") {
            return price * 80 / 100
        } else if (type == "MEMBER") {
            return price * 90 / 100
        } else if (type == "STUDENT") {
            return price * 85 / 100
        } else if (type == "SENIOR") {
            return price * 75 / 100
        } else if (type == "EMPLOYEE") {
            return price * 70 / 100
        }
        // ... 할인 유형이 추가될 때마다 여기를 수정
        return price
    }
}
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  이 코드의 문제:                                           │
│                                                             │
│  1. OCP 위반 (Open-Closed Principle)                      │
│     새 할인 유형 추가 시 기존 코드를 수정해야 함           │
│                                                             │
│  2. 단일 책임 원칙 위반                                    │
│     하나의 메서드가 모든 할인 로직을 담당                   │
│                                                             │
│  3. 테스트 어려움                                          │
│     특정 할인만 테스트하기 힘듦                             │
│                                                             │
│  4. 런타임 교체 불가                                       │
│     상황에 따라 동적으로 전략을 바꿀 수 없음               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Strategy Pattern 적용

```kotlin
// 1. 전략 인터페이스 정의
interface DiscountStrategy {
    fun calculate(price: Long): Long
}

// 2. 각 전략을 별도 클래스로 구현
class VipDiscount : DiscountStrategy {
    override fun calculate(price: Long) = price * 80 / 100
}

class MemberDiscount : DiscountStrategy {
    override fun calculate(price: Long) = price * 90 / 100
}

class StudentDiscount : DiscountStrategy {
    override fun calculate(price: Long) = price * 85 / 100
}

class NoDiscount : DiscountStrategy {
    override fun calculate(price: Long) = price
}

// 3. Context 클래스: 전략을 사용하는 쪽
class DiscountService(
    private var strategy: DiscountStrategy
) {
    fun setStrategy(strategy: DiscountStrategy) {
        this.strategy = strategy
    }

    fun calculate(price: Long): Long {
        return strategy.calculate(price)
    }
}

// 4. 사용
val service = DiscountService(VipDiscount())
service.calculate(10000)  // 8000

service.setStrategy(StudentDiscount())  // 런타임에 교체
service.calculate(10000)  // 8500
```

## 구조

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Strategy Pattern 구조:                                    │
│                                                             │
│  ┌──────────┐        ┌──────────────────┐                  │
│  │ Context  │───────▶│ <<interface>>     │                  │
│  │          │        │ Strategy         │                  │
│  │ -strategy│        │                  │                  │
│  │ +execute()│       │ +algorithm()     │                  │
│  └──────────┘        └──────────────────┘                  │
│                          ▲    ▲    ▲                       │
│                          │    │    │                        │
│                 ┌────────┘    │    └────────┐               │
│                 │             │             │               │
│          ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│          │StrategyA │ │StrategyB │ │StrategyC │            │
│          └──────────┘ └──────────┘ └──────────┘            │
│                                                             │
│  구성 요소:                                                │
│  ├── Strategy: 알고리즘의 인터페이스                      │
│  ├── ConcreteStrategy: 실제 알고리즘 구현체               │
│  └── Context: 전략을 사용하는 클라이언트                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 실무 예시: Spring에서의 Strategy Pattern

### 예시 1: 결제 수단 분기

```kotlin
// 전략 인터페이스
interface PaymentStrategy {
    fun pay(amount: Long): PaymentResult
    fun supports(method: PaymentMethod): Boolean
}

// 구현체들 (각각 Spring Bean)
@Component
class CardPayment(private val cardApi: CardApi) : PaymentStrategy {
    override fun pay(amount: Long) = cardApi.charge(amount)
    override fun supports(method: PaymentMethod) = method == PaymentMethod.CARD
}

@Component
class BankTransfer(private val bankApi: BankApi) : PaymentStrategy {
    override fun pay(amount: Long) = bankApi.transfer(amount)
    override fun supports(method: PaymentMethod) = method == PaymentMethod.BANK
}

// Context: Spring이 모든 전략을 주입
@Service
class PaymentService(
    private val strategies: List<PaymentStrategy>
) {
    fun pay(method: PaymentMethod, amount: Long): PaymentResult {
        val strategy = strategies.find { it.supports(method) }
            ?: throw IllegalArgumentException("지원하지 않는 결제 수단: $method")
        return strategy.pay(amount)
    }
}
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Spring에서의 장점:                                        │
│                                                             │
│  새 결제 수단 추가 시:                                     │
│  ├── 새 클래스 하나만 만들면 됨 (@Component)              │
│  ├── PaymentService는 수정 안 함 (OCP 준수)               │
│  ├── Spring이 자동으로 List에 주입                        │
│  └── 기존 코드 영향 없음                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 예시 2: 알림 발송

```kotlin
interface NotificationStrategy {
    fun send(recipient: String, message: String)
    val type: NotificationType
}

@Component
class EmailNotification(private val mailSender: MailSender) : NotificationStrategy {
    override fun send(recipient: String, message: String) {
        mailSender.send(recipient, message)
    }
    override val type = NotificationType.EMAIL
}

@Component
class SmsNotification(private val smsClient: SmsClient) : NotificationStrategy {
    override fun send(recipient: String, message: String) {
        smsClient.send(recipient, message)
    }
    override val type = NotificationType.SMS
}

@Component
class SlackNotification(private val slackClient: SlackClient) : NotificationStrategy {
    override fun send(recipient: String, message: String) {
        slackClient.post(recipient, message)
    }
    override val type = NotificationType.SLACK
}

// Map으로 주입하면 더 깔끔
@Service
class NotificationService(
    strategies: List<NotificationStrategy>
) {
    private val strategyMap = strategies.associateBy { it.type }

    fun notify(type: NotificationType, recipient: String, message: String) {
        strategyMap[type]?.send(recipient, message)
            ?: throw IllegalArgumentException("지원하지 않는 알림 타입: $type")
    }
}
```

---

# 3. YAGNI와 Strategy Pattern의 관계

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  언제 Strategy Pattern을 쓰는 것이 YAGNI 위반인가?        │
│                                                             │
│  YAGNI 위반 (과잉 설계):                                   │
│  ├── 결제 수단이 카드 하나뿐인데 Strategy 패턴 적용       │
│  ├── 알림이 이메일뿐인데 인터페이스 + 3개 구현체 준비     │
│  └── "나중에 추가될 수 있으니까" 라는 근거만으로 적용     │
│                                                             │
│  적절한 사용:                                              │
│  ├── 이미 분기가 3개 이상이고 계속 늘어나는 상황           │
│  ├── if-else가 반복되어 가독성이 떨어지는 상황             │
│  ├── 각 분기의 로직이 복잡하여 별도 테스트가 필요한 상황  │
│  └── 런타임에 동적으로 전략을 바꿔야 하는 요구사항 존재   │
│                                                             │
│  판단 기준:                                                │
│  "현재 if-else가 2개 이하 → 그냥 if-else로 놔둬라"       │
│  "현재 if-else가 3개 이상 + 더 늘어날 예정 → Strategy"    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 리팩토링 타이밍

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  올바른 진행 순서:                                          │
│                                                             │
│  1단계: 카드 결제만 → 그냥 구현                            │
│  class PaymentService {                                    │
│      fun pay(amount: Long) = cardApi.charge(amount)        │
│  }                                                         │
│                                                             │
│  2단계: 계좌이체 추가 → if-else로 분기                     │
│  fun pay(method: String, amount: Long) = when(method) {    │
│      "CARD" -> cardApi.charge(amount)                      │
│      "BANK" -> bankApi.transfer(amount)                    │
│  }                                                         │
│                                                             │
│  3단계: 페이 + 포인트 추가 요청 → Strategy 리팩토링       │
│  → 이 시점에서 패턴 적용 (YAGNI 준수)                     │
│                                                             │
│  핵심: "세 번째가 오면 추상화하라" (Rule of Three)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. Strategy vs 유사 패턴

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  패턴              │  목적              │  차이              │
│  ─────────────────┼────────────────────┼───────────────────│
│  Strategy         │  알고리즘 교체      │  런타임에 교체     │
│  Template Method  │  알고리즘 골격 고정 │  상속 기반         │
│  State            │  상태에 따른 행위   │  상태가 스스로 전이│
│  Factory          │  객체 생성 분기     │  생성에 초점       │
│                                                             │
│  Strategy vs State:                                        │
│  ├── Strategy: 클라이언트가 직접 전략을 선택/교체          │
│  └── State: 상태 객체가 스스로 다음 상태로 전이            │
│                                                             │
│  Strategy vs Template Method:                              │
│  ├── Strategy: 구성(Composition) = 인터페이스 + 주입      │
│  └── Template Method: 상속(Inheritance) = 부모 클래스 확장 │
│  → Strategy가 더 유연 (상속보다 구성을 선호)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 5. 함수형 스타일의 Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  현대 언어에서는 클래스 없이 함수로도 Strategy 구현 가능   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Kotlin: 함수 타입 활용

```kotlin
// 인터페이스 대신 함수 타입
typealias DiscountStrategy = (Long) -> Long

// 전략들을 함수로 정의
val vipDiscount: DiscountStrategy = { price -> price * 80 / 100 }
val memberDiscount: DiscountStrategy = { price -> price * 90 / 100 }
val noDiscount: DiscountStrategy = { price -> price }

// 사용
class DiscountService(private var strategy: DiscountStrategy) {
    fun calculate(price: Long) = strategy(price)
}

val service = DiscountService(vipDiscount)
service.calculate(10000)  // 8000
```

### Python

```python
from typing import Callable

# 전략 = 그냥 함수
def vip_discount(price: int) -> int:
    return price * 80 // 100

def member_discount(price: int) -> int:
    return price * 90 // 100

# 사용
def calculate(price: int, strategy: Callable[[int], int]) -> int:
    return strategy(price)

calculate(10000, vip_discount)  # 8000
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  함수형 vs 클래스 기반 Strategy:                           │
│                                                             │
│  함수형이 적합한 경우:                                     │
│  ├── 전략이 단순한 계산 로직일 때                          │
│  ├── 상태(필드)가 필요 없을 때                             │
│  └── 전략 수가 적고 변하지 않을 때                         │
│                                                             │
│  클래스가 적합한 경우:                                     │
│  ├── 전략마다 의존성(API 클라이언트 등)이 필요할 때        │
│  ├── Spring DI로 자동 관리하고 싶을 때                     │
│  ├── 전략 내부에 상태가 필요할 때                          │
│  └── 여러 메서드가 필요한 복합 전략일 때                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 6. 정리

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  YAGNI 체크리스트:                                         │
│  □ 지금 당장 필요한 기능인가?                              │
│  □ "나중에 필요할 것 같아서"가 유일한 근거인가?            │
│  □ 추가한 추상화가 현재 복잡도를 줄여주는가?              │
│  □ 3번째 유사 케이스가 나타났는가? (Rule of Three)         │
│                                                             │
│  Strategy Pattern 체크리스트:                              │
│  □ 동일 목적의 분기(if-else/when)가 3개 이상인가?         │
│  □ 분기가 계속 늘어날 예정인가?                            │
│  □ 각 분기의 로직이 독립적으로 테스트 필요한가?            │
│  □ 런타임에 전략 교체가 필요한가?                          │
│                                                             │
│  조합 원칙:                                                │
│  "처음부터 Strategy를 쓰지 마라 (YAGNI)"                  │
│  "분기가 3개가 되면 Strategy로 리팩토링하라"               │
│  "추측이 아닌 현실의 요구사항에 반응하라"                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`YAGNI`, `You Aren't Gonna Need It`, `Strategy Pattern`, `전략 패턴`, `OCP`, `Open-Closed Principle`, `GoF`, `디자인 패턴`, `행위 패턴`, `if-else 제거`, `런타임 교체`, `과잉 설계`, `Over-Engineering`, `KISS`, `DRY`, `Rule of Three`, `Composition over Inheritance`, `Kent Beck`, `XP`
