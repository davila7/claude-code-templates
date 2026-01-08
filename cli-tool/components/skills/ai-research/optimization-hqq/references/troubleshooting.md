# HQQ Troubleshooting Guide

## Installation Issues

### Package Not Found

**Error**: `ModuleNotFoundError: No module named 'hqq'`

**Fix**:
```bash
pip install hqq

# Verify installation
python -c "import hqq; print(hqq.__version__)"
```

### Backend Dependencies Missing

**Error**: `ImportError: Cannot import marlin backend`

**Fix**:
```bash
# Install specific backend
pip install hqq[marlin]

# Or all backends
pip install hqq[all]

# For BitBlas
pip install bitblas

# For TorchAO
pip install torchao
```

### CUDA Version Mismatch

**Error**: `RuntimeError: CUDA error: no kernel image is available`

**Fix**:
```bash
# Check CUDA version
nvcc --version
python -c "import torch; print(torch.version.cuda)"

# Reinstall PyTorch with matching CUDA
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Then reinstall hqq
pip install hqq --force-reinstall
```

## Quantization Errors

### Out of Memory During Quantization

**Error**: `torch.cuda.OutOfMemoryError`

**Solutions**:

1. **Use CPU offloading**:
```python
from transformers import AutoModelForCausalLM, HqqConfig

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=HqqConfig(nbits=4, group_size=64),
    device_map="auto",
    offload_folder="./offload"
)
```

2. **Quantize layer by layer**:
```python
from hqq.models.hf.base import AutoHQQHFModel

model = AutoHQQHFModel.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="sequential"
)
```

3. **Reduce group size**:
```python
config = HqqConfig(
    nbits=4,
    group_size=32  # Smaller groups use less memory during quantization
)
```

### NaN Values After Quantization

**Error**: `RuntimeWarning: invalid value encountered` or NaN outputs

**Solutions**:

1. **Check for outliers**:
```python
import torch

def check_weight_stats(model):
    for name, param in model.named_parameters():
        if param.numel() > 0:
            has_nan = torch.isnan(param).any().item()
            has_inf = torch.isinf(param).any().item()
            if has_nan or has_inf:
                print(f"{name}: NaN={has_nan}, Inf={has_inf}")
                print(f"  min={param.min():.4f}, max={param.max():.4f}")

check_weight_stats(model)
```

2. **Use higher precision for problematic layers**:
```python
layer_configs = {
    "problematic_layer": BaseQuantizeConfig(nbits=8, group_size=128),
    "default": BaseQuantizeConfig(nbits=4, group_size=64)
}
```

3. **Skip embedding/lm_head**:
```python
config = HqqConfig(
    nbits=4,
    group_size=64,
    skip_modules=["embed_tokens", "lm_head"]
)
```

### Wrong Output Shape

**Error**: `RuntimeError: shape mismatch`

**Fix**:
```python
# Ensure axis is correct for your model
config = BaseQuantizeConfig(
    nbits=4,
    group_size=64,
    axis=1  # Usually 1 for most models, try 0 if issues
)
```

## Backend Issues

### Marlin Backend Not Working

**Error**: `RuntimeError: Marlin kernel not available`

**Requirements**:
- Ampere (A100) or newer GPU (compute capability >= 8.0)
- 4-bit quantization only
- Group size must be 128

**Fix**:
```python
# Check GPU compatibility
import torch
device = torch.cuda.get_device_properties(0)
print(f"Compute capability: {device.major}.{device.minor}")

# Marlin requires >= 8.0
if device.major >= 8:
    HQQLinear.set_backend("marlin")
else:
    HQQLinear.set_backend("aten")  # Fallback
```

### TorchAO Backend Errors

**Error**: `ImportError: torchao not found`

**Fix**:
```bash
pip install torchao

# Verify
python -c "import torchao; print('TorchAO installed')"
```

**Error**: `RuntimeError: torchao int4 requires specific shapes`

