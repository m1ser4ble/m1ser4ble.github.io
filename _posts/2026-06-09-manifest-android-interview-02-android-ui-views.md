---
layout: single
title: "Manifest Android Interview 2편: Android UI - Views 독해와 답변 지도"
date: 2026-06-09 09:02:00 +0900
categories: android
excerpt: "전통 Android View 시스템을 View tree, measure/layout/draw, invalidation, drawing resource, RecyclerView, Window/WebView 모델로 읽고 Q33~Q48 답변 골격을 정리한다."
toc: true
toc_sticky: true
tags: [android, interview, view, ui, rendering, reading-guide]
source: "Manifest Android Interview: The Ultimate Guide, Jaewoong Eum, 2025 PDF"
---

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>

## TL;DR

- 이 글은 원문 p.121~187, `Category 1: Android UI - Views`의 독해와 답변 지도다.
- 전통 View 시스템의 핵심 질문은 "화면은 어떤 tree를 따라 측정, 배치, 그리기, 무효화, 재사용되는가?"다.
- 원문 Q33~Q48은 모두 답변 capsule로 다룬다. Practical question은 `주의점`과 `실무 포인트`에 흡수했다.
- View 면접 답변의 공통 형식은 `View tree -> measure/layout/draw -> invalidation/requestLayout -> main thread 비용 -> 최적화 선택`이다.

## 이 글이 답하려는 질문

> Jetpack Compose가 중요해진 지금에도, 전통 Android View 시스템을 이해한 사람처럼 답하려면 무엇을 설명해야 하는가?

이 파트는 "Button, TextView, RecyclerView를 써봤는가"를 묻는 구간이 아니다. 원문은 View lifecycle, ViewGroup, ViewStub, custom view, Canvas, invalidation, ConstraintLayout, SurfaceView/TextureView, RecyclerView, Window, WebView까지 묻는다. 질문은 흩어져 있지만 실제로는 네 가지 모델을 반복한다.

- UI는 View tree다. leaf node인 View와 branch node인 ViewGroup이 measure/layout/draw를 통과한다.
- 화면 갱신은 비용이 있다. `requestLayout()`, `invalidate()`, `postInvalidate()`가 무엇을 다시 하게 만드는지 알아야 한다.
- drawing resource는 memory와 density 문제다. Canvas, Drawable, Bitmap, NinePatch는 전부 "무엇을 어떻게 그릴 것인가"의 선택지다.
- 고성능 UI는 재사용과 분리된 surface가 필요하다. RecyclerView, SurfaceView, WebView, Window/PopupWindow는 각자 다른 rendering boundary를 만든다.

따라서 이 글은 API 목록보다 먼저 View system의 작동 모델을 설명하고, 그 위에 질문별 답변을 붙인다.

## 읽기 전에 알아야 할 것

전통 Android UI는 main thread에서 View hierarchy를 갱신한다. Activity나 Fragment가 화면을 소유하더라도, 실제 rendering의 기본 단위는 View다. View는 부모 ViewGroup에게 크기 제약을 받고, 자신의 크기를 측정하고, 위치를 배정받고, Canvas 위에 그려진다. 이 순서를 모르고 custom view나 RecyclerView 최적화를 말하면 답변이 얕아진다.

<div class="mermaid">
flowchart TD
    Root["Window decor view"]
    Parent["ViewGroup<br/>measure children, place children"]
    Child["View<br/>measure self, draw self"]
    Measure["Measure pass<br/>onMeasure"]
    Layout["Layout pass<br/>onLayout"]
    Draw["Draw pass<br/>onDraw"]
    Input["Input event<br/>touch, click, key"]
    Dirty["Invalidation<br/>invalidate or requestLayout"]
    Main["Main thread<br/>Choreographer frame"]

    Root --> Parent
    Parent --> Child
    Main --> Measure
    Measure --> Layout
    Layout --> Draw
    Input --> Child
    Child --> Dirty
    Dirty --> Main
</div>

원문 p.121~187의 여러 그림과 예제를 하나의 mental model로 재구성한 것이다.

## 용어 사전

