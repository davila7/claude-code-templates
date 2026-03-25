---
name: ray-train
description: Distributed training orchestration across clusters. Scales PyTorch/TensorFlow/HuggingFace from laptop to 1000s of nodes. Built-in hyperparameter tuning with Ray Tune, fault tolerance, elastic scaling. Use when training massive models across multiple machines or running distributed hyperparameter sweeps.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Ray Train, Distributed Training, Orchestration, Ray, Hyperparameter Tuning, Fault Tolerance, Elastic Scaling, Multi-Node, PyTorch, TensorFlow]
dependencies: [ray[train], torch, transformers]
---

# Ray Train - Distributed Training Orchestration

## Quick start

Ray Train scales machine learning training from single GPU to multi-node clusters with minimal code changes.

**Installation**:
```bash
pip install -U "ray[train]"
```

**Basic PyTorch training** (single node):

```python
import ray
from ray import train
from ray.train import ScalingConfig
from ray.train.torch import TorchTrainer
import torch
import torch.nn as nn

# Define training function
def train_func(config):
    # Your normal PyTorch code
    model = nn.Linear(10, 1)
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

    # Prepare for distributed (Ray handles device placement)
    model = train.torch.prepare_model(model)

    for epoch in range(10):
        # Your training loop
        output = model(torch.randn(32, 10))
        loss = output.sum()
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

        # Report metrics (logged automatically)
        train.report({"loss": loss.item(), "epoch": epoch})

# Run distributed training
trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(
        num_workers=4,  # 4 GPUs/workers
        use_gpu=True
    )
)

result = trainer.fit()
print(f"Final loss: {result.metrics['loss']}")
```

**That's it!** Ray handles:
- Distributed coordination
- GPU allocation
- Fault tolerance
- Checkpointing
- Metric aggregation

## Common workflows

### Workflow 1: Scale existing PyTorch code

**Original single-GPU code**:
```python
model = MyModel().cuda()
optimizer = torch.optim.Adam(model.parameters())

for epoch in range(epochs):
    for batch in dataloader:
        loss = model(batch)
        loss.backward()
        optimizer.step()
```

**Ray Train version** (scales to multi-GPU/multi-node):
```python
from ray.train.torch import TorchTrainer
from ray import train

def train_func(config):
    model = MyModel()
    optimizer = torch.optim.Adam(model.parameters())

    # Prepare for distributed (automatic device placement)
    model = train.torch.prepare_model(model)
    dataloader = train.torch.prepare_data_loader(dataloader)

    for epoch in range(epochs):
        for batch in dataloader:
            loss = model(batch)
            loss.backward()
            optimizer.step()

            # Report metrics
            train.report({"loss": loss.item()})

# Scale to 8 GPUs
trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(num_workers=8, use_gpu=True)
)
trainer.fit()
```

**Benefits**: Same code runs on 1 GPU or 1000 GPUs

### Workflow 2: HuggingFace Transformers integration

```python
from ray.train.huggingface import TransformersTrainer
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments

def train_func(config):
    # Load model and tokenizer
    model = AutoModelForCausalLM.from_pretrained("gpt2")
    tokenizer = AutoTokenizer.from_pretrained("gpt2")

    # Training arguments (HuggingFace API)
    training_args = TrainingArguments(
        output_dir="./output",
        num_train_epochs=3,
        per_device_train_batch_size=8,
        learning_rate=2e-5,
    )

    # Ray automatically handles distributed training
    from transformers import Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
    )

    trainer.train()

# Scale to multi-node (2 nodes × 8 GPUs = 16 workers)
trainer = TransformersTrainer(
    train_func,
    scaling_config=ScalingConfig(
        num_workers=16,
        use_gpu=True,
        resources_per_worker={"GPU": 1}
    )
)

result = trainer.fit()
```

### Workflow 3: Hyperparameter tuning with Ray Tune

```python
from ray import tune
from ray.train.torch import TorchTrainer
from ray.tune.schedulers import ASHAScheduler

def train_func(config):
    # Use hyperparameters from config
    lr = config["lr"]
    batch_size = config["batch_size"]

    model = MyModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    model = train.torch.prepare_model(model)

    for epoch in range(10):
        # Training loop
        loss = train_epoch(model, optimizer, batch_size)
        train.report({"loss": loss, "epoch": epoch})

# Define search space
param_space = {
    "lr": tune.loguniform(1e-5, 1e-2),
    "batch_size": tune.choice([16, 32, 64, 128])
}

# Run 20 trials with early stopping
tuner = tune.Tuner(
    TorchTrainer(
        train_func,
        scaling_config=ScalingConfig(num_workers=4, use_gpu=True)
    ),
    param_space=param_space,
    tune_config=tune.TuneConfig(
        num_samples=20,
        scheduler=ASHAScheduler(metric="loss", mode="min")
    )
)

results = tuner.fit()
best = results.get_best_result(metric="loss", mode="min")
print(f"Best hyperparameters: {best.config}")
```

**Result**: Distributed hyperparameter search across cluster

### Workflow 4: Checkpointing and fault tolerance

