# GKE Security

This reference covers security configuration for GKE clusters. The golden path enforces a hardened security posture by default.

> **MCP Tools:** `get_cluster`, `check_k8s_auth`, `get_k8s_resource`, `apply_k8s_manifest`, `update_cluster`

## Golden Path Security Defaults

| Setting | Golden Path Value | Day-0/1 | Notes |
|---------|-------------------|---------|-------|
| `workloadIdentityConfig.workloadPool` | `<PROJECT>.svc.id.goog` | Day-0 | Workload Identity Federation for Pods |
| `secretManagerConfig.enabled` | `true` | Day-1 | Google Secret Manager integration |
| `secretManagerConfig.rotationConfig` | `enabled: true, rotationInterval: 120s` | Day-1 | Automatic secret rotation |
| `rbacBindingConfig.enableInsecureBindingSystemAuthenticated` | `false` | Day-0 | Blocks legacy `system:authenticated` bindings |
| `rbacBindingConfig.enableInsecureBindingSystemUnauthenticated` | `false` | Day-0 | Blocks legacy `system:unauthenticated` bindings |
| `nodeConfig.shieldedInstanceConfig.enableSecureBoot` | `true` | Day-0 | Verifiable boot integrity |
| `nodeConfig.shieldedInstanceConfig.enableIntegrityMonitoring` | `true` | Day-0 | Runtime integrity checks |
| `nodeConfig.workloadMetadataConfig.mode` | `GKE_METADATA` | Day-0 | Blocks legacy metadata API, enforces Workload Identity |
| Private cluster + Dataplane V2 settings | See [gke-networking.md](./gke-networking.md) | Day-0 | Private nodes, private endpoint enforcement, ADVANCED_DATAPATH |

## Workload Identity Federation

Workload Identity is the recommended way for pods to access Google Cloud APIs. It eliminates the need for static service account keys.

### Setup

```bash
# 1. Create a Google Service Account (GSA)
gcloud iam service-accounts create <GSA_NAME> \
  --project <PROJECT_ID> \
  --display-name "Workload Identity SA" \
  --quiet

# 2. Grant IAM roles to the GSA
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:<GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "<ROLE>" \
  --quiet

# 3. Create Kubernetes Service Account (KSA)
kubectl create namespace <NAMESPACE>
kubectl create serviceaccount <KSA_NAME> --namespace <NAMESPACE>

# 4. Bind KSA to GSA
gcloud iam service-accounts add-iam-policy-binding \
  <GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:<PROJECT_ID>.svc.id.goog[<NAMESPACE>/<KSA_NAME>]" \
  --quiet

# 5. Annotate KSA
kubectl annotate serviceaccount <KSA_NAME> \
  --namespace <NAMESPACE> \
  iam.gke.io/gcp-service-account=<GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com
```

> See [assets/workload-identity-pod.yaml](../assets/workload-identity-pod.yaml) for a test pod.

### Verification

```bash
kubectl run workload-identity-test \
  --image=gcr.io/google.com/cloudsdktool/cloud-sdk:slim \
  --serviceaccount=<KSA_NAME> --namespace=<NAMESPACE> \
  --rm -it -- gcloud auth list --quiet
```

## Secret Manager Integration

The golden path enables Secret Manager with automatic rotation. Secrets are synced to Kubernetes Secrets.

```bash
# Verify Secret Manager is enabled on cluster
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="value(secretManagerConfig.enabled)" \
  --quiet

# Enable if not already (Day-1 change)
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-secret-manager \
  --secret-manager-rotation-interval=120s \
  --quiet
```

## RBAC Hardening

The golden path disables insecure legacy RBAC bindings that grant broad access to `system:authenticated` and `system:unauthenticated` groups.

```bash
# Verify insecure bindings are disabled
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="yaml(rbacBindingConfig)" \
  --quiet
```

**Best practices for RBAC:**
- Use namespace-scoped Roles over cluster-wide ClusterRoles
- Bind to specific Groups or ServiceAccounts, never to `system:authenticated`
- Audit permissions via MCP: `check_k8s_auth(parent="...", verb="list", resourceType="pods", namespace="...")` (or `kubectl auth can-i --list --as=<user>`)
- Review bindings via MCP: `get_k8s_resource(parent="...", resourceType="clusterrolebinding")` (or `kubectl get clusterrolebindings,rolebindings --all-namespaces`)

