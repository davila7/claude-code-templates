# Mamba Performance Benchmarks

## Inference Speed Comparison

### Throughput (tokens/sec)

**Mamba-1.4B vs Transformer-1.3B** on single A100 80GB:

| Sequence Length | Mamba-1.4B | Transformer-1.3B | Speedup |
|----------------|------------|------------------|---------|
| 512 | 8,300 | 6,200 | 1.3× |
| 1024 | 7,800 | 4,100 | 1.9× |
| 2048 | 7,200 | 2,300 | 3.1× |
| 4096 | 6,800 | 1,200 | 5.7× |
| 8192 | 6,400 | 600 | **10.7×** |
| 16384 | 6,100 | OOM | ∞ |

**Key insight**: Speedup grows with sequence length (Mamba O(n) vs Transformer O(n²))

### Latency (ms per token)

**Generation latency** (batch size 1, autoregressive):

| Model | First Token | Per Token | 100 Tokens Total |
|-------|-------------|-----------|------------------|
| Mamba-130M | 3 ms | 0.8 ms | 83 ms |
| Transformer-130M | 5 ms | 1.2 ms | 125 ms |
| Mamba-1.4B | 12 ms | 3.2 ms | 332 ms |
| Transformer-1.3B | 18 ms | 8.5 ms | 868 ms |
| Mamba-2.8B | 20 ms | 6.1 ms | 631 ms |
| Transformer-2.7B | 35 ms | 18.2 ms | 1855 ms |

**Mamba advantage**: Constant per-token latency regardless of context length

## Memory Usage

### Training Memory (BF16, per GPU)

**Mamba-1.4B** training memory breakdown:

| Sequence Length | Activations | Gradients | Optimizer | Total | vs Transformer |
|----------------|-------------|-----------|-----------|-------|----------------|
| 512 | 2.1 GB | 3.2 GB | 11.2 GB | 16.5 GB | 0.9× |
| 1024 | 3.8 GB | 3.2 GB | 11.2 GB | 18.2 GB | 0.6× |
| 2048 | 7.2 GB | 3.2 GB | 11.2 GB | 21.6 GB | 0.4× |
| 4096 | 14.1 GB | 3.2 GB | 11.2 GB | 28.5 GB | 0.25× |
| 8192 | 28.0 GB | 3.2 GB | 11.2 GB | 42.4 GB | 0.15× |

**Note**: Transformer OOMs at 8K sequence length on 40GB A100

### Inference Memory (FP16, batch size 1)

| Model | KV Cache (8K ctx) | State (Mamba) | Ratio |
|-------|------------------|---------------|-------|
| 130M | 2.1 GB | 0 MB | ∞ |
| 370M | 5.2 GB | 0 MB | ∞ |
| 1.4B | 19.7 GB | 0 MB | ∞ |
| 2.8B | 38.4 GB | 0 MB | ∞ |

**Mamba stores no KV cache** - constant memory per token!

Actual Mamba state size:
- 130M: ~3 MB (d_model × d_state × n_layers = 768 × 16 × 24)
- 2.8B: ~13 MB (2560 × 16 × 64)

## Language Modeling Benchmarks

### Perplexity on Common Datasets

**Models trained on The Pile (300B tokens)**:

| Model | Params | Pile (val) | WikiText-103 | C4 | Lambada |
|-------|--------|------------|--------------|-----|---------|
| Pythia | 160M | 29.6 | 28.4 | 23.1 | 51.2 |
| **Mamba** | **130M** | **28.1** | **26.7** | **21.8** | **48.3** |
| Pythia | 410M | 18.3 | 17.6 | 16.2 | 32.1 |
| **Mamba** | **370M** | **16.7** | **16.2** | **15.1** | **28.4** |
| Pythia | 1.4B | 10.8 | 10.2 | 11.3 | 15.2 |
| **Mamba** | **1.4B** | **9.1** | **9.6** | **10.1** | **12.8** |
| Pythia | 2.8B | 8.3 | 7.9 | 9.2 | 10.6 |
| **Mamba** | **2.8B** | **7.4** | **7.2** | **8.3** | **9.1** |

**Mamba consistently outperforms** Transformers of similar size by 10-20%

### Zero-Shot Task Performance

**Mamba-2.8B vs Transformer-2.7B** on common benchmarks:

| Task | Mamba-2.8B | Transformer-2.7B | Delta |
|------|------------|------------------|-------|
| HellaSwag | 61.3 | 58.7 | +2.6 |
| PIQA | 78.1 | 76.4 | +1.7 |
| ARC-Easy | 68.2 | 65.9 | +2.3 |
| ARC-Challenge | 42.7 | 40.1 | +2.6 |
| WinoGrande | 64.8 | 62.3 | +2.5 |
| OpenBookQA | 43.2 | 41.8 | +1.4 |
| BoolQ | 71.4 | 68.2 | +3.2 |
| MMLU (5-shot) | 35.2 | 33.8 | +1.4 |

**Average improvement**: +2.2 points across benchmarks

## Audio Modeling Benchmarks

### SC09 (Speech Commands)

**Task**: Audio classification (10 classes)

| Model | Params | Accuracy | Inference (ms) |
|-------|--------|----------|----------------|
| Transformer | 8.2M | 96.2% | 18 ms |
| S4 | 6.1M | 97.1% | 8 ms |
| **Mamba** | **6.3M** | **98.4%** | **6 ms** |

### LJSpeech (Speech Generation)

**Task**: Text-to-speech quality (MOS score)

| Model | Params | MOS ↑ | RTF ↓ |
|-------|--------|-------|-------|
| Transformer | 12M | 3.82 | 0.45 |
| Conformer | 11M | 3.91 | 0.38 |
| **Mamba** | **10M** | **4.03** | **0.21** |

**RTF** (Real-Time Factor): Lower is better (0.21 = 5× faster than real-time)

## Genomics Benchmarks

### Human Reference Genome (HG38)

**Task**: Next nucleotide prediction

| Model | Context Length | Perplexity | Throughput |
|-------|----------------|------------|------------|
| Transformer | 1024 | 3.21 | 1,200 bp/s |
| Hyena | 32768 | 2.87 | 8,500 bp/s |
| **Mamba** | **1M** | **2.14** | **45,000 bp/s** |

**Mamba handles million-length sequences** efficiently

## Scaling Laws

### Compute-Optimal Training

**FLOPs vs perplexity** (The Pile validation):

| Model Size | Training FLOPs | Mamba Perplexity | Transformer Perplexity |
|------------|----------------|------------------|------------------------|
| 130M | 6e19 | 28.1 | 29.6 |
| 370M | 3e20 | 16.7 | 18.3 |
| 790M | 8e20 | 12.3 | 13.9 |
| 1.4B | 2e21 | 9.1 | 10.8 |
| 2.8B | 6e21 | 7.4 | 8.3 |

**Scaling coefficient**: Mamba achieves same perplexity as Transformer with **0.8×** compute

### Parameter Efficiency

**Perplexity 10.0 target** on The Pile:

| Model Type | Parameters Needed | Memory (inference) |
|------------|-------------------|-------------------|
| Transformer | 1.6B | 3.2 GB |
| **Mamba** | **1.1B** | **2.2 GB** |

**Mamba needs ~30% fewer parameters** for same performance

## Long-Range Arena (LRA)

**Task**: Long-context understanding benchmarks

| Task | Length | Transformer | S4 | Mamba |
|------|--------|-------------|-----|-------|
| ListOps | 2K | 36.4% | 59.6% | **61.2%** |
| Text | 4K | 64.3% | 86.8% | **88.1%** |
| Retrieval | 4K | 57.5% | 90.9% | **92.3%** |
| Image | 1K | 42.4% | 88.7% | **89.4%** |
| PathFinder | 1K | 71.4% | 86.1% | **87.8%** |
| Path-X | 16K | OOM | 88.3% | **91.2%** |

**Average**: Mamba 85.0%, S4 83.4%, Transformer 54.4%

## Training Throughput

### Tokens/sec During Training

**8× A100 80GB** cluster, BF16, different sequence lengths:

| Model | Seq Len 512 | Seq Len 2K | Seq Len 8K | Seq Len 32K |
|-------|-------------|------------|------------|-------------|
| Transformer-1.3B | 180K | 52K | OOM | OOM |
| **Mamba-1.4B** | **195K** | **158K** | **121K** | **89K** |
| Transformer-2.7B | 92K | 26K | OOM | OOM |
| **Mamba-2.8B** | **98K** | **81K** | **62K** | **45K** |

**Mamba scales to longer sequences** without OOM

## Hardware Utilization

### GPU Memory Bandwidth

**Mamba-1.4B** inference on different GPUs:

| GPU | Memory BW | Tokens/sec | Efficiency |
|-----|-----------|------------|------------|
| A100 80GB | 2.0 TB/s | 6,800 | 85% |
| A100 40GB | 1.6 TB/s | 5,400 | 84% |
| V100 32GB | 900 GB/s | 3,100 | 86% |
| RTX 4090 | 1.0 TB/s | 3,600 | 90% |

**High efficiency**: Mamba is memory-bandwidth bound (good!)

### Multi-GPU Scaling

**Mamba-2.8B** training throughput:

| GPUs | Tokens/sec | Scaling Efficiency |
|------|------------|-------------------|
| 1× A100 | 12,300 | 100% |
| 2× A100 | 23,800 | 97% |
| 4× A100 | 46,100 | 94% |
| 8× A100 | 89,400 | 91% |
| 16× A100 | 172,000 | 88% |

**Near-linear scaling** up to 16 GPUs

## Cost Analysis

### Training Cost (USD)

**Training to The Pile perplexity 10.0** on cloud GPUs:

| Model | Cloud GPUs | Hours | Cost (A100) | Cost (H100) |
|-------|------------|-------|-------------|-------------|
| Transformer-1.6B | 8× A100 | 280 | $8,400 | $4,200 |
| **Mamba-1.1B** | **8× A100** | **180** | **$5,400** | **$2,700** |

**Savings**: 36% cost reduction vs Transformer

### Inference Cost (USD/million tokens)

**API-style inference** (batch size 1, 2K context):

| Model | Latency | Cost/M tokens | Quality (perplexity) |
|-------|---------|---------------|---------------------|
| Transformer-1.3B | 8.5 ms/tok | $0.42 | 10.8 |
| **Mamba-1.4B** | **3.2 ms/tok** | **$0.18** | **9.1** |

**Mamba provides**: 2.6× faster, 57% cheaper, better quality

## Resources

- Benchmarks code: https://github.com/state-spaces/mamba/tree/main/benchmarks
- Paper (Mamba-1): https://arxiv.org/abs/2312.00752 (Section 4: Experiments)
- Paper (Mamba-2): https://arxiv.org/abs/2405.21060 (Section 5: Experiments)
- Pretrained models: https://huggingface.co/state-spaces
