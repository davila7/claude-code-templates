export type SecondOpinionVendor = 'openai' | 'gemini' | 'xai'
export type SecondOpinionEffort = 'auto' | 'low' | 'medium' | 'high' | 'max'

/** One model a vendor lists; `name` is the vendor's display name when it gives one. */
export type SecondOpinionModel = { id: string; name?: string; isNew?: boolean }

/** What the person picked in /reviewer; kept in $.store across sessions. */
export type SecondOpinionPrefs = {
  /** The models that review, as `<vendor>:<model id>`. */
  enabled: string[]
  /** The one picked in the bar above the prompt, or `all` for every turned-on one. */
  active: string
  effort: SecondOpinionEffort
}

export type SecondOpinionModelList = {
  models: SecondOpinionModel[]
  error?: string
  isLoading?: boolean
}

export type SecondOpinionModels = Record<SecondOpinionVendor, SecondOpinionModelList>

declare module 'claude-code' {
  interface PluginState {
    'second-opinion': {
      prefs: SecondOpinionPrefs | null
      models: SecondOpinionModels
      /** The pane's search text. */
      filter: string
    }
  }
}
