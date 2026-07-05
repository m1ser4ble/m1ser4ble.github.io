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


## D3 인터랙티브 시각화: shape와 cache가 갈라지는 지점

아래 패널은 이 글에서 계속 나오는 `B`, `T`, `C`, `H`, `D` 축을 한 화면에 묶은 것이다. `Embedding`, `Attention`, `RoPE`, `KV Cache`, `Decode`를 눌러보면 `seq_len^2`가 어디서 생기고, KV cache가 왜 `seq_len`에 선형인지 비교할 수 있다. JavaScript가 꺼져 있어도 바로 아래의 shape 표와 본문 설명으로 같은 내용을 따라갈 수 있다.

<style>
.d3-transformer-shape-lab {
  --bg: #07110f;
  --panel: #0d1f1a;
  --ink: #e8fff6;
  --muted: #a4c7ba;
  --green: #63e6be;
  --amber: #ffd166;
  --blue: #74c0fc;
  --pink: #f783ac;
  margin: 1.5rem 0 2rem;
  padding: 1rem;
  border: 1px solid rgba(99, 230, 190, .28);
  border-radius: 18px;
  color: var(--ink);
  background:
    radial-gradient(circle at 16% 8%, rgba(99, 230, 190, .16), transparent 28%),
    radial-gradient(circle at 86% 20%, rgba(255, 209, 102, .12), transparent 25%),
    linear-gradient(135deg, #06100d, #0a1715 58%, #06100d);
  box-shadow: 0 18px 48px rgba(0,0,0,.32);
  overflow: hidden;
}
.d3-transformer-shape-lab .viz-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-bottom: .85rem;
}
.d3-transformer-shape-lab .viz-title {
  font-weight: 800;
  letter-spacing: .02em;
}
.d3-transformer-shape-lab .viz-note {
  color: var(--muted);
  font-size: .84rem;
  line-height: 1.45;
  margin-top: .25rem;
}
.d3-transformer-shape-lab .viz-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  justify-content: flex-end;
}
.d3-transformer-shape-lab button {
  border: 1px solid rgba(232,255,246,.18);
  color: var(--ink);
  background: rgba(255,255,255,.05);
  border-radius: 999px;
  padding: .38rem .72rem;
  font-size: .78rem;
  cursor: pointer;
}
.d3-transformer-shape-lab button.active {
  border-color: rgba(99,230,190,.72);
  background: linear-gradient(135deg, rgba(99,230,190,.24), rgba(255,209,102,.16));
}
.d3-transformer-shape-lab svg {
  width: 100%;
  height: auto;
  display: block;
  background: rgba(2, 8, 7, .42);
  border-radius: 14px;
}
.d3-transformer-shape-lab .caption {
  margin-top: .75rem;
  color: var(--muted);
  font-size: .85rem;
}
@media (max-width: 640px) {
  .d3-transformer-shape-lab { padding: .75rem; }
  .d3-transformer-shape-lab button { font-size: .72rem; padding: .34rem .58rem; }
}
</style>

<div id="d3-transformer-shape-lab" class="d3-transformer-shape-lab">
  <div class="viz-head">
    <div>
      <div class="viz-title">Transformer Shape Lab</div>
      <div class="viz-note">축을 바꾸면 병목도 바뀐다: hidden width, attention score, KV cache, decode step.</div>
    </div>
    <div class="viz-tabs" role="tablist" aria-label="Transformer shape views">
      <button type="button" data-view="embedding" class="active">Embedding</button>
      <button type="button" data-view="attention">Attention</button>
      <button type="button" data-view="rope">RoPE</button>
      <button type="button" data-view="cache">KV Cache</button>
      <button type="button" data-view="decode">Decode</button>
    </div>
  </div>
  <svg viewBox="0 0 980 560" role="img" aria-label="Interactive diagram of Transformer tensor shapes, RoPE, and KV cache"></svg>
  <div class="caption">핵심: `score`만 `[T,T]`이고, KV cache는 `K/V` 벡터를 `[T,D]` 방향으로 저장한다.</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script>
