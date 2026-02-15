# LangSmith Advanced Usage Guide

## Custom Evaluators

### Simple Custom Evaluator

```python
from langsmith import evaluate

def accuracy_evaluator(run, example):
    """Check if prediction matches reference."""
    prediction = run.outputs.get("answer", "")
    reference = example.outputs.get("answer", "")

    score = 1.0 if prediction.strip().lower() == reference.strip().lower() else 0.0

    return {
        "key": "accuracy",
        "score": score,
        "comment": f"Predicted: {prediction[:50]}..."
    }

results = evaluate(
    my_model,
    data="test-dataset",
    evaluators=[accuracy_evaluator]
)
```

### LLM-as-Judge Evaluator

```python
from langsmith import evaluate
from openai import OpenAI

client = OpenAI()

def llm_judge_evaluator(run, example):
    """Use LLM to evaluate response quality."""
    prediction = run.outputs.get("answer", "")
    question = example.inputs.get("question", "")
    reference = example.outputs.get("answer", "")

    prompt = f"""Evaluate the following response for accuracy and helpfulness.

Question: {question}
Reference Answer: {reference}
Model Response: {prediction}

Rate on a scale of 1-5:
1 = Completely wrong
5 = Perfect answer

Respond with just the number."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=10
    )

    try:
        score = int(response.choices[0].message.content.strip()) / 5.0
    except ValueError:
        score = 0.5

    return {
        "key": "llm_judge",
        "score": score,
        "comment": response.choices[0].message.content
    }

results = evaluate(
    my_model,
    data="test-dataset",
    evaluators=[llm_judge_evaluator]
)
```

### Async Evaluator

```python
from langsmith import aevaluate
import asyncio

async def async_evaluator(run, example):
    """Async evaluator for concurrent evaluation."""
    prediction = run.outputs.get("answer", "")

    # Async operation (e.g., API call)
    score = await compute_similarity_async(prediction, example.outputs["answer"])

    return {"key": "similarity", "score": score}

async def run_async_eval():
    results = await aevaluate(
        async_model,
        data="test-dataset",
        evaluators=[async_evaluator],
        max_concurrency=10
    )
    return results

results = asyncio.run(run_async_eval())
```

### Multiple Return Values

```python
def comprehensive_evaluator(run, example):
    """Return multiple evaluation results."""
    prediction = run.outputs.get("answer", "")
    reference = example.outputs.get("answer", "")

    return [
        {"key": "exact_match", "score": 1.0 if prediction == reference else 0.0},
        {"key": "length_ratio", "score": min(len(prediction) / max(len(reference), 1), 1.0)},
        {"key": "contains_reference", "score": 1.0 if reference.lower() in prediction.lower() else 0.0}
    ]
```

## Summary Evaluators

```python
def summary_evaluator(runs, examples):
    """Compute aggregate metrics across all runs."""
    total_latency = sum(
        (run.end_time - run.start_time).total_seconds()
        for run in runs if run.end_time and run.start_time
    )

    avg_latency = total_latency / len(runs) if runs else 0

    return {
        "key": "avg_latency",
        "score": avg_latency
    }

results = evaluate(
    my_model,
    data="test-dataset",
    evaluators=[accuracy_evaluator],
    summary_evaluators=[summary_evaluator]
)
```

## Comparative Evaluation

```python
from langsmith import evaluate_comparative

def pairwise_judge(runs, example):
    """Compare two model outputs."""
    output_a = runs[0].outputs.get("answer", "")
    output_b = runs[1].outputs.get("answer", "")
    reference = example.outputs.get("answer", "")

    # Use LLM to compare
    prompt = f"""Compare these two answers to the question.

Question: {example.inputs['question']}
Reference: {reference}

Answer A: {output_a}
Answer B: {output_b}

Which is better? Respond with 'A', 'B', or 'TIE'."""

    response = llm.invoke(prompt)

    if "A" in response:
        return {"key": "preference", "scores": {"model_a": 1.0, "model_b": 0.0}}
    elif "B" in response:
        return {"key": "preference", "scores": {"model_a": 0.0, "model_b": 1.0}}
    else:
        return {"key": "preference", "scores": {"model_a": 0.5, "model_b": 0.5}}

results = evaluate_comparative(
    ["experiment-a-id", "experiment-b-id"],
    evaluators=[pairwise_judge]
)
```

