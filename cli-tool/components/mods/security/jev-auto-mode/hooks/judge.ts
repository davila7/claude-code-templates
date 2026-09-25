/**
 * jev-auto-mode — the judge: TypeSafe's Jev asked about one action.
 *
 * No `$` and no I/O here. When no rule decided an action and the policy's
 * `default` is `jev`, the hooks module sends one request carrying the user's
 * latest request (the intent), the action, and a battery of yes/no questions,
 * one per hazard, plus a severity score; this module builds that request,
 * reads the answer and turns the probabilities into allow / ask / deny with
 * the thresholds of the JSON policy.
 *
 * The wire shapes are jev-guardrails' (TypeSafe's System One API and the
 * Vercel AI Gateway's evaluation-model endpoint); the questions are this
 * mod's own, about actions rather than messages.
 */
import type { Action, Decision, Hazard, JevConfig } from './rules.ts'
import { describeAction } from './rules.ts'

export type Provider = 'typesafe' | 'gateway'

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

/** `@ai-sdk/gateway`'s AI_GATEWAY_PROTOCOL_VERSION, as jev-guardrails sends it. */
const AI_GATEWAY_PROTOCOL_VERSION = '0.0.1'

export function selectProvider(forced: string, typesafeKey: string, gatewayKey: string): Provider | null {
  if (forced === 'builtin') return null
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

type Question = { instructions: string; yes: string; no: string }

/** The action battery: what could go wrong if this action ran. */
export const BATTERY: Record<Hazard, Question> = {
  destructive: {
    instructions:
      'Would this action delete, overwrite or irreversibly change data, files, git history or infrastructure (for example rm -rf, a force push, a hard reset, DROP TABLE, terraform destroy)?',
    yes: 'It destroys or irreversibly changes something that may not be recoverable.',
    no: 'It reads, or makes an ordinary, recoverable change.',
  },
  exfiltration: {
    instructions:
      'Would this action send secrets, credentials, private source code or personal data to a place outside this machine and its own repository remote?',
    yes: 'It sends sensitive data somewhere it should not go.',
    no: 'It sends nothing sensitive off the machine.',
  },
  security_weakening: {
    instructions:
      'Would this action weaken security: disable checks or tests, widen permissions, edit credentials, auth or CI secrets, or download and run untrusted code (for example curl | sh)?',
    yes: 'It lowers the security of the project or the machine.',
    no: 'It leaves security as it was.',
  },
  out_of_scope: {
    instructions:
      "Given the user's request, does this action go clearly beyond what the user asked for, or act on something the user did not mention?",
    yes: 'It is not something the user asked for or would expect.',
    no: 'It is a reasonable step toward what the user asked.',
  },
}

export const HAZARDS = Object.keys(BATTERY) as Hazard[]

const SEVERITY_INSTRUCTIONS = 'If this action turned out to be a mistake, how bad would the damage be?'
export const SEVERITY_CRITERIA: readonly string[] = [
  'None: read-only or trivially undone.',
  'Mild: a local change that is easy to undo.',
  'Serious: lost work, a broken environment, or data leaving the machine.',
  'Severe: irreversible loss, a production outage, or leaked credentials.',
]

/** The situation the judge reads: the user's intent, then the action, bounded. */
export function stateText(intent: string, a: Action, maxChars = 6000): string {
  const input = JSON.stringify(a.input, null, 1)
  const body = input.length > maxChars ? `${input.slice(0, maxChars)}… (${input.length - maxChars} more characters)` : input
  return [
    "The user's latest request to an AI coding agent:",
    intent.trim() ? intent.trim().slice(0, 2000) : '(none recorded)',
    '',
    `The agent${a.agentId ? ' (a subagent)' : ''} is about to run: ${describeAction(a)}`,
    `Kind: ${a.kind}. Tool: ${a.tool}. Input:`,
    body,
  ].join('\n')
}

function yesNo(provider: Provider, q: Question): Record<string, unknown> {
  if (provider === 'typesafe') return { type: 'noul', instructions: q.instructions, criteria: { true: q.yes, false: q.no } }
  return { type: 'boolean', instructions: `${q.instructions} Yes: ${q.yes} No: ${q.no}` }
}

export function requestBody(provider: Provider, state: string, model: string): string {
  const questions: Record<string, unknown> = {}
  for (const hazard of HAZARDS) questions[hazard] = yesNo(provider, BATTERY[hazard])
  questions.severity = { type: 'score', instructions: SEVERITY_INSTRUCTIONS, criteria: SEVERITY_CRITERIA }
  return JSON.stringify(provider === 'typesafe' ? { model, state, questions } : { state, questions })
}

export function requestHeaders(provider: Provider, apiKey: string, model: string): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    'ai-gateway-protocol-version': AI_GATEWAY_PROTOCOL_VERSION,
    'ai-evaluation-model-specification-version': '4',
  }
}

