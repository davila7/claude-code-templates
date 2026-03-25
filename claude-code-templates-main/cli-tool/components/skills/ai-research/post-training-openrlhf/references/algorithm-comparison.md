# Algorithm Comparison

Complete guide to RL algorithms in OpenRLHF: PPO, REINFORCE++, GRPO, RLOO, and their variants.

## Overview

OpenRLHF supports 6 RL algorithms selectable via `--advantage_estimator`:
- **gae** - PPO with Generalized Advantage Estimation
- **reinforce** - REINFORCE++ (PPO optimizations without critic)
- **reinforce_baseline** - REINFORCE++ with baseline
- **group_norm** - GRPO (Group Normalized Policy Optimization)
- **dr_grpo** - Dr. GRPO (GRPO without std normalization)
- **rloo** - Reinforcement Learning with Online Off-policy Correction

## Algorithm Details

### PPO (Proximal Policy Optimization)

**Formula**:
```
loss = -min(ratio * advantages, clip(ratio, 1-ε, 1+ε) * advantages)
ratio = π_new(a|s) / π_old(a|s)
```

**Characteristics**:
- **Stability**: High (clipped objective prevents large updates)
- **Memory**: High (stores actor + critic experiences)
- **Speed**: Medium (critic training overhead)
- **Requires**: Critic network for value estimation

**Implementation**:
```python
surr1 = ratio * advantages
surr2 = ratio.clamp(1 - clip_eps_low, 1 + clip_eps_high) * advantages
loss = -torch.min(surr1, surr2)
```

**When to use**:
- General-purpose RLHF
- Complex reward functions
- Need stable training

**Hyperparameters**:
```bash
--advantage_estimator gae  # Enable PPO
--clip_eps_low 0.2         # Clipping lower bound
--clip_eps_high 0.2        # Clipping upper bound
--actor_learning_rate 1e-6
--critic_learning_rate 9e-6
--init_kl_coef 0.01
```

### REINFORCE++

**Formula**:
```
loss = -ratio * advantages  (with PPO-clip)
advantages = cumulative_returns - baseline
```

**Characteristics**:
- **Stability**: Higher than GRPO
- **Memory**: Lower (no critic network)
- **Speed**: Faster than PPO
- **Requires**: No critic network

**Key innovation**: Integrates PPO optimizations (advantage normalization, PPO-clip loss) into REINFORCE while eliminating critic network overhead.

**When to use**:
- Want PPO stability without critic
- Limited memory budget
- Fast training priority

**Hyperparameters**:
```bash
--advantage_estimator reinforce
--critic_pretrain None  # No critic needed
--init_kl_coef 0.01
--actor_learning_rate 1e-6
```

### REINFORCE++-baseline

**Formula**:
```
rewards = rewards - mean(rewards_same_prompt)
```

**Characteristics**:
- **Stability**: Very high
- **Memory**: Lower (no critic)
- **Speed**: Faster than PPO
- **Requires**: Multiple samples per prompt

**Key innovation**: Uses mean reward of multiple samples from same prompt as baseline to reshape rewards.

**When to use**:
- RLVR (Reinforcement Learning via Verifier Rewards) settings
- Reward patterns vary (0/1/-0.5)
- Multiple samples per prompt available

**Hyperparameters**:
```bash
--advantage_estimator reinforce_baseline
--n_samples_per_prompt 4  # Must be > 1
--init_kl_coef 0.01
```

### GRPO (Group Normalized Policy Optimization)

**Formula**:
```
rewards = (rewards - mean(rewards)) / (std(rewards) + 1e-9)
loss = -ratio * normalized_advantages
KL loss (optional): k1, k2, or k3 estimator
```

**Characteristics**:
- **Stability**: Lower than REINFORCE++
- **Memory**: Lower (no critic)
- **Speed**: Fast
- **Requires**: Group reward normalization

**Key innovation**: Group-based advantage normalization with optional KL loss.

**When to use**:
- Exploring policy optimization variants
- Need reward normalization
- Memory-constrained

**Hyperparameters**:
```bash
--advantage_estimator group_norm
--use_kl_loss                # Enable KL loss
--kl_estimator k3            # k3 for loss, k2 ≈ k1
--init_kl_coef 0.01
--no_advantage_std_norm      # Optional: disable std norm
```

**KL estimator variance**:
- **k3**: Larger variance under categorical distribution
- **k1, k2**: Similar variance, k2 ≈ k1 for loss

### Dr. GRPO

**Formula**:
```
rewards = rewards - mean(rewards)  # No std normalization
```

**Characteristics**:
- **Stability**: Similar to GRPO
- **Memory**: Lower (no critic)
- **Speed**: Fast
- **Requires**: Group mean normalization only

**Key innovation**: Removes local group normalization `/std` from GRPO (not needed in RL variance reduction theory).

**When to use**:
- GRPO variant experimentation
- Avoid std normalization issues

**Hyperparameters**:
```bash
--advantage_estimator dr_grpo
--init_kl_coef 0.01
```

### RLOO (RL with Online Off-policy Correction)

**Formula**:
```
baseline = (sum(rewards) - rewards) / (n_samples - 1)
rewards = rewards - baseline
loss = -ratio * advantages  (with PPO-clip)
```

**Characteristics**:
- **Stability**: High (PPO-clip)
- **Memory**: Lower (no critic)
- **Speed**: Fast
- **Requires**: Multiple samples per prompt, per-token KL

**Key innovation**: Incorporates per-token KL reward and PPO-clip loss.

**When to use**:
- Need per-token KL rewards
- Want PPO stability without critic
- Multiple samples per prompt

**Hyperparameters**:
```bash
--advantage_estimator rloo
--n_samples_per_prompt 4  # Must be > 1
--init_kl_coef 0.01
```

