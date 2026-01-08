# MoE Training Guide

Complete training guide based on DeepSpeed official documentation and production practices.

## Table of Contents
- DeepSpeed MoE Setup
- Training Configuration
- PR-MoE (Pyramid-Residual-MoE)
- Mixture-of-Students (MoS)
- Hyperparameter Tuning
- Production Training

## DeepSpeed MoE Setup

**Source**: DeepSpeed MoE Tutorial (https://www.deepspeed.ai/tutorials/mixture-of-experts-nlg/)

### Requirements

```bash
# Install DeepSpeed v0.6.0 or higher
pip install deepspeed>=0.6.0

# Clone Megatron-DeepSpeed
git clone https://github.com/microsoft/Megatron-DeepSpeed
cd Megatron-DeepSpeed
pip install -r requirements.txt
```

### Basic MoE Configuration

```json
{
  "train_batch_size": 256,
  "gradient_accumulation_steps": 1,
  "fp16": {
    "enabled": true,
    "loss_scale": 0,
    "initial_scale_power": 16
  },
  "moe": {
    "enabled": true,
    "num_experts": 128,
    "expert_parallel_size": 8,
    "moe_loss_coeff": 0.01,
    "train_capacity_factor": 1.25,
    "eval_capacity_factor": 2.0,
    "min_capacity": 4,
    "drop_tokens": true
  },
  "zero_optimization": {
    "stage": 1
  }
}
```

## Training Parameters

### Core MoE Parameters

**From DeepSpeed documentation:**

1. **`--num-experts`**
   - Number of experts per MoE layer
   - Recommended: 128 experts
   - Range: 8-256 depending on scale

2. **`--moe-expert-parallel-size`**
   - Degree of expert parallelism
   - Distributes experts across GPUs
   - Example: 128 experts / 8 GPUs = 16 experts per GPU

3. **`--moe-loss-coeff`**
   - MoE auxiliary loss coefficient
   - Recommended: 0.01
   - Controls load balancing strength

4. **`--moe-train-capacity-factor`**
   - Training capacity multiplier
   - Default: 1.25
   - Formula: capacity = (tokens/num_experts) × capacity_factor

5. **`--moe-eval-capacity-factor`**
   - Evaluation capacity multiplier
   - Default: 2.0 (no token dropping during eval)

6. **`--moe-min-capacity`**
   - Minimum expert capacity
   - Default: 4
   - Ensures each expert processes minimum tokens

7. **`--disable-moe-token-dropping`**
   - Remove expert capacity limits
   - All tokens processed (no dropping)
   - May increase memory usage

### Example Training Script

```bash
#!/bin/bash

deepspeed --num_gpus 8 pretrain_gpt_moe.py \
  --tensor-model-parallel-size 1 \
  --pipeline-model-parallel-size 1 \
  --num-layers 24 \
  --hidden-size 1024 \
  --num-attention-heads 16 \
  --seq-length 2048 \
  --max-position-embeddings 2048 \
  --micro-batch-size 4 \
  --global-batch-size 256 \
  --train-iters 500000 \
  --lr 0.0001 \
  --min-lr 0.00001 \
  --lr-decay-style cosine \
  --lr-warmup-iters 2000 \
  --clip-grad 1.0 \
  --weight-decay 0.1 \
  --num-experts 128 \
  --moe-expert-parallel-size 8 \
  --moe-loss-coeff 0.01 \
  --moe-train-capacity-factor 1.25 \
  --moe-eval-capacity-factor 2.0 \
  --moe-min-capacity 4 \
  --fp16 \
  --deepspeed \
  --deepspeed_config ds_config_moe.json \
  --data-path /path/to/data \
  --vocab-file /path/to/vocab.json \
  --merge-file /path/to/merges.txt \
  --save-interval 5000 \
  --eval-interval 1000 \
  --eval-iters 100
```

## PR-MoE: Pyramid-Residual-MoE

**Source**: DeepSpeed documentation - improves parameter efficiency 3× over standard MoE

### Architecture

PR-MoE uses:
- Varying number of experts per layer (pyramid structure)
- Residual connections between expert layers
- Better parameter efficiency

### Configuration

```bash
# PR-MoE specific parameters
--num-experts "[128, 64, 32, 16]" \  # Pyramid: different experts per layer
--mlp-type residual \                # Use residual connections
--moe-expert-parallel-size 4 \
--moe-loss-coeff 0.01
```

### Full PR-MoE Training

```bash
deepspeed --num_gpus 8 pretrain_gpt_moe.py \
  --num-layers 24 \
  --hidden-size 1024 \
  --num-attention-heads 16 \
  --seq-length 2048 \
  --max-position-embeddings 2048 \
  --micro-batch-size 4 \
  --global-batch-size 256 \
  --num-experts "[128, 64, 32, 16]" \  # Pyramid structure
  --mlp-type residual \                # Residual MoE
  --moe-expert-parallel-size 4 \
  --moe-loss-coeff 0.01 \
  --moe-train-capacity-factor 1.25 \
  --fp16 \
  --deepspeed \
  --deepspeed_config ds_config_moe.json \
  --data-path /path/to/data \
  --save-interval 5000
```

**Benefits**:
- 3× better parameter efficiency vs standard MoE
- Fewer total parameters for same performance
- Better gradient flow with residual connections

## Mixture-of-Students (MoS)

**Source**: DeepSpeed documentation - knowledge distillation for MoE

### Overview

MoS = MoE + Knowledge Distillation
- Student: MoE model (being trained)
- Teacher: Dense model (pre-trained)
- Transfers knowledge from dense teacher to sparse MoE student

### Configuration

```bash
# MoS parameters
--mos \                              # Enable MoS distillation
--load-teacher /path/to/teacher \    # Teacher model checkpoint
--teacher-forward \                  # Enable teacher forward pass
--teacher-model-parallel-size 1
```

### Full MoS Training

```bash
deepspeed --num_gpus 8 pretrain_gpt_moe.py \
  --num-layers 24 \
  --hidden-size 1024 \
  --num-attention-heads 16 \
  --num-experts 128 \
  --moe-expert-parallel-size 8 \
  --moe-loss-coeff 0.01 \
  --mos \                                    # Enable MoS
  --load-teacher /path/to/dense/teacher \    # Teacher checkpoint
  --teacher-forward \
  --teacher-model-parallel-size 1 \
  --fp16 \
  --deepspeed \
  --deepspeed_config ds_config_moe.json \
  --data-path /path/to/data
```

### Staged Distillation

**Recommended**: Stop distillation early

```python
# In training loop
if iteration < 400000:
    # Use MoS (distillation)
    loss = moe_loss + distillation_loss
else:
    # Stop distillation, train MoE only
    loss = moe_loss
```

**Benefits**:
- Faster convergence
- Better final performance
- Preserves teacher knowledge while allowing MoE specialization

## Hyperparameter Tuning

### Learning Rate

**Key insight**: MoE needs lower LR than dense models

```bash
# Dense model
--lr 0.0006 \
--min-lr 0.00006

# MoE model (3-6× lower)
--lr 0.0001 \        # Lower!
--min-lr 0.00001
```

### LR Decay

**Extend decay schedule** for MoE:

```bash
# Dense model
--lr-decay-iters 300000 \
--lr-warmup-iters 2000

# MoE model (1.5-2× longer)
--lr-decay-iters 500000 \   # Extended!
--lr-warmup-iters 2000
```

### Capacity Factor

**Tune based on memory/speed tradeoff**:

```json
{
  "moe": {
    // Training: Lower capacity (faster, drops tokens)
    "train_capacity_factor": 1.0,   // Aggressive
    "train_capacity_factor": 1.25,  // Balanced (recommended)
    "train_capacity_factor": 1.5,   // Conservative

    // Evaluation: Higher capacity (no dropping)
    "eval_capacity_factor": 2.0     // Standard
  }
}
```

### Load Balancing Coefficient

```json
{
  "moe": {
    "moe_loss_coeff": 0.001,  // Weak balancing
    "moe_loss_coeff": 0.01,   // Standard (recommended)
    "moe_loss_coeff": 0.1     // Strong balancing
  }
}
```

**Rule**: If load imbalance persists, increase coefficient

## Production Training

### Performance Benchmarks

**From DeepSpeed documentation:**

Standard MoE:
- **5× training cost reduction** vs dense model
- **3× model size reduction** with PR-MoE

Example:
- Dense 13B model: 100% cost
- MoE 13B (128 experts): 20% cost (5× faster)
- PR-MoE 13B: 15% cost + 3× fewer params

### Recommended Dataset

**The Pile** - publicly available training dataset
- 800GB of diverse text
- Standard benchmark for MoE training
- Used in DeepSpeed examples

### Example Configs

**Small MoE (8 experts)**:

```bash
deepspeed --num_gpus 4 pretrain_gpt_moe.py \
  --num-layers 12 \
  --hidden-size 768 \
  --num-attention-heads 12 \
  --num-experts 8 \
  --moe-expert-parallel-size 2 \
  --global-batch-size 128 \
  --fp16
```

**Medium MoE (64 experts)**:

```bash
deepspeed --num_gpus 16 pretrain_gpt_moe.py \
  --num-layers 24 \
  --hidden-size 1024 \
  --num-attention-heads 16 \
  --num-experts 64 \
  --moe-expert-parallel-size 8 \
  --global-batch-size 256 \
  --fp16
```

**Large MoE (128 experts)**:

```bash
deepspeed --num_gpus 32 pretrain_gpt_moe.py \
  --num-layers 32 \
  --hidden-size 2048 \
  --num-attention-heads 32 \
  --num-experts 128 \
  --moe-expert-parallel-size 16 \
  --global-batch-size 512 \
  --fp16
```

### Monitoring

Key metrics to track:

```python
# Expert load balance
expert_counts = [expert.token_count for expert in experts]
load_imbalance = max(expert_counts) / min(expert_counts)

# Should be close to 1.0 (perfectly balanced)
# If > 2.0, increase moe_loss_coeff

# Expert utilization
utilized_experts = sum(count > 0 for count in expert_counts)
utilization_rate = utilized_experts / num_experts

# Should be close to 1.0 (all experts used)

# Token dropping rate
dropped_tokens = total_tokens - processed_tokens
drop_rate = dropped_tokens / total_tokens

# Should be low (<5%) during training
```

## Troubleshooting

### Issue: Load Imbalance

**Symptoms**: Some experts get most tokens

**Solutions**:
1. Increase `moe_loss_coeff` (0.01 → 0.1)
2. Reduce `train_capacity_factor` (forces redistribution)
3. Add noise to router logits (gating network)

### Issue: High Memory Usage

**Solutions**:
1. Enable ZeRO Stage 1 or 2
2. Reduce `train_capacity_factor`
3. Enable `drop_tokens`
4. Increase `moe_expert_parallel_size`

### Issue: Unstable Training

**Solutions**:
1. Lower learning rate
2. Increase warmup steps
3. Use gradient clipping (`--clip-grad 1.0`)
4. Reduce router z-loss coefficient

## Resources

- **DeepSpeed MoE Tutorial**: https://www.deepspeed.ai/tutorials/mixture-of-experts-nlg/
- **Megatron-DeepSpeed**: https://github.com/microsoft/Megatron-DeepSpeed
- **Example Scripts**: `examples_deepspeed/MoE/`
