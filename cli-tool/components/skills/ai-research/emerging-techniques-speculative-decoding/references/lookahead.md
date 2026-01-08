# Lookahead Decoding: Jacobi Iteration

Based on ICML 2024 paper and LMSYS blog post

## Overview

**Source**: https://lmsys.org/blog/2023-11-21-lookahead-decoding/
**Paper**: ICML 2024
**GitHub**: https://github.com/hao-ai-lab/LookaheadDecoding

Lookahead Decoding breaks sequential dependency in autoregressive decoding using Jacobi iteration, achieving 1.5-2.3× speedup without draft models or training.

## Core Concept

### Reformulation as Equation Solving

**Traditional autoregressive**:
```
y_t = f(x, y_1, y_2, ..., y_{t-1})  # Sequential
```

**Jacobi iteration**:
```
y_t^{(k+1)} = f(x, y_1^{(k)}, y_2^{(k)}, ..., y_{t-1}^{(k)})  # Parallel
```

**Key insight**: Although exact parallel decoding is impossible, we can generate multiple disjoint n-grams in parallel that may fit into the final sequence.

## Two-Branch Architecture

### Lookahead Branch

**Purpose**: Generate potential token sequences (n-grams) in parallel.

**Parameters**:
- `W` (window size): How many steps ahead to look
- `N` (n-gram size): How many past tokens to use for generation

```python
# Example: W=5, N=3
# Generate n-grams at positions 1-5 using past 1-3 tokens

def lookahead_branch(model, tokens, W=5, N=3):
    """Generate n-grams using Jacobi iteration."""
    candidates = {}

    for w in range(1, W + 1):         # Position offset
        for n in range(1, N + 1):     # N-gram length
            # Use n past tokens to predict at position w
            past_tokens = tokens[-n:]
            future_position = len(tokens) + w

            # Generate n-gram
            ngram = model.generate_ngram(
                context=past_tokens,
                position=future_position,
                length=n
            )

            candidates[(w, n)] = ngram

    return candidates
```

**Output**: Pool of candidate n-grams that might match future sequence.

### Verification Branch

**Purpose**: Identify and confirm promising n-grams.

```python
def verification_branch(model, tokens, candidates):
    """Verify which candidates match actual sequence."""
    verified = []

    for ngram in candidates:
        # Check if ngram's first token matches last generated token
        if ngram[0] == tokens[-1]:
            # Verify full n-gram with model
            is_valid = model.verify_sequence(tokens + ngram)

            if is_valid:
                verified.append(ngram)

    # Return longest verified n-gram
    return max(verified, key=len) if verified else None
```

**Acceptance**: N-gram accepted if its first token matches the last input token and model confirms the sequence.

## Algorithm

### Complete Lookahead Decoding

```python
class LookaheadDecoding:
    def __init__(self, model, W=15, N=5, G=5):
        """
        Args:
            W: Window size (lookahead distance)
            N: N-gram size (context length)
            G: Guess size (parallel candidates)
        """
        self.model = model
        self.W = W
        self.N = N
        self.G = G

    def generate(self, input_ids, max_new_tokens=256):
        tokens = input_ids.clone()

        while len(tokens) < max_new_tokens:
            # 1. Lookahead: Generate candidates
            candidates = self._lookahead_step(tokens)

            # 2. Verification: Find matching n-grams
            accepted_ngram = self._verification_step(tokens, candidates)

            if accepted_ngram is not None:
                # Accept multiple tokens
                tokens = torch.cat([tokens, accepted_ngram])
            else:
                # Fallback: Generate single token
                next_token = self.model.generate_next(tokens)
                tokens = torch.cat([tokens, next_token])

        return tokens

    def _lookahead_step(self, tokens):
        """Generate candidate n-grams in parallel."""
        candidates = []

        for w in range(1, self.W + 1):
            for n in range(1, self.N + 1):
                # Sample n-gram from model
                ngram = self.model.sample_ngram(
                    tokens=tokens,
                    offset=w,
                    context_size=n,
                    num_samples=self.G
                )
                candidates.extend(ngram)

        return candidates

    def _verification_step(self, tokens, candidates):
        """Verify candidates and select best."""
        valid_ngrams = []

        for ngram in candidates:
            # Must match continuation
            if ngram[0] == self._get_next_token_prediction(tokens):
                # Verify full sequence
                if self._verify_ngram(tokens, ngram):
                    valid_ngrams.append(ngram)

        # Return longest valid n-gram
        return max(valid_ngrams, key=len) if valid_ngrams else None
```

