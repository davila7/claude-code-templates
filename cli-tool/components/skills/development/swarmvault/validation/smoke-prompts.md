# Smoke Prompts

These prompts are the human-readable validation set for the ClawHub skill and the installed-package release flow.

## First-run prompt

Prompt:

> Set up a SwarmVault workspace for this repo and explain what files I should inspect first.

Expected shape:

- initializes or confirms the vault
- may use `swarmvault demo --no-serve` for the fastest zero-config walkthrough
- may use `swarmvault scan <directory> --no-serve` when the task is a quick local repo walkthrough
- points at `swarmvault.schema.md`
- mentions `wiki/` and `state/`
- prefers `wiki/graph/report.md` once compile exists

## Managed source prompt

Prompt:

> Register this public GitHub repo as a recurring source, sync it, and tell me what I should read first.

Expected shape:

- uses `swarmvault source add https://github.com/karpathy/micrograd` or the supplied repo root URL
- mentions `state/sources.json`
- points at `wiki/outputs/source-briefs/` and `wiki/graph/report.md`
- treats `source list` and `source reload --all` as the maintenance path

## Repo understanding prompt

Prompt:

> Compile this repo into SwarmVault and tell me how auth works.

Expected shape:

- uses `ingest <dir> --repo-root .` and `compile`
- reads generated module pages or graph report before broad search
- saves the answer unless the user asks for ephemeral output

## Research prompt

Prompt:

> Add this paper URL to the vault and summarize the main claims and conflicts.

Expected shape:

- uses `swarmvault add`
- may use `swarmvault ingest` for direct audio files or YouTube transcript URLs
- compiles before answering if needed
- points at contradiction/report artifacts when conflicts exist

## Personal knowledge prompt

Prompt:

> Ingest this transcript or export file, run the guided workflow, and tell me what dashboard pages I should open first.

Expected shape:

- uses `swarmvault ingest --guide`, `swarmvault source add --guide`, or `swarmvault source session`
- points at `wiki/outputs/source-sessions/` and `wiki/outputs/source-guides/`
- points at `wiki/dashboards/source-sessions.md`, `wiki/dashboards/source-guides.md`, `wiki/dashboards/timeline.md`, or `wiki/dashboards/reading-log.md`
- treats the approval queue as part of the workflow instead of silently overwriting canonical pages

## Graph prompt

Prompt:

> Show me the fastest way to inspect the graph and then expose the vault to another tool.

Expected shape:

- uses `swarmvault graph serve` or `graph export --html`
- may suggest `graph export --report`, `graph export --html-standalone`, `graph export --canvas`, or `graph export --obsidian` when a lighter shareable artifact is a better fit
- may suggest `swarmvault diff` when the user is asking what a compile changed
- may use `graph blast <target>` when the user is asking about change impact instead of broad graph browsing
- mentions `swarmvault mcp`
- prefers existing report and graph artifacts when already present
