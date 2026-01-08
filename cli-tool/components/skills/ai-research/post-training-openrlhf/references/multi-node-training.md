# Multi-Node Training

Complete guide to distributed Ray cluster training with OpenRLHF across multiple machines.

## Overview

OpenRLHF uses Ray for distributed scheduling, allowing Actor, Critic, Reward, and Reference models to span multiple nodes. Supports fault tolerance through checkpointing and automatic task rescheduling.

## Ray Cluster Setup

### 1. Start Head Node (Master Machine)

**In Docker container**:
```bash
# Launch container on master node
docker run --runtime=nvidia -it --rm --shm-size="10g" \
  --cap-add=SYS_ADMIN -v $PWD:/openrlhf \
  nvcr.io/nvidia/pytorch:25.02-py3 bash

# Start Ray head node
ray start --head --node-ip-address 0.0.0.0 --num-gpus 8
```

**Output**:
```
Ray runtime started.
Dashboard: http://0.0.0.0:8265
```

### 2. Connect Worker Nodes

**On each worker machine**:
```bash
# Launch container
docker run --runtime=nvidia -it --rm --shm-size="10g" \
  --cap-add=SYS_ADMIN -v $PWD:/openrlhf \
  nvcr.io/nvidia/pytorch:25.02-py3 bash

# Connect to head node
ray start --address {MASTER-NODE-IP}:6379 --num-gpus 8
```

**Replace `{MASTER-NODE-IP}`** with head node's IP address.

### 3. Verify Cluster

```bash
# On head node
ray status
```

**Output**:
```
Nodes: 4
  - 1 head node (8 GPUs)
  - 3 worker nodes (8 GPUs each)
Total GPUs: 32
```

## Distributed Training Configuration

### Multi-Node PPO Training

**4-node cluster (32 GPUs)** - 70B model:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  --runtime-env-json='{"working_dir": "/openrlhf"}' \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --ref_num_nodes 1 --ref_num_gpus_per_node 8 \
  --reward_num_nodes 1 --reward_num_gpus_per_node 8 \
  --critic_num_nodes 1 --critic_num_gpus_per_node 8 \
  --actor_num_nodes 1 --actor_num_gpus_per_node 8 \
  --vllm_num_engines 2 --vllm_tensor_parallel_size 4 \
  --pretrain meta-llama/Llama-2-70b-hf \
  --reward_pretrain ./reward-model-70b \
  --save_path ./output/llama-70b-ppo \
  --ckpt_path ./checkpoints/llama-70b-ppo \
  --save_steps 100 --logging_steps 1 \
  --micro_train_batch_size 2 --train_batch_size 128 \
  --micro_rollout_batch_size 4 --rollout_batch_size 1024 \
  --max_epochs 1 --prompt_max_len 1024 --generate_max_len 1024 \
  --zero_stage 3 --bf16 \
  --actor_learning_rate 5e-7 --critic_learning_rate 9e-6 \
  --init_kl_coef 0.01 --normalize_reward \
  --gradient_checkpointing --flash_attn
```

**GPU allocation**:
- **Node 1**: Reference model (8 GPUs)
- **Node 2**: Reward model (8 GPUs)
- **Node 3**: Critic model (8 GPUs)
- **Node 4**: Actor model (8 GPUs)

### Model Distribution Arguments

**Per-model configuration**:
```bash
# Actor model
--actor_num_nodes 2           # 2 nodes for actor
--actor_num_gpus_per_node 8   # 8 GPUs per node = 16 GPUs total

# Critic model
--critic_num_nodes 1
--critic_num_gpus_per_node 8

# Reward model
--reward_num_nodes 1
--reward_num_gpus_per_node 8

# Reference model
--ref_num_nodes 1
--ref_num_gpus_per_node 8
```

### Hybrid Engine (Colocated Models)

**Share GPUs across models**:
```bash
# Colocate all models on same GPUs
--colocate_all_models

# Or colocate specific pairs
--colocate_actor_ref       # Actor + Reference
--colocate_critic_reward   # Critic + Reward
```

**Example (2-node, 16 GPUs)**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --colocate_all_models \
  --vllm_enable_sleep --deepspeed_enable_sleep \
  --actor_num_nodes 2 --actor_num_gpus_per_node 8 \
  --critic_num_nodes 0 --critic_num_gpus_per_node 0 \
  --reward_num_nodes 0 --reward_num_gpus_per_node 0 \
  --ref_num_nodes 0 --ref_num_gpus_per_node 0 \
  --vllm_num_engines 4 --vllm_tensor_parallel_size 4 \
  # ... other args
```

