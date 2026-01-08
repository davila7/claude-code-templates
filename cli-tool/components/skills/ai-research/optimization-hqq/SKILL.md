---
name: hqq-quantization
description: Half-Quadratic Quantization for LLMs without calibration data. Use when quantizing models to 4/3/2-bit precision without needing calibration datasets, for fast quantization workflows, or when deploying with vLLM or HuggingFace Transformers.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Quantization, HQQ, Optimization, Memory Efficiency, Inference, Model Compression]
dependencies: [hqq>=0.2.0, torch>=2.0.0]
---

# HQQ - Half-Quadratic Quantization

Fast, calibration-free weight quantization supporting 8/4/3/2/1-bit precision with multiple optimized backends.

## When to use HQQ

**Use HQQ when:**
- Quantizing models without calibration data (no dataset needed)
- Need fast quantization (minutes vs hours for GPTQ/AWQ)
- Deploying with vLLM or HuggingFace Transformers
- Fine-tuning quantized models with LoRA/PEFT
- Experimenting with extreme quantization (2-bit, 1-bit)

**Key advantages:**
- **No calibration**: Quantize any model instantly without sample data
- **Multiple backends**: PyTorch, ATEN, TorchAO, Marlin, BitBlas for optimized inference
- **Flexible precision**: 8/4/3/2/1-bit with configurable group sizes
- **Framework integration**: Native HuggingFace and vLLM support
- **PEFT compatible**: Fine-tune quantized models with LoRA

**Use alternatives instead:**
- **AWQ**: Need calibration-based accuracy, production serving
- **GPTQ**: Maximum accuracy with calibration data available
- **bitsandbytes**: Simple 8-bit/4-bit without custom backends
- **llama.cpp/GGUF**: CPU inference, Apple Silicon deployment

## Quick start

### Installation

```bash
pip install hqq

# With specific backend
pip install hqq[torch]      # PyTorch backend
pip install hqq[torchao]    # TorchAO int4 backend
pip install hqq[bitblas]    # BitBlas backend
pip install hqq[marlin]     # Marlin backend
```

### Basic quantization

```python
from hqq.core.quantize import BaseQuantizeConfig, HQQLinear
import torch.nn as nn

# Configure quantization
config = BaseQuantizeConfig(
    nbits=4,           # 4-bit quantization
    group_size=64,     # Group size for quantization
    axis=1             # Quantize along output dimension
)

# Quantize a linear layer
linear = nn.Linear(4096, 4096)
hqq_linear = HQQLinear(linear, config)

# Use normally
output = hqq_linear(input_tensor)
```

### Quantize full model with HuggingFace

```python
from transformers import AutoModelForCausalLM, HqqConfig

# Configure HQQ
quantization_config = HqqConfig(
    nbits=4,
    group_size=64,
    axis=1
)

# Load and quantize
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=quantization_config,
    device_map="auto"
)

# Model is quantized and ready to use
```

## Core concepts

### Quantization configuration

HQQ uses `BaseQuantizeConfig` to define quantization parameters:

```python
from hqq.core.quantize import BaseQuantizeConfig

# Standard 4-bit config
config_4bit = BaseQuantizeConfig(
    nbits=4,           # Bits per weight (1-8)
    group_size=64,     # Weights per quantization group
    axis=1             # 0=input dim, 1=output dim
)

# Aggressive 2-bit config
config_2bit = BaseQuantizeConfig(
    nbits=2,
    group_size=16,     # Smaller groups for low-bit
    axis=1
)

# Mixed precision per layer type
layer_configs = {
    "self_attn.q_proj": BaseQuantizeConfig(nbits=4, group_size=64),
    "self_attn.k_proj": BaseQuantizeConfig(nbits=4, group_size=64),
    "self_attn.v_proj": BaseQuantizeConfig(nbits=4, group_size=64),
    "mlp.gate_proj": BaseQuantizeConfig(nbits=2, group_size=32),
    "mlp.up_proj": BaseQuantizeConfig(nbits=2, group_size=32),
    "mlp.down_proj": BaseQuantizeConfig(nbits=4, group_size=64),
}
```

### HQQLinear layer

The core quantized layer that replaces `nn.Linear`:

```python
from hqq.core.quantize import HQQLinear
import torch

# Create quantized layer
linear = torch.nn.Linear(4096, 4096)
hqq_layer = HQQLinear(linear, config)

# Access quantized weights
W_q = hqq_layer.W_q           # Quantized weights
scale = hqq_layer.scale       # Scale factors
zero = hqq_layer.zero         # Zero points

# Dequantize for inspection
W_dequant = hqq_layer.dequantize()
```

### Backends

HQQ supports multiple inference backends for different hardware:

```python
from hqq.core.quantize import HQQLinear

# Available backends
backends = [
    "pytorch",          # Pure PyTorch (default)
    "pytorch_compile",  # torch.compile optimized
    "aten",            # Custom CUDA kernels
    "torchao_int4",    # TorchAO int4 matmul
    "gemlite",         # GemLite CUDA kernels
    "bitblas",         # BitBlas optimized
    "marlin",          # Marlin 4-bit kernels
]

# Set backend globally
HQQLinear.set_backend("torchao_int4")

# Or per layer
hqq_layer.set_backend("marlin")
```

