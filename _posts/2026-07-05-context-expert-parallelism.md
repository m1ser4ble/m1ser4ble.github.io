---
layout: single
title: "Context Parallelism과 Expert Parallelism: Long Context와 MoE를 쪼개는 두 축"
date: 2026-07-05 13:25:00 +0900
categories: mlops
excerpt: "Context Parallelism은 sequence/context length 축을 나눠 long-context attention의 activation/KV 부담을 줄이고, Expert Parallelism은 MoE expert 축을 나눠 sparse FFN 계산을 여러 GPU로 분산한다."
toc: true
toc_sticky: true
tags: [context-parallelism, expert-parallelism, moe, attention, gqa, mla, kv-cache, vllm, megatron]
source: "Discord thread: 병렬화, NVIDIA Megatron-Core docs, vLLM docs"
---

TL;DR
- Context Parallelism(CP)은 긴 sequence를 여러 GPU에 나눠 long-context training/prefill의 activation memory와 attention 계산 부담을 줄이는 방식이다.
- CP는 FlashAttention과 같은 "block-wise attention + online softmax" 계열 감각을 공유하지만, 본질은 single-GPU kernel 최적화가 아니라 multi-GPU sequence sharding과 KV communication이다.
- Expert Parallelism(EP)은 MoE layer의 expert FFN들을 여러 GPU에 나눠 두고, router가 고른 expert가 있는 rank로 token activation을 all-to-all로 보내는 방식이다.
- GQA/MQA/MLA는 KV cache를 줄이는 attention 구조이고, CP/EP는 모델을 여러 GPU에 나눠 실행하는 parallelism 전략이다. 서로 다른 층의 개념이지만 long-context/MoE 시스템에서는 자주 함께 등장한다.

## 1. 개념

이 글은 한 Discord thread에서 이어진 질문들을 기준으로 정리한 병렬화 노트다. 시작 질문은 다음이었다.

> context parallelism에 대해서 자료조사해와. 그 외에 expert parallelism도 같이.

이후 질문은 자연스럽게 네 갈래로 확장됐다.

1. CP는 FlashAttention을 그대로 분산한 것인가?
2. Prefill에서 CP가 TTFT를 줄인다는 말은 마지막 query 하나만 빨리 계산한다는 뜻인가?
3. GQA/MLA에서 KV head와 KV cache 감소는 정확히 무슨 의미인가?
4. EP에서 router는 어떤 op로 expert를 고르고, 왜 all-to-all이 필요한가?

결론부터 말하면 CP와 EP는 둘 다 "큰 LLM을 여러 GPU로 쪼개는 방법"이지만, 쪼개는 축이 다르다.

| 병렬화 | 쪼개는 축 | 주로 해결하는 문제 |
|--------|-----------|-------------------|
| Context Parallelism | sequence/context length | long-context activation memory, prefill compute, KV communication 부담 |
| Expert Parallelism | MoE expert | expert weight memory, sparse FFN compute scaling, MoE serving/training |

```text
Context Parallelism:
  긴 sequence 128K tokens
  -> GPU0: token 0..16K
  -> GPU1: token 16K..32K
  -> ...

Expert Parallelism:
  MoE experts 128개
  -> GPU0: expert 0..3
  -> GPU1: expert 4..7
  -> ...
```

## 2. 용어 사전

