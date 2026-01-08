# Model Merging Evaluation

Complete guide to benchmarking and testing merged models based on research best practices.

## Table of Contents
- Benchmark Suites
- Evaluation Metrics
- Testing Methodology
- Comparison Framework
- Quality Assurance

## Benchmark Suites

### Open LLM Leaderboard

**URL**: https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard

**Tasks** (6 benchmarks):
1. **ARC** (AI2 Reasoning Challenge): 25-shot, science questions
2. **HellaSwag**: 10-shot, commonsense reasoning
3. **MMLU** (Massive Multitask Language Understanding): 5-shot, 57 subjects
4. **TruthfulQA**: 0-shot, factual accuracy
5. **Winogrande**: 5-shot, commonsense reasoning
6. **GSM8K**: 5-shot, grade-school math

**Running Evaluation**:

```python
from lm_eval import evaluator

model = "path/to/merged/model"

results = evaluator.simple_evaluate(
    model="hf",
    model_args=f"pretrained={model},dtype=float16",
    tasks=[
        "arc_challenge",
        "hellaswag",
        "hendrycksTest-*",  # MMLU
        "truthfulqa_mc",
        "winogrande",
        "gsm8k"
    ],
    num_fewshot=5,
    batch_size=8
)

# Average score
avg_score = sum(results['results'].values()) / len(results['results'])
print(f"Average: {avg_score:.2f}")
```

### MT-Bench

**Focus**: Multi-turn conversation quality

**Installation**:

```bash
git clone https://github.com/lm-sys/FastChat
cd FastChat
pip install -e .
```

**Running**:

```bash
# Generate responses
python gen_model_answer.py \
  --model-path path/to/merged/model \
  --model-id merged_model

# Judge with GPT-4
python gen_judgment.py \
  --model-list merged_model \
  --judge-model gpt-4

# View scores
python show_result.py
```

**Metrics**:
- Turn 1 score (1-10)
- Turn 2 score (1-10)
- Average score

### MMLU (Detailed)

**Subjects** (57 total):
- STEM: Math, Physics, Chemistry, Biology, Computer Science
- Humanities: History, Philosophy, Law
- Social Sciences: Economics, Psychology, Sociology
- Other: Professional subjects (Medicine, Accounting, etc.)

```python
from lm_eval import evaluator

# Run all MMLU subjects
results = evaluator.simple_evaluate(
    model="hf",
    model_args=f"pretrained={model}",
    tasks="hendrycksTest-*",  # All MMLU tasks
    num_fewshot=5
)

# Subject breakdown
for task, score in results['results'].items():
    subject = task.replace('hendrycksTest-', '')
    print(f"{subject}: {score['acc']:.2%}")
```

### HumanEval (Code)

**Focus**: Python code generation

```python
from human_eval.data import write_jsonl, read_problems
from human_eval.evaluation import evaluate_functional_correctness

# Generate completions
problems = read_problems()
samples = []

for task_id, problem in problems.items():
    prompt = problem['prompt']
    completion = model.generate(prompt)
    samples.append({
        'task_id': task_id,
        'completion': completion
    })

write_jsonl("samples.jsonl", samples)

# Evaluate
results = evaluate_functional_correctness("samples.jsonl")
print(f"Pass@1: {results['pass@1']:.2%}")
```

## Evaluation Metrics

### Performance Metrics

**Accuracy**: Correct predictions / total predictions
```python
def accuracy(predictions, labels):
    correct = sum(p == l for p, l in zip(predictions, labels))
    return correct / len(predictions)
```

**Perplexity**: Language modeling quality (lower is better)
```python
import torch

def perplexity(model, text):
    tokens = tokenizer(text, return_tensors='pt')
    with torch.no_grad():
        loss = model(**tokens).loss
    return torch.exp(loss).item()
```

**BLEU Score**: Translation/generation quality
```python
from nltk.translate.bleu_score import sentence_bleu

reference = [["the", "cat", "sat", "on", "the", "mat"]]
candidate = ["the", "cat", "is", "on", "the", "mat"]

score = sentence_bleu(reference, candidate)
```

