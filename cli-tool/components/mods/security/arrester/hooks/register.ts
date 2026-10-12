// Arrester's hooks module: every hook and every `$` call. It keeps the journal
// in `$.state`, reads the session and the file system through `$`, and leaves
// every decision about paths and words to the pure modules.

import { atom, read, update } from 'claude-code'
import type { Caught, EngineInterface, EventName, EventResult, FsStat, Hook, PluginOptions, Register, Timer, TraceOutcome } from 'claude-code'

import { analyzeCall, envelopeCall, inputCall } from './analyze/call'
import type { Call } from './analyze/call'
import { basenameOf, dirnameOf, joinPath } from './analyze/paths'
import { OPAQUE } from './analyze/shell'
import type { Effect, Io, ScriptRead } from './analyze/types'
import { fixedGuards, hookPaths, SETTINGS_SOURCES } from './guards'
import { cleared, EMPTY_JOURNAL, isRecorded, isTargetFolder, nextClose, openBlocks, pruned, renewed, targetsOf, withBlock, withDecision, withHeld, withoutHeld } from './journal'
import { blocksOf, findings, renewable } from './match'
import type { Finding } from './match'
import { ALLOW_ONCE, ARGUMENT_HINT, blockOfText, causeOf, clearedText, clearRefused, COMMAND_DESCRIPTION, commandFailed, couldNotCheck, couldNotReadScript, couldNotReadSettings, couldNotRecord, couldNotRegister, couldNotResolve, couldNotSave, couldNotSync, decisionLine, evictionNotice, historyText, retryNotice, DENY, denyReason, failureOf, hasVerdict, HEADER, heldReason, holdEnded, holdUnanswered, homeUnset, hostText, incompleteCapture, hookFailedNoBlock, noVerdict, notCounted, phrase, question, statusLine, statusText, storedReason, summarize, uncheckedReason, USAGE, viewOf } from './text'
import type { ArresterAction, ArresterGuard, ArresterJournal, ArresterSource } from '../types/index'

/** The journal, the one `$.state` value. */
const JOURNAL = atom({ plugin: 'arrester', key: 'journal' } as const, EMPTY_JOURNAL)

/** The most filesystem placements in flight at once. */
const PLACEMENT_WORKERS = 8

/** The last known block state, used when re-entry forbids engine calls. */
let hasOpenBlocks: boolean | undefined

/** The origins whose `/arrester clear` is the user's own: the terminal, Remote Control, and the SDK host. */
const USER_ORIGINS = new Set(['composer', 'bridge', 'sdk'])

/** The longest script Arrester reads, in bytes. */
const MAX_SCRIPT = 262_144

/** The options as Arrester reads them. */
type Config = { response: 'deny' | 'hold'; minutes: number }

/** The arguments of a hook on event `N`. */
type HookArgs<N extends EventName> = Parameters<Hook<N>>

/** Where a path lands, and the kind of what is there when it exists. */
type Placement = { real?: string; kind?: FsStat['kind'] }

/** A path to place, and whether it names the entry itself. */
type PlaceValue = { path: string; entry?: true }

/** Placements by `placeKey`. */
type Placements = Map<string, Placement>

/** A `classic.PreToolUse` dispatch that Arrester passed on: the call as that event carried it, and the deny that settled beneath, if one did. */
type PassedPreToolUse = { call: Call; deny: string | undefined }

/** The most passed `classic.PreToolUse` dispatches kept for their `tool.call` hook; past it the oldest goes. */
const MAX_PASSED = 64

/** The passed `classic.PreToolUse` dispatches by tool use id, oldest first; the `tool.call` hook of the same call reads and drops each one. */
const passedPreToolUses = new Map<string, PassedPreToolUse>()

/** The timer that refreshes the status line at the next close; a reload drops it with the old module. */
let timer: Timer | undefined

/** How many syncs this module started: only the newest draws the status line and sets the timer, and the end of the session stops every sync in flight. */
let syncs = 0

/** Whether this module load reported that HOME is not set. */
let isHomeReported = false

