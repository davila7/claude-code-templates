/**
 * turn-inspector — Claude Mod
 *
 * A side pane that draws every model request of the session as a "turn", the
 * way Anthropic's context-window diagram does: each turn's input (system
 * prompt and tools, every earlier turn, what is new) stacked above its output
 * (thinking, text, tool use), and a bar showing how much of the context
 * window it fills. Click a turn (or Tab and Enter) to expand its blocks.
 *
 *   `/turns` opens it · `/turns clear` forgets the turns so far ·
 *   `/turns stop` closes it
 *
 * Totals are the API's own `usage` per request; the split of a total across
 * its blocks is an estimate (about 4 characters a token), marked `~`.
 * It only observes: every hook passes its event on unchanged.
 *
 * Needs Claude Code >= 2.1.287.
 *
 * Options (pluginConfigs["turn-inspector@skills-dir"].options):
 *   columns: number      width asked for the docked pane (default 56)
 *   maxTurns: number     turns kept, oldest dropped first (default 200)
 *   openOnStart: boolean open the pane when the session starts (default false)
 */
import type { Register, RenderChildren, RenderSurface } from 'claude-code'
import {
  barCells,
  cell,
  chunk,
  contextAfter,
  createLedger,
  fit,
  fmtTokens,
  gist,
  inputStack,
  maxTurns,
  paneColumns,
  promptStarted,
  stepEnded,
  stepStarted,
  systemTokens,
  toolAnswered,
} from './turns.ts'
import type { Block, BlockKind, Ledger, Turn } from './turns.ts'

const PANE = 'turn-inspector'
const COMMAND = 'turns'
const KEY = 'turn:'

/** The diagram's palette: input in terracotta, output in grey, thinking near-black. */
const INK = '#f4ece6'
const STYLE: Record<BlockKind, { icon: string; bg: string; fg: string }> = {
  system: { icon: '⚙', bg: '#4a2a1d', fg: '#e8cbb8' },
  history: { icon: '↺', bg: '#6b3d2a', fg: INK },
  user: { icon: '❯', bg: '#9a5a3e', fg: INK },
  tool_result: { icon: '⇠', bg: '#9a5a3e', fg: INK },
  thinking: { icon: '✻', bg: '#151515', fg: '#d6d6d6' },
  text: { icon: '¶', bg: '#5e5e5e', fg: INK },
  tool_use: { icon: '⚒', bg: '#5e5e5e', fg: INK },
  truncated: { icon: '✂', bg: '#2b2b2b', fg: '#9a9a9a' },
}
const INPUT_RAIL = '#c8734f'
const OUTPUT_RAIL = '#8c8c8c'
const BAR = { system: '#4a2a1d', history: '#8a4f37', added: '#d9875f', output: '#9a9a9a', free: '#3a3a3a' }

