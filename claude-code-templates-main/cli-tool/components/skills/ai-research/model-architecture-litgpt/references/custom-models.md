# Custom Models

Guide to implementing custom model architectures in LitGPT.

## Overview

LitGPT's clean, single-file implementations make it easy to create custom architectures. You can extend the base `GPT` class or create entirely new models.

**Use cases**:
- Implementing new research architectures
- Adapting models for specific domains
- Experimenting with attention mechanisms
- Adding custom layers or components

## Key Files and Classes

### Core Architecture (`litgpt/model.py`)

**Main classes**:
- `GPT`: Top-level model class
- `Block`: Transformer block (attention + MLP)
- `CausalSelfAttention`: Attention mechanism
- `MLP`: Feed-forward network
- `RMSNorm` / `LayerNorm`: Normalization layers

**Configuration** (`litgpt/config.py`):
- `Config`: Base configuration dataclass
- Model-specific configs: `LlamaConfig`, `MistralConfig`, `PhiConfig`, etc.

## Custom Architecture Workflow

### Step 1: Define Configuration

Create a `Config` dataclass with your model's hyperparameters:

```python
from dataclasses import dataclass
from litgpt.config import Config

@dataclass
class MyModelConfig(Config):
    """Configuration for my custom model."""
    # Standard parameters
    name: str = "my-model-7b"
    block_size: int = 4096
    vocab_size: int = 32000
    n_layer: int = 32
    n_head: int = 32
    n_embd: int = 4096

    # Custom parameters
    custom_param: float = 0.1
    use_custom_attention: bool = True

    # Optional: override defaults
    rope_base: int = 10000
    intermediate_size: int = 11008
```

### Step 2: Implement Custom Components

#### Option A: Custom Attention

```python
from litgpt.model import CausalSelfAttention
import torch
import torch.nn as nn

class CustomAttention(CausalSelfAttention):
    """Custom attention mechanism."""

    def __init__(self, config):
        super().__init__(config)
        # Add custom components
        self.custom_proj = nn.Linear(config.n_embd, config.n_embd)
        self.custom_param = config.custom_param

    def forward(self, x, mask=None, input_pos=None):
        B, T, C = x.size()

        # Standard Q, K, V projections
        q = self.attn(x)
        k = self.attn(x)
        v = self.attn(x)

        # Custom modification
        q = q + self.custom_proj(x) * self.custom_param

        # Rest of attention computation
        q = q.view(B, T, self.n_head, self.head_size)
        k = k.view(B, T, self.n_query_groups, self.head_size)
        v = v.view(B, T, self.n_query_groups, self.head_size)

        # Scaled dot-product attention
        y = self.scaled_dot_product_attention(q, k, v, mask=mask)

        y = y.reshape(B, T, C)
        return self.proj(y)
```

#### Option B: Custom MLP

```python
from litgpt.model import MLP

class CustomMLP(MLP):
    """Custom feed-forward network."""

    def __init__(self, config):
        super().__init__(config)
        # Add custom layers
        self.custom_layer = nn.Linear(config.intermediate_size, config.intermediate_size)

    def forward(self, x):
        x = self.fc_1(x)
        x = self.act(x)
        x = self.custom_layer(x)  # Custom modification
        x = self.fc_2(x)
        return x
```

#### Option C: Custom Block

```python
from litgpt.model import Block

class CustomBlock(Block):
    """Custom transformer block."""

    def __init__(self, config):
        super().__init__(config)
        # Replace attention or MLP
        self.attn = CustomAttention(config)
        # Or: self.mlp = CustomMLP(config)

        # Add custom components
        self.custom_norm = nn.LayerNorm(config.n_embd)

    def forward(self, x, input_pos=None, mask=None):
        # Custom forward pass
        h = self.norm_1(x)
        h = self.attn(h, mask=mask, input_pos=input_pos)
        x = x + h

        # Custom normalization
        x = x + self.custom_norm(x)

        x = x + self.mlp(self.norm_2(x))
        return x
```

### Step 3: Create Custom GPT Model

```python
from litgpt.model import GPT
import torch.nn as nn

class CustomGPT(GPT):
    """Custom GPT model."""

    def __init__(self, config: MyModelConfig):
        # Don't call super().__init__() - we reimplement
        nn.Module.__init__(self)
        self.config = config

        # Standard components
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
        self.transformer = nn.ModuleDict(
            dict(
                wte=nn.Embedding(config.vocab_size, config.n_embd),
                h=nn.ModuleList(CustomBlock(config) for _ in range(config.n_layer)),
                ln_f=nn.LayerNorm(config.n_embd),
            )
        )

        # Custom components
        if config.use_custom_attention:
            self.custom_embedding = nn.Linear(config.n_embd, config.n_embd)

        # Initialize weights
        self.apply(self._init_weights)

    def _init_weights(self, module):
        """Initialize weights (required)."""
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, input_pos=None):
        """Forward pass (must match base signature)."""
        B, T = idx.size()

        # Token embeddings
        x = self.transformer.wte(idx)

        # Custom embedding modification
        if self.config.use_custom_attention:
            x = x + self.custom_embedding(x)

        # Transformer blocks
        for block in self.transformer.h:
            x = block(x, input_pos=input_pos)

        # Final norm + LM head
        x = self.transformer.ln_f(x)
        return self.lm_head(x)
```

