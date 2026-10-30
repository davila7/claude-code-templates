import { atom, read, update } from 'claude-code'
import type { UltraCommandKind, UltraCommandRun, UltraReceipt } from '../../types/index'
import { fmtCountdown, fmtDuration, fmtUsd } from '../core/format'
import type { UltraApi } from '../core/api'
import type { UltraMod } from '../core/mod'
import { settingsFor } from '../core/sets'
import { claimsIn, commandKind, exitProvesAll } from '../lib/claims'

// The validator wants every atom in a const of the file that reads and writes it.
const receiptHistory = atom({ plugin: 'ultramod', key: 'receipts' } as const, [] as UltraReceipt[])

type CollectedTurn = {
  turnId: string
  tools: number
  files: Set<string>
  commands: UltraCommandRun[]
  subagents: number
  sequence: number
  lastEdit: number
  startCost: number | null
}
let current: CollectedTurn | null = null
const labels: Record<UltraCommandKind, string> = { test: 'tests', build: 'build', typecheck: 'type check', lint: 'lint' }

async function costNow(api: UltraApi): Promise<number | null> {
  try {
    return (await api.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

export const receipts: UltraMod = {
  id: 'receipts',
  sessionStart: { run: () => { current = null } },
  sessionEnd: { run: () => { current = null } },
  sessionRestart: {
    when: e => ['clear', 'resume', 'fork'].includes(e.source),
    run: () => { current = null },
  },
  turnStart: {
    run: async (api, e) => {
      current = { turnId: e.turnId, tools: 0, files: new Set(), commands: [], subagents: 0, sequence: 0, lastEdit: 0, startCost: null }
      current.startCost = await costNow(api)
    },
  },
  watch: {
    when: e => !e.agentId,
    run: (_, e) => {
      const held = current
      if (!held) return null
      held.tools += 1
      const sequence = ++held.sequence
      return result => {
        if (current !== held || result.deny) return result
        const tool = String(e.tool)
        if (e.tool === 'Bash' && typeof e.command === 'string') {
          const error = result.isError ? (result.text ?? (typeof result.result === 'string' ? result.result : '')).split('\n').find(line => line.trim())?.trim() : undefined
          // A zero exit vouches for the tests only when nothing after them sets the exit code.
          const kind = result.isError || exitProvesAll(e.command) ? commandKind(e.command) : null
          held.commands.push({ command: e.command, kind, passed: !result.isError, sequence, ...(error ? { error } : {}) })
        } else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool) && !result.isError) {
          // The envelope is a union, so read the path argument by name rather
          // than through a narrowing the removed tools have left behind.
          const input = e as unknown as Record<string, unknown>
          const path = tool === 'NotebookEdit' ? input.notebook_path : input.file_path
          if (typeof path === 'string') held.files.add(path)
          // A test started before an edit finished cannot verify that edit.
          held.lastEdit = ++held.sequence
        } else if (['Agent', 'Task'].includes(tool) && !result.isError) {
          held.subagents += 1
        }
        return result
      }
    },
  },
  turnComplete: {
    when: e => !e.agentId,
    run: async (api, e) => {
      const held = current
      if (!held || held.turnId !== e.turnId) return null
      current = null
      if (e.isAborted) return null
      const settings = await settingsFor(api, 'receipts')
      if (!settings.enabled || settings.mode === 'off') return null
      const endCost = await costNow(api)
      const costUsd = held.startCost === null || endCost === null ? null : endCost - held.startCost
      const commands = held.commands.sort((a, b) => a.sequence - b.sequence)
      const claims = claimsIn(e.answer)
      const unverified: string[] = []
      const kinds = ['test', 'build', 'typecheck', 'lint'] as const
      for (const kind of kinds) {
        const claimed = kind === 'test' ? claims.tests : claims[kind]
        if (claimed && !commands.some(run => run.kind === kind && run.passed && run.sequence > held.lastEdit)) {
          unverified.push(`says ${labels[kind]} ${kind === 'test' ? 'pass' : 'passes'}, no passing ${kind} run after the last edit`)
        }
      }
      const failed = commands.filter(run => !run.passed).length
      // Subagent spawns stay in the receipt's data; the line lists the turn's own work.
      const parts = ['receipt']
      if (held.files.size) parts.push(`${held.files.size} ${held.files.size === 1 ? 'file' : 'files'}`)
      if (commands.length) parts.push(`${commands.length} ${commands.length === 1 ? 'cmd' : 'cmds'}${failed ? ` (${failed} failed)` : ''}`)
      for (const kind of kinds) {
        const last = commands.findLast(run => run.kind === kind)
        if (last) parts.push(`${labels[kind]} ${last.passed ? 'passed' : 'failed'}`)
      }
      parts.push(fmtDuration(e.durationMs))
      // Nothing spent is no part of the line.
      if (costUsd !== null && costUsd !== 0) parts.push(`${costUsd < 0 ? '-' : '+'}${fmtUsd(Math.abs(costUsd))}`)
      parts.push(...unverified.map(issue => `unverified: ${issue}`))
      const receipt: UltraReceipt = {
        turnId: e.turnId, at: await api.clock.now(), text: parts.join(' · '), files: [...held.files], commands,
        subagents: held.subagents, durationMs: e.durationMs, costUsd, unverified,
      }
      // Compact runs after receipts and reads this turn's evidence.
      await update(api, receiptHistory, history => [...history, receipt].slice(-20))
      const show = settings.mode === 'always' || settings.mode === 'tools' && held.tools > 0 || settings.mode === 'issues' && (failed > 0 || unverified.length > 0)
      return show ? receipt.text : null
    },
  },
  pane: async ({ api, e }) => {
    const history = (await read(api, receiptHistory)).slice(-5).reverse()
    if (!history.length) return null
    const { Box, Text } = api.ui.resolve(e)
    const now = await api.clock.now()
    return <Box key="receipts" flexDirection="column">
      <Text bold>Last receipts</Text>
      {history.map(receipt => <Text key={`receipt-${receipt.turnId}`}>{`${typeof receipt.at === 'number' ? `${fmtCountdown(now - receipt.at)} ago  ` : ''}${receipt.text}`}</Text>)}
    </Box>
  },
}
