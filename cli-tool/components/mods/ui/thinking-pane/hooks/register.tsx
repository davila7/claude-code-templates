import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Agent, Item, Thought, Tree, Turn } from '../types'

const PANE = 'thinking'
const TITLE = 'Thinking'
const TURNS_KEPT = 25
const THOUGHT_MAX = 40000
// Turns that draw their contents unasked; older ones fold to their headers,
// so a long session doesn't lay out every kept thought on each redraw.
const TURNS_OPEN = 3

// Bump the shape tag when Tree changes: it declines what an older version stored.
const treeAtom = atom({ plugin: 'thinking-pane', key: 'tree' } as const, { turns: [], agents: {} }, { shape: 'tree-1' })
const toggledAtom = atom({ plugin: 'thinking-pane', key: 'toggled' } as const, {})
const tickAtom = atom({ plugin: 'thinking-pane', key: 'tick' } as const, 0)
// Which agent page the pane shows: the path of agent ids from main down; empty is main.
const pageAtom = atom({ plugin: 'thinking-pane', key: 'page' } as const, [])

const C = {
  main: '#89b4fa',
  time: '#94e2d5',
  dim: '#9399b2',
  border: '#45475a',
  live: '#a6e3a1',
  liveInk: '#1e1e2e',
  pill: '#313244',
  prompt: '#b4befe',
  promptText: '#cdd6f4',
  path: '#f9e2af',
  code: '#f5c2e7',
}
const AGENT_COLORS: Record<string, string> = {
  Plan: '#cba6f7',
  Explore: '#a6e3a1',
  'general-purpose': '#fab387',
}
const CYCLE = ['#f5c2e7', '#89dceb', '#f9e2af', '#eba0ac', '#b4befe', '#74c7ec']

