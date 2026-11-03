/**
 * human-gate — Claude Mod
 *
 * Two lanes for permissions, on `tool.check`:
 *   - Irreversible calls (deploy, publish, push to a protected branch, money,
 *     outbound messages, destructive SQL) are answered `ask` by this hook. Since
 *     Claude Code 2.1.304 a hook's ask is a person's: neither the auto-mode
 *     classifier nor an allow rule settles it, and where nobody can be asked
 *     (claude -p, a headless host) it is a deny with this reason.
 *   - Calls the tool itself marks read-only (`e.isReadOnly`) and that the
 *     engine would only ask about are allowed without a prompt. A deny or an
 *     explicit ask rule from settings always stands.
 *
 * Needs Claude Code >= 2.1.304 (`e.isReadOnly`, a hook's ask held for a person).
 */
import type { Register } from 'claude-code'
import { configFrom, fastLaneAllows, gateFor } from './rules.ts'

export const register: Register = (on, options) => {
  const config = configFrom(options)
  const fastLane = options.readOnlyFastLane !== false
  const trustMcp = options.trustMcpReadOnly === true
  const counts = { gated: 0, fast: 0 }

  on('session.start', async ($, e, next) => {
    if (config.unknownCategories.length > 0) $.ui.log(`[human-gate] unknown categories ignored: ${config.unknownCategories.join(', ')}`)
    if (config.badPatterns.length > 0) $.ui.log(`[human-gate] patterns that do not compile were skipped: ${config.badPatterns.join(', ')}`)
    await $.command.register({ name: 'human-gate', description: 'Show which calls human-gate holds for a person, and what it let through' })
    return next(e)
  })

  on('command.run', { command: 'human-gate' }, async () => {
    const lines = [
      `human-gate: ${[...config.categories].join(', ') || 'no categories'} held for a person.`,
      config.extraCommands.length + config.extraTools.length > 0
        ? `Extra patterns: ${[...config.extraCommands, ...config.extraTools].map(r => r.source).join(', ')}`
        : 'No extra patterns.',
      fastLane
        ? `Read-only fast lane on${trustMcp ? ', MCP tools included' : ' (MCP tools excluded)'}.`
        : 'Read-only fast lane off.',
      `This session: ${counts.gated} held for a person, ${counts.fast} reads let through.`,
    ]
    return { text: lines.join('\n') }
  })

  on('tool.check', async ($, e, next) => {
    const core = await next(e)
    if (core.decision === 'deny') return core

    const gate = await gateFor(e.tool, e.input, config, async dir => {
      try {
        const r = await $.process.run(['git', ...(dir ? ['-C', dir] : []), 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5000 })
        return r.exitCode === 0 ? r.stdout.trim() : undefined
      } catch {
        return undefined
      }
    })
    if (gate) {
      counts.gated++
      $.ui.status(`human-gate · ${counts.gated} held · ${counts.fast} reads let through`)
      const nobody = e.approver === undefined ? ' Nobody can approve it in this session, so it is refused.' : ''
      return {
        decision: 'ask',
        reason: `Only a person can approve this: ${gate.what} (human-gate, ${gate.category}). It cannot be undone.${nobody}`,
      }
    }

    // Fast lane: only turn the engine's plain ask into an allow. A rule the
    // person wrote, a classic hook or a setting's own check keeps its ask.
    if (fastLane && core.decision === 'ask' && core.ceiling !== 'ask' && !core.rule && !core.hook && !core.setting && !core.plugin
      && fastLaneAllows(e.tool, e.isReadOnly === true, trustMcp)) {
      counts.fast++
      $.ui.status(`human-gate · ${counts.gated} held · ${counts.fast} reads let through`)
      return { decision: 'allow', reason: 'read-only call (human-gate fast lane)' }
    }
    return core
  }).catch(async ($, e) => {
    // Fail closed: when the check itself breaks, a person decides.
    $.ui.log(`[human-gate] check failed for ${e.tool}; asking a person`)
    return { decision: 'ask', reason: 'human-gate could not check this call, so a person decides.' }
  })
}
