---
title: "Rust Port Delegation Boundary"
summary: "Rust owns native component installation while non-install CLI features continue to delegate to the Node CLI."
topics: [decisions, cli, rust]
sources:
  - id: rust-main
    type: file
    path: cli-rust/src/main.rs
  - id: rust-cli
    type: file
    path: cli-rust/src/cli.rs
  - id: rust-delegate
    type: file
    path: cli-rust/src/commands/delegate.rs
  - id: rust-readme
    type: file
    path: cli-rust/README.md
---

# Rust Port Delegation Boundary

The Rust `cct` port is intentionally narrow: it handles component installation natively and forwards everything else to the existing Node CLI. That boundary lets the project improve the high-use install path without reimplementing dashboards, sandbox launchers, global agent management, stats, health checks, or interactive setup before the Rust port has proven parity [@rust-main] [@rust-readme].

## Status

Accepted. The active Rust entrypoint checks for install flags and runs Rust install code only when one of those flags is present; otherwise it delegates the original arguments to Node [@rust-main] [@rust-cli].

## Context

The Node CLI already owns a broad command surface beyond direct component installation. The Rust CLI mirrors many of those flags in Clap, including templates, dashboards, analytics, global agents, stats, health checks, sandbox options, and other UI modes, but its native boundary is the component install set [@rust-cli].

The Rust README describes the port as a core preview focused on agents, commands, MCPs, settings, hooks, and skills, with non-install features delegated for now [@rust-readme]. The existing architecture page [Rust CLI Native Core](../../architecture/cli/rust-cli-native-core) describes the native install behavior in more detail.

## Decision

Rust handles only the direct component install path. `Cli::has_install_flags()` returns true for `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, or `--skill`; `main.rs` uses that result to choose `run_install()` instead of delegation [@rust-cli] [@rust-main].

`--workflow` is modeled in the Rust argument surface, but it is not itself the native dispatch trigger. It is passed into `MultiSpec.workflow_yaml` only after an install flag has already selected the native path [@rust-main] [@rust-cli].

All other invocations delegate verbatim to Node. Delegation first honors `CCT_NODE_BIN`, running JavaScript paths through `node` and executable paths directly; if that environment variable is absent, Rust falls back to `npx -y claude-code-templates@latest` with the original forwarded arguments [@rust-delegate].

## Consequences

The boundary keeps Rust and Node behavior comparable. Native install work can focus on parity with [Component Install Flow](../../architecture/cli/component-install-flow), while dashboard, sandbox, global agent, stats, health, and setup behavior keep using the implementation that already exists in Node [@rust-main] [@rust-readme].

Rust must preserve delegation fidelity. Because the original arguments are captured before parsing and forwarded unchanged, non-install behavior depends on not rewriting or filtering those arguments before `delegate_to_node()` runs [@rust-main] [@rust-delegate].

The boundary also creates an explicit future migration path. A feature should move from delegated to native only when the Rust CLI adds a deliberate native dispatch condition and parity work for that feature, rather than because the flag is already present in `cli.rs` [@rust-cli] [@rust-readme].
