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
 *   openrouter  POST https://openrouter.ai/api/v1/systemone
 *             OpenRouter's System One route, "compatible with the TypeSafe
 *             SDKs": the same model (`~typesafe/jev-latest`) in TypeSafe's own
 *             wire shape, `{ model, state, questions }`, `noul`, a
 *             `confidence` per answer.
 *
 * The Gateway shape is not documented publicly; it was read from
 * @ai-sdk/gateway and @ai-sdk/provider.
 */

export type Provider = 'typesafe' | 'gateway' | 'openrouter'

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
  /** The effort's distribution over rubric levels ("0".."4"), when the backend sent one. */
  effortProbabilities?: Record<string, number> | null
  /** How the work should be carried out, or null when not asked or not answered. */
  strategy?: Strategy | null
  /** Confidence in the strategy, or null when the backend reported none. */
  strategyConfidence?: number | null
}

/**
 * How a task is carried out: by the main conversation itself, by one
 * subagent, by several at once, or by a small graph of subagents in waves.
 */
export type Strategy = 'direct' | 'delegate' | 'parallel' | 'graph'

export const STRATEGY_ORDER: readonly Strategy[] = ['direct', 'delegate', 'parallel', 'graph']

/**
 * How each strategy is described to the decision model. Written so that
 * `direct` is the ordinary answer: every other one spends subagents, and
 * a subagent re-reads what the main conversation already knows.
 */
const STRATEGY_CRITERIA: Record<Strategy, string> = {
  direct:
    'The main conversation does it itself: a question, a lookup, a command, or a change to one or a few files. The right answer for most requests, including most follow-ups.',
  delegate:
    'One subagent on a cheaper model does a broad but mechanical part first — searching or reading across many files, a codebase sweep, bulk renames — and the main conversation acts on its short report.',
  parallel:
    'Several independent pieces with no shared files or state (separate modules, services or investigations), each done by its own subagent at the same time, then combined.',
  graph:
    'A large build with parts that depend on each other: plan a small dependency graph, run each wave of independent parts as parallel subagents, integrate and test between waves. Only for work too big for one conversation to do well.',
}

/**
 * The two sides of the risk question, as a noul's `criteria`: the act of
 * carrying the task out, not the subject it is about.
 */
const RISK_CRITERIA = {
  true: 'Doing the task runs something against a real system with lasting effect: deploying or releasing, changing production data or configuration, moving money, deleting or overwriting data with no backup, or rewriting shared history (force-push).',
  false: 'Reading, explaining, planning, or writing and testing code locally, even code that deals with production, payments or data, without running it against the real system.',
}

/** The reasoning levels a turn can ask for, cheapest first. */
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const

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

/**
 * The effort rubric, one level per rung of EFFORT_ORDER. Each level names the
 * kind of task that needs it, not an amount ("some", "a lot"): an amount
 * leaves the decision model to guess what it means for code, a kind of task
 * is something it can recognise in the request.
 */
const EFFORT_RUBRIC = [
  'Answered from what is already known, or one mechanical step: a lookup, a single command, a rename, formatting, a one-line change.',
  'An ordinary, well-specified change to one or a few files, or a direct question about code already in view.',
  'A change across several files, a bug whose cause is described but has to be traced, writing tests, or reviewing a diff with care.',
  'Design across several components, a bug whose cause is unknown, a refactor with many dependents, or careful reasoning about concurrency, performance or failure modes.',
  'Novel architecture, a security or data-integrity question, a failure that resisted earlier attempts, or work where a subtle mistake is costly and hard to undo.',
] as const

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
  openrouter: 'https://openrouter.ai/api',
}

/**
 * The Gateway's own protocol version, sent as `ai-gateway-protocol-version`.
 * Tracks the `AI_GATEWAY_PROTOCOL_VERSION` of `@ai-sdk/gateway` (4.0.87).
 */
const AI_GATEWAY_PROTOCOL_VERSION = '0.0.1'

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
  openrouter: '~typesafe/jev-latest',
}

/**
 * Which backend a configuration asks for, or null for the built-in
 * classifier. `auto` prefers the backends that report a calibrated
 * confidence — TypeSafe's own API, then OpenRouter — over the Gateway, which
 * does not; a forced backend whose key is missing resolves to
 * null rather than falling through to the other one's key.
 */
