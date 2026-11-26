#!/usr/bin/env python3
"""
Skill Shell Guard (PreSkillShellCommand, Claude Code 2.1.332+)

Skills and slash commands can run shell commands while they load, with
!`command` lines or ```! blocks. Those commands run before Claude reads the
skill, without a permission prompt, and PreToolUse hooks never see them. A
skill's own `allowed-tools` can pre-approve them, so a skill that arrives in a
cloned repository or a plugin can approve its own `curl ... | sh`.

This hook is an allowlist. An injected command runs only when:

1. It uses plain shell syntax. Words are letters, digits and . / _ - = , : @ % +,
   or text in single quotes, or text in double quotes without $ or `. Anything
   that bash would expand or that changes how a line is read is blocked:
   $ (variables, $(...), $'...'), backticks, a leading ~, globs (* ? [),
   braces, #,
   backslashes, here-documents and input redirection (<). Output redirection is
   allowed only to /dev/null or another descriptor (2>&1).
2. Every part (split on ; && || | & newlines and parentheses) is a read-only
   command on the list below, with options on its list:
   - files and text: ls, cat, head, tail (no -f), wc, grep, egrep, fgrep, rg
     (no --pre), find (tests and -print only), sort and uniq (no output file),
     cut, tr, column, nl, comm, diff, cmp, jq (no env), stat, du, df, basename,
     dirname, realpath, readlink, md5sum, sha256sum, shasum
   - environment: pwd, date (no -s), whoami, id, uname, which, type,
     command -v, ps (no environment display), test, [, echo, true, false,
     exit (not printf: -v and %n assign shell variables such as PATH)
   - git: status, log, diff, show, blame, grep (no -O), ls-files, ls-tree,
     rev-parse, describe, shortlog, cat-file, rev-list, merge-base, name-rev,
     for-each-ref, and the listing forms of branch, tag, remote, stash,
     worktree, submodule, reflog; config --get. Never -c, -C, --git-dir,
     --output, --ext-diff, --textconv, --filters, --exec.
   - gh: pr/issue/run/release/workflow view, list, status, diff, checks; repo
     view; gh api <endpoint> with only --jq, --paginate, --slurp, --template,
     --cache (a GET)
   - other tools: <tool> --version, npm/pnpm ls, pip list/show/freeze,
     go version, docker ps/images/info/version, docker compose ps/ls/version,
     kubectl get (no secrets, configmaps, --raw or -o yaml/json), kubectl
     version/cluster-info/api-resources/config current-context
3. No word names a credentials file: .env*, *.env, .envrc, .ssh, .aws, .gnupg,
   .kube, .docker, .netrc, .npmrc, .pypirc, .pgpass, .vault-token, .my.cnf,
   .git-credentials, .git/config, shell history, id_rsa..., *credential*,
   *secret*, *.pem, *.key, *.p12, /proc/, /dev/ (except /dev/null).

Everything else is blocked: network calls (curl, wget), package scripts (npm
test, npm run, npx, yarn, bun), interpreters and scripts, xargs, awk, writes,
deletes and deploys. PowerShell injected commands are always blocked, since
the rules above are bash rules.

A blocked command does not run. The skill still loads, and Claude reads
`[not run: blocked by hook: <reason>]` in its place, so it can run the
command afterwards as a normal Bash call, which goes through your permission
rules and PreToolUse hooks.

Skills from Claude Code itself (`builtin`) and from managed settings
(`policySettings`) are not checked. To allow a specific command, add it
verbatim to "allowCommands" in ~/.claude/skill-shell-guard.json. That file
is read only from your home directory, never from the project, so a
repository cannot allow its own commands.

Known gaps: it reads command text. `grep -r KEY .` can still print a secret
from a file it does not name, `git remote -v` prints a token embedded in a
remote URL, and the allowed commands read whatever files they are given.
Fails closed: input it cannot parse is blocked.

Maintainers: skill-shell-guard.json pins this file's SHA-256 for the project
fallback. After editing this file, update the hash in that command.
"""

import json
import os
import posixpath
import re
import sys

EVENT = "PreSkillShellCommand"
TRUSTED_SOURCES = {"builtin", "policySettings"}
CONFIG = os.path.join(os.path.expanduser("~"), ".claude", "skill-shell-guard.json")


class Blocked(Exception):
    pass


