# Distributed Training

Guide to FSDP (Fully Sharded Data Parallel) distributed training in LitGPT for scaling to multiple GPUs and nodes.

## Overview

LitGPT uses **Lightning Fabric** with **FSDP** to distribute training across multiple GPUs. FSDP shards model parameters, gradients, and optimizer states to enable training models larger than single-GPU memory.

**When to use FSDP**:
- Model doesn't fit on single GPU
- Want faster training with multi-GPU
- Training models >7B parameters
- Need to scale across multiple nodes

## Quick Start

### Single Node Multi-GPU

```bash
# Train Llama 2 7B on 4 GPUs
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --devices 4 \
  --data JSON \
  --data.json_path data/alpaca.json
```

FSDP is **automatically enabled** when `devices > 1`.

### Multi-Node Training

```bash
# Train on 2 nodes with 8 GPUs each (16 total)
litgpt finetune_lora meta-llama/Llama-2-70b-hf \
  --devices 8 \
  --num_nodes 2 \
  --data JSON \
  --data.json_path data/alpaca.json
```

## FSDP Configuration

### Default FSDP Strategy

When multiple devices are used, LitGPT applies this FSDP configuration:

```python
from lightning.fabric.strategies import FSDPStrategy
from litgpt.model import Block

strategy = FSDPStrategy(
    auto_wrap_policy={Block},
    state_dict_type="full",
    sharding_strategy="HYBRID_SHARD"
)
```

**Parameters**:
- `auto_wrap_policy={Block}`: Automatically wraps each transformer `Block` with FSDP
- `state_dict_type="full"`: Saves full model (assembled on rank 0) for easy deployment
- `sharding_strategy="HYBRID_SHARD"`: Shards parameters, gradients, and optimizer states

### Sharding Strategies

| Strategy | Shards | Communication | Use Case |
|----------|--------|---------------|----------|
| `FULL_SHARD` (ZeRO-3) | Params + Grads + Optim | All-gather before forward/backward | Maximum memory savings |
| `SHARD_GRAD_OP` (ZeRO-2) | Grads + Optim only | Reduce-scatter after backward | Faster than FULL_SHARD |
| `HYBRID_SHARD` (default) | All (hybrid across nodes) | Optimized for multi-node | Best for clusters |
| `NO_SHARD` | None | Broadcast | Single GPU (no FSDP) |

**Recommendation**: Use default `HYBRID_SHARD` for multi-node, or `FULL_SHARD` for single-node multi-GPU.

### State Dict Types

| Type | Behavior | Use Case |
|------|----------|----------|
| `full` (default) | Gathers all shards on rank 0, saves single file | Easy deployment, inference |
| `sharded` | Each rank saves its shard separately | Faster checkpointing, resume training |

### Auto-Wrap Policy

FSDP wraps model components based on `auto_wrap_policy`:

```python
auto_wrap_policy={Block}  # Wrap each transformer block
```

This means each `Block` (transformer layer) is independently sharded across GPUs. For a 32-layer model on 4 GPUs, each GPU holds ~8 layer shards.

## Thunder FSDP (Advanced)

LitGPT includes an experimental **Thunder** extension with enhanced FSDP:

```bash
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --num_nodes 1 \
  --compiler thunder \
  --strategy fsdp
```

### Thunder FSDP Configuration

```python
from extensions.thunder.pretrain import ThunderFSDPStrategy

strategy = ThunderFSDPStrategy(
    sharding_strategy="ZERO3",
    bucketing_strategy="BLOCK",
    state_dict_type="full",
    jit=False,
)
```

**Additional Parameters**:
- `sharding_strategy`: `"ZERO3"` (full shard), `"ZERO2"` (grad/optim only)
- `bucketing_strategy`: `"BLOCK"` (combine ops per block), `"LAYER"` (per layer), `"NONE"` (no bucketing)
- `jit`: Whether to apply `thunder.jit(model)` for optimization
- `executors`: Tuple of Thunder executors to enable

**Bucketing Strategy**:
- `"BLOCK"` (default): Combines collective operations for layer blocks → fewer communication calls
- `"LAYER"`: Combines per layer class
- `"NONE"`: No bucketing → more fine-grained but more overhead

## Pretraining with FSDP

