---
layout: single
title: "카페 와이파이는 왜 동의해야 열릴까: Captive Portal의 원리와 보안 경계"
date: 2026-10-27 09:00:00 +0900
categories: [system]
permalink: /network/captive-portal/
excerpt: "비밀번호 없이 연결한 와이파이에서 동의 버튼이 인터넷을 여는 과정, 운영체제의 감지 방식, 무선 암호화와 개인정보의 경계를 정리한다."
toc: true
toc_sticky: true
tags: [wifi, captive-portal, capport, networking, security, owe]
source: "카페 와이파이 접속 경험에 관한 질문과 IETF RFC, Apple·Android·Microsoft·Cisco의 공개 문서"
---

## 핵심 요약

카페에서 와이파이를 선택하면 비밀번호는 묻지 않는데, ‘무료 인터넷 사용하기’나 정보 수집 동의를 눌러야 인터넷이 된다. 이때 동의 화면이 열린 기기는 이미 매장 네트워크와 통신하고 있다. 네트워크 장비가 **외부 인터넷 사용을 승인하기 전의 제한 상태**로 두는 것이다.

- **무선 연결:** 휴대폰이 매장 AP와 통신할 수 있는가.
- **사용 승인:** 네트워크 장비가 이 기기의 외부 통신을 허용하는가.
- **무선 암호화:** 휴대폰과 AP 사이의 통신을 보호하는가.
- **웹 암호화:** 휴대폰과 방문한 웹사이트 사이의 내용을 HTTPS로 보호하는가.

