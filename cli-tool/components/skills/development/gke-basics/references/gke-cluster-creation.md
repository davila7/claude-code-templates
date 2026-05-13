# GKE Cluster Creation

This reference guides creating GKE clusters. The **golden path Autopilot** configuration is the default for all new clusters.

> **MCP Tools:** `list_clusters`, `create_cluster`, `get_cluster`, `list_operations`, `get_operation`

## Workflow

1. **Discover context**: Use `list_clusters` to see existing clusters. Use `gcloud config get-value project` if project unknown.
2. **Gather inputs**: project_id, region, cluster_name, environment type
3. **Select mode**: Autopilot (default) vs Standard
4. **Configure networking**: auto-create subnet (default) or bring-your-own
5. **Review golden path settings**: present the config and confirm with user
6. **Create**: Use MCP `create_cluster` tool. Fall back to `gcloud` CLI only if MCP is unavailable.
7. **Track**: Use `get_operation` to monitor creation progress
8. **Verify**: Use `get_cluster` with `readMask="*"` to confirm golden path settings applied

## Mode Selection

| Criteria | Autopilot (Golden Path) | Standard |
|----------|------------------------|----------|
| Node management | Google-managed | Self-managed |
| Pricing | Pay per pod resource request | Pay per node (VM) |
| Node customization | Via ComputeClasses | Full control |
| DaemonSets | Allowed (with restrictions) | Full control |
| GPU/TPU | Supported via ComputeClasses | Supported via node pools |
| Best for | Most production workloads | Kernel tuning, custom OS, privileged workloads |

> **Rule**: Default to Autopilot unless the customer has a specific requirement that Autopilot cannot satisfy.

## Templates

### 1. Golden Path Autopilot (Production)

This is the default. All settings match `assets/golden-path-autopilot.yaml`.

**Via gcloud:**

```bash
gcloud container clusters create-auto <CLUSTER_NAME> \
  --region <REGION> \
  --project <PROJECT_ID> \
  --release-channel regular \
  --enable-private-nodes \
  --enable-master-authorized-networks \
  --enable-dns-access \
  --enable-secret-manager \
  --secret-manager-rotation-interval=120s \
  --scoped-rbs-bindings \
  --monitoring=SYSTEM,API_SERVER,SCHEDULER,CONTROLLER_MANAGER,STORAGE,POD,DEPLOYMENT,STATEFULSET,DAEMONSET,HPA,CADVISOR,KUBELET,DCGM \
  --quiet
```

**Via MCP (`create_cluster`):**

```json
{
  "parent": "projects/<PROJECT_ID>/locations/<REGION>",
  "cluster": {
    "name": "<CLUSTER_NAME>",
    "autopilot": { "enabled": true },
    "privateClusterConfig": { "enablePrivateNodes": true },
    "masterAuthorizedNetworksConfig": {
      "privateEndpointEnforcementEnabled": true
    },
    "releaseChannel": { "channel": "REGULAR" },
    "secretManagerConfig": {
      "enabled": true,
      "rotationConfig": { "enabled": true, "rotationInterval": "120s" }
    },
    "rbacBindingConfig": {
      "enableInsecureBindingSystemAuthenticated": false,
      "enableInsecureBindingSystemUnauthenticated": false
    }
  }
}
```

### 2. Autopilot Dev/Test

Relaxes some golden path defaults for cost savings and easier access in non-production.

```bash
gcloud container clusters create-auto <CLUSTER_NAME> \
  --region <REGION> \
  --project <PROJECT_ID> \
  --release-channel rapid \
  --quiet
```

> **Warning**: This does not apply golden path security hardening. Suitable for dev/test only.

### 3. Standard Regional (When Autopilot is Not an Option)

```bash
gcloud container clusters create <CLUSTER_NAME> \
  --region <REGION> \
  --project <PROJECT_ID> \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --disk-type pd-balanced \
  --enable-autoscaling --min-nodes 1 --max-nodes 10 \
  --enable-shielded-nodes --enable-secure-boot \
  --workload-pool=<PROJECT_ID>.svc.id.goog \
  --enable-private-nodes \
  --enable-master-authorized-networks \
  --enable-vertical-pod-autoscaling \
  --enable-dataplane-v2 \
  --release-channel regular \
  --quiet
```

### 4. GPU/AI Workloads (Autopilot with ComputeClass)

Create a golden path Autopilot cluster, then apply a ComputeClass for GPU workloads:

```bash
# 1. Create golden path cluster (same as template 1)
gcloud container clusters create-auto <CLUSTER_NAME> \
  --region <REGION> --project <PROJECT_ID> \
  --enable-private-nodes --enable-master-authorized-networks \
  --enable-dns-access --enable-secret-manager --scoped-rbs-bindings \
  --quiet

# 2. Apply GPU ComputeClass (see gke-compute-classes.md)
kubectl apply -f gpu-compute-class.yaml

# 3. Or use GIQ for inference (see gke-inference.md)
gcloud container ai profiles manifests create \
  --model=gemma-2-9b-it --model-server=vllm --accelerator-type=nvidia-l4 --quiet > inference.yaml
kubectl apply -f inference.yaml
```

## Instructions

- **ALWAYS** ask for `project_id` if not in context
- **ALWAYS** ask for `region`
- **ALWAYS** ask for a unique `cluster_name`
- **DEFAULT** to golden path Autopilot unless customer specifies otherwise
- **WARN** about Day-0 decisions (networking, private nodes) that are hard to change later
- **WARN** about cost for GPU or multi-region clusters
- When using MCP `create_cluster`, the `cluster.name` should be the **short name** (e.g., `my-cluster`), not the full resource path
