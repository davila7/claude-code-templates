# Tools

> Expose functions as executable capabilities for your MCP client.

Tools are the core building blocks that allow your LLM to interact with external systems, execute code, and access data that isn't in its training data. In FastMCP, tools are Python functions exposed to LLMs through the MCP protocol.

Tools in FastMCP transform regular Python functions into capabilities that LLMs can invoke during conversations. When an LLM decides to use a tool:

1. It sends a request with parameters based on the tool's schema.
2. FastMCP validates these parameters against your function's signature.
3. Your function executes with the validated inputs.
4. The result is returned to the LLM, which can use it in its response.

This allows LLMs to perform tasks like querying databases, calling APIs, making calculations, or accessing files—extending their capabilities beyond what's in their training data.

## The `@tool` Decorator

Creating a tool is as simple as decorating a Python function with `@mcp.tool`:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="CalculatorServer")

@mcp.tool
def add(a: int, b: int) -> int:
    """Adds two integer numbers together."""
    return a + b
```

When this tool is registered, FastMCP automatically:

* Uses the function name (`add`) as the tool name.
* Uses the function's docstring (`Adds two integer numbers...`) as the tool description.
* Generates an input schema based on the function's parameters and type annotations.
* Handles parameter validation and error reporting.

The way you define your Python function dictates how the tool appears and behaves for the LLM client.

> **Tip:** Functions with `*args` or `**kwargs` are not supported as tools. This restriction exists because FastMCP needs to generate a complete parameter schema for the MCP protocol, which isn't possible with variable argument lists.


### Decorator Arguments

While FastMCP infers the name and description from your function, you can override these and add additional metadata using arguments to the `@mcp.tool` decorator:

```python
@mcp.tool(
    name="find_products",           # Custom tool name for the LLM
    description="Search the product catalog with optional category filtering.", # Custom description
    tags={"catalog", "search"},      # Optional tags for organization/filtering
    meta={"version": "1.2", "author": "product-team"}  # Custom metadata
)
def search_products_implementation(query: str, category: str | None = None) -> list[dict]:
    """Internal function description (ignored if description is provided above)."""
    # Implementation...
    print(f"Searching for '{query}' in category '{category}'")
    return [{"id": 2, "name": "Another Product"}]
```


  
    Sets the explicit tool name exposed via MCP. If not provided, uses the function name
  

  
    Provides the description exposed via MCP. If set, the function's docstring is ignored for this purpose
  

  
    A set of strings used to categorize the tool. These can be used by the server and, in some cases, by clients to filter or group available tools.
  

  
    > **Warning:** Deprecated in v3.0.0. Use `mcp.enable()` / `mcp.disable()` at the server level instead.
    A boolean to enable or disable the tool. See [Component Visibility](#component-visibility) for the recommended approach.
  

  
    Optional list of icon representations for this tool. See Icons for detailed examples
  

  
    An optional `ToolAnnotations` object or dictionary to add additional metadata about the tool.

    
      
        A human-readable title for the tool.
      

      
        If true, the tool does not modify its environment.
      

      
        If true, the tool may perform destructive updates to its environment.
      

      
        If true, calling the tool repeatedly with the same arguments will have no additional effect on the its environment.
      

      
        If true, this tool may interact with an "open world" of external entities. If false, the tool's domain of interaction is closed.
      
    
  

  
    Optional meta information about the tool. This data is passed through to the MCP client as the `meta` field of the client-side tool object and can be used for custom metadata, versioning, or other application-specific purposes.
  

  
    Execution timeout in seconds. If the tool takes longer than this to complete, an MCP error is returned to the client. See [Timeouts](#timeouts) for details.
  

  
    Optional version identifier for this tool. See Versioning for details.
  


### Using with Methods

The `@mcp.tool` decorator registers tools immediately, which doesn't work with instance or class methods (you'd see `self` or `cls` as required parameters). For methods, use the standalone `@tool` decorator to attach metadata, then register the bound method:

```python
from fastmcp import FastMCP
from fastmcp.tools import tool

class Calculator:
    def __init__(self, multiplier: int):
        self.multiplier = multiplier

    @tool()
    def multiply(self, x: int) -> int:
        """Multiply x by the instance multiplier."""
        return x * self.multiplier

calc = Calculator(multiplier=3)
mcp = FastMCP()
mcp.add_tool(calc.multiply)  # Registers with correct schema (only 'x', not 'self')
```

### Async Support

FastMCP supports both asynchronous (`async def`) and synchronous (`def`) functions as tools. Synchronous tools automatically run in a threadpool to avoid blocking the event loop, so multiple tool calls can execute concurrently even if individual tools perform blocking operations.

```python
from fastmcp import FastMCP
import time

