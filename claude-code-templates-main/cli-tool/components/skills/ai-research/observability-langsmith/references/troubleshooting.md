# LangSmith Troubleshooting Guide

## Installation Issues

### Package Not Found

**Error**: `ModuleNotFoundError: No module named 'langsmith'`

**Fix**:
```bash
pip install langsmith

# Verify installation
python -c "import langsmith; print(langsmith.__version__)"
```

### Version Conflicts

**Error**: `ImportError: cannot import name 'traceable' from 'langsmith'`

**Fix**:
```bash
# Upgrade to latest version
pip install -U langsmith

# Check for conflicts
pip check

# If conflicts exist, create clean environment
python -m venv venv
source venv/bin/activate
pip install langsmith
```

## Authentication Issues

### API Key Not Found

**Error**: `LangSmithAuthError: Authentication failed`

**Solutions**:

1. **Set environment variable**:
```bash
export LANGSMITH_API_KEY="your-api-key"

# Or in .env file
LANGSMITH_API_KEY=your-api-key
```

2. **Pass directly to client**:
```python
from langsmith import Client

client = Client(api_key="your-api-key")
```

3. **Verify key is set**:
```python
import os
print(os.environ.get("LANGSMITH_API_KEY", "NOT SET"))
```

### Invalid API Key

**Error**: `LangSmithAuthError: 401 Unauthorized`

**Fix**:
```bash
# Verify key at https://smith.langchain.com/settings

# Test connection
python -c "from langsmith import Client; c = Client(); print(list(c.list_projects()))"
```

### Wrong Endpoint

**Error**: `LangSmithConnectionError: Connection refused`

**Fix**:
```python
import os

# Default endpoint
os.environ["LANGSMITH_ENDPOINT"] = "https://api.smith.langchain.com"

# Or for self-hosted
os.environ["LANGSMITH_ENDPOINT"] = "https://your-langsmith-instance.com"
```

## Tracing Issues

### Traces Not Appearing

**Problem**: Traced functions don't appear in LangSmith.

**Solutions**:

1. **Enable tracing**:
```python
import os
os.environ["LANGSMITH_TRACING"] = "true"

# Verify
print(os.environ.get("LANGSMITH_TRACING"))
```

2. **Check project name**:
```python
import os
os.environ["LANGSMITH_PROJECT"] = "my-project"

# Or in decorator
from langsmith import traceable

@traceable(project_name="my-project")
def my_function():
    pass
```

3. **Flush pending traces**:
```python
from langsmith import Client

client = Client()
client.flush()  # Wait for all pending traces to be sent
```

4. **Verify connection**:
```python
from langsmith import Client

client = Client()
try:
    projects = list(client.list_projects())
    print(f"Connected! Found {len(projects)} projects")
except Exception as e:
    print(f"Connection failed: {e}")
```

### Missing Child Runs

**Problem**: Nested function calls don't appear as child runs.

**Fix**:
```python
from langsmith import traceable

# All nested functions must be decorated
@traceable
def parent_function():
    child_function()  # This will be a child run

@traceable
def child_function():
    pass

# Or use tracing context
from langsmith import trace

with trace("parent", run_type="chain") as parent:
    with trace("child", run_type="tool") as child:
        # Child automatically nested under parent
        pass
```

### Async Tracing Issues

**Problem**: Async functions not traced correctly.

**Fix**:
```python
from langsmith import traceable
import asyncio

# Decorator works with async functions
@traceable
async def async_function():
    await asyncio.sleep(1)
    return "done"

# For async context
from langsmith import AsyncClient

async def main():
    client = AsyncClient()
    async for run in client.list_runs(project_name="my-project"):
        print(run.name)

asyncio.run(main())
```

## Evaluation Issues

### Dataset Not Found

**Error**: `LangSmithNotFoundError: Dataset 'xyz' not found`

**Fix**:
```python
from langsmith import Client

client = Client()

# List available datasets
for dataset in client.list_datasets():
    print(f"Dataset: {dataset.name}, ID: {dataset.id}")

# Use correct name or ID
results = evaluate(
    my_model,
    data="correct-dataset-name",  # Or use dataset ID
    evaluators=[my_evaluator]
)
```

### Evaluator Errors

**Problem**: Custom evaluator fails silently.

**Fix**:
```python
def safe_evaluator(run, example):
    try:
        prediction = run.outputs.get("answer", "")
        reference = example.outputs.get("answer", "")

        if not prediction or not reference:
            return {"key": "accuracy", "score": 0.0, "comment": "Missing data"}

        score = compute_score(prediction, reference)
        return {"key": "accuracy", "score": score}

    except Exception as e:
        # Return error as comment instead of crashing
        return {
            "key": "accuracy",
            "score": 0.0,
            "comment": f"Evaluator error: {str(e)}"
        }
```

### Evaluation Timeout

**Problem**: Evaluation hangs or times out.

**Fix**:
```python
from langsmith import evaluate
import asyncio

# Use async evaluation with timeout
async def run_with_timeout():
    try:
        results = await asyncio.wait_for(
            aevaluate(my_model, data="test-set", evaluators=[my_evaluator]),
            timeout=300  # 5 minutes
        )
        return results
    except asyncio.TimeoutError:
        print("Evaluation timed out")
        return None

# Or reduce concurrency
results = evaluate(
    my_model,
    data="test-set",
    evaluators=[my_evaluator],
    max_concurrency=5  # Reduce from default
)
```