export function selectProvider(
  forced: string,
  typesafeKey: string,
  gatewayKey: string,
  openrouterKey = '',
): Provider | null {
  if (forced === 'builtin') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (forced === 'openrouter') return openrouterKey ? 'openrouter' : null
  if (typesafeKey) return 'typesafe'
  if (openrouterKey) return 'openrouter'
  if (gatewayKey) return 'gateway'
  return null
}

/** The full endpoint a backend posts to. */
export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  // OpenRouter serves TypeSafe's own route under its API root.
  return provider === 'gateway' ? `${root}/evaluation-model` : `${root}/v1/systemone`
}

/**
 * The `questions` map, in the shape the backend's schema names. The strategy
 * is asked only for the main conversation: a subagent is already one part of
 * a split, and its own is not this router's to decide.
 */
export function questions(provider: Provider, withStrategy = false): Record<string, unknown> {
  const asked: Record<string, unknown> = {
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
      // The same question under two names: `noul` on TypeSafe's own API and
      // OpenRouter's, `boolean` in the AI SDK's evaluation schema.
      type: provider === 'gateway' ? 'boolean' : 'noul',
      // Asked about the act, not the subject. The first wording ("the task
      // touches production, money, credentials") scored 0.96 on "add a
      // refund endpoint that calls Stripe" — ordinary code that happens to be
      // about money — and would have escalated it past a 0.98-confidence
      // answer of the balanced tier.
      instructions:
        'Carrying out this task would itself change production, move real money, or alter data that cannot be restored. Writing or testing code that deals with such things, without running it against the real system, does not count.',
      // What true and false look like, where the schema takes them (a noul
      // does; the Gateway's boolean is sent with the instructions alone).
      ...(provider === 'gateway' ? {} : { criteria: RISK_CRITERIA }),
    },
  }
  if (withStrategy) {
    asked.strategy = {
      type: 'choice',
      instructions:
        'How should a coding assistant carry out the latest request, given the recent conversation? Prefer the simplest way that does it well.',
      criteria: STRATEGY_CRITERIA,
    }
  }
  return asked
}

/** The request body. The Gateway carries the model in a header instead. */
export function requestBody(
  provider: Provider,
  state: Record<string, unknown>,
  model: string,
  withStrategy = false,
): string {
  const asked = questions(provider, withStrategy)
  const body = provider !== 'gateway' ? { model, state, questions: asked } : { state, questions: asked }
  return JSON.stringify(body)
}

/** How jev-pilot names itself to OpenRouter. */
export const OPENROUTER_APP = {
  'http-referer': 'https://github.com/Akramovic1/jev-pilot',
  'x-openrouter-title': 'jev-pilot',
  'x-title': 'jev-pilot',
}

/** The request headers. */
export function requestHeaders(
  provider: Provider,
  apiKey: string,
  model: string,
): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  // Optional on OpenRouter; names the app in its dashboard and logs.
  // OpenRouter attributes requests to an app by these (its app rankings,
  // the model page's "top apps"); both title spellings are accepted.
  if (provider === 'openrouter') return { ...common, ...OPENROUTER_APP }
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    // The Gateway rejects any request that does not name the protocol it
    // speaks: 400 "Unsupported gateway protocol version". Every other header
    // here is accepted without it, so the omission fails the whole backend.
    'ai-gateway-protocol-version': AI_GATEWAY_PROTOCOL_VERSION,
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
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> }).answers
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null

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

  // The strategy is optional: a request that did not ask it, or an answer
  // naming something else, leaves it null and the rest of the decision stands.
  const strategyAnswer = answers.strategy
  const strategy = isStrategy(strategyAnswer?.choice) ? strategyAnswer.choice : null

  const effortProbabilities = effortAnswer?.probabilities
  return {
    tier: tierAnswer.choice,
    confidence: confidenceOf(tierAnswer),
    effort: typeof effortAnswer?.score === 'number' ? effortAnswer.score : null,
    effortConfidence: effortAnswer ? confidenceOf(effortAnswer) : null,
    effortProbabilities:
      effortProbabilities && typeof effortProbabilities === 'object' && !Array.isArray(effortProbabilities)
        ? (effortProbabilities as Record<string, number>)
        : null,
    risky,
    strategy,
    strategyConfidence: strategy && strategyAnswer ? confidenceOf(strategyAnswer) : null,
  }
}

