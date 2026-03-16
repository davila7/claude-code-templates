#!/bin/bash
# network-exfiltration-guard.sh
# Blocks network commands to untrusted domains and prevents
# exfiltration of sensitive files.
# Requires: jq

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ============================================================
# CUSTOMIZE: Domains that are safe to contact.
# Requests to any domain NOT in this list will be blocked.
# Only applies to commands that match NETWORK_TOOLS below.
# ============================================================
ALLOWED_DOMAINS=(
  "localhost"
  "127.0.0.1"
  "::1"
  "registry.npmjs.org"
  "pypi.org"
  "files.pythonhosted.org"
  "rubygems.org"
  "github.com"
  "api.github.com"
  "raw.githubusercontent.com"
  "gitlab.com"
  "bitbucket.org"
  "crates.io"
  "pkg.go.dev"
  "proxy.golang.org"
  "dl.google.com"
  "archive.ubuntu.com"
  "security.ubuntu.com"
)

# Tools that make network requests
NETWORK_TOOLS="curl|wget|nc|ncat|netcat|scp|rsync|ftp|sftp"

# Sensitive file patterns (always blocked from being sent externally)
SENSITIVE_PATTERNS=(
  '\.env'
  '\.ssh/'
  'id_rsa'
  'id_ed25519'
  '\.pem$'
  '\.key$'
  '\.secret'
  'credentials'
  '\.aws/'
  '\.gcloud/'
  'token'
  'password'
  '\.npmrc'
  '\.pypirc'
)

# --- Check 1: Block sensitive file exfiltration ---
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  # Check for piping sensitive files to network tools
  if echo "$COMMAND" | grep -qE "${pattern}.*\|\s*($NETWORK_TOOLS)"; then
    echo "BLOCKED: Potential exfiltration of sensitive file matching '$pattern'" >&2
    exit 2
  fi
  # Check for network tool reading sensitive file directly
  if echo "$COMMAND" | grep -qE "($NETWORK_TOOLS)\s+.*(-d\s+@|-F\s+.*=@|--data-binary\s+@|--upload-file\s+).*${pattern}"; then
    echo "BLOCKED: Network command uploading sensitive file matching '$pattern'" >&2
    exit 2
  fi
done

# --- Check 2: Block network tools contacting untrusted domains ---
if echo "$COMMAND" | grep -qE "($NETWORK_TOOLS)"; then
  # Extract URLs (http/https)
  URLS=$(echo "$COMMAND" | grep -oE 'https?://[^ /"]+' | sed 's|https\?://||' | cut -d'/' -f1 | cut -d':' -f1)
  # Extract hostnames after tool name (handles curl, wget, etc.)
  HOSTS=$(echo "$COMMAND" | grep -oE "($NETWORK_TOOLS)[[:space:]]+[^ ]*" | awk '{print $2}' | grep -vE '^-' | sed 's|https\?://||' | cut -d'/' -f1 | cut -d':' -f1)
  # Extract scp/rsync destinations (user@host:path or host:path patterns)
  SCP_HOSTS=$(echo "$COMMAND" | grep -oE '([a-zA-Z0-9._-]+@)?[a-zA-Z0-9._-]+:' | sed 's/@/\n/' | tail -1 | sed 's/:$//')
  ALL_TARGETS=$(printf '%s\n%s\n%s\n' "$URLS" "$HOSTS" "$SCP_HOSTS" | sort -u | grep -v '^$')

  if [ -n "$ALL_TARGETS" ]; then
    for target in $ALL_TARGETS; do
      ALLOWED=false
      for domain in "${ALLOWED_DOMAINS[@]}"; do
        if [ "$target" = "$domain" ] || [[ "$target" == *".$domain" ]]; then
          ALLOWED=true
          break
        fi
      done
      if [ "$ALLOWED" = false ]; then
        echo "BLOCKED: Network request to untrusted domain '$target'" >&2
        echo "Add it to ALLOWED_DOMAINS in network-exfiltration-guard.sh if this is intentional." >&2
        exit 2
      fi
    done
  fi
fi

exit 0
