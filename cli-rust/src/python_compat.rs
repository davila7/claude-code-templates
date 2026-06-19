//! Windows Python-command compatibility shim.
//!
//! Mirrors `replacePythonCommands` in `index.js`: on Windows only, replace
//! `python3 ` with `python ` in the serialized JSON, then re-parse. No-op on
//! every other platform.

use serde_json::Value;

pub fn replace_python_commands(config: Value) -> Value {
    if cfg!(target_os = "windows") {
        if let Ok(s) = serde_json::to_string(&config) {
            let replaced = s.replace("python3 ", "python ");
            if let Ok(parsed) = serde_json::from_str(&replaced) {
                return parsed;
            }
        }
    }
    config
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn non_windows_is_noop() {
        // On the CI/dev platforms (non-Windows) the config is returned as-is.
        let cfg = json!({ "cmd": "python3 script.py" });
        let out = replace_python_commands(cfg.clone());
        if cfg!(target_os = "windows") {
            assert_eq!(out["cmd"], "python script.py");
        } else {
            assert_eq!(out, cfg);
        }
    }
}
