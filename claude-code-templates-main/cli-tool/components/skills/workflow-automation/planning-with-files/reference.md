# Reference: Manus Context Engineering Principles

This skill is based on the context engineering principles from Manus, the AI agent company acquired by Meta for $2 billion in December 2025.

## The 6 Manus Principles

### 1. Filesystem as External Memory

> "Markdown is my 'working memory' on disk."

**Problem:** Context windows have limits. Stuffing everything in context degrades performance and increases costs.

**Solution:** Treat the filesystem as unlimited memory:
- Store large content in files
- Keep only paths in context
- Agent can "look up" information when needed
- Compression must be REVERSIBLE

### 2. Attention Manipulation Through Repetition

**Problem:** After ~50 tool calls, models forget original goals ("lost in the middle" effect).

**Solution:** Keep a `task_plan.md` file that gets RE-READ throughout execution:
```
Start of context: [Original goal - far away, forgotten]
...many tool calls...
End of context: [Recently read task_plan.md - gets ATTENTION!]
```

By reading the plan file before each decision, goals appear in the attention window.

### 3. Keep Failure Traces

> "Error recovery is one of the clearest signals of TRUE agentic behavior."

**Problem:** Instinct says hide errors, retry silently. This wastes tokens and loses learning.

**Solution:** KEEP failed actions in the plan file:
```markdown
## Errors Encountered
- [2025-01-03] FileNotFoundError: config.json not found → Created default config
- [2025-01-03] API timeout → Retried with exponential backoff, succeeded
```

The model updates its internal understanding when seeing failures.

### 4. Avoid Few-Shot Overfitting

> "Uniformity breeds fragility."

**Problem:** Repetitive action-observation pairs cause drift and hallucination.

**Solution:** Introduce controlled variation:
- Vary phrasings slightly
- Don't copy-paste patterns blindly
- Recalibrate on repetitive tasks

### 5. Stable Prefixes for Cache Optimization

**Problem:** Agents are input-heavy (100:1 ratio). Every token costs money.

**Solution:** Structure for cache hits:
- Put static content FIRST
- Append-only context (never modify history)
- Consistent serialization

### 6. Append-Only Context

**Problem:** Modifying previous messages invalidates KV-cache.

**Solution:** NEVER modify previous messages. Always append new information.

## The Agent Loop

Manus operates in a continuous loop:

```
1. Analyze → 2. Think → 3. Select Tool → 4. Execute → 5. Observe → 6. Iterate → 7. Deliver
```

### File Operations in the Loop:

| Operation | When to Use |
|-----------|-------------|
| `write` | New files or complete rewrites |
| `append` | Adding sections incrementally |
| `edit` | Updating specific parts (checkboxes, status) |
| `read` | Reviewing before decisions |

## Manus Statistics

| Metric | Value |
|--------|-------|
| Average tool calls per task | ~50 |
| Input-to-output ratio | 100:1 |
| Acquisition price | $2 billion |
| Time to $100M revenue | 8 months |

## Key Quotes

> "If the model improvement is the rising tide, we want Manus to be the boat, not the piling stuck on the seafloor."

> "For complex tasks, I save notes, code, and findings to files so I can reference them as I work."

> "I used file.edit to update checkboxes in my plan as I progressed, rather than rewriting the whole file."

## Source

Based on Manus's official context engineering documentation:
https://manus.im/de/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
