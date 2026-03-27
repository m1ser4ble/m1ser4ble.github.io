---
layout: single
title: "Self-Signed Certificate 자체 서명 인증서 완전 가이드"
date: 2026-03-27 23:01:13 +0900
categories: security
excerpt: "Self-Signed Certificate 자체 서명 인증서 완전 가이드의 개념과 배경, 도입 이유와 특징을 정리해 실무 적용 판단을 돕는다."
toc: true
toc_sticky: true
tags: [security, self, signed, certificate, 자체서명인증서, 완전가이드]
source: "/home/dwkim/dwkim/docs/security/self-signed-certificate-자체서명인증서-완전가이드.md"
---
TL;DR
- Self-Signed Certificate 자체 서명 인증서 완전 가이드의 핵심 개념을 빠르게 파악할 수 있다.
- 등장 배경과 도입 이유를 통해 왜 필요한지 맥락을 이해할 수 있다.
- 주요 특징과 상세 내용을 바탕으로 적용 시 고려사항을 정리할 수 있다.

## 1. 개념
Self-Signed Certificate 자체 서명 인증서 완전 가이드의 정의와 문제 공간을 간단히 정리한다.

## 2. 배경
이 주제가 등장한 기술적·운영적 배경과 기존 접근의 한계를 설명한다.

## 3. 이유
왜 이 방식이 필요한지, 도입 시 기대 효과와 트레이드오프를 정리한다.

## 4. 특징
핵심 동작 방식, 장단점, 적용 시 주의점을 요약한다.

## 5. 상세 내용

# Self-Signed Certificate 자체 서명 인증서 완전 가이드

> **한 줄 요약:** Self-signed 인증서는 제3자 CA 없이 스스로 서명한 인증서로, 개발/테스트 환경에서 유용하지만 프로덕션에서는 내부 CA 또는 Let's Encrypt 등 자동화된 PKI 체계로 대체해야 한다.

---

## 목차

