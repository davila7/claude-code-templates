#!/usr/bin/env bash
# rex-claude: launch and drive Claude Code sessions in Rex panes.
# Usage: rex-claude.sh <command> [args]   (see SKILL.md or run with "help")
set -euo pipefail

REX="${REX_BIN_DIR:+$REX_BIN_DIR/}rex"
STATE_DIR="${TMPDIR:-/tmp}/rex-claude"
# Fallback for versions that don't report program status: the prompt footer.
READY_RE='for shortcuts|mode on|accept edits on|bypass permissions on|⏵⏵|⏸'
TRUST_RE='Yes, I trust this folder'

die() { printf 'rex-claude: %s\n' "$*" >&2; exit 2; }
note() { printf 'rex-claude: %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
rex-claude.sh launch [-d DIR] [-l LABEL] [--split right|left|above|below] [--ratio PCT]
                     [--tab NAME] [-b ANCHOR] [--trust] [--focus] [--timeout SECS] [-- CLAUDE_ARGS...]
    Open a pane (or a tab with --tab) running claude in DIR and wait until it
    is ready for a prompt. Prints the new block ID on stdout. --trust answers
    the workspace trust dialog with "Yes"; without it, launch stops at the
    dialog and exits 3.
rex-claude.sh send BLOCK TEXT...      Type a prompt (newlines become spaces) and press Return.
rex-claude.sh send BLOCK -f FILE      Same, reading the prompt from FILE.
rex-claude.sh wait BLOCK [--timeout SECS]
    Wait until the session finishes the turn started by the last send/keys.
    Prints the state. Exit: 0 done/idle, 10 blocked (needs the user),
    11 error, 12 claude exited, 124 timeout.
rex-claude.sh status BLOCK            One-line JSON: state, kind, msg, title, alive, cwd.
rex-claude.sh screen BLOCK [LINES]    The visible screen, last LINES lines (default 60).
rex-claude.sh keys BLOCK KEY...       Press keys (e.g. enter, down, escape, ctrl+c).
rex-claude.sh ls                      Claude Code panes in this Rex session.
rex-claude.sh close BLOCK             Close the pane (ends its claude).
EOF
}

command -v jq >/dev/null 2>&1 || die "jq is required"
[ -n "${REX_SESSION:-}" ] || die "REX_SESSION is not set; run inside a Rex terminal (check with: rex whoami --json)"

state_file() { printf '%s/%s' "$STATE_DIR" "$(printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '_')"; }

guard() {
  [ -n "${1:-}" ] || die "missing BLOCK"
  [ "$1" != "${REX_BLOCK:-}" ] || die "refusing to target your own pane ($1)"
}

screen_text() { "$REX" capture -s "$REX_SESSION" -b "$1" --trim --unwrap 2>/dev/null || true; }

# The Claude Code record from the Program Status Protocol (OSC 7501), or {}.
record() {
  { "$REX" block call -s "$REX_SESSION" -b "$1" program_status 2>/dev/null || echo '{}'; } |
    jq -c '[.records[]? | select((.effective_app // .app) == "claude-code")] | last // {}'
}

process_json() { "$REX" block call -s "$REX_SESSION" -b "$1" process 2>/dev/null || echo '{}'; }

exited() {
  process_json "$1" | jq -e '(.last_exit != null) or (.child == null)' >/dev/null
}

# Remember the record's current timestamp, so wait ignores reports from before this point.
mark() {
  mkdir -p "$STATE_DIR"
  record "$1" | jq -r '.updated_at // ""' >"$(state_file "$1")"
}

cmd_launch() {
  local dir="$PWD" label="claude" split="right" ratio=50 tab="" anchor="${REX_BLOCK:-}"
  local trust=0 focus=false timeout=90
  while [ $# -gt 0 ]; do
    case "$1" in
      -d|--dir) dir="$2"; shift 2 ;;
      -l|--label) label="$2"; shift 2 ;;
      --split) split="$2"; shift 2 ;;
      --ratio) ratio="$2"; shift 2 ;;
      --tab) tab="$2"; shift 2 ;;
      -b|--anchor) anchor="$2"; shift 2 ;;
      --trust) trust=1; shift ;;
      --focus) focus=true; shift ;;
      --timeout) timeout="$2"; shift 2 ;;
      --) shift; break ;;
      *) die "launch: unknown option $1" ;;
    esac
  done
  [ -d "$dir" ] || die "launch: no such directory: $dir"
  dir=$(cd "$dir" && pwd -P)

  local out block
  if [ -n "$tab" ]; then
    out=$("$REX" window new -s "$REX_SESSION" "$tab" -c "$dir" --keep-open --focus="$focus" --json -- claude "$@")
  else
    out=$("$REX" split -s "$REX_SESSION" ${anchor:+-b "$anchor"} --split="$split" --ratio "$ratio" \
      -c "$dir" --label "$label" --keep-open --focus="$focus" --json -- claude "$@")
  fi
  block=$(printf '%s' "$out" | jq -er '.block_ids[0]') || die "launch: rex returned no block: $out"
  note "launched $block in $dir"

  local start=$SECONDS answered=0 text
  while :; do
    text=$(screen_text "$block")
    if printf '%s' "$text" | grep -q "$TRUST_RE"; then
      if [ "$trust" -eq 0 ]; then
        note "$block is waiting at the workspace trust dialog; answer it, or relaunch with --trust"
        printf '%s\n' "$block"
        exit 3
      fi
      if [ "$answered" -eq 0 ]; then
        # The dialog's default is "No, exit": move to "Yes" before confirming.
        "$REX" send-key -s "$REX_SESSION" -b "$block" down
        sleep 0.4
        if screen_text "$block" | grep -q "❯ *$TRUST_RE"; then
          "$REX" send-key -s "$REX_SESSION" -b "$block" enter
          answered=1
        fi
      fi
    elif record "$block" | jq -e '.state == "idle" or .state == "done"' >/dev/null ||
      printf '%s' "$text" | grep -Eq "$READY_RE"; then
      mark "$block"
      printf '%s\n' "$block"
      return 0
    fi
    if exited "$block"; then
      note "claude exited during startup; screen:"
      screen_text "$block" | tail -n 20 >&2
      printf '%s\n' "$block"
      exit 12
    fi
    if [ $((SECONDS - start)) -ge "$timeout" ]; then
      note "not ready after ${timeout}s; screen:"
      printf '%s\n' "$text" | tail -n 20 >&2
      printf '%s\n' "$block"
      exit 124
    fi
    sleep 0.5
  done
}