| 용어 | 의미 | 헷갈리기 쉬운 점 |
|------|------|------------------|
| Attention | 현재 token의 query가 다른 token들의 key를 조회하고 value를 섞는 연산 | Q/K/V는 "텐서 세 개"지만 token마다 q/k/v가 있다 |
| Prefill | prompt 전체를 한 번 처리해 hidden state와 KV cache를 만드는 단계 | 마지막 token logits만 필요해 보여도 모든 prompt token의 layer 계산이 필요하다 |
| Decode | 새 token을 하나씩 생성하는 단계 | 매 step 현재 q 하나가 과거 전체 KV cache를 본다 |
| TTFT | Time To First Token | prefill이 길수록 첫 token이 늦게 나온다 |
| KV cache | 과거 token들의 key/value를 저장한 cache | decode 때 과거 K/V를 다시 계산하지 않기 위해 저장한다 |
| MHA | Multi-Head Attention | Q head 수와 KV head 수가 같다 |
| GQA | Grouped-Query Attention | 여러 Q head가 같은 K/V head를 공유한다 |
| MQA | Multi-Query Attention | 모든 Q head가 하나의 K/V를 공유한다 |
| MLA | Multi-head Latent Attention | full K/V 대신 low-rank latent KV를 cache한다 |
| MoE | Mixture of Experts | dense FFN 대신 여러 expert FFN 중 일부만 token마다 사용한다 |
| Router/Gate | token별 expert score를 계산하는 layer | 대개 linear -> softmax -> top-k 흐름이다 |
| All-to-all | 각 rank가 다른 모든 rank와 shard를 교환하는 collective | MoE에서는 token activation을 expert가 있는 rank로 재분배한다 |

## 3. 등장 배경과 이유

LLM scale-out은 단순히 "GPU를 많이 붙이면 된다"로 끝나지 않는다. 모델이 커지면 병목이 여러 축으로 나뉜다.

| 병목 | 대표 증상 | 대응 병렬화 |
|------|-----------|-------------|
| 모델 weight가 큼 | 한 GPU에 layer weight가 안 들어감 | Tensor Parallelism, Pipeline Parallelism, FSDP |
| sequence가 김 | activation memory, attention cost, prefill latency가 커짐 | Context Parallelism |
| MoE expert가 많음 | 전체 parameter는 크지만 token당 일부 expert만 활성화됨 | Expert Parallelism |
| batch/user가 많음 | 요청 throughput이 필요함 | Data Parallelism, continuous batching |

이 글의 주인공은 CP와 EP다.

CP는 long-context가 커지면서 중요해졌다. 8K, 32K, 128K context에서는 activation memory가 sequence length에 거의 선형으로 증가하고, attention은 prompt 길이에 강하게 묶인다. Megatron-Core 문서는 CP를 sequence-length dimension parallelization으로 설명한다. 기존 Sequence Parallelism(SP)이 LayerNorm/Dropout activation 일부만 sequence 방향으로 나눴다면, CP는 network input과 activation 전반을 sequence dimension으로 나눈다.

EP는 MoE 모델이 커지면서 중요해졌다. MoE는 전체 parameter는 매우 크지만 token마다 top-k expert만 사용한다. DeepSeek, Mixtral, Qwen-MoE 같은 모델은 expert가 많고, token별로 활성화되는 expert만 계산한다. 그러면 expert weight와 compute를 expert 축으로 나눌 수 있다.

## 4. 역사적 기원

### 4.1 Attention 최적화 계보

Transformer attention은 원래 전체 sequence에 대해 `QK^T` score matrix를 만든다. 길이 `T`라면 score matrix는 `[T, T]`다. 긴 context에서는 이 행렬을 그대로 materialize하면 memory와 bandwidth가 터진다.

FlashAttention은 이 문제를 single GPU kernel 수준에서 해결했다. 핵심은 attention matrix 전체를 저장하지 않고, Q/K/V block을 순회하며 online softmax로 정확한 attention을 계산하는 것이다.

Ring Attention과 CP 계열은 이 감각을 multi-GPU sequence sharding으로 확장한다. 각 GPU가 sequence chunk를 들고, attention에 필요한 K/V block을 서로 돌리거나 gather하면서 전체 sequence에 대한 attention을 계산한다.

### 4.2 MoE와 expert routing 계보

MoE는 모든 token이 같은 FFN을 통과하는 dense Transformer와 달리, 여러 expert FFN 중 일부만 사용한다.

```text
Dense Transformer FFN:
  모든 token -> 같은 FFN

MoE Transformer FFN:
  token -> router -> top-k expert FFN -> combine
```

