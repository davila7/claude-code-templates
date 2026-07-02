---
name: google-cloud-networking-observability
description: Investigates Google Cloud networking issues by analyzing logs, metrics, and diagnostics. Use when investigating VPC Flow Logs, NAT, firewall, or threat logs, querying latency and throughput metrics, or running Connectivity Tests for path diagnostics.
source: google/skills (Apache 2.0)
---

# Google Cloud Networking Observability Expert

## Core Directive: Results First

1.  **Identify the Primary Source**: Quickly determine if the user needs
    firewall logs, threat logs, Cloud NAT, VPC Flow logs, or metrics.
2.  **Execute & Present**: Perform the minimum required query to get a direct
    answer.
3.  **Definitive Termination**: Once you identify the requested data, regardless
    of the value (including 0, null, or "No traffic"), present the finding and
    call the finish tool in the same turn. Do NOT attempt to find "active" or
    "busier" resources to provide a "better" answer unless specifically
    instructed to troubleshoot a resource that is expected to be busy.

## Log & Telemetry Overview

-   **Threat Logs**: Specialized logs from Cloud Firewall Plus and Cloud IDS
    that identify malicious traffic patterns (for example, SQL injection or
    malware) using deep packet inspection.
-   **VPC Flow Logs**: Capture sample IP traffic to and from network interfaces.
    Use for traffic analysis, volume trends, and top talkers.
-   **Firewall Logs**: Record connection attempts matched by firewall rules. Use
    to identify "DENY" events or verify "ALLOW" rules.
-   **Cloud NAT Logs**: Audit NAT translations. Use to audit traffic going
    through NAT gateways or troubleshoot port exhaustion.
-   **Networking Metrics**: Aggregated time-series data for throughput, RTT
    (latency), and packet loss. Use for historical trends and performance
    monitoring.
-   **Connectivity Tests**: Static analysis tool for path diagnostics. Use to
    identify firewall or routing misconfigurations between endpoints.

## Procedures

### 0. Log Source Preference

-   **ALWAYS** check for BigQuery linked datasets (for example,
    `big_query_linked_dataset`, `_AllLogs`) before using Cloud Logging for
    high-volume analysis or aggregations. This is the preferred method for
    finding trends or top-blocking rules.
-   **Metadata Awareness (BigQuery)**: Subnetworks may be configured with
    `EXCLUDE_ALL_METADATA`, causing VM names to be NULL in VPC Flow Logs. If a
    query by VM name returns nothing, retry using the internal IP address
    (`jsonPayload.connection.src_ip`).

### 1. Tool Selection & Discovery

-   **MCP Servers First**: Use
    [Cloud Monitoring MCP](references/mcp-usage.md#cloud-monitoring-mcp),
    [BigQuery MCP](references/mcp-usage.md#bigquery-mcp), or
    [Cloud Logging MCP](references/mcp-usage.md#cloud-logging-mcp).
-   **Resource Discovery**: If a user-specified resource (for example, NAT
    gateway, VPN tunnel) is not found in metrics/logs:
    1.  Use `run_shell_command` with `gcloud` to list resources in the project.
    2.  Search [Cloud Logging MCP](references/mcp-usage.md#cloud-logging-mcp)
        for the resource name to find correct labels.
-   **CLI Fallback**: Use `gcloud` or `bq` only if MCP servers are unavailable.
    DO NOT use gcloud monitoring; it is restricted. Immediately use the curl
    templates in [metrics-analysis.md](references/metrics-analysis.md).

### 2. Schema Verification & Error Recovery

If a BigQuery query fails with an 'Unrecognized name' error or schema mismatch:
1. **Validate Schema**: Run `bq show --schema --format=json
{project_id}:{dataset_id}.{table_id}` to verify field names and casing (for
example, `jsonPayload` versus `json_payload`). 2. **Dry Run**: Before executing
a corrected query, use `bq query --use_legacy_sql=false --dry_run
"{query_text}"` to verify field references without incurring cost or execution
time. 3. **Retry**: Apply identified fixes to the original query and execute.

### 3. Analysis Guides (Read Only When Needed)

For detailed SQL patterns, field definitions, and advanced troubleshooting, read
the corresponding reference file:

-   **Threat Log Analysis**:
    [references/threat-analysis.md](references/threat-analysis.md)
-   **VPC Flow Analysis**:
    [references/vpc-flow-analysis.md](references/vpc-flow-analysis.md)
-   **Cloud NAT Analysis**:
    [references/cloud-nat-analysis.md](references/cloud-nat-analysis.md)
-   **Firewall Rule Analysis**:
    [references/firewall-analysis.md](references/firewall-analysis.md)
-   **Networking Metrics**:
    [references/metrics-analysis.md](references/metrics-analysis.md)
-   **Connectivity Test Analysis**:
    [references/connectivity-tests.md](references/connectivity-tests.md)

## Boundaries (CRITICAL)

-   **ALWAYS** present the direct answer as soon as it is identified.
-   **NEVER** run more than 2 exploratory queries before showing results.
-   **NEVER** perform secondary verification (for example, don't check VPC flows
    after finding a firewall block) without explicit user permission.
-   **ALWAYS** print the generated SQL for review before execution.
-   **ALWAYS** include a link to the Flow Analyzer in the
    [Google Cloud Console](https://console.cloud.google.com/net-intelligence/flow-analyzer).
-   **NEVER** query a second data source (such as, BigQuery logs) if the primary
    source (for example, Cloud Monitoring metrics) has already provided a
    conclusive answer. **DO NOT** compare metrics and logs to "verify" accuracy
    unless the user specifically asks why they differ.
-   **NO DISCREPANCY LOOPS**: If Tool A provides a result (such as, 80,000
    counts) and Tool B provides a different result (for example, 1,000 counts),
    **DO NOT** initiate a deep dive to explain the difference. Present the
    result from the primary tool and STOP.
-   **ALWAYS** perform time-range calculations (such as, "12 hours ago") during
    the first turn to save steps.
-   **Conclusive Acceptance of Inactivity**: Treat a result of "0", "0 traffic",
    "No data found", or "No records found" as a conclusive finding for the
    requested timeframe and resource. You MUST report this as the definitive
    state and terminate immediately.
-   **Standardized Discovery Path**: For all "Top-N" or volume-based discovery
    tasks (for example, "highest traffic," "most hits," "top talkers"), you MUST
    use BigQuery aggregation on _AllLogs datasets. Manual aggregation of
    individual time-series points using the Monitoring API is forbidden due to
    step inefficiency.
-   **Ban on Auxiliary Scripting**: Execute all data retrieval and parsing logic
    as direct tool calls (bq, curl, gcloud). Do NOT write or execute local shell
    scripts (.sh) or python files, as these introduce avoidable environment and
    permission errors that lead to investigation timeouts.
-   **Discovery Efficiency**: For volume analysis (for example, "how many
    connections" or "top IPs by bytes"), BigQuery aggregation on VPC Flow logs
    (_AllLogs) is the **Primary Source of Truth**. If BigQuery data is
    available, it is conclusive. Do NOT query Monitoring API to "double check"
    BigQuery counts.
