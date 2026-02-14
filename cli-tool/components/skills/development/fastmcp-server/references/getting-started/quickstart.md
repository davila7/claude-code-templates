# Quickstart

Welcome! This guide will help you quickly set up FastMCP, run your first MCP server, and deploy a server to Prefect Horizon.

If you haven't already installed FastMCP, follow the installation instructions.

## Create a FastMCP Server

A FastMCP server is a collection of tools, resources, and other MCP components. To create a server, start by instantiating the `FastMCP` class.

Create a new file called `my_server.py` and add the following code:

```python my_server.py}
from fastmcp import FastMCP

mcp = FastMCP("My MCP Server")
```

That's it! You've created a FastMCP server, albeit a very boring one. Let's add a tool to make it more interesting.

## Add a Tool

To add a tool that returns a simple greeting, write a function and decorate it with `@mcp.tool` to register it with the server:

```python my_server.py}
from fastmcp import FastMCP

mcp = FastMCP("My MCP Server")

@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

## Run the Server

The simplest way to run your FastMCP server is to call its `run()` method. You can choose between different transports, like `stdio` for local servers, or `http` for remote access:


  ```python my_server.py (stdio) {9, 10}}
  from fastmcp import FastMCP

  mcp = FastMCP("My MCP Server")

  @mcp.tool
  def greet(name: str) -> str:
      return f"Hello, {name}!"

  if __name__ == "__main__":
      mcp.run()
  ```

  ```python my_server.py (HTTP) {9, 10}}
  from fastmcp import FastMCP

  mcp = FastMCP("My MCP Server")

  @mcp.tool
  def greet(name: str) -> str:
      return f"Hello, {name}!"

  if __name__ == "__main__":
      mcp.run(transport="http", port=8000)
  ```


This lets us run the server with `python my_server.py`. The stdio transport is the traditional way to connect MCP servers to clients, while the HTTP transport enables remote connections.

> **Tip:** Why do we need the `if __name__ == "__main__":` block?

  The `__main__` block is recommended for consistency and compatibility, ensuring your server works with all MCP clients that execute your server file as a script. Users who will exclusively run their server with the FastMCP CLI can omit it, as the CLI imports the server object directly.


### Using the FastMCP CLI

You can also use the `fastmcp run` command to start your server. Note that the FastMCP CLI **does not** execute the `__main__` block of your server file. Instead, it imports your server object and runs it with whatever transport and options you provide.

For example, to run this server with the default stdio transport (no matter how you called `mcp.run()`), you can use the following command:

```bash
fastmcp run my_server.py:mcp
```

To run this server with the HTTP transport, you can use the following command:

```bash
fastmcp run my_server.py:mcp --transport http --port 8000
```

## Call Your Server

Once your server is running with HTTP transport, you can connect to it with a FastMCP client or any LLM client that supports the MCP protocol:

```python my_client.py}
import asyncio
from fastmcp import Client

client = Client("http://localhost:8000/mcp")

async def call_tool(name: str):
    async with client:
        result = await client.call_tool("greet", {"name": name})
        print(result)

asyncio.run(call_tool("Ford"))
```

Note that:

* FastMCP clients are asynchronous, so we need to use `asyncio.run` to run the client
* We must enter a client context (`async with client:`) before using the client
* You can make multiple client calls within the same context

## Deploy to Prefect Horizon

[Prefect Horizon](https://horizon.prefect.io) is the enterprise MCP platform built by the FastMCP team at [Prefect](https://www.prefect.io). It provides managed hosting, authentication, access control, and observability for MCP servers.

> **Info:** Horizon is **free for personal projects** and offers enterprise governance for teams.


To deploy your server, you'll need a [GitHub account](https://github.com). Once you have one, you can deploy your server in three steps:

1. Push your `my_server.py` file to a GitHub repository
2. Sign in to [Prefect Horizon](https://horizon.prefect.io) with your GitHub account
3. Create a new project from your repository and enter `my_server.py:mcp` as the server entrypoint

That's it! Horizon will build and deploy your server, making it available at a URL like `https://your-project.fastmcp.app/mcp`. You can chat with it to test its functionality, or connect to it from any LLM client that supports the MCP protocol.

For more details, see the Prefect Horizon guide.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.

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
