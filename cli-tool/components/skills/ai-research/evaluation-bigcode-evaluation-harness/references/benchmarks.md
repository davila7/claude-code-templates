# BigCode Evaluation Harness - Benchmark Guide

Comprehensive guide to all benchmarks supported by BigCode Evaluation Harness.

## Code Generation with Unit Tests

These benchmarks test functional correctness by executing generated code against unit tests.

### HumanEval

**Overview**: 164 handwritten Python programming problems created by OpenAI.

**Dataset**: `openai_humaneval` on HuggingFace
**Metric**: pass@k (k=1, 10, 100)
**Problems**: Function completion with docstrings

**Example problem structure**:
```python
def has_close_elements(numbers: List[float], threshold: float) -> bool:
    """Check if in given list of numbers, are any two numbers closer to each other than given threshold.
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """
```

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks humaneval \
  --temperature 0.2 \
  --n_samples 200 \
  --batch_size 50 \
  --allow_code_execution
```

**Recommended settings**:
- `temperature`: 0.8 for pass@k with large n_samples, 0.2 for greedy
- `n_samples`: 200 for accurate pass@k estimation
- `max_length_generation`: 512 (sufficient for most problems)

### HumanEval+

**Overview**: Extended HumanEval with 80× more test cases per problem.

**Dataset**: `evalplus/humanevalplus` on HuggingFace
**Why use it**: Catches solutions that pass original tests but fail on edge cases

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks humanevalplus \
  --temperature 0.2 \
  --n_samples 200 \
  --allow_code_execution
```

**Note**: Execution takes longer due to additional tests. Timeout may need adjustment.

### MBPP (Mostly Basic Python Problems)

**Overview**: 1,000 crowd-sourced Python problems designed for entry-level programmers.

**Dataset**: `mbpp` on HuggingFace
**Test split**: 500 problems (indices 11-511)
**Metric**: pass@k

**Problem structure**:
- Task description in English
- 3 automated test cases per problem
- Code solution (ground truth)

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks mbpp \
  --temperature 0.2 \
  --n_samples 200 \
  --allow_code_execution
```

### MBPP+

**Overview**: 399 curated MBPP problems with 35× more test cases.

**Dataset**: `evalplus/mbppplus` on HuggingFace

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks mbppplus \
  --allow_code_execution
```

### MultiPL-E (18 Languages)

**Overview**: HumanEval and MBPP translated to 18 programming languages.

**Languages**: Python, JavaScript, Java, C++, Go, Rust, TypeScript, C#, PHP, Ruby, Swift, Kotlin, Scala, Perl, Julia, Lua, R, Racket

