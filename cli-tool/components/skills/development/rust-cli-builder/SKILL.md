---
name: rust-cli-builder
description: Plan and build production-ready Rust CLI tools using clap for argument parsing, with subcommands, config file support, colored output, and proper error handling. Uses interview-driven planning to clarify commands, input/output formats, and distribution strategy before writing any code.
tags: [rust, cli, clap, terminal, command-line, devtools]
---

# Rust CLI Tool Builder

## When to use

Use this skill when you need to:

- Scaffold a new Rust CLI tool from scratch with clap
- Add subcommands to an existing CLI application
- Implement config file loading (TOML/JSON/YAML)
- Set up proper error handling with anyhow/thiserror
- Add colored and formatted terminal output
- Structure a CLI project for distribution via cargo install or GitHub releases

## Phase 1: Explore (Plan Mode)

Enter plan mode. Before writing any code, explore the existing project:

### If extending an existing project
- Find `Cargo.toml` and check current dependencies (clap version, serde, tokio, etc.)
- Locate the CLI entry point (`src/main.rs` or `src/cli.rs`)
- Check if clap is using derive macros or builder pattern
- Identify existing subcommand structure
- Look for existing error types, config structs, and output formatting
- Check if there's a `src/lib.rs` separating library logic from CLI

### If starting from scratch
- Check the workspace for any existing Rust projects or workspace `Cargo.toml`
- Look for a `.cargo/config.toml` with custom settings
- Check for `rust-toolchain.toml` to know the target Rust edition

## Phase 2: Interview (AskUserQuestion)

Use AskUserQuestion to clarify requirements. Ask in rounds.

### Round 1: Tool purpose and commands

```
Question: "What kind of CLI tool are you building?"
Header: "Tool type"
Options:
  - "Single command (like ripgrep, curl)" — One main action with flags and arguments
  - "Multi-command (like git, cargo)" — Multiple subcommands under one binary
  - "Interactive REPL (like psql)" — Persistent session with a prompt loop
  - "Pipeline tool (like jq, sed)" — Reads stdin, transforms, writes stdout

Question: "What will the tool operate on?"
Header: "Input"
Options:
  - "Files/directories" — Read, process, or generate files
  - "Network/API" — HTTP requests, TCP connections, API calls
  - "System resources" — Processes, hardware info, OS config
  - "Data streams (stdin/stdout)" — Pipe-friendly text/binary processing
```

### Round 2: Subcommands (if multi-command)

```
Question: "Describe the subcommands you need (e.g., 'init', 'build', 'deploy')"
Header: "Commands"
Options:
  - "2-3 subcommands (I'll describe them)" — Small focused tool
  - "4-8 subcommands with groups" — Medium tool, may need command groups
  - "I have a rough list, help me design the API" — Collaborative command design
```

### Round 3: Configuration and output

```
Question: "How should the tool be configured?"
Header: "Config"
Options:
  - "CLI flags only (Recommended)" — All config via command-line arguments
  - "Config file (TOML)" — Load defaults from ~/.config/toolname/config.toml
  - "Config file + CLI overrides" — Config file for defaults, flags override specific values
  - "Environment variables + flags" — Env vars for secrets, flags for everything else

Question: "What output format does the tool need?"
Header: "Output"
Options:
  - "Human-readable (colored text)" — Pretty terminal output with colors and formatting
  - "Machine-readable (JSON)" — Structured output for piping to other tools
  - "Both (--format flag)" — Default human, --json or --format=json for machines
  - "Minimal (exit codes only)" — Success/failure via exit code, errors to stderr
```

### Round 4: Async and error handling

```
Question: "Does the tool need async operations?"
Header: "Async"
Options:
  - "No — synchronous is fine (Recommended)" — File I/O, computation, simple operations
  - "Yes — tokio (network I/O)" — HTTP requests, concurrent connections, async file I/O
  - "Yes — tokio multi-threaded" — Heavy parallelism, multiple concurrent tasks

Question: "How should errors be presented to users?"
Header: "Errors"
Options:
  - "Simple messages (anyhow) (Recommended)" — Human-readable error chains, good for most CLIs
  - "Typed errors (thiserror)" — Custom error enum with specific variants for each failure
  - "Both (thiserror for lib, anyhow for bin)" — Library code is typed, CLI wraps with anyhow
```

## Phase 3: Plan (ExitPlanMode)

Write a concrete implementation plan covering:

1. **Project structure** — `Cargo.toml` dependencies, `src/` file layout
2. **CLI definition** — clap derive structs for all commands, args, and flags
3. **Config loading** — config file format and merge strategy with CLI args
4. **Core logic** — main functions for each subcommand, separated from CLI layer
5. **Error types** — error enum or anyhow usage, user-facing error messages
6. **Output formatting** — colored output, JSON mode, progress indicators
7. **Tests** — unit tests for core logic, integration tests for CLI behavior

