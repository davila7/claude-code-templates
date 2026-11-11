/**
 * rex-tty: the parts with no engine in them. Which commands need a terminal,
 * what Rex's CLI answered, and how the pane's text becomes a tool result.
 */

/** A list option: a string[] or a comma-separated string; empty means none. */
export function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

/** Compiles regex sources; one that does not compile is returned in `bad`, never thrown. */
export function compile(sources: readonly string[]): { ok: RegExp[]; bad: string[] } {
  const ok: RegExp[] = []
  const bad: string[] = []
  for (const s of sources) {
    try {
      ok.push(new RegExp(s))
    } catch {
      bad.push(s)
    }
  }
  return { ok, bad }
}

export const SIDES = ['below', 'right', 'above', 'left'] as const
export type Side = (typeof SIDES)[number]

export function side(value: unknown): Side {
  return SIDES.find(s => s === value) ?? 'below'
}

export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

/**
 * The simple commands of a shell line, split at `;`, `&&`, `||`, `|`, `&`, a
 * newline and `(`, quotes respected, heredoc bodies left out. Good enough to
 * find each command word.
 */
export function segments(source: string): string[] {
  // a heredoc's body is data, not commands
  const command = source.replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, '<<$2')
  const out: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!
    if (quote) {
      current += c
      if (c === '\\' && quote === '"' && i + 1 < command.length) current += command[++i]
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      current += c
    } else if (c === '\\' && i + 1 < command.length) {
      current += c + command[++i]
    } else if (c === ';' || c === '\n' || c === '|' || c === '&' || c === '(' || c === ')') {
      out.push(current)
      current = ''
    } else current += c
  }
  out.push(current)
  return out.map(s => s.trim()).filter(Boolean)
}

