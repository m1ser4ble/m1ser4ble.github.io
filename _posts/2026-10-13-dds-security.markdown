---
layout: single
title: "DDS Security: 인증·접근 제어·메시지 보호의 경계"
date: 2026-10-13 00:00:00 +0900
categories: [system]
excerpt: "DDS Security는 참가자 신원과 Topic 권한, 메시지 보호를 구성하지만 Domain ID나 메시지 인증만으로 장비의 운용 제어권을 결정하지 않는다."
tags: [dds, security, cryptography]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
knowledge_id: dds-security
knowledge_links: [dds-guide, dds-discovery-addressing, dds-history-persistence, dds-qos]
series: dds
permalink: /dds/security/
toc: true
toc_sticky: true
---

**DDS(Data Distribution Service) Security는 누가 Domain에 참가하는지 확인하고, 그 참가자가 어떤 DDS entity를 만들거나 사용할지 제한하며, 선택한 RTPS(Real-Time Publish Subscribe, 실시간 발행·구독) 데이터 범위를 인증·암호화하는 표준 플러그인 체계다.** [Fast DDS 용어 정의](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/getting_started/definitions.html) Domain ID는 참가 범위를 나누는 식별자이지 인증이나 격리 정책이 아니며, topic 권한도 물리 장비의 현재 제어권을 대신하지 않는다.

제품 동작 설명은 Fast DDS **2.11.2** 문서를 기준으로 한다. 실제 적용 여부는 라이브러리 빌드에 보안 지원이 포함됐는지, 정책 파일과 키가 설치됐는지, 필요한 endpoint 모두에 설정됐는지 확인해야 한다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=security" title="DDS 참가자 인증, 권한 결정, SIGN과 ENCRYPT 범위" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

> 이 애니메이션은 CA(Certificate Authority, 인증 기관)를 통한 참가자 인증, governance/permissions 정책 확인, RTPS 보호 범위를 설명하는 모형이며 실제 패킷이나 벤치마크가 아니다. JavaScript가 꺼져도 흐름은 이렇다. 인증서는 참여자 신원을 확인하고, Permissions는 행위를 제한하고, SIGN/ENCRYPT는 정책에 선택된 데이터 단위를 보호한다. 애플리케이션의 장비 운용 권한은 별도의 상태·명령 정책이다.

## 위협 질문으로 용어를 나누기

| 질문 | DDS Security 기능 | 남는 앱·운영 책임 |
|---|---|---|
| 누가 이 Domain의 participant인가? | Authentication: trusted CA를 바탕으로 상호 인증 | 개인키 보호, 인증서 발급·폐기, 장비 자체의 신뢰 체인 |
| 인증된 참여자가 무엇을 할 수 있나? | Access Control: Governance와 Permissions의 domain/entity 규칙 | 모드 전환, 현재 operator/권한, 안전 interlock |
| 전송 중 데이터가 보이거나 바뀌는가? | Cryptographic plugin: 선택된 범위에 MAC(Message Authentication Code, 메시지 인증 코드) 또는 authenticated encryption | 보호 범위, 키 관리, 종단 저장·로그·화면에서의 노출 |
| 보안 이벤트를 나중에 조사할 수 있나? | Logging plugin 및 앱 감사 기록 | 로그 보존·시간 정합성·운영자 추적 |

