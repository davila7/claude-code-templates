# Memory Optimization

Complete guide to CPU offloading, gradient checkpointing, memory profiling, and advanced memory-saving strategies with bitsandbytes.

## Overview

Memory optimization techniques for fitting large models:
- **Quantization**: 50-75% reduction (covered in other docs)
- **CPU offloading**: Move weights to CPU/disk
- **Gradient checkpointing**: Trade compute for memory
- **Optimizer strategies**: 8-bit, paged optimizers
- **Mixed precision**: FP16/BF16 training

## CPU Offloading

### Basic CPU Offloading

Move parts of the model to CPU RAM when not in use.

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
import torch

config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=config,
    device_map="auto",  # Automatic device placement
    max_memory={0: "40GB", "cpu": "100GB"}  # 40GB GPU, 100GB CPU
)
```

**How it works**:
- Weights stored on CPU
- Moved to GPU only when needed for computation
- Automatically managed by `accelerate`

**Trade-off**: ~5-10× slower but enables larger models

### Multi-GPU Offloading

Distribute across multiple GPUs + CPU:

```python
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-405b-hf",
    quantization_config=config,
    device_map="auto",
    max_memory={
        0: "70GB",   # GPU 0
        1: "70GB",   # GPU 1
        2: "70GB",   # GPU 2
        3: "70GB",   # GPU 3
        "cpu": "200GB"  # CPU RAM
    }
)
```

**Result**: 405B model (4-bit = ~200GB) fits on 4×80GB GPUs + CPU

### Disk Offloading

For models too large even for CPU RAM:

```python
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-405b-hf",
    quantization_config=config,
    device_map="auto",
    offload_folder="./offload",  # Disk offload directory
    offload_state_dict=True,
    max_memory={0: "40GB", "cpu": "50GB"}
)
```

**Trade-off**: Extremely slow (~100× slower) but works

### Manual Device Mapping

For precise control:

```python
device_map = {
    "model.embed_tokens": 0,  # GPU 0
    "model.layers.0": 0,
    "model.layers.1": 0,
    # ...
    "model.layers.40": 1,  # GPU 1
    "model.layers.41": 1,
    # ...
    "model.layers.79": "cpu",  # CPU
    "model.norm": "cpu",
    "lm_head": "cpu"
}

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=config,
    device_map=device_map
)
```

## Gradient Checkpointing

Recompute activations during backward pass instead of storing them.

### Enable for HuggingFace Models

```python
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-13b-hf",
    quantization_config=config
)

# Enable gradient checkpointing
model.gradient_checkpointing_enable()
```

**Memory savings**: ~30-50% activation memory
**Cost**: ~20% slower training

### With QLoRA

```python
from peft import prepare_model_for_kbit_training

# Enable gradient checkpointing before preparing for training
model.gradient_checkpointing_enable()
model = prepare_model_for_kbit_training(
    model,
    use_gradient_checkpointing=True
)
```

### Configure Checkpointing Frequency

```python
# Checkpoint every layer (maximum memory savings)
model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
```

### Memory Breakdown

Example: Llama 2 13B forward pass

| Component | Without Checkpointing | With Checkpointing |
|-----------|----------------------|-------------------|
| Model weights | 26 GB | 26 GB |
| Activations | 12 GB | **3 GB** |
| Gradients | 26 GB | 26 GB |
| Optimizer | 52 GB | 52 GB |
| **Total** | 116 GB | **107 GB** |

**Savings**: ~9GB for 13B model

## 8-Bit Optimizers

Use 8-bit optimizer states instead of 32-bit.

### Standard AdamW Memory

```
Optimizer memory = 2 × model_params × 4 bytes (FP32)
                 = 8 × model_params

Example (Llama 2 70B):
= 8 × 70B = 560 GB
```

### 8-Bit AdamW Memory

```
Optimizer memory = 2 × model_params × 1 byte (INT8)
                 = 2 × model_params

Example (Llama 2 70B):
= 2 × 70B = 140 GB

Savings: 420 GB (75% reduction!)
```

### Enable in Transformers

```python
from transformers import TrainingArguments

