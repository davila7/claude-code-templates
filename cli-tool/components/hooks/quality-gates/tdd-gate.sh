#!/bin/bash
# tdd-gate.sh — enforce the red-green cycle of the test-driven-development skill.
#
# Originally based on pm-workspace's tdd-gate (https://github.com/gonzalezpazmonica/pm-workspace, MIT).
# Rewritten for claude-code-templates to pair with skills/development/test-driven-development.
#
# One script, wired to several hook events (see tdd-gate.json):
#   PostToolUse  Edit|Write|MultiEdit  a test file changed            -> phase "test"
#   PostToolUse  Bash (test command)   failed after a test change     -> phase "red"
#                                      passed                         -> phase "green" (if it was red)
#   PostToolUseFailure Bash            same as a failed test command
#   PreToolUse   Edit|Write|MultiEdit  production code: allowed only in phase red/green
#   PreToolUse   Bash                  same check for `>`, `>>`, `tee`, `sed -i` writes to production code
#   Stop                               production code changed since the last green full-suite run -> keep going
#
# State is per session, in ${TMPDIR:-/tmp}/claude-tdd-gate-<uid>/<session_id> (mode 700, parsed, never sourced).
# Turn the gate off for a project: create .claude/tdd-gate.off (the user decides, not Claude).
# Turn it off for one shell: TDD_GATE=off.
# Requires: jq.

INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ "${TDD_GATE:-on}" = "off" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd // "."')}"
[ -f "$PROJECT_DIR/.claude/tdd-gate.off" ] && exit 0

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
SESSION=$(echo "$INPUT" | jq -r '.session_id // "default"' | tr -cd 'A-Za-z0-9_-')
STATE_DIR="${TMPDIR:-/tmp}/claude-tdd-gate-$(id -u)"
STATE="$STATE_DIR/${SESSION:-default}"
mkdir -p -m 700 "$STATE_DIR" 2>/dev/null
# a directory someone else created (or a symlink) is not ours: stay out of the way
{ [ -d "$STATE_DIR" ] && [ ! -L "$STATE_DIR" ] && [ -O "$STATE_DIR" ]; } || exit 0

PHASE=idle      # idle -> test -> red -> green -> (test edit) test ...
PROD_DIRTY=0    # production code changed since the last green full-suite run
# parse the state file, never source it
if [ -f "$STATE" ]; then
  P=$(grep -m1 '^PHASE=' "$STATE" | cut -d= -f2)
  D=$(grep -m1 '^PROD_DIRTY=' "$STATE" | cut -d= -f2)
  case "$P" in idle|test|red|green) PHASE=$P ;; esac
  case "$D" in 0|1) PROD_DIRTY=$D ;; esac
fi
save() { printf 'PHASE=%s\nPROD_DIRTY=%s\n' "$PHASE" "$PROD_DIRTY" > "$STATE"; }

# --- file classification -------------------------------------------------
# prints: test | prod | other
classify() {
  local f="$1" base ext
  base=$(basename "$f")
  ext="${base##*.}"
  [ "$ext" = "$base" ] && { echo other; return; }
  case "$f" in
    */test/*|*/tests/*|*/Test/*|*/Tests/*|*/__tests__/*|*/spec/*|*/specs/*) echo test; return ;;
  esac
  case "$base" in
    *.test.*|*.spec.*|*_test.*|test_*.*|*Test.*|*Tests.*|*Spec.*|*_spec.*) echo test; return ;;
  esac
  case "$ext" in
    cs|py|ts|tsx|js|jsx|mjs|cjs|go|rs|rb|php|java|kt|swift|dart|ex|exs|scala|c|cc|cpp|h|hpp) ;;
    *) echo other; return ;;
  esac
  case "$base" in
    *.d.ts|*.config.*|*rc.js|*rc.cjs|setup.py|conftest.py|manage.py|Program.cs|Startup.cs) echo other; return ;;
  esac
  case "$f" in
    */node_modules/*|*/vendor/*|*/dist/*|*/build/*|*/.claude/*|*/migrations/*|*/Migrations/*|*/fixtures/*|*/mocks/*|*/__mocks__/*|*/scripts/*) echo other; return ;;
  esac
  echo prod
}

# --- test command detection ----------------------------------------------
TEST_RE='(^|[;&|(]|&&)[[:space:]]*(env [^;&|]*)?((uv|poetry|pipenv|hatch|pdm) run )?((npm|pnpm|yarn|bun)( run)? test(:[A-Za-z0-9_:-]+)?|npx (jest|vitest|mocha)|jest|vitest|mocha|node --test|bun test|deno test|pytest|python3? -m (pytest|unittest)|go test|cargo test|rspec|bundle exec rspec|mvn( -q)? test|gradle test|\./gradlew test|dotnet test|phpunit|vendor/bin/phpunit|mix test)([[:space:]]|$)'
FAIL_RE='(# fail [1-9]|^not ok |(^|[^A-Za-z])FAIL([^A-Za-z]|$)|FAILED|[1-9][0-9]* (failed|failing)|AssertionError|Tests:.*[1-9][0-9]* failed|test result: FAILED|^--- FAIL)'

is_test_cmd() { echo "$1" | grep -Eq "$TEST_RE"; }
# a run without explicit test file/dir arguments counts as the whole suite
# (`go test ./...` and option values such as `--config ./jest.config.js` are not file arguments)
is_full_suite() {
  local run
  run=$(echo "$1" | grep -Eo "$TEST_RE[^|;&]*" | head -1 \
    | sed -E 's/(^|[[:space:]])(-c|--config|--rootdir|--project|-p|--reporter)[= ][^[:space:]]+//g; s/(^|[[:space:]])-[^[:space:]]*//g; s/(^|[[:space:]])(\.\/)?\.\.\.([[:space:]]|$)/ /g; s/[0-9]?>[^[:space:]]*//g')
  ! echo "$run" | grep -Eq '[^[:space:]]*(/|\.test\.|\.spec\.|_test\.|test_)[^[:space:]]*'
}

