---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [monitoring-type] | setup | dashboard | alerts | metrics | health | performance
description: Comprehensive deployment monitoring with observability, alerting, health checks, and performance tracking
model: sonnet
---

# Deployment Monitoring & Observability

Setup comprehensive deployment monitoring: $ARGUMENTS

## Current Monitoring State

- Existing monitoring: !`kubectl get pods -n monitoring 2>/dev/null || docker ps | grep -E "(prometheus|grafana|jaeger)" || echo "No monitoring detected"`
- Health endpoints: !`curl -s https://api.example.com/health 2>/dev/null | jq -r '.status // "Unknown"' || echo "Health endpoint needed"`
- Metrics exposure: !`curl -s https://api.example.com/metrics 2>/dev/null | head -5 || echo "Metrics endpoint needed"`
- Log aggregation: !`kubectl get pods -n logging 2>/dev/null || echo "Log aggregation setup needed"`
- APM integration: Check for application performance monitoring setup

## Task

Implement comprehensive monitoring and observability for deployments with real-time insights, alerting, and automated response capabilities.

## Monitoring Architecture

### 1. **Core Monitoring Stack**

#### Prometheus Configuration
```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
      
    rule_files:
      - "/etc/prometheus/rules/*.yml"
      
    scrape_configs:
      # Application metrics
      - job_name: 'myapp'
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
            
      # Kubernetes cluster metrics
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_phase]
            action: keep
            regex: Running
            
      # Node exporter for infrastructure metrics
      - job_name: 'node-exporter'
        kubernetes_sd_configs:
          - role: endpoints
        relabel_configs:
          - source_labels: [__meta_kubernetes_endpoints_name]
            action: keep
            regex: node-exporter
            
      # Deployment-specific metrics
      - job_name: 'deployment-metrics'
        static_configs:
          - targets: ['deployment-exporter:9090']
        metrics_path: /metrics
        scrape_interval: 30s

    alerting:
      alertmanagers:
        - static_configs:
            - targets: ['alertmanager:9093']

---
# Prometheus Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:v2.40.0
        args:
          - '--config.file=/etc/prometheus/prometheus.yml'
          - '--storage.tsdb.path=/prometheus'
          - '--web.console.libraries=/etc/prometheus/console_libraries'
          - '--web.console.templates=/etc/prometheus/consoles'
          - '--storage.tsdb.retention.time=30d'
          - '--web.enable-lifecycle'
          - '--web.enable-admin-api'
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        - name: prometheus-storage
          mountPath: /prometheus
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
      - name: prometheus-storage
        persistentVolumeClaim:
          claimName: prometheus-pvc
```

#### Grafana Dashboard Configuration
```yaml
# grafana-dashboard-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: deployment-dashboard
  namespace: monitoring
data:
  deployment-monitoring.json: |
    {
      "dashboard": {
        "id": null,
        "title": "Deployment Monitoring Dashboard",
        "tags": ["deployment", "monitoring"],
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "Deployment Status",
            "type": "stat",
            "targets": [
              {
                "expr": "up{job=\"myapp\"}",
                "legendFormat": "{{instance}}"
              }
            ],
            "fieldConfig": {
              "defaults": {
                "thresholds": {
                  "steps": [
                    {"color": "red", "value": 0},
                    {"color": "green", "value": 1}
                  ]
                }
              }
            }
          },
          {
            "id": 2,
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])",
                "legendFormat": "{{method}} {{status}}"
              }
            ]
          },
          {
            "id": 3,
            "title": "Error Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
                "legendFormat": "Error Rate %"
              }
            ]
          },
          {
            "id": 4,
            "title": "Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                "legendFormat": "95th percentile"
              },
              {
                "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
                "legendFormat": "50th percentile"
              }
            ]
          },
          {
            "id": 5,
            "title": "Pod Resource Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(container_cpu_usage_seconds_total{pod=~\"myapp-.*\"}[5m]) * 100",
                "legendFormat": "CPU Usage - {{pod}}"
              },
              {
                "expr": "container_memory_usage_bytes{pod=~\"myapp-.*\"} / 1024 / 1024",
                "legendFormat": "Memory Usage MB - {{pod}}"
              }
            ]
          },
          {
            "id": 6,
            "title": "Deployment Events",
            "type": "logs",
            "targets": [
              {
                "expr": "{job=\"kubernetes-events\"} |= \"myapp\"",
                "legendFormat": ""
              }
            ]
          }
        ],
        "time": {
          "from": "now-1h",
          "to": "now"
        },
        "refresh": "30s"
      }
    }
```