(function () {
  const root = document.querySelector('#d3-transformer-shape-lab');
  if (!root || !window.d3) return;
  const svg = d3.select(root).select('svg');
  const buttons = root.querySelectorAll('button[data-view]');
  const colors = {
    green: '#63e6be', amber: '#ffd166', blue: '#74c0fc', pink: '#f783ac',
    ink: '#e8fff6', muted: '#a4c7ba', panel: '#0d1f1a'
  };

  const views = {
    embedding: {
      title: '1. Embedding: x는 [B, T, C]로 시작한다',
      subtitle: 'T는 토큰 개수, C는 토큰 하나의 hidden width다. 둘은 같은 숫자 축이 아니다.',
      nodes: [
        {id:'ids', x:70, y:230, w:135, h:72, label:'token ids\n[B, T]', color:colors.amber},
        {id:'wte', x:275, y:160, w:180, h:86, label:'token embedding\nwte: [V, C]', color:colors.green},
        {id:'wpe', x:275, y:305, w:180, h:86, label:'position embedding\nwpe: [T, C]', color:colors.blue},
        {id:'x', x:560, y:225, w:245, h:92, label:'hidden states x\n[B, T, C]', color:colors.pink}
      ],
      links: [['ids','wte'], ['wte','x'], ['wpe','x']],
      notes: ['nanoGPT/GPT-2: token embedding과 learned position embedding을 입력에서 더한다.', 'LLaMA: 이 wpe 더하기 대신 attention 안에서 RoPE를 q/k에 적용한다.']
    },
    attention: {
      title: '2. Attention: seq_len^2는 score matrix에서 생긴다',
      subtitle: 'Q와 K를 내적하면 각 query token이 모든 key token을 보는 [T,T] score가 나온다.',
      nodes: [
        {id:'x', x:65, y:225, w:140, h:80, label:'x\n[B,T,C]', color:colors.green},
        {id:'qkv', x:275, y:215, w:170, h:100, label:'q/k/v projection\n[B,H,T,D]', color:colors.amber},
        {id:'score', x:535, y:130, w:210, h:105, label:'score = QK^T\n[B,H,T,T]\nO(T^2)', color:colors.pink},
        {id:'out', x:535, y:325, w:210, h:95, label:'attn @ V\n[B,H,T,D]', color:colors.blue},
        {id:'proj', x:805, y:245, w:120, h:75, label:'output\n[B,T,C]', color:colors.green}
      ],
      links: [['x','qkv'], ['qkv','score'], ['score','out'], ['qkv','out'], ['out','proj']],
      notes: ['Full prefill/training에서는 score가 [T,T]라서 context가 길수록 급격히 커진다.', 'Causal mask는 미래 token 쪽 score를 막는다.']
    },
    rope: {
      title: '3. RoPE: position vector를 더하지 않고 q/k를 회전한다',
      subtitle: '위치 i, j만큼 회전한 뒤 내적하면 R_i^T R_j = R_{j-i}라서 상대 위치가 들어간다.',
      nodes: [
        {id:'q', x:85, y:155, w:145, h:80, label:'q_i\nhead pair', color:colors.green},
        {id:'k', x:85, y:325, w:145, h:80, label:'k_j\nhead pair', color:colors.blue},
        {id:'rq', x:345, y:155, w:170, h:80, label:'R_i q_i\nrotate by i', color:colors.amber},
        {id:'rk', x:345, y:325, w:170, h:80, label:'R_j k_j\nrotate by j', color:colors.amber},
        {id:'dot', x:635, y:240, w:245, h:100, label:'(R_i q)^T(R_j k)\n= q^T R_{j-i} k', color:colors.pink}
      ],
      links: [['q','rq'], ['k','rk'], ['rq','dot'], ['rk','dot']],
      notes: ['cos/sin은 더하는 embedding이 아니라 회전 행렬을 구현하는 값이다.', 'RoPE 비용은 대개 O(TD)라서 O(T^2D) attention score보다 작다.']
    },
    cache: {
      title: '4. KV Cache: 저장하는 것은 score가 아니라 K/V 벡터다',
      subtitle: 'cache shape은 layer별로 대략 [2, B, H_kv, T, D]. 그래서 메모리는 T에 선형이다.',
      nodes: [
        {id:'past', x:70, y:215, w:170, h:100, label:'past tokens\nA B C D E', color:colors.green},
        {id:'kv', x:330, y:145, w:230, h:120, label:'K cache\n[B,H_kv,T,D]', color:colors.blue},
        {id:'vv', x:330, y:320, w:230, h:120, label:'V cache\n[B,H_kv,T,D]', color:colors.amber},
        {id:'no', x:665, y:215, w:240, h:100, label:'not cached:\nscore [B,H,T,T]\nsoftmax output', color:colors.pink}
      ],
      links: [['past','kv'], ['past','vv']],
      notes: ['KV cache는 q·k 내적 결과를 들고 있지 않다.', 'GQA/MQA는 H_kv를 줄여 cache memory를 줄이는 방향의 설계다.']
    },
    decode: {
      title: '5. Decode: cache가 있어도 새 query의 내적은 매번 한다',
      subtitle: '새 token F의 q_F는 이전 step에 없었으므로 q_F @ K_cache^T는 새로 계산해야 한다.',
      nodes: [
        {id:'new', x:70, y:230, w:155, h:85, label:'new token F\nq_new,k_new,v_new', color:colors.green},
        {id:'cache', x:315, y:145, w:215, h:115, label:'K/V cache\nA..E already stored', color:colors.blue},
        {id:'score', x:610, y:160, w:220, h:95, label:'q_new @ K_cache^T\n[B,H,1,T]', color:colors.pink},
        {id:'sum', x:610, y:325, w:220, h:95, label:'weights @ V_cache\nnew hidden', color:colors.amber},
        {id:'append', x:315, y:335, w:215, h:85, label:'append F\nK/V grows by 1', color:colors.green}
      ],
      links: [['new','score'], ['cache','score'], ['score','sum'], ['cache','sum'], ['new','append']],
      notes: ['cache가 줄이는 것은 과거 prefix를 다시 forward하는 비용이다.', '한 step attention은 O(T), 긴 생성을 계속하면 누적 비용은 여전히 커진다.']
    }
  };

  function draw(viewName) {
    const view = views[viewName];
    svg.selectAll('*').remove();
    svg.append('text').attr('x', 42).attr('y', 48).attr('fill', colors.ink)
      .attr('font-size', 24).attr('font-weight', 800).text(view.title);
    svg.append('text').attr('x', 42).attr('y', 78).attr('fill', colors.muted)
      .attr('font-size', 15).text(view.subtitle);

    const nodeById = new Map(view.nodes.map(d => [d.id, d]));
    svg.append('defs').append('marker')
      .attr('id', 'arrow-shape-lab').attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'rgba(232,255,246,.72)');

    svg.selectAll('path.link').data(view.links).enter().append('path')
      .attr('class', 'link')
      .attr('d', d => {
        const a = nodeById.get(d[0]);
        const b = nodeById.get(d[1]);
        const x1 = a.x + a.w, y1 = a.y + a.h / 2;
        const x2 = b.x, y2 = b.y + b.h / 2;
        const mid = (x1 + x2) / 2;
        return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
      })
      .attr('fill', 'none').attr('stroke', 'rgba(232,255,246,.42)').attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow-shape-lab)');

    const g = svg.selectAll('g.node').data(view.nodes).enter().append('g')
      .attr('class', 'node').attr('transform', d => `translate(${d.x},${d.y})`);
    g.append('rect').attr('width', d => d.w).attr('height', d => d.h).attr('rx', 16)
      .attr('fill', d => d.color + '22').attr('stroke', d => d.color).attr('stroke-width', 1.5);
    g.each(function(d) {
      const lines = d.label.split('\n');
      const t = d3.select(this).append('text').attr('x', d.w/2).attr('y', d.h/2 - (lines.length-1)*10)
        .attr('text-anchor', 'middle').attr('fill', colors.ink).attr('font-size', 15).attr('font-weight', 700);
      lines.forEach((line, i) => t.append('tspan').attr('x', d.w/2).attr('dy', i ? 20 : 0).text(line));
    });

    svg.selectAll('text.note').data(view.notes).enter().append('text')
      .attr('class', 'note').attr('x', 54).attr('y', (d, i) => 485 + i * 26)
      .attr('fill', colors.muted).attr('font-size', 15).text(d => '• ' + d);
  }

  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.toggle('active', b === btn));
    draw(btn.dataset.view);
  }));
  draw('embedding');
})();
</script>

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


