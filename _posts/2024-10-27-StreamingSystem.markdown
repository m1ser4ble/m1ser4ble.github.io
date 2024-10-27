---
layout: single
title:  "Streaming Systems"
date:   2024-10-27 15:30:09 +0900
categories: system
toc: true
toc_sticky: true
---


도서 Streaming Systems ( 타일러 아키다우 저) 에 대해 이해하는 과정을 기록하는 문서. 
개인적인 이해를 기록하기 때문에 정확하지 않은 내용을 포함하고 있음. ( 다수일 가능성 큼 ) 


## Streaming System

* 무한 데이터 셋을 염두에 두고 설계된 데이터 처리 엔진의 유형
* 따라서 마이크로배치(microbatch) 구현도 스트리밍 시스템의 일부임
  * 무한 데이터를 처리하기 위해 배치 처리 엔진을 반복 실행하는 것
  * 스파크 스트리밍이 이 유형
* 잘 설계된다면 기존 배치 시스템과 마찬가지로 정확하고 일관적이고 반복가능한 결과를 생성할 수 있고 더 확장가능한 상위의 기술
* 즉, Batch System 의 super set 이라는 뜻이다
* 역사적으로 사용된 잘못된 특성과 설명
  * 근사치 결과를 줌으로써 지연시간을 낮추는 시스템
  * 람다 아키텍쳐
    * 근사치 결과를 주는 시스템과 정확한 배치 시스템을 함께 운영하는 아키텍쳐
    * 낮은 지연시간으로 부정확한 결과를 일단 주고 이후 배치 시스템의 결과를 최종적으로 보여줌

## 잘 설계된 Streaming system 

* 잘 설계된 Streaming system 은 batch system 의 super set 이라고 앞서 언급했다. 
* 그에 대한 조건은 다음과 같다
  * 정확성 ( Correctness)
    * consistent storage 가 필요하고 이는 checkpoint 방법을 필요로 함
    * 이 정확성은 exactly-once processing 을 하려면 필요한 속성
  * 시간 판단 도구
    * event time 왜곡이 발생하는 상황에서 unbounded unordered data 를 처리할 때 필요함  



## Event time vs Processing time

## Terms

* 기수(cardinality)
  * 데이터 셋의 크기. 
  * bounded/unbounded data 로 나눌 수 있음. 
* 구성(constitution)
  * 데이터의 물리적인 표현. 
  * table/stream 으로 나눌 수 있음. 
  * sql system 은 table 을 바탕으로, map-reduce 계통은 stream 을 바탕으로 동작. 