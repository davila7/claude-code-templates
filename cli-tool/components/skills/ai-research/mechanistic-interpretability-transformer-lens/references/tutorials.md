# TransformerLens Tutorials

## Tutorial 1: Basic Activation Analysis

### Goal
Understand how to load models, cache activations, and inspect model internals.

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

# 1. Load model
model = HookedTransformer.from_pretrained("gpt2-small")
print(f"Model has {model.cfg.n_layers} layers, {model.cfg.n_heads} heads")

# 2. Tokenize input
prompt = "The capital of France is"
tokens = model.to_tokens(prompt)
print(f"Tokens shape: {tokens.shape}")
print(f"String tokens: {model.to_str_tokens(prompt)}")

# 3. Run with cache
logits, cache = model.run_with_cache(tokens)
print(f"Logits shape: {logits.shape}")
print(f"Cache keys: {len(cache.keys())}")

# 4. Inspect activations
for layer in range(model.cfg.n_layers):
    resid = cache["resid_post", layer]
    print(f"Layer {layer} residual norm: {resid.norm().item():.2f}")

# 5. Look at attention patterns
attn = cache["pattern", 0]  # Layer 0
print(f"Attention shape: {attn.shape}")  # [batch, heads, q_pos, k_pos]

# 6. Get top predictions
probs = torch.softmax(logits[0, -1], dim=-1)
top_tokens = probs.topk(5)
for token_id, prob in zip(top_tokens.indices, top_tokens.values):
    print(f"{model.to_string(token_id.unsqueeze(0))}: {prob.item():.3f}")
```

---

## Tutorial 2: Activation Patching

### Goal
Identify which activations causally affect model output.

### Concept
1. Run model on "clean" input, cache activations
2. Run model on "corrupted" input
3. Patch clean activations into corrupted run
4. Measure effect on output

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# Define clean and corrupted prompts
clean_prompt = "The Eiffel Tower is in the city of"
corrupted_prompt = "The Colosseum is in the city of"

clean_tokens = model.to_tokens(clean_prompt)
corrupted_tokens = model.to_tokens(corrupted_prompt)

# Get clean activations
_, clean_cache = model.run_with_cache(clean_tokens)

# Define metric
paris_token = model.to_single_token(" Paris")
rome_token = model.to_single_token(" Rome")

def logit_diff(logits):
    """Positive = model prefers Paris over Rome"""
    return (logits[0, -1, paris_token] - logits[0, -1, rome_token]).item()

# Baseline measurements
clean_logits = model(clean_tokens)
corrupted_logits = model(corrupted_tokens)
print(f"Clean logit diff: {logit_diff(clean_logits):.3f}")
print(f"Corrupted logit diff: {logit_diff(corrupted_logits):.3f}")

# Patch each layer
results = []
for layer in range(model.cfg.n_layers):
    def patch_hook(activation, hook, layer=layer):
        activation[:] = clean_cache["resid_post", layer]
        return activation

    patched_logits = model.run_with_hooks(
        corrupted_tokens,
        fwd_hooks=[(f"blocks.{layer}.hook_resid_post", patch_hook)]
    )
    results.append(logit_diff(patched_logits))
    print(f"Layer {layer}: {results[-1]:.3f}")

# Find most important layer
best_layer = max(range(len(results)), key=lambda i: results[i])
print(f"\nMost important layer: {best_layer}")
```

### Position-Specific Patching

```python
import torch

seq_len = clean_tokens.shape[1]
results = torch.zeros(model.cfg.n_layers, seq_len)

for layer in range(model.cfg.n_layers):
    for pos in range(seq_len):
        def patch_hook(activation, hook, layer=layer, pos=pos):
            activation[:, pos, :] = clean_cache["resid_post", layer][:, pos, :]
            return activation

        patched_logits = model.run_with_hooks(
            corrupted_tokens,
            fwd_hooks=[(f"blocks.{layer}.hook_resid_post", patch_hook)]
        )
        results[layer, pos] = logit_diff(patched_logits)

# Visualize as heatmap
import matplotlib.pyplot as plt
plt.figure(figsize=(12, 8))
plt.imshow(results.numpy(), aspect='auto', cmap='RdBu')
plt.xlabel('Position')
plt.ylabel('Layer')
plt.colorbar(label='Logit Difference')
plt.title('Activation Patching Results')
```

---

## Tutorial 3: Direct Logit Attribution

### Goal
Identify which components (heads, neurons) contribute to specific predictions.

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

prompt = "The capital of France is"
tokens = model.to_tokens(prompt)
logits, cache = model.run_with_cache(tokens)

# Target token
target_token = model.to_single_token(" Paris")

# Get unembedding direction for target
target_direction = model.W_U[:, target_token]  # [d_model]

# Attribution per attention head
head_contributions = torch.zeros(model.cfg.n_layers, model.cfg.n_heads)

for layer in range(model.cfg.n_layers):
    # Get per-head output at final position
    z = cache["z", layer][0, -1]  # [n_heads, d_head]

    for head in range(model.cfg.n_heads):
        # Project through W_O to get contribution to residual
        head_out = z[head] @ model.W_O[layer, head]  # [d_model]

        # Dot with target direction
        contribution = (head_out @ target_direction).item()
        head_contributions[layer, head] = contribution