GShard, Switch Transformer, Mixtral, DeepSeek-MoE 계열에서 이 구조가 널리 쓰였다. 전체 parameter를 크게 늘리면서 token당 activated parameter를 제한할 수 있기 때문이다.

## 5. 학술적/이론적 배경

### 5.1 Q/K/V attention을 token 하나 기준으로 보기

질문에서 가장 많이 헷갈린 부분은 "Q/K/V는 현재 token 하나에 대한 텐서 세 개인가?"였다.

정확히는 sequence 전체에 대해 Q/K/V tensor가 생기고, 그 안에 token별 q/k/v가 들어 있다.

```text
X: [seq_len, hidden_dim]

Q = X W_Q -> [seq_len, d_k]
K = X W_K -> [seq_len, d_k]
V = X W_V -> [seq_len, d_v]
```

현재 token `t`의 attention output만 보면:

```text
q_t: [1, d_k]
K:   [seq_len, d_k]
V:   [seq_len, d_v]

q_t K^T = [1, d_k] @ [d_k, seq_len]
        = [1, seq_len]

softmax(q_t K^T) @ V
        = [1, seq_len] @ [seq_len, d_v]
        = [1, d_v]
```

즉 현재 token의 query가 자기 자신 포함 과거 token들의 key를 조회하고, 그 가중치로 value를 섞는다.

```text
Q = 내가 찾는 질문
K = 각 token이 달고 있는 검색용 태그
V = 실제로 가져올 내용
```

Causal LM에서는 미래 token을 볼 수 없도록 mask를 건다.

```text
q_t가 보는 K/V:
  k_1, v_1
  k_2, v_2
  ...
  k_t, v_t

보지 못하는 것:
  k_{t+1}, v_{t+1}, ...
```

### 5.2 학습/프리필과 디코드의 차이

전체 `QK^T`를 한 번에 계산하는 느낌은 주로 training과 prefill에서 나온다.

```text
Training / Prefill:
  Q: [T, d]
  K: [T, d]
  QK^T: [T, T]

Decode:
  q_new: [1, d]
  K_cache: [T, d]
  q_new K_cache^T: [1, T]
```

학습/프리필에서는 prompt token들이 이미 여러 개 있으므로 모든 위치의 Q를 병렬로 계산한다. causal mask 때문에 의미적으로는 각 token이 자기 이전까지만 본다.

디코드에서는 이미 과거 token들의 K/V가 cache되어 있다. 새 token 하나를 생성할 때는 현재 q 하나만 만들고, 누적된 K/V cache 전체를 본다.

```text
학습/프리필:
  모든 위치의 Q를 한꺼번에 계산

생성 디코드:
  현재 위치의 Q 하나만 계산
  과거 전체 K/V cache를 조회
```

## 6. Context Parallelism 동작 메커니즘

CP는 sequence length 방향으로 hidden states와 activations를 나눈다. 예를 들어 sequence length가 128K이고 CP size가 8이면, 각 GPU는 대략 16K token chunk를 맡는다.

```text
sequence length = 128K
CP size = 8

GPU0: tokens 0K..16K
GPU1: tokens 16K..32K
GPU2: tokens 32K..48K
...
GPU7: tokens 112K..128K
```

Linear, LayerNorm, MLP 같은 token-wise 연산은 각 GPU가 자기 chunk만 계산하면 된다. 문제는 attention이다.

Attention에서 각 token의 Q는 같은 sequence 안의 모든 과거 K/V를 봐야 한다. 따라서 CP에서는 각 GPU가 자기 Q chunk를 계산하더라도, attention을 위해 다른 GPU가 가진 K/V chunk가 필요하다.

```text
GPU0 Q chunk needs K/V from GPU0..GPU7
GPU1 Q chunk needs K/V from GPU0..GPU7
...
```

Megatron-Core 문서는 CP에서 attention을 위해 forward에는 KV all-gather가 필요하고, backward에는 KV gradient reduce-scatter가 필요하다고 설명한다. 구현은 ring topology의 point-to-point communication으로 최적화될 수 있다.

