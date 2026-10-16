// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, MatchedHook, Register } from 'claude-code'

import type {
  SubagentTunerChoice as Choice,
  SubagentTunerMode as Mode,
  SubagentTunerPending as Pending,
  SubagentTunerQueue,
  SubagentTunerSettings,
} from '../types'
import {
  EFFORT_OPTIONS,
  MODEL_OPTIONS,
  MORE_EFFORT_OPTIONS,
  MORE_MODEL_OPTIONS,
  fieldQuestion,
  headerFor,
  mainDialog,
  readField,
  readMain,
} from './dialog'
import { INHERIT_VALUE, paneView } from './pane-view'
import {
  FORK_TYPE,
  INHERIT,
  describeChoice,
  autoPatch,
  hasOpenField,
  hasOwnDefinition,
  isJudgedByName,
  presetFor,
  recommend,
  resolveDefault,
} from './recommend'
import {
  DEFAULT_MODE,
  STORE_MODE,
  STORE_SAVED,
  asDefault,
  cycleField,
  parseChoice,
  parseMode,
  patched,
  withPending,
  without,
} from './state'
import type { Field } from './state'
import { rowsLeft, stacked } from './stack'
import { MIN_COLUMNS, bandView } from './view'
import type { Actions } from './view'

/** How long after a launch a stalled save of the default is waited for. */
export const SAVE_WAIT_MS = 2_000

/** The longest a pick pane is waited for: `$.process.run` takes ten minutes at most (d.ts). */
export const PANE_WAIT_MS = 600_000

/** Every pane of the tuner starts with this, so a reload can find the stale ones. */
export const PANE_PREFIX = 'subagent-tuner-'

const PANE_ROWS = 9

const settings = atom(
  { plugin: 'subagent-tuner', key: 'settings' } as const,
  { mode: DEFAULT_MODE, saved: null, hydrated: false } satisfies SubagentTunerSettings,
)

const queue = atom({ plugin: 'subagent-tuner', key: 'queue' } as const, {
  items: [],
} satisfies SubagentTunerQueue)

type Host = EngineInterface
type AgentHook = MatchedHook<'tool.call', { readonly tool: 'Agent' }>
type AgentCall = Parameters<AgentHook>[1]
type AgentNext = Parameters<AgentHook>[2]
type Patch = Partial<Pick<AgentCall, 'model' | 'effort'>>

// This module holds every call on `$`: the loader follows `$` only within
// one file, so the siblings are pure (logic, the dialog's words, the view).

/** What the store holds; a bad stored value counts as unset. */
async function stored($: Host) {
  const [mode, saved] = await Promise.all([$.store.get(STORE_MODE), $.store.get(STORE_SAVED)])

  // An empty default (both fields inherited) is no default.
  return { mode: parseMode(mode, DEFAULT_MODE), saved: asDefault(parseChoice(saved)) }
}

// Loaded once: the reducer keeps what is already there, so a load that lost a
// race to a write (or to another load) changes nothing.
async function ensureHydrated($: Host): Promise<void> {
  if ((await read($, settings)).hydrated) {
    return
  }

  const loaded = await stored($)

  await update($, settings, current => (current.hydrated ? current : { ...loaded, hydrated: true }))
}

// Store writes are versioned per key, never queued behind one another. Each
// click bumps the version and writes the state as it stands when the write
// runs; a write that lands after a newer click writes again, so an earlier
// $.store.set that finishes late cannot leave the store disagreeing with the
// band, and one that never finishes holds nothing back. The click waits for its
// write only for SAVE_WAIT_MS and says when a save is stuck. A store that
// refuses a write is said, since the setting would otherwise vanish quietly; a
// state that cannot be read rejects the click that asked. (The versions are a
// module variable: a hot reload resets them, which only drops the repair of a
// write already in flight.)
const versions = new Map<string, number>()
const WHAT: Record<string, string> = { [STORE_MODE]: 'the mode', [STORE_SAVED]: 'the default' }

