/**
 * jev-vercel-sandbox — the detector: TypeSafe's Jev asked whether one Bash
 * command is one of the jobs a sandbox is for.
 *
 * Whether a command may run on the person's machine at all is not asked here:
 * auto mode and jev-guardrails decide that. This asks only whether the command
 * is better done in a Vercel Sandbox (a long test run, someone else's repo, an
 * unknown installer, a bulk change to preview, a clean build), and each answer
 * comes with the profile the job runs under.
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

export type UseCase = 'tests' | 'external_repo' | 'untrusted_code' | 'repo_change' | 'clean_build'

/** Which copy of the project a job starts from. */
export type WorkspaceKind = 'current' | 'none'
/** What a job hands back: its output, or also the files it changed and a patch of them. */
export type Returns = 'output' | 'changes' | 'patch'

export type Profile = {
  /** How the person reads it in the question and the pane. */
  label: string
  workspace: WorkspaceKind
  background: boolean
  returns: Returns
  /** Also list the files it wrote outside the job's folder and the processes it left. */
  watch: boolean
}

export const PROFILES: Record<UseCase, Profile> = {
  tests: { label: 'a long test, lint or typecheck run', workspace: 'current', background: true, returns: 'output', watch: false },
  external_repo: { label: "someone else's repository to clone and run", workspace: 'none', background: false, returns: 'output', watch: false },
  untrusted_code: { label: 'an installer or script of unknown origin', workspace: 'none', background: false, returns: 'output', watch: true },
  repo_change: { label: 'a bulk change to the project, to preview first', workspace: 'current', background: false, returns: 'patch', watch: false },
  clean_build: { label: 'a build from a clean checkout', workspace: 'current', background: true, returns: 'output', watch: false },
}

export const USE_CASES = Object.keys(PROFILES) as UseCase[]

type Question = { instructions: string; yes: string; no: string }

/** One yes/no question per use case: is this command that kind of job? */
export const BATTERY: Record<UseCase, Question> = {
  tests: {
    instructions:
      "Is this shell command a project's full test suite, lint or typecheck run that takes a while and whose result the agent can wait for (for example npm test, pytest, go test ./..., cargo test, tsc --noEmit, eslint .)? A single quick test file does not count.",
    yes: 'It is a long check the agent could run elsewhere and keep working.',
    no: 'It is not a test, lint or typecheck run, or it is a quick one.',
  },
  external_repo: {
    instructions:
      'Does this shell command clone, download or run a repository or project that is not the one the agent is working in (for example git clone of another repo followed by its install or tests)?',
    yes: "It works on someone else's code.",
    no: 'It works only on the current project.',
  },
  untrusted_code: {
    instructions:
      'Does this shell command download and run code whose origin is not already part of the project: a script piped to a shell, a package or tool installed or run for the first time, a downloaded binary (for example curl ... | sh, npx some-new-package, pip install from a URL)?',
    yes: 'It runs code that has not been reviewed.',
    no: 'It runs only code already in the project or on the machine.',
  },
  repo_change: {
    instructions:
      'Does this shell command change many of the project\'s files at once in a way worth previewing before it touches them: deleting folders, a codemod, a mass rename or search-and-replace, regenerating files, a dependency upgrade that rewrites lockfiles (for example rm -rf src/legacy, npx jscodeshift, sed -i across many files, npm update)?',
    yes: 'It rewrites or removes many project files at once.',
    no: 'It reads, or changes one or two files.',
  },
  clean_build: {
    instructions:
      'Is this shell command a full build or install of the project from scratch, where a clean machine would tell whether it builds without local caches (for example npm ci && npm run build, rm -rf node_modules && npm install, a docker-free release build)?',
    yes: 'It is a from-scratch build or install.',
    no: 'It is not a full build or install.',
  },
}

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
 * operators, redirects or substitutions. None of the use cases can be one of
 * these, so they stay local without a call to the detector.
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
  return SAFE_PROGRAMS.has(program)
}

/** What the detector reads: the user's request, then the command, whole. */
export function stateText(intent: string, command: string, cwd: string): string {
  return [
    "The user's latest request to an AI coding agent:",
    intent.trim() ? intent.trim().slice(0, 2000) : '(none recorded)',
    '',
    `The agent is about to run this shell command${cwd ? ` in ${cwd}` : ''}:`,
    command,
  ].join('\n')
}

