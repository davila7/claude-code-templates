# AutoGPT Advanced Usage Guide

## Custom Block Development

### Block structure

```python
from backend.data.block import Block, BlockSchema, BlockType
from pydantic import BaseModel

class MyBlockInput(BaseModel):
    """Input schema for the block."""
    query: str
    max_results: int = 10

class MyBlockOutput(BaseModel):
    """Output schema for the block."""
    results: list[str]
    count: int

class MyCustomBlock(Block):
    """Custom block for specific functionality."""

    id = "my-custom-block-uuid"
    name = "My Custom Block"
    description = "Does something specific"
    block_type = BlockType.STANDARD

    input_schema = MyBlockInput
    output_schema = MyBlockOutput

    async def execute(self, input_data: MyBlockInput) -> dict:
        """Execute the block logic."""
        # Implement your logic
        results = await self.process(input_data.query, input_data.max_results)

        yield "results", results
        yield "count", len(results)

    async def process(self, query: str, max_results: int) -> list[str]:
        """Internal processing logic."""
        # Implementation
        return ["result1", "result2"]
```

### Block registration

```python
# backend/blocks/__init__.py
from backend.blocks.my_block import MyCustomBlock

# Add to block registry
BLOCKS = [
    MyCustomBlock,
    # ... other blocks
]
```

### Block with credentials

```python
from backend.data.block import Block
from backend.integrations.providers import ProviderName

class APIIntegrationBlock(Block):
    """Block that uses external API credentials."""

    credentials_required = [ProviderName.OPENAI]

    async def execute(self, input_data):
        # Get credentials from the system
        credentials = await self.get_credentials(ProviderName.OPENAI)

        # Use credentials
        client = OpenAI(api_key=credentials.api_key)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": input_data.prompt}]
        )

        yield "response", response.choices[0].message.content
```

### Block with cost tracking

```python
from backend.data.block import Block
from backend.data.block_cost_config import BlockCostConfig

class LLMBlock(Block):
    """Block with cost tracking."""

    cost_config = BlockCostConfig(
        cost_type="token",
        cost_per_unit=0.00002,  # Per token
        provider="openai"
    )

    async def execute(self, input_data):
        response = await self.call_llm(input_data.prompt)

        # Report token usage for cost tracking
        self.report_usage(
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens
        )

        yield "output", response.content
```

## Advanced Execution Patterns

### Parallel node execution

```python
from backend.executor.manager import ExecutionManager

async def execute_parallel_nodes(graph_exec_id: str, node_ids: list[str]):
    """Execute multiple nodes in parallel."""
    manager = ExecutionManager()

    tasks = [
        manager.execute_node(graph_exec_id, node_id)
        for node_id in node_ids
    ]

    results = await asyncio.gather(*tasks)
    return results
```

### Conditional branching

```python
from backend.blocks.branching import BranchingBlock

class SmartBranchBlock(BranchingBlock):
    """Advanced conditional branching."""

    async def execute(self, input_data):
        condition = await self.evaluate_condition(input_data)

        if condition == "path_a":
            yield "output_a", input_data.value
        elif condition == "path_b":
            yield "output_b", input_data.value
        else:
            yield "output_default", input_data.value
```

### Loop execution

```python
class LoopBlock(Block):
    """Execute a subgraph in a loop."""

    async def execute(self, input_data):
        items = input_data.items
        results = []

        for i, item in enumerate(items):
            # Execute nested graph for each item
            result = await self.execute_subgraph(
                graph_id=input_data.subgraph_id,
                inputs={"item": item, "index": i}
            )
            results.append(result)

            yield "progress", f"Processed {i+1}/{len(items)}"

        yield "results", results
```

## Graph composition

### Nested agents

```python
from backend.blocks.agent import AgentExecutorBlock

class ParentAgentBlock(Block):
    """Execute child agents within a parent agent."""

    async def execute(self, input_data):
        # Execute child agent
        child_result = await self.execute_agent(
            agent_id=input_data.child_agent_id,
            inputs={"query": input_data.query}
        )

        # Process child result
        processed = await self.process_result(child_result)

        yield "output", processed
```

### Dynamic graph construction

```python
from backend.data.graph import GraphModel, NodeModel, LinkModel

async def create_dynamic_graph(user_id: str, template: str):
    """Create a graph dynamically based on template."""
    graph = GraphModel(
        name=f"Dynamic Graph - {template}",
        description="Auto-generated graph",
        user_id=user_id
    )

    # Add nodes based on template
    nodes = []
    if template == "research":
        nodes = [
            NodeModel(block_id="search-block", position={"x": 0, "y": 0}),
            NodeModel(block_id="summarize-block", position={"x": 200, "y": 0}),
            NodeModel(block_id="output-block", position={"x": 400, "y": 0})
        ]
    elif template == "code-review":
        nodes = [
            NodeModel(block_id="github-block", position={"x": 0, "y": 0}),
            NodeModel(block_id="review-block", position={"x": 200, "y": 0}),
            NodeModel(block_id="comment-block", position={"x": 400, "y": 0})
        ]

    graph.nodes = nodes

    # Create links between nodes
    for i in range(len(nodes) - 1):
        graph.links.append(LinkModel(
            source_id=nodes[i].id,
            sink_id=nodes[i+1].id,
            source_name="output",
            sink_name="input"
        ))

    return await graph.save()
```

