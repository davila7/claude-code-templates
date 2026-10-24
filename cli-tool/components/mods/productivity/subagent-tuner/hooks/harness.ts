// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderSurface } from 'claude-code'


export const PLUGIN = 'subagent-tuner'
export const REVIEW = { tool: 'Agent', description: 'Review the diff', prompt: 'p', subagent_type: 'code-reviewer' } as const
export const BUILD = { tool: 'Agent', description: 'Build the parser', prompt: 'p', subagent_type: 'implementer' } as const
export const SEARCH = { tool: 'Agent', description: 'Search the repo', prompt: 'p', subagent_type: 'Explore' } as const
export const UNTOUCHED = (description: string) => ({ model: undefined, effort: undefined, description })

export type Seen = { model?: string; effort?: string; description: string }
export const SKIP = '\u0000skip'
export type Answer = string | { dismissed: true }
export type Scripted = Answer | ((labels: readonly string[]) => string)
export type Reply = Answer | Promise<Answer>
export type BeneathProps = { hasSurvey: boolean; maxRows: number; bodyColumns: number }
export type Options = {
  store?: Record<string, unknown>
  surfaces?: readonly RenderSurface[]
  isStoreBroken?: boolean
  isWriteBroken?: boolean
  /** Milliseconds each store write waits, in the order the writes are made. */
  slowSetMs?: readonly number[]
  /** The first two reads of the store (the first load) answer late, and stale. */
  slowFirstLoad?: { staleMode: string; staleSaved?: unknown }
  /** The first this many store writes throw. */
  failWrites?: number
  /** Store writes never settle. */
  isWriteStalled?: boolean
  /** Opens the pane mock: process, pane and sentinel hooks beneath the plugin. */
  pane?: {
    isPlaced?: boolean
    /** The first open of an id is not seated (unasked, narrow); later ones are (the person's own). */
    isUnplacedFirst?: boolean
    isFocused?: boolean
    /** The shells that start on this host; `sh` alone (macOS, Linux) when left out, `powershell.exe` alone on Windows. */
    shells?: readonly ('sh' | 'powershell.exe')[]
    /** The probe for a shell to wait in answers only once this settles. */
    probeGate?: Promise<void>
    isOpenBroken?: boolean
    /** Writes into the waits folder are refused: `sentinel` only the sentinel (the probe goes through), `everything` the probe too. */
    unwritable?: 'sentinel' | 'everything'
  }
  /** Only the first store write never settles. */
  stallFirstWrite?: boolean
  /** The Agent call runs this long before it returns. */
  agentRunMs?: number
  /** The Agent call throws once it has started. */
  agentThrows?: boolean
  reply?: (question: string, labels: readonly string[]) => Reply
  /** The answers to the dialogs asked, in order; the first option once it runs out. */
  script?: readonly (Scripted)[]
}