```text
Forward:
  each GPU stores local Q/K/V chunk
  -> exchange/gather K/V chunks
  -> compute attention for local Q chunk

Backward:
  K/V gradient contributions
  -> reduce-scatter back to owning GPUs
```

### CP는 FlashAttention을 그대로 가져온 것인가?

답은 "그대로는 아니지만, 중요한 감각을 공유한다"다.

| 항목 | FlashAttention | Context Parallelism |
|------|----------------|---------------------|
| 주 목적 | single GPU attention memory/bandwidth 최적화 | multi-GPU sequence sharding |
| 핵심 | block-wise attention, online softmax, attention matrix 미저장 | sequence chunk 분산, KV exchange, local Q chunk attention |
| 통신 | GPU 내부 memory hierarchy 중심 | GPU 간 all-gather/ring/p2p/reduce-scatter |
| 적용 위치 | attention kernel | training/prefill parallelism strategy |

둘 다 attention matrix 전체를 materialize하지 않고 block 단위로 계산한다는 점에서 닮았다. 하지만 FlashAttention은 kernel 최적화이고, CP는 sequence를 여러 device에 나눈 뒤 필요한 K/V를 통신하는 parallelism이다.

## 7. Prefill에서 CP가 TTFT를 줄이는 이유

질문에서 나온 오해는 이거였다.

> TTFT를 줄이기 위해 prefill에서 CP를 쓴다는 건, 마지막 Q 하나를 계산해두기 위함인가?

반은 맞지만 핵심은 아니다. Decoder-only LLM에서 최종적으로 첫 generated token을 뽑으려면 마지막 prompt position의 logits가 필요하다. 하지만 그 마지막 hidden state를 얻으려면 모든 layer에서 prompt 전체 token을 처리해야 한다.

```text
prompt tokens: x1, x2, ..., xT

각 layer에서:
  Q = X Wq
  K = X Wk
  V = X Wv
  Attention(Q, K, V) over prompt
  MLP
```

Prefill의 목표는 두 가지다.

1. prompt 전체에 대한 KV cache를 만든다.
2. 마지막 prompt token의 logits를 계산해 첫 decode token을 뽑는다.

따라서 CP가 줄이는 것은 "마지막 Q 하나의 계산"이 아니라, 긴 prompt 전체의 layer-by-layer prefill work다.

```text
Prefill 병목:
  긴 prompt 전체 attention + MLP + KV cache construction

CP 역할:
  sequence length T를 여러 GPU에 나눠 prefill 계산과 activation memory를 분산
```

TTFT(Time To First Token)는 사용자가 prompt를 보낸 뒤 첫 token이 나오기까지의 시간이다. 긴 prompt에서는 prefill이 TTFT를 지배한다. CP는 이 prefill 구간의 attention/activation 부담을 나눠 TTFT를 줄일 수 있다.

## 8. GQA, MQA, MLA와 KV cache

### 8.1 KV head란 무엇인가

MHA에서는 attention head마다 자기 K/V가 있다.

```text
Q heads: 32
K heads: 32
V heads: 32
```

KV cache 크기는 대략 `num_kv_heads`에 비례한다.

```text
KV cache per token ~= 2 * num_kv_heads * head_dim
```

여기서 `2`는 K와 V 때문이다.

### 8.2 GQA는 무엇을 공유하는가

GQA에서는 Q head 수는 많이 유지하지만 K/V head 수를 줄인다.

```text
Q heads: 32
KV heads: 4
```

그러면 여러 Q head가 같은 K/V head를 공유한다.

```text
Q_0  Q_1  Q_2  Q_3  Q_4  Q_5  Q_6  Q_7   -> K_0, V_0
Q_8  Q_9  Q_10 Q_11 Q_12 Q_13 Q_14 Q_15  -> K_1, V_1
Q_16 ... Q_23                            -> K_2, V_2
Q_24 ... Q_31                            -> K_3, V_3
```

의미적으로는 여러 query가 같은 feature memory bank에 대해 서로 다른 질문을 던지는 것이다.