async function persistLatest($: Host, key: string, current: () => Promise<unknown>): Promise<void> {
  versions.set(key, (versions.get(key) ?? 0) + 1)

  const write = (async (): Promise<void> => {
    let written = -1

    while (written !== versions.get(key)) {
      written = versions.get(key) ?? 0

      const value = await current()

      try {
        await $.store.set(key, value)
      } catch (error) {
        $.ui.toast(`Subagent tuner: could not save (${error instanceof Error ? error.message : 'store error'})`)

        return
      }
    }
  })()
  const stop = new AbortController()
  const isStuck = await Promise.race([
    write.then(() => false),
    $.clock.sleep(SAVE_WAIT_MS, { signal: stop.signal }).then(
      () => true,
      () => false,
    ),
  ])

  stop.abort()

  if (isStuck) {
    // Whatever the write does later, the click has been answered.
    write.catch(() => undefined)
    $.ui.toast(`Subagent tuner: saving ${WHAT[key] ?? 'a setting'} is taking too long`)
  }
}

async function setMode($: Host, mode: Mode): Promise<void> {
  await ensureHydrated($)
  await update($, settings, current => ({ ...current, mode }))
  await persistLatest($, STORE_MODE, async () => (await read($, settings)).mode)
}

async function changeSaved($: Host, change: (saved: Choice | null) => Choice | null): Promise<void> {
  await ensureHydrated($)
  await update($, settings, current => ({ ...current, saved: asDefault(change(current.saved)) }))
  await persistLatest($, STORE_SAVED, async () => (await read($, settings)).saved)
}

const actionsFor = ($: Host): Actions => ({
  setMode: mode => setMode($, mode),
  cycle: (field: Field) => changeSaved($, saved => cycleField(saved, field)),
  reset: () => changeSaved($, () => null),
})

// The call's model and effort are the tool's own literal unions; the tuner
// holds them as plain strings it checked against the same names.
const asPatch = (patch: { model?: string; effort?: string }): Patch => patch as Patch
const asCall = (call: object): AgentCall => call as AgentCall

/** The call with exactly the selection's model and effort. */
function selected(e: AgentCall, choice: Choice): object {
  const { model: _model, effort: _effort, ...rest } = e

  return {
    ...rest,
    ...(choice.model === null ? {} : { model: choice.model }),
    ...(choice.effort === null ? {} : { effort: choice.effort }),
  }
}

// Manual: the selection is the whole answer, so the call's own value is replaced
// by it, and inherit removes the field from the call.
function applySelection($: Host, e: AgentCall, next: AgentNext, choice: Choice, label: string) {
  if (choice.model !== (e.model ?? null) || choice.effort !== (e.effort ?? null)) {
    $.ui.toast(`${label} -> ${describeChoice(choice)}`)
  }

  return next(asCall(selected(e, choice)))
}

// Auto: the saved default outvotes the call (a rule that makes the agent pass
// `model: "opus"` included), so the toast says where the call's own choice was
// overridden.
function applyAuto($: Host, e: AgentCall, next: AgentNext, saved: Choice | null, rec: Choice) {
  const patch = autoPatch(e, saved, rec)
  const result = { model: patch.model ?? e.model ?? null, effort: patch.effort ?? e.effort ?? null }
  const isOverride =
    (patch.model !== undefined && e.model !== undefined && patch.model !== e.model) ||
    (patch.effort !== undefined && e.effort !== undefined && patch.effort !== e.effort)

  if (result.model !== (e.model ?? null) || result.effort !== (e.effort ?? null)) {
    $.ui.toast(`${isOverride ? 'Subagent (overridden)' : 'Subagent'} -> ${describeChoice(result)}`)
  }

  return next({ ...e, ...asPatch(patch) })
}

// A person is asked only where the band can be drawn too (the terminal and the
// desktop): on another surface (vscode, mobile) they could not change the mode or
// the default and would be asked on every call.
async function canAsk($: Host): Promise<boolean> {
  return (await $.session.surfaces()).some(surface => surface === 'terminal' || surface === 'desktop')
}

// A -p run or an SDK host draws nothing: nobody there chose a mode or a default,
// and a model changed behind its back would skew what the run measures (evals).
async function isHeadless($: Host): Promise<boolean> {
  return (await $.session.surfaces()).length === 0
}

