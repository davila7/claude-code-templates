# Mamba Training Guide

## Training from Scratch

### Setup Environment

```bash
# Install dependencies
pip install torch>=1.12.0 --extra-index-url https://download.pytorch.org/whl/cu116
pip install packaging ninja
pip install causal-conv1d>=1.1.0
pip install mamba-ssm

# Verify CUDA
python -c "import torch; print(torch.cuda.is_available())"
```

### Basic Training Loop

```python
import torch
from mamba_ssm import Mamba
from torch.utils.data import DataLoader

# Model setup
model = Mamba(
    d_model=512,
    d_state=16,
    d_conv=4,
    expand=2
).cuda()

# Optimizer (same as GPT)
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=6e-4,
    betas=(0.9, 0.95),
    weight_decay=0.1
)

# Training loop
for batch in dataloader:
    inputs, targets = batch
    inputs, targets = inputs.cuda(), targets.cuda()

    # Forward
    logits = model(inputs)
    loss = F.cross_entropy(logits.view(-1, vocab_size), targets.view(-1))

    # Backward
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    optimizer.step()
```

## Distributed Training

### Single-Node Multi-GPU (DDP)

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# Initialize process group
dist.init_process_group("nccl")
local_rank = int(os.environ["LOCAL_RANK"])
torch.cuda.set_device(local_rank)

# Wrap model
model = Mamba(...).cuda()
model = DDP(model, device_ids=[local_rank])

# Train
optimizer = torch.optim.AdamW(model.parameters(), lr=6e-4)
for batch in dataloader:
    loss = compute_loss(model, batch)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

**Launch**:
```bash
torchrun --nproc_per_node=8 train.py
```

### Multi-Node Training

```bash
# Node 0 (master)
torchrun --nproc_per_node=8 \
  --nnodes=4 --node_rank=0 \
  --master_addr=$MASTER_ADDR --master_port=29500 \
  train.py

# Node 1-3 (workers)
torchrun --nproc_per_node=8 \
  --nnodes=4 --node_rank=$NODE_RANK \
  --master_addr=$MASTER_ADDR --master_port=29500 \
  train.py
```

## Mixed Precision Training

### BF16 (Recommended)

```python
from torch.cuda.amp import autocast, GradScaler

# BF16 (no scaler needed on A100/H100)
for batch in dataloader:
    with autocast(dtype=torch.bfloat16):
        logits = model(inputs)
        loss = F.cross_entropy(logits.view(-1, vocab_size), targets.view(-1))

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

### FP16 (with gradient scaling)

```python
scaler = GradScaler()

for batch in dataloader:
    with autocast(dtype=torch.float16):
        logits = model(inputs)
        loss = F.cross_entropy(logits.view(-1, vocab_size), targets.view(-1))

    optimizer.zero_grad()
    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    scaler.step(optimizer)
    scaler.update()
```

## Hyperparameter Recommendations

### Learning Rate Schedule

```python
# Cosine decay with warmup (GPT-3 style)
def get_lr(it, warmup_iters=2000, lr_decay_iters=600000):
    max_lr = 6e-4
    min_lr = 6e-5

    # Warmup
    if it < warmup_iters:
        return max_lr * it / warmup_iters

    # Decay
    if it > lr_decay_iters:
        return min_lr

    # Cosine
    decay_ratio = (it - warmup_iters) / (lr_decay_iters - warmup_iters)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay_ratio))
    return min_lr + coeff * (max_lr - min_lr)

# Apply in training loop
for it, batch in enumerate(dataloader):
    lr = get_lr(it)
    for param_group in optimizer.param_groups:
        param_group['lr'] = lr
```

### Batch Size Recommendations

| Model Size | Per-GPU Batch | Gradient Accum | Effective Batch | GPUs |
|------------|---------------|----------------|-----------------|------|
| 130M | 32 | 4 | 1024 | 8 |
| 370M | 16 | 8 | 1024 | 8 |
| 790M | 8 | 8 | 512 | 8 |
| 1.4B | 4 | 16 | 512 | 8 |
| 2.8B | 2 | 16 | 256 | 8 |

```python
# Gradient accumulation
accumulation_steps = 8
optimizer.zero_grad()

for i, batch in enumerate(dataloader):
    loss = compute_loss(model, batch) / accumulation_steps
    loss.backward()

    if (i + 1) % accumulation_steps == 0:
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        optimizer.zero_grad()
```

### Optimizer Configuration

```python
# AdamW (recommended)
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=6e-4,           # Peak learning rate
    betas=(0.9, 0.95), # Standard for LLMs
    eps=1e-8,
    weight_decay=0.1   # Important for generalization
)

# Weight decay exemptions (optional)
decay = set()
no_decay = set()
for name, param in model.named_parameters():
    if 'norm' in name or 'bias' in name:
        no_decay.add(param)
    else:
        decay.add(param)

