---
name: miles-rl-training
description: Provides guidance for enterprise-grade RL training using miles, a production-ready fork of slime. Use when training large MoE models with FP8/INT4, needing train-inference alignment, or requiring speculative RL for maximum throughput.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Reinforcement Learning, MoE, FP8, INT4, Enterprise, SGLang, Megatron-LM]
dependencies: [sglang-router>=0.2.3, ray, torch>=2.0.0, transformers>=4.40.0]
---

# miles: Enterprise-Grade RL for Large-Scale Model Training

miles is a high-performance, enterprise-ready RL framework optimized for large-scale model post-training. Built as a production fork of slime, it addresses critical challenges in MoE training stability, low-precision training, and train-inference alignment.

## When to Use miles

**Choose miles when you need:**
- Training 1TB+ MoE models (DeepSeek V3, Qwen3-MoE)
- FP8 or INT4 quantization-aware training
- Bit-wise identical train-inference alignment
- Speculative RL for maximum throughput
- Production stability with enterprise support

**Consider alternatives when:**
- You want the research-grade original → use **slime**
- You need flexible backend swapping → use **verl**
- You want PyTorch-native abstractions → use **torchforge**

## Key Features

### Low-Precision Training
- **Unified FP8**: End-to-end FP8 for both inference and training
- **INT4 QAT**: 1TB models on single-machine VRAM (H200)
- **Rollout Routing Replay (R3)**: Bit-wise expert alignment for MoE

### Performance Optimizations
- **Speculative RL**: 25%+ rollout speedup with online SFT draft models
- **Zero-Copy Weight Sync**: CUDA IPC zero-copy mapping
- **Partial Rollout**: Recycle half-finished trajectories

### Train-Inference Alignment
- **TIS/MIS**: Truncated/Masked Importance Sampling for off-policy correction
- **Kernel-level optimization**: FlashAttention-3, DeepGEMM integration

## Installation

```bash
# Recommended: Docker
docker pull radixark/miles:latest
docker run --rm --gpus all --ipc=host --shm-size=16g \
  -it radixark/miles:latest /bin/bash

# From source
git clone https://github.com/radixark/miles.git
cd miles
pip install -r requirements.txt
pip install -e .
```

## Quick Start

miles inherits slime's configuration system. Basic training:

```bash
python train.py \
    --advantage-estimator grpo \
    --model-name qwen3-30b-a3b \
    --hf-checkpoint /path/to/qwen3-30b-a3b-hf \
    --rollout-batch-size 512 \
    --n-samples-per-prompt 8
```

---

## Workflow 1: Large MoE Training

Use this workflow for training large MoE models like DeepSeek V3 or Qwen3-MoE.

### Prerequisites Checklist
- [ ] H100/H200 GPUs with FP8 support
- [ ] MoE model (DeepSeek V3, Qwen3-MoE)
- [ ] Docker environment with miles

### Step 1: Environment Setup

```bash
# FP8 block scaling (recommended for stability)
export NVTE_FP8_BLOCK_SCALING_FP32_SCALES=1
export CUDA_DEVICE_MAX_CONNECTIONS=1
```

### Step 2: Configure Training

```bash
python train.py \
    --actor-num-gpus-per-node 8 \
    --rollout-num-gpus 8 \
    --hf-checkpoint /path/to/deepseek-v3 \
    --advantage-estimator grpo \
    --tensor-model-parallel-size 8 \
    --expert-model-parallel-size 4 \
    --prompt-data /path/to/data.jsonl \
    --num-rollout 3000
```

### Verification Checklist
- [ ] Model loads without errors
- [ ] Routing decisions are consistent
- [ ] No NaN/Inf in loss values

---

## Workflow 2: Speculative RL Training

Use this workflow for maximum rollout throughput with EAGLE speculative decoding.

### How Speculative RL Works

1. Small draft model generates candidate tokens
2. Target model verifies in parallel
3. Draft model updated via online SFT to track policy

### Step 1: Enable Speculative Decoding

miles supports EAGLE speculative decoding via SGLang:

```bash
python train.py \
    --actor-num-gpus-per-node 8 \
    --hf-checkpoint /path/to/target-model \
    --sglang-speculative-algorithm EAGLE \
    --sglang-speculative-num-steps 3 \
    --sglang-speculative-eagle-topk 1 \
    --sglang-speculative-num-draft-tokens 4 \
    --sglang-speculative-draft-model-path /path/to/draft-model \
    --advantage-estimator grpo \
    --prompt-data /path/to/data.jsonl
```

### Step 2: Enable Online MTP Training (Optional)

For online SFT of draft model during training:

```bash
--mtp-num-layers 1 \
--enable-mtp-training \
--mtp-loss-scaling-factor 0.2
```

**Note**: Online MTP training requires a torch dist checkpoint with MTP weights. Add `--mtp-num-layers 1` during checkpoint conversion from HuggingFace.

