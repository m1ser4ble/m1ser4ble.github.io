______________________________________________________________________

layout: single
title:  "Jellyfin Plugin Development"
date:   2024-05-11 15:30:09 +0900
categories: jellyfin, asp
toc: true
toc_sticky: true

______________________________________________________________________

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
