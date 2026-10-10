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
  start: (api: UltraApi, e: Frozen<Args<'turn.start'>>) => Promise<void>
  complete: (api: UltraApi, e: Frozen<Args<'turn.complete'>>) => Promise<void>
  sync: (api: UltraApi) => Promise<void>
  stop: () => void
}

// The row of segments the band draws, and the pane draws too: context, the
// rate limits, the turn, the cost, the model and the set badge, whole segments
// only, each dropped when the next one will no longer fit.
export async function hudRow(api: UltraApi, e: Frozen<RenderInput<'AbovePrompt' | 'Pane'>>, set: UltraSet, columns: number) {
  const usage = await api.session.usage()
  const held = await read(api, turn)
  const now = await api.clock.now()
  const { Text } = api.ui.resolve(e)
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
    tail.push({ text: fmtModel(await api.session.model()) })
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

// The band above the prompt: the HUD row, then a second row for contributions
// with no room beside it. Null when nothing is drawn here.
export async function bandRows(api: UltraApi, e: Frozen<RenderInput<'AbovePrompt'>>, sets: SetsEngine, mods: readonly UltraMod[]): Promise<RenderNode[] | null> {
  if (e.surface !== 'terminal' && e.surface !== 'desktop' || e.props.hasSurvey) return null
  if (!(await sets.enabled(api, 'hud'))) return null
  const set = await sets.current(api)
  const { Box, Text } = api.ui.resolve(e)
  const columns = Math.max(0, Math.floor(e.props.bodyColumns))
  const { nodes: row, contextColor, used: consumed } = await hudRow(api, e, set, columns)
  let used = consumed
  // The readouts fill their row first, so a contribution with no room beside
  // them (Compact now, 15 cells) takes a row of its own instead of vanishing.
  const second: RenderNode[] = []
  let usedSecond = 0
  for (const mod of mods) {
    if (!mod.band || !set.mods[mod.id].enabled) continue
    const gap = row.length ? 3 : 0
    const remaining = Math.max(0, columns - used - gap)
    try {
      const part = await mod.band({ api, e, set, settings: set.mods[mod.id], columns: remaining, contextColor })
      if (!part || part.columns <= 0) continue
      if (part.columns <= remaining) {
        if (gap) row.push(<Text dimColor> · </Text>)
        row.push(part.node)
        used += gap + part.columns
        continue
      }
      const secondGap = second.length ? 3 : 0
      if (usedSecond + secondGap + part.columns > columns) continue
      if (secondGap) second.push(<Text dimColor> · </Text>)
      second.push(part.node)
      usedSecond += secondGap + part.columns
    } catch {
      // A broken contribution must leave the other rows visible.
    }
  }
  const rows = [<Box flexDirection="row" width={columns} flexWrap="nowrap">{row}</Box>]
  if (second.length) rows.push(<Box flexDirection="row" width={columns} flexWrap="nowrap">{second}</Box>)
  return rows
}

export function createHud(sets: SetsEngine): HudMod {
  let timer: Timer | null = null
  const stop = () => {
    timer?.cancel()
    timer = null
  }
  const tick = async (api: UltraApi) => {
    if (!(await sets.enabled(api, 'hud')) || !(await read(api, turn)).id) {
      stop()
      return
    }
    const now = await api.clock.now()
    await update(api, turn, held => held.id ? { ...held, now } : held)
  }
  const sync = async (api: UltraApi) => {
    if (!(await sets.enabled(api, 'hud')) || !(await read(api, turn)).id) {
      stop()
    } else if (!timer) {
      timer = api.clock.every(1_000, () => { void tick(api).catch(stop) })
    }
  }
  const start: HudMod['start'] = async (api, e) => {
    stop()
    const now = await api.clock.now()
    await update(api, turn, () => ({ id: e.turnId, startedAt: now, now, durationMs: null, edits: 0, commands: 0 }))
    await sync(api)
  }
  const complete: HudMod['complete'] = async (api, e) => {
    if (e.agentId) return
    stop()
    await update(api, turn, held => ({ ...held, id: null, startedAt: null, durationMs: e.durationMs }))
  }

  return {
    id: 'hud', start, complete, sync, stop,
    watch: {
      when: e => !e.agentId && ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'].includes(String(e.tool)),
      run: (api, e) => async result => {
        if (!result.deny && (String(e.tool) === 'Bash' || !result.isError)) {
          await update(api, turn, held => held.id ? {
            ...held,
            edits: held.edits + (String(e.tool) === 'Bash' ? 0 : 1),
            commands: held.commands + (String(e.tool) === 'Bash' ? 1 : 0),
          } : held)
        }
        return result
      },
    },
  }
}
