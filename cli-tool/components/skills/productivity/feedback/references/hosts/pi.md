# Pi adapter

## Invocation
Native: `/skill:feedback`. This package also ships `prompts/feedback.md`, exposing an interactive `/feedback` template and passing arguments through.

## Surfaces
Pi loads skills from user `~/.pi/agent/skills/` and `~/.agents/skills/`, project `.pi/skills/` and `.agents/skills/`, packages, and configured/CLI paths. It loads project context such as `AGENTS.md` and `CLAUDE.md` according to its resource loader and project boundaries. Resumable sessions are evidence, not by themselves a preference-memory API.

## Routing
- Reusable workflow → skill.
- Repository behavior → scoped `AGENTS.md` or `CLAUDE.md` already used by the project.
- Architecture/decision/runbook → project docs.
- Personal cross-project preference → user context instruction only when explicitly wanted.
- Session-specific observation → current session only.

## Guardrails
No feedback-turn edits. Do not claim a generic writable preference-memory API unless the installation exposes one. Do not equate session persistence with cross-project learning. Prefer shared `~/.agents/skills` for Pi + Codex. This package intentionally ships no Pi extension code.
