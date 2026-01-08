# AWQ Advanced Usage Guide

## Quantization Algorithm Details

### How AWQ Works

AWQ (Activation-aware Weight Quantization) is based on the key insight that not all weights in an LLM are equally important. The algorithm:

1. **Identifies salient weights** (~1%) by examining activation distributions
2. **Applies mathematical scaling** to protect critical channels
3. **Quantizes remaining weights** to 4-bit with minimal error

**Core formula**: `L(s) = ||Q(W * s)(s^-1 * X) - W * X||`

Where:
- `Q` is the quantization function
- `W` is the weight matrix
- `s` is the scaling factor
- `X` is the input activation

### Why AWQ Outperforms GPTQ

| Aspect | AWQ | GPTQ |
|--------|-----|------|
| Calibration approach | Activation-aware scaling | Hessian-based reconstruction |
| Overfitting risk | Low (no backprop) | Higher (reconstruction-based) |
| Calibration data | 128-1024 tokens | Larger datasets needed |
| Generalization | Better across domains | Can overfit to calibration |

## WQLinear Kernel Variants

AutoAWQ provides multiple kernel implementations for different use cases:

### WQLinear_GEMM
- **Use case**: Batch inference, training
- **Best for**: Batch sizes > 1, throughput optimization
- **Implementation**: General matrix multiplication

```python
quant_config = {"version": "GEMM"}
```

### WQLinear_GEMV
- **Use case**: Single-token generation
- **Best for**: Streaming, chat applications
- **Speedup**: ~20% faster than GEMM for batch_size=1
- **Limitation**: Only works with batch_size=1

```python
quant_config = {"version": "GEMV"}
```

### WQLinear_GEMVFast
- **Use case**: Optimized single-token generation
- **Requirements**: awq_v2_ext kernels installed
- **Best for**: Maximum single-token speed

```python
# Requires autoawq[kernels] installation
quant_config = {"version": "gemv_fast"}
```

### WQLinear_Marlin
- **Use case**: High-throughput inference
- **Requirements**: Ampere+ GPUs (Compute Capability 8.0+)
- **Speedup**: 2x faster on A100/H100

```python
from transformers import AwqConfig

config = AwqConfig(bits=4, version="marlin")
```

### WQLinear_Exllama / ExllamaV2
- **Use case**: AMD GPU compatibility, faster prefill
- **Benefits**: Works with ROCm

```python
config = AwqConfig(bits=4, version="exllama")
```

### WQLinear_IPEX
- **Use case**: Intel CPU/XPU acceleration
- **Requirements**: Intel Extension for PyTorch, torch 2.4+

```python
pip install autoawq[cpu]
```

## Group Size Configuration

Group size determines how weights are grouped for quantization:

| Group Size | Model Size | Accuracy | Speed | Use Case |
|------------|------------|----------|-------|----------|
| 32 | Larger | Best | Slower | Maximum accuracy |
| **128** | Medium | Good | Fast | **Recommended default** |
| 256 | Smaller | Lower | Faster | Speed-critical |

```python
quant_config = {
    "q_group_size": 128,  # Recommended
    "w_bit": 4,
    "zero_point": True
}
```

## Zero-Point Quantization

Zero-point quantization adds an offset to handle asymmetric weight distributions:

```python
# With zero-point (recommended for most models)
quant_config = {"zero_point": True, "w_bit": 4, "q_group_size": 128}

# Without zero-point (symmetric quantization)
quant_config = {"zero_point": False, "w_bit": 4, "q_group_size": 128}
```

**When to disable zero-point**:
- Models with symmetric weight distributions
- When using specific kernels that don't support it

## Custom Calibration Strategies

### Domain-Specific Calibration

For domain-specific models, use relevant calibration data:

```python
# Medical domain
medical_samples = [
    "Patient presents with acute respiratory symptoms...",
    "Differential diagnosis includes pneumonia, bronchitis...",
    # More domain-specific examples
]

model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data=medical_samples,
    max_calib_samples=256
)
```

### Instruction-Tuned Model Calibration

