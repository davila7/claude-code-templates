/**
 * jev-auto-mode — the JSON policy and its matcher.
 *
 * No `$` and no I/O here: this module parses and validates the config files,
 * merges the user and project layers, and decides which rules an action hits.
 * The hooks module reads the files and asks; the tests drive this directly.
 *
 * An "action" is anything Claude is about to do that the mod governs:
 *   tool     a tool call (Bash, Write, WebFetch, mcp__server__tool, Skill...)
 *   command  a slash command the person typed (/deploy, a skill run as /name)
 *   agent    a subagent about to be spawned
 *   skill    a skill's prompt about to be expanded (typed, Skill tool, or
 *            preloaded into a subagent)
 */

export type Decision = 'allow' | 'ask' | 'deny'

/** What happens to an action no rule matched. */
export type Fallback = Decision | 'passthrough' | 'jev'

export type ActionKind = 'tool' | 'command' | 'agent' | 'skill'

export type Scope = 'all' | 'main' | 'subagents'

export type Rule = {
  /** Shown in the log and in the reason the model reads; defaults to rule #n. */
  id?: string
  decision: Decision
  /** Why, in a sentence: what the model reads on a deny and the person on an ask. */
  reason?: string
  /** Tool name globs: `Bash`, `mcp__github__*`, `Write`. */
  tool?: string | string[]
  /** MCP server globs: `github` matches every `mcp__github__*` tool. */
  mcpServer?: string | string[]
  /** Bash command globs, matched against each part of a compound command. */
  bash?: string | string[]
  /** Regexes over each part of a compound Bash command. */
  bashRegex?: string | string[]
  /** Path globs over file_path / path / notebook_path (`**` crosses `/`). */
  path?: string | string[]
  /** Host globs over a WebFetch/WebSearch url or domain: `*.example.com`. */
  domain?: string | string[]
  /** Skill name globs: the Skill tool, a typed /skill, a preloaded skill. */
  skill?: string | string[]
  /** Slash command name globs (without the slash). */
  command?: string | string[]
  /** Subagent type globs: `general-purpose`, `Explore`, `*`. */
  agent?: string | string[]
  /** Regexes over the action's input as JSON: the catch-all matcher. */
  inputRegex?: string | string[]
  /** Which loops the rule applies in (default all). */
  scope?: Scope
}

export type Hazard = 'destructive' | 'exfiltration' | 'security_weakening' | 'out_of_scope'

export type JevConfig = {
  /** Tool globs the judge is asked about when no rule decided; the rest fall to `default`. */
  tools: string[]
  /** What each hazard does once it crosses `threshold`. */
  hazards: Record<Hazard, Decision>
  /** At or above this probability a hazard triggers its decision. */
  threshold: number
  /** At or above this (but under `threshold`) a hazard asks. */
  askThreshold: number
  /** A severity (0-3) at or above this turns an ask into a deny. */
  severityDeny: number
  /** What a judgement that failed or timed out decides. */
  onError: Fallback
  timeoutMs: number
}

export type Config = {
  /** enforce acts; audit only logs what it would have done. */
  mode: 'enforce' | 'audit'
  /** What an action no rule matched gets: `jev` asks the judge. */
  default: Fallback
  /** Who settles an `ask`: the mod's own dialog, or the engine's permission mode. */
  askWith: 'mod' | 'engine'
  /** What an `ask` becomes when there is no one to ask (`claude -p`). */
  headless: 'deny' | 'allow'
  /** Allow rules a project file may add (only honoured from the user file). */
  trustProjectAllow: boolean
  /**
   * What a shell command whose program is only known at run time gets
   * (`$X -rf /`, `eval …`, `source …`): no rule can read it, so at least this.
   */
  opaqueShell: Decision
  rules: Rule[]
  jev: JevConfig
}

export const CONFIG_NAME = 'jev-auto-mode.json'

export const DEFAULT_JEV: JevConfig = {
  tools: ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'mcp__*'],
  hazards: {
    destructive: 'ask',
    exfiltration: 'deny',
    security_weakening: 'ask',
    out_of_scope: 'ask',
  },
  threshold: 0.7,
  askThreshold: 0.4,
  severityDeny: 3,
  onError: 'ask',
  timeoutMs: 2500,
}

