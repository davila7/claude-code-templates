# Progress Reporting

> Update clients on the progress of long-running operations through the MCP context.

Progress reporting allows MCP tools to notify clients about the progress of long-running operations. Clients can display progress indicators and provide better user experience during time-consuming tasks.

## Basic Usage

Use `ctx.report_progress()` to send progress updates to the client. The method accepts a `progress` value representing how much work is complete, and an optional `total` representing the full scope of work.

```python
from fastmcp import FastMCP, Context
import asyncio

mcp = FastMCP("ProgressDemo")

@mcp.tool
async def process_items(items: list[str], ctx: Context) -> dict:
    """Process a list of items with progress updates."""
    total = len(items)
    results = []

    for i, item in enumerate(items):
        await ctx.report_progress(progress=i, total=total)
        await asyncio.sleep(0.1)
        results.append(item.upper())

    await ctx.report_progress(progress=total, total=total)
    return {"processed": len(results), "results": results}
```

## Progress Patterns

| Pattern       | Description                      | Example                           |
| ------------- | -------------------------------- | --------------------------------- |
| Percentage    | Progress as 0-100 percentage     | `progress=75, total=100`          |
| Absolute      | Completed items of a known count | `progress=3, total=10`            |
| Indeterminate | Progress without known endpoint  | `progress=files_found` (no total) |

For multi-stage operations, map each stage to a portion of the total progress range. A four-stage operation might allocate 0-25% to validation, 25-60% to export, 60-80% to transform, and 80-100% to import.

## Client Requirements

Progress reporting requires clients to support progress handling. Clients must send a `progressToken` in the initial request to receive progress updates. If no progress token is provided, progress calls have no effect (they don't error).

See Client Progress for details on implementing client-side progress handling.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
