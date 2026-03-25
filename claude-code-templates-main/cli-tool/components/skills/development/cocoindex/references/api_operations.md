# API Operations Reference

Guide for operating CocoIndex flows programmatically using Python APIs.

## Overview

CocoIndex flows can be operated through Python APIs, providing programmatic control over setup, updates, and queries. This is useful for embedding flows in applications, automating workflows, or building custom tools.

## Basic Setup

### Initialization

```python
from dotenv import load_dotenv
import cocoindex

# Load environment variables
load_dotenv()

# Initialize CocoIndex
cocoindex.init()
```

### Flow Definition

```python
@cocoindex.flow_def(name="MyFlow")
def my_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Flow definition
    pass
```

The decorator returns a `cocoindex.Flow` object that can be used for operations.

## Flow Operations

### Setup Flow

Create persistent backends (tables, collections, etc.) for the flow.

```python
# Basic setup
my_flow.setup()

# With progress output
my_flow.setup(report_to_stdout=True)

# Async version
await my_flow.setup_async(report_to_stdout=True)
```

**When to use:**
- Before first update
- After modifying flow structure
- After dropping flow to recreate resources

### Setup All Flows

```python
# Setup all flows at once
cocoindex.setup_all_flows(report_to_stdout=True)
```

### Drop Flow

Remove all persistent backends owned by the flow.

```python
# Drop flow
my_flow.drop()

# With progress output
my_flow.drop(report_to_stdout=True)

# Async version
await my_flow.drop_async(report_to_stdout=True)
```

**Note:** After dropping, the Flow object is still valid and can be setup again.

### Drop All Flows

```python
# Drop all flows
cocoindex.drop_all_flows(report_to_stdout=True)
```

### Close Flow

