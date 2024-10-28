---
layout: single
title:  "Rustnomicon"
date:   2022-06-13 15:30:09 +0900
categories: rust
toc: true
toc_sticky: true
tag: rust
---



# Lifetime

Lifetime 은 rust 에서 reference 를 다룰 때 등장하는 개념으로,
말 그대로 reference 가 유효한 scope(정확히는 코드가 유효한 영역... lifetime 이 scope 와 다른 케이스도 존재함. )  를 의미한다.
보통 함수나 객체가 reference 를 다룰 때 태그로 나타내는데 이는 rust compiler 가 해당 reference 가 invalidate 되는 것을 방지하기 위함이다.

##  Syntax

'a 와 같은 식으로 표기한다. 여기서 a 는 우리가 일반 변수를 선언하듯이 lifeitme 에 이름을 준 것이다.

### Generic type parameter
```rust
fn longest_with_an_announcement<'a, T>(
    x: &'a str,
    y: &'a str,
    ann: T,
) -> &'a str
where
    T: Display,
{
    println!("Announcement! {}", ann);
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
```

## Rust Compiler's view

```rust
let x = 0;
let y = &x;
let z = &y;
```
개발자 입장에서 우리는 위의 코드를 작성하고 보지만, 컴파일러 입장에서는 아래와 같이 lifetime 을 생각하며 추론,컴파일을 한다.
```rust
// NOTE: `'a: {` and `&'b x` is not valid syntax!
'a: {
    let x: i32 = 0;
    'b: {
        // lifetime used is 'b because that's good enough.
        let y: &'b i32 = &'b x;
        'c: {
            // ditto on 'c
            let z: &'c &'b i32 = &'c y;
        }
    }
}
```

## Subtype

JAVA, C# 같은 OOP 에 흔히 있는 개념으로 다음과 같은 관계를 의미한다.
- Subtype 은 Supertype(혹은 Basetype) 보다 더욱 구체적인 type. ( Subtype inherits Basetype )
- 수학적으로는  S <: B
```rust
let s: Sub = ...;
let u: Base = s;      // ok!
```

물론 Rust 에서는 상속개념이 없기 때문에 type 에 대해서는 이와 같은 관계를 보기 힘들고,
Lifetime 에서 Subtype 관계를 확인할 수 있다.
```rust
let s: &'longer str = ...;
let u: &'short str = s;     // ok!
```
lifetime 이 긴 reference 는 lifetime 이 짧은 reference 를 담을 수 없다.
왜냐면 short lifetime 의 변수가 제거가 된 이후에 long lifetime reference 로 접근한다는 것은 UAF(use-after-free) 혹은 dangling pointer 를 의미하기 때문.
따라서 long lifetime 은 short lifetime 의 subtype.
그렇기 때문에 &'static T 는 모든 &'x T 에  subtype 이다. 'static 은 program lifetime.

## Variance

Variance 는 위에서 설명한 Subtype 관계에 영향을 주는 Type Constructor 에 들어가는 generic parameter 의 속성이다.
Variance 는 네 가지 정도로 분류될 수 있다.
1. Invariant : Cell<T> 와 Cell<U> 간의 관계. ( T 와 U 는 서로 다른 타입 )
2. Covariant : T 가 U 의 subtype 이라면 Vec<T> 은  Vec<U> 의 subtype ( T <: U <=> Vec<T> <: Vec<U>)
3. Contravariant :
4. Bivariant :

lifetime 이 subtype 에 영향을 주기 때문에 generic type 의 reference 를 받는다면 generic parameter 에 lifetime 을 함께 명시해줘야 한다.

## Lifetime Elision


Reference :   https://medium.com/@kennytm/variance-in-rust-964134dd5b3e

  https://doc.rust-lang.org/nomicon/lifetime-elision.html





