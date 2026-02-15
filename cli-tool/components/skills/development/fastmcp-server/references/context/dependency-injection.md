# Dependency Injection

> Inject runtime values like HTTP requests, access tokens, and custom dependencies into your MCP components.

FastMCP uses dependency injection to provide runtime values to your tools, resources, and prompts. Instead of passing context through every layer of your code, you declare what you need as parameter defaults—FastMCP resolves them automatically when your function runs.

The dependency injection system is powered by [Docket](https://github.com/chrisguidry/docket). Core DI features like `Depends()` and `CurrentContext()` work without installing Docket. For background tasks and advanced task-related dependencies, install `fastmcp[tasks]`. For comprehensive coverage of dependency patterns, see the [Docket dependency documentation](https://chrisguidry.github.io/docket/dependencies/).

> **Note:** Dependency parameters are automatically excluded from the MCP schema—clients never see them as callable parameters. This separation keeps your function signatures clean while giving you access to the runtime context you need.


## How Dependency Injection Works

Dependency injection in FastMCP follows a simple pattern: declare a parameter with a recognized type annotation or a dependency default value, and FastMCP injects the resolved value at runtime.

```python
from fastmcp import FastMCP
from fastmcp.server.context import Context

mcp = FastMCP("Demo")


@mcp.tool
async def my_tool(query: str, ctx: Context) -> str:
    await ctx.info(f"Processing: {query}")
    return f"Results for: {query}"
```

When a client calls `my_tool`, they only see `query` as a parameter. The `ctx` parameter is injected automatically because it has a `Context` type annotation—FastMCP recognizes this and provides the active context for the request.

This works identically for tools, resources, resource templates, and prompts.

### Explicit Dependencies with CurrentContext

For more explicit code, you can use `CurrentContext()` as a default value instead of relying on the type annotation:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentContext
from fastmcp.server.context import Context

mcp = FastMCP("Demo")


@mcp.tool
async def my_tool(query: str, ctx: Context = CurrentContext()) -> str:
    await ctx.info(f"Processing: {query}")
    return f"Results for: {query}"
```

Both approaches work identically. The type-annotation approach is more concise; the explicit `CurrentContext()` approach makes the dependency injection visible in the signature.

## Built-in Dependencies

### MCP Context

The MCP Context provides logging, progress reporting, resource access, and other request-scoped operations. See MCP Context for the full API.

**Dependency injection:** Use a `Context` type annotation (FastMCP injects automatically) or `CurrentContext()`:

```python
from fastmcp import FastMCP
from fastmcp.server.context import Context

mcp = FastMCP("Demo")


@mcp.tool
async def process_data(data: str, ctx: Context) -> str:
    await ctx.info(f"Processing: {data}")
    return "Done"


# Or explicitly with CurrentContext()
from fastmcp.dependencies import CurrentContext

@mcp.tool
async def process_data(data: str, ctx: Context = CurrentContext()) -> str:
    ...
```

**Function:** Use `get_context()` in helper functions or middleware:

```python
from fastmcp.server.dependencies import get_context

async def log_something(message: str):
    ctx = get_context()
    await ctx.info(message)
```

### Server Instance

Access the FastMCP server instance for introspection or server-level configuration.

**Dependency injection:** Use `CurrentFastMCP()`:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentFastMCP

mcp = FastMCP("Demo")


@mcp.tool
async def server_info(server: FastMCP = CurrentFastMCP()) -> str:
    return f"Server: {server.name}"
```

**Function:** Use `get_server()`:

```python
from fastmcp.server.dependencies import get_server

def get_server_name() -> str:
    return get_server().name
```

### HTTP Request

Access the Starlette Request when running over HTTP transports (SSE or Streamable HTTP).

**Dependency injection:** Use `CurrentRequest()`:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentRequest
from starlette.requests import Request

mcp = FastMCP("Demo")


@mcp.tool
async def client_info(request: Request = CurrentRequest()) -> dict:
    return {
        "user_agent": request.headers.get("user-agent", "Unknown"),
        "client_ip": request.client.host if request.client else "Unknown",
    }
```

**Function:** Use `get_http_request()`:

```python
from fastmcp.server.dependencies import get_http_request

def get_client_ip() -> str:
    request = get_http_request()
    return request.client.host if request.client else "Unknown"
```

> **Note:** Both raise `RuntimeError` when called outside an HTTP context (e.g., STDIO transport). Use HTTP Headers if you need graceful fallback.


### HTTP Headers

Access HTTP headers with graceful fallback—returns an empty dictionary when no HTTP request is available, making it safe for code that might run over any transport.

**Dependency injection:** Use `CurrentHeaders()`:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentHeaders

mcp = FastMCP("Demo")


@mcp.tool
async def get_auth_type(headers: dict = CurrentHeaders()) -> str:
    auth = headers.get("authorization", "")
    return "Bearer" if auth.startswith("Bearer ") else "None"
```

**Function:** Use `get_http_headers()`:

```python
from fastmcp.server.dependencies import get_http_headers

def get_user_agent() -> str:
    headers = get_http_headers()
    return headers.get("user-agent", "Unknown")
```

By default, problematic headers like `host` and `content-length` are excluded. Use `get_http_headers(include_all=True)` to include all headers.

### Access Token

Access the authenticated user's token when your server uses authentication.

**Dependency injection:** Use `CurrentAccessToken()` (raises if not authenticated):

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentAccessToken
from fastmcp.server.auth import AccessToken

mcp = FastMCP("Demo")


@mcp.tool
async def get_user_id(token: AccessToken = CurrentAccessToken()) -> str:
    return token.claims.get("sub", "unknown")
```

**Function:** Use `get_access_token()` (returns `None` if not authenticated):

```python
from fastmcp.server.dependencies import get_access_token

@mcp.tool
async def get_user_info() -> dict:
    token = get_access_token()
    if token is None:
        return {"authenticated": False}
    return {"authenticated": True, "user": token.claims.get("sub")}
```

The `AccessToken` object provides:

* **`client_id`**: The OAuth client identifier
* **`scopes`**: List of granted permission scopes
* **`expires_at`**: Token expiration timestamp (if available)
* **`claims`**: Dictionary of all token claims (JWT claims or provider-specific data)

### Token Claims

When you need just one specific value from the token—like a user ID or tenant identifier—`TokenClaim()` extracts it directly without needing the full token object.

```python
from fastmcp import FastMCP
from fastmcp.server.dependencies import TokenClaim

mcp = FastMCP("Demo")


@mcp.tool
async def add_expense(
    amount: float,
    user_id: str = TokenClaim("oid"),  # Azure object ID
) -> dict:
    await db.insert({"user_id": user_id, "amount": amount})
    return {"status": "created", "user_id": user_id}
```

`TokenClaim()` raises a `RuntimeError` if the claim doesn't exist, listing available claims to help with debugging.

Common claims vary by identity provider:

| Provider    | User ID Claim | Email Claim | Name Claim |
| ----------- | ------------- | ----------- | ---------- |
| Azure/Entra | `oid`         | `email`     | `name`     |
| GitHub      | `sub`         | `email`     | `name`     |
| Google      | `sub`         | `email`     | `name`     |
| Auth0       | `sub`         | `email`     | `name`     |

### Background Task Dependencies

For background task execution, FastMCP provides dependencies that integrate with [Docket](https://github.com/chrisguidry/docket). These require installing `fastmcp[tasks]`.

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentDocket, CurrentWorker, Progress

mcp = FastMCP("Task Demo")


@mcp.tool(task=True)
async def long_running_task(
    data: str,
    docket=CurrentDocket(),
    worker=CurrentWorker(),
    progress=Progress(),
) -> str:
    await progress.set_total(100)

    for i in range(100):
        # Process chunk...
        await progress.increment()
        await progress.set_message(f"Processing chunk {i + 1}")

    return "Complete"
```

* **`CurrentDocket()`**: Access the Docket instance for scheduling additional background work
* **`CurrentWorker()`**: Access the worker processing tasks (name, concurrency settings)
* **`Progress()`**: Track task progress with atomic updates

> **Note:** Task dependencies require `pip install 'fastmcp[tasks]'`. They're only available within task-enabled components (`task=True`). For comprehensive task patterns, see the [Docket documentation](https://chrisguidry.github.io/docket/dependencies/).


## Custom Dependencies

Beyond the built-in dependencies, you can create your own to inject configuration, database connections, API clients, or any other values your functions need.

### Using Depends()

The `Depends()` function wraps any callable and injects its return value. This works with synchronous functions, async functions, and async context managers.

```python
from fastmcp import FastMCP
from fastmcp.dependencies import Depends

mcp = FastMCP("Custom Deps Demo")


def get_config() -> dict:
    return {"api_url": "https://api.example.com", "timeout": 30}


async def get_user_id() -> int:
    # Could fetch from database, external service, etc.
    return 42


@mcp.tool
async def fetch_data(
    query: str,
    config: dict = Depends(get_config),
    user_id: int = Depends(get_user_id),
) -> str:
    return f"User {user_id} fetching '{query}' from {config['api_url']}"
```

### Caching

Dependencies are cached per-request. If multiple parameters use the same dependency, or if nested dependencies share a common dependency, it's resolved once and the same instance is reused.

```python
from fastmcp import FastMCP
from fastmcp.dependencies import Depends

mcp = FastMCP("Caching Demo")


def get_db_connection():
    print("Connecting to database...")  # Only printed once per request
    return {"connection": "active"}


def get_user_repo(db=Depends(get_db_connection)):
    return {"db": db, "type": "user"}


def get_order_repo(db=Depends(get_db_connection)):
    return {"db": db, "type": "order"}


@mcp.tool
async def process_order(
    order_id: str,
    users=Depends(get_user_repo),
    orders=Depends(get_order_repo),
) -> str:
    # Both repos share the same db connection
    return f"Processed order {order_id}"
```

### Resource Management

For dependencies that need cleanup—database connections, file handles, HTTP clients—use an async context manager. The cleanup code runs after your function completes, even if an error occurs.

```python
from contextlib import asynccontextmanager

from fastmcp import FastMCP
from fastmcp.dependencies import Depends

mcp = FastMCP("Resource Demo")


@asynccontextmanager
async def get_database():
    db = await connect_to_database()
    try:
        yield db
    finally:
        await db.close()


@mcp.tool
async def query_users(sql: str, db=Depends(get_database)) -> list:
    return await db.execute(sql)
```

### Nested Dependencies

Dependencies can depend on other dependencies. FastMCP resolves them in the correct order and applies caching across the dependency tree.

```python
from fastmcp import FastMCP
from fastmcp.dependencies import Depends

mcp = FastMCP("Nested Demo")


def get_base_url() -> str:
    return "https://api.example.com"


def get_api_client(base_url: str = Depends(get_base_url)) -> dict:
    return {"base_url": base_url, "version": "v1"}


@mcp.tool
async def call_api(endpoint: str, client: dict = Depends(get_api_client)) -> str:
    return f"Calling {client['base_url']}/{client['version']}/{endpoint}"
```

For advanced dependency patterns—like `TaskArgument()` for accessing task parameters, or custom `Dependency` subclasses—see the [Docket dependency documentation](https://chrisguidry.github.io/docket/dependencies/).

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