| 용어 | 먼저 기억할 의미 | 답변할 때 붙일 관점 |
|------|------------------|----------------------|
| View | 화면에 그려지는 단일 UI element | draw, input, lifecycle, invalidation |
| ViewGroup | child View를 포함하고 측정/배치하는 container | hierarchy depth, measure/layout cost |
| Measure | View가 필요한 크기를 계산하는 단계 | parent constraints, MeasureSpec |
| Layout | View의 최종 위치를 정하는 단계 | child placement, nested layout cost |
| Draw | Canvas에 실제 픽셀을 그리는 단계 | overdraw, bitmap, custom drawing |
| Invalidation | 다시 그려야 하는 영역을 표시하는 과정 | `invalidate()`와 `requestLayout()` 구분 |
| ViewStub | 필요할 때만 inflate되는 lightweight placeholder | initial render cost 절감 |
| Canvas | custom drawing 명령을 수행하는 drawing surface | Paint, path, bitmap, text |
| Drawable | 그릴 수 있는 resource 추상화 | bitmap, vector, shape, layer, nine-patch |
| Bitmap | 픽셀 data를 memory에 들고 있는 image object | sampling, cache, OOM 방지 |
| RecyclerView | item View를 재사용해 큰 list를 효율적으로 표시하는 container | adapter, ViewHolder, layout manager |
| Window | 앱 화면이 system window manager에 붙는 최상위 표시 단위 | decor view, dialog, popup |
| WebView | 앱 안에서 web content를 rendering하는 View | JavaScript, security, lifecycle |

## 등장 배경과 이유

Android View 시스템은 모바일 기기의 제한된 CPU, GPU, memory, battery 안에서 화면을 부드럽게 갱신하기 위해 만들어졌다. 화면은 계속 바뀌지만, 매번 모든 View를 새로 만들고 전체 화면을 다시 그리면 성능이 무너진다. 그래서 Android는 tree 구조, 부분 invalidation, View 재사용, resource density, bitmap sampling 같은 기법을 제공한다.

이 파트의 질문들은 결국 같은 문제를 다른 각도에서 묻는다.

- "무엇을 다시 측정해야 하는가?"
- "무엇만 다시 그리면 되는가?"
- "어떤 resource를 메모리에 올려야 하는가?"
- "화면 밖 item을 어떻게 재사용하는가?"
- "View hierarchy와 Window boundary를 어디에 둬야 하는가?"

## 역사적 기원

전통 Android UI는 XML layout과 View hierarchy를 중심으로 성장했다. 초기 Android 앱은 대부분 Activity가 XML layout을 inflate하고 `findViewById()`로 View를 찾아 조작했다. 이후 성능과 유지보수 문제를 줄이기 위해 ConstraintLayout, RecyclerView, ViewBinding, AppCompat, Material Components가 등장했다. Compose가 나온 뒤에도 많은 앱은 View system을 유지하거나 Compose와 섞어 쓴다. 그래서 View 질문은 legacy 지식이 아니라 migration과 interop을 위한 기반 지식이다.

| 흐름 | 왜 중요해졌는가 | 이 글에서 이어지는 질문 |
|------|----------------|--------------------------|
| XML + View hierarchy | 화면 선언과 runtime View tree를 연결 | Q33, Q34 |
| Custom View | 기본 widget으로 표현하기 어려운 UI 구현 | Q36, Q37, Q38 |
| ConstraintLayout | nested ViewGroup으로 인한 layout cost 완화 | Q39 |
| RecyclerView | 큰 list를 memory-efficient하게 표시 | Q41 |
| Density resource | 다양한 화면 밀도와 접근성 대응 | Q42, Q43, Q44, Q45 |
| WebView/Window | 앱 UI 밖 또는 web rendering boundary 처리 | Q47, Q48 |

## 학술적/이론적 배경

- Scene graph: View hierarchy는 UI element를 tree로 구성하고 parent-child 관계로 rendering과 input dispatch를 결정한다.
- Retained-mode UI: View object가 상태를 보유하고 system이 필요할 때 measure/layout/draw를 호출한다.
- Constraint solving: ConstraintLayout은 상대 위치 제약을 계산해 nested layout을 줄인다.
- Object pooling/recycling: RecyclerView는 ViewHolder를 재사용해 allocation과 bind 비용을 줄인다.
- Raster/vector graphics: Bitmap은 픽셀 기반이고 VectorDrawable/ShapeDrawable은 device density에 더 유연하다.
- Frame budget: 60fps 기준 약 16ms 안에 UI 작업을 끝내야 jank를 줄일 수 있다.

