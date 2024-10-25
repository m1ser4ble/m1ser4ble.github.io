______________________________________________________________________

layout: single
title:  "upx unpacker"
date:   2024-08-08 15:30:09 +0900
categories: pin
toc: true
toc_sticky: true

______________________________________________________________________

Practical Binary Analysis 에서 upx unpacker 를 intel pin 으로 구현하는 방법이 있음.
그러나, 버전이 올라서인지 architecture 가 64비트라 그런지 책에서 말한 방식대로 동작하지 않음.
그래서 다른 exploitation 이 필요하다고 생각돼서 binary 분석을 좀 해봤다.

# gdb-peda

starti : instruction level start

# upx packed ls

si 로 call 을 들어가다 보면 반복되는 구간을 발견할 것임.

```
   0x7ffff7ffdaf4:      inc    rsi
=> 0x7ffff7ffdaf7:      mov    BYTE PTR [rdi],dl

```

메모리에 값을 쓰는 instruction 을 발견했음. 이 메모리는mapped 로 execution permission 이 없는 allocated memory 임.
결국 decode 가 끝나면 저 영역에 execution 권한을 부여하고 jump 하지 않을까?

```
gdb-peda$ vmmap
Start              End                Perm      Name
0x00007ffff7fc4000 0x00007ffff7fc5000 rw-p      mapped
0x00007ffff7fc5000 0x00007ffff7fc9000 r--p      [vvar]
0x00007ffff7fc9000 0x00007ffff7fcb000 r-xp      [vdso]
0x00007ffff7fcb000 0x00007ffff7fcc000 rw-p      /home/dongwan/intel-pin-vcpkg/unpacker/upx-4.2.4-amd64_linux/ls
0x00007ffff7fcc000 0x00007ffff7ff0000 rw-p      mapped
0x00007ffff7ff0000 0x00007ffff7fff000 r-xp      /home/dongwan/intel-pin-vcpkg/unpacker/upx-4.2.4-amd64_linux/ls
0x00007ffffffde000 0x00007ffffffff000 rw-p      [stack]
0xffffffffff600000 0xffffffffff601000 --xp      [vsyscall]

```

pin 을 이용해서 syscall 10 (mprotect ) 를 호출하는 경우를 찍어봤는데,
기존 전략( memwrite 한 memory 로 jump 할 것이라는 예측) 이후에도 mprotect 가 호출되고 있었다.
ls 라서 memory 에 대해 저런 짓을 한다는 것은 잘 이해가 되지 않는다.
심지어는 이런 영역도 있었다.

```
#### 7fc2665ad000 -  21000 , permission 0
```

마치 protectr 가 일부만 decoding 하고 실행하고 decoding 하고 실행하는 듯한 느낌을 준다.
실행 후에 다시 복호화해서 두지만 않는다면, 마지막 mprotect 이후에 dump 를 하면
모두 복화화되어있지 않을까?
encoding 을 하는 것이 아니라면

PIN_GetContextRegval

vcpkg 로 intel pin 을 만들면서 vcpkg portfile 을 만드는 방법을 알아보자

# vcpkg

vcpkg 는 ms 가 밀어주고 있는 c++ 진영에서의 package dependency management tool 이다.
예를 들어, 내가 만드는 프로그램이 libboost 에 대해 dependency 가 있다면,
이를 명시해주고 rust 의 toml 처럼 build from source 를 해주는 툴이다.
cmake toolchain extension 으로서 구현되어있음.
그럼 내가 명시한 package 에 대해서 어떻게 빌드해야하는지는 누가 알고 있는걸까?
예를 들면, 우리가 boost 에서 필요한 component 가 asio 라고 했을 때 이 컴포넌트만 빌드하면 될 것으로 보임.
그런데도 전체빌드하는 것은 낭비일 수 밖에 없음. 이런식으로 일부 모듈만 빌드할 수 도 있는데
vcpkg 에서는 feature 로서 그런 기능을 지원할 수 있다.
그럼 boost 중 asio feature 만 빌드해주세요~ 라는 나의 요청에 asio 만 어떻게 빌드할 지 누가 책임지는가?
port 가 책임진다. port 는 package 를 어떤 주소로부터 어떤 옵션들을 제공하면서 빌드할지를 기술하는 것이다.
이런 port 들의 묶음을 registry 라고 하며, 우리는 여러 registry 를 참조할 수 있음.

# port

```
vcpkg_check_linkage(ONLY_STATIC_LIBRARY)
vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO llvm/llvm-project
    REF "llvmorg-${VERSION}/openmp-${VERSION}"
    SHA512 a2b5e4d52dbddc47b4e10e3c8acb1b04b7ef97b723d160d591cb83ccff6edc0433a2dbca55074d42b533b406647b34dc0df1791b6a33879902addbe67735d1cc
    #SHA512 48078fff9293a87f1a973f3348f79506f04c3da774295f5eb67d74dd2d1aa94f0973f8ced3f4ab9e8339902071f82c603b43d5608ad7227046c4da769c5d2151  # This is a temporary value. We will modify this value in the next section.
    HEAD_REF master
    #URLS "https://github.com/llvm/llvm-project/releases/download/llvmorg-18.1.8/openmp-18.1.8.src.tar.xz"
)
vcpkg_cmake_configure(
    SOURCE_PATH "${SOURCE_PATH}/openmp"
)
vcpkg_cmake_install()
vcpkg_cmake_config_fixup(PACKAGE_NAME "my_sample_lib")
file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/include")
file(INSTALL "${SOURCE_PATH}/LICENSE" DESTINATION "${CURRENT_PACKAGES_DIR}/share/${PORT}" RENAME copyright)
configure_file("${CMAKE_CURRENT_LIST_DIR}/usage" "${CURRENT_PACKAGES_DIR}/share/${PORT}/usage" COPYONLY)
```

이번에는 Jellyfin plugin 으로 playlist 를 자동으로 만드는 기능을 구현하고자 한다.
생각해보니 플러그인으로 뭘 할 수 있는지가 정리돼있으면 좋을 것 같다는 생각이 들었음.

# Interface

IScheduledTask - Allows you to create a scheduled task that will appear in the scheduled task lists on the dashboard.
ex ) jellyfin source 에서의 RefreshMediaLibraryTask , LibraryManager.cs 를 보면 직관적임.

ITaskManager - Allows you to execute and manipulate scheduled tasks
IUserManager - Allows you to retrieve user info and user library related info

# WebApi

jellyfin 은 web api 로도 기능들을 제공하고 있다. 예를 들면, playlist 에 대한 제어를 하기 위해서는
아래 파일에 정의된 PlaylistController 를 http request 를 통해서 호출할 수 있음.
Interface 만이 옵션은 아님.
`Jellyfin.Api/Controllers/PlaylistsController.cs`
그러나 이 api 는 api key 를 발급해서 사용하는(예를들면, sptoify api 나 upbit api 처럼) 기능이므로 plugin 에서 사용하기에는 적절하지 않음.

# Triggered Task

DeleteLogFileTask 는 task 임에도 invoke 를 해주는 코드가 없음.
왜냐하면, 이 task 는 DI 로 인해 생성되고 trigger 에 의해 주기적으로 실행할 task 이기 때문.

jellyfin/Emby.Server.Implementations/ScheduledTasks/Tasks/DeleteLogFileTask.cs

docker compose pull
docker compose up -d

[출처](https://github.com/jellyfin/jellyfin-plugin-template)
