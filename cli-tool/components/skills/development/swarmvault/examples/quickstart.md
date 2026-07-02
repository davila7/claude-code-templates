# Quickstart Example

Use this when the user needs the shortest path from install to a working vault.

## Commands

```bash
npm install -g @swarmvaultai/cli
swarmvault demo --no-serve
swarmvault init --obsidian
swarmvault scan ./repo --no-serve
swarmvault source add https://github.com/karpathy/micrograd
swarmvault diff
swarmvault graph blast ./src/index.ts
swarmvault query "What are the key concepts?"
swarmvault graph serve
swarmvault graph export --report ./graph-report.html
```

## What To Check

- `swarmvault.schema.md` exists and reflects the vault contract
- `demo --no-serve` leaves a temporary compiled vault behind even on a clean machine
- `scan --no-serve` leaves a compiled vault behind even when the viewer is not launched
- `state/sources.json` contains the managed source registry entry
- `wiki/graph/report.md` exists after compile
- `graph export --report` writes a shareable HTML report when the user wants a lighter artifact than the full workspace
- `wiki/outputs/source-briefs/` contains a source brief
- `wiki/outputs/` contains the saved query answer
- `state/graph.json` and `state/search.sqlite` exist

## Guidance

- If the answer quality is weak, check whether the vault is still on the `heuristic` provider.
- If the user is unsure what changed, point them at `wiki/` and `state/` before suggesting another compile.
- When the vault lives in git, `swarmvault diff` is the quickest graph-level summary of what the last compile changed.
