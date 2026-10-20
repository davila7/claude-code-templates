//! Delegation to the existing Node.js CLI for features not yet ported natively
//! (dashboards, sandbox, global agents, stats, health-check, interactive setup).
//!
//! Resolution order for the Node entry point:
//! 1. `CCT_NODE_BIN` env var — path to `create-claude-config.js` (run with
//!    `node`) or an executable to invoke directly. Used for local testing.
//! 2. Fallback: `npx -y claude-code-templates@latest <args>`.
//!
//! The original process args (everything after the binary name) are forwarded
//! verbatim with inherited stdio, so the delegated command behaves identically.

use anyhow::{anyhow, Result};
use std::process::Command;

pub fn delegate_to_node(forwarded_args: &[String]) -> Result<i32> {
    let mut command = build_command(forwarded_args)?;
    let status = command
        .status()
        .map_err(|e| anyhow!("failed to launch Node CLI: {e}. Is Node.js installed?"))?;
    // Preserve the child's termination semantics: a normal exit code, or for a
    // signal-killed child on Unix, the shell convention 128 + signal.
    let code = status.code().unwrap_or_else(|| {
        #[cfg(unix)]
        {
            use std::os::unix::process::ExitStatusExt;
            status.signal().map(|s| 128 + s).unwrap_or(1)
        }
        #[cfg(not(unix))]
        {
            1
        }
    });
    Ok(code)
}

fn build_command(forwarded_args: &[String]) -> Result<Command> {
    if let Ok(node_bin) = std::env::var("CCT_NODE_BIN") {
        if node_bin.ends_with(".js") {
            let mut c = Command::new("node");
            c.arg(&node_bin).args(forwarded_args);
            Ok(c)
        } else {
            let mut c = Command::new(node_bin);
            c.args(forwarded_args);
            Ok(c)
        }
    } else {
        let mut c = Command::new("npx");
        c.arg("-y")
            .arg("claude-code-templates@latest")
            .args(forwarded_args);
        Ok(c)
    }
}