**Fix**:
```python
# TorchAO int4 has shape requirements
# Ensure dimensions are divisible by 32
config = BaseQuantizeConfig(
    nbits=4,
    group_size=64  # Must be power of 2
)
```

### Fallback to PyTorch Backend

```python
from hqq.core.quantize import HQQLinear

def safe_set_backend(preferred_backend):
    """Set backend with fallback."""
    try:
        HQQLinear.set_backend(preferred_backend)
        print(f"Using {preferred_backend} backend")
    except Exception as e:
        print(f"Failed to set {preferred_backend}: {e}")
        print("Falling back to pytorch backend")
        HQQLinear.set_backend("pytorch")

safe_set_backend("marlin")
```

## Performance Issues

### Slow Inference

**Problem**: Inference slower than expected

**Solutions**:

1. **Use optimized backend**:
```python
from hqq.core.quantize import HQQLinear

# Try backends in order of speed
for backend in ["marlin", "torchao_int4", "aten", "pytorch_compile"]:
    try:
        HQQLinear.set_backend(backend)
        print(f"Using {backend}")
        break
    except:
        continue
```

2. **Enable torch.compile**:
```python
import torch
model = torch.compile(model, mode="reduce-overhead")
```

3. **Use CUDA graphs** (for fixed input shapes):
```python
# Warmup
for _ in range(3):
    model.generate(**inputs, max_new_tokens=100)

# Enable CUDA graphs
torch.cuda.synchronize()
```

### High Memory Usage During Inference

**Problem**: Memory usage higher than expected for quantized model

**Solutions**:

1. **Clear KV cache**:
```python
# Use past_key_values management
outputs = model.generate(
    **inputs,
    max_new_tokens=100,
    use_cache=True,
    return_dict_in_generate=True
)
# Clear after use
del outputs.past_key_values
torch.cuda.empty_cache()
```

2. **Reduce batch size**:
```python
# Process in smaller batches
batch_size = 4  # Reduce if OOM
for i in range(0, len(prompts), batch_size):
    batch = prompts[i:i+batch_size]
    outputs = model.generate(...)
    torch.cuda.empty_cache()
```

3. **Use gradient checkpointing** (for training):
```python
model.gradient_checkpointing_enable()
```

## Quality Issues

### Poor Generation Quality

**Problem**: Quantized model produces gibberish or low-quality output

**Solutions**:

1. **Increase precision**:
```python
# Try higher bit-width
config = HqqConfig(nbits=8, group_size=128)  # Start high
# Then gradually reduce: 8 -> 4 -> 3 -> 2
```

2. **Use smaller group size**:
```python
config = HqqConfig(
    nbits=4,
    group_size=32  # Smaller = more accurate, more memory
)
```

3. **Skip sensitive layers**:
```python
config = HqqConfig(
    nbits=4,
    group_size=64,
    skip_modules=["embed_tokens", "lm_head", "model.layers.0"]
)
```

4. **Compare outputs**:
```python
def compare_outputs(original_model, quantized_model, prompt):
    """Compare outputs between original and quantized."""
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    with torch.no_grad():
        orig_out = original_model.generate(**inputs, max_new_tokens=50)
        quant_out = quantized_model.generate(**inputs, max_new_tokens=50)

    print("Original:", tokenizer.decode(orig_out[0]))
    print("Quantized:", tokenizer.decode(quant_out[0]))
```

### Perplexity Degradation

**Problem**: Significant perplexity increase after quantization

