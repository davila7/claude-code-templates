/**
 * policy-ceiling — Claude Mod (install through managed settings)
 *
 * Managed settings normally replace a person's value. This mod makes some of
 * them limits instead: a person keeps their own value while it stays inside
 * the organization's ceiling or floor.
 *
 *   cleanupPeriodDays        ≤ maxCleanupPeriodDays
 *   model                    not in deniedModels (falls back to fallbackModel)
 *   effortLevel              ≤ maxEffort, top-level and per model (modelSettings)
 *   permissions.defaultMode  not in forbiddenModes (falls back to default)
 *   sandbox.enabled          true when requireSandbox
 *
 * Hooks `settings.read`, which since Claude Code 2.1.304 carries every layer
 * and rewrites the merged settings every reader sees. The rules are read from
 * the managed layer only (`pluginConfigs["policy-ceiling…"].options` in
 * managed-settings.json), so a person's own pluginConfigs cannot loosen them.
 * `/policy` shows each rule: what was asked, the limit and the result.
 */
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Row, Snapshot } from '../types'
import { apply, rulesFrom } from './ceiling.ts'

const PANE = 'policy-ceiling'
const snapshot = atom({ plugin: 'policy-ceiling', key: 'snapshot' } as const, { rows: [], hasRules: false, layers: [] } as Snapshot, { shape: 'snapshot-1' })

// Theme keys, so the pane reads on light and dark themes; in Claude's own theme `claude` is the Anthropic orange.
const ORANGE = 'claude'
const IVORY = 'text'
const GRAY = 'subtle'
const DIM = 'inactive'

/** Fixed-width cell with non-breaking spaces, so Desktop keeps the columns. */
const cell = (text: string, width: number) => {
  const t = text.length > width - 1 ? `${text.slice(0, width - 2)}…` : text
  return t.padEnd(width, ' ')
}

const LABEL: Record<Row['state'], string> = { clamped: '▲ clamped', forced: '▲ forced', within: '✓ within', unset: '· not set' }

export const register: Register = on => {
  let last = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'policy', description: "Show the organization's ceilings and what this session runs with" })
    return next(e)
  })

  on('command.run', { command: 'policy' }, async $ => {
    // A read of our own raises settings.read through this mod's hook, so the rows are current.
    await $.settings.read().catch(() => undefined)
    const opened = await $.ui.open({ id: PANE, title: 'Organization policy' }).catch(() => ({ isPlaced: false }))
    if (opened.isPlaced) return { text: 'Policy pane opened.' }
    const { rows, hasRules } = await read($, snapshot)
    if (!hasRules) return { text: 'policy-ceiling: no ceilings applied. Install it as a managed plugin in prependPlugins and set pluginConfigs["policy-ceiling"].options in managed settings.' }
    return { text: rows.map(r => `${r.setting}: asked ${r.requested}, limit ${r.limit}, runs ${r.result} (${LABEL[r.state]})`).join('\n') }
  })

  on('settings.read', async ($, e, next) => {
    const answer = await next(e)
    // A read of one source answers that file as loaded: never rewrite it.
    if (e.source || answer.deny !== undefined) return answer
    const rules = rulesFrom(e.layers)
    const result = rules ? apply(answer.value, rules) : { settings: answer.value, rows: [] as Row[] }
    const snap: Snapshot = { rows: result.rows, hasRules: rules !== undefined, layers: e.layers.map(l => l.source) }
    const key = JSON.stringify(snap)
    if (key !== last) {
      last = key
      void update($, snapshot, () => snap)
    }
    return { value: result.settings }
  }).catch(async ($, e, next) => {
    // The ceilings could not be applied: the files' own merge stands, and the log says so.
    $.ui.log('[policy-ceiling] could not apply the ceilings; the settings are read as written', { to: 'debug' })
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    let who = ''
    try {
      const id = await $.session.identity()
      who = id.email ? `${id.email.split('@')[1] ?? ''} · ${id.kind}` : (id.kind ?? '')
    } catch {
      who = ''
    }

    if (!snap.hasRules) {
      return (
        <Box flexDirection="column" gap="sm">
          <Text weight="semibold" color={IVORY}>Organization policy</Text>
          <Text color={GRAY}>No ceilings applied. They take effect when an administrator installs this mod as a managed plugin (prependPlugins) and sets</Text>
          <Text mono color={IVORY}>pluginConfigs["policy-ceiling"].options</Text>
        </Box>
      )
    }

    // Columns sized to the pane (a docked pane is at most 45% of the terminal): setting, asked, limit, result, then the state label.
    const avail = Math.max(50, (e.props.bodyColumns ?? 90) - 11)
    const first = Math.min(24, Math.max(14, Math.floor(avail * 0.3)))
    const rest = Math.max(8, Math.floor((avail - first) / 3))
    const W = [first, rest, rest, rest]
    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="row" justifyContent="space-between">
          <Text weight="semibold" color={IVORY}>Organization policy</Text>
          {who && <Text color={DIM}>{who}</Text>}
        </Box>
        <Box flexDirection="column">
          <Text mono color={GRAY}>{cell('setting', W[0])}{cell('you asked', W[1])}{cell('org limit', W[2])}{cell('runs with', W[3])}</Text>
          {snap.rows.map(r => {
            const hit = r.state === 'clamped' || r.state === 'forced'
            return (
              <Box flexDirection="row">
                <Text mono color={IVORY}>{cell(r.setting, W[0])}</Text>
                <Text mono color={GRAY}>{cell(r.requested, W[1])}</Text>
                <Text mono color={GRAY}>{cell(r.limit, W[2])}</Text>
                <Text mono weight={hit ? 'semibold' : 'regular'} color={hit ? ORANGE : IVORY}>{cell(r.result, W[3])}</Text>
                <Text mono color={hit ? ORANGE : DIM}>{LABEL[r.state]}</Text>
              </Box>
            )
          })}
        </Box>
        <Text color={DIM}>Layers read: {snap.layers.join(' · ') || 'none'}</Text>
      </Box>
    )
  })
}
