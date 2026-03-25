# Datadog Query Syntax

## Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `AND` | `service:api status:error` | Both conditions (implicit) |
| `OR` | `status:error OR status:warn` | Either condition |
| `-` | `-status:info` | Exclude |
| `*` | `service:api-*` | Wildcard |
| `>=` `<=` | `@http.status_code:>=400` | Numeric comparison |
| `[TO]` | `@duration:[1000 TO 5000]` | Range |

## Common Attributes

| Attribute | Description |
|-----------|-------------|
| `service` | Service name |
| `status` | Log level (error, warn, info, debug) |
| `host` | Hostname |
| `@http.status_code` | HTTP status code |
| `@http.method` | HTTP method |
| `@http.url` | Request URL |
| `@error.kind` | Error type |
| `@error.message` | Error message |
| `@trace_id` | Trace ID |
| `@dd.trace_id` | Datadog trace ID |

## Time Formats

### Relative
- `1m` - 1 minute
- `30m` - 30 minutes
- `1h` - 1 hour
- `6h` - 6 hours
- `24h` - 24 hours
- `7d` - 7 days

### Absolute
- ISO 8601: `2024-01-15T10:30:00Z`

## Example Queries

```bash
# All errors
status:error

# Errors in specific service
service:api status:error

# 5xx HTTP errors
@http.status_code:>=500

# Exclude info logs
-status:info

# Multiple services
service:api OR service:payment

# Timeout errors
error:timeout OR @error.kind:TimeoutError

# Slow requests (>1s)
@duration:>=1000
```