mcp = FastMCP()

@mcp.tool
def slow_tool(x: int) -> int:
    """This sync function won't block other concurrent requests."""
    time.sleep(2)  # Runs in threadpool, not on the event loop
    return x * 2
```

For I/O-bound operations like network requests or database queries, async tools are still preferred since they're more efficient than threadpool dispatch. Use sync tools when working with synchronous libraries or for simple operations where the threading overhead doesn't matter.

## Arguments

By default, FastMCP converts Python functions into MCP tools by inspecting the function's signature and type annotations. This allows you to use standard Python type annotations for your tools. In general, the framework strives to "just work": idiomatic Python behaviors like parameter defaults and type annotations are automatically translated into MCP schemas. However, there are a number of ways to customize the behavior of your tools.

> **Note:** FastMCP automatically dereferences `$ref` entries in tool schemas to ensure compatibility with MCP clients that don't fully support JSON Schema references (e.g., VS Code Copilot, Claude Desktop). This means complex Pydantic models with shared types are inlined in the schema rather than using `$defs` references.

  Dereferencing happens at serve-time via middleware, so your schemas are stored with `$ref` intact and only inlined when sent to clients. If you know your clients handle `$ref` correctly and prefer smaller schemas, you can opt out:

  ```python
  mcp = FastMCP("my-server", dereference_schemas=False)
  ```


### Type Annotations

MCP tools have typed arguments, and FastMCP uses type annotations to determine those types. Therefore, you should use standard Python type annotations for tool arguments:

```python
@mcp.tool
def analyze_text(
    text: str,
    max_tokens: int = 100,
    language: str | None = None
) -> dict:
    """Analyze the provided text."""
    # Implementation...
```

FastMCP supports a wide range of type annotations, including all Pydantic types:

| Type Annotation   | Example                                   | Description                                                  |
| :---------------- | :---------------------------------------- | :----------------------------------------------------------- |
| Basic types       | `int`, `float`, `str`, `bool`             | Simple scalar values                                         |
| Binary data       | `bytes`                                   | Binary content (raw strings, not auto-decoded base64)        |
| Date and Time     | `datetime`, `date`, `timedelta`           | Date and time objects (ISO format strings)                   |
| Collection types  | `list[str]`, `dict[str, int]`, `set[int]` | Collections of items                                         |
| Optional types    | `float \| None`, `Optional[float]`        | Parameters that may be null/omitted                          |
| Union types       | `str \| int`, `Union[str, int]`           | Parameters accepting multiple types                          |
| Constrained types | `Literal["A", "B"]`, `Enum`               | Parameters with specific allowed values                      |
| Paths             | `Path`                                    | File system paths (auto-converted from strings)              |
| UUIDs             | `UUID`                                    | Universally unique identifiers (auto-converted from strings) |
| Pydantic models   | `UserData`                                | Complex structured data with validation                      |

FastMCP supports all types that Pydantic supports as fields, including all Pydantic custom types. A few FastMCP-specific behaviors to note:

**Binary Data**: `bytes` parameters accept raw strings without automatic base64 decoding. For base64 data, use `str` and decode manually with `base64.b64decode()`.

**Enums**: Clients send enum values (`"red"`), not names (`"RED"`). Your function receives the Enum member (`Color.RED`).

**Paths and UUIDs**: String inputs are automatically converted to `Path` and `UUID` objects.

**Pydantic Models**: Must be provided as JSON objects (dicts), not stringified JSON. Even with flexible validation, `{"user": {"name": "Alice"}}` works, but `{"user": '{"name": "Alice"}'}` does not.

### Optional Arguments

FastMCP follows Python's standard function parameter conventions. Parameters without default values are required, while those with default values are optional.

```python
@mcp.tool
def search_products(
    query: str,                   # Required - no default value
    max_results: int = 10,        # Optional - has default value
    sort_by: str = "relevance",   # Optional - has default value
    category: str | None = None   # Optional - can be None
) -> list[dict]:
    """Search the product catalog."""
    # Implementation...
```

In this example, the LLM must provide a `query` parameter, while `max_results`, `sort_by`, and `category` will use their default values if not explicitly provided.

### Validation Modes

By default, FastMCP uses Pydantic's flexible validation that coerces compatible inputs to match your type annotations. This improves compatibility with LLM clients that may send string representations of values (like `"10"` for an integer parameter).

If you need stricter validation that rejects any type mismatches, you can enable strict input validation. Strict mode uses the MCP SDK's built-in JSON Schema validation to validate inputs against the exact schema before passing them to your function:

```python
# Enable strict validation for this server
mcp = FastMCP("StrictServer", strict_input_validation=True)

