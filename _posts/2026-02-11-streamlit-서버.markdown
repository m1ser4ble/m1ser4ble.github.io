---
layout: single
title: "Streamlit Server"
date: 2026-02-11 11:20:00 +0900
categories: backend
excerpt: "Streamlit Server은/는 ``` Streamlit = Stream + Lit └── "데이터 스트림을 밝히다(lit)" 라는 의미로 추정 └── 공식적인 약자는 아님, 브랜드명"
toc: true
toc_sticky: true
tags: [Streamlit, Server]
---

# TL;DR
- **Streamlit Server의 핵심 개념과 사용 범위를 한눈에 정리**
- **등장 배경과 필요한 이유를 짚고 실무 적용 포인트를 연결**
- **주요 특징과 체크리스트를 빠르게 확인**

---

## 1. 개념
``` Streamlit = Stream + Lit └── "데이터 스트림을 밝히다(lit)" 라는 의미로 추정 └── 공식적인 약자는 아님, 브랜드명

## 2. 배경
Streamlit Server이(가) 등장한 배경과 기존 한계를 정리한다.

## 3. 이유
이 주제를 이해하고 적용해야 하는 이유를 정리한다.

## 4. 특징
- 약자/이름
- 역사
- 재실행 모델 (핵심!)
- 설치 및 실행
- Hello World

## 5. 상세 내용

> **작성일**: 2026-01-28
> **카테고리**: Backend / Python / Web Framework
> **포함 내용**: Streamlit, 데이터 앱, 대시보드, Session State, 캐싱

---

# 1. Streamlit이란?

## 약자/이름

```
Streamlit = Stream + Lit
            └── "데이터 스트림을 밝히다(lit)" 라는 의미로 추정
            └── 공식적인 약자는 아님, 브랜드명

정체: Python 기반 웹 앱 프레임워크
용도: 데이터 앱, 대시보드, ML 데모를 빠르게 만들기
```

---

# 2. 등장 배경

```
┌─────────────────────────────────────────────────────────┐
│                  데이터 과학자의 고통                     │
│                                                         │
│  "모델 만들었는데... 이걸 어떻게 보여주지?"              │
│                                                         │
│  전통적인 방법:                                         │
│  ├── Flask/Django로 웹 앱 개발 → 프론트엔드 필요        │
│  ├── HTML/CSS/JavaScript 학습 → 본업이 아님            │
│  ├── React/Vue 배우기 → 시간 오래 걸림                 │
│  └── 결국 Jupyter Notebook 공유 → 인터랙티브 부족       │
│                                                         │
│  데이터 과학자가 원하는 것:                             │
│  "Python만으로 웹 앱 만들고 싶다!"                      │
│  "프론트엔드 몰라도 대시보드 만들고 싶다!"              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 역사

```
2018: Streamlit 창업 (Adrien Treuille 외)
      └── 전 Google/CMU 연구원들
      └── "데이터 앱을 10배 빠르게"

2019: 오픈소스로 공개
      └── 폭발적인 인기
      └── Python 생태계와 완벽 호환

2022: Snowflake가 인수 (~$800M)
      └── 데이터 클라우드 + 시각화 결합

현재: 데이터 앱의 사실상 표준 중 하나
```

---

# 3. Streamlit의 핵심 철학

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. "Python 스크립트 = 웹 앱"                           │
│     └── .py 파일 하나가 곧 앱                           │
│                                                         │
│  2. "위에서 아래로 실행"                                │
│     └── 스크립트처럼 순차 실행                          │
│     └── 사용자 입력 시 전체 재실행                      │
│                                                         │
│  3. "프론트엔드 코드 제로"                              │
│     └── HTML/CSS/JS 필요 없음                          │
│     └── Python 함수 호출만으로 UI 생성                  │
│                                                         │
│  4. "즉각적인 핫 리로드"                                │
│     └── 코드 저장하면 바로 반영                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 4. Streamlit Server 동작 방식

```
┌─────────────────────────────────────────────────────────┐
│                  Streamlit 아키텍처                      │
│                                                         │
│   ┌─────────────┐         ┌─────────────────────┐      │
│   │   Browser   │◄──────►│  Streamlit Server   │      │
│   │  (React앱)  │ WebSocket│    (Python)        │      │
│   └─────────────┘         └──────────┬──────────┘      │
│                                      │                  │
│                                      ▼                  │
│                              ┌──────────────┐          │
│                              │   app.py     │          │
│                              │ (사용자 코드) │          │
│                              └──────────────┘          │
│                                                         │
│  동작 순서:                                             │
│  1. 사용자가 localhost:8501 접속                        │
│  2. 서버가 app.py 실행                                  │
│  3. 실행 결과를 브라우저로 전송                         │
│  4. 사용자가 버튼 클릭 등 인터랙션                      │
│  5. 서버가 app.py 전체 재실행                           │
│  6. 변경된 부분만 브라우저에 업데이트                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 재실행 모델 (핵심!)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Streamlit의 독특한 실행 모델:                          │
│                                                         │
│  일반 웹 프레임워크:                                    │
│  ├── 이벤트 핸들러 등록                                 │
│  ├── 버튼 클릭 → 해당 핸들러만 실행                    │
│  └── 상태 직접 관리                                     │
│                                                         │
│  Streamlit:                                             │
│  ├── 스크립트 전체가 하나의 단위                        │
│  ├── 버튼 클릭 → 전체 스크립트 재실행                  │
│  ├── st.session_state로 상태 유지                      │
│  └── 변경된 위젯만 브라우저에서 업데이트               │
│                                                         │
│  장점: 단순함, 예측 가능                                │
│  단점: 복잡한 앱에서 성능 이슈 가능                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 5. 기본 사용법

## 설치 및 실행

```bash
# 설치
pip install streamlit

