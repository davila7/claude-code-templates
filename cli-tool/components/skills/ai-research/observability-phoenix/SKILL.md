---
name: phoenix-observability
description: Open-source AI observability platform for LLM tracing, evaluation, and monitoring. Use when debugging LLM applications with detailed traces, running evaluations on datasets, or monitoring production AI systems with real-time insights.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Observability, Phoenix, Arize, Tracing, Evaluation, Monitoring, LLM Ops, OpenTelemetry]
dependencies: [arize-phoenix>=12.0.0]
---

# Phoenix - AI Observability Platform

Open-source AI observability and evaluation platform for LLM applications with tracing, evaluation, datasets, experiments, and real-time monitoring.

## When to use Phoenix

**Use Phoenix when:**
- Debugging LLM application issues with detailed traces
- Running systematic evaluations on datasets
- Monitoring production LLM systems in real-time
- Building experiment pipelines for prompt/model comparison
- Self-hosted observability without vendor lock-in

**Key features:**
- **Tracing**: OpenTelemetry-based trace collection for any LLM framework
- **Evaluation**: LLM-as-judge evaluators for quality assessment
- **Datasets**: Versioned test sets for regression testing
- **Experiments**: Compare prompts, models, and configurations
- **Playground**: Interactive prompt testing with multiple models
- **Open-source**: Self-hosted with PostgreSQL or SQLite

**Use alternatives instead:**
- **LangSmith**: Managed platform with LangChain-first integration
- **Weights & Biases**: Deep learning experiment tracking focus
- **Arize Cloud**: Managed Phoenix with enterprise features
- **MLflow**: General ML lifecycle, model registry focus

## Quick start

### Installation

```bash
pip install arize-phoenix

# With specific backends
pip install arize-phoenix[embeddings]  # Embedding analysis
pip install arize-phoenix-otel         # OpenTelemetry config
pip install arize-phoenix-evals        # Evaluation framework
pip install arize-phoenix-client       # Lightweight REST client
```

### Launch Phoenix server

```python
import phoenix as px

# Launch in notebook (ThreadServer mode)
session = px.launch_app()

# View UI
session.view()  # Embedded iframe
print(session.url)  # http://localhost:6006
```

### Command-line server (production)

```bash
# Start Phoenix server
phoenix serve

# With PostgreSQL
export PHOENIX_SQL_DATABASE_URL="postgresql://user:pass@host/db"
phoenix serve --port 6006
```

### Basic tracing

```python
from phoenix.otel import register
from openinference.instrumentation.openai import OpenAIInstrumentor

# Configure OpenTelemetry with Phoenix
tracer_provider = register(
    project_name="my-llm-app",
    endpoint="http://localhost:6006/v1/traces"
)

# Instrument OpenAI SDK
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# All OpenAI calls are now traced
from openai import OpenAI
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Core concepts

### Traces and spans

A **trace** represents a complete execution flow, while **spans** are individual operations within that trace.

```python
from phoenix.otel import register
from opentelemetry import trace

# Setup tracing
tracer_provider = register(project_name="my-app")
tracer = trace.get_tracer(__name__)

# Create custom spans
with tracer.start_as_current_span("process_query") as span:
    span.set_attribute("input.value", query)

    # Child spans are automatically nested
    with tracer.start_as_current_span("retrieve_context"):
        context = retriever.search(query)

    with tracer.start_as_current_span("generate_response"):
        response = llm.generate(query, context)

    span.set_attribute("output.value", response)
```

### Projects

Projects organize related traces:

```python
import os
os.environ["PHOENIX_PROJECT_NAME"] = "production-chatbot"

# Or per-trace
from phoenix.otel import register
tracer_provider = register(project_name="experiment-v2")
```

## Framework instrumentation

### OpenAI

```python
from phoenix.otel import register
from openinference.instrumentation.openai import OpenAIInstrumentor

tracer_provider = register()
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

### LangChain

```python
from phoenix.otel import register
from openinference.instrumentation.langchain import LangChainInstrumentor

tracer_provider = register()
LangChainInstrumentor().instrument(tracer_provider=tracer_provider)

# All LangChain operations traced
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o")
response = llm.invoke("Hello!")
```

### LlamaIndex

```python
from phoenix.otel import register
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor

tracer_provider = register()
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
```

### Anthropic

```python
from phoenix.otel import register
from openinference.instrumentation.anthropic import AnthropicInstrumentor

tracer_provider = register()
AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Evaluation framework

### Built-in evaluators

```python
from phoenix.evals import (
    OpenAIModel,
    HallucinationEvaluator,
    RelevanceEvaluator,
    ToxicityEvaluator,
    llm_classify
)

# Setup model for evaluation
eval_model = OpenAIModel(model="gpt-4o")

# Evaluate hallucination
hallucination_eval = HallucinationEvaluator(eval_model)
results = hallucination_eval.evaluate(
    input="What is the capital of France?",
    output="The capital of France is Paris.",
    reference="Paris is the capital of France."
)
```

### Custom evaluators

```python
from phoenix.evals import llm_classify

# Define custom evaluation
def evaluate_helpfulness(input_text, output_text):
    template = """
    Evaluate if the response is helpful for the given question.

    Question: {input}
    Response: {output}

    Is this response helpful? Answer 'helpful' or 'not_helpful'.
    """

    result = llm_classify(
        model=eval_model,
        template=template,
        input=input_text,
        output=output_text,
        rails=["helpful", "not_helpful"]
    )
    return result
