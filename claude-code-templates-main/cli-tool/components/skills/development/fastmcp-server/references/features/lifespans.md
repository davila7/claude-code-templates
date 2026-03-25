# Lifespans

> Server-level setup and teardown with composable lifespans

Lifespans let you run code once when the server starts and clean up when it stops. Unlike per-session handlers, lifespans run exactly once regardless of how many clients connect.

## Basic Usage

Use the `@lifespan` decorator to define a lifespan:

```python
from fastmcp import FastMCP
from fastmcp.server.lifespan import lifespan

@lifespan
async def app_lifespan(server):
    # Setup: runs once when server starts
    print("Starting up...")
    try:
        yield {"started_at": "2024-01-01"}
    finally:
        # Teardown: runs when server stops
        print("Shutting down...")

mcp = FastMCP("MyServer", lifespan=app_lifespan)
```

The dict you yield becomes the **lifespan context**, accessible from tools.

> **Note:** Always use `try/finally` for cleanup code to ensure it runs even if the server is cancelled.


## Accessing Lifespan Context

Access the lifespan context in tools via `ctx.lifespan_context`:

```python
from fastmcp import FastMCP, Context
from fastmcp.server.lifespan import lifespan

@lifespan
async def app_lifespan(server):
    # Initialize shared state
    data = {"users": ["alice", "bob"]}
    yield {"data": data}

mcp = FastMCP("MyServer", lifespan=app_lifespan)

@mcp.tool
def list_users(ctx: Context) -> list[str]:
    data = ctx.lifespan_context["data"]
    return data["users"]
```

## Composing Lifespans

Compose multiple lifespans with the `|` operator:

```python
from fastmcp import FastMCP
from fastmcp.server.lifespan import lifespan

@lifespan
async def config_lifespan(server):
    config = {"debug": True, "version": "1.0"}
    yield {"config": config}

@lifespan
async def data_lifespan(server):
    data = {"items": []}
    yield {"data": data}

# Compose with |
mcp = FastMCP("MyServer", lifespan=config_lifespan | data_lifespan)
```

Composed lifespans:

* Enter in order (left to right)
* Exit in reverse order (right to left)
* Merge their context dicts (later values overwrite earlier on conflict)

## Backwards Compatibility

Existing `@asynccontextmanager` lifespans still work when passed directly to FastMCP:

```python
from contextlib import asynccontextmanager
from fastmcp import FastMCP

@asynccontextmanager
async def legacy_lifespan(server):
    yield {"key": "value"}

mcp = FastMCP("MyServer", lifespan=legacy_lifespan)
```

To compose an `@asynccontextmanager` function with `@lifespan` functions, wrap it with `ContextManagerLifespan`:

```python
from contextlib import asynccontextmanager
from fastmcp.server.lifespan import lifespan, ContextManagerLifespan

@asynccontextmanager
async def legacy_lifespan(server):
    yield {"legacy": True}

@lifespan
async def new_lifespan(server):
    yield {"new": True}

# Wrap the legacy lifespan explicitly for composition
combined = ContextManagerLifespan(legacy_lifespan) | new_lifespan
```

## With FastAPI

When mounting FastMCP into FastAPI, use `combine_lifespans` to run both your app's lifespan and the MCP server's lifespan:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.utilities.lifespan import combine_lifespans

@asynccontextmanager
async def app_lifespan(app):
    print("FastAPI starting...")
    yield
    print("FastAPI shutting down...")

mcp = FastMCP("Tools")
mcp_app = mcp.http_app()

app = FastAPI(lifespan=combine_lifespans(app_lifespan, mcp_app.lifespan))
app.mount("/mcp", mcp_app)
```

See the FastAPI integration guide for full details.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
