# RWKV Architecture Details

## Time-Mixing and Channel-Mixing Blocks

RWKV alternates between **Time-Mixing** (sequence processing) and **Channel-Mixing** (feature processing) blocks.

### Time-Mixing Block (WKV Operation)

The core innovation is the **WKV (Weighted Key-Value)** mechanism:

```python
# Traditional Attention (O(n²))
scores = Q @ K.T / sqrt(d)  # n×n matrix
attention = softmax(scores)
output = attention @ V

# RWKV Time-Mixing (O(n))
# Compute WKV in linear time using recurrence
for t in range(T):
    wkv[t] = (exp(w) * k[t] @ v[t] + a[t] * aa[t]) / (exp(w) * k[t] + a[t] * ab[t])
    aa[t+1] = exp(w) * k[t] @ v[t] + exp(-u) * aa[t]
    ab[t+1] = exp(w) * k[t] + exp(-u) * ab[t]
```

**Full Time-Mixing implementation**:

```python
class RWKV_TimeMix(nn.Module):
    def __init__(self, d_model, n_layer):
        super().__init__()
        self.d_model = d_model

        # Linear projections
        self.key = nn.Linear(d_model, d_model, bias=False)
        self.value = nn.Linear(d_model, d_model, bias=False)
        self.receptance = nn.Linear(d_model, d_model, bias=False)
        self.output = nn.Linear(d_model, d_model, bias=False)

        # Time-mixing parameters
        self.time_mix_k = nn.Parameter(torch.ones(1, 1, d_model))
        self.time_mix_v = nn.Parameter(torch.ones(1, 1, d_model))
        self.time_mix_r = nn.Parameter(torch.ones(1, 1, d_model))

        # Time-decay and bonus
        self.time_decay = nn.Parameter(torch.ones(d_model))  # w
        self.time_first = nn.Parameter(torch.ones(d_model))  # u

    def forward(self, x, state=None):
        B, T, C = x.shape

        # Time-shift mixing (interpolate with previous token)
        if state is None:
            state = torch.zeros(B, C, 3, device=x.device)  # [aa, ab, x_prev]

        x_prev = state[:, :, 2].unsqueeze(1)  # Previous x
        xk = x * self.time_mix_k + x_prev * (1 - self.time_mix_k)
        xv = x * self.time_mix_v + x_prev * (1 - self.time_mix_v)
        xr = x * self.time_mix_r + x_prev * (1 - self.time_mix_r)

        # Compute k, v, r
        k = self.key(xk)
        v = self.value(xv)
        r = self.receptance(xr)

        # WKV computation (parallelizable or sequential)
        wkv = self.wkv(k, v, state[:, :, :2])

        # Apply receptance gate and output projection
        out = self.output(torch.sigmoid(r) * wkv)

        # Update state
        new_state = torch.stack([state_aa, state_ab, x[:, -1]], dim=2)

        return out, new_state

    def wkv(self, k, v, state):
        # Parallel implementation (training)
        # Sequential implementation (inference) - see below
        ...
```

### WKV Parallel Algorithm (Training)

```python
def wkv_forward(w, u, k, v):
    """
    Parallel WKV computation for training.
    w: time_decay (d_model,)
    u: time_first (d_model,)
    k: keys (batch, seq_len, d_model)
    v: values (batch, seq_len, d_model)
    """
    B, T, C = k.shape

    # Compute cumulative sums with exponential decay
    # This is the key to O(n) parallel computation
    w = -torch.exp(w)  # Negative for decay

    # Associative scan operation
    wkv = torch.zeros(B, T, C, device=k.device)
    state = torch.zeros(B, C, device=k.device)

    for t in range(T):
        kv = k[:, t] * v[:, t]
        wkv[:, t] = (u * kv + state) / (u * k[:, t] + torch.exp(state_count))
        state = w * state + kv

    return wkv
```

### WKV Sequential Algorithm (Inference)

```python
def wkv_inference(w, u, k, v, state):
    """
    Sequential WKV for O(1) per-token inference.
    state: (aa, ab) from previous step
    """
    w = -torch.exp(w)  # time_decay
    u = torch.exp(u)   # time_first

    # Unpack state
    aa, ab = state  # aa = numerator, ab = denominator

    # Compute WKV for current token
    kv = k * v
    wkv = (u * kv + aa) / (u * k + ab)

    # Update state for next token
    new_aa = w * aa + kv
    new_ab = w * ab + k

    return wkv, (new_aa, new_ab)
```

### Channel-Mixing Block

Replaces Transformer FFN with time-shifted variant:

```python
class RWKV_ChannelMix(nn.Module):
    def __init__(self, d_model, hidden_ratio=4):
        super().__init__()
        self.d_model = d_model
        self.hidden = d_model * hidden_ratio

        # Time-mixing for channel
        self.time_mix_k = nn.Parameter(torch.ones(1, 1, d_model))
        self.time_mix_r = nn.Parameter(torch.ones(1, 1, d_model))

        # FFN layers
        self.key = nn.Linear(d_model, self.hidden, bias=False)
        self.receptance = nn.Linear(d_model, d_model, bias=False)
        self.value = nn.Linear(self.hidden, d_model, bias=False)

    def forward(self, x, x_prev):
        # Time-shift mixing
        xk = x * self.time_mix_k + x_prev * (1 - self.time_mix_k)
        xr = x * self.time_mix_r + x_prev * (1 - self.time_mix_r)

        # Channel mixing
        k = self.key(xk)
        k = torch.square(torch.relu(k))  # Squared ReLU activation
        kv = self.value(k)

        # Receptance gate
        r = torch.sigmoid(self.receptance(xr))

        return r * kv
```

