# nnsight Reference Documentation

This directory contains comprehensive reference materials for nnsight.

## Contents

- [api.md](api.md) - Complete API reference for LanguageModel, tracing, and proxy objects
- [tutorials.md](tutorials.md) - Step-by-step tutorials for local and remote interpretability

## Quick Links

- **Official Documentation**: https://nnsight.net/
- **GitHub Repository**: https://github.com/ndif-team/nnsight
- **NDIF (Remote Execution)**: https://ndif.us/
- **Community Forum**: https://discuss.ndif.us/
- **Paper**: https://arxiv.org/abs/2407.14561 (ICLR 2025)

## Installation

```bash
# Basic installation
pip install nnsight

# For vLLM support
pip install "nnsight[vllm]"
```

## Basic Usage

```python
from nnsight import LanguageModel

# Load model
model = LanguageModel("openai-community/gpt2", device_map="auto")

# Trace and access internals
with model.trace("The Eiffel Tower is in") as tracer:
    # Access layer output
    hidden = model.transformer.h[5].output[0].save()

    # Modify activations
    model.transformer.h[8].output[0][:] *= 0.5

    # Get final output
    logits = model.output.save()

# Access saved values outside context
print(hidden.shape)
```

## Key Concepts

### Tracing
The `trace()` context enables deferred execution - operations are recorded and executed together.

### Proxy Objects
Inside trace, module accesses return Proxies. Call `.save()` to retrieve values after execution.

### Remote Execution (NDIF)
Run the same code on massive models (70B+) without local GPUs:

```python
# Same code, just add remote=True
with model.trace("Hello", remote=True):
    hidden = model.model.layers[40].output[0].save()
```

## NDIF Setup

1. Sign up at https://login.ndif.us/
2. Get API key
3. Set environment variable: `export NDIF_API_KEY=your_key`

## Available Remote Models

- Llama-3.1-8B, 70B, 405B
- DeepSeek-R1 models
- More at https://ndif.us/
