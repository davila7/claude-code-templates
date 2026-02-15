# Medusa: Multiple Decoding Heads

Based on arXiv 2401.10774 (2024) - MEDUSA: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads

## Overview

**Source**: https://arxiv.org/abs/2401.10774
**GitHub**: https://github.com/FasterDecoding/Medusa

Medusa augments LLM inference by adding extra decoding heads to predict multiple subsequent tokens in parallel, achieving 2.2-3.6× speedup without quality loss.

## Architecture

### Core Innovation

Instead of separate draft model, add multiple prediction heads to existing LLM:

```
Input → Base LLM (frozen or fine-tuned) → Hidden State
                                             ├→ Head 0 (original, predicts t+1)
                                             ├→ Head 1 (predicts t+2)
                                             ├→ Head 2 (predicts t+3)
                                             └→ Head 3 (predicts t+4)
```

### Tree-Based Attention

**Key mechanism**: Construct candidate tree, verify all paths in single forward pass.

Example with 2 heads, top-2 candidates per head:

```
                Root (current token)
                /                  \
           Candidate 1a         Candidate 1b    (Head 1: 2 options)
           /        \           /        \
        C2a        C2b       C2c        C2d     (Head 2: 4 total paths)
```

Single forward pass evaluates entire tree (4 candidates) in parallel!

## Training Methods

### Medusa-1: Frozen Backbone

**Approach**: Keep base LLM frozen, train only Medusa heads.

**Advantages**:
- Lossless (base model unchanged)
- Fast training (~few hours on 8 GPUs)
- Minimal data needed (~10M tokens)

**Performance**: 2.2× speedup

```python
# Training loop for Medusa-1
for batch in dataloader:
    # Frozen base model
    with torch.no_grad():
        hidden_states = base_model(**batch, output_hidden_states=True).hidden_states[-1]

    # Train Medusa heads
    for i, head in enumerate(medusa_heads):
        logits = head(hidden_states)
        # Target: tokens shifted by (i+1) positions
        targets = batch['input_ids'][:, i+1:]
        loss += F.cross_entropy(logits[:, :-i-1], targets)

    loss.backward()
    optimizer.step()
```

**Training Data**: Any text corpus (Wikipedia, C4, etc.)

### Medusa-2: Joint Fine-Tuning

**Approach**: Fine-tune base LLM + Medusa heads together.

**Advantages**:
- Better prediction accuracy (heads aligned with base)
- Higher speedup (2.3-3.6×)

**Challenge**: Must preserve base model capabilities

**Solution**: Special training recipe:
1. Start with pre-trained base model
2. Add Medusa heads
3. Fine-tune both together with careful LR scheduling
4. Use high-quality data to avoid degradation

```python
# Medusa-2 training
# All parameters trainable
for param in base_model.parameters():
    param.requires_grad = True  # Unfreeze base

for param in medusa_heads.parameters():
    param.requires_grad = True

# Different learning rates
optimizer = torch.optim.AdamW([
    {'params': base_model.parameters(), 'lr': 1e-5},      # Lower for base
    {'params': medusa_heads.parameters(), 'lr': 1e-3},    # Higher for heads
])
```

**Performance**: 2.3-3.6× speedup

## Inference Algorithm

### Candidate Generation

```python
def medusa_generate_candidates(base_logits, medusa_head_logits, top_k=10):
    """Generate candidate sequences using tree structure."""
    candidates = []

    # Base token (original LLM output)
    base_token = torch.argmax(base_logits, dim=-1)

    # For each Medusa head, get top-k predictions
    medusa_candidates = []
    for head_logits in medusa_head_logits:
        top_k_tokens = torch.topk(head_logits, k=top_k, dim=-1).indices
        medusa_candidates.append(top_k_tokens)

    # Build candidate tree (all combinations)
    # With 4 heads, top-2 each: 2^4 = 16 candidates
    for combo in itertools.product(*medusa_candidates):
        candidate = [base_token] + list(combo)
        candidates.append(candidate)

    return candidates  # Shape: (num_candidates, seq_len)
```

### Tree Verification

```python
def medusa_verify_candidates(model, candidates, past_key_values):
    """Verify all candidates in single forward pass using tree attention."""
    # Construct tree attention mask
    # All candidates share prefix, diverge at different points
    attention_mask = build_tree_attention_mask(candidates)

    # Single forward pass for all candidates
    outputs = model(
        input_ids=candidates,
        attention_mask=attention_mask,
        past_key_values=past_key_values,
        use_cache=True
    )

    # Score each candidate
    scores = compute_acceptance_scores(outputs.logits, candidates)

    # Accept longest valid candidate
    best_candidate = select_best(candidates, scores)

    return best_candidate
```

### Acceptance Criterion

**Posterior threshold**: Accept token if probability exceeds threshold.

```python
def should_accept(token, token_prob, threshold=0.09):
    """Medusa acceptance criterion."""
    return token_prob >= threshold

# Typical thresholds:
# - 0.09: Standard (from paper)
# - 0.05: Conservative (fewer rejections, slower)
# - 0.15: Aggressive (more rejections, faster when works)
```

## Performance Results

**From paper (Vicuna-7B, MT-Bench):**

