# verl API Reference

## Core Classes

### RayPPOTrainer

The central controller for the training loop. Manages resource allocation and coordinates worker groups.

```python
from verl import RayPPOTrainer

trainer = RayPPOTrainer(
    config=config,
    resource_pool_manager=resource_manager,
    ray_worker_group_cls=RayWorkerGroup,
)
trainer.init_workers()
trainer.fit()
```

### ResourcePoolManager

Manages GPU allocation across different worker groups using Ray PlacementGroups.

```python
from verl.trainer.ppo.resource_pool import ResourcePoolManager

manager = ResourcePoolManager(
    resource_pool_spec={
        "actor_rollout_ref": {"gpu": 4},
        "critic": {"gpu": 2},
    }
)
```

### RayWorkerGroup

Abstraction for distributed method execution. Spawns Ray actors and dispatches method calls.

```python
from verl.trainer.ppo.ray_worker_group import RayWorkerGroup

worker_group = RayWorkerGroup(
    num_workers=8,
    worker_cls=ActorRolloutRefWorker,
    resource_pool=pool,
)
```

### ActorRolloutRefWorker

Worker class implementing policy training, generation, and reference model computations. Manages hybrid engine mode switching.

```python
# Typically configured via YAML, not instantiated directly
# See configuration section below
```

### RolloutReplica

Interface for inference backends with implementations for vLLM, SGLang, TensorRT-LLM, and HuggingFace.

```python
from verl.workers.rollout import RolloutReplica

# Backend selection via config
rollout:
  name: vllm  # or: sglang, hf, tensorrt-llm
```

## Configuration Schema

### PPO Configuration (`verl/trainer/config/ppo_trainer.yaml`)

```yaml
# Data configuration
data:
  train_files: /path/to/train.parquet
  val_files: /path/to/val.parquet
  train_batch_size: 256        # Global batch size of prompts
  max_prompt_length: 512
  max_response_length: 2048

# Algorithm configuration
algorithm:
  adv_estimator: gae           # gae, grpo, rloo, reinforce_plus_plus
  gamma: 0.99                  # Discount factor
  lam: 0.95                    # GAE lambda
  use_kl_in_reward: false      # Add KL term to reward

# Actor configuration
actor_rollout_ref:
  model:
    path: Qwen/Qwen2.5-7B-Instruct
    backend: fsdp              # fsdp, fsdp2, megatron
  actor:
    ppo_mini_batch_size: 64    # Mini-batch for actor updates
    ppo_epochs: 1              # Number of actor update epochs
    clip_ratio: 0.2            # PPO clip range
    use_kl_loss: true          # Use KL loss in actor
    kl_loss_coef: 0.001        # KL loss coefficient
    kl_loss_type: low_var      # KL divergence calculation method
    loss_agg_mode: token-mean  # token-mean or sequence-mean
    gradient_checkpointing: true
    max_grad_norm: 1.0         # Gradient clipping
    lr: 1e-6                   # Learning rate
  rollout:
    name: vllm                 # vllm, sglang, hf
    n: 8                       # Samples per prompt
    temperature: 0.7
    top_p: 0.95
    log_prob_micro_batch_size: 8

# Critic configuration (PPO only)
critic:
  model:
    path: Qwen/Qwen2.5-7B-Instruct
  ppo_mini_batch_size: 64
  ppo_epochs: 1                # Defaults to actor epochs

# Trainer configuration
trainer:
  total_epochs: 3
  n_gpus_per_node: 8
  nnodes: 1
  save_freq: 100
  experiment_name: my_experiment
  async_weight_update: false
```

### GRPO Configuration (`docs/algo/grpo.md`)

```yaml
algorithm:
  adv_estimator: grpo          # Enable GRPO
  gamma: 1.0
  lam: 1.0

actor_rollout_ref:
  rollout:
    n: 8                       # Must be > 1 for GRPO
  actor:
    use_kl_loss: true          # Required for GRPO
    kl_loss_coef: 0.001
    kl_loss_type: low_var      # or: k1, k2, k3
    loss_agg_mode: token-mean
```

### Multi-Turn Configuration (`verl/trainer/config/rollout/rollout.yaml`)

```yaml
actor_rollout_ref:
  rollout:
    name: sglang               # Required for multi-turn
    multi_turn:
      enable: true
      tool_config_path: /path/to/tools.yaml
      interaction_config_path: /path/to/interaction.yaml
```

## Reward Functions

### Built-in Reward Types

```yaml
# Model-based reward
reward_model:
  path: OpenRLHF/Llama-3-8b-rm-700k

# Custom function-based reward
custom_reward_function:
  path: /path/to/reward.py
  name: compute_score          # Function name, default: compute_score
```

### Custom Reward Function Signature

```python
# reward.py
def compute_score(responses: list[str], ground_truths: list[str], **kwargs) -> list[float]:
    """
    Compute rewards for a batch of responses.

    Args:
        responses: Generated completions
        ground_truths: Expected answers from data
        **kwargs: Additional metadata

    Returns:
        List of reward scores (floats)
    """
    rewards = []
    for response, gt in zip(responses, ground_truths):
        # Your reward logic
        score = 1.0 if correct(response, gt) else 0.0
        rewards.append(score)
    return rewards
```

## Backend-Specific Configuration

### FSDP Configuration

```yaml
actor_rollout_ref:
  actor:
    strategy: fsdp
    fsdp_config:
      mixed_precision: bf16
      sharding_strategy: FULL_SHARD
      offload_policy: false
```

### FSDP2 Configuration

```yaml
actor_rollout_ref:
  actor:
    strategy: fsdp2
    fsdp_config:
      offload_policy: true     # CPU offloading
      reshard_after_forward: true
```

### Megatron Configuration

```yaml
actor_rollout_ref:
  model:
    backend: megatron
  actor:
    strategy: megatron
    tensor_model_parallel_size: 8
    pipeline_model_parallel_size: 2
    megatron:
      use_mbridge: true        # Required for format conversion
```

### vLLM Rollout Configuration

```yaml
actor_rollout_ref:
  rollout:
    name: vllm
    tensor_parallel_size: 2
    gpu_memory_utilization: 0.9
    max_num_seqs: 256
    enforce_eager: false
```

### SGLang Rollout Configuration

```yaml
actor_rollout_ref:
  rollout:
    name: sglang
    tp_size: 2
    mem_fraction_static: 0.8
    context_length: 8192
```

## Algorithm Reference

| Algorithm | `adv_estimator` | Requires Critic | Best For |
|-----------|-----------------|-----------------|----------|
| PPO | `gae` | Yes | Dense rewards, value estimation |
| GRPO | `grpo` | No | Sparse rewards, math/reasoning |
| RLOO | `rloo` | No | Leave-one-out baseline |
| REINFORCE++ | `reinforce_plus_plus` | No | Variance reduction |
| DAPO | `dapo` | No | Doubly-adaptive optimization |

## Vision-Language Model Support

```yaml
actor_rollout_ref:
  model:
    path: Qwen/Qwen2.5-VL-7B-Instruct
  rollout:
    name: vllm
    enable_vision: true
    max_model_len: 32768
```

## LoRA Configuration

```yaml
actor_rollout_ref:
  actor:
    lora:
      enabled: true
      r: 16
      alpha: 32
      target_modules: ["q_proj", "v_proj", "k_proj", "o_proj"]
      dropout: 0.05
```

## Resources

- Documentation: https://verl.readthedocs.io/
- GitHub: https://github.com/volcengine/verl
- Paper: https://arxiv.org/abs/2409.19256 (HybridFlow)
