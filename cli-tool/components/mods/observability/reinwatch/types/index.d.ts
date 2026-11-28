export type Settings = {
  activeMs: number; tokenLimit: number; repeatCount: number; failStreak: number
  burstCount: number; burstWindowMs: number
  notify: boolean; openPaneOnWarning: boolean; redact: boolean
  muted: ReadonlySet<AlertKind>   // warning kinds never raised (the mute option)
  price: { input: number; output: number; currency: string } | null   // per million tokens; null unless both prices are above 0
}
export type RowStatus = 'running' | 'idle' | 'done' | 'failed' | 'stopping' | 'stopped'
export type Tokens = { input: number; cacheWrite: number; cacheRead: number; output: number }
export type AgentRow = {
  id: string
  description: string        // masked at intake when Settings.redact; '' when unknown
  type: string               // subagentType; '' when unknown
  model: string              // '' until known
  parentId?: string          // the spawning agent; absent = the main conversation
  runId?: string             // workflow run id
  isTeammate: boolean
  status: RowStatus
  isStopped: boolean         // the user pressed Stop and has not allowed resume
  inTurn: boolean
  firstSeenAt: number
  lastActiveAt: number
  activeMs: number           // closed busy time
  busySince: number | null   // start of the open busy interval
  busy: number               // open steps + counted open tool calls
  openTools: number          // tool calls not yet ended
  tokens: Tokens
  turns: number
  failStreak: number
  lastTool?: string          // the tool of its latest call, cleaned; absent in rows stored before it was kept
}
export type AlertKind = 'long' | 'tokens' | 'repeat' | 'failures' | 'burst' | 'run'
export type Alert = { key: string; kind: AlertKind; agentId?: string; at: number; text: string }
export type TurnSummary = { agents: number; newAgents: number; tokens: number; activeMs: number; longest: { id: string; activeMs: number }; rows: { id: string; tokens: number; activeMs: number; totalTokens: number; totalActiveMs: number }[] }
export type Summary = { text: string; at: number; rows: { label: string; tokens: number; activeMs: number }[] }
export type StopRecord = { id: string; label: string; at: number; tokens: number; activeMs: number; lastTool: string }
export type Totals = { agents: number; tokens: number; activeMs: number; maxTokens: number; maxActiveMs: number }
export type DayTotals = Totals & { day: string }

declare module 'claude-code' {
  interface PluginState {
    'reinwatch': {
      agents: Shaped<Record<string, AgentRow>>
      alerts: Shaped<Alert[]>
      dismissed: string[]
      stops: Shaped<StopRecord[]>
      summary: Shaped<Summary | null>
      history: Shaped<Totals>
      confirm: string | null
      expanded: string | null
      historyOpen: boolean
      summaryOpen: number | null
      stopsOpen: boolean
    }
  }
}
