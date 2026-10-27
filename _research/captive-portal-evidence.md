# Captive Portal DRD 근거 메모

조사일: 2026-10-27. 대상: `_posts/2026-10-27-captive-portal-wifi.markdown`과 해당 글의 교육용 시각화. 초기에는 문헌 중심으로 확인했고, 이후 단일 Mac 연결의 DHCP 응답과 HTTP·HTTPS·포털 HTML·HEAD 응답을 관찰했다. 실제 무선 프레임·장비 내부 관리 패킷 캡처와 승인 요청 실행은 수행하지 않았다. 문헌 확인과 직접 관찰은 아래 후속 표에서 구분한다.

## 질문과 선정 기준

연결·동의·승인의 경계, 자동 포털 감지, 개인정보와 암호화 구분, 표준화 이력 및 대안을 조사했다. IETF/RFC 원문과 OS·장비 제공자 공식 문서를 우선했다. 기존 조사에서 확인하지 못한 개별 카페 정책을 오래된 기사·블로그로 채우지 않았다. 핵심 질문에 근거 또는 명시적 한계가 확보된 시점에 조사를 종료했다.

| 주장 | 실제 읽은 근거·관련 절 | 적용 범위 | 상태 |
|---|---|---|---|
| Captive Portal은 조건 충족 전 통신을 제한하는 구조, 웹 화면은 User Portal | https://www.rfc-editor.org/rfc/rfc8952.html §1.2·§2 | 2020-11, Informational | 확인 |
| 동의·과금 조건, 기존 가로채기 방식의 문제 | https://www.rfc-editor.org/rfc/rfc7710.html §1 및 https://www.ietf.org/charter/charter-ietf-capport-01.txt | 2015-12 / 2016 charter | 확인 |
| 최초 발명자·용어 최초 사용 | 조사한 RFC·WG 기록은 표준화만 입증 | 조사 범위 내 | 미확인, 단정 제외 |
| CAPPORT 작업반 2016-01-04 승인, 2020-12-07 종료 | https://datatracker.ietf.org/wg/capport/history/ | 해당 기록 날짜 | 확인 |
| RFC 8910이 RFC 7710 대체, DHCPv4 114·DHCPv6 103·RA 37 | https://www.rfc-editor.org/rfc/rfc8910.html §2 | 2020-09 | 확인 |
| 160→114 코드 변경은 IETF 106 실험의 장비 충돌과 관련 | 같은 RFC Appendix B | RFC가 보고한 실험 | 확인, 본문에서는 설명을 확장하지 않음 |
| 발견 옵션은 포털 UI가 아닌 API endpoint URI 전달 | RFC 8910 §2 및 https://www.rfc-editor.org/rfc/rfc8908.html §5 | 2020 규약 | 확인 |
| HTTPS API·captive 필수·나머지 선택 필드와 재조회 | RFC 8908 §3–§6 | 2020-09 Standards Track | 확인 |
| IP·MAC 등 식별과 포털→집행 장비 연동 | RFC 8952 §2.4·§3·§4 | 아키텍처 설명 | 확인 |
| 6단계 상태 모델과 순간 이동 시간 | 위 흐름을 설명용으로 재구성 | 실제 패킷·성능 실험 아님 | 추론/모형 |
| Meraki Continue·grant URL·쿠키·클라우드/AP 승인·만료 | https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting | 해당 제품 문서 | 제품 설명 확인. 단일 현장 관찰은 아래 후속 표와 구분 |
| Android 5.0 기존 감지, 11 Beta 2 API 일부·DHCP 114 | https://developer.android.com/about/versions/11/features/captive-portal Improved captive portal detection | 설명 대상 버전, 확인일 페이지 갱신 표시는 2026-10-23 | 확인 |
| Apple iOS 14·Big Sur 포털 API/발견 안내 | https://developer.apple.com/news/?id=q78sq5rv | 2020-06-22 공지 | 확인 |
| Windows NCSI active/passive probe | https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview | 문서 버전별 적용표 및 Windows 11 본문 | 확인, 전체 Windows 버전 동일 구현 주장 제외 |
| OWE는 인증 없는 무선 암호화·AP 신원 미보장 | https://www.rfc-editor.org/rfc/rfc8110.html §1·§6·§7 | 2017-03 Informational | 확인 |
| WPA2 PSK와 WPA3 SAE 차이·Enhanced Open | https://www.cisco.com/c/en/us/td/docs/wireless/controller/8-10/config-guide/b_cg810/wlan_security.html WPA3/Enhanced Open | Cisco 8.10 설명, 최신 장비 설정 가이드로 전용하지 않음 | 확인 |
| Passpoint의 제공자 탐색·자동 보안 인증, OpenRoaming의 연합 역할 | https://learn.microsoft.com/en-us/windows-hardware/drivers/mobilebroadband/passpoint 및 https://wballiance.com/openroaming/ | 각 제공자 공식 설명 | 확인 |
| 개인별 회수·방문 빈도·호환성에 따른 구성 선택 | 위 기능·요구조건을 결합 | 비용·지연·규모 실측 없음 | 추론 |
| Private Wi-Fi Address Fixed/Rotating 및 2주 회전 | https://support.apple.com/en-us/102509 Learn how this feature works | iOS/iPadOS 18, macOS 15 등 설명 | 확인 |
| 주소가 바뀌면 MAC 기반 포털이 새 기기로 볼 수 있음 | 주소 변화 + 기기 식별 구조에서 도출 | 모든 매장의 재승인 원인으로 일반화 불가 | 추론 |
| HTTPS 콘텐츠 암호화와 HSTS 인증서 오류 처리 | https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security 및 https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security | 웹 프로토콜 설명 | 확인 |
| VPN/프록시 때문에 포털 절차가 방해될 수 있음 | https://support.mozilla.org/en-US/kb/captive-portal VPN or proxy | 문제 해결 안내 | 확인, 항상 VPN 해제 권고는 제외 |
| DNS 변경이 특정 카페 포털에 미치는 영향 | 직접 자료·실험 미확보 | 매장별 구성 | 미확인, 일반화 제외 |
| 폴 바셋·스타벅스 전체의 장비·API 채택·수집목록·보유기간 | 한 연결의 표시·응답만 후속 관찰 | 전체 SSID/매장 정책과 개인정보 저장은 미확인 | 단일 관찰에서 전체로 일반화하지 않음 |

