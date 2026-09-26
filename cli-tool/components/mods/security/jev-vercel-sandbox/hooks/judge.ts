/**
 * jev-vercel-sandbox — the judge: TypeSafe's Jev asked whether one Bash command is
 * dangerous enough to leave the machine for a Vercel Sandbox.
 *
 * No `$` and no I/O here. The wire shapes are jev-auto-mode's (TypeSafe's
 * System One API and the Vercel AI Gateway's evaluation-model endpoint, both
 * with `ai-gateway-protocol-version`); the battery is this mod's own.
 */

export type Provider = 'typesafe' | 'gateway'

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

/** `@ai-sdk/gateway`'s AI_GATEWAY_PROTOCOL_VERSION. */
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

export type Hazard = 'destructive' | 'remote_code' | 'system_change' | 'exfiltration'

type Question = { instructions: string; yes: string; no: string }

/** What could go wrong on the person's machine if this command ran there. */
export const BATTERY: Record<Hazard, Question> = {
  destructive: {
    instructions:
      'Would this shell command delete, overwrite or irreversibly change files, git history, databases or infrastructure (for example rm -rf, git reset --hard, a force push, DROP TABLE, dd, mkfs, terraform destroy)?',
    yes: 'It destroys or irreversibly changes something that may not be recoverable.',
    no: 'It reads, or makes an ordinary, recoverable change.',
  },
  remote_code: {
    instructions:
      'Does this shell command download and run code from the internet, or install or execute a package, script or binary whose origin is not already part of the project (for example curl | sh, npx of an unknown package, pip install from a URL)?',
    yes: 'It runs code that has not been reviewed.',
    no: 'It runs only code already on the machine or in the project.',
  },
  system_change: {
    instructions:
      'Does this shell command change the machine beyond the project: sudo, system packages, services, users, permissions, shell profiles, global config or environment?',
    yes: 'It changes the machine itself, not just the project.',
    no: 'It stays inside the project.',
  },
  exfiltration: {
    instructions:
      'Would this shell command send files, secrets, credentials or environment variables from this machine to somewhere outside it?',
    yes: 'It sends local data off the machine.',
    no: 'It sends nothing local off the machine.',
  },
}

export const HAZARDS = Object.keys(BATTERY) as Hazard[]

const SEVERITY_INSTRUCTIONS = 'If this command turned out to be a mistake on the developer\'s own machine, how bad would the damage be?'
export const SEVERITY_CRITERIA: readonly string[] = [
  'None: read-only or trivially undone.',
  'Mild: a local change that is easy to undo.',
  'Serious: lost work, a broken environment, or data leaving the machine.',
  'Severe: irreversible loss, a compromised machine, or leaked credentials.',
]

const SAFE_PROGRAMS = new Set([
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'echo', 'printf', 'which', 'type', 'file', 'stat', 'du', 'df',
  'grep', 'egrep', 'rg', 'tree', 'date', 'whoami', 'uname', 'basename', 'dirname', 'realpath', 'sort', 'uniq', 'diff', 'true',
])
const SAFE_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'blame', 'ls-files', 'describe'])
// `git branch -D x` and `git remote remove origin` write: these two are reads only with listing flags
const LISTING_GIT = new Set(['branch', 'remote'])
const LISTING_FLAGS = new Set(['-a', '-r', '-v', '-vv', '--all', '--remotes', '--list', '--verbose', '--show-current'])

/**
 * A command that plainly only reads: one program from a short list, no shell
 * operators, redirects or substitutions. These stay local without a call to
 * the judge. Anything else, however harmless, goes to the judge.
 */
export function isPlainRead(command: string): boolean {
  const c = command.trim()
  if (!c || /[;&|<>`$(){}\n\\]/.test(c)) return false
  const words = c.split(/\s+/)
  const program = words[0]!
  if (program === 'git') {
    const sub = words[1] ?? ''
    if (LISTING_GIT.has(sub)) return words.slice(2).every(w => LISTING_FLAGS.has(w))
    return SAFE_GIT.has(sub) && !words.some(w => /^--(output|exec)/.test(w))
  }
  if (program === 'find') return !words.some(w => /^-(delete|exec|execdir|ok|okdir|fprint|fls)/.test(w))
  // sed is left to the judge: its `w` command writes files without -i
  return SAFE_PROGRAMS.has(program)
}

/** What the judge reads: the user's request, then the command, whole. */
export function stateText(intent: string, command: string, cwd: string): string {
  return [
    "The user's latest request to an AI coding agent:",
    intent.trim() ? intent.trim().slice(0, 2000) : '(none recorded)',
    '',
    `The agent is about to run this shell command on the developer's own machine${cwd ? `, in ${cwd}` : ''}:`,
    command,
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

export type Route = 'local' | 'sandbox'

export type Verdict = {
  route: Route
  /** The hazard that sent it to the sandbox, or the likeliest one when it stayed local. */
  hazard: Hazard | null
  probability: number | null
  /** True when the severity alone crossed its line. */
  bySeverity: boolean
  by: 'read-only' | 'jev' | 'built-in' | 'judge error'
}

/** Sandbox when any hazard reaches `threshold`, or the severity reaches `severityLine`. */
export function decide(j: Judgement, threshold: number, severityLine: number): Verdict {
  let top: Hazard | null = null
  for (const h of HAZARDS) if (top === null || j.probabilities[h] > j.probabilities[top]) top = h
  const p = top === null ? null : j.probabilities[top]
  if (p !== null && p >= threshold) return { route: 'sandbox', hazard: top, probability: p, bySeverity: false, by: 'jev' }
  if (j.severity !== null && j.severity >= severityLine) return { route: 'sandbox', hazard: top, probability: p, bySeverity: true, by: 'jev' }
  return { route: 'local', hazard: top, probability: p, bySeverity: false, by: 'jev' }
}

export const BUILTIN_LABELS: readonly Route[] = ['local', 'sandbox']

/** The rubric the engine's small classifier reads when no Jev key is set. */
export function classifyText(state: string): string {
  return [
    'You route shell commands for an AI coding agent. Answer "sandbox" when the command is dangerous to run on the developer\'s own machine, "local" otherwise.',
    'Dangerous means any of:',
    ...HAZARDS.map(h => `- ${h}: ${BATTERY[h].instructions}`),
    'Ordinary development work (building, testing, reading, editing project files, git commits) is "local".',
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

export function verdictReason(v: Verdict): string {
  if (v.by === 'read-only') return 'plain read'
  if (v.by === 'judge error') return 'the judge gave no answer'
  if (v.by === 'built-in') return `built-in classifier: ${v.route}`
  if (v.hazard === null) return v.route
  const p = v.probability === null ? '' : ` ${v.probability.toFixed(2)}`
  return `${v.hazard.replace(/_/g, ' ')}${p}${v.bySeverity ? ', by severity' : ''}`
}

/** One line for the transcript, the panel and the status: the command, cut to fit. */
export function shortCommand(command: string, max = 60): string {
  const one = command.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}
