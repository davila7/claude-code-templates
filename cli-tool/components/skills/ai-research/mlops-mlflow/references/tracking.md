# Comprehensive Tracking Guide

Complete guide to experiment tracking with MLflow.

## Table of Contents
- Logging Parameters
- Logging Metrics
- Logging Artifacts
- Logging Models
- Autologging
- Runs and Experiments
- Searching and Comparing

## Logging Parameters

### Basic Parameter Logging

```python
import mlflow

with mlflow.start_run():
    # Single parameter
    mlflow.log_param("learning_rate", 0.001)
    mlflow.log_param("batch_size", 32)
    mlflow.log_param("optimizer", "Adam")

    # Multiple parameters at once
    mlflow.log_params({
        "epochs": 50,
        "dropout": 0.2,
        "weight_decay": 1e-4,
        "momentum": 0.9
    })
```

### Structured Parameters

```python
# Nested configuration
config = {
    "model": {
        "architecture": "ResNet50",
        "pretrained": True,
        "num_classes": 10
    },
    "training": {
        "lr": 0.001,
        "batch_size": 32,
        "epochs": 50
    },
    "data": {
        "dataset": "ImageNet",
        "augmentation": True
    }
}

with mlflow.start_run():
    # Log as flattened params
    for section, params in config.items():
        for key, value in params.items():
            mlflow.log_param(f"{section}.{key}", value)

    # Or log entire config as artifact
    mlflow.log_dict(config, "config.json")
```

### Parameter Best Practices

```python
with mlflow.start_run():
    # ✅ Good: Log all hyperparameters
    mlflow.log_params({
        "learning_rate": 0.001,
        "batch_size": 32,
        "optimizer": "Adam",
        "scheduler": "CosineAnnealing",
        "weight_decay": 1e-4
    })

    # ✅ Good: Log data info
    mlflow.log_params({
        "dataset": "ImageNet",
        "train_samples": len(train_dataset),
        "val_samples": len(val_dataset),
        "num_classes": 1000
    })

    # ✅ Good: Log environment info
    mlflow.log_params({
        "framework": "PyTorch 2.0",
        "cuda_version": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(0)
    })
```

## Logging Metrics

### Time-Series Metrics

```python
with mlflow.start_run():
    for epoch in range(num_epochs):
        # Train
        train_loss, train_acc = train_epoch()

        # Validate
        val_loss, val_acc = validate()

        # Log metrics with step
        mlflow.log_metric("train_loss", train_loss, step=epoch)
        mlflow.log_metric("train_accuracy", train_acc, step=epoch)
        mlflow.log_metric("val_loss", val_loss, step=epoch)
        mlflow.log_metric("val_accuracy", val_acc, step=epoch)

        # Log learning rate
        current_lr = optimizer.param_groups[0]['lr']
        mlflow.log_metric("learning_rate", current_lr, step=epoch)
```

### Batch-Level Metrics

```python
with mlflow.start_run():
    global_step = 0

    for epoch in range(num_epochs):
        for batch_idx, (data, target) in enumerate(train_loader):
            loss = train_batch(data, target)

            # Log every 100 batches
            if global_step % 100 == 0:
                mlflow.log_metric("batch_loss", loss, step=global_step)

            global_step += 1

        # Log epoch metrics
        val_loss = validate()
        mlflow.log_metric("epoch_val_loss", val_loss, step=epoch)
```

### Multiple Metrics at Once

```python
with mlflow.start_run():
    metrics = {
        "train_loss": 0.15,
        "val_loss": 0.18,
        "train_accuracy": 0.95,
        "val_accuracy": 0.92,
        "f1_score": 0.93,
        "precision": 0.94,
        "recall": 0.92
    }

    mlflow.log_metrics(metrics, step=epoch)
```

### Custom Metrics

```python
def compute_custom_metrics(y_true, y_pred):
    """Compute custom evaluation metrics."""
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "f1_macro": f1_score(y_true, y_pred, average='macro'),
        "f1_weighted": f1_score(y_true, y_pred, average='weighted'),
        "precision": precision_score(y_true, y_pred, average='weighted'),
        "recall": recall_score(y_true, y_pred, average='weighted')
    }

with mlflow.start_run():
    predictions = model.predict(X_test)
    metrics = compute_custom_metrics(y_test, predictions)

    # Log all metrics
    mlflow.log_metrics(metrics)
```

## Logging Artifacts

### Files and Directories

```python
with mlflow.start_run():
    # Log single file
    plt.savefig('loss_curve.png')
    mlflow.log_artifact('loss_curve.png')

    # Log directory
    os.makedirs('plots', exist_ok=True)
    plt.savefig('plots/train_loss.png')
    plt.savefig('plots/val_loss.png')
    mlflow.log_artifacts('plots')  # Logs entire directory

    # Log to specific artifact path
    mlflow.log_artifact('model.pkl', artifact_path='models')
    # Stored at: artifacts/models/model.pkl
```

### JSON and YAML

