// Sandbox Tuner's hooks module: every hook and every $ call.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, HookFailure, Register, RenderElement, Timer, ToolCallResult } from 'claude-code'

import type { SandboxTunerAction, SandboxTunerApplied, SandboxTunerLatest, SandboxTunerNotice, SandboxTunerRecord } from '../types'
import { causeOf, diagnostic } from './diagnostics'
import { TMP, absolutePath, commandLine, cutText, displayPath, isTempFolder, isUnder, pathFolders, plainText } from './names'
import { JOURNAL_PREFIX, WRITER_PREFIX, HIDDEN_PREFIX, aggregateRecords, hasLaterOwner, isUndoUnresolved, isFixedSince, isPressedAgain, isRecord, journalOf, mergeSighting, recordKey, shownRecords } from './records'
import { addEntry, fileInfo, isApplied, lockText, parseSettings, readLock, removeEntry, serializeSettings } from './settings-file'
import type { FileInfo, ParsedSettings } from './settings-file'
import { keepGated, latestOf, readCall, reportQuote } from './sightings'
import type { BashCall, BashOutcome, GatedSighting, Sighting } from './sightings'
import { anchorEntry, credentialEntries, denialEntries, denialVerdict, grantsMet, guardedPlaces, guardedWalks, isSkipped, rateRecords, sandboxFacts, verdictOf } from './verdicts'
import type { Change, Context, Sources, Verdict, Walk } from './verdicts'
import { bandTree, buildBand, buildObservation, buildPane, canUndo, drawable, paneTree, reportText, summaryLine } from './views'
import {
  COMMAND_DESCRIPTION, NOTHING_TO_CHANGE, NOTHING_TO_UNDO, absentNotice, addedNotice, displayTarget, grantWarning, hiddenNotice, notAppliedText, notPlaced,
  nothingApplied, hostText, refusalText, removedNotice, shownNotice, verdictSentences, verificationRefusalText,
} from './words'

type BashInput = { command: string; run_in_background?: boolean; dangerouslyDisableSandbox?: boolean; allowed_domains?: string[] }

const backgroundTasks = atom({ plugin: 'sandbox-tuner', key: 'backgroundTasks' } as const, [] as string[])
const writerId = crypto.randomUUID()
const evidenceIncomplete = atom({ plugin: 'sandbox-tuner', key: 'evidenceIncomplete' } as const, false)
const records = atom({ plugin: 'sandbox-tuner', key: 'records' } as const, [] as SandboxTunerRecord[])
const applied = atom({ plugin: 'sandbox-tuner', key: 'applied' } as const, [] as SandboxTunerApplied[])
const appliedOffset = atom({ plugin: 'sandbox-tuner', key: 'appliedOffset' } as const, 0)
const latest = atom({ plugin: 'sandbox-tuner', key: 'latest' } as const, null as SandboxTunerLatest | null)
const fault = atom({ plugin: 'sandbox-tuner', key: 'fault' } as const, null as string | null)

// Sandbox Tuner's own cap on a debug line. The cut keeps the start of its diagnostic.
const LOG_LIMIT = 4096

function logDebug($: EngineInterface, text: string): void {
  $.ui.log(cutText(plainText(text), LOG_LIMIT), { to: 'debug' })
}

// One queue per module instance, so the store writes of one session never interleave. A hot reload starts a new one.
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  queue = run.catch(() => undefined)
  return run
}

/** Logs a background problem and keeps it for the pane. Never rejects, so no background job ends in silence. */
async function noteFault($: EngineInterface, text: string): Promise<void> {
  const unshown = await update($, fault, () => text).then(
    () => '',
    (error: unknown) => ` The pane cannot show this problem: ${causeOf(error)}.`,
  )
  logDebug($, `${text}${unshown}`)
}

function hookFailed($: EngineInterface, event: string, detail: string | null, failure: HookFailure): string {
  const text = diagnostic(event, detail, `hook failed (${failure.kind}): ${failure.message ?? 'no message'}`)
  logDebug($, text)
  return text
}

/** A folder from the environment, resolved from `base` when relative; an empty value counts as unset, as in a shell. */
function folderOf(value: string | undefined, base: string): string | undefined {
  return value === undefined || value === '' ? undefined : absolutePath(value, base)
}

async function homeOf($: EngineInterface): Promise<string | undefined> {
  return folderOf(await $.env.get('HOME'), '/')
}

function toCall(e: BashInput): BashCall {
  return {
    command: e.command,
    isBackground: e.run_in_background === true,
    isUnsandboxed: e.dangerouslyDisableSandbox === true,
    allowedDomains: e.allowed_domains ?? [],
  }
}

// The Bash matcher types the result: on the success arm `result` is Bash's record, which core validates.
function toOutcome(out: ToolCallResult<'Bash'>): BashOutcome {
  if (out.deny !== undefined) return { isDenied: true, isError: false, text: '', stderr: '' }
  if (out.isError === true) return { isDenied: false, isError: true, isReadOnly: out.isReadOnly === true, text: out.text ?? '', stderr: '' }
  return { isDenied: false, isError: false, isReadOnly: out.isReadOnly === true, backgroundTaskId: out.result.backgroundTaskId, isUnsandboxed: out.result.dangerouslyDisableSandbox, text: out.text ?? '', stderr: out.result.stderr }
}

async function gatedSightings($: EngineInterface, gated: readonly GatedSighting[], tool: string): Promise<Sighting[]> {
  try {
    return keepGated(gated, sandboxFacts(await $.settings.read()))
  } catch (error) {
    await noteFault($, diagnostic('tool.call', tool, `could not read settings to check the sandbox: ${causeOf(error)}. Kept only sandbox reports, and none of a call that failed.`))
    return []
  }
}

async function sessionIdOf($: EngineInterface, tool: string): Promise<string | null> {
  try {
    return await $.session.id()
  } catch (error) {
    await noteFault($, diagnostic('tool.call', tool, `could not read the session id: ${causeOf(error)}`))
    return null
  }
}

async function saveSighting($: EngineInterface, sighting: Sighting, sessionId: string | null, now: number, tool: string): Promise<void> {
  const key = recordKey(sighting)
  try {
    const storeKey = `${WRITER_PREFIX}${writerId}:${key}`
    const stored = await $.store.get(storeKey)
    const merged = mergeSighting(isRecord(stored) ? stored : undefined, sighting, sessionId, now)
    await $.store.set(storeKey, merged)
    const refreshed = (await readRecords($, key))[0]
    if (refreshed === undefined) throw new Error('saved evidence was not returned by the store')
    await update($, records, list => [...list.filter(record => record.key !== key), refreshed])
  } catch (error) {
    await update($, evidenceIncomplete, () => true)
    await noteFault($, diagnostic('tool.call', tool, `could not save the sighting of ${key}: ${causeOf(error)}`))
  }
}

async function recordCall($: EngineInterface, call: BashCall, outcome: BashOutcome, signal: AbortSignal, tool = 'Bash'): Promise<void> {
  if (signal.aborted) return
  const taskId = outcome.backgroundTaskId
  if (taskId !== undefined && (await read($, backgroundTasks)).includes(taskId)) return
  const { reports, gated, unknownLine, observation, skipped } = readCall(call, outcome, await homeOf($), await $.session.cwd())
  // The debug log only: the pane would show a block that the command printed as a problem.
  if (skipped) logDebug($, diagnostic('tool.call', tool, 'skipped a <sandbox_violations> block that does not end the text of a failed call (not quoted: the command can print one)'))
  if (unknownLine !== null) {
    const quote = reportQuote(unknownLine)
    const cause = quote === null
      ? `skipped a sandbox report line of an unknown form (${unknownLine.length} characters, not quoted: it does not start like a report line)`
      : `skipped a sandbox report line of an unknown form: ${quote}`
    await noteFault($, diagnostic('tool.call', tool, cause))
  }
  const sightings = gated.length === 0 ? reports : [...reports, ...(await gatedSightings($, gated, tool))]
  if (observation !== undefined) {
    const at = await $.clock.now()
    await update($, latest, () => ({ recordKey: `observation:${at}`, detail: observation.detail, reason: 'operation', reasonText: observation.operation, command: commandLine(call.command), at }))
  }
  if (taskId !== undefined) await update($, backgroundTasks, list => [...list, taskId])
  if (sightings.length === 0) return
  const sessionId = await sessionIdOf($, tool)
  const now = await $.clock.now()
  for (const sighting of sightings) {
    if (signal.aborted) return
    await saveSighting($, sighting, sessionId, now, tool)
  }
  const newest = latestOf(sightings, commandLine(call.command), now)
  if (newest !== null) await update($, latest, () => newest)
}

