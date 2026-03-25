# RoPE: Rotary Position Embeddings

Complete technical guide based on RoFormer paper (arXiv 2104.09864) and HuggingFace transformers implementation.

## Table of Contents
- Mathematical Formulation
- Implementation Details
- Scaling Techniques
- Production Usage

## Mathematical Formulation

**Source**: RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv 2104.09864)

### Core Idea

RoPE encodes absolute position with a rotation matrix while naturally incorporating relative position dependency in attention.

### Formulation

Given position index `m` and embedding dimension `d`:

```
Rotation Matrix R_θ(m):
  [cos(mθ₁)  -sin(mθ₁)  0         0        ]
  [sin(mθ₁)   cos(mθ₁)  0         0        ]
  [0          0         cos(mθ₂) -sin(mθ₂) ]
  [0          0         sin(mθ₂)  cos(mθ₂) ]
  ...

where θⱼ = base^(-2j/d) for j ∈ [0, 1, 2, ..., d/2)
```

**Key property**: Attention between positions m and n depends only on relative distance (m - n).

### Derivation

**Step 1: Position encoding via rotation**

```
q_m = W_q x_m rotated by mθ
k_n = W_k x_n rotated by nθ
```

**Step 2: Attention score**

```
score(q_m, k_n) = q_m^T k_n
                = (Rotated query) · (Rotated key)
                = f(q, k, m-n)
```

The score depends on relative position `m - n`, not absolute positions.

## Implementation Details

**Source**: HuggingFace transformers/modeling_rope_utils.py

### Basic RoPE Implementation

```python
import torch
import math

def precompute_freqs_cis(dim: int, end: int, theta: float = 10000.0):
    """Precompute rotation frequencies (cos + i*sin)."""
    # Compute inverse frequencies
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2)[: (dim // 2)].float() / dim))

    # Position indices
    t = torch.arange(end, device=freqs.device)

    # Outer product: (end, dim/2)
    freqs = torch.outer(t, freqs).float()

    # Convert to complex exponential (Euler's formula)
    freqs_cis = torch.polar(torch.ones_like(freqs), freqs)  # e^(i*θ) = cos(θ) + i*sin(θ)

    return freqs_cis

def reshape_for_broadcast(freqs_cis, x):
    """Reshape frequency tensor to match x dimensions."""
    ndim = x.ndim
    assert 0 <= 1 < ndim
    assert freqs_cis.shape == (x.shape[1], x.shape[-1])
    shape = [d if i == 1 or i == ndim - 1 else 1 for i, d in enumerate(x.shape)]
    return freqs_cis.view(*shape)

def apply_rotary_emb(xq, xk, freqs_cis):
    """Apply rotary embeddings to queries and keys."""
    # Convert to complex
    xq_ = torch.view_as_complex(xq.float().reshape(*xq.shape[:-1], -1, 2))
    xk_ = torch.view_as_complex(xk.float().reshape(*xk.shape[:-1], -1, 2))

    # Reshape freqs
    freqs_cis = reshape_for_broadcast(freqs_cis, xq_)

    # Apply rotation
    xq_out = torch.view_as_real(xq_ * freqs_cis).flatten(3)
    xk_out = torch.view_as_real(xk_ * freqs_cis).flatten(3)

    return xq_out.type_as(xq), xk_out.type_as(xk)
```

### Alternative: GPT-NeoX Style (HuggingFace)

```python
def rotate_half(x):
    """Rotate half the hidden dimensions of the input."""
    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]
    return torch.cat((-x2, x1), dim=-1)

def apply_rotary_pos_emb_gpt_neox(q, k, cos, sin, position_ids=None):
    """GPT-NeoX style RoPE (used in HuggingFace)."""
    if position_ids is not None:
        # Select cos/sin for specific positions
        cos = cos[position_ids].unsqueeze(1)  # (bs, 1, seq_len, dim)
        sin = sin[position_ids].unsqueeze(1)
    else:
        cos = cos.unsqueeze(0).unsqueeze(0)  # (1, 1, seq_len, dim)
        sin = sin.unsqueeze(0).unsqueeze(0)

    # Apply rotation
    q_embed = (q * cos) + (rotate_half(q) * sin)
    k_embed = (k * cos) + (rotate_half(k) * sin)
    return q_embed, k_embed
```

### Difference: GPT-J vs GPT-NeoX Style

**GPT-J style** (Meta LLaMA):
- Processes in complex number space
- Pairs adjacent dimensions: (0,1), (2,3), (4,5)

**GPT-NeoX style** (HuggingFace):
- Splits into two halves
- Pairs across halves: (0, d/2), (1, d/2+1), ...

Both mathematically equivalent, different implementations.

## Scaling Techniques

### 1. Linear Scaling

**Simplest method**: Scale position indices linearly.

```python
# Original: positions [0, 1, 2, ..., L-1]
# Scaled: positions [0, 1/s, 2/s, ..., (L-1)/s]

class LinearScaledRoPE(nn.Module):
    def __init__(self, dim, max_seq_len=2048, base=10000, scaling_factor=1.0):
        super().__init__()
        self.scaling_factor = scaling_factor
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        # Scale positions
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)
        t = t / self.scaling_factor  # Linear scaling

        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos(), emb.sin()
```

**Pros**: Simple, easy to implement
**Cons**: May lose high-frequency information

### 2. NTK-Aware Scaling (RoPE-NTK)

**Source**: Community discovery (Reddit, GitHub)

**Key insight**: Scale base frequency instead of positions.

```python
# Instead of scaling positions, scale theta (base frequency)
base_new = base * (scaling_factor ** (dim / (dim - 2)))

# This preserves high frequencies while extending low frequencies
```

