#!/usr/bin/env bash
# run-review-cycle.sh
# Manual trigger for a component review cycle.
#
# Usage:
#   ./scripts/run-review-cycle.sh                         # full cycle, auto-select component
#   ./scripts/run-review-cycle.sh --component PATH        # full cycle, specific component
#   ./scripts/run-review-cycle.sh --test-hook             # test hook logging only (fast, ~10s)
#   ./scripts/run-review-cycle.sh --check                 # check current state (no changes)
#
# Modes:
#   --test-hook   Creates a real cycle, writes marker, fires mock tool events through
#                 the hook, then reads back from the API to confirm tools were logged.
#                 This is the fastest way to verify the fix works.
#
#   --check       Just shows current cycles + control state from the API.
#
#   (default)     Full cycle: creates cycle, writes marker, runs Claude with the
#                 component-review skill, monitors until done.

set -euo pipefail

# ── constants ──────────────────────────────────────────────────────────────────
API_BASE="https://www.aitmpl.com/api/live-task"
MARKER="/tmp/.claude-review-active"
REPO="/Users/danipower/Proyectos/Github/claude-code-templates"
HOOK_GLOBAL="/Users/danipower/.claude/hooks/live-task-tool-logger.sh"
HOOK_PROJECT="$REPO/.claude/hooks/log-review-tools.sh"
SKILL_PATH="/Users/danipower/.claude/scheduled-tasks/component-review/SKILL.md"

# ── colors ─────────────────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'
ok()   { echo -e "${G}✓${N} $*"; }
info() { echo -e "${B}→${N} $*"; }
warn() { echo -e "${Y}⚠${N} $*"; }
err()  { echo -e "${R}✗${N} $*" >&2; }
head() { echo -e "\n${C}── $* ──${N}"; }

# ── argument parsing ───────────────────────────────────────────────────────────
MODE="full"
COMPONENT_PATH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --test-hook)   MODE="test-hook"; shift ;;
    --check)       MODE="check";     shift ;;
    --component)   COMPONENT_PATH="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,20p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *)
      err "Unknown arg: $1 (use --help)"; exit 1 ;;
  esac
done

# ── prereqs ────────────────────────────────────────────────────────────────────
for cmd in curl jq; do
  command -v "$cmd" >/dev/null || { err "Missing: $cmd"; exit 1; }
done

cleanup() {
  rm -f "$MARKER"
}
trap cleanup EXIT

# ══════════════════════════════════════════════════════════════════════════════
# MODE: --check
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "check" ]]; then
  head "Control state"
  curl -s "$API_BASE/control" | jq .

  head "Last 10 cycles"
  curl -s "$API_BASE/cycles?limit=10" | jq -r '
    .cycles[] |
    "\(.id)  \(.status)\t\(.phase)\t\(.component_path | split("/")[-1])\t\(.started_at[:16])"
  ' | column -t

  if [[ -f "$MARKER" ]]; then
    head "Active marker file"
    cat "$MARKER"
  fi
  exit 0
fi

# ── shared helpers ─────────────────────────────────────────────────────────────

check_paused() {
  local data
  data=$(curl -s "$API_BASE/control")
  if echo "$data" | jq -e '.control.is_paused == true' >/dev/null 2>&1; then
    warn "Review loop is PAUSED. Resume from the dashboard before running."
    exit 1
  fi
  ok "Loop is running (not paused)"
}

auto_select_component() {
  # Pick a component that hasn't been reviewed recently
  local recent
  recent=$(curl -s "$API_BASE/cycles?limit=20" | jq -r '[.cycles[].component_path] | @json')

  local chosen=""
  while IFS= read -r -d '' path; do
    rel="${path#$REPO/}"
    if ! echo "$recent" | jq -e --arg p "$rel" '. | index($p) != null' >/dev/null 2>&1; then
      chosen="$rel"
      break
    fi
  done < <(find "$REPO/cli-tool/components/agents" -name "*.md" -print0 | sort -z)

  if [[ -z "$chosen" ]]; then
    # Fallback: pick first agent
    chosen=$(find "$REPO/cli-tool/components/agents" -name "*.md" | head -1)
    chosen="${chosen#$REPO/}"
  fi

  echo "$chosen"
}

