---
name: ray-data
description: Scalable data processing for ML workloads. Streaming execution across CPU/GPU, supports Parquet/CSV/JSON/images. Integrates with Ray Train, PyTorch, TensorFlow. Scales from single machine to 100s of nodes. Use for batch inference, data preprocessing, multi-modal data loading, or distributed ETL pipelines.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Data Processing, Ray Data, Distributed Computing, ML Pipelines, Batch Inference, ETL, Scalable, Ray, PyTorch, TensorFlow]
dependencies: [ray[data], pyarrow, pandas]
---

# Ray Data - Scalable ML Data Processing

Distributed data processing library for ML and AI workloads.

## When to use Ray Data

**Use Ray Data when:**
- Processing large datasets (>100GB) for ML training
- Need distributed data preprocessing across cluster
- Building batch inference pipelines
- Loading multi-modal data (images, audio, video)
- Scaling data processing from laptop to cluster

**Key features**:
- **Streaming execution**: Process data larger than memory
- **GPU support**: Accelerate transforms with GPUs
- **Framework integration**: PyTorch, TensorFlow, HuggingFace
- **Multi-modal**: Images, Parquet, CSV, JSON, audio, video

**Use alternatives instead**:
- **Pandas**: Small data (<1GB) on single machine
- **Dask**: Tabular data, SQL-like operations
- **Spark**: Enterprise ETL, SQL queries

## Quick start

### Installation

```bash
pip install -U 'ray[data]'
```

### Load and transform data

```python
import ray

# Read Parquet files
ds = ray.data.read_parquet("s3://bucket/data/*.parquet")

# Transform data (lazy execution)
ds = ds.map_batches(lambda batch: {"processed": batch["text"].str.lower()})

# Consume data
for batch in ds.iter_batches(batch_size=100):
    print(batch)
```

### Integration with Ray Train

```python
import ray
from ray.train import ScalingConfig
from ray.train.torch import TorchTrainer

# Create dataset
train_ds = ray.data.read_parquet("s3://bucket/train/*.parquet")

def train_func(config):
    # Access dataset in training
    train_ds = ray.train.get_dataset_shard("train")

    for epoch in range(10):
        for batch in train_ds.iter_batches(batch_size=32):
            # Train on batch
            pass

# Train with Ray
trainer = TorchTrainer(
    train_func,
    datasets={"train": train_ds},
    scaling_config=ScalingConfig(num_workers=4, use_gpu=True)
)
trainer.fit()
```

## Reading data

### From cloud storage

```python
import ray

# Parquet (recommended for ML)
ds = ray.data.read_parquet("s3://bucket/data/*.parquet")

# CSV
ds = ray.data.read_csv("s3://bucket/data/*.csv")

# JSON
ds = ray.data.read_json("gs://bucket/data/*.json")

# Images
ds = ray.data.read_images("s3://bucket/images/")
```

### From Python objects

```python
# From list
ds = ray.data.from_items([{"id": i, "value": i * 2} for i in range(1000)])

# From range
ds = ray.data.range(1000000)  # Synthetic data

# From pandas
import pandas as pd
df = pd.DataFrame({"col1": [1, 2, 3], "col2": [4, 5, 6]})
ds = ray.data.from_pandas(df)
```

## Transformations

### Map batches (vectorized)

```python
# Batch transformation (fast)
def process_batch(batch):
    batch["doubled"] = batch["value"] * 2
    return batch

ds = ds.map_batches(process_batch, batch_size=1000)
```

### Row transformations

```python
# Row-by-row (slower)
def process_row(row):
    row["squared"] = row["value"] ** 2
    return row

ds = ds.map(process_row)
```

### Filter

```python
# Filter rows
ds = ds.filter(lambda row: row["value"] > 100)
```

### Group by and aggregate

```python
# Group by column
ds = ds.groupby("category").count()

# Custom aggregation
ds = ds.groupby("category").map_groups(lambda group: {"sum": group["value"].sum()})
```

