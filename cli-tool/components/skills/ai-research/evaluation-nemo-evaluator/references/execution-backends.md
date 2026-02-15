# Execution Backends

NeMo Evaluator supports three execution backends: Local (Docker), Slurm (HPC), and Lepton (Cloud). Each backend implements the same interface but has different configuration requirements.

## Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    nemo-evaluator-launcher                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ LocalExecutor │  │ SlurmExecutor │  │ LeptonExecutor│     │
│  │   (Docker)    │  │   (SSH+sbatch)│  │  (Cloud API)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│           │                │                 │               │
└───────────┼────────────────┼─────────────────┼───────────────┘
            │                │                 │
            ▼                ▼                 ▼
       ┌─────────┐    ┌───────────┐    ┌────────────┐
       │ Docker  │    │  Slurm    │    │  Lepton AI │
       │ Engine  │    │  Cluster  │    │  Platform  │
       └─────────┘    └───────────┘    └────────────┘
```

## Local Executor (Docker)

The local executor runs evaluation containers on your local machine using Docker.

### Prerequisites

- Docker installed and running
- `docker` command available in PATH
- GPU drivers and nvidia-container-toolkit for GPU tasks

### Configuration

```yaml
defaults:
  - execution: local
  - deployment: none
  - _self_

execution:
  output_dir: ./results
  mode: sequential  # or parallel

  # Docker-specific options
  docker_args:
    - "--gpus=all"
    - "--shm-size=16g"

  # Container resource limits
  memory_limit: "64g"
  cpus: 8
```

### How It Works

1. Launcher reads `mapping.toml` to find container image for task
2. Creates run configuration and mounts volumes
3. Executes `docker run` via subprocess
4. Monitors stage files (`stage.pre-start`, `stage.running`, `stage.exit`)
5. Collects results from mounted output directory

### Example Usage

```bash
# Simple local evaluation
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name local_config

# With GPU allocation
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name local_config \
  -o 'execution.docker_args=["--gpus=all"]'
```

### Status Tracking

Status is tracked via file markers in the output directory:

| File | Meaning |
|------|---------|
| `stage.pre-start` | Container starting |
| `stage.running` | Evaluation in progress |
| `stage.exit` | Evaluation complete |

## Slurm Executor

The Slurm executor submits evaluation jobs to HPC clusters via SSH.

### Prerequisites

- SSH access to cluster head node
- Slurm commands available (`sbatch`, `squeue`, `sacct`)
- NGC containers accessible from compute nodes
- Shared filesystem for results

### Configuration

```yaml
defaults:
  - execution: slurm
  - deployment: vllm  # or sglang, nim, none
  - _self_

execution:
  # SSH connection settings
  hostname: cluster.example.com
  username: myuser  # Optional, uses SSH config
  ssh_key_path: ~/.ssh/id_rsa

  # Slurm job settings
  account: my_account
  partition: gpu
  qos: normal
  nodes: 1
  gpus_per_node: 8
  cpus_per_task: 32
  memory: "256G"
  walltime: "04:00:00"

  # Output settings
  output_dir: /shared/nfs/results

  # Container settings
  container_mounts:
    - "/shared/data:/data:ro"
    - "/shared/models:/models:ro"
```

### Deployment Options

When running on Slurm, you can deploy models alongside evaluation:

```yaml
# vLLM deployment
deployment:
  type: vllm
  checkpoint_path: /models/llama-3.1-8b
  tensor_parallel_size: 4
  max_model_len: 8192
  gpu_memory_utilization: 0.9

# SGLang deployment
deployment:
  type: sglang
  checkpoint_path: /models/llama-3.1-8b
  tensor_parallel_size: 4

# NVIDIA NIM deployment
deployment:
  type: nim
  nim_model_name: meta/llama-3.1-8b-instruct
```

### Job Submission Flow

```
┌─────────────────┐
│ Launcher CLI    │
└────────┬────────┘
         │ SSH
         ▼
┌─────────────────┐
│ Cluster Head    │
│    Node         │
└────────┬────────┘
         │ sbatch
         ▼