### 2. **Application Health Monitoring**

#### Health Check Implementation
```javascript
// health-check.js - Application health endpoint
const express = require('express');
const { promisify } = require('util');

class HealthMonitor {
  constructor() {
    this.checks = new Map();
    this.status = 'healthy';
    this.lastCheck = new Date();
  }

  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      check: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      lastStatus: null,
      lastCheck: null,
      errorCount: 0
    });
  }

  async runHealthChecks() {
    const results = {};
    let overallHealthy = true;
    
    for (const [name, config] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          config.check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), config.timeout)
          )
        ]);
        
        const duration = Date.now() - startTime;
        
        results[name] = {
          status: 'healthy',
          duration,
          details: result,
          lastCheck: new Date().toISOString()
        };
        
        config.lastStatus = 'healthy';
        config.errorCount = 0;
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
        
        config.lastStatus = 'unhealthy';
        config.errorCount++;
        
        if (config.critical) {
          overallHealthy = false;
        }
      }
      
      config.lastCheck = new Date();
    }
    
    this.status = overallHealthy ? 'healthy' : 'unhealthy';
    this.lastCheck = new Date();
    
    return {
      status: this.status,
      timestamp: this.lastCheck.toISOString(),
      checks: results,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || 'unknown'
    };
  }

  setupEndpoints(app) {
    // Liveness probe - basic application health
    app.get('/health', async (req, res) => {
      const health = await this.runHealthChecks();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Readiness probe - ready to receive traffic
    app.get('/ready', async (req, res) => {
      const health = await this.runHealthChecks();
      
      // Additional readiness checks
      const readinessChecks = {
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9,
        activeConnections: true, // Check active connections if applicable
      };
      
      const isReady = health.status === 'healthy' && 
                     Object.values(readinessChecks).every(check => check);
      
      res.status(isReady ? 200 : 503).json({
        ...health,
        ready: isReady,
        readinessChecks
      });
    });

    // Startup probe - application has started
    app.get('/startup', (req, res) => {
      res.status(200).json({
        status: 'started',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime()
      });
    });
  }
}

// Usage example
const healthMonitor = new HealthMonitor();

// Register health checks
healthMonitor.registerCheck('database', async () => {
  // Database connectivity check
  await db.query('SELECT 1');
  return { connected: true };
}, { critical: true, timeout: 3000 });

healthMonitor.registerCheck('redis', async () => {
  // Redis connectivity check
  await redis.ping();
  return { connected: true };
}, { critical: false, timeout: 2000 });

healthMonitor.registerCheck('external-api', async () => {
  // External service check
  const response = await fetch('https://api.external-service.com/health');
  return { status: response.status, healthy: response.ok };
}, { critical: false, timeout: 5000 });

module.exports = healthMonitor;
```

### 3. **Custom Metrics and Instrumentation**

