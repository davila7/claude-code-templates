# jev-guardrails

Screens every prompt going into the conversation and every reply coming out of it with [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, the way TypeSafe's [Guardrails for LLMs](https://docs.typesafe.ai/cookbooks/guardrails) cookbook does: one request per message asks a battery of yes/no questions, one per hazard, and one score for how much harm complying would do. The probabilities come back; the thresholds that turn them into a decision are yours, in a named policy.

Labs teach a model to refuse a set of unsafe requests, but each lab draws that line somewhere else, and each new version moves it. Written in a system prompt, the line sits exactly where a jailbreak talks its way past it. Here "ignore your instructions" scores as a jailbreak instead of working as one, and the line is a number you can read.

Two backends, chosen by whichever key is set:

| Backend | Endpoint | Model | Probability |
|---|---|---|---|
| `typesafe` | `POST api.typesafe.ai/v1/systemone` | `jev-latest` | `noul` per hazard, calibrated |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model` | `typesafe-ai/jev` | `probability` per hazard |

TypeSafe's own API wins when both keys are set. Set `provider` to force one, or to `builtin` to use neither. A `provider` forced onto a backend whose key is missing degrades to the built-in classifier and says so once in the log.

**With no key configured the mod still works**: it falls back to the engine's own `$.model.classify`, which reads the same battery as a rubric and answers one of the four actions with the small fast model. That path reports no probability, so the thresholds do not apply to it: the label is the action.

## What it asks

Two batteries, verbatim from the cookbook, asked from the two sides — whether the user is asking for it, and whether the reply went ahead and gave it:

| Input (`prompt.submit`) | Output (`turn.step`) | Action when it fires |
|---|---|---|
| `jailbreak` — tries to override, reveal or role-play past the instructions | `broke_policy` — complied with something it should have declined | **block** |
| `harmful_request` — help with physical harm or a crime | `harmful_request` — supplies that help | **block** |
| `medical_advice` — a diagnosis, a dosage, a treatment decision | `medical_advice` — gives one | **review** |
| `self_harm` — the sender may be considering harming themselves | `self_harm` — encourages or assists it | **support** |
| `severity` — 0 none · 1 mild · 2 serious · 3 severe | same | escalates a review to a block |

Both go in one request, so the whole battery costs one call per message. `disabledHazards` leaves any of them out.

## How it decides

The cookbook's `route()`, unchanged. Each hazard's probability is compared against two thresholds:

- at or above the **action threshold**, the hazard triggers its action (block / review / support);
- at or above the lower **review threshold**, the message goes to review;
- below both, it passes unless another hazard fires.

A `severity` at or above `severityBlock` turns a review into a block. When several fire, `support` outranks `block` outranks `review`: a message that asks for something harmful *and* reads as self-harm goes to support, which is the difference between helping someone and hanging up on them.

Two policies ship, and the probabilities do not move between them:

| Policy | review ≥ | action ≥ | severity blocks at |
|---|---|---|---|
| `strict` (default) | 0.35 | 0.70 | 2.0 |
| `permissive` | 0.35 | 0.85 | 2.0 |

The cookbook's `neurosemantical` jailbreak (0.74) blocks under `strict` and goes to review under `permissive`. Any of the three numbers can be overridden on its own.

## What each action does here

A CLI has no review queue and no support desk, so the four actions land like this:

| Action | Input (a prompt) | Output (a reply) |
|---|---|---|
| **pass** | enters as typed | shown as streamed |
| **review** | **the person is asked** (`$.ui.ask`): *Send it* or *Cancel*. In `claude -p` there is no one to ask, so the prompt enters with a `<guardrail>` note telling the model which hazard was flagged and to answer conservatively | shown, logged as a review |
| **block** | **dropped**: the prompt never enters, and the reason is shown in its place | **withheld**: the text is replaced by a one-line notice naming the hazard and the policy |
| **support** | enters with a `<guardrail>` note telling the model to respond to the person first — acknowledge, do not lecture, offer a way to reach someone — and not to carry on with a task as if nothing was said | withheld, replaced by a notice that includes a crisis line |

On the output side, `screenOutput` picks how far to go:

- `block` (default) — from a response's first text chunk, everything is held until its `stop`; the text is screened, then released or replaced. Tool-only responses, the common case in a coding session, are never held and stream exactly as the engine sent them. A response with text is shown a screening's latency late, all at once.
- `audit` — nothing is held; replies stream live and the screening only writes to the log and the status line. The right setting for measuring your own traffic before turning `block` on.
- `off` — replies are not screened.

A withheld reply keeps its tool calls: only the text is replaced. Tool safety is the job of the other security mods (`block-destructive-commands`, `protected-paths-guard`), not this one's.

Only the main conversation is screened unless `screenSubagents` is on. A subagent's prompt is a tool call's argument, not a `prompt.submit`, so only its replies can be.

**Failure is open by default.** A non-2xx, a timeout past `timeoutMs`, a malformed body, a thrown error: the message goes through untouched and the log says why. `failClosed` turns that around for prompts alone — one that could not be screened is dropped — for a setup where an unscreened prompt is worse than a stalled session. Replies are never dropped for this: a reply already generated and lost to a backend outage costs more than a reply the next screening catches.

## What you see in the transcript

With `logDecisions` on (the default), every screening reports itself, because nothing else in Claude Code shows that it happened:

```
[jev-guardrails] ready on typesafe (https://api.typesafe.ai/v1/systemone); policy strict; screening input, output (block)
[jev-guardrails] in: jailbreak 0.02 · self_harm 0.01 · medical_advice 0.01 · harmful_request 0.01 · severity 0.0 · 284ms
[jev-guardrails] in: pass
[jev-guardrails] out: broke_policy 0.04 · medical_advice 0.02 · harmful_request 0.01 · self_harm 0.01 · severity 0.0 · 301ms
[jev-guardrails] out: pass
[jev-guardrails] in: jailbreak 0.74 · self_harm 0.04 · medical_advice 0.02 · harmful_request 0.01 · severity 0.5 · 266ms
[jev-guardrails] in: BLOCK (jailbreak 0.74)
```

- The first line appears once per session, the first time a hook runs. It is the proof the module loaded, which backend answers it, and which sides are on.
- An `in:` / `out:` pair is what the decision model replied, every hazard surest first, and what the policy then did with it.
- A dropped prompt shows its reason where the reply would have been: `jev-guardrails blocked this prompt (policy strict): jailbreak at 0.74.`

It also keeps a one-line status on screen, replaced as it goes: `guard · in: pass`, `guard · out: block (broke_policy)`.

**No lines at all** has three causes, and only the last is the module failing to load. Check them in this order:

1. **You ran `claude -p` (or the SDK).** A headless run has no transcript and no status row: every line still goes to the debug log, `~/.claude/debug/<session-id>.txt` (`latest` is a symlink to the newest), and an SDK host receives each one as `ui_log`.
2. **The plugin was never loaded.** Claude Code adopts a plugin from a project's `.claude/skills/` (where `--mod` writes it) only once the project is trusted: an untrusted folder's `.claude/` is not read at all, and `claude -p` never asks. Open `claude` interactively in the folder and accept the trust prompt, or name the plugin with `--plugin-dir` (see Install). `claude --debug` settles it: a loaded module prints `hooks module jev-guardrails@skills-dir loaded (worker, …); events: prompt.submit,turn.step`.
3. **Function hooks are off.** Without `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` the debug log says `installed plugins' hooks modules not loaded: rollout flag (tengu_plugin_hooks_modules) is off`. Set the flag; Claude Code must be 2.1.259+.

A `ready on the built-in classifier, no key set` line when you did set a key means the key sits under the wrong `pluginConfigs` entry (see Options).

## Privacy

With a key set, the text of every prompt and every reply leaves the machine and goes to whichever backend the key belongs to. Nothing else — no file contents, no tool results, no transcript. With no key set, nothing leaves the machine.

## Options

```
  typesafeApiKey:   string  TypeSafe API key (preferred: calibrated probabilities)
  gatewayApiKey:    string  Vercel AI Gateway key
  provider:         string  "auto" | "typesafe" | "gateway" | "builtin"
  typesafeBaseUrl:  string  empty uses https://api.typesafe.ai
  typesafeModel:    string  empty uses jev-latest
  gatewayBaseUrl:   string  empty uses https://ai-gateway.vercel.sh/v4/ai
  gatewayModel:     string  empty uses typesafe-ai/jev
  policy:           string  "strict" | "permissive" (default "strict")
  reviewThreshold:  number  overrides the policy's review line (default 0.35)
  actionThreshold:  number  overrides the policy's action line (default 0.70)
  severityBlock:    number  overrides the policy's severity line (default 2.0)
  screenInput:      boolean run the input battery on prompts (default true)
  screenOutput:     string  "block" | "audit" | "off" (default "block")
  screenSubagents:  boolean also screen subagent replies (default false)
  disabledHazards:  string  comma-separated hazards left out of both batteries
  failClosed:       boolean drop a prompt that could not be screened (default false)
  timeoutMs:        number  latency budget per screening (default 1500)
  logDecisions:     boolean log each screening (default true)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "jev-guardrails@skills-dir": { "options": { "typesafeApiKey": "", "policy": "strict" } } } }
```

The entry's key is the plugin's id, and the id follows how the plugin was loaded: `"jev-guardrails@skills-dir"` when auto-loaded from `.claude/skills/` (the `--mod` install), `"jev-guardrails"` with `--plugin-dir`. Under the wrong key every option stays at its default, and the `ready on` line reports `no key set`.

To point the batteries at your own product, edit `INPUT_BATTERY` and `OUTPUT_BATTERY` in `hooks/policy.ts`, map each hazard to an action in `HAZARD_ACTION`, and set the thresholds from labeled examples of your own traffic — `screenOutput: "audit"` is how you collect them.

## Install

```sh
npx claude-code-templates@latest --mod security/jev-guardrails
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-guardrails/` in the project, and Claude Code auto-loads it as `jev-guardrails@skills-dir` **in a trusted project**: a folder's `.claude/` is repository content and is not read until you accept the trust prompt on the first interactive `claude` there (`-p` never asks). The options then go under the `"jev-guardrails@skills-dir"` key in `pluginConfigs`.

For one session with hot reload, or in a folder you do not want to trust, name it on the command line instead — it loads as `jev-guardrails@inline` and reads options from the `"jev-guardrails"` key:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-guardrails
```

Either way, `claude plugin validate .claude/skills/jev-guardrails` prints every event it hooks and every `$` call it makes.

## Tests

```sh
bun test cli-tool/components/mods/security/jev-guardrails/tests
```

The tests replay the cookbook's published rows (`melatonin_dose` → review, `dosage_request` → block by severity, `self_harm` → support, `novelist_poison` → pass, `neurosemantical` → block under strict and review under permissive) against `route()`, and read both wire shapes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so neither `typesafe-sdk` nor the AI SDK is available here: both backends are spoken to over HTTP through `$.http.fetch`. The TypeSafe wire shape (a `noul` with `criteria: { true, false }`, a `score` with a criteria list) follows the cookbook's `Noul`/`NoulCriteria`/`Score` as `typesafe-sdk` 0.5.7 serialises them; the Gateway's, which is `experimental` in the AI SDK and not documented publicly, was read from `@ai-sdk/gateway` v4.0.86 and `@ai-sdk/provider` v4.0.17. Either may change.
