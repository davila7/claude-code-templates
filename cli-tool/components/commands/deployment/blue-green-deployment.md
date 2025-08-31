---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [strategy] | setup | deploy | switch | rollback | status
description: Implement blue-green deployment strategy with zero-downtime switching, health validation, and automatic rollback
model: sonnet
---

# Blue-Green Deployment Strategy

Implement blue-green deployment: $ARGUMENTS

## Current Infrastructure State

- Load balancer config: @nginx.conf or @haproxy.cfg or cloud LB configuration
- Current deployment: !`curl -s https://api.example.com/version 2>/dev/null || echo "Version endpoint needed"`
- Container orchestration: !`kubectl get deployments 2>/dev/null || docker service ls 2>/dev/null || echo "Container platform detection needed"`
- Health endpoints: !`curl -s https://api.example.com/health 2>/dev/null | jq -r '.status // "Unknown"' || echo "Health check setup needed"`
- DNS configuration: Check for DNS management capabilities

## Task

Implement production-grade blue-green deployment with comprehensive validation and monitoring.

## Blue-Green Architecture Components

### 1. **Infrastructure Setup**

#### Load Balancer Configuration (NGINX)
```nginx
upstream blue {
    server blue-app-1:3000;
    server blue-app-2:3000;
    server blue-app-3:3000;
}

upstream green {
    server green-app-1:3000;
    server green-app-2:3000;
    server green-app-3:3000;
}

# Current active environment
upstream active {
    server blue-app-1:3000;
    server blue-app-2:3000;
    server blue-app-3:3000;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://active;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Environment $environment;
        
        # Health check configuration
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
        
        # Retry configuration
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://active/health;
        proxy_connect_timeout 1s;
        proxy_send_timeout 1s;
        proxy_read_timeout 1s;
    }

    # Environment indicator
    location /environment {
        access_log off;
        return 200 $environment;
        add_header Content-Type text/plain;
    }
}
```

#### HAProxy Configuration
```haproxy
global
    daemon
    log 127.0.0.1:514 local0
    stats socket /var/run/haproxy.sock mode 600 level admin

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull

# Blue environment
backend blue_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server blue1 blue-app-1:3000 check
    server blue2 blue-app-2:3000 check
    server blue3 blue-app-3:3000 check

# Green environment
backend green_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server green1 green-app-1:3000 check
    server green2 green-app-2:3000 check
    server green3 green-app-3:3000 check

# Frontend with switching logic
frontend main_frontend
    bind *:80
    # Environment switching via ACL
    use_backend blue_backend if { var(txn.environment) -m str blue }
    use_backend green_backend if { var(txn.environment) -m str green }
    default_backend blue_backend  # Default to blue

# Stats interface
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
```

### 2. **Kubernetes Blue-Green Implementation**

#### Blue-Green Service Management
```yaml
# blue-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service-blue
  labels:
    app: myapp
    environment: blue
spec:
  selector:
    app: myapp
    environment: blue
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# green-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service-green
  labels:
    app: myapp
    environment: green
spec:
  selector:
    app: myapp
    environment: green
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# active-service.yaml (points to current active environment)
apiVersion: v1
kind: Service
metadata:
  name: app-service-active
  labels:
    app: myapp
    environment: active
spec:
  selector:
    app: myapp
    environment: blue  # Switch this to 'green' during deployment
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

#### Blue-Green Deployments
```yaml
# blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
  labels:
    app: myapp
    environment: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      environment: blue
  template:
    metadata:
      labels:
        app: myapp
        environment: blue
    spec:
      containers:
      - name: app
        image: myapp:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: ENVIRONMENT
          value: "blue"
        - name: VERSION
          value: "v1.0.0"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-green
  labels:
    app: myapp
    environment: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      environment: green
  template:
    metadata:
      labels:
        app: myapp
        environment: green
    spec:
      containers:
      - name: app
        image: myapp:v1.1.0  # New version
        ports:
        - containerPort: 3000
        env:
        - name: ENVIRONMENT
          value: "green"
        - name: VERSION
          value: "v1.1.0"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 3. **Deployment Automation Scripts**