def block(reason, skill=""):
    where = f" in /{skill}" if skill else ""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": EVENT,
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"skill-shell-guard blocked a shell command{where}: {reason} "
                "Only read-only inspection commands run while a skill loads. "
                "If the command is needed, run it as a normal Bash call so it "
                "goes through the permission rules."
            ),
        }
    }))
    sys.exit(0)


# ----------------------------------------------------------------- tokenizer

WORD_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/-=,:@%+")
OPERATORS = ["&&", "||", "|&", ";;", "2>&1", "1>&2", ">&2", ">&1", "&>", ">>", ">", "|", ";", "&", "(", ")", "\n"]
DUPS = ("2>&1", "1>&2", ">&2", ">&1")


def tokenize(command):
    """Split a command the way bash would, refusing anything bash would expand.

    Returns a list of ("word", text) and ("op", text) tuples.
    """
    tokens = []
    word = None  # None = not inside a word
    i, n = 0, len(command)
    while i < n:
        c = command[i]
        if c == "'":
            end = command.find("'", i + 1)
            if end < 0:
                raise Blocked("unbalanced single quote.")
            word = (word or "") + command[i + 1:end]
            i = end + 1
            continue
        if c == '"':
            end = command.find('"', i + 1)
            if end < 0:
                raise Blocked("unbalanced double quote.")
            inner = command[i + 1:end]
            if "$" in inner or "`" in inner or inner.endswith("\\"):
                raise Blocked("$ and ` are not allowed inside double quotes.")
            word = (word or "") + inner
            i = end + 1
            continue
        if word is None and (command.startswith("2>&1", i) or command.startswith("1>&2", i)):
            if i + 4 < n and command[i + 4] not in " \t\n;&|)":
                raise Blocked("a descriptor redirect must stand alone (>&1foo writes a file).")
            tokens.append(("op", command[i:i + 4]))
            i += 4
            continue
        if c == "^" and word:
            word += c  # HEAD^
            i += 1
            continue
        nxt = command[i + 1] if i + 1 < n else " "
        if c == "~" and word and word[-1] not in "=:":
            word += c  # HEAD~1: tilde expands only at the start of a word
            i += 1
            continue
        if c in "[]" and word is None and nxt in " \t\n;&|)":
            tokens.append(("word", c))  # the test command [ ... ]
            i += 1
            continue
        if c in WORD_CHARS:
            word = (word or "") + c
            i += 1
            continue
        if c in " \t":
            if word is not None:
                tokens.append(("word", word))
                word = None
            i += 1
            continue
        for op in OPERATORS:
            if command.startswith(op, i):
                if word is not None:
                    # "2>" / "1>": a descriptor number glued to a redirect
                    if word in ("1", "2") and op in (">", ">>"):
                        word = None
                    else:
                        tokens.append(("word", word))
                        word = None
                if op in DUPS and i + len(op) < n and command[i + len(op)] not in " \t\n;&|)":
                    raise Blocked("a descriptor redirect must stand alone (>&1foo writes a file).")
                tokens.append(("op", op))
                i += len(op)
                break
        else:
            shown = {"\t": "tab"}.get(c, c)
            raise Blocked(f"the character {shown!r} is not allowed (no expansion, globbing, comments or escapes).")
    if word is not None:
        tokens.append(("word", word))
    return tokens


# ------------------------------------------------------------- credentials

SENSITIVE = re.compile(
    r"(^|[/=:,@])("
    r"\.env[\w.-]*|[\w.-]+\.env|\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.azure|\.netrc|"
    r"\.npmrc|\.yarnrc[\w.-]*|\.pypirc|\.pgpass|\.vault-token|\.my\.cnf|\.git-credentials|"
    r"\.git/config|\.config/(gh|gcloud|hub|op|rclone|doctl|stripe)|\.terraform\.d|\.\w*_history|"
    r"\.claude\.json|\.claude/settings[\w.-]*|\.mcp\.json|[\w.-]*\.tfstate[\w.-]*|[\w.-]*\.tfvars[\w.-]*|"
    r"\.s3cfg|\.htpasswd|\.dockercfg|\.cargo/credentials[\w.-]*|\.dev\.vars|\.m2|\.gradle|\.boto|"
    r"\.wrangler|\.vercel|\.databrickscfg|\.terraformrc|\.gitconfig|pip\.conf|\.git/modules|"
    r"\.config/configstore|\.(bash|zsh)rc|\.profile|\.bash_profile|\.zprofile|\.zshenv|"
    r"etc/(environment|shadow|gshadow|sudoers)|"
    r"id_(rsa|dsa|ecdsa|ed25519)[\w.-]*|[\w.-]*credential[\w.-]*|[\w.-]*secret[\w.-]*|"
    r"[\w.-]+\.(pem|key|p12|pfx|jks|keystore|ppk)"
    r")($|[/:,])",
    re.I,
)


