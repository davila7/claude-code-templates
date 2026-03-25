# Metrics Reference

## metrics query

Query timeseries metrics from Datadog.

```bash
npx @leoflores/datadog-cli metrics query --query "<metrics-query>" [--from <time>] [--to <time>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--query` | required | Metrics query |
| `--from` | `15m` | Start time |
| `--to` | `now` | End time |

## Query Format

```
<aggregation>:<metric>{<tags>}
```

**Aggregations:** `avg`, `sum`, `min`, `max`, `count`

## Examples

### System Metrics
```bash
npx @leoflores/datadog-cli metrics query --query "avg:system.cpu.user{*}" --from 1h --pretty
npx @leoflores/datadog-cli metrics query --query "avg:system.mem.used{*}" --from 1h --pretty
```

### Service-Specific
```bash
npx @leoflores/datadog-cli metrics query --query "avg:system.cpu.user{service:api}" --from 1h --pretty
```

### APM Metrics
```bash
npx @leoflores/datadog-cli metrics query --query "sum:trace.http.request.errors{service:api}.as_count()" --from 1h --pretty
npx @leoflores/datadog-cli metrics query --query "p99:trace.http.request.duration{service:api}" --from 1h --pretty
```

### With Tags
```bash
npx @leoflores/datadog-cli metrics query --query "avg:system.cpu.user{env:prod,service:api}" --from 1h --pretty
```

## Output

Returns series with:
- Metric name and scope
- Point list (timestamp/value pairs)
- Tags
- Latest value + min/max/avg stats
