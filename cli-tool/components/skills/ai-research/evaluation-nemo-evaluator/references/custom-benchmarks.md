# Custom Benchmark Integration

NeMo Evaluator supports adding custom benchmarks through Framework Definition Files (FDFs) and custom containers.

## Overview

Custom benchmarks are added by:

1. **Framework Definition Files (FDFs)**: YAML files that define evaluation tasks, commands, and output parsing
2. **Custom Containers**: Package your framework with nemo-evaluator for reproducible execution

> **Note**: NeMo Evaluator does not currently support programmatic harness APIs or custom metric implementations via Python classes. Customization is done through FDFs and containers.

## Framework Definition Files (FDFs)

FDFs are the primary way to add custom evaluations. An FDF declares framework metadata, default commands, and evaluation tasks.

### FDF Structure

```yaml
# framework_def.yaml
framework:
  name: my-custom-framework
  package_name: my_custom_eval

defaults:
  command: "python -m my_custom_eval.run --model-id {model_id} --task {task} --output-dir {output_dir}"

evaluations:
  - name: custom_task_1
    defaults:
      temperature: 0.0
      max_new_tokens: 512
      extra:
        custom_param: value

  - name: custom_task_2
    defaults:
      temperature: 0.7
      max_new_tokens: 1024
```

### Key FDF Components

**Framework section**:
- `name`: Human-readable name for your framework
- `package_name`: Python package name

**Defaults section**:
- `command`: The command template to execute your evaluation
- Placeholders: `{model_id}`, `{task}`, `{output_dir}` are substituted at runtime

**Evaluations section**:
- List of tasks with their default parameters
- Each task can override the framework defaults

### Output Parser

When creating a custom FDF, you need an output parser function that translates your framework's results into NeMo Evaluator's standard schema:

```python
# my_custom_eval/parser.py
def parse_output(output_dir: str) -> dict:
    """
    Parse evaluation results from output_dir.

    Returns dict with metrics in NeMo Evaluator format.
    """
    # Read your framework's output files
    results_file = Path(output_dir) / "results.json"
    with open(results_file) as f:
        raw_results = json.load(f)

    # Transform to standard schema
    return {
        "metrics": {
            "accuracy": raw_results["score"],
            "total_samples": raw_results["num_samples"]
        }
    }
```

## Custom Container Creation

Package your custom framework as a container for reproducibility.

### Dockerfile Example

```dockerfile
# Dockerfile
FROM python:3.10-slim

# Install nemo-evaluator
RUN pip install nemo-evaluator

# Install your custom framework
COPY my_custom_eval/ /opt/my_custom_eval/
RUN pip install /opt/my_custom_eval/

# Copy framework definition
COPY framework_def.yaml /opt/framework_def.yaml

# Set working directory
WORKDIR /opt

ENTRYPOINT ["python", "-m", "nemo_evaluator"]
```

### Build and Push

```bash
docker build -t my-registry/custom-eval:1.0 .
docker push my-registry/custom-eval:1.0
```

### Register in mapping.toml

Add your custom container to the task registry:

```toml
# Add to mapping.toml
[my-custom-framework]
container = "my-registry/custom-eval:1.0"

[my-custom-framework.tasks.chat.custom_task_1]
required_env_vars = []

[my-custom-framework.tasks.chat.custom_task_2]
required_env_vars = ["CUSTOM_API_KEY"]
```

## Using Custom Datasets

### Dataset Mounting

Mount proprietary datasets at runtime rather than baking them into containers:

```yaml
# config.yaml
defaults:
  - execution: local
  - deployment: none
  - _self_

execution:
  output_dir: ./results

evaluation:
  tasks:
    - name: custom_task_1
      dataset_dir: /path/to/local/data
      dataset_mount_path: /data  # Optional, defaults to /datasets
```

The launcher will mount the dataset directory into the container and set `NEMO_EVALUATOR_DATASET_DIR` environment variable.

### Task-Specific Environment Variables

Pass environment variables to specific tasks:

```yaml
evaluation:
  tasks:
    - name: gpqa_diamond
      env_vars:
        HF_TOKEN: HF_TOKEN  # Maps to $HF_TOKEN from host

    - name: custom_task
      env_vars:
        CUSTOM_API_KEY: MY_CUSTOM_KEY
        DATA_PATH: /data/custom.jsonl
```

## Parameter Overrides

Override evaluation parameters at multiple levels:

### Global Overrides

Apply to all tasks:

```yaml
evaluation:
  nemo_evaluator_config:
    config:
      params:
        temperature: 0.0
        max_new_tokens: 512
        parallelism: 4
        request_timeout: 300
```

### Task-Specific Overrides

Override for individual tasks:

```yaml
evaluation:
  tasks:
    - name: humaneval
      nemo_evaluator_config:
        config:
          params:
            temperature: 0.8
            max_new_tokens: 1024
            n_samples: 200  # Task-specific parameter
```

### CLI Overrides

Override at runtime:

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name config \
  -o +evaluation.nemo_evaluator_config.config.params.limit_samples=10
```

## Testing Custom Benchmarks

### Dry Run

Validate configuration without execution:

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name custom_config \
  --dry-run
```

### Limited Sample Testing

Test with a small subset first:

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name custom_config \
  -o +evaluation.nemo_evaluator_config.config.params.limit_samples=5
```

### Check Results

```bash
# View results
cat results/<invocation_id>/<task>/artifacts/results.json

# Check logs
cat results/<invocation_id>/<task>/artifacts/logs/eval.log
```

## Best Practices

1. **Use FDFs**: Define custom benchmarks via Framework Definition Files
2. **Containerize**: Package frameworks as containers for reproducibility
3. **Mount data**: Use volume mounts for datasets instead of baking into images
4. **Test incrementally**: Use `limit_samples` for quick validation
5. **Version containers**: Tag containers with semantic versions
6. **Document parameters**: Include clear documentation in your FDF

## Limitations

Currently **not supported**:
- Custom Python metric classes via plugin system
- Programmatic harness registration via Python API
- Runtime metric injection via configuration

Custom scoring logic must be implemented within your evaluation framework and exposed through the FDF's output parser.

## Example: Complete Custom Setup

```yaml
# custom_eval_config.yaml
defaults:
  - execution: local
  - deployment: none
  - _self_

execution:
  output_dir: ./custom_results

target:
  api_endpoint:
    model_id: my-model
    url: http://localhost:8000/v1/chat/completions
    api_key_name: ""

evaluation:
  nemo_evaluator_config:
    config:
      params:
        parallelism: 4
        request_timeout: 300

  tasks:
    - name: custom_task_1
      dataset_dir: /data/benchmarks
      env_vars:
        DATA_VERSION: v2
      nemo_evaluator_config:
        config:
          params:
            temperature: 0.0
            max_new_tokens: 256
```

Run with:

```bash
nemo-evaluator-launcher run \
  --config-dir . \
  --config-name custom_eval_config
```
