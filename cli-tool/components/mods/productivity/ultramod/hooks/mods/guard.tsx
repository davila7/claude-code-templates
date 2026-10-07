import { atom, read, update } from 'claude-code'
import type { Args, Frozen } from 'claude-code'
import type { UltraApi } from '../core/api'
import { fmtCountdown } from '../core/format'
import type { UltraMod } from '../core/mod'
import { needsYou } from '../core/notifier'
import { addAllowedRisk } from '../core/state'
import { settingsFor } from '../core/sets'
import { classifyCommand } from '../lib/risk'
import type { RiskHit } from '../lib/risk'

// The validator wants every atom in a const of the file that reads and writes it.
const allow = atom({ plugin: 'ultramod', key: 'allow' } as const, { risks: [], paths: [] })

// Call ids the person approved in guard's own dialog. The engine asks for the
// same call right after, and tool.check answers that ask with allow.
const approved = atom({ plugin: 'ultramod', key: 'guard-approved' } as const, [] as string[])

// Bounded: one id per approved call, oldest dropped past the limit.
const KEEP_APPROVED = 32

async function rememberApproved($: UltraApi, id: string): Promise<void> {
  await update($, approved, ids => ids.includes(id) ? ids : [...ids, id].slice(-KEEP_APPROVED))
}

const SNAPSHOT_PREFIX = 'ultramod snapshot: '
const SNAPSHOT_REF = 'refs/ultramod/snapshots/'
const KEEP_SNAPSHOTS = 20

const brief = (command: string) => command.length > 120 ? `${command.slice(0, 117)}...` : command

// Safer stand-ins the deny text can name for the common discard commands.
const TIPS: Record<string, string> = {
  'git-reset-hard': 'git stash',
  'git-checkout-discard': 'git stash',
  'git-restore-discard': 'git stash',
  'git-clean': 'git clean --dry-run',
}

const declinedText = (command: string, hit: RiskHit) =>
  `The user declined \`${brief(command)}\`. It ${hit.reason}. Ask them before running it again${TIPS[hit.id] ? `, or use a safer command such as \`${TIPS[hit.id]}\`` : ''}.`

const deniedText = (command: string, hit: RiskHit) =>
  `Not running \`${brief(command)}\`: it ${hit.reason}. This project runs Ultra Mod's marathon set, which refuses risky commands; ask the user.`

