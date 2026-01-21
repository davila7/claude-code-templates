# Phoenix Advanced Usage Guide

## Custom Evaluators

### Template-Based Evaluators

```python
from phoenix.evals import OpenAIModel, llm_classify

eval_model = OpenAIModel(model="gpt-4o")

# Custom template for specific evaluation
CUSTOM_EVAL_TEMPLATE = """
You are evaluating an AI assistant's response.

User Query: {input}
AI Response: {output}
Reference Answer: {reference}

Evaluate the response on these criteria:
1. Accuracy: Is the information correct?
2. Completeness: Does it fully answer the question?
3. Clarity: Is it easy to understand?

Provide a score from 1-5 and explain your reasoning.
Format: SCORE: [1-5]\nREASONING: [explanation]
"""

def custom_evaluator(input_text, output_text, reference_text):
    result = llm_classify(
        model=eval_model,
        template=CUSTOM_EVAL_TEMPLATE,
        input=input_text,
        output=output_text,
        reference=reference_text,
        rails=["1", "2", "3", "4", "5"]
    )
    return {
        "score": float(result.label) / 5.0,
        "label": result.label,
        "explanation": result.explanation
    }
```

### Multi-Criteria Evaluator

```python
from phoenix.evals import OpenAIModel, llm_classify
from dataclasses import dataclass
from typing import List

@dataclass
class EvaluationResult:
    criteria: str
    score: float
    label: str
    explanation: str

def multi_criteria_evaluator(input_text, output_text, criteria: List[str]):
    """Evaluate output against multiple criteria."""
    results = []

    for criterion in criteria:
        template = f"""
        Evaluate the following response for {criterion}.

        Input: {{input}}
        Output: {{output}}

        Is this response good in terms of {criterion}?
        Answer 'good', 'acceptable', or 'poor'.
        """

        result = llm_classify(
            model=eval_model,
            template=template,
            input=input_text,
            output=output_text,
            rails=["good", "acceptable", "poor"]
        )

        score_map = {"good": 1.0, "acceptable": 0.5, "poor": 0.0}
        results.append(EvaluationResult(
            criteria=criterion,
            score=score_map.get(result.label, 0.5),
            label=result.label,
            explanation=result.explanation
        ))

    return results

# Usage
results = multi_criteria_evaluator(
    input_text="What is Python?",
    output_text="Python is a programming language...",
    criteria=["accuracy", "completeness", "helpfulness"]
)
```

### Batch Evaluation with Concurrency

```python
from phoenix.evals import run_evals, OpenAIModel
from phoenix import Client
import asyncio

client = Client()
eval_model = OpenAIModel(model="gpt-4o")

# Get spans to evaluate
spans_df = client.get_spans_dataframe(
    project_name="production",
    filter_condition="span_kind == 'LLM'",
    limit=1000
)

# Run evaluations with concurrency control
eval_results = run_evals(
    dataframe=spans_df,
    evaluators=[
        HallucinationEvaluator(eval_model),
        RelevanceEvaluator(eval_model),
        ToxicityEvaluator(eval_model)
    ],
    provide_explanation=True,
    concurrency=10  # Control parallel evaluations
)

# Log results back to Phoenix
client.log_evaluations(eval_results)
```

## Advanced Experiments

### A/B Testing Prompts

```python
from phoenix import Client
from phoenix.experiments import run_experiment

client = Client()

# Define prompt variants
PROMPT_A = """
Answer the following question concisely:
{question}
"""

PROMPT_B = """
You are a helpful assistant. Please provide a detailed answer to:
{question}

Include relevant examples if applicable.
"""

def create_model_with_prompt(prompt_template):
    def model_fn(input_data):
        from openai import OpenAI
        client = OpenAI()

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": prompt_template.format(**input_data)
            }]
        )
        return {"answer": response.choices[0].message.content}
    return model_fn

# Run experiments for each variant
results_a = run_experiment(
    dataset_name="qa-test-set",
    task=create_model_with_prompt(PROMPT_A),
    evaluators=[accuracy_evaluator, helpfulness_evaluator],
    experiment_name="prompt-variant-a"
)

results_b = run_experiment(
    dataset_name="qa-test-set",
    task=create_model_with_prompt(PROMPT_B),
    evaluators=[accuracy_evaluator, helpfulness_evaluator],
    experiment_name="prompt-variant-b"
)

# Compare results
print(f"Variant A accuracy: {results_a.aggregate_metrics['accuracy']}")
print(f"Variant B accuracy: {results_b.aggregate_metrics['accuracy']}")
```