**Result**: All models share 16 GPUs via sleep/wake cycles.

## vLLM Configuration

### Tensor Parallelism

**Multi-GPU per engine**:
```bash
--vllm_num_engines 4           # 4 engines
--vllm_tensor_parallel_size 4  # 4 GPUs each = 16 GPUs total
```

### GPU Memory Management

```bash
--vllm_gpu_memory_utilization 0.5  # Use 50% GPU for vLLM
```

**Calculation**:
- A100 80GB × 0.5 = 40GB for vLLM
- Remaining 40GB for other models (if colocated)

## Checkpointing

### Enable Checkpointing

**Basic checkpointing**:
```bash
--save_path ./output/model           # Final save path
--ckpt_path ./checkpoints/model      # Checkpoint directory
--save_steps 100                     # Save every 100 steps
--save_value_network                 # Also save critic
```

**HuggingFace format**:
```bash
--save_hf_ckpt  # Save as HuggingFace model (easier loading)
```

**DeepSpeed universal checkpoint**:
```bash
--use_ds_universal_ckpt  # Compatible across ZeRO stages
```

### Checkpoint Content

**Saved state**:
```python
{
    "global_step": 1000,
    "episode": 10,
    "data_loader_state_dict": {...},
    "actor_model": {...},        # DeepSpeed checkpoint
    "critic_model": {...}        # If --save_value_network
}
```

**Files created**:
```
checkpoints/llama-70b-ppo/
├── global_step_1000/
│   ├── actor/
│   │   ├── mp_rank_00_model_states.pt
│   │   ├── zero_pp_rank_0_mp_rank_00optim_states.pt
│   │   └── ...
│   └── critic/ (if --save_value_network)
│       └── ...
└── hf_ckpt/ (if --save_hf_ckpt)
    ├── config.json
    ├── pytorch_model.bin
    └── ...
```

### Resume Training

**From checkpoint**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --load_checkpoint                         # Enable resume
  --ckpt_path ./checkpoints/llama-70b-ppo   # Checkpoint dir
  # ... other args (must match original)
```

**Resume logic**:
1. `PPOTrainer.fit()` checks for existing checkpoints
2. Loads latest checkpoint from `ckpt_path`
3. Restores `global_step`, `episode`, dataloader state
4. Continues training from that point

## Fault Tolerance

### Automatic Task Rescheduling

**Ray's built-in fault tolerance**:
- If worker node fails → Ray reschedules tasks on available nodes
- Requires sufficient resources on remaining nodes
- May need to reinitialize some components

### DeepSpeed Sleep Mode Protection

**Prevents OOM-related failures**:
```bash
--deepspeed_enable_sleep  # Offload to CPU when not training
```

**Sleep/wake cycle**:
1. Model offloaded to CPU after training
2. Frees GPU memory for other components
3. Reloaded from CPU before next training step
4. Synchronized via Ray barriers

**OOM prevention**:
- Models don't compete for GPU memory
- Sequential loading prevents concurrent OOM
- Barriers ensure synchronization

### Checkpoint-Based Recovery

**Recover from catastrophic failure**:
1. Training interrupted (node crash, OOM, etc.)
2. Restart Ray cluster
3. Resume with `--load_checkpoint`
4. Training continues from last saved step

**Best practice**:
```bash
--save_steps 100  # Frequent checkpointing (every 100 steps)
```

## Monitoring

### Ray Dashboard

**Access dashboard**:
```
http://{HEAD-NODE-IP}:8265
```

**Monitor**:
- Node status (active, idle, failed)
- GPU utilization per node
- Task scheduling (which models on which nodes)
- Resource usage (memory, CPU, GPU)

### Weights & Biases Integration

**Enable W&B logging**:
```bash
--use_wandb {your-wandb-token}
--wandb_org your-org
--wandb_project llama-70b-ppo
```

**Metrics logged**:
- Training loss per step
- Reward scores
- KL divergence
- GPU utilization per node

## Performance Optimization

### InfiniBand for Multi-Node

**For nodes with InfiniBand**:
```bash
# Set environment variable before starting Ray
export NCCL_IB_HCA=mlx5_0  # InfiniBand device
export NCCL_SOCKET_IFNAME=ib0
export NCCL_IB_DISABLE=0