function isStrategy(value: unknown): value is Strategy {
  return typeof value === 'string' && (STRATEGY_ORDER as readonly string[]).includes(value)
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

/**
 * The rubric level to act on, leaning up on a close call; null without an
 * effort answer.
 *
 * Under-thinking a hard task costs more than over-thinking an easy one, so
 * when two levels are nearly tied the higher wins. With a distribution, the
 * runner-up is taken when it is higher and within `margin` of the top; with
 * a bare score, a fraction at or above `0.5 - margin` rounds up. A margin of
 * 0 is plain rounding and the plain top of the distribution.
 */
export function effortScoreOf(
  decision: Pick<Decision, 'effort' | 'effortProbabilities'>,
  margin: number,
): number | null {
  const top = EFFORT_ORDER.length - 1
  const ranked = Object.entries(decision.effortProbabilities ?? {})
    .map(([level, probability]) => ({ level: Number(level), probability }))
    .filter(
      (entry) =>
        Number.isInteger(entry.level) &&
        entry.level >= 0 &&
        entry.level <= top &&
        typeof entry.probability === 'number' &&
        Number.isFinite(entry.probability),
    )
    .sort((a, b) => b.probability - a.probability || b.level - a.level)
  const [best, second] = ranked
  if (best) {
    if (second && second.level > best.level && best.probability - second.probability <= margin) return second.level
    return best.level
  }
  if (decision.effort === null || !Number.isFinite(decision.effort)) return null
  const score = Math.min(top, Math.max(0, decision.effort))
  const whole = Math.floor(score)
  return Math.min(top, score - whole >= 0.5 - margin ? whole + 1 : whole)
}

/** The rubric score (0..4) as a reasoning level. */
export function effortLevel(score: number): Effort {
  const index = Math.min(EFFORT_ORDER.length - 1, Math.max(0, Math.round(score)))
  return EFFORT_ORDER[index] as Effort
}

/**
 * Where a reasoning level sits on the ladder, or null when its place cannot
 * be known (a numeric effort, or a name the ladder does not have).
 */
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

/** The model families a tier alias names. */
export type Family = 'haiku' | 'sonnet' | 'opus'

const FAMILIES: readonly Family[] = ['haiku', 'sonnet', 'opus']

/** Which family a model id or alias belongs to, or null for none of them. */
export function familyOf(model: string): Family | null {
  const lowered = model.toLowerCase()
  return FAMILIES.find((family) => lowered.includes(family)) ?? null
}

/**
 * The version in an id of the `claude-<family>-<major>[-<minor>]` shape, as
 * numbers to compare (`claude-opus-5-5[1m]` → [5, 5]; a date suffix is not
 * part of it), or null for an id of another shape.
 */
function versionOf(id: string, family: Family): number[] | null {
  const match = new RegExp(`claude-${family}-(\\d+)(?:-(\\d{1,2}))?(?!\\d)`).exec(id.toLowerCase())
  if (!match) return null
  return [Number(match[1]), ...(match[2] === undefined ? [] : [Number(match[2])])]
}

/** Whether version `a` is newer than `b`; a missing version is the oldest. */
function newer(a: number[] | null, b: number[] | null): boolean {
  if (!a) return false
  if (!b) return true
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const left = a[index] ?? 0
    const right = b[index] ?? 0
    if (left !== right) return left > right
  }
  return false
}

/**
 * The full model id of each family, as the engine itself resolved them this
 * session: no version is written in this file, so a new release is picked up
 * as soon as the engine uses it.
 *
 * `agent.spawn` takes an alias (`haiku`) the way the Agent tool does, and the
 * engine resolves it to its current model. `turn.step`'s `model`, though, is
 * sent to the API as written, and an alias there is refused. So every step's
 * resolved id (the main loop's and each subagent's) is learned here, and a
 * main-loop switch to a family uses the newest id seen for it. A family never
 * seen this session has no id, and the switch is not made.
 */
export function modelIds(): {
  learn(id: string): void
  idFor(family: Family): string | null
} {
  const seen = new Map<Family, string>()
  return {
    learn(id) {
      const family = familyOf(id)
      // An alias is not an id: nothing to learn from it.
      if (!family || id.trim().toLowerCase() === family) return
      const held = seen.get(family)
      if (!held || newer(versionOf(id, family), versionOf(held, family))) seen.set(family, id)
    },
    idFor(family) {
      return seen.get(family) ?? null
    },
  }
}

