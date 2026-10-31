/**
 * session-chats — Claude Mod
 *
 * Keeps a record of every conversation between Claude Code sessions (one
 * session's SendMessage to another, and the replies) and draws it in a side
 * pane as a graph: a node per session, an arrow per conversation. Who was
 * talking to whom survives after those sessions close, and the selected
 * session opens again in a new terminal (`claude --resume <id>` in its folder).
 *
 *   `/chats` opens the pane · `/chats close` closes it
 *
 * What it hooks: `session.send` (a message leaving this session for another)
 * and `session.receive` (a `<cross-session-message>` arriving). Both only
 * observe and pass the message on unchanged. Which session a name or address
 * belongs to, and its folder, come from Claude Code's live-session registry
 * (`~/.claude/sessions/<pid>.json`) at the moment of the message. The record
 * is the mod's own store (`~/.claude/plugins/store/`), one key per session.
 *
 * Needs Claude Code >= 2.1.287 (recorded live on 2.1.312, graph drawn live on 2.1.314).
 *
 * Options (pluginConfigs["session-chats@skills-dir"].options):
 *   terminal: auto|Terminal|iTerm|tmux|copy  how Open starts the session (default auto)
 *   keepDays: number   forget logs not written for this many days (default 90)
 *   columns:  number   width asked for the docked pane (default 72)
 */
import type { ElementTable, EngineInterface, Register, RenderChildren, RenderSurface } from 'claude-code'
import {
  ago,
  appleQuote,
  asLog,
  bareAddress,
  canResume,
  cell,
  conversations,
  emptyLog,
  findLive,
  findSelf,
  fit,
  hash,
  label,
  looksLikeSession,
  oneLine,
  parseEnvelope,
  parseRegistry,
  record,
  resumeCommand,
  shortPath,
  sideKey,
  sideOf,
  stale,
  tmuxLiteral,
  windowName,
} from './chats.ts'
import type { Conversation, Live, Log, Side } from './chats.ts'
import { buildGraph, drawCells, drawSvg, layout } from './graph.ts'
import type { Graph, Node as GraphNode, Paint, SvgColors } from './graph.ts'

const PANE = 'session-chats'
const COMMAND = 'chats'
const PREFIX = 'log:'
const TERMINALS = ['auto', 'Terminal', 'iTerm', 'tmux', 'copy'] as const
type How = (typeof TERMINALS)[number]

// Anthropic's palette: ivory text, warm grays, one orange accent
const ORANGE = '#d97757'
const IVORY = '#faf9f5'
const GRAY = '#b0aea5'
const DIM = '#87867f'
const LINE = '#5e5d59'
const ROW_BG = '#3d3d3a'
/** What an `Svg` source may hold. */
const SVG_MAX = 131072

const PAINT: Record<Paint, string | undefined> = {
  node: LINE,
  nodeSel: ORANGE,
  name: IVORY,
  nameSel: ORANGE,
  sub: DIM,
  dotOn: ORANGE,
  dotOff: DIM,
  edge: GRAY,
  edgeSel: ORANGE,
  edgeDim: DIM,
  blank: undefined,
}

// the SVG is a picture with its own dark card, so it reads on a light or a dark panel
const SVG_COLORS: SvgColors = {
  bg: '#1f1e1d',
  node: LINE,
  nodeSel: ORANGE,
  fill: '#30302e',
  name: IVORY,
  sub: DIM,
  on: ORANGE,
  off: DIM,
  edge: GRAY,
  edgeSel: ORANGE,
  edgeDim: DIM,
}

let convs: Conversation[] = []
let live: Live[] = []
/** Session ids whose process answered `kill -0`. */
let running = new Set<string>()
let me: Side = {}
let home = ''
let isOpen = false
let note: string | undefined
/** The selected node's key; undefined selects this session. */
let selected: string | undefined
/** Only running sessions and the links between them. */
let isActive = false
let timer: { cancel: () => void } | undefined
let keepDays = 90
let writing: Promise<void> = Promise.resolve()

