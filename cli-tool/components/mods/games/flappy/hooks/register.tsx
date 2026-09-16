/* @jsx h */
import type { Register } from 'claude-code'
import { isBetter } from './games/best.ts'

// Flappy above the Claude Code prompt, split out of cc-arcade (https://github.com/sezaakgun/cc-arcade,
// MIT, by Seza Akgün) as a single-game mod. `/flappy` opens it, `/flappy stop` closes it. The board in
// ./boards is a surface module that runs on the drawing thread; this module mounts it, keeps the best
// score in $.store and pauses the game when Claude finishes a turn. Playing costs no tokens.

const GAME = 'flappy' // what the board posts its score under
const TITLE = 'Flappy'
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
      name: 'flappy',
      description: `$Flappy above the prompt, while Claude works (stop closes)`,
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`flappy: /flappy not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'flappy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `$Flappy closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    const score = best ? ` · best ${best}$` : ''
    return { text: `$Flappy · click the board to play · Esc returns to the prompt · /flappy stop closes${score}` }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
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
      await $.store.set('best', best).catch(err => $.ui.log(`flappy: store write failed: ${err}`))
      $.ui.toast(`$Flappy: new best ${best}$`)
    }
    return { props: { best, done: turnsDone, safe: false } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // the board needs a terminal's keys and mouse; the desktop and mobile surfaces draw their own band
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    const cols = e.viewport?.columns ?? 80
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
          <Button key="flappy:close" label="close" onPress={close} />
        </Box>
        <Client key="board:flappy" module="./boards/flappy.tsx" width={cols} height={tall(19)} props={{ best, done: turnsDone, safe: false }} />
        {await next(e)}
      </Box>
    )
  })
}
