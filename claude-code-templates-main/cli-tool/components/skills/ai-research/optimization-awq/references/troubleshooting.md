# AWQ Troubleshooting Guide

## Installation Issues

### CUDA Version Mismatch

**Error**: `RuntimeError: CUDA error: no kernel image is available for execution`

**Fix**: Install matching CUDA version:
```bash
# Check your CUDA version
nvcc --version

# Install matching autoawq
pip install autoawq --extra-index-url https://download.pytorch.org/whl/cu118  # For CUDA 11.8
pip install autoawq --extra-index-url https://download.pytorch.org/whl/cu121  # For CUDA 12.1
```

### Compute Capability Too Low

**Error**: `AssertionError: Compute capability must be >= 7.5`

**Fix**: AWQ requires NVIDIA GPUs with compute capability 7.5+ (Turing or newer):
- RTX 20xx series: 7.5 (supported)
- RTX 30xx series: 8.6 (supported)
- RTX 40xx series: 8.9 (supported)
- A100/H100: 8.0/9.0 (supported)

Older GPUs (GTX 10xx, V100) are not supported.

### Transformers Version Conflict

**Error**: `ImportError: cannot import name 'AwqConfig'`

**Fix**: AutoAWQ may downgrade transformers. Reinstall correct version:
```bash
pip install autoawq
pip install transformers>=4.45.0 --upgrade
```

### Triton Not Found (Linux)

**Error**: `ModuleNotFoundError: No module named 'triton'`

**Fix**:
```bash
pip install triton
# Or install with kernels
pip install autoawq[kernels]
```

## Quantization Issues

### CUDA Out of Memory During Quantization

**Error**: `torch.cuda.OutOfMemoryError: CUDA out of memory`

**Solutions**:

1. **Reduce calibration samples**:
```python
model.quantize(
    tokenizer,
    quant_config=quant_config,
    max_calib_samples=64  # Reduce from 128
)
```

2. **Use CPU offloading**:
```python
model = AutoAWQForCausalLM.from_pretrained(
    model_path,
    low_cpu_mem_usage=True
)
```

3. **Multi-GPU quantization**:
```python
model = AutoAWQForCausalLM.from_pretrained(
    model_path,
    device_map="auto"
)
```

### NaN in Weights After Quantization

**Error**: `AssertionError: NaN detected in weights`

**Cause**: Calibration data issues or numerical instability.

**Fix**:
```python
# Use more calibration samples
model.quantize(
    tokenizer,
    quant_config=quant_config,
    max_calib_samples=256,
    max_calib_seq_len=1024
)
```

### Empty Calibration Samples

**Error**: `ValueError: Calibration samples are empty`

**Fix**: Ensure tokenizer produces valid output:
```python
# Check tokenizer
test = tokenizer("test", return_tensors="pt")
print(f"Token count: {test.input_ids.shape[1]}")

# Use explicit calibration data
calib_data = ["Your sample text here..."] * 128
model.quantize(tokenizer, quant_config=quant_config, calib_data=calib_data)
```

### Unsupported Model Architecture

**Error**: `TypeError: 'model_type' is not supported`

**Cause**: Model architecture not in AWQ registry.

**Check supported models**:
```python
from awq.models import AWQ_CAUSAL_LM_MODEL_MAP
print(list(AWQ_CAUSAL_LM_MODEL_MAP.keys()))
```

**Supported**: llama, mistral, qwen2, falcon, mpt, phi, gemma, etc.

## Inference Issues

### Slow Inference Speed

**Problem**: Inference slower than expected.

**Solutions**:

1. **Enable layer fusion**:
```python
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    fuse_layers=True
)
```

2. **Use correct kernel for batch size**:
```python
# For batch_size=1
quant_config = {"version": "GEMV"}

# For batch_size>1
quant_config = {"version": "GEMM"}
```

3. **Use Marlin on Ampere+ GPUs**:
```python
from transformers import AwqConfig
config = AwqConfig(bits=4, version="marlin")
```

### Wrong Output / Garbage Text

**Problem**: Model produces nonsensical output after quantization.