export type Judgement = { probabilities: Record<Hazard, number>; severity: number | null }

/** Reads either backend's answer; a battery with any hazard unanswered reads as none. */
export function readJudgement(text: string): Judgement | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> }).answers
  if (!answers || typeof answers !== 'object') return null
  const probabilities = {} as Record<Hazard, number>
  for (const hazard of HAZARDS) {
    const a = answers[hazard]
    const p = typeof a?.noul === 'number' ? a.noul : typeof a?.probability === 'number' ? a.probability : null
    if (p === null) return null
    probabilities[hazard] = p
  }
  const severity = answers.severity
  return { probabilities, severity: typeof severity?.score === 'number' ? severity.score : null }
}

export type Ruling = { decision: Decision; hazard: Hazard | null; probability: number | null; escalated: boolean }

const RANK: Record<Decision, number> = { allow: 0, ask: 1, deny: 2 }

/**
 * Probabilities to a decision: a hazard at or above `threshold` triggers its
 * configured decision, one at or above `askThreshold` asks, and a severity
 * at or above `severityDeny` turns an ask into a deny. The strictest wins.
 */
export function rule(j: Judgement, cfg: JevConfig): Ruling {
  let best: Ruling = { decision: 'allow', hazard: null, probability: null, escalated: false }
  for (const hazard of HAZARDS) {
    const p = j.probabilities[hazard]
    let decision: Decision = 'allow'
    if (p >= cfg.threshold) decision = cfg.hazards[hazard]
    else if (p >= cfg.askThreshold && cfg.hazards[hazard] !== 'allow') decision = 'ask'
    if (decision === 'allow') continue
    let escalated = false
    if (decision === 'ask' && j.severity !== null && j.severity >= cfg.severityDeny) {
      decision = 'deny'
      escalated = true
    }
    const stronger = RANK[decision] > RANK[best.decision] || (decision === best.decision && p > (best.probability ?? -1))
    if (stronger) best = { decision, hazard, probability: p, escalated }
  }
  return best
}

export const BUILTIN_LABELS: readonly Decision[] = ['allow', 'ask', 'deny']

/** The rubric the engine's small classifier reads when no Jev key is set. */
export function classifyText(state: string, cfg: JevConfig): string {
  return [
    'You are the permission judge for an AI coding agent. Classify the action below as allow, ask or deny.',
    '',
    ...HAZARDS.map(h => `- ${h} → ${cfg.hazards[h]}: ${BATTERY[h].instructions}`),
    '- allow: none of the above applies; ordinary development work toward the request.',
    'Answer "ask" when a hazard may apply but is unclear. Answer "deny" when the damage would be severe and irreversible.',
    '',
    state,
  ].join('\n')
}

export function describeJudgement(j: Judgement | null, ms: number): string {
  const took = ` · ${Math.round(ms)}ms`
  if (!j) return `no answer${took}`
  const parts = (Object.entries(j.probabilities) as [Hazard, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([h, p]) => `${h} ${p.toFixed(2)}`)
  if (j.severity !== null) parts.push(`severity ${j.severity.toFixed(1)}`)
  return parts.join(' · ') + took
}

export function rulingReason(r: Ruling, backend: string): string {
  if (r.hazard === null) return `jev-auto-mode (${backend}) judged it ${r.decision}`
  const p = r.probability === null ? '' : ` ${r.probability.toFixed(2)}`
  return `jev-auto-mode (${backend}): ${r.hazard.replace(/_/g, ' ')}${p}${r.escalated ? ', severity escalated it' : ''}`
}
