______________________________________________________________________

layout: single
title:  "Jellyfin Plugin Development"
date:   2024-05-11 15:30:09 +0900
categories: jellyfin, asp
toc: true
toc_sticky: true

______________________________________________________________________

Jellyfin 으로 music media server 를 구축하려고 하는데, plugin 생태계가 생각보다 부족함.
그래서 원하는 것을 직접 만들 수 밖에 없는데, 이에 대한 문서가 마땅히 존재하지 않음.
필요한 자료들을 여기에 정리함.

우선 Jellyfin 은 C# 기반의 프레임워크라서 언어는 C#, web service 로서 ASP 를 사용해야함.
웹도 모르고 C# 도 무지렁이라서 읽는 대상은 아무것도 모르는 사람임.

# C# programming

## property

public data member 인것 처럼 사용되지만 accessor 라는 메소드를 이용하게 됨. 안전성과 유연성을 향상시킨다고 하네.

```
public class Person
{
    private string _firstName;
    private string _lastName;

    public Person(string first, string last)
    {
        _firstName = first;
        _lastName = last;
    }

    public required decimal Price
    { get; set; }

    public string Name => $"{_firstName} {_lastName}";
}
```

직관적이어서 이 코드 하나로 사용법을 끝낼 수 있을듯.

## nullable type

간단하게 말하면 Type? 의 형태로 사용하는데 이렇게 만든 변수는 null 을 가질 수 있음.

```
int a? = null;
int b = null; // error
```