GLOB = re.compile(r"[*?\[\]]")


GLOB_STEMS = re.compile(r"env|ssh|aws|cred|secret|pem|key|token|pass|rc|cfg|conf|vars|history|id_|p12|pfx|tfstate|tfvars", re.I)


def check_sensitive(word, filter_value=False):
    if word.endswith((".env.example", ".env.sample", ".env.template")):
        return
    if GLOB.search(word) and not filter_value:
        # A quoted glob reaches grep, rg, find or git unexpanded. Refuse globs
        # for hidden files and globs that could match a credentials file.
        filled = GLOB.sub("x", word)
        if re.search(r"(^|[/=:,])\.", word) or GLOB_STEMS.search(word) or SENSITIVE.search(filled):
            raise Blocked(f"the pattern `{word}` could match a hidden or credentials file.")
    if SENSITIVE.search(word) or SENSITIVE.search(posixpath.normpath(word)):
        raise Blocked(f"`{word}` looks like a credentials file.")
    if re.search(r"//|/\./|/\.\.(/|$)", word):
        raise Blocked(f"`{word}` has // or /./ or /../ (URLs and unnormalized paths are not allowed).")
    if word.startswith("/proc") or "/proc/" in word:
        raise Blocked("reading /proc is not allowed.")
    if word.startswith("/dev/") and word != "/dev/null":
        raise Blocked("device files other than /dev/null are not allowed.")


# ---------------------------------------------------------------- commands

def opts(args):
    return [a for a in args if a.startswith("-") and a != "-"]


def pos(args):
    return [a for a in args if not a.startswith("-") or a == "-"]


def short_group(a, allowed):
    """-abc where every letter is in allowed."""
    return re.fullmatch(r"-[A-Za-z0-9]+", a) is not None and all(ch in allowed for ch in a[1:])


def only_opts(prog, args, allowed_long=(), allowed_short="", with_value=()):
    """Every option must be listed. with_value options may carry =value, a
    glued value (-n5) or take the next word. Long options must be spelled out
    (GNU abbreviations such as --ou are refused because they are not listed)."""
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--":
            return
        if a.startswith("-") and a != "-":
            name = a.split("=", 1)[0]
            if name in with_value:
                if "=" not in a:
                    i += 1
            elif prog in ("head", "tail") and re.fullmatch(r"-\d+", a):
                pass  # head -20
            elif any(len(v) == 2 and a.startswith(v) and len(a) > 2 for v in with_value):
                pass  # -n5, -d:, -k2,2
            elif name in allowed_long or short_group(a, allowed_short):
                pass
            else:
                raise Blocked(f"{prog} option {a} is not on the read-only list.")
        i += 1


def c_ls(a): only_opts("ls", a, ("--all", "--almost-all", "--human-readable", "--recursive", "--reverse", "--classify", "--group-directories-first", "--color"), "aAlhRrtSdF1iGUXpsn")
def c_cat(a): only_opts("cat", a, ("--number", "--show-all"), "nAbeEsTvu")
def c_head(a): only_opts("head", a, ("--quiet", "--silent"), "qv", ("-n", "-c", "--lines", "--bytes"))
def c_tail(a): only_opts("tail", a, ("--quiet",), "qvr", ("-n", "-c", "--lines", "--bytes"))
def c_wc(a): only_opts("wc", a, ("--lines", "--words", "--bytes", "--chars"), "lwcmL")
def c_cut(a): only_opts("cut", a, ("--complement", "--only-delimited"), "s", ("-d", "-f", "-c", "-b", "--delimiter", "--fields", "--characters", "--bytes"))
def c_tr(a): only_opts("tr", a, ("--delete", "--squeeze-repeats", "--complement"), "dscC")


def c_uniq(a):
    only_opts("uniq", a, ("--count", "--repeated", "--unique", "--ignore-case"), "cdui", ("-f", "-s", "-w"))
    if len(pos(a)) > 1:
        raise Blocked("uniq with a second file writes to it.")


