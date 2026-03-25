# nnsight API Reference

## LanguageModel

Main class for wrapping language models with intervention capabilities.

### Loading Models

```python
from nnsight import LanguageModel

# Basic loading
model = LanguageModel("openai-community/gpt2", device_map="auto")

# Larger models
model = LanguageModel("meta-llama/Llama-3.1-8B", device_map="auto")

# With custom tokenizer settings
model = LanguageModel(
    "gpt2",
    device_map="auto",
    torch_dtype=torch.float16,
)
```

### Model Attributes

```python
# Access underlying HuggingFace model
model._model

# Access tokenizer
model.tokenizer

# Model config
model._model.config
```

---

## Tracing Context

The `trace()` method creates a context for deferred execution.

### Basic Tracing

```python
with model.trace("Hello world") as tracer:
    # Operations are recorded, not executed immediately
    hidden = model.transformer.h[5].output[0].save()
    logits = model.output.save()

# After context, operations execute and saved values are available
print(hidden.shape)
```

### Tracing Parameters

```python
with model.trace(
    prompt,                    # Input text or tokens
    remote=False,              # Use NDIF remote execution
    validate=True,             # Validate tensor shapes
    scan=True,                 # Scan for shape info
) as tracer:
    ...
```

### Remote Execution

```python
# Same code works remotely
with model.trace("Hello", remote=True) as tracer:
    hidden = model.transformer.h[5].output[0].save()
```

---

## Proxy Objects

Inside tracing context, accessing modules returns Proxy objects.

### Accessing Values

```python
with model.trace("Hello") as tracer:
    # These are Proxy objects
    layer_output = model.transformer.h[5].output[0]
    attention = model.transformer.h[5].attn.output

    # Operations create new Proxies
    mean = layer_output.mean(dim=-1)
    normed = layer_output / layer_output.norm()
```

### Saving Values

```python
with model.trace("Hello") as tracer:
    # Must call .save() to access after context
    hidden = model.transformer.h[5].output[0].save()

# Now hidden contains actual tensor
print(hidden.shape)
```

### Modifying Values

```python
with model.trace("Hello") as tracer:
    # In-place modification
    model.transformer.h[5].output[0][:] = 0

    # Replace with computed value
    model.transformer.h[5].output[0][:] = some_tensor

    # Arithmetic modification
    model.transformer.h[5].output[0][:] *= 0.5
    model.transformer.h[5].output[0][:] += steering_vector
```

### Proxy Operations

```python
with model.trace("Hello") as tracer:
    h = model.transformer.h[5].output[0]

    # Indexing
    first_token = h[:, 0, :]
    last_token = h[:, -1, :]

    # PyTorch operations
    mean = h.mean(dim=-1)
    norm = h.norm()
    transposed = h.transpose(1, 2)

    # Save results
    mean.save()
```

---

## Module Access Patterns

### GPT-2 Structure

```python
with model.trace("Hello") as tracer:
    # Embeddings
    embed = model.transformer.wte.output.save()
    pos_embed = model.transformer.wpe.output.save()

    # Layer outputs
    layer_out = model.transformer.h[5].output[0].save()

    # Attention
    attn_out = model.transformer.h[5].attn.output.save()

    # MLP
    mlp_out = model.transformer.h[5].mlp.output.save()

    # Final output
    logits = model.output.save()
```

### LLaMA Structure

```python
with model.trace("Hello") as tracer:
    # Embeddings
    embed = model.model.embed_tokens.output.save()

    # Layer outputs
    layer_out = model.model.layers[10].output[0].save()

    # Attention
    attn_out = model.model.layers[10].self_attn.output.save()

    # MLP
    mlp_out = model.model.layers[10].mlp.output.save()

    # Final output
    logits = model.output.save()
```

### Finding Module Names

```python
# Print model structure
print(model._model)

# Or iterate
for name, module in model._model.named_modules():
    print(name)
```

---

## Multiple Prompts (invoke)

Process multiple prompts in a single trace.

### Basic Usage

```python
with model.trace() as tracer:
    with tracer.invoke("First prompt"):
        hidden1 = model.transformer.h[5].output[0].save()

    with tracer.invoke("Second prompt"):
        hidden2 = model.transformer.h[5].output[0].save()
```

### Cross-Prompt Intervention

```python
with model.trace() as tracer:
    # Get activations from first prompt
    with tracer.invoke("The cat sat on the"):
        cat_hidden = model.transformer.h[6].output[0].save()

    # Inject into second prompt
    with tracer.invoke("The dog ran through the"):
        model.transformer.h[6].output[0][:] = cat_hidden
        output = model.output.save()
```

---

## Generation

Generate text with interventions.

### Basic Generation

```python
with model.trace() as tracer:
    with tracer.invoke("Once upon a time"):
        # Intervention during generation
        model.transformer.h[5].output[0][:] *= 1.2

    output = model.generate(max_new_tokens=50)

print(model.tokenizer.decode(output[0]))
```

---

## Gradients

Access gradients for analysis (not supported with remote/vLLM).

```python
with model.trace("The quick brown fox") as tracer:
    hidden = model.transformer.h[5].output[0].save()
    hidden.retain_grad()

    logits = model.output
    target_token = model.tokenizer.encode(" jumps")[0]
    loss = -logits[0, -1, target_token]
    loss.backward()

# Access gradient
grad = hidden.grad
```

---

## NDIF Remote Execution

### Setup

```python
import os
os.environ["NDIF_API_KEY"] = "your_key"

# Or configure directly
from nnsight import CONFIG
CONFIG.set_default_api_key("your_key")
```

### Using Remote

```python
model = LanguageModel("meta-llama/Llama-3.1-70B")

with model.trace("Hello", remote=True) as tracer:
    hidden = model.model.layers[40].output[0].save()
    logits = model.output.save()

# Results returned from NDIF
print(hidden.shape)
```

### Sessions (Batching Requests)

```python
with model.session(remote=True) as session:
    with model.trace("First prompt"):
        h1 = model.model.layers[20].output[0].save()

    with model.trace("Second prompt"):
        h2 = model.model.layers[20].output[0].save()

# Both run in single NDIF request
```

---

## Utility Methods

### Early Stopping

```python
with model.trace("Hello") as tracer:
    hidden = model.transformer.h[5].output[0].save()
    tracer.stop()  # Don't run remaining layers
```

### Validation

```python
# Validate shapes before execution
with model.trace("Hello", validate=True) as tracer:
    hidden = model.transformer.h[5].output[0].save()
```

### Module Access Result

```python
with model.trace("Hello") as tracer:
    # Access result of a method call
    result = tracer.result
```

---

## Common Module Paths

| Model | Embeddings | Layers | Attention | MLP |
|-------|------------|--------|-----------|-----|
| GPT-2 | `transformer.wte` | `transformer.h[i]` | `transformer.h[i].attn` | `transformer.h[i].mlp` |
| LLaMA | `model.embed_tokens` | `model.layers[i]` | `model.layers[i].self_attn` | `model.layers[i].mlp` |
| Mistral | `model.embed_tokens` | `model.layers[i]` | `model.layers[i].self_attn` | `model.layers[i].mlp` |