┌─────────────────┐
│ Compute Node    │
│                 │
│ ┌─────────────┐ │
│ │ Deployment  │ │
│ │ Container   │ │
│ └─────────────┘ │
│        │        │
│        ▼        │
│ ┌─────────────┐ │
│ │ Evaluation  │ │
│ │ Container   │ │
│ └─────────────┘ │
└─────────────────┘
```

### Status Queries

The Slurm executor queries job status via `sacct`:

```bash
# Status command checks these Slurm states
sacct -j <job_id> --format=JobID,State,ExitCode

# Mapped to ExecutionState:
# PENDING -> pending
# RUNNING -> running
# COMPLETED -> completed
# FAILED -> failed
# CANCELLED -> cancelled
```

### Long-Running Jobs

For long-running evaluations on Slurm, consider:

```yaml
execution:
  walltime: "24:00:00"  # Extended walltime
  # Use caching to resume from interruptions

target:
  api_endpoint:
    adapter_config:
      interceptors:
        - name: caching
          config:
            cache_dir: "/shared/cache"
            reuse_cached_responses: true
```

The caching interceptor helps resume interrupted evaluations by reusing previous API responses.

## Lepton Executor

The Lepton executor runs evaluations on Lepton AI's cloud platform.

### Prerequisites

- Lepton AI account
- `LEPTON_API_TOKEN` environment variable set
- `leptonai` Python package (auto-installed)

### Configuration

```yaml
defaults:
  - execution: lepton
  - deployment: none
  - _self_

execution:
  # Lepton job settings
  resource_shape: gpu.a100-80g
  num_replicas: 1

  # Environment
  env_vars:
    NGC_API_KEY: NGC_API_KEY
    HF_TOKEN: HF_TOKEN
```

### How It Works

1. Launcher creates Lepton job specification
2. Submits job via Lepton API
3. Optionally creates endpoint for model serving
4. Polls job status via API
5. Retrieves results when complete

### Endpoint Management

For evaluating Lepton-hosted models:

```yaml
target:
  api_endpoint:
    type: lepton
    deployment_name: my-llama-deployment
    # URL auto-generated from deployment
```

## Backend Selection Guide

| Use Case | Recommended Backend |
|----------|-------------------|
| Quick local testing | Local |
| Large-scale batch evaluation | Slurm |
| CI/CD pipeline | Local or Lepton |
| Multi-model comparison | Slurm (parallel jobs) |
| Cloud-native workflow | Lepton |
| Self-hosted model evaluation | Local or Slurm |

## Execution Database

All backends share the `ExecutionDB` for tracking jobs:

```
┌─────────────────────────────────────────────┐
│               ExecutionDB (SQLite)           │
│                                              │
│  invocation_id │ job_id │ status │ backend  │
│  ─────────────────────────────────────────  │
│  inv_abc123    │ 12345  │ running │ slurm   │
│  inv_def456    │ cont_1 │ done    │ local   │
└─────────────────────────────────────────────┘
```

Query via CLI:

```bash
# List all invocations
nemo-evaluator-launcher ls runs

# Get specific invocation
nemo-evaluator-launcher info <invocation_id>
```

## Troubleshooting

### Local Executor

**Issue: Docker permission denied**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Issue: GPU not available in container**
```bash
# Install nvidia-container-toolkit
sudo apt-get install nvidia-container-toolkit
sudo systemctl restart docker
```

### Slurm Executor

**Issue: SSH connection fails**
```bash
# Test SSH connection
ssh -v cluster.example.com

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
```

**Issue: Job stuck in pending**
```bash
# Check queue status
squeue -u $USER

# Check account limits
sacctmgr show associations user=$USER
```

### Lepton Executor

**Issue: API token invalid**
```bash
# Verify token
curl -H "Authorization: Bearer $LEPTON_API_TOKEN" \
  https://api.lepton.ai/v1/jobs
```

**Issue: Resource shape unavailable**
```bash
# List available shapes
lepton shape list
```
