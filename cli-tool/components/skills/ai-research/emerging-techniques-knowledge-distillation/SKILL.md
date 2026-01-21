---
name: knowledge-distillation
description: Compress large language models using knowledge distillation from teacher to student models. Use when deploying smaller models with retained performance, transferring GPT-4 capabilities to open-source models, or reducing inference costs. Covers temperature scaling, soft targets, reverse KLD, logit distillation, and MiniLLM training strategies.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Emerging Techniques, Knowledge Distillation, Model Compression, Teacher-Student, MiniLLM, Reverse KLD, Soft Targets, Temperature Scaling, Logit Distillation, Model Transfer]
dependencies: [transformers, torch, datasets]
---

# Knowledge Distillation: Compressing LLMs

## When to Use This Skill

Use Knowledge Distillation when you need to:
- **Compress models** from 70B → 7B while retaining 90%+ performance
- **Transfer capabilities** from proprietary models (GPT-4) to open-source (LLaMA, Mistral)
- **Reduce inference costs** by deploying smaller student models
- **Create specialized models** by distilling domain-specific knowledge
- **Improve small models** using synthetic data from large teachers

**Key Techniques**: Temperature scaling, soft targets, reverse KLD (MiniLLM), logit distillation, response distillation

**Papers**: Hinton et al. 2015 (arXiv 1503.02531), MiniLLM (arXiv 2306.08543), KD Survey (arXiv 2402.13116)

## Installation

```bash
# Standard transformers
pip install transformers datasets accelerate

# For training
pip install torch deepspeed wandb

# Optional: MiniLLM implementation
git clone https://github.com/microsoft/LMOps
cd LMOps/minillm
pip install -e .
```

## Quick Start

### Basic Knowledge Distillation

```python
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

# 1. Load teacher (large) and student (small) models
teacher = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",  # Large teacher
    torch_dtype=torch.float16,
    device_map="auto"
)

student = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",  # Small student
    torch_dtype=torch.float16,
    device_map="cuda:0"
)

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-70b-hf")

# 2. Define distillation loss
def distillation_loss(student_logits, teacher_logits, labels, temperature=2.0, alpha=0.5):
    """
    Combine hard loss (cross-entropy) with soft loss (KL divergence).

    Args:
        temperature: Softens probability distributions (higher = softer)
        alpha: Weight for distillation loss (1-alpha for hard loss)
    """
    # Hard loss: Standard cross-entropy with true labels
    hard_loss = F.cross_entropy(student_logits.view(-1, student_logits.size(-1)), labels.view(-1))

    # Soft loss: KL divergence between student and teacher
    soft_targets = F.softmax(teacher_logits / temperature, dim=-1)
    soft_student = F.log_softmax(student_logits / temperature, dim=-1)
    soft_loss = F.kl_div(soft_student, soft_targets, reduction='batchmean') * (temperature ** 2)

    # Combined loss
    return alpha * soft_loss + (1 - alpha) * hard_loss

# 3. Training loop
for batch in dataloader:
    # Teacher forward (no grad)
    with torch.no_grad():
        teacher_outputs = teacher(**batch)
        teacher_logits = teacher_outputs.logits

    # Student forward
    student_outputs = student(**batch)
    student_logits = student_outputs.logits

    # Compute distillation loss
    loss = distillation_loss(
        student_logits,
        teacher_logits,
        batch['labels'],
        temperature=2.0,
        alpha=0.7  # 70% soft, 30% hard
    )

    # Backward and optimize
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

### MiniLLM (Reverse KLD)

**Source**: arXiv 2306.08543 (2024)

**Innovation**: Use reverse KLD instead of forward KLD for better generative model distillation.

```python
def reverse_kl_loss(student_logits, teacher_logits, temperature=1.0):
    """
    Reverse KL divergence: KL(Teacher || Student)
    Better for generative models than forward KL.
    """
    # Teacher distribution (target)
    p_teacher = F.softmax(teacher_logits / temperature, dim=-1)

    # Student distribution (model)
    log_p_student = F.log_softmax(student_logits / temperature, dim=-1)

    # Reverse KL: Sum over teacher, student learns to cover teacher's modes
    reverse_kl = -(p_teacher * log_p_student).sum(dim=-1).mean()

    return reverse_kl * (temperature ** 2)