/**
 * What to write into `turn.step`'s `model`: a full id or custom name as given,
 * or, for a family alias, the id learned for it; null when that family has
 * not been seen yet, which leaves the model as the engine built it.
 */
export function requestModelId(model: string, ids: { idFor(family: Family): string | null }): string | null {
  const alias = model.trim().toLowerCase()
  return (FAMILIES as readonly string[]).includes(alias) ? ids.idFor(alias as Family) : model
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
  /**
   * How close two effort levels must be for the higher to win (see
   * `effortScoreOf`); 0 when absent.
   */
  closeMargin?: number
  /**
   * The highest reasoning level a turn may start at; `max` when absent (the
   * hooks default it to `xhigh`). It caps what the router sets, and never
   * pulls a turn already above it down. A struggling turn is raised against
   * its own ceiling instead (see `escalate`).
   */
  maxEffort?: Effort
}

/** The configured ceiling as a rung, `max` for anything not on the ladder. */
function ceilingOf(config: { maxEffort?: Effort }): number {
  const rank = effortRank(config.maxEffort)
  return rank === null ? EFFORT_ORDER.length - 1 : rank
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
  let effortScore = effortScoreOf(decision, config.closeMargin ?? 0)
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
    // Risk skips the confidence bars, not the same-tier check: a deep model
    // stays as it is (a swap to the tier's alias would only bust the cache).
    (currentTier === null || wantedTier !== currentTier) &&
    (forced || allowed(wantedTier, currentTier, decision.confidence, config))
      ? wantedModel
      : null

  let effort: Effort | null = null
  if (effortScore !== null) {
    const currentRank = effortRank(current.effort)
    let wantedRank = Math.min(EFFORT_ORDER.indexOf(effortLevel(effortScore)), ceilingOf(config))

    // Risk raises the floor; it must never lower one. Forcing only skips the
    // thresholds, so without this clamp a task already at `xhigh` or `max`
    // and rated mechanically simple would be pulled down to `high` with no
    // confidence check at all — the opposite of what the rule is for.
    if (forced && currentRank !== null) wantedRank = Math.max(wantedRank, currentRank)
    // The risk floor is a safety rule, the ceiling a cost one: the floor wins,
    // even under a `maxEffort` set below it.
    if (forced) wantedRank = Math.max(wantedRank, EFFORT_ORDER.indexOf('high'))

    // A numeric effort is the caller's own scale, not this ladder; leave it.
    const comparable = typeof current.effort !== 'number'
    const wanted = EFFORT_ORDER[Math.min(EFFORT_ORDER.length - 1, wantedRank)] as Effort
    // Above the ceiling already (set by hand): the ceiling limits what this
    // router asks for, it is not a reason to cut what the person chose.
    const aboveCeiling = currentRank !== null && currentRank > ceilingOf(config)
    if (
      comparable &&
      !aboveCeiling &&
      wantedRank !== currentRank &&
      (forced || allowed(wantedRank, currentRank, decision.effortConfidence, config))
    ) {
      effort = wanted
    }
  }

  const said = decision.confidence === null ? 'confidence n/d' : `confidence ${decision.confidence.toFixed(2)}`

  if (!model && !effort) {
    // Naming what it wanted and what it kept is the whole point of this line.
    // Without it, a mod that classified and decided to leave the request alone
    // is indistinguishable from one that never loaded.
    const wantedEffort = effortScore === null ? null : effortLevel(effortScore)
    const kept = `${current.model}${current.effort === undefined ? '' : `/${current.effort}`}`
    const wanted = `${wantedModel}${wantedEffort ? `/${wantedEffort}` : ''}`
    return { model: null, effort: null, reason: `kept ${kept}, wanted ${wanted} (${said})` }
  }

  return { model, effort, reason: forced ? `${tier}, forced by risk` : `${tier} (${said})` }
}

// --- strategy ---------------------------------------------------------------

export interface StrategyConfig {
  /** How sure the answer must be before anything is attached. */
  minConfidence: number
  /** The higher bar for `graph`, the costliest way to work. */
  minGraphConfidence: number
  /** A skill to name for `graph` (e.g. a heavier orchestration skill); '' for none. */
  graphSkill: string
}

export interface StrategyAdvice {
  /** The block attached to the prompt, or null to attach nothing. */
  block: string | null
  /** Why, for the log line. */
  reason: string
}