export const DEFAULT_CONFIG: Config = {
  mode: 'enforce',
  default: 'passthrough',
  askWith: 'mod',
  headless: 'deny',
  trustProjectAllow: false,
  opaqueShell: 'ask',
  rules: [],
  jev: DEFAULT_JEV,
}

const DECISIONS: readonly string[] = ['allow', 'ask', 'deny']
const FALLBACKS: readonly string[] = [...DECISIONS, 'passthrough', 'jev']
const MATCHERS = ['tool', 'mcpServer', 'bash', 'bashRegex', 'path', 'domain', 'skill', 'command', 'agent', 'inputRegex'] as const
const HAZARDS: readonly Hazard[] = ['destructive', 'exfiltration', 'security_weakening', 'out_of_scope']

export type Parsed = { config: Partial<Omit<Config, 'jev'>> & { jev?: Partial<JevConfig> }; errors: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): v is string | string[] =>
  typeof v === 'string' || (Array.isArray(v) && v.every(x => typeof x === 'string'))

/**
 * Reads one config file's text. Every problem is reported and the offending
 * piece dropped, never the whole file: a typo in one rule must not silently
 * switch the policy off.
 */
export function parseConfig(text: string, source: string): Parsed {
  const errors: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { config: {}, errors: [`${source}: not valid JSON (${String(err)})`] }
  }
  if (!isObject(raw)) return { config: {}, errors: [`${source}: the top level must be an object`] }

  const config: Parsed['config'] = {}
  const pick = <T extends string>(key: string, allowed: readonly string[]): T | undefined => {
    if (raw[key] === undefined) return undefined
    if (typeof raw[key] === 'string' && allowed.includes(raw[key] as string)) return raw[key] as T
    errors.push(`${source}: "${key}" must be one of ${allowed.join(', ')}`)
    return undefined
  }
  config.mode = pick('mode', ['enforce', 'audit'])
  config.default = pick('default', FALLBACKS)
  config.askWith = pick('askWith', ['mod', 'engine'])
  config.headless = pick('headless', ['deny', 'allow'])
  config.opaqueShell = pick('opaqueShell', DECISIONS)
  if (raw.trustProjectAllow !== undefined) {
    if (typeof raw.trustProjectAllow === 'boolean') config.trustProjectAllow = raw.trustProjectAllow
    else errors.push(`${source}: "trustProjectAllow" must be true or false`)
  }

  if (raw.rules !== undefined) {
    if (!Array.isArray(raw.rules)) errors.push(`${source}: "rules" must be an array`)
    else {
      config.rules = []
      raw.rules.forEach((r, i) => {
        const rule = parseRule(r, `${source} rule #${i + 1}`, errors)
        if (rule) config.rules!.push({ ...rule, id: rule.id ?? `${source}#${i + 1}` })
      })
    }
  }

  if (raw.jev !== undefined) {
    if (!isObject(raw.jev)) errors.push(`${source}: "jev" must be an object`)
    else config.jev = parseJev(raw.jev, source, errors)
  }
  return { config, errors }
}

function parseRule(r: unknown, where: string, errors: string[]): Rule | null {
  if (!isObject(r)) {
    errors.push(`${where}: must be an object`)
    return null
  }
  if (typeof r.decision !== 'string' || !DECISIONS.includes(r.decision)) {
    errors.push(`${where}: "decision" must be allow, ask or deny`)
    return null
  }
  const rule: Rule = { decision: r.decision as Decision }
  if (typeof r.id === 'string') rule.id = r.id
  if (typeof r.reason === 'string') rule.reason = r.reason
  if (r.scope !== undefined) {
    if (r.scope === 'all' || r.scope === 'main' || r.scope === 'subagents') rule.scope = r.scope
    else errors.push(`${where}: "scope" must be all, main or subagents`)
  }
  let matchers = 0
  for (const key of MATCHERS) {
    if (r[key] === undefined) continue
    if (!strings(r[key])) {
      errors.push(`${where}: "${key}" must be a string or a list of strings`)
      return null
    }
    if (key === 'bashRegex' || key === 'inputRegex') {
      for (const source of list(r[key] as string | string[])) {
        try {
          new RegExp(source)
        } catch {
          errors.push(`${where}: "${key}" has an invalid regex: ${source}`)
          return null
        }
      }
    }
    ;(rule as Record<string, unknown>)[key] = r[key]
    matchers += 1
  }
  // A rule with no matcher would hit everything: almost always a typo'd key.
  if (matchers === 0) {
    errors.push(`${where}: names no matcher (${MATCHERS.join(', ')}); a rule that matches everything must say tool: "*"`)
    return null
  }
  const unknown = Object.keys(r).filter(k => !['id', 'decision', 'reason', 'scope', ...MATCHERS].includes(k))
  if (unknown.length) errors.push(`${where}: unknown key${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')} ignored`)
  return rule
}

