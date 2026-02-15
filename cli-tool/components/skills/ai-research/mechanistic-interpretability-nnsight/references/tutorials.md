# nnsight Tutorials

## Tutorial 1: Basic Activation Analysis

### Goal
Load a model, access internal activations, and analyze them.

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

# 1. Load model
model = LanguageModel("openai-community/gpt2", device_map="auto")

# 2. Trace and collect activations
prompt = "The capital of France is"

with model.trace(prompt) as tracer:
    # Collect from multiple layers
    activations = {}
    for i in range(12):  # GPT-2 has 12 layers
        activations[i] = model.transformer.h[i].output[0].save()

    # Get final logits
    logits = model.output.save()

# 3. Analyze (outside context)
print("Layer-wise activation norms:")
for layer, act in activations.items():
    print(f"  Layer {layer}: {act.norm().item():.2f}")

# 4. Check predictions
probs = torch.softmax(logits[0, -1], dim=-1)
top_tokens = probs.topk(5)
print("\nTop predictions:")
for token_id, prob in zip(top_tokens.indices, top_tokens.values):
    token_str = model.tokenizer.decode(token_id)
    print(f"  {token_str!r}: {prob.item():.3f}")
```

---

## Tutorial 2: Activation Patching

### Goal
Patch activations from one prompt into another to test causal relationships.

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

clean_prompt = "The Eiffel Tower is in the city of"
corrupted_prompt = "The Colosseum is in the city of"

# 1. Get clean activations
with model.trace(clean_prompt) as tracer:
    clean_hidden = model.transformer.h[8].output[0].save()
    clean_logits = model.output.save()

# 2. Define metric
paris_token = model.tokenizer.encode(" Paris")[0]
rome_token = model.tokenizer.encode(" Rome")[0]

def logit_diff(logits):
    return (logits[0, -1, paris_token] - logits[0, -1, rome_token]).item()

print(f"Clean logit diff: {logit_diff(clean_logits):.3f}")

# 3. Patch clean into corrupted
with model.trace(corrupted_prompt) as tracer:
    # Replace layer 8 output with clean activations
    model.transformer.h[8].output[0][:] = clean_hidden
    patched_logits = model.output.save()

print(f"Patched logit diff: {logit_diff(patched_logits):.3f}")

# 4. Systematic patching sweep
results = torch.zeros(12)  # 12 layers

for layer in range(12):
    # Get clean activation for this layer
    with model.trace(clean_prompt) as tracer:
        clean_act = model.transformer.h[layer].output[0].save()

    # Patch into corrupted
    with model.trace(corrupted_prompt) as tracer:
        model.transformer.h[layer].output[0][:] = clean_act
        logits = model.output.save()

    results[layer] = logit_diff(logits)
    print(f"Layer {layer}: {results[layer]:.3f}")

print(f"\nMost important layer: {results.argmax().item()}")
```

---

## Tutorial 3: Cross-Prompt Activation Sharing

### Goal
Transfer activations between different prompts in a single trace.

### Step-by-Step

```python
from nnsight import LanguageModel

model = LanguageModel("gpt2", device_map="auto")

with model.trace() as tracer:
    # First prompt - get "cat" representations
    with tracer.invoke("The cat sat on the mat"):
        cat_hidden = model.transformer.h[6].output[0].save()

    # Second prompt - inject "cat" into "dog"
    with tracer.invoke("The dog ran through the park"):
        # Replace with cat's activations
        model.transformer.h[6].output[0][:] = cat_hidden
        modified_logits = model.output.save()

# The dog prompt now has cat's internal representations
print(f"Modified logits shape: {modified_logits.shape}")
```

---

## Tutorial 4: Remote Execution with NDIF

### Goal
Run the same interpretability code on massive models (70B+).

### Step-by-Step

