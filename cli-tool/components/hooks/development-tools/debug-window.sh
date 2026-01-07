#!/bin/bash
# SessionStart Hook
# Opens debug log in a new window only when --debug flag is present

# Check if --debug flag is present in parent process tree
check_debug_flag() {
    local pid=$$
    while [[ $pid -ne 1 ]]; do
        local cmdline
        if [[ -f "/proc/$pid/cmdline" ]]; then
            # Linux
            cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
        else
            # macOS
            cmdline=$(ps -p "$pid" -o args= 2>/dev/null)
        fi

        if [[ "$cmdline" =~ (^|[[:space:]])--debug($|[[:space:]]) ]]; then
            return 0
        fi

        # Get parent PID
        local ppid
        ppid=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
        [[ -z "$ppid" || "$ppid" == "$pid" ]] && break
        pid=$ppid
    done
    return 1
}

# Exit early if --debug flag is not present
if ! check_debug_flag; then
    exit 0
fi

# Read JSON input from stdin
INPUT=$(cat)

# Extract session_id using jq (if available) or sed
if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
else
    # Fallback to sed (works on both BSD and GNU)
    SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# Exit if session_id is not found
if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
    echo "Error: session_id not found" >&2
    exit 1
fi

DEBUG_LOG="$HOME/.claude/debug/${SESSION_ID}.txt"

# Wait for file creation (max 5 seconds, 1 second interval)
for i in {1..5}; do
    [[ -f "$DEBUG_LOG" ]] && break
    sleep 1
done

# Exit if file not found after waiting
if [[ ! -f "$DEBUG_LOG" ]]; then
    echo "Error: debug log not found: $DEBUG_LOG" >&2
    exit 1
fi

# Open debug log in a new terminal window
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e "tell application \"Terminal\" to do script \"tail -n 1000 -f '$DEBUG_LOG'\""
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try common terminal emulators
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- tail -n 1000 -f "$DEBUG_LOG"
    elif command -v konsole &> /dev/null; then
        konsole -e tail -n 1000 -f "$DEBUG_LOG"
    elif command -v xterm &> /dev/null; then
        xterm -e tail -n 1000 -f "$DEBUG_LOG" &
    else
        echo "Error: no supported terminal emulator found" >&2
        exit 1
    fi
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash / Cygwin)
    start cmd /c "tail -n 1000 -f '$DEBUG_LOG'"
else
    echo "Error: unsupported OS: $OSTYPE" >&2
    exit 1
fi
