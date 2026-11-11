// The contract of the subagent-tuner plugin: the state its band and its pick
// pane draw from. A model or effort is null where the subagent inherits the
// parent's.

export type SubagentTunerMode = 'manual' | 'auto'

export type SubagentTunerChoice = {
  model: string | null
  effort: string | null
}

export type SubagentTunerSettings = {
  mode: SubagentTunerMode
  /** The saved default; null while none is set. */
  saved: SubagentTunerChoice | null
  /** True once the persisted mode and default were loaded into this state. */
  hydrated: boolean
}

/** A subagent launch waiting for the person in its pane. */
export type SubagentTunerPending = {
  /** The pane's id: one pane for each launch. */
  id: string
  subagentType: string
  description: string
  /** The current selection, which Run applies; it starts at the preset. */
  model: string | null
  effort: string | null
  /** True where the call itself set a model or an effort (the preset may differ from it). */
  isCallSet: boolean
}

export type SubagentTunerQueue = {
  items: SubagentTunerPending[]
}

declare module 'claude-code' {
  interface PluginState {
    'subagent-tuner': {
      settings: SubagentTunerSettings
      queue: SubagentTunerQueue
    }
  }
}
