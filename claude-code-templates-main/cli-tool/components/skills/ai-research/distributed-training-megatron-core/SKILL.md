---
name: training-llms-megatron
description: Trains large language models (2B-462B parameters) using NVIDIA Megatron-Core with advanced parallelism strategies. Use when training models >1B parameters, need maximum GPU efficiency (47% MFU on H100), or require tensor/pipeline/sequence/context/expert parallelism. Production-ready framework used for Nemotron, LLaMA, DeepSeek.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Megatron-Core, Large-Scale Training, NVIDIA, Tensor Parallelism, Pipeline Parallelism, Model Parallelism, H100, Distributed Training, Production]
dependencies: [megatron-core, torch, apex, transformer-engine]
---

# Megatron-Core - Large-Scale LLM Training

## Quick start

Megatron-Core trains LLMs from 2B to 462B parameters with up to 47% Model FLOP Utilization on H100 GPUs through advanced parallelism strategies.

**Installation**:
```bash
# Docker (recommended)
docker run --gpus all -it --rm nvcr.io/nvidia/pytorch:25.04-py3

# Or pip
pip install megatron-core
```

**Simple distributed training**:
```bash
# Train with 2 GPUs using data parallelism
torchrun --nproc_per_node=2 examples/run_simple_mcore_train_loop.py

# Or LLaMA-3 8B training
./examples/llama/train_llama3_8b_fp8.sh
```

## Common workflows

### Workflow 1: Train LLaMA-style model with 3D parallelism

Copy this checklist:

```
LLaMA Training Setup:
- [ ] Step 1: Choose parallelism configuration
- [ ] Step 2: Configure training hyperparameters
- [ ] Step 3: Launch distributed training
- [ ] Step 4: Monitor performance metrics
```

**Step 1: Choose parallelism configuration**

Model size determines parallelism strategy:

| Model Size | GPUs | Tensor Parallel | Pipeline Parallel | Data Parallel | Context Parallel |
|------------|------|-----------------|-------------------|---------------|------------------|
| 7B | 8 | 1 | 1 | 8 | 1 |
| 13B | 8 | 2 | 1 | 4 | 1 |
| 70B | 64 | 4 | 4 | 4 | 1 |
| 405B | 128 | 8 | 8 | 2 | 2 |

**Step 2: Configure training hyperparameters**

```bash
#!/bin/bash
# train_llama_70b.sh

GPUS_PER_NODE=8
NNODES=8  # 64 GPUs total
TP=4      # Tensor parallel
PP=4      # Pipeline parallel
CP=1      # Context parallel

# LLaMA 70B configuration
MODEL_SIZE=70  # Billion parameters
HIDDEN_SIZE=8192
NUM_LAYERS=80
NUM_HEADS=64
SEQ_LENGTH=4096

# Training hyperparameters
MICRO_BATCH=1
GLOBAL_BATCH=1024
LR=3e-4

torchrun \
  --nproc_per_node=$GPUS_PER_NODE \
  --nnodes=$NNODES \
  pretrain_gpt.py \
  --tensor-model-parallel-size $TP \
  --pipeline-model-parallel-size $PP \
  --context-parallel-size $CP \
  --sequence-parallel \
  --num-layers $NUM_LAYERS \
  --hidden-size $HIDDEN_SIZE \
  --num-attention-heads $NUM_HEADS \
  --seq-length $SEQ_LENGTH \
  --max-position-embeddings $SEQ_LENGTH \
  --micro-batch-size $MICRO_BATCH \
  --global-batch-size $GLOBAL_BATCH \
  --lr $LR \
  --train-iters 100000 \
  --lr-decay-style cosine \
  --lr-warmup-iters 2000 \
  --weight-decay 0.1 \
  --clip-grad 1.0 \
  --bf16 \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --data-path /path/to/data \
  --vocab-file /path/to/vocab.json \
  --merge-file /path/to/merges.txt
```

**Step 3: Launch distributed training**

```bash
# Single node (8 GPUs)
bash train_llama_70b.sh

# Multi-node with SLURM
sbatch --nodes=8 --gpus-per-node=8 train_llama_70b.sh
```

**Step 4: Monitor performance metrics**

Key metrics to track:
```
Model FLOP Utilization (MFU): Target >40% on H100
Throughput: Tokens/sec/GPU
Memory usage: <80GB per GPU for 70B model
Loss: Should decrease steadily
```

### Workflow 2: Configure Mixture of Experts (MoE) training

For sparse MoE models like Mixtral.

```
MoE Training:
- [ ] Step 1: Configure expert parallelism
- [ ] Step 2: Set MoE hyperparameters
- [ ] Step 3: Launch training with EP
```

**Step 1: Configure expert parallelism**

```bash
# Mixtral 8x7B example
TENSOR_PARALLEL=2
PIPELINE_PARALLEL=1
EXPERT_PARALLEL=4  # Split 8 experts across 4 GPUs
DATA_PARALLEL=4

TOTAL_GPUS=$((TENSOR_PARALLEL * PIPELINE_PARALLEL * EXPERT_PARALLEL * DATA_PARALLEL))
# = 2 * 1 * 4 * 4 = 32 GPUs
```

**Step 2: Set MoE hyperparameters**

```bash
torchrun \
  --nproc_per_node=8 \
  pretrain_gpt.py \
  --tensor-model-parallel-size 2 \
  --pipeline-model-parallel-size 1 \
  --expert-model-parallel-size 4 \
  --num-experts 8 \
  --moe-router-topk 2 \
  --moe-router-load-balancing-type aux_loss \
  --moe-aux-loss-coeff 0.01 \
  --hidden-size 4096 \
  --num-layers 32 \
  --num-attention-heads 32 \
  --seq-length 4096 \
  --max-position-embeddings 4096 \
  --bf16 \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --data-path /path/to/data \
  --vocab-file /path/to/vocab.json \
  --merge-file /path/to/merges.txt
```