/** Wires every hook. */
export const register: Register = (on, options) => {
  const config = configOf(options)

  on('session.start', async ($, e, next) => {
    await registerCommand($)
    await sync($, config, 'session.start', true)
    return next(e)
  })

  on('session.end', ($, e, next) => {
    syncs += 1
    timer?.cancel()
    timer = undefined
    $.ui.status(undefined)
    return next(e)
  })

  on('classic.PreToolUse', async ($, e, next) => {
    const passed = passPreToolUse(envelopeCall(e))
    try {
      return await next(e)
    } finally {
      passed.deny = settledOf(next.trace)?.deny
    }
  }).catch(($, e, next) => {
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      const verdict = settledOf(next.trace)
      if (verdict?.decision === 'deny' && verdict.rule !== undefined && e.tool_use_id !== undefined) await recordBlock($, config, 'tool.check', inputCall(e.tool, e.input, e.tool_use_id, e.agentId), 'rule', verdict.reason ?? verdict.rule, verdict.rule, next.signal)
      else if (verdict?.decision === 'deny' && verdict.rule === undefined && verdict.hook === 'PreToolUse' && e.tool_use_id !== undefined && !passedPreToolUses.has(e.tool_use_id)) await recordBlock($, config, 'tool.check', inputCall(e.tool, e.input, e.tool_use_id, e.agentId), 'hook', verdict.reason ?? 'denied', undefined, next.signal)
    }
  }).catch(($, e, next) => {
    if (next.error.kind === 're-entry') return next(e)
    $.ui.log(hostText(couldNotRecord('tool.check', e.tool, failureOf(next.error))))
    return next(e)
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    if (hasVerdict(e.reason)) await recordBlock($, config, 'classic.PermissionDenied', inputCall(e.tool_name, e.tool_input, e.tool_use_id), 'classifier', e.reason, undefined, next.signal)
    else $.ui.log(noVerdict(e.reason), { to: 'debug' })
    return next(e)
  }).catch(($, e, next) => {
    if (next.error.kind === 're-entry') return next(e)
    $.ui.log(hostText(couldNotRecord('classic.PermissionDenied', e.tool_name, failureOf(next.error))))
    return next(e)
  })

  on('tool.call', ($, e, next) => checkCall($, config, e, next)).catch(($, e, next) => checkFailed($, config, e, next))

  on('command.run', { command: 'arrester' }, ($, e) => runCommand($, config, e)).catch(($, e, next) => ({ text: hostText(commandFailed(failureOf(next.error))) }))
}

/** The options the engine validated against plugin.json. */
function configOf(options: PluginOptions): Config {
  return { response: options.response === 'hold' ? 'hold' : 'deny', minutes: Number(options.block_minutes) }
}

/** Drops expired blocks, and after a reload the held calls, with a transcript line for each; redraws the status line; sets the timer for the next close. A sync that a newer one or the end of the session overtook draws nothing. A failure is logged to the debug log. */
async function sync(engine: EngineInterface, config: Config, event: string, dropHeld = false): Promise<void> {
  syncs += 1
  const ticket = syncs
  try {
    const now = await engine.clock.now()
    const before = await read(engine, JOURNAL)
    const journal = pruned(before, now, config.minutes, dropHeld) === before ? before : await update(engine, JOURNAL, value => pruned(value, now, config.minutes, dropHeld))
    if (dropHeld) for (const held of before.held) engine.ui.log(hostText(holdEnded(held)))
    if (ticket !== syncs) return
    hasOpenBlocks = journal.blocks.length > 0
    engine.ui.status(statusLine(journal.blocks.length, journal.held.length, journal.eviction?.blockId))
    timer?.cancel()
    const due = nextClose(journal, config.minutes)
    timer = due === undefined ? undefined : engine.clock.after(Math.max(1, due - now), () => void sync(engine, config, 'clock.after'))
  } catch (error) {
    engine.ui.log(couldNotSync(event, causeOf(error)), { to: 'debug' })
  }
}

