---
layout: single
title:  "Deep Dive super() in Python"
date:   2023-01-06 11:56:13 +0900
categories: python
excerpt: "Python의 super() 함수와 MRO(Method Resolution Order) 심층 분석"
toc: true
toc_sticky: true
tags: python
---


어느 언어에서든 super 는 상속하는 parent class 를 가져오는 keyword 다. single inheritance 인 경우밖에 없다면 이 문서를 작성할 필요도 없었을텐데, 복잡한 인자를 사용한 경우를 만났는지 링크를 남겨두었고, 미래의 내가 문서를 작성하고 있다.

## bound/unbound method

- bound method
  - 어떤 클래스에 속해있는 메소드
- unbound method
  - class instance 를 인자로 받지 않는 메소드
  - 파이선 3으로 올라오면서 사라진 개념임
  - instance 를 받지 않는 것은 static_method 로서 만들수는 있음.

```python
# adding a method to existing object
>>> def bar(self):
...      print ("bar")
... 
>>> 
>>> 
>>> bar
<function bar at 0x1033828e0>
>>> class A:
...      pass
...      
>>> 
>>> A.bar=bar
>>> A.bar
<function bar at 0x1033828e0>
>>> A.bar= bar.__get__(A)
>>> 
>>> A.x
<bound method bar of <class '__main__.A'>>

```

## Descriptor

https://docs.python.org/3.7/howto/descriptor.html

## Multiple Inheritance

`Cube` → `Square` → `Rectangle` 의 상속 관계에서 Cube 에서 Rectangle 의 area 가 아닌 Square 의 area method 를 사용하고 싶은 경우 아래와 같이 사용할 수 있다.

```python
class Cube(Square):
    def surface_area(self):
        face_area = super(Square, self).area()
        return face_area * 6
```

보통 multiple inheritance 라고 하면 이런 형태의 연쇄 상속이 아니고 아래와 같은 형태일 것이다.

```
superclass1 superclass2
      \          /
        subclass 
```

모든 superclass 가 .area 메소드를 정의하고 있다면 python 은 super().area() 를 호출했을 때 어떤 것을 가져올까?

`method resolution order` 가 결정해줄 것이다.

## Method Resolution Order

모든 클래스는 `.__mro__` attribute 을 지니고 있다. 이는 super() 를 했을 때 어떤 class 를 우선적으로 탐색해서 가져올지 알려준다.

```python
class RightPyramid(Triangle, Square):
    def __init__(self, base, slant_height):
        self.base = base
        self.slant_height = slant_height

    def area(self):
        base_area = super().area()
        perimeter = super().perimeter()
        return 0.5 * perimeter * self.slant_height + base_area
```

위의 코드에서 RightPyramid 의 상속 구문에서 Triangle 이 더 앞에 있기 때문에 mro 는 우선적으로 Triangle 을 찾게 될 것이다.
또, Square 가 Rectangle 을 상속했기 때문에 Square 를 우선적으로 볼 것이다.

```python
>>> RightPyramid.__mro__
(<class '__main__.RightPyramid'>, <class '__main__.Triangle'>, 
 <class '__main__.Square'>, <class '__main__.Rectangle'>, 
 <class 'object'>)

```

그러니... mro 에 의존할 것이 아니고 super 를 사용할 때 사용할 class 를 명시하는 게 권장될 것 같다.

## Reference

- [GeeksforGeeks - Bound/Unbound Method](https://www.geeksforgeeks.org/bound-unbound-and-static-methods-in-python/)
- [Real Python - Deep Dive super()](https://realpython.com/python-super/)
