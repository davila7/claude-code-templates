# Upgrade Guide

> Migration instructions for upgrading between FastMCP versions

This guide covers breaking changes and migration steps when upgrading FastMCP.

## v3.0.0

Most servers need only one change: update your import from `from mcp.server.fastmcp import FastMCP` to `from fastmcp import FastMCP`. The sections below cover less common breaking changes.

### Breaking Changes

#### WSTransport Removed

Use `StreamableHttpTransport` instead.

#### Auth Provider Environment Variables Removed

Auth providers no longer auto-load configuration. Read them explicitly:

```python
import os

auth = GitHubProvider(
    client_id=os.environ["GITHUB_CLIENT_ID"],
    client_secret=os.environ["GITHUB_CLIENT_SECRET"],
)
```

#### Component enable()/disable() Moved to Server

These methods moved from component objects to the server:

```python
# Before
tool = await server.get_tool("my_tool")
tool.disable()

# After
server.disable(names={"my_tool"}, components=["tool"])
```

#### Listing Methods Renamed and Return Lists

`get_tools()`, `get_resources()`, `get_prompts()`, and `get_resource_templates()` have been replaced by `list_tools()`, `list_resources()`, `list_prompts()`, and `list_resource_templates()`. The new methods return lists instead of dicts:

```python
# Before
tools = await server.get_tools()
tool = tools["my_tool"]

# After
tools = await server.list_tools()
tool = next((t for t in tools if t.name == "my_tool"), None)
```

#### Prompts Use Message Class

Use `Message` instead of `mcp.types.PromptMessage`:

```python
# Before
from mcp.types import PromptMessage, TextContent

@mcp.prompt
def my_prompt() -> PromptMessage:
    return PromptMessage(role="user", content=TextContent(type="text", text="Hello"))

# After
from fastmcp.prompts import Message

@mcp.prompt
def my_prompt() -> Message:
    return Message("Hello")
```

#### Context State Methods Are Async

`ctx.set_state()` and `ctx.get_state()` are now async. State persists across the session:

```python
# Before
ctx.set_state("key", "value")
value = ctx.get_state("key")

# After
await ctx.set_state("key", "value")
value = await ctx.get_state("key")
```

#### State Values Must Be Serializable

Session state values must now be JSON-serializable by default (dicts, lists, strings, numbers, etc.), since state is persisted across requests using a pluggable storage backend.

If you need to store non-serializable values (e.g., passing an HTTP client from middleware to a tool), use `serializable=False`. These values are request-scoped and only available during the current tool call, resource read, or prompt render:

```python
# Middleware sets up a client for the current request
await ctx.set_state("client", my_http_client, serializable=False)

# Tool retrieves it in the same request
client = await ctx.get_state("client")
```

#### Server Banner Environment Variable Renamed

`FASTMCP_SHOW_CLI_BANNER` is now `FASTMCP_SHOW_SERVER_BANNER`.

#### OpenAPI `timeout` Parameter Removed

Configure timeout on the httpx client directly. The `client` parameter is now optional — when omitted, a default client is created from the spec's `servers` URL with a 30-second timeout.

```python
# Before
provider = OpenAPIProvider(spec, client, timeout=60)

# After
client = httpx.AsyncClient(base_url="https://api.example.com", timeout=60)
provider = OpenAPIProvider(spec, client)
```

#### Metadata Namespace Renamed

The FastMCP metadata namespace changed from `_fastmcp` to `fastmcp`, and metadata is now always included. The `include_fastmcp_meta` parameter has been removed from `FastMCP()` and `to_mcp_tool()`—remove any usage of this parameter.

```python
# Before
tags = tool.meta.get("_fastmcp", {}).get("tags", [])

# After
tags = tool.meta.get("fastmcp", {}).get("tags", [])
```

### Behavior Changes

#### Decorators Return Functions

Decorators now return your original function instead of a component object. This means functions stay callable for testing:

```python
@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"

greet("World")  # Works! Returns "Hello, World!"
```

If you relied on the old behavior (treating `greet` as a `FunctionTool`), set `FASTMCP_DECORATOR_MODE=object` for v2 compatibility.

### Deprecated Features

These still work but emit warnings. Update when convenient.

#### mount() prefix → namespace

```python
# Deprecated
main.mount(subserver, prefix="api")

# New
main.mount(subserver, namespace="api")
```

#### include\_tags/exclude\_tags → enable()/disable()

```python
# Deprecated
mcp = FastMCP("server", exclude_tags={"internal"})

# New
mcp = FastMCP("server")
mcp.disable(tags={"internal"})
```

#### tool\_serializer → ToolResult

Return `ToolResult` from your tools for explicit serialization control instead of using the `tool_serializer` parameter.

#### add\_tool\_transformation() → add\_transform()

```python
# Deprecated
mcp.add_tool_transformation("name", config)

# New
from fastmcp.server.transforms import ToolTransform
mcp.add_transform(ToolTransform({"name": config}))
```

#### FastMCP.as\_proxy() → create\_proxy()

```python
# Deprecated
proxy = FastMCP.as_proxy("http://example.com/mcp")

# New
from fastmcp.server import create_proxy
proxy = create_proxy("http://example.com/mcp")
```

## v2.14.0

### OpenAPI Parser Promotion

The experimental OpenAPI parser is now standard. Update imports:

```python
# Before
from fastmcp.experimental.server.openapi import FastMCPOpenAPI

# After
from fastmcp.server.openapi import FastMCPOpenAPI
```

### Removed Deprecated Features

* `BearerAuthProvider` → use `JWTVerifier`
* `Context.get_http_request()` → use `get_http_request()` from dependencies
* `from fastmcp import Image` → use `from fastmcp.utilities.types import Image`
* `FastMCP(dependencies=[...])` → use `fastmcp.json` configuration
* `FastMCPProxy(client=...)` → use `client_factory=lambda: ...`
* `output_schema=False` → use `output_schema=None`

## v2.13.0

### OAuth Token Key Management

The OAuth proxy now issues its own JWT tokens. For production, provide explicit keys:

```python
auth = GitHubProvider(
    client_id=os.environ["GITHUB_CLIENT_ID"],
    client_secret=os.environ["GITHUB_CLIENT_SECRET"],
    base_url="https://your-server.com",
    jwt_signing_key=os.environ["JWT_SIGNING_KEY"],
    client_storage=RedisStore(host="redis.example.com"),
)
```

See OAuth Token Security for details.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