export const register: Register = (on, options) => {
  const how: How = (TERMINALS as readonly string[]).includes(String(options.terminal)) ? (options.terminal as How) : 'auto'
  keepDays = typeof options.keepDays === 'number' && options.keepDays > 0 ? options.keepDays : 90
  const columns = Math.min(140, Math.max(40, typeof options.columns === 'number' ? Math.round(options.columns) : 72))

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Graph of the sessions that messaged each other, with a button to reopen each one (close)',
        argumentHint: '[close]',
        immediate: true,
      })
      .catch(err => $.ui.log(`session-chats: /${COMMAND} not registered: ${err}`))
    return r
  })

  // a message this session sends to another one
  on('session.send', async ($, e, next) => {
    const r = await next(e)
    if (!r.isDelivered) return r
    try {
      await reread($)
      const to = bareAddress(e.to)
      if (!looksLikeSession(to, live)) return r
      const hit = findLive(live, to)
      await write($, hit ? sideOf(hit) : { address: to }, 'self', e.text)
    } catch (err) {
      $.ui.log(`session-chats: send not recorded: ${err}`)
    }
    return r
  }).catch(($, e, next) => next(e))

  // a message another session sent here
  on('session.receive', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || r.consumed !== undefined) return r
    if (e.origin.kind !== 'peer' && e.origin.kind !== 'peer-send-message') return r
    const env = parseEnvelope(e.text)
    if (!env) return r
    try {
      await reread($)
      // the address is the engine's; the name is only what the sender says it is
      const hit = findLive(live, env.from)
      const peer: Side = hit ? sideOf(hit) : { address: env.from, name: env.name }
      await write($, peer, 'peer', env.body)
    } catch (err) {
      $.ui.log(`session-chats: message not recorded: ${err}`)
    }
    return r
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'close' || arg === 'stop') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'session-chats closed' }
    }
    await reread($)
    try {
      await $.ui.open({ id: PANE, title: 'chats', focus: true, columns })
    } catch (err) {
      return { text: `session-chats: pane not opened: ${err}` }
    }
    isOpen = true
    timer?.cancel()
    // other sessions write their side while the pane is open
    timer = $.clock.every(20_000, () => {
      void reread($).then(() => $.ui.invalidate('ui.render'), () => undefined)
    })
    $.ui.invalidate('ui.render')
    const hint = e.presentation?.isFullscreen ? 'press 1–9 to select a session' : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    const { g } = view()
    return { text: `${g.nodes.length} session${g.nodes.length === 1 ? '' : 's'} · ${g.edges.length} link${g.edges.length === 1 ? '' : 's'} · ${hint} · /${COMMAND} close` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    timer?.cancel()
    timer = undefined
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
    if (key === 'refresh') {
      note = undefined
      await reread($)
    } else if (key === 'filter:all' || key === 'filter:active') {
      isActive = key === 'filter:active'
    } else if (key.startsWith('node:')) {
      const n = view().g.nodes.find(x => hash(x.key) === key.slice(5))
      if (n) selected = n.key
      note = undefined
    } else if (key === 'open' || key === 'copy') {
      const side = view().sel?.side
      if (side && canResume(side)) {
        const cmd = resumeCommand(side)
        if (key === 'copy') {
          const { isCopied } = await $.ui.copy({ text: cmd }).catch(() => ({ isCopied: false }))
          note = isCopied ? `copied: ${cmd}` : `run in a terminal: ${cmd}`
        } else {
          const opened = await openTerminal($, how, side, cmd)
          if (opened) {
            note = `${label(side)} opened in ${opened}`
          } else {
            const { isCopied } = await $.ui.copy({ text: cmd }).catch(() => ({ isCopied: false }))
            note = `${isCopied ? 'no terminal to open here; command copied' : 'run in a terminal'}: ${cmd}`
          }
        }
        $.ui.toast(note)
      }
    }
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(32, e.props.bodyColumns - 1)
    const sp = spacer(e.surface)
    const noop = () => {}
    const now = await $.clock.now()
    const { g, layers, sel } = view()
    const links = g.edges.length

    const top = (
      <Box key="top" flexDirection="column" borderStyle="round" borderColor={LINE} paddingX={1} marginBottom={1}>
        <Text key="t">
          <Text color={ORANGE} bold>{'◆ '}</Text>
          <Text bold color={IVORY}>{'Session flow'}</Text>
          <Text color={DIM}>{sp(`   ${g.nodes.length} session${g.nodes.length === 1 ? '' : 's'} · ${links} link${links === 1 ? '' : 's'}`)}</Text>
        </Text>
        <Box key="f" flexDirection="row" columnGap={1}>
          <Button key="filter:all" label="All" dimColor={isActive} hover={{ color: ORANGE }} onPress={noop} />
          <Button key="filter:active" label="Active" dimColor={!isActive} hover={{ color: ORANGE }} onPress={noop} />
        </Box>
      </Box>
    )

    const body: RenderChildren[] = []
    if (g.nodes.length === 0) {
      body.push(
        <Box key="empty" flexDirection="column" marginBottom={1}>
          <Text key="a" color={IVORY}>{isActive && convs.length > 0 ? 'No running sessions in your conversations.' : 'No conversations yet.'}</Text>
          <Text key="b" color={DIM} wrap="wrap">
            {isActive && convs.length > 0
              ? 'Press All to see the sessions that have closed.'
              : 'When a session sends a message to another one (SendMessage), or gets one, both show up here and stay after they close.'}
          </Text>
        </Box>,
      )
    } else if (e.surface === 'terminal') {
      const rows = drawCells(g, layers, width, sel?.key)
      if (rows) {
        body.push(
          <Box key="graph" flexDirection="column" marginBottom={1}>
            {rows.map((runs, y) => (
              <Text key={`g${y}`} wrap="truncate-end">
                {runs.map((run, i) => (
                  <Text key={`r${i}`} color={PAINT[run.paint]} bold={run.paint === 'name' || run.paint === 'nameSel'}>
                    {run.text}
                  </Text>
                ))}
              </Text>
            ))}
          </Box>,
        )
      } else {
        body.push(<Text key="narrow" color={DIM} wrap="wrap">{'Too many sessions side by side for this width: widen the pane to see the graph.'}</Text>)
      }
    } else {
      const { Svg } = $.ui.resolve(e)
      const svg = drawSvg(g, layers, sel?.key, SVG_COLORS)
      if (svg.source.length > SVG_MAX) {
        body.push(<Text key="narrow" color={DIM} wrap="wrap">{'Too many sessions to draw: select one below to see its links.'}</Text>)
      } else body.push(
        <Box key="graph" flexDirection="column" marginBottom={1}>
          <Svg key="svg" source={svg.source} alt={`${g.nodes.length} sessions, ${links} links${sel ? `; ${label(sel.side)} selected` : ''}`} />
        </Box>,
      )
    }

    // one row per node: what selects it (a click or its digit)
    const nameW = Math.min(20, Math.max(4, ...g.nodes.map(n => Array.from(label(n.side)).length)))
    const order = layers.flat()
    body.push(
      <Box key="nodes" flexDirection="column" marginBottom={1}>
        {order.map((n, i) => {
          const isSel = n.key === sel?.key
          const bg = isSel ? ROW_BG : undefined
          const facts = [n.isRunning ? 'running' : 'closed', n.isSelf ? 'this session' : n.sub].filter(Boolean).join(' · ')
          return (
            <Box key={`row${hash(n.key)}`} flexDirection="row" width={width} backgroundColor={bg}>
              <Text key="m" color={n.isRunning ? ORANGE : DIM} backgroundColor={bg}>{sp(n.isRunning ? ' ● ' : ' ○ ')}</Text>
              <Button
                key={`node:${hash(n.key)}`}
                plain
                hotkey={i < 9 ? String(i + 1) : undefined}
                label={sp(cell(label(n.side), nameW))}
                hover={{ color: ORANGE }}
                onPress={noop}
              />
              <Text key="f" color={DIM} backgroundColor={bg} wrap="truncate-end">{sp(`  ${facts}`)}</Text>
            </Box>
          )
        })}
      </Box>,
    )

    if (sel) body.push(detail(sel, g, now, width, sp, { Box, Text, Button }))

    return (
      <Box flexDirection="column">
        {top}
        {body}
        <Box key="foot" flexDirection="column">
          {note ? <Text key="note" color={ORANGE} wrap="wrap">{sp(note)}</Text> : null}
          <Box key="toolbar" flexDirection="row" columnGap={1}>
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text key="hint" color={DIM}>{sp(fit(`1–${Math.min(9, Math.max(1, order.length))} select a session · dashed: not answered yet · r refresh`, width))}</Text>
        </Box>
      </Box>
    )
  })
}

