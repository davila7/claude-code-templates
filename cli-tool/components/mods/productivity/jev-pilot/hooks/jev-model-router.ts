/**
 * jev-model-router — Claude Mod (EARLY ACCESS)
 *
 * Picks the model each task runs on with TypeSafe's Jev, a System One
 * decision model: unstructured state in, a typed choice with a probability
 * distribution out.
 *
 * Jev is reached one of three ways, whichever key is configured: TypeSafe's
 * own API (`typesafeApiKey`) or OpenRouter's Decisions API
 * (`openrouterApiKey`), which report a calibrated confidence per answer, or
 * the Vercel AI Gateway (`gatewayApiKey`), which does not. With none, the engine's own `$.model.classify` stands in, so the mod is
 * useful without any account.
 *
 * Three things it can set, each on its own switch:
 *   agent.spawn  — the model of each subagent (on by default)
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
 * The Agent tool has no effort parameter, so a subagent's effort is not ours
 * to set; only its model is.
 *
 * The prompt is classified at `prompt.submit`, which runs before the turn
 * starts, and the decision is applied at the turn's first request. The
 * decision model reads the prompt with the last few messages before it
 * (text and tool names only; see context.ts), so a follow-up such as "yes, do
 * it" is read as the work it continues, not as a trivial message.
 *
 * The same request asks how the work should be carried out (`strategy`):
 * directly, by one subagent, by parallel subagents, or as a small graph of
 * subagents in waves. Anything but `direct`, answered confidently and
 * consistent with the tier, is attached to the prompt as advice
 * (`<execution_strategy>`); the main model decides whether it fits.
 *
 * Within a turn the effort holds, with one exception: when tool calls keep
 * failing (`escalateAfterErrors` in a row, counted at `tool.call`), the
 * effort goes up at least one rung, once per turn, as far as a fresh reading
 * of the decision model says.
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
import type { HttpInit, HttpResponse, Register } from 'claude-code'
import { NOT_A_TASK, recentContext, signalsOf } from './context.ts'
import type { ContextMessage } from './context.ts'
import { appendEntry, configKeysOf, entriesOf, LEDGER_KEY, reportPrompt, suggestions, summarize } from './ledger.ts'
import type { LedgerEntry, TunableConfig } from './ledger.ts'
import {
  adviseStrategy,
  EFFORT_ORDER,
  effortScoreOf,
  escalate,
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
  modelIds,
  requestModelId,
  route,
  TIER_ORDER,
} from './model-router.policy.ts'
import type { Decision, Effort, PolicyConfig, Provider, StrategyConfig, Tier } from './model-router.policy.ts'

/** Where decisions are asked, when a backend is configured. */
interface Backend {
  provider: Provider
  url: string
  apiKey: string
  modelId: string
  timeoutMs: number
}

/**
 * The engine calls the helpers below need. `$` is never handed to a helper:
 * each hook builds this at its own call site, spelling every call on `$`
 * there (see `io` in register).
 */
interface Io {
  fetch: (url: string, init: HttpInit) => Promise<HttpResponse>
  sleep: (ms: number) => Promise<void>
  log: (text: string) => unknown
  messages: () => Promise<readonly ContextMessage[]>
}

/**
 * One request to the backend, read as a decision; null without a backend, or
 * on timeout, error, a non-2xx or an unreadable answer. Every caller treats
 * null the same way: the request goes on as the engine built it.
 */
async function classify(
  io: Io,
  backend: Backend | null,
  state: Record<string, unknown>,
  withStrategy: boolean,
  what: string,
): Promise<Decision | null> {
  if (!backend) return null
  try {
    const response = await Promise.race([
      io.fetch(backend.url, {
        method: 'POST',
        headers: requestHeaders(backend.provider, backend.apiKey, backend.modelId),
        body: requestBody(backend.provider, state, backend.modelId, withStrategy),
      }),
      io.sleep(backend.timeoutMs),
    ])
    if (response && response.ok) return readDecision(response.text)
    if (response) await io.log(`[jev-model-router] ${backend.provider} responded ${response.status}: ${response.text.slice(0, 200)}`)
    else await io.log(`[jev-model-router] classification passed ${backend.timeoutMs}ms; leaving ${what} alone`)
  } catch (error) {
    await io.log(`[jev-model-router] classification failed: ${String(error)}`)
  }
  return null
}

