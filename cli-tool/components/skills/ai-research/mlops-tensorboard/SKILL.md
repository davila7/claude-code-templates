---
name: tensorboard
description: Visualize training metrics, debug models with histograms, compare experiments, visualize model graphs, and profile performance with TensorBoard - Google's ML visualization toolkit
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [MLOps, TensorBoard, Visualization, Training Metrics, Model Debugging, PyTorch, TensorFlow, Experiment Tracking, Performance Profiling]
dependencies: [tensorboard, torch, tensorflow]
---

# TensorBoard: Visualization Toolkit for ML

## When to Use This Skill

Use TensorBoard when you need to:
- **Visualize training metrics** like loss and accuracy over time
- **Debug models** with histograms and distributions
- **Compare experiments** across multiple runs
- **Visualize model graphs** and architecture
- **Project embeddings** to lower dimensions (t-SNE, PCA)
- **Track hyperparameter** experiments
- **Profile performance** and identify bottlenecks
- **Visualize images and text** during training

**Users**: 20M+ downloads/year | **GitHub Stars**: 27k+ | **License**: Apache 2.0

## Installation

```bash
# Install TensorBoard
pip install tensorboard

# PyTorch integration
pip install torch torchvision tensorboard

# TensorFlow integration (TensorBoard included)
pip install tensorflow

# Launch TensorBoard
tensorboard --logdir=runs
# Access at http://localhost:6006
```

## Quick Start

### PyTorch

```python
from torch.utils.tensorboard import SummaryWriter

# Create writer
writer = SummaryWriter('runs/experiment_1')

# Training loop
for epoch in range(10):
    train_loss = train_epoch()
    val_acc = validate()

    # Log metrics
    writer.add_scalar('Loss/train', train_loss, epoch)
    writer.add_scalar('Accuracy/val', val_acc, epoch)

# Close writer
writer.close()

# Launch: tensorboard --logdir=runs
```

### TensorFlow/Keras

```python
import tensorflow as tf

# Create callback
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs/fit',
    histogram_freq=1
)

# Train model
model.fit(
    x_train, y_train,
    epochs=10,
    validation_data=(x_val, y_val),
    callbacks=[tensorboard_callback]
)

# Launch: tensorboard --logdir=logs
```

## Core Concepts

### 1. SummaryWriter (PyTorch)

```python
from torch.utils.tensorboard import SummaryWriter

# Default directory: runs/CURRENT_DATETIME
writer = SummaryWriter()

# Custom directory
writer = SummaryWriter('runs/experiment_1')

# Custom comment (appended to default directory)
writer = SummaryWriter(comment='baseline')

# Log data
writer.add_scalar('Loss/train', 0.5, step=0)
writer.add_scalar('Loss/train', 0.3, step=1)

# Flush and close
writer.flush()
writer.close()
```

### 2. Logging Scalars

```python
# PyTorch
from torch.utils.tensorboard import SummaryWriter
writer = SummaryWriter()

for epoch in range(100):
    train_loss = train()
    val_loss = validate()

    # Log individual metrics
    writer.add_scalar('Loss/train', train_loss, epoch)
    writer.add_scalar('Loss/val', val_loss, epoch)
    writer.add_scalar('Accuracy/train', train_acc, epoch)
    writer.add_scalar('Accuracy/val', val_acc, epoch)

    # Learning rate
    lr = optimizer.param_groups[0]['lr']
    writer.add_scalar('Learning_rate', lr, epoch)

writer.close()
```

```python
# TensorFlow
import tensorflow as tf

train_summary_writer = tf.summary.create_file_writer('logs/train')
val_summary_writer = tf.summary.create_file_writer('logs/val')

for epoch in range(100):
    with train_summary_writer.as_default():
        tf.summary.scalar('loss', train_loss, step=epoch)
        tf.summary.scalar('accuracy', train_acc, step=epoch)

    with val_summary_writer.as_default():
        tf.summary.scalar('loss', val_loss, step=epoch)
        tf.summary.scalar('accuracy', val_acc, step=epoch)
```

