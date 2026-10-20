# GKE App Onboarding

This reference provides workflows for containerizing and deploying applications to GKE for the first time.

> **MCP Tools:** `apply_k8s_manifest`, `get_k8s_resource`, `get_k8s_rollout_status`, `get_k8s_logs`, `describe_k8s_resource`

## Workflow

### 1. App Assessment

Before containerizing, assess the application:

- **Language & Framework**: Identify the tech stack
- **Dependencies**: List required libraries and external services
- **Configuration**: How is the app configured? (env vars, config files, secrets)
- **Statefulness**: Does it need persistent storage? (databases, file storage)
- **Networking**: Port mapping and protocol (HTTP, gRPC, TCP)
- **Health endpoints**: Does the app expose health check endpoints?

### 2. Containerization

Create a container image:

**Dockerfile (recommended for most apps):**

```dockerfile
# Multi-stage build for smaller, more secure images
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /app/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
```

**Best practices:**
- Use multi-stage builds to keep production images small
- Use distroless or minimal base images to reduce attack surface
- Run as non-root user
- Log to `stdout` and `stderr` for Cloud Logging collection

**Alternatives:**
- **Cloud Native Buildpacks** — auto-detect language and build without a Dockerfile: `pack build <image> --builder gcr.io/buildpacks/builder:latest`
- **Skaffold** — development workflow tool for iterating on containerized apps: `skaffold dev`

### 3. Image Management

Build and store the container image:

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker <REGION>-docker.pkg.dev --quiet

# Build and push
docker build -t <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/<IMAGE>:<TAG> .
docker push <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/<IMAGE>:<TAG>
```

**Vulnerability scanning**: Enable automatic scanning in Artifact Registry to detect issues in base images and dependencies.

```bash
# Check scan results
gcloud artifacts docker images describe \
  <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/<IMAGE>:<TAG> \
  --show-package-vulnerability \
  --quiet
```

### 4. Manifest Generation

Generate Kubernetes manifests for the application:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/<IMAGE>:<TAG>
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

**Checklist for manifests:**
- Resource requests and limits set
- Liveness and readiness probes configured
- At least 2 replicas for production
- Service type appropriate (ClusterIP for internal, use Gateway API for external)

### 5. Deploy

```
# MCP (preferred)
apply_k8s_manifest(parent="projects/<PROJECT>/locations/<REGION>/clusters/<CLUSTER>", yamlManifest="<manifest>")

# Verify
get_k8s_rollout_status(parent="...", resourceType="deployment", name="my-app")
get_k8s_resource(parent="...", resourceType="pod", labelSelector="app=my-app")
```

**kubectl fallback:**

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/my-app
kubectl get pods -l app=my-app
```

## Next Steps

Once the application is running on GKE:
- Configure autoscaling — see [gke-scaling.md](./gke-scaling.md)
- Set up observability — see [gke-observability.md](./gke-observability.md)
- Harden security — see [gke-security.md](./gke-security.md)
- Configure reliability (PDBs, topology spread) — see [gke-reliability.md](./gke-reliability.md)
