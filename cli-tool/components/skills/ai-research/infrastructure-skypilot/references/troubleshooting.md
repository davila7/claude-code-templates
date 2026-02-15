# SkyPilot Troubleshooting Guide

## Installation Issues

### Cloud credentials not found

**Error**: `sky check` shows clouds as disabled

**Solutions**:
```bash
# AWS
aws configure
# Verify: aws sts get-caller-identity

# GCP
gcloud auth application-default login
# Verify: gcloud auth list

# Azure
az login
az account set -s <subscription-id>

# Kubernetes
export KUBECONFIG=~/.kube/config
kubectl get nodes

# Re-check after configuration
sky check
```

### Permission errors

**Error**: `PermissionError` or `AccessDenied`

**Solutions**:
```bash
# AWS: Ensure IAM permissions include EC2, S3, IAM
# Required policies: AmazonEC2FullAccess, AmazonS3FullAccess, IAMFullAccess

# GCP: Ensure roles include Compute Admin, Storage Admin
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:email@example.com" \
  --role="roles/compute.admin"

# Azure: Ensure Contributor role on subscription
az role assignment create \
  --assignee email@example.com \
  --role Contributor \
  --scope /subscriptions/SUBSCRIPTION_ID
```

## Cluster Launch Issues

### Quota exceeded

**Error**: `Quota exceeded for resource`

**Solutions**:
```yaml
# Try different region
resources:
  accelerators: A100:8
  any_of:
    - cloud: gcp
      region: us-west1
    - cloud: gcp
      region: europe-west4
    - cloud: aws
      region: us-east-1

# Or request quota increase from cloud provider
```

```bash
# Check quota before launching
sky show-gpus --cloud gcp
```

### GPU not available

**Error**: `No resources available in region`

**Solutions**:
```yaml
# Use fallback accelerators
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

```bash
# Check GPU availability
sky show-gpus A100
sky show-gpus --cloud aws
```

### Instance type not found

**Error**: `Instance type 'xyz' not found`

**Solutions**:
```yaml
# Let SkyPilot choose instance automatically
resources:
  accelerators: A100:8
  cpus: 96+
  memory: 512+
  # Don't specify instance_type unless necessary
```

### Cluster stuck in INIT

**Error**: Cluster stays in INIT state

**Solutions**:
```bash
# Check cluster logs
sky logs mycluster --status

# SSH and check manually
ssh mycluster
journalctl -u sky-supervisor

# Terminate and retry
sky down mycluster
sky launch -c mycluster task.yaml
```

## Setup Command Issues

### Setup script fails

**Error**: Setup commands fail during provisioning

**Solutions**:
```yaml
# Add error handling and retries
setup: |
  set -e  # Exit on error

  # Retry pip installs
  for i in {1..3}; do
    pip install torch transformers && break
    echo "Retry $i..."
    sleep 10
  done

  # Verify installation
  python -c "import torch; print(torch.__version__)"
```

### Conda environment issues

**Error**: Conda not found or environment issues

**Solutions**:
```yaml
setup: |
  # Initialize conda for bash
  source ~/.bashrc

  # Or use full path
  ~/miniconda3/bin/conda create -n myenv python=3.10 -y
  ~/miniconda3/bin/conda activate myenv
```

### CUDA version mismatch

**Error**: `CUDA driver version is insufficient`

**Solutions**:
```yaml
setup: |
  # Install specific CUDA version
  pip install torch==2.1.0+cu121 -f https://download.pytorch.org/whl/torch_stable.html

  # Verify CUDA
  python -c "import torch; print(torch.cuda.is_available())"
```

## Distributed Training Issues

### Nodes can't communicate

**Error**: Connection refused between nodes

**Solutions**:
```yaml
run: |
  # Debug: Print all node IPs
  echo "All nodes: $SKYPILOT_NODE_IPS"
  echo "My rank: $SKYPILOT_NODE_RANK"

  # Wait for all nodes to be ready
  sleep 30

  # Use correct master address
  MASTER_ADDR=$(echo "$SKYPILOT_NODE_IPS" | head -n1)
  echo "Master: $MASTER_ADDR"
```

### torchrun fails

**Error**: `torch.distributed` errors

**Solutions**:
```yaml
run: |
  # Ensure correct environment variables
  export NCCL_DEBUG=INFO
  export NCCL_IB_DISABLE=1  # Try if InfiniBand issues

  torchrun \
    --nnodes=$SKYPILOT_NUM_NODES \
    --nproc_per_node=$SKYPILOT_NUM_GPUS_PER_NODE \
    --node_rank=$SKYPILOT_NODE_RANK \
    --master_addr=$(echo "$SKYPILOT_NODE_IPS" | head -n1) \
    --master_port=12355 \
    --rdzv_backend=c10d \
    train.py
```

### DeepSpeed hostfile errors

**Error**: `Invalid hostfile` or connection errors

**Solutions**:
```yaml
run: |
  # Create proper hostfile
  echo "$SKYPILOT_NODE_IPS" | while read ip; do
    echo "$ip slots=$SKYPILOT_NUM_GPUS_PER_NODE"
  done > /tmp/hostfile

  cat /tmp/hostfile  # Debug

  deepspeed --hostfile=/tmp/hostfile train.py
```

## File Mount Issues

### Mount fails

**Error**: `Failed to mount storage`

**Solutions**:
```yaml
# Verify bucket exists and credentials are valid
file_mounts:
  /data:
    source: s3://my-bucket/data
    mode: MOUNT

# Check bucket access
# aws s3 ls s3://my-bucket/
```

### Slow file access

**Problem**: Reading from mount is very slow

**Solutions**:
```yaml
# Use COPY mode for small datasets
file_mounts:
  /data:
    source: s3://bucket/data
    mode: COPY  # Pre-fetch to local disk

