# Model Merging Methods: Deep Dive

Complete technical guide to model merging algorithms based on research papers.

## Table of Contents
- TIES-Merging Algorithm
- DARE (Drop And REscale)
- Linear Merging
- SLERP
- Task Arithmetic
- Comparison

## TIES-Merging: Resolving Interference

**Paper**: "TIES-Merging: Resolving Interference When Merging Models" (NeurIPS 2023)
**Authors**: Prateek Yadav et al.
**Code**: https://github.com/prateeky2806/ties-merging

### Algorithm Overview

TIES-Merging addresses two major sources of interference:
1. Redundant parameter values
2. Sign disagreement across models

**Three-Step Process**: TRIM, ELECT, MERGE

### Step 1: TRIM (Reset Small Changes)

Remove parameters that changed minimally during fine-tuning.

```python
def trim(task_vector, density=0.2):
    """Keep top-k% parameters by magnitude, reset rest to 0."""
    # Calculate magnitude
    magnitudes = torch.abs(task_vector)

    # Get threshold for top-k%
    k = int(density * task_vector.numel())
    threshold = torch.topk(magnitudes.flatten(), k).values.min()

    # Create mask: keep parameters above threshold
    mask = magnitudes >= threshold

    # Apply mask
    trimmed_vector = task_vector * mask

    return trimmed_vector

# Example
task_vector_1 = finetuned_model_1 - base_model
task_vector_2 = finetuned_model_2 - base_model

trimmed_1 = trim(task_vector_1, density=0.2)  # Keep top 20%
trimmed_2 = trim(task_vector_2, density=0.2)
```

### Step 2: ELECT SIGN (Resolve Conflicts)

When parameters have conflicting signs, elect the dominant sign.

```python
def elect_sign(task_vectors):
    """Resolve sign conflicts across multiple task vectors."""
    # Stack all task vectors
    stacked = torch.stack(task_vectors)  # (num_models, num_params)

    # Count positive vs negative for each parameter
    positive_count = (stacked > 0).sum(dim=0)
    negative_count = (stacked < 0).sum(dim=0)

    # Elect majority sign
    final_sign = torch.where(
        positive_count > negative_count,
        torch.ones_like(stacked[0]),
        -torch.ones_like(stacked[0])
    )

    # Where tie, keep sign from first model
    tie_mask = (positive_count == negative_count)
    final_sign[tie_mask] = torch.sign(stacked[0][tie_mask])

    return final_sign

# Example
task_vectors = [trimmed_1, trimmed_2, trimmed_3]
elected_sign = elect_sign(task_vectors)
```

### Step 3: MERGE (Disjoint Merging)

Merge only parameters that agree with elected sign.

```python
def ties_merge(base_model, task_vectors, density=0.2, lambda_param=1.0):
    """Complete TIES-Merging algorithm."""
    # Step 1: Trim each task vector
    trimmed_vectors = [trim(tv, density) for tv in task_vectors]

    # Step 2: Elect sign
    elected_sign = elect_sign(trimmed_vectors)

    # Step 3: Merge aligned parameters
    merged_task_vector = torch.zeros_like(task_vectors[0])

    for tv in trimmed_vectors:
        # Keep only parameters aligned with elected sign
        aligned_mask = (torch.sign(tv) == elected_sign) | (tv == 0)
        aligned_params = tv * aligned_mask

        # Accumulate
        merged_task_vector += aligned_params

    # Average
    num_models = len(task_vectors)
    merged_task_vector /= num_models

    # Add back to base model
    final_model = base_model + lambda_param * merged_task_vector

    return final_model

# Usage
base = load_model("mistralai/Mistral-7B-v0.1")
model_1 = load_model("WizardLM/WizardMath-7B-V1.1")
model_2 = load_model("teknium/OpenHermes-2.5-Mistral-7B")
model_3 = load_model("NousResearch/Nous-Hermes-2-Mistral-7B-DPO")

task_vectors = [
    model_1 - base,
    model_2 - base,
    model_3 - base
]

merged = ties_merge(base, task_vectors, density=0.5, lambda_param=1.0)
```

### Hyperparameters

**density** (ρ): Fraction of parameters to keep (default: 0.2)
- Lower (0.1-0.3): More aggressive pruning, higher sparsity
- Higher (0.5-0.8): Conservative pruning, denser result

**lambda** (λ): Scaling factor for merged task vector (default: 1.0)
- Lower (<1.0): Less influence from fine-tuned models
- Higher (>1.0): More influence from fine-tuned models

## DARE: Drop And REscale

**Paper**: "Language Models are Super Mario: Absorbing Abilities from Homologous Models as a Free Lunch" (arXiv 2311.03099, 2023)
**Authors**: Le Yu, Bowen Yu, Haiyang Yu, Fei Huang, Yongbin Li

### Algorithm

DARE randomly drops delta parameters and rescales remaining ones.

### Mathematical Formulation

Given:
- Base model parameters: θ₀
- Fine-tuned model parameters: θₜ
- Delta parameters: δₜ = θₜ - θ₀

**Step 1: Random Drop**

```
m_t ~ Bernoulli(p)  # Drop mask
δ̃_t = (1 - m_t) ⊙ δ_t  # Element-wise product
```

**Step 2: Rescale**

