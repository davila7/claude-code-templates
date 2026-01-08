# Parallelism Strategies Guide

Complete guide to parallelism in Megatron-Core: when to use each strategy, performance characteristics, and configuration examples.

## Parallelism Types

### 1. Data Parallel (DP)

**How it works**: Replicate full model on each GPU, split data batches, synchronize gradients.

**Memory**: Low efficiency - full model replication
**Communication**: Low - only gradients (all-reduce)
**Scalability**: Good for small models

**When to use**:
- Models <1B parameters that fit on single GPU
- Plenty of GPUs available
- Limited model complexity

**Configuration**:
```bash
# 8 GPUs, no model parallelism
torchrun --nproc_per_node=8 train.py \
  --tensor-model-parallel-size 1 \
  --pipeline-model-parallel-size 1
# Implicit DP = 8
```

**Performance**:
- Near-linear scaling for small models
- 7B model on 8×A100: ~90% efficiency

### 2. Tensor Parallel (TP)

**How it works**: Split individual layers/tensors across GPUs (column/row partitioning of weight matrices).

**Memory**: Excellent - 1/N reduction per GPU
**Communication**: Very high - all-reduce after every layer
**Scalability**: Best ≤8 GPUs within single node (needs NVLink)

**When to use**:
- Models >10B parameters
- Have NVLink-connected GPUs
- Within single node (network latency kills performance across nodes)

**Configuration**:
```bash
# Split model across 4 GPUs with TP
torchrun --nproc_per_node=4 train.py \
  --tensor-model-parallel-size 4
```

**Performance**:
- **1 node (8 GPUs, NVLink)**: 85-95% efficiency
- **Across nodes**: <50% efficiency (avoid)

**Memory savings**:
```
LLaMA 70B without TP: 140GB (won't fit on 80GB GPU)
LLaMA 70B with TP=4: 35GB per GPU (fits easily)
```

**Communication volume** (70B model):
- Per layer: ~20GB all-reduce
- 80 layers × 20GB = 1.6TB total traffic
- With NVLink (600GB/s): Manageable
- With Ethernet (100Gb/s = 12.5GB/s): Too slow

### 3. Pipeline Parallel (PP)

**How it works**: Divide model layers into stages, assign stages to different GPUs, process microbatches in pipeline.

**Memory**: Very high - divide layers evenly
**Communication**: Low-medium - only activations between stages
**Scalability**: Good across nodes

**Pipeline Schedules**:

**GPipe** (simple but inefficient):
```
GPU0: F F F F ........ B B B B
GPU1: .... F F F F .... B B B B
GPU2: ........ F F F F B B B B
```
Bubble: 50% idle time

**1F1B** (one-forward-one-backward):
```
GPU0: F F F F B B B B B B B B
GPU1: .. F F F F B B B B B B B B
GPU2: .... F F F F B B B B B B B B
```
Bubble: ~25% idle time

**Interleaved 1F1B** (best):
```
GPU0: F1 F2 F3 F4 B1 B2 B3 B4 ...
GPU1: F1 F2 F3 F4 B1 B2 B3 B4 ...
```
Bubble: 5-10% idle time

**When to use**:
- Models >70B parameters
- Multi-node training
- Limited intra-node bandwidth

**Configuration**:
```bash
# 4-stage pipeline
torchrun --nproc_per_node=8 --nnodes=4 train.py \
  --pipeline-model-parallel-size 4 \
  --num-layers 80 \
  --num-layers-per-virtual-pipeline-stage 2  # Interleaved
```

**Performance**:
- Interleaved schedule: 90-95% efficiency
- Standard 1F1B: 75-85% efficiency

### 4. Sequence Parallel (SP)

**How it works**: Split sequence dimension across tensor-parallel GPUs, reduce activation memory.

**Memory**: Reduces activations by TP factor
**Communication**: Same as TP (already using all-reduce)
**Scalability**: Tied to TP

**When to use**:
- Long sequences (>4K tokens)
- Using TP already
- Activation memory is bottleneck

**Configuration**:
```bash
torchrun --nproc_per_node=8 train.py \
  --tensor-model-parallel-size 4 \
  --sequence-parallel  # Requires TP > 1
```

**Memory savings**:
```
70B model, 4K sequence, TP=4:
Without SP: 48GB activations per GPU
With SP: 12GB activations per GPU
Savings: 75%
```

### 5. Context Parallel (CP)

**How it works**: Split very long sequences across GPUs using Ring Attention.

**Memory**: Reduces KV cache and activations
**Communication**: Medium - ring communication pattern
**Scalability**: Good for >8K sequences

**When to use**:
- Sequences >8K tokens
- Long-context models (>32K)
- KV cache memory bottleneck

**Configuration**:
```bash
torchrun --nproc_per_node=8 train.py \
  --context-parallel-size 2 \
  --seq-length 32768  # 32K tokens
```

**Memory savings** (32K sequence):
```
Without CP: 64GB KV cache
With CP=4: 16GB KV cache per GPU
```

### 6. Expert Parallel (EP)

**How it works**: For MoE models, distribute different experts across GPUs.

**Memory**: Excellent - only store 1/N experts per GPU
**Communication**: Low - only route tokens to experts
**Scalability**: Matches number of experts

**When to use**:
- Mixture of Experts models
- Want model capacity without memory cost
- Have ≥8 GPUs

**Configuration**:
```bash
# Mixtral 8x7B: 8 experts
torchrun --nproc_per_node=8 train.py \
  --expert-model-parallel-size 4 \
  --num-experts 8 \
  --tensor-model-parallel-size 2
```

**Memory** (Mixtral 8×7B):
```
Without EP: 8 experts × 7B = 56GB
With EP=4: 2 experts × 7B = 14GB
Savings: 75%
```

