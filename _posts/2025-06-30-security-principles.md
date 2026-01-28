---
layout: post
title: "[THM] Security Principles"
date: 2025-06-30 18:31 +0900
description:
category: security
tags: [theory, cia]
excerpt: ""
---

## CIA

보안 삼각 원칙

* 기밀성(confidentiality): 오직 인가된 사람만이 데이터에 접근할 수 있도록 보장함
* 무결성(integrity): 데이터가 변경되지 않도록 보장하며, 변경이 발생한 경우 이를 탐지할 수 있어야 함
* 가용성(availability): 시스템이나 서비스가 필요할 때 언제든 사용할 수 있도록 보장함

더 나아가 Pakerian Hexad 라는 것도 있음.
CIA 에 다음의 3요소를 더함

* 진위성(Authenticity)
* 유용성(Utility): 정보의 사용 가능성에 대한 개념이다. 예를 들어, 암호화된 노트북을 가지고 있지만 복호화 키를 잃어버렸다면, 노트북과 디스크는 그대로 있어도 정보는 쓸 수 없게 된다. 즉, 형식상 가용하더라도 실질적으로 무용지물이면 유용성이 없다고 본다.
* 소유권(Possession): 정보가 무단으로 탈취, 복사, 제어당하지 않도록 보호하는 것을 의미한다. 예를 들어, 공격자가 백업 드라이브를 탈취했다면, 우리는 그 정보를 더 이상 보유하고 있다고 말할 수 없게 된다. 또는, 공격자가 랜섬웨어를 통해 데이터를 암호화했다면, 해당 데이터의 실질적 제어권을 상실한 것이므로 소유권을 잃은 것이다.

## DAD

공격자 입장에서 CIA 를 깨뜨리는 3요소는 DAD 임.

* Disclosure(노출) : 기밀성의 반대개념.
* Aleratation (변경 ) : 무결성의 반대개념.
* Destruction/Denial : 가용성의 반대개념
