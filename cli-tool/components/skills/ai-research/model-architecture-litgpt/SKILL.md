---
name: implementing-llms-litgpt
description: Implements and trains LLMs using Lightning AI's LitGPT with 20+ pretrained architectures (Llama, Gemma, Phi, Qwen, Mistral). Use when need clean model implementations, educational understanding of architectures, or production fine-tuning with LoRA/QLoRA. Single-file implementations, no abstraction layers.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Model Architecture, LitGPT, Lightning AI, LLM Implementation, LoRA, QLoRA, Fine-Tuning, Llama, Gemma, Phi, Mistral, Educational]
dependencies: [litgpt, torch, transformers]
---

# LitGPT - Clean LLM Implementations

## Quick start

LitGPT provides 20+ pretrained LLM implementations with clean, readable code and production-ready training workflows.

**Installation**:
```bash
pip install 'litgpt[extra]'
```

**Load and use any model**:
```python
from litgpt import LLM

# Load pretrained model
llm = LLM.load("microsoft/phi-2")

# Generate text
result = llm.generate(
    "What is the capital of France?",
    max_new_tokens=50,
    temperature=0.7
)
print(result)
```

**List available models**:
```bash
litgpt download list
```

## Common workflows

### Workflow 1: Fine-tune on custom dataset

Copy this checklist:

```
Fine-Tuning Setup:
- [ ] Step 1: Download pretrained model
- [ ] Step 2: Prepare dataset
- [ ] Step 3: Configure training
- [ ] Step 4: Run fine-tuning
```

**Step 1: Download pretrained model**

```bash
# Download Llama 3 8B
litgpt download meta-llama/Meta-Llama-3-8B

# Download Phi-2 (smaller, faster)
litgpt download microsoft/phi-2

# Download Gemma 2B
litgpt download google/gemma-2b
```

Models are saved to `checkpoints/` directory.

**Step 2: Prepare dataset**

LitGPT supports multiple formats:

**Alpaca format** (instruction-response):
```json
[
  {
    "instruction": "What is the capital of France?",
    "input": "",
    "output": "The capital of France is Paris."
  },
  {
    "instruction": "Translate to Spanish: Hello, how are you?",
    "input": "",
    "output": "Hola, ¿cómo estás?"
  }
]
```

Save as `data/my_dataset.json`.

**Step 3: Configure training**

```bash
# Full fine-tuning (requires 40GB+ GPU for 7B models)
litgpt finetune \
  meta-llama/Meta-Llama-3-8B \
  --data JSON \
  --data.json_path data/my_dataset.json \
  --train.max_steps 1000 \
  --train.learning_rate 2e-5 \
  --train.micro_batch_size 1 \
  --train.global_batch_size 16

# LoRA fine-tuning (efficient, 16GB GPU)
litgpt finetune_lora \
  microsoft/phi-2 \
  --data JSON \
  --data.json_path data/my_dataset.json \
  --lora_r 16 \
  --lora_alpha 32 \
  --lora_dropout 0.05 \
  --train.max_steps 1000 \
  --train.learning_rate 1e-4
```

**Step 4: Run fine-tuning**

Training saves checkpoints to `out/finetune/` automatically.

Monitor training:
```bash
# View logs
tail -f out/finetune/logs.txt

# TensorBoard (if using --train.logger_name tensorboard)
tensorboard --logdir out/finetune/lightning_logs
```

### Workflow 2: LoRA fine-tuning on single GPU

Most memory-efficient option.

```
LoRA Training:
- [ ] Step 1: Choose base model
- [ ] Step 2: Configure LoRA parameters
- [ ] Step 3: Train with LoRA
- [ ] Step 4: Merge LoRA weights (optional)
```

**Step 1: Choose base model**

For limited GPU memory (12-16GB):
- **Phi-2** (2.7B) - Best quality/size tradeoff
- **Llama 3 1B** - Smallest, fastest
- **Gemma 2B** - Good reasoning

**Step 2: Configure LoRA parameters**

