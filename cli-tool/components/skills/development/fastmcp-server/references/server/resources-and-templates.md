# Resources & Templates

> Expose data sources and dynamic content generators to your MCP client.

Resources represent data or files that an MCP client can read, and resource templates extend this concept by allowing clients to request dynamically generated resources based on parameters passed in the URI.

FastMCP simplifies defining both static and dynamic resources, primarily using the `@mcp.resource` decorator.

## What Are Resources?

Resources provide read-only access to data for the LLM or client application. When a client requests a resource URI:

1. FastMCP finds the corresponding resource definition.
2. If it's dynamic (defined by a function), the function is executed.
3. The content (text, JSON, binary data) is returned to the client.

This allows LLMs to access files, database content, configuration, or dynamically generated information relevant to the conversation.

## Resources

### The `@resource` Decorator

The most common way to define a resource is by decorating a Python function. The decorator requires the resource's unique URI.

```python
import json
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Basic dynamic resource returning a string
@mcp.resource("resource://greeting")
def get_greeting() -> str:
    """Provides a simple greeting message."""
    return "Hello from FastMCP Resources!"

# Resource returning JSON data
@mcp.resource("data://config")
def get_config() -> str:
    """Provides application configuration as JSON."""
    return json.dumps({
        "theme": "dark",
        "version": "1.2.0",
        "features": ["tools", "resources"],
    })
```

**Key Concepts:**

* **URI:** The first argument to `@resource` is the unique URI (e.g., `"resource://greeting"`) clients use to request this data.
* **Lazy Loading:** The decorated function (`get_greeting`, `get_config`) is only executed when a client specifically requests that resource URI via `resources/read`.
* **Inferred Metadata:** By default:
  * Resource Name: Taken from the function name (`get_greeting`).
  * Resource Description: Taken from the function's docstring.

#### Decorator Arguments

You can customize the resource's properties using arguments in the `@mcp.resource` decorator:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Example specifying metadata
@mcp.resource(
    uri="data://app-status",      # Explicit URI (required)
    name="ApplicationStatus",     # Custom name
    description="Provides the current status of the application.", # Custom description
    mime_type="application/json", # Explicit MIME type
    tags={"monitoring", "status"}, # Categorization tags
    meta={"version": "2.1", "team": "infrastructure"}  # Custom metadata
)
def get_application_status() -> str:
    """Internal function description (ignored if description is provided above)."""
    return json.dumps({"status": "ok", "uptime": 12345, "version": mcp.settings.version})
```


  
    The unique identifier for the resource
  

  
    A human-readable name. If not provided, defaults to function name
  

  
    Explanation of the resource. If not provided, defaults to docstring
  

  
    Specifies the content type. FastMCP often infers a default like `text/plain` or `application/json`, but explicit is better for non-text types
  

  
    A set of strings used to categorize the resource. These can be used by the server and, in some cases, by clients to filter or group available resources.
  

  
    > **Warning:** Deprecated in v3.0.0. Use `mcp.enable()` / `mcp.disable()` at the server level instead.
    A boolean to enable or disable the resource. See [Component Visibility](#component-visibility) for the recommended approach.
  

  
    Optional list of icon representations for this resource or template. See Icons for detailed examples
  

  
    An optional `Annotations` object or dictionary to add additional metadata about the resource.

    
      
        If true, the resource is read-only and does not modify its environment.
      

      
        If true, reading the resource repeatedly will have no additional effect on its environment.
      
    
  

  
    Optional meta information about the resource. This data is passed through to the MCP client as the `meta` field of the client-side resource object and can be used for custom metadata, versioning, or other application-specific purposes.
  

  
    Optional version identifier for this resource. See Versioning for details.
  


#### Using with Methods

For decorating instance or class methods, use the standalone `@resource` decorator and register the bound method. See Tools: Using with Methods for the pattern.

### Return Values

Resource functions must return one of three types:

* **`str`**: Sent as `TextResourceContents` (with `mime_type="text/plain"` by default).
* **`bytes`**: Base64 encoded and sent as `BlobResourceContents`. You should specify an appropriate `mime_type` (e.g., `"image/png"`, `"application/octet-stream"`).
* **`ResourceResult`**: Full control over contents, MIME types, and metadata. See [ResourceResult](#resourceresult) below.

> **Note:** To return structured data like dicts or lists, serialize them to JSON strings using `json.dumps()`. This explicit approach ensures your type checker catches errors during development rather than at runtime when a client reads the resource.


#### ResourceResult

`ResourceResult` gives you explicit control over resource responses: multiple content items, per-item MIME types, and metadata at both the item and result level.

```python
from fastmcp import FastMCP
from fastmcp.resources import ResourceResult, ResourceContent

mcp = FastMCP()

@mcp.resource("data://users")
def get_users() -> ResourceResult:
    return ResourceResult(
        contents=[
            ResourceContent(content='[{"id": 1}]', mime_type="application/json"),
            ResourceContent(content="# Users\n...", mime_type="text/markdown"),
        ],
        meta={"total": 1}
    )
```

`ResourceContent` accepts three fields:

**`content`** - The actual resource content. Can be `str` (text content) or `bytes` (binary content). This is the data that will be returned to the client.

**`mime_type`** - Optional MIME type for the content. Defaults to `"text/plain"` for string content and `"application/octet-stream"` for binary content.

**`meta`** - Optional metadata dictionary that will be included in the MCP response's `meta` field. Use this for runtime metadata like Content Security Policy headers, caching hints, or other client-specific data.

For simple cases, you can pass `str` or `bytes` directly to `ResourceResult`:

```python
return ResourceResult("plain text")           # auto-converts to ResourceContent
return ResourceResult(b"\x00\x01\x02")         # binary content
```


  
    Content to return. Strings and bytes are wrapped in a single `ResourceContent`. Use a list of `ResourceContent` for multiple items or custom MIME types.
  

  
    Result-level metadata, included in the MCP response's `_meta` field.
  


  
    The content data. Strings and bytes pass through directly. Other types (dict, list, BaseModel) are automatically JSON-serialized.
  

  
    MIME type. Defaults to `text/plain` for strings, `application/octet-stream` for bytes, `application/json` for serialized objects.
  

  
    Item-level metadata for this specific content.
  


### Component Visibility

You can control which resources are enabled for clients using server-level enabled control. Disabled resources don't appear in `list_resources` and can't be read.

```python
from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.resource("data://public", tags={"public"})
def get_public(): return "public"