Object Management Group(OMG) DDS Security 1.0은 2016년 8월 정식 명세로 등록됐다. DDS Security는 DDS 기능에 인증·접근통제·암호기능 등을 추가하는 별도 명세다. Fast DDS 2.11.2는 PKI-DH authentication (Public Key Infrastructure와 Diffie–Hellman 기반), Permissions access control, AES(Advanced Encryption Standard)-GCM(Galois/Counter Mode)-GMAC(Galois Message Authentication Code) cryptography, security logging 기능을 문서화한다. 해당 판본은 Data Tagging 플러그인이 아직 구현되지 않았다고도 밝힌다. [OMG DDS Security 1.0](https://www.omg.org/spec/DDS-SECURITY/1.0/) · [Fast DDS 2.11.2 Security 개요](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/security/security.html)

## Domain ID는 보안 경계가 아니다

같은 Domain ID를 고르는 것은 DDS discovery와 통신에 참여할 논리 범위를 선택하는 일이다. 숫자만 바꾸어도 주소가 인증되지 않고, 참가자 신원이 검증되지 않으며, 방화벽이나 네트워크 접근제어가 생기지 않는다. 같은 Domain 안에서도 별도 participant 및 Topic 권한을 정의할 수 있고, 반대로 같은 값을 쓰는 아무 프로세스나 신뢰된다는 결론은 나오지 않는다. Domain 주소·participant discovery·IP(Internet Protocol) locator의 관계는 [Discovery와 주소]({% post_url 2026-10-13-dds-discovery-addressing %})를 참고한다.

예를 들어 `sensor_id="radar-1"`이 든 sample은 그 문자열을 보냈다는 뜻뿐이다. 인증서와 private key를 보유한 participant가 해당 sample을 썼는지 확인하지 않고는 실제 레이더 출처라고 볼 수 없다. DDS authentication은 네트워크 participant의 신원을 다루며, sensor 하드웨어 내부에서 측정값이 조작되지 않았다는 물리 보증까지 제공하지 않는다.

## 인증에서 권한 평가까지

Fast DDS 2.11.2의 기본 security 구성을 읽는 순서는 다음과 같다.

1. **Authentication**: participant 인증서와 신뢰 CA를 사용해 상대 identity를 검증하고 상호 인증·공유 secret 수립을 수행한다. 구현 플러그인은 `DDS:Auth:PKI-DH`로 명명된다.
2. **Governance**: domain ID 범위별로 보호 정책, unauthenticated 참여 허용 여부, discovery·RTPS·topic payload 수준의 protection 요구를 정의한다.
3. **Permissions**: participant의 유효기간과 topic/entity별 publish/subscribe 등의 권한을 선언한다. Permissions 문서는 permissions CA 서명을 통해 신뢰한다.
4. **Cryptography**: 정책에서 선택한 RTPS 메시지, entity submessage 또는 특정 writer의 payload를 보호한다. 수신 측은 인증 태그를 검증하고 허용되지 않는 데이터는 전달하지 않는다.
5. **Audit**: security event와 앱의 명령 요청·승인·실행 결과를 서로 연결할 수 있게 기록한다.

사용자 인증과 DDS의 Topic 권한이 있다고 해서 발행자가 현재 물리 장비를 단독으로 제어할 authority가 되는 것은 아니다. 예컨대 `vehicle.command` publish 권한은 해당 participant가 Topic에 쓸 수 있음을 말한다. 현재 운용 모드가 maintenance인지, operator가 통제를 넘겼는지, 안전조건이 충족됐는지는 executor가 다시 검증해야 한다. 권한·상태·freshness를 다시 확인하는 실무 패턴은 [복구와 freshness]({% post_url 2026-10-13-dds-history-persistence %}) 및 [QoS(Quality of Service)]({% post_url 2026-10-13-dds-qos %})와 이어진다.

## SIGN과 ENCRYPT는 서로 다른 요구에 답한다

MAC은 **Message Authentication Code(메시지 인증 코드)**다. 송신자와 수신자가 공유한 비밀키 `K`로 `tag = MAC(K, message)`를 만들고, 수신자는 같은 키로 tag를 다시 계산해 비교한다. 공격자는 메시지만 바꾸고 유효한 tag를 새로 계산할 수 없으므로, 공유키를 모르는 제3자의 변조를 잡을 수 있다. 단, 여러 참가자가 같은 키를 공유하면 tag만으로 어느 한 참가자가 보냈는지 구분하지 못한다. NIST(National Institute of Standards and Technology)는 MAC을 메시지 무결성과 출처 인증을 위한 비밀키 기능으로 정의한다. [NIST MAC 개요](https://csrc.nist.gov/projects/message-authentication-codes)

Fast DDS의 protection kind에서 `SIGN`은 이 MAC 보호를 적용해 payload를 평문으로 둔다. `ENCRYPT`는 내용을 암호화하면서 변조 검증도 하는 **AEAD(Authenticated Encryption with Associated Data, 연관 데이터를 포함한 인증 암호화)** 보호다. AES-GCM은 암호화 대상과 별도로 암호화하지 않지만 인증할 associated data도 다루고, AES-GMAC은 데이터를 암호화하지 않은 채 MAC을 만드는 GCM의 특수화다. Fast DDS crypto plugin에서 `SIGN`은 AES-GMAC 기반 MAC 보호, `ENCRYPT`는 AES-GCM authenticated encryption으로 대응한다. [NIST SP 800-38D: GCM과 GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final) · [Fast DDS 2.x crypto plugin](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/crypto_plugin/crypto_plugin.html) · [Fast DDS 2.x SIGN/ENCRYPT 정의](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/access_control_plugin/access_control_plugin.html)

**SHA-256(Secure Hash Algorithm, 256비트 digest) hash는 MAC도 암호화도 아니다.** `SHA-256(message)`에는 비밀키가 없으므로 제3자도 메시지를 바꾼 뒤 새 digest를 계산할 수 있다. digest가 신뢰된 별도 채널로 고정돼 있으면 파일 손상을 찾는 데 쓸 수 있지만, digest를 메시지 옆에 공개한 것만으로 송신자 인증은 되지 않는다. NIST는 SHA 계열을 메시지 digest 생성용 hash로, MAC은 대칭 비밀키를 쓰는 별도 기능으로 구분한다. AES-GCM의 AES는 실제 암호화에 쓰이고, AES-GMAC의 AES는 공유키를 사용해 인증 tag를 만든다. Fast DDS 2.11.2 Security 개요는 AES-GCM-GMAC crypto plugin을 명시한다. 다만 상세 보호 범위와 설정은 현재 2.x 문서(2.14.7)에서 확인했으며, 설치된 2.11.2 build의 정확한 옵션은 해당 binary/header와 versioned configuration에서 따로 확인해야 한다. [NIST Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) · [NIST MAC 정의](https://csrc.nist.gov/glossary/term/message_authentication_code) · [Fast DDS 2.11.2 Security 개요](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/security/security.html)

| 조건 | 검토할 보호 | 예시 |
|---|---|---|
| 정비망에서 payload를 공개해도 되지만 위조 명령은 거부해야 함 | `SIGN` 및 participant/topic 권한 | 진단 상태 telemetry의 변조 방지 |
| 무선으로 전송하는 임무 데이터의 내용을 제3자가 읽으면 안 됨 | 해당 payload/topic의 `ENCRYPT` | 위치·센서 민감정보의 기밀성·무결성 |
| discovery metadata도 노출되면 안 됨 | governance에서 RTPS/submessage 보호 범위 검토 | endpoint 이름·구조 노출을 줄이는 요구 |
| 제어 명령이 권한 밖 participant에서 오면 안 됨 | Authentication + Permissions + 앱 authority check | read-only viewer는 명령 발행 불가 |

보호 수준은 전송 단위에 따라 설정될 수 있다. RTPS 메시지 전체, entity submessage, 특정 DataWriter payload가 서로 다른 범위다. 그래서 한 topic payload를 암호화했다고 discovery 정보나 앱 로그·디스크 복사본까지 자동으로 비밀이 된다고 말하면 안 된다.

SIGNED message도 freshness나 업무 완료를 보장하지 않는다. 인증은 올바른 키 보유자가 만든 데이터였다는 뜻이지, 값이 현재 센서 측정인지, 안전 조건을 만족하는지, actuator가 작업을 끝냈는지는 별도다. 순번·세션·유효성·중복 규칙과 처리결과 기록은 앱 계층에서 둔다.

## 선택과 운영 trade-off

보호 기능은 보안 요구뿐 아니라 trust anchor 배포와 수명주기도 요구한다. 인증서 발급·교체·폐기, permissions 서명, 키 보관, 시간 유효성, participant가 교체될 때 identity를 어떻게 회수할지 운영 절차를 정한다. `ENCRYPT`는 데이터 기밀성을 주지만 endpoint 권한을 단순화하지 않으며 CPU(Central Processing Unit) 비용의 숫자를 문서만으로 예측할 수 없다.

| 접근 | 선택할 이유 | 중요한 제한 |
|---|---|---|
| 망 분리만 사용 | 물리 네트워크 경계가 강하고 장비 수가 적어 운영 복잡도를 낮춤 | 내부 오접속·침해 participant에 대한 identity/policy가 없음 |
| DDS Security 적용 | 여러 participant와 topic의 신원·권한·전송 보호를 middleware에서 집행 | 인증서·policy lifecycle과 빌드·호환성 검증 필요 |
| 앱 payload 암호화만 추가 | 특정 데이터에 독립된 end-to-end format을 적용 | discovery/entity 권한, key exchange, replay 대응을 별도로 구현해야 함 |
| TLS(Transport Layer Security) tunnel로 링크 보호 | 기존 TCP(Transmission Control Protocol) 기반 연계 경계가 분명함 | DDS 전체 participant discovery와 topic 권한을 곧바로 표현하지 않음 |

경쟁 대안의 선택은 실제 신뢰 경계에 따라 달라진다. DDS Security는 DDS participant/entity 단위 policy가 필요할 때 자연스럽고, 네트워크 계층 보안은 다른 프로토콜도 함께 보호해야 할 때 유용하다. 어느 쪽도 장비가 명령을 실행한 후의 물리적 결과를 확인하는 절차를 대신하지 않는다.

## 구현 점검 항목

- 설치된 Fast DDS가 security plugins를 포함하도록 빌드됐는지 확인한다. 2.11.2 문서는 기본 빌드에 security 지원이 포함되지 않을 수 있고 소스 빌드에 `-DSECURITY=ON` 설정이 필요하다고 설명한다.
- participant마다 private key와 identity certificate를 분리하고, CA/permissions signing key를 장비 이미지에 평문으로 복제하지 않는다.
- governance의 허용 domain 범위와 permissions의 entity/topic 동작을 최소 권한으로 작성한다. 제한을 잘못 넣은 경우의 기대 실패도 검사한다.
- 보호할 discovery metadata와 payload를 요구사항에 맞게 각각 정한다. `SIGN`을 confidentiality로 부르지 않는다.
- 허가되지 않은 participant, 만료·미신뢰 인증서, 권한 없는 publish/subscribe, 변조 sample, 폐기된 인증서의 차단을 실제 라이브러리 버전에서 시험한다.
- 인증서 교체 및 폐기 절차를 부팅·재연결·오프라인 환경에서 확인한다.
- DDS write 성공, Reader 수신, 업무 승인, 장비 실행 완료를 서로 다른 결과로 기록한다.

측정 장비와 같은 조건에서 보호 수준을 바꾸어 시험하기 전까지 SIGN이 ENCRYPT보다 몇 퍼센트 빠르다고 단정할 수 없다. AES 하드웨어 가속, payload 크기, participant 수, 네트워크 및 QoS가 비용에 영향을 준다. 이번 프로젝트에서는 보안 설정이나 SIGN/ENCRYPT 성능 비교를 실행하지 않았다.

## 연구·실험 범위

2026-10-13에 OMG DDS Security 1.0과 Fast DDS 2.11.2의 Security overview, 그리고 Fast DDS 2.x의 PKI-DH, Permissions, crypto plugin 문서를 확인했다. 상세 2.x 하위 페이지는 현재 2.14.7 문서로 제공되므로 그 세부 동작을 2.11.2의 설치 binary에서 실행 확인한 것으로 표현하지 않는다. OMG 명세는 기능 범주의 근거이고 Fast DDS 문서는 제품·판본별 플러그인 설명의 근거다. 프로젝트는 기본 Domain ID, 세션·sequence 검증을 사용했지만 인증서, Permissions, 암호 플러그인을 설정하지 않았으며 보안시험을 수행하지 않았다. 회사 또는 특정 차량 프로그램의 실제 policy와 생산 사례는 공개 근거에서 확인하지 못해 여기서 가정하지 않는다.

## 참고자료

- [OMG DDS Security 1.0](https://www.omg.org/spec/DDS-SECURITY/1.0/)
- [Fast DDS 2.11.2 Security](https://fast-dds.docs.eprosima.com/en/v2.11.2/fastdds/security/security.html)
- [Authentication: PKI-DH, Fast DDS 2.x](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/auth_plugin/auth_plugin.html)
- [Access Control: Permissions, Fast DDS 2.x](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/access_control_plugin/access_control_plugin.html)
- [Cryptographic plugin: AES-GCM-GMAC, Fast DDS 2.x](https://fast-dds.docs.eprosima.com/en/2.x/fastdds/security/crypto_plugin/crypto_plugin.html)
- [NIST SP 800-38D: GCM and GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [NIST Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [NIST Message Authentication Codes](https://csrc.nist.gov/projects/message-authentication-codes)
- [NIST TLS Guidelines](https://csrc.nist.gov/pubs/sp/800/52/r2/final)

연재의 개요는 [DDS 가이드]({% post_url 2026-10-13-dds-guide %}), 보안과 전달 정책 관계는 [QoS]({% post_url 2026-10-13-dds-qos %}), 복원된 과거 값의 처리 경계는 [History와 Persistence]({% post_url 2026-10-13-dds-history-persistence %})에서 이어진다.

{% include knowledge-links.html %}
