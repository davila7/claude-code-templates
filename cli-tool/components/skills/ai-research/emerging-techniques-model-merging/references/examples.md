# Model Merging Examples

Real-world merge configurations from successful models on HuggingFace and research papers.

## Table of Contents
- Successful Merges
- Mixtral-based Merges
- Llama-based Merges
- Task-Specific Merges
- Production Examples

## Successful Merges

### Marcoro14-7B-slerp

**Achievement**: #1 on Open LLM Leaderboard (February 2024)
**Method**: SLERP
**Source**: HuggingFace

```yaml
# marcoro14-7b-slerp.yml
merge_method: slerp
slices:
  - sources:
      - model: AIDC-ai-business/Marcoroni-7B-v3
        layer_range: [0, 32]
      - model: EmbeddedLLM/Mistral-7B-Merge-14-v0.1
        layer_range: [0, 32]
parameters:
  t: 0.5  # Equal blend
dtype: bfloat16
```

**Results**:
- Average: 74.32 on Open LLM Leaderboard
- Strong across all tasks
- Smooth capability combination

### goliath-120b (Mixtral MoE)

**Method**: Linear + SLERP
**Achievement**: Top-performing 120B model

```yaml
# goliath-120b.yml
merge_method: slerp
slices:
  - sources:
      - model: alpindale/c4ai-command-r-plus-GPTQ
        layer_range: [0, 40]
      - model: CohereForAI/c4ai-command-r-v01
        layer_range: [0, 40]
parameters:
  t:
    - filter: self_attn
      value: [0, 0.5, 0.3, 0.7, 1]  # Layer-specific blending
    - filter: mlp
      value: [1, 0.5, 0.7, 0.3, 0]
    - value: 0.5  # Default
dtype: float16
```

## Mixtral-based Merges

### Math + Code Specialist

**Goal**: Combine mathematical reasoning with code generation

```yaml
# math-code-mixtral.yml
merge_method: task_arithmetic
base_model: mistralai/Mixtral-8x7B-v0.1
models:
  - model: WizardLM/WizardMath-7B-V1.1
    parameters:
      weight: 0.6  # Emphasize math
  - model: ajibawa-2023/Code-Mixtral-8x7B
    parameters:
      weight: 0.4  # Add code
dtype: bfloat16
```

**Expected capabilities**:
- Strong mathematical reasoning
- Code generation and understanding
- Technical problem-solving

### Chat + Roleplay Merge

```yaml
# chat-roleplay.yml
merge_method: slerp
slices:
  - sources:
      - model: teknium/OpenHermes-2.5-Mistral-7B
        layer_range: [0, 32]
      - model: Undi95/MLewd-ReMM-L2-Chat-20B-Part1
        layer_range: [0, 32]
parameters:
  t: 0.5
dtype: bfloat16
```

### Multi-Task TIES Merge

```yaml
# multi-task-mixtral.yml
merge_method: ties
base_model: mistralai/Mixtral-8x7B-v0.1
models:
  - model: WizardLM/WizardMath-7B-V1.1
    parameters:
      density: 0.5
      weight: 1.0
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      density: 0.5
      weight: 1.0
  - model: ajibawa-2023/Code-Mixtral-8x7B
    parameters:
      density: 0.5
      weight: 1.0
parameters:
  normalize: true
dtype: bfloat16
```

## Llama-based Merges

### Platypus-Hermes Merge

**Models**: Garage-bAInd/Platypus2-13B + WizardLM/WizardLM-13B-V1.2

```yaml
# platypus-hermes-13b.yml
merge_method: linear
models:
  - model: garage-bAInd/Platypus2-13B
    parameters:
      weight: 0.5
  - model: WizardLM/WizardLM-13B-V1.2
    parameters:
      weight: 0.3
  - model: psmathur/orca_mini_v3_13b
    parameters:
      weight: 0.2
dtype: float16
```

### DARE-TIES Llama Merge

**Source**: DARE paper (arXiv 2311.03099)

```yaml
# dare-ties-llama.yml
merge_method: dare_ties
base_model: meta-llama/Llama-2-7b-hf
models:
  - model: WizardLM/WizardLM-7B-V1.0
    parameters:
      density: 0.5   # Keep top 50%
      weight: 0.6
      dare:
        drop_rate: 0.9  # Drop 90% of deltas
  - model: garage-bAInd/Platypus-7B
    parameters:
      density: 0.5
      weight: 0.4
      dare:
        drop_rate: 0.9
parameters:
  int8_mask: true
dtype: bfloat16
```

## Task-Specific Merges

### Medical Domain

**Goal**: Create medical specialist model

```yaml
# medical-specialist.yml
merge_method: task_arithmetic
base_model: mistralai/Mistral-7B-v0.1
models:
  - model: medalpaca/medalpaca-7b
    parameters:
      weight: 0.7  # Strong medical knowledge
  - model: teknium/OpenHermes-2.5-Mistral-7B
    parameters:
      weight: 0.3  # Add general chat ability
dtype: bfloat16
```

### Legal Assistant

