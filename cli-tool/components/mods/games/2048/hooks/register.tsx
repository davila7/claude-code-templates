/* @jsx h */
import type { Register } from 'claude-code'
import { isBetter } from './games/best.ts'

// 2048 above the Claude Code prompt, split out of cc-arcade (https://github.com/sezaakgun/cc-arcade,
// MIT, by Seza Akgün) as a single-game mod. `/2048` opens it, `/2048 stop` closes it. The board in
// ./boards is a surface module that runs on the drawing thread; this module mounts it, keeps the best
// score in $.store and pauses the game when Claude finishes a turn. Playing costs no tokens.

const GAME = '2048' // what the board posts its score under
const TITLE = '2048'
const LOWER_IS_BETTER = false
const UNIT = ''

let open = false
// bumped at each finished turn; the open game pauses when it sees a new value
let turnsDone = 0
let best = 0

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    // a store that cannot be read costs the best score, never the game
    const score = Number(await $.store.get('best').catch(() => undefined))
    if (score) best = score
    await $.command.register({
      name: '2048',
      description: `$2048 above the prompt, while Claude works (stop closes)`,
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`2048: /2048 not registered: ${err}`))
    return r
  })

  on('command.run', { command: '2048' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `$2048 closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    const score = best ? ` · best ${best}$` : ''
    return { text: `$2048 · click the board to play · Esc returns to the prompt · /2048 stop closes${score}` }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    // a subagent's turn is not the one the person is waiting for
    if (e.agentId) return r
    if (open) {
      turnsDone++
      $.ui.invalidate('ui.render')
    }
    return r
  })

  // a finished round, posted by the board: keep the best score and hand it back with the next props
  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    if (data?.game !== GAME || typeof data.score !== 'number') return next(e)
    if (isBetter(data.score, best || undefined, LOWER_IS_BETTER)) {
      best = data.score
      await $.store.set('best', best).catch(err => $.ui.log(`2048: store write failed: ${err}`))
      $.ui.toast(`$2048: new best ${best}$`)
    }
    return { props: { best, done: turnsDone, safe: false } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // the board needs a terminal's keys and mouse; the desktop and mobile surfaces draw their own band
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    // the band's own width: the transcript column's while a Pane is docked beside it
    const cols = e.props.bodyColumns || (e.viewport?.columns ?? 80)
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="2048:close" label="close" onPress={close} />
        </Box>
        <Client key="board:2048" module="./boards/twenty48.tsx" width={cols} props={{ best, done: turnsDone, safe: false }} />
        {await next(e)}
      </Box>
    )
  })
}
