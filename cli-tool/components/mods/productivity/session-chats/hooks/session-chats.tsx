/**
 * session-chats — Claude Mod
 *
 * Keeps a record of every conversation between Claude Code sessions (one
 * session's SendMessage to another, and the replies) and shows it in a side
 * pane, so who was talking to whom survives after those sessions close. Each
 * conversation has a button that opens a closed session again in a new
 * terminal (`claude --resume <id>` in its own folder).
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
 * Needs Claude Code >= 2.1.287 (cross-session messages recorded live on 2.1.312).
 *
 * Options (pluginConfigs["session-chats@skills-dir"].options):
 *   terminal: auto|Terminal|iTerm|tmux|copy  how Open starts the session (default auto)
 *   keepDays: number   forget logs not written for this many days (default 90)
 *   columns:  number   width asked for the docked pane (default 72)
 */
import type { EngineInterface, Register, RenderChildren, RenderSurface } from 'claude-code'
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
  sideOf,
  stale,
  tmuxLiteral,
  windowName,
} from './chats.ts'
import type { Conversation, Live, Log, Side } from './chats.ts'

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

let convs: Conversation[] = []
let live: Live[] = []
/** Session ids whose process answered `kill -0`. */
let running = new Set<string>()
let me: Side = {}
let home = ''
let isOpen = false
let note: string | undefined
const expanded = new Set<string>()
const folded = new Set<string>()
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
        description: 'Conversations between your Claude Code sessions, with a button to reopen each one (close)',
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
    const hint = e.presentation?.isFullscreen ? 'click a conversation to open it' : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `${convs.length} conversation${convs.length === 1 ? '' : 's'} · ${hint} · /${COMMAND} close` }
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
    } else if (key.startsWith('conv:')) {
      const ck = key.slice(5)
      const isShown = expanded.has(ck) || (!folded.has(ck) && convs[0] && hash(convs[0].key) === ck)
      if (isShown) {
        expanded.delete(ck)
        folded.add(ck)
      } else {
        folded.delete(ck)
        expanded.add(ck)
      }
    } else if (key.startsWith('open:') || key.startsWith('copy:')) {
      const [verb, ck, end] = key.split(':')
      const c = convs.find(x => hash(x.key) === ck)
      const side = c && (end === 'a' ? c.a : c.b)
      if (side && canResume(side)) {
        const cmd = resumeCommand(side)
        if (verb === 'copy') {
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

    const top = (
      <Box key="top" flexDirection="column" borderStyle="round" borderColor={LINE} paddingX={1} marginBottom={1}>
        <Text key="t">
          <Text color={ORANGE} bold>{'◆ '}</Text>
          <Text bold color={IVORY}>{'Session chats'}</Text>
          <Text color={DIM}>{sp(`   ${convs.length} conversation${convs.length === 1 ? '' : 's'}`)}</Text>
        </Text>
        <Text key="s" color={DIM} wrap="truncate-end">
          {sp(`this session  ${label(me)}  ${shortPath(me.cwd, home, Math.max(8, width - label(me).length - 20))}`)}
        </Text>
      </Box>
    )

    const body: RenderChildren[] = []
    if (convs.length === 0) {
      body.push(
        <Box key="empty" flexDirection="column">
          <Text key="a" color={IVORY}>{'No conversations yet.'}</Text>
          <Text key="b" color={DIM} wrap="wrap">
            {'When a session sends a message to another one (SendMessage), or gets one, the conversation shows up here and stays after both close.'}
          </Text>
        </Box>,
      )
    }

    convs.forEach((c, i) => {
      const ck = hash(c.key)
      const isShown = expanded.has(ck) || (i === 0 && !folded.has(ck))
      const isMine = c.a.id !== undefined && c.a.id === me.id
      const title = isMine ? label(c.b) : `${label(c.a)}  ⇄  ${label(c.b)}`
      const when = ago(c.lastAt, now)
      const titleW = Math.max(8, width - 4 - when.length - 1)
      const last = c.lines[c.lines.length - 1]
      const count = `${c.lines.length} message${c.lines.length === 1 ? '' : 's'}`
      const facts = isMine
        ? withPath([state(c.b), count].filter(Boolean).join(' · '), c.b.cwd, width - 3)
        : [`${folder(c.a.cwd)} ⇄ ${folder(c.b.cwd)}`, count].join(' · ')

      const rows: RenderChildren[] = [
        <Box key="h" flexDirection="row" width={width} backgroundColor={ROW_BG}>
          <Text key="m" color={ORANGE} backgroundColor={ROW_BG} bold>{sp(isShown ? ' ▾ ' : ' ▸ ')}</Text>
          <Button key={`conv:${ck}`} plain label={sp(cell(title, titleW))} hover={{ color: ORANGE }} onPress={noop} />
          <Text key="w" color={GRAY} backgroundColor={ROW_BG}>{sp(cell(when, when.length + 1, 'right'))}</Text>
        </Box>,
        <Text key="f" color={DIM} wrap="truncate-end">{sp(`   ${fit(facts, width - 3)}`)}</Text>,
      ]

      if (!isShown && last) {
        rows.push(
          <Text key="p" wrap="truncate-end">
            <Text color={ORANGE}>{sp(isMine ? `   ${last.by === 'a' ? '→' : '←'} ` : `   ${label(last.by === 'a' ? c.a : c.b)}: `)}</Text>
            <Text color={GRAY}>{sp(oneLine(last.text))}</Text>
          </Text>,
        )
      }

      if (isShown) {
        const shown = c.lines.slice(-8)
        if (c.lines.length > shown.length) rows.push(<Text key="more" color={DIM}>{sp(`   … ${c.lines.length - shown.length} earlier`)}</Text>)
        shown.forEach((m, j) => {
          const who = m.by === 'a' ? (isMine ? 'you' : label(c.a)) : label(c.b)
          rows.push(
            <Box key={`l${j}`} flexDirection="column" marginTop={j === 0 ? 1 : 0}>
              <Text key="w">
                <Text color={m.by === 'a' && isMine ? ORANGE : IVORY} bold>{sp(`   ${who}`)}</Text>
                <Text color={DIM}>{sp(`  ${clock(m.at)}`)}</Text>
              </Text>
              <Box key="t" paddingLeft={3}>
                <Text color={GRAY} wrap="wrap">
                  {fit(m.text, 600)}
                </Text>
              </Box>
            </Box>,
          )
        })
        const ends: ['a' | 'b', Side][] = isMine ? [['b', c.b]] : [['a', c.a], ['b', c.b]]
        const nameW = Math.min(18, Math.max(...ends.map(([, s]) => Array.from(label(s)).length)))
        ends.forEach(([end, s], j) => {
          const st = state(s)
          const lead = <Text key="n" color={IVORY}>{sp(`   ${cell(label(s), nameW)}  `)}</Text>
          let row: RenderChildren
          if (!canResume(s)) {
            const why = s.address && !s.address.startsWith('uds:') ? 'remote session, not on this machine' : 'session id unknown'
            row = [lead, <Text key="x" color={DIM}>{sp(why)}</Text>]
          } else if (st) {
            row = [lead, <Text key="x" color={DIM}>{sp(`${st}  `)}</Text>, <Button key={`copy:${ck}:${end}`} label="copy command" hover={{ color: ORANGE }} onPress={noop} />]
          } else {
            row = [lead, <Button key={`open:${ck}:${end}`} label={sp('Open ↗')} hover={{ color: ORANGE }} onPress={noop} />, <Text key="g">{' '}</Text>, <Button key={`copy:${ck}:${end}`} label="copy command" hover={{ color: ORANGE }} onPress={noop} />]
          }
          rows.push(
            <Box key={`act${end}`} flexDirection="row" marginTop={j === 0 ? 1 : 0}>
              {row}
            </Box>,
          )
        })
      }

      body.push(
        <Box key={`c${ck}`} flexDirection="column" marginBottom={1}>
          {rows}
        </Box>,
      )
    })

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
          <Text key="hint" color={DIM}>{sp(fit('click a conversation to open or fold it · Open resumes a closed session in a new terminal', width))}</Text>
        </Box>
      </Box>
    )
  })
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

/** `facts · path`, the path cut at the front to fit `width`. */
function withPath(facts: string, path: string | undefined, width: number): string {
  const room = width - Array.from(facts).length - 3
  return path && room >= 8 ? `${facts} · ${shortPath(path, home, room)}` : facts
}

/** The last folder of a path: `api`. */
function folder(path: string | undefined): string {
  return path ? path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path : '?'
}

/** `15:48`, or `Oct 27` for another day. */
function clock(at: number): string {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Desktop and the remote surfaces collapse runs of spaces; keep them. */
function spacer(surface: RenderSurface): (s: string) => string {
  return surface === 'terminal' ? s => s : s => s.replace(/ /g, ' ')
}
