# Phoenix Troubleshooting Guide

## Installation Issues

### Package Not Found

**Error**: `ModuleNotFoundError: No module named 'phoenix'`

**Fix**:
```bash
pip install arize-phoenix

# Verify installation
python -c "import phoenix as px; print(px.__version__)"
```

### Dependency Conflicts

**Error**: `ImportError: cannot import name 'X' from 'Y'`

**Fix**:
```bash
# Create clean environment
python -m venv venv
source venv/bin/activate

# Install Phoenix
pip install arize-phoenix

# If using specific features
pip install arize-phoenix[embeddings]
pip install arize-phoenix-otel
pip install arize-phoenix-evals
```

### Version Conflicts with OpenTelemetry

**Error**: `ImportError: cannot import name 'TracerProvider'`

**Fix**:
```bash
# Ensure compatible versions
pip install opentelemetry-api>=1.20.0
pip install opentelemetry-sdk>=1.20.0
pip install arize-phoenix-otel
```

## Server Issues

### Port Already in Use

**Error**: `OSError: [Errno 48] Address already in use`

**Fix**:
```bash
# Find process using port
lsof -i :6006

# Kill the process
kill -9 <PID>

# Or use different port
phoenix serve --port 6007
```

### Database Connection Failed

**Error**: `sqlalchemy.exc.OperationalError: could not connect to server`

**Fix**:
```bash
# For PostgreSQL, verify connection
psql $PHOENIX_SQL_DATABASE_URL -c "SELECT 1"

# Check environment variable
echo $PHOENIX_SQL_DATABASE_URL

# For SQLite, check permissions
ls -la $PHOENIX_WORKING_DIR
```

### Server Crashes on Startup

**Error**: `RuntimeError: Event loop is closed`

**Fix**:
```python
# In notebooks, ensure proper async handling
import nest_asyncio
nest_asyncio.apply()

import phoenix as px
session = px.launch_app()
```

### Memory Issues

**Error**: `MemoryError` or server becomes slow

**Fix**:
```bash
# Increase available memory in Docker
docker run -m 4g arizephoenix/phoenix:latest

# Or clean up old data
from phoenix import Client
client = Client()
# Delete old traces (see advanced-usage.md for cleanup script)
```

## Tracing Issues

### Traces Not Appearing

**Problem**: Instrumented code runs but no traces in Phoenix

**Solutions**:

1. **Verify endpoint**:
```python
from phoenix.otel import register

# Ensure correct endpoint
tracer_provider = register(
    project_name="my-app",
    endpoint="http://localhost:6006/v1/traces"  # Include /v1/traces
)
```

2. **Force flush traces**:
```python
from opentelemetry import trace

# Force send pending traces
trace.get_tracer_provider().force_flush()
```

3. **Check Phoenix is running**:
```bash
curl http://localhost:6006/healthz
# Should return 200 OK
```

4. **Enable debug logging**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)

from phoenix.otel import register
tracer_provider = register(project_name="debug-test")
```

### Missing Spans in Trace

**Problem**: Parent trace exists but child spans missing

**Fix**:
```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

# Ensure spans are properly nested
with tracer.start_as_current_span("parent") as parent_span:
    # Child spans must be created within parent context
    with tracer.start_as_current_span("child"):
        do_something()
```

### Instrumentation Not Working

**Problem**: Framework calls not being traced

**Fix**:
```python
from phoenix.otel import register
from openinference.instrumentation.openai import OpenAIInstrumentor

# Must register BEFORE instrumenting
tracer_provider = register(project_name="my-app")

# Pass tracer_provider to instrumentor
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# Now import and use the SDK
from openai import OpenAI
client = OpenAI()
```

### Duplicate Traces

**Problem**: Same trace appearing multiple times

**Fix**:
```python
# Ensure instrumentor only called once
from openinference.instrumentation.openai import OpenAIInstrumentor

# Check if already instrumented
if not OpenAIInstrumentor().is_instrumented:
    OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Evaluation Issues

### Evaluator Returns None

**Error**: `AttributeError: 'NoneType' object has no attribute`

**Fix**:
```python
from phoenix.evals import OpenAIModel, llm_classify

# Ensure model is properly configured
eval_model = OpenAIModel(
    model="gpt-4o",
    api_key=os.environ.get("OPENAI_API_KEY")  # Explicit key
)

# Add error handling
try:
    result = llm_classify(
        model=eval_model,
        template=template,
        input=input_text,
        output=output_text,
        rails=["good", "bad"]
    )
except Exception as e:
    print(f"Evaluation failed: {e}")
    result = None
```

### Rate Limiting During Evaluation

**Error**: `RateLimitError: Rate limit exceeded`

**Fix**:
```python
from phoenix.evals import run_evals
import time

# Reduce concurrency
eval_results = run_evals(
    dataframe=spans_df,
    evaluators=[evaluator],
    concurrency=2  # Lower concurrency
)

# Or add retry logic
from tenacity import retry, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=4, max=60))
def evaluate_with_retry(input_text, output_text):
    return evaluator.evaluate(input_text, output_text)
```

### Evaluation Results Not Logging

**Problem**: Evaluations complete but don't appear in Phoenix

**Fix**:
```python
from phoenix import Client

client = Client()

# Ensure results are logged correctly
eval_results = run_evals(
    dataframe=spans_df,
    evaluators=[evaluator]
)

# Explicitly log evaluations
client.log_evaluations(
    project_name="my-app",
    evaluations=eval_results
)
```

## Client Issues

### Connection Refused

**Error**: `ConnectionRefusedError: [Errno 111] Connection refused`

