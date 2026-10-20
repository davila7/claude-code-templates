# Threat Log Analysis Reference

Use Firewall Threat Logs and Cloud IDS logs to identify, analyze, and
troubleshoot security incidents in your VPC network.

## 🤖 Agent / Gemini CLI Instructions (MCP)

Agents should use [Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp) for quick
identification of recent alerts or [BigQuery MCP](mcp-usage.md#bigquery-mcp) for
analyzing trends and identifying top attackers. Fallback to the CLI if the MCP
tools are not available.

### 1. View Threat Alerts ([Cloud Logging MCP](mcp-usage.md#cloud-logging-mcp))

**Tool**: `list_log_entries`

**Filter**: Search for both Cloud Firewall Plus and Cloud IDS threat log
sources:

```text
logName:(
"projects/{project_id}/logs/networksecurity.googleapis.com%2Ffirewall_threat" OR
"projects/{project_id}/logs/ids.googleapis.com%2Fthreat")
```

To filter for high-severity blocked threats: `

```text
logName:(
"projects/{project_id}/logs/networksecurity.googleapis.com%2Ffirewall_threat" OR
"projects/{project_id}/logs/ids.googleapis.com%2Fthreat")
jsonPayload.threatDetails.severity=("HIGH" OR "CRITICAL")
jsonPayload.action="DENY"
```

### 2. Aggregate Threat Trends ([BigQuery MCP](mcp-usage.md#bigquery-mcp))

**Tool**: `execute_sql_readonly`

**SQL Pattern**: **Note**: In BigQuery, the top-level column name is
`json_payload` (snake_case). However, fields extracted from inside the JSON
payload are case-sensitive and retain the camelCase format of the original log
(for example, `threatDetails`, `clientIp`). Do not use snake_case for nested
fields.

```sql
SELECT
  timestamp,
  JSON_VALUE(json_payload.threatDetails.threat) AS threat_name,
  JSON_VALUE(json_payload.threatDetails.severity) AS severity,
  JSON_VALUE(json_payload.threatDetails.category) AS category,
  JSON_VALUE(json_payload.action) AS action,
  JSON_VALUE(json_payload.connection.clientIp) AS src_ip,
  JSON_VALUE(json_payload.connection.serverIp) AS dest_ip,
  JSON_VALUE(json_payload.connection.serverPort) AS dest_port,
  JSON_VALUE(json_payload.threatDetails.description) AS description
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_id IN ('networksecurity.googleapis.com/firewall_threat',
             'ids.googleapis.com/threat')
  AND JSON_VALUE(json_payload.threatDetails.severity) IN ('HIGH', 'CRITICAL')
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
ORDER BY timestamp DESC
LIMIT 20
```

To find top sources of attacks:

```sql
SELECT
JSON_VALUE(json_payload.connection.clientIp) AS attacker_ip, COUNT(*) AS
attack_count, ARRAY_AGG(DISTINCT JSON_VALUE(json_payload.threatDetails.threat)
LIMIT 5) AS sample_threats FROM `{project_id}.{dataset_id}._AllLogs` WHERE
log_id IN ('networksecurity.googleapis.com/firewall_threat',
'ids.googleapis.com/threat') AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(),
INTERVAL 7 DAY) GROUP BY 1 ORDER BY attack_count DESC LIMIT 10
```

### 3. CLI Fallback

If MCP tools are unavailable, use the following `gcloud` and `bq` commands:

**View Threat Alerts (gcloud)**

```bash
gcloud logging read 'logName:("projects/{project_id}/logs/networksecurity.googleapis.com%2Ffirewall_threat" OR "projects/{project_id}/logs/ids.googleapis.com%2Fthreat")' --project {project_id} --limit 10 --format json --quiet
```

To filter for high-severity blocked threats:

```bash
gcloud logging read 'logName:("projects/{project_id}/logs/networksecurity.googleapis.com%2Ffirewall_threat" OR "projects/{project_id}/logs/ids.googleapis.com%2Fthreat") AND jsonPayload.threatDetails.severity=("HIGH" OR "CRITICAL") AND jsonPayload.action="DENY"' --project {project_id} --limit 10 --format json --quiet
```

**Aggregate Threat Trends (bq)**

```bash
bq query --use_legacy_sql=false --project_id {project_id} '
SELECT
  timestamp,
  JSON_VALUE(json_payload.threatDetails.threat) AS threat_name,
  JSON_VALUE(json_payload.threatDetails.severity) AS severity,
  JSON_VALUE(json_payload.threatDetails.category) AS category,
  JSON_VALUE(json_payload.action) AS action,
  JSON_VALUE(json_payload.connection.clientIp) AS src_ip,
  JSON_VALUE(json_payload.connection.serverIp) AS dest_ip,
  JSON_VALUE(json_payload.connection.serverPort) AS dest_port,
  JSON_VALUE(json_payload.threatDetails.description) AS description
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_id IN ("networksecurity.googleapis.com/firewall_threat",
             "ids.googleapis.com/threat")
  AND JSON_VALUE(json_payload.threatDetails.severity) IN ("HIGH", "CRITICAL")
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
ORDER BY timestamp DESC
LIMIT 20
'
```

To find top sources of attacks:

```bash
bq query --use_legacy_sql=false --project_id {project_id} '
SELECT
  JSON_VALUE(json_payload.connection.clientIp) AS attacker_ip,
  COUNT(*) AS attack_count,
  ARRAY_AGG(DISTINCT JSON_VALUE(json_payload.threatDetails.threat)
            LIMIT 5) AS sample_threats
FROM `{project_id}.{dataset_id}._AllLogs`
WHERE
  log_id IN ("networksecurity.googleapis.com/firewall_threat",
             "ids.googleapis.com/threat")
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY 1
ORDER BY attack_count DESC
LIMIT 10
'
```

### Key Fields (Cloud Logging Filter Names)

-   **jsonPayload.threatDetails.threat**: Human-readable name of the threat.
-   **jsonPayload.threatDetails.severity**: Severity level (CRITICAL, HIGH,
    MEDIUM, LOW, INFORMATIONAL).
-   **jsonPayload.threatDetails.category**: The category of threat.
-   **jsonPayload.action**: Action taken (for example, "ALLOW", "DENY",
    "ALERT").
-   **jsonPayload.connection.clientIp**: The true source IP.
-   **jsonPayload.connection.serverIp**: The destination IP.
-   **jsonPayload.threatDetails.cves**: List of CVE IDs.
-   **jsonPayload.threatDetails.description**: Attack payload details.
