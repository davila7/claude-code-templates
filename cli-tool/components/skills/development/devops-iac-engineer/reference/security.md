# DevSecOps & Security Best Practices

## Security Principles

### Defense in Depth
- **Multiple layers of security controls**
- Network security, application security, data security
- No single point of failure

### Least Privilege
- **Minimum permissions necessary**
- Regular access reviews
- Time-bound elevated access

### Zero Trust
- **Never trust, always verify**
- Verify every request regardless of origin
- Micro-segmentation and strict access controls

## Secrets Management

### ❌ Never Do This
```yaml
# NEVER hardcode secrets!
apiVersion: v1
kind: Pod
metadata:
  name: bad-example
spec:
  containers:
  - name: app
    env:
    - name: DATABASE_PASSWORD
      value: "SuperSecret123!"  # 🚨 NEVER DO THIS
    - name: API_KEY
      value: "sk-abc123def456"  # 🚨 NEVER DO THIS
```

### ✅ Use External Secrets Operator
```yaml
# External Secrets with AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: production
spec:
  refreshInterval: 1h

  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: app-secrets
    creationPolicy: Owner

  data:
  - secretKey: database-password
    remoteRef:
      key: prod/myapp/database-password

  - secretKey: api-key
    remoteRef:
      key: prod/myapp/api-key
```

### ✅ Use Sealed Secrets
```bash
# Install kubeseal
brew install kubeseal

# Create sealed secret
kubectl create secret generic myapp-secrets \
  --from-literal=db-password='secret123' \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Apply sealed secret (safe to commit to Git)
kubectl apply -f sealed-secret.yaml
```

### AWS Secrets Manager with IRSA
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/myapp-secrets-role

---
# Application retrieves secrets using AWS SDK
# No credentials in code or config!
```

## Container Security

### Secure Dockerfile
```dockerfile
# Use specific version tags, not 'latest'
FROM node:20.10.0-alpine3.19 AS builder

# Run as non-root user
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs

WORKDIR /app

# Copy and install dependencies
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Production stage
FROM node:20.10.0-alpine3.19

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user
USER nodejs

# Use dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Run application
CMD ["node", "dist/index.js"]

# Expose port
EXPOSE 8080

# Add labels
LABEL org.opencontainers.image.source="https://github.com/myorg/myapp" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="MyOrg"
```

### Security Scanning

#### Trivy (Container Vulnerability Scanner)
```bash
# Scan Docker image
trivy image myapp:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL myapp:latest

# Scan filesystem
trivy fs --security-checks vuln,config /path/to/project

# Output to JSON
trivy image -f json -o results.json myapp:latest
```

#### Grype (Vulnerability Scanner)
```bash
# Scan image
grype myapp:latest

# Scan with specific severity
grype myapp:latest --fail-on high

# Output SARIF for GitHub
grype myapp:latest -o sarif > results.sarif
```

### Pod Security Standards

```yaml
# Pod Security Admission
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
# Secure Pod Configuration
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
  namespace: production
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: app
    image: myapp:1.0.0

    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop:
        - ALL
        add:
        - NET_BIND_SERVICE  # Only if needed

    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
      requests:
        memory: "256Mi"
        cpu: "250m"

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
```

## Network Security

### Network Policies
```yaml
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress

---
# Allow specific ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-allow-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp

  policyTypes:
  - Ingress
  - Egress

  ingress:
  # Allow from ingress controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080

  egress:
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    - podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

  # Allow database
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  # Allow HTTPS egress
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
```

### AWS Security Groups (Terraform)
```hcl
# Application Security Group
resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app-sg"
  description = "Security group for application"
  vpc_id      = var.vpc_id

  # Allow inbound from ALB only
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "HTTP from ALB"
  }

  # Allow outbound to database
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
    description     = "PostgreSQL to database"
  }

  # Allow HTTPS egress
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to internet"
  }

  tags = var.tags
}
```

## IAM & RBAC

### Kubernetes RBAC
```yaml
# Least privilege service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production

---
# Role with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-role
  namespace: production
rules:
# Only read ConfigMaps and Secrets
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
  resourceNames: ["myapp-config", "myapp-secrets"]

# Read own pod information
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get"]

---
# Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-rolebinding
  namespace: production
