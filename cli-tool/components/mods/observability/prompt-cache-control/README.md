# prompt-cache-control (Claude Cache Control)

A prompt-cache meter above the Claude Code prompt. Every request Claude makes
reports how much of its prompt the cache served, how much it wrote and how much
went uncached; this mod keeps those numbers per request and per turn, counts
down to the moment the cache lapses and tells you what to do about it: keep
going, `/compact` or `/clear`.

```
cache ██████████ 98% read 80k · wrote 1k · new 300 ⏱ 3:41 5m · warm: keep going
cache ░░░░░░░░░░  0% read 0 · wrote 52k · new 300 ⏱ 4:58 5m · cache missed: model changed (…)
cache ██████████ 98% read 150k · wrote 1k · new 300 ⏱ 0:00 5m · expired: the next message rewrites 151k tokens. /compact first, or /clear if the task is done
```

`/cache` opens a pane: a big block-letter countdown that ticks every second and changes colour with the state (green warm, yellow then blinking red near expiry, red expired), a bar with the share of the lifetime left, a stacked bar of the last request (read / wrote / new), and a colour-coded table with one row per turn. Cells have fixed widths and no-break spaces so the terminal and the Desktop (HTML) pane render the same columns.

```
█  █   ████ ████
█  █ █    █    █
████   ████ ████
   █ █ █    █   
   █   ████ ████
```

## How the countdown works

From Anthropic's [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) documentation:

- The cache lives **5 minutes** by default, **1 hour** when asked for.
- Every request that reads the cache **refreshes** it at no extra cost, so a conversation that keeps talking keeps the 5-minute cache warm.
- The lifetime is counted from the **start** of the request that wrote or read the entry; generation time counts against it.
- A prompt is `input_tokens` (uncached remainder) + `cache_read_input_tokens` + `cache_creation_input_tokens`.
- Writes cost 1.25x base input for 5 minutes and 2x for 1 hour; reads cost about 0.1x (less on some models). The expensive moment is an expired cache on a large context, which is when this mod suggests `/compact`.
- `/clear` starts a new conversation in the same process, so the meter and the `/cache` table start over with it. A change in the prefix (model, effort or thinking settings, tool set, system prompt, `CLAUDE.md`) makes the next request write instead of read. The mod names the cause when it sees a miss: model changed, the cache had lapsed, or the prefix changed.

Claude Code's own switches are read from the environment at session start:

| Variable | Effect on the meter |
| --- | --- |
| `ENABLE_PROMPT_CACHING_1H=1` (or `true`) | the countdown runs 1 hour |
| `FORCE_PROMPT_CACHING_5M=1` | forces 5 minutes, beating the one above |
| `DISABLE_PROMPT_CACHING=1` (and `_HAIKU`, `_SONNET`, `_OPUS`) | the band says caching is off for that model |

**What the mod cannot see.** The usage block does not say which TTL a write used, so `ttl: "auto"` is what the environment asks for, not an observation. If Claude Code picks a different lifetime for your plan or provider, set the `ttl` option to override it. The `ENABLE_PROMPT_CACHING_1H` and `FORCE_PROMPT_CACHING_5M` variables are described in an open documentation issue ([anthropics/claude-code#48082](https://github.com/anthropics/claude-code/issues/48082)) and may be renamed.

## What it hooks

- `turn.step`: reads each main-loop request's usage (subagents have their own prefixes and are left out)
- `$.clock.every(1000)`: redraws the countdown, and only while its text changes, so an idle expired session costs nothing
- `ui.render` on `AbovePrompt` (the band) and on `Pane` (`/cache`)
- `$.ui.toast`: once per cache entry at the warning threshold (60 s by default) and again at 10, 3, 2 and 1 seconds left, for prompts of 20k tokens or more

## Options

```
  ttl: string               "auto" | "5m" | "1h" (default auto)
  warnSeconds: number       countdown threshold for the yellow state and the toast (default 60)
  compactAtTokens: number   prompt size that makes an expired cache suggest /compact (default 100000)
  band: boolean             row above the prompt (default true)
  status: boolean           entry under the prompt, "cache 98% · 3:41" (default false)
  toast: boolean            toasts at the threshold, 10, 3, 2 and 1 s (default true)
```

The 100k `compactAtTokens` is a judgement, not a figure from the documentation: lower it if your model's cache writes are expensive for you.

## Install

```sh
npx claude-code-templates@latest --mod observability/prompt-cache-control
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/prompt-cache-control/`, which Claude Code auto-loads as `prompt-cache-control@skills-dir` once the workspace trust prompt is accepted. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/prompt-cache-control`. `claude plugin validate .claude/skills/prompt-cache-control` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/prompt-cache-control` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "prompt-cache-control@skills-dir": { "options": { } } } }
```

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