def c_sort(a): only_opts("sort", a, ("--reverse", "--numeric-sort", "--unique", "--human-numeric-sort", "--ignore-case", "--version-sort", "--general-numeric-sort", "--month-sort", "--stable"), "rnuhfVgMbs", ("-k", "-t", "--key", "--field-separator"))
def c_grep(a): only_opts("grep", a, ("--recursive", "--ignore-case", "--line-number", "--count", "--files-with-matches", "--files-without-match", "--invert-match", "--word-regexp", "--extended-regexp", "--fixed-strings", "--only-matching", "--quiet", "--silent", "--no-messages", "--no-filename", "--with-filename"), "rRinclLvwEFoqshHIzx", ("-e", "-m", "-A", "-B", "-C", "--include", "--exclude", "--exclude-dir", "--max-count", "--color"))
def c_rg(a): only_opts("rg", a, ("--ignore-case", "--line-number", "--count", "--files-with-matches", "--files", "--hidden", "--no-ignore", "--fixed-strings", "--word-regexp", "--invert-match", "--only-matching", "--json", "--no-heading"), "inclvwFoSuL", ("-g", "-t", "-T", "-e", "-m", "-A", "-B", "-C", "--glob", "--type", "--max-count", "--color"))


def c_find(a):
    tests = {"-name", "-iname", "-path", "-ipath", "-type", "-maxdepth", "-mindepth", "-newer",
             "-mtime", "-mmin", "-size", "-empty", "-prune", "-print", "-print0", "-not", "-o",
             "-a", "-or", "-and", "-regex", "-iregex", "-wholename", "-perm", "-user", "-group", "-links"}
    for w in a:
        if w.startswith("-") and w not in tests:
            raise Blocked(f"find {w} is not on the read-only list (no -exec, -delete, -fprint).")


def c_jq(a):
    only_opts("jq", a, ("--raw-output", "--compact-output", "--slurp", "--null-input", "--exit-status", "--sort-keys", "--tab"), "rcsneSjM", ("--indent",))
    for w in a:
        if re.search(r"\$ENV|\benv\b|input_filename|\$__loc__|\$__prog", w):
            raise Blocked("jq programs that read the environment are not allowed.")


def c_date(a):
    for w in a:
        if not (w.startswith("+") or w in ("-u", "--utc", "-R", "--rfc-email")
                or re.fullmatch(r"-I\w*|--iso-8601(=\w+)?|--rfc-3339=\w+", w)):
            raise Blocked(f"date {w} is not allowed (only formats, -u, -I, -R).")


def c_ps(a):
    for w in a:
        if not w.startswith("-") and "e" in w:
            raise Blocked("ps with BSD 'e' shows process environments.")
        if w.startswith("-") and not short_group(w, "AaefFlouxwjp") and w not in ("--forest",):
            raise Blocked(f"ps {w} is not on the read-only list.")


def c_command(a):
    if not a or a[0] not in ("-v", "-V"):
        raise Blocked("`command` runs a program; only `command -v` is allowed.")


def c_any(a):
    pass



SIMPLE = {
    "ls": c_ls, "cat": c_cat, "head": c_head, "tail": c_tail, "wc": c_wc, "cut": c_cut,
    "tr": c_tr, "uniq": c_uniq, "sort": c_sort, "grep": c_grep, "egrep": c_grep,
    "fgrep": c_grep, "rg": c_rg, "find": c_find, "jq": c_jq, "date": c_date, "ps": c_ps,
    "command": c_command,
    "column": lambda a: only_opts("column", a, (), "tx", ("-s",)),
    "nl": lambda a: only_opts("nl", a, (), "", ("-b", "-n", "-w")),
    "stat": lambda a: only_opts("stat", a, (), "Lt", ("-c", "-f", "--format")),
    "du": lambda a: only_opts("du", a, ("--summarize", "--human-readable"), "shacxkm", ("-d", "--max-depth")),
    "df": lambda a: only_opts("df", a, ("--human-readable",), "hHkTPil"),
    "comm": lambda a: only_opts("comm", a, (), "123"),
    "diff": lambda a: only_opts("diff", a, ("--brief", "--recursive"), "uqrNbwBi", ("-U", "--unified")),
    "cmp": lambda a: only_opts("cmp", a, (), "sl"),
    "uname": lambda a: only_opts("uname", a, ("--all",), "asnrvmpio"),
    "which": lambda a: only_opts("which", a, (), "a"),
    "basename": c_any, "dirname": c_any, "realpath": c_any, "readlink": c_any,
    "md5sum": c_any, "sha256sum": c_any, "shasum": c_any, "pwd": c_any, "whoami": c_any,
    "id": c_any, "type": c_any, "test": c_any, "[": c_any, "echo": c_any,
    "true": c_any, "false": c_any, "exit": c_any,
}

