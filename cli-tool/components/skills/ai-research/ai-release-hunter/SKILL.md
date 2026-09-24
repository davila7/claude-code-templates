---
name: ai-release-hunter
description: Daily digest of AI releases from Anthropic, Meta, Vercel Labs, OpenAI and Google GitHub repos, the Claude Cowork changelog, the claude.dev blog and Hacker News, deduplicated against a local state file and sent by email. Use when the user asks for a daily AI news digest, to scan AI labs for new releases, or to set up a scheduled release-hunter job.
license: MIT
allowed-tools: Bash Read Write WebFetch
metadata:
  author: Daniel Avila
  version: "1.0.0"
  tags: "ai-news, releases, github, hacker-news, digest, email, anthropic, openai, google, meta, vercel"
---

# AI Release Hunter (Anthropic + Meta + Vercel + OpenAI + Google + Hacker News)

Scans the public AI repos of Anthropic, Meta, Vercel Labs, OpenAI and Google on GitHub, plus the Claude Cowork changelog, the claude.dev blog and Hacker News, and emails a digest of the day's relevant movements. Designed to run once a day as a scheduled job (cron, a Claude Code routine, or `/loop`).

## Configuration

Set these before the first run. Every path is relative to the working directory unless you choose otherwise.

| Setting | Default | Purpose |
|---------|---------|---------|
| `RECIPIENT_EMAIL` | *(required)* | Address that receives the digest |
| `SEND_COMMAND` | *(required)* | Command that sends an email given a recipient, subject and body file (e.g. a Gmail CLI, `mail` or `sendmail`; to send through an MCP tool instead, add it to `allowed-tools`) |
| `STATE_DIR` | `.release-hunter/state/` | Deduplication state (`seen.json`) |
| `SNAPSHOT_DIR` | `.release-hunter/snapshots/` | Page snapshots (Vercel Labs, Cowork changelog) |
| `OUTPUT_DIR` | `.release-hunter/output/` | Email bodies and run logs |
| `EMAIL_LANGUAGE` | Spanish | Language of the email |
| `EMAIL_SUBJECT` | `IA: novedades del día (Anthropic + Meta + Vercel + OpenAI + Google + Hacker News)` | Subject line |
| `AUDIENCE` | the user's audience | Who the "why it matters" lines are written for (e.g. a YouTube channel, a team) |

Suggested schedule: daily at ~08:00 in the user's time zone.

Add `.release-hunter/` to `.gitignore` so state, snapshots and email bodies are never committed. The scan makes well over 60 GitHub API calls per run, so a `GITHUB_TOKEN` is strongly recommended (see below).

## Watched sources

### Anthropic (GitHub org `anthropics`)
- anthropics/claude-code
- anthropics/claude-cookbooks
- anthropics/anthropic-sdk-python
- anthropics/anthropic-sdk-typescript
- anthropics/courses

Also list the org's repos (`https://api.github.com/orgs/anthropics/repos?per_page=100`) and consider any other with recent relevant activity (agent SDKs, examples, tooling).

### claude.dev blog (https://claude.dev/)
Anthropic's technical blog with tips, techniques and POVs from its developers for building with Claude. Fetch it with WebFetch and take the list of recent posts (date + title + link). Compare against the already-reported ones in `STATE_DIR/seen.json` under the key `claude_dev_posts` (list of slugs or URLs; create it if missing). Report each new post as a highlighted item: title, date, one line on why it matters to `AUDIENCE` + link to the post. Add the new ones at the end.

### Meta AI (GitHub orgs `meta-llama` and `facebookresearch`)
- meta-llama/llama-models
- meta-llama/llama-stack
- meta-llama/llama-agentic-system
- meta-llama/llama-toolchain
- meta-llama/llama-cookbook
- meta-llama/purplellama
- meta-llama/codellama
- facebookresearch/segment-anything
- facebookresearch/segment-anything-2
- facebookresearch/dinov2
- facebookresearch/dinov3
- facebookresearch/faiss
- facebookresearch/audiocraft
- facebookresearch/spiritlm
- facebookresearch/vggt
- facebookresearch/vjepa2
- facebookresearch/xformers

