//! Native port of the component installation path (`installIndividual*` and
//! `installMultipleComponents` from `cli-tool/src/index.js`).

use crate::constants::raw_components_base;
use crate::github::{self, Fetched};
use crate::merge;
use crate::python_compat::replace_python_commands;
use crate::tracking::{self, DownloadMeta, Outcome, OutcomeMeta};
use crate::util::{fs_ext, paths};
use anyhow::Result;
use owo_colors::OwoColorize;
use serde_json::Value;
use std::io::IsTerminal;
use std::path::Path;
use std::time::Instant;

/// Per-install options threaded through the installers, mirroring the Node
/// `options` object's relevant fields.
#[derive(Clone, Default)]
pub struct InstallOptions {
    pub silent: bool,
    pub shared_locations: Option<Vec<String>>,
    pub batch_id: Option<String>,
}

fn elapsed_ms(start: Instant) -> u128 {
    start.elapsed().as_millis()
}

fn target_directory_meta(target_dir: &Path) -> String {
    let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());
    paths::relative_path(&cwd, target_dir)
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

pub fn install_agent(name: &str, target_dir: &Path, opts: &InstallOptions) -> bool {
    println!("{}", format!("🤖 Installing agent: {name}").blue());
    let start = Instant::now();
    let url = format!("{}/agents/{name}.md", raw_components_base());

    match github::fetch_raw(&url) {
        Ok(Fetched::Ok(content)) => {
            let file_name = last_segment(name);
            let dir = target_dir.join(".claude").join("agents");
            let target_file = dir.join(format!("{file_name}.md"));
            if let Err(e) = fs_ext::write_file(&target_file, &content, false) {
                println!("{}", format!("❌ Error installing agent: {e}").red());
                track_fail(
                    "agent",
                    name,
                    "network_error",
                    Some(e.to_string()),
                    start,
                    opts,
                );
                return false;
            }
            if !opts.silent {
                println!(
                    "{}",
                    format!("✅ Agent \"{name}\" installed successfully!").green()
                );
            }
            tracking::track_download(
                "agent",
                name,
                &DownloadMeta {
                    target_directory: Some(target_directory_meta(target_dir)),
                    ..Default::default()
                },
            );
            track_success("agent", name, start, opts);
            true
        }
        Ok(Fetched::NotFound) => {
            println!("{}", format!("❌ Agent \"{name}\" not found").red());
            track_fail("agent", name, "not_found", None, start, opts);
            false
        }
        other => network_error("agent", name, other, start, opts),
    }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

pub fn install_command(name: &str, target_dir: &Path, opts: &InstallOptions) -> bool {
    println!("{}", format!("⚡ Installing command: {name}").blue());
    let start = Instant::now();
    let url = format!("{}/commands/{name}.md", raw_components_base());

    match github::fetch_raw(&url) {
        Ok(Fetched::Ok(content)) => {
            let file_name = last_segment(name);
            let target_file = target_dir
                .join(".claude")
                .join("commands")
                .join(format!("{file_name}.md"));
            if let Err(e) = fs_ext::write_file(&target_file, &content, false) {
                println!("{}", format!("❌ Error installing command: {e}").red());
                track_fail(
                    "command",
                    name,
                    "network_error",
                    Some(e.to_string()),
                    start,
                    opts,
                );
                return false;
            }
            if !opts.silent {
                println!(
                    "{}",
                    format!("✅ Command \"{name}\" installed successfully!").green()
                );
            }
            tracking::track_download(
                "command",
                name,
                &DownloadMeta {
                    target_directory: Some(target_directory_meta(target_dir)),
                    ..Default::default()
                },
            );
            track_success("command", name, start, opts);
            true
        }
        Ok(Fetched::NotFound) => {
            println!("{}", format!("❌ Command \"{name}\" not found").red());
            track_fail("command", name, "not_found", None, start, opts);
            false
        }
        other => network_error("command", name, other, start, opts),
    }
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

pub fn install_mcp(name: &str, target_dir: &Path, opts: &InstallOptions) -> bool {
    println!("{}", format!("🔌 Installing MCP: {name}").blue());
    let start = Instant::now();
    let url = format!("{}/mcps/{name}.json", raw_components_base());

    let text = match github::fetch_raw(&url) {
        Ok(Fetched::Ok(t)) => t,
        Ok(Fetched::NotFound) => {
            println!("{}", format!("❌ MCP \"{name}\" not found").red());
            track_fail("mcp", name, "not_found", None, start, opts);
            return false;
        }
        other => return network_error("mcp", name, other, start, opts),
    };

    let mut mcp_config: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            println!("{}", format!("❌ Error installing MCP: {e}").red());
            track_fail(
                "mcp",
                name,
                "network_error",
                Some(e.to_string()),
                start,
                opts,
            );
            return false;
        }
    };
    merge::strip_mcp_descriptions(&mut mcp_config);

    let target_file = target_dir.join(".mcp.json");
    let existing = if target_file.exists() {
        // Fail safe on a corrupt/unreadable existing file rather than silently
        // overwriting it with just the new server (matches Node, which throws).
        match fs_ext::read_json(&target_file) {
            Ok(v) => v,
            Err(e) => {
                println!(
                    "{}",
                    format!(
                        "❌ Error installing MCP: cannot read existing {}: {e}",
                        target_file.display()
                    )
                    .red()
                );
                track_fail("mcp", name, "read_error", Some(e.to_string()), start, opts);
                return false;
            }
        }
    } else {
        Value::Object(Default::default())
    };
    let merged = merge::merge_mcp(&existing, &mcp_config);

    if let Err(e) = fs_ext::write_json_pretty(&target_file, &merged) {
        println!("{}", format!("❌ Error installing MCP: {e}").red());
        track_fail(
            "mcp",
            name,
            "network_error",
            Some(e.to_string()),
            start,
            opts,
        );
        return false;
    }
    if !opts.silent {
        println!(
            "{}",
            format!("✅ MCP \"{name}\" installed successfully!").green()
        );
    }
    tracking::track_download("mcp", name, &DownloadMeta::default());
    track_success("mcp", name, start, opts);
    true
}