## GPU-accelerated transforms

```python
# Use GPU for preprocessing
def preprocess_images_gpu(batch):
    import torch
    images = torch.tensor(batch["image"]).cuda()
    # GPU preprocessing
    processed = images * 255
    return {"processed": processed.cpu().numpy()}

ds = ds.map_batches(
    preprocess_images_gpu,
    batch_size=64,
    num_gpus=1  # Request GPU
)
```

## Writing data

```python
# Write to Parquet
ds.write_parquet("s3://bucket/output/")

# Write to CSV
ds.write_csv("output/")

# Write to JSON
ds.write_json("output/")
```

## Performance optimization

### Repartition

```python
# Control parallelism
ds = ds.repartition(100)  # 100 blocks for 100-core cluster
```

### Batch size tuning

```python
# Larger batches = faster vectorized ops
ds.map_batches(process_fn, batch_size=10000)  # vs batch_size=100
```

### Streaming execution

```python
# Process data larger than memory
ds = ray.data.read_parquet("s3://huge-dataset/")
for batch in ds.iter_batches(batch_size=1000):
    process(batch)  # Streamed, not loaded to memory
```

## Common patterns

### Batch inference

```python
import ray

# Load model
def load_model():
    # Load once per worker
    return MyModel()

# Inference function
class BatchInference:
    def __init__(self):
        self.model = load_model()

    def __call__(self, batch):
        predictions = self.model(batch["input"])
        return {"prediction": predictions}

# Run distributed inference
ds = ray.data.read_parquet("s3://data/")
predictions = ds.map_batches(BatchInference, batch_size=32, num_gpus=1)
predictions.write_parquet("s3://output/")
```

### Data preprocessing pipeline

```python
# Multi-step pipeline
ds = (
    ray.data.read_parquet("s3://raw/")
    .map_batches(clean_data)
    .map_batches(tokenize)
    .map_batches(augment)
    .write_parquet("s3://processed/")
)
```

## Integration with ML frameworks

### PyTorch

```python
# Convert to PyTorch
torch_ds = ds.to_torch(label_column="label", batch_size=32)

for batch in torch_ds:
    # batch is dict with tensors
    inputs, labels = batch["features"], batch["label"]
```

### TensorFlow

```python
# Convert to TensorFlow
tf_ds = ds.to_tf(feature_columns=["image"], label_column="label", batch_size=32)

for features, labels in tf_ds:
    # Train model
    pass
```

## Supported data formats

| Format | Read | Write | Use Case |
|--------|------|-------|----------|
| Parquet | ✅ | ✅ | ML data (recommended) |
| CSV | ✅ | ✅ | Tabular data |
| JSON | ✅ | ✅ | Semi-structured |
| Images | ✅ | ❌ | Computer vision |
| NumPy | ✅ | ✅ | Arrays |
| Pandas | ✅ | ❌ | DataFrames |

## Performance benchmarks

**Scaling** (processing 100GB data):
- 1 node (16 cores): ~30 minutes
- 4 nodes (64 cores): ~8 minutes
- 16 nodes (256 cores): ~2 minutes

**GPU acceleration** (image preprocessing):
- CPU only: 1,000 images/sec
- 1 GPU: 5,000 images/sec
- 4 GPUs: 18,000 images/sec

## Use cases

**Production deployments**:
- **Pinterest**: Last-mile data processing for model training
- **ByteDance**: Scaling offline inference with multi-modal LLMs
- **Spotify**: ML platform for batch inference

## References

- **[Transformations Guide](references/transformations.md)** - Map, filter, groupby operations
- **[Integration Guide](references/integration.md)** - Ray Train, PyTorch, TensorFlow

## Resources

- **Docs**: https://docs.ray.io/en/latest/data/data.html
- **GitHub**: https://github.com/ray-project/ray ⭐ 36,000+
- **Version**: Ray 2.40.0+
- **Examples**: https://docs.ray.io/en/latest/data/examples/overview.html