### 3. Logging Multiple Scalars

```python
# PyTorch: Group related metrics
writer.add_scalars('Loss', {
    'train': train_loss,
    'validation': val_loss,
    'test': test_loss
}, epoch)

writer.add_scalars('Metrics', {
    'accuracy': accuracy,
    'precision': precision,
    'recall': recall,
    'f1': f1_score
}, epoch)
```

### 4. Logging Images

```python
# PyTorch
import torch
from torchvision.utils import make_grid

# Single image
writer.add_image('Input/sample', img_tensor, epoch)

# Multiple images as grid
img_grid = make_grid(images[:64], nrow=8)
writer.add_image('Batch/inputs', img_grid, epoch)

# Predictions visualization
pred_grid = make_grid(predictions[:16], nrow=4)
writer.add_image('Predictions', pred_grid, epoch)
```

```python
# TensorFlow
import tensorflow as tf

with file_writer.as_default():
    # Encode images as PNG
    tf.summary.image('Training samples', images, step=epoch, max_outputs=25)
```

### 5. Logging Histograms

```python
# PyTorch: Track weight distributions
for name, param in model.named_parameters():
    writer.add_histogram(name, param, epoch)

    # Track gradients
    if param.grad is not None:
        writer.add_histogram(f'{name}.grad', param.grad, epoch)

# Track activations
writer.add_histogram('Activations/relu1', activations, epoch)
```

```python
# TensorFlow
with file_writer.as_default():
    tf.summary.histogram('weights/layer1', layer1.kernel, step=epoch)
    tf.summary.histogram('activations/relu1', activations, step=epoch)
```

### 6. Logging Model Graph

```python
# PyTorch
import torch

model = MyModel()
dummy_input = torch.randn(1, 3, 224, 224)

writer.add_graph(model, dummy_input)
writer.close()
```

```python
# TensorFlow (automatic with Keras)
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs',
    write_graph=True
)

model.fit(x, y, callbacks=[tensorboard_callback])
```

## Advanced Features

### Embedding Projector

Visualize high-dimensional data (embeddings, features) in 2D/3D.

```python
import torch
from torch.utils.tensorboard import SummaryWriter

# Get embeddings (e.g., word embeddings, image features)
embeddings = model.get_embeddings(data)  # Shape: (N, embedding_dim)

# Metadata (labels for each point)
metadata = ['class_1', 'class_2', 'class_1', ...]

# Images (optional, for image embeddings)
label_images = torch.stack([img1, img2, img3, ...])

# Log to TensorBoard
writer.add_embedding(
    embeddings,
    metadata=metadata,
    label_img=label_images,
    global_step=epoch
)
```

**In TensorBoard:**
- Navigate to "Projector" tab
- Choose PCA, t-SNE, or UMAP visualization
- Search, filter, and explore clusters

### Hyperparameter Tuning

```python
from torch.utils.tensorboard import SummaryWriter

# Try different hyperparameters
for lr in [0.001, 0.01, 0.1]:
    for batch_size in [16, 32, 64]:
        # Create unique run directory
        writer = SummaryWriter(f'runs/lr{lr}_bs{batch_size}')

        # Log hyperparameters
        writer.add_hparams(
            {'lr': lr, 'batch_size': batch_size},
            {'hparam/accuracy': final_acc, 'hparam/loss': final_loss}
        )

        # Train and log
        for epoch in range(10):
            loss = train(lr, batch_size)
            writer.add_scalar('Loss/train', loss, epoch)

        writer.close()

# Compare in TensorBoard's "HParams" tab
```

### Text Logging

