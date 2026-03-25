# torchforge Troubleshooting Guide

## GPU Resource Issues

### Issue: Not Enough GPUs

**Symptoms**: "Insufficient GPU resources" error

**Solutions**:

1. **Reduce service requirements**:
```yaml
services:
  generator:
    procs: 1
    with_gpus: true
  trainer:
    procs: 1
    with_gpus: true
  # Remove ref_model or use CPU
```

2. **Use CPU for reference model**:
```yaml
ref_model:
  with_gpus: false  # Run on CPU
```

3. **Share resources between services**:
```yaml
services:
  generator:
    procs: 1
    num_replicas: 1
    colocate_with: trainer  # Share GPU with trainer
```

### Issue: Minimum GPU Requirements

**Reference**:
- SFT: 2+ GPUs (trainer + generator)
- GRPO: 3+ GPUs (trainer + generator + ref_model)
- Large models: 8+ GPUs with tensor parallelism

## Memory Issues

### Issue: OOM During Generation

**Symptoms**: CUDA OOM in vLLM

**Solutions**:

1. **Reduce batch size**:
```yaml
grpo:
  n_samples: 4  # Reduce from 8
```

2. **Reduce sequence length**:
```yaml
training:
  seq_len: 2048  # Reduce from 4096
```

3. **Reduce vLLM memory**:
```yaml
generator:
  gpu_memory_utilization: 0.7  # Reduce from 0.9
```

### Issue: OOM During Training

**Symptoms**: CUDA OOM in backward pass

**Solutions**:

1. **Enable gradient checkpointing**:
```yaml
training:
  gradient_checkpointing: true
```

2. **Increase gradient accumulation**:
```yaml
training:
  gradient_accumulation_steps: 8  # Increase from 4
```

3. **Reduce batch size**:
```yaml
training:
  batch_size: 2  # Reduce from 4
```

## Weight Synchronization Issues

### Issue: Slow Weight Sync

**Symptoms**: Long pauses between training and generation

**Solutions**:

1. **Enable RDMA** (if available):
```bash
export TORCHSTORE_USE_RDMA=1
```

2. **Reduce sync frequency**:
```yaml
training:
  sync_interval: 10  # Sync every 10 steps
```

3. **Use colocated services**:
```yaml
services:
  generator:
    colocate_with: trainer
```

### Issue: Weight Sync Failures

**Symptoms**: Errors in weight transfer, stale weights

**Solutions**:

1. **Check network connectivity**:
```bash
ping other_node
```

2. **Increase timeout**:
```yaml
services:
  weight_sync_timeout: 600  # 10 minutes
```

3. **Enable sync verification**:
```yaml
training:
  verify_weight_sync: true
```

## Training Stability Issues

### Issue: Policy Collapse

**Symptoms**: Entropy drops to zero, reward stops improving

**Solutions**:

1. **Increase KL penalty**:
```yaml
grpo:
  beta: 0.2  # Increase from 0.1
```

2. **Add entropy bonus**:
```yaml
training:
  entropy_coef: 0.01
```

3. **Reduce learning rate**:
```yaml
training:
  learning_rate: 5e-7  # Reduce from 1e-6
```

### Issue: Loss Spikes

**Symptoms**: Sudden loss increases, training instability

**Solutions**:

1. **Enable gradient clipping**:
```yaml
training:
  max_grad_norm: 1.0
```

2. **Reduce clip range**:
```yaml
grpo:
  clip_low: 0.1   # Reduce from 0.2
  clip_high: 0.18 # Reduce from 0.28
```

3. **Use learning rate warmup**:
```yaml
training:
  warmup_steps: 100
```

### Issue: Divergent Training

**Symptoms**: Loss becomes NaN, model outputs garbage

**Solutions**:

1. **Check for data issues**:
```python
# Verify no empty sequences
for batch in dataset:
    assert batch.input_ids.numel() > 0
```

2. **Use BF16 instead of FP16**:
```yaml
training:
  dtype: bfloat16
```

3. **Reduce learning rate significantly**:
```yaml
training:
  learning_rate: 1e-7
```

## Service Issues

### Issue: Service Startup Failures

**Symptoms**: Services fail to initialize

**Solutions**:

1. **Check resource availability**:
```bash
nvidia-smi  # Verify GPU availability
```

2. **Increase startup timeout**:
```yaml
services:
  startup_timeout: 600
```

3. **Check model path**:
```python
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained("model_path")  # Verify accessible
```

### Issue: Generator Not Responding

**Symptoms**: Generation hangs, timeouts

**Solutions**:

1. **Check vLLM status**:
```python
# Add health check
await generator.health_check.route()
```

2. **Restart service**:
```python
await generator.restart.fanout()
```

3. **Reduce concurrent requests**:
```yaml
generator:
  max_concurrent_requests: 10
```

## Monarch Issues

### Issue: Monarch Actor Failures

**Symptoms**: Actor crashes, communication errors

**Solutions**:

1. **Enable fault tolerance**:
```yaml
monarch:
  fault_tolerance: true
  max_restarts: 3
```

2. **Increase actor memory**:
```yaml
services:
  actor_memory_mb: 4096
```

3. **Check Monarch logs**:
```bash
export MONARCH_LOG_LEVEL=DEBUG
```

### Issue: Deadlock in Distributed Communication

**Symptoms**: Training hangs, no progress

**Solutions**:

1. **Check for blocking calls**:
```python
# Use async/await correctly
result = await service.method.route(args)  # Correct
# result = service.method.route(args).wait()  # May deadlock
```

2. **Add timeouts**:
```python
result = await asyncio.wait_for(
    service.method.route(args),
    timeout=60.0
)
```

## Installation Issues

### Issue: PyTorch Version Mismatch

**Symptoms**: Import errors, CUDA errors

**Solutions**:

1. **Use provided install script**:
```bash
./scripts/install.sh
```

2. **Verify versions**:
```python
import torch
print(torch.__version__)  # Should be 2.9.0+
```

3. **Clean reinstall**:
```bash
pip uninstall torch torchvision torchaudio
./scripts/install.sh
```

### Issue: Monarch Installation Fails

**Symptoms**: Cannot import monarch

**Solutions**:

1. **Install from source**:
```bash
git clone https://github.com/meta-pytorch/monarch
cd monarch && pip install -e .
```

2. **Check CUDA compatibility**:
```bash
nvcc --version  # Should match PyTorch CUDA
```

## Debugging Tips

### Enable Verbose Logging

```bash
export FORGE_DEBUG=1
export MONARCH_LOG_LEVEL=DEBUG
```

### Profile Services

```python
# Add profiling
with torch.profiler.profile() as prof:
    result = await trainer.train_step.route(batch)
prof.export_chrome_trace("trace.json")
```

### Monitor GPU Utilization

```bash
watch -n 1 nvidia-smi
```

### Test Services Individually

```python
# Test generator
completions = await generator.generate.route(
    prompts=["Hello"],
    max_tokens=10,
)
print(completions[0].text)

# Test trainer
result = await trainer.train_step.route(dummy_batch)
print(result.loss)
```

## Experimental Warning

Both Monarch and torchforge are experimental. Expect:
- API changes between versions
- Incomplete features
- Bugs in edge cases

Check Discord for latest updates and workarounds.

## Resources

- GitHub Issues: https://github.com/meta-pytorch/torchforge/issues
- Discord: https://discord.gg/YsTYBh6PD9
- Monarch Issues: https://github.com/meta-pytorch/monarch/issues
