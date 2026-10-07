// Risk table from SPEC 4.3. Precision beats recall: every rule here has
// look-alike tests proving what it must ignore.
import { splitCommand, commandTokens, baseName, normalize } from './shell'

export type RiskKind = 'git' | 'rm' | 'sql' | 'infra' | 'remote-exec' | 'disk' | 'publish'

export interface RiskHit {
  id: string
  reason: string
  kind: RiskKind
  snapshot: boolean
}

export interface ClassifyOptions {
  strict?: boolean
}

const RM_SAFE_ROOTS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  'target',
  '__pycache__',
  '.cache',
]

// Is one rm target safe (a build artifact dir, or inside /tmp)?
function rmTargetSafe(raw: string): boolean {
  let t = raw
  if (t === '') return true
  while (t.length > 1 && t.endsWith('/')) t = t.slice(0, -1)
  if (t === '~' || t === '.' || t === '..' || t === '*' || t === '$HOME' || t === '${HOME}') return false
  if (t.startsWith('$')) return false
  if (t.startsWith('~/')) t = t.slice(2)
  while (t.startsWith('./') || t.startsWith('../')) t = t.slice(t.indexOf('/', 1) + 1)
  if (t === '/' || t === '') return false
  // Resolve path to handle /tmp/../etc traversal
  t = resolvePath(t)
  if (t.startsWith('/tmp/')) return true
  if (t.startsWith('/')) return false
  const first = t.split('/')[0] ?? ''
  return RM_SAFE_ROOTS.indexOf(first) !== -1
}

function resolvePath(path: string): string {
  if (!path.startsWith('/')) return path
  const parts = path.split('/').filter((p) => p !== '' && p !== '.')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') {
      if (resolved.length > 0) resolved.pop()
    } else {
      resolved.push(part)
    }
  }
  return '/' + resolved.join('/')
}

function hit(id: string, reason: string, kind: RiskKind, snapshot: boolean): RiskHit {
  return { id, reason, kind, snapshot }
}

// Git subcommand: skip global flags (-C path, -c conf, ...) and return
// [subcommand, args...].
function gitParts(words: string[]): string[] {
  const valueFlags = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']
  let i = 1
  while (i < words.length) {
    const w = words[i] ?? ''
    if (w === '--') break
    if (valueFlags.indexOf(w) !== -1) {
      i += 2
      continue
    }
    if (w.startsWith('-')) {
      i++
      continue
    }
    break
  }
  return words.slice(i)
}

// Does a refspec name a protected branch (main or master)?
function isProtectedRef(ref: string): boolean {
  let r = ref
  if (r.startsWith('+')) r = r.slice(1)
  if (r.startsWith('refs/heads/')) r = r.slice(11)
  const colon = r.indexOf(':')
  if (colon !== -1) r = r.slice(colon + 1)
  return r === 'main' || r === 'master'
}

// Global flags that take a value before the verb, so the verb is not read as
// a flag's value: kubectl -n prod delete ..., terraform -chdir dir destroy,
// docker -H host system prune. Both the separate-value and the =value forms.
const VERB_VALUE_FLAGS: Record<string, readonly string[]> = {
  docker: ['-H', '--host', '-c', '--context', '--config'],
  kubectl: ['-n', '--namespace', '--context', '-c', '--cluster', '--container', '--kubeconfig'],
  terraform: ['-chdir'],
  tofu: ['-chdir'],
}

// The args from the verb on: skip global flags (and the value each known
// value flag carries) and stop at the first word that is not a flag.
function argsFromVerb(head: string, args: string[]): string[] {
  const valueFlags = VERB_VALUE_FLAGS[head]
  let i = 0
  while (i < args.length) {
    const a = args[i] ?? ''
    if (a.startsWith('-') && a.length > 1) {
      i += valueFlags !== undefined && !a.includes('=') && valueFlags.indexOf(a) !== -1 ? 2 : 1
      continue
    }
    break
  }
  return args.slice(i)
}

const SQL_CARRIERS = ['psql', 'mysql', 'sqlite3']