**Task naming**: `multiple-{lang}` where lang is file extension:
- `multiple-py` (Python)
- `multiple-js` (JavaScript)
- `multiple-java` (Java)
- `multiple-cpp` (C++)
- `multiple-go` (Go)
- `multiple-rs` (Rust)
- `multiple-ts` (TypeScript)
- `multiple-cs` (C#)
- `multiple-php` (PHP)
- `multiple-rb` (Ruby)
- `multiple-swift` (Swift)
- `multiple-kt` (Kotlin)
- `multiple-scala` (Scala)
- `multiple-pl` (Perl)
- `multiple-jl` (Julia)
- `multiple-lua` (Lua)
- `multiple-r` (R)
- `multiple-rkt` (Racket)

**Usage with Docker** (recommended for safe execution):
```bash
# Step 1: Generate on host
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks multiple-js,multiple-java,multiple-cpp \
  --generation_only \
  --save_generations \
  --save_generations_path generations.json

# Step 2: Evaluate in Docker
docker pull ghcr.io/bigcode-project/evaluation-harness-multiple
docker run -v $(pwd)/generations.json:/app/generations.json:ro \
  -it evaluation-harness-multiple python3 main.py \
  --tasks multiple-js,multiple-java,multiple-cpp \
  --load_generations_path /app/generations.json \
  --allow_code_execution
```

### APPS

**Overview**: 10,000 Python problems across three difficulty levels.

**Difficulty levels**:
- Introductory: Basic programming
- Interview: Technical interview level
- Competition: Competitive programming

**Tasks**:
- `apps-introductory`
- `apps-interview`
- `apps-competition`

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks apps-introductory \
  --max_length_generation 1024 \
  --allow_code_execution
```

### DS-1000

**Overview**: 1,000 data science problems across 7 Python libraries.

**Libraries**: NumPy, Pandas, SciPy, Scikit-learn, PyTorch, TensorFlow, Matplotlib

**Requirements**:
- Python 3.7.10 specifically
- `pip install -e ".[ds1000]"`
- PyTorch 1.12.1

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks ds1000-all-completion \
  --allow_code_execution
```

### Mercury

**Overview**: 1,889 tasks for evaluating computational efficiency of generated code.

**Requirements**: `pip install lctk sortedcontainers`

**Metric**: Beyond@k (efficiency-based)

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks mercury \
  --allow_code_execution
```

## Code Generation Without Unit Tests

These benchmarks use text-based metrics (BLEU, Exact Match).

### SantaCoder-FIM (Fill-in-the-Middle)

**Overview**: 4,792 fill-in-the-middle tasks for Python, JavaScript, Java.

**Metric**: Exact Match
**Use case**: Evaluating FIM/infilling capabilities

**Tasks**:
- `santacoder_fim`
- `starcoder_fim`

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks santacoder_fim \
  --n_samples 1 \
  --batch_size 1
```

### CoNaLa

**Overview**: Natural language to Python code generation.

**Metric**: BLEU score
**Setting**: Two-shot

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks conala \
  --do_sample False \
  --n_samples 1
```

### Concode

**Overview**: Natural language to Java code generation.

**Metric**: BLEU score

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks concode \
  --do_sample False \
  --n_samples 1
```

## Instruction-Tuned Model Evaluation

### InstructHumanEval

**Overview**: HumanEval reformatted for instruction-following models.

**Usage**:
```bash
accelerate launch main.py \
  --model codellama/CodeLlama-7b-Instruct-hf \
  --tasks instruct-humaneval \
  --instruction_tokens "<s>[INST],</s>,[/INST]" \
  --allow_code_execution
```

### HumanEvalPack

**Overview**: Extends HumanEval to 3 scenarios across 6 languages.

**Scenarios**:
- **Synthesize**: Generate code from docstring
- **Fix**: Fix buggy code
- **Explain**: Generate docstring from code

**Languages**: Python, JavaScript, Java, Go, C++, Rust

**Tasks**:
- `humanevalsynthesize-{lang}`
- `humanevalfix-{lang}`
- `humanevalexplain-{lang}`

**Usage**:
```bash
accelerate launch main.py \
  --model codellama/CodeLlama-7b-Instruct-hf \
  --tasks humanevalsynthesize-python,humanevalfix-python \
  --prompt instruct \
  --allow_code_execution
```

## Math and Reasoning

### PAL (Program-Aided Language Models)

**Overview**: Solve math problems by generating Python code.

**Datasets**: GSM8K, GSM-HARD

**Tasks**:
- `pal-gsm8k-greedy`: Greedy decoding
- `pal-gsm8k-majority_voting`: k=40 majority voting
- `pal-gsmhard-greedy`
- `pal-gsmhard-majority_voting`

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks pal-gsm8k-greedy \
  --max_length_generation 2048 \
  --do_sample False \
  --allow_code_execution
```

**Note**: Requires `max_length_generation >= 2048` due to 8-shot prompts (~1500 tokens).

## Documentation Generation

### CodeXGLUE Code-to-Text

**Overview**: Generate documentation from code.

**Languages**: Python, Go, Ruby, Java, JavaScript, PHP

**Tasks**: `codexglue_code_to_text-{lang}`

**Usage**:
```bash
accelerate launch main.py \
  --model bigcode/starcoder2-7b \
  --tasks codexglue_code_to_text-python \
  --do_sample False \
  --n_samples 1 \
  --batch_size 1
```

## Classification Tasks

### Java Complexity Prediction

**Task**: `java-complexity`

### Code Equivalence Detection

**Task**: `java-clone-detection`

### C Defect Prediction

**Task**: `c-defect-detection`

## Benchmark Selection Guide

| Goal | Recommended Benchmarks |
|------|------------------------|
| Quick sanity check | HumanEval (n_samples=20) |
| Standard evaluation | HumanEval + MBPP |
| Rigorous evaluation | HumanEval+ + MBPP+ |
| Multi-language | MultiPL-E |
| Instruction models | InstructHumanEval, HumanEvalPack |
| FIM/Infilling | SantaCoder-FIM, StarCoder-FIM |
| Data science | DS-1000 |
| Competition-level | APPS |
| Efficiency | Mercury |
| Math reasoning | PAL-GSM8K |

## pass@k Calculation

pass@k estimates probability that at least one of k samples passes all tests:

```
pass@k = E[1 - C(n-c, k) / C(n, k)]
```

Where:
- n = total samples generated
- c = samples that pass all tests
- k = number of samples allowed

**Recommended n_samples by k**:
- pass@1: n >= 20
- pass@10: n >= 100
- pass@100: n >= 200

**Temperature recommendations**:
- pass@1: temperature = 0.2 (near-greedy)
- pass@10, pass@100: temperature = 0.8 (more diverse sampling)