### Capability Retention

**Test**: Does merged model retain parent capabilities?

```python
def test_capability_retention(merged_model, parent_models, test_suite):
    """Check if merged model maintains parent capabilities."""
    results = {}

    # Baseline: Test parent models
    for i, parent in enumerate(parent_models):
        parent_score = evaluate(parent, test_suite)
        results[f'parent_{i}'] = parent_score

    # Test merged model
    merged_score = evaluate(merged_model, test_suite)
    results['merged'] = merged_score

    # Retention percentage
    avg_parent_score = sum(s for k, s in results.items() if k.startswith('parent')) / len(parent_models)
    retention = merged_score / avg_parent_score

    print(f"Capability Retention: {retention:.1%}")
    return retention >= 0.95  # 95% retention threshold
```

### Conflict Detection

**Test**: Does model show conflicting behaviors?

```python
def test_conflicts(model, test_pairs):
    """Test for contradictory outputs."""
    conflicts = []

    for question_a, question_b, expected_consistency in test_pairs:
        answer_a = model.generate(question_a)
        answer_b = model.generate(question_b)

        # Check consistency
        is_consistent = check_semantic_similarity(answer_a, answer_b)

        if is_consistent != expected_consistency:
            conflicts.append((question_a, question_b, answer_a, answer_b))

    conflict_rate = len(conflicts) / len(test_pairs)
    print(f"Conflict Rate: {conflict_rate:.1%}")

    return conflict_rate < 0.05  # <5% conflicts acceptable
```

## Testing Methodology

### Pre-Merge Testing

**Before merging**, establish baselines:

```python
# Test parent models
parent_1_scores = evaluate(parent_1, benchmark_suite)
parent_2_scores = evaluate(parent_2, benchmark_suite)

# Expected range for merged model
min_expected = min(parent_1_scores, parent_2_scores)
max_expected = max(parent_1_scores, parent_2_scores)

print(f"Expected merged score: {min_expected:.2f} - {max_expected:.2f}")
```

### Post-Merge Testing

**Comprehensive evaluation**:

```python
def comprehensive_eval(merged_model):
    """Full evaluation suite."""
    results = {}

    # 1. General capabilities
    results['open_llm'] = evaluate_open_llm(merged_model)

    # 2. Conversation
    results['mt_bench'] = evaluate_mt_bench(merged_model)

    # 3. Domain-specific
    results['math'] = evaluate_math(merged_model)  # GSM8K, MATH
    results['code'] = evaluate_code(merged_model)  # HumanEval
    results['reasoning'] = evaluate_reasoning(merged_model)  # ARC, HellaSwag

    # 4. Safety
    results['safety'] = evaluate_safety(merged_model)  # TruthfulQA

    return results
```

### A/B Testing

**Compare merged model vs parents**:

```python
def ab_test(model_a, model_b, test_prompts, n_users=100):
    """User preference testing."""
    preferences = {'a': 0, 'b': 0, 'tie': 0}

    for prompt in test_prompts:
        response_a = model_a.generate(prompt)
        response_b = model_b.generate(prompt)

        # Simulated user preference (or use GPT-4 as judge)
        preference = judge_responses(prompt, response_a, response_b)
        preferences[preference] += 1

    a_win_rate = preferences['a'] / (preferences['a'] + preferences['b'] + preferences['tie'])

    print(f"Model A Win Rate: {a_win_rate:.1%}")
    print(f"Tie Rate: {preferences['tie'] / len(test_prompts):.1%}")

    return a_win_rate
```

## Comparison Framework

### Score Comparison Table