/** The graph the pane shows now, its layers, and the selected node (this session by default). */
function view(): { g: Graph; layers: GraphNode[][]; sel: GraphNode | undefined } {
  const g = buildGraph(convs, running, me.id, isActive)
  const layers = layout(g)
  const sel = g.nodes.find(n => n.key === selected) ?? g.nodes.find(n => n.isSelf) ?? layers[0]?.[0]
  return { g, layers, sel }
}

type Parts = Pick<ElementTable<'terminal'>, 'Box' | 'Text' | 'Button'>

/** The selected session: its links, the last message on each, and Open. */
function detail(n: GraphNode, g: Graph, now: number, width: number, sp: (s: string) => string, { Box, Text, Button }: Parts): RenderChildren {
  const noop = () => {}
  const s = n.side
  const mine = g.edges.filter(x => x.from === n.key || x.to === n.key).sort((x, y) => y.lastAt - x.lastAt)
  const byKey = new Map(g.nodes.map(x => [x.key, x]))
  const st = state(s)
  const where = shortPath(s.cwd, home, Math.max(8, width - 6))

  const rows: RenderChildren[] = [
    <Text key="n">
      <Text color={n.isRunning ? ORANGE : DIM}>{n.isRunning ? '● ' : '○ '}</Text>
      <Text color={IVORY} bold>{label(s)}</Text>
      <Text color={DIM}>{sp(`  ${n.isSelf ? 'this session' : st ?? 'closed'}`)}</Text>
    </Text>,
  ]
  if (s.cwd) rows.push(<Text key="p" color={DIM} wrap="truncate-end">{sp(where)}</Text>)

  mine.forEach((x, i) => {
    const isOut = x.from === n.key
    const other = byKey.get(isOut ? x.to : x.from)
    const last = x.conv.lines[x.conv.lines.length - 1]
    // conversations() puts this session on side a; any other node can be either
    const lastIsOther = last && (sideKey(last.by === 'a' ? x.conv.a : x.conv.b) !== n.key)
    const facts = `${x.count} message${x.count === 1 ? '' : 's'} · ${ago(x.lastAt, now)}${x.isAnswered ? '' : ' · not answered yet'}`
    rows.push(
      <Box key={`l${i}`} flexDirection="column" marginTop={i === 0 ? 1 : 0}>
        <Text key="h" wrap="truncate-end">
          <Text color={ORANGE}>{isOut ? '↗ ' : '↙ '}</Text>
          <Text color={IVORY}>{sp(`${isOut ? 'to' : 'from'} ${other ? label(other.side) : '?'}`)}</Text>
          <Text color={DIM}>{sp(`  ${facts}`)}</Text>
        </Text>
        {last ? (
          <Text key="m" wrap="truncate-end">
            <Text color={DIM}>{sp(`  ${lastIsOther ? `${other ? label(other.side) : '?'}: ` : ''}`)}</Text>
            <Text color={GRAY}>{sp(oneLine(last.text))}</Text>
          </Text>
        ) : null}
      </Box>,
    )
  })

  let actions: RenderChildren
  if (n.isSelf) {
    actions = null
  } else if (!canResume(s)) {
    actions = <Text key="x" color={DIM}>{s.address && !s.address.startsWith('uds:') ? 'remote session, not on this machine' : 'session id unknown: cannot reopen it'}</Text>
  } else if (st) {
    actions = [<Text key="x" color={DIM}>{sp('still running  ')}</Text>, <Button key="copy" label="copy command" hover={{ color: ORANGE }} onPress={noop} />]
  } else {
    actions = [<Button key="open" label={sp('Open ↗')} hotkey="o" hover={{ color: ORANGE }} onPress={noop} />, <Text key="g">{' '}</Text>, <Button key="copy" label="copy command" hover={{ color: ORANGE }} onPress={noop} />]
  }

  return (
    <Box key="detail" flexDirection="column" borderStyle="round" borderColor={ORANGE} paddingX={1} marginBottom={1}>
      {rows}
      {actions ? (
        <Box key="act" flexDirection="row" marginTop={1}>
          {actions}
        </Box>
      ) : null}
    </Box>
  )
}

