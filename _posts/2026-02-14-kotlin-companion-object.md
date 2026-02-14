---
layout: single
title: "Kotlin companion object"
date: 2026-02-14 09:01:36 +0900
categories: backend
excerpt: "Kotlin companion object은(는) 핵심 개념과 배경, 이유를 정리해 적용 기준을 제공한다."
toc: true
toc_sticky: true
tags: [companion object, Kotlin, static, 싱글톤, 팩토리 패턴]
---

## TL;DR
- Kotlin companion object의 핵심 개념과 용어를 한눈에 정리한다.
- Kotlin companion object이(가) 등장한 배경과 필요성을 요약한다.
- Kotlin companion object의 특징과 적용 포인트를 빠르게 확인한다.

## 1. 개념
Kotlin companion object은(는) 핵심 용어와 정의를 정리한 주제로, 개발/운영 맥락에서 무엇을 의미하는지 설명한다.

## 2. 배경
기존 방식의 한계나 현업의 요구사항을 해결하기 위해 이 개념이 등장했다는 흐름을 이해하는 데 목적이 있다.

## 3. 이유
도입 이유는 보통 유지보수성, 성능, 안정성, 보안, 협업 효율 같은 실무 문제를 해결하기 위함이다.

## 4. 특징
- 핵심 정의와 범위를 명확히 한다.
- 실무 적용 시 선택 기준과 비교 포인트를 제공한다.
- 예시 중심으로 빠른 이해를 돕는다.

## 5. 상세 내용
> **작성일**: 2026-01-28
> **카테고리**: Backend / Kotlin / Language Feature
> **포함 내용**: companion object, static 대체, 팩토리 패턴, Java 상호운용

---

# 1. companion object란?

## 개념

```
companion object = 클래스에 속한 싱글톤 객체
                   └── Java의 static 멤버를 대체
                   └── "동반 객체"라고 번역

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Java:                                                  │
│  class MyClass {                                        │
│      static String TAG = "MyClass";                    │
│      static void create() { ... }                      │
│  }                                                      │
│  MyClass.TAG;                                          │
│  MyClass.create();                                     │
│                                                         │
│  Kotlin:                                               │
│  class MyClass {                                        │
│      companion object {                                │
│          val TAG = "MyClass"                           │
│          fun create() { ... }                          │
│      }                                                  │
│  }                                                      │
│  MyClass.TAG                                           │
│  MyClass.create()                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 2. 등장 배경

## Java의 static 문제점

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Java static의 특징:                                    │
│  ├── 클래스 레벨에 속함 (인스턴스 아님)                 │
│  ├── 객체 없이 접근 가능                                │
│  └── 상속/오버라이드 불가                               │
│                                                         │
│  문제점:                                                │
│  ├── static은 "진짜 객체"가 아님                       │
│  ├── 인터페이스 구현 불가                               │
│  ├── 다형성 활용 불가                                   │
│  └── 테스트하기 어려움 (Mock 힘듦)                      │
│                                                         │
│  Kotlin의 철학:                                         │
│  "모든 것은 객체여야 한다!"                             │
│  → static 키워드 자체를 없앰                            │
│  → 대신 companion object 도입                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## "모든 것은 객체" 철학과 companion object

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  companion object의 본질:                               │
│                                                         │
│  class MyClass {                                        │
│      companion object {  // 실제로는 중첩된 object!     │
│          ...                                            │
│      }                                                  │
│  }                                                      │
│                                                         │
│  풀어서 쓰면:                                           │
│  class MyClass {                                        │
│      object Companion {  // 이름 없으면 Companion       │
│          ...                                            │
│      }                                                  │
│  }                                                      │
│                                                         │
│  → class 안에 object가 있는 구조                        │
│  → class라는 객체 안에 또 다른 object를 정의            │
│  → Java의 static은 "객체가 아닌 것"이지만              │
│  → Kotlin의 companion object는 "진짜 객체"             │
│                                                         │
│  "모든 것은 객체" 철학 실현:                            │
│  ├── 클래스 = 객체의 설계도                             │
│  ├── 인스턴스 = 객체                                    │
│  ├── companion object = 객체 (싱글톤)                  │
│  └── static 같은 "예외적 존재" 없음!                   │
│                                                         │
│  문법적 일관성:                                         │
│  ├── object = 싱글톤 객체 정의                          │
│  ├── companion object = 클래스에 동반되는 싱글톤 객체  │
│  └── 둘 다 "객체"라는 점에서 동일한 개념               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Kotlin이 static을 버린 이유

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. 일관성                                              │
│     └── 모든 멤버가 객체에 속함                         │
│     └── "클래스 멤버" vs "인스턴스 멤버" 구분 없음      │
│                                                         │
│  2. 객체지향 원칙                                       │
│     └── static은 객체가 아니라 예외적 존재              │
│     └── companion object는 진짜 객체                   │
│                                                         │
│  3. 유연성                                              │
│     └── 인터페이스 구현 가능                            │
│     └── 확장 함수 정의 가능                             │
│     └── 변수에 할당 가능                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 3. 기본 사용법

## 기본 형태

```kotlin
class MyClass {
    companion object {
        const val TAG = "MyClass"

        fun create(): MyClass {
            return MyClass()
        }
    }