/** Read durable evidence before displaying it or authorizing a new grant. */
async function readRecords($: EngineInterface, targetKey?: string): Promise<SandboxTunerRecord[]> {
  const found: SandboxTunerRecord[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(WRITER_PREFIX)) continue
    const writerSeparator = key.indexOf(':', WRITER_PREFIX.length)
    if (writerSeparator <= WRITER_PREFIX.length) throw new Error(`invalid writer key: ${key}`)
    const storedTarget = key.slice(writerSeparator + 1)
    if (targetKey !== undefined && storedTarget !== targetKey) continue
    const value = await $.store.get(key)
    if (!isRecord(value) || storedTarget !== value.key) {
      throw new Error(`invalid saved safety evidence: ${key}`)
    }
    found.push(value)
  }
  const combined = aggregateRecords(found)
  for (const record of combined) {
    const hidden = await $.store.get(HIDDEN_PREFIX + record.key)
    if (hidden !== undefined && typeof hidden !== 'boolean') throw new Error(`invalid hidden preference: ${record.key}`)
    if (typeof hidden === 'boolean') record.isHidden = hidden
  }
  return combined
}

/** Display retention never deletes another writer's mutable safety evidence. */
async function loadSaved($: EngineInterface, event: string, detail: string | null): Promise<SandboxTunerRecord[] | string> {
  try {
    const found = await readRecords($)
    const journal = journalOf(await reconcileJournal($, await readJournal($)))
    const kept = shownRecords(found, await $.clock.now())
    await update($, records, () => kept)
    await update($, applied, () => journal)
    return kept
  } catch (error) {
    const text = diagnostic(event, detail, `could not load saved targets: ${causeOf(error)}`)
    await noteFault($, text)
    return text
  }
}

// A press that wrote the settings file names the change, which the press checks again once the write has settled.
type Written = { file: FileInfo; entry: SandboxTunerApplied }
type PressResult = { text: string; isError: boolean; written: Written | null }

const dismissed = atom({ plugin: 'sandbox-tuner', key: 'dismissed' } as const, null as string | null)
const notice = atom({ plugin: 'sandbox-tuner', key: 'notice' } as const, null as SandboxTunerNotice | null)
const PANE = 'sandbox-tuner'
const PANE_OPEN = { id: PANE, title: 'Sandbox Tuner', focus: true, closeOnEscape: true } as const
// Claude Code applies a settings edit once its file watcher sees it: draw again after that had time to happen.
const REDRAW_AFTER_WRITE_MS = 2000
// The error code that ends the text of a failed $.fs call for a path where nothing is.
const MISSING = /\b(?:ENOENT|ENOTDIR)$/

type JournalChange = { buttonKey: string; file: FileInfo; entry: SandboxTunerApplied; success: string; didWrite: boolean }

/** The text of a file, or null when it does not exist. */
async function fileText($: EngineInterface, path: string): Promise<string | null> {
  return (await $.fs.exists(path)) ? $.fs.read(path) : null
}

async function isCanonicalFile($: EngineInterface, path: string, event: string): Promise<boolean> {
  try {
    const text = await fileText($, path)
    if (text === null) return true
    const parsed = parseSettings(text)
    return 'refusal' in parsed || parsed.isCanonical
  } catch (error) {
    logDebug($, diagnostic(event, null, `could not read ${path} to check its format: ${causeOf(error)}`))
    return true
  }
}

/** The settings files of the journal's Undo rows that are not in the 2-space JSON format: an Undo re-formats them. */
async function reformattedFiles($: EngineInterface, journal: readonly SandboxTunerApplied[], context: Context): Promise<string[]> {
  const found: string[] = []
  for (const path of new Set(journal.filter(canUndo).map(entry => entry.file))) {
    const isCanonical = path === context.file?.path ? context.isCanonical : await isCanonicalFile($, path, 'ui.render (Pane)')
    if (!isCanonical) found.push(path)
  }
  return found
}

async function loadContext($: EngineInterface, threshold: number, event: string): Promise<Context> {
  const sources: Sources = {
    user: await $.settings.read({ source: 'user' }),
    project: await $.settings.read({ source: 'project' }),
    local: await $.settings.read({ source: 'local' }),
    flag: await $.settings.read({ source: 'flag' }),
    policy: await $.settings.read({ source: 'policy' }),
  }
  const home = await homeOf($)
  const cwd = await $.session.cwd()
  const root = await $.session.root()
  // A relative CLAUDE_CONFIG_DIR is taken from the session root, read again on each call: the folder the session
  // started in, or where /cd or a worktree move took it (types: session.root). The docs ask for an absolute path.
  const configDir = folderOf(await $.env.get('CLAUDE_CONFIG_DIR'), root) ?? (home === undefined ? undefined : `${home}/.claude`)
  const file = configDir === undefined ? undefined : fileInfo(`${configDir}/settings.json`, home)
  return {
    sources,
    home,
    configDir,
    ...guardedPlaces(home, configDir, [cwd, root]),
    pathDirs: pathFolders(await $.env.get('PATH'), cwd),
    tmp: TMP,
    cwd,
    root,
    threshold,
    file,
    isCanonical: file === undefined || (await isCanonicalFile($, file.path, event)),
  }
}

function failure(buttonKey: string, cause: string): PressResult {
  return { text: diagnostic('ui.press', buttonKey, cause), isError: true, written: null }
}

function info(text: string): PressResult {
  return { text, isError: false, written: null }
}

/** The text of the settings file as one read found it, null when there was no file, and what it holds. */
type Loaded = { original: string | null; parsed: ParsedSettings }

/** The text of the settings file (`found`), or the result of a press that cannot read it. */
async function readText($: EngineInterface, file: FileInfo, buttonKey: string): Promise<{ found: string | null } | PressResult> {
  try {
    return { found: await fileText($, file.path) }
  } catch (error) {
    return failure(buttonKey, `could not read ${file.display}: ${causeOf(error)}. Nothing was written.`)
  }
}

async function readSettingsFile($: EngineInterface, file: FileInfo, buttonKey: string): Promise<Loaded | PressResult> {
  const read = await readText($, file, buttonKey)
  if (!('found' in read)) return read
  const parsed = parseSettings(read.found ?? '')
  return 'refusal' in parsed ? failure(buttonKey, refusalText(parsed, file)) : { original: read.found, parsed }
}

// The lock of a settings file, `file.lock` next to it (fileInfo), so that presses in different sessions edit the file in
// turn. $.fs has no exclusive create and no delete: a press claims the lock file by writing its own token and reading it
// back, and frees it by writing a free record. Right before its settings write, it checks that it still holds the lock.
const LOCK_POLL_MS = 100
// How long a press waits for a lock that another press holds. The press waits in the module queue, so it stays short.
const LOCK_WAIT_MS = 3_000
// A lock that no press freed for this long is left over, from a press that stopped: the next press takes it over.
const LOCK_STALE_MS = 30_000

/** The token of the press that a lock file names, or null when it names none. */
function holderOf(text: string | null): string | null {
  const found = readLock(text)
  return found === null || found === 'free' ? null : found.holder
}

/**
 * Takes the lock of the settings file for one press: once it is free, or once it is left over. Returns the press's
 * token, or the result of a press that cannot take it.
 */
