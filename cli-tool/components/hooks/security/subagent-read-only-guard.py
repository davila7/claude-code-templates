#!/usr/bin/env python3
"""
Subagent Read-Only Guard (PreToolUse)

Blocks file writes and state-changing shell commands when the tool call comes
from a subagent. Claude Code sets `agent_id` in the hook input only when the
hook fires inside a subagent, so calls from the main conversation pass through
untouched.

Shell commands are allowed only when every segment of the pipeline starts with
a known read-only program (and, for git, a read-only subcommand). Anything the
guard cannot classify is denied, so it fails closed.
"""

import json
import re
import shlex
import sys

WRITE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit", "PowerShell"}
SHELL_TOOLS = {"Bash", "Monitor"}

READ_ONLY_PROGRAMS = {
    "cat", "head", "tail", "less", "more", "wc", "ls", "tree", "pwd", "file",
    "stat", "du", "df", "grep", "egrep", "fgrep", "rg", "ag", "find", "fd",
    "which", "whereis", "type", "echo", "printf", "date", "uname", "whoami",
    "printenv", "basename", "dirname", "realpath", "readlink", "sort",
    "uniq", "cut", "tr", "column", "diff", "cmp", "comm", "jq", "yq", "awk",
    "sed", "nl", "od", "hexdump", "xxd", "strings", "md5sum", "sha256sum",
    "shasum", "true", "false", "test", "[",
}

GIT_READ_ONLY = {
    "log", "show", "diff", "status", "blame", "ls-files", "ls-tree",
    "rev-parse", "grep", "describe", "shortlog", "cat-file", "reflog",
    "branch", "tag", "remote", "config",
}

# Flags that turn an otherwise read-only program into a writer or executor.
UNSAFE_ARGS = {
    "find": {"-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprintf", "-fls"},
    "fd": {"-x", "--exec", "-X", "--exec-batch"},
    "sed": {"-i", "--in-place"},
    "sort": {"-o", "--output"},
    "tree": {"-o"},
    "yq": {"-i", "--inplace"},
    "date": {"-s", "--set"},
    "branch": {"-d", "-D", "-m", "-M", "-c", "-C", "--delete", "--move", "--copy", "--set-upstream-to", "-u"},
    "tag": {"-d", "--delete", "-a", "-s", "-f"},
    "config": {"--add", "--unset", "--unset-all", "--replace-all", "--edit", "-e"},
    "reflog": {"expire", "delete"},
}

# Options that make any git subcommand write a file or run another program.
GIT_UNSAFE_ANY = {"--output", "-O", "--open-files-in-pager"}

SEGMENT_SPLIT = re.compile(r"\|\||&&|[|;&\n]")


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def unsafe_segment(segment):
    """Return why a single command segment is not read-only, or None."""
    try:
        words = shlex.split(segment)
    except ValueError:
        return "the command could not be parsed"
    # Skip leading VAR=value assignments.
    while words and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0]):
        words = words[1:]
    if not words:
        return None
    program = words[0].rsplit("/", 1)[-1]
    args = words[1:]

    if program == "git":
        # Skip global options such as -C <dir> or --no-pager.
        i = 0
        while i < len(args) and args[i].startswith("-"):
            i += 2 if args[i] in ("-C", "-c") else 1
        if i >= len(args) or args[i] not in GIT_READ_ONLY:
            return "git %s is not a read-only git command" % (args[i] if i < len(args) else "")
        sub, sub_args = args[i], args[i + 1:]
        if sub == "config" and not any(a in ("--get", "--get-all", "--list", "-l", "--get-regexp") for a in sub_args):
            return "git config can only be read (--get, --list)"
        if any(a.split("=")[0] in UNSAFE_ARGS.get(sub, ()) or a.split("=")[0] in GIT_UNSAFE_ANY for a in sub_args):
            return "git %s with these options changes the repository" % sub
        positional = [a for a in sub_args if not a.startswith("-")]
        if sub in ("branch", "tag") and positional and not any(a in ("-l", "--list") for a in sub_args):
            return "git %s with a name creates a %s" % (sub, sub)
        if sub == "remote" and positional and positional[0] not in ("show", "get-url"):
            return "git remote %s changes the remotes" % positional[0]
        return None

    if program not in READ_ONLY_PROGRAMS:
        return "%s is not on the read-only command list" % program
    unsafe = UNSAFE_ARGS.get(program, ())
    for a in args:
        if a.split("=")[0] in unsafe or (program == "sed" and re.match(r"^-[a-zA-Z]*i", a)):
            return "%s %s writes files or runs other commands" % (program, a)
    if program == "uniq" and len([a for a in args if not a.startswith("-")]) > 1:
        return "uniq with an output file"
    if program == "awk" and re.search(r"system\s*\(|print\s*>|\|\s*\"", " ".join(args)):
        return "awk with system() or output redirection"
    return None


def check_command(command):
    # Output redirection to anything but /dev/null, and command substitution,
    # can write files or hide other commands.
    stripped = re.sub(r"\d?>\s*/dev/null|\d?>&\d", "", command)
    if re.search(r">", stripped):
        return "output redirection writes files"
    if "$(" in command or "`" in command or "<(" in command:
        return "command substitution is not allowed"
    for segment in SEGMENT_SPLIT.split(command):
        reason = unsafe_segment(segment.strip())
        if reason:
            return reason
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Only subagent calls carry agent_id; the main conversation is untouched.
    if not data.get("agent_id"):
        sys.exit(0)

    tool = data.get("tool_name", "")
    agent = data.get("agent_type") or "subagent"
    prefix = "Blocked by subagent-read-only-guard: %s is exploration-only." % agent

    if tool in WRITE_TOOLS:
        deny("%s %s is not allowed. Describe the change in your report so the main agent can apply it." % (prefix, tool))

    if tool in SHELL_TOOLS:
        command = (data.get("tool_input") or {}).get("command", "")
        reason = check_command(command)
        if reason:
            deny("%s Only read-only shell commands are allowed (%s). Describe the change in your report instead." % (prefix, reason))

    sys.exit(0)


if __name__ == "__main__":
    main()
