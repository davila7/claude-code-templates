---
name: langsmith-observability
description: LLM observability platform for tracing, evaluation, and monitoring. Use when debugging LLM applications, evaluating model outputs against datasets, monitoring production systems, or building systematic testing pipelines for AI applications.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Observability, LangSmith, Tracing, Evaluation, Monitoring, Debugging, Testing, LLM Ops, Production]
dependencies: [langsmith>=0.2.0]
---

# LangSmith - LLM Observability Platform

Development platform for debugging, evaluating, and monitoring language models and AI applications.

## When to use LangSmith

**Use LangSmith when:**
- Debugging LLM application issues (prompts, chains, agents)
- Evaluating model outputs systematically against datasets
- Monitoring production LLM systems
- Building regression testing for AI features
- Analyzing latency, token usage, and costs
- Collaborating on prompt engineering

**Key features:**
- **Tracing**: Capture inputs, outputs, latency for all LLM calls
- **Evaluation**: Systematic testing with built-in and custom evaluators
- **Datasets**: Create test sets from production traces or manually
- **Monitoring**: Track metrics, errors, and costs in production
- **Integrations**: Works with OpenAI, Anthropic, LangChain, LlamaIndex

**Use alternatives instead:**
- **Weights & Biases**: Deep learning experiment tracking, model training
- **MLflow**: General ML lifecycle, model registry focus
- **Arize/WhyLabs**: ML monitoring, data drift detection

## Quick start

### Installation

```bash
pip install langsmith

# Set environment variables
export LANGSMITH_API_KEY="your-api-key"
export LANGSMITH_TRACING=true
```

### Basic tracing with @traceable

```python
from langsmith import traceable
from openai import OpenAI

client = OpenAI()

@traceable
def generate_response(prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Automatically traced to LangSmith
result = generate_response("What is machine learning?")
```

### OpenAI wrapper (automatic tracing)

```python
from langsmith.wrappers import wrap_openai
from openai import OpenAI

# Wrap client for automatic tracing
client = wrap_openai(OpenAI())

# All calls automatically traced
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Core concepts

### Runs and traces

A **run** is a single execution unit (LLM call, chain, tool). Runs form hierarchical **traces** showing the full execution flow.

```python
from langsmith import traceable

@traceable(run_type="chain")
def process_query(query: str) -> str:
    # Parent run
    context = retrieve_context(query)  # Child run
    response = generate_answer(query, context)  # Child run
    return response

@traceable(run_type="retriever")
def retrieve_context(query: str) -> list:
    return vector_store.search(query)

@traceable(run_type="llm")
def generate_answer(query: str, context: list) -> str:
    return llm.invoke(f"Context: {context}\n\nQuestion: {query}")
```

### Projects

Projects organize related runs. Set via environment or code:

```python
import os
os.environ["LANGSMITH_PROJECT"] = "my-project"

# Or per-function
@traceable(project_name="my-project")
def my_function():
    pass
```

## Client API

```python
from langsmith import Client

client = Client()

# List runs
runs = list(client.list_runs(
    project_name="my-project",
    filter='eq(status, "success")',
    limit=100
))

# Get run details
run = client.read_run(run_id="...")

# Create feedback
client.create_feedback(
    run_id="...",
    key="correctness",
    score=0.9,
    comment="Good answer"
)
```

## Datasets and evaluation

### Create dataset

```python
from langsmith import Client

client = Client()

# Create dataset
dataset = client.create_dataset("qa-test-set", description="QA evaluation")

# Add examples
client.create_examples(
    inputs=[
        {"question": "What is Python?"},
        {"question": "What is ML?"}
    ],
    outputs=[
        {"answer": "A programming language"},
        {"answer": "Machine learning"}
    ],
    dataset_id=dataset.id
)
```

### Run evaluation

```python
from langsmith import evaluate

def my_model(inputs: dict) -> dict:
    # Your model logic
    return {"answer": generate_answer(inputs["question"])}

def correctness_evaluator(run, example):
    prediction = run.outputs["answer"]
    reference = example.outputs["answer"]
    score = 1.0 if reference.lower() in prediction.lower() else 0.0
    return {"key": "correctness", "score": score}

results = evaluate(
    my_model,
    data="qa-test-set",
    evaluators=[correctness_evaluator],
    experiment_prefix="v1"
)

print(f"Average score: {results.aggregate_metrics['correctness']}")
```

### Built-in evaluators

```python
from langsmith.evaluation import LangChainStringEvaluator

