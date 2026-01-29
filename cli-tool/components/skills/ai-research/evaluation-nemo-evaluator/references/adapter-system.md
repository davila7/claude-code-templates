# Adapter and Interceptor System

NeMo Evaluator uses an adapter system to process requests and responses between the evaluation engine and model endpoints. The `nemo-evaluator` core library provides built-in interceptors for common use cases.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                     Adapter Pipeline                           │
│                                                                │
│  Request  ───►  [Interceptor 1]  ───►  [Interceptor 2]  ───►  │
│                                                                │
│                              │                                 │
│                              ▼                                 │
│                  ┌───────────────────────────────────┐         │
│                  │      Endpoint Interceptor          │        │
│                  │   (HTTP call to Model API)         │        │
│                  └───────────────────────────────────┘         │
│                              │                                 │
│                              ▼                                 │
│  Response  ◄───  [Interceptor 3]  ◄───  [Interceptor 4]  ◄─── │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

Interceptors execute in order for requests, and in reverse order for responses.

## Configuring Adapters

The adapter configuration is specified in the `target.api_endpoint.adapter_config` section:

```yaml
target:
  api_endpoint:
    model_id: meta/llama-3.1-8b-instruct
    url: https://integrate.api.nvidia.com/v1/chat/completions
    api_key_name: NGC_API_KEY
    adapter_config:
      interceptors:
        - name: system_message
          config:
            system_message: "You are a helpful assistant."
        - name: caching
          config:
            cache_dir: "./cache"
        - name: endpoint
        - name: reasoning
          config:
            start_reasoning_token: "<think>"
            end_reasoning_token: "</think>"
```

## Available Interceptors

### System Message Interceptor

Injects a system prompt into chat requests.

```yaml
- name: system_message
  config:
    system_message: "You are a helpful AI assistant. Think step by step."
```

**Effect**: Prepends a system message to the messages array.

### Request Logging Interceptor

Logs outbound API requests for debugging and analysis.

```yaml
- name: request_logging
  config:
    max_requests: 1000
```

### Caching Interceptor

Caches responses to avoid repeated API calls for identical requests.

```yaml
- name: caching
  config:
    cache_dir: "./evaluation_cache"
    reuse_cached_responses: true
    save_requests: true
    save_responses: true
    max_saved_requests: 1000
    max_saved_responses: 1000
```

### Endpoint Interceptor

Performs the actual HTTP communication with the model endpoint. This is typically added automatically and has no configuration parameters.

```yaml
- name: endpoint
```

### Reasoning Interceptor

Extracts and removes reasoning tokens (e.g., `<think>` tags) from model responses.

```yaml
- name: reasoning
  config:
    start_reasoning_token: "<think>"
    end_reasoning_token: "</think>"
    enable_reasoning_tracking: true
```

**Effect**: Strips reasoning content from the response and tracks it separately.

### Response Logging Interceptor

Logs API responses.

```yaml
- name: response_logging
  config:
    max_responses: 1000
```

### Progress Tracking Interceptor

Reports evaluation progress to an external URL.

```yaml
- name: progress_tracking
  config:
    progress_tracking_url: "http://localhost:3828/progress"
    progress_tracking_interval: 10
```

### Additional Interceptors

Other available interceptors include:
- `payload_modifier`: Transforms request parameters
- `response_stats`: Collects aggregated statistics from responses
- `raise_client_errors`: Handles and raises exceptions for client errors (4xx)

## Interceptor Chain Example

A typical interceptor chain for evaluation:

```yaml
adapter_config:
  interceptors:
    # Pre-endpoint (request processing)
    - name: system_message
      config:
        system_message: "You are a helpful AI assistant."
    - name: request_logging
      config:
        max_requests: 50
    - name: caching
      config:
        cache_dir: "./evaluation_cache"
        reuse_cached_responses: true

    # Endpoint (HTTP call)
    - name: endpoint

    # Post-endpoint (response processing)
    - name: response_logging
      config:
        max_responses: 50
    - name: reasoning
      config:
        start_reasoning_token: "<think>"
        end_reasoning_token: "</think>"
```

