// The sentences of the band, the pane, the report, the command, and the notices.

import type { SandboxTunerApplied, SandboxTunerLatest, SandboxTunerRecord, SandboxTunerSettingsKey } from '../types'
import { cutText, displayPath, isSharedFolder, plainText } from './names'
import { allowCount, sightingTotal } from './records'
import type { FileInfo, Refusal } from './settings-file'
import type { Change, Context, NoFixReason, SourceName, Verdict } from './verdicts'

const MINUTE = 60_000
// A settings entry that a sentence quotes can come from a cloned project: a long one is cut.
const QUOTE_LIMIT = 200
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const NO_BLOCKS = 'Sandbox Tuner has not seen a sandbox block yet.'
export const SANDBOX_OFF = 'The sandbox is off in this session. Sandbox Tuner has nothing to tune.'
const NO_SETTINGS_FILE = 'Sandbox Tuner cannot find your user settings file because HOME and CLAUDE_CONFIG_DIR are not set.'
export const NOTHING_TO_UNDO = 'Nothing to undo.'
export const NOTHING_TO_CHANGE = 'Nothing to change: the target is no longer listed.'
export const APPLY_HINT = 'To apply a fix, run /sandbox-tuner in an interactive session and press Allow or Deny.'
export const COMMAND_DESCRIPTION = 'Review the hosts and write folders the sandbox keeps blocking.'
export const STILL_BLOCKED = 'If the sandbox still blocks it, the cause is elsewhere, such as a tool that ignores the sandbox proxy, a read block, or file permissions. Check the client’s proxy settings and supported protocols. Run /status or /doctor for managed-settings warnings.'

