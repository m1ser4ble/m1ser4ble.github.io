---
layout: single
title: "Linux 장비 어댑터: TCP·UART·RS-422·CAN에서 DDS까지"
date: 2026-10-13 00:00:00 +0900
categories: [system]
permalink: /dds/device-adapters/
excerpt: "Linux 장비 어댑터는 TCP·직렬 바이트 스트림과 CAN 프레임을 각 규격대로 검증한 뒤 의미 있는 DDS 데이터로 바꿉니다."
knowledge_id: dds-device-adapters
series: dds
knowledge_links: [dds-guide, dds-basics, dds-gva-losa, dds-fault-diagnosis]
toc: true
toc_sticky: true
tags: [dds, linux, device, networking]
source: 'DDS Device Lab 기술 학습 노트와 공개 1차 자료'
---

Linux 장비 어댑터의 일은 포트를 여는 데서 끝나지 않습니다. 장비별 전기·전송 인터페이스와 메시지 규격을 확인하고, 온전한 값을 검증해 공통 데이터 계약으로 변환한 다음 DDS `DataWriter`에 전달합니다. Ethernet/TCP, UART 기반 RS-422, CAN/SocketCAN은 서로 다른 층의 기술이므로 같은 수신 코드로 취급할 수 없습니다.

## 네 이름은 같은 층의 대안이 아니다

