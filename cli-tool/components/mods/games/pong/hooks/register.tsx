/* @jsx h */
import type { Register } from 'claude-code'
import { isBetter } from './games/best.ts'

// Pong above the Claude Code prompt, split out of cc-arcade (https://github.com/sezaakgun/cc-arcade,
// MIT, by Seza Akgün) as a single-game mod. `/pong` opens it, `/pong stop` closes it. The board in
// ./boards is a surface module that runs on the drawing thread; this module mounts it, keeps the best
// score in $.store and pauses the game when Claude finishes a turn. Playing costs no tokens.

const GAME = 'pong' // what the board posts its score under
const TITLE = 'Pong'
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
      name: 'pong',
      description: `$Pong above the prompt, while Claude works (stop closes)`,
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`pong: /pong not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'pong' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `$Pong closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    const score = best ? ` · best ${best}$` : ''
    return { text: `$Pong · click the board to play · Esc returns to the prompt · /pong stop closes${score}` }
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
      await $.store.set('best', best).catch(err => $.ui.log(`pong: store write failed: ${err}`))
      $.ui.toast(`$Pong: new best ${best}$`)
    }
    return { props: { best, done: turnsDone, safe: false } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // the board needs a terminal's keys and mouse; the desktop and mobile surfaces draw their own band
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    // the band's own width: the transcript column's while a Pane is docked beside it
    const cols = e.props.bodyColumns || (e.viewport?.columns ?? 80)
    // one row for the close button, one for whatever else draws in the band
    const rows = Math.max(8, e.props.maxRows - 2)
    const tall = (max: number) => Math.min(rows, max)
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="pong:close" label="close" onPress={close} />
        </Box>
        <Client key="board:pong" module="./boards/pong.tsx" width={cols} height={tall(18)} props={{ best, done: turnsDone, safe: false }} />
        {await next(e)}
      </Box>
    )
  })
}