/** Opens a block for a call that a guard blocked, with its targets and the guard list placed on the file system; a recursive read whose root is a regular file counts as a read of that file, and a `fullSearch` whose root is a folder as a read of the folder, unless `isTargetFolder` spares it or the reason names another tool to use. Another recursive read of a folder, such as a filtered search, `cp -r`, `rsync`, `tar`, or `diff -r`, records no folder. Every script on disk counts as older than the block, and an older interpreter script is not scanned. A call opens one block, also when that block was cleared since. */
async function recordBlock(engine: EngineInterface, config: Config, event: string, call: Call, source: ArresterSource, reason: string, rule: string | undefined, signal: AbortSignal): Promise<void> {
  const toolUseId = call.toolUseId
  if (toolUseId === undefined || isRecorded(await read(engine, JOURNAL), toolUseId)) return
  const home = await homeOf(engine, event)
  const cwd = await engine.session.cwd()
  const analysis = await analyzeCall(call, { cwd, home }, ioOf(engine, event, signal, Number.POSITIVE_INFINITY, true))
  if (signal.aborted) return
  const roots = await placeAll(engine, analysis.effects.filter(isSearchRoot), event, signal)
  const guards = await guardPaths(engine, event, home, cwd)
  const isFolderSearch = (effect: Effect): boolean => effect.fullSearch === true && isSearchRoot(effect) && roots.get(placeKey(effect))?.kind === 'dir'
  const spared = analysis.effects.some(isFolderSearch) ? await sparedPaths(engine, event, signal, [home, cwd, await engine.session.root()], guards) : []
  const effects = analysis.effects.map(effect => {
    const found = isSearchRoot(effect) ? roots.get(placeKey(effect)) : undefined
    const isTarget = found?.kind === 'file' || (found !== undefined && isFolderSearch(effect) && isTargetFolder(found.real === undefined ? [effect.path] : [effect.path, found.real], spared, reason))
    return isTarget ? { ...effect, recursive: false } : effect
  })
  const named = targetsOf(effects)
  const unplaced = named.filter(target => !roots.has(placeKey(target)))
  const rest = await placeAll(engine, unplaced, event, signal)
  const targets = withPlacements(named, new Map([...roots, ...rest]))
  if (signal.aborted) return
  const at = await engine.clock.now()
  const turn = await engine.session.turns()
  const draft = { source, agentId: call.agentId, incomplete: analysis.opaque, tool: call.tool, summary: summarize(call), reason: storedReason(reason), ...(rule === undefined ? {} : { rule }), toolUseId, turn, at, exact: analysis.exact, skeleton: analysis.skeleton, flags: analysis.flags, segments: analysis.segments, targets }
  let opened = false
  const saved = await update(engine, JOURNAL, journal => {
    const updated = withBlock(journal, draft, guards, config.minutes)
    opened = updated !== journal
    return updated
  })
  if (opened && saved.eviction?.toolUseId === toolUseId) engine.ui.log(hostText(evictionNotice(event, saved.eviction.blockId)))
  const captured = saved.blocks.find(block => block.toolUseId === toolUseId)
  if (opened && captured?.retryLimited !== undefined) engine.ui.log(hostText(retryNotice(event, captured.id, captured.retryLimited)))
  hasOpenBlocks = true
  if (opened && analysis.opaque !== undefined) engine.ui.log(hostText(incompleteCapture(event, analysis.opaque)))
  await sync(engine, config, event)
}

/** The guards, placed on the file system: the fixed ones and each regular file that a command hook names, a relative name read in the session folder `cwd` and in the project folder. Working folders and paths whose kind is unknown add no guard. A settings source that cannot be read adds none and is logged. */
async function guardPaths(engine: EngineInterface, event: string, home: string | undefined, cwd: string): Promise<ArresterGuard[]> {
  const root = await engine.session.root()
  const fixed = fixedGuards(home, root, engine.plugin.root)
  const named = new Set<string>()
  for (const source of SETTINGS_SOURCES) {
    try {
      for (const path of hookPaths(await engine.settings.read({ source }), home, root, cwd)) if (!fixed.some(guard => guard.path === path)) named.add(path)
    } catch (error) {
      engine.ui.log(couldNotReadSettings(event, source, causeOf(error)), { to: 'debug' })
    }
  }
  const placedFixed = await Promise.all(fixed.map(async guard => withReal(guard, (await place(engine, event, guard.path)).real)))
  const placedNamed = await Promise.all([...named].map(async path => ({ path, ...(await place(engine, event, path)) })))
  return [...placedFixed, ...placedNamed.filter(found => found.kind === 'file').map(found => withReal({ path: found.path }, found.real))]
}

