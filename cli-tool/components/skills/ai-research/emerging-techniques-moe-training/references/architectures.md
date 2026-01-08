# MoE Model Architectures

Comprehensive guide to different Mixture of Experts architectures and their design patterns.

## Table of Contents
- Mixtral 8x7B (Mistral AI)
- DeepSeek-V3 (DeepSeek AI)
- Switch Transformers (Google)
- GLaM (Google)
- Comparison Table

## Mixtral 8x7B (Mistral AI - 2024)

### Architecture Overview

**Parameters:**
- Total: 47B parameters
- Active per token: 13B (2 experts out of 8)
- Each expert: ~7B parameters

**Key Features:**
- **Top-2 routing**: Each token routed to 2 experts
- **8 experts per layer**: Sparse activation
- **SMoE architecture**: Sparse Mixture of Experts
- **Grouped-Query Attention (GQA)**: Efficient attention mechanism

### Layer Structure

```python
# Mixtral Transformer Block
class MixtralDecoderLayer(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.hidden_size = config.hidden_size

        # Self-attention
        self.self_attn = MixtralAttention(config)

        # MoE Feed-Forward
        self.block_sparse_moe = MixtralSparseMoeBlock(config)

        # Layer norms
        self.input_layernorm = MixtralRMSNorm(config.hidden_size)
        self.post_attention_layernorm = MixtralRMSNorm(config.hidden_size)

    def forward(self, hidden_states, attention_mask=None):
        residual = hidden_states

        # Self-attention
        hidden_states = self.input_layernorm(hidden_states)
        hidden_states = self.self_attn(hidden_states, attention_mask)
        hidden_states = residual + hidden_states

        # MoE FFN
        residual = hidden_states
        hidden_states = self.post_attention_layernorm(hidden_states)
        hidden_states = self.block_sparse_moe(hidden_states)
        hidden_states = residual + hidden_states

        return hidden_states
```

### Sparse MoE Block

```python
class MixtralSparseMoeBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.hidden_dim = config.hidden_size
        self.ffn_dim = config.intermediate_size
        self.num_experts = config.num_local_experts  # 8
        self.top_k = config.num_experts_per_tok       # 2

        # Router (gating network)
        self.gate = nn.Linear(self.hidden_dim, self.num_experts, bias=False)

        # 8 expert FFNs
        self.experts = nn.ModuleList([
            MixtralBlockSparseTop2MLP(config)
            for _ in range(self.num_experts)
        ])

    def forward(self, hidden_states):
        batch_size, sequence_length, hidden_dim = hidden_states.shape
        hidden_states = hidden_states.view(-1, hidden_dim)

        # Router logits (batch * seq_len, num_experts)
        router_logits = self.gate(hidden_states)

        # Top-2 routing
        routing_weights = F.softmax(router_logits, dim=1)
        routing_weights, selected_experts = torch.topk(
            routing_weights, self.top_k, dim=-1
        )

        # Normalize top-2 weights to sum to 1
        routing_weights /= routing_weights.sum(dim=-1, keepdim=True)

        # Route to experts
        final_hidden_states = torch.zeros(
            (batch_size * sequence_length, hidden_dim),
            dtype=hidden_states.dtype,
            device=hidden_states.device
        )

        # Process each expert
        for expert_idx in range(self.num_experts):
            expert_layer = self.experts[expert_idx]
            idx, top_x = torch.where(selected_experts == expert_idx)

            if idx.shape[0] == 0:
                continue

            # Tokens routed to this expert
            top_x_list = top_x.tolist()
            idx_list = idx.tolist()

            # Current expert input
            current_state = hidden_states[None, idx_list].reshape(-1, hidden_dim)
            current_hidden_states = expert_layer(current_state)

            # Weight by routing scores
            current_hidden_states *= routing_weights[idx_list, top_x_list, None]

            # Accumulate
            final_hidden_states.index_add_(0, idx, current_hidden_states.to(hidden_states.dtype))

        final_hidden_states = final_hidden_states.reshape(batch_size, sequence_length, hidden_dim)
        return final_hidden_states
```

### Expert FFN

```python
class MixtralBlockSparseTop2MLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.ffn_dim = config.intermediate_size
        self.hidden_dim = config.hidden_size

        self.w1 = nn.Linear(self.hidden_dim, self.ffn_dim, bias=False)
        self.w2 = nn.Linear(self.ffn_dim, self.hidden_dim, bias=False)
        self.w3 = nn.Linear(self.hidden_dim, self.ffn_dim, bias=False)

        self.act_fn = nn.SiLU()

    def forward(self, hidden_states):
        # SwiGLU activation
        current_hidden_states = self.act_fn(self.w1(hidden_states)) * self.w3(hidden_states)
        current_hidden_states = self.w2(current_hidden_states)
        return current_hidden_states
```

