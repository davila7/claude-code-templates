/**
 * jev-model-router — Claude Mod (EARLY ACCESS)
 *
 * Picks the model each task runs on with TypeSafe's Jev, a System One
 * decision model: unstructured state in, a typed choice with a probability
 * distribution out.
 *
 * Jev is reached one of two ways, whichever key is configured: TypeSafe's
 * own API (`typesafeApiKey`), which reports a calibrated confidence per
 * answer, or the Vercel AI Gateway (`gatewayApiKey`), which does not. With
 * neither, the engine's own `$.model.classify` stands in, so the mod is
 * useful without any account.
 *
 * Four things it can set, each on its own switch:
 *   agent.spawn  — the model of each subagent (on by default)
 *   turn.step    — the reasoning effort of each subagent, from the decision
 *                  made at its spawn (on by default)
 *   turn.step    — the reasoning effort of the main loop (on by default)
 *   turn.step    — the model of the main loop (off by default: switching
 *                  models mid-session invalidates the prompt cache, which can
 *                  cost more than the cheaper tier saves)
 *
 * Every one of them moves in both directions: a task the decision model reads
 * as mechanical is routed down, one it reads as hard is routed up. The two
 * mistakes do not cost the same, so they do not clear the same confidence bar
 * (see `minUpgradeConfidence` / `minDowngradeConfidence` in policy.ts).
 *
 * The Agent tool has no effort parameter, but a subagent's requests pass
 * through `turn.step` with its `agentId`, which `agent.spawn`'s `next()`
 * returns before the subagent's first request; the effort decided at the
 * spawn is set there, on every request of that subagent.
 *
 * The prompt is classified at `prompt.submit`, which runs before the turn
 * starts, and the decision is applied at the turn's first request.
 *
 * Every failure path is fail-open: a classification that errors or runs past
 * the latency budget leaves the request exactly as the engine built it.
 *
 * The API key comes from the plugin's options (userConfig "typesafeApiKey"
 * or "gatewayApiKey"). Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Privacy: with a key set, the prompt text is sent to whichever backend the
 * key belongs to.
 */
import type { Register, TurnStepInput } from 'claude-code'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  describeDecision,
  describeSetup,
  describeStatus,
  endpoint,
  pendingDecisions,
  readDecision,
  selectProvider,
  requestBody,
  requestHeaders,
  requestModelId,
  route,
  EFFORT_ORDER,
  TIER_ORDER,
  bareCommand,
} from './policy.ts'
import type { Decision, Effort, PolicyConfig, Provider, Tier } from './policy.ts'

