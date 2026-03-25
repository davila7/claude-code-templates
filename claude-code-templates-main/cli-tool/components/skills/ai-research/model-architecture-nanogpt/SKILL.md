---
name: nanogpt
description: Educational GPT implementation in ~300 lines. Reproduces GPT-2 (124M) on OpenWebText. Clean, hackable code for learning transformers. By Andrej Karpathy. Perfect for understanding GPT architecture from scratch. Train on Shakespeare (CPU) or OpenWebText (multi-GPU).
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Model Architecture, NanoGPT, GPT-2, Educational, Andrej Karpathy, Transformer, Minimalist, From Scratch, Training]
dependencies: [torch, transformers, datasets, tiktoken, wandb]
---

# nanoGPT - Minimalist GPT Training

## Quick start

nanoGPT is a simplified GPT implementation designed for learning and experimentation.

**Installation**:
```bash
pip install torch numpy transformers datasets tiktoken wandb tqdm
```

**Train on Shakespeare** (CPU-friendly):
```bash
# Prepare data
python data/shakespeare_char/prepare.py

# Train (5 minutes on CPU)
python train.py config/train_shakespeare_char.py

# Generate text
python sample.py --out_dir=out-shakespeare-char
```

**Output**:
```
ROMEO:
What say'st thou? Shall I speak, and be a man?

JULIET:
I am afeard, and yet I'll speak; for thou art
One that hath been a man, and yet I know not
What thou art.
```

## Common workflows

### Workflow 1: Character-level Shakespeare

**Complete training pipeline**:
```bash
# Step 1: Prepare data (creates train.bin, val.bin)
python data/shakespeare_char/prepare.py

# Step 2: Train small model
python train.py config/train_shakespeare_char.py

# Step 3: Generate text
python sample.py --out_dir=out-shakespeare-char
```

**Config** (`config/train_shakespeare_char.py`):
```python
# Model config
n_layer = 6          # 6 transformer layers
n_head = 6           # 6 attention heads
n_embd = 384         # 384-dim embeddings
block_size = 256     # 256 char context

# Training config
batch_size = 64
learning_rate = 1e-3
max_iters = 5000
eval_interval = 500

# Hardware
device = 'cpu'  # Or 'cuda'
compile = False # Set True for PyTorch 2.0
```

**Training time**: ~5 minutes (CPU), ~1 minute (GPU)

### Workflow 2: Reproduce GPT-2 (124M)

**Multi-GPU training on OpenWebText**:
```bash
# Step 1: Prepare OpenWebText (takes ~1 hour)
python data/openwebtext/prepare.py

# Step 2: Train GPT-2 124M with DDP (8 GPUs)
torchrun --standalone --nproc_per_node=8 \
  train.py config/train_gpt2.py

# Step 3: Sample from trained model
python sample.py --out_dir=out
```

**Config** (`config/train_gpt2.py`):
```python
# GPT-2 (124M) architecture
n_layer = 12
n_head = 12
n_embd = 768
block_size = 1024
dropout = 0.0

# Training
batch_size = 12
gradient_accumulation_steps = 5 * 8  # Total batch ~0.5M tokens
learning_rate = 6e-4
max_iters = 600000
lr_decay_iters = 600000

# System
compile = True  # PyTorch 2.0
```

**Training time**: ~4 days (8× A100)

### Workflow 3: Fine-tune pretrained GPT-2

**Start from OpenAI checkpoint**:
```python
# In train.py or config
init_from = 'gpt2'  # Options: gpt2, gpt2-medium, gpt2-large, gpt2-xl

# Model loads OpenAI weights automatically
python train.py config/finetune_shakespeare.py
```

**Example config** (`config/finetune_shakespeare.py`):
```python
# Start from GPT-2
init_from = 'gpt2'

# Dataset
dataset = 'shakespeare_char'
batch_size = 1
block_size = 1024

# Fine-tuning
learning_rate = 3e-5  # Lower LR for fine-tuning
max_iters = 2000
warmup_iters = 100

# Regularization
weight_decay = 1e-1
```

### Workflow 4: Custom dataset

**Train on your own text**:
```python
# data/custom/prepare.py
import numpy as np

# Load your data
with open('my_data.txt', 'r') as f:
    text = f.read()

# Create character mappings
chars = sorted(list(set(text)))
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}

# Tokenize
data = np.array([stoi[ch] for ch in text], dtype=np.uint16)

# Split train/val
n = len(data)
train_data = data[:int(n*0.9)]
val_data = data[int(n*0.9):]

# Save
train_data.tofile('data/custom/train.bin')
val_data.tofile('data/custom/val.bin')
```

**Train**:
```bash
python data/custom/prepare.py
python train.py --dataset=custom
```

## When to use vs alternatives

**Use nanoGPT when**:
- Learning how GPT works
- Experimenting with transformer variants
- Teaching/education purposes
- Quick prototyping
- Limited compute (can run on CPU)

**Simplicity advantages**:
- **~300 lines**: Entire model in `model.py`
- **~300 lines**: Training loop in `train.py`
- **Hackable**: Easy to modify
- **No abstractions**: Pure PyTorch

**Use alternatives instead**:
- **HuggingFace Transformers**: Production use, many models
- **Megatron-LM**: Large-scale distributed training
- **LitGPT**: More architectures, production-ready
- **PyTorch Lightning**: Need high-level framework

## Common issues

**Issue: CUDA out of memory**

Reduce batch size or context length:
```python
batch_size = 1  # Reduce from 12
block_size = 512  # Reduce from 1024
gradient_accumulation_steps = 40  # Increase to maintain effective batch
```

**Issue: Training too slow**

Enable compilation (PyTorch 2.0+):
```python
compile = True  # 2× speedup
```

Use mixed precision:
```python
dtype = 'bfloat16'  # Or 'float16'
```

**Issue: Poor generation quality**

Train longer:
```python
max_iters = 10000  # Increase from 5000
```

Lower temperature:
```python
# In sample.py
temperature = 0.7  # Lower from 1.0
top_k = 200       # Add top-k sampling
```

**Issue: Can't load GPT-2 weights**

Install transformers:
```bash
pip install transformers
```

Check model name:
```python
init_from = 'gpt2'  # Valid: gpt2, gpt2-medium, gpt2-large, gpt2-xl
```

## Advanced topics

**Model architecture**: See [references/architecture.md](references/architecture.md) for GPT block structure, multi-head attention, and MLP layers explained simply.

**Training loop**: See [references/training.md](references/training.md) for learning rate schedule, gradient accumulation, and distributed data parallel setup.

**Data preparation**: See [references/data.md](references/data.md) for tokenization strategies (character-level vs BPE) and binary format details.

## Hardware requirements

- **Shakespeare (char-level)**:
  - CPU: 5 minutes
  - GPU (T4): 1 minute
  - VRAM: <1GB

- **GPT-2 (124M)**:
  - 1× A100: ~1 week
  - 8× A100: ~4 days
  - VRAM: ~16GB per GPU

- **GPT-2 Medium (350M)**:
  - 8× A100: ~2 weeks
  - VRAM: ~40GB per GPU

**Performance**:
- With `compile=True`: 2× speedup
- With `dtype=bfloat16`: 50% memory reduction

## Resources

- GitHub: https://github.com/karpathy/nanoGPT ⭐ 48,000+
- Video: "Let's build GPT" by Andrej Karpathy
- Paper: "Attention is All You Need" (Vaswani et al.)
- OpenWebText: https://huggingface.co/datasets/Skylion007/openwebtext
- Educational: Best for understanding transformers from scratch