const tuneAgent: AgentHook = async ($, e, next) => {
  // A fork ignores model and effort.
  if (e.subagent_type === FORK_TYPE || (await isHeadless($))) {
    return next(e)
  }

  await ensureHydrated($)

  const { mode, saved } = await read($, settings)
  // A custom agent's own definition may pin a model and an effort, unseen here.
  const rec = hasOwnDefinition(e.subagent_type, offers) ? INHERIT : recommend(e)

  if (mode === 'auto' || !(await canAsk($))) {
    if (isJudgedByName(e.subagent_type, offers)) {
      judgedByName.set(e.tool_use_id, e)
    }

    return applyAuto($, e, next, saved, rec)
  }

  // Manual asks only about what the call left open.
  if (!hasOpenField(e)) {
    return next(e)
  }

  const fallback = resolveDefault(saved, rec)

  // The pane where it can be seated unasked (wide terminals); the engine's own
  // chain of the engine's own dialogs, where it cannot.
  const preset = presetFor(e, fallback)
  const viaPane = await askInPane($, e, next.signal, preset)
  let reading: Outcome

  if (viaPane.kind === 'unavailable') {
    // A pane that is not placed (a narrow terminal) is the normal case: dialogs, unannounced.
    if (viaPane.reason !== NOT_PLACED) {
      $.ui.toast(`Subagent tuner: pane unavailable: ${viaPane.reason}`)
    }

    reading = await askChain($, e, next.signal, preset)
  } else {
    reading = viaPane
  }

  // An interrupted dispatch has no one left to tell, and nothing to start.
  if (next.signal.aborted) {
    return { deny: 'interrupted' }
  }

  // A dismissed or failed question must not hold the subagent back.
  if (reading.kind === 'unanswered') {
    return applySelection($, e, next, reading.choice ?? preset, 'Subagent (no answer)')
  }

  if (reading.kind === 'unreadable') {
    $.ui.toast(reading.problem)

    return { deny: 'could not read the answer; nothing was started' }
  }

  if (reading.kind === 'cancel') {
    return { deny: 'cancelled by user' }
  }

  return reading.kind === 'save'
    ? launchAndSave($, next, asCall(selected(e, reading.choice)), reading.choice)
    : next(asCall(selected(e, reading.choice)))
}

type Outcome =
  | { kind: 'run' | 'save'; choice: Choice }
  | { kind: 'cancel' }
  /** Nothing usable came back: the launch goes on, with the selection if there was one. */
  | { kind: 'unanswered'; choice?: Choice }
  | { kind: 'unreadable'; problem: string }

/** The pane route could not be used: why, in a few words. */
type Unavailable = { kind: 'unavailable'; reason: string }

const NOT_PLACED = 'not placed'

// Where the pane cannot be seated, a chain of the engine's own dialogs (`$.ui.ask`:
// a `$` call, so the hook's time budget does not count the waits). The first
// carries the selection in its labels and what to do; Change walks the field
// dialogs and comes back to it with the new values, until Run, Run and save, or
// Cancel. A dismissed or refused dialog fails open to the selection as it stands.
async function ask1($: Host, question: string, options: readonly string[], header: string): Promise<string | undefined> {
  try {
    return await $.ui.ask(question, { options, header })
  } catch {
    return undefined
  }
}

// One field's dialog; text typed under Other that names no value is asked once
// more, then the previous value stays. `undefined`: the dialog was dismissed.
async function askField($: Host, call: AgentCall, field: Field, previous: string | null): Promise<string | null | undefined> {
  const header = field === 'model' ? 'Model' : 'Effort'
  const options = field === 'model' ? MODEL_OPTIONS : EFFORT_OPTIONS

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const answer = await ask1($, fieldQuestion(call, field), options, header)

    if (answer === undefined) {
      return undefined
    }

    const value = readField(field, answer)

    if (value === 'more') {
      const rest = await ask1($, fieldQuestion(call, field), field === 'model' ? MORE_MODEL_OPTIONS : MORE_EFFORT_OPTIONS, header)

      if (rest === undefined) {
        return undefined
      }

      const picked = readField(field, rest)

      if (picked !== undefined && picked !== 'more') {
        return picked
      }
    } else if (value !== undefined) {
      return value
    }
  }

  return previous
}