// Stands for the engine beneath the plugin: records the Agent call it is
// handed, the toasts and the dialogs, answers the dialog as the test says, and
// keeps the plugin's store in memory where the test can read it back.
export function engine(on: On, options: Options = {}) {
  const clock = mock.clock(on)
  const seen: Seen[] = []
  const toasts: string[] = []
  const diagnostics: string[] = []
  const asked: { question: string; header: string; labels: string[] }[] = []
  const gets: string[] = []
  let sets = 0
  let reads = 0
  let failReadAt = -1
  const store = new Map<string, unknown>(Object.entries(options.store ?? {}))
  const script = [...(options.script ?? [])]

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  // Beneath the plugins the engine offers every type to the model.
  on('agent.offer', () => ({ isOffered: true }))
  on('session.surfaces', () => ({ value: options.surfaces ?? (['terminal'] as const) }))
  on('state.get', (_$, e, next) => {
    reads += 1

    if (reads === failReadAt) {
      return { deny: 'state unreadable' } as never
    }

    return next(e)
  })
  on('store.get', async (_$, e) => {
    gets.push(e.key)

    if (options.slowFirstLoad !== undefined && gets.length <= 2) {
      await clock.sleep(500)

      return { value: e.key === 'mode' ? options.slowFirstLoad.staleMode : options.slowFirstLoad.staleSaved }
    }

    if (options.isStoreBroken === true) {
      throw new Error('store is broken')
    }

    return { value: store.get(e.key) }
  })
  on('store.set', async (_$, e) => {
    if (options.isWriteBroken === true || sets < (options.failWrites ?? 0)) {
      sets += 1

      return { deny: 'disk full' }
    }

    if (options.stallFirstWrite === true && sets === 0) {
      sets += 1
      await new Promise<never>(() => undefined)
    }

    if (options.isWriteStalled === true) {
      await new Promise<never>(() => undefined)
    }

    const delay = options.slowSetMs?.[sets] ?? 0

    sets += 1

    if (delay > 0) {
      await clock.sleep(delay)
    }

    store.set(e.key, e.value)

    return { value: undefined }
  })
  // What the engine and the plugins beneath ours draw at AbovePrompt. The band now stacks over whatever
  // comes back, so a stand-in line would show in every band: while a survey holds the site the engine's
  // line, otherwise an empty Box (nothing to see), unless a test sets `beneath.draw` (a plugin below ours).
  // `props` holds what each draw was handed, in order.
  const beneath: { draw?: (props: BeneathProps) => unknown; props: BeneathProps[] } = { props: [] }

  on('ui.render', { component: 'AbovePrompt' }, (_$, e) => {
    beneath.props.push(e.props)

    if (beneath.draw !== undefined) {
      return beneath.draw(e.props) as never
    }

    return (e.props.hasSurvey ? h('Text', {}, 'engine band') : h('Box', {})) as never
  })
  on('ui.toast', (_$, e) => {
    // Why the pane route was given up is kept apart from the launch's own toasts.
    ;(e.text.startsWith('Subagent tuner: pane ') ? diagnostics : toasts).push(e.text)

    return { value: undefined }
  })
  // The engine's dialog, one question at a time: scripted answers first, then the
  // test's `reply`, then the first option.
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    const one = e.questions[0]!
    const labels = one.options.map(option => option.label)

    asked.push({ question: one.question, header: one.header, labels })

    const scripted = script.shift()
    const reply: Answer | typeof SKIP = await (scripted !== undefined
      ? typeof scripted === 'function'
        ? scripted(labels)
        : scripted
      : (options.reply?.(one.question, labels) ?? labels[0]!))

    if (typeof reply === 'object') {
      return { deny: 'dismissed' }
    }

    return { result: { questions: e.questions, answers: reply === SKIP ? {} : { [one.question]: reply } } } as never
  })
  on('tool.call', { tool: 'Agent' }, async (_$, e) => {
    seen.push({ model: e.model, effort: e.effort, description: e.description })

    if (options.agentRunMs !== undefined) {
      await clock.sleep(options.agentRunMs)
    }

    if (options.agentThrows === true) {
      throw new Error('the tool failed')
    }

    return { result: { ok: true } } as never
  })

  // The engine starts the subagent: records the model the spawn reached it with.
  const spawned: (string | undefined)[] = []

  on('agent.spawn', (_$, e) => {
    spawned.push(e.model)

    return { model: e.model ?? 'parent' }
  })

  const touched = new Set<string>()
  const wakers: (() => void)[] = []
  // The engine may hand $.fs a path in the host's own spelling (backslashes on
  // Windows), so a path is compared by its parts, not its separators.
  const samePath = (path: string): string => path.replace(/\\/g, '/')
  /** Every command the plugin tried to start, by its executable. */
  const starts: string[] = []
  /** The sentinels the plugin wrote with `$.fs.write`. */
  const written: string[] = []
  /** The probe files the plugin wrote to find out the folder takes a write, and the ones it then removed. */
  const probed: string[] = []
  const removed: string[] = []
  /** The waits the plugin started: which shell, on which sentinel. */
  const waits: { shell: string; sentinel: string }[] = []
  /** The sentinels a wait saw appear and removed. */
  const consumed: string[] = []
  const opened: { id: string; title?: string; focus?: true; closeOnEscape?: true; holdToasts?: true; rows?: number }[] = []
  const closed: string[] = []
  const open = new Map<string, { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }>()

  if (options.pane !== undefined) {
    const pane = options.pane

    on('fs.write', (_$, e) => {
      const path = samePath(e.path)
      const isProbe = path.endsWith('.probe')

      if (pane.unwritable === 'everything' || (pane.unwritable === 'sentinel' && !isProbe)) {
        return { deny: 'EACCES: permission denied' }
      }

      if (isProbe) {
        probed.push(path)

        return { value: undefined }
      }

      written.push(path)
      touched.add(path)
      wakers.splice(0).forEach(wake => wake())

      return { value: undefined }
    })
    on('process.run', async (_$, e) => {
      const result = () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
      const shell = e.argv[0]!

      starts.push(shell)

      if (!(pane.shells ?? ['sh']).includes(shell as never)) {
        return { deny: `ENOENT: Command '${shell}' not found` }
      }

      const script = e.argv.at(shell === 'sh' ? 2 : -1)!

      if (script === 'exit 0') {
        await pane.probeGate

        return result()
      }

      // The probe's cleanup: removes the file and ends.
      if (script.startsWith('rm -f') || script.startsWith('Remove-Item')) {
        removed.push(samePath(shell === 'sh' ? e.argv.at(-1)! : /-LiteralPath '((?:[^']|'')*)'/.exec(script)![1]!.replace(/''/g, "'")))

        return result()
      }

      // The waiting child: ends (and removes the sentinel) once it exists, or when its timeout runs out.
      const sentinel = samePath(shell === 'sh' ? e.argv.at(-1)! : /\$p='((?:[^']|'')*)'/.exec(script)![1]!.replace(/''/g, "'"))

      waits.push({ shell, sentinel })

      const timedOut = clock.sleep(e.init?.timeoutMs ?? 30000).then(() => 'timeout' as const)
      const appeared = new Promise<'appeared'>(done => {
        const check = (): void => (touched.has(sentinel) ? done('appeared') : void wakers.push(check))

        check()
      })

      if ((await Promise.race([timedOut, appeared])) === 'timeout') {
        return { deny: 'timed out' }
      }

      touched.delete(sentinel)
      consumed.push(sentinel)

      return result()
    })
    on('ui.open', (_$, e) => {
      if (pane.isOpenBroken === true) {
        return { deny: 'no panes here' }
      }

      const isFirst = !opened.some(one => one.id === e.id)
      const isPlaced = pane.isUnplacedFirst === true ? !isFirst : (pane.isPlaced ?? true)

      opened.push({ id: e.id, title: e.title, focus: e.focus, closeOnEscape: e.closeOnEscape, holdToasts: e.holdToasts, rows: e.rows })
      open.set(e.id, { id: e.id, title: e.title ?? e.id, isShown: true, isFocused: pane.isFocused ?? true, isPlaced })

      return { value: isPlaced ? { isPlaced: true as const } : { isPlaced: false as const, reason: 'narrow' as never } }
    })
    on('ui.panes', () => ({ value: [...open.values()] }))
    on('ui.close', (_$, e) => {
      closed.push(e.id)
      open.delete(e.id)

      return { value: undefined }
    })
    on('ui.render', { component: 'Pane' }, () => h('Text', {}, 'engine pane') as never)
  }

  return {
    clock,
    seen,
    spawned,
    toasts,
    diagnostics,
    asked,
    gets,
    beneath,
    store,
    panes: { starts, written, probed, removed, waits, consumed, opened, closed, open },
    /** Makes the n-th state read from now on throw. */
    failStateReadIn: (n: number) => {
      failReadAt = reads + n
    },
  }
}