// ---------------------------------------------------------------------------
// Setting
// ---------------------------------------------------------------------------

/// Returns the number of locations successfully installed into.
pub fn install_setting(name: &str, target_dir: &Path, opts: &InstallOptions) -> usize {
    println!("{}", format!("⚙️  Installing setting: {name}").blue());
    let component_type = "setting";
    let start = Instant::now();
    let url = format!("{}/settings/{name}.json", raw_components_base());

    let text = match github::fetch_raw(&url) {
        Ok(Fetched::Ok(t)) => t,
        Ok(Fetched::NotFound) => {
            println!("{}", format!("❌ Setting \"{name}\" not found").red());
            track_fail("setting", name, "not_found", None, start, opts);
            return 0;
        }
        other => {
            network_error("setting", name, other, start, opts);
            return 0;
        }
    };

    let mut setting_config: Value = match serde_json::from_str(&text) {
        Ok(v) => replace_python_commands(v),
        Err(e) => {
            println!("{}", format!("❌ Error installing setting: {e}").red());
            track_fail(
                "setting",
                name,
                "network_error",
                Some(e.to_string()),
                start,
                opts,
            );
            return 0;
        }
    };

    // Collect additional files: statusline python sidecar + config `files` map.
    let mut additional: Vec<(String, String, bool)> = Vec::new();
    if name.contains("statusline/") {
        let py_url = url.replace(".json", ".py");
        if let Some(py) = github::fetch_raw_optional(&py_url) {
            let base = name.split('/').nth(1).unwrap_or(name);
            additional.push((format!(".claude/scripts/{base}.py"), py, true));
        }
    }
    if let Some(files) = setting_config.get("files").and_then(Value::as_object) {
        for (path, cfg) in files.iter() {
            let content = cfg
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let exe = cfg
                .get("executable")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            additional.push((path.clone(), content, exe));
        }
    }

    // Strip description + files before merging (shift_remove preserves order).
    if let Some(obj) = setting_config.as_object_mut() {
        obj.shift_remove("description");
        obj.shift_remove("files");
    }

    let locations = resolve_install_locations(opts, "setting");
    let mut successful = 0usize;

    for location in &locations {
        let resolved = paths::resolve_location(location, target_dir);
        let target_file = &resolved.settings_file;

        let existing = if target_file.exists() {
            // Abort the whole install on a corrupt/unreadable existing file
            // (matches Node: readJson throws out of the loop and fails the
            // component) rather than skipping the location and possibly
            // reporting overall success.
            match fs_ext::read_json(target_file) {
                Ok(v) => v,
                Err(e) => {
                    println!(
                        "{}",
                        format!(
                            "❌ Error installing {component_type}: cannot read existing {}: {e}",
                            target_file.display()
                        )
                        .red()
                    );
                    track_fail(
                        component_type,
                        name,
                        "read_error",
                        Some(e.to_string()),
                        start,
                        opts,
                    );
                    return 0;
                }
            }
        } else {
            Value::Object(Default::default())
        };

        // Conflict detection (env vars + differing non-permissions/env/hooks keys).
        if has_setting_conflicts(&existing, &setting_config) && !confirm_overwrite(name, location) {
            continue;
        }

        let merged = merge::merge_settings(&existing, &setting_config);
        if let Err(e) = fs_ext::write_json_pretty(target_file, &merged) {
            println!(
                "{}",
                format!("❌ Failed to write {}: {e}", target_file.display()).red()
            );
            continue;
        }
        write_additional_files(&additional, &resolved.current_target_dir);

        tracking::track_download("setting", name, &DownloadMeta::default());
        successful += 1;
    }

    if !opts.silent && successful > 0 {
        println!(
            "{}",
            format!("🎉 Setting \"{name}\" installed in {successful} location(s)!").green()
        );
    }
    track_outcome_count("setting", name, successful, start, opts);
    successful
}