async function askChain($: Host, call: AgentCall, signal: AbortSignal, preset: Choice): Promise<Outcome> {
  let current: Choice = { ...preset }

  chain: for (;;) {
    // An interrupted dispatch asks nothing more.
    if (signal.aborted) {
      return { kind: 'unanswered', choice: current }
    }

    const dialog = mainDialog(call, current)
    const answer = await ask1($, dialog.question, dialog.options, 'Subagent')

    if (answer === undefined) {
      return { kind: 'unanswered', choice: current }
    }

    const said = readMain(dialog, answer)

    if (said.kind === 'run' || said.kind === 'save') {
      return { kind: said.kind, choice: current }
    }

    if (said.kind === 'typed') {
      return { kind: 'run', choice: said.choice }
    }

    if (said.kind === 'cancel') {
      return { kind: 'cancel' }
    }

    if (said.kind === 'unreadable') {
      return said
    }

    // A field dialog dismissed discards the whole change: back to the first
    // dialog with the selection as it was when Change was chosen.
    let changed = current

    for (const field of ['model', 'effort'] as const) {
      if (signal.aborted) {
        return { kind: 'unanswered', choice: current }
      }

      const value = await askField($, call, field, changed[field])

      if (value === undefined) {
        continue chain
      }

      changed = { ...changed, [field]: value }
    }

    current = changed
  }
}

// One pane for each launch, so each launch is bound to its pane by the pane's
// id and several at once are tabs the person moves between (the engine shows
// one). What the pane's selectors hold is kept here too, beside the state they
// draw from: every read of one dispatch sees one moment, the one before the pane
// opened, so the hook cannot read the selection back from the state. A reload
// drops this, and the hook it served with it.
type Session = {
  title: string
  choice: Choice
  /** What the person (or the dispatch) decided; absent while it waits. */
  decision?: 'run' | 'save' | 'cancel' | 'abort'
  sentinel: string
}

const sessions = new Map<string, Session>()

const paneIdFor = (toolUseId: string): string => `${PANE_PREFIX}${toolUseId.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64)

const pendingFor = (call: AgentCall, id: string, preset: Choice): Pending => ({
  id,
  subagentType: call.subagent_type ?? 'general-purpose',
  description: call.description,
  model: preset.model,
  effort: preset.effort,
  isCallSet: call.model !== undefined || call.effort !== undefined,
})

const removePending = ($: Host, id: string): Promise<unknown> => update($, queue, q => without(q, id))

async function pickValue($: Host, id: string, field: Field, value: string): Promise<void> {
  const session = sessions.get(id)
  const after = await update($, queue, q => patched(q, id, { [field]: value === INHERIT_VALUE ? null : value }))
  const entry = after.items.find(one => one.id === id)

  if (session !== undefined && entry !== undefined) {
    session.choice = { model: entry.model, effort: entry.effort }
  }
}

const shortReason = (error: unknown): string => (error instanceof Error ? error.message : 'error').slice(0, 60)

type Shell = 'sh' | 'powershell.exe'

// The wait runs in whichever of these starts first: sh on macOS and Linux,
// powershell.exe on Windows, where Git puts no sh, mktemp or touch on the PATH.
const SHELLS: readonly Shell[] = ['sh', 'powershell.exe']

const POWERSHELL = ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command'] as const

const probeArgv = (shell: Shell): string[] => (shell === 'sh' ? ['sh', '-c', 'exit 0'] : [...POWERSHELL, 'exit 0'])

// The waiting child polls for the sentinel and removes it once seen, so a
// finished wait leaves nothing behind.
const waitArgv = (shell: Shell, sentinel: string): string[] =>
  shell === 'sh'
    ? ['sh', '-c', 'while [ ! -e "$1" ]; do sleep 0.2; done; rm -f -- "$1"', 'sh', sentinel]
    : [
        ...POWERSHELL,
        `$p='${sentinel.replace(/'/g, "''")}'; while (-not (Test-Path -LiteralPath $p)) { Start-Sleep -Milliseconds 200 }; Remove-Item -LiteralPath $p -Force`,
      ]

// Removes the probe file the waits folder was tried with.
const removeArgv = (shell: Shell, path: string): string[] =>
  shell === 'sh'
    ? ['sh', '-c', 'rm -f -- "$1"', 'sh', path]
    : [...POWERSHELL, `Remove-Item -LiteralPath '${path.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue`]

// Found once per load (register resets it): a reload may find another host.
let waitShell: Promise<Shell | undefined> | undefined

function shellToWaitIn($: Host): Promise<Shell | undefined> {
  waitShell ??= (async () => {
    for (const shell of SHELLS) {
      try {
        await $.process.run(probeArgv(shell))

        return shell
      } catch {
        // Not on this host: try the next.
      }
    }

    return undefined
  })()

  return waitShell
}