## 연대표

| 시기 | 변화 | 독해 포인트 |
|------|------|-------------|
| 초기 Android | XML layout, View/ViewGroup 중심 UI | View tree와 lifecycle이 기본 |
| Android 3.x~4.x | property animation과 다양한 screen density 대응 | animation, dp/sp, bitmap 관리가 중요 |
| Support Library 시대 | AppCompat으로 하위 버전 호환성 보강 | Q49와도 연결되는 compatibility layer |
| RecyclerView 등장 | ListView보다 유연한 list/grid 재사용 모델 | ViewHolder와 diff/bind cost 이해 필요 |
| ConstraintLayout 확산 | nested layout 대신 flat constraint UI | layout pass 비용 최적화 |
| Compose 시대 | 선언형 UI가 주류로 이동 | View 지식은 interop/migration과 legacy 유지보수에 필요 |

## 동작 메커니즘

### 1. View tree와 rendering pipeline

View system의 기본 흐름은 `measure -> layout -> draw`다. 부모 ViewGroup은 child에게 제약을 전달하고, child는 그 안에서 원하는 크기를 계산한다. 그 다음 parent가 child 위치를 결정하고, 마지막으로 View가 Canvas에 자신의 내용을 그린다.

<div class="mermaid">
flowchart LR
    StateChange["state or data change"]
    NeedSize["size or position changed?"]
    Request["requestLayout"]
    Invalidate["invalidate"]
    Measure["measure pass"]
    Layout["layout pass"]
    Draw["draw pass"]
    Screen["updated frame"]

    StateChange --> NeedSize
    NeedSize -->|"yes"| Request
    NeedSize -->|"no, pixels only"| Invalidate
    Request --> Measure
    Measure --> Layout
    Layout --> Draw
    Invalidate --> Draw
    Draw --> Screen
</div>

이 구분이 면접에서 중요하다. text가 바뀌어 View 크기가 달라질 수 있으면 layout이 필요하고, 같은 크기 안에서 색상만 바뀌면 draw만 다시 해도 된다. 잘못된 invalidation은 불필요한 layout pass나 stale UI를 만든다.

### 2. ViewGroup과 layout 성능

ViewGroup은 child를 포함하는 branch node다. ViewGroup이 깊게 중첩되면 각 frame에서 measure/layout 계산이 늘어난다. ConstraintLayout은 상대 제약을 이용해 hierarchy를 flat하게 유지하려는 도구이고, ViewStub은 당장 필요 없는 subtree inflation을 늦추는 도구다. 이 둘은 다른 문제를 해결한다. ConstraintLayout은 "이미 존재하는 layout tree의 깊이"를 줄이고, ViewStub은 "아직 필요 없는 View 생성을 미룬다".

### 3. Custom drawing과 image resource

Custom View를 만들 때는 View lifecycle에 맞춰 초기화, 측정, 배치, drawing, resource 해제를 설계해야 한다. Canvas는 drawing command를 수행하는 도구이고, Drawable은 재사용 가능한 drawing resource 추상화다. Bitmap은 픽셀 data를 메모리에 올리는 객체라서 가장 쉽게 memory pressure를 만든다.

큰 image를 다룰 때는 먼저 bounds만 읽고, target size에 맞춰 sampling한 뒤, memory/disk cache를 조합한다. 이 흐름을 말할 수 있어야 Q43~Q45가 하나의 답변으로 연결된다.

### 4. 고성능 list와 별도 rendering boundary

RecyclerView는 item View를 계속 새로 만들지 않고 ViewHolder를 재사용한다. SurfaceView/TextureView는 video, camera, game처럼 일반 View drawing pipeline과 다른 rendering 요구가 있을 때 선택한다. WebView는 web engine을 앱 안에 넣는 것이고, Window/PopupWindow는 View tree가 붙는 system-level 표시 boundary를 다룬다.

## 책의 전체 구조

