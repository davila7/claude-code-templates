# Model Registry Guide

Complete guide to MLflow Model Registry for versioning, lifecycle management, and collaboration.

## Table of Contents
- What is Model Registry
- Registering Models
- Model Versions
- Stage Transitions
- Model Aliases (Modern Approach)
- Searching Models
- Model Annotations
- Collaborative Workflows
- Best Practices

## What is Model Registry

The Model Registry is a centralized model store for managing the full lifecycle of MLflow Models.

**Key Features:**
- **Versioning**: Automatic version increments (v1, v2, v3...)
- **Stages**: None, Staging, Production, Archived (legacy)
- **Aliases**: champion, challenger, latest (modern approach)
- **Annotations**: Descriptions, tags, metadata
- **Lineage**: Track which runs produced models
- **Collaboration**: Team-wide model governance
- **Deployment**: Single source of truth for production models

**Use Cases:**
- Model approval workflows
- A/B testing (champion vs challenger)
- Production deployment tracking
- Model performance monitoring
- Regulatory compliance

## Registering Models

### Register During Training

```python
import mlflow
import mlflow.sklearn

with mlflow.start_run():
    model = train_model()

    # Log and register in one step
    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="product-classifier"  # Creates or updates
    )
```

### Register After Training

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Get run ID from experiment
run_id = "abc123"

# Register model from run
model_uri = f"runs:/{run_id}/model"
result = mlflow.register_model(
    model_uri,
    "product-classifier"
)

print(f"Model name: {result.name}")
print(f"Version: {result.version}")
```

### Register with Signature

```python
from mlflow.models.signature import infer_signature

with mlflow.start_run():
    model = train_model()

    # Infer signature
    signature = infer_signature(X_train, model.predict(X_train))

    # Register with signature
    mlflow.sklearn.log_model(
        model,
        "model",
        signature=signature,
        registered_model_name="product-classifier"
    )
```

## Model Versions

### Automatic Versioning

```python
# First registration: creates version 1
with mlflow.start_run():
    model_v1 = train_model()
    mlflow.sklearn.log_model(model_v1, "model", registered_model_name="my-model")
    # Result: my-model version 1

# Second registration: creates version 2
with mlflow.start_run():
    model_v2 = train_improved_model()
    mlflow.sklearn.log_model(model_v2, "model", registered_model_name="my-model")
    # Result: my-model version 2

# Third registration: creates version 3
with mlflow.start_run():
    model_v3 = train_best_model()
    mlflow.sklearn.log_model(model_v3, "model", registered_model_name="my-model")
    # Result: my-model version 3
```

### List Model Versions

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Get all versions
versions = client.search_model_versions("name='product-classifier'")

for v in versions:
    print(f"Version {v.version}:")
    print(f"  Stage: {v.current_stage}")
    print(f"  Run ID: {v.run_id}")
    print(f"  Created: {v.creation_timestamp}")
    print(f"  Status: {v.status}")
    print()
```

### Get Specific Version

```python
client = MlflowClient()

# Get version details
version_info = client.get_model_version(
    name="product-classifier",
    version="3"
)

print(f"Version: {version_info.version}")
print(f"Stage: {version_info.current_stage}")
print(f"Run ID: {version_info.run_id}")
print(f"Description: {version_info.description}")
print(f"Tags: {version_info.tags}")
```

### Get Latest Version

```python
# Get latest version in Production stage
latest_prod = client.get_latest_versions(
    "product-classifier",
    stages=["Production"]
)

# Get latest version in Staging
latest_staging = client.get_latest_versions(
    "product-classifier",
    stages=["Staging"]
)

# Get all latest versions (one per stage)
all_latest = client.get_latest_versions("product-classifier")
```

## Stage Transitions

**Note**: Stages are deprecated in MLflow 2.9+. Use aliases instead (see next section).

### Available Stages

- **None**: Initial state, not yet tested
- **Staging**: Under testing/validation
- **Production**: Deployed in production
- **Archived**: Retired/deprecated