#### Blue-Green Deployment Script
```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Configuration
BLUE_ENV="blue"
GREEN_ENV="green"
HEALTH_CHECK_URL="${APP_URL}/health"
READY_CHECK_URL="${APP_URL}/ready"
VERSION_URL="${APP_URL}/version"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Get current active environment
get_current_env() {
    if kubectl get service app-service-active &>/dev/null; then
        kubectl get service app-service-active -o jsonpath='{.spec.selector.environment}'
    else
        echo "blue"  # Default to blue if service doesn't exist
    fi
}

# Get inactive environment (opposite of current)
get_inactive_env() {
    local current_env=$1
    if [ "$current_env" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Deploy to inactive environment
deploy_to_inactive() {
    local version=$1
    local current_env=$(get_current_env)
    local inactive_env=$(get_inactive_env "$current_env")
    
    log "Current active environment: $current_env"
    log "Deploying version $version to $inactive_env environment"
    
    # Update deployment with new image
    kubectl set image deployment/app-$inactive_env app=myapp:$version
    
    # Wait for rollout to complete
    log "Waiting for deployment rollout to complete..."
    kubectl rollout status deployment/app-$inactive_env --timeout=600s
    
    # Verify pods are running
    log "Verifying pods are running..."
    kubectl wait --for=condition=ready pod -l app=myapp,environment=$inactive_env --timeout=300s
    
    log "Deployment to $inactive_env environment completed successfully"
}

# Health check function
health_check() {
    local env=$1
    local service_url="http://app-service-$env.$NAMESPACE.svc.cluster.local"
    
    log "Performing health check for $env environment..."
    
    # Use kubectl port-forward for internal testing
    kubectl port-forward service/app-service-$env 8080:80 &
    local port_forward_pid=$!
    
    sleep 5  # Wait for port-forward to establish
    
    local health_status=1
    local attempts=0
    local max_attempts=10
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f -s http://localhost:8080/health > /dev/null; then
            health_status=0
            break
        fi
        
        attempts=$((attempts + 1))
        log "Health check attempt $attempts/$max_attempts failed, retrying..."
        sleep 10
    done
    
    # Clean up port-forward
    kill $port_forward_pid 2>/dev/null || true
    
    if [ $health_status -eq 0 ]; then
        log "Health check passed for $env environment"
        return 0
    else
        error "Health check failed for $env environment after $max_attempts attempts"
    fi
}

# Smoke tests
run_smoke_tests() {
    local env=$1
    log "Running smoke tests for $env environment..."
    
    # Port-forward for testing
    kubectl port-forward service/app-service-$env 8080:80 &
    local port_forward_pid=$!
    sleep 5
    
    local test_results=()
    
    # Test 1: Health endpoint
    if curl -f -s http://localhost:8080/health | jq -e '.status == "healthy"' > /dev/null; then
        test_results+=("✅ Health endpoint")
    else
        test_results+=("❌ Health endpoint")
    fi
    
    # Test 2: Version endpoint
    if curl -f -s http://localhost:8080/version > /dev/null; then
        test_results+=("✅ Version endpoint")
    else
        test_results+=("❌ Version endpoint")
    fi
    
    # Test 3: Main application endpoint
    if curl -f -s http://localhost:8080/ > /dev/null; then
        test_results+=("✅ Main endpoint")
    else
        test_results+=("❌ Main endpoint")
    fi
    
    # Test 4: Database connectivity (if applicable)
    if curl -f -s http://localhost:8080/db-health 2>/dev/null | jq -e '.connected == true' > /dev/null; then
        test_results+=("✅ Database connectivity")
    else
        test_results+=("⚠️  Database connectivity (not tested)")
    fi
    
    # Clean up port-forward
    kill $port_forward_pid 2>/dev/null || true
    
    # Display results
    log "Smoke test results for $env:"
    printf '%s\n' "${test_results[@]}"
    
    # Check if all critical tests passed
    local failed_tests=$(printf '%s\n' "${test_results[@]}" | grep -c "❌" || true)
    if [ "$failed_tests" -gt 0 ]; then
        error "Smoke tests failed with $failed_tests failures"
    fi
    
    log "All smoke tests passed for $env environment"
}

# Switch traffic to new environment
switch_traffic() {
    local target_env=$1
    local current_env=$(get_current_env)
    
    if [ "$target_env" = "$current_env" ]; then
        warn "Target environment ($target_env) is already active"
        return 0
    fi
    
    log "Switching traffic from $current_env to $target_env"
    
    # Create backup of current service configuration
    kubectl get service app-service-active -o yaml > "/tmp/service-backup-$(date +%Y%m%d-%H%M%S).yaml"
    
    # Update service selector to point to new environment
    kubectl patch service app-service-active -p '{"spec":{"selector":{"environment":"'$target_env'"}}}'
    
    # Verify the switch
    sleep 10
    local new_active_env=$(get_current_env)
    if [ "$new_active_env" = "$target_env" ]; then
        log "Traffic successfully switched to $target_env environment"
    else
        error "Failed to switch traffic to $target_env environment"
    fi
    
    # Wait for load balancer to propagate changes
    log "Waiting for load balancer to propagate changes (30 seconds)..."
    sleep 30
    
    # Verify external traffic is flowing to new environment
    local attempts=0
    local max_attempts=5
    while [ $attempts -lt $max_attempts ]; do
        local version=$(curl -s $VERSION_URL | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
        if [ "$version" != "unknown" ]; then
            log "External traffic verification successful - Version: $version"
            break
        fi
        attempts=$((attempts + 1))
        sleep 10
    done
}

# Rollback to previous environment
rollback() {
    local current_env=$(get_current_env)
    local previous_env=$(get_inactive_env "$current_env")
    
    warn "Initiating rollback from $current_env to $previous_env"
    
    # Verify previous environment is healthy
    health_check "$previous_env"
    
    # Switch traffic back
    switch_traffic "$previous_env"
    
    log "Rollback completed successfully"
}

# Monitor deployment
monitor_deployment() {
    local duration=${1:-300}  # Default 5 minutes
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    log "Monitoring deployment for ${duration} seconds..."
    
    while [ $(date +%s) -lt $end_time ]; do
        local health_status=$(curl -s $HEALTH_CHECK_URL | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        local version=$(curl -s $VERSION_URL | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
        
        echo "$(date '+%H:%M:%S') - Health: $health_status, Version: $version"
        
        # Check for critical issues
        if [ "$health_status" = "unhealthy" ]; then
            error "Application became unhealthy during monitoring period"
        fi
        
        sleep 30
    done
    
    log "Monitoring completed successfully"
}

# Full blue-green deployment process
deploy() {
    local version=$1
    
    if [ -z "$version" ]; then
        error "Version parameter is required"
    fi
    
    log "Starting blue-green deployment for version $version"
    
    # Step 1: Deploy to inactive environment
    deploy_to_inactive "$version"
    
    # Step 2: Health check inactive environment
    local current_env=$(get_current_env)
    local inactive_env=$(get_inactive_env "$current_env")
    health_check "$inactive_env"
    
    # Step 3: Run smoke tests
    run_smoke_tests "$inactive_env"
    
    # Step 4: Switch traffic
    switch_traffic "$inactive_env"
    
    # Step 5: Monitor new deployment
    monitor_deployment 300
    
    log "Blue-green deployment completed successfully"
    log "New active environment: $inactive_env"
    log "Version deployed: $version"
}

# Main script logic
case "${1:-deploy}" in
    "setup")
        log "Setting up blue-green deployment infrastructure..."
        kubectl apply -f k8s/blue-green/
        log "Blue-green infrastructure setup completed"
        ;;
    "deploy")
        deploy "${2:-latest}"
        ;;
    "switch")
        local target_env="${2:-$(get_inactive_env $(get_current_env))}"
        switch_traffic "$target_env"
        ;;
    "rollback")
        rollback
        ;;
    "status")
        local current_env=$(get_current_env)
        local inactive_env=$(get_inactive_env "$current_env")
        
        echo "=== Blue-Green Deployment Status ==="
        echo "Current active environment: $current_env"
        echo "Inactive environment: $inactive_env"
        echo ""
        echo "=== Environment Details ==="
        kubectl get deployments -l app=myapp
        echo ""
        kubectl get services -l app=myapp
        echo ""
        echo "=== Health Status ==="
        curl -s $HEALTH_CHECK_URL 2>/dev/null | jq . || echo "Health check unavailable"
        ;;
    "monitor")
        monitor_deployment "${2:-300}"
        ;;
    *)
        echo "Usage: $0 {setup|deploy|switch|rollback|status|monitor}"
        echo ""
        echo "Commands:"
        echo "  setup                 - Initialize blue-green infrastructure"
        echo "  deploy <version>      - Deploy new version using blue-green strategy"
        echo "  switch [environment]  - Switch traffic between environments"
        echo "  rollback             - Rollback to previous environment"
        echo "  status               - Show current deployment status"
        echo "  monitor [duration]   - Monitor deployment for specified duration"
        exit 1
        ;;
esac
```

