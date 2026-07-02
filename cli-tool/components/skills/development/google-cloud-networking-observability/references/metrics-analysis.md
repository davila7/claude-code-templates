# Networking Metrics Reference

## Common Troubleshooting Metrics

-   **RTT (Latency)**:
    `networking.googleapis.com/cloud_netslo/active_probing/rtt`
-   **Packet Loss**:
    `networking.googleapis.com/cloud_netslo/active_probing/probe_count`
-   **VM Throughput**:
    `compute.googleapis.com/instance/network/received_bytes_count`
-   **VM Sent Packets**:
    `compute.googleapis.com/instance/network/sent_packets_count`
-   **VM Received Packets**:
    `compute.googleapis.com/instance/network/received_packets_count`
-   **NAT Port Exhaustion**:
    `compute.googleapis.com/nat/dropped_sent_packets_count`
-   **NAT Sent Packets**: `compute.googleapis.com/nat/sent_packets_count`
-   **VPN Dropped Received Packets**:
    `vpn.googleapis.com/network/dropped_received_packets_count`
-   **VPN Dropped Sent Packets**:
    `vpn.googleapis.com/network/dropped_sent_packets_count`
-   **Internal Latency (RTT)**: `networking.googleapis.com/vm_flow/rtt`.
    Measures internal VM-to-VM traffic within Google Cloud.
-   **External Latency (RTT)**:
    `networking.googleapis.com/vm_flow/external_rtt`. Measures traffic to and
    from the internet.

## Distribution Parsing Standard

When querying metrics of type DISTRIBUTION (like RTT), align the data with
`ALIGN_PERCENTILE_50` to ensure the output can be parsed as a simple numeric
value.

## Dynamic Discovery

-   **Primary ([Cloud Monitoring MCP](mcp-usage.md#cloud-monitoring-mcp))**: Use
    `list_metric_descriptors` with a filter.

    -   **Prefix**: Filter by prefix, using `starts_with()`. Common prefixes:
        -   `metric.type = starts_with("networking.googleapis.com/")`
        -   `metric.type = starts_with("router.googleapis.com/")`
        -   `metric.type = starts_with("vpn.googleapis.com/")`
        -   `metric.type = starts_with("compute.googleapis.com/")`
    -   **Substring**: `metric.type = has_substring("network") OR metric.type =
        has_substring("packet") OR metric.type = has_substring("nat")`

-   **Fallback (CLI/CURL)**: If MCP tools not available, use `gcloud` or `curl`.

    ```bash
    curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)"
    "https://monitoring.googleapis.com/v3/projects/{project_id}/metricDescriptors?filter=metric.type=starts_with(%22{prefix}%22)"
    | jq -r '.metricDescriptors[] | "\(.type): \(.description)"'

    curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    "https://monitoring.googleapis.com/v3/projects/{project_id}/timeSeries?" \
    "filter=metric.type%3D%22{metric_name}%22&" \
    "interval.startTime={start_time}&" \
    "interval.endTime={end_time}&" \
    "aggregation.alignmentPeriod=3600s&" \
    "aggregation.perSeriesAligner=ALIGN_PERCENTILE_50" \
    | jq '.timeSeries[] | {metric: .metric.type, points: .points[:5]}'
    ```

-   **Detailed Schema**: ALWAYS query the full descriptor for a specific metric
    before use to identify available labels. Metric types like `vm_flow/rtt`
    often use `resource.labels.zone` for the local zone and
    `metric.labels.remote_zone` for the peer.