```python
import pandas as pd

def compare_models(models, benchmarks):
    """Create comparison table."""
    results = {}

    for model_name, model_path in models.items():
        results[model_name] = {}

        for benchmark_name, benchmark_fn in benchmarks.items():
            score = benchmark_fn(model_path)
            results[model_name][benchmark_name] = score

    # Create DataFrame
    df = pd.DataFrame(results).T

    # Add average column
    df['Average'] = df.mean(axis=1)

    # Highlight best
    print(df.to_markdown())

    return df

# Usage
models = {
    'Parent 1': 'path/to/parent1',
    'Parent 2': 'path/to/parent2',
    'Merged (SLERP t=0.5)': 'path/to/merged_0.5',
    'Merged (TIES)': 'path/to/merged_ties'
}

benchmarks = {
    'MMLU': evaluate_mmlu,
    'ARC': evaluate_arc,
    'GSM8K': evaluate_gsm8k
}

df = compare_models(models, benchmarks)
```

### Statistical Significance

```python
from scipy import stats

def is_improvement_significant(scores_a, scores_b, alpha=0.05):
    """Test if improvement is statistically significant."""
    # Paired t-test
    t_stat, p_value = stats.ttest_rel(scores_a, scores_b)

    is_significant = p_value < alpha
    improvement = (sum(scores_b) - sum(scores_a)) / len(scores_a)

    print(f"Mean improvement: {improvement:.2f}")
    print(f"P-value: {p_value:.4f}")
    print(f"Significant: {is_significant}")

    return is_significant
```

## Quality Assurance

### Regression Testing

**Ensure no capability loss**:

```python
def regression_test(merged_model, parent_models, critical_tests):
    """Check for performance regressions."""
    regressions = []

    for test_name, test_fn in critical_tests.items():
        # Parent scores
        parent_scores = [test_fn(p) for p in parent_models]
        min_parent_score = min(parent_scores)

        # Merged score
        merged_score = test_fn(merged_model)

        # Regression if merged < min parent
        if merged_score < min_parent_score * 0.95:  # 5% tolerance
            regressions.append({
                'test': test_name,
                'parents': parent_scores,
                'merged': merged_score,
                'delta': merged_score - min_parent_score
            })

    if regressions:
        print(f"⚠️  {len(regressions)} regressions detected:")
        for r in regressions:
            print(f"  - {r['test']}: {r['delta']:.2%} drop")

    return len(regressions) == 0
```

### Sanity Checks

```python
def sanity_checks(model):
    """Basic functionality tests."""
    tests = {
        'generates': lambda: model.generate("Hello") != "",
        'coherent': lambda: len(model.generate("The capital of France is")) > 5,
        'follows_instruction': lambda: "paris" in model.generate("What is the capital of France?").lower(),
        'no_repetition': lambda: not has_repetition(model.generate("Tell me about AI", max_length=100))
    }

    results = {name: test() for name, test in tests.items()}

    passed = sum(results.values())
    total = len(results)

    print(f"Sanity Checks: {passed}/{total} passed")

    for name, result in results.items():
        status = "✓" if result else "✗"
        print(f"  {status} {name}")

    return passed == total
```

### Deployment Checklist

Before deploying merged model:

- [ ] Open LLM Leaderboard score >= min(parent scores)
- [ ] MT-Bench score >= avg(parent scores)
- [ ] Domain-specific benchmarks pass
- [ ] No regressions in critical tests
- [ ] Sanity checks all pass
- [ ] A/B test win rate >= 45%
- [ ] Safety checks pass (TruthfulQA)
- [ ] Manual testing with diverse prompts
- [ ] Model size acceptable for deployment
- [ ] Inference speed acceptable

## Benchmark Interpretation

### Open LLM Leaderboard Ranges

| Score | Quality |
|-------|---------|
| <60 | Poor - likely broken |
| 60-65 | Below average |
| 65-70 | Average |
| 70-75 | Good |
| 75-80 | Excellent |
| >80 | State-of-art |

### MT-Bench Ranges

| Score | Quality |
|-------|---------|
| <6.0 | Poor conversation |
| 6.0-7.0 | Acceptable |
| 7.0-8.0 | Good |
| 8.0-9.0 | Excellent |
| >9.0 | Near human-level |

## Resources

- **lm-evaluation-harness**: https://github.com/EleutherAI/lm-evaluation-harness
- **MT-Bench**: https://github.com/lm-sys/FastChat
- **HumanEval**: https://github.com/openai/human-eval
- **Open LLM Leaderboard**: https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard
