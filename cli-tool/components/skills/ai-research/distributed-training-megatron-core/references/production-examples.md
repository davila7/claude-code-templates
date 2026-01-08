# Production Examples

Real-world production deployments using Megatron-Core and Megatron-LM.

## Meta LLaMA 3

### Overview
- **Models**: 8B, 70B, 405B parameters
- **Training Infrastructure**: Two 24,000 H100 GPU clusters
- **Total Investment**: Massive scale, months of training
- **Training Data**: 15 trillion tokens for 405B model
- **Status**: Production deployed (llama.meta.com)

### LLaMA 3.1 405B - Largest Open Model

**Architecture**:
```yaml
Parameters: 405 billion
Layers: 126
Hidden size: 16384
Attention heads: 128
Query groups: 8 (GQA)
FFN size: 53248
Vocabulary: 128,256 tokens
Max context: 128K tokens (supports up to)
Position encoding: RoPE
Activation: SwiGLU
Normalization: RMSNorm
```

**Training Configuration**:
```bash
# 1024 H100 GPUs (128 nodes × 8 GPUs)
Tensor Parallel (TP): 8     # Within node
Pipeline Parallel (PP): 8    # Across nodes
Context Parallel (CP): 2     # For long sequences
Data Parallel (DP): 8        # Remaining dimension

Total GPUs: 8 × 8 × 2 × 8 = 1024
Effective batch size: 2048
Micro-batch per GPU: 1
Sequence length: 4096 tokens
```

**Performance Metrics**:
- **Sustained throughput**: 400 TFlops/GPU
- **MFU**: ~46% on H100
- **Uptime**: 95%+ over months
- **Efficiency improvement**: 3× vs LLaMA 2 training

**Training Duration**:
- 15 trillion tokens total
- ~54 days on 16,384 H100 GPUs
- Or ~6 months on 1,024 H100 GPUs

**Key Optimizations Used**:
```bash
--use-mcore-models \
--transformer-impl transformer_engine \
--sequence-parallel \
--context-parallel-size 2 \
--use-distributed-optimizer \
--overlap-grad-reduce \
--overlap-param-gather \
--use-flash-attn-v2 \
--bf16
```

**Production Serving**:
- Deployed on llama.meta.com
- Available via API and download
- Used in Meta products (Instagram, Facebook, WhatsApp)

### LLaMA 3 70B

**Training Configuration**:
```bash
# 64 H100 GPUs (8 nodes × 8 GPUs)
TP=4, PP=4, CP=2, DP=2

torchrun --nproc_per_node=8 --nnodes=8 pretrain_gpt.py \
  --num-layers 80 \
  --hidden-size 8192 \
  --num-attention-heads 64 \
  --num-query-groups 8 \
  --seq-length 4096 \
  --micro-batch-size 1 \
  --global-batch-size 1024 \
  --tensor-model-parallel-size 4 \
  --pipeline-model-parallel-size 4 \
  --context-parallel-size 2 \
  --bf16 \
  --use-mcore-models
```

**Memory per GPU**:
- Model parameters: 140GB / 4 (TP) / 4 (PP) = 8.75GB
- Optimizer states: ~17.5GB
- Activations: ~3GB
- **Total**: ~30GB per H100 (fits in 80GB)

## NVIDIA Nemotron-4 340B

### Overview
- **Organization**: NVIDIA
- **Parameters**: 340 billion
- **Framework**: NeMo (built on Megatron-Core)
- **Purpose**: Enterprise AI foundation model
- **Status**: Commercial deployment

**Key Features**:
- Mixture of Experts architecture
- Optimized for enterprise use cases
- NeMo framework integration
- Production-ready deployment

**Architecture**:
```yaml
Type: Mixture of Experts (MoE)
Total parameters: 340B
Active parameters per token: ~40B
Experts: 8
Router: Top-2
Context length: 4096
```

**Training Infrastructure**:
- NVIDIA DGX H100 systems
- Megatron-Core + NeMo
- Multi-node training
- Enterprise-grade fault tolerance

**Production Features**:
- NeMo Guardrails integration
- Enterprise support
- Customization options
- On-premise deployment available

## Microsoft & NVIDIA Megatron-Turing NLG 530B

