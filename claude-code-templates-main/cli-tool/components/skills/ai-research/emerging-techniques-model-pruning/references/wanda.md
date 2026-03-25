# Wanda: Pruning by Weights and Activations

Based on ICLR 2024 paper (arXiv 2306.11695) - A Simple and Effective Pruning Approach for Large Language Models

## Overview

**Source**: https://arxiv.org/abs/2306.11695
**Conference**: ICLR 2024
**GitHub**: https://github.com/locuslab/wanda

Wanda prunes LLMs by weight magnitude × input activation, achieving 50% sparsity with <1% accuracy loss, no retraining required.

## Core Innovation

### Pruning Criterion

**Key insight**: Weight importance = magnitude × usage

```python
importance(w_ij) = |w_ij| × ||X_i||

where:
- w_ij: Weight connecting input i to output j
- X_i: Input activation norm for dimension i
- ||·||: L2 norm
```

**Intuition**:
- Large weight magnitude → important parameter
- High activation → frequently used dimension
- Product captures both factors

### Comparison with Magnitude Pruning

**Magnitude pruning** (baseline):
```python
importance = |weight|  # Only considers weight size
```

**Wanda**:
```python
importance = |weight| × activation  # Considers usage too
```

**Example**:
```
Weight A: magnitude=0.5, activation=0.1 → importance=0.05
Weight B: magnitude=0.3, activation=0.8 → importance=0.24

Magnitude pruning: Keeps A (larger weight)
Wanda: Keeps B (more important overall) ✓
```

## Algorithm

### One-Shot Pruning

```python
import torch
from transformers import AutoModelForCausalLM

def wanda_prune(model, calib_data, sparsity=0.5):
    """
    Wanda pruning algorithm.

    Steps:
    1. Collect activation statistics on calibration data
    2. Compute importance = |weight| × activation
    3. Prune lowest importance weights
    4. Return pruned model (no retraining!)
    """

    # Step 1: Collect activations
    activations = {}

    def activation_hook(name):
        def hook(module, input, output):
            # Store input activation norms
            X = input[0].detach()
            # Per-input-dimension norm
            act_norm = X.abs().mean(dim=0)  # Average over batch/sequence
            if name in activations:
                activations[name] += act_norm
            else:
                activations[name] = act_norm
        return hook

    # Register hooks
    hooks = []
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            hook = module.register_forward_hook(activation_hook(name))
            hooks.append(hook)

    # Run calibration
    model.eval()
    with torch.no_grad():
        for batch in calib_data:
            model(**batch)

    # Remove hooks
    for hook in hooks:
        hook.remove()

    # Step 2 & 3: Prune based on importance
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear) and name in activations:
            W = module.weight.data
            act = activations[name]

            # Compute importance (per output dimension)
            importance = W.abs() * act.unsqueeze(0)  # (out_features, in_features)

            # Find threshold for sparsity
            threshold = torch.quantile(importance.flatten(), sparsity)

            # Create mask
            mask = importance >= threshold

            # Apply pruning
            W.data *= mask.float()

    return model
```

### Per-Output Pruning

**Key detail**: Pruning is per-output dimension, not global.

```python
# For each output dimension, prune sparsity% of weights

for out_dim in range(out_features):
    # Importance for this output
    importance_out = |W[out_dim, :]| × activation

    # Prune sparsity% of this output's weights
    threshold = quantile(importance_out, sparsity)
    mask_out = importance_out >= threshold

    # Apply
    W[out_dim, :] *= mask_out
```

**Reason**: Ensures each output has similar capacity (balanced pruning).

## Calibration Data

### Requirements

**Amount**: 128 samples (from paper)
**Source**: Any text corpus (C4, WikiText, etc.)
**Length**: 2048 tokens per sample

```python
from datasets import load_dataset

# Load calibration dataset
calib_dataset = load_dataset("allenai/c4", "en", split="train", streaming=True)
calib_samples = []

for i, example in enumerate(calib_dataset):
    if i >= 128:
        break
    text = example['text'][:2048]  # First 2048 chars
    calib_samples.append(text)

# Tokenize
tokenized = tokenizer(
    calib_samples,
    return_tensors="pt",
    padding=True,
    truncation=True,
    max_length=2048
)
```

**Quality**: Higher-quality data → slightly better pruning (but not critical).

## Performance Results

**From ICLR 2024 paper** (LLaMA models on zero-shot tasks):

### Unstructured Sparsity

| Model | Sparsity | Method | Perplexity (WikiText2) | Average Accuracy |
|-------|----------|--------|------------------------|------------------|
| LLaMA-7B | 0% | Baseline | 5.68 | 60.2% |
| LLaMA-7B | 50% | Magnitude | 8.45 | 55.3% (-4.9%) |
| LLaMA-7B | 50% | SparseGPT | 6.32 | 59.1% (-1.1%) |
| LLaMA-7B | 50% | **Wanda** | **6.18** | **59.4% (-0.8%)** |

**Key finding**: Wanda achieves near-SparseGPT quality with much simpler algorithm (no Hessian).

