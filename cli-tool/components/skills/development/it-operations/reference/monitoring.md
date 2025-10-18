# Monitoring and Observability

Comprehensive guide to implementing observability, metrics collection, alerting strategies, and dashboard design for IT operations.

## Table of Contents
- [Observability Principles](#observability-principles)
- [The Three Pillars](#the-three-pillars)
- [Metrics Strategy](#metrics-strategy)
- [Alerting Best Practices](#alerting-best-practices)
- [Dashboard Design](#dashboard-design)
- [SLI/SLO/SLA Framework](#slislosla-framework)
- [Monitoring Tools](#monitoring-tools)
- [Implementation Examples](#implementation-examples)

## Observability Principles

### Definition
**Observability**: The ability to understand the internal state of a system by examining its external outputs (metrics, logs, traces).

**Monitoring vs Observability**:
| Monitoring | Observability |
|------------|---------------|
| Known unknowns | Unknown unknowns |
| Predefined dashboards | Exploratory analysis |
| Threshold-based alerts | Context-aware investigation |
| "Is the system up?" | "Why is the system behaving this way?" |

### Key Principles

```yaml
1. Instrument Everything:
   - Application code (business metrics, errors, latency)
   - Infrastructure (CPU, memory, disk, network)
   - Dependencies (databases, APIs, queues)
   - User experience (frontend performance, transactions)

2. High Cardinality Data:
   - Enable filtering by user_id, region, version, etc.
   - Support arbitrary dimensional queries
   - Example: "Show me errors for user_id=123 in us-west-2 for version 2.3.1"

3. Context and Correlation:
   - Link metrics, logs, and traces together
   - Use consistent labels and tags across telemetry
   - Include trace IDs in logs and metrics

4. Real-Time and Historical:
   - Real-time for incident response (< 1 min delay)
   - Historical for trend analysis (retain 13+ months)
   - Different retention policies by data type

5. Self-Service:
   - Empower teams to create their own dashboards
   - Provide query language training
   - Build reusable dashboard templates
```

## The Three Pillars

### 1. Metrics (What)

**Definition**: Numeric measurements over time (counters, gauges, histograms).

**Types**:
```yaml
Counter:
  Description: Monotonically increasing value
  Examples:
    - http_requests_total
    - errors_total
    - bytes_sent_total
  Operations: Rate, increase over time

Gauge:
  Description: Value that can go up or down
  Examples:
    - cpu_usage_percent
    - memory_available_bytes
    - queue_depth
  Operations: Current value, average, min, max

Histogram:
  Description: Distribution of values in buckets
  Examples:
    - http_request_duration_seconds
    - database_query_duration_seconds
  Operations: Percentiles (p50, p95, p99), averages

Summary:
  Description: Pre-computed percentiles
  Examples:
    - request_latency_summary
  Operations: Pre-defined percentiles
```

**Metric Naming Convention**:
```
{namespace}_{component}_{metric}_{unit}

Examples:
- api_http_requests_total
- db_postgres_connections_active
- cache_redis_hits_total
- queue_sqs_messages_received_total
```

### 2. Logs (Why)

**Definition**: Timestamped text records of discrete events.

**Log Levels**:
```yaml
ERROR:
  When: Failures requiring immediate attention
  Example: "Database connection failed after 3 retries"

WARN:
  When: Unexpected but handled situations
  Example: "API rate limit approaching (85% of quota)"

INFO:
  When: Important business events
  Example: "User 12345 completed checkout for $150.00"

DEBUG:
  When: Detailed diagnostic information
  Example: "Loaded configuration from /etc/app/config.yaml"
```

**Structured Logging Format**:
```json
{
  "timestamp": "2025-01-15T14:32:10.123Z",
  "level": "ERROR",
  "service": "payment-api",
  "version": "2.3.1",
  "environment": "production",
  "trace_id": "a1b2c3d4e5f6",
  "span_id": "1234567890",
  "user_id": "user-789",
  "message": "Payment processing failed",
  "error": {
    "type": "StripeAPIException",
    "message": "Card declined: insufficient funds",
    "stack_trace": "..."
  },
  "context": {
    "amount": 150.00,
    "currency": "USD",
    "payment_method": "card_****1234"
  }
}
```

**Log Aggregation Best Practices**:
```yaml
Collection:
  - Use lightweight agents (Fluentd, Filebeat, Vector)
  - Buffer locally to handle backend outages
  - Compress during transmission
  - Sample debug logs in high-volume scenarios

Storage:
  - Hot tier (last 7 days): Fast SSD for queries
  - Warm tier (8-90 days): Standard storage
  - Cold tier (90+ days): Archive storage (S3, Glacier)

Indexing:
  - Index critical fields: timestamp, level, service, trace_id, user_id
  - Full-text search on message field
  - Use field extraction for structured logs
```

### 3. Traces (Where)

**Definition**: End-to-end request flow across distributed systems.

**Trace Anatomy**:
```
Trace (entire request)
├─ Span 1: API Gateway (50ms)
│  ├─ Span 2: Auth Service (10ms)
│  └─ Span 3: User Service (35ms)
│     ├─ Span 4: Database Query (20ms)
│     └─ Span 5: Cache Lookup (5ms)
└─ Span 6: Response Serialization (5ms)

Total Trace Duration: 50ms
Critical Path: Span 1 → Span 3 → Span 4
```

**Trace Context Propagation**:
```python
# OpenTelemetry Python Example
from opentelemetry import trace
from opentelemetry.propagate import inject, extract

tracer = trace.get_tracer(__name__)

# Starting a trace
with tracer.start_as_current_span("process_order") as span:
    span.set_attribute("order.id", order_id)
    span.set_attribute("order.amount", amount)

    # Propagate context to downstream service
    headers = {}
    inject(headers)  # Adds traceparent header

    response = requests.post(
        "https://payment-service/charge",
        headers=headers,
        json={"amount": amount}
    )

    if response.status_code != 200:
        span.set_status(Status(StatusCode.ERROR))
        span.record_exception(Exception("Payment failed"))
```

**Sampling Strategies**:
```yaml
Always Sample:
  - Errors and exceptions (100%)
  - Slow requests (p95+, 100%)
  - Specific user_ids (for debugging, 100%)

Head Sampling (at trace start):
  - Random sampling (1% of all traces)
  - Rate limiting (max 1000 traces/second)

Tail Sampling (after trace completion):
  - Sample interesting traces (errors, slow, specific attributes)
  - Requires buffering and additional processing
  - More accurate but higher resource cost
```

## Metrics Strategy

### The Four Golden Signals (Google SRE)

```yaml
1. Latency:
   Definition: Time to service a request
   Metrics:
     - http_request_duration_seconds (histogram)
     - Percentiles: p50, p90, p95, p99
   Thresholds:
     - p50 < 100ms
     - p95 < 500ms
     - p99 < 1000ms

2. Traffic:
   Definition: Demand on your system
   Metrics:
     - http_requests_per_second (counter rate)
     - active_connections (gauge)
   Analysis:
     - Daily patterns
     - Growth trends
     - Capacity planning

3. Errors:
   Definition: Rate of failed requests
   Metrics:
     - http_requests_total{status=~"5.."} (counter)
     - error_rate = errors / total_requests
   Thresholds:
     - Error rate < 0.1% (99.9% success)

4. Saturation:
   Definition: How "full" your service is
   Metrics:
     - cpu_usage_percent (gauge)
     - memory_usage_percent (gauge)
     - disk_usage_percent (gauge)
     - connection_pool_utilization (gauge)
   Thresholds:
     - Warning at 70%
     - Critical at 85%
```

### RED Method (for request-driven services)

```yaml
Rate: Number of requests per second
  PromQL: rate(http_requests_total[5m])

Errors: Number of failed requests per second
  PromQL: rate(http_requests_total{status=~"5.."}[5m])

Duration: Time taken per request
  PromQL: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### USE Method (for resources)

```yaml
Utilization: % time resource was busy
  Examples:
    - CPU: 100% - idle%
    - Disk: % time with I/O pending
    - Network: bandwidth used / max bandwidth

Saturation: Amount of queued work
  Examples:
    - CPU: Load average
    - Disk: I/O queue depth
    - Network: retransmit rate

Errors: Count of error events
  Examples:
    - Network: CRC errors, packet loss
    - Disk: I/O errors
    - Memory: OOM kills
```

### Metric Collection Patterns

**Push vs Pull**:
```yaml
Push Model (StatsD, CloudWatch):
  Pros:
    - Application controls when to send
    - Works with ephemeral jobs (batch, Lambda)
    - NAT/firewall friendly
  Cons:
    - Needs aggregation server
    - Can overwhelm receiver
    - Hard to detect silent failures

  Use When:
    - Short-lived processes
    - Restricted network (can't open ports)
    - Cloud-native serverless

Pull Model (Prometheus):
  Pros:
    - Service discovery integration
    - Centralized control of scrape interval
    - Easy to detect down targets
  Cons:
    - Requires open network path
    - Doesn't work well with NAT
    - Challenges with ephemeral jobs

  Use When:
    - Long-running services
    - Kubernetes/container environments
    - Need service discovery
```

**Prometheus Metrics Exposition**:
```python
# Python Flask Example
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from flask import Flask, Response
import time

app = Flask(__name__)

# Define metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

active_requests = Gauge(
    'active_requests',
    'Number of active requests'
)

@app.before_request
def before_request():
    active_requests.inc()
    request.start_time = time.time()

@app.after_request
def after_request(response):
    active_requests.dec()

    duration = time.time() - request.start_time
    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.endpoint or 'unknown'
    ).observe(duration)

    http_requests_total.labels(
        method=request.method,
        endpoint=request.endpoint or 'unknown',
        status=response.status_code
    ).inc()

    return response

@app.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype='text/plain')

@app.route('/api/users')
def get_users():
    # Your application logic
    return {'users': []}

if __name__ == '__main__':
    app.run(port=8080)
```

**Prometheus Scrape Configuration**:
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    region: 'us-east-1'

scrape_configs:
  - job_name: 'api-servers'
    static_configs:
      - targets:
          - 'api-1.example.com:8080'
          - 'api-2.example.com:8080'
          - 'api-3.example.com:8080'
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
```

## Alerting Best Practices

### Alert Design Principles

```yaml
1. Alerts Must Be Actionable:
   BAD:  "CPU usage is high"
   GOOD: "CPU usage > 85% for 10 minutes on app-server-3"

   Every alert should answer:
   - What is wrong?
   - Which component is affected?
   - What should I do about it?

2. Reduce False Positives:
   - Use sustained thresholds (not instantaneous spikes)
   - Example: Alert after 5 minutes > threshold, not first breach
   - Avoid alerting on symptoms if root cause is already alerting

3. Alert on Symptoms, Not Causes:
   BETTER: "API error rate > 1%" (user-facing symptom)
   WORSE:  "Redis connection count < 10" (internal cause)

   Exception: Alert on causes that lead to immediate failures
   Example: "Disk will be full in 4 hours"

4. Context in Alerts:
   - Include current value and threshold
   - Link to runbook
   - Link to relevant dashboard
   - Include recent changes

5. Appropriate Severity:
   - Page only for urgent, user-impacting issues
   - Ticket for important but not urgent issues
   - Dashboard/log for informational data
```

### Alert Fatigue Prevention

```yaml
Symptoms of Alert Fatigue:
  - Acknowledgments without investigation
  - Growing MTTA (Mean Time to Acknowledge)
  - Team frustration and burnout
  - Important alerts getting missed

Solutions:
  1. Alert Hygiene Reviews:
     - Weekly review of all fired alerts
     - Tune or remove alerts with >20% false positive rate
     - Track alert effectiveness metrics

  2. Alert Grouping:
     - Group related alerts (same root cause)
     - Example: Don't alert on every pod failure if deployment is alerting

  3. Dynamic Thresholds:
     - Use anomaly detection instead of static thresholds
     - Adjust thresholds based on time of day/week

  4. Escalation Policies:
     - Primary on-call: 5 min
     - Secondary on-call: 15 min
     - Team lead: 30 min
     - Engineering manager: 60 min

  5. Maintenance Windows:
     - Silence alerts during planned maintenance
     - Auto-create maintenance windows from change tickets
```

### Prometheus Alerting Rules

```yaml
# alerts.yml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)
          > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }} on {{ $labels.service }}"
          runbook: "https://wiki.example.com/runbooks/high-error-rate"
          dashboard: "https://grafana.example.com/d/api-dashboard"

      # High latency (p95)
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 1.0
        for: 10m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High p95 latency on {{ $labels.service }}"
          description: "p95 latency is {{ $value }}s on {{ $labels.service }}"

      # Saturation (CPU)
      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 10m
        labels:
          severity: warning
          team: infrastructure
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value | humanize }}% on {{ $labels.instance }}"

      # Disk space prediction
      - alert: DiskWillFillIn4Hours
        expr: |
          predict_linear(node_filesystem_free_bytes{fstype!~"tmpfs|fuse.lxcfs"}[1h], 4*3600) < 0
        for: 5m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: "Disk will fill on {{ $labels.instance }}"
          description: "Filesystem {{ $labels.mountpoint }} will fill in approximately 4 hours"

      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 5m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 5 minutes"

      # Certificate expiration
      - alert: CertificateExpiringSoon
        expr: |
          (probe_ssl_earliest_cert_expiry - time()) / 86400 < 14
        for: 1h
        labels:
          severity: warning
          team: infrastructure
        annotations:
          summary: "SSL certificate expiring soon"
          description: "Certificate for {{ $labels.instance }} expires in {{ $value | humanize }} days"
```

### PagerDuty Integration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: 'default-receiver'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # Critical alerts go to PagerDuty
    - match:
        severity: critical
      receiver: pagerduty-critical
      continue: true

    # Warnings go to Slack
    - match:
        severity: warning
      receiver: slack-warnings

    # Infrastructure team alerts
    - match:
        team: infrastructure
      receiver: slack-infrastructure
      routes:
        - match:
            severity: critical
          receiver: pagerduty-infrastructure

receivers:
  - name: 'default-receiver'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/XXX'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ .Alerts.Firing | len }}'
          resolved: '{{ .Alerts.Resolved | len }}'
          num_alerts: '{{ .Alerts | len }}'
        links:
          - href: '{{ .CommonAnnotations.runbook }}'
            text: 'Runbook'
          - href: '{{ .CommonAnnotations.dashboard }}'
            text: 'Dashboard'

  - name: 'slack-warnings'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YYY'
        channel: '#alerts-warnings'
        color: 'warning'

inhibit_rules:
  # Inhibit warning if critical is firing
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service', 'instance']
```

## Dashboard Design

### Dashboard Principles

```yaml
1. Audience-Specific Dashboards:
   - Executive Dashboard: Business metrics, SLAs, revenue impact
   - Operations Dashboard: System health, alerts, capacity
   - Development Dashboard: Deployment status, error rates, traces
   - Service Dashboard: Detailed metrics for specific service

2. Information Hierarchy:
   Top: Most critical information (current status)
   Middle: Supporting metrics and trends
   Bottom: Detailed breakdowns and diagnostics

3. Visual Best Practices:
   - Use color purposefully (red=bad, green=good, yellow=warning)
   - Avoid more than 6-8 panels per row
   - Consistent time ranges across panels
   - Include units in axis labels
   - Use logarithmic scale for wide-ranging data

4. Dashboard Variables:
   - Environment (production, staging, dev)
   - Service/Component
   - Time range
   - Region/Datacenter

5. Actionable Context:
   - Link panels to detailed views
   - Include threshold lines on graphs
   - Add annotations for deployments/incidents
```

### Grafana Dashboard Structure

```yaml
Executive Dashboard (Business Metrics):
  Row 1: Key Business Metrics
    - Revenue (last hour, today, this month)
    - Active Users (gauge)
    - Transaction Volume (time series)
    - Conversion Rate (percentage)

  Row 2: System Health Overview
    - Overall Availability (SLA compliance)
    - P95 Latency Across All Services
    - Error Budget Remaining
    - Active Incidents (count)

  Row 3: Trends
    - Revenue Trend (7 days)
    - User Growth (30 days)
    - Error Rate Trend (7 days)

Operations Dashboard (System Health):
  Row 1: Traffic Light Status
    - All Services Status (red/yellow/green stat panels)
    - Active Alerts Count
    - On-Call Engineer

  Row 2: Golden Signals
    - Request Rate (requests/sec across all services)
    - Error Rate (% errors)
    - P50/P95/P99 Latency
    - Saturation (CPU, Memory, Disk across fleet)

  Row 3: Infrastructure Health
    - CPU Usage by Host (heatmap)
    - Memory Usage by Host
    - Disk Usage by Host
    - Network Traffic

  Row 4: Recent Changes
    - Deployments (annotations)
    - Configuration Changes
    - Infrastructure Changes

Service-Specific Dashboard:
  Row 1: Service Overview
    - Request Rate
    - Error Rate
    - Latency (p50, p95, p99)
    - Active Instances

  Row 2: RED Metrics Breakdown
    - Requests by Endpoint
    - Errors by Type
    - Latency Distribution (histogram)

  Row 3: Dependencies
    - Database Query Performance
    - External API Call Performance
    - Cache Hit Rate
    - Queue Depth

  Row 4: Resource Usage
    - CPU per Instance
    - Memory per Instance
    - JVM/Runtime Metrics (if applicable)
```

### Grafana JSON Dashboard Example

```json
{
  "dashboard": {
    "title": "API Service Dashboard",
    "tags": ["api", "production"],
    "timezone": "browser",
    "templating": {
      "list": [
        {
          "name": "environment",
          "type": "query",
          "datasource": "Prometheus",
          "query": "label_values(http_requests_total, environment)",
          "current": {
            "text": "production",
            "value": "production"
          }
        },
        {
          "name": "service",
          "type": "query",
          "datasource": "Prometheus",
          "query": "label_values(http_requests_total{environment=\"$environment\"}, service)",
          "multi": true
        }
      ]
    },
    "annotations": {
      "list": [
        {
          "name": "Deployments",
          "datasource": "Prometheus",
          "expr": "deployment_events{service=\"$service\"}",
          "iconColor": "green"
        }
      ]
    },
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=\"$service\", environment=\"$environment\"}[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yaxes": [
          {"format": "reqps", "label": "Requests/sec"}
        ]
      },
      {
        "id": 2,
        "title": "Error Rate",
        "type": "graph",
        "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=\"$service\", status=~\"5..\"}[5m])) / sum(rate(http_requests_total{service=\"$service\"}[5m]))",
            "legendFormat": "Error Rate"
          }
        ],
        "thresholds": [
          {
            "value": 0.01,
            "colorMode": "critical",
            "op": "gt",
            "line": true,
            "fill": true
          }
        ],
        "yaxes": [
          {"format": "percentunit", "max": 0.05}
        ]
      },
      {
        "id": 3,
        "title": "Latency (p95)",
        "type": "graph",
        "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=\"$service\"}[5m])) by (le, endpoint))",
            "legendFormat": "{{endpoint}}"
          }
        ],
        "yaxes": [
          {"format": "s", "label": "Duration"}
        ]
      }
    ]
  }
}
```

## SLI/SLO/SLA Framework

### Definitions

```yaml
SLI (Service Level Indicator):
  Definition: Quantitative measure of service level
  Examples:
    - Request latency (95th percentile < 500ms)
    - Availability (% of successful requests)
    - Throughput (requests per second)
    - Data freshness (lag in minutes)

SLO (Service Level Objective):
  Definition: Target value or range for an SLI
  Examples:
    - 99.9% of requests complete in < 500ms
    - 99.95% availability over 30 days
    - Data lag < 5 minutes for 99% of data

SLA (Service Level Agreement):
  Definition: Contractual commitment with consequences
  Examples:
    - 99.9% uptime or customer gets credit
    - <500ms p95 latency or penalty payment
```

### SLO Design

```yaml
1. Choose Meaningful SLIs:
   User-Facing:
     - Availability: Can users access the service?
     - Latency: How fast do requests complete?
     - Quality: Are results correct/fresh?

   Behind-the-Scenes:
     - Throughput: Can system handle load?
     - Durability: Is data safe?
     - Correctness: Are computations accurate?

2. Set Realistic SLOs:
   - Start with current performance baseline
   - Add buffer for improvement (don't set SLO = current performance)
   - Consider user expectations and business requirements
   - Remember: 100% is the wrong SLO (no room for changes)

   Example:
     Current p95 latency: 300ms
     User expectation: < 1 second
     Set SLO: 500ms (between current and user max tolerance)

3. Error Budget:
   Formula: Error Budget = 100% - SLO

   Example:
     SLO: 99.9% availability
     Error Budget: 0.1% = 43.2 minutes/month

   Use:
     - Budget consumed = Actual downtime / Error budget
     - If budget exhausted: Freeze deployments, focus on reliability
     - If budget remaining: Safe to take risks (new features, refactors)

4. Multi-Window SLOs:
   - Short window (7 days): Detect immediate issues
   - Long window (30 days): Track trends
   - Rolling window: Continuous monitoring

   Example:
     7-day SLO: 99.5% (allows 50 minutes downtime)
     30-day SLO: 99.9% (allows 43 minutes downtime)
```

### SLO Monitoring with Prometheus

```yaml
# SLO recording rules
groups:
  - name: slo_recording_rules
    interval: 30s
    rules:
      # Total requests
      - record: slo:http_requests:total
        expr: sum(rate(http_requests_total[5m]))

      # Successful requests (not 5xx)
      - record: slo:http_requests:success
        expr: sum(rate(http_requests_total{status!~"5.."}[5m]))

      # Availability SLI (success rate)
      - record: slo:availability:ratio
        expr: slo:http_requests:success / slo:http_requests:total

      # Latency SLI (% of requests under threshold)
      - record: slo:latency:good_requests
        expr: |
          sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))

      - record: slo:latency:ratio
        expr: slo:latency:good_requests / slo:http_requests:total

      # Error budget calculation (30-day window)
      - record: slo:error_budget:availability:30d
        expr: |
          1 - (
            (1 - 0.999) /  # SLO target
            (1 - avg_over_time(slo:availability:ratio[30d]))
          )

