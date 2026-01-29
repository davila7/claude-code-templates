# Configuration Reference

NeMo Evaluator uses Hydra for configuration management with a hierarchical override system.

## Configuration Structure

```yaml
# Complete configuration structure
defaults:
  - execution: local      # Execution backend
  - deployment: none      # Model deployment method
  - _self_

execution:
  # Executor-specific settings
  output_dir: ./results
  mode: sequential

target:
  # Model endpoint settings
  api_endpoint:
    model_id: model-name
    url: http://endpoint/v1/chat/completions
    api_key_name: API_KEY
    type: chat  # chat, completions, vlm, embedding
    adapter_config:
      interceptors: []

evaluation:
  # Global evaluation settings
  nemo_evaluator_config:
    config:
      params:
        temperature: 0.0
        parallelism: 4

  # Task list
  tasks:
    - name: task_name
      env_vars: {}
      nemo_evaluator_config: {}  # Per-task overrides
```

## Configuration Sections

### Defaults Section

Selects base configurations for execution and deployment:

```yaml
defaults:
  - execution: local    # Options: local, slurm, lepton
  - deployment: none    # Options: none, vllm, sglang, nim
  - _self_
```

Available execution configs:
- `local` - Docker-based local execution
- `slurm` - HPC cluster via SSH/sbatch
- `lepton` - Lepton AI cloud platform

Available deployment configs:
- `none` - Evaluate existing endpoint
- `vllm` - Deploy model with vLLM
- `sglang` - Deploy model with SGLang
- `nim` - Deploy model with NVIDIA NIM

### Execution Section

Controls how and where evaluations run:

```yaml
execution:
  # Common settings
  output_dir: ./results     # Where to write results
  mode: sequential          # sequential or parallel

  # Local executor specific
  docker_args:
    - "--gpus=all"
    - "--shm-size=16g"
  memory_limit: "64g"
  cpus: 8

  # Slurm executor specific
  hostname: cluster.example.com
  account: my_account
  partition: gpu
  qos: normal
  nodes: 1
  gpus_per_node: 8
  walltime: "04:00:00"

  # Lepton executor specific
  resource_shape: gpu.a100-80g
  num_replicas: 1
```

### Target Section

Specifies the model endpoint to evaluate:

```yaml
target:
  api_endpoint:
    # Required fields
    model_id: meta/llama-3.1-8b-instruct
    url: https://integrate.api.nvidia.com/v1/chat/completions
    api_key_name: NGC_API_KEY  # Environment variable name

    # Optional fields
    type: chat           # chat, completions, vlm, embedding
    timeout: 300         # Request timeout in seconds
    max_retries: 3       # Retry count for failed requests

    # Adapter configuration
    adapter_config:
      interceptors:
        - name: system_message
          config:
            system_message: "You are a helpful assistant."
        - name: caching
          config:
            cache_dir: "./cache"
        - name: reasoning
          config:
            start_reasoning_token: "<think>"
            end_reasoning_token: "</think>"
```

### Evaluation Section

Configures tasks and evaluation parameters:

```yaml
evaluation:
  # Global parameters (apply to all tasks)
  nemo_evaluator_config:
    config:
      params:
        temperature: 0.0          # Sampling temperature
        max_new_tokens: 512       # Max generation length
        parallelism: 4            # Concurrent requests
        limit_samples: null       # Limit samples (null = all)
        num_fewshot: 5            # Few-shot examples
        random_seed: 42           # Random seed

  # Task list
  tasks:
    - name: ifeval

    - name: gpqa_diamond
      env_vars:
        HF_TOKEN: HF_TOKEN  # Task-specific env vars

    - name: gsm8k_cot_instruct
      nemo_evaluator_config:  # Task-specific overrides
        config:
          params:
            temperature: 0.0
            max_new_tokens: 1024
```

## Configuration Override Precedence

Configurations are resolved in this order (highest to lowest):

1. **CLI overrides**: `-o key=value`
2. **Task-specific** `nemo_evaluator_config`
3. **Global** `evaluation.nemo_evaluator_config`
4. **Framework defaults** (in container)
5. **System defaults**

## CLI Override Syntax

### Basic Overrides

```bash
# Override simple values
-o execution.output_dir=/custom/path
-o target.api_endpoint.model_id=my-model

# Override nested values
-o target.api_endpoint.adapter_config.interceptors[0].name=logging
```

### Adding New Values

Use `+` prefix to add values not in base config:

```bash
# Add evaluation parameter
-o +evaluation.nemo_evaluator_config.config.params.limit_samples=100

# Add environment variable
-o +target.api_endpoint.env_vars.CUSTOM_VAR=value
```

### Complex Values

```bash
# Override list/array
-o 'evaluation.tasks=[{name: ifeval}, {name: gsm8k}]'

# Override with special characters (use quotes)
-o 'target.api_endpoint.url="http://localhost:8000/v1/chat/completions"'
```