@mcp.resource("data://secret", tags={"internal"})
def get_secret(): return "secret"

# Disable specific resources by key
mcp.disable(keys={"resource:data://secret"})

# Disable resources by tag
mcp.disable(tags={"internal"})

# Or use allowlist mode - only enable resources with specific tags
mcp.enable(tags={"public"}, only=True)
```

See Visibility for the complete visibility control API including key formats, tag-based filtering, and provider-level control.

### Accessing MCP Context

Resources and resource templates can access additional MCP information and features through the `Context` object. To access it, add a parameter to your resource function with a type annotation of `Context`:

```python {6, 14}}
from fastmcp import FastMCP, Context

mcp = FastMCP(name="DataServer")

@mcp.resource("resource://system-status")
async def get_system_status(ctx: Context) -> str:
    """Provides system status information."""
    return json.dumps({
        "status": "operational",
        "request_id": ctx.request_id
    })

@mcp.resource("resource://{name}/details")
async def get_details(name: str, ctx: Context) -> str:
    """Get details for a specific name."""
    return json.dumps({
        "name": name,
        "accessed_at": ctx.request_id
    })
```

For full documentation on the Context object and all its capabilities, see the Context documentation.

### Async Resources

FastMCP supports both `async def` and regular `def` resource functions. Synchronous functions automatically run in a threadpool to avoid blocking the event loop.

For I/O-bound operations, async functions are more efficient:

```python
import aiofiles
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

@mcp.resource("file:///app/data/important_log.txt", mime_type="text/plain")
async def read_important_log() -> str:
    """Reads content from a specific log file asynchronously."""
    try:
        async with aiofiles.open("/app/data/important_log.txt", mode="r") as f:
            content = await f.read()
        return content
    except FileNotFoundError:
        return "Log file not found."
```

### Resource Classes

While `@mcp.resource` is ideal for dynamic content, you can directly register pre-defined resources (like static files or simple text) using `mcp.add_resource()` and concrete `Resource` subclasses.

```python
from pathlib import Path
from fastmcp import FastMCP
from fastmcp.resources import FileResource, TextResource, DirectoryResource

mcp = FastMCP(name="DataServer")

# 1. Exposing a static file directly
readme_path = Path("./README.md").resolve()
if readme_path.exists():
    # Use a file:// URI scheme
    readme_resource = FileResource(
        uri=f"file://{readme_path.as_posix()}",
        path=readme_path, # Path to the actual file
        name="README File",
        description="The project's README.",
        mime_type="text/markdown",
        tags={"documentation"}
    )
    mcp.add_resource(readme_resource)

# 2. Exposing simple, predefined text
notice_resource = TextResource(
    uri="resource://notice",
    name="Important Notice",
    text="System maintenance scheduled for Sunday.",
    tags={"notification"}
)
mcp.add_resource(notice_resource)

# 3. Using a custom key different from the URI
special_resource = TextResource(
    uri="resource://common-notice",
    name="Special Notice",
    text="This is a special notice with a custom storage key.",
)
mcp.add_resource(special_resource, key="resource://custom-key")

# 4. Exposing a directory listing
data_dir_path = Path("./app_data").resolve()
if data_dir_path.is_dir():
    data_listing_resource = DirectoryResource(
        uri="resource://data-files",
        path=data_dir_path, # Path to the directory
        name="Data Directory Listing",
        description="Lists files available in the data directory.",
        recursive=False # Set to True to list subdirectories
    )
    mcp.add_resource(data_listing_resource) # Returns JSON list of files
```

**Common Resource Classes:**

* `TextResource`: For simple string content.
* `BinaryResource`: For raw `bytes` content.
* `FileResource`: Reads content from a local file path. Handles text/binary modes and lazy reading.
* `HttpResource`: Fetches content from an HTTP(S) URL (requires `httpx`).
* `DirectoryResource`: Lists files in a local directory (returns JSON).
* (`FunctionResource`: Internal class used by `@mcp.resource`).

Use these when the content is static or sourced directly from a file/URL, bypassing the need for a dedicated Python function.

#### Custom Resource Keys

When adding resources directly with `mcp.add_resource()`, you can optionally provide a custom storage key:

```python
# Creating a resource with standard URI as the key
resource = TextResource(uri="resource://data")
mcp.add_resource(resource)  # Will be stored and accessed using "resource://data"

# Creating a resource with a custom key
special_resource = TextResource(uri="resource://special-data")
mcp.add_resource(special_resource, key="internal://data-v2")  # Will be stored and accessed using "internal://data-v2"
```

Note that this parameter is only available when using `add_resource()` directly and not through the `@resource` decorator, as URIs are provided explicitly when using the decorator.

### Notifications

FastMCP automatically sends `notifications/resources/list_changed` notifications to connected clients when resources or templates are added, enabled, or disabled. This allows clients to stay up-to-date with the current resource set without manually polling for changes.

```python
@mcp.resource("data://example")
def example_resource() -> str:
    return "Hello!"

