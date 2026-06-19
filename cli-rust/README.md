# cct — Rust core for claude-code-templates

A Rust port of the **core** of the `claude-code-templates` CLI: component
installation (`agents`, `commands`, `mcps`, `settings`, `hooks`, `skills`),
verified at byte-for-byte parity with the Node.js CLI.

Everything else (dashboards, sandbox, global agents, stats, health-check,
interactive setup) is **delegated** to the existing Node CLI for now — see
[Delegation](#delegation).

## Install

Released as a standalone binary from GitHub Releases (tagged `cli-rust-v*`),
**separate from** the existing `claude-code-templates` npm package so nothing
about the current `npx` experience changes.

**Available now (v0.1.0 preview):**

| Channel | Command |
|---|---|
| Shell script | `curl -fsSL https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-rust/dist/install.sh \| sh` |
| cargo-binstall | `cargo binstall --git https://github.com/davila7/claude-code-templates claude-code-templates` |
| From source | `cargo install --path cli-rust` |

> The `--git` form reads the prebuilt-binary metadata straight from this repo,
> so no crates.io publish is required. (A plain `cargo binstall
> claude-code-templates` / `cargo install claude-code-templates` would need the
> crate published to crates.io — optional, later.)

**Planned (not wired up yet):**

| Channel | Command |
|---|---|
| Homebrew tap | `brew install davila7/tap/cct` |
| npm (new name) | `npx @davila7/cct` |

The npm path (when enabled) ships a tiny JS shim (`npm/cct/bin/cct.js`) that
execs the prebuilt binary for the current platform, pulled in as an
`optionalDependency` (`@davila7/cct-<os>-<arch>`). The existing
`claude-code-templates` npm package stays on Node until the binary is proven.

## Usage

```bash
cct --agent deep-research-team/research-synthesizer   # install an agent
cct --mcp devtools/elasticsearch                       # merge into .mcp.json
cct --setting api/custom-headers --hook monitoring/desktop-notification-on-stop
cct --skill creative-design/algorithmic-art            # recursive skill tree
cct --agent a,b --command c -d ./project -y            # batch into a directory
```

Opt out of anonymous telemetry with `CCT_NO_TRACKING=1` (also disabled when
`CI=true`).

## Architecture

```
src/
  main.rs          dispatch: native install path vs Node delegation
  cli.rs           clap flag surface (mirrors the commander options)
  constants.rs     GitHub raw/API bases, tracking URLs, version
  github.rs        raw fetch + recursive contents-API tree (skills)
  tracking.rs      fire-and-forget analytics (3 endpoints, detached threads)
  merge.rs         .mcp.json / settings / hooks merge semantics (+ unit tests)
  python_compat.rs Windows python3->python shim
  commands/
    install.rs     installIndividual* + installMultipleComponents
    delegate.rs    forward argv to the Node CLI
  util/{fs_ext,paths}.rs
```

Parity-critical details preserved: 2-space JSON with trailing newline,
`shift_remove` (not swap-remove) so key order matches JS `delete`,
`permissions.{allow,deny,ask}` Set-union, hook array concatenation, category
dropping in target filenames, `.py`/`.sh` sidecar downloads, skills via the
GitHub contents API.

## Delegation

Non-install flags forward verbatim to the Node CLI:

1. `CCT_NODE_BIN` — path to `cli-tool/bin/create-claude-config.js` (run with
   `node`) or an executable. Used for local testing.
2. Fallback: `npx -y claude-code-templates@latest <args>`.

```bash
CCT_NODE_BIN=../cli-tool/bin/create-claude-config.js cct --list-agents
```

## Develop

```bash
cargo build                 # debug build
cargo test                  # unit tests (merge semantics)
cargo build --release       # optimized binary at target/release/cct
```

### Parity check vs Node

```bash
RDIR=$(mktemp -d); NDIR=$(mktemp -d)
ARGS="--agent deep-research-team/research-synthesizer --mcp devtools/elasticsearch -y"
CCT_NO_TRACKING=1 target/release/cct $ARGS -d "$RDIR"
CCT_NO_TRACKING=1 node ../cli-tool/bin/create-claude-config.js $ARGS -d "$NDIR"
diff -r "$RDIR" "$NDIR" && echo "IDENTICAL"
```

## Release

### v0.1.0 preview (GitHub Releases + curl + cargo-binstall)

1. Merge this branch to `main` (so the workflow and `install.sh` exist there).
2. Tag and push: `git tag cli-rust-v0.1.0 && git push origin cli-rust-v0.1.0`.
   `.github/workflows/build-rust-cli.yml` builds all 5 targets and uploads
   `cct-<target>.tgz` to the GitHub Release (`contents: write` is granted).
3. Verify the channels:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-rust/dist/install.sh | sh
   cargo binstall --git https://github.com/davila7/claude-code-templates claude-code-templates
   ```
   The tag must keep the `cli-rust-v` prefix — both the binstall metadata
   (`Cargo.toml`) and `install.sh`'s tag filter depend on it.

### Later channels (when enabled)

- **Homebrew tap**: create `davila7/homebrew-tap`, drop in `dist/homebrew/cct.rb`,
  fill the `sha256` per asset (`shasum -a 256 cct-<target>.tgz`).
- **npm (new name)**: `node npm/build-packages.mjs <version> <dist-dir>` (accepts
  the release `.tgz`s), then publish each `npm/platforms/*` and `npm/cct` under a
  new name (e.g. `@davila7/cct`) — leaves `claude-code-templates` untouched.
