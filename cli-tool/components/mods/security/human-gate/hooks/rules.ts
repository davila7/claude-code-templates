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

const DESTRUCTIVE_SQL = /\b(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE|SCHEMA|ROLE|USER)\b|\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)|\bUPDATE\s+[\w."]+\s+SET\b(?![^;]*\bWHERE\b)/i
/** SQL clients: their quoted arguments are SQL, so destructive SQL is looked for inside the quotes too. */
const SQL_CLIENT = /\b(?:psql|mysql|mariadb|sqlite3|sqlcmd|cockroach|duckdb|clickhouse(?:-client)?|snowsql|bq\s+query|turso\s+db\s+shell|neonctl)\b/

/** Blanks out the text inside quotes, so `git commit -m "explain npm publish"` is not read as a publish. */
export function unquote(segment: string): string {
  return segment.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, m => ' '.repeat(m.length))
}

/** Splits a shell line on `&&`, `||`, `;`, `|` and newlines, so `cd x && npm publish` is caught. */
export function segments(command: string): string[] {
  return command.split(/&&|\|\||;|\||\n/).map(s => s.trim()).filter(Boolean)
}

const PUSH = re(String.raw`\bgit${F}\s+push\b(.*)$`)
const PROTECTED = /^(?:main|master|production|prod|release)$/

export function isProtected(branch: string, protectedBranches: readonly string[]): boolean {
  return protectedBranches.length > 0 ? protectedBranches.includes(branch) : PROTECTED.test(branch)
}

/**
 * What a `git push` segment pushes: every branch (`--all`, `--mirror`), the
 * refs it names (`HEAD` and `@` read as the current branch), or only the
 * current branch when it names none. Undefined when the segment is no push.
 */
export function pushTargets(segment: string): { all: true } | { refs: string[]; current: boolean } | undefined {
  const m = PUSH.exec(segment)
  if (!m) return undefined
  const words = m[1].split(/\s+/).filter(Boolean)
  if (words.some(w => w === '--all' || w === '--mirror' || w === '--branches')) return { all: true }
  const positional = words.filter(w => !w.startsWith('-'))
  const refs: string[] = []
  let current = positional.length <= 1 // `git push` or `git push origin`
  for (const ref of positional.slice(1)) {
    const target = (ref.includes(':') ? ref.split(':').pop() ?? '' : ref).replace(/^\+/, '').replace(/^refs\/heads\//, '')
    if (target === 'HEAD' || target === '@' || target === '') current = true
    else refs.push(target)
  }
  return { refs, current }
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

function mcpGate(tool: string, on: (c: Category) => boolean): Gate | undefined {
  const p = mcpParts(tool)
  if (!p) return undefined
  const isRead = READ_VERB.test(p.name)
  if (on('money') && !isRead && /stripe/i.test(p.server)) return { category: 'money', what: 'a Stripe action that changes money or customers' }
  if (on('money') && !isRead && /(?:^|_)(?:refund|payout|charge|transfer|payment_intent|capture|invoice_(?:send|pay|finalize))/i.test(p.name)) return { category: 'money', what: 'move money' }
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
 * The gate a call falls under, or undefined. `currentBranch` answers a push
 * of the current branch; it is only called when one is found, and an
 * unknown branch holds the push (fail closed).
 */
export async function gateFor(
  tool: string,
  input: unknown,
  config: Config,
  currentBranch: () => Promise<string | undefined>,
): Promise<Gate | undefined> {
  const on = (c: Category) => config.categories.has(c)
  if (tool === 'Bash') {
    const command = typeof (input as { command?: unknown })?.command === 'string' ? (input as { command: string }).command : ''
    for (const seg of segments(command)) {
      const bare = unquote(seg)
      // `npm publish --dry-run`, `kubectl apply --dry-run=client`: nothing leaves the machine (`--dry-run=none` does).
      if (/\s--dry-run(?:=(?!none\b|false\b)\S+)?(?=\s|$)/.test(bare)) continue
      for (const rule of BASH_RULES) if (on(rule.category) && rule.pattern.test(bare)) return { category: rule.category, what: rule.what }
      if (on('data') && DESTRUCTIVE_SQL.test(SQL_CLIENT.test(bare) ? seg : bare)) return { category: 'data', what: 'destructive SQL' }
      for (const r of config.extraCommands) if (r.test(seg)) return { category: 'custom', what: `matches ${r.source}` }
      if (on('push-main')) {
        const push = pushTargets(bare)
        if (push && 'all' in push) return { category: 'push-main', what: 'push every branch' }
        if (push) {
          const named = push.refs.find(ref => isProtected(ref, config.protectedBranches))
          if (named) return { category: 'push-main', what: `push to ${named}` }
          if (push.current) {
            const branch = await currentBranch()
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
  if (on('data') && /^mcp__/.test(tool) && strings_in(input).some(v => DESTRUCTIVE_SQL.test(v))) return { category: 'data', what: 'destructive SQL' }
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
