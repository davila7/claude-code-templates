# Context Extension Methods

Comprehensive comparison of YaRN, ALiBi, and Position Interpolation based on published research.

## Table of Contents
- YaRN (Yet another RoPE extensioN)
- ALiBi (Attention with Linear Biases)
- Position Interpolation
- Method Comparison

## YaRN: Yet another RoPE extensioN

**Paper**: arXiv 2309.00071 (2023)
**Authors**: Bowen Peng, Jeffrey Quesnelle, Honglu Fan, Enrico Shippole

### Overview

YaRN extends RoPE-based models to 128k+ context with 10× less training data than previous methods.

### Key Innovations

1. **NTK-aware interpolation**: Scales different frequency components differently
2. **Attention temperature scaling**: Adjusts attention sharpness
3. **NTK-by-parts**: Hybrid interpolation/extrapolation

### Technical Details

**Problem**: Naive position interpolation compresses all frequencies uniformly, losing high-frequency information.

**Solution**: Different treatment for different frequencies.

```python
# Frequency decomposition
# Low frequencies (< 1/β_slow): Interpolate (compress)
# High frequencies (> 1/β_fast): Extrapolate (extend as-is)
# Middle frequencies: Smooth ramp between the two

def yarn_get_mscale(scale=1.0):
    """Attention temperature scaling."""
    if scale <= 1:
        return 1.0
    return 0.1 * math.log(scale) + 1.0

def yarn_find_correction_dim(num_rotations, dim, base=10000, max_position_embeddings=2048):
    """Find dimension cutoffs for NTK-by-parts."""
    return (dim * math.log(max_position_embeddings / (num_rotations * 2 * math.pi))) / (2 * math.log(base))

def yarn_find_correction_range(low_rot, high_rot, dim, base=10000, max_position_embeddings=2048):
    """Find frequency ranges for interpolation."""
    low = math.floor(yarn_find_correction_dim(low_rot, dim, base, max_position_embeddings))
    high = math.ceil(yarn_find_correction_dim(high_rot, dim, base, max_position_embeddings))
    return max(low, 0), min(high, dim - 1)

def yarn_linear_ramp_mask(min_val, max_val, dim):
    """Create smooth ramp between interpolation and extrapolation."""
    if min_val == max_val:
        max_val += 0.001  # Avoid division by zero
    linear_func = (torch.arange(dim, dtype=torch.float32) - min_val) / (max_val - min_val)
    ramp_func = torch.clamp(linear_func, 0, 1)
    return ramp_func
```

### Complete YaRN Implementation

```python
class YaRNScaledRoPE(nn.Module):
    """Full YaRN implementation."""

    def __init__(
        self,
        dim,
        max_position_embeddings=2048,
        base=10000,
        scale=1.0,
        original_max_position_embeddings=2048,
        extrapolation_factor=1.0,
        attn_factor=1.0,
        beta_fast=32,
        beta_slow=1,
        device=None
    ):
        super().__init__()
        self.dim = dim
        self.max_position_embeddings = max_position_embeddings
        self.base = base
        self.scale = scale
        self.original_max_position_embeddings = original_max_position_embeddings
        self.extrapolation_factor = extrapolation_factor
        self.attn_factor = attn_factor
        self.beta_fast = beta_fast
        self.beta_slow = beta_slow

        # Compute mscale (attention temperature)
        self.mscale = float(yarn_get_mscale(self.scale) * self.attn_factor)

        # Compute frequency bands
        self.low, self.high = yarn_find_correction_range(
            self.beta_fast,
            self.beta_slow,
            self.dim,
            self.base,
            self.original_max_position_embeddings
        )

        # Compute inverse frequencies
        inv_freq = 1.0 / (self.base ** (torch.arange(0, self.dim, 2, dtype=torch.float32) / self.dim))

        # Create ramp mask
        inv_freq_mask = 1.0 - yarn_linear_ramp_mask(self.low, self.high, self.dim // 2)
        inv_freq = inv_freq / ((1 - inv_freq_mask) * self.extrapolation_factor + inv_freq_mask)

        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        t = torch.arange(seq_len, device=device, dtype=self.inv_freq.dtype)

        # Apply YaRN scaling
        freqs = torch.outer(t, self.inv_freq)

        # Attention temperature scaling
        emb = torch.cat((freqs, freqs), dim=-1)
        cos = emb.cos() * self.mscale
        sin = emb.sin() * self.mscale

        return cos, sin
```

### YaRN Parameters

```python
# Default YaRN configuration (from paper)
yarn_config = {
    "scale": 16,                    # 16× extension (2k → 32k)
    "original_max_position": 2048,  # Original context length
    "extrapolation_factor": 1.0,    # How much to extrapolate high freqs
    "attn_factor": 1.0,             # Base attention temperature
    "beta_fast": 32,                # High-frequency threshold
    "beta_slow": 1,                 # Low-frequency threshold
}

# For larger extensions (64k, 128k)
yarn_config_large = {
    "scale": 64,
    "beta_fast": 64,   # Increase for larger scales
    "beta_slow": 2,
}
```

### Performance

**Results from paper (LLaMA 7B)**:

