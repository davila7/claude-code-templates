# TransformerLens API Reference

## HookedTransformer

The core class for mechanistic interpretability, wrapping transformer models with hooks on every activation.

### Loading Models

```python
from transformer_lens import HookedTransformer

# Basic loading
model = HookedTransformer.from_pretrained("gpt2-small")

# With specific device/dtype
model = HookedTransformer.from_pretrained(
    "gpt2-medium",
    device="cuda",
    dtype=torch.float16
)

# Gated models (LLaMA, Mistral)
import os
os.environ["HF_TOKEN"] = "your_token"
model = HookedTransformer.from_pretrained("meta-llama/Llama-2-7b-hf")
```

### from_pretrained() Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_name` | str | required | Model name from OFFICIAL_MODEL_NAMES |
| `fold_ln` | bool | True | Fold LayerNorm weights into subsequent layers |
| `center_writing_weights` | bool | True | Center residual stream writer means |
| `center_unembed` | bool | True | Center unembedding weights |
| `dtype` | torch.dtype | None | Model precision |
| `device` | str | None | Target device |
| `n_devices` | int | 1 | Number of devices for model parallelism |

### Weight Matrices

| Property | Shape | Description |
|----------|-------|-------------|
| `W_E` | [d_vocab, d_model] | Token embedding matrix |
| `W_U` | [d_model, d_vocab] | Unembedding matrix |
| `W_pos` | [n_ctx, d_model] | Positional embedding |
| `W_Q` | [n_layers, n_heads, d_model, d_head] | Query weights |
| `W_K` | [n_layers, n_heads, d_model, d_head] | Key weights |
| `W_V` | [n_layers, n_heads, d_model, d_head] | Value weights |
| `W_O` | [n_layers, n_heads, d_head, d_model] | Output weights |
| `W_in` | [n_layers, d_model, d_mlp] | MLP input weights |
| `W_out` | [n_layers, d_mlp, d_model] | MLP output weights |

### Core Methods

#### forward()

```python
logits = model(tokens)
logits = model(tokens, return_type="logits")
loss = model(tokens, return_type="loss")
logits, loss = model(tokens, return_type="both")
```

Parameters:
- `input`: Token tensor or string
- `return_type`: "logits", "loss", "both", or None
- `prepend_bos`: Whether to prepend BOS token
- `start_at_layer`: Start execution from specific layer
- `stop_at_layer`: Stop execution at specific layer

#### run_with_cache()

```python
logits, cache = model.run_with_cache(tokens)

# Selective caching (saves memory)
logits, cache = model.run_with_cache(
    tokens,
    names_filter=lambda name: "resid_post" in name
)

# Cache on CPU
logits, cache = model.run_with_cache(tokens, device="cpu")
```

#### run_with_hooks()

```python
def my_hook(activation, hook):
    # Modify activation
    activation[:, :, 0] = 0
    return activation

logits = model.run_with_hooks(
    tokens,
    fwd_hooks=[("blocks.5.hook_resid_post", my_hook)]
)
```

#### generate()

```python
output = model.generate(
    tokens,
    max_new_tokens=50,
    temperature=0.7,
    top_k=40,
    top_p=0.9,
    freq_penalty=1.0,
    use_past_kv_cache=True
)
```

### Tokenization Methods

```python
# String to tokens
tokens = model.to_tokens("Hello world")  # [1, seq_len]
tokens = model.to_tokens("Hello", prepend_bos=False)

# Tokens to string
text = model.to_string(tokens)

# Get string tokens (for debugging)
str_tokens = model.to_str_tokens("Hello world")
# ['<|endoftext|>', 'Hello', ' world']

# Single token validation
token_id = model.to_single_token(" Paris")  # Returns int or raises error
```

### Hook Management

```python
# Clear all hooks
model.reset_hooks()

# Add permanent hook
model.add_hook("blocks.0.hook_resid_post", my_hook)

# Remove specific hook
model.remove_hook("blocks.0.hook_resid_post")
```

---

## ActivationCache

Stores and provides access to all activations from a forward pass.

### Accessing Activations

```python
logits, cache = model.run_with_cache(tokens)

# By name and layer
residual = cache["resid_post", 5]
attention = cache["pattern", 3]
mlp_out = cache["mlp_out", 7]

# Full name string
residual = cache["blocks.5.hook_resid_post"]
```

### Cache Keys

| Key Pattern | Shape | Description |
|-------------|-------|-------------|
| `hook_embed` | [batch, pos, d_model] | Token embeddings |
| `hook_pos_embed` | [batch, pos, d_model] | Positional embeddings |
| `resid_pre, layer` | [batch, pos, d_model] | Residual before attention |
| `resid_mid, layer` | [batch, pos, d_model] | Residual after attention |
| `resid_post, layer` | [batch, pos, d_model] | Residual after MLP |
| `attn_out, layer` | [batch, pos, d_model] | Attention output |
| `mlp_out, layer` | [batch, pos, d_model] | MLP output |
| `pattern, layer` | [batch, head, q_pos, k_pos] | Attention pattern (post-softmax) |
| `attn_scores, layer` | [batch, head, q_pos, k_pos] | Attention scores (pre-softmax) |
| `q, layer` | [batch, pos, head, d_head] | Query vectors |
| `k, layer` | [batch, pos, head, d_head] | Key vectors |
| `v, layer` | [batch, pos, head, d_head] | Value vectors |
| `z, layer` | [batch, pos, head, d_head] | Attention output per head |

### Analysis Methods

#### decompose_resid()

Decomposes residual stream into component contributions:

```python
components, labels = cache.decompose_resid(
    layer=5,
    return_labels=True,
    mode="attn"  # or "mlp" or "full"
)
```

#### accumulated_resid()

Get accumulated residual at each layer (for Logit Lens):

```python
accumulated = cache.accumulated_resid(
    layer=None,  # All layers
    incl_mid=False,
    apply_ln=True  # Apply final LayerNorm
)
```

#### logit_attrs()

Calculate logit attribution for components:

```python
attrs = cache.logit_attrs(
    residual_stack,
    tokens=target_tokens,
    incorrect_tokens=incorrect_tokens
)
```

#### stack_head_results()

Stack attention head outputs:

```python
head_results = cache.stack_head_results(
    layer=-1,  # All layers
    pos_slice=None  # All positions
)
# Shape: [n_layers, n_heads, batch, pos, d_model]
```

### Utility Methods

```python
# Move cache to device
cache = cache.to("cpu")

# Remove batch dimension (for batch_size=1)
cache = cache.remove_batch_dim()

# Get all keys
keys = cache.keys()

# Iterate
for name, activation in cache.items():
    print(name, activation.shape)
```

---

## HookPoint

The fundamental hook mechanism wrapping every activation.

### Hook Function Signature

```python
def hook_fn(activation: torch.Tensor, hook: HookPoint) -> torch.Tensor:
    """
    Args:
        activation: Current activation value
        hook: The HookPoint object (has .name attribute)

    Returns:
        Modified activation (or None to keep original)
    """
    # Modify activation
    return activation
```

### Common Hook Patterns

```python
# Zero ablation
def zero_hook(act, hook):
    act[:, :, :] = 0
    return act

# Mean ablation
def mean_hook(act, hook):
    act[:, :, :] = act.mean(dim=0, keepdim=True)
    return act

# Patch from cache
def patch_hook(act, hook):
    act[:, 5, :] = clean_cache[hook.name][:, 5, :]
    return act

# Add steering vector
def steer_hook(act, hook):
    act += 0.5 * steering_vector
    return act
```

---

## Utility Functions

### patching module

```python
from transformer_lens import patching

# Generic activation patching
results = patching.generic_activation_patch(
    model=model,
    corrupted_tokens=corrupted,
    clean_cache=clean_cache,
    patching_metric=metric_fn,
    patch_setter=patch_fn,
    activation_name="resid_post",
    index_axis_names=("layer", "pos")
)
```

### FactoredMatrix

Efficient operations on factored weight matrices:

```python
from transformer_lens import FactoredMatrix

# QK circuit
QK = FactoredMatrix(model.W_Q[layer], model.W_K[layer].T)

# OV circuit
OV = FactoredMatrix(model.W_V[layer], model.W_O[layer])

# Get full matrix
full = QK.AB

# SVD decomposition
U, S, V = QK.svd()
```

---

## Configuration

### HookedTransformerConfig

Key configuration attributes:

| Attribute | Description |
|-----------|-------------|
| `n_layers` | Number of transformer layers |
| `n_heads` | Number of attention heads |
| `d_model` | Model dimension |
| `d_head` | Head dimension |
| `d_mlp` | MLP hidden dimension |
| `d_vocab` | Vocabulary size |
| `n_ctx` | Maximum context length |
| `act_fn` | Activation function name |
| `normalization_type` | "LN" or "LNPre" |

Access via:
```python
model.cfg.n_layers
model.cfg.d_model
```
