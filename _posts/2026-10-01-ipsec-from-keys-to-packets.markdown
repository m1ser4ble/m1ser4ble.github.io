---
layout: single
title: "IPsec을 처음부터: 인증 재료에서 DH, IKE_AUTH, 방향별 SA와 ESP 패킷까지"
date: 2026-10-01 00:00:00 +0900
permalink: /system/ipsec-from-keys-to-packets/
categories: [system]
excerpt: "PSK와 DH 비밀은 왜 다른가, 인증은 언제 하는가, 단방향 SA는 무엇인가. 하나의 패킷을 따라 IKEv2·ESP·Linux XFRM과 VPN 자격 증명 발급까지 연결한다."
toc: true
toc_sticky: true
tags: [ipsec, ikev2, esp, diffie-hellman, authentication, xfrm, vpn, svg, motion-design]
---

<link rel="stylesheet" href="{{ '/assets/css/ipsec-guide.css' | relative_url }}">
<script src="{{ '/assets/js/ipsec-guide.js' | relative_url }}" defer></script>

IPsec을 이해하기 어려운 이유는 암호 알고리즘 하나가 아니라 **서로 다른 일을 하는 재료와 절차를 모두 ‘키 교환’이라고 부르기 때문**이다. 미리 설정한 비밀, 연결 중에 계산한 비밀, 상대를 확인하는 증명값, 패킷을 암호화하는 키를 분리하면 흐름이 보인다.

이 글은 IPsec 질의응답에서 반복된 혼동을 학습 순서로 다시 구성했다. 대화의 답변을 그대로 옮기지 않고, 프로토콜 동작은 RFC 원문으로 확인했다. 원문 대화·사용자 정보·실제 장비의 비밀값은 싣지 않는다.

<div class="ipsec-guide-note" data-visual-version="svg-v1" markdown="1">
**처음 읽는 순서:** 1–6절에서 **사전 신뢰 → DH → 키 파생 → 상대 인증**을 잇고, 7–9절에서 **방향별 SA → 실제 패킷 보호**를 따라가자. HTTPS·P2P 비교는 10–11절, Linux·웹 로그인·장애 진단은 12–15절에서 필요할 때 읽으면 된다. 모션은 자동 재생하지 않으며, 재생·속도·슬라이더로 한 단계씩 확인할 수 있다.
</div>

**먼저 기억할 한 문장:**

> 인증 재료는 연결 전에 준비한다. 연결에서는 DH로 아직 인증되지 않은 키 재료를 만들고, IKE_AUTH에서 그 교환의 상대를 검증한다. 성공한 연결의 데이터는 별도로 파생한 방향별 ESP 키와 SA로 보호한다.[1]

## 1. 먼저 보안 경계와 역할을 나눈다

다음 예시를 끝까지 사용하자. Host A의 TCP 패킷을 Host B로 보내고, 두 게이트웨이 사이의 네트워크는 신뢰하지 않는다. 주소는 설명용이며 실제 인터넷 접속 대상으로 사용하지 않는다.

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/gateway-protection-topology.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="게이트웨이 사이의 보호 경계 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/gateway-protection-topology.svg' | relative_url }}" alt="게이트웨이 사이의 보호 경계" loading="lazy" style="width:100%;max-width:270.22px;height:auto;" />
  </a>
  <figcaption>게이트웨이 사이의 보호 경계 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

Gateway A↔Gateway B만 ESP 보호 경계다. 양쪽 LAN은 이 ESP의 암호화 범위에 들어가지 않는다.

여기서 IPsec의 끝점은 **Gateway A와 Gateway B**다. 게이트웨이 사이만 ESP로 보호한다면, Host A와 Gateway A 사이의 LAN까지 자동으로 암호화되는 것은 아니다. 종단 간 애플리케이션 보호가 필요하면 TLS 같은 별도의 경계를 함께 설계해야 한다.[2][3]

| 이름 | 풀어 쓰면 | 이 예시에서 하는 일 |
|---|---|---|
| IKEv2 | Internet Key Exchange version 2 | 피어 인증, 알고리즘·트래픽 범위 협상, SA 수립과 관리 |
| SA | Security Association | 알고리즘·키·SPI·순번 등 특정 보호 관계의 실행 상태 |
| ESP | Encapsulating Security Payload | SA를 사용해 실제 IP 패킷을 보호 |
| SPD | Security Policy Database | 어떤 패킷을 보호·통과·폐기할지 결정 |
| SAD | Security Association Database | 실제 보호에 필요한 SA 상태를 보관 |

IKE는 제어 프로토콜이고 ESP는 데이터 보호 프로토콜이다. **사용자 TCP 데이터를 IKE_AUTH에 실어 보내는 것이 아니다.** IKE가 준비한 상태를 ESP가 사용한다.[1][2][3]

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/roles.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="IKE 제어 관계와 두 방향의 ESP 데이터 SA 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/roles.svg' | relative_url }}" alt="IKE 제어 관계와 두 방향의 ESP 데이터 SA" loading="lazy" />
  </a>
  <figcaption>IKE 제어 채널 하나와 방향별 ESP SA 두 개의 역할을 구분한다. 도식을 누르면 크게 볼 수 있다.</figcaption>
</figure>

그림을 글로 읽으면 **양방향 IKE 제어 관계 하나가 데이터용 ESP SA 두 방향을 관리한다**는 뜻이다. IKE SA 안에도 방향별 보호 키가 있지만, ESP처럼 관계 자체를 두 개의 단방향 SA로 나누어 부르는 것은 아니다.[1] (RFC §2.2, §2.14)[2] (RFC §4.1)

### 암호 기술도 역할별로 나눈다

| 작업 | 예시 기술 | 입력과 결과 |
|---|---|---|
| 키 합의 | DH / ECDH | 자기 비밀값과 상대 공개값 → 같은 비밀 `Z` |
| 키 파생 | PRF 기반 KDF | `Z`, nonce, 문맥 → 용도별 대칭키 |
| 상대 인증 | PSK 기반 AUTH 또는 전자서명 | 인증 자격과 이번 교환 → 검증할 증명 |
| 메시지·패킷 보호 | AES-GCM | 대칭키, nonce, 평문·관련 데이터 → 암호문과 tag |

**비대칭 암호 기술 = 공개키로 메시지를 암호화하고 개인키로 복호화하는 기술**이라는 등식은 틀리다. DH는 키 합의이고 전자서명은 서명·검증이다. PSK 인증을 선택해 인증서를 쓰지 않더라도, 여기서 설명하는 기본 IKEv2의 DH 키 합의는 그대로 수행한다.[1] (RFC §1.2, §2.14–2.15)

AES-GCM은 대칭키 기반 **AEAD(Authenticated Encryption with Associated Data)**다. 암호화와 변조 검출을 함께 제공하지만, 그것만으로 ‘상대가 내가 기대한 회사 게이트웨이인가’를 확인하지는 않는다.[4][5]

## 2. 연결 전에 준비하는 것과 연결 중 인증하는 시점

우선 PSK 방식 하나만 따라간다. **PSK = pre-shared authentication secret**, 즉 사전 공유 인증용 비밀이라고 구체적으로 부르자. DH 결과는 **Z = DH secret**이라고 부른다. 둘 다 양쪽이 아는 비밀일 수 있지만 출처와 용도가 다르다.[1] (RFC §2.14–2.15)

### 2.1. PSK는 누가 어떻게 양쪽에 넣는가

관리자가 충분히 예측하기 어려운 무작위 PSK를 생성하고, A와 B의 설정에 같은 값을 넣는다. 장비의 로컬 관리, 서버 신원을 검증한 SSH, 이미 신뢰하는 비밀 배포 시스템 등 **IKE 연결과 독립된 신뢰 경로**가 필요하다. 이는 배포 설계이며, IKE가 최초 PSK를 안전하게 배송해 준다는 뜻이 아니다.[1] (RFC §2.15)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/psk-trusted-provisioning.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="연결 전 PSK 배포와 연결 중 IKE 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/psk-trusted-provisioning.svg' | relative_url }}" alt="연결 전 PSK 배포와 연결 중 IKE" loading="lazy" style="width:100%;max-width:268.07px;height:auto;" />
  </a>
  <figcaption>연결 전 PSK 배포와 연결 중 IKE — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

관리자는 독립된 신뢰 경로로 A와 B에 같은 PSK를 설정한다. 연결 중에는 IKE 인증 증명을 보내며 PSK 자체를 payload로 전송하지 않는다.

‘공격자는 왜 PSK를 모르는가?’의 답은 **DH가 PSK를 숨겨 주기 때문이 아니라, 사전에 안전하게 배포했고 유출되지 않았다고 가정하기 때문**이다. 배포 경로가 노출되거나 PSK가 추측 가능하면 그 전제가 무너진다. 사람이 고른 짧은 비밀번호를 PSK로 쓰는 방식은 사전 공격 위험이 있다.[1] (RFC §2.15)

### 2.2. 준비 완료는 상대 인증 완료가 아니다

인증서 방식에서는 개인키·인증서·신뢰 기준을, EAP 방식에서는 선택한 방법의 계정·인증서 등 자격을 준비한다. **재료를 갖추는 시점은 연결 전, 그 재료로 실제 피어를 검증하는 시점은 DH 이후의 IKE_AUTH**다.[1] (RFC §1.2, §2.15–2.16)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/authentication-gate.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="사전 준비, DH, IKE_AUTH 인증과 ESP 사용의 시간 순서 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/authentication-gate.svg' | relative_url }}" alt="사전 준비, DH, IKE_AUTH 인증과 ESP 사용의 시간 순서" loading="lazy" />
  </a>
  <figcaption>실제 피어 인증은 DH 뒤의 IKE_AUTH에서 이루어지며, 인증 실패 시 데이터 연결을 승인하지 않는다. 도식을 누르면 크게 볼 수 있다.</figcaption>