#### Application Metrics
```javascript
// metrics.js - Application metrics collection
const promClient = require('prom-client');

class DeploymentMetrics {
  constructor() {
    // Default metrics
    promClient.collectDefaultMetrics({
      prefix: 'myapp_',
      timeout: 5000,
    });

    // Custom deployment metrics
    this.deploymentInfo = new promClient.Gauge({
      name: 'myapp_deployment_info',
      help: 'Deployment information',
      labelNames: ['version', 'environment', 'commit_sha']
    });

    this.httpRequestsTotal = new promClient.Counter({
      name: 'myapp_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'status_code', 'route']
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'myapp_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'status_code', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.activeConnections = new promClient.Gauge({
      name: 'myapp_active_connections',
      help: 'Number of active connections'
    });

    this.deploymentEvents = new promClient.Counter({
      name: 'myapp_deployment_events_total',
      help: 'Deployment events',
      labelNames: ['event_type', 'status']
    });

    this.healthCheckStatus = new promClient.Gauge({
      name: 'myapp_health_check_status',
      help: 'Health check status (1 = healthy, 0 = unhealthy)',
      labelNames: ['check_name']
    });

    // Business metrics
    this.businessMetrics = {
      activeUsers: new promClient.Gauge({
        name: 'myapp_active_users',
        help: 'Number of active users'
      }),
      
      transactionsTotal: new promClient.Counter({
        name: 'myapp_transactions_total',
        help: 'Total transactions processed',
        labelNames: ['type', 'status']
      }),
      
      errorRate: new promClient.Gauge({
        name: 'myapp_error_rate',
        help: 'Application error rate percentage'
      })
    };

    this.initializeMetrics();
  }

  initializeMetrics() {
    // Set deployment information
    this.deploymentInfo.set({
      version: process.env.APP_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      commit_sha: process.env.GIT_COMMIT_SHA || 'unknown'
    }, 1);
  }

  recordHttpRequest(req, res, duration) {
    const labels = {
      method: req.method,
      status_code: res.statusCode,
      route: req.route?.path || req.path
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  recordDeploymentEvent(eventType, status) {
    this.deploymentEvents.inc({
      event_type: eventType,
      status: status
    });
  }

  updateHealthCheckStatus(checkName, isHealthy) {
    this.healthCheckStatus.set(
      { check_name: checkName },
      isHealthy ? 1 : 0
    );
  }

  updateActiveConnections(count) {
    this.activeConnections.set(count);
  }

  // Middleware for Express.js
  expressMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        this.recordHttpRequest(req, res, duration);
      });
      
      next();
    };
  }

  // Get metrics endpoint
  getMetricsHandler() {
    return async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      const metrics = await promClient.register.metrics();
      res.end(metrics);
    };
  }
}

module.exports = DeploymentMetrics;
```

### 4. **Alert Configuration**

#### Alertmanager Configuration
```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      smtp_smarthost: 'smtp.gmail.com:587'
      smtp_from: 'alerts@example.com'
      smtp_auth_username: 'alerts@example.com'
      smtp_auth_password: 'password'
      
    route:
      group_by: ['alertname', 'environment']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: 'critical-alerts'
        continue: true
      - match:
          alertname: DeploymentFailed
        receiver: 'deployment-alerts'
        continue: true
      - match:
          service: myapp
        receiver: 'app-alerts'
        
    receivers:
    - name: 'default'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#monitoring'
        title: 'Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        
    - name: 'critical-alerts'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
      email_configs:
      - to: 'oncall@example.com'
        subject: 'CRITICAL Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        body: |
          Alert Details:
          {{ range .Alerts }}
          - Alert: {{ .Annotations.summary }}
          - Description: {{ .Annotations.description }}
          - Severity: {{ .Labels.severity }}
          - Environment: {{ .Labels.environment }}
          {{ end }}
          
    - name: 'deployment-alerts'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#deployments'
        title: '🚀 Deployment Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        
    - name: 'app-alerts'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#app-monitoring'
        
    inhibit_rules:
    - source_match:
        severity: 'critical'
      target_match:
        severity: 'warning'
      equal: ['alertname', 'environment', 'service']
```

