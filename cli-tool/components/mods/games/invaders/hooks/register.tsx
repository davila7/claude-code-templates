/* @jsx h */
import type { Register } from 'claude-code'
import { isBetter } from './games/best.ts'

// Space Invaders above the Claude Code prompt, split out of cc-arcade (https://github.com/sezaakgun/cc-arcade,
// MIT, by Seza Akgün) as a single-game mod. `/invaders` opens it, `/invaders stop` closes it. The board in
// ./boards is a surface module that runs on the drawing thread; this module mounts it, keeps the best
// score in $.store and pauses the game when Claude finishes a turn. Playing costs no tokens.

const GAME = 'invaders' // what the board posts its score under
const TITLE = 'Space Invaders'
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
      name: 'invaders',
      description: `$Space Invaders above the prompt, while Claude works (stop closes)`,
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`invaders: /invaders not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'invaders' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `$Space Invaders closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    const score = best ? ` · best ${best}$` : ''
    return { text: `$Space Invaders · click the board to play · Esc returns to the prompt · /invaders stop closes${score}` }
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
      await $.store.set('best', best).catch(err => $.ui.log(`invaders: store write failed: ${err}`))
      $.ui.toast(`$Space Invaders: new best ${best}$`)
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
          <Button key="invaders:close" label="close" onPress={close} />
        </Box>
        <Client key="board:invaders" module="./boards/invaders.tsx" width={cols} height={tall(19)} props={{ best, done: turnsDone, safe: false }} />
        {await next(e)}
      </Box>
    )
  })
}