/** The paths that a folder target may not be or hold: each of `folders`, such as the home, session, and project folders, and each guard, also by its real path. */
async function sparedPaths(engine: EngineInterface, event: string, signal: AbortSignal, folders: readonly (string | undefined)[], guards: readonly ArresterGuard[]): Promise<string[]> {
  const values = folders.flatMap(path => (path === undefined ? [] : [{ path }]))
  const placed = withPlacements(values, await placeAll(engine, values, event, signal))
  return [...placed, ...guards].flatMap(value => (value.real === undefined ? [value.path] : [value.path, value.real]))
}

/** Where a path lands and what is there: its own real path and kind when it exists, also for a removed entry that is no symbolic link, so a case alias lands on the name on disk; for a removed link, a missing path, or an entry the file system refuses, its folder's real path plus its name; nothing when neither exists, or when the file system refuses the folder, which is logged to the debug log. */
async function place(engine: EngineInterface, event: string, path: string, entry = false): Promise<Placement> {
  if (entry) {
    try {
      const own = await engine.fs.stat(path, { resolve: true })
      if (!own.isLink && own.realPath !== undefined) return { real: own.realPath, kind: own.kind }
    } catch {
      // A missing entry, or one the file system refuses, is placed by its folder below.
    }
  }
  try {
    if (!entry && await engine.fs.exists(path)) {
      const stat = await engine.fs.stat(path, { resolve: true })
      return { real: stat.realPath, kind: stat.kind }
    }
    const folder = dirnameOf(path)
    if (folder === path || !(await engine.fs.exists(folder))) return {}
    const real = (await engine.fs.stat(folder, { resolve: true })).realPath
    return real === undefined ? {} : { real: joinPath(real, basenameOf(path)) }
  } catch (error) {
    engine.ui.log(couldNotResolve(event, path, causeOf(error)), { to: 'debug' })
    return {}
  }
}

/** The value with its real path added when the file system gave one that differs. */
function withReal<T extends { path: string }>(placed: T, real: string | undefined): T & { real?: string } {
  return real === undefined || real === placed.path ? placed : { ...placed, real }
}

/** The home folder from `HOME`, which expands `~`; when it is not set, the debug log says so once per module load. */
async function homeOf(engine: EngineInterface, event: string): Promise<string | undefined> {
  const home = await engine.env.get('HOME')
  if (home !== undefined && home !== '') return home
  if (!isHomeReported) {
    isHomeReported = true
    engine.ui.log(homeUnset(event), { to: 'debug' })
  }
  return undefined
}

/** The I/O the analysis may do: read the script a call runs, judged against `since`, and see the dispatch end; `capture` when it records a block. */
function ioOf(engine: EngineInterface, event: string, signal: AbortSignal, since: number, capture = false): Io {
  const io: Io = { readScript: path => readScript(engine, event, path, since), signal }
  return capture ? { ...io, capture } : io
}

/** A script for the analysis: `missing`; its text when it is a regular file of at most MAX_SCRIPT bytes; else why it cannot be read, with a debug line for a refused read or a path that is no regular file. `isOld` when the file last changed before `since`. */
async function readScript(engine: EngineInterface, event: string, path: string, since: number): Promise<ScriptRead> {
  let isOld = false
  let cause: string
  try {
    if (!(await engine.fs.exists(path))) return 'missing'
    const stat = await engine.fs.stat(path)
    isOld = stat.mtimeMs < since
    if (stat.kind === 'file') return stat.size > MAX_SCRIPT ? { unreadable: OPAQUE.scriptTooLong, isOld } : { text: await engine.fs.read(path), isOld }
    cause = `it is not a regular file but ${stat.kind}`
  } catch (error) {
    cause = causeOf(error)
  }
  engine.ui.log(couldNotReadScript(event, path, cause), { to: 'debug' })
  return { unreadable: OPAQUE.scriptUnreadable, isOld }
}

/** Keeps a `classic.PreToolUse` dispatch as it starts, in place of an older one of the same call, for the `tool.call` hook of its call, and returns its entry, whose deny the dispatch sets once it settles; a call without a tool use id is not kept. */
function passPreToolUse(call: Call): PassedPreToolUse {
  const passed: PassedPreToolUse = { call, deny: undefined }
  if (call.toolUseId === undefined) return passed
  passedPreToolUses.delete(call.toolUseId)
  passedPreToolUses.set(call.toolUseId, passed)
  for (const id of passedPreToolUses.keys()) {
    if (passedPreToolUses.size <= MAX_PASSED) break
    passedPreToolUses.delete(id)
  }
  return passed
}

