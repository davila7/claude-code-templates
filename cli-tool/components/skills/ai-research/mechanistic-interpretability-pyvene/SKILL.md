---
name: pyvene-interventions
description: Provides guidance for performing causal interventions on PyTorch models using pyvene's declarative intervention framework. Use when conducting causal tracing, activation patching, interchange intervention training, or testing causal hypotheses about model behavior.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Causal Intervention, pyvene, Activation Patching, Causal Tracing, Interpretability]
dependencies: [pyvene>=0.1.8, torch>=2.0.0, transformers>=4.30.0]
---

# pyvene: Causal Interventions for Neural Networks

pyvene is Stanford NLP's library for performing causal interventions on PyTorch models. It provides a declarative, dict-based framework for activation patching, causal tracing, and interchange intervention training - making intervention experiments reproducible and shareable.

**GitHub**: [stanfordnlp/pyvene](https://github.com/stanfordnlp/pyvene) (840+ stars)
**Paper**: [pyvene: A Library for Understanding and Improving PyTorch Models via Interventions](https://aclanthology.org/2024.naacl-demo.16) (NAACL 2024)

## When to Use pyvene

**Use pyvene when you need to:**
- Perform causal tracing (ROME-style localization)
- Run activation patching experiments
- Conduct interchange intervention training (IIT)
- Test causal hypotheses about model components
- Share/reproduce intervention experiments via HuggingFace
- Work with any PyTorch architecture (not just transformers)

**Consider alternatives when:**
- You need exploratory activation analysis → Use **TransformerLens**
- You want to train/analyze SAEs → Use **SAELens**
- You need remote execution on massive models → Use **nnsight**
- You want lower-level control → Use **nnsight**

## Installation

```bash
pip install pyvene
```

Standard import:
```python
import pyvene as pv
```

## Core Concepts

### IntervenableModel

The main class that wraps any PyTorch model with intervention capabilities:

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load base model
model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# Define intervention configuration
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=8,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        )
    ]
)

# Create intervenable model
intervenable = pv.IntervenableModel(config, model)
```

### Intervention Types

| Type | Description | Use Case |
|------|-------------|----------|
| `VanillaIntervention` | Swap activations between runs | Activation patching |
| `AdditionIntervention` | Add activations to base run | Steering, ablation |
| `SubtractionIntervention` | Subtract activations | Ablation |
| `ZeroIntervention` | Zero out activations | Component knockout |
| `RotatedSpaceIntervention` | DAS trainable intervention | Causal discovery |
| `CollectIntervention` | Collect activations | Probing, analysis |

### Component Targets

```python
# Available components to intervene on
components = [
    "block_input",      # Input to transformer block
    "block_output",     # Output of transformer block
    "mlp_input",        # Input to MLP
    "mlp_output",       # Output of MLP
    "mlp_activation",   # MLP hidden activations
    "attention_input",  # Input to attention
    "attention_output", # Output of attention
    "attention_value_output",  # Attention value vectors
    "query_output",     # Query vectors
    "key_output",       # Key vectors
    "value_output",     # Value vectors
    "head_attention_value_output",  # Per-head values
]
```

## Workflow 1: Causal Tracing (ROME-style)

Locate where factual associations are stored by corrupting inputs and restoring activations.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained("gpt2-xl")
tokenizer = AutoTokenizer.from_pretrained("gpt2-xl")

# 1. Define clean and corrupted inputs
clean_prompt = "The Space Needle is in downtown"
corrupted_prompt = "The ##### ###### ## ## ########"  # Noise

clean_tokens = tokenizer(clean_prompt, return_tensors="pt")
corrupted_tokens = tokenizer(corrupted_prompt, return_tensors="pt")

# 2. Get clean activations (source)
with torch.no_grad():
    clean_outputs = model(**clean_tokens, output_hidden_states=True)
    clean_states = clean_outputs.hidden_states

# 3. Define restoration intervention
def run_causal_trace(layer, position):
    """Restore clean activation at specific layer and position."""
    config = pv.IntervenableConfig(
        representations=[
            pv.RepresentationConfig(
                layer=layer,
                component="block_output",
                intervention_type=pv.VanillaIntervention,
                unit="pos",
                max_number_of_units=1,
            )
        ]
    )

    intervenable = pv.IntervenableModel(config, model)

    # Run with intervention
    _, patched_outputs = intervenable(
        base=corrupted_tokens,
        sources=[clean_tokens],
        unit_locations={"sources->base": ([[[position]]], [[[position]]])},
        output_original_output=True,
    )

    # Return probability of correct token
    probs = torch.softmax(patched_outputs.logits[0, -1], dim=-1)
    seattle_token = tokenizer.encode(" Seattle")[0]
    return probs[seattle_token].item()

# 4. Sweep over layers and positions
n_layers = model.config.n_layer
seq_len = clean_tokens["input_ids"].shape[1]

results = torch.zeros(n_layers, seq_len)
for layer in range(n_layers):
    for pos in range(seq_len):
        results[layer, pos] = run_causal_trace(layer, pos)

# 5. Visualize (layer x position heatmap)
# High values indicate causal importance
```

