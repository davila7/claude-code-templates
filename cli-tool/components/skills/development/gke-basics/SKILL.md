---
name: gke-basics
description: Plans, creates, and configures production-ready Google Kubernetes Engine (GKE) clusters using the golden path Autopilot configuration. Covers networking, security, observability, scaling, cost optimization, and AI/ML inference on GKE.
source: google/skills (Apache 2.0)
---

# Google Kubernetes Engine (GKE) Basics

GKE is a managed Kubernetes platform on Google Cloud for deploying, scaling, and operating containerized applications. This skill defaults to the **golden path Autopilot configuration** — see [gke-golden-path.md](./references/gke-golden-path.md) for defaults, rules, and guardrails.

## Quick Start

```bash
gcloud services enable container.googleapis.com --quiet
gcloud container clusters create-auto my-cluster --region=us-central1 --quiet
gcloud container clusters get-credentials my-cluster --region=us-central1 --quiet
kubectl create deployment hello-server \
  --image=us-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0
```

## Reference Directory

Load the relevant reference based on trigger keywords. Prefer the most specific match; if ambiguous, ask the user to clarify.

| Scenario | Trigger Keywords | Reference |
|----------|-----------------|-----------|
| Core Concepts | Autopilot vs Standard, architecture, pricing, what is GKE | [core-concepts.md](./references/core-concepts.md) |
| Golden Path & Defaults | golden path, Day-0 checklist, production defaults, cluster defaults | [gke-golden-path.md](./references/gke-golden-path.md) |
| Cluster Creation | create cluster, new cluster, provision GKE | [gke-cluster-creation.md](./references/gke-cluster-creation.md) |
| Networking | private cluster, VPC, subnet, Gateway API, DNS, ingress, egress, datapath | [gke-networking.md](./references/gke-networking.md) |
| Security & IAM | Workload Identity, Secret Manager, RBAC, Binary Auth, hardening, audit, gVisor, IAM roles | [gke-security.md](./references/gke-security.md) |
| Scaling | HPA, VPA, autoscaler, autoscaling, NAP, scale pods, scale nodes | [gke-scaling.md](./references/gke-scaling.md) |
| Compute Classes | ComputeClass, machine family, Spot fallback, GPU node pool, node selection | [gke-compute-classes.md](./references/gke-compute-classes.md) |
| Cost | cost, savings, Spot VMs, rightsizing, CUD, optimize spend, budget | [gke-cost.md](./references/gke-cost.md) |
| AI/ML Inference | inference, model serving, LLM, GPU, TPU, GIQ, vLLM | [gke-inference.md](./references/gke-inference.md) |
| Upgrades | upgrade, maintenance window, release channel, patching, version | [gke-upgrades.md](./references/gke-upgrades.md) |
| Observability | monitoring, logging, Prometheus, Grafana, metrics, alerts, dashboards | [gke-observability.md](./references/gke-observability.md) |
| Multi-tenancy | multi-tenant, namespace isolation, team access, enterprise, RBAC planning | [gke-multitenancy.md](./references/gke-multitenancy.md) |
| Batch & HPC | batch, HPC, job queue, high performance, MPI, parallel | [gke-batch-hpc.md](./references/gke-batch-hpc.md) |
| App Onboarding | containerize, deploy app, Dockerfile, onboard, migrate to GKE | [gke-app-onboarding.md](./references/gke-app-onboarding.md) |
| Backup & DR | backup, restore, disaster recovery, CMEK | [gke-backup-dr.md](./references/gke-backup-dr.md) |
| Storage | storage, PVC, persistent volume, StorageClass, Filestore, GCS FUSE | [gke-storage.md](./references/gke-storage.md) |
| Reliability | PDB, health probe, liveness, readiness, topology spread, graceful shutdown | [gke-reliability.md](./references/gke-reliability.md) |
| Client Libraries | client library, client-go, kubernetes python, kubernetes java, kubernetes SDK | [client-library-usage.md](./references/client-library-usage.md) |
| Infrastructure as Code | Terraform, IaC, HCL, infrastructure as code | [iac-usage.md](./references/iac-usage.md) |
| MCP Server | MCP tools, MCP server, MCP setup | [mcp-usage.md](./references/mcp-usage.md) |
| CLI / Tools | gcloud, kubectl, commands, how to | [cli-reference.md](./references/cli-reference.md) |
| Production Audit | production readiness, compliance, golden path check | [gke-cluster-creation.md](./references/gke-cluster-creation.md) |

*If you need product information not found in these references, use the Developer Knowledge MCP server `search_documents` tool.*
