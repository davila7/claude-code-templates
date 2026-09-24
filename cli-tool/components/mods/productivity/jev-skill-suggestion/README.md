# jev-skill-suggestion

Takes the skill listing out of the context window and lets [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, pick at most one skill per prompt from the skills' descriptions — and then loads that one skill itself, by attaching its `SKILL.md` to the prompt. The skills stay installed and you can still type `/name`; what goes away is the listing Claude Code sends the model every session — one line per skill, sixty-odd lines on a well-equipped machine — whether or not the prompt has anything to do with any of them. Because the mod does the loading, the skills can be hidden from the model altogether (`/jev-skill-suggestion:setup` sets them `user-invocable-only`), and `/skills` and `/context` then show the saving.

The decision is TypeSafe's own [skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion), which on a 182-skill roster cut wrong skill loads from 16.8% to 7.3% and needless ones from 9.8% to 4.0%: two requests per prompt, one that ranks every skill and asks whether the prompt needs a skill at all, one that re-reads the top three properly and can reject all of them.

Three backends, chosen by whichever key is set:

| Backend | Endpoint | Model | Confidence |
|---|---|---|---|
| `typesafe` | `POST api.typesafe.ai/v1/systemone` | `jev-latest` | reported per answer |
| `openrouter` | `POST openrouter.ai/api/alpha/decisions` | `typesafe/jev-1.13` | reported per answer |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model` | `typesafe-ai/jev` | derived from an optional distribution |

With more than one key set, `auto` takes TypeSafe's own API, then OpenRouter, then the Gateway. The first two report a calibrated confidence per answer, which the log shows beside every pick; the Gateway does not. Set `provider` to force one, or to `builtin` to use none of them. Each backend keeps its own URL and model option, so an override written for one is never sent to another. A `provider` forced onto a backend whose key is missing degrades to the built-in classifier and says so once in the log.

**With no key configured the mod still works**: it falls back to the engine's own `$.model.classify`, which answers the ranking question with the small fast model, the descriptions folded into the text it reads. That path has no gate and no second request: its single answer is taken as is.

## Quick start

Five steps, in this order. Each one is checkable before the next.

**1. Install and start.** Claude Code 2.1.278 or newer, in a project you trust:

```sh
npx claude-code-templates@latest --mod productivity/jev-skill-suggestion
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

The first prompt of the session prints `[jev-skill-suggestion] ready on …; withholding the skill listing` in the transcript. From here on the listing is already kept from the model on every prompt — but `/skills` and `/context` do not know that yet (see [Checking that it works](#checking-that-it-works)), which is what the next step is for.

**2. Hand the skills over.** In Claude Code:

```
/jev-skill-suggestion:setup
```

The mod fills the command in at run time with your real roster and Claude shows you, in your language, three lists before touching anything:

- the skills it will set to `user-invocable-only` in `~/.claude/settings.json` (`skillOverrides`) — your user-level skills, the project's (the working directory's `.claude/`, not its ancestors: a git worktree only sees its own copies) and those synced from claude.ai;
- Claude Code's bundled skills (`simplify`, `loop`, `init`, …), turned off together with `disableBundledSkills: true`;
- the skills a plugin ships, which `skillOverrides` cannot touch: they stay listed unless you disable the plugin in `/plugin`.

Say yes, and Claude first writes the previous values to `~/.claude/jev-skill-suggestion.skill-overrides.backup.json`, then edits `~/.claude/settings.json` with the Edit tool — so the change shows as a diff and asks for permission like any other file edit. Nothing is written before your yes. Running the command again proposes only what is still to change (`0` on a machine already set up) and leaves the backup from the first run untouched, so it is safe to repeat after installing new skills.

**3. Restart Claude Code** — `/skills` and `/context` read the settings at start-up.

**4. Check.** `/skills` lists every hidden skill as `user-only`; `/context`'s "Skills" row counts only what a plugin ships. Then ask for something one of your skills does:

```
Make me a 5-slide pptx deck about Q3 results. Before building anything, tell me which skill instructions you have and what their first workflow step is.
```

The status row under the prompt reads `jev · skill: <name>`, the transcript shows `suggesting /<name>` and `injected /<name> from <its SKILL.md> (N characters)`, and the answer follows that skill's own steps — the skill was never in the model's listing and the Skill tool would have refused it. A prompt with no skill in it (`Explain in two sentences what a monad is`) reads `jev · no skill` and `no suggestion`.

**5. Undo, whenever.** `/jev-skill-suggestion:setup restore` puts the saved values back (and removes the backup); restart afterwards. Do this before uninstalling the mod, or your skills stay hidden from the model with nothing left to inject them.

Skills you have hidden are still yours to run by typing `/name`.

## How it works

Three hooks, two on the way in and one on the way out:

| Hook | What it does |
|---|---|
| `prompt.attachment` on `skill_listing` | Answers the engine's skill listing with `{ text: null }`, so the model never reads it — or with the listing trimmed to the names in `alwaysListed`. The names the listing carried are remembered. |
| `prompt.submit` | Runs the two requests below and attaches the one winner, if any, to the prompt as a `<skill_relevance>` block the model reads and the user never sees — with the skill's own `SKILL.md` inside it (`inject: "content"`, the default), or with its name alone for the Skill tool (`inject: "suggest"`). |
| `skill.prompt` | Observation: logs whether a skill the model loaded was the suggested one. Also writes the prompt of `/jev-skill-suggestion:setup` (see Install). |

The block the model reads, in place of the listing:

```
<skill_relevance>
Relevant to the current request: commit. Ignore this if it does not fit what the user actually asked for.
Its instructions follow: follow them now, including any setup steps. Do not load it with the Skill tool (it is already loaded here, and the tool may refuse it). Its files are in /home/me/.claude/skills/commit.
<skill name="commit" dir="/home/me/.claude/skills/commit">
…the SKILL.md body, frontmatter off, ${CLAUDE_SKILL_DIR} and ${CLAUDE_PROJECT_DIR} filled in…
</skill>
</skill_relevance>
```

The first line is the cookbook's, word for word: it says the suggestion can be ignored, because pushing harder wins compliance on wrong suggestions too, and a wrong one is worse than none. The rest is the skill as the engine would have rendered it on a Skill-tool call, so the model has it whether or not the engine would let it load the skill: a skill set to `user-invocable-only` or `off` in `skillOverrides` is refused by the Skill tool, and this is what makes hiding every skill workable. A skill injected once is only named again on later prompts (`Skill /commit is already loaded above; instructions unchanged.`), as the engine does on a repeated call — until the conversation is no longer the one it went into: `/clear`, a resume or a compaction of the main conversation start the count over, and the next pick goes in whole again. A skill whose file cannot be found (a bundled one) is suggested by name, for the Skill tool.

What the Skill tool does that this does not: apply the skill's `allowed-tools`, and count as a skill invocation for `/skill-doctor`.

With `inject: "suggest"` the block is the cookbook's: the name, and with the listing withheld the skill's line and the way to load it. A turn with nothing to suggest, while the listing is in place (`hideListing: false`), still sends `No skill in the roster appears relevant to this request.`, so the roster's own "err on the side of loading" is not left unopposed. With the listing withheld there is nothing to oppose, so nothing is sent. In this mode the call stays the model's, and a skill hidden with `skillOverrides` cannot be loaded.

A typed `/name` still loads any skill, suggested or not.

**Where the candidates come from.** The listing is rendered at the turn's first model request, *after* `prompt.submit` has run, so the first prompt of a session would have nothing to choose from if the listing were the source. The candidates come from `$.command.list()` instead — every command the person can run, less the built-ins (`/help`, `/clear`, and Claude Code's bundled skills, which have no file to inject) and the names in `neverSuggested`. Skills hidden with `skillOverrides` are still candidates: the mod loads the winner itself. With `inject: "suggest"`, once a listing has been seen only the skills it named are offered, since there the Skill tool does the loading and the listing is the engine's word on what it will load. A skill whose own frontmatter says `disable-model-invocation: true` is never picked in either mode.

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

`shortlist` is a floor rather than an exact count. A Choice takes at most 255 options, so a listing above that is split across several of them, and scores from different splits are not comparable — the ranking interleaves them instead. If the shortlist were smaller than the number of splits, the last splits would never be re-read and their skills could not be picked at all. The shortlist is therefore raised to the number of splits when that is larger, which past 765 skills means one extra body read per further 255.

This is where lookalikes separate — on one line the skill that *edits* `.pptx` files reads nearly the same as the one that *authors* them; on 700 characters they do not.

The skill bodies come from disk, by where Claude Code keeps them: `.claude/skills/<name>/SKILL.md` and `.claude/commands/<name>.md` in the project and under `~`, `~/.claude/skills/synced/<account>/<name>/SKILL.md` for a skill synced from claude.ai, and for a plugin's skill its install path from `~/.claude/plugins/installed_plugins.json`. A body that cannot be found leaves that candidate with its one-line description; the request still goes out. Bodies are read once per session, and the same read is what gets injected.

- The Gateway answers a `noul` as a `boolean` with a `probability`; both shapes are read.
- `rerank: false` skips the second request and suggests the top of the ranking, once the gate passes. A second request that was *attempted* and failed suggests nothing: the ranking's winner has not had its false-positive check.
- A skill whose frontmatter says `disable-model-invocation: true` is never suggested, whichever path picked it: the engine leaves it out of the listing and the Skill tool refuses it. Before the first listing has been seen the candidates come from `$.command.list()`, which also names such skills, so their SKILL.md is the check (read for the shortlist and for the winner).
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
[jev-skill-suggestion] injected /pptx-author from /home/me/.claude/skills/pptx-author/SKILL.md (4210 characters)
[jev-skill-suggestion] withheld the skill listing (58 skills, 9127 characters); kept listed: none
[jev-skill-suggestion] jev: needs a skill 0.12 · top of 58: debug (0.41), code-review (0.22), commit (0.05) · 150ms
[jev-skill-suggestion] no suggestion: needs a skill 0.12 < 0.3
```

- The first line appears once per session, the first time a hook runs. It is the proof the module loaded and which backend answers it.
- The two `jev:` lines are what the decision model replied to each request, before any policy is applied — the gate, the top of the ranking, then the rerank's winner and every `fits`, with how long each call took and how many SKILL.md bodies were found.
- `injected /name from <file>` is the skill going in with the prompt; `already injected this session; named again` on a repeat.
- `withheld the skill listing` is the listing hook firing, with what it cost the context and what it kept. It appears after the first prompt's lines, because that is when the engine renders the listing. While it still counts skills, the mod adds `N skills are still listed for the model … run /jev-skill-suggestion:setup` once per session.
- `skill /name loaded` is the model calling the Skill tool on its own (`inject: "suggest"`, or a typed `/name`): `as suggested`, or which skill was suggested instead when it reached for another.

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

## Checking that it works

Three places tell you different things, and only one of them is what the model was actually sent:

| Where | What it shows | Reflects the mod? |
|---|---|---|
| `/skills` | each skill's state (`on`, `name-only`, `user-only`, `off`) and its estimated listing cost | after `setup`: the hidden ones read `user-only` |
| `/context` → Skills | an estimate rendered from the roster, without asking the `prompt.attachment` hooks | **no** while skills are `on`: it reads the same with the mod as without (5.4k tokens for a 40-skill roster in our test). After `setup` it counts only what is still listed — the plugin skills |
| the API request | what the model read | **yes**: the first request's `input_tokens` in the session's `.jsonl` under `~/.claude/projects/` drop by the listing's size (5,496 tokens in that test), `/context`'s "Messages" row — computed from what was sent — drops the same, and a model asked *"is there a skill listing in your context?"* answers no |

So the mod is at work from the first prompt, and `setup` is what makes the two panels agree with it. The transcript lines (above) are the running proof: `withheld the skill listing (N skills, …)` says what was kept from the model on that prompt, and `injected /name from …` that the one skill needed went in instead.

What stays counted after `setup`: skills shipped by plugins (`/skills` marks them `locked by plugin`; disable the plugin in `/plugin` to remove them) — the mod's own `/jev-skill-suggestion:setup` is not among them, its `disable-model-invocation: true` keeps its description out of the listing.

If `/skills` still shows one of your own skills as `on` after `setup` and a restart, its directory holds a SKILL.md whose frontmatter `name:` differs from the directory name; run `setup` again — the mod maps such names to the directory the engine goes by — or delete the skill if it is a stray copy.

## Privacy

With a key set, the prompt text and every candidate skill's name and one-line description leave the machine on the first request, and the first `excerptChars` of each shortlisted skill's SKILL.md on the second, to whichever backend the key belongs to. Nothing else. With no key set, nothing leaves the machine.

## Options

```
  typesafeApiKey:    string  TypeSafe API key (preferred: it reports a confidence)
  openrouterApiKey:  string  OpenRouter API key (also reports a confidence)
  gatewayApiKey:     string  Vercel AI Gateway key
  provider:          string  "auto" | "typesafe" | "openrouter" | "gateway" | "builtin"
  typesafeBaseUrl:   string  empty uses https://api.typesafe.ai
  typesafeModel:     string  empty uses jev-latest
  openrouterBaseUrl: string  empty uses https://openrouter.ai/api/alpha
  openrouterModel:   string  empty uses typesafe/jev-1.13
  gatewayBaseUrl:    string  empty uses https://ai-gateway.vercel.sh/v4/ai
  gatewayModel:      string  empty uses typesafe-ai/jev
  inject:            string  "content" attaches the chosen skill's SKILL.md (default); "suggest" names it for the Skill tool
  hideListing:       boolean withhold the engine's skill listing (default true)
  rerank:            boolean second request over the shortlist (default true)
  shortlist:         number  how many of the ranking the second request re-reads (default 3, floor)
  gateThreshold:     number  gate mean under which nothing is suggested (default 0.3)
  fitsThreshold:     number  best `fits` under which the shortlist is dropped (default 0.3)
  excerptChars:      number  SKILL.md characters each candidate brings (default 700)
  alwaysListed:      string  comma-separated names that stay in the listing
  neverSuggested:    string  comma-separated names never offered to the decision model
  timeoutMs:         number  latency budget per request (default 800)
  logDecisions:      boolean log each decision (default true)
```

`inject: "suggest"` with `hideListing: false` reproduces the cookbook exactly — the listing stays, the suggestion goes on top — and is the way to measure the suggestions against what the model would have chosen on its own before committing to the saving. The two thresholds are the cookbook's; TypeSafe's [confidence guide](https://docs.typesafe.ai/confidence) is the place to read before moving them. `alwaysListed` is for the one or two skills you want the model to know about on every prompt (a house-style `commit`, say); `neverSuggested` for skills that should only ever run when the user types them.

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "jev-skill-suggestion": { "options": { "typesafeApiKey": "" } } } }
```

The entry's key is the plugin's id, and the id follows how the plugin was loaded: `"jev-skill-suggestion@skills-dir"` when auto-loaded from `.claude/skills/` (the `--mod` install), `"jev-skill-suggestion"` with `--plugin-dir`. Under the wrong key every option stays at its default, and the `ready on` line reports `no key set`.

## Install

The full sequence is in [Quick start](#quick-start); this is the detail behind it.

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

**The setup command.** `/jev-skill-suggestion:setup` is a markdown command the plugin ships (`commands/setup.md`) whose text the mod replaces in its `skill.prompt` hook with the plan built from `$.command.list()` and the settings as they are; its `disable-model-invocation: true` keeps it out of the model's listing. A skill whose frontmatter `name:` is not its directory name (`name: "PocketBase API Rules"` in `pb-api-rules/`) is written by its directory name, which is what the engine lists, runs and overrides. `setup restore` reads `~/.claude/jev-skill-suggestion.skill-overrides.backup.json` and puts every saved entry back, removing the ones the setup added. Both modes end with a restart of Claude Code. The command only ever proposes an edit; Claude makes it with the Edit tool after you confirm, so a `--permission-mode plan` session shows the plan and changes nothing.

Uninstalling: run `/jev-skill-suggestion:setup restore` first, or your skills stay hidden from the model with nothing left to inject them.

Pairs with [jev-model-router](../jev-model-router/README.md), which asks the same decision model which model and effort a prompt deserves; the two share a key and run side by side, each prefixing its own transcript lines.

## Tests

```sh
bun test cli-tool/components/mods/productivity/jev-skill-suggestion/tests
```

**Early access.** Mods need `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. This mod needs **Claude Code 2.1.278 or newer**: the `prompt.attachment` event it hooks to withhold the listing first shipped there. On an older release the module loads but the event never fires, so the listing stays and only the suggestion is added. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so neither `@typesafe-ai/sdk` nor the AI SDK is available here: every backend is spoken to over HTTP through `$.http.fetch`. The TypeSafe wire shape was read from `@typesafe-ai/sdk` v0.6.0. OpenRouter's decisions API takes that same shape, the same `noul` question type and the same `confidence` field, on its own host and under its own model id. The Gateway's, which is `experimental` in the AI SDK (`experimental_evaluate`, 7.0.105+) and not documented publicly, was read from `@ai-sdk/gateway` v4.0.86 and `@ai-sdk/provider` v4.0.17. Any of the three may change.
