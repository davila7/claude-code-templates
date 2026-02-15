# Client Logging

> Send log messages back to MCP clients through the context.

> **Tip:** This documentation covers **MCP client logging**—sending messages from your server to MCP clients. For standard server-side logging (e.g., writing to files, console), use `fastmcp.utilities.logging.get_logger()` or Python's built-in `logging` module.


Server logging allows MCP tools to send debug, info, warning, and error messages back to the client. Unlike standard Python logging, MCP server logging sends messages directly to the client, making them visible in the client's interface or logs.

## Basic Usage

Use the context logging methods within any tool function:

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("LoggingDemo")

@mcp.tool
async def analyze_data(data: list[float], ctx: Context) -> dict:
    """Analyze numerical data with comprehensive logging."""
    await ctx.debug("Starting analysis of numerical data")
    await ctx.info(f"Analyzing {len(data)} data points")

    try:
        if not data:
            await ctx.warning("Empty data list provided")
            return {"error": "Empty data list"}

        result = sum(data) / len(data)
        await ctx.info(f"Analysis complete, average: {result}")
        return {"average": result, "count": len(data)}

    except Exception as e:
        await ctx.error(f"Analysis failed: {str(e)}")
        raise
```

## Log Levels

| Level           | Use Case                                                        |
| --------------- | --------------------------------------------------------------- |
| `ctx.debug()`   | Detailed execution information for diagnosing problems          |
| `ctx.info()`    | General information about normal program execution              |
| `ctx.warning()` | Potentially harmful situations that don't prevent execution     |
| `ctx.error()`   | Error events that might still allow the application to continue |

## Structured Logging

All logging methods accept an `extra` parameter for sending structured data to the client. This is useful for creating rich, queryable logs.

```python
@mcp.tool
async def process_transaction(transaction_id: str, amount: float, ctx: Context):
    await ctx.info(
        f"Processing transaction {transaction_id}",
        extra={
            "transaction_id": transaction_id,
            "amount": amount,
            "currency": "USD"
        }
    )
```

## Server-Side Logs

Messages sent to clients via `ctx.log()` and its convenience methods are also logged to the server's log at `DEBUG` level. Enable debug logging on the `fastmcp.server.context.to_client` logger to see these messages:

```python
import logging
from fastmcp.utilities.logging import get_logger

to_client_logger = get_logger(name="fastmcp.server.context.to_client")
to_client_logger.setLevel(level=logging.DEBUG)
```

## Client Handling

Log messages are sent to the client through the MCP protocol. How clients handle these messages depends on their implementation—development clients may display logs in real-time, production clients may store them for analysis, and integration clients may forward them to external logging systems.

See Client Logging for details on how clients handle server log messages.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
