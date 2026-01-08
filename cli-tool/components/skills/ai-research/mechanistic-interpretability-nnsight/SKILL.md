---
name: nnsight-remote-interpretability
description: Provides guidance for interpreting and manipulating neural network internals using nnsight with optional NDIF remote execution. Use when needing to run interpretability experiments on massive models (70B+) without local GPU resources, or when working with any PyTorch architecture.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [nnsight, NDIF, Remote Execution, Mechanistic Interpretability, Model Internals]
dependencies: [nnsight>=0.5.0, torch>=2.0.0]
---

# nnsight: Transparent Access to Neural Network Internals

nnsight (/ɛn.saɪt/) enables researchers to interpret and manipulate the internals of any PyTorch model, with the unique capability of running the same code locally on small models or remotely on massive models (70B+) via NDIF.

**GitHub**: [ndif-team/nnsight](https://github.com/ndif-team/nnsight) (730+ stars)
**Paper**: [NNsight and NDIF: Democratizing Access to Foundation Model Internals](https://arxiv.org/abs/2407.14561) (ICLR 2025)

## Key Value Proposition

**Write once, run anywhere**: The same interpretability code works on GPT-2 locally or Llama-3.1-405B remotely. Just toggle `remote=True`.

```python
# Local execution (small model)
with model.trace("Hello world"):
    hidden = model.transformer.h[5].output[0].save()

# Remote execution (massive model) - same code!
with model.trace("Hello world", remote=True):
    hidden = model.model.layers[40].output[0].save()
```

## When to Use nnsight

**Use nnsight when you need to:**
- Run interpretability experiments on models too large for local GPUs (70B, 405B)
- Work with any PyTorch architecture (transformers, Mamba, custom models)
- Perform multi-token generation interventions
- Share activations between different prompts
- Access full model internals without reimplementation

**Consider alternatives when:**
- You want consistent API across models → Use **TransformerLens**
- You need declarative, shareable interventions → Use **pyvene**
- You're training SAEs → Use **SAELens**
- You only work with small models locally → **TransformerLens** may be simpler

## Installation

```bash
# Basic installation
pip install nnsight

# For vLLM support
pip install "nnsight[vllm]"
```

For remote NDIF execution, sign up at [login.ndif.us](https://login.ndif.us) for an API key.

## Core Concepts

### LanguageModel Wrapper

```python
from nnsight import LanguageModel

# Load model (uses HuggingFace under the hood)
model = LanguageModel("openai-community/gpt2", device_map="auto")

# For larger models
model = LanguageModel("meta-llama/Llama-3.1-8B", device_map="auto")
```

### Tracing Context

The `trace` context manager enables deferred execution - operations are collected into a computation graph:

```python
from nnsight import LanguageModel

model = LanguageModel("gpt2", device_map="auto")

with model.trace("The Eiffel Tower is in") as tracer:
    # Access any module's output
    hidden_states = model.transformer.h[5].output[0].save()

    # Access attention patterns
    attn = model.transformer.h[5].attn.attn_dropout.input[0][0].save()

    # Modify activations
    model.transformer.h[8].output[0][:] = 0  # Zero out layer 8

    # Get final output
    logits = model.output.save()

# After context exits, access saved values
print(hidden_states.shape)  # [batch, seq, hidden]
```

### Proxy Objects

Inside `trace`, module accesses return Proxy objects that record operations:

```python
with model.trace("Hello"):
    # These are all Proxy objects - operations are deferred
    h5_out = model.transformer.h[5].output[0]  # Proxy
    h5_mean = h5_out.mean(dim=-1)              # Proxy
    h5_saved = h5_mean.save()                   # Save for later access
```

## Workflow 1: Activation Analysis

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

prompt = "The capital of France is"

with model.trace(prompt) as tracer:
    # 1. Collect activations from multiple layers
    layer_outputs = []
    for i in range(12):  # GPT-2 has 12 layers
        layer_out = model.transformer.h[i].output[0].save()
        layer_outputs.append(layer_out)

    # 2. Get attention patterns
    attn_patterns = []
    for i in range(12):
        # Access attention weights (after softmax)
        attn = model.transformer.h[i].attn.attn_dropout.input[0][0].save()
        attn_patterns.append(attn)

    # 3. Get final logits
    logits = model.output.save()

# 4. Analyze outside context
for i, layer_out in enumerate(layer_outputs):
    print(f"Layer {i} output shape: {layer_out.shape}")
    print(f"Layer {i} norm: {layer_out.norm().item():.3f}")

# 5. Find top predictions
probs = torch.softmax(logits[0, -1], dim=-1)
top_tokens = probs.topk(5)
for token, prob in zip(top_tokens.indices, top_tokens.values):
    print(f"{model.tokenizer.decode(token)}: {prob.item():.3f}")
```

### Checklist
- [ ] Load model with LanguageModel wrapper
- [ ] Use trace context for operations
- [ ] Call `.save()` on values you need after context
- [ ] Access saved values outside context
- [ ] Use `.shape`, `.norm()`, etc. for analysis

## Workflow 2: Activation Patching

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

clean_prompt = "The Eiffel Tower is in"
corrupted_prompt = "The Colosseum is in"

# 1. Get clean activations
with model.trace(clean_prompt) as tracer:
    clean_hidden = model.transformer.h[8].output[0].save()

# 2. Patch clean into corrupted run
with model.trace(corrupted_prompt) as tracer:
    # Replace layer 8 output with clean activations
    model.transformer.h[8].output[0][:] = clean_hidden

    patched_logits = model.output.save()

# 3. Compare predictions
paris_token = model.tokenizer.encode(" Paris")[0]
rome_token = model.tokenizer.encode(" Rome")[0]

patched_probs = torch.softmax(patched_logits[0, -1], dim=-1)
print(f"Paris prob: {patched_probs[paris_token].item():.3f}")
print(f"Rome prob: {patched_probs[rome_token].item():.3f}")
```

### Systematic Patching Sweep

```python
def patch_layer_position(layer, position, clean_cache, corrupted_prompt):
    """Patch single layer/position from clean to corrupted."""
    with model.trace(corrupted_prompt) as tracer:
        # Get current activation
        current = model.transformer.h[layer].output[0]

        # Patch only specific position
        current[:, position, :] = clean_cache[layer][:, position, :]

        logits = model.output.save()

    return logits

# Sweep over all layers and positions
results = torch.zeros(12, seq_len)
for layer in range(12):
    for pos in range(seq_len):
        logits = patch_layer_position(layer, pos, clean_hidden, corrupted)
        results[layer, pos] = compute_metric(logits)
```

## Workflow 3: Remote Execution with NDIF

Run the same experiments on massive models without local GPUs.

### Step-by-Step

```python
from nnsight import LanguageModel

# 1. Load large model (will run remotely)
model = LanguageModel("meta-llama/Llama-3.1-70B")

# 2. Same code, just add remote=True
with model.trace("The meaning of life is", remote=True) as tracer:
    # Access internals of 70B model!
    layer_40_out = model.model.layers[40].output[0].save()
    logits = model.output.save()

# 3. Results returned from NDIF
print(f"Layer 40 shape: {layer_40_out.shape}")

# 4. Generation with interventions
with model.trace(remote=True) as tracer:
    with tracer.invoke("What is 2+2?"):
        # Intervene during generation
        model.model.layers[20].output[0][:, -1, :] *= 1.5

    output = model.generate(max_new_tokens=50)
```

### NDIF Setup

1. Sign up at [login.ndif.us](https://login.ndif.us)
2. Get API key
3. Set environment variable or pass to nnsight:

```python
import os
os.environ["NDIF_API_KEY"] = "your_key"

# Or configure directly
from nnsight import CONFIG
CONFIG.API_KEY = "your_key"
```

### Available Models on NDIF

- Llama-3.1-8B, 70B, 405B
- DeepSeek-R1 models
- Various open-weight models (check [ndif.us](https://ndif.us) for current list)

## Workflow 4: Cross-Prompt Activation Sharing

Share activations between different inputs in a single trace.

```python
from nnsight import LanguageModel

model = LanguageModel("gpt2", device_map="auto")

with model.trace() as tracer:
    # First prompt
    with tracer.invoke("The cat sat on the"):
        cat_hidden = model.transformer.h[6].output[0].save()

    # Second prompt - inject cat's activations
    with tracer.invoke("The dog ran through the"):
        # Replace with cat's activations at layer 6
        model.transformer.h[6].output[0][:] = cat_hidden
        dog_with_cat = model.output.save()

# The dog prompt now has cat's internal representations
```

## Workflow 5: Gradient-Based Analysis

Access gradients during backward pass.

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

with model.trace("The quick brown fox") as tracer:
    # Save activations and enable gradient
    hidden = model.transformer.h[5].output[0].save()
    hidden.retain_grad()

    logits = model.output

    # Compute loss on specific token
    target_token = model.tokenizer.encode(" jumps")[0]
    loss = -logits[0, -1, target_token]

    # Backward pass
    loss.backward()

# Access gradients
grad = hidden.grad
print(f"Gradient shape: {grad.shape}")
print(f"Gradient norm: {grad.norm().item():.3f}")
```

**Note**: Gradient access not supported for vLLM or remote execution.

## Common Issues & Solutions

### Issue: Module path differs between models
```python
# GPT-2 structure
model.transformer.h[5].output[0]

# LLaMA structure
model.model.layers[5].output[0]

# Solution: Check model structure
print(model._model)  # See actual module names
```

### Issue: Forgetting to save
```python
# WRONG: Value not accessible outside trace
with model.trace("Hello"):
    hidden = model.transformer.h[5].output[0]  # Not saved!

print(hidden)  # Error or wrong value

# RIGHT: Call .save()
with model.trace("Hello"):
    hidden = model.transformer.h[5].output[0].save()

print(hidden)  # Works!
```

### Issue: Remote timeout
```python
# For long operations, increase timeout
with model.trace("prompt", remote=True, timeout=300) as tracer:
    # Long operation...
```

### Issue: Memory with many saved activations
```python
# Only save what you need
with model.trace("prompt"):
    # Don't save everything
    for i in range(100):
        model.transformer.h[i].output[0].save()  # Memory heavy!

    # Better: save specific layers
    key_layers = [0, 5, 11]
    for i in key_layers:
        model.transformer.h[i].output[0].save()
```

### Issue: vLLM gradient limitation
```python
# vLLM doesn't support gradients
# Use standard execution for gradient analysis
model = LanguageModel("gpt2", device_map="auto")  # Not vLLM
```

## Key API Reference

| Method/Property | Purpose |
|-----------------|---------|
| `model.trace(prompt, remote=False)` | Start tracing context |
| `proxy.save()` | Save value for access after trace |
| `proxy[:]` | Slice/index proxy (assignment patches) |
| `tracer.invoke(prompt)` | Add prompt within trace |
| `model.generate(...)` | Generate with interventions |
| `model.output` | Final model output logits |
| `model._model` | Underlying HuggingFace model |

## Comparison with Other Tools

| Feature | nnsight | TransformerLens | pyvene |
|---------|---------|-----------------|--------|
| Any architecture | Yes | Transformers only | Yes |
| Remote execution | Yes (NDIF) | No | No |
| Consistent API | No | Yes | Yes |
| Deferred execution | Yes | No | No |
| HuggingFace native | Yes | Reimplemented | Yes |
| Shareable configs | No | No | Yes |

## Reference Documentation

For detailed API documentation, tutorials, and advanced usage, see the `references/` folder:

| File | Contents |
|------|----------|
| [references/README.md](references/README.md) | Overview and quick start guide |
| [references/api.md](references/api.md) | Complete API reference for LanguageModel, tracing, proxy objects |
| [references/tutorials.md](references/tutorials.md) | Step-by-step tutorials for local and remote interpretability |

## External Resources

### Tutorials
- [Getting Started](https://nnsight.net/start/)
- [Features Overview](https://nnsight.net/features/)
- [Remote Execution](https://nnsight.net/notebooks/features/remote_execution/)
- [Applied Tutorials](https://nnsight.net/applied_tutorials/)

### Official Documentation
- [Official Docs](https://nnsight.net/documentation/)
- [NDIF Info](https://ndif.us/)
- [Community Forum](https://discuss.ndif.us/)

### Papers
- [NNsight and NDIF Paper](https://arxiv.org/abs/2407.14561) - Fiotto-Kaufman et al. (ICLR 2025)

## Architecture Support

nnsight works with any PyTorch model:
- **Transformers**: GPT-2, LLaMA, Mistral, etc.
- **State Space Models**: Mamba
- **Vision Models**: ViT, CLIP
- **Custom architectures**: Any nn.Module

The key is knowing the module structure to access the right components.
