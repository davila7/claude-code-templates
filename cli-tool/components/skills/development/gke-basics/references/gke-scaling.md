# GKE Workload Scaling

This reference covers scaling workloads on GKE. The golden path enables VPA, OPTIMIZE_UTILIZATION autoscaling profile, and Node Auto Provisioning by default.

> **MCP Tools:** `get_k8s_resource`, `describe_k8s_resource`, `apply_k8s_manifest`, `patch_k8s_resource`, `get_cluster`, `update_cluster`, `update_node_pool`

## Golden Path Scaling Defaults

| Setting | Golden Path Value | Notes |
|---------|-------------------|-------|
| `autoscaling.autoscalingProfile` | `OPTIMIZE_UTILIZATION` | Aggressive scale-down for cost savings |
| `verticalPodAutoscaling.enabled` | `true` | VPA recommendations available |
| `autoscaling.enableNodeAutoprovisioning` | `true` | NAP creates node pools on demand |
| GPU resource limits (T4, A100) | `1000000000` each | NAP can provision GPU nodes |

## Scaling Mechanisms

### 1. Manual Scaling

> **kubectl-only** — no MCP equivalent for `kubectl scale`. Use kubectl directly.

```bash
kubectl scale deployment <DEPLOYMENT> --replicas=<N> -n <NAMESPACE>
```

### 2. Horizontal Pod Autoscaling (HPA)

Scales the number of pods based on metrics.

**Quick setup (kubectl-only — no MCP equivalent for `kubectl autoscale`):**

```bash
kubectl autoscale deployment <DEPLOYMENT> --cpu-percent=50 --min=1 --max=10
```

**Manifest approach (recommended — use MCP `apply_k8s_manifest`):**

See [assets/hpa-example.yaml](../assets/hpa-example.yaml) for a template.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: <DEPLOYMENT>-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: <DEPLOYMENT>
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

### 3. Vertical Pod Autoscaling (VPA)

Adjusts CPU and memory requests to match actual usage. Enabled by default on golden path.

**Update modes:**
- `Off` — recommendations only (safest, start here)
- `Initial` — sets resources only at pod creation
- `Auto` — restarts pods to apply new resource values
- `InPlaceOrRecreate` — updates resources without restart when possible (GKE 1.34+)

**Create VPA in recommendation mode:**

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: <DEPLOYMENT>-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: <DEPLOYMENT>
  updatePolicy:
    updateMode: "Off"
```

**Read recommendations (prefer MCP `describe_k8s_resource`):**

```
# MCP (preferred)
describe_k8s_resource(parent="...", resourceType="verticalpodautoscaler", name="<DEPLOYMENT>-vpa", namespace="<NAMESPACE>")

# kubectl fallback
kubectl get vpa <DEPLOYMENT>-vpa -o jsonpath='{.status.recommendation}'
```

See [assets/vpa-example.yaml](../assets/vpa-example.yaml) for a full template.

### 4. Cluster Autoscaler / Node Auto Provisioning (NAP)

On Autopilot (golden path), node scaling is fully managed. NAP automatically creates and sizes node pools based on workload demands.

**For Standard clusters:**

```bash
# Enable cluster autoscaler on a node pool
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-autoscaling --node-pool <POOL_NAME> \
  --min-nodes <MIN> --max-nodes <MAX> \
  --quiet

# Enable NAP
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --enable-autoprovisioning \
  --min-cpu <MIN_CPU> --max-cpu <MAX_CPU> \
  --min-memory <MIN_MEM> --max-memory <MAX_MEM> \
  --quiet
```

**Autoscaling profiles:**

| Profile | Behavior | Golden Path? |
|---------|----------|-------------|
| `BALANCED` | Default GKE; conservative scale-down | No |
| `OPTIMIZE_UTILIZATION` | Aggressive scale-down; lower idle resources | **Yes** |

## Best Practices

1. **Define resource requests**: HPA and VPA rely on accurate requests. Always set them.
2. **Avoid metric conflicts**: Do not use HPA and VPA on the same metric. Typical pattern: HPA on CPU, VPA on memory.
3. **Pod Disruption Budgets**: Define PDBs for all production workloads to ensure availability during scaling events.
4. **HPA stabilization**: HPA has a default 5-minute stabilization window. Tune `behavior` for faster response if needed.
5. **VPA "Auto" caution**: Auto mode restarts pods. Ensure your app handles SIGTERM gracefully. VPA requires at least 2 replicas for evictions by default.
6. **Use ComputeClasses**: For workload-specific node targeting (Spot fallback, GPU, specific machine families), use ComputeClasses instead of node selectors.

## Rightsizing Workflow

1. Deploy VPA in `Off` mode for 24+ hours
2. Read recommendations: `kubectl describe vpa <NAME>`
3. Compare `target` values against current `requests`
4. Apply with 20% buffer: `new_request = target * 1.2`
5. Use patch format to update Deployment

| Condition | Recommendation | Risk |
|-----------|----------------|------|
| CPU request >5x P95 actual | Reduce to `P95 * 1.2` | Medium |
| Memory request >3x P95 actual | Reduce to `P95 * 1.2` | Medium |
| CPU request >2x P95 actual | Rightsizing with 20% buffer | Low |
| No resource limits set | Add limits to prevent noisy-neighbor | Low |
