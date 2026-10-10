#!/usr/bin/env python3
"""
Subagent Read-Only Guard (PreToolUse)

Blocks file writes and state-changing shell commands when the tool call comes
from a subagent. Claude Code sets `agent_id` in the hook input only when the
hook fires inside a subagent, so calls from the main conversation pass through
untouched.

A shell command is allowed only when every command in it is a bare program
name from a short allowlist of read-only tools, called without the options
that make those tools write files or run other programs. Anything the guard
cannot classify, including its own errors, is denied.
"""

import json
import re
import sys

WRITE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit", "PowerShell"}
SHELL_TOOLS = {"Bash", "Monitor"}

# Programs that only read, plus the options that would make each one write a
# file or run another program. A forbidden short option also matches when it is
# clustered with others (-uo) or carries its value attached (-ofile).
READ_ONLY_PROGRAMS = {
    "cat": set(), "head": set(), "tail": set(), "wc": set(), "ls": set(),
    "pwd": set(), "stat": set(), "du": set(), "df": set(), "grep": set(),
    "egrep": set(), "fgrep": set(), "which": set(), "whereis": set(),
    "type": set(), "echo": set(), "printf": set(), "uname": set(),
    "whoami": set(), "printenv": set(), "basename": set(), "dirname": set(),
    "realpath": set(), "readlink": set(), "cut": set(), "tr": set(),
    "column": set(), "diff": set(), "cmp": set(), "comm": set(), "jq": set(),
    "nl": set(), "od": set(), "hexdump": set(), "strings": set(),
    "md5sum": set(), "sha1sum": set(), "sha256sum": set(), "shasum": set(),
    "true": set(), "false": set(), "test": set(), "[": set(), "uniq": set(),
    "rg": {"--pre", "--pre-glob", "--hostname-bin", "-z", "--search-zip"},
    "sort": {"-o", "--output", "--compress-program"},
    "tree": {"-o"},
    "fd": {"-x", "-X", "--exec", "--exec-batch"},
    "find": {"-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint",
             "-fprint0", "-fprintf", "-fls"},
}
# find uses single-dash long options, so they are matched whole, never as clusters.
LONG_SINGLE_DASH = {"find"}

GIT_GLOBAL_OK = {"--no-pager", "-P"}
GIT_READ_ONLY = {
    "log", "show", "diff", "status", "blame", "ls-files", "ls-tree",
    "rev-parse", "grep", "describe", "shortlog", "cat-file", "reflog",
    "branch", "tag", "remote", "config",
}
# Options that make any git subcommand write a file or run another program.
GIT_ALWAYS_UNSAFE = {"--output", "-O", "--open-files-in-pager", "--ext-diff",
                     "--textconv", "--filters"}
# Options that turn a listing subcommand into one that changes the repository.
# Short options here also match inside clusters (-vD).
GIT_UNSAFE_PER_SUB = {
    "branch": {"-d", "-D", "-m", "-M", "-c", "-C", "-f", "-u", "-t",
               "--delete", "--move", "--copy", "--force", "--track",
               "--set-upstream-to", "--unset-upstream", "--edit-description",
               "--create-reflog"},
    "tag": {"-d", "-a", "-s", "-u", "-f", "-m", "-F", "-e", "--delete",
            "--annotate", "--sign", "--local-user", "--force", "--message",
            "--file", "--edit", "--create-reflog"},
    "config": {"-e", "--add", "--unset", "--unset-all", "--replace-all",
               "--edit", "--rename-section", "--remove-section"},
}

SEPARATORS = {";", "&", "&&", "|", "||", "\n", "|&"}
REDIRECTS = {">", ">>", ">|", "&>", "&>>", ">&", "<", "<<", "<<<", "<>"}


class Unsafe(Exception):
    pass


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def option_hits(arg, forbidden, clusters=True):
    """True when arg is, contains or starts with a forbidden option."""
    if not arg.startswith("-"):
        return False
    name = arg.split("=", 1)[0]
    if name in forbidden:
        return True
    if arg.startswith("--"):
        return any(name == f for f in forbidden if f.startswith("--"))
    if not clusters:
        return False
    letters = arg[1:]
    shorts = {f[1] for f in forbidden if len(f) == 2 and not f.startswith("--")}
    return any(c in shorts for c in letters)


OPERATOR_CHARS = set(";&|<>()\n")


def tokenize(command):
    """Split a command into (text, is_operator) tokens, honouring quotes.

    Only operators outside quotes are reported as operators, so grep 'a|b'
    stays one word. Raises ValueError on unbalanced quotes.
    """
    tokens, word, in_word, i, n = [], [], False, 0, len(command)
    while i < n:
        c = command[i]
        if c == "'":
            j = command.find("'", i + 1)
            if j < 0:
                raise ValueError("unbalanced quote")
            word.append(command[i + 1:j]); in_word = True; i = j + 1
        elif c == '"':
            j, buf = i + 1, []
            while j < n and command[j] != '"':
                if command[j] == "\\" and j + 1 < n:
                    j += 1
                buf.append(command[j]); j += 1
            if j >= n:
                raise ValueError("unbalanced quote")
            word.append("".join(buf)); in_word = True; i = j + 1
        elif c == "\\" and i + 1 < n:
            if command[i + 1] != "\n":
                word.append(command[i + 1]); in_word = True
            i += 2
        elif c in " \t\r":
            if in_word:
                tokens.append(("".join(word), False)); word, in_word = [], False
            i += 1
        elif c in OPERATOR_CHARS:
            if in_word:
                tokens.append(("".join(word), False)); word, in_word = [], False
            j = i
            while j < n and command[j] in OPERATOR_CHARS and command[j] != "\n":
                j += 1
            if j == i:
                j = i + 1
            tokens.append((command[i:j], True)); i = j
        else:
            word.append(c); in_word = True; i += 1
    if in_word:
        tokens.append(("".join(word), False))
    return tokens


