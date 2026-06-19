//! JSON merge semantics for `.mcp.json`, settings, and hooks.
//!
//! These three have **different** merge rules in the Node CLI and must stay
//! distinct (see `index.js`):
//! - MCP: shallow top-level spread + per-server override (incoming wins).
//! - settings: deep-ish merge; `permissions.{allow,deny,ask}` deduped by Set
//!   union; `env`/`hooks` shallow-merged.
//! - hooks: per-hook-type **array concatenation** (append, not overwrite).

use serde_json::{json, Map, Value};

/// Remove the `description` field from every server in `mcpServers`.
/// Mirrors the loop in `installIndividualMCP` before merging.
pub fn strip_mcp_descriptions(config: &mut Value) {
    if let Some(servers) = config.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        for (_name, server) in servers.iter_mut() {
            if let Some(obj) = server.as_object_mut() {
                // `shift_remove` preserves key order (matches JS `delete`);
                // plain `remove` would swap-remove and reorder keys.
                obj.shift_remove("description");
            }
        }
    }
}

/// Merge an incoming `.mcp.json` config into an existing one.
/// `{...existing, ...incoming}` then a per-server merge of `mcpServers`.
pub fn merge_mcp(existing: &Value, incoming: &Value) -> Value {
    let mut merged = to_object(existing);
    let incoming_obj = to_object(incoming);

    // Top-level shallow spread: incoming wins.
    for (k, v) in incoming_obj.iter() {
        merged.insert(k.clone(), v.clone());
    }

    // Per-server merge only when both sides have mcpServers objects.
    if let (Some(existing_servers), Some(incoming_servers)) = (
        existing.get("mcpServers").and_then(Value::as_object),
        incoming.get("mcpServers").and_then(Value::as_object),
    ) {
        let mut servers = existing_servers.clone();
        for (k, v) in incoming_servers.iter() {
            servers.insert(k.clone(), v.clone());
        }
        merged.insert("mcpServers".to_string(), Value::Object(servers));
    }

    Value::Object(merged)
}

/// Merge an incoming setting config into an existing settings file.
pub fn merge_settings(existing: &Value, incoming: &Value) -> Value {
    let mut merged = to_object(existing);
    let incoming_obj = to_object(incoming);

    // Top-level shallow spread: incoming wins.
    for (k, v) in incoming_obj.iter() {
        merged.insert(k.clone(), v.clone());
    }

    // permissions: object spread + array union for allow/deny/ask.
    if let (Some(existing_perms), Some(incoming_perms)) = (
        existing.get("permissions").and_then(Value::as_object),
        incoming.get("permissions").and_then(Value::as_object),
    ) {
        let mut perms = existing_perms.clone();
        for (k, v) in incoming_perms.iter() {
            perms.insert(k.clone(), v.clone());
        }
        for key in ["allow", "deny", "ask"] {
            if let (Some(a), Some(b)) = (
                existing_perms.get(key).and_then(Value::as_array),
                incoming_perms.get(key).and_then(Value::as_array),
            ) {
                perms.insert(key.to_string(), Value::Array(union_dedup(a, b)));
            }
        }
        merged.insert("permissions".to_string(), Value::Object(perms));
    }

    // env: shallow merge (incoming wins).
    if let (Some(a), Some(b)) = (
        existing.get("env").and_then(Value::as_object),
        incoming.get("env").and_then(Value::as_object),
    ) {
        let mut env = a.clone();
        for (k, v) in b.iter() {
            env.insert(k.clone(), v.clone());
        }
        merged.insert("env".to_string(), Value::Object(env));
    }

    // hooks: shallow merge (incoming wins) — settings path only.
    if let (Some(a), Some(b)) = (
        existing.get("hooks").and_then(Value::as_object),
        incoming.get("hooks").and_then(Value::as_object),
    ) {
        let mut hooks = a.clone();
        for (k, v) in b.iter() {
            hooks.insert(k.clone(), v.clone());
        }
        merged.insert("hooks".to_string(), Value::Object(hooks));
    }

    Value::Object(merged)
}

