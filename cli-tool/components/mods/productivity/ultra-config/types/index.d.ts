// The contract of the ultra-config plugin: the state its pane draws from.

/** One `/config` row as `$.config.list()` returns it (ConfigRow in the API). */
export type UltraConfigRow = {
  key: string
  label: string
  description?: string
  kind: 'boolean' | 'choice' | 'text' | 'number'
  value: boolean | string | number | readonly string[]
  options?: readonly string[]
  isLocked: boolean
}

/** What the pane knows about the person's configuration, read on open and after every change. */
export type UltraConfigSnapshot = {
  rows: UltraConfigRow[]
  /** ~/.claude/settings.json as parsed; `{}` when there is none. */
  user: Record<string, unknown>
  /** Where that file is; null when neither CLAUDE_CONFIG_DIR nor a home directory is known. */
  path: string | null
  /** Why the file could not be read (bad JSON): settings-layer steps are then skipped. */
  error: string | null
}

export type UltraConfigEntry =
  | { layer: 'config'; key: string; label: string; previous: string | number | boolean | readonly string[] }
  | { layer: 'settings'; path: string; label: string; previous: unknown; had: boolean }
  | { layer: 'list'; path: string; label: string; added: string[] }

/** One applied profile, kept so it can be undone. */
export type UltraConfigBackup = {
  id: string
  profile: 'saver' | 'flow' | 'quality' | 'guarded' | 'autopilot'
  name: string
  at: string
  entries: UltraConfigEntry[]
  refused: { label: string; reason: string }[]
  /** The effort the profile set, saved per model at the next request. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh'
}

/** The main loop's model id and effort, as the last request carried them. */
export type UltraConfigLive = { model?: string; effort?: string | number }

/** An effort waiting for the next request to name the model it is saved under. */
export type UltraConfigPending = { value: 'low' | 'medium' | 'high' | 'xhigh'; backupId: string }

export type UltraConfigUi = {
  /** The profile whose detail is open; null means the first. */
  selected: string | null
  /** A one-line result under the header (applied, undone, refused). */
  notice: { text: string; tone: 'success' | 'warning' | 'error' } | null
  isBusy: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'ultra-config': {
      ui: UltraConfigUi
      snapshot: UltraConfigSnapshot
      history: UltraConfigBackup[]
      live: UltraConfigLive
      pending: UltraConfigPending | null
    }
  }
}