create_cycle() {
  local component="$1" session_id="$2"
  local type
  type=$(echo "$component" | awk -F/ '{print $3}')  # agents / commands / mcps …

  local resp
  resp=$(curl -s -X POST "$API_BASE/cycles" \
    -H 'Content-Type: application/json' \
    -d "{\"session_id\":\"$session_id\",\"component_path\":\"$component\",\"component_type\":\"$type\"}")

  if echo "$resp" | jq -e '.error' >/dev/null 2>&1; then
    err "create_cycle failed: $(echo "$resp" | jq -r '.error')"
    exit 1
  fi

  echo "$resp" | jq -r '.cycle.id'
}

write_marker() {
  local session_id="$1" cycle_id="$2" phase="$3"
  printf 'session_id=%s\ncycle_id=%s\nphase=%s\n' "$session_id" "$cycle_id" "$phase" > "$MARKER"
}

update_cycle() {
  local cycle_id="$1"; shift
  curl -s -X PATCH "$API_BASE/cycles" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":$cycle_id,$*}" >/dev/null
}

count_tools() {
  local cycle_id="$1"
  curl -s "$API_BASE/tools?cycle_id=$cycle_id" | jq '.tools | length'
}

# ══════════════════════════════════════════════════════════════════════════════
# MODE: --test-hook
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "test-hook" ]]; then
  head "Pre-flight"
  check_paused

  if [[ ! -x "$HOOK_GLOBAL" ]]; then
    err "Global hook not found or not executable: $HOOK_GLOBAL"
    exit 1
  fi
  ok "Global hook exists"

  head "Creating test cycle"
  SESSION_ID="test-hook-$(date +%Y%m%d-%H%M%S)"
  COMPONENT_PATH="${COMPONENT_PATH:-cli-tool/components/agents/development-tools/debugger.md}"
  CYCLE_ID=$(create_cycle "$COMPONENT_PATH" "$SESSION_ID")
  ok "Cycle created: id=$CYCLE_ID  component=$(basename $COMPONENT_PATH)"

  head "Writing marker (key=value format)"
  write_marker "$SESSION_ID" "$CYCLE_ID" "test"
  cat "$MARKER"
  ok "Marker written to $MARKER"

  head "Firing mock tool events through global hook"
  TOOL_NAMES=("Read" "Bash" "Grep" "WebFetch" "Edit")
  FIRED=0
  for tool in "${TOOL_NAMES[@]}"; do
    mock_input=$(jq -nc \
      --arg tool "$tool" \
      --arg sid "any-session-value" \
      '{tool_name: $tool, session_id: $sid, tool_input: {file_path: "/tmp/test.md"}, tool_response: "ok"}')

    echo "$mock_input" | bash "$HOOK_GLOBAL"
    sleep 0.3
    FIRED=$((FIRED + 1))
    echo -e "  ${G}·${N} $tool fired"
  done

  head "Waiting for async POSTs to land (2s)"
  sleep 2

  head "Verifying tool executions in API"
  TOOL_COUNT=$(count_tools "$CYCLE_ID")
  if [[ "$TOOL_COUNT" -ge "$FIRED" ]]; then
    ok "$TOOL_COUNT tool(s) logged for cycle $CYCLE_ID — hook is working correctly!"
  elif [[ "$TOOL_COUNT" -gt 0 ]]; then
    warn "$TOOL_COUNT / $FIRED tools logged (some may still be in-flight)"
  else
    err "0 tools logged — hook is NOT working. Check $HOOK_GLOBAL"
    echo ""
    echo "Debug: try running the hook manually:"
    echo "  echo '{\"tool_name\":\"Read\",\"session_id\":\"x\",\"tool_input\":{},\"tool_response\":\"ok\"}' | bash $HOOK_GLOBAL"
  fi

  # Show the logged tools
  if [[ "$TOOL_COUNT" -gt 0 ]]; then
    curl -s "$API_BASE/tools?cycle_id=$CYCLE_ID" | jq -r '
      .tools[] | "  [\(.result_status)] \(.tool_name)  \(.tool_args_summary // "")"
    '
  fi

  head "Cleaning up test cycle"
  update_cycle "$CYCLE_ID" '"status":"failed","error_message":"test-hook run — auto-cleaned"'
  rm -f "$MARKER"
  ok "Cycle $CYCLE_ID marked failed + marker removed"

  echo ""
  echo -e "${G}Test complete.${N} Check https://www.aitmpl.com/live-task (filter: All) to see the test cycle."
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# MODE: full cycle
# ══════════════════════════════════════════════════════════════════════════════
head "Pre-flight"
check_paused

