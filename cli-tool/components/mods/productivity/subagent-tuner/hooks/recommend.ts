// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type { SubagentTunerChoice as Choice } from '../types'

export const MODELS = ['haiku', 'sonnet', 'opus', 'fable'] as const
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type Model = (typeof MODELS)[number]
export type Effort = (typeof EFFORTS)[number]

/** A prompt longer than this asks for more thought than its task kind implies. */
export const LONG_PROMPT_CHARS = 4000

/** The agent type the engine runs as a fork: it ignores model and effort. */
export const FORK_TYPE = 'fork'

/** No recommendation: the subagent inherits the parent's model and effort. */
export const INHERIT: Choice = { model: null, effort: null }

type Rule = { kind: string; pattern: RegExp; model: Model; effort: Effort }

// Ordered by what a miss costs: a review that ran on a cheap model is worse
// than an implementation that ran on a dear one, so review wins a tie. Each
// pattern opens on a word boundary, and `fix` closes on one so that "fixture"
// is not a fix while fixed, hotfix and bugfix are.
const RULES: readonly Rule[] = [
  { kind: 'review', pattern: /\b(review|audit|verif|adversar|secur)/i, model: 'opus', effort: 'high' },
  { kind: 'implement', pattern: /\b(implement|build|(hot|bug)?fix(es|ed|ing)?\b)/i, model: 'sonnet', effort: 'medium' },
  { kind: 'explore', pattern: /\b(explor|search|research)/i, model: 'haiku', effort: 'low' },
]

/** The agent types the engine ships: a name the offers never raised is still one of these or a custom agent. */
const BUILT_IN_TYPES: readonly string[] = ['general-purpose', 'Explore', 'Plan', 'claude', 'statusline-setup', 'claude-code-guide']

/** Per agent type the engine offered: true when it provided it itself (a built-in). */
export type OfferCache = ReadonlyMap<string, boolean>

/**
 * True where the agent type may carry a definition of its own. The tuner never
 * sees a definition's `model` or `effort`, so for such a type it recommends
 * nothing: a pinned model must not be replaced by a keyword guess. The offers
 * are the evidence; a type no offer was seen for is judged by its name (see
 * `isJudgedByName`; the spawn may tell better, for the engine's offer can come late).
 */
export const isJudgedByName = (subagentType: string | undefined, offers: OfferCache): boolean =>
  subagentType !== undefined && !offers.has(subagentType) && !BUILT_IN_TYPES.includes(subagentType)

export function hasOwnDefinition(subagentType: string | undefined, offers: OfferCache): boolean {
  if (subagentType === undefined) {
    return false
  }

  const isBuiltIn = offers.get(subagentType)

  return isBuiltIn === undefined ? !BUILT_IN_TYPES.includes(subagentType) : !isBuiltIn
}

export type AgentRequest = {
  subagent_type?: string
  description?: string
  prompt?: string
  model?: string
  effort?: string
}

const firstMatch = (text: string): Rule | undefined => RULES.find(rule => rule.pattern.test(text))

export function bumpEffort(effort: Effort): Effort {
  const next = EFFORTS[EFFORTS.indexOf(effort) + 1]

  return next ?? effort
}

/**
 * The agent type names the job more reliably than the free-text description,
 * so it is tried first.
 */
export function recommend(request: AgentRequest): Choice {
  const rule = firstMatch(request.subagent_type ?? '') ?? firstMatch(request.description ?? '')

  if (rule === undefined) {
    return INHERIT
  }

  const isLong = (request.prompt ?? '').length > LONG_PROMPT_CHARS

  return { model: rule.model, effort: isLong ? bumpEffort(rule.effort) : rule.effort }
}

/**
 * What the tuner applies without asking: the saved default, each field of it
 * falling back to the recommendation where the default leaves it inherited.
 */
export const resolveDefault = (saved: Choice | null, rec: Choice): Choice =>
  saved === null
    ? rec
    : { model: saved.model ?? rec.model, effort: saved.effort ?? rec.effort }

/** True while the call leaves the model or the effort for the tuner to settle. */
export const hasOpenField = (request: AgentRequest): boolean =>
  request.model === undefined || request.effort === undefined

/**
 * The fields the choice supplies, each only where the call left it unset: what
 * the call set itself is never overridden.
 */
export function patchFor(request: AgentRequest, choice: Choice): { model?: string; effort?: string } {
  return {
    ...(request.model === undefined && choice.model !== null ? { model: choice.model } : {}),
    ...(request.effort === undefined && choice.effort !== null ? { effort: choice.effort } : {}),
  }
}

/**
 * Auto: each field the saved default sets replaces what the call set; a field it
 * leaves inherited keeps what the call set, else takes the recommendation.
 */
export function autoPatch(request: AgentRequest, saved: Choice | null, rec: Choice): { model?: string; effort?: string } {
  return {
    ...patchFor(request, resolveDefault(saved, rec)),
    ...(saved?.model == null ? {} : { model: saved.model }),
    ...(saved?.effort == null ? {} : { effort: saved.effort }),
  }
}

/**
 * Manual mode's starting selection, per field: what the call set, else the
 * default or recommendation. The person may change every field of it.
 */
export const presetFor = (request: AgentRequest, fallback: Choice): Choice => ({
  model: request.model ?? fallback.model,
  effort: request.effort ?? fallback.effort,
})

export const describeChoice = (choice: Choice): string =>
  `${choice.model ?? 'inherit'}/${choice.effort ?? 'inherit'}`
