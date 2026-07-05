---
layout: single
title: "nanoGPT에서 LLaMA까지: Transformer shape, RoPE, Norm, KV Cache를 한 번에 잡기"
date: 2026-07-05 00:00:00 +0900
categories: mlops
excerpt: "nanoGPT/GPT-2식 decoder-only Transformer를 출발점으로 LLaMA의 RoPE, RMSNorm/SwiGLU, hidden dimension, seq_len, attention score, KV cache가 무엇이 다르고 어떻게 연결되는지 정리한다."
toc: true
toc_sticky: true
tags: [nanogpt, llama, transformer, rope, layernorm, rmsnorm, kv-cache, attention, hidden-dimension]
source: "Discord thread: nanoGPT와 LLaMA 구조 차이, RoPE, hidden dimension, BatchNorm/LayerNorm, KV cache"
---

## TL;DR

- `nanoGPT`는 GPT-2 스타일 decoder-only Transformer를 읽기 쉽게 줄인 구현이다. `token embedding + learned position embedding -> Transformer block x N -> final LayerNorm -> lm_head` 흐름으로 보면 된다.
- LLaMA도 decoder-only Transformer지만, GPT-2식 설계에서 `RoPE`, `RMSNorm`, `SwiGLU`, bias 제거, GQA 같은 현대 LLM 설계를 많이 바꿨다.
- `seq_len`과 `hidden_dim`은 완전히 다른 축이다. `seq_len`은 토큰 개수/문맥 길이이고, `hidden_dim`은 토큰 하나를 표현하는 벡터 폭이다.
- RoPE는 position vector를 hidden state에 더하는 방식이 아니라, attention 안의 `q`, `k`를 위치에 따라 회전시켜 내적값에 상대 위치 정보를 넣는다.
- KV cache는 `seq_len^2`짜리 attention score matrix를 저장하지 않는다. 과거 토큰들의 `K`, `V` 벡터를 저장하므로 메모리는 보통 `seq_len`에 선형으로 증가한다.

## 이 글이 답하려는 질문

이 글은 한 Discord thread에서 나온 질문을 기준으로 정리한 noob-friendly Transformer 구조 노트다. 질문의 흐름은 대략 이랬다.

1. nanoGPT를 구성하는 layer는 무엇이고 LLaMA랑 뭐가 다른가?
2. `lm_head`, `MLP`, `FC`, position embedding은 각각 무엇인가?
3. RoPE는 cos/sin으로 어떻게 표현되고 왜 상대 위치가 되는가?
4. `hidden dimension`은 token embedding 차원인가, attention에서 쓰는 latent 차원인가?
5. BatchNorm과 LayerNorm은 어느 dimension으로 normalize하는가?
6. KV cache는 `seq_len^2`인가? `seq_len`은 config 값인가? `hidden_dim`이랑 같은가?
7. 추론할 때 KV cache가 있어도 attention 계산을 매번 하는가?

핵심은 개별 용어를 외우는 것이 아니다. Transformer tensor를 항상 다음 세 축으로 잡으면 대부분의 혼동이 풀린다.

```text
x: [B, T, C]

B = batch size
T = sequence length / context length / token count
C = hidden dimension / hidden size / d_model / n_embd
```

## 큰 그림: nanoGPT와 LLaMA는 같은 뼈대, 다른 디테일

둘 다 다음 토큰을 예측하는 decoder-only Transformer다.

```text
token ids
-> token embedding
-> decoder blocks
-> final normalization
-> lm_head
-> next-token logits
```

하지만 구현 디테일이 다르다.

| 항목 | nanoGPT / GPT-2 스타일 | LLaMA 스타일 |
|---|---|---|
| 목적 | 교육용/실험용 GPT-2 재현에 가까움 | 대규모 LLM 학습/추론용 설계 |
| 위치 정보 | learned absolute position embedding | RoPE, Rotary Positional Embedding |
| 위치 정보 적용 위치 | 입력 embedding에 한 번 더함 | 각 attention layer의 `q`, `k`에 적용 |
| Normalization | LayerNorm | RMSNorm |
| MLP | `Linear -> GELU -> Linear` | `gate_proj`, `up_proj`, `down_proj` 기반 SwiGLU |
| Attention head | 기본 MHA | 모델 버전에 따라 MHA/GQA/MQA 계열 |
| Linear bias | GPT-2식 bias 사용 가능 | 보통 bias를 줄이거나 제거 |
| 코드 감각 | 읽기 쉬운 reference implementation | 성능/메모리/스케일 중심 implementation |

