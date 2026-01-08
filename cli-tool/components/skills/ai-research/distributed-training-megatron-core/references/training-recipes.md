# Training Recipes

Complete hyperparameter configurations and training recipes for GPT, LLaMA, and Mixtral models.

## GPT-3 Training Recipes

### GPT-3 15B Configuration

**Model Architecture**:
```yaml
num-layers: 32
hidden-size: 6144
num-attention-heads: 48
ffn-hidden-size: 24576  # 4 × hidden-size
seq-length: 4096
max-position-embeddings: 4096
position-embedding-type: rope
squared-relu: true
group-query-attention: true
num-query-groups: 8
```

**Training Hyperparameters**:
```yaml
# Batch Configuration
micro-batch-size: 4
global-batch-size: 1152
rampup-batch-size: [384, 384, 97656250]  # start, increment, total samples

# Learning Rate Schedule
lr: 4.5e-4
min-lr: 4.5e-5
lr-decay-style: cosine
lr-decay-samples: 1949218748
lr-warmup-samples: 3906252  # ~2B tokens with seq_len=4096

# Optimizer
optimizer: adam
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0

# Precision
bf16: true

# Parallelism
tensor-model-parallel-size: 8
pipeline-model-parallel-size: 1
sequence-parallel: true
use-distributed-optimizer: true
overlap-grad-reduce: true
overlap-param-gather: true
```

**Command**:
```bash
torchrun --nproc_per_node=8 --nnodes=4 pretrain_gpt.py \
  --num-layers 32 \
  --hidden-size 6144 \
  --num-attention-heads 48 \
  --ffn-hidden-size 24576 \
  --seq-length 4096 \
  --max-position-embeddings 4096 \
  --micro-batch-size 4 \
  --global-batch-size 1152 \
  --lr 4.5e-4 \
  --min-lr 4.5e-5 \
  --lr-decay-style cosine \
  --lr-warmup-samples 3906252 \
  --train-samples 1953125000 \
  --adam-beta1 0.9 \
  --adam-beta2 0.95 \
  --weight-decay 0.1 \
  --clip-grad 1.0 \
  --bf16 \
  --tensor-model-parallel-size 8 \
  --pipeline-model-parallel-size 1 \
  --sequence-parallel \
  --use-distributed-optimizer \
  --overlap-grad-reduce \
  --overlap-param-gather \
  --data-path /path/to/data \
  --vocab-file /path/to/vocab.json \
  --merge-file /path/to/merges.txt \
  --save /checkpoints/gpt3-15b \
  --load /checkpoints/gpt3-15b \
  --save-interval 1000 \
  --eval-interval 100
```

### GPT-3 175B Configuration

**Model Architecture**:
```yaml
num-layers: 96
hidden-size: 12288
num-attention-heads: 96
ffn-hidden-size: 49152
seq-length: 2048
max-position-embeddings: 2048
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 1
global-batch-size: 1536
lr: 6e-5
min-lr: 6e-6
lr-decay-style: cosine
lr-warmup-steps: 2000
train-iters: 150000
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 512 GPUs
tensor-model-parallel-size: 4
pipeline-model-parallel-size: 8
# Data parallel: 512 / (4 * 8) = 16
```

## LLaMA Training Recipes

### LLaMA-3 8B

**Model Architecture**:
```yaml
num-layers: 32
hidden-size: 4096
num-attention-heads: 32
num-query-groups: 8  # GQA
ffn-hidden-size: 14336
seq-length: 8192
max-position-embeddings: 8192
position-embedding-type: rope
rope-theta: 500000
normalization: RMSNorm
swiglu: true
untie-embeddings-and-output-weights: true
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 4
global-batch-size: 128
lr: 3e-4
min-lr: 3e-5
lr-decay-style: cosine
lr-warmup-iters: 2000
train-iters: 100000
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 8 GPUs
tensor-model-parallel-size: 1
pipeline-model-parallel-size: 1
context-parallel-size: 2  # For 8K sequences
```

**FP8 Training** (H100):
```bash
./examples/llama/train_llama3_8b_fp8.sh
```

