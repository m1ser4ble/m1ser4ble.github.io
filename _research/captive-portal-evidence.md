# Captive Portal DRD 근거 메모

조사일: 2026-10-27. 대상: `_posts/2026-10-27-captive-portal-wifi.markdown`과 해당 글의 교육용 시각화. 공개 1차 자료 원문을 확인했으며 실제 매장 접속·패킷 측정은 수행하지 않았다.

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
| Meraki Continue·grant URL·쿠키·클라우드/AP 승인·만료 | https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/MR_Splash_Page/Splash_Page_Traffic_Flow_and_Troubleshooting | 해당 제품 문서 | 확인, 카페 채택 근거 아님 |
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
| 폴 바셋·스타벅스 현행 장비·API 채택·수집목록·보유기간 | 최신 해당 서비스 1차 근거 미확보 | SSID/매장별 차이 가능 | 미확인 |

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

실제 매장망, iOS Safari 실기기, Firefox, 스크린리더 실사용, 유료/과부하/성능 실험은 검증하지 않았다. 로컬 검사와 공개 게시 후 검사는 구별한다.