/** Reads the registry and every session's log again. */
async function reread($: EngineInterface): Promise<void> {
  const [id, cwd, configDir, homeDir, profile] = await Promise.all([
    $.session.id(),
    $.session.cwd(),
    $.env.get('CLAUDE_CONFIG_DIR'),
    $.env.get('HOME'),
    $.env.get('USERPROFILE'),
  ])
  home = (homeDir ?? profile ?? '').replace(/\\/g, '/')
  const cfg = (configDir ?? `${home}/.claude`).replace(/\\/g, '/')
  const dir = `${cfg}/sessions`
  const entries = await $.fs.list(dir).catch(() => [])
  const texts = await Promise.all(
    entries.filter(f => f.kind === 'file' && f.name.endsWith('.json')).map(f => $.fs.read(`${dir}/${f.name}`).then(t => (typeof t === 'string' ? t : ''), () => '')),
  )
  live = parseRegistry(texts)
  const self = findSelf(live, id, cwd)
  me = self ? sideOf(self) : { id, cwd }

  const logs: [string, Log][] = []
  for (const k of await $.store.keys().catch(() => [] as string[])) {
    if (!k.startsWith(PREFIX)) continue
    const l = asLog(await $.store.get(k).catch(() => undefined))
    if (l) logs.push([k, l])
  }
  const now = await $.clock.now()
  const old = new Set(stale(logs, now, keepDays))
  for (const k of old) await $.store.delete(k).catch(() => undefined)
  convs = conversations(
    logs.filter(([k]) => !old.has(k)).map(([, l]) => l),
    id,
  )

  // a registry file outlives a crashed process: ask the pid
  const alive = new Set<string>()
  const ids = new Set(convs.flatMap(c => [c.a.id, c.b.id]).filter((x): x is string => !!x && x !== id))
  for (const l of live) {
    if (!ids.has(l.sessionId)) continue
    const ok = await $.process
      .run(['kill', '-0', String(l.pid)], { timeoutMs: 2000 })
      .then(res => res.exitCode === 0, () => true)
    if (ok) alive.add(l.sessionId)
  }
  running = alive
  // a resumed session gets a new name: show the one it has now
  for (const c of convs) {
    for (const side of [c.a, c.b]) {
      const row = side.id && alive.has(side.id) ? live.find(l => l.sessionId === side.id) : undefined
      if (row?.name) side.name = row.name
    }
  }
}

