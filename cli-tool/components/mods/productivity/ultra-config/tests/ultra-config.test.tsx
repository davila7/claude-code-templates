// Run with: claude plugin test productivity/ultra-config
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  PROFILES,
  applySettings,
  matchOf,
  planFor,
  restorable,
  revertSettings,
  sameValue,
  setPath,
  userSettingsPath,
} from '../hooks/profiles.ts'
import type { Row } from '../hooks/profiles.ts'

const row = (key: string, label: string, kind: Row['kind'], value: Row['value'], options?: string[], isLocked = false): Row => ({
  key,
  label,
  kind,
  value,
  options,
  isLocked,
})

/** The rows Claude Code 2.1.301 lists, trimmed to what the profiles touch. */
const ROWS = (): Row[] => [
  row('model', 'Model', 'choice', 'Default (recommended)', ['default', 'sonnet', 'opus', 'haiku', 'best']),
  row('fast', 'Fast mode (Opus 5.5)', 'boolean', false),
  row('thinking', 'Thinking mode', 'boolean', true, undefined, true),
  row('outputStyle', 'Output style', 'choice', 'default', ['default', 'Proactive', 'Concise', 'Explanatory', 'Learning']),
  row('promptSuggestionEnabled', 'Prompt suggestions', 'boolean', true),
  row('recap', 'Session recap', 'boolean', true),
  row('autoCompact', 'Auto-compact', 'boolean', true),
  row('workflowSizeGuideline', 'Dynamic workflow size', 'choice', 'medium', ['unrestricted', 'small', 'medium', 'large']),
  row('workflowKeywordTriggerEnabled', 'Ultracode keyword trigger', 'boolean', true),
  row('workflows', 'Dynamic workflows', 'boolean', true),
  row('permissionMode', 'Default permission mode', 'choice', 'default', ['default', 'plan', 'acceptEdits', 'auto', 'dontAsk']),
  row('useAutoModeDuringPlan', 'Use auto mode during plan', 'boolean', true),
  row('checkpoints', 'Rewind code (checkpoints)', 'boolean', true),
  row('verbose', 'Verbose output', 'boolean', false),
  row('turnDuration', 'Show turn duration', 'boolean', true),
  row('progressBar', 'Terminal progress bar', 'boolean', false),
  row('agentPushNotifEnabled', 'Push when Claude decides', 'boolean', false),
  row('inputNeededNotifEnabled', 'Push when actions required', 'boolean', false),
]

const saver = PROFILES.find(p => p.id === 'saver')!
const guarded = PROFILES.find(p => p.id === 'guarded')!

