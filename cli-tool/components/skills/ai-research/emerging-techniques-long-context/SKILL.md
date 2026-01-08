---
name: long-context
description: Extend context windows of transformer models using RoPE, YaRN, ALiBi, and position interpolation techniques. Use when processing long documents (32k-128k+ tokens), extending pre-trained models beyond original context limits, or implementing efficient positional encodings. Covers rotary embeddings, attention biases, interpolation methods, and extrapolation strategies for LLMs.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Emerging Techniques, Long Context, RoPE, YaRN, ALiBi, Position Interpolation, Extended Context, Rotary Embeddings, Attention Bias, Context Extension, Positional Encoding]
dependencies: [transformers, torch, flash-attn]
---

# Long Context: Extending Transformer Context Windows

## When to Use This Skill

Use Long Context techniques when you need to:
- **Process long documents** (32k, 64k, 128k+ tokens) with transformer models
- **Extend context windows** of pre-trained models (LLaMA, Mistral, etc.)
- **Implement efficient positional encodings** (RoPE, ALiBi)
- **Train models** with length extrapolation capabilities
- **Deploy models** that handle variable-length inputs efficiently
- **Fine-tune** existing models for longer contexts with minimal compute

**Key Techniques**: RoPE (Rotary Position Embeddings), YaRN, ALiBi (Attention with Linear Biases), Position Interpolation

**Papers**: RoFormer (arXiv 2104.09864), YaRN (arXiv 2309.00071), ALiBi (arXiv 2108.12409), Position Interpolation (arXiv 2306.15595)

## Installation

```bash
# HuggingFace Transformers (includes RoPE, YaRN support)
pip install transformers torch

# For custom implementations
pip install einops  # Tensor operations
pip install rotary-embedding-torch  # Standalone RoPE

# Optional: FlashAttention for efficiency
pip install flash-attn --no-build-isolation
```

## Quick Start

### RoPE (Rotary Position Embeddings)

```python
import torch
import torch.nn as nn

class RotaryEmbedding(nn.Module):
    """Rotary Position Embeddings (RoPE)."""

    def __init__(self, dim, max_seq_len=8192, base=10000):
        super().__init__()
        # Compute inverse frequencies
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)
        self.max_seq_len = max_seq_len

    def forward(self, seq_len, device):
        # Position indices
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)

        # Compute frequencies
        freqs = torch.outer(t, self.inv_freq)  # (seq_len, dim/2)

        # Compute sin and cos
        emb = torch.cat((freqs, freqs), dim=-1)  # (seq_len, dim)
        return emb.cos(), emb.sin()

def rotate_half(x):
    """Rotate half the hidden dimensions."""
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat((-x2, x1), dim=-1)

def apply_rotary_pos_emb(q, k, cos, sin):
    """Apply rotary embeddings to queries and keys."""
    # q, k shape: (batch, heads, seq_len, dim)
    q_embed = (q * cos) + (rotate_half(q) * sin)
    k_embed = (k * cos) + (rotate_half(k) * sin)
    return q_embed, k_embed

# Usage
rope = RotaryEmbedding(dim=64, max_seq_len=8192)
cos, sin = rope(seq_len=2048, device='cuda')

# In attention layer
q_rotated, k_rotated = apply_rotary_pos_emb(query, key, cos, sin)
```

### ALiBi (Attention with Linear Biases)