@mcp.tool
def add_numbers(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

# With strict_input_validation=True, sending {"a": "10", "b": "20"} will fail
# With strict_input_validation=False (default), it will be coerced to integers
```

**Validation Behavior Comparison:**

| Input Type                                                | strict\_input\_validation=False (default) | strict\_input\_validation=True |
| :-------------------------------------------------------- | :---------------------------------------- | :----------------------------- |
| String integers (`"10"` for `int`)                        | ✅ Coerced to integer                      | ❌ Validation error             |
| String floats (`"3.14"` for `float`)                      | ✅ Coerced to float                        | ❌ Validation error             |
| String booleans (`"true"` for `bool`)                     | ✅ Coerced to boolean                      | ❌ Validation error             |
| Lists with string elements (`["1", "2"]` for `list[int]`) | ✅ Elements coerced                        | ❌ Validation error             |
| Pydantic model fields with type mismatches                | ✅ Fields coerced                          | ❌ Validation error             |
| Invalid values (`"abc"` for `int`)                        | ❌ Validation error                        | ❌ Validation error             |

> **Note:** **Note on Pydantic Models:** Even with `strict_input_validation=False`, Pydantic model parameters must be provided as JSON objects (dicts), not as stringified JSON. For example, `{"user": {"name": "Alice"}}` works, but `{"user": '{"name": "Alice"}'}` does not.


The default flexible validation mode is recommended for most use cases as it handles common LLM client behaviors gracefully while still providing strong type safety through Pydantic's validation.

### Parameter Metadata

You can provide additional metadata about parameters in several ways:

#### Simple String Descriptions

For basic parameter descriptions, you can use a convenient shorthand with `Annotated`:

```python
from typing import Annotated

@mcp.tool
def process_image(
    image_url: Annotated[str, "URL of the image to process"],
    resize: Annotated[bool, "Whether to resize the image"] = False,
    width: Annotated[int, "Target width in pixels"] = 800,
    format: Annotated[str, "Output image format"] = "jpeg"
) -> dict:
    """Process an image with optional resizing."""
    # Implementation...
```

This shorthand syntax is equivalent to using `Field(description=...)` but more concise for simple descriptions.

> **Tip:** This shorthand syntax is only applied to `Annotated` types with a single string description.


#### Advanced Metadata with Field

For validation constraints and advanced metadata, use Pydantic's `Field` class with `Annotated`:

```python
from typing import Annotated
from pydantic import Field

@mcp.tool
def process_image(
    image_url: Annotated[str, Field(description="URL of the image to process")],
    resize: Annotated[bool, Field(description="Whether to resize the image")] = False,
    width: Annotated[int, Field(description="Target width in pixels", ge=1, le=2000)] = 800,
    format: Annotated[
        Literal["jpeg", "png", "webp"], 
        Field(description="Output image format")
    ] = "jpeg"
) -> dict:
    """Process an image with optional resizing."""
    # Implementation...
```

You can also use the Field as a default value, though the Annotated approach is preferred:

```python
@mcp.tool
def search_database(
    query: str = Field(description="Search query string"),
    limit: int = Field(10, description="Maximum number of results", ge=1, le=100)
) -> list:
    """Search the database with the provided query."""
    # Implementation...
```

Field provides several validation and documentation features:

* `description`: Human-readable explanation of the parameter (shown to LLMs)
* `ge`/`gt`/`le`/`lt`: Greater/less than (or equal) constraints
* `min_length`/`max_length`: String or collection length constraints
* `pattern`: Regex pattern for string validation
* `default`: Default value if parameter is omitted

### Hiding Parameters from the LLM

To inject values at runtime without exposing them to the LLM (such as `user_id`, credentials, or database connections), use dependency injection with `Depends()`. Parameters using `Depends()` are automatically excluded from the tool schema:

```python
from fastmcp import FastMCP
from fastmcp.dependencies import Depends

mcp = FastMCP()

def get_user_id() -> str:
    return "user_123"  # Injected at runtime

@mcp.tool
def get_user_details(user_id: str = Depends(get_user_id)) -> str:
    # user_id is injected by the server, not provided by the LLM
    return f"Details for {user_id}"
```

See Custom Dependencies for more details on dependency injection.

## Return Values

FastMCP tools can return data in two complementary formats: **traditional content blocks** (like text and images) and **structured outputs** (machine-readable JSON). When you add return type annotations, FastMCP automatically generates **output schemas** to validate the structured data and enables clients to deserialize results back to Python objects.

Understanding how these three concepts work together:

* **Return Values**: What your Python function returns (determines both content blocks and structured data)
* **Structured Outputs**: JSON data sent alongside traditional content for machine processing
* **Output Schemas**: JSON Schema declarations that describe and validate the structured output format

The following sections explain each concept in detail.

### Content Blocks

FastMCP automatically converts tool return values into appropriate MCP content blocks:

* **`str`**: Sent as `TextContent`
* **`bytes`**: Base64 encoded and sent as `BlobResourceContents` (within an `EmbeddedResource`)
* **`fastmcp.utilities.types.Image`**: Sent as `ImageContent`
* **`fastmcp.utilities.types.Audio`**: Sent as `AudioContent`
* **`fastmcp.utilities.types.File`**: Sent as base64-encoded `EmbeddedResource`
* **MCP SDK content blocks**: Sent as-is
* **A list of any of the above**: Converts each item according to the above rules
* **`None`**: Results in an empty response

#### Media Helper Classes

FastMCP provides helper classes for returning images, audio, and files. When you return one of these classes, either directly or as part of a list, FastMCP automatically converts it to the appropriate MCP content block. For example, if you return a `fastmcp.utilities.types.Image` object, FastMCP will convert it to an MCP `ImageContent` block with the correct MIME type and base64 encoding.

```python
from fastmcp.utilities.types import Image, Audio, File

@mcp.tool
def get_chart() -> Image:
    """Generate a chart image."""
    return Image(path="chart.png")

@mcp.tool
def get_multiple_charts() -> list[Image]:
    """Return multiple charts."""
    return [Image(path="chart1.png"), Image(path="chart2.png")]
```

> **Tip:** Helper classes are only automatically converted to MCP content blocks when returned **directly** or as part of a **list**. For more complex containers like dicts, you can manually convert them to MCP types:

  ```python
  # ✅ Automatic conversion
  return Image(path="chart.png")
  return [Image(path="chart1.png"), "text content"]

  # ❌ Will not be automatically converted
  return {"image": Image(path="chart.png")}

  # ✅ Manual conversion for nested use
  return {"image": Image(path="chart.png").to_image_content()}
  ```


Each helper class accepts either `path=` or `data=` (mutually exclusive):

* **`path`**: File path (string or Path object) - MIME type detected from extension
* **`data`**: Raw bytes - requires `format=` parameter for MIME type
* **`format`**: Optional format override (e.g., "png", "wav", "pdf")
* **`name`**: Optional name for `File` when using `data=`
* **`annotations`**: Optional MCP annotations for the content

### Structured Output

The 6/18/2025 MCP spec update [introduced](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#structured-content) structured content, which is a new way to return data from tools. Structured content is a JSON object that is sent alongside traditional content. FastMCP automatically creates structured outputs alongside traditional content when your tool returns data that has a JSON object representation. This provides machine-readable JSON data that clients can deserialize back to Python objects.

**Automatic Structured Content Rules:**

* **Object-like results** (`dict`, Pydantic models, dataclasses) → Always become structured content (even without output schema)
* **Non-object results** (`int`, `str`, `list`) → Only become structured content if there's an output schema to validate/serialize them
* **All results** → Always become traditional content blocks for backward compatibility

> **Note:** This automatic behavior enables clients to receive machine-readable data alongside human-readable content without requiring explicit output schemas for object-like returns.


#### Dictionaries and Objects

When your tool returns a dictionary, dataclass, or Pydantic model, FastMCP automatically creates structured content from it. The structured content contains the actual object data, making it easy for clients to deserialize back to native objects.


  ```python Tool Definition}
  @mcp.tool
  def get_user_data(user_id: str) -> dict:
      """Get user data."""
      return {"name": "Alice", "age": 30, "active": True}
  ```

  ```json MCP Result}
  {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"name\": \"Alice\",\n  \"age\": 30,\n  \"active\": true\n}"
      }
    ],
    "structuredContent": {
      "name": "Alice",
      "age": 30,
      "active": true
    }
  }
  ```


#### Primitives and Collections

When your tool returns a primitive type (int, str, bool) or a collection (list, set), FastMCP needs a return type annotation to generate structured content. The annotation tells FastMCP how to validate and serialize the result.

Without a type annotation, the tool only produces `content`:


  ```python Tool Definition}
  @mcp.tool
  def calculate_sum(a: int, b: int):
      """Calculate sum without return annotation."""
      return a + b  # Returns 8
  ```

  ```json MCP Result}
  {
    "content": [
      {
        "type": "text",
        "text": "8"
      }
    ]
  }
  ```


When you add a return annotation, such as `-> int`, FastMCP generates `structuredContent` by wrapping the primitive value in a `{"result": ...}` object, since JSON schemas require object-type roots for structured output:


  ```python Tool Definition}
  @mcp.tool
  def calculate_sum(a: int, b: int) -> int:
      """Calculate sum with return annotation."""
      return a + b  # Returns 8
  ```

  ```json MCP Result}
  {
    "content": [
      {
        "type": "text",
        "text": "8"
      }
    ],
    "structuredContent": {
      "result": 8
    }
  }
  ```


#### Typed Models

Return type annotations work with any type that can be converted to a JSON schema. Dataclasses and Pydantic models are particularly useful because FastMCP extracts their field definitions to create detailed schemas.


  ```python Tool Definition}
  from dataclasses import dataclass
  from fastmcp import FastMCP

  mcp = FastMCP()

  @dataclass
  class Person:
      name: str
      age: int
      email: str

  @mcp.tool
  def get_user_profile(user_id: str) -> Person:
      """Get a user's profile information."""
      return Person(
          name="Alice",
          age=30,
          email="alice@example.com",
      )
  ```

  ```json Generated Output Schema}
  {
    "properties": {
      "name": {"title": "Name", "type": "string"},
      "age": {"title": "Age", "type": "integer"},
      "email": {"title": "Email", "type": "string"}
    },
    "required": ["name", "age", "email"],
    "title": "Person",
    "type": "object"
  }
  ```

  ```json MCP Result}
  {
    "content": [
      {
        "type": "text",
        "text": "{\"name\": \"Alice\", \"age\": 30, \"email\": \"alice@example.com\"}"
      }
    ],
    "structuredContent": {
      "name": "Alice",
      "age": 30,
      "email": "alice@example.com"
    }
  }
  ```


The `Person` dataclass becomes an output schema (second tab) that describes the expected format. When executed, clients receive the result (third tab) with both `content` and `structuredContent` fields.

### Output Schemas

The 6/18/2025 MCP spec update [introduced](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#output-schema) output schemas, which are a new way to describe the expected output format of a tool. When an output schema is provided, the tool *must* return structured output that matches the schema.

When you add return type annotations to your functions, FastMCP automatically generates JSON schemas that describe the expected output format. These schemas help MCP clients understand and validate the structured data they receive.

#### Primitive Type Wrapping

For primitive return types (like `int`, `str`, `bool`), FastMCP automatically wraps the result under a `"result"` key to create valid structured output:


  ```python Primitive Return Type}
  @mcp.tool
  def calculate_sum(a: int, b: int) -> int:
      """Add two numbers together."""
      return a + b
  ```

  ```json Generated Schema (Wrapped)}
  {
    "type": "object",
    "properties": {
      "result": {"type": "integer"}
    },
    "x-fastmcp-wrap-result": true
  }
  ```

  ```json Structured Output}
  {
    "result": 8
  }
  ```


#### Manual Schema Control

You can override the automatically generated schema by providing a custom `output_schema`:

```python
@mcp.tool(output_schema={
    "type": "object", 
    "properties": {
        "data": {"type": "string"},
        "metadata": {"type": "object"}
    }
})
def custom_schema_tool() -> dict:
    """Tool with custom output schema."""
    return {"data": "Hello", "metadata": {"version": "1.0"}}
