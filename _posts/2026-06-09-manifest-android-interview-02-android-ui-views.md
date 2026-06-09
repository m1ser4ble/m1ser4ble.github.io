---
layout: single
title: "Manifest Android Interview 2편: Android UI - Views 독해 가이드"
date: 2026-06-09 10:19:00 +0900
categories: android
excerpt: "Android View 시스템 파트는 전통 UI가 View tree, measure/layout/draw, invalidation, RecyclerView 재사용으로 화면을 갱신하는 방식을 설명한다."
toc: true
toc_sticky: true
tags: [android, interview, views, recycler-view, rendering, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.121~187, `Category 1: Android UI - Views` 구간의 독해 가이드다.
- 핵심 질문은 "전통 Android UI는 화면을 어떤 tree와 rendering pipeline으로 갱신하는가?"다.
- View, ViewGroup, custom view, Canvas, invalidation, RecyclerView, bitmap, animation, Window/WebView를 하나의 rendering 문제로 묶어 읽는다.

## 이 글이 답하려는 질문

> View 기반 Android UI에서 성능 문제와 lifecycle 문제는 왜 반복해서 발생하는가?

View 시스템은 XML layout과 widget API 목록이 아니다. UI tree를 만들고, 측정하고, 배치하고, 그리고, 필요할 때 다시 그리는 시스템이다.

## 읽기 전에 알아야 할 것

View 시스템은 Compose보다 오래된 imperative UI 모델이다. 하지만 Compose를 쓰더라도 Android `Window`, input, accessibility, bitmap, WebView, interop를 다룰 때 View 지식이 필요하다.

## 용어 사전

| 용어 | 의미 | 읽을 때의 포인트 |
|------|------|------------------|
| View | 화면에 그려지는 최소 UI 단위 | draw와 event handling의 기본 단위 |
| ViewGroup | child View를 measure/layout하는 container | layout cost가 발생하는 지점 |
| Inflation | XML layout을 View 객체로 변환 | 비용이 있으므로 반복 생성 주의 |
| Measure/Layout/Draw | 크기 측정, 위치 배치, 실제 그리기 단계 | UI 성능 분석의 기본 pipeline |
| Invalidation | 다시 그릴 필요가 있음을 표시 | `invalidate`와 `requestLayout` 구분 |
| Canvas | custom drawing API | 복잡한 그래픽/차트/custom view 구현 |
| RecyclerView | 큰 list를 효율적으로 표시하는 ViewGroup | ViewHolder 재사용과 diffing이 핵심 |
| Bitmap | 메모리 비용이 큰 raster image | decode size와 cache 전략 중요 |
| Window | 화면에 표시되는 top-level surface/interaction 경계 | Activity UI와 system UI 사이의 접점 |
| WebView | 앱 안에서 web content를 렌더링하는 View | navigation, JS bridge, security 주의 |

## 등장 배경과 이유

Android View 시스템은 다양한 화면 크기, 밀도, 입력 방식, 성능 제약을 처리해야 했다. 그래서 UI는 고정 좌표가 아니라 parent-child tree와 측정/배치 규칙으로 구성된다. 문제는 이 유연성이 곧 비용이라는 점이다.

- 중첩 layout은 measure/layout 비용을 키운다.
- bitmap은 쉽게 OOM을 유발한다.
- custom view는 lifecycle과 invalidation을 잘못 다루면 깜박임/과다 draw가 난다.
- list UI는 재사용 없이는 스크롤 성능을 유지하기 어렵다.

## 역사적 기원

전통 Android UI는 XML layout과 View class 계층을 중심으로 발전했다. 초기에는 Activity + XML + AdapterView/ListView가 일반적이었고, 이후 RecyclerView, ConstraintLayout, Material Components 같은 도구가 등장해 성능과 구조를 개선했다. Compose가 등장한 뒤에도 기존 앱과 라이브러리, WebView, MapView, legacy screen은 View 시스템 위에 남아 있다.

## 학술적/이론적 배경

| 배경 | View 시스템에서의 표현 |
|------|------------------------|
| Scene graph / retained UI tree | View tree |
| Layout constraint solving | ConstraintLayout |
| Dirty region redraw | invalidation |
| Object pooling/reuse | RecyclerView ViewHolder, RecycledViewPool |
| Raster graphics | Canvas, Bitmap, Drawable |
| Event dispatch | touch, focus, click listener |

## 연대표

| 흐름 | 의미 |
|------|------|
| XML layout + View | Android UI의 기본 작성 방식 |
| ListView/Adapter | list UI의 초기 패턴 |
| RecyclerView | ViewHolder와 adapter 분리, 재사용 개선 |
| ConstraintLayout | flat hierarchy로 복잡한 배치 처리 |
| Material Components | 일관된 UI component와 theming |
| Compose interop | View와 Compose를 함께 쓰는 전환기 |

## 동작 메커니즘

### View rendering pipeline

원문 p.123 View lifecycle, p.141 invalidation 설명을 재구성하면 다음 흐름이다.

<div class="mermaid">
flowchart TD
    Attach[View attached to window]
    Measure[onMeasure<br/>decide size]
    Layout[onLayout<br/>decide position]
    Draw[onDraw<br/>render pixels]
    Event[User / data change]
    Dirty[invalidate or requestLayout]

    Attach --> Measure --> Layout --> Draw
    Event --> Dirty
    Dirty -->|visual change only| Draw
    Dirty -->|size or position change| Measure
</div>

`invalidate()`는 다시 그리기 요청이고, `requestLayout()`은 크기/위치 계산부터 다시 하겠다는 신호다. 둘을 구분해야 성능 답변이 정확해진다.

### RecyclerView reuse model

원문 p.150~p.156 RecyclerView 구간의 핵심은 ViewHolder reuse다.

<div class="mermaid">
flowchart LR
    Data[List data]
    Adapter[Adapter]
    Create[onCreateViewHolder]
    Bind[onBindViewHolder]
    Visible[Visible item]
    Pool[RecycledViewPool]
    Scroll[Scroll]

    Data --> Adapter
    Adapter --> Create --> Bind --> Visible
    Visible --> Scroll --> Pool
    Pool --> Bind
</div>

면접에서는 `RecyclerView`를 "리스트용 View"가 아니라, View 생성 비용을 줄이기 위해 item view를 재사용하는 시스템으로 설명해야 한다.

## 책의 전체 구조에서 이 파트의 위치

이 파트는 Framework와 Jetpack 사이의 다리다. 앞 글의 Activity/Window 위에 View tree가 올라가고, 다음 글의 ViewModel/LiveData는 이 View tree에 표시할 state를 공급한다.

## 장별 독해 가이드

- View lifecycle: attach/detach와 measure/layout/draw를 구분한다.
- View vs ViewGroup: leaf와 container의 책임 차이를 잡는다.
- Custom View/Canvas: drawing API보다 invalidation과 measurement가 중요하다.
- ConstraintLayout/ViewStub: layout performance와 lazy inflation 관점으로 읽는다.
- SurfaceView/TextureView: 별도 surface, video/camera/game rendering 같은 특수 렌더링.
- RecyclerView: adapter, ViewHolder, diffing, multi view type, pool.
- Bitmap/Drawable/Animation: 메모리와 frame timing.
- Window/WebView: 앱 UI와 platform/web boundary.

## 핵심 주장과 근거

View 파트의 핵심 주장은:

> UI 성능은 "무엇을 그리는가"보다 "언제 무엇을 다시 계산하고 다시 그리는가"에 달려 있다.

원문은 custom view, invalidation, RecyclerView, bitmap, animation을 따로 설명하지만 모두 같은 비용 모델로 연결된다.

## 실무 적용 / 생각해볼 질문

- `invalidate()`와 `requestLayout()` 중 무엇을 호출해야 하는가?
- custom view에서 `onDraw()` 안에 객체를 계속 생성하면 왜 위험한가?
- RecyclerView에서 item type이 여러 개일 때 구조를 어떻게 나눌 것인가?
- 큰 bitmap을 그대로 decode하면 어떤 문제가 생기며, sample size는 어떻게 정할 것인가?
- WebView에서 JS bridge를 열 때 어떤 보안 경계를 확인해야 하는가?

## 오해하기 쉬운 부분

| 오해 | 교정 |
|------|------|
| View는 화면에 보이는 객체일 뿐이다 | lifecycle, measure/layout/draw, event dispatch를 가진 runtime 객체다 |
| custom view는 `onDraw`만 잘 쓰면 된다 | measurement, invalidation, allocation이 더 중요할 수 있다 |
| RecyclerView는 ListView의 새 버전이다 | 재사용, adapter 분리, diffing, pool까지 포함한 list rendering framework다 |
| Compose를 쓰면 View 지식이 필요 없다 | interop, Window, WebView, legacy screen, performance debugging에 필요하다 |

## 한 장 요약

```text
View UI = tree + pipeline + reuse

tree:
  ViewGroup -> View

pipeline:
  measure -> layout -> draw

update:
  invalidate -> redraw
  requestLayout -> remeasure + relayout + redraw

large list:
  Adapter -> ViewHolder -> RecycledViewPool -> DiffUtil/ListAdapter
```

## 참고자료

- 원문: *Manifest Android Interview*, Category 1: Android UI - Views, p.121~187.
- Android Developers, Custom drawing: <https://developer.android.com/develop/ui/views/layout/custom-views/custom-drawing>
- Android Developers, RecyclerView: <https://developer.android.com/develop/ui/views/layout/recyclerview>
- Android Developers, WebView: <https://developer.android.com/develop/ui/views/layout/webapps/webview>