### Overview
- **Organization**: Microsoft + NVIDIA collaboration
- **Parameters**: 530 billion (largest dense model when released)
- **Year**: 2021
- **Framework**: DeepSpeed ZeRO-3 + Megatron tensor/pipeline parallelism
- **Hardware**: 560 NVIDIA A100 80GB GPUs

**Architecture**:
```yaml
Parameters: 530 billion
Layers: 105
Hidden size: 20480
Attention heads: 128
Vocabulary: 51,200 tokens
Sequence length: 2048
```

**Training Configuration**:
```bash
# 560 A100 80GB GPUs
Tensor Parallel: 8
Pipeline Parallel: 35
Data Parallel: 2
Total: 8 × 35 × 2 = 560

DeepSpeed ZeRO Stage 3:
- Full parameter sharding
- Gradient sharding
- Optimizer state sharding
```

**Innovations**:
- First to combine DeepSpeed ZeRO-3 with Megatron parallelism
- Demonstrated training at 500B+ scale
- Proved viability of extreme parallelism

**Performance**:
- Trained on 339 billion tokens
- Multiple months of training
- Achieved state-of-the-art results in 2021

## BigScience BLOOM 176B

### Overview
- **Organization**: BigScience (1000+ researchers)
- **Parameters**: 176 billion
- **Year**: 2022
- **Framework**: Megatron-DeepSpeed
- **Hardware**: 384 NVIDIA A100 80GB GPUs
- **Training Duration**: 46 days

**Architecture**:
```yaml
Parameters: 176 billion
Layers: 70
Hidden size: 14336
Attention heads: 112
Vocabulary: 250,680 tokens (multilingual)
Sequence length: 2048
Languages: 46 natural languages + 13 programming languages
```

**Training Configuration**:
```bash
# 384 A100 80GB GPUs on Jean Zay supercomputer
Tensor Parallel: 4
Pipeline Parallel: 12
Data Parallel: 8
Total: 4 × 12 × 8 = 384

Global batch size: 2048
Micro-batch size: 4
Learning rate: 6e-5
Optimizer: Adam (β1=0.9, β2=0.95)
```

**Training Data**:
- 366 billion tokens (1.6TB)
- ROOTS corpus (custom multilingual dataset)
- 46 natural languages
- 13 programming languages

**Key Achievements**:
- Largest multilingual open-source model at release
- Trained on public supercomputer (Jean Zay)
- Fully documented training process
- Open-source model and training code

**Public Impact**:
- Downloaded 100,000+ times
- Used in hundreds of research papers
- Enabled multilingual AI research
- Demonstrated open science at scale

## DeepSeek-V3

### Overview
- **Organization**: DeepSeek
- **Parameters**: 671 billion total, 37B active per token
- **Type**: Mixture of Experts (MoE)
- **Year**: 2024-2025
- **Framework**: Megatron-Core

**Architecture**:
```yaml
Type: Mixture of Experts
Total parameters: 671B
Active parameters per token: 37B
Layers: 61
Hidden size: 7168
Attention heads: 128
Query groups: 16
Experts: 256 (massive MoE)
Router top-k: 8 (Multi-head Latent Attention)
Shared expert size: 18432
```

**Training Configuration**:
```bash
# 1024 H100 GPUs
Tensor Parallel (TP): 2
Pipeline Parallel (PP): 16
Expert Parallel (EP): 64
Context Parallel (CP): 1

Total: 2 × 16 × 64 = 2048 slots
# Uses overlapping parallelism

Global batch size: 4096
Sequence length: 4096
Training tokens: 14.8 trillion
```

**Innovations**:
- Multi-head Latent Attention (MLA) router
- Shared experts + routed experts
- Ultra-large expert count (256)
- Advanced load balancing

**Performance**:
- Competitive with GPT-4
- 37B active params rivals 70B+ dense models
- Efficient inference (only 37B active)

## OpenAI GPT-3 175B (2020)

### Overview
- **Organization**: OpenAI
- **Parameters**: 175 billion
- **Year**: 2020
- **Framework**: Megatron-inspired custom implementation
- **Hardware**: Thousands of NVIDIA V100 GPUs

**Architecture**:
```yaml
Parameters: 175 billion
Layers: 96
Hidden size: 12288
Attention heads: 96
FFN size: 49152
Vocabulary: 50,257 tokens (GPT-2 BPE)
Sequence length: 2048
Context window: 2048 tokens
```

