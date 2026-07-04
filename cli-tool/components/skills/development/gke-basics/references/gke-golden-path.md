# GKE Golden Path Configuration

The golden path is the recommended Autopilot configuration for production clusters. It defines sensible defaults — when the user requests different settings, apply them and note relevant trade-offs.

> **MCP Tools:** `get_cluster`, `create_cluster`, `update_cluster`

## Rules

1. **Default to the golden path.** Use golden path values unless the user requests otherwise. When deviating, note trade-offs but respect the user's choice.
2. **Day-0 vs Day-1.** Flag Day-0 decisions (networking, private nodes, subnets, IP allocation) prominently — they are hard/impossible to change after creation.
3. **Tool preference: MCP > gcloud > kubectl.** See [cli-reference.md](./cli-reference.md) for full coverage matrix and override options. If the user says "use gcloud" or "use kubectl", respect that for the session.
4. **Document decisions and rationale**, especially for Day-0 choices and golden path deviations.

## Required Inputs

If the user is unsure, use golden path defaults.

- **Project ID** (required)
- **Region** (required, e.g., `us-central1`)
- **Cluster name** (required)
- **Environment type**: dev/test or production (defaults to production)
- **Networking**: bring-your-own VPC/subnet or auto-create (default: auto-create)
- **Scale expectations**: expected node/pod count, workload types
- **Cost constraints**: Spot VM tolerance, budget considerations

## Always-Apply Defaults

Recommended best practices applied by default. If the user requests a different setting, apply it and briefly note the security or operational trade-off.

| Setting | Golden Path Value |
|---------|-------------------|
| `autopilot.enabled` | `true` |
| `privateClusterConfig.enablePrivateNodes` | `true` |
| `masterAuthorizedNetworksConfig.privateEndpointEnforcementEnabled` | `true` |
| `secretManagerConfig.enabled` + `rotationInterval: 120s` | `true` |
| `rbacBindingConfig.enableInsecureBinding*` | `false` (both) |
| `workloadIdentityConfig.workloadPool` | enabled |
| `networkConfig.datapathProvider` | `ADVANCED_DATAPATH` |
| `networkConfig.dnsConfig.clusterDns` | `CLOUD_DNS` |
| `autoscaling.autoscalingProfile` | `OPTIMIZE_UTILIZATION` |
| `verticalPodAutoscaling.enabled` | `true` |
| `monitoringConfig` components | SYSTEM_COMPONENTS, STORAGE, POD, DEPLOYMENT, STATEFULSET, DAEMONSET, HPA, JOBSET, CADVISOR, KUBELET, DCGM, APISERVER, SCHEDULER, CONTROLLER_MANAGER |
| `advancedDatapathObservabilityConfig.enableMetrics` | `true` |
| `nodeConfig.shieldedInstanceConfig.enableSecureBoot` | `true` |
| `nodeConfig.workloadMetadataConfig.mode` | `GKE_METADATA` |
| `nodeConfig.gcfsConfig.enabled` / `gvnic.enabled` | `true` / `true` |
| `addonsConfig.statefulHaConfig.enabled` | `true` |
| Storage CSI drivers (Filestore, GCS FUSE, Parallelstore) | enabled |
| Pod Security Standards | `restricted` on production namespaces |

## Customer-Configurable Settings

These have golden path defaults but customers may deviate with valid justification. **Ask before changing.**

| Setting | Default | Why Deviate |
|---------|---------|-------------|
| `dnsEndpointConfig.allowExternalTraffic` | `true` | Restrict if cluster only accessed from within VPC |
| `autoIpamConfig` / `createSubnetwork` | `true` / `true` | Customer has pre-existing VPC/subnets |
| `maxPodsPerNode` | `48` | `110` for high pod-density (costs more CIDR space) |
| `subnetwork` | auto-created | Customer brings existing subnets |
| Maintenance exclusion windows | configured (NO_MINOR_UPGRADES, 1yr) | Customer-specific scheduling |
| `nodeConfig.bootDisk.diskType` | `pd-balanced` | `pd-ssd` for I/O-intensive, `pd-standard` for cost |
| `nodeConfig.machineType` | `ek-standard-8` (Autopilot) | Varies by workload; use ComputeClasses |

## Guardrails

- Do not request or output secrets (tokens, keys, service account JSON).
- Discover project/cluster context via MCP tools or `gcloud config get-value project` — don't ask users to paste project IDs.
- For Day-0 decisions, always ask clarifying questions before proceeding.
- For Day-1 features, propose golden path defaults with trade-offs and let the customer confirm.
- Do not promise zero downtime; advise PDBs, health probes, replicas, and staged upgrades.
- When auditing existing clusters, compare against golden path and report deviations with severity and remediation.

## Golden Path Config

See [golden-path-autopilot.yaml](../assets/golden-path-autopilot.yaml) for the full cluster-level policy settings.
