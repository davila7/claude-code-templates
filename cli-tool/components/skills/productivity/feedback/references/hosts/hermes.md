# Hermes Agent adapter

## Invocation
`/feedback`

## Evidence surfaces
When available and relevant: current conversation/tool results, targeted `session_search`, `skill_view`, trusted profile rules, compact `memory`, structured `fact_store`, configured knowledge vault/project docs, and live repository evidence.

## Routing
- Reusable procedure → existing/new Hermes skill.
- Stable preference/fact → compact memory when appropriate.
- Deep compositional fact → structured fact store when configured.
- Project decision/runbook/context → vault or repository docs.
- Remaining execution → normal TODO/Kanban.
- Persona/host behavior → trusted profile instructions, not task memory.

## Guardrails
The feedback turn is read-only. Do not modify another profile without an explicit target. Do not duplicate one lesson across memory, facts, skills, and docs “for safety.” Accessible live sources outrank remembered conversation claims. After approval, use native tools and verify writes plus behavior.
