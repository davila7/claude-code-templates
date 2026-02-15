# Middleware

> Add cross-cutting functionality to your MCP server with middleware that intercepts and modifies requests and responses.

Middleware adds behavior that applies across multiple operations—authentication, logging, rate limiting, or request transformation—without modifying individual tools or resources.

> **Tip:** MCP middleware is a FastMCP-specific concept and is not part of the official MCP protocol specification.


## Overview

MCP middleware forms a pipeline around your server's operations. When a request arrives, it flows through each middleware in order—each can inspect, modify, or reject the request before passing it along. After the operation completes, the response flows back through the same middleware in reverse order.

```
Request → Middleware A → Middleware B → Handler → Middleware B → Middleware A → Response
```

This bidirectional flow means middleware can:

* **Pre-process**: Validate authentication, log incoming requests, check rate limits
* **Post-process**: Transform responses, record timing metrics, handle errors consistently

The key decision point is `call_next(context)`. Calling it continues the chain; not calling it stops processing entirely.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware import Middleware, MiddlewareContext

class LoggingMiddleware(Middleware):
    async def on_message(self, context: MiddlewareContext, call_next):
        print(f"→ {context.method}")
        result = await call_next(context)
        print(f"← {context.method}")
        return result

mcp = FastMCP("MyServer")
mcp.add_middleware(LoggingMiddleware())
```

### Execution Order

Middleware executes in the order added to the server. The first middleware runs first on the way in and last on the way out:

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.error_handling import ErrorHandlingMiddleware
from fastmcp.server.middleware.rate_limiting import RateLimitingMiddleware
from fastmcp.server.middleware.logging import LoggingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(ErrorHandlingMiddleware())   # 1st in, last out
mcp.add_middleware(RateLimitingMiddleware())    # 2nd in, 2nd out
mcp.add_middleware(LoggingMiddleware())         # 3rd in, first out
```

This ordering matters. Place error handling early so it catches exceptions from all subsequent middleware. Place logging late so it records the actual execution after other middleware has processed the request.

### Server Composition

When using mounted servers, middleware behavior follows a clear hierarchy:

* **Parent middleware** runs for all requests, including those routed to mounted servers
* **Mounted server middleware** only runs for requests handled by that specific server

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.logging import LoggingMiddleware

parent = FastMCP("Parent")
parent.add_middleware(AuthMiddleware())  # Runs for ALL requests

child = FastMCP("Child")
child.add_middleware(LoggingMiddleware())  # Only runs for child's tools

parent.mount(child, namespace="child")
```

Requests to `child_tool` flow through the parent's `AuthMiddleware` first, then through the child's `LoggingMiddleware`.

## Hooks

Rather than processing every message identically, FastMCP provides specialized hooks at different levels of specificity. Multiple hooks fire for a single request, going from general to specific:

| Level     | Hooks                                                     | Purpose                                         |
| --------- | --------------------------------------------------------- | ----------------------------------------------- |
| Message   | `on_message`                                              | All MCP traffic (requests and notifications)    |
| Type      | `on_request`, `on_notification`                           | Requests expecting responses vs fire-and-forget |
| Operation | `on_call_tool`, `on_read_resource`, `on_get_prompt`, etc. | Specific MCP operations                         |

When a client calls a tool, the middleware chain processes `on_message` first, then `on_request`, then `on_call_tool`. This hierarchy lets you target exactly the right scope—use `on_message` for logging everything, `on_request` for authentication, and `on_call_tool` for tool-specific behavior.

### Hook Signature

Every hook follows the same pattern:

```python
async def hook_name(self, context: MiddlewareContext, call_next) -> result_type:
    # Pre-processing
    result = await call_next(context)
    # Post-processing
    return result