Karpathy의 nanoGPT `model.py`를 보면 구조가 아주 노골적으로 드러난다.

```python
self.transformer = nn.ModuleDict(dict(
    wte = nn.Embedding(config.vocab_size, config.n_embd),
    wpe = nn.Embedding(config.block_size, config.n_embd),
    drop = nn.Dropout(config.dropout),
    h = nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
    ln_f = LayerNorm(config.n_embd, bias=config.bias),
))
self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
```

여기서 `wte`는 token embedding, `wpe`는 position embedding, `n_embd`는 hidden dimension이다.

## Transformer block을 shape으로 보기

nanoGPT/GPT-2식 block 하나를 아주 단순화하면 다음과 같다.

```text
x: [B, T, C]

x = x + CausalSelfAttention(LayerNorm(x))
x = x + MLP(LayerNorm(x))
```

조금 더 펼치면:

```text
x
-> LayerNorm
-> q, k, v projection
-> causal self-attention
-> output projection
-> residual add
-> LayerNorm
-> MLP / FFN
-> residual add
```

Attention과 MLP의 역할은 다르다.

| 부분 | 하는 일 | sequence 축을 섞나? | feature 축을 바꾸나? |
|---|---|---:|---:|
| Attention | 토큰끼리 정보를 주고받음 | 예 | 예, projection을 통해 변환 |
| MLP / FFN | 각 토큰의 hidden vector를 비선형 가공 | 아니오 | 예 |
| Norm | 값의 scale을 안정화 | 아니오 | feature 통계 사용 |
| Residual | 원래 정보를 보존하고 gradient 흐름 안정화 | 아니오 | 아니오 |

MLP는 이름 때문에 헷갈리지만 Transformer 안에서는 각 token position마다 같은 MLP를 독립적으로 적용한다고 보면 된다.

```text
x[:, 0, :] -> MLP -> x'[:, 0, :]
x[:, 1, :] -> MLP -> x'[:, 1, :]
x[:, 2, :] -> MLP -> x'[:, 2, :]
```

토큰 간 섞기는 MLP가 아니라 attention이 담당한다.

## 용어 사전

| 용어 | 뜻 | shape 감각 |
|---|---|---|
| `B`, batch size | 한 번에 처리하는 sequence 개수 | `x`의 첫 번째 축 |
| `T`, `seq_len` | sequence length, context length, 토큰 개수 | `x`의 두 번째 축 |
| `C`, `hidden_dim` | 토큰 하나의 내부 표현 차원 | `x`의 세 번째 축 |
| `n_embd`, `d_model`, `hidden_size` | 대체로 `hidden_dim`과 같은 말 | 보통 token embedding output 차원 |
| `head_dim` | attention head 하나가 쓰는 q/k/v 차원 | 대개 `hidden_dim / num_heads` |
| `lm_head` | hidden vector를 vocabulary logits로 바꾸는 linear layer | `[B,T,C] -> [B,T,V]` |
| `MLP`, `FFN` | token별 feed-forward network | `[B,T,C] -> [B,T,C]` |
| `FC`, `Dense`, `Linear` | fully connected layer | 마지막 차원에 행렬 곱 |
| `KV cache` | generation 때 과거 token의 K/V tensor 저장 | layer별 `[B,H,T,D]` |

## `lm_head`는 그냥 Linear layer인가?

거의 그렇다. `lm_head`는 마지막 hidden state를 vocabulary 크기의 점수로 바꾸는 linear layer다.

```text
hidden: [B, T, C]
lm_head weight: [V, C]
logits: [B, T, V]
```

여기서 `V`는 vocabulary size다. 마지막 token 위치의 logits를 softmax하면 다음 token distribution이 된다.

```python
logits = lm_head(hidden)
next_token_logits = logits[:, -1, :]
```

GPT-2/nanoGPT 계열에서는 input token embedding weight와 output `lm_head` weight를 공유하는 weight tying을 자주 쓴다.

```text
input:  token id -> embedding vector
output: hidden vector -> token logit
```

두 행렬은 방향이 반대지만 같은 vocabulary 공간을 쓰므로 같은 weight를 공유할 수 있다.

## Position Embedding: GPT-2식 absolute embedding vs LLaMA RoPE

nanoGPT/GPT-2는 position embedding을 입력 초반에 한 번 더한다.

```python
tok_emb = token_embedding(idx)      # [B, T, C]
pos_emb = position_embedding(pos)   # [T, C]
x = tok_emb + pos_emb
```

