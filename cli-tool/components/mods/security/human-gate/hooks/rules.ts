/**
 * human-gate: which tool calls only a person may approve. Pure functions, no `$`.
 */

export type Category = 'deploy' | 'publish' | 'push-main' | 'money' | 'outbound' | 'data'

export const CATEGORIES: readonly Category[] = ['deploy', 'publish', 'push-main', 'money', 'outbound', 'data']

export interface Gate {
  category: Category | 'custom'
  /** What the call does, shown in the dialog. */
  what: string
}

interface BashRule { category: Category; pattern: RegExp; what: string }

/** Global flags between a command and its verb (`terraform -chdir=infra apply`, `kubectl -n prod apply`, `pnpm -r publish`). */
const F = String.raw`(?:\s+-\S+(?:\s+[^\s-]\S*)??)*?`
const re = (source: string, flags = '') => new RegExp(source, flags)

/** Bash commands, matched on each segment of a compound command with quoted text blanked out. */
const BASH_RULES: readonly BashRule[] = [
  { category: 'deploy', pattern: re(String.raw`\bwrangler${F}\s+(?:pages\s+|versions\s+)?(?:deploy|publish)\b`), what: 'deploy to Cloudflare' },
  { category: 'deploy', pattern: /\bvercel\b(?=.*(?:\s--prod\b|\sdeploy\b|\spromote\b))/, what: 'deploy to Vercel' },
  { category: 'deploy', pattern: re(String.raw`\b(?:fly|flyctl)${F}\s+deploy\b`), what: 'deploy to Fly.io' },
  { category: 'deploy', pattern: re(String.raw`\bkubectl${F}\s+(?:apply|delete|replace|patch|scale|rollout\s+restart)\b`), what: 'change a Kubernetes cluster' },
  { category: 'deploy', pattern: re(String.raw`\bhelm${F}\s+(?:install|upgrade|uninstall|rollback)\b`), what: 'change a Helm release' },
  { category: 'deploy', pattern: re(String.raw`\b(?:terraform|tofu)${F}\s+(?:apply|destroy)\b`), what: 'apply Terraform' },
  { category: 'deploy', pattern: re(String.raw`\bgh${F}\s+workflow\s+run\b`), what: 'start a GitHub workflow' },
  { category: 'publish', pattern: re(String.raw`\b(?:npm|pnpm|bun)${F}\s+publish\b|\byarn${F}\s+(?:npm\s+)?publish\b`), what: 'publish a package to npm' },
  { category: 'publish', pattern: re(String.raw`\bnpm${F}\s+(?:unpublish|deprecate|dist-tag\s+(?:add|rm))\b`), what: 'change a published npm package' },
  { category: 'publish', pattern: re(String.raw`\bcargo${F}\s+publish\b|\btwine${F}\s+upload\b|\bgem${F}\s+push\b|\bpoetry${F}\s+publish\b`), what: 'publish a package' },
  { category: 'publish', pattern: re(String.raw`\bdocker${F}\s+(?:image\s+)?push\b`), what: 'push a container image' },
  { category: 'publish', pattern: re(String.raw`\bgh${F}\s+release\s+create\b`), what: 'create a GitHub release' },
  { category: 'data', pattern: /\bprisma\s+migrate\s+(?:deploy|reset)\b|\balembic\s+(?:upgrade|downgrade)\b|\brails\s+db:(?:migrate|drop|reset)\b/, what: 'run a database migration' },
]

