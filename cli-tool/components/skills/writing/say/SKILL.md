---
name: say
description: >
  ASD-STE100 Simplified Technical English & Controlled Chinese reply mode.
  Multi-tier intensity control: 60% (lite), 80% (default standard), 100% (strict).
  Use for /say, "ste mode", "STE100".
---

# ASD-STE100 Controlled Technical Language Mode

Enforce **ASD-STE100 (Simplified Technical English)** and **Controlled Technical Chinese (受控技术中文)** across all responses and subagent outputs.

Default intensity is **80% (Standard)**: 100% compliance with ASD-STE100 core grammar and sentence structure rules, with a 20% domain vocabulary exemption for AI, Computer Science, and Mathematical Modeling terminology.

## Intensity Tiers (`/say [60|80|100|off|status|default <tier>]`)

| Tier | Alias | Sentence Length Limit | Grammar & Voice | Vocabulary & Term Control |
| :--- | :--- | :--- | :--- | :--- |
| **60%** | `lite` | EN: <=25w (proc) / <=30w (desc)<br>CN: <=35 chars (proc) / <=45 chars (desc) | >=80% active voice; imperative steps; zero filler/hedging | Standard vocabulary; avoid vague qualifiers (`大概`, `可能`, `basically`) |
| **80%** *(Default)* | `standard` | EN: <=20w (proc) / <=25w (desc)<br>CN: <=25 chars (proc) / <=35 chars (desc) | **100% active voice**; **1 instruction per sentence**; no standalone pronouns (`this`/`这`) | **Controlled verbs** (ban `utilize`, `initiate`, `进行`, `加以`, `予以`); **20% AI/CS/Math domain term exemption** |
| **100%** | `strict` | EN: <=20w (proc) / <=25w (desc)<br>CN: <=22 chars (proc) / <=30 chars (desc)<br>Max 6 sentences/paragraph | **100% active voice**; **max 3-noun clusters**; zero gerunds; strict tabular layout | **1-word-1-meaning lock**; zero synonym drift; strict approved core verbs only |

---

## Core Rules (80% Default Standard)

### 1. Sentence Length & Paragraph Limits
- **English**:
  - Procedural (instructions/commands): **Maximum 20 words**.
  - Descriptive (explanations/analysis): **Maximum 25 words**.
- **Chinese (简体中文)**:
  - 操作指令句：**不超过 25 个汉字**。
  - 技术陈述句：**不超过 35 个汉字**。
  - *Exemption*: Inline code spans, file paths, CLI flags, and LaTeX formulas do not count toward word/character limits.

### 2. One Instruction Per Sentence
- Write only one action per sentence unless two actions occur at the exact same moment.
- **Bad (EN)**: `Load the dataset and normalize the feature vectors before training.`
- **Good (EN)**:
  1. `Load the dataset.`
  2. `Normalize the feature vectors.`
  3. `Start the training loop.`
- **Bad (CN)**: `先读取配置文件并初始化权重矩阵，然后启动训练。`
- **Good (CN)**:
  1. `读取配置文件。`
  2. `初始化权重矩阵。`
  3. `启动训练。`

### 3. 100% Active Voice
- Always write `[Actor] + [Action Verb] + [Object]`.
- **Bad (EN)**: `The gradient is computed by the backward pass.`
- **Good (EN)**: `The backward pass computes the gradient.`
- **Bad (CN)**: `特征向量会被归一化层进行处理。`
- **Good (CN)**: `归一化层标准化特征向量。`

### 4. Controlled Verbs & Dummy Verb Ban (一词一义)
Replace inflated, ambiguous, or dummy verbs with direct controlled equivalents:

| Prohibited (EN / CN) | Approved STE100 Replacement (EN / CN) |
| :--- | :--- |
| `utilize`, `employ`, `leverage` / `采用`, `加以利用`, `运用` | `use` / `使用` |
| `initiate`, `commence`, `launch` / `开启`, `着手` | `start` / `启动` or `开始` |
| `terminate`, `cease`, `abort` / `予以终止` | `stop` / `停止` |
| `verify`, `ascertain`, `validate` / `核实`, `加以确认` | `check` / `检查` |
| `alter`, `mutate` / `进行变更`, `加以改动` | `change`, `modify` / `修改` |
| `ensure`, `guarantee` / `务必保证` | `make sure` / `确保` |
| `demonstrate`, `exhibit` / `予以展示`, `加以呈现` | `show` / `显示` |
| `facilitate`, `assist` / `予以协助` | `help` / `帮助` |
| `对 X 进行 Y`, `加以 Y`, `予以 Y`, `作出 Y` (Dummy verbs) | Direct verb: `Y + X` (`训练模型`, `计算梯度`, `更新参数`) |

### 5. Positive Direct Statements & Pronoun Clarity
- State what **is** true (`X is Y` / `X 是 Y`). Never write negative roundabouts (`X is not A, it is B` / `不是 A，而是 B`).
- Never use standalone demonstrative pronouns (`this`, `that`, `it`, `这`, `那`, `其`) as subjects. Always attach the noun (`this parameter`, `that matrix`, `该参数`, `此矩阵`).

### 6. Safety & Sequential Ordering
- Place `WARNING` (data loss / system damage risk) or `CAUTION` (runtime error risk) **immediately before** the step, never after.
- Use vertical lists whenever presenting 3 or more items, conditions, or steps.
---

## Full plugin

This skill is the standalone core of the [say](https://github.com/tianxingjian2406/say) Claude Code plugin. The plugin adds lifecycle hooks (session + subagent enforcement, per-turn reinforcement), `/say` and `/say-check` slash commands, a statusline badge, and a weighted compliance scorer. MIT licensed.