async function takeLock($: EngineInterface, file: FileInfo, buttonKey: string): Promise<string | PressResult> {
  const token = crypto.randomUUID()
  const started = await $.clock.now()
  for (;;) {
    const now = await $.clock.now()
    try {
      const found = readLock(await fileText($, file.lock))
      // A lock file of other text, such as one that a write has not finished, ages from its last change.
      const since = found === 'free' ? now : found === null ? (await $.fs.stat(file.lock)).mtimeMs : found.since
      const isLeft = Math.abs(now - since) >= LOCK_STALE_MS
      if (found === 'free' || isLeft) {
        await $.fs.write(file.lock, lockText(token, now))
        // Another press that found the lock free at the same moment can claim it last: then it holds the lock.
        if (holderOf(await $.fs.read(file.lock)) === token) {
          if (isLeft) logDebug($, diagnostic('ui.press', buttonKey, `took over the lock on ${file.display} (${file.lockDisplay}), which no press freed within ${LOCK_STALE_MS / 1000} seconds`))
          return token
        }
      }
    } catch (error) {
      return failure(buttonKey, `could not take the lock on ${file.display} (${file.lockDisplay}): ${causeOf(error)}. Nothing was written.`)
    }
    if (now - started >= LOCK_WAIT_MS) {
      return failure(buttonKey, `another Sandbox Tuner session holds the lock on ${file.display} (${file.lockDisplay}) and did not free it within ${LOCK_WAIT_MS / 1000} seconds. Nothing was written. Press again.`)
    }
    await $.clock.sleep(LOCK_POLL_MS)
  }
}

/** Frees the lock that the press holds, and leaves a lock that another press took over. It never rejects. */
async function freeLock($: EngineInterface, file: FileInfo, token: string, buttonKey: string): Promise<void> {
  try {
    if (holderOf(await fileText($, file.lock)) === token) await $.fs.write(file.lock, lockText(null, await $.clock.now()))
  } catch (error) {
    logDebug($, diagnostic('ui.press', buttonKey, `could not free the lock on ${file.display} (${file.lockDisplay}): ${causeOf(error)}. Other sessions take it over ${LOCK_STALE_MS / 1000} seconds after this press took it.`))
  }
}

/** Null while the press holds the lock of the settings file, else why the press stops. */
async function lockLoss($: EngineInterface, file: FileInfo, token: string): Promise<string | null> {
  try {
    if (holderOf(await fileText($, file.lock)) === token) return null
    return `another Sandbox Tuner session took over the lock on ${file.display} (${file.lockDisplay}) during this press. Sandbox Tuner left the file as it is. Press again.`
  } catch (error) {
    return `could not check the lock on ${file.display} (${file.lockDisplay}): ${causeOf(error)}. Sandbox Tuner left the file as it is. Press again.`
  }
}

/**
 * Writes `file.backup`, a copy of the old text, then `file.path`, the user settings file. The path is not fixed text:
 * it is `$CLAUDE_CONFIG_DIR/settings.json`, else `$HOME/.claude/settings.json` (loadContext), or for Undo the file that
 * the change went into. The copy is `backups/settings.json.sandbox-tuner.bak` in the same folder (fileInfo). The press
 * holds the lock of the file (`token`).
 */
async function writeSettings($: EngineInterface, buttonKey: string, file: FileInfo, original: string | null, text: string, entry: SandboxTunerApplied, token: string): Promise<PressResult | null> {
  const previous = original === null ? 'The file did not exist before.' : `The previous file is saved at ${file.backupDisplay}.`
  if (original !== null) {
    try {
      await $.fs.write(file.backup, original)
    } catch (error) {
      return failure(buttonKey, `could not save a copy of ${file.display} to ${file.backupDisplay}: ${causeOf(error)}. Nothing was written.`)
    }
  }
  const pending = await saveJournal($, { buttonKey, file, entry, success: '', didWrite: false })
  if (pending.isError) return pending
  // $.fs has no conditional write: check last that no other session or program saved the file since the press read it,
  // and that no other press took the lock over.
  const change = await fileText($, file.path).then(
    current => (current === original ? null : 'another program changed it'),
    (error: unknown) => causeOf(error),
  )
  const stop = change === null
    ? await lockLoss($, file, token)
    : `could not confirm that ${file.display} is unchanged since Sandbox Tuner read it (${change}). Sandbox Tuner left the file as it is. Press again.`
  if (stop !== null) {
    // No settings write was attempted, so this addition cannot own an entry in the file.
    if (entry.applyState === 'pending') {
      try {
        await $.store.delete(JOURNAL_PREFIX + entry.id)
        await update($, applied, list => list.filter(item => item.id !== entry.id))
      } catch (error) {
        await noteFault($, diagnostic('ui.press', buttonKey, `could not discard the unwritten addition from the Undo journal: ${causeOf(error)}`))
      }
    }
    return failure(buttonKey, stop)
  }
  // Keep Undo even if the write or its read-back fails after changing the file.
  const written = { file, entry }
  try {
    await $.fs.write(file.path, text)
  } catch (error) {
    const repair = original === null ? 'Delete it if a damaged copy is left.' : `Copy it back if ${file.display} is now damaged.`
    return { ...failure(buttonKey, `could not write ${file.display}: ${causeOf(error)}. ${previous} ${repair}`), written }
  }
  const problem = await $.fs.read(file.path).then(
    readBack => (readBack === text ? null : 'another program changed it'),
    (error: unknown) => causeOf(error),
  )
  return problem === null ? null : { ...failure(buttonKey, `${file.display} does not hold the new text after the write (${problem}). ${previous}`), written }
}

async function saveJournal($: EngineInterface, change: JournalChange): Promise<PressResult> {
  const { entry } = change
  try {
    await $.store.set(JOURNAL_PREFIX + entry.id, entry)
    await update($, applied, list => journalOf([...list.filter(item => item.id !== entry.id), entry]))
    // The band of a fixed block stays hidden, even once the journal keeps the fix no longer.
    await update($, latest, last => (last !== null && isFixedSince([entry], last) ? null : last))
    return { text: change.success, isError: false, written: change.didWrite ? { file: change.file, entry } : null }
  } catch (error) {
    const cause = change.didWrite
      ? `${change.file.display} is saved, but Sandbox Tuner could not update its Undo journal: ${causeOf(error)}. Check "${entry.entry}" in ${entry.settingsKey} by hand.`
      : entry.applyState === 'pending'
        ? `could not save the Undo journal: ${causeOf(error)}. Nothing was written to ${change.file.display}.`
        : `could not mark "${entry.entry}" as undone: ${causeOf(error)}`
    return { ...failure(change.buttonKey, cause), written: change.didWrite ? { file: change.file, entry } : null }
  }
}

/**
 * True when nothing is at the path: $.fs.stat rejects ENOENT for a missing path, or ENOTDIR below a file. It does not
 * follow a link, so it finds a link that leads nowhere. Any other failure rejects: then no one knows what is there.
 */
async function isMissing($: EngineInterface, path: string): Promise<boolean> {
  return $.fs.stat(path).then(
    () => false,
    (error: unknown) => {
      if (MISSING.test(causeOf(error))) return true
      throw error
    },
  )
}

/**
 * Where an absolute path really lies, found one name at a time as the system finds it: a link is followed before a
 * `..` after it, which $.fs cannot do, because it folds `..` first. `known` holds the names already looked up in this
 * press, so a folder that many paths share is looked up once.
 */
async function realLocation($: EngineInterface, path: string, known: Map<string, string>): Promise<string> {
  let real = '/'
  for (const name of path.split('/')) {
    if (name === '' || name === '.') continue
    if (name === '..') {
      real = real.slice(0, real.lastIndexOf('/')) || '/'
      continue
    }
    const next = `${real === '/' ? '' : real}/${name}`
    real = known.get(next) ?? (await landing($, next, known))
  }
  return real
}

/**
 * Where one path whose folder is real lands: its real path, or itself when nothing is there yet. Rejects, naming the
 * path, when it is a link that leads nowhere or the file system withholds where it lands, because then no one can
 * tell where a write through it goes (types: FsStat.realPath).
 */
async function landing($: EngineInterface, path: string, known: Map<string, string>): Promise<string> {
  let landed = path
  if (await $.fs.exists(path)) {
    const found = (await $.fs.stat(path, { resolve: true })).realPath
    if (found === undefined) throw new Error(`the file system gave no real path for ${path}`)
    landed = found
  } else if (!(await isMissing($, path))) {
    throw new Error(`${path} is a link that Sandbox Tuner cannot follow`)
  }
  known.set(path, landed)
  return landed
}

