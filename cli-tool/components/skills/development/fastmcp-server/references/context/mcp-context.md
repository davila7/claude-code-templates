# MCP Context

> Access MCP capabilities like logging, progress, and resources within your MCP objects.

When defining FastMCP tools, resources, resource templates, or prompts, your functions might need to interact with the underlying MCP session or access advanced server capabilities. FastMCP provides the `Context` object for this purpose.

> **Note:** You access Context through FastMCP's dependency injection system. For other injectable values like HTTP requests, access tokens, and custom dependencies, see Dependency Injection.


## What Is Context?

The `Context` object provides a clean interface to access MCP features within your functions, including:

* **Logging**: Send debug, info, warning, and error messages back to the client
* **Progress Reporting**: Update the client on the progress of long-running operations
* **Resource Access**: List and read data from resources registered with the server
* **Prompt Access**: List and retrieve prompts registered with the server
* **LLM Sampling**: Request the client's LLM to generate text based on provided messages
* **User Elicitation**: Request structured input from users during tool execution
* **Session State**: Store data that persists across requests within an MCP session
* **Session Visibility**: Control which components are visible to the current session
* **Request Information**: Access metadata about the current request
* **Server Access**: When needed, access the underlying FastMCP server instance

## Accessing the Context

The preferred way to access context is using the `CurrentContext()` dependency:

```python {1, 6}}
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentContext
from fastmcp.server.context import Context

mcp = FastMCP(name="Context Demo")

@mcp.tool
async def process_file(file_uri: str, ctx: Context = CurrentContext()) -> str:
    """Processes a file, using context for logging and resource access."""
    await ctx.info(f"Processing {file_uri}")
    return "Processed file"
```

This works with tools, resources, and prompts:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import CurrentContext
from fastmcp.server.context import Context

mcp = FastMCP(name="Context Demo")

@mcp.resource("resource://user-data")
async def get_user_data(ctx: Context = CurrentContext()) -> dict:
    await ctx.debug("Fetching user data")
    return {"user_id": "example"}

@mcp.prompt
async def data_analysis_request(dataset: str, ctx: Context = CurrentContext()) -> str:
    return f"Please analyze the following dataset: {dataset}"
```

**Key Points:**

* Dependency parameters are automatically excluded from the MCP schema—clients never see them.
* Context methods are async, so your function usually needs to be async as well.
* **Each MCP request receives a new context object.** Context is scoped to a single request; state or data set in one request will not be available in subsequent requests.
* Context is only available during a request; attempting to use context methods outside a request will raise errors.

### Legacy Type-Hint Injection

For backwards compatibility, you can still access context by simply adding a parameter with the `Context` type hint. FastMCP will automatically inject the context instance:

```python {1, 6}}
from fastmcp import FastMCP, Context

mcp = FastMCP(name="Context Demo")

@mcp.tool
async def process_file(file_uri: str, ctx: Context) -> str:
    """Processes a file, using context for logging and resource access."""
    # Context is injected automatically based on the type hint
    return "Processed file"
```

This approach still works for tools, resources, and prompts. The parameter name doesn't matter—only the `Context` type hint is important. The type hint can also be a union (`Context | None`) or use `Annotated[]`.

### Via `get_context()` Function

For code nested deeper within your function calls where passing context through parameters is inconvenient, use `get_context()` to retrieve the active context from anywhere within a request's execution flow:

```python}
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_context

mcp = FastMCP(name="Dependency Demo")

# Utility function that needs context but doesn't receive it as a parameter
async def process_data(data: list[float]) -> dict:
    # Get the active context - only works when called within a request
    ctx = get_context()
    await ctx.info(f"Processing {len(data)} data points")

@mcp.tool
async def analyze_dataset(dataset_name: str) -> dict:
    # Call utility function that uses context internally
    data = load_data(dataset_name)
    await process_data(data)
```

**Important Notes:**

* The `get_context()` function should only be used within the context of a server request. Calling it outside of a request will raise a `RuntimeError`.
* The `get_context()` function is server-only and should not be used in client code.

## Context Capabilities

FastMCP provides several advanced capabilities through the context object. Each capability has dedicated documentation with comprehensive examples and best practices:

### Logging

Send debug, info, warning, and error messages back to the MCP client for visibility into function execution.

```python
await ctx.debug("Starting analysis")
await ctx.info(f"Processing {len(data)} items") 
await ctx.warning("Deprecated parameter used")
await ctx.error("Processing failed")
```

See Server Logging for complete documentation and examples.

### Client Elicitation

Request structured input from clients during tool execution, enabling interactive workflows and progressive disclosure. This is a new feature in the 6/18/2025 MCP spec.

```python
result = await ctx.elicit("Enter your name:", response_type=str)
if result.action == "accept":
    name = result.data