Ethernet은 MAC·물리 계층을 포함하는 LAN 표준 계열이고, TCP는 신뢰성 있는 연결형 바이트 스트림 전송입니다. RS-422는 차동 직렬 신호의 전기적 특성을 정하며 그 위의 데이터 프레임을 정의하지 않습니다. CAN은 bus frame·중재 등을 정의하고 Linux SocketCAN은 CAN을 앱에 소켓 API로 제공합니다. 실제 장비 계약서(ICD)는 별도로 baud/parity, CAN ID, 필드, 단위, byte order, checksum 같은 내용을 정해야 합니다. [Linux SocketCAN 문서](https://docs.kernel.org/networking/can.html)는 CAN ID가 버스 중재에 쓰이며 Ethernet의 MAC 주소와 다르다고 설명합니다.

| 입력 | 보통 앱이 읽는 것 | 프레임 경계 | 앱이 추가로 확인할 것 |
|---|---|---|---|
| Ethernet 위 TCP | `recv()`가 돌려준 payload 바이트 | TCP는 byte stream. 송신 `send()` 한 번과 수신 `recv()` 한 번은 대응하지 않음 | length/sync/CRC 등 장비 규약, 연결·timeout·부분 수신 |
| UART 기반 RS-422 | `/dev/tty*` character device의 바이트 | 직렬 메시지의 경계를 장비 프로토콜이 정의 | 전기적 RS-422 포트, termios 설정, 프레임 parser |
| CAN / SocketCAN | CAN frame (`can_id`, length, payload) | 커널 API가 frame 경계를 제공 | ID·필터·오류 frame·payload 의미와 byte order |
| DDS가 내장된 장비 | 타입이 있는 DDS sample | DDS 데이터 모델 | 장비가 실제로 제공하는 topic·type·QoS와 인증 조건 |

`recv()`는 TCP 헤더나 Ethernet frame을 반환하지 않고 소켓에서 읽을 수 있는 응용 payload 바이트 수를 반환합니다. 요청한 길이보다 짧게 돌아올 수 있으므로 `recv(fd, buf, 20'000, ...)` 한 번이 20 KB 응용 메시지 완성이나 하나의 wire segment를 뜻하지 않습니다. 프레이밍은 TCP payload의 프로토콜에서 구현합니다. [recv(2)](https://man7.org/linux/man-pages/man2/recv.2.html)와 [tcp(7)](https://man7.org/linux/man-pages/man7/tcp.7.html)를 참고하세요.

예를 들어 512 byte 메시지를 읽는데 첫 `read`가 245 byte, 다음이 300 byte를 돌려주면 누적 버퍼에는 545 byte가 있습니다. parser는 첫 512 byte를 검증·처리하고 나머지 33 byte를 다음 메시지용으로 보존합니다. 여기서 245와 300은 앱의 read 결과 크기이며 TCP segment 크기를 뜻하지 않습니다.

## 포트에서 타입 있는 데이터까지

아래 애니메이션은 하드웨어별 수신 API, 프레임 복원·검증, 공통 데이터 변환, DDS 발행이라는 책임 경계를 보여 주는 설명용 예시입니다. 특정 센서 캡처나 성능 측정 결과가 아닙니다.

<iframe class="dds-animation" src="{{ '/assets/animations/dds/index.html' | relative_url }}?topic=device-adapters" title="TCP·UART·CAN 입력을 프레임 검증 후 DDS 데이터로 변환하는 설명용 애니메이션" loading="lazy" style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px;background:#111820;" allow="fullscreen"></iframe>

정적 의미: 각 입력 경로의 byte/frame을 장비 계약에 따라 해석하고, 잘못된 데이터는 거부하며, 검증된 측정값만 타입이 있는 DDS sample로 발행합니다. 실제 포트·드라이버와 메시지 규칙은 장비마다 달라집니다.

수신 대기 방법은 프레이밍과 별개입니다. `poll()`/`epoll`은 file descriptor에 읽기를 시도할 수 있는지 알려 주며 완성된 장비 메시지를 알려 주지 않습니다. 수신 가능한 데이터가 없을 때는 blocking I/O나 이벤트 대기를 사용하고, 반복해서 즉시 재확인하는 busy-wait를 피합니다. UART는 TTY API와 `termios` 설정을 사용하고, CAN은 `socket(PF_CAN, SOCK_RAW, CAN_RAW)`로 열어 CAN interface에 bind할 수 있습니다. [termios(3)](https://man7.org/linux/man-pages/man3/termios.3.html), [poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html), [SocketCAN 사용법](https://docs.kernel.org/networking/can.html#how-to-use-socketcan)

RS-422와 UART도 같은 말이 아닙니다. RS-422는 전기 신호 규격이고 UART는 흔히 그 신호 위의 문자/바이트 흐름을 처리하는 장치·설정의 일부입니다. RS-422 차동 엔코더 펄스를 읽는 경로라면 `/dev/tty*`가 아니라 counter 입력 하드웨어일 수 있습니다. 따라서 “RS-422 포트면 TTY로 읽는다”고 미리 가정하지 말고 회로, 어댑터, 드라이버와 장비 매뉴얼을 확인합니다.

SocketCAN 소켓 역시 TCP/IP 소켓과 같지 않습니다. Linux 커널은 `PF_CAN` family를 노출하고, `CAN_RAW`를 통해 CAN frame을 읽고 필터링할 수 있습니다. Classical CAN frame은 최대 8 byte payload이고 CAN FD는 최대 64 byte이며, 커널 문서는 CAN payload에 공통 byte order가 정해져 있지 않다고 명시합니다. `uint16_t` 등 C++ 정수 객체를 그대로 대입하지 말고 ICD가 선언한 endian, signedness, scale, offset에 따라 바이트를 해석합니다. CAN frame을 읽었다는 사실은 그 payload의 의미를 알려 주지 않습니다. [SocketCAN frame 구조](https://docs.kernel.org/networking/can.html#raw-protocol-sockets-with-can-filters-sock-raw)

같은 두 payload byte `12 34`를 big-endian 16-bit 값으로 읽으면 `0x1234`, little-endian이면 `0x3412`입니다. 정수 객체를 임의로 뒤집는다는 뜻이 아니라, 프로토콜이 지정한 순서에 따라 bytes에서 값을 해석한다는 뜻입니다. OS native byte order를 wire format이라고 추측하면 안 됩니다.

## 어댑터가 지켜야 할 데이터 계약

수신 adapter는 transport 세부와 DDS 소비자 사이에 작은 경계를 둡니다. 그 경계에서 적어도 장비 식별자, 값과 단위, 유효성, 응용 sequence, 수신·측정 시각의 의미, 진단 사유를 합의합니다. DDS `@key`를 선언하지 않은 `sensor_id` 필드는 DDS instance key가 아닙니다. 측정 시각이 없는 입력에서는 수신 시각을 측정 시각이라고 이름 붙이면 안 됩니다.

```text
driver/API → byte 또는 CAN frame → frame parser → 필드·범위 검사
          → 단위/endian 변환 → 공통 sample → DDS DataWriter::write()
```

구체적인 순서는 다음 원칙을 따릅니다.

1. 버퍼와 선언된 frame length에 상한을 두고, 부분 읽기는 누적해 장비 규칙으로 메시지를 조립합니다.
2. sync/length/checksum/ID/필드 범위가 유효한지 확인한 뒤에만 sample을 발행합니다. 오류가 생겼을 때 무조건 버퍼 전체를 비우지 말고 ICD의 재동기화 규칙을 따릅니다.
3. byte order, 단위 변환, signed 값 해석을 명시하고 잘못된/NaN 값이 상태 판정에 들어가지 않게 합니다.
4. 읽기 오류, frame 오류, invalid measurement, DDS 발행 실패를 서로 다른 진단 사유로 기록합니다.
5. 오래된 데이터를 새 sequence로 재포장하지 않도록 측정시각, 수신시각, 응용 sequence의 의미를 분리합니다.

이는 DDS QoS가 대체하지 않는 입력 품질 검사입니다. `RELIABLE`은 제한된 history의 sample 전송을 위한 정책이고, 장비 프레임의 checksum이나 측정값의 물리적 유효성을 검사하지 않습니다. [DDS 기초]({% post_url 2026-10-13-dds-basics %})와 [오류 진단]({% post_url 2026-10-13-dds-fault-diagnosis %})은 이 경계를 이어 설명합니다.

## 직접 연결, 별도 게이트웨이, 드라이버 중 선택

| 구조 | 적합한 경우 | 부담과 한계 |
|---|---|---|
| 장비가 DDS endpoint 제공 | 장비의 타입·QoS·보안·호환 버전이 시스템과 맞을 때 | 실제 topic/type과 지원 버전을 검증해야 하며 물리 입력 자체의 오류 처리는 남음 |
| 사용자 공간 어댑터 프로세스 | Linux 드라이버/API와 장비 protocol이 제공되고, 파싱·검증을 앱에서 통제할 때 | 포트 reconnect, bounded parser, error handling, DDS lifecycle을 구현·시험해야 함 |
| 별도 gateway/driver | 장비와 컴퓨터 사이에 전기 변환, 전용 protocol 또는 격리가 필요한 때 | 추가 하드웨어·설정·배포·상태 감시가 생기고 gateway도 장애 지점이 됨 |

한 프로세스 안에서 serial reader와 DDS writer를 둘 수도 있고, 독립 프로세스 adapter가 필요한 경우도 있습니다. 그 선택은 장애 격리·배포·권한·자원 요구에서 결정합니다. DDS 데이터 계약과 transport 포트 사이 관계는 [기초 모델]({% post_url 2026-10-13-dds-basics %}), 상위 공통 모델은 [GVA/LOSA와 어댑터]({% post_url 2026-10-13-dds-gva-losa %})에서 이어집니다.

## 현재 학습 프로젝트의 경계

프로젝트는 `sensor_sim → controller → status_viewer`의 ROS 없는 C++ 세 프로세스입니다. sensor simulator가 DDS `SensorSample`을 직접 발행하기 때문에 TCP, UART, RS-422, CAN, 물리 장비 파싱은 구현하지 않았습니다. 실제 장비에서 얻은 frame이나 장비 명령을 시험했다는 뜻이 아닙니다. 앞으로 adapter를 넣으려면 실제 ICD와 드라이버/API를 먼저 확인해야 합니다.

## 참고자료와 조사 한계

- [Linux `recv(2)`](https://man7.org/linux/man-pages/man2/recv.2.html), [Linux `tcp(7)`](https://man7.org/linux/man-pages/man7/tcp.7.html): socket 수신과 TCP stream.
- [Linux `poll(2)`](https://man7.org/linux/man-pages/man2/poll.2.html), [`termios(3)`](https://man7.org/linux/man-pages/man3/termios.3.html): I/O 대기와 TTY 설정.
- [Linux kernel SocketCAN 문서](https://docs.kernel.org/networking/can.html): CAN socket API, frame 구조, byte order, 오류 frame과 CAN FD.
- [Analog Devices의 RS-422/RS-485 기술 설명](https://www.analog.com/en/resources/technical-articles/guide-to-selecting-and-using-rs232-rs422-and-rs485-serial-data-standards.html): 직렬 표준의 전기적 범위. 특정 프로젝트 장비를 가리키지 않음.

조사는 2026-10-13에 공개 Linux man-pages, Linux kernel 문서 및 제조사 기술 자료를 확인했습니다. 특정 장비의 ICD·회로·운용 규격이 제공되지 않아 실제 포트/API, 프레임 문법, byte order와 시간 요구는 미확인입니다. 참고: [DDS 개념 안내]({% post_url 2026-10-13-dds-guide %}).

{% include knowledge-links.html %}