cmd_send() {
  local block="${1:-}"; guard "$block"; shift
  local text
  if [ "${1:-}" = "-f" ]; then
    [ -f "${2:-}" ] || die "send: no such file: ${2:-}"
    text=$(cat "$2")
  else
    text="$*"
  fi
  text=$(printf '%s' "$text" | tr '\r\n\t' '   ')
  [ -n "${text// /}" ] || die "send: empty prompt"
  mark "$block"
  # Through stdin, so a prompt that starts with "-" is not read as an option.
  printf '%s' "$text" | "$REX" send -s "$REX_SESSION" -b "$block"
  sleep 0.5
  "$REX" send-key -s "$REX_SESSION" -b "$block" enter
}

cmd_wait() {
  local block="${1:-}"; guard "$block"; shift
  local timeout=600
  [ "${1:-}" = "--timeout" ] && timeout="$2"
  local since="" rec state upd start=$SECONDS
  [ -f "$(state_file "$block")" ] && since=$(cat "$(state_file "$block")")
  while :; do
    if exited "$block"; then
      echo "exited"
      return 12
    fi
    rec=$(record "$block")
    state=$(printf '%s' "$rec" | jq -r '.state // ""')
    upd=$(printf '%s' "$rec" | jq -r '.updated_at // ""')
    if [ -n "$state" ] && [ "$upd" != "$since" ]; then
      case "$state" in
        done|idle) echo "$state"; return 0 ;;
        blocked) printf '%s\n' "$rec" | jq -r '"blocked \(.kind // "unknown") \(.msg // "")"'; return 10 ;;
        error) printf '%s\n' "$rec" | jq -r '"error \(.msg // "")"'; return 11 ;;
      esac
    fi
    if [ $((SECONDS - start)) -ge "$timeout" ]; then
      echo "timeout (state=${state:-none})"
      return 124
    fi
    sleep 2
  done
}

cmd_status() {
  local block="${1:-}"; guard "$block"
  local rec proc title
  rec=$(record "$block")
  proc=$(process_json "$block")
  title=$({ "$REX" block call -s "$REX_SESSION" -b "$block" title 2>/dev/null || echo '{}'; } | jq -r '.title // ""')
  jq -nc --argjson r "$rec" --argjson p "$proc" --arg t "$title" \
    '{state: ($r.state // null), kind: ($r.kind // null), msg: ($r.msg // null), title: $t,
      alive: (($p.last_exit == null) and ($p.child != null)), cwd: ($p.foreground.cwd // $p.child.cwd // null)}'
}

cmd_screen() {
  local block="${1:-}"; guard "$block"
  screen_text "$block" | tail -n "${2:-60}"
}

cmd_keys() {
  local block="${1:-}"; guard "$block"; shift
  [ $# -gt 0 ] || die "keys: no keys given"
  mark "$block"
  "$REX" send-key -s "$REX_SESSION" -b "$block" "$@"
}

cmd_ls() {
  local id
  "$REX" block ls -s "$REX_SESSION" --json | jq -r '.blocks[] | select(.flavor | test("terminal")) | .block_id' |
    while read -r id; do
      [ "$id" = "${REX_BLOCK:-}" ] && continue
      if process_json "$id" | jq -e '.foreground.argv0 == "claude" or .child.argv0 == "claude"' >/dev/null; then
        printf '%s\t%s\n' "$id" "$(cmd_status "$id")"
      fi
    done
}

cmd_close() {
  local block="${1:-}"; guard "$block"
  "$REX" block close -s "$REX_SESSION" "$block"
  rm -f "$(state_file "$block")"
}

cmd="${1:-help}"
[ $# -gt 0 ] && shift
case "$cmd" in
  launch) cmd_launch "$@" ;;
  send) cmd_send "$@" ;;
  wait) cmd_wait "$@" ;;
  status) cmd_status "$@" ;;
  screen) cmd_screen "$@" ;;
  keys) cmd_keys "$@" ;;
  ls) cmd_ls ;;
  close) cmd_close "$@" ;;
  help|-h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