GIT_READ = {"status", "log", "diff", "show", "blame", "ls-files", "ls-tree", "rev-parse",
            "describe", "shortlog", "cat-file", "rev-list", "merge-base", "name-rev",
            "for-each-ref", "count-objects", "check-ignore", "grep", "version"}
GIT_BAD = ("--output", "--ext-diff", "--exec", "--upload-pack", "--receive-pack",
           "--open-files-in-pager", "--textconv", "--filters", "--run")
GIT_LISTING = ("--list", "-l", "--contains", "--no-contains", "--merged", "--no-merged", "--points-at")


def check_git(args):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        a = args[i]
        if a in ("--no-pager", "-P", "--no-optional-locks"):
            i += 1
            continue
        if a == "--version" and i == len(args) - 1:
            return
        raise Blocked(f"git option {a} is not allowed (-c, -C and --git-dir can make git run programs from another config).")
    if i >= len(args):
        return
    sub, rest = args[i], args[i + 1:]
    for a in rest:
        name = a.split("=", 1)[0]
        # also refuse GNU-style abbreviations of the dangerous long options
        abbrev = len(name) >= 4 and name.startswith("--") and any(b.startswith(name) for b in GIT_BAD)
        o_bundle = sub == "grep" and re.fullmatch(r"-[A-Za-z0-9]*O.*", a)
        if sub == "grep" and name in ("--no-index", "--untracked"):
            raise Blocked(f"git grep {name} searches files outside the repository index.")
        if a.startswith((":(", ":!", ":^", ":/")):
            raise Blocked("git pathspec magic is not allowed.")
        if name in GIT_BAD or abbrev or o_bundle:
            raise Blocked(f"git {sub} {a} can write files or run a program.")
    if sub in GIT_READ:
        return
    if sub in ("branch", "tag"):
        for a in opts(rest):
            name = a.split("=", 1)[0]
            ok = name in GIT_LISTING + ("--sort", "--format", "--color", "--no-color", "--column",
                                        "--show-current", "--all", "--remotes", "--verbose", "-n")
            if sub == "branch":
                ok = ok or short_group(a, "arv")
            if not ok:
                raise Blocked(f"git {sub} {a} is not a listing option.")
        listing = any(a.split("=", 1)[0] in GIT_LISTING for a in rest)
        if pos(rest) and not listing:
            raise Blocked(f"git {sub} with a name creates a {sub}.")
        return
    exact = {
        "remote": [[], ["-v"], ["--verbose"]],
        "stash": [["list"]], "worktree": [["list"]], "submodule": [["status"]],
        "reflog": [[]],
    }
    if sub in exact and rest in exact[sub]:
        return
    if sub == "remote" and len(rest) == 2 and rest[0] == "get-url":
        return
    if sub == "stash" and rest[:1] == ["show"] and all(not a.startswith("-") or a in ("-p", "--stat") for a in rest[1:]):
        return
    if sub == "config" and len(rest) == 2 and rest[0] in ("--get", "--get-all") and re.fullmatch(
            r"user\.(name|email)|remote\.[\w.-]+\.url|branch\.[\w./-]+\.(remote|merge)|init\.defaultBranch|core\.bare", rest[1]):
        return
    raise Blocked(f"git {' '.join([sub] + rest[:1])} is not on the read-only list.")


GH_READS = {
    "pr": {"view", "list", "status", "diff", "checks"},
    "issue": {"view", "list", "status"},
    "run": {"view", "list"},
    "release": {"view", "list"},
    "workflow": {"view", "list"},
    "repo": {"view"},
    "label": {"list"},
}


def check_gh_filters(args):
    """gh's built-in jq and templates can read the environment (env.GH_TOKEN)."""
    for j, a in enumerate(args):
        name, _, val = a.partition("=")
        if name in ("--jq", "-q", "--template", "-t"):
            val = val or (args[j + 1] if j + 1 < len(args) else "")
        elif a.startswith(("-q", "-t")) and len(a) > 2:
            val = a[2:]
        else:
            continue
        if re.search(r"\$ENV|\benv\b|input_filename|\$__loc__|getenv", val, re.I):
            raise Blocked("gh --jq or --template that reads the environment is not allowed.")


