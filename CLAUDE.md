# CLAUDE.md - Jekyll 기술 블로그 가이드

## 프로젝트 개요

Jekyll 기반 GitHub Pages 기술 블로그. minimal-mistakes 테마(neon 스킨) 사용.

- **URL**: https://m1ser4ble.github.io/
- **주요 주제**: 리버싱, Rust, Python, Bazel, 시스템 프로그래밍

## 디렉토리 구조

```
_posts/          # 블로그 포스트 (YYYY-MM-DD-title.markdown)
_layouts/        # 커스텀 레이아웃 (archive-*.html)
_includes/       # 커스텀 컴포넌트 (postbox, masthead 등)
_archives/       # 자동 생성 아카이브 (수정 금지)
_data/           # 네비게이션 등 설정 (navigation.yaml)
_sass/           # 커스텀 스타일
assets/          # 이미지 및 정적 파일
```

## 새 포스트 작성

### 파일명 규칙
```
_posts/YYYY-MM-DD-slug.markdown
```

### Front Matter 템플릿
```yaml
---
layout: single
title: "포스트 제목"
date: YYYY-MM-DD HH:MM:SS +0900
categories: [category-name]
toc: true
toc_sticky: true
---
```

### 주요 카테고리
- `reversing` - 리버싱, crackmes, VM protection, 바이너리 분석
- `rust` - Rust 프로그래밍
- `python` - Python 프로그래밍
- `bazel` - Bazel 빌드 시스템
- `bevy` - Bevy 게임 엔진
- `cpp` - C++ 프로그래밍
- `csharp` - C# / ASP.NET 개발
- `system` - 시스템 설계, Streaming Systems
- `tools` - Vim 등 개발 도구
- `jekyll` - Jekyll 블로그 관련

### 이미지 삽입
```html
<img src="{{site.baseurl | prepend: site.url}}assets/image_name.png" />
```
이미지 파일은 `assets/` 디렉토리에 저장.

## 로컬 개발

```bash
# 의존성 설치
bundle install

# 로컬 서버 실행 (http://localhost:4000)
bundle exec jekyll serve

# 빌드만 수행
bundle exec jekyll build
```

## 주의사항

1. **_archives/ 수정 금지**: GitHub Actions가 자동 생성. 직접 수정 불필요.

2. **_config.yml 수정 시**: 로컬 서버 재시작 필요.

3. **GitHub Actions**: `_posts/` 변경 시 아카이브 자동 갱신됨.

## 테마 커스터마이징

- 스킨: `minimal_mistakes_skin: "neon"` (_config.yml)
- 네비게이션: `_data/navigation.yaml`
- 스타일 오버라이드: `_sass/minimal-mistakes/`

## 커밋 메시지 컨벤션

```
# 새 포스트
Add post: [포스트 제목]

# 포스트 수정
Update post: [포스트 제목]

# 설정/테마 변경
Update config: [변경 내용]
```
