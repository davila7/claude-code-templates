# torchforge API Reference

## Architecture Overview

torchforge implements a fully asynchronous RL system built on:

- **Monarch**: PyTorch-native distributed coordination framework
- **TorchTitan**: Meta's production LLM training platform
- **vLLM**: High-throughput inference engine

```
┌─────────────────────────────────────────────────────────┐
│ Application Layer (Your Code)                           │
│ - Define reward models, loss functions, sampling        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Forge API Layer                                         │
│ - ForgeActor, Service                                   │
│ - Async service interfaces                              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Distributed Services (Monarch)                          │
│ ├── TitanTrainer (TorchTitan FSDP)                     │
│ ├── Generator (vLLM inference)                          │
│ └── ReferenceModel (frozen KL baseline)                │
└─────────────────────────────────────────────────────────┘
```

## Core Classes

### ForgeActor

Base class for Forge actors with configurable resource attributes.

**Location**: `forge.controller.actor.ForgeActor`

```python
from forge.controller.actor import ForgeActor

class MyActor(ForgeActor):
    procs = 1           # Number of processes
    hosts = None        # Host distribution
    with_gpus = True    # GPU allocation flag
    num_replicas = 1    # Service replica count
    mesh_name = None    # Process mesh identifier
```

**Class Methods**:
- `as_actor(*args, **actor_kwargs)` → Spawns single actor using .options() configuration
- `launch(*args, **kwargs)` → Provisions and deploys new actor replica
- `options(*, procs=1, hosts=None, with_gpus=False, num_replicas=1, mesh_name=None, **kwargs)` → Pre-configures actor class
- `shutdown(actor)` → Terminates actor instance

### TitanTrainer

Generic trainer actor built on TorchTitan's training engine.

**Location**: `forge.actors.trainer.TitanTrainer`

**Key Methods**:
- `forward_backward(batch)` → Forward and backward pass
- `train_step()` → Complete training step
- `setup()` / `cleanup()` → Lifecycle methods
- `clear_gradients()` → Reset gradients
- `save()` / `load()` → Checkpoint operations
- `push_weights()` → Sync weights to inference
- `get_config()` / `get_status()` → Introspection

**Properties**: `job`, `model`, `optimizer`, `lr_scheduler`, `training`, `parallelism`, `checkpoint`, `activation_checkpoint`, `compile`, `quantize`, `comm`, `memory_estimation`, `state_dict_key`

### Generator

vLLM-based generator for inference.

**Location**: `forge.actors.generator.Generator`

```python
from forge.actors.generator import Generator

generator = Generator(
    engine_args=<factory>,
    sampling_params=<factory>,
    prefetch_weights_to_shm=True,
    n_fetcher_procs=8
)
```

**Key Methods**:
- `generate()` → Generate completions
- `run()` → Async generation loop
- `update_weights()` → Receive new weights from trainer
- `get_version()` / `get_vllm_config()` → Introspection

**Returns**: `Completion` dataclass with fields: `prompt`, `text`, `token_ids`, `logprobs`

### ReferenceModel

Frozen policy copy for computing KL divergence.

**Location**: `forge.actors.reference_model.ReferenceModel`

Maintains a frozen copy of the policy for computing advantages without gradient computation.

**Key Methods**:
- `forward()` → Inference without gradients
- `setup()` → Initialize from checkpoint

### Service

Actor-less service implementation for managing replicas.

**Location**: `forge.controller.service.service.Service`

```python
Service(cfg, actor_def, actor_args, actor_kwargs)
```

**Methods**:
- `call_all(function, *args, **kwargs)` → Call function on all healthy replicas
- `get_metrics()` → Returns ServiceMetrics object
- `start_session()` / `terminate_session(sess_id)` → Session management
- `stop()` → Stop service and all replicas

## Configuration (TorchTitan)

torchforge uses TorchTitan's configuration system:

### Job Configuration