async function realPlaces($: EngineInterface, paths: readonly string[], known: Map<string, string>): Promise<string[]> {
  const places: string[] = []
  for (const path of paths) places.push(await realLocation($, path, known))
  return places
}

// The most folders and entries that one walk of guarded places lists. With the data folders of the config folder
// skipped, the walk of a config folder with many plugins and skills lists about 450 folders and 3,000 entries. The
// walk of 77 VS Code extensions, two levels of each, adds about 340 folders and 4,000 entries.
const WALK_FOLDERS = 1000
const WALK_ENTRIES = 25_000

/** A folder that Allow opened: its entry in the settings file, how to remove it, and where it really lies. */
type Grant = Granted & { place: string }
/** A link or guarded place, as listed, whose real place lies inside or holds folders that Allow opened: each of them. */
type Finding = { path: string; place: string; met: { grant: Grant; isInside: boolean }[] }
/**
 * What the check at session start gives a walk: the folders that Allow opened, and where the walk keeps what it finds
 * and the links that it cannot follow, so that a walk that stops keeps both.
 */
type Recheck = { grants: Grant[]; found: Finding[]; skipped: string[] }

/** Where a path leads, or null when the check at session start cannot follow it: the check then names it. */
async function followed($: EngineInterface, path: string, known: Map<string, string>, recheck: Recheck): Promise<string | null> {
  try {
    return await realLocation($, path, known)
  } catch {
    recheck.skipped.push(path)
    return null
  }
}

/** Keeps a place that meets a folder that Allow opened as a finding. The walk does not enter such a place. */
function isFinding(recheck: Recheck, path: string, place: string): boolean {
  const met = grantsMet(place, recheck.grants)
  if (met.length > 0) recheck.found.push({ path, place, met })
  return met.length > 0
}

/**
 * The real places that the links inside guarded places lead to, nested links too: each walk lists its levels, with
 * bounded work and cycle detection. A link counts wherever it is listed, and the walk goes on where it leads. For the
 * check at session start (`recheck`), a link that meets a folder that Allow opened is a finding, and a link that
 * cannot be followed is skipped.
 */
async function linksInside($: EngineInterface, walks: readonly Walk[], known: Map<string, string>, recheck?: Recheck): Promise<string[]> {
  const places: string[] = []
  // `at` holds the names from the walked place down to the folder, for its skip entries.
  const pending = walks.map(walk => ({ ...walk, at: [] as readonly string[] }))
  // The most levels listed from each folder, so that a folder reached again is listed again only for more levels.
  const listed = new Map<string, number>()
  let folders = 0
  let entries = 0
  while (pending.length > 0) {
    const { path: folder, levels, skip, at } = pending.pop()!
    if ((listed.get(folder) ?? 0) >= levels) continue
    listed.set(folder, levels)
    if (!(await $.fs.exists(folder))) {
      if (!(await isMissing($, folder))) throw new Error(`cannot resolve guarded path ${folder}`)
      continue
    }
    if ((await $.fs.stat(folder)).kind !== 'dir') continue
    if (++folders > WALK_FOLDERS) throw new Error('guarded directory traversal limit exceeded')
    const children = await $.fs.list(folder)
    entries += children.length
    if (entries > WALK_ENTRIES) throw new Error('guarded directory traversal limit exceeded')
    for (const entry of children) {
      const path = `${folder}/${entry.name}`
      const below = { levels: levels - 1, skip, at: [...at, entry.name] }
      const isEntered = levels > 1 && !isSkipped(skip, below.at)
      if (entry.isLink) {
        const real = recheck === undefined ? await realLocation($, path, known) : await followed($, path, known, recheck)
        if (real === null || (recheck !== undefined && isFinding(recheck, path, real))) continue
        places.push(real)
        if (isEntered) pending.push({ ...below, path: real })
      } else if (entry.kind === 'dir' && isEntered) pending.push({ ...below, path })
    }
  }
  return places
}

/** The real places of guarded places, with every place that a link inside them leads to. */
async function realGuards($: EngineInterface, walks: readonly Walk[], known: Map<string, string>, recheck?: Recheck): Promise<string[]> {
  const located: Walk[] = []
  for (const walk of walks) {
    const path = recheck === undefined ? await realLocation($, walk.path, known) : await followed($, walk.path, known, recheck)
    if (path !== null && (recheck === undefined || !isFinding(recheck, walk.path, path))) located.push({ ...walk, path })
  }
  return [...located.map(walk => walk.path), ...(await linksInside($, located, known, recheck))]
}

/**
 * Rates a folder Allow again where the folder really lies, with HOME, the config dir, the working directory, the
 * protected places and the credentials folders (with the links that their walks find, see guardedWalks), denial
 * paths, the PATH folders, and for a folder in /tmp also /tmp, resolved the same way. A folder outside /tmp is rated
 * with no temp folder, as in Sandbox Tuner 1.1.1. The verdict reads spellings, and a link can hide behind one; an
 * allow-list on realPath is the robust guard (types: FsStat.realPath). Hard links, links in the places that the walks
 * skip, and later filesystem changes remain outside these checks. Returns why the folder stays closed, or null.
 */
async function checkRealFolder($: EngineInterface, record: SandboxTunerRecord, context: Context): Promise<string | null> {
  const shown = displayPath(record.target, context.home)
  try {
    const known = new Map<string, string>()
    const target = await realLocation($, record.target, known)
    const denials = denialEntries(context)
    for (const entry of [...denials]) denials.push({ ...entry, path: await realLocation($, entry.path, known) })
    const real: Context = {
      ...context,
      home: context.home === undefined ? undefined : await realLocation($, context.home, known),
      configDir: context.configDir === undefined ? undefined : await realLocation($, context.configDir, known),
      protectedDirs: await realGuards($, guardedWalks(context.protectedDirs, context), known),
      credentialDirs: await realGuards($, guardedWalks([...context.credentialDirs, ...credentialEntries(context).map(entry => entry.path)], { home: undefined, configDir: undefined }), known),
      pathDirs: await realPlaces($, context.pathDirs, known),
      tmp: isTempFolder(record.target, context.home) ? await realLocation($, TMP, known) : null,
      cwd: await realLocation($, context.cwd, known),
    }
    // The denied file is rated where the write really lands: it can be a link too.
    const located = { ...record, target, sample: await realLocation($, record.sample, known) }
    const verdict = denialVerdict([record.sample, located.sample], denials) ?? verdictOf(located, real)
    const place = displayPath(target, real.home)
    const leads = place === shown ? '' : `${shown} leads to ${place}. `
    if (verdict.status === 'ready') {
      // A folder in /tmp must really lie strictly inside /tmp, also where it is a cache folder.
      if (real.tmp !== null && !isTempFolder(target, real.home, real.tmp)) {
        return `${leads}Sandbox Tuner opens a folder in /tmp only when it really lies inside ${displayPath(real.tmp, real.home)}, the real place of /tmp, and your home folder neither holds that place nor lies inside it. Nothing was written.`
      }
      // The verdict compares with case, and a file system that ignores case reads two spellings as one place.
      const folded = target.toLowerCase()
      const alias = [...real.pathDirs, ...real.protectedDirs, ...real.credentialDirs].find(dir => isUnder(folded, dir.toLowerCase()) || isUnder(dir.toLowerCase(), folded))
      return alias === undefined ? null : `${place} and ${displayPath(alias, real.home)} name one place on a file system that ignores letter case. Nothing was written.`
    }
    return `${leads}${verdictSentences(located, verdict, real).join(' ')} Nothing was written.`
  } catch (error) {
    return `could not check where ${shown} leads: ${causeOf(error)}. Nothing was written.`
  }
}

// A warning of the check at session start names a link, a folder, and what to do: it stays long enough to read.
const WARNING_MS = 15_000

/**
 * A folder entry that Allow added and that a settings file still holds: whether a row of the pane can undo it, and each
 * settings file that holds it with no such row, where only a hand edit removes it.
 */
type Granted = { entry: string; hasUndo: boolean; byHand: string[] }

/**
 * The entries of the folders that Allow opened that their settings file still holds. The file decides, whatever the
 * journal says: an unconfirmed addition, an Undo that failed or is unconfirmed, or an entry marked undone that is back.
 */
