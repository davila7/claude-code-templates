/**
 * agent-flow — Claude Mod (EARLY ACCESS)
 *
 * A side pane that draws the session's agents as they run: the main loop and
 * its context window on top, then every subagent as a tree in spawn order.
 * Select an agent (click, or Tab and Enter) to see the context it was handed
 * (its prompt, or the parent's whole context for a fork), what it did with it
 * (steps, tool calls, how full its own window got) and the answer it handed
 * back up. Select the main loop for the /context breakdown of the session.
 *
 *   `/agent-flow` opens it · `/agent-flow clear` forgets finished agents ·
 *   `/agent-flow stop` closes it
 *
 * It only observes: every hook passes its event on unchanged, and the only
 * engine reads are `$.agent.list()` and `$.session.usage()`. The flow is
 * recorded from session start whether the pane is open or not.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["agent-flow@skills-dir"].options):
 *   columns: number      width asked for the docked pane (default 52)
 *   maxAgents: number    subagents kept, oldest finished dropped first (default 60)
 *   openOnStart: boolean open the pane when the session starts (default false)
 */
import type { ContextCategory, Register } from 'claude-code'
import {
  MAIN,
  STATUS_MARK,
  bar,
  completed,
  counts,
  createFlow,
  estimateTokens,
  excerpt,
  fit,
  fmtDuration,
  fmtTokens,
  mainTurn,
  maxAgents,
  paneColumns,
  rows,
  spawned,
  stepped,
  synced,
  toolLabel,
  toolRan,
  trimmed,
} from './flow.ts'
import type { Flow, FlowNode, Status } from './flow.ts'

const PANE = 'agent-flow'
const COMMAND = 'agent-flow'
const KEY = 'ag:'

let flow: Flow = createFlow()
let isOpen = false
let selected: string | undefined
let breakdown: ContextCategory[] | undefined

const STATUS_COLOR: Record<Status, string> = { running: 'yellow', done: 'green', failed: 'red', aborted: 'gray' }

function statusText(): string | undefined {
  if (!isOpen) return undefined
  const c = counts(flow)
  const parts = [`${c.running} running`, `${c.done} done`]
  if (c.failed) parts.push(`${c.failed} failed`)
  const ctx = flow.percent !== undefined ? ` · ctx ${flow.percent}%` : ''
  return `agents: ${parts.join(' · ')}${ctx}`
}

