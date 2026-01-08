# Performance Profiling Guide

Complete guide to profiling and optimizing ML models with TensorBoard.

## Table of Contents
- PyTorch Profiler
- TensorFlow Profiler
- GPU Utilization
- Memory Profiling
- Bottleneck Detection
- Optimization Strategies

## PyTorch Profiler

### Basic Profiling

```python
import torch
import torch.profiler as profiler

model = MyModel().cuda()
optimizer = torch.optim.Adam(model.parameters())

# Profile training loop
with profiler.profile(
    activities=[
        profiler.ProfilerActivity.CPU,
        profiler.ProfilerActivity.CUDA,
    ],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/profiler'),
    record_shapes=True,
    with_stack=True
) as prof:
    for step, (data, target) in enumerate(train_loader):
        optimizer.zero_grad()
        output = model(data.cuda())
        loss = F.cross_entropy(output, target.cuda())
        loss.backward()
        optimizer.step()

        # Mark step for profiler
        prof.step()

        if step >= 10:  # Profile first 10 steps
            break
```

### Profiler Configuration

```python
with profiler.profile(
    activities=[
        profiler.ProfilerActivity.CPU,     # Profile CPU ops
        profiler.ProfilerActivity.CUDA,    # Profile GPU ops
    ],
    schedule=profiler.schedule(
        wait=1,     # Warmup steps (skip profiling)
        warmup=1,   # Steps to warmup profiler
        active=3,   # Steps to actively profile
        repeat=2    # Repeat cycle 2 times
    ),
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/profiler'),
    record_shapes=True,     # Record tensor shapes
    profile_memory=True,    # Track memory allocation
    with_stack=True,        # Record source code stack traces
    with_flops=True         # Estimate FLOPS
) as prof:
    for step, batch in enumerate(train_loader):
        train_step(batch)
        prof.step()
```

### Profile Inference

```python
model.eval()

with profiler.profile(
    activities=[profiler.ProfilerActivity.CPU, profiler.ProfilerActivity.CUDA],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/inference_profiler')
) as prof:
    with torch.no_grad():
        for i in range(100):
            data = torch.randn(1, 3, 224, 224).cuda()
            output = model(data)
            prof.step()
```

### Analyze Profile Data

```python
# Print profiler summary
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=10))

# Export Chrome trace (for chrome://tracing)
prof.export_chrome_trace("trace.json")

# View in TensorBoard
# tensorboard --logdir=runs/profiler
```

**TensorBoard Profile Tab shows:**
- Overview: GPU utilization, step time breakdown
- Operator view: Time spent in each operation
- Kernel view: GPU kernel execution
- Trace view: Timeline of operations
- Memory view: Memory allocation over time

## TensorFlow Profiler

### Profile with Callback

```python
import tensorflow as tf

# Create profiler callback
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs/profiler',
    profile_batch='10,20'  # Profile batches 10-20
)

# Train with profiling
model.fit(
    x_train, y_train,
    epochs=5,
    callbacks=[tensorboard_callback]
)

# Launch TensorBoard
# tensorboard --logdir=logs/profiler
```

### Programmatic Profiling

```python
import tensorflow as tf

# Start profiler
tf.profiler.experimental.start('logs/profiler')

# Training code
for epoch in range(5):
    for step, (x, y) in enumerate(train_dataset):
        with tf.GradientTape() as tape:
            predictions = model(x, training=True)
            loss = loss_fn(y, predictions)

        gradients = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(gradients, model.trainable_variables))

        # Profile specific steps
        if epoch == 2 and step == 10:
            tf.profiler.experimental.start('logs/profiler_step10')

        if epoch == 2 and step == 20:
            tf.profiler.experimental.stop()

# Stop profiler
tf.profiler.experimental.stop()
```

### Profile Custom Training Loop

```python
# Profile with context manager
with tf.profiler.experimental.Profile('logs/profiler'):
    for epoch in range(3):
        for step, (x, y) in enumerate(train_dataset):
            train_step(x, y)
```

## GPU Utilization

### Monitor GPU Usage

