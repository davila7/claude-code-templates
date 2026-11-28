# reinwatch

A token and runaway watchdog for the subagents, teammates and workflow agents
Claude Code runs: per-agent new-token counts and active time, warnings with
notifications when an agent runs long, burns tokens, repeats itself or fails
repeatedly, a summary after each turn, 30-day totals, and a way to stop a
single agent — including one inside a workflow. Nothing is stopped
automatically.

Upstream: https://github.com/sofumel/reinwatch (MIT)

## Install

```sh
npx claude-code-templates@latest --mod observability/reinwatch
claude
```

Or install it from the author's own marketplace inside Claude Code:

```
/plugin install reinwatch --marketplace sofumel/reinwatch
```

**Requires Claude Code 2.1.326 or later**, in the terminal or the desktop
app's Code tab.

## What you see

- **Status line:** `agents 2 running · 310k tok · 26m active`, with
  `· 1 warning` when one is open.
- **`/reinwatch` pane:** one row per agent (state, name, tokens, active time,
  type, model, turns) with its buttons, the open warnings, the latest turn
  summary and the last-30-days totals. Each Stop is kept under **Stopped**
  with the agent's tokens, time and last tool.
- **Band above the prompt:** the open warnings with their buttons, and after
  each turn a combined summary; the **Details** button lists each agent's
  share of the tokens (cache reads included there only).

Active time counts model and tool work only; waiting does not count. Token
counts are new tokens: input, cache writes and output. Cache reads are left
out of the counts and the token warning.

## Options

Set these in the plugin's `userConfig` options. Minutes and millions may be
fractional (`0.5`).

| Option | What it does | Default |
|---|---|---|
| `activeMinutes` | Long-run warning: warn when one agent has worked longer than this | 30 |
| `tokenMillions` | Token warning: warn when one agent has taken in more new tokens than this (millions) | 1 |
| `repeatCount` | Repeat warning: the same tool call with the same input this many times in a row | 5 |
| `failStreak` | Failure warning: this many tool failures in a row from one agent | 5 |
| `burstCount` | Burst warning: this many agents starting within the burst window, or one workflow run starting this many | 10 |
| `burstMinutes` | The window the burst warning counts agent starts in (minutes) | 2 |
| `notify` | Raise each warning as a notification | true |
| `openPaneOnWarning` | Open the agent pane when a warning fires | false |
| `redact` | Mask strings that look like keys or tokens in agent descriptions | true |
| `mute` | Warning kinds never to raise, comma-separated: `long`, `tokens`, `repeat`, `failures`, `burst`, `run` | "" |
| `priceInput` | Your price per 1M input tokens; set both prices to see cost estimates (0 = off) | 0 |
| `priceOutput` | Your price per 1M output tokens. Cache writes count 1.25× the input price, cache reads 0.1× | 0 |
| `currency` | The symbol shown before a cost estimate | `$` |

## Stopping and privacy

- **Stop** denies the agent's new tool calls and answers its next model call
  with a reply telling it to report and not resume. A running tool finishes
  first. **Allow resume** lifts the stop, and stopping one agent does not
  stop its workflow.
- No network access, shell commands or model calls. Only the 30-day store
  (per local day: agents, new tokens, active milliseconds and the per-agent
  peaks) outlives the session; prompts, outputs and tool inputs are never
  kept, and a tool input becomes only an in-memory hash to spot repeats.
- `redact` replaces key-like text with `[redacted]` by its look alone: a
  guard against accidents, not a guarantee.

## Limitations

- **View** works only in the terminal. **View** and **Ask to stop** need the
  agent in Claude Code's agent list, which workflow agents are not in.
- After a mod reload, a row can read "running" until the agent list (checked
  every 10 seconds) reports it done, and work since the last summary is
  missing from the 30-day totals.
