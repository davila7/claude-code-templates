// Secret detection from SPEC 4.4: paths, bash reads, env dumps and redaction.
// Plain TypeScript, no imports.
import { splitCommand, commandTokens, baseName } from './shell'

const SAMPLE_WORDS = ['example', 'sample', 'template', 'dist']

function lowerBasename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return (i === -1 ? norm : norm.slice(i + 1)).toLowerCase()
}

function lowerPath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

// The brief's sample/template exceptions: .env.example and friends.
function isSampleName(base: string): boolean {
  let parts = base.split('.')
  if (parts.length > 0 && parts[0] === '') parts = parts.slice(1)
  for (const p of parts) {
    if (SAMPLE_WORDS.indexOf(p ?? '') !== -1) return true
  }
  return false
}

/**
 * True when the path names a secret file per SPEC 4.4. Matches by basename
 * and by known parent folders (.aws/credentials, .docker/config.json,
 * .kube/config). Case-insensitive: the OS may be. Paths in allow are spared
 * (exact or basename match).
 */
export function isSecretPath(path: string, allow?: string[]): boolean {
  const p = lowerPath(path)
  const base = lowerBasename(path)
  if (allow !== undefined) {
    for (const a of allow) {
      const al = lowerPath(a)
      if (p === al || base === al) return false
    }
  }
  if (base.endsWith('.pub')) return false
  if (isSampleName(base)) return false
  if (base === '.env' || base.startsWith('.env.')) return true
  if (base.endsWith('.pem')) return true
  if (base.endsWith('.key')) return true
  if (base.endsWith('.p12') || base.endsWith('.pfx')) return true
  if (base.endsWith('.jks') || base.endsWith('.keystore')) return true
  if (base === '.npmrc' || base === '.pypirc' || base === '.netrc' || base === '.git-credentials') return true
  if (base.startsWith('id_rsa') || base.startsWith('id_ed25519') || base.startsWith('id_ecdsa') || base.startsWith('id_dsa')) {
    return true
  }
  if (p.endsWith('.aws/credentials') || p.endsWith('.aws/credentials.bak') || p.endsWith('.aws/credentials.backup') || p.endsWith('.aws/credentials.old') ||
      p.endsWith('.docker/config.json') || p.endsWith('.docker/config.json.bak') || p.endsWith('.docker/config.json.backup') || p.endsWith('.docker/config.json.old') ||
      p.endsWith('.kube/config') || p.endsWith('.kube/config.bak') || p.endsWith('.kube/config.backup') || p.endsWith('.kube/config.old')) {
    return true
  }
  if (base.indexOf('credentials') !== -1 && base.endsWith('.json')) return true
  if (base.indexOf('secret') !== -1 && (base.endsWith('.json') || base.endsWith('.yml') || base.endsWith('.yaml'))) {
    return true
  }
  return false
}

const READERS = [
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'bat',
  'grep',
  'rg',
  'awk',
  'sed',
  'cut',
  'base64',
  'xxd',
  'od',
  'strings',
  'jq',
  'zcat',
  'gzcat',
  'xzcat',
  'gunzip',
  'zstdcat',
  'openssl',
]

// Script runners, handled by their own branch: the value of a config flag is a
// file the process loads itself, and the script can name a secret too.
const RUNNERS = new Set(['node', 'python', 'python3', 'perl', 'ruby'])

const INLINE_FLAGS: Record<string, string[]> = {
  node: ['-e', '-p'],
  python: ['-c'],
  python3: ['-c'],
  perl: ['-e'],
  ruby: ['-e'],
}

// True when the argument carries an inline script for this runner.
function hasInlineFlag(head: string, arg: string): boolean {
  const flags = INLINE_FLAGS[head]
  if (flags === undefined) return false
  return flags.indexOf(arg) !== -1
}