```

Schema generation works for most common types including basic types, collections, union types, Pydantic models, TypedDict structures, and dataclasses.

> **Warning:** **Important Constraints**:

  * Output schemas must be object types (`"type": "object"`)
  * If you provide an output schema, your tool **must** return structured output that matches it
  * However, you can provide structured output without an output schema (using `ToolResult`)


### ToolResult and Metadata

For complete control over tool responses, return a `ToolResult` object. This gives you explicit control over all aspects of the tool's output: traditional content, structured data, and metadata.

```python
from fastmcp.tools.tool import ToolResult
from mcp.types import TextContent

@mcp.tool
def advanced_tool() -> ToolResult:
    """Tool with full control over output."""
    return ToolResult(
        content=[TextContent(type="text", text="Human-readable summary")],
        structured_content={"data": "value", "count": 42},
        meta={"execution_time_ms": 145}
    )
```

`ToolResult` accepts three fields:

**`content`** - The traditional MCP content blocks that clients display to users. Can be a string (automatically converted to `TextContent`), a list of MCP content blocks, or any serializable value (converted to JSON string). At least one of `content` or `structured_content` must be provided.

```python
# Simple string
ToolResult(content="Hello, world!")

# List of content blocks
ToolResult(content=[
    TextContent(type="text", text="Result: 42"),
    ImageContent(type="image", data="base64...", mimeType="image/png")
])
```

**`structured_content`** - A dictionary containing structured data that matches your tool's output schema. This enables clients to programmatically process the results. If you provide `structured_content`, it must be a dictionary or `None`. If only `structured_content` is provided, it will also be used as `content` (converted to JSON string).

```python
ToolResult(
    content="Found 3 users",
    structured_content={"users": [{"name": "Alice"}, {"name": "Bob"}]}
)
```

**`meta`**

Runtime metadata about the tool execution. Use this for performance metrics, debugging information, or any client-specific data that doesn't belong in the content or structured output.

```python
ToolResult(
    content="Analysis complete",
    structured_content={"result": "positive"},
    meta={
        "execution_time_ms": 145,
        "model_version": "2.1",
        "confidence": 0.95
    }
)
```

> **Note:** The `meta` field in `ToolResult` is for runtime metadata about tool execution (e.g., execution time, performance metrics). This is separate from the `meta` parameter in `@mcp.tool(meta={...})`, which provides static metadata about the tool definition itself.


When returning `ToolResult`, you have full control - FastMCP won't automatically wrap or transform your data. `ToolResult` can be returned with or without an output schema.

### Custom Serialization

When you need custom serialization (like YAML, Markdown tables, or specialized formats), return `ToolResult` with your serialized content. This makes the serialization explicit and visible in your tool's code:

```python
import yaml
from fastmcp import FastMCP
from fastmcp.tools.tool import ToolResult