Present via ExitPlanMode for user approval.

## Phase 4: Execute

After approval, implement following this order:

### Step 1: Project setup (Cargo.toml)

```toml
[package]
name = "toolname"
version = "0.1.0"
edition = "2021"
description = "Short description of the tool"

[dependencies]
clap = { version = "4", features = ["derive", "env"] }
serde = { version = "1", features = ["derive"] }
anyhow = "1"
# Add based on interview:
# thiserror = "2"              # if typed errors
# tokio = { version = "1", features = ["full"] }  # if async
# serde_json = "1"             # if JSON output
# toml = "0.8"                 # if TOML config
# colored = "2"                # if colored output
# indicatif = "0.17"           # if progress bars
# dirs = "5"                   # if config file (~/.config/)
```

### Step 2: CLI definition with clap derive

```rust
use clap::{Parser, Subcommand};

/// Short one-line description of the tool
#[derive(Parser, Debug)]
#[command(name = "toolname", version, about, long_about = None)]
pub struct Cli {
    /// Increase verbosity (-v, -vv, -vvv)
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    pub verbose: u8,

    /// Output format
    #[arg(long, default_value = "text", global = true)]
    pub format: OutputFormat,

    /// Path to config file
    #[arg(long, global = true)]
    pub config: Option<std::path::PathBuf>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Initialize a new project
    Init {
        /// Project name
        name: String,

        /// Template to use
        #[arg(short, long, default_value = "default")]
        template: String,
    },

    /// Build the project
    Build {
        /// Build in release mode
        #[arg(short, long)]
        release: bool,

        /// Target directory
        #[arg(short, long)]
        output: Option<std::path::PathBuf>,
    },

    /// Show project status
    Status,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum OutputFormat {
    Text,
    Json,
}
```

### Step 3: Error handling

```rust
// With anyhow (simple approach):
use anyhow::{Context, Result};

fn load_config(path: &Path) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file: {}", path.display()))?;
    let config: Config = toml::from_str(&content)
        .context("Invalid TOML in config file")?;
    Ok(config)
}

// With thiserror (typed approach):
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Config file not found: {path}")]
    ConfigNotFound { path: std::path::PathBuf },

    #[error("Invalid config: {0}")]
    InvalidConfig(#[from] toml::de::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("{0}")]
    Custom(String),
}
```

### Step 4: Config file loading

```rust
use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Deserialize, Debug, Default)]
pub struct Config {
    pub default_template: Option<String>,
    pub output_dir: Option<PathBuf>,
    // ... fields from interview
}

impl Config {
    pub fn load(explicit_path: Option<&Path>) -> anyhow::Result<Self> {
        let path = match explicit_path {
            Some(p) => p.to_path_buf(),
            None => Self::default_path(),
        };

        if !path.exists() {
            return Ok(Config::default());
        }

        let content = std::fs::read_to_string(&path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    fn default_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("toolname")
            .join("config.toml")
    }
}
```

### Step 5: Colored output and formatting

```rust
use colored::Colorize;

pub struct Output {
    format: OutputFormat,
    verbose: u8,
}

impl Output {
    pub fn new(format: OutputFormat, verbose: u8) -> Self {
        Self { format, verbose }
    }

    pub fn success(&self, msg: &str) {
        match self.format {
            OutputFormat::Text => eprintln!("{} {}", "✓".green().bold(), msg),
            OutputFormat::Json => {} // JSON output goes to stdout only
        }
    }

    pub fn error(&self, msg: &str) {
        match self.format {
            OutputFormat::Text => eprintln!("{} {}", "✗".red().bold(), msg),
            OutputFormat::Json => {
                let err = serde_json::json!({"error": msg});
                println!("{}", serde_json::to_string(&err).unwrap());
            }
        }
    }

    pub fn info(&self, msg: &str) {
        if self.verbose >= 1 {
            match self.format {
                OutputFormat::Text => eprintln!("{} {}", "ℹ".blue(), msg),
                OutputFormat::Json => {}
            }
        }
    }

    pub fn data<T: serde::Serialize>(&self, data: &T) {
        match self.format {
            OutputFormat::Text => {
                // Pretty print for humans — customize per subcommand
                println!("{:#?}", data);
            }
            OutputFormat::Json => {
                println!("{}", serde_json::to_string_pretty(data).unwrap());
            }
        }
    }
}
```

### Step 6: Main entry point

