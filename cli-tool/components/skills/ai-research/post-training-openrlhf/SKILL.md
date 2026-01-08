---
name: openrlhf-training
description: High-performance RLHF framework with Ray+vLLM acceleration. Use for PPO, GRPO, RLOO, DPO training of large models (7B-70B+). Built on Ray, vLLM, ZeRO-3. 2× faster than DeepSpeedChat with distributed architecture and GPU resource sharing.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Post-Training, OpenRLHF, RLHF, PPO, GRPO, RLOO, DPO, Ray, vLLM, Distributed Training, Large Models, ZeRO-3]
dependencies: [openrlhf, ray, vllm, torch, transformers, deepspeed]
---

# OpenRLHF - High-Performance RLHF Training

## Quick start

OpenRLHF is a Ray-based RLHF framework optimized for distributed training with vLLM inference acceleration.

**Installation**:
```bash
# Launch Docker container
docker run --runtime=nvidia -it --rm --shm-size="10g" --cap-add=SYS_ADMIN \
  -v $PWD:/openrlhf nvcr.io/nvidia/pytorch:25.02-py3 bash

# Uninstall conflicts
sudo pip uninstall xgboost transformer_engine flash_attn pynvml -y

# Install OpenRLHF with vLLM
pip install openrlhf[vllm]
```

**PPO Training** (Hybrid Engine):
```bash
ray start --head --node-ip-address 0.0.0.0 --num-gpus 8

ray job submit --address="http://127.0.0.1:8265" \
  --runtime-env-json='{"working_dir": "/openrlhf"}' \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --ref_num_nodes 1 --ref_num_gpus_per_node 8 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 8 \
  --critic_num_nodes 1 --critic_num_gpus_per_node 8 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 8 \
  --vllm_num_engines 4 --vllm_tensor_parallel_size 2 \
  --colocate_all_models \
  --vllm_gpu_memory_utilization 0.5 \
  --pretrain OpenRLHF/Llama-3-8b-sft-mixture \
  --reward_pretrain OpenRLHF/Llama-3-8b-rm-700k \
  --save_path ./output/llama3-8b-rlhf \
  --micro_train_batch_size 8 --train_batch_size 128 \
  --micro_rollout_batch_size 16 --rollout_batch_size 1024 \
  --max_epochs 1 --prompt_max_len 1024 --generate_max_len 1024 \
  --zero_stage 3 --bf16 \
  --actor_learning_rate 5e-7 --critic_learning_rate 9e-6 \
  --init_kl_coef 0.01 --normalize_reward \
  --gradient_checkpointing --packing_samples \
  --vllm_enable_sleep --deepspeed_enable_sleep
```

**GRPO Training** (Group Normalized Policy Optimization):
```bash
# Same command as PPO, but add:
--advantage_estimator group_norm
```

## Common workflows

### Workflow 1: Full RLHF pipeline (SFT → Reward Model → PPO)

**Step 1: Train reward model** (DPO):
```bash
deepspeed --module openrlhf.cli.train_rm \
  --save_path ./output/llama3-8b-rm \
  --save_steps -1 --logging_steps 1 \
  --eval_steps -1 --train_batch_size 256 \
  --micro_train_batch_size 1 --pretrain meta-llama/Meta-Llama-3-8B \
  --bf16 --max_epochs 1 --max_len 8192 \
  --zero_stage 3 --learning_rate 9e-6 \
  --dataset OpenRLHF/preference_dataset_mixture2_and_safe_pku \
  --apply_chat_template --chosen_key chosen \
  --rejected_key rejected --flash_attn --gradient_checkpointing
```

**Step 2: PPO training**:
```bash
ray start --head --node-ip-address 0.0.0.0 --num-gpus 8

ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --ref_num_nodes 1 --ref_num_gpus_per_node 8 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 8 \
  --critic_num_nodes 1 --critic_num_gpus_per_node 8 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 8 \
  --vllm_num_engines 4 --vllm_tensor_parallel_size 2 \
  --colocate_all_models \
  --pretrain OpenRLHF/Llama-3-8b-sft-mixture \
  --reward_pretrain ./output/llama3-8b-rm \
  --save_path ./output/llama3-8b-ppo \
  --micro_train_batch_size 8 --train_batch_size 128 \
  --micro_rollout_batch_size 16 --rollout_batch_size 1024 \
  --max_epochs 1 --prompt_max_len 1024 --generate_max_len 1024 \
  --zero_stage 3 --bf16 \
  --actor_learning_rate 5e-7 --critic_learning_rate 9e-6 \
  --init_kl_coef 0.01 --normalize_reward \
  --vllm_enable_sleep --deepspeed_enable_sleep
```

### Workflow 2: GRPO training (no critic model needed)

Memory-efficient alternative to PPO:

```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --advantage_estimator group_norm \
  --ref_num_nodes 1 --ref_num_gpus_per_node 8 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 8 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 8 \
  --vllm_num_engines 4 --vllm_tensor_parallel_size 2 \
  --colocate_all_models \
  --pretrain OpenRLHF/Llama-3-8b-sft-mixture \
  --reward_pretrain OpenRLHF/Llama-3-8b-rm-700k \
  --save_path ./output/llama3-8b-grpo \
  --micro_train_batch_size 8 --train_batch_size 128 \
  --micro_rollout_batch_size 16 --rollout_batch_size 1024 \
  --max_epochs 1 --bf16 \
  --actor_learning_rate 5e-7 \
  --init_kl_coef 0.01 --use_kl_loss --kl_estimator k3 \
  --normalize_reward --no_advantage_std_norm
```

**Key GRPO parameters**:
- `--advantage_estimator group_norm` - Enables GRPO
- `--use_kl_loss` - KL loss from GRPO paper
- `--kl_estimator k3` - Loss function (k2 ≈ k1)
- `--no_advantage_std_norm` - Disables std normalization

### Workflow 3: DPO training (preference optimization)

Simpler alternative without reward model:

```bash
deepspeed --module openrlhf.cli.train_dpo \
  --save_path ./output/llama3-8b-dpo \
  --save_steps -1 --logging_steps 1 \
  --eval_steps -1 --train_batch_size 256 \
  --micro_train_batch_size 2 --pretrain meta-llama/Meta-Llama-3-8B \
  --bf16 --max_epochs 1 --max_len 8192 \
  --zero_stage 3 --learning_rate 5e-7 --beta 0.1 \
  --dataset OpenRLHF/preference_dataset_mixture2_and_safe_pku \
  --apply_chat_template --chosen_key chosen \
  --rejected_key rejected --flash_attn --gradient_checkpointing
```

## When to use vs alternatives

**Use OpenRLHF when**:
- Training large models (7B-70B+) with RL
- Need vLLM inference acceleration
- Want distributed architecture with Ray
- Have multi-node GPU cluster
- Need PPO/GRPO/RLOO/DPO in one framework

**Algorithm selection**:
- **PPO**: Maximum control, best for complex rewards
- **GRPO**: Memory-efficient, no critic needed
- **RLOO**: Modified PPO with per-token KL
- **REINFORCE++**: More stable than GRPO, faster than PPO
- **DPO**: Simplest, no reward model needed

**Use alternatives instead**:
- **TRL**: Single-node training, simpler API
- **veRL**: ByteDance's framework for 671B models
- **DeepSpeedChat**: Integrated with DeepSpeed ecosystem

## Common issues

**Issue: GPU OOM with large models**

Disable model colocation:
```bash
# Remove --colocate_all_models flag
# Allocate separate GPUs for each model
--actor_num_gpus_per_node 8 \
--critic_num_gpus_per_node 8 \
--reward_num_gpus_per_node 8 \
--ref_num_gpus_per_node 8
```

**Issue: DeepSpeed GPU index out of range**

Set environment variable:
```bash
export RAY_EXPERIMENTAL_NOSET_CUDA_VISIBLE_DEVICES=1
```

**Issue: Training instability**

Use Hybrid Engine instead of async:
```bash
--colocate_all_models \
--vllm_enable_sleep \
--deepspeed_enable_sleep
```

Adjust KL coefficient:
```bash
--init_kl_coef 0.05  # Increase from 0.01
```

**Issue: Slow generation during PPO**

Enable vLLM acceleration:
```bash
--vllm_num_engines 4 \
--vllm_tensor_parallel_size 2 \
--vllm_gpu_memory_utilization 0.5
```

## Advanced topics

**Hybrid Engine GPU sharing**: See [references/hybrid-engine.md](references/hybrid-engine.md) for vLLM sleep mode, DeepSpeed sleep mode, and optimal node allocation.

**Algorithm comparison**: See [references/algorithm-comparison.md](references/algorithm-comparison.md) for PPO vs GRPO vs RLOO vs REINFORCE++ benchmarks and hyperparameters.

**Multi-node setup**: See [references/multi-node-training.md](references/multi-node-training.md) for Ray cluster configuration and fault tolerance.

**Custom reward functions**: See [references/custom-rewards.md](references/custom-rewards.md) for reinforced fine-tuning and agent RLHF.

## Hardware requirements

- **GPU**: NVIDIA A100/H100 recommended
- **VRAM**:
  - 7B model: 8× A100 40GB (Hybrid Engine)
  - 70B model: 48× A100 80GB (vLLM:Actor:Critic = 1:1:1)
- **Multi-node**: Ray cluster with InfiniBand recommended
- **Docker**: NVIDIA PyTorch container 25.02+

**Performance**:
- 2× faster than DeepSpeedChat
- vLLM inference acceleration
- Hybrid Engine minimizes GPU idle time

## Resources

- Docs: https://github.com/OpenRLHF/OpenRLHF
- Paper: https://arxiv.org/abs/2405.11143
- Examples: https://github.com/OpenRLHF/OpenRLHF/tree/main/examples
- Discord: Community support