If any repo returns 404, skip it and continue. Also list both orgs' repos and add up to ~15 more with a push in the last 30 days whose name or description fits AI: new models, agents, MCP, vision, audio, multimodal, diffusion, segmentation, embeddings, fine-tuning, RL. Ignore internal infra repos, consumer product demos or archived ones.

### Vercel Labs (org `vercel-labs`; experiments at https://vercel.com/labs)
- vercel-labs/agent-browser (browser automation CLI for AI agents)
- vercel-labs/deepsec (security harness for coding agents)
- vercel-labs/json-render (Generative UI framework)
- vercel-labs/skills (open agent skills ecosystem CLI)
- vercel-labs/portless
- vercel-labs/fx (unix-like coding agent)
- vercel-labs/vgpu
- vercel-labs/scriptc, vercel-labs/wterm, vercel-labs/emulate, vercel-labs/native, vercel-labs/callscript, vercel-labs/run, vercel-labs/visual-json, vercel-labs/zerolang, vercel-labs/phase, vercel-labs/webreel, vercel-labs/opensrc

If any repo returns 404, skip it and continue. Also list the org's repos and add those with a push in the last 30 days not already in the list.

Labs page updates: fetch https://vercel.com/labs and compare the experiment list (name + category: Labs products / Active experiments / Past experiments) against the snapshot at `SNAPSHOT_DIR/vercel-labs-experiments.json`. Report any new experiment or category change as a highlighted item. Update the snapshot at the end.

### OpenAI (GitHub org `openai`)
- openai/codex (coding agent CLI)
- openai/codex-security (Codex Security CLI + TypeScript SDK)
- openai/codex-action (GitHub Action for Codex)
- openai/openai-agents-python (agent framework, Python)
- openai/openai-agents-js (agent framework, JS)
- openai/openai-guardrails-python
- openai/openai-guardrails-js
- openai/tunnel-client (Secure MCP Tunnel client)
- openai/openai-cua-sample-app (computer use via API)
- openai/symphony (autonomous implementation runs)
- openai/openai-cli (official CLI)
- openai/plugins, openai/community-plugins
- openai/fence

If any repo returns 404, skip it and continue. Also list the org's repos and add up to ~10 more with a push in the last 30 days whose name or description fits AI: agents, codex, MCP, skills, computer use, guardrails, plugins, sandboxing. Ignore internal infra repos, consumer product demos or archived ones.

