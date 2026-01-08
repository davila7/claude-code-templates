# NanoGPT Architecture

## Model Structure (~300 Lines)

NanoGPT implements a clean GPT-2 architecture in minimal code for educational purposes.

### Complete Model (model.py)

```python
import torch
import torch.nn as nn
from torch.nn import functional as F

class CausalSelfAttention(nn.Module):
    """Multi-head masked self-attention layer."""

    def __init__(self, config):
        super().__init__()
        assert config.n_embd % config.n_head == 0

        # Key, query, value projections for all heads (batched)
        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd, bias=config.bias)
        # Output projection
        self.c_proj = nn.Linear(config.n_embd, config.n_embd, bias=config.bias)

        # Regularization
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)

        self.n_head = config.n_head
        self.n_embd = config.n_embd
        self.dropout = config.dropout

        # Flash attention flag
        self.flash = hasattr(torch.nn.functional, 'scaled_dot_product_attention')

        if not self.flash:
            # Causal mask (lower triangular)
            self.register_buffer("bias", torch.tril(
                torch.ones(config.block_size, config.block_size)
            ).view(1, 1, config.block_size, config.block_size))

    def forward(self, x):
        B, T, C = x.size()  # batch, seq_len, embedding_dim

        # Calculate Q, K, V for all heads in batch
        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)

        # Reshape for multi-head attention
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)  # (B, nh, T, hs)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)  # (B, nh, T, hs)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)  # (B, nh, T, hs)

        # Attention
        if self.flash:
            # Flash Attention (PyTorch 2.0+)
            y = torch.nn.functional.scaled_dot_product_attention(
                q, k, v,
                attn_mask=None,
                dropout_p=self.dropout if self.training else 0,
                is_causal=True
            )
        else:
            # Manual attention implementation
            att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
            att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float('-inf'))
            att = F.softmax(att, dim=-1)
            att = self.attn_dropout(att)
            y = att @ v  # (B, nh, T, hs)

        # Reassemble all head outputs
        y = y.transpose(1, 2).contiguous().view(B, T, C)

        # Output projection
        y = self.resid_dropout(self.c_proj(y))
        return y


class MLP(nn.Module):
    """Feedforward network (2-layer with GELU activation)."""

    def __init__(self, config):
        super().__init__()
        self.c_fc = nn.Linear(config.n_embd, 4 * config.n_embd, bias=config.bias)
        self.gelu = nn.GELU()
        self.c_proj = nn.Linear(4 * config.n_embd, config.n_embd, bias=config.bias)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x):
        x = self.c_fc(x)
        x = self.gelu(x)
        x = self.c_proj(x)
        x = self.dropout(x)
        return x


class Block(nn.Module):
    """Transformer block (attention + MLP with residuals)."""

    def __init__(self, config):
        super().__init__()
        self.ln_1 = nn.LayerNorm(config.n_embd)
        self.attn = CausalSelfAttention(config)
        self.ln_2 = nn.LayerNorm(config.n_embd)
        self.mlp = MLP(config)

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))  # Pre-norm + residual
        x = x + self.mlp(self.ln_2(x))   # Pre-norm + residual
        return x


@dataclass
class GPTConfig:
    """GPT model configuration."""
    block_size: int = 1024    # Max sequence length
    vocab_size: int = 50304   # GPT-2 vocab size (50257 rounded up for efficiency)
    n_layer: int = 12         # Number of layers
    n_head: int = 12          # Number of attention heads
    n_embd: int = 768         # Embedding dimension
    dropout: float = 0.0      # Dropout rate
    bias: bool = True         # Use bias in Linear and LayerNorm layers


class GPT(nn.Module):
    """GPT Language Model."""

    def __init__(self, config):
        super().__init__()
        assert config.vocab_size is not None
        assert config.block_size is not None
        self.config = config

        self.transformer = nn.ModuleDict(dict(
            wte=nn.Embedding(config.vocab_size, config.n_embd),  # Token embeddings
            wpe=nn.Embedding(config.block_size, config.n_embd),  # Position embeddings
            drop=nn.Dropout(config.dropout),
            h=nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
            ln_f=nn.LayerNorm(config.n_embd),
        ))
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)

        # Weight tying (share embeddings and output projection)
        self.transformer.wte.weight = self.lm_head.weight

        # Initialize weights
        self.apply(self._init_weights)
        # Apply special scaled init to residual projections
        for pn, p in self.named_parameters():
            if pn.endswith('c_proj.weight'):
                torch.nn.init.normal_(p, mean=0.0, std=0.02/math.sqrt(2 * config.n_layer))

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        device = idx.device
        b, t = idx.size()
        assert t <= self.config.block_size, f"Cannot forward sequence length {t}, max is {self.config.block_size}"

        # Generate position indices
        pos = torch.arange(0, t, dtype=torch.long, device=device).unsqueeze(0)  # (1, t)

        # Forward the GPT model
        tok_emb = self.transformer.wte(idx)  # Token embeddings (b, t, n_embd)
        pos_emb = self.transformer.wpe(pos)  # Position embeddings (1, t, n_embd)
        x = self.transformer.drop(tok_emb + pos_emb)

        for block in self.transformer.h:
            x = block(x)

        x = self.transformer.ln_f(x)

        if targets is not None:
            # Training mode: compute loss
            logits = self.lm_head(x)
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1)
        else:
            # Inference mode: only compute logits for last token
            logits = self.lm_head(x[:, [-1], :])  # (b, 1, vocab_size)
            loss = None

        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
        """Generate new tokens autoregressively."""
        for _ in range(max_new_tokens):
            # Crop context if needed
            idx_cond = idx if idx.size(1) <= self.config.block_size else idx[:, -self.config.block_size:]

            # Forward pass
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature  # Scale by temperature

            # Optionally crop logits to top k
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float('Inf')

            # Sample from distribution
            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)

            # Append to sequence
            idx = torch.cat((idx, idx_next), dim=1)

        return idx
```