### Step 4: Register Configuration

Add your config to `litgpt/config.py`:

```python
# In litgpt/config.py
configs = [
    # ... existing configs ...

    # My custom model
    dict(
        name="my-model-7b",
        hf_config=dict(org="myorg", name="my-model-7b"),
        block_size=4096,
        vocab_size=32000,
        n_layer=32,
        n_head=32,
        n_embd=4096,
        custom_param=0.1,
    ),
]
```

### Step 5: Use Your Custom Model

```python
from litgpt.api import LLM
from my_model import CustomGPT, MyModelConfig

# Initialize
config = MyModelConfig()
model = CustomGPT(config)

# Wrap with LLM API
llm = LLM(model=model, tokenizer_dir="path/to/tokenizer")

# Generate
result = llm.generate("Once upon a time", max_new_tokens=100)
print(result)
```

## Real Example: Adapter Fine-tuning

LitGPT's `Adapter` implementation shows a complete custom architecture:

### Adapter Configuration

```python
@dataclass
class Config(BaseConfig):
    """Adds adapter-specific parameters."""
    adapter_prompt_length: int = 10
    adapter_start_layer: int = 2
```

### Adapter GPT Model

```python
class GPT(BaseModel):
    """GPT model with adapter layers."""

    def __init__(self, config: Config):
        nn.Module.__init__(self)
        self.config = config

        # Standard components
        self.lm_head = nn.Linear(config.n_embd, config.padded_vocab_size, bias=False)
        self.transformer = nn.ModuleDict(
            dict(
                wte=nn.Embedding(config.padded_vocab_size, config.n_embd),
                h=nn.ModuleList(Block(config, i) for i in range(config.n_layer)),
                ln_f=config.norm_class(config.n_embd, eps=config.norm_eps),
            )
        )

        # Adapter-specific: gating factor
        self.gating_factor = torch.nn.Parameter(torch.zeros(1))
```

### Adapter Block

```python
class Block(BaseBlock):
    """Transformer block with adapter."""

    def __init__(self, config: Config, block_idx: int):
        super().__init__()
        self.norm_1 = config.norm_class(config.n_embd, eps=config.norm_eps)
        self.attn = CausalSelfAttention(config, block_idx)
        self.norm_2 = config.norm_class(config.n_embd, eps=config.norm_eps)
        self.mlp = config.mlp_class(config)

        # Adapter: add prefix for certain layers
        self.adapter_wte = (
            nn.Embedding(config.adapter_prompt_length, config.n_embd)
            if block_idx >= config.adapter_start_layer
            else None
        )
```

### Adapter Attention

```python
class CausalSelfAttention(BaseCausalSelfAttention):
    """Attention with adapter prompts."""

    def forward(self, x: torch.Tensor, ...) -> torch.Tensor:
        B, T, C = x.size()

        # Add adapter prefix if enabled
        if self.adapter_wte is not None:
            adapter_prompts = self.adapter_wte(
                torch.arange(self.adapter_prompt_length, device=x.device)
            )
            adapter_prompts = adapter_prompts.unsqueeze(0).expand(B, -1, -1)
            x = torch.cat([adapter_prompts, x], dim=1)

        # Standard attention with gating
        q, k, v = self.attn(x).split(self.n_embd, dim=2)
        y = self.scaled_dot_product_attention(q, k, v, mask=mask)

        # Apply gating factor
        y = y * self.gating_factor

        return self.proj(y)
```

See full implementation: `litgpt/finetune/adapter.py`

## Real Example: AdapterV2

AdapterV2 shows custom linear layers:

### AdapterV2Linear

```python
class AdapterV2Linear(torch.nn.Module):
    """Linear layer with low-rank adapter."""

    def __init__(self, in_features, out_features, adapter_rank=8, **kwargs):
        super().__init__()
        self.linear = torch.nn.Linear(in_features, out_features, **kwargs)

        # Adapter: low-rank bottleneck
        self.adapter_down = torch.nn.Linear(in_features, adapter_rank, bias=False)
        self.adapter_up = torch.nn.Linear(adapter_rank, out_features, bias=False)

        # Initialize adapter to identity
        torch.nn.init.zeros_(self.adapter_up.weight)

    def forward(self, x):
        # Original linear transformation
        out = self.linear(x)

        # Add adapter contribution
        adapter_out = self.adapter_up(self.adapter_down(x))
        return out + adapter_out
```

See full implementation: `litgpt/finetune/adapter_v2.py`

## Custom Model Checklist