## Comparison Table

| Algorithm | Critic | Stability | Memory | Speed | Best For |
|-----------|--------|-----------|--------|-------|----------|
| PPO | ✅ Yes | ⭐⭐⭐⭐⭐ | High | Medium | General purpose |
| REINFORCE++ | ❌ No | ⭐⭐⭐⭐ | Low | **Fast** | Critic-free PPO |
| REINFORCE++-baseline | ❌ No | ⭐⭐⭐⭐⭐ | Low | **Fast** | RLVR settings |
| GRPO | ❌ No | ⭐⭐⭐ | Low | Fast | Reward normalization |
| Dr. GRPO | ❌ No | ⭐⭐⭐ | Low | Fast | GRPO variant |
| RLOO | ❌ No | ⭐⭐⭐⭐ | Low | Fast | Per-token KL |

## Experience Data Structure

**PPO (with critic)**:
```python
@dataclass
class Experience:
    sequences: torch.Tensor       # Token sequences
    attention_mask: torch.Tensor  # Attention masks
    action_mask: torch.Tensor     # Action masks
    action_log_probs: torch.Tensor # Log π(a|s)
    values: torch.Tensor          # Critic value estimates
    returns: torch.Tensor         # Cumulative returns
    advantages: torch.Tensor      # GAE advantages
    reward: float                 # Total reward
    kl: torch.Tensor             # KL divergence
```

**REINFORCE++ (no critic)**:
```python
# No values, returns, or advantages stored
# Only sequences, log_probs, and rewards
```

## Memory Comparison (7B Model)

| Algorithm | Components | Memory (8× A100) |
|-----------|-----------|------------------|
| PPO | Actor + Critic + Reward + Ref | ~40GB |
| REINFORCE++ | Actor + Reward + Ref | ~28GB |
| GRPO | Actor + Reward + Ref | ~28GB |
| RLOO | Actor + Reward + Ref | ~28GB |

**Savings**: ~30% memory reduction without critic

## Speed Comparison

**Relative training time** (7B model, 1000 steps):
- PPO: 1.0× baseline
- REINFORCE++: **0.75×** (25% faster)
- GRPO: 0.80×
- RLOO: 0.80×

**Why REINFORCE++ is faster**:
- No critic training
- No value function updates
- Fewer backward passes

## Choosing an Algorithm

### Decision Tree

```
Need maximum stability?
  ├─ Yes → PPO (with critic)
  └─ No ↓

Have multiple samples per prompt?
  ├─ Yes ↓
  │   └─ RLVR setting with varying rewards?
  │       ├─ Yes → REINFORCE++-baseline
  │       └─ No → RLOO (if need per-token KL)
  └─ No ↓

Want faster than PPO?
  └─ Yes → REINFORCE++ (most stable critic-free)

Experimenting with normalization?
  └─ Yes → GRPO or Dr. GRPO
```

### By Use Case

**Production deployment**:
```bash
# Maximum stability
--advantage_estimator gae  # PPO
--clip_eps_low 0.2
--init_kl_coef 0.01
```

**Memory-constrained**:
```bash
# No critic, stable
--advantage_estimator reinforce  # REINFORCE++
--critic_pretrain None
```

**RLVR / Verification rewards**:
```bash
# Baseline reward shaping
--advantage_estimator reinforce_baseline
--n_samples_per_prompt 4
```

**Research / Experimentation**:
```bash
# Explore GRPO variants
--advantage_estimator group_norm
--use_kl_loss --kl_estimator k3
```

## Advanced Configuration

### Reward Normalization

**PPO (no manual normalization)**:
```bash
--advantage_estimator gae
# GAE handles advantage normalization
```

**GRPO (group normalization)**:
```bash
--advantage_estimator group_norm
--normalize_reward  # Optional additional normalization
```

**Disable std normalization**:
```bash
--no_advantage_std_norm  # Keep mean norm only
```

### KL Penalty Configuration

**All algorithms support**:
```bash
--init_kl_coef 0.01    # Initial KL coefficient
--kl_target 0.1        # Target KL divergence
--kl_horizon 10000     # Steps to reach target
```

**GRPO-specific**:
```bash
--use_kl_loss          # Enable KL loss term
--kl_estimator k3      # Loss function choice
```

### Clipping Configuration

**PPO clipping**:
```bash
--clip_eps_low 0.2     # Lower bound
--clip_eps_high 0.2    # Upper bound
```

**Reward clipping**:
```bash
--reward_clip_range 10.0  # Clip rewards to [-10, 10]
```

## Common Issues

### PPO Instability

**Symptom**: Large policy updates, divergence

**Solution**: Reduce clipping range
```bash
--clip_eps_low 0.1     # Reduce from 0.2
--clip_eps_high 0.1
```

### GRPO High Variance

**Symptom**: Unstable training with GRPO

**Solution**: Switch to REINFORCE++
```bash
--advantage_estimator reinforce  # More stable
```

### Memory OOM with PPO

**Symptom**: OOM during critic training

**Solution**: Switch to critic-free
```bash
--advantage_estimator reinforce  # No critic
--critic_pretrain None
```

### RLOO/Baseline Requires Multiple Samples

**Symptom**: `AssertionError: n_samples_per_prompt must be > 1`

**Solution**:
```bash
--n_samples_per_prompt 4  # Minimum 2, recommended 4-8
```

## References

- PPO paper: https://arxiv.org/abs/1707.06347
- GRPO paper: https://arxiv.org/abs/2402.03300
- OpenRLHF: https://github.com/OpenRLHF/OpenRLHF
- OpenRLHF paper: https://arxiv.org/abs/2405.11143
