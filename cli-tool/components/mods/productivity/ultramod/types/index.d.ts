export type UltraModId = 'hud' | 'receipts' | 'guard' | 'secrets' | 'tests' | 'notify' | 'compact' | 'loops' | 'pins' | 'tidy'
export type UltraSetName = 'essentials' | 'strict' | 'flow' | 'marathon' | 'quiet'
export type UltraModSettings = {
  enabled: boolean
  mode: string
  strict?: boolean
  chime?: boolean
  warnAt?: number
  offerAt?: number
  autoAt?: number
  notifyAfterSeconds?: number
  sound?: boolean
}
export type UltraOverrides = Partial<Record<UltraModId, boolean>>
export type UltraSet = {
  name: UltraSetName
  overrides: UltraOverrides
  mods: Record<UltraModId, UltraModSettings>
}
export type UltraTurn = {
  id: string | null
  startedAt: number | null
  now: number
  durationMs: number | null
  edits: number
  commands: number
}
export type UltraCommandKind = 'test' | 'build' | 'typecheck' | 'lint'
export type UltraCommandRun = {
  command: string
  kind: UltraCommandKind | null
  passed: boolean
  sequence: number
  error?: string
}
export type UltraReceipt = {
  turnId: string
  // Absent on receipts stored before the pane started showing ages.
  at?: number
  text: string
  files: string[]
  commands: UltraCommandRun[]
  subagents: number
  durationMs: number
  costUsd: number | null
  unverified: string[]
}
export type UltraAllow = { risks: string[]; paths: string[] }
export type UltraCompact = { warned: boolean; offered: boolean }

declare module 'claude-code' {
  interface PluginState {
    ultramod: {
      set: UltraSet | null
      turn: UltraTurn
      receipts: UltraReceipt[]
      allow: UltraAllow
      compact: UltraCompact
    }
  }
}
