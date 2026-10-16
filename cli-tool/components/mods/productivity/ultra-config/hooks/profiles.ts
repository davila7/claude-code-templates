/**
 * ultra-config: the profiles and the pure logic that turns a profile into a
 * plan, applies it to a settings object and undoes it.
 * Nothing here calls `$`, so every rule is unit-tested in tests/.
 *
 * A profile changes two layers:
 *   - `config`: a row of the `/config` menu, written through `$.config.set`
 *     exactly as if the person changed it there (the engine picks the file).
 *   - `settings` / `list`: keys of ~/.claude/settings.json that have no
 *     `/config` row (effortLevel, env, permissions), read-modified-written.
 */
import type { ConfigRow, ConfigValue } from 'claude-code'

/** The part of a `/config` row the plan reads. */
export type Row = Pick<ConfigRow, 'key' | 'label' | 'kind' | 'value' | 'options' | 'isLocked'>

export type ConfigStep = { layer: 'config'; key: string; value: ConfigValue; why: string }
/** `value: null` removes the key. `path` is dotted: `env.MAX_MCP_OUTPUT_TOKENS`. */
export type SettingsStep = { layer: 'settings'; path: string; label: string; value: string | null; why: string }
/** Adds entries to a list (`permissions.deny`), leaving what is there. */
export type ListStep = { layer: 'list'; path: string; label: string; add: string[]; why: string }
export type Step = ConfigStep | SettingsStep | ListStep

export type ProfileId = 'saver' | 'flow' | 'quality' | 'guarded' | 'autopilot'

export type Profile = {
  id: ProfileId
  name: string
  icon: string
  color: string
  tagline: string
  steps: Step[]
}

const cfg = (key: string, value: ConfigValue, why: string): ConfigStep => ({ layer: 'config', key, value, why })
const set = (path: string, label: string, value: string | null, why: string): SettingsStep => ({
  layer: 'settings',
  path,
  label,
  value,
  why,
})

export const EFFORT = { path: 'effortLevel', label: 'Effort' } as const
export const SUBAGENT = { path: 'env.CLAUDE_CODE_SUBAGENT_MODEL', label: 'Subagent model' } as const

export const PROFILES: Profile[] = [
  {
    id: 'saver',
    name: 'Token saver',
    icon: '◔',
    color: '#7fd18b',
    tagline: 'Sonnet, low effort, short answers, Haiku subagents',
    steps: [
      cfg('model', 'sonnet', 'cheaper per token than Opus'),
      set(EFFORT.path, EFFORT.label, 'low', 'less thinking per request'),
      set(SUBAGENT.path, SUBAGENT.label, 'haiku', 'subagents run on the cheapest model'),
      cfg('fast', false, 'fast mode bills at a higher rate'),
      cfg('outputStyle', 'Concise', 'shorter answers, fewer output tokens'),
      cfg('promptSuggestionEnabled', false, 'each suggestion is an extra model call'),
      cfg('recap', false, 'the recap is an extra model call'),
      cfg('autoCompact', true, 'keeps the context from growing unbounded'),
      cfg('workflowSizeGuideline', 'small', 'smaller multi-agent fan-outs'),
      cfg('workflowKeywordTriggerEnabled', false, 'no accidental ultracode fan-outs'),
      set('env.MAX_MCP_OUTPUT_TOKENS', 'MCP output cap', '10000', 'caps MCP tool results (default 25000)'),
    ],
  },
  {
    id: 'flow',
    name: 'Fast flow',
    icon: '»',
    color: '#f2b84b',
    tagline: 'Edits auto-accepted, medium effort, fewer interruptions',
    steps: [
      cfg('model', 'sonnet', 'faster answers than Opus'),
      set(EFFORT.path, EFFORT.label, 'medium', 'balanced reasoning time'),
      cfg('permissionMode', 'acceptEdits', 'file edits go through without a prompt'),
      cfg('outputStyle', 'Concise', 'less to read between steps'),
      cfg('promptSuggestionEnabled', true, 'Tab accepts the next likely prompt'),
      cfg('turnDuration', true, 'see how long each turn took'),
      cfg('progressBar', true, 'progress shows in the terminal tab'),
      cfg('workflowSizeGuideline', 'medium', 'parallel agents when they help'),
    ],
  },
  {
    id: 'quality',
    name: 'Max quality',
    icon: '◆',
    color: '#b48cff',
    tagline: 'Most capable model, deepest reasoning, big workflows',
    steps: [
      cfg('model', 'best', 'the most capable model available to you'),
      set(EFFORT.path, EFFORT.label, 'xhigh', 'the deepest reasoning per request'),
      set(SUBAGENT.path, SUBAGENT.label, null, 'subagents keep the model they ask for'),
      cfg('outputStyle', 'default', 'full explanations, nothing trimmed'),
      cfg('workflows', true, 'multi-agent workflows available'),
      cfg('workflowKeywordTriggerEnabled', true, '"ultracode" starts a workflow'),
      cfg('workflowSizeGuideline', 'large', 'room for large fan-outs'),
      cfg('checkpoints', true, 'rewind any change'),
      cfg('autoCompact', true, 'long sessions keep going'),
    ],
  },
  {
    id: 'guarded',
    name: 'Guarded',
    icon: '▣',
    color: '#6cb6ff',
    tagline: 'You approve each change; no reading secrets; no bypass',
    steps: [
      cfg('permissionMode', 'default', 'every edit and command asks first'),
      cfg('useAutoModeDuringPlan', false, 'plan mode never acts on its own'),
      set('permissions.disableBypassPermissionsMode', 'Bypass mode', 'disable', 'bypassPermissions cannot be turned on'),
      {
        layer: 'list',
        path: 'permissions.deny',
        label: 'Deny rules',
        add: ['Read(./.env)', 'Read(./.env.*)', 'Read(./secrets/**)', 'Read(~/.ssh/**)', 'Read(~/.aws/**)'],
        why: 'the Read tool is blocked on .env, secrets/, ~/.ssh, ~/.aws',
      },
      cfg('checkpoints', true, 'every change can be rewound'),
      cfg('verbose', true, 'see each tool call in full'),
      cfg('workflowKeywordTriggerEnabled', false, 'no fan-out from a keyword'),
    ],
  },
  {
    id: 'autopilot',
    name: 'Autopilot',
    icon: '➤',
    color: '#ff8f6b',
    tagline: 'Long unattended runs: auto mode, recap, push alerts',
    steps: [
      cfg('permissionMode', 'auto', 'the classifier approves safe actions'),
      cfg('useAutoModeDuringPlan', true, 'plans run without stopping'),
      set(EFFORT.path, EFFORT.label, 'high', 'fewer wrong turns on long runs'),
      cfg('workflows', true, 'parallel agents for big tasks'),
      cfg('recap', true, 'a summary waits for you when you return'),
      cfg('agentPushNotifEnabled', true, 'a push when Claude decides something'),
      cfg('inputNeededNotifEnabled', true, 'a push when it needs you'),
      cfg('autoCompact', true, 'the run never stops on a full context'),
    ],
  },
]

