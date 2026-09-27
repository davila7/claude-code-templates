---
name: since-cutoff
description: Check which of this project's Python dependencies changed their API after the model's training cutoff, measure which of those changes the model actually gets wrong, and write short, verified notes into AGENTS.md or CLAUDE.md. Use when the user asks whether the model knows their library versions, when code keeps failing on renamed or removed library APIs, or after upgrading dependencies.
version: 0.3.0
author: Mohammad Hijjawi
license: MIT
repo: https://github.com/MohammadHijjawi97/since-cutoff
tags: [Python, Dependencies, API Changes, Knowledge Cutoff, AGENTS.md, Static Analysis]
argument-hint: "[scan | run] [--apply] [--quick] [--model provider:model]"
allowed-tools: Bash(since-cutoff scan:*), Bash(since-cutoff run:*), Bash(since-cutoff models:*), Bash(uvx since-cutoff:*), Bash(pipx run since-cutoff:*), Read
compatibility: Needs since-cutoff on PATH, or uv or pipx to run it, and network access to PyPI. `run` also needs model access (the claude CLI or a provider API key); `scan` makes no model calls.
---

# since-cutoff

`since-cutoff` is a command-line tool. It does the measuring itself by calling a fresh copy of
the model with no tools and no project context, so **do not answer the probe tasks yourself and
do not guess results**. Run the tool and report what it prints.

## Steps

1. Work from the project root (the directory with `pyproject.toml`, `requirements.txt` or a lockfile).
2. Pick the command. Use `$ARGUMENTS` if the user gave any; otherwise:
   - quick look, no model calls: `since-cutoff scan`
   - full measurement with verified notes: `since-cutoff run --quick`
3. Name the model. Without `--model`, the tool tests the model your coding agent is set up with
   (`SINCE_CUTOFF_MODEL`; inside Claude Code, only Claude Code's settings; elsewhere the Claude
   Code, Codex, OpenCode and Aider settings, the project's before the user's) and says where
   it read it ("model from ..."). If that is not the model you are, or it warns that no model
   setting was found, add `--model <provider>:<model>` for the model you are (for example
   `--model openai:gpt-5.4`, or `--model claude-code:<model>` for a model picked with
   `/model`). `run` calls Claude Code models through the `claude` CLI and other models through
   their provider's API key.
4. Before `run`, tell the user that it sends prompts (package names, versions, public API
   signatures and generated tasks, never their source code) to the model provider they choose,
   uses their API credits or Claude Code usage, and can take 5-20 minutes. Wait for a yes.
   `scan` needs no confirmation.
5. Run it. If `since-cutoff` is not installed, use `uvx since-cutoff <args>` (or
   `pipx run since-cutoff <args>`). Start `run` in the background or with a long timeout, not a
   2-minute foreground call. Everything is cached, so re-running after an interruption resumes
   quickly.
6. Summarise the result card: the model and its training cutoff, how many dependencies changed
   after the cutoff, what was stale, and the held-out before/after numbers. Quote each interval
   with the number it belongs to: the bootstrap CI goes with the difference of the task-level
   rates, the other CI with "changes fixed: X of Y". If the run compared baseline notes
   (`--compare`), give each block's "changes fixed" with its CI, and call one block better
   only when report.md's head-to-head sign test for it has a small p-value.
7. Only write notes into the user's files if they asked for it: re-run with `--apply` (it writes
   a marked block into AGENTS.md, or CLAUDE.md if that is the file the project uses).
   `since-cutoff unapply` removes the block again.
8. The notes in that block are API reference facts about the versions the project pins: what
   was removed, renamed or deprecated after your training data. Check them when you write code
   that uses those libraries.

The full report is written to `.since-cutoff/report.md`; read it when the user wants details.

## If something fails

- No lockfile or pinned versions found: tell the user which file the tool asked for; do not
  invent versions.
- A model or login error during `run`: report the message and offer `scan`, which makes no
  model calls.

## Quick lookups without a run

If the since-cutoff MCP server is configured (the `devtools/since-cutoff` MCP component, or
`claude mcp add since-cutoff -- uvx since-cutoff@latest mcp`), it answers from a static diff with
no model calls: `api_changes` (one package, optionally one `symbol`), `project_changes` (every
dependency of the project) and `model_cutoff`. Pass your own model id as `model`. Use them before
writing code against a dependency that may be newer than your training data; use the CLI above
when the user wants the model measured or notes written.

Source, documentation and results: https://github.com/MohammadHijjawi97/since-cutoff (MIT).