아래 D3 패널은 `hidden_dim`이 head 축으로 어떻게 잘리는지 바로 보여준다. 버튼을 바꾸면 `num_heads`가 바뀌고, 같은 `hidden_dim = 768`이 더 얇은 `head_dim` 조각들로 나뉜다.

<style>
.drd-mini-d3 {
  --bg: #07110f;
  --ink: #e8fff6;
  --muted: #a4c7ba;
  --green: #63e6be;
  --amber: #ffd166;
  --blue: #74c0fc;
  --pink: #f783ac;
  margin: 1.2rem 0 1.8rem;
  padding: .9rem;
  border: 1px solid rgba(99,230,190,.24);
  border-radius: 16px;
  color: var(--ink);
  background: linear-gradient(135deg, rgba(7,17,15,.96), rgba(12,31,26,.96));
  box-shadow: 0 12px 34px rgba(0,0,0,.24);
}
.drd-mini-d3 .mini-head {
  display: flex;
  justify-content: space-between;
  gap: .75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: .65rem;
}
.drd-mini-d3 .mini-title { font-weight: 800; letter-spacing: .01em; }
.drd-mini-d3 .mini-note { color: var(--muted); font-size: .82rem; margin-top: .2rem; }
.drd-mini-d3 .mini-tabs { display: flex; flex-wrap: wrap; gap: .35rem; }
.drd-mini-d3 button {
  border: 1px solid rgba(232,255,246,.18);
  border-radius: 999px;
  background: rgba(255,255,255,.05);
  color: var(--ink);
  padding: .32rem .62rem;
  font-size: .75rem;
  cursor: pointer;
}
.drd-mini-d3 button.active {
  border-color: rgba(99,230,190,.72);
  background: rgba(99,230,190,.18);
}
.drd-mini-d3 svg {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
  background: rgba(2,8,7,.36);
}
</style>

