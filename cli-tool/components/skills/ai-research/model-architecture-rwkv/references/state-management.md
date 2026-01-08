# RWKV State Management

## Understanding RWKV State

Unlike Transformers with KV cache, RWKV maintains a **fixed-size recurrent state** that summarizes all previous context.

### State Components

```python
state = {
    'att_aa': torch.zeros(n_layers, d_model),  # Attention numerator accumulator
    'att_ab': torch.zeros(n_layers, d_model),  # Attention denominator accumulator
    'att_x_prev': torch.zeros(n_layers, d_model),  # Previous x for time-mixing
    'ffn_x_prev': torch.zeros(n_layers, d_model)   # Previous x for channel-mixing
}
```

**Total state size**: `4 × n_layers × d_model` parameters

| Model | Layers | d_model | State Size |
|-------|--------|---------|------------|
| RWKV-169M | 12 | 768 | 37 KB |
| RWKV-430M | 24 | 1024 | 98 KB |
| RWKV-1.5B | 24 | 2048 | 196 KB |
| RWKV-3B | 32 | 2560 | 327 KB |
| RWKV-7B | 32 | 4096 | 524 KB |
| RWKV-14B | 40 | 5120 | 819 KB |

**Constant memory** regardless of context length!

## State Initialization

### Zero State (Default)

```python
from rwkv.model import RWKV

model = RWKV(model='/path/to/RWKV-4-Pile-1B5', strategy='cuda fp16')

# Start with zero state (no context)
state = None
out, state = model.forward(tokens, state)
```

### Warm State (Preloaded Context)

```python
# Load context once
context = "The capital of France is Paris. The capital of Germany is Berlin."
context_tokens = tokenizer.encode(context)

# Process context to build state
state = None
for token in context_tokens:
    _, state = model.forward([token], state)

# Now use warm state for queries
query = " The capital of Italy is"
query_tokens = tokenizer.encode(query)
out, state = model.forward(query_tokens, state)
# Model "remembers" Paris and Berlin examples!
```

### Shared State (Multi-turn Conversations)

```python
# Conversation with persistent state
state = None

# Turn 1
user1 = "My name is Alice."
tokens1 = tokenizer.encode(user1)
_, state = model.forward(tokens1, state)

# Turn 2
user2 = "What is my name?"
tokens2 = tokenizer.encode(user2)
response, state = model.forward(tokens2, state)
# Response: "Alice" (state remembers!)
```

## State Update Rules

### Time-Mixing State Update

```python
# Before processing token t
att_aa_t = att_aa_{t-1}  # Previous numerator
att_ab_t = att_ab_{t-1}  # Previous denominator

# Compute WKV
wkv_t = (exp(u) * k_t * v_t + att_aa_t) / (exp(u) * k_t + att_ab_t)

# Update state for token t+1
w = -exp(time_decay)  # Decay factor
att_aa_{t+1} = exp(w) * att_aa_t + k_t * v_t
att_ab_{t+1} = exp(w) * att_ab_t + k_t
att_x_prev_{t+1} = x_t
```

**Effect of time_decay**:
- **w = -0.01** (small decay): State decays slowly → long memory
- **w = -5.0** (large decay): State decays quickly → short memory

### Channel-Mixing State Update

```python
# Simply store previous x for next token
ffn_x_prev_{t+1} = x_t
```

## State Serialization

### Save/Load State (PyTorch)

```python
import torch

# Save conversation state
state_dict = {
    'att_aa': state[0],
    'att_ab': state[1],
    'att_x_prev': state[2],
    'ffn_x_prev': state[3]
}
torch.save(state_dict, 'conversation_123.pt')

# Load state
loaded = torch.load('conversation_123.pt')
state = (loaded['att_aa'], loaded['att_ab'], loaded['att_x_prev'], loaded['ffn_x_prev'])

# Continue conversation
out, state = model.forward(new_tokens, state)
```

### State Compression (Optional)

```python
# FP16 state (half size)
state_fp16 = tuple(s.half() for s in state)
torch.save(state_fp16, 'state_compressed.pt')

# Restore
state = tuple(s.float() for s in torch.load('state_compressed.pt'))
```

## Multi-Session State Management

### Session State Store

```python
class StateManager:
    def __init__(self):
        self.sessions = {}  # session_id -> state

    def get_state(self, session_id):
        return self.sessions.get(session_id, None)

    def save_state(self, session_id, state):
        self.sessions[session_id] = state

    def clear_session(self, session_id):
        if session_id in self.sessions:
            del self.sessions[session_id]

# Usage
manager = StateManager()

# User 1 conversation
state1 = manager.get_state('user_1')
out1, state1 = model.forward(tokens1, state1)
manager.save_state('user_1', state1)

# User 2 conversation (independent state)
state2 = manager.get_state('user_2')
out2, state2 = model.forward(tokens2, state2)
manager.save_state('user_2', state2)
```

### State Expiration

```python
import time

class StateManagerWithExpiry:
    def __init__(self, expiry_seconds=3600):
        self.sessions = {}  # session_id -> (state, timestamp)
        self.expiry = expiry_seconds

    def get_state(self, session_id):
        if session_id in self.sessions:
            state, timestamp = self.sessions[session_id]
            if time.time() - timestamp < self.expiry:
                return state
            else:
                del self.sessions[session_id]  # Expired
        return None

    def save_state(self, session_id, state):
        self.sessions[session_id] = (state, time.time())
```

