# Custom Reward Functions

Complete guide to implementing custom reward functions and agent RLHF in OpenRLHF.

## Overview

OpenRLHF supports two paradigms for custom rewards:
1. **Reinforced Fine-Tuning (RFT)** - Custom reward function for single-step generation
2. **Agent RLHF** - Multi-step environment interaction with feedback loops

## Reinforced Fine-Tuning (RFT)

### Basic Concept

Instead of using a pre-trained reward model, define your own reward logic to evaluate model outputs.

**Enable RFT**:
```bash
--remote_rm_url ./reward_func.py  # Path to custom reward function
--label_key answers                # Pass additional info (e.g., ground truth)
```

### Reward Function API

**Template** (`reward_func.py`):
```python
import torch

def reward_func(queries, prompts, labels):
    """
    Args:
        queries: List[str] - Full prompts + generated responses
        prompts: List[str] - Original prompts only
        labels: List[str] - Ground truth answers (from --label_key)

    Returns:
        dict with:
            "rewards": torch.Tensor - Rewards for advantage calculation
            "scores": torch.Tensor - Scores (0-1) for dynamic filtering
            "extra_logs": dict - Additional metrics for W&B logging
    """
    # Your reward calculation logic here
    rewards = torch.tensor([...])

    return {
        "rewards": rewards,
        "scores": rewards,
        "extra_logs": {"custom_metric": rewards}
    }
```

### Example 1: Code Generation Rewards

**Evaluate code correctness via execution**:
```python
# reward_func_code_gen.py
import torch
import subprocess
import tempfile
import os

def reward_func(queries, prompts, labels):
    """Reward based on code execution and test passing."""
    rewards = []

    for query, prompt, label in zip(queries, prompts, labels):
        # Extract generated code (after prompt)
        generated_code = query.split(prompt)[-1].strip()

        try:
            # Write code to temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(generated_code)
                temp_file = f.name

            # Execute code and run tests
            result = subprocess.run(
                ["python", "-m", "pytest", temp_file],
                capture_output=True,
                text=True,
                timeout=5
            )

            # Reward based on test results
            if "passed" in result.stdout:
                rewards.append(1.0)  # All tests passed
            elif "failed" in result.stdout:
                rewards.append(0.3)  # Some tests failed
            else:
                rewards.append(0.0)  # No tests passed

        except subprocess.TimeoutExpired:
            rewards.append(-0.5)  # Code execution timeout
        except Exception as e:
            rewards.append(-1.0)  # Syntax error or crash
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    rewards_tensor = torch.tensor(rewards).float()
    return {
        "rewards": rewards_tensor,
        "scores": (rewards_tensor + 1.0) / 2.0,  # Normalize to [0, 1]
        "extra_logs": {
            "code_correctness": rewards_tensor,
            "avg_correctness": rewards_tensor.mean()
        }
    }
```

**Training command**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --remote_rm_url ./reward_func_code_gen.py \
  --label_key test_cases \
  --pretrain codellama/CodeLlama-7b-Instruct-hf \
  --prompt_data code-generation-dataset \
  --advantage_estimator reinforce \
  # ... other args
```

### Example 2: Math Reasoning Rewards

**Check final answer correctness**:
```python
# reward_func_math.py
import torch
import re

def reward_func(queries, prompts, labels):
    """Reward based on mathematical correctness."""
    rewards = []

    for query, prompt, label in zip(queries, prompts, labels):
        generated_answer = query.split(prompt)[-1].strip()
        expected_answer = label  # Ground truth answer

        # Extract numerical answer from various formats
        # Format 1: "The answer is: 42"
        match1 = re.search(r"(?:answer is:?|=)\s*(-?\d+\.?\d*)", generated_answer, re.IGNORECASE)
        # Format 2: "#### 42" (GSM8K format)
        match2 = re.search(r"####\s*(-?\d+\.?\d*)", generated_answer)

        extracted_answer = None
        if match1:
            extracted_answer = match1.group(1)
        elif match2:
            extracted_answer = match2.group(1)

        # Calculate reward
        if extracted_answer is None:
            rewards.append(-0.5)  # No answer found
        else:
            try:
                if abs(float(extracted_answer) - float(expected_answer)) < 1e-6:
                    rewards.append(1.0)  # Correct answer
                else:
                    rewards.append(0.0)  # Incorrect answer
            except ValueError:
                rewards.append(-0.5)  # Malformed answer

    rewards_tensor = torch.tensor(rewards).float()
    return {
        "rewards": rewards_tensor,
        "scores": (rewards_tensor + 0.5) / 1.5,  # Normalize to [0, 1]
        "extra_logs": {
            "math_accuracy": (rewards_tensor == 1.0).float().mean(),
            "answer_formatted": (rewards_tensor >= 0.0).float().mean()
        }
    }
```

**Training command**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --remote_rm_url ./reward_func_math.py \
  --label_key answers \
  --pretrain deepseek-ai/deepseek-math-7b-base \
  --prompt_data gsm8k \
  --advantage_estimator reinforce_baseline \
  --n_samples_per_prompt 4 \
  # ... other args
```