2편은 1편의 Android Framework 계약 위에서 "화면이 실제로 어떻게 그려지는가"를 다룬다. Activity/Fragment lifecycle은 화면 owner의 lifecycle이고, 여기서 다루는 View lifecycle은 화면 내부 node의 lifecycle이다. 이후 Compose 편을 읽을 때도 이 차이가 중요하다. Compose는 View tree를 직접 조작하지 않지만, measure/layout/draw, state change, list reuse, drawing resource라는 문제 자체는 계속 남아 있다.

## 장별 독해 가이드

| 독해 묶음 | 원문 질문 | 읽는 목적 |
|-----------|-----------|-----------|
| View tree와 lifecycle | Q33, Q34, Q38 | View가 언제 붙고, 측정되고, 그려지고, 다시 그려지는지 이해 |
| Layout 최적화 | Q35, Q39, Q42 | View inflation과 layout pass 비용을 줄이는 법 이해 |
| Custom drawing/resource | Q36, Q37, Q43, Q44, Q45 | 직접 그리기와 image resource memory를 이해 |
| 고성능/특수 UI | Q40, Q41, Q46, Q47, Q48 | list, animation, surface, window, web rendering boundary 이해 |

## 질문별 답변 지도

### A. View tree와 lifecycle

#### Q33. View lifecycle을 설명하라. (p.121)

- 한 줄 답: View lifecycle은 View가 window에 attach되고, 측정/배치/그리기/입력 처리를 거쳐 detach되고 GC 대상이 되는 흐름이다.
- 핵심 근거: `onAttachedToWindow()`, `onMeasure()`, `onLayout()`, `onDraw()`, input callback, `onDetachedFromWindow()`는 각각 setup, geometry, drawing, interaction, cleanup 지점을 제공한다.
- 실무 포인트: listener, animator, observer, heavy resource는 attach/detach와 visibility를 기준으로 정리한다.
- 주의점: Activity lifecycle과 View lifecycle은 다르다. Fragment의 View는 Fragment instance보다 먼저 파괴될 수 있다.

#### Q34. View와 ViewGroup의 차이는 무엇인가? (p.126)

- 한 줄 답: View는 화면에 그려지는 leaf UI element이고, ViewGroup은 child View를 포함해 측정/배치/input dispatch를 관리하는 container다.
- 핵심 근거: TextView/Button/ImageView는 View이고, LinearLayout/FrameLayout/ConstraintLayout/RecyclerView는 ViewGroup이다. ViewGroup은 child hierarchy를 다루므로 layout cost와 event interception 책임이 추가된다.
- 실무 포인트: 깊은 nesting은 measure/layout 시간을 늘리므로 flat hierarchy와 ConstraintLayout을 고려한다.
- 주의점: ViewGroup도 View를 상속하므로 자신도 draw될 수 있지만, 핵심 책임은 child 관리다.

#### Q38. View system의 invalidation이란 무엇인가? (p.141)

- 한 줄 답: invalidation은 View의 일부 또는 전체를 다시 그려야 한다고 system에 표시하는 과정이다.
- 핵심 근거: `invalidate()`는 drawing만 다시 요청하고, `requestLayout()`은 크기나 위치가 바뀌었을 때 measure/layout까지 다시 요청한다. background thread에서는 `postInvalidate()`로 main thread에 안전하게 요청한다.
- 실무 포인트: custom View에서 paint color만 바뀌면 invalidate, measured size에 영향을 주는 text/shape가 바뀌면 requestLayout까지 고려한다.
- 주의점: 무조건 requestLayout을 호출하면 frame budget을 쉽게 초과한다.

#### Q42. Dp와 Sp의 차이는 무엇인가? (p.157)

- 한 줄 답: Dp는 density-independent pixel로 layout 크기에 쓰이고, Sp는 user font scale까지 반영하는 text 크기 단위다.
- 핵심 근거: Dp는 화면 밀도 차이를 흡수하고, Sp는 접근성 설정에 따른 글자 크기 변화를 반영한다.
- 실무 포인트: text는 기본적으로 Sp를 쓰고, font scale이 커졌을 때 깨지지 않도록 constraint, max lines, responsive layout을 설계한다.
- 주의점: UI가 깨진다는 이유로 text를 Dp로 고정하면 접근성을 해칠 수 있다.