/** What the links beneath a hook settled to, read from its trace, nearest first: the answer of the first link whose own answer stood; nothing when a link rejected or none settled. */
function settledOf<O>(trace: readonly { readonly outcome: TraceOutcome; readonly returned: O | undefined }[]): O | undefined {
  for (const entry of trace) {
    if (entry.outcome === 'rejected') return undefined
    if ((entry.outcome === 'returned' || entry.outcome === 'caught') && entry.returned !== undefined) return entry.returned
  }
  return undefined
}

/** Opens a block when the hooks beneath Arrester's `classic.PreToolUse` hook denied the call, once the call settled; a block that cannot be recorded is logged to the transcript, and the deny stands. */
async function observePreToolUse(engine: EngineInterface, config: Config, toolUseId: string | undefined, signal: AbortSignal): Promise<void> {
  const passed = toolUseId === undefined ? undefined : passedPreToolUses.get(toolUseId)
  if (toolUseId === undefined || passed === undefined) return
  passedPreToolUses.delete(toolUseId)
  const deny = passed.deny
  if (typeof deny !== 'string') return
  try {
    await recordBlock(engine, config, 'classic.PreToolUse', passed.call, 'hook', deny, undefined, signal)
  } catch (error) {
    engine.ui.log(hostText(couldNotRecord('classic.PreToolUse', passed.call.tool, `throw: ${causeOf(error)}`)))
  }
}

/** Opens a block when a call's result says a guard blocked it: a deny beneath Arrester's `classic.PreToolUse` hook, the user's rejection, or the text a hook or the classifier left. */
async function observe(engine: EngineInterface, config: Config, call: Call, result: EventResult<'tool.call'>, signal: AbortSignal): Promise<void> {
  await observePreToolUse(engine, config, call.toolUseId, signal)
  if (result.isError !== true || typeof result.text !== 'string') return
  const block = blockOfText(result.text)
  if (block !== undefined) await recordBlock(engine, config, 'tool.call', call, block.source, block.reason, undefined, signal)
}

/** The `tool.call` hook: stops or holds a workaround of an open block; passes every other call on and reads its result. A path that an MCP call names is marked when it is a folder that exists. A dispatch abandoned during the check goes no further. */
async function checkCall(engine: EngineInterface, config: Config, input: HookArgs<'tool.call'>[1], forward: HookArgs<'tool.call'>[2]): Promise<EventResult<'tool.call'>> {
  const journal = await read(engine, JOURNAL)
  const now = await engine.clock.now()
  const open = openBlocks(journal, now, config.minutes)
  hasOpenBlocks = open.length > 0
  const call = envelopeCall(input)
  if (open.length > 0) {
    const since = Math.min(...open.map(block => block.at))
    const analysis = await analyzeCall(call, { cwd: await engine.session.cwd(), home: await homeOf(engine, 'tool.call') }, ioOf(engine, 'tool.call', forward.signal, since))
    if (analysis.ignored !== undefined) engine.ui.log(notCounted(analysis.ignored), { to: 'debug' })
    const placements = await placeAll(engine, analysis.effects, 'tool.call', forward.signal)
    const placed = withPlacements(analysis.effects, placements).map(effect => (effect.kind === 'name' && placements.get(placeKey(effect))?.kind === 'dir' ? { ...effect, folder: true as const } : effect))
    if (forward.signal.aborted) return abandoned()
    const found = findings(open, journal.guards, analysis, placed, call.tool)
    const [first] = found
    if (first !== undefined && config.response === 'hold') return hold(engine, config, input, forward, call, found, first, now)
    if (first !== undefined) return stop(engine, config, call, found, first, now)
  }
  if (forward.signal.aborted) return abandoned()
  const result = await forward(input)
  await observe(engine, config, call, result, forward.signal)
  return result
}