### Single Node

```bash
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --train.global_batch_size 512 \
  --train.micro_batch_size 8 \
  --data Alpaca2k
```

**Memory calculation**:
- TinyLlama 1.1B: ~4GB model + ~4GB gradients + ~8GB optimizer = 16GB per GPU without FSDP
- With FSDP on 8 GPUs: 16GB / 8 = 2GB per GPU ✅ Fits easily

### Multi-Node

```bash
# Launch on 4 nodes with 8 GPUs each (32 total)
litgpt pretrain llama-2-7b \
  --devices 8 \
  --num_nodes 4 \
  --train.global_batch_size 1024 \
  --train.micro_batch_size 2 \
  --data RedPajama
```

**Memory calculation**:
- Llama 2 7B: ~28GB model + ~28GB gradients + ~56GB optimizer = 112GB total
- With FSDP on 32 GPUs: 112GB / 32 = 3.5GB per GPU ✅

## Fine-tuning with FSDP

### LoRA Fine-tuning (Recommended)

LoRA fine-tuning with FSDP for >7B models:

```bash
# Llama 2 70B LoRA on 8 GPUs
litgpt finetune_lora meta-llama/Llama-2-70b-hf \
  --devices 8 \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 16 \
  --train.micro_batch_size 1 \
  --lora_r 8
```

**Why LoRA with FSDP**:
- Base model sharded with FSDP (memory efficient)
- Only LoRA adapters trained (fast)
- Best of both worlds for large models

### Full Fine-tuning

Full fine-tuning with FSDP:

```bash
# Llama 2 7B full fine-tune on 4 GPUs
litgpt finetune_full meta-llama/Llama-2-7b-hf \
  --devices 4 \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 16 \
  --train.micro_batch_size 1 \
  --train.learning_rate 3e-5
```

## Mixed Precision

FSDP works with mixed precision for memory savings and speedup:

```bash
# BF16 mixed precision (recommended for A100/H100)
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --precision bf16-mixed

# FP16 mixed precision (V100 compatible)
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --precision 16-mixed
```

**Precision options**:
- `bf16-mixed`: BF16 for computation, FP32 for master weights (best for Ampere+)
- `16-mixed`: FP16 for computation, FP32 for master weights (V100)
- `32-true`: Full FP32 (debugging only, slow)

## Gradient Accumulation

Simulate larger batch sizes with gradient accumulation:

```bash
# Simulate global_batch_size=512 with micro_batch_size=2
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --train.global_batch_size 512 \
  --train.micro_batch_size 2
# Accumulates over 512/(8*2) = 32 steps per optimizer update
```

**Formula**:
```
Gradient accumulation steps = global_batch_size / (devices × micro_batch_size)
```

## Memory Optimization

### Out of Memory? Try These

1. **Increase devices**:
   ```bash
   --devices 8  # Instead of 4
   ```

2. **Reduce micro batch size**:
   ```bash
   --train.micro_batch_size 1  # Instead of 2
   ```

3. **Lower precision**:
   ```bash
   --precision bf16-mixed  # Instead of 32-true
   ```

4. **Use FULL_SHARD**:
   ```python
   strategy = FSDPStrategy(
       sharding_strategy="FULL_SHARD"  # Maximum memory savings
   )
   ```

5. **Enable activation checkpointing** (implemented in model):
   ```python
   # Recomputes activations during backward pass
   # Trades compute for memory
   ```

6. **Use QLoRA**:
   ```bash
   litgpt finetune_lora meta-llama/Llama-2-7b-hf \
     --quantize bnb.nf4 \
     --devices 1  # May not need FSDP with quantization
   ```

## Checkpointing

### Save Checkpoints

FSDP automatically handles checkpoint saving:

```bash
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --out_dir checkpoints/tinyllama-pretrain
# Saves to: checkpoints/tinyllama-pretrain/final/lit_model.pth
```

With `state_dict_type="full"` (default), rank 0 assembles full model and saves single file.

### Resume Training

```bash
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --resume checkpoints/tinyllama-pretrain/
# Automatically loads latest checkpoint
```

### Convert to HuggingFace

```bash
python scripts/convert_lit_checkpoint.py \
  --checkpoint_path checkpoints/tinyllama-pretrain/final/lit_model.pth \
  --output_dir models/tinyllama-hf
```

