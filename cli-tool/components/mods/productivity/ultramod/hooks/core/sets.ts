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

async function afterChanges(changes: Promise<unknown>, action: () => Promise<UltraSet>): Promise<UltraSet> {
  try {
    await changes
  } catch {
    // The queue moves on after a failed action.
  }
  return action()
}

async function settled(result: Promise<unknown>): Promise<void> {
  try {
    await result
  } catch {
    // A failed action does not hold up the next one.
  }
}

export function createSets(options: PluginOptions = {}) {
  let cache: UltraSet | null = null
  // The project root the published set was read for.
  let loadedRoot: string | null = null
  let changes: Promise<unknown> = Promise.resolve()
  // Serialize presses so each toggle reads the previous action's result.
  const mutate = (action: () => Promise<UltraSet>) => {
    const result = afterChanges(changes, action)
    changes = settled(result)
    return result
  }
  const load = async (api: UltraApi) => {
    const root = await api.session.root()
    return { root, set: resolveSet(await api.store.get(projectKey(root)), options) }
  }
  const publish = async (api: UltraApi, set: UltraSet) => {
    await update(api, activeSet, () => set)
    cache = set
    return set
  }
  const current = async (api: UltraApi) => {
    const state = await read(api, activeSet)
    cache = state ?? cache ?? (await load(api)).set
    return cache
  }
  const hydrate = async (api: UltraApi) => {
    const { root, set } = await load(api)
    const published = await publish(api, set)
    loadedRoot = root
    return published
  }
  const save = async (api: UltraApi, set: UltraSet) => {
    await api.store.set(projectKey(await api.session.root()), { set: set.name, overrides: set.overrides })
    return publish(api, set)
  }
  return {
    current,
    ensure: async (api: UltraApi) => {
      // /cd or a worktree move changes the root: the set saved for the new
      // project replaces the one read for the old one. The root counts as
      // loaded only once its set is published, so a failed write is retried.
      const root = await api.session.root()
      if (loadedRoot !== null && loadedRoot !== root) return hydrate(api)
      const state = await read(api, activeSet)
      if (state) {
        loadedRoot ??= root
        return state
      }
      const set = await publish(api, await current(api))
      loadedRoot ??= root
      return set
    },
    hydrate,
    enabled: async (api: UltraApi, id: ModId) => (await current(api)).mods[id].enabled,
    switch: (api: UltraApi, name: UltraSetName) => mutate(() => save(api, resolveSet({ set: name }, options))),
    toggle: (api: UltraApi, id: ModId) => mutate(async () => {
      const set = await current(api)
      const overrides = { ...set.overrides, [id]: !set.mods[id].enabled }
      if (overrides[id] === sets[set.name][id].enabled) delete overrides[id]
      return save(api, resolveSet({ set: set.name, overrides }, options))
    }),
    reset: (api: UltraApi) => mutate(async () => {
      const set = await current(api)
      return save(api, resolveSet({ set: set.name }, options))
    }),
  }
}
export type SetsEngine = ReturnType<typeof createSets>

export async function settingsFor(api: UltraApi, id: ModId): Promise<UltraModSettings> {
  return (await read(api, activeSet) ?? resolveSet(undefined)).mods[id]
}
