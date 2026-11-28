import type { AgentInfo, RenderSurface } from 'claude-code'
import type { AgentRow } from '../types'
import { clean } from './clean'
import { redact } from './redact'

// What the pane and the band share: the buttons' words, the rules both apply to a row or a text, and the types of what
// register.tsx hands them. Nothing here touches `$`: the engine refuses a `$` that is passed or stored, so the work that
// does need it (viewing, messaging, toasts, the confirm and expanded atoms) is spelled inside the render hook's own
// button closures.

export const ASK_TO_STOP = 'Message from the user, sent with reinwatch: please stop at the next safe point and report what you have so far.'
export const ASKED_TOAST = 'Asked the agent to stop.'
// Only the terminal has a main view a mod can switch; the other surfaces are host-driven, so View is drawn there only.
export const hasMainView = (surface: RenderSurface): boolean => surface === 'terminal'
export const cannotShow = (deny: string): string => `Cannot show this agent: ${deny}`
export const cannotMessage = (reason: string): string => `Could not message this agent: ${reason}`

// Stop and Ask to stop are offered only for a live agent: one not stopped whose status is running or idle. A message to
// an agent that finished could wake it.
export const isLive = (row: AgentRow): boolean => !row.isStopped && (row.status === 'running' || row.status === 'idle')

// What is shown of a text someone else wrote: one plain line, masked when the settings say so. Asked at draw time, so text
// stored by an earlier version or while masking was off is shown safely too.
export const masker = (isMasking: () => boolean): ((text: string) => string) => text => {
  const plain = clean(text)
  return isMasking() ? redact(plain) : plain
}

// The engine's agent list, kept for a second so the pane, the band and the tick share one fetch. Built in register.tsx;
// each reader still asks `$.agent.list()` itself (inside its own hook) when `get` has nothing, and `put`s the answer.
export type ListCache = {
  get: (now: number) => AgentInfo[] | null
  put: (now: number, list: AgentInfo[]) => void
}

// Built in register.tsx, where the tracker lives. No `$` here: each mutates the tracker and flushes.
export type WatchActions = {
  stop: (agentId: string) => Promise<void>
  resume: (agentId: string) => Promise<void>
  dismiss: (key: string) => Promise<void>
}
