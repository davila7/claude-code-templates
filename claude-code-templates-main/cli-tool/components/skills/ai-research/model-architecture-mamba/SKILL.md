---
name: mamba-architecture
description: State-space model with O(n) complexity vs Transformers' O(n²). 5× faster inference, million-token sequences, no KV cache. Selective SSM with hardware-aware design. Mamba-1 (d_state=16) and Mamba-2 (d_state=128, multi-head). Models 130M-2.8B on HuggingFace.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Model Architecture, Mamba, State Space Models, SSM, Linear Complexity, Long Context, Efficient Inference, Hardware-Aware, Alternative To Transformers]
dependencies: [mamba-ssm, torch, transformers, causal-conv1d]
---

# Mamba - Selective State Space Models

## Quick start

Mamba is a state-space model architecture achieving O(n) linear complexity for sequence modeling.

**Installation**:
```bash
# Install causal-conv1d (optional, for efficiency)
pip install causal-conv1d>=1.4.0

# Install Mamba
pip install mamba-ssm
# Or both together
pip install mamba-ssm[causal-conv1d]
```

**Prerequisites**: Linux, NVIDIA GPU, PyTorch 1.12+, CUDA 11.6+

**Basic usage** (Mamba block):
```python
import torch
from mamba_ssm import Mamba

batch, length, dim = 2, 64, 16
x = torch.randn(batch, length, dim).to("cuda")

model = Mamba(
    d_model=dim,      # Model dimension
    d_state=16,       # SSM state dimension
    d_conv=4,         # Conv1d kernel size
    expand=2          # Expansion factor
).to("cuda")

y = model(x)  # O(n) complexity!
assert y.shape == x.shape
```

## Common workflows

### Workflow 1: Language model with Mamba-2

**Complete LM with generation**:
```python
from mamba_ssm.models.mixer_seq_simple import MambaLMHeadModel
from mamba_ssm.models.config_mamba import MambaConfig
import torch

# Configure Mamba-2 LM
config = MambaConfig(
    d_model=1024,           # Hidden dimension
    n_layer=24,             # Number of layers
    vocab_size=50277,       # Vocabulary size
    ssm_cfg=dict(
        layer="Mamba2",     # Use Mamba-2
        d_state=128,        # Larger state for Mamba-2
        headdim=64,         # Head dimension
        ngroups=1           # Number of groups
    )
)

model = MambaLMHeadModel(config, device="cuda", dtype=torch.float16)

# Generate text
input_ids = torch.randint(0, 1000, (1, 20), device="cuda", dtype=torch.long)
output = model.generate(
    input_ids=input_ids,
    max_length=100,
    temperature=0.7,
    top_p=0.9
)
```

### Workflow 2: Use pretrained Mamba models

**Load from HuggingFace**:
```python
from transformers import AutoTokenizer
from mamba_ssm.models.mixer_seq_simple import MambaLMHeadModel

# Load pretrained model
model_name = "state-spaces/mamba-2.8b"
tokenizer = AutoTokenizer.from_pretrained("EleutherAI/gpt-neox-20b")  # Use compatible tokenizer
model = MambaLMHeadModel.from_pretrained(model_name, device="cuda", dtype=torch.float16)

# Generate
prompt = "The future of AI is"
input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to("cuda")
output_ids = model.generate(
    input_ids=input_ids,
    max_length=200,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=1.2
)
generated_text = tokenizer.decode(output_ids[0])
print(generated_text)
```

**Available models**:
- `state-spaces/mamba-130m`
- `state-spaces/mamba-370m`
- `state-spaces/mamba-790m`
- `state-spaces/mamba-1.4b`
- `state-spaces/mamba-2.8b`

### Workflow 3: Mamba-1 vs Mamba-2

**Mamba-1** (smaller state):
```python
from mamba_ssm import Mamba

model = Mamba(
    d_model=256,
    d_state=16,      # Smaller state dimension
    d_conv=4,
    expand=2
).to("cuda")
```

**Mamba-2** (multi-head, larger state):
```python
from mamba_ssm import Mamba2

model = Mamba2(
    d_model=256,
    d_state=128,     # Larger state dimension
    d_conv=4,
    expand=2,
    headdim=64,      # Head dimension for multi-head
    ngroups=1        # Parallel groups
).to("cuda")
```

