// Run with: claude plugin test enterprise/policy-ceiling
import { describe, expect, test } from 'claude-code/testing'
import { apply, rulesFrom, type Layer } from '../hooks/ceiling.ts'

const policy = (options: Record<string, unknown>, extra: Record<string, unknown> = {}): Layer => ({
  source: 'policy',
  settings: { pluginConfigs: { 'policy-ceiling@acme': { options } }, ...extra },
})
const user = (settings: Record<string, unknown>): Layer => ({ source: 'user', settings })

describe('rules', () => {
  test('come from the managed layer only', () => {
    const fromUser: Layer = { source: 'user', settings: { pluginConfigs: { 'policy-ceiling': { options: { maxCleanupPeriodDays: 999 } } } } }
    expect(rulesFrom([fromUser])).toBe(undefined)
    expect(rulesFrom([fromUser, policy({ maxCleanupPeriodDays: 30 })])?.maxCleanupPeriodDays).toBe(30)
    expect(rulesFrom([policy({ maxCleanupPeriodDays: 0, deniedModels: '', requireSandbox: false })])).toBe(undefined)
  })

  test('an unknown effort is ignored', () => {
    expect(rulesFrom([policy({ maxEffort: 'ultra' })])?.maxEffort).toBe(undefined)
  })
})

describe('apply', () => {
  const rules = rulesFrom([policy({
    maxCleanupPeriodDays: 30,
    deniedModels: 'opus[1m],claude-opus-4-8',
    fallbackModel: 'opus',
    maxEffort: 'xhigh',
    forbiddenModes: 'bypassPermissions',
    requireSandbox: true,
  })])!

  test('clamps values above the ceiling and keeps the rest', () => {
    const merged = {
      cleanupPeriodDays: 365,
      model: 'opus[1m]',
      effortLevel: 'max',
      modelSettings: { 'claude-opus-5-5': { effortLevel: 'max' }, 'claude-haiku-5-5': { effortLevel: 'low' } },
      permissions: { defaultMode: 'bypassPermissions', allow: ['Bash(ls)'] },
      sandbox: { enabled: false, network: { allowedDomains: ['x.com'] } },
      theme: 'dark',
    }
    const { settings, rows } = apply(merged, rules)
    expect(settings.cleanupPeriodDays).toBe(30)
    expect(settings.model).toBe('opus')
    expect(settings.effortLevel).toBe('xhigh')
    expect(settings.modelSettings).toEqual({ 'claude-opus-5-5': { effortLevel: 'xhigh' }, 'claude-haiku-5-5': { effortLevel: 'low' } })
    expect(settings.permissions).toEqual({ defaultMode: 'default', allow: ['Bash(ls)'] })
    expect(settings.sandbox).toEqual({ enabled: true, allowUnsandboxedCommands: false, network: { allowedDomains: ['x.com'] } })
    expect(settings.theme).toBe('dark')
    expect(rows.map(r => r.state)).toEqual(['clamped', 'clamped', 'clamped', 'clamped', 'forced'])
  })

  test('the effort row shows per-model values, also with no top-level effort', () => {
    const { rows } = apply({ modelSettings: { 'claude-opus-5-5': { effortLevel: 'max' } } }, rules)
    const effort = rows.find(r => r.setting === 'effortLevel')!
    expect(effort).toMatchObject({ requested: 'claude-opus-5-5: max', result: 'claude-opus-5-5: xhigh', state: 'clamped' })
  })

  test('values inside the limits are untouched', () => {
    const merged = { cleanupPeriodDays: 7, model: 'sonnet', effortLevel: 'medium', permissions: { defaultMode: 'acceptEdits' }, sandbox: { enabled: true, allowUnsandboxedCommands: false } }
    const { settings, rows } = apply(merged, rules)
    expect(settings).toEqual(merged)
    expect(rows.every(r => r.state === 'within')).toBe(true)
  })

  test('the 30-day default counts as within a 30-day ceiling and is clamped by a lower one', () => {
    expect(apply({}, rules).settings.cleanupPeriodDays).toBe(undefined)
    const tight = rulesFrom([policy({ maxCleanupPeriodDays: 14 })])!
    expect(apply({}, tight).settings.cleanupPeriodDays).toBe(14)
  })

  test('model environment variables, a denied fallback and unknown efforts cannot get around the limits', () => {
    const r = rulesFrom([policy({ deniedModels: 'opus[1m],claude-opus-4-8', fallbackModel: 'claude-opus-4-8', maxEffort: 'high' })])!
    const { settings } = apply({ model: 'opus[1m]', effortLevel: 'MAX', env: { ANTHROPIC_MODEL: 'opus[1m]', ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-8', OTHER: '1' } }, r)
    expect(settings.model).toBe(undefined)
    expect(settings.env).toEqual({ OTHER: '1' })
    expect(settings.effortLevel).toBe('high')
  })

  test('the sandbox floor closes the unsandboxed escape hatch', () => {
    const r = rulesFrom([policy({ requireSandbox: true })])!
    const { settings, rows } = apply({ sandbox: { enabled: true } }, r)
    expect(settings.sandbox).toEqual({ enabled: true, allowUnsandboxedCommands: false })
    expect(rows[0].state).toBe('forced')
    expect(apply({ sandbox: { enabled: true, allowUnsandboxedCommands: false } }, r).rows[0].state).toBe('within')
  })

  test('a dated id of a denied model is denied too', () => {
    expect(apply({ model: 'claude-opus-4-8-20260101' }, rules).settings.model).toBe('opus')
    expect(apply({ model: 'claude-opus-4-8x' }, rules).settings.model).toBe('claude-opus-4-8x')
  })
})

const PANE = {
  plugin: 'policy-ceiling', component: 'Pane', requestId: 'policy-ceiling', surface: 'terminal',
  props: { title: 'Organization policy', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

// $.settings.read is not on a test's engine, so the settings.read hook is covered through apply() above;
// the pane is covered here on every surface.
describe('the /policy pane', () => {
  test('with no rules it says how to add them', async ($, on) => {
    on('session.identity', () => ({ value: { kind: 'claude.ai' } }))
    const ui = await $.ui.mount(PANE as never)
    expect((await ui.find({ type: 'Text', text: /No ceilings applied/ }))?.text).toContain("No ceilings applied")
    await ui.unmount()
  })

  test('shows each rule and marks the clamped ones, on every surface', async ($, on) => {
    const rules = rulesFrom([policy({ maxCleanupPeriodDays: 30, requireSandbox: true })])!
    const { rows } = apply({ cleanupPeriodDays: 365, sandbox: { enabled: true } }, rules)
    on('session.identity', () => ({ value: { kind: 'claude.ai', email: 'dev@acme.com' } }))
    on('state.get', () => ({ value: { value: { shape: 'snapshot-1', value: { rows, hasRules: true, layers: ['user', 'policy'] } }, version: 1 } }))
    for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface } as never)
      expect((await ui.find({ type: 'Text', text: /clamped/ }))?.text).toContain('clamped')
      expect((await ui.find({ type: 'Text', text: /acme\.com/ }))?.text).toContain('claude.ai')
      expect((await ui.find({ type: 'Text', text: /Layers read/ }))?.text).toContain('policy')
      await ui.unmount()
    }
  })
})
