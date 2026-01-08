# HQQ Advanced Usage Guide

## Custom Backend Configuration

### Backend Selection by Hardware

```python
from hqq.core.quantize import HQQLinear
import torch

def select_optimal_backend():
    """Select best backend based on hardware."""
    device = torch.cuda.get_device_properties(0)
    compute_cap = device.major * 10 + device.minor

    if compute_cap >= 80:  # Ampere+
        return "marlin"
    elif compute_cap >= 70:  # Volta/Turing
        return "aten"
    else:
        return "pytorch_compile"

backend = select_optimal_backend()
HQQLinear.set_backend(backend)
print(f"Using backend: {backend}")
```

### Per-Layer Backend Assignment

```python
from hqq.core.quantize import HQQLinear

def set_layer_backends(model):
    """Assign optimal backends per layer type."""
    for name, module in model.named_modules():
        if isinstance(module, HQQLinear):
            if "attn" in name:
                module.set_backend("marlin")  # Fast for attention
            elif "mlp" in name:
                module.set_backend("bitblas")  # Flexible for MLP
            else:
                module.set_backend("aten")

set_layer_backends(model)
```

### TorchAO Integration

```python
from hqq.core.quantize import HQQLinear
import torchao

# Enable TorchAO int4 backend
HQQLinear.set_backend("torchao_int4")

# Configure TorchAO options
import torch
torch._inductor.config.coordinate_descent_tuning = True
torch._inductor.config.triton.unique_kernel_names = True
```

## Mixed Precision Quantization

### Layer-Specific Configuration

```python
from hqq.core.quantize import BaseQuantizeConfig
from transformers import AutoModelForCausalLM

# Define configs per layer pattern
quant_configs = {
    # Embeddings: Keep full precision
    "embed_tokens": None,
    "lm_head": None,

    # Attention: 4-bit with larger groups
    "self_attn.q_proj": BaseQuantizeConfig(nbits=4, group_size=128),
    "self_attn.k_proj": BaseQuantizeConfig(nbits=4, group_size=128),
    "self_attn.v_proj": BaseQuantizeConfig(nbits=4, group_size=128),
    "self_attn.o_proj": BaseQuantizeConfig(nbits=4, group_size=128),

    # MLP: More aggressive 2-bit
    "mlp.gate_proj": BaseQuantizeConfig(nbits=2, group_size=32),
    "mlp.up_proj": BaseQuantizeConfig(nbits=2, group_size=32),
    "mlp.down_proj": BaseQuantizeConfig(nbits=3, group_size=64),
}

def quantize_with_mixed_precision(model, configs):
    """Apply mixed precision quantization."""
    from hqq.core.quantize import HQQLinear

    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            for pattern, config in configs.items():
                if pattern in name:
                    if config is None:
                        continue  # Skip quantization
                    parent = get_parent_module(model, name)
                    setattr(parent, name.split(".")[-1],
                            HQQLinear(module, config))
                    break
    return model
```

### Sensitivity-Based Quantization

```python
import torch
from hqq.core.quantize import BaseQuantizeConfig, HQQLinear

def measure_layer_sensitivity(model, calibration_data, layer_name):
    """Measure quantization sensitivity of a layer."""
    original_output = None
    quantized_output = None

    # Get original output
    def hook_original(module, input, output):
        nonlocal original_output
        original_output = output.clone()

    layer = dict(model.named_modules())[layer_name]
    handle = layer.register_forward_hook(hook_original)

    with torch.no_grad():
        model(calibration_data)
    handle.remove()

    # Quantize and measure error
    for nbits in [4, 3, 2]:
        config = BaseQuantizeConfig(nbits=nbits, group_size=64)
        quant_layer = HQQLinear(layer, config)

        with torch.no_grad():
            quantized_output = quant_layer(calibration_data)

        error = torch.mean((original_output - quantized_output) ** 2).item()
        print(f"{layer_name} @ {nbits}-bit: MSE = {error:.6f}")

# Auto-select precision based on sensitivity
def auto_select_precision(sensitivity_results, threshold=0.01):
    """Select precision based on sensitivity threshold."""
    configs = {}
    for layer_name, errors in sensitivity_results.items():
        for nbits, error in sorted(errors.items()):
            if error < threshold:
                configs[layer_name] = BaseQuantizeConfig(nbits=nbits, group_size=64)
                break
    return configs
```

