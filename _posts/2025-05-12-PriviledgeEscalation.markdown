
## PE

권한 상승이란 무엇인가

핵심은 Privilege Escalation 은 일반적으로 lower permission 계정에서 higher permission 계정으로 가는 거임. 
더 기술적으로는 취약점, 설계 결함, OS 상에서의 설정 감시의 악용 혹은 유저에게 제한된 리소스에 대해 허가 없이 access 를 얻은 어플리케이션을 의미함. 

직접적으로 admin access 를 주는 foothold(initial access) 를 얻을 수 있는 real-world 침투테스트를 수행하는게 흔치않음. 
Privilege escalation 은 admin 권한을 주기 때문에 필수적인 것임. 그런 권한을 얻으면 다음과 같은 것들을 할 수 있음.

* 패스워드 리셋
* protected data 를 손상시키기 위해 access control 우회
* 소프트웨어 설정 편집
* persistence 활성화 ( 로그오프를 하더라도 다시 access gain 할 필요가 없음)
* 유저 권한 변경
* 어떤 관리자 커맨드 실행


Enumeration 은 어떤 시스템에 대한 권한을 얻고나서 처음으로 해야하는 단계
치명적인 취약점을 이용해서 루트 시스템에 대한 권한을 얻었을 수도 있고 단순히 low privileged account 를 사용해서 커맨드를 날리는 방법을 발견했을 수도 있음. 
CTF machine 이랑 다르게 침투테스트는 특정 시스템에 대한 권한 혹은 유저 레벨의 권한을 얻고서 끝나지 않는다. 
enumeration 은 post-compromise 를 할 때 중요함. 

* hostname
* uname -a
* /proc/version
* /etc/issue
* ps
* env
* sudo -l
* ls
* id
* /etc/passwd
* history
* ifconfig
* ip route
* netstat -ano
* find



enumeration 도 tool 이 다 있음. 

The target system’s environment will influence 
the tool you will be able to use. For example, 
you will not be able to run a tool written in Python 
if it is not installed on the target system. 
This is why it would be better to be familiar 
with a few rather than having a single go-to tool.

LinPeas: https://github.com/carlospolop/privilege-escalation-awesome-scripts-suite/tree/master/linPEAS
LinEnum: https://github.com/rebootuser/LinEnum
LES (Linux Exploit Suggester): https://github.com/mzet-/linux-exploit-suggester
Linux Smart Enumeration: https://github.com/diego-treitos/linux-smart-enumeration
Linux Priv Checker: https://github.com/linted/linuxprivchecker
The hostname command will return the hostname of the target machine.
Although this value can easily be changed or have a relatively meaningless string 
(e.g. Ubuntu-3487340239), in some cases, it can provide information about the target
system’s role within the corporate network (e.g. SQL-PROD-01 for a production SQL server).


uname -a