mcp = FastMCP("MyServer")

@mcp.tool
def get_config() -> ToolResult:
    """Returns configuration as YAML."""
    data = {"api_key": "abc123", "debug": True, "rate_limit": 100}
    return ToolResult(
        content=yaml.dump(data, sort_keys=False),
        structured_content=data
    )
```

> **Tip:** For reusable serialization across multiple tools, create a wrapper decorator that returns `ToolResult`. This lets you compose serializers with other behaviors (logging, validation, caching) and keeps the serialization visible at the tool definition. See [examples/custom\_tool\_serializer\_decorator.py](https://github.com/jlowin/fastmcp/blob/main/examples/custom_tool_serializer_decorator.py) for a complete implementation.


## Error Handling

If your tool encounters an error, you can raise a standard Python exception (`ValueError`, `TypeError`, `FileNotFoundError`, custom exceptions, etc.) or a FastMCP `ToolError`.

By default, all exceptions (including their details) are logged and converted into an MCP error response to be sent back to the client LLM. This helps the LLM understand failures and react appropriately.

If you want to mask internal error details for security reasons, you can:

1. Use the `mask_error_details=True` parameter when creating your `FastMCP` instance:

```python
mcp = FastMCP(name="SecureServer", mask_error_details=True)
```

2. Or use `ToolError` to explicitly control what error information is sent to clients:

```python
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