/** Tokens handed down to a node's children and handed back up by them. */
function exchanged(node: FlowNode): { down: number; up: number; kids: number } {
  let down = 0
  let up = 0
  let kids = 0
  for (const n of flow.nodes.values()) {
    if (n.parentId !== node.id) continue
    kids += 1
    down += n.fork ? (node.contextTokens ?? 0) : estimateTokens(n.prompt)
    up += estimateTokens(n.answer)
  }
  return { down, up, kids }
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const keep = maxAgents(options.maxAgents)
  const openOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    flow = createFlow(Date.now())
    selected = undefined
    breakdown = undefined
    await $.command
      .register({
        name: COMMAND,
        description: 'Live tree of the session’s agents and the context passed between them (clear|stop)',
        argumentHint: '[clear|stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`agent-flow: /${COMMAND} not registered: ${err}`))
    $.ui.log(`agent-flow loaded: /${COMMAND} opens the pane`, { to: 'debug' })
    if (openOnStart) {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'agents', columns }).catch(err => {
        isOpen = false
        $.ui.log(`agent-flow: pane not opened: ${err}`)
      })
      $.ui.status(statusText())
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      $.ui.status(undefined)
      return { text: 'agent-flow closed' }
    }
    if (arg === 'clear') {
      trimmed(flow, counts(flow).running)
      selected = undefined
      if (isOpen) {
        $.ui.status(statusText())
        $.ui.invalidate('ui.render')
      }
      return { text: 'agent-flow: finished agents cleared' }
    }
    synced(flow, await $.agent.list().catch(() => []))
    try {
      await $.ui.open({ id: PANE, title: 'agents', focus: true, columns })
    } catch (err) {
      isOpen = false
      return { text: `agent-flow: pane not opened: ${err}` }
    }
    isOpen = true
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    const c = counts(flow)
    const hint = e.presentation.isFullscreen
      ? 'click an agent, or Tab and Enter'
      : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `${c.running + c.done + c.failed} agents so far · ${hint} · /${COMMAND} stop closes` }
  })

  on('turn.start', async ($, e, next) => {
    mainTurn(flow, e.text, Date.now())
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // the context handed down: the Agent call's prompt, known before the subagent runs
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId) {
      spawned(
        flow,
        {
          agentId: r.agentId,
          parentAgentId: e.parentAgentId,
          description: e.description,
          subagentType: e.subagentType,
          prompt: e.prompt,
          fork: e.fork,
          background: e.background,
          model: r.model,
        },
        Date.now(),
      )
      trimmed(flow, keep)
      if (isOpen) {
        $.ui.status(statusText())
        $.ui.invalidate('ui.render')
      }
    }
    return r
  })

  // each model request: how full that loop's window is now
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    stepped(flow, e.agentId, r.usage, Date.now())
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const use = { tool: e.tool, label: toolLabel(e.tool, e as unknown as Record<string, unknown>) }
    toolRan(flow, e.agentId, use, Date.now())
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    const r = await next(e)
    if (r.deny !== undefined || r.isError) {
      Object.assign(use, { isError: true })
      if (isOpen) {
        $.ui.status(statusText())
        $.ui.invalidate('ui.render')
      }
    }
    return r
  })

  // the context handed back up: a subagent's final answer
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    completed(
      flow,
      e.agentId,
      { answer: e.answer, reason: e.reason, durationMs: e.durationMs, model: e.usage?.model },
      Date.now(),
    )
    if (!e.agentId) synced(flow, await $.agent.list().catch(() => []))
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    flow.window = e.context.window
    flow.percent = e.context.percent
    const main = flow.nodes.get(MAIN)
    if (main && e.context.tokens !== undefined) main.contextTokens = e.context.tokens
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    $.ui.status(undefined)
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
    if (key === 'clear') {
      trimmed(flow, counts(flow).running)
      if (selected && !flow.nodes.has(selected)) selected = undefined
    } else if (key === 'refresh') {
      synced(flow, await $.agent.list().catch(() => []))
    } else if (key.startsWith(KEY)) {
      const id = key.slice(KEY.length)
      selected = selected === id ? undefined : id
    }
    if (selected === MAIN && (key === 'refresh' || key === `${KEY}${MAIN}`)) {
      const usage = await $.session.usage({ breakdown: 'summary', columns }).catch(() => undefined)
      breakdown = usage?.context.breakdown?.categories
    }
    if (isOpen) {
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(24, e.props.bodyColumns - 1)
    const noop = () => {}
    const main = flow.nodes.get(MAIN)!
    const tree = rows(flow)
    const c = counts(flow)
    const chosen = selected ? flow.nodes.get(selected) : undefined

    const agentRow = (node: FlowNode, prefix: string) => {
      const ctx = node.contextTokens !== undefined ? fmtTokens(node.contextTokens) : ''
      const tools = node.toolCount ? `${node.toolCount}⚒` : ''
      const right = [ctx, tools].filter(Boolean).join(' ')
      const room = width - prefix.length - 2 - (right ? right.length + 1 : 0)
      const name = node.id === MAIN ? 'main' : `${node.type}${node.fork ? ' (fork)' : ''}  ${node.description}`
      return (
        <Box key={`row:${node.id}`} flexDirection="row">
          {prefix ? <Text dimColor>{prefix}</Text> : null}
          <Text color={STATUS_COLOR[node.status]}>{`${STATUS_MARK[node.status]} `}</Text>
          <Button
            key={`${KEY}${node.id}`}
            plain
            dimColor={selected !== node.id && (node.unlisted || node.status !== 'running')}
            label={fit(name, Math.max(4, room))}
            onPress={noop}
          />
          {right ? <Text color="magenta">{` ${right}`}</Text> : null}
        </Box>
      )
    }

    const header = (
      <Box key="head" flexDirection="column">
        <Text bold>{fit(`Session · turn ${flow.turn}`, width)}</Text>
        <Text>
          <Text color="cyan">{'context '}</Text>
          {`${fmtTokens(main.contextTokens)}${flow.window ? `/${fmtTokens(flow.window)}` : ''}`}
          {flow.percent !== undefined ? <Text dimColor>{` ${flow.percent}%`}</Text> : null}
        </Text>
        {flow.percent !== undefined ? (
          <Text color={flow.percent > 80 ? 'red' : flow.percent > 60 ? 'yellow' : 'green'}>
            {bar(flow.percent, Math.min(width, 40))}
          </Text>
        ) : null}
        {main.prompt ? <Text dimColor wrap="truncate-end">{`› ${main.prompt.replace(/\s+/g, ' ')}`}</Text> : null}
      </Box>
    )

    const detail = chosen ? (
      <Box key="detail" flexDirection="column" marginTop={1} borderStyle="round" borderDimColor paddingX={1}>
        {chosen.id === MAIN ? mainDetail(chosen) : agentDetail(chosen)}
      </Box>
    ) : null

    function mainDetail(node: FlowNode) {
      const w = width - 4
      const x = exchanged(node)
      const used = (breakdown ?? []).filter(cat => cat.kind === 'used' && cat.tokens > 0)
      used.sort((a, b) => b.tokens - a.tokens)
      return [
        <Text key="t" bold>{fit(`main loop · ${node.steps} requests · ${node.model ?? ''}`, w)}</Text>,
        <Text key="x" dimColor>
          {fit(`${x.kids} subagents · ↓ ${fmtTokens(x.down)} handed down · ↑ ${fmtTokens(x.up)} back`, w)}
        </Text>,
        <Text key="ch" color="cyan" bold>{'context by category'}</Text>,
        ...(used.length
          ? used.slice(0, 8).map((cat, i) => (
              <Text key={`cat:${i}`}>
                {fit(cat.name, w - 8).padEnd(Math.max(1, w - 8))}
                <Text color="magenta">{fmtTokens(cat.tokens).padStart(7)}</Text>
              </Text>
            ))
          : [<Text key="nb" dimColor>{'press refresh to read the breakdown'}</Text>]),
      ]
    }

    function agentDetail(node: FlowNode) {
      const w = width - 4
      const parent = node.parentId === MAIN ? 'main' : flow.nodes.get(node.parentId ?? '')?.type ?? 'parent'
      const parentCtx = flow.nodes.get(node.parentId ?? MAIN)?.contextTokens
      const meta = [node.model, node.status, fmtDuration(node.durationMs), node.background ? 'background' : '']
      const out = [
        <Text key="t" bold>{fit(`${node.type}  ${node.description}`, w)}</Text>,
        <Text key="m" dimColor>{fit(meta.filter(Boolean).join(' · '), w)}</Text>,
        <Text key="in" color="cyan" bold>
          {fit(
            node.fork
              ? `↓ in from ${parent}: its whole context (~${fmtTokens(parentCtx)}) + ${fmtTokens(estimateTokens(node.prompt))}`
              : node.unlisted
                ? '↓ in: not seen (a loop no Agent call announced)'
                : `↓ in from ${parent}: prompt ${fmtTokens(estimateTokens(node.prompt))} tok`,
            w,
          )}
        </Text>,
        ...excerpt(node.prompt, 4, w - 2).map((l, i) => <Text key={`p:${i}`} dimColor>{`  ${l}`}</Text>),
        <Text key="w" color="yellow" bold>
          {fit(
            `⚙ ${node.steps} requests · ctx ${fmtTokens(node.contextTokens)} (peak ${fmtTokens(node.peakContext)}) · out ${fmtTokens(node.outputTokens)}`,
            w,
          )}
        </Text>,
        ...node.tools.slice(-5).map((u, i) => (
          <Text key={`u:${i}`} color={u.isError ? 'red' : undefined} dimColor={!u.isError}>
            {fit(`  ${u.tool} ${u.label}`, w)}
          </Text>
        )),
        node.toolCount > 5 ? <Text key="more" dimColor>{`  … ${node.toolCount} tool calls in all`}</Text> : null,
        <Text key="o" color="green" bold>
          {fit(
            node.answer !== undefined
              ? `↑ out to ${parent}: answer ${fmtTokens(estimateTokens(node.answer))} tok`
              : `↑ out to ${parent}: still working`,
            w,
          )}
        </Text>,
        ...(node.answer ? excerpt(node.answer, 4, w - 2) : []).map((l, i) => (
          <Text key={`a:${i}`} dimColor>{`  ${l}`}</Text>
        )),
      ]
      const kids = exchanged(node)
      if (kids.kids) {
        out.push(
          <Text key="k" dimColor>
            {fit(`${kids.kids} subagents · ↓ ${fmtTokens(kids.down)} · ↑ ${fmtTokens(kids.up)}`, w)}
          </Text>,
        )
      }
      return out
    }

    return (
      <Box flexDirection="column">
        {header}
        <Box key="ag-head" marginTop={1}>
          <Text bold color="cyan">
            {fit(`Agents (${c.running} running · ${c.done} done${c.failed ? ` · ${c.failed} failed` : ''})`, width)}
          </Text>
        </Box>
        {agentRow(main, '')}
        {tree.map(r => agentRow(r.node, r.prefix))}
        {tree.length === 0 ? <Text dimColor>{fit('  no subagents yet', width)}</Text> : null}
        {detail}
        <Box key="foot" marginTop={1} flexDirection="column">
          <Box key="toolbar" flexDirection="row" columnGap={1}>
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="clear" label="clear" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text dimColor>{fit('◐ running ● done ✗ failed ○ stopped · ctx ⚒ tools', width)}</Text>
        </Box>
      </Box>
    )
  })
}
