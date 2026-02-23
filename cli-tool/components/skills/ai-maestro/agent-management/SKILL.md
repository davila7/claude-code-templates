---
name: agent-management
description: Create, manage, and orchestrate AI agents using the AI Maestro CLI. Use when the user asks to "create agent", "list agents", "delete agent", "hibernate agent", "wake agent", "install plugin", "show agent", "restart agent", or any agent lifecycle management task.
---

# AI Maestro Agent Management

Create, manage, and orchestrate multiple AI agents through a unified CLI. Handles the full agent lifecycle: create, hibernate, wake, rename, export/import, and plugin management. Part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) suite.

## Prerequisites

Requires [AI Maestro](https://github.com/23blocks-OS/ai-maestro) running locally with tmux 3.0+.

```bash
# Install the CLI
git clone https://github.com/23blocks-OS/ai-maestro-plugins.git
cd ai-maestro-plugins && ./install-agent-cli.sh
```

## Core Commands

### Agent Lifecycle

| Command | Description |
|---------|-------------|
| `aimaestro-agent.sh list` | List all agents with status |
| `aimaestro-agent.sh show <agent>` | Detailed agent information |
| `aimaestro-agent.sh create <name> --dir <path>` | Create new agent |
| `aimaestro-agent.sh update <agent> --task "..."` | Update task/tags |
| `aimaestro-agent.sh delete <agent> --confirm` | Delete agent |
| `aimaestro-agent.sh rename <old> <new>` | Rename agent |
| `aimaestro-agent.sh hibernate <agent>` | Save state, free resources |
| `aimaestro-agent.sh wake <agent>` | Resume hibernated agent |
| `aimaestro-agent.sh restart <agent>` | Hibernate then wake |

### Plugin Management

| Command | Description |
|---------|-------------|
| `aimaestro-agent.sh plugin install <agent> <plugin>` | Install plugin |
| `aimaestro-agent.sh plugin uninstall <agent> <plugin>` | Remove plugin |
| `aimaestro-agent.sh plugin list <agent>` | List installed plugins |
| `aimaestro-agent.sh plugin marketplace add <agent> <source>` | Add marketplace |

### Export/Import

| Command | Description |
|---------|-------------|
| `aimaestro-agent.sh export <agent>` | Export agent config |
| `aimaestro-agent.sh import <file>` | Import agent from file |

## Usage Examples

```bash
# Create a backend API agent
aimaestro-agent.sh create backend-api \
  --dir ~/projects/backend \
  --task "Build REST API with TypeScript" \
  --tags "api,typescript"

# End of day -- save resources
aimaestro-agent.sh hibernate frontend-ui
aimaestro-agent.sh hibernate data-processor

# Resume next morning
aimaestro-agent.sh wake frontend-ui --attach

# Install a plugin on an agent
aimaestro-agent.sh plugin install backend-api my-plugin

# Backup before risky changes
aimaestro-agent.sh export backend-api -o backup.json
```

## Agent Statuses

| Status | Meaning |
|--------|---------|
| `online` | Running in tmux session |
| `offline` | Registered but no active session |
| `hibernated` | Saved state, session killed |

## Full AI Maestro Experience

This skill is part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) platform, which provides **6 skills** for AI agent orchestration: messaging, memory, docs, graph, planning, and agent management.