이 네 가지는 구별해야 한다. Captive Portal은 사용 승인을 다루며, 동의 버튼만으로 무선 암호화가 추가되지는 않는다. 반대로 비밀번호가 없어도 OWE로 무선 구간을 암호화할 수 있다. [RFC 8952 §1.2](https://www.rfc-editor.org/rfc/rfc8952.html#section-1.2), [RFC 8110 §1](https://www.rfc-editor.org/rfc/rfc8110.html#section-1), [Mozilla TLS 설명](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)

폴 바셋·스타벅스에서 관찰한 경험을 이해하기 위한 일반적인 구조를 설명한다. 두 회사의 모든 매장이 같은 장비나 최신 CAPPORT API를 사용한다고 확인한 것은 아니다.

실제 메시지를 차례로 보고 싶다면 [노트북 접속을 패킷 순서로 따라가기](#protocol-walkthrough)부터 읽으면 된다. 무선 연결, IP 할당, 화면 표시, 동의 전송·저장, 장비 승인까지 이어서 설명한다.

## 용어 사전

<style>
.page__content table.cp-readable-table{display:block;max-width:100%;overflow-x:auto;font-size:16px;line-height:1.7}
.page__content table.cp-readable-table th,.page__content table.cp-readable-table td{min-width:140px;white-space:normal}
.page__content table.cp-readable-table:focus-visible{outline:2px solid #73c8e1;outline-offset:3px}
</style>

표가 화면보다 넓으면 표 안에서 좌우로 이동할 수 있다. 키보드에서는 표에 초점을 맞춘 뒤 방향키로 이동한다.

| 용어 | 풀어 쓴 이름과 뜻 | 이 글에서의 역할 |
|---|---|---|
| Captive Portal | Captive는 ‘제한된 상태에 놓인’, Portal은 ‘관문’ 정도로 읽을 수 있다 | 조건을 충족하기 전 통신 대상을 제한하는 네트워크 구조. 동의 화면 하나보다 넓은 개념 |
| User Portal | 사용자용 웹 포털 | 약관·동의·로그인·결제 등을 처리하는 웹 화면 |
| SSID | Service Set Identifier | 와이파이 목록에 표시되는 네트워크 이름 |
| AP | Access Point | 휴대폰과 무선으로 통신하는 접속 장치 |
| DHCP | Dynamic Host Configuration Protocol | 일반적인 IPv4 접속에서 IP 주소·게이트웨이 등 설정을 전달하는 절차 |
| Enforcement Device | 접근 제한을 집행하는 장비 | 기기별로 패킷을 허용하거나 차단한다. AP나 게이트웨이 등에 기능을 둘 수 있음 |
| Walled Garden | 담장으로 둘러싸인 정원이라는 비유 | 미승인 상태에서도 접근할 수 있도록 허용한 서버·주소의 집합 |
| CAPPORT | IETF Captive Portal Interaction 작업반 식별자 | 명시적인 포털 발견·상태 조회를 위한 표준화 작업 |
| Captive Portal API | Application Programming Interface | 기기별 제한 상태와 사용자 포털 주소 등을 알려 주는 인터페이스 |
| RA | Router Advertisement | IPv6 라우터가 네트워크 설정 등을 알리는 메시지 |
| MAC address | Media Access Control address | 접속 구간에서 장치를 구분하는 주소. 영구적인 사람 신원과 동일하지 않음 |
| OWE | Opportunistic Wireless Encryption | 비밀번호 입력과 사용자 인증 없이 무선 구간을 암호화하는 방식 |
{: .cp-readable-table tabindex="0" aria-label="와이파이와 포털 용어 사전"}

용어의 직역은 이해를 위한 설명이다. Captive Portal이라는 이름을 누가 처음 지었는지는 이번 조사에서 입증하지 못했다. [RFC 8952 용어·구성요소](https://www.rfc-editor.org/rfc/rfc8952.html#section-1.2), [Meraki Walled Garden 설명](https://documentation.meraki.com/Wireless/Design_and_Configure/Configuration_Guides/Access_Control), [RFC 8110](https://www.rfc-editor.org/rfc/rfc8110.html)

## 등장 배경과 이유

공용 인터넷에는 무선 연결 외에도 안내문 확인, 이용약관 수락, 계정 확인, 요금 결제 같은 요구가 있다. 불특정 방문객에게 별도 접속 프로그램을 배포하지 않고 웹브라우저로 이를 처리할 수 있다는 점에서 포털 방식이 쓰인다. 이 가운데 **무엇을 승인 조건으로 요구할지는 운영 정책**이다. 개인정보 제공 동의가 와이파이 프로토콜 자체의 필수 절차인 것은 아니다. [RFC 7710 §1](https://www.rfc-editor.org/rfc/rfc7710.html#section-1)

초기 방식은 일반 HTTP 요청을 가로채 포털로 보내는 데 의존했다. 하지만 HTTPS 등 보안 기능이 강화되면서 이런 방식은 정상 통신을 깨뜨리거나 포털 감지에 실패할 수 있다. CAPPORT는 네트워크가 포털의 존재와 상태를 명시적으로 알리도록 이 문제를 다룬다. 기존 포털이 전부 없어졌다는 뜻은 아니다. [IETF CAPPORT 초기 charter](https://www.ietf.org/charter/charter-ietf-capport-01.txt)

## 역사적 기원

**포털 방식의 발명과 IETF 표준화는 다른 사건**이다. 이번에 확인한 1차 자료로는 최초 발명자·최초 상용 제품·용어 최초 사용 연도를 특정할 수 없다. 따라서 RFC 저자를 이 기술의 발명자로 소개하지 않는다.

확인 가능한 표준화 이력에서는 2015년 RFC 7710이 DHCP와 RA를 통한 포털 안내를 정의했고, IETF CAPPORT 작업반은 2016년 1월 charter 승인 뒤 활동했다. 2020년에는 발견 규약과 상태 API, 아키텍처 설명이 정리됐다. [RFC 7710](https://www.rfc-editor.org/rfc/rfc7710.html), [CAPPORT 작업반 이력](https://datatracker.ietf.org/wg/capport/history/)

## 학술적/이론적 배경

이 주제의 직접적인 토대는 특정 학습 알고리즘보다 **네트워크 접근 제어와 프로토콜 명세**다. 패킷이 지나는 경로에서 규칙을 집행하고, 웹 절차에서 승인 조건을 처리한다. 아래 문서들은 각각 다른 역할을 맡는다.

| 문서 | 역할 | 문서 분류 |
|---|---|---|
| [RFC 8910](https://www.rfc-editor.org/rfc/rfc8910.html) | DHCP/RA로 Captive Portal **API 주소**를 전달 | Standards Track |
| [RFC 8908](https://www.rfc-editor.org/rfc/rfc8908.html) | HTTPS 기반 상태 조회와 JSON 응답 형식 | Standards Track |
| [RFC 8952](https://www.rfc-editor.org/rfc/rfc8952.html) | 구성요소·기기 식별·승인 흐름의 아키텍처 | Informational |
{: .cp-readable-table tabindex="0" aria-label="CAPPORT 문서별 역할"}

따라서 세 문서를 모두 같은 종류의 ‘인터넷 표준 프로토콜’로 묶지는 않는다. 아래 그림의 단계는 문서의 흐름을 재구성한 **교육용 모델**이며, 모든 제품에 똑같은 상태 머신을 강제하는 규격은 아니다.

## 연대표

| 시점 | 확인 가능한 변화 |
|---|---|
| 2015년 12월 | RFC 7710: DHCP/RA를 이용한 포털 안내 정의 |
| 2016년 1월 4일 | CAPPORT 작업반 charter 승인 |
| 2017년 3월 | RFC 8110: OWE 설명. 포털 승인과 별개로 무선 암호화를 개선하는 축 |
| 2020년 6월 22일 | Apple이 iOS 14·macOS Big Sur의 새로운 포털 안내/API 지원 소개 |
| Android 11 Beta 2부터 | Google이 CAPPORT API 기능 일부와 DHCP 옵션 114 지원 설명 |
| 2020년 9월 | RFC 8908 상태 API, RFC 8910 API 발견 규약 발행 |
| 2020년 11월 | RFC 8952 아키텍처 설명 발행 |
| 2020년 12월 7일 | CAPPORT 작업반 종료 |
{: .cp-readable-table tabindex="0" aria-label="포털 표준화 연대표"}

연대표는 [각 RFC](https://www.rfc-editor.org/rfc/rfc8910.html), [IETF 작업반 이력](https://datatracker.ietf.org/wg/capport/history/), [Apple 공지](https://developer.apple.com/news/?id=q78sq5rv), [Android 문서](https://developer.android.com/about/versions/11/features/captive-portal)를 기준으로 한다. 작업반 종료는 기술 지원이나 사용이 종료됐다는 뜻이 아니다.

## 동작 메커니즘

### 연결과 승인은 어느 순간 갈라질까

일반적인 IPv4 예에서는 무선 연결 뒤 DHCP로 IP 설정을 받지만, 아직 일반 인터넷 통신은 제한된다. 포털과 상태 API, 인증서 검증에 필요한 통신 등은 접근할 수 있게 둔다. 포털 서버가 인터넷 트래픽 전체를 중계하는 것은 아니며, 실제 패킷의 통과 여부는 접근 제한 장비가 결정한다. [RFC 8952 §2](https://www.rfc-editor.org/rfc/rfc8952.html#section-2)

아래 그림에서 ‘다음 단계’를 누르면 동의 요청과 장비의 승인이 별도로 진행되는 모습을 볼 수 있다. 화면이 좁으면 노드가 세로로 재배치된다. 자동 재생은 없으며 이동 효과는 사용자 조작 때만 짧게 나타난다.

{% include captive-portal-lab.html %}

그림을 사용할 수 없는 경우에는 다음 순서로 읽으면 된다.

1. **무선 연결 전:** 아직 매장 네트워크를 사용할 수 없다.
2. **연결·주소 준비:** 무선 연결과 IP 설정이 끝나도 외부 사용은 미승인일 수 있다.
3. **제한 상태 감지:** 운영체제가 접속 시험 또는 API 조회로 포털이 필요함을 알아낸다.
4. **동의 요청:** 사용자의 웹 요청이 포털로 전달된다. 클릭 순간과 장비 반영 사이에는 처리가 있다.
5. **승인 반영:** 서버와 장비의 연동이 끝나면 해당 기기의 외부 통신이 허용된다.
6. **만료 예시:** 유효기간을 둔 서비스라면 만료 뒤 다시 제한할 수 있다. 모든 매장이 시간 제한을 쓴다는 뜻은 아니다.

### 버튼을 누른 기기만 어떻게 구분할까

포털의 웹 세션과 장비가 보는 접속을 연결해야 한다. IP·MAC 주소 등 기기 식별 정보가 쓰일 수 있으며, 무엇을 쓰는지는 제품과 네트워크 배치에 따라 달라진다. 브라우저 쿠키만으로 모든 앱의 인터넷이 열리는 것은 아니다. **웹 세션을 식별한 뒤 네트워크의 승인 상태도 갱신**해야 한다. [RFC 8952 §3](https://www.rfc-editor.org/rfc/rfc8952.html#section-3)

공개된 구현 예로 Meraki의 Click-through Splash Page는 계정 정보 대신 Continue 버튼으로 진행한다. grant URL과 세션 쿠키를 사용하고, 클라우드가 AP들에 승인 상태를 전달한다. 이는 해당 제품의 설명이며, 폴 바셋·스타벅스가 이 제품을 쓴다는 근거는 아니다. [Meraki 실제 처리 흐름](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting)

### 휴대폰은 동의 화면을 어떻게 자동으로 열까

**기존 감지 방식:** 운영체제가 예상 응답이 정해진 주소에 접속 시험을 한다. HTTP 리디렉션 등 다른 응답이 오면 포털 가능성을 감지하고 로그인 화면이나 알림을 표시한다. 이를 Canary request라고도 하며, RFC는 위험을 먼저 감지하는 광산의 카나리아에 비유한다. 시험 응답을 잘못 허용·차단하면 오판할 수 있다. [RFC 8952 Appendix A](https://www.rfc-editor.org/rfc/rfc8952.html#appendix-A), [Android 감지 설명](https://developer.android.com/about/versions/11/features/captive-portal)

**명시적인 CAPPORT 방식:** 네트워크가 DHCPv4 옵션 **114**, DHCPv6 옵션 **103**, IPv6 RA 옵션 **37**로 API URI를 알려 준다. 이 주소는 사용자 동의 페이지 자체가 아니다. 기기는 먼저 API를 조회하고, 그 응답의 `user-portal-url`을 이용해 사용자 화면으로 이동한다. [RFC 8910 §2](https://www.rfc-editor.org/rfc/rfc8910.html#section-2)

아래는 실제 매장 응답을 캡처한 것이 아니라 RFC 8908 형식을 설명하기 위한 축약 예시다.

```http
GET /capport/session/example HTTP/1.1
Host: wifi.example.org
Accept: application/captive+json
```

```json
{
  "captive": true,
  "user-portal-url": "https://wifi.example.org/terms"
}
```

이 요청은 HTTPS로 전송한다. 조건을 충족한 뒤 다시 조회하면 `captive: false`인 응답으로 제한 해제를 확인할 수 있다. `seconds-remaining`이나 `bytes-remaining` 같은 한도 정보는 선택 사항이다. **API 조회는 상태 확인이며, 조회 요청 자체가 인터넷을 열어 주는 명령은 아니다.** [RFC 8908 §3–§6](https://www.rfc-editor.org/rfc/rfc8908.html#section-3)

### ‘동의’와 본인인증은 무엇이 다를까

단순 동의 버튼은 조건 수락을 표시할 수 있지만, 그 사람의 실명이나 계정 소유를 입증하지는 않는다. 계정·인증서·별도 본인확인 절차를 요구하는 서비스와 구분해야 한다. 포털이 승인 조건으로 개인정보 동의를 요구할 수는 있지만, 수집 항목·목적·보유기간이나 법적 필요성은 기술 구조만으로 알 수 없다. 실제 화면과 해당 서비스 정책을 확인해야 한다. [Meraki의 Click-through와 Sign-on 구분](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting)

## 노트북 접속을 패킷 순서로 따라가기 {#protocol-walkthrough}

‘와이파이 동의 프로토콜’ 하나가 모든 과정을 수행하는 것은 아니다. **IEEE 802.11 → DHCP → ARP·DNS → TCP·TLS·HTTP → 웹 애플리케이션 → 장비 접근 제어**가 연결된다. 여기서는 기존 주소 임대와 캐시가 없는 노트북이 **일반 Open System 와이파이에 IPv4로 처음 연결하는 예**를 따라간다. HTTPS 예시는 TCP 위의 HTTP/1.1로 단순화했다. HTTP/2는 HTTP 메시지 표현이 다르며, HTTP/3는 QUIC을 사용하므로 아래 TCP 흐름과 같지 않다.

예시 주소는 실제 매장 설정이 아닌 문서용 주소다. 노트북은 `192.0.2.10/24`, 게이트웨이는 `192.0.2.1`, DHCP 서버는 `192.0.2.2`, DNS 서버는 `192.0.2.53`, 포털은 `portal.example.org`(`198.51.100.20`)라고 가정한다. AP·게이트웨이·DHCP 서버는 한 장비에 함께 있거나 별개일 수 있다. [RFC 5737 문서용 주소](https://www.rfc-editor.org/rfc/rfc5737.html#section-3)

### 1. 무선 접속: IEEE 802.11 관리 프레임

노트북은 Beacon 수신이나 Probe Request/Response로 AP를 찾는다. 이 예의 연결 과정에서는 **Open System Authentication Request/Response**, 이어서 **Association Request/Response**를 교환한다. 성공하면 무선 데이터 프레임을 전달할 링크가 준비된다.

여기서 Authentication이라는 이름은 사람의 본인인증이나 개인정보 동의를 뜻하지 않는다. 이 단계의 프레임에는 **TCP/UDP 포트가 없고, IP 주소도 아직 필요하지 않다.** WPA·OWE 등의 보안 방식에 따른 절차는 따로 구분해야 한다. [Cisco의 Open System Authentication·Association 설명](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/116493-technote-technology-00.html)

### 2. 주소 할당: DHCP의 Discover → Offer → Request → ACK

이제 노트북이 DHCP(Dynamic Host Configuration Protocol) 클라이언트로 동작한다. 신규 할당의 대표적인 DORA 교환은 다음과 같다.

| 순서·메시지 | 방향·포트 | 주요 내용 |
|---|---|---|
| Discover | 노트북 `UDP 68` → 서버 `UDP 67` | 처음에는 `0.0.0.0 → 255.255.255.255`로 서버 탐색 |
| Offer | 서버 `UDP 67` → 노트북 `UDP 68` | `yiaddr=192.0.2.10` 등 주소 제안 |
| Request | 노트북 `UDP 68` → 서버 `UDP 67` | 초기 SELECTING에서는 브로드캐스트. 요청 주소와 선택한 서버를 옵션으로 표시 |
| ACK | 서버 `UDP 67` → 노트북 `UDP 68` | 임대와 설정 확정 |
{: .cp-readable-table tabindex="0" aria-label="DHCP 신규 주소 할당 메시지"}

Discover는 아직 자기 IP와 서버 위치를 몰라도 보내도록 설계돼 있다. Offer·ACK가 언제나 브로드캐스트인 것은 아니다. relay, 클라이언트 상태, BROADCAST flag 등에 따라 유니캐스트할 수도 있다. 기존 주소 재검증이나 임대 갱신에서는 네 메시지를 전부 반복하지 않을 수 있다. [RFC 2131 §3.1·§3.2·§4.1](https://www.rfc-editor.org/rfc/rfc2131.html#section-3.1)

받는 정보는 IP 하나에 그치지 않는다. 주소는 DHCP의 `yiaddr` 필드에 있고, 옵션으로는 subnet mask **1**, router **3**, DNS server **6**, IP lease time **51** 등을 전달할 수 있다. CAPPORT를 지원하는 네트워크는 옵션 **114**에 API URI를 추가할 수 있다. [RFC 2132](https://www.rfc-editor.org/rfc/rfc2132.html), [RFC 8910 §2.1](https://www.rfc-editor.org/rfc/rfc8910.html#section-2.1)

**DHCP ACK를 받았다는 것은 IP 설정을 받았다는 뜻이다. 인터넷 사용 동의가 끝났다는 뜻은 아니다.** 또한 DHCP 주소 임대시간과 포털의 인터넷 승인 유효기간은 별도다.

### 3. 다음 홉과 서버 주소 확인: ARP·DNS

DNS 서버가 같은 `/24`에 있으므로, 캐시가 없다면 먼저 **ARP(Address Resolution Protocol)**로 `192.0.2.53`의 MAC 주소를 알아내 DNS 요청을 전달할 수 있다. 일반 DNS 예시는 `노트북의 임시 UDP 포트 → DNS 서버의 UDP 53`이다. 도메인 이름을 질의하면 포털·접속 시험 서버의 IP 주소를 얻는다. DNS는 TCP/53도 지원하며, 암호화 DNS의 전송은 이 예와 다르다. [RFC 826](https://www.rfc-editor.org/rfc/rfc826.html), [RFC 1035 §4.2](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2)

목적지가 다른 서브넷이면 로컬에서 필요한 주소는 **외부 웹서버의 MAC이 아니라 게이트웨이의 MAC**이다. ARP 캐시가 없으면 `192.0.2.1`을 질의한다. IP 목적지는 외부 서버이고, 로컬 구간에서는 게이트웨이로 전달한다. 무선 프레임의 수신 AP 주소와 IP 다음 홉인 게이트웨이 주소도 같은 개념은 아니다. ARP 자체는 TCP/UDP 포트를 쓰지 않는다. [RFC 1122 §3.3.1](https://www.rfc-editor.org/rfc/rfc1122.html#section-3.3.1)

미승인 기기도 이런 준비 통신과 포털에 필요한 통신은 허용받아야 한다. 어느 주소까지 허용할지는 해당 네트워크의 제한 정책이다. 실제 순서는 ARP·DNS 캐시, 목적지 위치, 기존 연결 유무에 따라 일부 생략되거나 달라진다.

### 4-A. 기존 방식: HTTP 접속 시험과 302 Location

OS가 접속 확인용 주소에 HTTP 요청을 보낸다고 하자. 먼저 목적지 TCP/80에 **SYN → SYN+ACK → ACK**로 연결을 만들고 HTTP 요청을 보낸다. 이 TCP 연결이 성공해도 매장 인터넷 전체가 승인된 것은 아니다. [RFC 9293 §3.5](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5)

정상 응답은 OS마다 다르다. 예를 들어 응답 코드나 미리 정해 둔 본문을 확인한다. Windows NCSI는 `Microsoft Connect Test` 같은 예상 본문을 사용한다고 설명한다. Android 역시 알려진 목적지로 시험 요청을 보내 리디렉션을 감지하는 방식을 설명한다. [Microsoft NCSI](https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview), [Android 포털 감지](https://developer.android.com/about/versions/11/features/captive-portal)

기존 포털 장비는 요청을 중간에서 처리해 시험 서버 대신 다음과 같은 HTTP 응답을 보낼 수 있다. 아래 URI와 토큰은 설명용이다.

```http
HTTP/1.1 302 Found
Location: https://portal.example.org/start?ticket=opaque-example
```

`Location`은 다음에 방문할 주소다. **이 응답을 받은 OS가 포털 필요 여부를 판단하고 로그인 창·브라우저·알림을 표시한다.** AP나 DHCP 서버가 노트북에 임의의 창을 직접 실행하는 프로토콜은 아니다. 일반 브라우저에서 시작한 요청이라면 브라우저가 리디렉션을 따라갈 수도 있다. UI 종류와 표시 조건은 OS별이다. [MDN 302](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302), [Apple 포털 안내](https://developer.apple.com/news/?id=q78sq5rv)

이는 HTTP 감지의 예다. 임의의 HTTPS 웹사이트 연결을 정상인 척 바꿔서 동의 화면을 넣을 수 있다는 뜻은 아니다.

### 4-B. CAPPORT 방식: DHCP 옵션 → HTTPS 상태 API → 포털 URL

4-A와 **다른 발견 경로**다. 두 경로를 반드시 순서대로 모두 수행하는 것은 아니다. 지원 환경에서는 DHCP 옵션 114로 받은 다음 API 주소를 조회한다.

```text
https://portal.example.org/api/sessions/net-example
```

필요한 DNS 조회 뒤 TCP/443 연결을 만들고, TLS 핸드셰이크로 인증서를 검증하며 암호화 통신을 준비한다. 그 위에서 HTTPS GET을 보내고 다음과 같은 응답을 받는다.

```http
HTTP/1.1 200 OK
Content-Type: application/captive+json
Cache-Control: private

{
  "captive": true,
  "user-portal-url": "https://portal.example.org/start"
}
```

기기는 이 정보를 읽고 사용자 포털을 안내한다. **API 응답은 제한 상태와 포털 위치를 알려 주며, 동의를 대신하거나 장비를 승인하는 요청은 아니다.** HTTPS와 상태 형식은 [RFC 8908 §4–§6](https://www.rfc-editor.org/rfc/rfc8908.html#section-4)에 정의돼 있다.

### 5. 화면을 받아 표시: HTTPS GET과 웹 세션

로그인용 브라우저는 포털에 `GET /start`를 보낸다. 서버가 HTML·CSS 등을 돌려주면 브라우저가 약관과 체크박스를 그린다. 필요한 정적 파일도 미승인 상태에서 접근 가능해야 한다.

이후의 **쿠키·POST·저장 필드는 원리를 설명하기 위한 웹 애플리케이션 설계 예**다. CAPPORT의 고정 규격이나 두 카페의 실제 구현이 아니다. 서버는 예를 들어 다음 응답으로 웹 세션 쿠키를 설정할 수 있다. 헤더는 필요한 부분만 표시했다.

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Set-Cookie: __Host-portal_session=s-example; Path=/; Secure; HttpOnly; SameSite=Lax
```

브라우저는 조건에 맞는 후속 요청에 `Cookie` 헤더를 붙인다. `Secure`는 HTTPS 전송, `HttpOnly`는 스크립트의 쿠키 읽기 제한과 관련된다. 이 쿠키는 웹 요청을 묶는 식별자이지, 그 자체가 AP의 허용 규칙은 아니다. [MDN HTTP 쿠키](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)

### 6. 체크·클릭: 선택 값을 HTTP 요청으로 전송

체크박스 선택은 우선 브라우저 안의 상태다. 보통 HTML 폼 제출이나 JavaScript 요청이 실행돼야 서버에 전달된다. 폼의 `name=accepted`, `value=1`인 항목을 선택해 제출하면 아래처럼 보낼 수 있다. 일반 폼에서 선택하지 않은 체크박스는 해당 이름·값이 전송되지 않는다. [MDN checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox)

```http
POST /consents HTTP/1.1
Host: portal.example.org
Cookie: __Host-portal_session=s-example
Origin: https://portal.example.org
Content-Type: application/x-www-form-urlencoded

accepted=1&policy_version=2026-10&csrf_token=t-example
```

HTTPS를 사용하므로 위 헤더와 본문은 TLS 안에서 전송된다. 서버의 웹 프레임워크는 본문을 파싱해 `accepted`, `policy_version` 등을 읽을 수 있다. 체크박스만 그려 놓는 것으로 끝나는 것이 아니라, **화면의 선택이 요청 데이터로 직렬화돼 서버 핸들러에 도착**하는 것이다. `Content-Length` 같은 전송용 헤더는 예시에서 생략했다. [MDN 폼 전송과 서버 측 처리](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data)

`POST /consents`나 위 필드명은 표준 필수가 아니다. 실제 Meraki의 click-through 예에는 버튼을 눌러 **grant URL로 GET**을 보내는 경로도 있다. 따라서 ‘동의는 반드시 POST’라는 설명도 정확하지 않다. [Meraki Click-through API](https://developer.cisco.com/meraki/captive-portal-api/click-through-api/)

### 7. 서버 수집: 웹 세션을 접속 세션에 연결하고 기록

설명용 서버는 다음 순서로 요청을 처리할 수 있다.

1. 쿠키의 웹 세션을 조회하고 만료 여부와 요청의 유효성을 확인한다. 필요한 CSRF(Cross-Site Request Forgery) 방어와 서버 측 동의 값 검증도 이 층에서 한다.
2. 웹 세션 `s-example`을 네트워크 접속 세션 `net-example`에 연결한다. 해당 AP·현재 기기 식별 정보·승인 대상은 네트워크 측 정보와 맞춰야 한다.
3. 선택 항목과 약관 버전, 서버 수신 시각, 접속 연계 ID 등을 DB나 이벤트 저장소에 기록한다.
4. 해당 접속 세션을 승인하는 장비 연동을 수행한다.

이 중 저장 스키마·내부 DB 프로토콜·보유기간은 사업자가 선택하는 영역이다. 예를 들어 아래 같은 기록을 만들 수 있지만 **필수 수집 항목을 제시하는 것은 아니다.** 항목이 여러 개라면 화면의 각 선택과 기록도 구분해야 한다.

```json
{
  "consent_id": "consent-example",
  "network_session_id": "net-example",
  "policy_version": "2026-10",
  "accepted": true,
  "received_at": "2026-10-27T06:00:00Z"
}
```

그렇다면 서버는 노트북의 MAC을 어떻게 아는가? **브라우저가 하드웨어 주소를 직접 읽어야 하는 것은 아니다.** Meraki 외부 포털의 확인된 예에서는 네트워크가 리디렉션 URL에 `client_ip`, `client_mac`, `base_grant_url`을 추가한다. 다른 설계에서는 장비가 만든 불투명한 세션 토큰을 서버가 조회할 수 있다. 인터넷상의 포털 서버가 원격 노트북에 ARP를 보내 MAC을 알아내는 구조로 이해하면 안 된다. 서명·만료·서버 측 연결 검증은 구현상의 보안 설계이며, URL 속 MAC 값을 그대로 믿어도 된다는 뜻이 아니다. NAT 너머의 공인 IP 하나만으로 각 노트북을 구분해서도 안 된다. [Meraki 파라미터 설명](https://developer.cisco.com/meraki/captive-portal-api/click-through-api/), [RFC 8908 §4](https://www.rfc-editor.org/rfc/rfc8908.html#section-4)

**동의 기록 저장과 장비 승인은 별개 처리**다. DB 저장은 성공해도 장비 갱신은 실패할 수 있다. 성공 확인·재시도·중복 처리 방지는 이 경계를 고려해야 한다는 설계 권고다. 실제 매장이 어느 DB에 어떤 순서로 기록하는지는 확인하지 않았다.

서버가 이 예에서 확인한 것은 해당 웹 세션이 동의 값을 제출했다는 사실이다. 이것만으로 사용자의 실명이나 계정 소유까지 확인한 것은 아니다.

### 8. 실제 허용: 장비의 세션·ACL 갱신

포털 서버는 기기별 승인 결과를 접근 제한 장비에 전달해야 한다. ACL(Access Control List)·필터·역할 같은 정책에서 `net-example`의 외부 통신을 허용하도록 바뀌는 것이다. 허용 뒤에도 게스트망의 다른 제한 정책은 남을 수 있다.

이 **백엔드→장비 구간의 프로토콜은 CAPPORT가 하나로 정하지 않는다.** 제품의 컨트롤러/API나 제어 채널을 사용할 수 있다. 확인된 Meraki 예에서는 `grant URL 요청 → 클라우드 승인 → AP들에 승인 통보 → 기기 제한 해제`가 이어진다. [Meraki 처리 흐름](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting)

RADIUS(Remote Authentication Dial-In User Service)를 쓰는 구성이라면 다음 메시지도 등장할 수 있다. **모든 카페가 거치는 고정 3단계는 아니다.**

| 기능 | 일반적인 UDP 목적지 포트 | 메시지·주체 |
|---|---|---|
| 인증·인가 | 1812 | 네트워크 접속 장비와 AAA 서버의 Access-Request / Access-Accept 등 |
| 이용량·세션 accounting | 1813 | 접속 장비가 Accounting-Request 등으로 세션 기록 전달 |
| 이미 연결된 세션의 동적 인가 | 3799 | 인가 서버 측이 장비에 CoA-Request, 장비는 CoA-ACK 또는 CoA-NAK |
{: .cp-readable-table tabindex="0" aria-label="선택적인 RADIUS 서버와 장비 연동"}

AAA는 Authentication, Authorization, Accounting, CoA는 Change of Authorization이다. `Access-Accept`와 `CoA`는 같은 메시지가 아니다. 브라우저가 CoA를 직접 보내는 것도 아니며, accounting이 체크박스 동의 내용을 자동으로 수집하는 프로토콜도 아니다. TLS 기반 전송 등 다른 RADIUS 구성은 별도다. [RFC 2865](https://www.rfc-editor.org/rfc/rfc2865.html), [RFC 2866](https://www.rfc-editor.org/rfc/rfc2866.html), [RFC 5176 §2.2–§2.3](https://www.rfc-editor.org/rfc/rfc5176.html#section-2.2)

‘이용 정보 수집’까지 구분하면, **동의 이벤트는 웹 앱에서, 실제 접속시간·전송량은 네트워크 장비의 세션·카운터 등에서 얻을 수 있다.** RADIUS Accounting을 채택한 예에서는 `Acct-Input-Octets`, `Acct-Output-Octets`, `Acct-Session-Time` 같은 속성으로 종료 시 전송량·이용시간을 보고할 수 있다. 어느 정보를 실제로 수집·저장하는지는 해당 서비스 구현과 정책을 확인해야 한다. [RFC 2866 §5.3·§5.4·§5.7](https://www.rfc-editor.org/rfc/rfc2866.html#section-5.3)

### 9. 완료 확인과 일반 통신

장비 정책이 바뀐 뒤 OS가 접속 시험을 다시 하면 정상 응답을 받을 수 있다. CAPPORT 환경에서는 API 재조회에 `captive: false`가 온다. 설명용 웹 앱은 승인 확인 뒤 완료 페이지로 안내할 수도 있다. 화면의 성공 표시만으로 실제 장비 반영이 보장되는 것은 아니다. [RFC 8908 §6](https://www.rfc-editor.org/rfc/rfc8908.html#section-6)

이후 노트북의 일반 인터넷 패킷은 AP·게이트웨이의 기존 전달 경로를 이용한다. **새 IP를 반드시 다시 받거나 포털 웹서버가 모든 통신의 중계 서버가 되는 것은 아니다.** 게이트웨이에서 NAT를 하더라도 주소·포트 변환과 사용 승인 판단은 별도 기능이다.

정리하면 DHCP ACK는 주소 설정, TCP ACK는 TCP 전달·연결 제어, 체크박스 제출은 웹 요청, 장비 승인은 네트워크 정책 변경이다. 서로 다른 층에서 일어난다.

### 직접 확인할 때 어디에서 무엇을 볼까

노트북의 일반 Wireshark 캡처에서 쓸 수 있는 표시 필터 예시는 다음과 같다. 아래는 이번에 실행한 캡처 결과가 아니라 확인 위치를 안내하는 것이다.

| 확인 대상 | 표시 필터 예 | 관찰 가능한 내용·한계 |
|---|---|---|
| DHCP | `udp.port == 67 or udp.port == 68` | 신규 임대 메시지와 DHCP 옵션 |
| ARP·DNS | `arp or dns` | 다음 홉 주소 확인, 일반 DNS 질의·응답. 캐시·암호화 DNS는 다를 수 있음 |
| 접속 시험 HTTP | `http` | 평문 HTTP 요청과 리디렉션. 실제 시험 방식에 따라 다름 |
| HTTPS 연결 | `tcp.port == 443 or tls` | 연결·TLS 교환. 일반 캡처만으로 암호화된 동의 본문은 보이지 않음 |
| 체크·클릭 요청 | 브라우저 개발자 도구의 Network | 해당 브라우저의 요청 URL·메서드·폼 데이터·쿠키·응답. OS 전용 로그인 창은 별도 확인 필요 |
| 선택적 RADIUS 연동 | 장비·서버 측에서 `radius` | 노트북↔포털 캡처만으로 보이지 않는 백엔드 구간 |
{: .cp-readable-table tabindex="0" aria-label="프로토콜별 확인 위치와 캡처 한계"}

802.11 관리 프레임 확인에는 무선 어댑터·드라이버와 monitor mode 등 별도 캡처 조건이 필요할 수 있다. 동의가 실제로 저장됐는지는 포털의 서버 로그·DB에서도, 허용됐는지는 장비의 세션·정책 상태에서도 확인해야 한다. [Wireshark DHCP 필터](https://www.wireshark.org/docs/dfref/d/dhcp.html), [RADIUS 필터](https://www.wireshark.org/docs/dfref/r/radius.html), [Cisco 무선 캡처 설명](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/116493-technote-technology-00.html)

IPv6에서는 DHCPv4 DORA가 필수가 아니다. RA의 Prefix Information을 이용한 SLAAC(Stateless Address Autoconfiguration)나 DHCPv6 등으로 구성이 달라진다. CAPPORT 안내는 RA 옵션 37 또는 DHCPv6 옵션 103으로도 전달할 수 있다. [RFC 4862](https://www.rfc-editor.org/rfc/rfc4862.html), [RFC 8910 §2.2–§2.3](https://www.rfc-editor.org/rfc/rfc8910.html#section-2.2)

## 대안 비교표

포털과 암호화는 배타적인 선택지가 아니다. 예를 들어 OWE와 포털을 조합하거나, 암호로 연결한 와이파이에서 다시 포털을 요구할 수 있다.

| 방식 | 주로 해결하는 문제 | 접속 경험 | 남는 과제 |
|---|---|---|---|
| 일반 Open + Captive Portal | 웹 조건에 따른 외부 사용 승인 | 연결 후 웹 동의·로그인 | 일반 Open에는 무선 암호화가 없음. 포털 감지와 세션 관리 필요 |
| WPA2-Personal / WPA3-Personal | 암호 기반 무선 접속과 무선 암호화 | 암호 입력 | 공유 암호 배포·변경과 개별 사용자 회수 정책 |
| OWE / Enhanced Open | 암호 입력 없이 무선 구간 암호화 | Open과 비슷한 경험 | AP 신원 인증은 제공하지 않음. 지원 단말 확인 필요 |
| WPA2/WPA3-Enterprise + 802.1X/EAP | 개별 자격증명에 따른 접속 제어 | 계정·인증서·설정 프로파일 | 인증 인프라·서버 검증·자격증명 운영 |
| Passpoint | 제공자 탐색과 자격증명 기반 자동 보안 접속 | 사전 준비된 단말의 자동 연결 | 자격증명 배포와 단말·네트워크 지원 |
| OpenRoaming | 네트워크·신원 제공자 사이의 로밍 연합 | 참여 환경에서 자동 로밍 | 연합 가입·신뢰 관계·정책 연동 |
{: .cp-readable-table tabindex="0" aria-label="공용 와이파이 접속 방식 비교"}

WPA는 Wi-Fi Protected Access, EAP는 Extensible Authentication Protocol이다. WPA2-Personal의 PSK(Pre-Shared Key)와 WPA3-Personal의 SAE(Simultaneous Authentication of Equals)는 같은 프로토콜이 아니다. OWE는 인증 없는 무선 암호화이며, Passpoint와 OpenRoaming도 같은 이름이 아니다. 앞의 기능 차이는 문서로 확인했고, 운영 부담의 비교는 그 차이에서 도출한 **설계 판단**이다. [Cisco WLC 8.10 보안 설명](https://www.cisco.com/c/en/us/td/docs/wireless/controller/8-10/config-guide/b_cg810/wlan_security.html), [RFC 8110 §7](https://www.rfc-editor.org/rfc/rfc8110.html#section-7), [Microsoft Passpoint](https://learn.microsoft.com/en-us/windows-hardware/drivers/mobilebroadband/passpoint), [WBA OpenRoaming](https://wballiance.com/openroaming/)

### 보호하는 구간도 구분하기

| 수단 | 보호·제어 범위 | 그것만으로 해결되지 않는 것 |
|---|---|---|
| Captive Portal | 이 기기의 인터넷 사용 허용 여부 | 무선·웹 콘텐츠 암호화 |
| WPA 계열 / OWE | 휴대폰과 AP 사이 무선 구간 | 인터넷 웹사이트까지의 종단 보호. 특히 OWE는 AP 신원을 인증하지 않음 |
| HTTPS / TLS | 휴대폰과 해당 HTTPS 서버 사이 콘텐츠 | 매장 네트워크 사용 승인과 모든 통신 메타데이터의 은닉 |
{: .cp-readable-table tabindex="0" aria-label="사용 승인과 암호화의 보호 범위"}

TLS(Transport Layer Security)를 사용하는 HTTPS에서 검색어·비밀번호·본문이 포털 동의 때문에 자동으로 복호화되는 것은 아니다. 반면 네트워크의 주소·연결 시간·전송량 등과 암호화된 콘텐츠는 다른 정보다. **무엇을 기술적으로 관찰할 수 있는지와 실제로 무엇을 수집·보관하는지도 구분**해야 한다. [Mozilla TLS](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security), [Mozilla 암호화 DNS 설명](https://support.mozilla.org/en-US/kb/firefox-dns-over-https)

## 상황별 최적 선택

아래는 공개 기능 설명을 결합한 **설계 권고(추론)**다. 비용이나 접속 지연을 실측한 순위는 아니다.

| 상황 | 우선 검토할 구성 | 선택 기준 |
|---|---|---|
| 일회성 카페·방문객 | 안내가 필요하면 간단한 포털, 지원 환경에서는 OWE 병행 검토 | 별도 계정 배포 없이 접속 가능해야 하는가. 웹 절차가 정말 필요한가 |
| 소규모의 고정 사용자 | Personal 방식 | 공유 암호를 배포·변경할 수 있고 개별 회수 요구가 낮은가 |
| 직원·관리 단말 | Enterprise + 802.1X/EAP | 개인별 자격증명 회수와 서버 신원 검증이 필요한가 |
| 반복 방문·다수 핫스팟 | Passpoint, 사업자 간 연동이면 OpenRoaming 추가 검토 | 반복 웹 절차를 줄일 만큼 프로비저닝과 연합 운영의 이득이 있는가 |
| 기존 포털의 감지 실패 개선 | CAPPORT API/발견 규약과 기존 단말 지원 병행 | 장비·운영체제의 지원 범위와 이행 비용을 확인했는가 |
{: .cp-readable-table tabindex="0" aria-label="환경별 와이파이 구성 선택"}

규모가 커질 때는 승인 상태의 AP 간 전달, IP 변경·만료의 일관성, 포털 서버 장애 시 접근 정책이 추가 판단 기준이다. 그림은 승인 경로를 단순화한 것이므로, 실제 구성에서는 여러 장비의 상태 갱신과 장애 처리를 함께 설계해야 한다. [Meraki 처리 흐름](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting), [접속 제어·클라우드 연결 단절 정책](https://documentation.meraki.com/Wireless/Design_and_Configure/Configuration_Guides/Access_Control)

## 실전 베스트 프랙티스

- **API·사용자 포털에는 정상 HTTPS를 사용한다.** CAPPORT API와 포털은 유효한 인증서로 서버를 검증할 수 있어야 한다. [RFC 8908 §4·§7](https://www.rfc-editor.org/rfc/rfc8908.html#section-4)
- **미승인 상태에서도 절차를 끝낼 수 있게 한다.** 포털뿐 아니라 필요한 인증서 검증 등도 통과할 수 있어야 한다. [RFC 8908 §4.1](https://www.rfc-editor.org/rfc/rfc8908.html#section-4.1)
- **웹 성공과 장비의 승인을 함께 관찰한다.** 포털 요청은 성공했지만 장비 상태 갱신이 실패한 상황을 구별하도록 설계한다는 권고다. Meraki의 웹 세션·AP 승인 분리를 근거로 한 추론이다. [Meraki](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting)
- **기기 주소를 영구적인 사람 신원으로 취급하지 않는다.** Apple의 Private Wi-Fi Address처럼 주소가 달라지는 환경을 고려한다. 주소 변화에 취약한 승인 로직을 보완해야 한다는 운영 권고이며, 사용자에게 기능 해제를 기본 요구하지 않는다. [Apple Private Wi-Fi Address](https://support.apple.com/en-us/102509)
- **모바일 포털은 읽고 누를 수 있어야 한다.** 이 글의 설계 기준으로, 가로 도표를 축소하는 대신 세로 재배치하고 큰 버튼과 단계별 설명을 제공한다. 동작 줄이기 설정을 존중하며 자동 재생 없이도 내용을 이해할 수 있게 한다.

## 함정과 안티패턴

| 관찰·오해 | 가능한 원인 또는 구분할 점 |
|---|---|
| 와이파이 아이콘이 있는데 인터넷이 안 됨 | 무선 연결과 인터넷 사용 승인은 별도 상태 |
| 동의 화면이 자동으로 안 뜸 | 접속 시험 오판이나 API 안내·지원 문제일 수 있음. 화면이 안 뜬다는 사실만으로 원인을 특정할 수 없음 |
| 동의를 눌렀는데 계속 막힘 | 웹 세션 식별이나 장비 승인 반영을 별도로 확인할 필요가 있음 |
| 재방문 때 다시 동의함 | 승인 만료일 수 있음. MAC 기반 식별에서는 private MAC 변화로 새 기기로 취급될 가능성도 있음(추론) |
| 비밀번호가 없으니 무조건 무선 평문임 | OWE가 예외. 실제 보안 방식 확인 필요 |
| 동의했으니 본인인증·암호화까지 됨 | 동의, 신원 확인, 사용 승인, 암호화를 혼동한 것 |
{: .cp-readable-table tabindex="0" aria-label="접속 장애와 오해 구분"}

세션·승인 문제는 [Meraki 문서](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting), 주소 변화는 [Apple 문서](https://support.apple.com/en-us/102509)를 근거로 한다. iOS 18·iPadOS 18·macOS 15 등부터 Apple은 Off·Fixed·Rotating 설정을 설명하며, 약한 보안 또는 무보안 네트워크의 Rotating 주소는 2주 주기로 바뀐다고 안내한다. 이것만으로 특정 매장의 재동의 원인을 확정할 수는 없다.

**HTTPS 사이트를 강제로 동의 화면으로 바꾸는 방식은 피해야 한다.** HTTPS 서버인 척 응답하면 인증서 불일치가 생기며, HSTS(HTTP Strict Transport Security)가 적용된 호스트에서는 잘못된 인증서 경고를 우회할 수 없도록 한다. 정상 포털 감지와 정상 HTTPS 포털 접근을 구분해야 한다. [Mozilla HSTS 설명](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)

**VPN도 선후관계가 꼬일 수 있다.** 포털 승인이 먼저 필요한데 VPN이 그 통신을 방해하면 연결이 진행되지 않을 수 있다. Mozilla는 이런 경우 VPN·프록시를 일시 해제해 절차를 마친 뒤 다시 사용하는 방법을 안내한다. 모든 VPN을 항상 꺼야 한다거나 특정 DNS로 바꾸면 반드시 해결된다고 일반화하지 않는다. [Mozilla 포털 감지 문제 해결](https://support.mozilla.org/en-US/kb/captive-portal)

## 빅테크 실전 사례

아래는 공개된 **제품 기능·지원 사례**다. 각 회사 내부 네트워크 규모나 성능 개선율을 확인한 운영 벤치마크는 아니다.

| 제공자 | 공개된 동작과 적용 범위 | 얻을 수 있는 교훈 |
|---|---|---|
| Google / Android | Android 5.0부터 HTTP 기반 감지, Android 11 Beta 2부터 CAPPORT 기능 일부와 DHCP 옵션 114 지원 설명. API 안내가 없으면 기존 HTTP/HTTPS 시험을 계속 사용 | 새 규약 도입과 기존 단말·네트워크의 호환을 함께 다룸 |
| Apple | 2020년 iOS 14·macOS Big Sur에서 DHCP/RA 안내와 JSON API 지원을 소개 | 운영체제가 네트워크로부터 제한 상태·포털 URL·세션 정보를 명시적으로 받을 수 있음 |
| Microsoft / Windows | NCSI(Network Connectivity Status Indicator)가 active/passive probe로 인터넷·로컬 연결 상태를 판단한다고 설명 | ‘무선에 연결됨’과 ‘인터넷 가능’을 운영체제도 구분함 |
| Cisco Meraki | Continue 버튼·grant URL·세션 쿠키·클라우드/AP 승인 전달의 제품 흐름을 공개 | 사용자 웹 화면과 패킷 접근 제어 사이에 연동이 필요함 |
{: .cp-readable-table tabindex="0" aria-label="운영체제와 장비의 공개 구현 사례"}

출처: [Android](https://developer.android.com/about/versions/11/features/captive-portal), [Apple](https://developer.apple.com/news/?id=q78sq5rv), [Microsoft NCSI](https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview), [Meraki](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting). Android 페이지의 갱신일과 그 페이지가 설명하는 Android 11 도입 시점을 혼동하지 않아야 한다. NCSI 문서 역시 Windows 버전별 적용 범위를 확인해서 읽는다.

## 조사 범위와 한계

조사일은 **2026-10-27**이다. 사용 승인 메커니즘, 포털 감지, 표준화 이력, 암호화 경계와 대안을 1차 문서 중심으로 확인했다. ‘확인’은 출처가 해당 동작을 설명한다는 의미이며, 여기서 실험으로 검증했다는 뜻은 아니다. 상황별 선택과 일부 장애 원인은 추론으로 표시했다.

폴 바셋·스타벅스의 현재 SSID별 장비, CAPPORT 채택 여부, 개인정보 수집 항목·보유기간과 실제 매장 패킷은 확인하지 않았다. 최초 발명자, 비용·접속 지연·처리량 비교 수치도 입증하지 않았다. 그림의 패킷 이동 시간과 서버 배치는 설명을 위한 모형이다. 두 카페의 실제 접속 화면·약관과 일치한다고 가정해서는 안 된다.

## 참고자료

1. [RFC 7710 — Captive-Portal Identification using DHCP or Router Advertisements](https://www.rfc-editor.org/rfc/rfc7710.html): 이전 발견 규약과 문제 배경. RFC 8910으로 대체됨.
2. [IETF CAPPORT charter](https://www.ietf.org/charter/charter-ietf-capport-01.txt), [작업반 이력](https://datatracker.ietf.org/wg/capport/history/): 표준화 목적과 활동 시기.
3. [RFC 8910 — Captive-Portal Identification in DHCP and Router Advertisements](https://www.rfc-editor.org/rfc/rfc8910.html): API 발견. DHCP 코드 변경 배경은 Appendix B.
4. [RFC 8908 — Captive Portal API](https://www.rfc-editor.org/rfc/rfc8908.html): HTTPS, 상태 JSON, 사용자 포털 URL과 선택 세션 정보.
5. [RFC 8952 — Captive Portal Architecture](https://www.rfc-editor.org/rfc/rfc8952.html): 아키텍처·식별·접속 흐름과 기존 감지 방식.
6. [RFC 8110 — Opportunistic Wireless Encryption](https://www.rfc-editor.org/rfc/rfc8110.html): 인증 없는 무선 암호화와 그 한계.
7. [Apple — How to modernize your captive network](https://developer.apple.com/news/?id=q78sq5rv): iOS 14·macOS Big Sur 지원 공지.
8. [Android — Captive portal API support](https://developer.android.com/about/versions/11/features/captive-portal): Android 도입 범위와 기존 감지 방식.
9. [Microsoft — NCSI overview](https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview), [Passpoint](https://learn.microsoft.com/en-us/windows-hardware/drivers/mobilebroadband/passpoint): 연결 상태 판별과 자동 보안 접속.
10. [Cisco Meraki — Splash Page Traffic Flow](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting), [Access Control](https://documentation.meraki.com/Wireless/Design_and_Configure/Configuration_Guides/Access_Control): 제품 구현 예와 미승인 접근 정책.
11. [Cisco WLC 8.10 — WLAN Security](https://www.cisco.com/c/en/us/td/docs/wireless/controller/8-10/config-guide/b_cg810/wlan_security.html), [WBA OpenRoaming](https://wballiance.com/openroaming/): 무선 보안 방식과 로밍 연합의 역할.
12. [Apple — Private Wi-Fi addresses](https://support.apple.com/en-us/102509): 버전별 주소 설정과 회전 동작.
13. [Mozilla — TLS](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security), [HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), [Captive portal detection](https://support.mozilla.org/en-US/kb/captive-portal), [DNS over HTTPS](https://support.mozilla.org/en-US/kb/firefox-dns-over-https): 웹 암호화와 포털 문제 해결의 범위.
14. [RFC 2131](https://www.rfc-editor.org/rfc/rfc2131.html), [RFC 2132](https://www.rfc-editor.org/rfc/rfc2132.html): DHCPv4 메시지·임대·옵션.
15. [RFC 826](https://www.rfc-editor.org/rfc/rfc826.html), [RFC 1122 §3.3.1](https://www.rfc-editor.org/rfc/rfc1122.html#section-3.3.1), [RFC 1035 §4.2](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2), [RFC 9293 §3.5](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5): ARP·다음 홉·DNS·TCP 연결의 역할.
16. [Cisco — 802.11 WLAN](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/116493-technote-technology-00.html), [Meraki Click-through API](https://developer.cisco.com/meraki/captive-portal-api/click-through-api/): 관리 프레임과 실제 외부 포털 연동 예.
17. [MDN — 302](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302), [HTTP 쿠키](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies), [폼 데이터 전송](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data), [checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox): 포털 화면·클릭 요청을 구성하는 웹 기술.
18. [RFC 2865](https://www.rfc-editor.org/rfc/rfc2865.html), [RFC 2866](https://www.rfc-editor.org/rfc/rfc2866.html), [RFC 5176](https://www.rfc-editor.org/rfc/rfc5176.html): 선택적인 RADIUS 인증·인가, accounting, 동적 인가.
19. [RFC 4862](https://www.rfc-editor.org/rfc/rfc4862.html), [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737.html): IPv6 주소 자동 구성과 문서용 IPv4 주소.
