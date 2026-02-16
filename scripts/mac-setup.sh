#!/bin/bash
# =============================================================================
# Claude Mac Setup Script
# One-command setup for a new Mac with Claude Code + Launchpad + Remote Tasks
# Usage: curl -fsSL <raw-url> | bash
#   or:  bash scripts/mac-setup.sh
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; exit 1; }
step()  { echo -e "\n${BOLD}--- $* ---${NC}"; }

# ---------------------------------------------------------------------------
# 1. Homebrew
# ---------------------------------------------------------------------------
step "Checking Homebrew"
if command -v brew &>/dev/null; then
  ok "Homebrew already installed"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  fi
  ok "Homebrew installed"
fi

# ---------------------------------------------------------------------------
# 2. Core dependencies
# ---------------------------------------------------------------------------
step "Installing core tools"

deps=(git node jq gh)
for dep in "${deps[@]}"; do
  if command -v "$dep" &>/dev/null; then
    ok "$dep already installed"
  else
    info "Installing $dep..."
    case "$dep" in
      node) brew install node ;;
      gh)   brew install gh ;;
      *)    brew install "$dep" ;;
    esac
    ok "$dep installed"
  fi
done

# ---------------------------------------------------------------------------
# 3. Claude Code CLI
# ---------------------------------------------------------------------------
step "Installing Claude Code"

if command -v claude &>/dev/null; then
  ok "Claude Code CLI already installed ($(claude --version 2>/dev/null || echo 'unknown version'))"
else
  info "Installing Claude Code via npm..."
  npm install -g @anthropic-ai/claude-code
  ok "Claude Code CLI installed"
fi

# ---------------------------------------------------------------------------
# 4. GitHub CLI auth check
# ---------------------------------------------------------------------------
step "Checking GitHub authentication"

if gh auth status &>/dev/null 2>&1; then
  ok "GitHub CLI authenticated"
else
  warn "GitHub CLI not authenticated. Run: gh auth login"
  info "This is needed for the remote task system."
fi

# ---------------------------------------------------------------------------
# 5. Install Launchpad
# ---------------------------------------------------------------------------
step "Installing Claude Launchpad"

LAUNCHPAD_DIR="$HOME/.claude-launchpad"
mkdir -p "$LAUNCHPAD_DIR"

# Copy launchpad script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/claude-launchpad.sh" ]]; then
  cp "$SCRIPT_DIR/claude-launchpad.sh" "$LAUNCHPAD_DIR/launchpad.sh"
  chmod +x "$LAUNCHPAD_DIR/launchpad.sh"
else
  warn "Launchpad script not found at $SCRIPT_DIR/claude-launchpad.sh"
  info "You can install it later from the repo."
fi

# Copy remote task runner
if [[ -f "$SCRIPT_DIR/claude-remote-tasks.sh" ]]; then
  cp "$SCRIPT_DIR/claude-remote-tasks.sh" "$LAUNCHPAD_DIR/remote-tasks.sh"
  chmod +x "$LAUNCHPAD_DIR/remote-tasks.sh"
fi

# Add shell aliases
SHELL_RC="$HOME/.zshrc"
if [[ ! -f "$SHELL_RC" ]]; then
  SHELL_RC="$HOME/.bashrc"
fi

if ! grep -q "claude-launchpad" "$SHELL_RC" 2>/dev/null; then
  cat >> "$SHELL_RC" << 'ALIASES'

# --- Claude Launchpad ---
alias launchpad='~/.claude-launchpad/launchpad.sh'
alias lp='~/.claude-launchpad/launchpad.sh'
alias claude-tasks='~/.claude-launchpad/remote-tasks.sh'
alias ct='~/.claude-launchpad/remote-tasks.sh'
ALIASES
  ok "Shell aliases added to $SHELL_RC"
else
  ok "Shell aliases already configured"
fi

# ---------------------------------------------------------------------------
# 6. Create default workspace
# ---------------------------------------------------------------------------
step "Setting up workspace"

WORKSPACE="$HOME/claude-workspace"
mkdir -p "$WORKSPACE"
ok "Workspace ready at $WORKSPACE"

# ---------------------------------------------------------------------------
# 7. Create global CLAUDE.md
# ---------------------------------------------------------------------------
step "Configuring Claude defaults"

GLOBAL_CLAUDE="$HOME/.claude/CLAUDE.md"
mkdir -p "$HOME/.claude"

if [[ ! -f "$GLOBAL_CLAUDE" ]]; then
  cat > "$GLOBAL_CLAUDE" << 'CLAUDEMD'
# Global Claude Configuration

## Preferences
- Keep responses concise and actionable
- Prefer simple solutions over complex ones
- Always run tests after making changes
- Use conventional commits (feat:, fix:, chore:, etc.)

## Common Workflows
- When fixing bugs: read the code first, write a failing test, then fix
- When adding features: plan with todos, implement incrementally, test each step
- When refactoring: ensure tests pass before and after

## Project Locations
- Main workspace: ~/claude-workspace
- Launchpad: ~/.claude-launchpad
CLAUDEMD
  ok "Global CLAUDE.md created at $GLOBAL_CLAUDE"
else
  ok "Global CLAUDE.md already exists"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  Quick commands:"
echo "    lp             Open the Claude Launchpad"
echo "    launchpad       Same as above"
echo "    ct             Check/run remote Claude tasks"
echo "    claude-tasks    Same as above"
echo "    claude          Start Claude Code in current directory"
echo ""
echo "  To apply aliases now, run:"
echo "    source $SHELL_RC"
echo ""