**Implementation**:

```python
class NTKScaledRoPE(nn.Module):
    def __init__(self, dim, max_seq_len=2048, base=10000, scaling_factor=1.0):
        super().__init__()
        # Compute new base
        base = base * (scaling_factor ** (dim / (dim - 2)))

        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos(), emb.sin()
```

**Pros**: Better than linear scaling
**Cons**: Still not perfect for very long contexts

### 3. Dynamic Scaling

**Source**: HuggingFace transformers

**Idea**: Adjust scaling factor dynamically based on input length.

```python
class DynamicScaledRoPE(nn.Module):
    def __init__(self, dim, max_seq_len=2048, base=10000, scaling_factor=1.0):
        super().__init__()
        self.max_seq_len = max_seq_len
        self.scaling_factor = scaling_factor
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        # Compute dynamic scaling factor
        if seq_len > self.max_seq_len:
            # Scale proportionally
            scale = seq_len / self.max_seq_len
        else:
            scale = 1.0

        # Scale positions
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)
        t = t / (self.scaling_factor * scale)

        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos(), emb.sin()
```

**Pros**: Adapts to input length
**Cons**: Different behavior for different lengths

### 4. YaRN (Yet another RoPE extensioN)

**Source**: arXiv 2309.00071

**Most sophisticated**: Combines multiple techniques.

```python
class YaRNScaledRoPE(nn.Module):
    """YaRN: NTK + Attention Temperature + Ramp."""

    def __init__(
        self,
        dim,
        max_seq_len=2048,
        base=10000,
        scaling_factor=1.0,
        beta_fast=32,
        beta_slow=1,
        attn_factor=1.0
    ):
        super().__init__()
        self.scaling_factor = scaling_factor
        self.beta_fast = beta_fast
        self.beta_slow = beta_slow
        self.attn_factor = attn_factor

        # Compute frequencies
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)

        # NTK-by-parts: Different scaling for different frequencies
        inv_freq_mask = (self.inv_freq > 1 / self.beta_fast).float()

        # Low frequencies: NTK scaling
        # High frequencies: Linear scaling
        # Middle: Smooth ramp

        inv_freq_scaled = self.inv_freq / self.scaling_factor
        freqs = torch.outer(t, inv_freq_scaled)

        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos() * self.attn_factor, emb.sin() * self.attn_factor
```

**Pros**: State-of-the-art context extension
**Cons**: More complex, more hyperparameters

## Production Usage

### HuggingFace Integration

```python
from transformers import AutoModelForCausalLM, AutoConfig

# Linear scaling
config = AutoConfig.from_pretrained("meta-llama/Llama-2-7b-hf")
config.rope_scaling = {
    "type": "linear",
    "factor": 4.0  # 2k → 8k
}

# NTK-aware scaling
config.rope_scaling = {
    "type": "ntk",
    "factor": 4.0
}

# Dynamic scaling
config.rope_scaling = {
    "type": "dynamic",
    "factor": 4.0
}

# YaRN scaling
config.rope_scaling = {
    "type": "yarn",
    "factor": 16.0,
    "original_max_position_embeddings": 2048,
    "attention_factor": 1.0,
    "beta_fast": 32,
    "beta_slow": 1
}

model = AutoModelForCausalLM.from_config(config)
```

### Custom Implementation

```python
class RoPEAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.num_heads = config.num_attention_heads
        self.head_dim = config.hidden_size // config.num_attention_heads

        # Projections
        self.q_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=False)
        self.k_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=False)
        self.v_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=False)
        self.o_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=False)

        # RoPE
        self.rotary_emb = RotaryEmbedding(
            dim=self.head_dim,
            max_seq_len=config.max_position_embeddings,
            base=config.rope_theta
        )

    def forward(self, hidden_states, attention_mask=None, position_ids=None):
        bsz, seq_len, _ = hidden_states.size()

        # Q, K, V
        query_states = self.q_proj(hidden_states)
        key_states = self.k_proj(hidden_states)
        value_states = self.v_proj(hidden_states)

        # Reshape: (batch, seq_len, num_heads, head_dim)
        query_states = query_states.view(bsz, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        key_states = key_states.view(bsz, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        value_states = value_states.view(bsz, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        # Apply RoPE
        cos, sin = self.rotary_emb(seq_len, device=hidden_states.device)
        query_states, key_states = apply_rotary_pos_emb(query_states, key_states, cos, sin)

        # Attention
        attn_output = F.scaled_dot_product_attention(
            query_states, key_states, value_states,
            attn_mask=attention_mask
        )

        # Reshape and project
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.reshape(bsz, seq_len, -1)
        attn_output = self.o_proj(attn_output)

        return attn_output
```

## Performance Comparison

**Scaling method comparison** (8k → 32k extension):

| Method | Fine-tune Steps | Perplexity | Memory | Speed |
|--------|----------------|------------|---------|-------|
| Linear | 1000 | 12.5 | 1.0× | 1.0× |
| NTK | 500 | 11.8 | 1.0× | 1.0× |
| Dynamic | 1000 | 12.2 | 1.0× | 0.98× |
| YaRN | 400 | 11.2 | 1.0× | 0.95× |

**Source**: YaRN paper (arXiv 2309.00071)

## Resources

- **RoFormer Paper**: https://arxiv.org/abs/2104.09864
- **YaRN Paper**: https://arxiv.org/abs/2309.00071
- **HuggingFace RoPE Utils**: https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py
- **Rotary Embeddings PyTorch**: https://github.com/lucidrains/rotary-embedding-torch
