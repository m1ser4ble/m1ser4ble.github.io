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


## nullable type

간단하게 말하면 Type? 의 형태로 사용하는데 이렇게 만든 변수는 null 을 가질 수 있음.
```
int a? = null;
int b = null; // error
```

심화로 null instance 검사 ,boxing/unboxing 등이 있으니 아래 문서를 참고
[MS offical docs](https://learn.microsoft.com/ko-kr/dotnet/csharp/language-reference/builtin-types/nullable-value-types)

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

# ASP.NET Core

## Dependency Injection

Software engineering 에서 loosely coupled program 을 만들기 위해 고안된 개념임.
어떤 object 나 function 이 어떤 서비스 ( interface) 를 요청하게 되고 여기서 client 가 됨.
그러면 injector 가 만들어서 보내주는 형태. 즉, 어떤 object 나 function 은 구체적으로 요청하는 object 를
어떻게 만들지 알 필요가 없음.

[MS 공식문서](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-2.2)를 차근차근 보면 어떻게 dependency 를 제거할 수 있는지 예제를 통해 이해할 수 있음.



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

# Selenium

Selelnium 은 browser 를 프로그래밍으로 제어할 수 있게 해주는 library다.
예를 들어, Selenium 을 이용하면 어떤 url 에 접속했을 때 특정 attribute 을 가진 버튼을 찾아서
클릭하는 것이 가능해진다. 이런 이점 때문에 실제로 web , browser test  툴로서도 사용되고 있다.

driver 는 browser 를 제어하게 해주는 layer 로 해당 browser vender 가 제공한다.
예를 들어, google-chrome 의 경우에는 chromedriver 라는 파일을 제공하고,
firefox 는 gecko driver 를 제공한다.

## Raspberry pi

raspberry pi 에서는 chrome 이 설치되지 않는다. firefox 는 esr 만 package 관리자가 제공해준다.


### Install FireFox ESR

firefox 는 RR 과 ESR 로 나뉘는데,
RR 은 Rapid Rease 로 4주에 한번씩 major update 가 발생함. 반면에,
ESR 은 Extended Support Release 의 약자로 42주에 한번씩 major update 가, minor update 는 4주에 한번씩 발생하기 때문에 굉장히 보수적인 릴리즈라고 할수 있음.


```
$ apt install firefox-esr
```

### Install gecko driver

[gecko driver github](https://github.com/mozilla/geckodriver/releases)에서 aarch64 로 빌드된 최신 asset 을 다운받는다.
그리고 압축을 해제하면 단일 바이너리 `geckodriver` 가 존재하고, 적절한 위치에 옮겨둔다.
어차피 이 위치는 Selenium code 에서 직접 지정해줄 예정이다.


### Usage code

```
using OpenQA.Selenium;
using OpenQA.Selenium.Firefox;

...

var options = new FirefoxOptions();
options.AddArgument("--headless");
options.AddArgument("--disable-gpu");
options.AddArgument("window-size=1920x1080");
options.AddArgument("--start-maximized");

FirefoxProfile profile = new FirefoxProfile();
const string download_dir = "/music";
profile.SetPreference("browser.download.folderList",2); //Use for the default download directory the last folder specified for a download
profile.SetPreference("browser.download.dir", download_dir);
// profile.SetPreference("browser.download.manager.showWhenStarting", false);
profile.SetPreference("browser.helperApps.neverAsk.saveToDisk", "*/*");
options.Profile = profile;

var driver = new FirefoxDriver("/jellyfin/geckodriver", options);

```

옵션이 꽤나 많은데, --headless 는 browser 창을 띄우지 않겠다는 의미다.
가능한 옵션들은 해당 binary 의 옵션이기 때문에 firefox --help 를 해서 가능한게 있는지 확인하라.
disable-gpu 는 사실 chrome 의 옵션이라 이런식으로 작성하면 모르는 option 이라는 warning 이 발생한다.
FirefoxProfile 은 실제 firefox browser 에서 preference 를 수정하겠다는 의미다.
이는 직접 브라우저에서도 설정할 수 있으며, 따라서 key 는 browser 에서 찾아오면 된다.
혹은 [mozilla docs](https://kb.mozillazine.org/About:config_entries)서 확인

`Preference browser.download.manager.showWhenStarting may not be overridden` 라는 에러가 나오면,
이미 설정되어있는 값인지를 확인해봐라. 애초에 frozen 인 것은 디자인상 그렇게 되어야하는
속성이기 때문이다.


### Deployment

아래처럼 빌드하게 되면 dependency package 까지 함께 제공되기 때문에 배포하기에 좋다.
특히 Selenium WebDriver 를 의존하고 있는데, 아래 커맨드를 수행하게 되면 WebDriver.Dll 도 함께 나오며,
jellyfin plugin directory 에 함께 넣기만 하면 되서 편리함. 시스템에 설치할 필요가 없음.
```
$ dotnet publish
```
jellyfin config plugins 에 본인의 디렉토리를 생성하고 생성된 프로젝트의 dll 과 WebDriver 를 함께 넣기만 하면 된다.



[koreaner](https://blog.naver.com/okcharles/222138969070)
[ASP routing](https://learn.microsoft.com/ko-kr/aspnet/core/mvc/controllers/routing?view=aspnetcore-8.0#ar6)