```

See User Elicitation for detailed examples and supported response types.

### LLM Sampling

Request the client's LLM to generate text based on provided messages, useful for leveraging AI capabilities within your tools.

```python
response = await ctx.sample("Analyze this data", temperature=0.7)
```

See LLM Sampling for comprehensive usage and advanced techniques.

### Progress Reporting

Update clients on the progress of long-running operations, enabling progress indicators and better user experience.

```python
await ctx.report_progress(progress=50, total=100)  # 50% complete
```

See Progress Reporting for detailed patterns and examples.

### Resource Access

List and read data from resources registered with your FastMCP server, allowing access to files, configuration, or dynamic content.

```python
# List available resources
resources = await ctx.list_resources()

# Read a specific resource
content_list = await ctx.read_resource("resource://config")
content = content_list[0].content
```

**Method signatures:**

* **`ctx.list_resources() -> list[MCPResource]`**: Returns list of all available resources
* **`ctx.read_resource(uri: str | AnyUrl) -> list[ReadResourceContents]`**: Returns a list of resource content parts

### Prompt Access

List and retrieve prompts registered with your FastMCP server, allowing tools and middleware to discover and use available prompts programmatically.

```python
# List available prompts
prompts = await ctx.list_prompts()

# Get a specific prompt with arguments
result = await ctx.get_prompt("analyze_data", {"dataset": "users"})
messages = result.messages
```

**Method signatures:**

* **`ctx.list_prompts() -> list[MCPPrompt]`**: Returns list of all available prompts
* **`ctx.get_prompt(name: str, arguments: dict[str, Any] | None = None) -> GetPromptResult`**: Get a specific prompt with optional arguments

### Session State

Store data that persists across multiple requests within the same MCP session. Session state is automatically keyed by the client's session, ensuring isolation between different clients.

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("stateful-app")

@mcp.tool
async def increment_counter(ctx: Context) -> int:
    """Increment a counter that persists across tool calls."""
    count = await ctx.get_state("counter") or 0
    await ctx.set_state("counter", count + 1)
    return count + 1

@mcp.tool
async def get_counter(ctx: Context) -> int:
    """Get the current counter value."""
    return await ctx.get_state("counter") or 0
```

Each client session has its own isolated state—two different clients calling `increment_counter` will each have their own counter.

**Method signatures:**

* **`await ctx.set_state(key, value, *, serializable=True)`**: Store a value in session state
* **`await ctx.get_state(key)`**: Retrieve a value (returns None if not found)
* **`await ctx.delete_state(key)`**: Remove a value from session state

> **Note:** State methods are async and require `await`. State expires after 1 day to prevent unbounded memory growth.


#### Non-Serializable Values

By default, state values must be JSON-serializable (dicts, lists, strings, numbers, etc.) so they can be persisted across requests. For non-serializable values like HTTP clients or database connections, pass `serializable=False`:

```python
@mcp.tool
async def my_tool(ctx: Context) -> str:
    # This object can't be JSON-serialized
    client = SomeHTTPClient(base_url="https://api.example.com")
    await ctx.set_state("client", client, serializable=False)

    # Retrieve it later in the same request
    client = await ctx.get_state("client")
    return await client.fetch("/data")
```

Values stored with `serializable=False` only live for the current MCP request (a single tool call, resource read, or prompt render). They will not be available in subsequent requests within the session.

#### Custom Storage Backends

By default, session state uses an in-memory store suitable for single-server deployments. For distributed or serverless deployments, provide a custom storage backend:

```python
from key_value.aio.stores.redis import RedisStore

# Use Redis for distributed state
mcp = FastMCP("distributed-app", session_state_store=RedisStore(...))
```