const DESTRUCTIVE_SQL_RE = /\b(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE|SCHEMA|ROLE|USER)\b|\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)|\bUPDATE\s+(?:ONLY\s+)?[\w."]+(?:\s+(?:AS\s+)?(?!SET\b)\w+)?\s+SET\b(?![^;]*\bWHERE\b)/i
/** SQL with its string literals and comments blanked, so `SET bio = 'WHERE'` or `-- WHERE` is not read as a filter. */
export function sqlCode(sql: string): string {
  return sql.replace(/'(?:[^']|'')*(?:'|$)|\$(\w*)\$[\s\S]*?(?:\$\1\$|$)|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, m => ' '.repeat(m.length))
}

function destructiveSql(sql: string): boolean {
  return DESTRUCTIVE_SQL_RE.test(sqlCode(sql))
}

/** SQL clients: their quoted arguments are SQL, so destructive SQL is looked for inside the quotes too. */
const SQL_CLIENT = /\b(?:psql|mysql|mariadb|sqlite3|sqlcmd|cockroach|duckdb|clickhouse(?:-client)?|snowsql|bq\s+query|turso\s+db\s+shell|neonctl)\b/

/** Blanks out the text inside quotes, so `git commit -m "explain npm publish"` is not read as a publish. */
export function unquote(segment: string): string {
  return segment.replace(/"(?:[^"\\]|\\.)*(?:"|$)|'[^']*(?:'|$)/g, m => ' '.repeat(m.length))
}

/**
 * Splits a shell line on `&&`, `||`, `;`, `|` and newlines outside quotes, so
 * `cd x && npm publish` is caught and `git commit -m "a && npm publish"` is one segment.
 */
export function segments(command: string): string[] {
  // A backslash-newline continues the line: `npm \\\n publish` is one command.
  command = command.replace(/\\\r?\n/g, ' ')
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | undefined
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      cur += c
      if (c === '\\' && quote === '"' && i + 1 < command.length) cur += command[++i]
      else if (c === quote) quote = undefined
      continue
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '\\' && i + 1 < command.length) { cur += c + command[++i]; continue }
    const two = command.slice(i, i + 2)
    if (two === '&&' || two === '||') { out.push(cur); cur = ''; i++; continue }
    if (c === ';' || c === '|' || c === '\n') { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out.map(s => s.trim()).filter(Boolean)
}

/** The shell words of a segment with their quotes removed: `git push origin "HEAD:main"` → [..., 'HEAD:main']. */
export function words(segment: string): string[] {
  const out: string[] = []
  let cur = ''
  let has = false
  let quote: '"' | "'" | undefined
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i]
    if (quote) {
      if (c === quote) quote = undefined
      else if (c === '\\' && quote === '"' && i + 1 < segment.length) cur += segment[++i]
      else cur += c
      continue
    }
    if (c === '"' || c === "'") { quote = c; has = true; continue }
    if (c === '\\' && i + 1 < segment.length) { cur += segment[++i]; has = true; continue }
    if (/\s/.test(c)) { if (has) out.push(cur); cur = ''; has = false; continue }
    cur += c
    has = true
  }
  if (has) out.push(cur)
  return out
}

const PUSH = re(String.raw`\bgit${F}\s+push\b(.*)$`)
const PROTECTED = /^(?:main|master|production|prod|release)$/

export function isProtected(branch: string, protectedBranches: readonly string[]): boolean {
  return protectedBranches.length > 0 ? protectedBranches.includes(branch) : PROTECTED.test(branch)
}

