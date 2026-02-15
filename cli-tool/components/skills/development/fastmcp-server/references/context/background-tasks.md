# Background Tasks

> Run long-running operations asynchronously with progress tracking

> **Tip:** Background tasks require the `tasks` optional extra. See [installation instructions](#enabling-background-tasks) below.


FastMCP implements the MCP background task protocol ([SEP-1686](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)), giving your servers a production-ready distributed task scheduler with a single decorator change.

> **Tip:** **What is Docket?** FastMCP's task system is powered by [Docket](https://github.com/chrisguidry/docket), originally built by [Prefect](https://prefect.io) to power [Prefect Cloud](https://www.prefect.io/prefect/cloud)'s managed task scheduling and execution service, where it processes millions of concurrent tasks every day. Docket is now open-sourced for the community.


## What Are MCP Background Tasks?

In MCP, all component interactions are blocking by default. When a client calls a tool, reads a resource, or fetches a prompt, it sends a request and waits for the response. For operations that take seconds or minutes, this creates a poor user experience.

The MCP background task protocol solves this by letting clients:

1. **Start** an operation and receive a task ID immediately
2. **Track** progress as the operation runs
3. **Retrieve** the result when ready

FastMCP handles all of this for you. Add `task=True` to your decorator, and your function gains full background execution with progress reporting, distributed processing, and horizontal scaling.

### MCP Background Tasks vs Python Concurrency

You can always use Python's concurrency primitives (asyncio, threads, multiprocessing) or external task queues in your FastMCP servers. FastMCP is just Python—run code however you like.

MCP background tasks are different: they're **protocol-native**. This means MCP clients that support the task protocol can start operations, receive progress updates, and retrieve results through the standard MCP interface. The coordination happens at the protocol level, not inside your application code.

## Enabling Background Tasks

Background tasks require the `tasks` extra:

```bash
pip install "fastmcp[tasks]>=3.0.0rc1"
```

Add `task=True` to any tool, resource, resource template, or prompt decorator. This marks the component as capable of background execution.

```python}
import asyncio
from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool(task=True)
async def slow_computation(duration: int) -> str:
    """A long-running operation."""
    for i in range(duration):
        await asyncio.sleep(1)
    return f"Completed in {duration} seconds"
```

When a client requests background execution, the call returns immediately with a task ID. The work executes in a background worker, and the client can poll for status or wait for the result.

> **Warning:** Background tasks require async functions. Attempting to use `task=True` with a sync function raises a `ValueError` at registration time.


## Execution Modes

For fine-grained control over task execution behavior, use `TaskConfig` instead of the boolean shorthand. The MCP task protocol defines three execution modes:

| Mode          | Client calls without task | Client calls with task      |
| ------------- | ------------------------- | --------------------------- |
| `"forbidden"` | Executes synchronously    | Error: task not supported   |
| `"optional"`  | Executes synchronously    | Executes as background task |
| `"required"`  | Error: task required      | Executes as background task |

```python
from fastmcp import FastMCP
from fastmcp.server.tasks import TaskConfig

mcp = FastMCP("MyServer")

# Supports both sync and background execution (default when task=True)
@mcp.tool(task=TaskConfig(mode="optional"))
async def flexible_task() -> str:
    return "Works either way"

# Requires background execution - errors if client doesn't request task
@mcp.tool(task=TaskConfig(mode="required"))
async def must_be_background() -> str:
    return "Only runs as a background task"

# No task support (default when task=False or omitted)
@mcp.tool(task=TaskConfig(mode="forbidden"))
async def sync_only() -> str:
    return "Never runs as background task"
```

The boolean shortcuts map to these modes:

* `task=True` → `TaskConfig(mode="optional")`
* `task=False` → `TaskConfig(mode="forbidden")`

### Poll Interval

When clients poll for task status, the server tells them how frequently to check back. By default, FastMCP suggests a 5-second interval, but you can customize this per component:

```python
from datetime import timedelta
from fastmcp import FastMCP
from fastmcp.server.tasks import TaskConfig

mcp = FastMCP("MyServer")

# Poll every 2 seconds for a fast-completing task
@mcp.tool(task=TaskConfig(mode="optional", poll_interval=timedelta(seconds=2)))
async def quick_task() -> str:
    return "Done quickly"

# Poll every 30 seconds for a long-running task
@mcp.tool(task=TaskConfig(mode="optional", poll_interval=timedelta(seconds=30)))
async def slow_task() -> str:
    return "Eventually done"
```

Shorter intervals give clients faster feedback but increase server load. Longer intervals reduce load but delay status updates.

### Server-Wide Default

To enable background task support for all components by default, pass `tasks=True` to the constructor. Individual decorators can still override this with `task=False`.

```python
mcp = FastMCP("MyServer", tasks=True)
```

> **Warning:** If your server defines any synchronous tools, resources, or prompts, you will need to explicitly set `task=False` on their decorators to avoid an error.


### Graceful Degradation

When a client requests background execution but the component has `mode="forbidden"`, FastMCP executes synchronously and returns the result inline. This follows the SEP-1686 specification for graceful degradation—clients can always request background execution without worrying about server capabilities.

Conversely, when a component has `mode="required"` but the client doesn't request background execution, FastMCP returns an error indicating that task execution is required.

### Configuration

| Environment Variable | Default     | Description                                         |
| -------------------- | ----------- | --------------------------------------------------- |
| `FASTMCP_DOCKET_URL` | `memory://` | Backend URL (`memory://` or `redis://host:port/db`) |

## Backends

FastMCP supports two backends for task execution, each with different tradeoffs.

### In-Memory Backend (Default)

The in-memory backend (`memory://`) requires zero configuration and works out of the box.

**Advantages:**

* No external dependencies
* Simple single-process deployment

**Disadvantages:**

* **Ephemeral**: If the server restarts, all pending tasks are lost
* **Higher latency**: \~250ms task pickup time vs single-digit milliseconds with Redis
* **No horizontal scaling**: Single process only—you cannot add additional workers

### Redis Backend

For production deployments, use Redis (or Valkey) as your backend by setting `FASTMCP_DOCKET_URL=redis://localhost:6379`.

**Advantages:**

* **Persistent**: Tasks survive server restarts
* **Fast**: Single-digit millisecond task pickup latency
* **Scalable**: Add workers to distribute load across processes or machines

## Workers

Every FastMCP server with task-enabled components automatically starts an **embedded worker**. You do not need to start a separate worker process for tasks to execute.

To scale horizontally, add more workers using the CLI:

```bash
fastmcp tasks worker server.py
```

Each additional worker pulls tasks from the same queue, distributing load across processes. Configure worker concurrency via environment:

```bash
export FASTMCP_DOCKET_CONCURRENCY=20
fastmcp tasks worker server.py
```

> **Note:** Additional workers only work with Redis/Valkey backends. The in-memory backend is single-process only.


> **Warning:** Task-enabled components must be defined at server startup to be registered with all workers. Components added dynamically after the server starts will not be available for background execution.


## Progress Reporting

The `Progress` dependency lets you report progress back to clients. Inject it as a parameter with a default value, and FastMCP will provide the active progress reporter.

```python
from fastmcp import FastMCP
from fastmcp.dependencies import Progress

mcp = FastMCP("MyServer")

@mcp.tool(task=True)
async def process_files(files: list[str], progress: Progress = Progress()) -> str:
    await progress.set_total(len(files))

    for file in files:
        await progress.set_message(f"Processing {file}")
        # ... do work ...
        await progress.increment()

    return f"Processed {len(files)} files"
```

The progress API:

* `await progress.set_total(n)` — Set the total number of steps
* `await progress.increment(amount=1)` — Increment progress
* `await progress.set_message(text)` — Update the status message

Progress works in both immediate and background execution modes—you can use the same code regardless of how the client invokes your function.

## Docket Dependencies

FastMCP exposes Docket's full dependency injection system within your task-enabled functions. Beyond `Progress`, you can access the Docket instance, worker information, and use advanced features like retries and timeouts.

```python
from docket import Docket, Worker
from fastmcp import FastMCP
from fastmcp.dependencies import Progress, CurrentDocket, CurrentWorker

mcp = FastMCP("MyServer")

@mcp.tool(task=True)
async def my_task(
    progress: Progress = Progress(),
    docket: Docket = CurrentDocket(),
    worker: Worker = CurrentWorker(),
) -> str:
    # Schedule additional background work
    await docket.add(another_task, arg1, arg2)

    # Access worker metadata
    worker_name = worker.name

    return "Done"
```

With `CurrentDocket()`, you can schedule additional background tasks, chain work together, and coordinate complex workflows. See the [Docket documentation](https://chrisguidry.github.io/docket/) for the complete API, including retry policies, timeouts, and custom dependencies.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