let ledger: Ledger = createLedger()
let live: Turn | undefined
let isOpen = false
let follow = true
const expanded = new Set<number>()

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const keep = maxTurns(options.maxTurns)
  const openOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    ledger = createLedger()
    live = undefined
    expanded.clear()
    follow = true
    await $.command
      .register({
        name: COMMAND,
        description: 'Turn-by-turn view of the context window: each request’s input and output blocks (clear|stop)',
        argumentHint: '[clear|stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`turn-inspector: /${COMMAND} not registered: ${err}`))
    const usage = await $.session.usage().catch(() => undefined)
    if (usage) ledger.window = usage.context.window
    // a fresh session's first request measures what every request carries
    ledger.isFresh = (await $.session.messages().catch(() => [1])).length === 0
    if (openOnStart) {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'turns', columns }).catch(err => {
        isOpen = false
        $.ui.log(`turn-inspector: pane not opened: ${err}`)
      })
    }
    return r
  })

  // a /clear ends the conversation, and no session.start follows it
  on('session.end', async ($, e, next) => {
    const r = await next(e)
    if (e.reason !== 'clear') return r
    ledger = Object.assign(createLedger(), { window: ledger.window, system: ledger.system, isFresh: true })
    live = undefined
    expanded.clear()
    follow = true
    if (isOpen) $.ui.invalidate('ui.render')
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'turn-inspector closed' }
    }
    if (arg === 'clear') {
      const window = ledger.window
      const { system, baseline } = ledger
      ledger = Object.assign(createLedger(), { window, system, baseline })
      live = undefined
      expanded.clear()
      if (isOpen) $.ui.invalidate('ui.render')
      return { text: 'turn-inspector: turns cleared' }
    }
    const usage = await $.session.usage({ breakdown: 'summary', columns }).catch(() => undefined)
    if (usage) {
      ledger.window = usage.context.window
      const system = systemTokens(usage.context.breakdown?.categories ?? [])
      if (system !== undefined) ledger.system = system
    }
    try {
      await $.ui.open({ id: PANE, title: 'turns', focus: true, columns })
    } catch (err) {
      isOpen = false
      return { text: `turn-inspector: pane not opened: ${err}` }
    }
    isOpen = true
    $.ui.invalidate('ui.render')
    const hint = e.presentation.isFullscreen
      ? 'click a turn, or Tab and Enter, to expand it'
      : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `${ledger.turns.length} turns so far · ${hint} · /${COMMAND} stop closes` }
  })

  on('turn.start', async ($, e, next) => {
    // a subagent's run starts a turn too (agentId, newer than these declarations)
    if ('agentId' in e && e.agentId !== undefined) return next(e)
    promptStarted(ledger, e.turnId, e.text)
    return next(e)
  })

  // a tool's answer is new input for the next request
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    const text = r.deny ?? r.text ?? (r.result === undefined ? '' : safeJson(r.result))
    toolAnswered(ledger, e.tool, text.length, r.deny !== undefined || r.isError === true)
    return r
  })

  // each request of the main loop is a turn; its stream gives the output blocks
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    const turn = stepStarted(ledger, e.turnId, e.index, e.model, keep)
    live = turn
    if (follow) {
      expanded.clear()
      expanded.add(turn.n)
    }
    if (isOpen) $.ui.invalidate('ui.render')
    const names = new Map<number, string>()
    const stream = next(e)
    try {
      for await (const c of stream) {
        let isNew = false
        if (c.kind === 'thinking') isNew = chunk(turn, c.index, 'thinking', c.text)
        else if (c.kind === 'text') isNew = chunk(turn, c.index, 'text', c.text)
        else if (c.kind === 'tool') {
          names.set(c.index, c.name)
          isNew = chunk(turn, c.index, 'tool_use', c.name, c.name)
        } else if (c.kind === 'input') isNew = chunk(turn, c.index, 'tool_use', c.json, names.get(c.index))
        if (isNew && isOpen) $.ui.invalidate('ui.render')
        yield c
      }
      const r = await stream.result
      stepEnded(ledger, turn, r.usage, r.stopReason)
      return r
    } finally {
      // an interrupt closes the stream before its result: no usage came
      if (turn.status === 'streaming') stepEnded(ledger, turn, null, null)
      if (live === turn) live = undefined
      if (isOpen) $.ui.invalidate('ui.render')
    }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && isOpen) {
      const usage = await $.session.usage({ breakdown: 'summary', columns }).catch(() => undefined)
      const system = systemTokens(usage?.context.breakdown?.categories ?? [])
      if (system !== undefined) ledger.system = system
      if (isOpen) $.ui.invalidate('ui.render')
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    if (e.context.window !== ledger.window) {
      ledger.window = e.context.window
      if (isOpen) $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const key = e.element
    if (key === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (key === 'follow') {
      follow = !follow
      const last = ledger.turns.at(-1)
      if (follow && last) {
        expanded.clear()
        expanded.add(last.n)
      }
    } else if (key === 'collapse') {
      expanded.clear()
      follow = false
    } else if (key.startsWith(KEY)) {
      const n = Number(key.slice(KEY.length))
      if (expanded.has(n)) {
        expanded.delete(n)
        if (n === ledger.turns.at(-1)?.n) follow = false
      } else expanded.add(n)
    }
    if (isOpen) $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    const sp = spacer(e.surface)
    const noop = () => {}
    const window = ledger.window
    const last = ledger.turns.at(-1)
    const lastDone = [...ledger.turns].reverse().find(t => t.input !== undefined)
    const used = lastDone ? contextAfter(lastDone) : undefined
    const pct = used !== undefined && window ? Math.round((used / window) * 100) : undefined

    /** Bar cells for a turn: system, earlier, new input, output, then free. */
    const turnBar = (t: Turn, w: number, key: string) => {
      if (!window || t.input === undefined) return <Text key={key} color={BAR.free}>{'░'.repeat(w)}</Text>
      const stack = inputStack(ledger, t)
      const sum = (kinds: BlockKind[]) => stack.filter(b => kinds.includes(b.kind)).reduce((s, b) => s + b.tokens, 0)
      const segs = [sum(['system']), sum(['history']), sum(['user', 'tool_result']), t.output ?? 0]
      const cells = barCells(segs, window, w)
      const free = Math.max(0, w - cells.reduce((s, c) => s + c, 0))
      const colors = [BAR.system, BAR.history, BAR.added, BAR.output]
      return (
        <Text key={key}>
          {cells.map((c, i) => (c ? <Text key={`s${i}`} color={colors[i]}>{'█'.repeat(c)}</Text> : null))}
          <Text key="free" color={BAR.free}>{'░'.repeat(free)}</Text>
        </Text>
      )
    }

    const chip = (b: Block, w: number, key: string) => {
      const s = STYLE[b.kind]
      const tok = b.kind === 'truncated' ? '' : `${b.isEstimate ? '~' : ''}${fmtTokens(b.tokens)}`
      const labelW = Math.max(4, w - tok.length - 5)
      const text = ` ${s.icon} ${cell(b.label, labelW)} ${tok.padStart(tok.length)} `
      return (
        <Box key={key} width={w} height={1} flexShrink={0}>
          <Text backgroundColor={s.bg} color={b.isError ? '#ff8f80' : s.fg} italic={b.kind === 'truncated'}>
            {sp(cell(text, w))}
          </Text>
        </Box>
      )
    }

    const section = (title: string, rail: string, blocks: Block[], w: number, key: string) => (
      <Box key={key} flexDirection="column">
        <Text key="t">
          <Text color={rail}>{'┃ '}</Text>
          <Text color={rail} bold>{title}</Text>
        </Text>
        {blocks.map((b, i) => (
          <Box key={`b${i}`} flexDirection="row">
            <Text color={rail}>{sp('┃ ')}</Text>
            {chip(b, w - 2, `c${i}`)}
          </Box>
        ))}
      </Box>
    )

    const detail = (t: Turn) => {
      const w = width - 3
      const stack = inputStack(ledger, t)
      const cached = t.cacheRead ? ` · ${fmtTokens(t.cacheRead)} cached` : ''
      const inTitle = t.input !== undefined ? `INPUT  ${fmtTokens(t.input)}${cached}` : 'INPUT  sending…'
      const outTitle =
        t.status === 'streaming' ? 'OUTPUT  streaming…' : t.output !== undefined ? `OUTPUT  +${fmtTokens(t.output)}` : 'OUTPUT  none'
      const answer = t.answer.length ? t.answer : []
      return (
        <Box key={`d${t.n}`} flexDirection="column" marginLeft={2} marginBottom={1}>
          {section(inTitle, INPUT_RAIL, stack, w, 'in')}
          {section(outTitle, OUTPUT_RAIL, answer, w, 'out')}
          <Text key="meta" dimColor>
            {fit(
              [t.model, t.stopReason ?? '', t.isCompacted ? 'compacted before this turn' : '']
                .filter(Boolean)
                .join(' · '),
              w,
            )}
          </Text>
        </Box>
      )
    }

    const row = (t: Turn) => {
      const isOpenRow = expanded.has(t.n)
      const after = contextAfter(t)
      const right = after !== undefined ? fmtTokens(after) : '…'
      const barW = Math.max(6, Math.min(18, Math.floor(width / 4)))
      const labelW = Math.max(6, width - barW - 15)
      const label = `#${t.n} ${gist(t)}`
      const mark = t.status === 'failed' ? '✗' : isOpenRow ? '▾' : '▸'
      const markColor = t.status === 'failed' ? 'red' : t === live ? 'yellow' : INPUT_RAIL
      return (
        <Box key={`r${t.n}`} flexDirection="row">
          <Text key="m" color={markColor}>{sp(`${mark} `)}</Text>
          <Button
            key={`${KEY}${t.n}`}
            plain
            dimColor={!isOpenRow && t !== live}
            label={sp(cell(label, labelW))}
            onPress={noop}
          />
          <Text key="g">{sp(' ')}</Text>
          {turnBar(t, barW, 'bar')}
          <Text key="n" color="#c9c9c9">{sp(` ${right.padStart(6)}`)}</Text>
        </Box>
      )
    }

    const body: RenderChildren[] = []
    let prompt: string | undefined
    for (const t of ledger.turns) {
      if (t.step === 0 || t.prompt !== prompt) {
        prompt = t.prompt
        body.push(
          <Box key={`p${t.n}`} marginTop={body.length ? 1 : 0}>
            <Text color={INPUT_RAIL} bold wrap="truncate-end">
              {fit(`❯ ${t.prompt ? t.prompt.replace(/\s+/g, ' ') : '(continuation)'}`, width)}
            </Text>
          </Box>,
        )
      }
      body.push(row(t))
      if (expanded.has(t.n)) body.push(detail(t))
    }

    const legend = (
      <Text key="legend">
        <Text color={BAR.system}>{'■'}</Text>
        <Text dimColor>{sp(' system  ')}</Text>
        <Text color={BAR.history}>{'■'}</Text>
        <Text dimColor>{sp(' earlier  ')}</Text>
        <Text color={BAR.added}>{'■'}</Text>
        <Text dimColor>{sp(' new  ')}</Text>
        <Text color={BAR.output}>{'■'}</Text>
        <Text dimColor>{sp(' output')}</Text>
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Text key="h" bold>
          <Text color={INPUT_RAIL}>{'Context window  '}</Text>
          {sp(`${fmtTokens(used)} / ${fmtTokens(window)}`)}
          {pct !== undefined ? <Text color={pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green'}>{sp(`  ${pct}%`)}</Text> : null}
        </Text>
        {last ? turnBar(lastDone ?? last, width, 'big') : <Text key="big" color={BAR.free}>{'░'.repeat(width)}</Text>}
        {legend}
        <Box key="list" flexDirection="column" marginTop={1}>
          {ledger.turns.length === 0 ? (
            <Text dimColor>{fit('No turns yet: send a prompt and each request shows up here.', width)}</Text>
          ) : (
            body
          )}
        </Box>
        <Box key="foot" marginTop={1} flexDirection="column">
          <Box key="toolbar" flexDirection="row" columnGap={1}>
            <Button key="follow" label={follow ? 'following' : 'follow'} hotkey="f" onPress={noop} />
            <Button key="collapse" label="collapse" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text dimColor>{fit('▸ expand a turn · ~ estimated split of a real total', width)}</Text>
        </Box>
      </Box>
    )
  })
}

/** Desktop and the remote surfaces collapse runs of spaces; keep them. */
function spacer(surface: RenderSurface): (s: string) => string {
  return surface === 'terminal' ? s => s : s => s.replace(/ /g, '\u00a0')
}

function safeJson(v: unknown): string {
  try {
    return typeof v === 'string' ? v : (JSON.stringify(v) ?? '')
  } catch {
    return ''
  }
}