즉 각 token의 의미 벡터에 `나는 0번 위치`, `나는 1번 위치` 같은 learned vector를 더한다.

LLaMA는 보통 hidden state에 learned position embedding을 직접 더하지 않는다. 대신 각 attention layer에서 `q`, `k`에 RoPE를 적용한다.

```text
x
-> q_proj, k_proj, v_proj
-> apply RoPE to q, k
-> attention(q, k, v)
```

차이를 한 줄로 정리하면 이렇다.

```text
nanoGPT/GPT-2:
position information is added to hidden states once at the input.

LLaMA/RoPE:
position information rotates q/k inside every attention layer.
```

## RoPE 수식: cos/sin을 더하는 게 아니라 회전한다

RoPE의 정식 이름은 `Rotary Positional Embedding`이다. 핵심은 벡터 차원을 2개씩 묶어서 2D 회전을 적용하는 것이다.

위치가 `m`, frequency가 `theta`인 2D pair `[x_1, x_2]`에 대해:

```text
x'_1 = x_1 cos(m theta) - x_2 sin(m theta)
x'_2 = x_1 sin(m theta) + x_2 cos(m theta)
```

행렬로 쓰면:

```text
R_m = [ cos(m theta)  -sin(m theta) ]
      [ sin(m theta)   cos(m theta) ]
```

실제 구현에서는 다음과 같은 형태를 자주 본다.

```python
def rotate_half(x):
    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]
    return torch.cat((-x2, x1), dim=-1)

q_rot = q * cos + rotate_half(q) * sin
k_rot = k * cos + rotate_half(k) * sin
```

표현만 보면 `cos/sin을 더해준다`처럼 기억하기 쉽지만, 수학적으로는 rotation matrix를 적용하는 것이다.

## 왜 RoPE가 상대 위치를 반영하는가?

Attention score는 기본적으로 query와 key의 내적이다.

```text
score(i, j) = q_i · k_j
```

RoPE는 위치 `i`의 query와 위치 `j`의 key를 각각 회전한 뒤 내적한다.

```text
score(i, j) = (R_i q_i) · (R_j k_j)
```

내적을 행렬식으로 쓰면:

```text
(R_i q)^T (R_j k)
= q^T R_i^T R_j k
```

회전 행렬은 다음 성질을 가진다.

```text
R_i^T R_j = R_{j-i}
```

따라서:

```text
score(i, j) = q^T R_{j-i} k
```

즉 attention score가 절대 위치 `i`, `j` 자체보다 상대 위치 `j - i`를 자연스럽게 포함한다. 이게 RoPE를 이해하는 가장 중요한 포인트다.

## RoPE는 layer마다 적용하니 비싼가?

추가 연산은 있다. 각 layer마다 `q`, `k`에 대해 곱셈/덧셈을 한다.

```text
RoPE cost:      O(TD)
Attention QK^T: O(T^2D)
```

`T`가 길어질수록 무거운 부분은 보통 RoPE가 아니라 `QK^T` attention score 계산이다. `cos`, `sin` table도 매번 새로 계산하기보다 position별로 cache해두고 가져다 쓰는 경우가 많다.

그래서 정확한 답은:

```text
RoPE는 layer마다 추가 비용이 있지만, 일반 self-attention의 T^2 비용에 비하면 보통 작은 편이다.
```

## Hidden dimension은 token embedding 차원인가?

대부분의 Transformer에서는 그렇다. `hidden_dim`, `hidden_size`, `d_model`, `n_embd`는 보통 같은 역할을 한다.

```text
x: [B, T, C]
C = hidden dimension
```

예를 들어 `C = 768`이면 각 token은 모델 내부에서 길이 768짜리 vector로 표현된다.

```text
[0.12, -0.88, 0.03, ..., 0.45]
```

의미적으로는 다음처럼 이해하면 된다.

```text
hidden dimension = 모델이 토큰 하나를 표현하기 위해 쓰는 내부 feature 공간의 폭
```

이 차원이 클수록 한 토큰에 대해 더 많은 feature를 담을 수 있다. 다만 사람이 보기 좋게 `차원 17 = 품사`, `차원 42 = 감정`처럼 분리되어 있지는 않다. 대부분은 여러 차원에 분산된 latent representation이다.

## Attention에서는 hidden dimension이 head로 쪼개진다

예를 들어:

```text
hidden_dim = 768
num_heads = 12
head_dim = 64
```