</figure>

**키가 계산됐다는 사실은 연결을 승인했다는 뜻이 아니다.** 인증 전 키는 IKE_AUTH 대화를 보호하는 데 쓰지만, 그것을 근거로 상대 신원을 신뢰하거나 사용자 데이터를 정상 ESP 연결로 받아들여서는 안 된다.[1] (RFC §1.2)

## 3. DH를 작은 숫자로 직접 계산한다

DH(Diffie–Hellman)는 메시지를 암호화하는 알고리즘이 아니라 **공유 비밀을 합의하는 알고리즘**이다. 아래는 유한체 DH의 원리 설명용이다. 숫자가 너무 작아 누구나 비밀값을 찾을 수 있으므로 보안에 사용할 수 없다.

양쪽이 공개된 규칙 `p=23`, `g=5`를 사용한다고 하자. `mod 23`은 23으로 나눈 나머지다.

### 3.1. 각자 비밀값을 고르고 공개값을 만든다

```text
A chooses a = 6                  B chooses b = 15
X = g^a mod p                    Y = g^b mod p
  = 5^6 mod 23 = 8                 = 5^15 mod 23 = 19
```

A는 `a`를, B는 `b`를 밖으로 보내지 않는다. 네트워크에서는 `X=8`, `Y=19`만 교환한다. 이 공개값이 IKE의 `KEi/KEr` payload에 들어갈 DH 값에 해당한다.[1] (RFC §1.2, §3.4)

### 3.2. 상대 공개값에 자기 비밀값을 적용한다

```text
A computes:                      B computes:
Z = Y^a mod p                    Z = X^b mod p
  = 19^6 mod 23 = 2                = 8^15 mod 23 = 2

Both obtain Z = g^(a*b) mod p = 2.
```

서로 비밀값을 보내지 않았는데 같은 결과가 나오는 이유는 `(g^b)^a = (g^a)^b`이기 때문이다. 안전한 실제 그룹에서는 공개값으로부터 비밀값이나 `Z`를 계산하기 어렵다는 보안 가정이 중요하다. ECDH는 타원곡선의 다른 연산을 쓰므로 위의 작은 정수 거듭제곱을 그대로 사용하지 않는다.[1] (RFC §2.14, §3.4)

재현할 수 있는 Python 계산은 다음과 같다. 출력은 실제 계산으로 확인했다.

```python
p, g, a, b = 23, 5, 6, 15
X = pow(g, a, p)
Y = pow(g, b, p)
print(X, Y, pow(Y, a, p), pow(X, b, p))
# 8 19 2 2
```

### 3.3. 어디까지가 DH이고 어디부터가 다른 작업인가

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/crypto-role-boundaries.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="DH·KDF·AUTH·AEAD의 다른 역할 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/crypto-role-boundaries.svg' | relative_url }}" alt="DH·KDF·AUTH·AEAD의 다른 역할" loading="lazy" style="width:100%;max-width:283.62px;height:auto;" />
  </a>
  <figcaption>DH·KDF·AUTH·AEAD의 다른 역할 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

DH는 공유 비밀 Z를 합의하고 KDF는 용도별 키를 파생한다. AUTH는 자격을 이번 교환에 결합해 피어를 증명하고 AEAD는 대칭키와 패킷 nonce로 암호문과 tag를 만든다. AUTH와 AEAD tag는 서로 다른 검증이다.

**KDF != DH**다. DH가 `Z`를 만든 뒤 PRF 기반 키 파생으로 IKE 키와 이후 ESP 키 재료를 나눈다. PSK는 `a`, `b`, `X`, `Y`, `Z` 중 어느 것도 아니다.[1] (RFC §2.14–2.17)

아래 애니메이션은 ‘미리 있던 PSK’와 ‘방금 계산한 Z’를 분리하고, Z에서 용도별 키가 생기는 흐름을 보여준다. 움직임 없이도 도식과 본문의 입력·출력 설명으로 같은 관계를 확인할 수 있다.

<iframe class="ipsec-explainer-frame" src="{{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=keys" title="SVG 설명 모션: PSK와 DH 비밀 Z, IKE와 ESP 키의 분리" loading="lazy" style="width:100%;height:900px;border:1px solid #29415f;border-radius:16px;background:#f5f5ee;" allow="fullscreen"></iframe>