| Configuration | Speedup | Quality (MT-Bench score) |
|---------------|---------|--------------------------|
| Baseline | 1.0× | 6.57 |
| Medusa-1 (frozen) | 2.2× | 6.57 (lossless) |
| Medusa-2 (joint) | 2.3× | 6.60 (+0.03) |
| Medusa-2 (optimized) | 3.6× | 6.55 (-0.02) |

**Key findings**:
- Medusa-1: No quality degradation (frozen base)
- Medusa-2: Slight quality improvement possible
- Trade-off: More aggressive = faster but may reduce quality

## Hyperparameter Tuning

### Number of Heads

```python
# Typical configurations:
num_heads = 2  # Conservative (2× speedup)
num_heads = 3  # Balanced (2.5× speedup)
num_heads = 4  # Standard (3× speedup, from paper)
num_heads = 5  # Aggressive (3.5×+ speedup)

# Rule: More heads = more candidates but also more computation
# Optimal: 3-4 heads for most models
```

### Top-K per Head

```python
# Candidates per head
top_k = 2   # Standard (2^num_heads total candidates)
top_k = 3   # More candidates (3^num_heads)
top_k = 5   # Many candidates (5^num_heads)

# Example with 4 heads:
# top_k=2: 16 candidates (fast)
# top_k=3: 81 candidates (slower verification)
```

### Tree Construction

**Medusa Choices** (which candidate paths to explore):

```python
# Standard configuration (from paper)
medusa_choices = [
    [0],        # Only head 0
    [0, 0],     # Head 0, then head 1 (first candidate)
    [0, 1],     # Head 0, then head 1 (second candidate)
    [0, 0, 0],  # All heads (first path)
]

# Aggressive configuration (more paths)
medusa_choices = [
    [0],
    [0, 0], [0, 1],
    [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
]
```

## Training Recipe

### Data Requirements

**Medusa-1**:
- Amount: 10M-100M tokens
- Quality: Any text corpus works
- Time: 2-8 hours on 8× A100

**Medusa-2**:
- Amount: 100M-1B tokens
- Quality: High-quality (same domain as target use case)
- Time: 1-3 days on 8× A100

### Training Script

```bash
# Clone Medusa repo
git clone https://github.com/FasterDecoding/Medusa
cd Medusa

# Train Medusa-1 (frozen base)
python medusa/train/train.py \
    --model_name_or_path lmsys/vicuna-7b-v1.3 \
    --data_path ShareGPT_Vicuna_unfiltered/ShareGPT_V4.3_unfiltered_cleaned_split.json \
    --bf16 True \
    --output_dir medusa-vicuna-7b-v1.3 \
    --num_train_epochs 3 \
    --per_device_train_batch_size 4 \
    --gradient_accumulation_steps 8 \
    --learning_rate 1e-3 \
    --medusa_num_heads 4 \
    --medusa_num_layers 1 \
    --freeze_base_model True  # Medusa-1

# Train Medusa-2 (joint fine-tuning)
python medusa/train/train.py \
    --model_name_or_path lmsys/vicuna-7b-v1.3 \
    --data_path high_quality_data.json \
    --bf16 True \
    --output_dir medusa-vicuna-7b-v1.3-joint \
    --num_train_epochs 1 \
    --per_device_train_batch_size 4 \
    --gradient_accumulation_steps 8 \
    --learning_rate 1e-5 \  # Lower LR for base model
    --medusa_num_heads 4 \
    --freeze_base_model False  # Medusa-2 (joint)
```

## Deployment

### Loading Medusa Model

```python
from medusa.model.medusa_model import MedusaModel

# Load pre-trained Medusa model
model = MedusaModel.from_pretrained(
    "FasterDecoding/medusa-vicuna-7b-v1.3",
    torch_dtype=torch.float16,
    device_map="auto"
)

# Or load base + Medusa heads separately
base_model = AutoModelForCausalLM.from_pretrained("lmsys/vicuna-7b-v1.3")
medusa_heads = torch.load("medusa_heads.pt")
model = MedusaModel(base_model, medusa_heads)
```

### Generation

```python
# Generate with Medusa
outputs = model.medusa_generate(
    input_ids,
    max_new_tokens=256,
    temperature=0.7,
    posterior_threshold=0.09,    # Acceptance threshold
    posterior_alpha=0.3,         # Tree construction parameter
    medusa_choices=medusa_choices,  # Candidate paths
)
```

## Comparison with Speculative Decoding

| Aspect | Medusa | Speculative Decoding |
|--------|--------|----------------------|
| **Draft Model** | Built-in (heads) | External (separate model) |
| **Training** | Minimal (heads only) | None (use existing small model) |
| **Memory** | Base + heads (~1-2% overhead) | Base + draft (can be large) |
| **Speedup** | 2-3.6× | 1.5-2× |
| **Deployment** | Single model | Two models |

**When to use Medusa**:
- Want single model deployment
- Can afford minimal training
- Need best speedup (3×+)

**When to use Speculative**:
- Have existing small model
- Zero training budget
- Simpler setup

## Resources

- **Paper**: https://arxiv.org/abs/2401.10774
- **GitHub**: https://github.com/FasterDecoding/Medusa
- **Blog**: https://www.together.ai/blog/medusa
- **Demo**: https://sites.google.com/view/medusa-llm