```
δ̂_t = δ̃_t / (1 - p)  # Rescale to preserve expectation
```

**Final Model**

```
θ̂_t = θ₀ + δ̂_t
```

### Implementation

```python
def dare(base_model, finetuned_model, drop_rate=0.9):
    """DARE: Drop And REscale delta parameters."""
    # Compute delta
    delta = finetuned_model - base_model

    # Random drop mask (Bernoulli)
    drop_mask = torch.bernoulli(torch.full_like(delta, drop_rate))

    # Apply mask (keep 1-p, drop p)
    dropped_delta = delta * (1 - drop_mask)

    # Rescale to preserve expectation
    rescaled_delta = dropped_delta / (1 - drop_rate)

    # Reconstruct model
    result = base_model + rescaled_delta

    return result

# Example
base = load_model("mistralai/Mistral-7B-v0.1")
finetuned = load_model("WizardLM/WizardMath-7B-V1.1")

# Drop 90% of delta parameters
result = dare(base, finetuned, drop_rate=0.9)
```

### DARE + TIES (DARE-TIES)

Combine both methods for best results.

```python
def dare_ties(base_model, finetuned_models, drop_rate=0.9, density=0.5):
    """DARE + TIES-Merging."""
    # Step 1: Apply DARE to each model
    dare_deltas = []
    for model in finetuned_models:
        delta = model - base_model

        # DARE drop
        drop_mask = torch.bernoulli(torch.full_like(delta, drop_rate))
        dropped = delta * (1 - drop_mask)
        rescaled = dropped / (1 - drop_rate)

        dare_deltas.append(rescaled)

    # Step 2: Apply TIES to DARE-processed deltas
    merged = ties_merge(base_model, dare_deltas, density=density)

    return merged
```

### Hyperparameters

**drop_rate** (p): Probability of dropping each parameter (default: 0.9)
- Lower (0.5-0.7): Conservative, keeps more parameters
- Higher (0.9-0.99): Aggressive, maximum sparsity
- Works well even at 0.99 for large models

**Observations**:
- Larger models tolerate higher drop rates
- Delta parameters with small absolute values (<0.002) can be safely dropped
- Performance improves with model size

## Linear Merging (Model Soup)

Simple weighted average.

```python
def linear_merge(models, weights):
    """Weighted average of model parameters."""
    assert len(models) == len(weights)
    assert sum(weights) == 1.0, "Weights should sum to 1"

    merged = sum(w * model for w, model in zip(weights, models))

    return merged

# Example
models = [model_1, model_2, model_3]
weights = [0.4, 0.3, 0.3]
merged = linear_merge(models, weights)
```

## SLERP: Spherical Linear Interpolation

Interpolate along sphere in weight space.

```python
def slerp(model_1, model_2, t=0.5):
    """SLERP between two models."""
    # Flatten parameters
    p1 = torch.cat([p.flatten() for p in model_1.parameters()])
    p2 = torch.cat([p.flatten() for p in model_2.parameters()])

    # Normalize
    p1_norm = p1 / p1.norm()
    p2_norm = p2 / p2.norm()

    # Compute angle
    dot = (p1_norm * p2_norm).sum()
    theta = torch.acos(torch.clamp(dot, -1.0, 1.0))

    # SLERP formula
    if theta < 1e-6:
        # Vectors nearly parallel, use linear interpolation
        result = (1 - t) * p1 + t * p2
    else:
        # Spherical interpolation
        sin_theta = torch.sin(theta)
        result = (torch.sin((1 - t) * theta) / sin_theta) * p1 + \
                 (torch.sin(t * theta) / sin_theta) * p2

    # Reshape back to model
    merged_model = reshape_to_model(result, model_1)

    return merged_model

# Example
merged = slerp(model_1, model_2, t=0.5)  # 50-50 blend
```

## Task Arithmetic

Add task vectors to base model.

```python
def task_arithmetic(base_model, finetuned_models, lambdas):
    """Task arithmetic merging."""
    # Extract task vectors
    task_vectors = [model - base_model for model in finetuned_models]

    # Weighted sum
    combined_vector = sum(λ * tv for λ, tv in zip(lambdas, task_vectors))

    # Add to base
    merged = base_model + combined_vector

    return merged

# Example
base = load_model("mistralai/Mistral-7B-v0.1")
math_model = load_model("WizardLM/WizardMath-7B-V1.1")
code_model = load_model("ajibawa-2023/Code-Mistral-7B")

merged = task_arithmetic(
    base,
    [math_model, code_model],
    lambdas=[0.6, 0.4]
)
```

## Method Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Linear** | Simple, fast | Basic averaging | 2-3 similar models |
| **SLERP** | Preserves magnitude | Only 2 models | Smooth blending |
| **Task Arithmetic** | Intuitive, flexible | Sign conflicts | Multiple specialized models |
| **TIES** | Resolves conflicts | More complex | Many task-specific models |
| **DARE** | High sparsity | Random variance | Reducing redundancy |
| **DARE-TIES** | Best performance | Most complex | Production (state-of-art) |

## Resources

- **TIES Paper**: https://arxiv.org/abs/2306.01708
- **DARE Paper**: https://arxiv.org/abs/2311.03099
- **mergekit**: https://github.com/arcee-ai/mergekit
