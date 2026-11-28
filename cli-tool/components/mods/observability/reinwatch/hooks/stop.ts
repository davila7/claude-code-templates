import type { TurnStepChunk, TurnStepInput, TurnStepResult } from 'claude-code'
import type { AgentRow } from '../types'
import type { Tracker } from './tracker'

export const STOP_DENY = 'The user stopped this agent from reinwatch.'
export const STOP_REPLY = 'The user stopped this agent. Report what you have so far and do not resume or retry this task unless the user asks.'

// True only for an agent the user stopped. The main conversation (no agentId) and unknown agents are never stopped.
// Reads the row without creating one.
export function isStopped(t: Tracker, agentId: string | undefined): boolean {
  return isStoppedIn(t.agents, agentId)
}

// The same question of any rows, for example the ones the atom holds. No rows (a read that failed) never stop anyone.
export function isStoppedIn(rows: Readonly<Record<string, Pick<AgentRow, 'isStopped'>>> | null | undefined, agentId: string | undefined): boolean {
  if (rows == null || agentId === undefined) return false
  return rows[agentId]?.isStopped === true
}

// The answer to a stopped agent's next model request: no request is made.
export async function* stoppedStep(e: TurnStepInput): AsyncGenerator<TurnStepChunk, TurnStepResult> {
  yield { kind: 'text', index: 0, text: STOP_REPLY }
  yield { kind: 'stop', stopReason: 'end_turn', usage: null }
  return { turnId: e.turnId, index: e.index, answer: STOP_REPLY, toolUses: [], stopReason: 'end_turn', usage: null }
}
