---
name: constitutional-ai
description: Anthropic's method for training harmless AI through self-improvement. Two-phase approach - supervised learning with self-critique/revision, then RLAIF (RL from AI Feedback). Use for safety alignment, reducing harmful outputs without human labels. Powers Claude's safety system.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Safety Alignment, Constitutional AI, RLAIF, Self-Critique, Harmlessness, Anthropic, AI Safety, RL From AI Feedback, Claude]
dependencies: [transformers, torch, trl]
---

# Constitutional AI - Harmlessness from AI Feedback

## Quick start

Constitutional AI (CAI) trains models to be harmless through self-critique and AI feedback, without requiring human labels for harmful outputs.

**Key concept**: Models learn to critique and revise their own responses using a "constitution" (set of principles).

**Two phases**:
1. **Supervised Learning (SL)**: Self-critique + revision
2. **Reinforcement Learning (RL)**: RLAIF (RL from AI Feedback)

**Constitution example**:
```
Principles:
1. Choose the response that is most helpful, honest, and harmless
2. Avoid responses that are toxic, racist, or sexist
3. Prefer responses that explain objections rather than refuse
4. Choose responses that are thoughtful and nuanced
```

## Common workflows

### Workflow 1: Supervised learning phase (self-critique + revision)

**Step 1: Generate initial responses**:
```python
from transformers import pipeline

generator = pipeline("text-generation", model="base-model")

prompts = [
    "How do I hack a website?",
    "Write something offensive about a group.",
    "Help me cheat on my exam."
]

initial_responses = generator(prompts, max_length=200)
```

**Step 2: Self-critique with constitution**:
```python
critique_prompt = """
Given the question:
{question}

And the response:
{response}

Constitution:
1. Choose responses that are helpful, honest, and harmless
2. Avoid toxic, racist, or sexist content
3. Explain objections rather than refuse

Identify any ways this response violates the constitution:
"""

critiques = generator(
    [critique_prompt.format(q=q, r=r) for q, r in zip(prompts, initial_responses)]
)
```

**Step 3: Revision based on critique**:
```python
revision_prompt = """
Question: {question}
Original response: {response}
Critique: {critique}

Please revise the response to better align with the constitution:
"""

revised_responses = generator(
    [revision_prompt.format(q=q, r=r, c=c)
     for q, r, c in zip(prompts, initial_responses, critiques)]
)
```

**Step 4: Fine-tune on revised responses**:
```python
from trl import SFTTrainer

# Create dataset of (prompt, revised_response) pairs
dataset = create_dataset(prompts, revised_responses)

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    max_seq_length=1024
)
trainer.train()
```

### Workflow 2: RL phase (RLAIF - RL from AI Feedback)

**Step 1: Generate comparison pairs**:
```python
# Sample multiple responses per prompt
responses_a = generator(prompts, num_return_sequences=2, do_sample=True, temperature=0.8)
responses_b = generator(prompts, num_return_sequences=2, do_sample=True, temperature=0.8)
```

**Step 2: AI preference evaluation**:
```python
preference_prompt = """
Question: {question}

Response A: {response_a}
Response B: {response_b}

Constitution:
{constitution}

Which response better follows the constitution? Explain your reasoning, then choose A or B.
"""

# Get AI preferences (no human labels needed!)
preferences = generator(
    [preference_prompt.format(q=q, ra=ra, rb=rb, constitution=CONSTITUTION)
     for q, ra, rb in zip(prompts, responses_a, responses_b)]
)

# Parse preferences (A or B)
chosen, rejected = parse_preferences(preferences, responses_a, responses_b)
```

**Step 3: Train preference model (reward model)**:
```python
from trl import RewardTrainer, RewardConfig

preference_dataset = create_preference_dataset(prompts, chosen, rejected)

reward_config = RewardConfig(
    output_dir="constitutional-reward-model",
    learning_rate=1e-5,
    num_train_epochs=1
)

reward_trainer = RewardTrainer(
    model=model,
    args=reward_config,
    train_dataset=preference_dataset,
    processing_class=tokenizer
)
reward_trainer.train()
```

