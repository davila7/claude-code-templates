#!/usr/bin/env bash
# configure-yolo-modes.sh
# Configure auto/YOLO mode for all AI coding CLIs
# Usage: ./configure-yolo-modes.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[CONFIGURE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Kimi ---
configure_kimi() {
    local config="$HOME/.kimi/config.toml"
    if [[ ! -f "$config" ]]; then
        warn "Kimi config not found at $config"
        return
    fi
    if grep -q "^default_yolo" "$config"; then
        log "Kimi: YOLO already configured"
    else
        if $DRY_RUN; then
            log "Kimi: Would add 'default_yolo = true' to $config"
        else
            sed -i '' '/^default_thinking/a\
default_yolo = true
' "$config"
            log "Kimi: Added default_yolo = true"
        fi
    fi
}

# --- Codex ---
configure_codex() {
    local config="$HOME/.codex/config.toml"
    if [[ ! -f "$config" ]]; then
        warn "Codex config not found at $config"
        return
    fi
    if grep -q '^approval_policy = "never"' "$config" && grep -q '^sandbox_mode = "danger-full-access"' "$config"; then
        log "Codex: YOLO already configured (approval_policy=never, sandbox_mode=danger-full-access)"
    else
        if $DRY_RUN; then
            log "Codex: Would set approval_policy=never and sandbox_mode=danger-full-access"
        else
            sed -i '' 's/^approval_policy = .*/approval_policy = "never"/' "$config"
            sed -i '' 's/^sandbox_mode = .*/sandbox_mode = "danger-full-access"/' "$config"
            log "Codex: Configured YOLO mode"
        fi
    fi
}

# --- Vibe ---
configure_vibe() {
    local config="$HOME/.vibe/config.toml"
    if [[ ! -f "$config" ]]; then
        warn "Vibe config not found at $config"
        return
    fi
    if grep -q '^default_agent = "auto-approve"' "$config"; then
        log "Vibe: auto-approve already configured"
    else
        if $DRY_RUN; then
            log "Vibe: Would add 'default_agent = \"auto-approve\"' to $config"
        else
            sed -i '' '/^active_model/a\
default_agent = "auto-approve"
' "$config"
            log "Vibe: Added default_agent = auto-approve"
        fi
    fi
}

# --- Abacus ---
configure_abacus() {
    local shellrc="$HOME/.zshrc"
    [[ ! -f "$shellrc" ]] && shellrc="$HOME/.bashrc"
    if [[ ! -f "$shellrc" ]]; then
        warn "No .zshrc or .bashrc found for Abacus aliases"
        return
    fi
    if grep -q "abacusai --permission-mode yolo" "$shellrc"; then
        log "Abacus: YOLO alias already configured"
    else
        if $DRY_RUN; then
            log "Abacus: Would add aliases to $shellrc"
        else
            echo '' >> "$shellrc"
            echo '# Abacus AI CLI - YOLO mode' >> "$shellrc"
            echo "alias abacus='abacusai --permission-mode yolo'" >> "$shellrc"
            echo "alias abacusai='abacusai --permission-mode yolo'" >> "$shellrc"
            log "Abacus: Added YOLO aliases"
        fi
    fi
}

# --- OpenCode ---
configure_opencode() {
    local config="$HOME/.config/opencode/opencode.json"
    if [[ ! -f "$config" ]]; then
        warn "OpenCode config not found at $config"
        return
    fi
    if grep -q '"permission"' "$config"; then
        log "OpenCode: permission already configured"
    else
        if $DRY_RUN; then
            log "OpenCode: Would add '\"permission\": \"allow\"' to $config"
        else
            sed -i '' 's/"\$schema"/"permission": "allow",\n  "\$schema"/' "$config"
            log "OpenCode: Added permission: allow"
        fi
    fi
}

# --- Main ---
echo "AI CLI YOLO Mode Configurator"
echo "=============================="

if $DRY_RUN; then
    warn "DRY RUN - no changes will be made"
    echo ""
fi

configure_kimi
configure_codex
configure_vibe
configure_abacus
configure_opencode

echo ""
log "Configuration complete!"
echo ""
echo "Verify with:"
echo "  Kimi:     grep default_yolo ~/.kimi/config.toml"
echo "  Codex:    grep approval_policy ~/.codex/config.toml"
echo "  Vibe:     grep default_agent ~/.vibe/config.toml"
echo "  Abacus:   grep abacus ~/.zshrc"
echo "  OpenCode: grep permission ~/.config/opencode/opencode.json"
