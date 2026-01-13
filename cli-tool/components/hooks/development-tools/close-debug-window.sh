#!/bin/bash
# SessionEnd Hook: Auto-close debug log window
#
# This script closes the Terminal window opened by debug-window.sh
# when a Claude Code session ends.
#
# Requirements:
#   - Only runs when --debug or -d flag was used to start the session
#   - Matches the exact debug log file to avoid closing wrong windows
#
# Disable: Set DEBUG_WINDOW_AUTO_CLOSE_DISABLE=1 in environment

#-----------------------------------------------------------------------
# Environment variable check
# Allow users to disable auto-close behavior via settings.json env config
#-----------------------------------------------------------------------
[[ "$DEBUG_WINDOW_AUTO_CLOSE_DISABLE" == "1" ]] && exit 0

#-----------------------------------------------------------------------
# check_debug_flag: Traverse parent process tree to find --debug or -d flag
#
# Why: The hook script runs as a child process of Claude Code.
#      We walk up the process tree to check if Claude was started with
#      debug flag, since only then should we attempt to close a debug window.
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

# Exit early if debug flag not found - no debug window to close
check_debug_flag || exit 0

#-----------------------------------------------------------------------
# Parse session_id from JSON input
#
# Claude Code passes session info via stdin as JSON:
#   {"session_id":"uuid","transcript_path":"...","hook_event_name":"SessionEnd",...}
#
# We use jq if available, otherwise fall back to sed for portability
#-----------------------------------------------------------------------
INPUT=$(cat)
if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
else
    SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# Exit if session_id missing - cannot identify which debug window to close
[[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]] && exit 1

# Debug log path matches the one opened by debug-window.sh
DEBUG_LOG="$HOME/.claude/debug/${SESSION_ID}.txt"

#-----------------------------------------------------------------------
# Platform-specific window closing logic
#
# macOS: Find Terminal window by TTY, kill tail process first to avoid
#        confirmation dialog, then close the window via AppleScript
# Linux: Simply kill the tail process, terminal behavior varies
# Windows: Use taskkill to terminate the process
#-----------------------------------------------------------------------
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Find the tail process watching this specific debug log
    # ps output: PID TTY COMMAND
    TAIL_INFO=$(ps -eo pid,tty,args | grep "tail.*${DEBUG_LOG}" | grep -v grep | head -1)
    TAIL_PID=$(echo "$TAIL_INFO" | awk '{print $1}')
    TAIL_TTY=$(echo "$TAIL_INFO" | awk '{print $2}')

    # No tail process found - window may already be closed
    [[ -z "$TAIL_TTY" || "$TAIL_TTY" == "??" ]] && exit 0

    # Kill tail process first to prevent "terminate running process?" dialog
    # Sleep briefly to allow process cleanup before closing window
    [[ -n "$TAIL_PID" ]] && kill "$TAIL_PID" 2>/dev/null && sleep 0.2

    # Close Terminal window by matching its TTY to the tail process's TTY
    osascript -e "
    tell application \"Terminal\"
        repeat with w in windows
            repeat with t in tabs of w
                if tty of t is \"/dev/$TAIL_TTY\" then
                    close w
                    return
                end if
            end repeat
        end repeat
    end tell
    " 2>/dev/null

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # On Linux, killing the tail process is usually sufficient
    # Terminal emulators typically close the tab/window when process exits
    pkill -f "tail.*${DEBUG_LOG}"

elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows Git Bash / Cygwin
    taskkill //F //FI "COMMANDLINE eq *${DEBUG_LOG}*" 2>/dev/null
fi