```

**Parameters:**

* `context` — `MiddlewareContext` containing request information
* `call_next` — Async function to continue the middleware chain

**Returns:** The appropriate result type for the hook (varies by operation).

### MiddlewareContext

The `context` parameter provides access to request details:

| Attribute         | Type       | Description                                   |
| ----------------- | ---------- | --------------------------------------------- |
| `method`          | `str`      | MCP method name (e.g., `"tools/call"`)        |
| `source`          | `str`      | Origin: `"client"` or `"server"`              |
| `type`            | `str`      | Message type: `"request"` or `"notification"` |
| `message`         | `object`   | The MCP message data                          |
| `timestamp`       | `datetime` | When the request was received                 |
| `fastmcp_context` | `Context`  | FastMCP context object (if available)         |

### Message Hooks

#### on\_message

Called for every MCP message—both requests and notifications.

```python
async def on_message(self, context: MiddlewareContext, call_next):
    result = await call_next(context)
    return result
```

Use for: Logging, metrics, or any cross-cutting concern that applies to all traffic.

#### on\_request

Called for MCP requests that expect a response.

```python
async def on_request(self, context: MiddlewareContext, call_next):
    result = await call_next(context)
    return result
```

Use for: Authentication, authorization, request validation.

#### on\_notification

Called for fire-and-forget MCP notifications.

```python
async def on_notification(self, context: MiddlewareContext, call_next):
    await call_next(context)
    # Notifications don't return values
```

Use for: Event logging, async side effects.

### Operation Hooks

#### on\_call\_tool

Called when a tool is executed. The `context.message` contains `name` (tool name) and `arguments` (dict).

```python
async def on_call_tool(self, context: MiddlewareContext, call_next):
    tool_name = context.message.name
    args = context.message.arguments
    result = await call_next(context)
    return result
```

**Returns:** Tool execution result or raises `ToolError`.

#### on\_read\_resource

Called when a resource is read. The `context.message` contains `uri` (resource URI).

```python
async def on_read_resource(self, context: MiddlewareContext, call_next):
    uri = context.message.uri
    result = await call_next(context)
    return result
```

**Returns:** Resource content.

#### on\_get\_prompt

Called when a prompt is retrieved. The `context.message` contains `name` (prompt name) and `arguments` (dict).

```python
async def on_get_prompt(self, context: MiddlewareContext, call_next):
    prompt_name = context.message.name
    result = await call_next(context)
    return result
```

**Returns:** Prompt messages.

#### on\_list\_tools

Called when listing available tools. Returns a list of FastMCP `Tool` objects before MCP conversion.

```python
async def on_list_tools(self, context: MiddlewareContext, call_next):
    tools = await call_next(context)
    # Filter or modify the tool list
    return tools
```

**Returns:** `list[Tool]` — Can be filtered before returning to client.

#### on\_list\_resources

Called when listing available resources. Returns FastMCP `Resource` objects.

```python
async def on_list_resources(self, context: MiddlewareContext, call_next):
    resources = await call_next(context)
    return resources
```

**Returns:** `list[Resource]`

#### on\_list\_resource\_templates

Called when listing resource templates.

```python
async def on_list_resource_templates(self, context: MiddlewareContext, call_next):
    templates = await call_next(context)
    return templates
```

**Returns:** `list[ResourceTemplate]`

#### on\_list\_prompts

Called when listing available prompts.

```python
async def on_list_prompts(self, context: MiddlewareContext, call_next):
    prompts = await call_next(context)
    return prompts
```

**Returns:** `list[Prompt]`

#### on\_initialize

Called when a client connects and initializes the session. This hook cannot modify the initialization response.

```python
from mcp import McpError
from mcp.types import ErrorData

async def on_initialize(self, context: MiddlewareContext, call_next):
    client_info = context.message.params.get("clientInfo", {})
    client_name = client_info.get("name", "unknown")

    # Reject before call_next to send error to client
    if client_name == "blocked-client":
        raise McpError(ErrorData(code=-32000, message="Client not supported"))

    await call_next(context)
    print(f"Client {client_name} initialized")
