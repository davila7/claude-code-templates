# GKE MCP Server Usage

The GKE MCP server provides 23 structured tools for cluster management, Kubernetes resource operations, and diagnostics — without requiring shell access or kubeconfig setup.

## Connecting to the GKE MCP Server

The GKE remote MCP server is available for AI clients that support the Model Context Protocol. For setup instructions, see https://docs.cloud.google.com/kubernetes-engine/docs/how-to/use-gke-mcp.

## Available Tools

All tools use hierarchical resource paths:

```
Project+Region:  projects/{PROJECT}/locations/{REGION}
Cluster:         projects/{PROJECT}/locations/{REGION}/clusters/{CLUSTER}
Node Pool:       projects/{PROJECT}/locations/{REGION}/clusters/{CLUSTER}/nodePools/{POOL}
Operation:       projects/{PROJECT}/locations/{REGION}/operations/{OP_ID}
```

Use `locations/-` to match all regions when listing.

### Cluster Management

| Tool | Mode | Purpose |
|------|------|---------|
| `list_clusters` | READ | Discover clusters in a project/region |
| `get_cluster` | READ | Inspect cluster config. Use `readMask` to select fields |
| `create_cluster` | MUTATE | Create a cluster from JSON config |
| `update_cluster` | DESTRUCTIVE | Change Day-1 cluster settings |

### Node Pool Management

| Tool | Mode | Purpose |
|------|------|---------|
| `list_node_pools` | READ | List pools in a cluster |
| `get_node_pool` | READ | Get pool details |
| `create_node_pool` | MUTATE | Add a pool (Standard clusters) |
| `update_node_pool` | DESTRUCTIVE | Modify a pool |

### Kubernetes Resources

| Tool | Mode | Purpose |
|------|------|---------|
| `get_k8s_resource` | READ | List/get any K8s resource (supports label/field selectors) |
| `describe_k8s_resource` | READ | Detailed info with events and conditions |
| `apply_k8s_manifest` | DESTRUCTIVE | Apply YAML manifests (supports `dryRun`) |
| `patch_k8s_resource` | DESTRUCTIVE | JSON patch resource fields |
| `delete_k8s_resource` | DESTRUCTIVE | Remove resources (supports `cascade`, `dryRun`) |
| `list_k8s_api_resources` | READ | Discover available resource types |

### Diagnostics & Observability

| Tool | Mode | Purpose |
|------|------|---------|
| `list_k8s_events` | READ | Scheduling failures, OOM kills, evictions |
| `get_k8s_logs` | READ | Container logs (supports `tail`, `since`, `previous`) |
| `get_k8s_cluster_info` | READ | Control plane and service endpoints |
| `get_k8s_version` | READ | Kubernetes server version |
| `get_k8s_rollout_status` | READ | Deployment/StatefulSet rollout progress |
| `check_k8s_auth` | READ | Verify RBAC permissions for a user/SA |

### Operations

| Tool | Mode | Purpose |
|------|------|---------|
| `list_operations` | READ | Pending/running cluster operations |
| `get_operation` | READ | Track create/upgrade progress |
| `cancel_operation` | DESTRUCTIVE | Abort stuck operations |

## Tool Preference

Default: **MCP tools > gcloud CLI > kubectl**. See [cli-reference.md](./cli-reference.md) for the full coverage comparison, CLI fallback commands, and user preference override options.