## Production deployment

### Kubernetes deployment

```yaml
# autogpt-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autogpt-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autogpt-backend
  template:
    metadata:
      labels:
        app: autogpt-backend
    spec:
      containers:
      - name: rest-server
        image: autogpt/platform-backend:latest
        command: ["poetry", "run", "rest"]
        ports:
        - containerPort: 8006
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: autogpt-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autogpt-executor
spec:
  replicas: 5
  selector:
    matchLabels:
      app: autogpt-executor
  template:
    spec:
      containers:
      - name: executor
        image: autogpt/platform-backend:latest
        command: ["poetry", "run", "executor"]
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
```

### Horizontal scaling

```yaml
# autogpt-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: autogpt-executor-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: autogpt-executor
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: External
    external:
      metric:
        name: rabbitmq_queue_messages
        selector:
          matchLabels:
            queue: graph-execution
      target:
        type: AverageValue
        averageValue: 10
```

### Database optimization

```sql
-- Optimize for high-volume execution tracking
CREATE INDEX CONCURRENTLY idx_node_exec_graph_status
ON "AgentNodeExecution" ("graphExecutionId", "executionStatus");

CREATE INDEX CONCURRENTLY idx_graph_exec_user_status
ON "AgentGraphExecution" ("userId", "executionStatus", "createdAt" DESC);

-- Partition execution tables by date
CREATE TABLE "AgentGraphExecution_partitioned" (
    LIKE "AgentGraphExecution" INCLUDING ALL
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions
CREATE TABLE "AgentGraphExecution_2024_01"
PARTITION OF "AgentGraphExecution_partitioned"
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Monitoring and observability

### Prometheus metrics

```python
from prometheus_client import Counter, Histogram, Gauge

# Define metrics
EXECUTIONS_TOTAL = Counter(
    'autogpt_executions_total',
    'Total graph executions',
    ['graph_id', 'status']
)

EXECUTION_DURATION = Histogram(
    'autogpt_execution_duration_seconds',
    'Execution duration in seconds',
    ['graph_id'],
    buckets=[0.1, 0.5, 1, 5, 10, 30, 60, 120]
)

ACTIVE_EXECUTIONS = Gauge(
    'autogpt_active_executions',
    'Currently running executions'
)

# Use in executor
class ExecutionManager:
    async def execute_graph(self, graph_id, inputs):
        ACTIVE_EXECUTIONS.inc()
        start_time = time.time()

        try:
            result = await self._execute(graph_id, inputs)
            EXECUTIONS_TOTAL.labels(graph_id=graph_id, status='success').inc()
            return result
        except Exception as e:
            EXECUTIONS_TOTAL.labels(graph_id=graph_id, status='failed').inc()
            raise
        finally:
            ACTIVE_EXECUTIONS.dec()
            EXECUTION_DURATION.labels(graph_id=graph_id).observe(
                time.time() - start_time
            )
```

### Grafana dashboard

```json
{
  "dashboard": {
    "title": "AutoGPT Platform",
    "panels": [
      {
        "title": "Executions per Minute",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(autogpt_executions_total[1m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Execution Latency (p95)",
        "type": "gauge",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(autogpt_execution_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Active Executions",
        "type": "stat",
        "targets": [
          {"expr": "autogpt_active_executions"}
        ]
      }
    ]
  }
}
```

### Sentry error tracking

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    integrations=[
        FastApiIntegration(),
        AsyncioIntegration(),
    ],
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    environment=os.environ.get("APP_ENV", "development")
)

# Custom error context
with sentry_sdk.push_scope() as scope:
    scope.set_tag("graph_id", graph_id)
    scope.set_extra("inputs", sanitized_inputs)
    sentry_sdk.capture_exception(error)
```

## API integration patterns

### Webhook handling

```python
from fastapi import APIRouter, Request
from backend.data.webhook import WebhookHandler

router = APIRouter()

@router.post("/webhooks/{webhook_id}")
async def handle_webhook(webhook_id: str, request: Request):
    """Handle incoming webhook."""
    handler = WebhookHandler()

    # Verify webhook signature
    signature = request.headers.get("X-Webhook-Signature")
    if not await handler.verify_signature(webhook_id, signature, await request.body()):
        return {"error": "Invalid signature"}, 401

    # Parse payload
    payload = await request.json()

    # Trigger associated graph
    execution = await handler.trigger_graph(webhook_id, payload)

    return {
        "execution_id": execution.id,
        "status": "queued"
    }
```

### External API rate limiting

```python
from asyncio import Semaphore
from functools import wraps

class RateLimiter:
    """Rate limiter for external API calls."""

    def __init__(self, max_concurrent: int = 10, rate_per_second: float = 5):
        self.semaphore = Semaphore(max_concurrent)
        self.rate = rate_per_second
        self.last_call = 0

    async def acquire(self):
        await self.semaphore.acquire()
        now = time.time()
        wait_time = max(0, (1 / self.rate) - (now - self.last_call))
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        self.last_call = time.time()

    def release(self):
        self.semaphore.release()

# Usage in block
class RateLimitedAPIBlock(Block):
    rate_limiter = RateLimiter(max_concurrent=5, rate_per_second=2)

    async def execute(self, input_data):
        await self.rate_limiter.acquire()
        try:
            result = await self.call_api(input_data)
            yield "output", result
        finally:
            self.rate_limiter.release()
```
