______________________________________________________________________

layout: single
title:  "Streaming Systems"
date:   2024-10-27 15:30:09 +0900
categories: system
toc: true
toc_sticky: true
enable_copy_code_button: true

______________________________________________________________________

도서 Streaming Systems ( 타일러 아키다우 저) 에 대해 이해하는 과정을 기록하는 문서.
개인적인 이해를 기록하기 때문에 정확하지 않은 내용을 포함하고 있음. ( 다수일 가능성 큼 )

## Streaming System

- 무한 데이터 셋을 염두에 두고 설계된 데이터 처리 엔진의 유형
- 따라서 마이크로배치(microbatch) 구현도 스트리밍 시스템의 일부임
  - 무한 데이터를 처리하기 위해 배치 처리 엔진을 반복 실행하는 것
  - 스파크 스트리밍이 이 유형
- 잘 설계된다면 기존 배치 시스템과 마찬가지로 정확하고 일관적이고 반복가능한 결과를 생성할 수 있고 더 확장가능한 상위의 기술
- 즉, Batch System 의 super set 이라는 뜻이다
- 역사적으로 사용된 잘못된 특성과 설명
  - 근사치 결과를 줌으로써 지연시간을 낮추는 시스템
  - 람다 아키텍쳐
    - 근사치 결과를 주는 시스템과 정확한 배치 시스템을 함께 운영하는 아키텍쳐
    - 낮은 지연시간으로 부정확한 결과를 일단 주고 이후 배치 시스템의 결과를 최종적으로 보여줌

## 잘 설계된 Streaming system

- 잘 설계된 Streaming system 은 batch system 의 super set 이라고 앞서 언급했다.
- 그에 대한 조건은 다음과 같다
  - 정확성 ( Correctness)
    - consistent storage 가 필요하고 이는 checkpoint 방법을 필요로 함
    - 이 정확성은 exactly-once processing 을 하려면 필요한 속성
  - 시간 판단 도구
    - event time 왜곡이 발생하는 상황에서 unbounded unordered data 를 처리할 때 필요함

## 무한 데이터를 다루는 방법

- 배치 시스템이 택한 전략
  - 고정 윈도우
    - 입력 데이터를 고정된 크기의 윈도우로 나누고 유한 데이터 소스처럼 처리
  - 세션
    - 세션이 일정 크기의 비활동 간격이 발생하면 세션을 끝으로 간주한다.
    - 결국 유한데이터를 다루는 방식으로 데이터를 자르면 세션의 분할이 발생
    - 배치 크기를 늘리면 분할되는 세션의 수는 줄어들지만 지연시간이 늘어난다.
- 스트리밍 시스템의 전략
  - 무한 데이터의 특성에 따른 전략
    - 시간 무시
      - 데이터 처리의 모든 결정을 데이터만 보고 할 수 있는 경우
      - 필터링
      - 내부 조인
    - 처리 시간 윈도우
      - 시스템에 들어오는 기준으로 데이터를 모아뒀다가 윈도우로 묶어서 계산
      - 이게 배치 시스템의 윈도우랑 뭐가 다름?
    - 이벤트 시간 윈도우
      - 이벤트가 실제로 발생한 시간을 반영해 유한 크기의 조각으로 데이터 소스를 관찰할 때 사용
      - 윈도우의 표준 방식
      - 단점
        - 버퍼링
          - 윈도우의 수명이 길어지면 더 많은 데이터가 버퍼링 되어야함.
        - 완결성
          - 윈도우의 결과를 언제 구체화(materialize) 해야할 지에 대한 결정
          - 워터마크가 이를 해결해줌.

## What, Where, When, How

- 스트리밍 시스템을 결정할 때 고려할 요소들이다
- What
  - 무슨 결과가 계산되어야하나
- Where
  - 어떤 곳에서 발생하는 이벤트를 이용할 것인가
  - 어떤 윈도우를 사용할 것인가. 고정/이벤트윈도우/처리윈도우
- When
  - 처리 시간의 언제 결과가 구체화 되는가
  - 앞서 언급한 완결성에 대한 내용
- How
  - 결과 사이의 관계가 어떻게 되는가
  - 각 윈도우에서의 결과를 누적할 것인가? 이전 것을 철회할 것인가?

## Event time vs Processing time

## Watermark

<video width="320" height="240" controls>
  <source src="http://streamingbook.net/static/images/figures/stsy_0210.mp4" type="video/mp4">
</video>

## 고급 윈도우

- processing time window
  - 모니터링을 하는경우 관측 시점 기준으로 분석할 때 유용
  - 사용 방식
    - trigger
      - 이벤트 시간에 관계 없이 처리시간 축에서 스냅샷으로 트리거 사용
    - ingress time
      - 데이터가 인입하는 시간을 이벤트 시간으로 설정
    - multi stage pipeline 에서 ingress time 을 사용하면 데이터가 N 번째 윈도우에 속하면 한 파이프라인 안에서 계속 같은 윈도우에 남아있을 것.
  -
- session window
- custom window
  - unaligned fixed window
  - per-key fixed window
  - bounded session window

## Terms

- 기수(cardinality)
  - 데이터 셋의 크기.
  - bounded/unbounded data 로 나눌 수 있음.
- 구성(constitution)
  - 데이터의 물리적인 표현.
  - table/stream 으로 나눌 수 있음.
  - sql system 은 table 을 바탕으로, map-reduce 계통은 stream 을 바탕으로 동작.
