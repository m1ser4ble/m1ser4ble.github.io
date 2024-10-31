---
layout: single
title:  "Crackmes VmAdventures1"
date:   2024-10-30 11:56:13 +0900
categories: reversing
toc: true
toc_sticky: true
tags: reversing
comments: true
---


# Problem


[VmAdventures](https://crackmes.one/crackme/63bd7f5733c5d43ab4ecf3ad)
전형적인 password finding 문제

### asm

`cmovz` 
는 conditional move 의 약자며 마지막의 z는 zero 인 경우가 조건으로 붙는 명령어다. 
[참고](https://nightohl.tistory.com/entry/CMOV-assembly-CMOV-%EA%B4%80%EB%A0%A8-%EB%AA%A8%EB%93%A0-%EB%AA%85%EB%A0%B9%EC%96%B4-%EC%A0%95%EB%A6%AC) 

`rol` `ror` 은 rotate left 와 rotate right 이다. 

# Analysis

딱히 protector 가 걸려있지 않아서 string table 도 그대로 드러나있다. Correct answer 등의 string 을 사용하는 곳으로 바로 들어가서 확인해보면 input 을 가져와서 어떤 함수를 하나 호출하는 것을 확인함. 



<img src="{{site.baseurl | prepend: site.url}}assets/main_vmadventure1.png"/>

분석을 다 끝내고 보니 느낄 수 있는 것은 `sub_71170` 에서 암호화 과정을 거치고 그 값을 암호화된 정답과 비교하는 형태일 것만 같다.  
실제로 v1 은 입력한 string 의 길이이며 `byte_732e0` 메모리에 정답이 들어있다. 길이가 0X20 일때만 정답 로직으로 갈 수 있다는 것을 유념하고 `sub_71170` 을 확인해보자

<img src="{{site.baseurl | prepend: site.url}}assets/junkrat_importsub_71170.png"/>

vm 의 동작 방식을 굉장히 단순한 형태로 모사했다. state 를 남길 필요가 없는 연산들로만 구성했기 때문에 register save/load 가 없고 그래서인지 decompile 이 문제없이 수행되었다. 
정답이 0X20 의 길이를 지닌다는 것을 생각하면 난독화를 위한 쓸데없는 코드들이 보일 것이다. 
OP 는 byte_732d0 메모리에 순차적으로 존재하며, op 의 종류는 총 4개가 있다. 메모리에 가서 보면 0은 사용되지 않을 것이기 때문에 무시하면 된다. 

# Solution

각 op 들이 하는 연산들은 명확한 역연산이 존재한다. 따라서 각 op 에 대한 역연산을 수행하는 vm 을 만들어서 encrypt 된 정답을 복호화했다. 
그러면 다음과 같은 flag 를 얻을 수 있다. 
```ps
PS C:\Users\Sampling\workspace\playground> .\a.exe
flag{Welcome to VMAdventures :)}
```