<div id="d3-head-split-local" class="drd-mini-d3">
  <div class="mini-head">
    <div>
      <div class="mini-title">Hidden dimension -> attention heads</div>
      <div class="mini-note">같은 C=768을 H개 head로 쪼개면 head_dim = C / H가 된다.</div>
    </div>
    <div class="mini-tabs" aria-label="head count">
      <button type="button" data-heads="6">6 heads</button>
      <button type="button" data-heads="12" class="active">12 heads</button>
      <button type="button" data-heads="24">24 heads</button>
    </div>
  </div>
  <svg viewBox="0 0 980 300" role="img" aria-label="Hidden dimension split into attention heads"></svg>
</div>
<script>
(function () {
  const root = document.querySelector('#d3-head-split-local');
  if (!root || !window.d3) return;
  const svg = d3.select(root).select('svg');
  const C = 768;
  function draw(heads) {
    const D = C / heads;
    svg.selectAll('*').remove();
    svg.append('text').attr('x', 34).attr('y', 42).attr('fill', '#e8fff6').attr('font-size', 20).attr('font-weight', 800)
      .text(`x: [B, T, ${C}]  ->  q: [B, ${heads}, T, ${D}]`);
    svg.append('rect').attr('x', 42).attr('y', 82).attr('width', 896).attr('height', 62).attr('rx', 12)
      .attr('fill', 'rgba(99,230,190,.12)').attr('stroke', '#63e6be');
    const cellW = 896 / heads;
    const data = d3.range(heads);
    const g = svg.selectAll('g.head').data(data).enter().append('g').attr('transform', d => `translate(${42 + d*cellW},82)`);
    g.append('rect').attr('width', cellW - 2).attr('height', 62).attr('rx', 8)
      .attr('fill', (d) => d % 2 ? 'rgba(116,192,252,.22)' : 'rgba(255,209,102,.20)')
      .attr('stroke', 'rgba(232,255,246,.22)');
    g.filter((d) => heads <= 12 || d % 2 === 0).append('text').attr('x', cellW/2).attr('y', 37).attr('text-anchor', 'middle')
      .attr('fill', '#e8fff6').attr('font-size', heads > 12 ? 11 : 13).text(d => `h${d}`);
    svg.append('text').attr('x', 42).attr('y', 190).attr('fill', '#a4c7ba').attr('font-size', 15)
      .text(`각 head는 ${D}차원 q/k/v 공간에서 attention을 계산한다. token 수 T와는 다른 축이다.`);
    svg.append('text').attr('x', 42).attr('y', 224).attr('fill', '#a4c7ba').attr('font-size', 15)
      .text(`공식: hidden_dim(${C}) = num_heads(${heads}) * head_dim(${D})`);
  }
  root.querySelectorAll('button[data-heads]').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    draw(+btn.dataset.heads);
  }));
  draw(12);
})();
</script>

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


