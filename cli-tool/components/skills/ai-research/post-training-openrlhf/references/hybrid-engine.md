# Hybrid Engine Architecture

Complete guide to OpenRLHF's GPU resource sharing system for maximizing utilization during RLHF training.

## Overview

The Hybrid Engine allows Actor, Critic, Reward, Reference models and vLLM engines to share GPU resources, minimizing idle time and maximizing GPU utilization through dynamic sleep/wake cycles.

## Architecture

### Core Components

**Enable Hybrid Engine**:
```bash
--colocate_all_models  # Enable GPU sharing across all models
```

**Components that share GPUs**:
1. **Actor Model** - Policy being trained
2. **Critic Model** - Value function for PPO
3. **Reward Model** - Scores completions
4. **Reference Model** - KL penalty baseline
5. **vLLM Engines** - Fast inference generation

### GPU Allocation Strategy

**Optimal ratio** (vLLM : Actor : Critic = 1:1:1):
```bash
# 70B model on 48× A100 GPUs
--vllm_num_engines 4          # 16 GPUs total
--vllm_tensor_parallel_size 4  # 4 GPUs per engine
--actor_num_nodes 1            # 16 GPUs
--actor_num_gpus_per_node 16
--critic_num_nodes 1           # 16 GPUs
--critic_num_gpus_per_node 16
```

**Constraint**: `actor_num_nodes * actor_num_gpus_per_node == vllm_num_engines * vllm_tensor_parallel_size`

## vLLM Sleep Mode

### How It Works

**Enable vLLM sleep**:
```bash
--vllm_enable_sleep
```

**Sleep/wake cycle**:
1. **Wake up** before generation: Load vLLM engines to GPU
2. **Generate** samples: vLLM performs inference
3. **Sleep** after generation: Offload vLLM engines to CPU

**Implementation**:
```python
# In SamplesGenerator.generate_samples()
batch_vllm_engine_call(self.vllm_engines, "wake_up")  # GPU ← CPU
# ... generate samples ...
batch_vllm_engine_call(self.vllm_engines, "sleep")    # CPU ← GPU
```

**When used**:
- Sample generation during PPO rollout
- Initial weight sync from actor to vLLM
- Evaluation phase

### Memory Management

**Control GPU memory**:
```bash
--vllm_gpu_memory_utilization 0.5  # Use 50% of GPU for vLLM
```

**Example**:
- A100 80GB × 0.5 = 40GB for vLLM
- Remaining 40GB for other models when colocated

## DeepSpeed Sleep Mode

### How It Works

**Enable DeepSpeed sleep**:
```bash
--deepspeed_enable_sleep
```

**Sleep/wake cycle**:
1. **Reload states** before training: Move model CPU → GPU
2. **Train** model: DeepSpeed performs optimization
3. **Offload states** after training: Move model GPU → CPU

**Implementation**:
```python
# In PPOTrainer.ppo_train()
# For actor model
self.actor.reload_states()      # GPU ← CPU
# ... training loop ...
self.actor.offload_states()     # CPU ← GPU

# For critic model
self.critic.reload_states()     # GPU ← CPU
# ... training loop ...
self.critic.offload_states()    # CPU ← GPU
```

**Synchronization**:
- Ray barriers ensure models don't reload simultaneously
- Prevents OOM from concurrent GPU memory usage

### Initial Offload

**Actor offload** (after initialization):
```python
if args.deepspeed_enable_sleep:
    self.actor.offload_states()  # Start in CPU
```

## OOM Prevention Strategies

### 1. Memory Utilization Control

**Limit vLLM memory**:
```bash
--vllm_gpu_memory_utilization 0.5  # Conservative
--vllm_gpu_memory_utilization 0.7  # Aggressive
```

### 2. Ray Barriers for Synchronization

**Prevent simultaneous loading**:
- vLLM wakes → generates → sleeps
- Then DeepSpeed reloads → trains → offloads
- Never both in GPU memory simultaneously

### 3. Disable Colocation for Large Models

**If OOM occurs**:
```bash
# Remove --colocate_all_models
# Allocate separate GPUs for each model
--actor_num_nodes 1 --actor_num_gpus_per_node 16
--critic_num_nodes 1 --critic_num_gpus_per_node 16
--reward_num_nodes 1 --reward_num_gpus_per_node 16
--ref_num_nodes 1 --ref_num_gpus_per_node 16
```