### 4. **Configuration Management**

#### Environment Configuration
```bash
# config.sh
#!/bin/bash

# Application configuration
APP_NAME="myapp"
APP_URL="https://api.example.com"
NAMESPACE="default"

# Container registry
REGISTRY="your-registry.com"
REPOSITORY="myapp"

# Health check configuration
HEALTH_CHECK_TIMEOUT=30
READY_CHECK_TIMEOUT=10
DEPLOYMENT_TIMEOUT=600

# Monitoring configuration
MONITORING_DURATION=300
SMOKE_TEST_TIMEOUT=60

# Notification configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_NOTIFICATIONS="${EMAIL_NOTIFICATIONS:-false}"

# Database configuration (if applicable)
DB_MIGRATION_STRATEGY="${DB_MIGRATION_STRATEGY:-forward-only}"
DB_BACKUP_BEFORE_DEPLOY="${DB_BACKUP_BEFORE_DEPLOY:-true}"
```

### 5. **Advanced Features**

#### Canary Integration
```yaml
# canary-service.yaml - For canary releases within blue-green
apiVersion: v1
kind: Service
metadata:
  name: app-service-canary
  labels:
    app: myapp
    environment: canary
spec:
  selector:
    app: myapp
    environment: green  # Route small percentage to green
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# Ingress with traffic splitting
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"  # 10% to canary
    nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
    nginx.ingress.kubernetes.io/canary-by-header-value: "true"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service-canary
            port:
              number: 80
```

