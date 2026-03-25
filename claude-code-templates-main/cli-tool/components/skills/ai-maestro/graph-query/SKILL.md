---
name: graph-query
description: Query the code graph database to understand component relationships, dependencies, and change impact. Use when the user asks to "find callers", "check dependencies", "what uses this", "show relationships", "find serializers", or when reading code and needing to understand what depends on a component before modifications.
---

# AI Maestro Code Graph Query

Query your codebase's dependency graph to understand component relationships, call chains, and the impact of changes before making modifications. Part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) suite.

## Prerequisites

Requires [AI Maestro](https://github.com/23blocks-OS/ai-maestro) running locally with codebase indexed.

```bash
# Install graph tools
git clone https://github.com/23blocks-OS/ai-maestro-plugins.git
cd ai-maestro-plugins && ./install-graph-tools.sh
```

## Core Behavior

After reading any code file, query the graph to understand dependencies:

```
Read file -> Query graph -> Then proceed
```

## Commands

### Query
| Command | Description |
|---------|-------------|
| `graph-describe.sh <name>` | Describe a component or function |
| `graph-find-callers.sh <fn>` | Find all callers of a function |
| `graph-find-callees.sh <fn>` | Find all functions called by this function |
| `graph-find-related.sh <component>` | Find related components |
| `graph-find-by-type.sh <type>` | Find all components of a type |
| `graph-find-serializers.sh <model>` | Find serializers for a model |
| `graph-find-associations.sh <model>` | Find model associations |
| `graph-find-path.sh <from> <to>` | Find call path between functions |

### Index
| Command | Description |
|---------|-------------|
| `graph-index-delta.sh [path]` | Index or update the code graph |

## Component Types

Use with `graph-find-by-type.sh`: `model`, `serializer`, `controller`, `service`, `job`, `concern`, `component`, `hook`

## Usage Examples

```bash
# After reading a model file
graph-describe.sh User
graph-find-serializers.sh User
graph-find-associations.sh User

# Before modifying a function
graph-find-callers.sh process_payment
graph-find-callees.sh process_payment

# Find call chain between components
graph-find-path.sh handleRequest sendResponse

# Index your codebase
graph-index-delta.sh /path/to/project
```

## Why Query Before Modifying

Without checking the graph, you risk:
- Breaking callers when changing a function signature
- Missing serializers that need updating with a model change
- Overlooking child classes that inherit your modifications

## Full AI Maestro Experience

This skill is part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) platform, which provides **6 skills** for AI agent orchestration: messaging, memory, docs, graph, planning, and agent management.