@mcp.tool
def divide(a: float, b: float) -> float:
    """Divide a by b."""

    if b == 0:
        # Error messages from ToolError are always sent to clients,
        # regardless of mask_error_details setting
        raise ToolError("Division by zero is not allowed.")
    
    # If mask_error_details=True, this message would be masked
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers.")
        
    return a / b
```

When `mask_error_details=True`, only error messages from `ToolError` will include details, other exceptions will be converted to a generic message.

## Timeouts

Tools can specify a `timeout` parameter to limit how long execution can take. When the timeout is exceeded, the client receives an MCP error and the tool stops processing. This protects your server from unexpectedly slow operations that could block resources or leave clients waiting indefinitely.

```python
from fastmcp import FastMCP

mcp = FastMCP()

@mcp.tool(timeout=30.0)
async def fetch_data(url: str) -> dict:
    """Fetch data with a 30-second timeout."""
    # If this takes longer than 30 seconds,
    # the client receives an MCP error
    ...
```

Timeouts are specified in seconds as a float. When a tool exceeds its timeout, FastMCP returns an MCP error with code `-32000` and a message indicating which tool timed out and how long it ran. Both sync and async tools support timeouts—sync functions run in thread pools, so the timeout applies to the entire operation regardless of execution model.

> **Note:** Tools must explicitly opt-in to timeouts. There is no server-level default timeout setting.


### Timeouts vs Background Tasks

Timeouts apply to **foreground execution**—when a tool runs directly in response to a client request. They protect your server from tools that unexpectedly hang due to network issues, resource contention, or other transient problems.

> **Warning:** The `timeout` parameter does **not** apply to background tasks. When a tool runs as a background task (`task=True`), execution happens in a Docket worker where the FastMCP timeout is not enforced.

  For task timeouts, use Docket's `Timeout` dependency directly in your function signature:

  ```python
  from datetime import timedelta
  from docket import Timeout

  @mcp.tool(task=True)
  async def long_running_task(
      data: str,
      timeout: Timeout = Timeout(timedelta(minutes=10))
  ) -> str:
      """Task with a 10-minute timeout enforced by Docket."""
      ...
  ```

  See the [Docket documentation](https://chrisguidry.github.io/docket/dependencies/#task-timeouts) for more on task timeouts and retries.


When a tool times out, FastMCP logs a warning suggesting task mode. For operations you know will be long-running, use `task=True` instead—background tasks offload work to distributed workers and let clients poll for progress.

## Component Visibility

You can control which tools are enabled for clients using server-level enabled control. Disabled tools don't appear in `list_tools` and can't be called.

```python
from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool(tags={"admin"})
def admin_action() -> str:
    """Admin-only action."""
    return "Done"

