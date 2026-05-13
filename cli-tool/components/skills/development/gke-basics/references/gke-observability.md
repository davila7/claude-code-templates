# GKE Observability

This reference covers monitoring, logging, and metrics configuration for GKE. The golden path enables comprehensive observability including control-plane metrics.

> **MCP Tools:** `get_cluster`, `list_k8s_events`, `get_k8s_logs`, `get_k8s_cluster_info`, `describe_k8s_resource`. **CLI-only:** `gcloud container clusters update --monitoring=...`, `gcloud logging read`

## Golden Path Observability Defaults

| Setting | Golden Path Value | Notes |
|---------|-------------------|-------|
| `loggingConfig` components | SYSTEM_COMPONENTS, WORKLOADS | Full workload logging |
| `monitoringConfig` components | SYSTEM_COMPONENTS, STORAGE, POD, DEPLOYMENT, STATEFULSET, DAEMONSET, HPA, JOBSET, CADVISOR, KUBELET, DCGM, APISERVER, SCHEDULER, CONTROLLER_MANAGER | Full suite including control-plane |
| `managedPrometheusConfig.enabled` | `true` | Google-managed Prometheus |
| `advancedDatapathObservabilityConfig.enableMetrics` | `true` | Dataplane V2 flow metrics |
| `loggingService` | `logging.googleapis.com/kubernetes` | Cloud Logging |
| `monitoringService` | `monitoring.googleapis.com/kubernetes` | Cloud Monitoring |

### Control-Plane Metrics (Golden Path Addition)

The golden path adds three control-plane monitoring components not present in default clusters:

| Component | What It Monitors |
|-----------|-----------------|
| `APISERVER` | API server request latency, error rates, admission webhook performance |
| `SCHEDULER` | Scheduling latency, pending pods, scheduling failures |
| `CONTROLLER_MANAGER` | Controller work queue depth, reconciliation latency |

These are critical for diagnosing cluster-level issues (slow API responses, scheduling delays, stuck controllers).

## Enabling Full Monitoring

```bash
# Enable golden path monitoring suite
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --monitoring=SYSTEM,API_SERVER,SCHEDULER,CONTROLLER_MANAGER,STORAGE,POD,DEPLOYMENT,STATEFULSET,DAEMONSET,HPA,CADVISOR,KUBELET,DCGM \
  --quiet

# Enable Managed Prometheus
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-managed-prometheus \
  --quiet

# Enable Dataplane V2 observability metrics
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-dataplane-v2-flow-observability \
  --quiet
```

## Managed Prometheus

Golden path enables Google Managed Prometheus for metrics collection and querying.

**Querying metrics:**
- Use Cloud Monitoring Metrics Explorer in the console
- Use PromQL via the Prometheus UI or API
- Grafana dashboards via Managed Grafana

**Key GKE metrics:**

| Metric | Source | Use |
|--------|--------|-----|
| `container_cpu_usage_seconds_total` | cAdvisor | Pod CPU usage |
| `container_memory_working_set_bytes` | cAdvisor | Pod memory usage |
| `kube_pod_status_phase` | kube-state-metrics | Pod lifecycle |
| `apiserver_request_duration_seconds` | API Server | Control plane latency |
| `scheduler_scheduling_duration_seconds` | Scheduler | Scheduling performance |
| `node_cpu_seconds_total` | Kubelet | Node CPU |
| `DCGM_FI_DEV_GPU_UTIL` | DCGM | GPU utilization |

## Live Resource Usage (kubectl-only)

No MCP or gcloud equivalent exists for live resource usage. Use `kubectl top`:

```bash
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top nodes
kubectl top pods --containers -n <NAMESPACE>  # per-container breakdown
```

## Cloud Logging (gcloud-only)

**Querying cluster logs** (no MCP equivalent — use `gcloud logging read`):

```bash
# System component logs
gcloud logging read \
  'resource.type="k8s_cluster" AND resource.labels.cluster_name="<CLUSTER_NAME>"' \
  --project <PROJECT_ID> --limit 50 \
  --quiet

# Workload logs for a specific namespace
gcloud logging read \
  'resource.type="k8s_container" AND resource.labels.cluster_name="<CLUSTER_NAME>" AND resource.labels.namespace_name="<NAMESPACE>"' \
  --project <PROJECT_ID> --limit 50 \
  --quiet

# Audit logs (who did what)
gcloud logging read \
  'resource.type="k8s_cluster" AND logName:"cloudaudit.googleapis.com"' \
  --project <PROJECT_ID> --limit 50 \
  --quiet
```

## Diagnostic Settings

For security monitoring and troubleshooting, enable control-plane audit logs:

```bash
# View current logging config
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="yaml(loggingConfig)" \
  --quiet
```

## Alerting

Set up alerts for critical conditions:

| Condition | Metric | Threshold |
|-----------|--------|-----------|
| High API server latency | `apiserver_request_duration_seconds` | P99 > 5s |
| Pod crash loops | `kube_pod_container_status_restarts_total` | > 5 in 10min |
| Node not ready | `kube_node_status_condition` | condition=Ready, status!=True |
| High GPU utilization | `DCGM_FI_DEV_GPU_UTIL` | > 95% sustained |
| PVC near capacity | `kubelet_volume_stats_used_bytes / capacity` | > 85% |
| Scheduling failures | `scheduler_schedule_attempts_total{result="error"}` | > 0 |

## Cost Considerations

Monitoring and logging have associated costs:

- **Cloud Logging**: Charged per GiB ingested beyond free tier (50 GiB/project/month)
- **Cloud Monitoring**: Free for GKE system metrics; custom metrics charged per time series
- **Managed Prometheus**: Charged per samples ingested

To reduce costs in non-production:
```bash
# Reduce to system-only monitoring
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --monitoring=SYSTEM \
  --quiet
```

## Distributed Tracing & Continuous Profiling (Recommended)

**Not golden path defaults** — recommended for production microservice architectures and performance-sensitive workloads.

- **Cloud Trace**: Add OpenTelemetry SDK to your app with the `opentelemetry-operations-go` (or equivalent) exporter. Traces appear in Cloud Trace console. Identifies cross-service latency bottlenecks.
- **Cloud Profiler**: Add the Cloud Profiler agent to your app. Profiles CPU and memory usage in production with low overhead. Identifies hotspots and compares across versions.

## LQL Query Examples

Common Logging Query Language patterns for GKE troubleshooting:

```
# Error logs for a specific container
resource.type="k8s_container" AND resource.labels.container_name="my-app" AND severity>=ERROR

# OOMKilled events
resource.type="k8s_event" AND jsonPayload.reason="OOMKilling"

# Pod scheduling failures
resource.type="k8s_event" AND jsonPayload.reason="FailedScheduling"

# Audit logs (who did what)
resource.type="k8s_cluster" AND logName:"cloudaudit.googleapis.com"
```