```

**Returns:** `None` — The initialization response is handled internally by the MCP protocol.

> **Warning:** Raising `McpError` after `call_next()` will only log the error, not send it to the client. The response has already been sent. Always reject **before** `call_next()`.


### Raw Handler

For complete control over all messages, override `__call__` instead of individual hooks:

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class RawMiddleware(Middleware):
    async def __call__(self, context: MiddlewareContext, call_next):
        print(f"Processing: {context.method}")
        result = await call_next(context)
        print(f"Completed: {context.method}")
        return result
```

This bypasses the hook dispatch system entirely. Use when you need uniform handling regardless of message type.

### Session Availability

The MCP session may not be available during certain phases like initialization. Check before accessing session-specific attributes:

```python
async def on_request(self, context: MiddlewareContext, call_next):
    ctx = context.fastmcp_context

    if ctx.request_context:
        # MCP session available
        session_id = ctx.session_id
        request_id = ctx.request_id
    else:
        # Session not yet established (e.g., during initialization)
        # Use HTTP helpers if needed
        from fastmcp.server.dependencies import get_http_headers
        headers = get_http_headers()

    return await call_next(context)
```

For HTTP-specific data (headers, client IP) when using HTTP transports, see HTTP Requests.

## Built-in Middleware

FastMCP includes production-ready middleware for common server concerns.

### Logging

```python
from fastmcp.server.middleware.logging import LoggingMiddleware, StructuredLoggingMiddleware
```

`LoggingMiddleware` provides human-readable request and response logging. `StructuredLoggingMiddleware` outputs JSON-formatted logs for aggregation tools like Datadog or Splunk.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.logging import LoggingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(LoggingMiddleware(
    include_payloads=True,
    max_payload_length=1000
))
```

| Parameter            | Type     | Default       | Description                          |
| -------------------- | -------- | ------------- | ------------------------------------ |
| `include_payloads`   | `bool`   | `False`       | Log request/response content         |
| `max_payload_length` | `int`    | `500`         | Truncate payloads beyond this length |
| `logger`             | `Logger` | module logger | Custom logger instance               |

### Timing

```python
from fastmcp.server.middleware.timing import TimingMiddleware, DetailedTimingMiddleware
```

`TimingMiddleware` logs execution duration for all requests. `DetailedTimingMiddleware` provides per-operation timing with separate tracking for tools, resources, and prompts.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.timing import TimingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(TimingMiddleware())
```

### Caching

```python
from fastmcp.server.middleware.caching import ResponseCachingMiddleware
```

Caches tool calls, resource reads, and list operations with TTL-based expiration.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.caching import ResponseCachingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(ResponseCachingMiddleware())
```

Each operation type can be configured independently using settings classes:

```python
from fastmcp.server.middleware.caching import (
    ResponseCachingMiddleware,
    CallToolSettings,
    ListToolsSettings,
    ReadResourceSettings
)

mcp.add_middleware(ResponseCachingMiddleware(
    list_tools_settings=ListToolsSettings(ttl=30),
    call_tool_settings=CallToolSettings(included_tools=["expensive_tool"]),
    read_resource_settings=ReadResourceSettings(enabled=False)
))
```

| Settings Class          | Configures                  |
| ----------------------- | --------------------------- |
| `ListToolsSettings`     | `on_list_tools` caching     |
| `CallToolSettings`      | `on_call_tool` caching      |
| `ListResourcesSettings` | `on_list_resources` caching |
| `ReadResourceSettings`  | `on_read_resource` caching  |
| `ListPromptsSettings`   | `on_list_prompts` caching   |
| `GetPromptSettings`     | `on_get_prompt` caching     |

Each settings class accepts:

* `enabled` — Enable/disable caching for this operation
* `ttl` — Time-to-live in seconds
* `included_*` / `excluded_*` — Whitelist or blacklist specific items

For persistence or distributed deployments, configure a different storage backend:

```python
from fastmcp.server.middleware.caching import ResponseCachingMiddleware
from key_value.aio.stores.disk import DiskStore