# Use LangChain evaluators
results = evaluate(
    my_model,
    data="qa-test-set",
    evaluators=[
        LangChainStringEvaluator("qa"),
        LangChainStringEvaluator("cot_qa")
    ]
)
```

## Advanced tracing

### Tracing context

```python
from langsmith import tracing_context

with tracing_context(
    project_name="experiment-1",
    tags=["production", "v2"],
    metadata={"version": "2.0"}
):
    # All traceable calls inherit context
    result = my_function()
```

### Manual runs

```python
from langsmith import trace

with trace(
    name="custom_operation",
    run_type="tool",
    inputs={"query": "test"}
) as run:
    result = do_something()
    run.end(outputs={"result": result})
```

### Process inputs/outputs

```python
def sanitize_inputs(inputs: dict) -> dict:
    if "password" in inputs:
        inputs["password"] = "***"
    return inputs

@traceable(process_inputs=sanitize_inputs)
def login(username: str, password: str):
    return authenticate(username, password)
```

### Sampling

```python
import os
os.environ["LANGSMITH_TRACING_SAMPLING_RATE"] = "0.1"  # 10% sampling
```

## LangChain integration

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Tracing enabled automatically with LANGSMITH_TRACING=true
llm = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("user", "{input}")
])

chain = prompt | llm

# All chain runs traced automatically
response = chain.invoke({"input": "Hello!"})
```

## Production monitoring

### Hub prompts

```python
from langsmith import Client

client = Client()

# Pull prompt from hub
prompt = client.pull_prompt("my-org/qa-prompt")

# Use in application
result = prompt.invoke({"question": "What is AI?"})
```

### Async client

```python
from langsmith import AsyncClient

async def main():
    client = AsyncClient()

    runs = []
    async for run in client.list_runs(project_name="my-project"):
        runs.append(run)

    return runs
```

### Feedback collection

```python
from langsmith import Client

client = Client()

# Collect user feedback
def record_feedback(run_id: str, user_rating: int, comment: str = None):
    client.create_feedback(
        run_id=run_id,
        key="user_rating",
        score=user_rating / 5.0,  # Normalize to 0-1
        comment=comment
    )

# In your application
record_feedback(run_id="...", user_rating=4, comment="Helpful response")
```

## Testing integration

### Pytest integration

```python
from langsmith import test

@test
def test_qa_accuracy():
    result = my_qa_function("What is Python?")
    assert "programming" in result.lower()
```

### Evaluation in CI/CD

```python
from langsmith import evaluate

def run_evaluation():
    results = evaluate(
        my_model,
        data="regression-test-set",
        evaluators=[accuracy_evaluator]
    )

    # Fail CI if accuracy drops
    assert results.aggregate_metrics["accuracy"] >= 0.9, \
        f"Accuracy {results.aggregate_metrics['accuracy']} below threshold"
```

## Best practices

1. **Structured naming** - Use consistent project/run naming conventions
2. **Add metadata** - Include version, environment, user info
3. **Sample in production** - Use sampling rate to control volume
4. **Create datasets** - Build test sets from interesting production cases
5. **Automate evaluation** - Run evaluations in CI/CD pipelines
6. **Monitor costs** - Track token usage and latency trends

## Common issues

**Traces not appearing:**
```python
import os
# Ensure tracing is enabled
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = "your-key"

# Verify connection
from langsmith import Client
client = Client()
print(client.list_projects())  # Should work
```

**High latency from tracing:**
```python
# Enable background batching (default)
from langsmith import Client
client = Client(auto_batch_tracing=True)

# Or use sampling
os.environ["LANGSMITH_TRACING_SAMPLING_RATE"] = "0.1"
```

**Large payloads:**
```python
# Hide sensitive/large fields
@traceable(
    process_inputs=lambda x: {k: v for k, v in x.items() if k != "large_field"}
)
def my_function(data):
    pass
```

## References

- **[Advanced Usage](references/advanced-usage.md)** - Custom evaluators, distributed tracing, hub prompts
- **[Troubleshooting](references/troubleshooting.md)** - Common issues, debugging, performance

## Resources

- **Documentation**: https://docs.smith.langchain.com
- **Python SDK**: https://github.com/langchain-ai/langsmith-sdk
- **Web App**: https://smith.langchain.com
- **Version**: 0.2.0+
- **License**: MIT
