//! Clap definition mirroring the commander option surface of the Node CLI.
//!
//! Flags are split into a natively-handled CORE path (component installation +
//! workflow-with-components) and a DASHBOARD/other path that delegates to Node.

use clap::Parser;

#[derive(Parser, Debug)]
#[command(
    name = "cct",
    version,
    about = "Setup Claude Code configurations and install components"
)]
pub struct Cli {
    // --- Project setup / template selection ---
    #[arg(short = 'l', long)]
    pub language: Option<String>,
    #[arg(short = 'f', long)]
    pub framework: Option<String>,
    #[arg(short = 't', long)]
    pub template: Option<String>,
    #[arg(short = 'd', long)]
    pub directory: Option<String>,
    #[arg(short = 'y', long)]
    pub yes: bool,
    #[arg(long = "dry-run")]
    pub dry_run: bool,

    // --- Component installation (CORE, native) ---
    #[arg(long)]
    pub agent: Option<String>,
    #[arg(long)]
    pub command: Option<String>,
    #[arg(long)]
    pub mcp: Option<String>,
    #[arg(long)]
    pub setting: Option<String>,
    #[arg(long)]
    pub hook: Option<String>,
    #[arg(long)]
    pub skill: Option<String>,
    #[arg(long)]
    pub workflow: Option<String>,
    #[arg(long)]
    pub prompt: Option<String>,

    // --- Global agent management (delegated) ---
    #[arg(long = "create-agent")]
    pub create_agent: Option<String>,
    #[arg(long = "list-agents")]
    pub list_agents: bool,
    #[arg(long = "remove-agent")]
    pub remove_agent: Option<String>,
    #[arg(long = "update-agent")]
    pub update_agent: Option<String>,

    // --- Analysis (delegated) ---
    #[arg(long = "command-stats", visible_alias = "commands-stats")]
    pub command_stats: bool,
    #[arg(long = "hook-stats", visible_alias = "hooks-stats")]
    pub hook_stats: bool,
    #[arg(long = "mcp-stats", visible_alias = "mcps-stats")]
    pub mcp_stats: bool,
    #[arg(
        long = "health-check",
        visible_alias = "health",
        visible_alias = "check",
        visible_alias = "verify"
    )]
    pub health_check: bool,

    // --- Dashboards & misc (delegated) ---
    #[arg(long)]
    pub analytics: bool,
    #[arg(long)]
    pub chats: bool,
    #[arg(long)]
    pub agents: bool,
    #[arg(long = "chats-mobile")]
    pub chats_mobile: bool,
    #[arg(long)]
    pub plugins: bool,
    #[arg(long = "skills-manager")]
    pub skills_manager: bool,
    #[arg(long)]
    pub teams: bool,
    #[arg(long = "2025")]
    pub year_2025: bool,
    #[arg(long)]
    pub tunnel: bool,
    #[arg(long)]
    pub studio: bool,
    #[arg(long)]
    pub sandbox: Option<String>,
    #[arg(long = "e2b-api-key")]
    pub e2b_api_key: Option<String>,
    #[arg(long = "anthropic-api-key")]
    pub anthropic_api_key: Option<String>,
    #[arg(long = "clone-session")]
    pub clone_session: Option<String>,
    #[arg(long)]
    pub verbose: bool,
}

impl Cli {
    /// True when any component-install flag is present (the native path).
    pub fn has_install_flags(&self) -> bool {
        self.agent.is_some()
            || self.command.is_some()
            || self.mcp.is_some()
            || self.setting.is_some()
            || self.hook.is_some()
            || self.skill.is_some()
    }
}