### Transition Model

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Promote to Staging
client.transition_model_version_stage(
    name="product-classifier",
    version=3,
    stage="Staging"
)

# Promote to Production (archive old production versions)
client.transition_model_version_stage(
    name="product-classifier",
    version=3,
    stage="Production",
    archive_existing_versions=True  # Archive old production models
)

# Archive old version
client.transition_model_version_stage(
    name="product-classifier",
    version=2,
    stage="Archived"
)
```

### Load Model by Stage

```python
import mlflow.pyfunc

# Load production model
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

# Load staging model
staging_model = mlflow.pyfunc.load_model("models:/product-classifier/Staging")

# Load specific version
model_v3 = mlflow.pyfunc.load_model("models:/product-classifier/3")

# Use model
predictions = model.predict(X_test)
```

## Model Aliases (Modern Approach)

**Introduced in MLflow 2.8** - Flexible alternative to stages.

### Set Aliases

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Set champion alias (current production model)
client.set_registered_model_alias(
    name="product-classifier",
    alias="champion",
    version="5"
)

# Set challenger alias (candidate for production)
client.set_registered_model_alias(
    name="product-classifier",
    alias="challenger",
    version="6"
)

# Set latest alias
client.set_registered_model_alias(
    name="product-classifier",
    alias="latest",
    version="7"
)
```

### Load Model by Alias

```python
import mlflow.pyfunc

# Load champion model
champion = mlflow.pyfunc.load_model("models:/product-classifier@champion")

# Load challenger model
challenger = mlflow.pyfunc.load_model("models:/product-classifier@challenger")

# Load latest model
latest = mlflow.pyfunc.load_model("models:/product-classifier@latest")

# Use for A/B testing
champion_preds = champion.predict(X_test)
challenger_preds = challenger.predict(X_test)
```

### Get Model by Alias

```python
client = MlflowClient()

# Get version info by alias
version_info = client.get_model_version_by_alias(
    name="product-classifier",
    alias="champion"
)

print(f"Champion is version: {version_info.version}")
print(f"Run ID: {version_info.run_id}")
```

### Delete Alias

```python
# Remove alias
client.delete_registered_model_alias(
    name="product-classifier",
    alias="challenger"
)
```

## Searching Models

### Search All Models

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# List all registered models
models = client.search_registered_models()

for model in models:
    print(f"Name: {model.name}")
    print(f"Description: {model.description}")
    print(f"Latest versions: {model.latest_versions}")
    print()
```

### Search by Name

```python
# Search by name pattern
models = client.search_registered_models(
    filter_string="name LIKE 'product-%'"
)

# Search exact name
models = client.search_registered_models(
    filter_string="name='product-classifier'"
)
```

### Search Model Versions

```python
# Find all versions of a model
versions = client.search_model_versions("name='product-classifier'")

# Find production versions
versions = client.search_model_versions(
    "name='product-classifier' AND current_stage='Production'"
)

# Find versions from specific run
versions = client.search_model_versions(
    f"run_id='{run_id}'"
)
```

## Model Annotations

### Add Description

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Update model description
client.update_registered_model(
    name="product-classifier",
    description="ResNet50 classifier for product categorization. Trained on 1M images with 95% accuracy."
)

# Update version description
client.update_model_version(
    name="product-classifier",
    version="3",
    description="Best performing model. Validation accuracy: 95.2%. Tested on 50K images."
)
```

### Add Tags

```python
client = MlflowClient()

# Add tags to model
client.set_registered_model_tag(
    name="product-classifier",
    key="task",
    value="classification"
)

client.set_registered_model_tag(
    name="product-classifier",
    key="domain",
    value="e-commerce"
)

# Add tags to specific version
client.set_model_version_tag(
    name="product-classifier",
    version="3",
    key="validation_status",
    value="approved"
)

client.set_model_version_tag(
    name="product-classifier",
    version="3",
    key="deployed_date",
    value="2025-01-15"
)

client.set_model_version_tag(
    name="product-classifier",
    version="3",
    key="approved_by",
    value="ml-team-lead"
)
```