## Performance Tuning

### Communication Backends

LitGPT uses NCCL for GPU communication:

```bash
# Default (NCCL auto-configured)
litgpt pretrain tiny-llama-1.1b --devices 8

# Explicit NCCL settings (advanced)
NCCL_DEBUG=INFO \
NCCL_IB_DISABLE=0 \
litgpt pretrain tiny-llama-1.1b --devices 8
```

**NCCL Environment Variables**:
- `NCCL_DEBUG=INFO`: Enable debug logging
- `NCCL_IB_DISABLE=0`: Use InfiniBand (if available)
- `NCCL_SOCKET_IFNAME=eth0`: Specify network interface

### Multi-Node Setup

**Option 1: SLURM**

```bash
#!/bin/bash
#SBATCH --nodes=4
#SBATCH --gpus-per-node=8
#SBATCH --ntasks-per-node=1

srun litgpt pretrain llama-2-7b \
  --devices 8 \
  --num_nodes 4 \
  --data RedPajama
```

**Option 2: torchrun**

```bash
# On each node, run:
torchrun \
  --nproc_per_node=8 \
  --nnodes=4 \
  --node_rank=$NODE_RANK \
  --master_addr=$MASTER_ADDR \
  --master_port=29500 \
  -m litgpt pretrain llama-2-7b
```

### Profiling

Enable profiling to identify bottlenecks:

```bash
litgpt pretrain tiny-llama-1.1b \
  --devices 8 \
  --train.max_steps 100 \
  --profile
# Generates profiling report
```

## Example Configurations

### Llama 2 7B on 4× A100 (40GB)

```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --devices 4 \
  --precision bf16-mixed \
  --train.global_batch_size 64 \
  --train.micro_batch_size 4 \
  --train.max_seq_length 2048 \
  --lora_r 8 \
  --data JSON \
  --data.json_path data/alpaca.json
```

**Memory per GPU**: ~20GB
**Throughput**: ~5 samples/sec

### Llama 2 70B on 8× A100 (80GB)

```bash
litgpt finetune_lora meta-llama/Llama-2-70b-hf \
  --devices 8 \
  --precision bf16-mixed \
  --train.global_batch_size 32 \
  --train.micro_batch_size 1 \
  --train.max_seq_length 2048 \
  --lora_r 8 \
  --data JSON \
  --data.json_path data/alpaca.json
```

**Memory per GPU**: ~70GB
**Throughput**: ~1 sample/sec

### Llama 3 405B on 64× H100 (80GB)

```bash
litgpt finetune_lora meta-llama/Llama-3.1-405B \
  --devices 8 \
  --num_nodes 8 \
  --precision bf16-mixed \
  --train.global_batch_size 128 \
  --train.micro_batch_size 1 \
  --train.max_seq_length 4096 \
  --lora_r 16 \
  --data JSON \
  --data.json_path data/alpaca.json
```

**Memory per GPU**: ~60GB
**Requires**: 64 H100 GPUs (8 nodes × 8 GPUs)

## Troubleshooting

### "CUDA out of memory"

1. Reduce `micro_batch_size`
2. Increase `devices` (more sharding)
3. Lower `max_seq_length`
4. Use `bf16-mixed` precision
5. Try QLoRA (`--quantize bnb.nf4`)

### "NCCL error" or Slow Communication

1. Check network connectivity between nodes
2. Enable InfiniBand: `NCCL_IB_DISABLE=0`
3. Verify NCCL version: `python -c "import torch; print(torch.cuda.nccl.version())"`
4. Test with NCCL tests: `$NCCL_HOME/build/all_reduce_perf -b 8 -e 128M`

### Training Slower Than Expected

1. Profile with `--profile`
2. Check GPU utilization: `nvidia-smi dmon`
3. Verify data loading isn't bottleneck
4. Increase `micro_batch_size` if memory allows
5. Use Thunder FSDP with bucketing

## References

- FSDP configuration: `litgpt/pretrain.py:setup()`
- Thunder FSDP: `extensions/thunder/pretrain.py`
- Memory optimization guide: `tutorials/oom.md`
- Lightning Fabric docs: https://lightning.ai/docs/fabric/
