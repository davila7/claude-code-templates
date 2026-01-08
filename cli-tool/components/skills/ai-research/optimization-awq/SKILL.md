---
name: awq-quantization
description: Activation-aware weight quantization for 4-bit LLM compression with 3x speedup and minimal accuracy loss. Use when deploying large models (7B-70B) on limited GPU memory, when you need faster inference than GPTQ with better accuracy preservation, or for instruction-tuned and multimodal models. MLSys 2024 Best Paper Award winner.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Optimization, AWQ, Quantization, 4-Bit, Activation-Aware, Memory Optimization, Fast Inference, vLLM Integration, Marlin Kernels]
dependencies: [autoawq, transformers>=4.45.0, torch>=2.0.0]
---

# AWQ (Activation-aware Weight Quantization)

4-bit quantization that preserves salient weights based on activation patterns, achieving 3x speedup with minimal accuracy loss.

## When to use AWQ

**Use AWQ when:**
- Need 4-bit quantization with <5% accuracy loss
- Deploying instruction-tuned or chat models (AWQ generalizes better)
- Want ~2.5-3x inference speedup over FP16
- Using vLLM for production serving
- Have Ampere+ GPUs (A100, H100, RTX 40xx) for Marlin kernel support

**Use GPTQ instead when:**
- Need maximum ecosystem compatibility (more tools support GPTQ)
- Working with ExLlamaV2 backend specifically
- Have older GPUs without Marlin support

**Use bitsandbytes instead when:**
- Need zero calibration overhead (quantize on-the-fly)
- Want to fine-tune with QLoRA
- Prefer simpler integration

## Quick start

### Installation

```bash
# Default (Triton kernels)
pip install autoawq

# With optimized CUDA kernels + Flash Attention
pip install autoawq[kernels]

# Intel CPU/XPU optimization
pip install autoawq[cpu]
```

**Requirements**: Python 3.8+, CUDA 11.8+, Compute Capability 7.5+

### Load pre-quantized model

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_name = "TheBloke/Mistral-7B-Instruct-v0.2-AWQ"

model = AutoAWQForCausalLM.from_quantized(
    model_name,
    fuse_layers=True  # Enable fused attention for speed
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Generate
inputs = tokenizer("Explain quantum computing", return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_new_tokens=200)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

### Quantize your own model

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_path = "mistralai/Mistral-7B-Instruct-v0.2"

# Load model and tokenizer
model = AutoAWQForCausalLM.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)

# Quantization config
quant_config = {
    "zero_point": True,      # Use zero-point quantization
    "q_group_size": 128,     # Group size (128 recommended)
    "w_bit": 4,              # 4-bit weights
    "version": "GEMM"        # GEMM for batch, GEMV for single-token
}

# Quantize (uses pileval dataset by default)
model.quantize(tokenizer, quant_config=quant_config)

# Save
model.save_quantized("mistral-7b-awq")
tokenizer.save_pretrained("mistral-7b-awq")
```

**Timing**: ~10-15 min for 7B, ~1 hour for 70B models.

## AWQ vs GPTQ vs bitsandbytes

| Feature | AWQ | GPTQ | bitsandbytes |
|---------|-----|------|--------------|
| **Speedup (4-bit)** | ~2.5-3x | ~2x | ~1.5x |
| **Accuracy loss** | <5% | ~5-10% | ~5-15% |
| **Calibration** | Minimal (128-1K tokens) | More extensive | None |
| **Overfitting risk** | Low | Higher | N/A |
| **Best for** | Production inference | GPU inference | Easy integration |
| **vLLM support** | Native | Yes | Limited |

**Key insight**: AWQ assumes not all weights are equally important. It protects ~1% of salient weights identified by activation patterns, reducing quantization error without mixed-precision overhead.

## Kernel backends

### GEMM (default, batch inference)

```python
quant_config = {
    "zero_point": True,
    "q_group_size": 128,
    "w_bit": 4,
    "version": "GEMM"  # Best for batch sizes > 1
}
```

### GEMV (single-token generation)

```python
quant_config = {
    "version": "GEMV"  # 20% faster for batch_size=1
}
```

**Limitation**: Only batch size 1, not good for large context.

### Marlin (Ampere+ GPUs)

```python
from transformers import AwqConfig, AutoModelForCausalLM

config = AwqConfig(
    bits=4,
    version="marlin"  # 2x faster on A100/H100
)