### Model Comparison Experiment

```python
from phoenix.experiments import run_experiment

MODELS = ["gpt-4o", "gpt-4o-mini", "claude-3-sonnet"]

def create_model_fn(model_name):
    def model_fn(input_data):
        if "gpt" in model_name:
            from openai import OpenAI
            client = OpenAI()
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": input_data["question"]}]
            )
            return {"answer": response.choices[0].message.content}
        elif "claude" in model_name:
            from anthropic import Anthropic
            client = Anthropic()
            response = client.messages.create(
                model=model_name,
                max_tokens=1024,
                messages=[{"role": "user", "content": input_data["question"]}]
            )
            return {"answer": response.content[0].text}
    return model_fn

# Run experiments for each model
all_results = {}
for model in MODELS:
    results = run_experiment(
        dataset_name="qa-test-set",
        task=create_model_fn(model),
        evaluators=[quality_evaluator, latency_evaluator],
        experiment_name=f"model-comparison-{model}"
    )
    all_results[model] = results

# Summary comparison
for model, results in all_results.items():
    print(f"{model}: quality={results.aggregate_metrics['quality']:.2f}")
```

## Production Deployment

### Kubernetes Deployment

```yaml
# phoenix-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phoenix
spec:
  replicas: 1
  selector:
    matchLabels:
      app: phoenix
  template:
    metadata:
      labels:
        app: phoenix
    spec:
      containers:
      - name: phoenix
        image: arizephoenix/phoenix:latest
        ports:
        - containerPort: 6006
        - containerPort: 4317
        env:
        - name: PHOENIX_SQL_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: phoenix-secrets
              key: database-url
        - name: PHOENIX_ENABLE_AUTH
          value: "true"
        - name: PHOENIX_SECRET
          valueFrom:
            secretKeyRef:
              name: phoenix-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 6006
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 6006
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: phoenix
spec:
  selector:
    app: phoenix
  ports:
  - name: http
    port: 6006
    targetPort: 6006
  - name: grpc
    port: 4317
    targetPort: 4317
```

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
      - "4317:4317"
    environment:
      - PHOENIX_SQL_DATABASE_URL=postgresql://phoenix:phoenix@postgres:5432/phoenix
      - PHOENIX_ENABLE_AUTH=true
      - PHOENIX_SECRET=${PHOENIX_SECRET}
      - PHOENIX_HOST=0.0.0.0
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=phoenix
      - POSTGRES_PASSWORD=phoenix
      - POSTGRES_DB=phoenix
    volumes:
      - phoenix_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U phoenix"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  phoenix_data:
```

### High Availability Setup

```yaml
# phoenix-ha.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phoenix
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: phoenix
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - phoenix
              topologyKey: kubernetes.io/hostname
      containers:
      - name: phoenix
        image: arizephoenix/phoenix:latest
        env:
        - name: PHOENIX_SQL_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: phoenix-secrets
              key: database-url
```

## Advanced Tracing

### Custom Span Attributes

```python
from opentelemetry import trace
from phoenix.otel import register

tracer_provider = register(project_name="my-app")
tracer = trace.get_tracer(__name__)

def process_request(user_id: str, query: str):
    with tracer.start_as_current_span("process_request") as span:
        # Add custom attributes
        span.set_attribute("user.id", user_id)
        span.set_attribute("input.value", query)
        span.set_attribute("custom.priority", "high")

        # Process and add output
        result = do_processing(query)
        span.set_attribute("output.value", result)
        span.set_attribute("output.tokens", count_tokens(result))

        return result
```

### Distributed Tracing

```python
from opentelemetry import trace
from opentelemetry.propagate import inject, extract

# Service A: Inject trace context
def call_service_b(request_data):
    headers = {}
    inject(headers)  # Inject trace context into headers

    response = requests.post(
        "http://service-b/process",
        json=request_data,
        headers=headers
    )
    return response.json()

# Service B: Extract trace context
from flask import Flask, request

app = Flask(__name__)

