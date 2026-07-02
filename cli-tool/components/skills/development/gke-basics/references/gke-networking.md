# GKE Networking

This reference covers networking configuration for GKE clusters. The golden path enforces private, VPC-native clusters with Dataplane V2.

> **MCP Tools:** `get_cluster`, `update_cluster`, `apply_k8s_manifest`, `get_k8s_resource`

## Golden Path Networking Defaults

| Setting | Golden Path Value | Day-0/1 | Notes |
|---------|-------------------|---------|-------|
| `privateClusterConfig.enablePrivateNodes` | `true` | Day-0 | Nodes have no public IPs |
| `masterAuthorizedNetworksConfig.privateEndpointEnforcementEnabled` | `true` | Day-0 | Control plane only reachable via private endpoint or DNS |
| `controlPlaneEndpointsConfig.dnsEndpointConfig.allowExternalTraffic` | `true` | Day-0 | Allows DNS-based access from outside VPC |
| `networkConfig.datapathProvider` | `ADVANCED_DATAPATH` (Dataplane V2) | Day-0 | eBPF-based, built-in Network Policy |
| `networkConfig.dnsConfig.clusterDns` | `CLOUD_DNS` | Day-0 | Managed DNS, more reliable than kube-dns |
| `networkConfig.enableIntraNodeVisibility` | `true` | Day-1 | VPC Flow Logs for intra-node traffic |
| `networkConfig.gatewayApiConfig.channel` | `CHANNEL_STANDARD` | Day-1 | Gateway API support |
| `ipAllocationPolicy.autoIpamConfig.enabled` | `true` | Day-0 | Automatic IP range management |
| `ipAllocationPolicy.createSubnetwork` | `true` | Day-0 | Auto-create dedicated subnet |
| `defaultMaxPodsConstraint.maxPodsPerNode` | `48` | Day-0 | Conservative default; 110 for high density |

## Private Cluster Access Patterns

The golden path creates a private cluster. Users access it via:

1. **DNS endpoint (default)**: `allowExternalTraffic: true` enables access via the cluster's DNS endpoint from outside the VPC. No VPN required.
2. **Private endpoint**: Direct access from within the VPC or via Cloud VPN/Interconnect.
3. **Authorized networks**: Add specific CIDRs to `masterAuthorizedNetworksConfig` for IP-based access control.

```bash
# Access private cluster via DNS endpoint (golden path default)
gcloud container clusters get-credentials <CLUSTER_NAME> \
  --region <REGION> --dns-endpoint \
  --quiet

# Access via private endpoint (from within VPC)
gcloud container clusters get-credentials <CLUSTER_NAME> \
  --region <REGION> --internal-ip \
  --quiet
```

## Bring-Your-Own VPC/Subnet

If the customer has existing network infrastructure:

```bash
gcloud container clusters create-auto <CLUSTER_NAME> \
  --region <REGION> \
  --network <VPC_NAME> \
  --subnetwork <SUBNET_NAME> \
  --cluster-secondary-range-name <POD_RANGE> \
  --services-secondary-range-name <SVC_RANGE> \
  --enable-private-nodes \
  --enable-master-authorized-networks \
  --quiet
```

> **Day-0 Warning**: VPC, subnet, and IP ranges cannot be changed after cluster creation.

## IP Planning

| Resource | Golden Path | Notes |
|----------|-------------|-------|
| Pod CIDR | `/17` (auto) | ~32K pod IPs; size based on maxPodsPerNode |
| Service CIDR | `/20` (auto) | ~4K service IPs |
| Node subnet | auto-created | /20 recommended for growth |
| Max pods/node | 48 | Each node gets a /25 pod range; set to 110 for /24 per node |

**Pod CIDR sizing rule of thumb:**
- `maxPodsPerNode=48` -> each node uses a `/25` (128 IPs) from pod CIDR
- `maxPodsPerNode=110` -> each node uses a `/24` (256 IPs) from pod CIDR
- Larger maxPodsPerNode = fewer nodes fit in a given CIDR

## Ingress

**Gateway API** (golden path, enabled via `gatewayApiConfig.channel: CHANNEL_STANDARD`):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: external-http
spec:
  gatewayClassName: gke-l7-global-external-managed
  listeners:
  - name: http
    protocol: HTTP
    port: 80
```

**Alternatives:**
- `gke-l7-regional-external-managed` — regional external
- `gke-l7-rilb` — internal load balancer
- Istio service mesh — for advanced traffic management, mTLS

## Egress

- Default: nodes use Cloud NAT for outbound internet access (private nodes have no public IPs)
- For static egress IPs: configure Cloud NAT with manual IP allocation
- For restricted egress: route through a firewall appliance via custom routes

## Network Policy

Dataplane V2 (golden path) provides built-in Network Policy enforcement — no additional addon needed. Apply default-deny per namespace, then allow specific flows.

> See [gke-security.md](./gke-security.md) for default-deny policy and [gke-multitenancy.md](./gke-multitenancy.md) for per-team allow policies.

## Cloud Armor (Recommended for Public-Facing Services)

Cloud Armor provides WAF and DDoS protection. **Not a golden path default** — recommended for any service with public ingress. Link via `BackendConfig`:

```yaml
# 1. Create BackendConfig referencing your Cloud Armor policy
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: my-backend-config
spec:
  securityPolicy:
    name: my-cloud-armor-policy
---
# 2. Annotate your Service
# cloud.google.com/backend-config: '{"default": "my-backend-config"}'
```

## SSL, Container-Native LB, and PSC

- **Google-managed SSL certificates**: Use `ManagedCertificate` CRD with Gateway API. Auto-provisions and renews.
- **Container-native LB**: Enabled by default on VPC-native clusters (golden path). Targets pods via NEGs, bypassing iptables. Annotation: `cloud.google.com/neg: '{"ingress": true}'`.
- **Private Service Connect (PSC)**: Use `ServiceAttachment` CRD to expose services across VPCs without peering.