```rust
use clap::Parser;

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let config = Config::load(cli.config.as_deref())?;
    let output = Output::new(cli.format.clone(), cli.verbose);

    match cli.command {
        Commands::Init { name, template } => {
            cmd_init(&name, &template, &config, &output)?;
        }
        Commands::Build { release, output_dir } => {
            let dir = output_dir
                .or(config.output_dir.clone())
                .unwrap_or_else(|| PathBuf::from("./dist"));
            cmd_build(release, &dir, &output)?;
        }
        Commands::Status => {
            cmd_status(&config, &output)?;
        }
    }

    Ok(())
}

// If async (tokio):
// #[tokio::main]
// async fn main() -> anyhow::Result<()> { ... }
```

### Step 7: Subcommand implementations

```rust
fn cmd_init(name: &str, template: &str, config: &Config, out: &Output) -> anyhow::Result<()> {
    let template = if template == "default" {
        config.default_template.as_deref().unwrap_or("default")
    } else {
        template
    };

    out.info(&format!("Using template: {}", template));

    let project_dir = Path::new(name);
    if project_dir.exists() {
        anyhow::bail!("Directory '{}' already exists", name);
    }

    std::fs::create_dir_all(project_dir)?;
    // ... scaffold project files based on template

    out.success(&format!("Created project '{}' with template '{}'", name, template));
    Ok(())
}
```

### Step 8: Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert!(config.default_template.is_none());
    }

    #[test]
    fn test_config_parse_toml() {
        let toml_str = r#"
            default_template = "react"
            output_dir = "./build"
        "#;
        let config: Config = toml::from_str(toml_str).unwrap();
        assert_eq!(config.default_template.unwrap(), "react");
    }
}

// Integration tests (tests/cli.rs):
use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn test_help_flag() {
    Command::cargo_bin("toolname")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Usage:"));
}

#[test]
fn test_version_flag() {
    Command::cargo_bin("toolname")
        .unwrap()
        .arg("--version")
        .assert()
        .success();
}

#[test]
fn test_init_creates_directory() {
    let dir = tempfile::tempdir().unwrap();
    let project_name = dir.path().join("test-project");

    Command::cargo_bin("toolname")
        .unwrap()
        .args(["init", project_name.to_str().unwrap()])
        .assert()
        .success();

    assert!(project_name.exists());
}

#[test]
fn test_init_existing_directory_fails() {
    let dir = tempfile::tempdir().unwrap();

    Command::cargo_bin("toolname")
        .unwrap()
        .args(["init", dir.path().to_str().unwrap()])
        .assert()
        .failure()
        .stderr(predicate::str::contains("already exists"));
}

#[test]
fn test_json_output_format() {
    Command::cargo_bin("toolname")
        .unwrap()
        .args(["--format", "json", "status"])
        .assert()
        .success()
        .stdout(predicate::str::starts_with("{"));
}
```

## Project structure reference

```
toolname/
├── Cargo.toml
├── src/
│   ├── main.rs          # Entry point, CLI parsing, command dispatch
│   ├── cli.rs           # Clap derive structs (Cli, Commands, Args)
│   ├── config.rs        # Config file loading and merging
│   ├── output.rs        # Output formatting (text/JSON/colored)
│   ├── error.rs         # Error types (if using thiserror)
│   └── commands/
│       ├── mod.rs
│       ├── init.rs      # Init subcommand logic
│       ├── build.rs     # Build subcommand logic
│       └── status.rs    # Status subcommand logic
└── tests/
    └── cli.rs           # Integration tests with assert_cmd
```

## Best practices

### Separate CLI from logic
Keep clap structs and argument parsing in `cli.rs`. Put business logic in `commands/`. This makes the core logic testable without invoking the CLI.

### Use stderr for status, stdout for data
Human-readable messages (progress, success, errors) go to `stderr`. Machine-readable data goes to `stdout`. This lets users pipe output cleanly: `toolname status --format json | jq '.items'`.

### Respect NO_COLOR
Check the `NO_COLOR` environment variable and disable colors when set:
```rust
if std::env::var("NO_COLOR").is_ok() {
    colored::control::set_override(false);
}
```

### Exit codes
Use meaningful exit codes: 0 for success, 1 for general errors, 2 for usage errors (clap handles this automatically).

### Dev dependencies for testing

```toml
[dev-dependencies]
assert_cmd = "2"
predicates = "3"
tempfile = "3"
```

## Checklist before finishing

- [ ] `clap` derive structs have doc comments (they become --help text)
- [ ] All subcommands have short and long descriptions
- [ ] Config file has sensible defaults and doesn't error when missing
- [ ] `--format json` outputs valid, parseable JSON to stdout
- [ ] Errors show context (file paths, what went wrong, how to fix it)
- [ ] Integration tests verify CLI behavior end-to-end
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo fmt` has been run