```python
# PyTorch: Log text (e.g., model predictions, summaries)
writer.add_text('Predictions', f'Epoch {epoch}: {predictions}', epoch)
writer.add_text('Config', str(config), 0)

# Log markdown tables
markdown_table = """
| Metric | Value |
|--------|-------|
| Accuracy | 0.95 |
| F1 Score | 0.93 |
"""
writer.add_text('Results', markdown_table, epoch)
```

### PR Curves

Precision-Recall curves for classification.

```python
from torch.utils.tensorboard import SummaryWriter

# Get predictions and labels
predictions = model(test_data)  # Shape: (N, num_classes)
labels = test_labels  # Shape: (N,)

# Log PR curve for each class
for i in range(num_classes):
    writer.add_pr_curve(
        f'PR_curve/class_{i}',
        labels == i,
        predictions[:, i],
        global_step=epoch
    )
```

## Integration Examples

### PyTorch Training Loop

```python
import torch
import torch.nn as nn
from torch.utils.tensorboard import SummaryWriter

# Setup
writer = SummaryWriter('runs/resnet_experiment')
model = ResNet50()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

# Log model graph
dummy_input = torch.randn(1, 3, 224, 224)
writer.add_graph(model, dummy_input)

# Training loop
for epoch in range(50):
    model.train()
    train_loss = 0.0
    train_correct = 0

    for batch_idx, (data, target) in enumerate(train_loader):
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        pred = output.argmax(dim=1)
        train_correct += pred.eq(target).sum().item()

        # Log batch metrics (every 100 batches)
        if batch_idx % 100 == 0:
            global_step = epoch * len(train_loader) + batch_idx
            writer.add_scalar('Loss/train_batch', loss.item(), global_step)

    # Epoch metrics
    train_loss /= len(train_loader)
    train_acc = train_correct / len(train_loader.dataset)

    # Validation
    model.eval()
    val_loss = 0.0
    val_correct = 0

    with torch.no_grad():
        for data, target in val_loader:
            output = model(data)
            val_loss += criterion(output, target).item()
            pred = output.argmax(dim=1)
            val_correct += pred.eq(target).sum().item()

    val_loss /= len(val_loader)
    val_acc = val_correct / len(val_loader.dataset)

    # Log epoch metrics
    writer.add_scalars('Loss', {'train': train_loss, 'val': val_loss}, epoch)
    writer.add_scalars('Accuracy', {'train': train_acc, 'val': val_acc}, epoch)

    # Log learning rate
    writer.add_scalar('Learning_rate', optimizer.param_groups[0]['lr'], epoch)

    # Log histograms (every 5 epochs)
    if epoch % 5 == 0:
        for name, param in model.named_parameters():
            writer.add_histogram(name, param, epoch)

    # Log sample predictions
    if epoch % 10 == 0:
        sample_images = data[:8]
        writer.add_image('Sample_inputs', make_grid(sample_images), epoch)

writer.close()
```

### TensorFlow/Keras Training

```python
import tensorflow as tf

# Define model
model = tf.keras.models.Sequential([
    tf.keras.layers.Conv2D(32, 3, activation='relu', input_shape=(28, 28, 1)),
    tf.keras.layers.MaxPooling2D(),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dense(10, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# TensorBoard callback
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs/fit',
    histogram_freq=1,          # Log histograms every epoch
    write_graph=True,          # Visualize model graph
    write_images=True,         # Visualize weights as images
    update_freq='epoch',       # Log metrics every epoch
    profile_batch='500,520',   # Profile batches 500-520
    embeddings_freq=1          # Log embeddings every epoch
)

# Train
model.fit(
    x_train, y_train,
    epochs=10,
    validation_data=(x_val, y_val),
    callbacks=[tensorboard_callback]
)
```

## Comparing Experiments

### Multiple Runs

```bash
# Run experiments with different configs
python train.py --lr 0.001 --logdir runs/exp1
python train.py --lr 0.01 --logdir runs/exp2
python train.py --lr 0.1 --logdir runs/exp3

# View all runs together
tensorboard --logdir=runs
```