```bash
litgpt finetune_lora \
  microsoft/phi-2 \
  --data JSON \
  --data.json_path data/my_dataset.json \
  --lora_r 16 \          # LoRA rank (8-64, higher=more capacity)
  --lora_alpha 32 \      # LoRA scaling (typically 2×r)
  --lora_dropout 0.05 \  # Prevent overfitting
  --lora_query true \    # Apply LoRA to query projection
  --lora_key false \     # Usually not needed
  --lora_value true \    # Apply LoRA to value projection
  --lora_projection true \  # Apply LoRA to output projection
  --lora_mlp false \     # Usually not needed
  --lora_head false      # Usually not needed
```

LoRA rank guide:
- `r=8`: Lightweight, 2-4MB adapters
- `r=16`: Standard, good quality
- `r=32`: High capacity, use for complex tasks
- `r=64`: Maximum quality, 4× larger adapters

**Step 3: Train with LoRA**

```bash
litgpt finetune_lora \
  microsoft/phi-2 \
  --data JSON \
  --data.json_path data/my_dataset.json \
  --lora_r 16 \
  --train.epochs 3 \
  --train.learning_rate 1e-4 \
  --train.micro_batch_size 4 \
  --train.global_batch_size 32 \
  --out_dir out/phi2-lora

# Memory usage: ~8-12GB for Phi-2 with LoRA
```

**Step 4: Merge LoRA weights** (optional)

Merge LoRA adapters into base model for deployment:

```bash
litgpt merge_lora \
  out/phi2-lora/final \
  --out_dir out/phi2-merged
```

Now use merged model:
```python
from litgpt import LLM
llm = LLM.load("out/phi2-merged")
```

### Workflow 3: Pretrain from scratch

Train new model on your domain data.

```
Pretraining:
- [ ] Step 1: Prepare pretraining dataset
- [ ] Step 2: Configure model architecture
- [ ] Step 3: Set up multi-GPU training
- [ ] Step 4: Launch pretraining
```

**Step 1: Prepare pretraining dataset**

LitGPT expects tokenized data. Use `prepare_dataset.py`:

```bash
python scripts/prepare_dataset.py \
  --source_path data/my_corpus.txt \
  --checkpoint_dir checkpoints/tokenizer \
  --destination_path data/pretrain \
  --split train,val
```

**Step 2: Configure model architecture**

Edit config file or use existing:

```python
# config/pythia-160m.yaml
model_name: pythia-160m
block_size: 2048
vocab_size: 50304
n_layer: 12
n_head: 12
n_embd: 768
rotary_percentage: 0.25
parallel_residual: true
bias: true
```

**Step 3: Set up multi-GPU training**

```bash
# Single GPU
litgpt pretrain \
  --config config/pythia-160m.yaml \
  --data.data_dir data/pretrain \
  --train.max_tokens 10_000_000_000

# Multi-GPU with FSDP
litgpt pretrain \
  --config config/pythia-1b.yaml \
  --data.data_dir data/pretrain \
  --devices 8 \
  --train.max_tokens 100_000_000_000
```

**Step 4: Launch pretraining**

For large-scale pretraining on cluster:

```bash
# Using SLURM
sbatch --nodes=8 --gpus-per-node=8 \
  pretrain_script.sh

# pretrain_script.sh content:
litgpt pretrain \
  --config config/pythia-1b.yaml \
  --data.data_dir /shared/data/pretrain \
  --devices 8 \
  --num_nodes 8 \
  --train.global_batch_size 512 \
  --train.max_tokens 300_000_000_000
```

### Workflow 4: Convert and deploy model

Export LitGPT models for production.

```
Model Deployment:
- [ ] Step 1: Test inference locally
- [ ] Step 2: Quantize model (optional)
- [ ] Step 3: Convert to GGUF (for llama.cpp)
- [ ] Step 4: Deploy with API
```

**Step 1: Test inference locally**

```python
from litgpt import LLM

llm = LLM.load("out/phi2-lora/final")

# Single generation
print(llm.generate("What is machine learning?"))

# Streaming
for token in llm.generate("Explain quantum computing", stream=True):
    print(token, end="", flush=True)

# Batch inference
prompts = ["Hello", "Goodbye", "Thank you"]
results = [llm.generate(p) for p in prompts]
```

**Step 2: Quantize model** (optional)

Reduce model size with minimal quality loss:

