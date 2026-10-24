---
title: "Component Install Flow"
summary: "How direct component installs download repository components, write or merge Claude Code configuration, track outcomes, and optionally run prompts."
topics: [architecture, cli, components]
sources:
  - id: node-install
    type: file
    path: cli-tool/src/index.js
  - id: file-ops
    type: file
    path: cli-tool/src/file-operations.js
  - id: hook-scanner
    type: file
    path: cli-tool/src/hook-scanner.js
  - id: tracking
    type: file
    path: cli-tool/src/tracking-service.js
---

The component install flow is the direct-install path behind flags such as `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, `--skill`, and `--loop`. The Node dispatcher routes any of those flags into `installMultipleComponents()`, which parses comma-separated component lists, prompts once for shared settings locations when needed, runs the type-specific installer for each component, records per-component outcomes, and optionally runs a Claude Code prompt after installation [@node-install]. This path is separate from template setup: it fetches individual components from the GitHub repository at runtime and writes them into `.claude/` or merges them into existing Claude Code configuration [@node-install].

## Runtime Source And Targets

Direct installers build raw GitHub URLs under `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/...`, so the runtime source is the repository's main-branch component tree rather than only files bundled with the npm package [@node-install]. Agents and commands are downloaded as Markdown and installed into flat `.claude/agents/` or `.claude/commands/` filenames; category prefixes are used to fetch the source path but are dropped from the installed filename [@node-install].

MCPs, settings, and hooks are JSON-based and preserve existing user configuration by merging instead of replacing in the common case. MCP installs remove server `description` fields, read an existing `.mcp.json` if present, and merge `mcpServers` so incoming servers are added or override matching names [@node-install]. Settings and hooks can be installed into user, project, local, or enterprise settings files; batch installs collect that location choice once and pass it to each installer [@node-install].

## Type-Specific Behavior

Settings merge top-level fields, permissions, environment variables, and hooks, while detecting conflicts in environment variables and other top-level settings before asking whether to overwrite [@node-install]. They can also install extra files declared by the setting JSON, and statusline settings try to download a matching Python sidecar script [@node-install].

Hooks append hook definitions into the selected settings file and can install optional Python or shell sidecar scripts beside `.claude/hooks/` [@node-install]. The hook merge path treats the current Claude Code hook array shape as the normal case and converts old string-style hooks into matcher objects when needed [@node-install].

Skills use the GitHub contents API recursively, install the complete skill tree under `.claude/skills/<skill-name>/`, and fail validation if `SKILL.md` is not present in the downloaded files [@node-install]. Loops install a Markdown file into `.claude/loops/`, parse their frontmatter `components:` list, and then auto-install referenced agents, commands, skills, hooks, settings, or MCPs using the same installers [@node-install].

## Template Install Contrast

Template setup uses a different helper. `copyTemplateFiles()` downloads from `cli-tool/templates`, prompts about backup, merge, or cancel when existing Claude Code files are found, and handles framework command directories, base `.claude` files, selected hooks, and selected MCPs as template artifacts [@file-ops]. That is why direct installs are best understood as component-level mutation, while template setup is project bootstrap. The dispatch boundary is described in [Node CLI Dispatch Flow](node-cli-dispatch-flow).

Hook and MCP selection during template setup depends on `hook-scanner.js`, which reads hooks from settings JSON, describes them, and provides filtering helpers imported by `file-operations.js` [@hook-scanner]. Direct component installs reuse the same target file formats but do not use the template scanner to discover selections [@node-install].

## Tracking And Failure Handling

Each individual installer tracks both download events and installation outcomes. Download tracking posts component type, name, path, category, and CLI version to the download endpoint, while outcome tracking posts success or failure, error type, duration, and batch id to a separate endpoint [@tracking]. The tracking service is fire-and-forget, has a five-second request timeout, respects opt-out environment variables, and swallows failures so analytics cannot break installation [@tracking].

The installer treats missing components and network or parsing failures differently in user output but reduces both to failed component outcomes [@node-install]. A 404 prints a not-found message and records `not_found`; other download or write errors record `network_error` with the message [@node-install]. Batch installation continues across components and reports whether all, some, or none of the requested components installed [@node-install].

## Invariants

The install flow preserves three important invariants. Category paths identify remote components, but installed agent, command, loop, and skill base directories use the final path segment as the local name [@node-install]. JSON configuration components merge into existing user files instead of blindly replacing them [@node-install]. Prompt execution happens only after a successful direct install flow and is skipped when sandbox mode owns the invocation [@node-install].

The Rust port implements this same component-install boundary natively; see [Rust CLI Native Core](rust-cli-native-core) for the parity-focused implementation.
