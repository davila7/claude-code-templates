---
name: verl-rl-training
description: Provides guidance for training LLMs with reinforcement learning using verl (Volcano Engine RL). Use when implementing RLHF, GRPO, PPO, or other RL algorithms for LLM post-training at scale with flexible infrastructure backends.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Reinforcement Learning, RLHF, GRPO, PPO, Post-Training, Distributed Training]
dependencies: [verl>=0.3.0, torch>=2.0.0, ray>=2.41.0, vllm>=0.8.2, transformers>=4.40.0]
---

# verl: Volcano Engine Reinforcement Learning for LLMs

verl is a flexible, efficient, and production-ready RL training library for large language models from ByteDance's Seed team. It implements the HybridFlow framework (EuroSys 2025) and powers models like Doubao-1.5-pro achieving O1-level performance on math benchmarks.

## When to Use verl

**Choose verl when you need:**
- Production-ready RL training at scale (tested up to 671B parameters)
- Flexibility to swap backends (FSDP ↔ Megatron-LM ↔ vLLM ↔ SGLang)
- Support for multiple RL algorithms (PPO, GRPO, RLOO, REINFORCE++, DAPO)
- Multi-turn rollout with tool calling for agentic workflows
- Vision-language model RL training

**Consider alternatives when:**
- You need Megatron-native training → use **slime** or **miles**
- You want PyTorch-native abstractions with Monarch → use **torchforge**
- You only need simple SFT/DPO → use **TRL** or **Axolotl**

## Key Features

- **Training backends**: FSDP, FSDP2, Megatron-LM
- **Rollout engines**: vLLM, SGLang, HuggingFace Transformers
- **Algorithms**: PPO, GRPO, DAPO, RLOO, ReMax, REINFORCE++, SPIN, SPPO
- **Models**: Qwen-3, Llama-3.1, DeepSeek, Gemma-2 (0.5B to 671B)
- **Advanced**: LoRA RL, sequence parallelism, expert parallelism, multi-turn tools

## Installation

```bash
# Option 1: pip install
pip install verl[vllm]  # or verl[sglang] for SGLang backend

# Option 2: Docker (recommended for production)
docker pull verlai/verl:vllm011.latest

# Option 3: From source
git clone https://github.com/volcengine/verl.git
cd verl && pip install -e .[vllm,math]
```

## Quick Start: GRPO Training

```bash
python3 -m verl.trainer.main_ppo \
    algorithm.adv_estimator=grpo \
    data.train_files=~/data/gsm8k/train.parquet \
    actor_rollout_ref.model.path=Qwen/Qwen2.5-7B \
    actor_rollout_ref.rollout.n=8 \
    actor_rollout_ref.actor.use_kl_loss=True \
    trainer.n_gpus_per_node=8
```

## Core Architecture

verl uses a **HybridFlow** programming model separating control flow from computation:

```
┌─────────────────────────────────────────────────────────┐
│ Single-Process Controller (Ray)                         │
│ - Orchestrates: rollout → reward → train → sync        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Multi-Process Workers                                   │
│ ├── ActorRolloutRefWorker (policy + generation)        │
│ ├── CriticWorker (value estimation, PPO only)          │
│ └── RewardManager (model-based or rule-based rewards)  │
└─────────────────────────────────────────────────────────┘
```

---

## Workflow 1: Math Reasoning with GRPO

Use this workflow for training reasoning models on math tasks like GSM8K or MATH.

### Prerequisites Checklist
- [ ] GPU cluster with 8+ GPUs (H100 recommended)
- [ ] Dataset in parquet format with `prompt` and `reward_model` columns
- [ ] Base model from HuggingFace Hub

### Step 1: Prepare Dataset

```python
import pandas as pd

data = [
    {
        "prompt": [{"role": "user", "content": "What is 15 + 27?"}],
        "reward_model": {"ground_truth": "42"}
    },
    # ... more examples
]
df = pd.DataFrame(data)
df.to_parquet("train.parquet")
```

### Step 2: Define Reward Function

```python
# reward_function.py
import re

def compute_reward(responses, ground_truths):
    rewards = []
    for response, gt in zip(responses, ground_truths):
        # Extract answer from response
        match = re.search(r'\\boxed{([^}]+)}', response)
        if match and match.group(1).strip() == gt.strip():
            rewards.append(1.0)
        else:
            rewards.append(0.0)
    return rewards
```

### Step 3: Create Training Config

```yaml
# config/grpo_math.yaml
algorithm:
  adv_estimator: grpo
  gamma: 1.0
  lam: 1.0

data:
  train_files: /path/to/train.parquet
  val_files: /path/to/val.parquet
  train_batch_size: 256
  max_prompt_length: 512
  max_response_length: 2048

actor_rollout_ref:
  model:
    path: Qwen/Qwen2.5-7B-Instruct
  actor:
    use_kl_loss: true
    kl_loss_coef: 0.001
    ppo_mini_batch_size: 64
  rollout:
    name: vllm
    n: 8  # samples per prompt
    temperature: 0.7
    top_p: 0.95

trainer:
  total_epochs: 3
  n_gpus_per_node: 8
  save_freq: 100
```

### Step 4: Launch Training

```bash
python3 -m verl.trainer.main_ppo \
    --config-path config \
    --config-name grpo_math \
    trainer.experiment_name=grpo_math_qwen7b
```

### Step 5: Monitor and Validate
- [ ] Check WandB/TensorBoard for loss curves
- [ ] Verify reward is increasing over steps
- [ ] Run evaluation on held-out test set

