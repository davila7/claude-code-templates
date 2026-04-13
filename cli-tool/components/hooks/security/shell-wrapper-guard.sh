#!/bin/bash
# shell-wrapper-guard.sh — Detect destructive commands hidden in shell wrappers
#
# Solves: Bypass vectors that evade destructive-guard by wrapping commands:
#   sh -c "rm -rf /"
#   bash -c "git reset --hard"
#   python3 -c "import os; os.system('rm -rf ~')"
#   perl -e "system('rm -rf /')"
#   ruby -e "system('rm -rf /')"
#   node -e "require('child_process').execSync('rm -rf /')"
#
# Complements destructive-guard.sh which checks direct commands.
# This hook unwraps interpreter one-liners and checks the inner command.
#
# Usage: PreToolUse hook on "Bash"
#
# TRIGGER: PreToolUse  MATCHER: "Bash"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Destructive patterns to detect inside wrappers
DESTRUCT_PATTERN='rm\s+-[rf]*\s+[/~]|rm\s+-[rf]*\s+\.\.|git\s+reset\s+--hard|git\s+clean\s+-[fd]+|git\s+checkout\s+\.|mkfs\.|dd\s+if=|>\s*/dev/sd|chmod\s+777\s+/'

# === Check 1: sh/bash -c wrappers ===
if echo "$COMMAND" | grep -qE '(sh|bash|zsh|dash)\s+-c\s+'; then
    INNER=$(echo "$COMMAND" | sed -E "s/.*(sh|bash|zsh|dash)\s+-c\s+['\"]?//" | sed "s/['\"]?\s*$//")
    if echo "$INNER" | grep -qE "$DESTRUCT_PATTERN"; then
        echo "BLOCKED: Destructive command hidden in shell wrapper" >&2
        echo "  Detected: $INNER" >&2
        exit 2
    fi
fi

# === Check 2: Python one-liners ===
if echo "$COMMAND" | grep -qE 'python[23]?\s+-c\s+'; then
    INNER=$(echo "$COMMAND" | sed -E "s/.*python[23]?\s+-c\s+['\"]?//" | sed "s/['\"]?\s*$//")
    if echo "$INNER" | grep -qiE "os\.system\(.*($DESTRUCT_PATTERN)|subprocess\.(run|call|Popen)\(.*($DESTRUCT_PATTERN)|shutil\.rmtree\s*\(\s*['\"/~]"; then
        echo "BLOCKED: Destructive command in Python one-liner" >&2
        exit 2
    fi
fi

# === Check 3: Perl/Ruby one-liners ===
if echo "$COMMAND" | grep -qE '(perl|ruby)\s+-e\s+'; then
    INNER=$(echo "$COMMAND" | sed -E "s/.*(perl|ruby)\s+-e\s+['\"]?//" | sed "s/['\"]?\s*$//")
    if echo "$INNER" | grep -qE "system\(.*($DESTRUCT_PATTERN)|exec\(.*($DESTRUCT_PATTERN)"; then
        echo "BLOCKED: Destructive command in interpreter one-liner" >&2
        exit 2
    fi
fi

# === Check 4: Node.js one-liners ===
if echo "$COMMAND" | grep -qE 'node\s+-e\s+'; then
    INNER=$(echo "$COMMAND" | sed -E "s/.*node\s+-e\s+['\"]?//" | sed "s/['\"]?\s*$//")
    if echo "$INNER" | grep -qE "execSync\(.*($DESTRUCT_PATTERN)|exec\(.*($DESTRUCT_PATTERN)"; then
        echo "BLOCKED: Destructive command in Node.js one-liner" >&2
        exit 2
    fi
fi

# === Check 5: Nested wrappers (sh -c "bash -c 'rm -rf /'") ===
if echo "$COMMAND" | grep -qE '(sh|bash)\s+-c\s+.*(sh|bash)\s+-c'; then
    if echo "$COMMAND" | grep -qE "$DESTRUCT_PATTERN"; then
        echo "BLOCKED: Nested shell wrapper with destructive command" >&2
        exit 2
    fi
fi

# === Check 6: Pipe to shell (echo "rm -rf /" | sh) ===
if echo "$COMMAND" | grep -qE '\|\s*(sh|bash|zsh)\s*$'; then
    # Extract the piped content
    PIPED=$(echo "$COMMAND" | sed -E 's/\s*\|\s*(sh|bash|zsh)\s*$//')
    if echo "$PIPED" | grep -qE "$DESTRUCT_PATTERN"; then
        echo "BLOCKED: Destructive command piped to shell" >&2
        exit 2
    fi
fi

# === Check 7: Here-string to shell (bash <<< "rm -rf /") ===
if echo "$COMMAND" | grep -qE '(sh|bash|zsh)\s+<<<\s+'; then
    INNER=$(echo "$COMMAND" | sed -E "s/.*(sh|bash|zsh)\s+<<<\s+['\"]?//" | sed "s/['\"]?\s*$//")
    if echo "$INNER" | grep -qE "$DESTRUCT_PATTERN"; then
        echo "BLOCKED: Destructive command via here-string" >&2
        exit 2
    fi
fi

# === Check 8: env-based bypass (env VAR=val sh -c "$VAR") ===
if echo "$COMMAND" | grep -qE '^\s*env\s+.*\s+(sh|bash)\s+-c'; then
    if echo "$COMMAND" | grep -qE "$DESTRUCT_PATTERN"; then
        echo "BLOCKED: Destructive command via env wrapper" >&2
        exit 2
    fi
fi

exit 0