function parseJev(j: Record<string, unknown>, source: string, errors: string[]): Partial<JevConfig> {
  const out: Partial<JevConfig> = {}
  if (j.tools !== undefined) {
    if (strings(j.tools)) out.tools = list(j.tools)
    else errors.push(`${source}: "jev.tools" must be a list of tool globs`)
  }
  if (j.hazards !== undefined) {
    if (!isObject(j.hazards)) errors.push(`${source}: "jev.hazards" must be an object`)
    else {
      const hazards: Partial<Record<Hazard, Decision>> = {}
      for (const [name, value] of Object.entries(j.hazards)) {
        if (!HAZARDS.includes(name as Hazard)) errors.push(`${source}: unknown hazard "${name}" (${HAZARDS.join(', ')})`)
        else if (typeof value !== 'string' || !DECISIONS.includes(value)) errors.push(`${source}: hazard "${name}" must be allow, ask or deny`)
        else hazards[name as Hazard] = value as Decision
      }
      out.hazards = hazards as Record<Hazard, Decision>
    }
  }
  for (const key of ['threshold', 'askThreshold'] as const) {
    if (j[key] === undefined) continue
    if (typeof j[key] === 'number' && (j[key] as number) >= 0 && (j[key] as number) <= 1) out[key] = j[key] as number
    else errors.push(`${source}: "jev.${key}" must be a number from 0 to 1`)
  }
  if (j.severityDeny !== undefined) {
    if (typeof j.severityDeny === 'number') out.severityDeny = j.severityDeny
    else errors.push(`${source}: "jev.severityDeny" must be a number from 0 to 3`)
  }
  if (j.timeoutMs !== undefined) {
    if (typeof j.timeoutMs === 'number' && j.timeoutMs > 0) out.timeoutMs = j.timeoutMs
    else errors.push(`${source}: "jev.timeoutMs" must be a positive number`)
  }
  if (j.onError !== undefined) {
    if (typeof j.onError === 'string' && FALLBACKS.includes(j.onError) && j.onError !== 'jev') out.onError = j.onError as Fallback
    else errors.push(`${source}: "jev.onError" must be allow, ask, deny or passthrough`)
  }
  return out
}

/**
 * Folds the layers into one policy. The user file (yours, outside any
 * repository) may do anything. The project file ships with the repository, so
 * a checkout could otherwise open everything up: it adds deny and ask rules,
 * and may tighten the settings, but its allow rules only count when the user
 * file says `trustProjectAllow: true`.
 */
export function mergeConfigs(user: Parsed['config'], project: Parsed['config']): { config: Config; notes: string[] } {
  const notes: string[] = []
  const trust = user.trustProjectAllow === true
  const projectRules = (project.rules ?? []).filter(r => {
    if (r.decision !== 'allow' || trust) return true
    notes.push(`project rule ${r.id} (allow) ignored: set trustProjectAllow in your user file to honour project allow rules`)
    return false
  })

  // A setting the project names may only move toward caution.
  const stricter = <T>(order: readonly T[], a: T | undefined, b: T | undefined, fallback: T): T => {
    const base = a ?? fallback
    if (b === undefined || trust) return b ?? base
    return order.indexOf(b) > order.indexOf(base) ? b : base
  }
  const config: Config = {
    mode: stricter(['audit', 'enforce'] as const, user.mode, project.mode, DEFAULT_CONFIG.mode),
    default: stricter(['allow', 'passthrough', 'jev', 'ask', 'deny'] as const, user.default, project.default, DEFAULT_CONFIG.default),
    askWith: user.askWith ?? project.askWith ?? DEFAULT_CONFIG.askWith,
    headless: stricter(['allow', 'deny'] as const, user.headless, project.headless, DEFAULT_CONFIG.headless),
    opaqueShell: stricter(['allow', 'ask', 'deny'] as const, user.opaqueShell, project.opaqueShell, DEFAULT_CONFIG.opaqueShell),
    trustProjectAllow: trust,
    rules: [...(user.rules ?? []), ...projectRules],
    jev: {
      ...DEFAULT_JEV,
      ...user.jev,
      ...(project.jev ? tightenJev(user.jev ?? {}, project.jev, trust) : {}),
      hazards: { ...DEFAULT_JEV.hazards, ...user.jev?.hazards, ...tightenHazards(user.jev?.hazards ?? {}, project.jev?.hazards ?? {}, trust) },
    },
  }
  return { config, notes }
}