## State Interpolation

### Blending States

```python
# Average two states (e.g., merging conversations)
def blend_states(state1, state2, alpha=0.5):
    """Blend state1 and state2 with weight alpha."""
    return tuple(
        alpha * s1 + (1 - alpha) * s2
        for s1, s2 in zip(state1, state2)
    )

# Example: Blend Alice and Bob conversation contexts
state_blended = blend_states(state_alice, state_bob, alpha=0.7)
# 70% Alice context, 30% Bob context
```

### State Editing

```python
# Manually edit state (advanced)
# Example: Reduce long-term memory influence

def decay_state(state, decay_factor=0.5):
    """Reduce state magnitude (forget older context)."""
    att_aa, att_ab, att_x_prev, ffn_x_prev = state
    return (
        att_aa * decay_factor,
        att_ab * decay_factor,
        att_x_prev,  # Keep recent x
        ffn_x_prev   # Keep recent x
    )

# Usage
state = decay_state(state, decay_factor=0.3)  # Forget 70% of history
```

## Batch Inference with States

### Independent Batch States

```python
# Each sequence in batch has separate state
batch_size = 4
states = [None] * batch_size

for i, tokens in enumerate(batch_sequences):
    out, states[i] = model.forward(tokens, states[i])
```

### Shared Prefix Optimization

```python
# All sequences share common prefix (e.g., system prompt)
prefix = "You are a helpful assistant."
prefix_tokens = tokenizer.encode(prefix)

# Compute prefix state once
prefix_state = None
_, prefix_state = model.forward(prefix_tokens, None)

# Clone prefix state for each sequence
states = [prefix_state] * batch_size

# Process user queries (independent)
for i, user_query in enumerate(user_queries):
    tokens = tokenizer.encode(user_query)
    out, states[i] = model.forward(tokens, states[i])
```

## State Debugging

### Inspect State Magnitudes

```python
def inspect_state(state):
    """Print state statistics for debugging."""
    att_aa, att_ab, att_x_prev, ffn_x_prev = state

    print("State magnitudes:")
    print(f"  att_aa: mean={att_aa.abs().mean():.4f}, max={att_aa.abs().max():.4f}")
    print(f"  att_ab: mean={att_ab.abs().mean():.4f}, max={att_ab.abs().max():.4f}")
    print(f"  att_x_prev: mean={att_x_prev.abs().mean():.4f}, max={att_x_prev.abs().max():.4f}")
    print(f"  ffn_x_prev: mean={ffn_x_prev.abs().mean():.4f}, max={ffn_x_prev.abs().max():.4f}")

# Usage
inspect_state(state)
```

**Healthy ranges**:
- `att_aa`, `att_ab`: 0.1 - 10.0 (if much larger, may overflow)
- `att_x_prev`, `ffn_x_prev`: Similar to input embedding magnitude

### State Divergence Check

```python
def state_distance(state1, state2):
    """Compute L2 distance between two states."""
    return sum(
        torch.dist(s1, s2).item()
        for s1, s2 in zip(state1, state2)
    )

# Example: Check if states diverged
distance = state_distance(state_alice, state_bob)
print(f"State distance: {distance:.2f}")
# Large distance → very different contexts
```

## Numerical Stability Considerations

### Overflow Prevention

```python
# Issue: att_aa, att_ab can grow unbounded
# If att_aa > 1e10, numerical precision issues

# Solution 1: Periodic normalization
if att_aa.abs().max() > 1e6:
    scale = att_aa.abs().max()
    att_aa = att_aa / scale
    att_ab = att_ab / scale
```

### Underflow Prevention

```python
# Issue: With large negative time_decay, state can underflow to 0

# Solution: Clip time_decay
time_decay = torch.clamp(time_decay, min=-8.0, max=-0.1)
# Ensures state doesn't decay too fast
```

## State vs KV Cache Comparison

### Memory Usage (8K context)

| Model Type | Model Size | KV Cache Size | RWKV State Size |
|------------|------------|---------------|-----------------|
| Transformer | 1.3B | 4.1 GB | - |
| **RWKV** | **1.5B** | **-** | **196 KB** |
| Transformer | 7B | 21.3 GB | - |
| **RWKV** | **7B** | **-** | **524 KB** |

**RWKV advantage**: 10,000× smaller than KV cache!

### Information Retention

**KV Cache (Transformer)**:
- Perfect: Stores all previous keys and values
- Retrieval: Exact attention to any previous token
- Cost: O(n) memory growth

**RWKV State**:
- Lossy: Compressed representation of history
- Retrieval: Weighted blend of previous tokens (decay-based)
- Cost: O(1) constant memory

**Trade-off**: RWKV sacrifices perfect recall for constant memory

## Resources

- State management examples: https://github.com/BlinkDL/ChatRWKV
- Wiki: https://wiki.rwkv.com/state-management
- Discord: https://discord.gg/bDSBUMeFpc (RWKV community)
