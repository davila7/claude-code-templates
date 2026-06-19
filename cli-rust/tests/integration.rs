//! End-to-end tests that drive the compiled `cct` binary.
//!
//! Network-dependent tests (real GitHub fetch) are marked `#[ignore]` so the
//! default `cargo test` stays offline/hermetic. Run them with:
//!
//!     cargo test -- --ignored
//!
//! Cargo exposes the built binary path via `CARGO_BIN_EXE_cct`.

use std::path::PathBuf;
use std::process::Command;

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_cct")
}

#[test]
fn help_exits_zero_and_shows_usage() {
    let out = Command::new(bin())
        .arg("--help")
        .output()
        .expect("failed to run cct");
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("Usage:"),
        "help output missing Usage:\n{stdout}"
    );
}

#[test]
fn version_flag_works() {
    let out = Command::new(bin())
        .arg("--version")
        .output()
        .expect("failed to run cct");
    assert!(out.status.success());
}

#[test]
#[ignore = "requires network (GitHub raw)"]
fn installs_agent_to_flat_dir() {
    let dir = tempfile::tempdir().unwrap();
    let status = Command::new(bin())
        .args([
            "--agent",
            "deep-research-team/research-synthesizer",
            "-d",
            dir.path().to_str().unwrap(),
        ])
        .env("CCT_NO_TRACKING", "1")
        .status()
        .expect("failed to run cct");
    assert!(status.success());

    // Category dropped: file lands flat under .claude/agents/.
    let expected: PathBuf = dir.path().join(".claude/agents/research-synthesizer.md");
    assert!(
        expected.exists(),
        "expected {} to exist",
        expected.display()
    );
}

#[test]
#[ignore = "requires network (GitHub raw)"]
fn installs_mcp_with_two_space_json_and_no_description() {
    let dir = tempfile::tempdir().unwrap();
    let status = Command::new(bin())
        .args([
            "--mcp",
            "devtools/elasticsearch",
            "-d",
            dir.path().to_str().unwrap(),
        ])
        .env("CCT_NO_TRACKING", "1")
        .status()
        .expect("failed to run cct");
    assert!(status.success());

    let mcp = dir.path().join(".mcp.json");
    let text = std::fs::read_to_string(&mcp).unwrap();
    assert!(text.contains("\"mcpServers\""));
    // A pretty-printed 2-space top-level key looks like `\n  "key"`.
    assert!(
        text.contains("\n  \""),
        "expected a line indented with exactly two spaces"
    );
    // And NOT 4-space indentation at the top level.
    assert!(
        !text.contains("\n    \"mcpServers\""),
        "did not expect 4-space indentation"
    );
    assert!(text.ends_with('\n'), "expected trailing newline");
    // description is stripped from each server before merge.
    let v: serde_json::Value = serde_json::from_str(&text).unwrap();
    for (_name, server) in v["mcpServers"].as_object().unwrap() {
        assert!(server.get("description").is_none());
    }
}