Any backend compatible with the [py-key-value-aio](https://github.com/strawgate/py-key-value) `AsyncKeyValue` protocol works. See Storage Backends for more options including Redis, DynamoDB, and MongoDB.

#### State During Initialization

State set during `on_initialize` middleware persists to subsequent tool calls when using the same session object (STDIO, SSE, single-server HTTP). For distributed/serverless HTTP deployments where different machines handle init and tool calls, state is isolated by the `mcp-session-id` header.

### Session Visibility

Tools can customize which components are visible to their current session using `ctx.enable_components()`, `ctx.disable_components()`, and `ctx.reset_visibility()`. These methods apply visibility rules that affect only the calling session, leaving other sessions unchanged. See Per-Session Visibility for complete documentation, filter criteria, and patterns like namespace activation.

### Change Notifications

FastMCP automatically sends list change notifications when components (such as tools, resources, or prompts) are added, removed, enabled, or disabled. In rare cases where you need to manually trigger these notifications, you can use the context's notification methods:

```python
import mcp.types

@mcp.tool
async def custom_tool_management(ctx: Context) -> str:
    """Example of manual notification after custom tool changes."""
    await ctx.send_notification(mcp.types.ToolListChangedNotification())
    await ctx.send_notification(mcp.types.ResourceListChangedNotification())
    await ctx.send_notification(mcp.types.PromptListChangedNotification())
    return "Notifications sent"
```

These methods are primarily used internally by FastMCP's automatic notification system and most users will not need to invoke them directly.

### FastMCP Server

To access the underlying FastMCP server instance, you can use the `ctx.fastmcp` property:

```python
@mcp.tool
async def my_tool(ctx: Context) -> None:
    # Access the FastMCP server instance
    server_name = ctx.fastmcp.name
    ...
```

### Transport

The `ctx.transport` property indicates which transport is being used to run the server. This is useful when your tool needs to behave differently depending on whether the server is running over STDIO, SSE, or Streamable HTTP. For example, you might want to return shorter responses over STDIO or adjust timeout behavior based on transport characteristics.

The transport type is set once when the server starts and remains constant for the server's lifetime. It returns `None` when called outside of a server context (for example, in unit tests or when running code outside of an MCP request).

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("example")

@mcp.tool
def connection_info(ctx: Context) -> str:
    if ctx.transport == "stdio":
        return "Connected via STDIO"
    elif ctx.transport == "sse":
        return "Connected via SSE"
    elif ctx.transport == "streamable-http":
        return "Connected via Streamable HTTP"
    else:
        return "Transport unknown"
```

**Property signature:** `ctx.transport -> Literal["stdio", "sse", "streamable-http"] | None`

### MCP Request

Access metadata about the current request and client.

```python
@mcp.tool
async def request_info(ctx: Context) -> dict:
    """Return information about the current request."""
    return {
        "request_id": ctx.request_id,
        "client_id": ctx.client_id or "Unknown client"
    }
```

**Available Properties:**

* **`ctx.request_id -> str`**: Get the unique ID for the current MCP request
* **`ctx.client_id -> str | None`**: Get the ID of the client making the request, if provided during initialization
* **`ctx.session_id -> str`**: Get the MCP session ID for session-based data sharing. Raises `RuntimeError` if the MCP session is not yet established.

#### Request Context Availability

The `ctx.request_context` property provides access to the underlying MCP request context, but returns `None` when the MCP session has not been established yet. This typically occurs:

* During middleware execution in the `on_request` hook before the MCP handshake completes
* During the initialization phase of client connections

The MCP request context is distinct from the HTTP request. For HTTP transports, HTTP request data may be available even when the MCP session is not yet established.

To safely access the request context in situations where it may not be available:

```python
from fastmcp import FastMCP, Context
from fastmcp.server.dependencies import get_http_request

mcp = FastMCP(name="Session Aware Demo")

@mcp.tool
async def session_info(ctx: Context) -> dict:
    """Return session information when available."""

    # Check if MCP session is available
    if ctx.request_context:
        # MCP session available - can access MCP-specific attributes
        return {
            "session_id": ctx.session_id,
            "request_id": ctx.request_id,
            "has_meta": ctx.request_context.meta is not None
        }
    else:
        # MCP session not available - use HTTP helpers for request data (if using HTTP transport)
        request = get_http_request()
        return {
            "message": "MCP session not available",
            "user_agent": request.headers.get("user-agent", "Unknown")
        }
```

For HTTP request access that works regardless of MCP session availability (when using HTTP transports), use the HTTP request helpers like `get_http_request()` and `get_http_headers()`.

#### Client Metadata

Clients can send contextual information with their requests using the `meta` parameter. This metadata is accessible through `ctx.request_context.meta` and is available for all MCP operations (tools, resources, prompts).

The `meta` field is `None` when clients don't provide metadata. When provided, metadata is accessible via attribute access (e.g., `meta.user_id`) rather than dictionary access. The structure of metadata is determined by the client making the request.

```python
@mcp.tool
def send_email(to: str, subject: str, body: str, ctx: Context) -> str:
    """Send an email, logging metadata about the request."""

    # Access client-provided metadata
    meta = ctx.request_context.meta

    if meta:
        # Meta is accessed as an object with attribute access
        user_id = meta.user_id if hasattr(meta, 'user_id') else None
        trace_id = meta.trace_id if hasattr(meta, 'trace_id') else None

        # Use metadata for logging, observability, etc.
        if trace_id:
            log_with_trace(f"Sending email for user {user_id}", trace_id)

    # Send the email...
    return f"Email sent to {to}"
```

> **Warning:** The MCP request is part of the low-level MCP SDK and intended for advanced use cases. Most users will not need to use it directly.


> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
