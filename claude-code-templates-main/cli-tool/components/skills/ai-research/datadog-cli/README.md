# datadog Plugin

A Claude Code skill for debugging and triaging with [Datadog](https://www.datadoghq.com/) logs, metrics, and dashboards.

## What it does

This skill enables Claude to use the [datadog](https://github.com/leonardocouy/datadog-cli) CLI for:

- **Log search** - Query and filter logs with Datadog syntax
- **Real-time tailing** - Stream logs as they arrive
- **Trace analysis** - Follow distributed requests across services
- **Pattern detection** - Group similar log messages automatically
- **Metrics query** - Query timeseries metrics with PromQL-style syntax
- **Dashboard management** - List, create, update, and delete dashboards

## Prerequisites

1. Install the CLI from [leonardocouy/datadog-cli](https://github.com/leonardocouy/datadog-cli)

2. Set environment variables:
```bash
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"
```

Get keys from: https://app.datadoghq.com/organization-settings/api-keys

## Installation

```bash
/plugin marketplace add leonardocouy/cc-datadog
/plugin install datadog@cc-datadog
```

## Usage

Once installed, Claude will automatically use datadog commands when you ask questions like:

- "Search for error logs in the last hour"
- "Tail logs from the payments service"
- "Trace this request ID across services"
- "Show me error patterns from today"
- "What dashboards do we have?"
- "Please explain this Datadog dashboard https://app.datadoghq.com/dashboard/xxx-xxx-xxx"
- "Create a new Datadog dashboard for the metrics cpu.usage, memory.used"

## Commands Reference

| Command | Purpose |
|---------|---------|
| `datadog logs search` | Search and filter logs |
| `datadog logs tail` | Stream logs in real-time |
| `datadog logs trace` | Find logs for a trace ID |
| `datadog logs patterns` | Group similar log messages |
| `datadog logs compare` | Compare current vs previous period |
| `datadog logs context` | Get logs around a timestamp |
| `datadog logs agg` | Aggregate logs by facet |
| `datadog logs multi` | Run multiple queries in parallel |
| `datadog metrics query` | Query timeseries metrics |
| `datadog dashboards list` | List dashboards |
| `datadog dashboards get` | Get dashboard definition |
| `datadog dashboards create` | Create a dashboard |
| `datadog dashboards update` | Update a dashboard |
| `datadog dashboards delete` | Delete a dashboard |
| `datadog errors` | Quick error summary |
| `datadog services` | List services with log activity |

See the [datadog-cli](https://github.com/leonardocouy/datadog-cli) repository for complete command documentation.

## License

MIT