def check_gh(args):
    if args == ["--version"]:
        return
    if args[:1] == ["api"]:
        rest = args[1:]
        only_opts("gh api", rest, ("--paginate", "--slurp"), "", ("--jq", "-q", "--template", "-t", "--cache"))
        check_gh_filters(rest)
        # endpoint = the one word that is not an option or an option's value
        values = {rest[j + 1] for j, a in enumerate(rest[:-1]) if a in ("--jq", "-q", "--template", "-t", "--cache")}
        endpoints = [a for a in pos(rest) if a not in values]
        if len(endpoints) != 1:
            raise Blocked("gh api takes exactly one endpoint here.")
        if not re.fullmatch(r"/?[A-Za-z0-9_.{}-]+(/[A-Za-z0-9_.{}-]+)*/?(\?[A-Za-z0-9_.=&%-]*)?", endpoints[0]):
            raise Blocked("gh api takes a GitHub API path here, not a URL or host.")
        return
    if len(args) >= 2 and args[1] in GH_READS.get(args[0], set()):
        rest = args[2:]
        # No short-option bundles, no --repo/-R (another host), no --web.
        only_opts(f"gh {args[0]} {args[1]}", rest,
                  ("--comments", "--name-only", "--patch", "--required", "--log", "--log-failed",
                   "--verbose", "--exit-status", "--draft"),
                  "",
                  ("--json", "--jq", "-q", "--template", "-t", "--limit", "-L", "--state", "-s",
                   "--label", "-l", "--author", "-A", "--assignee", "-a", "--base", "-B",
                   "--head", "-H", "--search", "-S", "--branch", "-b", "--job", "-j",
                   "--attempt", "--color", "--milestone", "-m"))
        check_gh_filters(rest)
        for a in pos(rest):
            if ":" in a or a.count("/") > 1:
                raise Blocked(f"gh argument `{a}` names another host; use OWNER/REPO, a number or a branch.")
        return
    raise Blocked(f"gh {' '.join(args[:2])} is not a read-only gh command.")


def check_kubectl(args):
    if any(a.split("=", 1)[0] in ("--kubeconfig", "--server", "-s", "--context", "--cluster",
                                  "--token", "--user", "--as", "--as-group", "--certificate-authority",
                                  "--client-certificate", "--client-key") for a in args):
        raise Blocked("kubectl options that pick another cluster, config or identity are not allowed.")
    joined = " ".join(args).lower()
    if any(s in joined for s in ("secret", "configmap", "--raw", "%", "token")) or re.search(r"(^|\s|,)cm(\s|,|/|$)", joined):
        raise Blocked("kubectl commands that can show secrets are not allowed.")
    for i, a in enumerate(args):
        out = None
        if a.startswith(("-o=", "--output=")):
            out = a.split("=", 1)[1]
        elif a in ("-o", "--output"):
            out = args[i + 1] if i + 1 < len(args) else ""
        elif a.startswith("-o"):
            out = a[2:]
        if out is not None and out not in ("wide", "name"):
            raise Blocked("kubectl -o is allowed only as wide or name (yaml and json show env values).")
    only_opts("kubectl", args, ("--all-namespaces", "--show-labels", "--no-headers", "--client",
                                 "--namespaced"),
              "A", ("-n", "--namespace", "-o", "--output", "-l", "--selector", "--field-selector",
                    "--sort-by", "-L", "--label-columns"))
    if args[:1] in (["get"], ["cluster-info"], ["api-resources"], ["api-versions"], ["version"]):
        return
    if args[:2] in (["config", "current-context"], ["config", "get-contexts"]):
        return
    raise Blocked(f"kubectl {' '.join(args[:1])} is not on the read-only list.")


VERSION_FORMS = {
    "node": (["--version"], ["-v"]), "npm": (["--version"], ["-v"]),
    "python": (["--version"], ["-V"]), "python3": (["--version"], ["-V"]),
    "pip": (["--version"], ["-V"]), "pip3": (["--version"], ["-V"]),
    "go": (["version"],), "docker": (["--version"], ["-v"]), "ruby": (["--version"], ["-v"]),
    "java": (["--version"], ["-version"]), "bash": (["--version"],), "zsh": (["--version"],),
}