mcp.add_middleware(ResponseCachingMiddleware(
    cache_storage=DiskStore(directory="cache")
))
```

See Storage Backends for complete options.

### Rate Limiting

```python
from fastmcp.server.middleware.rate_limiting import (
    RateLimitingMiddleware,
    SlidingWindowRateLimitingMiddleware
)
```

`RateLimitingMiddleware` uses a token bucket algorithm allowing controlled bursts. `SlidingWindowRateLimitingMiddleware` provides precise time-window rate limiting without burst allowance.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.rate_limiting import RateLimitingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(RateLimitingMiddleware(
    max_requests_per_second=10.0,
    burst_capacity=20
))
```

| Parameter                 | Type       | Default | Description                  |
| ------------------------- | ---------- | ------- | ---------------------------- |
| `max_requests_per_second` | `float`    | `10.0`  | Sustained request rate       |
| `burst_capacity`          | `int`      | `20`    | Maximum burst size           |
| `client_id_func`          | `Callable` | `None`  | Custom client identification |

For sliding window rate limiting:

```python
from fastmcp.server.middleware.rate_limiting import SlidingWindowRateLimitingMiddleware

mcp.add_middleware(SlidingWindowRateLimitingMiddleware(
    max_requests=100,
    window_minutes=1
))
```

### Error Handling

```python
from fastmcp.server.middleware.error_handling import ErrorHandlingMiddleware, RetryMiddleware
```

`ErrorHandlingMiddleware` provides centralized error logging and transformation. `RetryMiddleware` automatically retries with exponential backoff for transient failures.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.error_handling import ErrorHandlingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(ErrorHandlingMiddleware(
    include_traceback=True,
    transform_errors=True,
    error_callback=my_error_callback
))
```

| Parameter           | Type       | Default | Description                      |
| ------------------- | ---------- | ------- | -------------------------------- |
| `include_traceback` | `bool`     | `False` | Include stack traces in logs     |
| `transform_errors`  | `bool`     | `False` | Convert exceptions to MCP errors |
| `error_callback`    | `Callable` | `None`  | Custom callback on errors        |

For automatic retries:

```python
from fastmcp.server.middleware.error_handling import RetryMiddleware

mcp.add_middleware(RetryMiddleware(
    max_retries=3,
    retry_exceptions=(ConnectionError, TimeoutError)
))
```

### Ping

```python
from fastmcp.server.middleware import PingMiddleware
```

Keeps long-lived connections alive by sending periodic pings.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware import PingMiddleware

mcp = FastMCP("MyServer")
mcp.add_middleware(PingMiddleware(interval_ms=5000))
```

| Parameter     | Type  | Default | Description                   |
| ------------- | ----- | ------- | ----------------------------- |
| `interval_ms` | `int` | `30000` | Ping interval in milliseconds |

The ping task starts on the first message and stops automatically when the session ends. Most useful for stateful HTTP connections; has no effect on stateless connections.

### Tool Injection

```python
from fastmcp.server.middleware.tool_injection import (
    ToolInjectionMiddleware,
    PromptToolMiddleware,
    ResourceToolMiddleware
)
```

`ToolInjectionMiddleware` dynamically injects tools during request processing. `PromptToolMiddleware` and `ResourceToolMiddleware` provide compatibility layers for clients that cannot list or access prompts and resources directly—they expose those capabilities as tools.

```python
from fastmcp import FastMCP
from fastmcp.tools import Tool
from fastmcp.server.middleware.tool_injection import ToolInjectionMiddleware

def my_tool_fn(a: int, b: int) -> int:
    return a + b

my_tool = Tool.from_function(fn=my_tool_fn, name="my_tool")
mcp.add_middleware(ToolInjectionMiddleware(tools=[my_tool]))
```

### Response Limiting

```python
from fastmcp.server.middleware.response_limiting import ResponseLimitingMiddleware
```

Large tool responses can overwhelm LLM context windows or cause memory issues. You can add response-limiting middleware to enforce size constraints on tool outputs.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.response_limiting import ResponseLimitingMiddleware

mcp = FastMCP("MyServer")