**Diagnosis**:
```python
import torch
from datasets import load_dataset

def measure_perplexity(model, tokenizer, dataset_name="wikitext", split="test"):
    """Measure model perplexity."""
    dataset = load_dataset(dataset_name, "wikitext-2-raw-v1", split=split)
    text = "\n\n".join(dataset["text"])

    encodings = tokenizer(text, return_tensors="pt")
    max_length = 2048
    stride = 512

    nlls = []
    for i in range(0, encodings.input_ids.size(1), stride):
        begin = max(i + stride - max_length, 0)
        end = min(i + stride, encodings.input_ids.size(1))

        input_ids = encodings.input_ids[:, begin:end].to(model.device)
        target_ids = input_ids.clone()
        target_ids[:, :-stride] = -100

        with torch.no_grad():
            outputs = model(input_ids, labels=target_ids)
            nlls.append(outputs.loss)

    ppl = torch.exp(torch.stack(nlls).mean())
    return ppl.item()

# Compare
orig_ppl = measure_perplexity(original_model, tokenizer)
quant_ppl = measure_perplexity(quantized_model, tokenizer)
print(f"Original PPL: {orig_ppl:.2f}")
print(f"Quantized PPL: {quant_ppl:.2f}")
print(f"Degradation: {((quant_ppl - orig_ppl) / orig_ppl * 100):.1f}%")
```

## Integration Issues

### HuggingFace Integration Errors

**Error**: `ValueError: Unknown quantization method: hqq`

**Fix**:
```bash
# Update transformers
pip install -U transformers>=4.36.0
```

**Error**: `AttributeError: 'HqqConfig' object has no attribute`

**Fix**:
```python
from transformers import HqqConfig

# Use correct parameter names
config = HqqConfig(
    nbits=4,           # Not 'bits'
    group_size=64,     # Not 'groupsize'
    axis=1             # Not 'quant_axis'
)
```

### vLLM Integration Issues

**Error**: `ValueError: HQQ quantization not supported`

**Fix**:
```bash
# Update vLLM
pip install -U vllm>=0.3.0
```

**Usage**:
```python
from vllm import LLM

# Load pre-quantized model
llm = LLM(
    model="mobiuslabsgmbh/Llama-3.1-8B-HQQ-4bit",
    quantization="hqq"
)
```

### PEFT Integration Issues

**Error**: `RuntimeError: Cannot apply LoRA to quantized layer`

**Fix**:
```python
from peft import prepare_model_for_kbit_training

# Prepare model for training
model = prepare_model_for_kbit_training(model)

# Then apply LoRA
model = get_peft_model(model, lora_config)
```

## Debugging Tips

### Enable Verbose Logging

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("hqq").setLevel(logging.DEBUG)
```

### Verify Quantization Applied

```python
def verify_quantization(model):
    """Check if model is properly quantized."""
    from hqq.core.quantize import HQQLinear

    total_linear = 0
    quantized_linear = 0

    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            total_linear += 1
        elif isinstance(module, HQQLinear):
            quantized_linear += 1
            print(f"Quantized: {name} ({module.W_q.dtype}, {module.W_q.shape})")

    print(f"\nTotal Linear: {total_linear}")
    print(f"Quantized: {quantized_linear}")
    print(f"Ratio: {quantized_linear / max(total_linear + quantized_linear, 1) * 100:.1f}%")

verify_quantization(model)
```

### Memory Profiling

```python
import torch

def profile_memory():
    """Profile GPU memory usage."""
    print(f"Allocated: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")
    print(f"Reserved: {torch.cuda.memory_reserved() / 1024**3:.2f} GB")
    print(f"Max Allocated: {torch.cuda.max_memory_allocated() / 1024**3:.2f} GB")

# Before quantization
profile_memory()

# After quantization
model = load_quantized_model(...)
profile_memory()
```

## Getting Help

1. **GitHub Issues**: https://github.com/mobiusml/hqq/issues
2. **HuggingFace Forums**: https://discuss.huggingface.co
3. **Discord**: Check HQQ community channels

### Reporting Issues

Include:
- HQQ version: `pip show hqq`
- PyTorch version: `python -c "import torch; print(torch.__version__)"`
- CUDA version: `nvcc --version`
- GPU model: `nvidia-smi --query-gpu=name --format=csv`
- Full error traceback
- Minimal reproducible code
