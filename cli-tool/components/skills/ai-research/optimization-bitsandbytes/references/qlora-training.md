# QLoRA Training

Complete guide to fine-tuning large language models using 4-bit quantization with QLoRA (Quantized Low-Rank Adaptation).

## Overview

QLoRA enables fine-tuning 70B+ parameter models on consumer GPUs by:
- Loading base model in 4-bit (75% memory reduction)
- Training only small LoRA adapters (~20MB)
- Maintaining near-full-precision quality

**Memory savings**:
- Llama 2 70B: 140GB → 35GB (4-bit) + 20MB (LoRA) = **35GB total**
- Fits on single A100 80GB!

**Accuracy**: <1% degradation vs full fine-tuning

## Quick Start

### Basic QLoRA Fine-tuning

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import torch

# Step 1: Load model in 4-bit
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=bnb_config,
    device_map="auto",
    torch_dtype=torch.bfloat16
)

# Step 2: Prepare for k-bit training
model = prepare_model_for_kbit_training(model)

# Step 3: Add LoRA adapters
lora_config = LoraConfig(
    r=64,
    lora_alpha=16,
    target_modules="all-linear",
    lora_dropout=0.1,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 335M || all params: 70B || trainable%: 0.48%

# Step 4: Train
from trl import SFTTrainer

training_args = TrainingArguments(
    output_dir="./qlora-70b",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    num_train_epochs=3,
    learning_rate=2e-4,
    bf16=True,
    optim="paged_adamw_8bit",
    logging_steps=10,
    save_strategy="epoch"
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer
)

trainer.train()
```

## Complete Training Workflows

### Workflow 1: Single GPU Training (Consumer GPU)

Train Llama 2 13B on RTX 4090 (24GB).

**Step 1: Prepare dataset**

```python
from datasets import load_dataset

# Load instruction dataset
dataset = load_dataset("timdettmers/openassistant-guanaco")

# Format for instruction tuning
def format_instruction(example):
    return {
        "text": f"### Human: {example['text']}\n### Assistant: {example['output']}"
    }

dataset = dataset.map(format_instruction)
```

**Step 2: Configure quantization**

```python
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,  # BF16 for stability
    bnb_4bit_quant_type="nf4",  # NormalFloat4 (recommended)
    bnb_4bit_use_double_quant=True  # Nested quantization
)
```

**Step 3: Load and prepare model**

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-13b-hf",
    quantization_config=bnb_config,
    device_map="auto"
)

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-13b-hf")
tokenizer.pad_token = tokenizer.eos_token

# Enable gradient checkpointing (further memory savings)
model.gradient_checkpointing_enable()
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
```

**Step 4: Configure LoRA**

```python
from peft import LoraConfig

lora_config = LoraConfig(
    r=16,  # LoRA rank (lower = less memory)
    lora_alpha=32,  # Scaling factor
    target_modules="all-linear",  # Apply to all linear layers
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
```

**Step 5: Train**

```python
training_args = TrainingArguments(
    output_dir="./qlora-13b-results",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,  # Effective batch = 16
    warmup_steps=100,
    num_train_epochs=1,
    learning_rate=2e-4,
    bf16=True,
    logging_steps=10,
    save_strategy="steps",
    save_steps=100,
    eval_strategy="steps",
    eval_steps=100,
    optim="paged_adamw_8bit",  # 8-bit optimizer
    max_grad_norm=0.3,
    max_steps=1000
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    tokenizer=tokenizer,
    max_seq_length=512
)

trainer.train()
```

**Memory usage**: ~18GB on RTX 4090 (24GB)

### Workflow 2: Multi-GPU Training (FSDP + QLoRA)

Train Llama 2 70B on 8×A100 (80GB each).

**Step 1: Configure FSDP-compatible quantization**

```python
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_storage=torch.bfloat16  # CRITICAL for FSDP!
)
```

**Important**: `bnb_4bit_quant_storage=torch.bfloat16` ensures 4-bit layers are wrapped identically to regular layers for FSDP sharding.

**Step 2: Launch with accelerate**

Create `fsdp_config.yaml`:
```yaml
compute_environment: LOCAL_MACHINE
distributed_type: FSDP
fsdp_config:
  fsdp_auto_wrap_policy: TRANSFORMER_BASED_WRAP
  fsdp_backward_prefetch_policy: BACKWARD_PRE
  fsdp_forward_prefetch: true
  fsdp_sharding_strategy: 1  # FULL_SHARD
  fsdp_state_dict_type: SHARDED_STATE_DICT
  fsdp_transformer_layer_cls_to_wrap: LlamaDecoderLayer
mixed_precision: bf16
num_processes: 8
```

**Launch training**:
```bash
accelerate launch --config_file fsdp_config.yaml train_qlora.py
```

**train_qlora.py**:
```python
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=bnb_config,
    torch_dtype=torch.bfloat16
)

# Rest same as single-GPU workflow
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

trainer = SFTTrainer(...)
trainer.train()
```

**Memory per GPU**: ~40GB (70B model sharded across 8 GPUs)

### Workflow 3: Extremely Large Models (405B)

Train Llama 3.1 405B on 8×H100 (80GB each).

**Requirements**:
- 8×H100 80GB GPUs
- 256GB+ system RAM
- FSDP + QLoRA

**Configuration**:
```python
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_storage=torch.bfloat16
)

lora_config = LoraConfig(
    r=32,  # Higher rank for 405B
    lora_alpha=64,
    target_modules="all-linear",
    lora_dropout=0.1,
    bias="none",
    task_type="CAUSAL_LM"
)

training_args = TrainingArguments(
    per_device_train_batch_size=1,  # Small batch
    gradient_accumulation_steps=32,  # Effective batch = 256
    learning_rate=1e-4,  # Lower LR for large model
    bf16=True,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True
)
```

