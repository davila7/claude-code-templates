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

    // --dry-run: report the planned installation and write nothing.
    if cli.dry_run {
        print_dry_run(&spec, &target_dir);
        return 0;
    }

    if let Err(e) = install::install_multiple(&spec, &target_dir) {
        eprintln!("{} {e}", "Error:".red());
        return 1;
    }

    // Post-install prompt execution (skipped in sandbox mode, like Node).
    if let Some(prompt) = &cli.prompt {
        if cli.sandbox.is_none() {
            return run_prompt(prompt, &target_dir);
        }
    }

    0
}

/// Print what `run_install` would do without touching the filesystem.
fn print_dry_run(spec: &MultiSpec, target_dir: &std::path::Path) {
    println!(
        "{}",
        "🔍 Dry run — the following would be installed (no files written):".blue()
    );
    println!("📁 Target: {}", target_dir.display());
    let groups: [(&str, &Vec<String>); 6] = [
        ("agent", &spec.agents),
        ("command", &spec.commands),
        ("mcp", &spec.mcps),
        ("setting", &spec.settings),
        ("hook", &spec.hooks),
        ("skill", &spec.skills),
    ];
    for (label, items) in groups {
        for item in items {
            println!("  • {label}: {item}");
        }
    }
    if spec.workflow_yaml.is_some() {
        println!("  • workflow: .claude/workflows/<name>.yaml");
    }
}

/// Run `claude -p "<prompt>"` in the target directory, inheriting stdio.
/// Returns the exit code to propagate: a non-zero `claude` exit is surfaced so
/// the overall run reflects the prompt failure; a missing `claude` binary is a
/// soft warning (the install itself already succeeded) and returns 0.
fn run_prompt(prompt: &str, target_dir: &std::path::Path) -> i32 {
    println!("{}", "🚀 Executing prompt in Claude Code...".blue());
    match Command::new("claude")
        .arg("-p")
        .arg(prompt)
        .current_dir(target_dir)
        .status()
    {
        Ok(status) if status.success() => 0,
        Ok(status) => {
            let code = status.code().unwrap_or(1);
            println!(
                "{}",
                format!("⚠️  Prompt execution failed (claude exited with {code}).").yellow()
            );
            code
        }
        Err(_) => {
            println!(
                "{}",
                "⚠️  Could not run `claude`. Is the Claude Code CLI installed and on PATH?"
                    .yellow()
            );
            0
        }
    }
}