**Backend selection guide:**
| Backend | Best For | Requirements |
|---------|----------|--------------|
| pytorch | Compatibility | Any GPU |
| pytorch_compile | Moderate speedup | torch>=2.0 |
| aten | Good balance | CUDA GPU |
| torchao_int4 | 4-bit inference | torchao installed |
| marlin | Maximum 4-bit speed | Ampere+ GPU |
| bitblas | Flexible bit-widths | bitblas installed |

## HuggingFace integration

### Load pre-quantized models

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load HQQ-quantized model from Hub
model = AutoModelForCausalLM.from_pretrained(
    "mobiuslabsgmbh/Llama-3.1-8B-HQQ-4bit",
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

# Use normally
inputs = tokenizer("Hello, world!", return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=50)
```

### Quantize and save

```python
from transformers import AutoModelForCausalLM, HqqConfig

# Quantize
config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="auto"
)

# Save quantized model
model.save_pretrained("./llama-8b-hqq-4bit")

# Push to Hub
model.push_to_hub("my-org/Llama-3.1-8B-HQQ-4bit")
```

### Mixed precision quantization

```python
from transformers import AutoModelForCausalLM, HqqConfig

# Different precision per layer type
config = HqqConfig(
    nbits=4,
    group_size=64,
    # Attention layers: higher precision
    # MLP layers: lower precision for memory savings
    dynamic_config={
        "attn": {"nbits": 4, "group_size": 64},
        "mlp": {"nbits": 2, "group_size": 32}
    }
)
```

## vLLM integration

### Serve HQQ models with vLLM

```python
from vllm import LLM, SamplingParams

# Load HQQ-quantized model
llm = LLM(
    model="mobiuslabsgmbh/Llama-3.1-8B-HQQ-4bit",
    quantization="hqq",
    dtype="float16"
)

# Generate
sampling_params = SamplingParams(temperature=0.7, max_tokens=100)
outputs = llm.generate(["What is machine learning?"], sampling_params)
```

### vLLM with custom HQQ config

```python
from vllm import LLM

llm = LLM(
    model="meta-llama/Llama-3.1-8B",
    quantization="hqq",
    quantization_config={
        "nbits": 4,
        "group_size": 64
    }
)
```

## PEFT/LoRA fine-tuning

### Fine-tune quantized models

```python
from transformers import AutoModelForCausalLM, HqqConfig
from peft import LoraConfig, get_peft_model

# Load quantized model
quant_config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=quant_config,
    device_map="auto"
)

# Apply LoRA
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

# Train normally with Trainer or custom loop
```

### QLoRA-style training

```python
from transformers import TrainingArguments, Trainer

training_args = TrainingArguments(
    output_dir="./hqq-lora-output",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    num_train_epochs=3,
    fp16=True,
    logging_steps=10,
    save_strategy="epoch"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    data_collator=data_collator
)

trainer.train()
```

## Quantization workflows

### Workflow 1: Quick model compression

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, HqqConfig

# 1. Configure quantization
config = HqqConfig(nbits=4, group_size=64)

# 2. Load and quantize (no calibration needed!)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

# 3. Verify quality
prompt = "The capital of France is"
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=20)
print(tokenizer.decode(outputs[0]))

# 4. Save
model.save_pretrained("./llama-8b-hqq")
tokenizer.save_pretrained("./llama-8b-hqq")
```

### Workflow 2: Optimize for inference speed

```python
from hqq.core.quantize import HQQLinear
from transformers import AutoModelForCausalLM, HqqConfig

# 1. Quantize with optimal backend
config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="auto"
)

# 2. Set fast backend
HQQLinear.set_backend("marlin")  # or "torchao_int4"

# 3. Compile for additional speedup
import torch
model = torch.compile(model)

# 4. Benchmark
import time
inputs = tokenizer("Hello", return_tensors="pt").to(model.device)
start = time.time()
for _ in range(10):
    model.generate(**inputs, max_new_tokens=100)
print(f"Avg time: {(time.time() - start) / 10:.2f}s")
```

## Best practices

1. **Start with 4-bit**: Best quality/size tradeoff for most models
2. **Use group_size=64**: Good balance; smaller for extreme quantization
3. **Choose backend wisely**: Marlin for 4-bit Ampere+, TorchAO for flexibility
4. **Verify quality**: Always test generation quality after quantization
5. **Mixed precision**: Keep attention at higher precision, compress MLP more
6. **PEFT training**: Use LoRA r=16-32 for good fine-tuning results

## Common issues

**Out of memory during quantization:**
```python
# Quantize layer-by-layer
from hqq.models.hf.base import AutoHQQHFModel

model = AutoHQQHFModel.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="sequential"  # Load layers sequentially
)
```

**Slow inference:**
```python
# Switch to optimized backend
from hqq.core.quantize import HQQLinear
HQQLinear.set_backend("marlin")  # Requires Ampere+ GPU

# Or compile
model = torch.compile(model, mode="reduce-overhead")
```

**Poor quality at 2-bit:**
```python
# Use smaller group size
config = BaseQuantizeConfig(
    nbits=2,
    group_size=16,  # Smaller groups help at low bits
    axis=1
)
```

## References

- **[Advanced Usage](references/advanced-usage.md)** - Custom backends, mixed precision, optimization
- **[Troubleshooting](references/troubleshooting.md)** - Common issues, debugging, benchmarks

## Resources

- **Repository**: https://github.com/mobiusml/hqq
- **Paper**: Half-Quadratic Quantization
- **HuggingFace Models**: https://huggingface.co/mobiuslabsgmbh
- **Version**: 0.2.0+
- **License**: Apache 2.0
