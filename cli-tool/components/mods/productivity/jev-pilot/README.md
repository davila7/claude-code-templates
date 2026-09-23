# jev-pilot

Lets [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, decide how Claude Code works on each prompt:

| Decision | When | Default |
|---|---|---|
| **Reasoning effort** of the main conversation, `low` → `xhigh` | start of each turn | on, capped by `maxEffort` |
| **Raise effort, up to `max`**, when tool calls keep failing | mid-turn, at most once | on, after 2 failed calls in a row |
| **Subagent model**: Haiku, Sonnet or Opus | when a subagent starts | on |
| **Strategy**: direct, delegate, parallel, or a small graph of subagents | start of each turn, as advice | on |
| **The one skill** the prompt needs, if any | start of each turn | on |
| **A record of every decision**, with tuning suggestions | always, via `/jev-pilot:report` | on |

Jev reads the prompt with the last few messages (text and tool names only), so a follow-up like "yes, do it" is judged as the work it continues.

jev-pilot is built on this repo's own [`jev-model-router`](../jev-model-router) and [`jev-skill-suggestion`](../jev-skill-suggestion) by Daniel (San) Ávila, merged into one plugin. **It replaces both:** don't install it alongside either one, or prompts are routed twice.

**Early access.** Needs Claude Code 2.1.278 or newer, started with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API may change between releases.

## Install

```sh
npx claude-code-templates@latest --mod productivity/jev-pilot
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-pilot/`. Claude Code loads it as `jev-pilot@skills-dir`, but only in a **trusted project**: accept the trust prompt on the first interactive `claude` there.

Then give it a key in `~/.claude/settings.json` (user settings; project settings are not read). Jev on OpenRouter costs about $0.04 per million input tokens, with free output ([create a key](https://openrouter.ai/keys)):

```json
{ "pluginConfigs": { "jev-pilot@skills-dir": { "options": { "openrouterApiKey": "sk-or-v1-...", "timeoutMs": 1500 } } } }
```

With no key, it still runs on Claude Code's built-in classifier: it routes by tier only, with no confidence and no strategy advice. The first prompt logs `[jev-model-router] ready on openrouter (...)`. `no key set` there means the options are under the wrong key.

To install it for every project instead, with an installer, a `claude-jev` launcher and `claude-jev self-update`, see the project's repository: **[github.com/Akramovic1/jev-pilot](https://github.com/Akramovic1/jev-pilot)**.

## How it decides

**Effort** is a five-level rubric. Each level names a kind of task, not an amount:

| Level | Kind of task |
|---|---|
| `low` | a lookup, one command, a rename, a one-line change |
| `medium` | an ordinary change to a few files |
| `high` | a change across several files, a described bug to trace, tests |
| `xhigh` | design across components, a bug with an unknown cause |
| `max` | novel architecture, security, a failure that resisted earlier attempts |

- **Close calls lean up.** Within `effortCloseMargin` (0.15), the higher of two levels wins.
- **Raising and lowering have different bars.** Raising needs confidence 0.3; lowering needs 0.6.
- **Risky work gets real thought.** A task that would itself deploy, move money or destroy data gets at least `high`.
- **Turns start at `xhigh` at most.** Only the mid-turn raise reaches `max`.

**Subagents** get the cheapest tier that fits their brief: `haiku`, `sonnet` or `opus`. These are family names, so Claude Code uses its current release of each.

**Strategy** advice is added to the prompt as an `<execution_strategy>` block only when Jev is confident (0.6, or 0.8 for `graph`) and the advice agrees with the tier. Claude may ignore it.

**Skills.** One per prompt at most:
1. Rank every skill. Catalogs over the API's 255-choice limit are ranked in parallel batches.
2. Re-read the top three with their `SKILL.md`; each can be rejected.
3. Attach the winner's `SKILL.md` to the prompt.

`/jev-pilot:setup` can hide your own skills from the model's listing, and `restore` undoes it.

**`/jev-pilot:report`** shows, per starting effort, how many turns there were, how many had to be raised, and the average tool calls and output tokens. After 20 turns it suggests specific setting changes. No prompt text is stored.

## Options

All options go under `pluginConfigs["jev-pilot@skills-dir"].options`. The full list, with descriptions, is the `userConfig` in `.claude-plugin/plugin.json`.

| Option | Default | What it does |
|---|---|---|
| `openrouterApiKey` / `typesafeApiKey` / `gatewayApiKey` | — | backend key; `provider: auto` uses TypeSafe, then OpenRouter, then the Gateway |
| `timeoutMs` | 800 | how long to wait for Jev before leaving a turn as built (1500 recommended for OpenRouter) |
| `maxEffort` / `maxRaisedEffort` | `xhigh` / `max` | where a turn may start, and how far a raise may go |
| `escalateAfterErrors` | 2 | failed tool calls in a row before a raise; 0 turns raising off |
| `effortCloseMargin` | 0.15 | how close two levels must be for the higher to win |
| `fastModel` / `balancedModel` / `deepModel` | `haiku` / `sonnet` / `opus` | subagent tiers |
| `routeMainModel` | false | also switch the main conversation's model (invalidates the prompt cache) |
| `suggestStrategy` | true | ask for and attach strategy advice |
| `contextMessages` / `contextChars` | 4 / 2000 | how much of the conversation Jev reads; 0 sends none |
| `recordDecisions` | true | keep the decision record for `/jev-pilot:report` |

## Privacy

With a key set, these go to the chosen backend:
- the prompt;
- the last few messages' text and tool names (never tool input or output);
- skill names and descriptions;
- the opening of the shortlisted `SKILL.md` files.

## Tests

```sh
bun test                                                   # decision logic (tests/*.spec.ts)
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # hooks in Claude Code's engine (engine/*.test.ts)
```

MIT. Portions are copyright Daniel (San) Ávila. Maintained at [github.com/Akramovic1/jev-pilot](https://github.com/Akramovic1/jev-pilot).
