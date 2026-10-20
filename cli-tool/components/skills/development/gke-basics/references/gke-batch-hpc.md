# GKE Batch & HPC Workloads

This reference covers running batch processing and high-performance computing (HPC) workloads on GKE.

> **MCP Tools:** `apply_k8s_manifest`, `get_k8s_resource`, `describe_k8s_resource`, `get_k8s_logs`, `delete_k8s_resource`, `list_k8s_events`

## When to Use

- Running batch data processing pipelines
- HPC simulations (CFD, molecular dynamics, financial modeling)
- Large-scale parallel computation (MPI, MapReduce)
- ML training jobs
- CI/CD build farms

## Batch Processing on GKE

### Kubernetes Jobs

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-job
spec:
  parallelism: 10
  completions: 100
  backoffLimit: 3
  template:
    spec:
      containers:
      - name: worker
        image: <IMAGE>
        resources:
          requests:
            cpu: "1"
            memory: "2Gi"
      restartPolicy: Never
```

### JobSet (for Complex Multi-Job Workflows)

The golden path enables JobSet monitoring (`JOBSET` in monitoringConfig).

```yaml
apiVersion: jobset.x-k8s.io/v1alpha2
kind: JobSet
metadata:
  name: training-job
spec:
  replicatedJobs:
  - name: workers
    replicas: 4
    template:
      spec:
        parallelism: 1
        completions: 1
        template:
          spec:
            containers:
            - name: worker
              image: <IMAGE>
              resources:
                requests:
                  cpu: "4"
                  memory: "8Gi"
```

### Kueue (Job Queuing)

Kueue manages job scheduling and resource allocation for batch workloads:

```bash
# Install Kueue
kubectl apply --server-side -f https://github.com/kubernetes-sigs/kueue/releases/latest/download/manifests.yaml
```

```yaml
# Define a ClusterQueue
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: batch-queue
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: ["cpu", "memory"]
    flavors:
    - name: default
      resources:
      - name: "cpu"
        nominalQuota: 100
      - name: "memory"
        nominalQuota: "200Gi"
---
# Allow a namespace to use the queue
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  name: batch-local
  namespace: batch-jobs
spec:
  clusterQueue: batch-queue
```

## HPC on GKE

### Compact Placement (Low-Latency Networking)

For tightly-coupled HPC workloads that need low-latency inter-node communication:

```bash
# Standard clusters: create node pool with compact placement
gcloud container node-pools create hpc-pool \
  --cluster <CLUSTER_NAME> --region <REGION> \
  --machine-type c3-standard-44 \
  --placement-type COMPACT \
  --num-nodes 8 \
  --enable-autoscaling --min-nodes 0 --max-nodes 16 \
  --quiet
```

### MPI Workloads

Use the MPI Operator for MPI-based HPC applications:

```bash
# Install MPI Operator
kubectl apply -f https://raw.githubusercontent.com/kubeflow/mpi-operator/master/deploy/v2beta1/mpi-operator.yaml
```

```yaml
apiVersion: kubeflow.org/v2beta1
kind: MPIJob
metadata:
  name: hpc-simulation
spec:
  slotsPerWorker: 4
  mpiReplicaSpecs:
    Launcher:
      replicas: 1
      template:
        spec:
          containers:
          - name: launcher
            image: <MPI_IMAGE>
            command: ["mpirun", "-np", "32", "./simulation"]
    Worker:
      replicas: 8  # Set resource requests per worker
```

## Cost Optimization for Batch/HPC

### Spot VMs for Batch

Batch workloads are ideal Spot VM candidates (interruptible, can checkpoint). Use a ComputeClass with Spot-first priority and `activeMigration` to return to Spot when available. See [gke-compute-classes.md](./gke-compute-classes.md) for the Spot-with-fallback pattern.

### Scale-to-Zero

For batch clusters, allow node pools to scale to zero when no jobs are running:

- Autopilot (golden path): Automatic, nodes scale to zero when no pods are scheduled
- Standard: Set `--min-nodes 0` on batch node pools

## Best Practices

- **Kueue** for multi-tenant job scheduling; **JobSet** for multi-component workflows
- **Set `backoffLimit`** on Jobs; **checkpoint long jobs** for preemption resilience
- **Spot VMs** for fault-tolerant batch; **compact placement** for tightly-coupled HPC
