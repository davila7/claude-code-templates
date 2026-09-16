/**
 * tool-timing-badge — Claude Mod (EARLY ACCESS)
 *
 * Measures how long every tool call takes and draws a colored duration badge
 * beside the engine's own ToolUse rendering, on the terminal, Desktop and
 * mobile alike. Two hooks: `tool.call` (timing, "after": it awaits `next`) and
 * `ui.render` on the ToolUse component (drawing: wraps what `next` drew).
 *
 * Elements come from the surface's table (`$.ui.resolve(e)`), never from
 * globals; JSX compiles against the environment's `h`. A ToolUse is drawn
 * once per props change, so the badge appears on the redraw that follows the
 * call settling (`isRunning` flips to false).
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   slowMs: number  calls at or above this are red, above a quarter of it yellow (default 5000)
 */
import type { Register } from 'claude-code'

const durations = new Map<string, number>()

function badgeColor(ms: number, slowMs: number): string {
  if (ms >= slowMs) return 'red'
  if (ms >= slowMs / 4) return 'yellow'
  return 'green'
}

function format(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export const register: Register = (on, options) => {
  const slowMs = typeof options.slowMs === 'number' ? options.slowMs : 5000

  // 1. Time every tool call, the hooks beneath and the tool itself included.
  on('tool.call', async ($, e, next) => {
    const startedAt = Date.now()
    try {
      return await next(e)
    } finally {
      const ms = Date.now() - startedAt
      if (e.tool_use_id) durations.set(e.tool_use_id, ms)
      if (ms >= slowMs) $.ui.log(`[tool-timing-badge] slow ${e.tool}: ${format(ms)}`)
    }
  })

  // 2. Wrap the engine's ToolUse drawing with a badge.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const drawn = await next(e)

    const ms = durations.get(e.props.tool_use_id)
    if (e.props.isRunning || ms === undefined) return drawn

    return (
      <Box flexDirection="row" gap={1}>
        {drawn}
        <Text color={badgeColor(ms, slowMs)}>{format(ms)}</Text>
      </Box>
    )
  })
}
