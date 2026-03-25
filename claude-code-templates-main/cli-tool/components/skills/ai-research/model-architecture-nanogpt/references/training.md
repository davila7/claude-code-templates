# NanoGPT Training Guide

## Training Loop (~300 Lines)

NanoGPT's `train.py` is a self-contained training script with minimal dependencies.

### Complete Training Script Structure

```python
# train.py (simplified)
import os
import time
import math
import pickle
import torch
from model import GPTConfig, GPT

# Training config
batch_size = 12          # Micro batch size
block_size = 1024        # Context length
gradient_accumulation_steps = 5 * 8  # ~60K tokens per batch

# Model config
n_layer = 12
n_head = 12
n_embd = 768
dropout = 0.0

# Optimizer config
learning_rate = 6e-4
max_iters = 600000
weight_decay = 1e-1
beta1 = 0.9
beta2 = 0.95
grad_clip = 1.0

# Learning rate schedule
warmup_iters = 2000
lr_decay_iters = 600000
min_lr = 6e-5

# System
device = 'cuda'
dtype = 'bfloat16' if torch.cuda.is_bf16_supported() else 'float16'
compile = True  # PyTorch 2.0

# Data loader
def get_batch(split):
    data = train_data if split == 'train' else val_data
    ix = torch.randint(len(data) - block_size, (batch_size,))
    x = torch.stack([data[i:i+block_size] for i in ix])
    y = torch.stack([data[i+1:i+1+block_size] for i in ix])
    x, y = x.to(device), y.to(device)
    return x, y

# Learning rate schedule
def get_lr(it):
    # Warmup
    if it < warmup_iters:
        return learning_rate * it / warmup_iters
    # Decay to min_lr
    if it > lr_decay_iters:
        return min_lr
    # Cosine decay
    decay_ratio = (it - warmup_iters) / (lr_decay_iters - warmup_iters)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay_ratio))
    return min_lr + coeff * (learning_rate - min_lr)

# Init model
model = GPT(GPTConfig())
model.to(device)

# Compile model (PyTorch 2.0)
if compile:
    print("Compiling model...")
    model = torch.compile(model)

# Optimizer
optimizer = model.configure_optimizers(weight_decay, learning_rate, (beta1, beta2), device)

# Training loop
for iter_num in range(max_iters):
    # Set learning rate
    lr = get_lr(iter_num)
    for param_group in optimizer.param_groups:
        param_group['lr'] = lr

    # Gradient accumulation
    for micro_step in range(gradient_accumulation_steps):
        X, Y = get_batch('train')
        with torch.amp.autocast(device_type='cuda', dtype=torch.bfloat16):
            logits, loss = model(X, Y)
            loss = loss / gradient_accumulation_steps
        loss.backward()

    # Clip gradients
    if grad_clip != 0.0:
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)

    # Update weights
    optimizer.step()
    optimizer.zero_grad(set_to_none=True)

    # Logging
    if iter_num % 100 == 0:
        print(f"iter {iter_num}: loss {loss.item():.4f}, lr {lr:.2e}")
```

## Data Preparation

### Shakespeare Character-Level

```bash
# Step 1: Download Shakespeare
cd data/shakespeare_char
python prepare.py

# Creates:
# - train.bin (90% of data, ~1MB)
# - val.bin (10% of data, ~110KB)
# - meta.pkl (vocab info)
```

**prepare.py**:
```python
import os
import pickle
import requests
import numpy as np

# Download
input_file = 'input.txt'
if not os.path.exists(input_file):
    url = 'https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt'
    with open(input_file, 'w') as f:
        f.write(requests.get(url).text)

# Read and process
with open(input_file, 'r') as f:
    data = f.read()

print(f"Length: {len(data):,} characters")

# Create vocabulary
chars = sorted(list(set(data)))
vocab_size = len(chars)
print(f"Vocab size: {vocab_size}")

# Create mappings
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}

# Encode dataset
data_ids = [stoi[c] for c in data]

# Train/val split
n = len(data_ids)
train_ids = data_ids[:int(n*0.9)]
val_ids = data_ids[int(n*0.9):]

# Save as numpy arrays
train_ids = np.array(train_ids, dtype=np.uint16)
val_ids = np.array(val_ids, dtype=np.uint16)
train_ids.tofile('train.bin')
val_ids.tofile('val.bin')

# Save metadata
meta = {'vocab_size': vocab_size, 'itos': itos, 'stoi': stoi}
with open('meta.pkl', 'wb') as f:
    pickle.dump(meta, f)
```

### OpenWebText (GPT-2 Reproduction)

```bash
# Step 1: Download OpenWebText (~12GB compressed)
cd data/openwebtext
python prepare.py

# Warning: Takes 1-2 hours, creates ~54GB of tokenized data
```