## RWKV Block Structure

```python
class RWKV_Block(nn.Module):
    def __init__(self, d_model, n_layer):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.ln2 = nn.LayerNorm(d_model)
        self.att = RWKV_TimeMix(d_model, n_layer)
        self.ffn = RWKV_ChannelMix(d_model)

    def forward(self, x, state):
        # Time-mixing with residual
        att_out, new_state = self.att(self.ln1(x), state)
        x = x + att_out

        # Channel-mixing with residual
        ffn_out = self.ffn(self.ln2(x), state[:, :, 2])  # Use x_prev from state
        x = x + ffn_out

        return x, new_state

# Full RWKV model
model = nn.Sequential(
    Embedding(...),
    *[RWKV_Block(d_model, i) for i in range(n_layers)],
    LayerNorm(d_model),
    LMHead(...)
)
```

## Time-Decay Mechanism

The **time_decay** parameter `w` controls how fast information decays:

```python
# Initialization (RWKV-4)
time_decay = torch.ones(n_layers, d_model)
for i in range(n_layers):
    for j in range(d_model):
        # Logarithmic spacing
        ratio = (i + 1) / n_layers
        time_decay[i, j] = -5.0 + 8.0 * ratio + 0.3 * (j / d_model)

# Effect on memory
w = -exp(time_decay)  # Range: [-exp(-5), -exp(3)] ≈ [-0.007, -20]
# Smaller w = slower decay = longer memory
# Larger w = faster decay = shorter memory
```

**Layer-wise decay pattern**:
- Early layers (shallow): Fast decay, capture local patterns
- Later layers (deep): Slow decay, capture long-range dependencies

## Receptance Gate

The **receptance** mechanism controls information flow:

```python
r = sigmoid(receptance(x))  # Range [0, 1]
output = r * wkv  # Gate the WKV output

# High receptance (r ≈ 1): Pass information through
# Low receptance (r ≈ 0): Block information
```

**Purpose**: Similar to LSTM forget gate, but learned per-token

## RWKV-4 vs RWKV-5 vs RWKV-6 vs RWKV-7

### RWKV-4 (Original)
```python
# Time-shift with previous token
xx = x * time_mix + x_prev * (1 - time_mix)
k, v, r = key(xx), value(xx), receptance(xx)
```

### RWKV-5 (2023)
```python
# Separate time-mix for k, v, r
xk = x * time_mix_k + x_prev * (1 - time_mix_k)
xv = x * time_mix_v + x_prev * (1 - time_mix_v)
xr = x * time_mix_r + x_prev * (1 - time_mix_r)
k, v, r = key(xk), value(xk), receptance(xr)
```

### RWKV-6 (2024)
- Added **multi-head time-mixing** (like multi-head attention)
- Separate time-decay per head
- Improved stability for large models

```python
# Per-head processing
for h in range(n_heads):
    k_h = key[h](x)  # Separate projection per head
    w_h = time_decay[h]  # Separate decay per head
    wkv_h = wkv(k_h, v_h, w_h)
output = concat(wkv_0, wkv_1, ..., wkv_H)
```

### RWKV-7 (March 2025)
- **Multimodal support** (vision + language)
- Improved numerical stability
- Better scaling to 14B+ parameters

## Numerical Stability

### Issue: Exponential Overflow

```python
# Problem: exp(wkv) can overflow
wkv = exp(u * kv) / exp(u * k)  # Can overflow!
```

### Solution: Log-space Computation

```python
# Stable implementation
log_wkv_num = u + log(kv) + log(aa)
log_wkv_den = u + log(k) + log(ab)
wkv = exp(log_wkv_num - log_wkv_den)  # Numerically stable
```

### Gradient Clipping

```python
# Recommended for training stability
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```

## State Management

### State Shape

```python
# For batch inference
state = torch.zeros(
    batch_size,
    n_layers,
    4,  # (att_aa, att_ab, att_x_prev, ffn_x_prev)
    d_model
)
```

### State Initialization

```python
# Zero initialization (standard)
state = None  # Model creates zero state

# Warm state (from previous conversation)
_, state = model.forward(previous_context, None)
# Use `state` for next turn
```

### State Serialization

```python
# Save conversation state
torch.save(state, 'conversation_state.pt')

# Resume conversation
state = torch.load('conversation_state.pt')
out, state = model.forward(new_tokens, state)
```

## Resources

- Paper (RWKV): https://arxiv.org/abs/2305.13048 (May 2023)
- Paper (RWKV-7): https://arxiv.org/abs/2503.14456 (March 2025)
- GitHub: https://github.com/BlinkDL/RWKV-LM
- Math derivation: https://wiki.rwkv.com/
- CUDA kernels: https://github.com/BlinkDL/RWKV-CUDA
