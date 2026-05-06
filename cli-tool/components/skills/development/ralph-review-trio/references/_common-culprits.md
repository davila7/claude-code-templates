# Ralph Review — Shared 5-Culprits Reference

> **Architectural design**: Each Ralph tier scans for the same five patterns at *increasing depth*. The depth-layering is intentional. This file holds the shared framing so the category numbers and names stay in sync; each tier file keeps its own depth-appropriate bullets.

## The 5 Categories

Each tier checks these patterns. Bullets in the per-tier files differ by depth, not by category.

| # | Category | Surface (Haiku) | Logic (Sonnet) | Architectural (Opus) |
|---|---|---|---|---|
| 1 | Duplicate Code (DRY / Modularity) | Visible copy-paste | Same logic in N files | Same pattern implemented differently |
| 2 | On-the-fly Calculations (Hardcoded Settings) | Magic numbers in calculations | Inline business formulas | Calculation constants varying by env |
| 3 | Hardcoded Settings | Embedded URLs / paths / credentials | Multipliers, percentages, timeouts | User-configurable values in code |
| 4 | Obsolete / Dead Code (LMCE) | Commented-out blocks, dead TODOs | Never-called functions, unused imports | Modules never instantiated, dead endpoints |
| 5 | Silent Fallbacks (Fail Fast) | `catch{}` swallow, `\|\| default` | `.get(k, {})` chains, `try / except: pass` | Cascading defaults masking root cause |

## Tier Files

- `haiku-checklist.md` — surface checks
- `sonnet-checklist.md` — logic-trace checks
- `opus-checklist.md` — architectural checks

## Rule

Tier-specific bullet content lives in the tier files. The category numbers / names live here — change them once, propagate by re-reading.