// A path token inside inline code that names a secret file.
function secretPathInCode(code: string): string | null {
  for (const token of code.split(/[\s'"`()[\]{};,=<>!&|]+/)) {
    if (token !== '' && isSecretPath(token)) return token
  }
  return null
}

// Does stdout of this simple command go to the model? False when stdout is
// redirected to a file (2> alone still prints stdout).
function stdoutRedirected(words: string[]): boolean {
  for (const w of words) {
    if (w === '>' || w === '>>' || w === '1>' || w === '1>>' || w === '&>' || w === '&>>') return true
  }
  return false
}

/**
 * The secret path a bash command would print (cat, head, tail, less, more,
 * bat, grep, rg, awk, sed, cut, base64, xxd, od, strings, cp/scp to stdout),
 * across compound commands. source is not a read. null otherwise.
 */
export function bashReadsSecret(cmd: string): string | null {
  for (const simple of splitCommand(cmd)) {
    const words = commandTokens(simple)
    if (words.length === 0) continue
    const head = baseName(words[0] ?? '')
    const args = words.slice(1)
    if (head === 'cp' || head === 'scp') {
      const dest = args[args.length - 1]
      if (dest === '/dev/stdout' || dest === '-' || dest === '/dev/fd/1' || dest === '/proc/self/fd/1') {
        for (const a of args.slice(0, -1)) {
          if (isSecretPath(a) === true) return a
        }
      }
      continue
    }
    const isRunner = RUNNERS.has(head)
    if (isRunner === false && READERS.indexOf(head) === -1) continue
    if (stdoutRedirected(words)) continue
    if (head === 'sed' && args.some((a) => a === '-i' || a === '--in-place' || a.startsWith('-i'))) continue
    for (let i = 0; i < args.length; i++) {
      const a = args[i] ?? ''
      if (a === '2>' || a === '2>>') {
        i++
        continue
      }
      if (a === '<' || a === '<<') continue
      if (a === '>' || a === '>>' || a === '1>' || a === '1>>' || a === '&>') break
      // --env-file .env names the file the process loads, not a read.
      if (a === '--env-file') {
        i++
        continue
      }
      if (a.startsWith('--env-file=')) continue
      if (isRunner && hasInlineFlag(head, a)) {
        const code = args[i + 1]
        i++
        if (code !== undefined) {
          const hit = secretPathInCode(code)
          if (hit !== null) return hit
        }
        continue
      }
      if (isSecretPath(a) === true) return a
    }
  }
  return null
}

/**
 * True for bare env, printenv, set (the bash dump), export -p and bare
 * export. env FOO=1 cmd and printenv HOME are not dumps.
 */
export function isEnvDump(cmd: string): boolean {
  for (const simple of splitCommand(cmd)) {
    const words = commandTokens(simple)
    if (words.length === 0) continue
    const head = baseName(words[0] ?? '')
    const args = words.slice(1)
    if (head === 'env') {
      if (args.length === 0) return true
      let k = 0
      while (k < args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[k] ?? '')) k++
      if (k === args.length) return true
    }
    if (head === 'printenv' && args.length === 0) return true
    if (head === 'set' && args.length === 0) return true
    if (head === 'export' && (args.length === 0 || args[0] === '-p')) return true
  }
  return false
}

// Shannon entropy in bits per character.
function entropy(s: string): number {
  if (s.length === 0) return 0
  const freq = new Map<string, number>()
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  let h = 0
  for (const count of freq.values()) {
    const p = count / s.length
    h -= p * Math.log2(p)
  }
  return h
}

// Character classes present: lower, upper, digit, other.
function classCount(s: string): number {
  let lower = false
  let upper = false
  let digit = false
  let other = false
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z') lower = true
    else if (ch >= 'A' && ch <= 'Z') upper = true
    else if (ch >= '0' && ch <= '9') digit = true
    else other = true
  }
  return (lower ? 1 : 0) + (upper ? 1 : 0) + (digit ? 1 : 0) + (other ? 1 : 0)
}

const PLACEHOLDER = /^(x+|X+|\*+|<[^>]*>|\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|changeme.*|change-me.*|todo.*|placeholder.*)$/i

