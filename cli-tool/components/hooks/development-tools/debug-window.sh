#!/bin/bash
# SessionStart Hook: Open debug log in a new Terminal window
#
# This script opens a new Terminal window with tail -f on the debug log
# when Claude Code is started with --debug or -d flag.
#
# The debug log window can be auto-closed on session end by the
# companion script close-debug-window.sh (SessionEnd hook).
#
# Requirements:
#   - Only runs when --debug or -d flag was used to start the session
#   - Debug log file must exist at ~/.claude/debug/{session_id}.txt

#-----------------------------------------------------------------------
# check_debug_flag: Traverse parent process tree to find --debug or -d flag
#
# Why: The hook script runs as a child process of Claude Code.
#      We walk up the process tree to check if Claude was started with
#      debug flag, since only then should we open a debug window.
#
# Returns: 0 if debug flag found, 1 otherwise
#-----------------------------------------------------------------------
check_debug_flag() {
    local pid=$$
    while [[ $pid -ne 1 ]]; do
        local cmdline
        # Linux stores cmdline in /proc, macOS requires ps command
        if [[ -f "/proc/$pid/cmdline" ]]; then
            cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
        else
            cmdline=$(ps -p "$pid" -o args= 2>/dev/null)
        fi

        # Match --debug or -d as standalone flags (not part of another word)
        [[ "$cmdline" =~ (^|[[:space:]])(--debug|-d)($|[[:space:]]) ]] && return 0

        # Move to parent process
        local ppid
        ppid=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
        [[ -z "$ppid" || "$ppid" == "$pid" ]] && break
        pid=$ppid
    done
    return 1
}

# Exit early if debug flag not found - no debug window needed
check_debug_flag || exit 0

#-----------------------------------------------------------------------
# Parse session_id from JSON input
#
# Claude Code passes session info via stdin as JSON:
#   {"session_id":"uuid","transcript_path":"...","hook_event_name":"SessionStart",...}
#
# We use jq if available, otherwise fall back to sed for portability
#-----------------------------------------------------------------------
INPUT=$(cat)
if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
else
    SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# Exit if session_id missing - cannot locate debug log file
[[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]] && exit 1

DEBUG_LOG="$HOME/.claude/debug/${SESSION_ID}.txt"

#-----------------------------------------------------------------------
# Wait for debug log file creation
#
# Why: Claude Code may not have created the debug log file yet when
#      SessionStart hook runs. We poll for up to 5 seconds.
#-----------------------------------------------------------------------
for i in {1..5}; do
    [[ -f "$DEBUG_LOG" ]] && break
    sleep 1
done

# Exit if debug log file never appeared
[[ ! -f "$DEBUG_LOG" ]] && exit 1

#-----------------------------------------------------------------------
# Platform-specific terminal window opening
#
# Opens a new terminal window running: tail -n 1000 -f $DEBUG_LOG
# Shows last 1000 lines and follows new output in real-time
#
# macOS: Uses AppleScript to open Terminal.app
# Linux: Tries gnome-terminal, konsole, then xterm
# Windows: Uses cmd.exe via start command
#-----------------------------------------------------------------------
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e "tell application \"Terminal\" to do script \"tail -n 1000 -f '$DEBUG_LOG'\""

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- tail -n 1000 -f "$DEBUG_LOG"
    elif command -v konsole &> /dev/null; then
        konsole -e tail -n 1000 -f "$DEBUG_LOG"
    elif command -v xterm &> /dev/null; then
        xterm -e tail -n 1000 -f "$DEBUG_LOG" &
    else
        exit 1
    fi

elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    start cmd /c "tail -n 1000 -f '$DEBUG_LOG'"
fi