# Limit all tool responses to 500KB
mcp.add_middleware(ResponseLimitingMiddleware(max_size=500_000))

@mcp.tool
def search(query: str) -> str:
    # This could return a very large result
    return "x" * 1_000_000  # 1MB response

# When called, the response will be truncated to ~500KB with:
# "...\n\n[Response truncated due to size limit]"
```

When a response exceeds the limit, the middleware extracts all text content, joins it together, truncates to fit within the limit, and returns a single `TextContent` block. For non-text responses, the serialized JSON is used as the text source.

> **Note:** If a tool defines an `output_schema`, truncated responses will no longer conform to that schema — the client will receive a plain `TextContent` block instead of the expected structured output. Keep this in mind when setting size limits for tools with structured responses.


```python
# Limit only specific tools
mcp.add_middleware(ResponseLimitingMiddleware(
    max_size=100_000,
    tools=["search", "fetch_data"],
))
```

| Parameter           | Type                | Default                                        | Description                                  |
| ------------------- | ------------------- | ---------------------------------------------- | -------------------------------------------- |
| `max_size`          | `int`               | `1_000_000`                                    | Maximum response size in bytes (1MB default) |
| `truncation_suffix` | `str`               | `"\n\n[Response truncated due to size limit]"` | Suffix appended to truncated responses       |
| `tools`             | `list[str] \| None` | `None`                                         | Limit only these tools (None = all tools)    |

### Combining Middleware

Order matters. Place middleware that should run first (on the way in) earliest:

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.error_handling import ErrorHandlingMiddleware
from fastmcp.server.middleware.rate_limiting import RateLimitingMiddleware
from fastmcp.server.middleware.timing import TimingMiddleware
from fastmcp.server.middleware.logging import LoggingMiddleware

mcp = FastMCP("Production Server")

mcp.add_middleware(ErrorHandlingMiddleware())   # Catch all errors
mcp.add_middleware(RateLimitingMiddleware(max_requests_per_second=50))
mcp.add_middleware(TimingMiddleware())
mcp.add_middleware(LoggingMiddleware())

@mcp.tool
def my_tool(data: str) -> str:
    return f"Processed: {data}"
```

## Custom Middleware

When the built-in middleware doesn't fit your needs—custom authentication schemes, domain-specific logging, or request transformation—subclass `Middleware` and override the hooks you need.

```python
from fastmcp import FastMCP
from fastmcp.server.middleware import Middleware, MiddlewareContext

class CustomMiddleware(Middleware):
    async def on_request(self, context: MiddlewareContext, call_next):
        # Pre-processing
        print(f"→ {context.method}")

        result = await call_next(context)

        # Post-processing
        print(f"← {context.method}")
        return result

mcp = FastMCP("MyServer")
mcp.add_middleware(CustomMiddleware())
```

Override only the hooks relevant to your use case. Unoverridden hooks pass through automatically.

### Denying Requests

Raise the appropriate error type to stop processing and return an error to the client.

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError

class AuthMiddleware(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        tool_name = context.message.name

        if tool_name in ["delete_all", "admin_config"]:
            raise ToolError("Access denied: requires admin privileges")

        return await call_next(context)
```

| Operation        | Error Type      |
| ---------------- | --------------- |
| Tool calls       | `ToolError`     |
| Resource reads   | `ResourceError` |
| Prompt retrieval | `PromptError`   |
| General requests | `McpError`      |

Do not return error values or skip `call_next()` to indicate errors—raise exceptions for proper error propagation.

### Modifying Requests

Change the message before passing it down the chain.

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class InputSanitizer(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        if context.message.name == "search":
            # Normalize search query
            query = context.message.arguments.get("query", "")
            context.message.arguments["query"] = query.strip().lower()

        return await call_next(context)
```

### Modifying Responses

Transform results after the handler executes.

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class ResponseEnricher(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        result = await call_next(context)

        if context.message.name == "get_data" and result.structured_content:
            result.structured_content["processed_by"] = "enricher"

        return result
```

For more complex tool transformations, consider Transforms instead.

### Filtering Lists

List operations return FastMCP objects that you can filter before they reach the client. When filtering list results, also block execution in the corresponding operation hook to maintain consistency:

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError

class PrivateToolFilter(Middleware):
    async def on_list_tools(self, context: MiddlewareContext, call_next):
        tools = await call_next(context)
        return [tool for tool in tools if "private" not in tool.tags]

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        if context.fastmcp_context:
            tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
            if "private" in tool.tags:
                raise ToolError("Tool not found")

        return await call_next(context)
```

### Accessing Component Metadata

During execution hooks, component metadata (like tags) isn't directly available. Look up the component through the server:

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError

class TagBasedAuth(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        if context.fastmcp_context:
            try:
                tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)

                if "requires-auth" in tool.tags:
                    # Check authentication here
                    pass

            except Exception:
                pass  # Let execution handle missing tools

        return await call_next(context)
```

The same pattern works for resources and prompts:

```python
resource = await context.fastmcp_context.fastmcp.get_resource(context.message.uri)
prompt = await context.fastmcp_context.fastmcp.get_prompt(context.message.name)
```

### Storing State

Middleware can store state that tools access later through the FastMCP context.

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class UserMiddleware(Middleware):
    async def on_request(self, context: MiddlewareContext, call_next):
        # Extract user from headers (HTTP transport)
        from fastmcp.server.dependencies import get_http_headers
        headers = get_http_headers() or {}
        user_id = headers.get("x-user-id", "anonymous")

        # Store for tools to access
        if context.fastmcp_context:
            context.fastmcp_context.set_state("user_id", user_id)

        return await call_next(context)
```

Tools retrieve the state:

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("MyServer")

@mcp.tool
def get_user_data(ctx: Context) -> str:
    user_id = ctx.get_state("user_id")
    return f"Data for user: {user_id}"
```

See Context State Management for details.

### Constructor Parameters

Initialize middleware with configuration:

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class ConfigurableMiddleware(Middleware):
    def __init__(self, api_key: str, rate_limit: int = 100):
        self.api_key = api_key
        self.rate_limit = rate_limit
        self.request_counts = {}

    async def on_request(self, context: MiddlewareContext, call_next):
        # Use self.api_key, self.rate_limit, etc.
        return await call_next(context)

mcp.add_middleware(ConfigurableMiddleware(
    api_key="secret",
    rate_limit=50
))
```

### Error Handling in Custom Middleware

Wrap `call_next()` to handle errors from downstream middleware and handlers.

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class ErrorLogger(Middleware):
    async def on_request(self, context: MiddlewareContext, call_next):
        try:
            return await call_next(context)
        except Exception as e:
            print(f"Error in {context.method}: {type(e).__name__}: {e}")
            raise  # Re-raise to let error propagate
```

Catching and not re-raising suppresses the error entirely. Usually you want to log and re-raise.

### Complete Example

Authentication middleware checking API keys for specific tools:

```python
from fastmcp import FastMCP
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.server.dependencies import get_http_headers
from fastmcp.exceptions import ToolError

class ApiKeyAuth(Middleware):
    def __init__(self, valid_keys: set[str], protected_tools: set[str]):
        self.valid_keys = valid_keys
        self.protected_tools = protected_tools

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        tool_name = context.message.name

        if tool_name not in self.protected_tools:
            return await call_next(context)

        headers = get_http_headers() or {}
        api_key = headers.get("x-api-key")

        if api_key not in self.valid_keys:
            raise ToolError(f"Invalid API key for protected tool: {tool_name}")

        return await call_next(context)

mcp = FastMCP("Secure Server")
mcp.add_middleware(ApiKeyAuth(
    valid_keys={"key-1", "key-2"},
    protected_tools={"delete_user", "admin_panel"}
))

@mcp.tool
def delete_user(user_id: str) -> str:
    return f"Deleted user {user_id}"

@mcp.tool
def get_user(user_id: str) -> str:
    return f"User {user_id}"  # Not protected
```

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