def split_commands(tokens):
    """Split tokens into commands, validating every redirection on the way."""
    commands, current, i = [], [], 0
    while i < len(tokens):
        tok, is_op = tokens[i]
        if not is_op:
            current.append(tok)
        elif tok in SEPARATORS:
            commands.append(current)
            current = []
        elif tok in REDIRECTS:
            nxt = tokens[i + 1] if i + 1 < len(tokens) else ("", True)
            target = "" if nxt[1] else nxt[0]
            if current and current[-1].isdigit():
                current.pop()  # the fd number in 2>/dev/null
            if tok in ("<", "<<<"):
                pass  # reading input is fine
            elif tok == ">&" and target.isdigit():
                pass  # 2>&1
            elif tok in ("<<", "<>"):
                raise Unsafe("here-documents and read-write redirection are not allowed")
            elif target != "/dev/null":
                raise Unsafe("output redirection writes files")
            i += 1
        else:
            raise Unsafe("subshells, background jobs and process substitution are not allowed")
        i += 1
    commands.append(current)
    return [c for c in commands if c]


def check_git(args):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        if args[i] == "-C" and i + 1 < len(args):
            i += 2
        elif args[i] in GIT_GLOBAL_OK:
            i += 1
        else:
            raise Unsafe("git global option %s is not allowed" % args[i])
    if i >= len(args) or args[i] not in GIT_READ_ONLY:
        raise Unsafe("git %s is not a read-only git command" % (args[i] if i < len(args) else ""))
    sub, rest = args[i], args[i + 1:]
    for a in rest:
        if a == "--":
            break
        if option_hits(a, GIT_ALWAYS_UNSAFE, clusters=False) or option_hits(a, GIT_UNSAFE_PER_SUB.get(sub, set())):
            raise Unsafe("git %s %s changes the repository or runs a program" % (sub, a))
    positional = [a for a in rest if not a.startswith("-")]
    if sub in ("branch", "tag") and positional and not ({"-l", "--list"} & set(rest)):
        raise Unsafe("git %s with a name creates a %s" % (sub, sub))
    if sub == "remote" and positional and positional[0] not in ("show", "get-url"):
        raise Unsafe("git remote %s changes the remotes" % positional[0])
    if sub == "reflog" and positional and positional[0] in ("expire", "delete"):
        raise Unsafe("git reflog %s rewrites the reflog" % positional[0])
    if sub == "config" and not ({"--get", "--get-all", "--get-regexp", "--list", "-l"} & set(rest)):
        raise Unsafe("git config can only be read (--get, --list)")


def check_program(words):
    program, args = words[0], words[1:]
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", program):
        raise Unsafe("environment variable prefixes are not allowed")
    if "/" in program:
        raise Unsafe("programs must be called by name, not by path")
    if program == "git":
        return check_git(args)
    if program not in READ_ONLY_PROGRAMS:
        raise Unsafe("%s is not on the read-only command list" % program)
    forbidden = READ_ONLY_PROGRAMS[program]
    clusters = program not in LONG_SINGLE_DASH
    for a in args:
        if a == "--":
            break
        if option_hits(a, forbidden, clusters):
            raise Unsafe("%s %s writes files or runs another program" % (program, a))
    if program == "uniq":
        # uniq IN OUT writes OUT; -f, -s and -w take a value.
        positional, skip = [], False
        for a in args:
            if skip:
                skip = False
            elif a in ("-f", "-s", "-w"):
                skip = True
            elif not a.startswith("-") or a == "-":
                positional.append(a)
        if len(positional) > 1:
            raise Unsafe("uniq with an output file")


def check_command(command):
    if not isinstance(command, str) or not command.strip():
        raise Unsafe("missing command")
    # Command substitution runs inside double quotes too, so reject it anywhere.
    if "$(" in command or "`" in command:
        raise Unsafe("command substitution is not allowed")
    try:
        tokens = tokenize(command)
    except ValueError:
        raise Unsafe("the command could not be parsed")
    for words in split_commands(tokens):
        check_program(words)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print("subagent-read-only-guard: unreadable hook input", file=sys.stderr)
        sys.exit(2)

    # Only subagent calls carry agent_id; the main conversation is untouched.
    if not isinstance(data, dict) or not data.get("agent_id"):
        sys.exit(0)

    agent = data.get("agent_type") or "subagent"
    prefix = "Blocked by subagent-read-only-guard: %s is exploration-only." % agent
    tool = data.get("tool_name", "")
    try:
        if tool in WRITE_TOOLS:
            deny("%s %s is not allowed. Describe the change in your report so the main agent can apply it." % (prefix, tool))
        if tool in SHELL_TOOLS:
            check_command((data.get("tool_input") or {}).get("command"))
    except Unsafe as e:
        deny("%s Only read-only shell commands are allowed (%s). Describe the change in your report instead." % (prefix, e))
    except Exception as e:  # fail closed on any bug in the classifier
        deny("%s The guard could not check this call (%s)." % (prefix, type(e).__name__))
    sys.exit(0)


if __name__ == "__main__":
    main()