## Python API Usage

You can also configure adapters programmatically:

```python
from nemo_evaluator.adapters.adapter_config import AdapterConfig, InterceptorConfig
from nemo_evaluator.api.api_dataclasses import ApiEndpoint, EndpointType

adapter_config = AdapterConfig(
    interceptors=[
        InterceptorConfig(
            name="system_message",
            config={"system_message": "You are a helpful assistant."}
        ),
        InterceptorConfig(
            name="caching",
            config={
                "cache_dir": "./cache",
                "reuse_cached_responses": True
            }
        ),
        InterceptorConfig(name="endpoint"),
        InterceptorConfig(
            name="reasoning",
            config={
                "start_reasoning_token": "<think>",
                "end_reasoning_token": "</think>"
            }
        )
    ]
)

api_endpoint = ApiEndpoint(
    url="http://localhost:8080/v1/chat/completions",
    type=EndpointType.CHAT,
    model_id="my_model",
    adapter_config=adapter_config
)
```

## OpenAI API Compatibility

NeMo Evaluator supports OpenAI-compatible endpoints with different endpoint types:

### Chat Completions

```yaml
target:
  api_endpoint:
    type: chat  # or omit, chat is default
    url: http://endpoint/v1/chat/completions
```

### Text Completions

```yaml
target:
  api_endpoint:
    type: completions
    url: http://endpoint/v1/completions
```

### Vision-Language Models

```yaml
target:
  api_endpoint:
    type: vlm
    url: http://endpoint/v1/chat/completions
```

## Error Handling

Configure error handling via the `log_failed_requests` option:

```yaml
adapter_config:
  log_failed_requests: true
  interceptors:
    - name: raise_client_errors
    # ... other interceptors
```

## Debugging

### Enable Logging Interceptors

Add request and response logging to debug issues:

```yaml
adapter_config:
  interceptors:
    - name: request_logging
      config:
        max_requests: 100
    - name: endpoint
    - name: response_logging
      config:
        max_responses: 100
```

### Common Issues

**Issue: System message not applied**

Ensure the `system_message` interceptor is listed before the `endpoint` interceptor.

**Issue: Cache not being used**

Check that `reuse_cached_responses: true` is set and the cache directory exists:
```yaml
- name: caching
  config:
    cache_dir: "./cache"
    reuse_cached_responses: true
```

**Issue: Reasoning tokens not extracted**

Verify the token patterns match your model's output format:
```yaml
- name: reasoning
  config:
    start_reasoning_token: "<think>"  # Must match model output exactly
    end_reasoning_token: "</think>"
```

## Custom Interceptor Discovery

NeMo Evaluator supports discovering custom interceptors via the `DiscoveryConfig` within `AdapterConfig`. You can specify modules or directories where your custom interceptors are located:

```yaml
adapter_config:
  discovery:
    modules:
      - "my_custom.interceptors"
      - "my_package.adapters"
    dirs:
      - "/path/to/custom/interceptors"
  interceptors:
    - name: my_custom_interceptor
      config:
        custom_option: value
```

Custom interceptors must implement the standard interceptor interface expected by `nemo-evaluator`.

## Additional AdapterConfig Options

Beyond interceptors, `AdapterConfig` supports these additional fields:

| Field | Description |
|-------|-------------|
| `discovery` | Configure custom interceptor discovery |
| `post_eval_hooks` | List of hooks to run after evaluation |
| `endpoint_type` | Default endpoint type (e.g., "chat") |
| `caching_dir` | Legacy option for response caching |
| `generate_html_report` | Generate HTML report of results |
| `log_failed_requests` | Log requests that fail |
| `tracking_requests_stats` | Enable request statistics |
| `html_report_size` | Number of request-response pairs in report |

## Notes

- The interceptor chain order matters - request interceptors run in order, response interceptors run in reverse
- Interceptors can be enabled/disabled via the `enabled` field in `InterceptorConfig`
- For complex custom logic, consider packaging as a custom container with your interceptors pre-installed
