______________________________________________________________________

layout: single
title:  "PracticalBinaryAnalysis"
date:   2024-03-14 15:30:09 +0900
categories: pba
toc: true
toc_sticky: true

______________________________________________________________________

Practical Binary Analysis

# Sections of Linux binary

.init, .fini : program or library 를 실행할 때 선행적으로 수행되는 subroutine. 그리고 종료될 때 마지막으로 수행되는 subroutine
.text : code section
.rodata : 데이터 관리하는 상수값 저장되는 섹션. read-only data
.data : 초기화된 변수의 기본 값이 저장됨.
.bss : 초기화되지 않은 변수들을 위해 예약된 공간(Block Started by Symbol 이라는 의미로 심벌에 의해 시작되는 블록 영역으로 명명됨. 변수들이 저장될 메모리 블럭
.plt
.got
.got.plt
.rel or .rela : relocation 관련 항목들 기재됨. 재배치가 적용돼야하는 특정 주소와 연결해야하는 특정 값을 참조하는 방법을 명시. readelf --relocs a.out 으로 확인 가능.
.dynamic : elf 바이너리가 실행을 위해 준비되고 로드될 때 OS 와 dl 에게 어떤 가이드(로드맵) 을 제시하는 역할. readelf --dynamic a.out 으로 확인하면 위에서 봤던 dynamic liking 시에 사용되는 것(섹션 혹은 값)들의 주소들이 나오는 것을 알 수 잇음

# LazyBinding

동적링킹된 바이너리의 특정 함수가 실제로 참조될 때 로드를 완료하는 방식. 동적 링킹과정에서 재배치할 때 불필요한 시간 낭비를 없애기 위함.
PLT(Procedure Linkage Table)
GOT(Global Offset Table)

.got section :

# Setup

## After Installing Kali linux

`$ msfdb init`

msfdb 는 metasploit framework database  를 의미 . 이 db 를 초기화하는 명령어

`$ spool /root/msf_console.log`

해당 파일에 spool 에서 실행된 모든 명령들이 기록됨.

## Install tools

### Backdoor factory

goal of BDF 는 실행 바이너리를 user desired shellcode 로 패치하고 prepatched state 의 정상적인 실행을 여전히 할 수 있게끔 해주는 것.

### HTTPScreenShot

screenshots 를 잡아주는 툴이며 많은 웹사이트들의 hmtml 을 잡아준다..?

### SMBExec

삼바 도구를 이용한 빠른 psexec 스타일 공격용 도구
원본인 pentestgeek 의 Repo 는 private 으로 전환했거나 삭제한 것 같고
https://github.com/brav0hax/smbexec 을 사용하면 됨.

### Masscan

가장 빠른 인터넷 포트 스캐너.

### Gitrob

github 검사도구. 이제는 이게 될지 잘 모르겠다.

gitrob build 방법이 변한 것으로 보임 예를 들면 go lang 을 사용하도록 변경됐다든가...
그래서 postgres db 는 생성하되, 빌드 방법을 새로 찾거나 precompiled file 을 이용하거나 하자

### CMSmap

보안결함 탐지 프로세스를 자동화하는 파이선 오픈소스 CMSContent Management System scanner
이미 6 년 전이 last commit

### praedasploit

마찬가지로 사라졌는지  amenon-r7의 repo 를 사용함

### recon-ng

마찬가지로 사라졌는지 lanmaster53 의 repo 사용

### BeEF Exploitation

XSS(cross site scripting) attack framework .
설치에 뭔가 문제가 있음.

### DSHashes

역시나 wget 으로 얻어오는게 불가능함. 마치 server 사라진듯한...

### SPARTA

python elixir 라는 package 가 없음..

### WCE

마찬가지로 url 에 문제가 있어서 다운로드가 안됨 (look!)

### Mimikatz

마찬가지로 url 에 문제가 있을 것.

### SET

설치에 문제가 있음.
clone 에는 문제가 업승ㅁ

### Veil

install 방법이 변한듯 함. (look!)

### Firefox Addons

(look!)

그 외에 update 는 thehackerplaybook.com/updates 를 살펴보도록....

# OSINT(Open Source INTeliigence) >>>>>

OSINT 는 어떤 대상에 대해 합법적으로 모은 정보들을 의미함. 실질적으로는 인터넷에서 찾은 정보.

Passive Discovery : 공격 호스트를 건들지않고 대상 네트워크 클라이언트 등 관련 정보를 추출하는 스캐닝
Recon-ng .
version 4->5 가 되면서 커맨드가 상당히 많이 변경됨

recon-ng module install

marketplace install all

modules search something

modules load something
info
options list
options set something
run
show hosts

# password 사전생성 >>>>>>

wordhound

tweepy

https://null-byte.wonderhowto.com/how-to/create-custom-wordlists-for-password-cracking-using-mentalist-0183992/

# Active Discovery >>>>>>>>

스캐닝의 일종으로 시스템과 서비스 잠재적인 취약점을 '직접' 찾아내는 과정
masscan
nmap 이 할 수 있는건 다 할수 있고 또 빠름
즉, 어떤 포트가 열렸는지 알아내는 포트스캐닝

sparta
좀 더 소규모 내부 네트워크 스캔할 때 사용

sparta

# OpenVAS >>>>>>>

취약점 스캐닝 툴

이제는 명칭이 gvm 으로 변경됨.
greenbone vulnuerability management

openvas-setup -> gvm-setup
openvas-scapdata -> greenborn-scapdata-sync
openvas-certdata-sync -> greeborn-certdata-symc

gvm

hackyourmom.com/en/servisy/yak0u0kali-linux-....
여튼 여기서 gvm 을 참고

# WebGoat >>>>>>>>>>.

vulnerable web server
docker pull webgoat/webgoat-8.0
docker run -p 8080:8080 -t webgoat/webgoat-8.0

localhost:8080/WebGoat

webgoat 에 owasp 를 이요해서 스캔하여 발견한 취약점을 이해하고 분석해보자
또는 공격해보자

## Spring4Shell

## SQLInjection

# DAST ( Dyanmic Application Security Testing) >>>>>>>>>>

OWASP ZAP

apt install zaproxy

zaproxy

BurpSuite
Arcunetix
