---
layout: single
title: "Motion Canvas로 보는 IPsec: IKEv2 연결 수립부터 ESP 암호화까지"
date: 2026-10-01 00:00:00 +0900
permalink: /system/ipsec-ikev2-motion-canvas/
categories: [system]
excerpt: "IKE_SA_INIT, DH 키 파생, IKE_AUTH, 방향별 CHILD SA와 ESP 패킷 보호를 72초 Motion Canvas 애니메이션으로 따라간다."
toc: true
toc_sticky: true
tags: [ipsec, ikev2, esp, network, security, motion-canvas, animation]
---

IPsec을 처음 볼 때는 **상대를 인증하는 과정**, **이번 연결에 사용할 키를 만드는 과정**, **실제 데이터를 암호화하는 과정**이 한 덩어리처럼 보인다. 이 예시는 세 작업을 나누어 보여준다.

- **IKEv2**: 상대 인증, 알고리즘과 키 협상, SA 수립·관리.[1]
- **ESP**: 합의된 SA를 사용해 실제 IP 데이터를 보호.[2]

## 애니메이션: 연결 수립 → 암호화 통신

**재생**으로 전체 흐름을 보거나, 아래 **장면 버튼**으로 원하는 구간에 멈출 수 있다. 각 구간은 8초, 전체는 72초다. 시간 슬라이더와 0.5×/1×/1.5×/2× 속도 선택을 제공한다. 화면 자체를 클릭해도 재생·일시정지된다.

[애니메이션만 큰 화면으로 열기]({{ '/assets/animations/ipsec/index.html' | relative_url }}){: .btn .btn--primary target="_blank" rel="noopener"}

<div style="margin: 1.2em 0;">
<iframe id="ipsec-motion-frame" src="{{ '/assets/animations/ipsec/index.html' | relative_url }}" title="Motion Canvas: IPsec IKEv2 연결 수립과 ESP 암호화" loading="lazy" style="width:100%;height:930px;border:1px solid #29415f;border-radius:16px;background:#090f1d;" allow="fullscreen"></iframe>
</div>
<script>
(function () {
  var frame = document.getElementById('ipsec-motion-frame');
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === 'ipsec-demo-height' && Number.isFinite(event.data.height)) {
      frame.style.height = Math.min(1600, Math.max(350, event.data.height + 8)) + 'px';
    }
  });
})();
</script>

**예시의 범위:** IKEv2 기본 성공 경로, PSK(사전 공유 키) 상호 인증, ESP 터널 모드, ESP 데이터 보호는 AES-GCM 예시다. 실제 패킷 캡처나 암호 연산을 수행하는 시뮬레이터는 아니다. EAP·인증서·NAT-T·COOKIE·재전송·재키잉은 생략한다. 초기 교환은 기본적으로 요청/응답 두 쌍이며, 추가 인증이나 재시도에서는 메시지가 더 늘어날 수 있다.[1]

휴대전화에서는 16:9 장면 내부의 글자가 작다. 장면 아래의 일반 텍스트 설명을 함께 읽거나, 큰 화면 링크를 열고 가로 화면으로 보는 편이 낫다.

## 1. IKE_SA_INIT: 공개값을 교환한다

```text
A → B: HDR, SAi1, KEi, Ni
B → A: HDR, SAr1, KEr, Nr
```

`SAi1`은 IKE용 알고리즘 제안, `SAr1`은 B가 선택한 제안이다. `KEi/KEr`는 DH 공개값, `Ni/Nr`는 각자의 nonce다. 이 단계는 **평문이며 아직 상대의 신원이 인증되지 않았다.** DH 개인값과 PSK는 전송하지 않는다.[1]

`HDR`에는 IKE의 SPI 등 헤더 정보가 들어간다. 이때 IKE SPI와 나중에 데이터용 ESP SA를 식별하는 ESP SPI를 같은 것으로 생각하면 안 된다.[1][2]

## 2. DH 공유 비밀에서 IKE용 키를 파생한다

정상적인 DH 교환에서 양쪽은 자신의 개인값과 상대의 공개값으로 같은 공유 비밀을 계산한다. 아래는 RFC 7296의 키 파생 표기를 단순화한 것이다. `|`는 바이트 연결, `prf`는 의사난수 함수, `prf+`는 필요한 길이만큼 키 재료를 확장하는 함수다.[1]

```text
SKEYSEED = prf(Ni | Nr, g^ir)

SK_d | SK_ai | SK_ar | SK_ei | SK_er | SK_pi | SK_pr
    = prf+(SKEYSEED, Ni | Nr | SPIi | SPIr)
```

- `SK_ei/SK_er`: IKE 메시지 암호화에 사용하는 방향별 키.
- `SK_ai/SK_ar`: 별도 무결성 알고리즘을 사용하는 경우의 IKE 무결성 키. IKE에 AEAD를 선택하면 별도의 무결성 키는 사용하지 않는다.
- `SK_pi/SK_pr`: 인증 계산에서 신원 데이터를 처리하는 데 쓰이는 키.
- `SK_d`: 이후 CHILD SA의 키 재료를 파생하는 데 쓰는 키.[1]

**키를 상대에게 보내는 것이 아니라, 양쪽이 로컬에서 같은 재료로 계산한다.** 단, 인증 전 DH 교환만으로는 능동적 중간자 공격을 배제할 수 없다. 다음 IKE_AUTH의 검증까지 성공해야 상대를 신뢰할 수 있다.[1]

## 3. IKE_AUTH: 인증하면서 첫 CHILD SA도 만든다

이 예시는 인증서나 EAP 대신 PSK를 사용한다. 선택적 payload를 생략한 기본 형태는 다음과 같다.[1]

