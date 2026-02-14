# User Elicitation

> Request structured input from users during tool execution through the MCP context.

User elicitation allows MCP servers to request structured input from users during tool execution. Instead of requiring all inputs upfront, tools can interactively ask for missing parameters, clarification, or additional context as needed.

Elicitation enables tools to pause execution and request specific information from users:

* **Missing parameters**: Ask for required information not provided initially
* **Clarification requests**: Get user confirmation or choices for ambiguous scenarios
* **Progressive disclosure**: Collect complex information step-by-step
* **Dynamic workflows**: Adapt tool behavior based on user responses

For example, a file management tool might ask "Which directory should I create?" or a data analysis tool might request "What date range should I analyze?"

## Overview

Use the `ctx.elicit()` method within any tool function to request user input. Specify the message to display and the type of response you expect.

```python
from fastmcp import FastMCP, Context
from dataclasses import dataclass

mcp = FastMCP("Elicitation Server")

@dataclass
class UserInfo:
    name: str
    age: int

@mcp.tool
async def collect_user_info(ctx: Context) -> str:
    """Collect user information through interactive prompts."""
    result = await ctx.elicit(
        message="Please provide your information",
        response_type=UserInfo
    )

    if result.action == "accept":
        user = result.data
        return f"Hello {user.name}, you are {user.age} years old"
    elif result.action == "decline":
        return "Information not provided"
    else:  # cancel
        return "Operation cancelled"
```

The elicitation result contains an `action` field indicating how the user responded:

| Action    | Description                                                     |
| --------- | --------------------------------------------------------------- |
| `accept`  | User provided valid input—data is available in the `data` field |
| `decline` | User chose not to provide the requested information             |
| `cancel`  | User cancelled the entire operation                             |

FastMCP also provides typed result classes for pattern matching:

```python
from fastmcp.server.elicitation import (
    AcceptedElicitation,
    DeclinedElicitation,
    CancelledElicitation,
)

@mcp.tool
async def pattern_example(ctx: Context) -> str:
    result = await ctx.elicit("Enter your name:", response_type=str)

    match result:
        case AcceptedElicitation(data=name):
            return f"Hello {name}!"
        case DeclinedElicitation():
            return "No name provided"
        case CancelledElicitation():
            return "Operation cancelled"
```

### Multi-Turn Elicitation

Tools can make multiple elicitation calls to gather information progressively:

```python
@mcp.tool
async def plan_meeting(ctx: Context) -> str:
    """Plan a meeting by gathering details step by step."""

    title_result = await ctx.elicit("What's the meeting title?", response_type=str)
    if title_result.action != "accept":
        return "Meeting planning cancelled"

    duration_result = await ctx.elicit("Duration in minutes?", response_type=int)
    if duration_result.action != "accept":
        return "Meeting planning cancelled"

    priority_result = await ctx.elicit(
        "Is this urgent?",
        response_type=["yes", "no"]
    )
    if priority_result.action != "accept":
        return "Meeting planning cancelled"

    urgent = priority_result.data == "yes"
    return f"Meeting '{title_result.data}' for {duration_result.data} minutes (Urgent: {urgent})"
```

### Client Requirements

Elicitation requires the client to implement an elicitation handler. If a client doesn't support elicitation, calls to `ctx.elicit()` will raise an error indicating that elicitation is not supported.

See Client Elicitation for details on how clients handle these requests.

## Schema and Response Types

The server must send a schema to the client indicating the type of data it expects in response to the elicitation request. The MCP spec only supports a limited subset of JSON Schema types for elicitation responses—specifically JSON **objects** with **primitive** properties including `string`, `number` (or `integer`), `boolean`, and `enum` fields.

FastMCP makes it easy to request a broader range of types, including scalars (e.g. `str`) or no response at all, by automatically wrapping them in MCP-compatible object schemas.

### Scalar Types

You can request simple scalar data types for basic input, such as a string, integer, or boolean. When you request a scalar type, FastMCP automatically wraps it in an object schema for MCP spec compatibility. Clients will see a schema requesting a single "value" field of the requested type. Once clients respond, the provided object is "unwrapped" and the scalar value is returned directly in the `data` field.


  ```python title="String"}
  @mcp.tool
  async def get_user_name(ctx: Context) -> str:
      result = await ctx.elicit("What's your name?", response_type=str)

      if result.action == "accept":
          return f"Hello, {result.data}!"
      return "No name provided"
  ```

  ```python title="Integer"}
  @mcp.tool
  async def pick_a_number(ctx: Context) -> str:
      result = await ctx.elicit("Pick a number!", response_type=int)

      if result.action == "accept":
          return f"You picked {result.data}"
      return "No number provided"
  ```

  ```python title="Boolean"}
  @mcp.tool
  async def pick_a_boolean(ctx: Context) -> str:
      result = await ctx.elicit("True or false?", response_type=bool)

      if result.action == "accept":
          return f"You picked {result.data}"
      return "No boolean provided"
  ```