### Google (GitHub org `google`)
- google/ax (Google's open agentic orchestration runtime; priority: releases, roadmap, API changes)
- google/adk-python (Agent Development Kit, Python)
- google/adk-js (Agent Development Kit, JS)
- google/gemini-cli (Gemini coding agent CLI)
- google/a2a (Agent2Agent protocol)
- google/genai-python (Gemini SDK for Python)
- google/genai-js (Gemini SDK for JS)

If any repo returns 404, skip it and continue. Also list the org's repos and add up to ~10 more with a push in the last 30 days whose name or description fits agentic AI: agents, orchestration, A2A/MCP, Gemini, evals, tool use. Ignore internal infra repos, consumer product demos, Android, Flutter or archived ones.

Google items are reported as-is, **with no Claude/Anthropic comparison angle**.

### Claude Cowork changelog (https://claude.com/docs/cowork/changelog)
The page is public and organizes changes by date (`YYYY-MM-DD` headings). Compare the date sections against the snapshot at `SNAPSHOT_DIR/cowork-changelog-snapshot.json` (format: date → `{"sha256": hash of that section's content}`).

Exact hash method: download the HTML with curl, strip `<script>`/`<style>` tags, convert remaining tags to newlines, drop empty lines, and split on lines that are only a date `YYYY-MM-DD`. The sha256 is computed over each section's text, with no HTML-entity unescaping. Keep the method identical across runs or every section will look changed.

Report only new dates or dates whose content changed since the snapshot, with the most relevant bullets (features, behavior changes, new Cowork/Code/3P settings; skip minor bug fixes unless important) + the changelog page link. Update the snapshot at the end.

### Hacker News (https://news.ycombinator.com)
Find stories from the last ~24 hours relevant to Anthropic, Meta AI, Vercel, OpenAI, Google AI, Claude/Claude Code, coding agents and MCP. Use the public Algolia API (no auth), with parallel requests:
- `GET https://hn.algolia.com/api/v1/search?query=<term>&tags=story&numericFilters=created_at_i><timestamp_24h_ago>,points>40` for each keyword: `Claude Code`, `Codex`, `Cursor`, `MCP`, `Anthropic`, `OpenAI`, `Google`, `Vercel`, `Llama`, `AI agent`
- Also check the current front page: `GET https://hn.algolia.com/api/v1/search?tags=front_page` and keep the relevant stories.

Filter noise: only stories with real traction (meaningful points and comments) and direct relevance to `AUDIENCE` (launches, technical debates on coding agents, model comparisons, new tools). Deduplicate by storing already-reported story IDs in `STATE_DIR/seen.json` under the key `hn_story_ids`. Only report unseen stories; add the new IDs at the end.

## What to look for in each repo

Use the public GitHub API, no auth, with parallel requests (e.g. `xargs -P16`). Unauthenticated calls are limited to 60 requests/hour per IP; if a `GITHUB_TOKEN` is available in the environment, send it as a bearer token to raise the limit, and never write it to any output file.

1. **New releases:** `GET /repos/{owner}/{repo}/releases`; take those published since the last check (filter by publication date, not just tag equality).
2. **Relevant commits** on the main branch since the last check: `GET /repos/{owner}/{repo}/commits?since=<ISO-8601>`. Filter noise (dependabot, CI, typo fixes); keep features, behavior changes, new commands/flags, deprecations, new models and important fixes.
3. **Notable changes** in CHANGELOG or README when applicable.

## Deduplication

Store in `STATE_DIR/seen.json` (create if missing) the last release tag and last reviewed commit SHA per repo, keyed by `owner/repo`. Only report what's new since the last mark; update the mark at the end. On the first run there is no mark: report only the last 24 hours instead of the full history.

## Email format

- Written in `EMAIL_LANGUAGE`, direct and no filler.
- Grouped by company and repo, each item with one line on why it matters to `AUDIENCE` + link to the release or commit.
- When a Meta, Vercel or OpenAI item has a Claude/Anthropic comparison angle (e.g. Codex vs Claude Code, Llama vs Claude, agent skills, MCP), mention it: contrasts are useful to the reader.
- A `Hacker News` section: per story, title, points/comments, one line on why it matters + link to the discussion (`https://news.ycombinator.com/item?id=<id>`).
- If nothing relevant: a one-line email saying there were no relevant movements today.

## Sending

Write the body to a durable file first, `OUTPUT_DIR/email-body-YYYY-MM-DD.txt`, never to `/tmp` (it can be wiped between turns of a scheduled job). Then send it with `SEND_COMMAND`, for example:

```bash
<send-command> --to "$RECIPIENT_EMAIL" --subject "$EMAIL_SUBJECT" --body "$(cat .release-hunter/output/email-body-YYYY-MM-DD.txt)"
```

The user must authorize the recurring send when setting up the job; do not send to any address other than `RECIPIENT_EMAIL`. If sending fails, record it in the run log.

If the GitHub API fails or returns a rate limit, wait a minute and retry once; if it still fails, send the email noting which sources couldn't be checked today.

## Wrap-up

Append a run summary (sources checked, items reported, failures) to `OUTPUT_DIR/runs/YYYY-MM-DD.md`, and save the updated `seen.json` and snapshots only after the email is sent, so a failed send is retried with the same items next run.
