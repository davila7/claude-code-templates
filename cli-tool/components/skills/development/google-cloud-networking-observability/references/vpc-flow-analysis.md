# VPC Flow Analysis Reference

Use VPC Flow Logs to analyze traffic patterns, volume, and latency.

## 🤖 Agent / Gemini CLI Instructions (MCP)

Agents should use [Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp) for
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

**Filter**: ALWAYS search for both VPC flow log sources:

```text
(logName:"projects/{project_id}/logs/compute.googleapis.com%2Fvpc_flows" OR
logName:"projects/{project_id}/logs/networkmanagement.googleapis.com%2Fvpc_flows")
resource.type="gce_subnetwork"
```

### 2. Aggregate Trends ([BigQuery MCP](mcp-usage.md#bigquery-mcp))

**Tool**: `execute_sql`

**SQL Pattern**:

```sql
SELECT timestamp,
JSON_VALUE(jsonPayload.connection.src_ip) AS src_ip,
JSON_VALUE(jsonPayload.connection.dest_ip) AS dest_ip,
CAST(JSON_VALUE(jsonPayload.bytes_sent) AS INT64) AS bytes_sent FROM
`{project_id}.{dataset_id}._AllLogs` WHERE log_name IN (
'projects/{project_id}/logs/compute.googleapis.com%2Fvpc_flows',
'projects/{project_id}/logs/networkmanagement.googleapis.com%2Fvpc_flows' ) AND
timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR) ORDER BY
timestamp DESC LIMIT 10
```

### 3. CLI Fallback

If MCP tools are unavailable, use the following `gcloud` and `bq` commands:

**View Logs (gcloud)**

```bash
gcloud logging read '(logName:"projects/{project_id}/logs/compute.googleapis.com%2Fvpc_flows" OR logName:"projects/{project_id}/logs/networkmanagement.googleapis.com%2Fvpc_flows") AND resource.type="gce_subnetwork"' --project {project_id} --limit 10 --format json --quiet
```

**Aggregate Trends (bq)**

```bash
bq query --use_legacy_sql=false --project_id {project_id} '
SELECT
  timestamp,
  JSON_VALUE(json_payload.connection.src_ip) AS src_ip,
  JSON_VALUE(json_payload.connection.dest_ip) AS dest_ip,
  CAST(JSON_VALUE(json_payload.bytes_sent) AS INT64) AS bytes_sent
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_name IN (
    "projects/{project_id}/logs/compute.googleapis.com%2Fvpc_flows",
    "projects/{project_id}/logs/networkmanagement.googleapis.com%2Fvpc_flows"
  )
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC
LIMIT 10
'
```

### Flow Analyzer (Visual Analysis)

For visual traffic analysis and identifying "top talkers," use
[Flow Analyzer](https://console.cloud.google.com/net-intelligence/flow-analyzer).
It allows you to:

-   Visualize traffic flows between regions, VPCs, and instances.
-   Filter by source or destination dimensions.
-   Identify high-bandwidth or high-latency connections.

### Generic BigQuery Guidelines

-   **Schema Verification**: Before executing a BigQuery query, if you are
    uncertain of the casing (for example, `jsonPayload` versus `json_payload`),
    you MUST run `bq show --schema <source>`.
-   **Latency Aggregation**: The primary field for RTT analysis in VPC Flow logs
    is `json_payload.round_trip_time.median_msec`. This field offers
    sub-millisecond precision and covers both TCP and Falcon traffic. Filter by
    `reporter` (`SRC` or `DEST`) to avoid double-counting traffic volume.

    For TCP-only traffic, you can also use `json_payload.rtt_msec`, which
    provides RTT in whole milliseconds. While less precise and with narrower
    coverage than `round_trip_time.median_msec`, it can be aggregated as
    follows:

    ```sql
    SELECT
      AVG(json_payload.rtt_msec) AS average_rtt_msec,
      MAX(json_payload.rtt_msec) AS max_rtt_msec
    FROM ...
    ```

## Key Fields

-   **src_ip / dest_ip**: Source and destination IP addresses.
-   **bytes_sent / packets_sent**: Volume of traffic.
-   **round_trip_time.median_msec**: The primary field for RTT analysis. This
    `double` field provides the *median* latency in milliseconds with
    sub-millisecond precision. It is populated for both TCP and Falcon traffic.
-   **rtt_msec**: An `int64` field representing Round-trip time in whole
    milliseconds. Populated only for TCP traffic. Generally,
    `round_trip_time.median_msec` is preferred due to higher precision and
    broader coverage.
-   **reporter**: Usually `src` or `dest` indicating which side logged the flow.