/** Appends to this session's log, one write at a time so a send and a reply never overwrite each other. */
async function write($: EngineInterface, peer: Side, from: 'self' | 'peer', text: string): Promise<void> {
  const id = await $.session.id()
  const now = await $.clock.now()
  const key = `${PREFIX}${id}`
  const turn = writing.then(async () => {
    const log = asLog(await $.store.get(key)) ?? emptyLog(me, now)
    await $.store.set(key, record(log, me, peer, { at: now, from, text }, now))
  })
  writing = turn.catch(() => undefined)
  await turn
  if (isOpen) {
    await reread($)
    $.ui.invalidate('ui.render')
  }
}

/** `running · idle`, `running · busy`, or undefined for a closed session. */
function state(s: Side): string | undefined {
  if (!s.id || !running.has(s.id)) return undefined
  const l = live.find(x => x.sessionId === s.id)
  return `running${l?.status ? ` · ${l.status}` : ''}${l?.tmux ? ` · tmux ${l.tmux.split(':')[0]}` : ''}`
}

/** Starts `cmd` in a new terminal the way `how` says; resolves where it did, or undefined. */
async function openTerminal(
  $: EngineInterface,
  how: How,
  side: Side & { id: string; cwd: string },
  cmd: string,
): Promise<string | undefined> {
  if (how === 'copy') return undefined
  try {
    if (how === 'tmux' || (how === 'auto' && (await $.env.get('TMUX')))) {
      const res = await $.process.run(['tmux', 'new-window', '-c', tmuxLiteral(side.cwd), '-n', windowName(label(side)), 'claude', '--resume', side.id])
      if (res.exitCode === 0) return 'a new tmux window'
      if (how === 'tmux') return undefined
    }
    const os = await $.process.run(['uname', '-s'])
    if (os.stdout.trim() !== 'Darwin') return undefined
    if (how === 'iTerm') {
      const res = await $.process.run([
        'osascript',
        '-e',
        'tell application "iTerm" to create window with default profile',
        '-e',
        `tell application "iTerm" to tell current session of current window to write text ${appleQuote(cmd)}`,
        '-e',
        'tell application "iTerm" to activate',
      ])
      return res.exitCode === 0 ? 'iTerm' : undefined
    }
    const res = await $.process.run(['osascript', '-e', `tell application "Terminal" to do script ${appleQuote(cmd)}`, '-e', 'tell application "Terminal" to activate'])
    return res.exitCode === 0 ? 'Terminal' : undefined
  } catch {
    return undefined
  }
}

/** Desktop and the remote surfaces collapse runs of spaces; keep them. */
function spacer(surface: RenderSurface): (s: string) => string {
  return surface === 'terminal' ? s => s : s => s.replace(/ /g, ' ')
}