이면:

```text
x: [B, T, 768]
q_proj(x): [B, T, 768]
k_proj(x): [B, T, 768]
v_proj(x): [B, T, 768]
```

그다음 head 축으로 reshape한다.

```text
q: [B, 12, T, 64]
k: [B, 12, T, 64]
v: [B, 12, T, 64]
```

즉:

```text
hidden_dim = num_heads * head_dim
```

여기서 `seq_len`과 `hidden_dim`을 섞으면 안 된다.

```text
seq_len    = 토큰이 몇 개 있나
hidden_dim = 토큰 하나가 몇 차원인가
head_dim   = attention head 하나가 몇 차원인가
```

## BatchNorm과 LayerNorm은 어느 축으로 normalize하나?

Transformer hidden state를 다시 보자.

```text
x: [B, T, C]
```

LayerNorm은 각 sample/token마다 `C` 방향으로 평균과 분산을 낸다.

```text
mu_{b,t} = (1 / C) sum_c x_{b,t,c}

sigma^2_{b,t} = (1 / C) sum_c (x_{b,t,c} - mu_{b,t})^2

yhat_{b,t,c} = (x_{b,t,c} - mu_{b,t}) / sqrt(sigma^2_{b,t} + eps)

y_{b,t,c} = gamma_c yhat_{b,t,c} + beta_c
```

즉 한 token의 hidden vector 내부를 normalize한다.

```text
LayerNorm(x[b, t, :])
```

BatchNorm은 feature/channel마다 batch 방향으로 통계를 낸다. MLP 입력 `[B, C]`라면:

```text
mu_c = (1 / B) sum_b x_{b,c}

sigma^2_c = (1 / B) sum_b (x_{b,c} - mu_c)^2

yhat_{b,c} = (x_{b,c} - mu_c) / sqrt(sigma^2_c + eps)

y_{b,c} = gamma_c yhat_{b,c} + beta_c
```

sequence tensor `[B, T, C]`에 BatchNorm류를 적용한다고 보면 보통 channel `C`별로 `B`, `T` 축의 통계를 묶어 생각할 수 있다.

```text
mu_c = (1 / (B T)) sum_b sum_t x_{b,t,c}
```

비교하면:

| 항목 | BatchNorm | LayerNorm |
|---|---|---|
| 통계 축 | batch/sample 축 | feature/hidden 축 |
| `[B,T,C]` 감각 | `x[:, :, c]`를 channel별 normalize | `x[b, t, :]`를 token별 normalize |
| batch size 영향 | 큼 | 작음 |
| train/eval 차이 | running mean/var 때문에 있음 | 거의 없음 |
| LLM 사용 | 거의 안 씀 | 많이 씀 |

Transformer/LLM에서는 batch size가 작거나 variable length/padding/autoregressive generation이 중요하므로 BatchNorm보다 LayerNorm/RMSNorm 계열이 잘 맞는다.

## RMSNorm은 LayerNorm과 뭐가 다른가?

LLaMA는 LayerNorm 대신 RMSNorm을 쓴다. RMSNorm은 평균을 빼는 부분을 생략하고 root mean square로 scale만 맞춘다.

LayerNorm이 대략:

```text
(x - mean(x)) / sqrt(var(x) + eps)
```

이라면 RMSNorm은:

```text
x / RMS(x)

RMS(x) = sqrt((1 / C) sum_c x_c^2 + eps)
```

이다. learnable scale `gamma`는 붙지만 보통 bias는 없다.

직관은 다음과 같다.

```text
LayerNorm = 중심을 0으로 맞추고 scale도 맞춤
RMSNorm   = 중심 제거는 안 하고 scale만 맞춤
```

RMSNorm은 계산이 단순하고 대규모 Transformer에서 널리 쓰인다.

## MLP, FFN, FC는 같은 말인가?

완전히 같은 말은 아니지만 자주 겹쳐 쓰인다.

| 용어 | 의미 |
|---|---|
| MLP | Multi-Layer Perceptron. Linear layer와 activation을 쌓은 network |
| FFN | Feed-Forward Network. Transformer block 안의 token-wise MLP를 부르는 말 |
| FC | Fully Connected layer. PyTorch의 `nn.Linear`, Keras의 Dense와 비슷한 말 |
| Linear | 입력 vector에 weight matrix를 곱하고 bias를 더하는 layer |

GPT-2/nanoGPT식 MLP는 보통:

```text
Linear(C, 4C)
-> GELU
-> Linear(4C, C)
```

