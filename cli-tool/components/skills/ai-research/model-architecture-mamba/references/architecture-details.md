# Mamba Architecture Details

## Selective State Space Mechanism

Mamba's core innovation is the **Selective SSM (S6)** layer that makes state space model parameters input-dependent.

### How S6 Works

**Traditional SSMs** (non-selective):
```python
# Fixed A, B, C matrices for all inputs
h(t) = A * h(t-1) + B * x(t)  # State update
y(t) = C * h(t)                # Output
```

**Mamba's Selective SSM**:
```python
# Input-dependent parameters
B(t) = Linear_B(x(t))  # Selection mechanism
C(t) = Linear_C(x(t))  # Output projection
Δ(t) = Linear_Δ(x(t))  # Discretization step

# Selective state update
h(t) = discretize(A, Δ(t)) * h(t-1) + Δ(t) * B(t) * x(t)
y(t) = C(t) * h(t)
```

### Key Advantages

**1. Content-based reasoning**:
- Can selectively remember or forget based on input
- Addresses discrete modality weakness of traditional SSMs
- Example: Remembers important tokens, forgets padding

**2. Input-dependent selection**:
```python
# Mamba decides per token what to remember
if is_important(x(t)):
    Δ(t) = large_value   # Keep in state
else:
    Δ(t) = small_value   # Forget quickly
```

**3. No attention required**:
- Replaces O(n²) attention with O(n) state updates
- State dimension is constant (typically 16)

## Model Configuration

### Core Parameters

```python
from mamba_ssm import Mamba

model = Mamba(
    d_model=256,      # Hidden dimension (256, 512, 768, 1024, 2048)
    d_state=16,       # SSM state dimension (fixed at 16 is optimal)
    d_conv=4,         # Local convolution width (4 is standard)
    expand=2,         # Expansion factor (1.5-2.0)
    dt_rank="auto",   # Rank of Δ projection (auto = d_model / 16)
    dt_min=0.001,     # Min Δ init (controls forgetting rate)
    dt_max=0.1,       # Max Δ init
    dt_init="random", # Δ initialization (random, constant)
    dt_scale=1.0,     # Δ scaling factor
    conv_bias=True,   # Use bias in convolution
    bias=False        # Use bias in linear projections
)
```

### Parameter Impact

**d_state** (SSM state dimension):
- Standard: 16 (optimal from ablations)
- Smaller (8): Faster but less capacity
- Larger (32, 64): Minimal improvement, 2× slower

**expand** (block expansion):
- Standard: 2.0
- Range: 1.5-2.0
- Controls inner dimension = expand * d_model

**d_conv** (convolution width):
- Standard: 4
- Local context window before SSM
- Helps with positional information

**dt_rank** (Δ projection rank):
- Auto: d_model / 16 (recommended)
- Controls Δ parameter efficiency
- Lower rank = more efficient but less expressive

## Mamba Block Structure

```python
# Mamba block (replaces Transformer block)
class MambaBlock(nn.Module):
    def __init__(self, d_model):
        self.norm = RMSNorm(d_model)
        self.mamba = Mamba(d_model, d_state=16, d_conv=4, expand=2)

    def forward(self, x):
        return x + self.mamba(self.norm(x))  # Residual

# Full model (stack of Mamba blocks)
model = nn.Sequential(
    Embedding(...),
    *[MambaBlock(d_model) for _ in range(n_layers)],
    RMSNorm(d_model),
    LMHead(...)
)
```

**Key differences from Transformers**:
- No multi-head attention (MHA)
- No feedforward network (FFN)
- Single Mamba layer per block
- 2× more layers than equivalent Transformer

## Hardware-Aware Implementation

### Parallel Algorithm

Mamba uses a **scan-based parallel algorithm** for training:

```python
# Parallel mode (training)
# GPU kernel fuses operations
y = parallel_scan(A, B, C, x)  # O(n log n) parallel

# Sequential mode (inference)
# Constant memory RNN-style
h = 0
for x_t in sequence:
    h = A*h + B*x_t
    y_t = C*h
```

### Memory Efficiency

**Training**:
- Recomputes activations in backward pass
- Similar to FlashAttention strategy
- Memory: O(batch_size * seq_len * d_model)

**Inference**:
- RNN-style sequential processing
- State size: O(d_model * d_state) = constant
- No KV cache needed (huge advantage!)

### CUDA Kernel Optimizations

```python
# Fused kernel operations
- Discretization (continuous → discrete A, B)
- SSM recurrence (parallel scan)
- Convolution (efficient 1D conv)
- All in single GPU kernel
```

## Layer Count Scaling

Mamba models use **2× layers** compared to Transformers:

| Model | d_model | n_layers | Params |
|-------|---------|----------|--------|
| Mamba-130M | 768 | 24 | 130M |
| Mamba-370M | 1024 | 48 | 370M |
| Mamba-790M | 1536 | 48 | 790M |
| Mamba-1.4B | 2048 | 48 | 1.4B |
| Mamba-2.8B | 2560 | 64 | 2.8B |

**Why 2× layers?**
- Mamba blocks are simpler (no MHA, no FFN)
- ~50% fewer parameters per layer
- Doubling layers matches compute budget

## Initialization Strategy

```python
# Δ (discretization step) initialization
dt_init_floor = 1e-4
dt = torch.exp(
    torch.rand(d_inner) * (math.log(dt_max) - math.log(dt_min))
    + math.log(dt_min)
).clamp(min=dt_init_floor)

# A (state transition) initialization
A = -torch.exp(torch.rand(d_inner, d_state))  # Negative for stability

# B, C (input/output) initialization
B = torch.randn(d_inner, d_state)
C = torch.randn(d_inner, d_state)
```

**Critical for stability**:
- A must be negative (exponential decay)
- Δ in range [dt_min, dt_max]
- Random initialization helps diversity

## Resources

- Paper: https://arxiv.org/abs/2312.00752 (Mamba-1)
- Paper: https://arxiv.org/abs/2405.21060 (Mamba-2)
- GitHub: https://github.com/state-spaces/mamba
- Models: https://huggingface.co/state-spaces
- CUDA kernels: https://github.com/state-spaces/mamba/tree/main/csrc