training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=4,
    optim="paged_adamw_8bit",  # 8-bit optimizer
    learning_rate=2e-4
)
```

### Available 8-Bit Optimizers

| Optimizer | Name | Use Case |
|-----------|------|----------|
| AdamW 8-bit | `adamw_8bit` | General training |
| Paged AdamW 8-bit | `paged_adamw_8bit` | **Recommended** (prevents OOM) |
| Paged AdamW 32-bit | `paged_adamw_32bit` | High accuracy needed |

**Recommendation**: Always use `paged_adamw_8bit`

### Manual Usage

```python
import bitsandbytes as bnb

optimizer = bnb.optim.PagedAdamW8bit(
    model.parameters(),
    lr=1e-4,
    betas=(0.9, 0.999),
    eps=1e-8
)
```

## Paged Optimizers

Paged optimizers use unified memory (GPU + CPU) to prevent OOM.

### How It Works

- Optimizer states stored in paged memory
- Pages swap between GPU and CPU as needed
- Prevents hard OOM crashes

### Configuration

```python
from transformers import TrainingArguments

training_args = TrainingArguments(
    optim="paged_adamw_8bit",  # Enables paging
    # Paging happens automatically
)
```

### Benefits

✅ No hard OOM (graceful degradation)
✅ Enables larger batch sizes
✅ Combines with 8-bit for maximum savings

### Performance

**Speed**: ~5-10% slower than standard optimizer
**Memory**: Effectively unlimited (uses CPU + swap)

## Mixed Precision Training

Use lower precision for faster training and less memory.

### BF16 Training (Recommended)

```python
training_args = TrainingArguments(
    bf16=True,  # BFloat16 training
    bf16_full_eval=True
)
```

**Requirements**: Ampere+ GPUs (A100, H100, RTX 3090+)

**Benefits**:
- 2× faster training
- 50% less activation memory
- Better stability than FP16

### FP16 Training

```python
training_args = TrainingArguments(
    fp16=True,  # Float16 training
    fp16_full_eval=True
)
```

**Requirements**: Volta+ GPUs (V100, A100, RTX 2080+)

**Benefits**:
- 2× faster training
- 50% less activation memory
- Slightly less stable than BF16

### Precision Comparison

| Precision | Speed | Memory | Stability | Use Case |
|-----------|-------|--------|-----------|----------|
| FP32 | 1× | 100% | Best | Debugging |
| BF16 | 2× | 50% | Good | **Recommended** |
| FP16 | 2× | 50% | Fair | V100 only |

## Complete Memory Optimization Stack

### Maximum Optimization (Llama 2 70B on Single A100 80GB)

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import torch

# Step 1: 4-bit quantization
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
    max_memory={0: "70GB", "cpu": "100GB"}  # CPU offload if needed
)

# Step 2: Gradient checkpointing
model.gradient_checkpointing_enable()

# Step 3: Prepare for training
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

# Step 4: LoRA adapters
lora_config = LoraConfig(
    r=16,  # Lower rank for memory
    lora_alpha=32,
    target_modules="all-linear",
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

# Step 5: Training arguments
training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=1,  # Small batch
    gradient_accumulation_steps=16,  # Effective batch = 16
    bf16=True,  # Mixed precision
    optim="paged_adamw_8bit",  # 8-bit optimizer
    max_grad_norm=0.3,
    learning_rate=2e-4
)

# Memory usage: ~75GB (fits on A100 80GB!)
```

### Memory Breakdown

| Component | Memory |
|-----------|--------|
| Model (4-bit) | 35 GB |
| LoRA adapters | 0.5 GB |
| Activations (with checkpointing) | 8 GB |
| Gradients | 0.5 GB |
| Optimizer (8-bit paged) | 1 GB |
| Batch buffer | 10 GB |
| CUDA overhead | 5 GB |
| **Total** | **~75 GB** |

## Memory Profiling

### PyTorch Memory Profiler

```python
import torch

# Start profiling
torch.cuda.empty_cache()
torch.cuda.reset_peak_memory_stats()

# Your code here
model = AutoModelForCausalLM.from_pretrained(...)
model.generate(...)

# Check memory
print(f"Allocated: {torch.cuda.memory_allocated()/1e9:.2f} GB")
print(f"Peak: {torch.cuda.max_memory_allocated()/1e9:.2f} GB")
print(f"Cached: {torch.cuda.memory_reserved()/1e9:.2f} GB")
```