```python
from torchtitan.config.job_config import Job

@dataclass
class Job:
    config_file: str
    dump_folder: str
    description: str
    print_config: bool
    custom_config_module: str
```

### Model Configuration

```python
from torchtitan.config.job_config import Model

@dataclass
class Model:
    name: str
    flavor: str
    hf_assets_path: str
    tokenizer_path: str
    converters: list
    print_after_conversion: bool
```

### Training Configuration

```python
from torchtitan.config.job_config import Training

@dataclass
class Training:
    dataset: str
    dataset_path: str
    local_batch_size: int
    global_batch_size: int
    seq_len: int
    max_norm: float
    steps: int
    dtype: str
    mixed_precision_param: str
    mixed_precision_reduce: str
    gc_freq: int
    seed: int
    deterministic: bool
    enable_cpu_offload: bool
    # ... additional fields
```

### Parallelism Configuration

```python
from torchtitan.config.job_config import Parallelism

@dataclass
class Parallelism:
    # Parallelism degrees
    data_parallel_shard_degree: int
    data_parallel_replicate_degree: int
    tensor_parallel_degree: int
    pipeline_parallel_degree: int
    context_parallel_degree: int
    expert_parallel_degree: int
    # FSDP configuration options
    # ... additional fields
```

### Optimizer Configuration

```python
from torchtitan.config.job_config import Optimizer

@dataclass
class Optimizer:
    name: str
    lr: float
    beta1: float
    beta2: float
    eps: float
    weight_decay: float
    implementation: str
    early_step_in_backward: bool
```

## YAML Configuration Example

```yaml
# config/grpo_math.yaml
model: "Qwen/Qwen2.5-7B-Instruct"

dataset:
  path: "openai/gsm8k"
  split: "train"
  streaming: true

training:
  batch_size: 4
  learning_rate: 1e-6
  seq_len: 4096
  dtype: bfloat16
  gradient_accumulation_steps: 4

grpo:
  n_samples: 8
  clip_low: 0.2
  clip_high: 0.28
  beta: 0.1
  temperature: 0.7

services:
  generator:
    procs: 1
    num_replicas: 1
    with_gpus: true
  trainer:
    procs: 1
    num_replicas: 1
    with_gpus: true
  ref_model:
    procs: 1
    num_replicas: 1
    with_gpus: true
```

## Launch Commands

### SFT Training (2+ GPUs)

```bash
python -m apps.sft.main --config apps/sft/llama3_8b.yaml
```

### GRPO Training (3+ GPUs)

```bash
python -m apps.grpo.main --config apps/grpo/qwen3_1_7b.yaml
```

### Multi-GPU Distributed

```bash
python -m apps.grpo.main \
    --config config/distributed.yaml \
    --trainer.procs 4 \
    --generator.procs 4
```

## Async Communication Pattern

torchforge uses async/await patterns for service communication:

```python
# Route: async point-to-point
response = await service.method.route(arg1, arg2)

# Fanout: broadcast to all replicas
await service.update_weights.fanout(training_step)
```

## Installation

```bash
# Create environment
conda create -n forge python=3.12
conda activate forge

# Install (handles PyTorch nightly + dependencies)
./scripts/install.sh

# ROCm (AMD GPUs)
./scripts/install_rocm.sh

# Verify
python -c "import torch, forge, vllm; print('OK')"
```

**Requirements**:
- PyTorch >= 2.9.0 (nightly)
- Monarch
- TorchTitan
- vLLM

## Experimental Warning

Both Monarch and torchforge are experimental. APIs may change as the project learns from early adopters.

## Resources

- Documentation: https://meta-pytorch.org/torchforge
- GitHub: https://github.com/meta-pytorch/torchforge
- Discord: https://discord.gg/YsTYBh6PD9
- TorchTitan: https://github.com/pytorch/torchtitan
- Monarch: https://github.com/meta-pytorch/monarch
- Blog: https://pytorch.org/blog/introducing-torchforge/
