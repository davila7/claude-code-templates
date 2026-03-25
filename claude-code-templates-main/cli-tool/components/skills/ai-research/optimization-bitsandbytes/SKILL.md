---
name: quantizing-models-bitsandbytes
description: Quantizes LLMs to 8-bit or 4-bit for 50-75% memory reduction with minimal accuracy loss. Use when GPU memory is limited, need to fit larger models, or want faster inference. Supports INT8, NF4, FP4 formats, QLoRA training, and 8-bit optimizers. Works with HuggingFace Transformers.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Optimization, Bitsandbytes, Quantization, 8-Bit, 4-Bit, Memory Optimization, QLoRA, NF4, INT8, HuggingFace, Efficient Inference]
dependencies: [bitsandbytes, transformers, accelerate, torch]
---

# bitsandbytes - LLM Quantization

## Quick start

bitsandbytes reduces LLM memory by 50% (8-bit) or 75% (4-bit) with <1% accuracy loss.

**Installation**:
```bash
pip install bitsandbytes transformers accelerate
```

**8-bit quantization** (50% memory reduction):
```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

config = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=config,
    device_map="auto"
)

# Memory: 14GB → 7GB
```

**4-bit quantization** (75% memory reduction):
```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=config,
    device_map="auto"
)

# Memory: 14GB → 3.5GB
```

## Common workflows

### Workflow 1: Load large model in limited GPU memory

Copy this checklist:

```
Quantization Loading:
- [ ] Step 1: Calculate memory requirements
- [ ] Step 2: Choose quantization level (4-bit or 8-bit)
- [ ] Step 3: Configure quantization
- [ ] Step 4: Load and verify model
```

**Step 1: Calculate memory requirements**

Estimate model memory:
```
FP16 memory (GB) = Parameters × 2 bytes / 1e9
INT8 memory (GB) = Parameters × 1 byte / 1e9
INT4 memory (GB) = Parameters × 0.5 bytes / 1e9

Example (Llama 2 7B):
FP16: 7B × 2 / 1e9 = 14 GB
INT8: 7B × 1 / 1e9 = 7 GB
INT4: 7B × 0.5 / 1e9 = 3.5 GB
```

**Step 2: Choose quantization level**

| GPU VRAM | Model Size | Recommended |
|----------|------------|-------------|
| 8 GB | 3B | 4-bit |
| 12 GB | 7B | 4-bit |
| 16 GB | 7B | 8-bit or 4-bit |
| 24 GB | 13B | 8-bit or 70B 4-bit |
| 40+ GB | 70B | 8-bit |

**Step 3: Configure quantization**

For 8-bit (better accuracy):
```python
from transformers import BitsAndBytesConfig
import torch

config = BitsAndBytesConfig(
    load_in_8bit=True,
    llm_int8_threshold=6.0,  # Outlier threshold
    llm_int8_has_fp16_weight=False
)
```

For 4-bit (maximum memory savings):
```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,  # Compute in FP16
    bnb_4bit_quant_type="nf4",  # NormalFloat4 (recommended)
    bnb_4bit_use_double_quant=True  # Nested quantization
)
```

**Step 4: Load and verify model**

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-13b-hf",
    quantization_config=config,
    device_map="auto",  # Automatic device placement
    torch_dtype=torch.float16
)

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-13b-hf")

# Test inference
inputs = tokenizer("Hello, how are you?", return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_length=50)
print(tokenizer.decode(outputs[0]))

# Check memory
import torch
print(f"Memory allocated: {torch.cuda.memory_allocated()/1e9:.2f}GB")
```

### Workflow 2: Fine-tune with QLoRA (4-bit training)

QLoRA enables fine-tuning large models on consumer GPUs.

Copy this checklist:

```
QLoRA Fine-tuning:
- [ ] Step 1: Install dependencies
- [ ] Step 2: Configure 4-bit base model
- [ ] Step 3: Add LoRA adapters
- [ ] Step 4: Train with standard Trainer
```

**Step 1: Install dependencies**

```bash
pip install bitsandbytes transformers peft accelerate datasets
```

**Step 2: Configure 4-bit base model**

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
import torch

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=bnb_config,
    device_map="auto"
)
```

**Step 3: Add LoRA adapters**

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# Prepare model for training
model = prepare_model_for_kbit_training(model)

# Configure LoRA
lora_config = LoraConfig(
    r=16,  # LoRA rank
    lora_alpha=32,  # LoRA alpha
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Add LoRA adapters
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# Output: trainable params: 4.2M || all params: 6.7B || trainable%: 0.06%
```

**Step 4: Train with standard Trainer**

```python
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    output_dir="./qlora-output",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    num_train_epochs=3,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
    save_strategy="epoch"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    tokenizer=tokenizer
)

trainer.train()