**Fix**:
```python
from phoenix import Client

# Verify Phoenix is running
import requests
try:
    response = requests.get("http://localhost:6006/healthz")
    print(f"Phoenix status: {response.status_code}")
except:
    print("Phoenix not running")

# Use correct endpoint
client = Client(endpoint="http://localhost:6006")  # No /v1 for client
```

### Authentication Failed

**Error**: `401 Unauthorized`

**Fix**:
```python
from phoenix import Client

# If auth is enabled, provide API key
client = Client(
    endpoint="http://localhost:6006",
    api_key="your-api-key"  # Or use headers
)

# Or set environment variable
import os
os.environ["PHOENIX_API_KEY"] = "your-api-key"
client = Client()
```

### Timeout Errors

**Error**: `TimeoutError: Connection timed out`

**Fix**:
```python
from phoenix import Client

# Increase timeout
client = Client(
    endpoint="http://localhost:6006",
    timeout=60  # Seconds
)

# For large queries, use pagination
spans_df = client.get_spans_dataframe(
    project_name="my-app",
    limit=100,  # Smaller batches
    offset=0
)
```

## Database Issues

### PostgreSQL Connection Issues

**Error**: `psycopg2.OperationalError: FATAL: password authentication failed`

**Fix**:
```bash
# Verify credentials
psql "postgresql://user:pass@host:5432/phoenix"

# Check database exists
psql -h host -U user -c "SELECT datname FROM pg_database"

# Ensure correct URL format
export PHOENIX_SQL_DATABASE_URL="postgresql://user:pass@host:5432/phoenix"
```

### Migration Errors

**Error**: `alembic.util.exc.CommandError: Can't locate revision`

**Fix**:
```bash
# Reset migrations (WARNING: data loss)
# For development only
rm -rf $PHOENIX_WORKING_DIR/phoenix.db

# Restart Phoenix - will create fresh database
phoenix serve
```

### SQLite Lock Errors

**Error**: `sqlite3.OperationalError: database is locked`

**Fix**:
```python
# Ensure only one Phoenix instance
# Kill other Phoenix processes
pkill -f "phoenix serve"

# Or use PostgreSQL for concurrent access
export PHOENIX_SQL_DATABASE_URL="postgresql://..."
```

## UI Issues

### UI Not Loading

**Problem**: Phoenix server running but UI blank

**Fix**:
```bash
# Check if static files are served
curl http://localhost:6006/

# Verify server logs
phoenix serve --log-level debug

# Clear browser cache and try incognito mode
```

### Graphs Not Rendering

**Problem**: Dashboard shows but charts are empty

**Fix**:
```python
# Verify data exists
from phoenix import Client
client = Client()

spans = client.get_spans_dataframe(project_name="my-app")
print(f"Found {len(spans)} spans")

# Check project name matches
projects = client.list_projects()
print(f"Available projects: {[p.name for p in projects]}")
```

## Performance Issues

### Slow Query Performance

**Problem**: Getting spans takes too long

**Fix**:
```python
# Use filters to reduce data
spans_df = client.get_spans_dataframe(
    project_name="my-app",
    filter_condition="span_kind == 'LLM'",  # Filter
    limit=1000,  # Limit results
    start_time=datetime.now() - timedelta(days=1)  # Time range
)
```

### High Memory Usage

**Problem**: Phoenix using too much memory

**Fix**:
```bash
# For production, use PostgreSQL instead of SQLite
export PHOENIX_SQL_DATABASE_URL="postgresql://..."

# Set data retention
export PHOENIX_TRACE_RETENTION_DAYS=30

# Or manually clean old data
```

### Slow Trace Ingestion

**Problem**: Traces taking long to appear

**Fix**:
```python
# Check if bulk inserter is backing up
# Look for warnings in Phoenix logs

# Reduce trace volume
from phoenix.otel import register

tracer_provider = register(
    project_name="my-app",
    # Sample traces
    sampler=TraceIdRatioBased(0.1)  # 10% sampling
)
```

## Debugging Tips

### Enable Debug Logging

```python
import logging

# Phoenix debug logging
logging.getLogger("phoenix").setLevel(logging.DEBUG)

# OpenTelemetry debug logging
logging.getLogger("opentelemetry").setLevel(logging.DEBUG)
```

### Verify Configuration

```python
import os

print("Phoenix Configuration:")
print(f"  PHOENIX_PORT: {os.environ.get('PHOENIX_PORT', '6006')}")
print(f"  PHOENIX_HOST: {os.environ.get('PHOENIX_HOST', '127.0.0.1')}")
print(f"  PHOENIX_SQL_DATABASE_URL: {'SET' if os.environ.get('PHOENIX_SQL_DATABASE_URL') else 'NOT SET'}")
print(f"  PHOENIX_ENABLE_AUTH: {os.environ.get('PHOENIX_ENABLE_AUTH', 'false')}")
```

### Test Basic Connectivity

```python
import requests

# Test Phoenix server
try:
    r = requests.get("http://localhost:6006/healthz")
    print(f"Health check: {r.status_code}")
except Exception as e:
    print(f"Failed to connect: {e}")

# Test OTLP endpoint
try:
    r = requests.post("http://localhost:6006/v1/traces", json={})
    print(f"OTLP endpoint: {r.status_code}")
except Exception as e:
    print(f"OTLP failed: {e}")
```

## Getting Help

1. **Documentation**: https://docs.arize.com/phoenix
2. **GitHub Issues**: https://github.com/Arize-ai/phoenix/issues
3. **Discord**: https://discord.gg/arize
4. **Stack Overflow**: Tag `arize-phoenix`

### Reporting Issues

Include:
- Phoenix version: `pip show arize-phoenix`
- Python version: `python --version`
- Full error traceback
- Minimal reproducible code
- Environment (local, Docker, Kubernetes)
- Database type (SQLite/PostgreSQL)
