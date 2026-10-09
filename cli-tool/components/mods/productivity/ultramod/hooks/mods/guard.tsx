import { atom, read, update } from 'claude-code'
import type { Args, Frozen } from 'claude-code'
import type { UltraApi } from '../core/api'
import { fmtCountdown } from '../core/format'
import type { UltraMod } from '../core/mod'
import { needsYou } from '../core/notifier'
import { addAllowedRisk } from '../core/state'
import { settingsFor } from '../core/sets'
import { classifyCommand, runsElsewhere } from '../lib/risk'
import { redactSecrets } from '../lib/secrets'
import { KEEP_SNAPSHOTS, SNAPSHOT_PREFIX, SNAPSHOT_REF, restoreSnapshot, saveSnapshot } from '../lib/snapshot'
import type { DropFile, GitRun } from '../lib/snapshot'
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

const cut = (command: string) => command.length > 120 ? `${command.slice(0, 117)}...` : command

// A command quoted back to the model, a log, a notification or a commit
// message: secrets are redacted first (before the cut, so a token is not
// split), since this mod runs ahead of the secrets mod.
const brief = (command: string) => cut(redactSecrets(command).text)

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

type GitResult = { ok: boolean; out: string }

async function git($: UltraApi, cwd: string, argv: string[], env?: Record<string, string>): Promise<GitResult> {
  try {
    const result = await $.process.run(argv, env ? { cwd, env } : { cwd })
    return { ok: result.exitCode === 0, out: result.stdout.trim() }
  } catch {
    return { ok: false, out: '' }
  }
}

// The snapshot code takes its git runner and file remover from here.
const runner = ($: UltraApi): GitRun => (argv, cwd, env) => git($, cwd, argv, env)

const remover = ($: UltraApi): DropFile => async (cwd, path) => {
  const windows = await $.env.get('OS').then(value => value === 'Windows_NT', () => false)
  // git reports the path with forward slashes, which `del` reads as a switch.
  await git($, cwd, windows ? ['cmd', '/c', 'del', '/f', '/q', path.split('/').join('\\')] : ['rm', '-f', path])
}

async function snapshot($: UltraApi, command: string): Promise<void> {
  const cwd = await $.session.cwd()
  await saveSnapshot(runner($), remover($), cwd, `${SNAPSHOT_PREFIX}${brief(command)}`, await $.clock.now(), why => { $.ui.log(`guard snapshot skipped: ${why}`) })
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

// A risk id is lowercase words joined by hyphens (git-clean). Anything else,
// a name with a dot or underscore such as server.pem or id_rsa, or a path, is
// left to the secrets mod, which the null answer defers to.
const RISK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const looksLikeRiskId = (value: string) => RISK_ID.test(value)

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
        // A snapshot saves this session's repository, which a command that
        // moves elsewhere does not change.
        const elsewhere = hit.snapshot && runsElsewhere(command)
        if (!(await allowIds($)).includes(hit.id)) {
          if (mode === 'deny') {
            // Marathon refuses unattended; the notification is the only voice it has.
            needsYou($, `guard: refused \`${brief(command)}\``)
            return { deny: deniedText(command, hit) }
          }
          if (mode === 'log') {
            $.ui.log(`guard: ${hit.reason} (${brief(command)})`)
          } else {
            // The whole command: the answer covers all of it, so a long one is not cut.
            const note = !hit.snapshot ? '' : elsewhere
              ? ' It acts outside this session\'s repository, so no snapshot is saved and /ultra undo cannot restore it.'
              : ' A work tree snapshot is saved first, so /ultra undo can restore it.'
            const question = `Run \`${command}\`? It ${hit.reason}.${note}`
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
        if (hit.snapshot && !elsewhere) await snapshot($, command)
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
      if (!looksLikeRiskId(value)) return null
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
        answer = await $.ui.ask(`Restore snapshot ${index} (${snap.command})? Files in the snapshot go back to their saved content, so changes made to them since are lost. Files created after it are kept.`, { header: 'Ultra Mod', options: ['Restore', 'Cancel'] })
      } catch {
        // A dismissed question restores nothing.
      }
      if (answer !== 'Restore') return { text: `Snapshot ${index} was not restored.` }
      const cwd = await $.session.cwd()
      const root = await git($, cwd, ['git', 'rev-parse', '--show-toplevel'])
      const target = root.ok && root.out ? root.out : cwd
      let conflicts: string[] = []
      const restored = await restoreSnapshot(runner($), remover($), target, snap.sha, paths => { conflicts = paths })
      if (conflicts.length) {
        const shown = conflicts.slice(0, 5).join(', ')
        const more = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''
        return { text: `Snapshot ${index} was not restored: ${shown}${more} ${conflicts.length === 1 ? 'is' : 'are'} a file where the snapshot has a directory, or a directory where it has a file, and writing it back would delete newer work. Move ${conflicts.length === 1 ? 'it' : 'them'} aside and run /ultra undo ${index} again.` }
      }
      if (!restored) return { text: `Could not restore snapshot ${index}: git could not finish writing the files. Check git status.` }
      const files = await git($, target, ['git', 'ls-tree', '-r', '--name-only', '--full-tree', snap.sha])
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