Contents:
```bash
#!/bin/bash
torchrun --nproc_per_node=8 pretrain_gpt.py \
  --num-layers 32 \
  --hidden-size 4096 \
  --num-attention-heads 32 \
  --num-query-groups 8 \
  --ffn-hidden-size 14336 \
  --seq-length 8192 \
  --max-position-embeddings 8192 \
  --micro-batch-size 2 \
  --global-batch-size 128 \
  --lr 3e-4 \
  --train-iters 100000 \
  --lr-decay-style cosine \
  --lr-warmup-iters 2000 \
  --weight-decay 0.1 \
  --clip-grad 1.0 \
  --fp8-hybrid \
  --fp8-amax-history-len 1024 \
  --fp8-amax-compute-algo max \
  --apply-query-key-layer-scaling \
  --attention-softmax-in-fp32 \
  --tensor-model-parallel-size 1 \
  --pipeline-model-parallel-size 1 \
  --context-parallel-size 2 \
  --sequence-parallel \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --data-path /data/llama_train \
  --vocab-file /data/tokenizer.model \
  --save-interval 1000
```

### LLaMA-3 70B

**Model Architecture**:
```yaml
num-layers: 80
hidden-size: 8192
num-attention-heads: 64
num-query-groups: 8
ffn-hidden-size: 28672
seq-length: 4096
max-position-embeddings: 4096
position-embedding-type: rope
rope-theta: 500000
normalization: RMSNorm
swiglu: true
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 1
global-batch-size: 1024
lr: 1.5e-4
min-lr: 1.5e-5
lr-decay-style: cosine
lr-warmup-iters: 2000
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 64 GPUs
tensor-model-parallel-size: 4
pipeline-model-parallel-size: 4
context-parallel-size: 2
# Data parallel: 64 / (4 * 4 * 2) = 2
```

### LLaMA-3.1 405B

**Model Architecture**:
```yaml
num-layers: 126
hidden-size: 16384
num-attention-heads: 128
num-query-groups: 8
ffn-hidden-size: 53248
seq-length: 4096
max-position-embeddings: 131072  # Supports up to 128K
position-embedding-type: rope
rope-theta: 500000
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 1
global-batch-size: 2048
lr: 8e-5
min-lr: 8e-6
lr-decay-style: cosine
lr-warmup-iters: 8000
train-samples: 15000000000000  # 15T tokens
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 1024 GPUs
tensor-model-parallel-size: 8
pipeline-model-parallel-size: 8
context-parallel-size: 2
# Data parallel: 1024 / (8 * 8 * 2) = 8
```

**Production Configuration** (Meta):
```bash
torchrun --nproc_per_node=8 --nnodes=128 pretrain_gpt.py \
  --num-layers 126 \
  --hidden-size 16384 \
  --num-attention-heads 128 \
  --num-query-groups 8 \
  --ffn-hidden-size 53248 \
  --seq-length 4096 \
  --max-position-embeddings 131072 \
  --micro-batch-size 1 \
  --global-batch-size 2048 \
  --lr 8e-5 \
  --min-lr 8e-6 \
  --lr-decay-style cosine \
  --lr-warmup-iters 8000 \
  --train-samples 3662109375 \
  --adam-beta1 0.9 \
  --adam-beta2 0.95 \
  --weight-decay 0.1 \
  --clip-grad 1.0 \
  --bf16 \
  --tensor-model-parallel-size 8 \
  --pipeline-model-parallel-size 8 \
  --context-parallel-size 2 \
  --sequence-parallel \
  --use-distributed-optimizer \
  --overlap-grad-reduce \
  --overlap-param-gather \
  --use-flash-attn-v2 \
  --position-embedding-type rope \
  --normalization RMSNorm \
  --swiglu \
  --untie-embeddings-and-output-weights \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --data-path /data/llama3_pretraining \
  --vocab-file /data/llama3_tokenizer.model \
  --save /checkpoints/llama3-405b \
  --save-interval 500 \
  --eval-interval 100
```

## Mixtral Training Recipes

### Mixtral 8×7B (56B Total, 13B Active)

**Model Architecture**:
```yaml
num-layers: 32
hidden-size: 4096
num-attention-heads: 32
num-query-groups: 8
ffn-hidden-size: 14336
seq-length: 4096
max-position-embeddings: 32768  # Sliding window
position-embedding-type: rope
normalization: RMSNorm
swiglu: true

# MoE Configuration
num-experts: 8
moe-router-topk: 2  # Activate 2 experts per token
moe-router-load-balancing-type: aux_loss
moe-aux-loss-coeff: 0.01
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 2
global-batch-size: 512
lr: 1e-4
min-lr: 1e-5
lr-decay-style: cosine
lr-warmup-iters: 2000
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 64 GPUs
tensor-model-parallel-size: 1
pipeline-model-parallel-size: 4
expert-model-parallel-size: 8
context-parallel-size: 1
# Data parallel: 64 / (1 * 4 * 8 * 1) = 2
```