LLaMA식 MLP는 SwiGLU 계열이다.

```text
gate = SiLU(gate_proj(x))
up   = up_proj(x)
out  = down_proj(gate * up)
```

그림으로 보면:

```text
x -> gate_proj -> SiLU --\
                          * -> down_proj -> output
x -> up_proj ------------/
```

하나는 gate를 만들고, 하나는 value candidate를 만든 뒤 곱해서 다시 hidden size로 줄인다.

## seq_len은 config 값인가?

대체로 그렇다. 이름은 모델/라이브러리마다 다르다.

| 계열 | 자주 보이는 이름 |
|---|---|
| nanoGPT | `block_size` |
| GPT-2 config | `n_positions`, `n_ctx` |
| LLaMA/Hugging Face | `max_position_embeddings` |
| serving/runtime | `max_seq_len`, `max_model_len`, `context_length` |

의미는:

```text
모델이 한 번에 볼 수 있는 최대 token 수
```

예를 들어:

```text
x: [1, 2048, 4096]
```

이면:

```text
batch = 1
seq_len = 2048
hidden_dim = 4096
```

`2048`과 `4096`은 둘 다 숫자가 커 보이지만 전혀 다른 축이다.

## Attention score matrix는 `seq_len^2`가 맞다

Full sequence를 한 번에 처리할 때 attention score는:

```text
Q @ K^T
```

이다. Shape은:

```text
Q: [B, H, T, D]
K: [B, H, T, D]
score: [B, H, T, T]
```

여기서 `T x T`가 생기므로 attention score matrix는 `seq_len^2` 크기다.

```text
score[b, h, i, j]
= i번 query token이 j번 key token을 얼마나 볼지 나타내는 점수
```

causal language model에서는 미래 token을 보면 안 되므로 mask를 씌운다.

```text
현재 token i는 j <= i 위치만 볼 수 있음
```

## KV cache는 `seq_len^2`가 아니다

KV cache는 attention score matrix를 저장하는 것이 아니다. 과거 token들의 `K`, `V` vector를 저장한다.

Layer 하나 기준으로 cache shape은 보통 다음과 같다.

```text
K cache: [B, num_kv_heads, T, head_dim]
V cache: [B, num_kv_heads, T, head_dim]
```

layer까지 포함하면:

```text
[num_layers, 2, B, num_kv_heads, T, head_dim]
```

여기서 `2`는 K와 V다.

따라서 KV cache memory는 대략:

```text
O(num_layers * B * num_kv_heads * T * head_dim * 2)
```

즉 `T`에 선형으로 증가한다.

```text
KV cache memory = O(T)
attention score matrix = O(T^2)
```

이 둘을 섞으면 안 된다.

## 그럼 추론 시 attention 계산은 매번 하나?

한다. KV cache는 attention 계산 자체를 없애는 장치가 아니다. 과거 token들의 `K`, `V`를 다시 만들지 않게 해주는 장치다.

새 token 하나를 생성하는 decode step을 보자.

```text
q_new:   [B, H, 1, D]
k_cache: [B, H, T, D]
v_cache: [B, H, T, D]
```

새 token은 과거 전체를 봐야 하므로:

```text
score = q_new @ k_cache^T
score: [B, H, 1, T]
```

이 score는 매 step 새로 계산한다. 왜냐하면 새 token의 query `q_new`는 이전 step에는 존재하지 않았기 때문이다.

```text
E를 만들 때 계산한 q_E · k_A
F를 만들 때 필요한 q_F · k_A
```

둘은 query가 다르므로 재사용할 수 없다.

## KV cache가 줄여주는 것

KV cache가 없으면 다음 token을 만들 때마다 prefix 전체를 다시 forward해야 한다.

```text
A B C D E 전체 forward
-> A의 K/V 다시 계산
-> B의 K/V 다시 계산
-> C의 K/V 다시 계산
-> D의 K/V 다시 계산
-> E의 K/V 다시 계산
-> 새 attention 계산
```

KV cache가 있으면:

```text
A~E의 K/V는 cache에 있음
F의 Q/K/V만 새로 계산
F의 Q와 cache된 K들을 내적
softmax
cache된 V들과 weighted sum
F의 K/V를 cache에 append
```

즉 cache가 없애는 비용은:

```text
과거 token들의 projection/MLP/attention을 다시 forward하는 비용
```

cache가 없애지 못하는 비용은:

```text
새 query가 과거 key 전체와 내적하는 비용
```

