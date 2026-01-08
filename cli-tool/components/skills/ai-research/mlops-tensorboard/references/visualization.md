# Comprehensive Visualization Guide

Complete guide to visualizing ML experiments with TensorBoard.

## Table of Contents
- Scalars
- Images
- Histograms & Distributions
- Graphs
- Embeddings
- Text
- PR Curves
- Custom Visualizations

## Scalars

### Basic Scalar Logging

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('runs/scalars_demo')

# Log single metric
for step in range(100):
    loss = compute_loss()
    writer.add_scalar('Loss', loss, step)

writer.close()
```

### Multiple Scalars

```python
# Group related metrics
writer.add_scalars('Loss', {
    'train': train_loss,
    'validation': val_loss,
    'test': test_loss
}, epoch)

writer.add_scalars('Metrics/Classification', {
    'accuracy': accuracy,
    'precision': precision,
    'recall': recall,
    'f1_score': f1
}, epoch)
```

### Time-Series Metrics

```python
# Track metrics over training
for epoch in range(100):
    # Training metrics
    train_loss = 0.0
    for batch in train_loader:
        loss = train_batch(batch)
        train_loss += loss

    train_loss /= len(train_loader)

    # Validation metrics
    val_loss, val_acc = validate()

    # Log
    writer.add_scalar('Loss/train', train_loss, epoch)
    writer.add_scalar('Loss/val', val_loss, epoch)
    writer.add_scalar('Accuracy/val', val_acc, epoch)

    # Log learning rate
    current_lr = optimizer.param_groups[0]['lr']
    writer.add_scalar('Learning_rate', current_lr, epoch)
```

### Custom Smoothing

TensorBoard UI allows smoothing scalars:
- Slider from 0 (no smoothing) to 1 (maximum smoothing)
- Exponential moving average
- Useful for noisy metrics

## Images

### Single Image

```python
import torch
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('runs/images_demo')

# Log single image (C, H, W)
img = torch.rand(3, 224, 224)
writer.add_image('Sample_image', img, 0)
```

### Image Grid

```python
from torchvision.utils import make_grid

# Create grid from batch
images = torch.rand(64, 3, 224, 224)  # Batch of 64 images
img_grid = make_grid(images, nrow=8)  # 8 images per row

writer.add_image('Image_grid', img_grid, epoch)
```

### Training Visualizations

```python
# Visualize inputs, predictions, and ground truth
for epoch in range(10):
    # Get batch
    images, labels = next(iter(val_loader))

    # Predict
    with torch.no_grad():
        predictions = model(images)

    # Visualize inputs
    input_grid = make_grid(images[:16], nrow=4)
    writer.add_image('Inputs', input_grid, epoch)

    # Visualize predictions (if images)
    if isinstance(predictions, torch.Tensor) and predictions.dim() == 4:
        pred_grid = make_grid(predictions[:16], nrow=4)
        writer.add_image('Predictions', pred_grid, epoch)
```

### Attention Maps

```python
# Visualize attention weights
attention_maps = model.get_attention(images)  # (B, H, W)

# Normalize to [0, 1]
attention_maps = (attention_maps - attention_maps.min()) / (attention_maps.max() - attention_maps.min())

# Add channel dimension
attention_maps = attention_maps.unsqueeze(1)  # (B, 1, H, W)

# Create grid
attention_grid = make_grid(attention_maps[:16], nrow=4)
writer.add_image('Attention_maps', attention_grid, epoch)
```

### TensorFlow Images

```python
import tensorflow as tf

file_writer = tf.summary.create_file_writer('logs/images')

with file_writer.as_default():
    # Log image batch
    tf.summary.image('Training_samples', images, step=epoch, max_outputs=25)

    # Log single image
    tf.summary.image('Sample', img[tf.newaxis, ...], step=epoch)
```

## Histograms & Distributions

### Weight Histograms

```python
# PyTorch: Track weight distributions over time
for epoch in range(100):
    train_epoch()

    # Log all model parameters
    for name, param in model.named_parameters():
        writer.add_histogram(f'Weights/{name}', param, epoch)

    # Log gradients
    for name, param in model.named_parameters():
        if param.grad is not None:
            writer.add_histogram(f'Gradients/{name}', param.grad, epoch)
```

### Activation Histograms

```python
# Hook to capture activations
activations = {}

def get_activation(name):
    def hook(model, input, output):
        activations[name] = output.detach()
    return hook

# Register hooks
model.conv1.register_forward_hook(get_activation('conv1'))
model.conv2.register_forward_hook(get_activation('conv2'))
model.fc.register_forward_hook(get_activation('fc'))

# Forward pass
output = model(input)

# Log activations
for name, activation in activations.items():
    writer.add_histogram(f'Activations/{name}', activation, epoch)
```

### Custom Distributions

```python
# Log prediction distributions
predictions = model(test_data)
writer.add_histogram('Predictions', predictions, epoch)

# Log loss distributions across batches
losses = []
for batch in val_loader:
    loss = compute_loss(batch)
    losses.append(loss)

losses = torch.tensor(losses)
writer.add_histogram('Loss_distribution', losses, epoch)
```

### TensorFlow Histograms

```python
import tensorflow as tf

