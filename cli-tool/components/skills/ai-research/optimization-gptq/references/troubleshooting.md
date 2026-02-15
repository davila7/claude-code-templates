# GPTQ Troubleshooting Guide

Common issues and solutions for GPTQ quantization and inference.

## Installation Issues

### CUDA mismatch
```bash
# Check CUDA version
nvcc --version
python -c "import torch; print(torch.version.cuda)"

# Install matching version
pip install auto-gptq --extra-index-url https://huggingface.github.io/autogptq-index/whl/cu118/  # CUDA 11.8
```

### Build errors
```bash
# Install build dependencies
pip install auto-gptq --no-build-isolation

# On Ubuntu
sudo apt-get install python3-dev
```

## Runtime Issues

### Slow inference
```python
# Try different backends
model = AutoGPTQForCausalLM.from_quantized(
    model_name,
    use_exllama=True  # Fastest (try v1 or v2)
)

# Or Marlin (Ampere+ GPUs)
model = AutoGPTQForCausalLM.from_quantized(
    model_name,
    use_marlin=True
)
```

### OOM during inference
```python
# Reduce batch size
outputs = model.generate(**inputs, batch_size=1)

# Use CPU offloading
model = AutoGPTQForCausalLM.from_quantized(
    model_name,
    device_map="auto",
    max_memory={"cpu": "100GB"}
)

# Reduce context
model.seqlen = 1024  # Instead of 2048
```

### Poor quality outputs
```python
# Requantize with better calibration
# 1. Use more samples (256 instead of 128)
# 2. Use domain-specific data
# 3. Lower dampening: damp_percent=0.005
# 4. Enable desc_act=True
```

## Quantization Issues

### Very slow quantization
```bash
# Expected times (7B model):
# - A100: 10-15 min
# - RTX 4090: 20-30 min
# - CPU: 2-4 hours

# Speed up:
# 1. Use GPU
# 2. Reduce samples (64 instead of 256)
# 3. Disable desc_act
# 4. Use multi-GPU
```

### Quantization crashes
```python
# Reduce memory usage
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    device_map="auto",
    max_memory={"cpu": "100GB"}  # Offload to CPU
)

# Or quantize layer-by-layer (slower but works)
model.quantize(calibration_data, batch_size=1)
```