```text
MHA:
  질문도 다양하고, 검색 인덱스(K/V)도 head마다 다양함

GQA:
  질문(Q)은 다양하지만, 검색 인덱스(K/V)는 그룹 단위로 공유함

MQA:
  질문(Q)은 다양하지만, 검색 인덱스(K/V)는 하나만 씀
```

GQA는 표현력을 어느 정도 줄이는 대신 KV cache를 크게 줄인다. 예를 들어 KV head가 64개에서 8개로 줄면 KV cache는 대략 8배 줄 수 있다.

### 8.3 MLA는 저장 포맷만 압축인가?

MLA(Multi-head Latent Attention)는 GQA보다 한 단계 더 나간다. full K/V를 head별로 cache하지 않고 low-rank latent를 저장한다.

일반 MHA/GQA cache는 대략 다음이다.

```text
K_cache: [seq_len, num_kv_heads, k_head_dim]
V_cache: [seq_len, num_kv_heads, v_head_dim]
```

MLA는 단순화하면 다음과 같은 latent를 저장한다.

```text
c_kv = X W_DKV

cache:
  c_kv: [seq_len, kv_lora_rank]
  rope part: [seq_len, rope_dim]
```

그리고 attention 계산 때 필요한 K/V 성분을 latent에서 만든다.

```text
K = c_kv W_UK
V = c_kv W_UV
```

따라서 "저장할 때만 압축하고 계산 때 완전히 원래 K/V를 materialize한다"라기보다, 효율적인 구현에서는 full KV materialization을 피하면서 필요한 성분을 on-the-fly로 만든다고 보는 편이 맞다.

```text
GQA = KV head 수를 줄인다.
MLA = KV representation 자체를 low-rank latent로 cache한다.
```

## 9. Expert Parallelism 동작 메커니즘

EP는 MoE layer의 expert FFN을 여러 GPU에 나눠 배치하는 방식이다. 보통 Transformer block 안에서 attention 뒤의 FFN 부분이 MoE로 바뀐다.

```text
일반 Transformer block:
  Attention
  -> Dense FFN
  -> 다음 block

MoE Transformer block:
  Attention
  -> Router
  -> Expert FFN들 중 top-k
  -> Combine
  -> 다음 block
```

Expert Parallelism은 이 expert들을 GPU별로 나눠 놓는다.

```text
GPU0: expert 0, 1
GPU1: expert 2, 3
GPU2: expert 4, 5
GPU3: expert 6, 7
```

각 token은 처음에는 data parallel, tensor parallel, sequence parallel 등의 이유로 여러 rank에 흩어져 있다. 그런데 router가 선택한 expert가 자기 rank에 없을 수 있다.

```text
rank 0에 있는 token 0 -> expert 7 -> rank 3으로 가야 함
rank 1에 있는 token 3 -> expert 4 -> rank 2로 가야 함
rank 2에 있는 token 8 -> expert 0 -> rank 0으로 가야 함
```

그래서 all-to-all이 필요하다.

```text
Dispatch all-to-all:
  각 rank가 가진 token activation을
  선택된 expert가 있는 rank 기준으로 재분배

Expert compute:
  각 rank는 자기 expert에 배정된 token만 FFN 계산

Combine all-to-all:
  expert output을 원래 token 위치/rank로 되돌림
```

## 10. Router는 어떤 op로 expert를 고르는가

Router는 보통 learned linear layer다. token hidden state `x`를 expert 수만큼의 logit으로 바꾼 뒤 softmax/top-k를 한다.

```text
x: [hidden_dim]
router_weight: [hidden_dim, num_experts]

logits = x @ router_weight
probs = softmax(logits)
selected_experts = topk(probs, k)
```

실제 op 흐름은 대략 다음이다.

```text
hidden state
  -> router linear / matmul
  -> softmax or sigmoid-style score
  -> top-k
  -> token bucketize by expert destination
  -> all-to-all dispatch
  -> expert FFN matmul
  -> all-to-all combine
  -> weighted sum / combine
```