### N:M Structured Sparsity (Hardware-Friendly)

| Model | Sparsity Pattern | Wanda PPL | Magnitude PPL | Speedup |
|-------|------------------|-----------|---------------|---------|
| LLaMA-7B | 2:4 (50%) | 6.42 | 9.12 | 2.0× (on A100) |
| LLaMA-7B | 4:8 (50%) | 6.38 | 8.95 | 2.0× (on A100) |

**N:M sparsity**: Compatible with NVIDIA sparse tensor cores.

### Scaling to Large Models

| Model Size | Sparsity | Wanda PPL | Degradation |
|------------|----------|-----------|-------------|
| LLaMA-7B | 50% | 6.18 | +0.50 |
| LLaMA-13B | 50% | 5.42 | +0.38 |
| LLaMA-30B | 50% | 4.77 | +0.21 |
| LLaMA-65B | 50% | 4.25 | +0.15 |

**Scaling behavior**: Larger models → better pruning (more redundancy).

## Extensions

### Wanda with N:M Sparsity

```python
def wanda_nm_prune(model, calib_data, n=2, m=4):
    """
    Wanda with N:M structured sparsity.

    Keeps top-N weights per M consecutive weights.
    Compatible with NVIDIA sparse tensor cores.
    """
    # Collect activations (same as standard Wanda)
    activations = collect_activations(model, calib_data)

    # Prune with N:M pattern
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            W = module.weight.data
            act = activations[name]

            # Importance
            importance = W.abs() * act.unsqueeze(0)

            # Apply N:M pruning
            W.data = apply_nm_mask(W, importance, n=n, m=m)

    return model

def apply_nm_mask(weight, importance, n=2, m=4):
    """Apply N:M sparsity pattern."""
    shape = weight.shape

    # Flatten and pad to multiple of M
    importance_flat = importance.flatten()
    weight_flat = weight.flatten()

    pad_size = (m - len(importance_flat) % m) % m
    importance_padded = F.pad(importance_flat, (0, pad_size))
    weight_padded = F.pad(weight_flat, (0, pad_size))

    # Reshape into groups of M
    importance_grouped = importance_padded.reshape(-1, m)
    weight_grouped = weight_padded.reshape(-1, m)

    # Find top-N per group
    _, indices = torch.topk(importance_grouped, n, dim=-1)

    # Create mask
    mask = torch.zeros_like(importance_grouped)
    mask.scatter_(1, indices, 1.0)

    # Apply
    weight_pruned = weight_grouped * mask
    weight_pruned = weight_pruned.flatten()[:len(weight_flat)]

    return weight_pruned.reshape(shape)
```

## Comparison with SparseGPT

| Aspect | Wanda | SparseGPT |
|--------|-------|-----------|
| **Complexity** | O(n) per layer | O(n²) per layer (Hessian) |
| **Speed** | Fast (~minutes) | Slow (~hours) |
| **Memory** | Low (activations) | High (Hessian matrix) |
| **Quality (50%)** | -0.8% accuracy | -0.4% accuracy |
| **Implementation** | Simple (~100 lines) | Complex (matrix inverse) |

**Trade-off**:
- Wanda: Simpler, faster, slightly lower quality
- SparseGPT: More complex, slower, slightly higher quality

**Recommendation**: Use Wanda unless you need absolute best quality.

## Practical Deployment

### Complete Pruning Script

```bash
# Clone Wanda repo
git clone https://github.com/locuslab/wanda
cd wanda

# Install dependencies
pip install torch transformers datasets

# Prune LLaMA-7B to 50% sparsity
python main.py \
    --model meta-llama/Llama-2-7b-hf \
    --prune_method wanda \
    --sparsity_ratio 0.5 \
    --sparsity_type unstructured \
    --save ./pruned_models/llama-7b-wanda-50

# Prune with 2:4 structured sparsity (NVIDIA GPUs)
python main.py \
    --model meta-llama/Llama-2-7b-hf \
    --prune_method wanda \
    --sparsity_ratio 0.5 \
    --sparsity_type 2:4 \
    --save ./pruned_models/llama-7b-wanda-2-4
```

### Evaluation

```python
from lm_eval import evaluator

# Evaluate pruned model
results = evaluator.simple_evaluate(
    model="hf",
    model_args="pretrained=./pruned_models/llama-7b-wanda-50",
    tasks=["arc_easy", "arc_challenge", "hellaswag", "winogrande"],
    batch_size=8
)

print("Accuracy after 50% pruning:")
for task, score in results['results'].items():
    print(f"{task}: {score['acc']:.3f}")
```

## Limitations

1. **No retraining**: One-shot only (can't recover from bad pruning)
2. **Activation dependency**: Requires calibration data
3. **Unstructured sparsity**: No speedup without specialized hardware (unless using N:M)

## Resources

- **Paper**: https://arxiv.org/abs/2306.11695
- **GitHub**: https://github.com/locuslab/wanda
- **ICLR 2024**: https://openreview.net/forum?id=PxoFut3dWW
