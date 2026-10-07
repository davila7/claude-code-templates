import type { UltraApi } from './api'
import { atom, read, update } from 'claude-code'
import type { PluginOptions } from 'claude-code'
import type { UltraModSettings, UltraOverrides, UltraSet, UltraSetName } from '../../types/index'
import type { ModId } from './mod'

export const setNames = ['essentials', 'strict', 'flow', 'marathon', 'quiet'] as const
export const modIds: readonly ModId[] = ['guard', 'secrets', 'tests', 'tidy', 'loops', 'receipts', 'compact', 'notify', 'pins', 'hud']
export const activeSet = atom({ plugin: 'ultramod', key: 'set' } as const, null)
const setting = (mode: string, extra: Omit<UltraModSettings, 'enabled' | 'mode'> = {}): UltraModSettings => ({ enabled: mode !== 'off', mode, ...extra })
const essentials = {
  hud: setting('full'), receipts: setting('tools'), guard: setting('ask'), secrets: setting('on'),
  tests: setting('ask'), notify: setting('on', { chime: true }), compact: setting('warn+offer', { warnAt: 70, offerAt: 85 }),
  loops: setting('nudge'), pins: setting('if file'), tidy: setting('off'),
}
export const sets: Readonly<Record<UltraSetName, Readonly<Record<ModId, UltraModSettings>>>> = {
  essentials,
  strict: { ...essentials, receipts: setting('always'), guard: setting('ask', { strict: true }), secrets: setting('strict'), notify: setting('on', { chime: false }), tidy: setting('ask') },
  flow: { ...essentials, hud: setting('compact'), receipts: setting('issues'), tests: setting('off'), notify: setting('on', { chime: false }), compact: setting('warn', { warnAt: 70 }), loops: setting('warn') },
  marathon: { ...essentials, guard: setting('deny'), tests: setting('deny'), notify: setting('on', { chime: false }), compact: setting('auto', { warnAt: 70, offerAt: 85, autoAt: 88 }), tidy: setting('deny') },
  quiet: { ...essentials, hud: setting('off'), receipts: setting('off'), tests: setting('off'), notify: setting('off'), compact: setting('off'), loops: setting('off') },
}
export const isSetName = (name: unknown): name is UltraSetName => typeof name === 'string' && setNames.some(one => one === name)
export const projectKey = (root: string) => `project:${root}`
export const setLabel = (set: UltraSet) => `${set.name}${Object.keys(set.overrides).length ? '*' : ''}`

export function resolveSet(project: unknown, options: PluginOptions = {}): UltraSet {
  const saved = project && typeof project === 'object' ? project as { set?: unknown; overrides?: unknown } : {}
  const name = isSetName(saved.set) ? saved.set : isSetName(options.set) ? options.set : 'essentials'
  const overrides: UltraOverrides = {}
  if (saved.overrides && typeof saved.overrides === 'object') {
    for (const id of modIds) {
      const value = (saved.overrides as Record<string, unknown>)[id]
      if (typeof value === 'boolean') overrides[id] = value
    }
  }
  const mods = Object.fromEntries(modIds.map(id => {
    const preset = sets[name][id]
    const settings = overrides[id] === true && !preset.enabled ? (essentials[id].enabled ? essentials[id] : sets.strict[id]) : preset
    return [id, { ...settings, enabled: overrides[id] ?? preset.enabled }]
  })) as UltraSet['mods']
  mods.notify.notifyAfterSeconds = typeof options.notifyAfterSeconds === 'number' ? options.notifyAfterSeconds : 30
  mods.notify.sound = options.sound !== false
  return { name, overrides, mods }
}

export function createSets(options: PluginOptions = {}) {
  let cache: UltraSet | null = null
  let changes: Promise<unknown> = Promise.resolve()
  // Serialize presses so each toggle reads the previous action's result.
  const mutate = (action: () => Promise<UltraSet>) => {
    const result = changes.then(action, action)
    changes = result.then(() => undefined, () => undefined)
    return result
  }
  const load = async ($: UltraApi) => resolveSet(await $.store.get(projectKey(await $.session.root())), options)
  const publish = async ($: UltraApi, set: UltraSet) => {
    await update($, activeSet, () => set)
    cache = set
    return set
  }
  const current = async ($: UltraApi) => {
    const state = await read($, activeSet)
    cache = state ?? cache ?? await load($)
    return cache
  }
  const save = async ($: UltraApi, set: UltraSet) => {
    await $.store.set(projectKey(await $.session.root()), { set: set.name, overrides: set.overrides })
    return publish($, set)
  }
  return {
    current,
    ensure: async ($: UltraApi) => {
      const state = await read($, activeSet)
      return state ?? publish($, await current($))
    },
    hydrate: async ($: UltraApi) => publish($, await load($)),
    enabled: async ($: UltraApi, id: ModId) => (await current($)).mods[id].enabled,
    switch: ($: UltraApi, name: UltraSetName) => mutate(() => save($, resolveSet({ set: name }, options))),
    toggle: ($: UltraApi, id: ModId) => mutate(async () => {
      const set = await current($)
      const overrides = { ...set.overrides, [id]: !set.mods[id].enabled }
      if (overrides[id] === sets[set.name][id].enabled) delete overrides[id]
      return save($, resolveSet({ set: set.name, overrides }, options))
    }),
    reset: ($: UltraApi) => mutate(async () => {
      const set = await current($)
      return save($, resolveSet({ set: set.name }, options))
    }),
  }
}
export type SetsEngine = ReturnType<typeof createSets>

export async function settingsFor($: UltraApi, id: ModId): Promise<UltraModSettings> {
  return (await read($, activeSet) ?? resolveSet(undefined)).mods[id]
}
