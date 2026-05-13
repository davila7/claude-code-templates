# GKE Upgrades & Maintenance

This reference covers upgrade strategy, maintenance windows, and release channel management for GKE clusters.

> **MCP Tools:** `get_cluster`, `get_k8s_version`, `update_cluster`, `update_node_pool`, `list_operations`, `get_operation`, `cancel_operation`, `get_k8s_resource`
> **CLI-only**: `gcloud container get-server-config` (available versions), `gcloud container clusters update --maintenance-window-*` (maintenance windows)

## Golden Path Upgrade Defaults

| Setting | Golden Path Value | Notes |
|---------|-------------------|-------|
| `releaseChannel.channel` | `REGULAR` | Balanced between freshness and stability |
| Maintenance exclusion | `NO_MINOR_UPGRADES`, 1 year | Prevents surprise minor version bumps |
| `upgradeSettings.strategy` | `SURGE` | Rolling upgrades with `maxSurge: 1` |
| Auto-repair | `true` | Unhealthy nodes are automatically replaced |
| Auto-upgrade | `true` | Nodes follow control plane version |

## Release Channels

| Channel | Cadence | Best For |
|---------|---------|----------|
| `RAPID` | Weeks after release | Dev/test, early access to features |
| `REGULAR` (golden path) | 2-3 months after Rapid | Production workloads |
| `STABLE` | 2-3 months after Regular | Risk-averse, highly regulated |

```bash
# Check current channel
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="value(releaseChannel.channel)" \
  --quiet

# Change channel (Day-1)
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --release-channel <CHANNEL> \
  --quiet
```

## Maintenance Windows

Control when GKE can perform automatic maintenance (upgrades, patches).

```bash
# Set maintenance window (e.g., weekends 2am-6am UTC)
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --maintenance-window-start "2026-01-01T02:00:00Z" \
  --maintenance-window-end "2026-01-01T06:00:00Z" \
  --maintenance-window-recurrence "FREQ=WEEKLY;BYDAY=SA,SU" \
  --quiet
```

### Maintenance Exclusions

The golden path includes a 1-year `NO_MINOR_UPGRADES` exclusion to prevent automatic minor version changes.

```bash
# Add maintenance exclusion
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --add-maintenance-exclusion-name "freeze-1" \
  --add-maintenance-exclusion-start "2026-04-11T00:00:00Z" \
  --add-maintenance-exclusion-end "2027-04-11T00:00:00Z" \
  --add-maintenance-exclusion-scope NO_MINOR_UPGRADES \
  --quiet

# Remove exclusion
gcloud container clusters update <CLUSTER_NAME> --region <REGION> \
  --remove-maintenance-exclusion "freeze-1" \
  --quiet
```

**Exclusion scopes:**
- `NO_UPGRADES` — blocks all upgrades (max 30 days)
- `NO_MINOR_UPGRADES` — allows patch upgrades, blocks minor version changes (max 1 year)
- `NO_MINOR_OR_NODE_UPGRADES` — blocks minor and node upgrades (max 1 year)

## Upgrade Strategy

### SURGE (Golden Path)

Rolling upgrade with configurable surge capacity:

```bash
# Default: maxSurge=1 (one extra node during upgrade)
gcloud container node-pools update <POOL_NAME> \
  --cluster <CLUSTER_NAME> --region <REGION> \
  --max-surge-upgrade 1 --max-unavailable-upgrade 0 \
  --quiet
```

### Blue-Green (For Zero-Downtime Critical Workloads)

```bash
gcloud container node-pools update <POOL_NAME> \
  --cluster <CLUSTER_NAME> --region <REGION> \
  --enable-blue-green-upgrade \
  --node-pool-soak-duration "3600s" \
  --quiet
```

## Pre-Upgrade Checklist

1. **Check deprecations**: Review Kubernetes API deprecations between current and target version
2. **Review PDBs**: Ensure all production workloads have PodDisruptionBudgets
3. **Test in non-prod**: Upgrade a staging cluster first
4. **Check addon compatibility**: Verify third-party controllers support the target version
5. **Review node pool versions**: All node pools should be within 2 minor versions of the control plane

```bash
# Check current versions
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="table(currentMasterVersion, nodePools[].version)" \
  --quiet

# Check available upgrades
gcloud container get-server-config --region <REGION> \
  --format="yaml(channels)" \
  --quiet

# List deprecation warnings
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis
```

## Manual Upgrade (When Needed)

```bash
# Upgrade control plane
gcloud container clusters upgrade <CLUSTER_NAME> --region <REGION> \
  --master --cluster-version <VERSION> \
  --quiet

# Upgrade node pool
gcloud container clusters upgrade <CLUSTER_NAME> --region <REGION> \
  --node-pool <POOL_NAME> \
  --quiet
```

## Best Practices

1. **Stay on a release channel**: Manual version management is error-prone. Let GKE manage versions.
2. **Use maintenance windows**: Schedule upgrades during low-traffic periods.
3. **Set PDBs on everything**: Protects workloads during node drains.
4. **Monitor during upgrades**: Watch for pod eviction failures, CrashLoopBackOff, and scheduling issues.
5. **Don't skip minor versions**: Upgrade incrementally (1.28 -> 1.29 -> 1.30, not 1.28 -> 1.30).