async function grantedEntries($: EngineInterface): Promise<Granted[]> {
  const journal = await readJournal($)
  // The rows of the Applied list, as the pane shows them.
  const listed = new Set(journalOf(journal))
  const granted = new Map<string, { held: Set<string>; undoable: Set<string> }>()
  const values = new Map<string, Record<string, unknown> | null>()
  for (const entry of journal) {
    if (entry.settingsKey !== 'sandbox.filesystem.allowWrite') continue
    if (!values.has(entry.file)) {
      const parsed = parseSettings((await fileText($, entry.file)) ?? '')
      values.set(entry.file, 'refusal' in parsed ? null : parsed.value)
    }
    const value = values.get(entry.file)
    if (value === undefined || value === null || !('isPresent' in addEntry(value, entry.settingsKey, entry.entry))) continue
    const files = granted.get(entry.entry) ?? { held: new Set<string>(), undoable: new Set<string>() }
    granted.set(entry.entry, files)
    files.held.add(entry.file)
    // A row with an Undo button whose press does not refuse: Undo refuses an entry that a later change owns.
    if (listed.has(entry) && canUndo(entry) && !hasLaterOwner(journal, entry)) files.undoable.add(entry.file)
  }
  return [...granted].map(([entry, { held, undoable }]) => ({ entry, hasUndo: undoable.size > 0, byHand: [...held].filter(file => !undoable.has(file)) }))
}

/** The event that a check reports with: a check at a session start, or a timed check during the session. */
type RecheckEvent = 'session.start' | 'clock.every'
/**
 * The warnings that a check does not show again (`skip`), and where it keeps the warnings that it shows (`shown`) and
 * every warning that it finds, shown or not (`found`). See recheckOnce.
 */
type Warnings = { skip: readonly ReadonlySet<string>[]; shown: Set<string>; found: Set<string> }

/**
 * At the start of an interactive session, and on a timer during it, checks the folders that Allow opened and that
 * their settings file still holds. It walks the guarded places as a folder Allow does, once for all those folders, and
 * finds where the PATH folders lie. Each link or guarded place that leads into such a folder, or to a folder that holds
 * one, gives one toast, unless `warnings.skip` holds it. It warns and writes nothing. It runs outside the queue, so that
 * its walk never holds back the recording of a Bash call. It never rejects: the hook and the timer drop what it returns.
 */
async function recheckGrants($: EngineInterface, threshold: number, event: RecheckEvent, warnings: Warnings): Promise<void> {
  let entries: Granted[]
  let context: Context
  try {
    entries = await grantedEntries($)
    if (entries.length === 0) return
    context = await loadContext($, threshold, event)
  } catch (error) {
    logDebug($, diagnostic(event, null, `could not check the folders that Allow opened: ${causeOf(error)}`))
    return
  }
  const known = new Map<string, string>()
  const recheck: Recheck = { grants: [], found: [], skipped: [] }
  for (const granted of entries) {
    const path = anchorEntry(granted.entry, 'user', context)
    const place = path === null ? null : await followed($, path, known, recheck)
    if (place !== null) recheck.grants.push({ ...granted, place })
  }
  const problems: string[] = []
  if (recheck.grants.length > 0) {
    const credentials = [...context.credentialDirs, ...credentialEntries(context).map(entry => entry.path)]
    for (const walks of [guardedWalks(context.protectedDirs, context), guardedWalks(credentials, { home: undefined, configDir: undefined })]) {
      // A walk that stops keeps what it found before.
      await realGuards($, walks, known, recheck).catch((error: unknown) => problems.push(causeOf(error)))
    }
    for (const dir of context.pathDirs) {
      const place = await followed($, dir, known, recheck)
      if (place !== null) isFinding(recheck, dir, place)
    }
  }
  const display = (path: string) => displayPath(path, context.home)
  const warned = new Set<string>()
  for (const { path, place, met } of recheck.found) {
    if (warned.has(path)) continue
    warned.add(path)
    const grants = met.map(({ grant, isInside }) => ({ grant: grant.entry, isInside, hasUndo: grant.hasUndo, byHand: grant.byHand.map(file => fileInfo(file, context.home).display) }))
    const warning = grantWarning(display(path), display(place), grants)
    const isWarned = warnings.skip.some(skipped => skipped.has(warning))
    warnings.found.add(warning)
    if (isWarned) continue
    warnings.shown.add(warning)
    const text = diagnostic(event, null, warning)
    logDebug($, text)
    $.ui.toast(drawable(hostText(text)), { timeoutMs: WARNING_MS })
  }
  if (recheck.skipped.length > 0) problems.unshift(`links that it cannot follow: ${[...new Set(recheck.skipped)].map(display).join(', ')}`)
  if (problems.length > 0) {
    await noteFault($, diagnostic(event, null, `could not finish the link check of the folders that Allow opened (${problems.join('; ')}). A link that the check did not reach can still lead into one of them.`))
  }
}

// One check at a time in each module instance: `claude --resume` raises session.start and classic.SessionStart at once,
// and the timer of the session can fire during a walk. Each request waits for the check that runs or waits last.
let lastRecheck: Promise<void> = Promise.resolve()
// The number of the newest request. A request that a newer one follows before its turn does not run.
let newestRecheck = 0
// The warnings that the checks showed since the last time that no check ran or waited.
let shownWarnings = new Set<string>()
// Whether a session start asked for a check that has not begun yet: the next check to begin is then its check.
let isStartPending = false
// The warnings that the checks found since the last check of a session start began, shown or not: a timed check does
// not show them, because the session was warned about them.
let startWarnings = new Set<string>()

/**
 * Runs recheckGrants, one check at a time. A request that comes while a check runs waits, the newest only, and its
 * check runs right after that check ends, with the context that its session has then: a session that /clear,
 * /resume, or /branch starts during a walk gets a check of its own. A check that waited does not show a warning again
 * that a check before it showed, so one start warns once. A timed request (`isStart` false) shows only what the
 * session was not warned about since its start, and a session start that a timed request follows before its turn still
 * gets its check. It never rejects.
 */
async function recheckOnce($: EngineInterface, threshold: number, isStart: boolean): Promise<void> {
  newestRecheck += 1
  const request = newestRecheck
  if (isStart) isStartPending = true
  const run = async () => {
    if (request !== newestRecheck) return
    const isStartCheck = isStartPending
    isStartPending = false
    if (isStartCheck) startWarnings = new Set()
    const skip = isStartCheck ? [shownWarnings] : [shownWarnings, startWarnings]
    await recheckGrants($, threshold, isStartCheck ? 'session.start' : 'clock.every', { skip, shown: shownWarnings, found: startWarnings })
  }
  const check = lastRecheck.then(run, run)
  lastRecheck = check
  try {
    await check
  } finally {
    if (lastRecheck === check) shownWarnings = new Set()
  }
}

function changeFor(verdict: Verdict, action: SandboxTunerAction): Change | null {
  if (action === 'allow') return verdict.status === 'ready' ? verdict.allow : null
  return 'deny' in verdict ? verdict.deny : null
}

type AddEdit = { kind: 'add'; record: SandboxTunerRecord; action: SandboxTunerAction; context: Context }
type RemoveEdit = { kind: 'remove'; entry: SandboxTunerApplied }
type SettingsEdit = AddEdit | RemoveEdit

/** What a press writes over one read of the settings file: the new settings value, its journal entry, and its notice. */
type Planned = { loaded: Loaded; value: Record<string, unknown>; entry: SandboxTunerApplied; success: string } & ({ edit: AddEdit; change: Change } | { edit: RemoveEdit })

/**
 * Checks an addition against one read of the settings file: the entry, the verdict with the restrictions that the file
 * adds, and for a folder where it really lies. A check again after the file changed (`isAgain`) rates the folder with
 * the new text only: the loaded settings were rated before. Returns the new settings value with the keys that it
 * creates, `isPresent` when the file holds the entry, or why the addition stops.
 */