**Training Configuration**:
```bash
# Estimated configuration
Tensor Parallel: 4-8
Pipeline Parallel: 8-16
Data Parallel: Remaining GPUs

Global batch size: 1536
Learning rate: 6e-5
Training tokens: 300 billion
```

**Training Compute**:
- 3.14 × 10^23 FLOPs
- Equivalent to ~355 GPU-years on V100
- Estimated cost: $4-12 million

**Impact**:
- Launched modern era of large language models
- Demonstrated few-shot learning
- Foundation for ChatGPT

## Stability AI StableLM

### Overview
- **Organization**: Stability AI
- **Framework**: GPT-NeoX (Megatron + DeepSpeed)
- **Hardware**: Training on supercomputers
- **Status**: Open-source

**Models**:
- StableLM-Base-Alpha: 3B, 7B
- StableLM-Tuned-Alpha: Fine-tuned versions
- StableCode: Code-specialized

**Training Configuration**:
```yaml
Framework: GPT-NeoX
Parallelism: Megatron TP/PP + DeepSpeed ZeRO
GPUs: A100 clusters
Training data: 1.5 trillion tokens (The Pile)
```

**Key Features**:
- Fully open-source (Apache 2.0)
- GPT-NeoX framework
- Trained on The Pile dataset
- Multiple model sizes

## Common Production Patterns

### Fault Tolerance

**Checkpoint Strategy**:
```bash
--save-interval 500              # Save every 500 iterations
--save /checkpoints/model_name  # Checkpoint directory
--load /checkpoints/model_name  # Auto-resume from latest
```

**Monitoring**:
```python
# Check in progress.txt
Job throughput: 45.2 TFLOPs/GPU
Cumulative throughput: 44.8 TFLOPs/GPU
Memory usage: 68.2 GB / 80 GB
Loss: 2.143
```

### Data Pipeline

**Preprocessing**:
```bash
python tools/preprocess_data.py \
  --input data.jsonl \
  --output-prefix /data/processed \
  --vocab-file vocab.json \
  --merge-file merges.txt \
  --tokenizer-type GPT2BPETokenizer \
  --append-eod \
  --workers 64
```

**Training with Preprocessed Data**:
```bash
--data-path /data/processed_text_document \
--split 969,30,1  # Train/valid/test split
```

### Monitoring & Logging

**Key Metrics to Track**:
```bash
# Training metrics
- Loss (should steadily decrease)
- Learning rate (follows schedule)
- Gradient norm (watch for spikes)
- Throughput (TFlops/GPU)
- MFU percentage

# System metrics
- GPU utilization (>90%)
- Memory usage (<95% of capacity)
- Network bandwidth (saturated for TP)
- Data loading time (should be minimal)
```

**Production Monitoring Tools**:
- TensorBoard for loss curves
- Weights & Biases for experiment tracking
- Prometheus + Grafana for system metrics
- Custom scripts for MFU calculation

### Multi-Datacenter Training

**Challenges**:
- Higher latency between datacenters
- Network bandwidth limitations
- Fault isolation

**Solutions**:
```bash
# Keep TP within datacenter
--tensor-model-parallel-size 8  # Single node only

# Use PP across datacenters
--pipeline-model-parallel-size 16  # Across sites

# Data parallel across everything
# Automatic from remaining GPUs
```

## Lessons from Production

1. **Fault Tolerance is Critical**
   - Save checkpoints frequently (every 500-1000 steps)
   - Test checkpoint recovery regularly
   - Monitor for GPU failures

2. **Data Quality Matters More Than Quantity**
   - LLaMA 3: Carefully curated 15T tokens
   - Better than naive web scraping
   - Investment in data preprocessing pays off

3. **Parallelism Strategy Evolves with Scale**
   - <70B: TP + DP sufficient
   - 70-175B: Add PP
   - 175B+: 3D or 4D parallelism required
   - MoE: Add EP dimension

4. **Hardware Matters**
   - H100 vs A100: 2× speedup from better hardware
   - NVLink topology affects TP efficiency
   - InfiniBand essential for multi-node

5. **Monitoring is Essential**
   - Track MFU to catch performance issues
   - Monitor loss for training health
   - Watch memory usage to avoid OOM
   - Log everything for debugging

## References

- Meta LLaMA 3 technical report
- NVIDIA Nemotron blog posts
- Microsoft Megatron-Turing NLG paper
- BigScience BLOOM documentation
- DeepSeek-V3 technical report