## Combining Parallelism Strategies

### 3D Parallelism (TP + PP + DP)

Standard for large models.

**LLaMA 3 70B on 64 GPUs**:
```bash
TP=4  # Within each node
PP=4  # Across nodes
DP=4  # Remaining dimension
Total = 4 × 4 × 4 = 64 GPUs
```

**Memory per GPU**: 70B / 4 (TP) / 4 (PP) = 4.4B params ≈ 20GB

**Configuration**:
```bash
torchrun --nproc_per_node=8 --nnodes=8 train.py \
  --tensor-model-parallel-size 4 \
  --pipeline-model-parallel-size 4
  # DP is implicit: 64 / (4*4) = 4
```

### 4D Parallelism (TP + PP + DP + CP)

For very large models or long context.

**LLaMA 3 405B on 256 GPUs**:
```bash
TP=8   # Max NVLink
PP=8   # Across nodes
CP=2   # Long sequences
DP=2   # Remaining
Total = 8 × 8 × 2 × 2 = 256 GPUs
```

**Configuration**:
```bash
torchrun --nproc_per_node=8 --nnodes=32 train.py \
  --tensor-model-parallel-size 8 \
  --pipeline-model-parallel-size 8 \
  --context-parallel-size 2
```

### 4D + EP (5D Parallelism)

For sparse MoE models.

**DeepSeek-V3 671B (37B active) on 1024 GPUs**:
```bash
TP=2   # Limited by active params
PP=16  # Many stages
EP=64  # 256 experts / 4 experts per GPU
DP=2   # Small data parallel
Total = 2 × 16 × 64 × 2 = 4096 (uses 1024 in practice)
```

## Decision Guide

### By Model Size

| Model Size | GPUs | Recommended Strategy |
|------------|------|---------------------|
| <1B | 1-8 | DP only |
| 1-10B | 8-16 | TP=2-4 + DP |
| 10-70B | 16-64 | TP=4 + PP=2-4 + DP |
| 70-175B | 64-256 | TP=8 + PP=4-8 + DP |
| 175-500B | 256-1024 | TP=8 + PP=8-16 + CP=2 + DP |
| 500B+ | 1024+ | 4D or 5D (with EP) |

### By Hardware Topology

**Single node (8 GPUs with NVLink)**:
```bash
# Up to 70B
TP=8  # Use all NVLink bandwidth
```

**Multiple nodes (InfiniBand)**:
```bash
# Minimize cross-node communication
TP=8      # Within node only
PP=N      # Across nodes
DP=remaining
```

**Limited network (Ethernet)**:
```bash
# Avoid TP across nodes
TP=1-4    # Within node
PP=many   # PP has low communication
```

### By Sequence Length

| Sequence | Parallelism |
|----------|------------|
| <2K | Standard (TP + PP + DP) |
| 2K-8K | + SP (sequence parallel) |
| 8K-32K | + CP=2 (context parallel) |
| 32K+ | + CP=4-8 |

## Performance Characteristics

### Communication Volume (per iteration)

**Data Parallel**: O(model_size) - all-reduce gradients
**Tensor Parallel**: O(model_size × layers) - all-reduce per layer
**Pipeline Parallel**: O(batch × hidden × layers/stages) - activations only
**Context Parallel**: O(sequence × hidden) - ring communication

### Memory Breakdown (70B model example)

Without parallelism:
```
Model parameters: 140GB (FP16)
Gradients: 140GB
Optimizer states: 280GB (Adam)
Activations: 48GB (batch=1, seq=4K)
Total: 608GB (won't fit!)
```

With TP=4, PP=4, DP=4 (64 GPUs):
```
Parameters: 140GB / 4 / 4 = 8.75GB per GPU
Gradients: 8.75GB per GPU
Optimizer: 17.5GB per GPU
Activations: 48GB / 4 / 4 = 3GB per GPU
Total: ~38GB per GPU (fits on A100 80GB)
```

## Best Practices

1. **Start with TP within single node**
   ```bash
   --tensor-model-parallel-size 8  # Use all NVLink
   ```

2. **Add PP for cross-node scaling**
   ```bash
   --pipeline-model-parallel-size 4
   --num-layers-per-virtual-pipeline-stage 2  # Interleaved
   ```

3. **Enable SP when using TP**
   ```bash
   --sequence-parallel  # Free activation savings
   ```

4. **Use CP for long sequences**
   ```bash
   --context-parallel-size 2  # If seq_len > 8K
   ```

5. **Avoid TP across nodes** (network latency kills performance)

6. **Match TP to GPU topology** (TP=8 for 8-GPU nodes)

7. **Profile first iteration** to check memory and communication:
   ```bash
   --profile  # Enable profiling
   --profile-ranks 0  # Profile first rank only
   ```

## Troubleshooting

**High communication overhead (low MFU)**:
- Reduce TP degree (especially across nodes)
- Increase PP degree instead
- Enable interleaved pipeline schedule

**Out of memory**:
- Increase TP/PP (split model more)
- Enable gradient checkpointing:
  ```bash
  --recompute-granularity full
  --recompute-method block
  ```
- Reduce micro-batch size

**Pipeline bubbles (low GPU util)**:
- Use interleaved schedule:
  ```bash
  --num-layers-per-virtual-pipeline-stage 2
  ```
- Increase number of microbatches:
  ```bash
  --global-batch-size 1024
  --micro-batch-size 1  # More microbatches = smaller bubbles
  ```

**Load imbalance in MoE**:
- Tune load balancing:
  ```bash
  --moe-router-load-balancing-type aux_loss
  --moe-aux-loss-coeff 0.01
  ```
- Increase expert parallel degree:
  ```bash
  --expert-model-parallel-size 8  # More experts per GPU
  ```
