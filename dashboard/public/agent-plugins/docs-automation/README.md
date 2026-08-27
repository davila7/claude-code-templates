# docs-automation

Documentation automation pack seeded from the docs-sweep-loop — the loop plus the documentation engineer agent and docs/PR commands it references.

This is an [Agent Plugins](https://agent-plugins.org) v1.0.0 bundle generated from
[claude-code-templates](https://github.com/davila7/claude-code-templates) (aitmpl.com).

## Contents

- agents (Claude Code, via `com.aitmpl.claude-code`): documentation/documentation-engineer
- commands (Claude Code, via `com.aitmpl.claude-code`): documentation/update-docs, git-workflow/create-pr
- loops (Claude Code, via `com.aitmpl.claude-code`): engineering/docs-sweep-loop

## Install

- Any Agent Plugins client: point it at this directory (skills and `mcp.json` load per the spec).
- Claude Code: the bundled `.claude-plugin/plugin.json` makes this directory a native Claude Code plugin.

MCP env values like `<personal-access-token>` are placeholders — replace them with your own
credentials before starting the servers. Never commit real secrets.