/** The `.catch` handler of the `tool.call` hook: replays a call that had settled and reports the block it could not record; refuses the call while blocks are open; passes it on while none is. */
async function checkFailed(engine: EngineInterface, config: Config, input: HookArgs<'tool.call'>[1], forward: HookArgs<'tool.call'>[2] & Caught): Promise<EventResult<'tool.call'>> {
  if (forward.error.kind === 're-entry') return hasOpenBlocks === false ? forward(input) : { deny: uncheckedReason('re-entry prevents checking this call') }
  const failure = failureOf(forward.error)
  const tool = String(input.tool)
  if (forward.called) {
    engine.ui.log(hostText(couldNotRecord('tool.call', tool, failure)))
    return forward(input)
  }
  const open = await openCount(engine, config)
  if (open.count === 0) {
    engine.ui.log(hookFailedNoBlock(failure), { to: 'debug' })
    return forward(input)
  }
  engine.ui.log(hostText(couldNotCheck(tool, failure, open.count, open.cause)))
  return { deny: uncheckedReason(failure) }
}

/** The answer to a dispatch that was abandoned, which goes no further: nobody reads it, since the dispatch went on without this hook. */
function abandoned(): { deny: string } {
  return { deny: uncheckedReason(OPAQUE.interrupted) }
}

/** Places every distinct path and entry mode once, with bounded concurrency, and returns each placement by `placeKey`. */
async function placeAll(engine: EngineInterface, values: readonly PlaceValue[], event: string, signal: AbortSignal): Promise<Placements> {
  const unique = [...new Map(values.map(value => [placeKey(value), value])).entries()]
  const placements: Placements = new Map()
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(PLACEMENT_WORKERS, unique.length) }, async () => {
    while (cursor < unique.length && !signal.aborted) {
      const [key, value] = unique[cursor++]!
      const placement = await place(engine, event, value.path, value.entry)
      placements.set(key, placement)
    }
  }))
  return placements
}

/** The values, each with the real path of its placement when the file system gave one that differs. */
function withPlacements<T extends PlaceValue>(values: readonly T[], placements: Placements): (T & { real?: string })[] {
  return values.map(value => withReal(value, placements.get(placeKey(value))?.real))
}

/** The key of a path and its entry mode among placements. */
function placeKey(value: PlaceValue): string {
  return `${value.path}\0${value.entry === true}`
}

/** A recursive read of a plain path, with no glob and no find selection: a search that names its root. */
function isSearchRoot(effect: Effect): boolean {
  return effect.kind === 'read' && effect.recursive && effect.glob === undefined && effect.selection === undefined
}

/** Refuses a workaround: renews the blocks that a target or retry finding names, records the decision, and answers the reason Claude reads. */
async function stop(engine: EngineInterface, config: Config, call: Call, found: readonly Finding[], first: Finding, now: number): Promise<{ deny: string }> {
  await decide(engine, config, call, { action: 'stopped', blockIds: blocksOf(found).map(block => block.id), detail: phrase(first), now }, journal => renewed(journal, renewable(found), now))
  return { deny: denyReason(found, now) }
}

/** Runs a journal write for a stop or a hold; a write that fails is logged to the transcript, and what Arrester does to the call stands. */
async function saving(engine: EngineInterface, call: Call, action: string, write: () => Promise<unknown>): Promise<void> {
  try {
    await write()
  } catch (error) {
    engine.ui.log(hostText(couldNotSave(call.tool, action, causeOf(error))))
  }
}

/** A decision about a call: what Arrester did, the blocks it was for, its detail, and when the check that led to it ran. */
type Decided = { action: Exclude<ArresterAction, 'cleared'>; blockIds: string[]; detail: string; now: number }

/** Records a decision after `change` in one write, logs its transcript line, and redraws the status line; a failed write is logged, and the transcript line still says what Arrester did. */
async function decide(engine: EngineInterface, config: Config, call: Call, decided: Decided, change: (journal: ArresterJournal) => ArresterJournal): Promise<void> {
  const view = viewOf(call)
  const { action, blockIds, detail, now } = decided
  await saving(engine, call, action, async () => {
    const decision = { at: await engine.clock.now(), action, blockIds, call: view, detail }
    await update(engine, JOURNAL, journal => withDecision(change(journal), decision))
  })
  engine.ui.log(decisionLine({ at: now, action, blockIds, call: view, detail }, view))
  await sync(engine, config, 'tool.call')
}

