---
title: "Public CLI Options"
summary: "Lookup reference for the Node CLI binaries, public flags, aliases, and the Rust CLI's native-versus-delegated handling."
topics: [reference, cli]
sources:
  - id: root-package
    type: file
    path: package.json
  - id: cli-package
    type: file
    path: cli-tool/package.json
  - id: node-bin
    type: file
    path: cli-tool/bin/create-claude-config.js
  - id: rust-cli
    type: file
    path: cli-rust/src/cli.rs
  - id: rust-main
    type: file
    path: cli-rust/src/main.rs
  - id: rust-delegate
    type: file
    path: cli-rust/src/commands/delegate.rs
---

# Public CLI Options

This page is the lookup surface for public `claude-code-templates` CLI names and flags. The Node package exposes the full Commander option set, while the Rust `cct` port handles direct component installation natively and delegates non-install features to the Node CLI [@node-bin] [@rust-cli] [@rust-main]. Use this with [Node CLI Dispatch Flow](../../architecture/cli/node-cli-dispatch-flow), [Rust CLI Native Core](../../architecture/cli/rust-cli-native-core), and [Publish NPM Package](../../guides/release/publish-npm-package).

## Binary Names

| Package file | Public names | Target |
| --- | --- | --- |
| Root `package.json` | `claude-code-templates`, `cct` | `cli-tool/bin/create-claude-config.js` [@root-package] |
| `cli-tool/package.json` | `create-claude-config`, `claude-code-templates`, `claude-code-template`, `claude-init`, `cctemplates`, `cct`, `claude-setup`, `claude-config` | `bin/create-claude-config.js` [@cli-package] |

## Project Setup Flags

These flags are registered by the Node Commander entrypoint [@node-bin]. The Rust parser also declares the same setup flags and delegates them to Node unless a component install flag is present [@rust-cli] [@rust-main].

| Flag | Argument | Purpose |
| --- | --- | --- |
| `-l`, `--language` | `<language>` | Deprecated language selector; use `--template`. |
| `-f`, `--framework` | `<framework>` | Deprecated framework selector; use `--template`. |
| `-t`, `--template` | `<template>` | Template selector such as `common`, `javascript-typescript`, `python`, or `ruby`. |
| `-d`, `--directory` | `<directory>` | Target directory. |
| `-y`, `--yes` | none | Skip prompts and use defaults. |
| `--dry-run` | none | Show planned copies or installs without writing files. |

## Component Install Flags

Node declares the full component install surface, including `--loop` [@node-bin]. Rust currently treats `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, and `--skill` as native install triggers; `--workflow` is native only when combined with those install flags, and non-install invocations delegate to Node [@rust-cli] [@rust-main].

| Flag | Argument | Node handling | Rust handling |
| --- | --- | --- | --- |
| `--agent` | `<agent>` | Install one or more agent components. | Native install trigger. |
| `--command` | `<command>` | Install one or more command components. | Native install trigger. |
| `--mcp` | `<mcp>` | Install one or more MCP components. | Native install trigger. |
| `--setting` | `<setting>` | Install one or more setting components. | Native install trigger. |
| `--hook` | `<hook>` | Install one or more hook components. | Native install trigger. |
| `--skill` | `<skill>` | Install one or more skill components. | Native install trigger. |
| `--loop` | `<loop>` | Install a loop component and its referenced components. | Not declared in the current Rust parser. |
| `--workflow` | `<workflow>` | Install workflow from hash, or base64 YAML when used with component flags. | Stored as workflow YAML when a native install trigger is present. |
| `--prompt` | `<prompt>` | Execute prompt after installation or in sandbox. | Runs `claude -p` after native install when not in sandbox. |

## Dashboards, Stats, And Management

These options are public Node flags and are declared in Rust for delegation [@node-bin] [@rust-cli]. When Rust sees no native install flag, it forwards the original arguments to the Node CLI; `CCT_NODE_BIN` can override the delegated command for local testing, otherwise delegation uses `npx -y claude-code-templates@latest` [@rust-main] [@rust-delegate].

| Area | Flags |
| --- | --- |
| Dashboards | `--analytics`, `--chats`, `--agents`, `--chats-mobile`, `--plugins`, `--skills-manager`, `--teams`, `--2025` |
| Remote access | `--tunnel` |
| Stats | `--command-stats` / `--commands-stats`, `--hook-stats` / `--hooks-stats`, `--mcp-stats` / `--mcps-stats` |
| Health check | `--health-check`, `--health`, `--check`, `--verify` |
| Global agents | `--create-agent <agent>`, `--list-agents`, `--remove-agent <agent>`, `--update-agent <agent>` |
| Studio and sandbox | `--studio`, `--sandbox <provider>`, `--e2b-api-key <key>`, `--anthropic-api-key <key>` |
| Sessions and logging | `--clone-session <url>`, `--verbose` |
