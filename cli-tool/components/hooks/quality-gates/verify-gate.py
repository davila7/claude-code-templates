#!/usr/bin/env python3
# verify-gate.py - Claude cannot finish a turn while your tests fail
# Source: https://github.com/elijahmanlockedin112/verify-gate-hook
# License: MIT
"""
verify-gate.py - Claude Code Stop hook. Claude cannot finish a turn until
your verification command passes.

Where the command comes from (first match wins; never guessed):
  1. env var LOCKED_IN_VERIFY
  2. first non-blank, non-# line of $CLAUDE_PROJECT_DIR/.claude/verify.txt
If neither exists, the hook does nothing.

Behavior:
  - Skips if the project is a git repo with no uncommitted changes, or if
    nothing has changed since the last passing run (cached per project).
    Outside git it always runs.
  - Runs the command (shell=True, cwd = project dir). On failure, exits 2 and
    sends the last 40 lines of output to Claude with an instruction to fix
    the failures, so Claude keeps working instead of stopping.
  - Loop safety: after 4 consecutive blocks it lets Claude stop (Claude Code
    itself gives up after 8). Runtime is capped at LOCKED_IN_VERIFY_TIMEOUT
    seconds (default 300); a timeout counts as a failure. The whole process
    tree is killed on timeout.
  - Any unexpected error -> exit 0. This hook never breaks a session.

Standard library only. Windows, macOS, Linux.
"""

import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import tempfile

MAX_BLOCKS = 4
TAIL_LINES = 40
DEFAULT_TIMEOUT = 300
ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


def note(msg):
    sys.stderr.write("verify-gate: %s\n" % msg)


def read_input():
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig", errors="replace")
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def get_command(project):
    env_cmd = os.environ.get("LOCKED_IN_VERIFY", "").strip()
    if env_cmd:
        return env_cmd
    path = os.path.join(project, ".claude", "verify.txt")
    try:
        with open(path, encoding="utf-8-sig") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line
    except OSError:
        pass
    return None


def git(args, cwd):
    try:
        r = subprocess.run(["git"] + args, cwd=cwd, capture_output=True,
                           timeout=20, stdin=subprocess.DEVNULL)
        return r.returncode, r.stdout
    except Exception:
        return None, b""


def worktree_fingerprint(project, command):
    """Return (is_git, is_clean, fingerprint of the current working tree)."""
    code, status = git(["status", "--porcelain", "-uall"], project)
    if code != 0:
        return False, False, None
    if not status.strip():
        return True, True, None
    h = hashlib.sha256(command.encode("utf-8"))
    h.update(status)
    code, diff = git(["diff", "HEAD", "--binary"], project)
    if code != 0:  # no commits yet
        _, d1 = git(["diff", "--binary"], project)
        _, d2 = git(["diff", "--cached", "--binary"], project)
        diff = d1 + d2
    h.update(diff)
    _, untracked = git(["ls-files", "--others", "--exclude-standard", "-z"], project)
    for rel in untracked.split(b"\0"):
        if not rel:
            continue
        try:
            st = os.stat(os.path.join(project, rel.decode("utf-8", "replace")))
            h.update(rel + str((st.st_size, st.st_mtime_ns)).encode())
        except OSError:
            h.update(rel)
    return True, False, h.hexdigest()


def state_path(project):
    key = hashlib.sha256(os.path.abspath(project).lower().encode("utf-8")).hexdigest()[:16]
    return os.path.join(tempfile.gettempdir(), "claude-verify-gate-%s.json" % key)


def load_state(project):
    try:
        with open(state_path(project), encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_state(project, state):
    try:
        with open(state_path(project), "w", encoding="utf-8") as fh:
            json.dump(state, fh)
    except Exception:
        pass


def kill_tree(proc):
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           capture_output=True, timeout=15)
        else:
            os.killpg(proc.pid, signal.SIGKILL)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def run_command(command, project, timeout):
    """Return (exit_code or None on timeout, combined output text)."""
    with tempfile.TemporaryFile() as out:
        kwargs = dict(shell=True, cwd=project, stdout=out, stderr=subprocess.STDOUT,
                      stdin=subprocess.DEVNULL)
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        proc = subprocess.Popen(command, **kwargs)
        try:
            code = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            kill_tree(proc)
            try:
                proc.wait(timeout=10)
            except Exception:
                pass
            code = None
        out.seek(0)
        text = out.read().decode("utf-8", errors="replace")
    return code, ANSI.sub("", text).replace("\r\n", "\n")


def tail(text, n):
    lines = [l.rstrip() for l in text.rstrip().split("\n")]
    if len(lines) > n:
        return "... (%d earlier lines omitted)\n" % (len(lines) - n) + "\n".join(lines[-n:])
    return "\n".join(lines) or "(no output)"


def main():
    data = read_input()
    project = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    command = get_command(project)
    if not command:
        return 0

    session = data.get("session_id") or ""
    state = load_state(project)
    own_blocks = state.get("blocks", 0) if state.get("session") == session else 0
    try:
        reported = int(data.get("consecutive_blocks") or 0)
    except (TypeError, ValueError):
        reported = 0
    blocks = max(reported, own_blocks)

    if blocks >= MAX_BLOCKS:
        note("verification still failing after %d attempts; letting Claude stop. "
             "Run `%s` yourself to see the failures." % (blocks, command))
        state.update(session=session, blocks=0)
        save_state(project, state)
        return 0

    is_git, is_clean, fingerprint = worktree_fingerprint(project, command)
    if is_git and is_clean:
        return 0
    if fingerprint and fingerprint == state.get("passed"):
        return 0  # nothing changed since the last passing run

    try:
        timeout = int(os.environ.get("LOCKED_IN_VERIFY_TIMEOUT", DEFAULT_TIMEOUT))
    except ValueError:
        timeout = DEFAULT_TIMEOUT

    code, output = run_command(command, project, timeout)

    if code == 0:
        state.update(session=session, blocks=0, passed=fingerprint)
        save_state(project, state)
        return 0

    state.update(session=session, blocks=blocks + 1, passed=None)
    save_state(project, state)
    if code is None:
        headline = "verification TIMED OUT after %ds: %s" % (timeout, command)
        extra = ("If the command hangs (watch mode, dev server, prompt), make it "
                 "non-interactive. If it is just slow, tell the user to raise "
                 "LOCKED_IN_VERIFY_TIMEOUT.")
    else:
        headline = "verification FAILED (exit %s): %s" % (code, command)
        extra = ""
    sys.stderr.write(
        "verify-gate: %s\n"
        "----- last %d lines of output -----\n%s\n"
        "-----------------------------------\n"
        "Fix the failures above, then finish. Do not weaken or skip tests.%s\n"
        "(verify-gate attempt %d of %d)\n"
        % (headline, TAIL_LINES, tail(output, TAIL_LINES),
           (" " + extra) if extra else "", blocks + 1, MAX_BLOCKS)
    )
    return 2


if __name__ == "__main__":
    try:
        rc = main()
    except Exception as exc:  # never break the session
        try:
            note("internal error (%s); allowing stop." % exc)
        except Exception:
            pass
        rc = 0
    sys.exit(rc)
