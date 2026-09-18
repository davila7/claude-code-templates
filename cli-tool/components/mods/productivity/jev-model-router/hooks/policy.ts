/**
 * jev-model-router — pure decision logic.
 *
 * No `$` and no I/O here: this module only builds the request the decision
 * API takes, reads its answer, and turns that answer into a model id. The
 * hooks module does every call on `$` at its own call site.
 *
 * Two backends speak to the same model with different wire shapes:
 *
 *   typesafe  POST https://api.typesafe.ai/v1/systemone
 *             `{ model, state, questions }`; a yes/no question is a `noul`
 *             and every answer carries its own `confidence`.
 *   gateway   POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model
 *             `{ state, questions }` with the model in a header; a yes/no
 *             question is a `boolean`, and there is no `confidence` field —
 *             it has to be derived from an optional distribution.
 *
 * The Gateway shape is not documented publicly; it was read from
 * @ai-sdk/gateway and @ai-sdk/provider.
 */

export type Provider = 'typesafe' | 'gateway'

export type Tier = 'fast' | 'balanced' | 'deep'

export interface Tiers {
  fast: string
  balanced: string
  deep: string
}

export interface Decision {
  tier: Tier
  /** Confidence in the tier, or null when the backend reported none. */
  confidence: number | null
  /** P(true) that carrying the task out would itself be costly or final. */
  risky: number | null
  /** 0..3 along the effort rubric, or null when absent. */
  effort: number | null
  /** Confidence in the effort, or null when the backend reported none. */
  effortConfidence: number | null
}

/** The reasoning levels a turn can ask for, cheapest first. */
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh'] as const

export type Effort = (typeof EFFORT_ORDER)[number]

export const TIER_ORDER: readonly Tier[] = ['fast', 'balanced', 'deep']

/**
 * How each tier is described to the decision model. Deliberately about the
 * shape of the work, not about model names: the model never sees an id.
 */
const TIER_CRITERIA: Record<Tier, string> = {
  fast: 'Mechanical and local: read or summarise a file, run one command, rename a symbol, answer something already in context.',
  balanced:
    'Ordinary engineering: implement a well-specified change across a few files, write tests, fix a clearly described bug, review a small diff.',
  deep: 'Hard or high-stakes: architecture and design, debugging a failure whose cause is unknown, security, data migrations, concurrency, anything touching production or money.',
}

const EFFORT_RUBRIC = ['almost none', 'some', 'a lot', 'as much as possible'] as const

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

/**
 * Which backend a configuration asks for, or null for the built-in
 * classifier. `auto` prefers TypeSafe, since it is the only one that reports
 * a calibrated confidence; a forced backend whose key is missing resolves to
 * null rather than falling through to the other one's key.
 */
export function selectProvider(
  forced: string,
  typesafeKey: string,
  gatewayKey: string,
): Provider | null {
  if (forced === 'builtin') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (typesafeKey) return 'typesafe'
  if (gatewayKey) return 'gateway'
  return null
}

/** The full endpoint a backend posts to. */
export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  return provider === 'typesafe' ? `${root}/v1/systemone` : `${root}/evaluation-model`
}

/** The `questions` map, in the shape the backend's schema names. */
export function questions(provider: Provider): Record<string, unknown> {
  return {
    tier: {
      type: 'choice',
      instructions: 'Which is the cheapest tier that can complete this coding task well?',
      criteria: TIER_CRITERIA,
    },
    effort: {
      type: 'score',
      instructions: 'How much step-by-step reasoning does this task need?',
      criteria: EFFORT_RUBRIC,
    },
    risky: {
      // The same question under two names: `noul` on TypeSafe's own API,
      // `boolean` in the AI SDK's evaluation schema.
      type: provider === 'typesafe' ? 'noul' : 'boolean',
      // Asked about the act, not the subject. The first wording ("the task
      // touches production, money, credentials") scored 0.96 on "add a
      // refund endpoint that calls Stripe" — ordinary code that happens to be
      // about money — and would have escalated it past a 0.98-confidence
      // answer of the balanced tier.
      instructions:
        'Carrying out this task would itself change production, move real money, or alter data that cannot be restored. Writing or testing code that deals with such things, without running it against the real system, does not count.',
    },
  }
}

/** The request body. The Gateway carries the model in a header instead. */
export function requestBody(
  provider: Provider,
  state: Record<string, unknown>,
  model: string,
): string {
  const body =
    provider === 'typesafe'
      ? { model, state, questions: questions(provider) }
      : { state, questions: questions(provider) }
  return JSON.stringify(body)
}

/** The request headers. */
export function requestHeaders(
  provider: Provider,
  apiKey: string,
  model: string,
): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    'ai-evaluation-model-specification-version': '4',
  }
}

function isTier(value: unknown): value is Tier {
  return value === 'fast' || value === 'balanced' || value === 'deep'
}

/**
 * Reads a response from either backend.
 *
 * TypeSafe's own API reports a `confidence` per answer and a `noul` number
 * for a yes/no question. The Gateway reports neither: confidence has to come
 * from the highest probability of a distribution that is itself optional, and
 * a yes/no answer arrives as `probability`. Both are handled, and a missing
 * confidence reads as null rather than as a number the policy would trust.
 */
