/* @jsx h */
import type { Register } from 'claude-code'

// Tool Defense above the Claude Code prompt: a tower defense where every enemy is one of Claude's
// real tool calls. `/defense` opens it, `/defense stop` closes it. This module watches tool.call,
// hands the board the calls it has not seen (with a running number, so nothing spawns twice),
// keeps the best score in $.store and tells the board when a turn starts and ends. Zero tokens.

const TITLE = 'Tool Defense'
const KEEP = 24

type Call = { seq: number; tool: string }

let open = false
let turnsDone = 0
let working = false
let best = 0
let seq = 0
let calls: Call[] = []

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const score = Number(await $.store.get('best').catch(() => undefined))
    if (score) best = score
    await $.command.register({
      name: 'defense',
      description: 'Tool Defense above the prompt: every tool call Claude makes is an enemy (stop closes)',
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`tool-defense: /defense not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'defense' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `${TITLE} closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    return { text: `${TITLE} · click a cell to build a tower, a tower to upgrade it · each of Claude's tool calls sends an enemy · /defense stop closes${best ? ` · best ${best}` : ''}` }
  })

  // every tool call is an enemy, released as the call starts so it walks while the tool runs
  on('tool.call', async ($, e, next) => {
    if (open) {
      seq++
      calls = [...calls.slice(-(KEEP - 1)), { seq, tool: e.tool }]
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    working = true
    if (open) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    working = false
    if (open) {
      turnsDone++
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    if (data?.game !== 'tool-defense' || typeof data.score !== 'number') return next(e)
    if (Number.isFinite(data.score) && data.score > best) {
      best = data.score
      await $.store.set('best', best).catch(err => $.ui.log(`tool-defense: store write failed: ${err}`))
      $.ui.toast(`${TITLE}: new best ${best}`)
    }
    return { props: { best, done: turnsDone, working, calls } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    const cols = e.viewport?.columns ?? 80
    // the grid is 10 rows + border, plus two status lines
    const rows = Math.max(8, Math.min(e.props.maxRows - 2, 15))
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="defense:close" label="close" onPress={close} />
        </Box>
        <Client key="board:defense" module="./boards/defense.tsx" width={cols} height={rows} props={{ best, done: turnsDone, working, calls }} />
        {await next(e)}
      </Box>
    )
  })
}