> See [gke-multitenancy.md](./gke-multitenancy.md) for enterprise RBAC planning and https://docs.cloud.google.com/kubernetes-engine/docs/best-practices/rbac

## Binary Authorization

Not enabled in golden path by default but recommended for production image provenance:

```bash
# Enable Binary Authorization
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --binauthz-evaluation-mode=PROJECT_SINGLETON_POLICY_ENFORCE \
  --quiet
```

## Network Policies

Dataplane V2 (golden path) provides built-in Network Policy enforcement. Apply default-deny per namespace:

```
# MCP (preferred)
apply_k8s_manifest(parent="...", yamlManifest="<contents of default-deny-netpol.yaml>")

# kubectl fallback
kubectl apply -f skills/gke/assets/default-deny-netpol.yaml -n <NAMESPACE>
```

## GKE Sandbox (gVisor)

For running untrusted workloads in an isolated sandbox:

```bash
# Enable on cluster (Standard clusters)
gcloud container clusters update <CLUSTER_NAME> --region <REGION> --enable-gke-sandbox --quiet

# Use in pod spec
# Add: runtimeClassName: gvisor
```

## Pod Security Standards (Golden Path)

Pod Security Standards define three profiles that restrict what pods can do. The **`restricted` profile is the golden path default** for production namespaces.

| Profile | Level | Use Case |
|---------|-------|----------|
| `privileged` | Unrestricted | System namespaces (`kube-system`), infrastructure controllers |
| `baseline` | Minimally restrictive | Shared/dev namespaces, legacy apps being migrated |
| `restricted` | **Golden path** | Production workloads -- blocks privilege escalation, host access, root |

**Enforce via namespace labels (Pod Security Admission):**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

**Gradual rollout strategy:**
1. Start with `warn` + `audit` on existing namespaces to identify violations
2. Fix non-compliant workloads (remove `privileged`, `hostNetwork`, root user, etc.)
3. Enable `enforce` once all workloads pass

`restricted` blocks: running as root, privilege escalation, host networking/PID/IPC, host path volumes, and most capabilities. The golden path `workload-identity-pod.yaml` already complies.

## Network Policy Logging (Recommended)

With Dataplane V2 (golden path), you can enable logging for Network Policy decisions. **Not a golden path default** -- recommended for security auditing.

```bash
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-network-policy-logging \
  --quiet
```

This logs allowed and denied connections, useful for troubleshooting Network Policy rules and auditing traffic flows.

## Common IAM Roles

The five most common predefined IAM roles for GKE:

| Role | Purpose | When to Use |
|------|---------|-------------|
| `roles/container.admin` | Full control over clusters and Kubernetes resources | Platform team admins managing cluster lifecycle |
| `roles/container.clusterAdmin` | Manage clusters but not project-level IAM | Cluster operators who create/delete clusters |
| `roles/container.developer` | Deploy workloads (pods, services, deployments) | Application developers deploying to existing clusters |
| `roles/container.viewer` | Read-only access to clusters and Kubernetes resources | Monitoring, auditing, or read-only dashboards |
| `roles/container.clusterViewer` | List and get cluster details only | CI/CD pipelines that need cluster metadata |

> **Principle of least privilege**: Start with `roles/container.viewer` or `roles/container.developer` and escalate only as needed. Avoid granting `roles/container.admin` broadly.

## Service Accounts & Agents

- **GKE Service Agent** (`service-<PROJECT_NUMBER>@container-engine-robot.iam.gserviceaccount.com`): Automatically created. Manages nodes, networking, and cluster operations on your behalf. Do not remove or modify its permissions.
- **Node Service Account**: By default, nodes use the Compute Engine default service account. For production, create a dedicated SA with minimal permissions and assign it via node pool config.
- **Workload Identity**: The recommended way for pods to access Google Cloud APIs. Maps a Kubernetes ServiceAccount to a Google IAM ServiceAccount — see [Workload Identity setup](#workload-identity-federation) above.

## Cross-Service Authentication Patterns

Common patterns for granting GKE workloads access to other Google Cloud services:

```bash
# Grant a GKE workload access to Cloud Storage
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:<GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/storage.objectViewer" \
  --quiet

# Grant a GKE workload access to Cloud SQL
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:<GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/cloudsql.client" \
  --quiet

# Grant a GKE workload access to Pub/Sub
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:<GSA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/pubsub.subscriber" \
  --quiet
```

In all cases, the GSA must be bound to a KSA via Workload Identity (see setup above). The pod then uses the KSA to authenticate as the GSA.