export function readDecision(responseText: string): Decision | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    return null
  }
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> }).answers
  if (!answers) return null

  const tierAnswer = answers.tier
  if (!tierAnswer || !isTier(tierAnswer.choice)) return null

  const effortAnswer = answers.effort
  const riskyAnswer = answers.risky
  const risky =
    typeof riskyAnswer?.noul === 'number'
      ? riskyAnswer.noul
      : typeof riskyAnswer?.probability === 'number'
        ? riskyAnswer.probability
        : null

  return {
    tier: tierAnswer.choice,
    confidence: confidenceOf(tierAnswer),
    effort: typeof effortAnswer?.score === 'number' ? effortAnswer.score : null,
    effortConfidence: effortAnswer ? confidenceOf(effortAnswer) : null,
    risky,
  }
}

/**
 * How sure an answer is. TypeSafe reports it; the Gateway does not, so there
 * it is the highest probability of a distribution that is itself optional.
 */
function confidenceOf(answer: Record<string, unknown>): number | null {
  if (typeof answer.confidence === 'number') return answer.confidence
  const probabilities = answer.probabilities as Record<string, number> | undefined
  const values = probabilities ? Object.values(probabilities) : []
  return values.length > 0 ? Math.max(...values) : null
}

/** The rubric score (0..3) as a reasoning level. */
export function effortLevel(score: number): Effort {
  const index = Math.min(EFFORT_ORDER.length - 1, Math.max(0, Math.round(score)))
  return EFFORT_ORDER[index] as Effort
}

/** Where a reasoning level sits on the ladder, or null if it is not one. */
export function effortRank(effort: string | number | undefined): number | null {
  if (typeof effort !== 'string') return null
  const index = EFFORT_ORDER.indexOf(effort as Effort)
  return index === -1 ? null : index
}

/**
 * Where a model id sits on the tier ladder, by matching it against the
 * configured tier names first and then the family words. Null when it matches
 * none, in which case the change is treated as an upgrade rather than guessed
 * at: an unrecognised id gets the gentler threshold, never the strict one.
 */
export function rankOf(model: string, tiers: Tiers): number | null {
  const lowered = model.toLowerCase()
  for (let index = 0; index < TIER_ORDER.length; index++) {
    const tier = TIER_ORDER[index] as Tier
    const configured = tiers[tier].toLowerCase()
    if (configured && lowered.includes(configured)) return index
  }
  if (lowered.includes('haiku')) return 0
  if (lowered.includes('sonnet')) return 1
  if (lowered.includes('opus')) return 2
  return null
}

export interface PolicyConfig {
  tiers: Tiers
  /**
   * How sure the decision must be to spend more (a bigger model, more
   * reasoning). Being wrong here costs money, so the bar is low.
   */
  minUpgradeConfidence: number
  /**
   * How sure it must be to spend less. Being wrong here means a task handled
   * by too small a model or too little thought, so the bar is high.
   */
  minDowngradeConfidence: number
}

export interface Routing {
  /** The model to run on, or null to leave the request as it is. */
  model: string | null
  /** The reasoning level to ask for, or null to leave it as it is. */
  effort: Effort | null
  /** Why, for the log line. */
  reason: string
}

const NOTHING: Routing = { model: null, effort: null, reason: 'no decision' }

/**
 * Whether a change of rank passes its threshold. Both directions are allowed;
 * they just do not have to clear the same bar, because the two mistakes do not
 * cost the same. A move whose direction cannot be told (an unrecognised
 * current value) is treated as an upgrade.
 */
function allowed(
  wanted: number,
  current: number | null,
  confidence: number | null,
  config: PolicyConfig,
): boolean {
  if (current !== null && wanted === current) return false
  const isDowngrade = current !== null && wanted < current
  const bar = isDowngrade ? config.minDowngradeConfidence : config.minUpgradeConfidence
  // A backend that reports no confidence (the Gateway without a distribution,
  // or the built-in classifier) clears the upgrade bar but never the
  // downgrade one: spending less on an unmeasured hunch is the bad trade.
  if (confidence === null) return !isDowngrade
  return confidence >= bar
}

/**
 * Turns a decision into a model and a reasoning level, either of which may be
 * null to leave the request as it is. Both can move in either direction.
 */
export function route(
  decision: Decision | null,
  current: { model: string; effort?: string | number },
  config: PolicyConfig,
): Routing {
  if (!decision) return NOTHING

  let tier = decision.tier
  let effortScore = decision.effort
  let forced = false

  // Carrying out something final is never worth the saving: take the deep
  // tier and real reasoning, whatever the cheaper answer said, and skip the
  // thresholds — this is the one case that is not a confidence question.
  if (decision.risky !== null && decision.risky > 0.7) {
    tier = 'deep'
    effortScore = Math.max(effortScore ?? 0, 2)
    forced = true
  }

  const wantedTier = TIER_ORDER.indexOf(tier)
  const currentTier = rankOf(current.model, config.tiers)
  const wantedModel = config.tiers[tier]

  const model =
    wantedModel &&
    wantedModel !== current.model &&
    (forced || allowed(wantedTier, currentTier, decision.confidence, config))
      ? wantedModel
      : null

  let effort: Effort | null = null
  if (effortScore !== null) {
    const wanted = effortLevel(effortScore)
    const wantedRank = EFFORT_ORDER.indexOf(wanted)
    const currentRank = effortRank(current.effort)
    // A numeric effort is the caller's own scale, not this ladder; leave it.
    const comparable = typeof current.effort !== 'number'
    if (
      comparable &&
      (forced || allowed(wantedRank, currentRank, decision.effortConfidence, config))
    ) {
      effort = wanted
    }
  }

  if (!model && !effort) return { model: null, effort: null, reason: 'nothing to change' }

  const said = decision.confidence === null ? 'confidence n/d' : `confidence ${decision.confidence.toFixed(2)}`
  return { model, effort, reason: forced ? `${tier}, forced by risk` : `${tier} (${said})` }
}