describe('profiles', () => {
  test('there are five, each with a distinct id, color and at least seven steps', () => {
    expect(PROFILES.map(p => p.id)).toEqual(['saver', 'flow', 'quality', 'guarded', 'autopilot'])
    expect(new Set(PROFILES.map(p => p.color)).size).toBe(5)
    for (const p of PROFILES) expect(p.steps.length).toBeGreaterThanOrEqual(7)
  })

  test('every config step names a row Claude Code 2.1.301 has, with a value that row offers', () => {
    const rows = ROWS()
    for (const p of PROFILES)
      for (const s of p.steps) {
        if (s.layer !== 'config') continue
        const r = rows.find(x => x.key === s.key)
        expect(r).toBeDefined()
        if (r!.kind === 'boolean') expect(typeof s.value).toBe('boolean')
        if (r!.kind === 'choice') expect(r!.options).toContain(s.value as string)
      }
  })

  test('the plan says what changes, what is already set and what cannot be', () => {
    const rows = ROWS().filter(r => r.key !== 'workflowKeywordTriggerEnabled')
    const plan = planFor(saver, rows, { env: { MAX_MCP_OUTPUT_TOKENS: '10000' } })
    const by = (id: string) => plan.find(p => p.id === id)!
    expect(by('config:model')).toMatchObject({ status: 'change', from: 'Default (recommended)', to: 'sonnet' })
    expect(by('config:autoCompact').status).toBe('same')
    expect(by('config:workflowKeywordTriggerEnabled').status).toBe('missing')
    expect(by('settings:effortLevel')).toMatchObject({ status: 'change', from: 'unset', to: 'low' })
    expect(by('settings:env.MAX_MCP_OUTPUT_TOKENS').status).toBe('same')
    const { same, of } = matchOf(plan)
    expect(of).toBe(plan.length - 1)
    expect(same).toBe(3)
  })

  test('a locked row and a value the row does not offer are skipped, not written', () => {
    const rows = ROWS().map(r => (r.key === 'permissionMode' ? { ...r, options: ['default', 'plan'] } : r))
    const auto = PROFILES.find(p => p.id === 'autopilot')!
    expect(planFor(auto, rows, {}).find(p => p.id === 'config:permissionMode')!.status).toBe('invalid')
    const locked = ROWS().map(r => (r.key === 'model' ? { ...r, isLocked: true } : r))
    expect(planFor(saver, locked, {}).find(p => p.id === 'config:model')!.status).toBe('locked')
  })

  test("the menu's label for a value counts as that value", () => {
    expect(sameValue('Default (recommended)', 'default')).toBe(true)
    expect(sameValue('Default (recommended)', 'sonnet')).toBe(false)
    expect(sameValue(true, true)).toBe(true)
    expect(restorable(row('model', 'Model', 'choice', 'Default (recommended)', ['default', 'sonnet']))).toBe('default')
  })

  test('settings steps write, undo restores exactly, and other keys are untouched', () => {
    const before = {
      model: 'opus',
      env: { KEEP: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' },
      permissions: { deny: ['Read(./.env)', 'Bash(curl:*)'] },
    }
    const steps = [...saver.steps, ...guarded.steps]
    const { next, entries } = applySettings(before, steps)
    expect(next.effortLevel).toBe('low')
    expect((next.env as Record<string, string>).CLAUDE_CODE_SUBAGENT_MODEL).toBe('haiku')
    expect((next.env as Record<string, string>).KEEP).toBe('1')
    const deny = (next.permissions as { deny: string[] }).deny
    expect(deny.filter(d => d === 'Read(./.env)').length).toBe(1)
    expect(deny).toContain('Bash(curl:*)')
    expect(deny).toContain('Read(~/.ssh/**)')
    expect((next.permissions as Record<string, string>).disableBypassPermissionsMode).toBe('disable')
    expect(revertSettings(next, entries)).toEqual(before)
  })

  test('undo removes keys and parents the profile created', () => {
    const { next, entries } = applySettings({}, guarded.steps)
    expect(Object.keys(next)).toEqual(['permissions'])
    expect(revertSettings(next, entries)).toEqual({})
  })

  test('a null value removes the key', () => {
    const quality = PROFILES.find(p => p.id === 'quality')!
    const { next } = applySettings({ env: { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' } }, quality.steps)
    expect(next.env).toBeUndefined()
    expect(setPath({ a: { b: 1 } }, 'a.b', undefined)).toEqual({})
  })

  test('settings.json is found through CLAUDE_CONFIG_DIR, else the home directory', () => {
    expect(userSettingsPath('/cfg/', '/home/me')).toBe('/cfg/settings.json')
    expect(userSettingsPath(undefined, '/home/me')).toBe('/home/me/.claude/settings.json')
    expect(userSettingsPath(undefined, undefined)).toBeUndefined()
  })
})

// ---------------------------------------------------------------- against the engine

type World = {
  rows: Row[]
  file: string | null
  writes: { path: string; text: string }[]
  sets: { key: string; value: unknown }[]
  log: string[]
  denied: Set<string>
}

function world(on: On, file: string | null = '{\n  "model": "opus"\n}\n', isPlaced = true): World {
  const w: World = { rows: ROWS(), file, writes: [], sets: [], log: [], denied: new Set() }
  const store = new Map<string, unknown>()
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('config.list', () => ({ value: w.rows.map(r => ({ ...r, provider: { plugin: 'engine', tier: 'core' } })) }) as never)
  on('config.set', (_$, e) => {
    const r = w.rows.find(x => x.key === e.key)
    if (!r) return { deny: 'no such row' }
    if (w.denied.has(e.key)) return { deny: `${r.label} can only be turned on from the /config panel.` }
    w.log.push(`set ${e.key}`)
    w.sets.push({ key: e.key, value: e.value })
    r.value = e.value as Row['value']
    return { value: e.value }
  })
  on('fs.read', (_$, e) => {
    if (e.path === '/home/me/.claude/settings.json' && w.file !== null) return { value: w.file }
    throw new Error('ENOENT')
  })
  on('fs.write', (_$, e) => {
    w.writes.push({ path: e.path, text: e.text })
    w.log.push(`write ${e.path.split('/').pop()}`)
    if (e.path === '/home/me/.claude/settings.json') w.file = e.text
    return { value: undefined }
  })
  // the engine's loaded copy follows the file, as it does once it reloads
  on('settings.read', () => ({ value: w.file ? (JSON.parse(w.file) as object) : {} }) as never)
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced } }) as never)
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  return w
}

const run = (args: string) =>
  ({ command: 'ultra-config', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } }) as never

const PANE = { title: 'ultra config', isFocused: true, bodyColumns: 62, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }

describe('the command', () => {
  test('apply writes the config rows, then settings.json with a backup, and undo puts both back', async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('apply saver'))) as { text: string }
    expect(out.text).toMatch(/Token saver activated: \d+ settings changed/)
    expect(w.sets).toContainEqual({ key: 'model', value: 'sonnet' })
    expect(w.sets).toContainEqual({ key: 'outputStyle', value: 'Concise' })
    expect(w.writes[0]).toEqual({ path: '/home/me/.claude/settings.json.ultra-config.bak', text: '{\n  "model": "opus"\n}\n' })
    const written = JSON.parse(w.file!)
    expect(written).toMatchObject({ model: 'opus', effortLevel: 'low', env: { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku', MAX_MCP_OUTPUT_TOKENS: '10000' } })

    w.sets.length = 0
    const undone = (await $.command.run(run('undo'))) as { text: string }
    expect(undone.text).toMatch(/Undid Token saver/)
    expect(w.sets).toContainEqual({ key: 'model', value: 'default' })
    expect(w.sets).toContainEqual({ key: 'outputStyle', value: 'default' })
    expect(JSON.parse(w.file!)).toEqual({ model: 'opus' })
    expect(((await $.command.run(run('undo'))) as { text: string }).text).toBe('Nothing to undo')
  })

  test('settings.json is written before any /config row, so the engine writes rows from the new file', async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    await $.command.run(run('apply saver'))
    const firstSet = w.log.findIndex(l => l.startsWith('set '))
    expect(w.log.lastIndexOf('write settings.json')).toBeLessThan(firstSet)
    w.log.length = 0
    await $.command.run(run('undo'))
    expect(w.log.lastIndexOf('write settings.json')).toBeLessThan(w.log.findIndex(l => l.startsWith('set ')))
  })

  test('a row the engine refuses is reported and left out of the undo', async ($, on) => {
    const w = world(on)
    w.denied.add('permissionMode')
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('apply autopilot'))) as { text: string }
    expect(out.text).toMatch(/⊘ Default permission mode: Default permission mode can only be turned on from the \/config panel\./)
    w.sets.length = 0
    await $.command.run(run('undo'))
    expect(w.sets.map(s => s.key)).not.toContain('permissionMode')
  })

  test('a settings.json that is not JSON is never overwritten', async ($, on) => {
    const w = world(on, '{ "model": "opus", // a comment\n}')
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('apply saver'))) as { text: string }
    expect(out.text).toMatch(/skipped/)
    expect(out.text).toMatch(/Effort: settings.json is not valid JSON/)
    expect(w.writes.filter(x => x.path.endsWith('settings.json'))).toEqual([])
    expect(w.sets.length).toBeGreaterThan(0)
  })

  test('a profile name alone opens its detail in the pane without writing anything', async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('guarded'))) as { text: string }
    expect(out.text).toBe('▣ Guarded: 5 changes, shown in the pane · /ultra-config apply guarded')
    expect(w.sets).toEqual([])
    expect(w.writes).toEqual([])
  })

  test('where no pane can be placed, the profile detail is the command output', async ($, on) => {
    const w = world(on, '{}', false)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('guarded'))) as { text: string }
    expect(out.text).toMatch(/▣ Guarded/)
    expect(out.text).toMatch(/Deny rules: none → \+5 rules/)
    expect(out.text).toMatch(/\/ultra-config apply guarded/)
    expect(w.sets).toEqual([])
    expect(w.writes).toEqual([])
  })

  test('an unknown profile is named, not guessed', async ($, on) => {
    world(on)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true } as never)
    const out = (await $.command.run(run('apply cheap'))) as { text: string }
    expect(out.text).toMatch(/Unknown profile "cheap"/)
  })
})

describe('the pane', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: five profiles, the first open, another opens on press and Activate writes`, async ($, on) => {
      const w = world(on)
      await $.session.start({ cwd: '/work', surface, isInteractive: true } as never)
      await $.command.run(run(''))
      const ui = await $.ui.mount({ plugin: 'ultra-config', surface, component: 'Pane', requestId: 'ultra-config', props: PANE } as never)
      for (const p of PROFILES) expect(await ui.find({ key: `pick:${p.id}` })).toBeDefined()
      expect(await ui.find({ key: 'activate:saver' })).toBeDefined()
      expect(await ui.find({ key: 'activate:flow' })).toBeUndefined()
      await ui.press({ key: 'pick:flow' })
      await ui.redraw()
      expect(await ui.find({ key: 'activate:saver' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /edits\sgo\sthrough\swithout\sa\sprompt/ })).toBeDefined()
      await ui.press({ key: 'activate:flow' })
      await ui.redraw()
      expect(w.sets).toContainEqual({ key: 'permissionMode', value: 'acceptEdits' })
      expect(await ui.find({ type: 'Text', text: /Fast flow activated/ })).toBeDefined()
      expect(await ui.find({ key: 'activate:flow' })).toBeUndefined()
      await ui.unmount()
    })
  }
})