## Performance Analysis

### Speedup vs Parameters

**From paper (7B model on HumanEval)**:

| Window (W) | N-gram (N) | Speedup | Throughput |
|------------|------------|---------|------------|
| 5 | 3 | 1.5× | 45 tokens/sec |
| 10 | 5 | 1.8× | 54 tokens/sec |
| 15 | 5 | 2.2× | 66 tokens/sec |
| 20 | 7 | 2.3× | 69 tokens/sec |

**Hardware configurations (A100 GPU)**:

| Model Size | Recommended W | Recommended N |
|------------|---------------|---------------|
| 7B | 15 | 5 |
| 13B | 10 | 5 |
| 33B | 7 | 5 |
| 70B | 5 | 3 |

**Rule**: Larger models → smaller W, N (more expensive to verify)

### Scaling Law

**Key finding from paper**:

"When n-gram size is sufficiently large, exponentially increasing future token guesses can linearly reduce decoding steps."

```
Speedup ≈ 1 + (W × acceptance_rate)

where acceptance_rate depends on:
- Model quality (better models = higher acceptance)
- Task type (code generation > chat)
- N-gram size (larger N = higher acceptance but more compute)
```

## Hyperparameter Tuning

### Window Size (W)

```python
# Trade-off: Larger W = more candidates but more verification cost

W = 5   # Conservative (low overhead, moderate speedup)
W = 10  # Balanced
W = 15  # Standard (from paper, 7B models)
W = 20  # Aggressive (diminishing returns)

# Rule: W should be ~2-3× average token acceptance length
```

### N-gram Size (N)

```python
# Trade-off: Larger N = better context but slower generation

N = 3   # Fast generation, less context
N = 5   # Standard (from paper)
N = 7   # Better context, slower

# Rule: N should be large enough to capture local patterns
```

### Guess Size (G)

```python
# Number of parallel n-gram candidates per position

G = 1   # Deterministic (fastest, lower acceptance)
G = 5   # Standard (good balance)
G = 10  # More exploration (higher acceptance, more compute)
```

## Comparison with Other Methods

| Method | Speedup | Training | Draft Model | Memory |
|--------|---------|----------|-------------|---------|
| **Lookahead** | 1.5-2.3× | None | No | Base only |
| Draft Speculative | 1.5-2× | None | Yes | Base + draft |
| Medusa | 2-3.6× | Minimal | No | Base + heads |

**Advantages of Lookahead**:
- Zero training required
- No draft model needed
- Works out-of-the-box with any model
- No model modification

**Disadvantages**:
- Lower speedup than Medusa
- More complex implementation
- Verification overhead

## Task-Specific Performance

**From paper**:

| Task | Baseline | Lookahead | Speedup |
|------|----------|-----------|---------|
| **HumanEval (code)** | 30 tok/s | 69 tok/s | 2.3× |
| **MT-Bench (chat)** | 35 tok/s | 56 tok/s | 1.6× |
| **GSM8K (math)** | 32 tok/s | 54 tok/s | 1.7× |

**Why code is faster**: Higher n-gram predictability (syntax, patterns).

## Production Deployment

### Integration Example

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load model
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-2-7b-hf")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# Initialize Lookahead
lookahead = LookaheadDecoding(
    model=model,
    W=15,  # Window size
    N=5,   # N-gram size
    G=5    # Guess size
)

# Generate
prompt = "Write a Python function to calculate fibonacci:"
input_ids = tokenizer.encode(prompt, return_tensors="pt")

output = lookahead.generate(input_ids, max_new_tokens=256)
response = tokenizer.decode(output[0], skip_special_tokens=True)

print(response)
```

### Optimization Tips

1. **Batch processing**: Verify multiple n-grams in single forward pass
2. **Caching**: Reuse KV cache across verification steps
3. **Early stopping**: Stop generation when no candidates match
4. **Adaptive parameters**: Adjust W, N based on acceptance rate

## Resources

- **Blog Post**: https://lmsys.org/blog/2023-11-21-lookahead-decoding/
- **GitHub**: https://github.com/hao-ai-lab/LookaheadDecoding
- **Paper**: ICML 2024 (Break the Sequential Dependency of LLM Inference Using Lookahead Decoding)
- **NVIDIA Blog**: https://developer.nvidia.com/blog/optimizing-qwen2-5-coder-throughput-with-nvidia-tensorrt-llm-lookahead-decoding/