function agentColor(type: string): string {
  const known = AGENT_COLORS[type]
  if (known) return known
  let sum = 0
  for (const ch of type) sum = (sum + ch.charCodeAt(0)) % 997
  return CYCLE[sum % CYCLE.length] ?? C.main
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** Local time, 12-hour: 4:00:28 PM. */
function hms(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  return (h % 12 || 12) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + (h < 12 ? ' AM' : ' PM')
}

/** What a turn began with: the typed prompt, or a name for an automatic one. */
function promptLabel(prompt: string): string {
  const tag = /^\s*<([a-z][a-z-]*)>/.exec(prompt)
  if (tag && tag[1]) return '(' + tag[1].replace(/-/g, ' ') + ')'
  return prompt
}

/** A finished run's length: 12s, 3m 05s. */
function took(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + pad(s % 60) + 's'
}

/** A running timer: 0:14, 3:05. */
function running(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return Math.floor(s / 60) + ':' + pad(s % 60)
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : one.slice(0, Math.max(1, max - 1)) + '…'
}

/** One run of a thought's text, as the pane styles it. */
type Seg = { text: string; kind: 'plain' | 'code' | 'path'; bold: boolean }

const EXT = 'tsx?|jsx?|mjs|cjs|json|jsonc|md|mdx|py|rs|go|rb|java|kt|swift|c|h|cpp|hpp|cs|sh|zsh|bash|fish|toml|ya?ml|ini|conf|cfg|env|css|scss|html|xml|svg|txt|log|lock|sql|vue|svelte|lua|nix|plist'
// Something with a slash in it, or a bare file name with a known extension.
const PATHISH = new RegExp('(?:~|\\.{1,2})?(?:/?[\\w.@+-]+)+/[\\w.@+-]*|\\b[\\w-]+(?:\\.[\\w-]+)*\\.(?:' + EXT + ')\\b', 'g')
const HAS_EXT = new RegExp('\\.(?:' + EXT + ')$')

function isPath(text: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return false
  if (/^(?:~\/|\.{1,2}\/|\/[\w.@+-])/.test(text)) return true
  if (HAS_EXT.test(text)) return true
  return (text.match(/\//g) ?? []).length >= 2
}

/** Splits plain text into plain runs and file-path runs. */
function paths(text: string, bold: boolean): Seg[] {
  const out: Seg[] = []
  let at = 0
  for (const m of text.matchAll(PATHISH)) {
    const start = m.index ?? 0
    // A sentence's own punctuation is not part of the path.
    const raw = m[0].replace(/[.,;:!?]+$/, '')
    // Skip a URL's tail, which PATHISH would otherwise pick up.
    const before = text.slice(Math.max(0, start - 8), start)
    if (!raw || /[a-z]:\/?\/?$/i.test(before) || !isPath(raw)) continue
    if (start > at) out.push({ text: text.slice(at, start), kind: 'plain', bold })
    out.push({ text: raw, kind: 'path', bold })
    at = start + raw.length
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: 'plain', bold })
  return out
}

/**
 * A thought's text as styled runs: **bold** drawn bold, `code` in its own
 * color, file paths in theirs. Markers without a closing pair (a thought
 * still streaming) stay as typed.
 */
function styled(text: string): Seg[] {
  const out: Seg[] = []
  let at = 0
  for (const m of text.matchAll(/\*\*([^*\n]+?)\*\*|`([^`\n]+)`/g)) {
    const start = m.index ?? 0
    if (start > at) out.push(...paths(text.slice(at, start), false))
    if (m[1] !== undefined) out.push(...paths(m[1], true))
    else if (m[2] !== undefined) out.push({ text: m[2], kind: isPath(m[2]) ? 'path' : 'code', bold: false })
    at = start + m[0].length
  }
  if (at < text.length) out.push(...paths(text.slice(at), false))
  return out
}

// A thought's styled runs, kept while its text is unchanged: a redraw only
// parses the thought still streaming.
const styledCache = new Map<string, { length: number; segs: Seg[] }>()

function styledOnce(id: string, text: string): Seg[] {
  const hit = styledCache.get(id)
  if (hit && hit.length === text.length) return hit.segs
  const segs = styled(text.trim())
  if (styledCache.size > 2000) styledCache.clear()
  styledCache.set(id, { length: text.length, segs })
  return segs
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// The working copy hooks mutate; flushed to $.state at most every 120ms.
// Module variables start over on a reload; load() refills from $.state.
let work: Tree | null = null
let flushPending = false
let ticker: { cancel: () => void } | null = null
// Keep the pane at its newest line, until the person scrolls up to read.
let follow = true
// The transcript last seen beside the pane, so a switch to an agent's follows it.
let lastView: string | undefined

async function load($: EngineInterface): Promise<Tree> {
  if (!work) work = clone(await read($, treeAtom)) as Tree
  return work
}

function flush($: EngineInterface): void {
  if (flushPending) return
  flushPending = true
  $.clock.after(120, () => {
    flushPending = false
    const snapshot = work
    if (!snapshot) return
    void (async () => {
      await update($, treeAtom, () => clone(snapshot))
      if (follow) await $.ui.scroll({ in: PANE, to: 'end' })
    })().catch(() => {})
  })
}

function anyRunning(t: Tree): boolean {
  return Object.values(t.agents).some(a => a.endedAt === null)
}

function startTicker($: EngineInterface): void {
  if (ticker) return
  ticker = $.clock.every(1000, () => {
    void (async () => {
      const t = await load($)
      if (!anyRunning(t)) {
        ticker?.cancel()
        ticker = null
      }
      await update($, tickAtom, n => n + 1)
    })()
  })
}

function agentIdsIn(t: Tree, items: readonly Item[], out: string[] = []): string[] {
  for (const item of items) {
    if (item.kind !== 'agent') continue
    out.push(item.id)
    const child = t.agents[item.id]
    if (child) agentIdsIn(t, child.items, out)
  }
  return out
}

function trim(t: Tree): void {
  while (t.turns.length > TURNS_KEPT) {
    const gone = t.turns.shift()
    if (!gone) break
    for (const id of agentIdsIn(t, gone.items)) delete t.agents[id]
  }
}

function mainTurn(t: Tree, turnId: string | undefined, at: number): Turn {
  const found = turnId ? t.turns.find(turn => turn.id === turnId) : t.turns[t.turns.length - 1]
  if (found) return found
  const turn: Turn = { id: turnId ?? 'turn-' + at, prompt: '', startedAt: at, endedAt: null, items: [] }
  t.turns.push(turn)
  trim(t)
  return turn
}

function itemsOf(t: Tree, parent: string | null, at: number): Item[] {
  if (parent) {
    const agent = t.agents[parent]
    if (agent) return agent.items
  }
  return mainTurn(t, undefined, at).items
}

function removeRef(t: Tree, id: string): void {
  const drop = (items: Item[]) => {
    const i = items.findIndex(item => item.kind === 'agent' && item.id === id)
    if (i >= 0) items.splice(i, 1)
  }
  for (const turn of t.turns) drop(turn.items)
  for (const agent of Object.values(t.agents)) drop(agent.items)
}

/** An agent seen before its spawn was (or never was): put it under main for now. */
function ensureAgent(t: Tree, id: string, at: number): Agent {
  const known = t.agents[id]
  if (known) return known
  const agent: Agent = { id, type: 'agent', description: '', parent: null, startedAt: at, endedAt: null, items: [] }
  t.agents[id] = agent
  itemsOf(t, null, at).push({ kind: 'agent', id })
  return agent
}

/** The ids from main down to `id`, for an agent page's back trail. */
function chainTo(t: Tree, id: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  let cur: string | null | undefined = id
  while (cur && t.agents[cur] && !seen.has(cur)) {
    seen.add(cur)
    out.unshift(cur)
    cur = t.agents[cur]?.parent
  }
  return out
}

async function openAgent($: EngineInterface, path: string[], isLive: boolean): Promise<void> {
  await update($, pageAtom, () => path)
  follow = isLive
  // After the page has redrawn.
  $.clock.after(60, () => {
    void $.ui.scroll({ in: PANE, to: isLive ? 'end' : 'start' }).catch(() => {})
  })
}

/** Up one page, landing on the card that was opened. */
async function goBack($: EngineInterface, path: readonly string[]): Promise<void> {
  const left = path[path.length - 1]
  await update($, pageAtom, () => path.slice(0, -1))
  follow = false
  if (!left) return
  $.clock.after(60, () => {
    void $.ui.scroll({ in: PANE, to: { key: 'open-' + left }, block: 'center' }).catch(() => {})
  })
}

async function addThinking(
  $: EngineInterface,
  turnId: string,
  step: number,
  agentId: string | undefined,
  block: number,
  text: string,
): Promise<void> {
  const t = await load($)
  const at = await $.clock.now()
  const items = agentId ? ensureAgent(t, agentId, at).items : mainTurn(t, turnId, at).items
  const id = turnId + ':' + step + ':' + block
  let thought: Thought | undefined
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item && item.kind === 'thought' && item.id === id) {
      thought = item
      break
    }
  }
  if (!thought) {
    thought = { kind: 'thought', id, at, text: '' }
    items.push(thought)
  }
  if (thought.text.length < THOUGHT_MAX) thought.text += text
  flush($)
  if (agentId) startTicker($)
}

async function recordSpawn(
  $: EngineInterface,
  id: string,
  type: string,
  description: string,
  parent: string | null,
): Promise<void> {
  const t = await load($)
  const at = await $.clock.now()
  // Its thinking may have arrived first and been parked under main.
  const seen = t.agents[id]
  if (seen) removeRef(t, id)
  t.agents[id] = {
    id,
    type,
    description,
    parent,
    startedAt: seen ? Math.min(seen.startedAt, at) : at,
    endedAt: seen ? seen.endedAt : null,
    items: seen ? seen.items : [],
  }
  itemsOf(t, parent, at).push({ kind: 'agent', id })
  flush($)
  startTicker($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'thinking',
      description: "Show or hide the pane with Claude's live thinking",
    })
    void $.ui.open({ id: PANE, title: TITLE, columns: 60, backgroundColor: 'transparent' })

    return next(e)
  })

  on('command.run', { command: 'thinking' }, async $ => {
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Thinking pane closed.' }
    }
    const opened = await $.ui.open({ id: PANE, title: TITLE, columns: 60, backgroundColor: 'transparent' })
    return {
      text: opened.isPlaced
        ? 'Thinking pane opened.'
        : 'Thinking pane is waiting for room: ' + opened.reason,
    }
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      work = { turns: [], agents: {} }
      flush($)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    try {
      const t = await load($)
      const at = await $.clock.now()
      if (e.agentId === undefined) {
        // A new turn follows the newest thinking again.
        follow = true
        if (!t.turns.some(turn => turn.id === e.turnId)) {
          t.turns.push({ id: e.turnId, prompt: e.text, startedAt: at, endedAt: null, items: [] })
          trim(t)
        }
      } else {
        // A subagent's loop running again (a resumed agent) counts as running.
        ensureAgent(t, e.agentId, at).endedAt = null
        startTicker($)
      }
      flush($)
    } catch {
      // Best effort.
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined && result.agentId) {
      // Drawing is best effort; the spawn itself goes on untouched.
      recordSpawn($, result.agentId, e.subagentType, e.description, e.parentAgentId ?? null).catch(() => {})
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    try {
      const t = await load($)
      const at = await $.clock.now()
      if (e.agentId) {
        const agent = t.agents[e.agentId]
        if (agent) agent.endedAt = at
        // A hand-toggled card goes back to the default, so a finished one collapses.
        await update($, toggledAtom, map => {
          const rest: Record<string, boolean> = { ...map }
          delete rest[e.agentId as string]
          return rest
        })
      } else {
        const turn = t.turns.find(one => one.id === e.turnId)
        if (turn) turn.endedAt = at
      }
      flush($)
    } catch {
      // Best effort.
    }

    return next(e)
  })

  // The person's own scrolling: up stops following, back to the bottom resumes it.
  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      follow = e.offset >= e.contentRows - e.bodyRows
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    for await (const chunk of stream) {
      if (chunk.kind === 'thinking' && chunk.text) {
        try {
          await addThinking($, e.turnId, e.index, e.agentId, chunk.index, chunk.text)
        } catch {
          // Never let the pane get in the way of the response.
        }
      }
      yield chunk
    }

    return await stream.result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const t = await read($, treeAtom)
    const toggled = await read($, toggledAtom)
    let page: readonly string[] = await read($, pageAtom)
    await read($, tickAtom)
    const now = await $.clock.now()
    const width = Math.max(24, e.props.bodyColumns)

    // Opening an agent's transcript beside the pane opens its page; main brings main back.
    const viewed = e.props.view?.agentId
    if (viewed !== lastView && (viewed === undefined || t.agents[viewed])) {
      lastView = viewed
      const next = viewed ? chainTo(t, viewed) : []
      page = next
      void update($, pageAtom, () => next).catch(() => {})
    }

    // A page whose agent is gone (trimmed, cleared) falls back to the part that is left.
    const known = page.findIndex(id => !t.agents[id])
    const path = known === -1 ? page : page.slice(0, known)
    const leafId = path[path.length - 1]
    const current = leafId ? t.agents[leafId] : undefined

    const pill = (a: Agent) => {
      const live = a.endedAt === null
      const timer = live ? running(now - a.startedAt) : took((a.endedAt ?? now) - a.startedAt)
      return (
        <Box flexDirection="column" alignItems="flex-end" flexShrink={0}>
          {live ? (
            <Text color={C.liveInk} backgroundColor={C.live}>
              {' ● ' + timer + ' '}
            </Text>
          ) : (
            <Text color={C.dim} backgroundColor={C.pill}>
              {' ✓ ' + timer + ' '}
            </Text>
          )}
          <Text color={C.time}>{hms(a.startedAt)}</Text>
        </Box>
      )
    }

    const thoughtView = (th: Thought, isLive: boolean) => (
      <Box flexDirection="column">
        <Text color={C.time}>{hms(th.at)}</Text>
        <Text>
          {styledOnce(th.id, th.text).map(seg =>
            seg.kind === 'plain' && !seg.bold ? (
              seg.text
            ) : (
              <Text
                color={seg.kind === 'path' ? C.path : seg.kind === 'code' ? C.code : undefined}
                bold={seg.bold || undefined}
              >
                {seg.text}
              </Text>
            ),
          )}
          {isLive ? <Text color={C.live}>▌</Text> : ''}
        </Text>
      </Box>
    )

    /** An agent as a card to open: its type, task and timer, no thinking. */
    const agentCard = (a: Agent, room: number, marginLeft: number): RenderChildren => {
      const color = agentColor(a.type)
      const subs = agentIdsIn(t, a.items).length
      const descRoom = Math.max(4, room - a.type.length - 18)
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginLeft={marginLeft}>
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Button key={'open-' + a.id} plain onPress={() => openAgent($, [...path, a.id], a.endedAt === null)}>
                <Text color={color} bold>
                  {a.type}
                </Text>
                <Text color={C.dim}>{(a.description ? ' ' + clip(a.description, descRoom) : '') + ' ›'}</Text>
              </Button>
              {subs > 0 ? <Text color={C.dim}>{subs === 1 ? '1 subagent' : subs + ' subagents'}</Text> : null}
            </Box>
            {pill(a)}
          </Box>
        </Box>
      )
    }

    const turnView = (turn: Turn, isLatest: boolean, isRecent: boolean) => {
      const thoughts = turn.items.filter((item): item is Thought => item.kind === 'thought')
      const agents = turn.items
        .filter(item => item.kind === 'agent')
        .map(item => t.agents[item.id])
        .filter((a): a is Agent => a !== undefined)
      const liveChild = agents.find(a => a.endedAt === null)
      const live = turn.endedAt === null
      const status = live
        ? liveChild
          ? 'waiting on ' + liveChild.type
          : 'thinking'
        : '✓ ' + took((turn.endedAt ?? now) - turn.startedAt)
      const lastThought = thoughts[thoughts.length - 1]

      const promptKey = 'prompt-' + turn.id
      const promptOpen = toggled[promptKey] ?? isRecent
      const fullKey = promptKey + '-full'
      const promptFull = toggled[fullKey] ?? false
      const prompt = turn.prompt.trim()
      const togglePrompt = () => update($, toggledAtom, map => ({ ...map, [promptKey]: !promptOpen }))
      const toggleFull = () => update($, toggledAtom, map => ({ ...map, [fullKey]: !promptFull }))
      const mainKey = 'main-' + turn.id
      const mainOpen = toggled[mainKey] ?? isRecent
      const toggleMain = () => update($, toggledAtom, map => ({ ...map, [mainKey]: !mainOpen }))

      return (
        <Box flexDirection="column" gap={1}>
          {prompt ? (
            <Box flexDirection="column" borderStyle="round" borderColor={C.prompt} paddingX={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Button key={promptKey} plain onPress={togglePrompt}>
                  <Text color={C.dim}>{promptOpen ? '▾ ' : '▸ '}</Text>
                  <Text color={C.prompt} bold>
                    user
                  </Text>
                </Button>
                {promptOpen ? null : <Text color={C.time}>{hms(turn.startedAt)}</Text>}
              </Box>
              {promptOpen ? <Text color={C.time}>{hms(turn.startedAt)}</Text> : null}
              {promptOpen ? (
                <Button key={promptKey + '-text'} plain onPress={toggleFull}>
                  <Text color={C.promptText} wrap="wrap">
                    {promptFull ? prompt : clip(promptLabel(prompt), (width - 4) * 3)}
                  </Text>
                </Button>
              ) : null}
            </Box>
          ) : (
            <Text color={C.dim}>{'── ' + hms(turn.startedAt)}</Text>
          )}
          {thoughts.length > 0 ? (
            <Box flexDirection="column" borderStyle="round" borderColor={C.main} paddingX={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Button key={mainKey} plain onPress={toggleMain}>
                  <Text color={C.dim}>{mainOpen ? '▾ ' : '▸ '}</Text>
                  <Text color={C.main} bold>
                    main
                  </Text>
                </Button>
                <Text color={C.dim}>{status}</Text>
              </Box>
              {mainOpen ? (
                <Box flexDirection="column" gap={1}>
                  {thoughts.map(th => thoughtView(th, isLatest && live && !liveChild && th === lastThought))}
                </Box>
              ) : null}
            </Box>
          ) : null}
          {agents.map(a => agentCard(a, width - 6, 2))}
        </Box>
      )
    }

    /** One agent's page: the trail back, then its thinking with its own subagents as cards. */
    const agentPage = (a: Agent) => {
      const color = agentColor(a.type)
      const live = a.endedAt === null
      const last = a.items[a.items.length - 1]
      const cardKey = 'card-' + a.id
      const cardOpen = toggled[cardKey] ?? true
      const toggleCard = () => update($, toggledAtom, map => ({ ...map, [cardKey]: !cardOpen }))
      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" gap={2}>
            <Button key="back" plain hotkey="b" onPress={() => goBack($, path)}>
              ← back
            </Button>
            <Text wrap="truncate-end">
              <Text color={C.main}>main</Text>
              {path.map(id => {
                const one = t.agents[id]
                return one ? <Text color={agentColor(one.type)}>{' › ' + one.type}</Text> : ''
              })}
            </Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Box flexGrow={1} flexShrink={1}>
                <Button key={cardKey} plain onPress={toggleCard}>
                  <Text color={C.dim}>{cardOpen ? '▾ ' : '▸ '}</Text>
                  <Text color={color} bold>
                    {a.type}
                  </Text>
                  <Text color={C.dim}>{a.description ? ' ' + a.description : ''}</Text>
                </Button>
              </Box>
              {pill(a)}
            </Box>
            {cardOpen ? (
              <Box flexDirection="column" gap={1}>
                {a.items.map(item => {
                  if (item.kind === 'thought') return thoughtView(item, live && item === last)
                  const child = t.agents[item.id]
                  return child ? agentCard(child, width - 10, 0) : null
                })}
              </Box>
            ) : null}
          </Box>
        </Box>
      )
    }

    const latest = t.turns[t.turns.length - 1]
    const latestAgents = latest ? agentIdsIn(t, latest.items).map(id => t.agents[id]) : []
    const liveCount = latestAgents.filter(a => a && a.endedAt === null).length
    const doneCount = latestAgents.length - liveCount

    return (
      <Box flexDirection="column" width={width} gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>Thinking</Text>
          <Text color={C.dim}>
            {latestAgents.length > 0 ? liveCount + ' running · ' + doneCount + ' done' : ''}
          </Text>
        </Box>
        {current ? (
          agentPage(current)
        ) : (
          <Box flexDirection="column" gap={1}>
            {t.turns.length === 0 ? (
              <Text color={C.dim}>Nothing yet. Claude's thinking shows up here as it streams.</Text>
            ) : null}
            {t.turns.map((turn, i) => turnView(turn, turn === latest, i >= t.turns.length - TURNS_OPEN))}
          </Box>
        )}
      </Box>
    )
  })
}
