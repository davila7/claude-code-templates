# Routing and review policy

Optimize accepted work per Claude token. While the user keeps a ChatGPT plan, Codex is the default implementer; login failures/exhaustion do not cancel that preference. Only the user changes it. The [full workflow](../SKILL.md) owns assignments, parallel workers, token discipline, capacity and fallback rules.

Claude leads requirements, bounded investigation, design, review, acceptance and authorized integration. Codex implements/tests/fixes; Grok takes that role under the linked fallback rule. Advice/read-only work stays in Claude; Claude implements directly only by user preference.

| Change | Preparation and acceptance |
| --- | --- |
| Simple/local | Compact scope; diff plus bridge validation suffice. |
| Moderate | Resolve interfaces; check affected call paths and regression evidence. |
| Complex/ambiguous | Settle material design questions; split verifiable boundaries; review integration/assumptions. |
| High consequence | Name security, integrity, concurrency, migration or architecture failure scenarios; add one independent read-only Claude review when it addresses the risk. |

Claude helpers require a concrete independence/parallelism benefit and minimum context; size alone does not justify planners or sequence-only reviewers. At most two independent read-only Claude helpers at once; this limit does not cap Codex workers. Every writing assignment needs lead acceptance.
