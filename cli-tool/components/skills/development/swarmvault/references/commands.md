# Command Reference

## Setup

```bash
swarmvault demo --no-serve
swarmvault init
swarmvault init --obsidian --profile personal-research
swarmvault init --obsidian --profile reader,timeline
swarmvault scan ./apps/api --no-serve
swarmvault --version
```

## Ingest and Capture

```bash
swarmvault source add https://github.com/karpathy/micrograd
swarmvault source add ./exports/customer-call.srt --guide
swarmvault source session <source-id-or-session-id>
swarmvault source list
swarmvault source reload --all
swarmvault source review <source-id>
swarmvault source guide <source-id>
swarmvault source delete <source-id>
swarmvault ingest <path-or-url>
swarmvault ingest ./customer-call.mp3
swarmvault ingest https://www.youtube.com/watch?v=dQw4w9WgXcQ
swarmvault ingest <path-or-url> --commit
swarmvault ingest <path-or-url> --guide
swarmvault ingest <directory> --repo-root .
swarmvault add <url-or-doi-or-arxiv-id>
swarmvault inbox import <path>
```

## Compile, Query, Review

```bash
swarmvault compile
swarmvault compile --max-tokens 120000
swarmvault compile --approve
swarmvault diff
swarmvault query "<question>"
swarmvault query "<question>" --commit
swarmvault explore "<question>" --steps 3
swarmvault lint
swarmvault lint --conflicts
swarmvault review list
swarmvault review show <approval-id> --diff
swarmvault review accept <approval-id>
swarmvault candidate list
```

## Graph and Sharing

```bash
swarmvault graph serve
swarmvault graph serve --full
swarmvault graph blast ./src/index.ts
swarmvault graph export --html ./graph.html
swarmvault graph export --report ./graph-report.html
swarmvault graph export --html ./graph.html --full
swarmvault graph export --html-standalone ./graph-standalone.html
swarmvault graph export --json ./graph.json --canvas ./graph.canvas
swarmvault graph export --obsidian ./graph-vault
swarmvault graph push neo4j --dry-run
swarmvault mcp
```

## Automation

```bash
swarmvault watch --lint --repo
swarmvault watch --repo --code-only --once
swarmvault watch status
swarmvault hook install
swarmvault schedule list
swarmvault schedule run <job-id>
```

## Agent Installs

```bash
swarmvault install --agent codex
swarmvault install --agent claude --hook
swarmvault install --agent gemini --hook
swarmvault install --agent opencode --hook
swarmvault install --agent aider
swarmvault install --agent copilot --hook
swarmvault install --agent trae
swarmvault install --agent claw
swarmvault install --agent droid
```
