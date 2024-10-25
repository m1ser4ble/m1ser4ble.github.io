______________________________________________________________________

layout: single
title:  "Binary Instrumentation"
date:   2024-07-14 15:30:09 +0900
categories: binary_instrumentation
toc: true
toc_sticky: true

______________________________________________________________________

# Binary Instrumentation

주어진 바이너리 내부의 임의 지점에 새로운 코드를 삽입해서 바이너리 행위를 관찰하거나 수정할 수 있는 기법

여기서 새 코드를 삽입하는 지점을 계측지점( instrumentation point),
추가되는 코드를 계측 코드(instrumentation code) 라고 함.

어디에 사용되냐? 책에서는 특정 바이너리 내에서 가장 많이 호출되는 함수를 찾고자 call 명령어를 계측할 수 있다고 설명함.
혹은, 바이너리 내에 모든 간접 호출명령을 계측해서 이동하는 곳이 보증된 곳인지를 검사해서 제어 흐름 탈취 공격을 검사할 수 있음.
엉뚱한데로 가면 경고메시지와 함께 종료하도록 할 수 있음.
(CFI Control Flow Integrity 참고)

## Static Binary Instrumentation

- binary 내용을 영구적으로 수정하고 덮어씀
-

### int3 기법

### trampoline 기법

## Dynamic Binary Instrumentation

- 바이너리 관찰하다 실행 시점에 cpu instruction 처리 스트림에 새로운 명령어 일시적으로 끼워넣음
- code relocation 으로 발생하는 문제에서 자유로움
- 계산량이 월등히 높음. => 느림( 4배까지 느려질 수 있음. staticdms 10% ~ 2배정도까지 느려짐)
- 바이너리가 사용하는 라이브러리 역시 계측가능. SBI 는 라이브러리를 명시적으로 지정해줘야 가능.
- 동적으로 생성되는 JIT compiled code 도 처리할 수 있음.
- 디버거처럼 실행중인 프로세스에 attach/detach 가능

## repz ret

repz ret 는 2 byte 짜리 명령어임. repz 는 원래 이후의 명령어를 rcx 가 0 이 될때까지 반복하는 명령어임.
repne/repnz 도 있으니 참고
그런데, rcx=0 에 ret 를 사용하고있음. ret 1byte 짜리와 다를 바 없는데 왜 사용함?
그 이유는 분기문 이후에 실행되는 instruction 이 바로 이곳인 경우에 branch prediction 의 이점을 보기 위해서임
Two-Byte Near-Return ret Instruction 이라고 부름

[repzret](https://repzret.org/p/repzret/)