### Configuration

```json
{
  "architectures": ["MixtralForCausalLM"],
  "hidden_size": 4096,
  "intermediate_size": 14336,
  "num_attention_heads": 32,
  "num_hidden_layers": 32,
  "num_key_value_heads": 8,
  "num_local_experts": 8,
  "num_experts_per_tok": 2,
  "vocab_size": 32000,
  "max_position_embeddings": 32768,
  "rms_norm_eps": 1e-5,
  "rope_theta": 1000000.0
}
```

## DeepSeek-V3 (DeepSeek AI - December 2024)

### Architecture Overview

**Parameters:**
- Total: 671B parameters
- Active per token: 37B
- Model size: Massive-scale MoE

**Key Innovations:**
1. **DeepSeekMoE**: Finer-grained experts with shared experts
2. **Multi-Head Latent Attention (MLA)**: Reduced KV cache memory
3. **Auxiliary-Loss-Free Load Balancing**: No auxiliary loss needed
4. **Multi-Token Prediction (MTP)**: Predict multiple tokens simultaneously

### DeepSeekMoE Architecture

```python
class DeepSeekMoE(nn.Module):
    """Finer-grained experts with shared experts."""

    def __init__(self, config):
        super().__init__()
        self.num_experts = config.num_experts  # More fine-grained
        self.num_shared_experts = config.num_shared_experts  # e.g., 2
        self.num_routed_experts = self.num_experts - self.num_shared_experts
        self.top_k = config.top_k

        # Shared experts (always activated)
        self.shared_experts = nn.ModuleList([
            FFN(config) for _ in range(self.num_shared_experts)
        ])

        # Routed experts (top-k activated)
        self.routed_experts = nn.ModuleList([
            FFN(config) for _ in range(self.num_routed_experts)
        ])

        # Router for routed experts only
        self.gate = nn.Linear(config.hidden_size, self.num_routed_experts, bias=False)

    def forward(self, x):
        # Shared experts (always computed)
        shared_output = sum(expert(x) for expert in self.shared_experts)

        # Router for top-k routed experts
        router_logits = self.gate(x)
        routing_weights = F.softmax(router_logits, dim=-1)
        routing_weights, selected_experts = torch.topk(routing_weights, self.top_k, dim=-1)
        routing_weights /= routing_weights.sum(dim=-1, keepdim=True)

        # Routed experts output
        routed_output = torch.zeros_like(x)
        for i in range(self.top_k):
            expert_idx = selected_experts[:, :, i]
            expert_weight = routing_weights[:, :, i:i+1]
            for eidx in range(self.num_routed_experts):
                mask = (expert_idx == eidx)
                if mask.any():
                    routed_output[mask] += expert_weight[mask] * self.routed_experts[eidx](x[mask])

        # Combine shared and routed
        return shared_output + routed_output
```

### Multi-Head Latent Attention (MLA)

```python
class MultiHeadLatentAttention(nn.Module):
    """Compress KV cache with latent vectors."""

    def __init__(self, config):
        super().__init__()
        self.hidden_size = config.hidden_size
        self.num_heads = config.num_attention_heads
        self.head_dim = self.hidden_size // self.num_heads
        self.latent_dim = config.latent_dim  # Compressed dimension

        # Project to latent space
        self.q_proj = nn.Linear(self.hidden_size, self.num_heads * self.head_dim)
        self.kv_proj = nn.Linear(self.hidden_size, self.latent_dim)  # Compress!

        # Decompress for attention
        self.k_decompress = nn.Linear(self.latent_dim, self.num_heads * self.head_dim)
        self.v_decompress = nn.Linear(self.latent_dim, self.num_heads * self.head_dim)

        self.o_proj = nn.Linear(self.num_heads * self.head_dim, self.hidden_size)

    def forward(self, hidden_states, past_key_value=None):
        batch_size, seq_len, _ = hidden_states.shape

        # Query
        q = self.q_proj(hidden_states)
        q = q.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        # Compress KV to latent
        kv_latent = self.kv_proj(hidden_states)  # (batch, seq, latent_dim)

        # Store compressed KV in cache (huge memory savings!)
        if past_key_value is not None:
            kv_latent = torch.cat([past_key_value, kv_latent], dim=1)

        # Decompress for attention
        k = self.k_decompress(kv_latent)
        v = self.v_decompress(kv_latent)
        k = k.view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)

        # Attention
        attn_output = F.scaled_dot_product_attention(q, k, v)
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.view(batch_size, seq_len, -1)

        return self.o_proj(attn_output), kv_latent
```

