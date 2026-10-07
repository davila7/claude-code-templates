import type { UltraApi } from '../core/api'
import { atom, read, update } from 'claude-code'
import type { Args, Frozen, RenderInput, RenderNode, ThemeKey, Timer } from 'claude-code'
import type { UltraSet } from '../../types/index'
import { fmtCountdown, fmtDuration, fmtModel, fmtTokens, fmtUsd } from '../core/format'
import type { UltraMod } from '../core/mod'
import { setLabel } from '../core/sets'
import type { SetsEngine } from '../core/sets'

export const turn = atom({ plugin: 'ultramod', key: 'turn' } as const, {
  id: null, startedAt: null, now: 0, durationMs: null, edits: 0, commands: 0,
})

export type HudMod = UltraMod & {
  start: ($: UltraApi, e: Frozen<Args<'turn.start'>>) => Promise<void>
  complete: ($: UltraApi, e: Frozen<Args<'turn.complete'>>) => Promise<void>
  sync: ($: UltraApi) => Promise<void>
  stop: () => void
}

// The row of segments the band draws, and the pane draws too: context, the
// rate limits, the turn, the cost, the model and the set badge, whole segments
// only, each dropped when the next one will no longer fit.
export async function hudRow($: UltraApi, e: Frozen<RenderInput<'AbovePrompt' | 'Pane'>>, set: UltraSet, columns: number) {
  const usage = await $.session.usage()
  const held = await read($, turn)
  const now = await $.clock.now()
  const { Text } = $.ui.resolve(e)
  const percent = usage.context.percent
  const contextColor: ThemeKey = percent === undefined || percent < 60 ? 'text' : percent < 80 ? 'warning' : 'error'
  const filled = percent === undefined ? 0 : Math.max(0, Math.min(10, Math.round(percent / 10)))
  const bar = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`
  const contextText = percent === undefined ? `ctx ${bar} ?/${fmtTokens(usage.context.window)}` :
    `ctx ${bar} ${percent}% ${usage.context.tokens === undefined ? '?' : fmtTokens(usage.context.tokens)}/${fmtTokens(usage.context.window)}`
  // Nothing has answered yet, so the row starts at the limits instead of a bar of shadows.
  const hasContext = percent !== undefined || usage.context.tokens !== undefined
  const tail: { text: string; color?: ThemeKey; dim?: boolean }[] = []
  const limits = usage.rateLimits.map(limit => {
    const label = limit.kind === 'five_hour' ? '5h' : limit.kind === 'seven_day' ? '7d' : limit.kind
    const reset = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)
    const short = `${label} ${limit.percentUsed}%`
    return { short, full: `${short}${Number.isFinite(reset) ? ` resets ${fmtCountdown(reset - now)}` : ''}`,
      color: (limit.percentUsed < 75 ? 'text' : limit.percentUsed < 90 ? 'warning' : 'error') as ThemeKey }
  })
  if (set.mods.hud.mode !== 'compact') {
    if (held.id && held.startedAt !== null) {
      // A fresh turn carries the timer alone; the counts join it as they grow.
      const work = [fmtDuration(now - held.startedAt)]
      if (held.edits > 0) work.push(`${held.edits} ${held.edits === 1 ? 'edit' : 'edits'}`)
      if (held.commands > 0) work.push(`${held.commands} ${held.commands === 1 ? 'cmd' : 'cmds'}`)
      tail.push({ text: work.join(' ') })
    } else if (held.durationMs !== null) {
      tail.push({ text: fmtDuration(held.durationMs) })
    }
    // A total that prints $0.00 says nothing, so it stays off the row.
    const cost = usage.cost && usage.cost.usd > 0 ? fmtUsd(usage.cost.usd) : ''
    if (cost && cost !== '$0.00') tail.push({ text: cost })
    tail.push({ text: fmtModel(await $.session.model()) })
    tail.push({ text: `ultra:${setLabel(set)}`, dim: true })
  }
  const build = (verbose: boolean): { text: string; color?: ThemeKey; dim?: boolean }[] => [
    ...(hasContext ? [{ text: contextText, color: contextColor }] : []),
    ...limits.map(limit => ({ text: verbose ? limit.full : limit.short, color: limit.color })),
    ...tail,
  ]
  // The long form earns its place only while every segment still fits:
  // both limits go short before the row drops anything after them.
  const fits = (list: readonly { text: string }[]) =>
    list.reduce((used, part, index) => used + (index ? 3 : 0) + part.text.length, 0) <= columns
  const parts = build(fits(build(true)))
  const nodes: RenderNode[] = []
  let used = 0
  for (const part of parts) {
    const gap = nodes.length ? 3 : 0
    if (used + gap + part.text.length > columns) break
    if (gap) nodes.push(<Text dimColor> · </Text>)
    nodes.push(<Text color={part.color} dimColor={part.dim}>{part.text}</Text>)
    used += gap + part.text.length
  }
  return { nodes, contextColor, used }
}

export function createHud(sets: SetsEngine, mods: readonly UltraMod[]): HudMod {
  let timer: Timer | null = null
  const stop = () => {
    timer?.cancel()
    timer = null
  }
  const tick = async ($: UltraApi) => {
    if (!(await sets.enabled($, 'hud')) || !(await read($, turn)).id) {
      stop()
      return
    }
    const now = await $.clock.now()
    await update($, turn, held => held.id ? { ...held, now } : held)
  }
  const sync = async ($: UltraApi) => {
    if (!(await sets.enabled($, 'hud')) || !(await read($, turn)).id) {
      stop()
    } else if (!timer) {
      timer = $.clock.every(1_000, () => { void tick($).catch(stop) })
    }
  }
  const start: HudMod['start'] = async ($, e) => {
    stop()
    const now = await $.clock.now()
    await update($, turn, () => ({ id: e.turnId, startedAt: now, now, durationMs: null, edits: 0, commands: 0 }))
    await sync($)
  }
  const complete: HudMod['complete'] = async ($, e) => {
    if (e.agentId) return
    stop()
    await update($, turn, held => ({ ...held, id: null, startedAt: null, durationMs: e.durationMs }))
  }

  return {
    id: 'hud', start, complete, sync, stop,
    hooks: {
      'tool.call': [{
        when: e => !e.agentId && ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'].includes(String(e.tool)),
        run: async ($, e, next) => {
          const result = await next(e)
          if (!result.deny && (String(e.tool) === 'Bash' || !result.isError)) {
            await update($, turn, held => held.id ? {
              ...held,
              edits: held.edits + (String(e.tool) === 'Bash' ? 0 : 1),
              commands: held.commands + (String(e.tool) === 'Bash' ? 1 : 0),
            } : held)
          }
          return result
        },
      }],
      'ui.render': [{
        when: e => e.component === 'AbovePrompt' && (e.surface === 'terminal' || e.surface === 'desktop') && !e.props.hasSurvey,
        run: async ($, e, next) => {
          if (e.component !== 'AbovePrompt') return next(e)
          const set = await sets.current($)
          const { Box, Text } = $.ui.resolve(e)
          const columns = Math.max(0, Math.floor(e.props.bodyColumns))
          const { nodes: row, contextColor, used: consumed } = await hudRow($, e, set, columns)
          let used = consumed
          for (const mod of mods) {
            if (!mod.band || !set.mods[mod.id].enabled) continue
            const gap = row.length ? 3 : 0
            const remaining = Math.max(0, columns - used - gap)
            try {
              const part = await mod.band({ $, e: e as Frozen<RenderInput<'AbovePrompt'>>, set, settings: set.mods[mod.id], columns: remaining, contextColor })
              if (!part || part.columns <= 0 || part.columns > remaining) continue
              if (gap) row.push(<Text dimColor> · </Text>)
              row.push(part.node)
              used += gap + part.columns
            } catch {
              // A broken contribution must leave the other rows visible.
            }
          }
          return <Box flexDirection="column">
            <Box flexDirection="row" width={columns} flexWrap="nowrap">{row}</Box>
            {await next(e)}
          </Box>
        },
      }],
    },
  }
}