**Causes and fixes**:

1. **Poor calibration data**: Use domain-relevant data
```python
calib_data = [
    "Relevant examples from your use case...",
]
model.quantize(tokenizer, quant_config=quant_config, calib_data=calib_data)
```

2. **Tokenizer mismatch**: Ensure same tokenizer
```python
tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
```

3. **Check generation config**:
```python
outputs = model.generate(
    **inputs,
    max_new_tokens=200,
    do_sample=True,
    temperature=0.7,
    pad_token_id=tokenizer.eos_token_id
)
```

### FlashAttention2 Incompatibility

**Error**: `ValueError: Cannot use FlashAttention2 with fused modules`

**Fix**: Disable one or the other:
```python
# Option 1: Use fused modules (recommended for AWQ)
model = AutoAWQForCausalLM.from_quantized(model_name, fuse_layers=True)

# Option 2: Use FlashAttention2 without fusion
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    attn_implementation="flash_attention_2",
    device_map="auto"
)
```

### AMD GPU Issues

**Error**: `RuntimeError: ROCm/HIP not found`

**Fix**: Use ExLlama backend for AMD:
```python
from transformers import AwqConfig

config = AwqConfig(bits=4, version="exllama")
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=config
)
```

## Loading Issues

### Model Not Found

**Error**: `OSError: model_name is not a valid model identifier`

**Fix**: Check HuggingFace model exists:
```bash
# Search AWQ models
https://huggingface.co/models?library=awq

# Common AWQ model providers
TheBloke, teknium, Qwen, NousResearch
```

### Safetensors Error

**Error**: `safetensors_rust.SafetensorError: Error while deserializing`

**Fix**: Try loading without safetensors:
```python
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    safetensors=False
)
```

### Device Map Conflicts

**Error**: `ValueError: You cannot use device_map with max_memory`

**Fix**: Use one or the other:
```python
# Auto device map
model = AutoAWQForCausalLM.from_quantized(model_name, device_map="auto")

# OR manual memory limits
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    max_memory={0: "20GB", 1: "20GB"}
)
```

## vLLM Integration Issues

### Quantization Not Detected

**Error**: vLLM loads model in FP16 instead of quantized.

**Fix**: Explicitly specify quantization:
```python
from vllm import LLM

llm = LLM(
    model="TheBloke/Llama-2-7B-AWQ",
    quantization="awq",  # Explicitly set
    dtype="half"
)
```

### Marlin Kernel Error in vLLM

**Error**: `RuntimeError: Marlin kernel not supported`

**Fix**: Check GPU compatibility:
```python
import torch
print(torch.cuda.get_device_capability())  # Must be >= (8, 0)

# If not supported, use GEMM
llm = LLM(model="...", quantization="awq")  # Uses GEMM by default
```

## Performance Debugging

### Memory Usage Check

```python
import torch

def print_gpu_memory():
    for i in range(torch.cuda.device_count()):
        allocated = torch.cuda.memory_allocated(i) / 1e9
        reserved = torch.cuda.memory_reserved(i) / 1e9
        print(f"GPU {i}: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")

print_gpu_memory()
```

### Profiling Inference

```python
import time

def benchmark_model(model, tokenizer, prompt, n_runs=5):
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    # Warmup
    model.generate(**inputs, max_new_tokens=10)
    torch.cuda.synchronize()

    # Benchmark
    times = []
    for _ in range(n_runs):
        start = time.perf_counter()
        outputs = model.generate(**inputs, max_new_tokens=100)
        torch.cuda.synchronize()
        times.append(time.perf_counter() - start)

    tokens = outputs.shape[1] - inputs.input_ids.shape[1]
    avg_time = sum(times) / len(times)
    print(f"Average: {tokens/avg_time:.2f} tokens/sec")
```

## Getting Help

1. **Check deprecation notice**: AutoAWQ is deprecated, use llm-compressor for new projects
2. **GitHub Issues**: https://github.com/casper-hansen/AutoAWQ/issues
3. **HuggingFace Forums**: https://discuss.huggingface.co/
4. **vLLM Discord**: For vLLM integration issues
