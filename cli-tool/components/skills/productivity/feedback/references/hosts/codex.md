# OpenAI Codex adapter

## Invocation
Use `$feedback` explicitly. `/skills` can inspect available skills in Codex clients that expose it.

## Surfaces
Potential skills include repository `.agents/skills/feedback/SKILL.md`, user `~/.agents/skills/feedback/SKILL.md`, and configured roots. Repository guidance belongs in `AGENTS.md`; Codex builds an instruction chain from Codex home through the project, with more specific files closer to the working directory taking precedence.

Local memories under `~/.codex/memories/` are generated state used to improve later work, not the primary surface for mandatory human-authored policy.

## Routing
- Reusable workflow → Agent Skill.
- Mandatory repository behavior → narrowest applicable `AGENTS.md`.
- Architecture/decision/runbook → checked-in docs.
- Stable user guidance → user-level `AGENTS.md` or explicit configuration.
- Generated-memory issue → supported lifecycle/configuration or move mandatory guidance to `AGENTS.md`; do not casually hand-edit generated memory files.

## Guardrails
No feedback-turn edits. Preserve `AGENTS.md` scope/precedence. Do not claim Codex remembered because the current session acknowledged something. Treat generated memory as implementation state, not a public incident log.