function yesNo(provider: Provider, q: Question): Record<string, unknown> {
  if (provider === 'typesafe') return { type: 'noul', instructions: q.instructions, criteria: { true: q.yes, false: q.no } }
  return { type: 'boolean', instructions: `${q.instructions} Yes: ${q.yes} No: ${q.no}` }
}

/** The battery for the use cases turned on, one question each. */
export function requestBody(provider: Provider, state: string, model: string, cases: readonly UseCase[] = USE_CASES): string {
  const questions: Record<string, unknown> = {}
  for (const c of cases) questions[c] = yesNo(provider, BATTERY[c])
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

export type Judgement = Partial<Record<UseCase, number>>

/** Reads either backend's answer; one with any asked use case unanswered reads as none. */
export function readJudgement(text: string, cases: readonly UseCase[] = USE_CASES): Judgement | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> }).answers
  if (!answers || typeof answers !== 'object') return null
  const out: Judgement = {}
  for (const c of cases) {
    const a = answers[c]
    const p = typeof a?.noul === 'number' ? a.noul : typeof a?.probability === 'number' ? a.probability : null
    if (p === null) return null
    out[c] = p
  }
  return out
}

export type Detection = {
  /** The use case found, or null when the command is none of them. */
  useCase: UseCase | null
  probability: number | null
  by: 'read-only' | 'jev' | 'built-in' | 'no answer'
}

/** The likeliest use case when it reaches `threshold`, else none. */
export function decide(j: Judgement, threshold: number): Detection {
  let top: UseCase | null = null
  for (const c of Object.keys(j) as UseCase[]) if (top === null || j[c]! > j[top]!) top = c
  const p = top === null ? null : j[top]!
  if (top !== null && p !== null && p >= threshold) return { useCase: top, probability: p, by: 'jev' }
  return { useCase: null, probability: p, by: 'jev' }
}

/** The labels the engine's small classifier picks from when no Jev key is set. */
export function builtinLabels(cases: readonly UseCase[] = USE_CASES): string[] {
  return ['none', ...cases]
}

/** The rubric the engine's small classifier reads when no Jev key is set. */
export function classifyText(state: string, cases: readonly UseCase[] = USE_CASES): string {
  return [
    'You decide whether a shell command an AI coding agent is about to run is one of the jobs a remote sandbox is for. Answer with the job\'s label, or "none".',
    ...cases.map(c => `- ${c}: ${BATTERY[c].instructions}`),
    'Ordinary development work (reading, editing a file, a quick single test, git commits, starting the dev server) is "none".',
    '',
    state,
  ].join('\n')
}

/** The use cases a comma-separated option turns on; empty or unknown names turn on none of their own. */
export function parseUseCases(value: string): UseCase[] {
  if (!value.trim()) return [...USE_CASES]
  const wanted = new Set(value.split(',').map(s => s.trim().toLowerCase().replace(/-/g, '_')))
  return USE_CASES.filter(c => wanted.has(c))
}

export function describeJudgement(j: Judgement | null, ms: number): string {
  const took = ` · ${Math.round(ms)}ms`
  if (!j) return `no answer${took}`
  return (
    (Object.entries(j) as [UseCase, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([c, p]) => `${c} ${p.toFixed(2)}`)
      .join(' · ') + took
  )
}

export function detectionReason(d: Detection): string {
  if (d.by === 'read-only') return 'plain read'
  if (d.by === 'no answer') return 'the detector gave no answer'
  if (!d.useCase) return d.by === 'built-in' ? 'built-in classifier: none' : `none${d.probability === null ? '' : ` (top ${d.probability.toFixed(2)})`}`
  const p = d.probability === null ? '' : ` ${d.probability.toFixed(2)}`
  return `${d.useCase.replace(/_/g, ' ')}${p}${d.by === 'built-in' ? ' (built-in classifier)' : ''}`
}

/** One line for the transcript, the pane and the status: the command, cut to fit. */
export function shortCommand(command: string, max = 60): string {
  const one = command.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}
