import type { AskOptions, AudioClip, CatchHandler, CommandSpec, EngineInterface, Hook, MatchedHook, PaneOpenArgs, ProcessRunInit, Register, ResolveInput, SessionCompactArgs, StateSetOptions, StateSetResult } from 'claude-code'
import type { UltraApi } from './core/api'
import type { Runtime } from './core/runtime'
import { band, checkTool, composeSections, createRuntime, maskRow, notification, pane, REFUSED, sessionEnd, sessionRestart, sessionStart, turnComplete, turnStart, ultraCommand, underAnswer, watchTool } from './core/runtime'

// Every hook Ultra Mod registers is declared in this file, and this file alone
// touches the engine: `$` goes whole to createApi below, and `next` never
// leaves the hook that received it. The mods in ./mods compute plain values
// (a refusal text, a line, a rewritten row) from the facade; each hook here
// turns that value into its return. No hook answers a permission check
// (there is no tool.check hook) and none answers allow. The tool.call check
// returns `next(e)` or `{ deny }`; the tool.call watch returns what `next(e)`
// returned, with context lines added or tokens masked.

// The facade the mods use. Every raw engine call is written here as a plain
// `$.noun.method(...)`, so the validator and the directory can account for
// each capability; nothing else in this file names `$` except the hooks.
function createApi($: EngineInterface): UltraApi {
  const stateGet = async (ref: { plugin: string; key: string }): Promise<unknown> => {
    if (ref.plugin !== 'ultramod') throw new Error('Ultra Mod can only read its own state.')
    if (ref.key === 'set') return $.state.get({ plugin: 'ultramod', key: 'set' })
    if (ref.key === 'turn') return $.state.get({ plugin: 'ultramod', key: 'turn' })
    if (ref.key === 'receipts') return $.state.get({ plugin: 'ultramod', key: 'receipts' })
    if (ref.key === 'allow') return $.state.get({ plugin: 'ultramod', key: 'allow' })
    if (ref.key === 'compact') return $.state.get({ plugin: 'ultramod', key: 'compact' })
    throw new Error('Ultra Mod state key is not declared in the facade.')
  }
  const stateSet = async (ref: { plugin: string; key: string }, value: unknown, options?: StateSetOptions): Promise<StateSetResult> => {
    // The contract in types/index.d.ts gives each key its value type; the
    // facade's own signature checks it at the mod's call.
    const held = value as never
    if (ref.plugin !== 'ultramod') throw new Error('Ultra Mod can only write its own state.')
    if (ref.key === 'set') return $.state.set({ plugin: 'ultramod', key: 'set' }, held, options)
    if (ref.key === 'turn') return $.state.set({ plugin: 'ultramod', key: 'turn' }, held, options)
    if (ref.key === 'receipts') return $.state.set({ plugin: 'ultramod', key: 'receipts' }, held, options)
    if (ref.key === 'allow') return $.state.set({ plugin: 'ultramod', key: 'allow' }, held, options)
    if (ref.key === 'compact') return $.state.set({ plugin: 'ultramod', key: 'compact' }, held, options)
    throw new Error('Ultra Mod state key is not declared in the facade.')
  }
  // The one file Ultra Mod writes: the project's pins file, for /ultra pin.
  const writePins = (root: string, text: string): Promise<void> => {
    if (root === '') return $.fs.write('.claude/pins.md', text)
    return $.fs.write(`${root}/.claude/pins.md`, text)
  }
  const envGet = (name: string): Promise<string | undefined> => {
    if (name === 'OS') return $.env.get('OS')
    if (name === 'HOME') return $.env.get('HOME')
    if (name === 'USERPROFILE') return $.env.get('USERPROFILE')
    if (name === 'WSL_DISTRO_NAME') return $.env.get('WSL_DISTRO_NAME')
    throw new Error('Ultra Mod environment name is not declared in the facade.')
  }
  const facade = {
    state: { get: stateGet, set: stateSet },
    plugin: { root: $.plugin.root },
    store: {
      get: (key: string) => $.store.get(key),
      set: (key: string, value: unknown) => $.store.set(key, value),
    },
    clock: {
      now: () => $.clock.now(),
      every: (ms: number, fn: () => void) => $.clock.every(ms, fn),
      after: (ms: number, fn: () => void) => $.clock.after(ms, fn),
    },
    ui: {
      ask: (question: string, options?: AskOptions) => $.ui.ask(question, options),
      toast: (text: string) => $.ui.toast(text),
      log: (text: string) => $.ui.log(text),
      open: (pane: PaneOpenArgs) => $.ui.open(pane),
      resolve: (e: ResolveInput) => $.ui.resolve(e),
    },
    session: {
      root: () => $.session.root(),
      cwd: () => $.session.cwd(),
      usage: () => $.session.usage(),
      model: () => $.session.model(),
      version: () => $.session.version(),
      compact: (input?: SessionCompactArgs) => $.session.compact(input),
    },
    // Every command it starts is listed in plugin/README.md.
    process: {
      run: (argv: readonly string[], init?: ProcessRunInit) => $.process.run(argv, init),
    },
    fs: {
      writePins,
      stat: (path: string) => $.fs.stat(path),
      exists: (path: string) => $.fs.exists(path),
      read: (path: string) => $.fs.read(path),
    },
    audio: {
      play: (clip: AudioClip) => $.audio.play(clip),
    },
    command: {
      register: (command: CommandSpec) => $.command.register(command),
    },
    env: { get: envGet },
  }
  return facade as unknown as UltraApi
}