### Checklist
- [ ] Prepare clean prompt with target factual association
- [ ] Create corrupted version (noise or counterfactual)
- [ ] Define intervention config for each (layer, position)
- [ ] Run patching sweep
- [ ] Identify causal hotspots in heatmap

## Workflow 2: Activation Patching for Circuit Analysis

Test which components are necessary for a specific behavior.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# IOI task setup
clean_prompt = "When John and Mary went to the store, Mary gave a bottle to"
corrupted_prompt = "When John and Mary went to the store, John gave a bottle to"

clean_tokens = tokenizer(clean_prompt, return_tensors="pt")
corrupted_tokens = tokenizer(corrupted_prompt, return_tensors="pt")

john_token = tokenizer.encode(" John")[0]
mary_token = tokenizer.encode(" Mary")[0]

def logit_diff(logits):
    """IO - S logit difference."""
    return logits[0, -1, john_token] - logits[0, -1, mary_token]

# Patch attention output at each layer
def patch_attention(layer):
    config = pv.IntervenableConfig(
        representations=[
            pv.RepresentationConfig(
                layer=layer,
                component="attention_output",
                intervention_type=pv.VanillaIntervention,
            )
        ]
    )

    intervenable = pv.IntervenableModel(config, model)

    _, patched_outputs = intervenable(
        base=corrupted_tokens,
        sources=[clean_tokens],
    )

    return logit_diff(patched_outputs.logits).item()

# Find which layers matter
results = []
for layer in range(model.config.n_layer):
    diff = patch_attention(layer)
    results.append(diff)
    print(f"Layer {layer}: logit diff = {diff:.3f}")
```

## Workflow 3: Interchange Intervention Training (IIT)

Train interventions to discover causal structure.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM
import torch

model = AutoModelForCausalLM.from_pretrained("gpt2")

# 1. Define trainable intervention
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=6,
            component="block_output",
            intervention_type=pv.RotatedSpaceIntervention,  # Trainable
            low_rank_dimension=64,  # Learn 64-dim subspace
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 2. Set up training
optimizer = torch.optim.Adam(
    intervenable.get_trainable_parameters(),
    lr=1e-4
)

# 3. Training loop (simplified)
for base_input, source_input, target_output in dataloader:
    optimizer.zero_grad()

    _, outputs = intervenable(
        base=base_input,
        sources=[source_input],
    )

    loss = criterion(outputs.logits, target_output)
    loss.backward()
    optimizer.step()

# 4. Analyze learned intervention
# The rotation matrix reveals causal subspace
rotation = intervenable.interventions["layer.6.block_output"][0].rotate_layer
```

### DAS (Distributed Alignment Search)

```python
# Low-rank rotation finds interpretable subspaces
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=8,
            component="block_output",
            intervention_type=pv.LowRankRotatedSpaceIntervention,
            low_rank_dimension=1,  # Find 1D causal direction
        )
    ]
)
```

## Workflow 4: Model Steering (Honest LLaMA)

Steer model behavior during generation.

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-2-7b-hf")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# Load pre-trained steering intervention
intervenable = pv.IntervenableModel.load(
    "zhengxuanzenwu/intervenable_honest_llama2_chat_7B",
    model=model,
)

# Generate with steering
prompt = "Is the earth flat?"
inputs = tokenizer(prompt, return_tensors="pt")

