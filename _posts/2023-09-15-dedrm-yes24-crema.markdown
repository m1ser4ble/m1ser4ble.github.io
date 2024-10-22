---
layout: single
title:  "Reversing Yes24 epub"
date:   2023-04-08 11:56:13 +0900
categories: reversing
toc: true
toc_sticky: true
tags: reversing
comments: true
---


# Introduction

Yes24 에서 책을 구매하면 표준 epub 으로 제공한다고 명시되어있음. 하지만 막상 책을 구매하고 epub 을
다른 e-book reader 기에 넣으면 읽을 수 없음. 왜냐면 DRM 이 걸려있기 때문.
epub 형식은 대충 설명하자면 .epub 파일 속에 아래 사진처럼opf 파일이 있고 그 속에서 책의 내용을 control 한다  

| <img src="{{site.baseurl | prepend: site.url}}assets/epub_structure.png" alt="basic structure" /> |
|:--:| 
| *The structure of normal epub* |
 
실제 텍스트들은 .opf 파일 속 내용에 적혀있는 경로를 따라가보면 존재한다.
yes24 에서 어떻게 drm 이 걸어뒀냐면, html 파일들의 내용들이 encrypt 되어서 이상한 값들로 채워져있다.
yes24 crema 를 실행시켜보면, 문서폴더에서 임시파일들을 생성하는 것을 확인할 수 있다.
확인해보면, 일부 리소스(images, fonts) 들은 decrypt 된 채로 존재하는 것을 볼 수 있고, 임시적으로 .bdb.html
파일들이 생성됐다 사라지는 것을 볼 수 있다.
.bdb.html 이 decrypt 된 파일이라면 좋겠지만, 내용을 보면 javscript embeded html 임을 알 수 있다.
어차피 웹뷰면 chrome 으로도 열 수 있는게 아닐까? 해서 열어봤지만 열리지 않음.
어떻게 RunaEngine 이라는 패키지를 import 도 하지 않은 채 사용할 수 있을까? 정답은 webview 에서 native app 의
기능을 사용하기 위해 JavascriptInterface 라는 것을 제공하고 있고, 이를 사용한 코드임을 유추할 수 있다.
그러면 .bdb.html 이 나오는 순간부터는 부차적인 내용일 것이라 생각하고 크랙한 방법을 정리해보겠다.

# Methodology

보통 key 를 입력하는 프로그램을 크랙하려면 두 가지 접근법이 있을 것 같다.
* bypass : key 를 검사하는 로직을 patch 나 dll hook 으로 우회
* keygen : key 를 검사하는 로직을 분석해서 keygen 프로그램을 생성
마찬가지로 DRM 을 무력화하려면 decrypt 된 컨텐츠를 빼내거나, decrypt 로직을 분석해서 decrypt program 을 생성하는 방법이 있을 수 있다.
decrypt 로직을 분석해서 프로그램을 만드는 것이 좀 더 어렵기 때문에 우선 컨텐츠를 훔치는 방식을 택했다.
대신 이 방식은 yes24 프로그램이 패치가 될 때 마다 subroutine 의 위치가 바뀔 것이기 때문에 유효기간이 길지 못하다.

## Hijacking Decrypted Contents

일단 Yes24 프로그램에서는 자체적으로 아무런 anti debugging 기술을 사용하지 않아서 분석에 문제가 없었음.
예를 들면, 어떤 Routine 에 timeout 을 걸어둔다든지, breakpoint 가 걸렸는지 검사하는 로직을 넣는다든지 등의 것이 없어서 언제까지고 runtime debugging 을 할 수 있었음.
다만, webview 를 사용하기 때문에 libcef( chromium embedding framework) 를 사용하는데 이 library 에서는 anti-debugging 기법이 적용되어있다. 한마디로 보안관련된 부분은 다 저 라이브러리에 전가했음.

### Analysis