```python
import torch
import torch.profiler as profiler

with profiler.profile(
    activities=[profiler.ProfilerActivity.CUDA],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/gpu_profile'),
    with_stack=True
) as prof:
    for step, batch in enumerate(train_loader):
        # Your training step
        output = model(batch.cuda())
        loss = criterion(output, target.cuda())
        loss.backward()
        optimizer.step()

        prof.step()

# View in TensorBoard > Profile > Overview
# Shows: GPU utilization %, kernel efficiency, memory bandwidth
```

### Optimize GPU Utilization

```python
# ✅ Good: Keep GPU busy
def train_step(batch):
    # Overlap data transfer with computation
    data = batch.cuda(non_blocking=True)  # Async transfer

    # Mixed precision for faster computation
    with torch.cuda.amp.autocast():
        output = model(data)
        loss = criterion(output, target)

    return loss

# ❌ Bad: GPU idle during data transfer
def train_step_slow(batch):
    data = batch.cuda()  # Blocking transfer
    output = model(data)
    return loss
```

### Reduce CPU-GPU Synchronization

```python
# ✅ Good: Minimize synchronization
for epoch in range(100):
    for batch in train_loader:
        loss = train_step(batch)

        # Accumulate losses (no sync)
        total_loss += loss.item()

    # Synchronize once per epoch
    avg_loss = total_loss / len(train_loader)

# ❌ Bad: Frequent synchronization
for batch in train_loader:
    loss = train_step(batch)
    print(f"Loss: {loss.item()}")  # Syncs every batch!
```

## Memory Profiling

### Track Memory Allocation

```python
import torch
import torch.profiler as profiler

with profiler.profile(
    activities=[profiler.ProfilerActivity.CUDA],
    profile_memory=True,
    record_shapes=True,
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/memory_profile')
) as prof:
    for step, batch in enumerate(train_loader):
        train_step(batch)
        prof.step()

# View in TensorBoard > Profile > Memory View
# Shows: Memory allocation over time, peak memory, allocation stack traces
```

### Find Memory Leaks

```python
import torch

# Record memory snapshots
torch.cuda.memory._record_memory_history(
    enabled=True,
    max_entries=100000
)

# Training
for batch in train_loader:
    train_step(batch)

# Save memory snapshot
snapshot = torch.cuda.memory._snapshot()
torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")

# Analyze with:
# python -m torch.cuda.memory_viz trace_plot memory_snapshot.pickle -o memory_trace.html
```

### Optimize Memory Usage

```python
# ✅ Good: Gradient accumulation for large batches
accumulation_steps = 4

for i, batch in enumerate(train_loader):
    # Forward
    output = model(batch)
    loss = criterion(output, target) / accumulation_steps

    # Backward
    loss.backward()

    # Step optimizer every accumulation_steps
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()

# ✅ Good: Release memory explicitly
del intermediate_tensor
torch.cuda.empty_cache()

# ✅ Good: Use gradient checkpointing
from torch.utils.checkpoint import checkpoint

def custom_forward(module, input):
    return checkpoint(module, input)
```

## Bottleneck Detection

### Identify Slow Operations

```python
with profiler.profile(
    activities=[profiler.ProfilerActivity.CPU, profiler.ProfilerActivity.CUDA],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/bottleneck_profile'),
    with_stack=True
) as prof:
    for step, batch in enumerate(train_loader):
        train_step(batch)
        prof.step()

# Print slowest operations
print(prof.key_averages().table(
    sort_by="cuda_time_total",
    row_limit=20
))

# Expected output:
# Name                    | CPU time | CUDA time | Calls
# aten::conv2d            | 5.2 ms   | 45.3 ms   | 32
# aten::batch_norm        | 1.1 ms   | 8.7 ms    | 32
# aten::relu              | 0.3 ms   | 2.1 ms    | 32
```

### Optimize Data Loading

```python
# ✅ Good: Efficient data loading
train_loader = torch.utils.data.DataLoader(
    dataset,
    batch_size=32,
    num_workers=4,        # Parallel data loading
    pin_memory=True,      # Faster GPU transfer
    prefetch_factor=2,    # Prefetch batches
    persistent_workers=True  # Reuse workers
)

# Profile data loading
import time

start = time.time()
for batch in train_loader:
    pass
print(f"Data loading time: {time.time() - start:.2f}s")

# ❌ Bad: Single worker, no pinning
train_loader = torch.utils.data.DataLoader(
    dataset,
    batch_size=32,
    num_workers=0  # Slow!
)
```

