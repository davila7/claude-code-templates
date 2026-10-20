# GKE Cost Optimization

This reference covers strategies for reducing GKE costs while maintaining the golden path security and reliability posture.

> **MCP Tools:** `get_k8s_resource`, `describe_k8s_resource`, `apply_k8s_manifest`, `patch_k8s_resource`, `get_cluster`

## Golden Path Cost Features

The golden path already includes cost-optimizing settings:

| Setting | Value | Impact |
|---------|-------|--------|
| `autoscalingProfile` | `OPTIMIZE_UTILIZATION` | Aggressive node scale-down reduces idle compute |
| `verticalPodAutoscaling` | `enabled` | VPA recommendations prevent over-provisioning |
| Autopilot pricing | Pay per pod request | No charge for unused node capacity |
| Node Auto Provisioning | enabled | Right-sized node pools created automatically |

## Cost Optimization Strategies

### 1. Spot VMs via ComputeClasses

Use Spot VMs for fault-tolerant workloads (60-90% cost reduction).

```yaml
apiVersion: cloud.google.com/v1
kind: ComputeClass
metadata:
  name: spot-with-fallback
spec:
  activeMigration:
    optimizeRulePriority: true
  priorities:
  - machineFamily: n4
    spot: true
  - machineFamily: n4
    spot: false
```

**Spot-suitable workloads:**

| Workload | Spot-Suitable? |
|----------|----------------|
| Batch / data processing | Yes |
| Dev / test environments | Yes |
| Stateless web/API (replicas >= 2) | Yes (with PDBs) |
| Jobs with checkpointing | Yes |
| Stateful workloads (databases) | No |
| Single-replica critical services | No |

**Handling eviction:**

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 25  # Must be < 30s for Spot
      containers:
      - name: app
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]
```

### 2. Pod Rightsizing

Use VPA recommendations to reduce over-provisioned requests.

```bash
# 1. Deploy VPA in recommendation mode
kubectl apply -f - <<EOF
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
EOF

# 2. Wait 24+ hours for data collection

# 3. Read recommendations
kubectl get vpa <DEPLOYMENT>-vpa -o jsonpath='{.status.recommendation}'
```

**Optimization rules:**

| Condition | Action | Savings |
|-----------|--------|---------|
| CPU request >5x P95 actual | Reduce to `P95 * 1.2` | High |
| Memory request >3x P95 actual | Reduce to `P95 * 1.2` | High |
| CPU request >2x P95 actual | Reduce to `P95 * 1.2` | Medium |
| No resource requests set | Add requests (enables bin-packing) | Medium |

### 3. Machine Type Selection

| Family | Use Case | Relative Cost |
|--------|----------|---------------|
| e2 | General purpose, burstable | Lowest |
| t2a / t2d | Scale-out (Arm/AMD), price-performance optimized | Low |
| n4a | Axion Arm-based, general-purpose price-performance | Low |
| n4 / n4d | General purpose (Intel/AMD), flexible shapes | Low-Medium |
| c4a | Compute-optimized (Arm), high efficiency | Medium-High |
| c3 / c4 | Compute-optimized (Intel) | Medium-High |
| c3d / c4d | Compute-optimized (AMD), high-performance throughput | Medium-High |
| ek-standard | Autopilot enhanced (golden path) | Medium |
| m3 / x4 | Memory-optimized, SAP HANA, large databases | High |
| g2 (L4 GPU) | AI inference | High |
| a3 (H100 GPU) | AI training | Highest |
| a4 / a4x | Ultra-scale AI (Blackwell GPUs) | Highest |

> In Autopilot, machine type is managed. Use ComputeClasses to influence selection.

### 4. Committed Use Discounts (CUDs)

For steady-state workloads, purchase 1-year or 3-year CUDs:

- 1-year: ~20-30% discount
- 3-year: ~50-55% discount
- Applied automatically to matching usage in the region
- Purchase via Google Cloud Console > Billing > Committed use discounts

### 5. Cluster Management

- **Stop/start dev clusters**: Idle dev clusters cost money even with no workloads (control plane fee).
- **Right-size node pools** (Standard): Use Cluster Autoscaler with appropriate min/max.
- **Multi-tenant clusters**: Share a single cluster across teams instead of per-team clusters (see [gke-multitenancy.md](./gke-multitenancy.md)).

## Cost Monitoring

```bash
# View cluster cost breakdown (requires Cost Management API)
gcloud billing budgets list --billing-account=<BILLING_ACCOUNT> --quiet

# View node utilization
kubectl top nodes

# View pod resource usage vs requests
kubectl top pods --all-namespaces --containers
```

## Dev/Test Cost Savings

For non-production environments, these golden path deviations are acceptable:

| Setting | Production (Golden Path) | Dev/Test |
|---------|-------------------------|----------|
| Cluster mode | Autopilot | Autopilot (cheaper with fewer pods) |
| Release channel | Regular | Rapid (get fixes faster) |
| Private nodes | Required | Optional (simpler access) |
| Monitoring components | Full suite | SYSTEM_COMPONENTS only |
| Secret Manager rotation | 120s | Disabled |
| Maintenance windows | Configured | Not needed |