// `columns` is the body the band draws into; the viewport may be wider (a pane
// docked beside the transcript).
export const mountBand = (
  $: Engine,
  columns: number,
  surface: 'terminal' | 'desktop' = 'terminal',
  hasSurvey = false,
  viewportColumns = columns,
) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey, isWorking: false, maxRows: 3, bodyColumns: columns, scroll: { offset: 0, bodyRows: 3 }, view: {} },
    viewport: { columns: viewportColumns, rows: 30 },
  })

export type Band = Awaited<ReturnType<typeof mountBand>>
export type Node = string | { type: string; props?: Record<string, unknown>; children?: Node[] }

// The cells a drawn tree takes in a row: a bracketed Button is its label and
// four more, a plain one its label alone (reference.md:127), a Box adds its gap.
export function widthOf(node: Node): number {
  if (typeof node === 'string') {
    return node.length
  }

  if (node.type === 'engine') {
    return 0
  }

  // A Select is drawn `Model [ value ▾ ]`: its label, a space, and the widest
  // option in a bracketed field. Its painted width is UNVERIFIED live.
  if (node.type === 'Select') {
    const longest = Math.max(...((node.props?.options as { value: string }[]) ?? []).map(option => option.value.length))

    return String(node.props?.label ?? '').length + 1 + longest + 6
  }

  if (node.type === 'Button') {
    const label = String(node.props?.label)

    const hotkey = node.props?.hotkey === undefined ? 0 : String(node.props.hotkey).length + 2

    return node.props?.plain === true ? hotkey + label.length : label.length + 4
  }

  const gap = Number(node.props?.gap ?? 0)
  const children = node.children ?? []

  if (node.props?.flexDirection === 'column') {
    return Math.max(0, ...children.map(widthOf))
  }

  return children.reduce<number>((sum, child) => sum + widthOf(child), 0) + gap * Math.max(0, children.length - 1)
}