# Intervention applied during generation
outputs = intervenable.generate(
    inputs,
    max_new_tokens=100,
    do_sample=False,
)

print(tokenizer.decode(outputs[0]))
```

## Saving and Sharing Interventions

```python
# Save locally
intervenable.save("./my_intervention")

# Load from local
intervenable = pv.IntervenableModel.load(
    "./my_intervention",
    model=model,
)

# Share on HuggingFace
intervenable.save_intervention("username/my-intervention")

# Load from HuggingFace
intervenable = pv.IntervenableModel.load(
    "username/my-intervention",
    model=model,
)
```

## Common Issues & Solutions

### Issue: Wrong intervention location
```python
# WRONG: Incorrect component name
config = pv.RepresentationConfig(
    component="mlp",  # Not valid!
)

# RIGHT: Use exact component name
config = pv.RepresentationConfig(
    component="mlp_output",  # Valid
)
```

### Issue: Dimension mismatch
```python
# Ensure source and base have compatible shapes
# For position-specific interventions:
config = pv.RepresentationConfig(
    unit="pos",
    max_number_of_units=1,  # Intervene on single position
)

# Specify locations explicitly
intervenable(
    base=base_tokens,
    sources=[source_tokens],
    unit_locations={"sources->base": ([[[5]]], [[[5]]])},  # Position 5
)
```

### Issue: Memory with large models
```python
# Use gradient checkpointing
model.gradient_checkpointing_enable()

# Or intervene on fewer components
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=8,  # Single layer instead of all
            component="block_output",
        )
    ]
)
```

### Issue: LoRA integration
```python
# pyvene v0.1.8+ supports LoRAs as interventions
config = pv.RepresentationConfig(
    intervention_type=pv.LoRAIntervention,
    low_rank_dimension=16,
)
```

## Key Classes Reference

| Class | Purpose |
|-------|---------|
| `IntervenableModel` | Main wrapper for interventions |
| `IntervenableConfig` | Configuration container |
| `RepresentationConfig` | Single intervention specification |
| `VanillaIntervention` | Activation swapping |
| `RotatedSpaceIntervention` | Trainable DAS intervention |
| `CollectIntervention` | Activation collection |

## Supported Models

pyvene works with any PyTorch model. Tested on:
- GPT-2 (all sizes)
- LLaMA / LLaMA-2
- Pythia
- Mistral / Mixtral
- OPT
- BLIP (vision-language)
- ESM (protein models)
- Mamba (state space)

## Reference Documentation

For detailed API documentation, tutorials, and advanced usage, see the `references/` folder:

| File | Contents |
|------|----------|
| [references/README.md](references/README.md) | Overview and quick start guide |
| [references/api.md](references/api.md) | Complete API reference for IntervenableModel, intervention types, configurations |
| [references/tutorials.md](references/tutorials.md) | Step-by-step tutorials for causal tracing, activation patching, DAS |

## External Resources

### Tutorials
- [pyvene 101](https://stanfordnlp.github.io/pyvene/tutorials/pyvene_101.html)
- [Causal Tracing Tutorial](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/Causal_Tracing.html)
- [IOI Circuit Replication](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/IOI_Replication.html)
- [DAS Introduction](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/DAS_Main_Introduction.html)

### Papers
- [Locating and Editing Factual Associations in GPT](https://arxiv.org/abs/2202.05262) - Meng et al. (2022)
- [Inference-Time Intervention](https://arxiv.org/abs/2306.03341) - Li et al. (2023)
- [Interpretability in the Wild](https://arxiv.org/abs/2211.00593) - Wang et al. (2022)

### Official Documentation
- [Official Docs](https://stanfordnlp.github.io/pyvene/)
- [API Reference](https://stanfordnlp.github.io/pyvene/api/)

## Comparison with Other Tools

| Feature | pyvene | TransformerLens | nnsight |
|---------|--------|-----------------|---------|
| Declarative config | Yes | No | No |
| HuggingFace sharing | Yes | No | No |
| Trainable interventions | Yes | Limited | Yes |
| Any PyTorch model | Yes | Transformers only | Yes |
| Remote execution | No | No | Yes (NDIF) |
