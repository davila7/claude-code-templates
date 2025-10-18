# Ready-to-Use DevOps Templates

## Terraform Templates

### AWS VPC with Multi-AZ
See [terraform.md](terraform.md) for the complete VPC module implementation.

### AWS EKS Cluster
```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${var.name_prefix}-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  cluster_endpoint_public_access = false
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    general = {
      min_size     = 2
      max_size     = 10
      desired_size = 3

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }

      tags = {
        NodeGroup = "general"
      }
    }

    spot = {
      min_size     = 0
      max_size     = 10
      desired_size = 2

      instance_types = ["t3.large", "t3a.large"]
      capacity_type  = "SPOT"

      labels = {
        role = "spot"
      }

      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NoSchedule"
      }]

      tags = {
        NodeGroup = "spot"
      }
    }
  }

  tags = var.tags
}
```

### AWS RDS PostgreSQL
```hcl
resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-subnet-group"
    }
  )
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.name_prefix}-postgres-params"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_duration"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  tags = var.tags
}

resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-db"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = var.database_name
  username = var.master_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az               = var.multi_az
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment != "prod" ? true : false
  final_snapshot_identifier = var.environment == "prod" ? "${var.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db"
    }
  )
}
```

## Kubernetes Templates

### Complete Application Stack
```yaml
---
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: myapp
  labels:
    name: myapp
    environment: production

---
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: myapp
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "8080"

---
# Secret (use Sealed Secrets or External Secrets in production)
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: myapp
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/myapp"
  API_KEY: "your-api-key-here"

---
# ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: myapp
automountServiceAccountToken: true

---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  revisionHistoryLimit: 10

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  selector:
    matchLabels:
      app: myapp

  template:
    metadata:
      labels:
        app: myapp
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"

    spec:
      serviceAccountName: myapp

      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000

      containers:
      - name: myapp
        image: myapp:1.0.0
        imagePullPolicy: IfNotPresent

        ports:
        - name: http
          containerPort: 8080

        envFrom:
        - configMapRef:
            name: myapp-config
        - secretRef:
            name: myapp-secrets

        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10

        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5

        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop:
            - ALL

        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache

      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: myapp
  labels:
    app: myapp
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: myapp
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80

---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
  namespace: myapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

---
# PodDisruptionBudget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp
  namespace: myapp
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
```

## CI/CD Pipeline Templates

### GitHub Actions - Docker Build and Push
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### GitHub Actions - Terraform Workflow
```yaml
name: Terraform

on:
  push:
    branches: [main]
    paths:
      - 'terraform/**'
  pull_request:
    branches: [main]
    paths:
      - 'terraform/**'

env:
  TF_VERSION: 1.6.0
  AWS_REGION: us-east-1

jobs:
  terraform:
    name: Terraform Plan & Apply
    runs-on: ubuntu-latest

    permissions:
      id-token: write
      contents: read
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: ./terraform

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform/environments/prod

      - name: Terraform Validate
        run: terraform validate
        working-directory: ./terraform/environments/prod

      - name: Terraform Plan
        id: plan
        run: |
          terraform plan -no-color -out=tfplan
        working-directory: ./terraform/environments/prod
        continue-on-error: true

      - name: Post Plan to PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const output = `#### Terraform Plan 📖

            <details><summary>Show Plan</summary>

            \`\`\`terraform
            ${{ steps.plan.outputs.stdout }}
            \`\`\`

            </details>`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan
        working-directory: ./terraform/environments/prod
```

### GitLab CI - Complete Pipeline
```yaml
stages:
  - lint
  - build
  - test
  - deploy

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  KUBE_NAMESPACE: production

# Lint stage
lint:terraform:
  stage: lint
  image: hashicorp/terraform:1.6
  script:
    - cd terraform
    - terraform fmt -check -recursive
    - terraform init -backend=false
    - terraform validate
  only:
    changes:
      - terraform/**/*

lint:kubernetes:
  stage: lint
  image: cytopia/kubeval:latest
  script:
    - kubeval --strict kubernetes/*.yaml
  only:
    changes:
      - kubernetes/**/*