For chat/instruction models, include conversational data:

```python
chat_samples = [
    "Human: What is machine learning?\nAssistant: Machine learning is...",
    "Human: Explain neural networks.\nAssistant: Neural networks are...",
]

model.quantize(tokenizer, quant_config=quant_config, calib_data=chat_samples)
```

### Calibration Parameters

```python
model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data="pileval",          # Dataset name or list
    max_calib_samples=128,         # Number of samples (more = slower but better)
    max_calib_seq_len=512,         # Sequence length
    duo_scaling=True,              # Scale weights and activations
    apply_clip=True                # Apply weight clipping
)
```

## Layer Fusion

Layer fusion combines multiple operations for better performance:

### Automatic Fusion

```python
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    fuse_layers=True  # Enables automatic fusion
)
```

### What Gets Fused

- **Attention**: Q, K, V projections combined
- **MLP**: Gate and Up projections fused
- **Normalization**: Replaced with FasterTransformerRMSNorm

### Manual Fusion Configuration

```python
from transformers import AwqConfig

config = AwqConfig(
    bits=4,
    fuse_max_seq_len=2048,  # Max context for fused attention
    do_fuse=True,
    modules_to_fuse={
        "attention": ["q_proj", "k_proj", "v_proj"],
        "mlp": ["gate_proj", "up_proj"],
        "layernorm": ["input_layernorm", "post_attention_layernorm"],
    }
)
```

## Memory Optimization

### Chunked Processing

For large models, AWQ processes in chunks to avoid OOM:

```python
from awq import AutoAWQForCausalLM

# Reduce memory during quantization
model = AutoAWQForCausalLM.from_pretrained(
    model_path,
    low_cpu_mem_usage=True
)
```

### Multi-GPU Quantization

```python
model = AutoAWQForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    device_map="auto"
)
```

### CPU Offloading

```python
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    device_map="auto",
    max_memory={
        0: "24GB",
        "cpu": "100GB"
    }
)
```

## Modules to Not Convert

Some modules should remain in full precision:

```python
# Visual encoder in multimodal models
class LlavaAWQForCausalLM(BaseAWQForCausalLM):
    modules_to_not_convert = ["visual"]
```

Common exclusions:
- `visual` - Vision encoders in VLMs
- `lm_head` - Output projection
- `embed_tokens` - Embedding layers

## Saving and Loading

### Save Quantized Model

```python
# Save locally
model.save_quantized("./my-awq-model")
tokenizer.save_pretrained("./my-awq-model")

# Save with safetensors (recommended)
model.save_quantized("./my-awq-model", safetensors=True)

# Save sharded (for large models)
model.save_quantized("./my-awq-model", shard_size="5GB")
```

### Push to HuggingFace

```python
model.push_to_hub("username/my-awq-model")
tokenizer.push_to_hub("username/my-awq-model")
```

### Load with Specific Backend

```python
from awq import AutoAWQForCausalLM

# Load with specific kernel
model = AutoAWQForCausalLM.from_quantized(
    model_name,
    use_exllama=True,           # ExLlama backend
    use_exllama_v2=True,        # ExLlamaV2 (faster)
    use_marlin=True,            # Marlin kernels
    use_ipex=True,              # Intel CPU
    fuse_layers=True            # Enable fusion
)
```

## Benchmarking Your Model

```python
from awq.utils.utils import get_best_device
import time

model = AutoAWQForCausalLM.from_quantized(model_name, fuse_layers=True)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Warmup
inputs = tokenizer("Hello", return_tensors="pt").to(get_best_device())
model.generate(**inputs, max_new_tokens=10)

# Benchmark
prompt = "Write a detailed essay about"
inputs = tokenizer(prompt, return_tensors="pt").to(get_best_device())

start = time.time()
outputs = model.generate(**inputs, max_new_tokens=200)
end = time.time()

tokens_generated = outputs.shape[1] - inputs.input_ids.shape[1]
print(f"Tokens/sec: {tokens_generated / (end - start):.2f}")
```