# Use MOUNT_CACHED for outputs
file_mounts:
  /outputs:
    name: outputs
    store: s3
    mode: MOUNT_CACHED  # Cached writes
```

### Storage not persisting

**Error**: Data lost after cluster restart

**Solutions**:
```yaml
# Use named storage (persists across clusters)
file_mounts:
  /persistent:
    name: my-persistent-storage
    store: s3
    mode: MOUNT

# Data in ~/sky_workdir is NOT persisted
# Always use file_mounts for persistent data
```

## Managed Job Issues

### Job keeps failing

**Error**: Job fails and doesn't recover

**Solutions**:
```yaml
# Enable spot recovery
resources:
  use_spot: true
  spot_recovery: FAILOVER

# Add retry logic
max_restarts_on_errors: 5

# Implement checkpointing
run: |
  python train.py \
    --checkpoint-dir /checkpoints \
    --resume-from-latest
```

### Job stuck in pending

**Error**: Job stays in PENDING state

**Solutions**:
```bash
# Check job controller status
sky jobs controller status

# View controller logs
sky jobs controller logs

# Restart controller if needed
sky jobs controller restart
```

### Checkpoint not resuming

**Error**: Training restarts from beginning

**Solutions**:
```yaml
file_mounts:
  /checkpoints:
    name: training-checkpoints
    store: s3
    mode: MOUNT_CACHED

run: |
  # Check for existing checkpoint
  if [ -d "/checkpoints/latest" ]; then
    RESUME_FLAG="--resume /checkpoints/latest"
  else
    RESUME_FLAG=""
  fi

  python train.py $RESUME_FLAG --checkpoint-dir /checkpoints
```

## Sky Serve Issues

### Service not accessible

**Error**: Cannot reach service endpoint

**Solutions**:
```bash
# Check service status
sky serve status my-service

# View replica logs
sky serve logs my-service

# Check readiness probe
sky serve status my-service --endpoint
```

### Replicas keep crashing

**Error**: Replicas fail health checks

**Solutions**:
```yaml
service:
  readiness_probe:
    path: /health
    initial_delay_seconds: 120  # Increase for slow model loading
    period_seconds: 30
    timeout_seconds: 10

run: |
  # Ensure health endpoint exists
  python -c "
  from fastapi import FastAPI
  app = FastAPI()

  @app.get('/health')
  def health():
      return {'status': 'ok'}
  "
```

### Autoscaling not working

**Problem**: Service doesn't scale up/down

**Solutions**:
```yaml
service:
  replica_policy:
    min_replicas: 1
    max_replicas: 10
    target_qps_per_replica: 2.0
    upscale_delay_seconds: 30   # Faster scale up
    downscale_delay_seconds: 60  # Faster scale down

# Monitor metrics
# sky serve status my-service
```

## SSH and Access Issues

### Cannot SSH to cluster

**Error**: `Connection refused` or timeout

**Solutions**:
```bash
# Verify cluster is running
sky status

# Try with verbose output
ssh -v mycluster

# Check SSH key
ls -la ~/.ssh/sky-key*

# Regenerate SSH key if needed
sky launch -c test --dryrun  # Regenerates key
```

### Port forwarding fails

**Error**: Cannot forward ports

**Solutions**:
```bash
# Correct syntax
ssh -L 8080:localhost:8080 mycluster

# For Jupyter
ssh -L 8888:localhost:8888 mycluster

# Multiple ports
ssh -L 8080:localhost:8080 -L 6006:localhost:6006 mycluster
```

## Cost and Billing Issues

### Unexpected charges

**Problem**: Higher than expected costs

**Solutions**:
```bash
# Always terminate unused clusters
sky down --all

# Set autostop
sky autostop mycluster -i 30 --down

# Use spot instances
resources:
  use_spot: true
```

### Spot instance preempted

**Error**: Instance terminated unexpectedly

**Solutions**:
```yaml
# Use managed jobs for automatic recovery
# sky jobs launch instead of sky launch

resources:
  use_spot: true
  spot_recovery: FAILOVER  # Auto-failover to another region/cloud

# Always checkpoint frequently when using spot
```

## Debugging Commands

### View cluster state

```bash
# Cluster status
sky status
sky status -a  # Show all details

# Cluster resources
sky show-gpus

# Cloud credentials
sky check
```

### View logs

```bash
# Task logs
sky logs mycluster
sky logs mycluster 1  # Specific job

# Managed job logs
sky jobs logs my-job
sky jobs logs my-job --follow

# Service logs
sky serve logs my-service
```

### Inspect cluster

```bash
# SSH to cluster
ssh mycluster

# Check GPU status
nvidia-smi

# Check processes
ps aux | grep python

# Check disk space
df -h
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `No launchable resources` | No available instances | Try different region/cloud |
| `Quota exceeded` | Cloud quota limit | Request increase or use different cloud |
| `Setup failed` | Script error | Check logs, add error handling |
| `Connection refused` | Network/firewall | Check security groups, wait for init |
| `CUDA OOM` | Out of GPU memory | Use larger GPU or reduce batch size |
| `Spot preempted` | Spot instance reclaimed | Use managed jobs for auto-recovery |
| `Mount failed` | Storage access issue | Check credentials and bucket exists |

## Getting Help

1. **Documentation**: https://docs.skypilot.co
2. **GitHub Issues**: https://github.com/skypilot-org/skypilot/issues
3. **Slack**: https://slack.skypilot.co
4. **Examples**: https://github.com/skypilot-org/skypilot/tree/master/examples

### Reporting Issues

Include:
- SkyPilot version: `sky --version`
- Python version: `python --version`
- Cloud provider and region
- Full error traceback
- Task YAML (sanitized)
- Output of `sky check`