# Find top contributing heads
flat_idx = head_contributions.flatten().topk(10)
print("Top 10 heads for predicting 'Paris':")
for idx, val in zip(flat_idx.indices, flat_idx.values):
    layer = idx.item() // model.cfg.n_heads
    head = idx.item() % model.cfg.n_heads
    print(f"  L{layer}H{head}: {val.item():.3f}")
```

---

## Tutorial 4: Induction Head Detection

### Goal
Find attention heads that implement the [A][B]...[A] → [B] pattern.

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# Create repeated sequence pattern
# Pattern: [A][B][C][A] - model should attend from last A to B
seq = torch.randint(1000, 5000, (1, 20))
# Repeat first half
seq[0, 10:] = seq[0, :10]

_, cache = model.run_with_cache(seq)

# For induction heads: position i should attend to position (i - seq_len/2 + 1)
# At position 10 (second A), should attend to position 1 (first B)

induction_scores = torch.zeros(model.cfg.n_layers, model.cfg.n_heads)

for layer in range(model.cfg.n_layers):
    pattern = cache["pattern", layer][0]  # [heads, q_pos, k_pos]

    # Check attention from repeated positions to position after first occurrence
    for offset in range(1, 10):
        q_pos = 10 + offset  # Position in second half
        k_pos = offset       # Should attend to corresponding position in first half

        # Average attention to the "correct" position
        induction_scores[layer] += pattern[:, q_pos, k_pos]

    induction_scores[layer] /= 9  # Average over offsets

# Find top induction heads
print("Top induction heads:")
for layer in range(model.cfg.n_layers):
    for head in range(model.cfg.n_heads):
        score = induction_scores[layer, head].item()
        if score > 0.3:
            print(f"  L{layer}H{head}: {score:.3f}")
```

---

## Tutorial 5: Logit Lens

### Goal
See what the model "believes" at each layer before final unembedding.

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

prompt = "The quick brown fox jumps over the lazy"
tokens = model.to_tokens(prompt)
logits, cache = model.run_with_cache(tokens)

# Get accumulated residual at each layer
# Apply LayerNorm to match what unembedding sees
accumulated = cache.accumulated_resid(layer=None, incl_mid=False, apply_ln=True)
# Shape: [n_layers + 1, batch, pos, d_model]

# Project to vocabulary
layer_logits = accumulated @ model.W_U  # [n_layers + 1, batch, pos, d_vocab]

# Look at predictions for final position
print("Layer-by-layer predictions for final token:")
for layer in range(model.cfg.n_layers + 1):
    probs = torch.softmax(layer_logits[layer, 0, -1], dim=-1)
    top_token = probs.argmax()
    top_prob = probs[top_token].item()
    print(f"Layer {layer}: {model.to_string(top_token.unsqueeze(0))!r} ({top_prob:.3f})")
```

---

## Tutorial 6: Steering with Activation Addition

### Goal
Add a steering vector to change model behavior.

### Step-by-Step

```python
from transformer_lens import HookedTransformer
import torch

model = HookedTransformer.from_pretrained("gpt2-small")

# Get activations for contrasting prompts
positive_prompt = "I love this! It's absolutely wonderful and"
negative_prompt = "I hate this! It's absolutely terrible and"

_, pos_cache = model.run_with_cache(model.to_tokens(positive_prompt))
_, neg_cache = model.run_with_cache(model.to_tokens(negative_prompt))

# Compute steering vector (positive - negative direction)
layer = 6
steering_vector = (
    pos_cache["resid_post", layer].mean(dim=1) -
    neg_cache["resid_post", layer].mean(dim=1)
)

# Generate with steering
test_prompt = "The movie was"
test_tokens = model.to_tokens(test_prompt)

def steer_hook(activation, hook):
    activation += 2.0 * steering_vector
    return activation

# Without steering
normal_output = model.generate(test_tokens, max_new_tokens=20)
print(f"Normal: {model.to_string(normal_output[0])}")

# With positive steering
steered_output = model.generate(
    test_tokens,
    max_new_tokens=20,
    fwd_hooks=[(f"blocks.{layer}.hook_resid_post", steer_hook)]
)
print(f"Steered: {model.to_string(steered_output[0])}")
```

---

## External Resources

### Official Tutorials
- [Main Demo](https://transformerlensorg.github.io/TransformerLens/generated/demos/Main_Demo.html)
- [Exploratory Analysis](https://transformerlensorg.github.io/TransformerLens/generated/demos/Exploratory_Analysis_Demo.html)
- [Activation Patching Demo](https://colab.research.google.com/github/TransformerLensOrg/TransformerLens/blob/main/demos/Activation_Patching_in_TL_Demo.ipynb)

### ARENA Course
Comprehensive 200+ hour curriculum: https://arena-foundation.github.io/ARENA/

### Neel Nanda's Resources
- [Getting Started in Mech Interp](https://www.neelnanda.io/mechanistic-interpretability/getting-started)
- [Mech Interp Glossary](https://www.neelnanda.io/mechanistic-interpretability/glossary)
- [YouTube Channel](https://www.youtube.com/@neelnanda)