@mcp.tool(tags={"public"})
def public_action() -> str:
    """Public action."""
    return "Done"

# Disable specific tools by key
mcp.disable(keys={"tool:admin_action"})

# Disable tools by tag
mcp.disable(tags={"admin"})

# Or use allowlist mode - only enable tools with specific tags
mcp.enable(tags={"public"}, only=True)
```

See Visibility for the complete visibility control API including key formats, tag-based filtering, and provider-level control.

## MCP Annotations

FastMCP allows you to add specialized metadata to your tools through annotations. These annotations communicate how tools behave to client applications without consuming token context in LLM prompts.

Annotations serve several purposes in client applications:

* Adding user-friendly titles for display purposes
* Indicating whether tools modify data or systems
* Describing the safety profile of tools (destructive vs. non-destructive)
* Signaling if tools interact with external systems

You can add annotations to a tool using the `annotations` parameter in the `@mcp.tool` decorator:

```python
@mcp.tool(
    annotations={
        "title": "Calculate Sum",
        "readOnlyHint": True,
        "openWorldHint": False
    }
)
def calculate_sum(a: float, b: float) -> float:
    """Add two numbers together."""
    return a + b
```

FastMCP supports these standard annotations:

| Annotation        | Type    | Default | Purpose                                                                     |
| :---------------- | :------ | :------ | :-------------------------------------------------------------------------- |
| `title`           | string  | -       | Display name for user interfaces                                            |
| `readOnlyHint`    | boolean | false   | Indicates if the tool only reads without making changes                     |
| `destructiveHint` | boolean | true    | For non-readonly tools, signals if changes are destructive                  |
| `idempotentHint`  | boolean | false   | Indicates if repeated identical calls have the same effect as a single call |
| `openWorldHint`   | boolean | true    | Specifies if the tool interacts with external systems                       |

Remember that annotations help make better user experiences but should be treated as advisory hints. They help client applications present appropriate UI elements and safety controls, but won't enforce security boundaries on their own. Always focus on making your annotations accurately represent what your tool actually does.

### Using Annotation Hints

MCP clients like Claude and ChatGPT use annotation hints to determine when to skip confirmation prompts and how to present tools to users. The most commonly used hint is `readOnlyHint`, which signals that a tool only reads data without making changes.

**Read-only tools** improve user experience by:

* Skipping confirmation prompts for safe operations
* Allowing broader access without security concerns
* Enabling more aggressive batching and caching

Mark a tool as read-only when it retrieves data, performs calculations, or checks status without modifying state:

```python
from fastmcp import FastMCP
from mcp.types import ToolAnnotations

mcp = FastMCP("Data Server")

@mcp.tool(annotations={"readOnlyHint": True})
def get_user(user_id: str) -> dict:
    """Retrieve user information by ID."""
    return {"id": user_id, "name": "Alice"}

@mcp.tool(
    annotations=ToolAnnotations(
        readOnlyHint=True,
        idempotentHint=True,  # Same result for repeated calls
        openWorldHint=False   # Only internal data
    )
)
def search_products(query: str) -> list[dict]:
    """Search the product catalog."""
    return [{"id": 1, "name": "Widget", "price": 29.99}]