# Save LoRA adapters (only ~20MB)
model.save_pretrained("./qlora-adapters")
```

### Workflow 3: 8-bit optimizer for memory-efficient training

Use 8-bit Adam/AdamW to reduce optimizer memory by 75%.

```
8-bit Optimizer Setup:
- [ ] Step 1: Replace standard optimizer
- [ ] Step 2: Configure training
- [ ] Step 3: Monitor memory savings
```

**Step 1: Replace standard optimizer**

```python
import bitsandbytes as bnb
from transformers import Trainer, TrainingArguments

# Instead of torch.optim.AdamW
model = AutoModelForCausalLM.from_pretrained("model-name")

training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=8,
    optim="paged_adamw_8bit",  # 8-bit optimizer
    learning_rate=5e-5
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset
)

trainer.train()
```

**Manual optimizer usage**:
```python
import bitsandbytes as bnb

optimizer = bnb.optim.AdamW8bit(
    model.parameters(),
    lr=1e-4,
    betas=(0.9, 0.999),
    eps=1e-8
)

# Training loop
for batch in dataloader:
    loss = model(**batch).loss
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

**Step 2: Configure training**

Compare memory:
```
Standard AdamW optimizer memory = model_params × 8 bytes (states)
8-bit AdamW memory = model_params × 2 bytes
Savings = 75% optimizer memory

Example (Llama 2 7B):
Standard: 7B × 8 = 56 GB
8-bit: 7B × 2 = 14 GB
Savings: 42 GB
```

**Step 3: Monitor memory savings**

```python
import torch

before = torch.cuda.memory_allocated()

# Training step
optimizer.step()

after = torch.cuda.memory_allocated()
print(f"Memory used: {(after-before)/1e9:.2f}GB")
```

## When to use vs alternatives

**Use bitsandbytes when:**
- GPU memory limited (need to fit larger model)
- Training with QLoRA (fine-tune 70B on single GPU)
- Inference only (50-75% memory reduction)
- Using HuggingFace Transformers
- Acceptable 0-2% accuracy degradation

**Use alternatives instead:**
- **GPTQ/AWQ**: Production serving (faster inference than bitsandbytes)
- **GGUF**: CPU inference (llama.cpp)
- **FP8**: H100 GPUs (hardware FP8 faster)
- **Full precision**: Accuracy critical, memory not constrained

## Common issues

**Issue: CUDA error during loading**

Install matching CUDA version:
```bash
# Check CUDA version
nvcc --version

# Install matching bitsandbytes
pip install bitsandbytes --no-cache-dir
```

**Issue: Model loading slow**

Use CPU offload for large models:
```python
model = AutoModelForCausalLM.from_pretrained(
    "model-name",
    quantization_config=config,
    device_map="auto",
    max_memory={0: "20GB", "cpu": "30GB"}  # Offload to CPU
)
```

**Issue: Lower accuracy than expected**

Try 8-bit instead of 4-bit:
```python
config = BitsAndBytesConfig(load_in_8bit=True)
# 8-bit has <0.5% accuracy loss vs 1-2% for 4-bit
```

Or use NF4 with double quantization:
```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",  # Better than fp4
    bnb_4bit_use_double_quant=True  # Extra accuracy
)
```

**Issue: OOM even with 4-bit**

Enable CPU offload:
```python
model = AutoModelForCausalLM.from_pretrained(
    "model-name",
    quantization_config=config,
    device_map="auto",
    offload_folder="offload",  # Disk offload
    offload_state_dict=True
)
```

## Advanced topics

**QLoRA training guide**: See [references/qlora-training.md](references/qlora-training.md) for complete fine-tuning workflows, hyperparameter tuning, and multi-GPU training.

**Quantization formats**: See [references/quantization-formats.md](references/quantization-formats.md) for INT8, NF4, FP4 comparison, double quantization, and custom quantization configs.

**Memory optimization**: See [references/memory-optimization.md](references/memory-optimization.md) for CPU offloading strategies, gradient checkpointing, and memory profiling.

## Hardware requirements

- **GPU**: NVIDIA with compute capability 7.0+ (Turing, Ampere, Hopper)
- **VRAM**: Depends on model and quantization
  - 4-bit Llama 2 7B: 4GB
  - 4-bit Llama 2 13B: 8GB
  - 4-bit Llama 2 70B: 24GB
- **CUDA**: 11.1+ (12.0+ recommended)
- **PyTorch**: 2.0+

**Supported platforms**: NVIDIA GPUs (primary), AMD ROCm, Intel GPUs (experimental)

## Resources

- GitHub: https://github.com/bitsandbytes-foundation/bitsandbytes
- HuggingFace docs: https://huggingface.co/docs/transformers/quantization/bitsandbytes
- QLoRA paper: "QLoRA: Efficient Finetuning of Quantized LLMs" (2023)
- LLM.int8() paper: "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale" (2022)