# These operations trigger notifications:
mcp.add_resource(example_resource)                   # Sends resources/list_changed notification
mcp.disable(keys={"resource:data://example"})        # Sends resources/list_changed notification
mcp.enable(keys={"resource:data://example"})         # Sends resources/list_changed notification
```

Notifications are only sent when these operations occur within an active MCP request context (e.g., when called from within a tool or other MCP operation). Operations performed during server initialization do not trigger notifications.

Clients can handle these notifications using a message handler to automatically refresh their resource lists or update their interfaces.

### Annotations

FastMCP allows you to add specialized metadata to your resources through annotations. These annotations communicate how resources behave to client applications without consuming token context in LLM prompts.

Annotations serve several purposes in client applications:

* Indicating whether resources are read-only or may have side effects
* Describing the safety profile of resources (idempotent vs. non-idempotent)
* Helping clients optimize caching and access patterns

You can add annotations to a resource using the `annotations` parameter in the `@mcp.resource` decorator:

```python
@mcp.resource(
    "data://config",
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True
    }
)
def get_config() -> str:
    """Get application configuration."""
    return json.dumps({"version": "1.0", "debug": False})
```

FastMCP supports these standard annotations:

| Annotation       | Type    | Default | Purpose                                                           |
| :--------------- | :------ | :------ | :---------------------------------------------------------------- |
| `readOnlyHint`   | boolean | true    | Indicates if the resource only provides data without side effects |
| `idempotentHint` | boolean | true    | Indicates if repeated reads have the same effect as a single read |

Remember that annotations help make better user experiences but should be treated as advisory hints. They help client applications present appropriate UI elements and optimize access patterns, but won't enforce behavior on their own. Always focus on making your annotations accurately represent what your resource actually does.

## Resource Templates

Resource Templates allow clients to request resources whose content depends on parameters embedded in the URI. Define a template using the **same `@mcp.resource` decorator**, but include `{parameter_name}` placeholders in the URI string and add corresponding arguments to your function signature.

Resource templates share most configuration options with regular resources (name, description, mime\_type, tags, annotations), but add the ability to define URI parameters that map to function parameters.

Resource templates generate a new resource for each unique set of parameters, which means that resources can be dynamically created on-demand. For example, if the resource template `"user://profile/{name}"` is registered, MCP clients could request `"user://profile/ford"` or `"user://profile/marvin"` to retrieve either of those two user profiles as resources, without having to register each resource individually.

> **Tip:** Functions with `*args` are not supported as resource templates. However, unlike tools and prompts, resource templates do support `**kwargs` because the URI template defines specific parameter names that will be collected and passed as keyword arguments.


Here is a complete example that shows how to define two resource templates:

```python
import json
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Template URI includes {city} placeholder
@mcp.resource("weather://{city}/current")
def get_weather(city: str) -> str:
    """Provides weather information for a specific city."""
    return json.dumps({
        "city": city.capitalize(),
        "temperature": 22,
        "condition": "Sunny",
        "unit": "celsius"
    })

# Template with multiple parameters and annotations
@mcp.resource(
    "repos://{owner}/{repo}/info",
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True
    }
)
def get_repo_info(owner: str, repo: str) -> str:
    """Retrieves information about a GitHub repository."""
    return json.dumps({
        "owner": owner,
        "name": repo,
        "full_name": f"{owner}/{repo}",
        "stars": 120,
        "forks": 48
    })
```

With these two templates defined, clients can request a variety of resources:

* `weather://london/current` → Returns weather for London
* `weather://paris/current` → Returns weather for Paris
* `repos://jlowin/fastmcp/info` → Returns info about the jlowin/fastmcp repository
* `repos://prefecthq/prefect/info` → Returns info about the prefecthq/prefect repository

### RFC 6570 URI Templates

