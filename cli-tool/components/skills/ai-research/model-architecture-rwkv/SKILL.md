---
name: rwkv-architecture
description: RNN+Transformer hybrid with O(n) inference. Linear time, infinite context, no KV cache. Train like GPT (parallel), infer like RNN (sequential). Linux Foundation AI project. Production at Windows, Office, NeMo. RWKV-7 (March 2025). Models up to 14B parameters.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [RWKV, Model Architecture, RNN, Transformer Hybrid, Linear Complexity, Infinite Context, Efficient Inference, Linux Foundation, Alternative Architecture]
dependencies: [rwkv, torch, transformers]
---

# RWKV - Receptance Weighted Key Value

## Quick start

RWKV (RwaKuv) combines Transformer parallelization (training) with RNN efficiency (inference).

**Installation**:
```bash
# Install PyTorch
pip install torch --upgrade --extra-index-url https://download.pytorch.org/whl/cu121

# Install dependencies
pip install pytorch-lightning==1.9.5 deepspeed wandb ninja --upgrade

# Install RWKV
pip install rwkv
```

**Basic usage** (GPT mode + RNN mode):
```python
import os
from rwkv.model import RWKV

os.environ["RWKV_JIT_ON"] = '1'
os.environ["RWKV_CUDA_ON"] = '1'  # Use CUDA kernel for speed

# Load model
model = RWKV(
    model='/path/to/RWKV-4-Pile-1B5-20220903-8040',
    strategy='cuda fp16'
)

# GPT mode (parallel processing)
out, state = model.forward([187, 510, 1563, 310, 247], None)
print(out.detach().cpu().numpy())  # Logits

# RNN mode (sequential processing, same result)
out, state = model.forward([187, 510], None)  # First 2 tokens
out, state = model.forward([1563], state)      # Next token
out, state = model.forward([310, 247], state)  # Last tokens
print(out.detach().cpu().numpy())  # Same logits as above!
```

## Common workflows

### Workflow 1: Text generation (streaming)

**Efficient token-by-token generation**:
```python
from rwkv.model import RWKV
from rwkv.utils import PIPELINE

model = RWKV(model='RWKV-4-Pile-14B-20230313-ctx8192-test1050', strategy='cuda fp16')
pipeline = PIPELINE(model, "20B_tokenizer.json")

# Initial prompt
prompt = "The future of AI is"
state = None

# Generate token by token
for token in prompt:
    out, state = pipeline.model.forward(pipeline.encode(token), state)

# Continue generation
for _ in range(100):
    out, state = pipeline.model.forward(None, state)
    token = pipeline.sample_logits(out)
    print(pipeline.decode(token), end='', flush=True)
```

**Key advantage**: Constant memory per token (no growing KV cache)

### Workflow 2: Long context processing (infinite context)

**Process million-token sequences**:
```python
model = RWKV(model='RWKV-4-Pile-14B', strategy='cuda fp16')

# Process very long document
state = None
long_document = load_document()  # e.g., 1M tokens

# Stream through entire document
for chunk in chunks(long_document, chunk_size=1024):
    out, state = model.forward(chunk, state)

# State now contains information from entire 1M token document
# Memory usage: O(1) (constant, not O(n)!)
```

### Workflow 3: Fine-tuning RWKV

**Standard fine-tuning workflow**:
```python
# Training script
import pytorch_lightning as pl
from rwkv.model import RWKV
from rwkv.trainer import RWKVTrainer

# Configure model
config = {
    'n_layer': 24,
    'n_embd': 1024,
    'vocab_size': 50277,
    'ctx_len': 1024
}

# Setup trainer
trainer = pl.Trainer(
    accelerator='gpu',
    devices=8,
    precision='bf16',
    strategy='deepspeed_stage_2',
    max_epochs=1
)

# Train
model = RWKV(config)
trainer.fit(model, train_dataloader)
```

### Workflow 4: RWKV vs Transformer comparison

