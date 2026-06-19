//! `cct` — Rust port of the claude-code-templates CLI core.
//!
//! Native path: component installation (`--agent/--command/--mcp/--setting/
//! --hook/--skill`, plus `--workflow` YAML when combined with components).
//! Everything else (dashboards, sandbox, global agents, stats, health-check,
//! interactive setup) is delegated verbatim to the existing Node CLI.

mod cli;
mod commands;
mod constants;
mod github;
mod merge;
mod python_compat;
mod tracking;
mod util;

use clap::Parser;
use cli::Cli;
use commands::install::{self, MultiSpec};
use owo_colors::OwoColorize;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Capture original args (minus the binary name) for verbatim delegation.
    let forwarded: Vec<String> = std::env::args().skip(1).collect();

    let cli = Cli::parse();

    let code = if cli.has_install_flags() {
        run_install(&cli)
    } else {
        // Delegate to the Node CLI for all non-install features.
        match commands::delegate::delegate_to_node(&forwarded) {
            Ok(code) => code,
            Err(e) => {
                eprintln!("{} {e}", "Error:".red());
                1
            }
        }
    };

    std::process::exit(code);
}

fn run_install(cli: &Cli) -> i32 {
    let target_dir = cli
        .directory
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let spec = MultiSpec {
        agents: install::parse_csv(cli.agent.as_ref()),
        commands: install::parse_csv(cli.command.as_ref()),
        mcps: install::parse_csv(cli.mcp.as_ref()),
        settings: install::parse_csv(cli.setting.as_ref()),
        hooks: install::parse_csv(cli.hook.as_ref()),
        skills: install::parse_csv(cli.skill.as_ref()),
        // `--workflow` alongside components is treated as base64 YAML.
        workflow_yaml: cli.workflow.clone(),
        yes: cli.yes,
    };

    if let Err(e) = install::install_multiple(&spec, &target_dir) {
        eprintln!("{} {e}", "Error:".red());
        return 1;
    }

    // Post-install prompt execution (skipped in sandbox mode, like Node).
    if let Some(prompt) = &cli.prompt {
        if cli.sandbox.is_none() {
            run_prompt(prompt, &target_dir);
        }
    }

    0
}

/// Run `claude -p "<prompt>"` in the target directory, inheriting stdio.
/// Best-effort: prints a hint if the `claude` CLI is not installed.
fn run_prompt(prompt: &str, target_dir: &std::path::Path) {
    println!("{}", "🚀 Executing prompt in Claude Code...".blue());
    match Command::new("claude")
        .arg("-p")
        .arg(prompt)
        .current_dir(target_dir)
        .status()
    {
        Ok(_) => {}
        Err(_) => {
            println!(
                "{}",
                "⚠️  Could not run `claude`. Is the Claude Code CLI installed and on PATH?"
                    .yellow()
            );
        }
    }
}