// Ends the wait: records the decision once, then makes the sentinel appear.
async function finish($: Host, id: string, decision: 'run' | 'save' | 'cancel' | 'abort'): Promise<void> {
  const session = sessions.get(id)

  if (session === undefined || session.decision !== undefined) {
    return
  }

  session.decision = decision

  try {
    await $.fs.write(session.sentinel, '')
  } catch {
    $.ui.toast('Subagent tuner: could not release the pane; your choice applies when its wait ends')
  }
}

// The hook's own time budget stops while a `$` call is in flight but not for an
// await on a promise, so the wait is a child process that ends when the
// sentinel appears. The sentinel lives in the plugin's own folder, named for the
// call and the moment, so no two waits share one. A wait that ends without a
// decision (the ten minutes ran out) is no answer; one that ends with a decision
// recorded (the sentinel could not be written) honours it.
async function askInPane($: Host, call: AgentCall, signal: AbortSignal, preset: Choice): Promise<Outcome | Unavailable> {
  if (signal.aborted) {
    return { kind: 'unanswered' }
  }

  const shell = await shellToWaitIn($)

  if (shell === undefined) {
    return { kind: 'unavailable', reason: 'no shell to wait in' }
  }

  // Aborted while the shell was found: nothing was made, nothing to undo.
  if (signal.aborted) {
    return { kind: 'unanswered' }
  }

  const id = paneIdFor(call.tool_use_id)
  const entry = pendingFor(call, id, preset)
  const sentinel = `${$.plugin.root}/.waits/${id}-${await $.clock.now()}`

  // A folder that takes no write (read-only install, full disk) could never end
  // the wait: the dialogs answer at once instead of a pane that holds the launch
  // for ten minutes. The probe is a sibling the wait does not look for.
  try {
    await $.fs.write(`${sentinel}.probe`, '')
  } catch (error) {
    return { kind: 'unavailable', reason: `waits folder not writable: ${shortReason(error)}` }
  }

  await $.process.run(removeArgv(shell, `${sentinel}.probe`)).catch(() => undefined)

  // Aborted while the probe ran: nothing is open yet.
  if (signal.aborted) {
    return { kind: 'unanswered' }
  }

  const session: Session = {
    choice: { model: entry.model, effort: entry.effort },
    sentinel,
    title: headerFor(call).slice(0, 40),
  }
  const onAbort = (): void => {
    finish($, id, 'abort').catch(() => undefined)
  }

  sessions.set(id, session)
  signal.addEventListener('abort', onAbort)

  try {
    await update($, queue, q => withPending(q, entry))

    const opened = await $.ui.open({
      id,
      title: session.title,
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
      rows: PANE_ROWS,
    })
    const pane = (await $.ui.panes()).find(one => one.id === id)

    // A pane that waits undrawn (a narrow terminal) cannot be answered.
    if (!opened.isPlaced || pane === undefined || !pane.isPlaced) {
      return { kind: 'unavailable', reason: NOT_PLACED }
    }

    if (!pane.isFocused) {
      $.ui.toast('Subagent tuner: press ctrl+x then Tab to reach the pane')
    }

    try {
      await $.process.run(waitArgv(shell, session.sentinel), { timeoutMs: PANE_WAIT_MS })
    } catch {
      // The wait ran out: the person's live selection stands, not the preset. A
      // decision recorded all the same (the sentinel could not be written) stands too.
      if (session.decision === undefined || session.decision === 'abort') {
        return { kind: 'unanswered', choice: session.choice }
      }
    }

    return session.decision === 'run' || session.decision === 'save'
      ? { kind: session.decision, choice: session.choice }
      : session.decision === 'cancel'
        ? { kind: 'cancel' }
        : { kind: 'unanswered' }
  } catch (error) {
    return { kind: 'unavailable', reason: shortReason(error) }
  } finally {
    signal.removeEventListener('abort', onAbort)
    sessions.delete(id)
    // Nothing is left behind on any path: the entry, the pane (the wait removed
    // the sentinel). (A hot reload while the pane is open skips this and leaves
    // the queue item behind; that is live-only, not testable here, and UNVERIFIED.)
    await removePending($, id).catch(() => undefined)
    await $.ui.close({ id }).catch(() => undefined)
  }
}

