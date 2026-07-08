# SwarmVault Skill

Use the SwarmVault skill when you want a local-first knowledge vault that compiles books, articles, notes, transcripts, chat exports, emails, calendars, datasets, spreadsheets, slide decks, screenshots, URLs, code, and research captures into durable markdown pages, a searchable graph, dashboards, and reviewable outputs on disk.

SwarmVault is built on the [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern: keep a durable wiki between you and raw sources using a three-layer architecture (raw sources, wiki, schema). The LLM does the bookkeeping — cross-referencing, consistency, updating — while you curate sources and think about what they mean. SwarmVault turns that pattern into a local toolchain with graph navigation, search, review flows, automation, and optional provider-backed synthesis.

## Install

Install the skill from ClawHub:

```bash
clawhub install swarmvault
```

Install the CLI it depends on:

```bash
npm install -g @swarmvaultai/cli
swarmvault --version
swarmvault demo --no-serve
swarmvault source add https://github.com/karpathy/micrograd
swarmvault ingest ./meeting.srt --guide
swarmvault ingest ./customer-call.mp3
swarmvault ingest https://www.youtube.com/watch?v=dQw4w9WgXcQ
swarmvault source session transcript-or-session-id
```

Requirements:

- Node `>=24`
- A working `swarmvault` or `vault` binary on `PATH`

Update paths:

```bash
clawhub update swarmvault
npm install -g @swarmvaultai/cli@latest
```

## When To Use This Skill

- You want knowledge work to stay on disk instead of disappearing into chat history.
- The repo already contains `swarmvault.config.json` or `swarmvault.schema.md`.
- You want markdown wiki pages, graph artifacts, local search, approvals, candidates, and MCP exposure from the same workspace.
- You want a save-first compile/query/review loop for source collections, codebases, or research material.
- You want one workflow for mixed non-code material such as EPUBs, CSV/TSV files, XLSX workbooks, PPTX decks, transcripts, Slack exports, mailbox files, and calendar exports.

## Quickstart

```bash
swarmvault init --obsidian --profile personal-research
swarmvault init --obsidian --profile reader,timeline
swarmvault demo --no-serve
swarmvault source add ./exports/customer-call.srt --guide
swarmvault source session file-customer-call-srt-12345678
swarmvault source add https://github.com/karpathy/micrograd
swarmvault ingest ./src --repo-root .
swarmvault ingest ./customer-call.mp3
swarmvault ingest https://www.youtube.com/watch?v=dQw4w9WgXcQ
swarmvault add https://arxiv.org/abs/2401.12345
swarmvault compile --max-tokens 120000
swarmvault diff
swarmvault query "What is the auth flow?"
swarmvault graph blast ./src/index.ts
swarmvault graph serve
swarmvault graph export --report ./exports/report.html
swarmvault graph export --obsidian ./exports/graph-vault
swarmvault mcp
```

For the fastest scratch walkthrough of a local repo or docs tree, run `swarmvault scan ./path --no-serve`. It initializes the current directory as a vault, ingests that directory, compiles immediately, and leaves the graph viewer closed when you only need the generated artifacts.

If you want the same zero-config walkthrough without supplying your own inputs first, run `swarmvault demo --no-serve`. It creates a temporary demo vault with bundled sources and compiles it immediately.

For very large graphs, `swarmvault graph serve` and `swarmvault graph export --html` automatically start in overview mode. Add `--full` when you explicitly want the full canvas rendered. `graph export` also supports `--html-standalone`, `--json`, `--obsidian`, and `--canvas` when you need lighter sharing or Obsidian-native artifacts. `swarmvault diff` compares the current graph against the last committed graph so you can inspect graph-level changes after a compile.

The default `heuristic` provider is a valid local/offline starting point. Add a model provider in `swarmvault.config.json` when you want richer synthesis quality or optional capabilities such as embeddings, vision, or image generation. The recommended fully-local setup is `ollama pull gemma4` wired up as the `compileProvider` and `queryProvider` (see the root README for the exact config block). Any supported provider works - OpenAI, Anthropic, Gemini, OpenRouter, Groq, Together, xAI, Cerebras, openai-compatible, or custom. Code files are always parsed locally via tree-sitter; only non-code text or image sources go to configured model providers.

`swarmvault init --profile` accepts `default`, `personal-research`, or a comma-separated preset list such as `reader,timeline`. For a custom vault style, edit the `profile` block in `swarmvault.config.json` directly; `swarmvault.schema.md` stays the human-written intent layer. The `personal-research` preset also enables `profile.guidedIngestDefault` and `profile.deepLintDefault`, so guided ingest/source and lint flows are on by default until you opt out with `--no-guide` or `--no-deep`.

For local semantic graph query without API keys, point `tasks.embeddingProvider` at an embedding-capable local backend such as Ollama, not `heuristic`.

With an embedding-capable provider available, SwarmVault can also merge semantic page matches into local search by default. `tasks.embeddingProvider` is the explicit way to choose that backend, but SwarmVault can also fall back to a `queryProvider` with embeddings support. Set `search.rerank: true` when you want the configured `queryProvider` to rerank the merged top hits before answering.

Audio file ingest uses `tasks.audioProvider` when you configure a provider with `audio` capability. YouTube transcript ingest works without a model provider. If you want to pin graph clustering instead of using the adaptive default, set `graph.communityResolution` in `swarmvault.config.json`.

`swarmvault lint --deep --web` augments deep-lint findings with external evidence from a configured `webSearch` adapter. Web search is currently scoped to deep lint; compile, query, and explore stay on local vault state plus your configured LLM providers.

When the vault lives inside a git repo, `ingest`, `compile`, and `query` also accept `--commit` so generated `wiki/` and `state/` changes can be committed immediately. `compile --max-tokens <n>` trims lower-priority pages when you need bounded wiki output for a tighter context window.

Source-scoped artifacts are intentionally split by role:

| Artifact | Created by | Purpose |
|----------|-----------|---------|
| Source brief | `source add`, `ingest` (always) | Auto summary written to `wiki/outputs/source-briefs/` |
| Source review | `source review`, `source add --guide`, `ingest --review`, `ingest --guide` | Lighter staged assessment in `wiki/outputs/source-reviews/` |
| Source guide | `source guide`, `source add --guide`, `ingest --guide` | Guided walkthrough with approval-bundled updates in `wiki/outputs/source-guides/` |
| Source session | `source session`, `source add --guide`, `ingest --guide` | Resumable workflow state in `wiki/outputs/source-sessions/` and `state/source-sessions/` |

Supported non-code ingest includes `.pdf`, the full Word family (`.docx`, `.docm`, `.dotx`, `.dotm`), `.rtf`, `.odt`, `.odp`, `.ods`, `.epub`, `.csv`, `.tsv`, the full Excel family (`.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.xltx`, `.xltm`), the full PowerPoint family (`.pptx`, `.pptm`, `.potx`, `.potm`), `.ipynb` (Jupyter notebooks), `.bib` (BibTeX), `.org` (Org-mode), `.adoc`/`.asciidoc`, `.srt`, `.vtt`, Slack exports, `.eml`, `.mbox`, `.ics`, audio files (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.webm`, and other `audio/*` inputs) through `tasks.audioProvider`, direct YouTube transcript URLs, images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.tif`, `.tiff`, `.svg`, `.ico`, `.heic`, `.heif`, `.avif`, `.jxl`), markdown/MDX/text notes, structured config/data (`.json`, `.jsonc`, `.json5`, `.yaml`, `.toml`, `.xml`, `.ini`, `.conf`, `.cfg`, `.env`, `.properties`) with schema hints, common developer manifests (`package.json`, `tsconfig.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `go.sum`, `Dockerfile`, `Makefile`, `LICENSE`, `.gitignore`, `.editorconfig`, and similar) via content-sniffed text ingest so they are never silently dropped, browser clips, and research URLs captured through `swarmvault add`.

Supported code ingest covers `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx`, `.sh`, `.bash`, `.zsh`, `.py`, `.go`, `.rs`, `.java`, `.kt`, `.kts`, `.scala`, `.sc`, `.dart`, `.lua`, `.zig`, `.cs`, `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hh`, `.hpp`, `.hxx`, `.php`, `.rb`, `.ps1`, `.psm1`, `.psd1`, `.ex`, `.exs`, `.ml`, `.mli`, `.m`, `.mm`, `.res`, `.resi`, `.sol`, `.vue`, `.css`, `.html`, `.htm`, plus extensionless executable scripts with `#!/usr/bin/env node|python|ruby|bash|zsh` shebangs. Each language goes through a tree-sitter AST walk to extract symbols, imports, and local module references.

## What The Skill Package Includes

- `SKILL.md` - operational instructions for the model
- [`examples/quickstart.md`](examples/quickstart.md) - first-run setup flow
- [`examples/repo-workflow.md`](examples/repo-workflow.md) - repo ingest, compile, review, and graph workflow
- [`examples/research-workflow.md`](examples/research-workflow.md) - research capture and query workflow
- [`references/commands.md`](references/commands.md) - high-signal command cheat sheet
- [`references/artifacts.md`](references/artifacts.md) - what shows up under `raw/`, `wiki/`, and `state/`
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - common setup and runtime fixes
- [`validation/smoke-prompts.md`](validation/smoke-prompts.md) - release-validation prompts and expected outcomes

The published ClawHub package is intentionally text-only in this release.

## Core Workflow

1. Initialize the vault with `swarmvault init`.
2. Treat `swarmvault.schema.md` as the vault contract before serious compile or query work.
3. Use `swarmvault source add` when the input is a recurring local file, local directory, public GitHub repo root, or docs hub that should stay registered.
4. Add one-off material with `swarmvault ingest`, `swarmvault add`, or `swarmvault inbox import`.
5. Use `swarmvault ingest --guide`, `swarmvault source add --guide`, `swarmvault source reload --guide`, `swarmvault source guide <id>`, or `swarmvault source session <id>` when you want the stronger guided-session workflow. Set `profile.guidedIngestDefault: true` when guided mode should be the default for ingest/source commands, and use `--no-guide` to force the lighter path for a specific run. Profiles using `guidedSessionMode: "canonical_review"` stage approval-queued canonical page edits; `insights_only` profiles keep exploratory synthesis under `wiki/insights/`.
6. Compile with `swarmvault compile`, use `compile --max-tokens <n>` when the generated wiki must fit a bounded context window, or use `compile --approve` when the change should land in the approval queue first.
7. Inspect `wiki/`, `wiki/dashboards/`, and `state/` artifacts before broad re-search. When the vault lives inside git, `ingest|compile|query --commit` can commit those artifacts immediately after the run.
8. Use `swarmvault query`, `swarmvault explore`, `swarmvault review`, `swarmvault candidate`, and `swarmvault lint` to keep the vault current and reviewable. Set `profile.deepLintDefault: true` when `lint` should run the advisory deep pass by default, and use `--no-deep` to force a structural-only run.
9. Use `swarmvault graph blast` for reverse-import impact checks, `swarmvault graph serve` for the live workspace plus bookmarklet clipper, `swarmvault graph export --report` for a self-contained HTML report, `swarmvault graph export` for other shareable formats, `swarmvault graph push neo4j`, or `swarmvault mcp` when the vault needs to be explored or shared elsewhere.

## What SwarmVault Writes

- `raw/sources/` and `raw/assets/` for canonical input storage
- `wiki/` for compiled source, concept, entity, code, graph, and output pages
- `wiki/outputs/source-briefs/` for recurring-source onboarding briefs
- `wiki/outputs/source-sessions/` for resumable guided session anchors
- `wiki/outputs/source-reviews/` for staged source-scoped review artifacts
- `wiki/outputs/source-guides/` for guided source integration artifacts
- `wiki/dashboards/` for recent sources, reading log, timeline, source sessions, source guides, research map, contradictions, and open questions
- `wiki/candidates/` for staged concept/entity pages
- `state/graph.json` for the compiled graph
- `state/search.sqlite` for local search
- `state/sources.json` plus `state/sources/<id>/` for managed-source registry state and working sync data
- `state/approvals/` for compile approval bundles
- `state/sessions/` and `state/jobs.ndjson` for saved run history

Generated guided artifacts and dashboards also carry Dataview-friendly fields such as `profile_presets`, `session_status`, `question_state`, `canonical_targets`, and `evidence_state` when you enable `profile.dataviewBlocks`.

## Agent And MCP Integration

Supported agent installs:

- `swarmvault install --agent codex`
- `swarmvault install --agent claude --hook`
- `swarmvault install --agent cursor`
- `swarmvault install --agent gemini --hook`
- `swarmvault install --agent opencode --hook`
- `swarmvault install --agent aider`
- `swarmvault install --agent copilot --hook`
- `swarmvault install --agent trae`
- `swarmvault install --agent claw`
- `swarmvault install --agent droid`

Expose the vault over MCP with:

```bash
swarmvault mcp
```

## Links

- Docs: https://www.swarmvault.ai/docs
- Providers: https://www.swarmvault.ai/docs/providers
- Troubleshooting: https://www.swarmvault.ai/docs/getting-started/troubleshooting
- npm: https://www.npmjs.com/package/@swarmvaultai/cli
- GitHub: https://github.com/swarmclawai/swarmvault