#### Deployment Alert Rules
```yaml
# deployment-alert-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: deployment-monitoring-rules
  namespace: monitoring
spec:
  groups:
  - name: deployment-health
    rules:
    # Application availability
    - alert: ApplicationDown
      expr: up{job="myapp"} == 0
      for: 1m
      labels:
        severity: critical
        service: myapp
      annotations:
        summary: "Application instance is down"
        description: "{{ $labels.instance }} has been down for more than 1 minute"
        runbook_url: "https://wiki.example.com/runbooks/app-down"
        
    # High error rate
    - alert: HighErrorRate
      expr: rate(myapp_http_requests_total{status_code=~"5.."}[5m]) / rate(myapp_http_requests_total[5m]) * 100 > 5
      for: 2m
      labels:
        severity: critical
        service: myapp
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }}% for the last 5 minutes"
        
    # Slow response times
    - alert: SlowResponseTime
      expr: histogram_quantile(0.95, rate(myapp_http_request_duration_seconds_bucket[5m])) > 2
      for: 5m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "Slow response times detected"
        description: "95th percentile response time is {{ $value }}s"
        
    # Memory usage
    - alert: HighMemoryUsage
      expr: container_memory_usage_bytes{pod=~"myapp-.*"} / container_spec_memory_limit_bytes * 100 > 80
      for: 5m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "High memory usage"
        description: "Pod {{ $labels.pod }} memory usage is {{ $value }}%"
        
    # CPU usage
    - alert: HighCPUUsage
      expr: rate(container_cpu_usage_seconds_total{pod=~"myapp-.*"}[5m]) * 100 > 80
      for: 10m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "High CPU usage"
        description: "Pod {{ $labels.pod }} CPU usage is {{ $value }}%"
        
  - name: deployment-events
    rules:
    # Deployment failed
    - alert: DeploymentFailed
      expr: increase(kube_deployment_status_replicas_unavailable{deployment=~"myapp-.*"}[5m]) > 0
      for: 2m
      labels:
        severity: critical
        service: myapp
      annotations:
        summary: "Deployment has failed pods"
        description: "Deployment {{ $labels.deployment }} has {{ $value }} unavailable replicas"
        
    # Deployment stuck
    - alert: DeploymentStuck
      expr: kube_deployment_spec_replicas{deployment=~"myapp-.*"} != kube_deployment_status_ready_replicas{deployment=~"myapp-.*"}
      for: 10m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "Deployment appears stuck"
        description: "Deployment {{ $labels.deployment }} has been in progress for more than 10 minutes"
        
    # Pod crash looping
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total{pod=~"myapp-.*"}[5m]) > 0.1
      for: 2m
      labels:
        severity: critical
        service: myapp
      annotations:
        summary: "Pod is crash looping"
        description: "Pod {{ $labels.pod }} is restarting frequently"
        
  - name: business-metrics
    rules:
    # Transaction failure rate
    - alert: HighTransactionFailureRate
      expr: rate(myapp_transactions_total{status="failed"}[5m]) / rate(myapp_transactions_total[5m]) * 100 > 1
      for: 5m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "High transaction failure rate"
        description: "Transaction failure rate is {{ $value }}%"
        
    # Low active users (potential issue indicator)
    - alert: LowActiveUsers
      expr: myapp_active_users < 10 and hour() > 8 and hour() < 18  # During business hours
      for: 15m
      labels:
        severity: warning
        service: myapp
      annotations:
        summary: "Unusually low active user count"
        description: "Only {{ $value }} active users during business hours"
```

### 5. **Log Aggregation and Analysis**

#### Fluentd Configuration
```yaml
# fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: logging
data:
  fluent.conf: |
    <source>
      @type tail
      @id myapp_logs
      path /var/log/containers/myapp-*.log
      pos_file /var/log/fluentd-myapp.log.pos
      tag kubernetes.myapp
      format json
      time_key time
      time_format %Y-%m-%dT%H:%M:%S.%NZ
    </source>
    
    <filter kubernetes.myapp>
      @type kubernetes_metadata
      @id kubernetes_metadata
    </filter>
    
    <filter kubernetes.myapp>
      @type parser
      key_name log
      reserve_data true
      <parse>
        @type json
        time_key timestamp
        time_format %Y-%m-%dT%H:%M:%S.%L%z
      </parse>
    </filter>
    
    # Deployment event logs
    <filter kubernetes.myapp>
      @type record_transformer
      enable_ruby true
      <record>
        deployment_info ${record.dig("kubernetes", "labels", "deployment") || "unknown"}
        environment ${record.dig("kubernetes", "labels", "environment") || "unknown"}
        version ${record.dig("kubernetes", "labels", "version") || "unknown"}
        log_level ${record["level"] || "info"}
        component ${record["component"] || "application"}
      </record>
    </filter>
    
    # Error log alerts
    <filter kubernetes.myapp>
      @type grep
      <regexp>
        key log_level
        pattern /error|fatal|panic/i
      </regexp>
      <record>
        alert_type error
        needs_attention true
      </record>
    </filter>
    
    <match kubernetes.myapp>
      @type elasticsearch
      @id out_es_myapp
      hosts elasticsearch.logging.svc.cluster.local:9200
      logstash_format true
      logstash_prefix myapp-deployment
      include_tag_key true
      tag_key @log_name
      flush_interval 10s
      
      <buffer>
        @type file
        path /var/log/fluentd-buffers/myapp.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
```

### 6. **Performance Monitoring**