// The person's choice starts the subagent whatever becomes of the save: the
// save runs beside the launch (and says when it is stuck), and a failure of it
// is said rather than lost.
async function launchAndSave($: Host, next: AgentNext, chosen: Parameters<AgentNext>[0], choice: Choice) {
  const saving = changeSaved($, () => choice).catch((error: unknown) => {
    $.ui.toast(`Subagent tuner: could not save the default (${error instanceof Error ? error.message : 'error'})`)
  })
  const ran = await next(chosen)

  await saving

  return ran
}

// What the engine offered, per agent type: true for a built-in. Raised when the listing is built, so
// before the model can name a type at dispatch. Reset by register, like waitShell.
const offers = new Map<string, boolean>()

// The calls judged by name alone (their offer had not come) that Auto let through untouched, by
// tool_use_id: the spawn names who provides the type, which the call could not know.
const judgedByName = new Map<string, AgentCall>()

export const register: Register = on => {
  waitShell = undefined
  offers.clear()
  judgedByName.clear()

  // Only observes: the offer goes on as it came, whatever the record does.
  on('agent.offer', (_$, e, next) => {
    try {
      // `source` tells a built-in from a user's agent of its name; any doubt counts as custom.
      offers.set(e.agent, e.source === 'built-in' && e.provider.plugin === 'engine' && e.provider.tier === 'core')
    } catch {
      // Unrecorded, the type is judged by its name.
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // The spawn tells a type the engine provides (a built-in) from a user's: where the offer came after
  // the call, the recommendation the call went without applies now. The spawn takes a model only.
  on('agent.spawn', async ($, e, next) => {
    const call = judgedByName.get(e.tool_use_id)

    judgedByName.delete(e.tool_use_id)

    if (call === undefined || e.provider.plugin !== 'engine' || e.provider.tier !== 'core' || offers.get(e.subagentType) === false) {
      return next(e)
    }

    const { saved } = await read($, settings)
    const { model } = autoPatch(call, saved, recommend(call))

    if (model === undefined || model === e.model) {
      return next(e)
    }

    $.ui.toast(`Subagent model -> ${model}`)

    return next({ ...e, model })
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    await ensureHydrated($)

    // A pane a previous copy of this module left open has no one waiting on it.
    try {
      for (const pane of await $.ui.panes()) {
        if (pane.id.startsWith(PANE_PREFIX)) {
          await $.ui.close({ id: pane.id })
        }
      }
    } catch {
      // No panes to clear.
    }

    return next(e)
  })

  // A broken tuner must never keep a subagent from starting: whatever fails,
  // the call goes on exactly as the model made it.
  on('tool.call', { tool: 'Agent' }, tuneAgent).catch(($, e, next) => next(e))

  // The person closing a pane (Escape, the close mark) cancels its launch.
  on('ui.close', async ($, e, next) => {
    const session = sessions.get(e.id)

    if (e.origin.kind === 'person' && session !== undefined) {
      await finish($, e.id, 'cancel')
    }

    return next(e)
  })

  // The pane's own body: the selectors and the buttons for the launch it holds.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const entry = (await read($, queue)).items.find(one => one.id === e.requestId)

    if (entry === undefined) {
      return next(e)
    }

    return paneView({
      ui: $.ui.resolve(e),
      columns: e.props.bodyColumns,
      entry,
      actions: {
        pick: (id, field, value) => pickValue($, id, field, value),
        run: id => finish($, id, 'run'),
        save: id => finish($, id, 'save'),
        cancel: id => finish($, id, 'cancel'),
      },
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The band is raised on the terminal and the desktop only. Narrower than the
    // smallest layout nothing fits, so nothing is drawn.
    if (
      e.props.hasSurvey ||
      e.props.bodyColumns < MIN_COLUMNS ||
      (e.surface !== 'terminal' && e.surface !== 'desktop')
    ) {
      return next(e)
    }

    const current = await read($, settings)
    // Before the first load the state holds only the initial values: show
    // what the store holds rather than a default that is not the person's.
    const { mode, saved } = current.hydrated ? current : await stored($)

    // The site draws one tree: ours goes above whatever the plugins beneath drew, and they size
    // themselves to the rows the band leaves. A plugin beneath that fails never costs the band.
    let below: unknown

    try {
      below = await next({ ...e, props: { ...e.props, maxRows: rowsLeft(e.props.maxRows) } })
    } catch {
      below = undefined
    }

    const ui = $.ui.resolve(e)

    return stacked(
      ui,
      bandView({ ui, columns: e.props.bodyColumns, mode, saved, actions: actionsFor($) }),
      below,
    )
  })
}
