---
title: "Rust CLI Native Core"
summary: "How the Rust `cct` binary implements component installation natively while delegating the rest of the CLI surface to Node."
topics: [architecture, cli, rust]
sources:
  - id: rust-main
    type: file
    path: cli-rust/src/main.rs
  - id: rust-cli
    type: file
    path: cli-rust/src/cli.rs
  - id: rust-install
    type: file
    path: cli-rust/src/commands/install.rs
  - id: rust-delegate
    type: file
    path: cli-rust/src/commands/delegate.rs
  - id: rust-merge
    type: file
    path: cli-rust/src/merge.rs
  - id: rust-tracking
    type: file
    path: cli-rust/src/tracking.rs
  - id: rust-package
    type: file
    path: cli-rust/Cargo.toml
  - id: rust-npm
    type: file
    path: cli-rust/npm/cct/package.json
  - id: rust-readme
    type: file
    path: cli-rust/README.md
---

The Rust CLI native core is a parity-focused port of the component installation part of `claude-code-templates`. The `cct` binary parses a Commander-like flag surface with Clap, handles install flags natively, and delegates every non-install feature back to the Node CLI [@rust-main]. This keeps the high-frequency component install path in Rust while preserving the existing Node behavior for dashboards, sandbox execution, global agents, stats, health checks, and interactive setup [@rust-main].

## Native Boundary

The native boundary is defined by `Cli::has_install_flags()`: only `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, and `--skill` cause Rust to run its own install path [@rust-cli]. `--workflow` is modeled on the Rust CLI, but it becomes native only when it accompanies component flags because `main.rs` builds `MultiSpec.workflow_yaml` inside `run_install()` [@rust-main].

When no install flag is present, Rust captures the original arguments and forwards them unchanged to the Node CLI [@rust-main]. Delegation first honors `CCT_NODE_BIN`, running `.js` paths with `node` and non-`.js` values directly; otherwise it falls back to `npx -y claude-code-templates@latest <args>` [@rust-delegate]. The delegated process inherits stdio and its exit code is propagated, including Unix signal exits when available [@rust-delegate].

## Native Install Flow

`run_install()` resolves the target directory, converts comma-separated flag values into `MultiSpec`, supports `--dry-run` by printing planned writes, and calls `install::install_multiple()` for real installs [@rust-main]. After installation, it runs `claude -p <prompt>` in the target directory when `--prompt` is present and sandbox mode is absent, surfacing non-zero Claude exits but treating a missing `claude` binary as a warning after install success [@rust-main].

The Rust installers mirror the Node direct-install behavior described in [Component Install Flow](component-install-flow). Agents and commands fetch raw Markdown and write flat files under `.claude/agents/` and `.claude/commands/` [@rust-install]. MCPs fetch JSON, strip `description` fields, merge with `.mcp.json`, and fail safely if an existing config cannot be read [@rust-install]. Settings and hooks resolve user, project, local, or enterprise locations, merge JSON into selected settings files, and install sidecar files where applicable [@rust-install].

Skills use the GitHub contents API through the Rust GitHub helper and require `SKILL.md` in the downloaded tree before writing the skill under `.claude/skills/<name>/` [@rust-install]. The current Rust `MultiSpec` covers agents, commands, MCPs, settings, hooks, skills, and workflow YAML; loop installation is not part of the Rust native spec even though the Node installer supports loops [@rust-install].

## Parity Rules

Merge behavior is isolated in `merge.rs` because MCPs, settings, and hooks have different semantics. MCP merge uses top-level incoming override plus per-server merge, settings merge includes `permissions.allow`, `permissions.deny`, and `permissions.ask` set-union, and hook merge appends arrays per hook type instead of overwriting them [@rust-merge]. Unit tests in the same file pin those behaviors for server override, permission union, environment merge, and hook append semantics [@rust-merge].

Tracking is also ported with the same operational contract: Rust posts download and outcome data to the same aitmpl.com endpoints in detached threads, uses a five-second timeout, and swallows all request failures [@rust-tracking]. It is more privacy-protective than the Node version for opt-out values because it treats both `true` and `1` as disabled for `CCT_NO_TRACKING`, `CCT_NO_ANALYTICS`, and `CI` [@rust-tracking].

## Packaging Shape

The Cargo package builds a binary named `cct`, uses release settings tuned for small binaries, and includes cargo-binstall metadata for GitHub Release assets named `cct-<target>.tgz` under `cli-rust-v<version>` tags [@rust-package]. The README describes the Rust CLI as a preview core, separate from the existing Node npm package, with install channels through a shell script, cargo-binstall, or local `cargo install --path cli-rust` [@rust-readme].

The npm wrapper package under `cli-rust/npm/cct` exposes familiar binary names such as `cct`, `claude-code-templates`, `claude-config`, and `create-claude-config`, but its package file depends on per-platform optional binary packages [@rust-npm]. That wrapper shape lets a small JavaScript shim execute the prebuilt Rust binary for the current platform while retaining a Node-friendly package surface [@rust-npm].

## Failure Modes

Rust surfaces install failures as component-level failures rather than panics. Missing remote components become `not_found` outcomes, invalid JSON becomes a failed install, unreadable existing JSON aborts that component instead of overwriting user state, and write errors stop the affected component [@rust-install]. Delegation failures are separate: if the Node CLI cannot be launched, Rust prints a launch error and exits with status 1 [@rust-delegate].

The main maintenance invariant is the boundary itself. Native Rust changes should preserve install parity with the Node component flow, while non-install behavior should remain delegated until it is deliberately ported [@rust-readme].