const RANK: Record<Decision, number> = { allow: 0, ask: 1, deny: 2 }

function tightenHazards(
  user: Partial<Record<Hazard, Decision>>,
  project: Partial<Record<Hazard, Decision>>,
  trust: boolean,
): Partial<Record<Hazard, Decision>> {
  const out: Partial<Record<Hazard, Decision>> = {}
  for (const [name, value] of Object.entries(project) as [Hazard, Decision][]) {
    const base = user[name] ?? DEFAULT_JEV.hazards[name]
    out[name] = trust || RANK[value] > RANK[base] ? value : base
  }
  return out
}

function tightenJev(user: Partial<JevConfig>, project: Partial<JevConfig>, trust: boolean): Partial<JevConfig> {
  if (trust) {
    const { hazards: _h, ...rest } = project
    return rest
  }
  const out: Partial<JevConfig> = {}
  // more tools judged, lower thresholds: both are more cautious
  if (project.tools) out.tools = [...new Set([...(user.tools ?? DEFAULT_JEV.tools), ...project.tools])]
  if (project.threshold !== undefined) out.threshold = Math.min(project.threshold, user.threshold ?? DEFAULT_JEV.threshold)
  if (project.askThreshold !== undefined)
    out.askThreshold = Math.min(project.askThreshold, user.askThreshold ?? DEFAULT_JEV.askThreshold)
  if (project.severityDeny !== undefined)
    out.severityDeny = Math.min(project.severityDeny, user.severityDeny ?? DEFAULT_JEV.severityDeny)
  return out
}

// ---------------------------------------------------------------------------
// Matching

export function list(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

const cache = new Map<string, RegExp>()

/**
 * A glob as a regex. In `path` mode `*` stays inside one segment and `**`
 * crosses them; elsewhere `*` matches anything, spaces included, so
 * `git push*--force*` reads the way it is written. `?` is one character.
 */
export function globToRegex(glob: string, mode: 'path' | 'text' = 'text'): RegExp {
  const key = `${mode}:${glob}`
  const hit = cache.get(key)
  if (hit) return hit
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (mode === 'path' && glob[i + 1] === '*') {
        // `**/` also matches no directory at all
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?'
          i += 2
        } else {
          out += '.*'
          i += 1
        }
      } else out += mode === 'path' ? '[^/]*' : '.*'
    } else if (c === '?') out += mode === 'path' ? '[^/]' : '.'
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  const re = new RegExp(`^${out}$`, mode === 'text' ? 's' : '')
  cache.set(key, re)
  return re
}

export const globMatch = (glob: string, value: string, mode: 'path' | 'text' = 'text') => globToRegex(glob, mode).test(value)

/**
 * The simple commands of a Bash line: split on `&&`, `||`, `;`, `|`, `&` and
 * newlines outside quotes, with `$( … )` and backtick bodies checked as parts
 * of their own. A deny rule hits a line when it hits any part; an allow rule
 * only when it covers every part, so `ls && rm -rf ~` is not allowed by an
 * allow on `ls*`.
 */