### No Response

Sometimes, the goal of an elicitation is to simply get a user to approve or reject an action. Pass `None` as the response type to indicate that no data is expected. The `data` field will be `None` when the user accepts.

```python
@mcp.tool
async def approve_action(ctx: Context) -> str:
    result = await ctx.elicit("Approve this action?", response_type=None)

    if result.action == "accept":
        return do_action()
    else:
        raise ValueError("Action rejected")
```

### Constrained Options

Constrain the user's response to a specific set of values using a `Literal` type, Python enum, or a list of strings as a convenient shortcut.


  ```python title="List of strings"}
  @mcp.tool
  async def set_priority(ctx: Context) -> str:
      result = await ctx.elicit(
          "What priority level?",
          response_type=["low", "medium", "high"],
      )

      if result.action == "accept":
          return f"Priority set to: {result.data}"
  ```

  ```python title="Literal type"}
  from typing import Literal

  @mcp.tool
  async def set_priority(ctx: Context) -> str:
      result = await ctx.elicit(
          "What priority level?",
          response_type=Literal["low", "medium", "high"]
      )

      if result.action == "accept":
          return f"Priority set to: {result.data}"
      return "No priority set"
  ```

  ```python title="Python enum"}
  from enum import Enum

  class Priority(Enum):
      LOW = "low"
      MEDIUM = "medium"
      HIGH = "high"

  @mcp.tool
  async def set_priority(ctx: Context) -> str:
      result = await ctx.elicit("What priority level?", response_type=Priority)

      if result.action == "accept":
          return f"Priority set to: {result.data.value}"
      return "No priority set"
  ```


### Multi-Select

Enable multi-select by wrapping your choices in an additional list level. This allows users to select multiple values from the available options.


  ```python title="List of strings"}
  @mcp.tool
  async def select_tags(ctx: Context) -> str:
      result = await ctx.elicit(
          "Choose tags",
          response_type=[["bug", "feature", "documentation"]]  # Note: list of a list
      )

      if result.action == "accept":
          tags = result.data
          return f"Selected tags: {', '.join(tags)}"
  ```

  ```python title="list[Enum] type"}
  from enum import Enum

  class Tag(Enum):
      BUG = "bug"
      FEATURE = "feature"
      DOCS = "documentation"

  @mcp.tool
  async def select_tags(ctx: Context) -> str:
      result = await ctx.elicit(
          "Choose tags",
          response_type=list[Tag]
      )
      if result.action == "accept":
          tags = [tag.value for tag in result.data]
          return f"Selected: {', '.join(tags)}"
  ```


### Titled Options

For better UI display, provide human-readable titles for enum options. FastMCP generates SEP-1330 compliant schemas using the `oneOf` pattern with `const` and `title` fields.

```python
@mcp.tool
async def set_priority(ctx: Context) -> str:
    result = await ctx.elicit(
        "What priority level?",
        response_type={
            "low": {"title": "Low Priority"},
            "medium": {"title": "Medium Priority"},
            "high": {"title": "High Priority"}
        }
    )

    if result.action == "accept":
        return f"Priority set to: {result.data}"
```

For multi-select with titles, wrap the dict in a list:

```python
@mcp.tool
async def select_priorities(ctx: Context) -> str:
    result = await ctx.elicit(
        "Choose priorities",
        response_type=[{
            "low": {"title": "Low Priority"},
            "medium": {"title": "Medium Priority"},
            "high": {"title": "High Priority"}
        }]
    )

    if result.action == "accept":
        return f"Selected: {', '.join(result.data)}"
```

### Structured Responses

Request structured data with multiple fields by using a dataclass, typed dict, or Pydantic model as the response type. Note that the MCP spec only supports shallow objects with scalar (string, number, boolean) or enum properties.

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class TaskDetails:
    title: str
    description: str
    priority: Literal["low", "medium", "high"]
    due_date: str

@mcp.tool
async def create_task(ctx: Context) -> str:
    result = await ctx.elicit(
        "Please provide task details",
        response_type=TaskDetails
    )

    if result.action == "accept":
        task = result.data
        return f"Created task: {task.title} (Priority: {task.priority})"
    return "Task creation cancelled"
```

### Default Values

Provide default values for elicitation fields using Pydantic's `Field(default=...)`. Clients will pre-populate form fields with these defaults. Fields with default values are automatically marked as optional.

```python
from pydantic import BaseModel, Field
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class TaskDetails(BaseModel):
    title: str = Field(description="Task title")
    description: str = Field(default="", description="Task description")
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority")

@mcp.tool
async def create_task(ctx: Context) -> str:
    result = await ctx.elicit("Please provide task details", response_type=TaskDetails)
    if result.action == "accept":
        return f"Created: {result.data.title}"
    return "Task creation cancelled"
```

Default values are supported for strings, integers, numbers, booleans, and enums.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