// Prefix-anchored token patterns, all linear scans.
const TOKEN_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'anthropic', re: /(?<![A-Za-z0-9_-])sk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'openai', re: /(?<![A-Za-z0-9_-])sk-proj-[A-Za-z0-9_-]{20,}/g },
  { kind: 'openai', re: /(?<![A-Za-z0-9_-])sk-(?!ant-|proj-)[A-Za-z0-9]{32,}/g },
  { kind: 'github', re: /(?<![A-Za-z0-9_])gh[pous]_[A-Za-z0-9]{36,}/g },
  { kind: 'github', re: /(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{60,}/g },
  { kind: 'gitlab', re: /(?<![A-Za-z0-9_-])glpat-[A-Za-z0-9_-]{20,}/g },
  { kind: 'slack', re: /(?<![A-Za-z0-9_-])xox[abposr]-[A-Za-z0-9-]{10,}/g },
  { kind: 'aws', re: /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])/g },
  { kind: 'google', re: /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}/g },
  { kind: 'stripe', re: /(?<![A-Za-z0-9_-])(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { kind: 'npm', re: /(?<![A-Za-z0-9_-])npm_[A-Za-z0-9]{30,}/g },
  { kind: 'huggingface', re: /(?<![A-Za-z0-9_-])hf_[A-Za-z0-9]{30,}/g },
]

const PRIVATE_BEGIN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g
const PRIVATE_END = '-----END '
const REDACTED_KEY = '[redacted:private-key]'

// BEGIN-to-END pairing via one scan for each marker plus a binary search per
// BEGIN: strictly linear, safe on adversarial input.
function redactPrivateKeys(text: string, bump: (kind: string) => void): string {
  PRIVATE_BEGIN.lastIndex = 0
  const begins: { start: number; after: number }[] = []
  let m: RegExpExecArray | null
  while ((m = PRIVATE_BEGIN.exec(text)) !== null) {
    begins.push({ start: m.index, after: m.index + m[0].length })
  }
  if (begins.length === 0) return text
  const ends: number[] = []
  let e = text.indexOf(PRIVATE_END)
  while (e !== -1) {
    const nl = text.indexOf('\n', e + PRIVATE_END.length)
    const stop = nl === -1 ? text.length : nl
    if (text.slice(e, stop).indexOf('PRIVATE KEY-----') !== -1) ends.push(stop)
    e = text.indexOf(PRIVATE_END, e + PRIVATE_END.length)
  }
  let out = ''
  let copied = 0
  for (const b of begins) {
    if (b.start < copied) continue
    let lo = 0
    let hi = ends.length - 1
    let pick = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const v = ends[mid] ?? -1
      if (v > b.after) {
        pick = v
        hi = mid - 1
      } else {
        lo = mid + 1
      }
    }
    if (pick === -1) continue
    out += text.slice(copied, b.start) + REDACTED_KEY
    copied = pick
    bump('private-key')
  }
  out += text.slice(copied)
  return out
}

const ASSIGNMENT = /([A-Za-z0-9_-]*(?:password|secret|token|api[_-]key))['"]?\s*[=:]\s*["']?([^\s"']{20,})/gi

export interface RedactionResult {
  text: string
  hits: { kind: string; count: number }[]
}

/**
 * Replace high-precision secret patterns with [redacted:<kind>]. Generic
 * password=/secret=/token=/api_key= values count only when at least 20
 * characters, high entropy, 3 of 4 character classes and not a placeholder.
 * All scans are linear, no nested quantifiers: safe on 1 MB of text.
 */
export function redactSecrets(text: string): RedactionResult {
  const counts = new Map<string, number>()
  const bump = (kind: string) => counts.set(kind, (counts.get(kind) ?? 0) + 1)
  let out = redactPrivateKeys(text, bump)

  for (const p of TOKEN_PATTERNS) {
    const found = out.match(p.re)
    if (found !== null) {
      for (let i = 0; i < found.length; i++) bump(p.kind)
      out = out.replace(p.re, '[redacted:' + p.kind + ']')
    }
    p.re.lastIndex = 0
  }

  out = out.replace(ASSIGNMENT, (full: string, key: string, value: string) => {
    if (PLACEHOLDER.test(value)) return full
    if (value.length < 20) return full
    if (entropy(value) < 3.5) return full
    if (classCount(value) < 3) return full
    bump('assignment')
    return key + '=[redacted:assignment]'
  })

  const hits: { kind: string; count: number }[] = []
  for (const [kind, count] of counts) hits.push({ kind, count })
  hits.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0))
  return { text: out, hits }
}