### B. Layout 성능과 View 재사용

#### Q35. ViewStub을 사용해 UI 성능을 어떻게 최적화하는가? (p.130)

- 한 줄 답: ViewStub은 당장 필요 없는 layout subtree를 가벼운 placeholder로 두고, 실제로 필요할 때 한 번만 inflate해 initial rendering cost를 줄인다.
- 핵심 근거: ViewStub은 invisible하고 layout 공간을 거의 쓰지 않으며, `inflate()`되면 실제 View로 대체된다.
- 실무 포인트: error view, empty state, optional panel처럼 드물게 보이는 UI에 적합하다.
- 주의점: 한 번 inflate되면 ViewStub 자체는 재사용되지 않는다. 반복 show/hide UI라면 inflated View visibility를 관리한다.

#### Q39. ConstraintLayout이란 무엇인가? (p.143)

- 한 줄 답: ConstraintLayout은 View 사이의 상대 제약을 사용해 복잡한 UI를 더 flat한 hierarchy로 구성하는 ViewGroup이다.
- 핵심 근거: parent/child 또는 sibling 간 제약을 기반으로 위치와 크기를 계산해 LinearLayout/RelativeLayout nesting을 줄인다.
- 실무 포인트: 복잡한 form, responsive 화면, bias/chain/barrier가 필요한 UI에서 layout tree를 줄이는 데 유리하다.
- 주의점: constraint가 과도하게 복잡하면 읽기 어렵고 계산 비용도 생긴다. 단순 layout에는 단순 container가 낫다.

#### Q41. RecyclerView는 내부적으로 어떻게 동작하는가? (p.148)

- 한 줄 답: RecyclerView는 Adapter가 data를 ViewHolder에 bind하고, LayoutManager가 배치하며, Recycler가 화면 밖 item View를 재사용하는 list/grid container다.
- 핵심 근거: item이 스크롤로 화면 밖으로 나가면 ViewHolder가 scrap/cache/pool로 들어가고, 새 위치에 필요한 item에 다시 bind된다.
- 실무 포인트: stable id, DiffUtil/ListAdapter, payload update, 적절한 view type, image cancel/reuse 처리가 jank를 줄인다.
- 주의점: `onBindViewHolder()`에서 heavy work를 하면 재사용 모델의 이점을 잃는다.

### C. Custom drawing과 graphic resource

#### Q36. Custom View는 어떻게 구현하는가? (p.132)

- 한 줄 답: custom View는 constructor에서 attribute를 읽고, 필요한 경우 `onMeasure()`로 크기를 정하고, `onDraw()`에서 Canvas에 그리며, lifecycle에 맞춰 resource를 정리한다.
- 핵심 근거: reusable UI logic을 하나의 View에 캡슐화할 수 있지만, measure/draw/input/accessibility까지 책임져야 한다.
- 실무 포인트: allocation은 `onDraw()` 밖으로 빼고, Paint/Path/Rect 같은 객체를 재사용한다.
- 주의점: custom drawing만 구현하고 accessibility, state saving, touch handling을 빼먹으면 제품 UI로는 부족하다.

#### Q37. Canvas란 무엇이고 어떻게 활용하는가? (p.139)

- 한 줄 답: Canvas는 View의 drawing 단계에서 shape, text, bitmap, path 등을 그리는 drawing API다.
- 핵심 근거: `onDraw(canvas)` 안에서 Paint와 함께 drawLine/drawRect/drawText/drawBitmap 같은 명령을 수행한다.
- 실무 포인트: chart, signature pad, custom progress, decorative effect처럼 표준 widget으로 표현하기 어려운 UI에 쓴다.
- 주의점: Canvas drawing은 main thread frame budget 안에서 수행되므로 per-frame allocation과 복잡한 연산을 피한다.

#### Q43. Nine-patch image는 언제 쓰는가? (p.161)