**Memory per GPU**: ~70GB (405B in 4-bit / 8 GPUs)

## Hyperparameter Tuning

### LoRA Rank (r)

Controls adapter capacity:

| Model Size | Recommended r | Trainable Params | Use Case |
|------------|---------------|------------------|----------|
| 7B | 8-16 | ~4M | Simple tasks |
| 13B | 16-32 | ~8M | General fine-tuning |
| 70B | 32-64 | ~80M | Complex tasks |
| 405B | 64-128 | ~300M | Maximum capacity |

**Trade-off**: Higher r = more capacity but more memory and slower training

### LoRA Alpha

Scaling factor for LoRA updates:

```python
effective_learning_rate = learning_rate * (lora_alpha / r)
```

**Recommended**: `lora_alpha = 2 × r`
- r=16 → alpha=32
- r=64 → alpha=128

### Target Modules

**Options**:
- `"all-linear"`: All linear layers (recommended for QLoRA)
- `["q_proj", "v_proj"]`: Only attention (minimal)
- `["q_proj", "k_proj", "v_proj", "o_proj"]`: All attention
- `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]`: Attention + FFN

**Trade-off**: More modules = better performance but more memory

### Learning Rate

| Model Size | Recommended LR |
|------------|----------------|
| 7-13B | 2e-4 to 3e-4 |
| 70B | 1e-4 to 2e-4 |
| 405B | 5e-5 to 1e-4 |

**Rule**: Larger models need lower learning rates

### Batch Size

```python
effective_batch_size = per_device_batch_size × gradient_accumulation_steps × num_gpus
```

**Recommended effective batch sizes**:
- Instruction tuning: 64-128
- Continued pretraining: 256-512

### Quantization Dtype

| Dtype | Speed | Accuracy | Use Case |
|-------|-------|----------|----------|
| `torch.float32` | Slow | Best | Debugging |
| `torch.bfloat16` | Fast | Good | **Recommended** |
| `torch.float16` | Fastest | Risky | May have precision issues |

## Advanced Techniques

### Gradient Checkpointing

Save memory by recomputing activations:

```python
model.gradient_checkpointing_enable()
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
```

**Memory savings**: ~30-40% activation memory
**Cost**: ~20% slower training

### Nested Quantization

Quantize the quantization constants:

```python
bnb_config = BitsAndBytesConfig(
    bnb_4bit_use_double_quant=True  # Enable nested quantization
)
```

**Memory savings**: Additional ~2-3% reduction
**Accuracy**: Minimal impact

### CPU Offloading

For models that still don't fit:

```python
model = AutoModelForCausalLM.from_pretrained(
    "model-name",
    quantization_config=bnb_config,
    device_map="auto",
    max_memory={0: "40GB", "cpu": "100GB"}
)
```

**Trade-off**: Much slower but enables larger models

### Paged Optimizers

Use paged memory for optimizer states:

```python
training_args = TrainingArguments(
    optim="paged_adamw_8bit"  # Or paged_adamw_32bit
)
```

**Benefit**: Prevents OOM from optimizer states

## Deployment

### Save LoRA Adapters

```python
# Save only adapters (~20MB)
model.save_pretrained("./qlora-adapters")
tokenizer.save_pretrained("./qlora-adapters")
```

### Load for Inference

```python
from peft import PeftModel

# Load base model in 4-bit
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=bnb_config,
    device_map="auto"
)

# Load adapters
model = PeftModel.from_pretrained(base_model, "./qlora-adapters")

# Inference
inputs = tokenizer("Question here", return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_length=200)
```

### Merge Adapters (Optional)

```python
# Merge LoRA into base weights
model = model.merge_and_unload()

# Save merged model
model.save_pretrained("./merged-model")
```

**Note**: Merged model loses 4-bit quantization (back to FP16/BF16)

## Troubleshooting

### OOM During Training

1. Reduce batch size:
   ```python
   per_device_train_batch_size=1
   ```

2. Increase gradient accumulation:
   ```python
   gradient_accumulation_steps=16
   ```

3. Lower LoRA rank:
   ```python
   r=8  # Instead of 16
   ```

4. Enable gradient checkpointing

5. Use CPU offloading

### Low Quality Results

1. Increase LoRA rank:
   ```python
   r=64  # Instead of 16
   ```

2. Train longer:
   ```python
   num_train_epochs=3  # Instead of 1
   ```

3. Use more target modules:
   ```python
   target_modules="all-linear"
   ```

4. Check learning rate (try 1e-4 to 3e-4)

### Slow Training

1. Disable gradient checkpointing (if memory allows)

2. Increase batch size

3. Use BF16:
   ```python
   bf16=True
   ```

4. Use paged optimizer

## Best Practices

1. **Start small**: Test on 7B before 70B
2. **Monitor loss**: Should decrease steadily
3. **Use validation**: Track eval loss to detect overfitting
4. **Save checkpoints**: Every 100-500 steps
5. **Log hyperparameters**: For reproducibility
6. **Test inference**: Verify quality before full training

## Example: Complete Training Script

See full working example at `examples/qlora_training.py` in the repository.

## References

- QLoRA paper: "QLoRA: Efficient Finetuning of Quantized LLMs" (Dettmers et al., 2023)
- bitsandbytes GitHub: https://github.com/bitsandbytes-foundation/bitsandbytes
- PEFT documentation: https://huggingface.co/docs/peft
- FSDP+QLoRA guide: https://huggingface.co/blog/fsdp-qlora