Top-2 MoE 예시:

```text
token A router probs:
  expert 0: 0.02
  expert 1: 0.10
  expert 2: 0.70
  expert 3: 0.03
  expert 4: 0.01
  expert 5: 0.05
  expert 6: 0.08
  expert 7: 0.01

top-2 selected:
  expert 2, expert 1

output ~= normalized(0.70) * expert2(x)
        + normalized(0.10) * expert1(x)
```

MoE에서 all-to-all은 일반적인 shard swap과 같은 collective지만, destination이 "고정 index"가 아니라 router가 정한 expert destination이라는 점이 다르다.

```text
일반 all-to-all 감각:
  rank 0: A0 A1 A2 A3
  rank 1: B0 B1 B2 B3
  rank 2: C0 C1 C2 C3
  rank 3: D0 D1 D2 D3

all-to-all 후:
  rank 0: A0 B0 C0 D0
  rank 1: A1 B1 C1 D1
  rank 2: A2 B2 C2 D2
  rank 3: A3 B3 C3 D3

MoE dispatch:
  rank별 token들을 expert destination rank 기준으로 bucketize해서 교환
```

## 11. Number of Experts, Selected Experts, Shared Experts

thread에서 나온 예시는 다음이었다.

```text
Total Parameters: 30B
Activated Parameters: 3B
Number of Experts: 128
Number of Selected Experts: 6
Number of Shared Experts: 2
```

이 값들은 서로 다른 축이다.

| 항목 | 의미 |
|------|------|
| Total Parameters: 30B | 모델 전체 parameter 수. 모든 expert까지 합친 크기 |
| Activated Parameters: 3B | token 하나가 forward 때 실제로 사용하는 parameter 규모 |
| Number of Experts: 128 | routed expert 후보 수 |
| Number of Selected Experts: 6 | token마다 router가 routed expert 중 고르는 top-k 수 |
| Number of Shared Experts: 2 | router 선택과 무관하게 모든 token이 사용하는 공통 expert 수 |

즉 `Number of Shared Experts: 2`는 "노드당 expert가 2개 올라간다"는 뜻이 아니다. 노드/GPU당 expert 수는 병렬화 배치가 결정한다.

```text
GPU당 routed expert 수
  ~= 전체 routed expert 수 / expert-parallel GPU 수
```

예를 들어 routed expert 128개를 EP GPU 64개에 나누면 GPU당 routed expert 2개다. EP GPU 32개면 GPU당 4개다. shared expert를 어떻게 shard/replicate할지는 모델과 serving/training 구현에 따라 달라질 수 있다.

Token 하나 입장에서는 보통 다음과 같다.

```text
routed experts 128개 중 top-6 선택
+ shared experts 2개 항상 사용
= token별 일부 expert 경로만 활성화
```

그래서 전체 모델은 30B지만 token당 activated parameter는 3B처럼 훨씬 작을 수 있다.

## 12. CP vs EP 비교표

| 항목 | Context Parallelism | Expert Parallelism |
|------|---------------------|--------------------|
| 쪼개는 축 | sequence/context length | MoE expert |
| 대상 모델 | Dense/MoE long-context 모델 | MoE 모델 |
| 주 사용 구간 | training, long-context prefill, 일부 decode KV sharding | MoE FFN layer training/serving |
| 주요 통신 | KV all-gather/ring/p2p, backward reduce-scatter | token dispatch all-to-all, combine all-to-all |
| 줄이는 것 | activation memory, per-GPU sequence work, KV/cache 부담 일부 | expert weight memory, expert compute per rank |
| 커지는 비용 | GPU 간 KV communication | all-to-all communication, load imbalance |
| 유리한 상황 | 8K+ context, 32K/64K/128K context, TTFT/KV 문제 | Mixtral, DeepSeek, Qwen-MoE 같은 sparse expert 모델 |
| 튜닝 포인트 | CP size, attention backend, MQA/GQA/MLA, interconnect | EP size, top-k, load balancing loss, capacity, DeepEP/EPLB |

