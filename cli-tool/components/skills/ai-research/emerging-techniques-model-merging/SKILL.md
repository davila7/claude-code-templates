---
name: model-merging
description: Merge multiple fine-tuned models using mergekit to combine capabilities without retraining. Use when creating specialized models by blending domain-specific expertise (math + coding + chat), improving performance beyond single models, or experimenting rapidly with model variants. Covers SLERP, TIES-Merging, DARE, Task Arithmetic, linear merging, and production deployment strategies.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Emerging Techniques, Model Merging, Mergekit, SLERP, TIES, DARE, Task Arithmetic, Model Fusion, No Retraining, Multi-Capability, Arcee AI]
dependencies: [mergekit, transformers, torch]
---

# Model Merging: Combining Pre-trained Models

## When to Use This Skill

Use Model Merging when you need to:
- **Combine capabilities** from multiple fine-tuned models without retraining
- **Create specialized models** by blending domain-specific expertise (math + coding + chat)
- **Improve performance** beyond single models (often +5-10% on benchmarks)
- **Reduce training costs** - no GPUs needed, merges run on CPU
- **Experiment rapidly** - create new model variants in minutes, not days
- **Preserve multiple skills** - merge without catastrophic forgetting

**Success Stories**: Marcoro14-7B-slerp (best on Open LLM Leaderboard 02/2024), many top HuggingFace models use merging

**Tools**: mergekit (Arcee AI), LazyMergekit, Model Soup

## Installation

```bash
# Install mergekit
git clone https://github.com/arcee-ai/mergekit.git
cd mergekit
pip install -e .

# Or via pip
pip install mergekit

# Optional: Transformer library
pip install transformers torch
```

## Quick Start

### Simple Linear Merge

```yaml
# config.yml - Merge two models with equal weights
merge_method: linear
models:
  - model: mistralai/Mistral-7B-v0.1
    parameters:
      weight: 0.5
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      weight: 0.5
dtype: bfloat16
```

```bash
# Run merge
mergekit-yaml config.yml ./merged-model --cuda

# Use merged model
python -m transformers.models.auto --model_name_or_path ./merged-model
```

### SLERP Merge (Best for 2 Models)

```yaml
# config.yml - Spherical interpolation
merge_method: slerp
slices:
  - sources:
      - model: mistralai/Mistral-7B-v0.1
        layer_range: [0, 32]
      - model: teknium/OpenHermes-2.5-Mistral-7B
        layer_range: [0, 32]
parameters:
  t: 0.5  # Interpolation factor (0=model1, 1=model2)
dtype: bfloat16
```

## Core Concepts

### 1. Merge Methods

**Linear (Model Soup)**
- Simple weighted average of parameters
- Fast, works well for similar models
- Can merge 2+ models

```python
merged_weights = w1 * model1_weights + w2 * model2_weights + w3 * model3_weights
# where w1 + w2 + w3 = 1
```

**SLERP (Spherical Linear Interpolation)**
- Interpolates along sphere in weight space
- Preserves magnitude of weight vectors
- Best for merging 2 models
- Smoother than linear

```python
# SLERP formula
merged = (sin((1-t)*θ) / sin(θ)) * model1 + (sin(t*θ) / sin(θ)) * model2
# where θ = arccos(dot(model1, model2))
# t ∈ [0, 1]
```

**Task Arithmetic**
- Extract "task vectors" (fine-tuned - base)
- Combine task vectors, add to base
- Good for merging multiple specialized models

```python
# Task vector
task_vector = finetuned_model - base_model

# Merge multiple task vectors
merged = base_model + α₁*task_vector₁ + α₂*task_vector₂
```

**TIES-Merging**
- Task arithmetic + sparsification
- Resolves sign conflicts in parameters
- Best for merging many task-specific models

**DARE (Drop And REscale)**
- Randomly drops fine-tuned parameters
- Rescales remaining parameters
- Reduces redundancy, maintains performance

### 2. Configuration Structure

```yaml
# Basic structure
merge_method: <method>  # linear, slerp, ties, dare_ties, task_arithmetic
base_model: <path>      # Optional: base model for task arithmetic

models:
  - model: <path/to/model1>
    parameters:
      weight: <float>   # Merge weight
      density: <float>  # For TIES/DARE

  - model: <path/to/model2>
    parameters:
      weight: <float>

parameters:
  # Method-specific parameters

dtype: <dtype>  # bfloat16, float16, float32

# Optional
slices:  # Layer-wise merging
tokenizer:  # Tokenizer configuration
```