- 한 줄 답: Nine-patch는 특정 영역만 늘어나도록 정의한 `.9.png`로, 버튼/말풍선/배경처럼 크기가 변해도 모서리와 padding을 유지해야 하는 raster resource에 쓴다.
- 핵심 근거: 1px guide가 stretch area와 content area를 지정해 다양한 크기에서도 자연스럽게 확장된다.
- 실무 포인트: 동적 text를 담는 배경이나 legacy raster asset을 scalable하게 써야 할 때 유용하다.
- 주의점: 단순 색상/shape라면 ShapeDrawable이나 vector가 더 관리하기 쉽다.

#### Q44. Drawable이란 무엇인가? (p.164)

- 한 줄 답: Drawable은 화면에 그릴 수 있는 graphic resource의 추상화다.
- 핵심 근거: BitmapDrawable, VectorDrawable, NinePatchDrawable, ShapeDrawable, LayerDrawable 등은 서로 다른 drawing 요구를 처리한다.
- 실무 포인트: icon은 vector, 사진은 bitmap, 단순 배경은 shape, 겹친 효과는 layer-list처럼 용도에 맞춰 선택한다.
- 주의점: 모든 이미지를 bitmap으로 처리하면 density와 memory 문제가 커진다.

#### Q45. Bitmap은 무엇이고 큰 Bitmap은 어떻게 다루는가? (p.167)

- 한 줄 답: Bitmap은 픽셀 data를 메모리에 가진 image object이고, 큰 Bitmap은 bounds 확인, sampling, cache, background decode로 다뤄야 한다.
- 핵심 근거: 화면에 필요한 크기보다 큰 원본을 그대로 decode하면 memory 낭비와 OOM 위험이 커진다.
- 실무 포인트: `inJustDecodeBounds`로 크기만 먼저 읽고, `inSampleSize`로 target size에 맞게 decode하며, LruCache/disk cache를 조합한다.
- 주의점: ImageView보다 훨씬 큰 이미지를 full decode한 뒤 scale하는 방식은 피한다.

### D. 특수 rendering, animation, window, web

#### Q40. SurfaceView와 TextureView는 언제 구분해서 쓰는가? (p.146)

- 한 줄 답: SurfaceView는 별도 surface에서 고성능 rendering이 필요할 때, TextureView는 View hierarchy 안에서 transform/animation과 함께 rendering surface를 다뤄야 할 때 쓴다.
- 핵심 근거: SurfaceView는 video/camera/game처럼 지속적 rendering에 강하고, TextureView는 일반 View처럼 alpha/rotation/translation 등과 조합하기 쉽다.
- 실무 포인트: camera preview, video player, real-time rendering 요구와 View transform 요구를 기준으로 고른다.
- 주의점: 둘 다 일반 View drawing과 다른 surface/lifecycle을 가지므로 resource release가 중요하다.

#### Q46. Animation은 어떻게 구현하는가? (p.174)

- 한 줄 답: Android View animation은 View property animation, ObjectAnimator, AnimatorSet, Transition, MotionLayout 등으로 구현한다.
- 핵심 근거: alpha/translation/scale 같은 View property는 `view.animate()`로 간단히 처리하고, 여러 property나 custom property는 ObjectAnimator/AnimatorSet을 사용한다.
- 실무 포인트: layout 변화는 Transition/MotionLayout, 단순 feedback은 property animation, 반복 frame drawing은 custom drawing이나 별도 rendering 전략을 검토한다.
- 주의점: animation이 layout pass를 과도하게 유발하거나 detached View를 참조하면 jank와 leak이 생긴다.

#### Q47. Window란 무엇인가? (p.181)

- 한 줄 답: Window는 Activity/Dialog/Popup 같은 UI가 system WindowManager에 붙는 최상위 표시 container다.
- 핵심 근거: Activity는 Window를 통해 decor view를 표시하고, WindowManager는 화면상의 window 배치, focus, input, flags를 관리한다.
- 실무 포인트: status bar, navigation bar, dialog, popup, soft keyboard, overlay 같은 주제는 Window boundary로 설명하면 명확하다.
- 주의점: View hierarchy와 Window를 혼동하면 PopupWindow/Dialog/Activity root view 관계를 설명하기 어렵다.

#### Q48. Web page는 어떻게 render하는가? (p.184)