[애니메이션을 별도 화면에서 열기: PSK와 DH 비밀 분리]({{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=keys){: .btn .btn--primary target="_blank" rel="noopener"}

## 4. IKE_SA_INIT: 공개 교환에서 IKE 보호 키까지

A를 먼저 요청하는 **initiator**, B를 **responder**라고 하자. 선택적 payload와 오류 처리를 생략한 첫 교환은 다음과 같다.[1] (RFC §1.2)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/ike-sa-init-exchange.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="IKE_SA_INIT의 공개 교환 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/ike-sa-init-exchange.svg' | relative_url }}" alt="IKE_SA_INIT의 공개 교환" loading="lazy" style="width:100%;max-width:287.3px;height:auto;" />
  </a>
  <figcaption>IKE_SA_INIT의 공개 교환 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

A는 initiator, B는 responder다. SAi1/SAr1은 IKE 알고리즘 제안·선택이고 KEi/KEr와 Ni/Nr는 공개 DH 값과 nonce다. 이 평문 교환 후 양쪽이 로컬에서 Z와 IKE 키를 계산하지만 피어 인증은 아직 완료되지 않았다.

- `HDR`: IKE 헤더. IKE SA를 식별하는 SPI 등의 정보가 있다.
- `SAi1/SAr1`: IKE용 알고리즘 제안과 선택. 여기서 정하는 것은 우선 **IKE 메시지 보호 방식**이다.
- `KEi/KEr`: 합의한 그룹의 DH 공개값.
- `Ni/Nr`: 각자가 생성한 새로운 nonce 값. 비밀이 아니라 키 파생과 인증 문맥에 쓰는 공개 입력이다.[1] (RFC §1.2, §2.10, §2.14)

이 교환 자체는 **평문이며 아직 상대 신원이 인증되지 않았다.** 나중에 사용할 대칭키를 그대로 보내는 것도 아니다. 양쪽이 받은 공개값과 자기 비밀값으로 Z를 계산하고, 같은 입력으로 로컬에서 키를 파생한다.[1] (RFC §1.2, §2.14)

### 4.1. ‘같은 키를 만든다’의 실제 의미

양쪽은 같은 Z와 nonce, 합의한 알고리즘으로 **같은 키 재료를 각자 계산**한다. 결과는 키 하나가 아니라 IKE 메시지 보호·인증 계산·Child SA 파생처럼 **용도별로 분리된 값**이다. 정확한 식은 선택적으로 펼쳐 볼 수 있으며, 먼저 아래 표의 역할만 이해해도 흐름을 따라갈 수 있다.[1] (RFC §2.14)

<details markdown="1">
<summary>선택 심화: SKEYSEED와 IKE 키 파생의 정확한 식</summary>

`prf(K, D)`는 키 `K`로 데이터 `D`를 처리하는 의사난수 함수다. `prf+`는 그 출력을 필요한 길이까지 확장하는 규격의 구성이고, `|`는 바이트 연결이다. 다음은 RFC 7296 §2.14의 기본식이며 `g^ir`을 이 글의 `Z`로 표기했다.[1]

```text
SKEYSEED = prf(Ni | Nr, Z)

SK_d | SK_ai | SK_ar | SK_ei | SK_er | SK_pi | SK_pr
    = prf+(SKEYSEED, Ni | Nr | SPIi | SPIr)
```

첫 식에서는 **공개 nonce를 합친 값이 PRF의 키 입력이고 Z가 데이터 입력**이다. ‘PRF에 키라고 적혀 있으니 반드시 사전 비밀이어야 한다’는 뜻이 아니다. 출력의 비밀성은 여기서 DH의 비밀 Z에 의존한다. nonce의 특수 처리가 있는 AES-XCBC/AES-CMAC PRF 예외는 RFC 원문을 따르며, 이 글은 일반식으로 구조를 설명한다.[1] (RFC §2.14)

</details>

| 파생 값 | 소비하는 곳 | 혼동하지 말아야 할 것 |
|---|---|---|
| `SK_ei`, `SK_er` | 원래 initiator 방향 / responder 방향 IKE 암호화 | ESP 데이터 키가 아님 |
| `SK_ai`, `SK_ar` | 별도 무결성 알고리즘을 쓸 때 IKE 무결성 | AEAD에서는 별도 키를 사용하지 않음 |
| `SK_pi`, `SK_pr` | AUTH 계산의 신원 결합 | 관리자가 배포한 PSK가 아님 |
| `SK_d` | Child SA 키 재료 파생 | IKE 메시지를 직접 암호화하는 키가 아님 |

각 방향의 송신자와 수신자는 **그 방향에 대응하는 같은 대칭키 재료**를 계산한다. A의 `SK_ei`로 보호한 IKE 메시지는 B의 대응 `SK_ei`로 처리하고, B 방향에는 `SK_er`를 사용한다.[1] (RFC §2.14)

`SPIi/SPIr`는 IKE SA용 식별자다. 나중에 ESP 패킷에 붙는 방향별 ESP SPI와 다른 공간의 값이다. IKE 헤더에는 두 IKE SPI가 있고, ESP 헤더에는 해당 수신 SA의 SPI 하나가 있다.[1] (RFC §2.6)[3] (RFC §2.1)

### 4.2. AES-GCM을 선택하면 무엇이 달라지는가

IKE에 AES-GCM을 선택하면 `SK_ei/SK_er`의 키 재료에 AES 키와 salt가 포함되고, `SK_ai/SK_ar`는 길이 0으로 처리한다. AEAD를 선택한 SA에는 별도의 integrity transform을 선택하지 않는다. **하지만 PRF, DH, 피어 AUTH는 여전히 필요하다.**[5] (RFC §7.1, §8)[1] (RFC §2.14–2.15)

ESP도 AES-GCM을 사용할 수 있으나 **IKE와 ESP는 별도로 협상한다.** IKE에서 AES-GCM을 골랐다고 ESP까지 자동으로 같은 알고리즘이 되는 것은 아니다. 둘 다 AES-GCM이어도 키와 nonce 문맥을 공유하는 것은 아니다.[1] (RFC §1.2, §2.17)[4][5]

## 5. IKE_AUTH: ‘그 키를 만든 상대가 누구인가’를 검증한다

PSK 기본 경로에서 다음 교환은 IKE 키로 보호된다. `SK{...}`는 암호화·무결성 보호되는 payload를 묶은 표기이며, 외부 IKE 헤더까지 암호화한다는 뜻은 아니다.[1] (RFC §1.2)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/ike-auth-protected-payloads.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="IKE_AUTH의 보호 payload와 피어 인증 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/ike-auth-protected-payloads.svg' | relative_url }}" alt="IKE_AUTH의 보호 payload와 피어 인증" loading="lazy" style="width:100%;max-width:276.25px;height:auto;" />
  </a>
  <figcaption>IKE_AUTH의 보호 payload와 피어 인증 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

외부 IKE HDR은 암호화되지 않는다. SK 내부에는 ID, AUTH, Child SA 제안·선택과 TSi/TSr가 들어간다. IKE 메시지 보호의 tag와 자격 기반 AUTH 검증을 구분하며 인증과 Child SA 협상 모두 성공해야 데이터 SA를 사용할 수 있다.

한 메시지 안에 두 작업이 있다. **IKE AEAD tag는 이 보호 메시지의 변조를 검출하고, AUTH는 기대한 인증 자격을 가진 피어가 이번 교환에 참여했다는 증명을 제공한다.** DH에 개입한 공격자가 자기 쪽 IKE 키를 알아도 AUTH까지 만들 수 있는 것은 아니다.[1] (RFC §2.15)[5]

### 5.1. PSK 방식의 AUTH를 정확히 보면

PSK 자체를 보내지 않고, **그 PSK를 알고 있는 상대만 만들 수 있는 이번 교환의 증명값**을 보낸다. 받은 쪽은 자기 PSK와 같은 교환 정보를 사용해 예상값을 계산한다. 아래를 펼치면 ‘이번 교환’이 정확히 어떤 바이트를 뜻하는지 확인할 수 있다.[1] (RFC §2.15)

<details markdown="1">
<summary>선택 심화: PSK AUTH 공식과 SignedOctets의 정확한 범위</summary>

아래는 의미만 그린 가짜 식이 아니라 RFC 7296 §2.15의 PSK 계산 구조다. `SignedOctets_A/B`는 바로 아래에서 정의한다.[1]

```text
K_auth = prf(PSK, "Key Pad for IKEv2")
AUTH_A = prf(K_auth, SignedOctets_A)
AUTH_B = prf(K_auth, SignedOctets_B)

SignedOctets_A = RealMessage1 | Nr | prf(SK_pi, IDi')
SignedOctets_B = RealMessage2 | Ni | prf(SK_pr, IDr')
```

- `RealMessage1`: A의 IKE_SA_INIT 요청, IKE 헤더부터 마지막 payload까지의 실제 바이트.
- `RealMessage2`: B의 IKE_SA_INIT 응답, 같은 범위의 실제 바이트.
- `Nr/Ni`: **상대방 nonce의 값**. nonce payload 헤더는 제외한다.
- `IDi'/IDr'`: ID payload의 고정 payload 헤더를 제외한 부분. ID type·reserved·identity data를 포함한다.
- `"Key Pad for IKEv2"`: 규격의 고정 ASCII 문자열. NUL 종료 문자는 붙이지 않는다.[1] (RFC §2.15)

`RealMessage`에는 IP/UDP 헤더나 UDP 4500의 Non-ESP Marker를 넣지 않는다. COOKIE나 DH 그룹 변경으로 초기 요청을 재시도했다면 마지막 실제 초기 교환 메시지를 사용한다. 구현에서는 위 식을 문자열로 대충 재조립하지 말고 규격의 정확한 바이트 범위를 사용해야 한다.[1] (RFC §2.15)

이름이 `SignedOctets`여도 PSK 방식에서 전자서명을 하는 것은 아니다. 같은 인증 대상 바이트에 **PSK 기반 PRF 증명**을 계산한다. 또한 ‘양쪽 초기 메시지와 모든 이후 메시지를 무조건 이어 붙인 전체 transcript’라는 설명도 정확하지 않다. 각자의 초기 메시지, 상대 nonce, 파생 키로 처리한 자신의 ID라는 지정된 구조다.[1] (RFC §2.15)

</details>

B는 받은 `AUTH_A`를 B가 계산한 **예상 AUTH_A**와 비교한다. A의 AUTH와 B의 AUTH를 서로 비교하는 것이 아니다. 두 방향은 인증 대상이 달라 원래 같은 값일 필요가 없다.[1] (RFC §2.15)

### 5.2. DH에 끼어든 MITM은 왜 AUTH를 통과하지 못하는가

MITM(Man-in-the-Middle) 공격자 M이 DH 공개값을 바꿔 두 연결을 만들었다고 하자.

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/dh-mitm-two-legs.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="DH 두 갈래와 AUTH 실패 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/dh-mitm-two-legs.svg' | relative_url }}" alt="DH 두 갈래와 AUTH 실패" loading="lazy" style="width:100%;max-width:276.27px;height:auto;" />
  </a>
  <figcaption>DH 두 갈래와 AUTH 실패 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

공개값을 바꾼 M은 A↔M의 Z_AM·IKE keys 1과 M↔B의 Z_MB·IKE keys 2를 계산할 수 있다. 하지만 안전하게 배포된 PSK를 모르면 변경된 교환에 맞는 AUTH를 만들 수 없고, 복사한 증명도 교환 문맥이 달라 검증에 실패한다.

M은 자기가 참여한 두 DH의 Z와 IKE 키를 계산할 수 있다. **따라서 ‘IKE_AUTH가 암호화됐으니 중간자는 아무것도 못 본다’만으로 안전성을 설명하면 틀린다.** 실제 RFC도 이런 능동적 공격자가 initiator의 신원을 볼 수 있음을 명시한다.[1] (RFC §1.2)

그러나 M이 공개값을 바꿨다면 초기 메시지가 달라지고, DH에서 파생한 `SK_pi/SK_pr`에 결합된 ID 값도 달라진다. 다른 연결의 AUTH를 복사해 전달해도 검증자가 기대하는 SignedOctets와 맞지 않는다. M은 안전하게 배포된 PSK를 모르므로 변경된 교환에 맞는 AUTH를 새로 계산할 수도 없다.[1] (RFC §2.14–2.15)

반대로 M이 공개값과 메시지를 바꾸지 않고 전달만 한다면 A와 B가 합의한 Z를 알지 못한다. 통신 경로의 전달자는 될 수 있어도, 정상적인 암호를 깨지 않고 내용을 복호화하는 MITM은 되지 못한다. 이는 **강한 비밀, 올바른 신원 정책, 안전한 알고리즘·구현**을 전제로 한 설명이지 모든 공격을 차단한다는 뜻은 아니다.[1] (RFC §2.15, §5)

아래 장면의 핵심은 ‘DH 두 갈래’와 ‘AUTH 검증 실패’다. 인증 실패 시 연결을 중단하며, 이미 믿고 보낸 사용자 데이터를 나중에 되찾는 구조가 아니다.

<iframe class="ipsec-explainer-frame" src="{{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=mitm" title="SVG 설명 모션: 인증 없는 DH 중간자 공격과 IKE_AUTH의 교환 결합" loading="lazy" style="width:100%;height:900px;border:1px solid #29415f;border-radius:16px;background:#f5f5ee;" allow="fullscreen"></iframe>

[애니메이션을 별도 화면에서 열기: DH 중간자와 인증 실패]({{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=mitm){: .btn .btn--primary target="_blank" rel="noopener"}

### 5.3. 인증서 방식: 같은 비밀을 배포하지 않는다

인증서 인증에서는 각 피어가 **자기 개인키**로 SignedOctets에 대한 서명을 만들고 상대가 공개키로 검증한다. 인증서는 그 공개키와 신원의 관계를 신뢰 기준에 연결한다. A의 개인키를 B에게 나눠 주거나, 양쪽에 같은 CA 개인키를 넣는 구조가 아니다.[1] (RFC §2.15)[2] (RFC §4.4.3)

검증은 두 질문을 구분해야 한다.

1. 이 인증서의 신원·신뢰 체인 등이 **내가 허용한 피어 정책**에 맞는가?
2. 지금 대화하는 상대가 그 인증서 공개키에 대응하는 개인키로 **이번 교환의 서명**을 만들었는가?[1] (RFC §2.15)[2] (RFC §4.4.3)

‘어떤 신뢰 CA가 발급했으니 모두 허용’이나 ‘인증서 파일을 받았으니 개인키 소유도 증명됨’은 잘못이다. 인증서 서명키, 임시 DH 비밀값, 파생된 IKE/ESP 대칭키는 모두 역할이 다르다.[1] (RFC §2.14–2.15)

### 5.4. EAP: 추가 인증 대화이며 자동 MFA가 아니다

EAP는 **Extensible Authentication Protocol**, 여러 인증 방법을 운반할 수 있는 프레임워크다. 비밀번호 기반 방법도, EAP-TLS 같은 인증서 기반 방법도 있다. EAP라는 이름만 보고 인증 요소 수나 보안 수준을 결정할 수 없다.[7] (RFC §1)[16]

RFC 7296 기본 EAP 경로에서는 initiator가 첫 IKE_AUTH에 AUTH를 생략해 EAP를 요청한다. responder는 **공개키 서명 기반 AUTH로 먼저 자신을 인증**하고 EAP 요청을 보낸다. 클라이언트는 서버를 검증한 뒤 선택한 EAP 대화를 수행하며, IKE_AUTH 요청/응답이 여러 번 이어질 수 있다.[1] (RFC §2.16)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/eap-authentication-stages.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="기본 키 생성형 EAP의 인증 순서 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/eap-authentication-stages.svg' | relative_url }}" alt="기본 키 생성형 EAP의 인증 순서" loading="lazy" style="width:100%;max-width:282.0px;height:auto;" />
  </a>
  <figcaption>기본 키 생성형 EAP의 인증 순서 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

클라이언트의 첫 IKE_AUTH에는 초기 AUTH가 없다. 서버는 인증서·서명 AUTH로 먼저 인증되고 이후 보호된 EAP 대화가 이어진다. 키 생성형 EAP 성공 시 얻는 MSK로 최종 AUTH를 수행한 뒤 Child SA를 완성한다. EAP 자체가 MFA를 뜻하지는 않는다.

키 생성형 EAP가 만드는 **MSK(Master Session Key)**는 최종 AUTH 계산에서 위 PSK 자리를 대신한다. 이것은 관리자가 미리 넣은 PSK도, 그대로 사용되는 ESP 암호화 키도 아니다. 이 IKE 교환에서 얻은 EAP MSK는 해당 AUTH 용도 외에 사용하지 않도록 규정되어 있다.[1] (RFC §2.15–2.16)

키를 생성하지 않는 EAP도 RFC에 처리 규칙은 있지만 사용을 권장하지 않는다. 여기서는 서버 인증과 키 생성형 EAP를 기준으로 이해하면 된다. EAP-only 등 확장 경로는 이 기본 흐름의 범위 밖이다.[1] (RFC §2.16)

**MFA(Multi-Factor Authentication)**는 서로 다른 종류의 인증 요소를 결합하는 별도의 정책이다. PSK AUTH에 OTP가 자동으로 들어가지 않으며, EAP/RADIUS를 선택했다고 MFA가 자동으로 완성되는 것도 아니다. 클라이언트의 방법·입력 UI, 게이트웨이, 인증 서버가 원하는 추가 인증을 지원하는지 확인해야 한다.[7][15][16]

## 6. 전체 연결 수립을 한 번에 이어 보기

이제 다음 문장을 끊기지 않고 읽을 수 있어야 한다.

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/ike-to-esp-lifecycle.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="사전 자격에서 ESP 패킷까지 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/ike-to-esp-lifecycle.svg' | relative_url }}" alt="사전 자격에서 ESP 패킷까지" loading="lazy" style="width:100%;max-width:286.91px;height:auto;" />
  </a>
  <figcaption>사전 자격에서 ESP 패킷까지 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

미리 배포된 PSK는 AUTH 증명에 쓰이고 초기 공개 DH 값·nonce는 Z와 잠정 IKE 키를 만드는 데 쓰인다. 보호된 IKE_AUTH에서 신원 인증과 첫 Child SA 협상을 수행한 뒤 SK_d로 별도 ESP 키를 파생한다. SA_AB와 SA_BA로 원래 IP 패킷을 보호하고 피어가 검증·복호화한다.

아래 설명 모션은 공개 교환부터 인증, 데이터 SA와 ESP 패킷까지 같은 객체를 따라간다. **PSK 기본 성공 경로, 터널 모드, AES-GCM ESP**를 한 장면 흐름으로 연결한다. 실제 암호 연산이나 패킷 캡처를 재현하는 도구가 아니라 설명용 시각화이며, 오류 처리·EAP·재키잉 등의 모든 분기를 표현하지 않는다.

이 페이지의 모션은 로컬 HTML/SVG로 동작한다. 재생 전에는 멈춰 있으며, 단계 탐색·재생 속도·키보드 조작을 지원한다. OS의 움직임 줄이기 설정에서는 최종 정지 도식으로 표시한다. 연출은 필드의 연속성과 읽을 시간을 우선하는 motion-design 지침을 적용했다.[21]

<iframe id="ipsec-flow-frame" class="ipsec-explainer-frame" src="{{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=handshake" title="SVG 설명 모션: IKEv2 연결 수립에서 ESP 패킷 보호까지 전체 흐름" loading="lazy" style="width:100%;height:900px;border:1px solid #29415f;border-radius:16px;background:#f5f5ee;" allow="fullscreen"></iframe>

[전체 애니메이션을 별도 화면에서 열기]({{ '/assets/animations/ipsec-flow-svg/index.html' | relative_url }}?topic=handshake){: .btn .btn--primary target="_blank" rel="noopener"}

텍스트로 복습하고 싶다면 [기존 IKEv2 Motion Canvas 해설]({{ '/system/ipsec-ikev2-motion-canvas/' | relative_url }})도 참고할 수 있다. 기존 해설의 Motion Canvas 예제는 별도 페이지에 보존하고, 이 글에서는 인증 재료·모드·운영 경계까지 확장한 SVG 설명 모션을 사용한다.

## 7. 첫 Child SA와 ESP 방향별 키는 별도로 만든다

### 7.1. 첫 SA 쌍은 IKE_AUTH에서 협상한다

`SAi2/SAr2`는 데이터용 ESP 알고리즘 등의 제안/선택이다. `TSi/TSr`는 **Traffic Selector**로, 내부 주소 범위·포트 범위·IP 프로토콜을 나타낸다. 응답자는 제안 범위를 좁힐 수 있다. 인증 성공과 Child SA 협상 성공은 각각 확인해야 하며, 인증된 IKE SA가 있어도 데이터 SA 수립이 실패할 수 있다.[1] (RFC §1.2, §2.9, §2.21.2)

```text
Example accepted traffic:
  TSi: 10.1.0.0/24, allowed protocols/ports
  TSr: 10.2.0.0/24, allowed protocols/ports
```

SA payload는 **협상 정보**이지 키와 완성된 커널 상태를 통째로 상대에게 보내는 컨테이너가 아니다. 양쪽은 합의한 알고리즘, 수신 SPI, 트래픽 범위와 로컬에서 파생한 키로 자기 상태를 설치한다.[1] (RFC §1.2, §2.17, §3.3)

기본 초기 연결에서 **첫 Child SA는 IKE_AUTH에 포함**된다. 그것을 만들기 위해 반드시 별도의 CREATE_CHILD_SA를 한 번 더 해야 하는 것은 아니다.[1] (RFC §2.17)

### 7.2. IKE 암호화 키를 ESP에 재사용하지 않는다

첫 Child SA의 키 재료는 다음과 같다. nonce는 초기 IKE_SA_INIT에서 가져온다.[1] (RFC §2.17)

```text
KEYMAT = prf+(SK_d, Ni | Nr)

Take separate key material for:
  A -> B ESP: K_AB, salt_AB
  B -> A ESP: K_BA, salt_BA
```

첫 Child SA에는 **별도의 새 DH 교환이 없다.** 그래도 DH와 무관한 키는 아니다. `SK_d` 자체가 초기 DH의 Z에서 파생됐기 때문이다. AES-GCM ESP라면 방향별 KEYMAT에 AES 키와 salt가 들어간다.[1] (RFC §2.14, §2.17)[4] (RFC §8.1)

### 7.3. 단방향 SA는 ‘복호화 불가능한 암호’가 아니다

A→B SA에서 A는 `K_AB`로 암호화하고 B는 **같은 K_AB**로 검증·복호화한다. B→A는 `K_BA`와 별도 상태를 사용한다. 단방향이라는 말은 트래픽 방향과 상태 관리 단위를 뜻하며, 비대칭 암호나 단방향 해시의 뜻이 아니다.[2] (RFC §4.1)[3] (RFC §3)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/directional-sas.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="양 끝점의 송신 SA와 대응 수신 SA 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/directional-sas.svg' | relative_url }}" alt="양 끝점의 송신 SA와 대응 수신 SA" loading="lazy" />
  </a>
  <figcaption>같은 방향의 대칭키는 송신·수신 양쪽에 있고, 반대 방향에는 다른 키와 상태가 있다. 도식을 누르면 크게 볼 수 있다.</figcaption>
</figure>

같은 방향의 SA에 대한 상태가 **양 끝에 대응해서 존재**한다. 키·알고리즘·SPI는 맞아야 하지만 송신 카운터와 수신 replay window까지 동일한 자료구조를 복제하는 것은 아니다.[2] (RFC §4.4.2)[3] (RFC §3.3–3.4)

SPI(Security Parameters Index)는 수신자가 SA를 찾는 식별자이고 비밀키가 아니다. 이 유니캐스트 예시에서는 **수신자 B가 A→B용 SPI를 선택**하고 A가 그 값으로 보낸다. 제품이 ‘Child SA 하나’라고 표시해도 ESP 관점에서는 보통 이 방향별 SA 한 쌍을 가리킨다.[3] (RFC §2.1)[1] (RFC §2.17)

## 8. 실제 IP 패킷 하나가 ESP로 바뀌는 과정

Host A가 만든 패킷은 `[IP: 10.1.0.10 → 10.2.0.20][TCP][Data]`다. Gateway A는 정책으로 이 패킷이 보호 대상인지 확인하고 해당 **outbound SA_AB**를 선택한다.[2] (RFC §5.1)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/esp-outbound-processing.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="Gateway A의 outbound 보호 흐름 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/esp-outbound-processing.svg' | relative_url }}" alt="Gateway A의 outbound 보호 흐름" loading="lazy" style="width:100%;max-width:282.0px;height:auto;" />
  </a>
  <figcaption>Gateway A의 outbound 보호 흐름 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

원래 IP 패킷에 PROTECT 정책을 적용하고 outbound SA_AB를 선택한다. 순번과 패킷 IV를 정한 뒤 K_AB·salt_AB로 AES-GCM 보호하여 ESP 터널 패킷을 전송한다. 실제 커널 hook 호출 순서를 고정한 도식은 아니다.

### 8.1. AES-GCM 터널 모드의 보이는 부분과 숨는 부분

다음은 기본 AES-GCM ESP 터널 패킷의 개념도다. IPv6 확장 헤더·추가 트래픽 흐름 은닉 padding 등은 생략한다.[3] (RFC §2, §3.1.2)[4] (RFC §3–6)

패킷의 바깥부터 **게이트웨이 주소가 든 외부 IP 헤더, ESP 헤더, 공개 IV, 암호문, 인증 tag** 순서다. 원래 IP 헤더·TCP·Data와 ESP trailer는 암호문 안에 들어간다. 각 필드의 보호 여부는 다음 표와 9절의 색으로 구분한 패킷 도식에서 확인할 수 있다.

| 부분 | 암호화 여부 | 의미 |
|---|---|---|
| Outer IP | 아니오 | 보호 패킷을 VPN 끝점까지 라우팅 |
| SPI·Sequence | 아니오 | SA 검색과 순번; GCM의 AAD로 인증됨 |
| Explicit IV | 아니오 | 패킷 nonce를 구성하는 공개 값 |
| Inner IP·TCP·Data·ESP trailer | 예 | 원래 내부 패킷과 필요한 후행 필드 |
| Tag | 아니오 | 인증·복호화 시 검증할 결과 |

**암호화되지 않았다고 모두 인증되지 않은 것은 아니다.** SPI와 순번은 AAD(Additional Authenticated Data)에 들어간다. 반면 외부 IP 헤더는 ESP가 직접 인증하는 범위가 아니다. 외부 주소, 길이, 타이밍 등은 여전히 관찰될 수 있다.[3] (RFC §2)[4] (RFC §5)

RFC 4106의 GCM nonce는 **4바이트 SA salt + 8바이트 explicit IV**다. 동일 키에서 IV가 반복되지 않아야 한다. 이 패킷별 nonce를 초기 IKE의 `Ni/Nr`와 혼동하면 안 된다. ‘모든 nonce는 매번 무작위로 고르면 된다’보다 **해당 알고리즘의 유일성 요구를 지킨다**가 정확하다.[4] (RFC §3.1, §4)

### 8.2. 수신자는 왜 복호화 외에 여러 검사를 하는가

Gateway B의 수신 흐름을 개념적으로 쓰면 다음과 같다.[2] (RFC §5.2)[3] (RFC §3.4)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/esp-inbound-validation.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="Gateway B의 수신 검증 흐름 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/esp-inbound-validation.svg' | relative_url }}" alt="Gateway B의 수신 검증 흐름" loading="lazy" style="width:100%;max-width:277.52px;height:auto;" />
  </a>
  <figcaption>Gateway B의 수신 검증 흐름 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

수신 ESP의 SPI와 구현 문맥으로 inbound SA를 찾고 선택적으로 예비 anti-replay 검사를 한다. 해당 SA 키로 인증·복호화가 성공한 뒤에만 replay 상태를 확정하며, 복원 패킷의 허용 selector·정책을 검사한 뒤 Host B에 전달한다. 검증되지 않은 평문은 전달하지 않는다.

SPI 외에 주소·프로토콜 등의 문맥을 쓰는 구현도 있다. AES-GCM 인증·복호화는 결합된 처리이며, 위 순서는 개념적 검사 관계를 나타낸다. 검증하지 않은 평문을 상위 계층에 먼저 전달해도 된다는 뜻이 아니다.[2] (RFC §4.1)[3] (RFC §3.4)[4]

재전송 공격은 공격자가 정상 패킷을 녹화했다가 다시 보내는 것이다. 복제 패킷의 tag는 여전히 유효할 수 있으므로, **tag 검증만으로 ‘이미 처리한 패킷’을 구별하지 못한다.** 수신자가 anti-replay를 사용할 때 SA별 순번과 sliding window로 중복·오래된 패킷을 걸러낸다. 위조된 큰 순번이 창을 밀지 못하도록 인증 전에 상태를 확정 갱신하지 않는다.[3] (RFC §3.4.3)

ESP 순번은 새 SA에서 첫 패킷이 1이다. 응답은 `SA_AB`를 거꾸로 쓰지 않고 **SA_BA의 독립 순번과 K_BA**를 사용한다. 매 패킷마다 IKE를 다시 실행하지는 않는다.[3] (RFC §3.3.3)[1] (RFC §2.17)

## 9. 터널 모드와 전송 모드: 주소가 어디에 남는가

‘Original IP’는 특별한 주소 종류가 아니라 **IPsec을 적용하기 전에 있던 IP 헤더**다. 사설 주소, 공인 주소, VPN에서 할당한 주소 중 무엇이든 원래 헤더에 들어갈 수 있다.[3] (RFC §3.1)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/esp-packet-comparison.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="원본·전송·터널 패킷과 암호화·인증 경계 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/esp-packet-comparison.svg' | relative_url }}" alt="원본 패킷, ESP 전송 모드, ESP 터널 모드의 정렬된 비교. 전송은 TCP·Data·trailer, 터널은 원본 IP까지 암호화하며 IV·Tag는 암호문 밖에 있다." loading="lazy" />
  </a>
  <figcaption>색으로 둘러싼 영역이 암호화되는 필드다. ESP 헤더는 AAD로 인증되고, 외부 IP는 ESP 인증 범위 밖이다. 개념적 필드 묶음이며 정확한 바이트 폭이 아니다. 도식을 누르면 확대할 수 있다.</figcaption>
</figure>

**전송 모드**는 원래 주소가 든 헤더를 밖에 남긴다. ‘헤더가 그대로’라는 표현은 모든 비트가 불변이라는 뜻이 아니다. 예를 들어 IPv4 Protocol 필드는 ESP를 가리키도록 바뀐다. **터널 모드**는 원래 패킷 전체를 보호 영역에 넣고 IPsec 끝점 주소로 새 외부 헤더를 붙인다.[3] (RFC §3.1.1–3.1.2)

아래 시각화는 원래 주소, 외부 주소, 암호화 범위를 나란히 보여준다. 같은 IP·TCP·Data 필드가 어느 보호 영역으로 이동하는지 따라가 보자. 전송 모드는 원래 헤더 한 겹, 터널 모드는 내부·외부 헤더 두 겹이다. 작은 화면에서는 상세 패킷을 도식 안에서 좌우로 이동할 수 있으며, 아래의 줄바꿈 가능한 정지 구조로도 비교할 수 있다.

<iframe class="ipsec-explainer-frame" src="{{ '/assets/animations/ipsec-packet-svg/index.html' | relative_url }}" title="SVG 설명 모션: ESP 전송 모드와 터널 모드의 주소 및 보호 범위" loading="lazy" style="width:100%;height:900px;border:1px solid #29415f;border-radius:16px;background:#f5f5ee;" allow="fullscreen"></iframe>

[애니메이션을 별도 화면에서 열기: 전송·터널 모드 비교]({{ '/assets/animations/ipsec-packet-svg/index.html' | relative_url }}){: .btn .btn--primary target="_blank" rel="noopener"}

### 전송 모드는 언제 쓰는가

IPsec을 직접 처리하는 두 호스트가 이미 서로 라우팅 가능하고, 그 경로의 선택된 트래픽을 보호할 때 사용할 수 있다. 그 주소는 **반드시 공인 주소일 필요도, 반드시 VPN 내부 주소일 필요도 없다.** 라우팅 가능하다는 것과 평문으로 서비스 이용이 허용된다는 것은 별개다. 정책으로 평문은 거부하고 IPsec 보호 트래픽만 받을 수 있다.[2] (RFC §4.1, §4.4.1)[3] (RFC §3.1.1)

원래 목적지가 `10.2.0.20`인데 외부 인터넷에서 그 주소로 갈 경로가 없다면, 전송 모드 암호화만으로 길이 생기지는 않는다. 터널 모드에서는 내부 패킷을 도달 가능한 외부 VPN 끝점까지 운반할 수 있다. 물론 터널 끝점 사이의 경로와 복호화 후 내부 라우팅은 여전히 필요하다.[2] (RFC §4.1, §5)[3] (RFC §3.1.2)

터널 모드는 **게이트웨이↔게이트웨이 전용이 아니다.** 노트북↔게이트웨이와 호스트↔호스트 터널도 가능하다. 또 GRE/L2TP가 이미 내부 패킷을 감쌌다면 그 터널 트래픽을 ESP **전송 모드**로 보호할 수 있다. 이때 내부망을 운반하는 봉투는 GRE/L2TP가 만든다.[2] (RFC §4.1)[8] (RFC §2.1)[17]

## 10. HTTPS와 비슷한 원리, 다른 보호 경계

비교 범위를 **인증서 기반 (EC)DHE TLS 1.3의 일반 연결**로 고정하자. PSK 재개·0-RTT·HTTP/3는 여기서 설명하는 기본 그림에 포함하지 않는다.[6] (RFC §2)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/tls13-certificate-handshake.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="인증서 기반 TLS 1.3의 기본 연결 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/tls13-certificate-handshake.svg' | relative_url }}" alt="인증서 기반 TLS 1.3의 기본 연결" loading="lazy" style="width:100%;max-width:281.19px;height:auto;" />
  </a>
  <figcaption>인증서 기반 TLS 1.3의 기본 연결 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

브라우저와 서버는 ClientHello·ServerHello의 임시 key_share로 handshake 보호 키를 파생한다. 서버의 보호된 Certificate·CertificateVerify·Finished를 받고 인증서·서비스 신원·서명을 검증한 뒤 브라우저가 Finished를 보낸다. 이후 애플리케이션 데이터는 별도 TLS traffic key로 보호한다.

여기서도 **인증서 공개키와 임시 DH key_share는 다르다.** CertificateVerify는 인증서에 대응하는 개인키를 보유하고 이번 handshake에 참여했음을 서명으로 증명한다. 인증서 체인·서비스 이름 검증은 그 키가 기대한 서비스에 속하는지 확인한다. CA는 신원과 키의 관계를 보증하지, 매 연결의 대칭 세션 키를 나눠 주지 않는다.[6] (RFC §4.2.8, §4.4.2–4.4.3)[9] (RFC §4.3.4)

TLS 1.3에서는 예전 RSA 키 전송 방식을 사용하지 않는다. 따라서 ‘서버 공개키로 HTTP 전체를 계속 암호화한다’는 설명은 이 연결에 맞지 않는다. 실제 TLS record는 파생한 대칭키와 AEAD로 보호한다.[6] (RFC §1.2, §5.2)

**TCP 위 HTTP/1.1·HTTP/2**와 ESP를 비교한 개념도는 다음과 같다. TLS record와 TCP segment가 항상 1:1 대응한다는 뜻은 아니다.

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/tls-esp-protection-boundaries.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="TLS와 ESP의 보호 경계 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/tls-esp-protection-boundaries.svg' | relative_url }}" alt="TLS와 ESP의 보호 경계" loading="lazy" style="width:100%;max-width:440.0px;height:auto;" />
  </a>
  <figcaption>TLS와 ESP의 보호 경계 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

TCP 위 HTTPS에서는 IP·TCP·TLS record header가 밖에 보이고 HTTP bytes와 TLS inner fields가 암호화된다. ESP 전송 모드는 IP 헤더를 밖에 두고 TCP header·data·ESP trailer를 암호화한다. IV와 tag는 ENC 밖이고 ESP SPI·순번은 AAD이며 IP 헤더는 ESP AAD가 아니다. TLS record와 TCP segment의 1:1 대응이나 정확한 바이트 폭을 뜻하지 않는다.

| 기준 | HTTPS / TLS | IPsec / ESP |
|---|---|---|
| 중심 신원 | TLS 끝점의 서비스 신원 | IKE에서 인증한 피어 신원 |
| 보호 단위 | TLS record의 애플리케이션 데이터 | 정책에 맞는 IP 패킷 |
| 밖에 보이는 것 | IP와 TCP 헤더 | 전송 모드에서는 IP 헤더, 터널 모드에서는 외부 IP 헤더 |
| 정책 관리 | 서비스 연결과 애플리케이션의 TLS 설정 | 호스트·게이트웨이의 IPsec 자격과 트래픽 정책 |
| 인증 이후 권한 | 애플리케이션 로그인·인가가 별도로 필요할 수 있음 | 피어 인증만으로 사용자·프로세스 권한까지 증명되지는 않음 |

이 차이는 ‘누가 더 좋은 암호를 쓰는가’보다 **보호를 끝내는 위치와 신뢰하려는 대상**의 차이다. 게이트웨이에서 ESP를 끝내도 뒤의 웹서비스까지 TLS로 보호할 수 있고, 같은 호스트 사이에서 두 보호 경계를 중첩할 수도 있다.[2][3]

TLS는 그 안에서 서비스 연결의 record를 별도로 보호한다.[6][9]

## 11. Nebula의 P2P는 전송 모드와 같은 분류가 아니다

**P2P는 누가 누구에게 직접 연결하는가**, 터널/전송 모드는 **IP 패킷을 어떻게 감싸는가**라는 서로 다른 축이다. 직접 호스트끼리 통신해도 내부 IP 패킷을 운반하는 터널일 수 있다.[2] (RFC §4.1)[10]

Nebula는 TUN을 통해 가상 L3 네트워크의 IP 트래픽을 받고, UDP 기반 암호화 연결로 운반하는 오버레이다. Lighthouse는 피어 발견과 NAT traversal을 돕는다. 다음은 구조 비교용이며 Nebula의 정확한 wire format이나 ESP 사용을 뜻하지 않는다.[10][11][12]

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/nebula-ipsec-overlay-structure.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="Nebula와 호스트 간 IPsec 터널 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/nebula-ipsec-overlay-structure.svg' | relative_url }}" alt="Nebula와 호스트 간 IPsec 터널" loading="lazy" style="width:100%;max-width:440.0px;height:auto;" />
  </a>
  <figcaption>Nebula와 호스트 간 IPsec 터널 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

Nebula는 underlay IP·UDP·자체 framing 안에 암호화된 overlay IP 패킷을 운반한다. 호스트 간 IPsec 터널은 underlay IP·ESP·IV 뒤에 내부 IP 패킷과 trailer의 암호문 및 tag를 둔다. 두 구조는 내부 IP 패킷을 운반한다는 점을 비교한 개념도이지 Nebula의 정확한 wire format이나 ESP 사용을 뜻하지 않는다. P2P와 터널·전송 모드는 서로 다른 분류다.

따라서 ‘Nebula는 P2P니까 ESP 전송 모드와 같다’보다는 **직접 연결 토폴로지는 닮을 수 있고, 내부 가상 IP 패킷을 운반하는 구조는 터널에 더 가깝다**가 정확하다. Nebula는 Noise 기반의 자체 프로토콜이지 IKEv2/ESP가 아니다.[10]

## 12. Linux에서는 XFRM이 변환하고 netfilter가 함께 정책을 적용한다

‘Gateway A의 outbound에서 netfilter가 패킷을 감싸는가?’라는 질문에는 역할을 나눠 답해야 한다. 일반적인 Linux 커널 IPsec 경로에서 **ESP 변환과 SA 처리는 XFRM**, 필터링·NAT는 netfilter 기반 규칙이 맡는다. 둘은 같은 네트워크 스택에서 상호작용한다.[14][18]

| 구성 요소 | 하는 일 |
|---|---|
| IKE daemon | 사용자 공간에서 인증·협상하고 커널에 필요한 상태를 설치 |
| XFRM policy | SPD에 해당하는 트래픽 선택과 필요한 변환 정책 |
| XFRM state | SAD에 해당하는 SPI·알고리즘·키 재료·replay 등 상태 |
| XFRM/ESP 처리 | 선택한 상태로 패킷 보호, 검증·복호화 |
| netfilter 규칙 | 통과·차단·NAT, IPsec 정책과 관련된 조건 적용 |
| 라우팅 | 끝점/내부 목적지로 어느 경로를 사용할지 결정 |

`ip xfrm`의 `policy`와 `state`가 각각 SPD와 SAD를 다룬다는 대응은 매뉴얼에 명시되어 있다. 커널·NIC의 IPsec offload를 사용하면 실제 암호 연산이나 패킷 처리 일부를 하드웨어가 수행할 수도 있다. 따라서 ‘모든 ESP 바이트는 항상 CPU가 처리’라고 단정하지 않는다.[14][19]

### 12.1. SPD는 평문을 아무 때나 허용하는 규칙이 아니다

RFC의 개념적 정책 결과는 세 가지다.[2] (RFC §4.4.1)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/spd-policy-decisions.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="SPD의 세 정책 결과 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/spd-policy-decisions.svg' | relative_url }}" alt="SPD의 세 정책 결과" loading="lazy" style="width:100%;max-width:260.38px;height:auto;" />
  </a>
  <figcaption>SPD의 세 정책 결과 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

SPD의 BYPASS는 IPsec 없이 통과, DISCARD는 폐기, PROTECT는 적절한 SA 선택 또는 수립을 요구한다. PROTECT 트래픽에 SA가 없다는 이유로 평문 전송을 대체 경로로 사용하지 않는다.

PROTECT인데 SA가 없다면 필요한 IKE 협상을 유도한다. 패킷을 일시 보류할지 폐기할지는 구현 문제지만, **보호해야 할 패킷을 SA가 없다는 이유로 평문으로 보내는 것이 정상 대체 경로는 아니다.** 트래픽 정책, SA, 라우팅은 서로 맞아야 한다.[1] (RFC §2.9)[2] (RFC §5.1)

### 12.2. outbound와 OUTPUT hook은 같은 말이 아니다

IPsec의 outbound는 **보호 경계 밖으로 보내는 방향**이다. 게이트웨이 자체가 생성한 패킷뿐 아니라 Host A에서 들어와 Gateway B로 **forwarding하는 패킷**도 해당한다. 이를 모두 로컬 프로세스의 `OUTPUT` hook으로 설명하면 안 된다.[2] (RFC §5.1)[18]

정확한 netfilter hook·XFRM 재진입 순서는 로컬 생성/전달, 전송/터널, NAT·인터페이스·offload 구성에 맞춰 확인해야 한다. 이 글의 흐름도는 그 모든 커널 호출 순서를 고정한 것이 아니다. 중요한 운영 함정은 SNAT/MASQUERADE가 주소를 바꿔 협상한 트래픽 정책과 맞지 않게 만들 수 있다는 점이다. IPsec 트래픽의 NAT 예외는 실제 토폴로지에 맞춰 설계한다.[18]

### 12.3. 비밀키를 출력하지 않고 확인하기

아래는 **조회 명령**이다. 권한은 운영 환경에 맞춰 사용하고, 출력의 주소·식별자도 외부 공유 전 가려야 한다.[14]

```bash
ip xfrm policy list
ip xfrm state list nokeys
ip -s xfrm state list nokeys
```

state 목록에서 `nokeys`를 빠뜨려 세션 키 재료를 로그·채팅에 복사하지 않도록 주의한다. 상태를 직접 수동 생성하거나 `flush`하는 명령은 이 튜토리얼의 범위에 넣지 않는다.

## 13. Google 로그인은 IKE 앞단의 자격 발급에 연결한다

‘Google OAuth로 로그인하고 토큰을 게이트웨이에 주면 되는가?’는 **사용자 신원 확인, 자격 발급, IKE 피어 인증** 세 단계로 나누면 답이 나온다. Google 로그인으로 사용자 신원을 확인하는 흐름은 OAuth 2.0 위의 **OpenID Connect(OIDC)**로 설명하는 것이 정확하다. ID token과 Google API 접근용 access token도 구분해야 한다.[20]

아래는 **가능한 회사 등록 서비스 설계**이지, RFC 7296의 새로운 AUTH 방식이나 Google의 기본 IPsec 기능이 아니다.

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/oidc-enrollment.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="Google OIDC 로그인 뒤 VPN 인증서 발급의 예시 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/oidc-enrollment.svg' | relative_url }}" alt="Google OIDC 로그인 뒤 VPN 인증서 발급의 예시" loading="lazy" />
  </a>
  <figcaption>웹 로그인은 VPN 자격 발급의 앞단이다. 이후 IKE_AUTH는 발급된 인증서를 사용한다. 도식을 누르면 크게 볼 수 있다.</figcaption>
</figure>

### 13.1. 인증서 발급을 연결하는 예시

1. 장치가 자기 개인키·공개키를 로컬에서 만든다. **개인키는 장치 밖으로 보내지 않는다.**
2. 사용자가 Google 로그인으로 등록 서비스에 신원을 제시한다. 토큰·등록 요청은 서버 신원을 검증한 HTTPS로 전달한다.
3. 회사 서비스가 ID token의 **서명, `iss`, `aud`, `exp`**를 검증하고, 등록 세션과 요청을 연결한다.
4. 회사 서비스는 ‘정상 Google 계정인가’뿐 아니라 **이 계정·장치가 VPN을 사용할 권한이 있는가**를 확인한다.
5. 공개키 소유 증명과 발급 정책을 확인하고 회사 CA가 VPN용 인증서를 발급한다.
6. 장치에는 인증서, 로컬 개인키, VPN 서버 신원·신뢰 CA·트래픽 설정을 준비한다. 이후 VPN 접속은 일반 인증서 기반 IKE_AUTH로 수행한다.[13][20][1] (RFC §2.15)

3번의 검증 항목은 Google 공식 지침이고, 1·4·5·6번은 그 결과를 VPN 자격 발급에 연결하는 설계 예시다. 실제 서비스에서는 CSRF 방어, 필요에 따른 OIDC nonce 검증, 토큰 재사용 방어, 장치 등록·승인, 발급·폐기·갱신 정책까지 구현해야 한다. `hd` 확인이 필요한 조직 제한을 단순 이메일 문자열 검사로 대신하지 않는다.[13][20]

서명된 토큰은 ‘전달 중 도난당해도 괜찮은 비밀’이 아니다. **HTTPS는 전달 경로를 보호하고, 토큰 검증은 발급자와 수신 대상 등을 확인하며, 회사 인가는 VPN 접근을 허용할지 결정한다.** 어느 하나가 다른 둘을 대체하지 않는다.[13][20]

### 13.2. PSK 배포나 직접 게이트웨이 연동도 가능한가

등록 서비스가 인증서 대신 사용자/피어별 강한 PSK를 생성해 **클라이언트와 대응 게이트웨이 양쪽에 안전하게 설정**하도록 만들 수도 있다. 이후 IKE는 PSK 인증이다. Google ID token이 PSK가 되거나 ESP 키가 되는 것은 아니다. 클라이언트·제품이 피어별 PSK 관리를 지원하는지도 별도로 확인해야 한다.[1] (RFC §2.15)[13]

토큰을 게이트웨이에 직접 제출하는 제품 연동도 설계할 수 있지만, 토큰 검증 결과를 **어떤 장치·어떤 IKE 세션에 연결할지**와 어떤 인증 방법으로 운반할지를 구현해야 한다. RFC 7296의 기본 PSK·서명·EAP 흐름에 ‘Google 토큰을 그대로 넣으면 모든 IKEv2 클라이언트에서 동작’하는 표준 입력은 없다.[1] (RFC §2.15–2.16)

### 13.3. 실제 배포 패턴을 비교한다

아래는 지원 문서와 기본 인증 구조를 바탕으로 한 **구성 선택지**다. 어느 방식이 시장에서 몇 퍼센트 사용되는지에 대한 통계는 아니다.[1][15][16]

| 상황 | 구성 예시 | 관리할 핵심 |
|---|---|---|
| 관리하는 두 게이트웨이 | 피어별 PSK 또는 상호 인증서 | 안전한 PSK 배포/교체 또는 PKI·피어 신원 정책 |
| 직원 노트북 원격 접속 | 서버 인증서 + 클라이언트 EAP | 서버 신원 검증, 지원 EAP 방법, 사용자·장치 인가 |
| 장치 중심 접근 | 상호 인증서 또는 EAP-TLS | 장치 개인키 보호, 발급·폐기·갱신 |
| 기존 인증 서버 연동 | 게이트웨이의 EAP와 RADIUS backend 연결 | backend 보안, 인증 결과·신원의 정확한 전달 |
| 웹 SSO 기반 등록 | OIDC 로그인 후 VPN 자격 발급 | 토큰 검증·회사 인가와 VPN 인증의 경계 |

strongSwan의 `eap-radius`는 EAP 방법 자체를 대신 구현하는 것이 아니라 **IKE의 EAP 대화를 RADIUS backend에 전달**하는 플러그인이다. RADIUS 연결의 비밀을 IKE PSK나 ESP 키와 혼동하지 않는다.[15]

Apple IKEv2 프로파일 문서는 PSK, 직접 인증서, 인증서 기반 서버 인증과 클라이언트 EAP 등의 선택지를 보여준다. 단, 문서의 오래된 OS 시험 결과·템플릿 알고리즘을 모든 최신 클라이언트의 지원 보장이나 보안 권장값으로 읽어서는 안 된다. 실제 OS·제품·버전 조합으로 확인해야 한다.[16]

## 14. 재키잉: 데이터를 보내는 동안에도 IKE는 남아 있다

SA를 만들었으면 이후 패킷은 그 상태를 사용한다. IKE는 없어지는 것이 아니라 추가 SA 생성, 키 교체, 삭제 등의 제어 메시지를 계속 보호한다.[1] (RFC §1.3–1.4)

추가/교체 Child SA의 CREATE_CHILD_SA에서는 새 nonce를 교환하고 **선택적으로 새 DH**를 포함할 수 있다. 다음의 `Ni_new/Nr_new`는 초기 nonce와 다른, 이번 교환의 값이다.[1] (RFC §2.17)

```text
Without additional DH:
KEYMAT_new = prf+(SK_d, Ni_new | Nr_new)

With additional DH:
KEYMAT_new = prf+(SK_d, Z_new | Ni_new | Nr_new)
```

첫 Child SA에는 별도 DH가 없다는 것과 이후 Child SA에 새 DH를 추가할 수 있다는 것을 함께 기억하자. 후자의 설정은 Child SA의 PFS(Perfect Forward Secrecy) 설정과 연결된다. **임시 DH와 키의 안전한 폐기, 적절한 알고리즘**을 전제로 과거 통신을 장기 인증 비밀 유출과 분리하려는 목적이지, 현재 장치가 침해돼도 안전하다는 보장은 아니다.[1] (RFC §2.14, §2.17, §5)

Child SA rekey는 새 SA 쌍을 만든 다음 트래픽을 전환하고 이전 쌍을 삭제하는 방식이다. 전환 중 두 쌍이 잠깐 함께 보일 수 있다. IKEv2에서는 SA 수명을 양쪽이 협상해 하나의 값으로 맞추는 대신 **각 끝점이 자기 수명 정책을 시행**한다.[1] (RFC §2.8)

IKE SA 자체의 rekey도 CREATE_CHILD_SA를 사용하며 이 경우에는 **새 DH가 필수**다. 또 **rekey != reauthentication**이다. rekey는 키를 교체하지만 AUTH/EAP로 장기 자격을 다시 검증하지 않는다. 재인증은 새 초기 교환으로 신원 검증을 다시 수행하는 별도 작업이다.[1] (RFC §2.18, §2.8.3)

## 15. 문제가 생기면 어느 경계에서 멈췄는지 찾는다

처음부터 모든 옵션을 바꾸기보다 **연결 도달 → IKE 키 합의 → 인증 → Child SA → 데이터 정책·라우팅** 순서로 나누어 확인한다. 아래는 진단 방향이지 오류 문자열 하나만으로 원인이 확정되는 규칙은 아니다.[1][18]

| 증상/단계 | 우선 확인할 것 |
|---|---|
| 초기 응답이 없음 | VPN 끝점까지 경로, IKE UDP 500/4500, 방화벽·NAT |
| IKE_SA_INIT 협상 실패 | IKE 알고리즘·PRF·DH 그룹의 교집합, COOKIE/그룹 재시도 |
| IKE_AUTH 검증 실패 | 기대 ID, PSK 선택/일치, 인증서·신뢰 정책, EAP 서버·자격 |
| IKE는 인증됐지만 Child SA가 없음 | ESP 제안, 모드, Traffic Selector와 허용 범위 |
| SA는 있는데 데이터가 안 감 | XFRM 정책에 맞는 주소/포트, 라우팅·forwarding·필터링·NAT |
| 단방향만 성공 | 반대 방향 SA·수신 정책·반환 경로·방화벽 |
| 작은 패킷만 성공 | 터널 overhead, MTU·PMTUD·ICMP 처리 |
| 일정 시간이 지나 끊김 | rekey·수명, 새 DH/제안 호환성, NAT 매핑과 상태 확인 |

Native ESP는 **IP 프로토콜 번호 50**이지 TCP/UDP ‘50번 포트’가 아니다. NAT-T에서는 ESP를 UDP로 감싸며 IKEv2는 UDP 4500을 사용한다. UDP 4500의 IKE 패킷은 Non-ESP Marker로 ESP-in-UDP와 구분된다. 실제 NAT는 외부 주소·포트를 바꿀 수 있다.[3] (RFC §2)[1] (RFC §2.23)

<figure class="ipsec-guide-figure">
  <a href="{{ '/assets/images/ipsec-guide/native-esp-nat-t-carriage.svg' | relative_url }}" target="_blank" rel="noopener" aria-label="Native ESP와 UDP NAT-T 운반 크게 보기">
    <img src="{{ '/assets/images/ipsec-guide/native-esp-nat-t-carriage.svg' | relative_url }}" alt="Native ESP와 UDP NAT-T 운반" loading="lazy" style="width:100%;max-width:440.0px;height:auto;" />
  </a>
  <figcaption>Native ESP와 UDP NAT-T 운반 — 구조와 순서를 설명하는 개념도이며 정확한 바이트 폭·전체 오류 분기를 뜻하지 않는다. 누르면 크게 볼 수 있다.</figcaption>
</figure>

Native ESP는 외부 IP 뒤에 ESP·IV·암호문·tag를 두며 IP 프로토콜 번호 50을 사용한다. NAT-T는 외부 IP와 ESP 사이에 UDP를 추가해 ESP를 UDP 4500으로 운반한다. ESP-in-UDP에는 IKE용 Non-ESP Marker를 넣지 않는다. UDP 4500의 IKE는 별도의 Non-ESP Marker로 구분한다. NAT-T는 운반 방식이며 피어 AUTH나 ESP 보호를 대체하지 않는다.

NAT-T는 운반 방법의 문제이지 AUTH를 대체하거나 ESP를 TLS로 바꾸는 기능이 아니다. 마찬가지로 ‘ping 성공’은 IKE 인증 성공을 뜻하지 않고, ‘IKE 연결됨’은 필요한 모든 내부 패킷이 해당 SA로 흐른다는 뜻이 아니다.[1] (RFC §2.9, §2.23)[18]

로그·캡처를 공유할 때 PSK·개인키·파생 키·토큰을 제거하고 내부 주소·피어 ID도 필요에 따라 가린다. 비교해야 할 것은 비밀값 공개가 아니라 **성공한 마지막 교환, 협상된 제안·TS, 양 끝의 SPI 대응, 송수신 카운터와 드롭 지점**이다.

## 16. 용어 사전: 이름보다 출처와 소비 지점을 기억한다

| 용어 | 정확히 무엇인가 | 무엇이 아닌가 |
|---|---|---|
| PSK | 연결 전 배포한 인증 비밀 | DH가 만든 Z, ESP 암호화 키 |
| `a/b` | 각자의 임시 DH 비밀값 | 상대에게 전달할 인증서 개인키 |
| `X/Y`, `KEi/KEr` | DH 공개값과 그 운반 payload | 파생된 최종 대칭키 |
| `Z` | DH 계산의 공유 비밀 | PSK, 완성된 AES-GCM 키 |
| KDF / PRF / prf+ | 키 재료를 용도별로 생성·확장하는 구성 | DH 자체, 데이터 암호화 |
| IKE SA | 양방향 협상·관리 관계 | 실제 사용자 데이터를 운반하는 ESP SA |
| Child SA | IKE가 수립·관리하는 데이터 보호 관계; ESP는 보통 SA 쌍 | IKE 암호화 키를 그대로 쓰는 하위 채널 |
| ESP SA | 한 방향의 알고리즘·키·SPI·순번 등 상태 | 복호화 불가능한 암호 |
| SPI | 수신 SA를 식별할 공개 값 | 비밀키, TCP/UDP 포트 |
| AUTH | 자격을 이번 IKE 교환에 결합한 피어 증명 | AEAD tag, PSK 평문, 자동 OTP |
| AEAD tag | 암호문·관련 데이터의 변조를 검출할 값 | 피어의 회사 신원을 독립적으로 증명하는 AUTH |
| nonce | 특정 암호 연산/교환에서 쓰는 값; 요구 조건은 문맥별로 다름 | 모든 곳에서 동일한 난수 생성 규칙을 가진 값 |
| MSK | 키 생성형 EAP가 만드는 Master Session Key | 관리자가 넣은 PSK, 직접 사용하는 ESP 키 |
| SPD / SAD | 보안 정책 / 실행 SA 상태의 데이터베이스 | 단순 라우팅 테이블 |
| PAD | Peer Authorization Database, IKE 신원과 허용 정책의 연결 | 인증 성공이면 모든 트래픽을 허용하는 규칙 |
| OIDC ID token | 로그인 결과의 신원 주장 | 표준 IKE PSK나 DH 비밀 |

IKE 키·인증, IPsec 데이터베이스·SA와 ESP 필드 정의는 RFC 원문을 기준으로 했다.[1][2][3]

EAP와 OIDC 용어는 각 공식 문서를 기준으로 했다.[7][20]

## 17. 참고자료와 다시 읽을 지점

### RFC를 읽는 순서

- **연결과 인증 시점:** RFC 7296 §1.2 → §2.14 → §2.15 → §2.16.
- **첫 Child SA와 방향별 키:** RFC 7296 §2.17, RFC 4301 §4.1.
- **보호 정책과 상태:** RFC 4301 §4.4.1–4.4.3, §5.
- **실제 ESP 패킷:** RFC 4303 §2, §3.1, §3.3–3.4; AES-GCM은 RFC 4106 §3–6, §8.1.
- **IKE AEAD와 피어 AUTH의 차이:** RFC 5282 §3, §7–8과 RFC 7296 §2.15를 함께 읽는다.
- **TLS와 비교:** RFC 8446 §2, §4.2.8, §4.4, §5.2; HTTPS 서비스 신원은 RFC 9110 §4.3.4.
- **키 교체와 재인증:** RFC 7296 §2.8, §2.8.3, §2.17–2.18.

### 설명의 범위와 주의점

이 글의 주 경로는 **기본 IKEv2 + PSK 상호 인증 + 유니캐스트 ESP 터널 + AES-GCM 예시**다. 인증서·EAP는 같은 뼈대에서 인증 부분이 어떻게 달라지는지 확장한 것이다. 모든 IPsec이 암호화 ESP를 쓰는 것은 아니며 AH, 무암호화 ESP, 다중 송신자·멀티캐스트, 최신 IKE 확장 등의 세부 경로는 다루지 않았다.[1][2][3]

도식과 애니메이션은 프로토콜 경계와 입력/출력 관계를 보여주는 설명 도구다. 정확한 wire format, 실제 패킷 캡처, 커널 호출 순서, 제품별 설정 검증을 대체하지 않는다. 실제 배포에서는 현재 보안 정책과 구현의 지원 알고리즘을 확인하고, 설명용 DH 숫자나 문서의 오래된 설정 예시를 복사하지 않는다.

**마지막 체크:** PSK는 미리 있던 인증 비밀, Z는 이번 DH 결과, IKE 키는 제어 메시지 보호, ESP 키는 실제 패킷 보호다. 그리고 **이 키들을 계산한 상대를 믿는 결정은 IKE_AUTH 검증에서 한다.**[1]

## Sources

[1] [RFC 7296 — Internet Key Exchange Protocol Version 2](https://www.rfc-editor.org/rfc/rfc7296.txt)

[2] [RFC 4301 — Security Architecture for the Internet Protocol](https://www.rfc-editor.org/rfc/rfc4301.txt)

[3] [RFC 4303 — IP Encapsulating Security Payload](https://www.rfc-editor.org/rfc/rfc4303.txt)

[4] [RFC 4106 — AES-GCM in IPsec ESP](https://www.rfc-editor.org/rfc/rfc4106.txt)

[5] [RFC 5282 — Authenticated Encryption with IKEv2 Encrypted Payload](https://www.rfc-editor.org/rfc/rfc5282.txt)

[6] [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446.txt)

[7] [RFC 3748 — Extensible Authentication Protocol](https://www.rfc-editor.org/rfc/rfc3748.txt)

[8] [RFC 3193 — Securing L2TP using IPsec](https://www.rfc-editor.org/rfc/rfc3193.txt)

[9] [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.txt)

[10] [Nebula 공식 소개](https://nebula.defined.net/docs)

[11] [Nebula TUN 설정](https://nebula.defined.net/docs/config/tun)

[12] [Nebula listen 설정](https://nebula.defined.net/docs/config/listen)

[13] [Google — 서버 측 ID token 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

[14] [ip-xfrm(8) 매뉴얼](https://man7.org/linux/man-pages/man8/ip-xfrm.8.html)

[15] [strongSwan eap-radius](https://docs.strongswan.org/docs/latest/plugins/eap-radius.html)

[16] [strongSwan Apple IKEv2 Configuration Profile](https://docs.strongswan.org/docs/latest/interop/appleIkev2Profile.html)

[17] [strongSwan IPsec Protocol 소개](https://docs.strongswan.org/docs/latest/howtos/ipsecProtocol.html)

[18] [strongSwan Forwarding and Split-Tunneling](https://docs.strongswan.org/docs/latest/howtos/forwarding.html)

[19] [Linux kernel — XFRM device](https://docs.kernel.org/networking/xfrm/xfrm_device.html)

[20] [Google OpenID Connect 문서](https://developers.google.com/identity/openid-connect/openid-connect)

[21] [LottieFiles motion-design — 설명 모션의 연출 지침](https://github.com/LottieFiles/motion-design-skill)

[22] [draw.io 공식 MCP — 편집 가능한 정적 도식 도구](https://www.drawio.com/docs/manual/generate/drawio-mcp-server/)
