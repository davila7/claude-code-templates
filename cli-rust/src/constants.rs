//! Centralized constants: GitHub endpoints, tracking URLs, repo coordinates.
//!
//! Mirrors the hard-coded URLs used across `cli-tool/src/index.js` and
//! `cli-tool/src/tracking-service.js` so the Rust port hits the exact same
//! sources and analytics endpoints.

/// Repo owner/name and default branch used to build raw + API URLs.
pub const REPO: &str = "davila7/claude-code-templates";
pub const BRANCH: &str = "main";

/// Base for raw component downloads:
/// `https://raw.githubusercontent.com/<repo>/<branch>/cli-tool/components`
pub fn raw_components_base() -> String {
    format!("https://raw.githubusercontent.com/{REPO}/{BRANCH}/cli-tool/components")
}

/// Base for the GitHub contents API (used by skills, recursive tree download):
/// `https://api.github.com/repos/<repo>/contents/cli-tool/components`
pub fn api_components_base() -> String {
    format!("https://api.github.com/repos/{REPO}/contents/cli-tool/components")
}

// Tracking endpoints (Vercel — www.aitmpl.com). Fire-and-forget only.
pub const TRACK_DOWNLOAD_URL: &str = "https://www.aitmpl.com/api/track-download-supabase";
pub const TRACK_COMMAND_URL: &str = "https://www.aitmpl.com/api/track-command-usage";
pub const TRACK_OUTCOME_URL: &str = "https://www.aitmpl.com/api/track-installation-outcome";

/// CLI version reported to tracking + User-Agent.
pub const CLI_VERSION: &str = env!("CARGO_PKG_VERSION");

/// User-Agent string used for tracking and the GitHub contents API.
pub fn user_agent() -> String {
    format!("claude-code-templates/{CLI_VERSION}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_base_points_at_main_components() {
        assert_eq!(
            raw_components_base(),
            "https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components"
        );
    }

    #[test]
    fn api_base_points_at_contents() {
        assert_eq!(
            api_components_base(),
            "https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components"
        );
    }

    #[test]
    fn user_agent_carries_version() {
        assert!(user_agent().starts_with("claude-code-templates/"));
    }
}