const SHARED_FOLDER = 'Every app you run keeps files in this folder, so sandboxed commands could change files that other apps read.'
const SOURCE_LABELS: Readonly<Record<SourceName | 'combined', string>> = { user: 'user', project: 'project', local: 'local project', flag: '--settings', policy: 'managed', combined: 'combined' }
const CHANGE_EFFECTS: Readonly<Record<SandboxTunerSettingsKey, string>> = {
  'sandbox.network.allowedDomains': 'Sandboxed commands in every project can then reach it on any port, with no prompt and no per-command list, and can send it data.',
  'sandbox.network.deniedDomains': 'The sandbox then refuses the host in every project, without a prompt.',
  'sandbox.filesystem.allowWrite': 'Sandboxed commands can then write anywhere under it, and programs that run outside the sandbox may later load what they wrote.',
}
const NO_FIX: Readonly<Record<NoFixReason, (detail: string, target: string) => string>> = {
  'unverified-path': () => 'This folder includes an unverified path inferred from error text. Punctuation can hide protected filenames. Sandbox Tuner cannot offer Allow.',
  'not-dns': () => 'Sandbox Tuner does not suggest IP addresses or local host names.',
  'denied-by-settings': detail => `Your setting "${detail}" already refuses this host.`,
  'managed-lock': (_, target) => `Your organization's managed settings lock the network allowlist. Ask your administrator to allow ${target}.`,
  protected: () =>
    "Sandbox Tuner never opens this path to writes, because settings or code in it can run outside the sandbox. No setting opens such a path in your working directory or in Claude Code's config folder. If you expected this write, approve an unsandboxed retry or run the command yourself.",
  credentials: () => 'This folder holds credentials. Sandbox Tuner never opens it to writes.',
  system: () => 'This is a system or software-install folder. Sandbox Tuner never opens it to writes.',
  'too-broad': (_, target) => `${target} is too broad to open to writes.`,
  glob: (_, target) => `${target} holds *, ?, or [, which the sandbox reads as a pattern, so Sandbox Tuner cannot name it as a folder.`,
  'on-path': (detail, target) => `${target} holds or sits inside ${detail}, a folder on your PATH, so a program written there could run in place of one you call.`,
  'inside-workspace': () => 'Sandboxed commands can already write here. The block came from a protected file, a denyWrite rule, or a cause outside the sandbox.',
  'deny-rule': detail => `Your write deny rule "${detail}" blocks it.`,
  'write-pattern': detail => `Your write deny pattern "${detail}" may cover this path. Sandbox Tuner cannot safely suggest write access for this block.`,
  'read-rule': detail => `Your read rule "${detail}" covers this path, so the block may be a read. Sandbox Tuner does not tune reads.`,
  'read-pattern': detail => `Your read pattern "${detail}" may cover this path. Sandbox Tuner cannot safely suggest write access for this block.`,
  'not-a-cache': () =>
    'Sandbox Tuner suggests only cache and temp folders, because files in other folders can set up or start programs that run outside the sandbox. If you expected this write, approve an unsandboxed retry or run the command yourself.',
  'no-settings-file': () => NO_SETTINGS_FILE,
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

function age(elapsedMs: number): string {
  if (elapsedMs < MINUTE) return 'just now'
  if (elapsedMs < HOUR) return `${Math.floor(elapsedMs / MINUTE)} min ago`
  if (elapsedMs < DAY) return `${Math.floor(elapsedMs / HOUR)} h ago`
  return `${Math.floor(elapsedMs / DAY)} d ago`
}

export function displayTarget(record: SandboxTunerRecord, home: string | undefined): string {
  return record.kind === 'path' ? displayPath(record.target, home) : record.target
}

export function explanation(latest: SandboxTunerLatest): string {
  const blocked = `Sandbox blocked ${latest.detail} for "${latest.command}".`
  switch (latest.reason) {
    case 'unlisted':
      return `${blocked} The host is not on your sandbox allowlist, so Claude must list it on each command.`
    case 'refused':
      return `${blocked} You denied this host at the network prompt.`
    case 'other':
      return `${blocked} Reason: ${latest.reasonText}.`
    case 'write':
      return `Sandbox blocked a write to ${latest.detail} for "${latest.command}".`
    case 'operation': {
      const operation = latest.reasonText
      const label = operation.startsWith('file-read-') ? 'a file read' : operation === 'mach-lookup' ? 'a Mach service lookup' : /socket|network-(?:bind|inbound)/.test(operation) ? 'a socket operation' : null
      return label === null
        ? `Sandbox Tuner cannot classify this sandbox operation: ${latest.detail}. No Allow action is available.`
        : `The sandbox reported ${label} for "${latest.command}": ${latest.detail}. A write-folder grant cannot repair this operation. No Allow action is available.`
    }
    case 'inferred':
      return `"${latest.command}" failed with a permission error on ${latest.detail}. The path and sandbox cause are unverified.`
  }
}

export function countsSentence(record: SandboxTunerRecord): string {
  return `Seen ${plural(sightingTotal(record.counts), 'time')} in ${plural(record.sessions.length, 'session')}.`
}

export function countsSummary(record: SandboxTunerRecord, now: number): string {
  const { blocked, refused, listed, inferred } = record.counts
  const head =
    record.kind === 'path'
      ? `blocked ${blocked}${inferred > 0 ? ` · from error text ${inferred}` : ''}`
      : `blocked ${blocked}${refused > 0 ? ` (you denied ${refused})` : ''}${listed > 0 ? ` · listed on ${plural(listed, 'command')}` : ''}`
  const programs = record.seenWith.length > 0 ? ` · with ${record.seenWith.join(', ')}` : ''
  const ports = record.ports.length > 0 ? ` · ports ${record.ports.join(', ')}` : ''
  return `${head} · ${plural(record.sessions.length, 'session')} · last ${age(now - record.lastSeen)}${programs}${ports}`
}

function changeSentence(change: Change): string {
  const verb = change.action === 'allow' ? 'Allow' : 'Deny'
  const shared = isSharedFolder(change.entry) ? ` ${SHARED_FOLDER}` : ''
  return `${verb} adds "${change.entry}" to ${change.settingsKey} in ${change.file.display}. ${CHANGE_EFFECTS[change.settingsKey]}${shared}`
}

function refusalNote(record: SandboxTunerRecord): string[] {
  return record.counts.refused > 0 ? [`You denied this host ${plural(record.counts.refused, 'time')} at the network prompt.`] : []
}

function statusSentences(record: SandboxTunerRecord, verdict: Verdict, context: Context): string[] {
  switch (verdict.status) {
    case 'ready':
      return refusalNote(record)
    case 'waiting':
      return [...refusalNote(record), `Sandbox Tuner offers Allow after ${plural(context.threshold, 'sighting')} (${allowCount(record.counts)} so far).`]
    case 'covered':
      return [`Your ${SOURCE_LABELS[verdict.source]} settings already allow it.`]
    case 'no-fix':
      return [NO_FIX[verdict.reason](cutText(plainText(displayPath(verdict.detail, context.home)), QUOTE_LIMIT), displayTarget(record, context.home))]
  }
}

/** The warning before a press saves a file that is not in the 2-space JSON format that Claude Code writes. */
export function reformatSentence(file: FileInfo): string {
  return `Saving also re-formats ${file.display} as 2-space JSON.`
}

export function verdictSentences(record: SandboxTunerRecord, verdict: Verdict, context: Context): string[] {
  const changes = [verdict.status === 'ready' ? verdict.allow : null, 'deny' in verdict ? verdict.deny : null].filter((change): change is Change => change !== null)
  const reformat = context.isCanonical ? [] : changes.slice(0, 1).map(change => reformatSentence(change.file))
  return [...statusSentences(record, verdict, context), ...changes.map(changeSentence), ...reformat]
}

export function addedNotice(change: Change, hadFile: boolean): string {
  const previous = hadFile ? `The previous file is saved at ${change.file.backupDisplay}.` : 'The file is new.'
  return `Added "${change.entry}" to ${change.settingsKey} in ${change.file.display}. ${previous}`
}

export function removedNotice(entry: SandboxTunerApplied, file: FileInfo): string {
  return `Removed "${entry.entry}" from ${entry.settingsKey} in ${file.display}. The previous file is saved at ${file.backupDisplay}.`
}

/** The cause when the file holds the entry, but the settings that Claude Code loaded do not. */
export function notAppliedText(change: Change): string {
  return `"${change.entry}" is already in ${change.settingsKey} in ${change.file.display}, but Claude Code has not applied it yet. If this stays, run /status to check that the session loads user settings, and look for a ConfigChange hook that blocks the change. Nothing was written.`
}

export function absentNotice(entry: SandboxTunerApplied): string {
  return `"${entry.entry}" is no longer in ${entry.settingsKey}. Marked as undone.`
}

export function hiddenNotice(target: string): string {
  return `${target} is hidden. Find it under Hidden.`
}

export function shownNotice(target: string): string {
  return `${target} is shown again.`
}

export function nothingApplied(sentences: readonly string[]): string {
  return `Nothing applied: ${sentences.join(' ')}`
}

function refusalCause(refusal: Refusal, file: FileInfo): string {
  return refusal.refusal === 'invalid-json'
    ? `${file.display} is not valid JSON (${refusal.message}).`
    : `${refusal.path} in ${file.display} is ${refusal.found}, not ${refusal.expected}.`
}

export function refusalText(refusal: Refusal, file: FileInfo): string {
  return `${refusalCause(refusal, file)} Nothing was written.${refusal.refusal === 'invalid-json' ? ' Fix the file, then press again.' : ''}`
}

export function verificationRefusalText(refusal: Refusal, file: FileInfo): string {
  return `could not check ${file.display} after the write: ${refusalCause(refusal, file)} Check the file before trying again.`
}

export function appliedLine(entry: SandboxTunerApplied, now: number): string {
  const undone = entry.applyState === 'pending' ? ', addition unconfirmed' : entry.undoState === 'superseded' ? ', a later change owns this entry' : entry.undoState === 'pending' || entry.undoState === 'retry' ? ', removal unconfirmed' : entry.undoneAt === null ? '' : `, undone ${age(now - entry.undoneAt)}`
  return `${entry.entry} in ${entry.settingsKey}, ${age(now - entry.appliedAt)}${undone}`
}

export function undoSentence(entry: SandboxTunerApplied, file: FileInfo): string {
  return `Undo removes "${entry.entry}" from ${entry.settingsKey} in ${file.display}.`
}

export function settingsHeader(file: FileInfo | undefined): string {
  return file === undefined ? NO_SETTINGS_FILE : `Settings file: ${file.display}`
}

export function lastProblem(fault: string): string {
  return `Last background problem: ${fault}`
}

export function moreRows(count: number): string {
  return `+${count} more`
}

export const APPLIED_PREVIOUS = 'Newer changes'
export const APPLIED_NEXT = 'Older changes'

export function reportHeadline(counts: Readonly<Record<Verdict['status'], number>>): string {
  return `${plural(counts.ready, 'fix', 'fixes')} ready, ${counts.waiting} waiting, ${counts['no-fix']} without a settings fix, ${counts.covered} already allowed.`
}

export function openedLine(ready: number, targets: number): string {
  return `${plural(ready, 'fix', 'fixes')} ready, ${plural(targets, 'target')}. The pane is open.`
}

export function notPlaced(reason: string): string {
  return `The pane is not placed: ${reason}`
}

/** Command results and toasts already carry the plugin name. */
export function hostText(text: string): string {
  return text.replace(/^sandbox-tuner: /gm, '').replace(/^Sandbox Tuner has not seen/, 'Has not seen')
}