### Example 3: Conversation Quality Rewards

**Use sentiment/quality model**:
```python
# reward_func_conversation.py
import torch
from transformers import pipeline

# Load quality evaluation model (once, outside reward_func if possible)
quality_scorer = pipeline("text-classification", model="OpenAssistant/reward-model-deberta-v3-large")

def reward_func(queries, prompts, labels):
    """Reward based on conversation quality (helpfulness, safety)."""
    rewards = []

    for query, prompt, label in zip(queries, prompts, labels):
        conversation = query  # Full conversation up to this point

        # Score conversation quality using reward model
        result = quality_scorer(conversation)[0]
        score = result['score'] if result['label'] == 'LABEL_1' else 1 - result['score']

        # Optional: Additional heuristics
        # - Check for harmful content
        # - Verify answer relevance
        # - Measure coherence

        # Penalize very short responses
        response = query.split(prompt)[-1].strip()
        if len(response.split()) < 10:
            score *= 0.5

        rewards.append(score)

    rewards_tensor = torch.tensor(rewards).float()
    return {
        "rewards": rewards_tensor,
        "scores": rewards_tensor,  # Already in [0, 1]
        "extra_logs": {
            "avg_quality": rewards_tensor.mean(),
            "min_quality": rewards_tensor.min(),
            "max_quality": rewards_tensor.max()
        }
    }
```

**Training command**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --remote_rm_url ./reward_func_conversation.py \
  --pretrain meta-llama/Llama-3-8b-Instruct \
  --prompt_data OpenAssistant/oasst1 \
  --advantage_estimator gae \
  # ... other args
```

### Dynamic Filtering

**Use `scores` for sample filtering**:
```python
def reward_func(queries, prompts, labels):
    rewards = calculate_rewards(...)  # Your reward logic

    # Filter: Keep only samples with score > 0.5
    scores = (rewards > 0.0).float()

    return {
        "rewards": rewards,      # For advantage calculation
        "scores": scores,        # For dynamic filtering (0 or 1)
        "extra_logs": {"filtered_ratio": scores.mean()}
    }
```

## Agent RLHF (Multi-Step)

### Basic Concept

Train language models as agents that interact with environments over multiple steps, receiving feedback after each action.

**Enable Agent RLHF**:
```bash
--async_train                      # Enable async mode
--agent_func_path ./agent_func.py  # Path to agent definition
```

### Agent API

**Template** (`agent_func.py`):
```python
from openrlhf.utils.agent import AgentExecutorBase, AgentInstanceBase
import torch
from typing import Dict, Any

class AgentInstance(AgentInstanceBase):
    """Manages state for a single agent episode."""

    async def __init__(self, *args, **kwargs):
        self.step_idx = 0
        self.max_steps = 5  # Maximum environment steps

    async def reset(self, states: dict, **kwargs):
        """Reset environment for new episode."""
        return {"observation": states["observation"]}

    async def step(self, states: dict, **kwargs) -> Dict[str, Any]:
        """Execute one environment step."""
        observation_text = states["observation_text"]
        action_text = states["action_text"]
        label = states["label"]

        # Your environment logic here
        done = self.step_idx >= self.max_steps
        reward = calculate_reward(action_text, label) if done else 0.0

        # Environment feedback for next step
        if done:
            environment_feedback = "\n\n[EPISODE COMPLETE]\n</s>"
        else:
            environment_feedback = "\n\nNext step:\n</s>\n\nAssistant: "

        self.step_idx += 1

        return {
            "rewards": torch.tensor([reward]),
            "scores": torch.tensor([reward]),
            "environment_feedback": environment_feedback,
            "done": done,
            "sampling_params": states.get("sampling_params", None),
            "extra_logs": {"step": self.step_idx}
        }

class AgentExecutor(AgentExecutorBase):
    """Orchestrates agent execution."""

    def __init__(self, max_steps, max_length, llm_engine, hf_tokenizer, result_queue):
        super().__init__(AgentInstance, max_steps, max_length, llm_engine, hf_tokenizer, result_queue)

    async def execute(self, prompt, label, sampling_params):
        # Override for custom execution logic
        return await super().execute(prompt, label, sampling_params)
```

### Example: Math Problem Solving Agent

**Multi-step reasoning with verification**:
```python
# agent_func_math.py
from openrlhf.utils.agent import AgentExecutorBase, AgentInstanceBase
import torch
import re

