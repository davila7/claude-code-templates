/**
 * jev-model-router — pure decision logic.
 *
 * No `$` and no I/O here: this module only builds the request body the
 * evaluation API takes, reads its answer, and turns that answer into a model
 * id. The hooks module does every call on `$` at its own call site.
 */

export type Tier = 'fast' | 'balanced' | 'deep'

export interface Tiers {
  fast: string
  balanced: string
  deep: string
}

export interface Decision {
  tier: Tier
  /** Highest probability in the distribution, or null when none was sent. */
  confidence: number | null
  /** P(true) that the task touches production, money or irreversible state. */
  risky: number | null
  /** 0..3 along the effort rubric, or null when absent. */
  effort: number | null
}

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

/** The `questions` map of an evaluation request. */
export function questions(): Record<string, unknown> {
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
      type: 'boolean',
      instructions:
        'The task touches production, money, credentials, or state that cannot be undone.',
    },
  }
}

/** The body of `POST {baseUrl}/evaluation-model`. */
export function requestBody(state: Record<string, unknown>): string {
  return JSON.stringify({ state, questions: questions() })
}

/** The headers that request needs, minus the API key. */
export function requestHeaders(apiKey: string, modelId: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': modelId,
    'ai-evaluation-model-specification-version': '4',
  }
}

function isTier(value: unknown): value is Tier {
  return value === 'fast' || value === 'balanced' || value === 'deep'
}

/**
 * Reads an evaluation response. The Gateway's answer shape carries no
 * `confidence` field (the direct TypeSafe API does), so confidence is the
 * highest probability of the distribution, which is itself optional.
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

  const probabilities = tierAnswer.probabilities as Record<string, number> | undefined
  const values = probabilities ? Object.values(probabilities) : []
  const confidence = values.length > 0 ? Math.max(...values) : null

  const effortAnswer = answers.effort
  const riskyAnswer = answers.risky

  return {
    tier: tierAnswer.choice,
    confidence,
    effort: typeof effortAnswer?.score === 'number' ? effortAnswer.score : null,
    risky: typeof riskyAnswer?.probability === 'number' ? riskyAnswer.probability : null,
  }
}

/**
 * Where a model id sits on the tier ladder, by matching it against the
 * configured tier names first and then the family words. Null when it matches
 * none, which disables the no-downgrade floor rather than guessing.
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
  minConfidence: number
  pinModelFloor: boolean
}

export interface Routing {
  /** The model to run on, or null to leave the request as it is. */
  model: string | null
  /** Why, for the log line. */
  reason: string
}

/**
 * Turns a decision into a model, or into nothing. Every path that is not a
 * confident, allowed change leaves the caller's model alone.
 */
export function route(
  decision: Decision | null,
  currentModel: string,
  config: PolicyConfig,
): Routing {
  if (!decision) return { model: null, reason: 'no decision' }

  let tier = decision.tier

  // A task that touches production or money is never worth the saving.
  if (decision.risky !== null && decision.risky > 0.7 && tier !== 'deep') {
    tier = 'deep'
  } else if (decision.confidence !== null && decision.confidence < config.minConfidence) {
    return {
      model: null,
      reason: `confidence ${decision.confidence.toFixed(2)} below ${config.minConfidence}`,
    }
  }

  const wanted = TIER_ORDER.indexOf(tier)
  const current = rankOf(currentModel, config.tiers)

  if (config.pinModelFloor && current !== null && wanted < current) {
    return { model: null, reason: `would downgrade below ${currentModel}` }
  }

  const model = config.tiers[tier]
  if (!model || model === currentModel) return { model: null, reason: 'already on that model' }

  const confidence = decision.confidence === null ? 'n/d' : decision.confidence.toFixed(2)
  return { model, reason: `${tier} (confidence ${confidence})` }
}
