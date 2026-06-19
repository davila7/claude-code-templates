//! Anonymous, fire-and-forget download/usage analytics.
//!
//! Port of `cli-tool/src/tracking-service.js`. Every call spawns a detached
//! thread with its own 5s-timeout HTTP client and swallows all errors, so
//! tracking can never block or break the CLI. Opt-out via `CCT_NO_TRACKING`,
//! `CCT_NO_ANALYTICS`, or `CI=true`.

use crate::constants;
use serde_json::{json, Value};
use std::time::Duration;

/// Whether tracking is enabled. Honors both `true` and `1` as opt-out values
/// (the README documents `=1`); Node only checks `=== 'true'`, so this is
/// intentionally more privacy-protective.
pub fn enabled() -> bool {
    let off = |k: &str| matches!(std::env::var(k).ok().as_deref(), Some("true") | Some("1"));
    !(off("CCT_NO_TRACKING") || off("CCT_NO_ANALYTICS") || off("CI"))
}

fn post_async(url: &'static str, body: Value) {
    if !enabled() {
        return;
    }
    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
        {
            Ok(c) => c,
            Err(_) => return,
        };
        // Best-effort; ignore all outcomes.
        let _ = client
            .post(url)
            .header("Content-Type", "application/json")
            .header("User-Agent", constants::user_agent())
            .json(&body)
            .send();
    });
}

/// Metadata accompanying a download event. Only the fields the Node payload
/// actually reads are modeled.
#[derive(Default)]
pub struct DownloadMeta {
    pub target_directory: Option<String>,
    pub path: Option<String>,
    pub category: Option<String>,
}

/// Compute the `path` and `category` fields the way `sendToDatabase` does:
/// `path` falls back to target_directory → path → name; `category` falls back
/// to metadata or the `category/` prefix of the name, else `"general"`.
pub fn download_path_category(name: &str, meta: &DownloadMeta) -> (String, String) {
    let path = meta
        .target_directory
        .clone()
        .or_else(|| meta.path.clone())
        .unwrap_or_else(|| name.to_string());

    let category = meta.category.clone().unwrap_or_else(|| {
        if name.contains('/') {
            name.split('/').next().unwrap_or("general").to_string()
        } else {
            "general".to_string()
        }
    });

    (path, category)
}

/// `trackDownload` → POST `/api/track-download-supabase`.
pub fn track_download(component_type: &str, name: &str, meta: &DownloadMeta) {
    let (path, category) = download_path_category(name, meta);

    let body = json!({
        "type": component_type,
        "name": name,
        "path": path,
        "category": category,
        "cliVersion": constants::CLI_VERSION,
    });
    post_async(constants::TRACK_DOWNLOAD_URL, body);
}

/// Outcome of an installation attempt.
pub enum Outcome {
    Success,
    Failure,
    #[allow(dead_code)]
    Partial,
}

impl Outcome {
    fn as_str(&self) -> &'static str {
        match self {
            Outcome::Success => "success",
            Outcome::Failure => "failure",
            Outcome::Partial => "partial",
        }
    }
}

/// Extra fields for `trackInstallationOutcome`.
#[derive(Default)]
pub struct OutcomeMeta {
    pub error_type: Option<String>,
    pub error_message: Option<String>,
    pub duration_ms: Option<u128>,
    pub batch_id: Option<String>,
}

/// `trackInstallationOutcome` → POST `/api/track-installation-outcome`.
pub fn track_outcome(component_type: &str, name: &str, outcome: Outcome, meta: &OutcomeMeta) {
    let body = json!({
        "componentType": component_type,
        "componentName": name,
        "outcome": outcome.as_str(),
        "errorType": meta.error_type,
        "errorMessage": meta.error_message,
        "durationMs": meta.duration_ms.map(|d| d as u64),
        "cliVersion": constants::CLI_VERSION,
        "nodeVersion": Value::Null,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "batchId": meta.batch_id,
    });
    post_async(constants::TRACK_OUTCOME_URL, body);
}

/// `trackCommandExecution` → POST `/api/track-command-usage`.
#[allow(dead_code)]
pub fn track_command(command: &str, metadata: Value) {
    let body = json!({
        "command": command,
        "cliVersion": constants::CLI_VERSION,
        "nodeVersion": Value::Null,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "sessionId": uuid::Uuid::new_v4().to_string(),
        "metadata": metadata,
    });
    post_async(constants::TRACK_COMMAND_URL, body);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_falls_back_to_name_and_category_to_general() {
        let (path, category) = download_path_category("web-fetch", &DownloadMeta::default());
        assert_eq!(path, "web-fetch");
        assert_eq!(category, "general");
    }

    #[test]
    fn category_derives_from_slash_prefix() {
        let (_, category) =
            download_path_category("devtools/elasticsearch", &DownloadMeta::default());
        assert_eq!(category, "devtools");
    }

    #[test]
    fn target_directory_takes_priority_for_path() {
        let meta = DownloadMeta {
            target_directory: Some("../proj".into()),
            path: Some("ignored".into()),
            category: Some("custom".into()),
        };
        let (path, category) = download_path_category("a/b", &meta);
        assert_eq!(path, "../proj");
        assert_eq!(category, "custom");
    }

    #[test]
    fn enabled_respects_opt_out_env() {
        // Serialized via a single test to avoid env races across threads.
        std::env::set_var("CCT_NO_TRACKING", "true");
        assert!(!enabled());
        std::env::set_var("CCT_NO_TRACKING", "1"); // documented `=1` value
        assert!(!enabled());
        std::env::remove_var("CCT_NO_TRACKING");
        std::env::set_var("CI", "true");
        assert!(!enabled());
        std::env::remove_var("CI");
    }
}
