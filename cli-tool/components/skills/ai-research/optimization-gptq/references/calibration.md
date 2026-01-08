# GPTQ Calibration Guide

Complete guide to calibration data selection and quantization process.

## Calibration Data Selection

### Why calibration matters

Calibration data is used to:
1. **Compute weight importance** (Hessian matrix)
2. **Minimize quantization error** for important weights
3. **Preserve model accuracy** after quantization

**Impact**:
- Good calibration: <1.5% perplexity increase
- Poor calibration: 5-10% perplexity increase
- No calibration: Model may output gibberish

### Dataset size

**Recommended**:
- **128-256 samples** of 512 tokens each
- Total: 65K-131K tokens

**More is not always better**:
- <64 samples: Underfitting (poor quality)
- 128-256 samples: Sweet spot
- >512 samples: Diminishing returns, slower quantization

### Dataset selection by domain

**General purpose models (GPT, Llama)**:
```python
from datasets import load_dataset

# C4 dataset (recommended for general models)
dataset = load_dataset("c4", split="train", streaming=True)
calibration_data = [
    tokenizer(example["text"])["input_ids"][:512]
    for example in dataset.take(128)
]
```

**Code models (CodeLlama, StarCoder)**:
```python
# The Stack dataset
dataset = load_dataset("bigcode/the-stack", split="train", streaming=True)
calibration_data = [
    tokenizer(example["content"])["input_ids"][:512]
    for example in dataset.take(128)
    if example["lang"] == "Python"  # Or your target language
]
```

**Chat models**:
```python
# ShareGPT or Alpaca format
dataset = load_dataset("anon8231489123/ShareGPT_Vicuna_unfiltered", split="train")

calibration_data = []
for example in dataset.select(range(128)):
    # Format as conversation
    conversation = tokenizer.apply_chat_template(
        example["conversations"],
        tokenize=True,
        max_length=512
    )
    calibration_data.append(conversation)
```

**Domain-specific (medical, legal)**:
```python
# Use domain-specific text
dataset = load_dataset("medical_dataset", split="train")
calibration_data = [
    tokenizer(example["text"])["input_ids"][:512]
    for example in dataset.take(256)  # More samples for niche domains
]
```

## Quantization Process

### Basic quantization

```python
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
from transformers import AutoTokenizer
from datasets import load_dataset

# 1. Load model
model_name = "meta-llama/Llama-2-7b-hf"
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    quantize_config=BaseQuantizeConfig(
        bits=4,
        group_size=128,
        desc_act=False
    )
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 2. Prepare calibration data
dataset = load_dataset("c4", split="train", streaming=True)
calibration_data = [
    tokenizer(example["text"])["input_ids"][:512]
    for example in dataset.take(128)
]

# 3. Quantize
model.quantize(calibration_data)

# 4. Save
model.save_quantized("llama-2-7b-gptq")
```

**Time**: ~10-30 minutes for 7B model on A100

### Advanced configuration

```python
config = BaseQuantizeConfig(
    bits=4,                    # 3, 4, or 8 bits
    group_size=128,            # 32, 64, 128, or -1 (per-column)
    desc_act=False,            # Activation order (True = better accuracy, slower)
    damp_percent=0.01,         # Dampening (0.001-0.1, default 0.01)
    static_groups=False,       # Static quantization
    sym=True,                  # Symmetric quantization
    true_sequential=True,      # Sequential quantization (more accurate)
    model_seqlen=2048          # Model sequence length
)
```

**Parameter tuning**:
- `damp_percent`: Lower = more accurate, slower. Try 0.005-0.02.
- `desc_act=True`: 0.5-1% better accuracy, 20-30% slower inference
- `group_size=32`: Better accuracy, slightly larger model

### Multi-GPU quantization

```python
# Quantize on multiple GPUs (faster)
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    quantize_config=config,
    device_map="auto",         # Distribute across GPUs
    max_memory={0: "40GB", 1: "40GB"}
)

model.quantize(calibration_data)
```

## Quality Evaluation

### Perplexity testing

