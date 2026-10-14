---
layout: single
title: "DDS Deadline과 Linux 실시간 스케줄링의 경계"
date: 2026-10-13 00:00:00 +0900
categories: [system]
permalink: /dds/realtime-linux/
excerpt: "DDS Deadline QoS는 데이터 갱신 간격을 감시하고 Linux 스케줄러는 스레드에 CPU 실행 기회를 배정하므로, 주기 발행과 완료시간은 별도로 설계해야 합니다."
knowledge_id: dds-realtime-linux
series: dds
knowledge_links: [dds-guide, dds-basics, dds-qos, dds-device-adapters, dds-fault-diagnosis]
toc: true
toc_sticky: true
tags: [dds, linux, realtime, networking]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
---

주기적으로 DDS(Data Distribution Service) 데이터를 발행하려면 앱이 주기 작업의 release를 만들고, Linux가 실행 가능한 스레드에 CPU(Central Processing Unit, 중앙 처리 장치)를 배정하며, DDS가 정한 데이터 갱신 계약을 감시하도록 각 책임을 따로 설계해야 합니다. DDS `Deadline` QoS(Quality of Service)는 커널 스케줄링 policy가 아니며 `SCHED_DEADLINE`도 `DataWriter::write()`나 subscriber 처리가 특정 시간 안에 끝났음을 자동으로 보장하지 않습니다.

## 세 가지 의미의 deadline

| 개념 | 누가 관리하는가 | 시간의 의미 | 그 자체로 보장하지 않는 것 |
|---|---|---|---|
| DDS `Deadline` QoS | DDS Writer/Reader | 기대하는 새 sample 공급·수신 주기 | CPU 실행 우선순위, callback 완료, 실제 측정 신선도 |
| 앱 주기 release | timer/loop/상태 machine | 다음 작업을 시작해야 할 예정 시각 | 그 순간 CPU가 배정되거나 작업이 완료되는 일 |
| Linux `SCHED_DEADLINE` | kernel scheduler의 개별 thread 정책 | runtime/deadline/period로 정한 CPU 실행 예약 | 외부 I/O, DDS 내부 blocking, 전체 시스템 결과의 end-to-end 한도 |

Fast DDS 2.14.7 공개 문서에서 Writer deadline은 응용 프로그램이 새 sample을 공급할 것으로 기대하는 최대 기간, Reader deadline은 새 sample이 도착할 것으로 기대하는 최대 기간입니다. Writer의 offer period가 Reader의 requested period보다 길면 호환되지 않습니다. 따라서 deadline-missed 상태는 갱신 주기 계약의 위반을 알리는 신호로 조사해야지, 지연 원인이 OS(Operating System, 운영체제)인지 링크인지 장비인지 단독으로 밝혀 주는 사건은 아닙니다. 이는 Fast DDS 2.x 공개 문서의 설명이며 학습 프로젝트 실행 버전 2.11.2와 같은 문서 판본이라고 간주하지 않습니다. [Fast DDS Deadline QoS](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html)

## 주기 작업은 애플리케이션에서 release한다

아래 애니메이션은 예정 release, 실제 실행, DDS 발행 완료, 다음 release를 나누어 보여 주는 설명용 타임라인입니다. 측정 데이터나 실제 scheduler trace가 아닙니다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=realtime-linux" title="주기 release와 Linux CPU scheduling 및 DDS deadline의 차이를 설명하는 타임라인" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

정적 의미: 앱의 timer가 작업을 release하고, Linux가 runnable thread를 실행하며, `write()`의 성공 반환은 별도로 기록합니다. 반면 DDS deadline 통지는 샘플 공급·수신 간격을 봅니다. 이들은 서로 다른 지점의 시각입니다.

