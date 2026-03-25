# Ray Data Integration Guide

Integration with Ray Train and ML frameworks.

## Ray Train integration

### Basic training with datasets

```python
import ray
from ray.train import ScalingConfig
from ray.train.torch import TorchTrainer

# Create datasets
train_ds = ray.data.read_parquet("s3://data/train/")
val_ds = ray.data.read_parquet("s3://data/val/")

def train_func(config):
    # Get dataset shards
    train_ds = ray.train.get_dataset_shard("train")
    val_ds = ray.train.get_dataset_shard("val")

    for epoch in range(config["epochs"]):
        # Iterate over batches
        for batch in train_ds.iter_batches(batch_size=32):
            # Train on batch
            pass

# Launch training
trainer = TorchTrainer(
    train_func,
    train_loop_config={"epochs": 10},
    datasets={"train": train_ds, "val": val_ds},
    scaling_config=ScalingConfig(num_workers=4, use_gpu=True)
)

result = trainer.fit()
```

## PyTorch integration

### Convert to PyTorch Dataset

```python
# Option 1: to_torch (recommended)
torch_ds = ds.to_torch(
    label_column="label",
    batch_size=32,
    drop_last=True
)

for batch in torch_ds:
    inputs = batch["features"]
    labels = batch["label"]
    # Train model

# Option 2: iter_torch_batches
for batch in ds.iter_torch_batches(batch_size=32):
    # batch is dict of tensors
    pass
```

## TensorFlow integration

```python
tf_ds = ds.to_tf(
    feature_columns=["image", "text"],
    label_column="label",
    batch_size=32
)

for features, labels in tf_ds:
    # Train TensorFlow model
    pass
```

## Best practices

1. **Shard datasets in Ray Train** - Automatic with `get_dataset_shard()`
2. **Use streaming** - Don't load entire dataset to memory
3. **Preprocess in Ray Data** - Distribute preprocessing across cluster
4. **Cache preprocessed data** - Write to Parquet, read in training