# 앱 실행
streamlit run app.py

# 기본 포트: 8501
# 접속: http://localhost:8501
```

## Hello World

```python
# app.py
import streamlit as st

st.title("Hello Streamlit!")
st.write("이게 전부입니다. 웹 앱 완성!")
```

## 주요 컴포넌트

```python
import streamlit as st
import pandas as pd

# 텍스트
st.title("제목")
st.header("헤더")
st.subheader("서브헤더")
st.text("일반 텍스트")
st.markdown("**마크다운** 지원")

# 입력 위젯
name = st.text_input("이름을 입력하세요")
age = st.slider("나이", 0, 100, 25)
agree = st.checkbox("동의합니다")
option = st.selectbox("선택", ["A", "B", "C"])

# 버튼
if st.button("클릭!"):
    st.write("버튼이 클릭되었습니다!")

# 데이터 표시
df = pd.DataFrame({"col1": [1, 2, 3], "col2": [4, 5, 6]})
st.dataframe(df)  # 인터랙티브 테이블
st.table(df)      # 정적 테이블

# 차트
st.line_chart(df)
st.bar_chart(df)

# 사이드바
st.sidebar.title("사이드바")
st.sidebar.selectbox("필터", ["전체", "일부"])
```

---

# 6. 상태 관리 (Session State)

```python
import streamlit as st

# 세션 상태 초기화
if 'counter' not in st.session_state:
    st.session_state.counter = 0

# 버튼 클릭 시 카운터 증가
if st.button("증가"):
    st.session_state.counter += 1

st.write(f"카운터: {st.session_state.counter}")

# 왜 필요한가?
# → 스크립트가 매번 재실행되므로
# → 일반 변수는 초기화됨
# → session_state는 세션 동안 유지
```

---

# 7. 캐싱 (성능 최적화)

```python
import streamlit as st
import pandas as pd

# 데이터 로딩 캐싱 (재실행해도 다시 로드 안 함)
@st.cache_data
def load_data():
    return pd.read_csv("huge_file.csv")  # 한 번만 실행

# ML 모델 캐싱
@st.cache_resource
def load_model():
    return load_heavy_ml_model()  # 한 번만 로드

df = load_data()  # 캐시된 데이터 사용
model = load_model()  # 캐시된 모델 사용
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  @st.cache_data     : 데이터 캐싱 (직렬화 가능한 것)    │
│                       DataFrame, dict, list 등          │
│                                                         │
│  @st.cache_resource : 리소스 캐싱 (직렬화 불가능)       │
│                       ML 모델, DB 연결 등               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 8. Streamlit vs 다른 도구들

```
┌─────────────────────────────────────────────────────────┐
│                        비교                              │
│                                                         │
│  도구          │ 특징                │ 용도             │
│  ─────────────┼────────────────────┼─────────────────  │
│  Streamlit    │ Python만, 빠른개발 │ 데이터앱, 프로토  │
│  Gradio       │ ML 데모 특화       │ 모델 데모         │
│  Dash         │ 더 세밀한 제어     │ 기업용 대시보드   │
│  Flask        │ 범용 웹 프레임워크 │ API 서버, 웹앱    │
│  Django       │ 풀스택 프레임워크  │ 대규모 웹 서비스  │
│                                                         │
│  Streamlit 선택 기준:                                   │
│  ✅ 빠른 프로토타입                                     │
│  ✅ 데이터 시각화/대시보드                              │
│  ✅ ML 모델 데모                                        │
│  ✅ 내부 도구                                           │
│  ❌ 대규모 프로덕션 웹 서비스                           │
│  ❌ 복잡한 사용자 인증/권한                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# 9. 배포 옵션

```
┌─────────────────────────────────────────────────────────┐
│                    배포 방법                             │
│                                                         │
│  1. Streamlit Cloud (공식)                              │
│     └── GitHub 연동, 무료 티어 있음                     │
│     └── streamlit.io/cloud                              │
│                                                         │
│  2. Docker                                              │
│     └── 컨테이너로 패키징                               │
│     └── 어디서든 실행 가능                              │
│                                                         │
│  3. 클라우드 서버                                       │
│     └── EC2, GCP, Azure 등                              │
│     └── streamlit run app.py --server.port 80          │
│                                                         │
│  4. Kubernetes                                          │
│     └── 스케일링 필요 시                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Docker 예시

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.address", "0.0.0.0"]
```

---

# 10. 정리

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Streamlit = Python으로 웹 앱을 만드는 가장 쉬운 방법   │
│                                                         │
│  핵심 특징:                                             │
│  ├── Python 스크립트 = 웹 앱                            │
│  ├── 프론트엔드 코드 불필요                             │
│  ├── 데이터 과학자 친화적                               │
│  └── 빠른 프로토타이핑                                  │
│                                                         │
│  동작 원리:                                             │
│  ├── 사용자 인터랙션 → 스크립트 전체 재실행             │
│  ├── session_state로 상태 유지                         │
│  ├── 캐싱으로 성능 최적화                               │
│  └── WebSocket으로 실시간 업데이트                      │
│                                                         │
│  비유:                                                  │
│  "Jupyter Notebook + 웹 UI = Streamlit"                 │
│  "데이터 과학자를 위한 React"                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`Streamlit`, `Python`, `데이터 앱`, `대시보드`, `Session State`, `캐싱`, `WebSocket`, `Gradio`, `Dash`
