# GKE Core Concepts

Google Kubernetes Engine (GKE) is a managed Kubernetes platform for deploying, managing, and scaling containerized applications on Google Cloud infrastructure. It handles cluster provisioning, upgrades, and node management, letting teams focus on workloads rather than infrastructure.

> **MCP Tools:** `list_clusters`, `get_cluster`

## Cluster Modes

| Mode | Who Manages Nodes | Best For |
|------|-------------------|----------|
| **Autopilot** (recommended) | Google — fully managed nodes, scaling, and security | Most workloads. No node-level ops. Pay per pod resource request. |
| **Standard** | You — full control over node pools, OS, machine types | Workloads requiring kernel customization, specific node OS, or DaemonSets not supported by Autopilot |

**Default: Autopilot.** Use Standard only when Autopilot has a documented limitation for your workload.

## Cluster Architecture

- **Regional clusters** (recommended): Control plane replicated across 3 zones. Higher availability, no single-zone failure risk.
- **Zonal clusters**: Single control plane zone. Lower cost, acceptable for dev/test.
- **Private clusters** (golden path default): Nodes have no public IPs. Control plane accessible via private endpoint or DNS endpoint.

## Networking Model

GKE uses **VPC-native** clusters with alias IP ranges:
- Each pod gets a routable IP from the pod CIDR
- Dataplane V2 (eBPF-based) is the golden path default — provides built-in Network Policy enforcement
- Cloud DNS for in-cluster DNS resolution
- Gateway API for ingress/load balancing

## Scaling Model

- **Horizontal Pod Autoscaler (HPA)**: Scales pod replicas based on CPU, memory, or custom metrics
- **Vertical Pod Autoscaler (VPA)**: Recommends or auto-adjusts pod resource requests
- **Cluster Autoscaler / NAP**: Scales nodes to match pod demand (Autopilot handles this automatically)
- **ComputeClasses**: Declarative node selection — machine family, Spot VMs, GPU targeting

## Identity & Security Model

- **Workload Identity Federation**: Pods assume Google Cloud IAM identities without static keys
- **Secret Manager integration**: Secrets synced to Kubernetes with automatic rotation
- **Pod Security Standards**: `restricted` profile enforced on production namespaces
- **Shielded Nodes**: Secure Boot and integrity monitoring (Autopilot-enforced)

## Regional Availability

GKE is available in all Google Cloud regions. Autopilot clusters are regional by default. See https://cloud.google.com/about/locations for the full region list.

## Pricing

GKE pricing depends on the cluster mode:
- **Autopilot**: Pay for pod resource requests (vCPU, memory, ephemeral storage). No cluster management fee.
- **Standard**: Pay for underlying Compute Engine VMs plus a per-cluster management fee.

For current pricing, see https://cloud.google.com/kubernetes-engine/pricing.
