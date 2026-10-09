import { atom, read, update } from 'claude-code'
import type { UltraReceipt } from '../../types/index'
import type { UltraApi } from '../core/api'
import type { UltraMod } from '../core/mod'
import { settingsFor } from '../core/sets'

// The validator wants each atom in the file that reads and writes it.
const compactState = atom({ plugin: 'ultramod', key: 'compact' } as const, { warned: false, offered: false })
const receiptHistory = atom({ plugin: 'ultramod', key: 'receipts' } as const, [] as UltraReceipt[])

const KEEP = 'Keep the current task, the decisions made and the next steps.'
const MAX_INSTRUCTIONS = 2_000
const FILES_MAX = 30

// What the summary has to keep: the work done, what broke, what is still unproven.
export function compactInstructions(receipts: readonly UltraReceipt[]): string {
  const files: string[] = []
  const seen = new Set<string>()
  const failed = new Set<string>()
  const claims = new Set<string>()
  for (const receipt of receipts) {
    for (const file of receipt.files) {
      if (seen.has(file) || files.length >= FILES_MAX) continue
      seen.add(file)
      files.push(file)
    }
    for (const run of receipt.commands) {
      if (!run.passed) failed.add(run.error ? `${run.command}: ${run.error}` : run.command)
    }
    for (const claim of receipt.unverified) claims.add(claim)
  }
  const sections: string[] = []
  if (files.length) sections.push(['Files changed:', ...files.map(file => `- ${file}`)].join('\n'))
  if (failed.size) sections.push(['Commands that failed:', ...[...failed].map(line => `- ${line}`)].join('\n'))
  if (claims.size) sections.push(['Unverified claims:', ...[...claims].map(line => `- ${line}`)].join('\n'))
  const body = sections.join('\n\n')
  if (!body) return KEEP
  // The closing line survives any cut, so the model is always told what to hold on to.
  const budget = MAX_INSTRUCTIONS - KEEP.length - 2
  const head = body.length > budget ? `${body.slice(0, budget - 3)}...` : body
  return `${head}\n\n${KEEP}`
}

// Auto-compaction is held from the moment it is scheduled until the context is
// back under autoAt, so a compact that leaves the next turn above the line does
// not queue another one. A failed compaction lets go so the next turn can retry.
let autoHeld = false

// True once the compaction went through; the warning flags then start over.
async function compactNow($: UltraApi): Promise<boolean> {
  try {
    await $.session.compact({ instructions: compactInstructions(await read($, receiptHistory)) })
  } catch (error) {
    // Compaction is best effort: a failure leaves the turn untouched and the next one can try again.
    $.ui.log(`Ultra Mod could not compact: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
  try {
    await update($, compactState, () => ({ warned: false, offered: false }))
  } catch {
    // The flags only decide whether a toast shows again.
  }
  return true
}

export const compact: UltraMod = {
  id: 'compact',
  hooks: {
    'classic.SessionStart': [{
      when: e => ['clear', 'fork'].includes(e.source),
      run: async ($, e, next) => {
        autoHeld = false
        await update($, compactState, () => ({ warned: false, offered: false }))
        // A cleared conversation starts without the old receipts, or the next summary would carry them as current work.
        if (e.source === 'clear') await update($, receiptHistory, () => [])
        return next(e)
      },
    }],
    'turn.complete': [{
      when: e => !e.agentId,
      run: async ($, e, next) => {
        const result = await next(e)
        try {
          const settings = await settingsFor($, 'compact')
          if (!settings.enabled) return result
          const percent = (await $.session.usage()).context.percent
          if (percent === undefined) return result
          const state = await read($, compactState)
          // A flag starts over once the context is back under its line, so a later climb warns again.
          const warned = state.warned && !(settings.warnAt !== undefined && percent < settings.warnAt)
          const offered = state.offered && !(settings.offerAt !== undefined && percent < settings.offerAt)
          const warn = settings.warnAt !== undefined && percent >= settings.warnAt && !warned
          // The band draws while ui.render holds the write lock, so the offer flag is set here instead.
          const offer = settings.offerAt !== undefined && percent >= settings.offerAt && !offered
          if (warn || offer || warned !== state.warned || offered !== state.offered) {
            await update($, compactState, held => ({
              warned: (held.warned && warned) || warn,
              offered: (held.offered && offered) || offer,
            }))
          }
          if (warn) $.ui.toast(settings.offerAt === undefined
            ? `Context is at ${percent}%. Compacting now would free room for the next task.`
            : `Context is at ${percent}%. A Compact now button appears above the prompt at ${settings.offerAt}%.`)
          // session.compact rejects while a turn runs, so the auto path waits for the turn to be over.
          if (settings.autoAt !== undefined) {
            if (percent < settings.autoAt) autoHeld = false
            else if (!autoHeld) {
              autoHeld = true
              $.clock.after(0, () => {
                void compactNow($).then((done) => { if (!done) autoHeld = false }, () => { autoHeld = false })
              })
            }
          }
        } catch {
          // A measurement failure must not change the turn's own result.
        }
        return result
      },
    }],
  },
  band: async ({ $, e, settings }) => {
    // A render hook may only read: the offer flag is written from turn.complete.
    if (!settings.enabled || settings.offerAt === undefined) return null
    const percent = (await $.session.usage()).context.percent
    if (percent === undefined || percent < settings.offerAt) return null
    const label = 'Compact now'
    const { Button } = $.ui.resolve(e)
    // The terminal draws `[ Compact now ]`, four cells around the label.
    return {
      node: <Button key="compact-now" label={label} hotkey="c" onPress={() => { void compactNow($) }} />,
      columns: label.length + 4,
    }
  },
}
