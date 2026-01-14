#!/bin/bash
# Session Hook: Auto Debug Log Viewer
#
# Opens a live-tailing debug log window on SessionStart and
# closes it on SessionEnd when Claude Code runs with --debug or -d flag.
#
# Events:
#   - SessionStart: Opens terminal window with tail -f on debug log
#   - SessionEnd: Terminates tail process and closes window
#
# Requirements:
#   - Only runs when --debug or -d flag was used to start the session
#   - Debug log file must exist at ~/.claude/debug/{session_id}.txt
#
# Configuration (in ~/.claude/settings.json):
#   To keep debug window open after session ends:
#   { "env": { "DEBUG_WINDOW_AUTO_CLOSE_DISABLE": "1" } }

#-----------------------------------------------------------------------
# check_debug_flag: Traverse parent process tree to find --debug or -d flag
#
# Why: The hook script runs as a child process of Claude Code.
#      We walk up the process tree to check if Claude was started with
#      debug flag, since only then should we manage the debug window.
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

# Exit early if debug flag not found
check_debug_flag || exit 0

#-----------------------------------------------------------------------
# Parse JSON input from stdin
#
# Claude Code passes session info via stdin as JSON:
#   {"session_id":"uuid","hook_event_name":"SessionStart|SessionEnd",...}
#
# We use jq if available, otherwise fall back to sed for portability
#-----------------------------------------------------------------------
INPUT=$(cat)

if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
    HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')
else
    SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    HOOK_EVENT=$(echo "$INPUT" | sed -n 's/.*"hook_event_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# Exit if session_id missing
[[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]] && exit 1

DEBUG_LOG="$HOME/.claude/debug/${SESSION_ID}.txt"

#-----------------------------------------------------------------------
# SessionStart: Open debug log in a new terminal window
#-----------------------------------------------------------------------
open_debug_window() {
    # Wait for debug log file creation (max 5 seconds)
    # Why: Claude Code may not have created the file yet when hook runs
    for i in {1..5}; do
        [[ -f "$DEBUG_LOG" ]] && break
        sleep 1
    done
    [[ ! -f "$DEBUG_LOG" ]] && exit 1

    # Platform-specific terminal window opening
    # Opens: tail -n 1000 -f $DEBUG_LOG (last 1000 lines + follow)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        osascript -e "tell application \"Terminal\" to do script \"tail -n 1000 -f '$DEBUG_LOG'\""

    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- tail -n 1000 -f "$DEBUG_LOG"
        elif command -v konsole &> /dev/null; then
            konsole -e tail -n 1000 -f "$DEBUG_LOG"
        elif command -v xterm &> /dev/null; then
            xterm -e tail -n 1000 -f "$DEBUG_LOG" &
        fi

    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        start cmd /c "tail -n 1000 -f '$DEBUG_LOG'"
    fi
}

#-----------------------------------------------------------------------
# SessionEnd: Close debug log window
#-----------------------------------------------------------------------
close_debug_window() {
    # Allow users to disable auto-close via environment variable
    [[ "$DEBUG_WINDOW_AUTO_CLOSE_DISABLE" == "1" ]] && exit 0

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Find tail process by matching the exact debug log path
        # ps output: PID TTY COMMAND
        TAIL_INFO=$(ps -eo pid,tty,args | grep "tail.*${DEBUG_LOG}" | grep -v grep | head -1)
        TAIL_PID=$(echo "$TAIL_INFO" | awk '{print $1}')
        TAIL_TTY=$(echo "$TAIL_INFO" | awk '{print $2}')

        [[ -z "$TAIL_TTY" || "$TAIL_TTY" == "??" ]] && exit 0

        # Kill tail first to prevent "terminate running process?" dialog
        [[ -n "$TAIL_PID" ]] && kill "$TAIL_PID" 2>/dev/null && sleep 0.2

        # Close Terminal window by matching TTY
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
        # Killing tail process is usually sufficient on Linux
        pkill -f "tail.*${DEBUG_LOG}"

    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Note: taskkill /FI does not support COMMANDLINE filter
        # Use ps and kill instead
        TAIL_PID=$(ps -s | grep "tail.*${DEBUG_LOG}" | grep -v grep | awk '{print $1}' | head -1)
        [[ -n "$TAIL_PID" ]] && kill "$TAIL_PID" 2>/dev/null
    fi
}

#-----------------------------------------------------------------------
# Event dispatcher
#-----------------------------------------------------------------------
case "$HOOK_EVENT" in
    SessionStart) open_debug_window ;;
    SessionEnd)   close_debug_window ;;
esac