# Check for already-active cycles
ACTIVE=$(curl -s "$API_BASE/cycles?status=active&limit=1" | jq '.cycles | length')
if [[ "$ACTIVE" -gt 0 ]]; then
  warn "An active cycle already exists. Use --check to inspect it."
  echo -n "Continue anyway? [y/N] "
  read -r ans
  [[ "${ans,,}" == "y" ]] || exit 0
fi

head "Component selection"
if [[ -z "$COMPONENT_PATH" ]]; then
  COMPONENT_PATH=$(auto_select_component)
  info "Auto-selected: $COMPONENT_PATH"
else
  info "Using: $COMPONENT_PATH"
fi

if [[ ! -f "$REPO/$COMPONENT_PATH" ]]; then
  err "Component file not found: $REPO/$COMPONENT_PATH"
  exit 1
fi
ok "Component file exists"

head "Creating cycle"
SESSION_ID="review-$(date +%Y%m%d-%H%M%S)"
CYCLE_ID=$(create_cycle "$COMPONENT_PATH" "$SESSION_ID")
ok "Cycle created: id=$CYCLE_ID  session=$SESSION_ID"

head "Writing marker"
write_marker "$SESSION_ID" "$CYCLE_ID" "research"
ok "Marker written: $(cat $MARKER | tr '\n' ' ')"

head "Updating phase → research"
update_cycle "$CYCLE_ID" '"phase":"research"'
ok "Phase set"

echo ""
echo -e "${C}═══════════════════════════════════════════════════════${N}"
echo -e "${C}  Cycle $CYCLE_ID ready. Starting Claude review...${N}"
echo -e "${C}  Dashboard: https://www.aitmpl.com/live-task${N}"
echo -e "${C}═══════════════════════════════════════════════════════${N}"
echo ""

# Read the skill prompt
SKILL_PROMPT=$(cat "$SKILL_PATH")

# Inject the selected component so Claude doesn't have to auto-select
INJECTED_PROMPT="$(cat <<EOF
You are the Component Review Loop orchestrator. A cycle has already been created for you:

- cycle_id: $CYCLE_ID
- session_id: $SESSION_ID
- component_path: $COMPONENT_PATH
- component_type: $(echo "$COMPONENT_PATH" | awk -F/ '{print $3}')
- marker file already written at /tmp/.claude-review-active

**Skip steps 1–6** (pause check, stuck cycle check, component selection, session id, cycle creation, marker write — all done).

**Start from step 7** (set phase to research) and continue through to completion.

Follow the SKILL instructions below:

---

$SKILL_PROMPT
EOF
)"

# Run Claude non-interactively with the skill prompt
claude \
  --dangerously-skip-permissions \
  --print \
  --add-dir "$REPO" \
  --output-format text \
  -p "$INJECTED_PROMPT" 2>&1

EXIT_CODE=$?

echo ""
head "Post-run check"
TOOL_COUNT=$(count_tools "$CYCLE_ID")
ok "$TOOL_COUNT tool(s) logged for cycle $CYCLE_ID"

FINAL_STATUS=$(curl -s "$API_BASE/cycles?limit=20" | jq -r --argjson id "$CYCLE_ID" '.cycles[] | select(.id == ($id | tostring) or .id == $id) | .status')
info "Cycle status: ${FINAL_STATUS:-unknown}"

echo ""
echo "Full details: https://www.aitmpl.com/live-task"

exit $EXIT_CODE