#### APM Integration with Jaeger
```javascript
// tracing.js - Distributed tracing setup
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'myapp',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || 'unknown',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: jaegerExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Customize instrumentation
      '@opentelemetry/instrumentation-http': {
        requestHook: (span, request) => {
          span.setAttribute('deployment.version', process.env.APP_VERSION);
          span.setAttribute('deployment.environment', process.env.NODE_ENV);
        },
      },
    }),
  ],
});

sdk.start();

// Custom deployment tracing
const { trace, context } = require('@opentelemetry/api');

class DeploymentTracer {
  constructor() {
    this.tracer = trace.getTracer('deployment-monitor', '1.0.0');
  }

  traceDeploymentEvent(eventName, metadata, callback) {
    const span = this.tracer.startSpan(`deployment.${eventName}`, {
      attributes: {
        'deployment.event': eventName,
        'deployment.version': metadata.version,
        'deployment.environment': metadata.environment,
        'deployment.timestamp': new Date().toISOString(),
      },
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await callback();
        span.setStatus({ code: trace.SpanStatusCode.OK });
        span.setAttribute('deployment.result', 'success');
        return result;
      } catch (error) {
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.setAttribute('deployment.result', 'failure');
        span.setAttribute('deployment.error', error.message);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

module.exports = { DeploymentTracer, sdk };
```

### 7. **Monitoring Dashboard Setup Script**