/** The effort a request can carry: a level, or a number on the caller's own scale. */
type StepEffort = NonNullable<TurnStepInput['effort']>

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  // TypeSafe's own API is preferred when both keys are set: it is the only
  // one that reports a calibrated confidence, which the policy's threshold
  // reads. `provider` forces one, including "builtin" to use neither.
  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const forced = text('provider', 'auto')
  const active: Provider | null = selectProvider(forced, typesafeKey, gatewayKey)

  // Each backend keeps its own URL and model, so an override written for one
  // can never be sent to the other when `auto` picks differently than expected.
  const apiKey = active === 'typesafe' ? typesafeKey : active === 'gateway' ? gatewayKey : ''
  const modelId = !active
    ? ''
    : active === 'typesafe'
      ? text('typesafeModel', DEFAULT_MODEL.typesafe)
      : text('gatewayModel', DEFAULT_MODEL.gateway)
  const url = !active
    ? ''
    : active === 'typesafe'
      ? endpoint('typesafe', text('typesafeBaseUrl', DEFAULT_BASE_URL.typesafe))
      : endpoint('gateway', text('gatewayBaseUrl', DEFAULT_BASE_URL.gateway))

  // A backend named in the options but missing its key degrades to the
  // built-in classifier, which is silent; say so once, when a hook first runs,
  // along with an effort bound that is not a level.
  let unusableReported = false

  const timeoutMs = number('timeoutMs', 800)
  const routeSubagentModel = flag('routeSubagentModel', true)
  const routeSubagentEffort = flag('routeSubagentEffort', true)
  // The highest and lowest effort routing may move a subagent to; empty for none.
  const effortBound = (key: string) => {
    const option = text(key, '').trim().toLowerCase()
    return { option, level: (EFFORT_ORDER as readonly string[]).includes(option) ? (option as Effort) : undefined }
  }
  const maxSubagentEffort = effortBound('maxSubagentEffort')
  const minSubagentEffort = effortBound('minSubagentEffort')
  const routeMainEffort = flag('routeMainEffort', true)
  const routeMainModel = flag('routeMainModel', false)
  const routeMainLoop = routeMainEffort || routeMainModel
  const logDecisions = flag('logDecisions', true)

  const policy: PolicyConfig = {
    tiers: {
      fast: text('fastModel', 'haiku'),
      balanced: text('balancedModel', 'sonnet'),
      deep: text('deepModel', 'opus'),
    },
    minUpgradeConfidence: number('minUpgradeConfidence', 0.3),
    minDowngradeConfidence: number('minDowngradeConfidence', 0.6),
  }

  // The classification waiting for the turn that reads its prompt, and what
  // the current turn settled on. Both are single slots: main-loop turns run
  // one at a time, so nothing accumulates over a long session. `pending`
  // reports no decision when two prompts are waiting at once, rather than
  // routing a turn on a decision made for a different prompt.
  const pending = pendingDecisions()
  // Said once, the first time a hook runs. A router that loaded and one that
  // never loaded are otherwise told apart only by the absence of later lines,
  // and absence is not evidence: the policy leaves most turns alone anyway.
  let announced = false
  let appliedTurnId: string | undefined
  let applied: { model?: string; effort?: Effort } | null = null
  // Each subagent's spawn decision until its first request settles it into an
  // effort (or none), kept for the rest of its requests so the effort never
  // moves under its own cache. A finished run keeps its entry: a named
  // subagent can be sent more work, each run a turn of its own under the same
  // id. Only the latest 256 subagents are kept.
  const subagents = new Map<string, { decision: Decision } | { effort: StepEffort | null }>()
  const remember = (agentId: string, entry: { decision: Decision } | { effort: StepEffort | null }) => {
    subagents.set(agentId, entry)
    for (const oldest of subagents.keys()) {
      if (subagents.size <= 256) break
      subagents.delete(oldest)
    }
  }

  on('prompt.submit', async ($, e, next) => {
    // Before the routing guards: a module whose switches are all off has still
    // loaded, and that is exactly when its silence is most misleading.
    if (!announced) {
      announced = true
      if (logDecisions) {
        $.ui.log(
          `[jev-model-router] ${describeSetup(
            active,
            url,
            {
              subagentModel: routeSubagentModel,
              subagentEffort: routeSubagentEffort,
              mainEffort: routeMainEffort,
              mainModel: routeMainModel,
            },
            forced === 'builtin',
          )}`,
        )
      }
    }
    if (!routeMainLoop) return next(e)

    if (!unusableReported) {
      unusableReported = true
      if (forced !== 'auto' && forced !== 'builtin' && !active) {
        $.ui.log(`[jev-model-router] provider "${forced}" has no key set; using the built-in classifier`)
      }
      for (const [key, bound] of [['maxSubagentEffort', maxSubagentEffort], ['minSubagentEffort', minSubagentEffort]] as const) {
        if (bound.option && !bound.level) $.ui.log(`[jev-model-router] ${key} "${bound.option}" is not low, medium, high or xhigh; it is ignored`)
      }
    }

    // A slash command alone gives the decision model only the command's name.
    // Its turn keeps the session's model and effort; the null put keeps a
    // previous prompt's decision from reaching it.
    if (bareCommand(e.text)) {
      if (logDecisions) $.ui.log('[jev-model-router] a command with nothing after it; leaving the turn alone')
      pending.put(null)
      return next(e)
    }

    const startedAt = await $.clock.now()
    let decision: Decision | null = null
    if (active) {
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(active, apiKey, modelId),
            body: requestBody(active, { prompt: e.text }, modelId),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) decision = readDecision(response.text)
        else if (response) $.ui.log(`[jev-model-router] ${active} responded ${response.status}`)
        else $.ui.log(`[jev-model-router] classification passed ${timeoutMs}ms; leaving the turn alone`)
      } catch (error) {
        $.ui.log(`[jev-model-router] classification failed: ${String(error)}`)
      }
    } else {
      // No backend: the engine's own small-model classifier answers the same
      // question, without the confidence the policy's threshold reads.
      try {
        const label = await $.model.classify(e.text, TIER_ORDER)
        if (label) {
          decision = {
            tier: label as Tier,
            confidence: null,
            risky: null,
            effort: null,
            effortConfidence: null,
          }
        }
      } catch (error) {
        $.ui.log(`[jev-model-router] built-in classifier failed: ${String(error)}`)
      }
    }

    // What the decision model actually answered, whatever the policy then
    // does with it. This is the line that proves the classification ran.
    if (logDecisions) {
      const ms = (await $.clock.now()) - startedAt
      $.ui.log(`[jev-model-router] jev: ${describeDecision(decision, ms)}`)
    }

    pending.put(decision)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      if (!routeSubagentEffort) return yield* next(e)
      const held = subagents.get(e.agentId)
      let effort: StepEffort | null = null
      if (held && 'effort' in held) {
        effort = held.effort
      } else {
        // The first request settles it. One that arrives before the spawn's
        // decision (not seen) settles on none, so a later request never moves
        // the effort under the subagent's cache. A model with no effort
        // (Haiku) is left without one.
        let routed: Effort | null = null
        if (held && e.effort !== undefined) {
          const routing = route(held.decision, { model: e.model, effort: e.effort }, {
            ...policy,
            maxEffort: maxSubagentEffort.level,
            minEffort: minSubagentEffort.level,
          })
          routed = routing.effort
          if (logDecisions) {
            const what = routed ? `→ effort ${routed}: ` : ''
            $.ui.log(`[jev-model-router] subagent ${e.agentId.slice(0, 8)} ${what}${routing.reason}`)
          }
        }
        // Not routed, it keeps the effort it started with, so a change to the
        // session's effort mid-run does not reach its cache either.
        effort = routed ?? e.effort ?? null
        remember(e.agentId, { effort })
      }
      return yield* next(effort !== null && effort !== e.effort ? { ...e, effort } : e)
    }
    if (!routeMainLoop) return yield* next(e)

    // Every request after the first reuses what the turn settled on, so
    // neither the model nor the effort changes under its own tool loop.
    if (e.index > 0 && e.turnId === appliedTurnId) {
      return yield* next(applied ? { ...e, ...applied } : e)
    }

    const decision = pending.take()
    const routing = route(decision, { model: e.model, effort: e.effort }, policy)
    const change: { model?: string; effort?: Effort } = {}
    // The main loop's `model` is sent to the API as written, so an alias
    // becomes its id here; a subagent's (agent.spawn) may stay an alias.
    if (routeMainModel && routing.model) change.model = requestModelId(routing.model)
    if (routeMainEffort && routing.effort) change.effort = routing.effort

    appliedTurnId = e.turnId
    applied = Object.keys(change).length > 0 ? change : null
    // A row in the transcript scrolls away; this line stays on screen.
    if (logDecisions) $.ui.status(describeStatus(decision, applied))

    if (!applied) {
      // A turn left alone is the common case, and it used to be silent, which
      // made a working mod look like one that never loaded. Say what happened.
      if (logDecisions) {
        const suppressed = routing.model && !routeMainModel ? ' (main-loop model routing off)' : ''
        $.ui.log(`[jev-model-router] main loop: ${routing.reason}${suppressed}`)
      }
      return yield* next(e)
    }
    if (logDecisions) {
      const what = [change.model, change.effort && `effort ${change.effort}`]
        .filter(Boolean)
        .join(', ')
      $.ui.log(`[jev-model-router] main loop → ${what}: ${routing.reason}`)
    }
    return yield* next({ ...e, ...change })
  })

  on('agent.spawn', async ($, e, next) => {
    // Before the routing guards: a module whose switches are all off has still
    // loaded, and that is exactly when its silence is most misleading.
    if (!announced) {
      announced = true
      if (logDecisions) {
        $.ui.log(
          `[jev-model-router] ${describeSetup(
            active,
            url,
            {
              subagentModel: routeSubagentModel,
              subagentEffort: routeSubagentEffort,
              mainEffort: routeMainEffort,
              mainModel: routeMainModel,
            },
            forced === 'builtin',
          )}`,
        )
      }
    }

    // A fork inherits its parent's model; `model` is ignored for it. It
    // continues the parent's conversation, so its effort is left as inherited
    // too: its requests find no decision here and settle on none.
    if ((!routeSubagentModel && !routeSubagentEffort) || e.fork) return next(e)

    if (!unusableReported) {
      unusableReported = true
      if (forced !== 'auto' && forced !== 'builtin' && !active) {
        $.ui.log(`[jev-model-router] provider "${forced}" has no key set; using the built-in classifier`)
      }
      for (const [key, bound] of [['maxSubagentEffort', maxSubagentEffort], ['minSubagentEffort', minSubagentEffort]] as const) {
        if (bound.option && !bound.level) $.ui.log(`[jev-model-router] ${key} "${bound.option}" is not low, medium, high or xhigh; it is ignored`)
      }
    }

    const startedAt = await $.clock.now()
    let decision: Decision | null = null
    if (active) {
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(active, apiKey, modelId),
            body: requestBody(
              active,
              { prompt: e.prompt, description: e.description, agentType: e.subagentType },
              modelId,
            ),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) decision = readDecision(response.text)
        else if (response) $.ui.log(`[jev-model-router] ${active} responded ${response.status}`)
        else $.ui.log(`[jev-model-router] classification passed ${timeoutMs}ms; leaving the subagent alone`)
      } catch (error) {
        $.ui.log(`[jev-model-router] classification failed: ${String(error)}`)
      }
    } else {
      try {
        const label = await $.model.classify(e.prompt, TIER_ORDER)
        if (label) {
          decision = {
            tier: label as Tier,
            confidence: null,
            risky: null,
            effort: null,
            effortConfidence: null,
          }
        }
      } catch (error) {
        $.ui.log(`[jev-model-router] built-in classifier failed: ${String(error)}`)
      }
    }

    if (logDecisions) {
      const ms = (await $.clock.now()) - startedAt
      $.ui.log(`[jev-model-router] jev (${e.subagentType}): ${describeDecision(decision, ms)}`)
    }

    // The subagent's own model wins when the caller named one; otherwise it
    // would inherit the parent's, so that is what a change is measured from.
    // The Agent tool takes no effort: that is set at the subagent's first
    // request (turn.step), from the decision kept here under its id.
    const current = e.model ?? e.parentModel
    const { model, reason } = routeSubagentModel
      ? route(decision, { model: current }, policy)
      : { model: null, reason: 'subagent model routing off' }
    if (logDecisions) $.ui.log(`[jev-model-router] ${e.subagentType}${model ? ` → ${model}` : ''}: ${reason}`)
    const result = await next(model ? { ...e, model } : e)
    if (routeSubagentEffort && decision && result.agentId && !subagents.has(result.agentId)) {
      remember(result.agentId, { decision })
    }
    return result
  })
}
