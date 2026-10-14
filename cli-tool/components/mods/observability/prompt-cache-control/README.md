# prompt-cache-control (Claude Cache Control)

A prompt-cache meter above the Claude Code prompt. Every request Claude makes
reports how much of its prompt the cache served, how much it wrote and how much
went uncached; this mod keeps those numbers per request and per turn, counts
down to the moment the cache lapses and tells you what to do about it: keep
going, `/compact` or `/clear`.

```
cache ██████████ 98% read 80k · wrote 1k · new 300 ⏱ 3:41 5m · warm: keep going [ clear cache ]
cache ░░░░░░░░░░  0% read 0 · wrote 52k · new 300 ⏱ 4:58 5m · cache missed: model changed (…) [ clear cache ]
cache ██████████ 98% read 150k · wrote 1k · new 300 ⏱ 0:00 5m · expired: /compact first, or /clear if the task is done; the next … [ clear cache ]
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

## The clear cache button

The band and the `/cache` pane carry a **clear cache** button (just **clear** on a narrow band) for the moment the meter says to `/clear`; the band's button turns primary once the cache has expired on a large context. It works in two steps. A press only opens a one-line **message** field and runs nothing (see [A message for the fresh conversation](#a-message-for-the-fresh-conversation)); Enter in that field starts the handoff, with the field's text or, left empty, without any:

1. **Writes a handoff brief.** The mod asks the model, through `$.model.fork`, for a detailed brief under fixed headings: the goal, your instructions and preferences, where the work stands, open questions, next steps, key facts, pointers, and anything only the chat holds. A fork replays the conversation as of the last turn that ended normally, its final reply included, with one more user message; the prompt cache serves what it can. Meanwhile the band shows `writing the handoff brief…` with a **cancel** button. Cancel, or any turn that starts (a message you send, a task notification, a scheduled prompt), drops the brief and clears nothing; a `/clear` or `/resume` of your own drops it too. A cancel in the first second asks for a second press, so a double Enter does not undo it. A fork cannot be aborted, so a dropped brief's request still finishes in the background.
2. **Runs `/clear`**, only once a whole brief is in hand. If the model call fails (an API error, an empty reply, nothing to hand off yet) or the reply is not a brief, nothing is cleared and a toast and a transcript line say why.
3. **Sends the brief** as your first message in the fresh conversation, which writes a small new cache entry instead of rereading the old prefix. The fresh conversation answers in a few lines with where things stand and the next step, then waits for your go-ahead before it uses tools; with a message, it acts on your message at once instead. The closing toast says how many tokens the brief read from the cache, wrote to it and sent new.

If `/clear` does not run, or the brief looks cut off, nothing is cleared and the brief goes onto the clipboard. If a turn starts while `/clear` is pending, a prompt reaches the fresh conversation first, or the brief cannot be sent, the brief goes into the prompt box (or, failing that, onto the clipboard) for you to check and send, and `/resume` returns to the previous conversation. After the clear, the desktop app gives a mod neither its prompt box nor its clipboard, so there the whole brief is written to the transcript instead, under a header line, for you to copy and send. When nothing was cleared, the desktop keeps no copy of the brief: the conversation is still there, so press clear cache again. The button refuses while a turn is running, and after a turn that ended without its final reply (interrupted, failed, or stopped by a hook right after a tool call) until one ends normally, since a fork would leave that turn out. It refuses a second press while the field is open (the toast says the field is already open, since nothing runs yet) or while a handoff is underway. Keyboard: ctrl+x tab gives the band the keys with the ring on its first button, Enter presses it. `clearButton: false` removes the button; `clearMessage: false` keeps it but drops the field, so one press starts the handoff at once with no message.

### A message for the fresh conversation

A press on clear cache writes nothing and clears nothing. The band (or the `/cache` pane's footer when the pane is open) turns into two rows: `clear cache: add a message the fresh conversation acts on at once, or leave the field empty` (a shorter text on a narrow band), and under it a one-line **message** field with **cancel** after it. The handoff starts only when you press Enter in the field; on the desktop app the field's own **clear cache** button does the same.

- **Click the field to type.** The mod asks for the focus when the field opens. In the terminal that puts the ring in the field (after ctrl+x tab and Enter on the button); the desktop app leaves the caret where it was, so click into the field first, or your typing goes to the prompt box. The placeholder says so, in a shorter form when the band or the pane is under 102 columns wide.
- **Enter starts the handoff with what the field holds.** Text, its ends trimmed, is a prompt for the fresh conversation: it goes at the very end of the handoff, in a `<my_message>` block after the brief, and the fresh conversation acts on it in its first reply instead of summing up and waiting. The field then goes away and the band reads `writing the handoff brief, your message goes with it…`. An empty Enter is a plain clear: it sends exactly the text described above. The message is fixed before the brief is written, so nothing waits on you once it starts.
- **No timeout.** The field stays open as long as you like and nothing runs meanwhile. While it is open, and while the brief is written, the band is not redrawn as you type or as the clock ticks (the countdown, the status line entry and the expiry toasts pause until the handoff ends), so the field does not flicker.
- **Cancel closes it at once,** with a plain toast: `clear cache: cancelled, nothing was cleared`. A turn that starts, a prompt that is sent (for example one typed into the prompt box by mistake) or your own `/clear` or `/resume` close it too, with a toast that names the reason. If the field held text, it comes back: into the prompt box in the terminal, else onto the clipboard, else into the transcript under `your message was not sent:`, and the toast says where. If the model turns out to be working when you press Enter, the handoff does not start: the field closes with the reason and your text comes back the same way.
- **When the field moves.** Opening or closing the `/cache` pane, or a survey over the band, takes the field away and draws a new, empty one. Your text is kept: the new field shows it under itself as a dim `message: …` line, and Enter in the empty new field uses it. Text typed in the new field replaces it; erase that text and the held text applies again, to Enter and to cancel alike. With `band: false` there is no band to take the field over, so closing the pane while the field is open ends it like cancel, with your text given back.
- **Give-back after Enter.** Whenever the handoff stops before the clear (cancel, a turn or prompt that starts, your own `/clear` or `/resume`, a brief that fails or is cut off, a `/clear` that does not run), nothing is cleared and your message comes back the same way. When Claude Code exits while the field is open or the brief is written (`/exit`, ctrl+c, ctrl+d, a logout or a signal), the message goes straight to the transcript, since the prompt box ends with the process. When the brief is kept after the clear, the kept text already carries your message.
- **Limits.** The field holds one line. Mobile draws no field: a press there starts the plain clear at once, and a `/cache` pane on mobile shows a field open elsewhere as waiting, with its text and cancel. The message reaches the fresh conversation as text inside the handoff, so an `@file` mention is not expanded and a `/command` is read as words, not run. The brief is written without your message, so it still covers the whole conversation.
- **Acting at once skips the review step.** The handoff tells the fresh conversation to open with one or two lines, check what your message depends on before acting, keep asking for any approval the brief records, and ask instead of acting when the brief is broken or your message clashes with a recorded decision.
- **One click, as before.** `clearMessage: false` turns the field off: a press starts the handoff at once, with no message.

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
- `$.clock.every(1000)`: redraws the countdown, and only while its text changes, so an idle expired session costs nothing; while the message field is open or a handoff runs it redraws nothing and leaves the status line alone
- `ui.render` on `AbovePrompt` (the band) and on `Pane` (`/cache`)
- `$.ui.toast`: once per cache entry at the warning threshold (60 s by default) and again at 10, 3, 2 and 1 seconds left, for prompts of 20k tokens or more
- `turn.start`, `turn.complete` and `prompt.submit`: whether a main-loop turn is running or the last one was cut short, and whether a prompt arrives while the message field is open or the brief is written, so the clear cache button does not clear under a running turn and does not send a brief that leaves one out
- `$.model.fork`, `$.command.run({ command: 'clear' })` and `$.prompt.submit`: the clear cache button's brief, clear and handoff, with `$.prompt.fill`, `$.ui.copy` and, as a last resort, `$.ui.log` keeping the brief or your message when a step fails
- `ui.press`: notes which surface and which site (band or pane) a press of the mod's own buttons came from, for the button's closure; an `Input` for the message, with `$.ui.focus` asked to move into it

## Options

```
  ttl: string               "auto" | "5m" | "1h" (default auto)
  warnSeconds: number       countdown threshold for the yellow state and the toast (default 60)
  compactAtTokens: number   prompt size that makes an expired cache suggest /compact (default 100000)
  band: boolean             row above the prompt (default true)
  status: boolean           entry under the prompt, "cache 98% · 3:41" (default false)
  toast: boolean            toasts at the threshold, 10, 3, 2 and 1 s (default true)
  clearButton: boolean      clear cache button: handoff brief, /clear, brief and your optional message sent to the fresh conversation (default true)
  clearMessage: boolean     clear cache first opens a message field and starts only on Enter; false starts at once, with no field (default true)
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