### 4. ZeRO-3 Sharding

**Memory efficiency**:
```bash
--zero_stage 3  # Shard parameters, gradients, optimizer states
```

Combined with Hybrid Engine for maximum efficiency.

## Complete Example (70B Model)

### With Hybrid Engine (48 GPUs)

```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --colocate_all_models \
  --vllm_enable_sleep \
  --deepspeed_enable_sleep \
  --vllm_num_engines 4 \
  --vllm_tensor_parallel_size 4 \
  --vllm_gpu_memory_utilization 0.5 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 16 \
  --critic_num_nodes 1 --critic_num_gpus_per_node 16 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 8 \
  --ref_num_nodes 1 --ref_num_gpus_per_node 8 \
  --pretrain meta-llama/Llama-2-70b-hf \
  --reward_pretrain ./reward-model-70b \
  --zero_stage 3 --bf16
```

**GPU allocation**:
- vLLM: 4 engines × 4 GPUs = 16 GPUs
- Actor: 16 GPUs (shares with vLLM via sleep)
- Critic: 16 GPUs
- Reward: 8 GPUs
- Reference: 8 GPUs
- **Total**: 48 GPUs (16 shared efficiently)

### Without Hybrid Engine (64 GPUs)

```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --vllm_num_engines 4 \
  --vllm_tensor_parallel_size 4 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 16 \
  --critic_num_nodes 1 --critic_num_gpus_per_node 16 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 16 \
  --ref_num_nodes 1 --ref_num_gpus_per_node 16 \
  --pretrain meta-llama/Llama-2-70b-hf \
  --zero_stage 3 --bf16
```

**GPU allocation**:
- vLLM: 16 GPUs (dedicated)
- Actor: 16 GPUs (dedicated)
- Critic: 16 GPUs (dedicated)
- Reward: 16 GPUs (dedicated)
- **Total**: 64 GPUs (no sharing)

**Savings**: Hybrid Engine saves 25% GPUs (48 vs 64)

## Ray Placement Groups

### Automatic Creation

**When `--colocate_all_models` is enabled**:
```python
# Placement group created for GPU sharing
placement_group = {
    "bundle": [{"GPU": actor_num_gpus_per_node}],  # Shared GPUs
    "strategy": "PACK"  # Colocate on same nodes
}
```

**Resource constraints**:
- vLLM engines scheduled on actor node GPUs
- DeepSpeed models scheduled on same GPUs
- Ray ensures proper scheduling

## Performance Benefits

**GPU utilization**:
- **Without Hybrid**: ~60-70% (idle during generation or training)
- **With Hybrid**: ~90-95% (constant utilization)

**Cost savings**:
- 25-33% fewer GPUs needed
- Same throughput with Hybrid Engine

**Stability**:
- More stable than async training
- Ray barriers prevent race conditions

## Troubleshooting

### OOM During Sleep/Wake

**Symptom**: OOM when model wakes up

**Solution 1** - Lower vLLM memory:
```bash
--vllm_gpu_memory_utilization 0.4  # Reduce from 0.5
```

**Solution 2** - Disable colocation:
```bash
# Remove --colocate_all_models
```

### DeepSpeed GPU Index Error

**Symptom**: `RuntimeError: Index out of range`

**Solution**:
```bash
export RAY_EXPERIMENTAL_NOSET_CUDA_VISIBLE_DEVICES=1
```

### vLLM Engines Don't Share GPUs

**Symptom**: vLLM uses separate GPUs despite `--colocate_all_models`

**Check constraint**:
```bash
# This must be true:
actor_num_nodes * actor_num_gpus_per_node == vllm_num_engines * vllm_tensor_parallel_size

# Example (valid):
# Actor: 1 node × 16 GPUs = 16
# vLLM: 4 engines × 4 TP = 16
# ✓ Equal
```

## References

- OpenRLHF: https://github.com/OpenRLHF/OpenRLHF
- Ray: https://docs.ray.io/en/latest/ray-core/scheduling/placement-group.html
- vLLM: https://docs.vllm.ai/
- DeepSpeed ZeRO: https://www.deepspeed.ai/tutorials/zero/
