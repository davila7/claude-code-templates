#!/usr/bin/env bash
# install.sh — Install Claude Code Templates to ~/.claude/
#
# Usage:
#   bash install.sh              Interactive mode — choose what to install
#   bash install.sh --all        Install all components
#   bash install.sh --sdd        Install SDD workflow only
#   bash install.sh --list       List all available component categories
#   bash install.sh --agents     Install all agents
#   bash install.sh --commands   Install all commands
#   bash install.sh --hooks      Install hooks
#   bash install.sh --force      Overwrite existing files

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || cd "$(dirname "$0")" && pwd)"
COMPONENTS="$REPO_ROOT/cli-tool/components"
DEST="$HOME/.claude"
FORCE=false
MODE=""

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }

# ── Argument parsing ─────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --all)      MODE="all" ;;
    --sdd)      MODE="sdd" ;;
    --agents)   MODE="agents" ;;
    --commands) MODE="commands" ;;
    --hooks)    MODE="hooks" ;;
    --force)    FORCE=true ;;
    --list)     MODE="list" ;;
    --help|-h)
      grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
copy_dir() {
  local src="$1" dst="$2"
  if [ ! -d "$src" ]; then
    warn "Source not found: $src"
    return
  fi
  mkdir -p "$dst"
  if $FORCE; then
    cp -rf "$src/." "$dst/"
  else
    # Copy only files that don't already exist at destination
    rsync -a --ignore-existing "$src/" "$dst/" 2>/dev/null || \
      find "$src" -type f | while read -r f; do
        rel="${f#$src/}"
        dst_file="$dst/$rel"
        if [ ! -f "$dst_file" ]; then
          mkdir -p "$(dirname "$dst_file")"
          cp "$f" "$dst_file"
        fi
      done
  fi
  success "$(basename "$src") → $dst"
}

# ── List mode ─────────────────────────────────────────────────────────────────
list_components() {
  echo ""
  echo -e "${CYAN}━━━ Claude Code Templates — Available Components ━━━${RESET}"
  echo ""
  echo -e "${BLUE}AGENTS${RESET} (install with --agents)"
  ls "$COMPONENTS/agents/" | sed 's/^/  /'
  echo ""
  echo -e "${BLUE}COMMANDS${RESET} (install with --commands)"
  ls "$COMPONENTS/commands/" | sed 's/^/  /'
  echo ""
  echo -e "${BLUE}HOOKS${RESET} (install with --hooks)"
  ls "$COMPONENTS/hooks/" 2>/dev/null | grep -v HOOK_PATTERNS | sed 's/^/  /' || true
  echo ""
  echo -e "${BLUE}SKILLS${RESET}"
  ls "$COMPONENTS/skills/" | sed 's/^/  /'
  echo ""
  echo -e "${BLUE}SETTINGS${RESET}"
  ls "$COMPONENTS/settings/" | sed 's/^/  /'
  echo ""
}

# ── Install SDD only ──────────────────────────────────────────────────────────
install_sdd() {
  info "Installing SDD workflow..."
  copy_dir "$COMPONENTS/commands/sdd"           "$DEST/commands/sdd"
  copy_dir "$COMPONENTS/agents/workflow-methodology" "$DEST/agents/workflow-methodology"
  copy_dir "$COMPONENTS/agents/development-team"    "$DEST/agents/development-team"
  copy_dir "$COMPONENTS/skills/sdd"            "$DEST/skills/sdd"
  success "SDD workflow installed."
  echo ""
  echo "  Start with: /sdd-init"
}

# ── Install all agents ────────────────────────────────────────────────────────
install_agents() {
  info "Installing all agents..."
  copy_dir "$COMPONENTS/agents" "$DEST/agents"
}

# ── Install all commands ──────────────────────────────────────────────────────
install_commands() {
  info "Installing all commands..."
  copy_dir "$COMPONENTS/commands" "$DEST/commands"
}

# ── Install hooks ─────────────────────────────────────────────────────────────
install_hooks() {
  info "Installing hooks..."
  copy_dir "$COMPONENTS/hooks" "$DEST/hooks"
}

# ── Install everything ────────────────────────────────────────────────────────
install_all() {
  info "Installing all components to $DEST ..."
  install_agents
  install_commands
  install_hooks
  copy_dir "$COMPONENTS/skills"   "$DEST/skills"
  copy_dir "$COMPONENTS/settings" "$DEST/settings"
  success "All components installed."
}

# ── Interactive mode ──────────────────────────────────────────────────────────
interactive() {
  echo ""
  echo -e "${CYAN}━━━ Claude Code Templates Installer ━━━${RESET}"
  echo ""
  echo "What do you want to install?"
  echo "  1) SDD workflow only (recommended first install)"
  echo "  2) All agents"
  echo "  3) All commands"
  echo "  4) Hooks"
  echo "  5) Everything"
  echo "  6) List available components"
  echo "  q) Quit"
  echo ""
  read -rp "Choice [1-6/q]: " choice

  case "$choice" in
    1) install_sdd ;;
    2) install_agents ;;
    3) install_commands ;;
    4) install_hooks ;;
    5) install_all ;;
    6) list_components ;;
    q|Q) echo "Aborted."; exit 0 ;;
    *) warn "Unknown choice: $choice"; exit 1 ;;
  esac
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Claude Code Templates${RESET} — installing to $DEST"
$FORCE && warn "Force mode: existing files will be overwritten."
echo ""

mkdir -p "$DEST"

case "$MODE" in
  list)     list_components ;;
  sdd)      install_sdd ;;
  agents)   install_agents ;;
  commands) install_commands ;;
  hooks)    install_hooks ;;
  all)      install_all ;;
  "")       interactive ;;
esac

echo ""
info "Done. Restart Claude Code to pick up new commands/agents."