async function checkAddition($: EngineInterface, edit: AddEdit, change: Change, file: FileInfo, parsed: ParsedSettings, isAgain: boolean): Promise<{ value: Record<string, unknown>; created: string[] } | { isPresent: true } | { cause: string }> {
  const { record, action, context } = edit
  const added = addEntry(parsed.value, change.settingsKey, change.entry)
  if ('refusal' in added) return { cause: refusalText(added, file) }
  if ('isPresent' in added) return added
  // Keep loaded restrictions too: the engine may not have applied a removal from the file yet.
  const snapshot: Context = { ...context, sources: { ...context.sources, user: parsed.value } }
  const current = verdictOf(record, snapshot)
  if (changeFor(current, action) === null) return { cause: nothingApplied(verdictSentences(record, current, snapshot)) }
  if (record.kind === 'path') {
    for (const checked of isAgain ? [snapshot] : [context, snapshot]) {
      const problem = await checkRealFolder($, record, checked)
      if (problem !== null) return { cause: problem }
    }
  }
  return added
}

/** A time later than `time` and than each change of the same entry of the same file that the journal holds. */
function laterThanJournal(journal: readonly SandboxTunerApplied[], file: FileInfo, change: Change, time: number): number {
  return journal.reduce((later, item) => item.file === file.path && item.settingsKey === change.settingsKey && item.entry === change.entry ? Math.max(later, item.appliedAt + 1) : later, time)
}

/** Plans an edit against the first read of the settings file, or gives the result of a press that stops there. */
async function planEdit($: EngineInterface, buttonKey: string, file: FileInfo, edit: SettingsEdit, loaded: Loaded): Promise<Planned | PressResult> {
  if (edit.kind === 'add') {
    const { record, action, context } = edit
    const verdict = verdictOf(record, context)
    const change = changeFor(verdict, action)
    if (change === null) return info(nothingApplied(verdictSentences(record, verdict, context)))
    const added = await checkAddition($, edit, change, file, loaded.parsed, false)
    if ('cause' in added) return failure(buttonKey, added.cause)
    if ('isPresent' in added) return failure(buttonKey, notAppliedText(change))
    const now = await $.clock.now()
    const appliedAt = laterThanJournal(await readJournal($), file, change, now)
    const entry: SandboxTunerApplied = {
      id: `${now}:${action}:${record.key}:${crypto.randomUUID()}`,
      recordKey: record.key,
      action,
      settingsKey: change.settingsKey,
      entry: change.entry,
      file: file.path,
      backup: loaded.original === null ? null : file.backup,
      created: added.created,
      appliedAt,
      undoneAt: null,
      applyState: 'pending',
    }
    return { edit, change, loaded, value: added.value, entry, success: addedNotice(change, loaded.original !== null) }
  }
  // Undo may remove an old grant that is no longer eligible. It can only remove its journaled entry.
  const removed = removeEntry(loaded.parsed.value, edit.entry.settingsKey, edit.entry.entry, edit.entry.created)
  if ('refusal' in removed) return failure(buttonKey, refusalText(removed, file))
  const entry: SandboxTunerApplied = { ...edit.entry, applyState: undefined, undoneAt: await $.clock.now(), undoState: 'pending' }
  if ('isAbsent' in removed) return saveJournal($, { buttonKey, file, entry: { ...entry, undoState: undefined }, success: absentNotice(entry), didWrite: false })
  return { edit, loaded, value: removed.value, entry, success: removedNotice(entry, file) }
}

/**
 * Checks a planned edit again under the lock, against what another session can have saved while the press waited: for
 * an Undo the journal (undoable), and for an addition the sightings of its target (targetRecord). When those sightings
 * changed, it rates the target again with the loaded settings, a folder where it really lies too. Returns the planned
 * edit, with the fresh record, or the result of the press that the first check gives with what it finds now.
 */
async function recheckPlan($: EngineInterface, buttonKey: string, first: Planned): Promise<Planned | PressResult> {
  if (!('change' in first)) {
    const entry = undoable(await readJournal($), first.entry.id, buttonKey)
    return 'id' in entry ? first : entry
  }
  const { edit } = first
  const record = await targetRecord($, edit.record.key, buttonKey)
  if (!('key' in record)) return record
  if (JSON.stringify(record) === JSON.stringify(edit.record)) return first
  const verdict = verdictOf(record, edit.context)
  if (changeFor(verdict, edit.action) === null) return info(nothingApplied(verdictSentences(record, verdict, edit.context)))
  if (record.kind === 'path') {
    const problem = await checkRealFolder($, record, edit.context)
    if (problem !== null) return failure(buttonKey, problem)
  }
  return { ...first, edit: { ...edit, record } }
}

/**
 * Fits a planned edit to the text that another session or program saved after the press first read the file, or to
 * the fresh sightings of its target (recheckPlan): the same entry, added to or removed from what the file holds now.
 * Refuses, with the file left as it is, when the edit no longer fits. An Undo whose entry is gone is marked as undone,
 * as when the first read found it gone.
 */
async function refitEdit($: EngineInterface, buttonKey: string, file: FileInfo, planned: Planned, text: string | null): Promise<Planned | PressResult> {
  const conflict = (cause: string) => failure(buttonKey, text === planned.loaded.original ? cause : `another session or program changed ${file.display} after this press read it, and the press no longer fits the new text: ${cause}`)
  const parsed = parseSettings(text ?? '')
  if ('refusal' in parsed) return conflict(refusalText(parsed, file))
  const loaded: Loaded = { original: text, parsed }
  const { entry } = planned
  if ('change' in planned) {
    const added = await checkAddition($, planned.edit, planned.change, file, parsed, true)
    if ('cause' in added) return conflict(added.cause)
    if ('isPresent' in added) return failure(buttonKey, `another session or program added "${entry.entry}" to ${entry.settingsKey} in ${file.display} after this press read it. Nothing was written.`)
    const refitted: SandboxTunerApplied = { ...entry, backup: text === null ? null : file.backup, created: added.created }
    return { ...planned, loaded, value: added.value, entry: refitted, success: addedNotice(planned.change, text !== null) }
  }
  const removed = removeEntry(parsed.value, entry.settingsKey, entry.entry, entry.created)
  if ('refusal' in removed) return conflict(refusalText(removed, file))
  if ('isAbsent' in removed) return saveJournal($, { buttonKey, file, entry: { ...entry, undoState: undefined }, success: absentNotice(entry), didWrite: false })
  return { ...planned, loaded, value: removed.value }
}

/**
 * Under the lock (`token`): checks the planned edit again, reads the settings file again, fits the edit to what it
 * holds now, and writes it. An addition gets a time later than each change of its entry that the journal holds now, as
 * a press of another session can have saved one while this press waited for the lock.
 */
async function writeEdit($: EngineInterface, buttonKey: string, file: FileInfo, first: Planned, token: string): Promise<PressResult> {
  const checked = await recheckPlan($, buttonKey, first)
  if (!('value' in checked)) return checked
  const read = await readText($, file, buttonKey)
  if (!('found' in read)) return read
  const planned = read.found === first.loaded.original && checked === first ? first : await refitEdit($, buttonKey, file, checked, read.found)
  if (!('value' in planned)) return planned
  const { loaded, value, success } = planned
  const entry = 'change' in planned ? { ...planned.entry, appliedAt: laterThanJournal(await readJournal($), file, planned.change, planned.entry.appliedAt) } : planned.entry
  const problem = await writeSettings($, buttonKey, file, loaded.original, serializeSettings(value, loaded.parsed), entry, token)
  if (problem !== null) return problem
  return saveJournal($, { buttonKey, file, entry: { ...entry, applyState: undefined }, success, didWrite: true })
}

/**
 * Every edit checks one fresh read of the settings file first. Then it takes the lock of the file, reads it again,
 * writes the edit to what the file holds now, and frees the lock. The checks of the journal and the sightings run again
 * under the lock, the checks of the file run again when the text changed between the reads, and the unchanged-file
 * check right before the write compares with the second read.
 */
async function editSettings($: EngineInterface, buttonKey: string, file: FileInfo, edit: SettingsEdit): Promise<PressResult> {
  const loaded = await readSettingsFile($, file, buttonKey)
  if (!('parsed' in loaded)) return loaded
  const planned = await planEdit($, buttonKey, file, edit, loaded)
  if (!('value' in planned)) return planned
  const token = await takeLock($, file, buttonKey)
  if (typeof token !== 'string') return token
  try {
    return await writeEdit($, buttonKey, file, planned, token)
  } finally {
    await freeLock($, file, token, buttonKey)
  }
}

