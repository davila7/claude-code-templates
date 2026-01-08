# Framework Integration Guide

Complete guide to integrating TensorBoard with popular ML frameworks.

## Table of Contents
- PyTorch
- TensorFlow/Keras
- PyTorch Lightning
- HuggingFace Transformers
- Fast.ai
- JAX
- scikit-learn

## PyTorch

### Basic Integration

```python
import torch
import torch.nn as nn
from torch.utils.tensorboard import SummaryWriter

# Create writer
writer = SummaryWriter('runs/pytorch_experiment')

# Model and optimizer
model = ResNet50()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

# Log model graph
dummy_input = torch.randn(1, 3, 224, 224)
writer.add_graph(model, dummy_input)

# Training loop
for epoch in range(100):
    model.train()
    train_loss = 0.0

    for batch_idx, (data, target) in enumerate(train_loader):
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()

        # Log batch metrics
        if batch_idx % 100 == 0:
            global_step = epoch * len(train_loader) + batch_idx
            writer.add_scalar('Loss/train_batch', loss.item(), global_step)

    # Epoch metrics
    train_loss /= len(train_loader)
    writer.add_scalar('Loss/train_epoch', train_loss, epoch)

    # Log histograms
    for name, param in model.named_parameters():
        writer.add_histogram(name, param, epoch)

writer.close()
```

### torchvision Integration

```python
from torchvision.utils import make_grid

# Log image batch
for batch_idx, (images, labels) in enumerate(train_loader):
    if batch_idx == 0:  # First batch
        img_grid = make_grid(images[:64], nrow=8)
        writer.add_image('Training_batch', img_grid, epoch)
        break
```

### Distributed Training

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# Setup
dist.init_process_group(backend='nccl')
rank = dist.get_rank()

# Only log from rank 0
if rank == 0:
    writer = SummaryWriter('runs/distributed_experiment')

model = DDP(model, device_ids=[rank])

for epoch in range(100):
    train_loss = train_epoch()

    # Log only from rank 0
    if rank == 0:
        writer.add_scalar('Loss/train', train_loss, epoch)
```

## TensorFlow/Keras

### Keras Callback

```python
import tensorflow as tf

# TensorBoard callback
tensorboard_callback = tf.keras.callbacks.TensorBoard(
    log_dir='logs/keras_experiment',
    histogram_freq=1,          # Log histograms every epoch
    write_graph=True,          # Visualize model graph
    write_images=True,         # Visualize layer weights as images
    update_freq='epoch',       # Log metrics per epoch (or 'batch', or integer)
    profile_batch='10,20',     # Profile batches 10-20
    embeddings_freq=1          # Log embeddings every epoch
)

# Compile model
model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Train with callback
history = model.fit(
    x_train, y_train,
    epochs=10,
    validation_data=(x_val, y_val),
    callbacks=[tensorboard_callback]
)
```

### Custom Training Loop

```python
import tensorflow as tf

# Create summary writers
train_summary_writer = tf.summary.create_file_writer('logs/train')
val_summary_writer = tf.summary.create_file_writer('logs/val')

# Training loop
for epoch in range(100):
    # Training
    for step, (x_batch, y_batch) in enumerate(train_dataset):
        with tf.GradientTape() as tape:
            predictions = model(x_batch, training=True)
            loss = loss_fn(y_batch, predictions)

        gradients = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(gradients, model.trainable_variables))

        # Log training metrics
        with train_summary_writer.as_default():
            tf.summary.scalar('loss', loss, step=epoch * len(train_dataset) + step)

    # Validation
    for x_batch, y_batch in val_dataset:
        predictions = model(x_batch, training=False)
        val_loss = loss_fn(y_batch, predictions)
        val_acc = accuracy_fn(y_batch, predictions)

    # Log validation metrics
    with val_summary_writer.as_default():
        tf.summary.scalar('loss', val_loss, step=epoch)
        tf.summary.scalar('accuracy', val_acc, step=epoch)

    # Log histograms
    with train_summary_writer.as_default():
        for layer in model.layers:
            for weight in layer.weights:
                tf.summary.histogram(weight.name, weight, step=epoch)
```

### tf.data Integration

```python
# Log dataset samples
for images, labels in train_dataset.take(1):
    with file_writer.as_default():
        tf.summary.image('Training samples', images, step=0, max_outputs=25)
```

## PyTorch Lightning

### Built-in Logger

```python
import pytorch_lightning as pl
from pytorch_lightning.loggers import TensorBoardLogger

# Create logger
logger = TensorBoardLogger('logs', name='lightning_experiment')

# Lightning module
class LitModel(pl.LightningModule):
    def __init__(self):
        super().__init__()
        self.model = ResNet50()

    def training_step(self, batch, batch_idx):
        x, y = batch
        y_hat = self.model(x)
        loss = F.cross_entropy(y_hat, y)

        # Log metrics
        self.log('train_loss', loss, on_step=True, on_epoch=True)

        return loss

    def validation_step(self, batch, batch_idx):
        x, y = batch
        y_hat = self.model(x)
        loss = F.cross_entropy(y_hat, y)
        acc = (y_hat.argmax(dim=1) == y).float().mean()

        # Log metrics
        self.log('val_loss', loss, on_epoch=True)
        self.log('val_acc', acc, on_epoch=True)

        return loss

    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters(), lr=0.001)