### Delete Tags

```python
# Delete model tag
client.delete_registered_model_tag(
    name="product-classifier",
    key="old_tag"
)

# Delete version tag
client.delete_model_version_tag(
    name="product-classifier",
    version="3",
    key="old_version_tag"
)
```

## Collaborative Workflows

### Model Approval Workflow

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# 1. Data scientist trains and registers model
with mlflow.start_run():
    model = train_model()
    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="product-classifier"
    )
    run_id = mlflow.active_run().info.run_id

# 2. Add metadata for review
version = client.get_latest_versions("product-classifier")[0].version
client.update_model_version(
    name="product-classifier",
    version=version,
    description=f"Accuracy: 95%, F1: 0.93, Run: {run_id}"
)

client.set_model_version_tag(
    name="product-classifier",
    version=version,
    key="status",
    value="awaiting_review"
)

# 3. ML engineer reviews and tests
test_accuracy = evaluate_model(model)

if test_accuracy > 0.9:
    # Approve and promote to staging
    client.set_model_version_tag(
        name="product-classifier",
        version=version,
        key="status",
        value="approved"
    )

    client.transition_model_version_stage(
        name="product-classifier",
        version=version,
        stage="Staging"
    )

# 4. After staging validation, promote to production
if staging_tests_pass():
    client.transition_model_version_stage(
        name="product-classifier",
        version=version,
        stage="Production",
        archive_existing_versions=True
    )

    client.set_model_version_tag(
        name="product-classifier",
        version=version,
        key="deployed_by",
        value="ml-ops-team"
    )
```

### A/B Testing Workflow

```python
# Set up champion vs challenger
client = MlflowClient()

# Champion: Current production model
client.set_registered_model_alias(
    name="product-classifier",
    alias="champion",
    version="5"
)

# Challenger: New candidate model
client.set_registered_model_alias(
    name="product-classifier",
    alias="challenger",
    version="6"
)

# In production code
import random

def get_model_for_request():
    """Route 90% to champion, 10% to challenger."""
    if random.random() < 0.9:
        return mlflow.pyfunc.load_model("models:/product-classifier@champion")
    else:
        return mlflow.pyfunc.load_model("models:/product-classifier@challenger")

# After A/B test completes
if challenger_performs_better():
    # Promote challenger to champion
    client.set_registered_model_alias(
        name="product-classifier",
        alias="champion",
        version="6"
    )

    # Archive old champion
    client.delete_registered_model_alias(
        name="product-classifier",
        alias="challenger"
    )
```

### Model Rollback

```python
client = MlflowClient()

# Emergency rollback to previous production version
previous_version = "4"

client.transition_model_version_stage(
    name="product-classifier",
    version=previous_version,
    stage="Production",
    archive_existing_versions=True
)

# Add rollback metadata
client.set_model_version_tag(
    name="product-classifier",
    version=previous_version,
    key="rollback_reason",
    value="Performance degradation in production"
)

client.set_model_version_tag(
    name="product-classifier",
    version=previous_version,
    key="rollback_date",
    value="2025-01-15"
)
```

## Best Practices

### 1. Use Descriptive Names

```python
# ✅ Good: Descriptive, domain-specific names
mlflow.sklearn.log_model(model, "model", registered_model_name="ecommerce-product-classifier")
mlflow.sklearn.log_model(model, "model", registered_model_name="fraud-detection-xgboost")

# ❌ Bad: Generic names
mlflow.sklearn.log_model(model, "model", registered_model_name="model1")
mlflow.sklearn.log_model(model, "model", registered_model_name="classifier")
```

### 2. Always Add Descriptions

```python
client = MlflowClient()

