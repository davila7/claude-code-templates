---
name: railway-metrics
description: Query resource usage metrics for Railway services. Use when user asks about resource usage, CPU, memory, network, disk, or service performance like "how much memory is my service using" or "is my service slow".
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Metrics, Monitoring, Performance, CPU, Memory, Resources, Analytics]
dependencies: [railway-cli]
allowed-tools: Bash(railway:*)
---

# Railway Service Metrics

Query resource usage metrics for Railway services.

## When to Use

- User asks "how much memory is my service using?"
- User asks about CPU usage, network traffic, disk usage
- User wants to debug performance issues
- User asks "is my service healthy?" (combine with railway-service skill)

## Prerequisites

Get environmentId and serviceId from linked project:

```bash
railway status --json
```

Extract:
- `environment.id` → environmentId
- `service.id` → serviceId (optional - omit to get all services)

## MetricMeasurement Values

| Measurement | Description |
|-------------|-------------|
| CPU_USAGE | CPU usage (cores) |
| CPU_LIMIT | CPU limit (cores) |
| MEMORY_USAGE_GB | Memory usage in GB |
| MEMORY_LIMIT_GB | Memory limit in GB |
| NETWORK_RX_GB | Network received in GB |
| NETWORK_TX_GB | Network transmitted in GB |
| DISK_USAGE_GB | Disk usage in GB |
| EPHEMERAL_DISK_USAGE_GB | Ephemeral disk usage in GB |
| BACKUP_USAGE_GB | Backup usage in GB |

## MetricTag Values (for groupBy)

| Tag | Description |
|-----|-------------|
| DEPLOYMENT_ID | Group by deployment |
| DEPLOYMENT_INSTANCE_ID | Group by instance |
| REGION | Group by region |
| SERVICE_ID | Group by service |

## Query

```graphql
query metrics(
  $environmentId: String!
  $serviceId: String
  $startDate: DateTime!
  $endDate: DateTime
  $sampleRateSeconds: Int
  $averagingWindowSeconds: Int
  $groupBy: [MetricTag!]
  $measurements: [MetricMeasurement!]!
) {
  metrics(
    environmentId: $environmentId
    serviceId: $serviceId
    startDate: $startDate
    endDate: $endDate
    sampleRateSeconds: $sampleRateSeconds
    averagingWindowSeconds: $averagingWindowSeconds
    groupBy: $groupBy
    measurements: $measurements
  ) {
    measurement
    tags {
      deploymentInstanceId
      deploymentId
      serviceId
      region
    }
    values {
      ts
      value
    }
  }
}
```

## Example: Last Hour CPU and Memory

Use heredoc to avoid shell escaping issues:

```bash
bash <<'SCRIPT'
START_DATE=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ")
ENV_ID="your-environment-id"
SERVICE_ID="your-service-id"

VARS=$(jq -n \
  --arg env "$ENV_ID" \
  --arg svc "$SERVICE_ID" \
  --arg start "$START_DATE" \
  '{environmentId: $env, serviceId: $svc, startDate: $start, measurements: ["CPU_USAGE", "MEMORY_USAGE_GB"]}')

${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'query metrics($environmentId: String!, $serviceId: String, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
    metrics(environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, measurements: $measurements) {
      measurement
      tags { deploymentId region serviceId }
      values { ts value }
    }
  }' \
  "$VARS"
SCRIPT
```

## Example: All Services in Environment

Omit serviceId and use groupBy to get metrics for all services:

```bash
bash <<'SCRIPT'
START_DATE=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ")
ENV_ID="your-environment-id"

VARS=$(jq -n \
  --arg env "$ENV_ID" \
  --arg start "$START_DATE" \
  '{environmentId: $env, startDate: $start, measurements: ["CPU_USAGE", "MEMORY_USAGE_GB"], groupBy: ["SERVICE_ID"]}')

${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'query metrics($environmentId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!, $groupBy: [MetricTag!]) {
    metrics(environmentId: $environmentId, startDate: $startDate, measurements: $measurements, groupBy: $groupBy) {
      measurement
      tags { serviceId region }
      values { ts value }
    }
  }' \
  "$VARS"
SCRIPT
```

## Time Parameters

| Parameter | Description |
|-----------|-------------|
| startDate | Required. ISO 8601 format (e.g., `2024-01-01T00:00:00Z`) |
| endDate | Optional. Defaults to now |
| sampleRateSeconds | Sample interval (e.g., 60 for 1-minute samples) |
| averagingWindowSeconds | Averaging window for smoothing |

**Tip:** For last hour, calculate startDate as `now - 1 hour` in ISO format.

## Output Interpretation

```json
{
  "data": {
    "metrics": [
      {
        "measurement": "CPU_USAGE",
        "tags": { "deploymentId": "...", "serviceId": "...", "region": "us-west1" },
        "values": [
          { "ts": "2024-01-01T00:00:00Z", "value": 0.25 },
          { "ts": "2024-01-01T00:01:00Z", "value": 0.30 }
        ]
      }
    ]
  }
}
```

- `ts` - timestamp in ISO format
- `value` - metric value (cores for CPU, GB for memory/disk/network)

## Composability

- **Get IDs**: Use railway-status skill or `railway status --json`
- **Check service health**: Use railway-service skill for deployment status
- **View logs**: Use railway-deployment skill if metrics show issues
- **Scale service**: Use railway-environment skill to adjust resources

## Error Handling

### Empty/Null Metrics

Services without active deployments return empty metrics arrays. When processing with jq, handle nulls:

```bash
# Safe iteration - skip nulls
jq -r '.data.metrics[]? | select(.values != null and (.values | length) > 0) | ...'

# Check if metrics exist before processing
jq -e '.data.metrics | length > 0' response.json && echo "has metrics"
```

### No Metrics Data

Service may be new or have no traffic. Check:
- Service has active deployment (stopped services have no metrics)
- Time range includes deployment period

### Invalid Service/Environment ID

Verify IDs with `railway status --json`.

### Permission Denied

User needs access to the project to query metrics.