#### Database Migration Strategy
```bash
#!/bin/bash
# db-migration-strategy.sh

handle_database_migrations() {
    local version=$1
    local target_env=$2
    
    log "Handling database migrations for version $version"
    
    case "$DB_MIGRATION_STRATEGY" in
        "forward-only")
            # Only run forward migrations, safe for blue-green
            run_forward_migrations "$version"
            ;;
        "blue-green-safe")
            # Use database views/aliases for backward compatibility
            setup_db_compatibility_layer "$version"
            run_forward_migrations "$version"
            ;;
        "separate-db")
            # Each environment has its own database
            migrate_environment_database "$target_env" "$version"
            ;;
        "shared-compatible")
            # Ensure migrations are backward compatible
            validate_migration_compatibility "$version"
            run_forward_migrations "$version"
            ;;
        *)
            warn "Unknown database migration strategy: $DB_MIGRATION_STRATEGY"
            ;;
    esac
}

run_forward_migrations() {
    local version=$1
    
    # Backup database before migrations
    if [ "$DB_BACKUP_BEFORE_DEPLOY" = "true" ]; then
        backup_database "pre-migration-$version-$(date +%Y%m%d-%H%M%S)"
    fi
    
    # Run migrations
    kubectl run migration-job-$version \
        --image=myapp:$version \
        --restart=Never \
        --command -- /bin/sh -c "npm run migrate"
    
    # Wait for migration to complete
    kubectl wait --for=condition=complete job/migration-job-$version --timeout=300s
    
    # Verify migration success
    local exit_code=$(kubectl get job migration-job-$version -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}')
    if [ "$exit_code" != "True" ]; then
        error "Database migration failed"
    fi
    
    log "Database migrations completed successfully"
}
```

#### Monitoring Integration
```yaml
# monitoring/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: blue-green-deployment-rules
spec:
  groups:
  - name: blue-green-deployment
    rules:
    - alert: BlueGreenEnvironmentDown
      expr: up{job="myapp", environment=~"blue|green"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Blue-green environment {{ $labels.environment }} is down"
        description: "Environment {{ $labels.environment }} has been down for more than 1 minute"
    
    - alert: BlueGreenHighErrorRate
      expr: rate(http_requests_total{job="myapp", status=~"5.."}[5m]) > 0.1
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected during blue-green deployment"
        description: "Error rate is {{ $value }} errors per second"
    
    - alert: BlueGreenDeploymentStuck
      expr: time() - kube_deployment_status_observed_generation{deployment=~"app-blue|app-green"} > 600
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Blue-green deployment appears stuck"
        description: "Deployment {{ $labels.deployment }} hasn't updated in over 10 minutes"
```

This blue-green deployment system provides zero-downtime deployments with comprehensive validation, monitoring, and rollback capabilities. The implementation supports multiple platforms (Kubernetes, Docker Swarm, traditional deployments) and includes advanced features like database migration handling and canary releases.