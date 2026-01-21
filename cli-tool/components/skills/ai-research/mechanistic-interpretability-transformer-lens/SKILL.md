---
name: transformer-lens-interpretability
description: Provides guidance for mechanistic interpretability research using TransformerLens to inspect and manipulate transformer internals via HookPoints and activation caching. Use when reverse-engineering model algorithms, studying attention patterns, or performing activation patching experiments.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Mechanistic Interpretability, TransformerLens, Activation Patching, Circuit Analysis]
dependencies: [transformer-lens>=2.0.0, torch>=2.0.0]
---

# TransformerLens: Mechanistic Interpretability for Transformers

TransformerLens is the de facto standard library for mechanistic interpretability research on GPT-style language models. Created by Neel Nanda and maintained by Bryce Meyer, it provides clean interfaces to inspect and manipulate model internals via HookPoints on every activation.

**GitHub**: [TransformerLensOrg/TransformerLens](https://github.com/TransformerLensOrg/TransformerLens) (2,900+ stars)

## When to Use TransformerLens

**Use TransformerLens when you need to:**
- Reverse-engineer algorithms learned during training
- Perform activation patching / causal tracing experiments
- Study attention patterns and information flow
- Analyze circuits (e.g., induction heads, IOI circuit)
- Cache and inspect intermediate activations
- Apply direct logit attribution

**Consider alternatives when:**
- You need to work with non-transformer architectures → Use **nnsight** or **pyvene**
- You want to train/analyze Sparse Autoencoders → Use **SAELens**
- You need remote execution on massive models → Use **nnsight** with NDIF
- You want higher-level causal intervention abstractions → Use **pyvene**

## Installation

```bash
pip install transformer-lens
```

For development version:
```bash
pip install git+https://github.com/TransformerLensOrg/TransformerLens
```

## Core Concepts

### HookedTransformer

The main class that wraps transformer models with HookPoints on every activation:

```python
from transformer_lens import HookedTransformer

# Load a model
model = HookedTransformer.from_pretrained("gpt2-small")

# For gated models (LLaMA, Mistral)
import os
os.environ["HF_TOKEN"] = "your_token"
model = HookedTransformer.from_pretrained("meta-llama/Llama-2-7b-hf")
```

### Supported Models (50+)

| Family | Models |
|--------|--------|
| GPT-2 | gpt2, gpt2-medium, gpt2-large, gpt2-xl |
| LLaMA | llama-7b, llama-13b, llama-2-7b, llama-2-13b |
| EleutherAI | pythia-70m to pythia-12b, gpt-neo, gpt-j-6b |
| Mistral | mistral-7b, mixtral-8x7b |
| Others | phi, qwen, opt, gemma |

### Activation Caching

Run the model and cache all intermediate activations:

```python
# Get all activations
tokens = model.to_tokens("The Eiffel Tower is in")
logits, cache = model.run_with_cache(tokens)

# Access specific activations
residual = cache["resid_post", 5]  # Layer 5 residual stream
attn_pattern = cache["pattern", 3]  # Layer 3 attention pattern
mlp_out = cache["mlp_out", 7]  # Layer 7 MLP output

# Filter which activations to cache (saves memory)
logits, cache = model.run_with_cache(
    tokens,
    names_filter=lambda name: "resid_post" in name
)
```

### ActivationCache Keys

| Key Pattern | Shape | Description |
|-------------|-------|-------------|
| `resid_pre, layer` | [batch, pos, d_model] | Residual before attention |
| `resid_mid, layer` | [batch, pos, d_model] | Residual after attention |
| `resid_post, layer` | [batch, pos, d_model] | Residual after MLP |
| `attn_out, layer` | [batch, pos, d_model] | Attention output |
| `mlp_out, layer` | [batch, pos, d_model] | MLP output |
| `pattern, layer` | [batch, head, q_pos, k_pos] | Attention pattern (post-softmax) |
| `q, layer` | [batch, pos, head, d_head] | Query vectors |
| `k, layer` | [batch, pos, head, d_head] | Key vectors |
| `v, layer` | [batch, pos, head, d_head] | Value vectors |

## Workflow 1: Activation Patching (Causal Tracing)

Identify which activations causally affect model output by patching clean activations into corrupted runs.

### Step-by-Step

```python
from transformer_lens import HookedTransformer, patching
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# 1. Define clean and corrupted prompts
clean_prompt = "The Eiffel Tower is in the city of"
corrupted_prompt = "The Colosseum is in the city of"

clean_tokens = model.to_tokens(clean_prompt)
corrupted_tokens = model.to_tokens(corrupted_prompt)

# 2. Get clean activations
_, clean_cache = model.run_with_cache(clean_tokens)

# 3. Define metric (e.g., logit difference)
paris_token = model.to_single_token(" Paris")
rome_token = model.to_single_token(" Rome")

def metric(logits):
    return logits[0, -1, paris_token] - logits[0, -1, rome_token]

# 4. Patch each position and layer
results = torch.zeros(model.cfg.n_layers, clean_tokens.shape[1])

for layer in range(model.cfg.n_layers):
    for pos in range(clean_tokens.shape[1]):
        def patch_hook(activation, hook):
            activation[0, pos] = clean_cache[hook.name][0, pos]
            return activation

        patched_logits = model.run_with_hooks(
            corrupted_tokens,
            fwd_hooks=[(f"blocks.{layer}.hook_resid_post", patch_hook)]
        )
        results[layer, pos] = metric(patched_logits)

# 5. Visualize results (layer x position heatmap)
```

### Checklist
- [ ] Define clean and corrupted inputs that differ minimally
- [ ] Choose metric that captures behavior difference
- [ ] Cache clean activations
- [ ] Systematically patch each (layer, position) combination
- [ ] Visualize results as heatmap
- [ ] Identify causal hotspots

## Workflow 2: Circuit Analysis (Indirect Object Identification)

Replicate the IOI circuit discovery from "Interpretability in the Wild".

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# IOI task: "When John and Mary went to the store, Mary gave a bottle to"
# Model should predict "John" (indirect object)

prompt = "When John and Mary went to the store, Mary gave a bottle to"
tokens = model.to_tokens(prompt)

# 1. Get baseline logits
logits, cache = model.run_with_cache(tokens)

john_token = model.to_single_token(" John")
mary_token = model.to_single_token(" Mary")

# 2. Compute logit difference (IO - S)
logit_diff = logits[0, -1, john_token] - logits[0, -1, mary_token]
print(f"Logit difference: {logit_diff.item():.3f}")

# 3. Direct logit attribution by head
def get_head_contribution(layer, head):
    # Project head output to logits
    head_out = cache["z", layer][0, :, head, :]  # [pos, d_head]
    W_O = model.W_O[layer, head]  # [d_head, d_model]
    W_U = model.W_U  # [d_model, vocab]

    # Head contribution to logits at final position
    contribution = head_out[-1] @ W_O @ W_U
    return contribution[john_token] - contribution[mary_token]

# 4. Map all heads
head_contributions = torch.zeros(model.cfg.n_layers, model.cfg.n_heads)
for layer in range(model.cfg.n_layers):
    for head in range(model.cfg.n_heads):
        head_contributions[layer, head] = get_head_contribution(layer, head)

# 5. Identify top contributing heads (name movers, backup name movers)
```

### Checklist
- [ ] Set up task with clear IO/S tokens
- [ ] Compute baseline logit difference
- [ ] Decompose by attention head contributions
- [ ] Identify key circuit components (name movers, S-inhibition, induction)
- [ ] Validate with ablation experiments

## Workflow 3: Induction Head Detection

Find induction heads that implement [A][B]...[A] → [B] pattern.

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# Create repeated sequence: [A][B][A] should predict [B]
repeated_tokens = torch.tensor([[1000, 2000, 1000]])  # Arbitrary tokens

_, cache = model.run_with_cache(repeated_tokens)

# Induction heads attend from final [A] back to first [B]
# Check attention from position 2 to position 1
induction_scores = torch.zeros(model.cfg.n_layers, model.cfg.n_heads)

for layer in range(model.cfg.n_layers):
    pattern = cache["pattern", layer][0]  # [head, q_pos, k_pos]
    # Attention from pos 2 to pos 1
    induction_scores[layer] = pattern[:, 2, 1]

# Heads with high scores are induction heads
top_heads = torch.topk(induction_scores.flatten(), k=5)
```

## Common Issues & Solutions

### Issue: Hooks persist after debugging
```python
# WRONG: Old hooks remain active
model.run_with_hooks(tokens, fwd_hooks=[...])  # Debug, add new hooks
model.run_with_hooks(tokens, fwd_hooks=[...])  # Old hooks still there!

# RIGHT: Always reset hooks
model.reset_hooks()
model.run_with_hooks(tokens, fwd_hooks=[...])
```

### Issue: Tokenization gotchas
```python
# WRONG: Assuming consistent tokenization
model.to_tokens("Tim")  # Single token
model.to_tokens("Neel")  # Becomes "Ne" + "el" (two tokens!)

# RIGHT: Check tokenization explicitly
tokens = model.to_tokens("Neel", prepend_bos=False)
print(model.to_str_tokens(tokens))  # ['Ne', 'el']
```

### Issue: LayerNorm ignored in analysis
```python
# WRONG: Ignoring LayerNorm
pre_activation = residual @ model.W_in[layer]

# RIGHT: Include LayerNorm
ln_scale = model.blocks[layer].ln2.w
ln_out = model.blocks[layer].ln2(residual)
pre_activation = ln_out @ model.W_in[layer]
```

### Issue: Memory explosion with large models
```python
# Use selective caching
logits, cache = model.run_with_cache(
    tokens,
    names_filter=lambda n: "resid_post" in n or "pattern" in n,
    device="cpu"  # Cache on CPU
)
```

## Key Classes Reference

| Class | Purpose |
|-------|---------|
| `HookedTransformer` | Main model wrapper with hooks |
| `ActivationCache` | Dictionary-like cache of activations |
| `HookedTransformerConfig` | Model configuration |
| `FactoredMatrix` | Efficient factored matrix operations |

## Integration with SAELens

TransformerLens integrates with SAELens for Sparse Autoencoder analysis:

```python
from transformer_lens import HookedTransformer
from sae_lens import SAE

model = HookedTransformer.from_pretrained("gpt2-small")
sae = SAE.from_pretrained("gpt2-small-res-jb", "blocks.8.hook_resid_pre")

# Run with SAE
tokens = model.to_tokens("Hello world")
_, cache = model.run_with_cache(tokens)
sae_acts = sae.encode(cache["resid_pre", 8])
```

## Reference Documentation

For detailed API documentation, tutorials, and advanced usage, see the `references/` folder:

| File | Contents |
|------|----------|
| [references/README.md](references/README.md) | Overview and quick start guide |
| [references/api.md](references/api.md) | Complete API reference for HookedTransformer, ActivationCache, HookPoints |
| [references/tutorials.md](references/tutorials.md) | Step-by-step tutorials for activation patching, circuit analysis, logit lens |

## External Resources

### Tutorials
- [Main Demo Notebook](https://transformerlensorg.github.io/TransformerLens/generated/demos/Main_Demo.html)
- [Activation Patching Demo](https://colab.research.google.com/github/TransformerLensOrg/TransformerLens/blob/main/demos/Activation_Patching_in_TL_Demo.ipynb)
- [ARENA Mech Interp Course](https://arena-foundation.github.io/ARENA/) - 200+ hours of tutorials

### Papers
- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html)
- [In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html)
- [Interpretability in the Wild (IOI)](https://arxiv.org/abs/2211.00593)

### Official Documentation
- [Official Docs](https://transformerlensorg.github.io/TransformerLens/)
- [Model Properties Table](https://transformerlensorg.github.io/TransformerLens/generated/model_properties_table.html)
- [Neel Nanda's Glossary](https://www.neelnanda.io/mechanistic-interpretability/glossary)

## Version Notes

- **v2.0**: Removed HookedSAE (moved to SAELens)
- **v3.0 (alpha)**: TransformerBridge for loading any nn.Module
