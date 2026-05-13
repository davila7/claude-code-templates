# GKE ComputeClasses

ComputeClasses allow declarative node configuration and autoscaling priorities in GKE Autopilot (and Standard with NAP). Use them to specify machine families, Spot VM fallback, GPU requirements, and zone targeting.

> **MCP Tools:** `apply_k8s_manifest`, `get_k8s_resource`, `describe_k8s_resource`, `delete_k8s_resource`

## When to Use

- Cost optimization: Spot VMs with on-demand fallback
- GPU/TPU workloads: target specific accelerators
- Performance: select specific machine families (c3, c4, n4)
- Zone targeting: colocate workloads with zonal resources

## CRD Structure

```yaml
apiVersion: cloud.google.com/v1
kind: ComputeClass
metadata:
  name: <string>
spec:
  # Required. Ordered list of rules. GKE tries them in order.
  priorities:
    - <PriorityRule>

  # Optional. Default: "DoNotScaleUp"
  whenUnsatisfiable: <"DoNotScaleUp" | "ScaleUpAnyway">

  # Optional. Auto-create node pools. Default: true
  nodePoolAutoCreation:
    enabled: <boolean>

  # Optional. Move workloads back to higher-priority when available
  activeMigration:
    optimizeRulePriority: <boolean>

  # Optional. Scale-down delay
  autoscalingPolicy:
    consolidationDelay: <duration>

  # Optional. Defaults for fields omitted in priorities
  priorityDefaults: <PriorityRule>
```

## PriorityRule Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `machineFamily` | string | Compute Engine machine family | `n4`, `c3`, `t2a` |
| `machineType` | string | Specific machine type | `n4-standard-32` |
| `spot` | boolean | Use Spot VMs | `true` |
| `minCores` | int | Minimum vCPUs | `4` |
| `minMemoryGb` | int | Minimum memory in GB | `16` |
| `gpu` | object | GPU config: `type`, `count`, `driverVersion` | See below |
| `tpu` | object | TPU config: `type`, `count`, `topology` | See below |
| `storage` | object | Boot disk: `type`, `sizeGb`, `kmsKey`; Local SSD: `count`, `interface` | See below |
| `location` | object | Zone targeting: `zones: [...]` or `type: "Any"` | See below |
| `reservations` | object | Reservation consumption: `NO_RESERVATION`, `ANY_RESERVATION`, `SPECIFIC_RESERVATION` | See below |

### GPU Configuration

```yaml
gpu:
  type: "nvidia-l4"        # nvidia-l4, nvidia-h100-80gb, etc.
  count: 1                 # GPUs per node
  driverVersion: "latest"  # Optional
```

### TPU Configuration

```yaml
tpu:
  type: "v5p-slice"
  count: 8
  topology: "2x2x1"
```

### Storage Configuration

```yaml
storage:
  bootDisk:
    type: "pd-balanced"     # pd-balanced (golden path), pd-ssd, hyperdisk-balanced
    sizeGb: 100
    kmsKey: "projects/.../cryptoKeys/..."  # Optional CMEK
  localSsd:
    count: 1
    interface: "NVME"
```

### Location Configuration

```yaml
location:
  zones:
    - "us-central1-a"
    - "us-central1-b"
  # OR
  type: "Any"              # Let GKE pick from cluster zones
```

## Common Patterns

### Spot VMs with On-Demand Fallback

```yaml
apiVersion: cloud.google.com/v1
kind: ComputeClass
metadata:
  name: spot-with-fallback
spec:
  nodePoolAutoCreation:
    enabled: true
  priorities:
  - machineFamily: n4
    spot: true
  - machineFamily: n4
    spot: false
```

### GPU Workload (L4)

```yaml
apiVersion: cloud.google.com/v1
kind: ComputeClass
metadata:
  name: l4-gpu-class
spec:
  priorities:
  - machineFamily: g2
    gpu:
      type: nvidia-l4
      count: 1
    minCores: 4
    minMemoryGb: 16
    storage:
      bootDisk:
        type: pd-balanced
        sizeGb: 100
```

### Spot with Active Migration (Return to Spot When Available)

Add `activeMigration` to the Spot-with-fallback pattern above to auto-migrate workloads back to Spot when capacity returns:

```yaml
spec:
  activeMigration:
    optimizeRulePriority: true
  priorities:
  - machineFamily: n4
    spot: true
  - machineFamily: n4
    spot: false
```

> **Other patterns** — HPC (`machineFamily: c3`, `minCores: 8`) and zone targeting (`location.zones: [...]`) follow the same CRD structure. See the PriorityRule fields table and sub-config examples above.

## Workload Usage

Pods must specify the ComputeClass via node selector:

```yaml
nodeSelector:
  cloud.google.com/compute-class: "<compute-class-name>"
```

## Warnings

- Do not mix ComputeClass selection with other hard node selectors (like `cloud.google.com/gke-spot`) — this causes scheduling conflicts.
- When using `activeMigration`, workloads will be evicted and rescheduled — ensure PDBs are in place.
- Spot VMs can be evicted with 30-second notice. Set `terminationGracePeriodSeconds < 30` for Spot workloads.