**In TensorBoard:**
- All runs appear in the same dashboard
- Toggle runs on/off for comparison
- Use regex to filter run names
- Overlay charts to compare metrics

### Organizing Experiments

```python
# Hierarchical organization
runs/
├── baseline/
│   ├── run_1/
│   └── run_2/
├── improved/
│   ├── run_1/
│   └── run_2/
└── final/
    └── run_1/

# Log with hierarchy
writer = SummaryWriter('runs/baseline/run_1')
```

## Best Practices

### 1. Use Descriptive Run Names

```python
# ✅ Good: Descriptive names
from datetime import datetime
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
writer = SummaryWriter(f'runs/resnet50_lr0.001_bs32_{timestamp}')

# ❌ Bad: Auto-generated names
writer = SummaryWriter()  # Creates runs/Jan01_12-34-56_hostname
```

### 2. Group Related Metrics

```python
# ✅ Good: Grouped metrics
writer.add_scalar('Loss/train', train_loss, step)
writer.add_scalar('Loss/val', val_loss, step)
writer.add_scalar('Accuracy/train', train_acc, step)
writer.add_scalar('Accuracy/val', val_acc, step)

# ❌ Bad: Flat namespace
writer.add_scalar('train_loss', train_loss, step)
writer.add_scalar('val_loss', val_loss, step)
```

### 3. Log Regularly but Not Too Often

```python
# ✅ Good: Log epoch metrics always, batch metrics occasionally
for epoch in range(100):
    for batch_idx, (data, target) in enumerate(train_loader):
        loss = train_step(data, target)

        # Log every 100 batches
        if batch_idx % 100 == 0:
            writer.add_scalar('Loss/batch', loss, global_step)

    # Always log epoch metrics
    writer.add_scalar('Loss/epoch', epoch_loss, epoch)

# ❌ Bad: Log every batch (creates huge log files)
for batch in train_loader:
    writer.add_scalar('Loss', loss, step)  # Too frequent
```

### 4. Close Writer When Done

```python
# ✅ Good: Use context manager
with SummaryWriter('runs/exp1') as writer:
    for epoch in range(10):
        writer.add_scalar('Loss', loss, epoch)
# Automatically closes

# Or manually
writer = SummaryWriter('runs/exp1')
# ... logging ...
writer.close()
```

### 5. Use Separate Writers for Train/Val

```python
# ✅ Good: Separate log directories
train_writer = SummaryWriter('runs/exp1/train')
val_writer = SummaryWriter('runs/exp1/val')

train_writer.add_scalar('loss', train_loss, epoch)
val_writer.add_scalar('loss', val_loss, epoch)
```

## Performance Profiling

### TensorFlow Profiler

```python
# Enable profiling
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs',
    profile_batch='10,20'  # Profile batches 10-20
)

model.fit(x, y, callbacks=[tensorboard_callback])

# View in TensorBoard Profile tab
# Shows: GPU utilization, kernel stats, memory usage, bottlenecks
```

### PyTorch Profiler

```python
import torch.profiler as profiler

with profiler.profile(
    activities=[
        profiler.ProfilerActivity.CPU,
        profiler.ProfilerActivity.CUDA
    ],
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./runs/profiler'),
    record_shapes=True,
    with_stack=True
) as prof:
    for batch in train_loader:
        loss = train_step(batch)
        prof.step()

# View in TensorBoard Profile tab
```

## Resources

- **Documentation**: https://www.tensorflow.org/tensorboard
- **PyTorch Integration**: https://pytorch.org/docs/stable/tensorboard.html
- **GitHub**: https://github.com/tensorflow/tensorboard (27k+ stars)
- **TensorBoard.dev**: https://tensorboard.dev (share experiments publicly)

## See Also

- `references/visualization.md` - Comprehensive visualization guide
- `references/profiling.md` - Performance profiling patterns
- `references/integrations.md` - Framework-specific integration examples