## Advanced Quantization Options

### Custom Zero Point Handling

```python
from hqq.core.quantize import BaseQuantizeConfig

# Symmetric quantization (zero point = 0)
config_symmetric = BaseQuantizeConfig(
    nbits=4,
    group_size=64,
    axis=1,
    zero_point=False  # No zero point, symmetric
)

# Asymmetric quantization (learned zero point)
config_asymmetric = BaseQuantizeConfig(
    nbits=4,
    group_size=64,
    axis=1,
    zero_point=True  # Include zero point
)
```

### Axis Selection

```python
from hqq.core.quantize import BaseQuantizeConfig

# Quantize along output dimension (default, better for inference)
config_axis1 = BaseQuantizeConfig(
    nbits=4,
    group_size=64,
    axis=1  # Output dimension
)

# Quantize along input dimension (better for some architectures)
config_axis0 = BaseQuantizeConfig(
    nbits=4,
    group_size=64,
    axis=0  # Input dimension
)
```

### Group Size Optimization

```python
def find_optimal_group_size(layer, test_input, target_bits=4):
    """Find optimal group size for a layer."""
    from hqq.core.quantize import BaseQuantizeConfig, HQQLinear
    import torch

    group_sizes = [16, 32, 64, 128, 256]
    results = {}

    with torch.no_grad():
        original_output = layer(test_input)

        for gs in group_sizes:
            config = BaseQuantizeConfig(nbits=target_bits, group_size=gs)
            quant_layer = HQQLinear(layer.clone(), config)
            quant_output = quant_layer(test_input)

            mse = torch.mean((original_output - quant_output) ** 2).item()
            memory = quant_layer.W_q.numel() * target_bits / 8

            results[gs] = {"mse": mse, "memory_bytes": memory}
            print(f"Group size {gs}: MSE={mse:.6f}, Memory={memory/1024:.1f}KB")

    return results
```

## Model Export and Deployment

### Export for ONNX

```python
import torch
from transformers import AutoModelForCausalLM, HqqConfig

# Load quantized model
config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="cpu"
)

# Export to ONNX (requires dequantization for compatibility)
dummy_input = torch.randint(0, 32000, (1, 128))
torch.onnx.export(
    model,
    dummy_input,
    "model_hqq.onnx",
    input_names=["input_ids"],
    output_names=["logits"],
    dynamic_axes={"input_ids": {0: "batch", 1: "seq_len"}}
)
```

### SafeTensors Export

```python
from safetensors.torch import save_file

def export_hqq_safetensors(model, output_path):
    """Export HQQ model to safetensors format."""
    tensors = {}

    for name, param in model.named_parameters():
        tensors[name] = param.data.cpu()

    # Include quantization metadata
    for name, module in model.named_modules():
        if hasattr(module, "W_q"):
            tensors[f"{name}.W_q"] = module.W_q.cpu()
            tensors[f"{name}.scale"] = module.scale.cpu()
            if hasattr(module, "zero"):
                tensors[f"{name}.zero"] = module.zero.cpu()

    save_file(tensors, output_path)

export_hqq_safetensors(model, "model_hqq.safetensors")
```

## Performance Optimization

### Kernel Fusion

```python
import torch
from hqq.core.quantize import HQQLinear

# Enable torch.compile for kernel fusion
def optimize_model(model):
    """Apply optimizations for inference."""
    # Set optimal backend
    HQQLinear.set_backend("marlin")

    # Compile with optimizations
    model = torch.compile(
        model,
        mode="reduce-overhead",
        fullgraph=True
    )

    return model

model = optimize_model(model)
```

### Batch Size Optimization

```python
def find_optimal_batch_size(model, tokenizer, max_batch=64):
    """Find optimal batch size for throughput."""
    import time

    prompt = "Hello, world!"
    inputs = tokenizer([prompt], return_tensors="pt", padding=True)

    results = {}
    for batch_size in [1, 2, 4, 8, 16, 32, max_batch]:
        try:
            batch_inputs = {
                k: v.repeat(batch_size, 1).to(model.device)
                for k, v in inputs.items()
            }

            # Warmup
            model.generate(**batch_inputs, max_new_tokens=10)

            # Benchmark
            torch.cuda.synchronize()
            start = time.time()
            for _ in range(5):
                model.generate(**batch_inputs, max_new_tokens=50)
            torch.cuda.synchronize()

            elapsed = (time.time() - start) / 5
            throughput = batch_size * 50 / elapsed

            results[batch_size] = {
                "time": elapsed,
                "throughput": throughput
            }
            print(f"Batch {batch_size}: {throughput:.1f} tokens/sec")

        except torch.cuda.OutOfMemoryError:
            print(f"Batch {batch_size}: OOM")
            break

    return results
```