FastMCP implements [RFC 6570 URI Templates](https://datatracker.ietf.org/doc/html/rfc6570) for resource templates, providing a standardized way to define parameterized URIs. This includes support for simple expansion, wildcard path parameters, and form-style query parameters.

#### Wildcard Parameters

Resource templates support wildcard parameters that can match multiple path segments. While standard parameters (`{param}`) only match a single path segment and don't cross "/" boundaries, wildcard parameters (`{param*}`) can capture multiple segments including slashes. Wildcards capture all subsequent path segments *up until* the defined part of the URI template (whether literal or another parameter). This allows you to have multiple wildcard parameters in a single URI template.

```python {15, 23}}
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")


# Standard parameter only matches one segment
@mcp.resource("files://{filename}")
def get_file(filename: str) -> str:
    """Retrieves a file by name."""
    # Will only match files://<single-segment>
    return f"File content for: {filename}"


# Wildcard parameter can match multiple segments
@mcp.resource("path://{filepath*}")
def get_path_content(filepath: str) -> str:
    """Retrieves content at a specific path."""
    # Can match path://docs/server/resources.mdx
    return f"Content at path: {filepath}"


# Mixing standard and wildcard parameters
@mcp.resource("repo://{owner}/{path*}/template.py")
def get_template_file(owner: str, path: str) -> dict:
    """Retrieves a file from a specific repository and path, but
    only if the resource ends with `template.py`"""
    # Can match repo://jlowin/fastmcp/src/resources/template.py
    return {
        "owner": owner,
        "path": path + "/template.py",
        "content": f"File at {path}/template.py in {owner}'s repository"
    }
```

Wildcard parameters are useful when:

* Working with file paths or hierarchical data
* Creating APIs that need to capture variable-length path segments
* Building URL-like patterns similar to REST APIs

Note that like regular parameters, each wildcard parameter must still be a named parameter in your function signature, and all required function parameters must appear in the URI template.

#### Query Parameters

FastMCP supports RFC 6570 form-style query parameters using the `{?param1,param2}` syntax. Query parameters provide a clean way to pass optional configuration to resources without cluttering the path.

Query parameters must be optional function parameters (have default values), while path parameters map to required function parameters. This enforces a clear separation: required data goes in the path, optional configuration in query params.

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Basic query parameters
@mcp.resource("data://{id}{?format}")
def get_data(id: str, format: str = "json") -> str:
    """Retrieve data in specified format."""
    if format == "xml":
        return f"<data id='{id}' />"
    return f'{{"id": "{id}"}}'

# Multiple query parameters with type coercion
@mcp.resource("api://{endpoint}{?version,limit,offset}")
def call_api(endpoint: str, version: int = 1, limit: int = 10, offset: int = 0) -> dict:
    """Call API endpoint with pagination."""
    return {
        "endpoint": endpoint,
        "version": version,
        "limit": limit,
        "offset": offset,
        "results": fetch_results(endpoint, version, limit, offset)
    }

# Query parameters with wildcards
@mcp.resource("files://{path*}{?encoding,lines}")
def read_file(path: str, encoding: str = "utf-8", lines: int = 100) -> str:
    """Read file with optional encoding and line limit."""
    return read_file_content(path, encoding, lines)
```

**Example requests:**

* `data://123` → Uses default format `"json"`
* `data://123?format=xml` → Uses format `"xml"`
* `api://users?version=2&limit=50` → `version=2, limit=50, offset=0`
* `files://src/main.py?encoding=ascii&lines=50` → Custom encoding and line limit

FastMCP automatically coerces query parameter string values to the correct types based on your function's type hints (`int`, `float`, `bool`, `str`).

**Query parameters vs. hidden defaults:**

Query parameters expose optional configuration to clients. To hide optional parameters from clients entirely (always use defaults), simply omit them from the URI template:

```python
# Clients CAN override max_results via query string
@mcp.resource("search://{query}{?max_results}")
def search_configurable(query: str, max_results: int = 10) -> dict:
    return {"query": query, "limit": max_results}

# Clients CANNOT override max_results (not in URI template)
@mcp.resource("search://{query}")
def search_fixed(query: str, max_results: int = 10) -> dict:
    return {"query": query, "limit": max_results}
```

### Template Parameter Rules

FastMCP enforces these validation rules when creating resource templates:

1. **Required function parameters** (no default values) must appear in the URI path template
2. **Query parameters** (specified with `{?param}` syntax) must be optional function parameters with default values
3. **All URI template parameters** (path and query) must exist as function parameters

Optional function parameters (those with default values) can be:

* Included as query parameters (`{?param}`) - clients can override via query string
* Omitted from URI template - always uses default value, not exposed to clients
* Used in alternative path templates - enables multiple ways to access the same resource

**Multiple templates for one function:**

Create multiple resource templates that expose the same function through different URI patterns by manually applying decorators:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Define a user lookup function that can be accessed by different identifiers
def lookup_user(name: str | None = None, email: str | None = None) -> dict:
    """Look up a user by either name or email."""
    if email:
        return find_user_by_email(email)  # pseudocode
    elif name:
        return find_user_by_name(name)  # pseudocode
    else:
        return {"error": "No lookup parameters provided"}

# Manually apply multiple decorators to the same function
mcp.resource("users://email/{email}")(lookup_user)
mcp.resource("users://name/{name}")(lookup_user)
```

Now an LLM or client can retrieve user information in two different ways:

* `users://email/alice@example.com` → Looks up user by email (with name=None)
* `users://name/Bob` → Looks up user by name (with email=None)

This approach allows a single function to be registered with multiple URI patterns while keeping the implementation clean and straightforward.

Templates provide a powerful way to expose parameterized data access points following REST-like principles.

## Error Handling

If your resource function encounters an error, you can raise a standard Python exception (`ValueError`, `TypeError`, `FileNotFoundError`, custom exceptions, etc.) or a FastMCP `ResourceError`.

By default, all exceptions (including their details) are logged and converted into an MCP error response to be sent back to the client LLM. This helps the LLM understand failures and react appropriately.

If you want to mask internal error details for security reasons, you can:

1. Use the `mask_error_details=True` parameter when creating your `FastMCP` instance:

```python
mcp = FastMCP(name="SecureServer", mask_error_details=True)
```

2. Or use `ResourceError` to explicitly control what error information is sent to clients:

```python
from fastmcp import FastMCP
from fastmcp.exceptions import ResourceError

mcp = FastMCP(name="DataServer")

@mcp.resource("resource://safe-error")
def fail_with_details() -> str:
    """This resource provides detailed error information."""
    # ResourceError contents are always sent back to clients,
    # regardless of mask_error_details setting
    raise ResourceError("Unable to retrieve data: file not found")

@mcp.resource("resource://masked-error")
def fail_with_masked_details() -> str:
    """This resource masks internal error details when mask_error_details=True."""
    # This message would be masked if mask_error_details=True
    raise ValueError("Sensitive internal file path: /etc/secrets.conf")

@mcp.resource("data://{id}")
def get_data_by_id(id: str) -> dict:
    """Template resources also support the same error handling pattern."""
    if id == "secure":
        raise ValueError("Cannot access secure data")
    elif id == "missing":
        raise ResourceError("Data ID 'missing' not found in database")
    return {"id": id, "value": "data"}
```

When `mask_error_details=True`, only error messages from `ResourceError` will include details, other exceptions will be converted to a generic message.

## Server Behavior

### Duplicate Resources

You can configure how the FastMCP server handles attempts to register multiple resources or templates with the same URI. Use the `on_duplicate_resources` setting during `FastMCP` initialization.

```python
from fastmcp import FastMCP

mcp = FastMCP(
    name="ResourceServer",
    on_duplicate_resources="error" # Raise error on duplicates
)

@mcp.resource("data://config")
def get_config_v1(): return {"version": 1}

# This registration attempt will raise a ValueError because
# "data://config" is already registered and the behavior is "error".
# @mcp.resource("data://config")
# def get_config_v2(): return {"version": 2}
```

The duplicate behavior options are:

* `"warn"` (default): Logs a warning, and the new resource/template replaces the old one.
* `"error"`: Raises a `ValueError`, preventing the duplicate registration.
* `"replace"`: Silently replaces the existing resource/template with the new one.
* `"ignore"`: Keeps the original resource/template and ignores the new registration attempt.

## Versioning

Resources and resource templates support versioning, allowing you to maintain multiple implementations under the same URI while clients automatically receive the highest version. See Versioning for complete documentation on version comparison, retrieval, and migration patterns.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Resources & Templates

> Expose data sources and dynamic content generators to your MCP client.

Resources represent data or files that an MCP client can read, and resource templates extend this concept by allowing clients to request dynamically generated resources based on parameters passed in the URI.

FastMCP simplifies defining both static and dynamic resources, primarily using the `@mcp.resource` decorator.

## What Are Resources?

Resources provide read-only access to data for the LLM or client application. When a client requests a resource URI:

1. FastMCP finds the corresponding resource definition.
2. If it's dynamic (defined by a function), the function is executed.
3. The content (text, JSON, binary data) is returned to the client.

This allows LLMs to access files, database content, configuration, or dynamically generated information relevant to the conversation.

## Resources

### The `@resource` Decorator

The most common way to define a resource is by decorating a Python function. The decorator requires the resource's unique URI.

```python
import json
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Basic dynamic resource returning a string
@mcp.resource("resource://greeting")
def get_greeting() -> str:
    """Provides a simple greeting message."""
    return "Hello from FastMCP Resources!"

# Resource returning JSON data
@mcp.resource("data://config")
def get_config() -> str:
    """Provides application configuration as JSON."""
    return json.dumps({
        "theme": "dark",
        "version": "1.2.0",
        "features": ["tools", "resources"],
    })
```

**Key Concepts:**

* **URI:** The first argument to `@resource` is the unique URI (e.g., `"resource://greeting"`) clients use to request this data.
* **Lazy Loading:** The decorated function (`get_greeting`, `get_config`) is only executed when a client specifically requests that resource URI via `resources/read`.
* **Inferred Metadata:** By default:
  * Resource Name: Taken from the function name (`get_greeting`).
  * Resource Description: Taken from the function's docstring.

#### Decorator Arguments

You can customize the resource's properties using arguments in the `@mcp.resource` decorator:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Example specifying metadata
@mcp.resource(
    uri="data://app-status",      # Explicit URI (required)
    name="ApplicationStatus",     # Custom name
    description="Provides the current status of the application.", # Custom description
    mime_type="application/json", # Explicit MIME type
    tags={"monitoring", "status"}, # Categorization tags
    meta={"version": "2.1", "team": "infrastructure"}  # Custom metadata
)
def get_application_status() -> str:
    """Internal function description (ignored if description is provided above)."""
    return json.dumps({"status": "ok", "uptime": 12345, "version": mcp.settings.version})
```


  
    The unique identifier for the resource
  

  
    A human-readable name. If not provided, defaults to function name
  

  
    Explanation of the resource. If not provided, defaults to docstring
  

  
    Specifies the content type. FastMCP often infers a default like `text/plain` or `application/json`, but explicit is better for non-text types
  

  
    A set of strings used to categorize the resource. These can be used by the server and, in some cases, by clients to filter or group available resources.
  

  
    > **Warning:** Deprecated in v3.0.0. Use `mcp.enable()` / `mcp.disable()` at the server level instead.
    A boolean to enable or disable the resource. See [Component Visibility](#component-visibility) for the recommended approach.
  

  
    Optional list of icon representations for this resource or template. See Icons for detailed examples
  

  
    An optional `Annotations` object or dictionary to add additional metadata about the resource.

    
      
        If true, the resource is read-only and does not modify its environment.
      

      
        If true, reading the resource repeatedly will have no additional effect on its environment.
      
    
  

  
    Optional meta information about the resource. This data is passed through to the MCP client as the `meta` field of the client-side resource object and can be used for custom metadata, versioning, or other application-specific purposes.
  

  
    Optional version identifier for this resource. See Versioning for details.
  


#### Using with Methods

For decorating instance or class methods, use the standalone `@resource` decorator and register the bound method. See Tools: Using with Methods for the pattern.

### Return Values

Resource functions must return one of three types:

* **`str`**: Sent as `TextResourceContents` (with `mime_type="text/plain"` by default).
* **`bytes`**: Base64 encoded and sent as `BlobResourceContents`. You should specify an appropriate `mime_type` (e.g., `"image/png"`, `"application/octet-stream"`).
* **`ResourceResult`**: Full control over contents, MIME types, and metadata. See [ResourceResult](#resourceresult) below.

> **Note:** To return structured data like dicts or lists, serialize them to JSON strings using `json.dumps()`. This explicit approach ensures your type checker catches errors during development rather than at runtime when a client reads the resource.


#### ResourceResult

`ResourceResult` gives you explicit control over resource responses: multiple content items, per-item MIME types, and metadata at both the item and result level.

```python
from fastmcp import FastMCP
from fastmcp.resources import ResourceResult, ResourceContent

mcp = FastMCP()

@mcp.resource("data://users")
def get_users() -> ResourceResult:
    return ResourceResult(
        contents=[
            ResourceContent(content='[{"id": 1}]', mime_type="application/json"),
            ResourceContent(content="# Users\n...", mime_type="text/markdown"),
        ],
        meta={"total": 1}
    )
```

`ResourceContent` accepts three fields:

**`content`** - The actual resource content. Can be `str` (text content) or `bytes` (binary content). This is the data that will be returned to the client.

**`mime_type`** - Optional MIME type for the content. Defaults to `"text/plain"` for string content and `"application/octet-stream"` for binary content.

**`meta`** - Optional metadata dictionary that will be included in the MCP response's `meta` field. Use this for runtime metadata like Content Security Policy headers, caching hints, or other client-specific data.

For simple cases, you can pass `str` or `bytes` directly to `ResourceResult`:

```python
return ResourceResult("plain text")           # auto-converts to ResourceContent
return ResourceResult(b"\x00\x01\x02")         # binary content
```


  
    Content to return. Strings and bytes are wrapped in a single `ResourceContent`. Use a list of `ResourceContent` for multiple items or custom MIME types.
  

  
    Result-level metadata, included in the MCP response's `_meta` field.
  


  
    The content data. Strings and bytes pass through directly. Other types (dict, list, BaseModel) are automatically JSON-serialized.
  

  
    MIME type. Defaults to `text/plain` for strings, `application/octet-stream` for bytes, `application/json` for serialized objects.
  

  
    Item-level metadata for this specific content.
  


### Component Visibility

You can control which resources are enabled for clients using server-level enabled control. Disabled resources don't appear in `list_resources` and can't be read.

```python
from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.resource("data://public", tags={"public"})
def get_public(): return "public"

@mcp.resource("data://secret", tags={"internal"})
def get_secret(): return "secret"

# Disable specific resources by key
mcp.disable(keys={"resource:data://secret"})

# Disable resources by tag
mcp.disable(tags={"internal"})

# Or use allowlist mode - only enable resources with specific tags
mcp.enable(tags={"public"}, only=True)
```

See Visibility for the complete visibility control API including key formats, tag-based filtering, and provider-level control.

### Accessing MCP Context

Resources and resource templates can access additional MCP information and features through the `Context` object. To access it, add a parameter to your resource function with a type annotation of `Context`:

```python {6, 14}}
from fastmcp import FastMCP, Context