model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Mistral-7B-AWQ",
    quantization_config=config
)
```

**Requirements**: Compute Capability 8.0+ (A100, H100, RTX 40xx)

### ExLlamaV2 (AMD compatible)

```python
config = AwqConfig(
    bits=4,
    version="exllama"  # Faster prefill, AMD GPU support
)
```

## HuggingFace Transformers integration

### Direct loading

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/zephyr-7B-alpha-AWQ",
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("TheBloke/zephyr-7B-alpha-AWQ")
```

### Fused modules (recommended)

```python
from transformers import AwqConfig, AutoModelForCausalLM

config = AwqConfig(
    bits=4,
    fuse_max_seq_len=512,  # Max sequence length for fusing
    do_fuse=True           # Enable fused attention/MLP
)

model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Mistral-7B-OpenOrca-AWQ",
    quantization_config=config
)
```

**Note**: Fused modules cannot combine with FlashAttention2.

## vLLM integration

```python
from vllm import LLM, SamplingParams

# vLLM auto-detects AWQ models
llm = LLM(
    model="TheBloke/Llama-2-7B-AWQ",
    quantization="awq",
    dtype="half"
)

sampling = SamplingParams(temperature=0.7, max_tokens=200)
outputs = llm.generate(["Explain AI"], sampling)
```

## Performance benchmarks

### Memory reduction

| Model | FP16 | AWQ 4-bit | Reduction |
|-------|------|-----------|-----------|
| Mistral 7B | 14 GB | 5.5 GB | 2.5x |
| Llama 2-13B | 26 GB | 10 GB | 2.6x |
| Llama 2-70B | 140 GB | 35 GB | 4x |

### Inference speed (RTX 4090)

| Model | Prefill (tok/s) | Decode (tok/s) | Memory |
|-------|-----------------|----------------|--------|
| Mistral 7B GEMM | 3,897 | 114 | 5.55 GB |
| TinyLlama 1B GEMV | 5,179 | 431 | 2.10 GB |
| Llama 2-13B GEMM | 2,279 | 74 | 10.28 GB |

### Accuracy (perplexity)

| Model | FP16 | AWQ 4-bit | Degradation |
|-------|------|-----------|-------------|
| Llama 3 8B | 8.20 | 8.48 | +3.4% |
| Mistral 7B | 5.25 | 5.42 | +3.2% |
| Qwen2 72B | 4.85 | 4.95 | +2.1% |

## Custom calibration data

```python
# Use custom dataset for domain-specific models
model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data="wikitext",       # Or custom list of strings
    max_calib_samples=256,       # More samples = better accuracy
    max_calib_seq_len=512        # Sequence length
)

# Or provide your own samples
calib_samples = [
    "Your domain-specific text here...",
    "More examples from your use case...",
]
model.quantize(tokenizer, quant_config=quant_config, calib_data=calib_samples)
```

## Multi-GPU deployment

```python
model = AutoAWQForCausalLM.from_quantized(
    "TheBloke/Llama-2-70B-AWQ",
    device_map="auto",  # Auto-split across GPUs
    max_memory={0: "40GB", 1: "40GB"}
)
```

## Supported models

35+ architectures including:
- **Llama family**: Llama 2/3, Code Llama, Mistral, Mixtral
- **Qwen**: Qwen, Qwen2, Qwen2.5-VL
- **Others**: Falcon, MPT, Phi, Yi, DeepSeek, Gemma
- **Multimodal**: LLaVA, LLaVA-Next, Qwen2-VL

## Common issues

**CUDA OOM during quantization**:
```python
# Reduce batch size
model.quantize(tokenizer, quant_config=quant_config, max_calib_samples=64)
```

**Slow inference**:
```python
# Enable fused layers
model = AutoAWQForCausalLM.from_quantized(model_name, fuse_layers=True)
```

**AMD GPU support**:
```python
# Use ExLlama backend
config = AwqConfig(bits=4, version="exllama")
```

## Deprecation notice

AutoAWQ is officially deprecated. For new projects, consider:
- **vLLM llm-compressor**: https://github.com/vllm-project/llm-compressor
- **MLX-LM**: For Mac devices with Apple Silicon

Existing quantized models remain usable.

## References

- **Paper**: AWQ: Activation-aware Weight Quantization (arXiv:2306.00978) - MLSys 2024 Best Paper
- **GitHub**: https://github.com/casper-hansen/AutoAWQ
- **MIT Han Lab**: https://github.com/mit-han-lab/llm-awq
- **Models**: https://huggingface.co/models?library=awq