export function bashParts(command: string): string[] {
  const parts: string[] = []
  const nested: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"') {
        current += c + (command[i + 1] ?? '')
        i += 1
        continue
      }
      current += c
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      current += c
      continue
    }
    if (c === '\\') {
      current += c + (command[i + 1] ?? '')
      i += 1
      continue
    }
    if (c === '$' && command[i + 1] === '(') {
      let depth = 1
      let j = i + 2
      for (; j < command.length && depth > 0; j++) {
        if (command[j] === '(') depth += 1
        else if (command[j] === ')') depth -= 1
      }
      nested.push(command.slice(i + 2, j - 1))
      current += command.slice(i, j)
      i = j - 1
      continue
    }
    if (c === '`') {
      const end = command.indexOf('`', i + 1)
      const body = end === -1 ? command.slice(i + 1) : command.slice(i + 1, end)
      nested.push(body)
      current += end === -1 ? command.slice(i) : command.slice(i, end + 1)
      i = end === -1 ? command.length : end
      continue
    }
    const two = command.slice(i, i + 2)
    if (two === '&&' || two === '||') {
      parts.push(current)
      current = ''
      i += 1
      continue
    }
    if (c === ';' || c === '|' || c === '\n' || (c === '&' && command[i + 1] !== '>' && command[i - 1] !== '>')) {
      parts.push(current)
      current = ''
      continue
    }
    current += c
  }
  parts.push(current)
  // `bash -c '…'` / `sh -c "…"`: the quoted script is a command line of its own
  for (const part of parts) {
    const m = /^\s*(?:\S*\/)?(?:ba|z|da|k)?sh\s+(?:-\w+\s+)*-c\s+(['"])([\s\S]*)\1/.exec(part.trim())
    if (m) nested.push(m[2]!)
  }
  return [...parts, ...nested.flatMap(bashParts)].map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/**
 * A part as the shell will run it, for matching: `$IFS` read as a space,
 * backslash escapes and quotes dropped, so `r'm' -rf` and `rm${IFS}-rf` read
 * as `rm -rf`.
 */
export function normalizePart(part: string): string {
  return part
    .replace(/\$\{IFS[^}]*\}|\$IFS\b/g, ' ')
    .replace(/\\(.)/g, '$1')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const WRAPPERS = new Set(['sudo', 'env', 'nohup', 'time', 'command', 'builtin', 'exec', 'nice', 'stdbuf', 'timeout', 'xargs'])

/** The part without leading `VAR=value` assignments and wrappers (`sudo`, `env`, `nohup` …). */
export function strippedPart(part: string): string {
  const words = normalizePart(part).split(' ')
  let i = 0
  while (i < words.length) {
    const w = words[i]!
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || WRAPPERS.has(w)) i += 1
    else if (i > 0 && WRAPPERS.has(words[i - 1]!) && /^-/.test(w)) i += 1
    else break
  }
  return words.slice(i).join(' ')
}

/** `NAME=value` assignments made anywhere in a command line, for reading `$NAME` back. */
export function assignments(command: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const part of bashParts(command)) {
    for (const word of normalizePart(part).split(' ')) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(word)
      if (m) vars[m[1]!] = m[2]!
      else break
    }
  }
  return vars
}

/** `$NAME` / `${NAME}` replaced by what the same command line assigned it. */
export function substitute(part: string, vars: Record<string, string>): string {
  return part.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (whole, name: string) => vars[name] ?? whole)
}

/** Every reading of a part a rule should see: as written, normalized, unwrapped, and with its variables read back. */
export function readings(part: string, vars: Record<string, string> = {}): string[] {
  const resolved = substitute(part, vars)
  return [...new Set([part, normalizePart(part), strippedPart(part), normalizePart(resolved), strippedPart(resolved)].filter(Boolean))]
}

/**
 * Whether the program a part runs is only known at run time (`$X -rf /`,
 * `eval "$cmd"`, `source ./x`): no rule can read what it will do.
 */