const STRATEGY_HOW: Record<Exclude<Strategy, 'direct'>, string> = {
  delegate:
    'Send the broad, mechanical part (searching or reading across many files) to one subagent with a self-contained brief and a request for a short report, then do the rest here. Keep small lookups here: a subagent costs a fresh context.',
  parallel:
    'Split the work into independent pieces that share no files, and dispatch one subagent per piece in a single message so they run at the same time. Give each a self-contained brief, then combine and verify their results here.',
  graph:
    'Plan a small dependency graph first: which parts depend on which. Run each wave of independent parts as parallel subagents, each owning its own files, then integrate and run the tests before the next wave. Keep the graph small; a few nodes is usually enough.',
}

/**
 * The advice attached to a prompt about how to carry it out, or no block.
 *
 * Advice is only given when it would change something (`direct` is how the
 * main conversation works anyway), when the answer is confident enough, and
 * when it agrees with the tier: splitting work across subagents is never
 * worth it for a task read as mechanical, and a graph only for a hard one.
 * An unmeasured answer (no confidence) is never acted on: every strategy
 * but `direct` spends more.
 */
export function adviseStrategy(decision: Decision | null, config: StrategyConfig): StrategyAdvice {
  const strategy = decision?.strategy ?? null
  if (!decision || !strategy) return { block: null, reason: 'no strategy answer' }
  if (strategy === 'direct') return { block: null, reason: 'direct' }
  const confidence = decision.strategyConfidence ?? null
  if (confidence === null) return { block: null, reason: `${strategy} without a confidence; not acted on` }
  const bar = strategy === 'graph' ? config.minGraphConfidence : config.minConfidence
  if (confidence < bar) return { block: null, reason: `${strategy} ${confidence.toFixed(2)} < ${bar}` }
  if (strategy === 'graph' && decision.tier !== 'deep') {
    return { block: null, reason: `graph, but tier ${decision.tier}; not acted on` }
  }
  if (strategy === 'parallel' && decision.tier === 'fast') {
    return { block: null, reason: 'parallel, but tier fast; not acted on' }
  }

  const how =
    strategy === 'graph' && config.graphSkill
      ? `${STRATEGY_HOW.graph} If the work warrants its full workflow, the \`${config.graphSkill}\` skill does this; it is heavier and slower, so prefer the plain version above unless the task needs it.`
      : STRATEGY_HOW[strategy]
  const block = [
    '<execution_strategy>',
    `A fast decision model read this request as best carried out as: ${strategy} (confidence ${confidence.toFixed(2)}).`,
    how,
    'It saw only the request and a few recent messages, not the code. If the actual work does not fit, ignore this and work directly.',
    '</execution_strategy>',
  ].join('\n')
  return { block, reason: `${strategy} (${confidence.toFixed(2)})` }
}

// --- escalation within a turn -----------------------------------------------

/**
 * Whether a later request of a turn is the engine's own move to another
 * model: it names a model other than the one the engine named for the turn's
 * first request (before any rewrite). That is Claude Code's overload
 * fallback (`--fallback-model`, after repeated 529s), retried as the turn's
 * next request; a routed model must not send it back to the overloaded one.
 * With no first request seen (`first` null), nothing is known to have moved.
 */
export function engineMoved(first: string | null, model: string): boolean {
  return first !== null && model !== first
}

/**
 * The reasoning level to raise a struggling turn to, or null to leave it.
 *
 * Called once `failed` tool calls in a row reach `after`. The trouble itself
 * decides that effort goes up, by at least one rung; the decision model's
 * fresh reading (`score`, null without one) may take it further. Never down,
 * never past the ceiling, and never for a numeric effort, which is the
 * caller's own scale. `config.maxEffort` here is the raise's own ceiling
 * (`maxRaisedEffort`), which may sit above the one a turn starts under.
 */
export function escalate(
  current: string | number | undefined,
  failed: number,
  after: number,
  score: number | null,
  config: { maxEffort?: Effort },
): Effort | null {
  if (after <= 0 || failed < after) return null
  if (typeof current === 'number') return null
  const ceiling = ceilingOf(config)
  // An unset or unknown effort is read as the middle of the ladder.
  const from = effortRank(current) ?? EFFORT_ORDER.indexOf('medium')
  if (from >= ceiling) return null
  const read = score === null ? -1 : EFFORT_ORDER.indexOf(effortLevel(score))
  const to = Math.min(ceiling, Math.max(from + 1, read))
  return EFFORT_ORDER[to] as Effort
}

