---
title: "Component Schema Reference"
summary: "Exact authoring and placement rules for the repository's command, agent, MCP, setting, hook, status line, skill, and loop components."
topics: [reference, components]
sources:
  - id: commands-guide
    type: file
    path: cli-tool/docs_to_claude/COMMANDS_GUIDE.md
  - id: agents-guide
    type: file
    path: cli-tool/docs_to_claude/SUBAGENTS_GUIDE.md
  - id: hooks-guide
    type: file
    path: cli-tool/docs_to_claude/HOOKS_GUIDE.md
  - id: statusline-guide
    type: file
    path: cli-tool/docs_to_claude/STATUSLINE_GUIDE.md
  - id: component-dir
    type: file
    path: cli-tool/components/
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
  - id: loop-example
    type: file
    path: cli-tool/components/loops/engineering/build-test-fix-loop.md
  - id: mcp-example
    type: file
    path: cli-tool/components/mcps/database/supabase.json
---

# Component Schema Reference

The component schema is the repository's set of file formats for assets under `cli-tool/components/`: Markdown commands, Markdown agents, JSON MCP servers, JSON settings, JSON hooks, skill directories with `SKILL.md`, loop Markdown files, and sandbox assets [@component-dir]. The generator turns these source files into catalog records by scanning component type folders, reading Markdown frontmatter or JSON metadata, assigning singular `type` values, and preserving raw content in split dashboard artifacts [@catalog-generator]. Use this reference with [Component System](../../concepts/components/component-system), [Add or Change Component](../../guides/components/add-or-change-component), and [Component Inventory](component-inventory).

## Placement

| Type | Source path | Primary file shape |
| --- | --- | --- |
| Agent | `cli-tool/components/agents/{category}/{name}.md` | Markdown file with YAML frontmatter and a system prompt body [@agents-guide] [@catalog-generator] |
| Command | `cli-tool/components/commands/{category}/{name}.md` | Markdown file with optional YAML frontmatter and prompt body [@commands-guide] [@catalog-generator] |
| MCP | `cli-tool/components/mcps/{category}/{name}.json` | JSON object with `mcpServers` entries [@mcp-example] |
| Setting | `cli-tool/components/settings/{category}/{name}.json` | JSON settings fragment; status line settings use a `statusLine` object [@statusline-guide] |
| Hook | `cli-tool/components/hooks/{category}/{name}.json` | JSON settings fragment with a `hooks` object keyed by hook event [@hooks-guide] |
| Skill | `cli-tool/components/skills/{category}/{skill}/SKILL.md` | Directory component whose required entry file is `SKILL.md`; sibling files become catalog `references` [@catalog-generator] |
| Loop | `cli-tool/components/loops/{category}/{name}.md` | Markdown loop page with frontmatter such as `name`, `description`, `category`, `interval`, `stop-condition`, `components`, and `tags` [@loop-example] |

## Markdown Components

Commands map file names to slash commands, so `fix-issue.md` becomes `/fix-issue`; subdirectories provide organization and namespacing in Claude Code's command UI [@commands-guide]. Common command frontmatter fields are `allowed-tools`, `argument-hint`, `description`, `model`, and `disable-model-invocation` [@commands-guide]. The body may use `$ARGUMENTS`, positional arguments such as `$1`, bash interpolation with `!` commands, and file references with `@path` [@commands-guide].

Agents require `name` and `description` in frontmatter, and may also declare `tools` and `model` [@agents-guide]. The `name` uses lowercase letters and hyphens, while the body is the agent's standalone system prompt [@agents-guide]. Project agents live under `.claude/agents/` after installation, while user agents can live under `~/.claude/agents/`; project agents take precedence on conflicts [@agents-guide].

Skills are cataloged differently from agents and commands. The generator looks for `SKILL.md` inside each category and skill directory, uses the directory name as `name`, sets `path` to `category/name`, extracts frontmatter fields such as `description`, `author`, `repo`, `version`, `license`, and `tags`, and records every sibling file other than `SKILL.md` as a sorted `references` list [@catalog-generator].

Loops are Markdown components whose frontmatter describes a repeated workflow. The `build-test-fix-loop` example declares the loop name, description, category, interval, stopping condition, referenced components, and tags before the body explains the goal, run command, iteration steps, guardrails, and referenced components [@loop-example].

## JSON Components

MCP components are JSON files with a top-level `mcpServers` object. The Supabase example defines one server named `supabase` with `description`, `command`, `args`, and `env`, including `SUPABASE_ACCESS_TOKEN` as a placeholder environment value [@mcp-example]. The catalog generator reads the first MCP server description into the component record [@catalog-generator].

Hooks are configured inside Claude settings as event-keyed arrays. Each event entry can contain a `matcher` and a nested `hooks` array, and each hook command uses `type: "command"`, a `command` string, and optional `timeout` [@hooks-guide]. Supported event names include `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, and `PreCompact` [@hooks-guide].

Status lines are settings fragments with `statusLine.type` set to `command`, a `statusLine.command` script, and optional `padding` [@statusline-guide]. The command receives session JSON on stdin with fields for session identity, model, workspace, version, output style, and cost metrics [@statusline-guide].

## Catalog Extraction Rules

For non-skill file components, the generator scans one category level below each component type and accepts `.md` or `.json` files [@catalog-generator]. It derives `name` from the file stem, `path` from `category/file.ext`, `category` from the parent directory, and singular `type` by trimming the trailing `s` from the plural collection name [@catalog-generator]. Markdown descriptions come from frontmatter, while settings and hook descriptions can come from JSON `description` fields [@catalog-generator].

Templates and plugins are part of the wider catalog, but they are not authored with the same component folder schema. Templates come from `cli-tool/templates`, and plugin records come from marketplace metadata when available [@catalog-generator].