# Build stage
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE
  only:
    - main
    - develop

# Test stage
test:unit:
  stage: test
  image: $DOCKER_IMAGE
  script:
    - npm test
  coverage: '/Statements\s*:\s*(\d+\.\d+)%/'
  only:
    - main
    - develop

test:security:
  stage: test
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL $DOCKER_IMAGE
  only:
    - main
    - develop

# Deploy stage
deploy:production:
  stage: deploy
  image: bitnami/kubectl:latest
  before_script:
    - kubectl config use-context production
  script:
    - kubectl set image deployment/myapp myapp=$DOCKER_IMAGE -n $KUBE_NAMESPACE
    - kubectl rollout status deployment/myapp -n $KUBE_NAMESPACE
  environment:
    name: production
    url: https://myapp.example.com
  only:
    - main
  when: manual
```

## ArgoCD Application Template

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default

  source:
    repoURL: https://github.com/myorg/myapp.git
    targetRevision: HEAD
    path: kubernetes/overlays/production

    # For Helm charts
    # helm:
    #   valueFiles:
    #     - values-production.yaml

  destination:
    server: https://kubernetes.default.svc
    namespace: production

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false

    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true

    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas
```

## Monitoring & Alerting Templates

### Prometheus ServiceMonitor
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
```

### Prometheus Alert Rules
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
  namespace: production
spec:
  groups:
  - name: myapp
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value | humanizePercentage }}"

    - alert: PodCrashLooping
      expr: |
        rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} is crash looping"
        description: "Pod has restarted {{ $value }} times in 15 minutes"

    - alert: HighMemoryUsage
      expr: |
        container_memory_usage_bytes{pod=~"myapp-.*"} /
        container_spec_memory_limit_bytes{pod=~"myapp-.*"} > 0.9
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage"
        description: "Memory usage is {{ $value | humanizePercentage }}"
```

## Docker Templates

### Multi-stage Dockerfile (Node.js)
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs

WORKDIR /app

# Copy dependencies and built app from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

### .dockerignore
```
# Git
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
Jenkinsfile

# Documentation
README.md
docs/
*.md

# Dependencies
node_modules
npm-debug.log

# Testing
coverage/
.nyc_output
test/
*.test.js

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.*
!.env.example

# Build artifacts
dist/
build/
*.log
```

## Makefile Template

```makefile
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: tf-init
tf-init: ## Initialize Terraform
	cd terraform/environments/$(ENV) && terraform init

.PHONY: tf-plan
tf-plan: ## Plan Terraform changes
	cd terraform/environments/$(ENV) && terraform plan -out=tfplan

.PHONY: tf-apply
tf-apply: ## Apply Terraform changes
	cd terraform/environments/$(ENV) && terraform apply tfplan

.PHONY: k8s-apply
k8s-apply: ## Apply Kubernetes manifests
	kubectl apply -f kubernetes/ -n $(NAMESPACE)

.PHONY: k8s-delete
k8s-delete: ## Delete Kubernetes resources
	kubectl delete -f kubernetes/ -n $(NAMESPACE)

.PHONY: docker-build
docker-build: ## Build Docker image
	docker build -t $(IMAGE_NAME):$(TAG) .

.PHONY: docker-push
docker-push: ## Push Docker image
	docker push $(IMAGE_NAME):$(TAG)

.PHONY: lint
lint: ## Run linters
	terraform fmt -check -recursive
	kubeval --strict kubernetes/*.yaml

.PHONY: test
test: ## Run tests
	go test ./... -v -cover

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf dist/ build/ *.log
```

---

## Template Usage Tips

1. **Always customize** - Don't use templates as-is, adapt to your needs
2. **Security first** - Never commit secrets, use proper secret management
3. **Test in dev** - Validate templates in development before production
4. **Version control** - Track all infrastructure code in Git
5. **Documentation** - Add README files explaining template usage
6. **Automation** - Use CI/CD to validate and deploy templates
