---
layout: single
title:  "Crackmes - Junkrat"
date:   2024-10-23 11:56:13 +0900
categories: reversing
excerpt: "난독화와 Anti-Debugging이 적용된 crackme 문제 풀이"
toc: true
toc_sticky: true
tags: reversing
---


# Problem


[Junkrat](https://crackmes.one/crackme/62dc0ecd33c5d44a934e9922)
난독화된 코드와 anti-debugging technique 이 적용된 프로그램  
하지만 packing 이나 virtualization 이 적용되지 않았기 때문에 난이도가 높지 않을 것으로 예상됨. 
전형적인 key 를 찾는 문제임. 

# Analysis

메인이 되는 subroutine 의 길이가 너무 커서 decompile 이 되지 않는 점, 심지어는 cutter 라는 정적 분석툴의 경우에는 프로그램이 터져버린다. 
subroutine 의 길이가 긴 이유는 설명한 바와 같이 난독화로 인해 쓸데없는 코드들과 debugger check 함수를 계속 호출해서다.  
결국 secret key 를 찾는 문제이므로 input 이 어디로 들어가서 어떤 값과 비교하는 지를 확인해야함.  
input 이 어디에 들어가는 지는 import table 을 보고 확인했음.

<img src="{{site.baseurl | prepend: site.url}}assets/junkrat_import_table.png"/>

 `__acrt_iob_func` 는 stream 을 가져오는 함수임. 이 함수에 대한 cross-reference 를 모두 살펴봤을 때 0(stdin) 을 인자로 주는 곳은 한 곳 뿐이었음.  


 api set 에 대한 내용은 [ms documentation](https://learn.microsoft.com/en-us/windows/win32/apiindex/windows-apisets) 참고 

 anti debugging 를 무시하는 간단한 방법은 [scylla hide plugin](https://github.com/x64dbg/ScyllaHide) 을 사용하는 것. 

이제 x64dbg 를 통해서 가져온 input 을 어떻게 처리하는지 확인해갈 수 있다. control flow 를 따라가다 보면 아래와 같은 영역에서 encryption 이 일어나고 encryption 된 string 을 비교하는 로직을 발견할 수 있다. 

 <img src="{{site.baseurl | prepend: site.url}}assets/junkrat_encrypt.png"/>


다소 간단한 로직이라서 naive 한 추측대로 동작했다. 
encryption 에서는 특정한 수를 xor 연산하고 있었기 때문에 decryption 도 같은 수로 xor 연산해서 얻을 수 있었다. 주의할 점은 encryption 에 사용되는 범위가 final char 를 제외하고 모두 하기 때문에 encrypted answer (`[$ebp-1cc]`) 에서 복호화도 final char 를 제외하고 진행해야한다. 
그러면 정답은 

`kong strong pistaa panettaman` 이 된다. 