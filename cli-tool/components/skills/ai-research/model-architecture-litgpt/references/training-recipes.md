# Training Recipes

Complete hyperparameter configurations for LoRA, QLoRA, and full fine-tuning across different model sizes.

## Overview

LitGPT provides optimized training configurations in `config_hub/finetune/` for various model architectures and fine-tuning methods.

**Key Configuration Files**:
- `config_hub/finetune/*/lora.yaml` - LoRA fine-tuning
- `config_hub/finetune/*/qlora.yaml` - 4-bit quantized LoRA
- `config_hub/finetune/*/full.yaml` - Full fine-tuning

## LoRA Fine-tuning Recipes

### TinyLlama 1.1B LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 8
lr_warmup_steps: 10
epochs: 3
max_seq_length: 512

# LoRA specific
lora_r: 8
lora_alpha: 16
lora_dropout: 0.05
```

**Command**:
```bash
litgpt finetune_lora TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T \
  --data JSON \
  --data.json_path data/alpaca_sample.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 8 \
  --train.lr_warmup_steps 10 \
  --train.epochs 3 \
  --train.max_seq_length 512 \
  --lora_r 8 \
  --lora_alpha 16
```

**Memory**: ~4GB VRAM
**Time**: ~30 minutes on RTX 3090

### Llama 2 7B LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512

# LoRA specific
lora_r: 8
lora_alpha: 16
lora_dropout: 0.05
```

**Command**:
```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 2 \
  --train.lr_warmup_steps 10 \
  --train.epochs 4 \
  --lora_r 8 \
  --lora_alpha 16
```

**Memory**: ~16GB VRAM
**Gradient Accumulation**: 4 steps (8 / 2)
**Time**: ~6 hours on A100

### Llama 3 8B LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 1
lr_warmup_steps: 10
epochs: 2
max_seq_length: 512

# LoRA specific
lora_r: 8
lora_alpha: 16
lora_dropout: 0.05
```

**Command**:
```bash
litgpt finetune_lora meta-llama/Llama-3.2-8B \
  --data JSON \
  --data.json_path data/custom_dataset.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 1 \
  --train.lr_warmup_steps 10 \
  --train.epochs 2 \
  --lora_r 8
```

**Memory**: ~20GB VRAM
**Gradient Accumulation**: 8 steps
**Time**: ~8 hours on A100

### Mistral 7B LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512

lora_r: 8
lora_alpha: 16
```

**Command**:
```bash
litgpt finetune_lora mistralai/Mistral-7B-v0.1 \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 2 \
  --train.epochs 4 \
  --lora_r 8
```

**Memory**: ~16GB VRAM

### Phi-2 LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 4
lr_warmup_steps: 10
epochs: 1
max_seq_length: 512

lora_r: 8
lora_alpha: 16
```

**Command**:
```bash
litgpt finetune_lora microsoft/phi-2 \
  --data JSON \
  --data.json_path data/alpaca_sample.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 4 \
  --train.epochs 1 \
  --lora_r 8
```

**Memory**: ~8GB VRAM
**Time**: ~20 minutes on RTX 3090

### Falcon 7B LoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 1
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512

lora_r: 8
lora_alpha: 16
```

**Command**:
```bash
litgpt finetune_lora tiiuae/falcon-7b \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 1 \
  --train.epochs 4 \
  --lora_r 8
```

**Memory**: ~18GB VRAM

### Gemma 7B LoRA

**Configuration**:
```yaml
global_batch_size: 6
micro_batch_size: 1
lr_warmup_steps: 200
epochs: 2
max_seq_length: 512

lora_r: 8
lora_alpha: 16
```

**Command**:
```bash
litgpt finetune_lora google/gemma-7b \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 6 \
  --train.micro_batch_size 1 \
  --train.lr_warmup_steps 200 \
  --train.epochs 2 \
  --lora_r 8
```

**Memory**: ~18GB VRAM
**Note**: Longer warmup (200 steps) for stability

## QLoRA Fine-tuning Recipes

QLoRA uses 4-bit quantization to reduce memory by ~75%.

### TinyLlama 1.1B QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 8
lr_warmup_steps: 10
epochs: 3
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Command**:
```bash
litgpt finetune_lora TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T \
  --quantize bnb.nf4 \
  --data JSON \
  --data.json_path data/alpaca_sample.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 8 \
  --train.epochs 3 \
  --lora_r 8
```

**Memory**: ~2GB VRAM (75% reduction)

### Llama 2 7B QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512
min_lr: 6.0e-5

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Command**:
```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --quantize bnb.nf4 \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 2 \
  --train.epochs 4 \
  --lora_r 8
```

**Memory**: ~6GB VRAM (consumer GPU friendly)

### Llama 3 8B QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 10
epochs: 2
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Command**:
```bash
litgpt finetune_lora meta-llama/Llama-3.2-8B \
  --quantize bnb.nf4 \
  --data JSON \
  --data.json_path data/custom_dataset.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 2 \
  --train.epochs 2 \
  --lora_r 8
```

**Memory**: ~8GB VRAM

### Mistral 7B QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Memory**: ~6GB VRAM

### Phi-2 QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 4
lr_warmup_steps: 10
epochs: 1
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Memory**: ~3GB VRAM

### Falcon 7B QLoRA

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 1
lr_warmup_steps: 10
epochs: 4
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Memory**: ~6GB VRAM

### Gemma 2B QLoRA