export function opaquePart(part: string, vars: Record<string, string> = {}): boolean {
  const word = strippedPart(substitute(part, vars)).split(' ')[0] ?? ''
  return /^[$`]/.test(word) || word === 'eval' || word === 'source' || word === '.'
}

/** One governed action, with what each matcher reads already pulled out. */
export type Action = {
  kind: ActionKind
  /** The tool name; for command/agent/skill, `/name`, `Agent`, `Skill`. */
  tool: string
  input: Record<string, unknown>
  /** Command name (without slash) for kind command. */
  command?: string
  /** Skill name for the Skill tool, a /skill, or a preloaded skill. */
  skill?: string
  /** Subagent type for kind agent (or the Agent tool's subagent_type). */
  agent?: string
  /** The loop it runs in: undefined on main. */
  agentId?: string
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/** A tool call as an Action, with the fields the matchers need. */
export function toolAction(tool: string, input: Record<string, unknown>, agentId?: string): Action {
  return {
    kind: 'tool',
    tool,
    input,
    agentId,
    skill: tool === 'Skill' ? str(input.skill) ?? str(input.command) : undefined,
    agent: tool === 'Agent' || tool === 'Task' ? str(input.subagent_type) ?? 'general-purpose' : undefined,
  }
}

export function paths(a: Action, root: string, home: string | undefined): string[] {
  const raw = [a.input.file_path, a.input.path, a.input.notebook_path].map(str).filter((p): p is string => !!p)
  const out = new Set<string>()
  for (let p of raw) {
    if (home && (p === '~' || p.startsWith('~/'))) p = home + p.slice(1)
    out.add(p)
    const r = root.replace(/\/+$/, '')
    if (p.startsWith(`${r}/`)) out.add(p.slice(r.length + 1))
    else if (!p.startsWith('/')) out.add(`${r}/${p}`)
  }
  return [...out]
}

export function hostOf(a: Action): string | undefined {
  const url = str(a.input.url)
  if (url) {
    // the authority, less any `user:pass@` (https://allowed.com@evil.com goes to evil.com) and port
    const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(url.trim())
    if (m) {
      const host = m[1]!.slice(m[1]!.lastIndexOf('@') + 1).replace(/:\d*$/, '').replace(/^\[|\]$/g, '')
      return host.toLowerCase().replace(/\.$/, '')
    }
  }
  return str(a.input.domain)?.toLowerCase()
}

function expandHome(glob: string, home: string | undefined): string {
  return home && (glob === '~' || glob.startsWith('~/')) ? home + glob.slice(1) : glob
}

export type MatchContext = { root: string; home?: string }

/**
 * Whether a rule applies to an action. Every matcher the rule names must hit
 * (they AND together); within one matcher any listed glob may hit (OR). A
 * matcher that cannot apply to this kind of action (a `bash` glob on a
 * Write) makes the rule miss rather than match vacuously.
 */
export function ruleMatches(rule: Rule, a: Action, ctx: MatchContext): boolean {
  if (rule.scope === 'main' && a.agentId) return false
  if (rule.scope === 'subagents' && !a.agentId) return false

  if (rule.tool !== undefined && !list(rule.tool).some(g => globMatch(g, a.tool))) return false
  if (rule.mcpServer !== undefined) {
    const m = /^mcp__(.+?)__/.exec(a.tool)
    if (!m || !list(rule.mcpServer).some(g => globMatch(g, m[1]!))) return false
  }
  if (rule.bash !== undefined || rule.bashRegex !== undefined) {
    const command = a.tool === 'Bash' ? str(a.input.command) : undefined
    if (command === undefined) return false
    const parts = bashParts(command)
    const vars = assignments(command)
    const one = (text: string) =>
      list(rule.bash).some(g => globMatch(g, text)) || list(rule.bashRegex).some(r => new RegExp(r).test(text))
    // deny/ask read every spelling of a part (written, unquoted, unwrapped);
    // an allow must hold for the part as the shell will run it
    const hits = (part: string) => (rule.decision === 'allow' ? one(normalizePart(part)) : readings(part, vars).some(one))
    // deny/ask: any part is enough; allow: every part must be covered
    if (rule.decision === 'allow' ? !parts.every(hits) : !parts.some(hits)) return false
  }
  if (rule.path !== undefined) {
    const ps = paths(a, ctx.root, ctx.home)
    if (!ps.length || !list(rule.path).some(g => ps.some(p => globMatch(expandHome(g, ctx.home), p, 'path')))) return false
  }
  if (rule.domain !== undefined) {
    const host = hostOf(a)
    if (!host || !list(rule.domain).some(g => globMatch(g.toLowerCase(), host) || (g.startsWith('*.') && host === g.slice(2).toLowerCase())))
      return false
  }
  if (rule.skill !== undefined && !(a.skill && list(rule.skill).some(g => globMatch(g, a.skill!)))) return false
  if (rule.command !== undefined && !(a.kind === 'command' && a.command && list(rule.command).some(g => globMatch(g, a.command!))))
    return false
  if (rule.agent !== undefined && !(a.agent && list(rule.agent).some(g => globMatch(g, a.agent!)))) return false
  if (rule.inputRegex !== undefined) {
    const json = JSON.stringify(a.input)
    if (!list(rule.inputRegex).some(r => new RegExp(r).test(json))) return false
  }
  return true
}

export type Verdict =
  | { source: 'rule'; decision: Decision; rule: Rule; reason: string }
  | { source: 'fallback'; fallback: Fallback }

/** deny beats ask beats allow, whatever order the rules were written in. */
export function evaluate(config: Config, a: Action, ctx: MatchContext): Verdict {
  let best: Rule | undefined
  for (const rule of config.rules) {
    if (!ruleMatches(rule, a, ctx)) continue
    if (!best || RANK[rule.decision] > RANK[best.decision]) best = rule
    if (best.decision === 'deny') break
  }
  // A program only known at run time slips past every bash matcher: give it at least opaqueShell.
  const command = a.tool === 'Bash' ? str(a.input.command) : undefined
  if (command !== undefined && (!best || RANK[best.decision] < RANK[config.opaqueShell]) && bashParts(command).some(part => opaquePart(part, assignments(command)))) {
    best = {
      id: 'opaque-shell',
      decision: config.opaqueShell,
      reason: `jev-auto-mode: this command runs a program only known at run time (a variable, eval or source), which no rule can check`,
    }
  }
  if (best) {
    return {
      source: 'rule',
      decision: best.decision,
      rule: best,
      reason: best.reason ?? `rule ${best.id} (${best.decision})`,
    }
  }
  return { source: 'fallback', fallback: config.default }
}

/** Whether the judge is asked about this action when no rule decided. */
export function judged(config: Config, a: Action): boolean {
  return config.default === 'jev' && (a.kind !== 'tool' || config.jev.tools.some(g => globMatch(g, a.tool)))
}

// ---------------------------------------------------------------------------
// Self-protection: Claude may not rewrite the policy that governs it.

/** Tools that only read, and tools whose input is prose (a prompt, a question), not an operation. */
const HARMLESS_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'Agent', 'Task', 'TodoWrite', 'AskUserQuestion', 'WebSearch', 'Skill', 'ToolSearch'])
const READ_ONLY_COMMAND = /^(cat|less|more|head|tail|grep|rg|jq|ls|stat|wc|diff|file|git (diff|log|show|status|blame))(\s|$)/

/**
 * A reason to refuse an action that would change this mod's policy or the mod
 * itself, or undefined. It runs before any rule, so no rule (and no project
 * file) can switch it off. It errs toward refusing: any tool but a reader
 * whose input names the policy file or the mod's directory is refused, and so
 * is any shell part naming them that is not a plain read (`cat`, `grep`, …).
 */
export function selfProtection(a: Action, pluginRoot: string, ctx: MatchContext): string | undefined {
  const root = pluginRoot.replace(/\/+$/, '')
  const mentions = (text: string) =>
    text.includes(CONFIG_NAME) || (root !== '' && text.includes(root)) || /jev-auto-mode\/(hooks|\.claude-plugin|examples)\b/.test(text)
  if (a.kind !== 'tool' || HARMLESS_TOOLS.has(a.tool)) return undefined
  if (a.tool === 'Bash') {
    const command = str(a.input.command) ?? ''
    const touches = bashParts(command).some(part => {
      const plain = normalizePart(part)
      if (!mentions(plain)) return false
      return !(READ_ONLY_COMMAND.test(strippedPart(part)) && !/[>]/.test(plain) && !/\s-(o|O|i)\b/.test(plain))
    })
    return touches ? `jev-auto-mode: shell commands that touch ${CONFIG_NAME} or the mod beyond reading them are refused; edit it yourself` : undefined
  }
  // path-like values only (no whitespace): a file's content that merely mentions the name is fine
  const values: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (!/\s/.test(v.trim())) values.push(v.trim())
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(a.input)
  if (values.some(mentions) || paths(a, ctx.root, ctx.home).some(p => mentions(p))) {
    return `jev-auto-mode: ${CONFIG_NAME} and the mod's own files can only be edited by the person, not by Claude`
  }
  return undefined
}

/** One line for the log: what the action is. */
export function describeAction(a: Action): string {
  if (a.kind === 'command') return `/${a.command}${a.input.args ? ` ${a.input.args}` : ''}`
  if (a.kind === 'agent') return `Agent(${a.agent})`
  if (a.kind === 'skill') return `skill ${a.skill}`
  const detail =
    str(a.input.command) ??
    str(a.input.file_path) ??
    str(a.input.notebook_path) ??
    str(a.input.path) ??
    str(a.input.url) ??
    str(a.input.skill) ??
    str(a.input.pattern) ??
    str(a.input.description) ??
    ''
  const one = detail.replace(/\s+/g, ' ').trim()
  return one ? `${a.tool}(${one.length > 80 ? `${one.slice(0, 79)}…` : one})` : a.tool
}
