/* @jsx h */
import type { Register } from 'claude-code'

// Pac-Man above the Claude Code prompt. `/pacman` opens it, `/pacman stop` closes it. The board in
// ./boards/pacman.tsx is a surface module that runs on the drawing thread; this module mounts it,
// keeps the best score in $.store and pauses the game when Claude finishes a turn. Zero tokens: the
// mod answers every key itself and never asks the model anything.

const TITLE = 'Pac-Man'

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
      name: 'pacman',
      description: 'Pac-Man above the prompt, while Claude works (stop closes)',
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`pacman: /pacman not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'pacman' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `${TITLE} closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    return { text: `${TITLE} · click the maze, then an arrow key · Esc returns to the prompt · /pacman stop closes${best ? ` · best ${best}` : ''}` }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (open) {
      turnsDone++
      $.ui.invalidate('ui.render')
    }
    return r
  })

  // a finished round (or a cleared maze), posted by the board: keep the best score
  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    if (data?.game !== 'pacman' || typeof data.score !== 'number') return next(e)
    if (Number.isFinite(data.score) && data.score > best) {
      best = data.score
      await $.store.set('best', best).catch(err => $.ui.log(`pacman: store write failed: ${err}`))
      $.ui.toast(`${TITLE}: new best ${best}`)
    }
    return { props: { best, done: turnsDone } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // the board needs a terminal's keys; the desktop and mobile surfaces draw their own band
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    const cols = e.viewport?.columns ?? 80
    // one row for the close button, one for whatever else draws in the band; the maze is 15 rows + border
    const rows = Math.max(8, Math.min(e.props.maxRows - 2, 18))
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="pacman:close" label="close" onPress={close} />
        </Box>
        <Client key="board:pacman" module="./boards/pacman.tsx" width={cols} height={rows} props={{ best, done: turnsDone }} />
        {await next(e)}
      </Box>
    )
  })
}