const SQL_PATTERNS: { id: string; re: RegExp; reason: string }[] = [
  { id: 'sql-drop', re: /\bdrop\s+(database|schema|table)\b/i, reason: 'drops a database object' },
  { id: 'sql-truncate', re: /\btruncate\s+(table\s+)?[A-Za-z_"'`.[\]]/i, reason: 'empties a table' },
]

// Check SQL statements inside a carrier command. delete from without where
// needs statement-level inspection.
function sqlCheck(text: string): RiskHit | null {
  for (const p of SQL_PATTERNS) {
    if (p.re.test(text)) return hit(p.id, p.reason, 'sql', false)
  }
  const re = /\bdelete\s+from\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const rest = text.slice(m.index + m[0].length)
    const stmt = rest.split(';')[0] ?? ''
    if (!/\bwhere\b/i.test(stmt)) {
      return hit('sql-delete-all', 'deletes every row of a table', 'sql', false)
    }
  }
  return null
}

function checkSimple(simple: string, strict: boolean): RiskHit | null {
  const words = commandTokens(simple)
  if (words.length === 0) return null
  const head = baseName(words[0] ?? '')
  const args = words.slice(1)

  if (head === 'rm') {
    let recursive = false
    let afterDashDash = false
    const targets: string[] = []
    for (const a of args) {
      if (a === '--') {
        afterDashDash = true
        continue
      }
      if (!afterDashDash && a.startsWith('-') && a.length > 1) {
        if (a === '--recursive') recursive = true
        else if (a.startsWith('--')) {
          // other long flags take no interest here
        } else {
          for (const ch of a.slice(1)) {
            if (ch === 'r' || ch === 'R') recursive = true
          }
        }
        continue
      }
      targets.push(a)
    }
    const real = targets.filter((t) => t !== '' && t !== '&')
    if (recursive && real.length > 0) {
      for (const t of real) {
        if (!rmTargetSafe(t)) {
          return hit('rm-recursive', `recursively deletes ${t}`, 'rm', true)
        }
      }
    }
    return null
  }

  if (head === 'git') {
    const sub = gitParts(words)
    const cmd = sub[0] ?? ''
    const rest = sub.slice(1)
    if (cmd === 'reset') {
      if (rest.indexOf('--hard') !== -1) {
        return hit('git-reset-hard', 'discards uncommitted changes', 'git', true)
      }
      return null
    }
    if (cmd === 'clean') {
      const hasF = rest.some((a) => a === '-f' || a === '--force' || /^-[a-zA-Z]*f/.test(a))
      const dryRun = rest.some((a) => a === '-n' || a === '--dry-run' || /^-[a-zA-Z]*n/.test(a))
      if (hasF && !dryRun) {
        return hit('git-clean', 'deletes untracked files', 'git', true)
      }
      return null
    }
    if (cmd === 'checkout' || cmd === 'restore') {
      const paths = rest.filter((a) => a !== '--' && !a.startsWith('-'))
      if (paths.indexOf('.') !== -1) {
        const id = cmd === 'checkout' ? 'git-checkout-discard' : 'git-restore-discard'
        return hit(id, 'discards changes in the whole tree', 'git', true)
      }
      return null
    }
    if (cmd === 'push') {
      const flags = rest.filter((a) => a.startsWith('-'))
      const refs = rest.filter((a) => !a.startsWith('-'))
      const force = flags.some((f) => f === '-f' || f === '--force')
      if (force) {
        return hit('git-push-force', 'overwrites remote history', 'git', false)
      }
      if (refs.some((r) => r.startsWith('+'))) {
        return hit('git-push-force', 'force pushes a refspec', 'git', false)
      }
      if (strict) {
        const hasLease = flags.some((f) => f === '--force-with-lease' || f.startsWith('--force-with-lease='))
        if (hasLease) {
          return hit('git-push-force-with-lease', 'force pushes with lease', 'git', false)
        }
        if (refs.length >= 2 && refs.slice(1).some(isProtectedRef)) {
          return hit('git-push-protected', 'pushes to main or master', 'git', false)
        }
      }
      return null
    }
    if (cmd === 'branch') {
      const forceDelete =
        rest.some((a) => /^-[a-zA-Z]*D/.test(a)) ||
        (rest.indexOf('--delete') !== -1 && rest.indexOf('--force') !== -1)
      if (forceDelete) {
        return hit('git-branch-force-delete', 'force deletes a branch', 'git', false)
      }
      return null
    }
    if (cmd === 'stash' && (rest[0] === 'drop' || rest[0] === 'clear')) {
      return hit('git-stash-drop', 'deletes stashed work', 'git', true)
    }
    if (cmd === 'filter-branch' || cmd === 'filter-repo') {
      return hit('git-history-rewrite', 'rewrites git history', 'git', false)
    }
    return null
  }

  // SQL inside carriers and heredocs. An echo or comment is never a carrier,
  // so words inside them never reach these patterns.
  if (SQL_CARRIERS.indexOf(head) !== -1) {
    const h = sqlCheck(simple)
    if (h !== null) return h
  } else if (/<<-?\s*['"]?[A-Za-z0-9_]/.test(simple) && new RegExp('\\b(' + SQL_CARRIERS.join('|') + ')\\b').test(simple)) {
    // Heredoc feeding a SQL tool that is not the head word (docker exec and
    // friends). The body stays attached to this command, so scan it all.
    const h = sqlCheck(simple)
    if (h !== null) return h
  }

  if (head === 'docker') {
    const sub = argsFromVerb(head, args)
    const s0 = sub[0] ?? ''
    const s1 = sub[1] ?? ''
    if (s0 === 'system' && s1 === 'prune') {
      return hit('docker-prune', 'prunes docker objects', 'infra', false)
    }
    if (s0 === 'volume' && (s1 === 'rm' || s1 === 'prune')) {
      return hit('docker-volume-rm', 'deletes docker volumes', 'infra', false)
    }
    if ((s0 === 'image' || s0 === 'container' || s0 === 'builder' || s0 === 'network') && s1 === 'prune') {
      return hit('docker-prune', 'prunes docker objects', 'infra', false)
    }
    return null
  }

  if (head === 'kubectl') {
    if (argsFromVerb(head, args)[0] === 'delete') {
      return hit('kubectl-delete', 'deletes a cluster object', 'infra', false)
    }
    return null
  }

  if (head === 'terraform' || head === 'tofu') {
    if (argsFromVerb(head, args)[0] === 'destroy') {
      return hit('terraform-destroy', 'destroys infrastructure', 'infra', false)
    }
    return null
  }

  if (head === 'chmod') {
    const hasRecursive = args.some((a) => a === '-R' || a === '--recursive' || /^-[a-zA-Z]*R/.test(a))
    const has777 = args.some((a) => a === '777' || a === '0777')
    if (hasRecursive && has777) {
      return hit('chmod-777-recursive', 'opens everything to all users', 'disk', false)
    }
    if (hasRecursive) {
      for (const a of args) {
        if (a === '777' || a === '0777' || a === '-R' || a === '--recursive' || /^-[a-zA-Z]*R$/.test(a)) continue
        if (isWorldWritableSymbolic(a)) {
          return hit('chmod-777-recursive', 'opens everything to all users', 'disk', false)
        }
      }
    }
    return null
  }

function isWorldWritableSymbolic(mode: string): boolean {
  const perms = mode.split(',')
  for (const p of perms) {
    if (/^[augo]*\+.*w/.test(p)) {
      const who = p.match(/^([augo]*)/)?.[1] ?? 'a'
      if (who === '' || who.includes('a') || who.includes('o')) {
        return true
      }
    }
  }
  return false
}

  if (head.startsWith('mkfs')) {
    return hit('mkfs', 'formats a filesystem', 'disk', false)
  }

  if (head === 'dd') {
    const of = args.find((a) => a.startsWith('of='))
    if (of !== undefined) {
      const dev = of.slice(3).replace(/^"|"$/g, '')
      const harmless = /^\/dev\/(null|zero|random|urandom|full|stdout|stderr|tty|pts\/)/
      if (dev.startsWith('/dev/') && !harmless.test(dev)) {
        return hit('dd-device', `writes to ${dev}`, 'disk', false)
      }
    }
    return null
  }

  // Redirect straight onto a disk device.
  if (/>{1,2}\s*("?'?\/dev\/(sd|nvme|vd|hd|mmcblk|mapper|loop|md))/.test(simple)) {
    return hit('device-redirect', 'writes to a disk device', 'disk', false)
  }

  if (strict) {
    if (head === 'npm' || head === 'pnpm' || head === 'yarn' || head === 'bun') {
      if (args[0] === 'publish') {
        return hit('npm-publish', 'publishes a package', 'publish', false)
      }
      return null
    }
    if (head === 'gh' && args[0] === 'release' && args[1] === 'create') {
      return hit('gh-release', 'creates a release', 'publish', false)
    }
    if (head === 'vercel') {
      if (args.some((a) => a === '--prod' || a === '--production')) {
        return hit('deploy-prod', 'deploys to production', 'publish', false)
      }
      return null
    }
    if (head === 'firebase' && args.filter((a) => !a.startsWith('-'))[0] === 'deploy') {
      return hit('deploy-prod', 'deploys to production', 'publish', false)
    }
  }

  return null
}

// Split on top-level | only, respecting quotes, so pipe segments stay whole.
function splitTopPipes(cmd: string): string[] {
  const segs: string[] = []
  let cur = ''
  let i = 0
  const n = cmd.length
  while (i < n) {
    const c = cmd[i]
    if (c === "'") {
      const j = cmd.indexOf("'", i + 1)
      const end = j === -1 ? n : j
      cur += cmd.slice(i, end + 1)
      i = end + 1
      continue
    }
    if (c === '"') {
      i++
      while (i < n && cmd[i] !== '"') {
        if (cmd[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '\\') {
      cur += cmd.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '|') {
      segs.push(cur)
      cur = ''
      i++
      if (cmd[i] === '|') i++
      continue
    }
    cur += c
    i++
  }
  segs.push(cur)
  return segs
}

// A pipeline ending in a shell executes anything piped into it. splitCommand
// loses that grouping, so pipe-to-shell is checked on pipe segments.
function pipeToShell(cmd: string): RiskHit | null {
  const segs = splitTopPipes(cmd)
  if (segs.length < 2) return null
  const downloaders = ['curl', 'wget', 'fetch', 'http', 'https', 'aria2c']
  for (let i = 0; i < segs.length - 1; i++) {
    const head = commandTokens(segs[i] ?? '')
    const b = head.length > 0 ? baseName(head[0] ?? '') : ''
    if (!downloaders.includes(b)) continue
    for (let j = i + 1; j < segs.length; j++) {
      const down = commandTokens(segs[j] ?? '')
      if (down.length === 0) continue
      const db = baseName(down[0] ?? '')
      if (db === 'sh' || db === 'bash' || db === 'zsh' || db === 'dash' || db === 'ksh') {
        return hit('pipe-to-shell', 'pipes a download into a shell', 'remote-exec', false)
      }
    }
  }
  return null
}

// Extract raw text inside $( ) and ` ` command substitutions, without
// splitting on pipes. This allows pipe-to-shell detection inside substitutions.
function extractCommandSubs(cmd: string): string[] {
  const subs: string[] = []
  let i = 0
  const n = cmd.length
  while (i < n) {
    const c = cmd[i]
    if (c === '$' && cmd[i + 1] === '(') {
      let depth = 1
      let j = i + 2
      while (j < n && depth > 0) {
        if (cmd[j] === '(') depth++
        else if (cmd[j] === ')') depth--
        else if (cmd[j] === "'") {
          const k = cmd.indexOf("'", j + 1)
          if (k === -1) break
          j = k
        } else if (cmd[j] === '"') {
          j++
          while (j < n && cmd[j] !== '"') {
            if (cmd[j] === '\\') j++
            j++
          }
        }
        j++
      }
      if (depth === 0) {
        subs.push(cmd.slice(i + 2, j - 1))
        i = j
        continue
      }
    }
    if (c === '`') {
      let j = i + 1
      while (j < n) {
        if (cmd[j] === '`') break
        if (cmd[j] === '\\') j += 2
        else j++
      }
      if (j < n) {
        subs.push(cmd.slice(i + 1, j))
        i = j + 1
        continue
      }
    }
    i++
  }
  return subs
}

// Fork bomb: name(){ name|name& };name in any spacing. Checked on the whole
// command because its parens and pipes shred it into harmless fragments.
const FORK_BOMB = /([a-zA-Z_][a-zA-Z0-9_]*|:)\s*\(\)\s*\{\s*\1\s*\|\s*\1\s*&?\s*;?\s*\}\s*;\s*\1/

/**
 * Classify a shell command against the SPEC 4.3 risk table. Returns the first
 * hit among the simple commands, or null when everything is safe. strict adds
 * the strict-only entries (protected push, force-with-lease, publish, deploy).
 */
export function classifyCommand(cmd: string, opts?: ClassifyOptions): RiskHit | null {
  const strict = opts?.strict === true
  for (const simple of splitCommand(cmd)) {
    const h = checkSimple(simple, strict)
    if (h !== null) return h
    const pipeHit = pipeToShell(simple)
    if (pipeHit !== null) return pipeHit
  }
  // Check pipe-to-shell inside command substitutions $( ) and ` `
  for (const sub of extractCommandSubs(cmd)) {
    const pipeHit = pipeToShell(sub)
    if (pipeHit !== null) return pipeHit
  }
  if (FORK_BOMB.test(normalize(cmd))) {
    return hit('fork-bomb', 'exponential process bomb', 'infra', false)
  }
  return pipeToShell(cmd)
}