## Merge Methods Guide

### Linear Merge

**Best for**: Simple model combinations, equal weighting

```yaml
merge_method: linear
models:
  - model: WizardLM/WizardMath-7B-V1.1
    parameters:
      weight: 0.4
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      weight: 0.3
  - model: NousResearch/Nous-Hermes-2-Mistral-7B-DPO
    parameters:
      weight: 0.3
dtype: bfloat16
```

### SLERP Merge

**Best for**: Two models, smooth interpolation

```yaml
merge_method: slerp
slices:
  - sources:
      - model: mistralai/Mistral-7B-v0.1
        layer_range: [0, 32]
      - model: teknium/OpenHermes-2.5-Mistral-7B
        layer_range: [0, 32]
parameters:
  t: 0.5  # 0.0 = first model, 1.0 = second model
dtype: bfloat16
```

**Layer-specific SLERP:**

```yaml
merge_method: slerp
slices:
  - sources:
      - model: model_a
        layer_range: [0, 32]
      - model: model_b
        layer_range: [0, 32]
parameters:
  t:
    - filter: self_attn    # Attention layers
      value: 0.3
    - filter: mlp          # MLP layers
      value: 0.7
    - value: 0.5           # Default for other layers
dtype: bfloat16
```

### Task Arithmetic

**Best for**: Combining specialized skills

```yaml
merge_method: task_arithmetic
base_model: mistralai/Mistral-7B-v0.1
models:
  - model: WizardLM/WizardMath-7B-V1.1  # Math
    parameters:
      weight: 0.5
  - model: teknium/OpenHermes-2.5-Mistral-7B  # Chat
    parameters:
      weight: 0.3
  - model: ajibawa-2023/Code-Mistral-7B  # Code
    parameters:
      weight: 0.2
dtype: bfloat16
```

### TIES-Merging

**Best for**: Many models, resolving conflicts

```yaml
merge_method: ties
base_model: mistralai/Mistral-7B-v0.1
models:
  - model: WizardLM/WizardMath-7B-V1.1
    parameters:
      density: 0.5  # Keep top 50% of parameters
      weight: 1.0
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      density: 0.5
      weight: 1.0
  - model: NousResearch/Nous-Hermes-2-Mistral-7B-DPO
    parameters:
      density: 0.5
      weight: 1.0
parameters:
  normalize: true
dtype: bfloat16
```

### DARE Merge

**Best for**: Reducing redundancy

```yaml
merge_method: dare_ties
base_model: mistralai/Mistral-7B-v0.1
models:
  - model: WizardLM/WizardMath-7B-V1.1
    parameters:
      density: 0.5    # Drop 50% of deltas
      weight: 0.6
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      density: 0.5
      weight: 0.4
parameters:
  int8_mask: true  # Use int8 for masks (saves memory)
dtype: bfloat16
```

## Advanced Patterns

### Layer-wise Merging

```yaml
# Different models for different layers
merge_method: passthrough
slices:
  - sources:
      - model: mistralai/Mistral-7B-v0.1
        layer_range: [0, 16]   # First half
  - sources:
      - model: teknium/OpenHermes-2.5-Mistral-7B
        layer_range: [16, 32]  # Second half
dtype: bfloat16
```

### MoE from Merged Models

```yaml
# Create Mixture of Experts
merge_method: moe
base_model: mistralai/Mistral-7B-v0.1
experts:
  - source_model: WizardLM/WizardMath-7B-V1.1
    positive_prompts:
      - "math"
      - "calculate"
  - source_model: teknium/OpenHermes-2.5-Mistral-7B
    positive_prompts:
      - "chat"
      - "conversation"
  - source_model: ajibawa-2023/Code-Mistral-7B
    positive_prompts:
      - "code"
      - "python"
dtype: bfloat16
```

### Tokenizer Merging

```yaml
merge_method: linear
models:
  - model: mistralai/Mistral-7B-v0.1
  - model: custom/specialized-model

tokenizer:
  source: "union"  # Combine vocabularies from both models
  tokens:
    <|special_token|>:
      source: "custom/specialized-model"
```

## Best Practices

### 1. Model Compatibility

```python
# ✅ Good: Same architecture
models = [
    "mistralai/Mistral-7B-v0.1",
    "teknium/OpenHermes-2.5-Mistral-7B",  # Both Mistral 7B
]

# ❌ Bad: Different architectures
models = [
    "meta-llama/Llama-2-7b-hf",  # Llama
    "mistralai/Mistral-7B-v0.1",  # Mistral (incompatible!)
]
```