# Write operations - no readOnlyHint
@mcp.tool()
def update_user(user_id: str, name: str) -> dict:
    """Update user information."""
    return {"id": user_id, "name": name, "updated": True}

@mcp.tool(annotations={"destructiveHint": True})
def delete_user(user_id: str) -> dict:
    """Permanently delete a user account."""
    return {"deleted": user_id}
```

For tools that write to databases, send notifications, create/update/delete resources, or trigger workflows, omit `readOnlyHint` or set it to `False`. Use `destructiveHint=True` for operations that cannot be undone.

Client-specific behavior:

* **ChatGPT**: Skips confirmation prompts for read-only tools in Chat mode (see ChatGPT integration)
* **Claude**: Uses hints to understand tool safety profiles and make better execution decisions

## Notifications

FastMCP automatically sends `notifications/tools/list_changed` notifications to connected clients when tools are added, removed, enabled, or disabled. This allows clients to stay up-to-date with the current tool set without manually polling for changes.

```python
@mcp.tool
def example_tool() -> str:
    return "Hello!"

# These operations trigger notifications:
mcp.add_tool(example_tool)              # Sends tools/list_changed notification
mcp.disable(keys={"tool:example_tool"}) # Sends tools/list_changed notification
mcp.enable(keys={"tool:example_tool"})  # Sends tools/list_changed notification
mcp.local_provider.remove_tool("example_tool")  # Sends tools/list_changed notification
```

Notifications are only sent when these operations occur within an active MCP request context (e.g., when called from within a tool or other MCP operation). Operations performed during server initialization do not trigger notifications.

Clients can handle these notifications using a message handler to automatically refresh their tool lists or update their interfaces.

## Accessing the MCP Context

Tools can access MCP features like logging, reading resources, or reporting progress through the `Context` object. To use it, add a parameter to your tool function with the type hint `Context`.

```python
from fastmcp import FastMCP, Context

mcp = FastMCP(name="ContextDemo")

@mcp.tool
async def process_data(data_uri: str, ctx: Context) -> dict:
    """Process data from a resource with progress reporting."""
    await ctx.info(f"Processing data from {data_uri}")
    
    # Read a resource
    resource = await ctx.read_resource(data_uri)
    data = resource[0].content if resource else ""
    
    # Report progress
    await ctx.report_progress(progress=50, total=100)
    
    # Example request to the client's LLM for help
    summary = await ctx.sample(f"Summarize this in 10 words: {data[:200]}")
    
    await ctx.report_progress(progress=100, total=100)
    return {
        "length": len(data),
        "summary": summary.text
    }
```

The Context object provides access to:

* **Logging**: `ctx.debug()`, `ctx.info()`, `ctx.warning()`, `ctx.error()`
* **Progress Reporting**: `ctx.report_progress(progress, total)`
* **Resource Access**: `ctx.read_resource(uri)`
* **LLM Sampling**: `ctx.sample(...)`
* **Request Information**: `ctx.request_id`, `ctx.client_id`

For full documentation on the Context object and all its capabilities, see the Context documentation.

## Server Behavior

### Duplicate Tools

You can control how the FastMCP server behaves if you try to register multiple tools with the same name. This is configured using the `on_duplicate_tools` argument when creating the `FastMCP` instance.

```python
from fastmcp import FastMCP

mcp = FastMCP(
    name="StrictServer",
    # Configure behavior for duplicate tool names
    on_duplicate_tools="error"
)

@mcp.tool
def my_tool(): return "Version 1"

# This will now raise a ValueError because 'my_tool' already exists
# and on_duplicate_tools is set to "error".
# @mcp.tool
# def my_tool(): return "Version 2"
```

The duplicate behavior options are:

* `"warn"` (default): Logs a warning and the new tool replaces the old one.
* `"error"`: Raises a `ValueError`, preventing the duplicate registration.
* `"replace"`: Silently replaces the existing tool with the new one.
* `"ignore"`: Keeps the original tool and ignores the new registration attempt.

### Removing Tools

You can dynamically remove tools from a server through its local provider:

```python
from fastmcp import FastMCP

mcp = FastMCP(name="DynamicToolServer")

@mcp.tool
def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

mcp.local_provider.remove_tool("calculate_sum")
```

## Versioning

Tools support versioning, allowing you to maintain multiple implementations under the same name while clients automatically receive the highest version. See Versioning for complete documentation on version comparison, retrieval, and migration patterns.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
