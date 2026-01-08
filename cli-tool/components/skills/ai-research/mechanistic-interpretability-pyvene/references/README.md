# pyvene Reference Documentation

This directory contains comprehensive reference materials for pyvene.

## Contents

- [api.md](api.md) - Complete API reference for IntervenableModel, intervention types, and configurations
- [tutorials.md](tutorials.md) - Step-by-step tutorials for causal tracing, activation patching, and trainable interventions

## Quick Links

- **Official Documentation**: https://stanfordnlp.github.io/pyvene/
- **GitHub Repository**: https://github.com/stanfordnlp/pyvene
- **Paper**: https://arxiv.org/abs/2403.07809 (NAACL 2024)

## Installation

```bash
pip install pyvene
```

## Basic Usage

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load model
model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# Define intervention
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=5,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        )
    ]
)

# Create intervenable model
intervenable = pv.IntervenableModel(config, model)

# Run intervention (swap activations from source to base)
base_inputs = tokenizer("The cat sat on the", return_tensors="pt")
source_inputs = tokenizer("The dog ran through the", return_tensors="pt")

_, outputs = intervenable(
    base=base_inputs,
    sources=[source_inputs],
)
```

## Key Concepts

### Intervention Types
- **VanillaIntervention**: Swap activations between runs
- **AdditionIntervention**: Add source to base activations
- **ZeroIntervention**: Zero out activations (ablation)
- **CollectIntervention**: Collect activations without modifying
- **RotatedSpaceIntervention**: Trainable intervention for causal discovery

### Components
Target specific parts of the model:
- `block_input`, `block_output`
- `mlp_input`, `mlp_output`, `mlp_activation`
- `attention_input`, `attention_output`
- `query_output`, `key_output`, `value_output`

### HuggingFace Integration
Save and load interventions via HuggingFace Hub for reproducibility.