/** A directory given to the shell that this module cannot resolve on its own: `~`, `$VAR`, `$(...)`, backticks. */
const DYNAMIC_DIR = /[~$`]/

export type PushTargets = { all: true } | { refs: string[]; current: boolean; dir?: string | null }

/**
 * What a `git push` segment pushes: every branch (`--all`, `--mirror`), the
 * refs it names (`HEAD` and `@` read as the current branch), or only the
 * current branch when it names none. `dir` is the `git -C` directory
 * (null when it cannot be resolved). Undefined when the segment is no push.
 */
export function pushTargets(segment: string): PushTargets | undefined {
  // The push itself must be outside quotes; its arguments are read with their quotes removed.
  if (!PUSH.test(unquote(segment))) return undefined
  const w = words(segment)
  const g = w.indexOf('git')
  if (g < 0) return undefined
  let dir: string | null | undefined
  let i = g + 1
  for (; i < w.length && w[i] !== 'push'; i++) {
    const flag = w[i]
    if (flag === '-C') { const d = w[++i]; dir = d === undefined || DYNAMIC_DIR.test(d) ? null : dir ? `${dir}/${d}` : d }
    else if (/^--(?:git-dir|work-tree)(?:=|$)/.test(flag)) { dir = null; if (!flag.includes('=')) i++ }
    else if (flag === '-c') i++
  }
  const args = w.slice(i + 1)
  if (args.some(a => a === '--all' || a === '--mirror' || a === '--branches')) return { all: true }
  // Options that take the next word as their value, and `--repo`, which names the repository itself.
  const positional: string[] = []
  let repoGiven = false
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (a === '--repo') { repoGiven = true; k++ }
    else if (a.startsWith('--repo=')) repoGiven = true
    else if (a === '-o' || a === '--push-option' || a === '--receive-pack' || a === '--exec') k++
    else if (!a.startsWith('-')) positional.push(a)
  }
  const refspecs = repoGiven ? positional : positional.slice(1)
  const refs: string[] = []
  let current = refspecs.length === 0 // `git push`, `git push origin`, `git push --repo=origin`
  for (const ref of refspecs) {
    const target = (ref.includes(':') ? ref.split(':').pop() ?? '' : ref).replace(/^\+/, '').replace(/^refs\/heads\//, '')
    if (target === 'HEAD' || target === '@' || target === '') current = true
    else refs.push(target)
  }
  return dir === undefined ? { refs, current } : { refs, current, dir }
}

/** Joins a `cd` target onto the directory the line is in (relative to the session's). Null: unknown. */
function cdTo(from: string | null | undefined, target: string | undefined): string | null | undefined {
  if (from === null) return null
  if (target === undefined || target === '-' || DYNAMIC_DIR.test(target)) return null
  if (target.startsWith('/')) return target
  return from ? `${from}/${target}` : target
}

export interface Config {
  categories: ReadonlySet<Category>
  /** Category names the option gave that do not exist; the module logs them. */
  unknownCategories: readonly string[]
  /** Extra patterns that do not compile; the module logs them. */
  badPatterns: readonly string[]
  extraCommands: readonly RegExp[]
  extraTools: readonly RegExp[]
  protectedBranches: readonly string[]
}

/** `mcp__server__tool` split in two; anything else is a built-in tool. */
function mcpParts(tool: string): { server: string; name: string } | undefined {
  const m = /^mcp__(.+)__([^_](?:.*))$/.exec(tool)
  return m ? { server: m[1], name: m[2] } : undefined
}

const READ_VERB = /^(?:list|get|retrieve|search|read|fetch|describe|find|count|query_read)(?:_|$)/i
/** A word that changes something: `get_or_create_customer` is no read. */
const WRITE_WORD = /(?:^|_)(?:create|update|delete|remove|cancel|set|add|send|pay|charge|refund|capture|confirm|finalize|void|transfer|upsert|write|post)(?:_|$)/i

/** `sendMessage`, `addIssueComment`, `send-message` → `send_message`, `add_issue_comment`. */
function snake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase()
}

function mcpGate(tool: string, on: (c: Category) => boolean): Gate | undefined {
  const parts = mcpParts(tool)
  if (!parts) return undefined
  const p = { server: parts.server, name: snake(parts.name) }
  const isRead = READ_VERB.test(p.name) && !WRITE_WORD.test(p.name)
  if (on('money') && !isRead && /stripe/i.test(p.server)) return { category: 'money', what: 'a Stripe action that changes money or customers' }
  if (on('money') && !isRead && /(?:^|_)(?:refund|payout|charge|transfer|payment_intent|capture|invoice)/i.test(p.name)) return { category: 'money', what: 'move money' }
  if (on('outbound') && /(?:^|_)(?:send|forward|reply|post|publish|share)(?:_|$)|(?:^|_)(?:add|create)_\w*comment/i.test(p.name)) return { category: 'outbound', what: 'send a message outside the session' }
  if (on('deploy') && /(?:^|_)deploy(?:_|$)|publish_website|delete_(?:project|branch|postgres_database|database|bucket)/i.test(p.name)) return { category: 'deploy', what: 'change or delete a hosted resource' }
  return undefined
}

/** Every string inside a tool's input, however nested. */
function strings_in(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings_in(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings_in(v, out)
  return out
}

/**
 * The gate a call falls under, or undefined. `currentBranch(dir)` answers a
 * push of the current branch in `dir` (the session's directory when
 * undefined); it is only called when one is found, and an unknown branch or
 * directory holds the push (fail closed).
 */
export async function gateFor(
  tool: string,
  input: unknown,
  config: Config,
  currentBranch: (dir?: string) => Promise<string | undefined>,
): Promise<Gate | undefined> {
  const on = (c: Category) => config.categories.has(c)
  if (tool === 'Bash') {
    const command = typeof (input as { command?: unknown })?.command === 'string' ? (input as { command: string }).command : ''
    // The directory the line has moved to with `cd`/`pushd`: undefined is the session's, null is unknown.
    let cwd: string | null | undefined
    for (const seg of segments(command)) {
      const bare = unquote(seg)
      const w = words(seg)
      if (w[0] === 'cd' || w[0] === 'pushd') cwd = cdTo(cwd, w[1])
      else if (w[0] === 'popd') cwd = null
      // `npm publish --dry-run`, `kubectl apply --dry-run=client`: nothing leaves the machine (`--dry-run=none` does).
      if (/\s--dry-run(?:=(?!none\b|false\b)\S+)?(?=\s|$)/.test(bare)) continue
      for (const rule of BASH_RULES) if (on(rule.category) && rule.pattern.test(bare)) return { category: rule.category, what: rule.what }
      // A SQL client's quoted arguments are SQL: read them unquoted. Elsewhere quoted text is prose.
      if (on('data') && (SQL_CLIENT.test(bare) ? w.some(destructiveSql) || destructiveSql(seg) : destructiveSql(bare))) return { category: 'data', what: 'destructive SQL' }
      for (const r of config.extraCommands) if (r.test(seg)) return { category: 'custom', what: `matches ${r.source}` }
      if (on('push-main')) {
        const push = pushTargets(seg)
        if (push && 'all' in push) return { category: 'push-main', what: 'push every branch' }
        if (push) {
          const named = push.refs.find(ref => isProtected(ref, config.protectedBranches))
          if (named) return { category: 'push-main', what: `push to ${named}` }
          if (push.current) {
            const dir = push.dir === null || cwd === null ? null
              : push.dir?.startsWith('/') ? push.dir
              : [cwd, push.dir].filter(Boolean).join('/') || undefined
            if (dir === null) return { category: 'push-main', what: 'push from a directory human-gate could not resolve' }
            const branch = await currentBranch(dir)
            if (branch === undefined) return { category: 'push-main', what: 'push from a branch git could not name' }
            if (isProtected(branch, config.protectedBranches)) return { category: 'push-main', what: `push to ${branch}` }
          }
        }
      }
    }
    return undefined
  }
  const mcp = mcpGate(tool, on)
  if (mcp) return mcp
  if (on('data') && /^mcp__/.test(tool) && strings_in(input).some(destructiveSql)) return { category: 'data', what: 'destructive SQL' }
  for (const r of config.extraTools) if (r.test(tool)) return { category: 'custom', what: `matches ${r.source}` }
  return undefined
}

/** Tools whose read-only word the fast lane never takes: they reach the network or delegate. */
const NEVER_FAST = /^(?:WebFetch|WebSearch|Agent|Task|SendMessage|Skill)$/

export function fastLaneAllows(tool: string, isReadOnly: boolean, trustMcp: boolean): boolean {
  if (!isReadOnly || NEVER_FAST.test(tool)) return false
  if (tool.startsWith('mcp__')) return trustMcp
  return true
}

/** A list option: string[] or comma-separated string. */
export function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').map(s => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

export function regexes(value: unknown, bad: string[] = []): RegExp[] {
  const out: RegExp[] = []
  for (const source of strings(value)) {
    try { out.push(new RegExp(source, 'i')) } catch { bad.push(source) }
  }
  return out
}

export function configFrom(options: Record<string, unknown>): Config {
  const bad: string[] = []
  const asked = strings(options.categories).map(c => c.toLowerCase())
  const known = CATEGORIES.filter(c => asked.includes(c))
  // A typo must never switch the gate off: with no known name, every category is held.
  const categories = new Set<Category>(known.length === 0 ? CATEGORIES : known)
  return {
    categories,
    unknownCategories: asked.filter(c => !(CATEGORIES as readonly string[]).includes(c)),
    extraCommands: regexes(options.extraCommands, bad),
    extraTools: regexes(options.extraTools, bad),
    badPatterns: bad,
    protectedBranches: strings(options.protectedBranches),
  }
}