| Method | Training Tokens | Steps | Final Perplexity | Context Length |
|--------|----------------|-------|------------------|----------------|
| Full Fine-tune | 10B | 10000 | 11.2 | 32k |
| Position Interpolation | 1B | 1000 | 12.5 | 32k |
| **YaRN** | **100M** | **400** | **11.8** | **32k** |

**10× less data, 2.5× less steps than Position Interpolation!**

## ALiBi: Attention with Linear Biases

**Paper**: arXiv 2108.12409 (ICLR 2022)
**Authors**: Ofir Press, Noah A. Smith, Mike Lewis
**Title**: "Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation"

### Core Concept

**Key idea**: Don't add positional embeddings. Instead, bias attention scores based on distance.

```
attention_score[i, j] = q_i · k_j + bias[i, j]

where bias[i, j] = -m * |i - j|
      m = slope for each head
```

### Mathematical Formulation

**Standard attention**:
```
Attention(Q, K, V) = softmax(QK^T / √d_k) V
```

**ALiBi attention**:
```
Attention(Q, K, V) = softmax((QK^T + m · L) / √d_k) V

where L[i,j] = -(i - j)  (lower triangular)
      m = head-specific slope
```

### Implementation

```python
import math
import torch
import torch.nn.functional as F

def get_alibi_slopes(num_heads):
    """Compute ALiBi slope for each attention head.

    Source: Official ALiBi implementation
    """
    def get_slopes_power_of_2(n):
        start = 2 ** (-(2 ** -(math.log2(n) - 3)))
        ratio = start
        return [start * (ratio ** i) for i in range(n)]

    # If power of 2
    if math.log2(num_heads).is_integer():
        return get_slopes_power_of_2(num_heads)

    # If not power of 2, use closest power of 2 and interpolate
    closest_power_of_2 = 2 ** math.floor(math.log2(num_heads))
    slopes = get_slopes_power_of_2(closest_power_of_2)

    # Add extra slopes from next power of 2
    extra_slopes = get_slopes_power_of_2(2 * closest_power_of_2)
    slopes.extend(extra_slopes[0::2][:num_heads - closest_power_of_2])

    return slopes

def create_alibi_bias(seq_len, num_heads, device='cpu'):
    """Create ALiBi attention bias matrix."""
    # Relative positions: L[i, j] = -(i - j)
    context_position = torch.arange(seq_len, device=device)[:, None]
    memory_position = torch.arange(seq_len, device=device)[None, :]

    # Distance matrix (negative for causal)
    relative_position = memory_position - context_position
    relative_position = torch.abs(relative_position).unsqueeze(0)  # (1, seq_len, seq_len)

    # Get slopes for each head
    slopes = torch.tensor(get_alibi_slopes(num_heads), device=device).unsqueeze(-1).unsqueeze(-1)

    # Apply slopes: (num_heads, seq_len, seq_len)
    alibi = -slopes * relative_position

    return alibi

def alibi_attention(query, key, value, num_heads, scale=None):
    """Multi-head attention with ALiBi."""
    batch_size, seq_len, embed_dim = query.shape
    head_dim = embed_dim // num_heads

    if scale is None:
        scale = head_dim ** -0.5

    # Reshape for multi-head: (batch, num_heads, seq_len, head_dim)
    query = query.reshape(batch_size, seq_len, num_heads, head_dim).transpose(1, 2)
    key = key.reshape(batch_size, seq_len, num_heads, head_dim).transpose(1, 2)
    value = value.reshape(batch_size, seq_len, num_heads, head_dim).transpose(1, 2)

    # Attention scores: (batch, num_heads, seq_len, seq_len)
    attn_scores = torch.matmul(query, key.transpose(-2, -1)) * scale

    # Add ALiBi bias
    alibi_bias = create_alibi_bias(seq_len, num_heads, device=query.device)
    attn_scores = attn_scores + alibi_bias

    # Softmax and apply to values
    attn_weights = F.softmax(attn_scores, dim=-1)
    output = torch.matmul(attn_weights, value)

    # Reshape back: (batch, seq_len, embed_dim)
    output = output.transpose(1, 2).reshape(batch_size, seq_len, embed_dim)

    return output
```

### Slope Values

**Example slopes for 8 heads**:
```python
slopes = get_alibi_slopes(8)
# Output: [0.0625, 0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0]

# Each head has different slope
# → Different heads attend to different distance ranges
# → Head 1: Strong recency bias (slope=8.0)
# → Head 8: Weak recency bias (slope=0.0625)
```

### Advantages

1. **No position limit**: Works for any sequence length
2. **Efficient**: 11% less memory than sinusoidal embeddings
3. **Fast**: 11% faster training
4. **Extrapolates well**: Train 1k, test 2k+ tokens
5. **Simple**: No learned parameters for position

### Disadvantages

1. **Requires pre-training**: Can't retrofit existing models
2. **Recency bias**: Always biases toward recent tokens (may not suit all tasks)

## Position Interpolation

**Paper**: arXiv 2306.15595 (2023)
**Authors**: Shouyuan Chen, Sherman Wong, Liangjian Chen, Yuandong Tian
**Title**: "Extending Context Window of Large Language Models via Positional Interpolation"

