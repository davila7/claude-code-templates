/**
 * The contract of the values this mod keeps in `$.state`: what the band above
 * the prompt draws from. The type is imported by the module from '../types'.
 */

/** Where a candidate comes from: a user or project skill, a plugin's skill, a subagent type. */
export type Origin = 'user' | 'plugin' | 'agent'

export interface Row {
  name: string
  description: string
  origin: Origin
  /** 0 to 100: Jev's probability when it answered, the keyword match otherwise; -1 when the backend reported none. */
  score: number
  /** The words of the draft that matched. */
  hits: string[]
  /** True for the one the mod expects the model to call. */
  isChosen: boolean
}

export interface View {
  /** `prose` while a draft is being matched, `idle` when the band has nothing to say. */
  mode: 'idle' | 'prose'
  /** The draft the rows were computed for. */
  draft: string
  rows: Row[]
  /** `live` keyword match, `thinking` a decision is in flight, `decided` Jev (or the built-in classifier) answered, `none` it answered that nothing is needed, `offline` the decision failed. */
  phase: 'live' | 'thinking' | 'decided' | 'none' | 'offline'
  /** Who decided: 'jev' or 'builtin'; empty while live. */
  by: string
  /** How many skills and subagents were considered. */
  skills: number
  agents: number
}

declare module 'claude-code' {
  interface PluginState {
    'jev-skill-typeahead': { view: View }
  }
}
