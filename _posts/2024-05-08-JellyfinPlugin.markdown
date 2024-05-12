---
layout: single
title:  "Jellyfin Plugin Development"
date:   2024-05-11 15:30:09 +0900
categories: jellyfin, asp
toc: true
toc_sticky: true

---

Jellyfin 으로 music media server 를 구축하려고 하는데, plugin 생태계가 생각보다 부족함.
그래서 원하는 것을 직접 만들 수 밖에 없는데, 이에 대한 문서가 마땅히 존재하지 않음.
필요한 자료들을 여기에 정리함.

우선 Jellyfin 은 C# 기반의 프레임워크라서 언어는 C#, web service 로서 ASP 를 사용해야함.
웹도 모르고 C# 도 무지렁이라서 읽는 대상은 아무것도 모르는 사람임.

# C# programming

## static const

A const object is always static...

## Elapsed time 측정

C# system library 로서 제공됨.
[StopWatch class](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.stopwatch?view=net-8.0)


## exception
c++ 과 크게 다를 바 없음.

```
try
{
    // Code to try goes here.
}
catch (SomeSpecificException ex)
{
    // Code to handle the exception goes here.
}
finally
{
    // Code to execute after the try (and possibly catch) blocks
    // goes here.
}
```

rethrow

```
catch(){
throw
}
```

# 프로젝트 구성 Jellyfin Template

[jellyfin template ](https://github.com/jellyfin/jellyfin-plugin-template ) 이라는 프로젝트가 존재함.
여기서 프로젝트를 그대로 가져와서 사용하면 된다.

현 프로젝트에 대해 linter 적용
```
$ dotnet format
```
현 프로젝트 빌드
```
$ dotnet build
```
현 프로젝트를 빌드하고 배포에 필요한 dependecy 파일들 모두 생성.
```
$ dotnet publish
```

package dependency 추가
```
$ dotnet add package PACKAGE_NAME
```

# ASP

## ASP.NET web api design

[design](https://d585tldpucybw.cloudfront.net/sfimages/default-source/blogs/2021/2021-10/asp-net-core-web-api-flowchart.png)
[docs for beginners](https://www.telerik.com/blogs/aspnet-core-beginners-web-apis)
[tutorials for beginners](https://learn.microsoft.com/en-us/training/paths/aspnet-core-web-app/)


## ControllerBase

[ASP web api 문서](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-8.0)
Controller 는 url 에 따른 처리기다.
아래처럼 정의하게 되면,
Route 에 기술된 url( [controller] 는 해당 class 에서 Controller 를 제외한 문자열을 의미함) 에 대한 처리를
이 클래스에서 담당하게 된다.
즉, `https://localhost/weatherforcast/` 에 대한 요청을 처리하게 된다.

method 에서 `HttpGet("forecast")` 으로 등록했기 때문에 `https://localhost/weatherforcast/forecast` url
에 대한 http get response 를 주게 된다.

```
[ApiController]
[Route("[controller]")]
public class WeatherForecastController : ControllerBase
{
    [HttpGet("forecast")]
    public async Task<IActionResult> forecast()
    {
        ...
    }
}
```


##

# Terminology



[koreaner](https://blog.naver.com/okcharles/222138969070)
[ASP routing](https://learn.microsoft.com/ko-kr/aspnet/core/mvc/controllers/routing?view=aspnetcore-8.0#ar6)
