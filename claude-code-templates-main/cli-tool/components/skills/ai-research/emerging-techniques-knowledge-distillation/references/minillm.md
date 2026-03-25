# MiniLLM: Reverse KL Divergence for LLM Distillation

Based on arXiv 2306.08543 (2024) - MiniLLM: Knowledge Distillation of Large Language Models

## Overview

**Source**: https://arxiv.org/abs/2306.08543
**GitHub**: https://github.com/microsoft/LMOps/tree/main/minillm

MiniLLM replaces forward KLD with reverse KLD for knowledge distillation, achieving better performance on generative language models.

## Problem with Standard KLD

### Forward KL Divergence (Standard)

**Formula**: `KL(Student || Teacher)`

**Minimization behavior**: Mode-seeking
```
Student tries to match teacher's MEAN behavior
→ Student focuses on teacher's highest probability regions
→ Student ignores low-probability but valid generations
```

**Issue for generative models**: Limits diversity, student generates safe but boring outputs.

### Why Forward KL Fails for Generation

```python
# Teacher distribution (diverse)
teacher_probs = [0.3, 0.3, 0.2, 0.1, 0.1]  # Multiple valid options

# Forward KL minimization
# Student learns: [0.6, 0.3, 0.1, 0.0, 0.0]
# Problem: Ignores options 4-5 entirely (mode-seeking)
```

## MiniLLM Solution: Reverse KLD

### Reverse KL Divergence

**Formula**: `KL(Teacher || Student)`

**Minimization behavior**: Mode-covering
```
Student tries to COVER all teacher's modes
→ Student learns diverse generation
→ Student doesn't ignore any valid teacher outputs
```

### Mathematical Formulation

**Forward KL** (standard distillation):
```
L_forward = Σ p_student(x) log(p_student(x) / p_teacher(x))
          = E_{x~student} [log p_student(x) - log p_teacher(x)]
```

**Reverse KL** (MiniLLM):
```
L_reverse = Σ p_teacher(x) log(p_teacher(x) / p_student(x))
          = E_{x~teacher} [log p_teacher(x) - log p_student(x)]
```

**Key difference**: Expectation over teacher distribution vs student distribution.

## Implementation

### Reverse KLD Loss

```python
import torch
import torch.nn.functional as F

def reverse_kl_loss(student_logits, teacher_logits, temperature=1.0):
    """
    Reverse KL divergence: KL(Teacher || Student).

    Args:
        student_logits: Model predictions (batch, seq_len, vocab_size)
        teacher_logits: Teacher predictions (batch, seq_len, vocab_size)
        temperature: Softening parameter

    Returns:
        Reverse KL divergence loss
    """
    # Teacher distribution (target, detached)
    p_teacher = F.softmax(teacher_logits / temperature, dim=-1)
    p_teacher = p_teacher.detach()  # Don't backprop through teacher

    # Student distribution (learnable)
    log_p_student = F.log_softmax(student_logits / temperature, dim=-1)

    # Reverse KL: -Σ p_teacher * log p_student
    reverse_kl = -(p_teacher * log_p_student).sum(dim=-1).mean()

    # Temperature correction
    return reverse_kl * (temperature ** 2)
```

### Policy Gradient Optimization

**Challenge**: Reverse KL requires sampling from teacher.

**Solution**: Use policy gradient with teacher samples.

```python
def minillm_policy_gradient(student_model, teacher_model, prompt_batch):
    """
    MiniLLM training with policy gradient.

    Steps:
    1. Sample responses from teacher
    2. Compute reverse KL using those samples
    3. Optimize student to cover teacher's distribution
    """
    # 1. Generate from teacher (detached)
    with torch.no_grad():
        teacher_outputs = teacher_model.generate(
            prompt_batch,
            max_new_tokens=256,
            do_sample=True,
            temperature=1.0,
            return_dict_in_generate=True,
            output_scores=True
        )

        teacher_sequences = teacher_outputs.sequences
        teacher_scores = teacher_outputs.scores

    # 2. Student evaluates teacher's samples
    student_outputs = student_model(
        input_ids=teacher_sequences,
        labels=teacher_sequences
    )

    # 3. Policy gradient loss
    # Maximize student's likelihood on teacher's samples
    loss = -student_outputs.logits.mean()

    return loss
```

## Training Procedure

### Two-Stage MiniLLM

**Stage 1**: Imitation learning (reverse KLD)
```python
# Learn to generate like teacher
for epoch in range(num_imitation_epochs):
    for batch in dataloader:
        # Sample from teacher
        teacher_samples = teacher.generate(batch['prompts'])

        # Student imitates
        loss = reverse_kl_loss(
            student(teacher_samples).logits,
            teacher(teacher_samples).logits
        )

        loss.backward()
        optimizer.step()
```