#### Complete Monitoring Setup
```bash
#!/bin/bash
# setup-monitoring.sh

set -e

NAMESPACE_MONITORING="monitoring"
NAMESPACE_LOGGING="logging"
APP_NAME="myapp"

log() {
    echo -e "\033[32m[$(date '+%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[31m[ERROR] $1\033[0m"
    exit 1
}

# Create namespaces
create_namespaces() {
    log "Creating monitoring namespaces..."
    
    kubectl create namespace $NAMESPACE_MONITORING --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $NAMESPACE_LOGGING --dry-run=client -o yaml | kubectl apply -f -
    
    # Add labels
    kubectl label namespace $NAMESPACE_MONITORING monitoring=enabled --overwrite
    kubectl label namespace $NAMESPACE_LOGGING logging=enabled --overwrite
}

# Deploy Prometheus
deploy_prometheus() {
    log "Deploying Prometheus..."
    
    # Create service account
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: $NAMESPACE_MONITORING
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources: ["nodes", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: $NAMESPACE_MONITORING
EOF
    
    # Create PVC for Prometheus data
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-pvc
  namespace: $NAMESPACE_MONITORING
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF
    
    # Apply Prometheus configuration and deployment
    kubectl apply -f k8s/monitoring/prometheus/
    
    log "Prometheus deployed successfully"
}

# Deploy Grafana
deploy_grafana() {
    log "Deploying Grafana..."
    
    # Create Grafana secret for admin password
    kubectl create secret generic grafana-admin \
        --from-literal=admin-user=admin \
        --from-literal=admin-password=admin123 \
        -n $NAMESPACE_MONITORING \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Grafana
    kubectl apply -f k8s/monitoring/grafana/
    
    log "Grafana deployed successfully"
    log "Access Grafana at: http://localhost:3000 (after port-forward)"
    log "Credentials: admin / admin123"
}

# Deploy Alertmanager
deploy_alertmanager() {
    log "Deploying Alertmanager..."
    
    kubectl apply -f k8s/monitoring/alertmanager/
    
    log "Alertmanager deployed successfully"
}

# Deploy logging stack
deploy_logging() {
    log "Deploying logging stack..."
    
    # Deploy Elasticsearch
    kubectl apply -f k8s/logging/elasticsearch/
    
    # Wait for Elasticsearch to be ready
    kubectl wait --for=condition=ready pod -l app=elasticsearch -n $NAMESPACE_LOGGING --timeout=300s
    
    # Deploy Fluentd
    kubectl apply -f k8s/logging/fluentd/
    
    # Deploy Kibana
    kubectl apply -f k8s/logging/kibana/
    
    log "Logging stack deployed successfully"
}

# Setup application monitoring
setup_app_monitoring() {
    log "Setting up application monitoring..."
    
    # Add monitoring annotations to application deployment
    kubectl patch deployment $APP_NAME -p '{
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "prometheus.io/scrape": "true",
                        "prometheus.io/port": "3000",
                        "prometheus.io/path": "/metrics"
                    }
                }
            }
        }
    }'
    
    # Create ServiceMonitor for Prometheus Operator (if using)
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${APP_NAME}-monitor
  namespace: $NAMESPACE_MONITORING
spec:
  selector:
    matchLabels:
      app: $APP_NAME
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
EOF
    
    log "Application monitoring configured"
}

# Create port-forward scripts
create_access_scripts() {
    log "Creating access scripts..."
    
    cat > port-forward-monitoring.sh <<EOF
#!/bin/bash
echo "Starting port-forwards for monitoring stack..."
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000"
echo "Alertmanager: http://localhost:9093"

kubectl port-forward -n $NAMESPACE_MONITORING svc/prometheus 9090:9090 &
kubectl port-forward -n $NAMESPACE_MONITORING svc/grafana 3000:3000 &
kubectl port-forward -n $NAMESPACE_MONITORING svc/alertmanager 9093:9093 &

echo "Press Ctrl+C to stop all port-forwards"
wait
EOF
    
    chmod +x port-forward-monitoring.sh
    
    cat > port-forward-logging.sh <<EOF
#!/bin/bash
echo "Starting port-forwards for logging stack..."
echo "Kibana: http://localhost:5601"
echo "Elasticsearch: http://localhost:9200"

kubectl port-forward -n $NAMESPACE_LOGGING svc/kibana 5601:5601 &
kubectl port-forward -n $NAMESPACE_LOGGING svc/elasticsearch 9200:9200 &

echo "Press Ctrl+C to stop all port-forwards"
wait
EOF
    
    chmod +x port-forward-logging.sh
    
    log "Access scripts created: port-forward-monitoring.sh and port-forward-logging.sh"
}

# Verify deployment
verify_deployment() {
    log "Verifying monitoring deployment..."
    
    # Check if all pods are running
    kubectl get pods -n $NAMESPACE_MONITORING
    kubectl get pods -n $NAMESPACE_LOGGING
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready pod --all -n $NAMESPACE_MONITORING --timeout=300s
    kubectl wait --for=condition=ready pod --all -n $NAMESPACE_LOGGING --timeout=300s
    
    log "✅ Monitoring stack deployed and running successfully!"
    log ""
    log "Next steps:"
    log "1. Run ./port-forward-monitoring.sh to access monitoring UIs"
    log "2. Import Grafana dashboards from k8s/monitoring/grafana/dashboards/"
    log "3. Configure Slack/email notifications in Alertmanager"
    log "4. Set up log parsing rules in Kibana"
}

# Main deployment function
main() {
    log "Setting up comprehensive deployment monitoring..."
    
    create_namespaces
    deploy_prometheus
    deploy_grafana
    deploy_alertmanager
    deploy_logging
    setup_app_monitoring
    create_access_scripts
    verify_deployment
    
    log "🎉 Deployment monitoring setup completed!"
}

# Script execution
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "monitoring-only")
        create_namespaces
        deploy_prometheus
        deploy_grafana
        deploy_alertmanager
        setup_app_monitoring
        create_access_scripts
        verify_deployment
        ;;
    "logging-only")
        create_namespaces
        deploy_logging
        verify_deployment
        ;;
    "cleanup")
        log "Cleaning up monitoring stack..."
        kubectl delete namespace $NAMESPACE_MONITORING
        kubectl delete namespace $NAMESPACE_LOGGING
        rm -f port-forward-*.sh
        log "Cleanup completed"
        ;;
    *)
        echo "Usage: $0 {deploy|monitoring-only|logging-only|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy          - Deploy complete monitoring and logging stack"
        echo "  monitoring-only - Deploy only monitoring (Prometheus, Grafana, Alertmanager)"
        echo "  logging-only    - Deploy only logging stack (ELK)"
        echo "  cleanup         - Remove all monitoring components"
        exit 1
        ;;
esac
```

This comprehensive deployment monitoring system provides:

- **Complete observability stack** with Prometheus, Grafana, and Alertmanager
- **Application performance monitoring** with custom metrics and tracing
- **Log aggregation and analysis** with ELK stack
- **Real-time alerting** for deployment issues and performance degradation
- **Health monitoring** with liveness, readiness, and startup probes
- **Business metrics tracking** for deployment impact assessment
- **Automated setup and configuration** with verification scripts

The system enables proactive monitoring of deployments with comprehensive insights into application health, performance, and user impact.