# Icons

> Add visual icons to your servers, tools, resources, and prompts

Icons provide visual representations for your MCP servers and components, helping client applications present better user interfaces. When displayed in MCP clients, icons help users quickly identify and navigate your server's capabilities.

## Icon Format

Icons use the standard MCP Icon type from the MCP protocol specification. Each icon specifies a source URL or data URI, and optionally includes MIME type and size information.

```python
from mcp.types import Icon

icon = Icon(
    src="https://example.com/icon.png",
    mimeType="image/png",
    sizes=["48x48"]
)
```

The fields serve different purposes:

* **src**: URL or data URI pointing to the icon image
* **mimeType** (optional): MIME type of the image (e.g., "image/png", "image/svg+xml")
* **sizes** (optional): Array of size descriptors (e.g., \["48x48"], \["any"])

## Server Icons

Add icons and a website URL to your server for display in client applications. Multiple icons at different sizes help clients choose the best resolution for their display context.

```python
from fastmcp import FastMCP
from mcp.types import Icon

mcp = FastMCP(
    name="WeatherService",
    website_url="https://weather.example.com",
    icons=[
        Icon(
            src="https://weather.example.com/icon-48.png",
            mimeType="image/png",
            sizes=["48x48"]
        ),
        Icon(
            src="https://weather.example.com/icon-96.png",
            mimeType="image/png",
            sizes=["96x96"]
        ),
    ]
)
```

Server icons appear in MCP client interfaces to help users identify your server among others they may have installed.

## Component Icons

Icons can be added to individual tools, resources, resource templates, and prompts. This helps users visually distinguish between different component types and purposes.

### Tool Icons

```python
from mcp.types import Icon

@mcp.tool(
    icons=[Icon(src="https://example.com/calculator-icon.png")]
)
def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
```

### Resource Icons

```python
@mcp.resource(
    "config://settings",
    icons=[Icon(src="https://example.com/config-icon.png")]
)
def get_settings() -> dict:
    """Retrieve application settings."""
    return {"theme": "dark", "language": "en"}
```

### Resource Template Icons

```python
@mcp.resource(
    "user://{user_id}/profile",
    icons=[Icon(src="https://example.com/user-icon.png")]
)
def get_user_profile(user_id: str) -> dict:
    """Get a user's profile."""
    return {"id": user_id, "name": f"User {user_id}"}
```

### Prompt Icons

```python
@mcp.prompt(
    icons=[Icon(src="https://example.com/prompt-icon.png")]
)
def analyze_code(code: str):
    """Create a prompt for code analysis."""
    return f"Please analyze this code:\n\n{code}"
```

## Using Data URIs

For small icons or when you want to embed the icon directly without external dependencies, use data URIs. This approach eliminates the need for hosting and ensures the icon is always available.

```python
from mcp.types import Icon
from fastmcp.utilities.types import Image

# SVG icon as data URI
svg_icon = Icon(
    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6Ii8+PC9zdmc+",
    mimeType="image/svg+xml"
)

@mcp.tool(icons=[svg_icon])
def my_tool() -> str:
    """A tool with an embedded SVG icon."""
    return "result"
```

### Generating Data URIs from Files

FastMCP provides the `Image` utility class to convert local image files into data URIs.

```python
from mcp.types import Icon
from fastmcp.utilities.types import Image

# Generate a data URI from a local image file
img = Image(path="./assets/brand/favicon.png")
icon = Icon(src=img.to_data_uri())

@mcp.tool(icons=[icon])
def file_icon_tool() -> str:
    """A tool with an icon generated from a local file."""
    return "result"
```

This approach is useful when you have local image assets and want to embed them directly in your server definition.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
