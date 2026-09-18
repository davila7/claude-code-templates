# jev-model-router

Picks the model each task runs on with [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model: unstructured state in, a typed choice with a probability distribution out, no free-form text.

Two backends, chosen by whichever key is set:

| Backend | Endpoint | Model | Confidence |
|---|---|---|---|
| `typesafe` | `POST api.typesafe.ai/v1/systemone` | `jev-latest` | reported per answer |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model` | `typesafe-ai/jev` | derived from an optional distribution |

TypeSafe's own API wins when both keys are set: it is the only one that reports a calibrated confidence, which is what the `minConfidence` threshold reads. Set `provider` to force one, or to `builtin` to use neither. Each backend keeps its own URL and model option, so an override written for one is never sent to the other. A `provider` forced onto a backend whose key is missing degrades to the built-in classifier and says so once in the log.

Two hook points, and they are not equally safe:

- **`agent.spawn`** picks the model of each subagent. On by default. A subagent starts with its own context, so routing it costs nothing beyond the classification.
- **`turn.step`** picks the model of the main conversation. **Off by default.** Switching models mid-session invalidates the prompt cache, and on a long context re-caching can cost more than the cheaper tier saves. Turn it on once you have measured your own sessions, not before.

The prompt is classified at `prompt.submit`, which runs before the turn starts, and the decision is applied to the turn's first model request and reused by the rest of that turn.

**With no key configured the mod still works**: it falls back to the engine's own `$.model.classify`, which answers the same question with the small fast model. That path reports no confidence, so the threshold does not apply to it.

## What it asks

One request, three questions evaluated in parallel:

- `tier` — a `choice` between three descriptions of the *work* (mechanical and local / ordinary engineering / hard or high-stakes). The decision model never sees a model name.
- `effort` — a `score` on a four-level rubric, for how much step-by-step reasoning the task needs.
- `risky` — whether the task touches production, money, credentials, or state that cannot be undone. A `noul` on TypeSafe's API, a `boolean` on the Gateway: the same question under two names.

## How it decides

TypeSafe's API reports a `confidence` per answer. The Gateway's answer shape carries **no `confidence` field**, so on that backend confidence is read as the highest probability in the distribution — and that distribution is itself optional in the schema, in which case confidence is absent and the threshold does not fire.

- `risky` above 0.7 forces the deep tier, whatever the cheaper answer said.
- Confidence below `minConfidence` leaves the model alone.
- With `pinModelFloor` on, a decision that would run *below* the model the session is already on is dropped; only upgrades apply.
- A model id that matches no tier disables the floor instead of guessing.

Every other failure — a non-2xx response, a timeout, a malformed body, a thrown error — leaves the request exactly as the engine built it. The router never blocks a turn.

## Privacy

With a key set, the prompt text leaves the machine and goes to whichever backend the key belongs to. The main-loop path sends the prompt; the subagent path sends the subagent's prompt, its description and its agent type. Nothing else. With no key set, nothing leaves the machine.

## Options

```
  typesafeApiKey: string   TypeSafe API key (preferred: it reports a confidence)
  gatewayApiKey:  string   Vercel AI Gateway key
  provider:        string  "auto" | "typesafe" | "gateway" | "builtin" (default "auto")
  typesafeBaseUrl: string  empty uses https://api.typesafe.ai
  typesafeModel:   string  empty uses jev-latest
  gatewayBaseUrl:  string  empty uses https://ai-gateway.vercel.sh/v4/ai
  gatewayModel:    string  empty uses typesafe-ai/jev
  fastModel:      string   fast tier (default "haiku")
  balancedModel:  string   balanced tier (default "sonnet")
  deepModel:      string   deep tier (default "opus")
  minConfidence:  number   below this the session's model is kept (default 0.6)
  routeSubagents: boolean  route agent.spawn (default true)
  routeMainLoop:  boolean  route the main loop (default false)
  pinModelFloor:  boolean  never route below the current model (default true)
  timeoutMs:      number   latency budget per classification (default 800)
  logDecisions:   boolean  log each decision (default true)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "jev-model-router": { "options": { "typesafeApiKey": "" } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod productivity/jev-model-router
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/jev-model-router/`, which Claude Code auto-loads as `jev-model-router@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-model-router`. `claude plugin validate .claude/skills/jev-model-router` prints every event it hooks and every `$` call it makes.

## Tests

```sh
bun test cli-tool/components/mods/productivity/jev-model-router/tests
```

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so neither `@typesafe-ai/sdk` nor the AI SDK is available here: both backends are spoken to over HTTP through `$.http.fetch`. The TypeSafe wire shape was read from `@typesafe-ai/sdk` v0.6.0; the Gateway's, which is `experimental` in the AI SDK (`experimental_evaluate`, 7.0.105+) and not documented publicly, from `@ai-sdk/gateway` v4.0.86 and `@ai-sdk/provider` v4.0.17. Either may change.