```bash
# 8-bit quantization (50% size reduction)
litgpt convert_lit_checkpoint \
  out/phi2-lora/final \
  --dtype bfloat16 \
  --quantize bnb.nf4

# 4-bit quantization (75% size reduction)
litgpt convert_lit_checkpoint \
  out/phi2-lora/final \
  --quantize bnb.nf4-dq  # Double quantization
```

**Step 3: Convert to GGUF** (for llama.cpp)

```bash
python scripts/convert_lit_checkpoint.py \
  --checkpoint_path out/phi2-lora/final \
  --output_path models/phi2.gguf \
  --model_name microsoft/phi-2
```

**Step 4: Deploy with API**

```python
from fastapi import FastAPI
from litgpt import LLM

app = FastAPI()
llm = LLM.load("out/phi2-lora/final")

@app.post("/generate")
def generate(prompt: str, max_tokens: int = 100):
    result = llm.generate(
        prompt,
        max_new_tokens=max_tokens,
        temperature=0.7
    )
    return {"response": result}

# Run: uvicorn api:app --host 0.0.0.0 --port 8000
```

## When to use vs alternatives

**Use LitGPT when:**
- Want to understand LLM architectures (clean, readable code)
- Need production-ready training recipes
- Educational purposes or research
- Prototyping new model ideas
- Lightning ecosystem user

**Use alternatives instead:**
- **Axolotl/TRL**: More fine-tuning features, YAML configs
- **Megatron-Core**: Maximum performance for >70B models
- **HuggingFace Transformers**: Broadest model support
- **vLLM**: Inference-only (no training)

## Common issues

**Issue: Out of memory during fine-tuning**

Use LoRA instead of full fine-tuning:
```bash
# Instead of litgpt finetune (requires 40GB+)
litgpt finetune_lora  # Only needs 12-16GB
```

Or enable gradient checkpointing:
```bash
litgpt finetune_lora \
  ... \
  --train.gradient_accumulation_iters 4  # Accumulate gradients
```

**Issue: Training too slow**

Enable Flash Attention (built-in, automatic on compatible hardware):
```python
# Already enabled by default on Ampere+ GPUs (A100, RTX 30/40 series)
# No configuration needed
```

Use smaller micro-batch and accumulate:
```bash
--train.micro_batch_size 1 \
--train.global_batch_size 32 \
--train.gradient_accumulation_iters 32  # Effective batch=32
```

**Issue: Model not loading**

Check model name:
```bash
# List all available models
litgpt download list

# Download if not exists
litgpt download meta-llama/Meta-Llama-3-8B
```

Verify checkpoints directory:
```bash
ls checkpoints/
# Should see: meta-llama/Meta-Llama-3-8B/
```

**Issue: LoRA adapters too large**

Reduce LoRA rank:
```bash
--lora_r 8  # Instead of 16 or 32
```

Apply LoRA to fewer layers:
```bash
--lora_query true \
--lora_value true \
--lora_projection false \  # Disable this
--lora_mlp false  # And this
```

## Advanced topics

**Supported architectures**: See [references/supported-models.md](references/supported-models.md) for complete list of 20+ model families with sizes and capabilities.

**Training recipes**: See [references/training-recipes.md](references/training-recipes.md) for proven hyperparameter configurations for pretraining and fine-tuning.

**FSDP configuration**: See [references/distributed-training.md](references/distributed-training.md) for multi-GPU training with Fully Sharded Data Parallel.

**Custom architectures**: See [references/custom-models.md](references/custom-models.md) for implementing new model architectures in LitGPT style.

## Hardware requirements

- **GPU**: NVIDIA (CUDA 11.8+), AMD (ROCm), Apple Silicon (MPS)
- **Memory**:
  - Inference (Phi-2): 6GB
  - LoRA fine-tuning (7B): 16GB
  - Full fine-tuning (7B): 40GB+
  - Pretraining (1B): 24GB
- **Storage**: 5-50GB per model (depending on size)

## Resources

- GitHub: https://github.com/Lightning-AI/litgpt
- Docs: https://lightning.ai/docs/litgpt
- Tutorials: https://lightning.ai/docs/litgpt/tutorials
- Model zoo: 20+ pretrained architectures (Llama, Gemma, Phi, Qwen, Mistral, Mixtral, Falcon, etc.)


