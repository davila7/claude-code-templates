# jev-skill-suggestion

Takes the skill listing out of the context window and lets [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, suggest at most one skill per prompt from the skills' descriptions. The skills stay installed and loadable; what goes away is the listing Claude Code sends the model every session — one line per skill, sixty-odd lines on a well-equipped machine — whether or not the prompt has anything to do with any of them.

The decision is TypeSafe's own [skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion), which on a 182-skill roster cut wrong skill loads from 16.8% to 7.3% and needless ones from 9.8% to 4.0%: two requests per prompt, one that ranks every skill and asks whether the prompt needs a skill at all, one that re-reads the top three properly and can reject all of them.

Two backends, chosen by whichever key is set:

| Backend | Endpoint | Model | Confidence |
|---|---|---|---|
| `typesafe` | `POST api.typesafe.ai/v1/systemone` | `jev-latest` | reported per answer |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model` | `typesafe-ai/jev` | derived from an optional distribution |

TypeSafe's own API wins when both keys are set: it is the only one that reports a calibrated confidence per answer, which the log shows beside every pick. Set `provider` to force one, or to `builtin` to use neither. Each backend keeps its own URL and model option, so an override written for one is never sent to the other. A `provider` forced onto a backend whose key is missing degrades to the built-in classifier and says so once in the log.

**With no key configured the mod still works**: it falls back to the engine's own `$.model.classify`, which answers the ranking question with the small fast model, the descriptions folded into the text it reads. That path has no gate and no second request: its single answer is taken as is.

## How it works

Two hooks, one on each side of the exchange:

| Hook | What it does |
|---|---|
| `prompt.attachment` on `skill_listing` | Answers the engine's skill listing with `{ text: null }`, so the model never reads it — or with the listing trimmed to the names in `alwaysListed`. The names the listing carried are remembered. |
| `prompt.submit` | Runs the two requests below and attaches the one winner, if any, to the prompt as a `<skill_relevance>` block the model reads and the user never sees. |
| `skill.prompt` | Observation only: logs whether the skill the model loaded was the suggested one. |

The block the model reads, in place of the listing:

```
<skill_relevance>
Relevant to the current request: commit. Ignore this if it does not fit what the user actually asked for.
- commit: Create a git commit from the staged changes
Load it with the Skill tool (skill: "commit") before you start. The full skill listing is withheld from your context; the user can invoke any skill by typing /name.
</skill_relevance>
```

The first line is the cookbook's, word for word: it says the suggestion can be ignored, because pushing harder wins compliance on wrong suggestions too, and a wrong one is worse than none. The rest is only there because the listing is gone — the model has no line to look the name up in. With `hideListing: false` the block is the cookbook's alone, and a turn with nothing to suggest still sends `No skill in the roster appears relevant to this request.`, so the roster's own "err on the side of loading" is not left unopposed. With the listing withheld there is nothing to oppose, so nothing is sent.

The call stays the model's: a suggestion is a hint, not a preload. A typed `/name` still loads any skill, suggested or not.

**Where the candidates come from.** The listing is rendered at the turn's first model request, *after* `prompt.submit` has run, so the first prompt of a session would have nothing to choose from if the listing were the source. The candidates come from `$.command.list()` instead — every command the person can run, less the built-ins (`/help`, `/clear`) and the names in `neverSuggested`. Once a listing has been seen, only the skills it named are offered: the listing is the engine's word on which skills the model is allowed to invoke, and `$.command.list()` also names commands it may not (a skill with `disable-model-invocation: true`).

**Only the main conversation.** A subagent's own skill listing is left as the engine renders it. Its prompt is a tool call's argument, not a `prompt.submit`, so nothing here could suggest for it, and hiding its listing would leave it with no skills at all.

**The listing hook always answers the same way**, so the model's prompt cache holds: the engine asks once per attachment and keeps the answer for the process.

## How it decides

Two requests, in the cookbook's shape. Each may come back empty-handed.

**Request 1 — skim every skill.** One `choice` (`which`) over every candidate, with its one-line description as the criterion; its probability distribution is the ranking. Beside it, three `noul`s about the *request*, not about any skill:

| noul | asks |
|---|---|
| `acts_on_user_system` | Is the assistant being asked to act on the user's files, accounts, devices or services, rather than only to explain or advise? |
| `would_follow_documented_procedure` | Would a careful expert consult a specific documented procedure or set of commands, rather than answer from general understanding? |
| `prose_suffices` | Could a knowledgeable generalist fully satisfy this in prose, with no tools and no access to the user's files? (counts the other way round) |

Their mean is the gate: under `gateThreshold` (0.30) nothing is suggested, whatever the ranking said. Questions about subject matter would not do this job — *explain what a monad is* and a task that needs a skill are both software.

**Request 2 — read the top three properly.** The same `choice` over the shortlist (`shortlist`, 3), now with each skill's full frontmatter description and the first `excerptChars` (700) of its SKILL.md as the criterion, and one `noul` per candidate — *does this skill do the specific thing the request asks for?* — answered on its own, so all of them can come back low. A shortlist whose best `fits` is under `fitsThreshold` (0.30) is dropped entirely; otherwise the `choice`'s winner is suggested. The two decide different things: the `choice` settles *which*, the `noul`s settle *whether*.

This is where lookalikes separate — on one line the skill that *edits* `.pptx` files reads nearly the same as the one that *authors* them; on 700 characters they do not.

The skill bodies come from disk, by where Claude Code keeps them: `.claude/skills/<name>/SKILL.md` and `.claude/commands/<name>.md` in the project and under `~`, and for a plugin's skill its install path from `~/.claude/plugins/installed_plugins.json`. A body that cannot be found leaves that candidate with its one-line description; the request still goes out. Bodies are read once per session.

- The Gateway answers a `noul` as a `boolean` with a `probability`; both shapes are read.
- `rerank: false` skips the second request and suggests the top of the ranking, once the gate passes.
- The built-in classifier answers one label from the descriptions, with no gate and no second request.

Every failure — a non-2xx response, a timeout past `timeoutMs` on either request, a thrown error, a malformed body — lets the prompt through with no suggestion. The mod never blocks a prompt.

Prompts that are not a task get no suggestion: notifications, peer messages, observer reports, and a prompt that is itself a `/name` (its skill is already named).

## What you see in the transcript

With `logDecisions` on (the default), the mod reports every step of its own work, because nothing else in Claude Code shows it — a listing that was never sent leaves no trace:

```
[jev-skill-suggestion] ready on typesafe (https://api.typesafe.ai/v1/systemone); withholding the skill listing
[jev-skill-suggestion] jev: needs a skill 0.76 · top of 58: powerpoint (0.70), pptx-author (0.30), chroma (0.00) · 160ms
[jev-skill-suggestion] jev: rerank → pptx-author (0.81) · fits powerpoint 0.73, pptx-author 0.38, chroma 0.02 · 90ms · 3/3 bodies read
[jev-skill-suggestion] suggesting /pptx-author: rerank of 3, fits 0.38
[jev-skill-suggestion] withheld the skill listing (58 skills, 9127 characters); kept listed: none
[jev-skill-suggestion] skill /pptx-author loaded (as suggested)
[jev-skill-suggestion] jev: needs a skill 0.12 · top of 58: debug (0.41), code-review (0.22), commit (0.05) · 150ms
[jev-skill-suggestion] no suggestion: needs a skill 0.12 < 0.3
```

- The first line appears once per session, the first time a hook runs. It is the proof the module loaded and which backend answers it.
- The two `jev:` lines are what the decision model replied to each request, before any policy is applied — the gate, the top of the ranking, then the rerank's winner and every `fits`, with how long each call took and how many SKILL.md bodies were found.
- `withheld the skill listing` is the listing hook firing, with what it cost the context and what it kept. It appears after the first prompt's lines, because that is when the engine renders the listing.
- `skill /name loaded` is the model acting: `as suggested`, or which skill was suggested instead when it reached for another — the one measure of whether the suggestions are any good.

It also keeps a one-line status on screen, replaced as it goes:

```
jev · skill: pptx-author
jev · no skill
```

**No lines at all** has three causes, and only the last is the module failing to load. Check them in this order:

1. **You ran `claude -p` (or the SDK).** A headless run has no transcript and no status row: every line still goes to the debug log, `~/.claude/debug/<session-id>.txt` (a `.txt`, not a `.log`; `latest` is a symlink to the newest), and an SDK host receives each one as `ui_log`.
2. **The plugin was never loaded.** Claude Code adopts a plugin from a project's `.claude/skills/` (where `--mod` writes it) only once the project is trusted: it is repository content, so an untrusted folder's `.claude/` is not read at all, and `claude -p` never asks. Open `claude` interactively in the folder and accept the trust prompt, or name the plugin explicitly with `--plugin-dir` (see Install). `claude --debug` settles it: a loaded module prints `hooks module jev-skill-suggestion@skills-dir loaded (worker, …); events: prompt.attachment,prompt.submit,skill.prompt` (`@inline` when loaded with `--plugin-dir`); `Found N plugins` without it means the plugin is not in the session.
3. **Function hooks are off.** Without `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` the debug log says `installed plugins' hooks modules not loaded: rollout flag (tengu_plugin_hooks_modules) is off`. Set the flag; Claude Code must be 2.1.278+ (see below).

A `ready on the built-in classifier, no key set` line when you did set a key means the key sits under the wrong `pluginConfigs` entry: the key must match the plugin's id, which depends on how it was loaded (see Options).

To confirm the listing is really gone, `/context` shows the skill listing's share of the window; with the mod on it reads zero (or only the `alwaysListed` names).

## Privacy

With a key set, the prompt text and every candidate skill's name and one-line description leave the machine on the first request, and the first `excerptChars` of each shortlisted skill's SKILL.md on the second, to whichever backend the key belongs to. Nothing else. With no key set, nothing leaves the machine.

## Options

```
  typesafeApiKey:   string  TypeSafe API key (preferred: it reports a confidence)
  gatewayApiKey:    string  Vercel AI Gateway key
  provider:         string  "auto" | "typesafe" | "gateway" | "builtin"
  typesafeBaseUrl:  string  empty uses https://api.typesafe.ai
  typesafeModel:    string  empty uses jev-latest
  gatewayBaseUrl:   string  empty uses https://ai-gateway.vercel.sh/v4/ai
  gatewayModel:     string  empty uses typesafe-ai/jev
  hideListing:      boolean withhold the engine's skill listing (default true)
  rerank:           boolean second request over the shortlist (default true)
  shortlist:        number  how many of the ranking the second request re-reads (default 3)
  gateThreshold:    number  gate mean under which nothing is suggested (default 0.3)
  fitsThreshold:    number  best `fits` under which the shortlist is dropped (default 0.3)
  excerptChars:     number  SKILL.md characters each candidate brings (default 700)
  alwaysListed:     string  comma-separated names that stay in the listing
  neverSuggested:   string  comma-separated names never offered to the decision model
  timeoutMs:        number  latency budget per request (default 800)
  logDecisions:     boolean log each decision (default true)
```

`hideListing: false` reproduces the cookbook exactly — the listing stays, the suggestion goes on top — and is the way to measure the suggestions against what the model would have chosen on its own before committing to the saving. The two thresholds are the cookbook's; TypeSafe's [confidence guide](https://docs.typesafe.ai/confidence) is the place to read before moving them. `alwaysListed` is for the one or two skills you want the model to know about on every prompt (a house-style `commit`, say); `neverSuggested` for skills that should only ever run when the user types them.

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "jev-skill-suggestion": { "options": { "typesafeApiKey": "" } } } }
```

The entry's key is the plugin's id, and the id follows how the plugin was loaded: `"jev-skill-suggestion@skills-dir"` when auto-loaded from `.claude/skills/` (the `--mod` install), `"jev-skill-suggestion"` with `--plugin-dir`. Under the wrong key every option stays at its default, and the `ready on` line reports `no key set`.

## Install

```sh
npx claude-code-templates@latest --mod productivity/jev-skill-suggestion
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-skill-suggestion/` in the project, and Claude Code auto-loads it as `jev-skill-suggestion@skills-dir` **in a trusted project**: a folder's `.claude/` is repository content and is not read until you accept the trust prompt on the first interactive `claude` there (`-p` never asks, so a headless run in a fresh folder never sees it). The options then go under the `"jev-skill-suggestion@skills-dir"` key in `pluginConfigs` (see Options).

For one session with hot reload, or in a folder you do not want to trust, name it on the command line instead — it loads as `jev-skill-suggestion@inline` and reads options from the `"jev-skill-suggestion"` key:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-skill-suggestion
```

Either way, `claude plugin validate .claude/skills/jev-skill-suggestion` prints every event it hooks and every `$` call it makes.

Pairs with [jev-model-router](../jev-model-router/README.md), which asks the same decision model which model and effort a prompt deserves; the two share a key and run side by side.

## Tests

```sh
bun test cli-tool/components/mods/productivity/jev-skill-suggestion/tests
```

**Early access.** Mods need `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. This mod needs **Claude Code 2.1.278 or newer**: the `prompt.attachment` event it hooks to withhold the listing first shipped there. On an older release the module loads but the event never fires, so the listing stays and only the suggestion is added. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so neither `@typesafe-ai/sdk` nor the AI SDK is available here: both backends are spoken to over HTTP through `$.http.fetch`. The TypeSafe wire shape was read from `@typesafe-ai/sdk` v0.6.0; the Gateway's, which is `experimental` in the AI SDK (`experimental_evaluate`, 7.0.105+) and not documented publicly, from `@ai-sdk/gateway` v4.0.86 and `@ai-sdk/provider` v4.0.17. Either may change.