우선 암호화된 파일이 어떻게 사용되는지 data flow 를 쭉 따라가봤음. kernel32.dll 의 CreateFile 에 breakpoint 를 걸고 condition 도 함께 걸자.  
|![x32dbg breakpoint](../_images/conditional_breakpoint.png)|  
|:--:| 
|.bdb.html string 을 지닌 경우 break |  

msdn 을 참조해보면 알겠지만, CreateFile 은 file handle 을 리턴할 뿐임. file handle 로 fread 를 하는 로직을 찾아서 데이터를 넣는 메모리를 따라갈 수 있다.
그렇게 생성된 메모리에 hardware breakpoint 를 걸고 쭉쭉 따라가다보면 어느 순간 plain text 로 변경하는 순간이 있음.  
![hookpoint analysis](../_images/hookingpoint_analysis.png)  
그러면 이 지점에서 hook 을 걸고 메모리를 탈취해서 새로운 파일로 만들면 되겠다라는 생각이 든다.
한 가지 주의해야할 점은 이 메모리의 첫 3바이트는 signature 라서 무시하고 end of string( null ) 까지가 내용임.

### Hook the subroutine

이 함수는 내부적으로 사용되는 함수기 때문에 import table 의 조작으로 hook 을 할 수 없음. 기본적으로 그냥 code hook 이 제일 깔끔하고 좋아서 이 방식을 선호함.
  
![hookpoint interface](../_images/hookingpoint_interface.png)  
인터페이스를 보면 argument1, argument2 는 register 로 들어가고, 나머지는 스택으로 들어감.
calling convention은 usercall 이라고 되어있지만 실제로는 cdecl임. call 이후에 스택 정리로직이 있는 것을 볼 수 있음  
![hookpoint interface](../_images/evidence_of_cdecl.png)  


훅을 하고 나면 아래와 같은 시나리오로 프로그램이 제어될 것이다.

1. 프로그램 실행
2. subroutine 후킹(install hook)
3. ebook open
4. hook 함수 실행
5. uninstall hook
6. 스택 생성
7. 원본 코드 실행
8. 스택 정리
9. 원하는 코드 실행 ( 파일에 decrypted contents 쓰기 ) .
10. install hook

dll hook 을 만드는데 있었던 문제는 주로 visual studio 설정들이었음.
정리하자면 아래와 같음
+ 증분 링크때문에 코드 보기 복잡해짐.이 옵션 꺼야함.
  + 이 옵션이 켜져있으면 jmp table 이 나열되어있고 함수 콜이 jmp table 로 뛰는 식으로 코드 생성됨.
  + 프로젝트 설정 -> 링커 -> 증분링크 옵션 끄기
+ security cookie 검사하는 코드 때문에 보기 힘듬. 꺼야함
  + 프로젝트 설정 -> C/C++ 코드생성->  보안검사 사용안함(/GS-)
+ 초기화 하지않은 변수에 대해 초기화하는 0xCCCCCC 로 초기화하는 코드가 생성됨 이것 역시 dl, ecx 전달하는데 방해가됨.
  + 프로젝트 설정 -> C/C++ -> 기본 런타임 검사를 기본값으로 설정하면 사라짐( /RTCu 가 초기화코드에 대한 내용임)

위의 설계대로 실행하면 Yes24 가 책을 열고 난 뒤 모든 html 파일에 대해 복호화 로직을 실행하게되고 그 작업들이 모두 끝날 때까지 기다려야한다. 언제가 될지 모르기때문에 눈으로 봐야한다는 맹점이 있다...

### Make a decrypted epub by hand

아래 그림처럼 문서 폴더 내의 Yes24 폴더에 text 말고는 모두 decrypted 된 epub 형식의 폴더가 존재한다.  
![bdb contents](../_images/contents_of_bdb.png)  
이 폴더에서 text 들을 모두 복호화된 파일들로 갈아치우고 zip 파일을 생성한다.
calibre 프로그램으로 zip to epub 컨버팅을 하게 되면 decrypted epub 파일을 갖게된다.
작업 결과물은 어느 정도 만족스럽지만, 각주에 대해 미흡하고 몇가지 알 수 없는 기호들이 거슬린다.

# Reference