mcp = FastMCP(name="DataServer")

@mcp.resource("resource://system-status")
async def get_system_status(ctx: Context) -> str:
    """Provides system status information."""
    return json.dumps({
        "status": "operational",
        "request_id": ctx.request_id
    })

@mcp.resource("resource://{name}/details")
async def get_details(name: str, ctx: Context) -> str:
    """Get details for a specific name."""
    return json.dumps({
        "name": name,
        "accessed_at": ctx.request_id
    })
```

For full documentation on the Context object and all its capabilities, see the Context documentation.

### Async Resources

FastMCP supports both `async def` and regular `def` resource functions. Synchronous functions automatically run in a threadpool to avoid blocking the event loop.

For I/O-bound operations, async functions are more efficient:

```python
import aiofiles
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

@mcp.resource("file:///app/data/important_log.txt", mime_type="text/plain")
async def read_important_log() -> str:
    """Reads content from a specific log file asynchronously."""
    try:
        async with aiofiles.open("/app/data/important_log.txt", mode="r") as f:
            content = await f.read()
        return content
    except FileNotFoundError:
        return "Log file not found."
```

### Resource Classes

While `@mcp.resource` is ideal for dynamic content, you can directly register pre-defined resources (like static files or simple text) using `mcp.add_resource()` and concrete `Resource` subclasses.

```python
from pathlib import Path
from fastmcp import FastMCP
from fastmcp.resources import FileResource, TextResource, DirectoryResource

