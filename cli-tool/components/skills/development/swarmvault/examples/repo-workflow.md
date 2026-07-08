# Repo Workflow Example

Use this when the user wants to compile a codebase into durable module pages, graph artifacts, and reviewable outputs.

## Commands

```bash
swarmvault init --obsidian
swarmvault source add https://github.com/karpathy/micrograd
swarmvault compile --approve
swarmvault diff
swarmvault review list
swarmvault review show <approval-id> --diff
swarmvault review accept <approval-id>
swarmvault query "What is the auth flow?"
swarmvault graph serve
```

## What To Check

- `wiki/code/` contains module pages
- `wiki/outputs/source-briefs/` contains a repo onboarding brief
- `state/code-index.json` exists for repo-aware symbol/import resolution
- `swarmvault diff` reflects the graph-level additions and removals when the vault is inside git
- `state/approvals/` contains staged review bundles when `--approve` is used
- `wiki/graph/report.md` highlights the important modules, bridge nodes, and contradictions

## Guidance

- Prefer reading `wiki/graph/report.md` and the relevant `wiki/code/*.md` pages before broad grep.
- If organization is wrong, update `swarmvault.schema.md` first instead of hand-editing generated pages.
- Use `swarmvault watch --lint --repo` plus `swarmvault hook install` when the repo should stay current automatically.