```python
import json
import yaml

with mlflow.start_run():
    # Log dict as JSON
    config = {"lr": 0.001, "batch_size": 32}
    mlflow.log_dict(config, "config.json")

    # Log as YAML
    with open('config.yaml', 'w') as f:
        yaml.dump(config, f)
    mlflow.log_artifact('config.yaml')
```

### Text Files

```python
with mlflow.start_run():
    # Log training summary
    summary = f"""
    Training Summary:
    - Epochs: {num_epochs}
    - Final train loss: {final_train_loss:.4f}
    - Final val loss: {final_val_loss:.4f}
    - Best accuracy: {best_acc:.4f}
    - Training time: {training_time:.2f}s
    """

    with open('summary.txt', 'w') as f:
        f.write(summary)

    mlflow.log_artifact('summary.txt')
```

### Model Checkpoints

```python
import torch

with mlflow.start_run():
    # Save checkpoint
    checkpoint = {
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'loss': loss,
        'accuracy': accuracy
    }

    torch.save(checkpoint, f'checkpoint_epoch_{epoch}.pth')
    mlflow.log_artifact(f'checkpoint_epoch_{epoch}.pth', artifact_path='checkpoints')
```

## Logging Models

### Framework-Specific Logging

```python
# Scikit-learn
import mlflow.sklearn

with mlflow.start_run():
    model = train_sklearn_model()
    mlflow.sklearn.log_model(model, "model")

# PyTorch
import mlflow.pytorch

with mlflow.start_run():
    model = train_pytorch_model()
    mlflow.pytorch.log_model(model, "model")

# TensorFlow/Keras
import mlflow.keras

with mlflow.start_run():
    model = train_keras_model()
    mlflow.keras.log_model(model, "model")

# XGBoost
import mlflow.xgboost

with mlflow.start_run():
    model = train_xgboost_model()
    mlflow.xgboost.log_model(model, "model")
```

### Log Model with Signature

```python
from mlflow.models.signature import infer_signature
import mlflow.sklearn

with mlflow.start_run():
    model = train_model()

    # Infer signature from training data
    signature = infer_signature(X_train, model.predict(X_train))

    # Log with signature
    mlflow.sklearn.log_model(
        model,
        "model",
        signature=signature
    )
```

### Log Model with Input Example

```python
with mlflow.start_run():
    model = train_model()

    # Log with input example
    input_example = X_train[:5]

    mlflow.sklearn.log_model(
        model,
        "model",
        signature=signature,
        input_example=input_example
    )
```

### Log Model to Registry

```python
with mlflow.start_run():
    model = train_model()

    # Log and register in one step
    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="my-classifier"  # Register immediately
    )
```

## Autologging

### Enable Autologging

```python
import mlflow

# Enable for all frameworks
mlflow.autolog()

# Or framework-specific
mlflow.sklearn.autolog()
mlflow.pytorch.autolog()
mlflow.keras.autolog()
mlflow.xgboost.autolog()
mlflow.lightgbm.autolog()
```

### Autologging with Scikit-learn

```python
import mlflow
from sklearn.ensemble import RandomForestClassifier

mlflow.sklearn.autolog()

with mlflow.start_run():
    model = RandomForestClassifier(n_estimators=100, max_depth=5)
    model.fit(X_train, y_train)

    # Automatically logs:
    # - Parameters: n_estimators, max_depth, etc.
    # - Metrics: training score, test score
    # - Model: pickled model
    # - Training time
```

### Autologging with PyTorch Lightning

```python
import mlflow
import pytorch_lightning as pl

mlflow.pytorch.autolog()

with mlflow.start_run():
    trainer = pl.Trainer(max_epochs=10)
    trainer.fit(model, datamodule=dm)

    # Automatically logs:
    # - Hyperparameters from model and trainer
    # - Training and validation metrics
    # - Model checkpoints
```

### Disable Autologging

```python
# Disable for specific framework
mlflow.sklearn.autolog(disable=True)

# Disable all
mlflow.autolog(disable=True)
```

### Configure Autologging

```python
mlflow.sklearn.autolog(
    log_input_examples=True,  # Log input examples
    log_model_signatures=True,  # Log model signatures
    log_models=True,  # Log models
    disable=False,
    exclusive=False,
    disable_for_unsupported_versions=False,
    silent=False
)
```

## Runs and Experiments

### Create Experiment

```python
# Create experiment
experiment_id = mlflow.create_experiment(
    "my-experiment",
    artifact_location="s3://my-bucket/mlflow",
    tags={"project": "classification", "team": "ml-team"}
)

# Set active experiment
mlflow.set_experiment("my-experiment")

# Get experiment
experiment = mlflow.get_experiment_by_name("my-experiment")
print(f"Experiment ID: {experiment.experiment_id}")
```

### Nested Runs

```python
# Parent run
with mlflow.start_run(run_name="hyperparameter-tuning"):
    parent_run_id = mlflow.active_run().info.run_id

    # Child runs
    for lr in [0.001, 0.01, 0.1]:
        with mlflow.start_run(run_name=f"lr-{lr}", nested=True):
            mlflow.log_param("learning_rate", lr)
            model = train(lr)
            accuracy = evaluate(model)
            mlflow.log_metric("accuracy", accuracy)
```

