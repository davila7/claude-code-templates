# Observability: Monitoring, Logging & Tracing

## The Three Pillars of Observability

### 1. Metrics (What is happening?)
- **Definition**: Numeric measurements over time
- **Examples**: CPU usage, request rate, error rate, latency
- **Tools**: Prometheus, Datadog, CloudWatch, New Relic

### 2. Logs (Why is it happening?)
- **Definition**: Timestamped event records
- **Examples**: Application logs, access logs, error logs
- **Tools**: ELK Stack, Splunk, CloudWatch Logs, Loki

### 3. Traces (Where is it happening?)
- **Definition**: Request journey through distributed system
- **Examples**: Service call chains, database queries, external API calls
- **Tools**: Jaeger, Zipkin, AWS X-Ray, Datadog APM

## SLI/SLO/SLA Framework

### Service Level Indicators (SLIs)
**Quantitative measurements of service quality**

```yaml
# Common SLIs
availability:
  definition: "Percentage of successful requests"
  measurement: "(successful_requests / total_requests) * 100"

latency:
  definition: "Time to process request"
  measurement: "p95 response time < 200ms"

error_rate:
  definition: "Percentage of failed requests"
  measurement: "(failed_requests / total_requests) * 100"

throughput:
  definition: "Requests processed per second"
  measurement: "requests_per_second"
```

### Service Level Objectives (SLOs)
**Target values for SLIs**

```yaml
# Example SLOs
availability_slo:
  target: 99.9%
  measurement_window: 30 days
  error_budget: 0.1% (43 minutes per month)

latency_slo:
  target: "95% of requests < 200ms"
  measurement_window: 7 days

error_rate_slo:
  target: "< 0.1%"
  measurement_window: 24 hours
```

### Service Level Agreements (SLAs)
**Business contracts with consequences**

```yaml
# Example SLA
web_application_sla:
  availability: 99.9%
  latency_p95: 300ms
  consequences:
    - availability < 99.9%: 10% service credit
    - availability < 99.0%: 25% service credit
    - availability < 95.0%: 50% service credit
```

## Prometheus Setup

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    environment: 'prod'

# Alert manager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules
rule_files:
  - "/etc/prometheus/rules/*.yml"

# Scrape configurations
scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Kubernetes pods
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
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name

  # Node exporter
  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
```

### Alert Rules
```yaml
# alert-rules.yml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.job }}"
          runbook: "https://wiki.example.com/runbooks/high-error-rate"

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 10m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value | humanizeDuration }} for {{ $labels.job }}"

      # Low availability
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for more than 2 minutes"

  - name: kubernetes_alerts
    interval: 30s
    rules:
      # Pod crash looping
      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod crash looping"
          description: "Pod {{ $labels.namespace }}/{{ $labels.pod }} is crash looping"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Container {{ $labels.container }} in pod {{ $labels.pod }} is using {{ $value | humanizePercentage }} of memory"

      # Node disk space
      - alert: NodeDiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Node disk space low"
          description: "Node {{ $labels.node }} has less than 10% disk space available"
```

## Structured Logging

### Best Practices
```json
{
  "timestamp": "2025-10-17T10:30:45.123Z",
  "level": "ERROR",
  "service": "api-gateway",
  "version": "v1.2.3",
  "trace_id": "abc123def456",
  "span_id": "789ghi012jkl",
  "user_id": "user-12345",
  "request_id": "req-67890",
  "method": "POST",
  "path": "/api/v1/orders",
  "status_code": 500,
  "duration_ms": 245,
  "error": {
    "type": "DatabaseConnectionError",
    "message": "Failed to connect to database",
    "stack_trace": "..."
  },
  "context": {
    "order_id": "order-98765",
    "customer_id": "cust-54321"
  }
}
```

### Logging Configuration (Node.js Example)
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    environment: process.env.ENVIRONMENT
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});

// Usage with correlation ID
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  req.logger = logger.child({
    request_id: req.id,
    trace_id: req.headers['x-trace-id']
  });
  next();
});

app.post('/api/orders', async (req, res) => {
  req.logger.info('Creating order', {
    customer_id: req.body.customer_id
  });

  try {
    const order = await createOrder(req.body);
    req.logger.info('Order created successfully', {
      order_id: order.id
    });
    res.json(order);
  } catch (error) {
    req.logger.error('Failed to create order', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Distributed Tracing

### OpenTelemetry Configuration
```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024

  memory_limiter:
    check_interval: 1s
    limit_mib: 512

  resource:
    attributes:
      - key: environment
        value: production
        action: insert

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  prometheus:
    endpoint: 0.0.0.0:8889

  logging:
    loglevel: info

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [jaeger, logging]

    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [prometheus, logging]