**Stage 2**: Self-training (optional)
```python
# Fine-tune on student's own generations
for epoch in range(num_self_train_epochs):
    for batch in dataloader:
        # Student generates
        student_samples = student.generate(batch['prompts'])

        # Self-training loss
        loss = student(student_samples).loss

        loss.backward()
        optimizer.step()
```

### Complete Training Script

```python
from transformers import AutoModelForCausalLM, Trainer, TrainingArguments

def train_minillm(
    teacher_name="meta-llama/Llama-2-70b-hf",
    student_name="meta-llama/Llama-2-7b-hf",
    output_dir="./minillm-7b",
):
    # Load models
    teacher = AutoModelForCausalLM.from_pretrained(teacher_name, torch_dtype=torch.float16, device_map="auto")
    student = AutoModelForCausalLM.from_pretrained(student_name, torch_dtype=torch.float16)

    # Custom trainer with reverse KLD
    class MiniLLMTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False):
            # Generate from teacher
            with torch.no_grad():
                teacher_outputs = teacher.generate(
                    inputs['input_ids'],
                    max_new_tokens=256,
                    do_sample=True,
                    return_dict_in_generate=True,
                    output_scores=True
                )

                teacher_sequences = teacher_outputs.sequences
                teacher_logits = torch.stack(teacher_outputs.scores, dim=1)

            # Student evaluates teacher samples
            student_outputs = model(
                input_ids=teacher_sequences,
                labels=teacher_sequences
            )

            student_logits = student_outputs.logits

            # Reverse KL loss
            loss = reverse_kl_loss(student_logits, teacher_logits)

            return (loss, student_outputs) if return_outputs else loss

    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=5,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=16,
        learning_rate=5e-5,
        warmup_steps=1000,
        logging_steps=100,
        save_steps=1000,
        bf16=True,
    )

    # Train
    trainer = MiniLLMTrainer(
        model=student,
        args=training_args,
        train_dataset=train_dataset,
    )

    trainer.train()
    student.save_pretrained(output_dir)

# Usage
train_minillm(
    teacher_name="meta-llama/Llama-2-70b-hf",
    student_name="meta-llama/Llama-2-7b-hf",
)
```

## Performance Results

**From paper (LLaMA models)**:

| Student | Teacher | Method | MT-Bench Score | AlpacaEval |
|---------|---------|--------|----------------|------------|
| LLaMA-7B | - | Baseline | 5.2 | 55% |
| LLaMA-7B | LLaMA-70B | Forward KL | 5.8 | 62% |
| LLaMA-7B | LLaMA-70B | **MiniLLM (Reverse KL)** | **6.4** | **71%** |

**Key findings**:
- Reverse KL outperforms forward KL by ~10%
- Distilled 7B model approaches 70B performance
- Better diversity and generation quality

## Comparison: Forward vs Reverse KL

### Generation Quality

```python
# Prompt: "Explain quantum computing"

# Forward KL (mode-seeking)
# Student output: "Quantum computing uses quantum bits..."
# → Safe, generic, one mode

# Reverse KL (mode-covering)
# Student output: Multiple diverse valid explanations
# → Covers different valid explanations
# → More creative, diverse
```

### When to Use Each

**Forward KL**:
- Classification tasks
- Single correct answer
- Need deterministic output

**Reverse KL (MiniLLM)**:
- Generative tasks
- Multiple valid outputs
- Need diversity
- Open-ended generation

## Hyperparameters

### Temperature

```python
# Temperature for both teacher and student

T = 1.0  # Standard (from paper)
T = 0.8  # Sharper (less diversity)
T = 1.2  # Softer (more diversity)

# Rule: Use T=1.0 for MiniLLM (higher temps help mode-covering)
```

### Learning Rate

```python
# MiniLLM uses higher LR than standard distillation

lr_forward_kl = 2e-5   # Standard distillation
lr_minillm = 5e-5      # MiniLLM (can handle higher LR)

# Reason: Reverse KL has better gradient properties
```

## Limitations

1. **Computational cost**: Requires sampling from teacher during training
2. **Implementation complexity**: More complex than standard distillation
3. **Memory**: Need to store teacher samples

## Resources

- **Paper**: https://arxiv.org/abs/2306.08543
- **GitHub**: https://github.com/microsoft/LMOps/tree/main/minillm
- **Blog**: https://www.microsoft.com/en-us/research/blog/minillm-small-language-models-via-large-language-model-distillation/