```python
def get_alibi_slopes(num_heads):
    """Get ALiBi slope values for each attention head."""
    def get_slopes_power_of_2(n):
        start = 2 ** (-(2 ** -(math.log2(n) - 3)))
        ratio = start
        return [start * (ratio ** i) for i in range(n)]

    if math.log2(num_heads).is_integer():
        return get_slopes_power_of_2(num_heads)
    else:
        # Closest power of 2
        closest_power = 2 ** math.floor(math.log2(num_heads))
        slopes = get_slopes_power_of_2(closest_power)
        # Add extra slopes
        extra = get_slopes_power_of_2(2 * closest_power)
        slopes.extend(extra[0::2][:num_heads - closest_power])
        return slopes

def create_alibi_bias(seq_len, num_heads):
    """Create ALiBi attention bias."""
    # Distance matrix
    context_position = torch.arange(seq_len)
    memory_position = torch.arange(seq_len)
    relative_position = memory_position[None, :] - context_position[:, None]

    # Get slopes
    slopes = torch.tensor(get_alibi_slopes(num_heads))

    # Apply slopes to distances
    alibi = slopes[:, None, None] * relative_position[None, :, :]
    return alibi  # (num_heads, seq_len, seq_len)

# Usage in attention
num_heads = 8
seq_len = 2048
alibi_bias = create_alibi_bias(seq_len, num_heads).to('cuda')

# Add bias to attention scores
# attn_scores shape: (batch, num_heads, seq_len, seq_len)
attn_scores = attn_scores + alibi_bias
attn_weights = torch.softmax(attn_scores, dim=-1)
```

### Position Interpolation for LLaMA

```python
from transformers import LlamaForCausalLM, LlamaTokenizer

# Original context: 2048 tokens
model = LlamaForCausalLM.from_pretrained("meta-llama/Llama-2-7b-hf")

# Extend to 32k with position interpolation
# Modify RoPE base frequency
model.config.rope_scaling = {
    "type": "linear",
    "factor": 16.0  # 2048 * 16 = 32768
}

# Or use dynamic scaling
model.config.rope_scaling = {
    "type": "dynamic",
    "factor": 16.0
}

# Fine-tune with long documents (minimal steps needed)
# Position interpolation works out-of-the-box after this config change
```

## Core Concepts

### 1. RoPE (Rotary Position Embeddings)

**How it works:**
- Encodes absolute position via rotation matrix
- Provides relative position dependency in attention
- Enables length extrapolation

**Mathematical formulation:**
```
q_m = (W_q * x_m) * e^(imθ)
k_n = (W_k * x_n) * e^(inθ)

where θ_j = base^(-2j/d) for j ∈ [0, d/2)
```

**Advantages:**
- Decaying inter-token dependency with distance
- Compatible with linear attention
- Better extrapolation than absolute position encodings

### 2. YaRN (Yet another RoPE extensioN)

**Key innovation:**
- NTK-aware interpolation (Neural Tangent Kernel)
- Attention temperature scaling
- Efficient context extension (10× less tokens vs baselines)

**Parameters:**
```python
# YaRN configuration
yarn_config = {
    "scale": 16,                    # Extension factor
    "original_max_position": 2048,  # Base context
    "extrapolation_factor": 1.0,    # NTK parameter
    "attn_factor": 1.0,             # Attention scaling
    "beta_fast": 32,                # High-frequency scale
    "beta_slow": 1,                 # Low-frequency scale
}
```

**Performance:**
- Extends LLaMA to 128k tokens
- 2.5× less training steps than baselines
- State-of-the-art context window extension

### 3. ALiBi (Attention with Linear Biases)

**Core idea:**
- No positional embeddings added to tokens
- Apply distance penalty directly to attention scores
- Bias proportional to key-query distance

**Formula:**
```
attention_bias[i, j] = -m * |i - j|

where m = slope for each attention head
```

**Advantages:**
- 11% faster training vs sinusoidal embeddings
- 11% less memory usage
- Strong length extrapolation (train 1k, test 2k+)
- Inductive bias towards recency

### 4. Position Interpolation

**Technique:**
- Linearly down-scale position indices
- Interpolate within trained range (vs extrapolate beyond)
- Minimal fine-tuning required

**Formula:**
```
# Original: position indices [0, 1, 2, ..., L]
# Extended: position indices [0, 0.5, 1.0, ..., L/2]
# (for 2× extension)

scaled_position[i] = i / extension_factor
```

**Results:**
- LLaMA 7B-65B extended to 32k tokens
- 1000 fine-tuning steps sufficient
- 600× better stability than extrapolation

