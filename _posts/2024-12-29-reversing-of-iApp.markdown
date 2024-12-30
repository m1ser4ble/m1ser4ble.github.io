---
layout: single
title:  "Reversing of iApp"
date:   2024-12-29 11:56:13 +0900
categories: reversing
excerpt: "iphone App 을 리버싱 하는 방법"
toc: true
toc_sticky: true
tags: reversing
comments: true
---

# Frida

dynamic code instrumentation toolkit 이다. pin 과 비슷한 툴이라고 보면 될듯.
javacscript code snippet 이나 library 를 다양한 플랫폼(windows,macos, linux, ios, ...) 의 native app 에 삽입할 수 있게 해줌.

## 준비작업

Frida 를 사용하려면 우선 jailbreak 를 한 iphone 이 필요하다. 나는 버리는 것을 잘 하지 못해서 이전에 사용하던 아이폰 공기계(iphone 8) 가 수중에 있어서 이것으로 진행한다. 보통 이런 루팅을 하는데는 벽돌이 될 위험을 감수해야하기 때문에 실제 사용하는 휴대폰을 이용하는 것을 권장하지 않는다..

### Jailbreak

탈옥은 처음해보는데 생각보다 방법이 다양해서 혼란스럽다. 



* Jailbreak Types
  * Tethered
    * booting 할 때 마다 외부 컴퓨터를 이용해서 추가작업을 해야하는 형태
    * 그렇지 않으면 Recovery mode 나 DFU mode 에 막힐 것임. 
  * Semi-tethered
    * 외부 기기는 필요없고 탈옥 상태로 부팅하는 방법을 기기 내에 담고 있는 형태
  * Untethered
    * 항상 자동으로 탈옥상태로 부팅하는 형태
  * Semi-untethered
    * device 내의 앱을 통해 탈옥할 수 있는 형태
* Environment Types
  * Rootless
    * ios 15 이상을 위한 새로운 탈옥 형태
    * ios 15 이상부터 SSV(Signed System Volume) 이 강제되었기 때문인데, 이는 root file system(/) 를 이용한 접근을 굉장히 제한함. 
  * Rootful
    * traditionoal or legacy way of jailbreaking
    * root filesystem 이 read/write 권한으로 mount 됨. 그리고 / 에 jailbreak files 가 저장된다. 
    * tethered jailbreak 를 해야하는 불편함까지 더해진다. 

* 탈옥 방법
  * palera1n
    * Semi-tethered
  * Dopamine
    * Semi-untethered

보통 palera1n 과 Dopaimne 을 사용하는 듯 한데, 나는 Dopamine 을 사용하도록 하겠다. 
palera1n 은 따로 프로그램을 받아서 설치하는 듯해보이지만, 
Dopamine 은 TrollStore 라는 sideloader 를 이용해서 설치할 수 있다. 
여기서 sideloader 는 app store 를 경유하지 않고 임의의 앱을 설치할 수 있게 해주는 app 혹은 툴이다.
임의의 앱은 인터넷에서 ipa 혹은 tipa 확장자로 배포되는 것을 받으면 된다. Dopamine 도 그렇게 설치할 수 있다.  
sideloadly 는 sideloader 의 일종으로 설치 후 7일 뒤 expire 된다고 한다. 반면, TrollStore 역시 sideloader 지만, expire 되지 않는다고 한다. 
TrollStore 를 설치하는 방법은 아래와 같이 요약할 수 있다. 대강의 방법만 설명했으니 자세한 방법은 [dopamine install guide](https://ios.cfw.guide/installing-dopamine/) 혹은 [trollinstallerx 설치 가이드](https://ios.cfw.guide/installing-trollstore-trollinstallerx/) 를 참고

1. sideloadly 를 통해서 TrollInstallerX 를 설치. 
  * 그러니까, TrollStoreInstaller 를 sideloadly 로 설치하고 Installer 를 실행해서 TrollStore 를 설치하는 것이다. 
  * 설치 방법은 본인의 
2. TrollInstallerX 를 이용해서 TrollStore 를 설치
  * 이 때 기존에 깔려있는 특정 앱을 변조해서 TrollStore 를 설치하는 것으로 보임. 일반적으로 Tips 를 사용함.
3. TrollStore 의 settings 에서 idid 라는 인증서를 설치
4. 설정의 vpn 및 디바이스 관리라는 항목에서 인증서 신뢰함으로 수정
5. 설정의 어딘가에서 개발자 모드로 변경

이후 Dopamine 공식 홈페이지에서 ipa 를 다운받아서 열고 내보내기로 TrollStore 로 보내면 설치가 가능하다. 

Dopamine 으로 jailbreak 를 마친 후 

frida installation guide 를 따르면 됨. 

Dopamine 으로 설치한 패키지매니저 ( 본인은 Sileo ) 를 켜서 frida 설치를 하고 나면 
설치된 frida version 을 확인할 수 있음. 본인은 16.5.9 
이에 맞는 frida tools 를 본인 system 에 설치한다. 
본인은 pip install frida-tools==12.5.1 frida==16.5.9 


#### Tweaks

Tweaks 는 특정 앱의 클래스의 method 에 hook 을 걸어서 임의의 동작을 하도록 변형(tweak)을 가하는 행위를 말함. 

[](https://www.appknox.com/blog/beyond-ios-jailbreaking-how-to-develop-an-ios-tweak)
Tweaks can hook into the methods/functions of already existing application classes and tweak (literally, hence the name) their behavior. This enables you to modify the application's behavior without having access to its original source code.  Tweaks can also add more features to the target application. To inject code into the existing application or process, a tweak requires a hooking framework such as cydia-substrate, fishhook, or ellekit.
Read more at: https://www.appknox.com/blog/beyond-ios-jailbreaking-how-to-develop-an-ios-tweak



