# SkyPilot Advanced Usage Guide

## Multi-Cloud Strategies

### Cloud selection patterns

```yaml
# Prefer specific clouds in order
resources:
  accelerators: A100:8
  any_of:
    - cloud: gcp
      region: us-central1
    - cloud: aws
      region: us-west-2
    - cloud: azure
      region: westus2
```

### Wildcard regions

```yaml
resources:
  cloud: aws
  region: us-*  # Any US region
  accelerators: A100:8
```

### Kubernetes + Cloud fallback

```yaml
resources:
  accelerators: A100:8
  any_of:
    - cloud: kubernetes
    - cloud: aws
    - cloud: gcp
```

## Advanced Resource Configuration

### Instance type constraints

```yaml
resources:
  instance_type: p4d.24xlarge  # Specific instance
  # OR
  cpus: 32+
  memory: 128+
  accelerators: A100:8
```

### Disk configuration

```yaml
resources:
  disk_size: 500  # GB
  disk_tier: best  # low, medium, high, ultra, best
```

### Network tier

```yaml
resources:
  network_tier: best  # High-performance networking
```

## Production Managed Jobs

### Job configuration

```yaml
name: production-training

resources:
  accelerators: H100:8
  use_spot: true
  spot_recovery: FAILOVER

# Retry configuration
max_restarts_on_errors: 3
```

### Controller scaling

For large-scale deployments (hundreds of jobs):

```bash
# Increase controller memory
sky jobs launch --controller-resources memory=32
```

### Static credentials

Use non-expiring credentials for controllers:

```bash
# AWS: Use IAM role or long-lived access keys
# GCP: Use service account JSON key
# Azure: Use service principal
```

## Advanced File Mounts

### Git repository workdir

```yaml
workdir:
  url: https://github.com/user/repo.git
  ref: main
  # For private repos, set GIT_TOKEN env var
```

### Multiple storage backends

```yaml
file_mounts:
  /data/s3:
    source: s3://my-bucket/data
    mode: MOUNT

  /data/gcs:
    source: gs://my-bucket/data
    mode: MOUNT

  /outputs:
    name: training-outputs
    store: s3
    mode: MOUNT_CACHED
```

### Rsync exclude patterns

```yaml
workdir: .

# Use .skyignore or .gitignore for excludes
```

Create `.skyignore`:
```
__pycache__/
*.pyc
.git/
.env
node_modules/
```

## Distributed Training Patterns

### PyTorch DDP

```yaml
num_nodes: 4

resources:
  accelerators: A100:8

run: |
  torchrun \
    --nnodes=$SKYPILOT_NUM_NODES \
    --nproc_per_node=$SKYPILOT_NUM_GPUS_PER_NODE \
    --node_rank=$SKYPILOT_NODE_RANK \
    --master_addr=$(echo "$SKYPILOT_NODE_IPS" | head -n1) \
    --master_port=12355 \
    train.py
```

### DeepSpeed

```yaml
num_nodes: 4

resources:
  accelerators: A100:8

setup: |
  pip install deepspeed

run: |
  # Create hostfile
  echo "$SKYPILOT_NODE_IPS" | awk '{print $1 " slots=8"}' > /tmp/hostfile

  deepspeed --hostfile=/tmp/hostfile \
    --num_nodes=$SKYPILOT_NUM_NODES \
    --num_gpus=$SKYPILOT_NUM_GPUS_PER_NODE \
    train.py --deepspeed ds_config.json
```

### Ray Train

```yaml
num_nodes: 4

resources:
  accelerators: A100:8

run: |
  # Head node starts Ray head
  if [ "${SKYPILOT_NODE_RANK}" == "0" ]; then
    ray start --head --port=6379
    # Wait for workers
    sleep 30
    python train_ray.py
  else
    ray start --address=$(echo "$SKYPILOT_NODE_IPS" | head -n1):6379
  fi
```

## Sky Serve Advanced

### Multi-replica serving

```yaml
service:
  readiness_probe:
    path: /health
    initial_delay_seconds: 60
    period_seconds: 10

  replica_policy:
    min_replicas: 2
    max_replicas: 20
    target_qps_per_replica: 5.0
    upscale_delay_seconds: 60
    downscale_delay_seconds: 300

  load_balancing_policy: round_robin  # or least_connections
```

### Blue-green deployment