### Profile Specific Operations

```python
# Context manager for specific code blocks
with profiler.record_function("data_preprocessing"):
    data = preprocess(batch)

with profiler.record_function("forward_pass"):
    output = model(data)

with profiler.record_function("loss_computation"):
    loss = criterion(output, target)

# View in TensorBoard > Profile > Trace View
```

## Optimization Strategies

### Mixed Precision Training

```python
import torch
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

for batch in train_loader:
    optimizer.zero_grad()

    # Mixed precision forward pass
    with autocast():
        output = model(batch.cuda())
        loss = criterion(output, target.cuda())

    # Scaled backward pass
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()

# Profile to verify speedup
with profiler.profile(
    activities=[profiler.ProfilerActivity.CUDA],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/mixed_precision')
) as prof:
    train_with_mixed_precision()
    prof.step()
```

### Kernel Fusion

```python
# ✅ Good: Fused operations
# torch.nn.functional.gelu() is fused
output = F.gelu(x)

# ❌ Bad: Separate operations
# Manual GELU (slower due to multiple kernels)
output = 0.5 * x * (1 + torch.tanh(math.sqrt(2 / math.pi) * (x + 0.044715 * x**3)))

# Use torch.jit to fuse custom operations
@torch.jit.script
def fused_gelu(x):
    return 0.5 * x * (1 + torch.tanh(math.sqrt(2 / math.pi) * (x + 0.044715 * x**3)))
```

### Reduce Host-Device Transfers

```python
# ✅ Good: Keep data on GPU
data = data.cuda()  # Transfer once
for epoch in range(100):
    output = model(data)  # No transfer
    loss = criterion(output, target)

# ❌ Bad: Frequent transfers
for epoch in range(100):
    output = model(data.cuda())  # Transfer every epoch!
    loss = criterion(output.cpu(), target.cpu())  # Transfer back!
```

### Batch Size Optimization

```python
# Find optimal batch size with profiling
for batch_size in [16, 32, 64, 128, 256]:
    train_loader = DataLoader(dataset, batch_size=batch_size)

    with profiler.profile(
        activities=[profiler.ProfilerActivity.CUDA],
        profile_memory=True,
        on_trace_ready=torch.profiler.tensorboard_trace_handler(f'./runs/bs{batch_size}')
    ) as prof:
        for step, batch in enumerate(train_loader):
            train_step(batch)
            prof.step()

            if step >= 10:
                break

# Compare in TensorBoard:
# - GPU utilization
# - Memory usage
# - Throughput (samples/sec)
```

## Best Practices

### 1. Profile Representative Workloads

```python
# ✅ Good: Profile realistic training scenario
with profiler.profile(...) as prof:
    for epoch in range(3):  # Profile multiple epochs
        for step, batch in enumerate(train_loader):
            train_step(batch)
            prof.step()

# ❌ Bad: Profile single step
with profiler.profile(...) as prof:
    train_step(single_batch)
```

### 2. Profile Periodically

```python
# Profile every N epochs
if epoch % 10 == 0:
    with profiler.profile(
        activities=[profiler.ProfilerActivity.CUDA],
        on_trace_ready=torch.profiler.tensorboard_trace_handler(f'./runs/epoch{epoch}')
    ) as prof:
        train_epoch()
```

### 3. Compare Before/After Optimizations

```python
# Baseline
with profiler.profile(...) as prof:
    baseline_train()
    prof.step()

# After optimization
with profiler.profile(...) as prof:
    optimized_train()
    prof.step()

# Compare in TensorBoard
```

### 4. Profile Inference

```python
# Production inference profiling
model.eval()

with profiler.profile(
    activities=[profiler.ProfilerActivity.CUDA],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/inference')
) as prof:
    with torch.no_grad():
        for i in range(1000):  # Realistic load
            data = get_production_request()
            output = model(data)
            prof.step()

# Analyze latency percentiles in TensorBoard
```

## Resources

- **PyTorch Profiler**: https://pytorch.org/tutorials/recipes/recipes/profiler_recipe.html
- **TensorFlow Profiler**: https://www.tensorflow.org/guide/profiler
- **NVIDIA Nsight**: https://developer.nvidia.com/nsight-systems
- **PyTorch Bottleneck**: https://pytorch.org/docs/stable/bottleneck.html