# Training with MiniLLM
for batch in dataloader:
    with torch.no_grad():
        teacher_logits = teacher(**batch).logits

    student_logits = student(**batch).logits

    # Reverse KLD (better for generation)
    loss = reverse_kl_loss(student_logits, teacher_logits, temperature=1.0)

    loss.backward()
    optimizer.step()
```

**Why reverse KL?**
- **Forward KL** (standard): Student learns to match teacher's *mean*
- **Reverse KL** (MiniLLM): Student learns to *cover* all teacher's modes
- Better for diverse text generation

### Response Distillation

```python
# Generate synthetic data from teacher, train student to imitate

# 1. Generate synthetic responses from teacher
prompts = ["Explain AI:", "What is ML?", "Define NLP:"]

teacher_responses = []
for prompt in prompts:
    inputs = tokenizer(prompt, return_tensors='pt').to(teacher.device)
    outputs = teacher.generate(**inputs, max_new_tokens=256, do_sample=True, temperature=0.7)
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    teacher_responses.append(response)

# 2. Train student on teacher's responses (standard fine-tuning)
train_dataset = [
    {"text": f"{prompt}\n{response}"}
    for prompt, response in zip(prompts, teacher_responses)
]

# 3. Fine-tune student
trainer = Trainer(
    model=student,
    args=TrainingArguments(output_dir="./student", num_train_epochs=3, learning_rate=2e-5),
    train_dataset=train_dataset,
)
trainer.train()
```

## Core Concepts

### 1. Temperature Scaling

**Purpose**: Soften probability distributions to expose teacher's uncertainty.

```python
# Low temperature (T=1): Sharp distribution
logits = [3.0, 2.0, 1.0]
probs_T1 = softmax(logits / 1.0)  # [0.67, 0.24, 0.09]

# High temperature (T=4): Soft distribution
probs_T4 = softmax(logits / 4.0)  # [0.42, 0.34, 0.24]

# Higher T reveals more information about relative rankings
```

**Rule**: Use T=2-5 for distillation (2 is common default).

### 2. Loss Function Components

```python
# Total loss = alpha * soft_loss + (1 - alpha) * hard_loss

# Soft loss: Learn from teacher's knowledge
soft_loss = KL(student || teacher)

# Hard loss: Learn from ground truth labels
hard_loss = CrossEntropy(student_output, true_labels)

# Typical values:
alpha = 0.5  # Balanced
alpha = 0.7  # More emphasis on teacher
alpha = 0.3  # More emphasis on labels
```

### 3. Forward vs Reverse KLD

```python
# Forward KL: KL(Student || Teacher)
# - Student matches teacher's average behavior
# - Mode-seeking: Student focuses on teacher's highest probability modes
# - Good for classification

# Reverse KL: KL(Teacher || Student)
# - Student covers all of teacher's behaviors
# - Mode-covering: Student learns diverse behaviors
# - Good for generation (MiniLLM)
```

## Training Strategies

### Strategy 1: Logit Distillation

```python
# Train student to match teacher's logits directly

def logit_distillation_trainer(student, teacher, dataloader, temperature=2.0):
    optimizer = torch.optim.AdamW(student.parameters(), lr=2e-5)

    for epoch in range(3):
        for batch in dataloader:
            # Get logits
            with torch.no_grad():
                teacher_logits = teacher(**batch).logits

            student_logits = student(**batch).logits

            # MSE on logits (alternative to KLD)
            loss = F.mse_loss(student_logits, teacher_logits)

            # Or use KLD
            # loss = F.kl_div(
            #     F.log_softmax(student_logits/temperature, dim=-1),
            #     F.softmax(teacher_logits/temperature, dim=-1),
            #     reduction='batchmean'
            # ) * (temperature ** 2)

            loss.backward()
            optimizer.step()
            optimizer.zero_grad()

    return student
```

### Strategy 2: Two-Stage Distillation

```python
# Stage 1: Distill from teacher
student = distill(teacher, student, epochs=5)

# Stage 2: Fine-tune on task-specific data
student = fine_tune(student, task_data, epochs=3)

# Results in better task performance than single-stage
```

### Strategy 3: Multi-Teacher Distillation

```python
# Learn from multiple expert teachers

def multi_teacher_distillation(student, teachers, batch):
    """Distill from ensemble of teachers."""
    teacher_logits_list = []

    # Get logits from all teachers
    with torch.no_grad():
        for teacher in teachers:
            logits = teacher(**batch).logits
            teacher_logits_list.append(logits)

    # Average teacher predictions
    avg_teacher_logits = torch.stack(teacher_logits_list).mean(dim=0)

    # Student learns from ensemble
    student_logits = student(**batch).logits
    loss = F.kl_div(
        F.log_softmax(student_logits, dim=-1),
        F.softmax(avg_teacher_logits, dim=-1),
        reduction='batchmean'
    )

    return loss