```

### Application Instrumentation (Python Example)
```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

# Set up tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Configure OTLP exporter
otlp_exporter = OTLPSpanExporter(
    endpoint="otel-collector:4317",
    insecure=True
)

# Add span processor
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Instrument Flask and requests library
app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)
RequestsInstrumentor().instrument()

# Manual span creation
@app.route('/api/order/<order_id>')
def get_order(order_id):
    with tracer.start_as_current_span("get_order") as span:
        span.set_attribute("order.id", order_id)
        span.set_attribute("user.id", request.headers.get('X-User-ID'))

        # Add events
        span.add_event("Fetching order from database")
        order = fetch_order_from_db(order_id)

        if not order:
            span.set_status(Status(StatusCode.ERROR, "Order not found"))
            return {"error": "Order not found"}, 404

        span.add_event("Order retrieved successfully")
        return order
```

## Dashboards & Visualization

### Grafana Dashboard JSON (Example)
```json
{
  "dashboard": {
    "title": "Application Performance",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "type": "graph"
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Latency"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "sum(up{job=\"myapp\"})",
            "legendFormat": "Active Instances"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

## On-Call & Incident Response

### Runbook Template
```markdown
# Runbook: High Error Rate Alert

## Alert Details
- **Alert Name**: HighErrorRate
- **Severity**: Critical
- **Team**: Backend Engineering
- **On-Call**: See PagerDuty schedule

## Symptoms
- Error rate exceeds 5% for 5 minutes
- Users experiencing 5xx errors
- Elevated p95 latency

## Investigation Steps

1. **Check service health**
   ```bash
   kubectl get pods -n production -l app=myapp
   kubectl logs -n production -l app=myapp --tail=100
   ```

2. **Review error logs**
   - Check Grafana dashboard
   - Review application logs in Kibana
   - Check CloudWatch metrics

3. **Identify error patterns**
   - What endpoints are failing?
   - Are errors consistent across all pods?
   - Is there a pattern in timing?

4. **Check dependencies**
   - Database connectivity
   - External API availability
   - Redis/cache status

## Common Causes & Solutions

### Database Connection Issues
- **Symptoms**: Connection timeout errors
- **Solution**:
  ```bash
  # Check database connectivity
  kubectl exec -it <pod-name> -- nc -zv database-host 5432

  # Check connection pool
  kubectl logs <pod-name> | grep "connection pool"
  ```

### Memory Leaks
- **Symptoms**: Increasing memory usage, OOM kills
- **Solution**: Restart affected pods, investigate memory usage

### Deployment Issues
- **Symptoms**: Errors started after deployment
- **Solution**: Rollback deployment
  ```bash
  kubectl rollout undo deployment/myapp -n production
  ```

## Escalation
- If unresolved after 15 minutes, escalate to Senior Engineer
- If service degradation > 30 minutes, notify VP Engineering

## Post-Incident
- Create incident report
- Schedule post-mortem
- Update runbook with findings
```

## Observability Best Practices

1. **Use consistent naming**: Follow naming conventions for metrics, logs, traces
2. **Add context**: Include correlation IDs in logs and traces
3. **Set meaningful alerts**: Avoid alert fatigue with actionable alerts
4. **Define SLOs**: Measure what matters to users
5. **Practice incident response**: Regular game days and fire drills
6. **Automate runbooks**: Convert manual steps to automated remediation
7. **Monitor the monitors**: Ensure observability stack is reliable
8. **Continuous improvement**: Review and refine based on incidents

---

## Tools Comparison

| Feature | Prometheus | Datadog | New Relic | CloudWatch |
|---------|-----------|---------|-----------|------------|
| Metrics | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓ |
| Logs | via Loki | ✓✓✓ | ✓✓✓ | ✓✓✓ |
| Traces | via Tempo | ✓✓✓ | ✓✓✓ | ✓✓ |
| Cost | Free (self-hosted) | $$$ | $$$ | $$ |
| Learning Curve | Medium | Low | Low | Low |
| Kubernetes Native | ✓✓✓ | ✓✓ | ✓✓ | ✓ |
