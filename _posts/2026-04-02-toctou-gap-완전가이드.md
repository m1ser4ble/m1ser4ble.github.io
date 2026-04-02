---
layout: single
title: "TOCTOU Gap(Time-of-Check-to-Time-of-Use) 완전 가이드"
date: 2026-04-02 23:00:00 +0900
categories: security
excerpt: TOCTOU 갭은 확인과 사용 사이의 시간차에서 발생하는 레이스 컨디션으로, 원자적 연산과 락·트랜잭션으로 위험을 줄이는 보안 취약점을 정리한다.
toc: true
toc_sticky: true
tags: [security, toctou, race, concurrency, filesystem, mitigation]
source: "/home/dwkim/dwkim/docs/security/toctou-gap-완전가이드.md"
---
TL;DR
- TOCTOU는 리소스 상태를 확인한 시점과 사용하는 시점 사이의 갭에서 발생하는 레이스 컨디션으로, 파일 시스템부터 분산 시스템까지 전 영역에 존재한다.
- Check-Then-Act 패턴이 구조적으로 취약하며, 원자적 연산(예: O_CREAT|O_EXCL), 트랜잭션, 락/버전 검증으로 갭을 제거하거나 축소해야 한다.
- 취약 창을 인지하고 설계·코드·운영(모니터링/탐지)까지 일관된 방어 전략을 적용하는 것이 핵심이다.

## 1. 개념
TOCTOU(Time-of-Check-to-Time-of-Use) 갭은 리소스 상태를 확인한 후 실제로 사용하는 사이에 시간이 벌어지면서 상태가 바뀌는 레이스 컨디션을 말한다. 이 갭은 체크 결과의 유효성을 무너뜨려 보안 취약점, 데이터 무결성 붕괴, 권한 상승으로 이어질 수 있다.

## 2. 배경
멀티프로세스/멀티스레드, 분산 시스템, 네트워크 지연 등으로 인해 “확인 후 사용” 흐름은 본질적으로 분리된다. OS와 API가 비원자적으로 설계된 영역(파일 시스템, 데이터베이스, IPC)에서는 TOCTOU가 쉽게 발생한다.

## 3. 이유
Check-Then-Act는 인간에게 자연스러운 코드 패턴이지만, 동시성 환경에서는 상태 불변성·원자성·독점성을 보장하지 못한다. 따라서 이 패턴이 남아 있는 곳마다 갭이 생기고 공격 또는 충돌의 창이 열리게 된다.

## 4. 특징
TOCTOU는 표면적으로는 단순한 레이스처럼 보이지만, 실제로는 권한 상승, 데이터 손상, 분산 환경의 중복 실행 같은 심각한 문제를 만든다. 파일 시스템, DB 트랜잭션, 스마트 컨트랙트 등 다양한 영역에 동일한 원인이 반복적으로 나타난다는 점이 핵심 특징이다.

## 5. 상세 내용

# TOCTOU Gap - Time-of-Check-to-Time-of-Use Race Condition 완전 가이드

> **한 줄 요약:** TOCTOU(Time-of-Check-to-Time-of-Use)는 리소스 상태를 확인(Check)한 시점과 사용(Use)하는 시점 사이의 시간 간격(Gap)에서 발생하는 race condition으로, 파일 시스템부터 분산 시스템, 스마트 컨트랙트까지 모든 동시성 환경에서 나타나는 근본적 보안 취약점이다.

---

## 목차