```

### Run evaluations on dataset

```python
from phoenix import Client
from phoenix.evals import run_evals

client = Client()

# Get spans to evaluate
spans_df = client.get_spans_dataframe(
    project_name="my-app",
    filter_condition="span_kind == 'LLM'"
)

# Run evaluations
eval_results = run_evals(
    dataframe=spans_df,
    evaluators=[
        HallucinationEvaluator(eval_model),
        RelevanceEvaluator(eval_model)
    ],
    provide_explanation=True
)

# Log results back to Phoenix
client.log_evaluations(eval_results)
```

## Datasets and experiments

### Create dataset

```python
from phoenix import Client

client = Client()

# Create dataset
dataset = client.create_dataset(
    name="qa-test-set",
    description="QA evaluation dataset"
)

# Add examples
client.add_examples_to_dataset(
    dataset_name="qa-test-set",
    examples=[
        {
            "input": {"question": "What is Python?"},
            "output": {"answer": "A programming language"}
        },
        {
            "input": {"question": "What is ML?"},
            "output": {"answer": "Machine learning"}
        }
    ]
)
```

### Run experiment

```python
from phoenix import Client
from phoenix.experiments import run_experiment

client = Client()

def my_model(input_data):
    """Your model function."""
    question = input_data["question"]
    return {"answer": generate_answer(question)}

def accuracy_evaluator(input_data, output, expected):
    """Custom evaluator."""
    return {
        "score": 1.0 if expected["answer"].lower() in output["answer"].lower() else 0.0,
        "label": "correct" if expected["answer"].lower() in output["answer"].lower() else "incorrect"
    }

# Run experiment
results = run_experiment(
    dataset_name="qa-test-set",
    task=my_model,
    evaluators=[accuracy_evaluator],
    experiment_name="baseline-v1"
)

print(f"Average accuracy: {results.aggregate_metrics['accuracy']}")
```

## Client API

### Query traces and spans

```python
from phoenix import Client

client = Client(endpoint="http://localhost:6006")

# Get spans as DataFrame
spans_df = client.get_spans_dataframe(
    project_name="my-app",
    filter_condition="span_kind == 'LLM'",
    limit=1000
)

# Get specific span
span = client.get_span(span_id="abc123")

# Get trace
trace = client.get_trace(trace_id="xyz789")
```

### Log feedback

```python
from phoenix import Client

client = Client()

# Log user feedback
client.log_annotation(
    span_id="abc123",
    name="user_rating",
    annotator_kind="HUMAN",
    score=0.8,
    label="helpful",
    metadata={"comment": "Good response"}
)
```

### Export data

```python
# Export to pandas
df = client.get_spans_dataframe(project_name="my-app")

# Export traces
traces = client.list_traces(project_name="my-app")
```

## Production deployment

### Docker

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

### With PostgreSQL

```bash
# Set database URL
export PHOENIX_SQL_DATABASE_URL="postgresql://user:pass@host:5432/phoenix"

# Start server
phoenix serve --host 0.0.0.0 --port 6006
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PHOENIX_PORT` | HTTP server port | `6006` |
| `PHOENIX_HOST` | Server bind address | `127.0.0.1` |
| `PHOENIX_GRPC_PORT` | gRPC/OTLP port | `4317` |
| `PHOENIX_SQL_DATABASE_URL` | Database connection | SQLite temp |
| `PHOENIX_WORKING_DIR` | Data storage directory | OS temp |
| `PHOENIX_ENABLE_AUTH` | Enable authentication | `false` |
| `PHOENIX_SECRET` | JWT signing secret | Required if auth enabled |

### With authentication

```bash
export PHOENIX_ENABLE_AUTH=true
export PHOENIX_SECRET="your-secret-key-min-32-chars"
export PHOENIX_ADMIN_SECRET="admin-bootstrap-token"

phoenix serve
```

## Best practices

1. **Use projects**: Separate traces by environment (dev/staging/prod)
2. **Add metadata**: Include user IDs, session IDs for debugging
3. **Evaluate regularly**: Run automated evaluations in CI/CD
4. **Version datasets**: Track test set changes over time
5. **Monitor costs**: Track token usage via Phoenix dashboards
6. **Self-host**: Use PostgreSQL for production deployments

## Common issues

**Traces not appearing:**
```python
from phoenix.otel import register

# Verify endpoint
tracer_provider = register(
    project_name="my-app",
    endpoint="http://localhost:6006/v1/traces"  # Correct endpoint
)

# Force flush
from opentelemetry import trace
trace.get_tracer_provider().force_flush()
```

**High memory in notebook:**
```python
# Close session when done
session = px.launch_app()
# ... do work ...
session.close()
px.close_app()
```

**Database connection issues:**
```bash
# Verify PostgreSQL connection
psql $PHOENIX_SQL_DATABASE_URL -c "SELECT 1"

# Check Phoenix logs
phoenix serve --log-level debug
```

## References

- **[Advanced Usage](references/advanced-usage.md)** - Custom evaluators, experiments, production setup
- **[Troubleshooting](references/troubleshooting.md)** - Common issues, debugging, performance

## Resources

- **Documentation**: https://docs.arize.com/phoenix
- **Repository**: https://github.com/Arize-ai/phoenix
- **Docker Hub**: https://hub.docker.com/r/arizephoenix/phoenix
- **Version**: 12.0.0+
- **License**: Apache 2.0