    // 인스턴스 멤버
    fun doSomething() { }
}

// 사용
val tag = MyClass.TAG           // "MyClass"
val instance = MyClass.create() // MyClass 인스턴스
instance.doSomething()
```

## 이름 붙이기

```kotlin
class MyClass {
    // 이름 있는 companion object
    companion object Factory {
        fun create(): MyClass = MyClass()
    }
}

// 두 가지 방법으로 접근 가능
MyClass.create()           // 이름 생략
MyClass.Factory.create()   // 이름 명시
```

## 이름 없으면 기본 이름은 Companion

```kotlin
class MyClass {
    companion object {
        fun create(): MyClass = MyClass()
    }
}

// Java에서 접근 시
MyClass.Companion.create()
```

---

# 4. companion object의 특별한 점

## 4.1 인터페이스 구현 가능

```kotlin
interface Factory<T> {
    fun create(): T
}

class User private constructor(val name: String) {
    companion object : Factory<User> {
        override fun create(): User {
            return User("Default")
        }
    }
}

// 팩토리 패턴으로 활용
fun <T> createInstance(factory: Factory<T>): T {
    return factory.create()
}

val user = createInstance(User)  // companion object를 전달!
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Java static으로는 불가능한 것:                         │
│  ├── 인터페이스 구현                                    │
│  └── 다형성 활용                                        │
│                                                         │
│  Kotlin companion object로 가능:                       │
│  ├── 인터페이스 구현 ✅                                 │
│  ├── 변수에 할당 ✅                                     │
│  └── 함수 인자로 전달 ✅                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 4.2 확장 함수 정의 가능

```kotlin
class MyClass {
    companion object { }
}

// companion object에 확장 함수 추가
fun MyClass.Companion.fromJson(json: String): MyClass {
    // JSON 파싱 로직
    return MyClass()
}

// 사용
val obj = MyClass.fromJson("""{"name": "test"}""")
```

## 4.3 진짜 싱글톤 객체

```kotlin
class MyClass {
    companion object {
        init {
            println("Companion object 초기화!")
        }
    }
}

// companion object는 클래스 로드 시 한 번만 초기화
// → 싱글톤 보장
```

---

# 5. 실제 사용 패턴

## 5.1 팩토리 메서드 패턴

```kotlin
class User private constructor(
    val id: Long,
    val name: String,
    val email: String
) {
    companion object {
        // 다양한 생성 방법 제공
        fun fromId(id: Long): User {
            // DB에서 조회
            return User(id, "loaded", "loaded@test.com")
        }

        fun fromEmail(email: String): User {
            return User(0, "unknown", email)
        }

        fun create(name: String, email: String): User {
            val id = generateId()
            return User(id, name, email)
        }

        private fun generateId(): Long = System.currentTimeMillis()
    }
}

// 사용
val user1 = User.fromId(123)
val user2 = User.fromEmail("test@test.com")
val user3 = User.create("홍길동", "hong@test.com")
```

## 5.2 상수 정의

```kotlin
class HttpStatus {
    companion object {
        const val OK = 200
        const val NOT_FOUND = 404
        const val INTERNAL_ERROR = 500

        // const가 아닌 것도 가능 (런타임 계산)
        val DEFAULT_TIMEOUT = System.getenv("TIMEOUT")?.toLong() ?: 5000L
    }
}

// 사용
if (response.code == HttpStatus.OK) { ... }
```

## 5.3 로거 패턴

```kotlin
class UserService {
    companion object {
        private val logger = LoggerFactory.getLogger(UserService::class.java)
    }

    fun doSomething() {
        logger.info("Doing something...")
    }
}
```

## 5.4 직렬화/역직렬화

```kotlin
data class User(
    val id: Long,
    val name: String
) {
    companion object {
        fun fromJson(json: String): User {
            // JSON 파싱
            val map = parseJson(json)
            return User(
                id = map["id"] as Long,
                name = map["name"] as String
            )
        }
    }

    fun toJson(): String {
        return """{"id": $id, "name": "$name"}"""
    }
}

// 사용
val json = """{"id": 1, "name": "홍길동"}"""
val user = User.fromJson(json)
val backToJson = user.toJson()
```

