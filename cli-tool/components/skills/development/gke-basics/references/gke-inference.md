# GKE AI/ML Inference

This reference covers deploying AI/ML inference workloads on GKE using Google's Inference Quickstart (GIQ) and best practices for LLM serving.

> **MCP Tools:** `apply_k8s_manifest`, `get_k8s_resource`, `get_k8s_logs`, `get_k8s_rollout_status`, `describe_k8s_resource`, `list_k8s_events`. **CLI-only:** `gcloud container ai profiles *`

## When to Use

- Deploy an AI model (Llama, Gemma, Mistral, etc.) to GKE
- Generate optimized Kubernetes manifests for inference
- Select GPU/TPU accelerators for model serving
- Configure autoscaling for LLM inference

## Prerequisites

- A golden path GKE Autopilot cluster (GPU workloads are supported via ComputeClasses and NAP)
- `gcloud` CLI authenticated
- Sufficient GPU/TPU quota in the target region

## Workflow

### 1. Discovery: Find Models and Hardware

```bash
# List all supported models
gcloud container ai profiles models list --quiet

# Find valid accelerator/server combinations for a model
gcloud container ai profiles list --model=<MODEL_NAME> --quiet

# Example: what can run Gemma 2 9B?
gcloud container ai profiles list --model=gemma-2-9b-it --quiet
```

### 2. Generate Manifest

```bash
gcloud container ai profiles manifests create \
  --model=<MODEL_NAME> \
  --model-server=<SERVER> \
  --accelerator-type=<ACCELERATOR> \
  --target-ntpot-milliseconds=<NTPOT> --quiet > inference.yaml
```

**Parameters:**
- `--model`: Model ID (e.g., `gemma-2-9b-it`, `llama-3-8b`)
- `--model-server`: Inference server (`vllm`, `tgi`, `triton`, `tensorrt-llm`)
- `--accelerator-type`: GPU/TPU type (`nvidia-l4`, `nvidia-tesla-a100`, `nvidia-h100-80gb`)
- `--target-ntpot-milliseconds`: Target Normalized Time Per Output Token (optional, for latency optimization)

**Example:**

```bash
gcloud container ai profiles manifests create \
  --model=gemma-2-9b-it \
  --model-server=vllm \
  --accelerator-type=nvidia-l4 \
  --target-ntpot-milliseconds=50 --quiet > inference.yaml
```

### 3. Review and Deploy

```bash
# Review for placeholders (HF tokens, PVCs)
cat inference.yaml

# Deploy
kubectl apply -f inference.yaml

# Monitor
kubectl get pods -w
kubectl logs -f <POD_NAME>
```

> Some models require Hugging Face tokens. Create a Kubernetes Secret and reference it in the manifest.

## GPU ComputeClass for Inference

For Autopilot clusters, create a ComputeClass to target GPU nodes:

```yaml
apiVersion: cloud.google.com/v1
kind: ComputeClass
metadata:
  name: l4-inference
spec:
  priorities:
  - machineFamily: g2
    gpu:
      type: nvidia-l4
      count: 1
    minCores: 4
    minMemoryGb: 16
```

## Accelerator Selection Guide

| Accelerator | Best For | Memory | Relative Cost |
|-------------|----------|--------|---------------|
| NVIDIA T4 | Budget inference, lightweight legacy models | 16 GB | Lowest |
| NVIDIA L4 (G2) | Small-medium model inference, video, graphics | 24 GB | Low |
| NVIDIA RTX PRO 6000 (G4) | Multimodal AI, high-fidelity 3D, fine-tuning | 96 GB | Medium |
| Cloud TPU v5e | Cost-effective transformer inference | Varies | Medium |
| Cloud TPU v5p | High-performance training | Varies | High |
| Cloud TPU v6e (Trillium) | High-efficiency next-gen training & serving | 32 GB/chip | Medium-High |
| Cloud TPU v7x (Ironwood) | Ultra-scale inference & agentic workflows | 192 GB/chip | High |
| NVIDIA A100 | Large model inference, enterprise ML | 40/80 GB | High |
| NVIDIA H100 / H200 | Frontier model training, high throughput | 80/141 GB | Highest |
| NVIDIA B200 (A4) | Blackwell-scale training, FP4 precision | 192 GB | Highest |
| NVIDIA GB200 (A4X) | Rack-scale AI (Grace Blackwell Superchip) | Massive | Highest |

## Autoscaling LLM Inference

### GPU-based autoscaling

Use custom metrics for GPU utilization:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-server
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Pods
    pods:
      metric:
        name: gpu_duty_cycle
      target:
        type: AverageValue
        averageValue: "80"
```

### Best practices for inference autoscaling

1. **Use DCGM metrics**: Golden path enables DCGM monitoring for GPU utilization metrics
2. **Set appropriate minReplicas**: At least 1 for always-on serving; 0 for batch/on-demand
3. **Tune scale-down delay**: LLM model loading is slow; use longer stabilization windows
4. **Consider queue depth**: Scale on pending requests rather than pure GPU utilization for latency-sensitive workloads

## Optimization Tips

- **Quantization**: Use quantized models (GPTQ, AWQ) to reduce GPU memory and increase throughput
- **Batching**: Configure model server batch size for throughput vs latency trade-off
- **Tensor parallelism**: Split large models across multiple GPUs within a node
- **KV cache optimization**: Tune `--gpu-memory-utilization` in vLLM for KV cache allocation

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Invalid model/accelerator combination | Unsupported tuple | Re-run `gcloud container ai profiles list --model=<MODEL>` |
| GPU quota exceeded | Regional quota limit | Request quota increase or try a different region |
| OOM on GPU | Model too large for accelerator | Use larger GPU, enable quantization, or use tensor parallelism |
| Slow cold start | Large model loading from registry | Use local SSD for model caching; pre-pull images |
