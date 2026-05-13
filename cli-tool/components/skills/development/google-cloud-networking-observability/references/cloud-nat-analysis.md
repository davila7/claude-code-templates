# Cloud NAT Analysis Reference

Use Cloud NAT logs (`compute.googleapis.com/nat_flows`) to audit traffic going
through NAT gateways or troubleshoot port exhaustion.

## 🤖 Agent / Gemini CLI Instructions (MCP)

You should use [Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp) for
exploratory analysis or [BigQuery MCP](mcp-usage.md#bigquery-mcp) for
high-volume trends. Fallback to the CLI if the MCP tools are not available.

### 1. View Logs ([Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp))

**Tool**: `list_log_entries`

**Filter**:

```text
resource.type="nat_gateway"
logName="projects/{project_id}/logs/compute.googleapis.com%2Fnat_flows"
```

Filter for dropped packets (potential port exhaustion):

```text
jsonPayload.allocation_status="DROPPED"
```

### 2. Aggregate Trends ([BigQuery MCP](mcp-usage.md#bigquery-mcp))

**Tool**: `execute_sql_readonly`

**SQL Pattern**:

```sql
SELECT
JSON_VALUE(json_payload.gateway_details.internal_ip) AS internal_ip, COUNT(*) AS
drop_count FROM `{project_id}.{dataset_id}._AllLogs` WHERE log_name LIKE
'%nat_flows%' AND JSON_VALUE(json_payload.allocation_status) = 'DROPPED' GROUP BY
1 ORDER BY drop_count DESC LIMIT 10
```

### 3. CLI Fallback

If MCP tools are unavailable, use the following `gcloud` and `bq` commands:

**View Logs (gcloud)**

```bash
gcloud logging read 'resource.type="nat_gateway" AND logName="projects/{project_id}/logs/compute.googleapis.com%2Fnat_flows"' --project {project_id} --limit 10 --format json --quiet
```

To filter for dropped packets:

```bash
gcloud logging read 'resource.type="nat_gateway" AND logName="projects/{project_id}/logs/compute.googleapis.com%2Fnat_flows" AND jsonPayload.allocation_status="DROPPED"' --project {project_id} --limit 10 --format json --quiet
```

**Aggregate Trends (bq)**

```bash
bq query --use_legacy_sql=false --project_id {project_id} '
SELECT
  JSON_VALUE(json_payload.gateway_details.internal_ip) AS internal_ip,
  COUNT(*) AS drop_count
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_name LIKE "%nat_flows%"
  AND JSON_VALUE(json_payload.allocation_status) = "DROPPED"
GROUP BY 1
ORDER BY drop_count DESC
LIMIT 10
'
```

### gcloud

To get the status of the router used by the NAT gateway:

```bash
gcloud compute
routers get-status {router_name} --region {region} --quiet
```

## Key Fields

-   `jsonPayload.gateway_details.external_ip` / `external_port`: NAT exit point.
-   `jsonPayload.gateway_details.internal_ip` / `internal_port`: Source VM.
-   `jsonPayload.allocation_status`: `DROPPED` indicates failure to allocate a
    NAT port.

## Scenarios

-   **Audit Traffic**: Link internal sources to external destinations.
-   **Port Exhaustion**: Use `jsonPayload.allocation_status="DROPPED"` to
    identify impacted VMs.
