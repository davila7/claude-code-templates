# Log Commands Reference

## logs search

Search logs with filters.

```bash
npx @leoflores/datadog-cli logs search --query "<query>" [--from <time>] [--to <time>] [--limit <n>] [--sort <order>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--query` | `*` | Datadog search query |
| `--from` | `15m` | Start time |
| `--to` | `now` | End time |
| `--limit` | `100` | Max results (max: 1000) |
| `--sort` | `-timestamp` | Sort order |

```bash
npx @leoflores/datadog-cli logs search --query "service:api status:error" --from 1h --pretty
```

## logs tail

Stream logs in real-time. Press Ctrl+C to stop.

```bash
npx @leoflores/datadog-cli logs tail --query "<query>" [--interval <seconds>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--interval` | `2` | Polling interval in seconds |

```bash
npx @leoflores/datadog-cli logs tail --query "status:error" --pretty
```

## logs trace

Find all logs for a distributed trace across services.

```bash
npx @leoflores/datadog-cli logs trace --id "<trace-id>" [--from <time>] [--to <time>]
```

Searches both `@trace_id` and `@dd.trace_id` attributes.

```bash
npx @leoflores/datadog-cli logs trace --id "abc123def456" --from 24h --pretty
```

## logs context

Get logs before and after a specific timestamp.

```bash
npx @leoflores/datadog-cli logs context --timestamp "<iso-timestamp>" [--before <time>] [--after <time>] [--service <svc>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--before` | `5m` | Time window before |
| `--after` | `5m` | Time window after |
| `--service` | - | Filter by service |

```bash
npx @leoflores/datadog-cli logs context --timestamp "2024-01-15T10:30:00Z" --service api --before 5m --after 2m --pretty
```

## logs patterns

Group similar log messages to find patterns. Replaces UUIDs, numbers, IPs, etc.

```bash
npx @leoflores/datadog-cli logs patterns --query "<query>" [--from <time>] [--limit <n>]
```

Returns top 50 patterns with counts and sample messages.

```bash
npx @leoflores/datadog-cli logs patterns --query "status:error" --from 1h --pretty
```

## logs compare

Compare log counts between current period and previous period.

```bash
npx @leoflores/datadog-cli logs compare --query "<query>" --period <time>
```

Shows absolute and percentage change with directional arrows.

```bash
npx @leoflores/datadog-cli logs compare --query "status:error" --period 1h --pretty
```

## logs multi

Run multiple queries in parallel.

```bash
npx @leoflores/datadog-cli logs multi --queries "name1:query1,name2:query2" [--from <time>]
```

```bash
npx @leoflores/datadog-cli logs multi --queries "errors:status:error,warnings:status:warn" --from 1h --pretty
```

## logs agg

Aggregate logs by facet.

```bash
npx @leoflores/datadog-cli logs agg --query "<query>" --facet <facet> [--from <time>]
```

**Common facets:** `status`, `service`, `host`, `@http.status_code`, `@error.kind`

```bash
npx @leoflores/datadog-cli logs agg --query "*" --facet status --from 1h --pretty
```