### Auxiliary-Loss-Free Load Balancing

```python
# DeepSeek-V3 uses bias terms instead of auxiliary loss
class DeepSeekRouter(nn.Module):
    def __init__(self, hidden_size, num_experts):
        super().__init__()
        self.weight = nn.Parameter(torch.empty(num_experts, hidden_size))
        self.bias = nn.Parameter(torch.zeros(num_experts))  # Load balancing bias!

        # Initialize
        nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))

    def forward(self, x):
        # Router with bias for load balancing
        logits = F.linear(x, self.weight, self.bias)
        return logits
```

## Switch Transformers (Google - 2021)

### Architecture Overview

**Key Innovation**: Simplest MoE - Top-1 routing

**Parameters:**
- Switch-C: 1.6T parameters
- Active per token: ~10B

### Top-1 Routing

```python
class SwitchTransformersTop1Router(nn.Module):
    """Simplest routing: one expert per token."""

    def __init__(self, config):
        super().__init__()
        self.num_experts = config.num_experts
        self.expert_capacity = config.expert_capacity

        # Router
        self.classifier = nn.Linear(config.d_model, config.num_experts)

    def forward(self, hidden_states):
        # Router logits
        router_logits = self.classifier(hidden_states)

        # Add noise for load balancing (during training)
        if self.training:
            router_logits += torch.randn_like(router_logits) * config.router_jitter_noise

        # Top-1: Argmax (hard routing)
        router_probs = F.softmax(router_logits, dim=-1)
        expert_index = torch.argmax(router_probs, dim=-1)

        # Expert capacity: drop tokens if expert is full
        expert_mask = F.one_hot(expert_index, self.num_experts)
        expert_capacity_mask = self._get_capacity_mask(expert_mask)

        return expert_index, expert_mask, expert_capacity_mask

    def _get_capacity_mask(self, expert_mask):
        """Enforce expert capacity limits."""
        # Count tokens per expert
        tokens_per_expert = expert_mask.sum(dim=0)

        # Mark tokens exceeding capacity
        capacity_mask = tokens_per_expert < self.expert_capacity
        return capacity_mask
```

### Load Balancing Loss

```python
def switch_load_balancing_loss(router_probs, expert_indices, num_experts):
    """Auxiliary loss to encourage uniform expert usage."""
    # Fraction of probability mass assigned to each expert
    router_prob_per_expert = router_probs.mean(dim=0)  # (num_experts,)

    # Fraction of tokens routed to each expert
    expert_counts = F.one_hot(expert_indices, num_experts).float().mean(dim=0)

    # Loss: num_experts * sum(prob_mass * token_fraction)
    # Minimized when both are uniform (1/num_experts)
    loss = num_experts * (router_prob_per_expert * expert_counts).sum()

    return loss
```

## Architecture Comparison Table

| Model | Total Params | Active Params | Routing | Experts/Layer | Top-K | Key Innovation |
|-------|-------------|---------------|---------|---------------|-------|----------------|
| **Mixtral 8x7B** | 47B | 13B | Top-2 | 8 | 2 | Balanced top-2, GQA |
| **DeepSeek-V3** | 671B | 37B | Top-K | Many | Variable | MLA, shared experts, no aux loss |
| **Switch-C** | 1.6T | ~10B | Top-1 | 2048 | 1 | Simplest routing |
| **GLaM** | 1.2T | ~97B | Top-2 | 64 | 2 | Capacity factor tuning |

## Design Patterns

### Pattern 1: Shared + Routed Experts (DeepSeek)

```python
# Best for: Ensuring some experts always activated
output = shared_experts(x) + routed_experts(x)
```

**Pros:**
- Guarantees minimum computation
- Shared experts learn common patterns
- Routed experts specialize

### Pattern 2: Pure Sparse Routing (Mixtral, Switch)

```python
# Best for: Maximum sparsity and efficiency
output = sum(weight_i * expert_i(x) for i in top_k)
```

**Pros:**
- Simplest implementation
- Maximum parameter efficiency
- Clear expert specialization

### Pattern 3: Expert Choice Routing

```python
# Experts choose tokens (instead of tokens choosing experts)
for expert in experts:
    top_k_tokens = expert.select_top_k_tokens(all_tokens)
    expert.process(top_k_tokens)
```

**Pros:**
- Perfect load balancing
- No token dropping
- Variable tokens per expert

## Resources

- **Mixtral Paper**: https://arxiv.org/abs/2401.04088
- **DeepSeek-V3**: https://arxiv.org/abs/2412.19437
- **Switch Transformers**: https://arxiv.org/abs/2101.03961
- **GLaM**: https://arxiv.org/abs/2112.06905