# SLO alerting rules
  - name: slo_alerts
    rules:
      # Availability SLO burn rate alerts
      - alert: AvailabilitySLOBurnRateCritical
        expr: |
          (
            slo:availability:ratio < 0.999  # Below SLO
            and
            (1 - slo:availability:ratio) > 14.4 * (1 - 0.999)  # Burn rate > 14.4x (will exhaust budget in 2 days)
          )
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Critical SLO burn rate"
          description: "At current rate, 30-day error budget will be exhausted in 2 days"

      - alert: AvailabilitySLOBurnRateWarning
        expr: |
          (
            slo:availability:ratio < 0.999
            and
            (1 - slo:availability:ratio) > 6 * (1 - 0.999)  # Burn rate > 6x
          )
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Elevated SLO burn rate"
          description: "Error budget consumption is higher than expected"

      # Error budget exhausted
      - alert: ErrorBudgetExhausted
        expr: slo:error_budget:availability:30d <= 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error budget exhausted"
          description: "30-day error budget is exhausted. Freeze non-critical changes."
```

### SLO Dashboard Example

```json
{
  "dashboard": {
    "title": "SLO Dashboard",
    "panels": [
      {
        "title": "Availability SLO (30 days)",
        "type": "gauge",
        "targets": [{
          "expr": "avg_over_time(slo:availability:ratio[30d])"
        }],
        "options": {
          "min": 0.99,
          "max": 1.0,
          "thresholds": [
            {"value": 0.999, "color": "green"},
            {"value": 0.995, "color": "yellow"},
            {"value": 0.99, "color": "red"}
          ]
        }
      },
      {
        "title": "Error Budget Remaining",
        "type": "gauge",
        "targets": [{
          "expr": "slo:error_budget:availability:30d"
        }],
        "options": {
          "min": 0,
          "max": 1,
          "thresholds": [
            {"value": 0.5, "color": "green"},
            {"value": 0.25, "color": "yellow"},
            {"value": 0, "color": "red"}
          ]
        }
      },
      {
        "title": "Error Budget Burn Rate",
        "type": "graph",
        "targets": [{
          "expr": "(1 - slo:availability:ratio) / (1 - 0.999)",
          "legendFormat": "Burn Rate (1x = normal consumption)"
        }],
        "yaxes": [{
          "label": "Burn Rate Multiplier"
        }],
        "alert": {
          "threshold": 1,
          "message": "Burn rate above normal"
        }
      },
      {
        "title": "SLO Compliance History",
        "type": "table",
        "targets": [{
          "expr": "avg_over_time(slo:availability:ratio[7d])",
          "format": "table",
          "legendFormat": "7 days"
        }]
      }
    ]
  }
}
```

## Monitoring Tools

### Tool Comparison Matrix

| Tool | Best For | Strengths | Weaknesses | Cost |
|------|----------|-----------|------------|------|
| **Prometheus + Grafana** | Kubernetes, metrics | Open source, powerful querying, service discovery | Logs/traces need separate tools, scale challenges | Free (self-hosted) |
| **Datadog** | Full-stack observability | All-in-one, easy setup, great UX | Expensive at scale, vendor lock-in | $$$$ |
| **New Relic** | APM, application performance | Deep code insights, distributed tracing | Can be complex, pricing | $$$$ |
| **ELK Stack** | Log aggregation, search | Powerful search, flexible, open source | Complex to operate, resource-intensive | Free-$$ |
| **Splunk** | Enterprise logs, security | Mature, powerful, compliance features | Very expensive, steep learning curve | $$$$$ |
| **Cloudwatch** | AWS-native monitoring | Native AWS integration, no setup | Limited outside AWS, basic features | $$ |
| **Azure Monitor** | Azure-native monitoring | Native Azure integration | Limited outside Azure | $$ |
| **Google Cloud Monitoring** | GCP-native monitoring | Native GCP integration, free tier | Limited outside GCP | $ - $$ |

### Prometheus Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Prometheus Server                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Retrieval │→ │ Time Series  │→ │  HTTP Server (API)  │ │
│  │   (Scrape) │  │   Database   │  │                     │ │
│  └─────┬──────┘  └──────────────┘  └──────────┬──────────┘ │
│        │                                       │             │
└────────┼───────────────────────────────────────┼─────────────┘
         │                                       │
         │ Pull metrics                          │ PromQL queries
         ↓                                       ↓
┌──────────────────┐                   ┌─────────────────┐
│  Service Targets │                   │    Grafana      │
│  ┌────────────┐  │                   │   Dashboards    │
│  │ /metrics   │  │                   └─────────────────┘
│  └────────────┘  │
└──────────────────┘                   ┌─────────────────┐
                                       │  Alertmanager   │
┌──────────────────┐                   │  ┌───────────┐  │
│ Service Discovery│                   │  │ PagerDuty │  │
│  - Kubernetes    │                   │  │   Slack   │  │
│  - Consul        │                   │  └───────────┘  │
│  - DNS           │                   └─────────────────┘
└──────────────────┘
```