@app.route("/process", methods=["POST"])
def process():
    # Extract trace context from incoming request
    context = extract(request.headers)

    with tracer.start_as_current_span("service_b_process", context=context):
        # Continue the trace
        result = process_data(request.json)
        return {"result": result}
```

### Session Tracking

```python
from phoenix.otel import register
from opentelemetry import trace

tracer_provider = register(project_name="chatbot")
tracer = trace.get_tracer(__name__)

def handle_conversation(session_id: str, user_message: str):
    with tracer.start_as_current_span("conversation_turn") as span:
        # Add session context
        span.set_attribute("session.id", session_id)
        span.set_attribute("input.value", user_message)

        # Get conversation history
        history = get_session_history(session_id)
        span.set_attribute("conversation.turn_count", len(history))

        # Generate response
        response = generate_response(history + [user_message])
        span.set_attribute("output.value", response)

        # Save to history
        save_to_history(session_id, user_message, response)

        return response
```

## Data Management

### Export and Backup

```python
from phoenix import Client
import pandas as pd
from datetime import datetime, timedelta

client = Client()

def export_project_data(project_name: str, days: int = 30):
    """Export project data for backup."""
    # Get spans
    spans_df = client.get_spans_dataframe(
        project_name=project_name,
        start_time=datetime.now() - timedelta(days=days)
    )

    # Get evaluations
    evals_df = client.get_evaluations(project_name=project_name)

    # Save to files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    spans_df.to_parquet(f"backup/{project_name}_spans_{timestamp}.parquet")
    evals_df.to_parquet(f"backup/{project_name}_evals_{timestamp}.parquet")

    return spans_df, evals_df

# Export data
export_project_data("production", days=7)
```

### Data Retention Policy

```python
from phoenix import Client
from datetime import datetime, timedelta

client = Client()

def cleanup_old_data(project_name: str, retention_days: int = 90):
    """Delete data older than retention period."""
    cutoff_date = datetime.now() - timedelta(days=retention_days)

    # Get old traces
    old_spans = client.get_spans_dataframe(
        project_name=project_name,
        end_time=cutoff_date
    )

    # Delete old traces
    trace_ids = old_spans["trace_id"].unique()
    for trace_id in trace_ids:
        client.delete_trace(trace_id=trace_id)

    print(f"Deleted {len(trace_ids)} traces older than {retention_days} days")

# Run cleanup
cleanup_old_data("production", retention_days=90)
```

## Integration Patterns

### CI/CD Evaluation Pipeline

```python
# evaluate_in_ci.py
import sys
from phoenix import Client
from phoenix.experiments import run_experiment

def run_ci_evaluation():
    client = Client(endpoint="https://phoenix.company.com")

    results = run_experiment(
        dataset_name="regression-test-set",
        task=my_model,
        evaluators=[
            accuracy_evaluator,
            hallucination_evaluator,
            latency_evaluator
        ],
        experiment_name=f"ci-{os.environ['CI_COMMIT_SHA'][:8]}"
    )

    # Check thresholds
    if results.aggregate_metrics['accuracy'] < 0.9:
        print(f"FAIL: Accuracy {results.aggregate_metrics['accuracy']:.2f} < 0.9")
        sys.exit(1)

    if results.aggregate_metrics['hallucination_rate'] > 0.05:
        print(f"FAIL: Hallucination rate too high")
        sys.exit(1)

    print("PASS: All evaluation thresholds met")
    sys.exit(0)

if __name__ == "__main__":
    run_ci_evaluation()
```

### Alerting Integration

```python
from phoenix import Client
import requests

def check_and_alert():
    client = Client()

    # Get recent error rate
    spans_df = client.get_spans_dataframe(
        project_name="production",
        filter_condition="status_code == 'ERROR'",
        start_time=datetime.now() - timedelta(hours=1)
    )

    total_spans = client.get_spans_dataframe(
        project_name="production",
        start_time=datetime.now() - timedelta(hours=1)
    )

    error_rate = len(spans_df) / max(len(total_spans), 1)

    if error_rate > 0.05:  # 5% threshold
        # Send Slack alert
        requests.post(
            os.environ["SLACK_WEBHOOK_URL"],
            json={
                "text": f"🚨 High error rate in production: {error_rate:.1%}",
                "channel": "#alerts"
            }
        )

# Run periodically
check_and_alert()
```