export const profileById = (id: string): Profile | undefined =>
  PROFILES.find(p => p.id === id.trim().toLowerCase())

// ---------------------------------------------------------------- planning

export type Status = 'change' | 'same' | 'locked' | 'missing' | 'invalid'

export type PlanItem = {
  id: string
  layer: Step['layer']
  label: string
  from: string
  to: string
  why: string
  status: Status
}

export type Json = Record<string, unknown>

/** A row's value as the menu shows it equals the value a profile sets. */
export function sameValue(current: ConfigValue | undefined, wanted: ConfigValue): boolean {
  if (current === wanted) return true
  if (typeof current !== 'string' || typeof wanted !== 'string') return false
  const c = current.toLowerCase()
  const w = wanted.toLowerCase()
  // the menu shows `Default (recommended)` for the value `default`
  return c === w || c.startsWith(`${w} (`)
}

export const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return 'unset'
  if (v === true) return 'on'
  if (v === false) return 'off'
  if (Array.isArray(v)) return v.length === 0 ? 'none' : `${v.length} rules`
  return String(v)
}

export function getPath(obj: Json, path: string): unknown {
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined
    cur = (cur as Json)[part]
  }
  return cur
}

/** A copy of `obj` with `path` set, or removed when `value` is undefined; empty parents are dropped. */
export function setPath(obj: Json, path: string, value: unknown): Json {
  const [head, ...rest] = path.split('.')
  const out: Json = { ...obj }
  if (rest.length === 0) {
    if (value === undefined) delete out[head!]
    else out[head!] = value
    return out
  }
  const child = out[head!]
  const base = child !== null && typeof child === 'object' && !Array.isArray(child) ? (child as Json) : {}
  const next = setPath(base, rest.join('.'), value)
  if (Object.keys(next).length === 0) delete out[head!]
  else out[head!] = next
  return out
}