## Method Comparison

| Method | Max Context | Training Needed | Memory | Extrapolation | Best For |
|--------|-------------|-----------------|--------|---------------|----------|
| **RoPE** | 8k-32k | Full pre-training | Moderate | Good | New models |
| **YaRN** | 32k-128k | Minimal (10× efficient) | Moderate | Excellent | Extending existing models |
| **ALiBi** | Unlimited | Full pre-training | Low (-11%) | Excellent | Training from scratch |
| **Position Interpolation** | 32k+ | Minimal (1k steps) | Moderate | Poor (by design) | Quick extension |

## Implementation Patterns

### HuggingFace Transformers Integration

```python
from transformers import AutoModelForCausalLM, AutoConfig

# RoPE with YaRN scaling
config = AutoConfig.from_pretrained("mistralai/Mistral-7B-v0.1")
config.rope_scaling = {
    "type": "yarn",
    "factor": 8.0,
    "original_max_position_embeddings": 8192,
    "attention_factor": 1.0
}

model = AutoModelForCausalLM.from_config(config)

# Position interpolation (simpler)
config.rope_scaling = {
    "type": "linear",
    "factor": 4.0
}

# Dynamic scaling (adjusts based on input length)
config.rope_scaling = {
    "type": "dynamic",
    "factor": 8.0
}
```

### Custom RoPE Implementation

```python
class LongContextAttention(nn.Module):
    """Multi-head attention with RoPE."""

    def __init__(self, hidden_size, num_heads, max_seq_len=32768):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = hidden_size // num_heads

        # Q, K, V projections
        self.q_proj = nn.Linear(hidden_size, hidden_size)
        self.k_proj = nn.Linear(hidden_size, hidden_size)
        self.v_proj = nn.Linear(hidden_size, hidden_size)
        self.o_proj = nn.Linear(hidden_size, hidden_size)

        # RoPE
        self.rotary_emb = RotaryEmbedding(
            dim=self.head_dim,
            max_seq_len=max_seq_len
        )

    def forward(self, hidden_states):
        batch_size, seq_len, _ = hidden_states.shape

        # Project to Q, K, V
        q = self.q_proj(hidden_states)
        k = self.k_proj(hidden_states)
        v = self.v_proj(hidden_states)

        # Reshape for multi-head
        q = q.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        # Apply RoPE
        cos, sin = self.rotary_emb(seq_len, device=hidden_states.device)
        q, k = apply_rotary_pos_emb(q, k, cos, sin)

        # Standard attention
        attn_output = F.scaled_dot_product_attention(q, k, v)

        # Reshape and project
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.view(batch_size, seq_len, -1)
        output = self.o_proj(attn_output)

        return output
```

## Fine-tuning for Long Context

### Minimal Fine-tuning (Position Interpolation)

```python
from transformers import Trainer, TrainingArguments

# Extend model config
model.config.max_position_embeddings = 32768
model.config.rope_scaling = {"type": "linear", "factor": 16.0}

# Training args (minimal steps needed)
training_args = TrainingArguments(
    output_dir="./llama-32k",
    num_train_epochs=1,
    max_steps=1000,           # Only 1000 steps!
    per_device_train_batch_size=1,
    gradient_accumulation_steps=16,
    learning_rate=2e-5,
    warmup_steps=100,
    logging_steps=10,
    save_steps=500,
)

# Train on long documents
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=long_document_dataset,  # 32k token sequences
)

trainer.train()
```

### YaRN Fine-tuning

```bash
# Clone YaRN implementation
git clone https://github.com/jquesnelle/yarn
cd yarn

# Fine-tune LLaMA with YaRN
python scripts/train.py \
    --model meta-llama/Llama-2-7b-hf \
    --scale 16 \
    --rope_theta 10000 \
    --max_length 32768 \
    --batch_size 1 \
    --gradient_accumulation 16 \
    --steps 400 \
    --learning_rate 2e-5
```

## Best Practices