/// Merge an incoming hook config into an existing settings file.
/// Per hook type, **concatenate** arrays (append); convert old string format to
/// the `{matcher:"*", hooks:[{type:"command", command}]}` shape.
pub fn merge_hooks(existing: &Value, incoming: &Value) -> Value {
    let mut merged = to_object(existing);

    // Ensure merged.hooks exists as an object.
    let mut hooks = merged
        .get("hooks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    if let Some(incoming_hooks) = incoming.get("hooks").and_then(Value::as_object) {
        for (hook_type, incoming_val) in incoming_hooks.iter() {
            match hooks.get(hook_type) {
                None => {
                    // New hook type: copy as-is.
                    hooks.insert(hook_type.clone(), incoming_val.clone());
                }
                Some(existing_val) => {
                    if let Some(incoming_arr) = incoming_val.as_array() {
                        // New (array) format: append to existing array.
                        let mut base = existing_val.as_array().cloned().unwrap_or_default();
                        base.extend(incoming_arr.iter().cloned());
                        hooks.insert(hook_type.clone(), Value::Array(base));
                    } else {
                        // Old (string) format: wrap into a matcher object.
                        let mut base = existing_val.as_array().cloned().unwrap_or_default();
                        base.push(json!({
                            "matcher": "*",
                            "hooks": [{ "type": "command", "command": incoming_val }],
                        }));
                        hooks.insert(hook_type.clone(), Value::Array(base));
                    }
                }
            }
        }
    }

    merged.insert("hooks".to_string(), Value::Object(hooks));
    Value::Object(merged)
}

/// `[...new Set([...a, ...b])]` preserving first-occurrence order.
fn union_dedup(a: &[Value], b: &[Value]) -> Vec<Value> {
    let mut seen: Vec<String> = Vec::new();
    let mut out: Vec<Value> = Vec::new();
    for v in a.iter().chain(b.iter()) {
        let key = serde_json::to_string(v).unwrap_or_default();
        if !seen.contains(&key) {
            seen.push(key);
            out.push(v.clone());
        }
    }
    out
}

fn to_object(v: &Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn mcp_merge_overrides_per_server_and_keeps_existing() {
        let existing = json!({
            "mcpServers": { "a": { "command": "old-a" } }
        });
        let mut incoming = json!({
            "mcpServers": {
                "a": { "command": "new-a", "description": "drop me" },
                "b": { "command": "new-b" }
            }
        });
        strip_mcp_descriptions(&mut incoming);
        let merged = merge_mcp(&existing, &incoming);
        assert_eq!(merged["mcpServers"]["a"]["command"], "new-a");
        // description stripped before merge
        assert!(merged["mcpServers"]["a"].get("description").is_none());
        assert_eq!(merged["mcpServers"]["b"]["command"], "new-b");
    }

    #[test]
    fn settings_permissions_arrays_are_set_unioned() {
        let existing = json!({
            "permissions": { "allow": ["Bash(npm:*)", "Read"] }
        });
        let incoming = json!({
            "permissions": { "allow": ["Read", "Bash(git:*)"] }
        });
        let merged = merge_settings(&existing, &incoming);
        assert_eq!(
            merged["permissions"]["allow"],
            json!(["Bash(npm:*)", "Read", "Bash(git:*)"])
        );
    }

    #[test]
    fn settings_env_shallow_merges() {
        let existing = json!({ "env": { "A": "1", "B": "2" } });
        let incoming = json!({ "env": { "B": "9", "C": "3" } });
        let merged = merge_settings(&existing, &incoming);
        assert_eq!(merged["env"], json!({ "A": "1", "B": "9", "C": "3" }));
    }

    #[test]
    fn hooks_append_arrays_for_same_type() {
        let existing = json!({
            "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [] }] }
        });
        let incoming = json!({
            "hooks": { "PreToolUse": [{ "matcher": "Edit", "hooks": [] }] }
        });
        let merged = merge_hooks(&existing, &incoming);
        let arr = merged["hooks"]["PreToolUse"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["matcher"], "Bash");
        assert_eq!(arr[1]["matcher"], "Edit");
    }

    #[test]
    fn hooks_new_type_copied_verbatim() {
        let existing = json!({});
        let incoming = json!({
            "hooks": { "PostToolUse": [{ "matcher": "*", "hooks": [] }] }
        });
        let merged = merge_hooks(&existing, &incoming);
        assert!(merged["hooks"]["PostToolUse"].is_array());
    }
}
