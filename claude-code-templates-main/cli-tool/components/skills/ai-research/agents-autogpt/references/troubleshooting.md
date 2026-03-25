# AutoGPT Troubleshooting Guide

## Installation Issues

### Docker compose fails

**Error**: `Cannot connect to the Docker daemon`

**Fix**:
```bash
# Start Docker daemon
sudo systemctl start docker

# Or on macOS
open -a Docker

# Verify Docker is running
docker ps
```

**Error**: `Port already in use`

**Fix**:
```bash
# Find process using port
lsof -i :8006

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Database migration fails

**Error**: `Migration failed: relation already exists`

**Fix**:
```bash
# Reset database
docker compose down -v
docker compose up -d db

# Re-run migrations
cd backend
poetry run prisma migrate reset --force
poetry run prisma migrate deploy
```

**Error**: `Connection refused to database`

**Fix**:
```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

### Frontend build fails

**Error**: `Module not found: Can't resolve '@/components/...'`

**Fix**:
```bash
# Clear node modules and reinstall
rm -rf node_modules
rm -rf .next
npm install

# Or with pnpm
pnpm install --force
```

**Error**: `Supabase client not initialized`

**Fix**:
```bash
# Verify environment variables
cat .env | grep SUPABASE

# Required variables:
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## Service Issues

### Backend services not starting

**Error**: `rest_server exited with code 1`

**Diagnose**:
```bash
# Check logs
docker compose logs rest_server

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Redis connection failed
```

**Fix**:
```bash
# Verify all dependencies are running
docker compose ps

# Restart services in order
docker compose restart db redis rabbitmq
sleep 10
docker compose restart rest_server executor
```

### Executor not processing tasks

**Error**: Tasks stuck in QUEUED status

**Diagnose**:
```bash
# Check executor logs
docker compose logs executor

# Check RabbitMQ queue
# Visit http://localhost:15672 (guest/guest)
# Look at queue depths
```

**Fix**:
```bash
# Restart executor
docker compose restart executor

# If queue is backlogged, scale executors
docker compose up -d --scale executor=3
```

### WebSocket connection fails

**Error**: `WebSocket connection to 'ws://localhost:8001/ws' failed`

**Fix**:
```bash
# Check WebSocket server is running
docker compose logs websocket_server

# Verify port is accessible
nc -zv localhost 8001

# Check firewall rules
sudo ufw allow 8001
```

## Agent Execution Issues

### Agent stuck in running state

**Diagnose**:
```bash
# Check execution status via API
curl http://localhost:8006/api/v1/executions/{execution_id}

# Check node execution logs
docker compose logs executor | grep {execution_id}
```

**Fix**:
```python
# Cancel stuck execution via API
import requests

response = requests.post(
    f"http://localhost:8006/api/v1/executions/{execution_id}/cancel",
    headers={"Authorization": f"Bearer {token}"}
)
```

### LLM block timeout

**Error**: `TimeoutError: LLM call exceeded timeout`

**Fix**:
```python
# Increase timeout in block configuration
{
    "block_id": "llm-block",
    "config": {
        "timeout_seconds": 120,  # Increase from default 60
        "max_retries": 3
    }
}
```

### Credential errors

**Error**: `CredentialsNotFoundError: No credentials for provider openai`

**Fix**:
1. Navigate to Profile > Integrations
2. Add OpenAI API key
3. Ensure graph has credential mapping

```json
{
    "credential_mapping": {
        "openai": "user_credential_id"
    }
}
```

### Memory issues during execution

**Error**: `MemoryError` or container killed (OOMKilled)

**Fix**:
```yaml
# Increase memory limits in docker-compose.yml
executor:
    deploy:
        resources:
            limits:
                memory: 4G
            reservations:
                memory: 2G
```

## Graph/Block Issues

### Block not appearing in UI

**Diagnose**:
```python
# Check block registration
from backend.data.block import get_all_blocks

