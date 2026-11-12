export type RowState = 'clamped' | 'within' | 'forced' | 'unset'

/** One line of /policy: what was asked, the limit, and what the session runs with. */
export type Row = { setting: string; requested: string; limit: string; result: string; state: RowState }

export type Snapshot = { rows: Row[]; hasRules: boolean; layers: string[] }

declare module 'claude-code' {
  interface PluginState {
    'policy-ceiling': { snapshot: Shaped<Snapshot> }
  }
}