**prepare.py**:
```python
import os
import numpy as np
import tiktoken
from datasets import load_dataset

# Download dataset
dataset = load_dataset("openwebtext", num_proc=8)

# Use GPT-2 tokenizer
enc = tiktoken.get_encoding("gpt2")

def tokenize(example):
    ids = enc.encode_ordinary(example['text'])
    ids.append(enc.eot_token)  # Add <|endoftext|>
    return {'ids': ids, 'len': len(ids)}

# Tokenize (parallel)
tokenized = dataset.map(
    tokenize,
    remove_columns=['text'],
    desc="Tokenizing",
    num_proc=8
)

# Concatenate all tokens
train_ids = np.concatenate([np.array(x['ids'], dtype=np.uint16) for x in tokenized['train']])
print(f"Train tokens: {len(train_ids):,}")  # ~9B tokens

# Save
train_ids.tofile('train.bin')

# Validation set (sample)
val_ids = np.concatenate([np.array(x['ids'], dtype=np.uint16) for x in tokenized['train'][:5000]])
val_ids.tofile('val.bin')

# Save metadata
meta = {'vocab_size': enc.n_vocab, 'eot_token': enc.eot_token}
with open('meta.pkl', 'wb') as f:
    pickle.dump(meta, f)
```

## Learning Rate Schedules

### Cosine Decay with Warmup (GPT-2 style)

```python
def get_lr(it):
    # 1) Linear warmup
    if it < warmup_iters:
        return learning_rate * it / warmup_iters

    # 2) Constant at min_lr after decay
    if it > lr_decay_iters:
        return min_lr

    # 3) Cosine decay in between
    decay_ratio = (it - warmup_iters) / (lr_decay_iters - warmup_iters)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay_ratio))
    return min_lr + coeff * (learning_rate - min_lr)

# Example values
learning_rate = 6e-4  # Peak LR
min_lr = 6e-5         # Final LR (10% of peak)
warmup_iters = 2000   # Warmup steps
lr_decay_iters = 600000  # Total training steps
```

**Visualization**:
```
LR
^
|     Peak (6e-4)
|    /‾‾‾‾‾‾‾‾‾‾\
|   /            \
|  /              \_____ Min (6e-5)
| /
|/________________> Iteration
  Warmup  Cosine    Const
  (2K)    (598K)
```

### Constant LR with Warmup (Simple)

```python
def get_lr(it):
    if it < warmup_iters:
        return learning_rate * it / warmup_iters
    return learning_rate

# Good for small experiments
```

## Gradient Accumulation

**Effective batch size** = `batch_size × gradient_accumulation_steps × num_gpus`

```python
# Config
batch_size = 12  # Per-GPU micro batch
gradient_accumulation_steps = 40  # Accumulate gradients
# Effective batch: 12 × 40 = 480 sequences = ~0.5M tokens

# Training loop
optimizer.zero_grad()
for micro_step in range(gradient_accumulation_steps):
    X, Y = get_batch('train')
    logits, loss = model(X, Y)
    loss = loss / gradient_accumulation_steps  # Scale loss
    loss.backward()  # Accumulate gradients

# Update once
torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
optimizer.step()
```

**Why?**
- Simulates large batch size without OOM
- GPT-2 (124M) uses effective batch ~0.5M tokens
- More stable training

## Mixed Precision Training

### BF16 (Best for A100/H100)

```python
# Enable bfloat16
dtype = torch.bfloat16

# Training loop
for iter in range(max_iters):
    X, Y = get_batch('train')

    # Forward in BF16
    with torch.amp.autocast(device_type='cuda', dtype=torch.bfloat16):
        logits, loss = model(X, Y)

    # Backward in FP32 (automatic)
    loss.backward()
    optimizer.step()
```

**Advantages**:
- No gradient scaler needed
- Same dynamic range as FP32
- 2× faster, 50% memory reduction

### FP16 (V100, older GPUs)

```python
from torch.cuda.amp import GradScaler, autocast

scaler = GradScaler()

for iter in range(max_iters):
    X, Y = get_batch('train')

    # Forward in FP16
    with autocast():
        logits, loss = model(X, Y)

    # Scale loss, backward
    scaler.scale(loss).backward()

    # Unscale, clip gradients
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)

    # Update weights
    scaler.step(optimizer)
    scaler.update()
```

## Distributed Data Parallel (DDP)

### Single Node, Multiple GPUs

```python
# train.py (DDP version)
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# Initialize
dist.init_process_group(backend='nccl')
ddp_rank = int(os.environ['RANK'])
ddp_local_rank = int(os.environ['LOCAL_RANK'])
ddp_world_size = int(os.environ['WORLD_SIZE'])
device = f'cuda:{ddp_local_rank}'
torch.cuda.set_device(device)

# Model
model = GPT(GPTConfig())
model.to(device)
model = DDP(model, device_ids=[ddp_local_rank])

# Training loop (same as before, DDP handles gradient sync)
for iter in range(max_iters):
    X, Y = get_batch('train')  # Each rank gets different data
    logits, loss = model(X, Y)
    loss.backward()  # DDP syncs gradients across GPUs
    optimizer.step()
```

**Launch**:
```bash
# 8 GPUs on single node
torchrun --standalone --nproc_per_node=8 train.py config/train_gpt2.py
```

### Multi-Node Training

