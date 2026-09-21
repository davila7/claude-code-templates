/**
 * jev-guardrails — Claude Mod (EARLY ACCESS)
 *
 * Screens every message going into and out of the main conversation with
 * TypeSafe's Jev, a System One decision model, the way TypeSafe's
 * "Guardrails for LLMs" cookbook does: one request per message carries a
 * battery of yes/no questions (is this a jailbreak? harm or a crime? a
 * diagnosis or a dosage? self-harm?) and one score for how much harm
 * complying would do. The probabilities come back; the thresholds that turn
 * them into pass / review / block / support live here, in a named policy.
 *
 * Two hooks:
 *   prompt.submit  — the input battery on the user's prompt.
 *                    pass     the prompt enters as typed.
 *                    review   the person is asked (`$.ui.ask`): send it, or
 *                             cancel; a dismissed dialog cancels too. With
 *                             no one to ask (a `-p` run, told by an empty
 *                             `$.session.surfaces()`) the prompt enters
 *                             with a <guardrail> note for the model instead.
 *                    block    `{ drop }` without `next`: the prompt never
 *                             enters, and the reason is shown.
 *                    support  the prompt enters with a note that tells the
 *                             model to respond to the person first; a
 *                             refusal here is the wrong answer.
 *   turn.step      — the output battery on each response's visible text.
 *                    `screenOutput: "block"` (default) holds the text from
 *                    its first chunk until the response's `stop`, screens
 *                    it, and either releases it or replaces it with a
 *                    withheld notice. `"audit"` streams everything live and
 *                    only logs. Tool-only responses are never held.
 *
 * Jev is reached one of two ways, whichever key is configured: TypeSafe's
 * own API (`typesafeApiKey`), which reports a calibrated probability per
 * answer, or the Vercel AI Gateway (`gatewayApiKey`). With neither, the
 * engine's own `$.model.classify` stands in, answering one of the four
 * actions with no probability, so the mod is useful without any account.
 *
 * Only the main conversation is screened unless `screenSubagents` is on: a
 * subagent's prompt is a tool call's argument, not a `prompt.submit`, so
 * only its output can be.
 *
 * Every failure path is fail-open by default: a request that errors or runs
 * past the latency budget lets the message through untouched, and says so.
 * `failClosed` turns that around for the input side: a prompt that could not
 * be screened is dropped. Output is never fail-closed.
 *
 * The API key comes from the plugin's options (userConfig "typesafeApiKey"
 * or "gatewayApiKey"). Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Privacy: with a key set, the prompt text and the model's replies are sent
 * to whichever backend the key belongs to.
 */
import type { Register, TurnStepChunk, TurnStepTextChunk } from 'claude-code'
import {
  BUILTIN_LABELS,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_POLICY,
  POLICIES,
  REVIEW_CANCEL,
  REVIEW_SEND,
  blockReason,
  builtinRouting,
  classifyText,
  contextBlock,
  describeRouting,
  describeScreen,
  describeSetup,
  describeStatus,
  endpoint,
  parseNames,
  readScreen,
  requestBody,
  requestHeaders,
  resolvePolicy,
  reviewQuestion,
  route,
  selectProvider,
  supportReplacement,
} from './policy.ts'
import type { Provider, Routing, Screen } from './policy.ts'

