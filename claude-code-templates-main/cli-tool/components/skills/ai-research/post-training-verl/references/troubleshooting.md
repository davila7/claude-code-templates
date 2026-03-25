# verl Troubleshooting Guide

## Common Issues and Solutions

### OOM (Out of Memory) Issues

#### Issue: OOM During Rollout

**Symptoms**: CUDA out of memory during generation phase

**Solutions**:

1. **Reduce log prob batch size**:
```yaml
actor_rollout_ref:
  rollout:
    log_prob_micro_batch_size: 4  # Reduce from 8
```

2. **Enable gradient checkpointing**:
```yaml
actor_rollout_ref:
  actor:
    gradient_checkpointing: true
```

3. **Use FSDP2 with CPU offloading**:
```yaml
actor_rollout_ref:
  actor:
    strategy: fsdp2
    fsdp_config:
      offload_policy: true
```

4. **Reduce vLLM memory utilization**:
```yaml
actor_rollout_ref:
  rollout:
    gpu_memory_utilization: 0.7  # Reduce from 0.9
```

#### Issue: OOM During Training

**Symptoms**: CUDA OOM in backward pass

**Solutions**:

1. **Reduce batch sizes**:
```yaml
actor_rollout_ref:
  actor:
    ppo_mini_batch_size: 32  # Reduce from 64
```

2. **Use gradient accumulation**:
```yaml
actor_rollout_ref:
  actor:
    gradient_accumulation_steps: 4
```

3. **Enable mixed precision**:
```yaml
actor_rollout_ref:
  actor:
    fsdp_config:
      mixed_precision: bf16
```

### Training Stability Issues

#### Issue: Training Instability / Loss Spikes

**Symptoms**: Loss spikes, reward collapse, divergence

**Solutions**:

1. **Reduce learning rate**:
```yaml
actor_rollout_ref:
  actor:
    lr: 5e-7  # Reduce from 1e-6
```

2. **Increase KL penalty**:
```yaml
actor_rollout_ref:
  actor:
    kl_loss_coef: 0.01  # Increase from 0.001
```

3. **Enable gradient clipping**:
```yaml
actor_rollout_ref:
  actor:
    max_grad_norm: 1.0
```

4. **Use smaller PPO clip range**:
```yaml
actor_rollout_ref:
  actor:
    clip_ratio: 0.1  # Reduce from 0.2
```

#### Issue: Policy Collapse (Entropy Drops to Zero)

**Symptoms**: Model outputs become deterministic, entropy approaches zero

**Solutions**:

1. **Increase temperature during rollout**:
```yaml
actor_rollout_ref:
  rollout:
    temperature: 0.9  # Increase from 0.7
```

2. **Add entropy bonus**:
```yaml
algorithm:
  entropy_coef: 0.01
```

3. **Reduce KL penalty**:
```yaml
actor_rollout_ref:
  actor:
    kl_loss_coef: 0.0001  # Reduce
```

### Weight Synchronization Issues

#### Issue: Slow Weight Sync

**Symptoms**: Long pauses between rollout and training phases

**Solutions**:

1. **Use FSDP2 for faster resharding**:
```yaml
actor_rollout_ref:
  actor:
    strategy: fsdp2
```

2. **Enable async weight transfer**:
```yaml
trainer:
  async_weight_update: true
```

3. **Reduce sync frequency**:
```yaml
trainer:
  weight_sync_interval: 2  # Sync every 2 steps
```

#### Issue: Weight Sync Timeout

**Symptoms**: Ray actor timeouts during weight synchronization

**Solutions**:

1. **Increase Ray timeout**:
```python
import ray
ray.init(num_gpus=8, timeout=3600)  # 1 hour timeout
```

2. **Use colocated mode** (if memory allows):
```yaml
trainer:
  colocate_actor_ref: true
```

### vLLM Version Issues

#### Issue: vLLM Import Errors or Generation Failures

**Symptoms**: Import errors, generation hangs, incorrect outputs

**Solutions**:

1. **Use compatible vLLM version**:
```bash
pip install vllm>=0.8.2,<=0.12.0
# Avoid vLLM 0.7.x (known bugs)
```