1. [개요](#1-개요)
2. [용어 사전 (Terminology)](#2-용어-사전-terminology)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원](#4-역사적-기원)
5. [학술적/이론적 배경](#5-학술적이론적-배경)
6. [진화 타임라인](#6-진화-타임라인)
7. [대안 비교 (Alternatives & Mitigation)](#7-대안-비교-alternatives--mitigation)
8. [상황별 최적 선택](#8-상황별-최적-선택)
9. [실전 베스트 프랙티스](#9-실전-베스트-프랙티스)
10. [함정과 안티패턴](#10-함정과-안티패턴)
11. [TOCTOU 취약 패턴 및 수정 코드](#11-toctou-취약-패턴-및-수정-코드)
12. [탐지 도구와 마이그레이션](#12-탐지-도구와-마이그레이션)
13. [빅테크 실전 사례](#13-빅테크-실전-사례)
14. [빅테크 공통 패턴 요약](#14-빅테크-공통-패턴-요약)
15. [References](#15-references)

---

## 1. 개요

### TOCTOU란 무엇인가

TOCTOU(Time-of-Check-to-Time-of-Use)는 소프트웨어가 리소스의 상태를 **확인(Check)**한 시점과 해당 리소스를 실제로 **사용(Use)**하는 시점 사이에 시간 간격(Gap)이 존재하며, 이 간격 동안 리소스의 상태가 외부 요인에 의해 **변경될 수 있는** race condition이다. "TOCK-too"로 발음하며, TOCTTOU, TOC/TOU로 표기하기도 한다.

MITRE의 **CWE-367**로 공식 분류되어 있으며, CWE-362(Race Condition)의 하위 항목에 해당한다. 파일 시스템, 데이터베이스, API, 분산 시스템, 블록체인 스마트 컨트랙트 등 **모든 동시성 환경**에서 발생할 수 있다.

### TOCTOU의 구조

TOCTOU 취약점은 다음과 같은 시간 흐름 속에서 발생한다:

```
CHECK 시점 (T1) ──────── Gap (취약 창) ──────── USE 시점 (T2)
  리소스 상태 확인           공격자가 상태 변경         확인된 상태 기반으로 행동
      │                         │                         │
  "파일이 존재하는가?"     symlink 교체/권한 변경      "파일을 열고 쓰기"
  "잔액이 충분한가?"       다른 트랜잭션이 차감         "출금 처리"
  "쿠폰이 유효한가?"       다른 요청이 사용 처리        "할인 적용"
```

**핵심 문제:** Check 시점에 참이었던 조건이 Use 시점에서도 여전히 참이라는 **보장이 없다.** 두 연산이 **원자적(atomic)**으로 실행되지 않기 때문이다.

### 안전한 코드 vs TOCTOU 취약 코드

| 구분 | 안전한 코드 (Atomic) | TOCTOU 취약 코드 (Non-Atomic) |
|------|---------------------|-------------------------------|
| **파일 생성** | `open(path, O_CREAT\|O_EXCL)` — 존재 확인 + 생성을 단일 syscall로 | `if (!exists(path)) { open(path) }` — 두 syscall 사이에 gap |
| **잔액 차감** | `UPDATE accounts SET balance = balance - 100 WHERE balance >= 100` — 단일 SQL | `SELECT balance; if (balance >= 100) UPDATE balance = balance - 100` — 두 쿼리 사이에 gap |
| **쿠폰 사용** | `UPDATE coupons SET used=TRUE WHERE id=? AND used=FALSE` + ROWCOUNT 확인 | `SELECT used FROM coupons; if (!used) UPDATE SET used=TRUE` |
| **카운터 증가** | `AtomicInteger.incrementAndGet()` | `int v = counter; counter = v + 1` |
| **임시 파일** | `mkstemp()` — 이름 생성 + 파일 열기를 원자적으로 | `mktemp()` + `open()` — 이름 반환 후 별도 open |
| **회원가입** | `INSERT ... ON CONFLICT DO NOTHING` + UNIQUE 제약 | `SELECT COUNT(*) WHERE email=?; INSERT ...` |

---

## 2. 용어 사전 (Terminology)

| 용어 | 풀네임 | 설명 |
|------|--------|------|
| **TOCTOU** | Time-of-Check-to-Time-of-Use | 확인 시점과 사용 시점 사이의 race condition. "TOCK-too"로 발음한다. TOCTTOU, TOC/TOU 등의 변형 표기가 존재한다. |
| **Race Condition** | - | TOCTOU의 상위 개념. 두 이상의 실행 흐름이 공유 자원에 접근할 때, 실행 순서나 타이밍에 따라 결과가 달라지는 현상이다. CWE-362로 분류된다. |
| **Check-Then-Act** | - | 조건을 관찰(Check)한 후, 그 조건이 여전히 유효하다고 가정하고 행동(Act)하는 패턴. TOCTOU의 근본 원인이 되는 프로그래밍 관용구다. |
| **Symlink Race** | Symbolic Link Race | 파일 시스템 TOCTOU의 전형적 공격 형태. `access()` → `open()` 호출 사이에 공격자가 대상 파일을 symlink로 교체하여 의도하지 않은 파일에 접근하게 만든다. |
| **CWE-367** | Common Weakness Enumeration 367 | MITRE에서 부여한 TOCTOU의 공식 분류 코드. CWE-362(Race Condition) 아래의 하위 항목이다. |
| **Vulnerability Window** | 취약 창 | Check와 Use 사이의 시간 구간. 공격자가 리소스 상태를 변경할 수 있는 기회의 창이다. 이 창이 좁을수록 공격은 어렵지만 불가능하지는 않다. |
| **EAFP** | Easier to Ask Forgiveness than Permission | 사전 Check 없이 바로 시도(Use)한 후 실패를 처리하는 프로그래밍 철학. Python 커뮤니티에서 권장하며, TOCTOU 방어의 핵심 원칙이다. |
| **LBYL** | Look Before You Leap | 행동 전에 먼저 조건을 확인하는 프로그래밍 철학. Check-Then-Act 패턴과 동일하며, TOCTOU에 구조적으로 취약하다. |
| **CAS** | Compare-and-Swap | 하드웨어 레벨에서 제공하는 원자적 연산. "현재 값이 기대값과 같으면 새 값으로 교체"하는 Check+Use를 단일 CPU 명령으로 수행한다. |
| **Fencing Token** | - | 분산 락 환경에서 stale write를 방지하기 위한 단조증가(monotonically increasing) 토큰. 락 획득 시 발급되며, 리소스 서버가 이전 토큰의 쓰기를 거부한다. Martin Kleppmann이 제안했다. |
| **Reentrancy** | 재진입 | 스마트 컨트랙트에서의 TOCTOU 변형. 외부 컨트랙트를 호출하는 중에 해당 컨트랙트가 원래 함수를 재귀적으로 호출하여 상태 변경 전에 반복 실행되는 공격이다. 2016년 DAO Hack의 원인이다. |
| **Idempotency Key** | 멱등성 키 | 동일한 요청이 여러 번 전송되더라도 한 번만 처리되도록 보장하는 고유 키. API의 중복 요청 방지에 사용되며, Stripe가 대중화했다. |
| **Double-Checked Locking** | 이중 확인 잠금 | 멀티스레드 환경에서 lazy initialization을 위한 패턴. 잘못 구현하면 TOCTOU를 유발한다 (CWE-609). Java에서는 `volatile` 키워드가 필수다. |
| **Dangling Pointer** | 댕글링 포인터 | 메모리 레벨의 TOCTOU 유사 패턴. 해제된(freed) 메모리를 가리키는 포인터를 통해 접근하는 Use-After-Free 취약점이다. |
| **Dirty COW** | Copy-on-Write Race | CVE-2016-5195. Linux 커널의 COW(Copy-on-Write) 메커니즘에서 발생한 TOCTOU race condition. 9년간 존재했으며, 모든 Linux 기반 장치에 영향을 미쳤다. |
| **Optimistic Locking** | 낙관적 잠금 | 충돌이 드물다고 가정하고 version 컬럼으로 변경 감지하는 동시성 제어 방식. `UPDATE ... WHERE version = ?`으로 구현한다. |
| **Pessimistic Locking** | 비관적 잠금 | 충돌이 잦다고 가정하고 선제적으로 락을 획득하는 방식. `SELECT ... FOR UPDATE`가 대표적이다. |
| **STM** | Software Transactional Memory | 트랜잭션 개념을 메모리 접근에 적용한 동시성 제어 메커니즘. Haskell, Clojure 등에서 지원한다. |
| **CRDT** | Conflict-free Replicated Data Type | 분산 환경에서 충돌 없이 병합 가능한 데이터 구조. 락 없이도 최종 일관성을 보장한다. |

---

## 3. 등장 배경과 이유

### 세 가지 근본 원인

TOCTOU가 존재하는 이유는 크게 세 가지 구조적 원인에서 비롯된다.

#### 1. Unix 파일 시스템의 비원자성

Unix/POSIX 파일 시스템 API는 `access()`, `stat()`, `open()`, `chmod()` 등이 **각각 별개의 시스템 콜**로 설계되어 있다. 멀티태스킹 환경에서 두 호출 사이에 OS 스케줄러가 다른 프로세스에 CPU를 할당할 수 있으며, 이 간격 동안 파일 시스템 상태가 변경될 수 있다.

```c
/* 취약한 패턴: 두 개의 별도 syscall */
if (access("/tmp/data", R_OK) == 0) {   /* CHECK: T1 */
    /* --- 취약 창(Gap) --- 공격자가 /tmp/data를 symlink로 교체 --- */
    fd = open("/tmp/data", O_RDONLY);     /* USE: T2 */
}
```

#### 2. Setuid 프로그램의 권한 상승 메커니즘

Unix의 setuid 프로그램은 **real UID**(실제 사용자)와 **effective UID**(실행 권한)가 다르다. `access()` 시스템 콜은 real UID로 권한을 체크하고, `open()` 은 effective UID(종종 root)로 파일을 연다. 이 구조적 불일치가 TOCTOU와 결합하면 **즉각적인 권한 상승(privilege escalation)**이 가능해진다.

| 시스템 콜 | 사용 UID | 역할 |
|-----------|----------|------|
| `access()` | real UID (일반 사용자) | "이 사용자가 파일에 접근할 수 있는가?" |
| `open()` | effective UID (root) | "파일을 연다" — setuid root이면 모든 파일 접근 가능 |

공격자가 `access()` → `open()` 사이에 파일을 `/etc/shadow`로의 symlink로 교체하면, `access()`는 일반 파일에 대해 OK를 반환하지만, `open()`은 root 권한으로 `/etc/shadow`를 열게 된다.

#### 3. 임시 파일 처리 관행

초기 Unix의 `mktemp()` 함수는 **고유한 파일 이름만 반환**할 뿐, 파일 자체를 생성하지 않았다. 이름 반환 → `open()` 호출 사이에 공격자가 동일한 이름으로 symlink를 생성하면, 프로그램은 공격자가 지정한 파일에 쓰기를 수행하게 된다.

```c
/* 취약: mktemp()는 이름만 반환 */
char *name = mktemp("/tmp/app.XXXXXX");   /* 이름 생성 */
/* --- Gap: 공격자가 name과 동일한 이름의 symlink 생성 → /etc/passwd 등 --- */
fd = open(name, O_WRONLY | O_CREAT);       /* 공격자의 symlink를 통해 의도치 않은 파일에 쓰기 */

/* 안전: mkstemp()는 이름 생성 + 파일 열기를 원자적으로 수행 */
char template[] = "/tmp/app.XXXXXX";
fd = mkstemp(template);   /* O_CREAT | O_EXCL로 열기까지 한 번에 */
```

### "if-then-do" 패턴이 위험한 이유

동시성 환경에서 "조건을 확인한 후 행동한다(if-then-do)"는 패턴이 위험한 이유는 다음 **세 가지 암묵적 가정**이 모두 성립하지 않기 때문이다:

| # | 암묵적 가정 | 현실 |
|---|------------|------|
| 1 | **상태 불변성 가정** — Check와 Use 사이에 상태가 변하지 않는다 | 다른 스레드/프로세스/요청이 **언제든 상태를 변경**할 수 있다 |
| 2 | **원자성 가정** — Check → Use가 하나의 불가분 연산이다 | OS 스케줄러, 네트워크 지연, GC 등이 **두 연산을 분리**할 수 있다 |
| 3 | **독점성 가정** — 이 프로세스만 해당 리소스에 접근한다 | 공유 리소스이므로 **다수의 경쟁자가 동시 접근**한다 |

단일 스레드, 단일 사용자 환경에서는 이 세 가정이 성립할 수 있지만, 현대의 멀티코어, 멀티프로세스, 분산 환경에서는 하나도 보장되지 않는다.

---

## 4. 역사적 기원

### TOCTOU의 발견과 초기 연구

TOCTOU 취약점은 **1970년대 초 운영체제 보안 연구**에서 최초로 인식되었다.

| 연도 | 사건 | 의의 |
|------|------|------|
| **1973-74** | MIT **Project MAC**의 Multics 보안 감사 | 시분할(time-sharing) 시스템에서 race condition 문제 최초 인식. Saltzer의 1974년 CACM 논문 "Protection and the Control of Information Sharing in Multics"에서 보안 원리 체계화 |
| **1974** | **McPhee** — Unix에서 이름-객체 바인딩 문제 특징화 | 파일 이름이 가리키는 객체가 Check와 Use 사이에 변경될 수 있다는 문제를 **최초로 명시적으로 특징화** |
| **1980s** | **Sendmail /tmp race condition** 공격 발생 | 실제 공격이 관찰된 최초 사례 중 하나. BSD mail 유틸리티의 `mktemp()` 취약점도 이 시기에 발견 |
| **1996** | **Matt Bishop & Michael Dilger** — "Checking for Race Conditions in File Accesses" | Computing Systems (USENIX) 발표. TOCTOU 학술 연구의 기준점. 의미론적 탐지 방법론 제시. SunOS/HP-UX의 `passwd` 명령에서 TOCTOU 취약점 발견 |
| **1999** | **OpenSSH** Unix domain socket race condition | 널리 사용되는 보안 소프트웨어에서의 TOCTOU 발견으로 경각심 확산 |

### 주요 CVE 연혁

TOCTOU 취약점은 현재까지도 지속적으로 발견되고 있다. 영향력이 컸던 주요 CVE를 정리한다.

| CVE | 연도 | 대상 | CVSS | 설명 |
|-----|------|------|------|------|
| **CVE-2006-0058** | 2006 | Sendmail | 9.8 | 시그널 핸들러 내 race condition으로 원격 코드 실행(RCE) 가능. 수십만 메일 서버에 영향 |
| **CVE-2016-5195** | 2016 | Linux Kernel | 7.8 | **"Dirty COW"** — Copy-on-Write race로 권한 상승. 2007년부터 9년간 존재. 모든 Android 기기 루팅 가능 |
| **CVE-2018-15664** | 2018 | Docker `cp` | 7.5 | `docker cp` 명령의 symlink race로 컨테이너 내부에서 **호스트 root 파일 시스템 접근** 가능 |
| **CVE-2022-29799** | 2022 | systemd (networkd-dispatcher) | 8.4 | **"Nimbuspwn"** — directory traversal + symlink race로 root 권한 획득 |
| **CVE-2022-29800** | 2022 | systemd (networkd-dispatcher) | 8.4 | Nimbuspwn의 두 번째 CVE. TOCTOU race로 공격자 스크립트 실행 |
| **CVE-2024-23651** | 2024 | Docker BuildKit | 8.7 | mount cache race condition으로 **컨테이너 탈출(container escape)** 가능 |
| **Pwn2Own 2023** | 2023 | Tesla Model 3 | - | Synacktiv 팀이 TOCTOU race condition으로 Tesla 게이트웨이 침해. $100,000 바운티 수상 |
| **2025** | 2025 | AWS DynamoDB | - | DNS 관리 시스템의 TOCTOU로 **US-EAST-1 리전 대규모 장애** 발생 |

### Dirty COW 심층 분석

Dirty COW(CVE-2016-5195)는 TOCTOU 취약점의 **가장 유명한 사례**다.

**매커니즘:** Linux 커널의 Copy-on-Write(COW) 페이지 처리에서 race condition이 발생한다. 정상적으로는 읽기 전용 매핑에 쓰기를 시도하면 COW가 트리거되어 **사본(copy)**에 쓰기가 이루어지지만, 특정 타이밍에 race를 유발하면 **원본 페이지에 직접 쓰기**가 가능해진다.

```
Thread A: madvise(MADV_DONTNEED) — 페이지 매핑 해제 반복
Thread B: write() via /proc/self/mem — 쓰기 반복

두 스레드가 동시에 실행되면:
  1. Thread B가 COW 트리거 → 커널이 사본 생성
  2. Thread A가 MADV_DONTNEED로 사본 제거
  3. Thread B의 쓰기가 원본 페이지에 직접 적용됨 (race 성공)
```

**영향:** 읽기 전용 파일(`/etc/passwd` 등)에 쓰기 가능 → 모든 Linux 시스템에서 root 권한 획득 가능. Android 기기의 루팅에도 즉시 악용되었다.

---

## 5. 학술적/이론적 배경

### 핵심 논문

TOCTOU 연구의 학문적 발전을 이끈 핵심 논문들을 연대순으로 정리한다.

| # | 논문 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|-----------|
| 1 | "Checking for Race Conditions in File Accesses" | Matt Bishop, Michael Dilger | Computing Systems (USENIX), 1996 | TOCTOU의 **의미론적 탐지 방법론** 제시. 이름(name)과 객체(object) 사이의 바인딩(binding) 불변성 개념 정립. TOCTOU 학술 연구의 기준점 |
| 2 | "Dynamic Detection and Prevention of Race Conditions in File Accesses" | Eugene Tsyrklevich, Bennet Yee | USENIX Security, 2003 | **커널 레벨 동적 탐지 및 방어 시스템** 구현. 런타임에 TOCTOU 시퀀스를 탐지하여 차단하는 접근법 |
| 3 | "A Practical Mimicry Attack Against Powerful System-Call Monitors" | Dean & Hu | USENIX Security, 2004 | **TOCTOU 불가능성 정리**: "이식 가능하고(portable) 결정론적인(deterministic) TOCTOU 방어법은 존재하지 않는다." 확률적(probabilistic) 해법만이 가능함을 증명 |
| 4 | "STEM: a Framework for Simulation of Software Process Evolution Models" / Race condition analysis | Wei & Pu | USENIX FAST, 2005 | Unix 시스템에서 **224개의 exploitable TOCTOU 쌍**을 체계적으로 열거. STEM(Symlink-based TOCTOU Exploitation Model) 정립 |
| 5 | "Portably Preventing File Race Attacks with User-Mode Path Resolution" | Tsafrir, Herber, Wagner | USENIX FAST, 2008 | **Hardness Amplification** — 파일 시스템 maze 공격에도 버티는 사용자 레벨 방어법. 커널 수정 없이 안전한 경로 해석(path resolution)을 구현 |

### Dean & Hu의 불가능성 정리 (2004)

이 정리는 TOCTOU 방어의 **이론적 한계**를 보여준다:

> "어떤 사용자 공간 프로그램도 이식 가능하고 결정론적인 방식으로 파일 시스템 TOCTOU race condition을 완전히 방지할 수 없다."

**증명 핵심:** 사용자 공간에서의 어떤 Check-then-Use 시퀀스든 커널의 경로 해석(pathname resolution) 과정에서 race가 개입할 수 있으며, 사용자 공간 코드가 이를 원자적으로 방지할 방법이 없다. 커널 레벨 지원(O_NOFOLLOW, openat() 등) 또는 확률적 방어만이 유효하다.

### CWE 계층 구조

TOCTOU는 CWE(Common Weakness Enumeration) 분류 체계에서 다음과 같이 위치한다:

```
CWE-664: Improper Control of a Resource Through its Lifetime
  └─ CWE-662: Improper Synchronization
       └─ CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization
            │         ("Race Condition")
            └─ CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition
                 └─ CWE-363: Race Condition Enabling Link Following
```

### 관련 CERT 규칙

| 규칙 | 제목 | 설명 |
|------|------|------|
| **FIO01-C** | Be careful using functions that use file names for identification | 파일 이름 기반 함수(`access()`, `stat()`, `chmod()`) 사용 시 TOCTOU 주의 |
| **FIO45-C** | Avoid TOCTOU race conditions while accessing files | 파일 접근 시 fd(file descriptor) 기반 API(`fstat()`, `fchmod()`, `fchown()`) 사용 권장 |
| **POS35-C** | Avoid race conditions while checking for the existence of a symbolic link | symlink 존재 확인 시 TOCTOU 방지 기법 사용 |

### 형식 검증 도구

TOCTOU를 포함한 race condition을 정적/형식적으로 분석하는 도구들:

| 도구 | 저자/기관 | 접근법 | 비고 |
|------|-----------|--------|------|
| **RacerX** | Engler et al. | 정적 분석 (SOSP 2003) | 컴파일러 기반 race condition 탐지. 수백만 줄 규모 코드베이스에 적용 |
| **TLA+** | Leslie Lamport | 형식 명세 | 동시성 시스템의 상태 공간을 열거하여 race 시나리오 검증 |
| **Alloy** | MIT | 관계 논리 기반 모델 검사 | 작은 범위(small scope)에서 반례를 탐색하여 race condition 발견 |
| **CodeQL** | GitHub/Semmle | 의미론적 쿼리 | `cpp/toctou-race-condition` 쿼리로 CWE-367 패턴 탐지 |

---

## 6. 진화 타임라인

TOCTOU의 인식, 공격, 방어가 발전해온 역사를 시간순으로 정리한다.

```
1973  Multics 보안 감사 — 시분할 시스템에서 TOCTOU 최초 인식
  │
1974  McPhee — 이름-객체 바인딩 문제 최초 특징화
  │   Saltzer — "Protection and the Control of Information Sharing" CACM 논문
  │
1980s Sendmail /tmp race condition — 실제 공격 발생
  │   BSD mail 유틸리티 mktemp() 취약점 발견
  │
1996  Bishop & Dilger — "Checking for Race Conditions in File Accesses"
  │   TOCTOU 학술 체계화, 의미론적 탐지 방법론 정립
  │
1999  OpenSSH Unix domain socket race condition 발견
  │
2003  Tsyrklevich & Yee — 커널 레벨 동적 TOCTOU 탐지/방어 시스템
  │   Engler et al. — RacerX 정적 분석 도구 (SOSP)
  │
2004  Dean & Hu — TOCTOU 불가능성 정리 (USENIX Security)
  │   Borisov et al. — 파일 시스템 maze 공격 기법
  │
2005  Wei & Pu — 224개 exploitable TOCTOU 쌍 열거, STEM 모델
  │
2006  CWE-367 (TOCTOU) MITRE에 최초 게재
  │   CVE-2006-0058 Sendmail 시그널 핸들러 race (원격 코드 실행)
  │
2008  Tsafrir et al. — Hardness Amplification, 사용자 레벨 방어
  │
2010s 클라우드/마이크로서비스 확산 → TOCTOU가 분산 시스템, API로 확장
  │   RESTful API에서의 race condition 인식 증가
  │
2015  Starbucks 기프트카드 race condition 해킹 — 잔액 증식 공격
  │
2016  DAO Hack ($60M) — Ethereum 스마트 컨트랙트 Reentrancy = 블록체인 TOCTOU
  │   Dirty COW (CVE-2016-5195) — Linux 커널 TOCTOU, 9년간 존재
  │
2018  CVE-2018-15664 Docker cp symlink race — 컨테이너 TOCTOU
  │
2020s 컨테이너 탈출 CVE 시리즈, Kubernetes TOCTOU 취약점 다수 발견
  │
2022  Nimbuspwn (CVE-2022-29799/29800) — systemd symlink race → root 권한
  │
2023  Tesla Model 3 Pwn2Own — TOCTOU로 게이트웨이 침해
  │   James Kettle — Single-Packet Attack 기법 발표 (HTTP/2 기반 race condition)
  │
2024  CVE-2024-23651 Docker BuildKit mount cache race — 컨테이너 탈출
  │
2025  AWS DynamoDB DNS 관리 TOCTOU → US-EAST-1 대규모 장애
  │   Python filelock CVE — 파일 락 라이브러리의 TOCTOU 취약점
```

### 패러다임 변화

| 시대 | TOCTOU 발생 영역 | 공격 표면 |
|------|------------------|-----------|
| **1970-80s** | 단일 시스템 파일 시스템 | setuid 프로그램, /tmp 디렉터리 |
| **1990-2000s** | 멀티프로세스/멀티스레드 | 커널 race, 공유 메모리 |
| **2010s** | 웹 API, 데이터베이스 | 재고/잔액 동시 요청, 쿠폰 중복 사용 |
| **2015s~** | 분산 시스템, 컨테이너 | 마이크로서비스 간 상태 불일치, 컨테이너 탈출 |
| **2016s~** | 블록체인/스마트 컨트랙트 | Reentrancy 공격, Flash Loan 기반 가격 조작 |
| **2020s~** | 자동차, IoT, AI 인프라 | ECU 펌웨어, 모델 서빙 파이프라인 |

---

## 7. 대안 비교 (Alternatives & Mitigation)

TOCTOU를 방어하는 전략은 적용 계층에 따라 다양하다. 각 계층별로 상세히 비교한다.

### 7.1 파일 시스템 레벨

| 전략 | 작동 원리 | 장점 | 단점 |
|------|-----------|------|------|
| **open() + fstat()** (fd 기반 검증) | `open()`으로 파일을 먼저 연 후 `fstat(fd)`로 속성 확인. fd는 열린 파일 객체를 직접 참조하므로 이름 기반 race 불가 | 이름 바인딩 race 완전 제거. POSIX 표준 | open() 자체의 경로 해석 시 race 가능. 기존 코드 리팩터링 필요 |
| **O_NOFOLLOW 플래그** | `open()` 호출 시 심볼릭 링크를 따라가지 않도록 지시. symlink이면 `ELOOP` 오류 반환 | symlink race 완전 차단. 단일 플래그 추가로 간단 적용 | 경로의 중간 디렉터리 symlink는 차단하지 못함. 정상적인 symlink 사용도 차단 |
| **openat() / *at() 패밀리** | 디렉터리 fd를 기준으로 상대 경로 해석. `openat(dirfd, "file", flags)` 형태 | 경로 해석을 디렉터리 fd에 고정하여 경로 중간의 race 방지 | API 변경 필요. 디렉터리 fd 관리 복잡성 |
| **Linux Capabilities / Namespaces** | setuid 대신 세분화된 capabilities 부여. User namespace로 권한 격리 | setuid 자체를 제거하여 TOCTOU + 권한 상승 조합 차단 | 기존 setuid 프로그램 전면 수정 필요. capabilities 설계 복잡 |
| **mkstemp() / tmpfile()** | 임시 파일 이름 생성과 열기를 **원자적으로** 수행. `O_CREAT\|O_EXCL` 내부 사용 | 임시 파일 TOCTOU 완전 제거 | mktemp()에 비해 API 약간 상이. 일부 레거시 시스템 미지원 |

### 7.2 프로그래밍 레벨

| 전략 | 작동 원리 | 장점 | 단점 |
|------|-----------|------|------|
| **Atomic Operations (CAS, Test-and-Set)** | 하드웨어 CPU 명령으로 Check+Use를 단일 원자적 연산으로 수행 | 락 없이 최고 성능. 커널 개입 불필요 | 단일 변수에만 적용. 복잡한 상태 변경 불가 |
| **Mutex / Lock** | 임계 구역(critical section)을 잠금으로 보호. Check와 Use를 한 스레드만 실행 | 다중 변수/복잡한 로직 보호 가능. 직관적 | 데드락 위험. 성능 병목. 분산 환경 불가 |
| **Read-Write Lock (RWLock)** | 읽기는 동시 허용, 쓰기는 독점. 읽기 비율이 높을 때 성능 향상 | Mutex보다 읽기 처리량 높음 | 쓰기 기아(starvation) 가능. 구현 복잡 |
| **Optimistic Locking (version)** | version 컬럼으로 변경 감지. 업데이트 시 version 일치 여부 확인 | 락 없이 높은 동시 처리량. 충돌 시만 재시도 | 충돌 빈번 시 재시도 폭증. ABA 문제 가능 |
| **Pessimistic Locking** | 선제적으로 락 획득 후 작업. `SELECT FOR UPDATE` 등 | 충돌 보장 방지. 복잡한 트랜잭션 안전 | 데드락 위험. 처리량 저하. 분산 환경 어려움 |
| **STM (Software Transactional Memory)** | 메모리 접근을 트랜잭션으로 감싸고, 충돌 시 자동 롤백/재시도 | 명시적 락 불필요. 합성(composition) 가능 | 부작용 있는 연산 불가. 런타임 오버헤드. 언어 지원 필요 |
| **Immutable Data Structures** | 데이터를 변경하지 않고 새 버전 생성. 기존 참조는 불변 | race condition 구조적 불가능. 추론 용이 | 메모리 사용량 증가. 성능 오버헤드. 패러다임 전환 필요 |

### 7.3 데이터베이스 레벨

| 전략 | 작동 원리 | 장점 | 단점 |
|------|-----------|------|------|
| **SELECT FOR UPDATE** | 읽기 시점에 행 레벨 배타 락 획득. 트랜잭션 종료까지 유지 | 확실한 원자성. 복잡한 비즈니스 로직 지원 | 데드락 위험. 동시 처리량 감소. 장기 트랜잭션 주의 |
| **Serializable Isolation** | 트랜잭션을 직렬 실행한 것과 동일한 결과 보장 (MVCC 또는 2PL) | 모든 race condition 이론적 제거 | 심각한 성능 저하. 재시도 로직 필수. 대부분의 애플리케이션에 과도 |
| **Advisory Locks** | 애플리케이션 레벨 락. DB가 강제하지 않고 협력적으로 동작 | 유연. 테이블/행 외 리소스에도 적용 가능 | 모든 코드 경로가 준수해야 함. 강제성 없음 |
| **Unique Constraints** | DB가 중복 삽입을 원자적으로 거부. `INSERT ON CONFLICT` | 가장 간단하고 확실. DB가 강제 | 삽입에만 적용. 복잡한 비즈니스 규칙 불가 |
| **CAS (WHERE version = ?)** | `UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?` | 락 없이 높은 처리량. 단일 쿼리로 원자적 | 충돌 시 재시도 필요. 높은 경합 시 성능 저하 |

### 7.4 분산 시스템 레벨

| 전략 | 작동 원리 | 장점 | 단점 |
|------|-----------|------|------|
| **Redis SETNX / Redlock** | 분산 락. SETNX(SET if Not eXists)로 원자적 락 획득. Redlock은 다수 Redis 인스턴스에 동시 락 | 빠른 락 획득/해제. 구현 상대적 간단 | 네트워크 파티션 시 안전성 보장 불완전 (Martin Kleppmann 비판). 클럭 의존 |
| **ZooKeeper / etcd (Consensus)** | Paxos/Raft 합의 알고리즘 기반. Linearizable 읽기/쓰기 보장 | 강력한 일관성. 네트워크 파티션에서도 안전 | 높은 지연(latency). 운영 복잡성. 처리량 한계 |
| **CRDT (Conflict-free Replicated Data Type)** | 수학적으로 병합 가능한 데이터 구조. 락 없이 최종 일관성 보장 | 락/합의 불필요. 높은 가용성. 오프라인 동작 | 지원하는 연산 제한적. 최종 일관성만 보장. 설계 복잡 |
| **Saga Pattern** | 긴 분산 트랜잭션을 단계별 로컬 트랜잭션 + 보상 트랜잭션으로 분해 | 서비스 간 느슨한 결합. 각 서비스 자율성 유지 | 보상 로직 구현 복잡. 부분 실패 시 일관성 복구 어려움 |
| **Idempotency Keys** | 각 요청에 고유 키 부여. 서버가 키 기반으로 중복 처리 방지 | 네트워크 재시도 안전. 클라이언트 구현 간단 | 서버 사이드 키 저장소 필요. 키 만료/정리 관리 |

### 7.5 웹/API 레벨

| 전략 | 작동 원리 | 장점 | 단점 |
|------|-----------|------|------|
| **ETag / If-Match** | 리소스 버전을 ETag 헤더로 관리. 업데이트 시 `If-Match` 헤더로 버전 확인 | HTTP 표준. 캐싱과 동시성 제어 겸용 | 클라이언트가 헤더를 올바르게 사용해야 함. 서버 구현 필요 |
| **Double-Submit Prevention** | 제출 후 토큰 무효화. 같은 토큰의 재제출 거부 | 폼 중복 제출 방지. UX 개선 | 서버 사이드 상태 필요. 분산 환경에서 토큰 동기화 |
| **Idempotency Tokens** | API 요청에 `Idempotency-Key` 헤더 포함. 서버가 키별 결과 캐시 | 결제 등 중요 API의 중복 처리 완전 방지 | 키 저장소 운영. TTL 관리. 모든 API에 적용 시 오버헤드 |

### 종합 비교표

| 전략 | 적용 계층 | TOCTOU 제거 수준 | 성능 영향 | 구현 복잡도 | 분산 환경 |
|------|-----------|-----------------|-----------|------------|-----------|
| open() + fstat() | 파일 시스템 | 높음 | 무시 가능 | 낮음 | N/A |
| O_NOFOLLOW | 파일 시스템 | 중간 (symlink만) | 무시 가능 | 매우 낮음 | N/A |
| openat() | 파일 시스템 | 높음 | 무시 가능 | 중간 | N/A |
| mkstemp() | 파일 시스템 | 높음 (임시 파일) | 무시 가능 | 매우 낮음 | N/A |
| CAS (하드웨어) | 프로그래밍 | 높음 (단일 변수) | 매우 낮음 | 중간 | 단일 노드만 |
| Mutex | 프로그래밍 | 높음 | 중간 | 낮음 | 단일 노드만 |
| RWLock | 프로그래밍 | 높음 | 낮음~중간 | 중간 | 단일 노드만 |
| Optimistic Locking | 프로그래밍/DB | 높음 | 낮음 (충돌 적을 때) | 중간 | 단일 DB |
| Pessimistic Locking | DB | 매우 높음 | 높음 | 낮음 | 단일 DB |
| STM | 프로그래밍 | 높음 | 중간 | 높음 | 단일 노드만 |
| Immutable Data | 프로그래밍 | 매우 높음 | 중간 | 높음 (패러다임) | 양호 |
| SELECT FOR UPDATE | DB | 매우 높음 | 높음 | 낮음 | 단일 DB |
| Serializable Isolation | DB | 매우 높음 | 매우 높음 | 낮음 | 단일 DB |
| Unique Constraints | DB | 높음 (삽입) | 낮음 | 매우 낮음 | 단일 DB |
| CAS (WHERE version=?) | DB | 높음 | 낮음 | 중간 | 단일 DB |
| Redis SETNX/Redlock | 분산 | 중간~높음 | 낮음 | 중간 | 가능 (제한적) |
| ZooKeeper / etcd | 분산 | 매우 높음 | 높음 | 높음 | 완전 지원 |
| CRDT | 분산 | 중간 (최종 일관성) | 낮음 | 매우 높음 | 완전 지원 |
| Saga + Outbox | 분산 | 높음 | 중간 | 매우 높음 | 완전 지원 |
| Idempotency Keys | 분산/API | 높음 (중복 방지) | 낮음 | 중간 | 완전 지원 |
| ETag / If-Match | API | 높음 | 무시 가능 | 중간 | 완전 지원 |

---

## 8. 상황별 최적 선택

### 의사결정 트리

TOCTOU 발생 위치와 환경에 따라 최적의 전략을 선택하는 가이드다.

```
TOCTOU 발생 위치는?
│
├─ 파일 시스템
│   ├─ 임시 파일 생성 → mkstemp() / tmpfile()
│   ├─ symlink 공격 우려 → O_NOFOLLOW + openat()
│   ├─ 파일 존재 확인 후 생성 → open(O_CREAT | O_EXCL)
│   └─ 파일 속성 확인 후 사용 → open() 후 fstat(fd) / fchmod(fd)
│
├─ 단일 프로세스 / 멀티스레드
│   ├─ 단일 변수 → CAS / Atomic
│   ├─ 짧은 임계 구역 → Mutex
│   ├─ 읽기 많음 → RWLock
│   └─ 복잡한 상태 변경 → STM (지원 시) 또는 Mutex + 조건 변수
│
├─ 단일 데이터베이스
│   ├─ 충돌 잦음 → SELECT FOR UPDATE (Pessimistic Locking)
│   ├─ 충돌 드묾 → Optimistic Locking (version 컬럼)
│   ├─ 중복 삽입 방지 → UNIQUE CONSTRAINT + INSERT ON CONFLICT
│   └─ 복합 비즈니스 규칙 → Serializable Isolation (최후 수단)
│
├─ 마이크로서비스 간
│   └─ Idempotency Key + Saga Pattern + Transactional Outbox
│
├─ 분산 시스템
│   ├─ 성능 우선 → Redis SETNX / Redlock (+ Fencing Token)
│   └─ 정확성 우선 → etcd / ZooKeeper (Linearizable)
│
├─ API / 웹
│   ├─ 리소스 업데이트 → ETag + If-Match
│   ├─ 결제/중요 연산 → Idempotency Key + DB atomic UPDATE
│   └─ Rate Limiting → Redis Lua Script (원자적 실행)
│
└─ 스마트 컨트랙트
    └─ Checks-Effects-Interactions 패턴 + ReentrancyGuard
```

### 상황별 최적 전략 요약

| 상황 | 최적 전략 | 이유 |
|------|-----------|------|
| 단일 프로세스 파일 접근 | `O_CREAT\|O_EXCL` + `O_NOFOLLOW` | 단일 syscall로 check+use 통합. symlink 추종 차단 |
| 멀티스레드 공유 자원 (짧은 임계 구역) | `Mutex` | 직관적이고 안정적. 다중 변수 보호 가능 |
| 멀티스레드 공유 자원 (읽기 많음) | `RWLock` | 읽기 동시성 허용으로 처리량 향상 |
| 단일 DB (충돌 잦음) | `SELECT FOR UPDATE` | 행 레벨 락으로 원자적 처리 보장 |
| 단일 DB (충돌 드묾) | `Optimistic Locking (version)` | 락 없이 높은 동시 처리량. 대부분의 요청이 성공 |
| 중복 삽입 방지 | `UNIQUE CONSTRAINT + EAFP` | DB 엔진이 원자적으로 중복 강제. 가장 간단 |
| 마이크로서비스 간 | `Idempotency Key + Saga + Outbox` | 분산 트랜잭션 불가 환경에서 최선의 일관성 |
| 분산 시스템 (성능 우선) | `Redis SETNX / Redlock` | 밀리초 단위 락 획득. 높은 처리량 |
| 분산 시스템 (정확성 우선) | `etcd / ZooKeeper` | Linearizability 보장. CP 시스템 |
| API 동시 요청 | `Idempotency Key + DB atomic UPDATE` | 중복 방지 + 원자적 상태 변경 결합 |
| Rate Limiting | `Redis Lua Script` | 카운터 확인 + 증가를 단일 원자적 Lua 실행 |
| 스마트 컨트랙트 | `Checks-Effects-Interactions + ReentrancyGuard` | 재진입 방지의 표준 패턴. OpenZeppelin 라이브러리 제공 |

---

## 9. 실전 베스트 프랙티스

### 설계 원칙

TOCTOU를 구조적으로 방지하기 위한 4대 설계 원칙:

| # | 원칙 | 설명 | 적용 |
|---|------|------|------|
| 1 | **EAFP (Ask Forgiveness, Not Permission)** | 사전 조건 확인(Check) 없이 바로 시도(Use)한 후, 실패 시 예외/에러를 처리한다 | 파일 존재 확인 대신 바로 open() 후 ENOENT 처리 |
| 2 | **Atomic Operation 우선** | Check와 Use를 하나의 원자적 연산으로 결합한다. gap 자체를 제거 | `O_CREAT\|O_EXCL`, `UPDATE ... WHERE`, CAS |
| 3 | **"Don't Check, Just Do"** | 이름 기반 API 대신 fd(file descriptor) 기반 API를 사용한다 | `fstat(fd)` > `stat(path)`, `fchmod(fd)` > `chmod(path)` |
| 4 | **Idempotent Operation 설계** | 같은 연산을 여러 번 수행해도 결과가 동일하도록 설계한다. 재시도가 안전해짐 | Idempotency Key, `INSERT ON CONFLICT`, 결정론적 ID |

### 언어별 베스트 프랙티스

#### Java

```java
// 1. synchronized — 간단한 임계 구역 보호
public synchronized void transfer(Account from, Account to, int amount) {
    if (from.getBalance() >= amount) {
        from.debit(amount);
        to.credit(amount);
    }
}

// 2. AtomicReference — 락 없는 CAS
AtomicReference<Config> config = new AtomicReference<>(initialConfig);
config.compareAndSet(expectedOld, newConfig);

// 3. ConcurrentHashMap.computeIfAbsent() — 원자적 conditional insert
cache.computeIfAbsent(key, k -> expensiveComputation(k));

// 4. JPA @Version — Optimistic Locking
@Entity
public class Account {
    @Version
    private Long version;  // JPA가 자동으로 CAS 수행
    private BigDecimal balance;
}

// 5. @Transactional(isolation = SERIALIZABLE) — 최강 격리 수준
@Transactional(isolation = Isolation.SERIALIZABLE)
public void criticalOperation() { /* ... */ }
```

#### Python

```python
# 1. threading.Lock — 멀티스레드 보호
import threading
lock = threading.Lock()
with lock:
    # Check와 Use가 락 안에서 원자적으로 실행
    if resource.is_available():
        resource.use()

# 2. asyncio.Lock — 비동기 환경
import asyncio
lock = asyncio.Lock()
async with lock:
    balance = await get_balance(account_id)
    if balance >= amount:
        await deduct(account_id, amount)

# 3. os.open() with O_CREAT|O_EXCL — 파일 원자적 생성
import os
try:
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
except FileExistsError:
    pass  # EAFP: 이미 존재 시 처리

# 4. EAFP 패턴 — Check 없이 시도
# 나쁨 (LBYL):
if os.path.exists(filepath):
    with open(filepath) as f:
        data = f.read()

# 좋음 (EAFP):
try:
    with open(filepath) as f:
        data = f.read()
except FileNotFoundError:
    data = default_value
```

#### Go

```go
// 1. sync.Mutex — 표준 락
var mu sync.Mutex
mu.Lock()
defer mu.Unlock()
if balance >= amount {
    balance -= amount
}

// 2. sync/atomic — CAS
var counter int64
atomic.CompareAndSwapInt64(&counter, expected, newVal)

// 3. Channel 직렬화 — Go 관용구
type request struct {
    amount int
    result chan error
}
// 단일 goroutine이 채널에서 요청을 순서대로 처리
go func() {
    for req := range requests {
        if balance >= req.amount {
            balance -= req.amount
            req.result <- nil
        } else {
            req.result <- ErrInsufficientFunds
        }
    }
}()

// 4. os.OpenFile with O_CREATE|O_EXCL
f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
if errors.Is(err, os.ErrExist) {
    // 파일 이미 존재
}
```

#### Rust

```rust
// Rust의 ownership 시스템이 컴파일 타임에 data race를 방지한다.
// &mut 참조는 동시에 하나만 존재할 수 있다.

// 1. Mutex<T> — 타입 시스템과 통합된 락
use std::sync::Mutex;
let balance = Mutex::new(1000u64);
{
    let mut b = balance.lock().unwrap();
    if *b >= amount {
        *b -= amount;
    }
} // MutexGuard 드롭 시 자동 unlock

// 2. AtomicU64 — 락 프리 원자적 연산
use std::sync::atomic::{AtomicU64, Ordering};
let counter = AtomicU64::new(0);
counter.fetch_add(1, Ordering::SeqCst);

// 3. OpenOptions::create_new() — 원자적 파일 생성
use std::fs::OpenOptions;
let file = OpenOptions::new()
    .write(true)
    .create_new(true)  // O_CREAT | O_EXCL
    .open("data.txt")?;
```

#### C/C++

```c
/* C: 파일 시스템 TOCTOU 방지 */

// 1. O_CREAT|O_EXCL — 원자적 생성
int fd = open(path, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW, 0600);
if (fd == -1 && errno == EEXIST) {
    /* 이미 존재 */
}

// 2. fd 기반 API — 이름 기반 대신 사용
int fd = open(path, O_RDONLY | O_NOFOLLOW);
struct stat st;
fstat(fd, &st);      // stat(path, &st) 대신
fchmod(fd, 0600);    // chmod(path, 0600) 대신
fchown(fd, uid, gid); // chown(path, uid, gid) 대신

// 3. mkstemp() — 안전한 임시 파일
char template[] = "/tmp/myapp.XXXXXX";
int fd = mkstemp(template);  // 이름 생성 + 열기 원자적
/* 사용 후 */
unlink(template);
close(fd);
```

```cpp
// C++: 멀티스레드 TOCTOU 방지

// 1. std::mutex
#include <mutex>
std::mutex mtx;
{
    std::lock_guard<std::mutex> lock(mtx);
    if (balance >= amount) {
        balance -= amount;
    }
}

// 2. std::atomic — CAS
#include <atomic>
std::atomic<int> counter{0};
int expected = counter.load();
while (!counter.compare_exchange_weak(expected, expected + 1)) {
    // CAS 실패 시 expected가 현재 값으로 갱신됨
}

// 3. C11 fopen("wx") — 배타적 생성 모드
FILE *f = fopen("data.txt", "wx");  // C11: x = O_EXCL
if (f == NULL && errno == EEXIST) {
    /* 이미 존재 */
}
```

#### JavaScript/Node.js

```javascript
// Node.js는 단일 스레드이지만 await 사이에 TOCTOU가 발생한다!

// 나쁨: await 사이에 다른 요청이 상태 변경
async function withdraw(userId, amount) {
    const balance = await db.getBalance(userId);  // CHECK
    // --- 여기서 다른 요청이 balance 변경 가능 ---
    if (balance >= amount) {
        await db.setBalance(userId, balance - amount);  // USE
    }
}

// 좋음: DB 원자 연산으로 위임
async function withdraw(userId, amount) {
    const result = await db.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
        [amount, userId]
    );
    if (result.rowCount === 0) {
        throw new InsufficientFundsError();
    }
}

// 좋음: async-mutex (인메모리 상태 보호 시)
import { Mutex } from 'async-mutex';
const mutex = new Mutex();
const release = await mutex.acquire();
try {
    // 원자적 실행 보장
    const balance = getBalance();
    if (balance >= amount) {
        setBalance(balance - amount);
    }
} finally {
    release();
}
```

---

## 10. 함정과 안티패턴

TOCTOU 방어에서 흔히 범하는 실수와 안티패턴을 정리한다.

| # | 안티패턴 | 위험성 | 올바른 접근 |
|---|---------|--------|------------|
| 1 | **Check와 Use 사이에 `await`/`yield`** | event loop에 제어를 반환하여 다른 코루틴이 공유 상태를 변경할 수 있다. 단일 스레드 환경에서도 TOCTOU 발생 | DB 원자 연산으로 위임하거나, async-mutex로 임계 구역 보호 |
| 2 | **`os.path.exists()` → `open()`** | 두 syscall 사이에 파일이 생성/삭제/교체될 수 있다 | EAFP: `try: open() except FileNotFoundError` |
| 3 | **`SELECT` → `INSERT` (unique constraint 없이)** | 동시에 두 트랜잭션이 SELECT 통과 → 중복 INSERT | UNIQUE 제약 + `INSERT ON CONFLICT` |
| 4 | **분산 락 타임아웃 후 작업 계속** | 락 만료 후 다른 프로세스가 같은 리소스를 수정 중. stale write 발생 | Fencing Token으로 stale write 감지/거부 |
| 5 | **락 순서 불일치** | 프로세스 A가 락1→락2, 프로세스 B가 락2→락1 순서로 획득 시 **데드락** | 모든 코드 경로에서 동일한 락 획득 순서 강제 |
| 6 | **Read-Modify-Write without lock** | `read(x)` → `x = x + 1` → `write(x)` 세 단계 사이에 다른 스레드가 개입 | `atomic.fetch_add()` 또는 락으로 보호 |
| 7 | **Double-Checked Locking 잘못 구현** | `volatile`(Java) 또는 `std::atomic`(C++) 없이 구현 시 부분 초기화된 객체가 다른 스레드에 노출 (CWE-609) | Java: `volatile` 필수. C++11: `std::call_once`. 또는 holder 패턴 |
| 8 | **`access()` → `fopen()`** | real UID로 Check, effective UID로 Use. setuid 환경에서 권한 상승 | `open()` + `fstat(fd)`, 또는 setuid 제거 |
| 9 | **캐시된 토큰으로 권한 체크** | 캐시 TTL 내에 권한이 변경되어도 반영되지 않음. 퇴사자가 수 분간 접근 유지 | 중요 연산은 원본(DB/IdP)에서 재검증. 캐시 TTL 최소화 |
| 10 | **클라이언트 사이드만 동시성 체크** | 클라이언트 검증은 우회 가능. `curl`/Postman으로 직접 API 호출 | **서버에서 반드시 재검증.** 클라이언트 검증은 UX 용도만 |
| 11 | **`sleep()`으로 race condition "해결"** | 타이밍 창(window)을 변경할 뿐, race를 제거하지 못한다. 부하에 따라 다시 발생 | 원자적 연산 또는 적절한 동기화 메커니즘 사용 |

### 안티패턴 코드 예시

```python
# 안티패턴 #1: await 사이의 TOCTOU (Python asyncio)
async def apply_coupon(coupon_id, order_id):
    coupon = await db.get_coupon(coupon_id)       # CHECK
    # --- 이 지점에서 다른 요청이 같은 쿠폰 사용 가능 ---
    if not coupon.is_used:                         # CHECK 결과 사용
        await db.mark_coupon_used(coupon_id)       # USE
        await db.apply_discount(order_id, coupon.discount)
    # 결과: 같은 쿠폰이 두 번 적용될 수 있음
```

```python
# 수정: DB 원자 연산
async def apply_coupon(coupon_id, order_id):
    result = await db.execute(
        "UPDATE coupons SET is_used = TRUE WHERE id = $1 AND is_used = FALSE RETURNING discount",
        [coupon_id]
    )
    if result.rowcount == 1:
        await db.apply_discount(order_id, result[0]['discount'])
    else:
        raise CouponAlreadyUsedError()
```

---

## 11. TOCTOU 취약 패턴 및 수정 코드

실무에서 흔히 발생하는 7가지 TOCTOU 패턴과 그 수정 방법을 코드와 함께 제시한다.

### 패턴 1: 파일 시스템 — access() → open()

**취약 코드 (C):**

```c
#include <unistd.h>
#include <fcntl.h>

void write_log(const char *path, const char *data) {
    /* CHECK: real UID로 쓰기 권한 확인 */
    if (access(path, W_OK) == 0) {
        /* ---- 취약 창: 공격자가 path를 /etc/shadow symlink로 교체 ---- */

        /* USE: effective UID(root)로 파일 열기 */
        int fd = open(path, O_WRONLY | O_APPEND);
        write(fd, data, strlen(data));
        close(fd);
    }
}
```

**공격 시나리오:**

```bash
# 공격자 (일반 사용자)
$ ln -sf /etc/shadow /tmp/logfile   # access() 후 open() 전에 실행
# setuid 프로그램이 /etc/shadow에 데이터를 쓰게 됨
```

**수정 코드 (C):**

```c
#include <fcntl.h>
#include <sys/stat.h>

void write_log(const char *path, const char *data) {
    /* O_NOFOLLOW: symlink이면 ELOOP 오류 */
    /* O_CREAT|O_EXCL: 원자적 생성 (이미 존재하면 실패) */
    int fd = open(path, O_WRONLY | O_APPEND | O_NOFOLLOW, 0600);
    if (fd == -1) {
        perror("open");
        return;
    }

    /* fd 기반으로 소유자/권한 확인 (이름 기반 race 없음) */
    struct stat st;
    fstat(fd, &st);
    if (st.st_uid != getuid() || !S_ISREG(st.st_mode)) {
        close(fd);
        return;  /* 소유자 불일치 또는 정규 파일 아님 */
    }

    write(fd, data, strlen(data));
    close(fd);
}
```

### 패턴 2: 인증/인가 — 권한 체크 → 작업

**취약 코드 (Python/SQL):**

```python
async def delete_document(user_id, doc_id):
    # CHECK: 권한 확인
    doc = await db.fetchone(
        "SELECT owner_id FROM documents WHERE id = $1", [doc_id]
    )
    if doc['owner_id'] != user_id:
        raise PermissionError("Not the owner")

    # ---- 취약 창: 관리자가 이 시점에 소유자를 변경할 수 있음 ----
    # 또는: 소유자가 변경되었지만 이전 Check 결과로 삭제 진행

    # USE: 삭제 실행
    await db.execute("DELETE FROM documents WHERE id = $1", [doc_id])
```

**수정 코드 (Python/SQL):**

```python
async def delete_document(user_id, doc_id):
    # Check + Use를 단일 트랜잭션 + FOR UPDATE로 원자적 처리
    async with db.transaction():
        doc = await db.fetchone(
            "SELECT owner_id FROM documents WHERE id = $1 FOR UPDATE",
            [doc_id]
        )
        if doc is None:
            raise NotFoundError()
        if doc['owner_id'] != user_id:
            raise PermissionError("Not the owner")
        # FOR UPDATE 락이 유지된 상태에서 삭제
        await db.execute("DELETE FROM documents WHERE id = $1", [doc_id])
```

### 패턴 3: 재고/잔액 — SELECT balance → UPDATE

**취약 코드 (Java):**

```java
public void withdraw(long accountId, BigDecimal amount) {
    // CHECK
    BigDecimal balance = accountRepo.getBalance(accountId);

    // ---- 취약 창: 다른 스레드가 동시에 출금 처리 중 ----

    if (balance.compareTo(amount) >= 0) {
        // USE: 잔액 갱신
        accountRepo.setBalance(accountId, balance.subtract(amount));
        // 결과: 잔액이 음수가 될 수 있음 (이중 출금)
    }
}
```

**수정 코드 A — Pessimistic Locking (SQL):**

```sql
BEGIN;
    SELECT balance FROM accounts WHERE id = 123 FOR UPDATE;
    -- 락이 유지된 상태에서 조건 확인 + 갱신
    UPDATE accounts SET balance = balance - 100
        WHERE id = 123 AND balance >= 100;
COMMIT;
```

**수정 코드 B — Atomic UPDATE (권장):**

```sql
-- Check + Use를 단일 SQL 문으로 결합
UPDATE accounts
SET balance = balance - 100
WHERE id = 123 AND balance >= 100;

-- ROWCOUNT == 0이면 잔액 부족
```

```java
// Java 구현
@Transactional
public boolean withdraw(long accountId, BigDecimal amount) {
    int updated = jdbcTemplate.update(
        "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?",
        amount, accountId, amount
    );
    if (updated == 0) {
        throw new InsufficientFundsException();
    }
    return true;
}
```

### 패턴 4: 쿠폰/할인 — is_used 확인 → 적용

**취약 코드 (Python):**

```python
async def use_coupon(coupon_code, order_id):
    # CHECK
    coupon = await db.fetchone(
        "SELECT id, discount, is_used FROM coupons WHERE code = $1",
        [coupon_code]
    )

    if coupon['is_used']:
        raise CouponAlreadyUsedError()

    # ---- 취약 창: 동시에 2개의 요청이 여기에 도달 ----

    # USE
    await db.execute("UPDATE coupons SET is_used = TRUE WHERE id = $1", [coupon['id']])
    await db.execute(
        "UPDATE orders SET discount = $1 WHERE id = $2",
        [coupon['discount'], order_id]
    )
    # 결과: 같은 쿠폰이 두 번 적용됨
```

**수정 코드 (Python):**

```python
async def use_coupon(coupon_code, order_id):
    # Atomic UPDATE: is_used = FALSE인 경우에만 TRUE로 변경
    result = await db.fetchone(
        """UPDATE coupons
           SET is_used = TRUE
           WHERE code = $1 AND is_used = FALSE
           RETURNING id, discount""",
        [coupon_code]
    )

    if result is None:
        raise CouponAlreadyUsedError()

    # 쿠폰이 성공적으로 사용 처리된 후 할인 적용
    await db.execute(
        "UPDATE orders SET discount = $1 WHERE id = $2",
        [result['discount'], order_id]
    )
```

### 패턴 5: 예약 시스템 — 가용성 확인 → 예약

**취약 코드 (Java):**

```java
public Reservation bookRoom(Long roomId, LocalDate date) {
    // CHECK: 해당 날짜에 예약이 있는지 확인
    boolean available = reservationRepo.countByRoomAndDate(roomId, date) == 0;

    // ---- 취약 창: 다른 사용자가 동시에 같은 방 예약 ----

    if (available) {
        // USE: 예약 생성
        return reservationRepo.save(new Reservation(roomId, date));
        // 결과: 같은 방에 이중 예약
    }
    throw new RoomNotAvailableException();
}
```

**수정 코드 A — Unique Constraint + EAFP (권장):**

```sql
-- 테이블에 유니크 제약 추가
ALTER TABLE reservations ADD CONSTRAINT uq_room_date UNIQUE (room_id, date);
```

```java
public Reservation bookRoom(Long roomId, LocalDate date) {
    try {
        // EAFP: Check 없이 바로 INSERT 시도
        return reservationRepo.save(new Reservation(roomId, date));
    } catch (DataIntegrityViolationException e) {
        // DB가 중복을 원자적으로 거부
        throw new RoomNotAvailableException();
    }
}
```

**수정 코드 B — Optimistic Locking with Retry:**

```java
@Retryable(maxAttempts = 3, backoff = @Backoff(delay = 100))
@Transactional
public Reservation bookRoom(Long roomId, LocalDate date) {
    Room room = roomRepo.findByIdWithLock(roomId);  // @Version 기반
    if (room.isAvailable(date)) {
        room.addReservation(date);
        return roomRepo.save(room);  // version 불일치 시 OptimisticLockException
    }
    throw new RoomNotAvailableException();
}
```

### 패턴 6: 회원가입 — 중복 확인 → 생성

**취약 코드 (Python):**

```python
async def register(email, password):
    # CHECK: 이메일 중복 확인
    existing = await db.fetchone(
        "SELECT id FROM users WHERE email = $1", [email]
    )

    if existing:
        raise EmailAlreadyExistsError()

    # ---- 취약 창: 동시에 같은 이메일로 가입 시도 ----

    # USE: 사용자 생성
    hashed = hash_password(password)
    await db.execute(
        "INSERT INTO users (email, password) VALUES ($1, $2)",
        [email, hashed]
    )
    # 결과: 같은 이메일로 2개의 계정 생성
```

**수정 코드 (Python):**

```python
async def register(email, password):
    hashed = hash_password(password)
    try:
        # EAFP: Check 없이 바로 INSERT. UNIQUE 제약이 중복 방지
        await db.execute(
            """INSERT INTO users (email, password) VALUES ($1, $2)
               ON CONFLICT (email) DO NOTHING
               RETURNING id""",
            [email, hashed]
        )
    except UniqueViolationError:
        raise EmailAlreadyExistsError()
```

```sql
-- 전제: users 테이블에 UNIQUE 제약 필수
ALTER TABLE users ADD CONSTRAINT uq_email UNIQUE (email);
```

### 패턴 7: Rate Limiting — GET count → INCR

**취약 코드 (Python/Redis):**

```python
async def check_rate_limit(user_id, limit=100):
    key = f"rate:{user_id}"

    # CHECK: 현재 카운트 조회
    count = await redis.get(key)

    # ---- 취약 창: 동시 요청들이 모두 같은 count 값을 읽음 ----

    if count and int(count) >= limit:
        raise RateLimitExceeded()

    # USE: 카운트 증가
    await redis.incr(key)
    await redis.expire(key, 60)
    # 결과: limit=100인데 200개의 요청이 통과
```

**수정 코드 — Redis Lua Script (원자적 실행):**

```python
RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)

if current == 1 then
    redis.call('EXPIRE', key, window)
end

if current > limit then
    return 0  -- 거부
end

return 1  -- 허용
"""

async def check_rate_limit(user_id, limit=100, window=60):
    key = f"rate:{user_id}"
    # Lua 스크립트는 Redis에서 원자적으로 실행됨
    allowed = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, limit, window)
    if not allowed:
        raise RateLimitExceeded()
```

---

## 12. 탐지 도구와 마이그레이션

### 정적/동적 탐지 도구

| 도구 | 유형 | 언어 | TOCTOU 탐지 방식 | 비고 |
|------|------|------|-----------------|------|
| **Coverity** | 정적 분석 | C/C++/Java | TOCTOU checker. `stat()`→`fopen()`, `access()`→`open()` 등의 시퀀스 패턴 탐지 | 상용. 대규모 코드베이스에 적합. CI/CD 통합 |
| **CodeQL** | 정적 분석 | C/C++/Java/Python | `cpp/toctou-race-condition` 쿼리로 CWE-367 패턴 탐지. 데이터 플로우 분석 기반 | 오픈소스. GitHub Advanced Security 통합 |
| **Semgrep** | 정적 분석 | 다국어 | 규칙 기반으로 `access()`→`open()` 등의 패턴 매칭. 커스텀 규칙 작성 가능 | 오픈소스. 빠른 실행. 규칙 커뮤니티 활발 |
| **SonarQube** | 정적 분석 | C/C++/ObjC | Rule S5847로 TOCTOU 패턴 탐지 | 커뮤니티/상용. 다양한 언어 지원 |
| **ThreadSanitizer (TSan)** | 동적 분석 | C/C++/Go | happens-before 관계 추적으로 data race 탐지. `-fsanitize=thread` 컴파일 옵션 | GCC/Clang 내장. 런타임 2-15x 오버헤드 |
| **Helgrind** | 동적 분석 | C/C++ | Valgrind 기반 race detector. 락 순서 분석, data race 탐지 | 오픈소스. TSan보다 느리지만 더 정밀한 분석 |
| **RacerD** | 정적 분석 | Java/C/ObjC | Facebook Infer 기반. 소유권(ownership) 기반 race 탐지 | 오픈소스. CI 통합 용이 |
| **go vet -race** | 동적 분석 | Go | Go 런타임의 내장 race detector | Go 표준 도구체인 포함. `go test -race` |

### CodeQL 쿼리 예시

```ql
/**
 * @name TOCTOU race condition
 * @description Finds access() followed by open() on the same path
 * @kind path-problem
 * @problem.severity warning
 * @id cpp/toctou-race-condition
 * @tags security
 *       external/cwe/cwe-367
 */
import cpp
import semmle.code.cpp.dataflow.TaintTracking

from FunctionCall access, FunctionCall open
where
    access.getTarget().hasName("access") and
    open.getTarget().hasName("open") and
    // 같은 경로 변수를 사용하는지 확인
    access.getArgument(0).(VariableAccess).getTarget() =
        open.getArgument(0).(VariableAccess).getTarget()
select access, "TOCTOU: access() at $@ followed by open() at $@",
    access, access.getLocation().toString(),
    open, open.getLocation().toString()
```

### Semgrep 규칙 예시

```yaml
rules:
  - id: toctou-access-open
    patterns:
      - pattern: |
          access($PATH, ...);
          ...
          open($PATH, ...);
    message: >
      TOCTOU race condition: access() followed by open() on the same path.
      Use open() with O_NOFOLLOW and check with fstat() instead.
    severity: WARNING
    metadata:
      cwe: CWE-367
    languages: [c, cpp]
```

### 마이그레이션 패턴

기존 TOCTOU 취약 코드를 안전한 코드로 전환하는 전형적 패턴:

| 취약 패턴 | 안전한 패턴 | 마이그레이션 방법 |
|-----------|------------|------------------|
| `access()` → `open()` | `open(O_NOFOLLOW)` + `fstat(fd)` | access() 호출 제거, open() 플래그 추가, fstat()으로 검증 |
| `stat()` → `open()` | `open()` + `fstat(fd)` | stat() 호출 제거, open() 후 fd 기반 검증 |
| `mktemp()` → `open()` | `mkstemp()` | mktemp() → mkstemp()로 함수 교체 |
| `SELECT` → `INSERT` | `INSERT ON CONFLICT` + UNIQUE | UNIQUE 제약 추가, SELECT 제거, INSERT ON CONFLICT로 교체 |
| `SELECT` → `UPDATE` | `UPDATE ... WHERE condition` | SELECT+조건검사 제거, WHERE 절에 조건 통합 |
| `GET` → `SET` (Redis) | `Lua script` 또는 `WATCH/MULTI/EXEC` | GET+SET 시퀀스를 Lua 스크립트로 교체 |
| Distributed check → act | Idempotency Key + atomic operation | 멱등성 키 도입, 원자적 DB 연산으로 전환 |
| 2PC (Two-Phase Commit) | Saga + Transactional Outbox | 분산 트랜잭션을 로컬 트랜잭션 + 보상으로 분해 |

### 코드 리뷰 체크리스트

TOCTOU 취약점을 코드 리뷰에서 발견하기 위한 8가지 점검 항목:

| # | 점검 항목 | 확인 방법 |
|---|----------|-----------|
| 1 | **`access()`, `stat()`, `lstat()` 호출 후 같은 경로로 `open()` 호출하는가?** | 파일 이름 기반 함수 → fd 기반 함수 전환 필요 |
| 2 | **`SELECT` 결과를 기반으로 `INSERT`/`UPDATE`를 별도 쿼리로 실행하는가?** | 단일 쿼리로 결합하거나 FOR UPDATE 사용 |
| 3 | **`await`/`yield` 사이에 공유 상태를 확인 후 사용하는가?** | DB 원자 연산 또는 async-mutex 사용 |
| 4 | **분산 락의 타임아웃 후에도 작업을 계속하는가?** | Fencing Token 도입 |
| 5 | **캐시된 값으로 권한/자격을 확인하는가?** | 중요 연산은 원본에서 재검증 |
| 6 | **Read-Modify-Write가 원자적으로 수행되는가?** | Atomic 연산 또는 락 사용 |
| 7 | **임시 파일을 `mktemp()` + `open()`으로 생성하는가?** | `mkstemp()`로 교체 |
| 8 | **클라이언트 측에서만 동시성/중복 검증을 수행하는가?** | 서버 측 재검증 필수 |

---

## 13. 빅테크 실전 사례

### Google

#### Spanner TrueTime

Google Spanner는 TOCTOU의 **시간(time)** 차원을 인프라 레벨에서 해결한 사례다.

**문제:** 분산 데이터베이스에서 트랜잭션 타임스탬프의 불확실성이 race window를 생성한다. 노드 A에서의 Check 시각과 노드 B에서의 Use 시각이 정확히 비교 불가능하다.

**해법 — TrueTime API:**

| API | 반환값 | 용도 |
|-----|--------|------|
| `TT.now()` | `[earliest, latest]` 구간 | 현재 시각의 불확실성 범위 |
| `TT.after(t)` | boolean | 시각 t가 확실히 과거인지 |
| `TT.before(t)` | boolean | 시각 t가 확실히 미래인지 |

- GPS 수신기 + 원자 시계를 각 데이터센터에 배치하여 타임스탬프 **불확실성을 7ms 미만**으로 제한
- **Commit Wait:** 트랜잭션 커밋 시 불확실성 구간만큼 대기한 후 커밋 완료를 선언. 이로써 **외부 일관성(external consistency)**을 보장 — 커밋 순서가 실제 물리적 시간 순서와 일치
- race window를 **수학적으로 봉쇄**: 불확실성이 0에 수렴하면 gap도 0에 수렴

#### Chubby Lock Service

Google의 분산 락 서비스. 분산 환경에서 TOCTOU의 **stale write** 문제를 해결한다.

- **Sequencer 토큰:** 락 획득 시 단조증가하는 시퀀스 번호를 발급. 리소스 서버가 이전 시퀀스의 쓰기를 거부하여 **만료된 락의 stale write를 방지**
- **Lock-Delay:** 락 해제 후 일정 시간(기본 1분) 동안 새로운 클라이언트에게 락을 부여하지 않음. 네트워크 지연으로 인한 메시지 지연 공격을 방어

#### Zanzibar (권한 시스템)

Google의 전사적 인가(authorization) 시스템. 초당 수백만 건의 권한 체크를 처리한다.

**"New Enemy Problem":** 사용자 A의 권한을 제거한 직후, replication lag 동안 A가 다른 레플리카에서 여전히 접근 가능한 TOCTOU 문제.

**해법 — Zookie (Consistency Token):**
- 권한 변경 시 **Zookie**라는 일관성 토큰을 발급
- 이후 권한 체크 시 Zookie를 함께 전달하면, 시스템이 해당 Zookie 이후의 상태를 기반으로 판단
- "적어도 이 시점 이후의 상태를 보장"하는 **snapshot consistency** 제공
- replication lag으로 인한 TOCTOU 창을 논리적으로 제거

### Meta/Facebook

#### TAO (The Associations and Objects)

Facebook의 소셜 그래프를 위한 분산 데이터 저장소.

**TOCTOU 방어 전략:**
- **Leader 티어:** 모든 쓰기 요청을 특정 Leader 캐시 서버로 라우팅. Leader가 **쓰기를 직렬화(serialize)**하여 race condition 방지
- **버전 번호:** 객체마다 version을 유지. 캐시 무효화 시 version 비교로 stale data 감지
- **Thundering Herd 방지:** 인기 객체의 캐시 만료 시 수천 요청이 동시에 DB 조회하는 문제. "lease" 메커니즘으로 한 요청만 DB 접근 허용

#### 캐시 일관성 시스템

**문제:** Facebook 규모(수십억 사용자)에서 캐시와 DB 사이의 일관성 유지. 캐시 무효화의 TOCTOU.

**해법:**
- **Polaris 관측 시스템:** 캐시 불일치를 실시간 모니터링. 불일치 발견 시 자동 무효화
- **Consistency Tracing Library:** 모든 읽기/쓰기에 추적 컨텍스트를 부여하여 인과 관계 추적
- **결과:** 캐시 일관성을 **6-nines(99.9999%)에서 10-nines(99.99999999%)**로 향상

### Amazon/AWS

#### DynamoDB

| 기능 | TOCTOU 방어 방식 |
|------|-----------------|
| **Conditional Writes** | `ConditionExpression`으로 Check+Write를 단일 원자적 연산으로 결합. `attribute_exists()`, `attribute_not_exists()`, 비교 연산자 지원 |
| **Optimistic Locking** | `version` 속성 + `ConditionExpression: version = :expected`. 충돌 시 `ConditionalCheckFailedException` |
| **Transaction** | `TransactWriteItems`로 최대 100개 항목을 원자적으로 처리 |

```python
# DynamoDB Conditional Write 예시
table.update_item(
    Key={'id': order_id},
    UpdateExpression='SET #status = :new_status, version = version + :one',
    ConditionExpression='#status = :expected_status AND version = :expected_version',
    ExpressionAttributeNames={'#status': 'status'},
    ExpressionAttributeValues={
        ':new_status': 'confirmed',
        ':expected_status': 'pending',
        ':expected_version': current_version,
        ':one': 1
    }
)
```

#### S3

- **2020년 12월:** Amazon S3가 **strong read-after-write consistency**로 전환
- 이전: 최종 일관성(eventual consistency)으로 인해 PUT 직후 GET이 이전 버전을 반환하는 TOCTOU 발생
- 이후: PUT 완료 직후 GET이 반드시 최신 데이터를 반환. **추가 비용이나 성능 저하 없이** 달성

#### SQS FIFO

- **MessageDeduplicationId:** 동일 메시지의 5분 내 중복 전송을 원자적으로 거부
- 프로듀서의 재시도로 인한 중복 처리(TOCTOU의 메시지 큐 변형)를 방지

### Netflix

#### EVCache

Netflix의 분산 캐시 시스템. Memcached 기반.

**TOCTOU 방어:**
- **3-AZ 동기 쓰기:** 3개 가용 영역(AZ)에 동시에 쓰기. 어떤 AZ에서 읽어도 최신 데이터 보장
- **Kafka + CDC(Change Data Capture):** DB 변경 이벤트를 Kafka로 전파하여 캐시 무효화. 폴링 기반의 TOCTOU 창을 이벤트 기반으로 축소
- **Moneta:** 데이터 정합성 검증 시스템. 캐시와 DB 간 불일치를 지속적으로 탐지

#### Zuul (API Gateway)

- **Origin Concurrency Protection:** 백엔드 서비스별 동시 연결 수 제한. 제한 초과 시 즉시 거부하여 race condition 하의 과부하 방지
- **Per-host 연결 풀:** 호스트별로 격리된 연결 풀 운영. 한 호스트의 지연이 다른 호스트에 영향 미치지 않도록 격리

### Uber

#### Ringpop

Uber의 분산 애플리케이션 프레임워크.

**핵심 아이디어:** **Consistent Hashing**으로 각 엔티티(라이드, 드라이버 등)에 **단일 소유 노드(owner node)**를 할당. 해당 엔티티에 대한 **모든 연산이 소유 노드에서 직렬화**된다.

```
요청 A (드라이버 매칭) ──→ Hash(ride_123) ──→ 노드 7 (소유자)
요청 B (드라이버 매칭) ──→ Hash(ride_123) ──→ 노드 7 (소유자)
                                                    │
                                              직렬화 실행 → race 없음
```

**효과:** 분산 락 없이도 **구조적으로 race condition을 제거**한다. 노드 장애 시 consistent hashing으로 소유권이 자동 이전된다.

#### Gulfstream 결제 시스템

결제 시스템에서의 이중 결제(double charge)는 TOCTOU의 가장 심각한 실제 피해를 초래한다.

**Uber의 방어 전략:**
- **결정론적 고유 ID:** 결제 요청마다 클라이언트가 생성한 고유 ID. 서버가 ID 기반으로 중복 감지
- **이중 장부(복식부기):** 모든 금액 이동을 차변(debit)과 대변(credit)으로 기록. 합계가 항상 0이어야 함. 불일치 시 즉시 알림
- **버전 기반 직렬화:** 잔액 변경 시 version 비교로 TOCTOU 방지

#### Cadence/Temporal (워크플로우 엔진)

- **이벤트 소싱(Event Sourcing):** 워크플로우의 모든 상태 변경을 이벤트로 기록. 현재 상태는 이벤트 재생으로 결정
- TOCTOU가 원천적으로 불가능: "상태를 읽고 변경"하는 대신 **"이벤트를 추가"**하는 모델. 이벤트는 append-only이므로 race condition이 발생할 수 없다

### Stripe

#### Idempotency Keys

Stripe은 결제 API의 TOCTOU를 **Idempotency Key** 패턴으로 해결한 업계 표준을 정립했다.

**아키텍처:**

| 구성요소 | 역할 |
|---------|------|
| **Idempotency Key** | 클라이언트가 생성한 UUID. 요청 헤더로 전달 |
| **Recovery Point** | 연산의 현재 진행 상태를 나타내는 상태 기계 |
| **Enqueuer** | 작업을 큐에 등록 |
| **Completer** | 완료된 작업의 결과를 캐시 |
| **Reaper** | 실패/중단된 작업을 정리 |

**핵심 — PostgreSQL SERIALIZABLE:**

```sql
-- Stripe의 idempotency key 처리 (간략화)
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. 기존 키 조회 (있으면 캐시된 응답 반환)
SELECT * FROM idempotency_keys WHERE key = $1;

-- 2. 없으면 새 키 삽입 + 작업 시작
INSERT INTO idempotency_keys (key, status, request_params)
VALUES ($1, 'started', $2);

-- 3. Recovery point 진행
UPDATE idempotency_keys SET recovery_point = 'charge_created' WHERE key = $1;

-- 4. 작업 완료
UPDATE idempotency_keys SET status = 'completed', response = $2 WHERE key = $1;

COMMIT;
```

같은 Idempotency Key로 재요청이 오면, 이전에 캐시된 응답을 그대로 반환한다. 네트워크 재시도가 안전해진다.

#### Airbnb Orpheus

Airbnb의 결제 시스템 Orpheus도 유사한 접근법을 사용한다.

- **DB row-level lock 기반 idempotency:** 결제 요청의 고유 키를 DB 행으로 관리. `SELECT FOR UPDATE`로 동일 키의 동시 처리를 직렬화
- 한 번에 하나의 프로세스만 특정 결제 요청을 처리할 수 있도록 보장

### Twitter/X

#### Snowflake ID

분산 환경에서 고유 ID를 생성하는 시스템. ID 충돌이라는 TOCTOU 변형을 해결한다.

**구조:**

```
0 - 00000000 00000000 00000000 00000000 00000000 0 - 00000 - 00000 - 000000000000
│              41 bits (timestamp)                   5bits   5bits    12 bits
│                                                   DC ID  Worker   Sequence
sign bit                                                    ID
```

**TOCTOU 방어:**
- **ZooKeeper로 머신 ID 원자적 할당:** 각 워커의 고유 ID를 ZooKeeper의 ephemeral sequential 노드로 할당. 중복 할당 불가
- **시계 역행(clock regression) 시 ID 생성 거부:** 시계가 뒤로 갔음을 감지하면 ID 생성을 중단. 시간 기반 순서 보장이 깨지는 것을 방지

### 블록체인

#### DAO Hack (2016)

블록체인에서의 TOCTOU — Reentrancy 공격의 가장 유명한 사례.

**배경:** The DAO는 Ethereum 기반의 분산 투자 펀드. 약 $150M의 ETH를 보유.

**공격 메커니즘:**

```solidity
// 취약한 The DAO 코드 (간략화)
function withdraw(uint amount) public {
    // CHECK: 잔액 확인
    require(balances[msg.sender] >= amount);

    // USE: 송금 실행 (외부 호출)
    msg.sender.call{value: amount}("");
    // ↑ 여기서 공격자의 receive() 함수가 호출됨
    // 공격자의 receive()가 다시 withdraw()를 호출 (재진입!)
    // 아래 줄이 실행되기 전에 반복 출금 발생

    // 잔액 차감 (재진입 공격 시 이 줄에 도달하지 않음)
    balances[msg.sender] -= amount;
}
```

**결과:**
- **$60M 상당의 ETH 탈취**
- Ethereum 커뮤니티 분열 → **하드포크**: ETH (포크 찬성) / ETC (포크 반대)
- 스마트 컨트랙트 보안의 패러다임 전환

**교훈 — Checks-Effects-Interactions (CEI) 패턴:**

```solidity
// 안전한 코드: CEI 패턴 + ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SafeVault is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external nonReentrant {
        // 1. Checks — 조건 확인
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // 2. Effects — 상태 변경 (외부 호출 전!)
        balances[msg.sender] -= amount;

        // 3. Interactions — 외부 호출 (상태가 이미 변경된 후)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

### 실제 보안 사건 종합

| 사건 | 연도 | 유형 | 영향 | TOCTOU 패턴 |
|------|------|------|------|------------|
| Sendmail /tmp race | 1980s | 파일 시스템 | 로컬 권한 상승 | mktemp() → open() |
| Sendmail 시그널 핸들러 | 2006 | 시그널 race | 원격 코드 실행 | 시그널 핸들러 내 비원자적 상태 변경 |
| Dirty COW | 2016 | 커널 메모리 | 모든 Linux 루트 접근 | madvise() vs write() race |
| DAO Hack | 2016 | 스마트 컨트랙트 | $60M ETH 탈취 | Reentrancy = Check → 외부 호출 → Use 전에 재진입 |
| Docker cp | 2018 | 컨테이너 | 호스트 파일 시스템 접근 | symlink race |
| Nimbuspwn | 2022 | systemd | Linux root 권한 | directory traversal + symlink race |
| Tesla Pwn2Own | 2023 | 자동차 | 게이트웨이 침해 | 구체적 미공개. TOCTOU 기반 |
| Docker BuildKit | 2024 | 컨테이너 | 컨테이너 탈출 | mount cache race |
| AWS DynamoDB | 2025 | 분산 시스템 | US-EAST-1 대규모 장애 | DNS 관리 TOCTOU |
| Starbucks 기프트카드 | 2015 | 웹 API | 잔액 무한 증식 | 잔액 확인 → 이체 사이의 race |

---

## 14. 빅테크 공통 패턴 요약

빅테크들의 TOCTOU 방어 전략을 분석하면, 세 가지 핵심 철학으로 수렴한다.

### 세 가지 철학

#### 철학 1: 시간을 인프라로 (Make Time Infrastructure)

| 기업 | 시스템 | 접근법 |
|------|--------|--------|
| Google | Spanner TrueTime | GPS + 원자 시계로 시간 불확실성을 **7ms 미만**으로. Commit Wait로 외부 일관성 보장 |
| Google | Zanzibar Zookie | 일관성 토큰으로 replication lag의 TOCTOU 창을 논리적 제거 |

**핵심:** race window가 "시간 간격"이라면, 시간 자체를 정밀하게 제어하여 **window를 수학적으로 0에 수렴**시킨다. 가장 근본적인 해법이지만, 인프라 투자가 막대하다.

#### 철학 2: 원자적 연산으로 Gap 제거 (Atomic Operations)

| 기업 | 시스템 | 접근법 |
|------|--------|--------|
| Amazon | DynamoDB Conditional Writes | ConditionExpression으로 Check+Write 원자적 결합 |
| Stripe | Idempotency Keys | PostgreSQL SERIALIZABLE + Recovery Point 상태 기계 |
| Airbnb | Orpheus | DB row-level lock 기반 idempotency |
| Amazon | S3 Strong Consistency | Read-after-Write 일관성으로 GET/PUT 간 race 제거 |
| Meta | TAO version numbers | 버전 기반 캐시 일관성 |

**핵심:** Check와 Use 사이의 Gap을 **단일 원자적 연산으로 결합**하여 제거한다. 가장 범용적이고 실용적인 접근법이다.

#### 철학 3: 소유권으로 직렬화 (Ownership Serialization)

| 기업 | 시스템 | 접근법 |
|------|--------|--------|
| Uber | Ringpop | Consistent hashing으로 엔티티별 **단일 소유 노드**. 분산 락 불필요 |
| Google | Chubby | Sequencer 토큰으로 소유권 증명. stale write 방지 |
| Meta | TAO Leader | 쓰기를 Leader 노드에서 **직렬화** |
| Twitter | Snowflake | ZooKeeper로 워커 ID **원자적 할당** |

**핵심:** 리소스에 대한 **소유권(ownership)**을 단일 엔티티에 부여하고, 해당 엔티티가 모든 연산을 **직렬(serial)**로 처리한다. 분산 환경에서 락의 복잡성을 제거하는 구조적 해법이다.

### 공통 패턴 비교

| 철학 | 강점 | 약점 | 적합한 상황 |
|------|------|------|------------|
| 시간을 인프라로 | 가장 근본적. 시간 기반 race 완전 제거 | 막대한 인프라 투자. Google 규모에서만 현실적 | 전역 시간 순서가 필수인 분산 DB |
| 원자적 연산 | 범용적. 대부분의 언어/DB에서 즉시 적용 | 복잡한 비즈니스 로직의 원자화 어려움 | 단일 DB, API, 대부분의 웹 서비스 |
| 소유권 직렬화 | 분산 락 불필요. 구조적 해결 | 소유 노드 장애 시 처리 복잡. 핫스팟 가능 | 엔티티 기반 분산 시스템, 마이크로서비스 |

---

## 15. References

### 학술 논문

| # | 참조 |
|---|------|
| 1 | [Checking for Race Conditions in File Accesses - Matt Bishop, Michael Dilger (1996)](https://nob.cs.ucdavis.edu/bishop/papers/1996-compsys/racecond.pdf) |
| 2 | [Dynamic Detection and Prevention of Race Conditions in File Accesses - Tsyrklevich & Yee (USENIX Security 2003)](https://www.usenix.org/conference/12th-usenix-security-symposium/dynamic-detection-and-prevention-race-conditions-file) |
| 3 | [Fixing Races for Fun and Profit: How to Abuse atime - Dean & Hu (USENIX Security 2004)](https://www.usenix.org/conference/13th-usenix-security-symposium/fixing-races-fun-and-profit-how-abuse-atime) |
| 4 | [TOCTTOU Vulnerabilities in UNIX-Style File Systems: An Anatomical Study - Wei & Pu (USENIX FAST 2005)](https://www.usenix.org/conference/fast-05/tocttou-vulnerabilities-unix-style-file-systems-anatomical-study) |
| 5 | [Portably Preventing File Race Attacks with User-Mode Path Resolution - Tsafrir, Herber, Wagner (USENIX ATC 2008)](https://www.usenix.org/conference/2008-usenix-annual-technical-conference/portably-preventing-file-race-attacks-user-mode) |
| 6 | [Bugs as Deviant Behavior: A General Approach to Inferring Errors in Systems Code (RacerX) - Engler et al. (SOSP 2003)](https://dl.acm.org/doi/10.1145/945445.945468) |
| 7 | [Protection and the Control of Information Sharing in Multics - Saltzer (CACM 1974)](https://dl.acm.org/doi/10.1145/361011.361067) |
| 8 | [Zanzibar: Google's Consistent, Global Authorization System - Pang et al. (USENIX ATC 2019)](https://www.usenix.org/conference/atc19/presentation/pang) |
| 9 | [Spanner: Google's Globally Distributed Database - Corbett et al. (OSDI 2012)](https://research.google/pubs/spanner-googles-globally-distributed-database/) |
| 10 | [TAO: Facebook's Distributed Data Store for the Social Graph - Bronson et al. (USENIX ATC 2013)](https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson) |

### 공식 표준/분류

| # | 참조 |
|---|------|
| 1 | [CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition - MITRE](https://cwe.mitre.org/data/definitions/367.html) |
| 2 | [CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization - MITRE](https://cwe.mitre.org/data/definitions/362.html) |
| 3 | [CWE-363: Race Condition Enabling Link Following - MITRE](https://cwe.mitre.org/data/definitions/363.html) |
| 4 | [CWE-609: Double-Checked Locking - MITRE](https://cwe.mitre.org/data/definitions/609.html) |
| 5 | [FIO01-C: Be careful using functions that use file names for identification - CERT](https://wiki.sei.cmu.edu/confluence/display/c/FIO01-C.+Be+careful+using+functions+that+use+file+names+for+identification) |
| 6 | [FIO45-C: Avoid TOCTOU race conditions while accessing files - CERT](https://wiki.sei.cmu.edu/confluence/display/c/FIO45-C.+Avoid+TOCTOU+race+conditions+while+accessing+files) |
| 7 | [POS35-C: Avoid race conditions while checking for the existence of a symbolic link - CERT](https://wiki.sei.cmu.edu/confluence/display/c/POS35-C.+Avoid+race+conditions+while+checking+for+the+existence+of+a+symbolic+link) |

### 빅테크 엔지니어링 블로그

| # | 참조 |
|---|------|
| 1 | [Spanner, TrueTime and the CAP Theorem - Eric Brewer, Google (2017)](https://research.google/pubs/spanner-truetime-and-the-cap-theorem/) |
| 2 | [The Chubby Lock Service for Loosely-Coupled Distributed Systems - Mike Burrows, Google (OSDI 2006)](https://research.google/pubs/the-chubby-lock-service-for-loosely-coupled-distributed-systems/) |
| 3 | [Scaling Memcache at Facebook - Nishtala et al. (NSDI 2013)](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala) |
| 4 | [Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service (USENIX ATC 2022)](https://www.usenix.org/conference/atc22/presentation/elhemali) |
| 5 | [Implementing Stripe-like Idempotency Keys in Postgres - Brandur Leach](https://brandur.org/idempotency-keys) |
| 6 | [EVCache: Distributed In-Memory Data Store at Netflix - Netflix Tech Blog](https://netflixtechblog.com/evolution-of-the-netflix-data-pipeline-da246ca36905) |
| 7 | [Ringpop: Scalable, fault-tolerant application-layer sharding - Uber Engineering](https://eng.uber.com/ringpop-open-source-nodejs-library/) |
| 8 | [Snowflake ID - Twitter/X Engineering (Original Blog Post)](https://blog.twitter.com/engineering/en_us/a/2010/announcing-snowflake) |
| 9 | [Avoiding Double Payments in a Distributed Payments System - Uber Engineering](https://eng.uber.com/distributed-payments/) |
| 10 | [Temporal: Open Source Durable Execution Platform](https://temporal.io/blog) |

### 보안 권고/CVE

| # | 참조 |
|---|------|
| 1 | [CVE-2016-5195 (Dirty COW) - NVD](https://nvd.nist.gov/vuln/detail/CVE-2016-5195) |
| 2 | [CVE-2018-15664 (Docker cp) - NVD](https://nvd.nist.gov/vuln/detail/CVE-2018-15664) |
| 3 | [CVE-2022-29799 (Nimbuspwn) - Microsoft Security Blog](https://www.microsoft.com/en-us/security/blog/2022/04/26/microsoft-finds-new-elevation-of-privilege-linux-vulnerability-nimbuspwn/) |
| 4 | [CVE-2022-29800 (Nimbuspwn) - NVD](https://nvd.nist.gov/vuln/detail/CVE-2022-29800) |
| 5 | [CVE-2024-23651 (Docker BuildKit) - NVD](https://nvd.nist.gov/vuln/detail/CVE-2024-23651) |
| 6 | [CVE-2006-0058 (Sendmail) - NVD](https://nvd.nist.gov/vuln/detail/CVE-2006-0058) |
| 7 | [Analysis of the DAO Exploit - Phil Daian (2016)](https://hackingdistributed.com/2016/06/18/analysis-of-the-dao-exploit/) |
| 8 | [Pwn2Own Vancouver 2023 Results - Zero Day Initiative](https://www.zerodayinitiative.com/blog/2023/3/22/pwn2own-vancouver-2023-day-one-results) |

### 도구/라이브러리 문서

| # | 참조 |
|---|------|
| 1 | [CodeQL - TOCTOU Race Condition Query](https://codeql.github.com/codeql-query-help/cpp/cpp-toctou-race-condition/) |
| 2 | [ThreadSanitizer (TSan) - Clang Documentation](https://clang.llvm.org/docs/ThreadSanitizer.html) |
| 3 | [Helgrind: A Thread Error Detector - Valgrind](https://valgrind.org/docs/manual/hg-manual.html) |
| 4 | [Coverity Static Analysis](https://scan.coverity.com/) |
| 5 | [Semgrep - Lightweight Static Analysis](https://semgrep.dev/) |
| 6 | [SonarQube - Rule S5847](https://rules.sonarsource.com/c/RSPEC-5847/) |
| 7 | [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard) |
| 8 | [Go Race Detector](https://go.dev/doc/articles/race_detector) |
| 9 | [Java ConcurrentHashMap.computeIfAbsent()](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) |
| 10 | [Rust std::fs::OpenOptions::create_new()](https://doc.rust-lang.org/std/fs/struct.OpenOptions.html#method.create_new) |

### 서적

| # | 참조 |
|---|------|
| 1 | Java Concurrency in Practice - Brian Goetz et al. (Addison-Wesley, 2006) |
| 2 | Designing Data-Intensive Applications - Martin Kleppmann (O'Reilly, 2017) |
| 3 | The Art of Multiprocessor Programming - Maurice Herlihy, Nir Shavit (Morgan Kaufmann, 2012) |
| 4 | How to Distribute Locks Safely - Martin Kleppmann (2016) — Redlock 비판 및 Fencing Token 제안 |
