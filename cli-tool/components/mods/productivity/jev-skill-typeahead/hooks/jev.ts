/**
 * jev-skill-typeahead — the decision: which one skill will this prompt use?
 *
 * One request to Jev, TypeSafe's System One decision model, per pause: a
 * `choice` over every skill's and subagent's description ("which of these, if any, is the
 * right one to load") plus three yes/no gate questions that say whether the
 * prompt needs a skill at all. The same shapes jev-skill-suggestion sends as
 * the first request of TypeSafe's skill-suggestion cookbook; the second,
 * re-reading request is left out because the draft changes under it and this
 * answer is a preview.
 *
 * Two backends, picked by whichever key is set: TypeSafe's own API
 * (`POST /v1/systemone`, a calibrated confidence per answer) or the Vercel AI
 * Gateway (`POST /evaluation-model`, no confidence). Without either the mod
 * stays on the keyword match and says so; `provider: builtin` asks the
 * engine's own `$.model.classify` instead, one small-model request per pause.
 */
import { keyOf } from './policy.ts'
import type { Skill } from './policy.ts'

export type Provider = 'typesafe' | 'gateway'

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

/** The label the built-in classifier answers when no skill applies. */
export const NONE = 'none'

/** A forced backend whose key is missing resolves to null, never to the other one's key. */
export function selectProvider(forced: string, typesafeKey: string, gatewayKey: string): Provider | null {
  if (forced === 'builtin' || forced === 'keywords') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (typesafeKey) return 'typesafe'
  if (gatewayKey) return 'gateway'
  return null
}

export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  return provider === 'typesafe' ? `${root}/v1/systemone` : `${root}/evaluation-model`
}

/** Yes/no questions where a yes points away from needing a skill. */
const GATE: Record<string, { text: string; isInverted: boolean }> = {
  acts: {
    text: "Is the assistant being asked to act on the user's files, accounts, devices, or online services, rather than only to explain or advise?",
    isInverted: false,
  },
  procedure: {
    text: 'Would a careful expert answering this consult a specific documented procedure or set of commands, rather than answering from general understanding?',
    isInverted: false,
  },
  prose: {
    text: "Could a knowledgeable generalist fully satisfy this request in prose, with no tools, no documentation, and no access to the user's files or accounts?",
    isInverted: true,
  },
}

export function questions(provider: Provider, skills: readonly Skill[]): Record<string, unknown> {
  const criteria: Record<string, string> = {}
  for (const skill of skills) criteria[keyOf(skill)] = skill.description || `A ${skill.origin === 'agent' ? 'subagent' : 'skill'} named ${skill.name}.`
  const out: Record<string, unknown> = {
    which: {
      type: 'choice',
      instructions: "Which of these skills and subagents (agent:name), if any, is the right one for the model to call to help with the user's request?",
      criteria,
    },
  }
  for (const [key, g] of Object.entries(GATE)) {
    out[`gate::${key}`] = { type: provider === 'typesafe' ? 'noul' : 'boolean', instructions: g.text }
  }
  return out
}

export function requestBody(provider: Provider, prompt: string, qs: Record<string, unknown>, model: string): string {
  const state = { request: prompt, recent_context: '' }
  return JSON.stringify(provider === 'typesafe' ? { model, state, questions: qs } : { state, questions: qs })
}

export function requestHeaders(provider: Provider, apiKey: string, model: string): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    'ai-evaluation-model-specification-version': '4',
  }
}

/** What the request answered. */
export interface Decision {
  /** Skills with their probability, surest first; a lone choice when the backend sent no distribution. */
  ranked: { name: string; probability: number | null }[]
  /** Mean of the oriented gate answers, or null when none came back. */
  gate: number | null
}

type Answers = Record<string, Record<string, unknown>>

export function readDecision(responseText: string): Decision | null {
  let answers: Answers | undefined
  try {
    answers = (JSON.parse(responseText) as { answers?: Answers }).answers
  } catch {
    return null
  }
  const which = answers?.which
  if (!answers || !which || typeof which.choice !== 'string') return null

  const ranked: Decision['ranked'] = []
  const probabilities = which.probabilities as Record<string, number> | undefined
  if (probabilities && typeof probabilities === 'object') {
    for (const [name, probability] of Object.entries(probabilities)) {
      if (typeof probability === 'number') ranked.push({ name, probability })
    }
    ranked.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
  }
  if (ranked.length === 0) {
    ranked.push({ name: which.choice, probability: typeof which.confidence === 'number' ? which.confidence : null })
  }

  const oriented: number[] = []
  for (const [key, g] of Object.entries(GATE)) {
    const a = answers[`gate::${key}`]
    const value = typeof a?.noul === 'number' ? a.noul : typeof a?.probability === 'number' ? a.probability : null
    if (value !== null) oriented.push(g.isInverted ? 1 - value : value)
  }
  const gate = oriented.length > 0 ? oriented.reduce((x, y) => x + y, 0) / oriented.length : null
  return { ranked, gate }
}

export interface Thresholds {
  /** Mean gate under which no skill is expected to be used. */
  gate: number
  /** Probability the top choice needs, when the backend reports one. */
  confidence: number
}

/** The decision as the band shows it: the skill that will be used, or none. */
export function verdictOf(decision: Decision, known: ReadonlySet<string>, limits: Thresholds): string | null {
  if (decision.gate !== null && decision.gate < limits.gate) return null
  const top = decision.ranked.find((r) => known.has(r.name))
  if (!top) return null
  if (top.probability !== null && top.probability < limits.confidence) return null
  return top.name
}

/** The classifier text for `$.model.classify`: it takes bare labels, so the descriptions ride in the text. */
export function classifyText(prompt: string, skills: readonly Skill[]): string {
  return [
    'Which skill or subagent (agent:name), going by its description, should the model call before working on the prompt below? Answer "none" unless the prompt is clearly the kind of task a description names.',
    '',
    'Candidates:',
    ...skills.map((s) => `- ${keyOf(s)}: ${s.description.replace(/\s+/g, ' ').slice(0, 200)}`),
    `- ${NONE}: nothing listed is about this prompt`,
    '',
    'Prompt:',
    prompt,
  ].join('\n')
}
