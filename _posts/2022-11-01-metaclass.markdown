---
layout: single
title:  "Metaclass"
date:   2022-05-29 15:30:09 +0900
categories: python
toc: true
toc_sticky: true
tags: python

---

# metaclass

metaprogramming 이란 프로그램이 스스로를 조작할 가능성이 있거나 스스로에 대한 지식이 있는 것을 의미한다

python 은 클래스에 대한 metaprogramming 을 지원하고 있는데 이를 metaclass 라고 함.

이 Metaclass 는 난해한 OOP 개념인데, 사실상 모든 python code 에 숨어있다고 보면 됨. 즉, metaclass 에 알든 모르든 metaclass 를 사용하고 있는 셈.

Tim Peters 는 custom metaclass 에 대해 이렇게 말했다.

> 메타 클래스는 99퍼 유저들이 걱정할만한 것들보다 훨씬 심오한 매직이다.
메타클래스가 필요한 지 모르겠다면 필요하지 않은 것임. (정말 필요한 사람들은 이미
메타클래스가 필요하다는 확신을 갖고 있으며 왜인지에 대한 설명이 필요하지 않음)


이렇듯 대부분의 케이스에서 메타클래스는 필요하지 않음.  	그럼에도 메타클래스에 대해
이해하는 것은 일반적으로 python internals 를 이해하는 데 도움이 되기 때문에 유익함.
그리고 언젠가 custom metaclass 가 필요한 순간이 찾아올 수 있기 때문임.

# Class styles

python 에서 class 를 만드는 법은 두 개가 있는데 편의상 Old-style class, New-style class 라고 지칭하고 있음.

## Old-style class

class 와 type 이 같다고 할 수 없음. old style class 의 instance 는 instance 라는 타입의 single built-in type 으로 구현됨.
obj 가 old style class 의 instance 라면 obj.__class__ 가 클래스를 지정하지만,
type(obj) 는 항상 instance 임. 이런 old-style class 는 python3 이전에서는 볼 수 있었지만,
python 3으로 넘어가면서 모두 new-style class 로 변경됐으니 아래 코드는 python 2.x 에서 확인
하도록

```
class Foo:
	pass

x = Foo()
x.__class__ #
type(x) #

```

## New-style class

old-style 과 달리 type(obj) 와 obj.__class__ 가 같음.


python 에서 모든 것은 object 라는 말이 있다. class 역시 object 인데 이는 type 의 instance 다.
따라서 type 은 metaclass 가 된다.


# type

built-in function 인 type 은 인자를 하나 받으면 그 인자로 넘어온 object 의 타입을 리턴해줌.

new-style class 에 대해서는 일반적으로 object.__class__ 속성과 동일한 값을 내어줌.

인자를 세 개 줘서 다음과 같이 호출할 수도 있는데 그 경우 다음과 같은 인자들을 넘겨주어야함.

type(<name>, <bases>, <dct>):

* <name> : 클래스 이름. __name__ 속성이 될 것
* <bases> : class 가 상속할 base class 의 tuple. __bases__ 속성이 될 것.
* <dct> : class body 에 대한 정의를 담고 있는 namespace dictionary.  __dict__ 속성이 될 것

이와 같은 호출 방법이 type metaclass 의 새 instance 를 만들어내는 법이다. 즉, 동적으로
새로운 class 를 생성할 수 있는 셈이다.



# custom metaclass


```
>>> class Foo:
...     pass
...
>>> f = Foo()
```

위 코드에서 Foo() 를 interpreter 가 만나게되면 Foo parent class 의 __call__() 를 호출하게 되고,
parent class 는 type 이기 때문에 type.__call__() 가 호출됨.
이 type.__call__() 는 __new__() 와 __init__() 를 호출하게 됨.

그럼 내가 모든 class 들에 대한 __new__() 를 수정하고 싶다고 하면 다음과 같이 코드를 구성할 수 있다.



```
>>> def new(cls):
...     x = type.__new__(cls)
...     x.attr = 100
...     return x
...
>>> type.__new__ = new
```

하지만 이 코드는 먹히지 않는다. python 에서 막아뒀다. 그럼 더이상 방법이 없는가?
원하는 모든 클래스들마다 __new__ 를 수정해줘야하는건가?
custom meta class 를 이용하면 어느정도 작업이 쉬워진다.

```
>>> class Meta(type):
...     def __new__(cls, name, bases, dct):
...         x = super().__new__(cls, name, bases, dct)
...         x.attr = 100
...         return x
>>> class Bar(metaclass=Meta):
...     pass
...
>>> class Qux(metaclass=Meta):
...     pass
...
>>> Bar.attr, Qux.attr
(100, 100)

```
이렇게 type 을 상속하는  custom meta class 를 만들고 원하는 클래스들은
type 이 아닌 custom meta class 를 사용하도록 지정해줌.
이렇게 class 를 생성할 때 도움을 주기 때문에 class factory 로도 알려져있음.
( class 가 object factory 로 불림. )

그런데, 위와 같은 용례는 굳이 메타클래스를 이용하지 않더라도 다른 방식으로 우회할 수 있다.
inheritance + class decorator 를 사용하면 됨.


(realpython.com)[https://realpython.com/python-metaclasses/]
(StackOverflow)[https://stackoverflow.com/questions/100003/what-are-metaclasses-in-python]
