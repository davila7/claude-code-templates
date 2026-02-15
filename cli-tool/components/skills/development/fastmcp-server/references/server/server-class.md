# The FastMCP Server

> The core FastMCP server class for building MCP applications

The `FastMCP` class is the central piece of every FastMCP application. It acts as the container for your tools, resources, and prompts, managing communication with MCP clients and orchestrating the entire server lifecycle.

## Creating a Server

Instantiate a server by providing a name that identifies it in client applications and logs. You can also provide instructions that help clients understand the server's purpose.

```python
from fastmcp import FastMCP

mcp = FastMCP(name="MyAssistantServer")

# Instructions help clients understand how to interact with the server
mcp_with_instructions = FastMCP(
    name="HelpfulAssistant",
    instructions="""
        This server provides data analysis tools.
        Call get_average() to analyze numerical data.
    """,
)
```

The `FastMCP` constructor accepts several configuration options. The most commonly used parameters control server identity, authentication, and component behavior.


  
    A human-readable name for your server
  

  
    Description of how to interact with this server. These instructions help clients understand the server's purpose and available functionality
  

  
    Version string for your server. If not provided, defaults to the FastMCP library version
  

  
    URL to a website with more information about your server. Displayed in client applications
  

  
    List of icon representations for your server. Icons help users visually identify your server in client applications. See Icons for detailed examples
  

  
    Authentication provider for securing HTTP-based transports. See Authentication for configuration options
  

  
    Server-level setup and teardown logic. See Lifespans for composable lifespans
  

  
    A list of tools (or functions to convert to tools) to add to the server. In some cases, providing tools programmatically may be more convenient than using the `@mcp.tool` decorator
  

  
    Only expose components with at least one matching tag
  

  
    Hide components with any matching tag
  

  
    How to handle duplicate tool registrations
  

  
    How to handle duplicate resource registrations
  

  
    How to handle duplicate prompt registrations
  

  
    Controls how tool input parameters are validated. When `False` (default), FastMCP uses Pydantic's flexible validation that coerces compatible inputs (e.g., `"10"` to `10` for int parameters). When `True`, uses the MCP SDK's JSON Schema validation to validate inputs against the exact schema before passing them to your function, rejecting any type mismatches. The default mode improves compatibility with LLM clients while maintaining type safety. See Input Validation Modes for details
  

  
    Maximum number of items per page for list operations (`tools/list`, `resources/list`, etc.). When `None` (default), all results are returned in a single response. When set, responses are paginated and include a `nextCursor` for fetching additional pages. See Pagination for details
  


## Components

FastMCP servers expose three types of components to clients. Each type serves a distinct purpose in the MCP protocol.

### Tools

Tools are functions that clients can invoke to perform actions or access external systems. They're the primary way clients interact with your server's capabilities.

```python
@mcp.tool
def multiply(a: float, b: float) -> float:
    """Multiplies two numbers together."""
    return a * b
```

See Tools for detailed documentation.

### Resources

Resources expose data that clients can read. Unlike tools, resources are passive data sources that clients pull from rather than invoke.

```python
@mcp.resource("data://config")
def get_config() -> dict:
    """Provides the application configuration."""
    return {"theme": "dark", "version": "1.0"}
```

See Resources for detailed documentation.

### Resource Templates

Resource templates are parameterized resources. The client provides values for template parameters in the URI, and the server returns data specific to those parameters.

```python
@mcp.resource("users://{user_id}/profile")
def get_user_profile(user_id: int) -> dict:
    """Retrieves a user's profile by ID."""
    return {"id": user_id, "name": f"User {user_id}", "status": "active"}
```

See Resource Templates for detailed documentation.

### Prompts

Prompts are reusable message templates that guide LLM interactions. They help establish consistent patterns for how clients should frame requests.

```python
@mcp.prompt
def analyze_data(data_points: list[float]) -> str:
    """Creates a prompt asking for analysis of numerical data."""
    formatted_data = ", ".join(str(point) for point in data_points)
    return f"Please analyze these data points: {formatted_data}"
```

See Prompts for detailed documentation.

## Tag-Based Filtering

Tags let you categorize components and selectively expose them based on configurable include/exclude sets. This is useful for creating different views of your server for different environments or user types.

Components can be tagged when defined using the `tags` parameter. A component can have multiple tags, and filtering operates on tag membership.

```python
@mcp.tool(tags={"public", "utility"})
def public_tool() -> str:
    return "This tool is public"

@mcp.tool(tags={"internal", "admin"})
def admin_tool() -> str:
    return "This tool is for admins only"
```

The filtering logic works as follows:

* **Include tags**: If specified, only components with at least one matching tag are exposed
* **Exclude tags**: Components with any matching tag are filtered out
* **Precedence**: Exclude tags always take priority over include tags

> **Tip:** To ensure a component is never exposed, you can set `enabled=False` on the component itself. See the component-specific documentation for details.


Configure tag-based filtering when creating your server.

```python
# Only expose components tagged with "public"
mcp = FastMCP(include_tags={"public"})

# Hide components tagged as "internal" or "deprecated"
mcp = FastMCP(exclude_tags={"internal", "deprecated"})

# Combine both: show admin tools but hide deprecated ones
mcp = FastMCP(include_tags={"admin"}, exclude_tags={"deprecated"})
```

This filtering applies to all component types (tools, resources, resource templates, and prompts) and affects both listing and access.

## Running the Server

FastMCP servers communicate with clients through transport mechanisms. Start your server by calling `mcp.run()`, typically within an `if __name__ == "__main__":` block. This pattern ensures compatibility with various MCP clients.

```python
from fastmcp import FastMCP

mcp = FastMCP(name="MyServer")

@mcp.tool
def greet(name: str) -> str:
    """Greet a user by name."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    # Defaults to STDIO transport
    mcp.run()

    # Or use HTTP transport
    # mcp.run(transport="http", host="127.0.0.1", port=9000)
```

FastMCP supports several transports:

* **STDIO** (default): For local integrations and CLI tools
* **HTTP**: For web services using the Streamable HTTP protocol
* **SSE**: Legacy web transport (deprecated)

The server can also be run using the FastMCP CLI. For detailed information on transports and configuration, see the Running Your Server guide.

## Custom Routes

When running with HTTP transport, you can add custom web routes alongside your MCP endpoint using the `@custom_route` decorator. This is useful for auxiliary endpoints like health checks.

```python
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import PlainTextResponse

mcp = FastMCP("MyServer")

@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")

if __name__ == "__main__":
    mcp.run(transport="http")  # Health check at http://localhost:8000/health
```

Custom routes are served alongside your MCP endpoint and are useful for:

* Health check endpoints for monitoring
* Simple status or info endpoints
* Basic webhooks or callbacks

For more complex web applications, consider mounting your MCP server into a FastAPI or Starlette app.
