# GKE Reliability

This reference covers high availability and reliability configuration for GKE clusters and workloads.

> **MCP Tools:** `get_cluster`, `get_k8s_resource`, `describe_k8s_resource`, `apply_k8s_manifest`, `list_k8s_events`

## Golden Path Reliability Defaults

| Setting | Golden Path Value | Notes |
|---------|-------------------|-------|
| Cluster type | Regional (4 zones: us-central1-a/b/c/f) | Control plane replicated across zones |
| Upgrade strategy | SURGE (`maxSurge: 1`) | Rolling upgrades with extra capacity |
| Auto-repair | `true` | Unhealthy nodes replaced automatically |
| Auto-upgrade | `true` | Nodes follow control plane version |
| Release channel | REGULAR | Balanced freshness and stability |
| Stateful HA | Enabled | Leader election for stateful workloads |

## Workflows

### 1. Verify Cluster High Availability

```
# MCP (preferred)
get_cluster(name="projects/<PROJECT>/locations/<REGION>/clusters/<CLUSTER>",
  readMask="location,locations,nodePools.locations")

# gcloud fallback
gcloud container clusters describe <CLUSTER> --region <REGION> \
  --format="json(location, locations)" \
  --quiet
```

- If `location` is a region (e.g., `us-central1`), the control plane is regional
- If `locations` has multiple entries, nodes span multiple zones

### 2. Pod Disruption Budgets (PDBs)

PDBs ensure minimum pod availability during voluntary disruptions (node upgrades, autoscaler scale-down).

**Check existing PDBs:**

```
# MCP (preferred)
get_k8s_resource(parent="...", resourceType="poddisruptionbudget")

# kubectl fallback
kubectl get pdb --all-namespaces
```

**Create PDB:**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
  namespace: default
spec:
  minAvailable: 2       # Or use maxUnavailable: 1
  selector:
    matchLabels:
      app: my-app
```

> Every production Deployment with 2+ replicas should have a PDB.

### 3. Health Probes

Every production container should have liveness and readiness probes. Startup probes are recommended for slow-starting apps.

**Check existing probes:**

```
# MCP (preferred)
describe_k8s_resource(parent="...", resourceType="deployment", name="<APP>", namespace="<NS>")

# kubectl fallback
kubectl get deployment <APP> -n <NS> -o yaml | grep -E "livenessProbe|readinessProbe|startupProbe"
```

**Recommended probe configuration:**

```yaml
spec:
  containers:
  - name: app
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /readyz
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
    startupProbe:             # For slow-starting apps
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 30    # 30 * 5s = 150s max startup time
```

- **Readiness**: Determines when a pod can accept traffic
- **Liveness**: Determines when to restart a container
- **Startup**: Disables liveness/readiness until the app is ready (prevents premature restarts)

### 4. Graceful Shutdown

Ensure applications handle `SIGTERM` and drain in-flight requests:

```yaml
spec:
  terminationGracePeriodSeconds: 30    # Default; increase for long-running requests
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # Allow LB to deregister
```

### 5. Topology Spread Constraints

Distribute pods across zones and nodes to survive failures:

```yaml
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: my-app
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: my-app
```

- **Zone spread** (`DoNotSchedule`): Hard requirement -- pods must be balanced across zones
- **Node spread** (`ScheduleAnyway`): Best-effort -- prefer distribution but don't block scheduling

### 6. Replicas

| Workload Type | Minimum Replicas | Reason |
|--------------|-----------------|--------|
| Stateless web/API | 2 | Survive single pod/node failure |
| Critical services | 3 | Survive zone failure with zone spread |
| Stateful (databases) | 3 (with replication) | Application-level quorum |
| Batch/jobs | 1 | Ephemeral by nature |

## Best Practices

1. **Regional clusters for production**: Always use regional clusters to survive zone failures
2. **PDBs for everything**: Every production workload with 2+ replicas needs a PDB
3. **Probes for all containers**: At minimum, readiness probes on every production container
4. **Zone spreading**: Use topology spread constraints to distribute pods across failure domains
5. **Graceful shutdown**: Handle SIGTERM and set appropriate `terminationGracePeriodSeconds`
6. **Maintenance windows**: Schedule upgrades during low-traffic periods (see [gke-upgrades.md](./gke-upgrades.md))
