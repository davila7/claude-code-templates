---
name: datadog-cli
description: Datadog CLI for searching logs, querying metrics, tracing requests, and managing dashboards. Use this when debugging production issues or working with Datadog observability.
---

# Datadog CLI

A CLI tool for AI agents to debug and triage using Datadog logs and metrics.

## Required Reading

**You MUST read the relevant reference docs before using any command:**
- [Log Commands](references/logs-commands.md)
- [Metrics](references/metrics.md)
- [Query Syntax](references/query-syntax.md)
- [Workflows](references/workflows.md)
- [Dashboards](references/dashboards.md)

## Setup

### Environment Variables (Required)

```bash
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"
```

Get keys from: https://app.datadoghq.com/organization-settings/api-keys

### Running the CLI

```bash
npx @leoflores/datadog-cli <command>
```

For non-US Datadog sites, use `--site` flag:
```bash
npx @leoflores/datadog-cli logs search --query "*" --site datadoghq.eu
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `logs search` | Search logs with filters |
| `logs tail` | Stream logs in real-time |
| `logs trace` | Find logs for a distributed trace |
| `logs context` | Get logs before/after a timestamp |
| `logs patterns` | Group similar log messages |
| `logs compare` | Compare log counts between periods |
| `logs multi` | Run multiple queries in parallel |
| `logs agg` | Aggregate logs by facet |
| `metrics query` | Query timeseries metrics |
| `errors` | Quick error summary by service/type |
| `services` | List services with log activity |
| `dashboards` | Manage dashboards (CRUD) |
| `dashboard-lists` | Manage dashboard lists |


## Quick Examples

### Search Errors
```bash
npx @leoflores/datadog-cli logs search --query "status:error" --from 1h --pretty
```

### Tail Logs (Real-time)
```bash
npx @leoflores/datadog-cli logs tail --query "service:api status:error" --pretty
```

### Error Summary
```bash
npx @leoflores/datadog-cli errors --from 1h --pretty
```

### Trace Correlation
```bash
npx @leoflores/datadog-cli logs trace --id "abc123def456" --pretty
```

### Query Metrics
```bash
npx @leoflores/datadog-cli metrics query --query "avg:system.cpu.user{*}" --from 1h --pretty
```

### Compare Periods
```bash
npx @leoflores/datadog-cli logs compare --query "status:error" --period 1h --pretty
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable output with colors |
| `--output <file>` | Export results to JSON file |
| `--site <site>` | Datadog site (e.g., `datadoghq.eu`) |

## Time Formats

- **Relative**: `30m`, `1h`, `6h`, `24h`, `7d`
- **ISO 8601**: `2024-01-15T10:30:00Z`

## Incident Triage Workflow

```bash
# 1. Quick error overview
npx @leoflores/datadog-cli errors --from 1h --pretty

# 2. Is this new? Compare to previous period
npx @leoflores/datadog-cli logs compare --query "status:error" --period 1h --pretty

# 3. Find error patterns
npx @leoflores/datadog-cli logs patterns --query "status:error" --from 1h --pretty

# 4. Narrow down by service
npx @leoflores/datadog-cli logs search --query "status:error service:api" --from 1h --pretty

# 5. Get context around a timestamp
npx @leoflores/datadog-cli logs context --timestamp "2024-01-15T10:30:00Z" --service api --pretty

# 6. Follow the distributed trace
npx @leoflores/datadog-cli logs trace --id "TRACE_ID" --pretty
```

See [workflows.md](references/workflows.md) for more debugging workflows.
