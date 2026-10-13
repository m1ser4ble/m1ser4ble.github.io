# DDS 연재 구현 검증

확인일: 2026-10-13. 허브 1개와 개념별 글 10개를 기존 Jekyll `_posts` 구조에 추가했다. `knowledge_links`로 선언한 관련 글의 역방향 링크를 빌드 시 산출한다. 임의 본문 전체에서 링크를 추출하는 기능은 아니다.

## 확인 결과

- Jekyll 3.9.2 전체 빌드 성공. 기존 clean HEAD 빌드와 비교해 기존 Liquid 경고 63개가 동일하며 추가 경고는 없다.
- Ruby 링크·metadata·자산·resize 검사: 7 tests, 171 assertions, 실패 0.
- Node SVG scene 검사 성공: 11개 주제의 고유 구조·의미·최종 상태와 guide 링크, 복구 3/3 경계 확인.
- Chrome standalone player 검사: 14/14 성공. 재생·탐색·속도·키보드·동작 줄이기·320px 화면·라벨 가림·height 보고 확인.
- 실제 Jekyll 사이트 Chrome 통합 검사: 25/25 성공. 11개 글을 1440/390px에서 확인하고 링크·초기 iframe 높이·페이지 가로 넘침·메시지 trust boundary·guide 이동·부모 스크립트 4초 지연 후 높이 동기화를 확인했다.
- 실제 페이지와 SVG 화면을 눈으로 검토했다. 모바일 도식은 내부 가로 스크롤을 사용하며 설명과 조작은 화면 폭에 맞춘다.
- 독립 기술 리뷰에서 표준 연표, 버전 경계, Security/Persistence/Statistics 및 모델 용어를 검토했다. 코드 리뷰에서 발견한 초기 높이 누락·숨겨진 링크의 focus·복구 count/state 불일치는 수정 후 검사했다.

## 재현

```sh
node _animations/dds/build.mjs
node _animations/dds/tests/scenes.cjs
bundle exec ruby test/dds_knowledge_links_test.rb
bundle exec jekyll build --destination /tmp/dds-series-site
```

브라우저 검사는 외부에 설치된 Playwright와 Chrome을 이용한다. 사이트 실행 의존성은 추가하지 않았다.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node _animations/dds/tests/browser.cjs
python3 -m http.server 8870 --bind 127.0.0.1 --directory /tmp/dds-series-site
PLAYWRIGHT_MODULE=/path/to/playwright DDS_SITE_URL=http://127.0.0.1:8870 node test/dds_site_browser.cjs
```

## 범위

2026-10-09 C++ 실험의 179개 상태 머신 검사와 20개 통합 사례는 기존 기록을 설명한 것이며 이번 게시물 작업에서 재실행하지 않았다. 실장비, 다중 머신, RT 보장, Security/Persistence/OTel 배포 또는 GVA 적합성을 검증한 결과로 확대하지 않는다. SVG 시간·이동은 설명용 모형이다.

Safari·Firefox·스크린리더 실사용 검사는 수행하지 않았다. 공개 push/deploy는 수행하지 않았다. `_research`는 Jekyll 출력 대상에서 제외한다.