## 13. 상황별 최적 선택

| 상황 | 우선 볼 것 |
|------|------------|
| Dense 모델이 weight 때문에 안 들어감 | TP, PP, FSDP부터 고려 |
| Dense 모델 long-context 학습에서 activation OOM | CP 또는 activation recomputation 비교 |
| Long prompt serving에서 TTFT가 큼 | prefill optimization, chunked prefill, CP/prefill parallelism 고려 |
| Decode에서 KV cache가 병목 | GQA/MQA/MLA, KV cache quantization, decode context parallelism 고려 |
| MoE 모델 expert weight가 큼 | EP로 expert sharding 고려 |
| MoE serving에서 특정 expert로 token이 몰림 | load balancing, EPLB, redundant expert, routing 통계 확인 |
| 멀티노드 MoE에서 latency가 튐 | all-to-all backend, DeepEP low-latency/high-throughput, network topology 확인 |

한 가지 기준은 이렇다.

```text
sequence가 길어서 문제면 CP 계열을 본다.
expert가 많아서 문제면 EP 계열을 본다.
KV cache가 문제면 GQA/MQA/MLA 같은 attention 구조도 같이 본다.
```

## 14. 실전 베스트 프랙티스

- CP size를 키우면 memory는 줄지만 communication은 늘어난다. NVLink/NVSwitch 안에서는 유리하고, 노드 간 통신으로 넘어가면 비용을 다시 봐야 한다.
- CP는 attention 외의 layer에서는 비교적 자연스럽지만, attention에서는 전체 K/V가 필요하다는 사실을 잊으면 안 된다.
- Prefill 최적화를 "마지막 query 하나"로 이해하지 말고, prompt 전체 layer computation과 KV cache construction으로 이해해야 한다.
- GQA/MQA는 KV head 수를 줄여 decode KV cache를 줄인다. 표현력 손실 가능성이 있지만 모델은 그 제약 아래 학습된다.
- MLA는 full K/V cache를 low-rank latent로 바꾸는 구조다. 단순 압축 파일 포맷이 아니라 attention 계산 방식과 연결된다.
- EP에서는 router skew가 병목이 된다. 특정 expert에 token이 몰리면 해당 rank가 전체 step을 늦춘다.
- MoE all-to-all은 네트워크 품질에 민감하다. vLLM 문서는 expert parallel deployment에서 all-to-all backend, DeepEP kernel, EPLB 같은 튜닝 포인트를 따로 다룬다.
- Megatron-Core 기준 TP와 EP를 같이 쓸 때는 Sequence Parallelism 요구사항을 확인해야 한다.

## 15. 함정과 안티패턴

| 오해 | 정정 |
|------|------|
| CP는 FlashAttention을 그대로 multi-GPU에 복붙한 것이다 | CP는 FlashAttention과 block/online softmax 감각을 공유하지만, 핵심은 sequence sharding과 KV communication이다 |
| Prefill은 마지막 token Q만 계산하면 된다 | 마지막 logits만 쓰더라도 모든 prompt token이 layer를 통과해야 하고 KV cache도 만들어야 한다 |
| Decode는 전체를 안 본다 | 현재 q 하나만 계산하지만, 그 q는 과거 전체 K/V cache를 본다 |
| GQA는 query만 남기고 feature를 무작정 뭉갠다 | 여러 Q head가 shared K/V memory bank를 보도록 학습된 절충 구조다 |
| MLA는 단순 저장 압축이다 | low-rank latent KV를 cache하고 attention 계산 때 필요한 성분을 만든다 |
| Shared expert 2개는 GPU당 expert 2개라는 뜻이다 | shared expert는 모든 token이 통과하는 공통 expert 수이고, GPU당 expert 수는 EP 배치가 결정한다 |
| MoE all-to-all은 항상 균등하다 | router skew 때문에 destination rank별 token 수가 불균등할 수 있다 |

## 16. 빅테크/프로덕션 관점