---

# 6. companion object vs object

```kotlin
// companion object: 클래스에 종속
class MyClass {
    companion object {
        fun foo() = "companion"
    }
}
MyClass.foo()  // 클래스 이름으로 접근

// object: 독립적인 싱글톤
object MySingleton {
    fun foo() = "singleton"
}
MySingleton.foo()  // 객체 이름으로 접근
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  companion object:                                      │
│  ├── 특정 클래스에 "동반"됨                             │
│  ├── 그 클래스의 private 멤버 접근 가능                 │
│  ├── 클래스 이름으로 접근                               │
│  └── 용도: 팩토리, 상수, 유틸리티                       │
│                                                         │
│  object (독립):                                         │
│  ├── 어떤 클래스에도 속하지 않음                        │
│  ├── 완전히 독립적인 싱글톤                             │
│  ├── 객체 이름으로 접근                                 │
│  └── 용도: 싱글톤 서비스, 유틸리티 클래스               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 7. Java와의 상호운용

## Kotlin → Java 호출

```kotlin
class MyClass {
    companion object {
        val TAG = "MyClass"

        @JvmStatic  // Java에서 static처럼 호출 가능
        fun create(): MyClass = MyClass()

        @JvmField   // Java에서 필드처럼 접근 가능
        val VERSION = "1.0.0"
    }
}
```

```java
// Java에서 사용
// @JvmStatic 없으면
MyClass.Companion.create();
MyClass.Companion.getTAG();

// @JvmStatic 있으면
MyClass.create();        // static 메서드처럼!

// @JvmField 있으면
MyClass.VERSION;         // static 필드처럼!
```

## const vs @JvmField

```kotlin
companion object {
    const val CONST_VAL = "컴파일 타임 상수"  // primitive + String만 가능

    @JvmField
    val RUNTIME_VAL = listOf(1, 2, 3)  // 런타임 값도 가능
}
```

---

# 8. 주의사항

## 8.1 클래스당 하나만

```kotlin
class MyClass {
    companion object A { }
    companion object B { }  // ❌ 컴파일 에러!
}
```

## 8.2 상속 불가

```kotlin
open class Parent {
    companion object {
        fun foo() = "parent"
    }
}

class Child : Parent() {
    // companion object를 오버라이드할 수 없음
    // 대신 새로운 companion object 정의 가능
    companion object {
        fun foo() = "child"  // 숨김 (shadowing)
    }
}

Parent.foo()  // "parent"
Child.foo()   // "child"
```

## 8.3 private constructor와 함께 사용

```kotlin
// 팩토리 패턴의 정석
class User private constructor(val name: String) {
    companion object {
        fun create(name: String): User {
            // 검증 로직
            require(name.isNotBlank()) { "이름은 비어있을 수 없습니다" }
            return User(name)
        }
    }
}

// val user = User("홍길동")  // ❌ private constructor
val user = User.create("홍길동")  // ✅ 팩토리 메서드
```

---

# 9. 정리

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  companion object = 클래스에 속한 싱글톤 객체           │
│                                                         │
│  본질:                                                  │
│  ├── class 안에 정의된 object                           │
│  ├── "모든 것은 객체" 철학의 실현                       │
│  └── static 같은 예외 없이 모든 게 객체                 │
│                                                         │
│  등장 배경:                                             │
│  ├── Kotlin은 static 키워드 없음                        │
│  ├── "모든 것은 객체" 철학                              │
│  └── static보다 유연하고 강력함                         │
│                                                         │
│  Java static과 비교:                                    │
│  ├── 인터페이스 구현 가능 ✅                            │
│  ├── 확장 함수 정의 가능 ✅                             │
│  ├── 변수에 할당 가능 ✅                                │
│  └── 함수 인자로 전달 가능 ✅                           │
│                                                         │
│  주요 용도:                                             │
│  ├── 팩토리 메서드 패턴                                 │
│  ├── 상수 정의                                          │
│  ├── 로거 인스턴스                                      │
│  └── 직렬화/역직렬화 메서드                             │
│                                                         │
│  Java 상호운용:                                         │
│  ├── @JvmStatic → static 메서드처럼                    │
│  └── @JvmField → static 필드처럼                       │
│                                                         │
│  비유:                                                  │
│  Java static = 클래스에 붙은 스티커 (객체 아님)        │
│  companion object = 클래스의 절친한 친구 (진짜 객체)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`companion object`, `Kotlin`, `static`, `싱글톤`, `팩토리 패턴`, `@JvmStatic`, `@JvmField`, `객체지향`
