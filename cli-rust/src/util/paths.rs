//! Path resolution helpers: home dir, settings-location mapping, enterprise
//! managed-settings directories, and relative-path computation for tracking.

use directories::UserDirs;
use std::path::{Path, PathBuf};

/// Resolve the user's home directory (equivalent to `os.homedir()`).
pub fn home_dir() -> PathBuf {
    UserDirs::new()
        .map(|d| d.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// A resolved install location for a setting/hook: the directory the settings
/// file lives in and the filename. Mirrors the branching in
/// `installIndividualSetting` / `installIndividualHook`.
pub struct ResolvedLocation {
    /// Base dir the additional files resolve against (`currentTargetDir`).
    pub current_target_dir: PathBuf,
    /// Absolute path of the settings JSON file to merge into.
    pub settings_file: PathBuf,
}

/// Map a location keyword (`user`/`project`/`local`/`enterprise`) to concrete
/// paths, given the project `target_dir`. Returns `None` for unsupported
/// enterprise platforms (Node falls back to user settings in that case — the
/// caller handles the fallback).
pub fn resolve_location(location: &str, target_dir: &Path) -> ResolvedLocation {
    match location {
        "user" => {
            let dir = home_dir();
            ResolvedLocation {
                settings_file: dir.join(".claude").join("settings.json"),
                current_target_dir: dir,
            }
        }
        "project" => ResolvedLocation {
            current_target_dir: target_dir.to_path_buf(),
            settings_file: target_dir.join(".claude").join("settings.json"),
        },
        "enterprise" => {
            if let Some(dir) = enterprise_dir() {
                let file = dir.join("managed-settings.json");
                ResolvedLocation {
                    current_target_dir: dir,
                    settings_file: file,
                }
            } else {
                // Fallback to user settings (matches Node's else branch).
                let dir = home_dir();
                ResolvedLocation {
                    settings_file: dir.join(".claude").join("settings.json"),
                    current_target_dir: dir,
                }
            }
        }
        // "local" and any unknown value default to local settings.
        _ => ResolvedLocation {
            current_target_dir: target_dir.to_path_buf(),
            settings_file: target_dir.join(".claude").join("settings.local.json"),
        },
    }
}

/// Enterprise managed-settings directory per platform.
/// macOS: `/Library/Application Support/ClaudeCode`
/// Linux/WSL: `/etc/claude-code`
/// Windows: `C:\ProgramData\ClaudeCode`
fn enterprise_dir() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        Some(PathBuf::from("/Library/Application Support/ClaudeCode"))
    } else if cfg!(target_os = "linux") {
        Some(PathBuf::from("/etc/claude-code"))
    } else if cfg!(target_os = "windows") {
        Some(PathBuf::from("C:\\ProgramData\\ClaudeCode"))
    } else {
        None
    }
}

/// Resolve an "additional file" path the way Node does: a leading `~` expands
/// to the home directory, otherwise it resolves against `current_target_dir`.
pub fn resolve_additional_file(file_path: &str, current_target_dir: &Path) -> PathBuf {
    if let Some(rest) = file_path.strip_prefix('~') {
        // `path.join(homedir(), filePath.slice(1))` — strip the `~`, keep rest.
        let rest = rest.strip_prefix('/').unwrap_or(rest);
        home_dir().join(rest)
    } else {
        current_target_dir.join(file_path)
    }
}

/// Best-effort equivalent of `path.relative(from, to)` for tracking metadata.
pub fn relative_path(from: &Path, to: &Path) -> String {
    pathdiff::diff_paths(to, from)
        .unwrap_or_else(|| to.to_path_buf())
        .to_string_lossy()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn local_location_uses_settings_local_json() {
        let target = PathBuf::from("/tmp/proj");
        let r = resolve_location("local", &target);
        assert_eq!(r.settings_file, target.join(".claude/settings.local.json"));
        assert_eq!(r.current_target_dir, target);
    }

    #[test]
    fn project_location_uses_settings_json() {
        let target = PathBuf::from("/tmp/proj");
        let r = resolve_location("project", &target);
        assert_eq!(r.settings_file, target.join(".claude/settings.json"));
    }

    #[test]
    fn user_location_resolves_under_home() {
        let r = resolve_location("user", Path::new("/tmp/proj"));
        assert_eq!(r.settings_file, home_dir().join(".claude/settings.json"));
        assert_eq!(r.current_target_dir, home_dir());
    }

    #[test]
    fn additional_file_expands_tilde_to_home() {
        let resolved = resolve_additional_file("~/.claude/x.py", Path::new("/tmp/proj"));
        assert_eq!(resolved, home_dir().join(".claude/x.py"));
    }

    #[test]
    fn additional_file_resolves_relative_against_target() {
        let resolved = resolve_additional_file(".claude/scripts/s.py", Path::new("/tmp/proj"));
        assert_eq!(resolved, PathBuf::from("/tmp/proj/.claude/scripts/s.py"));
    }

    #[test]
    fn relative_path_computes_dotdot() {
        let rel = relative_path(Path::new("/a/b"), Path::new("/a/c/d"));
        assert_eq!(rel, "../c/d");
    }
}
