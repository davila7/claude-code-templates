---
name: skypilot-multi-cloud-orchestration
description: Multi-cloud orchestration for ML workloads with automatic cost optimization. Use when you need to run training or batch jobs across multiple clouds, leverage spot instances with auto-recovery, or optimize GPU costs across providers.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Infrastructure, Multi-Cloud, Orchestration, GPU, Cost Optimization, SkyPilot]
dependencies: [skypilot>=0.7.0]
---

# SkyPilot Multi-Cloud Orchestration

Comprehensive guide to running ML workloads across clouds with automatic cost optimization using SkyPilot.

## When to use SkyPilot

**Use SkyPilot when:**
- Running ML workloads across multiple clouds (AWS, GCP, Azure, etc.)
- Need cost optimization with automatic cloud/region selection
- Running long jobs on spot instances with auto-recovery
- Managing distributed multi-node training
- Want unified interface for 20+ cloud providers
- Need to avoid vendor lock-in

**Key features:**
- **Multi-cloud**: AWS, GCP, Azure, Kubernetes, Lambda, RunPod, 20+ providers
- **Cost optimization**: Automatic cheapest cloud/region selection
- **Spot instances**: 3-6x cost savings with automatic recovery
- **Distributed training**: Multi-node jobs with gang scheduling
- **Managed jobs**: Auto-recovery, checkpointing, fault tolerance
- **Sky Serve**: Model serving with autoscaling

**Use alternatives instead:**
- **Modal**: For simpler serverless GPU with Python-native API
- **RunPod**: For single-cloud persistent pods
- **Kubernetes**: For existing K8s infrastructure
- **Ray**: For pure Ray-based orchestration

## Quick start

### Installation

```bash
pip install "skypilot[aws,gcp,azure,kubernetes]"

# Verify cloud credentials
sky check
```

### Hello World

Create `hello.yaml`:
```yaml
resources:
  accelerators: T4:1

run: |
  nvidia-smi
  echo "Hello from SkyPilot!"
```

Launch:
```bash
sky launch -c hello hello.yaml

# SSH to cluster
ssh hello

# Terminate
sky down hello
```

## Core concepts

### Task YAML structure

```yaml
# Task name (optional)
name: my-task

# Resource requirements
resources:
  cloud: aws              # Optional: auto-select if omitted
  region: us-west-2       # Optional: auto-select if omitted
  accelerators: A100:4    # GPU type and count
  cpus: 8+                # Minimum CPUs
  memory: 32+             # Minimum memory (GB)
  use_spot: true          # Use spot instances
  disk_size: 256          # Disk size (GB)

# Number of nodes for distributed training
num_nodes: 2

# Working directory (synced to ~/sky_workdir)
workdir: .

# Setup commands (run once)
setup: |
  pip install -r requirements.txt

# Run commands
run: |
  python train.py
```

### Key commands

| Command | Purpose |
|---------|---------|
| `sky launch` | Launch cluster and run task |
| `sky exec` | Run task on existing cluster |
| `sky status` | Show cluster status |
| `sky stop` | Stop cluster (preserve state) |
| `sky down` | Terminate cluster |
| `sky logs` | View task logs |
| `sky queue` | Show job queue |
| `sky jobs launch` | Launch managed job |
| `sky serve up` | Deploy serving endpoint |

## GPU configuration

### Available accelerators

```yaml
# NVIDIA GPUs
accelerators: T4:1
accelerators: L4:1
accelerators: A10G:1
accelerators: L40S:1
accelerators: A100:4
accelerators: A100-80GB:8
accelerators: H100:8

# Cloud-specific
accelerators: V100:4         # AWS/GCP
accelerators: TPU-v4-8       # GCP TPUs
```

### GPU fallbacks

```yaml
resources:
  accelerators:
    H100: 8
    A100-80GB: 8
    A100: 8
  any_of:
    - cloud: gcp
    - cloud: aws
    - cloud: azure
```

### Spot instances

```yaml
resources:
  accelerators: A100:8
  use_spot: true
  spot_recovery: FAILOVER  # Auto-recover on preemption
```

## Cluster management

### Launch and execute

```bash
# Launch new cluster
sky launch -c mycluster task.yaml

# Run on existing cluster (skip setup)
sky exec mycluster another_task.yaml

# Interactive SSH
ssh mycluster

# Stream logs
sky logs mycluster
```

### Autostop

```yaml
resources:
  accelerators: A100:4
  autostop:
    idle_minutes: 30
    down: true  # Terminate instead of stop
```

```bash
# Set autostop via CLI
sky autostop mycluster -i 30 --down
```

### Cluster status

```bash
# All clusters
sky status

# Detailed view
sky status -a
```

## Distributed training

### Multi-node setup

```yaml
resources:
  accelerators: A100:8

num_nodes: 4  # 4 nodes × 8 GPUs = 32 GPUs total

setup: |
  pip install torch torchvision

run: |
  torchrun \
    --nnodes=$SKYPILOT_NUM_NODES \
    --nproc_per_node=$SKYPILOT_NUM_GPUS_PER_NODE \
    --node_rank=$SKYPILOT_NODE_RANK \
    --master_addr=$(echo "$SKYPILOT_NODE_IPS" | head -n1) \
    --master_port=12355 \
    train.py
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `SKYPILOT_NODE_RANK` | Node index (0 to num_nodes-1) |
| `SKYPILOT_NODE_IPS` | Newline-separated IP addresses |
| `SKYPILOT_NUM_NODES` | Total number of nodes |
| `SKYPILOT_NUM_GPUS_PER_NODE` | GPUs per node |

### Head-node-only execution

```bash
run: |
  if [ "${SKYPILOT_NODE_RANK}" == "0" ]; then
    python orchestrate.py
  fi
