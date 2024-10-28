---
layout: single
title:  "Grapple with VM protection"
date:   2024-10-28 11:56:13 +0900
categories: reversing
toc: true
toc_sticky: true
tags: reversing
comments: true
---

가장 수준 높은 binary protection 기법인 virtual machine 기법을 설명한 [블로그](https://blog.deobfuscate.io/reversing-vmcrack) 가 있길래 이를 참고삼아 정리해보고자 한다. 
알다시피 virtual machine 위에서 동작하기 때문에 굉장한 속도 저하가 있기 때문에 가벼운 프로그램에 대해 적용하거나 일부 모듈에 대해서만 적용하는게 일반적이다. 
카카오톡 pc 버전도 이런 보호 기법을 적용했다.
저자의 예시에서는 Anti debugging technique 도 많이 있었는데, 저자가 만났던 anti-debugging technique 에 대해 정리하고 넘어가보자. 

## Anti Debugging Techniques

### Exception Handler

int1 ; triggers a single step exception
debugger 가 있다면 debugger 가 exception 을 먹고 처리하기 때문에 exception handler 가 걸리지 않을 것. 중요한 것은 이 handler 에서 어떤 중요한 로직을 수행할 것이라는 것임. 예를 들면 register 에 특정 값을 넣는다든지.. 그다음에 프로그램은 그 값이 세팅되어있는지 확인할 거고 debugger 가 붙어있는지 누군가 조작을 했는지를 유추할 수 있음. 

###  CheckRemoteDebugger

###  NtQueryInformationProcess,

###  NtSetInformationThread

## VM 기본 구조

x86 general purpose register 8개를 모두 특정 메모리에 저장한다. 
그리고 어디론가 jump 한다. 당연히 이는 virtualized function 에 진입하기 위한 백업과정임. 
이런 백업과정을 찾게 되면 필연적으로 VM handler table 의 base 와 op code 를 세팅하는 로직이 보일 것이다. 그러면 VM handler table 에 op code 만큼의 offset 을 이동해서 어떤 함수를 실행시킬 지를 알게 되는 것. 이 진입 지점을 vm function entry 라고 함. 이 vm function entry 부분은 decompilation 이 실패하는게 일반적이다. 

이 예제에서 사용하는 handler 함수에 들어가보면 decompilation 이 말이 안되는데, handler 가 다른 섹션의 코드를 재사용하고 있다고 한다. 그리고 그 코드를 chaining 해서 사용하는데 이는 ROP 기법과 동일하다. 

본 예제에서 어려웠던 점은 다음과 같음
어떤 함수가 ROP 가젯으로서 stack 에 푸쉬됐는데 3 개의 function 을 수행하고 나서도 접근이 안되었다. 거기에 더해 vm 의 register 를 사용하는 로직이 엮여서 decompilation 이 굉장히 이상해짐. 가급적 assembly 로 보는 것이 좋다. 

## 해결 방법

이렇게 handler 들에 대해 모두 분석을 하고 나면, 
하나하나 op code, param 들이 들어오는 것에 대해 실제로 어떤 assembly 에 대응되는지 출력하는 disassembler 를 작성할 수 있다.
이 [코드](
https://github.com/ben-sb/vmcrack/blob/main/src/disassembler/disassembler.py) 와 같은 형태로 작성하면 된다. 

Original Post 의 그림을 가져와서 설명하는 것도 이상하니  Crackmes.one 에서 실제로 풀어본 경험을 토대로 내용을 보충하는 것으로 하고 글을 마친다. 



## 참고

https://blog.deobfuscate.io/reversing-vmcrack

