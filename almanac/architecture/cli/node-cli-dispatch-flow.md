---
title: "Node CLI Dispatch Flow"
summary: "How the Node CLI maps Commander options into early-return command handlers and falls back to interactive project setup."
topics: [architecture, cli]
sources:
  - id: node-bin
    type: file
    path: cli-tool/bin/create-claude-config.js
  - id: node-dispatch
    type: file
    path: cli-tool/src/index.js
  - id: cli-package
    type: file
    path: cli-tool/package.json
  - id: root-package
    type: file
    path: package.json
---

The Node CLI dispatch flow is the main public command path for `claude-code-templates`. The npm binaries all land in `cli-tool/bin/create-claude-config.js`, Commander parses the option surface, and the action calls `createClaudeConfig(options)` in `cli-tool/src/index.js` after showing the banner for normal commands [@node-bin]. Inside `createClaudeConfig()`, command-specific modes return early before project setup begins, so dashboards, stats, component installs, sandbox runs, global-agent operations, session cloning, health checks, and template setup share one entrypoint without sharing one runtime path [@node-dispatch].

## Entry Point And Aliases

The published Node package exposes several binary names, including `create-claude-config`, `claude-code-templates`, `claude-init`, and `cct`, all pointing to the same Node script [@cli-package]. The repository root package also exposes `claude-code-templates` and `cct` through `cli-tool/bin/create-claude-config.js`, which keeps the workspace-level package aligned with the CLI package entrypoint [@root-package].

The binary owns argument parsing, version reporting, banner display, and top-level error handling. It imports Commander, registers every public option, calls `showBanner(pkg.version)` for non-quiet commands, then awaits `createClaudeConfig(options)` [@node-bin]. If the handler throws, the binary prints the error, sends it to error reporting with the `createClaudeConfig` command label, and exits with status 1 [@node-bin].

## Dispatch Order

`createClaudeConfig()` starts by resolving the target directory from `--directory` or the current working directory, then rejects `--tunnel` unless it accompanies one of the supported dashboard modes [@node-dispatch]. After that, the function is mostly an ordered set of early-return handlers. Studio and sandbox run first, then direct component installation, workflow installation, global agent operations, stats commands, dashboard commands, session cloning, and health checks [@node-dispatch].

The order matters because some flags can coexist. Component flags are checked before standalone workflow handling, and `--workflow` is converted to `options.yaml` when used with direct component flags, making it part of the component install path instead of the hash-based workflow path [@node-dispatch]. Sandbox is checked before component installation, so sandbox execution owns a prompt-bearing sandbox run before normal installers can consume the same options [@node-dispatch].

## Interactive Setup Boundary

If no specific mode is selected, the CLI enters an interactive menu unless the user passed setup-driving flags such as `--yes`, `--language`, `--framework`, or `--dry-run` [@node-dispatch]. The menu can launch analytics, chats, agents, health check, or project setup, and it recursively returns to setup when health check recommends it [@node-dispatch].

Project setup is the final fallback path. It detects the project, picks defaults in `--yes` mode, gathers interactive answers otherwise, builds a template config, installs selected agents, copies template files, optionally tracks template installation, runs post-install validation, and finally executes `--prompt` if one was supplied outside sandbox mode [@node-dispatch].

## Collaborators

The dispatcher is intentionally thin around feature modules. It delegates dashboards to analytics, chats, plugin, skill, and team dashboard modules; delegates global agents to the SDK global-agent manager; delegates stats to command, hook, and MCP stats modules; and delegates template copying to file operations [@node-dispatch]. Component installation is the main large body still embedded in `index.js`, and its behavior is detailed in [Component Install Flow](component-install-flow) [@node-dispatch].

The Rust port keeps this Node dispatcher relevant: the native CLI handles install flags itself but forwards non-install features to the Node CLI, so the Node dispatch flow remains the compatibility owner for dashboards, sandbox, stats, health checks, global agents, and interactive setup [@node-dispatch]. That split is covered in [Rust CLI Native Core](rust-cli-native-core).

## Invariants And Failure Modes

The main invariant is one selected mode per invocation. Early returns prevent later setup code from running after a command-specific handler completes [@node-dispatch]. A second invariant is that tracking is advisory: command and dashboard handlers call the tracking service, but the dispatcher does not depend on tracking success before continuing [@node-dispatch].

The most visible failures happen before or inside the selected handler. Invalid tunnel usage prints an error and returns without running anything else [@node-dispatch]. Handler exceptions propagate to the binary-level catch block, which reports the error and exits non-zero [@node-bin]. Health check is a special case: if it finds no setup recommendation, the CLI returns to the main menu instead of falling into setup [@node-dispatch].
