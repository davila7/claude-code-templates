# Claude Code adapter

## Invocation
Standalone skill: `/feedback`.

This repository loaded as a Claude Code plugin: `/feedback-loop:feedback`. Plugin skill commands are namespaced.

Claude Code exposes installed skills as slash commands.

## Surfaces
Potential skills: `.claude/skills/feedback/SKILL.md`, `~/.claude/skills/feedback/SKILL.md`, or plugin `skills/feedback/SKILL.md`.

Potential durable guidance: managed organization policy, project `CLAUDE.md` or `.claude/CLAUDE.md`, `.claude/rules/`, user `~/.claude/CLAUDE.md`, local `CLAUDE.local.md`, and Claude Code auto memory. Use only verified active surfaces and respect instruction precedence/project trust.

## Routing
- Reusable workflow → skill.
- Repository-wide mandatory behavior → narrowest project `CLAUDE.md` or rule.
- User-wide authored preference → user `CLAUDE.md` when explicitly wanted.
- Agent-discovered local learning → auto memory only when it is the right owner.
- Architecture/decision/runbook → project docs, not auto memory.

## Guardrails
No feedback-turn edits. Do not write the same rule to every surface. Auto memory does not replace mandatory human-authored policy. Scope path rules narrowly. Report command/name conflicts instead of claiming `/feedback` is active.