```bash
# Node 0 (master)
torchrun --nproc_per_node=8 \
  --nnodes=4 --node_rank=0 \
  --master_addr=192.168.1.100 --master_port=29500 \
  train.py config/train_gpt2.py

# Node 1-3 (workers)
torchrun --nproc_per_node=8 \
  --nnodes=4 --node_rank=$RANK \
  --master_addr=192.168.1.100 --master_port=29500 \
  train.py config/train_gpt2.py
```

## Checkpointing

### Save Checkpoint

```python
# Save every N iterations
if iter_num % 5000 == 0:
    checkpoint = {
        'model': model.state_dict(),
        'optimizer': optimizer.state_dict(),
        'model_args': model_args,
        'iter_num': iter_num,
        'best_val_loss': best_val_loss,
        'config': config,
    }
    torch.save(checkpoint, os.path.join(out_dir, f'ckpt_{iter_num}.pt'))
```

### Resume from Checkpoint

```python
# Load checkpoint
init_from = 'resume'  # or 'gpt2', 'gpt2-medium', etc.

if init_from == 'resume':
    ckpt_path = os.path.join(out_dir, 'ckpt_latest.pt')
    checkpoint = torch.load(ckpt_path, map_location=device)

    # Restore model
    model_args = checkpoint['model_args']
    model = GPT(GPTConfig(**model_args))
    model.load_state_dict(checkpoint['model'])

    # Restore optimizer
    optimizer.load_state_dict(checkpoint['optimizer'])

    # Restore iteration counter
    iter_num = checkpoint['iter_num']
    best_val_loss = checkpoint['best_val_loss']
```

## Fine-Tuning Pretrained Models

### Load OpenAI GPT-2 Weights

```python
# model.py - from_pretrained method
@classmethod
def from_pretrained(cls, model_type):
    """Load pretrained GPT-2 model weights from HuggingFace."""
    from transformers import GPT2LMHeadModel

    # Download from HuggingFace
    model_hf = GPT2LMHeadModel.from_pretrained(model_type)
    sd_hf = model_hf.state_dict()

    # Filter out keys we don't need
    sd_hf_keys = [k for k in sd_hf.keys() if not k.endswith('.attn.masked_bias')]
    sd_hf_keys = [k for k in sd_hf_keys if not k.endswith('.attn.bias')]

    # Create our model
    config = GPTConfig.from_model_type(model_type)
    model = GPT(config)
    sd = model.state_dict()

    # Copy weights (transpose Conv1D → Linear)
    for k in sd_hf_keys:
        if any([k.endswith(w) for w in ['.c_attn.weight', '.c_proj.weight', '.c_fc.weight']]):
            sd[k] = sd_hf[k].t()  # Transpose
        else:
            sd[k] = sd_hf[k]  # Direct copy

    model.load_state_dict(sd)
    return model

# Usage
model = GPT.from_pretrained('gpt2')  # Load GPT-2 (124M)
```

### Fine-Tune on Custom Data

```python
# config/finetune_shakespeare.py
init_from = 'gpt2'  # Start from GPT-2
dataset = 'shakespeare_char'

# Fine-tuning hyperparameters
learning_rate = 3e-5  # Lower LR for fine-tuning
max_iters = 2000      # Short fine-tuning
warmup_iters = 100

# Regularization
weight_decay = 1e-1
dropout = 0.2  # Add dropout

# Run
# python train.py config/finetune_shakespeare.py
```

## Evaluation

### Perplexity

```python
@torch.no_grad()
def estimate_loss():
    model.eval()
    losses = torch.zeros(eval_iters)

    for k in range(eval_iters):
        X, Y = get_batch('val')
        logits, loss = model(X, Y)
        losses[k] = loss.item()

    model.train()
    return losses.mean()

# Usage
val_loss = estimate_loss()
perplexity = math.exp(val_loss)
print(f"Val perplexity: {perplexity:.2f}")
```

### Sample Generation

```python
# sample.py
model.eval()

start = "ROMEO:"  # Prompt
start_ids = encode(start)
x = torch.tensor(start_ids, dtype=torch.long, device=device)[None, ...]

# Generate
with torch.no_grad():
    y = model.generate(x, max_new_tokens=500, temperature=0.8, top_k=200)

print(decode(y[0].tolist()))
```

## Training Times

| Setup | Model | Hardware | Batch Size | Time to Perplexity 10 |
|-------|-------|----------|------------|----------------------|
| Shakespeare | 10M | 1× CPU | 64 | 5 minutes |
| Shakespeare | 10M | 1× T4 GPU | 64 | 1 minute |
| OpenWebText | 124M | 1× A100 | 480 | 7 days |
| OpenWebText | 124M | 8× A100 | 3840 | 4 days |
| OpenWebText | 350M | 8× A100 | 1920 | 14 days |

## Resources

- Training script: https://github.com/karpathy/nanoGPT/blob/master/train.py
- Configs: https://github.com/karpathy/nanoGPT/tree/master/config
- Video walkthrough: "Let's build GPT" (training section)
- GPT-2 paper: https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf
