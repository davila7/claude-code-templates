---
title: "Template vs Component Installation"
summary: "Template installation creates a project setup, while component installation adds selected reusable Claude Code assets."
topics: [concepts, components, cli]
sources:
  - id: template-config
    type: file
    path: cli-tool/src/templates.js
  - id: file-operations
    type: file
    path: cli-tool/src/file-operations.js
  - id: cli-install-flow
    type: file
    path: cli-tool/src/index.js
---

# Template vs Component Installation

Template installation and component installation are two different ways the CLI writes Claude Code configuration. A template is a project setup recipe selected by language and optional framework, then copied from `cli-tool/templates`; a component install is a direct request for one or more reusable assets from the [Component System](component-system) [@template-config] [@cli-install-flow]. The distinction matters because templates decide a baseline project configuration, while components add specific agents, commands, MCPs, settings, hooks, skills, or loops without running the full setup flow.

## Template Installation

Templates are defined in `TEMPLATES_CONFIG`. The base `common` template writes a `CLAUDE.md`, while language templates such as JavaScript/TypeScript, Python, and Ruby include files like `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, and optional framework command directories [@template-config]. Some language entries, such as Rust and Go, are marked `comingSoon`, so the setup flow can reject them before copying files [@template-config].

The setup path detects project information, selects a language and framework, builds a template config, and copies the selected files [@cli-install-flow]. `copyTemplateFiles()` downloads template files from the repository's GitHub `main` branch under `cli-tool/templates`, checks for existing Claude configuration files, and either backs up, merges, skips, or cancels depending on the user's choice [@file-operations]. Template copying can filter selected hooks and MCPs into settings and MCP config files before writing them [@file-operations].

Template installation also has a post-installation validation path. After files are copied, the CLI can prompt to run Claude Code with a generated validation prompt that asks it to review the installed configuration against the detected project [@file-operations].

## Component Installation

Direct component installation starts earlier in `createClaudeConfig()`. If the user passes any component flag, the CLI routes directly to `installMultipleComponents()` and returns from setup dispatch [@cli-install-flow]. That path parses comma-separated values for agents, commands, MCPs, settings, hooks, skills, and loops, counts the requested items, and installs each type with its type-specific function [@cli-install-flow].

Component installs fetch from `cli-tool/components`, not `cli-tool/templates` [@cli-install-flow]. Agents and commands are written as Markdown files. MCPs are merged into `.mcp.json`. Settings and hooks are merged into user, project, local, or managed settings locations. Skills are installed as directories under `.claude/skills/`. Loops are installed under `.claude/loops/` and can install referenced components automatically [@cli-install-flow].

## Practical Difference

Use a template when the user wants a whole project baseline: a `CLAUDE.md`, default settings, selected hooks, selected MCPs, and framework commands [@template-config] [@file-operations]. Use component installation when the user already knows which assets they want, such as one agent, a hook, a skill, or a batch of components [@cli-install-flow].

The catalog can show both because both are installable, but they are not interchangeable. Templates are setup recipes. Components are catalog items with their own install rules. That boundary keeps the CLI from treating a framework setup like a single agent, and it keeps direct component installs from unexpectedly overwriting a project's baseline setup [@cli-install-flow] [@file-operations].
