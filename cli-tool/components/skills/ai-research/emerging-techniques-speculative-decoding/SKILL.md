---
name: speculative-decoding
description: Accelerate LLM inference using speculative decoding, Medusa multiple heads, and lookahead decoding techniques. Use when optimizing inference speed (1.5-3.6× speedup), reducing latency for real-time applications, or deploying models with limited compute. Covers draft models, tree-based attention, Jacobi iteration, parallel token generation, and production deployment strategies.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Emerging Techniques, Speculative Decoding, Medusa, Lookahead Decoding, Fast Inference, Draft Models, Tree Attention, Parallel Generation, Latency Reduction, Inference Optimization]
dependencies: [transformers, torch]
---

# Speculative Decoding: Accelerating LLM Inference

## When to Use This Skill

Use Speculative Decoding when you need to:
- **Speed up inference** by 1.5-3.6× without quality loss
- **Reduce latency** for real-time applications (chatbots, code generation)
- **Optimize throughput** for high-volume serving
- **Deploy efficiently** on limited hardware
- **Generate faster** without changing model architecture

**Key Techniques**: Draft model speculative decoding, Medusa (multiple heads), Lookahead Decoding (Jacobi iteration)

**Papers**: Medusa (arXiv 2401.10774), Lookahead Decoding (ICML 2024), Speculative Decoding Survey (ACL 2024)

## Installation

```bash
# Standard speculative decoding (transformers)
pip install transformers accelerate

# Medusa (multiple decoding heads)
git clone https://github.com/FasterDecoding/Medusa
cd Medusa
pip install -e .

# Lookahead Decoding
git clone https://github.com/hao-ai-lab/LookaheadDecoding
cd LookaheadDecoding
pip install -e .

# Optional: vLLM with speculative decoding
pip install vllm
```

## Quick Start

### Basic Speculative Decoding (Draft Model)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load target model (large, slow)
target_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    device_map="auto",
    torch_dtype=torch.float16
)

# Load draft model (small, fast)
draft_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    device_map="auto",
    torch_dtype=torch.float16
)

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-70b-hf")

# Generate with speculative decoding
prompt = "Explain quantum computing in simple terms:"
inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

# Transformers 4.36+ supports assisted generation
outputs = target_model.generate(
    **inputs,
    assistant_model=draft_model,  # Enable speculative decoding
    max_new_tokens=256,
    do_sample=True,
    temperature=0.7,
)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
```

### Medusa (Multiple Decoding Heads)

```python
from medusa.model.medusa_model import MedusaModel

# Load Medusa-enhanced model
model = MedusaModel.from_pretrained(
    "FasterDecoding/medusa-vicuna-7b-v1.3",  # Pre-trained with Medusa heads
    torch_dtype=torch.float16,
    device_map="auto"
)

tokenizer = AutoTokenizer.from_pretrained("FasterDecoding/medusa-vicuna-7b-v1.3")

# Generate with Medusa (2-3× speedup)
prompt = "Write a Python function to calculate fibonacci numbers:"
inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

outputs = model.medusa_generate(
    **inputs,
    max_new_tokens=256,
    temperature=0.7,
    posterior_threshold=0.09,  # Acceptance threshold
    posterior_alpha=0.3,       # Tree construction parameter
)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
```

### Lookahead Decoding (Jacobi Iteration)

```python
from lookahead.lookahead_decoding import LookaheadDecoding

# Load model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# Initialize lookahead decoding
lookahead = LookaheadDecoding(
    model=model,
    tokenizer=tokenizer,
    window_size=15,    # Lookahead window (W)
    ngram_size=5,      # N-gram size (N)
    guess_size=5       # Number of parallel guesses
)

# Generate (1.5-2.3× speedup)
prompt = "Implement quicksort in Python:"
output = lookahead.generate(prompt, max_new_tokens=256)
print(output)
```

## Core Concepts

### 1. Speculative Decoding (Draft Model)

**Idea**: Use small draft model to generate candidates, large target model to verify in parallel.

**Algorithm**:
1. Draft model generates K tokens speculatively
2. Target model evaluates all K tokens in parallel (single forward pass)
3. Accept tokens where draft and target agree
4. Reject first disagreement, continue from there

```python
def speculative_decode(target_model, draft_model, prompt, K=4):
    """Speculative decoding algorithm."""
    # 1. Generate K draft tokens
    draft_tokens = draft_model.generate(prompt, max_new_tokens=K)

    # 2. Target model evaluates all K tokens in one forward pass
    target_logits = target_model(draft_tokens)  # Parallel!

    # 3. Accept/reject based on probability match
    accepted = []
    for i in range(K):
        p_draft = softmax(draft_model.logits[i])
        p_target = softmax(target_logits[i])

        # Acceptance probability
        if random.random() < min(1, p_target[draft_tokens[i]] / p_draft[draft_tokens[i]]):
            accepted.append(draft_tokens[i])
        else:
            break  # Reject, resample from target

    return accepted