```

## Production Deployment

### Complete Training Script

```python
from transformers import Trainer, TrainingArguments, DataCollatorForLanguageModeling

def train_distilled_model(
    teacher_name="meta-llama/Llama-2-70b-hf",
    student_name="meta-llama/Llama-2-7b-hf",
    output_dir="./distilled-llama-7b",
    temperature=2.0,
    alpha=0.7,
):
    # Load models
    teacher = AutoModelForCausalLM.from_pretrained(teacher_name, torch_dtype=torch.float16, device_map="auto")
    student = AutoModelForCausalLM.from_pretrained(student_name, torch_dtype=torch.float16)
    tokenizer = AutoTokenizer.from_pretrained(teacher_name)

    # Custom trainer with distillation
    class DistillationTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False):
            # Student forward
            outputs_student = model(**inputs)
            student_logits = outputs_student.logits

            # Teacher forward (no grad)
            with torch.no_grad():
                outputs_teacher = teacher(**inputs)
                teacher_logits = outputs_teacher.logits

            # Distillation loss
            soft_targets = F.softmax(teacher_logits / temperature, dim=-1)
            soft_student = F.log_softmax(student_logits / temperature, dim=-1)
            soft_loss = F.kl_div(soft_student, soft_targets, reduction='batchmean') * (temperature ** 2)

            # Hard loss
            hard_loss = outputs_student.loss

            # Combined
            loss = alpha * soft_loss + (1 - alpha) * hard_loss

            return (loss, outputs_student) if return_outputs else loss

    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        learning_rate=2e-5,
        warmup_steps=500,
        logging_steps=100,
        save_steps=1000,
        bf16=True,
        gradient_checkpointing=True,
    )

    # Train
    trainer = DistillationTrainer(
        model=student,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    trainer.train()
    student.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

# Usage
train_distilled_model(
    teacher_name="meta-llama/Llama-2-70b-hf",
    student_name="meta-llama/Llama-2-7b-hf",
    temperature=2.0,
    alpha=0.7
)
```

## Best Practices

### 1. Hyperparameter Selection

```python
# Temperature
T = 1.0  # Sharp (less knowledge transfer)
T = 2.0  # Standard (good balance)
T = 5.0  # Soft (more knowledge transfer)

# Alpha (weight)
alpha = 0.5  # Balanced
alpha = 0.7  # Emphasize teacher knowledge
alpha = 0.9  # Strong distillation

# Rule: Higher T + higher alpha = stronger distillation
```

### 2. Model Size Ratio

```python
# Good ratios (teacher/student)
70B / 7B = 10×    # Excellent
13B / 1B = 13×    # Good
7B / 1B = 7×      # Acceptable

# Avoid too large gap
70B / 1B = 70×    # Too large, ineffective
```

### 3. Data Quality

```python
# Best: Use teacher-generated data + real data
train_data = {
    "teacher_generated": 70%,  # Diverse, high-quality
    "real_data": 30%            # Ground truth
}

# Avoid: Only real data (doesn't utilize teacher fully)
```

## Evaluation

```python
from transformers import pipeline

# Compare student vs teacher
teacher_pipe = pipeline("text-generation", model=teacher)
student_pipe = pipeline("text-generation", model=student)

prompts = ["Explain quantum computing:", "What is AI?"]

for prompt in prompts:
    teacher_out = teacher_pipe(prompt, max_new_tokens=100)
    student_out = student_pipe(prompt, max_new_tokens=100)

    print(f"Prompt: {prompt}")
    print(f"Teacher: {teacher_out[0]['generated_text']}")
    print(f"Student: {student_out[0]['generated_text']}")
    print(f"Match quality: {calculate_similarity(teacher_out, student_out):.2f}")
```

## Resources

- **Hinton et al. 2015 (Foundational)**: https://arxiv.org/abs/1503.02531
- **MiniLLM (Reverse KLD)**: https://arxiv.org/abs/2306.08543
- **KD Survey for LLMs (2024)**: https://arxiv.org/abs/2402.13116
- **MiniLLM GitHub**: https://github.com/microsoft/LMOps/tree/main/minillm