**Step 3: Launch training with EP**

Expert parallelism distributes different experts across GPUs, reducing memory while maintaining capacity.

```
Memory without EP: 8 experts × 7B = 56GB per GPU
Memory with EP=4: 2 experts × 7B = 14GB per GPU
Savings: 75% memory reduction
```

### Workflow 3: Optimize for maximum throughput

Achieve 47% MFU on H100.

```
Performance Optimization:
- [ ] Step 1: Enable Flash Attention
- [ ] Step 2: Use FP8 precision (H100)
- [ ] Step 3: Optimize micro-batch size
- [ ] Step 4: Tune parallelism degrees
```

**Step 1: Enable optimizations**

```bash
--use-mcore-models  # Use Megatron Core models
--transformer-impl transformer_engine  # Use Transformer Engine
--sequence-parallel  # Reduce activation memory (use with TP)
```

**Step 2: Use FP8 precision (H100 only)**

```bash
--fp8-hybrid  # FP8 mixed precision training
# Transformer Engine handles FP8 automatically
```

Result: 1.5-2x speedup on H100 vs BF16.

**Step 3: Optimize micro-batch size**

Find largest micro-batch that fits in memory:

```bash
# Start with 1, increase until OOM
for MBS in 1 2 4 8; do
  echo "Testing micro-batch-size=$MBS"
  torchrun ... --micro-batch-size $MBS
done
```

Typical values:
- 7B model: 4-8
- 70B model: 1-2
- 405B model: 1

**Step 4: Tune parallelism degrees**

Rules of thumb:
```
Tensor Parallel: Use ≤8 (limited by NVLink within node)
Pipeline Parallel: Use for >70B models
Context Parallel: Use for sequences >8K tokens
Data Parallel: Fill remaining GPUs
```

Example 405B on 128 H100s:
```
TP=8 (1 node)
PP=8 (across nodes)
CP=2 (long sequences)
DP=1
Total = 8 × 8 × 2 × 1 = 128 GPUs
```

## When to use vs alternatives

**Use Megatron-Core when:**
- Training models >10B parameters
- Need maximum efficiency (target >40% MFU)
- Using NVIDIA GPUs (A100, H100)
- Production training at scale
- Want fine-grained parallelism control

**Use alternatives instead:**
- **PyTorch FSDP**: Models <70B, simpler API, PyTorch native
- **DeepSpeed**: Easier setup, good for <100B models
- **HuggingFace Accelerate**: Prototyping, simpler workflows
- **LitGPT**: Educational, single-file implementations

## Common issues

**Issue: Low GPU utilization (<30% MFU)**

Causes:
1. Micro-batch too small
2. Too much parallelism overhead
3. Not using Flash Attention

Fixes:
```bash
# Increase micro-batch
--micro-batch-size 4  # Was 1

# Enable optimizations
--use-flash-attn
--sequence-parallel

# Reduce TP if >8
--tensor-model-parallel-size 4  # Was 16
```

**Issue: Out of memory**

Reduce memory with:
```bash
--tensor-model-parallel-size 2  # Split model across GPUs
--recompute-granularity full  # Gradient checkpointing
--recompute-method block  # Checkpoint transformer blocks
--recompute-num-layers 1  # Checkpoint every layer
```

Or use CPU/NVMe offloading:
```bash
--cpu-optimizer  # Offload optimizer to CPU
--cpu-optimizer-type ADAM  # CPU Adam variant
```

**Issue: Training slower than expected**

Check:
1. **Network bottleneck**: Ensure InfiniBand/NVLink enabled
2. **Pipeline bubbles**: Use interleaved pipeline schedule
   ```bash
   --num-layers-per-virtual-pipeline-stage 2
   ```
3. **Data loading**: Use fast data loader
   ```bash
   --dataloader-type cyclic
   ```

**Issue: Diverging loss**

Stabilize training:
```bash
--lr-warmup-iters 2000  # Longer warmup
--clip-grad 1.0  # Gradient clipping
--init-method-std 0.006  # Smaller init
--attention-dropout 0.0  # No dropout in attention
--hidden-dropout 0.0  # No dropout in FFN
```

## Advanced topics

**Parallelism strategies**: See [references/parallelism-guide.md](references/parallelism-guide.md) for detailed comparison of TP/PP/DP/CP/EP with performance analysis and when to use each.

**Performance benchmarks**: See [references/benchmarks.md](references/benchmarks.md) for MFU numbers across different model sizes and GPU configurations.

**Production configurations**: See [references/production-examples.md](references/production-examples.md) for real-world setups from LLaMA 3 405B, Nemotron-4 340B, and DeepSeek-V3 671B.

**Training recipes**: See [references/training-recipes.md](references/training-recipes.md) for complete hyperparameter configurations for GPT/LLaMA/Mixtral architectures.

## Hardware requirements

- **GPU**: NVIDIA Ampere+ (A100, H100, B200)
  - Turing works but slower
  - FP8 requires Hopper/Ada/Blackwell
- **Network**: InfiniBand or 400Gb+ Ethernet for multi-node
- **Memory per GPU**:
  - 7B model: 40GB+
  - 70B model: 80GB (with TP=4)
  - 405B model: 80GB (with TP=8, PP=8)
- **Storage**: Fast NVMe for checkpoints (1TB+ for 70B+ models)

## Resources

- Docs: https://docs.nvidia.com/megatron-core/
- GitHub: https://github.com/NVIDIA/Megatron-LM
- Papers:
  - "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism" (2019)
  - "Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM" (2021)
- NeMo Framework: https://docs.nvidia.com/nemo-framework/ (built on Megatron-Core)