block_pre() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

gate_prod_edit() {
  local f="$1" rel
  rel="${f#$PROJECT_DIR/}"
  # after a red run (or a green one) production edits are free until the next
  # test change starts a new cycle; Stop still requires a green full-suite run
  case "$PHASE" in
    red|green) return 0 ;;
    test) block_pre "TDD gate: you changed a test but have not watched it fail yet. Run the test with the project's test command, without piping it through tail/grep so the result is visible, and confirm it fails for the expected reason (feature missing, not a typo). Then edit $rel. (test-driven-development skill: Verify RED.)" ;;
    *) block_pre "TDD gate: no failing test yet for this change. Write a test that shows the behavior you want, run it and watch it fail, then edit $rel. If the project has no test setup, add the smallest one the stack ships (node --test, python -m unittest, go test, cargo test). If the user explicitly said to skip TDD for this change, tell them they can create .claude/tdd-gate.off; do not create it yourself. (test-driven-development skill: RED before GREEN.)" ;;
  esac
}

# files a shell command writes to: > file, >> file, tee file, sed -i ... file
bash_write_targets() {
  local cmd
  # drop heredoc bodies: their text (e.g. `() => x`) is file content, not shell
  cmd=$(printf '%s\n' "$1" | awk '
    skip { if ($0 == term) { skip = 0 }; next }
    { print }
    match($0, /(^|[^<])<<-?[[:space:]]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/) {
      t = substr($0, RSTART, RLENGTH); sub(/^[^<]?<<-?[[:space:]]*/, "", t); gsub(/["\047]/, "", t); term = t; skip = 1
    }')
  echo "$cmd" | grep -Eo '(^|[^0-9&>])>>?[[:space:]]*[^[:space:];&|<>]+' | sed -E 's/^.?>>?[[:space:]]*//'
  echo "$cmd" | grep -Eo 'tee( -a)?[[:space:]]+[^[:space:];&|<>]+' | awk '{print $NF}'
  echo "$cmd" | grep -Eo 'sed[[:space:]]+(-[a-zA-Z]*i[a-zA-Z]*|--in-place)[^;&|]*' | awk '{print $NF}'
}
# the same targets without their quotes ("src/a.ts" -> src/a.ts)
bash_write_paths() { bash_write_targets "$1" | tr -d "\"'"; }

abs() { case "$1" in /*) echo "$1" ;; *) echo "$(echo "$INPUT" | jq -r '.cwd // "."')/$1" ;; esac; }

case "$EVENT" in
  PreToolUse)
    case "$TOOL" in
      Edit|Write|MultiEdit)
        F=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        [ -n "$F" ] && [ "$(classify "$F")" = prod ] && gate_prod_edit "$F"
        ;;
      Bash)
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
        while IFS= read -r T; do
          [ -z "$T" ] && continue
          case "$T" in /dev/*|'&'*) continue ;; esac
          T=$(abs "$T")
          [ "$(classify "$T")" = prod ] && gate_prod_edit "$T"
        done < <(bash_write_paths "$CMD")
        ;;
    esac
    exit 0
    ;;

  PostToolUse|PostToolUseFailure)
    case "$TOOL" in
      Edit|Write|MultiEdit)
        F=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        case "$(classify "$F")" in
          test) PHASE=test ;;
          prod) PROD_DIRTY=1 ;;
        esac
        save
        ;;
      Bash)
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
        # a shell write to a test or production file counts like an edit
        while IFS= read -r T; do
          [ -z "$T" ] && continue
          case "$T" in /dev/*|'&'*) continue ;; esac
          case "$(classify "$(abs "$T")")" in
            test) PHASE=test ;;
            prod) PROD_DIRTY=1 ;;
          esac
        done < <(bash_write_paths "$CMD")
        if is_test_cmd "$CMD"; then
          if [ "$EVENT" = PostToolUseFailure ]; then
            # an aborted run says nothing about the tests
            [ "$(echo "$INPUT" | jq -r '.is_interrupt // false')" = true ] && { save; exit 0; }
            FAILED=1
          else
            OUT=$(echo "$INPUT" | jq -r '(.tool_response.stdout // "") + "\n" + (.tool_response.stderr // "")')
            echo "$OUT" | grep -Eq "$FAIL_RE" && FAILED=1 || FAILED=0
          fi
          if [ "$FAILED" = 1 ]; then
            [ "$PHASE" = test ] || [ "$PHASE" = red ] && PHASE=red
          else
            [ "$PHASE" = red ] && PHASE=green
            if [ "$PHASE" = test ]; then
              save
              jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"TDD gate: the tests passed right after you changed a test, so the new test has not failed yet. Either it checks behavior that already exists (fix the test) or the output was filtered so the failure was not visible (run it again without tail/grep). Production edits stay blocked until a test run fails."}}'
              exit 0
            fi
            is_full_suite "$CMD" && PROD_DIRTY=0
          fi
        fi
        save
        ;;
    esac
    exit 0
    ;;

  Stop)
    ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
    if [ "$PROD_DIRTY" = 1 ] && [ "$ACTIVE" != true ]; then
      jq -n '{decision:"block",reason:"TDD gate: production code changed since the last passing run of the whole test suite. Run the project'"'"'s full test command (for example npm test, pytest, go test ./..., cargo test) without a file argument and without piping it through tail/grep, and report any failure by name, before saying the work is done. (test-driven-development skill: Verify GREEN.)"}'
    fi
    exit 0
    ;;
esac
exit 0