### Expected Speedup

- **Standard rollout**: Baseline
- **Speculative RL**: 25-40% faster rollout
- **With partial rollout**: Additional 10-15% throughput

---

## Configuration Reference

miles inherits all slime arguments. See [slime API Reference](../slime/references/api-reference.md) for the complete list.

### Cluster Resources (from slime)

```bash
--actor-num-nodes 1
--actor-num-gpus-per-node 8
--rollout-num-gpus 8
--rollout-num-gpus-per-engine 2
--colocate
```

### Megatron Parallelism (from slime)

```bash
--tensor-model-parallel-size 8
--pipeline-model-parallel-size 2
--expert-model-parallel-size 4    # MoE expert parallelism
```

### Speculative Decoding (miles-specific)

```bash
--sglang-speculative-algorithm EAGLE
--sglang-speculative-num-steps 3
--sglang-speculative-eagle-topk 1
--sglang-speculative-num-draft-tokens 4
--sglang-enable-draft-weights-cpu-backup
--sglang-speculative-draft-model-path /your/draft/model/path
```

### Online MTP Training (miles-specific)

```bash
--mtp-num-layers 1
--enable-mtp-training
--mtp-loss-scaling-factor 0.2
```

---

## Key Features (Conceptual)

The following features are documented in miles but specific CLI flags may vary. Consult the miles repository for latest configuration.

### Unified FP8 Pipeline

End-to-end FP8 sampling and training that eliminates quantization-induced discrepancy causing RL collapse in MoE models.

### Rollout Routing Replay (R3)

Records expert routing decisions during SGLang inference and replays them during Megatron training for bit-wise expert alignment.

**How R3 Works**:
1. During SGLang inference, expert routing decisions are recorded
2. Routing decisions stored in `sample.rollout_routed_experts`
3. During Megatron training, routing is replayed instead of recomputed
4. Ensures identical expert selection between train and inference

### INT4 Quantization-Aware Training

Enables single-machine deployment of 1TB+ models (e.g., on H200).

**Memory Savings with INT4**:

| Model Size | BF16 VRAM | INT4 VRAM | Reduction |
|------------|-----------|-----------|-----------|
| 70B | 140GB | 45GB | 3.1x |
| 235B | 470GB | 150GB | 3.1x |
| 671B | 1.3TB | 420GB | 3.1x |

### Train-Inference Alignment

miles achieves "exactly 0 KL divergence" between training and inference through:
- Flash Attention 3
- DeepGEMM
- Batch-invariant kernels from Thinking Machines Lab
- `torch.compile` integration

---

## Sample Data Structure

miles uses the same `Sample` dataclass as slime with the `rollout_routed_experts` field for MoE routing replay:

```python
@dataclass
class Sample:
    prompt: str | list[dict]
    tokens: list[int]
    response: str
    reward: float | dict
    loss_mask: list[int]
    status: Status
    metadata: dict
    rollout_log_probs: list[float]
    rollout_routed_experts: list[list[int]]  # MoE routing for R3
```

See [slime API Reference](../slime/references/api-reference.md) for the complete Sample definition.

---

## Common Issues and Solutions

### Issue: FP8 Training Collapse

**Symptoms**: Loss explodes, NaN values

**Solutions**:
- Use block scaling: `export NVTE_FP8_BLOCK_SCALING_FP32_SCALES=1`
- Reduce learning rate: `--lr 5e-7`
- Ensure MoE routing is consistent between train/inference

### Issue: Speculative Draft Drift

**Symptoms**: Low acceptance rate over time

**Solutions**:
- Enable online MTP training to keep draft model aligned
- Reduce speculative steps: `--sglang-speculative-num-steps 2`
- Use CPU backup: `--sglang-enable-draft-weights-cpu-backup`

### Issue: Train-Inference Mismatch

**Symptoms**: Policy divergence, reward collapse

**Solutions**:
- Use TIS for off-policy correction: `--use-tis --tis-threshold 0.9`
- Verify log probs match between SGLang and Megatron
- Enable R3 for MoE models

---

## Supported Models

| Family | Models | MoE Support |
|--------|--------|-------------|
| DeepSeek | R1, V3, V3.2 | Full |
| Qwen | 2, 2.5, 3 (including MoE) | Full |
| Llama | 3, 3.1, 3.3, 4 | Dense only |
| Gemma | 2, 3, 3N | Dense only |
| GLM | 4.5, 4.6, 4.7 | Dense only |
| MiniMax | M2, M2.1 | Full |

---

## Resources

- **GitHub**: https://github.com/radixark/miles
- **Introduction Blog**: https://lmsys.org/blog/2025-11-19-miles/
- **Slime (upstream)**: https://github.com/THUDM/slime
- **SGLang**: https://github.com/sgl-project/sglang