```bash
# Deploy new version
sky serve up -n my-service-v2 service_v2.yaml

# Test new version
curl https://my-service-v2.skypilot.cloud/health

# Switch traffic (update DNS/load balancer)
# Then terminate old version
sky serve down my-service-v1
```

### Service with multiple accelerator options

```yaml
service:
  replica_policy:
    min_replicas: 1
    max_replicas: 5

resources:
  accelerators:
    L40S: 1
    A100: 1
    A10G: 1
  any_of:
    - cloud: aws
    - cloud: gcp
```

## Cost Optimization

### Spot instance strategies

```yaml
resources:
  accelerators: A100:8
  use_spot: true
  spot_recovery: FAILOVER  # or FAILOVER_NO_WAIT

# Always checkpoint for spot jobs
file_mounts:
  /checkpoints:
    name: spot-checkpoints
    store: s3
    mode: MOUNT_CACHED
```

### Reserved instance hints

```yaml
resources:
  accelerators: A100:8
  # SkyPilot considers reserved instances in cost calculation
```

### Budget constraints

```bash
# Dry run to see cost estimate
sky launch task.yaml --dryrun

# Set max cluster cost (future feature)
# sky launch task.yaml --max-cost-per-hour 50
```

## Kubernetes Integration

### Using existing clusters

```bash
# Configure kubeconfig
export KUBECONFIG=~/.kube/config

# Verify
sky check kubernetes
```

### Pod configuration

```yaml
resources:
  cloud: kubernetes
  accelerators: A100:1

config:
  kubernetes:
    pod_config:
      spec:
        runtimeClassName: nvidia
        tolerations:
          - key: "nvidia.com/gpu"
            operator: "Exists"
            effect: "NoSchedule"
```

### Multi-cluster

```yaml
resources:
  any_of:
    - cloud: kubernetes
      infra: cluster1
    - cloud: kubernetes
      infra: cluster2
    - cloud: aws
```

## API Server Deployment

### Team setup

```bash
# Start API server
sky api serve --host 0.0.0.0 --port 8000

# Connect clients
sky api login --endpoint https://your-server:8000
```

### Authentication

```bash
# Create service account
sky api create-service-account my-service

# Use token in CI/CD
export SKYPILOT_API_TOKEN=...
sky launch task.yaml
```

## Advanced CLI Patterns

### Parallel cluster operations

```bash
# Launch multiple clusters in parallel
for i in {1..10}; do
  sky launch -c cluster-$i task.yaml --detach &
done
wait
```

### Batch job submission

```bash
# Submit many jobs
for config in configs/*.yaml; do
  name=$(basename $config .yaml)
  sky jobs launch -n $name $config
done

# Monitor all jobs
sky jobs queue
```

### Conditional execution

```yaml
run: |
  # Only run on head node
  if [ "${SKYPILOT_NODE_RANK}" == "0" ]; then
    python main.py
  else
    python worker.py
  fi
```

## Environment Management

### Environment variables

```yaml
envs:
  WANDB_PROJECT: my-project
  HF_TOKEN: $HF_TOKEN  # Inherit from local
  CUDA_VISIBLE_DEVICES: "0,1,2,3"

# Secrets (hidden in logs)
secrets:
  - WANDB_API_KEY
  - HF_TOKEN
```

### Config overrides

```yaml
config:
  # Override global config
  jobs:
    controller:
      resources:
        memory: 32
```

## Monitoring and Observability

### Log streaming

```bash
# Stream logs
sky logs mycluster

# Follow specific job
sky logs mycluster 1

# Managed job logs
sky jobs logs my-job --follow
```

### Integration with W&B/MLflow

```yaml
envs:
  WANDB_API_KEY: $WANDB_API_KEY
  WANDB_PROJECT: my-project

run: |
  wandb login $WANDB_API_KEY
  python train.py --wandb
```

## Debugging

### SSH access

```bash
# SSH to head node
ssh mycluster

# SSH to worker node
ssh mycluster-worker1

# Port forwarding
ssh -L 8080:localhost:8080 mycluster
```

### Interactive debugging

```bash
# Launch interactive cluster
sky launch -c debug --gpus A100:1

# SSH and debug
ssh debug
```

### Job inspection

```bash
# View job queue
sky queue mycluster

# Cancel specific job
sky cancel mycluster 1

# View job details
sky logs mycluster 1
```