**Memory comparison** (1M token sequence):
```python
# Transformer (GPT)
# Memory: O(n²) for attention
# KV cache: 1M × hidden_dim × n_layers × 2 (keys + values)
# Example: 1M × 4096 × 24 × 2 = ~400GB (impractical!)

# RWKV
# Memory: O(1) per token
# State: hidden_dim × n_layers = 4096 × 24 = ~400KB
# 1,000,000× more efficient!
```

**Speed comparison** (inference):
```python
# Transformer: O(n) per token (quadratic overall)
# First token: 1 computation
# Second token: 2 computations
# ...
# 1000th token: 1000 computations

# RWKV: O(1) per token (linear overall)
# Every token: 1 computation
# 1000th token: 1 computation (same as first!)
```

## When to use vs alternatives

**Use RWKV when**:
- Need very long context (100K+ tokens)
- Want constant memory usage
- Building streaming applications
- Need RNN efficiency with Transformer performance
- Memory-constrained deployment

**Key advantages**:
- **Linear time**: O(n) vs O(n²) for Transformers
- **No KV cache**: Constant memory per token
- **Infinite context**: No fixed window limit
- **Parallelizable training**: Like GPT
- **Sequential inference**: Like RNN

**Use alternatives instead**:
- **Transformers**: Need absolute best performance, have compute
- **Mamba**: Want state-space models
- **RetNet**: Need retention mechanism
- **Hyena**: Want convolution-based approach

## Common issues

**Issue: Out of memory during training**

Use gradient checkpointing and DeepSpeed:
```python
trainer = pl.Trainer(
    strategy='deepspeed_stage_3',  # Full ZeRO-3
    precision='bf16'
)
```

**Issue: Slow inference**

Enable CUDA kernel:
```python
os.environ["RWKV_CUDA_ON"] = '1'
```

**Issue: Model not loading**

Check model path and strategy:
```python
model = RWKV(
    model='/absolute/path/to/model.pth',
    strategy='cuda fp16'  # Or 'cpu fp32' for CPU
)
```

**Issue: State management in RNN mode**

Always pass state between forward calls:
```python
# WRONG: State lost
out1, _ = model.forward(tokens1, None)
out2, _ = model.forward(tokens2, None)  # No context from tokens1!

# CORRECT: State preserved
out1, state = model.forward(tokens1, None)
out2, state = model.forward(tokens2, state)  # Has context from tokens1
```

## Advanced topics

**Time-mixing and channel-mixing**: See [references/architecture-details.md](references/architecture-details.md) for WKV operation, time-decay mechanism, and receptance gates.

**State management**: See [references/state-management.md](references/state-management.md) for att_x_prev, att_kv, ffn_x_prev states, and numerical stability considerations.

**RWKV-7 improvements**: See [references/rwkv7.md](references/rwkv7.md) for latest architectural improvements (March 2025) and multimodal capabilities.

## Hardware requirements

- **GPU**: NVIDIA (CUDA 11.6+) or CPU
- **VRAM** (FP16):
  - 169M model: 1GB
  - 430M model: 2GB
  - 1.5B model: 4GB
  - 3B model: 8GB
  - 7B model: 16GB
  - 14B model: 32GB
- **Inference**: O(1) memory per token
- **Training**: Parallelizable like GPT

**Performance** (vs Transformers):
- **Speed**: Similar training, faster inference
- **Memory**: 1000× less for long sequences
- **Scaling**: Linear vs quadratic

## Resources

- Paper (RWKV): https://arxiv.org/abs/2305.13048 (May 2023)
- Paper (RWKV-7): https://arxiv.org/abs/2503.14456 (March 2025)
- GitHub: https://github.com/BlinkDL/RWKV-LM ⭐ 12,000+
- Docs: https://wiki.rwkv.com/
- Models: https://huggingface.co/BlinkDL
- Linux Foundation AI: Official project
- Production: Microsoft Windows, Office integration, NeMo support