```python
from nnsight import LanguageModel
import os

# 1. Setup API key
os.environ["NDIF_API_KEY"] = "your_key_here"

# 2. Load large model (runs remotely)
model = LanguageModel("meta-llama/Llama-3.1-70B")

# 3. Same code, just remote=True
prompt = "The meaning of life is"

with model.trace(prompt, remote=True) as tracer:
    # Access layer 40 of 70B model!
    hidden = model.model.layers[40].output[0].save()
    logits = model.output.save()

# 4. Results returned from NDIF
print(f"Hidden shape: {hidden.shape}")
print(f"Logits shape: {logits.shape}")

# 5. Check predictions
import torch
probs = torch.softmax(logits[0, -1], dim=-1)
top_tokens = probs.topk(5)
print("\nTop predictions from Llama-70B:")
for token_id, prob in zip(top_tokens.indices, top_tokens.values):
    print(f"  {model.tokenizer.decode(token_id)!r}: {prob.item():.3f}")
```

### Batching with Sessions

```python
# Run multiple experiments in one NDIF request
with model.session(remote=True) as session:
    with model.trace("What is 2+2?"):
        math_hidden = model.model.layers[30].output[0].save()

    with model.trace("The capital of France is"):
        fact_hidden = model.model.layers[30].output[0].save()

# Compare representations
similarity = torch.cosine_similarity(
    math_hidden.mean(dim=1),
    fact_hidden.mean(dim=1),
    dim=-1
)
print(f"Similarity: {similarity.item():.3f}")
```

---

## Tutorial 5: Steering with Activation Addition

### Goal
Add a steering vector to change model behavior.

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

# 1. Get contrasting activations
with model.trace("I love this movie, it's wonderful") as tracer:
    positive_hidden = model.transformer.h[6].output[0].save()

with model.trace("I hate this movie, it's terrible") as tracer:
    negative_hidden = model.transformer.h[6].output[0].save()

# 2. Compute steering direction
steering_vector = positive_hidden.mean(dim=1) - negative_hidden.mean(dim=1)

# 3. Generate without steering
test_prompt = "This restaurant is"
with model.trace(test_prompt) as tracer:
    normal_logits = model.output.save()

# 4. Generate with steering
with model.trace(test_prompt) as tracer:
    # Add steering at layer 6
    model.transformer.h[6].output[0][:] += 3.0 * steering_vector
    steered_logits = model.output.save()

# 5. Compare predictions
def top_prediction(logits):
    token = logits[0, -1].argmax()
    return model.tokenizer.decode(token)

print(f"Normal: {top_prediction(normal_logits)}")
print(f"Steered (positive): {top_prediction(steered_logits)}")
```

---

## Tutorial 6: Logit Lens

### Goal
See what the model "believes" at each layer.

### Step-by-Step

```python
from nnsight import LanguageModel
import torch

model = LanguageModel("gpt2", device_map="auto")

prompt = "The quick brown fox jumps over the lazy"

with model.trace(prompt) as tracer:
    # Collect residual stream at each layer
    residuals = []
    for i in range(12):
        resid = model.transformer.h[i].output[0].save()
        residuals.append(resid)

# Access model's unembedding and final layernorm
W_U = model._model.lm_head.weight.T  # [d_model, vocab]
ln_f = model._model.transformer.ln_f

print("Layer-by-layer predictions for final token:")
for i, resid in enumerate(residuals):
    # Apply final layernorm
    normed = ln_f(resid)

    # Project to vocabulary
    layer_logits = normed @ W_U

    # Get prediction
    probs = torch.softmax(layer_logits[0, -1], dim=-1)
    top_token = probs.argmax()
    top_prob = probs[top_token].item()

    print(f"Layer {i}: {model.tokenizer.decode(top_token)!r} ({top_prob:.3f})")
```

---

## External Resources

### Official Resources
- [Getting Started](https://nnsight.net/start/)
- [Features Overview](https://nnsight.net/features/)
- [Documentation](https://nnsight.net/documentation/)
- [Tutorials](https://nnsight.net/tutorials/)

### NDIF Resources
- [NDIF Homepage](https://ndif.us/)
- [Available Models](https://ndif.us/models)
- [API Key Signup](https://login.ndif.us/)

### Paper
- [NNsight and NDIF](https://arxiv.org/abs/2407.14561) - ICLR 2025

### Community
- [Discussion Forum](https://discuss.ndif.us/)
- [GitHub Issues](https://github.com/ndif-team/nnsight/issues)
