# Ray Data Transformations

Complete guide to data transformations in Ray Data.

## Core operations

### Map batches (vectorized)

```python
# Recommended for performance
def process_batch(batch):
    # batch is dict of numpy arrays or pandas Series
    batch["doubled"] = batch["value"] * 2
    return batch

ds = ds.map_batches(process_batch, batch_size=1000)
```

**Performance**: 10-100× faster than row-by-row

### Map (row-by-row)

```python
# Use only when vectorization not possible
def process_row(row):
    row["squared"] = row["value"] ** 2
    return row

ds = ds.map(process_row)
```

### Filter

```python
# Remove rows
ds = ds.filter(lambda row: row["score"] > 0.5)
```

### Flat map

```python
# One row → multiple rows
def expand_row(row):
    return [{"value": row["value"] + i} for i in range(3)]

ds = ds.flat_map(expand_row)
```

## GPU-accelerated transforms

```python
def gpu_transform(batch):
    import torch
    data = torch.tensor(batch["data"]).cuda()
    # GPU processing
    result = data * 2
    return {"processed": result.cpu().numpy()}

ds = ds.map_batches(gpu_transform, num_gpus=1, batch_size=64)
```

## Groupby operations

```python
# Group by column
grouped = ds.groupby("category")

# Aggregate
result = grouped.count()

# Custom aggregation
result = grouped.map_groups(lambda group: {
    "sum": group["value"].sum(),
    "mean": group["value"].mean()
})
```

## Best practices

1. **Use map_batches over map** - 10-100× faster
2. **Tune batch_size** - Larger = faster (balance with memory)
3. **Use GPUs for heavy compute** - Image/audio preprocessing
4. **Stream large datasets** - Use iter_batches for >memory data