blocks = get_all_blocks()
print([b.name for b in blocks])
```

**Fix**:
```python
# Ensure block is imported in __init__.py
# backend/blocks/__init__.py
from backend.blocks.my_block import MyBlock

BLOCKS = [
    MyBlock,
    # ...
]
```

### Graph save fails

**Error**: `GraphValidationError: Invalid link configuration`

**Diagnose**:
```python
# Validate graph structure
from backend.data.graph import validate_graph

errors = validate_graph(graph_data)
print(errors)
```

**Fix**:
- Ensure all links connect valid nodes
- Check input/output name matches
- Verify required inputs are connected

### Circular dependency detected

**Error**: `GraphValidationError: Circular dependency in graph`

**Fix**:
```python
# Find cycle
import networkx as nx

G = nx.DiGraph()
for link in graph.links:
    G.add_edge(link.source_id, link.sink_id)

cycles = list(nx.simple_cycles(G))
print(f"Cycles found: {cycles}")
```

## Performance Issues

### Slow graph execution

**Diagnose**:
```python
# Profile execution
import cProfile

profiler = cProfile.Profile()
profiler.enable()
await executor.execute_graph(graph_id, inputs)
profiler.disable()
profiler.print_stats(sort='cumulative')
```

**Fix**:
- Parallelize independent nodes
- Reduce unnecessary API calls
- Cache repeated computations

### High database query latency

**Diagnose**:
```bash
# Enable query logging in PostgreSQL
docker exec -it autogpt-db psql -U postgres
\x
SHOW log_min_duration_statement;
SET log_min_duration_statement = 100;  -- Log queries > 100ms
```

**Fix**:
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_executions_user_created
ON "AgentGraphExecution" ("userId", "createdAt" DESC);

ANALYZE "AgentGraphExecution";
```

### Redis memory growing

**Diagnose**:
```bash
# Check Redis memory usage
docker exec -it autogpt-redis redis-cli INFO memory

# Check key count
docker exec -it autogpt-redis redis-cli DBSIZE
```

**Fix**:
```bash
# Clear expired keys
docker exec -it autogpt-redis redis-cli --scan --pattern "exec:*" | head -1000 | xargs docker exec -i autogpt-redis redis-cli DEL

# Set memory policy
docker exec -it autogpt-redis redis-cli CONFIG SET maxmemory-policy volatile-lru
```

## Debugging Tips

### Enable debug logging

```bash
# Set in .env
LOG_LEVEL=DEBUG

# Or for specific module
LOG_LEVEL_EXECUTOR=DEBUG
LOG_LEVEL_BLOCKS=DEBUG
```

### Trace execution flow

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("backend.executor")

# Add to executor
logger.debug(f"Executing node {node_id} with inputs: {inputs}")
```

### Test block in isolation

```python
import asyncio
from backend.blocks.my_block import MyBlock

async def test_block():
    block = MyBlock()
    inputs = {"query": "test"}

    async for output_name, value in block.execute(inputs):
        print(f"{output_name}: {value}")

asyncio.run(test_block())
```

### Inspect message queues

```bash
# RabbitMQ management UI
# http://localhost:15672 (guest/guest)

# List queues via CLI
docker exec autogpt-rabbitmq rabbitmqctl list_queues name messages consumers

# Purge a queue
docker exec autogpt-rabbitmq rabbitmqctl purge_queue graph-execution
```

## Getting Help

1. **Documentation**: https://docs.agpt.co
2. **GitHub Issues**: https://github.com/Significant-Gravitas/AutoGPT/issues
3. **Discord**: https://discord.gg/autogpt

### Reporting Issues

Include:
- AutoGPT version: `git describe --tags`
- Docker version: `docker --version`
- Error logs: `docker compose logs > logs.txt`
- Steps to reproduce
- Graph configuration (sanitized)
- Environment: OS, hardware specs