mcp = FastMCP(name="DataServer")

# 1. Exposing a static file directly
readme_path = Path("./README.md").resolve()
if readme_path.exists():
    # Use a file:// URI scheme
    readme_resource = FileResource(
        uri=f"file://{readme_path.as_posix()}",
        path=readme_path, # Path to the actual file
        name="README File",
        description="The project's README.",
        mime_type="text/markdown",
        tags={"documentation"}
    )
    mcp.add_resource(readme_resource)

# 2. Exposing simple, predefined text
notice_resource = TextResource(
    uri="resource://notice",
    name="Important Notice",
    text="System maintenance scheduled for Sunday.",
    tags={"notification"}
)
mcp.add_resource(notice_resource)

# 3. Using a custom key different from the URI
special_resource = TextResource(
    uri="resource://common-notice",
    name="Special Notice",
    text="This is a special notice with a custom storage key.",
)
mcp.add_resource(special_resource, key="resource://custom-key")

# 4. Exposing a directory listing
data_dir_path = Path("./app_data").resolve()
if data_dir_path.is_dir():
    data_listing_resource = DirectoryResource(
        uri="resource://data-files",
        path=data_dir_path, # Path to the directory
        name="Data Directory Listing",
        description="Lists files available in the data directory.",
        recursive=False # Set to True to list subdirectories
    )
    mcp.add_resource(data_listing_resource) # Returns JSON list of files
```

**Common Resource Classes:**

* `TextResource`: For simple string content.
* `BinaryResource`: For raw `bytes` content.
* `FileResource`: Reads content from a local file path. Handles text/binary modes and lazy reading.
* `HttpResource`: Fetches content from an HTTP(S) URL (requires `httpx`).
* `DirectoryResource`: Lists files in a local directory (returns JSON).
* (`FunctionResource`: Internal class used by `@mcp.resource`).

Use these when the content is static or sourced directly from a file/URL, bypassing the need for a dedicated Python function.

#### Custom Resource Keys

When adding resources directly with `mcp.add_resource()`, you can optionally provide a custom storage key:

```python
# Creating a resource with standard URI as the key
resource = TextResource(uri="resource://data")
mcp.add_resource(resource)  # Will be stored and accessed using "resource://data"

# Creating a resource with a custom key
special_resource = TextResource(uri="resource://special-data")
mcp.add_resource(special_resource, key="internal://data-v2")  # Will be stored and accessed using "internal://data-v2"
```

Note that this parameter is only available when using `add_resource()` directly and not through the `@resource` decorator, as URIs are provided explicitly when using the decorator.

### Notifications

FastMCP automatically sends `notifications/resources/list_changed` notifications to connected clients when resources or templates are added, enabled, or disabled. This allows clients to stay up-to-date with the current resource set without manually polling for changes.

```python
@mcp.resource("data://example")
def example_resource() -> str:
    return "Hello!"