- [ ] Define `Config` dataclass with all hyperparameters
- [ ] Implement custom components (Attention, MLP, Block)
- [ ] Create custom `GPT` class
- [ ] Implement `_init_weights()` for proper initialization
- [ ] Implement `forward()` matching base signature
- [ ] Register configuration in `litgpt/config.py`
- [ ] Test with small model (100M params) first
- [ ] Verify training convergence
- [ ] Profile memory usage

## Testing Your Custom Model

### Unit Test

```python
import torch
from my_model import CustomGPT, MyModelConfig

def test_custom_model():
    """Test custom model forward pass."""
    config = MyModelConfig(
        n_layer=2,
        n_head=4,
        n_embd=128,
        vocab_size=1000,
        block_size=256,
    )

    model = CustomGPT(config)
    model.eval()

    # Test forward pass
    batch_size = 2
    seq_length = 16
    idx = torch.randint(0, config.vocab_size, (batch_size, seq_length))

    with torch.no_grad():
        logits = model(idx)

    assert logits.shape == (batch_size, seq_length, config.vocab_size)
    print("✓ Forward pass works")

if __name__ == "__main__":
    test_custom_model()
```

### Training Test

```python
from litgpt.api import LLM

def test_training():
    """Test custom model training."""
    config = MyModelConfig(n_layer=2, n_head=4, n_embd=128)
    model = CustomGPT(config)

    # Small dataset for testing
    data = [
        {"instruction": "Test", "input": "", "output": "OK"}
    ]

    # Should run without errors
    llm = LLM(model=model)
    # ... training code ...
    print("✓ Training works")
```

## Common Patterns

### Adding New Attention Mechanism

```python
class MyAttention(nn.Module):
    """Template for custom attention."""

    def __init__(self, config):
        super().__init__()
        self.n_head = config.n_head
        self.n_embd = config.n_embd
        self.head_size = self.n_embd // self.n_head

        # Q, K, V projections
        self.q_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.k_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.v_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)

        # Output projection
        self.out_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)

    def forward(self, x, mask=None):
        B, T, C = x.size()

        # Project Q, K, V
        q = self.q_proj(x).view(B, T, self.n_head, self.head_size)
        k = self.k_proj(x).view(B, T, self.n_head, self.head_size)
        v = self.v_proj(x).view(B, T, self.n_head, self.head_size)

        # Custom attention computation here
        # attn = custom_attention_function(q, k, v, mask)

        # Output projection
        out = self.out_proj(attn.reshape(B, T, C))
        return out
```

### Adding Mixture of Experts

```python
class MoELayer(nn.Module):
    """Mixture of Experts layer."""

    def __init__(self, config):
        super().__init__()
        self.num_experts = config.num_experts
        self.top_k = config.moe_top_k

        # Router
        self.router = nn.Linear(config.n_embd, self.num_experts)

        # Experts
        self.experts = nn.ModuleList([
            MLP(config) for _ in range(self.num_experts)
        ])

    def forward(self, x):
        B, T, C = x.size()

        # Route tokens to experts
        router_logits = self.router(x)  # (B, T, num_experts)
        router_probs = torch.softmax(router_logits, dim=-1)

        # Select top-k experts
        top_k_probs, top_k_indices = torch.topk(router_probs, self.top_k, dim=-1)

        # Process through selected experts
        output = torch.zeros_like(x)
        for i in range(self.top_k):
            expert_idx = top_k_indices[:, :, i]
            expert_prob = top_k_probs[:, :, i:i+1]

            # Route to expert
            for expert_id in range(self.num_experts):
                mask = (expert_idx == expert_id)
                if mask.any():
                    expert_out = self.experts[expert_id](x[mask])
                    output[mask] += expert_out * expert_prob[mask]

        return output
```

### Adding Positional Encoding

```python
class CustomPositionalEncoding(nn.Module):
    """Custom positional encoding."""

    def __init__(self, config):
        super().__init__()
        self.n_embd = config.n_embd
        self.register_buffer(
            "pos_encoding",
            self._create_encoding(config.block_size, config.n_embd)
        )

    def _create_encoding(self, max_len, d_model):
        """Create positional encoding matrix."""
        pos = torch.arange(max_len).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2) * -(torch.log(torch.tensor(10000.0)) / d_model))

        encoding = torch.zeros(max_len, d_model)
        encoding[:, 0::2] = torch.sin(pos * div)
        encoding[:, 1::2] = torch.cos(pos * div)
        return encoding

    def forward(self, x):
        """Add positional encoding."""
        return x + self.pos_encoding[:x.size(1), :]
```

## Debugging Tips

1. **Start small**: Test with 2 layers, 128 hidden size
2. **Check shapes**: Print tensor shapes at each step
3. **Verify gradients**: Ensure all parameters have gradients
4. **Compare to base**: Run same config with base `GPT` model
5. **Profile memory**: Use `torch.cuda.memory_summary()`

## References

- Base model: `litgpt/model.py`
- Configuration: `litgpt/config.py`
- Adapter example: `litgpt/finetune/adapter.py`
- AdapterV2 example: `litgpt/finetune/adapter_v2.py`
- LoRA example: `litgpt/finetune/lora.py`
