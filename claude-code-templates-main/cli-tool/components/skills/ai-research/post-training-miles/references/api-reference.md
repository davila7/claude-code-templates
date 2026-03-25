# miles API Reference

## Overview

miles is an enterprise-grade RL framework built on slime, adding advanced features for large-scale MoE training:

- Unified FP8 training and inference
- INT4 Quantization-Aware Training
- Rollout Routing Replay (R3)
- Speculative RL training

**Note**: miles inherits slime's configuration system. See [slime API Reference](../../slime/references/api-reference.md) for base arguments.

## Core Data Structures

miles uses the same `Sample` dataclass as slime with the `rollout_routed_experts` field for MoE routing replay.

## Quick Start

```bash
python train.py \
    --advantage-estimator grpo \
    --model-name qwen3-30b-a3b \
    --hf-checkpoint /path/to/qwen3-30b-a3b-hf \
    --rollout-batch-size 512 \
    --n-samples-per-prompt 8
```

## Configuration Options

miles inherits slime's three argument categories (Megatron, SGLang with `--sglang-` prefix, and slime-specific). Key additions:

### Cluster Resources (inherited from slime)

```bash
--actor-num-nodes 1
--actor-num-gpus-per-node 8
--rollout-num-gpus 8
--rollout-num-gpus-per-engine 2
--colocate
```

### Megatron Parallelism (inherited from slime)

```bash
--tensor-model-parallel-size 8
--pipeline-model-parallel-size 2
--expert-model-parallel-size 4    # MoE expert parallelism
```

### Speculative Decoding

Verified flags from miles documentation:

```bash
# Basic speculative decoding
--sglang-speculative-algorithm EAGLE
--sglang-speculative-num-steps 3
--sglang-speculative-eagle-topk 1
--sglang-speculative-num-draft-tokens 4
--sglang-enable-draft-weights-cpu-backup

# Draft model path
--sglang-speculative-draft-model-path /your/draft/model/path

# Online SFT for draft model (MTP)
--mtp-num-layers 1
--enable-mtp-training
--mtp-loss-scaling-factor 0.2
```

**Note**: Online MTP training requires a torch dist checkpoint with MTP weights. Add `--mtp-num-layers 1` during checkpoint conversion from HuggingFace to torch dist format.

## Key Features (Conceptual)

The following features are documented in miles but specific CLI flags are not publicly documented. Consult the miles repository for latest configuration options.

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

miles achieves "exactly 0 KL divergence" between training and inference through infrastructure optimizations:
- Flash Attention 3
- DeepGEMM
- Batch-invariant kernels from Thinking Machines Lab
- `torch.compile` integration

### Truncated/Masked Importance Sampling (TIS/MIS)

Algorithmic corrections for off-policy training. See slime documentation for `--use-tis` flag.

## Custom Functions

Same interface as slime:

```bash
--custom-generate-function-path generate.py
--custom-rm-path reward.py
```

## Supported Models

| Family | Models | MoE Support |
|--------|--------|-------------|
| DeepSeek | R1, V3, V3.2 | Full |
| Qwen | 2, 2.5, 3 (including MoE) | Full |
| Llama | 3, 3.1, 3.3, 4 | Dense only |
| Gemma | 2, 3, 3N | Dense only |
| GLM | 4.5, 4.6, 4.7 | Dense only |
| MiniMax | M2, M2.1 | Full |

## Resources

- GitHub: https://github.com/radixark/miles
- Introduction Blog: https://lmsys.org/blog/2025-11-19-miles/
- Slime (upstream): https://github.com/THUDM/slime
- SGLang: https://github.com/sgl-project/sglang
