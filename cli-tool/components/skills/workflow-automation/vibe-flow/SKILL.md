---
name: vibe-flow
description: "Multi-agent orchestration for Vibe Kanban: turn a spec into merged code through wave-based parallel dispatch, two-stage code review, and autonomous fix loops. Use when the user wants to plan, ship, review, or merge issues across a vibe-kanban board with Claude Code agents."
author: OAI-Labs
license: MIT
metadata:
  version: "0.2.0"
  homepage: "https://oai-labs.github.io/vibe-flow/"
  repository: "https://github.com/OAI-Labs/vibe-flow"
---

# Vibe Flow

You orchestrate the full spec-to-merge lifecycle on a [vibe-kanban](https://github.com/BloopAI/vibe-kanban) board: planning, parallel agent dispatch, code review, conflict resolution, and merge — with autonomous fix loops.

## Prerequisites

- Claude Code with the [`vibe-kanban`](https://github.com/BloopAI/vibe-kanban) MCP server configured (see install).
- A vibe-kanban project (cloud or self-hosted).
- `gh` CLI authenticated (`gh auth status`).

## Install

This skill is part of the [`vibe-flow` plugin](https://github.com/OAI-Labs/vibe-flow):

```bash
/plugin marketplace add OAI-Labs/vibe-flow
/plugin install vibe-flow@vibe-flow
/reload-plugins
```

Configure the vibe-kanban MCP server in `~/.claude.json`:

```json
{
  "mcpServers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    }
  }
}
```

Then in your repo:

```bash
/vibe-flow:vibe-init
```

## Skills

| Skill | Purpose |
|---|---|
| `/vibe-flow:vibe-init` | First-time setup: pick project, write `.vibe-flow.yaml`, scaffold state dir |
| `/vibe-flow:vibe-plan` | Decompose a spec into an issue tree (epic + sub-issues + deps) |
| `/vibe-flow:vibe-ship` | Wave-based parallel dispatch with executor routing (T0 flash to T4 opus) |
| `/vibe-flow:vibe-link` | Find / open the GitHub PR for a workspace branch, link to issue |
| `/vibe-flow:vibe-review` | Two-stage review (spec compliance to quality), post comments to PR |
| `/vibe-flow:vibe-merge` | Verify CI green, rebase if needed, squash merge, archive workspace |
| `/vibe-flow:vibe-dispatch-fix` | Re-dispatch agent to fix critical review items / CI failures |
| `/vibe-flow:vibe-rebase` | Resolve conflicts against latest main, force-with-lease push |
| `/vibe-flow:vibe-status` | Dashboard of active workspaces + PRs + inconsistencies |
| `/vibe-flow:vibe-standup` | Daily summary (merged / in-review / blocked / in-progress) |
| `/vibe-flow:vibe-flow` | Meta orchestrator: full loop from spec to merged code |

## Complexity routing

Issues are routed to executors by tier:

| Tier | Executor | When |
|---|---|---|
| T0 | GEMINI flash | Typo / copy / hide column |
| T1 | CODEX mini / CLAUDE_CODE sonnet-medium | Simple CRUD, <150 LoC |
| T2 | CLAUDE_CODE sonnet-high | Multi-file, moderate |
| T3 | CLAUDE_CODE opus | Architecture / migration |
| T4 | CLAUDE_CODE opus + brainstorm | Research / RFC |

## Typical flow

1. `/vibe-flow:vibe-init` once per repo.
2. `/vibe-flow:vibe-plan` with a spec creates issue tree on the board.
3. `/vibe-flow:vibe-flow` runs the full loop: plan, ship, link, review, merge.
   - Or run individual skills (`vibe-ship`, `vibe-review`, `vibe-merge`) for finer control.
4. `/vibe-flow:vibe-status` to monitor; `/vibe-flow:vibe-standup` for a daily digest.

## State

`.vibe-flow/state.json` at repo root tracks wave progress, dispatched workspaces, and cost. Auto-resume after crashes.

## Links

- Plugin source: https://github.com/OAI-Labs/vibe-flow
- Documentation: https://oai-labs.github.io/vibe-flow/
- vibe-kanban: https://github.com/BloopAI/vibe-kanban
