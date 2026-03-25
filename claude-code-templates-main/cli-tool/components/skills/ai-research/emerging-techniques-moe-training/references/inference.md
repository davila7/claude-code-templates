# MoE Inference Optimization

Complete guide to optimizing MoE inference based on MoE-Inference-Bench research (arXiv 2508.17467, 2024).

## Table of Contents
- Performance Metrics
- vLLM Optimizations
- Quantization
- Expert Parallelism
- Optimization Techniques
- Production Deployment

## Performance Metrics

**Source**: MoE-Inference-Bench (arXiv 2508.17467)

### Key Metrics

1. **Time to First Token (TTFT)**
   - Latency until first token generated
   - Critical for user experience

2. **Inter-Token Latency (ITL)**
   - Time between consecutive tokens
   - Affects streaming experience

3. **Throughput**
   - Formula: `(Batch Size × (Input + Output Tokens)) / Total Latency`
   - Higher is better

### Benchmark Results (H100 GPU)

**LLM Performance**:
- **OLMoE-1B-7B**: Highest throughput
- **Mixtral-8x7B**: Highest accuracy, lower throughput
- **Qwen3-30B**: High accuracy, moderate throughput

**VLM Performance**:
- **DeepSeek-VL2-Tiny**: Fastest, lowest accuracy
- **DeepSeek-VL2**: Highest accuracy, lowest throughput

## vLLM Optimizations

**Source**: MoE-Inference-Bench 2024, vLLM documentation

### Expert Parallelism

Distribute experts across GPUs for parallel execution.

```python
from vllm import LLM, SamplingParams

# Enable expert parallelism
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    tensor_parallel_size=2,      # Tensor parallelism
    enable_expert_parallel=True,  # Expert parallelism
    gpu_memory_utilization=0.9
)

# Generate
outputs = llm.generate(
    prompts=["What is mixture of experts?"],
    sampling_params=SamplingParams(temperature=0.7, max_tokens=256)
)
```

### Parallelism Strategies

**From MoE-Inference-Bench**:

| Strategy | Throughput Gain | Best For |
|----------|----------------|----------|
| **Tensor Parallelism** | High | Large models, multi-GPU |
| **Expert Parallelism** | Moderate | MoE-specific, many experts |
| **Pipeline Parallelism** | Low | Very large models |

**Recommendation**: Tensor parallelism most effective for MoE models

### Fused MoE Kernels

**Performance Gain**: 12-18% throughput improvement

```python
# vLLM automatically uses fused kernels when available
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    use_v2_block_manager=True  # Enable fused MoE kernels
)
```

**What it does**:
- Reduces kernel launch overhead
- Combines multiple operations into single kernel
- Better GPU utilization

## Quantization

**Source**: MoE-Inference-Bench quantization analysis

### FP8 Quantization

**Performance**: 20-30% throughput improvement over FP16

```python
from vllm import LLM

# FP8 quantization
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    quantization="fp8"  # FP8 quantization
)
```

**Trade-offs**:
- Throughput: +20-30%
- Memory: -40-50%
- Accuracy: Minimal degradation (<1%)

### INT8 Quantization

```python
# INT8 weight-only quantization
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    quantization="awq"  # or "gptq"
)
```

**Performance**:
- Throughput: +15-20%
- Memory: -50-60%
- Quality: Slight degradation (1-2%)

## Expert Configuration

**Source**: MoE-Inference-Bench hyperparameter analysis

### Active Experts

**Key Finding**: Single-expert activation → 50-80% higher throughput

```python
# Top-1 routing (best throughput)
# Mixtral default is top-2, but top-1 can be enforced at inference

# Model architecture determines this
# Cannot change at runtime, but affects deployment planning
```

**Performance vs Experts**:
- 1 expert/token: +50-80% throughput vs top-2
- 2 experts/token: Balanced (Mixtral default)
- 3+ experts/token: Lower throughput, higher quality

### Total Expert Count

**Scaling**: Non-linear, diminishing returns at high counts

| Total Experts | Throughput | Memory |
|--------------|------------|--------|
| 8 | Baseline | Baseline |
| 16 | +15% | +20% |
| 32 | +25% | +45% |
| 64 | +30% | +90% |
| 128 | +32% | +180% |

**Recommendation**: 8-32 experts for optimal throughput/memory

### FFN Dimension

**Key Finding**: Performance degrades with increasing FFN size

```python
# Smaller FFN = better throughput
# Trade-off: model capacity vs inference speed
```

