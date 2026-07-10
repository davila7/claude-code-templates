---
title: "Component System"
summary: "The component system is the repository's shared model for reusable Claude Code assets and the CLI paths that install them."
topics: [concepts]
sources:
  - id: readme-components
    type: file
    path: README.md
  - id: claude-component-types
    type: file
    path: CLAUDE.md
  - id: components-dir
    type: file
    path: cli-tool/components/
  - id: cli-dispatch
    type: file
    path: cli-tool/src/index.js
---

# Component System

The component system is the collection of reusable Claude Code assets stored under `cli-tool/components/` and installed by the Node CLI. In this repository, "component" means more than one file format: agents, commands, MCP server configs, settings, hooks, skills, loops, templates, plugins, and sandbox assets all participate in the user-facing catalog and install workflows [@claude-component-types] [@components-dir]. This concept matters because the CLI, catalog, dashboard, review rules, and analytics all need the same mental model for what can be selected, installed, counted, and validated.

## What Counts As A Component

The public README describes Claude Code Templates as a collection of ready-to-use agents, commands, settings, hooks, MCP integrations, and project templates for Claude Code [@readme-components]. The repository guidance expands that list with loops, skills, and templates, and records approximate catalog scale for each major type [@claude-component-types].

Most components live in category folders below `cli-tool/components/`. The checked-in tree has top-level directories for `agents`, `commands`, `mcps`, `settings`, `hooks`, `skills`, `loops`, and `sandbox`, plus component marketplace metadata under `cli-tool/components/.claude-plugin/` [@components-dir]. Those directories are not just organization. They are the source layout used by the CLI install code and the catalog generator.

## Runtime Shape

The CLI treats component installs as an early dispatch path. If the parsed options include `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, `--skill`, or `--loop`, `createClaudeConfig()` routes to `installMultipleComponents()` instead of the project setup template flow [@cli-dispatch]. That keeps direct component installation separate from interactive project setup and from dashboard, stats, sandbox, and analytics commands [@cli-dispatch].

Each type has its own install behavior. Agents and commands are downloaded as Markdown and written into flat `.claude/agents/` or `.claude/commands/` folders, even when their source path includes a category [@cli-dispatch]. MCP components are JSON files merged into `.mcp.json` after each server description is stripped from the runtime config [@cli-dispatch]. Settings and hooks are merged into selected Claude settings locations, with local settings as the default when no shared location is supplied [@cli-dispatch]. Skills are downloaded as whole directories and must contain `SKILL.md`; loops are Markdown files that may auto-install referenced agents, commands, skills, hooks, settings, and MCPs from their frontmatter [@cli-dispatch].

## Why The Concept Exists

The component system lets the repository expose one catalog while still preserving different runtime contracts. A command is a Markdown slash command, an MCP is a JSON server config, a setting may target user, project, local, or managed settings, and a skill is a directory with progressive-disclosure files [@cli-dispatch]. Calling all of these "components" gives the CLI and dashboard a common vocabulary without pretending the install mechanics are identical.

This is also why [Template vs Component Installation](template-vs-component-installation) is a separate concept. Templates set up a project configuration. Components add selected assets or config fragments. The same catalog can include both, but the CLI handles them through different code paths [@cli-dispatch].

## Related Boundaries

Component authors also have to think about quality and telemetry. [Component Quality Gates](component-quality-gates) explains the review and security checks that protect the component catalog. [Download Tracking Privacy](download-tracking-privacy) explains how component installs are counted without making telemetry part of the install's success path.