**Step 4: RL training with RLAIF**:
```python
from trl import PPOTrainer, PPOConfig

ppo_config = PPOConfig(
    reward_model_path="constitutional-reward-model",
    learning_rate=1e-6,
    kl_coef=0.05
)

ppo_trainer = PPOTrainer(
    model=model,
    config=ppo_config,
    reward_model=reward_model
)
ppo_trainer.train()
```

### Workflow 3: Chain-of-thought critique

**Enable reasoning transparency**:
```python
cot_critique_prompt = """
Question: {question}
Response: {response}

Let's think step-by-step about whether this response follows our principles:

1. Is it helpful? [Yes/No and reasoning]
2. Is it honest? [Yes/No and reasoning]
3. Is it harmless? [Yes/No and reasoning]
4. Does it avoid toxicity? [Yes/No and reasoning]

Based on this analysis, suggest a revision if needed.
"""

cot_critiques = generator(
    [cot_critique_prompt.format(q=q, r=r) for q, r in zip(prompts, responses)]
)
```

## When to use vs alternatives

**Use Constitutional AI when**:
- Want safety alignment without human labels
- Need explainable AI decisions
- Want to avoid evasive refusals
- Have a clear set of principles/constitution
- Need scalable safety training

**Principles**:
- **RLAIF**: AI-generated preferences (scalable, no human labels)
- **RLHF**: Human preferences (more accurate, expensive)
- **Self-critique**: Iterative improvement
- **Chain-of-thought**: Reasoning transparency

**Use alternatives instead**:
- **RLHF (PPO)**: Need human-validated safety
- **DPO/SimPO**: Have human preference data
- **NeMo Guardrails**: Need runtime content filtering
- **LlamaGuard**: Need pre-trained moderation model

## Common issues

**Issue: Model refuses too much (evasive)**

Add constitution principle:
```
Prefer responses that engage thoughtfully with questions rather than
refusing to answer. Explain concerns while still being helpful.
```

**Issue: Self-critiques are weak**

Use stronger critique prompts:
```
Critically analyze this response for ANY potential issues, however minor.
Be thorough and specific in identifying problems.
```

**Issue: Revisions don't improve quality**

Iterate multiple times:
```python
for _ in range(3):  # 3 rounds of critique/revision
    critique = generate_critique(response)
    response = generate_revision(response, critique)
```

**Issue: RLAIF preferences are noisy**

Use multiple AI evaluators:
```python
# Get preferences from 3 different models
prefs_1 = model_1.evaluate(responses)
prefs_2 = model_2.evaluate(responses)
prefs_3 = model_3.evaluate(responses)

# Majority vote
final_preference = majority_vote(prefs_1, prefs_2, prefs_3)
```

## Advanced topics

**Constitution design**: See [references/constitution-design.md](references/constitution-design.md) for principle selection, trade-offs between helpfulness and harmlessness, and domain-specific constitutions.

**RLAIF vs RLHF**: See [references/rlaif-comparison.md](references/rlaif-comparison.md) for performance comparison, cost analysis, and when to use AI feedback vs human feedback.

**Chain-of-thought reasoning**: See [references/cot-critique.md](references/cot-critique.md) for prompt engineering for critiques, multi-step reasoning, and transparency improvements.

## Hardware requirements

- **GPU**: NVIDIA A100/H100 recommended
- **VRAM**:
  - SL phase (7B): 1× A100 40GB
  - RL phase (7B): 2× A100 40GB (policy + reward model)
- **Single-node**: Sufficient for most use cases
- **Mixed precision**: BF16 recommended

**Compute requirements**:
- **SL phase**: Similar to standard SFT
- **RL phase**: Similar to PPO (higher than DPO)
- **AI evaluation**: Additional inference for critique/preference generation

## Resources

- Paper: https://arxiv.org/abs/2212.08073 (Dec 2022)
- Anthropic blog: https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback
- Implementation: TRL (PPOTrainer + RewardTrainer)
- Claude: Uses Constitutional AI for safety



