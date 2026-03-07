---
layout: post
title: RL
date: 2025-08-22 16:20 +0900
description:
category:
tags:
---


Aug


ARCore
ARSceneView


Session: The active AR state,  managing tracking and interaction

Frame: snapshot of AR environment,updated continuously

Tracking: digital content tables 를 유저 이동에 따라 유지함

Hit test: screen tap 기반으로 표면감지
Anchor: 

Depth mode: 
Light estimation: 


3d model loader
material loader


Full space: immersive experience ㅜㅈ기 위해 3d space 에서 모든걸 다 제어할수잇느거?
여기에 들어오면 다른 앱들은 hidden ehla. 
session.scene.spatialEnvironment.requestFullSpaceMode() 로 적용가능

full space mode 에서도 passthrough 를 이용해서 AR 로서 동작할수도 있고 VR 로서도 동작하게 할 수 있음. 

Home space: 2d space 에서 그리는거


Geometry;
Skybox;

Stereoscopic; 
JetpackSceneCore; 

Entity; 
session;

monoscopic ; 양안이 모두 같은 이미지 -> depth 없음
