---
layout: single
title:  "Reversing Yes24 epub"
date:   2023-04-08 11:56:13 +0900
categories:
toc: true
toc_sticky: true
tags: python
comments: true
---


# Introduction

Yes24 에서 책을 구매하면 표준 epub 으로 제공한다고 명시되어있음. 하지만 막상 책을 구매하고 epub 을
다른 e-book reader 기에 넣으면 읽을 수 없음. 왜냐면 DRM 이 걸려있기 때문.
epub 형식은 대충 설명하자면 .epub 파일 속에 아래 사진처럼
machine learning 에서 무수히 많은 iteration 을 거의 동일한 연산을 통해서 반복해가며 학습하게 된다.
이 때 굉장히 많은 데이터를 input 으로 연산을 하게되는데, 이 연산을 수행하는 시간을 줄이고
이 방대한 데이터를 memory efficient 하게 사용하기 위해서 병렬화를 해야한다.
병렬화 기법에는 다음과 같은 방식들이 존재한다.

* DataParallel (DP) - N 개의 batch 를 M 개의 device 에 적절히 분배해서 처리하는 병렬화 기법
batch(input) 을 분배했기 때문에 parameter 들은 각 device 에 동일하게 존재해야함.
* TensorParallel (TP) - batch 가 아닌 텐서가 M 개의 chunk 로 분할돼서 할당된다. 병렬적으로 처리되고 난 뒤 다시 결과를 sync up 한다. horizontal level 로 분할이 일어나기 때문에 horizontal parallelism 이라고도 불림
each tensor is split up into multiple chunks, so instead of having the whole tensor reside on a single gpu, each shard of the tensor resides on its designated gpu. During processing each shard gets processed separately and in parallel on different GPUs and the results are synced at the end of the step. This is what one may call horizontal parallelism, as the splitting happens on horizontal level.

PipelineParallel (PP) - the model is split up vertically (layer-level) across multiple GPUs, so that only one or several layers of the model are places on a single gpu. Each gpu processes in parallel different stages of the pipeline and working on a small chunk of the batch.

Zero Redundancy Optimizer (ZeRO) - Also performs sharding of the tensors somewhat similar to TP, except the whole tensor gets reconstructed in time for a forward or backward computation, therefore the model does’t need to be modified. It also supports various offloading techniques to compensate for limited GPU memory.

Sharded DDP - is another name for the foundational ZeRO concept as used by various other implementations of ZeRO.

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

2. 다른 python interpreter 를 사용해봐라. python interpreter implementation 으로는 CPython, Jython, IronPython, PyPy 등이 있는데 GIL 은 original python implementation 인 CPython 에만 존재함.

3. CPython 에서 GIL 을 제거하는 작업이 진행중이기 때문에 이런 것들을 기다려봐라


# Refernce

[DeepSpeed](https://github.com/microsoft/DeepSpeed)

[graphical images](https://colossalai.org/docs/concepts/paradigms_of_parallelism/)
[hugging face](https://huggingface.co/transformers/v4.9.0/parallelism.html)
[Megatron-LM](https://arxiv.org/pdf/1909.08053.pdf)
[ZeRO](https://arxiv.org/pdf/1910.02054.pdf)