/** The saved record of a target, read again from every writer, or the result of a press that stops. */
async function targetRecord($: EngineInterface, key: string, buttonKey: string): Promise<SandboxTunerRecord | PressResult> {
  if (await read($, evidenceIncomplete)) return failure(buttonKey, 'some sightings could not be saved. Durable safety evidence is incomplete. Nothing was written.')
  return (await readRecords($, key))[0] ?? info(NOTHING_TO_CHANGE)
}

async function applyFix($: EngineInterface, threshold: number, key: string, action: SandboxTunerAction, buttonKey: string): Promise<PressResult> {
  let context: Context
  try {
    context = await loadContext($, threshold, `ui.press (${buttonKey})`)
  } catch (error) {
    return failure(buttonKey, `could not check the current settings: ${causeOf(error)}. Nothing was written.`)
  }
  const record = await targetRecord($, key, buttonKey)
  if (!('key' in record)) return record
  if (context.file === undefined) return info(nothingApplied(verdictSentences(record, verdictOf(record, context), context)))
  return editSettings($, buttonKey, context.file, { kind: 'add', record, action, context })
}

async function openPress($: EngineInterface): Promise<PressResult | null> {
  try {
    await loadSaved($, 'ui.press', 'band-open')
    const opened = await $.ui.open(PANE_OPEN)
    // A surface that places no panes keeps the pane open but undrawn: say why, or the press seems to do nothing.
    return opened.isPlaced ? null : failure('band-open', `the pane is not placed: ${opened.reason}`)
  } catch (error) {
    return failure('band-open', `could not open the pane: ${causeOf(error)}`)
  }
}

async function dismissPress($: EngineInterface, key: string): Promise<null> {
  await update($, dismissed, () => key)
  return null
}

/**
 * After a write has settled, checks that the entry is still as the press left it, then draws the band and the pane
 * again with the settings that Claude Code applied. $.fs has no conditional write, so another session that saved the
 * file at the same moment can have taken the change back. It never rejects: a timer drops what its function returns.
 */
async function confirmChange($: EngineInterface, buttonKey: string, written: Written): Promise<void> {
  const { file, entry } = written
  try {
    let journal = await readJournal($)
    if (isPressedAgain(journal, entry)) return
    journal = await reconcileJournal($, journal)
    const parsed = parseSettings((await fileText($, file.path)) ?? '')
    const probe = 'refusal' in parsed ? parsed : addEntry(parsed.value, entry.settingsKey, entry.entry)
    const isAdded = entry.undoneAt === null
    const isTakenBack = !('refusal' in probe) && 'isPresent' in probe !== isAdded
    if (isTakenBack && !isAdded) {
      const retry: SandboxTunerApplied = { ...entry, undoState: 'retry' }
      await $.store.set(JOURNAL_PREFIX + entry.id, retry)
      await update($, applied, () => journalOf([...journal.filter(item => item.id !== entry.id), retry]))
    }
    // A later press of this session that changed the entry again owns it now.
    const problem = 'refusal' in probe
      ? verificationRefusalText(probe, file)
      : isTakenBack && !isPressedAgain(journal, entry)
        ? `"${entry.entry}" is ${isAdded ? 'no longer' : 'again'} in ${entry.settingsKey} in ${file.display}: another session or program saved the file at the same moment. Press again.`
        : null
    if (problem !== null) {
      const text = diagnostic('ui.press', buttonKey, problem)
      logDebug($, text)
      // A toast reaches the person whatever is open: after a band press, the band hides once the change is in the journal.
      $.ui.toast(drawable(hostText(text)))
      const now = await $.clock.now()
      await update($, notice, () => ({ text, isError: true, at: now }))
    }
  } catch (error) {
    logDebug($, diagnostic('ui.press', buttonKey, `could not check ${file.display} after the write: ${causeOf(error)}`))
  }
  $.ui.invalidate('ui.render')
}

/** Runs one press in the module queue and shows its result. It never rejects: a Button drops what onPress returns. */
async function runPress($: EngineInterface, buttonKey: string, action: () => Promise<PressResult | null>): Promise<void> {
  const result = await enqueue(() => action().catch((error: unknown) => failure(buttonKey, causeOf(error))))
  if (result === null) return
  if (result.isError) logDebug($, result.text)
  const { written } = result
  if (written !== null) {
    $.ui.toast(drawable(hostText(result.text)))
    $.clock.after(REDRAW_AFTER_WRITE_MS, () => void enqueue(() => confirmChange($, buttonKey, written)))
  }
  try {
    const now = await $.clock.now()
    await update($, notice, () => ({ text: result.text, isError: result.isError, at: now }))
  } catch (error) {
    logDebug($, diagnostic('ui.press', buttonKey, `could not show the notice "${result.text}": ${causeOf(error)}`))
  }
}

async function readJournal($: EngineInterface): Promise<SandboxTunerApplied[]> {
  const journal: SandboxTunerApplied[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(JOURNAL_PREFIX)) continue
    const entry = await $.store.get(key)
    if (!isApplied(entry) || JOURNAL_PREFIX + entry.id !== key) throw new Error(`invalid Undo journal entry: ${key}`)
    journal.push(entry)
  }
  return journal
}

/** Reconcile uncertain edits without writing settings, including after a reload. */
async function reconcileJournal($: EngineInterface, journal: readonly SandboxTunerApplied[]): Promise<SandboxTunerApplied[]> {
  const reconciled: SandboxTunerApplied[] = []
  for (const entry of journal) {
    const isAddition = entry.applyState === 'pending'
    if (!isAddition && !isUndoUnresolved(entry)) { reconciled.push(entry); continue }
    let next: SandboxTunerApplied = isAddition ? entry : { ...entry, undoState: 'retry' }
    if (hasLaterOwner(journal, entry)) next = { ...entry, applyState: undefined, undoneAt: entry.undoneAt ?? await $.clock.now(), undoState: 'superseded' }
    else {
      try {
        const parsed = parseSettings((await fileText($, entry.file)) ?? '')
        const probe = 'refusal' in parsed ? parsed : addEntry(parsed.value, entry.settingsKey, entry.entry)
        if ('refusal' in probe) throw new Error(verificationRefusalText(probe, fileInfo(entry.file, await homeOf($))))
        if (isAddition ? 'isPresent' in probe : !('isPresent' in probe)) next = { ...entry, applyState: undefined, undoState: undefined }
      } catch (error) {
        await noteFault($, diagnostic(isAddition ? 'apply.confirm' : 'undo.confirm', entry.id, causeOf(error)))
      }
    }
    await $.store.set(JOURNAL_PREFIX + entry.id, next)
    reconciled.push(next)
  }
  await update($, applied, () => journalOf(reconciled))
  // Every entry, not only the ones that the journal keeps: a fix from another session hides the band too.
  await update($, latest, last => (last !== null && isFixedSince(reconciled, last) ? null : last))
  return reconciled
}

/** The journal entry `id` when an Undo can remove it, else the result of the press. */
function undoable(journal: readonly SandboxTunerApplied[], id: string, buttonKey: string): SandboxTunerApplied | PressResult {
  const entry = journal.find(item => item.id === id)
  if (entry === undefined || (entry.undoneAt !== null && !isUndoUnresolved(entry))) return info(NOTHING_TO_UNDO)
  return hasLaterOwner(journal, entry) ? failure(buttonKey, 'a later journal entry owns this setting. Nothing was written. Reopen the pane.') : entry
}

async function undoFix($: EngineInterface, id: string, buttonKey: string): Promise<PressResult> {
  const entry = undoable(await readJournal($), id, buttonKey)
  if (!('id' in entry)) return entry
  const file = fileInfo(entry.file, await homeOf($))
  return editSettings($, buttonKey, file, { kind: 'remove', entry })
}

async function moveApplied($: EngineInterface, delta: number): Promise<null> {
  const last = Math.max(0, (await read($, applied)).length - 1)
  await update($, appliedOffset, offset => Math.max(0, Math.min(last, Math.min(offset, last) + delta)))
  return null
}