아래 D3 패널은 `[B,T,C]` 큐브에서 어느 축으로 통계를 내는지 강조한다. LayerNorm은 token 하나의 `C` 방향, BatchNorm은 같은 channel의 `B/T` 방향, RMSNorm은 LayerNorm처럼 `C` 방향을 보되 평균 제거 없이 scale만 맞춘다.

<div id="d3-norm-axis-local" class="drd-mini-d3">
  <div class="mini-head">
    <div>
      <div class="mini-title">Normalization axis on [B, T, C]</div>
      <div class="mini-note">정규화는 값 자체보다 “어느 축의 통계인가”가 핵심이다.</div>
    </div>
    <div class="mini-tabs" aria-label="normalization mode">
      <button type="button" data-mode="layer" class="active">LayerNorm</button>
      <button type="button" data-mode="batch">BatchNorm</button>
      <button type="button" data-mode="rms">RMSNorm</button>
    </div>
  </div>
  <svg viewBox="0 0 980 330" role="img" aria-label="Normalization axes for BatchNorm, LayerNorm, and RMSNorm"></svg>
</div>
<script>
(function () {
  const root = document.querySelector('#d3-norm-axis-local');
  if (!root || !window.d3) return;
  const svg = d3.select(root).select('svg');
  const modes = {
    layer: {title:'LayerNorm: x[b,t,:]', note:'각 token마다 C 방향 평균/분산을 낸다.', color:'#63e6be'},
    batch: {title:'BatchNorm: x[:,:,c]', note:'같은 channel c에 대해 B/T 방향 통계를 낸다.', color:'#ffd166'},
    rms: {title:'RMSNorm: x[b,t,:] scale only', note:'LayerNorm처럼 C 방향을 보지만 mean subtraction 없이 RMS로 scale만 맞춘다.', color:'#f783ac'}
  };
  function draw(mode) {
    const m = modes[mode];
    svg.selectAll('*').remove();
    svg.append('text').attr('x',34).attr('y',40).attr('fill','#e8fff6').attr('font-size',20).attr('font-weight',800).text(m.title);
    svg.append('text').attr('x',34).attr('y',68).attr('fill','#a4c7ba').attr('font-size',15).text(m.note);
    const x0=120, y0=120, cell=34, gap=10;
    const cells=[];
    for (let b=0;b<3;b++) for (let t=0;t<5;t++) for (let c=0;c<6;c++) cells.push({b,t,c});
    function pos(d) { return {x:x0 + d.t*cell + d.c*5 + d.b*210, y:y0 + d.c*7}; }
    svg.selectAll('rect.cube').data(cells).enter().append('rect')
      .attr('x', d => pos(d).x).attr('y', d => pos(d).y).attr('width', cell-5).attr('height', 22).attr('rx', 5)
      .attr('fill', d => {
        if (mode === 'batch') return d.c === 2 ? m.color + 'cc' : 'rgba(232,255,246,.08)';
        if (mode === 'layer' || mode === 'rms') return d.b === 1 && d.t === 2 ? m.color + 'cc' : 'rgba(232,255,246,.08)';
      })
      .attr('stroke', 'rgba(232,255,246,.18)');
    svg.selectAll('text.b').data([0,1,2]).enter().append('text')
      .attr('x', d => x0 + d*210 + 62).attr('y', 255).attr('text-anchor','middle')
      .attr('fill','#a4c7ba').attr('font-size',14).text(d => `batch ${d}`);
    svg.append('text').attr('x',34).attr('y',300).attr('fill','#a4c7ba').attr('font-size',15)
      .text(mode === 'batch' ? '노란 줄: 여러 batch/token의 같은 channel 값들' : '강조된 묶음: 한 token의 hidden vector 전체');
  }
  root.querySelectorAll('button[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    draw(btn.dataset.mode);
  }));
  draw('layer');
})();
</script>

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


