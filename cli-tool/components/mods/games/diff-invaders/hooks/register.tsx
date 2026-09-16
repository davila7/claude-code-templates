/* @jsx h */
import type { Register } from 'claude-code'

// Diff Invaders above the Claude Code prompt: Space Invaders where every wave is the code Claude
// just wrote. `/invaders` opens it, `/invaders stop` closes it. This module watches Edit and Write,
// turns the added lines into a wave the board queues (with a running number, so nothing repeats),
// keeps the best score in $.store and tells the board when a turn ends. Zero tokens.

const TITLE = 'Diff Invaders'
const KEEP = 12
const MAX_LINES = 6

type Diff = { seq: number; file: string; lines: string[] }

let open = false
let turnsDone = 0
let best = 0
let seq = 0
let diffs: Diff[] = []

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

/** The lines an edit adds: what is in the new text and not in the old, in order. */
function added(oldText: string, newText: string): string[] {
  const before = new Set(oldText.split('\n').map(l => l.trim()))
  return newText.split('\n').filter(l => l.trim() !== '' && !before.has(l.trim()))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const score = Number(await $.store.get('best').catch(() => undefined))
    if (score) best = score
    await $.command.register({
      name: 'invaders',
      description: 'Diff Invaders above the prompt: shoot the code Claude just wrote (stop closes)',
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`diff-invaders: /invaders not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'invaders' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      open = false
      $.ui.invalidate('ui.render')
      return { text: `${TITLE} closed` }
    }
    open = true
    $.ui.invalidate('ui.render')
    return { text: `${TITLE} · click the board, ← → move, space fires · every Edit or Write Claude makes is a wave · /invaders stop closes${best ? ` · best ${best}` : ''}` }
  })

  // an edit that went through becomes a wave: its added lines, one row each
  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const r = await next(e)
    if (!open || r.deny !== undefined || r.isError) return r
    const lines = e.tool === 'Edit' ? added(e.old_string, e.new_string) : e.content.split('\n').filter(l => l.trim() !== '')
    if (lines.length > 0) {
      seq++
      diffs = [...diffs.slice(-(KEEP - 1)), { seq, file: baseName(e.file_path), lines: lines.slice(0, MAX_LINES) }]
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (open) {
      turnsDone++
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    if (data?.game !== 'diff-invaders' || typeof data.score !== 'number') return next(e)
    if (Number.isFinite(data.score) && data.score > best) {
      best = data.score
      await $.store.set('best', best).catch(err => $.ui.log(`diff-invaders: store write failed: ${err}`))
      $.ui.toast(`${TITLE}: new best ${best}`)
    }
    return { props: { best, done: turnsDone, diffs } }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    const cols = e.viewport?.columns ?? 80
    // the board is 14 rows + border, plus the status line
    const rows = Math.max(8, Math.min(e.props.maxRows - 2, 18))
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="invaders:close" label="close" onPress={close} />
        </Box>
        <Client key="board:invaders" module="./boards/invaders.tsx" width={cols} height={rows} props={{ best, done: turnsDone, diffs }} />
        {await next(e)}
      </Box>
    )
  })
}