심화로 null instance 검사 ,boxing/unboxing 등이 있으니 아래 문서를 참고
[MS offical docs](https://learn.microsoft.com/ko-kr/dotnet/csharp/language-reference/builtin-types/nullable-value-types)

관련 연산자로 null forgiving operator  ( or postfix bang operator) 와 null coalescing operator 가 있음.

null forgiving operator 는 컴파일러에게 사실상 내가 이거 null 이 아니라는걸 알고 있다고 말하는 셈이며,
null 인경우 error 가 throw 됨.

?? 는 lhs 가 non-null 인 경우 lhs 의 값이 리턴되고, null 인 경우 rhs 가 evaluate 되어서 리턴됨.
??= 는 lhs 가 null 인 경우에만 rhs 값을 할당해주는 연산임.

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

## Async

[Why would I want to use ConfigureAwait(false)?](https://devblogs.microsoft.com/dotnet/configureawait-faq/)

# 프로젝트 구성 Jellyfin Template

[jellyfin template ](https://github.com/jellyfin/jellyfin-plugin-template) 이라는 프로젝트가 존재함.
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

### Concepts

[Middleware](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-8.0)
[Endpoints](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/routing?view=aspnetcore-8.0)

### How to register Jellyfin Plugins as service

[AddJellyfinApi](https://github.com/jellyfin/jellyfin/blob/e619e19242dfce2cf173293f5cdc294f50e3df4c/Jellyfin.Server/Extensions/ApiServiceCollectionExtensions.cs#L179) 메소드에서 IMvcBuilder dll 로부터 추출한 Assembly 를 application part 로 등록함
이 assembly 를 로드하는 과정에서 IServiceCollection 에 필요한 dependency 들도 모두 주입했기 때문에 AddJellyfinApi 를 호출하는 Startup.cs 에서 추후 DI 로 모든 객체를 원하는 대로 뿌려줄 수 있는 것으로 보임.

code 에서 볼 수 있듯이 `AddControllersAsServices` 만 호출하고 있음.

IMvcBuilder 의 documentation 에 가보면 `AddRazorRuntimeCompilation(IMvcBuilder)` 등등의 메소드가 존재하는데 이런 것들을 호출하면 사용가능한게 아닐까...?
`WithRazorPagesAtContentRoot(IMvcBuilder)`
결국 플러그인 차원에서 할 수 있는 것은 없다...

[Application Part](https://learn.microsoft.com/en-us/aspnet/core/mvc/advanced/app-parts?view=aspnetcore-8.0) 란?

[Assembly](https://www.bytehide.com/blog/assembly-in-dotnet) 란?
간단하게만 말해서 type 과 resource 들의 집합체. 배포 library 라고 봐도 무방할 것으로 보임.

## MVC

### ControllerBase

[ASP web api 문서](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-8.0)
Controller 는 url 에 따른 처리기다.
아래처럼 정의하게 되면,
Route 에 기술된 url( \[controller\] 는 해당 class 에서 Controller 를 제외한 문자열을 의미함) 에 대한 처리를
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

#### Authorization

\[Authorize\] attribute 을 사용하면 authenticated user 만 사용할 수있게 할 수 있음. 즉, api 가 노출됐지만 login 하지 않은 unknown 으로부터 api 가 호출되는 것을 막을 수있음.

[MS official](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/simple?view=aspnetcore-8.0)

## Balzor and Razor

Blazor 는 interactive web ui 를 개발하기 위한 web framework 임.
C#, HTML, 그리고 Razor syntax(javascript 대신에 이걸 사용함) 로 구성되어있다.
Blazor 로 web 을 만들면 WebAssemlby 로 작성된 client based app 과 ASP.NET 으로 작성된 Server side application 을 만들게 된다.
browser 에서는 WebAssembly 가 실행되는 동안 Server 는 browser 와 SignalIR 이라는 연결로 통신을 하게 된다.
[Blazor vs Razor](https://www.infragistics.com/community/blogs/b/jason_beres/posts/blazor-vs-razor-the-difference-solved)

그렇다면 당연히 Blazor 를 사용해야 하는게 아닌가? [MS Official Docs](https://learn.microsoft.com/en-us/aspnet/core/tutorials/choose-web-ui?view=aspnetcore-8.0) 에서 web ui 를 선택한다는 의미는 무엇인가...?

알고보니 비교해야할 대상은 MVC + Razor ( traditional way ) vs Blazor
[비교하는 좋은 글](https://stackoverflow.com/questions/66301916/asp-net-core-blazor-vs-net-core-mvc-with-razor)이 있어서 요약을 해봄.

기본적인 웹 요청/ 반환을 생각해보면, 페이지 구성은 기본적으로 두가지 방식이 있다.

1. example.com/view-article?id=123 의 쿼리를 보내면 그에 맞는 page(html) 을 그대로 보내주는 방식

- 한 번 로드가 되고 나면, 다른 페이지로 가지 않는 이상 interactive 하게 변화할 수 없음.

2. example.com/view-article?id=123 의 api 가 반환해주는 contents 로 현재의 DOM 을 재구성하는 방식.

- 이 방식은 당연히 javascript code 가 요구가 되고, client 에서의 rendering overhead 가 동반됨.  network overhead 는 좀 줄겠지만.
  그래서 javascript 가 없으면 새로운 페이지를 로드해와야하기 때문에 multi-page application 이라고 불린다.

그러면 SPA(Single Page Application) 가 되면 위에서 말한대로 필요한 데이터만 server 로부터 긁어와서 클라이언트가 렌더링 하기 때문에
static resource(html, js, css ) 와 db 로부터 엔트리를 주는 api 를 제공.
Blazor 는 SPA 다! 다른 플랫폼들과 비교했을 때의 차이는 뭐냐면 client 와 server side 를 동시에 제어한다는 점이다.

### Balzor

## Jellyfin(MVC) using Blazor

이렇게 알아봤지만 의미가 없음. AppDomain 의 root directory 를 기준으로 Views directory 내의 cshtml 파일들로
View 를 제공해주는데, 그 파일을 찾지를 못함.
Jellyfin 이 blazor 를 전혀 사용하지 않기 때문인지 webroot dir 은 당연히 null 이고,
Views directory 를 AppDomain 에 직접 박아넣어도 찾지못한다는 에러만 나옴

```
System.InvalidOperationException: The view 'Search' was not found. The following locations were searched:
/Views/Spotify/Search.cshtml
/Views/Shared/Search.cshtml
/Pages/Shared/Search.cshtml
```

여기서 / 가 app domain path 로 system absolute path 로는 /jellyfin.
결국 매우 귀찮게도 SSO-auth project 처럼 js code 따로 짜고 server logic 따로 짜고 해야할 것으로 보임.

결론적으로는 react 로 작성해서 나온 resource 들을 모두 embedding 해서 client 의 resource request 에 대해
embedding 된 리소스를 리턴하도록 해서 구현했다. 다행히 server 에서 다루고있는 데이터 객체는 따로 존재하지 않아서
데이터 직렬화나 model 에 대해 고민할 필요가 없었음.

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

### Http

일반 텍스트인 경우 `Content(contents, "text/html")` 로 리턴하면 되지만, 리소스 (img 등등) 인 경우에
이런 포맷을 가지고 있음. $"data:image/png;base64,{base64Image}" 그래서 이런 처리를 해주는 File 이라는
함수가 있으니 이를 이용하면 됨.

# Troubleshooting

## inactive plugin

한번 로드 실패한 plugin( 나의 경우에는 jellyfin package , 예를 들면 Jellyfin.Model, 의 버전을 더 높게 잡아서 문제가 됐음)
은 inactive 가 되는데, on/off 기능이 없는 심플한 플러그인인 경우에 다시 활성화 시킬 수 없음.
그럴때는 plugin directory 의 meta.json 을 없애고 다시 시작하면 됨.