/** The words of one simple command, without leading `VAR=value` assignments; quotes are dropped. */
export function words(segment: string): { assignments: string[]; argv: string[] } {
  const all = segment.match(/(?:[^\s"']+|"(?:\\.|[^"\\])*"|'[^']*')+/g) ?? []
  const clean = all.map(w => w.replace(/^(["'])(.*)\1$/s, '$2'))
  let i = 0
  while (i < clean.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(clean[i]!)) i++
  return { assignments: clean.slice(0, i), argv: clean.slice(i) }
}

/** True when a short flag (in a cluster like `-am`) or one of the long ones is among the arguments. */
function has(args: readonly string[], short: string, ...long: string[]): boolean {
  return args.some(a =>
    a.startsWith('--')
      ? long.some(l => a === l || a.startsWith(l + '='))
      : short !== '' && /^-[A-Za-z]+$/.test(a) && [...short].some(s => a.includes(s)),
  )
}

/** Words that run the command after them: looked through to the real command. */
const WRAPPERS = new Set(['env', 'command', 'nohup', 'time', 'exec', 'builtin', 'nice', 'caffeinate'])

/** `argv` without leading wrappers (`env A=1`, `command`, `timeout 5`) and their options. */
export function unwrap(argv: readonly string[]): string[] {
  let rest = [...argv]
  for (;;) {
    const name = (rest[0] ?? '').replace(/^.*\//, '')
    if (WRAPPERS.has(name)) {
      rest = rest.slice(1)
      while (rest.length && (rest[0]!.startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0]!))) rest = rest.slice(1)
    } else if (name === 'timeout' && rest.length > 2) {
      rest = rest.slice(1)
      while (rest.length && rest[0]!.startsWith('-')) rest = rest.slice(1)
      rest = rest.slice(1)
    } else return rest
  }
}

/** `args` without the options named in `valued` and the value each takes. */
function dropValued(args: readonly string[], valued: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (valued.includes(args[i]!)) i++
    else out.push(args[i]!)
  }
  return out
}

/** Flags that make a login take its credential from an argument, a file or the environment. */
const UNATTENDED = ['--with-token', '--token', '--api-key', '--service-principal', '--identity', '--cred-file', '--browserless', '--password-stdin', '--access-token', '--ci', '--no-browser', '--help']

const LOGINS: Record<string, readonly (readonly string[])[]> = {
  npm: [['login'], ['adduser']],
  pnpm: [['login'], ['adduser']],
  yarn: [['login'], ['npm', 'login']],
  vercel: [['login']],
  wrangler: [['login']],
  gcloud: [['auth', 'login'], ['auth', 'application-default', 'login'], ['init']],
  aws: [['sso', 'login']],
  az: [['login']],
  firebase: [['login']],
  heroku: [['login']],
  supabase: [['login']],
  fly: [['auth', 'login']],
  flyctl: [['auth', 'login']],
  op: [['signin']],
  netlify: [['login']],
  stripe: [['login']],
  doctl: [['auth', 'init']],
  railway: [['login']],
}

/** Why one simple command needs a terminal, or null. */
function reasonFor(segment: string): string | null {
  const parsed = words(segment)
  const assignments = parsed.assignments
  const argv = unwrap(parsed.argv)
  const name = (argv[0] ?? '').replace(/^.*\//, '')
  const args = name === 'git' ? dropValued(argv.slice(1), ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']) : argv.slice(1)
  const plain = args.filter(a => !a.startsWith('-'))
  switch (name) {
    case 'sudo': {
      // the options before the command sudo runs
      const flags = dropValued(args, ['-u', '-g', '-h', '-p', '-C', '-D', '-R', '-T', '-r', '-t', '-U', '--user', '--group', '--host', '--prompt', '--chdir'])
      const end = flags.findIndex(a => !a.startsWith('-'))
      const own = end === -1 ? flags : flags.slice(0, end)
      if (has(own, 'nSAKVh', '--non-interactive', '--stdin', '--askpass', '--version', '--help', '--remove-timestamp')) return null
      return 'sudo asks for a password'
    }
    case 'su':
      return 'su asks for a password'
    case 'passwd':
      return 'passwd asks for a password'
    case 'gh':
      if (plain[0] === 'auth' && (plain[1] === 'login' || plain[1] === 'refresh') && !has(args, '', '--with-token')) return 'gh auth asks questions and waits for the browser'
      return null
    case 'git': {
      if (assignments.some(a => /^GIT_(SEQUENCE_)?EDITOR=/.test(a))) return null
      const sub = plain[0]
      const rest = args.slice(args.indexOf(sub ?? '') + 1)
      if (sub === 'rebase' && has(rest, 'i', '--interactive') && !has(rest, '', '--continue', '--abort', '--skip')) return 'git rebase -i opens an editor'
      if ((sub === 'add' || sub === 'checkout' || sub === 'restore' || sub === 'reset' || sub === 'stash') && has(rest, 'p', '--patch')) return `git ${sub} -p asks hunk by hunk`
      if (sub === 'add' && has(rest, 'i', '--interactive')) return 'git add -i is interactive'
      if (sub === 'commit' && !has(rest, 'mFC', '--message', '--file', '--no-edit', '--reuse-message', '--fixup', '--dry-run', '--help')) return 'git commit without a message opens an editor'
      return null
    }
    case 'docker':
    case 'podman':
      if (plain[0] === 'login' && !has(args, 'p', '--password', '--password-stdin')) return `${name} login asks for a password`
      return null
    case 'ssh-add':
      if (has(args, 'lLdDqT', '--help') && !plain.length) return null
      return 'ssh-add asks for the key passphrase'
    case 'ssh-keygen':
      if (has(args, 'NlyFRH')) return null
      return 'ssh-keygen asks questions'
    case 'ssh-copy-id':
      return 'ssh-copy-id asks for a password'
    case 'gpg':
      if (has(args, '', '--gen-key', '--full-generate-key', '--full-gen-key', '--edit-key')) return 'gpg asks questions'
      return null
    default: {
      const form = LOGINS[name]?.find(f => f.every((w, i) => plain[i] === w))
      if (!form || has(args, '', ...UNATTENDED)) return null
      return `${name} ${form.join(' ')} is interactive`
    }
  }
}

/**
 * Why a Bash command needs a terminal the person can type in, or null when it
 * does not look like one. `skip` wins over everything, `extra` adds matches.
 */
export function needsTerminal(command: string, extra: readonly RegExp[] = [], skip: readonly RegExp[] = []): string | null {
  if (!command.trim() || skip.some(r => r.test(command))) return null
  for (const s of segments(command)) {
    const why = reasonFor(s)
    if (why) return why
  }
  return extra.some(r => r.test(command)) ? 'matches your rex-tty commands option' : null
}

const NO_TTY = [
  /a terminal is required/i,
  /no tty present/i,
  /not a tty/i,
  /not a terminal/i,
  /inappropriate ioctl for device/i,
  /can(?:no|')t open \/dev\/tty/i,
  /could not open a (?:new )?tty/i,
  /stdin is not a tty/i,
  /terminal is dumb/i,
  /cannot prompt/i,
  /could not read (?:password|username|passphrase)/i,
  /unable to read askpass response/i,
  /no askpass program/i,
  /pseudo-terminal will not be allocated/i,
]

/** True when a command's output says it failed for lack of a terminal. */
export function saysNoTerminal(text: string): boolean {
  return NO_TTY.some(r => r.test(text))
}

/** Text without control characters (escape sequences included), so it cannot redraw what shows it. */
export function printable(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
}

/** A command on one line, cut to `max` characters. */
export function shortCommand(command: string, max = 60): string {
  const one = printable(command).replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

/**
 * The command as the permission question shows it: whole, line breaks kept,
 * up to `max` characters, and how much was left out when it is longer.
 */
export function quoted(command: string, max = 1500): string {
  const text = printable(command).trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut}\n… (${text.length - max} more characters, ${text.split('\n').length} lines in all, not shown)`
}

/** The line the pane prints first, so the person sees what Claude asked to run. */
export function banner(command: string): string {
  return `rex-tty ▸ ${shortCommand(command, 200)}`
}

/**
 * The script the pane's shell runs: prints the banner dimmed, then replaces
 * itself with the same shell running the command. `$0` the shell, `$1` the
 * banner, `$2` the command: nothing of the command is interpolated here.
 */
export const PANE_SCRIPT = `printf '\\033[2m%s\\033[0m\\n\\n' "$1"; exec "$0" -c "$2"`

/** The shell that runs the command: the person's, when it takes `-c` as bash does. */
export function shellFor(shell: string | undefined): string {
  return shell && /\/(?:bash|zsh|sh|dash|ksh)$/.test(shell) ? shell : '/bin/bash'
}

/** The new block's id from `rex split --json`, or null. */
export function blockOf(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as { block_ids?: unknown }
    const first = Array.isArray(parsed.block_ids) ? parsed.block_ids[0] : undefined
    return typeof first === 'string' && first ? first : null
  } catch {
    return null
  }
}

export type Waited = { kind: 'exit'; code: number } | { kind: 'timeout' } | { kind: 'gone'; detail: string }

/** What `rex wait --for … --json BLOCK` said: the child's exit, the limit, or a pane that went away. */
export function waited(stdout: string, stderr: string): Waited {
  for (const line of stdout.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      const code = (JSON.parse(t) as { exit_code?: unknown }).exit_code
      if (typeof code === 'number') return { kind: 'exit', code }
    } catch {
      // not the payload
    }
  }
  if (/timed out/i.test(stderr)) return { kind: 'timeout' }
  return { kind: 'gone', detail: stderr.trim().split('\n')[0] ?? '' }
}

/** The pane's text without the banner, its last `max` characters. */
export function paneOutput(captured: string, bannerLine: string, max = 30_000): string {
  const lines = captured.replace(/\r/g, '').split('\n')
  // the banner may wrap in a narrow pane: --unwrap joins it back, so one line
  const at = lines.findIndex(l => l.trim() !== '')
  if (at !== -1 && lines[at]!.trim() === bannerLine.trim()) lines.splice(0, at + 1)
  const text = lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '')
  return text.length > max ? `[… ${text.length - max} earlier characters left out]\n${text.slice(-max)}` : text
}