```python
from ray import train
from ray.train import Checkpoint

def train_func(config):
    model = MyModel()
    optimizer = torch.optim.Adam(model.parameters())

    # Try to resume from checkpoint
    checkpoint = train.get_checkpoint()
    if checkpoint:
        with checkpoint.as_directory() as checkpoint_dir:
            state = torch.load(f"{checkpoint_dir}/model.pt")
            model.load_state_dict(state["model"])
            optimizer.load_state_dict(state["optimizer"])
            start_epoch = state["epoch"]
    else:
        start_epoch = 0

    model = train.torch.prepare_model(model)

    for epoch in range(start_epoch, 100):
        loss = train_epoch(model, optimizer)

        # Save checkpoint every 10 epochs
        if epoch % 10 == 0:
            checkpoint = Checkpoint.from_directory(
                train.get_context().get_trial_dir()
            )
            torch.save({
                "model": model.state_dict(),
                "optimizer": optimizer.state_dict(),
                "epoch": epoch
            }, checkpoint.path / "model.pt")

            train.report({"loss": loss}, checkpoint=checkpoint)

trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(num_workers=8, use_gpu=True)
)

# Automatically resumes from checkpoint if training fails
result = trainer.fit()
```

### Workflow 5: Multi-node training

```python
from ray.train import ScalingConfig

# Connect to Ray cluster
ray.init(address="auto")  # Or ray.init("ray://head-node:10001")

# Train across 4 nodes × 8 GPUs = 32 workers
trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(
        num_workers=32,
        use_gpu=True,
        resources_per_worker={"GPU": 1, "CPU": 4},
        placement_strategy="SPREAD"  # Spread across nodes
    )
)

result = trainer.fit()
```

**Launch Ray cluster**:
```bash
# On head node
ray start --head --port=6379

# On worker nodes
ray start --address=<head-node-ip>:6379
```

## When to use vs alternatives

**Use Ray Train when**:
- Training across multiple machines (multi-node)
- Need hyperparameter tuning at scale
- Want fault tolerance (auto-restart failed workers)
- Elastic scaling (add/remove nodes during training)
- Unified framework (same code for PyTorch/TF/HF)

**Key advantages**:
- **Multi-node orchestration**: Easiest multi-node setup
- **Ray Tune integration**: Best-in-class hyperparameter tuning
- **Fault tolerance**: Automatic recovery from failures
- **Elastic**: Add/remove nodes without restarting
- **Framework agnostic**: PyTorch, TensorFlow, HuggingFace, XGBoost

**Use alternatives instead**:
- **Accelerate**: Single-node multi-GPU, simpler
- **PyTorch Lightning**: High-level abstractions, callbacks
- **DeepSpeed**: Maximum performance, complex setup
- **Raw DDP**: Maximum control, minimal overhead

## Common issues

**Issue: Ray cluster not connecting**

Check ray status:
```bash
ray status

# Should show:
# - Nodes: 4
# - GPUs: 32
# - Workers: Ready
```

If not connected:
```bash
# Restart head node
ray stop
ray start --head --port=6379 --dashboard-host=0.0.0.0

# Restart worker nodes
ray stop
ray start --address=<head-ip>:6379
```

**Issue: Out of memory**

Reduce workers or use gradient accumulation:
```python
scaling_config=ScalingConfig(
    num_workers=4,  # Reduce from 8
    use_gpu=True
)

# In train_func, accumulate gradients
for i, batch in enumerate(dataloader):
    loss = model(batch) / accumulation_steps
    loss.backward()

    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```

**Issue: Slow training**

Check if data loading is bottleneck:
```python
import time

def train_func(config):
    for epoch in range(epochs):
        start = time.time()
        for batch in dataloader:
            data_time = time.time() - start
            # Train...
            start = time.time()
            print(f"Data loading: {data_time:.3f}s")
```

If data loading is slow, increase workers:
```python
dataloader = DataLoader(dataset, num_workers=8)
```

## Advanced topics

**Multi-node setup**: See [references/multi-node.md](references/multi-node.md) for Ray cluster deployment on AWS, GCP, Kubernetes, and SLURM.

**Hyperparameter tuning**: See [references/hyperparameter-tuning.md](references/hyperparameter-tuning.md) for Ray Tune integration, search algorithms (Optuna, HyperOpt), and population-based training.

**Custom training loops**: See [references/custom-loops.md](references/custom-loops.md) for advanced Ray Train usage, custom backends, and integration with other frameworks.

## Hardware requirements

- **Single node**: 1+ GPUs (or CPUs)
- **Multi-node**: 2+ machines with network connectivity
- **Cloud**: AWS, GCP, Azure (Ray autoscaling)
- **On-prem**: Kubernetes, SLURM clusters

**Supported accelerators**:
- NVIDIA GPUs (CUDA)
- AMD GPUs (ROCm)
- TPUs (Google Cloud)
- CPUs

## Resources

- Docs: https://docs.ray.io/en/latest/train/train.html
- GitHub: https://github.com/ray-project/ray ⭐ 36,000+
- Version: 2.40.0+
- Examples: https://docs.ray.io/en/latest/train/examples.html
- Slack: https://forms.gle/9TSdDYUgxYs8SA9e8
- Used by: OpenAI, Uber, Spotify, Shopify, Instacart