---

## Workflow 2: PPO with Critic Model

Use this workflow when you need value-based advantage estimation (GAE).

### Key Differences from GRPO
- Requires separate critic model
- Uses Generalized Advantage Estimation (GAE)
- Better for tasks with dense rewards

### Configuration

```yaml
algorithm:
  adv_estimator: gae  # Use GAE instead of GRPO
  gamma: 0.99
  lam: 0.95

critic:
  model:
    path: Qwen/Qwen2.5-7B-Instruct  # Can be same or different from actor
  ppo_mini_batch_size: 64

actor_rollout_ref:
  actor:
    use_kl_loss: true
    kl_loss_coef: 0.02
    clip_ratio: 0.2  # PPO clipping
```

### Launch with Critic

```bash
python3 -m verl.trainer.main_ppo \
    algorithm.adv_estimator=gae \
    critic.model.path=Qwen/Qwen2.5-7B-Instruct \
    trainer.n_gpus_per_node=8
```

---

## Workflow 3: Large-Scale Training with Megatron

Use this workflow for models >70B parameters or when you need expert parallelism.

### Prerequisites
- [ ] Install Megatron-LM bridge: `pip install mbridge`
- [ ] Convert model to Megatron format
- [ ] Multi-node cluster with NVLink/InfiniBand

### Configuration for 70B+ Models

```yaml
actor_rollout_ref:
  model:
    path: /path/to/megatron/checkpoint
    backend: megatron
  actor:
    strategy: megatron
    tensor_model_parallel_size: 8
    pipeline_model_parallel_size: 2
  rollout:
    name: vllm
    tensor_parallel_size: 8
```

### Launch Multi-Node

```bash
# On head node
ray start --head --port=6379

# On worker nodes
ray start --address='head_ip:6379'

# Launch training
python3 -m verl.trainer.main_ppo \
    trainer.nnodes=4 \
    trainer.n_gpus_per_node=8
```

---

## Configuration Reference

### Algorithm Selection

| Algorithm | `adv_estimator` | Use Case |
|-----------|-----------------|----------|
| GRPO | `grpo` | Critic-free, math/reasoning |
| PPO/GAE | `gae` | Dense rewards, value estimation |
| REINFORCE++ | `reinforce_plus_plus` | Variance reduction |
| RLOO | `rloo` | Leave-one-out baseline |
| ReMax | `remax` | Maximum reward baseline |
| OPO | `opo` | Optimal policy optimization |

### Key Parameters

```yaml
# Rollout parameters
actor_rollout_ref.rollout.n: 8              # Samples per prompt
actor_rollout_ref.rollout.temperature: 0.7  # Sampling temperature
actor_rollout_ref.rollout.top_p: 0.95       # Nucleus sampling

# Training parameters
actor_rollout_ref.actor.lr: 1e-6            # Learning rate
actor_rollout_ref.actor.ppo_mini_batch_size: 64
actor_rollout_ref.actor.clip_ratio: 0.2     # PPO clip range

# KL control
actor_rollout_ref.actor.use_kl_loss: true
actor_rollout_ref.actor.kl_loss_coef: 0.001
algorithm.kl_ctrl.target_kl: 0.1            # For adaptive KL control
```

---

## Common Issues and Solutions

### Issue: OOM During Rollout

**Symptoms**: CUDA out of memory during generation phase

**Solutions**:
```yaml
# Reduce batch size
actor_rollout_ref.rollout.log_prob_micro_batch_size: 4

# Enable gradient checkpointing
actor_rollout_ref.model.enable_gradient_checkpointing: true

# Use FSDP2 with CPU offloading
actor_rollout_ref.actor.strategy: fsdp2
actor_rollout_ref.actor.fsdp_config.offload_policy: true
```

### Issue: Training Instability

**Symptoms**: Loss spikes, reward collapse

**Solutions**:
```yaml
# Reduce learning rate
actor_rollout_ref.actor.lr: 5e-7

# Increase KL penalty
actor_rollout_ref.actor.kl_loss_coef: 0.01

# Enable gradient clipping
actor_rollout_ref.actor.max_grad_norm: 1.0
```

### Issue: Slow Weight Sync

**Symptoms**: Long pauses between rollout and training

**Solutions**:
```bash
# Use FSDP2 for faster resharding
actor_rollout_ref.actor.strategy=fsdp2

# Enable async weight transfer
trainer.async_weight_update=true
```

### Issue: vLLM Version Mismatch

**Symptoms**: Import errors or generation failures

**Solution**: Use compatible versions:
```bash
pip install vllm>=0.8.5,<=0.12.0
# Avoid vLLM 0.7.x (known bugs)
```

---

## Advanced Topics

### Multi-Turn Tool Calling

See [references/multi-turn.md](references/multi-turn.md) for agentic workflows with tool use.

### Vision-Language Models

```yaml
actor_rollout_ref:
  model:
    path: Qwen/Qwen2.5-VL-7B-Instruct
  rollout:
    name: vllm
    enable_vision: true
```

### LoRA Training

```yaml
actor_rollout_ref:
  actor:
    lora:
      enabled: true
      r: 16
      alpha: 32
      target_modules: ["q_proj", "v_proj"]
```

---

## Resources

- **Documentation**: https://verl.readthedocs.io/
- **Paper**: https://arxiv.org/abs/2409.19256
- **GitHub**: https://github.com/volcengine/verl
- **Recipes**: https://github.com/verl-project/verl-recipe (DAPO, GSPO, etc.)
- **Community**: Slack at verl-project

