# Enterprise Configuration Templates

Production-ready configuration for running Claude Code in enterprise environments.

## Files

| File | What It Covers |
|------|---------------|
| `network-configuration.md` | Proxy, custom CA, mTLS, firewall allowlist, credential refresh, troubleshooting |
| `managed-settings-policies.md` | Server-managed settings: permissions, model restrictions, org-wide CLAUDE.md, audit hooks |

## Quick Start

### Network setup (proxy + custom CA)
Add to `~/.claude/settings.json`:
```json
{
  "env": {
    "HTTPS_PROXY": "https://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com",
    "NODE_EXTRA_CA_CERTS": "/etc/ssl/certs/corp-ca-bundle.pem"
  }
}
```

### Conservative managed policy
Deploy via Anthropic Console (Teams/Enterprise):
```json
{
  "permissions": {
    "deny": ["Bash(rm -rf *)", "Bash(git push --force *)", "Read(.env)", "Read(.env.*)"]
  },
  "disableBypassPermissionsMode": "disable",
  "availableModels": ["sonnet", "haiku"]
}
```

Source: https://github.com/CodeWithBehnam/cc-docs
