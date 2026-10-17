# 게시·브라우저 검증

- 본문 게시 커밋: `a2e6f1701d884392d91e022b1d92152144bdd974`.
- 원격 GitHub contents API로 `_posts/2026-10-17-l2-l3-days-7-18.markdown`을 읽어 로컬 원문과 byte-for-byte 일치 확인.
- GitHub Pages 실제 Jekyll build와 deploy 모두 success: https://github.com/m1ser4ble/m1ser4ble.github.io/actions/runs/39000160833
- 공개 permalink HTTP 200과 일차별 SVG root 12개 확인: https://m1ser4ble.github.io/network/l2-l3-days-7-18/
- 로컬 Markdown 미리보기 25개 검사 통과. Ruby/Bundler가 없어 로컬 Jekyll build로 표기하지 않음. 실제 Jekyll 검증은 위 Pages build 결과.
- **배포된 페이지에서도 25개 검사 모두 통과:** desktop1280/mobile390에서 12개 패널의 모든 scenario 버튼, 표시 상태 변화, keyboard Enter, SVG 텍스트 경계, 페이지 가로 overflow와 JavaScript 오류 없음; JavaScript 비활성 환경의 본문·noscript 설명 보존.
- 최초 live 자동검사 중 클릭 대기 timeout이 한 차례 발생했다. 해당 패널의 프레임별 좌표·크기·스크롤값 20회는 안정적이고 pageerror가 없었으며 개별 클릭은 통과했다. 후속 전체 검사에서도 클릭은 모두 통과했다. 원인 확정 없이 제품 수정으로 '고쳤다'고 주장하지 않음.
- 후속 no-JS 검사에서 사이트 자체 noscript 하나까지 세는 test scope 오류를 발견했다. 사이트 13개를 그림 12개와 혼동한 것이므로 검사 selector를 `.l2l3-panel noscript`로 좁혔고 전체 live 검사가 통과했다. 본문이나 시각화 동작 변경은 불필요했다.
- 실제 네트워크 실습·장애 주입·패킷 캡처·성능 검증을 실행한 결과는 아니다. 본문 명령은 미실행 예시다.

재실행: Playwright가 있는 환경에서 `L2L3_URL=https://m1ser4ble.github.io/network/l2-l3-days-7-18/ node test/l2l3_drd_browser.cjs`. 필요시 `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE`, `L2L3_REVIEW_DIR` 지정.