그래서 decode 한 step의 attention 비용은 context 길이 `T`에 대해 선형으로 늘고, 긴 token을 계속 생성하면 누적 비용은 여전히 커진다.

## 한 장으로 보는 shape 지도

아래 그림은 `seq_len`, `hidden_dim`, `head_dim`, `attention score`, `KV cache`를 한 번에 연결한 지도다.

```text
Input hidden states
x: [B, T, C]
        |  |
        |  +-- C = hidden_dim, token one vector width
        +----- T = seq_len, number of tokens

Q/K/V projection
q, k, v: [B, H, T, D]
             |  |  |
             |  |  +-- D = head_dim
             |  +----- T = seq_len
             +-------- H = num_heads

Attention score during full prefill
score = Q @ K^T
score: [B, H, T, T]  <- O(T^2)

KV cache during decode
k_cache: [B, H_kv, T, D]
v_cache: [B, H_kv, T, D]  <- O(T)

New token decode
q_new: [B, H, 1, D]
score_new = q_new @ k_cache^T
score_new: [B, H, 1, T]
```

## nanoGPT에서 LLaMA로 넘어갈 때의 체크리스트

nanoGPT를 이해한 뒤 LLaMA를 보면 다음 질문을 순서대로 확인하면 된다.

| 체크포인트 | nanoGPT에서 본 것 | LLaMA에서 바뀌는 것 |
|---|---|---|
| 위치 정보 | `wpe`를 `wte`에 더함 | `q`, `k`에 RoPE 적용 |
| Norm | LayerNorm | RMSNorm |
| MLP | GELU FFN | SwiGLU FFN |
| Attention | 기본 MHA | GQA/MQA 사용 가능 |
| Cache | K/V 저장 | GQA면 KV head 수가 줄어 cache도 줄 수 있음 |
| Context limit | `block_size` | `max_position_embeddings`, RoPE scaling 등 |
| Output | `lm_head` linear | `lm_head` linear, embedding tying 가능 |

## 실전 베스트 프랙티스: 헷갈릴 때는 shape부터 써라

LLM architecture를 읽을 때 가장 좋은 디버깅 습관은 shape을 먼저 쓰는 것이다.

1. `x`를 `[B, T, C]`로 둔다.
2. `C = hidden_dim`, `T = seq_len`을 절대 섞지 않는다.
3. Attention에 들어가면 `[B, H, T, D]`로 reshape된다고 본다.
4. Full prefill attention score는 `[B, H, T, T]`다.
5. Decode에서 새 token attention score는 `[B, H, 1, T]`다.
6. KV cache는 score가 아니라 K/V tensor라서 `[B, H_kv, T, D]`다.

이 습관만 있으면 다음 오해를 대부분 피할 수 있다.

| 오해 | 교정 |
|---|---|
| KV cache는 `seq_len^2`다 | 아니다. K/V vector 저장이므로 `seq_len`에 선형이다 |
| `seq_len`과 `hidden_dim`은 비슷한 말이다 | 아니다. 토큰 개수와 token vector 폭이다 |
| RoPE는 position vector를 더한다 | 아니다. q/k를 회전한다 |
| KV cache가 있으면 attention 계산을 안 한다 | 아니다. 새 query와 과거 key 내적은 매번 한다 |
| MLP가 token들을 섞는다 | 아니다. token 간 정보 교환은 attention이 한다 |

## 참고자료

- Andrej Karpathy, `nanoGPT`, `model.py`: https://github.com/karpathy/nanoGPT/blob/master/model.py
- Hugging Face Transformers, LLaMA configuration/model implementation: https://github.com/huggingface/transformers/tree/main/src/transformers/models/llama
- Su et al., "RoFormer: Enhanced Transformer with Rotary Position Embedding", arXiv:2104.09864: https://arxiv.org/abs/2104.09864
- Ba et al., "Layer Normalization", arXiv:1607.06450: https://arxiv.org/abs/1607.06450
- Vaswani et al., "Attention Is All You Need", arXiv:1706.03762: https://arxiv.org/abs/1706.03762
- Zhang and Sennrich, "Root Mean Square Layer Normalization", NeurIPS 2019: https://arxiv.org/abs/1910.07467
- Shazeer, "GLU Variants Improve Transformer", arXiv:2002.05202: https://arxiv.org/abs/2002.05202
- Meta AI, "LLaMA: Open and Efficient Foundation Language Models", arXiv:2302.13971: https://arxiv.org/abs/2302.13971