## Key Design Decisions

### 1. Pre-Norm vs Post-Norm

**NanoGPT uses Pre-Norm** (LayerNorm before sub-layers):

```python
# Pre-norm (NanoGPT)
x = x + attn(ln(x))
x = x + mlp(ln(x))

# Post-norm (original Transformer)
x = ln(x + attn(x))
x = ln(x + mlp(x))
```

**Why Pre-Norm?**
- More stable training (no gradient explosion)
- Used in GPT-2, GPT-3
- Standard for large language models

### 2. Weight Tying

**Shared weights between embeddings and output**:

```python
self.transformer.wte.weight = self.lm_head.weight
```

**Why?**
- Reduces parameters: `vocab_size × n_embd` saved
- Improves training (same semantic space)
- Standard in GPT-2

### 3. Scaled Residual Initialization

```python
# Scale down residual projections by layer depth
std = 0.02 / math.sqrt(2 * n_layer)
torch.nn.init.normal_(c_proj.weight, mean=0.0, std=std)
```

**Why?**
- Prevents gradient explosion in deep networks
- Each residual path contributes ~equally
- From GPT-2 paper

### 4. Flash Attention

```python
if hasattr(torch.nn.functional, 'scaled_dot_product_attention'):
    # Use PyTorch 2.0 Flash Attention (2× faster!)
    y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
else:
    # Fallback to manual attention
    att = (q @ k.T) / sqrt(d)
    att = masked_fill(att, causal_mask, -inf)
    y = softmax(att) @ v
```

**Speedup**: 2× faster with same accuracy

## Model Sizes

| Model | n_layer | n_head | n_embd | Params | Config Name |
|-------|---------|--------|--------|--------|-------------|
| GPT-2 Small | 12 | 12 | 768 | 124M | `gpt2` |
| GPT-2 Medium | 24 | 16 | 1024 | 350M | `gpt2-medium` |
| GPT-2 Large | 36 | 20 | 1280 | 774M | `gpt2-large` |
| GPT-2 XL | 48 | 25 | 1600 | 1558M | `gpt2-xl` |

**NanoGPT default** (Shakespeare):
```python
config = GPTConfig(
    block_size=256,   # Short context for char-level
    vocab_size=65,    # Small vocab (a-z, A-Z, punctuation)
    n_layer=6,        # Shallow network
    n_head=6,
    n_embd=384,       # Small embeddings
    dropout=0.2       # Regularization
)
# Total: ~10M parameters
```

## Attention Visualization

```python
# What each token attends to (lower triangular)
# Token t can only attend to tokens 0...t

Attention Pattern (causal mask):
    t=0  t=1  t=2  t=3
t=0  ✓    -    -    -
t=1  ✓    ✓    -    -
t=2  ✓    ✓    ✓    -
t=3  ✓    ✓    ✓    ✓

# Prevents "cheating" by looking at future tokens
```

## Residual Stream

**Information flow through residuals**:

```python
# Input
x = token_emb + pos_emb

# Block 1
x = x + attn_1(ln(x))   # Attention adds to residual
x = x + mlp_1(ln(x))    # MLP adds to residual

# Block 2
x = x + attn_2(ln(x))
x = x + mlp_2(ln(x))

# ... (repeat for all layers)

# Output
logits = lm_head(ln(x))
```

**Key insight**: Each layer refines the representation, residuals preserve gradients

## Tokenization

### Character-Level (Shakespeare)

```python
# data/shakespeare_char/prepare.py
text = open('input.txt', 'r').read()
chars = sorted(list(set(text)))  # ['!', ',', '.', 'A', 'B', ..., 'z']
vocab_size = len(chars)  # 65

stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}

# Encode
encode = lambda s: [stoi[c] for c in s]
decode = lambda l: ''.join([itos[i] for i in l])

data = torch.tensor(encode(text), dtype=torch.long)
```

### BPE (GPT-2)

```python
# data/openwebtext/prepare.py
import tiktoken

enc = tiktoken.get_encoding("gpt2")  # GPT-2 BPE tokenizer
vocab_size = enc.n_vocab  # 50257

# Encode
tokens = enc.encode_ordinary("Hello world")  # [15496, 995]

# Decode
text = enc.decode(tokens)  # "Hello world"
```

## Resources

- **GitHub**: https://github.com/karpathy/nanoGPT ⭐ 48,000+
- **Video**: "Let's build GPT" by Andrej Karpathy
- **Paper**: "Attention is All You Need" (Vaswani et al.)
- **Paper**: "Language Models are Unsupervised Multitask Learners" (GPT-2)
- **Code walkthrough**: https://github.com/karpathy/nanoGPT/blob/master/ARCHITECTURE.md