Remove flow from current process memory (doesn't affect persistent data).

```python
my_flow.close()
# After this, my_flow is invalid and should not be used
```

## Update Operations

### One-Time Update

Build or update target data based on current source data.

```python
# Basic update
stats = my_flow.update()
print(f"Processed {stats.total_rows} rows")

# With reexport (force reprocess even if unchanged)
stats = my_flow.update(reexport_targets=True)

# Async version
stats = await my_flow.update_async()
stats = await my_flow.update_async(reexport_targets=True)
```

**Returns:** Statistics about processed data

**Note:** Multiple calls to `update()` can run simultaneously. CocoIndex will automatically combine them efficiently.

### Live Update

Continuously monitor source changes and update targets.

```python
import cocoindex

# Create live updater
updater = cocoindex.FlowLiveUpdater(
    my_flow,
    cocoindex.FlowLiveUpdaterOptions(
        live_mode=True,        # Enable live updates
        print_stats=True,      # Print progress
        reexport_targets=False # Only reexport on first update if True
    )
)

# Start the updater
updater.start()

# Your application logic here
# (updater runs in background threads)

# Wait for completion
updater.wait()

# Print final stats
print(updater.update_stats())
```

#### As Context Manager

```python
with cocoindex.FlowLiveUpdater(my_flow) as updater:
    # Updater starts automatically
    # Your application logic here
    pass
# Updater aborts and waits automatically

# Async version
async with cocoindex.FlowLiveUpdater(my_flow) as updater:
    # Your application logic
    pass
```

#### Monitoring Status Updates

```python
updater = cocoindex.FlowLiveUpdater(my_flow)
updater.start()

while True:
    # Block until next status update
    updates = updater.next_status_updates()

    # Check which sources were updated
    for source in updates.updated_sources:
        print(f"Source {source} has new data")
        # Trigger downstream operations

    # Check if updater stopped
    if not updates.active_sources:
        print("All sources stopped")
        break

# Async version
while True:
    updates = await updater.next_status_updates_async()
    # ... same logic
```

#### Control Methods

```python
# Start updater
updater.start()
await updater.start_async()

# Abort updater
updater.abort()

# Wait for completion
updater.wait()
await updater.wait_async()

# Get current stats
stats = updater.update_stats()
```

## Evaluate Flow

Run transformations without updating targets (for testing).

```python
# Evaluate and dump results
my_flow.evaluate_and_dump(
    cocoindex.EvaluateAndDumpOptions(
        output_dir="./eval_output",
        use_cache=True  # Use existing cache (but don't update it)
    )
)
```

**Use cases:**
- Testing flow logic
- Debugging transformations
- Inspecting intermediate data

## Query Operations

### Transform Flows

Transform flows enable reusable transformation logic for both indexing and querying.

```python
from numpy.typing import NDArray
import numpy as np

# Define transform flow
@cocoindex.transform_flow()
def text_to_embedding(
    text: cocoindex.DataSlice[str]
) -> cocoindex.DataSlice[NDArray[np.float32]]:
    """Convert text to embedding vector."""
    return text.transform(
        cocoindex.functions.SentenceTransformerEmbed(
            model="sentence-transformers/all-MiniLM-L6-v2"
        )
    )

# Use in indexing flow
@cocoindex.flow_def(name="TextEmbedding")
def text_embedding_flow(flow_builder, data_scope):
    # ... setup source ...
    with data_scope["documents"].row() as doc:
        doc["embedding"] = text_to_embedding(doc["content"])
        # ... collect and export ...

# Use for querying (evaluate with input)
query_embedding = text_to_embedding.eval("search query text")
# query_embedding is now a numpy array
```

### Query Handlers

Attach query logic to flows for easy query execution.

```python
import functools
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

@functools.cache
def connection_pool():
    return ConnectionPool(os.environ["COCOINDEX_DATABASE_URL"])

# Register query handler
@my_flow.query_handler(
    result_fields=cocoindex.QueryHandlerResultFields(
        embedding=["embedding"],  # Field name(s) containing embeddings
        score="score"             # Field name for similarity score
    )
)
def search(query: str) -> cocoindex.QueryOutput:
    """Search for documents matching query."""

    # Get table name for this flow's export
    table_name = cocoindex.utils.get_target_default_name(my_flow, "doc_embeddings")

    # Compute query embedding using transform flow
    query_vector = text_to_embedding.eval(query)

    # Execute query
    with connection_pool().connection() as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT filename, text, embedding, embedding <=> %s AS distance
                FROM {table_name}
                ORDER BY distance
                LIMIT 10
                """,
                (query_vector,)
            )

            return cocoindex.QueryOutput(
                query_info=cocoindex.QueryInfo(
                    embedding=query_vector,
                    similarity_metric=cocoindex.VectorSimilarityMetric.COSINE_SIMILARITY
                ),
                results=[
                    {
                        "filename": row[0],
                        "text": row[1],
                        "embedding": row[2],
                        "score": 1.0 - row[3]  # Convert distance to similarity
                    }
                    for row in cur.fetchall()
                ]
            )

# Call the query handler
results = search("machine learning algorithms")
for result in results.results:
    print(f"[{result['score']:.3f}] {result['filename']}: {result['text']}")
```

### Query with Qdrant

```python
from qdrant_client import QdrantClient
import functools

@functools.cache
def get_qdrant_client():
    return QdrantClient(url="http://localhost:6334", prefer_grpc=True)

@my_flow.query_handler(
    result_fields=cocoindex.QueryHandlerResultFields(
        embedding=["embedding"],
        score="score"
    )
)
def search_qdrant(query: str) -> cocoindex.QueryOutput:
    client = get_qdrant_client()

    # Get query embedding
    query_embedding = text_to_embedding.eval(query)

    # Search Qdrant
    search_results = client.search(
        collection_name="my_collection",
        query_vector=("text_embedding", query_embedding),
        limit=10
    )

    return cocoindex.QueryOutput(
        query_info=cocoindex.QueryInfo(
            embedding=query_embedding,
            similarity_metric=cocoindex.VectorSimilarityMetric.COSINE_SIMILARITY
        ),
        results=[
            {
                "text": result.payload["text"],
                "embedding": result.vector,
                "score": result.score
            }
            for result in search_results
        ]
    )
```

## Application Integration Patterns

### Pattern 1: Simple Application with Update

```python
from dotenv import load_dotenv
import cocoindex

# Initialize
load_dotenv()
cocoindex.init()

# Define flow
@cocoindex.flow_def(name="MyApp")
def my_app_flow(flow_builder, data_scope):
    # ... flow definition ...
    pass

def main():
    # Ensure flow is set up and data is fresh
    stats = my_app_flow.update()
    print(f"Updated index: {stats}")

    # Run application logic
    while True:
        query = input("Search: ")
        if not query:
            break
        results = search(query)
        for result in results.results:
            print(f"  {result['score']:.3f}: {result['text']}")

if __name__ == "__main__":
    main()
```

### Pattern 2: Web Application with Live Updates

```python
from fastapi import FastAPI
import cocoindex
from dotenv import load_dotenv

load_dotenv()
cocoindex.init()

@cocoindex.flow_def(name="WebAppFlow")
def web_app_flow(flow_builder, data_scope):
    # ... flow definition ...
    pass

# Create FastAPI app
app = FastAPI()

# Global updater
updater = None

@app.on_event("startup")
async def startup():
    global updater
    # Start live updater in background
    updater = cocoindex.FlowLiveUpdater(
        web_app_flow,
        cocoindex.FlowLiveUpdaterOptions(live_mode=True, print_stats=True)
    )
    await updater.start_async()
    print("Live updater started")

@app.on_event("shutdown")
async def shutdown():
    global updater
    if updater:
        updater.abort()
        await updater.wait_async()
        print("Live updater stopped")

@app.get("/search")
async def search_endpoint(q: str):
    results = search(q)
    return {
        "query": q,
        "results": results.results
    }
```

### Pattern 3: Batch Processing

```python
import cocoindex
from dotenv import load_dotenv

load_dotenv()
cocoindex.init()

@cocoindex.flow_def(name="BatchProcessor")
def batch_flow(flow_builder, data_scope):
    # ... flow definition ...
    pass

def process_batch():
    """Run as scheduled job (cron, etc.)"""
    # Setup if needed (no-op if already set up)
    batch_flow.setup()

    # Run update
    stats = batch_flow.update()

    # Log results
    print(f"Batch completed: {stats.total_rows} rows processed")

    return stats

if __name__ == "__main__":
    process_batch()
```

### Pattern 4: React to Updates

```python
import cocoindex

@cocoindex.flow_def(name="ReactiveFlow")
def reactive_flow(flow_builder, data_scope):
    # ... flow definition ...
    pass

async def run_with_reactions():
    """Monitor updates and trigger downstream actions."""
    async with cocoindex.FlowLiveUpdater(reactive_flow) as updater:
        while True:
            updates = await updater.next_status_updates_async()

            # React to specific source updates
            if "products" in updates.updated_sources:
                await rebuild_product_index()

            if "customers" in updates.updated_sources:
                await refresh_customer_cache()

            # Exit when updater stops
            if not updates.active_sources:
                break

async def rebuild_product_index():
    print("Rebuilding product index...")
    # Custom logic

async def refresh_customer_cache():
    print("Refreshing customer cache...")
    # Custom logic
```

## Error Handling

### Handling Update Errors

```python
try:
    stats = my_flow.update()
except cocoindex.CocoIndexError as e:
    print(f"Update failed: {e}")
    # Handle error (log, retry, alert, etc.)
```

### Graceful Shutdown

```python
import signal

updater = None

def signal_handler(sig, frame):
    print("Shutting down gracefully...")
    if updater:
        updater.abort()
        updater.wait()
    print("Shutdown complete")
    exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

updater = cocoindex.FlowLiveUpdater(my_flow)
updater.start()
updater.wait()
```

## Best Practices

1. **Always call cocoindex.init()** - Initialize before using any CocoIndex APIs
2. **Load environment variables** - Use dotenv or similar to load configuration
3. **Use context managers** - For live updaters to ensure cleanup
4. **Cache expensive resources** - Use `@functools.cache` for database pools, clients
5. **Handle signals** - Gracefully shutdown live updaters on SIGINT/SIGTERM
6. **Separate concerns** - Keep flow definitions, queries, and application logic separate
7. **Use transform flows** - Share logic between indexing and querying
8. **Monitor update stats** - Log and track processing statistics
9. **Test with evaluate** - Use evaluate_and_dump for testing before updates
