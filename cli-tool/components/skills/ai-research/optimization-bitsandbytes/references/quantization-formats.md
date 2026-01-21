# Quantization Formats

Complete guide to INT8, NF4, FP4 quantization formats, double quantization, and custom configurations in bitsandbytes.

## Overview

bitsandbytes supports multiple quantization formats:
- **INT8**: 8-bit integer quantization (LLM.int8())
- **NF4**: 4-bit NormalFloat (for normally distributed weights)
- **FP4**: 4-bit FloatPoint (for uniformly distributed weights)
- **Double Quantization**: Quantize the quantization constants

## INT8 Quantization

### LLM.int8() Algorithm

LLM.int8() uses mixed 8-bit/16-bit matrix multiplication:
- Most features (>99.9%) computed in INT8
- Outlier features (>threshold) computed in FP16
- Results combined for final output

**Memory**: 50% reduction (2 bytes → 1 byte per parameter)
**Accuracy**: <0.5% degradation

### Configuration

```python
from transformers import BitsAndBytesConfig

config = BitsAndBytesConfig(
    load_in_8bit=True,
    llm_int8_threshold=6.0,  # Outlier threshold
    llm_int8_has_fp16_weight=False,  # Use INT8 storage
    llm_int8_skip_modules=["lm_head"]  # Skip certain layers
)
```

### Parameters Explained

**`llm_int8_threshold`** (default: 6.0):
- Activations with magnitude > threshold are kept in FP16
- Lower = more FP16 (slower but more accurate)
- Higher = more INT8 (faster but less accurate)

```python
# Conservative (more accurate)
llm_int8_threshold=5.0

# Aggressive (faster)
llm_int8_threshold=8.0
```

**`llm_int8_has_fp16_weight`** (default: False):
- `False`: Store weights in INT8 (50% memory savings)
- `True`: Store in FP16, quantize only during computation (no memory savings)

**`llm_int8_skip_modules`**:
```python
# Skip specific layers (keep in FP16)
llm_int8_skip_modules=["lm_head", "embed_tokens"]
```

### Example

```python
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-13b-hf",
    quantization_config=config,
    device_map="auto"
)

# Memory: 26GB (FP16) → 13GB (INT8)
```

### When to Use INT8

✅ **Use INT8 when**:
- Need high accuracy (<0.5% loss)
- Model fits with 50% reduction
- Have Turing+ GPU (tensor cores)

❌ **Don't use when**:
- Need maximum memory savings (use 4-bit)
- Inference speed critical (use GPTQ/AWQ)

## 4-Bit Quantization

### NormalFloat4 (NF4)

Optimized for normally distributed weights (most neural networks).

**How it works**:
- Bins chosen to minimize quantization error for normal distribution
- Asymmetric quantization bins
- Better for transformer weights

**Configuration**:
```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4"  # NormalFloat4
)
```

**Memory**: 75% reduction (2 bytes → 0.5 bytes per parameter)

### FloatPoint4 (FP4)

Standard 4-bit floating point for uniform distributions.

**How it works**:
- Symmetric quantization bins
- Better for weights with broader dynamic range
- Less common for transformers

**Configuration**:
```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="fp4"  # FloatPoint4
)
```

### NF4 vs FP4 Comparison

| Aspect | NF4 | FP4 |
|--------|-----|-----|
| Distribution | Normal | Uniform |
| Typical use | **Transformers** | CNNs, unusual architectures |
| Accuracy | **Better for LLMs** | Worse for LLMs |
| Speed | Same | Same |
| Recommendation | ✅ Default | Use only if NF4 fails |

**Rule of thumb**: Always use NF4 for transformers.

### Example Comparison

```python
# NF4 (recommended)
nf4_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4"
)

# FP4 (alternative)
fp4_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="fp4"
)

# Load and compare
model_nf4 = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=nf4_config
)

model_fp4 = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=fp4_config
)

# Typical results on MMLU:
# NF4: 45.2%
# FP4: 43.8%
# FP16: 45.9%
```

## Compute Dtype

The `bnb_4bit_compute_dtype` controls the precision used for actual computation.

### Options

**torch.bfloat16** (recommended):
```python
bnb_4bit_compute_dtype=torch.bfloat16
```
- Good balance of speed and accuracy
- Recommended for A100/H100
- Prevents numerical instability

**torch.float16**:
```python
bnb_4bit_compute_dtype=torch.float16
```
- Slightly faster than BF16
- Risk of overflow/underflow
- Use only if BF16 unavailable

**torch.float32**:
```python
bnb_4bit_compute_dtype=torch.float32
```
- Most accurate
- Slowest (no tensor core acceleration)
- Debugging only

### Performance Comparison

| Dtype | Speed | Accuracy | Memory |
|-------|-------|----------|--------|
| FP32 | 1× (baseline) | 100% | 4 bytes |
| FP16 | 3-4× | 99.5% | 2 bytes |
| BF16 | 3-4× | **99.8%** | 2 bytes |