```

## Managed jobs

### Spot recovery

```bash
# Launch managed job with spot recovery
sky jobs launch -n my-job train.yaml
```

### Checkpointing

```yaml
name: training-job

file_mounts:
  /checkpoints:
    name: my-checkpoints
    store: s3
    mode: MOUNT

resources:
  accelerators: A100:8
  use_spot: true

run: |
  python train.py \
    --checkpoint-dir /checkpoints \
    --resume-from-latest
```

### Job management

```bash
# List jobs
sky jobs queue

# View logs
sky jobs logs my-job

# Cancel job
sky jobs cancel my-job
```

## File mounts and storage

### Local file sync

```yaml
workdir: ./my-project  # Synced to ~/sky_workdir

file_mounts:
  /data/config.yaml: ./config.yaml
  ~/.vimrc: ~/.vimrc
```

### Cloud storage

```yaml
file_mounts:
  # Mount S3 bucket
  /datasets:
    source: s3://my-bucket/datasets
    mode: MOUNT  # Stream from S3

  # Copy GCS bucket
  /models:
    source: gs://my-bucket/models
    mode: COPY  # Pre-fetch to disk

  # Cached mount (fast writes)
  /outputs:
    name: my-outputs
    store: s3
    mode: MOUNT_CACHED
```

### Storage modes

| Mode | Description | Best For |
|------|-------------|----------|
| `MOUNT` | Stream from cloud | Large datasets, read-heavy |
| `COPY` | Pre-fetch to disk | Small files, random access |
| `MOUNT_CACHED` | Cache with async upload | Checkpoints, outputs |

## Sky Serve (Model Serving)

### Basic service

```yaml
# service.yaml
service:
  readiness_probe: /health
  replica_policy:
    min_replicas: 1
    max_replicas: 10
    target_qps_per_replica: 2.0

resources:
  accelerators: A100:1

run: |
  python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --port 8000
```

```bash
# Deploy
sky serve up -n my-service service.yaml

# Check status
sky serve status

# Get endpoint
sky serve status my-service
```

### Autoscaling policies

```yaml
service:
  replica_policy:
    min_replicas: 1
    max_replicas: 10
    target_qps_per_replica: 2.0
    upscale_delay_seconds: 60
    downscale_delay_seconds: 300
  load_balancing_policy: round_robin
```

## Cost optimization

### Automatic cloud selection

```yaml
# SkyPilot finds cheapest option
resources:
  accelerators: A100:8
  # No cloud specified - auto-select cheapest
```

```bash
# Show optimizer decision
sky launch task.yaml --dryrun
```

### Cloud preferences

```yaml
resources:
  accelerators: A100:8
  any_of:
    - cloud: gcp
      region: us-central1
    - cloud: aws
      region: us-east-1
    - cloud: azure
```

### Environment variables

```yaml
envs:
  HF_TOKEN: $HF_TOKEN  # Inherited from local env
  WANDB_API_KEY: $WANDB_API_KEY

# Or use secrets
secrets:
  - HF_TOKEN
  - WANDB_API_KEY
```

## Common workflows

### Workflow 1: Fine-tuning with checkpoints

```yaml
name: llm-finetune

file_mounts:
  /checkpoints:
    name: finetune-checkpoints
    store: s3
    mode: MOUNT_CACHED

resources:
  accelerators: A100:8
  use_spot: true

setup: |
  pip install transformers accelerate

run: |
  python train.py \
    --checkpoint-dir /checkpoints \
    --resume
```

### Workflow 2: Hyperparameter sweep

```yaml
name: hp-sweep-${RUN_ID}

envs:
  RUN_ID: 0
  LEARNING_RATE: 1e-4
  BATCH_SIZE: 32

resources:
  accelerators: A100:1
  use_spot: true

run: |
  python train.py \
    --lr $LEARNING_RATE \
    --batch-size $BATCH_SIZE \
    --run-id $RUN_ID
```

```bash
# Launch multiple jobs
for i in {1..10}; do
  sky jobs launch sweep.yaml \
    --env RUN_ID=$i \
    --env LEARNING_RATE=$(python -c "import random; print(10**random.uniform(-5,-3))")
done
```

## Debugging

```bash
# SSH to cluster
ssh mycluster

# View logs
sky logs mycluster

# Check job queue
sky queue mycluster

# View managed job logs
sky jobs logs my-job
```

## Common issues

| Issue | Solution |
|-------|----------|
| Quota exceeded | Request quota increase, try different region |
| Spot preemption | Use `sky jobs launch` for auto-recovery |
| Slow file sync | Use `MOUNT_CACHED` mode for outputs |
| GPU not available | Use `any_of` for fallback clouds |

## References

- **[Advanced Usage](references/advanced-usage.md)** - Multi-cloud, optimization, production patterns
- **[Troubleshooting](references/troubleshooting.md)** - Common issues and solutions

## Resources

- **Documentation**: https://docs.skypilot.co
- **GitHub**: https://github.com/skypilot-org/skypilot
- **Slack**: https://slack.skypilot.co
- **Examples**: https://github.com/skypilot-org/skypilot/tree/master/examples