async function setHidden($: EngineInterface, key: string, isHidden: boolean, buttonKey: string): Promise<PressResult> {
  const listed = (await read($, records)).find(record => record.key === key)
  if (listed === undefined) return info(NOTHING_TO_CHANGE)
  const target = displayTarget(listed, await homeOf($))
  try {
    const next = { ...listed, isHidden }
    await $.store.set(HIDDEN_PREFIX + key, isHidden)
    await update($, records, list => list.map(record => (record.key === key ? next : record)))
    return info(isHidden ? hiddenNotice(target) : shownNotice(target))
  } catch (error) {
    return failure(buttonKey, `could not save the hidden flag of ${target}: ${causeOf(error)}`)
  }
}

export const register: Register = (on, options) => {
  const threshold = Number(options.minimumSightings)
  // How often an interactive session checks the folders that Allow opened again. 0 turns the timed check off.
  const linkCheckMs = Number(options.linkCheckMinutes) * 60_000
  // Whether a person is at the prompt. Only session.start says so, and the process keeps it across /clear.
  let isInteractive = false
  // The timer of the timed check: one for the process, across /clear. A hot reload cancels it with the old module.
  let linkTimer: Timer | null = null
  // A hot reload runs session.start again: it registers the command again and loads the store again.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    isInteractive = e.isInteractive
    try {
      await $.command.register({ name: 'sandbox-tuner', description: COMMAND_DESCRIPTION, immediate: true })
    } catch (error) {
      await noteFault($, diagnostic('session.start', null, `could not register /sandbox-tuner: ${causeOf(error)}`))
    }
    void enqueue(() => loadSaved($, 'session.start', null))
    // Outside the queue: its walk must not hold back the recording of the first Bash calls.
    if (e.isInteractive) void recheckOnce($, threshold, true)
    // A link made during the session: the check at its start cannot see it.
    if (e.isInteractive && linkTimer === null && linkCheckMs > 0) linkTimer = $.clock.every(linkCheckMs, () => void recheckOnce($, threshold, false))
    return started
  }).catch(($, e, next) => {
    hookFailed($, 'session.start', null, next.error)
    return next(e)
  })

  // /clear, /resume, and /branch start a new session in the same process, and session.start does not fire.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await enqueue(() => loadSaved($, 'classic.SessionStart', null))
    if (isInteractive) void recheckOnce($, threshold, true)
    return next(e)
  }).catch(($, e, next) => {
    hookFailed($, 'classic.SessionStart', null, next.error)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const out = await next(e)
    // The wait for the queue counts as this hook's own time, so the job stops once the dispatch is abandoned.
    if (!next.signal.aborted) await enqueue(() => recordCall($, toCall(e), toOutcome(out), next.signal))
    return out
  }).catch(($, e, next) => {
    hookFailed($, 'tool.call', 'Bash', next.error)
    return next(e)
  })

  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const out = await next(e)
    if (!next.signal.aborted && e.command !== undefined && e.ws === undefined && out.deny === undefined && out.isError !== true && out.result.taskId !== '') {
      await enqueue(() => recordCall($, { command: e.command!, isBackground: true, isUnsandboxed: false, allowedDomains: e.allowed_domains ?? [] },
        { isDenied: false, isError: false, backgroundTaskId: out.result.taskId, text: '', stderr: '' }, next.signal, 'Monitor'))
    }
    return out
  }).catch(($, e, next) => {
    hookFailed($, 'tool.call', 'Monitor', next.error)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const last = await read($, latest)
    if (e.props.hasSurvey || last === null) return next(e)
    if (last.reason === 'operation') {
      if ((await read($, dismissed)) === last.recordKey) return next(e)
      return bandTree($.ui.resolve(e), buildObservation(last, await read($, notice)), {
        allow: () => {}, deny: () => {},
        open: () => void runPress($, 'band-open', () => openPress($)),
        dismiss: () => void runPress($, 'band-dismiss', () => dismissPress($, last.recordKey)),
      }, await next(e))
    }
    const record = (await read($, records)).find(item => item.key === last.recordKey)
    if (record === undefined || record.isHidden || (await read($, dismissed)) === last.recordKey || isFixedSince(await read($, applied), last)) return next(e)
    const context = await loadContext($, threshold, 'ui.render (AbovePrompt)')
    const model = buildBand(last, record, verdictOf(record, context), context, await read($, notice))
    const beneath: RenderElement = await next(e)
    return bandTree($.ui.resolve(e), model, {
      allow: () => void runPress($, 'band-allow', () => applyFix($, threshold, record.key, 'allow', 'band-allow')),
      deny: () => void runPress($, 'band-deny', () => applyFix($, threshold, record.key, 'deny', 'band-deny')),
      open: () => void runPress($, 'band-open', () => openPress($)),
      dismiss: () => void runPress($, 'band-dismiss', () => dismissPress($, record.key)),
    }, beneath)
  }).catch(($, e, next) => {
    hookFailed($, 'ui.render', 'AbovePrompt', next.error)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const context = await loadContext($, threshold, 'ui.render (Pane)')
    const journal = await read($, applied)
    const now = await $.clock.now()
    const model = buildPane({
      // Sightings of this session join $.state without a load, so each drawing applies the display limits again.
      rated: rateRecords(shownRecords(await read($, records), now), context),
      applied: journal,
      reformatted: await reformattedFiles($, journal, context),
      appliedOffset: await read($, appliedOffset),
      notice: await read($, notice),
      fault: await read($, fault),
      isSandboxOn: sandboxFacts(await $.settings.read()).isEnabled,
      context,
      now,
    })
    return paneTree($.ui.resolve(e), model, {
      allow: key => void runPress($, `allow:${key}`, () => applyFix($, threshold, key, 'allow', `allow:${key}`)),
      deny: key => void runPress($, `deny:${key}`, () => applyFix($, threshold, key, 'deny', `deny:${key}`)),
      hide: key => void runPress($, `hide:${key}`, () => setHidden($, key, true, `hide:${key}`)),
      unhide: key => void runPress($, `unhide:${key}`, () => setHidden($, key, false, `unhide:${key}`)),
      undo: id => void runPress($, `undo:${id}`, () => undoFix($, id, `undo:${id}`)),
      moveApplied: delta => void runPress($, delta < 0 ? 'applied-previous' : 'applied-next', () => moveApplied($, delta)),
    })
  }).catch(($, e, next) => {
    const text = hookFailed($, 'ui.render', 'Pane', next.error)
    const { Text } = $.ui.resolve(e)
    return <Text color="red" wrap="wrap">{drawable(text)}</Text>
  })

  on('command.run', { command: 'sandbox-tuner' }, async $ => {
    const loaded = await enqueue(() => loadSaved($, 'command.run', '/sandbox-tuner'))
    const prefix = typeof loaded === 'string' ? `${loaded}\n\n` : ''
    const context = await loadContext($, threshold, 'command.run (/sandbox-tuner)')
    // One dispatch reads $.state at one moment, so rate the records that the load returned.
    const now = await $.clock.now()
    const rated = rateRecords(typeof loaded === 'string' ? shownRecords(await read($, records), now) : loaded, context)
    const report = reportText(rated, context, sandboxFacts(await $.settings.read()).isEnabled, now)
    // A cause from the engine can hold characters that a transcript row must not show.
    if ((await $.session.surfaces()).length === 0) return { text: hostText(plainText(`${prefix}${report}`)) }
    try {
      const opened = await $.ui.open(PANE_OPEN)
      return { text: hostText(plainText(opened.isPlaced ? `${prefix}${summaryLine(rated)}` : `${prefix}${report}\n\n${notPlaced(opened.reason)}`)) }
    } catch (error) {
      const text = diagnostic('command.run', '/sandbox-tuner', `could not open the pane: ${causeOf(error)}`)
      logDebug($, text)
      return { text: hostText(plainText(`${text}\n\n${report}`)) }
    }
  }).catch(($, _e, next) => ({ text: hostText(plainText(hookFailed($, 'command.run', '/sandbox-tuner', next.error))) }))
}