## 버전·불일치 주의

- RFC 8952는 Informational, RFC 8908·8910은 Standards Track이다.
- Android 페이지의 갱신 날짜가 API의 최초 도입 날짜는 아니다.
- RFC 8910 §2에는 미디어 형식으로 `application/capport+json`이 등장하지만 API 명세 RFC 8908 §5·§8.1의 등록 형식은 `application/captive+json`이다. 예시는 API 명세를 따랐다. 정오표 처리 여부는 이번 조사에서 확인하지 못했다.
- 최신 OS가 지원하는 기능을 개별 카페가 배포했다는 근거로 사용하지 않았다.

## 검증 재현

Jekyll 빌드 후 `CAPPORT_SITE_URL`로 실제 렌더 페이지를 검사한다. 값을 생략한 브라우저 테스트는 include 단독 fixture 검사이므로 전체 사이트 검사로 보고하지 않는다.

```sh
bundle exec jekyll build --destination /tmp/captive-portal-site
python3 -m http.server 8872 --bind 127.0.0.1 --directory /tmp/captive-portal-site
CAPPORT_SITE_URL=http://127.0.0.1:8872 PLAYWRIGHT_MODULE=/tmp/captive-portal-tools/node_modules/playwright node test/captive_portal_browser.cjs
```

로컬 기본 Ruby 선택이 달라 명령이 실패하면 설치된 Ruby 3.1.2의 `bin`을 PATH 앞에 두고 실행한다. 저장소 Gemfile·lock 수정은 이 작업에 포함하지 않는다. Playwright는 임시 디렉터리에만 설치하며 블로그 실행 의존성을 추가하지 않는다.

## 게시 전 검증 결과