# Add detailed version description
client.update_model_version(
    name="product-classifier",
    version="5",
    description="""
    ResNet50 classifier for product categorization

    Performance:
    - Validation Accuracy: 95.2%
    - F1 Score: 0.93
    - Inference Time: 15ms

    Training:
    - Dataset: ImageNet subset (1.2M images)
    - Augmentation: Random flip, crop, rotation
    - Epochs: 50
    - Batch Size: 32

    Notes:
    - Pretrained on ImageNet
    - Fine-tuned last 2 layers
    - Handles 1000 product categories
    """
)
```

### 3. Use Tags for Metadata

```python
# Add comprehensive tags
tags = {
    # Performance
    "accuracy": "0.952",
    "f1_score": "0.93",
    "inference_time_ms": "15",

    # Training
    "dataset": "imagenet-subset",
    "num_samples": "1200000",
    "epochs": "50",

    # Validation
    "validation_status": "approved",
    "tested_by": "ml-team",
    "test_date": "2025-01-10",

    # Deployment
    "deployed_date": "2025-01-15",
    "deployed_by": "mlops-team",
    "environment": "production",

    # Business
    "use_case": "product-categorization",
    "owner": "data-science-team",
    "stakeholder": "ecommerce-team"
}

for key, value in tags.items():
    client.set_model_version_tag(
        name="product-classifier",
        version="5",
        key=key,
        value=value
    )
```

### 4. Use Aliases Instead of Stages

```python
# ✅ Modern: Use aliases (MLflow 2.8+)
client.set_registered_model_alias(name="my-model", alias="champion", version="5")
client.set_registered_model_alias(name="my-model", alias="challenger", version="6")
model = mlflow.pyfunc.load_model("models:/my-model@champion")

# ⚠️ Legacy: Stages (deprecated in MLflow 2.9+)
client.transition_model_version_stage(name="my-model", version=5, stage="Production")
model = mlflow.pyfunc.load_model("models:/my-model/Production")
```

### 5. Track Model Lineage

```python
# Link model version to training run
with mlflow.start_run(run_name="product-classifier-training") as run:
    # Log training metrics
    mlflow.log_params(config)
    mlflow.log_metrics(metrics)

    # Register model
    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="product-classifier"
    )

    run_id = run.info.run_id

# Add lineage metadata
version = client.get_latest_versions("product-classifier")[0].version
client.set_model_version_tag(
    name="product-classifier",
    version=version,
    key="training_run_id",
    value=run_id
)

# Add data lineage
client.set_model_version_tag(
    name="product-classifier",
    version=version,
    key="dataset_version",
    value="imagenet-v2-2025-01"
)
```

### 6. Implement Approval Gates

```python
def promote_to_production(model_name, version, min_accuracy=0.9):
    """Promote model to production with validation checks."""
    client = MlflowClient()

    # 1. Validate performance
    version_info = client.get_model_version(name=model_name, version=version)

    # Check if approved
    tags = version_info.tags
    if tags.get("validation_status") != "approved":
        raise ValueError("Model not approved for production")

    # Check accuracy threshold
    accuracy = float(tags.get("accuracy", 0))
    if accuracy < min_accuracy:
        raise ValueError(f"Accuracy {accuracy} below threshold {min_accuracy}")

    # 2. Promote to production
    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage="Production",
        archive_existing_versions=True
    )

    # 3. Add deployment metadata
    from datetime import datetime
    client.set_model_version_tag(
        name=model_name,
        version=version,
        key="deployed_date",
        value=datetime.now().isoformat()
    )

    print(f"✅ Promoted {model_name} v{version} to production")

# Use it
promote_to_production("product-classifier", "5", min_accuracy=0.9)
```

## Resources

- **Model Registry**: https://mlflow.org/docs/latest/model-registry.html
- **Model Aliases**: https://mlflow.org/docs/latest/model-registry.html#using-model-aliases
- **Python API**: https://mlflow.org/docs/latest/python_api/mlflow.tracking.html#mlflow.tracking.MlflowClient