/** Counts open blocks, retaining the cause when the journal or clock cannot be read. */
async function openCount(engine: EngineInterface, config: Config): Promise<{ count?: number; cause?: string }> {
  try {
    return { count: openBlocks(await read(engine, JOURNAL), await engine.clock.now(), config.minutes).length }
  } catch (error) {
    return { cause: causeOf(error) }
  }
}

/** Holds a workaround for the user: asks, runs the call through the guards once on "Allow once", and refuses it on any other answer or none. */
async function hold(engine: EngineInterface, config: Config, input: HookArgs<'tool.call'>[1], forward: HookArgs<'tool.call'>[2], call: Call, found: readonly Finding[], first: Finding, now: number): Promise<EventResult<'tool.call'>> {
  const ids = blocksOf(found).map(block => block.id)
  const id = input.tool_use_id
  const ended = (journal: ArresterJournal): ArresterJournal => withoutHeld(journal, id)
  await saving(engine, call, 'held', () => update(engine, JOURNAL, journal => withHeld(renewed(journal, renewable(found), now), { ...viewOf(call), toolUseId: id, blockIds: ids, since: now })))
  await sync(engine, config, 'tool.call')
  let answer: string
  try {
    answer = await Promise.race([engine.ui.ask(question(call, first, now), { options: [DENY, ALLOW_ONCE], header: HEADER }), aborted(forward.signal)])
  } catch (error) {
    const cause = causeOf(error)
    engine.ui.log(holdUnanswered(cause), { to: 'debug' })
    await decide(engine, config, call, { action: 'unanswered', blockIds: ids, detail: cause, now }, ended)
    return { deny: heldReason({ kind: 'unanswered', cause }, found, now) }
  }
  if (answer !== ALLOW_ONCE) {
    await decide(engine, config, call, { action: 'refused', blockIds: ids, detail: answer, now }, ended)
    return { deny: heldReason(answer === DENY ? { kind: 'refused' } : { kind: 'typed', text: answer }, found, now) }
  }
  await decide(engine, config, call, { action: 'allowed-once', blockIds: ids, detail: ALLOW_ONCE, now }, ended)
  if (forward.signal.aborted) return abandoned()
  const result = await forward(input)
  await observe(engine, config, call, result, forward.signal)
  return result
}

/** A promise that rejects when the dispatch is abandoned, so a hold stops waiting. */
function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const end = (): void => reject(new Error('the call was interrupted'))
    if (signal.aborted) end()
    else signal.addEventListener('abort', end, { once: true })
  })
}

/** Declares `/arrester` to run at once, even while a turn is in flight; a failure is logged to the transcript, and Arrester keeps checking calls. */
async function registerCommand(engine: EngineInterface): Promise<void> {
  try {
    await engine.command.register({ name: 'arrester', description: COMMAND_DESCRIPTION, argumentHint: ARGUMENT_HINT, immediate: true })
  } catch (error) {
    engine.ui.log(hostText(couldNotRegister(causeOf(error))))
  }
}

/** `/arrester`: the status text, or `clear` from the user's own origins. */
async function runCommand(engine: EngineInterface, config: Config, input: HookArgs<'command.run'>[1]): Promise<{ text: string }> {
  const [verb, id, ...extra] = input.args.split(/\s+/).filter(word => word !== '')
  const now = await engine.clock.now()
  if (verb === undefined || (verb === 'status' && id === undefined)) {
    const journal = await read(engine, JOURNAL)
    return { text: statusText(journal, openBlocks(journal, now, config.minutes), config.response, config.minutes, now) }
  }
  if (verb === 'history' && extra.length === 0) {
    const page = id === undefined ? 1 : /^[1-5]$/.test(id) ? Number(id) : 0
    return { text: historyText(await read(engine, JOURNAL), page, now) }
  }
  if (verb !== 'clear' || extra.length > 0) return { text: USAGE }
  if (!USER_ORIGINS.has(input.origin.kind)) return { text: clearRefused(input.origin.kind) }
  let closed: string[] = []
  await update(engine, JOURNAL, journal => {
    const result = cleared(journal, id, now, config.minutes)
    closed = result.closed
    return result.journal
  })
  await sync(engine, config, 'command.run')
  return { text: clearedText(closed, id) }
}
