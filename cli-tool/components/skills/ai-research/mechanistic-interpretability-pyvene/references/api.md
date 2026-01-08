# pyvene API Reference

## IntervenableModel

The core class that wraps PyTorch models for intervention.

### Basic Usage

```python
import pyvene as pv
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("gpt2")

config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=5,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)
```

### Forward Pass

```python
# Basic intervention
original_output, intervened_output = intervenable(
    base=base_inputs,
    sources=[source_inputs],
)

# With unit locations (position-specific)
_, outputs = intervenable(
    base=base_inputs,
    sources=[source_inputs],
    unit_locations={"sources->base": ([[[5]]], [[[5]]])},  # Position 5
)

# Return original output too
original, intervened = intervenable(
    base=base_inputs,
    sources=[source_inputs],
    output_original_output=True,
)
```

### Generation

```python
# Generate with interventions
outputs = intervenable.generate(
    base_inputs,
    sources=[source_inputs],
    max_new_tokens=50,
    do_sample=False,
)
```

### Saving and Loading

```python
# Save locally
intervenable.save("./my_intervention")

# Load
intervenable = pv.IntervenableModel.load("./my_intervention", model=model)

# Save to HuggingFace
intervenable.save_intervention("username/my-intervention")

# Load from HuggingFace
intervenable = pv.IntervenableModel.load(
    "username/my-intervention",
    model=model
)
```

### Getting Trainable Parameters

```python
# For trainable interventions
params = intervenable.get_trainable_parameters()
optimizer = torch.optim.Adam(params, lr=1e-4)
```

---

## IntervenableConfig

Configuration container for interventions.

### Basic Config

```python
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(...)
    ]
)
```

### Multiple Interventions

```python
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(layer=3, component="block_output", ...),
        pv.RepresentationConfig(layer=5, component="mlp_output", ...),
        pv.RepresentationConfig(layer=7, component="attention_output", ...),
    ]
)
```

---

## RepresentationConfig

Specifies a single intervention target.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `layer` | int | Layer index |
| `component` | str | Component to intervene on |
| `intervention_type` | type | Intervention class |
| `unit` | str | Intervention unit ("pos", "h", etc.) |
| `max_number_of_units` | int | Max units to intervene |
| `low_rank_dimension` | int | For trainable interventions |
| `subspace_partition` | list | Dimension ranges |

### Components

| Component | Description |
|-----------|-------------|
| `block_input` | Input to transformer block |
| `block_output` | Output of transformer block |
| `mlp_input` | Input to MLP |
| `mlp_output` | Output of MLP |
| `mlp_activation` | MLP hidden activations |
| `attention_input` | Input to attention |
| `attention_output` | Output of attention |
| `attention_value_output` | Attention values |
| `query_output` | Query vectors |
| `key_output` | Key vectors |
| `value_output` | Value vectors |
| `head_attention_value_output` | Per-head values |

### Example Configs

```python
# Position-specific intervention
pv.RepresentationConfig(
    layer=5,
    component="block_output",
    intervention_type=pv.VanillaIntervention,
    unit="pos",
    max_number_of_units=1,
)

# Trainable low-rank intervention
pv.RepresentationConfig(
    layer=5,
    component="block_output",
    intervention_type=pv.LowRankRotatedSpaceIntervention,
    low_rank_dimension=64,
)

# Subspace intervention
pv.RepresentationConfig(
    layer=5,
    component="block_output",
    intervention_type=pv.VanillaIntervention,
    subspace_partition=[[0, 256], [256, 512]],  # First 512 dims split
)
```

---

## Intervention Types

### Basic Interventions

#### VanillaIntervention
Replaces base activations with source activations.

```python
pv.RepresentationConfig(
    intervention_type=pv.VanillaIntervention,
    ...
)
```

#### AdditionIntervention
Adds source activations to base.

```python
pv.RepresentationConfig(
    intervention_type=pv.AdditionIntervention,
    ...
)
```

#### SubtractionIntervention
Subtracts source from base.

```python
pv.RepresentationConfig(
    intervention_type=pv.SubtractionIntervention,
    ...
)
```

#### ZeroIntervention
Sets activations to zero (ablation).

```python
pv.RepresentationConfig(
    intervention_type=pv.ZeroIntervention,
    ...
)
```

#### CollectIntervention
Collects activations without modification.

```python
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=5,
            component="block_output",
            intervention_type=pv.CollectIntervention,
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)
_, collected = intervenable(base=inputs)
# collected contains the activations
```

### Trainable Interventions

#### RotatedSpaceIntervention
Full-rank trainable rotation.

```python
pv.RepresentationConfig(
    intervention_type=pv.RotatedSpaceIntervention,
    ...
)
```

#### LowRankRotatedSpaceIntervention
Low-rank trainable intervention (DAS).

```python
pv.RepresentationConfig(
    intervention_type=pv.LowRankRotatedSpaceIntervention,
    low_rank_dimension=64,
    ...
)
```

#### BoundlessRotatedSpaceIntervention
Boundless DAS variant.

```python
pv.RepresentationConfig(
    intervention_type=pv.BoundlessRotatedSpaceIntervention,
    ...
)
```

#### SigmoidMaskIntervention
Learnable binary mask.

```python
pv.RepresentationConfig(
    intervention_type=pv.SigmoidMaskIntervention,
    ...
)
```

---

## Unit Locations

Specify exactly where to intervene.

### Format

```python
unit_locations = {
    "sources->base": (source_locations, base_locations)
}
```

### Examples

```python
# Single position
unit_locations = {"sources->base": ([[[5]]], [[[5]]])}

# Multiple positions
unit_locations = {"sources->base": ([[[3, 5, 7]]], [[[3, 5, 7]]])}

# Different source and base positions
unit_locations = {"sources->base": ([[[5]]], [[[10]]])}
```

---

## Supported Models

pyvene works with any PyTorch model. Officially tested:

| Family | Models |
|--------|--------|
| GPT-2 | gpt2, gpt2-medium, gpt2-large, gpt2-xl |
| LLaMA | llama-7b, llama-2-7b, llama-2-13b |
| Pythia | pythia-70m to pythia-12b |
| Mistral | mistral-7b, mixtral-8x7b |
| Gemma | gemma-2b, gemma-7b |
| Vision | BLIP, LLaVA |
| Other | OPT, Phi, Qwen, ESM, Mamba |

---

## Quick Reference: Common Patterns

### Activation Patching
```python
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=layer,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        )
    ]
)
```

### Causal Tracing (ROME-style)
```python
config = pv.IntervenableConfig(
    representations=[
        # First corrupt with noise
        pv.RepresentationConfig(
            layer=0,
            component="block_input",
            intervention_type=pv.NoiseIntervention,
        ),
        # Then restore at target layer
        pv.RepresentationConfig(
            layer=target_layer,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        ),
    ]
)
```

### DAS (Distributed Alignment Search)
```python
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=layer,
            component="block_output",
            intervention_type=pv.LowRankRotatedSpaceIntervention,
            low_rank_dimension=1,  # Find 1D causal direction
        )
    ]
)
```