### Detailed Memory Summary

```python
print(torch.cuda.memory_summary())
```

Output:
```
|===========================================================================|
|                  PyTorch CUDA memory summary                             |
|---------------------------------------------------------------------------|
| Metric           | Cur Usage | Peak Usage | Tot Alloc | Tot Freed       |
|---------------------------------------------------------------------------|
| Allocated memory | 45.2 GB   | 52.3 GB    | 156.8 GB  | 111.6 GB        |
| Active memory    | 45.2 GB   | 52.3 GB    | 156.8 GB  | 111.6 GB        |
| GPU reserved     | 46.0 GB   | 54.0 GB    | 54.0 GB   | 8.0 GB          |
|===========================================================================|
```

### Track Memory During Training

```python
from transformers import TrainerCallback

class MemoryCallback(TrainerCallback):
    def on_step_end(self, args, state, control, **kwargs):
        if state.global_step % 10 == 0:
            allocated = torch.cuda.memory_allocated() / 1e9
            reserved = torch.cuda.memory_reserved() / 1e9
            print(f"Step {state.global_step}: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")

trainer = Trainer(
    model=model,
    args=training_args,
    callbacks=[MemoryCallback()]
)
```

## Troubleshooting OOM

### Diagnostic Steps

1. **Check current memory**:
   ```python
   print(torch.cuda.memory_summary())
   ```

2. **Try smaller batch**:
   ```python
   per_device_train_batch_size=1
   ```

3. **Enable gradient checkpointing**:
   ```python
   model.gradient_checkpointing_enable()
   ```

4. **Use 8-bit optimizer**:
   ```python
   optim="paged_adamw_8bit"
   ```

5. **Add CPU offloading**:
   ```python
   max_memory={0: "70GB", "cpu": "100GB"}
   ```

6. **Reduce LoRA rank**:
   ```python
   r=8  # Instead of 16
   ```

### Emergency: Last Resort

```python
# Absolute minimum memory config
model = AutoModelForCausalLM.from_pretrained(
    "model-name",
    quantization_config=BitsAndBytesConfig(load_in_4bit=True),
    device_map="auto",
    max_memory={0: "20GB", "cpu": "200GB"},
    offload_folder="./offload"
)

model.gradient_checkpointing_enable()

training_args = TrainingArguments(
    per_device_train_batch_size=1,
    gradient_accumulation_steps=64,
    bf16=True,
    optim="paged_adamw_8bit"
)
```

**Result**: Extremely slow but will probably work

## Best Practices

1. **Start with quantization**: 4-bit gives 75% savings
2. **Add gradient checkpointing**: 30-50% activation savings
3. **Use 8-bit optimizer**: 75% optimizer savings
4. **Enable mixed precision**: 50% activation savings
5. **CPU offload only if needed**: Slow but enables larger models
6. **Profile regularly**: Identify memory bottlenecks
7. **Test with small batches**: Prevent OOM during development

## Memory Estimation Formula

```
Total Memory = Model + Activations + Gradients + Optimizer + Buffer

Model = Parameters × Bytes per param
Activations = Batch × Seq × Hidden × Layers × Bytes per activation
Gradients = Parameters × Bytes per gradient
Optimizer = Parameters × Optimizer factor × Bytes
Buffer = 2-5 GB (CUDA overhead)
```

**With all optimizations**:
```
Model = Parameters × 0.5 (4-bit)
Activations = Activations × 0.3 (checkpointing + BF16)
Gradients = Parameters × 0.5 (LoRA only)
Optimizer = Parameters × 2 (8-bit)
```

## References

- PyTorch memory management: https://pytorch.org/docs/stable/notes/cuda.html
- Accelerate device_map: https://huggingface.co/docs/accelerate/usage_guides/big_modeling
- Gradient checkpointing: https://pytorch.org/docs/stable/checkpoint.html
- bitsandbytes optimizers: https://github.com/bitsandbytes-foundation/bitsandbytes#optimizer
