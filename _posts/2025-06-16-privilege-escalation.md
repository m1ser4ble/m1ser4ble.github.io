---
layout: post
title: "[THM] Linux Privilege Escalation"
date: 2025-06-16 20:53 +0900
description:
category: security
tags: [pentest, linux, privilege-escalation]
excerpt: "Linux 권한 상승 기법 총정리: sudo, SUID/SGID, Capabilities, Cron, NFS"
---

## Sudo 권한 악용

sudo command 로는 모든 프로그램을 root 권한으로 실행시킬 수 있는 반면, 어떤 조건 하에서만 특정 유저에게 root 권한으로 실행시킬 수 있도록 설정할 수도 있다. 예를 들면, SOC analyst 는 nmap 을 주기적으로 사용해야하는데, 이를 위해 관리자가 이 유저에게 nmap 만 root 권한으로 실행할 수 있도록 설정할 수 있다.
sudo -l 을 하면 현재 내의 root 권한에 관해서 어떤 조건을 부여받았는지 확인할 수 있다.
예를 들면 gdb 에 대해서 너는 root 권한(sudo) 로 실행할 수 있도록 해줄게 라는 제한 조건을 걸어둘 수 있음.
이를 sudo -l 로 확인해볼 수 있다.
그럼 이 프로그램들로 뭘 할 수 있는지를 아래 사이트에서 찾아보면 된다.

<https://gtfobins.github.io/> 에서 sudo 권한을 얻을 수 있는 프로그램들을 어떻게 사용해야하는지에 대해 정리해놓은 소스

리눅스의 권한 제어 대부분은 사용자와 파일 간의 상호작용을 통제하는 방식에 기반한다. 이는 권한(permission)을 통해 이루어진다. 이제 파일에 읽기, 쓰기, 실행 권한이 존재하며, 이는 사용자에게 그들의 권한 수준 내에서 부여된다는 것을 알고 있을 것이다.

하지만 SUID(Set-user Identification)와 SGID(Set-group Identification)가 적용되면 상황이 달라진다. 이들은 파일이 실행될 때, 각각 파일 소유자 또는 그룹 소유자의 권한 수준으로 실행되도록 한다.

이러한 파일은 특수 권한 수준을 나타내는 “s” 비트가 설정되어 있음을 볼 수 있다.

```bash
find / -type f -perm -04000 -ls 2>/dev/null
```

여기서 나타나는 명령어들을 이용해서 passwd 나 shadow 에 읽는 것이 가능한지 생각해보자
예를 들면, 본 예제에서는 base64 가 suid 로 설정되어있었는데, `base64 /etc/shadow | base64 --decode` 의 형태로 읽기가 가능했다.

시스템 관리자가 프로세스나 바이너리의 권한 수준을 높이는 또 다른 방법은 “Capabilities”(기능 권한)이다. Capabilities는 권한을 보다 세분화하여 관리할 수 있게 해준다. 예를 들어, SOC 분석가가 소켓 연결을 시작해야 하는 도구를 사용할 필요가 있는 경우, 일반 사용자 권한으로는 이를 수행할 수 없다. 시스템 관리자가 해당 사용자에게 더 높은 권한을 부여하고 싶지 않다면, 바이너리의 capabilities를 변경할 수 있다. 그 결과, 해당 바이너리는 더 높은 권한 없이도 작업을 수행할 수 있다.

capabilities의 사용법과 옵션은 man 페이지에 자세히 나와 있다.

활성화된 capabilities를 확인하려면 getcap 도구를 사용할 수 있다.

### Cronjobs

cron jobs 는 스크립트나 바이너리를 특정 시간대 혹은 주기로 실행시키는데 사용됨. 기본적으로 현재 유저가 아닌 이 cron job 의 Owner 의 권한으로 실행된다. 잘 구성된 cron job 들은 본질적으로 취약하지 않지만, 특정 조건 하에 권한 상승 경로가 될 수 있다.
간단하다. root 권한으로 실행되는 예정된 작업이 있고 우리가 실행될 스크립트를 변경할 수 있다면, 우리 스크립트가 root 권한으로 실행될 것이다.

cron job 설정은 crontabs 에 저장되어서 다음 예정시간에 대한 내용이 적혀있다.

PATH 에 유저가 write permission 을 지닌 폴더가 있다면 어플리케이션이 스크립트를 실행하도록 hijack 할 수 있다.
절대경로로 정의되거나 shell 내장 커맨드가 아니라면 리눅스는 path 에서 찾음.

### Network 기반 권한 상승

권한 상승 경로는 internal access 에만 국한된건 아니다. ssh 와 telnet 같은 shared folder 와 remote management interface 도 root access 를 얻는데 도움을 줄 수 있다. 어떤 경우는 root ssh private key 를 찾고 ssh 에 연결하는것처럼 여러 escalation vector 를 이용해야할 수 있음.

### NFS 악용

다른 경로는 더 CTF 나 테스트와 관련되어있는데, 이는 잘못 설정된 network shell 이다. 이 경로는 침투 테스트 동안에 볼 수 있다.

NFS 설정은 /etc/exports file 에 존재한다. 이 파일은 NFS server 설치 시에 생성되고 유저들이 읽을 수 있는 권한으로 되어있다.

이 권한 상승 벡터에서 핵심 요소는 위에서 볼 수 있는 “no_root_squash” 옵션이다. 기본적으로 NFS는 root 사용자를 nfsnobody로 변경하며, root 권한으로 동작할 수 있는 파일의 권한을 제거한다.(이게 root squash). 그러나 “no_root_squash” 옵션이 쓰기 가능한 공유에 설정되어 있을 경우, SUID 비트가 설정된 실행 파일을 생성하고 대상 시스템에서 이를 실행함으로써 권한 상승이 가능하다. 그러니까 default option 임에도 풀어놨을 이유가 뭐가 있을까 root 사용자를 공유하려는 위험한 발상을 하면 그런 설정을 하게되는듯.

그러니까 nfs 를 서비싱하고 있는 서버의 root 탈취를 위한 작업임.
nfs 를 서비싱하고있는데 본인의 fs 에 mount 하고 있으면 local 에서 파일을 마구마구 쑤셔넣을 수 있음.
그러면 setuid(0) setgid(0) system("/bin/bash") 를 수행하는 바이너리를 넣고 nfs 서버에서 실행을 시켜버리면 된다. 물론 uid 와 gid 는 root(0) 이면서 실행가능하고 setuid 비트가 붙은 바이너리