```python
from datasets import load_dataset
import torch

# Load test dataset
test_dataset = load_dataset("wikitext", "wikitext-2-raw-v1", split="test")
test_text = "\n\n".join(test_dataset["text"])

# Tokenize
encodings = tokenizer(test_text, return_tensors="pt")
max_length = model.seqlen

# Calculate perplexity
nlls = []
for i in range(0, encodings.input_ids.size(1), max_length):
    begin_loc = i
    end_loc = min(i + max_length, encodings.input_ids.size(1))
    input_ids = encodings.input_ids[:, begin_loc:end_loc].to("cuda")

    with torch.no_grad():
        outputs = model(input_ids, labels=input_ids)
        nll = outputs.loss

    nlls.append(nll)

ppl = torch.exp(torch.stack(nlls).mean())
print(f"Perplexity: {ppl.item():.2f}")
```

**Quality targets**:
- <1.5% increase: Excellent
- 1.5-3% increase: Good
- 3-5% increase: Acceptable for some use cases
- >5% increase: Poor, redo calibration

### Benchmark evaluation

```python
from lm_eval import evaluator

# Evaluate on standard benchmarks
results = evaluator.simple_evaluate(
    model=model,
    tasks=["hellaswag", "mmlu", "arc_challenge"],
    num_fewshot=5
)

print(results["results"])

# Compare to baseline FP16 scores
```

## Optimization Tips

### Improving accuracy

**1. Use more calibration samples**:
```python
# Try 256 or 512 samples
calibration_data = [... for example in dataset.take(256)]
```

**2. Use domain-specific data**:
```python
# Match your use case
if code_model:
    dataset = load_dataset("bigcode/the-stack")
elif chat_model:
    dataset = load_dataset("ShareGPT")
```

**3. Enable activation reordering**:
```python
config = BaseQuantizeConfig(
    bits=4,
    group_size=128,
    desc_act=True  # Better accuracy, slower inference
)
```

**4. Use smaller group size**:
```python
config = BaseQuantizeConfig(
    bits=4,
    group_size=32,  # vs 128
    desc_act=False
)
```

### Reducing quantization time

**1. Use fewer samples**:
```python
# 64-128 samples usually sufficient
calibration_data = [... for example in dataset.take(64)]
```

**2. Disable activation ordering**:
```python
config = BaseQuantizeConfig(
    desc_act=False  # Faster quantization
)
```

**3. Use multi-GPU**:
```python
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    device_map="auto"  # Parallelize across GPUs
)
```

## Troubleshooting

### Poor quality after quantization

**Symptom**: >5% perplexity increase or gibberish output

**Solutions**:
1. **Check calibration data**:
   ```python
   # Verify data is representative
   for sample in calibration_data[:5]:
       print(tokenizer.decode(sample))
   ```

2. **Try more samples**:
   ```python
   calibration_data = [... for example in dataset.take(256)]
   ```

3. **Use domain-specific data**:
   ```python
   # Match your model's use case
   dataset = load_dataset("domain_specific_dataset")
   ```

4. **Adjust dampening**:
   ```python
   config = BaseQuantizeConfig(damp_percent=0.005)  # Lower dampening
   ```

### Quantization OOM

**Solutions**:
1. **Reduce batch size**:
   ```python
   model.quantize(calibration_data, batch_size=1)  # Default: auto
   ```

2. **Use CPU offloading**:
   ```python
   model = AutoGPTQForCausalLM.from_pretrained(
       model_name,
       device_map="auto",
       max_memory={"cpu": "100GB"}
   )
   ```

3. **Quantize on larger GPU** or use multi-GPU

### Slow quantization

**Typical times** (7B model):
- Single A100: 10-15 minutes
- Single RTX 4090: 20-30 minutes
- CPU: 2-4 hours (not recommended)

**Speedup**:
- Use fewer samples (64 vs 256)
- Disable `desc_act`
- Use multi-GPU

## Best Practices

1. **Use C4 dataset for general models** - well-balanced, diverse
2. **Match domain** - code models need code data, chat needs conversations
3. **Start with 128 samples** - good balance of speed and quality
4. **Test perplexity** - always verify quality before deployment
5. **Compare kernels** - try ExLlama, Marlin, Triton for speed
6. **Save multiple versions** - try group_size 32, 128, 256
7. **Document settings** - save quantize_config.json for reproducibility