// Built again on every load from the plugin's options; the hooks below read it.
let runtime: Runtime = createRuntime()

// Starts the HUD over, reads the project's set and registers /ultra.
const startSession: Hook<'session.start'> = async ($, e, next) => {
  await sessionStart(createApi($), runtime, e)
  return next(e)
}

// A cleared, resumed or forked conversation: the same, plus fresh receipts and context warnings.
const restartSession: Hook<'classic.SessionStart'> = async ($, e, next) => {
  await sessionRestart(createApi($), runtime, e)
  return next(e)
}

// Starts the turn timer and the receipt for this turn.
const startTurn: Hook<'turn.start'> = async ($, e, next) => {
  await turnStart(createApi($), runtime, e)
  return next(e)
}

// Ends the turn: stores the receipt, checks the context fill, sends a
// notification for a long turn, and adds the receipt line under the answer.
const completeTurn: Hook<'turn.complete'> = async ($, e, next) => {
  const line = await turnComplete(createApi($), runtime, e)
  if (line === null) return next(e)
  const result = await next(e)
  return { ...result, text: underAnswer(result.text, e.answer, line) }
}

const endSession: Hook<'session.end'> = async ($, e, next) => {
  await sessionEnd(createApi($), runtime, e)
  return next(e)
}

// Answers /ultra, the command this plugin registers, and only that command.
const runUltra: Hook<'command.run'> = async ($, e) => {
  const answer = await ultraCommand(createApi($), runtime, e.args)
  return { text: answer.text }
}

// Draws the Ultra Mod pane, and the HUD rows above the prompt over what the plugins beneath draw.
const render: MatchedHook<'ui.render', { component: readonly ['AbovePrompt', 'Pane'] }> = async ($, e, next) => {
  if (e.component === 'Pane' && e.requestId === 'ultramod') return pane(createApi($), runtime, e)
  if (e.component !== 'AbovePrompt') return next(e)
  const rows = await band(createApi($), runtime, e)
  if (rows === null) return next(e)
  const { Box } = $.ui.resolve(e)
  return <Box flexDirection="column">{rows}{await next(e)}</Box>
}

// Before a call of the tools these mods read runs: guard, secrets, tests and
// tidy may refuse it.
const checkToolCall: Hook<'tool.call'> = async ($, e, next) => {
  const refusal = await checkTool(createApi($), runtime, e)
  if (refusal !== null) return { deny: refusal }
  return next(e)
}

// A failed check refuses the call it had not let through yet.
const refuseToolCall: CatchHandler<Hook<'tool.call'>> = ($, e, next) => {
  if (next.called) return next(e)
  return { deny: REFUSED }
}

// Around a tool call the checks let through: receipts and the HUD count it,
// loops adds a line after the same failure repeats, secrets masks tokens in
// refusal text and context lines from the hooks beneath.
const watchToolCall: Hook<'tool.call'> = async ($, e, next) => {
  const after = await watchTool(createApi($), runtime, e)
  const result = await next(e)
  const change = await after(result)
  if (change === null) return result
  if (change.deny !== undefined) return { deny: change.deny }
  if (result.deny !== undefined) return result
  return { ...result, context: change.context }
}

// Masks known token formats in a tool result before it is stored.
const maskSecrets: Hook<'session.append'> = async ($, e, next) => {
  const content = await maskRow(createApi($), runtime, e)
  if (content === null) return next(e)
  return next({ ...e, message: { ...e.message, content } })
}

// Adds the lines of .claude/pins.md to the system prompt.
const addPins: Hook<'prompt.compose'> = async ($, e, next) => {
  const added = await composeSections(createApi($), runtime, e)
  if (added.length === 0) return next(e)
  const composed = await next(e)
  return { sections: [...composed.sections, ...added] }
}

// Sends a desktop notification when Claude Code waits for the person.
const notifyWaiting: Hook<'classic.Notification'> = async ($, e, next) => {
  await notification(createApi($), runtime, e)
  return next(e)
}

export const register: Register = (on, options) => {
  runtime = createRuntime(options)
  on('session.start', startSession)
  on('classic.SessionStart', restartSession)
  on('turn.start', startTurn)
  on('turn.complete', completeTurn)
  on('session.end', endSession)
  on('command.run', { command: 'ultra' }, runUltra)
  on('ui.render', { component: ['AbovePrompt', 'Pane'] }, render)
  on('tool.call', { tool: /^(?:Bash|Read|Edit|MultiEdit|Write|NotebookEdit|Grep|Glob)$/ }, checkToolCall).catch(refuseToolCall)
  on('tool.call', watchToolCall)
  on('session.append', maskSecrets)
  on('prompt.compose', addPins)
  on('classic.Notification', notifyWaiting)
}