### 1. Choose the Right Method

```python
# For NEW models (training from scratch)
use_method = "ALiBi"  # Best extrapolation, lowest memory

# For EXTENDING existing RoPE models
use_method = "YaRN"  # Most efficient extension (10× less data)

# For QUICK extension with minimal compute
use_method = "Position Interpolation"  # 1000 steps

# For MODERATE extension with good efficiency
use_method = "Linear RoPE Scaling"  # Built-in, simple
```

### 2. Scaling Factor Selection

```python
# Conservative (safer, better quality)
scaling_factor = 2.0  # 8k → 16k

# Moderate (good balance)
scaling_factor = 4.0  # 8k → 32k

# Aggressive (requires more fine-tuning)
scaling_factor = 8.0  # 8k → 64k
scaling_factor = 16.0  # 8k → 128k

# Rule: Larger factors need more fine-tuning steps
steps_needed = 100 * scaling_factor  # Rough estimate
```

### 3. Fine-tuning Data

```python
# ✅ Good: Long documents matching target length
train_data = [
    {"text": long_doc_32k_tokens},  # Full 32k
    {"text": long_doc_24k_tokens},  # Varied lengths
    {"text": long_doc_16k_tokens},
]

# ❌ Bad: Short documents (won't learn long context)
train_data = [
    {"text": short_doc_2k_tokens},
]

# Use datasets like:
# - PG-19 (books, long texts)
# - arXiv papers
# - Long-form conversations
# - GitHub repositories (concatenated files)
```

### 4. Avoid Common Pitfalls

```python
# ❌ Bad: Applying position interpolation without fine-tuning
model.config.rope_scaling = {"type": "linear", "factor": 16.0}
# Model will perform poorly without fine-tuning!

# ✅ Good: Fine-tune after scaling
model.config.rope_scaling = {"type": "linear", "factor": 16.0}
fine_tune(model, long_documents, steps=1000)

# ❌ Bad: Too aggressive scaling without data
scale_to_1M_tokens()  # Won't work without massive fine-tuning

# ✅ Good: Incremental scaling
# 8k → 16k → 32k → 64k (fine-tune at each step)
```

## Production Deployment

### Inference with Long Context

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load long-context model
model = AutoModelForCausalLM.from_pretrained(
    "togethercomputer/LLaMA-2-7B-32K",  # 32k context
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("togethercomputer/LLaMA-2-7B-32K")

# Process long document
long_text = "..." * 30000  # 30k tokens
inputs = tokenizer(long_text, return_tensors="pt", truncation=False).to('cuda')

# Generate
outputs = model.generate(
    **inputs,
    max_new_tokens=512,
    temperature=0.7,
)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
```

### Memory Optimization

```python
# Use gradient checkpointing for fine-tuning
model.gradient_checkpointing_enable()

# Use Flash Attention 2
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    attn_implementation="flash_attention_2",  # 2-3× faster
    torch_dtype=torch.float16
)

# Use paged attention (vLLM)
from vllm import LLM

llm = LLM(
    model="togethercomputer/LLaMA-2-7B-32K",
    max_model_len=32768,  # 32k context
    gpu_memory_utilization=0.9
)
```

## Resources

- **RoPE Paper**: https://arxiv.org/abs/2104.09864 (RoFormer)
- **YaRN Paper**: https://arxiv.org/abs/2309.00071
- **ALiBi Paper**: https://arxiv.org/abs/2108.12409 (Train Short, Test Long)
- **Position Interpolation**: https://arxiv.org/abs/2306.15595
- **HuggingFace RoPE Utils**: https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py
- **YaRN Implementation**: https://github.com/jquesnelle/yarn
- **Together AI Blog**: https://www.together.ai/blog/llama-2-7b-32k

## See Also

- `references/rope.md` - Detailed RoPE implementation and theory
- `references/extension_methods.md` - YaRN, ALiBi, Position Interpolation comparisons
- `references/fine_tuning.md` - Complete fine-tuning guide for context extension