/** The conversation so far, or none when not `wanted` or unreadable. */
async function readMessages(io: Io, wanted: boolean): Promise<readonly ContextMessage[]> {
  if (!wanted) return []
  try {
    return await io.messages()
  } catch (error) {
    await io.log(`[jev-model-router] could not read the conversation: ${String(error)}`)
    return []
  }
}

/** What prompt.submit knows of a turn's decision, waiting for the turn to start. */
type Draft = Pick<
  LedgerEntry,
  'answered' | 'ms' | 'tier' | 'tierConfidence' | 'effortLevel' | 'effortConfidence' | 'strategy' | 'strategyConfidence' | 'advised'
>

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  // With several keys set, `auto` takes TypeSafe's own API, then OpenRouter,
  // then the Gateway: the first two report the calibrated confidence the
  // policy's threshold reads. `provider` forces one, "builtin" uses none.
  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const openrouterKey = text('openrouterApiKey', '')
  const forced = text('provider', 'auto')
  const active: Provider | null = selectProvider(forced, typesafeKey, gatewayKey, openrouterKey)

  // Each backend keeps its own URL and model, so an override written for one
  // can never be sent to the other when `auto` picks differently than expected.
  const apiKey = !active ? '' : { typesafe: typesafeKey, gateway: gatewayKey, openrouter: openrouterKey }[active]
  const modelId = !active ? '' : text(`${active}Model`, DEFAULT_MODEL[active])
  const url = !active ? '' : endpoint(active, text(`${active}BaseUrl`, DEFAULT_BASE_URL[active]))

  // A backend named in the options but missing its key degrades to the
  // built-in classifier, which is silent; say so once, when a hook first runs.
  let unusableReported = forced === 'auto' || forced === 'builtin' || active !== null

  const timeoutMs = number('timeoutMs', 800)
  const routeSubagentModel = flag('routeSubagentModel', true)
  const routeMainEffort = flag('routeMainEffort', true)
  const routeMainModel = flag('routeMainModel', false)
  const routeMainLoop = routeMainEffort || routeMainModel
  const logDecisions = flag('logDecisions', true)

  // A reasoning level from the options; a value off the ladder is not guessed
  // at and reads as the default.
  const effortOption = (key: string, fallback: Effort): Effort => {
    const value = text(key, fallback)
    return (EFFORT_ORDER as readonly string[]).includes(value) ? (value as Effort) : fallback
  }
  // Two ceilings: where a turn may start, and how far trouble may raise it.
  // Starting lower and raising only on evidence keeps `max` for the turns
  // that show they need it.
  const raisedCeiling: { maxEffort: Effort } = { maxEffort: effortOption('maxRaisedEffort', 'max') }
  const policy: PolicyConfig = {
    tiers: {
      fast: text('fastModel', 'haiku'),
      balanced: text('balancedModel', 'sonnet'),
      deep: text('deepModel', 'opus'),
    },
    minUpgradeConfidence: number('minUpgradeConfidence', 0.3),
    minDowngradeConfidence: number('minDowngradeConfidence', 0.6),
    maxEffort: effortOption('maxEffort', 'xhigh'),
    // A near tie between two effort levels takes the higher one.
    closeMargin: Math.max(0, number('effortCloseMargin', 0.15)),
  }
  const margin = policy.closeMargin ?? 0
  // Each turn's decision and outcome, kept for /jev-pilot:report.
  const recordDecisions = flag('recordDecisions', true)
  const tunable: TunableConfig = {
    timeoutMs,
    minDowngradeConfidence: policy.minDowngradeConfidence,
    effortCloseMargin: margin,
  }

  // How much of the conversation the decision model reads beside a prompt.
  const contextLimits = {
    messages: Math.max(0, Math.round(number('contextMessages', 4))),
    chars: Math.max(0, number('contextChars', 2000)),
  }
  const suggestStrategy = flag('suggestStrategy', true)
  const strategyConfig: StrategyConfig = {
    minConfidence: number('minStrategyConfidence', 0.6),
    minGraphConfidence: number('minGraphConfidence', 0.8),
    graphSkill: text('graphSkill', ''),
  }
  const escalateAfterErrors = Math.max(0, Math.round(number('escalateAfterErrors', 2)))

  const backend: Backend | null = active ? { provider: active, url, apiKey, modelId, timeoutMs } : null

  // The classification waiting for the turn that reads its prompt, and what
  // the current turn settled on. Both are single slots: main-loop turns run
  // one at a time, so nothing accumulates over a long session. `pending`
  // reports no decision when two prompts are waiting at once, rather than
  // routing a turn on a decision made for a different prompt.
  // Each classified prompt waits with its decision and its ledger draft, so
  // the turn that reads it knows which prompt it is working on.
  const pending = pendingDecisions<{ decision: Decision | null; prompt: string; draft: Draft }>()
  // Said once, the first time a hook runs. A router that loaded and one that
  // never loaded are otherwise told apart only by the absence of later lines,
  // and absence is not evidence: the policy leaves most turns alone anyway.
  let announced = false
  let appliedTurnId: string | undefined
  let applied: { model?: string; effort?: Effort } | null = null
  // The prompt the current turn works on (null when its decision was
  // withheld), for a re-reading mid-turn, and the turn whose effort was
  // already raised: at most once each.
  let turnPrompt: string | null = null
  let escalatedTurnId: string | undefined
  // The main loop's tool calls that failed in a row since its last success,
  // counted as they finish (tool.call) and cleared when a turn starts.
  let failedInARow = 0
  // Each family's current full id, learned from the requests the engine makes.
  const ids = modelIds()
  // The ledger: the turn in progress (its draft waits in `pending`).
  let current: (LedgerEntry & { turnId: string }) | null = null

  on('prompt.submit', async ($, e, next) => {
    const io: Io = {
      fetch: (url, init) => $.http.fetch(url, init),
      sleep: (ms) => $.clock.sleep(ms),
      log: (text) => $.ui.log(text),
      messages: () => $.session.messages(),
    }
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
              mainEffort: routeMainEffort,
              mainModel: routeMainModel,
            },
            forced === 'builtin',
          )}`,
        )
      }
    }
    // Only the person's own tasks are classified. A notification, a peer's
    // message or a typed `/command` would otherwise take the pending slot and
    // leave the next real prompt's turn without its decision.
    const isTask = !!e.text.trim() && !/^\/\S/.test(e.text.trim()) && !(e.origin && NOT_A_TASK.has(e.origin.kind))
    if (!isTask || (!routeMainLoop && !suggestStrategy)) return next(e)
    const planning = suggestStrategy

    if (!unusableReported) {
      unusableReported = true
      $.ui.log(`[jev-model-router] provider "${forced}" has no key set; using the built-in classifier`)
    }

    const startedAt = await $.clock.now()
    const messages = await readMessages(io, contextLimits.messages > 0)
    const recent = recentContext(messages, e.text, contextLimits)
    let decision: Decision | null = null
    if (active) {
      decision = await classify(
        io,
        backend,
        { prompt: e.text, recent_context: recent, signals: signalsOf(e.text, messages) },
        planning,
        'the turn',
      )
    } else {
      // No backend: the engine's own small-model classifier answers the same
      // question, without the confidence the policy's threshold reads, and
      // without a strategy (it answers one label).
      try {
        const input = recent ? `Recent conversation:\n${recent}\n\nLatest request:\n${e.text}` : e.text
        const label = await $.model.classify(input, TIER_ORDER)
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
    const ms = (await $.clock.now()) - startedAt
    if (logDecisions) {
      const read = recent ? ` · read ${recent.split('\n').length} recent messages` : ''
      $.ui.log(`[jev-model-router] jev: ${describeDecision(decision, ms, margin)}${read}`)
    }

    let block: string | null = null
    if (planning) {
      const advice = adviseStrategy(decision, strategyConfig)
      block = advice.block
      if (logDecisions) $.ui.log(`[jev-model-router] strategy: ${block ? 'advising ' : ''}${advice.reason}`)
    }
    const draft: Draft = {
      answered: decision !== null,
      ms: active ? Math.round(ms) : null,
      tier: decision?.tier ?? null,
      tierConfidence: decision?.confidence ?? null,
      effortLevel: decision ? effortScoreOf(decision, margin) : null,
      effortConfidence: decision?.effortConfidence ?? null,
      strategy: decision?.strategy ?? null,
      strategyConfidence: decision?.strategyConfidence ?? null,
      advised: block !== null,
    }
    pending.put({ decision, prompt: e.text, draft })
    // Attached on the way down: one block after the prompt as typed, read by
    // the model and never shown to the person.
    const result = await next(block ? { ...e, context: [...(e.context ?? []), block] } : e)
    // Refused further down: no turn will read this decision.
    if (result.drop) pending.withdraw()
    return result
  })

  on('turn.step', async function* ($, e, next) {
    const io: Io = {
      fetch: (url, init) => $.http.fetch(url, init),
      sleep: (ms) => $.clock.sleep(ms),
      log: (text) => $.ui.log(text),
      messages: () => $.session.messages(),
    }
    // Every request names the id the engine resolved for it, a subagent's
    // included: that is where the main loop's switch finds its ids.
    ids.learn(e.model)
    if (!routeMainLoop || e.agentId) return yield* next(e)

    // Every request after the first reuses what the turn settled on, so
    // neither the model nor the effort changes under its own tool loop —
    // unless the loop is visibly struggling, and then only the effort, up.
    if (e.index > 0 && e.turnId === appliedTurnId) {
      if (routeMainEffort && escalateAfterErrors > 0 && escalatedTurnId !== e.turnId) {
        const failed = failedInARow
        if (failed >= escalateAfterErrors) {
          escalatedTurnId = e.turnId
          const effort = applied?.effort ?? e.effort
          const turn = current
          // The turn's own prompt: without one (its decision was withheld),
          // there is nothing to re-read, and the raise is the one rung.
          const prompt = turnPrompt
          const messages = prompt === null ? [] : await readMessages(io, contextLimits.messages > 0)
          const reread =
            prompt === null
              ? null
              : await classify(
                  io,
                  backend,
                  {
                    prompt,
                    recent_context: recentContext(messages, prompt, contextLimits),
                    signals: signalsOf(prompt, messages),
                    trouble: `${failed} tool calls in a row have failed while working on this request`,
                  },
                  false,
                  'the effort',
                )
          const level = reread ? effortScoreOf(reread, margin) : null
          const raised = escalate(effort, failed, escalateAfterErrors, level, raisedCeiling)
          if (raised) {
            applied = { ...(applied ?? {}), effort: raised }
            if (turn && turn.turnId === e.turnId) turn.raisedTo = raised
            if (logDecisions) {
              $.ui.log(`[jev-model-router] main loop → effort ${raised}: ${failed} tool calls failed in a row`)
              $.ui.status(`jev · struggling → ${raised}`)
            }
          } else if (logDecisions) {
            $.ui.log(`[jev-model-router] ${failed} tool calls failed in a row; effort ${String(effort)} kept`)
          }
        }
      }
      return yield* next(applied ? { ...e, ...applied } : e)
    }

    // A new turn: failures of the last one say nothing about this one.
    failedInARow = 0
    const taken = pending.take()
    const decision = taken?.decision ?? null
    turnPrompt = taken?.prompt ?? null
    const routing = route(decision, { model: e.model, effort: e.effort }, policy)
    const change: { model?: string; effort?: Effort } = {}
    // The main loop's `model` is sent to the API as written, so an alias
    // becomes the id the engine was seen using for it; a subagent's
    // (agent.spawn) may stay an alias.
    if (routeMainModel && routing.model) {
      const id = requestModelId(routing.model, ids)
      if (id) change.model = id
      else if (logDecisions) {
        $.ui.log(`[jev-model-router] no ${routing.model} model seen yet this session; model left as ${e.model}`)
      }
    }
    if (routeMainEffort && routing.effort) change.effort = routing.effort

    appliedTurnId = e.turnId
    applied = Object.keys(change).length > 0 ? change : null
    if (recordDecisions) {
      // A decision withheld (two prompts waiting) is recorded as unanswered:
      // the turn ran on the engine's own settings.
      const known = decision ? (taken?.draft ?? null) : null
      const startEffort = change.effort ?? e.effort
      current = {
        turnId: e.turnId,
        at: await $.clock.now(),
        answered: known?.answered ?? false,
        ms: known?.ms ?? null,
        tier: known?.tier ?? null,
        tierConfidence: known?.tierConfidence ?? null,
        effortLevel: known?.effortLevel ?? null,
        effortConfidence: known?.effortConfidence ?? null,
        startedFrom: typeof e.effort === 'string' ? e.effort : null,
        started: typeof startEffort === 'string' ? startEffort : null,
        raisedTo: null,
        toolCalls: 0,
        failures: 0,
        strategy: known?.strategy ?? null,
        strategyConfidence: known?.strategyConfidence ?? null,
        advised: known?.advised ?? false,
        outcome: null,
        durationMs: null,
        outputTokens: null,
      }
    }
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

  // Observation only: the main loop's tool calls, counted as they finish, so
  // a struggling turn is seen without re-reading the transcript every step,
  // and so the ledger knows how much each turn did.
  // A refusal (a denied permission) is the person's choice, not the task
  // going wrong: it neither counts nor clears the run.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && !result.deny) {
      failedInARow = result.isError ? failedInARow + 1 : 0
      if (current) {
        current.toolCalls++
        current.failures = Math.max(current.failures, failedInARow)
      }
    }
    return result
  })

  // The end of a main-loop turn closes its ledger entry: how it ended, how
  // long it took, what it produced. Written after the engine's own handling.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && current && current.turnId === e.turnId) {
      const { turnId: _turnId, ...entry } = current
      current = null
      const finished: LedgerEntry = {
        ...entry,
        outcome: e.reason,
        durationMs: e.durationMs,
        outputTokens: e.usage?.output_tokens ?? null,
      }
      try {
        await $.store.set(LEDGER_KEY, appendEntry(await $.store.get(LEDGER_KEY), finished))
      } catch (error) {
        $.ui.log(`[jev-model-router] could not record the turn: ${String(error)}`)
      }
    }
    return result
  })

  // `/clear` or a resume starts another session in this worker: nothing
  // waiting or in progress carries over. The learned model ids stay: they
  // are the engine's own and still valid. (Under a match-all matcher: the
  // skill module hooks session.end too, and one unmatched hook per plugin.)
  on('session.end', { sessionId: /(?:)/ }, async ($, e, next) => {
    pending.clear()
    current = null
    appliedTurnId = undefined
    applied = null
    escalatedTurnId = undefined
    turnPrompt = null
    failedInARow = 0
    return next(e)
  })

  // `/jev-pilot:report`: the ledger summarised, with suggested changes;
  // `/jev-pilot:report reset` clears it. The command's markdown is a
  // placeholder: the prompt the model reads is written here.
  on('skill.prompt', { skill: 'jev-pilot:report' }, async ($, e, next) => {
    try {
      if (/\breset\b/i.test(e.text)) {
        await $.store.delete(LEDGER_KEY)
        return next({ ...e, text: 'Tell the user the jev-pilot decision ledger was cleared. Change nothing else.' })
      }
      const entries = entriesOf(await $.store.get(LEDGER_KEY))
      const home = (await $.env.get('HOME')) ?? '~'
      const settingsPath = `${home}/.claude/settings.json`
      // The key jev-pilot's options live under depends on how it was
      // installed (marketplace, --mod, --plugin-dir): read which exist.
      let keys: string[] = []
      try {
        if (await $.fs.exists(settingsPath)) keys = configKeysOf(await $.fs.read(settingsPath))
      } catch {
        keys = []
      }
      const text = reportPrompt(summarize(entries, tunable), settingsPath, suggestions(entries, tunable).length > 0, keys)
      return next({ ...e, text })
    } catch (error) {
      return next({ ...e, text: `Tell the user the jev-pilot ledger could not be read: ${String(error)}. Change nothing.` })
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const io: Io = {
      fetch: (url, init) => $.http.fetch(url, init),
      sleep: (ms) => $.clock.sleep(ms),
      log: (text) => $.ui.log(text),
      messages: () => $.session.messages(),
    }
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
              mainEffort: routeMainEffort,
              mainModel: routeMainModel,
            },
            forced === 'builtin',
          )}`,
        )
      }
    }

    // A fork inherits its parent's model; `model` is ignored for it.
    if (!routeSubagentModel || e.fork) return next(e)

    if (!unusableReported) {
      unusableReported = true
      $.ui.log(`[jev-model-router] provider "${forced}" has no key set; using the built-in classifier`)
    }

    const startedAt = await $.clock.now()
    let decision: Decision | null = null
    if (active) {
      // A subagent's brief is self-contained by design: no conversation added.
      decision = await classify(
        io,
        backend,
        { prompt: e.prompt, description: e.description, agentType: e.subagentType },
        false,
        'the subagent',
      )
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
    // The Agent tool takes no effort, so only the model is ours to set here.
    const current = e.model ?? e.parentModel
    const { model, reason } = route(decision, { model: current }, policy)
    if (!model) {
      if (logDecisions) $.ui.log(`[jev-model-router] ${e.subagentType}: ${reason}`)
      return next(e)
    }
    if (logDecisions) $.ui.log(`[jev-model-router] ${e.subagentType} → ${model}: ${reason}`)
    return next({ ...e, model })
  })
}