# These operations trigger notifications:
mcp.add_resource(example_resource)                   # Sends resources/list_changed notification
mcp.disable(keys={"resource:data://example"})        # Sends resources/list_changed notification
mcp.enable(keys={"resource:data://example"})         # Sends resources/list_changed notification
```

Notifications are only sent when these operations occur within an active MCP request context (e.g., when called from within a tool or other MCP operation). Operations performed during server initialization do not trigger notifications.

Clients can handle these notifications using a message handler to automatically refresh their resource lists or update their interfaces.

### Annotations

FastMCP allows you to add specialized metadata to your resources through annotations. These annotations communicate how resources behave to client applications without consuming token context in LLM prompts.

Annotations serve several purposes in client applications:

* Indicating whether resources are read-only or may have side effects
* Describing the safety profile of resources (idempotent vs. non-idempotent)
* Helping clients optimize caching and access patterns

You can add annotations to a resource using the `annotations` parameter in the `@mcp.resource` decorator:

```python
@mcp.resource(
    "data://config",
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True
    }
)
def get_config() -> str:
    """Get application configuration."""
    return json.dumps({"version": "1.0", "debug": False})
```

FastMCP supports these standard annotations:

| Annotation       | Type    | Default | Purpose                                                           |
| :--------------- | :------ | :------ | :---------------------------------------------------------------- |
| `readOnlyHint`   | boolean | true    | Indicates if the resource only provides data without side effects |
| `idempotentHint` | boolean | true    | Indicates if repeated reads have the same effect as a single read |

Remember that annotations help make better user experiences but should be treated as advisory hints. They help client applications present appropriate UI elements and optimize access patterns, but won't enforce behavior on their own. Always focus on making your annotations accurately represent what your resource actually does.

## Resource Templates

Resource Templates allow clients to request resources whose content depends on parameters embedded in the URI. Define a template using the **same `@mcp.resource` decorator**, but include `{parameter_name}` placeholders in the URI string and add corresponding arguments to your function signature.

Resource templates share most configuration options with regular resources (name, description, mime\_type, tags, annotations), but add the ability to define URI parameters that map to function parameters.

Resource templates generate a new resource for each unique set of parameters, which means that resources can be dynamically created on-demand. For example, if the resource template `"user://profile/{name}"` is registered, MCP clients could request `"user://profile/ford"` or `"user://profile/marvin"` to retrieve either of those two user profiles as resources, without having to register each resource individually.

> **Tip:** Functions with `*args` are not supported as resource templates. However, unlike tools and prompts, resource templates do support `**kwargs` because the URI template defines specific parameter names that will be collected and passed as keyword arguments.


Here is a complete example that shows how to define two resource templates:

```python
import json
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Template URI includes {city} placeholder
@mcp.resource("weather://{city}/current")
def get_weather(city: str) -> str:
    """Provides weather information for a specific city."""
    return json.dumps({
        "city": city.capitalize(),
        "temperature": 22,
        "condition": "Sunny",
        "unit": "celsius"
    })

# Template with multiple parameters and annotations
@mcp.resource(
    "repos://{owner}/{repo}/info",
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True
    }
)
def get_repo_info(owner: str, repo: str) -> str:
    """Retrieves information about a GitHub repository."""
    return json.dumps({
        "owner": owner,
        "name": repo,
        "full_name": f"{owner}/{repo}",
        "stars": 120,
        "forks": 48
    })
```

With these two templates defined, clients can request a variety of resources:

* `weather://london/current` → Returns weather for London
* `weather://paris/current` → Returns weather for Paris
* `repos://jlowin/fastmcp/info` → Returns info about the jlowin/fastmcp repository
* `repos://prefecthq/prefect/info` → Returns info about the prefecthq/prefect repository

### RFC 6570 URI Templates