// yyyymmdd-hhmmss from epoch milliseconds in UTC, no Date object: the hooks
// environment guarantees no Node, so the conversion stays plain arithmetic.
function stamp(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86_400)
  const rest = seconds - days * 86_400
  const z = days + 719_468
  const era = Math.floor(z / 146_097)
  const doe = z - era * 146_097
  const yoe = Math.floor((doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp < 10 ? mp + 3 : mp - 9
  const year = month <= 2 ? y + 1 : y
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}${pad(month)}${pad(day)}-${pad(Math.floor(rest / 3_600))}${pad(Math.floor(rest / 60) % 60)}${pad(rest % 60)}`
}

type GitResult = { ok: boolean; out: string }

async function git($: UltraApi, cwd: string, argv: string[], env?: Record<string, string>): Promise<GitResult> {
  try {
    const result = await $.process.run(argv, env ? { cwd, env } : { cwd })
    return { ok: result.exitCode === 0, out: result.stdout.trim() }
  } catch {
    return { ok: false, out: '' }
  }
}

// Save the work tree, untracked files included, through a temporary index
// under .git. The real index and work tree are never touched. A failure is
// logged and never blocks the command it protects.
async function snapshot($: UltraApi, command: string): Promise<void> {
  const cwd = await $.session.cwd()
  const inside = await git($, cwd, ['git', 'rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.out !== 'true') return
  const fail = (why: string) => { $.ui.log(`guard snapshot skipped: ${why}`) }
  const index = await git($, cwd, ['git', 'rev-parse', '--git-path', 'ultramod-index'])
  if (!index.ok || !index.out) return fail('no index path')
  const head = await git($, cwd, ['git', 'rev-parse', '--verify', 'HEAD'])
  const parent = head.ok && head.out ? head.out : null
  const env = { GIT_INDEX_FILE: index.out }
  if (!(await git($, cwd, ['git', 'add', '-A'], env)).ok) return fail('git add -A failed')
  const tree = await git($, cwd, ['git', 'write-tree'], env)
  if (!tree.ok || !tree.out) return fail('git write-tree failed')
  const message = `${SNAPSHOT_PREFIX}${brief(command)}`
  const committed = await git($, cwd, parent
    ? ['git', 'commit-tree', tree.out, '-p', parent, '-m', message]
    : ['git', 'commit-tree', tree.out, '-m', message])
  if (!committed.ok || !committed.out) return fail('git commit-tree failed')
  const ref = `${SNAPSHOT_REF}${stamp(await $.clock.now())}`
  if (!(await git($, cwd, ['git', 'update-ref', ref, committed.out])).ok) return fail('git update-ref failed')
  const windows = await $.env.get('OS').then(value => value === 'Windows_NT', () => false)
  await git($, cwd, windows ? ['cmd', '/c', 'del', index.out] : ['rm', '-f', index.out])
  const listed = await git($, cwd, ['git', 'for-each-ref', '--sort=-committerdate', '--sort=-refname', '--format=%(refname)', SNAPSHOT_REF])
  if (listed.ok) {
    for (const old of listed.out.split('\n').map(line => line.trim()).filter(line => line.startsWith(SNAPSHOT_REF)).slice(KEEP_SNAPSHOTS)) {
      await git($, cwd, ['git', 'update-ref', '-d', old])
    }
  }
}

type Snapshot = { sha: string; at: number; command: string }

async function listSnapshots($: UltraApi): Promise<Snapshot[]> {
  const cwd = await $.session.cwd()
  const listed = await git($, cwd, ['git', 'for-each-ref', '--sort=-committerdate', '--sort=-refname', `--format=%(objectname)%09%(committerdate:unix)%09%(contents:subject)`, SNAPSHOT_REF])
  if (!listed.ok) return []
  return listed.out.split('\n').filter(Boolean).map(line => {
    const [sha = '', at = '', ...rest] = line.split('\t')
    const subject = rest.join('\t')
    return { sha, at: Number(at) * 1000, command: subject.startsWith(SNAPSHOT_PREFIX) ? subject.slice(SNAPSHOT_PREFIX.length) : subject }
  }).filter(snap => snap.sha)
}

// A risk id never carries slashes, dots or a home prefix; those mark a path,
// which the secrets mod answers after guard defers with null.
const looksLikePath = (value: string) =>
  value.includes('/') || value.includes('\\') || value.startsWith('.') || value.startsWith('~')

async function allowIds($: UltraApi): Promise<string[]> {
  return (await read($, allow)).risks
}

export const guard: UltraMod = {
  id: 'guard',
  hooks: {
    'tool.call': [{
      gating: true,
      when: e => e.tool === 'Bash' && typeof e.command === 'string',
      run: async ($, e: Frozen<Args<'tool.call'>>, next) => {
        // Narrow on the tool before reading its arguments: the envelope is a
        // union the declarations discriminate by `tool`.
        if (e.tool !== 'Bash' || typeof e.command !== 'string') return next(e)
        const command = e.command
        const settings = await settingsFor($, 'guard')
        const mode = settings.mode === 'deny' || settings.mode === 'log' ? settings.mode : 'ask'
        const hit = classifyCommand(command, { strict: settings.strict === true })
        if (!hit) return next(e)
        if (!(await allowIds($)).includes(hit.id)) {
          if (mode === 'deny') {
            // Marathon refuses unattended; the notification is the only voice it has.
            needsYou($, `guard: refused \`${brief(command)}\``)
            return { deny: deniedText(command, hit) }
          }
          if (mode === 'log') {
            $.ui.log(`guard: ${hit.reason} (${brief(command)})`)
          } else {
            const question = `Run \`${brief(command)}\`? It ${hit.reason}.${hit.snapshot ? ' A work tree snapshot is saved first, so /ultra undo can restore it.' : ''}`
            // An away user has to hear the dialog before it can wait for them.
            needsYou($, `guard: run \`${brief(command)}\`?`)
            let answer: string
            try {
              answer = await $.ui.ask(question, { header: 'Ultra Mod', options: ['Run it', 'Allow for session', 'Refuse'] })
            } catch {
              return { deny: declinedText(command, hit) }
            }
            if (answer === 'Run it') {
              // fall through to the snapshot
            } else if (answer === 'Allow for session') {
              await update($, allow, value => addAllowedRisk(value, hit.id))
            } else {
              return { deny: declinedText(command, hit) }
            }
            // Recorded before next: the engine raises tool.check inside it.
            if (e.tool_use_id !== undefined) await rememberApproved($, e.tool_use_id)
          }
        }
        if (hit.snapshot) await snapshot($, command)
        return next(e)
      },
    }],
    'tool.check': [{
      gating: true,
      run: async ($, e: Frozen<Args<'tool.check'>>, next) => {
        const verdict = await next(e)
        const id = e.tool_use_id
        if (verdict.decision !== 'ask' || id === undefined) return verdict
        const ids = await read($, approved)
        return ids.includes(id) ? { decision: 'allow' } : verdict
      },
    }],
  },
  commands: {
    allow: async ($, args) => {
      const value = args.trim()
      if (!value) {
        const risks = await allowIds($)
        return { text: risks.length ? `Allowed this session: ${risks.join(', ')}` : 'No risk ids are allowed this session. Use /ultra allow <risk id>.' }
      }
      if (looksLikePath(value)) return null
      await update($, allow, held => addAllowedRisk(held, value))
      return { text: `${value} is allowed for this session.` }
    },
    undo: async ($, args) => {
      const snapshots = await listSnapshots($)
      const value = args.trim()
      if (!value) {
        if (!snapshots.length) return { text: 'No snapshots yet. One is saved before each risky command that can be undone.' }
        const now = await $.clock.now()
        const lines = snapshots.slice(0, KEEP_SNAPSHOTS).map((snap, i) => `${i + 1}  ${fmtCountdown(now - snap.at)} ago  ${snap.command}`)
        return { text: ['Snapshots, newest first:', ...lines].join('\n') }
      }
      const index = Number(value)
      if (!Number.isInteger(index) || index < 1 || index > snapshots.length) {
        return { text: `Choose a snapshot number from /ultra undo (1 to ${snapshots.length}).` }
      }
      const snap = snapshots[index - 1]
      if (!snap) return { text: 'Choose a snapshot number from /ultra undo.' }
      let answer = 'Cancel'
      try {
        answer = await $.ui.ask(`Restore snapshot ${index} (${snap.command})? Files created after it are kept.`, { header: 'Ultra Mod', options: ['Restore', 'Cancel'] })
      } catch {
        // A dismissed question restores nothing.
      }
      if (answer !== 'Restore') return { text: `Snapshot ${index} was not restored.` }
      const cwd = await $.session.cwd()
      const root = await git($, cwd, ['git', 'rev-parse', '--show-toplevel'])
      const files = await git($, cwd, ['git', 'ls-tree', '-r', '--name-only', snap.sha])
      const target = root.ok && root.out ? root.out : cwd
      const restored = await git($, target, ['git', 'restore', `--source=${snap.sha}`, '--worktree', '--', '.'])
      if (!restored.ok) return { text: `Could not restore snapshot ${index}: git restore failed. The work tree is unchanged.` }
      const names = files.ok ? files.out.split('\n').filter(Boolean) : []
      const shown = names.slice(0, 5).join(', ')
      const more = names.length > 5 ? ` and ${names.length - 5} more` : ''
      return { text: `Restored snapshot ${index}: ${names.length} ${names.length === 1 ? 'file' : 'files'} (${shown}${more}). Files created after it were kept.` }
    },
  },
  pane: async ({ $, e }) => {
    const snapshots = (await listSnapshots($)).slice(0, 5)
    if (!snapshots.length) return null
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    return <Box key="snapshots" flexDirection="column">
      <Text bold>Snapshots</Text>
      {snapshots.map(snap => <Text key={`snapshot-${snap.sha}`}>{`${fmtCountdown(now - snap.at)} ago  ${snap.command}`}</Text>)}
    </Box>
  },
}
