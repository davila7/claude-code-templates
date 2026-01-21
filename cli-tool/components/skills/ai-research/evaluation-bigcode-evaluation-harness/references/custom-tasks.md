# Creating Custom Tasks in BigCode Evaluation Harness

Guide to implementing custom evaluation tasks for code generation models.

## Task Architecture

All tasks inherit from a base `Task` class and implement standard methods:

```python
class Task:
    DATASET_PATH: str  # HuggingFace dataset ID
    DATASET_NAME: str  # Dataset configuration (or None)

    def __init__(self, stop_words, requires_execution):
        """Initialize task with stop words and execution flag."""

    def get_dataset(self):
        """Return the evaluation dataset."""

    def get_prompt(self, doc):
        """Format document into model prompt."""

    def get_reference(self, doc):
        """Extract reference solution from document."""

    def postprocess_generation(self, generation, idx):
        """Clean up model output."""

    def process_results(self, generations, references):
        """Evaluate and return metrics."""
```

## Step-by-Step Implementation

### Step 1: Create Task File

Copy template to `bigcode_eval/tasks/<task_name>.py`:

```python
"""
<Paper Title>
<Paper URL>

<Task Description>

Homepage: <Homepage URL>
"""

import json
from evaluate import load
from bigcode_eval.base import Task

class MyCustomTask(Task):
    """Custom code evaluation task."""

    DATASET_PATH = "username/dataset-name"  # HuggingFace dataset
    DATASET_NAME = None  # or specific config name

    def __init__(self):
        super().__init__(
            stop_words=["\nclass", "\ndef", "\n#", "\nif", "\nprint"],
            requires_execution=True,  # Set True if running unit tests
        )

    def get_dataset(self):
        """Load evaluation split."""
        from datasets import load_dataset
        return load_dataset(
            self.DATASET_PATH,
            self.DATASET_NAME,
            split="test"
        )

    def get_prompt(self, doc):
        """Format problem into prompt for model."""
        return doc["prompt"]

    def get_reference(self, doc):
        """Return test cases or reference solution."""
        return doc["test"]

    def postprocess_generation(self, generation, idx):
        """Clean model output (remove extra text after solution)."""
        # Common: stop at first occurrence of stop words
        for stop_word in self.stop_words:
            if stop_word in generation:
                generation = generation[:generation.index(stop_word)]
        return generation

    def process_results(self, generations, references):
        """Execute tests and compute pass@k."""
        code_metric = load("code_eval")
        results, _ = code_metric.compute(
            references=references,
            predictions=generations,
            k=[1, 10, 100]
        )
        return results
```

### Step 2: Register Task

Add to `bigcode_eval/tasks/__init__.py`:

```python
from bigcode_eval.tasks import my_custom_task

TASK_REGISTRY = {
    # ... existing tasks ...
    "my-custom-task": my_custom_task.MyCustomTask,
}
```

### Step 3: Test Task

```bash
# Verify task loads correctly
python -c "from bigcode_eval.tasks import get_task; t = get_task('my-custom-task'); print(t)"

# Run small evaluation
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks my-custom-task \
  --limit 5 \
  --allow_code_execution
```

## Implementation Patterns

### Pattern 1: Code Execution with Unit Tests

For benchmarks that verify functional correctness:

```python
class CodeExecutionTask(Task):
    def __init__(self):
        super().__init__(
            stop_words=["\nclass", "\ndef", "\n#"],
            requires_execution=True,  # CRITICAL: Enable execution
        )

    def get_reference(self, doc):
        """Return test code to execute."""
        return f"\n{doc['test']}\ncheck({doc['entry_point']})"

    def process_results(self, generations, references):
        code_metric = load("code_eval")
        results, details = code_metric.compute(
            references=references,
            predictions=generations,
            k=[1, 10, 100],
            timeout=10.0,  # Seconds per test
        )
        return results
```

### Pattern 2: BLEU Score Evaluation

For benchmarks without executable tests:

```python
class BLEUTask(Task):
    def __init__(self):
        super().__init__(
            stop_words=["\n\n"],
            requires_execution=False,  # No code execution
        )

    def get_reference(self, doc):
        """Return reference code string."""
        return doc["canonical_solution"]

    def process_results(self, generations, references):
        from evaluate import load
        bleu = load("bleu")

        # Flatten generations (one per problem for BLEU)
        predictions = [g[0] for g in generations]

        results = bleu.compute(
            predictions=predictions,
            references=[[r] for r in references]
        )
        return {"bleu": results["bleu"]}
```

### Pattern 3: Few-Shot Prompting

For tasks requiring in-context examples:

```python
class FewShotTask(Task):
    def __init__(self):
        super().__init__(stop_words=["\n\n"], requires_execution=True)
        self.examples = self._load_examples()

    def _load_examples(self):
        """Load few-shot examples from JSON."""
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            "few_shot_examples",
            "my_task_examples.json"
        )
        with open(path) as f:
            return json.load(f)

    def get_prompt(self, doc):
        """Build few-shot prompt."""
        prompt = ""
        for ex in self.examples[:3]:  # 3-shot
            prompt += f"Problem: {ex['problem']}\nSolution: {ex['solution']}\n\n"
        prompt += f"Problem: {doc['problem']}\nSolution:"
        return prompt
```

