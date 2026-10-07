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

`/cache` opens a pane: the time left with a solid bar that shrinks as the cache runs out (green, yellow below 40% of the lifetime, red from the warning threshold), a stacked read / wrote / new bar for the last request, and a colour-coded table with one row per turn. Bars are filled cells and columns have fixed widths with no-break spaces, so the terminal and the Desktop (HTML) pane render the same.

## How the countdown works

From Anthropic's [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) documentation:

- The cache lives **5 minutes** by default, **1 hour** when asked for.
- Every request that reads the cache **refreshes** it at no extra cost, so a conversation that keeps talking keeps the 5-minute cache warm.
- The lifetime is counted from the **start** of the request that wrote or read the entry; generation time counts against it.
- A prompt is `input_tokens` (uncached remainder) + `cache_read_input_tokens` + `cache_creation_input_tokens`.
- Writes cost 1.25x base input for 5 minutes and 2x for 1 hour; reads cost about 0.1x (less on some models). The expensive moment is an expired cache on a large context, which is when this mod suggests `/compact`.
- `/clear` starts a new conversation in the same process, so the meter and the `/cache` table start over with it. A change in the prefix (model, effort or thinking settings, tool set, system prompt, `CLAUDE.md`) makes the next request write instead of read. The mod names the cause when it sees a miss: model changed, the cache had lapsed, or the prefix changed.

## Which lifetime your account gets

The mod follows Claude Code's own rules ([prompt caching: cache lifetime](https://code.claude.com/docs/en/prompt-caching#cache-lifetime), Claude Code 2.1.242 or later). For the main conversation the TTL is the first match of:

| # | Source | Result |
| --- | --- | --- |
| 1 | the mod's `ttl` option (`5m` / `1h`) | what you set |
| 2 | `FORCE_PROMPT_CACHING_5M=1` | 5 minutes |
| 3 | `CLAUDE_CODE_PROMPT_CACHE_TTL` | `5m` or `1h` |
| 4 | the `promptCacheTtl` setting (local, project or user settings file) | `5m` or `1h` |
| 5 | `ENABLE_PROMPT_CACHING_1H=1` | 1 hour |
| 6 | the account | **1 hour on a Claude subscription within its plan usage**; 5 minutes on usage credits, an API key or a cloud provider |

The account comes from the rate-limit windows the last response reported: a `five_hour` or `seven_day` window means a subscription, and one at 100% means requests now draw on usage credits. An API key or a cloud provider reports no such window, and before the first response nothing is known, so the mod starts from 5 minutes there. Managed settings are not readable from a mod.

On top of that the mod watches the traffic, which beats rows 2 to 6: a request that **hits** the cache more than 5 minutes after the previous one proves the 1-hour lifetime (a later miss does not undo it, since a changed prefix looks the same), and a **miss** 5 to 60 minutes after the previous request, with the same model and a prompt that did not shrink, says the entry lapsed, so 5 minutes (a later hit overrules it). That covers what the mod cannot see: managed settings, a gateway that rewrites the TTL, or a subscription that ran out of plan usage mid-session. The pane header names the source in use.

Why the mod infers instead of reading it: the API names the TTL of each write (`cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`) and Claude Code's status line exposes it as `prompt_cache.ttl`, but the mod API passes on only the four token counts. To check by hand, `claude -p "hello" --output-format json` and read `usage.cache_creation`.

Other switches read from the environment at session start:

| Variable | Effect on the meter |
| --- | --- |
| `DISABLE_PROMPT_CACHING=1` (and `_HAIKU`, `_SONNET`, `_OPUS`) | the band says caching is off for that model |

## What it hooks

- `turn.step`: reads each main-loop request's usage (subagents have their own prefixes and are left out)
- `$.clock.every(1000)`: redraws the countdown, and only while its text changes, so an idle expired session costs nothing
- `ui.render` on `AbovePrompt` (the band) and on `Pane` (`/cache`); the band is shared, so what the mods after this one draw there stays, under the meter's row
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
claude
```

It is written to `.claude/skills/prompt-cache-control/`, which Claude Code auto-loads as `prompt-cache-control@skills-dir` once the workspace trust prompt is accepted. For one session with hot reload: `claude --plugin-dir .claude/skills/prompt-cache-control`. `claude plugin validate .claude/skills/prompt-cache-control` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/prompt-cache-control` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "prompt-cache-control@skills-dir": { "options": { } } } }
```

**Requirements.** Mods are on by default in Claude Code 2.1.287+. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