file_writer = tf.summary.create_file_writer('logs/histograms')

with file_writer.as_default():
    # Log weight distributions
    for layer in model.layers:
        for weight in layer.weights:
            tf.summary.histogram(weight.name, weight, step=epoch)
```

## Graphs

### Model Architecture

```python
import torch
from torch.utils.tensorboard import SummaryWriter

# PyTorch model
model = ResNet50(num_classes=1000)

# Create dummy input (same shape as real input)
dummy_input = torch.randn(1, 3, 224, 224)

# Log graph
writer = SummaryWriter('runs/graph_demo')
writer.add_graph(model, dummy_input)
writer.close()

# View in TensorBoard "Graphs" tab
```

### TensorFlow Graph

```python
# TensorFlow automatically logs graph with Keras
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs',
    write_graph=True  # Enable graph logging
)

model.fit(x, y, callbacks=[tensorboard_callback])
```

## Embeddings

### Projecting Embeddings

```python
import torch
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('runs/embeddings_demo')

# Get embeddings (e.g., word embeddings, image features)
# Shape: (num_samples, embedding_dim)
embeddings = model.get_embeddings(data)

# Metadata (labels for each embedding)
metadata = ['cat', 'dog', 'bird', 'cat', 'dog', ...]

# Optional: Images for each embedding
label_img = torch.stack([img1, img2, img3, ...])  # (num_samples, C, H, W)

# Log embeddings
writer.add_embedding(
    embeddings,
    metadata=metadata,
    label_img=label_img,
    global_step=epoch,
    tag='Word_embeddings'
)

writer.close()
```

**In TensorBoard Projector:**
- Choose PCA, t-SNE, or UMAP
- Color by metadata labels
- Search and filter points
- Explore nearest neighbors

### Image Embeddings

```python
# Extract features from CNN
features = []
labels = []
images = []

model.eval()
with torch.no_grad():
    for data, target in test_loader:
        # Get features from penultimate layer
        feature = model.get_features(data)  # (B, feature_dim)
        features.append(feature)
        labels.extend(target.cpu().numpy())
        images.append(data)

# Concatenate
features = torch.cat(features)
images = torch.cat(images)

