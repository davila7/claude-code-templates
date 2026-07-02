//! GitHub fetch helpers: raw component downloads and the recursive contents-API
//! tree walk used by skills.

use crate::constants;
use anyhow::{anyhow, Result};
use serde_json::Value;
use std::time::Duration;

/// Outcome of a raw fetch: found content, an explicit 404, or another HTTP
/// status (treated as an error by callers).
pub enum Fetched {
    Ok(String),
    NotFound,
    Status(u16),
}

fn client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(constants::user_agent())
        .build()
        .map_err(|e| anyhow!("failed to build HTTP client: {e}"))
}

/// Fetch a raw URL, distinguishing 404 from other failures so callers can show
/// the same "not found" messaging the Node CLI does.
pub fn fetch_raw(url: &str) -> Result<Fetched> {
    let resp = client()?.get(url).send()?;
    let status = resp.status();
    if status.is_success() {
        Ok(Fetched::Ok(resp.text()?))
    } else if status.as_u16() == 404 {
        Ok(Fetched::NotFound)
    } else {
        Ok(Fetched::Status(status.as_u16()))
    }
}

/// Fetch a raw URL, returning `Some(text)` only on 2xx (used for optional
/// sidecar files like `.py`/`.sh` where any failure is silently ignored).
pub fn fetch_raw_optional(url: &str) -> Option<String> {
    let resp = client().ok()?.get(url).send().ok()?;
    if resp.status().is_success() {
        resp.text().ok()
    } else {
        None
    }
}

/// A file downloaded from the skill tree, keyed by its target path under
/// `.claude/skills/<base>/...`.
pub struct DownloadedFile {
    pub target_rel_path: String,
    pub content: String,
    pub executable: bool,
}

/// Recursively download every file under a skill directory via the GitHub
/// contents API. Mirrors `downloadDirectory` in `installIndividualSkill`.
///
/// Returns `Ok(None)` when the top-level path 404s (skill not found); `Ok(Some(
/// files))` otherwise.
pub fn download_skill_tree(
    api_url: &str,
    skill_base_name: &str,
) -> Result<Option<Vec<DownloadedFile>>> {
    let mut files = Vec::new();
    let found = walk(api_url, "", skill_base_name, &mut files)?;
    if !found {
        return Ok(None);
    }
    Ok(Some(files))
}

fn walk(
    api_url: &str,
    relative_path: &str,
    skill_base_name: &str,
    out: &mut Vec<DownloadedFile>,
) -> Result<bool> {
    let resp = client()?
        .get(api_url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()?;

    if resp.status().as_u16() == 404 {
        return Ok(false);
    }
    if !resp.status().is_success() {
        return Err(anyhow!("HTTP {}", resp.status().as_u16()));
    }

    let contents: Value = resp.json()?;
    let items = contents
        .as_array()
        .ok_or_else(|| anyhow!("unexpected contents API response"))?;

    for item in items {
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let item_path = if relative_path.is_empty() {
            name.to_string()
        } else {
            format!("{relative_path}/{name}")
        };

        if item_type == "file" {
            match item.get("download_url").and_then(|v| v.as_str()) {
                Some(download_url) => match fetch_raw_optional(download_url) {
                    Some(content) => {
                        let executable = name.ends_with(".py") || name.ends_with(".sh");
                        out.push(DownloadedFile {
                            target_rel_path: format!(
                                ".claude/skills/{skill_base_name}/{item_path}"
                            ),
                            content,
                            executable,
                        });
                    }
                    // Surface the skipped file (mirrors Node's "Could not
                    // download" log). SKILL.md absence is caught by the caller.
                    None => eprintln!("⚠️  Could not download skill file: {item_path}"),
                },
                None => eprintln!("⚠️  Missing download_url for skill file: {item_path}"),
            }
        } else if item_type == "dir" {
            if let Some(dir_url) = item.get("url").and_then(|v| v.as_str()) {
                walk(dir_url, &item_path, skill_base_name, out)?;
            }
        }
    }

    Ok(true)
}
