---
layout: single
title:  "Crackmes - VmAdventures2"
date:   2024-11-04 11:56:13 +0900
categories: reversing
excerpt: "VM Interpreter 분석과 Disassembler 제작 (★★★★☆☆)"
toc: true
toc_sticky: true
tags: reversing
---


# Problem


* [VmAdventures2](https://crackmes.one/crackme/65f1f892cddae72ae250b57e)  
* ★★★★☆☆
* 전형적인 password finding 문제
* 64bit architecture / windows OS  

## asm

```
 MOVSXD r64, r/m32       Move doubleword to quadword with sign-extension.
```


# Analysis

## Finding ROI 

VMAdventures1 과 마찬가지로 protector 는 걸려있지 않지만 string table 에 Correct answer 같은 key string 이 없다. 
그럼에도 우리는 string input 을 가져오는 일반적인 함수들을 알고 있다. import table 에서 찾아보면 `istream::read` 메소드가 있고 어디서 사용되는지 xref 로 따라가보면 아래와 같은 영역이 나온다. 
<img src="{{site.baseurl | prepend: site.url}}assets/istream_read.png"/>

하지만 이후 동작하는 방식에 대해 설명하겠지만, 정작 이 함수에서는 input 을 받지 않는다. 


이 부근의 vm 코드 위에서 input/output/data compare 가 일어난다. 
<img src="{{site.baseurl | prepend: site.url}}assets/vm_caller.png"/>

vm interpreter 를 decompile 하면 실패하는 것을 확인하고 꽤 재밌는 문제라고 생각했다. 

## Instruction

vm 의 각 instruction 을 해석하다보면 어떤 포맷인지 눈에 점차 드러나게 된다. 여기서는 이해를 돕기 위해서 먼저 이 부분에 대해 설명하도록 한다. 리버서 입장에서 vm 의 동작 방식을 이해하기도 전에 vm 포맷을 먼저 분석할 수 있다는 것은 말이 안된다. 

+----------------------------------------------------------+  
| op (1) | flag (1) | operand1 (4) | operand2  (4)|  
+----------------------------------------------------------+



## Interpreter

vm interpreter 의 코드의 도입부는 아래와 같다. rcx 에는 fetch 한 instruction 이 존재한다. 

<img src="{{site.baseurl | prepend: site.url}}assets/decoder.png"/>

* r9 : current instruction
* r10 : base addr
* rbx : heap
* rax : instruction handler

여기서 heap 에는 string literal 들이 저장되어있고, function call 의 결과물들이 저장되는 곳이기도 하다.

<img src="{{site.baseurl | prepend: site.url}}assets/heap_contents.png"/>

그나마 vm code 들이 난독화가 되어있지도 않고, 그 내용들이 일반적인 instruction (func call, cmp, xor ,... ) 들과 직접적으로 대응되는 수준이라 해석하기에 좋았다. 

## Disassembler

각 op 들이 어떻게 동작하는지 c로 작성해보면서 이해하고 나면, 어떤 instruction 에 대한 해석을 남길 수 있을 것이다. 
그 해석들을 string 으로 출력하는 disassembler 를 제작하여 실제로 어떤 동작을 하는지 assembly 를 뽑아볼 수 있을 것이다. 

disassembler 는 아래 링크에 첨부한다. 

<script src="https://gist.github.com/m1ser4ble/62bbd422dce4acedc33f8af9bdbbd8b3.js"></script>


assembly 를 보고 이해하면 입력받은 string 에 xor 연산을 가해 정해진 encrypted string 과 일치하는지 확인하는 아주 단순한 프로그램인 것을 알 수 있다. 그러면 우리는 encrypted string 에 대해 동일한 key 로 xor 연산을 가하면 정답을 추출할 수 있다.   


# Solution

* Disasembler 에 heap, stack, register 를 붙이면 똑같은 vm 을 만들 수 있다. 
* vm을 돌리면서 stack/heap 에 임의 조작이 가능하다.
* encrypted string 을 비교하기 전에 입력 string 을 정답과 동일하게 변경함과 동시에 빼돌려서 xor연산을 가했다. 
* vm 마지막에 빼돌린 string 을 출력했다.

```bash
If_you_figured_out_the_key_by_yourself_you_have_some_serious_reversing_skills!1dDfJeRl5f#.34)!
```