optimizer = torch.optim.AdamW([
    {'params': list(decay), 'weight_decay': 0.1},
    {'params': list(no_decay), 'weight_decay': 0.0}
], lr=6e-4, betas=(0.9, 0.95))
```

## Memory Optimization

### Gradient Checkpointing

```python
from torch.utils.checkpoint import checkpoint

class MambaBlock(nn.Module):
    def __init__(self, d_model, use_checkpoint=False):
        super().__init__()
        self.use_checkpoint = use_checkpoint
        self.norm = RMSNorm(d_model)
        self.mamba = Mamba(d_model)

    def forward(self, x):
        if self.use_checkpoint and self.training:
            return x + checkpoint(self._forward, x, use_reentrant=False)
        return x + self._forward(x)

    def _forward(self, x):
        return self.mamba(self.norm(x))

# Enable for training
model = MambaLM(use_checkpoint=True)
```

**Memory savings**: ~30-40% with minimal speed impact

### Flash Attention Integration

Mamba's CUDA kernels already use flash-attention-style optimizations:
- Fused operations in single kernel
- Recomputation in backward pass
- No intermediate activation storage

## Long Context Training

### Sequence Length Progression

```python
# Start short, increase gradually
training_stages = [
    {'seq_len': 512,  'iters': 50000},
    {'seq_len': 1024, 'iters': 100000},
    {'seq_len': 2048, 'iters': 150000},
    {'seq_len': 4096, 'iters': 200000},
]

for stage in training_stages:
    dataloader = create_dataloader(seq_len=stage['seq_len'])
    train(model, dataloader, max_iters=stage['iters'])
```

### Memory Requirements (Batch Size 1)

| Sequence Length | 130M Model | 370M Model | 1.4B Model |
|----------------|------------|------------|------------|
| 2K | 4 GB | 8 GB | 24 GB |
| 4K | 5 GB | 10 GB | 32 GB |
| 8K | 6 GB | 14 GB | 48 GB |
| 16K | 8 GB | 20 GB | 64 GB |
| 32K | 12 GB | 32 GB | 96 GB |

**Mamba advantage**: Memory grows **linearly**, Transformers grow **quadratically**

## Common Training Issues

### Issue: OOM during training

**Solution 1**: Reduce batch size
```python
per_gpu_batch = 8  # Reduce from 16
gradient_accumulation = 8  # Increase from 4
```

**Solution 2**: Enable gradient checkpointing
```python
model = MambaLM(use_checkpoint=True)
```

**Solution 3**: Use smaller sequence length
```python
seq_len = 1024  # Reduce from 2048
```

### Issue: Training unstable (loss spikes)

**Solution 1**: Check gradient norm
```python
grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
print(f"Grad norm: {grad_norm}")  # Should be < 10
```

**Solution 2**: Lower learning rate
```python
max_lr = 3e-4  # Reduce from 6e-4
```

**Solution 3**: Check Δ initialization
```python
# Ensure dt_min, dt_max are reasonable
model = Mamba(
    d_model=512,
    dt_min=0.001,  # Not too small
    dt_max=0.1     # Not too large
)
```

### Issue: Slow training speed

**Solution 1**: Verify CUDA kernels installed
```python
import mamba_ssm
print(mamba_ssm.__version__)  # Should have CUDA kernels
```

**Solution 2**: Use BF16 on A100/H100
```python
with autocast(dtype=torch.bfloat16):  # Faster than FP16
    loss = model(inputs)
```

**Solution 3**: Increase batch size if possible
```python
per_gpu_batch = 16  # Increase from 8 (better GPU utilization)
```

## Checkpointing

### Save/Load Model

```python
# Save
checkpoint = {
    'model': model.state_dict(),
    'optimizer': optimizer.state_dict(),
    'iter': iteration,
    'config': model_config
}
torch.save(checkpoint, f'checkpoint_{iteration}.pt')

# Load
checkpoint = torch.load('checkpoint_100000.pt')
model.load_state_dict(checkpoint['model'])
optimizer.load_state_dict(checkpoint['optimizer'])
iteration = checkpoint['iter']
```

### Best Practices

```python
# Save every N iterations
if iteration % save_interval == 0:
    save_checkpoint(model, optimizer, iteration)

# Keep only last K checkpoints
checkpoints = sorted(glob.glob('checkpoint_*.pt'))
if len(checkpoints) > keep_last:
    for ckpt in checkpoints[:-keep_last]:
        os.remove(ckpt)
```

## Resources

- Training code: https://github.com/state-spaces/mamba/tree/main/benchmarks
- Pretrained models: https://huggingface.co/state-spaces
- CUDA installation: https://github.com/state-spaces/mamba#installation
