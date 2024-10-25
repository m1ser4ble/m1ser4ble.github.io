______________________________________________________________________

layout: single
title:  "Rust async"
date:   2023-11-01 15:30:09 +0900
categories: rust
toc: true
toc_sticky: true

______________________________________________________________________

[지금은 OP 가 삭제한 게시물](https://www.reddit.com/r/rust/comments/16dk9ya/async_rust_is_a_bad_language/)이지만, 대략적으로 rust async 가 배우기 어렵고 rust-lang book 의 설명이 빈약하고 진행이 더디다는 불만에 대한 내용이었음.
실제로 배우기 어렵다는 것은 [대부분의 의견](https://www.reddit.com/r/rust/comments/zf98bw/its_just_me_or_rust_async_is_still_really_hard/)임

# Rust Async

## When ?

CPU bound 보다 I/O bound 인 프로그램에 대해.

## Why?

- zero cost
  - 내가 사용하는 것만 리소스를 먹음. async 사용하기 위해서 heap allocation 이나 dynamic dispatch 할 필요가 없음.
- build-in runtime 이 없음.
  - 내가 선택해야함. 보통 tokio
- single- and multithreaded runtime 이 가능
- Futures are inert

물론 Rust 에서 thread 를 지원하는데, 굳이 async 를 사용해야할 이유는 무엇인가
OS thread 는 task 갯수가 적을 때 좋음. 왜냐면 thread 는 cpu,memory overhead 가 있기 때문.
Async 는 굉장히 task 갯수가 많아서 이런 overhead 가 영향을 미칠 때 사용하기 좋음. 특히 IO bound task 에 대해 조흥ㅁ.

## Primary keyword async/.await

async 는 code block 을 Future 라는 trait 를 구현하는 state machine 으로 변환시켜줌.
blocking function 을 sync method 에서 호출하는게 그 thread 를 block 시키는 반면, blocked future 는 thread 의 제어를 내려놓고
다른 future 들이 실행될 수 있게끔 함.

async function 안에서 .await 로 Future trait 을 구현한 다른 타입이 완료되기를 기다릴 수 있음 . 예를 들면 다른
async fn 의 output. .await 은 현재 thread 를 block 하지 않는 대신 그 future 가 끝나는 걸 비동기로 기다린다.
그 future 가 현재 진행될 수 없다면 다른 task 를 수행할 수 있도록 함.

# Reference

[rust-lang/async-book](https://rust-lang.github.io/async-book/)