아래 D3 패널은 GPT-2/nanoGPT MLP와 LLaMA SwiGLU MLP를 비교한다. 둘 다 token별 FFN이지만, LLaMA는 `gate_proj`와 `up_proj`를 곱하는 gating 경로가 추가된다.

<div id="d3-mlp-local" class="drd-mini-d3">
  <div class="mini-head">
    <div>
      <div class="mini-title">MLP / FFN path comparison</div>
      <div class="mini-note">Attention은 token을 섞고, MLP는 각 token의 feature를 가공한다.</div>
    </div>
    <div class="mini-tabs" aria-label="MLP mode">
      <button type="button" data-mode="gpt" class="active">GPT-2 / nanoGPT</button>
      <button type="button" data-mode="llama">LLaMA SwiGLU</button>
    </div>
  </div>
  <svg viewBox="0 0 980 330" role="img" aria-label="GPT-2 MLP versus LLaMA SwiGLU MLP"></svg>
</div>
<script>
(function () {
  const root = document.querySelector('#d3-mlp-local');
  if (!root || !window.d3) return;
  const svg = d3.select(root).select('svg');
  function box(x,y,w,h,label,color) {
    const g=svg.append('g').attr('transform',`translate(${x},${y})`);
    g.append('rect').attr('width',w).attr('height',h).attr('rx',14).attr('fill',color+'24').attr('stroke',color);
    label.split('\n').forEach((line,i)=>g.append('text').attr('x',w/2).attr('y',h/2-8+i*20).attr('text-anchor','middle').attr('fill','#e8fff6').attr('font-size',15).attr('font-weight',700).text(line));
  }
  function link(x1,y1,x2,y2) {
    svg.append('path').attr('d',`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`).attr('fill','none').attr('stroke','rgba(232,255,246,.45)').attr('stroke-width',2);
  }
  function draw(mode) {
    svg.selectAll('*').remove();
    svg.append('text').attr('x',34).attr('y',42).attr('fill','#e8fff6').attr('font-size',20).attr('font-weight',800)
      .text(mode === 'gpt' ? 'GPT-2/nanoGPT: Linear -> GELU -> Linear' : 'LLaMA: SwiGLU gate path');
    if (mode === 'gpt') {
      box(70,135,150,75,'x\n[B,T,C]','#63e6be');
      box(300,125,170,95,'c_fc\nC -> 4C','#ffd166');
      box(545,135,135,75,'GELU','#74c0fc');
      box(750,125,165,95,'c_proj\n4C -> C','#f783ac');
      link(220,172,300,172); link(470,172,545,172); link(680,172,750,172);
      svg.append('text').attr('x',70).attr('y',270).attr('fill','#a4c7ba').attr('font-size',15).text('각 token position마다 같은 FFN을 독립 적용한다. token끼리 섞지는 않는다.');
    } else {
      box(70,135,150,75,'x\n[B,T,C]','#63e6be');
      box(300,85,170,75,'gate_proj\nC -> I','#ffd166');
      box(300,205,170,75,'up_proj\nC -> I','#74c0fc');
      box(535,85,130,75,'SiLU','#ffd166');
      box(710,145,90,70,'*','#f783ac');
      box(850,135,100,90,'down\nI -> C','#63e6be');
      link(220,172,300,122); link(220,172,300,242); link(470,122,535,122); link(665,122,710,170); link(470,242,710,180); link(800,180,850,180);
      svg.append('text').attr('x',70).attr('y',305).attr('fill','#a4c7ba').attr('font-size',15).text('gate가 value candidate를 조절한 뒤 down_proj로 hidden size C에 되돌린다.');
    }
  }
  root.querySelectorAll('button[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    draw(btn.dataset.mode);
  }));
  draw('gpt');
})();
</script>

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