대형 LLM 시스템에서 CP와 EP가 중요한 이유는 단순히 논문상의 병렬화 기법이기 때문이 아니다. 실제 production training/serving에서는 다음 문제가 동시에 온다.

```text
1. context length가 길어지며 activation/KV memory가 커진다.
2. prefill latency가 TTFT를 지배한다.
3. MoE 모델은 전체 parameter가 크지만 token당 일부 expert만 활성화된다.
4. expert routing은 all-to-all과 load imbalance를 만든다.
5. attention 구조(GQA/MLA)와 병렬화 전략(CP/EP)이 서로 영향을 준다.
```

NVIDIA Megatron-Core 문서는 DP, TP, PP, CP, EP, FSDP를 조합 가능한 parallelism strategy로 정리한다. vLLM 문서는 serving 쪽에서 tensor/pipeline/data parallelism, context parallel deployment, expert parallel deployment를 나눠 설명하고, EP size를 `TP_SIZE x DP_SIZE`로 계산하는 식의 serving topology를 제공한다.

즉 실전에서는 "CP냐 EP냐"가 아니라 다음처럼 같이 설계한다.

```text
Dense long-context:
  TP/PP/FSDP로 weight를 넣고
  CP로 sequence/activation을 나누고
  GQA/MLA로 KV cache를 줄인다.

MoE long-context:
  EP로 expert를 나누고
  CP로 long sequence를 나누고
  all-to-all backend와 load balancing을 튜닝한다.
```

## 17. 결론

이 thread의 핵심 질문을 한 문장씩 정리하면 다음이다.

```text
CP는 무엇인가?
  긴 sequence/context length를 여러 GPU에 나누는 병렬화다.

CP는 FlashAttention인가?
  block-wise/online attention 감각은 공유하지만, 본질은 multi-GPU sequence sharding과 KV communication이다.

Prefill에서 CP는 뭘 빠르게 하나?
  마지막 Q 하나가 아니라 prompt 전체의 layer computation과 KV cache construction을 나눠서 TTFT를 줄인다.

GQA에서 KV 공유란 무엇인가?
  여러 Q head가 같은 K/V feature memory bank를 조회한다는 뜻이다.

MLA는 무엇을 줄이나?
  full K/V cache 대신 K/V를 만들어낼 low-rank latent를 cache해 memory를 줄인다.

EP는 무엇인가?
  MoE expert FFN을 여러 GPU에 나누고, token을 선택된 expert가 있는 rank로 all-to-all dispatch하는 병렬화다.

Selected experts와 shared experts는 무엇인가?
  selected experts는 token마다 router가 고르는 top-k routed expert 수이고,
  shared experts는 모든 token이 항상 통과하는 공통 expert 수다.
```

진짜 짧게는 이렇게 기억하면 된다.

```text
CP = 긴 문맥을 token 축으로 쪼갠다.
EP = MoE expert를 expert 축으로 쪼갠다.
GQA/MLA = KV cache를 줄이는 attention 구조다.
All-to-all = MoE token을 expert 위치로 보내는 교환이다.
```

## 참고자료

- NVIDIA Megatron-Core Context Parallelism: <https://github.com/NVIDIA/Megatron-LM/blob/main/docs/user-guide/features/context_parallel.md>
- NVIDIA Megatron-Core Parallelism Strategies Guide: <https://github.com/NVIDIA/Megatron-LM/blob/main/docs/user-guide/parallelism-guide.md>
- NVIDIA Megatron-Core MoE README: <https://github.com/NVIDIA/Megatron-LM/blob/main/megatron/core/transformer/moe/README.md>
- vLLM Parallelism and Scaling: <https://docs.vllm.ai/en/latest/serving/parallelism_scaling.html>
- vLLM Expert Parallel Deployment: <https://docs.vllm.ai/en/latest/serving/expert_parallel_deployment.html>
- FlashAttention paper: <https://arxiv.org/abs/2205.14135>
- Ring Attention paper: <https://arxiv.org/abs/2310.01889>