/**
 * Holds a prompt's classification until the turn that reads that prompt
 * starts.
 *
 * Nothing ties a decision to the turn it belongs to. Prompts can be queued
 * while the model is busy, a peer session's message can be delivered inside a
 * running turn, and `prompt.submit` carries no turn id at all while the
 * session is idle. So when more than one prompt is waiting, `take` reports
 * none: running a turn on another prompt's decision is a worse outcome than
 * not routing it, and not routing is what every other failure path here does.
 */
export function pendingDecisions<T = Decision>(): {
  put(value: T | null): void
  take(): T | null
  /** The prompt last put will not start a turn (refused further down). */
  withdraw(): void
  /** A new session: nothing waiting carries over. */
  clear(): void
} {
  let held: T | null = null
  let waiting = 0

  return {
    put(value) {
      waiting += 1
      // Past the first, which prompt a turn will read is unknowable, so the
      // slot is emptied instead of holding a decision that may not fit.
      held = waiting === 1 ? value : null
    },
    take() {
      const value = waiting === 1 ? held : null
      held = null
      waiting = 0
      return value
    },
    withdraw() {
      // With one waiting, it is the one withdrawn. With more, the slot is
      // already empty and stays so: which one remains is still unknowable.
      waiting = Math.max(0, waiting - 1)
      if (waiting === 0) held = null
    },
    clear() {
      held = null
      waiting = 0
    },
  }
}

/** A number for the log, or `n/d` when the backend reported none. */
function reported(value: number | null): string {
  return value === null ? 'n/d' : value.toFixed(2)
}

/**
 * The one-time line that says the router is alive, which backend answers it,
 * and which of the three switches are on.
 *
 * Without this, a router that loaded and a router that never loaded are told
 * apart only by the absence of later lines, which is not evidence of anything.
 */
export function describeSetup(
  provider: Provider | null,
  url: string,
  switches: { subagentModel: boolean; mainEffort: boolean; mainModel: boolean },
  // `provider: "builtin"` is a choice, not a missing key. Reporting it as a
  // credential problem sends someone hunting for a key they meant to omit.
  builtinByChoice = false,
): string {
  const backend = provider
    ? `${provider} (${url})`
    : builtinByChoice
      ? 'the built-in classifier, by choice'
      : 'the built-in classifier, no key set'
  const on = [
    switches.subagentModel && 'subagent model',
    switches.mainEffort && 'main effort',
    switches.mainModel && 'main model',
  ].filter(Boolean)
  return `ready on ${backend}; routing ${on.length > 0 ? on.join(', ') : 'nothing, every switch is off'}`
}

/**
 * What the decision model answered, before any policy touches it: the raw
 * tier, effort and risk with their confidences, and how long it took.
 *
 * This is the line that shows the classification happened at all, separately
 * from whether the policy then decided to act on it.
 */
export function describeDecision(decision: Decision | null, ms: number | null, margin = 0): string {
  const took = ms === null ? '' : ` · ${Math.round(ms)}ms`
  if (!decision) return `no answer${took}`

  const parts = [`tier ${decision.tier} (${reported(decision.confidence)})`]
  const level = effortScoreOf(decision, margin)
  if (decision.effort !== null && level !== null) {
    parts.push(
      `effort ${decision.effort.toFixed(1)} → ${effortLevel(level)} (${reported(decision.effortConfidence)})`,
    )
  }
  if (decision.risky !== null) parts.push(`risky ${reported(decision.risky)}`)
  if (decision.strategy) parts.push(`strategy ${decision.strategy} (${reported(decision.strategyConfidence ?? null)})`)
  return parts.join(' · ') + took
}

/**
 * The persistent status line: the last thing the router did, short enough to
 * sit on screen beside the engine's own notices.
 */
export function describeStatus(
  decision: Decision | null,
  change: { model?: string; effort?: Effort } | null,
): string {
  if (!decision) return 'jev · no answer'
  const asked = `${decision.tier} ${reported(decision.confidence)}`
  if (!change) return `jev · ${asked} · unchanged`
  const to = [change.model, change.effort].filter(Boolean).join('/')
  return `jev · ${asked} → ${to}`
}