**Training Command**:
```bash
torchrun --nproc_per_node=8 --nnodes=8 pretrain_gpt.py \
  --num-layers 32 \
  --hidden-size 4096 \
  --num-attention-heads 32 \
  --num-query-groups 8 \
  --ffn-hidden-size 14336 \
  --seq-length 4096 \
  --max-position-embeddings 32768 \
  --micro-batch-size 2 \
  --global-batch-size 512 \
  --lr 1e-4 \
  --min-lr 1e-5 \
  --lr-decay-style cosine \
  --lr-warmup-iters 2000 \
  --train-iters 100000 \
  --adam-beta1 0.9 \
  --adam-beta2 0.95 \
  --weight-decay 0.1 \
  --clip-grad 1.0 \
  --bf16 \
  --tensor-model-parallel-size 1 \
  --pipeline-model-parallel-size 4 \
  --expert-model-parallel-size 8 \
  --num-experts 8 \
  --moe-router-topk 2 \
  --moe-router-load-balancing-type aux_loss \
  --moe-aux-loss-coeff 0.01 \
  --position-embedding-type rope \
  --normalization RMSNorm \
  --swiglu \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --data-path /data/mixtral_train \
  --vocab-file /data/mixtral_tokenizer.model \
  --save /checkpoints/mixtral-8x7b \
  --save-interval 1000
```

### Mixtral 8×22B (176B Total, 39B Active)

**Model Architecture**:
```yaml
num-layers: 56
hidden-size: 6144
num-attention-heads: 48
num-query-groups: 8
ffn-hidden-size: 16384
seq-length: 4096
max-position-embeddings: 65536

# MoE Configuration
num-experts: 8
moe-router-topk: 2
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 1
global-batch-size: 1024
lr: 7e-5
min-lr: 7e-6
lr-decay-style: cosine
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 256 GPUs
tensor-model-parallel-size: 4
pipeline-model-parallel-size: 4
expert-model-parallel-size: 8
# Data parallel: 256 / (4 * 4 * 8) = 2
```

## DeepSeek-V3 (671B Total, 37B Active)

**Model Architecture**:
```yaml
num-layers: 61
hidden-size: 7168
num-attention-heads: 128
num-query-groups: 16
ffn-hidden-size: 18432

# MoE Configuration
num-experts: 256
moe-router-topk: 8  # Multi-head latent attention
shared-expert-intermediate-size: 18432
```

**Training Hyperparameters**:
```yaml
micro-batch-size: 1
global-batch-size: 4096
lr: 2.7e-4
min-lr: 2.7e-5
lr-decay-style: cosine
lr-warmup-tokens: 5B
train-tokens: 14.8T
adam-beta1: 0.9
adam-beta2: 0.95
weight-decay: 0.1
clip-grad: 1.0
bf16: true

# Parallelism for 1024 GPUs
tensor-model-parallel-size: 2
pipeline-model-parallel-size: 16
expert-model-parallel-size: 64
# Data parallel: 1024 / (2 * 16 * 64) = 0.5 (overlapping)
```

## Common Training Patterns

### Batch Size Ramp-Up

Many models use gradual batch size increase:

```yaml
rampup-batch-size: [start_batch, increment, total_samples]
# Example: [384, 384, 97656250]
# Start with 384, increase by 384 every step until total_samples
```

### Learning Rate Schedules

**Cosine Decay** (most common):
```python
lr(step) = min_lr + 0.5 * (max_lr - min_lr) * (1 + cos(π * step / total_steps))
```

**Linear Warmup + Cosine Decay**:
```python
if step < warmup_steps:
    lr(step) = max_lr * step / warmup_steps
else:
    lr(step) = cosine_decay(step - warmup_steps)
```

### Optimizer Settings

**Standard Adam**:
```yaml
optimizer: adam
adam-beta1: 0.9
adam-beta2: 0.95  # Lower than typical 0.999
weight-decay: 0.1
clip-grad: 1.0
```

**Why beta2=0.95?**
- More responsive to recent gradients
- Better for large-scale training
- Proven in GPT-3, LLaMA, Mixtral

### Data Configuration

**Vocabulary Sizes**:
- GPT-3: 50,257 tokens
- LLaMA-3: 128,256 tokens (expanded for multilingual)
- Mixtral: 32,000 tokens

**Typical Data Mix** (by tokens):
- Web pages: 60-70%
- Books: 10-15%
- GitHub code: 5-10%
- Academic papers: 5-10%
- Other (Wikipedia, etc.): 5-10%

## References

- Megatron-LM configurations: `tests/functional_tests/test_cases/`
- LLaMA-3 training: Meta AI technical report
- Mixtral training: Mistral AI blog
- DeepSeek-V3: DeepSeek technical report
