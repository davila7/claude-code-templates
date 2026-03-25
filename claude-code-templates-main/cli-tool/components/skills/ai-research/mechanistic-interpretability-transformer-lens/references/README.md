# TransformerLens Reference Documentation

This directory contains comprehensive reference materials for TransformerLens.

## Contents

- [api.md](api.md) - Complete API reference for HookedTransformer, ActivationCache, and HookPoints
- [tutorials.md](tutorials.md) - Step-by-step tutorials for common interpretability workflows
- [papers.md](papers.md) - Key research papers and foundational concepts

## Quick Links

- **Official Documentation**: https://transformerlensorg.github.io/TransformerLens/
- **GitHub Repository**: https://github.com/TransformerLensOrg/TransformerLens
- **Model Properties Table**: https://transformerlensorg.github.io/TransformerLens/generated/model_properties_table.html

## Installation

```bash
pip install transformer-lens
```

## Basic Usage

```python
from transformer_lens import HookedTransformer

# Load model
model = HookedTransformer.from_pretrained("gpt2-small")

# Run with activation caching
tokens = model.to_tokens("Hello world")
logits, cache = model.run_with_cache(tokens)

# Access activations
residual = cache["resid_post", 5]  # Layer 5 residual stream
attention = cache["pattern", 3]    # Layer 3 attention patterns
```

## Key Concepts

### HookPoints
Every activation in the transformer has a HookPoint wrapper, enabling:
- Reading activations via `run_with_cache()`
- Modifying activations via `run_with_hooks()`

### Activation Cache
The `ActivationCache` stores all intermediate activations with helper methods for:
- Residual stream decomposition
- Logit attribution
- Layer-wise analysis

### Supported Models (50+)
GPT-2, LLaMA, Mistral, Pythia, GPT-Neo, OPT, Gemma, Phi, and more.