# Trainer
trainer = pl.Trainer(
    max_epochs=100,
    logger=logger,
    log_every_n_steps=50
)

# Train
model = LitModel()
trainer.fit(model, train_loader, val_loader)
```

### Custom Logging

```python
class LitModel(pl.LightningModule):
    def training_step(self, batch, batch_idx):
        x, y = batch
        y_hat = self.model(x)
        loss = F.cross_entropy(y_hat, y)

        # Log scalar
        self.log('train_loss', loss)

        # Log images (every 100 batches)
        if batch_idx % 100 == 0:
            from torchvision.utils import make_grid
            img_grid = make_grid(x[:8])
            self.logger.experiment.add_image('train_images', img_grid, self.global_step)

        # Log histogram
        self.logger.experiment.add_histogram('predictions', y_hat, self.global_step)

        return loss
```

## HuggingFace Transformers

### TrainingArguments Integration

```python
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    output_dir='./results',
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=64,
    logging_dir='./logs',           # TensorBoard log directory
    logging_steps=100,              # Log every 100 steps
    evaluation_strategy='epoch',
    save_strategy='epoch',
    load_best_model_at_end=True,
    report_to='tensorboard'         # Enable TensorBoard
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    tokenizer=tokenizer
)

# Train (automatically logs to TensorBoard)
trainer.train()
```

### Custom Metrics

```python
from transformers import Trainer, TrainingArguments
import numpy as np

def compute_metrics(eval_pred):
    """Custom metrics for evaluation."""
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=1)

    accuracy = (predictions == labels).mean()
    f1 = f1_score(labels, predictions, average='weighted')

    return {
        'accuracy': accuracy,
        'f1': f1
    }

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    compute_metrics=compute_metrics  # Custom metrics logged to TensorBoard
)
```

### Manual Logging

```python
from transformers import TrainerCallback
from torch.utils.tensorboard import SummaryWriter

class TensorBoardCallback(TrainerCallback):
    """Custom TensorBoard logging."""

    def __init__(self, log_dir='logs'):
        self.writer = SummaryWriter(log_dir)

    def on_log(self, args, state, control, logs=None, **kwargs):
        """Called when logging."""
        if logs:
            for key, value in logs.items():
                self.writer.add_scalar(key, value, state.global_step)

    def on_train_end(self, args, state, control, **kwargs):
        """Close writer."""
        self.writer.close()

# Use callback
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    callbacks=[TensorBoardCallback()]
)
```

## Fast.ai

### Learner Integration

```python
from fastai.vision.all import *
from fastai.callback.tensorboard import TensorBoardCallback

# Create data loaders
dls = ImageDataLoaders.from_folder(path, train='train', valid='valid')

# Create learner
learn = cnn_learner(dls, resnet50, metrics=accuracy)

# Train with TensorBoard logging
learn.fit_one_cycle(
    10,
    cbs=TensorBoardCallback('logs/fastai', trace_model=True)
)

# View logs
# tensorboard --logdir=logs/fastai
```

### Custom Callbacks

```python
from fastai.callback.core import Callback
from torch.utils.tensorboard import SummaryWriter

class CustomTensorBoardCallback(Callback):
    """Custom TensorBoard callback."""

    def __init__(self, log_dir='logs'):
        self.writer = SummaryWriter(log_dir)

    def after_batch(self):
        """Log after each batch."""
        if self.train_iter % 100 == 0:
            self.writer.add_scalar('Loss/train', self.loss, self.train_iter)

    def after_epoch(self):
        """Log after each epoch."""
        self.writer.add_scalar('Loss/train_epoch', self.recorder.train_loss, self.epoch)
        self.writer.add_scalar('Loss/val_epoch', self.recorder.valid_loss, self.epoch)

        # Log metrics
        for i, metric in enumerate(self.recorder.metrics):
            metric_name = self.recorder.metric_names[i+1]
            self.writer.add_scalar(f'Metrics/{metric_name}', metric, self.epoch)

# Use callback
learn.fit_one_cycle(10, cbs=[CustomTensorBoardCallback()])
```

## JAX

### Basic Integration

```python
import jax
import jax.numpy as jnp
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('logs/jax_experiment')

# Training loop
for epoch in range(100):
    for batch in train_batches:
        # JAX training step
        state, loss = train_step(state, batch)

        # Log to TensorBoard (convert JAX array to numpy)
        writer.add_scalar('Loss/train', float(loss), epoch)

    # Validation
    val_loss = evaluate(state, val_batches)
    writer.add_scalar('Loss/val', float(val_loss), epoch)

writer.close()
```

### Flax Integration

```python
from flax.training import train_state
import optax
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('logs/flax_experiment')