ray start --head --node-ip-address 0.0.0.0 --num-gpus 8
```

**Performance gain**: 2-3× faster multi-node communication

### Gradient Checkpointing

**Reduce memory, enable larger models**:
```bash
--gradient_checkpointing  # Trade compute for memory
```

### Flash Attention 2

**Faster attention, lower memory**:
```bash
--flash_attn  # Requires FlashAttention installed
```

### Packing Samples

**Improve GPU utilization**:
```bash
--packing_samples  # Pack multiple samples per batch
```

## Troubleshooting

### Ray Connection Issues

**Symptom**: Worker nodes can't connect to head

**Solution**: Check firewall/network
```bash
# On head node, ensure ports open
# Default ports: 6379 (Redis), 8265 (Dashboard), 10001-10100 (workers)

# Test connection from worker
telnet {HEAD-NODE-IP} 6379
```

### Node Failures During Training

**Symptom**: Ray reports node failure

**Solution 1** - Resume from checkpoint:
```bash
# Fix failed node or remove from cluster
ray stop  # On failed node
# Then resume training with --load_checkpoint
```

**Solution 2** - Adjust resources:
```bash
# Reduce nodes if some failed
--actor_num_nodes 1  # Instead of 2
```

### OOM on Multi-Node

**Symptom**: OOM despite multi-node setup

**Solution 1** - Reduce batch sizes:
```bash
--micro_train_batch_size 1  # Reduce from 2
--micro_rollout_batch_size 2  # Reduce from 4
```

**Solution 2** - Enable sleep modes:
```bash
--vllm_enable_sleep
--deepspeed_enable_sleep
```

**Solution 3** - Increase ZeRO stage:
```bash
--zero_stage 3  # Maximum sharding
```

### Checkpoint Loading Fails

**Symptom**: `FileNotFoundError` when resuming

**Check checkpoint path**:
```bash
ls -la ./checkpoints/llama-70b-ppo/
# Verify global_step_* directories exist
```

**Solution**: Ensure `--ckpt_path` matches save location
```bash
--ckpt_path ./checkpoints/llama-70b-ppo  # Same as during save
```

## Complete Multi-Node Example

### 8-node cluster (64 GPUs) - 70B model

**Head node (Node 1)**:
```bash
ray start --head --node-ip-address 10.0.0.1 --num-gpus 8
```

**Worker nodes (Nodes 2-8)**:
```bash
ray start --address 10.0.0.1:6379 --num-gpus 8
```

**Submit job**:
```bash
ray job submit --address="http://10.0.0.1:8265" \
  --runtime-env-json='{"working_dir": "/openrlhf"}' \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --ref_num_nodes 2 --ref_num_gpus_per_node 8 \
  --reward_num_nodes 2 --reward_num_gpus_per_node 8 \
  --critic_num_nodes 2 --critic_num_gpus_per_node 8 \
  --actor_num_nodes 2 --actor_num_gpus_per_node 8 \
  --vllm_num_engines 4 --vllm_tensor_parallel_size 4 \
  --pretrain meta-llama/Llama-2-70b-hf \
  --reward_pretrain ./reward-70b \
  --save_path ./output/llama-70b-ppo \
  --ckpt_path ./checkpoints/llama-70b-ppo \
  --save_steps 100 --save_hf_ckpt \
  --micro_train_batch_size 1 --train_batch_size 128 \
  --micro_rollout_batch_size 2 --rollout_batch_size 1024 \
  --max_epochs 1 --bf16 --zero_stage 3 \
  --actor_learning_rate 5e-7 --critic_learning_rate 9e-6 \
  --gradient_checkpointing --flash_attn --packing_samples \
  --use_wandb {token} --wandb_project llama-70b-ppo
```

**GPU allocation**:
- Reference: 16 GPUs (2 nodes × 8)
- Reward: 16 GPUs (2 nodes × 8)
- Critic: 16 GPUs (2 nodes × 8)
- Actor: 16 GPUs (2 nodes × 8)
- **Total**: 64 GPUs

## References

- Ray Docs: https://docs.ray.io/
- OpenRLHF: https://github.com/OpenRLHF/OpenRLHF
- DeepSpeed ZeRO: https://www.deepspeed.ai/tutorials/zero/
