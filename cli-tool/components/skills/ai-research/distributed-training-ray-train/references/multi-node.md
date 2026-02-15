# Ray Train Multi-Node Setup

## Ray Cluster Architecture

Ray Train runs on a **Ray cluster** with one head node and multiple worker nodes.

**Components**:
- **Head node**: Coordinates workers, runs scheduling
- **Worker nodes**: Execute training tasks
- **Object store**: Shared memory across nodes (using Apache Arrow/Plasma)

## Local Multi-Node Setup

### Manual Cluster Setup

**Head node**:
```bash
# Start Ray head
ray start --head --port=6379 --dashboard-host=0.0.0.0

# Output:
# Started Ray on this node with:
#   - Head node IP: 192.168.1.100
#   - Dashboard: http://192.168.1.100:8265
```

**Worker nodes**:
```bash
# Connect to head node
ray start --address=192.168.1.100:6379

# Output:
# Started Ray on this node.
# Connected to Ray cluster.
```

**Training script**:
```python
import ray
from ray.train.torch import TorchTrainer
from ray.train import ScalingConfig

# Connect to cluster
ray.init(address='auto')  # Auto-detects cluster

# Train across all nodes
trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(
        num_workers=16,  # Total workers across all nodes
        use_gpu=True,
        placement_strategy="SPREAD"  # Spread across nodes
    )
)

result = trainer.fit()
```

### Check Cluster Status

```bash
# View cluster status
ray status

# Output:
# ======== Cluster Status ========
# Nodes: 4
# Total CPUs: 128
# Total GPUs: 32
# Total memory: 512 GB
```

**Python API**:
```python
import ray

ray.init(address='auto')

# Get cluster resources
print(ray.cluster_resources())
# {'CPU': 128.0, 'GPU': 32.0, 'memory': 549755813888, 'node:192.168.1.100': 1.0, ...}

# Get available resources
print(ray.available_resources())
```

## Cloud Deployments

### AWS EC2 Cluster

**Cluster config** (`cluster.yaml`):
```yaml
cluster_name: ray-train-cluster

max_workers: 3  # 3 worker nodes

provider:
  type: aws
  region: us-west-2
  availability_zone: us-west-2a

auth:
  ssh_user: ubuntu

head_node_type: head_node
available_node_types:
  head_node:
    node_config:
      InstanceType: p3.2xlarge  # V100 GPU
      ImageId: ami-0a2363a9cff180a64  # Deep Learning AMI
    resources: {"CPU": 8, "GPU": 1}
    min_workers: 0
    max_workers: 0

  worker_node:
    node_config:
      InstanceType: p3.8xlarge  # 4× V100
      ImageId: ami-0a2363a9cff180a64
    resources: {"CPU": 32, "GPU": 4}
    min_workers: 3
    max_workers: 3

setup_commands:
  - pip install -U ray[train] torch transformers

head_setup_commands:
  - pip install -U "ray[default]"
```

**Launch cluster**:
```bash
# Start cluster
ray up cluster.yaml

# SSH to head node
ray attach cluster.yaml

# Run training
python train.py

# Teardown
ray down cluster.yaml
```

**Auto-submit job**:
```bash
# Submit job from local machine
ray job submit \
  --address http://<head-node-ip>:8265 \
  --working-dir . \
  -- python train.py
```

### GCP Cluster

**Cluster config** (`gcp-cluster.yaml`):
```yaml
cluster_name: ray-train-gcp

provider:
  type: gcp
  region: us-central1
  availability_zone: us-central1-a
  project_id: my-project-id

auth:
  ssh_user: ubuntu

head_node_type: head_node
available_node_types:
  head_node:
    node_config:
      machineType: n1-standard-8
      disks:
        - boot: true
          autoDelete: true
          type: PERSISTENT
          initializeParams:
            diskSizeGb: 50
            sourceImage: projects/deeplearning-platform-release/global/images/family/pytorch-latest-gpu
      guestAccelerators:
        - acceleratorType: nvidia-tesla-v100
          acceleratorCount: 1
    resources: {"CPU": 8, "GPU": 1}

  worker_node:
    node_config:
      machineType: n1-highmem-16
      disks:
        - boot: true
          autoDelete: true
          type: PERSISTENT
          initializeParams:
            diskSizeGb: 100
            sourceImage: projects/deeplearning-platform-release/global/images/family/pytorch-latest-gpu
      guestAccelerators:
        - acceleratorType: nvidia-tesla-v100
          acceleratorCount: 4
    resources: {"CPU": 16, "GPU": 4}
    min_workers: 2
    max_workers: 10

setup_commands:
  - pip install -U ray[train] torch transformers
```

**Launch**:
```bash
ray up gcp-cluster.yaml --yes
```

### Azure Cluster

