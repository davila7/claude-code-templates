/**
 * policy-ceiling: turn an organization's limits into ceilings and floors over
 * the merged settings. Pure functions of the layers and the merge, no `$`.
 */
import type { Row } from '../types'

export type { Row } from '../types'
export type Settings = Record<string, unknown>
export interface Layer { source: string; settings: Settings }

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export interface Rules {
  maxCleanupPeriodDays?: number
  deniedModels: readonly string[]
  fallbackModel?: string
  maxEffort?: Effort
  forbiddenModes: readonly string[]
  requireSandbox: boolean
}

export const PLUGIN = 'policy-ceiling'

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').map(s => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * The rules, read from the managed (`policy`) layer only: its
 * `pluginConfigs["policy-ceiling…"].options`. A person's own settings never
 * set or loosen them, whatever they put under pluginConfigs.
 */
export function rulesFrom(layers: readonly Layer[]): Rules | undefined {
  const policy = layers.find(l => l.source === 'policy')?.settings
  const configs = policy && isObject(policy.pluginConfigs) ? policy.pluginConfigs : undefined
  if (!configs) return undefined
  const key = Object.keys(configs).find(k => k === PLUGIN || k.startsWith(`${PLUGIN}@`))
  const entry = key ? configs[key] : undefined
  const o = isObject(entry) && isObject(entry.options) ? entry.options : undefined
  if (!o) return undefined
  const days = typeof o.maxCleanupPeriodDays === 'number' && o.maxCleanupPeriodDays > 0 ? o.maxCleanupPeriodDays : undefined
  const effort = typeof o.maxEffort === 'string' && (EFFORTS as readonly string[]).includes(o.maxEffort) ? (o.maxEffort as Effort) : undefined
  return {
    maxCleanupPeriodDays: days,
    deniedModels: list(o.deniedModels),
    fallbackModel: typeof o.fallbackModel === 'string' && o.fallbackModel.trim() ? o.fallbackModel.trim() : undefined,
    maxEffort: effort,
    forbiddenModes: list(o.forbiddenModes),
    requireSandbox: o.requireSandbox === true,
  }
}

const show = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v))

/** Any value above the ceiling, or one that is not a known level (`"MAX"`, `"ultra"`, a number), becomes the ceiling. */
function lowerEffort(value: unknown, max: Effort): unknown {
  const at = typeof value === 'string' ? EFFORTS.indexOf(value as Effort) : -1
  return at === -1 || at > EFFORTS.indexOf(max) ? max : value
}

/** Environment variables that pick a model behind `model`'s back. */
const MODEL_ENV = ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']

/** A denied model matches by exact name, with a `[1m]`-style suffix, or with a date suffix (`claude-opus-4-8` denies `claude-opus-4-8-20260101`). */
export function isDenied(model: string, denied: readonly string[]): boolean {
  return denied.some(d => model === d || model.startsWith(`${d}[`) || model.startsWith(`${d}-20`))
}

/**
 * Applies the rules to the merged settings. Returns the new merge and one row
 * per rule for /policy. Never adds a key the rule does not name, never
 * loosens a value.
 */
export function apply(merged: Settings, rules: Rules): { settings: Settings; rows: Row[] } {
  const out: Settings = { ...merged }
  const rows: Row[] = []

  if (rules.maxCleanupPeriodDays !== undefined) {
    const asked = merged.cleanupPeriodDays
    const max = rules.maxCleanupPeriodDays
    // Absent means Claude Code's default (30 days); only a larger value or the default above max is clamped.
    const effective = typeof asked === 'number' ? asked : 30
    const clamped = effective > max
    if (clamped) out.cleanupPeriodDays = max
    rows.push({ setting: 'cleanupPeriodDays', requested: show(asked ?? '30 (default)'), limit: `≤ ${max}`, result: show(clamped ? max : effective), state: clamped ? 'clamped' : 'within' })
  }

  if (rules.deniedModels.length > 0) {
    const asked = merged.model
    const denied = typeof asked === 'string' && isDenied(asked, rules.deniedModels)
    // A fallback that is itself denied is no fallback.
    const fallback = rules.fallbackModel && !isDenied(rules.fallbackModel, rules.deniedModels) ? rules.fallbackModel : undefined
    if (denied) {
      if (fallback) out.model = fallback
      else delete out.model
    }
    if (isObject(merged.env)) {
      const env: Record<string, unknown> = { ...merged.env }
      for (const key of MODEL_ENV) if (typeof env[key] === 'string' && isDenied(env[key] as string, rules.deniedModels)) delete env[key]
      out.env = env
    }
    rows.push({
      setting: 'model',
      requested: show(asked),
      limit: `not ${rules.deniedModels.join(', ')}`,
      result: denied ? show(fallback ?? 'default') : show(asked ?? 'default'),
      state: denied ? 'clamped' : asked === undefined ? 'unset' : 'within',
    })
  }

  if (rules.maxEffort) {
    const max = rules.maxEffort
    const asked = merged.effortLevel
    let clamped = false
    const askedParts: string[] = []
    const resultParts: string[] = []
    if (asked !== undefined) {
      const lowered = lowerEffort(asked, max)
      if (lowered !== asked) { out.effortLevel = lowered; clamped = true }
      askedParts.push(show(asked))
      resultParts.push(show(lowered))
    }
    // Opus/Sonnet 5.5+ read effort per model: modelSettings[id].effortLevel.
    if (isObject(merged.modelSettings)) {
      const next: Record<string, unknown> = {}
      for (const [id, s] of Object.entries(merged.modelSettings)) {
        if (isObject(s) && s.effortLevel !== undefined) {
          const lowered = lowerEffort(s.effortLevel, max)
          if (lowered !== s.effortLevel) clamped = true
          next[id] = { ...s, effortLevel: lowered }
          askedParts.push(`${id}: ${show(s.effortLevel)}`)
          resultParts.push(`${id}: ${show(lowered)}`)
        } else next[id] = s
      }
      out.modelSettings = next
    }
    rows.push({
      setting: 'effortLevel',
      requested: askedParts.length > 0 ? askedParts.join(', ') : show(undefined),
      limit: `≤ ${max}`,
      result: resultParts.length > 0 ? resultParts.join(', ') : show(undefined),
      state: clamped ? 'clamped' : askedParts.length === 0 ? 'unset' : 'within',
    })
  }

  if (rules.forbiddenModes.length > 0) {
    const perms = isObject(merged.permissions) ? merged.permissions : {}
    const asked = perms.defaultMode
    const forbidden = typeof asked === 'string' && rules.forbiddenModes.includes(asked)
    if (forbidden) out.permissions = { ...perms, defaultMode: 'default' }
    rows.push({ setting: 'permissions.defaultMode', requested: show(asked), limit: `not ${rules.forbiddenModes.join(', ')}`, result: forbidden ? 'default' : show(asked ?? 'default'), state: forbidden ? 'clamped' : asked === undefined ? 'unset' : 'within' })
  }

  if (rules.requireSandbox) {
    const sandbox = isObject(merged.sandbox) ? merged.sandbox : {}
    const asked = sandbox.enabled
    const forced = asked !== true
    // A floor with an escape hatch is no floor: commands may not ask to run outside it.
    const hatch = sandbox.allowUnsandboxedCommands !== false
    if (forced || hatch) out.sandbox = { ...sandbox, enabled: true, allowUnsandboxedCommands: false }
    rows.push({ setting: 'sandbox.enabled', requested: show(asked), limit: 'true, no bypass', result: 'true', state: forced || hatch ? 'forced' : 'within' })
  }

  return { settings: out, rows }
}