**Configuration**:
```yaml
global_batch_size: 6
micro_batch_size: 2
lr_warmup_steps: 200
epochs: 2
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Memory**: ~3GB VRAM

### Gemma 7B QLoRA

**Configuration**:
```yaml
global_batch_size: 6
micro_batch_size: 1
lr_warmup_steps: 200
epochs: 2
max_seq_length: 512

lora_r: 8
lora_alpha: 16
quantize: "bnb.nf4"
```

**Memory**: ~6GB VRAM

## Full Fine-tuning Recipes

Full fine-tuning updates all model parameters (requires more memory).

### TinyLlama 1.1B Full

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 2
lr_warmup_steps: 100
epochs: 3
max_seq_length: 512
learning_rate: 5e-5
```

**Command**:
```bash
litgpt finetune_full TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 2 \
  --train.lr_warmup_steps 100 \
  --train.epochs 3 \
  --train.learning_rate 5e-5
```

**Memory**: ~12GB VRAM
**Time**: ~4 hours on A100

### Phi-2 Full

**Configuration**:
```yaml
global_batch_size: 8
micro_batch_size: 1
lr_warmup_steps: 100
epochs: 2
max_seq_length: 512
learning_rate: 3e-5
```

**Command**:
```bash
litgpt finetune_full microsoft/phi-2 \
  --data JSON \
  --data.json_path data/alpaca.json \
  --train.global_batch_size 8 \
  --train.micro_batch_size 1 \
  --train.epochs 2 \
  --train.learning_rate 3e-5
```

**Memory**: ~24GB VRAM

## Common Hyperparameter Patterns

### Learning Rates

| Model Size | LoRA LR | Full Fine-tune LR |
|------------|---------|-------------------|
| <2B | 3e-4 | 5e-5 |
| 2-10B | 1e-4 | 3e-5 |
| 10-70B | 5e-5 | 1e-5 |

### LoRA Rank (r)

- **r=8**: Default, good balance (recommended)
- **r=16**: More capacity, 2× trainable params
- **r=32**: Maximum capacity, slower training
- **r=4**: Minimal, fastest training

**Rule of thumb**: Start with r=8, increase if underfitting.

### Batch Sizes

| GPU VRAM | Micro Batch | Global Batch |
|----------|-------------|--------------|
| 8GB | 1 | 8 |
| 16GB | 2 | 8-16 |
| 40GB | 4 | 16-32 |
| 80GB | 8 | 32-64 |

### Warmup Steps

- **Small models (<2B)**: 10-50 steps
- **Medium models (2-10B)**: 100-200 steps
- **Large models (>10B)**: 200-500 steps

### Epochs

- **Instruction tuning**: 1-3 epochs
- **Domain adaptation**: 3-5 epochs
- **Small datasets (<10K)**: 5-10 epochs

## Advanced Configurations

### Custom Learning Rate Schedule

```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --train.learning_rate 3e-4 \
  --train.lr_warmup_steps 100 \
  --train.min_lr 3e-6 \
  --train.lr_decay_iters 10000
```

### Gradient Accumulation

```bash
# Simulate global_batch_size=128 with 16GB GPU
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --train.global_batch_size 128 \
  --train.micro_batch_size 2
# Accumulates over 64 steps (128 / 2)
```

### Mixed Precision

```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --precision bf16-mixed  # BF16 mixed precision
# or
  --precision 16-mixed  # FP16 mixed precision
```

### Longer Context

```bash
litgpt finetune_lora meta-llama/Llama-3.1-8B \
  --train.max_seq_length 8192 \
  --train.micro_batch_size 1  # Reduce batch for memory
```

## Memory Optimization

### Out of Memory? Try These

1. **Enable quantization**:
   ```bash
   --quantize bnb.nf4  # 4-bit QLoRA
   ```

2. **Reduce batch size**:
   ```bash
   --train.micro_batch_size 1
   ```

3. **Lower LoRA rank**:
   ```bash
   --lora_r 4  # Instead of 8
   ```

4. **Use FSDP** (multi-GPU):
   ```bash
   litgpt finetune_lora meta-llama/Llama-2-7b-hf \
     --devices 4  # Use 4 GPUs with FSDP
   ```

5. **Gradient checkpointing**:
   ```bash
   --train.gradient_accumulation_iters 16
   ```

## Data Format

LitGPT expects JSON data in instruction format:

```json
[
  {
    "instruction": "What is the capital of France?",
    "input": "",
    "output": "The capital of France is Paris."
  },
  {
    "instruction": "Translate to Spanish:",
    "input": "Hello world",
    "output": "Hola mundo"
  }
]
```

**Load custom data**:
```bash
litgpt finetune_lora meta-llama/Llama-2-7b-hf \
  --data JSON \
  --data.json_path data/my_dataset.json \
  --data.val_split_fraction 0.1  # 10% validation
```

## Merge and Deploy

After fine-tuning, merge LoRA weights:

```bash
litgpt merge_lora checkpoints/meta-llama/Llama-2-7b-hf/final_lora.pth
```

Generate with merged model:

```bash
litgpt generate checkpoints/meta-llama/Llama-2-7b-hf-merged/ \
  --prompt "What is machine learning?"
```

Or serve via API:

```bash
litgpt serve checkpoints/meta-llama/Llama-2-7b-hf-merged/
```

## References

- Configuration hub: `config_hub/finetune/`
- Fine-tuning tutorial: `tutorials/finetune_*.md`
- Memory guide: `tutorials/oom.md`