**Recommendation**: Always use `torch.bfloat16` if supported.

## Double Quantization

Quantize the quantization constants for additional memory savings.

### How It Works

Standard 4-bit quantization stores:
- 4-bit quantized weights
- FP32 scaling factors (4 bytes per block)

Double quantization:
- 4-bit quantized weights
- **INT8 quantized scaling factors** (1 byte per block)

**Additional savings**: ~2-3% memory reduction

### Configuration

```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True  # Enable double quantization
)
```

### Example

```python
# Without double quant
model_single = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=False
    )
)
# Memory: ~36GB

# With double quant
model_double = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True
    )
)
# Memory: ~35GB (saves ~1GB)
```

**Accuracy impact**: Negligible (<0.1%)

**Recommendation**: Always enable for maximum memory savings.

## Quantization Storage

Controls storage dtype for quantized weights (important for FSDP).

### Configuration

```python
config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_storage=torch.bfloat16  # Storage dtype
)
```

### When to Use

**Default (uint8)**:
- Single GPU training/inference
- No special requirements

**torch.bfloat16** (for FSDP):
```python
bnb_4bit_quant_storage=torch.bfloat16
```
- **Required for FSDP+QLoRA**
- Ensures 4-bit layers wrapped like regular layers
- Enables proper model sharding

### Example: FSDP Configuration

```python
# CRITICAL: Set quant_storage for FSDP
fsdp_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_storage=torch.bfloat16  # Must match torch_dtype!
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=fsdp_config,
    torch_dtype=torch.bfloat16  # Must match quant_storage!
)
```

## Recommended Configurations

### Production Inference (Best Accuracy)

```python
BitsAndBytesConfig(
    load_in_8bit=True,
    llm_int8_threshold=6.0
)
```

**Use case**: Maximum accuracy with 50% memory savings

### Production Inference (Maximum Memory Savings)

```python
BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)
```

**Use case**: 75% memory reduction with <1% accuracy loss

### QLoRA Training (Single GPU)

```python
BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)
```

**Use case**: Fine-tune 70B on RTX 3090

### FSDP + QLoRA (Multi-GPU)

```python
BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_storage=torch.bfloat16  # CRITICAL!
)
```

**Use case**: Fine-tune 405B on 8×H100

## Advanced: Block-wise Quantization

bitsandbytes uses block-wise quantization:
- Weights divided into blocks (typically 64 or 128 elements)
- Each block has own scaling factor
- Better accuracy than tensor-wise quantization

**Block size** (automatically determined):
```python
# Typical block sizes
# 4-bit: 64 elements per block
# 8-bit: 64 elements per block
```

**Cannot be configured** (internal implementation detail).

## Quantization Quality Metrics

### Perplexity (Lower is Better)

| Model | FP16 | INT8 | NF4 | NF4+DQ |
|-------|------|------|-----|--------|
| Llama 2 7B | 5.12 | 5.14 | 5.18 | 5.19 |
| Llama 2 13B | 4.88 | 4.90 | 4.93 | 4.94 |
| Llama 2 70B | 3.32 | 3.33 | 3.35 | 3.36 |

**Conclusion**: <1% degradation for all quantization methods

### MMLU Accuracy (Higher is Better)

| Model | FP16 | INT8 | NF4 | FP4 |
|-------|------|------|-----|-----|
| Llama 2 7B | 45.9% | 45.7% | 45.2% | 43.8% |
| Llama 2 13B | 54.8% | 54.6% | 54.1% | 52.9% |
| Llama 2 70B | 68.9% | 68.7% | 68.4% | 67.2% |

**Conclusion**: NF4 is significantly better than FP4 for transformers

## Troubleshooting

### "Quantization failed" Error

Try different quant type:
```python
# If NF4 fails
bnb_4bit_quant_type="fp4"
```

### Numerical Instability

Use BF16 compute:
```python
bnb_4bit_compute_dtype=torch.bfloat16
```

### Poor Quality with 4-bit

1. Try 8-bit instead:
   ```python
   load_in_8bit=True
   ```

2. Enable double quantization:
   ```python
   bnb_4bit_use_double_quant=True
   ```

3. Use BF16 compute dtype

### FSDP Errors

Ensure quant_storage matches torch_dtype:
```python
bnb_4bit_quant_storage=torch.bfloat16
torch_dtype=torch.bfloat16  # Must match!
```

## References

- LLM.int8() paper: "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale" (2022)
- QLoRA paper: "QLoRA: Efficient Finetuning of Quantized LLMs" (2023)
- bitsandbytes GitHub: https://github.com/bitsandbytes-foundation/bitsandbytes
- HuggingFace quantization docs: https://huggingface.co/docs/transformers/quantization/bitsandbytes
