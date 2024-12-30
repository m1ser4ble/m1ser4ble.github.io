---
layout: single
title:  "Crackmes JUMPOUT_0xFF"
date:   2024-11-13 11:56:13 +0900
categories: reversing
excerpt: "Difficulty : ★★★★☆☆"
toc: true
toc_sticky: true
tags: reversing
comments: true
---


# Problem


* [JUMPOUT_0xFF](https://crackmes.one/crackme/6701d1419b533b4c22bd0d8f)  
* ★★★★☆☆
* 전형적인 key finding 문제
* 64bit architecture / windows OS  

![alt text](image.png)
> 도발적인 실패 에러메시지...


# Analysis

## Obfuscation

![alt text](image-1.png)

동일한 address(실제로는 next instruction) 에 대해 jz,jnz 를 걸어둔 형태의 subroutine 들로 프로그램이 구성되어있다. 이런 난독화를 통해 decompile 을 어렵게하고 있다. 

### Instruction overlapping 

![alt text](image-2.png)
위 처럼 alignment 를 의도적으로 다르게해서 disassembler 에게 혼란을 주는 난독화를 해두었다. jump target 으로 가서 convert to data( shortcut : d) 를 한 뒤 convert to code(shortcut : c) 를 하면 아래와 같이 제대로된 assembly 를 볼 수 있다. 

![alt text](image-3.png)

### useless operations

### fragment


# Solution

프로그램의 구성과는 무관하게 아래의 절차대로도 문제를 풀 수 있다. 
* 단순히 sgetc 에 breakpoint 를 잡고 얻은 char 가 어느 메모리 영역에 저장되는지를 확인한다. 
* 해당 메모리 영역에 hardware access breakpoint 를 잡는다. 
* 읽어왔을 때의 register 를 보면 rdx 에 `discord_memcpy_1337_crack_me_post` 라는 string 이 있는 것을 확인할 수 있음.
* 그것이 정답... 