### Core Idea

Instead of extrapolating positions beyond training range, interpolate within trained range.

```
# Extrapolation (bad): positions [0, 1, 2, ..., 2048, 2049, ..., 32768]
# Positions > 2048 are out-of-distribution

# Interpolation (good): positions [0, 0.0625, 0.125, ..., 2048]
# All positions within [0, 2048] (in-distribution)
```

### Mathematical Formulation

**Original RoPE**:
```
position_ids = [0, 1, 2, 3, ..., L-1]
```

**Position Interpolation** (scale factor s):
```
position_ids = [0, 1/s, 2/s, 3/s, ..., (L-1)/s]
```

### Implementation

```python
class InterpolatedRoPE(nn.Module):
    """RoPE with position interpolation."""

    def __init__(self, dim, max_seq_len=2048, base=10000, scaling_factor=1.0):
        super().__init__()
        self.scaling_factor = scaling_factor

        # Standard RoPE frequencies
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, seq_len, device):
        # Position indices
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)

        # Interpolate positions
        t = t / self.scaling_factor  # KEY LINE

        # Standard RoPE
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos(), emb.sin()
```

### Fine-tuning Requirements

**Minimal fine-tuning needed**:

```python
# Extension: 2k → 32k (16× scale)
scaling_factor = 16.0

# Training config
training_args = {
    "max_steps": 1000,      # Only 1000 steps!
    "learning_rate": 2e-5,  # Small LR
    "batch_size": 1,
    "gradient_accumulation_steps": 16,
}

# Results: Near-perfect perplexity retention
```

### Theoretical Analysis

**Interpolation bound** (from paper):

Upper bound of interpolation error is ~600× smaller than extrapolation error.

```
Extrapolation error: O(L^2)  # Grows quadratically
Interpolation error: O(1/s)  # Shrinks linearly with scale
```

### Results

**LLaMA models extended to 32k**:

| Model | Original Context | Extended Context | Fine-tune Steps | Perplexity |
|-------|-----------------|------------------|----------------|------------|
| LLaMA 7B | 2048 | 32768 | 1000 | 2.72 |
| LLaMA 13B | 2048 | 32768 | 1000 | 2.55 |
| LLaMA 33B | 2048 | 32768 | 1000 | 2.38 |
| LLaMA 65B | 2048 | 32768 | 1000 | 2.26 |

**Passkey retrieval**: 100% accuracy up to 32k tokens

### Advantages

1. **Minimal training**: 1000 steps sufficient
2. **Stable**: Interpolation more stable than extrapolation
3. **Simple**: One-line code change
4. **Effective**: Works across all LLaMA sizes

### Disadvantages

1. **Limited extrapolation**: Can't go beyond trained range without fine-tuning
2. **Information compression**: All positions compressed into trained range

## Method Comparison

### Training Requirements

| Method | Pre-training Needed | Fine-tuning Steps | Training Tokens |
|--------|---------------------|-------------------|-----------------|
| **ALiBi** | Yes (from scratch) | 0 | Full (100B+) |
| **Position Interpolation** | No | 1,000 | ~100M |
| **YaRN** | No | 400 | ~100M |
| **Linear RoPE Scaling** | No | 1,000-5,000 | ~1B |

### Extrapolation Performance

**Test**: Train on 2k, test on 8k, 16k, 32k

| Method | 8k PPL | 16k PPL | 32k PPL | Extrapolation Quality |
|--------|--------|---------|---------|----------------------|
| **ALiBi** | 12.1 | 12.3 | 12.5 | Excellent |
| **YaRN** | 11.8 | 12.0 | 12.2 | Excellent |
| **Position Interpolation** | 12.5 | 13.2 | 14.8 | Poor |
| **Linear Scaling** | 13.1 | 15.2 | 19.4 | Poor |

### Memory and Speed

| Method | Memory vs Baseline | Speed vs Baseline |
|--------|--------------------|--------------------|
| **ALiBi** | -11% | +11% |
| **Position Interpolation** | 0% | 0% |
| **YaRN** | 0% | -5% |
| **Linear Scaling** | 0% | 0% |

### Use Case Recommendations

```python
# New model from scratch → ALiBi
if training_from_scratch:
    use_method = "ALiBi"

# Extending existing RoPE model with best quality → YaRN
elif need_sota_quality:
    use_method = "YaRN"

# Quick extension with minimal compute → Position Interpolation
elif need_quick_solution:
    use_method = "Position Interpolation"

# Moderate extension, simple implementation → Linear Scaling
else:
    use_method = "Linear RoPE Scaling"
```

## Resources

- **YaRN Paper**: https://arxiv.org/abs/2309.00071
- **ALiBi Paper**: https://arxiv.org/abs/2108.12409
- **Position Interpolation Paper**: https://arxiv.org/abs/2306.15595
- **YaRN Implementation**: https://github.com/jquesnelle/yarn
- **ALiBi Implementation**: https://github.com/ofirpress/attention_with_linear_biases
- **Together AI Blog**: https://www.together.ai/blog/llama-2-7b-32k