## Advanced Tracing

### Run Trees

```python
from langsmith import RunTree

# Create root run
root = RunTree(
    name="complex_pipeline",
    run_type="chain",
    inputs={"query": "What is AI?"},
    project_name="my-project"
)

# Create child run
child = root.create_child(
    name="retrieval_step",
    run_type="retriever",
    inputs={"query": "What is AI?"}
)

# Execute and record
docs = retriever.invoke("What is AI?")
child.end(outputs={"documents": docs})

# Another child
llm_child = root.create_child(
    name="llm_call",
    run_type="llm",
    inputs={"prompt": f"Context: {docs}\n\nQuestion: What is AI?"}
)

response = llm.invoke(...)
llm_child.end(outputs={"response": response})

# End root
root.end(outputs={"answer": response})
```

### Distributed Tracing

```python
from langsmith import get_current_run_tree
from langsmith.run_helpers import get_tracing_context

# Get current trace context
context = get_tracing_context()
run_tree = get_current_run_tree()

# Pass to another service
trace_headers = {
    "langsmith-trace": run_tree.trace_id,
    "langsmith-parent": run_tree.id
}

# In receiving service
from langsmith import RunTree

child_run = RunTree(
    name="remote_operation",
    run_type="tool",
    parent_run_id=headers["langsmith-parent"],
    trace_id=headers["langsmith-trace"]
)
```

### Attachments

```python
from langsmith import Client

client = Client()

# Attach files to examples
client.create_example(
    inputs={"query": "Describe this image"},
    outputs={"description": "A sunset over mountains"},
    attachments={
        "image": ("image/jpeg", image_bytes)
    },
    dataset_id=dataset.id
)

# Attach to runs
from langsmith import traceable

@traceable(dangerously_allow_filesystem=True)
def process_file(file_path: str):
    with open(file_path, "rb") as f:
        return {"result": analyze(f.read())}
```

## Hub Prompts

### Pull and Use Prompts

```python
from langsmith import Client

client = Client()

# Pull prompt from hub
prompt = client.pull_prompt("langchain-ai/rag-prompt")

# Use prompt
response = prompt.invoke({
    "context": "Python is a programming language...",
    "question": "What is Python?"
})
```

### Push Prompts

```python
from langchain_core.prompts import ChatPromptTemplate

# Create prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful {role}."),
    ("user", "{question}")
])

# Push to hub
client.push_prompt("my-org/my-prompt", object=prompt)

# Push with tags
client.push_prompt(
    "my-org/my-prompt",
    object=prompt,
    tags=["production", "v2"]
)
```

### Versioned Prompts

```python
# Pull specific version
prompt_v1 = client.pull_prompt("my-org/my-prompt", commit_hash="abc123")

# Pull latest
prompt_latest = client.pull_prompt("my-org/my-prompt")

# Compare versions
print(f"V1 template: {prompt_v1}")
print(f"Latest template: {prompt_latest}")
```

## Dataset Management

### Create from Runs

```python
from langsmith import Client

client = Client()

# Create dataset from existing runs
runs = client.list_runs(
    project_name="production",
    filter='and(eq(feedback_key, "user_rating"), gt(feedback_score, 0.8))'
)

# Convert to examples
examples = []
for run in runs:
    examples.append({
        "inputs": run.inputs,
        "outputs": run.outputs
    })

# Create dataset
dataset = client.create_dataset("high-quality-examples")
client.create_examples(
    inputs=[e["inputs"] for e in examples],
    outputs=[e["outputs"] for e in examples],
    dataset_id=dataset.id
)
```

### Dataset Splits