2. **For vLLM 0.8.x issues**:
```yaml
actor_rollout_ref:
  rollout:
    enforce_eager: true  # Disable CUDA graphs
```

3. **Check CUDA version compatibility**:
```bash
# vLLM 0.11+ requires CUDA 12.1+
nvidia-smi  # Check CUDA version
```

### Ray Issues

#### Issue: Ray Cluster Connection Failures

**Symptoms**: Cannot connect to Ray cluster

**Solutions**:

1. **Check Ray head node**:
```bash
ray status
```

2. **Restart Ray cluster**:
```bash
ray stop
ray start --head --port=6379 --num-gpus=8
```

3. **Verify network connectivity**:
```bash
ping head_node_ip
```

#### Issue: Ray Actor OOM

**Symptoms**: Ray actors killed due to OOM

**Solutions**:

1. **Increase Ray object store memory**:
```bash
ray start --head --object-store-memory=10000000000  # 10GB
```

2. **Enable spilling to disk**:
```bash
export RAY_object_spilling_config='{"type":"filesystem","params":{"directory_path":"/tmp/ray_spill"}}'
```

### Multi-Node Issues

#### Issue: NCCL Timeout

**Symptoms**: NCCL operations timeout on multi-node

**Solutions**:

1. **Set NCCL environment variables**:
```bash
export NCCL_DEBUG=INFO
export NCCL_SOCKET_IFNAME=eth0
export NCCL_IB_DISABLE=0  # Enable InfiniBand if available
```

2. **Increase NCCL timeout**:
```bash
export NCCL_TIMEOUT=1800  # 30 minutes
```

3. **Check network interface**:
```bash
ifconfig  # Verify correct interface
```

#### Issue: DeepSpeed GPU Index Out of Range

**Symptoms**: "GPU index out of range" error with DeepSpeed

**Solutions**:

```bash
export RAY_EXPERIMENTAL_NOSET_CUDA_VISIBLE_DEVICES=1
```

### Data Issues

#### Issue: Empty Batches

**Symptoms**: Training receives empty batches

**Solutions**:

1. **Verify data format**:
```python
import pandas as pd
df = pd.read_parquet("train.parquet")
print(df.columns)  # Should include 'prompt', 'reward_model'
```

2. **Check data loading**:
```yaml
data:
  train_files: /absolute/path/to/train.parquet  # Use absolute path
```

#### Issue: Tokenization Errors

**Symptoms**: Tokenizer errors, sequence length mismatches

**Solutions**:

1. **Set padding token**:
```python
tokenizer.pad_token = tokenizer.eos_token
```

2. **Verify max length configuration**:
```yaml
data:
  max_prompt_length: 512
  max_response_length: 2048
# Total should not exceed model's max length
```

### Megatron-Specific Issues

#### Issue: Megatron Checkpoint Loading Fails

**Symptoms**: Cannot load Megatron checkpoints

**Solutions**:

1. **Enable mbridge conversion**:
```yaml
actor_rollout_ref:
  actor:
    megatron:
      use_mbridge: true
```

2. **Convert HuggingFace to Megatron format**:
```bash
python tools/convert_hf_to_megatron.py \
    --hf_model_path /path/to/hf/model \
    --save_path /path/to/megatron/checkpoint
```

#### Issue: Megatron on AMD GPUs

**Current Limitation**: Megatron-LM backend is not supported on AMD GPUs. Use FSDP backend instead:

```yaml
actor_rollout_ref:
  model:
    backend: fsdp
```

### Debugging Tips

#### Enable Verbose Logging

```yaml
trainer:
  logging_level: DEBUG
```

```bash
export VERL_DEBUG=1
export RAY_DEDUP_LOGS=0
```

#### Check GPU Utilization

```bash
watch -n 1 nvidia-smi
```

#### Profile Training

```python
# Add profiling to training loop
import torch.profiler

with torch.profiler.profile(
    activities=[torch.profiler.ProfilerActivity.CPU, torch.profiler.ProfilerActivity.CUDA],
    record_shapes=True,
) as prof:
    trainer.fit()
prof.export_chrome_trace("trace.json")
```

## Resources

- GitHub Issues: https://github.com/volcengine/verl/issues
- Documentation: https://verl.readthedocs.io/
- Community Slack: verl-project