### Memory-Efficient Inference

```python
import torch
from contextlib import contextmanager

@contextmanager
def low_memory_inference(model):
    """Context manager for memory-efficient inference."""
    # Disable gradient computation
    with torch.no_grad():
        # Enable inference mode
        with torch.inference_mode():
            # Clear cache before inference
            torch.cuda.empty_cache()
            yield
            # Clear cache after inference
            torch.cuda.empty_cache()

# Usage
with low_memory_inference(model):
    outputs = model.generate(**inputs, max_new_tokens=100)
```

## Benchmarking

### Comprehensive Benchmark Suite

```python
import time
import torch
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class BenchmarkResult:
    latency_ms: float
    throughput: float
    memory_mb: float
    perplexity: float

def benchmark_hqq_model(model, tokenizer, test_texts: List[str]) -> BenchmarkResult:
    """Comprehensive benchmark for HQQ models."""
    device = next(model.parameters()).device

    # Prepare inputs
    inputs = tokenizer(test_texts, return_tensors="pt", padding=True).to(device)

    # Memory measurement
    torch.cuda.reset_peak_memory_stats()

    # Latency measurement
    torch.cuda.synchronize()
    start = time.time()

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=100,
            do_sample=False
        )

    torch.cuda.synchronize()
    latency = (time.time() - start) * 1000

    # Calculate metrics
    total_tokens = outputs.shape[0] * outputs.shape[1]
    throughput = total_tokens / (latency / 1000)
    memory = torch.cuda.max_memory_allocated() / 1024 / 1024

    # Perplexity (simplified)
    with torch.no_grad():
        outputs = model(**inputs, labels=inputs["input_ids"])
        perplexity = torch.exp(outputs.loss).item()

    return BenchmarkResult(
        latency_ms=latency,
        throughput=throughput,
        memory_mb=memory,
        perplexity=perplexity
    )

# Compare different configurations
def compare_quantization_configs(model_name, configs: Dict[str, dict]):
    """Compare different HQQ configurations."""
    results = {}

    for name, config in configs.items():
        print(f"\nBenchmarking: {name}")
        model = load_hqq_model(model_name, **config)
        result = benchmark_hqq_model(model, tokenizer, test_texts)
        results[name] = result

        print(f"  Latency: {result.latency_ms:.1f}ms")
        print(f"  Throughput: {result.throughput:.1f} tok/s")
        print(f"  Memory: {result.memory_mb:.1f}MB")
        print(f"  Perplexity: {result.perplexity:.2f}")

        del model
        torch.cuda.empty_cache()

    return results
```

## Integration Examples

### LangChain Integration

```python
from langchain_community.llms import HuggingFacePipeline
from transformers import AutoModelForCausalLM, AutoTokenizer, HqqConfig, pipeline

# Load HQQ model
config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

# Create pipeline
pipe = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    max_new_tokens=256
)

# Wrap for LangChain
llm = HuggingFacePipeline(pipeline=pipe)

# Use in chain
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

prompt = PromptTemplate(
    input_variables=["question"],
    template="Answer the question: {question}"
)

chain = LLMChain(llm=llm, prompt=prompt)
result = chain.run("What is machine learning?")
```

### Gradio Interface

```python
import gradio as gr
from transformers import AutoModelForCausalLM, AutoTokenizer, HqqConfig

# Load model
config = HqqConfig(nbits=4, group_size=64)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=config,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

def generate(prompt, max_tokens, temperature):
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=int(max_tokens),
        temperature=temperature,
        do_sample=temperature > 0
    )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

demo = gr.Interface(
    fn=generate,
    inputs=[
        gr.Textbox(label="Prompt"),
        gr.Slider(10, 500, value=100, label="Max Tokens"),
        gr.Slider(0, 2, value=0.7, label="Temperature")
    ],
    outputs=gr.Textbox(label="Output"),
    title="HQQ Quantized LLM"
)

demo.launch()
```