1. [개요](#1-개요)
2. [용어 사전 (Terminology)](#2-용어-사전-terminology)
3. [등장 배경과 이유](#3-등장-배경과-이유)
4. [역사적 기원](#4-역사적-기원)
5. [학술적/이론적 배경](#5-학술적이론적-배경)
6. [진화 타임라인](#6-진화-타임라인)
7. [대안 비교 (Alternatives Comparison)](#7-대안-비교-alternatives-comparison)
8. [상황별 최적 선택](#8-상황별-최적-선택)
9. [실전 베스트 프랙티스](#9-실전-베스트-프랙티스)
10. [함정과 안티패턴](#10-함정과-안티패턴)
11. [마이그레이션 가이드](#11-마이그레이션-가이드)
12. [빅테크 실전 사례](#12-빅테크-실전-사례)
13. [빅테크 공통 패턴 요약](#13-빅테크-공통-패턴-요약)
14. [References](#14-references)

---

## 1. 개요

### Self-signed 인증서란 무엇인가

Self-signed 인증서는 **발급자(Issuer)와 주체(Subject)가 동일한 엔터티**인 디지털 인증서다. 일반적인 CA-signed 인증서는 제3자 인증 기관(CA)이 서명하여 신뢰를 보증하지만, self-signed 인증서는 **인증서 자체의 공개키로 서명을 검증**한다. 즉, "나는 나 자신이 맞다"고 스스로 증명하는 구조다.

기술적으로는 모든 Root CA 인증서가 self-signed다. OS와 브라우저의 Trust Store에 사전 설치된 Root CA 인증서도 본질적으로 self-signed이며, 차이는 **사회적 신뢰 체계(Trust Store 포함 여부)**에 있다.

### CA-signed vs Self-signed 차이

| 구분 | CA-signed 인증서 | Self-signed 인증서 |
|------|-----------------|-------------------|
| **발급자** | 제3자 CA (VeriSign, DigiCert, Let's Encrypt 등) | 자기 자신 |
| **신뢰 근거** | Trust Store에 포함된 Root CA 체인 | 수동 신뢰 설정 필요 |
| **브라우저 경고** | 없음 | `NET::ERR_CERT_AUTHORITY_INVALID` 경고 |
| **비용** | 무료(Let's Encrypt) ~ 수천 달러(EV) | 무료 |
| **자동 갱신** | ACME 프로토콜로 자동화 가능 | 수동 또는 자체 자동화 필요 |
| **CRL/OCSP** | 폐기 확인 가능 | 폐기 체계 없음 |
| **MITM 방어** | Chain of Trust로 검증 | 최초 연결 시 검증 불가 |
| **적합한 환경** | 프로덕션, 공개 서비스 | 개발, 테스트, 내부 서비스 |

---

## 2. 용어 사전 (Terminology)

| 용어 | 영문 풀네임 | 정의 |
|------|-----------|------|
| **Self-signed Certificate** | - | 발급자(Issuer)와 주체(Subject)가 동일한 인증서. 인증서 자체의 공개키로 서명을 검증한다. |
| **CA** | Certificate Authority | 디지털 인증서를 발급하고 서명하는 신뢰할 수 있는 기관. 여권을 발급하는 정부 기관에 비유된다. |
| **CSR** | Certificate Signing Request | PKCS#10(1993) 표준 기반의 인증서 서명 요청. 공개키, 신원 정보, 개인키 소유 증명을 포함한다. CA에 제출하여 서명된 인증서를 받는 데 사용된다. |
| **PKI** | Public Key Infrastructure | 공개키 기반 구조. 역할, 정책, 하드웨어, 소프트웨어, 절차를 모두 포괄하는 **인프라**이기 때문에 "Infrastructure"라 부른다. |
| **X.509** | ITU-T X.509 | ITU-T X 시리즈(데이터 네트워크) 중 500번대(디렉터리 서비스)의 509번(인증 프레임워크). 1988-07-03 최초 발행. 디지털 인증서의 형식을 정의하는 국제 표준이다. |
| **CN** | Common Name | 인증서의 주체 이름. **Chrome 58(2017-04) 이후 deprecated**되어 SAN이 필수다. CA/Browser Forum도 SAN 사용을 의무화했다. |
| **SAN** | Subject Alternative Name | 인증서가 유효한 도메인/IP 목록을 지정하는 X.509 v3 확장 필드. CN을 대체하는 현대적 표준이다. |
| **PEM** | Privacy-Enhanced Mail | RFC 1421-1424(1993)에서 유래한 Base64 인코딩 형식. 원래 이메일 보안을 위해 설계되었으나 이메일 보안 자체는 실패하고 **Base64 인코딩 형식만 살아남았다.** `-----BEGIN CERTIFICATE-----`로 시작한다. |
| **DER** | Distinguished Encoding Rules | ASN.1의 인코딩 규칙 중 하나. "Distinguished"는 **데이터당 단 하나의 고유한 인코딩**만 존재한다는 의미로, 서명 검증 시 동일한 바이트 시퀀스를 보장하기 위해 필수적이다. 바이너리 형식이다. |
| **PKCS#12** | Public-Key Cryptography Standards #12 | Microsoft의 PFX 형식에서 발전하여 RFC 7292로 표준화. 개인키 + 인증서 + 체인을 하나의 암호화된 파일(`.p12`, `.pfx`)로 묶는 형식이다. |
| **Chain of Trust** | - | Root CA(self-signed) -> Intermediate CA -> End-entity 인증서로 이어지는 신뢰 체인. 각 상위 인증서가 하위 인증서를 서명하여 신뢰를 전파한다. |
| **Root CA** | Root Certificate Authority | 신뢰 체인의 최상위. 자체 서명(self-signed) 인증서를 사용하며, 보안을 위해 **오프라인(air-gapped) 환경**에 격리하여 운영한다. |
| **Intermediate CA** | Intermediate Certificate Authority | Root CA와 End-entity 인증서 사이의 중간 CA. **온라인으로 운영**되며 실제 인증서 발급을 담당한다. Root CA가 침해되는 위험을 줄이기 위한 계층이다. |
| **Trust Store** | - | OS 또는 브라우저에 사전 설치된 Root CA 인증서 저장소. 신뢰 체인 검증의 출발점(Trust Anchor)이다. |
| **TOFU** | Trust On First Use | 최초 연결 시 상대방을 신뢰하는 모델. SSH의 `known_hosts`가 대표적. **최초 연결 시점의 MITM 공격에 근본적으로 취약**하다. |
| **ACME** | Automatic Certificate Management Environment | Let's Encrypt가 사용하는 인증서 자동 발급/갱신 프로토콜. RFC 8555로 표준화되었다. |
| **CT** | Certificate Transparency | RFC 6962(2013). Merkle Tree 기반 append-only 로그에 발급된 모든 인증서를 기록하여 오발급을 탐지하는 체계. DigiNotar 사건 이후 Google이 주도했다. |
| **OCSP** | Online Certificate Status Protocol | 인증서의 폐기 여부를 실시간으로 확인하는 프로토콜. CRL보다 효율적이나 개인정보 문제(CA가 방문 사이트 파악 가능)가 있다. |
| **CRL** | Certificate Revocation List | 폐기된 인증서 목록. 전체 목록을 다운로드해야 하므로 크기가 커질 수 있다. |
| **HSTS** | HTTP Strict Transport Security | 브라우저에게 해당 도메인은 반드시 HTTPS로만 접속하라고 지시하는 HTTP 헤더. HTTPS 다운그레이드 공격을 방지한다. |
| **mTLS** | Mutual TLS | 클라이언트와 서버 양쪽 모두 인증서로 상호 인증하는 TLS. Zero Trust 아키텍처의 핵심 구성 요소다. |
| **SVID** | SPIFFE Verifiable Identity Document | SPIFFE 표준에서 워크로드 신원을 증명하는 문서. X.509-SVID(인증서 기반) 또는 JWT-SVID 형태를 가진다. |
| **SPIFFE** | Secure Production Identity Framework for Everyone | CNCF 프로젝트. 이기종 환경에서 워크로드 간 신원을 증명하는 표준. "Credential Zero" 문제(최초 신뢰 확립)를 해결한다. |

---

## 3. 등장 배경과 이유

### SSL/TLS 이전의 통신 보안

인터넷 초기(1980~90년대), HTTP를 비롯한 대부분의 프로토콜은 **평문(plaintext) 통신**을 사용했다. 네트워크 경로상의 누구든 데이터를 가로채고(sniffing), 변조할(tampering) 수 있었다. FTP 비밀번호, 이메일 내용, 웹 폼 데이터가 모두 평문으로 전송되었다.

이에 대한 초기 대응은 각 애플리케이션 계층에서의 개별 암호화(예: PGP for email, Kerberos for authentication)였으나, **범용적인 전송 계층 보안**이 필요했다.

### 왜 인증서 기반 체계가 필요했는지

단순한 암호화만으로는 부족했다. **통신 상대방이 진짜 의도한 대상인지 확인**(인증, authentication)이 필수적이었다. 암호화된 채널이라도 공격자와 연결되어 있다면 무의미하다(MITM 공격).

해결 방안:
1. **공유 비밀키 (Shared Secret):** 양쪽이 사전에 같은 키를 공유 -- 확장성 없음
2. **공개키 암호화 (Public Key Cryptography):** 공개키를 자유롭게 배포 -- 하지만 그 공개키가 진짜 의도한 상대의 것인지 검증 필요
3. **디지털 인증서:** 신뢰할 수 있는 제3자(CA)가 "이 공개키는 이 주체의 것이 맞다"고 서명 -- PKI 탄생

### CA 기반 PKI의 비용/복잡성과 Self-signed의 필요

CA-signed 인증서는 오랫동안 **유료**였다. DV(Domain Validation) 인증서도 연간 수십~수백 달러, EV(Extended Validation)는 수천 달러에 달했다. 여기에 CSR 생성, 도메인 검증, 설치, 갱신 등의 **운영 복잡성**이 더해졌다.

이 때문에 다음과 같은 상황에서 self-signed 인증서가 필수적이었다:

| 상황 | Self-signed가 필요한 이유 |
|------|-------------------------|
| **로컬 개발 환경** | `localhost`에는 CA 인증서 발급 불가 |
| **내부 네트워크 서비스** | 외부 CA가 내부 도메인을 인증할 수 없음 |
| **IoT/임베디드 장치** | 인터넷 연결 없이 독립 운영 |
| **테스트/CI/CD** | 빠른 인증서 생성 필요, 비용 정당화 불가 |
| **에어갭(Air-gapped) 환경** | 외부 CA 접근 자체가 불가능 |
| **프로토타이핑** | 빠른 HTTPS 테스트 필요 |

2015년 Let's Encrypt의 등장으로 **무료 CA-signed 인증서**가 가능해졌지만, 위 상황 중 상당수는 여전히 self-signed(또는 내부 CA)가 유일한 선택이다.

---

## 4. 역사적 기원

### Netscape SSL의 탄생

**Taher Elgamal**(이집트 출신 암호학자, "SSL의 아버지")이 Netscape Communications에서 SSL(Secure Sockets Layer)을 설계했다.

| 버전 | 연도 | 상태 | 비고 |
|------|------|------|------|
| **SSL 1.0** | 1994 | 미공개 | 심각한 보안 결함으로 공개 릴리스되지 않음 |
| **SSL 2.0** | 1995 | 공개 | 다수의 취약점(MITM, 절단 공격 등) 존재 |
| **SSL 3.0** | 1996 | 공개 | 완전 재설계. 2014년 POODLE 공격으로 deprecated |

### 초기 CA의 등장

| CA | 설립 | 설립자 | 비고 |
|----|------|--------|------|
| **VeriSign** | 1995-04-12 | RSA Security 스핀오프 | 초기 인터넷 인증서 시장 사실상 독점. 2010년 Symantec 인수, 이후 DigiCert로 이전 |
| **Thawte** | 1995 | Mark Shuttleworth | 남아프리카 차고에서 설립. Shuttleworth는 이후 Thawte를 VeriSign에 매각하고 그 자금으로 **Ubuntu** 프로젝트를 시작 |

### TLS로의 발전

SSL은 Netscape의 독점 프로토콜이었다. IETF가 표준화하면서 이름을 **TLS(Transport Layer Security)**로 변경했다. 이 이름 변경은 **Microsoft에 대한 "face-saving gesture"**(체면 유지용 제스처)로 알려져 있다 -- Microsoft가 Netscape의 이름을 그대로 쓰는 것을 원하지 않았기 때문이다.

| 버전 | 연도 | RFC | 주요 변화 |
|------|------|-----|----------|
| **TLS 1.0** | 1999 | RFC 2246 | SSL 3.0 기반, IETF 표준화 |
| **TLS 1.1** | 2006 | RFC 4346 | CBC 공격 대응, IV 명시적 지정 |
| **TLS 1.2** | 2008 | RFC 5246 | SHA-256 지원, AEAD 암호화 모드 |
| **TLS 1.3** | 2018 | RFC 8446 | 1-RTT 핸드셰이크, 필수 Forward Secrecy, 5개 cipher suite로 간소화 |

### X.509 표준

X.509는 ITU-T(International Telecommunication Union - Telecommunication Standardization Sector)의 X 시리즈 중 하나다.

- **X 시리즈**: 데이터 네트워크 관련 표준
- **X.500번대**: 디렉터리 서비스 표준
- **X.509**: 인증 프레임워크 (Authentication Framework)

최초 발행일: **1988년 7월 3일**

### DigiNotar 사건 (2011)

2011년, 네덜란드 CA **DigiNotar**가 해킹되어 **531개의 위조 인증서**가 발급되었다. 344개 도메인이 영향을 받았으며, 그중에는 `*.google.com`이 포함되어 있었다.

이 위조 인증서는 **이란에서 약 30만 명의 Gmail 사용자에 대한 MITM 공격**에 사용된 것으로 추정된다(국가 수준의 감시 목적).

결과:
- DigiNotar는 모든 주요 브라우저의 Trust Store에서 제거됨
- **2011년 9월 파산**
- CA 시스템의 구조적 취약성이 전 세계적으로 인식됨
- **Certificate Transparency** 프로젝트의 직접적 계기가 됨

### Let's Encrypt의 등장

| 시점 | 이벤트 |
|------|--------|
| 2015-09-14 | 최초 인증서 발급 |
| 2015-12-03 | Public Beta 시작 |
| 2016-04-12 | GA (General Availability) |

Let's Encrypt는 **ISRG(Internet Security Research Group)**가 운영하며, Mozilla, Cisco, EFF, Akamai 등이 후원한다. **무료 DV 인증서**를 ACME 프로토콜을 통해 완전 자동으로 발급하며, 인터넷 HTTPS 보급률을 극적으로 높였다.

---

## 5. 학술적/이론적 배경

### Diffie-Hellman 키 교환 (1976)

- **발표:** IEEE Transactions on Information Theory, Vol. 22, 1976
- **저자:** Whitfield Diffie, Martin Hellman
- **의의:** 사전에 비밀을 공유하지 않은 두 당사자가 안전하지 않은 채널을 통해 공유 비밀을 생성할 수 있음을 최초로 증명
- **수상:** Turing Award 2016
- 공개키 암호화의 개념적 토대를 마련하여 PKI와 인증서 체계의 이론적 기반이 됨

### RSA 알고리즘 (1977)

- **저자:** Ron **R**ivest, Adi **S**hamir, Leonard **A**dleman (MIT)
- **일화:** Rivest가 유대교 유월절(Passover) 기간 소파에 누워서 알고리즘을 공식화함
- **의의:** 최초의 실용적 공개키 암호 시스템. 디지털 서명 + 암호화 모두 가능
- 인증서 서명의 핵심 알고리즘으로 수십 년간 사용됨

### X.509 표준의 진화

| 버전 | 연도 | 주요 변화 |
|------|------|----------|
| **v1** | 1988 | 최초 버전. 기본 필드만 정의 (Subject, Issuer, Validity, Public Key) |
| **v2** | 1993 | Issuer/Subject Unique Identifier 추가 (거의 사용되지 않음) |
| **v3** | 1996 | **Extensions** 도입. SAN, Key Usage, Basic Constraints 등. 현재 사실상 유일하게 사용되는 버전 |

### 핵심 RFC 표준

| RFC | 연도 | 제목 | 내용 |
|-----|------|------|------|
| **RFC 2459** | 1999 | Internet X.509 PKI Certificate and CRL Profile | 최초 Internet PKI 프로파일 |
| **RFC 3280** | 2002 | (위 문서의 업데이트) | RFC 2459 obsolete |
| **RFC 5280** | 2008 | Internet X.509 PKI Certificate and CRL Profile | **현행 표준**. RFC 3280 obsolete. 인증서 경로 검증 알고리즘 정의 |
| **RFC 6125** | 2011 | Representation and Verification of Application-Layer Service Identity | 서비스 신원 검증 규칙 |
| **RFC 9525** | 2023 | (RFC 6125 업데이트) | **CN을 통한 검증을 완전히 제거**. SAN만 사용 |
| **RFC 8446** | 2018 | TLS 1.3 | 1-RTT 핸드셰이크, 필수 Forward Secrecy, cipher suite를 5개로 간소화 |
| **RFC 6962** | 2013 | Certificate Transparency | Merkle Tree 기반 append-only 로그. 인증서 오발급 탐지 체계 |

### NIST SP 800-52 Rev. 2 (2019)

미국 NIST의 TLS 구현 가이드라인:
- **2024-01-01부터 TLS 1.3 필수** (연방 기관)
- TLS 1.0/1.1 사용 금지
- TLS 1.2는 특정 조건에서만 허용

### TOFU vs CA-based PKI

| 항목 | TOFU (Trust On First Use) | CA-based PKI |
|------|--------------------------|--------------|
| **신뢰 확립** | 최초 연결 시 상대방을 신뢰 | CA가 사전에 신원을 검증 |
| **대표 사례** | SSH `known_hosts` | HTTPS 인증서 |
| **장점** | 단순함, 인프라 불필요 | 최초 연결부터 검증 가능 |
| **취약점** | 최초 연결 MITM에 근본적으로 취약 | CA 침해 시 전체 신뢰 붕괴 |
| **확장성** | 제한적 | 계층적 구조로 확장 가능 |

### Web of Trust vs Hierarchical PKI

| 항목 | Web of Trust (PGP) | Hierarchical PKI (X.509) |
|------|--------------------|-----------------------|
| **시작** | PGP 1991, Phil Zimmermann | X.509 1988, ITU-T |
| **신뢰 모델** | 분산형: 사용자 간 상호 서명 | 계층형: Root CA -> Intermediate -> End-entity |
| **장점** | 중앙 기관 불필요, 탈중앙화 | 대규모 자동화 가능, 표준화 |
| **단점** | 확장성 없음, UX 복잡 | 중앙 집중적 신뢰(CA 침해 위험) |
| **현재 상태** | 거의 사용되지 않음 | 인터넷 PKI의 사실상 유일한 표준 |

---

## 6. 진화 타임라인

| 연도 | 사건 | 의의 |
|------|------|------|
| **1976** | Diffie-Hellman 키 교환 발표 | 공개키 암호화의 이론적 토대 |
| **1977** | RSA 알고리즘 발표 (MIT) | 최초의 실용적 공개키 암호 시스템 |
| **1988** | X.509 v1 발행 (ITU-T) | 디지털 인증서 형식 최초 표준화 |
| **1991** | PGP 출시 (Phil Zimmermann) | Web of Trust 모델 제안 |
| **1993** | X.509 v2 | Unique Identifier 추가 (실용성 낮음) |
| **1994** | SSL 1.0 (Netscape) | 최초 웹 보안 프로토콜 (미공개) |
| **1995** | SSL 2.0 공개 | 최초의 공개 SSL 구현 |
| **1995** | VeriSign 설립 (RSA Security 스핀오프) | 상용 CA 시장 시작 |
| **1995** | Thawte 설립 (Mark Shuttleworth) | 남아프리카에서 시작된 두 번째 주요 CA |
| **1996** | SSL 3.0 | 완전 재설계, 실질적 보안 확보 |
| **1996** | X.509 v3 | Extensions 도입 (SAN, Key Usage 등). 현행 표준 |
| **1999** | TLS 1.0 (RFC 2246) | IETF 표준화. "face-saving gesture to Microsoft" |
| **2006** | TLS 1.1 (RFC 4346) | CBC 공격 대응 |
| **2008** | TLS 1.2 (RFC 5246) | SHA-256, AEAD 지원 |
| **2008** | RFC 5280 발행 | 현행 Internet PKI 표준 |
| **2011** | DigiNotar 해킹 | 531개 위조 인증서, *.google.com 포함, 이란 30만 Gmail MITM |
| **2013** | Certificate Transparency (RFC 6962) | Merkle Tree 기반 인증서 투명성 로그 |
| **2015** | Let's Encrypt 최초 인증서 발급 | 무료 자동화 CA의 시작 |
| **2017** | Chrome 58: CN deprecated | SAN 필수 시대 개막 |
| **2017** | Chrome, HTTP 사이트에 "Not Secure" 표시 | HTTPS 전환 압력 극대화 |
| **2018** | TLS 1.3 (RFC 8446) | 1-RTT, 필수 Forward Secrecy, 5개 cipher suite |
| **2020** | TLS 1.0/1.1 공식 deprecated | 주요 브라우저 지원 중단 |
| **2023** | RFC 9525 | CN 검증 완전 제거, SAN만 사용 |
| **2025** | Apple SC-081v3 통과 | 47일 인증서 유효기간 제한 단계적 시행 확정 |
| **2026-03-15** | 1단계 시행 | 최대 유효기간 **200일** |
| **2027-03-15** | 2단계 시행 | 최대 유효기간 **100일** |
| **2029-03-15** | 3단계 시행 | 최대 유효기간 **47일** |

---

## 7. 대안 비교 (Alternatives Comparison)

### 각 대안 상세

#### a) Self-signed Certificate

- **비용:** 무료
- **자동화:** 없음 (수동 생성/배포)
- **브라우저 신뢰:** 없음 (경고 표시)
- **적합 환경:** 개발, 테스트, CI/CD
- **한계:** MITM 방어 불가, CRL/OCSP 없음

#### b) Let's Encrypt (ACME)

- **비용:** 무료
- **자동화:** 완전 자동 (ACME 프로토콜, certbot/acme.sh)
- **인증서 유형:** DV(Domain Validation)만 지원
- **유효기간:** 90일 (자동 갱신 권장)
- **제한:** Rate Limit 있음 (도메인당 주 50개), OV/EV 미지원, 내부 도메인 불가

#### c) Commercial CA

- **비용:** $5 ~ 수천 달러/년
- **인증서 유형:** DV, OV(Organization Validation), EV(Extended Validation)
- **장점:** 브랜드 신뢰, 보증 보험, 전화 지원
- **적합 환경:** 기업 공개 서비스, 규제 준수 필요 시

#### d) Internal CA

다양한 도구로 내부 CA를 운영할 수 있다:

| 도구 | 특징 |
|------|------|
| **OpenSSL CA** | 가장 기본적. 수동 관리, 스크립트로 자동화 가능 |
| **CFSSL** | Cloudflare 개발. Go 기반, JSON API, 경량 |
| **step-ca** | Smallstep 개발. ACME v2 지원, 자동화 우수, 프로덕션급 |
| **Vault PKI** | HashiCorp. 동적 인증서 발급, 감사 로그, 시크릿 관리 통합 |

#### e) mTLS (Mutual TLS)

- 클라이언트와 서버 **양방향 인증서 검증**
- Zero Trust 아키텍처의 핵심 구성 요소
- 서비스 간 통신에서 네트워크 위치가 아닌 **신원(identity)**으로 신뢰 결정

#### f) SPIFFE/SPIRE

- **CNCF Graduated** 프로젝트
- 이기종 인프라에서 **워크로드 신원(Workload Identity)** 제공
- "Credential Zero" 문제 해결: 최초의 신뢰를 어떻게 확립할 것인가
- X.509-SVID 또는 JWT-SVID 형태의 신원 문서 발급

#### g) Service Mesh

| Mesh | 특징 | 성능 영향 |
|------|------|----------|
| **Istio** | Envoy 프록시 기반, 풍부한 기능 | **166% latency 증가** (프록시 오버헤드) |
| **Linkerd** | Rust 기반 마이크로 프록시, 경량 | **33% latency 증가**, 자동 mTLS 기본 활성화 |

#### h) SSH Certificates

- 단일 CA Trust, 인증서 체인 없음 (X.509보다 단순)
- Host Certificate + User Certificate
- `ssh-keygen -s ca_key -I identity host_key.pub`
- 서버 관리 환경에서 `known_hosts` 수동 관리 대체

#### i) TOFU (Trust On First Use)

- 최초 연결 시 신뢰 확립
- SSH `known_hosts`가 대표적 사례
- **근본적으로 최초 연결 MITM에 취약**
- 소규모, 통제된 환경에서만 적합

### 비교 매트릭스

| 기준 | Self-signed | Let's Encrypt | Commercial CA | Internal CA | mTLS | SPIFFE/SPIRE | Service Mesh |
|------|:-----------:|:-------------:|:-------------:|:-----------:|:----:|:------------:|:------------:|
| **비용** | 무료 | 무료 | $5~수천 | 무료~중간 | 구현 의존 | 무료(OSS) | 무료(OSS) |
| **자동화** | 없음 | 완전 | 부분 | 도구 의존 | 도구 의존 | 완전 | 완전 |
| **브라우저 신뢰** | X | O | O | X (내부만) | N/A | N/A | N/A |
| **내부 서비스** | 가능 | 제한적 | 가능 | 최적 | 최적 | 최적 | 최적 |
| **확장성** | 낮음 | 높음 | 높음 | 중간~높음 | 높음 | 매우 높음 | 매우 높음 |
| **운영 복잡도** | 낮음 | 낮음 | 낮음 | 중간~높음 | 높음 | 높음 | 매우 높음 |
| **MITM 방어** | X | O | O | O | O | O | O |
| **CRL/OCSP** | X | O | O | 구성 가능 | N/A | 단기 만료 | 단기 만료 |

### 결정 트리

```
Q1. 공개 인터넷에 노출되는 서비스인가?
├─ Yes → Q2. OV/EV 인증서가 필요한가?
│        ├─ Yes → Commercial CA
│        └─ No  → Let's Encrypt
└─ No  → Q3. 서비스 규모는?
         ├─ 소규모 (개발/테스트) → Q4. 로컬 개발인가?
         │                        ├─ Yes → mkcert 또는 Self-signed
         │                        └─ No  → Self-signed 또는 step-ca
         └─ 중대규모 (프로덕션 내부) → Q5. Kubernetes 환경인가?
                                      ├─ Yes → cert-manager + Service Mesh
                                      └─ No  → Q6. 서비스 수가 50+인가?
                                               ├─ Yes → SPIFFE/SPIRE 또는 Vault PKI
                                               └─ No  → Internal CA (step-ca)
```

---

## 8. 상황별 최적 선택

| 상황 | 1순위 | 2순위 | 3순위 | 이유 |
|------|-------|-------|-------|------|
| **로컬 개발** | mkcert | step-ca | Self-signed | mkcert는 자동 Trust Store 등록으로 브라우저 경고 없음 |
| **내부 마이크로서비스** | Service Mesh (Linkerd) | SPIFFE/SPIRE | Internal CA (step-ca) | Service Mesh는 mTLS를 애플리케이션 코드 변경 없이 적용 |
| **공개 웹사이트** | Let's Encrypt | Commercial CA (OV/EV 필요 시) | - | 무료 + 완전 자동화. OV/EV 필요 시에만 Commercial |
| **IoT 장치** | Internal CA + EST 프로토콜 | AWS IoT Fleet Provisioning | - | 30-90일 단기 인증서, EST(Enrollment over Secure Transport) 프로토콜로 자동 등록 |
| **Kubernetes** | cert-manager + Linkerd/Istio | cert-manager + Vault | SPIFFE/SPIRE | cert-manager는 CNCF Graduated, 86% 프로덕션 클러스터에서 사용 |
| **CI/CD 파이프라인** | Self-signed | mkcert | - | 일회성 테스트 환경, 빠른 생성과 폐기가 중요 |
| **엔터프라이즈** | Vault PKI + cert-manager | SPIFFE/SPIRE | step-ca | 감사 로그, 동적 인증서, 시크릿 관리 통합이 핵심 |

---

## 9. 실전 베스트 프랙티스

### 키 알고리즘 선택

| 알고리즘 | 키 크기 | 보안 수준(bits) | 성능 | 권장 여부 |
|---------|--------|---------------|------|----------|
| **ECDSA P-256** | 256-bit | 128-bit | 빠름 (RSA 대비 서명 10배+) | **권장** |
| **ECDSA P-384** | 384-bit | 192-bit | 보통 | Root CA에 적합 |
| **RSA 2048** | 2048-bit | 112-bit | 느림 | 레거시 호환 필요 시 |
| **RSA 4096** | 4096-bit | ~140-bit | 매우 느림 | 특수 요구 시에만 |
| **Ed25519** | 256-bit | 128-bit | 매우 빠름 | SSH에 적합, TLS 지원 제한적 |

> **권장:** 새 프로젝트는 **ECDSA P-256** 사용. Root CA는 **ECDSA P-384** 고려.

### 해시 알고리즘

| 알고리즘 | 상태 | 비고 |
|---------|------|------|
| **SHA-1** | **사용 금지** | 2017년 SHAttered 공격으로 충돌 생성 입증 (비용 약 $110,000) |
| **SHA-256** | **최소 권장** | 현재 사실상 표준 |
| **SHA-384** | 권장 | Root CA 및 고보안 환경 |
| **SHA-512** | 허용 | 일반적으로 SHA-384로 충분 |

### 유효 기간 설정

| 인증서 유형 | 권장 유효기간 | 비고 |
|------------|-------------|------|
| Root CA | 10-20년 | 오프라인 보관, 교체 비용이 크므로 장기 |
| Intermediate CA | 3-5년 | Root보다 짧게, 교체 가능하게 |
| End-entity (현재) | 1년 (398일) | CA/Browser Forum 제한 |
| End-entity (2026-03-15~) | **200일** | Apple SC-081v3 1단계 |
| End-entity (2027-03-15~) | **100일** | Apple SC-081v3 2단계 |
| End-entity (2029-03-15~) | **47일** | Apple SC-081v3 3단계 |
| 내부 서비스 | 30-90일 | 빅테크 트렌드: 단기 인증서 + 자동 갱신 |

> **핵심:** 47일 유효기간 시대가 오면 **수동 갱신은 불가능**하다. 자동화는 선택이 아닌 필수다.

### SAN 필수 사용

Chrome 58(2017-04) 이후 CN은 무시되며, **SAN이 없는 인증서는 브라우저에서 거부**된다. RFC 9525(2023)는 CN 기반 검증을 완전히 제거했다.

```ini
# openssl.cnf 예시
[req]
distinguished_name = req_dn
req_extensions = v3_req

[req_dn]
CN = example.com

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = example.com
DNS.2 = www.example.com
DNS.3 = api.example.com
IP.1 = 192.168.1.100
```

### Key Usage / Extended Key Usage

인증서의 용도를 명시적으로 제한하여 오용을 방지한다:

```ini
# Root CA
keyUsage = critical, keyCertSign, cRLSign

# Server Certificate
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

# Client Certificate (mTLS)
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth

# Server + Client (양방향)
extendedKeyUsage = serverAuth, clientAuth
```

> `critical` 플래그: 해당 확장을 이해하지 못하는 시스템은 인증서를 **반드시 거부**해야 함을 의미한다.

### OpenSSL 모범 사례: Root CA + 리프 인증서 전체 예시

#### Step 1: Root CA 생성

```bash
# Root CA 개인키 생성 (ECDSA P-384, AES-256 암호화)
openssl ecparam -genkey -name secp384r1 | \
  openssl ec -aes256 -out root-ca.key

# Root CA 인증서 생성 (10년)
openssl req -new -x509 -sha384 -days 3650 \
  -key root-ca.key \
  -out root-ca.crt \
  -subj "/C=KR/O=MyOrg/CN=MyOrg Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"
```

#### Step 2: 서버 인증서 CSR 생성

```bash
# 서버 개인키 생성 (ECDSA P-256, 암호화 없음 - 서버 자동 로드용)
openssl ecparam -genkey -name prime256v1 -noout -out server.key

# CSR 생성
openssl req -new -sha256 \
  -key server.key \
  -out server.csr \
  -subj "/C=KR/O=MyOrg/CN=myapp.internal" \
  -addext "subjectAltName=DNS:myapp.internal,DNS:localhost,IP:127.0.0.1"
```

#### Step 3: Root CA로 서버 인증서 서명

```bash
# 서명 설정 파일
cat > server-ext.cnf << 'EOF'
authorityKeyIdentifier = keyid,issuer
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:myapp.internal,DNS:localhost,IP:127.0.0.1
EOF

# 서명 (1년)
openssl x509 -req -sha256 -days 365 \
  -in server.csr \
  -CA root-ca.crt \
  -CAkey root-ca.key \
  -CAcreateserial \
  -out server.crt \
  -extfile server-ext.cnf
```

#### Step 4: 인증서 검증

```bash
# 체인 검증
openssl verify -CAfile root-ca.crt server.crt

# 인증서 상세 확인
openssl x509 -in server.crt -text -noout

# SAN 확인
openssl x509 -in server.crt -noout -ext subjectAltName
```

### mkcert 사용법 (로컬 개발)

```bash
# 설치
brew install mkcert          # macOS
sudo apt install mkcert      # Debian/Ubuntu
choco install mkcert         # Windows

# 로컬 CA 설치 (자동 Trust Store 등록)
mkcert -install

# 인증서 생성
mkcert localhost 127.0.0.1 ::1 myapp.local

# 생성된 파일:
# - localhost+3.pem      (인증서)
# - localhost+3-key.pem  (개인키)

# Node.js에서 사용
# const https = require('https');
# const fs = require('fs');
# https.createServer({
#   key: fs.readFileSync('localhost+3-key.pem'),
#   cert: fs.readFileSync('localhost+3.pem')
# }, app).listen(3000);
```

> **장점:** mkcert는 로컬 Root CA를 생성하고 OS/브라우저 Trust Store에 자동 등록하여 **브라우저 경고 없이** HTTPS 개발이 가능하다.

### step-ca 내부 CA 운영

```bash
# step CLI + step-ca 설치
brew install step smallstep/smallstep/step-ca   # macOS

# CA 초기화
step ca init --name "MyOrg Internal CA" \
  --dns ca.internal \
  --address :8443 \
  --provisioner admin

# CA 서버 시작
step-ca $(step path)/config/ca.json

# 인증서 발급 (ACME 클라이언트 호환)
step ca certificate myapp.internal server.crt server.key \
  --ca-url https://ca.internal:8443 \
  --root $(step path)/certs/root_ca.crt

# 자동 갱신 데몬
step ca renew --daemon server.crt server.key
```

**프로덕션 권장 사항:**
- Root CA 키는 **오프라인(air-gapped)** 환경에 보관
- Intermediate CA 키는 **Cloud KMS** (AWS KMS, GCP Cloud KMS) 사용
- step-ca 프로세스는 **비특권 서비스 사용자(unprivileged user)**로 실행
- ACME v2 프로토콜 지원으로 기존 certbot/cert-manager와 호환

### Docker/Kubernetes cert-manager 설정

#### cert-manager 설치 및 SelfSigned -> CA Issuer Bootstrap 패턴

```yaml
# 1. cert-manager 설치
# kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# 2. SelfSigned Issuer (Bootstrap용)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-bootstrap
spec:
  selfSigned: {}

---
# 3. Root CA 인증서 생성 (SelfSigned Issuer로)
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: root-ca
  namespace: cert-manager
spec:
  isCA: true
  commonName: "MyOrg Root CA"
  secretName: root-ca-secret
  duration: 87600h    # 10년
  renewBefore: 8760h  # 1년 전 갱신
  privateKey:
    algorithm: ECDSA
    size: 256
  issuerRef:
    name: selfsigned-bootstrap
    kind: ClusterIssuer

---
# 4. CA Issuer (위 Root CA 인증서 사용)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  ca:
    secretName: root-ca-secret

---
# 5. 서비스 인증서 발급
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-tls
  namespace: default
spec:
  secretName: myapp-tls-secret
  duration: 720h      # 30일
  renewBefore: 168h   # 7일 전 갱신
  privateKey:
    algorithm: ECDSA
    size: 256
  dnsNames:
    - myapp.default.svc.cluster.local
    - myapp.internal
  issuerRef:
    name: internal-ca
    kind: ClusterIssuer
```

### Trust Store 추가 방법 (OS별)

자체 서명 Root CA를 각 OS/런타임의 Trust Store에 등록하는 방법:

| OS/런타임 | 명령어 |
|-----------|--------|
| **Debian/Ubuntu** | `sudo cp root-ca.crt /usr/local/share/ca-certificates/` <br> `sudo update-ca-certificates` |
| **RHEL/CentOS/Fedora** | `sudo cp root-ca.crt /etc/pki/ca-trust/source/anchors/` <br> `sudo update-ca-trust` |
| **macOS** | `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain root-ca.crt` |
| **Windows** | `certutil -addstore -f "ROOT" root-ca.crt` <br> 또는 MMC > 인증서 스냅인 > 신뢰할 수 있는 루트 인증 기관에 가져오기 |
| **Firefox** | Firefox는 자체 Trust Store 사용. `about:preferences` > 개인정보 및 보안 > 인증서 보기 > 가져오기 |
| **Node.js** | `NODE_EXTRA_CA_CERTS=/path/to/root-ca.crt node app.js` |
| **Python (requests)** | `requests.get('https://...', verify='/path/to/root-ca.crt')` <br> 또는 `REQUESTS_CA_BUNDLE=/path/to/root-ca.crt` |

### 인증서 갱신 자동화

```bash
# certbot (Let's Encrypt)
certbot renew --quiet
# cron: 0 0 * * * certbot renew --quiet

# step-ca 데몬 갱신
step ca renew --daemon server.crt server.key

# cert-manager (Kubernetes)
# renewBefore 필드로 자동 갱신 (위 YAML 참조)

# 자체 스크립트 예시 (OpenSSL)
#!/bin/bash
CERT="server.crt"
DAYS_BEFORE_EXPIRY=30

expiry=$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)
expiry_epoch=$(date -d "$expiry" +%s)
now_epoch=$(date +%s)
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

if [ "$days_left" -lt "$DAYS_BEFORE_EXPIRY" ]; then
  echo "Certificate expires in $days_left days. Renewing..."
  # CSR 재생성 및 서명 명령어 실행
fi
```

---

## 10. 함정과 안티패턴

### 1. 프로덕션에서 Self-signed 인증서 사용

| 위험 | 설명 |
|------|------|
| MITM 방어 불가 | 제3자 검증이 없으므로 공격자의 인증서와 구분 불가 |
| CRL/OCSP 없음 | 인증서 폐기 체계가 없어 침해 시 대응 불가 |
| 사용자 경고 피로 | 반복되는 브라우저 경고로 사용자가 보안 경고에 둔감해짐 |

### 2. SSL 검증 비활성화

```bash
# 절대 하지 말 것
curl -k https://api.example.com
curl --insecure https://api.example.com
```

```python
# 절대 하지 말 것
requests.get('https://api.example.com', verify=False)
```

```javascript
// 절대 하지 말 것
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

**관련 CVE:** [CVE-2021-22939](https://nvd.nist.gov/vuln/detail/CVE-2021-22939) -- Node.js에서 검증 비활성화 시 인증서의 `subjectAltName`이 불완전하게 검증되는 취약점.

> 개발 중 임시로 SSL 검증을 비활성화하고 **프로덕션 코드에 그대로 남기는 것**이 가장 흔한 보안 사고 원인 중 하나다.

### 3. 와일드카드 인증서 남용

**ALPACA 공격 (Application Layer Protocol Confusion for Alphas):** 와일드카드 인증서(`*.example.com`)를 사용하면, 같은 도메인의 다른 서비스(예: FTP, SMTP)가 그 인증서를 공유하게 되어 **프로토콜 혼동 공격**에 취약해진다.

**NSA/CISA 2021 경고:** 와일드카드 인증서 사용을 최소화하고, 가능하면 개별 도메인 인증서를 사용할 것을 권고.

### 4. 만료된 인증서 방치

- 2029년 **47일 유효기간** 시행 이후, 수동 추적은 사실상 불가능
- **인증서 만료는 서비스 장애의 직접적 원인** (수많은 빅테크 장애 사례 존재)
- 해결: cert-manager, step-ca renew --daemon 등 자동 갱신 필수

### 5. 개인키 하드코딩

```javascript
// 절대 하지 말 것
const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvg...";
```

- Git 히스토리에 한 번 커밋되면 **영구적으로 남는다** (`git filter-branch`로도 완전 제거 어려움)
- 해결: 환경 변수, Secret Manager (AWS Secrets Manager, Vault), Kubernetes Secret

### 6. 같은 인증서를 여러 서비스에 공유

- 하나의 인증서 = **단일 장애 지점(Single Point of Failure)**
- 하나의 개인키 유출 시 모든 서비스가 침해됨
- 해결: 서비스별 개별 인증서 발급 (자동화로 비용 없음)

### 7. CN만 사용하고 SAN 미설정

```
# Chrome 58+ (2017-04) 이후 이렇게 생성하면 브라우저에서 거부됨
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -subj "/CN=example.com"    # SAN 없음 → 거부!
```

- Chrome 58 이후 CN은 **완전히 무시**됨
- RFC 9525(2023)에서 CN 검증 공식 제거
- **반드시 SAN 포함**해야 함

### 8. 약한 키 사용 (RSA 1024)

| 키 크기 | 상태 | 비고 |
|--------|------|------|
| RSA 512 | **위험** | 1999년 인수분해 성공 |
| RSA 1024 | **사용 금지** | NIST 2013년 deprecated |
| RSA 2048 | 허용 | 2030년까지는 안전으로 평가 |
| RSA 4096 | 안전 | 성능 부담 고려 |

### 9. SHA-1 해시 사용

- **2017년 SHAttered 공격:** Google과 CWI Amsterdam이 SHA-1 충돌을 시연. 비용 약 **$110,000** (클라우드 GPU)
- 2020년에는 chosen-prefix 공격도 성공 (비용 $45,000)
- **모든 주요 브라우저와 CA는 SHA-1 서명 인증서를 거부**
- 반드시 **SHA-256 이상** 사용

---

## 11. 마이그레이션 가이드

### Self-signed -> Let's Encrypt

```bash
# 1. certbot 설치
sudo apt install certbot python3-certbot-nginx   # Nginx
sudo apt install certbot python3-certbot-apache   # Apache

# 2. 인증서 발급 (DNS 검증 또는 HTTP 검증)
sudo certbot --nginx -d example.com -d www.example.com

# 3. 자동 갱신 확인
sudo certbot renew --dry-run

# 4. 자동 갱신 cron/systemd timer 설정
sudo systemctl enable certbot.timer

# 5. 기존 self-signed 인증서 참조 제거
# nginx.conf에서 ssl_certificate/ssl_certificate_key 경로가
# /etc/letsencrypt/live/example.com/ 으로 변경되었는지 확인

# 6. SSL Labs 테스트
# https://www.ssllabs.com/ssltest/analyze.html?d=example.com
```

### Self-signed -> Internal CA (step-ca)

```bash
# 1. step-ca 설치 및 초기화 (위 step-ca 섹션 참조)

# 2. 기존 서비스의 인증서를 step-ca로 발급
step ca certificate myservice.internal server.crt server.key

# 3. Root CA를 모든 클라이언트의 Trust Store에 등록
# (위 Trust Store 추가 방법 참조)

# 4. 자동 갱신 데몬 설정
step ca renew --daemon server.crt server.key

# 5. 기존 self-signed 인증서 교체
# 서비스 설정에서 인증서 경로 업데이트 후 재시작
```

### HTTP -> HTTPS 전환 체크리스트

| 단계 | 작업 | 확인 |
|------|------|------|
| 1 | 인증서 발급 (Let's Encrypt 또는 Internal CA) | [ ] |
| 2 | 웹 서버에 HTTPS 설정 | [ ] |
| 3 | HTTP -> HTTPS 301 리다이렉트 설정 | [ ] |
| 4 | **Mixed Content** 수정 (HTTP 리소스 참조 제거) | [ ] |
| 5 | **HSTS 헤더** 추가 (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) | [ ] |
| 6 | CSP(Content Security Policy)에서 HTTP 소스 제거 | [ ] |
| 7 | sitemap.xml, robots.txt URL 업데이트 | [ ] |
| 8 | 외부 서비스 웹훅 URL 업데이트 | [ ] |
| 9 | **SSL Labs 테스트** (A+ 등급 확인) | [ ] |
| 10 | HSTS Preload 신청 (hstspreload.org) | [ ] |

### 인증서 핀닝 주의사항

| 항목 | 상세 |
|------|------|
| **HPKP (HTTP Public Key Pinning)** | **2018년 deprecated.** Chrome 67에서 제거. 잘못된 핀 설정 시 서비스 접근 불가능해지는 자해 공격(self-DoS) 위험이 너무 컸음 |
| **SPKI Hash Pinning** | 모바일 앱에서 여전히 사용. 반드시 **백업 핀(Backup Pin)** 포함 필수 |
| **Cloudflare 입장** | 핀닝에 **반대**. 2024년 Q3 핀닝 관련 인시던트 급증 보고 |
| **권장 대안** | Certificate Transparency 로그 모니터링, CAA DNS 레코드 설정 |

---

## 12. 빅테크 실전 사례

### Google

#### Google Trust Services (GTS)
- 2017년부터 자체 Root CA 운영
- Google 서비스의 인증서를 자체 발급하여 외부 CA 의존도 제거
- 전 세계 인증서 발급 시장에서 주요 CA로 자리매김

#### Certificate Transparency (CT)
- DigiNotar 사건 이후 **Ben Laurie**와 **Adam Langley**(Google)이 설계
- RFC 6962로 표준화
- Merkle Tree 기반 append-only 로그에 모든 발급 인증서를 기록
- Chrome은 CT 로그에 등록되지 않은 인증서를 거부
- **인증서 오발급의 실시간 탐지**를 가능하게 한 혁신적 시스템

#### ALTS (Application Layer Transport Security)
- Google 내부 서비스 간 통신용 프로토콜
- Protocol Buffers 기반, 엔터티(서비스) 기반 ID 사용
- **초당 10^10(100억) RPC** 처리
- 핸드셰이크 인증서의 유효기간은 **수 시간**에 불과
- IP가 아닌 **서비스 신원(identity)**으로 인증

#### BeyondProd
- Google의 클라우드 네이티브 보안 모델
- **Host Integrity System**: 부팅 시 호스트 무결성 검증
- **Borg-managed ALTS credentials**: 컨테이너 오케스트레이터가 인증 자격 증명을 관리
- Zero Trust 아키텍처의 실제 구현 사례

#### 47일 인증서 제안
- 인증서 유효기간을 90일에서 47일로 단축하는 방안을 CA/Browser Forum에 제안
- 단기 인증서로 CRL/OCSP 의존도를 줄이고, 자동화를 강제하는 전략

### Netflix

#### Lemur
- Netflix 오픈소스 **인증서 오케스트레이션 플랫폼** (Python/Flask, 2015)
- 여러 CA(내부/외부)의 인증서를 통합 관리
- 인증서 발급, 추적, 갱신 알림 자동화

#### Metatron
- **4일짜리 단기 인증서** 사용
- 인증서 유효기간이 극단적으로 짧으므로 **CRL/OCSP가 불필요**
- "폐기 대신 만료" 전략의 극단적 구현

#### Bryan Payne - USENIX Enigma 2016
- Netflix 보안 엔지니어의 발표: "PKI at Scale Using Short-Lived Certificates"
- 대규모 인프라에서 단기 인증서 전략의 실용성을 입증

#### SPIFFE/SPIRE 도입
- 워크로드 신원 기반 인증 도입
- **보안 인시던트 60% 감소** 보고

### Meta (Facebook)

#### Kerberos -> mTLS 마이그레이션
- **2012년** 내부 인증은 Kerberos 기반
- **2018-2019년** mTLS로 완전 전환
- 3-tier 인증서 계층 구조: Root CA -> Intermediate CA -> Service Certificate

#### Fizz (TLS 1.3 라이브러리)
- Meta가 개발한 고성능 TLS 1.3 C++ 구현
- TLS 1.2 대비 **CPU 사용량 10-15% 감소**
- 대규모 인프라에서의 성능 최적화에 기여

#### Short-Lived Certificates (SLC)
- **10일** 유효기간의 인증서 사용
- 매일 자동 교체(daily rotation)
- 기존 대비 **운영 부하 10배 증가**하지만, 보안 이점이 그 비용을 정당화

#### Delegated Credentials
- TLS 리프 인증서가 서명한 **하위 자격 증명(sub-credential)**
- 유효기간 **수 시간**
- 엣지 서버에 전체 개인키 대신 Delegated Credential만 배포하여 키 유출 위험 감소

### Cloudflare

#### Universal SSL (2014)
- 하루 만에 **인터넷 암호화 사이트를 2배로 증가**시킨 이벤트
- **200만 도메인**에 무료 SSL 인증서 자동 제공
- SNI + ECDSA + 동적 인증서 로딩으로 대규모 멀티테넌트 구현

#### SSL for SaaS
- 수백만 개의 커스텀 호스트네임 지원
- **P-256(ECDSA) + RSA 2048 이중 인증서** 발급 (호환성 + 성능 최적화)

#### Origin CA
- Cloudflare와 오리진 서버 간 통신을 위한 무료 인증서
- 핸드셰이크 크기 **70% 감소**

#### Certificate Pinning 반대 입장
- HPKP deprecated 이후에도 커스텀 핀닝에 대해 **반대 입장** 유지
- **2024년 Q3**: 핀닝 관련 인시던트가 급증. 핀 교체 시 서비스 중단 사례 다수 보고
- 권장: CT 모니터링 + CAA 레코드로 대체

### HashiCorp Vault

#### PKI Secrets Engine
- **동적 인증서 발급**: API 요청 시 즉시 인증서 생성
- 기본 TTL **30일**, 요청 시 조정 가능
- 완전한 **감사 로그** (누가, 언제, 어떤 인증서를 발급받았는지 추적)

#### 권장 계층 구조
```
Root CA (오프라인, air-gapped)
  └── Intermediate CA (Vault PKI Engine)
        └── Leaf Certificate (30-90일, 동적 발급)
```

#### 단기 인증서 전략
- CRL/OCSP 없이 **만료로 폐기를 대체**
- 인증서가 유출되어도 수 시간~수일 내 만료되므로 피해 범위 제한

### Kubernetes / CNCF

#### cert-manager
- **CNCF Graduated** 프로젝트 (2024년 11월)
- 월간 다운로드 **5억 회**
- 프로덕션 Kubernetes 클러스터의 **86%**에서 사용
- Let's Encrypt, Vault, step-ca, 자체 CA 등 다양한 Issuer 지원

#### SPIFFE/SPIRE
- **CNCF Incubating** 프로젝트
- 워크로드 신원 표준
- 이기종 인프라(멀티 클라우드, 하이브리드)에서의 통합 신원 관리

#### Uber 사례
- **4,500개 서비스**, **25만 노드**, **4개 클라우드 제공자** 환경에서 SPIFFE/SPIRE 운영
- 대규모 이기종 환경에서 워크로드 신원 기반 인증의 실현 가능성을 입증

### Apple

#### SC-081v3 (47일 인증서)
- CA/Browser Forum에서 **통과**
- 단계적 시행:

| 시행일 | 최대 유효기간 |
|--------|-------------|
| 2026-03-15 | 200일 |
| 2027-03-15 | 100일 |
| 2029-03-15 | **47일** |

#### ATS (App Transport Security)
- iOS/macOS 앱에서 **TLS 1.2 이상 필수**
- HTTP 통신 시 명시적 예외 선언 필요
- 앱 생태계 전체의 보안 수준을 강제적으로 끌어올림

### AWS

#### ACM (AWS Certificate Manager)
- 공개 인증서 **완전 무료** + 완전 자동 관리
- 만료 **80일 전** 자동 갱신
- ELB, CloudFront, API Gateway 등과 네이티브 연동

#### Private CA
- 내부 서비스용 사설 CA
- EKS(Elastic Kubernetes Service)와 연동 가능
- 조직 규모의 내부 PKI 운영

#### IoT Fleet Provisioning
- IoT 장치 인증서 자동 발급의 세 가지 방법:
  - **JITP** (Just-In-Time Provisioning): 장치 최초 연결 시 자동 프로비저닝
  - **JITR** (Just-In-Time Registration): 장치 인증서 자동 등록
  - **Fleet Provisioning**: **가장 확장성 높은 방법**. 클레임 인증서로 대량 장치 자동 등록

### Microsoft

#### AD CS (Active Directory Certificate Services)
- 온프레미스 엔터프라이즈 PKI의 사실상 표준
- Active Directory 통합으로 도메인 조인 장치에 자동 인증서 배포
- Group Policy를 통한 대량 관리

#### Azure Key Vault
- **HSM(Hardware Security Module) 기반** 키 보호
- 파트너 CA(DigiCert 등)와 연동하여 자동 갱신
- 인증서 수명 주기 관리(생성, 저장, 갱신, 폐기)

---

## 13. 빅테크 공통 패턴 요약

### 1. 단기 인증서 + 자동화가 표준

| 기업 | 인증서 유효기간 | 자동화 도구 |
|------|--------------|------------|
| Google (ALTS) | 수 시간 | Borg-managed |
| Netflix (Metatron) | 4일 | Metatron |
| Meta | 10일 | 내부 시스템 |
| Cloudflare | 다양 | 자체 시스템 |
| Vault 권장 | 30-90일 | PKI Engine |
| Apple 의무화 | 47일 (2029~) | ACME 필수 |

### 2. "폐기 대신 단기 만료"

기존 방식의 문제:
- CRL은 크기가 계속 커짐
- OCSP는 개인정보 문제 + 가용성 의존

빅테크 해결책:
- 인증서 유효기간을 극단적으로 줄여 **유출되어도 곧 만료**되게 함
- Netflix(4일), Meta(10일), Google ALTS(수 시간)

### 3. Workload Identity > IP 기반 신뢰

| 구형 모델 | 현대적 모델 |
|----------|-----------|
| IP 주소로 서비스 식별 | 워크로드 신원(Identity)으로 식별 |
| 네트워크 경계로 보안 | Zero Trust: 모든 요청을 검증 |
| 정적 자격 증명 | 동적, 자동 발급 자격 증명 |
| 방화벽 규칙 | mTLS + 서비스 메시 |

대표 기술: SPIFFE/SPIRE, Google ALTS, Istio/Linkerd

### 4. Certificate Pinning 퇴조

| 시점 | 사건 |
|------|------|
| 2018 | HPKP deprecated (Chrome 67에서 제거) |
| 2024 Q3 | 핀닝 관련 인시던트 급증 (Cloudflare 보고) |
| 현재 | **CT 모니터링 + CAA 레코드**로 대체 추세 |

핀닝의 근본적 문제: 인증서 교체 시 핀이 불일치하면 **자해 서비스 거부(self-DoS)**가 발생한다.

### 5. 규모별 접근

| 규모 | 권장 솔루션 | 사례 |
|------|-----------|------|
| **스타트업/소규모** | Let's Encrypt + certbot | 대부분의 웹 서비스 |
| **중간 규모** | step-ca 또는 Vault PKI | 내부 서비스 50-500개 |
| **대규모** | 자체 PKI + Service Mesh | Google, Netflix, Meta |
| **초대규모/멀티클라우드** | SPIFFE/SPIRE | Uber (25만 노드, 4개 클라우드) |

---

## 14. References

### 표준 및 RFC
- RFC 2246 - TLS 1.0: https://tools.ietf.org/html/rfc2246
- RFC 4346 - TLS 1.1: https://tools.ietf.org/html/rfc4346
- RFC 5246 - TLS 1.2: https://tools.ietf.org/html/rfc5246
- RFC 5280 - Internet X.509 PKI: https://tools.ietf.org/html/rfc5280
- RFC 6125 - Service Identity Verification: https://tools.ietf.org/html/rfc6125
- RFC 6962 - Certificate Transparency: https://tools.ietf.org/html/rfc6962
- RFC 7292 - PKCS#12: https://tools.ietf.org/html/rfc7292
- RFC 8446 - TLS 1.3: https://tools.ietf.org/html/rfc8446
- RFC 8555 - ACME: https://tools.ietf.org/html/rfc8555
- RFC 9525 - Service Identity (RFC 6125 update): https://tools.ietf.org/html/rfc9525
- NIST SP 800-52 Rev. 2: https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final

### 학술 논문
- Diffie, W. & Hellman, M. (1976). "New Directions in Cryptography." IEEE Transactions on Information Theory, Vol. 22.
- Rivest, R., Shamir, A. & Adleman, L. (1977). "A Method for Obtaining Digital Signatures and Public-Key Cryptosystems." MIT.

### 도구 및 프로젝트
- Let's Encrypt: https://letsencrypt.org/
- cert-manager: https://cert-manager.io/
- step-ca (Smallstep): https://smallstep.com/docs/step-ca/
- HashiCorp Vault PKI: https://developer.hashicorp.com/vault/docs/secrets/pki
- SPIFFE/SPIRE: https://spiffe.io/
- mkcert: https://github.com/FiloSottile/mkcert
- CFSSL: https://github.com/cloudflare/cfssl
- Istio: https://istio.io/
- Linkerd: https://linkerd.io/

### 빅테크 기술 문서
- Google BeyondProd: https://cloud.google.com/security/beyondprod
- Google ALTS: https://cloud.google.com/security/encryption-in-transit/application-layer-transport-security
- Netflix Lemur: https://github.com/Netflix/lemur
- Meta Fizz: https://github.com/facebookincubator/fizz
- Cloudflare Universal SSL: https://blog.cloudflare.com/introducing-universal-ssl/
- AWS ACM: https://docs.aws.amazon.com/acm/
- AWS IoT: https://docs.aws.amazon.com/iot/latest/developerguide/
- Microsoft AD CS: https://learn.microsoft.com/en-us/windows-server/identity/ad-cs/

### 보안 사건 및 분석
- DigiNotar 사건 분석: https://en.wikipedia.org/wiki/DigiNotar
- SHAttered (SHA-1 충돌): https://shattered.io/
- ALPACA 공격: https://alpaca-attack.com/
- CVE-2021-22939: https://nvd.nist.gov/vuln/detail/CVE-2021-22939
- Apple SC-081v3: https://cabforum.org/2025/04/ballot-sc-081v3/

### 테스트 도구
- SSL Labs Server Test: https://www.ssllabs.com/ssltest/
- HSTS Preload 등록: https://hstspreload.org/