def check_tool(prog, args):
    if args in VERSION_FORMS.get(prog, ()):
        return
    if prog == "npm" and args[:1] in (["ls"], ["list"]):
        only_opts(prog, args[1:], ("--prod", "--production", "--dev", "--all", "--json", "--long", "--parseable"), "al", ("--depth",))
        return
    if prog in ("pip", "pip3") and args[:1] in (["list"], ["show"], ["freeze"]):
        only_opts(prog, args[1:], ("--local", "--user", "--not-required", "--all", "--format"), "l", ("--format",))
        return
    if prog == "docker":
        if any(a.split("=", 1)[0] in ("-H", "--host", "--config", "--context", "-c") for a in args):
            raise Blocked("docker -H, --host, --config and --context select another daemon or config.")
        if args[:1] in (["ps"], ["images"], ["info"], ["version"]):
            return
        if args == ["compose", "version"]:
            return
    if prog == "kubectl":
        check_kubectl(args)
        return
    raise Blocked(f"{' '.join([prog] + args[:1])} is not a version or listing command.")


# Tools that pass only as a version check (VERSION_FORMS) or a listing in
# check_tool. Interpreters never run anything else: `python3 version` would run
# a file. Tools whose --version reads project files and can run code from them
# (yarn's yarnPath, corepack-pinned pnpm, rust-toolchain.toml, .mvn/jvm.config,
# gradle wrappers, make) are not here at all.
TOOLS = set(VERSION_FORMS) | {"kubectl"}


def filter_positions(prog, args):
    """Indexes of args that are jq programs or gh --jq/--template values, not paths."""
    if prog == "jq":
        for j, a in enumerate(args):
            if not a.startswith("-"):
                return {j}
        return set()
    if prog == "gh":
        return {j + 1 for j, a in enumerate(args) if a in ("--jq", "-q", "--template", "-t")}
    return set()


def check_command(words):
    prog, args = words[0], words[1:]
    check_sensitive(prog)
    filters = filter_positions(prog, args)
    for j, w in enumerate(args):
        check_sensitive(w, j in filters)
    if "=" in prog:
        raise Blocked("environment assignments before a command are not allowed.")
    if "/" in prog:
        raise Blocked(f"`{prog}` is a path, not a command name.")
    if prog in SIMPLE:
        if args == ["--version"]:
            return
        SIMPLE[prog](args)
    elif prog == "git":
        check_git(args)
    elif prog == "gh":
        check_gh(args)
    elif prog in TOOLS:
        check_tool(prog, args)
    else:
        raise Blocked(f"`{prog}` is not on the read-only list.")


def check(command):
    if "\r" in command:
        raise Blocked("carriage returns are not allowed.")
    tokens = tokenize(command)
    words = []
    i = 0
    while i < len(tokens):
        kind, t = tokens[i]
        if kind == "word":
            words.append(t)
        elif t in (">", ">>", "&>"):
            if i + 1 >= len(tokens) or tokens[i + 1] != ("word", "/dev/null"):
                raise Blocked("output redirection is allowed only to /dev/null.")
            i += 1
        elif t in DUPS:
            pass
        else:  # a separator: ; && || | |& & ( ) newline ;;
            if words:
                check_command(words)
            words = []
        i += 1
    if words:
        check_command(words)


def allowed_by_config(command):
    try:
        with open(CONFIG, encoding="utf-8") as f:
            data = json.load(f)
        return command.strip() in {str(c).strip() for c in data.get("allowCommands", [])}
    except Exception:
        return False  # a missing or broken config never widens the policy


def main():
    try:
        data = json.load(sys.stdin)
        command = str((data.get("tool_input") or {}).get("command") or "")
        skill = str(data.get("command_name") or "")
        source = str(data.get("command_source") or "")
        tool = str(data.get("tool_name") or "Bash")
    except Exception:
        block("the hook input could not be read.")
        return
    if source in TRUSTED_SOURCES:
        sys.exit(0)
    if allowed_by_config(command):
        sys.exit(0)
    if tool != "Bash":
        block(f"{tool} commands are not checked by this hook, so they are blocked.", skill)
    try:
        if command.strip():
            check(command)
    except Blocked as b:
        block(str(b), skill)
    except Exception as e:  # a bug: fail closed
        block(f"the command could not be checked ({type(e).__name__}).", skill)
    sys.exit(0)


if __name__ == "__main__":
    main()