- 한 줄 답: Android에서는 WebView로 앱 안에 web engine을 포함해 HTML, remote URL, JavaScript 기반 content를 rendering한다.
- 핵심 근거: WebView는 View이지만 web runtime과 보안 설정, navigation callback, lifecycle 처리가 별도로 필요하다.
- 실무 포인트: JavaScript enable 여부, mixed content, file access, WebViewClient/WebChromeClient, lifecycle pause/resume/destroy, AndroidX WebKit 호환성을 함께 말한다.
- 주의점: untrusted content와 JavaScript bridge를 무심코 열면 보안 취약점이 된다.

## 핵심 주장과 근거

전통 View 시스템의 핵심은 "화면은 tree이고, tree 갱신은 비용이다"라는 점이다.

- View lifecycle 질문은 attach/measure/layout/draw/detach의 의미를 묻는다.
- ViewGroup/ConstraintLayout/ViewStub/RecyclerView 질문은 tree 비용을 줄이는 방법을 묻는다.
- Canvas/Drawable/Bitmap/NinePatch 질문은 drawing resource를 어디까지 memory에 올릴지 묻는다.
- SurfaceView/TextureView/Window/WebView 질문은 일반 View pipeline을 넘어서는 rendering boundary를 묻는다.

## 실무 적용 / 생각해볼 질문

| 상황 | 실무에서의 답변 방향 |
|------|----------------------|
| custom View가 스크롤 중 버벅인다 | `onDraw()` allocation, overdraw, bitmap decode, unnecessary invalidate를 먼저 본다. |
| 화면 회전 뒤 custom View observer가 leak된다 | View attach/detach, Fragment view lifecycle, findViewTreeLifecycleOwner 기준으로 observer를 묶는다. |
| 복잡한 XML layout이 느리다 | hierarchy depth를 줄이고 ConstraintLayout, ViewStub, include/merge, lazy inflation을 검토한다. |
| 큰 이미지 list가 OOM을 낸다 | target size sampling, memory/disk cache, RecyclerView bind cancel, image loading library를 적용한다. |
| web content를 앱 안에서 보여줘야 한다 | WebView lifecycle과 security setting, navigation callback, JavaScript bridge 노출 범위를 설계한다. |

## 오해하기 쉬운 부분

- `invalidate()`와 `requestLayout()`은 같은 것이 아니다. 전자는 draw 요청, 후자는 measure/layout까지 필요한 경우다.
- View lifecycle은 Activity lifecycle과 다르다. View는 window attach/detach를 기준으로 생각해야 한다.
- ViewStub은 show/hide container가 아니라 one-time lazy inflation placeholder다.
- RecyclerView는 item data를 재사용하는 것이 아니라 item View/ViewHolder를 재사용한다.
- Bitmap은 Drawable의 한 종류로 쓸 수 있지만, 모든 graphic resource를 Bitmap으로 처리하면 안 된다.
- SurfaceView와 TextureView는 단순히 "video용 View"가 아니라 rendering surface와 View hierarchy 통합 방식이 다르다.
- WebView는 일반 TextView처럼 안전한 content renderer가 아니다. 보안 설정과 lifecycle 관리가 중요하다.

## 한 장 요약

2편을 한 문장으로 줄이면 이렇다.

> Android View 시스템은 View tree를 main thread frame 안에서 측정, 배치, 그리기, 무효화하며, 성능은 tree 깊이, drawing resource, 재사용 전략, 별도 rendering boundary를 얼마나 정확히 다루는지에 달려 있다.

암기 순서는 다음이 좋다.

1. View tree를 그린다: Window, ViewGroup, View.
2. rendering pipeline을 말한다: measure, layout, draw.
3. 갱신 요청을 구분한다: invalidate, postInvalidate, requestLayout.
4. tree 비용을 줄인다: ConstraintLayout, ViewStub, RecyclerView.
5. drawing resource를 고른다: Canvas, Drawable, NinePatch, Bitmap.
6. 특수 boundary를 설명한다: SurfaceView, TextureView, Window, WebView.

## 참고자료

- 원문: Jaewoong Eum, `Manifest Android Interview: The Ultimate Guide`, Category 1: Android UI - Views, p.121~187.
- Android Developers, Custom drawing.
- Android Developers, RecyclerView.
- Android Developers, Improve layout performance.
- Android Developers, WebView.