**Cluster config** (`azure-cluster.yaml`):
```yaml
cluster_name: ray-train-azure

provider:
  type: azure
  location: eastus
  resource_group: ray-cluster-rg
  subscription_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

auth:
  ssh_user: ubuntu
  ssh_private_key: ~/.ssh/id_rsa

head_node_type: head_node
available_node_types:
  head_node:
    node_config:
      azure_arm_parameters:
        vmSize: Standard_NC6  # K80 GPU
        imagePublisher: microsoft-dsvm
        imageOffer: ubuntu-1804
        imageSku: 1804-gen2
        imageVersion: latest
    resources: {"CPU": 6, "GPU": 1}

  worker_node:
    node_config:
      azure_arm_parameters:
        vmSize: Standard_NC24  # 4× K80
        imagePublisher: microsoft-dsvm
        imageOffer: ubuntu-1804
        imageSku: 1804-gen2
        imageVersion: latest
    resources: {"CPU": 24, "GPU": 4}
    min_workers: 2
    max_workers: 10
```

## Kubernetes Deployment

### KubeRay Operator

**Install KubeRay**:
```bash
# Add Helm repo
helm repo add kuberay https://ray-project.github.io/kuberay-helm/

# Install operator
helm install kuberay-operator kuberay/kuberay-operator --version 0.6.0
```

**RayCluster manifest** (`ray-cluster.yaml`):
```yaml
apiVersion: ray.io/v1alpha1
kind: RayCluster
metadata:
  name: ray-train-cluster
spec:
  rayVersion: '2.40.0'
  headGroupSpec:
    rayStartParams:
      dashboard-host: '0.0.0.0'
    template:
      spec:
        containers:
        - name: ray-head
          image: rayproject/ray:2.40.0-py310-gpu
          resources:
            limits:
              cpu: "8"
              memory: "32Gi"
              nvidia.com/gpu: "1"
            requests:
              cpu: "8"
              memory: "32Gi"
              nvidia.com/gpu: "1"
          ports:
          - containerPort: 6379
            name: gcs-server
          - containerPort: 8265
            name: dashboard
          - containerPort: 10001
            name: client

  workerGroupSpecs:
  - replicas: 4
    minReplicas: 2
    maxReplicas: 10
    groupName: gpu-workers
    rayStartParams: {}
    template:
      spec:
        containers:
        - name: ray-worker
          image: rayproject/ray:2.40.0-py310-gpu
          resources:
            limits:
              cpu: "16"
              memory: "64Gi"
              nvidia.com/gpu: "4"
            requests:
              cpu: "16"
              memory: "64Gi"
              nvidia.com/gpu: "4"
```

**Deploy**:
```bash
kubectl apply -f ray-cluster.yaml

# Check status
kubectl get rayclusters

# Access dashboard
kubectl port-forward service/ray-train-cluster-head-svc 8265:8265
# Open http://localhost:8265
```

**Submit training job**:
```bash
# Port-forward Ray client port
kubectl port-forward service/ray-train-cluster-head-svc 10001:10001

# Submit from local machine
RAY_ADDRESS="ray://localhost:10001" python train.py
```

## SLURM Integration

### SLURM Job Script

**Launch Ray cluster** (`ray_cluster.sh`):
```bash
#!/bin/bash
#SBATCH --job-name=ray-train
#SBATCH --nodes=4
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=32
#SBATCH --gres=gpu:8
#SBATCH --time=24:00:00
#SBATCH --output=ray_train_%j.out

# Load modules
module load cuda/11.8
module load python/3.10

# Activate environment
source ~/venv/bin/activate

# Get head node
head_node=$(hostname)
head_node_ip=$(hostname -I | awk '{print $1}')

# Start Ray head on first node
if [ "$SLURM_NODEID" -eq 0 ]; then
    echo "Starting Ray head node at $head_node_ip"
    ray start --head --node-ip-address=$head_node_ip \
      --port=6379 \
      --dashboard-host=0.0.0.0 \
      --num-cpus=$SLURM_CPUS_PER_TASK \
      --num-gpus=$SLURM_GPUS_ON_NODE \
      --block &
    sleep 10
fi

# Start Ray workers on other nodes
if [ "$SLURM_NODEID" -ne 0 ]; then
    echo "Starting Ray worker node"
    ray start --address=$head_node_ip:6379 \
      --num-cpus=$SLURM_CPUS_PER_TASK \
      --num-gpus=$SLURM_GPUS_ON_NODE \
      --block &
fi

sleep 5

# Run training on head node only
if [ "$SLURM_NODEID" -eq 0 ]; then
    echo "Running training..."
    python train.py --address=$head_node_ip:6379
fi

# Wait for all processes
wait
```

**Submit job**:
```bash
sbatch ray_cluster.sh
```

**Training script** (`train.py`):
```python
import argparse
import ray
from ray.train.torch import TorchTrainer
from ray.train import ScalingConfig

def main(args):
    # Connect to Ray cluster
    ray.init(address=args.address)

    # Train across all SLURM nodes
    trainer = TorchTrainer(
        train_func,
        scaling_config=ScalingConfig(
            num_workers=32,  # 4 nodes × 8 GPUs
            use_gpu=True,
            placement_strategy="SPREAD"
        )
    )

    result = trainer.fit()
    print(f"Training complete: {result.metrics}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--address', required=True)
    args = parser.parse_args()
    main(args)
```

