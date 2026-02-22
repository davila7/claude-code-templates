---
name: memory-search
description: Search conversation history and semantic memory to recall previous discussions, decisions, and context. Use when the user asks to "search memory", "what did we discuss", "remember when", "find previous conversation", "check history", or before starting work to recall prior decisions.
---

# AI Maestro Memory Search

Search your conversation history using semantic, keyword, and symbol matching. Recall past decisions, discussions, and context across sessions. Part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) suite.

## Prerequisites

Requires [AI Maestro](https://github.com/23blocks-OS/ai-maestro) running locally. Memory indexing uses CozoDB for vector search.

```bash
# Install memory tools
git clone https://github.com/23blocks-OS/ai-maestro-plugins.git
cd ai-maestro-plugins && ./install-memory-tools.sh
```

## Core Behavior

Before starting any task, search memory for relevant context:

```
Receive instruction -> Search memory -> Then proceed
```

## Commands

| Command | Description |
|---------|-------------|
| `memory-search.sh "<query>"` | Hybrid search (recommended) |
| `memory-search.sh "<query>" --mode semantic` | Find conceptually related |
| `memory-search.sh "<query>" --mode term` | Exact text matching |
| `memory-search.sh "<query>" --mode symbol` | Code symbol matching |
| `memory-search.sh "<query>" --role user` | Only user messages |
| `memory-search.sh "<query>" --role assistant` | Only assistant messages |

## Search Modes

| Mode | Best For |
|------|----------|
| `hybrid` (default) | General search, most cases |
| `semantic` | Related concepts, different wording |
| `term` | Exact function/class names |
| `symbol` | Code identifiers across contexts |

## Usage Examples

```bash
# User asks to continue previous work
memory-search.sh "authentication"

# Find a specific component discussion
memory-search.sh "PaymentService" --mode term

# Find related design discussions
memory-search.sh "error handling patterns" --mode semantic

# Find code symbol references
memory-search.sh "processPayment" --mode symbol
```

## Combining with Other Skills

For complete context, pair with docs-search and graph-query:
```bash
memory-search.sh "feature"       # What did we discuss?
docs-search.sh "feature"         # What do docs say?
graph-describe.sh ComponentName  # What is the structure?
```

## Full AI Maestro Experience

This skill is part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) platform, which provides **6 skills** for AI agent orchestration: messaging, memory, docs, graph, planning, and agent management.