const listAt = (obj: Json, path: string): string[] => {
  const v = getPath(obj, path)
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function planFor(profile: Profile, rows: readonly Row[], user: Json): PlanItem[] {
  return profile.steps.map(step => {
    if (step.layer === 'config') {
      const row = rows.find(r => r.key === step.key)
      const base = { id: `config:${step.key}`, layer: step.layer, why: step.why, to: show(step.value) }
      if (!row) return { ...base, label: step.key, from: '—', status: 'missing' as const }
      const item = { ...base, label: row.label, from: show(row.value) }
      if (row.isLocked) return { ...item, status: 'locked' as const }
      if (row.kind === 'choice' && typeof step.value === 'string' && row.options && !row.options.includes(step.value))
        return { ...item, status: 'invalid' as const }
      return { ...item, status: sameValue(row.value, step.value) ? ('same' as const) : ('change' as const) }
    }
    if (step.layer === 'settings') {
      const current = getPath(user, step.path)
      const same = (current ?? null) === step.value
      return {
        id: `settings:${step.path}`,
        layer: step.layer,
        label: step.label,
        from: show(current),
        to: show(step.value),
        why: step.why,
        status: same ? ('same' as const) : ('change' as const),
      }
    }
    const have = listAt(user, step.path)
    const missing = step.add.filter(x => !have.includes(x))
    return {
      id: `list:${step.path}`,
      layer: step.layer,
      label: step.label,
      from: show(have),
      to: missing.length === 0 ? show(have) : `+${missing.length} rules`,
      why: step.why,
      status: missing.length === 0 ? ('same' as const) : ('change' as const),
    }
  })
}

/** How much of a profile is already in force: applicable steps that match, of those that apply. */
export function matchOf(plan: PlanItem[]): { same: number; of: number } {
  const applicable = plan.filter(p => p.status === 'same' || p.status === 'change')
  return { same: applicable.filter(p => p.status === 'same').length, of: applicable.length }
}

/** A row's value as `$.config.set` takes it back: a choice's option, not the menu's label for it. */
export function restorable(row: Row): ConfigValue {
  if (row.kind === 'choice' && row.options) return row.options.find(o => sameValue(row.value, o)) ?? row.value
  return row.value
}

// ---------------------------------------------------------------- applying and undoing

export type BackupEntry =
  | { layer: 'config'; key: string; label: string; previous: ConfigValue }
  | { layer: 'settings'; path: string; label: string; previous: unknown; had: boolean }
  | { layer: 'list'; path: string; label: string; added: string[] }

/** Applies the profile's settings and list steps to the settings object; returns the new object and what to undo. */
export function applySettings(user: Json, steps: Step[]): { next: Json; entries: BackupEntry[] } {
  let next = user
  const entries: BackupEntry[] = []
  for (const step of steps) {
    if (step.layer === 'settings') {
      const had = getPath(next, step.path) !== undefined
      const previous = getPath(next, step.path)
      if ((previous ?? null) === step.value) continue
      next = setPath(next, step.path, step.value ?? undefined)
      entries.push({ layer: 'settings', path: step.path, label: step.label, previous: had ? previous : null, had })
    } else if (step.layer === 'list') {
      const have = listAt(next, step.path)
      const added = step.add.filter(x => !have.includes(x))
      if (added.length === 0) continue
      next = setPath(next, step.path, [...have, ...added])
      entries.push({ layer: 'list', path: step.path, label: step.label, added })
    }
  }
  return { next, entries }
}

/** Puts back what `applySettings` changed; a key the person changed since is restored too. */
export function revertSettings(user: Json, entries: BackupEntry[]): Json {
  let next = user
  for (const entry of [...entries].reverse()) {
    if (entry.layer === 'settings') next = setPath(next, entry.path, entry.had ? entry.previous : undefined)
    else if (entry.layer === 'list') {
      const kept = listAt(next, entry.path).filter(x => !entry.added.includes(x))
      next = setPath(next, entry.path, kept.length === 0 ? undefined : kept)
    }
  }
  return next
}

/** Whether the settings the engine has loaded hold `next`'s value at every path. */
export function inSync(loaded: Json, next: Json, paths: string[]): boolean {
  return paths.every(path => JSON.stringify(getPath(loaded, path) ?? null) === JSON.stringify(getPath(next, path) ?? null))
}

/** Where the user's settings file lives: `CLAUDE_CONFIG_DIR`, else `~/.claude`. */
export function userSettingsPath(configDir: string | undefined, home: string | undefined): string | undefined {
  const dir = configDir && configDir.length > 0 ? configDir : home ? `${home.replace(/[\\/]+$/, '')}/.claude` : undefined
  return dir === undefined ? undefined : `${dir.replace(/[\\/]+$/, '')}/settings.json`
}

/** Pads with non-breaking spaces so Desktop keeps the width (plain spaces collapse there). */
export const pad = (s: string, n: number): string => {
  const cut = [...s]
  return cut.length >= n ? `${cut.slice(0, Math.max(0, n - 2)).join('')}…\u00a0` : s + '\u00a0'.repeat(n - cut.length)
}
export const nb = (s: string): string => s.replace(/ /g, '\u00a0')

export const paneColumns = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 62
  return Math.min(100, Math.max(44, n))
}