### 2. Weight Selection

```yaml
# ✅ Good: Weights sum to 1.0
models:
  - model: model_a
    parameters:
      weight: 0.6
  - model: model_b
    parameters:
      weight: 0.4  # 0.6 + 0.4 = 1.0

# ⚠️  Acceptable: Weights don't sum to 1 (for task arithmetic)
models:
  - model: model_a
    parameters:
      weight: 0.8
  - model: model_b
    parameters:
      weight: 0.8  # May boost performance
```

### 3. Method Selection

```python
# Choose merge method based on use case:

# 2 models, smooth blend → SLERP
merge_method = "slerp"

# 3+ models, simple average → Linear
merge_method = "linear"

# Multiple task-specific models → Task Arithmetic or TIES
merge_method = "ties"

# Want to reduce redundancy → DARE
merge_method = "dare_ties"
```

### 4. Density Tuning (TIES/DARE)

```yaml
# Start conservative (keep more parameters)
parameters:
  density: 0.8  # Keep 80%

# If performance good, increase sparsity
parameters:
  density: 0.5  # Keep 50%

# If performance degrades, reduce sparsity
parameters:
  density: 0.9  # Keep 90%
```

### 5. Layer-specific Merging

```yaml
# Preserve base model's beginning and end
merge_method: passthrough
slices:
  - sources:
      - model: base_model
        layer_range: [0, 2]     # Keep first layers
  - sources:
      - model: merged_middle    # Merge middle layers
        layer_range: [2, 30]
  - sources:
      - model: base_model
        layer_range: [30, 32]   # Keep last layers
```

## Evaluation & Testing

### Benchmark Merged Models

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load merged model
model = AutoModelForCausalLM.from_pretrained("./merged-model")
tokenizer = AutoTokenizer.from_pretrained("./merged-model")

# Test on various tasks
test_prompts = {
    "math": "Calculate: 25 * 17 =",
    "code": "Write a Python function to reverse a string:",
    "chat": "What is the capital of France?",
}

for task, prompt in test_prompts.items():
    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(**inputs, max_length=100)
    print(f"{task}: {tokenizer.decode(outputs[0])}")
```

### Common Benchmarks

- **Open LLM Leaderboard**: General capabilities
- **MT-Bench**: Multi-turn conversation
- **MMLU**: Multitask accuracy
- **HumanEval**: Code generation
- **GSM8K**: Math reasoning

## Production Deployment

### Save and Upload

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load merged model
model = AutoModelForCausalLM.from_pretrained("./merged-model")
tokenizer = AutoTokenizer.from_pretrained("./merged-model")

# Upload to HuggingFace Hub
model.push_to_hub("username/my-merged-model")
tokenizer.push_to_hub("username/my-merged-model")
```

### Quantize Merged Model

```bash
# Quantize with GGUF
python convert.py ./merged-model --outtype f16 --outfile merged-model.gguf

# Quantize with GPTQ
python quantize_gptq.py ./merged-model --bits 4 --group_size 128
```

## Common Pitfalls

### ❌ Pitfall 1: Merging Incompatible Models

```yaml
# Wrong: Different architectures
models:
  - model: meta-llama/Llama-2-7b  # Llama architecture
  - model: mistralai/Mistral-7B   # Mistral architecture
```

**Fix**: Only merge models with same architecture

### ❌ Pitfall 2: Over-weighting One Model

```yaml
# Suboptimal: One model dominates
models:
  - model: model_a
    parameters:
      weight: 0.95  # Too high
  - model: model_b
    parameters:
      weight: 0.05  # Too low
```

**Fix**: Use more balanced weights (0.3-0.7 range)

### ❌ Pitfall 3: Not Evaluating

```bash
# Wrong: Merge and deploy without testing
mergekit-yaml config.yml ./merged-model
# Deploy immediately (risky!)
```

**Fix**: Always benchmark before deploying

## Resources

- **mergekit GitHub**: https://github.com/arcee-ai/mergekit
- **HuggingFace Tutorial**: https://huggingface.co/blog/mlabonne/merge-models
- **LazyMergekit**: Automated merging notebook
- **TIES Paper**: https://arxiv.org/abs/2306.01708
- **DARE Paper**: https://arxiv.org/abs/2311.03099

## See Also

- `references/methods.md` - Deep dive into merge algorithms
- `references/examples.md` - Real-world merge configurations
- `references/evaluation.md` - Benchmarking and testing strategies