### Multi-Override

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name config \
  -o execution.output_dir=/results \
  -o target.api_endpoint.model_id=my-model \
  -o +evaluation.nemo_evaluator_config.config.params.parallelism=8 \
  -o +evaluation.nemo_evaluator_config.config.params.limit_samples=10
```

## Task Configuration

### Task Discovery

List available tasks and their requirements:

```bash
# List all tasks
nemo-evaluator-launcher ls tasks

# Output includes:
# - Task name
# - Container image
# - Endpoint type (chat/completions/vlm)
# - Required environment variables
```

### Task Environment Variables

Some tasks require specific environment variables:

| Task | Required Env Vars |
|------|------------------|
| `gpqa_diamond` | `HF_TOKEN` |
| `mmlu` | `HF_TOKEN` |
| `math_test_500_nemo` | `JUDGE_API_KEY` |
| `aime` | `JUDGE_API_KEY` |
| `slidevqa` | `OPENAI_CLIENT_ID`, `OPENAI_CLIENT_SECRET` |

Configure in task definition:

```yaml
evaluation:
  tasks:
    - name: gpqa_diamond
      env_vars:
        HF_TOKEN: HF_TOKEN  # Maps to $HF_TOKEN from environment

    - name: math_test_500_nemo
      env_vars:
        JUDGE_API_KEY: MY_JUDGE_KEY  # Maps to $MY_JUDGE_KEY
```

### Task-Specific Parameters

Override parameters for specific tasks:

```yaml
evaluation:
  nemo_evaluator_config:
    config:
      params:
        temperature: 0.0  # Global default

  tasks:
    - name: ifeval
      # Uses global temperature: 0.0

    - name: humaneval
      nemo_evaluator_config:
        config:
          params:
            temperature: 0.8    # Override for code generation
            max_new_tokens: 1024
            n_samples: 200      # Multiple samples for pass@k
```

## Adapter Configuration

Adapters intercept and process requests/responses:

```yaml
target:
  api_endpoint:
    adapter_config:
      # Request interceptors (before API call)
      interceptors:
        - name: system_message
          config:
            system_message: "You are a helpful assistant."

        - name: request_logging
          config:
            max_logged_requests: 100
            log_path: "./logs/requests.jsonl"

        - name: caching
          config:
            cache_dir: "./cache"
            cache_ttl: 3600

      # Response interceptors (after API call)
        - name: reasoning
          config:
            start_reasoning_token: "<think>"
            end_reasoning_token: "</think>"
            strip_reasoning: true

        - name: response_logging
          config:
            max_logged_responses: 100

      # Error handling
      log_failed_requests: true
      retry_on_failure: true
      max_retries: 3
```

## Example Configurations

### Minimal Local Evaluation

```yaml
defaults:
  - execution: local
  - deployment: none
  - _self_

execution:
  output_dir: ./results

target:
  api_endpoint:
    model_id: meta/llama-3.1-8b-instruct
    url: https://integrate.api.nvidia.com/v1/chat/completions
    api_key_name: NGC_API_KEY

evaluation:
  tasks:
    - name: ifeval
```

### Production Slurm Evaluation

```yaml
defaults:
  - execution: slurm
  - deployment: vllm
  - _self_

execution:
  hostname: cluster.example.com
  account: research_account
  partition: gpu
  nodes: 2
  gpus_per_node: 8
  walltime: "08:00:00"
  output_dir: /shared/results/$(date +%Y%m%d)

deployment:
  checkpoint_path: /models/llama-3.1-70b
  tensor_parallel_size: 8
  data_parallel_size: 2
  max_model_len: 8192

evaluation:
  nemo_evaluator_config:
    config:
      params:
        parallelism: 16
        temperature: 0.0
  tasks:
    - name: mmlu_pro
    - name: gsm8k_cot_instruct
    - name: ifeval
    - name: gpqa_diamond
      env_vars:
        HF_TOKEN: HF_TOKEN
```

### Quick Testing Configuration

```yaml
defaults:
  - execution: local
  - deployment: none
  - _self_

execution:
  output_dir: ./test_results

target:
  api_endpoint:
    model_id: meta/llama-3.1-8b-instruct
    url: https://integrate.api.nvidia.com/v1/chat/completions
    api_key_name: NGC_API_KEY

evaluation:
  nemo_evaluator_config:
    config:
      params:
        limit_samples: 10  # Only 10 samples per task
        parallelism: 2
  tasks:
    - name: ifeval
    - name: gsm8k_cot_instruct
```

## Validation

### Dry Run

Validate configuration without execution:

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name config \
  --dry-run
```

### Common Validation Errors

**Missing required field**:
```
ValidationError: target.api_endpoint.model_id is required
```

**Invalid task name**:
```
TaskNotFoundError: Task 'invalid_task' not found in mapping.toml
```

**Missing environment variable**:
```
EnvVarError: Task 'gpqa_diamond' requires HF_TOKEN but it is not set
```