```

**Performance**:
- Speedup: 1.5-2× with good draft model
- Zero quality loss (mathematically equivalent to target model)
- Best when draft model is 5-10× smaller than target

### 2. Medusa (Multiple Decoding Heads)

**Source**: arXiv 2401.10774 (2024)

**Innovation**: Add multiple prediction heads to existing model, predict future tokens without separate draft model.

**Architecture**:
```
Input → Base LLM (frozen) → Hidden State
                                ├→ Head 1 (predicts token t+1)
                                ├→ Head 2 (predicts token t+2)
                                ├→ Head 3 (predicts token t+3)
                                └→ Head 4 (predicts token t+4)
```

**Training**:
- **Medusa-1**: Freeze base LLM, train only heads
  - 2.2× speedup, lossless
- **Medusa-2**: Fine-tune base LLM + heads together
  - 2.3-3.6× speedup, better quality

**Tree-based Attention**:
```python
# Medusa constructs tree of candidates
# Example: Predict 2 steps ahead with top-2 per step

#         Root
#        /    \
#      T1a    T1b  (Step 1: 2 candidates)
#     /  \    / \
#  T2a  T2b T2c T2d  (Step 2: 4 candidates total)

# Single forward pass evaluates entire tree!
```

**Advantages**:
- No separate draft model needed
- Minimal training (only heads)
- Compatible with any LLM

### 3. Lookahead Decoding (Jacobi Iteration)

**Source**: ICML 2024

**Core idea**: Reformulate autoregressive decoding as solving system of equations, solve in parallel using Jacobi iteration.

**Mathematical formulation**:
```
Traditional:  y_t = f(x, y_1, ..., y_{t-1})  (sequential)
Jacobi:       y_t^{(k+1)} = f(x, y_1^{(k)}, ..., y_{t-1}^{(k)})  (parallel)
```

**Two branches**:

1. **Lookahead Branch**: Generate n-grams in parallel
   - Window size W: How many steps to look ahead
   - N-gram size N: How many past tokens to use

2. **Verification Branch**: Verify promising n-grams
   - Match n-grams with generated tokens
   - Accept if first token matches

```python
class LookaheadDecoding:
    def __init__(self, model, window_size=15, ngram_size=5):
        self.model = model
        self.W = window_size  # Lookahead window
        self.N = ngram_size   # N-gram size

    def generate_step(self, tokens):
        # Lookahead branch: Generate W × N candidates
        candidates = {}
        for w in range(1, self.W + 1):
            for n in range(1, self.N + 1):
                # Generate n-gram starting at position w
                ngram = self.generate_ngram(tokens, start=w, length=n)
                candidates[(w, n)] = ngram

        # Verification branch: Find matching n-grams
        verified = []
        for ngram in candidates.values():
            if ngram[0] == tokens[-1]:  # First token matches last input
                if self.verify(tokens, ngram):
                    verified.append(ngram)

        # Accept longest verified n-gram
        return max(verified, key=len) if verified else [self.model.generate_next(tokens)]
```

**Performance**:
- Speedup: 1.5-2.3× (up to 3.6× for code generation)
- No draft model or training needed
- Works out-of-the-box with any model

## Method Comparison

| Method | Speedup | Training Needed | Draft Model | Quality Loss |
|--------|---------|-----------------|-------------|--------------|
| **Draft Model Speculative** | 1.5-2× | No | Yes (external) | None |
| **Medusa** | 2-3.6× | Minimal (heads only) | No (built-in heads) | None |
| **Lookahead** | 1.5-2.3× | None | No | None |
| **Naive Batching** | 1.2-1.5× | No | No | None |

## Advanced Patterns

### Training Medusa Heads

```python
from medusa.model.medusa_model import MedusaModel
from medusa.model.kv_cache import initialize_past_key_values
import torch.nn as nn

# 1. Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "lmsys/vicuna-7b-v1.3",
    torch_dtype=torch.float16
)

# 2. Add Medusa heads
num_heads = 4
medusa_heads = nn.ModuleList([
    nn.Linear(base_model.config.hidden_size, base_model.config.vocab_size, bias=False)
    for _ in range(num_heads)
])

# 3. Training loop (freeze base model for Medusa-1)
for param in base_model.parameters():
    param.requires_grad = False  # Freeze base

