---
layout: single
title:  "Singleton in python"
date:   2023-01-10 15:30:09 +0900
categories: python
toc: true
toc_sticky: true

---

# Singleton pattern

디자인 패턴 중 가장 유명한 패턴인Signleton 을 사용할 필요가 있어서 찾아보았으나
builtin 에서 이런 기능을 제공하지 않음.

# How

Paulo Barbosa 가 쓴 article 에서 사용하기 좋은 Singleton pattern 구현법을 적어놓았음.
세 가지 방식이 있는데
decorator, metaclass, classical method 가 있음.
metaclass, decorator 둘 다 비슷하게 좋기 때문에 둘 중 어느 것을 사용해도 좋을 것 같음.
저자는 test 에서 사용하기에 metaclass 가 더 쉽기 때문에 best 를 metaclass 로 꼽았음.

[Paulo Barbosa's article](https://itnext.io/deciding-the-best-singleton-approach-in-python-65c61e90cdc4)
https://realpython.com/python-super/