# Metadata (class names)
class_names = ['airplane', 'car', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck']
metadata = [class_names[label] for label in labels]

# Log to TensorBoard
writer.add_embedding(
    features,
    metadata=metadata,
    label_img=images,
    tag='CIFAR10_features'
)
```

### Text Embeddings

```python
# Word2Vec or BERT embeddings
word_embeddings = model.word_embeddings.weight.data  # (vocab_size, embedding_dim)
vocabulary = ['the', 'cat', 'dog', 'run', 'jump', ...]

writer.add_embedding(
    word_embeddings,
    metadata=vocabulary,
    tag='Word2Vec_embeddings'
)
```

## Text

### Basic Text Logging

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('runs/text_demo')

# Log plain text
writer.add_text('Config', str(config), 0)
writer.add_text('Hyperparameters', f'lr={lr}, batch_size={batch_size}', 0)

# Log predictions
predictions_text = f"Epoch {epoch}:\n"
for i, pred in enumerate(predictions[:5]):
    predictions_text += f"Sample {i}: {pred}\n"

writer.add_text('Predictions', predictions_text, epoch)
```

### Markdown Tables

```python
# Log results as markdown table
results = f"""
| Metric | Train | Validation | Test |
|--------|-------|------------|------|
| Accuracy | {train_acc:.4f} | {val_acc:.4f} | {test_acc:.4f} |
| Loss | {train_loss:.4f} | {val_loss:.4f} | {test_loss:.4f} |
| F1 Score | {train_f1:.4f} | {val_f1:.4f} | {test_f1:.4f} |
"""

writer.add_text('Results/Summary', results, epoch)
```

### Model Summaries

```python
# Log model architecture as text
from torchinfo import summary

model_summary = str(summary(model, input_size=(1, 3, 224, 224), verbose=0))
writer.add_text('Model/Architecture', f'```\n{model_summary}\n```', 0)
```

## PR Curves

### Precision-Recall Curves

```python
from torch.utils.tensorboard import SummaryWriter
from sklearn.metrics import precision_recall_curve

writer = SummaryWriter('runs/pr_curves')

# Get predictions and ground truth
y_true = []
y_scores = []

model.eval()
with torch.no_grad():
    for data, target in test_loader:
        output = model(data)
        probs = torch.softmax(output, dim=1)

        y_true.extend(target.cpu().numpy())
        y_scores.extend(probs.cpu().numpy())

y_true = np.array(y_true)
y_scores = np.array(y_scores)

# Log PR curve for each class
num_classes = y_scores.shape[1]
for class_idx in range(num_classes):
    # Binary classification: class vs rest
    labels = (y_true == class_idx).astype(int)
    scores = y_scores[:, class_idx]

    # Add PR curve
    writer.add_pr_curve(
        f'PR_curve/class_{class_idx}',
        labels,
        scores,
        global_step=epoch
    )

writer.close()
```

### ROC Curves

```python
# TensorBoard doesn't have built-in ROC, but we can log as image
from sklearn.metrics import roc_curve, auc
import matplotlib.pyplot as plt

fig, ax = plt.subplots()

for class_idx in range(num_classes):
    labels = (y_true == class_idx).astype(int)
    scores = y_scores[:, class_idx]

    fpr, tpr, _ = roc_curve(labels, scores)
    roc_auc = auc(fpr, tpr)

    ax.plot(fpr, tpr, label=f'Class {class_idx} (AUC = {roc_auc:.2f})')

ax.plot([0, 1], [0, 1], 'k--')
ax.set_xlabel('False Positive Rate')
ax.set_ylabel('True Positive Rate')
ax.set_title('ROC Curves')
ax.legend()

# Convert to tensor and log
fig.canvas.draw()
img = np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8)
img = img.reshape(fig.canvas.get_width_height()[::-1] + (3,))
img = torch.from_numpy(img).permute(2, 0, 1)

writer.add_image('ROC_curves', img, epoch)
plt.close(fig)
```

## Custom Visualizations

### Confusion Matrix

```python
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix

# Compute confusion matrix
cm = confusion_matrix(y_true, y_pred)

# Plot
fig, ax = plt.subplots(figsize=(10, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax)
ax.set_xlabel('Predicted')
ax.set_ylabel('True')
ax.set_title('Confusion Matrix')

# Convert to tensor and log
fig.canvas.draw()
img = np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8)
img = img.reshape(fig.canvas.get_width_height()[::-1] + (3,))
img = torch.from_numpy(img).permute(2, 0, 1)

writer.add_image('Confusion_matrix', img, epoch)
plt.close(fig)
```

### Loss Landscape

```python
# Visualize loss surface around current parameters
import numpy as np

def compute_loss_landscape(model, data, target, param1, param2):
    """Compute loss for a grid of parameter values."""
    # Save original params
    original_params = {name: param.clone() for name, param in model.named_parameters()}

    # Grid
    param1_range = np.linspace(-1, 1, 50)
    param2_range = np.linspace(-1, 1, 50)
    losses = np.zeros((50, 50))

    for i, p1 in enumerate(param1_range):
        for j, p2 in enumerate(param2_range):
            # Perturb parameters
            model.state_dict()[param1].add_(p1)
            model.state_dict()[param2].add_(p2)

            # Compute loss
            with torch.no_grad():
                output = model(data)
                loss = F.cross_entropy(output, target)
                losses[i, j] = loss.item()

            # Restore parameters
            model.load_state_dict(original_params)

    return losses

# Plot
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')
X, Y = np.meshgrid(np.linspace(-1, 1, 50), np.linspace(-1, 1, 50))
ax.plot_surface(X, Y, losses, cmap='viridis')
ax.set_title('Loss Landscape')

# Log
fig.canvas.draw()
img = np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8)
img = img.reshape(fig.canvas.get_width_height()[::-1] + (3,))
img = torch.from_numpy(img).permute(2, 0, 1)
writer.add_image('Loss_landscape', img, epoch)
plt.close(fig)
```

## Best Practices

### 1. Use Hierarchical Tags

```python
# ✅ Good: Organized with hierarchy
writer.add_scalar('Loss/train', train_loss, step)
writer.add_scalar('Loss/val', val_loss, step)
writer.add_scalar('Metrics/accuracy', accuracy, step)
writer.add_scalar('Metrics/f1_score', f1, step)

# ❌ Bad: Flat namespace
writer.add_scalar('train_loss', train_loss, step)
writer.add_scalar('val_loss', val_loss, step)
```

### 2. Log Regularly but Not Excessively

```python
# ✅ Good: Epoch-level + periodic batch-level
for epoch in range(100):
    for batch_idx, batch in enumerate(train_loader):
        loss = train_step(batch)

        # Log every 100 batches
        if batch_idx % 100 == 0:
            global_step = epoch * len(train_loader) + batch_idx
            writer.add_scalar('Loss/train_batch', loss, global_step)

    # Always log epoch metrics
    writer.add_scalar('Loss/train_epoch', epoch_loss, epoch)

# ❌ Bad: Every batch (creates huge logs)
for batch in train_loader:
    writer.add_scalar('Loss', loss, step)
```

### 3. Visualize Sample Predictions

```python
# Log predictions periodically
if epoch % 5 == 0:
    model.eval()
    with torch.no_grad():
        sample_images, sample_labels = next(iter(val_loader))
        predictions = model(sample_images)

        # Visualize
        img_grid = make_grid(sample_images[:16], nrow=4)
        writer.add_image('Samples/inputs', img_grid, epoch)

        # Add predictions as text
        pred_text = '\n'.join([f'{i}: {pred.argmax()}' for i, pred in enumerate(predictions[:16])])
        writer.add_text('Samples/predictions', pred_text, epoch)
```

## Resources

- **TensorBoard Documentation**: https://www.tensorflow.org/tensorboard
- **PyTorch TensorBoard**: https://pytorch.org/docs/stable/tensorboard.html
- **Projector Guide**: https://www.tensorflow.org/tensorboard/tensorboard_projector_plugin