## Performance Issues

### High Latency from Tracing

**Problem**: Tracing adds significant latency.

**Solutions**:

1. **Enable background batching** (default):
```python
from langsmith import Client

client = Client(auto_batch_tracing=True)
```

2. **Use sampling**:
```python
import os
os.environ["LANGSMITH_TRACING_SAMPLING_RATE"] = "0.1"  # 10% of traces
```

3. **Reduce payload size**:
```python
from langsmith import traceable

def truncate_inputs(inputs):
    return {k: str(v)[:1000] for k, v in inputs.items()}

@traceable(process_inputs=truncate_inputs)
def my_function(large_input):
    pass
```

### Memory Issues

**Problem**: High memory usage during evaluation.

**Fix**:
```python
from langsmith import evaluate

# Process in smaller batches
def evaluate_in_batches(model, dataset_name, batch_size=100):
    from langsmith import Client
    client = Client()

    examples = list(client.list_examples(dataset_name=dataset_name))

    all_results = []
    for i in range(0, len(examples), batch_size):
        batch = examples[i:i + batch_size]
        results = evaluate(
            model,
            data=batch,
            evaluators=[my_evaluator]
        )
        all_results.extend(results)

        # Clear memory
        import gc
        gc.collect()

    return all_results
```

### Rate Limiting

**Error**: `LangSmithRateLimitError: 429 Too Many Requests`

**Fix**:
```python
import time
from langsmith import Client

client = Client()

def retry_with_backoff(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if "429" in str(e):
                wait_time = 2 ** attempt
                print(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
    raise Exception("Max retries exceeded")

# Use with operations
retry_with_backoff(lambda: client.create_run(...))
```

## Data Issues

### Large Payload Errors

**Error**: `PayloadTooLarge: Request payload exceeds maximum size`

**Fix**:
```python
from langsmith import traceable

def limit_size(data, max_chars=10000):
    if isinstance(data, str):
        return data[:max_chars]
    elif isinstance(data, dict):
        return {k: limit_size(v, max_chars // len(data)) for k, v in data.items()}
    elif isinstance(data, list):
        return [limit_size(item, max_chars // len(data)) for item in data[:100]]
    return data

@traceable(
    process_inputs=limit_size,
    process_outputs=limit_size
)
def process_large_data(data):
    return large_result
```

### Serialization Errors

**Error**: `TypeError: Object of type X is not JSON serializable`

**Fix**:
```python
import json
from datetime import datetime
import numpy as np

def serialize_value(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif hasattr(obj, "__dict__"):
        return obj.__dict__
    return str(obj)

def safe_serialize(data):
    return json.loads(json.dumps(data, default=serialize_value))

@traceable(
    process_inputs=safe_serialize,
    process_outputs=safe_serialize
)
def my_function(complex_input):
    return complex_output
```

## Network Issues

### Connection Timeout

**Error**: `LangSmithRequestTimeout: Connection timed out`

**Fix**:
```python
from langsmith import Client

# Increase timeout
client = Client(timeout_ms=60000)  # 60 seconds

# Or set via environment
import os
os.environ["LANGSMITH_TIMEOUT_MS"] = "60000"
```

### SSL Certificate Errors

**Error**: `SSLCertVerificationError`

**Fix**:
```python
# For self-signed certificates (not recommended for production)
import os
os.environ["LANGSMITH_VERIFY_SSL"] = "false"

# Better: Add certificate to trusted store
# Or use proper CA-signed certificates
```

### Proxy Configuration

**Problem**: Behind corporate proxy.

**Fix**:
```python
import os

# Set proxy environment variables
os.environ["HTTP_PROXY"] = "http://proxy.company.com:8080"
os.environ["HTTPS_PROXY"] = "http://proxy.company.com:8080"

# Then use client normally
from langsmith import Client
client = Client()
```

## Debugging Tips

### Enable Debug Logging

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("langsmith").setLevel(logging.DEBUG)
```

### Verify Configuration

```python
from langsmith import Client
import os

print("Configuration:")
print(f"  API Key: {'SET' if os.environ.get('LANGSMITH_API_KEY') else 'NOT SET'}")
print(f"  Endpoint: {os.environ.get('LANGSMITH_ENDPOINT', 'default')}")
print(f"  Project: {os.environ.get('LANGSMITH_PROJECT', 'default')}")
print(f"  Tracing: {os.environ.get('LANGSMITH_TRACING', 'not set')}")

# Test connection
client = Client()
try:
    info = client.info
    print(f"  Connected: Yes")
    print(f"  Version: {info}")
except Exception as e:
    print(f"  Connected: No ({e})")
```

### Test Simple Trace

```python
from langsmith import traceable
import os

os.environ["LANGSMITH_TRACING"] = "true"

@traceable
def test_trace():
    return "Hello, LangSmith!"

# Run and check LangSmith UI
result = test_trace()
print(f"Result: {result}")
print("Check LangSmith UI for trace")
```

## Getting Help

1. **Documentation**: https://docs.smith.langchain.com
2. **GitHub Issues**: https://github.com/langchain-ai/langsmith-sdk/issues
3. **Discord**: https://discord.gg/langchain
4. **Stack Overflow**: Tag `langsmith`

### Reporting Issues

Include:
- LangSmith SDK version: `pip show langsmith`
- Python version: `python --version`
- Full error traceback
- Minimal reproducible code
- Environment (local, cloud, etc.)