export const drawn = async (ui: { drawn: () => Promise<unknown> }) => (await ui.drawn()) as unknown as Node

export const textOf = async (ui: Band, text: RegExp) => (await ui.find({ type: 'Text', text }))?.text

// A plain cycler carries a trailing mark that is not part of the value.
export const labelOf = async (ui: Band, key: string) => String((await ui.find({ key }))?.props.label).replace(/>$/, '')

// The engine raises `agent.offer` for each type when it builds the agent listing, before the model can
// name one. The fixtures' types stand for built-in agents (the tuner's own recommendation applies to
// them); a test of a custom agent offers its own type with `offerAgent`.
export const offerAgent = (
  $: Engine,
  agent: string,
  isBuiltIn = false,
  source: string = isBuiltIn ? 'built-in' : 'plugin',
  provider = isBuiltIn ? { plugin: 'engine', tier: 'core' } : { plugin: 'acme', tier: 'append' },
) => $.agent.offer({ agent, description: '', source, provider } as never)

export const start = async ($: Engine) => {
  for (const one of [REVIEW, BUILD, SEARCH]) {
    await offerAgent($, one.subagent_type, true)
  }

  return $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

/** A custom agent's call: its own type, which the listing offered as a plugin's, not the engine's. */
export const CUSTOM = { tool: 'Agent', description: 'Review the diff', prompt: 'p', subagent_type: 'acme-reviewer' } as const

export const SAVE_LABEL = (_question: string, labels: readonly string[]) => labels.find(label => label.includes('save default'))!

// The pane.

export const mountPane = (
  $: Engine,
  id: string,
  columns: number,
  surface: 'terminal' | 'desktop' = 'terminal',
) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId: id,
    props: { title: 'x', isFocused: true, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: 10 }, view: {} },
    viewport: { columns, rows: 30 },
  })

export type PaneUi = Awaited<ReturnType<typeof mountPane>>

export const valueOf = async (ui: PaneUi, key: string) => (await ui.find({ key }))?.props.value

// Nothing is left behind on any path: every sentinel written is removed, every
// pane opened is closed, and no entry of the launch is left to be drawn.
export async function expectClean($: Engine, panes: ReturnType<typeof engine>['panes']) {
  expect(panes.consumed.slice().sort()).toEqual(panes.written.slice().sort())
  expect(panes.removed.slice().sort()).toEqual(panes.probed.slice().sort())
  expect(panes.opened.map(one => one.id).sort()).toEqual(panes.closed.slice().sort())

  for (const one of panes.opened) {
    const ui = await mountPane($, one.id, 100)

    expect(await ui.find({ key: 'model' })).toBeUndefined()
    await ui.unmount()
  }
}

// The chain of native dialogs.

export const MAIN = (labels: readonly string[]) => labels[0]!
export const CHANGE = 'Change model or effort'

// An inline plugin above the tuner that abandons the Agent call after one second
// of the mock clock, which aborts the tuner's `next.signal` (d.ts: "a hook above
// settled first"). Self-contained, as an inline plugin's `register` must be.
export const ABORTER = {
  name: 'aborter',
  tier: 'prepend',
  register: (on: On) => {
    on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
      next(e).catch(() => undefined)
      await $.clock.sleep(1000)

      return { deny: 'abandoned' }
    })
  },
} as const

// An inline plugin that closes the pane whose id a Bash call carries, as a
// plugin (origin `plugin`), the way a person cannot be played by the engine.
export const CLOSER = {
  name: 'closer',
  tier: 'append',
  register: (on: On) => {
    on('tool.call', { tool: 'Bash' }, async ($, e) => {
      await $.ui.close({ id: e.command })

      return { result: { stdout: '', stderr: '', interrupted: false } } as never
    })
  },
} as const

/** The engine's `agent.spawn` for a call, as it reaches the hooks: the provider says who supplies the type. */
export const spawnAgent = ($: Engine, toolUseId: string, subagentType: string, provider = { plugin: 'engine', tier: 'core' }) =>
  $.agent.spawn({ tool_use_id: toolUseId, prompt: 'p', description: 'Review the diff', subagentType, provider } as never)