fn has_setting_conflicts(existing: &Value, incoming: &Value) -> bool {
    // Conflicting env vars.
    if let (Some(e_env), Some(i_env)) = (
        existing.get("env").and_then(Value::as_object),
        incoming.get("env").and_then(Value::as_object),
    ) {
        for (k, v) in i_env.iter() {
            if let Some(existing_v) = e_env.get(k) {
                if existing_v != v {
                    return true;
                }
            }
        }
    }
    // Conflicting top-level keys (excluding permissions/env/hooks).
    if let Some(incoming_obj) = incoming.as_object() {
        for (k, v) in incoming_obj.iter() {
            if k == "permissions" || k == "env" || k == "hooks" {
                continue;
            }
            if let Some(existing_v) = existing.get(k) {
                if existing_v != v {
                    return true;
                }
            }
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/// Returns the number of locations successfully installed into.
pub fn install_hook(name: &str, target_dir: &Path, opts: &InstallOptions) -> usize {
    println!("{}", format!("🪝 Installing hook: {name}").blue());
    let component_type = "hook";
    let start = Instant::now();
    let url = format!("{}/hooks/{name}.json", raw_components_base());

    let text = match github::fetch_raw(&url) {
        Ok(Fetched::Ok(t)) => t,
        Ok(Fetched::NotFound) => {
            println!("{}", format!("❌ Hook \"{name}\" not found").red());
            track_fail("hook", name, "not_found", None, start, opts);
            return 0;
        }
        other => {
            network_error("hook", name, other, start, opts);
            return 0;
        }
    };

    let mut hook_config: Value = match serde_json::from_str(&text) {
        Ok(v) => replace_python_commands(v),
        Err(e) => {
            println!("{}", format!("❌ Error installing hook: {e}").red());
            track_fail(
                "hook",
                name,
                "network_error",
                Some(e.to_string()),
                start,
                opts,
            );
            return 0;
        }
    };

    // Optional `.py` and `.sh` sidecars for any hook.
    let base = last_segment(name);
    let mut additional: Vec<(String, String, bool)> = Vec::new();
    if let Some(py) = github::fetch_raw_optional(&url.replace(".json", ".py")) {
        additional.push((format!(".claude/hooks/{base}.py"), py, true));
    }
    if let Some(sh) = github::fetch_raw_optional(&url.replace(".json", ".sh")) {
        additional.push((format!(".claude/hooks/{base}.sh"), sh, true));
    }

    if let Some(obj) = hook_config.as_object_mut() {
        obj.shift_remove("description"); // preserve key order like JS `delete`
    }

    let locations = resolve_install_locations(opts, "hook");
    let mut successful = 0usize;

    for location in &locations {
        let resolved = paths::resolve_location(location, target_dir);
        let target_file = &resolved.settings_file;

        let existing = if target_file.exists() {
            // Abort the whole install on a corrupt/unreadable existing file
            // (matches Node: readJson throws out of the loop and fails the
            // component) rather than skipping the location and possibly
            // reporting overall success.
            match fs_ext::read_json(target_file) {
                Ok(v) => v,
                Err(e) => {
                    println!(
                        "{}",
                        format!(
                            "❌ Error installing {component_type}: cannot read existing {}: {e}",
                            target_file.display()
                        )
                        .red()
                    );
                    track_fail(
                        component_type,
                        name,
                        "read_error",
                        Some(e.to_string()),
                        start,
                        opts,
                    );
                    return 0;
                }
            }
        } else {
            Value::Object(Default::default())
        };

        let merged = merge::merge_hooks(&existing, &hook_config);
        if let Err(e) = fs_ext::write_json_pretty(target_file, &merged) {
            println!(
                "{}",
                format!("❌ Failed to write {}: {e}", target_file.display()).red()
            );
            continue;
        }
        write_additional_files(&additional, &resolved.current_target_dir);

        tracking::track_download("hook", name, &DownloadMeta::default());
        successful += 1;
    }

    if !opts.silent && successful > 0 {
        println!(
            "{}",
            format!("🎉 Hook \"{name}\" installed in {successful} location(s)!").green()
        );
    }
    track_outcome_count("hook", name, successful, start, opts);
    successful
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

pub fn install_skill(name: &str, target_dir: &Path, opts: &InstallOptions) -> bool {
    println!("{}", format!("💡 Installing skill: {name}").blue());
    let start = Instant::now();
    let base = last_segment(name);
    let api_url = format!("{}/skills/{name}", crate::constants::api_components_base());

    let files = match github::download_skill_tree(&api_url, base) {
        Ok(Some(files)) => files,
        Ok(None) => {
            println!("{}", format!("❌ Skill \"{name}\" not found").red());
            track_fail("skill", name, "not_found", None, start, opts);
            return false;
        }
        Err(e) => {
            println!("{}", format!("❌ Error installing skill: {e}").red());
            track_fail(
                "skill",
                name,
                "network_error",
                Some(e.to_string()),
                start,
                opts,
            );
            return false;
        }
    };

    // SKILL.md is required.
    let skill_md = format!(".claude/skills/{base}/SKILL.md");
    if !files.iter().any(|f| f.target_rel_path == skill_md) {
        println!("{}", "❌ SKILL.md not found in skill directory".red());
        track_fail(
            "skill",
            name,
            "validation_error",
            Some("SKILL.md not found".into()),
            start,
            opts,
        );
        return false;
    }

    for f in &files {
        let full = target_dir.join(&f.target_rel_path);
        if let Err(e) = fs_ext::write_file(&full, &f.content, f.executable) {
            println!(
                "{}",
                format!("❌ Failed to write {}: {e}", full.display()).red()
            );
            track_fail(
                "skill",
                name,
                "network_error",
                Some(e.to_string()),
                start,
                opts,
            );
            return false;
        }
    }

    if !opts.silent {
        println!(
            "{}",
            format!("✅ Skill \"{name}\" installed successfully!").green()
        );
        println!(
            "{}",
            format!("📄 Total files downloaded: {}", files.len()).cyan()
        );
    }
    tracking::track_download(
        "skill",
        name,
        &DownloadMeta {
            target_directory: Some(target_directory_meta(target_dir)),
            ..Default::default()
        },
    );
    track_success("skill", name, start, opts);
    true
}

// ---------------------------------------------------------------------------
// Multi-component orchestration
// ---------------------------------------------------------------------------

/// Parsed component lists from the comma-separated CLI flags.
#[derive(Default)]
pub struct MultiSpec {
    pub agents: Vec<String>,
    pub commands: Vec<String>,
    pub mcps: Vec<String>,
    pub settings: Vec<String>,
    pub hooks: Vec<String>,
    pub skills: Vec<String>,
    /// base64-encoded workflow YAML, when `--workflow` accompanies components.
    pub workflow_yaml: Option<String>,
    pub yes: bool,
}

pub fn parse_csv(input: Option<&String>) -> Vec<String> {
    input
        .map(|s| {
            s.split(',')
                .map(|x| x.trim().to_string())
                .filter(|x| !x.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

pub fn install_multiple(spec: &MultiSpec, target_dir: &Path) -> Result<()> {
    println!("{}", "🔧 Installing multiple components...".blue());
    let batch_id = short_id();

    let total = spec.agents.len()
        + spec.commands.len()
        + spec.mcps.len()
        + spec.settings.len()
        + spec.hooks.len()
        + spec.skills.len();
    if total == 0 {
        println!("{}", "⚠️  No components specified to install.".yellow());
        return Ok(());
    }

    // Ask once for shared install locations when settings/hooks are present.
    let has_settings_or_hooks = !spec.settings.is_empty() || !spec.hooks.is_empty();
    let shared = if has_settings_or_hooks && !spec.yes {
        Some(prompt_locations("configuration components"))
    } else {
        Some(vec!["local".to_string()])
    };

    let mut installed = 0usize;
    let base_opts = InstallOptions {
        silent: true,
        shared_locations: shared.clone(),
        batch_id: Some(batch_id.clone()),
    };

    for a in &spec.agents {
        if install_agent(a, target_dir, &base_opts) {
            installed += 1;
        }
    }
    for c in &spec.commands {
        if install_command(c, target_dir, &base_opts) {
            installed += 1;
        }
    }
    for m in &spec.mcps {
        if install_mcp(m, target_dir, &base_opts) {
            installed += 1;
        }
    }
    for s in &spec.settings {
        if install_setting(s, target_dir, &base_opts) > 0 {
            installed += 1;
        }
    }
    for h in &spec.hooks {
        if install_hook(h, target_dir, &base_opts) > 0 {
            installed += 1;
        }
    }
    for s in &spec.skills {
        if install_skill(s, target_dir, &base_opts) {
            installed += 1;
        }
    }

    if let Some(b64) = &spec.workflow_yaml {
        save_workflow_yaml(b64, target_dir);
    }

    if installed == total {
        println!(
            "{}",
            format!("\n✅ Successfully installed {installed} components!").green()
        );
    } else if installed > 0 {
        println!(
            "{}",
            format!("\n⚠️  Installed {installed} of {total} components.").yellow()
        );
    } else {
        println!(
            "{}",
            "\n❌ No components were installed successfully.".red()
        );
    }
    Ok(())
}

fn save_workflow_yaml(b64: &str, target_dir: &Path) {
    use base64::Engine;
    let decoded = match base64::engine::general_purpose::STANDARD.decode(b64) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
        Err(e) => {
            println!("{}", format!("❌ Error processing YAML: {e}").red());
            return;
        }
    };
    // Extract `name:` and slugify, matching the Node regex behavior.
    let mut workflow_name = "custom-workflow".to_string();
    for line in decoded.lines() {
        if let Some(rest) = line.trim_start().strip_prefix("name:") {
            let val = rest.trim().trim_matches(|c| c == '"' || c == '\'');
            if !val.is_empty() {
                workflow_name = slugify(val);
                break;
            }
        }
    }
    let file = target_dir
        .join(".claude")
        .join("workflows")
        .join(format!("{workflow_name}.yaml"));
    if let Err(e) = fs_ext::write_file(&file, &decoded, false) {
        println!("{}", format!("❌ Error saving workflow: {e}").red());
    } else {
        println!(
            "{}",
            format!("✅ Workflow YAML saved: {}", file.display()).green()
        );
    }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn last_segment(name: &str) -> &str {
    name.rsplit('/').next().unwrap_or(name)
}

fn slugify(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect()
}

fn short_id() -> String {
    // Mirrors Math.random().toString(36).substring(2,15) — a short opaque id.
    uuid::Uuid::new_v4().simple().to_string()[..13].to_string()
}

/// Resolve install locations: shared (batch) → those; silent without shared →
/// default local; interactive → prompt.
fn resolve_install_locations(opts: &InstallOptions, what: &str) -> Vec<String> {
    if let Some(shared) = &opts.shared_locations {
        return shared.clone();
    }
    if opts.silent {
        return vec!["local".to_string()];
    }
    prompt_locations(what)
}

/// Multi-select install-location prompt. Falls back to `["local"]` when stdin
/// is not a TTY (non-interactive / piped).
fn prompt_locations(what: &str) -> Vec<String> {
    if !std::io::stdin().is_terminal() {
        return vec!["local".to_string()];
    }
    use dialoguer::MultiSelect;
    let items = [
        "🏠 User settings (~/.claude/settings.json) — all projects",
        "📁 Project settings (.claude/settings.json) — shared with team",
        "⚙️  Local settings (.claude/settings.local.json) — personal",
        "🏢 Enterprise managed settings — system-wide (requires admin)",
    ];
    let values = ["user", "project", "local", "enterprise"];
    let selection = MultiSelect::new()
        .with_prompt(format!("Where would you like to install the {what}?"))
        .items(&items)
        .defaults(&[false, false, true, false])
        .interact()
        .unwrap_or_else(|_| vec![2]);
    let chosen: Vec<String> = selection.iter().map(|&i| values[i].to_string()).collect();
    if chosen.is_empty() {
        vec!["local".to_string()]
    } else {
        chosen
    }
}

fn confirm_overwrite(name: &str, location: &str) -> bool {
    if !std::io::stdin().is_terminal() {
        // inquirer default is `false` → do not overwrite.
        return false;
    }
    use dialoguer::Confirm;
    println!(
        "{}",
        format!("⚠️  Conflicts detected installing \"{name}\" in {location}.").yellow()
    );
    Confirm::new()
        .with_prompt(format!(
            "Overwrite the existing configuration in {location}?"
        ))
        .default(false)
        .interact()
        .unwrap_or(false)
}

fn write_additional_files(files: &[(String, String, bool)], current_target_dir: &Path) {
    for (path, content, executable) in files {
        let resolved = paths::resolve_additional_file(path, current_target_dir);
        if let Err(e) = fs_ext::write_file(&resolved, content, *executable) {
            println!("{}", format!("❌ Failed to install file {path}: {e}").red());
        }
    }
}

// --- tracking shims -------------------------------------------------------

fn track_success(ctype: &str, name: &str, start: Instant, opts: &InstallOptions) {
    tracking::track_outcome(
        ctype,
        name,
        Outcome::Success,
        &OutcomeMeta {
            duration_ms: Some(elapsed_ms(start)),
            batch_id: opts.batch_id.clone(),
            ..Default::default()
        },
    );
}

fn track_fail(
    ctype: &str,
    name: &str,
    error_type: &str,
    error_message: Option<String>,
    start: Instant,
    opts: &InstallOptions,
) {
    tracking::track_outcome(
        ctype,
        name,
        Outcome::Failure,
        &OutcomeMeta {
            error_type: Some(error_type.to_string()),
            error_message,
            duration_ms: Some(elapsed_ms(start)),
            batch_id: opts.batch_id.clone(),
        },
    );
}

fn track_outcome_count(
    ctype: &str,
    name: &str,
    count: usize,
    start: Instant,
    opts: &InstallOptions,
) {
    let outcome = if count > 0 {
        Outcome::Success
    } else {
        Outcome::Failure
    };
    tracking::track_outcome(
        ctype,
        name,
        outcome,
        &OutcomeMeta {
            duration_ms: Some(elapsed_ms(start)),
            batch_id: opts.batch_id.clone(),
            ..Default::default()
        },
    );
}

/// Print a generic network error for non-404 statuses / transport errors.
fn network_error(
    ctype: &str,
    name: &str,
    fetched: Result<Fetched>,
    start: Instant,
    opts: &InstallOptions,
) -> bool {
    let msg = match fetched {
        Ok(Fetched::Status(s)) => format!("HTTP {s}"),
        Err(e) => e.to_string(),
        _ => "unknown error".to_string(),
    };
    println!("{}", format!("❌ Error installing {ctype}: {msg}").red());
    track_fail(ctype, name, "network_error", Some(msg), start, opts);
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn last_segment_drops_category_prefix() {
        assert_eq!(
            last_segment("deep-research-team/research-synthesizer"),
            "research-synthesizer"
        );
        assert_eq!(last_segment("a/b/c"), "c");
        assert_eq!(last_segment("plain-name"), "plain-name");
    }

    #[test]
    fn slugify_lowercases_and_replaces_non_alnum() {
        assert_eq!(slugify("My Workflow #1"), "my_workflow__1");
        assert_eq!(slugify("already-ok"), "already_ok");
    }

    #[test]
    fn parse_csv_trims_and_filters_empties() {
        let s = " a , b ,, c ".to_string();
        assert_eq!(parse_csv(Some(&s)), vec!["a", "b", "c"]);
        assert!(parse_csv(None).is_empty());
        assert!(parse_csv(Some(&"".to_string())).is_empty());
    }

    #[test]
    fn short_id_has_expected_length() {
        assert_eq!(short_id().len(), 13);
    }
}