### Pattern 4: Fill-in-the-Middle (FIM)

For infilling tasks:

```python
class FIMTask(Task):
    FIM_PREFIX = "<fim_prefix>"
    FIM_MIDDLE = "<fim_middle>"
    FIM_SUFFIX = "<fim_suffix>"

    def __init__(self):
        super().__init__(
            stop_words=["<|endoftext|>", self.FIM_MIDDLE],
            requires_execution=False,
        )

    def get_prompt(self, doc):
        """Format as FIM prompt."""
        prefix = doc["prefix"]
        suffix = doc["suffix"]
        return f"{self.FIM_PREFIX}{prefix}{self.FIM_SUFFIX}{suffix}{self.FIM_MIDDLE}"

    def postprocess_generation(self, generation, idx):
        """Extract middle portion."""
        if self.FIM_MIDDLE in generation:
            generation = generation.split(self.FIM_MIDDLE)[0]
        return generation.strip()
```

### Pattern 5: Instruction-Tuned Models

For chat/instruction models:

```python
class InstructTask(Task):
    def __init__(self):
        super().__init__(
            stop_words=["</s>", "[/INST]", "```\n"],
            requires_execution=True,
        )

    def get_prompt(self, doc):
        """Format as instruction prompt."""
        instruction = f"""Write a Python function that {doc['description']}.

Function signature: {doc['signature']}

Examples:
{doc['examples']}

Write only the function implementation:"""
        return instruction
```

## Dataset Format Requirements

### For HuggingFace Datasets

Your dataset should include:

```python
{
    "prompt": "def function_name(args):\n    '''Docstring'''",
    "canonical_solution": "    return result",
    "test": "assert function_name(input) == expected",
    "entry_point": "function_name"
}
```

### Creating Dataset Factories

For tasks with multiple configurations:

```python
def create_all_tasks():
    """Create task variants for all languages."""
    tasks = {}
    for lang in ["python", "javascript", "java", "cpp"]:
        tasks[f"my-task-{lang}"] = create_task_class(lang)
    return tasks

def create_task_class(language):
    class LanguageTask(Task):
        DATASET_PATH = "username/dataset"
        DATASET_NAME = language
        # ... implementation
    return LanguageTask

# In __init__.py:
TASK_REGISTRY = {
    **my_module.create_all_tasks(),
}
```

## Testing Your Task

### Unit Tests

Create `tests/test_my_task.py`:

```python
import pytest
from bigcode_eval.tasks import get_task

def test_task_loads():
    task = get_task("my-custom-task")
    assert task is not None

def test_dataset_loads():
    task = get_task("my-custom-task")
    dataset = task.get_dataset()
    assert len(dataset) > 0

def test_prompt_format():
    task = get_task("my-custom-task")
    dataset = task.get_dataset()
    prompt = task.get_prompt(dataset[0])
    assert isinstance(prompt, str)
    assert len(prompt) > 0

def test_postprocess():
    task = get_task("my-custom-task")
    raw = "def foo():\n    return 1\n\nclass Bar:"
    processed = task.postprocess_generation(raw, 0)
    assert "class Bar" not in processed
```

Run tests:
```bash
pytest tests/test_my_task.py -v
```

### Integration Test

```bash
# Small-scale evaluation
accelerate launch main.py \
  --model bigcode/santacoder \
  --tasks my-custom-task \
  --limit 10 \
  --n_samples 5 \
  --allow_code_execution \
  --save_generations
```

## Common Pitfalls

### 1. Missing `requires_execution=True`

If your task uses unit tests, you MUST set:
```python
super().__init__(requires_execution=True, ...)
```

### 2. Incorrect Stop Words

Stop words should match your programming language:

```python
# Python
stop_words=["\nclass", "\ndef", "\n#", "\nif __name__"]

# JavaScript
stop_words=["\nfunction", "\nconst", "\nlet", "\n//"]

# Java
stop_words=["\npublic", "\nprivate", "\nclass", "\n//"]
```

### 3. Not Handling Edge Cases in Postprocessing

```python
def postprocess_generation(self, generation, idx):
    # Handle empty generation
    if not generation or not generation.strip():
        return ""

    # Handle multiple stop words
    for sw in self.stop_words:
        if sw in generation:
            generation = generation[:generation.index(sw)]

    # Remove trailing whitespace
    return generation.rstrip()
```

### 4. Timeout Issues

For complex tests, increase timeout:
```python
results, _ = code_metric.compute(
    references=references,
    predictions=generations,
    timeout=30.0,  # Increase from default
)
```

## Contributing Your Task

1. Fork the repository
2. Create feature branch
3. Implement task following patterns above
4. Add tests
5. Update documentation
6. Submit PR with:
   - Task description
   - Example usage
   - Expected results range