class AgentInstance(AgentInstanceBase):
    async def __init__(self, *args, **kwargs):
        self.step_idx = 0
        self.max_steps = 3  # Allow 3 attempts
        self.steps_taken = []

    async def reset(self, states: dict, **kwargs):
        self.step_idx = 0
        self.steps_taken = []
        return {"observation": states["observation"]}

    async def step(self, states: dict, **kwargs):
        observation_text = states["observation_text"]
        action_text = states["action_text"]
        label = states["label"]  # Correct answer

        self.steps_taken.append(action_text)

        # Extract answer from current step
        match = re.search(r"(?:answer is:?|=)\s*(-?\d+\.?\d*)", action_text, re.IGNORECASE)

        if match:
            try:
                answer = float(match.group(1))
                correct = abs(answer - float(label)) < 1e-6

                if correct:
                    # Correct answer - episode done
                    done = True
                    reward = 1.0
                    feedback = "\n\n[CORRECT! Episode complete]\n</s>"
                else:
                    # Incorrect but attempt made
                    done = self.step_idx >= self.max_steps - 1
                    reward = 0.0 if not done else -0.3  # Penalty if max steps reached
                    feedback = "\n\n[INCORRECT] Try again. Think step-by-step:\n</s>\n\nAssistant: "
            except ValueError:
                # Malformed answer
                done = self.step_idx >= self.max_steps - 1
                reward = -0.5 if done else 0.0
                feedback = "\n\n[INVALID FORMAT] Provide numerical answer:\n</s>\n\nAssistant: "
        else:
            # No answer found
            done = self.step_idx >= self.max_steps - 1
            reward = -0.5 if done else 0.0
            feedback = "\n\n[NO ANSWER FOUND] Please state the final answer:\n</s>\n\nAssistant: "

        self.step_idx += 1

        return {
            "rewards": torch.tensor([reward]),
            "scores": torch.tensor([max(0.0, reward + 0.5)]),  # Normalize to [0, 1]
            "environment_feedback": feedback,
            "done": done,
            "sampling_params": states.get("sampling_params", None),
            "extra_logs": {
                "step": self.step_idx,
                "correct": reward == 1.0,
                "attempts": len(self.steps_taken)
            }
        }

class AgentExecutor(AgentExecutorBase):
    def __init__(self, max_steps, max_length, llm_engine, hf_tokenizer, result_queue):
        super().__init__(AgentInstance, max_steps, max_length, llm_engine, hf_tokenizer, result_queue)
```

**Training command**:
```bash
ray job submit --address="http://127.0.0.1:8265" \
  -- python3 -m openrlhf.cli.train_ppo_ray \
  --async_train \
  --agent_func_path ./agent_func_math.py \
  --label_key answers \
  --pretrain deepseek-ai/deepseek-math-7b-base \
  --prompt_data gsm8k \
  --advantage_estimator reinforce \
  --max_steps 3 \
  # ... other args
```

### Token-in-Token-out Principle

**Important**: Agent RLHF uses token-level processing to ensure consistency between sampling and training.

**Why**: Text-level processing can cause mismatches between generated tokens and training samples.

**Implementation**:
- `environment_feedback` is tokenized and concatenated
- Maintains alignment throughout multi-step episode
- Prevents token/text inconsistencies

## Best Practices

### Reward Function Design

**1. Normalize rewards**:
```python
# Keep rewards in reasonable range [-1, 1] or [0, 1]
rewards = (raw_rewards - raw_rewards.mean()) / (raw_rewards.std() + 1e-9)
```

**2. Handle errors gracefully**:
```python
try:
    reward = calculate_reward(output)
except Exception as e:
    reward = 0.0  # Neutral reward for errors
    print(f"Error in reward calculation: {e}")
```

**3. Log extensively**:
```python
return {
    "rewards": rewards,
    "scores": scores,
    "extra_logs": {
        "avg_reward": rewards.mean(),
        "max_reward": rewards.max(),
        "error_rate": error_count / len(queries),
        "custom_metric": ...
    }
}
```

### Agent Design

**1. Limit max steps**:
```python
self.max_steps = 5  # Prevent infinite loops
```

**2. Provide informative feedback**:
```python
if error:
    feedback = f"\n\n[ERROR: {error_msg}] Try again:\n</s>\n\nAssistant: "
else:
    feedback = "\n\nContinue:\n</s>\n\nAssistant: "
```

**3. Sparse rewards**:
```python
# Only reward at episode end
reward = final_score if done else 0.0
```

## Debugging

### Print Queries

```python
def reward_func(queries, prompts, labels):
    print(f"Query sample: {queries[0][:200]}")  # First 200 chars
    print(f"Prompt sample: {prompts[0]}")
    print(f"Label sample: {labels[0]}")
    # ... reward logic
```

### Test Locally

```python
# test_reward.py
from reward_func import reward_func
import torch

queries = ["Question: 2+2?\nAnswer: 4"]
prompts = ["Question: 2+2?\n"]
labels = ["4"]

result = reward_func(queries, prompts, labels)
print(result)
```

```bash
python test_reward.py
```

### Monitor W&B

Enable detailed logging:
```bash
--use_wandb {token}
--wandb_project custom-rewards-debug
```

Check `extra_logs` in W&B dashboard.

## References

- OpenRLHF: https://github.com/OpenRLHF/OpenRLHF
- Agent API: `openrlhf/utils/agent.py`
- Remote RM: `openrlhf/utils/remote_rm_utils.py`