| FFN Dimension | Throughput | Quality |
|---------------|------------|---------|
| 2048 | High | Moderate |
| 4096 | Moderate | High |
| 8192 | Low | Very High |

## Optimization Techniques

**Source**: MoE-Inference-Bench optimization experiments

### 1. Speculative Decoding

**Performance**: 1.5-2.5× speedup

```python
from vllm import LLM, SamplingParams

# Main model (large MoE)
main_model = LLM(model="mistralai/Mixtral-8x7B-v0.1")

# Draft model (small, fast)
draft_model = LLM(model="Qwen/Qwen3-1.7B")

# Speculative decoding with draft model
# vLLM handles automatically if draft model specified
```

**Best draft models** (from research):
- Medium-sized (1.7B-3B parameters)
- Qwen3-1.7B most effective
- Too small (<1B): low acceptance rate
- Too large (>7B): overhead dominates

### 2. Expert Pruning

**Performance**: 50% pruning → significant throughput gain

```python
# Prune least-used experts (offline)
# Example: Keep top-50% experts by usage

# Requires profiling on representative data:
# 1. Track expert utilization
# 2. Prune unused/rarely-used experts
# 3. Fine-tune pruned model (optional)
```

**Trade-off**:
- 50% pruning: +40-60% throughput, -2-5% accuracy
- 75% pruning: +80-120% throughput, -5-15% accuracy

### 3. Batch Size Tuning

```python
# Larger batches = better throughput (until OOM)
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    max_num_seqs=256,        # Maximum batch size
    max_num_batched_tokens=8192  # Total tokens in batch
)
```

**Optimal batch sizes** (H100):
- Mixtral-8x7B: 64-128
- Smaller MoE (8 experts): 128-256
- Larger MoE (>16 experts): 32-64

## Production Deployment

### Single GPU (Consumer Hardware)

```python
from vllm import LLM

# Optimize for single GPU
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    gpu_memory_utilization=0.95,  # Use 95% of VRAM
    max_num_seqs=32,              # Smaller batches
    quantization="awq"            # Quantize to fit
)
```

**Minimum requirements**:
- Mixtral-8x7B: 48GB VRAM (FP16) or 24GB (INT8)
- Expert parallelism not needed

### Multi-GPU (Data Center)

```python
# Tensor parallelism + Expert parallelism
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",
    tensor_parallel_size=2,       # Split across 2 GPUs
    enable_expert_parallel=True,  # Distribute experts
    gpu_memory_utilization=0.9
)
```

**Scaling strategy**:
- 2 GPUs: Tensor parallelism
- 4+ GPUs: Tensor + expert parallelism
- 8+ GPUs: Consider pipeline parallelism

### Production Configuration

```python
# Optimized for production
llm = LLM(
    model="mistralai/Mixtral-8x7B-v0.1",

    # Parallelism
    tensor_parallel_size=2,
    enable_expert_parallel=True,

    # Memory
    gpu_memory_utilization=0.9,
    swap_space=4,  # 4GB CPU swap

    # Performance
    use_v2_block_manager=True,  # Fused kernels
    max_num_seqs=64,
    max_num_batched_tokens=4096,

    # Optional: Quantization
    quantization="fp8"
)
```

### Monitoring

```python
import time

# Track metrics
def monitor_inference(llm, prompts):
    start = time.time()
    outputs = llm.generate(prompts)
    end = time.time()

    total_time = end - start
    total_tokens = sum(len(o.outputs[0].token_ids) for o in outputs)

    print(f"Throughput: {total_tokens / total_time:.2f} tokens/sec")
    print(f"Latency: {total_time / len(prompts):.2f} sec/request")

    return outputs

# Usage
outputs = monitor_inference(llm, ["Prompt 1", "Prompt 2"])
```

## Optimization Checklist

**From MoE-Inference-Bench best practices:**

- [ ] Use FP8 quantization (20-30% speedup)
- [ ] Enable fused MoE kernels (12-18% speedup)
- [ ] Tune batch size for your hardware
- [ ] Use tensor parallelism for multi-GPU
- [ ] Consider speculative decoding (1.5-2.5× speedup)
- [ ] Profile expert utilization, prune if needed
- [ ] Optimize active expert count (top-1 vs top-2)
- [ ] Monitor and tune GPU memory utilization

## Resources

- **MoE-Inference-Bench**: https://arxiv.org/abs/2508.17467
- **vLLM Documentation**: https://docs.vllm.ai
- **PyTorch MoE Optimization**: https://pytorch.org/blog/accelerating-moe-model/