흔한 구조는 `CLOCK_MONOTONIC` 절대시각 `t₀ + kT`까지 기다렸다가 입력 상태를 확인하고 제한된 계산 후 `write()`를 호출하는 loop입니다. 절대시각을 기준으로 다음 release를 정하면 매 작업시간을 다음 sleep에 더하는 drift를 줄일 수 있지만 timer wakeup 지연이나 DDS 호출 지연이 사라지는 것은 아닙니다. 놓친 주기를 따라잡기 위해 sample을 무제한으로 연속 발행할지, 최신 상태만 발행할지, 실패로 전환할지도 요구사항으로 정합니다. [clock_nanosleep(2)](https://man7.org/linux/man-pages/man2/clock_nanosleep.2.html), [timerfd_create(2)](https://man7.org/linux/man-pages/man2/timerfd_create.2.html)

## Linux 스레드 정책의 선택

| 정책 또는 구성 | 장점 | 비용과 경계 |
|---|---|---|
| 일반 `SCHED_OTHER` + 절대 timer | 설정이 간단하고 일반 목적 workload에 적합 | 부하·I/O·page fault 등으로 실제 wakeup과 완료 지연이 변할 수 있음 |
| `SCHED_FIFO` (First In, First Out) / `SCHED_RR` (Round Robin) | 높은 우선순위 thread의 runnable 작업을 빠르게 실행할 수 있음 | 주기 timer는 별도이며, 우선순위 역전·기아·의존 thread를 분석해야 함 |
| `SCHED_DEADLINE` | thread에 runtime, 상대 deadline, period를 등록하고 kernel의 EDF(Earliest Deadline First)/CBS(Constant Bandwidth Server) 스케줄링을 이용 | 권한·admission 조건·WCET(Worst-Case Execution Time)·blocking·CPU 배치 분석이 필요하며 모든 호출 경로를 예약하지 않음 |
| PREEMPT_RT kernel | kernel 선점·interrupt 처리 특성을 바꿔 지연을 줄이는 구성 축 | 사용자 작업 release, DDS QoS, 응용 측정은 여전히 필요 |

`SCHED_DEADLINE` 설정은 커널 thread의 CPU budget을 표현합니다. Linux kernel 문서는 실제 태스크 deadline을 지키기 위해 runtime이 WCET 이상이어야 하고, deadline 및 period를 태스크 모델과 맞추며, admission test 조건을 만족할 때 보장을 분석할 수 있다고 설명합니다. 등록 성공이나 정책 이름만으로 WCET·deadline 증명이 끝나지 않습니다. 런타임 budget 소진 시 thread가 다음 replenish까지 throttle될 수 있습니다. [Linux kernel Deadline Task Scheduling](https://docs.kernel.org/scheduler/sched-deadline.html)

`sched_period`는 사용자 함수를 주기마다 호출하는 타이머가 아닙니다. 앱은 timer를 기다리거나, 선택한 작업 모델에 맞는 release 경계를 구현해야 합니다. `sched_yield()`도 정책별 의미가 다릅니다. Linux kernel 설명상 SCHED_DEADLINE thread는 yield 때 남은 runtime을 포기하고 다음 period까지 throttle됩니다. 일반 스케줄링에서 yield를 호출해도 “다음 100ms 주기까지 sleep”하는 의미가 되지 않습니다. [Linux kernel의 `sched_yield()` 동작](https://docs.kernel.org/scheduler/sched-deadline.html#behavior-of-sched-yield), [sched_yield(2)](https://man7.org/linux/man-pages/man2/sched_yield.2.html)

정책은 프로세스 전체를 마법처럼 바꾸는 옵션으로 다루지 않습니다. Linux NPTL(Native POSIX Threads Library; POSIX는 Portable Operating System Interface)의 일반 pthread는 kernel scheduling entity와 연결되고, `sched_setattr()` 같은 API(Application Programming Interface)는 대상 thread에 적용됩니다. 입력을 읽는 thread, DDS listener, worker, IRQ(Interrupt Request)와 관련 의존 작업도 지연 경로에 들어간다면 해당 thread의 우선순위·동기화·CPU 자원과 상호작용을 함께 보아야 합니다. [sched_setattr(2)](https://man7.org/linux/man-pages/man2/sched_setattr.2.html), [pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)

## DDS API의 실행시간은 별도 경계다

CPU 계산을 2ms 안에 끝내도 `write()`가 자원 여유, 동기식 전송, lock, 네트워크 응답 등을 기다리면 호출 반환은 늦을 수 있습니다. 반대로 비동기 발행 API가 빨리 반환해도 이는 subscriber가 받고 처리했다는 증명이 아닙니다. 호출 반환 시각, 실제 전달/처리 시각, 장비 동작 완료 시각은 별도로 계측해야 합니다. 최대 block time, history/resource limits, 동기/비동기 publish mode, worker policy는 사용 중인 Fast DDS 버전의 설정 의미를 확인합니다.

실시간 요구를 쓸 때는 “10ms 주기”만 적지 말고 기준 사건과 완료 조건을 적습니다. 예를 들어 예정 release부터 `write()` 성공 반환까지인지, Reader 처리 완료까지인지, 센서가 실제 측정한 시점부터 액추에이터 응답까지인지 각각 별도 검증 방법이 필요합니다. Reader가 오래된 sample을 새로 받은 것으로 보지 않으려면 측정 timestamp, clock synchronization 및 stale-data 정책도 필요합니다. QoS 의미는 [DDS QoS 안내]({% post_url 2026-10-13-dds-qos %}), 수신 adapter의 타이밍은 [장비 어댑터]({% post_url 2026-10-13-dds-device-adapters %})를 함께 보세요.

## 프로젝트에서 실제 확인한 범위

세 프로세스 학습 프로젝트는 sensor simulator가 상대 `sleep`로 약 100ms 간격으로 발행하고, controller는 작업 뒤 50ms sleep하며 상태 변경 또는 heartbeat 때 발행합니다. 따라서 100ms 고정 발행/20ms 완료 요구나 `SCHED_DEADLINE` 적용 예제가 아닙니다. QoS `max_blocking_time` 설정이 있어도 전체 publish 경로의 실행시간 상한 검증은 하지 않았습니다.

실행은 Mac Docker Desktop Linux VM(Virtual Machine)의 Ubuntu 24.04.5 사용자 공간, Linux 6.4.16-linuxkit aarch64, Fast DDS 2.11.2에서 2026-10-09에 했습니다. 이 환경은 일반 Linux VM 내 시험이며 PREEMPT_RT 타깃이나 실제 장비의 시간 성능을 시험한 결과가 아닙니다. [장애 진단과 실행 증거]({% post_url 2026-10-13-dds-fault-diagnosis %})와 [연재 안내]({% post_url 2026-10-13-dds-guide %})에서 범위를 이어 확인할 수 있습니다.

## 참고자료와 조사 한계

- [Fast DDS 2.x 표준 QoS](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/dds_layer/core/policy/standardQosPolicies.html): Deadline의 의미·호환 규칙. 2.14.7 문서를 2.11.2 동작 검증으로 사용하지 않음.
- [Linux SCHED_DEADLINE](https://docs.kernel.org/scheduler/sched-deadline.html), [`sched_yield(2)`](https://man7.org/linux/man-pages/man2/sched_yield.2.html), [`sched_setattr(2)`](https://man7.org/linux/man-pages/man2/sched_setattr.2.html), [nptl(7)](https://man7.org/linux/man-pages/man7/nptl.7.html), [POSIX 공식 FAQ](https://www.opengroup.org/austin/papers/posix_faq.html): 스레드 CPU 예약과 제약.
- [`clock_nanosleep(2)`](https://man7.org/linux/man-pages/man2/clock_nanosleep.2.html), [`timerfd_create(2)`](https://man7.org/linux/man-pages/man2/timerfd_create.2.html): 응용 timer 기반 release.
- [PREEMPT_RT theory](https://docs.kernel.org/core-api/real-time/theory.html): 커널 선점 특성. [SCHED_DEADLINE의 EDF/CBS 설명](https://docs.kernel.org/scheduler/sched-deadline.html).

공개 1차 자료는 2026-10-13에 확인했습니다. 특정 제품의 hard real-time 적합성, target별 WCET, scheduler 설정, DDS transport와 전체 end-to-end latency는 이 자료와 프로젝트 실행만으로 확정할 수 없습니다. 비교 기준은 [DDS 개념 안내]({% post_url 2026-10-13-dds-basics %})에서 이어집니다.

{% include knowledge-links.html %}