```yaml
# legal-assistant.yml
merge_method: slerp
slices:
  - sources:
      - model: law-ai/legal-bert-7b
        layer_range: [0, 32]
      - model: teknium/OpenHermes-2.5-Mistral-7B
        layer_range: [0, 32]
parameters:
  t:
    - filter: self_attn
      value: 0.7  # Emphasize legal model in attention
    - filter: mlp
      value: 0.3  # More general chat in MLPs
    - value: 0.5
dtype: bfloat16
```

### Multilingual Merge

```yaml
# multilingual-merge.yml
merge_method: linear
models:
  - model: mistralai/Mistral-7B-v0.1
    parameters:
      weight: 0.4  # English
  - model: CohereForAI/aya-23-7B
    parameters:
      weight: 0.3  # Multilingual
  - model: Qwen/Qwen3-7B
    parameters:
      weight: 0.3  # Asian languages
dtype: bfloat16
```

## Production Examples

### Gradual Merge (Safer)

**Strategy**: Merge incrementally, test at each step

```yaml
# Step 1: Merge two models
# step1.yml
merge_method: slerp
slices:
  - sources:
      - model: base_model
        layer_range: [0, 32]
      - model: specialist_1
        layer_range: [0, 32]
parameters:
  t: 0.3  # Conservative blend
dtype: bfloat16
```

```yaml
# Step 2: Add third model to result
# step2.yml
merge_method: slerp
slices:
  - sources:
      - model: ./merged_step1  # Previous merge
        layer_range: [0, 32]
      - model: specialist_2
        layer_range: [0, 32]
parameters:
  t: 0.3  # Conservative
dtype: bfloat16
```

**Benefits**:
- Test after each merge
- Easier to debug
- Can stop if quality degrades

### A/B Testing Setup

```yaml
# variant_a.yml - Conservative
merge_method: slerp
slices:
  - sources:
      - model: base_model
        layer_range: [0, 32]
      - model: specialist
        layer_range: [0, 32]
parameters:
  t: 0.3  # 30% specialist
dtype: bfloat16
```

```yaml
# variant_b.yml - Aggressive
merge_method: slerp
slices:
  - sources:
      - model: base_model
        layer_range: [0, 32]
      - model: specialist
        layer_range: [0, 32]
parameters:
  t: 0.7  # 70% specialist
dtype: bfloat16
```

**Test both**, choose best performer

### Frankenmerge (Experimental)

**Warning**: Experimental, may not work

```yaml
# frankenmerge.yml
merge_method: passthrough
slices:
  # First 8 layers from model A
  - sources:
      - model: model_a
        layer_range: [0, 8]

  # Middle 16 layers from model B
  - sources:
      - model: model_b
        layer_range: [8, 24]

  # Last 8 layers from model C
  - sources:
      - model: model_c
        layer_range: [24, 32]
dtype: bfloat16
```

**Use case**: Create models with non-standard layer counts

### MoE from Merges

```yaml
# moe-from-merges.yml
merge_method: moe
base_model: mistralai/Mistral-7B-v0.1
experts:
  - source_model: WizardLM/WizardMath-7B-V1.1
    positive_prompts:
      - "math"
      - "calculate"
      - "solve"
      - "equation"

  - source_model: ajibawa-2023/Code-Mistral-7B
    positive_prompts:
      - "code"
      - "python"
      - "function"
      - "programming"

  - source_model: teknium/OpenHermes-2.5-Mistral-7B
    positive_prompts:
      - "chat"
      - "conversation"
      - "help"
      - "question"
dtype: bfloat16
```

**Result**: Dynamic expert selection based on prompt

## Command-Line Examples

### Basic Merge

```bash
# Simple two-model SLERP
mergekit-yaml config.yml ./output-model \
  --cuda \
  --lazy-unpickle
```

### Large Model Merge (Low VRAM)

```bash
# Merge on CPU (slow but works with 8GB VRAM)
mergekit-yaml config.yml ./output-model \
  --allow-crimes \  # Enable CPU offloading
  --low-cpu-memory
```

### Merge and Upload

```bash
# Merge and push to HuggingFace
mergekit-yaml config.yml ./merged-model --cuda

cd merged-model
python << EOF
from transformers import AutoModel, AutoTokenizer

model = AutoModel.from_pretrained("./")
tokenizer = AutoTokenizer.from_pretrained("./")

model.push_to_hub("username/my-merged-model")
tokenizer.push_to_hub("username/my-merged-model")
EOF
```

### Batch Merging

```bash
# Merge multiple configs
for config in configs/*.yml; do
  output="./output/$(basename $config .yml)"
  mergekit-yaml $config $output --cuda
done
```

## Tips from Successful Merges

1. **Start Conservative**: Use t=0.3-0.5 for SLERP, test before going higher
2. **Match Architectures**: Only merge models with same base architecture
3. **Test Extensively**: Benchmark on multiple tasks before deploying
4. **Layer-Specific Merging**: Different t values for attention vs MLP often works better
5. **DARE for Many Models**: When merging 3+ models, DARE-TIES often best
6. **Gradual Merging**: For production, merge incrementally and test

## Resources

- **HuggingFace Models**: Browse merged models for inspiration
- **Open LLM Leaderboard**: See top-performing merges
- **mergekit Examples**: https://github.com/arcee-ai/mergekit/tree/main/examples