- Jekyll 3.9.2 전체 빌드 성공. 기존 다른 글의 Liquid 문법 경고는 남아 있으며 이번 글에서 발생한 경고는 없다.
- 실제 Jekyll 렌더 페이지에서 Chrome 320·390·1440px 검사 통과. 6단계 미승인/승인/만료, 버튼 경계, 자동 진행 없음, SVG 글씨 14px 이상·노드 안 배치, 버튼 높이 44px 이상, 페이지 가로 넘침 없음 확인.
- 실제 본문 폭에 따라 가로/세로 노드 재배치, 승인 단계에서 resize 후 상태 보존, 승인 색 전환을 확인했다.
- reduced motion에서 이동 효과가 생기지 않고, JavaScript 비활성 또는 D3 CDN 실패 시 조작 버튼을 숨기며 대체 설명이 남는 것을 확인했다.
- 모바일 본문 표의 작은 글씨·열 압축 문제를 독립 리뷰에서 발견해 수정했다. 현재 표는 16px·셀 최소 140px이며 표 내부 스크롤과 키보드 방향키 이동을 확인했다.
- 독립 기술 리뷰에서 확인한 주요 RFC·OS·제품 문서와 본문 주장을 대조했으며 출판을 막는 기술 오류는 발견하지 못했다. 시각화와 표 스크린샷을 직접 확인했다.
- `node --check test/captive_portal_browser.cjs`와 Git 공백 검사 통과.

이 초기 게시 전 검증에서는 실제 매장망을 관찰하지 않았다. 같은 날 후속으로 수행한 단일 연결 관찰은 아래 절에 기록했다. iOS Safari 실기기, Firefox, 스크린리더 실사용, 유료/과부하/성능 실험은 검증하지 않았다. 로컬 페이지 검사와 공개 게시 후 검사도 구별한다.

## 후속 보강: 프로토콜과 동의 데이터의 전달 절차

같은 날 사용자가 패킷·요청 수준의 설명 누락을 지적했다. 기존 구성요소 설명을 보존하면서 신규 Open System/IPv4 접속의 메시지 절차, 발견 경로 분기, 웹 세션·동의 기록·장비 승인 구분을 추가했다. 예시 HTTP/1.1과 DB 필드는 합성한 설계이며 실제 카페 캡처가 아니다.

| 주장 | 실제 읽은 추가 근거 | 상태·조건 |
|---|---|---|
| Open System 인증·Association은 IP 설정 전 802.11 관리 프레임 | https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/116493-technote-technology-00.html Open System/Association | 확인, WPA3 등 전체 인증 방식으로 일반화하지 않음 |
| DHCP DORA·UDP67/68·초기 REQUEST broadcast·Offer/ACK 조건 | https://www.rfc-editor.org/rfc/rfc2131.html §3.1·§3.2·§4.1 | 확인, 신규 임대 예. 재접속·갱신은 흐름 다름 |
| yiaddr와 mask/router/DNS/lease 옵션 | https://www.rfc-editor.org/rfc/rfc2132.html §3.3·§3.5·§3.8·§9.2 | 확인, API URI option114는 RFC8910 |
| ARP로 로컬 다음 홉, DNS로 이름 해석, TCP 연결은 별도 | https://www.rfc-editor.org/rfc/rfc826.html, https://www.rfc-editor.org/rfc/rfc1122.html §3.3.1, https://www.rfc-editor.org/rfc/rfc1035.html §4.2, https://www.rfc-editor.org/rfc/rfc9293.html §3.5 | 확인, 캐시/주소구성/전송에 따라 생략·순서 변화 |
| HTTP302 Location은 이동 안내이고 OS가 포털 UI 판단 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302, Android·Apple 공식 문서, Microsoft NCSI overview | 확인, OS별 probe 정상 응답·UI 차이 |
| DHCP114→API→user-portal-url, HTTPS API는 인가 명령 아님 | RFC8910 §2, RFC8908 §3–§6 | 확인 |
| Set-Cookie→후속Cookie, 폼값본문전송과서버파싱 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies 및 https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data | 확인, POST/경로/필드명은 예시 설계 |
| unchecked checkbox의 name/value는 일반 폼 제출에서 생략 | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox | 확인 |
| Meraki가 client_ip/client_mac/base_grant_url 파라미터 추가, grant는 GET | https://developer.cisco.com/meraki/captive-portal-api/click-through-api/ Logic Flow·Splash Page URL·Login URL | 확인, 브라우저 하드웨어 MAC 조회가 아님 |
| 동의DB 기록·세션 매핑·서버측검증·장비갱신 성공확인·중복방지 | 위 웹/장비 경계를 바탕으로 합성 | 추론/설명용 설계. 실제 매장 스키마·보유기간 미확인 |
| RADIUS1812/Accounting1813/CoA3799와ACK/NAK | https://www.rfc-editor.org/rfc/rfc2865.html Implementation Note·§4, https://www.rfc-editor.org/rfc/rfc2866.html, https://www.rfc-editor.org/rfc/rfc5176.html §2.2·§2.3 | 확인, 선택 구성이고 모든 포털의 필수 고정 단계 아님 |
| 이용시간·전송량 속성과 웹 동의 이벤트 구별 | RFC2866 §5.3·§5.4·§5.7 | 확인, 종료 시 보고 예. 실제 매장 수집 목록 아님 |
| Wireshark 표시 필터·웹개발자도구·백엔드 캡처 위치 구분 | https://www.wireshark.org/docs/dfref/d/dhcp.html, https://www.wireshark.org/docs/dfref/r/radius.html, Cisco 캡처 설명 | 확인/진단 안내, 실제 매장 캡처 미실행 |
| IPv6 SLAAC/RA는 DHCPv4 DORA와 별도 | https://www.rfc-editor.org/rfc/rfc4862.html | 확인, 본문은 IPv4 예시로 한정 |

추가 출처도 2026-10-27 기준으로 원문을 확인했다. 실제 매장의 동의 저장소·인가 프로토콜·패킷과 현재 노트북 OS의 probe 정책은 확인하지 않았다.

후속 검증에서도 Jekyll 전체 빌드와 실제 렌더 페이지의 320·390·1440px 브라우저 회귀가 통과했다. 새 프로토콜 상세의 기본 닫힘·단계별 메시지 변경·열었을 때 글씨 크기/가로 넘침·JS/CDN 실패를 검사했다. stable anchor `protocol-walkthrough`, HTTP 예시와 11개 접근 가능한 표도 확인했다. 독립 리뷰는 주요 추가 표준·제품 원문과 절차를 대조했고 수정이 필요한 문제를 발견하지 못했다. 새 실제 매장 실험을 수행한 것은 아니다.

## HTTP 리디렉션·방화벽·관리 연결과 단일 현장 관찰의 통합

사용자의 명시적인 DRD 보강 요청에 따라 같은 `/network/captive-portal/` 글에 추가했다. 별도 포스트나 URL을 만들지 않는다. 추가 질문은 시험 URL의 출처, 307 Location 전달, AP의 TCP 중간 처리, 차단의 실제 구현, DHCP 확장의 역할, 사설망 장비의 클라우드 연결, 일반 예시와 현장 화면의 차이다.

### 문서 확인

| 주장 | 실제 읽은 원문 | 적용 범위·상태 |
|---|---|---|
| OS는 설정된 시험 URL·예상 응답을 사용, AP가 포털로 안내 | Meraki Splash Page Traffic Flow, Fetching the Splash URL / Android Captive portal API support | 문서 확인. 현재 macOS 자동 UI 이벤트는 직접 미캡처 |
| Meraki가 원래 서버 대신 SYN+ACK과 HTTP307을 처리 | 같은 Meraki 문서 §Fetching the Splash URL | 제품 동작 확인. 현재 AP의 무선 프레임 미캡처 |
| 307은 Location으로 메서드·본문 유지 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/307 | 프로토콜 설명 확인 |
| DHCP114는 API 위치를 싣는 확장 옵션 | https://www.rfc-editor.org/rfc/rfc8910.html §1·§2.1 | 확인, 별도 푸시 프로토콜이나 포트 번호 아님 |
| 접근 제한은 장비 규칙, 특정 구현은 표준이 강제하지 않음 | RFC8952 §2.4 / openNDS v10.3.0 config Firewall Restart hook / Meraki ACL 설명 | 문서 확인. nftables가 현장 Meraki 내부 구현이라는 주장 제외 |
| 장비가 먼저 시작한 보안 관리 터널로 양방향 관리 | https://documentation.meraki.com/Platform_Management/Dashboard_Administration/Design_and_Configure/Configuration_Guides/Routing_and_Firewall/Upstream_Firewall_Rules_for_Cloud_Connectivity 도입부 | 제품 구조 확인. 현재 관리 채널 패킷·포트 직접 미측정 |
| HTTP 리디렉션과 HTTPS 허용이 동시 가능한 정책 | Meraki Splash Page Traffic Flow, Captive portal strength / Traffic Shaping and Firewall Rules | 기능 확인. 현장 콘솔 설정값은 추론에 그침 |

### 실제 관찰과 원본 위치

관찰일은 2026-10-27, 로컬 파일 기준 약 17:16–17:21 KST. `en0`에 직접 바인딩한 curl과 현재 DHCP ACK·인터페이스 정보를 사용했다. curl은 리디렉션 자동 추적을 하지 않았고, `/grant`는 요청하지 않았다. 원본 쿠키·클라이언트 주소·접속별 key 및 path는 공개 저장소에 복사하지 않았다. 로컬 원본 파일은 작업 당시 `/tmp/wifi-check-*`에 남겨 두었다.

| 관찰 | 실제 읽은 로컬 근거 | 상태·한계 |
|---|---|---|
| en0 활성, 5GHz802.11ac, 보안None, SSID표시가림 | networksetup / scutil / ifconfig / system_profiler 출력 | 직접 관찰. 현재 SSID 문자열 미확인 |
| 현재 IPv4 DHCP ACK에 옵션114 없음 | ipconfig getpacket en0 출력 | 직접 관찰. 모든 과거 응답·다른 망으로 일반화 불가 |
| Apple·Microsoft HTTP시험 모두307 | wifi-check-apple.headers / wifi-check-ms.headers | 직접 관찰. 자동OS시험 캡처는 아님 |
| Location호스트 apac.network-auth.com, client_ip/client_mac/acl_ver 등 필드 | 위 응답의 Location을 파싱 | 직접 관찰. 값은 게시하지 않음 |
| example.com HTTPS200·TLS검증성공 | curl --interface en0 실행 출력, wifi-check-https.body | 직접 관찰. 시험한 목적지 한정 |
| 게이트웨이 로컬HTML에Meraki표시 | wifi-check-gateway.body | 직접 관찰. 모델/펌웨어/정책 테이블 미확인 |
| 포털HTML에폴바셋이미지, form없고grant링크 | wifi-check-portal.body의 img/a/form 구조 | 직접 관찰. 모든 매장·개인정보 수집 방식으로 일반화 불가 |
| Secure·HttpOnly clickthrough-sessions계열 쿠키 | wifi-check-portal.headers의 쿠키 이름·속성 | 직접 관찰. 쿠키 값 비공개 |
| 클릭코드 HEAD→Continue-Url읽기→grant이동 | wifi-check-portal.body의 첫 a.onclick 핸들러 | 코드 직접 확인. 클릭 자체·grant 실행 미수행 |
| HEAD에200과폴바셋/store/wifi.pb Continue-Url | wifi-check-portal-head.headers | 같은 포털·발급 쿠키로 HEAD 직접 수행 |
| Allow non-HTTP 설정과 관찰이 부합 | HTTP307·HTTPS200 + 제품 기능 설명 | 추론. 콘솔 설정 조회로 보고하지 않음 |

새 도식은 HTTP 리디렉션과 DHCP114/CAPPORT의 주소 전달 위치를 비교하는 교육용 모형이다. 실측 프레임의 재생으로 표현하지 않는다. 기존 6단계 도식도 엄격한 차단 정책의 예시임을 명시해 관찰한 연결과 혼동을 줄인다.

통합 검증: Jekyll 전체 빌드 성공, 같은 URL에서 기존 6단계와 새 2모드×5단계의 320·390·1440px 브라우저 회귀 통과. 모드 전환·단계 경계·로컬 처리의 단일 노드·글씨/버튼 크기·가로 넘침·키보드·reduced motion·JS/CDN 실패 fallback을 확인했다. HTML에는 두 SVG 패널, D3 1회 로딩, 기존 protocol-walkthrough와 새 http-redirect/observed-network 앵커, 초점·이름을 갖춘 13개 표가 있다. 독립 리뷰에서 문서·관찰·추론 구분과 모바일 캡처를 확인했으며 치명·중요 오류는 발견하지 못했다. 로컬 원본의 실제 MAC/IP/세션·쿠키·사이트 경로 값을 출력하지 않고 공개 소스와 렌더 HTML에 대조했으며 일치가 없었다. Safari 실기기·스크린리더·승인 후 상태 변화는 이번에도 미검증이다.
