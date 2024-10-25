______________________________________________________________________

## layout: single title:  "Terminology used in ML field" date:   2023-04-09 11:56:13 +0900 categories: toc: true toc_sticky: true tags: ml comments: true

# Introduction

나이먹고 멍청한 탓에 자꾸 까먹게돼서 여기에 정리하기 위해 만든 페이지

# Terms

pre-train , fine-tune : 생성형 모델 분야에서 사용되는 용어로 보임.
[Reducing the Dimensionality of Data with Neural Networks](https://www.scinapse.io/papers/2100495367) 에서 pre-train, fine-tune 기법이 사용된 걸 확인했는데 최초인지는 모르겠음. 본 논문에서는 RBM 을 이용하는 논문인데 그 이론에 대해서는 (https://angeloyeo.github.io/2020/10/02/RBM.html) 참고
[](https://www.cs.ubc.ca/~amuham01/LING530/papers/radford2018improving.pdf) 이 논문도 참고해보면 좋을 것 같음.

> We employ a two-stage training procedure. First, we use a language modeling objective on
> the unlabeled data to learn the initial parameters of a neural network model. Subsequently, we adapt
> these parameters to a target task using the corresponding supervised objective.

# Data Parallelism

# Model Parallelism

Python Global Interpreter Lock 의 약자로 간단히 말하면 mutex 라고 볼 수 있다.

python interpreter 에 대한 제어를 한 thread 만 가질 수 있게 해주는 메커니즘

```
import sys
a = []
b = a
sys.getrefcount(a)
```

python object 들은 모두 reference counting 을 사용하고 있음. refernce 가 0 이 되면

garbage collector 가 메모리를 해제하는 메모리 관리 기법을 사용하고 있다.

그런데 멀티 스레드에서 reference count 의 증감이 확실하게 보장되지 않으면 이 메모리 관리 시스템도

문제가 된다. 그러면 각 object 마다 lock 을 두어서 증감에 대한 내용을 확실하게 보장하면 될까?

메모리와 computation 에서 엄청난 손실이 있고 심지어는 데드락이 발생할 수 있기 때문에 그럴 수는 없다.

GIL 은 interpreter 에 대한 single lock 이다. python byte code 실행을 하려면 이 interpreter lock 을 얻어야한다는 rule 을 만든 것이다.

code 에 critical section 을 걸어버렸다고 생각하면 무난함.

따라서 cpu bound 작업에는 취약하고 io bound 에는 영향이 없는 방식임.

thread-safe 하지 못한 c library 들도 가져오면 thread safe 하게 되어버리기 때문에 통합하기에 편리하다는 이점이 있었다고 함.

그러나 OS 에서 multi-thread 를 지원하게 되고 점점 대중화되어가다보니 개발자의 불평이 많았던 모양

하지만 python developer 들 입장에서도 backward compatibility 를 해칠 가능성이 있는 change 를 하기 쉽지 않음.

이미 GIL 을 없애는 시도를몇 번 했었지만 C extension 을 망가뜨리는 결과를 초래했다.

GIL 을 없애도 문제가 없던 솔루션들이 있었지만 performance 저하가 있거나 사용하기 어려웠나보다.

정 GIL 이 마음에 안들거든 사용해볼 만한 옵션들이 다음과 같이 있다고 한다.

1. multi-threading 이 아닌 multi-processing  으로 해봐라.

1. 다른 python interpreter 를 사용해봐라. python interpreter implementation 으로는 CPython, Jython, IronPython, PyPy 등이 있는데 GIL 은 original python implementation 인 CPython 에만 존재함.

1. CPython 에서 GIL 을 제거하는 작업이 진행중이기 때문에 이런 것들을 기다려봐라

# Refernce

[DeepSpeed](https://github.com/microsoft/DeepSpeed)

[graphical images](https://colossalai.org/docs/concepts/paradigms_of_parallelism/)
[hugging face](https://huggingface.co/transformers/v4.9.0/parallelism.html)
[Megatron-LM](https://arxiv.org/pdf/1909.08053.pdf)
[ZeRO](https://arxiv.org/pdf/1910.02054.pdf)