### ELK Stack Architecture

```
Application Servers
├─ App 1 → Filebeat →
├─ App 2 → Filebeat →     ┌──────────────┐
└─ App 3 → Filebeat → →→→ │ Logstash     │
                          │ (Aggregation │
Docker Containers         │  & Transform)│
└─ Fluentd → → → → → → → →└──────┬───────┘
                                 │
Network Devices                  ↓
└─ Syslog → → → → → → → →  ┌─────────────────┐
                           │  Elasticsearch  │
Cloud Services             │    (Storage &   │
└─ CloudWatch Logs → → → → │     Indexing)   │
                           └────────┬────────┘
                                    ↓
                           ┌─────────────────┐
                           │     Kibana      │
                           │  (Visualization)│
                           └─────────────────┘
```

## Implementation Examples

### Complete Monitoring Stack (Docker Compose)

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

### Kubernetes Monitoring with Prometheus Operator

```yaml
# Install kube-prometheus-stack (Helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.adminPassword=admin

# ServiceMonitor for custom application
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-service-monitor
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics

# PrometheusRule for custom alerts
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: api
      interval: 30s
      rules:
        - alert: ApiHighErrorRate
          expr: |
            sum(rate(http_requests_total{app="api",status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{app="api"}[5m]))
            > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High error rate on API"
```

This comprehensive monitoring guide provides everything needed to implement robust observability for IT operations.