## Autoscaling

### Enable Autoscaling

**Cluster config with autoscaling**:
```yaml
cluster_name: ray-autoscale

max_workers: 10  # Maximum worker nodes

idle_timeout_minutes: 5  # Shutdown idle workers after 5 min

provider:
  type: aws
  region: us-west-2

available_node_types:
  worker_node:
    min_workers: 2  # Always keep 2 workers
    max_workers: 10  # Scale up to 10
    resources: {"CPU": 32, "GPU": 4}
    node_config:
      InstanceType: p3.8xlarge
```

**Training with autoscaling**:
```python
from ray.train.torch import TorchTrainer
from ray.train import ScalingConfig, RunConfig

# Request resources, Ray autoscaler adds nodes as needed
trainer = TorchTrainer(
    train_func,
    scaling_config=ScalingConfig(
        num_workers=40,  # Ray will autoscale to 10 nodes (40 GPUs)
        use_gpu=True,
        trainer_resources={"CPU": 0}  # Trainer doesn't need resources
    ),
    run_config=RunConfig(
        name="autoscale-training",
        storage_path="s3://my-bucket/ray-results"
    )
)

result = trainer.fit()
```

## Network Configuration

### Firewall Rules

**Required ports**:
- **6379**: Ray GCS (Global Control Store)
- **8265**: Ray Dashboard
- **10001**: Ray Client
- **8000-9000**: Worker communication (configurable)

**AWS Security Group**:
```bash
# Allow Ray ports within cluster
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --source-group sg-xxxxx \
  --protocol tcp \
  --port 6379

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --source-group sg-xxxxx \
  --protocol tcp \
  --port 8000-9000
```

### High-Performance Networking

**Enable InfiniBand/RDMA** (on-prem):
```bash
# Set Ray to use specific network interface
export RAY_BACKEND_LOG_LEVEL=debug
export NCCL_SOCKET_IFNAME=ib0  # InfiniBand interface
export NCCL_IB_DISABLE=0       # Enable InfiniBand

ray start --head --node-ip-address=$(ip addr show ib0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
```

**AWS Enhanced Networking**:
```yaml
# Use ENA (Elastic Network Adapter)
worker_node:
  node_config:
    InstanceType: p3dn.24xlarge  # 100 Gbps networking
    EbsOptimized: true
    NetworkInterfaces:
      - DeviceIndex: 0
        DeleteOnTermination: true
        InterfaceType: ena  # Enhanced networking
```

## Monitoring and Debugging

### Ray Dashboard

**Access dashboard**:
```bash
# Local: http://localhost:8265
# Remote: http://<head-node-ip>:8265

# SSH tunnel for secure access
ssh -L 8265:localhost:8265 user@<head-node-ip>
```

**Dashboard features**:
- Cluster utilization (CPU, GPU, memory)
- Running tasks and actors
- Object store usage
- Logs and errors

### Cluster Logs

**View logs**:
```bash
# Head node logs
tail -f /tmp/ray/session_latest/logs/monitor.log

# Worker node logs
tail -f /tmp/ray/session_latest/logs/raylet.log

# All logs
ray logs
```

**Python logging**:
```python
import logging

logger = logging.getLogger("ray")
logger.setLevel(logging.DEBUG)

# In training function
def train_func(config):
    logger.info(f"Worker {ray.get_runtime_context().get_worker_id()} starting")
    # Training...
```

## Best Practices

### 1. Placement Strategies

```python
# PACK: Pack workers on fewer nodes (better for communication)
ScalingConfig(num_workers=16, placement_strategy="PACK")

# SPREAD: Spread across nodes (better for fault tolerance)
ScalingConfig(num_workers=16, placement_strategy="SPREAD")

# STRICT_SPREAD: Exactly one worker per node
ScalingConfig(num_workers=4, placement_strategy="STRICT_SPREAD")
```

### 2. Resource Allocation

```python
# Reserve resources per worker
ScalingConfig(
    num_workers=8,
    use_gpu=True,
    resources_per_worker={"CPU": 8, "GPU": 1},  # Explicit allocation
    trainer_resources={"CPU": 2}  # Reserve for trainer
)
```

### 3. Fault Tolerance

```python
from ray.train import RunConfig, FailureConfig

trainer = TorchTrainer(
    train_func,
    run_config=RunConfig(
        failure_config=FailureConfig(
            max_failures=3  # Retry up to 3 times on worker failure
        )
    )
)
```

## Resources

- Ray Cluster Launcher: https://docs.ray.io/en/latest/cluster/getting-started.html
- KubeRay: https://docs.ray.io/en/latest/cluster/kubernetes/index.html
- SLURM: https://docs.ray.io/en/latest/cluster/vms/user-guides/launching-clusters/slurm.html
- Autoscaling: https://docs.ray.io/en/latest/cluster/vms/user-guides/configuring-autoscaling.html
