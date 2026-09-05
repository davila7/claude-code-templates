#!/usr/bin/env python3
"""
Worktree Context Statusline for Claude Code

Displays: project | branch (worktree-aware) | model | context usage

- In a linked git worktree the folder segment shows the main project name
  (resolved via `git worktree list`, so bare repositories and external git
  dirs are handled) instead of the worktree directory, which usually mirrors
  the branch, and the branch is marked with the worktree glyph (U+2442).
- Context usage comes straight from the `context_window` object Claude Code
  passes on stdin: real window size (200k or 1M for extended-context models)
  and the pre-calculated `used_percentage` (input tokens only).

Example output:
  📁 my-project | 🌿 main | 🤖 Fable 5.1 | 🟢 15% (156k/1M)
  📁 my-project | ⑂ feat/auth | 🤖 Fable 5.1 | 🟡 72% (720k/1M)
"""

import json
import os
import subprocess
import sys


def run_git(cwd, *args):
    """Run a git command in cwd and return stripped stdout, or None on failure."""
    try:
        out = subprocess.check_output(
            ["git", "-C", cwd, *args], stderr=subprocess.DEVNULL, timeout=2
        )
        return out.decode("utf-8", errors="replace").strip()
    except Exception:
        return None


def get_main_worktree(cwd):
    """Return the main worktree path from `git worktree list --porcelain`.

    The first entry is always the main worktree. For a bare repository it is
    the bare git dir itself (flagged with a `bare` line), in which case there
    is no meaningful project checkout to name, so None is returned.
    """
    out = run_git(cwd, "worktree", "list", "--porcelain")
    if not out:
        return None
    first = out.split("\n\n", 1)[0].splitlines()
    if not first or not first[0].startswith("worktree "):
        return None
    if any(line.strip() == "bare" for line in first):
        return None
    return first[0][len("worktree "):].strip() or None


def get_git_info(current_dir):
    """Return (folder_override, git_segment). folder_override is None when
    not in a linked worktree."""
    if not current_dir or run_git(current_dir, "rev-parse", "--is-inside-work-tree") != "true":
        return None, ""

    branch = run_git(current_dir, "symbolic-ref", "--short", "HEAD") or run_git(
        current_dir, "rev-parse", "--short", "HEAD"
    )
    if not branch:
        return None, ""

    git_dir = run_git(current_dir, "rev-parse", "--git-dir")
    common_dir = run_git(current_dir, "rev-parse", "--git-common-dir")

    if git_dir and common_dir and git_dir != common_dir:
        # Linked worktree: ask git for the main checkout instead of assuming
        # the common dir lives at <main-checkout>/.git (bare repos and
        # external git dirs break that assumption).
        main_root = get_main_worktree(current_dir)
        if main_root:
            return os.path.basename(main_root.rstrip(os.sep)), f"⑂ {branch}"
        return None, f"⑂ {branch}"

    return None, f"🌿 {branch}"


def fmt_tokens(n):
    """Format a token count as 156k or 1M / 1.2M."""
    if n >= 1_000_000:
        m = n / 1_000_000
        return f"{m:.0f}M" if m == int(m) else f"{m:.1f}M"
    return f"{n // 1000}k"


def get_context_display(context_window):
    """Build the context segment from Claude Code's context_window object."""
    if not context_window:
        return ""

    size = context_window.get("context_window_size")
    pct = context_window.get("used_percentage")
    used = context_window.get("total_input_tokens") or 0

    # used_percentage is null before the first API call and right after /compact
    if not size or pct is None:
        return ""

    pct = int(pct)
    icon = "🔴" if pct >= 90 else "🟡" if pct >= 70 else "🟢"
    return f"{icon} {pct}% ({fmt_tokens(used)}/{fmt_tokens(size)})"


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    workspace = data.get("workspace") or {}
    current_dir = workspace.get("current_dir") or os.getcwd()
    model_name = (data.get("model") or {}).get("display_name") or "Claude"

    folder = os.path.basename(current_dir.rstrip(os.sep)) or current_dir
    folder_override, git_segment = get_git_info(current_dir)
    if folder_override:
        folder = folder_override

    parts = [f"📁 {folder}"]
    if git_segment:
        parts.append(git_segment)
    parts.append(f"🤖 {model_name}")

    context = get_context_display(data.get("context_window"))
    if context:
        parts.append(context)

    print(" | ".join(parts), end="")


if __name__ == "__main__":
    main()
