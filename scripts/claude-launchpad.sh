#!/bin/bash
# =============================================================================
# Claude Launchpad - Quick-access command center
# Usage: launchpad  or  lp
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

WORKSPACE="${CLAUDE_WORKSPACE:-$HOME/claude-workspace}"

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
show_header() {
  clear
  echo -e "${CYAN}${BOLD}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║         CLAUDE  LAUNCHPAD                ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  ${DIM}Workspace: $WORKSPACE${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------
show_menu() {
  echo -e "  ${BOLD}Quick Actions${NC}"
  echo -e "  ${GREEN}1${NC}  Start Claude in current directory"
  echo -e "  ${GREEN}2${NC}  Start Claude in workspace"
  echo -e "  ${GREEN}3${NC}  Resume last Claude session"
  echo ""
  echo -e "  ${BOLD}Projects${NC}"
  echo -e "  ${GREEN}4${NC}  Open a project (pick from workspace)"
  echo -e "  ${GREEN}5${NC}  Clone a repo and start Claude"
  echo ""
  echo -e "  ${BOLD}Remote Tasks${NC}"
  echo -e "  ${GREEN}6${NC}  Check for remote tasks (GitHub Issues)"
  echo -e "  ${GREEN}7${NC}  Create a new remote task"
  echo -e "  ${GREEN}8${NC}  Run next pending task"
  echo ""
  echo -e "  ${BOLD}Tools${NC}"
  echo -e "  ${GREEN}9${NC}  Install a component (agent/command/hook)"
  echo -e "  ${GREEN}10${NC} Run Claude with a prompt from clipboard"
  echo -e "  ${GREEN}11${NC} Open Claude settings"
  echo ""
  echo -e "  ${DIM}q  Quit${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

start_here() {
  echo -e "${CYAN}Starting Claude in $(pwd)...${NC}"
  exec claude
}

start_workspace() {
  cd "$WORKSPACE"
  echo -e "${CYAN}Starting Claude in $WORKSPACE...${NC}"
  exec claude
}

resume_session() {
  echo -e "${CYAN}Resuming last Claude session...${NC}"
  exec claude --resume
}

pick_project() {
  echo -e "${BOLD}Projects in $WORKSPACE:${NC}"
  echo ""

  local dirs=()
  local i=1
  for d in "$WORKSPACE"/*/; do
    if [[ -d "$d" ]]; then
      local name
      name=$(basename "$d")
      dirs+=("$d")
      local marker=""
      if [[ -d "$d/.git" ]]; then
        local branch
        branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "?")
        marker="${DIM}(git: $branch)${NC}"
      fi
      echo -e "  ${GREEN}$i${NC}  $name $marker"
      ((i++))
    fi
  done

  if [[ ${#dirs[@]} -eq 0 ]]; then
    echo -e "  ${YELLOW}No projects found. Clone one first (option 5).${NC}"
    echo ""
    read -rp "  Press Enter to continue..." _
    return
  fi

  echo ""
  read -rp "  Select project number: " choice
  if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#dirs[@]} )); then
    local target="${dirs[$((choice-1))]}"
    cd "$target"
    echo -e "${CYAN}Starting Claude in $target...${NC}"
    exec claude
  else
    echo -e "${YELLOW}Invalid selection.${NC}"
    sleep 1
  fi
}

clone_and_start() {
  echo ""
  read -rp "  Repo URL (or owner/repo): " repo_url
  if [[ -z "$repo_url" ]]; then
    return
  fi

  # Support shorthand owner/repo
  if [[ ! "$repo_url" =~ ^https?:// ]] && [[ ! "$repo_url" =~ ^git@ ]]; then
    repo_url="https://github.com/$repo_url.git"
  fi

  local repo_name
  repo_name=$(basename "$repo_url" .git)
  local target="$WORKSPACE/$repo_name"

  if [[ -d "$target" ]]; then
    echo -e "${YELLOW}$target already exists. Opening it.${NC}"
  else
    echo -e "${CYAN}Cloning into $target...${NC}"
    git clone "$repo_url" "$target"
  fi

  cd "$target"
  echo -e "${CYAN}Starting Claude in $target...${NC}"
  exec claude
}

check_remote_tasks() {
  local tasks_script="${HOME}/.claude-launchpad/remote-tasks.sh"
  if [[ -f "$tasks_script" ]]; then
    bash "$tasks_script" list
  else
    echo -e "${YELLOW}Remote tasks script not installed.${NC}"
    echo -e "Run the mac-setup.sh script to install it."
    sleep 2
  fi
  echo ""
  read -rp "  Press Enter to continue..." _
}

create_remote_task() {
  local tasks_script="${HOME}/.claude-launchpad/remote-tasks.sh"
  if [[ -f "$tasks_script" ]]; then
    bash "$tasks_script" create
  else
    echo -e "${YELLOW}Remote tasks script not installed.${NC}"
    sleep 2
  fi
  echo ""
  read -rp "  Press Enter to continue..." _
}

run_next_task() {
  local tasks_script="${HOME}/.claude-launchpad/remote-tasks.sh"
  if [[ -f "$tasks_script" ]]; then
    bash "$tasks_script" run-next
  else
    echo -e "${YELLOW}Remote tasks script not installed.${NC}"
    sleep 2
  fi
}

install_component() {
  echo ""
  echo -e "  ${BOLD}Install a component:${NC}"
  echo -e "  ${DIM}Examples:${NC}"
  echo -e "    agent frontend-developer"
  echo -e "    command setup-testing"
  echo -e "    hook automation/simple-notifications"
  echo ""
  read -rp "  Type and name (e.g. 'agent security-auditor'): " type_and_name
  if [[ -z "$type_and_name" ]]; then
    return
  fi
  local comp_type comp_name
  comp_type=$(echo "$type_and_name" | awk '{print $1}')
  comp_name=$(echo "$type_and_name" | awk '{print $2}')
  echo -e "${CYAN}Installing $comp_type: $comp_name...${NC}"
  npx claude-code-templates@latest "--${comp_type}" "$comp_name"
  echo ""
  read -rp "  Press Enter to continue..." _
}

run_from_clipboard() {
  local prompt
  prompt=$(pbpaste 2>/dev/null || xclip -selection clipboard -o 2>/dev/null || echo "")
  if [[ -z "$prompt" ]]; then
    echo -e "${YELLOW}Clipboard is empty.${NC}"
    sleep 1
    return
  fi
  echo -e "${CYAN}Running Claude with prompt from clipboard:${NC}"
  echo -e "${DIM}${prompt:0:200}...${NC}"
  echo ""
  exec claude -p "$prompt"
}

open_settings() {
  local settings_dir="$HOME/.claude"
  echo -e "${CYAN}Opening Claude settings directory...${NC}"
  if command -v code &>/dev/null; then
    code "$settings_dir"
  elif command -v open &>/dev/null; then
    open "$settings_dir"
  else
    echo "Settings at: $settings_dir"
    ls -la "$settings_dir"
  fi
  echo ""
  read -rp "  Press Enter to continue..." _
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
main() {
  while true; do
    show_header
    show_menu
    read -rp "  Choose an option: " choice
    case "$choice" in
      1)  start_here ;;
      2)  start_workspace ;;
      3)  resume_session ;;
      4)  pick_project ;;
      5)  clone_and_start ;;
      6)  check_remote_tasks ;;
      7)  create_remote_task ;;
      8)  run_next_task ;;
      9)  install_component ;;
      10) run_from_clipboard ;;
      11) open_settings ;;
      q|Q) echo -e "${DIM}Bye.${NC}"; exit 0 ;;
      *)  echo -e "${YELLOW}Invalid option.${NC}"; sleep 0.5 ;;
    esac
  done
}

main "$@"