# Create train state
state = train_state.TrainState.create(
    apply_fn=model.apply,
    params=params,
    tx=optax.adam(0.001)
)

# Training loop
for epoch in range(100):
    for batch in train_loader:
        state, loss = train_step(state, batch)

        # Log metrics
        writer.add_scalar('Loss/train', loss.item(), epoch)

    # Log parameters
    for name, param in state.params.items():
        writer.add_histogram(f'Params/{name}', jnp.array(param), epoch)

writer.close()
```

## scikit-learn

### Manual Logging

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('logs/sklearn_experiment')

# Hyperparameter search
for n_estimators in [10, 50, 100, 200]:
    for max_depth in [3, 5, 10, None]:
        # Train model
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42
        )

        # Cross-validation
        scores = cross_val_score(model, X_train, y_train, cv=5)

        # Log results
        run_name = f'n{n_estimators}_d{max_depth}'
        writer.add_scalar(f'{run_name}/cv_mean', scores.mean(), 0)
        writer.add_scalar(f'{run_name}/cv_std', scores.std(), 0)

        # Log hyperparameters
        writer.add_hparams(
            {'n_estimators': n_estimators, 'max_depth': max_depth or -1},
            {'cv_accuracy': scores.mean()}
        )

writer.close()
```

### GridSearchCV Logging

```python
from sklearn.model_selection import GridSearchCV
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('logs/gridsearch')

# Grid search
param_grid = {
    'n_estimators': [10, 50, 100],
    'max_depth': [3, 5, 10]
}

grid_search = GridSearchCV(
    RandomForestClassifier(),
    param_grid,
    cv=5,
    return_train_score=True
)

grid_search.fit(X_train, y_train)

# Log all results
for i, params in enumerate(grid_search.cv_results_['params']):
    mean_train_score = grid_search.cv_results_['mean_train_score'][i]
    mean_test_score = grid_search.cv_results_['mean_test_score'][i]

    param_str = '_'.join([f'{k}{v}' for k, v in params.items()])

    writer.add_scalar(f'{param_str}/train', mean_train_score, 0)
    writer.add_scalar(f'{param_str}/test', mean_test_score, 0)

# Log best params
writer.add_text('Best_params', str(grid_search.best_params_), 0)
writer.add_scalar('Best_score', grid_search.best_score_, 0)

writer.close()
```

## Best Practices

### 1. Consistent Naming Conventions

```python
# ✅ Good: Hierarchical names across frameworks
writer.add_scalar('Loss/train', train_loss, step)
writer.add_scalar('Loss/val', val_loss, step)
writer.add_scalar('Metrics/accuracy', accuracy, step)

# Works the same in PyTorch, TensorFlow, Lightning
```

### 2. Use Framework-Specific Features

```python
# PyTorch: Use SummaryWriter
from torch.utils.tensorboard import SummaryWriter

# TensorFlow: Use tf.summary
import tensorflow as tf
tf.summary.scalar('loss', loss, step=step)

# Lightning: Use self.log()
self.log('train_loss', loss)

# Transformers: Use report_to='tensorboard'
training_args = TrainingArguments(report_to='tensorboard')
```

### 3. Centralize Logging Logic

```python
class MetricLogger:
    """Universal metric logger."""

    def __init__(self, log_dir='logs'):
        self.writer = SummaryWriter(log_dir)

    def log_scalar(self, name, value, step):
        self.writer.add_scalar(name, value, step)

    def log_image(self, name, image, step):
        self.writer.add_image(name, image, step)

    def log_histogram(self, name, values, step):
        self.writer.add_histogram(name, values, step)

    def close(self):
        self.writer.close()

# Use across frameworks
logger = MetricLogger('logs/universal')
logger.log_scalar('Loss/train', train_loss, epoch)
```

### 4. Framework Detection

```python
def get_tensorboard_writer(framework='auto', log_dir='logs'):
    """Get TensorBoard writer for any framework."""
    if framework == 'auto':
        # Auto-detect framework
        try:
            import torch
            framework = 'pytorch'
        except ImportError:
            try:
                import tensorflow as tf
                framework = 'tensorflow'
            except ImportError:
                raise ValueError("No supported framework found")

    if framework == 'pytorch':
        from torch.utils.tensorboard import SummaryWriter
        return SummaryWriter(log_dir)

    elif framework == 'tensorflow':
        import tensorflow as tf
        return tf.summary.create_file_writer(log_dir)

# Use it
writer = get_tensorboard_writer(log_dir='logs/auto')
```

## Resources

- **PyTorch**: https://pytorch.org/docs/stable/tensorboard.html
- **TensorFlow**: https://www.tensorflow.org/tensorboard
- **Lightning**: https://pytorch-lightning.readthedocs.io/en/stable/extensions/logging.html
- **Transformers**: https://huggingface.co/docs/transformers/main_classes/trainer
- **Fast.ai**: https://docs.fast.ai/callback.tensorboard.html
