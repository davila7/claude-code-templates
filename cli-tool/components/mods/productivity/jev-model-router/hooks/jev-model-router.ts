/**
 * jev-model-router — Claude Mod (EARLY ACCESS)
 *
 * Picks the model each task runs on with TypeSafe's Jev, a System One
 * decision model: unstructured state in, a typed choice with a probability
 * distribution out. Jev is reached through the Vercel AI Gateway
 * (`typesafe-ai/jev`); with no key configured the engine's own
 * `$.model.classify` stands in, so the mod is useful without any account.
 *
 * Two hook points:
 *   agent.spawn  — the model of each subagent (on by default)
 *   turn.step    — the model of the main loop (off by default: switching
 *                  models mid-session invalidates the prompt cache, which can
 *                  cost more than the cheaper tier saves)
 *
 * The prompt is classified at `prompt.submit`, which runs before the turn
 * starts, and the decision is applied at the turn's first request.
 *
 * Every failure path is fail-open: a classification that errors or runs past
 * the latency budget leaves the request exactly as the engine built it.
 *
 * The API key comes from the plugin's options (userConfig "gatewayApiKey").
 * Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Privacy: with a key set, the prompt text is sent to the AI Gateway.
 */
import type { Register } from 'claude-code'
import { readDecision, requestBody, requestHeaders, route, TIER_ORDER } from './policy.ts'
import type { Decision, PolicyConfig, Tier } from './policy.ts'

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  const apiKey = text('gatewayApiKey', '')
  const baseUrl = text('baseUrl', 'https://ai-gateway.vercel.sh/v4/ai').replace(/\/+$/, '')
  const modelId = text('modelId', 'typesafe-ai/jev')
  const timeoutMs = number('timeoutMs', 800)
  const routeSubagents = flag('routeSubagents', true)
  const routeMainLoop = flag('routeMainLoop', false)
  const logDecisions = flag('logDecisions', true)

  const policy: PolicyConfig = {
    tiers: {
      fast: text('fastModel', 'haiku'),
      balanced: text('balancedModel', 'sonnet'),
      deep: text('deepModel', 'opus'),
    },
    minConfidence: number('minConfidence', 0.6),
    pinModelFloor: flag('pinModelFloor', true),
  }

  const url = `${baseUrl}/evaluation-model`

  // The most recent classification, and the model the current turn settled on.
  // Main-loop turns run one at a time, so two slots are enough and nothing
  // accumulates over a long session. A prompt submitted mid-turn classifies
  // for the turn that reads it next, which is the turn it starts.
  let latest: Decision | null | undefined
  let appliedTurnId: string | undefined
  let appliedModel: string | null = null

  on('prompt.submit', async ($, e, next) => {
    if (!routeMainLoop) return next(e)

    let decision: Decision | null = null
    if (apiKey) {
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(apiKey, modelId),
            body: requestBody({ prompt: e.text }),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) decision = readDecision(response.text)
        else if (response) $.ui.log(`[jev-model-router] gateway responded ${response.status}`)
      } catch (error) {
        $.ui.log(`[jev-model-router] classification failed: ${String(error)}`)
      }
    } else {
      // No key: the engine's own small-model classifier answers the same
      // question, without the distribution the policy's threshold reads.
      try {
        const label = await $.model.classify(e.text, TIER_ORDER)
        if (label) decision = { tier: label as Tier, confidence: null, risky: null, effort: null }
      } catch (error) {
        $.ui.log(`[jev-model-router] built-in classifier failed: ${String(error)}`)
      }
    }

    latest = decision
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!routeMainLoop || e.agentId) return yield* next(e)

    // Every request after the first reuses what the turn settled on, so the
    // model does not change under the model's own tool loop.
    if (e.index > 0 && e.turnId === appliedTurnId) {
      return yield* next(appliedModel ? { ...e, model: appliedModel } : e)
    }

    const decision = latest ?? null
    latest = undefined

    const { model, reason } = route(decision, e.model, policy)
    appliedTurnId = e.turnId
    appliedModel = model

    if (!model) return yield* next(e)
    if (logDecisions) $.ui.log(`[jev-model-router] main loop → ${model}: ${reason}`)
    return yield* next({ ...e, model })
  })

  on('agent.spawn', async ($, e, next) => {
    // A fork inherits its parent's model; `model` is ignored for it.
    if (!routeSubagents || e.fork) return next(e)

    let decision: Decision | null = null
    if (apiKey) {
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(apiKey, modelId),
            body: requestBody({
              prompt: e.prompt,
              description: e.description,
              agentType: e.subagentType,
            }),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) decision = readDecision(response.text)
        else if (response) $.ui.log(`[jev-model-router] gateway responded ${response.status}`)
      } catch (error) {
        $.ui.log(`[jev-model-router] classification failed: ${String(error)}`)
      }
    } else {
      try {
        const label = await $.model.classify(e.prompt, TIER_ORDER)
        if (label) decision = { tier: label as Tier, confidence: null, risky: null, effort: null }
      } catch (error) {
        $.ui.log(`[jev-model-router] built-in classifier failed: ${String(error)}`)
      }
    }

    // The subagent's own model wins when the caller named one; otherwise the
    // parent's is what it would inherit, so that is what the floor compares to.
    const current = e.model ?? e.parentModel
    const { model, reason } = route(decision, current, policy)
    if (!model) return next(e)
    if (logDecisions) $.ui.log(`[jev-model-router] ${e.subagentType} → ${model}: ${reason}`)
    return next({ ...e, model })
  })
}
