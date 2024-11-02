---
layout: single
title:  "Singleton approach in python"
date:   2023-01-06 11:56:13 +0900
categories: python language
toc: true
toc_sticky: true
tags: python
comments: true
enable_copy_code_button: true

---


c++ 의 경우에 보통 static variable 을 이용해서 구현하는 것이 일반적인데 반해 python 에서 singleton 을 구현하는 방법은 딱히 idiomatic 하게 정해져있지 않다. 
static 변수나 전역 변수를 만드는 것은 그렇게 유쾌한 경험을 제공해주지 않는다.   
결론부터 말하자면 참고하는 문서에서는 Metaclass 방식을 가장 선호하는 방법으로 추천한다. 테스트하기에 좋기 때문. 

## 구현 후보

### Metaclass

생성시에 class 를 변경할 수 있는 특별한 방법을 제공. 어떤 class 로 instance 를 생성한 것이 있다면 instance 를 또 생성하지 않게 하는 metaclass 를 만들 수 있음 .

```python
class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(type(cls), cls).__call__(*args, **kwargs)
        return cls._instances[cls]

class _A():
    def __init__(self, name):
        self.name = name


class A(_A, metaclass=Singleton):
  pass
```

### Decorator

decorator 를 이용해서도 구현할 수 있음. 
```python

def singleton(class_):
    instances = {}

    def get_instance(*args, **kwargs):
        if class_ not in instances:
            instances[class_] = class_(*args, **kwargs)
        return instances[class_]

    return get_instance


@singleton
class A:
    def __init__(self, name):
        self.name = name



```

### Classic singleton ( allocation) 

원래 클래스가 제공하는 기능인 `__new__` 메소드를 이용. 

```python


class A:
    initialized = False
    name = None

    def __init__(self, name):
        if not self.initialized:
            self.name = name
            self.initialized = True

    def __new__(cls, url, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(Database, cls).__new__(cls, *args, **kwargs)
        return cls._instance




```

## 장단점 비교

* Metaclass
  * 장점
    * test 를 할 때 singleton 기능없이 순순하게 해당 class 가 잘 동작하는지 구분해서 확인해볼 수 있음. 
    * 예를 들면 _A 에 대한 객체를 하나 생성해서 기능 테스트 가능
  * 단점
    * decorator 에 비해 `metaclass=` 의 인자를 넣어줘야한다는 것이 귀찮음
* Decorator
  * 장점
    * 여러 클래스에 쉽게 적용하기 좋음
    * 코드 양이 가장 적음
  * 단점
    * test 시에 singleton 특성을 분리하기 어려움. 
* Classic
  * 장점
    * 초창기 python 의 문법만 알고있어도 구현을 이해하는데 문제 없음
  * 단점
    * 코드가 지저분함
    * 여러 클래스에 적용하기 어려움

## 참고

https://itnext.io/deciding-the-best-singleton-approach-in-python-65c61e90cdc4