optimizer = torch.optim.Adam(medusa_heads.parameters(), lr=1e-3)

for batch in dataloader:
    # Forward pass
    hidden_states = base_model(**batch, output_hidden_states=True).hidden_states[-1]

    # Predict future tokens with each head
    loss = 0
    for i, head in enumerate(medusa_heads):
        logits = head(hidden_states)
        # Target: tokens shifted by (i+1) positions
        target = batch['input_ids'][:, i+1:]
        loss += F.cross_entropy(logits[:, :-i-1], target)

    # Backward
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

### Hybrid: Speculative + Medusa

```python
# Use Medusa as draft model for speculative decoding
draft_medusa = MedusaModel.from_pretrained("medusa-vicuna-7b")
target_model = AutoModelForCausalLM.from_pretrained("vicuna-33b")

# Draft generates multiple candidates with Medusa
draft_tokens = draft_medusa.medusa_generate(prompt, max_new_tokens=5)

# Target verifies in single forward pass
outputs = target_model.generate(
    prompt,
    assistant_model=draft_medusa,  # Use Medusa as draft
    max_new_tokens=256
)

# Combines benefits: Medusa speed + large model quality
```

### Optimal Draft Model Selection

```python
def select_draft_model(target_model_size, target):
    """Select optimal draft model for speculative decoding."""
    # Rule: Draft should be 5-10× smaller
    if target_model_size == "70B":
        return "7B"  # 10× smaller
    elif target_model_size == "33B":
        return "7B"  # 5× smaller
    elif target_model_size == "13B":
        return "1B"  # 13× smaller
    else:
        return None  # Target too small, use Medusa/Lookahead instead

# Example
draft = select_draft_model("70B", target_model)
# Returns "7B" → Use Llama-2-7b as draft for Llama-2-70b
```

## Best Practices

### 1. Choose the Right Method

```python
# New deployment → Medusa (best overall speedup, no draft model)
if deploying_new_model:
    use_method = "Medusa"

# Existing deployment with small model available → Draft speculative
elif have_small_version_of_model:
    use_method = "Draft Model Speculative"

# Want zero training/setup → Lookahead
elif want_plug_and_play:
    use_method = "Lookahead Decoding"
```

### 2. Hyperparameter Tuning

**Draft Model Speculative**:
```python
# K = number of speculative tokens
K = 4  # Good default
K = 2  # Conservative (higher acceptance)
K = 8  # Aggressive (lower acceptance, but more when accepted)

# Rule: Larger K → more speedup IF draft model is good
```

**Medusa**:
```python
# Posterior threshold (acceptance confidence)
posterior_threshold = 0.09  # Standard (from paper)
posterior_threshold = 0.05  # More conservative (slower, higher quality)
posterior_threshold = 0.15  # More aggressive (faster, may degrade quality)

# Tree depth (how many steps ahead)
medusa_choices = [[0], [0, 0], [0, 1], [0, 0, 0]]  # Depth 3 (standard)
```

**Lookahead**:
```python
# Window size W (lookahead distance)
# N-gram size N (context for generation)

# 7B model (more resources)
W, N = 15, 5

# 13B model (moderate)
W, N = 10, 5

# 33B+ model (limited resources)
W, N = 7, 5
```

### 3. Production Deployment

```python
# vLLM with speculative decoding
from vllm import LLM, SamplingParams

# Initialize with draft model
llm = LLM(
    model="meta-llama/Llama-2-70b-hf",
    speculative_model="meta-llama/Llama-2-7b-hf",  # Draft model
    num_speculative_tokens=5,
    use_v2_block_manager=True,
)

# Generate
prompts = ["Tell me about AI:", "Explain quantum physics:"]
sampling_params = SamplingParams(temperature=0.7, max_tokens=256)

outputs = llm.generate(prompts, sampling_params)
for output in outputs:
    print(output.outputs[0].text)
```

## Resources

- **Medusa Paper**: https://arxiv.org/abs/2401.10774
- **Medusa GitHub**: https://github.com/FasterDecoding/Medusa
- **Lookahead Decoding (ICML 2024)**: https://lmsys.org/blog/2023-11-21-lookahead-decoding/
- **Lookahead GitHub**: https://github.com/hao-ai-lab/LookaheadDecoding
- **Speculative Decoding Survey (ACL 2024)**: https://aclanthology.org/2024.findings-acl.456.pdf
- **Comprehensive Survey**: https://arxiv.org/abs/2401.07851

## See Also

- `references/draft_model.md` - Draft model selection and training
- `references/medusa.md` - Medusa architecture and training
- `references/lookahead.md` - Lookahead decoding implementation details


