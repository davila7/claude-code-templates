//! Filesystem helpers that reproduce the byte-level behavior of the Node CLI's
//! `fs-extra` usage (`ensureDir`, `readJson`, `writeJson({spaces:2})`, `chmod`).

use anyhow::{Context, Result};
use serde_json::Value;
use std::fs;
use std::path::Path;

/// Equivalent of `fs.ensureDir` — create a directory and all parents.
pub fn ensure_dir(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir).with_context(|| format!("failed to create directory {}", dir.display()))
}

/// Equivalent of `fs.readJson` — read + parse a JSON file into a `Value`.
pub fn read_json(path: &Path) -> Result<Value> {
    let text =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    let value = serde_json::from_str(&text)
        .with_context(|| format!("failed to parse JSON {}", path.display()))?;
    Ok(value)
}

/// Equivalent of `fs.writeJson(path, value, {spaces: 2})`.
///
/// `serde_json::to_string_pretty` uses a 2-space indent, matching Node's
/// `{spaces: 2}`. `fs-extra`/`jsonfile` appends a trailing newline by default
/// (`finalEOL: true`), so we append one too for byte parity.
pub fn write_json_pretty(path: &Path, value: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let mut text = serde_json::to_string_pretty(value).context("failed to serialize JSON")?;
    text.push('\n');
    fs::write(path, text).with_context(|| format!("failed to write {}", path.display()))?;
    Ok(())
}

/// Write a text file (UTF-8), creating parent directories. Optionally mark it
/// executable (`chmod 0o755`) on Unix; a no-op on Windows.
pub fn write_file(path: &Path, content: &str, executable: bool) -> Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content).with_context(|| format!("failed to write {}", path.display()))?;
    if executable {
        make_executable(path)?;
    }
    Ok(())
}

/// `chmod 0o755` on Unix; no-op elsewhere.
#[cfg(unix)]
pub fn make_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)
        .with_context(|| format!("failed to stat {}", path.display()))?
        .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms)
        .with_context(|| format!("failed to chmod {}", path.display()))?;
    Ok(())
}

#[cfg(not(unix))]
pub fn make_executable(_path: &Path) -> Result<()> {
    Ok(())
}
