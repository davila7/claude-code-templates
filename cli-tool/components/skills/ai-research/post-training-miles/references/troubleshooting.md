# miles Troubleshooting Guide

## FP8 Training Issues

### Issue: FP8 Training Collapse

**Symptoms**: Loss explodes, NaN values, reward collapses

**Solutions**:

1. **Use block scaling**:
```bash
--fp8-recipe blockwise
export NVTE_FP8_BLOCK_SCALING_FP32_SCALES=1
```

2. **Enable R3 for MoE models**:
```bash
--use-r3
```

3. **Reduce learning rate**:
```bash
--lr 5e-7  # Reduce from 1e-6
```

4. **Warm up from BF16**:
```bash
--warmup-steps 100
--warmup-precision bf16
```

### Issue: FP8 vs BF16 Accuracy Gap

**Symptoms**: FP8 model underperforms BF16 baseline

**Solutions**:

1. **Use E4M3 format for activations**:
```bash
--fp8-format e4m3
```

2. **Enable dynamic scaling**:
```bash
--fp8-dynamic-scaling
```

3. **Skip sensitive layers**:
```bash
--fp8-skip-layers "lm_head,embed"
```

## Train-Inference Mismatch Issues

### Issue: Policy Divergence

**Symptoms**: Model behavior differs between training and inference

**Solutions**:

1. **Enable Rollout Routing Replay**:
```bash
--use-r3
```

2. **Use importance sampling correction**:
```bash
--use-tis --tis-threshold 0.9
```

3. **Verify log probs match**:
```bash
--verify-logprobs
```

### Issue: Expert Routing Mismatch (MoE)

**Symptoms**: Different experts activated during train vs inference

**Solutions**:

1. **Enable R3**:
```bash
--use-r3
--r3-buffer-size 1000
```

2. **Use deterministic routing**:
```bash
--deterministic-expert-routing
```

## INT4 Training Issues

### Issue: INT4 Accuracy Degradation

**Symptoms**: Worse performance than BF16 or FP8

**Solutions**:

1. **Increase group size**:
```bash
--int4-group-size 256  # Increase from 128
```

2. **Use mixed precision for sensitive layers**:
```bash
--int4-skip-layers "lm_head,embed,layer_norm"
```

3. **Warm start from BF16**:
```bash
--warmup-steps 100
--warmup-precision bf16
```

4. **Increase learning rate** (INT4 often needs higher LR):
```bash
--lr 2e-6  # Increase from 1e-6
```

### Issue: INT4 OOM Despite Expected Savings

**Symptoms**: Still running out of memory with INT4

**Solutions**:

1. **Verify environment variable**:
```bash
export OPEN_TRAINING_INT4_FAKE_QAT_FLAG=1
```

2. **Check group size alignment**:
```bash
# Group size must divide hidden dimension evenly
--int4-group-size 128  # Must divide hidden_size
```

## Speculative RL Issues

### Issue: Low Acceptance Rate

**Symptoms**: Draft model tokens frequently rejected

**Solutions**:

1. **Reduce lookahead**:
```bash
--spec-lookahead 3  # Reduce from 5
```

2. **Update draft more frequently**:
```bash
--online-sft-interval 5  # Reduce from 10
```

3. **Increase draft learning rate**:
```bash
--draft-lr 1e-5  # Increase
```

### Issue: Draft Model Drift

**Symptoms**: Acceptance rate drops over time

**Solutions**:

1. **Enable online SFT**:
```bash
--online-sft-interval 5
```

2. **Use EMA for draft updates**:
```bash
--draft-ema-decay 0.99
```

3. **Reinitialize draft periodically**:
```bash
--reinit-draft-interval 1000
```

### Issue: Speculative Training Slower Than Expected

**Symptoms**: Not achieving expected 25%+ speedup

**Solutions**:

1. **Verify draft model is small enough**:
```bash
# Draft should be 1/4 to 1/10 size of target
```

2. **Check lookahead is optimal**:
```bash
--spec-lookahead 5  # Sweet spot for most models
```

3. **Profile to find bottleneck**:
```bash
--profile-speculative
```

## Weight Synchronization Issues

### Issue: Zero-Copy Sync Failures

**Symptoms**: Errors with CUDA IPC, weight corruption

**Solutions**:

1. **Verify CUDA IPC support**:
```bash
nvidia-smi topo -m  # Check GPU topology
```

2. **Fall back to standard sync**:
```bash
# Remove --use-zero-copy-sync
```

3. **Increase bucket size**:
```bash
--sync-bucket-size 2147483648  # 2GB
```

### Issue: Slow Weight Sync Despite Zero-Copy

**Symptoms**: Weight sync still slow

**Solutions**:

1. **Use colocated mode**:
```bash
--colocate
```

2. **Enable async weight transfer**:
```bash
--async-weight-sync
```

## MoE-Specific Issues

### Issue: Expert Load Imbalance

**Symptoms**: Some experts heavily loaded, others unused

**Solutions**:

1. **Enable load balancing loss**:
```bash
--aux-loss-coef 0.01
```

2. **Use capacity factor**:
```bash
--moe-capacity-factor 1.25
```

### Issue: Expert Parallelism OOM

**Symptoms**: OOM with large MoE models

**Solutions**:

1. **Increase expert parallelism**:
```bash
--expert-model-parallel-size 8  # Increase from 4
```

2. **Reduce batch size per GPU**:
```bash
--micro-batch-size 1
```

3. **Enable expert offloading**:
```bash
--offload-experts
```

## Multi-Agent Issues

### Issue: Co-Evolution Instability

**Symptoms**: Agents oscillate or one dominates

**Solutions**:

1. **Use alternating updates**:
```yaml
co_evolution:
  strategy: alternating
```

2. **Reduce co-evolution frequency**:
```bash
--co-evolution-interval 20  # Increase from 10
```

3. **Add population diversity**:
```yaml
co_evolution:
  population_size: 4
```

## Debugging Tips

### Enable Verbose Logging

```bash
--log-level DEBUG
export MILES_DEBUG=1
```

### Check FP8 Tensors

```python
# Verify FP8 is active
for name, param in model.named_parameters():
    print(f"{name}: {param.dtype}")
```

### Profile Training

```bash
--profile
--profile-dir /path/to/profile
```

### Verify R3 Is Working

```python
# Check routing is being recorded
sample = samples[0]
assert sample.rollout_routed_experts is not None
assert len(sample.rollout_routed_experts) > 0
```

### Monitor GPU Memory

```bash
watch -n 1 nvidia-smi
```

## Resources

- GitHub Issues: https://github.com/radixark/miles/issues
- Unified FP8 Blog: https://lmsys.org/blog/2025-11-25-fp8-rl/
- Train-Inference Mismatch Tutorial: https://github.com/zhaochenyang20/Awesome-ML-SYS-Tutorial/blob/main/rlhf/slime/mismatch/blog-en.md
- SGLang Discord: Community support