```python
from langsmith import Client
import random

client = Client()

# Get all examples
examples = list(client.list_examples(dataset_name="my-dataset"))
random.shuffle(examples)

# Split
train_size = int(0.8 * len(examples))
train_examples = examples[:train_size]
test_examples = examples[train_size:]

# Create split datasets
train_dataset = client.create_dataset("my-dataset-train")
test_dataset = client.create_dataset("my-dataset-test")

for ex in train_examples:
    client.create_example(inputs=ex.inputs, outputs=ex.outputs, dataset_id=train_dataset.id)

for ex in test_examples:
    client.create_example(inputs=ex.inputs, outputs=ex.outputs, dataset_id=test_dataset.id)
```

### Upload from CSV

```python
from langsmith import Client

client = Client()

# Upload CSV directly
dataset = client.upload_csv(
    csv_file="./qa_data.csv",
    input_keys=["question"],
    output_keys=["answer"],
    name="qa-dataset",
    description="QA pairs from CSV"
)
```

## Filtering and Querying

### Run Filters

```python
from langsmith import Client

client = Client()

# Complex filters
runs = client.list_runs(
    project_name="production",
    filter='and(eq(status, "success"), gt(latency, 2.0))',
    execution_order=1,  # Only root runs
    start_time="2024-01-01T00:00:00Z",
    end_time="2024-12-31T23:59:59Z"
)

# Filter by tags
runs = client.list_runs(
    project_name="production",
    filter='has(tags, "production")'
)

# Filter by error
runs = client.list_runs(
    project_name="production",
    filter='eq(status, "error")'
)
```

### Feedback Queries

```python
# Get runs with specific feedback
runs = client.list_runs(
    project_name="production",
    filter='and(eq(feedback_key, "user_rating"), lt(feedback_score, 0.5))'
)

# Aggregate feedback
from collections import defaultdict

feedback_by_key = defaultdict(list)
for feedback in client.list_feedback(project_name="production"):
    feedback_by_key[feedback.key].append(feedback.score)

for key, scores in feedback_by_key.items():
    print(f"{key}: avg={sum(scores)/len(scores):.2f}, count={len(scores)}")
```

## OpenTelemetry Integration

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from langsmith import Client

# Set up OTel
provider = TracerProvider()
trace.set_tracer_provider(provider)

# Create client with OTel integration
client = Client(otel_tracer_provider=provider)

# Traces will be exported to both LangSmith and OTel backends
```

## Multi-Tenant Setup

```python
from langsmith import Client

# Configure multiple endpoints
api_urls = {
    "https://api-team1.langsmith.com": "api_key_1",
    "https://api-team2.langsmith.com": "api_key_2"
}

# Client writes to all endpoints
client = Client(api_urls=api_urls)

# All operations replicated
client.create_run(
    name="shared_operation",
    run_type="chain",
    inputs={"query": "test"}
)
```

## Batch Operations

```python
from langsmith import Client

client = Client()

# Batch create examples
inputs = [{"q": f"Question {i}"} for i in range(1000)]
outputs = [{"a": f"Answer {i}"} for i in range(1000)]

client.create_examples(
    inputs=inputs,
    outputs=outputs,
    dataset_id=dataset.id
)

# Batch update examples
example_ids = [ex.id for ex in client.list_examples(dataset_id=dataset.id)]
client.update_examples(
    example_ids=example_ids,
    metadata=[{"updated": True} for _ in example_ids]
)

# Batch delete
client.delete_examples(example_ids=example_ids[:100])
```

## Caching and Performance

```python
from langsmith import Client
from functools import lru_cache

client = Client()

# Cache dataset lookups
@lru_cache(maxsize=100)
def get_dataset_id(name: str) -> str:
    dataset = client.read_dataset(dataset_name=name)
    return str(dataset.id)

# Batch tracing for high throughput
client = Client(auto_batch_tracing=True)

# Control batch size
import os
os.environ["LANGSMITH_BATCH_SIZE"] = "100"
os.environ["LANGSMITH_BATCH_INTERVAL_MS"] = "1000"
```