**Key differences**:
- **State size**: Mamba-1 (d_state=16) vs Mamba-2 (d_state=128)
- **Architecture**: Mamba-2 has multi-head structure
- **Normalization**: Mamba-2 uses RMSNorm
- **Distributed**: Mamba-2 supports tensor parallelism

### Workflow 4: Benchmark vs Transformers

**Generation speed comparison**:
```bash
# Benchmark Mamba
python benchmarks/benchmark_generation_mamba_simple.py \
  --model-name "state-spaces/mamba-2.8b" \
  --prompt "The future of machine learning is" \
  --topp 0.9 --temperature 0.7 --repetition-penalty 1.2

# Benchmark Transformer
python benchmarks/benchmark_generation_mamba_simple.py \
  --model-name "EleutherAI/pythia-2.8b" \
  --prompt "The future of machine learning is" \
  --topp 0.9 --temperature 0.7 --repetition-penalty 1.2
```

**Expected results**:
- **Mamba**: 5× faster inference
- **Memory**: No KV cache needed
- **Scaling**: Linear with sequence length

## When to use vs alternatives

**Use Mamba when**:
- Need long sequences (100K+ tokens)
- Want faster inference than Transformers
- Memory-constrained (no KV cache)
- Building streaming applications
- Linear scaling important

**Advantages**:
- **O(n) complexity**: Linear vs quadratic
- **5× faster inference**: No attention overhead
- **No KV cache**: Lower memory usage
- **Million-token sequences**: Hardware-efficient
- **Streaming**: Constant memory per token

**Use alternatives instead**:
- **Transformers**: Need best-in-class performance, have compute
- **RWKV**: Want RNN+Transformer hybrid
- **RetNet**: Need retention-based architecture
- **Hyena**: Want convolution-based approach

## Common issues

**Issue: CUDA out of memory**

Reduce batch size or use gradient checkpointing:
```python
model = MambaLMHeadModel(config, device="cuda", dtype=torch.float16)
model.gradient_checkpointing_enable()  # Enable checkpointing
```

**Issue: Slow installation**

Install binary wheels (not source):
```bash
pip install mamba-ssm --no-build-isolation
```

**Issue: Missing causal-conv1d**

Install separately:
```bash
pip install causal-conv1d>=1.4.0
```

**Issue: Model not loading from HuggingFace**

Use `MambaLMHeadModel.from_pretrained` (not `AutoModel`):
```python
from mamba_ssm.models.mixer_seq_simple import MambaLMHeadModel
model = MambaLMHeadModel.from_pretrained("state-spaces/mamba-2.8b")
```

## Advanced topics

**Selective SSM**: See [references/selective-ssm.md](references/selective-ssm.md) for mathematical formulation, state-space equations, and how selectivity enables O(n) complexity.

**Mamba-2 architecture**: See [references/mamba2-details.md](references/mamba2-details.md) for multi-head structure, tensor parallelism, and distributed training setup.

**Performance optimization**: See [references/performance.md](references/performance.md) for hardware-aware design, CUDA kernels, and memory efficiency techniques.

## Hardware requirements

- **GPU**: NVIDIA with CUDA 11.6+
- **VRAM**:
  - 130M model: 2GB
  - 370M model: 4GB
  - 790M model: 8GB
  - 1.4B model: 14GB
  - 2.8B model: 28GB (FP16)
- **Inference**: 5× faster than Transformers
- **Memory**: No KV cache (lower than Transformers)

**Performance** (vs Transformers):
- **Speed**: 5× faster inference
- **Memory**: 50% less (no KV cache)
- **Scaling**: Linear vs quadratic

## Resources

- Paper (Mamba-1): https://arxiv.org/abs/2312.00752 (Dec 2023)
- Paper (Mamba-2): https://arxiv.org/abs/2405.21060 (May 2024)
- GitHub: https://github.com/state-spaces/mamba ⭐ 13,000+
- Models: https://huggingface.co/state-spaces
- Docs: Repository README and wiki