subjects:
- kind: ServiceAccount
  name: myapp
  namespace: production
roleRef:
  kind: Role
  name: myapp-role
  apiGroup: rbac.authorization.k8s.io
```

### AWS IAM Policy (Terraform)
```hcl
# Least privilege IAM policy
data "aws_iam_policy_document" "app" {
  # Allow reading specific secrets
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [
      "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:prod/myapp/*"
    ]
  }

  # Allow writing to specific S3 bucket
  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
    ]
    resources = [
      "${aws_s3_bucket.app.arn}/*"
    ]
  }

  # Allow publishing to specific SNS topic
  statement {
    actions = [
      "sns:Publish",
    ]
    resources = [
      aws_sns_topic.app_notifications.arn
    ]
  }
}

resource "aws_iam_policy" "app" {
  name   = "${var.name_prefix}-app-policy"
  policy = data.aws_iam_policy_document.app.json
}
```

## Compliance & Policy as Code

### OPA (Open Policy Agent)
```rego
# Deny pods running as root
package kubernetes.admission

deny[msg] {
  input.request.kind.kind == "Pod"
  input.request.object.spec.securityContext.runAsNonRoot != true
  msg := "Pods must not run as root"
}

# Require resource limits
deny[msg] {
  input.request.kind.kind == "Pod"
  container := input.request.object.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container %v must specify resource limits", [container.name])
}

# Deny latest tag
deny[msg] {
  input.request.kind.kind == "Pod"
  container := input.request.object.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("Container %v uses 'latest' tag", [container.name])
}

# Require specific labels
deny[msg] {
  input.request.kind.kind == "Pod"
  required_labels := ["app", "version", "environment"]
  label := required_labels[_]
  not input.request.object.metadata.labels[label]
  msg := sprintf("Missing required label: %v", [label])
}
```

### Terraform Sentinel Policy
```hcl
# sentinel.hcl
policy "require-tags" {
  enforcement_level = "hard-mandatory"
}

policy "restrict-instance-type" {
  enforcement_level = "soft-mandatory"
}

# require-tags.sentinel
import "tfplan/v2" as tfplan

required_tags = ["Environment", "Owner", "CostCenter"]

main = rule {
  all tfplan.resource_changes as _, rc {
    rc.mode is "managed" and
    rc.type in ["aws_instance", "aws_db_instance", "aws_s3_bucket"] and
    rc.change.actions contains "create"
    implies
    all required_tags as tag {
      rc.change.after.tags contains tag
    }
  }
}
```

## Security Scanning in CI/CD

### GitHub Actions Security Workflow
```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  terraform-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
          soft_fail: false

  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: auto
```

## Encryption

### At Rest
```hcl
# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# RDS encryption
resource "aws_db_instance" "app" {
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  # ... other configuration
}

# EBS encryption
resource "aws_ebs_volume" "app" {
  encrypted  = true
  kms_key_id = aws_kms_key.ebs.arn
  # ... other configuration
}
```

### In Transit
```yaml
# Enforce TLS in Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls
```

## Security Best Practices Checklist

- [ ] **Never hardcode secrets** - Use secret managers
- [ ] **Run containers as non-root** - Set securityContext
- [ ] **Use specific image tags** - Never use 'latest'
- [ ] **Scan images for vulnerabilities** - Use Trivy/Grype
- [ ] **Enable Pod Security Standards** - Use restricted profile
- [ ] **Implement network policies** - Default deny, allow specific
- [ ] **Use RBAC** - Least privilege access
- [ ] **Encrypt data at rest** - KMS for all data stores
- [ ] **Enforce TLS** - All traffic encrypted in transit
- [ ] **Scan IaC for issues** - Checkov, tfsec in CI/CD
- [ ] **Rotate credentials regularly** - Automate rotation
- [ ] **Audit and log everything** - CloudTrail, audit logs
- [ ] **Implement policy as code** - OPA, Sentinel
- [ ] **Regular security reviews** - Penetration testing, audits
- [ ] **Keep dependencies updated** - Renovate, Dependabot

---

## Security Incident Response

1. **Detect**: Automated alerting on security events
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat and vulnerabilities
4. **Recover**: Restore services securely
5. **Learn**: Post-incident review and improvements
