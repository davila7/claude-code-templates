# Firewall Rule Logging Analysis Reference

Use firewall logs (`compute.googleapis.com/firewall`) to verify if traffic is
allowed or denied.

## 🤖 Agent / Gemini CLI Instructions (MCP)

You should use [Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp) for
exploratory analysis or [BigQuery MCP](mcp-usage.md#bigquery-mcp) for
high-volume trends. Fallback to the CLI if the MCP tools are not available.

-   **Exploratory Analysis**: Typically involves looking at individual log
    entries or a small set of logs to understand specific events, debug issues,
    or investigate anomalies. This often requires filtering and examining the
    full details of log records.
-   **High-Volume Trends**: Focuses on aggregating large datasets of logs over
    time to identify patterns, measure traffic volumes, analyze latency
    distributions, or find "top talkers." This usually involves SQL queries to
    summarize data rather than inspecting individual logs.

### 1. View Logs ([Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp))

**Tool**: `list_log_entries`

**Filter**:

```text
resource.type="gce_subnetwork"
logName="projects/{project_id}/logs/compute.googleapis.com%2Ffirewall"
```

Filter for denied packets:

```
text jsonPayload.rule_details.action="DENY"
```

### 2. Aggregate Trends ([BigQuery MCP](mcp-usage.md#bigquery-mcp))

**Tool**: `execute_sql`

**SQL Pattern**:

```sql
SELECT JSON_VALUE(json_payload.rule_details.reference) AS
rule_name, COUNT(*) AS block_count FROM `{project_id}.{dataset_id}._AllLogs`
WHERE log_name LIKE '%firewall%' AND
JSON_VALUE(json_payload.rule_details.action) = 'DENY' GROUP BY 1 ORDER BY
block_count DESC LIMIT 10
```

### 3. CLI Fallback

If MCP tools are unavailable, use the following `gcloud` and `bq` commands:

**View Logs (gcloud)**

```bash
gcloud logging read 'resource.type="gce_subnetwork" AND logName="projects/{project_id}/logs/compute.googleapis.com%2Ffirewall"' --project {project_id} --limit 10 --format json --quiet
```

To filter for denied packets:

```bash
gcloud logging read 'resource.type="gce_subnetwork" AND logName="projects/{project_id}/logs/compute.googleapis.com%2Ffirewall" AND jsonPayload.rule_details.action="DENY"' --project {project_id} --limit 10 --format json --quiet
```

**Aggregate Trends (bq)**

```bash
bq query --use_legacy_sql=false --project_id {project_id} '
SELECT
  JSON_VALUE(json_payload.rule_details.reference) AS rule_name,
  COUNT(*) AS block_count
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_name LIKE "%firewall%"
  AND JSON_VALUE(json_payload.rule_details.action) = "DENY"
GROUP BY 1
ORDER BY block_count DESC
LIMIT 10
'
```

## Key Fields

-   `jsonPayload.rule_details.action`: `ALLOW` or `DENY`.
-   `jsonPayload.rule_details.reference`: The firewall rule name (for example,
    `default-deny-all`).
-   `jsonPayload.connection.src_ip` / `dest_ip`: The source and destination of
    the connection.

## Common Use Cases

-   **Identify Blocks**: Find which `DENY` rule is causing connection failures.
-   **Security Audit**: Detect unexpected traffic patterns.
