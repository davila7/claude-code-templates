# Performance Benchmarks

Performance metrics and benchmarks for Megatron-Core across different model sizes and hardware configurations.

## Model FLOP Utilization (MFU)

**H100 Clusters**: Up to 47% MFU achieved

MFU increases with larger model sizes due to higher arithmetic intensity in larger matrix multiplications (GEMMs).

## Throughput Metrics by Model Size

### GPT-3 175B
- **Hardware**: H100
- **Configuration**: TP=4, PP=8
- **GPUs**: 128-512
- **MFU**: 47% on H100
- **Throughput**: 390 TFlops/GPU on H100

### LLaMA Configurations

| Model | Size | GPUs | TP | PP | CP | Seq Length | Hardware | Notes |
|-------|------|------|----|----|----| -----------|----------|-------|
| LLaMA-3 | 8B | 8 | 1 | 1 | 2 | 8K | H100 | CP for long sequences |
| LLaMA-3 | 70B | 64 | 4 | 4 | 2 | 4K | H100 | TP+PP parallelism |
| LLaMA-3.1 | 405B | 1024 | 8 | 8 | 2 | 4K | H100 | 3D parallelism |

**LLaMA-3 405B Details**:
- 16K H100 GPUs (two 24K GPU clusters)
- TP=8, PP=8, CP=2
- 400 TFlops/GPU average
- 95%+ uptime
- 3× efficiency improvement vs LLaMA 2

### Mixtral (Mixture of Experts)

| Model | Active Params | Total Params | GPUs | TP | PP | EP | Experts | Hardware |
|-------|---------------|--------------|------|----|----|----|---------| ---------|
| Mixtral | 7B (active) | 8×7B (56B) | 64 | 1 | 4 | 8 | 8 | H100 |
| Mixtral | 22B (active) | 8×22B (176B) | 256 | 4 | 4 | 8 | 8 | H100 |

### DeepSeek-V3

- **Active Parameters**: 37B per token
- **Total Parameters**: 671B
- **GPUs**: 1024 H100
- **Configuration**: TP=2, PP=16, EP=64
- **Parallelism**: 4D with Expert Parallel

### GPT-462B (Largest Benchmark)

- **Parameters**: 462B
- **GPUs**: 6144 H100
- **MFU**: 47-48%
- **Throughput**: ~390 TFlops/GPU

## Hardware Performance Characteristics

### NVIDIA H100 (Hopper)
- **Peak Performance**:
  - FP16: 1979 TFlops
  - BF16: 1979 TFlops
  - FP8: 3958 TFlops
- **Memory**: 80GB HBM3
- **Memory Bandwidth**: 3.35 TB/s
- **NVLink**: 900 GB/s per GPU

**Achieved MFU**: 40-47% (typical range)

### NVIDIA A100 (Ampere)
- **Peak Performance**:
  - FP16: 312 TFlops (with sparsity)
  - BF16: 312 TFlops
- **Memory**: 40GB or 80GB HBM2e
- **Memory Bandwidth**: 2 TB/s
- **NVLink**: 600 GB/s per GPU

**Typical MFU**: 35-42%

## Weak Scaling (Fixed Per-GPU Workload)

As you add more GPUs while keeping per-GPU workload constant:

| GPUs | Model Size | MFU | Efficiency |
|------|------------|-----|------------|
| 8 | 7B | 42% | 100% (baseline) |
| 64 | 70B | 44% | 95% |
| 512 | 175B | 45% | 93% |
| 1024 | 405B | 46% | 90% |
| 6144 | 462B | 47% | 88% |

## Strong Scaling (Fixed Total Workload)

Distributing a fixed model across more GPUs:

| Model | GPUs | Time per Iteration | Speedup | Efficiency |
|-------|------|-------------------|---------|------------|
| 70B | 64 | 1.0× (baseline) | 1.0× | 100% |
| 70B | 128 | 0.52× | 1.92× | 96% |
| 70B | 256 | 0.27× | 3.70× | 93% |

## Throughput Calculations

**Formula**:
```
Throughput (TFlops/GPU) = Total FLOPs / (Time × Number of GPUs × 10^12)
```

**Example (GPT-3 175B)**:
- Forward + Backward pass: 3 × (model FLOPs)
- Per-token FLOPs: ~350 billion for 175B model
- Batch size: 1536 (global)
- Sequence length: 2048
- Time per iteration: ~5 seconds on 512 H100s
- Throughput: ~390 TFlops/GPU

## Memory Usage vs Model Size