/** Prompt origins that are not the person's own words: nothing to screen. */
const NOT_A_MESSAGE = new Set([
  'task-notification',
  'peer',
  'peer-send-message',
  'projects-relay',
  'observer',
  'observer-activity',
  'auto-continuation',
  'plugin',
])

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const optional = (key: string) => (typeof options[key] === 'number' ? (options[key] as number) : undefined)
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  // TypeSafe's own API is preferred when both keys are set: it is the only
  // one that reports a calibrated probability. `provider` forces one,
  // including "builtin" to use neither.
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
  // built-in classifier, which is silent; say so once, when a hook first runs.
  let unusableReported = forced === 'auto' || forced === 'builtin' || active !== null

  const policyName = POLICIES[text('policy', DEFAULT_POLICY)] ? text('policy', DEFAULT_POLICY) : DEFAULT_POLICY
  const policy = resolvePolicy(policyName, {
    reviewThreshold: optional('reviewThreshold'),
    actionThreshold: optional('actionThreshold'),
    severityBlock: optional('severityBlock'),
  })
  const screenInput = flag('screenInput', true)
  const outputMode = text('screenOutput', 'block')
  const screenOutput: 'block' | 'audit' | 'off' =
    outputMode === 'audit' ? 'audit' : outputMode === 'off' ? 'off' : 'block'
  const screenSubagents = flag('screenSubagents', false)
  const disabled = parseNames(text('disabledHazards', ''))
  const failClosed = flag('failClosed', false)
  const timeoutMs = number('timeoutMs', 1500)
  const logDecisions = flag('logDecisions', true)

  // Said once, the first time a hook runs. A mod that loaded and one that
  // never loaded are otherwise told apart only by the absence of later lines,
  // and absence is not evidence: most messages pass.
  let announced = false
  const setupLines = (): string[] => {
    if (announced) return []
    announced = true
    const lines: string[] = []
    if (logDecisions) {
      lines.push(
        `[jev-guardrails] ${describeSetup(active, url, policyName, { input: screenInput, output: screenOutput }, forced === 'builtin')}`,
      )
    }
    if (!unusableReported) {
      unusableReported = true
      lines.push(`[jev-guardrails] provider "${forced}" has no key set; using the built-in classifier`)
    }
    return lines
  }

  /** The log line for what the backend answered, whichever backend it was. */
  const answered = (screen: Screen | null, routing: Routing | null, ms: number): string =>
    active ? describeScreen(screen, ms) : `built-in → ${routing?.action ?? 'no answer'} · ${Math.round(ms)}ms`

  on('prompt.submit', async ($, e, next) => {
    for (const line of setupLines()) $.ui.log(line)
    if (!screenInput) return next(e)
    // A typed `/name` runs a command; a notification or a peer's message is
    // not the person's own words. Neither is screened.
    if (!e.text.trim() || /^\/\S/.test(e.text.trim())) return next(e)
    if (e.origin && NOT_A_MESSAGE.has(e.origin.kind)) return next(e)

    const startedAt = await $.clock.now()
    let screen: Screen | null = null
    let routing: Routing | null = null
    if (active) {
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(active, apiKey, modelId),
            body: requestBody(active, e.text, 'input', disabled, modelId),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) screen = readScreen(response.text, 'input', disabled)
        else if (response) $.ui.log(`[jev-guardrails] ${active} responded ${response.status} to the input screening`)
        else $.ui.log(`[jev-guardrails] input screening passed ${timeoutMs}ms`)
      } catch (error) {
        $.ui.log(`[jev-guardrails] input screening failed: ${String(error)}`)
      }
      if (screen) routing = route(screen, policy)
    } else {
      // No backend: the engine's own small-model classifier answers one of
      // the four actions, with no probability for the thresholds to read.
      try {
        routing = builtinRouting(await $.model.classify(classifyText(e.text, 'input', disabled), BUILTIN_LABELS))
      } catch (error) {
        $.ui.log(`[jev-guardrails] built-in classifier failed: ${String(error)}`)
      }
    }

    // What the decision model actually answered, whatever the policy then
    // does with it. This is the line that proves the screening ran.
    if (logDecisions) {
      const ms = (await $.clock.now()) - startedAt
      $.ui.log(`[jev-guardrails] in: ${answered(screen, routing, ms)}`)
      $.ui.log(`[jev-guardrails] in: ${describeRouting(routing)}`)
      // A row in the transcript scrolls away; this line stays on screen.
      $.ui.status(describeStatus('input', routing))
    }

    if (!routing) {
      // Fail-closed is a choice, never a default: a backend outage would
      // otherwise stop every prompt.
      if (failClosed) return { drop: 'jev-guardrails could not screen this prompt (failClosed is on); nothing entered.' }
      return next(e)
    }

    switch (routing.action) {
      case 'pass':
        return next(e)
      case 'block':
        // Answered without `next`: the prompt never enters, and the reason
        // is what the person sees.
        return { drop: blockReason('input', routing, policyName) }
      case 'support':
        return next({ ...e, context: [...(e.context ?? []), contextBlock('support', routing)] })
      case 'review': {
        // The person is the review path. `$.ui.ask` rejects both when there
        // is no one to ask (a `-p` run) and when the dialog is dismissed, and
        // the two must not land the same way: headless lets the prompt
        // through with a note, a dismissal cancels it. `$.session.surfaces()`
        // tells them apart up front: it is empty in a plain `-p` run.
        let surfaces = 0
        try {
          surfaces = (await $.session.surfaces()).length
        } catch (error) {
          $.ui.log(`[jev-guardrails] review: could not read the surfaces (${String(error)}); treating as headless`)
        }
        if (surfaces === 0) {
          if (logDecisions) $.ui.log('[jev-guardrails] review: no one to ask (headless); passed with a note')
          return next({ ...e, context: [...(e.context ?? []), contextBlock('review', routing)] })
        }
        let answer: string | null = null
        try {
          answer = await $.ui.ask(reviewQuestion(routing), { options: [REVIEW_SEND, REVIEW_CANCEL], header: 'guardrail' })
        } catch (error) {
          if (logDecisions) $.ui.log(`[jev-guardrails] review: dialog dismissed (${String(error)}); cancelled`)
        }
        if (answer === REVIEW_SEND) {
          if (logDecisions) $.ui.log('[jev-guardrails] review: sent as typed')
          return next(e)
        }
        // Cancel, free text under "Other", or a dismissed dialog: anything
        // but an explicit yes keeps the prompt out.
        if (logDecisions) $.ui.log(`[jev-guardrails] review: cancelled (${answer ?? 'dismissed'})`)
        return { drop: `jev-guardrails: prompt cancelled at review (${routing.hazard ?? 'flagged'}).` }
      }
    }
  })

  on('turn.step', async function* ($, e, next) {
    for (const line of setupLines()) $.ui.log(line)
    if (screenOutput === 'off' || (e.agentId && !screenSubagents)) return yield* next(e)

    const stream = next(e)
    // Nothing is held until the response says something: a tool-only step,
    // the common case in a coding session, streams exactly as the engine
    // sent it. From the first text chunk on, every chunk is held in order
    // so nothing is shown before its screening; `audit` holds nothing.
    const held: TurnStepChunk[] = []
    let holding = false
    let answer = ''
    let firstTextIndex = 0
    let replacedWith: string | null = null

    for await (const chunk of stream) {
      if (chunk.kind === 'text') {
        if (!holding && screenOutput === 'block') {
          holding = true
          firstTextIndex = chunk.index
        }
        answer += chunk.text
      }
      if (chunk.kind !== 'stop') {
        if (holding) held.push(chunk)
        else yield chunk
        continue
      }

      // The response is whole. Screen its text, then release or replace.
      if (!answer.trim()) {
        for (const kept of held) yield kept
        yield chunk
        continue
      }

      const startedAt = await $.clock.now()
      let screen: Screen | null = null
      let routing: Routing | null = null
      if (active) {
        try {
          const response = await Promise.race([
            $.http.fetch(url, {
              method: 'POST',
              headers: requestHeaders(active, apiKey, modelId),
              body: requestBody(active, answer, 'output', disabled, modelId),
            }),
            $.clock.sleep(timeoutMs),
          ])
          if (response && response.ok) screen = readScreen(response.text, 'output', disabled)
          else if (response) $.ui.log(`[jev-guardrails] ${active} responded ${response.status} to the output screening`)
          else $.ui.log(`[jev-guardrails] output screening passed ${timeoutMs}ms`)
        } catch (error) {
          $.ui.log(`[jev-guardrails] output screening failed: ${String(error)}`)
        }
        if (screen) routing = route(screen, policy)
      } else {
        try {
          routing = builtinRouting(await $.model.classify(classifyText(answer, 'output', disabled), BUILTIN_LABELS))
        } catch (error) {
          $.ui.log(`[jev-guardrails] built-in classifier failed: ${String(error)}`)
        }
      }
      if (logDecisions) {
        const ms = (await $.clock.now()) - startedAt
        $.ui.log(`[jev-guardrails] out: ${answered(screen, routing, ms)}`)
        $.ui.log(`[jev-guardrails] out: ${describeRouting(routing)}${screenOutput === 'audit' ? ' (audit)' : ''}`)
        $.ui.status(describeStatus('output', routing))
      }

      // Output is never fail-closed: a reply already generated and lost to a
      // backend outage costs more than a reply the next screening catches.
      const withhold = holding && routing !== null && (routing.action === 'block' || routing.action === 'support')
      if (!withhold || !routing) {
        for (const kept of held) yield kept
        yield chunk
        continue
      }

      // The text is dropped and one chunk built afresh stands in its place;
      // the response's tool calls, if any, go on as the engine streamed them.
      // Tool safety is the other security mods' job (block-destructive-commands,
      // protected-paths-guard), not this one's.
      replacedWith =
        routing.action === 'support' ? supportReplacement(policyName) : blockReason('output', routing, policyName)
      const replacement: TurnStepTextChunk = { kind: 'text', index: firstTextIndex, text: replacedWith }
      let replaced = false
      for (const kept of held) {
        if (kept.kind !== 'text') {
          yield kept
          continue
        }
        if (!replaced) {
          replaced = true
          yield replacement
        }
      }
      if (!replaced) yield replacement
      yield chunk
    }

    // What the hooks above read: the answer as it was shown, not as the
    // engine streamed it.
    const result = await stream.result
    return replacedWith === null ? result : { ...result, answer: replacedWith }
  })
}