```text
A → B: HDR, SK{IDi, AUTH, SAi2, TSi, TSr}
B → A: HDR, SK{IDr, AUTH, SAr2, TSi, TSr}
```

`SK{…}`는 내부 payload가 IKE 키로 암호화·무결성 보호된다는 의미다. 외부 IKE 헤더까지 숨긴다는 뜻은 아니다. `AUTH`는 인증 비밀과 앞선 교환 내용, 상대 nonce, 자신의 신원 데이터를 연결해 상대가 검증할 수 있도록 한다. PSK 자체를 보내거나 PSK를 그대로 ESP 암호화 키로 쓰는 것이 아니다.[1]

`SAi2/SAr2`는 **데이터 보호용 CHILD SA**의 제안/선택이다. `TSi/TSr`는 보호할 주소·포트·프로토콜 등의 트래픽 범위를 나타내고, 응답자는 범위를 좁힐 수 있다. 양쪽 AUTH 검증이 성공하면 상호 인증된 IKE SA와 첫 CHILD SA가 준비된다.[1]

따라서 **첫 ESP SA를 만들기 위해 무조건 별도 CREATE_CHILD_SA 교환을 해야 하는 것은 아니다.** 추가 CHILD SA 수립이나 재키잉에는 해당 교환을 사용하지만, 첫 CHILD SA는 기본 IKE_AUTH에 포함된다.[1]

## 4. ESP는 방향별 키와 SA를 사용한다

첫 CHILD SA의 키 재료는 아래와 같이 초기 교환에서 얻은 `SK_d`, `Ni`, `Nr`를 사용해 파생한다. 첫 CHILD SA에는 별도의 새 DH 교환이 없다.[1]

```text
KEYMAT = prf+(SK_d, Ni | Nr)

A → B: SA_AB, K_AB, SPI_AB, 송신 순번 상태
B → A: SA_BA, K_BA, SPI_BA, 별도의 송신 순번 상태
```

ESP SA는 **단방향**이다. 하나의 CHILD SA 협상으로 양방향 통신에 필요한 SA 쌍을 수립하며, 실제 키 재료에는 선택한 알고리즘에 필요한 키·salt 등이 포함된다. `K_AB/K_BA`는 이 분리를 설명하는 기호이지 실제 키 값이 아니다. 각 방향의 SPI는 그 방향을 수신할 피어가 선택한다.[1][2][3]

## 5. ESP 터널 모드: 무엇이 숨고 무엇이 보이나

AES-GCM ESP 터널 모드의 구조를 간략히 그리면 다음과 같다. padding 등 세부 필드는 합쳐서 표시했다.[2][3]

```text
[Outer IP][ESP SPI, Seq][explicit IV][Ciphertext][Authentication Tag]
                                      └ Inner IP + Data + ESP trailer
```

- **암호화되는 부분**: 원래 IP 패킷 전체(내부 IP 헤더 포함)와 ESP trailer.
- **암호화하지 않는 부분**: 외부 IP 헤더, ESP SPI·순번, explicit IV, 인증 태그.
- **변조 검출**: AES-GCM 인증 태그로 암호문과 SPI·순번 등 관련 인증 데이터를 검증한다. 외부 IP 헤더까지 ESP로 인증하는 것은 아니다.
- **재전송 방어**: SA별 순번과 수신 윈도우를 사용한다. 인증되지 않은 패킷으로 수신 윈도우를 확정 갱신하면 안 된다.[2][3]

AES-GCM의 패킷 nonce는 SA의 salt와 explicit IV로 구성한다. 같은 키 아래에서 nonce를 재사용하면 안 된다. IV와 IKE 초기 교환의 `Ni/Nr`는 역할이 다른 값이다.[3]

수신 측은 SPI와 문맥으로 SA를 찾고, 재전송 여부 및 태그를 검증한 뒤 유효한 내부 패킷을 전달한다. AES-GCM의 검증과 복호화는 결합된 처리이며, 애니메이션의 상자 순서는 구현의 모든 내부 호출 순서를 고정한 것이 아니다.[2][3]

암호화해도 외부 주소·패킷 길이·타이밍 등은 관찰될 수 있다. 핵심은 **IKE가 인증된 제어 채널을 만들고 키를 관리하며, ESP는 방향별 데이터 SA로 실제 트래픽을 보호한다**는 분리다.[1][2]

## 이 페이지는 어떻게 렌더링되는가

이 예시는 영상 파일이 아니라 **실제 Motion Canvas 장면을 브라우저의 Canvas에 렌더링**한다. Motion Canvas는 TypeScript generator로 애니메이션 흐름을 작성하는 도구다.[4]

```text
_animations/ipsec/src/handshake.tsx
    → Vite + Motion Canvas로 사전 빌드
    → assets/animations/ipsec/{project.js, player.js, …}
    → Jekyll이 정적 파일을 배포
    → 방문자 브라우저가 장면을 재생
```

플레이어와 장면 코드를 같은 사이트에서 제공하므로 방문 시 외부 CDN이 필요하지 않다. 기존 Jekyll 배포 방식은 바꾸지 않고, iframe으로 플레이어의 CSS를 블로그 테마와 분리했다. Motion Canvas 소스·버전 잠금 파일·브라우저 테스트도 저장소에 포함했다.

[예제 소스 보기](https://github.com/m1ser4ble/m1ser4ble.github.io/tree/master/_animations/ipsec)

```bash
cd _animations/ipsec
npm ci
npm run build
npm test
```

빌드 결과를 함께 커밋하므로 GitHub Pages에서 별도로 Node 빌드를 실행할 필요는 없다.

## Sources

[1] https://www.rfc-editor.org/rfc/rfc7296
[2] https://www.rfc-editor.org/rfc/rfc4303
[3] https://www.rfc-editor.org/rfc/rfc4106
[4] https://motioncanvas.io/docs
