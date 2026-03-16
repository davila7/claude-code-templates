# Enterprise Setup: Network Configuration

Complete network setup for running Claude Code in enterprise environments with proxies, firewalls, custom CAs, and mTLS.

---

## Corporate Proxy

### Basic proxy

```bash
export HTTPS_PROXY=https://proxy.corp.example.com:8080
export HTTP_PROXY=http://proxy.corp.example.com:8080
```

### Proxy with authentication

```bash
export HTTPS_PROXY=https://username:password@proxy.corp.example.com:8080
```

### Bypass proxy for internal services

```bash
export NO_PROXY="localhost,127.0.0.1,.corp.example.com,10.0.0.0/8,192.168.0.0/16"
```

### Persistent proxy config

Add to `~/.claude/settings.json`:

```json
{
  "env": {
    "HTTPS_PROXY": "https://proxy.corp.example.com:8080",
    "HTTP_PROXY": "http://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com"
  }
}
```

---

## Custom Certificate Authority (CA)

For corporate CAs or self-signed certificates:

### Single CA certificate

```bash
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

### Multiple CA certificates (bundle)

Concatenate all CA certs into one PEM file:

```bash
cat corp-root-ca.pem corp-intermediate-ca.pem > /path/to/ca-bundle.pem
export NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.pem
```

### Persistent CA config

```json
{
  "env": {
    "NODE_EXTRA_CA_CERTS": "/etc/ssl/certs/corporate-ca-bundle.pem"
  }
}
```

---

## mTLS (Mutual TLS) Client Certificates

For environments requiring client certificate authentication:

```bash
export CLAUDE_CODE_CLIENT_CERT=/path/to/client-cert.pem
export CLAUDE_CODE_CLIENT_KEY=/path/to/client-key.pem
```

With passphrase-protected key:

```bash
export CLAUDE_CODE_CLIENT_KEY_PASSPHRASE="your-passphrase"
```

### Persistent mTLS config

```json
{
  "env": {
    "CLAUDE_CODE_CLIENT_CERT": "/etc/ssl/certs/client-cert.pem",
    "CLAUDE_CODE_CLIENT_KEY": "/etc/ssl/private/client-key.pem"
  }
}
```

---

## Credential Auto-Refresh

For SSO sessions that expire:

### AWS SSO

```json
{
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_PROFILE": "corp-sso"
  },
  "awsAuthRefresh": "aws sso login --profile corp-sso"
}
```

### Generic credential refresh

Create a refresh script (`~/bin/refresh-creds.sh`):

```bash
#!/bin/bash
# Refresh corporate SSO token
corp-cli auth refresh --silent
# Output the new API key
corp-cli auth token
```

```json
{
  "apiKeyHelper": "~/bin/refresh-creds.sh"
}
```

Set refresh interval:

```bash
export CLAUDE_CODE_API_KEY_HELPER_TTL_MS=3600000  # 1 hour
```

---

## Firewall / Domain Allowlist

Claude Code needs access to these domains:

### Required domains

| Domain | Purpose |
|--------|---------|
| `api.anthropic.com` | Claude API |
| `statsig.anthropic.com` | Feature flags and configuration |
| `sentry.io` | Error reporting |

### Additional domains (based on features used)

| Domain | Purpose |
|--------|---------|
| `github.com` | Git operations |
| `api.github.com` | GitHub API (MCP, Actions) |
| `registry.npmjs.org` | npm packages (MCP servers, plugins) |
| `pypi.org` | Python packages |
| `mcp.slack.com` | Slack MCP integration |
| `mcp.notion.com` | Notion MCP integration |

### For cloud providers

| Domain | Purpose |
|--------|---------|
| `bedrock-runtime.*.amazonaws.com` | AWS Bedrock |
| `sts.amazonaws.com` | AWS STS (credential exchange) |
| `*.aiplatform.googleapis.com` | Google Vertex AI |
| `oauth2.googleapis.com` | Google OAuth |

---

## Complete Enterprise settings.json

```json
{
  "env": {
    "HTTPS_PROXY": "https://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com",
    "NODE_EXTRA_CA_CERTS": "/etc/ssl/certs/corp-ca-bundle.pem",
    "CLAUDE_CODE_CLIENT_CERT": "/etc/ssl/certs/client.pem",
    "CLAUDE_CODE_CLIENT_KEY": "/etc/ssl/private/client-key.pem",
    "ANTHROPIC_BASE_URL": "https://ai-gateway.corp.example.com"
  },
  "apiKeyHelper": "~/bin/get-corp-api-key.sh"
}
```

---

## Troubleshooting

| Issue | Diagnostic | Fix |
|-------|-----------|-----|
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Missing CA cert | Set `NODE_EXTRA_CA_CERTS` |
| `ECONNREFUSED` | Proxy not reachable | Check `HTTPS_PROXY` URL and port |
| `407 Proxy Authentication Required` | Proxy needs credentials | Add user:pass to proxy URL |
| `CERT_HAS_EXPIRED` | Expired CA or client cert | Update certificate files |
| `ERR_TLS_CERT_ALTNAME_INVALID` | Wrong domain in cert | Verify cert covers the domain |
| `SELF_SIGNED_CERT_IN_CHAIN` | Missing intermediate CA | Add all CAs to bundle PEM |
| `socket hang up` | Proxy blocking WebSocket | Check proxy supports WebSocket upgrade |

### Debug network issues

```bash
# Verbose mode shows network details
claude --debug

# Test proxy connection
curl -v --proxy $HTTPS_PROXY https://api.anthropic.com

# Test CA certificate
openssl s_client -connect api.anthropic.com:443 -CAfile /path/to/ca-bundle.pem

# Test client certificate
openssl s_client -connect gateway.corp.example.com:443 \
  -cert /path/to/client.pem -key /path/to/client-key.pem
```

---

## Tips

- Always test connectivity with `curl` before configuring Claude Code
- Concatenate CA certificates in order: root CA last, intermediate CAs first
- Use `NO_PROXY` to bypass proxy for internal tools (MCP servers, local APIs)
- Client certificate keys should be readable only by the user (`chmod 600`)
- For MDM-managed devices, certificates are often in `/etc/ssl/certs/` already
- Use `claude --debug` to see detailed network error messages