FastMCP implements [RFC 6570 URI Templates](https://datatracker.ietf.org/doc/html/rfc6570) for resource templates, providing a standardized way to define parameterized URIs. This includes support for simple expansion, wildcard path parameters, and form-style query parameters.

#### Wildcard Parameters

Resource templates support wildcard parameters that can match multiple path segments. While standard parameters (`{param}`) only match a single path segment and don't cross "/" boundaries, wildcard parameters (`{param*}`) can capture multiple segments including slashes. Wildcards capture all subsequent path segments *up until* the defined part of the URI template (whether literal or another parameter). This allows you to have multiple wildcard parameters in a single URI template.

```python {15, 23}}
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")


# Standard parameter only matches one segment
@mcp.resource("files://{filename}")
def get_file(filename: str) -> str:
    """Retrieves a file by name."""
    # Will only match files://<single-segment>
    return f"File content for: {filename}"


# Wildcard parameter can match multiple segments
@mcp.resource("path://{filepath*}")
def get_path_content(filepath: str) -> str:
    """Retrieves content at a specific path."""
    # Can match path://docs/server/resources.mdx
    return f"Content at path: {filepath}"


# Mixing standard and wildcard parameters
@mcp.resource("repo://{owner}/{path*}/template.py")
def get_template_file(owner: str, path: str) -> dict:
    """Retrieves a file from a specific repository and path, but
    only if the resource ends with `template.py`"""
    # Can match repo://jlowin/fastmcp/src/resources/template.py
    return {
        "owner": owner,
        "path": path + "/template.py",
        "content": f"File at {path}/template.py in {owner}'s repository"
    }
```

Wildcard parameters are useful when:

* Working with file paths or hierarchical data
* Creating APIs that need to capture variable-length path segments
* Building URL-like patterns similar to REST APIs

Note that like regular parameters, each wildcard parameter must still be a named parameter in your function signature, and all required function parameters must appear in the URI template.

#### Query Parameters

FastMCP supports RFC 6570 form-style query parameters using the `{?param1,param2}` syntax. Query parameters provide a clean way to pass optional configuration to resources without cluttering the path.

Query parameters must be optional function parameters (have default values), while path parameters map to required function parameters. This enforces a clear separation: required data goes in the path, optional configuration in query params.

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Basic query parameters
@mcp.resource("data://{id}{?format}")
def get_data(id: str, format: str = "json") -> str:
    """Retrieve data in specified format."""
    if format == "xml":
        return f"<data id='{id}' />"
    return f'{{"id": "{id}"}}'

# Multiple query parameters with type coercion
@mcp.resource("api://{endpoint}{?version,limit,offset}")
def call_api(endpoint: str, version: int = 1, limit: int = 10, offset: int = 0) -> dict:
    """Call API endpoint with pagination."""
    return {
        "endpoint": endpoint,
        "version": version,
        "limit": limit,
        "offset": offset,
        "results": fetch_results(endpoint, version, limit, offset)
    }

# Query parameters with wildcards
@mcp.resource("files://{path*}{?encoding,lines}")
def read_file(path: str, encoding: str = "utf-8", lines: int = 100) -> str:
    """Read file with optional encoding and line limit."""
    return read_file_content(path, encoding, lines)
```

**Example requests:**

* `data://123` → Uses default format `"json"`
* `data://123?format=xml` → Uses format `"xml"`
* `api://users?version=2&limit=50` → `version=2, limit=50, offset=0`
* `files://src/main.py?encoding=ascii&lines=50` → Custom encoding and line limit

FastMCP automatically coerces query parameter string values to the correct types based on your function's type hints (`int`, `float`, `bool`, `str`).

**Query parameters vs. hidden defaults:**

Query parameters expose optional configuration to clients. To hide optional parameters from clients entirely (always use defaults), simply omit them from the URI template:

```python
# Clients CAN override max_results via query string
@mcp.resource("search://{query}{?max_results}")
def search_configurable(query: str, max_results: int = 10) -> dict:
    return {"query": query, "limit": max_results}

# Clients CANNOT override max_results (not in URI template)
@mcp.resource("search://{query}")
def search_fixed(query: str, max_results: int = 10) -> dict:
    return {"query": query, "limit": max_results}
```

### Template Parameter Rules

FastMCP enforces these validation rules when creating resource templates:

1. **Required function parameters** (no default values) must appear in the URI path template
2. **Query parameters** (specified with `{?param}` syntax) must be optional function parameters with default values
3. **All URI template parameters** (path and query) must exist as function parameters

Optional function parameters (those with default values) can be:

* Included as query parameters (`{?param}`) - clients can override via query string
* Omitted from URI template - always uses default value, not exposed to clients
* Used in alternative path templates - enables multiple ways to access the same resource

**Multiple templates for one function:**

Create multiple resource templates that expose the same function through different URI patterns by manually applying decorators:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DataServer")

# Define a user lookup function that can be accessed by different identifiers
def lookup_user(name: str | None = None, email: str | None = None) -> dict:
    """Look up a user by either name or email."""
    if email:
        return find_user_by_email(email)  # pseudocode
    elif name:
        return find_user_by_name(name)  # pseudocode
    else:
        return {"error": "No lookup parameters provided"}

# Manually apply multiple decorators to the same function
mcp.resource("users://email/{email}")(lookup_user)
mcp.resource("users://name/{name}")(lookup_user)
```

Now an LLM or client can retrieve user information in two different ways:

* `users://email/alice@example.com` → Looks up user by email (with name=None)
* `users://name/Bob` → Looks up user by name (with email=None)

This approach allows a single function to be registered with multiple URI patterns while keeping the implementation clean and straightforward.

Templates provide a powerful way to expose parameterized data access points following REST-like principles.

## Error Handling

If your resource function encounters an error, you can raise a standard Python exception (`ValueError`, `TypeError`, `FileNotFoundError`, custom exceptions, etc.) or a FastMCP `ResourceError`.

By default, all exceptions (including their details) are logged and converted into an MCP error response to be sent back to the client LLM. This helps the LLM understand failures and react appropriately.

If you want to mask internal error details for security reasons, you can:

1. Use the `mask_error_details=True` parameter when creating your `FastMCP` instance:

```python
mcp = FastMCP(name="SecureServer", mask_error_details=True)
```

2. Or use `ResourceError` to explicitly control what error information is sent to clients:

```python
from fastmcp import FastMCP
from fastmcp.exceptions import ResourceError

mcp = FastMCP(name="DataServer")

@mcp.resource("resource://safe-error")
def fail_with_details() -> str:
    """This resource provides detailed error information."""
    # ResourceError contents are always sent back to clients,
    # regardless of mask_error_details setting
    raise ResourceError("Unable to retrieve data: file not found")

@mcp.resource("resource://masked-error")
def fail_with_masked_details() -> str:
    """This resource masks internal error details when mask_error_details=True."""
    # This message would be masked if mask_error_details=True
    raise ValueError("Sensitive internal file path: /etc/secrets.conf")

@mcp.resource("data://{id}")
def get_data_by_id(id: str) -> dict:
    """Template resources also support the same error handling pattern."""
    if id == "secure":
        raise ValueError("Cannot access secure data")
    elif id == "missing":
        raise ResourceError("Data ID 'missing' not found in database")
    return {"id": id, "value": "data"}
```

When `mask_error_details=True`, only error messages from `ResourceError` will include details, other exceptions will be converted to a generic message.

## Server Behavior

### Duplicate Resources

You can configure how the FastMCP server handles attempts to register multiple resources or templates with the same URI. Use the `on_duplicate_resources` setting during `FastMCP` initialization.

```python
from fastmcp import FastMCP

mcp = FastMCP(
    name="ResourceServer",
    on_duplicate_resources="error" # Raise error on duplicates
)

@mcp.resource("data://config")
def get_config_v1(): return {"version": 1}

# This registration attempt will raise a ValueError because
# "data://config" is already registered and the behavior is "error".
# @mcp.resource("data://config")
# def get_config_v2(): return {"version": 2}
```

The duplicate behavior options are:

* `"warn"` (default): Logs a warning, and the new resource/template replaces the old one.
* `"error"`: Raises a `ValueError`, preventing the duplicate registration.
* `"replace"`: Silently replaces the existing resource/template with the new one.
* `"ignore"`: Keeps the original resource/template and ignores the new registration attempt.

## Versioning

Resources and resource templates support versioning, allowing you to maintain multiple implementations under the same URI while clients automatically receive the highest version. See Versioning for complete documentation on version comparison, retrieval, and migration patterns.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