### Run Tags

```python
with mlflow.start_run():
    # Set tags
    mlflow.set_tags({
        "model_type": "ResNet50",
        "dataset": "ImageNet",
        "git_commit": get_git_commit(),
        "developer": "alice@company.com"
    })

    # Single tag
    mlflow.set_tag("production_ready", "true")
```

### Run Notes

```python
with mlflow.start_run():
    # Add notes
    mlflow.set_tag("mlflow.note.content", """
    ## Experiment Notes

    - Using pretrained ResNet50
    - Fine-tuning last 2 layers
    - Data augmentation: random flip, crop, rotation
    - Learning rate schedule: cosine annealing

    ## Results
    - Best validation accuracy: 95.2%
    - Converged after 35 epochs
    """)
```

## Searching and Comparing

### Search Runs

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Get experiment
experiment = mlflow.get_experiment_by_name("my-experiment")
experiment_id = experiment.experiment_id

# Search all runs
runs = client.search_runs(
    experiment_ids=[experiment_id],
    filter_string="",
    order_by=["metrics.accuracy DESC"],
    max_results=10
)

for run in runs:
    print(f"Run ID: {run.info.run_id}")
    print(f"Accuracy: {run.data.metrics.get('accuracy', 'N/A')}")
    print(f"Params: {run.data.params}")
    print("---")
```

### Filter Runs

```python
# Filter by metric
runs = client.search_runs(
    experiment_ids=[experiment_id],
    filter_string="metrics.accuracy > 0.9"
)

# Filter by parameter
runs = client.search_runs(
    experiment_ids=[experiment_id],
    filter_string="params.model = 'ResNet50'"
)

# Complex filter
runs = client.search_runs(
    experiment_ids=[experiment_id],
    filter_string="""
        metrics.accuracy > 0.9 AND
        params.learning_rate < 0.01 AND
        tags.dataset = 'ImageNet'
    """
)
```

### Compare Best Runs

```python
def compare_best_runs(experiment_name, metric="accuracy", top_n=5):
    """Compare top N runs by metric."""
    experiment = mlflow.get_experiment_by_name(experiment_name)
    client = MlflowClient()

    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=f"metrics.{metric} > 0",
        order_by=[f"metrics.{metric} DESC"],
        max_results=top_n
    )

    print(f"Top {top_n} runs by {metric}:")
    print("-" * 80)

    for i, run in enumerate(runs, 1):
        print(f"{i}. Run ID: {run.info.run_id}")
        print(f"   {metric}: {run.data.metrics.get(metric, 'N/A')}")
        print(f"   Params: {run.data.params}")
        print()

compare_best_runs("my-experiment", metric="accuracy", top_n=5)
```

### Download Artifacts

```python
client = MlflowClient()

# Download artifact
run_id = "abc123"
local_path = client.download_artifacts(run_id, "model")
print(f"Downloaded to: {local_path}")

# Download specific file
local_file = client.download_artifacts(run_id, "plots/loss_curve.png")
```

## Best Practices

### 1. Use Descriptive Names

```python
# ✅ Good: Descriptive experiment and run names
mlflow.set_experiment("sentiment-analysis-bert")

with mlflow.start_run(run_name="bert-base-lr1e-5-bs32-epochs10"):
    train()

# ❌ Bad: Generic names
mlflow.set_experiment("experiment1")
with mlflow.start_run():
    train()
```

### 2. Log Comprehensive Metadata

```python
with mlflow.start_run():
    # Hyperparameters
    mlflow.log_params(config)

    # System info
    mlflow.set_tags({
        "git_commit": get_git_commit(),
        "framework": f"PyTorch {torch.__version__}",
        "cuda": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(0)
    })

    # Data info
    mlflow.log_params({
        "train_samples": len(train_dataset),
        "val_samples": len(val_dataset),
        "num_classes": num_classes
    })
```

### 3. Track Time

```python
import time

with mlflow.start_run():
    start_time = time.time()

    # Training
    model = train()

    # Log training time
    training_time = time.time() - start_time
    mlflow.log_metric("training_time_seconds", training_time)
```

### 4. Version Control Integration

```python
import subprocess

def get_git_commit():
    """Get current git commit hash."""
    try:
        return subprocess.check_output(
            ['git', 'rev-parse', 'HEAD']
        ).decode('ascii').strip()
    except:
        return "unknown"

with mlflow.start_run():
    mlflow.set_tag("git_commit", get_git_commit())
    mlflow.set_tag("git_branch", get_git_branch())
```

### 5. Error Handling

```python
with mlflow.start_run():
    try:
        model = train()
        mlflow.set_tag("status", "completed")
    except Exception as e:
        mlflow.set_tag("status", "failed")
        mlflow.set_tag("error", str(e))
        raise
```

## Resources

- **Tracking API**: https://mlflow.org/docs/latest/tracking.html
- **Python API**: https://mlflow.org/docs/latest/python_api/mlflow.html
- **Examples**: https://github.com/mlflow/mlflow/tree/master/examples