| Model Size | Parameters | Memory (FP16) | Memory (BF16) | Memory (FP8) |
|------------|------------|---------------|---------------|--------------|
| 7B | 7 billion | 14 GB | 14 GB | 7 GB |
| 13B | 13 billion | 26 GB | 26 GB | 13 GB |
| 70B | 70 billion | 140 GB | 140 GB | 70 GB |
| 175B | 175 billion | 350 GB | 350 GB | 175 GB |
| 405B | 405 billion | 810 GB | 810 GB | 405 GB |

**Note**: These are model weights only. Add ~2× for gradients and optimizer states during training.

## Communication Overhead

### Tensor Parallelism (TP)
- **Bandwidth Required**: ~20 GB/GPU for LLaMA 70B with TP=4
- **Frequency**: Every layer (80+ layers)
- **Best Practice**: Use NVLink, keep TP ≤8 within single node

### Pipeline Parallelism (PP)
- **Bandwidth Required**: Activation size only (~100s of MB)
- **Frequency**: Between pipeline stages
- **Best Practice**: Use for cross-node scaling

### Data Parallelism (DP)
- **Bandwidth Required**: Full gradient size
- **Frequency**: Once per iteration
- **Best Practice**: Use for remaining parallelism after TP/PP

## Optimization Impact

### Flash Attention
- **Speedup**: 2-4× on attention layers
- **Memory**: 10-20× reduction
- **Overall Impact**: ~30% faster training

### Sequence Parallelism
- **Memory Savings**: Activation memory / TP degree
- **Example**: With TP=4, saves 75% of activation memory
- **No Performance Cost**: Communication already happening

### Context Parallelism
- **Use Case**: Sequences >8K tokens
- **Memory Savings**: KV cache / CP degree
- **Communication**: Ring all-to-all pattern

### FP8 Training (H100 Only)
- **Speedup**: 1.5-2× vs BF16
- **Memory**: 50% reduction vs BF16
- **Quality**: Minimal degradation with proper scaling

## Production Deployments

### Meta LLaMA 3 Training
- **Models**: 8B, 70B, 405B
- **Cluster**: Two 24K H100 clusters
- **Efficiency**: 400 TFlops/GPU sustained
- **Uptime**: 95%+
- **Total Tokens**: 15 trillion for 405B model

### Microsoft Megatron-Turing NLG 530B
- **GPUs**: 560 NVIDIA A100 (80GB)
- **Parallelism**: DeepSpeed ZeRO-3 + Megatron TP/PP
- **Duration**: Several months
- **Year**: 2021

### NVIDIA Nemotron-4 340B
- **Architecture**: Mixture of Experts
- **Framework**: NeMo (built on Megatron-Core)
- **Production**: Commercial deployment

## Benchmarking Best Practices

1. **Measure Sustained Performance**: Not peak, measure over 100+ iterations
2. **Include All Operations**: Forward, backward, optimizer step, communication
3. **Report MFU**: Use theoretical peak FLOPs of hardware
4. **Specify Configuration**: TP, PP, CP, EP degrees, batch sizes, sequence length
5. **Note Optimizations**: Flash Attention, FP8, sequence parallel, etc.

## How to Measure Your Own Performance

**Enable profiling**:
```bash
torchrun pretrain_gpt.py \
  --profile \
  --profile-step-start 10 \
  --profile-step-end 20
```

**Calculate MFU**:
```python
# Megatron logs this automatically
# Check logs for:
# - elapsed time per iteration (seconds)
# - samples per second
# - TFLOPs/s per GPU
# - MFU percentage
```

**Key Metrics to Track**:
- Elapsed time per iteration
- Throughput (TFlops/GPU)
- MFU (%)
- Memory usage (GB)
- Communication time (% of total)

## Troubleshooting Low Performance

**If MFU < 30%**:
1. Check micro-batch size (increase if possible)
2. Enable all optimizations (Flash Attention, sequence parallel, etc.)
3. Verify communication backend (NCCL properly configured)
4. Check for data loading bottlenecks
5. Ensure proper CPU-GPU pipeline

**If Communication Heavy** (>30% of time):
1. Reduce TP degree (especially across nodes)
2. Use interleaved pipeline schedule
3. Enable communication overlap flags
4. Check network topology (InfiniBand vs Ethernet)

**If Memory Bound**:
1. Enable gradient checkpointing
2. Use lower precision (BF16 or FP8)
3. Increase parallelism degrees
4. Reduce micro-batch size

## References

- NVIDIA Megatron-LM GitHub: https://github.com/NVIDIA/Megatron-LM
- Performance Docs: https://docs.nvidia.com/megatron-core/
- LLaMA 3 Paper: Meta AI
- DeepSeek-V3 Technical Report
