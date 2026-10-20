# MCP Server Usage Reference

This document describes the Model Context Protocol (MCP) servers used for GCP
networking observability.

## BigQuery MCP

BigQuery is supported by a remote MCP server that provides tools for automated
data management and analysis.

### Key Tools

-   **list_dataset_ids**: List BigQuery dataset IDs in a project.
-   **list_table_ids**: List table IDs in a BigQuery dataset.
-   **get_table_info**: Get schema and metadata for a specific table.
-   **execute_sql_readonly**: Run `SELECT` queries to analyze logs (such as, VPC Flow,
    Firewall) stored in BigQuery. This is the preferred tool for high-volume
    aggregations and trend analysis.

### Usage Pattern

1.  Use `list_dataset_ids` to find the logging dataset (for example,
    `_AllLogs`).
2.  Use `list_table_ids` to find the relevant log table.
3.  Use `get_table_info` to verify field names (for example, `jsonPayload`
    versus `json_payload`).
4.  Use `execute_sql_readonly` for the final analysis.

## Cloud Logging MCP

The Cloud Logging MCP server provides access to log entries across various
Google Cloud resources.

### Key Tools

-   **list_log_entries**: Search and retrieve log entries using advanced
    filters.
-   **list_log_names**: Discover available logs in a project.

### Usage Pattern

-   Use for quick, real-time identification of recent events or exploratory
    analysis where BigQuery datasets are not linked.
-   Use specific filters for `resource.type` and `logName` to narrow down
    results.

## NetworkManagement MCP

The Network Management MCP server allows for reachability analysis and path
diagnostics.

### Key Tools

-   **create_connectivity_test**: Start a simulated packet path analysis between
    two endpoints.
-   **get_connectivity_test**: Poll for the results of a running test.
-   **delete_connectivity_test**: Cleanup the test resource after analysis is
    complete.

### Usage Pattern

-   Use when static path analysis is needed to identify firewall or routing
    blocks.
-   **CRITICAL**: Always delete the test resource after retrieving the result.

## Cloud Monitoring MCP

The GcpMon MCP server provides access to Cloud Monitoring metrics and
time-series data.

### Key Tools

-   **list_metric_descriptors**: Discover available metrics using filters.
-   **list_timeseries**: Retrieve aggregated data points for performance
    analysis (such as RTT or throughput).

### Usage Pattern

-   Use for analyzing performance trends, packet loss, and latency.
-   Prefer `ALIGN_MEAN` or `ALIGN_PERCENTILE_50` for distribution metrics like
    RTT to simplify parsing.
