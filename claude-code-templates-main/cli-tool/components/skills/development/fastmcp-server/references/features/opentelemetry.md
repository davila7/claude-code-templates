# OpenTelemetry

> Native OpenTelemetry instrumentation for distributed tracing.

FastMCP includes native OpenTelemetry instrumentation for observability. Traces are automatically generated for tool, prompt, resource, and resource template operations, providing visibility into server behavior, request handling, and provider delegation chains.

## How It Works

FastMCP uses the OpenTelemetry API for instrumentation. This means:

* **Zero configuration required** - Instrumentation is always active
* **No overhead when unused** - Without an SDK, all operations are no-ops
* **Bring your own SDK** - You control collection, export, and sampling
* **Works with any OTEL backend** - Jaeger, Zipkin, Datadog, New Relic, etc.

## Enabling Telemetry

The easiest way to export traces is using `opentelemetry-instrument`, which configures the SDK automatically:

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
```

Then run your server with tracing enabled:

```bash
opentelemetry-instrument \
  --service_name my-fastmcp-server \
  --exporter_otlp_endpoint http://localhost:4317 \
  fastmcp run server.py
```

Or configure via environment variables:

```bash
export OTEL_SERVICE_NAME=my-fastmcp-server
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

opentelemetry-instrument fastmcp run server.py
```

This works with any OTLP-compatible backend (Jaeger, Zipkin, Grafana Tempo, Datadog, etc.) and requires no changes to your FastMCP code.


  Learn more about the OpenTelemetry Python SDK, auto-instrumentation, and available exporters.


## Tracing

FastMCP creates spans for all MCP operations, providing end-to-end visibility into request handling.

### Server Spans

The server creates spans for each operation using [MCP semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/):

| Span Name              | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `tools/call {name}`    | Tool execution (e.g., `tools/call get_weather`)          |
| `resources/read {uri}` | Resource read (e.g., `resources/read config://database`) |
| `prompts/get {name}`   | Prompt render (e.g., `prompts/get greeting`)             |

For mounted servers, an additional `delegate {name}` span shows the delegation to the child server.

### Client Spans

The FastMCP client creates spans for outgoing requests with the same naming pattern (`tools/call {name}`, `resources/read {uri}`, `prompts/get {name}`).

### Span Hierarchy

Spans form a hierarchy showing the request flow. For mounted servers:

```
tools/call weather_forecast (CLIENT)
  └── tools/call weather_forecast (SERVER, provider=FastMCPProvider)
        └── delegate get_weather (INTERNAL)
              └── tools/call get_weather (SERVER, provider=LocalProvider)
```

For proxy providers connecting to remote servers:

```
tools/call remote_search (CLIENT)
  └── tools/call remote_search (SERVER, provider=ProxyProvider)
        └── [remote server spans via trace context propagation]
```

## Programmatic Configuration

For more control, configure the SDK in your Python code before importing FastMCP:

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Configure the SDK with OTLP exporter
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4317"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Now import and use FastMCP - traces will be exported automatically
from fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

> **Tip:** The SDK must be configured **before** importing FastMCP to ensure the tracer provider is set when FastMCP initializes.


### Local Development

For quick local trace visualization, [otel-desktop-viewer](https://github.com/CtrlSpice/otel-desktop-viewer) is a lightweight single-binary tool:

```bash
# macOS
brew install nico-barbas/brew/otel-desktop-viewer

# Or download from GitHub releases
```

Run it alongside your server:

```bash
# Terminal 1: Start the viewer (UI at http://localhost:8000, OTLP on :4317)
otel-desktop-viewer

# Terminal 2: Run your server with tracing
opentelemetry-instrument fastmcp run server.py
```

For more features, use [Jaeger](https://www.jaegertracing.io/):

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

Then view traces at [http://localhost:16686](http://localhost:16686)

## Custom Spans

You can add your own spans using the FastMCP tracer:

```python
from fastmcp import FastMCP
from fastmcp.telemetry import get_tracer

mcp = FastMCP("custom-spans")

@mcp.tool()
async def complex_operation(input: str) -> str:
    tracer = get_tracer()

    with tracer.start_as_current_span("parse_input") as span:
        span.set_attribute("input.length", len(input))
        parsed = parse(input)

    with tracer.start_as_current_span("process_data") as span:
        span.set_attribute("data.count", len(parsed))
        result = process(parsed)

    return result
```

## Error Handling

When errors occur, spans are automatically marked with error status and the exception is recorded:

```python
@mcp.tool()
def risky_operation() -> str:
    raise ValueError("Something went wrong")

# The span will have:
# - status = ERROR
# - exception event with stack trace
```

## Attributes Reference

### RPC Semantic Conventions

Standard [RPC semantic conventions](https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/):

| Attribute     | Value               |
| ------------- | ------------------- |
| `rpc.system`  | `"mcp"`             |
| `rpc.service` | Server name         |
| `rpc.method`  | MCP protocol method |

### MCP Semantic Conventions

FastMCP implements the [OpenTelemetry MCP semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/):

| Attribute          | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `mcp.method.name`  | The MCP method being called (`tools/call`, `resources/read`, `prompts/get`) |
| `mcp.session.id`   | Session identifier for the MCP connection                                   |
| `mcp.resource.uri` | The resource URI (for resource operations)                                  |

### Auth Attributes

Standard [identity attributes](https://opentelemetry.io/docs/specs/semconv/attributes-registry/enduser/):

| Attribute       | Description                                       |
| --------------- | ------------------------------------------------- |
| `enduser.id`    | Client ID from access token (when authenticated)  |
| `enduser.scope` | Space-separated OAuth scopes (when authenticated) |

### FastMCP Custom Attributes

All custom attributes use the `fastmcp.` prefix for features unique to FastMCP:

| Attribute                | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `fastmcp.server.name`    | Server name                                                          |
| `fastmcp.component.type` | `tool`, `resource`, `prompt`, or `resource_template`                 |
| `fastmcp.component.key`  | Full component identifier (e.g., `tool:greet`)                       |
| `fastmcp.provider.type`  | Provider class (`LocalProvider`, `FastMCPProvider`, `ProxyProvider`) |

Provider-specific attributes for delegation context:

| Attribute                        | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `fastmcp.delegate.original_name` | Original tool/prompt name before namespacing |
| `fastmcp.delegate.original_uri`  | Original resource URI before namespacing     |
| `fastmcp.proxy.backend_name`     | Remote server tool/prompt name               |
| `fastmcp.proxy.backend_uri`      | Remote server resource URI                   |

## Testing with Telemetry

For testing, use the in-memory exporter:

```python
import pytest
from collections.abc import Generator
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from fastmcp import FastMCP

@pytest.fixture
def trace_exporter() -> Generator[InMemorySpanExporter, None, None]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    original_provider = trace.get_tracer_provider()
    trace.set_tracer_provider(provider)
    yield exporter
    exporter.clear()
    trace.set_tracer_provider(original_provider)

async def test_tool_creates_span(trace_exporter: InMemorySpanExporter) -> None:
    mcp = FastMCP("test")

    @mcp.tool()
    def hello() -> str:
        return "world"

    await mcp.call_tool("hello", {})

    spans = trace_exporter.get_finished_spans()
    assert any(s.name == "tools/call hello" for s in spans)
```

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
