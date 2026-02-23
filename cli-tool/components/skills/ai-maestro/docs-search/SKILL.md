---
name: docs-search
description: Search auto-generated codebase documentation for function signatures, API docs, class definitions, and code comments. Use when the user asks to "search docs", "find documentation", "look up a function", "check the API", or before implementing changes to verify correct signatures and patterns.
---

# AI Maestro Documentation Search

Search your codebase's auto-generated documentation for function signatures, class definitions, API docs, and code comments. Verify correct patterns before writing code. Part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) suite.

## Prerequisites

Requires [AI Maestro](https://github.com/23blocks-OS/ai-maestro) running locally with documentation indexed.

```bash
# Install doc tools
git clone https://github.com/23blocks-OS/ai-maestro-plugins.git
cd ai-maestro-plugins && ./install-doc-tools.sh
```

## Core Behavior

Before implementing any code changes, search docs first:

```
Receive instruction -> Search docs -> Then implement
```

## Commands

### Search
| Command | Description |
|---------|-------------|
| `docs-search.sh <query>` | Semantic documentation search |
| `docs-search.sh --keyword <term>` | Exact keyword matching |
| `docs-find-by-type.sh <type>` | Find by type (function, class, module) |
| `docs-get.sh <doc-id>` | Get full document content |

### Index
| Command | Description |
|---------|-------------|
| `docs-index.sh [path]` | Full index from project |
| `docs-index-delta.sh [path]` | Delta index (new/modified files only) |
| `docs-list.sh` | List all indexed documents |
| `docs-stats.sh` | Index statistics |

## Document Types

| Type | Sources |
|------|---------|
| `function` | JSDoc, RDoc, docstrings |
| `class` | Class-level comments |
| `module` | Module/namespace comments |
| `interface` | TypeScript interfaces |
| `component` | React/Vue component comments |
| `readme` | README files |
| `guide` | docs/ folder content |

## Usage Examples

```bash
# Semantic search
docs-search.sh "authentication flow"

# Keyword search for specific identifier
docs-search.sh --keyword "UserController"

# Find all class documentation
docs-find-by-type.sh class

# Get full document details
docs-get.sh doc-abc123

# Index your codebase (first time)
docs-index.sh /path/to/project

# Update index after changes
docs-index-delta.sh
```

## Full AI Maestro Experience

This skill is part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) platform, which provides **6 skills** for AI agent orchestration: messaging, memory, docs, graph, planning, and agent management.
