/**
 * The contract of the values this mod keeps in `$.state`: what the band above
 * the prompt draws from. The type is imported by the module from '../types'.
 */
export type Mode = 'idle' | 'slash' | 'command' | 'prose'

/** Where a skill comes from: a user or project skill, a plugin's, an MCP prompt. */
export type Origin = 'user' | 'plugin' | 'mcp'

export interface Row {
  name: string
  description: string
  origin: Origin
  /** 0 to 100: Jev's probability when it answered, the keyword match otherwise. */
  score: number
  /** The words of the draft that matched (prose) or the part of the name (slash). */
  hits: string[]
  /** True for the one skill the mod expects to be used. */
  isChosen: boolean
}

export interface View {
  mode: Mode
  /** The draft the rows were computed for. */
  draft: string
  rows: Row[]
  /** `live` keyword match, `thinking` a decision is in flight, `decided` Jev (or the built-in classifier) answered, `none` it answered that no skill is needed, `offline` the decision failed. */
  phase: 'live' | 'thinking' | 'decided' | 'none' | 'offline'
  /** Who decided: 'jev' or 'builtin'; empty while live. */
  by: string
  /** How many skills were considered. */
  roster: number
}

declare module 'claude-code' {
  interface PluginState {
    'jev-skill-typeahead': { view: View }
  }
}
